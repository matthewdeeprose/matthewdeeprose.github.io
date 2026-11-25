/**
 * @file image-describer-structure-check.js
 * @description Free, pure-text layout checker for an Image Describer description (IDQ H-194b, built at H-201).
 * It finds five slips a text-only repair request can fix (a block after the data table, text after the
 * data table, a count line below its list, month names listed one by one, a sentence said twice) and three it
 * cannot (a missing section, a missing closing line, a count line above its list: H-204), and builds the repair
 * request for the first five.
 * No network, no DOM, no announcement. Nothing here reads window.PROMPT_*: the caller passes the text.
 * Loaded by tools.html before the controller's generate file (H-202). It also holds the keep-or-discard
 * checks for a fixed description (numbersPreserved, judgeFix), and codeFix (H-207), which makes the
 * TABLELATE, TEXTLATE and COUNTLINE fixes by code, with no AI.
 *
 * The rules are the H-194 rules (.claude/measurements/h194/rules.mjs, proved on 135 records), TEXTLATE from
 * H-200, and the request text is H-200's, with one change: TABLELATE names every late block.
 *
 * @module ImageDescriberStructureCheck
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
      console.error("[ImgDescStructureCheck]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[ImgDescStructureCheck]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[ImgDescStructureCheck]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[ImgDescStructureCheck]", message, ...args);
  }

  // =========================================================================
  // Constants
  // =========================================================================

  /** Rule ids. The first five can be repaired by a text-only request; the last two are report-only. */
  const RULES = Object.freeze({
    TABLELATE: "TABLELATE",
    TEXTLATE: "TEXTLATE",
    COUNTLINE: "COUNTLINE",
    MONTHS: "MONTHS",
    REPEAT: "REPEAT",
    SECTIONS: "SECTIONS",
    ENDS: "ENDS",
    COUNTHIGH: "COUNTHIGH",
  });

  /** Repairable rules, in the order of the numbered problem lines (H-200's RULES_IN_POOL). */
  const REPAIRABLE_RULES = Object.freeze([
    RULES.TABLELATE,
    RULES.TEXTLATE,
    RULES.COUNTLINE,
    RULES.MONTHS,
    RULES.REPEAT,
  ]);

  /**
   * Report-only rules, after the repairable ones in check()'s result, in this order (H-204 put COUNTHIGH
   * last, after SECTIONS and ENDS). COUNTHIGH: the count line says MORE than the list holds. That count may
   * be true (grouped items, text not in a numbered list) or the list may have left items out, and lowering
   * the number hides either, so the check reports it and never asks for a fix.
   */
  const REPORT_ONLY_RULES = Object.freeze([RULES.SECTIONS, RULES.ENDS, RULES.COUNTHIGH]);

  const SECTION_NUMBERS = Object.freeze([1, 2, 3, 4]);
  /**
   * A heading whose text starts with a section number 1. to 4. (H-207). H-206 found "### 4. Text Content"
   * at the wrong level after the table: it is a missing section (SECTIONS reports it), never a late block,
   * so neither code nor the AI is told to move it.
   */
  const SECTION_HEADING_TEXT = /^#{1,6}\s+[1-4]\./;
  const REPEAT_MIN_WORDS = 8; // a repeated sentence must be at least this long to count
  const MONTHS_IN_YEAR = 12;

  /** An item label that is exactly a month name or its abbreviation (H-174 runs.mjs). */
  const MONTH_LABEL =
    /^(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\.?$/i;
  const MONTH_PREFIXES = Object.freeze([
    "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
  ]);

  /** A list item line in Text Content (H-173 lib173.mjs). */
  const LIST_ITEM = /^\s*(?:\d+[.)]|[-*+])\s+(.*)$/;

  const SYSTEM_TEXT =
    'You are revising an image description written for a person who cannot see the picture. You do not have the picture. Fix only the problems listed. Do not add, remove or change any fact, figure, name, label, colour or position, except where a listed problem says so. Keep every heading, section number and the order of everything else. Return the whole description, in the same Markdown, ending with the line "Description ends."';

  // =========================================================================
  // Private helpers
  // =========================================================================

  function requireString(value, name) {
    if (typeof value !== "string") {
      throw new TypeError(`ImageDescriberStructureCheck: ${name} must be a string`);
    }
  }

  /** Lines of section n (between its "## n." heading and the next "## d." heading), or null. */
  function section(text, n) {
    const lines = text.split(/\r?\n/);
    const start = lines.findIndex((l) => new RegExp(`^##\\s+${n}\\.`).test(l));
    if (start < 0) return null;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (/^##\s+\d\./.test(lines[i])) {
        end = i;
        break;
      }
    }
    return lines.slice(start + 1, end);
  }

  /** Labels of the list items in section 4 up to "Description ends", or null with no section 4. */
  function textContentItems(text) {
    const lines = text.split(/\r?\n/);
    const start = lines.findIndex((l) => /^##\s+4\./.test(l));
    if (start < 0) return null;
    const items = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (/^\s*Description ends/i.test(lines[i])) break;
      const match = LIST_ITEM.exec(lines[i]);
      if (!match) continue;
      const body = match[1];
      const quoted = /`([^`]*)`/.exec(body) ?? /[“"]([^”"]*)[”"]/.exec(body);
      const label = (quoted ? quoted[1] : body.split(/,| — | - /)[0])
        .replace(/\*/g, "")
        .trim();
      items.push(label);
    }
    return items;
  }

  /** True when all twelve months are separate items of Text Content. */
  function monthsSeparate(text) {
    const items = textContentItems(text);
    if (items === null) return false;
    const seen = new Set();
    for (const raw of items) {
      const label = raw.replace(/[“”"']/g, "").trim();
      if (MONTH_LABEL.test(label)) {
        seen.add(MONTH_PREFIXES.indexOf(label.slice(0, 3).toLowerCase()));
      }
    }
    return seen.size === MONTHS_IN_YEAR;
  }

  /**
   * Headings of every block that sits after the first table row of section 3 and before the
   * Educational Significance heading, other than a "Data table:" heading or a numbered section
   * heading (SECTION_HEADING_TEXT, H-207). Empty when the layout is right.
   * Walks the lines as H-194's TABLELATE loop does, but collects every late heading, not the first.
   */
  function lateHeadings(text) {
    const found = [];
    let seenRow = false;
    for (const line of section(text, 3) || []) {
      if (/^\|/.test(line)) seenRow = true;
      else if (seenRow && /^#{1,6}\s+Educational Significance/i.test(line)) break;
      else if (
        seenRow &&
        /^#{1,6}\s/.test(line) &&
        !/^#{2,6}\s*Data table:/i.test(line) &&
        !SECTION_HEADING_TEXT.test(line)
      ) {
        found.push(line.replace(/^#+\s*/, "").trim());
      }
    }
    return found;
  }

  /** TEXTLATE: after the last table row of section 3 the first non-blank, non-table line is ordinary text and an Educational Significance heading follows it. */
  function textLate(text) {
    const s3 = section(text, 3) || [];
    let last = -1;
    s3.forEach((l, i) => {
      if (/^\|/.test(l)) last = i;
    });
    if (last < 0) return false;
    const rest = s3.slice(last + 1);
    const first = rest.find((l) => l.trim() && !/^\|/.test(l));
    if (first === undefined || /^#{1,6}\s/.test(first)) return false; // a heading first is TABLELATE's case
    return rest.some((l) => /^#{1,6}\s+Educational Significance/i.test(l));
  }

  /** The count said in "There are N pieces of text" and the number of listed items (either may be null). */
  function countLine(text) {
    const items = textContentItems(text);
    const said = /There (?:are|is) (\d+) pieces? of (?:legible )?text/i.exec(text);
    return {
      said: said ? Number(said[1]) : null,
      listed: items ? items.length : null,
    };
  }

  const normaliseSentence = (s) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  /** Sentences of REPEAT_MIN_WORDS words or more that occur more than once: first-occurrence wording and count. */
  function repeatedSentences(text) {
    const all = text
      .split(/\r?\n/)
      .flatMap((line) => line.split(/(?<=[.!?])\s+/))
      .map((s) => ({ original: s.trim(), key: normaliseSentence(s) }))
      .filter((x) => x.key.split(" ").length >= REPEAT_MIN_WORDS);
    const seen = new Map();
    for (const x of all) {
      const entry = seen.get(x.key);
      if (entry) entry.count++;
      else seen.set(x.key, { sentence: x.original, count: 1 });
    }
    return [...seen.values()].filter((e) => e.count > 1);
  }

  // =========================================================================
  // Public functions
  // =========================================================================

  /**
   * Check one description. Pure: reads only `text`.
   * @param {string} text - the description Markdown
   * @returns {{ fired: Array<{ rule: string, detail: object }> }} in repairable-rule order, then SECTIONS, ENDS, COUNTHIGH
   */
  function check(text) {
    requireString(text, "text");
    const fired = [];

    const late = lateHeadings(text);
    if (late.length) fired.push({ rule: RULES.TABLELATE, detail: { headings: late } });

    if (textLate(text)) fired.push({ rule: RULES.TEXTLATE, detail: {} });

    const counts = countLine(text);
    // H-204: the list is the evidence only when it holds MORE than the count says; then raising the count is safe.
    const countKnown = counts.said !== null && counts.listed !== null;
    if (countKnown && counts.said < counts.listed) {
      fired.push({ rule: RULES.COUNTLINE, detail: { said: counts.said, listed: counts.listed } });
    }

    if (monthsSeparate(text)) fired.push({ rule: RULES.MONTHS, detail: {} });

    const repeats = repeatedSentences(text);
    if (repeats.length) fired.push({ rule: RULES.REPEAT, detail: { sentences: repeats } });

    const missing = SECTION_NUMBERS.filter(
      (n) => !new RegExp(`^##\\s+${n}\\.`, "m").test(text),
    );
    if (missing.length) fired.push({ rule: RULES.SECTIONS, detail: { missing } });

    if (!/^\s*Description ends/im.test(text)) fired.push({ rule: RULES.ENDS, detail: {} });

    if (countKnown && counts.said > counts.listed) {
      fired.push({ rule: RULES.COUNTHIGH, detail: { said: counts.said, listed: counts.listed } });
    }

    logDebug("check fired", fired.map((f) => f.rule));
    return { fired };
  }

  /**
   * The shipped prompt's one sentence that names month names, cut out by code.
   * Throws when the prompt has no such sentence or more than one.
   * @param {string} promptText - e.g. window.PROMPT_IMAGE_DESCRIPTION
   */
  function monthSentence(promptText) {
    requireString(promptText, "promptText");
    const hits = promptText
      .split(/\r?\n/)
      .flatMap((line) => line.split(/(?<=[.!?])\s+/))
      .filter((s) => /month names/i.test(s));
    if (hits.length !== 1) {
      throw new Error(
        `ImageDescriberStructureCheck: ${hits.length} sentences name month names in the prompt, not 1`,
      );
    }
    return hits[0].trim();
  }

  /** One numbered problem line per fired repairable rule; TABLELATE gives one line per late block. */
  function problemLines(text, firedRules, monthSentenceText) {
    const out = [];
    const detailOf = (rule) => firedRules.find((f) => f.rule === rule).detail;
    for (const rule of REPAIRABLE_RULES) {
      if (!firedRules.some((f) => f.rule === rule)) continue;
      if (rule === RULES.TABLELATE) {
        for (const heading of detailOf(rule).headings) {
          out.push(
            `The block headed "${heading}" comes after the data table inside Visual Content. Move it, unchanged, to just before the table, so the table closes Visual Content.`,
          );
        }
      } else if (rule === RULES.TEXTLATE) {
        out.push(
          "Some text comes after the data table and before the Educational Significance heading. Move it, unchanged, to just before the table, so the table closes Visual Content.",
        );
      } else if (rule === RULES.COUNTLINE) {
        const { said, listed } = detailOf(rule);
        out.push(
          `Text Content opens by saying there are ${said} pieces of text, but its list has ${listed} items. Change the number in the opening sentence to ${listed}. Do not change the list.`,
        );
      } else if (rule === RULES.MONTHS) {
        out.push(
          `Text Content lists the twelve month names as separate items. Make them one item, following this instruction from the original task: "${monthSentenceText}". Then renumber the list and make the opening count match it.`,
        );
      } else if (rule === RULES.REPEAT) {
        const first = detailOf(rule).sentences[0].sentence;
        out.push(
          `This sentence appears twice: "${first}". Keep the first and delete the second, unless the second carries something the first does not.`,
        );
      }
    }
    return out;
  }

  /**
   * Build the text-only repair request for the repairable rules that fired.
   * @param {string} text - the description that was checked
   * @param {Array<{rule: string, detail: object}>} fired - check(text).fired
   * @param {string} monthSentenceText - monthSentence(prompt); required when MONTHS fired
   * @returns {{ system: string, user: string } | null} null when only SECTIONS and/or ENDS fired, or nothing did
   */
  function buildRepairRequest(text, fired, monthSentenceText) {
    requireString(text, "text");
    if (!Array.isArray(fired)) {
      throw new TypeError("ImageDescriberStructureCheck: fired must be check(text).fired");
    }
    const repairable = fired.filter((f) => REPAIRABLE_RULES.includes(f.rule));
    if (!repairable.length) return null;
    if (repairable.some((f) => f.rule === RULES.MONTHS)) {
      requireString(monthSentenceText, "monthSentenceText");
    }
    const lines = problemLines(text, repairable, monthSentenceText);
    const numbered = lines.map((l, i) => `${i + 1}. ${l}`).join("\n");
    return {
      system: SYSTEM_TEXT,
      user: `Problems to fix:\n${numbered}\n\nDescription:\n${text}`,
    };
  }

  // =========================================================================
  // Keep-or-discard checks for a fixed description (H-202; H-200's H1, H4, H5, H7)
  // =========================================================================

  const NUMBER_TOKEN = /\d+(?:[.,]\d+)*/g;
  const FINISH_STOP = "stop";
  const MONTHS_FOLD_NUMBER = "12";

  /** Number tokens of the whole text, leaving out list and heading markers at the start of a line ("12." / "## 3."), which a renumber moves. */
  function numberTokens(text) {
    const bag = new Map();
    for (const line of text.split(/\r?\n/)) {
      const body = line
        .replace(/^\s*(?:#{1,6}\s+)?\d+\.\s+/, "")
        .replace(/^\s*(?:#{1,6}\s+)?\d+\.$/, "");
      for (const token of body.match(NUMBER_TOKEN) ?? []) {
        bag.set(token, (bag.get(token) ?? 0) + 1);
      }
    }
    return bag;
  }

  /** Tokens in `b` not in `a` (added) and tokens in `a` not in `b` (removed). */
  function bagDiff(a, b) {
    const added = [];
    const removed = [];
    for (const [token, n] of b) {
      for (let i = 0; i < n - (a.get(token) ?? 0); i++) added.push(token);
    }
    for (const [token, n] of a) {
      for (let i = 0; i < n - (b.get(token) ?? 0); i++) removed.push(token);
    }
    return { added, removed };
  }

  /** Remove each allowed token from `list` once; return what is left. */
  function takeAllowed(list, allowed) {
    const rest = list.slice();
    for (const token of allowed) {
      const i = rest.indexOf(token);
      if (i >= 0) rest.splice(i, 1);
    }
    return rest;
  }

  /**
   * True when the fixed text carries the same number tokens as the original, apart from the two
   * changes a repair is asked to make: the COUNTLINE number (old said removed, new said added, when
   * COUNTLINE or MONTHS fired) and, with MONTHS, a "12" added.
   * @param {string} original
   * @param {string} fixed
   * @param {Array<{rule: string}>} fired - check(original).fired
   * @returns {boolean}
   */
  function numbersPreserved(original, fixed, fired) {
    requireString(original, "original");
    requireString(fixed, "fixed");
    if (!Array.isArray(fired)) {
      throw new TypeError("ImageDescriberStructureCheck: fired must be check(text).fired");
    }
    const has = (rule) => fired.some((f) => f.rule === rule);
    const diff = bagDiff(numberTokens(original), numberTokens(fixed));
    const allowedRemoved = [];
    const allowedAdded = [];
    const before = countLine(original);
    const after = countLine(fixed);
    if (
      (has(RULES.COUNTLINE) || has(RULES.MONTHS)) &&
      before.said !== null &&
      after.said !== null &&
      before.said !== after.said
    ) {
      allowedRemoved.push(String(before.said));
      allowedAdded.push(String(after.said));
    }
    if (has(RULES.MONTHS)) allowedAdded.push(MONTHS_FOLD_NUMBER);
    return (
      takeAllowed(diff.removed, allowedRemoved).length === 0 &&
      takeAllowed(diff.added, allowedAdded).length === 0
    );
  }

  /** The check ids judgeFix can name when it discards a fix. */
  const FIX_CHECKS = Object.freeze({
    EMPTY: "EMPTY",
    FINISH: "FINISH",
    NEW_RULE: "NEW_RULE",
    SECTIONS: "SECTIONS",
    ENDS: "ENDS",
    NUMBERS: "NUMBERS",
  });

  /**
   * Decide whether a fixed description may replace the original. Keep only when ALL hold: the reply is
   * non-empty and finished "stop"; check() on it fires no rule that did not fire on the original; the
   * four sections and a last line "Description ends." are present; the number tokens are unchanged
   * (numbersPreserved). Never throws on a bad reply: a non-string reply is a discard.
   * @param {{ original: string, fixed: *, finishReason: *, fired: Array<{rule: string}> }} input
   *   `fired` is check(original).fired
   * @returns {{ keep: boolean, failed: string|null }} the first check that failed, or null
   */
  function judgeFix({ original, fixed, finishReason, fired }) {
    requireString(original, "original");
    if (typeof fixed !== "string" || fixed.trim() === "") {
      return { keep: false, failed: FIX_CHECKS.EMPTY };
    }
    if (finishReason !== FINISH_STOP) return { keep: false, failed: FIX_CHECKS.FINISH };

    const firedBefore = new Set(fired.map((f) => f.rule));
    const after = check(fixed).fired.map((f) => f.rule);
    if (after.some((rule) => !firedBefore.has(rule))) {
      return { keep: false, failed: FIX_CHECKS.NEW_RULE };
    }
    if (!SECTION_NUMBERS.every((n) => new RegExp(`^##\\s+${n}\\.`, "m").test(fixed))) {
      return { keep: false, failed: FIX_CHECKS.SECTIONS };
    }
    const lastLine = fixed.split(/\r?\n/).filter((l) => l.trim()).pop() ?? "";
    if (lastLine.trim() !== "Description ends.") {
      return { keep: false, failed: FIX_CHECKS.ENDS };
    }
    if (!numbersPreserved(original, fixed, fired)) {
      return { keep: false, failed: FIX_CHECKS.NUMBERS };
    }
    return { keep: true, failed: null };
  }

  // =========================================================================
  // The code fix (H-207, ported from .claude/measurements/h206/codefix206.mjs with its plants
  // and its REPEAT edit removed). For TABLELATE, TEXTLATE and COUNTLINE only, it makes the edit
  // the problem line names: whole lines moved to just above the "Data table:" heading, or the
  // count number raised to the list length. It writes no word; blank lines are the only other
  // thing it adds or removes. H-206: 289 of 289 such slips cleared over the committed records.
  // =========================================================================

  /** The rules codeFix acts on. MONTHS and REPEAT are left to the AI (H-206: 7 of 13 REPEAT deletions unsafe). */
  const CODE_FIX_RULES = Object.freeze([RULES.TABLELATE, RULES.TEXTLATE, RULES.COUNTLINE]);
  const COUNT_SENTENCE = /There (?:are|is) (\d+) pieces? of (?:legible )?text/i; // countLine()'s pattern

  /** The kinds of edit codeFix reports. */
  const CODE_EDITS = Object.freeze({ MOVE: "MOVE", COUNT: "COUNT" });

  const isRow = (line) => /^\|/.test(line);
  const isHeading = (line) => /^#{1,6}\s/.test(line);
  const isDataTableHeading = (line) => /^#{2,6}\s*Data table:/i.test(line);
  const isEsHeading = (line) => /^#{1,6}\s+Educational Significance/i.test(line);

  /** [start, end) line indexes of section n's body, or null. The same bounds as section(). */
  function sectionBounds(lines, n) {
    const start = lines.findIndex((l) => new RegExp(`^##\\s+${n}\\.`).test(l));
    if (start < 0) return null;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (/^##\s+\d\./.test(lines[i])) {
        end = i;
        break;
      }
    }
    return [start + 1, end];
  }

  /**
   * The late blocks of section 3 as line ranges [start, end), trailing blank lines left out, in
   * document order. TABLELATE: from a late heading (the headings lateHeadings names) to the next
   * heading, table row or the Educational Significance heading. TEXTLATE: from the first text
   * line after the last table row to the next heading.
   */
  function lateBlocks(lines, firedRules) {
    const bounds = sectionBounds(lines, 3);
    if (!bounds) return { blocks: [], firstRow: -1, bounds: null };
    const [s, e] = bounds;
    let firstRow = -1;
    let lastRow = -1;
    for (let i = s; i < e; i++) {
      if (!isRow(lines[i])) continue;
      if (firstRow < 0) firstRow = i;
      lastRow = i;
    }
    if (firstRow < 0) return { blocks: [], firstRow, bounds };
    const blocks = [];
    const trimEnd = (start, end) => {
      let k = end;
      while (k > start + 1 && !lines[k - 1].trim()) k--;
      return k;
    };

    if (firedRules.includes(RULES.TABLELATE)) {
      let es = e;
      for (let i = firstRow + 1; i < e; i++) {
        if (isEsHeading(lines[i])) {
          es = i;
          break;
        }
      }
      for (let i = firstRow + 1; i < es; i++) {
        const line = lines[i];
        if (!isHeading(line) || isDataTableHeading(line) || SECTION_HEADING_TEXT.test(line)) continue;
        let j = i + 1;
        while (j < es && !isHeading(lines[j]) && !isRow(lines[j])) j++;
        blocks.push({ rule: RULES.TABLELATE, start: i, end: trimEnd(i, j) });
        i = j - 1;
      }
    }
    if (firedRules.includes(RULES.TEXTLATE)) {
      let k = lastRow + 1;
      while (k < e && !lines[k].trim()) k++;
      if (k < e && !isHeading(lines[k])) {
        let j = k + 1;
        while (j < e && !isHeading(lines[j])) j++;
        blocks.push({ rule: RULES.TEXTLATE, start: k, end: trimEnd(k, j) });
      }
    }
    blocks.sort((x, y) => x.start - y.start);
    return { blocks, firstRow, bounds };
  }

  /**
   * The line a moved block is put before: the earliest "Data table:" heading above the first row
   * with no other heading between it and the row (H-206: the AI put 43 of 55 blocks there), else
   * the first row.
   */
  function destination(lines, firstRow, bounds) {
    let dest = firstRow;
    for (let i = firstRow - 1; i >= bounds[0]; i--) {
      if (isDataTableHeading(lines[i])) dest = i;
      else if (isHeading(lines[i]) || isRow(lines[i])) break;
    }
    return dest;
  }

  /** Inside section 3 only: no two blank lines in a row, and a blank line between a table row and a heading after it. */
  function tidyBlankLines(lines) {
    const bounds = sectionBounds(lines, 3);
    if (!bounds) return lines;
    const out = lines.slice(0, bounds[0]);
    for (let i = bounds[0]; i < bounds[1]; i++) {
      const line = lines[i];
      const prev = out[out.length - 1] ?? "";
      if (!line.trim() && !prev.trim()) continue;
      if (isHeading(line) && isRow(prev)) out.push("");
      out.push(line);
    }
    if (bounds[1] < lines.length && (out[out.length - 1] ?? "").trim()) out.push("");
    return out.concat(lines.slice(bounds[1]));
  }

  function applyMoves(lines, firedRules, edits) {
    const { blocks, firstRow, bounds } = lateBlocks(lines, firedRules);
    if (!blocks.length) return lines;
    const dest = destination(lines, firstRow, bounds);
    const moving = new Set();
    const moved = [];
    for (const block of blocks) {
      for (let i = block.start; i < block.end; i++) moving.add(i);
      moved.push(...lines.slice(block.start, block.end), "");
      edits.push({ kind: CODE_EDITS.MOVE, rule: block.rule, lines: block.end - block.start });
    }
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      if (i === dest) {
        if (out.length && out[out.length - 1].trim()) out.push("");
        out.push(...moved);
      }
      if (!moving.has(i)) out.push(lines[i]);
    }
    return tidyBlankLines(out);
  }

  /** Raise the number in the count sentence to the list length, on the text as it is after any move. */
  function applyCountLine(lines, edits) {
    const detail = check(lines.join("\n")).fired.find((f) => f.rule === RULES.COUNTLINE)?.detail;
    if (!detail) return lines;
    const index = lines.findIndex((l) => COUNT_SENTENCE.test(l));
    if (index < 0) return lines;
    const before = lines[index];
    const match = COUNT_SENTENCE.exec(before);
    const numberAt = match.index + match[0].indexOf(match[1]);
    const out = lines.slice();
    out[index] =
      before.slice(0, numberAt) + String(detail.listed) + before.slice(numberAt + match[1].length);
    edits.push({ kind: CODE_EDITS.COUNT, rule: RULES.COUNTLINE, from: detail.said, to: detail.listed });
    return out;
  }

  /**
   * Fix by code the slips that are a pure move or one number. Pure: reads only `text`, no DOM.
   * The caller still judges the result with judgeFix before showing it.
   * @param {string} text - the description Markdown
   * @returns {{ text: string, edits: Array<object> }} text is the same string, and edits empty,
   *   when none of TABLELATE, TEXTLATE and COUNTLINE fires
   */
  function codeFix(text) {
    requireString(text, "text");
    const fired = check(text).fired.map((f) => f.rule);
    const edits = [];
    if (!fired.some((rule) => CODE_FIX_RULES.includes(rule))) {
      return Object.freeze({ text, edits: Object.freeze(edits) });
    }
    const eol = /\r\n/.test(text) ? "\r\n" : "\n";
    let lines = text.split(/\r?\n/);
    if (fired.includes(RULES.TABLELATE) || fired.includes(RULES.TEXTLATE)) {
      lines = applyMoves(lines, fired, edits);
    }
    if (fired.includes(RULES.COUNTLINE)) lines = applyCountLine(lines, edits);
    logDebug("codeFix edits", edits);
    return Object.freeze({ text: lines.join(eol), edits: Object.freeze(edits) });
  }

  window.ImageDescriberStructureCheck = Object.freeze({
    RULES,
    FIX_CHECKS,
    CODE_FIX_RULES,
    CODE_EDITS,
    check,
    codeFix,
    buildRepairRequest,
    monthSentence,
    numbersPreserved,
    judgeFix,
  });

  logInfo("ImageDescriberStructureCheck ready");
})();
