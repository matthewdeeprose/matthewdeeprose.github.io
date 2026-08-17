// scorm-builder — standalone accessible SCORM 2004 package builder.
//
// Public API (filled out across the phased build):
//   build({ html | markdown, title, metadata, features, mathjaxMode, scorm, deps }) -> Promise<Blob|Buffer>
//   buildHtml({ ... })  -> Promise<string>   (self-contained HTML, no zip)
//   buildPackage(html, metadata, opts) -> Promise<Blob|Buffer>  (zip a pre-built HTML string)
//
// The library ships as plain ESM and requires no build step to consume.
// JSZip and mathpix-markdown-it are injected dependencies (opts.deps) with
// window/global fallbacks, so the core stays dependency-free and testable.

export const VERSION = "0.0.0";

// SCORM packaging (phase 1).
export { buildPackage } from "./scorm/package-builder.js";
export { generateManifest } from "./scorm/manifest.js";
export {
  generateLom,
  normaliseLom,
  renderLomDocument,
  renderLomFragment,
  DEFAULT_LOM_KEYWORDS,
  LOM_VOCABULARIES,
  LOM_NAMESPACE,
} from "./scorm/lom.js";
export { generateApiWrapper } from "./scorm/api-wrapper.js";
export { generateReadme } from "./scorm/readme.js";
export { generateFilename, generateHtmlFilename } from "./scorm/filename.js";
export { prepareScormHtml } from "./scorm/prepare-scorm-html.js";
export { DEFAULT_SCORM_CONFIG, resolveConfig } from "./scorm/config.js";

// HTML assembly + document shell (phase 3).
export { buildHtml } from "./core/html-assembler.js";
export { renderSidebar, assembleBodyShell, renderEmptyToc } from "./core/document-shell.js";
export { render as renderTemplate } from "./generators/template-engine.js";
export { DEFAULT_FEATURES, buildSidebarContext } from "./core/defaults.js";

// Theme wiring + image embedding (phase 4).
export { buildFeatureScripts } from "./generators/script-orchestrator.js";
export {
  embedImages,
  createBrowserImageResolver,
  createMapImageResolver,
  dataUrlFromBytes,
} from "./enhancers/image-embedder.js";

// Reading tools + TOC + metadata (phase 5).
export { processHeadings } from "./enhancers/headings.js";
export { processTables } from "./enhancers/enhance-tables.js";
export { processYoutubeEmbeds, hasYoutubeIframe } from "./enhancers/youtube-embed.js";
export { processMathpixFigures, hasMathpixFigure } from "./enhancers/mathpix-figures.js";
export { renderToc } from "./enhancers/toc-generator.js";
export { deriveMetadata } from "./core/metadata-provider.js";

// MathJax config + a11y controls (phase 6).
export { renderMathJaxHead } from "./generators/mathjax-config.js";

// Top-level orchestrator + markdown input (phase 7).
export { build, buildDocument, resolveContent } from "./core/builder.js";
export { renderMarkdown } from "./render/render-markdown.js";

// Quiz authoring: questions JSON → content HTML (the inverse of processQuiz).
export { wrapQuestion, quizContentFromQuestions, parseQuizJson } from "./render/quiz-from-json.js";

// Distraction-free + save (phase 8).
export { renderDistractionFreeControls } from "./core/document-shell.js";

// Standalone HTML export (phase 9) — self-contained .html + offline .zip variant.
export { buildStandaloneHtml, buildStandalonePackage } from "./core/standalone.js";

// Integration kit — unified facade + app-wide defaults (env-agnostic).
export { exportDocument, setDefaults, getDefaults, resetDefaults } from "./core/export-facade.js";

// Integration kit — browser helpers (only touch window/document inside fns,
// so they are safe to import in node; call them only in a browser).
export { download } from "./browser/download.js";
export { ensureDependencies, loadScript, DEFAULT_JSZIP_URL, DEFAULT_MATHPIX_URL } from "./browser/ensure-deps.js";
export { attachExportButton } from "./browser/attach.js";
