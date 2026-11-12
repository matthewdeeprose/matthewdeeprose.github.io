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

  // The class tools.html lists in MathJax's `ignoreHtmlClass`, so a span carrying
  // it is skipped by the typesetter.
  const MATHJAX_IGNORE_CLASS = "mathjax-ignore";
  const PRICE_MARKER_SPAN =
    '<span class="' + MATHJAX_IGNORE_CLASS + '">$</span>';

  /**
   * Run `text.replace(re, fn)` only OUTSIDE fenced code blocks and inline code
   * spans (register 62: maths delimiters inside code must never be stashed).
   * A fence is ``` or ~~~ (up to three spaces of indent) closed by a fence of
   * the same character and at least the same length; an unclosed fence runs to
   * the end. An inline span is a backtick run closed by the next run of the same
   * length; an unclosed run is literal text. Indented (four-space) code blocks
   * are not covered.
   *
   * @param {string} text - Raw markdown.
   * @param {RegExp} re - Pattern passed to String.prototype.replace.
   * @param {Function|string} fn - Replacer passed to String.prototype.replace.
   * @returns {string} `text` with the replacement applied outside code only.
   */
  function outsideCode(text, re, fn) {
    const n = text.length;
    const segs = [];
    let plain = 0;
    let i = 0;

    function codeSeg(a, b) {
      segs.push([plain, a, false]);
      segs.push([a, b, true]);
      plain = b;
    }

    while (i < n) {
      if (i === 0 || text.charAt(i - 1) === "\n") {
        const eol = text.indexOf("\n", i);
        const firstLine = text.slice(i, eol < 0 ? n : eol);
        const fm = /^ {0,3}(`{3,}|~{3,})/.exec(firstLine);
        if (
          fm &&
          !(
            fm[1].charAt(0) === "`" &&
            firstLine.slice(fm[0].length).indexOf("`") >= 0
          )
        ) {
          const ch = fm[1].charAt(0);
          const close = new RegExp(
            "^ {0,3}" + (ch === "`" ? "`" : "~") + "{" + fm[1].length + ",}[ \\t]*$",
          );
          let end = n;
          let j = eol < 0 ? n : eol + 1;
          while (j < n) {
            const e2 = text.indexOf("\n", j);
            const lineEnd = e2 < 0 ? n : e2;
            if (close.test(text.slice(j, lineEnd))) {
              end = lineEnd;
              break;
            }
            j = lineEnd + 1;
          }
          codeSeg(i, end);
          i = end;
          continue;
        }
      }
      if (text.charAt(i) === "`") {
        let k = i;
        while (k < n && text.charAt(k) === "`") k++;
        const runLen = k - i;
        let s = k;
        let found = -1;
        while (s < n) {
          const b = text.indexOf("`", s);
          if (b < 0) break;
          let e = b;
          while (e < n && text.charAt(e) === "`") e++;
          if (e - b === runLen) {
            found = e;
            break;
          }
          s = e;
        }
        if (found > 0) {
          codeSeg(i, found);
          i = found;
          continue;
        }
        i = k;
        continue;
      }
      i++;
    }
    segs.push([plain, n, false]);

    let out = "";
    for (let q = 0; q < segs.length; q++) {
      const part = text.slice(segs[q][0], segs[q][1]);
      out += segs[q][2] ? part : part.replace(re, fn);
    }
    return out;
  }

  /**
   * Mark every `$` that is NOT part of a maths pair so MathJax leaves prices
   * alone (register 61: "$5 and $10" was paired as an equation and read as
   * maths). Called on RENDERED HTML, before placeholders are restored.
   *
   * Over text outside tags and outside <code>/<pre>: a `$` pair the pandoc rule
   * accepts (opening `$` then a non-space; closing `$` after a non-space and not
   * followed by a digit; no `$` between) is left alone. Every other `$` becomes
   * a `mathjax-ignore` span. A run of text is broken by any tag except <br> (read
   * as a newline) and an HTML comment (a placeholder, read as one opaque
   * character), which is how MathJax's own string-builder treats them.
   *
   * @param {string} html - Rendered HTML.
   * @returns {string} The HTML with unpaired dollar signs wrapped.
   */
  function markPrices(html) {
    if (typeof html !== "string" || html.indexOf("$") < 0) return html;

    const PAIR = /\$([^\s$](?:[^$]*[^\s$])?)\$(?!\d)/g;
    const toks = html.match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+|</g) || [];
    const out = toks.slice();
    let skip = 0;
    let run = [];

    function isTag(t) {
      return t.length > 1 && t.charAt(0) === "<";
    }

    function flush() {
      if (!run.length) return;
      let s = "";
      const starts = [];
      for (let r = 0; r < run.length; r++) {
        const t = toks[run[r]];
        starts.push(s.length);
        if (isTag(t)) s += t.slice(0, 4) === "<!--" ? "\u0001" : "\n";
        else s += t;
      }
      const keep = {};
      PAIR.lastIndex = 0;
      let m;
      while ((m = PAIR.exec(s))) {
        keep[m.index] = true;
        keep[m.index + m[0].length - 1] = true;
      }
      for (let r2 = 0; r2 < run.length; r2++) {
        const t2 = toks[run[r2]];
        if (isTag(t2) || t2.indexOf("$") < 0) continue;
        let built = "";
        for (let c = 0; c < t2.length; c++) {
          const ch = t2.charAt(c);
          built += ch === "$" && !keep[starts[r2] + c] ? PRICE_MARKER_SPAN : ch;
        }
        out[run[r2]] = built;
      }
      run = [];
    }

    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (isTag(t)) {
        if (/^<(code|pre)\b/i.test(t)) {
          flush();
          skip++;
          continue;
        }
        if (/^<\/(code|pre)\s*>/i.test(t)) {
          flush();
          if (skip > 0) skip--;
          continue;
        }
        if (skip > 0) continue;
        if (t.slice(0, 4) === "<!--" || /^<br\s*\/?>$/i.test(t)) {
          run.push(i);
          continue;
        }
        flush();
        continue;
      }
      if (skip > 0) continue;
      run.push(i);
    }
    flush();
    return out.join("");
  }

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

    // Nothing inside code is stashed (register 62).
    let result = outsideCode(text, MATH_PATTERNS.DISPLAY_BRACKET, stash);
    result = outsideCode(result, MATH_PATTERNS.DISPLAY_DOLLAR, stash);
    result = outsideCode(result, MATH_PATTERNS.INLINE_PAREN, stash);
    result = outsideCode(
      result,
      MATH_PATTERNS.INLINE_DOLLAR,
      function (match, inner) {
        const stripped = inner.replace(TEXT_COMMAND, "");
        if (PROSE_WORD_RUN.test(stripped)) {
          return match; // prose, not maths — leave it for markdown-it
        }
        return stash(match);
      },
    );

    /**
     * Put the stashed LaTeX back into rendered HTML.
     *
     * `<` and `>` are escaped on the way back in, so the browser cannot parse
     * something like `\(a<b\)` as the start of a tag. MathJax reads decoded text
     * nodes, so it still sees the correct characters.
     */
    function restore(html) {
      let out = markPrices(html);
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
    outsideCode: outsideCode,
    markPrices: markPrices,
  };

  logInfo("window.MathProtect ready (protect, outsideCode, markPrices)");
})();
