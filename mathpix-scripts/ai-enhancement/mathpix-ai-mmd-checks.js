/**
 * @fileoverview MMD free structure checks — five mechanical checks on MathPix Markdown.
 * @module MathPixMMDChecks
 * @version 1.0.0
 * @since MathPix AI lane, parcel M-2
 *
 * Pure string parsing: no DOM, no network, no API calls. It returns findings for
 * a person to review and never fixes anything. It is adopted nowhere: no
 * <script> tag loads it and no caller exists (parcel M-2 builds it only).
 *
 * Definitions (each is deliberately narrow):
 *
 * 1. EMPTY_BRACE — an \overbrace or \underbrace that is a sign a symbol was dropped.
 *    Rule "empty-body": the body group is empty or whitespace only.
 *    Rule "no-label": the brace has a body but is not followed by a ^ or _ label.
 *    (MathPix wrote the review's fault as \overbrace{\substack{charge density}}:
 *    the label text sits in the body and nothing is under the brace.)
 *
 * 2. MATHS_HEADING — a heading that is an equation, not a title. Headings are a
 *    "#" line or \section, \subsection, \subsubsection (starred or not).
 *    Rule "maths-only": once maths spans are removed no letter or digit is left.
 *    Rule "starts-with-equation": the heading starts with a maths span that
 *    contains "=" (the review's heading also carries a prose note after the maths).
 *
 * 3. INTEGRAL_LIMITS — one document uses the same single-LETTER lower limit with
 *    two or more different single-letter upper limits (\int_{i}^{f} and
 *    \int_{i}^{t}). Digit lower limits are ignored. The occurrences that differ from
 *    the most common upper limit are reported (a tie reports the later ones).
 *
 * 4. STRAY_QUOTE — a line starting ">" outside code and outside display maths that
 *    is a run of one line. A run of two or more ">" lines reads as a quotation.
 *
 * 5. UNBALANCED — per paragraph (split on blank lines), outside code: unescaped "{"
 *    against "}", and the parity of unescaped single "$" and of "$$". \{ \} \$ are
 *    skipped, and \( \) \[ \] are skipped as escapes.
 */
