/**
 * MathJax configuration for content pages (pages that load markdown through
 * MarkdownPageLoader, currently ts26.html).
 *
 * Origin: the `tex`, `options`, `loader` and `chtml` blocks below are copied
 * VERBATIM from tools.html:24226-24367 (the "Simplified, robust MathJax
 * configuration"), so a content page typesets maths exactly as the Markdown
 * Editor does: \( \), \[ \], $…$ and $$…$$, with the SI unit macros.
 *
 * Left out on purpose: the `startup` block (tools.html:24287-24366). Its
 * pageReady() calls helpers that exist only on tools.html (showMathJaxLoading,
 * updateMathJaxStatusIndicator, showMathJaxError) and sets the
 * MathJaxEnhancementReady / MathJaxStartupClean flags that only tools.html
 * reads. This file uses MathJax's default startup instead.
 *
 * Load order: scorm-builder/source/templates/js/si-macros.js (sets
 * window.SI_UNIT_MACROS) first, then this file, then the MathJax CDN script.
 * If tools.html's configuration changes, change this copy too; the MRC-3
 * drift guard (.claude/measurements/mrc-3-loader/harness.mjs --drift)
 * compares the two live configurations.
 *
 * @author Matthew Deeprose
 * @version 1.0.0
 */

window.MathJax = {
  tex: {
    // The same SI unit macros an export's MathJax gets (RA-71), from the one shared table.
    macros: window.SI_UNIT_MACROS || {},
    inlineMath: [
      ["$", "$"],
      ["\\(", "\\)"],
    ],
    displayMath: [
      ["$$", "$$"],
      ["\\[", "\\]"],
    ],
    processEscapes: true,
    processEnvironments: true,
    // CORRECTED 7 September 2026. The old comment read "Minimal packages
    // - removed ams to prevent version errors". It is misleading: "[+]"
    // is the ADD-TO-DEFAULTS syntax, so this does NOT replace the package
    // list — the tex-mml-chtml component's defaults (ams, newcommand,
    // noundefined, autoload, configmacros) are all still loaded, and
    // \mathbb, \mathfrak, \xrightarrow and align environments all render.
    // Measured with a two-sided detector: undefined macros surface via
    // the noundefined extension as red mjx-mtext with an aria-label
    // starting "backslash ", NOT as mjx-merror — so a probe looking for
    // merror finds nothing and reads as a clean pass either way.
    packages: { "[+]": ["base"] },
    tags: "none", // Simplified tagging
  },
  options: {
    enableMenu: true,
    ignoreHtmlClass:
      "tex2jax_ignore|mathjax-ignore|language-markdown|code-block-wrapper|mmd-preview-content",
    processHtmlClass: "tex2jax_process|mathjax-process",
    skipHtmlTags: [
      "script",
      "noscript",
      "style",
      "textarea",
      "pre",
      "code",
      "annotation",
      "annotation-xml",
      "mathml",
      "mjx-assistive-mml",
    ],
    menuOptions: {
      settings: {
        zoom: "Click",
        zscale: "200%",
        assistiveMml: true, // ✅ ENABLED for screen reader accessibility
        explorer: true, // ✅ Phase 2 - Keyboard navigation through expressions
      },
    },
  },
  // Minimal loader - removed problematic extensions
  loader: {
    load: ["input/tex", "output/chtml"],
  },
  chtml: {
    scale: 1.1,
    displayAlign: "center",
  },
};
