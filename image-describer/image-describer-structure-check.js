/**
 * @file image-describer-structure-check.js
 * @description Free, pure-text layout checker for an Image Describer description (IDQ H-194b, built at H-201).
 * It finds five slips a text-only repair request can fix (a block after the data table, text after the
 * data table, a wrong count line, month names listed one by one, a sentence said twice) and two it cannot
 * (a missing section, a missing closing line), and builds the repair request for the first five.
 * No network, no DOM, no announcement. Nothing here reads window.PROMPT_*: the caller passes the text.
 * NOT LOADED BY ANY PAGE YET (the wiring is H-202).
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
  });

  /** Repairable rules, in the order of the numbered problem lines (H-200's RULES_IN_POOL). */
  const REPAIRABLE_RULES = Object.freeze([
    RULES.TABLELATE,
    RULES.TEXTLATE,
    RULES.COUNTLINE,
    RULES.MONTHS,
    RULES.REPEAT,
  ]);

  /** Report-only rules, after the repairable ones in check()'s result. */
  const REPORT_ONLY_RULES = Object.freeze([RULES.SECTIONS, RULES.ENDS]);

  const SECTION_NUMBERS = Object.freeze([1, 2, 3, 4]);
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
   * Educational Significance heading, other than a "Data table:" heading. Empty when the layout is right.
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
        !/^#{2,6}\s*Data table:/i.test(line)
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
   * @returns {{ fired: Array<{ rule: string, detail: object }> }} in repairable-rule order, then SECTIONS, ENDS
   */
  function check(text) {
    requireString(text, "text");
    const fired = [];

    const late = lateHeadings(text);
    if (late.length) fired.push({ rule: RULES.TABLELATE, detail: { headings: late } });

    if (textLate(text)) fired.push({ rule: RULES.TEXTLATE, detail: {} });

    const counts = countLine(text);
    if (counts.said !== null && counts.listed !== null && counts.said !== counts.listed) {
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

  window.ImageDescriberStructureCheck = Object.freeze({
    RULES,
    check,
    buildRepairRequest,
    monthSentence,
  });

  logInfo("ImageDescriberStructureCheck ready");
})();