(function () {
  "use strict";

  // ==========================================================================
  // LOGGING CONFIGURATION
  // ==========================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

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
      console.error(`[MMDChecks] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[MMDChecks] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[MMDChecks] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[MMDChecks] ${message}`, ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  const CHECKS = Object.freeze({
    EMPTY_BRACE: "1-empty-brace",
    MATHS_HEADING: "2-maths-heading",
    INTEGRAL_LIMITS: "3-integral-limits",
    STRAY_QUOTE: "4-stray-quote",
    UNBALANCED: "5-unbalanced",
  });

  const EXCERPT_LENGTH = 120;

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /** Replace every character except newlines with a space, keeping offsets. */
  function blank(segment) {
    return segment.replace(/[^\n]/g, " ");
  }

  /** Blank fenced and inline code so line numbers and offsets stay valid. */
  function stripCode(text) {
    return text
      .replace(/```[\s\S]*?```/g, blank)
      .replace(/`[^`\n]*`/g, blank);
  }

  /** 1-based line number of a character offset. */
  function lineAt(text, offset) {
    let line = 1;
    for (let i = 0; i < offset && i < text.length; i++) {
      if (text.charCodeAt(i) === 10) line++;
    }
    return line;
  }

  /** The trimmed, shortened text of a 1-based line of the ORIGINAL text. */
  function excerptOfLine(lines, lineNumber) {
    const raw = (lines[lineNumber - 1] || "").replace(/\r$/, "").trim();
    return raw.length > EXCERPT_LENGTH ? raw.slice(0, EXCERPT_LENGTH) : raw;
  }

  /** Index of the "}" matching the "{" at openIndex, or -1. Skips escapes. */
  function matchGroup(text, openIndex) {
    let depth = 0;
    for (let i = openIndex; i < text.length; i++) {
      const c = text[i];
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /** Maths spans as { start, end, inner, display } over (code-stripped) text. */
  function findMathSpans(text) {
    // Mask \$ so a literal dollar cannot open a span.
    const masked = text.replace(/\\\$/g, "  ");
    const spans = [];
    const pattern =
      /\$\$([\s\S]*?)\$\$|\$((?:\\.|[^$\\])+)\$|\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;
    let m;
    while ((m = pattern.exec(masked)) !== null) {
      const inner = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
      spans.push({
        start: m.index,
        end: m.index + m[0].length,
        inner,
        display: m[1] !== undefined || m[4] !== undefined,
      });
    }
    return spans;
  }

  function makeFinding(check, rule, lines, line, message) {
    return { check, rule, line, text: excerptOfLine(lines, line), message };
  }

  // ==========================================================================
  // CHECK 1 — EMPTY BRACE
  // ==========================================================================

  function checkEmptyBrace(code, lines) {
    const findings = [];
    const pattern = /\\(overbrace|underbrace)(?![A-Za-z])/g;
    let m;
    while ((m = pattern.exec(code)) !== null) {
      const name = m[1];
      const line = lineAt(code, m.index);
      let i = m.index + m[0].length;
      while (i < code.length && /\s/.test(code[i])) i++;

      if (code[i] !== "{") {
        findings.push(
          makeFinding(
            CHECKS.EMPTY_BRACE,
            "empty-body",
            lines,
            line,
            `This \\${name} has nothing under or over it. Was a symbol dropped?`,
          ),
        );
        continue;
      }

      const close = matchGroup(code, i);
      if (close === -1) continue; // an unclosed group is the unbalanced check's business

      if (code.slice(i + 1, close).trim() === "") {
        findings.push(
          makeFinding(
            CHECKS.EMPTY_BRACE,
            "empty-body",
            lines,
            line,
            `This \\${name} is empty. Was a symbol dropped?`,
          ),
        );
        continue;
      }

      let j = close + 1;
      while (j < code.length && /\s/.test(code[j])) j++;
      if (code[j] !== "^" && code[j] !== "_") {
        findings.push(
          makeFinding(
            CHECKS.EMPTY_BRACE,
            "no-label",
            lines,
            line,
            `This \\${name} has no label. Is there a symbol missing, with its label standing in the brace?`,
          ),
        );
      }
    }
    return findings;
  }

  // ==========================================================================
  // CHECK 2 — MATHS-ONLY HEADING
  // ==========================================================================

  function assessHeading(headingText) {
    const spans = findMathSpans(headingText);
    if (spans.length === 0) return null;

    let remainder = "";
    let cursor = 0;
    for (const s of spans) {
      remainder += headingText.slice(cursor, s.start);
      cursor = s.end;
    }
    remainder += headingText.slice(cursor);
    if (!/[\p{L}\p{N}]/u.test(remainder)) return "maths-only";

    const first = spans[0];
    const leading = headingText.slice(0, first.start).trim();
    if (leading === "" && first.inner.includes("=")) return "starts-with-equation";
    return null;
  }

  function checkMathsHeading(code, lines) {
    const findings = [];
    const spans = findMathSpans(code);
    const insideDisplay = (offset) =>
      spans.some((s) => s.display && offset >= s.start && offset < s.end);

    const report = (rule, line) =>
      findings.push(
        makeFinding(
          CHECKS.MATHS_HEADING,
          rule,
          lines,
          line,
          "This heading contains an equation. Is it a heading, or maths that ended up in one?",
        ),
      );

    const atx = /^[ \t]{0,3}#{1,6}[ \t]+(.*)$/gm;
    let m;
    while ((m = atx.exec(code)) !== null) {
      if (insideDisplay(m.index)) continue;
      const rule = assessHeading(m[1]);
      if (rule) report(rule, lineAt(code, m.index));
    }

    const section = /\\(?:sub){0,2}section\*?\s*\{/g;
    while ((m = section.exec(code)) !== null) {
      const open = m.index + m[0].length - 1;
      const close = matchGroup(code, open);
      if (close === -1) continue;
      const rule = assessHeading(code.slice(open + 1, close));
      if (rule) report(rule, lineAt(code, m.index));
    }

    return findings;
  }

  // ==========================================================================
  // CHECK 3 — INTEGRAL LIMITS
  // ==========================================================================

  function checkIntegralLimits(code, lines) {
    const limit = "(?:\\{([^{}]*)\\}|([^\\s{}\\\\]))";
    const pattern = new RegExp(`\\\\int\\s*_\\s*${limit}\\s*\\^\\s*${limit}`, "g");
    const byLower = new Map();
    let m;
    while ((m = pattern.exec(code)) !== null) {
      const lower = (m[1] ?? m[2]).trim();
      const upper = (m[3] ?? m[4]).trim();
      if (!/^[A-Za-z]$/.test(lower) || !/^[A-Za-z]$/.test(upper)) continue;
      if (!byLower.has(lower)) byLower.set(lower, []);
      byLower.get(lower).push({ upper, line: lineAt(code, m.index) });
    }

    const findings = [];
    for (const [lower, uses] of byLower) {
      const counts = new Map();
      for (const u of uses) counts.set(u.upper, (counts.get(u.upper) || 0) + 1);
      if (counts.size < 2) continue;

      let majority = null;
      for (const u of uses) {
        if (majority === null || counts.get(u.upper) > counts.get(majority)) {
          majority = u.upper;
        }
      }
      for (const u of uses) {
        if (u.upper === majority) continue;
        findings.push(
          makeFinding(
            CHECKS.INTEGRAL_LIMITS,
            "mixed-upper-limit",
            lines,
            u.line,
            `This integral runs from ${lower} to ${u.upper}, but others in this document run from ${lower} to ${majority}. Is one of the limits misread?`,
          ),
        );
      }
    }
    return findings;
  }

  // ==========================================================================
  // CHECK 4 — STRAY ">"
  // ==========================================================================

  function checkStrayQuote(code, lines) {
    const findings = [];
    const spans = findMathSpans(code);
    const codeLines = code.split("\n");

    let offset = 0;
    const startsWithQuote = [];
    for (let i = 0; i < codeLines.length; i++) {
      const lineStart = offset;
      offset += codeLines[i].length + 1;
      const isQuote =
        /^[ \t]{0,3}>/.test(codeLines[i]) &&
        !spans.some((s) => s.display && lineStart >= s.start && lineStart < s.end);
      startsWithQuote.push(isQuote);
    }

    let i = 0;
    while (i < startsWithQuote.length) {
      if (!startsWithQuote[i]) {
        i++;
        continue;
      }
      let end = i;
      while (end + 1 < startsWithQuote.length && startsWithQuote[end + 1]) end++;
      if (end === i) {
        findings.push(
          makeFinding(
            CHECKS.STRAY_QUOTE,
            "single-line",
            lines,
            i + 1,
            "This line starts with '>' so it displays as a quotation. Is it a quotation, or a note written beside the working?",
          ),
        );
      }
      i = end + 1;
    }
    return findings;
  }

  // ==========================================================================
  // CHECK 5 — UNBALANCED BRACES OR $
  // ==========================================================================

  function checkUnbalanced(code, lines) {
    const findings = [];
    const paragraph = /[^\n](?:[^\n]|\n(?![ \t]*\n))*/g;
    let m;
    while ((m = paragraph.exec(code)) !== null) {
      const body = m[0];
      let open = 0;
      let close = 0;
      let inlineDollars = 0;
      let displayDollars = 0;

      for (let i = 0; i < body.length; i++) {
        const c = body[i];
        if (c === "\\") {
          i++;
          continue;
        }
        if (c === "{") open++;
        else if (c === "}") close++;
        else if (c === "$") {
          if (body[i + 1] === "$") {
            displayDollars++;
            i++;
          } else {
            inlineDollars++;
          }
        }
      }

      const firstContent = m.index + (body.length - body.trimStart().length);
      const line = lineAt(code, firstContent);

      if (open !== close) {
        findings.push(
          makeFinding(
            CHECKS.UNBALANCED,
            "braces",
            lines,
            line,
            `This paragraph has ${open} '{' and ${close} '}'. Is a brace missing?`,
          ),
        );
      }
      if (inlineDollars % 2 !== 0 || displayDollars % 2 !== 0) {
        findings.push(
          makeFinding(
            CHECKS.UNBALANCED,
            "dollars",
            lines,
            line,
            "This paragraph has an odd number of maths markers ($). Is one missing?",
          ),
        );
      }
    }
    return findings;
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Run all five checks.
   * @param {string} mmd - MathPix Markdown text
   * @returns {Array<{check: string, rule: string, line: number, text: string, message: string}>}
   */
  function checkMMD(mmd) {
    if (typeof mmd !== "string" || mmd === "") return [];
    const lines = mmd.split("\n");
    const code = stripCode(mmd);

    const findings = [
      ...checkEmptyBrace(code, lines),
      ...checkMathsHeading(code, lines),
      ...checkIntegralLimits(code, lines),
      ...checkStrayQuote(code, lines),
      ...checkUnbalanced(code, lines),
    ];
    logDebug(`checkMMD: ${findings.length} finding(s)`);
    return findings;
  }

  window.MathPixMMDChecks = { CHECKS, checkMMD };

  logInfo("MathPixMMDChecks loaded");
})();
