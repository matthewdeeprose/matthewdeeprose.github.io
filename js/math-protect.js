/**
 * @file math-protect.js
 * @description Shared LaTeX-protection helper for markdown-it pipelines.
 *
 * Stashes maths behind HTML-comment placeholders BEFORE markdown-it runs, and
 * restores it afterwards. Two separate markdown-it behaviours destroy LaTeX and
 * both are cured here:
 *
 *   1. markdown-it's CORE backslash-escape rule. `(` and `)` are ASCII
 *      punctuation, so `\(` becomes `(` and `\)` becomes `)` — the MathJax
 *      inline delimiters are deleted before MathJax ever sees them. The same
 *      applies to `\[` and `\]` for display maths. This is a core rule, so
 *      removing plugins does not save you from it.
 *   2. markdown-it-sup / markdown-it-sub. `^2(n+1)^` in
 *      `\(\sum_{k=1}^n 4k^3 = n^2(n+1)^2\)` matches the superscript rule
 *      (no internal whitespace), producing `n<sup>2(n+1)</sup>2`.
 *
 * This is a plain IIFE script (NOT an ES module) deliberately: it carries no
 * dependencies and is loaded by a normal <script> tag early in tools.html, so
 * `window.MathProtect` is published before any consumer runs.
 *
 * PORTED FROM `openrouter-embed/openrouter-embed-core.js` `_protectMathExpressions`,
 * which is the most complete of the copies already in the tree. The three
 * local-model repair heuristics in that method (bare `[ \frac{...} ]`, bare
 * `( \rho )`, and the malformed multiline close) are deliberately NOT ported:
 * they exist because some local models omit backslashes, and they rewrite user
 * content on a guess. That is defensible for local-model output and is not
 * defensible for the shared markdown pipeline, which also carries ordinary
 * prose containing brackets.
 *
 * @module MathProtect
 */
(function () {
  "use strict";

  // Logging configuration
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[MathProtect]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[MathProtect]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[MathProtect]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[MathProtect]", message, ...args);
  }

  // An HTML comment is the placeholder shape because markdown-it passes comments
  // through untouched under `html: true`, and neither the typographer nor the
  // emphasis rules reach inside one — so the underscores in the token are safe.
  const PLACEHOLDER_PREFIX = "<!--MATH_PLACEHOLDER_";
  const PLACEHOLDER_SUFFIX = "-->";

  /**
   * The four delimiter pairs MathJax is configured for in tools.html.
   * ORDER MATTERS: the greedy/longer display forms must be stashed before the
   * inline forms, or `$$a$$` would be consumed as two empty `$...$` pairs.
   */
  const MATH_PATTERNS = Object.freeze({
    DISPLAY_BRACKET: /\\\[[\s\S]*?\\\]/g,
    DISPLAY_DOLLAR: /\$\$[\s\S]*?\$\$/g,
    INLINE_PAREN: /\\\(.*?\\\)/g,
    INLINE_DOLLAR: /\$(?!\d)([^\$\n]+?)\$/g,
  });

  /**
   * Rejects a `$...$` span that looks like prose rather than maths — three or
   * more consecutive space-separated words. Without this, a sentence such as
   * "it costs $50 and then $60 in total" has its middle stashed as an equation.
   * `\text{...}` content is stripped first, since prose inside \text is normal.
   */
  const PROSE_WORD_RUN = /[a-zA-Z]{2,}\s+[a-zA-Z]{2,}\s+[a-zA-Z]{2,}/;
  const TEXT_COMMAND = /\\text\s*\{[^}]*\}/g;

  /**
   * Protect LaTeX maths in `text` from markdown-it processing.
   *
   * @param {string} text - Raw markdown, before any markdown-it render.
   * @returns {{text: string, restore: function(string): string, count: number}}
   *   `text` is the markdown with each maths span replaced by a placeholder;
   *   `restore(html)` puts the original LaTeX back into rendered HTML;
   *   `count` is how many spans were stashed (0 is a legitimate result).
   */
  function protect(text) {
    if (typeof text !== "string") {
      logWarn("protect() called with a non-string; returning it unchanged");
      return { text: text, restore: identity, count: 0 };
    }

    const placeholders = [];

    function stash(match) {
      const key = PLACEHOLDER_PREFIX + placeholders.length + PLACEHOLDER_SUFFIX;
      placeholders.push({ key: key, value: match });
      return key;
    }

    let result = text.replace(MATH_PATTERNS.DISPLAY_BRACKET, stash);
    result = result.replace(MATH_PATTERNS.DISPLAY_DOLLAR, stash);
    result = result.replace(MATH_PATTERNS.INLINE_PAREN, stash);
    result = result.replace(MATH_PATTERNS.INLINE_DOLLAR, function (match, inner) {
      const stripped = inner.replace(TEXT_COMMAND, "");
      if (PROSE_WORD_RUN.test(stripped)) {
        return match; // prose, not maths — leave it for markdown-it
      }
      return stash(match);
    });

    /**
     * Put the stashed LaTeX back into rendered HTML.
     *
     * `<` and `>` are escaped on the way back in, so the browser cannot parse
     * something like `\(a<b\)` as the start of a tag. MathJax reads decoded text
     * nodes, so it still sees the correct characters.
     */
    function restore(html) {
      let out = html;
      for (let i = 0; i < placeholders.length; i++) {
        const safe = placeholders[i].value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        out = out.split(placeholders[i].key).join(safe);
      }
      return out;
    }

    logDebug("protected " + placeholders.length + " maths span(s)");
    return { text: result, restore: restore, count: placeholders.length };
  }

  function identity(html) {
    return html;
  }

  window.MathProtect = {
    protect: protect,
  };

  logInfo("window.MathProtect ready (protect)");
})();
