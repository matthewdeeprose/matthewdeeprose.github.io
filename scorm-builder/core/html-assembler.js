// Assemble a complete self-contained HTML document: <head> with all CSS and
// embedded fonts, <body> with the canonical shell wrapping the content. This is
// the pandoc-free counterpart of export-manager.js generateEnhancedStandaloneHTML.
//
// Feature-specific wiring (theme JS, reading tools, MathJax config, save, etc.)
// is layered in by later phases via the headExtra / bodyScripts hooks.

import { allCss } from "../assets/index.js";
import { renderEmbeddedFonts } from "../generators/embedded-fonts.js";
import { buildFeatureScripts, cssFilterFor } from "../generators/script-orchestrator.js";
import { assembleBodyShell, renderSidebar, renderEmptyToc, renderDistractionFreeControls, renderFooter } from "./document-shell.js";
import { DEFAULT_FEATURES } from "./defaults.js";
import { escapeXML } from "../util/escape-xml.js";
import { encodeBase64Utf8 } from "../util/base64.js";
import { processHeadings } from "../enhancers/headings.js";
import { processTables } from "../enhancers/enhance-tables.js";
import { processLongDescriptions, findLongDescriptionRanges } from "../enhancers/long-descriptions.js";
import { processQuiz, hasQuizBlock } from "../enhancers/quiz.js";
import { processMathpixFigures, hasMathpixFigure } from "../enhancers/mathpix-figures.js";
import { processYoutubeEmbeds, hasYoutubeIframe } from "../enhancers/youtube-embed.js";
import { renderToc } from "../enhancers/toc-generator.js";
import { renderMathJaxHead } from "../generators/mathjax-config.js";

// The in-page save button reads the clean document back out of this element and
// downloads it, so a saved copy is the pristine source (raw maths delimiters +
// MathJax loader) rather than a serialised, already-typeset DOM whose glyphs go
// blank once MathJax's runtime stylesheet is stripped. See document-save-functionality.js.
const SAVE_EMBED_EMPTY =
  '<script type="application/octet-stream" id="original-content-data"></script>';

/**
 * @param {object} options
 * @param {string} options.content - inner HTML for #main (already rendered)
 * @param {string} [options.title]
 * @param {string} [options.lang="en"]
 * @param {object} [options.features]
 * @param {boolean} [options.ensureH1=false] - inject an <h1> from the title when the
 *   content has none (kept out of the TOC; see below)
 * @param {object} [options.sidebar] - sidebar context overrides
 * @param {string} [options.toc] - TOC markup (defaults to an empty #toc)
 * @param {string} [options.headExtra=""] - extra <head> markup (author <style>/<link>/<script>, MathJax config, etc.)
 * @param {string} [options.bodyScripts] - REPLACES the default feature scripts (internal use).
 * @param {string} [options.bodyEnd=""] - extra end-of-<body> markup APPENDED after the feature scripts (author scripts).
 * @returns {string} complete HTML document
 */
