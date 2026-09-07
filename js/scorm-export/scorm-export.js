/**
 * @fileoverview SCORM/HTML export facade for mp-73.
 * @module scorm-export
 * @requires ../../scorm-builder/index.js
 * @version 0.1.0
 * @since 0.1.0
 *
 * @description
 * A thin integration seam between mp-73's content-producing tools (Markdown
 * Editor, MathPix MMD editor, OpenRouter results, quiz JSON) and the vendored
 * `scorm-builder` library. It wraps the library's unified `exportDocument`
 * facade so every caller in mp-73 exports through one small, testable surface.
 *
 * Design notes:
 *   - **No hand-editing of the vendored folder.** This module lives OUTSIDE
 *     `scorm-builder/` (in `js/scorm-export/`) so re-vendoring the library never
 *     clobbers it — see docs/integration-plan-mp73.md, Phase 1.
 *   - **Dependency injection.** The library takes `JSZip` (for `.zip` targets)
 *     and `mathpix` (mathpix-markdown-it, for Markdown input) as injected deps.
 *     mp-73 already exposes mathpix-markdown-it as the `window.markdownToHTML`
 *     global and can auto-load JSZip from CDN, so we gather whatever globals are
 *     present at call time and let the library's `autoDeps` fill any gap. No new
 *     runtime npm dependency is introduced.
 *   - **Node-importable.** All browser-only work (globals, download) is guarded,
 *     so this module can be unit-tested headlessly under node.
 *
 * @example
 *   import { exportContent } from "./js/scorm-export/scorm-export.js";
 *   // Markdown Editor rendered HTML -> SCORM zip, triggers a download:
 *   await exportContent({ content: outputEl.innerHTML, format: "html",
 *                         target: "scorm", title: "My lesson" });
 */

import {
  exportDocument,
  setDefaults,
  download,
  ensureDependencies,
} from "../../scorm-builder/index.js";
import {
  parseQuizJson,
  quizContentFromQuestions,
} from "../../scorm-builder/render/quiz-from-json.js";

// --- logging (mirrors mp-73's module-scope logging convention) ----------------
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const CURRENT_LOG_LEVEL = LOG_LEVELS.WARN;
const shouldLog = (level) => LOG_LEVELS[level] <= CURRENT_LOG_LEVEL;
const logError = (...a) => shouldLog("ERROR") && console.error("[scorm-export]", ...a);
const logWarn = (...a) => shouldLog("WARN") && console.warn("[scorm-export]", ...a);
const logInfo = (...a) => shouldLog("INFO") && console.info("[scorm-export]", ...a);

/** Output targets the library understands, mapped to friendly labels. */
export const EXPORT_TARGETS = Object.freeze({
  scorm: "SCORM 2004 package (.zip) for an LMS",
  html: "Standalone accessible HTML (single file)",
  "html-offline": "Offline HTML bundle (.zip, MathJax included)",
});

/** Input formats this facade accepts. */
export const INPUT_FORMATS = Object.freeze(["html", "markdown", "json"]);

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

// --- honest completion status -------------------------------------------------
// The library's generated scorm-api.js asserts, on exit, that a content-only
// package was PASSED:
//
//     api.SetValue("cmi.completion_status", "completed");
//     api.SetValue("cmi.success_status", "passed");
//
// For a quiz that is correct. For a document it is a false statement in the LMS
// data model, and Blackboard renders it as "Submitted, not marked" — which tells
// a marker that work was handed in for assessment. Measured in Blackboard on
// 21 August 2026: two packages differing ONLY in that one line read "Submitted,
// not marked" and "Opened not saved" respectively.
//
// We do NOT hand-edit scorm-builder/ (vendored), and the library exposes no option
// for this, so the line is removed from the built package by rewriting that one
// zip entry. The completion line is deliberately KEPT: dropping both would leave
// the LMS with no record that the learner opened the document at all, and silence
// is a worse outcome than a wrong label.
const ZIP_TARGETS = new Set(["scorm", "html-offline"]);
const API_ENTRY = "scorm-api.js";
const PASS_ASSERTION = 'api.SetValue("cmi.success_status", "passed");';
const COMPLETION_ASSERTION = 'api.SetValue("cmi.completion_status", "completed");';
const HONEST_REPLACEMENT =
  "/* mp-73: success_status intentionally NOT asserted - this is a document, " +
  "not an assessment. Completion is still reported on the line above. */";

