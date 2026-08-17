// Markdown -> HTML via mathpix-markdown-it. The renderer is an INJECTED
// dependency so the library stays dependency-free and host-agnostic:
//   - opts.mathpix: a markdownToHTML(text, options) function, or the module
//     object exposing markdownToHTML (e.g. the mathpix-markdown-it CDN global).
//   - falls back to globalThis.markdownToHTML / window.markdownToHTML.
//
// Mathpix emits plain HTML, which enters the build pipeline at exactly the same
// seam as pre-rendered { html }. How the MATHS inside it is emitted is governed
// by `mathMode` below — the choice matters for accessibility, so it is explicit.

// How mathematics leaves the markdown renderer.
//
//   "tex"          mathpix leaves the TeX alone ($…$, $$…$$, \(…\), \[…\]) and the
//                  exported document's own MathJax typesets it. That is what gives
//                  us assistive MathML, ClearSpeak speech, the MathJax menu, zoom,
//                  and working Read Aloud — i.e. every reason `mathjaxControls`
//                  exists. Also ~85% smaller output.
//   "prerendered"  mathpix pre-renders each equation to <mjx-container><svg
//                  role="img"> with no aria-label, no MathML and no speech text.
//                  The document's MathJax then finds nothing to typeset. Kept only
//                  for callers who deliberately want mathpix's own SVG.
//
// `output_format` OVERRIDES include_svg / include_mathml / include_latex rather
// than combining with them, so a mode is a single-key preset.
export const MATH_MODES = {
  tex: { outMath: { output_format: "latex" } },
  prerendered: {},
};

export const DEFAULT_MATH_MODE = "tex";

// Sensible defaults: keep section structure and allow inline HTML.
//
// `mathDelimiterMode` is stated rather than inherited on purpose. mathpix 3.x
// defaults it to 'strict' while 2.x behaves as 'legacy', so without this line the
// same markdown renders differently depending on which version the host happened
// to supply — silently, since under 'strict' a `\\(x^2\\)` degrades to the literal
// text `\(x^2\)` instead of maths. 'legacy' accepts everything 'strict' does plus
// the double-backslash form, so it cannot break existing content.
export const DEFAULT_MATHPIX_OPTIONS = {
  htmlTags: true,
  width: 0,
  mathDelimiterMode: "legacy",
};

function resolveRenderer(opts) {
  const candidate =
    opts.mathpix ||
    opts.deps?.mathpix ||
    (typeof globalThis !== "undefined" ? globalThis.markdownToHTML : undefined) ||
    (typeof globalThis !== "undefined" && globalThis.window ? globalThis.window.markdownToHTML : undefined);

  if (typeof candidate === "function") return candidate;
  if (candidate && typeof candidate.markdownToHTML === "function") {
    return candidate.markdownToHTML.bind(candidate);
  }
  throw new Error(
    "renderMarkdown: no mathpix-markdown-it renderer found. Pass opts.mathpix (a markdownToHTML function or the module), or expose window.markdownToHTML."
  );
}

/**
 * Build the options object actually handed to mathpix.
 * Merge order: library defaults -> mathMode preset -> caller's mathpixOptions,
 * so an explicit `mathpixOptions.outMath` always wins over the mode.
 *
 * @param {object} [opts] - { mathMode, mathpixOptions }
 * @returns {object}
 */
export function resolveMathpixOptions(opts = {}) {
  const mode = opts.mathMode == null ? DEFAULT_MATH_MODE : opts.mathMode;
  if (!Object.prototype.hasOwnProperty.call(MATH_MODES, mode)) {
    throw new Error(
      `renderMarkdown: unknown mathMode "${mode}". Use one of: ${Object.keys(MATH_MODES).join(", ")}.`
    );
  }
  return { ...DEFAULT_MATHPIX_OPTIONS, ...MATH_MODES[mode], ...(opts.mathpixOptions || {}) };
}

/**
 * @param {string} markdown
 * @param {object} [opts] - { mathpix, deps:{mathpix}, mathMode, mathpixOptions }
 * @returns {Promise<string>} rendered HTML
 */
export async function renderMarkdown(markdown, opts = {}) {
  const options = resolveMathpixOptions(opts);
  const renderer = resolveRenderer(opts);
  return renderer(String(markdown), options);
}
