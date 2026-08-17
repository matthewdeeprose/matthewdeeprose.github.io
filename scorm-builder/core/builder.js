// Top-level orchestrator. Accepts { html } or { markdown }, resolves content,
// embeds images, derives metadata, assembles the self-contained document, and
// packages it as a SCORM 2004 zip.
//
//   build({ html | markdown, title, metadata, features, mathjaxMode, deps }) -> package
//   buildDocument(...) -> { html, metadata }   (self-contained HTML, no zip)

import { buildHtml } from "./html-assembler.js";
import { deriveMetadata } from "./metadata-provider.js";
import { renderMarkdown } from "../render/render-markdown.js";
import { buildPackage } from "../scorm/package-builder.js";
import { embedImages, createBrowserImageResolver } from "../enhancers/image-embedder.js";
import { auditAccessibility } from "../enhancers/audit.js";
import { DEFAULT_FEATURES } from "./defaults.js";

// Resolve the document language (WCAG 3.1.1). Explicit option wins; otherwise
// honour a `lang` on a source <html> element when the caller pasted a whole
// document; otherwise leave undefined so buildHtml applies its "en" default.
// Getting this right matters for screen-reader pronunciation and for the
// hyphens:auto line-breaking, which follows the document language.
export function deriveLang(options, content) {
  if (options.lang) return options.lang;
  const src = options.html != null ? String(options.html) : String(content || "");
  const m = src.match(/<html\b[^>]*\blang\s*=\s*["']([a-zA-Z][a-zA-Z-]*)["']/i);
  return m ? m[1] : undefined;
}

export async function resolveContent(options) {
  if (options.html != null) return String(options.html);
  if (options.markdown != null) {
    return renderMarkdown(options.markdown, {
      mathpix: options.mathpix,
      deps: options.deps,
      mathMode: options.mathMode,
      mathpixOptions: options.mathpixOptions,
    });
  }
  throw new Error("build: provide either { html } or { markdown }");
}

// Pick an image resolver: explicit > browser default (only in a real browser).
// In node we never auto-fetch (keeps builds deterministic); callers opt in.
function pickImageResolver(options) {
  if (options.imageResolver) return options.imageResolver;
  if (typeof window !== "undefined" && typeof fetch !== "undefined") return createBrowserImageResolver();
  return null;
}

/**
 * @returns {Promise<{ html: string, metadata: object }>}
 */
export async function buildDocument(options = {}) {
  const features = { ...DEFAULT_FEATURES, ...(options.features || {}) };

  let content = await resolveContent(options);

  if (features.imageBase64) {
    const resolver = pickImageResolver(options);
    if (resolver) {
      const result = await embedImages(content, resolver);
      content = result.html;
      // Surface images that could NOT be embedded (a resolver returning null —
      // most often a cross-origin fetch blocked by CORS). Without this the miss
      // is silent and the "standalone" output keeps an external <img src>.
      if (options.onImageSkip && result.skipped.length) {
        for (const src of result.skipped) options.onImageSkip(src);
      }
    }
  }

  const metadata = deriveMetadata(content, options.metadata || {});

  // Whether the CALLER gave us a real title — which is not the same question as
  // "is metadata.title set", because deriveMetadata() has already applied the
  // "Accessible Document" placeholder by the time we get here.
  //
  // ensureH1's guard in html-assembler.js reads `options.title || options.metadata?.title`
  // and refuses to stamp the placeholder as an <h1>. That reasoning is right, but
  // the guard only ever saw the DERIVED title on this path, so it could never fire:
  // buildHtml direct -> null (guard worked), buildDocument/exportDocument ->
  // "Accessible Document" (guard defeated). The unit test passed the whole time
  // because it exercised the one entry point nobody uses.
  //
  // `options.title` is deliberately NOT consulted here: build()/buildDocument()
  // pass only `options.metadata` to deriveMetadata, so a top-level `title` never
  // reaches the document title at all — gating on it would let the placeholder
  // straight back through.
  const callerSuppliedTitle = options.metadata?.title;

  // Build-time accessibility audit (non-blocking). Surfaces authoring gaps the
  // library cannot auto-fix — e.g. images shipped with no alt text (WCAG 1.1.1).
  const warnings = auditAccessibility(content, {
    warnMissingLongDescription: options.warnMissingLongDescription,
  });
  if (warnings.length) {
    if (options.onAccessibilityWarning) {
      for (const w of warnings) options.onAccessibilityWarning(w);
    }
    if (options.strictAccessibility) {
      throw new Error(
        `Accessibility audit found ${warnings.length} issue(s); first: ${warnings[0].message}`
      );
    }
  }

  // Resolved once and returned, not just handed to buildHtml: build() needs it
  // for the SCORM LOM too. Without that, `build({ lang: "cy" })` produced
  // <html lang="cy"> alongside a LOM claiming <language>en</language>.
  const lang = deriveLang(options, content);

  const html = buildHtml({
    content,
    title: metadata.title,
    metadata,          // author/date/description for the contentinfo footer
    footer: options.footer, // optional caller-supplied footer markup (overrides metadata)
    features,
    mathjaxMode: options.mathjaxMode,
    sidebar: options.sidebar,
    lang,
    scormConfig: options.scormConfig,
    scriptContext: options.scriptContext, // UI-script template overrides (e.g. quiz reporting)
    headExtra: options.head,   // author <style>/<link>/<script> for <head>
    bodyEnd: options.bodyEnd,  // author scripts appended at end-of-<body>
    // true = inject an <h1> when content has none AND the caller gave a real title
    ensureH1: options.ensureH1 === true && Boolean(callerSuppliedTitle),
    processHeadings: options.processHeadings,      // false = skip id/outline pass
    processTables: options.processTables,          // false = skip accessible-table markup
    tableColumnThreshold: options.tableColumnThreshold, // card/scroll cutoff
    processLongDescriptions: options.processLongDescriptions, // false = skip <details> pass
    longDescriptionLabel: options.longDescriptionLabel,       // <summary> text
    onLongDescriptionWarning: options.onLongDescriptionWarning, // orphan-block callback
    onQuizWarning: options.onQuizWarning, // skipped/soft quiz-authoring callback
  });

  return { html, metadata, warnings, lang };
}

/**
 * @returns {Promise<{ data, filename, entries, mediaType, metadata, html, warnings }>}
 */
export async function build(options = {}) {
  // Quiz score reporting is a SCORM-only capability: only the LMS package can
  // talk to a gradebook. Activating it here (and never in the standalone HTML
  // builders) keeps the same quiz runtime inert-by-default for html exports.
  const scorm = options.scorm || {};
  const reportScore = scorm.reportScore === true;
  const masteryScore = Number.isFinite(scorm.masteryScore) ? scorm.masteryScore : 60;
  const maxScore = Number.isFinite(scorm.maxScore) ? scorm.maxScore : 100;

  const scriptContext = reportScore
    ? { ...options.scriptContext, quizReportScore: true, quizMasteryScore: masteryScore }
    : options.scriptContext;

  // Companion files live in the SCORM zip, not in the HTML — so the in-page Save
  // button (which downloads a standalone copy of just the HTML) would produce a
  // broken file missing those assets. Force the save feature off when bundling.
  const hasAssets = options.assets && Object.keys(options.assets).length > 0;
  const docOptions = {
    ...options,
    scriptContext,
    ...(hasAssets ? { features: { ...options.features, save: false } } : {}),
  };

  const { html, metadata, warnings, lang } = await buildDocument(docOptions);

  // The rendered markup carries a data-quiz-question-root per question; use it to
  // tell the SCORM layer a scored quiz is present so the API wrapper stops
  // hard-coding "passed" and the manifest/README switch to scoring instructions.
  const quizPresent = /data-quiz-question-root=/.test(html);

  const pkg = await buildPackage(html, metadata, {
    deps: options.deps,
    config: options.scormConfig,
    mathjaxMode: options.mathjaxMode,
    mathjaxAssets: options.mathjaxAssets,
    assets: options.assets,   // companion files bundled + declared in the SCORM zip
    identifier: options.identifier,
    epochMs: options.epochMs,
    isoDate: options.isoDate,
    lang,                     // so the LOM states the document's real language
    onMetadataWarning: options.onMetadataWarning, // dropped/invalid LOM input
    // mathjaxMode 'local' + chemistry + no mhchem.js bundled = no maths at all
    onMathjaxAssetWarning: options.onMathjaxAssetWarning,
    outputType: options.outputType,
    // Quiz scoring wiring (inert unless reportScore + a quiz is present).
    quizPresent,
    reportScore,
    masteryScore,
    maxScore,
  });

  return { ...pkg, metadata, html, warnings };
}