/**
 * Rewrites the built package's SCORM API wrapper so it no longer claims a pass.
 * Returns a NEW result object; the input is not mutated.
 *
 * Fails SOFT on anything unexpected — a warning and the original package — because
 * refusing to export a document over a data-model nicety is the wrong trade. It
 * fails HARD only if an edit it did make produced a package that is worse than the
 * one it started with.
 *
 * @param {{data: Blob|Uint8Array, filename?: string, mediaType?: string}} result
 * @returns {Promise<object>} the result, rewritten where possible
 */
async function stripFalsePassAssertion(result) {
  const { JSZip } = await ensureDependencies({ jszip: true });
  if (!JSZip) {
    logWarn("honestCompletionStatus: JSZip unavailable - package left unchanged.");
    return result;
  }

  // In Node the facade hands back a Blob, which JSZip cannot read directly.
  const input =
    result.data && typeof result.data.arrayBuffer === "function"
      ? new Uint8Array(await result.data.arrayBuffer())
      : result.data;

  const zip = await JSZip.loadAsync(input);
  const entry = zip.file(API_ENTRY);
  if (!entry) {
    // No SCORM wrapper in this target (e.g. html-offline). Nothing to correct.
    return result;
  }

  const before = await entry.async("string");
  const passCount = before.split(PASS_ASSERTION).length - 1;

  if (passCount === 0) {
    logWarn(
      "honestCompletionStatus: the pass assertion was not found - the library's " +
        "wrapper has changed shape. Package left unchanged; re-check api-wrapper.js."
    );
    return result;
  }
  if (passCount !== 1) {
    logWarn(
      "honestCompletionStatus: expected 1 pass assertion, found " +
        passCount +
        " - package left unchanged."
    );
    return result;
  }
  // Guard BEFORE editing: only remove the pass if the completion line is there to
  // carry the record. Without it the package would report nothing at all.
  if (before.indexOf(COMPLETION_ASSERTION) === -1) {
    logWarn(
      "honestCompletionStatus: no completion assertion to fall back on - " +
        "package left unchanged rather than silenced."
    );
    return result;
  }

  const after = before.split(PASS_ASSERTION).join(HONEST_REPLACEMENT);

  // Assert against the EDITED text, not against intent.
  if (after.indexOf(PASS_ASSERTION) !== -1) {
    throw new Error("honestCompletionStatus: the pass assertion survived the rewrite.");
  }
  if (after.indexOf(COMPLETION_ASSERTION) === -1) {
    throw new Error(
      "honestCompletionStatus: the rewrite removed the completion assertion - refusing " +
        "to emit a package that reports nothing."
    );
  }

  zip.file(API_ENTRY, after);
  const data = await zip.generateAsync({
    type: isBrowser() ? "blob" : "nodebuffer",
    compression: "DEFLATE",
    mimeType: result.mediaType || "application/zip",
  });

  logInfo("honestCompletionStatus: the false pass assertion was removed.");
  return { ...result, data };
}

let configured = false;

/**
 * Configure app-wide export defaults once. Safe to call repeatedly; later calls
 * merge over earlier ones (see the library's `setDefaults`). Callers rarely need
 * this — {@link exportContent} works with zero configuration — but a host can use
 * it to set a default author, licence footer, feature set, or to inject deps
 * explicitly for an air-gapped deployment.
 *
 * @param {object} [defaults] - any `exportDocument` option, e.g.
 *   `{ metadata:{author}, features:{...}, deps:{JSZip}, jszipUrl, mathpixUrl }`.
 * @returns {object} the merged defaults now in effect.
 */