export function buildHtml(options = {}) {
  const features = { ...DEFAULT_FEATURES, ...(options.features || {}) };
  const lang = options.lang || "en";
  const title = options.title || "Accessible Document";

  // Ensure headings carry stable ids and derive the outline, so the TOC links
  // and their in-content targets always agree. Opt out with processHeadings:false.
  let content = options.content || "";
  let sections = options.sections || [];

  // Convert authored YouTube <iframe> embeds into the lightweight, keyboard-accessible
  // <lite-youtube> element. Gated on the liteYoutube feature (which also injects the
  // component's script + CSS) and a cheap probe; opt out with processYoutubeEmbeds:false.
  if (features.liteYoutube && options.processYoutubeEmbeds !== false && hasYoutubeIframe(content)) {
    content = processYoutubeEmbeds(content);
  }

  // Render any inline quiz-question blocks to accessible HTML BEFORE headings,
  // so the question markup (and any heading the renderer emits) gets stable ids
  // and enters the outline/TOC like the rest of the content. Gated on the quiz
  // feature and a cheap probe so non-quiz builds pay nothing.
  if (features.quiz && hasQuizBlock(content)) {
    content = processQuiz(content, { onWarning: options.onQuizWarning }).html;
  }

  // Normalise mathpix's figure markup (div.table / div.figure_img /
  // div.caption_figure) into semantic <figure> / <figcaption>. Runs BEFORE
  // long-descriptions so a disclosure attaches to a real <figure>, and before
  // tables — it deliberately never touches a real table wrapper. Opt out with
  // processMathpixFigures:false or features.mathpixFigures:false.
  if (features.mathpixFigures !== false && options.processMathpixFigures !== false && hasMathpixFigure(content)) {
    content = processMathpixFigures(content, { onWarning: options.onMathpixFigureWarning }).html;
  }

  // Turn authored <div class="longdesc"> blocks into <details> disclosures below
  // their image, wiring the img with aria-details. Runs BEFORE headings so the
  // outline pass can exclude long-description headings, and before tables so a
  // <table> inside a long description still gets the accessible/responsive markup.
  if (features.imageLongDescriptions && options.processLongDescriptions !== false) {
    content = processLongDescriptions(content, {
      summaryLabel: options.longDescriptionLabel,
      onWarning: options.onLongDescriptionWarning,
    }).html;
  }

  // Give the document a visible top-level heading when its content has none.
  //
  // Content converted from LaTeX-flavoured markdown starts at <h2> (mathpix
  // renders \section*{} as <h2>), so the document's title exists ONLY in <title>:
  // a screen-reader user navigating by heading finds no title at all, and the
  // outline starts at h2 with nothing above it. Opt-in (`ensureH1`) because it
  // adds content the author did not write; never injected when the content
  // already has an <h1>, and never when no real title is known (stamping the
  // internal "Accessible Document" placeholder into the page would be worse than
  // the gap it fills). The title is untrusted text, so it is escaped.
  //
  // Injected BEFORE processHeadings so it gets a stable id like any other
  // heading — it is a real anchor target — but it is excluded from the outline;
  // see the excludeRanges note below.
  let injectedH1 = null;
  const h1Text = options.title || options.metadata?.title;
  if (options.ensureH1 && h1Text && !/<h1\b/i.test(content)) {
    injectedH1 = `<h1>${escapeXML(h1Text)}</h1>\n`;
    content = injectedH1 + content;
  }

  if (options.processHeadings !== false) {
    // Keep headings inside long descriptions anchorable but out of the TOC, and
    // likewise an INJECTED h1: it is derived from metadata.title, which is already
    // the <title> (browser tab + LMS entry), so listing it in the document's own
    // TOC is a third repetition of the same string. An author's own <h1> is
    // content they wrote and chose to place, and still appears in the TOC.
    const excludeRanges = injectedH1 ? [[0, injectedH1.length]] : [];
    if (features.imageLongDescriptions && options.processLongDescriptions !== false) {
      excludeRanges.push(...findLongDescriptionRanges(content));
    }
    const processed = processHeadings(content, { excludeRanges });
    content = processed.html;
    sections = processed.sections;
  }

  // Bake accessible/responsive table markup (data-label, ARIA roles, scroll
  // region) so tables render correctly with no runtime JS. Opt out with
  // processTables:false; tune the card/scroll cutoff with tableColumnThreshold.
  if (options.processTables !== false) {
    content = processTables(content, { columnThreshold: options.tableColumnThreshold });
  }

  // Constrain the document content to an inner reading column so the
  // reading-width control can govern line length. #main is a grid item whose
  // width is fixed by the layout track, so max-width on it has no effect; an
  // inner block reliably honours max-width (driven by --reading-width).
  content = `<div class="reading-column">\n${content}\n</div>`;

  // Prepend focus-mode controls (after heading processing so they never enter
  // the TOC, and outside the reading column so they stay full width). The
  // distraction-free-manager script binds to their button ids.
  if (features.distractionFree) {
    content = renderDistractionFreeControls() + "\n" + content;
  }

  const toc =
    options.toc !== undefined ? options.toc : sections.length ? renderToc(sections) : renderEmptyToc();

  // MathJax (config + loader) is included whenever maths controls are enabled.
  // The maths sidebar section — and with it the #math-explorer checkbox — is part
  // of the shell whenever MathJax is shipped, so any such export can reach the
  // adaptive-CSS wipe described in generators/mathjax-config.js (L10). Tell the
  // config generator, so it turns adaptiveCSS off for exactly those documents.
  const mathHead = features.mathjaxControls
    ? renderMathJaxHead({
        mathjaxMode: options.mathjaxMode,
        config: options.scormConfig,
        explorerControl: true,
      })
    : "";
  const headExtra = (options.headExtra || "") + mathHead;
  // Author `bodyEnd` markup is APPENDED after the feature scripts so it never
  // clobbers theme/reading-tools/save wiring; `bodyScripts` (internal) replaces.
  const bodyScripts =
    (options.bodyScripts !== undefined
      ? options.bodyScripts
      : buildFeatureScripts(features, options.scriptContext)) + (options.bodyEnd || "");

  const sidebar = renderSidebar({ sidebar: options.sidebar, features });
  // Optional contentinfo footer (author/date/description or caller-supplied
  // markup). renderFooter returns "" when there is nothing to show.
  const meta = options.metadata || {};
  const footer = features.footer
    ? renderFooter({
        author: meta.author,
        date: meta.date,
        description: meta.description,
        custom: options.footer,
      })
    : "";
  const shell = assembleBodyShell({ content, toc, sidebar, footer });
  const fontsStyle = features.fonts ? renderEmbeddedFonts() : "";

  // When the save feature is on, leave an (empty) self-reference placeholder in the
  // body; we fill it below with the base64 of the whole document.
  const saveEmbed = features.save ? "\n" + SAVE_EMBED_EMPTY : "";

  const doc = `<!DOCTYPE html>
<html lang="${escapeXML(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeXML(title)}</title>
<style>
${allCss(cssFilterFor(features))}
</style>
${fontsStyle}
${headExtra}
</head>
<body>
${shell}
${bodyScripts}${saveEmbed}
</body>
</html>`;

  if (!features.save) return doc;

  // Base64 the document *with the empty placeholder*, then fill the placeholder.
  // The save script decodes this back to the empty-placeholder document and
  // re-injects the same base64, so a saved copy reproduces this file exactly
  // (constant size, always renders, always re-savable).
  const encoded = encodeBase64Utf8(doc);
  const filled = SAVE_EMBED_EMPTY.replace("></script>", `>${encoded}</script>`);
  return doc.replace(SAVE_EMBED_EMPTY, filled);
}