export function configureScormExport(defaults = {}) {
  configured = true;
  return setDefaults(defaults);
}

// Gather injectable deps from whatever mp-73 has already loaded onto the global
// scope at the moment of export. Anything missing is left for the library's
// `autoDeps` to CDN-load (JSZip) or for its global fallback to find (mathpix).
function collectRuntimeDeps() {
  const deps = {};
  if (typeof globalThis !== "undefined") {
    if (globalThis.JSZip) deps.JSZip = globalThis.JSZip;
    // mathpix-markdown-it is exposed by mp-73 as window.markdownToHTML.
    if (globalThis.markdownToHTML) deps.mathpix = globalThis.markdownToHTML;
  }
  return deps;
}

// Turn quiz JSON (a bare questions array, or an object with title/intro/
// reportScore/masteryScore) into the content HTML + the SCORM reporting config
// the builder expects. Mirrors tools/build-sample-quiz.mjs in the library.
function buildQuizExport(content, { title, features, scorm }) {
  const model = parseQuizJson(content);
  const heading = title || model.title;
  const html = quizContentFromQuestions(model.questions, {
    heading,
    intro: model.intro,
  });
  const scormConfig = { ...scorm };
  if (typeof model.reportScore === "boolean" && scormConfig.reportScore === undefined) {
    scormConfig.reportScore = model.reportScore;
  }
  if (typeof model.masteryScore === "number" && scormConfig.masteryScore === undefined) {
    scormConfig.masteryScore = model.masteryScore;
  }
  return {
    html,
    title: title || model.title,
    features: { quiz: true, ...features },
    scorm: scormConfig,
  };
}

/**
 * Export content from an mp-73 tool to a SCORM package or standalone/offline HTML.
 *
 * @param {object} params
 * @param {string} params.content            - the source content (see `format`).
 * @param {"html"|"markdown"|"json"} [params.format="html"] - shape of `content`:
 *   `html` = pre-rendered HTML (Markdown Editor `#output`, OpenRouter results);
 *   `markdown` = Markdown/MMD source (MathPix editor), rendered via mathpix;
 *   `json` = quiz JSON (questions array or object), rendered via the quiz helpers.
 * @param {"scorm"|"html"|"html-offline"} [params.target="scorm"] - output kind.
 * @param {string} [params.title]            - document title / package name.
 * @param {object} [params.metadata]         - `{ author, description, date, ... }`.
 * @param {object} [params.features]         - feature toggles passed through.
 * @param {object} [params.scorm]            - SCORM config `{ reportScore, masteryScore, maxScore }`.
 * @param {boolean} [params.focusMode]       - open the exported document in focus
 *   mode (distraction-free: sidebar + TOC hidden, Escape/toggle restores). Omitted
 *   or falsy leaves the library default (off), so existing exports are unchanged.
 * @param {boolean} [params.honestCompletionStatus=false] - zip targets only. Removes
 *   the wrapper's exit-time `cmi.success_status = "passed"` claim, keeping the
 *   completion report. Use for DOCUMENTS; leave off for a scored quiz, where the
 *   pass is real. Defaults off, so every existing caller is byte-identical.
 * @param {boolean} [params.download=true]   - in a browser, trigger a file download.
 * @param {object} [params.options]          - escape hatch: extra `exportDocument` options.
 * @returns {Promise<{data, filename, mediaType, metadata, html, entries?}>}
 * @throws {Error} on unknown `format`/`target` or malformed quiz JSON (message is caller-facing).
 */
export async function exportContent({
  content,
  format = "html",
  target = "scorm",
  title,
  metadata,
  features,
  scorm,
  focusMode,
  honestCompletionStatus = false,
  download: doDownload = true,
  options = {},
} = {}) {
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("exportContent: no content to export — the source is empty.");
  }
  if (!(target in EXPORT_TARGETS)) {
    throw new Error(
      `exportContent: unknown target "${target}". Use one of: ${Object.keys(EXPORT_TARGETS).join(", ")}.`
    );
  }

  // lite-youtube is ALWAYS ON for mp-73 exports: any authored YouTube <iframe> is
  // auto-converted to the lighter, keyboard-accessible <lite-youtube> element. The
  // library flag defaults OFF, so we force it on here. `...features` comes last so
  // a caller can still explicitly override it. Applied to BOTH the base call and
  // the quiz path below, so the flag is never lost when buildQuizExport rebuilds
  // the features object.
  const effectiveFeatures = { liteYoutube: true, ...features };

  // Base options shared by every path. Deps are gathered fresh so a tool that
  // loaded mathpix/JSZip after configuration is still honoured.
  const base = {
    target,
    title,
    metadata,
    features: effectiveFeatures,
    scorm,
    // First-class focus-mode passthrough. Left undefined when the caller omits it,
    // so the facade's `focusMode != null` guard skips the scriptContext mapping and
    // the export is byte-identical to before. `...options` can still override.
    focusMode,
    deps: collectRuntimeDeps(),
    download: doDownload && isBrowser(),
    ...options,
  };

  let call;
  switch (format) {
    case "html":
      call = { ...base, html: content };
      break;
    case "markdown":
    case "mmd":
      call = { ...base, markdown: content };
      break;
    case "json":
    case "quiz-json": {
      const quiz = buildQuizExport(content, { title, features: effectiveFeatures, scorm });
      call = {
        ...base,
        html: quiz.html,
        title: quiz.title,
        features: quiz.features,
        scorm: quiz.scorm,
      };
      break;
    }
    default:
      throw new Error(
        `exportContent: unknown format "${format}". Use one of: ${INPUT_FORMATS.join(", ")}.`
      );
  }

  // When the package is going to be rewritten, the library must NOT download the
  // un-rewritten one first; we download the corrected package ourselves below.
  const rewriting = honestCompletionStatus && ZIP_TARGETS.has(target);
  const willDownload = doDownload && isBrowser();
  if (rewriting) call.download = false;

  logInfo(`exporting format=${format} target=${target} (deps: ${Object.keys(base.deps).join(", ") || "auto"})`);
  try {
    const result = await exportDocument(call);
    if (!rewriting) {
      logInfo(`export ok -> ${result.filename} (${result.mediaType})`);
      return result;
    }
    const corrected = await stripFalsePassAssertion(result);
    if (willDownload) download(corrected);
    logInfo(`export ok -> ${corrected.filename} (${corrected.mediaType})`);
    return corrected;
  } catch (err) {
    logError(`export failed (format=${format}, target=${target}):`, err && err.message);
    throw err;
  }
}

// Re-export the library's download helper so callers that already hold an export
// result (e.g. to offer several targets from one build) can trigger a download
// without importing the vendored path themselves.
export { download };

// Re-export the Ally statement export stylesheet + interactive disclosure script
// so the Ally caller gets exportContent AND both injectables from a single dynamic
// import() of this facade (CSS via `options.head`, the script via `options.bodyEnd`
// so it runs at end-of-body). See Part 2 / the interactive-disclosure parity work.
export { ALLY_STATEMENT_EXPORT_CSS } from "./ally-statement-export-css.js";
export { ALLY_STATEMENT_EXPORT_SCRIPT } from "./ally-statement-export-script.js";

// Re-export the Phase 3 statement-refresh embed (a stringified <script>) so the
// Ally caller gets it from the same dynamic import() and appends it verbatim at
// end-of-<body> via `options.bodyEnd` (flag-gated, Stage 7). GENERATED constant —
// regenerate with node js/scorm-export/_gen-ally-refresh-embed.mjs.
export { ALLY_STATEMENT_REFRESH_EMBED } from "./ally-refresh-embed-src.js";
