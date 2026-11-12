/**
 * @fileoverview MathPixBrailleFormatter (BR-3b) - lays the shared document tree out as braille pages.
 *
 * Reads a MathPixDocumentTree tree, translates every text run and every maths node through MathPixBrailleEngine
 * (separately, then joined with the source spacing, so a contraction never crosses a text-to-maths boundary),
 * and lays the result out under a LAYOUT PROFILE: a plain data object. Two profiles ship:
 *   profiles.aba    - Australian Braille Authority, Rules and Guidelines for Formatting Braille (2016).
 *   profiles.ukaaf  - UKAAF guidance (B004 Guiding Principles 2016, Additional Guidance on UEB Mathematics 2015, B009).
 * The two share all code; only the data differs. Where a source does not settle a value it is marked DRAFT DEFAULT
 * in the profile's `provenance` table, so nothing unsourced reads as sourced.
 *
 * Also writes the two file forms: toBRF (Braille ASCII, CRLF, form feed between pages) and toUnicodeText.
 * Neither writer touches the page. The formatter never runs on its own: nothing calls the engine until format().
 *
 * @module MathPixBrailleFormatter
 * @version 1.1.0 (BR-3b, BR-3c)
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[BrailleFormatter]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[BrailleFormatter]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[BrailleFormatter]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.debug("[BrailleFormatter]", message, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const BLANK = "⠀"; // the blank braille cell; the engine's own space character
  const FORM_FEED = "\f";
  const CRLF = "\r\n";
  const NEWLINE_TEXT = "\n";
  const MATHML_NS = "http://www.w3.org/1998/Math/MathML";
  const FAILED_CELLS = "⠿⠿⠿"; // three full cells stand in for an entry the engine could not translate
  const NUMERIC_INDICATOR = "⠼";
  const DIGIT_CELLS = Object.freeze(["⠚", "⠁", "⠃", "⠉", "⠙", "⠑", "⠋", "⠛", "⠓", "⠊"]);
  const BULLET_CELLS = "⠸⠲"; // dots 456 then 256

  const MATH_CODES = Object.freeze({ UEB: "UEB", NEMETH: "Nemeth" });
  const GRADES = Object.freeze({ g2: "en-ueb-g2", g1: "en-ueb-g1" });
  const DEFAULT_GRADE = "g2";

  const BREAK_RULES = Object.freeze({ RELATION: "relation", OPERATION: "operation", CELL_LIMIT: "cell-limit" });

  // BR-3c: emphasis kept as UEB typeform. The tree's strong and em become the engine's bold and italic runs, and liblouis
  // adds the typeform indicators itself. Anything else the tree names is not carried, and that is counted and listed.
  const FORM_OF_EMPHASIS = Object.freeze({ strong: "bold", em: "italic" });
  const FORM_SEPARATOR = "+";
  const WARNING_EMPHASIS = "Some emphasis could not be carried into braille and was left out.";

  /** What kind of line each layout entry is, for stats.linesByKind. */
  const LINE_KINDS = Object.freeze({
    HEADING: "heading", PARAGRAPH: "paragraph", LIST: "list", TABLE: "table", MATHS: "maths",
    FIGURE_NOTE: "figureNote", PRELIMINARY: "preliminary", PAGE_NUMBER: "pageNumber", BLANK: "blank",
  });
  const KIND_OF_BLOCK = Object.freeze({
    heading: LINE_KINDS.HEADING, paragraph: LINE_KINDS.PARAGRAPH, list: LINE_KINDS.LIST, table: LINE_KINDS.TABLE, note: LINE_KINDS.FIGURE_NOTE,
  });

  // What each cell of a laid-out line is, kept beside the line so the proof file can tell maths from text.
  const MASK = Object.freeze({ TEXT: "t", MATHS: "m", RAW: "r", SPACE: "s" });

  /** Fixed plain English; raw engine errors never reach a person. */
  const REASONS = Object.freeze({
    noTree: "There is no document to turn into braille.",
    badProfile: "That braille layout is not available.",
    badMathCode: "That maths braille code is not available.",
    badGrade: "That braille grade is not available.",
    noEngine: "The braille converter is not available on this page.",
    failed: "The braille layout could not be completed.",
  });

  const TEXTS = Object.freeze({
    figure: "Figure",
    description: "Description:",
    textInImage: "Text in the image:",
    noDescription: "No description is available.",
    prelimLines: Object.freeze([
      "This braille file was produced automatically.",
      "It has not been checked by a qualified braille transcriber.",
    ]),
    prelimProfile: "Layout:",
    prelimMaths: "Maths code:",
    prelimDate: "Date:",
  });

  // Calibration expressions: the engine itself says how a relation or operation sign looks between two operands.
  const RELATION_SIGNS = Object.freeze(["=", "≠", "&lt;", "&gt;", "≤", "≥", "≈", "≡", "∼", "≅", "∝"]);
  const OPERATION_SIGNS = Object.freeze(["+", "−", "×", "÷", "⋅", "±"]);
  const CAL_FIRST_CELL = "⠁"; // the cell for the operand a
  const CAL_LAST_CELLS = Object.freeze(["⠃", "⠰⠃"]); // the operand b, bare or after a grade 1 indicator
  const GROUP_OPEN = Object.freeze(["⠷", "⠣"]); // fraction open, group open
  const GROUP_CLOSE = Object.freeze(["⠾", "⠜"]);
  const LESS_THAN_LEAD = "⠈";
  const NO_BREAK_AFTER = Object.freeze(["⠔", "⠢", "⠣", "⠷", "⠌", "⠰"]);

  // ============================================================================
  // PROFILES (plain data; every value traced to a source or marked DRAFT DEFAULT)
  // ============================================================================

  const deepFreeze = (o) => {
    Object.values(o).forEach((v) => { if (v && typeof v === "object") deepFreeze(v); });
    return Object.freeze(o);
  };

  const SRC = Object.freeze({
    ABA: "ABA Rules and Guidelines for Formatting Braille (2016)",
    B004: "UKAAF B004 Guiding Principles for the Presentation of Braille (2016)",
    B009: "UKAAF B009 Embossing, Binding and Labelling Guidelines (2017)",
    UKM: "UKAAF Additional Guidance on UEB Mathematics (2015)",
    ICEB: "ICEB Guidelines for Technical Material (2014)",
  });

  const profileAba = deepFreeze({
    name: "aba",
    label: "Australian (ABA 2016)",
    cellsPerLine: 40,
    linesPerPage: 25,
    pageNumberPosition: "top-right",
    printPageIndicator: "off",
    headings: {
      1: { align: "centre", margin: 6, first: 1, runover: 1, blankBefore: 1 },
      2: { align: "blocked", margin: 0, first: 5, runover: 5, blankBefore: 1 },
      3: { align: "blocked", margin: 0, first: 3, runover: 3, blankBefore: 1 },
      4: { align: "blocked", margin: 0, first: 1, runover: 1, blankBefore: 1 },
    },
    paragraph: { first: 3, runover: 1 },
    list: { first: [1, 3, 5, 7], runover: [3, 5, 7, 9], blankBefore: 0, blankAfter: 0 },
    displayMaths: { first: 5, runover: 7, blankBefore: 0, blankAfter: 0 },
    blockquote: { first: 5, runover: 3 },
    table: { method: "linear", first: 1, runover: 3, cellSeparator: "⠸⠳", blankBefore: 0, blankAfter: 0 },
    note: { open: "@.<", close: "@.>", first: 3, runover: 1, indicatorSpacing: "unspaced", blankBefore: 0, blankAfter: 0 },
    blankLines: { betweenParagraphs: 0, afterHeading: 0, betweenHeadings: 0 },
    preliminaryPage: true,
    provenance: {
      cellsPerLine: { source: "no paper standard stated (Introduction, 7.1.4); 40 is the common BRF width", draft: true },
      linesPerPage: { source: "25 is stated for braille e-books only (Appendix 3); not for paper", draft: true },
      pageNumberPosition: { source: SRC.ABA + " 1.3.1: braille page number top right", draft: false },
      printPageIndicator: { source: "off by this parcel's ruling; ABA 1.4.2 puts it top left", draft: false },
      headings: { source: SRC.ABA + " 2.3.3: H1 centred with at least 6 blank cells each side, H2 cell 5, H3 cell 3, H4 cell 1, a blank line before; runover cell not stated, taken as the block cell", draft: false },
      paragraph: { source: SRC.ABA + " 2.4.1: first line indented two cells, runover at the margin", draft: false },
      list: { source: SRC.ABA + " 2.8.6 method 1: runover two cells in, each sub-level two more; levels beyond the first extrapolated", draft: false },
      displayMaths: { source: SRC.ABA + " 4.3.1 gives no cell numbers and refers to " + SRC.ICEB + " 1.4.1 (cell 3/5 or cell 5/7); 5/7 chosen to match " + SRC.UKM, draft: true },
      blockquote: { source: SRC.ABA + " 2.7.1: two-cell increments from the paragraph cells", draft: false },
      table: { source: SRC.ABA + " 3.10.25 linear form: one list item per row, runover indented; the separator mark is not stated", draft: true },
      note: { source: SRC.ABA + " 2.16.6: indicators @.< and @.>; indent as a paragraph; no spacing rule stated, unspaced chosen", draft: true },
      blankLines: { source: SRC.ABA + " 2.13.1 no blank line between paragraphs, 2.13.2 none after headings, 2.3.4 none needed between sequential headings", draft: false },
      preliminaryPage: { source: "this parcel's ruling; ABA 5.2 title page is a layout choice", draft: true },
    },
  });

  const profileUkaaf = deepFreeze({
    name: "ukaaf",
    label: "United Kingdom (UKAAF)",
    cellsPerLine: 40,
    linesPerPage: 28,
    pageNumberPosition: "top-right",
    printPageIndicator: "off",
    headings: {
      1: { align: "centre", margin: 0, first: 1, runover: 1, blankBefore: 1 },
      2: { align: "blocked", margin: 0, first: 1, runover: 5, blankBefore: 1 },
      3: { align: "blocked", margin: 0, first: 3, runover: 5, blankBefore: 1 },
      4: { align: "blocked", margin: 0, first: 3, runover: 5, blankBefore: 1 },
    },
    paragraph: { first: 3, runover: 1 },
    list: { first: [1, 3, 5, 7], runover: [3, 5, 7, 9], blankBefore: 1, blankAfter: 1 },
    displayMaths: { first: 5, runover: 7, blankBefore: 0, blankAfter: 0 },
    blockquote: { first: 7, runover: 5 },
    table: { method: "linear", first: 1, runover: 3, cellSeparator: "⠸⠳", blankBefore: 0, blankAfter: 0 },
    note: { open: "@.<", close: "@.>", first: 3, runover: 1, indicatorSpacing: "unspaced", blankBefore: 0, blankAfter: 0 },
    blankLines: { betweenParagraphs: 0, afterHeading: 0, betweenHeadings: 1 },
    preliminaryPage: true,
    provenance: {
      cellsPerLine: { source: SRC.B009 + " 1.2: up to 40 cells (a maximum, not a standard)", draft: false },
      linesPerPage: { source: SRC.B009 + " 1.2: up to 28 lines (a maximum, not a standard)", draft: false },
      pageNumberPosition: { source: SRC.B004 + " section 6: braille page number top right", draft: false },
      printPageIndicator: { source: "off by this parcel's ruling; B004 section 7 puts the print page top left", draft: false },
      headings: { source: SRC.B004 + " section 5: H1 centred, H2 cell 1 with runovers in cell 5, H3 cell 3 with runovers in cell 5; level 4 and below not read, taken as H3; H1 margin and indicator line not stated", draft: true },
      paragraph: { source: SRC.B004 + " section 9: paragraphs commence in cell 3 with runovers in cell 1", draft: false },
      list: { source: SRC.B004 + " section 10 example 1: blank line before and after, items in cell 1, runovers in cell 3; deeper levels extrapolated", draft: true },
      displayMaths: { source: SRC.UKM + " section 3: new line in cell 5, runovers in cell 7; blank lines around not stated", draft: false },
      blockquote: { source: SRC.B004 + " Appendix B and G: extracts start in cell 7, runovers in cell 5", draft: false },
      table: { source: SRC.B004 + " section 12 paragraph form; the separator mark is not stated", draft: true },
      note: { source: SRC.B004 + " section 12 example: indicators @.< and @.>; no form, wording or spacing rule", draft: true },
      blankLines: { source: SRC.B004 + " gives no general blank-line policy; none chosen between paragraphs or after headings; H2 and H3 are each preceded by a blank line (section 5), so one stays between sequential headings", draft: true },
      preliminaryPage: { source: "this parcel's ruling; B004 section 4 lists title and contents pages", draft: true },
    },
  });

  const profiles = Object.freeze({ aba: profileAba, ukaaf: profileUkaaf });

  /** Setting keys whose value differs between two profiles (provenance and name excluded). */
  function differingKeys(a, b) {
    const skip = new Set(["name", "provenance"]);
    return Object.keys(a).filter((k) => !skip.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  }

  /** Setting keys of a profile that carry the DRAFT DEFAULT mark. */
  function draftKeys(profile) {
    return Object.keys(profile.provenance).filter((k) => profile.provenance[k].draft);
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  const refusal = (reason) => ({ ok: false, reason });
  const lenOf = (s) => s.length;
  const blanks = (n) => BLANK.repeat(Math.max(0, n));
  const cellAscii = (a) => (window.MathPixBrailleEngine ? window.MathPixBrailleEngine.fromBrailleAscii(a) : a);

  function resolveProfile(p) {
    if (typeof p === "string") return profiles[p] || null;
    if (p && typeof p === "object" && p.cellsPerLine && p.headings) return p;
    return null;
  }

  function mathmlOf(inner) {
    return `<math xmlns="${MATHML_NS}">${inner}</math>`;
  }

  const escapeXml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /** Plain text of an inline list, or null if it holds maths (which a sub or sup cannot take as text here). */
  function plainTextOf(inlines) {
    let out = "";
    for (const n of inlines) {
      if (n.type === "text") out += n.text;
      else if (n.inlines) {
        const inner = plainTextOf(n.inlines);
        if (inner === null) return null;
        out += inner;
      } else return null;
    }
    return out;
  }

  /** MathML for a sub or sup with an empty base; null when it cannot be expressed. */
  function subSupMathml(node) {
    const text = plainTextOf(node.inlines || []);
    if (text === null) return null;
    const trimmed = text.trim();
    if (trimmed === "") return null;
    const parts = [];
    for (const m of trimmed.matchAll(/[0-9]+|[A-Za-z]|[^0-9A-Za-z\s]/g)) {
      const tok = m[0];
      if (/^[0-9]+$/.test(tok)) parts.push(`<mn>${tok}</mn>`);
      else if (/^[A-Za-z]$/.test(tok)) parts.push(`<mi>${tok}</mi>`);
      else parts.push(`<mo>${escapeXml(tok)}</mo>`);
    }
    const tag = node.type === "sub" ? "msub" : "msup";
    return mathmlOf(`<${tag}><mrow></mrow><mrow>${parts.join("")}</mrow></${tag}>`);
  }

  /** The typeform forms a text run carries, and whether the tree named emphasis this formatter cannot carry. */
  function formsOf(emphasis) {
    const forms = [];
    let dropped = false;
    for (const e of emphasis || []) {
      const form = FORM_OF_EMPHASIS[e];
      if (!form) dropped = true;
      else if (!forms.includes(form)) forms.push(form);
    }
    return { forms: forms.sort(), dropped };
  }

  const formSignature = (forms) => forms.join(FORM_SEPARATOR);
  const textKey = (grade, s, signature = "") => `${GRADES[grade]}\u0000${signature}\u0000${s}`;
  const runKey = (s, signature) => `${signature}\u0000${s}`;
  const mathKey = (code, ml) => `${code}\u0000${ml}`;

  // ============================================================================
  // PLAN: the tree as layout blocks with ready inline lists
  // ============================================================================

  function figureNoteInlines(fig, number, profile, includeTextInImage) {
    const note = profile.note;
    const spaced = note.indicatorSpacing === "spaced";
    const open = { type: "raw", braille: cellAscii(note.open), spaceAfter: spaced };
    const close = { type: "raw", braille: cellAscii(note.close), spaceBefore: spaced };
    const T = (text) => ({ type: "text", text, emphasis: [] });
    const out = [open, T(`${TEXTS.figure} ${number}.`)];
    if (fig.captionInlines && fig.captionInlines.length) out.push(T(" "), ...fig.captionInlines);
    const desc = fig.longDescriptionInlines && fig.longDescriptionInlines.length ? fig.longDescriptionInlines : fig.altInlines || [];
    const hasText = fig.textInImageInlines && fig.textInImageInlines.length;
    if (desc.length) out.push(T(` ${TEXTS.description} `), ...desc);
    if (hasText && includeTextInImage) out.push(T(` ${TEXTS.textInImage} `), ...fig.textInImageInlines);
    // The text in the image counts as present even when it is left out by choice, so that choice never adds "No description".
    if (!desc.length && !hasText && !(fig.captionInlines && fig.captionInlines.length)) out.push(T(` ${TEXTS.noDescription}`));
    out.push(close);
    return out;
  }

  function buildPlan(tree, profile, warnings, stats, includeTextInImage) {
    let figureNumber = 0;

    const planBlocks = (blocks, quote) => {
      const out = [];
      for (const b of blocks) {
        if (b.type === "heading") out.push({ kind: "heading", rank: b.rank || b.level || 1, inlines: b.inlines });
        else if (b.type === "paragraph") out.push({ kind: "paragraph", inlines: b.inlines, quote });
        else if (b.type === "list") {
          const items = b.items.map((blocksOfItem, i) => ({
            marker: b.ordered
              ? { type: "text", text: `${i + 1}. `, emphasis: [] }
              : { type: "raw", braille: BULLET_CELLS, spaceAfter: true },
            blocks: planBlocks(blocksOfItem, false),
          }));
          out.push({ kind: "list", items });
        } else if (b.type === "table") {
          const sep = { type: "raw", braille: profile.table.cellSeparator, spaceBefore: true, spaceAfter: true };
          const rows = b.rows.map((cells) => cells.flatMap((cell, i) => (i === 0 ? cell : [sep, ...cell])));
          out.push({ kind: "table", rows });
          stats.tables += 1;
        } else if (b.type === "figure") {
          if (b.decorative === true) { stats.decorativeSkipped += 1; continue; }
          figureNumber += 1;
          stats.figureNotes += 1;
          if (!includeTextInImage && b.textInImageInlines && b.textInImageInlines.length) stats.textInImageOmitted += 1;
          const inlines = figureNoteInlines(b, figureNumber, profile, includeTextInImage);
          if (!b.id) warnings.push(`Figure ${figureNumber} has no picture details, so its note holds only what the document says.`);
          out.push({ kind: "note", inlines });
        } else if (b.type === "code") {
          warnings.push("A block of code was laid out as plain paragraphs.");
          for (const line of String(b.text).split("\n")) {
            if (line.trim()) out.push({ kind: "paragraph", inlines: [{ type: "text", text: line.trim(), emphasis: [] }], quote });
          }
        } else if (b.type === "blockquote") out.push(...planBlocks(b.blocks, true));
        else {
          warnings.push(`A ${b.tag || "block"} element was kept as plain text.`);
          if (b.text) out.push({ kind: "paragraph", inlines: [{ type: "text", text: b.text, emphasis: [] }], quote });
        }
      }
      return out;
    };

    return planBlocks(tree.blocks || [], false);
  }

  function buildPrelim(profile, mathCode, date) {
    const T = (text) => ({ type: "paragraph", kind: "paragraph", quote: false, inlines: [{ type: "text", text, emphasis: [] }] });
    const lines = [...TEXTS.prelimLines.map(T)];
    lines.push(T(`${TEXTS.prelimProfile} ${profile.label}`), T(`${TEXTS.prelimMaths} ${mathCode}`), T(`${TEXTS.prelimDate} ${date}`));
    return lines;
  }

  // ============================================================================
  // COLLECT + TRANSLATE
  // ============================================================================

  function collectInlines(inlines, texts, maths, code, depthSafe) {
    for (const n of inlines) {
      if (n.type === "text") {
        const core = n.text.trim();
        if (n.text !== NEWLINE_TEXT && core) {
          const forms = formsOf(n.emphasis).forms;
          const signature = formSignature(forms);
          texts.set(runKey(core, signature), { text: core, forms, signature });
        }
      } else if (n.type === "math") {
        if (n.mathml) maths.add(n.mathml);
      } else if (n.type === "sub" || n.type === "sup") {
        const ml = subSupMathml(n);
        if (ml) maths.add(ml);
        else collectInlines(n.inlines || [], texts, maths, code, depthSafe);
      } else if (n.inlines) collectInlines(n.inlines, texts, maths, code, depthSafe);
    }
  }

  function collectPlan(plan, texts, maths, code) {
    for (const b of plan) {
      if (b.inlines) collectInlines(b.inlines, texts, maths, code);
      if (b.kind === "list") {
        for (const item of b.items) {
          collectInlines([item.marker], texts, maths, code);
          collectPlan(item.blocks, texts, maths, code);
        }
      }
      if (b.kind === "table") b.rows.forEach((row) => collectInlines(row, texts, maths, code));
    }
  }

  const caches = new WeakMap();
  const cacheFor = (tree) => {
    if (!caches.has(tree)) caches.set(tree, { text: new Map(), math: new Map() });
    return caches.get(tree);
  };

  /** Translate whatever the cache lacks: one call for the text, one for the maths. */
  async function translateMissing(engine, cache, texts, maths, grade, code, stats) {
    const missingText = [...texts.values()].filter((run) => !cache.text.has(textKey(grade, run.text, run.signature)));
    const missingMath = [...maths].filter((s) => !cache.math.has(mathKey(code, s)));
    if (missingText.length) {
      // A run with emphasis goes to the engine as { text, runs } covering the whole run; plain text goes as a string.
      const items = missingText.map((run) =>
        run.forms.length ? { text: run.text, runs: [{ start: 0, end: Array.from(run.text).length, forms: run.forms }] } : run.text
      );
      const res = await engine.translateText(items, { table: GRADES[grade] });
      missingText.forEach((run, i) => cache.text.set(textKey(grade, run.text, run.signature), res[i]));
      stats.textCalls += 1;
      stats.textTranslated += missingText.length;
    }
    if (missingMath.length) {
      const res = await engine.translateMath(missingMath, { code });
      missingMath.forEach((s, i) => cache.math.set(mathKey(code, s), res[i]));
      stats.mathCalls += 1;
      stats.mathTranslated += missingMath.length;
    }
  }

  /** The relation and operation sign patterns the engine itself produces, read from cached calibration results. */
  function signPatterns(cache, code) {
    const relations = [];
    const operations = [];
    for (const sign of RELATION_SIGNS) {
      const r = cache.math.get(mathKey(code, calibrationMathml(sign)));
      if (!r || !r.ok) continue;
      const mid = r.braille.split(BLANK)[1];
      if (mid) relations.push(mid);
    }
    for (const sign of OPERATION_SIGNS) {
      const r = cache.math.get(mathKey(code, calibrationMathml(sign)));
      if (!r || !r.ok || !r.braille.startsWith(CAL_FIRST_CELL)) continue;
      const tail = CAL_LAST_CELLS.find((c) => r.braille.endsWith(c));
      if (!tail) continue;
      const mid = r.braille.slice(1, r.braille.length - tail.length);
      if (mid && !mid.includes(BLANK)) operations.push(mid);
    }
    const byLength = (a, b) => b.length - a.length;
    return { relations: [...new Set(relations)].sort(byLength), operations: [...new Set(operations)].sort(byLength) };
  }

  const calibrationMathml = (sign) => mathmlOf(`<mi>a</mi><mo>${sign}</mo><mi>b</mi>`);

  // ============================================================================
  // TOKENS AND WORDS
  // ============================================================================

  /**
   * Walk an inline list into tokens: { braille, spaceBefore, kind } with kind text | math | raw | display | break.
   * Failed entries become FAILED_CELLS with a warning, never an exception.
   */
  function tokensOf(inlines, ctx, state) {
    const tokens = [];
    const walk = (list) => {
      for (const n of list) {
        if (n.type === "text") {
          if (n.text === NEWLINE_TEXT) { tokens.push({ kind: "break" }); state.pendingSpace = false; continue; }
          const core = n.text.trim();
          const leading = /^\s/.test(n.text);
          const trailing = /\s$/.test(n.text);
          if (!core) { if (n.text.length) state.pendingSpace = true; continue; }
          const emphasis = formsOf(n.emphasis);
          const r = ctx.cache.text.get(textKey(ctx.grade, core, formSignature(emphasis.forms)));
          let braille = FAILED_CELLS;
          if (r && r.ok) braille = r.braille;
          else { ctx.stats.failedText += 1; ctx.warnings.push("Some text could not be converted to braille and is marked with full cells."); }
          if (r && r.ok && emphasis.forms.length) ctx.stats.emphasisCarried += 1;
          if (emphasis.dropped) { ctx.stats.emphasisDropped += 1; ctx.warnings.push(WARNING_EMPHASIS); }
          tokens.push({ kind: "text", braille, spaceBefore: leading || state.pendingSpace });
          state.pendingSpace = trailing;
        } else if (n.type === "raw") {
          tokens.push({ kind: "raw", braille: n.braille, spaceBefore: n.spaceBefore === true || state.pendingSpace });
          state.pendingSpace = n.spaceAfter === true;
        } else if (n.type === "math" || n.type === "sub" || n.type === "sup") {
          const ml = n.type === "math" ? n.mathml : subSupMathml(n);
          if (!ml) {
            if (n.type === "math") { ctx.stats.failedMath += 1; ctx.warnings.push("Some maths could not be converted to braille and is marked with full cells."); tokens.push({ kind: "math", braille: FAILED_CELLS, spaceBefore: state.pendingSpace }); state.pendingSpace = false; }
            else walk(n.inlines || []);
            continue;
          }
          const r = ctx.cache.math.get(mathKey(ctx.code, ml));
          let braille = FAILED_CELLS;
          if (r && r.ok) braille = n.type === "math" ? r.braille : r.braille.replace(/^⠀+/, "");
          else { ctx.stats.failedMath += 1; ctx.warnings.push("Some maths could not be converted to braille and is marked with full cells."); }
          if (n.type === "math" && n.display) { tokens.push({ kind: "display", braille }); ctx.stats.mathDisplay += 1; state.pendingSpace = false; }
          else {
            tokens.push({ kind: "math", braille, spaceBefore: state.pendingSpace });
            state.pendingSpace = false;
            if (n.type === "math") ctx.stats.mathInline += 1;
            else ctx.stats.subSup += 1;
          }
        } else if (n.inlines) walk(n.inlines);
      }
    };
    walk(inlines);
    return tokens;
  }

  /** Group tokens into words. A token with no space before joins the word before it. Maths stays whole. */
  function wordsOf(tokens) {
    const words = [];
    let current = null;
    const startWord = () => { current = { text: "", mask: "", mathy: false }; words.push(current); };
    for (const t of tokens) {
      if (t.kind === "break" || t.kind === "display") continue;
      if (!current || t.spaceBefore) startWord();
      if (t.kind === "math") { current.text += t.braille; current.mask += MASK.MATHS.repeat(t.braille.length); current.mathy = true; continue; }
      const cellMask = t.kind === "raw" ? MASK.RAW : MASK.TEXT;
      const pieces = t.braille.split(BLANK);
      pieces.forEach((piece, i) => {
        if (i > 0) startWord();
        current.text += piece;
        current.mask += cellMask.repeat(piece.length);
      });
    }
    return words.filter((w) => w.text.length);
  }

  /** Split a token list into runs separated by display maths and hard breaks: [{ words, display?, hardBreak? }]. */
  function segmentsOf(tokens) {
    const segs = [];
    let run = [];
    const flush = () => { if (run.length) segs.push({ words: wordsOf(run) }); run = []; };
    for (const t of tokens) {
      if (t.kind === "display") { flush(); segs.push({ display: t.braille }); }
      else if (t.kind === "break") { flush(); segs.push({ hardBreak: true }); }
      else run.push(t);
    }
    flush();
    return segs;
  }

  // ============================================================================
  // MATHS BREAKS
  // ============================================================================

  function groupDepthAt(text, index) {
    let depth = 0;
    for (let i = 0; i < index; i++) {
      const c = text[i];
      const prev = text[i - 1];
      if (GROUP_OPEN.includes(c)) {
        if (c === "⠣" && prev === LESS_THAN_LEAD) continue;
        depth += 1;
      } else if (GROUP_CLOSE.includes(c)) depth = Math.max(0, depth - 1);
    }
    return depth;
  }

  /**
   * Break a long expression into lines. Rule order: a space before a relation sign; else a space or a point before an
   * operation sign; else the cell limit. The space at a break is dropped. Returns { lines, rules } (one rule per break).
   */
  function breakMaths(text, firstAvail, runAvail, patterns, stats, warnings, where) {
    const lines = [];
    const ranges = [];
    const rules = [];
    let start = 0;
    let first = true;
    while (text.length - start > (first ? firstAvail : runAvail)) {
      const avail = first ? firstAvail : runAvail;
      const limit = start + avail;
      let relation = -1;
      let other = -1;
      let otherIsPoint = false;
      for (let i = start + 1; i <= limit && i < text.length; i++) {
        if (text[i] === BLANK) {
          const rest = text.slice(i + 1);
          if (patterns.relations.some((p) => rest.startsWith(p))) relation = i;
          else other = i;
        } else if (patterns.operations.some((p) => text.startsWith(p, i)) && text[i - 1] !== BLANK && !NO_BREAK_AFTER.includes(text[i - 1]) && groupDepthAt(text, i) === 0 && i < limit) {
          other = i;
          otherIsPoint = true;
        }
      }
      let cut;
      let skip = 0;
      let rule;
      if (relation > start) { cut = relation; skip = 1; rule = BREAK_RULES.RELATION; }
      else if (other > start) { cut = other; skip = text[other] === BLANK ? 1 : 0; rule = BREAK_RULES.OPERATION; if (otherIsPoint) warnings.push("An expression was split before an operation sign with no space; a braille reader should check it."); }
      else { cut = limit; rule = BREAK_RULES.CELL_LIMIT; warnings.push("An expression had to be cut at the end of the line; a braille reader should check it."); }
      lines.push(text.slice(start, cut));
      ranges.push([start, cut]);
      rules.push(rule);
      stats.breaks[rule] += 1;
      stats.breakLog.push({ where, rule, exprCells: text.length, lineCells: cut - start });
      start = cut + skip;
      first = false;
    }
    lines.push(text.slice(start));
    ranges.push([start, text.length]);
    return { lines, ranges, rules };
  }

  // ============================================================================
  // LAYOUT
  // ============================================================================

  /** A laid-out line: its cells, and what each cell is (see MASK). */
  const lineOf = (text, mask) => ({ text, mask });
  const indentMask = (n) => MASK.SPACE.repeat(Math.max(0, n));

  function createLayout(profile, ctx, forcedKind) {
    const entries = [];
    let pendingBlank = 0;
    const cells = profile.cellsPerLine;
    let lastKind = null;
    let currentKind = LINE_KINDS.PARAGRAPH;

    const blank = (n) => { pendingBlank = Math.max(pendingBlank, n); };
    const flushBlank = () => {
      if (entries.length) for (let i = 0; i < pendingBlank; i++) entries.push({ text: "", mask: "", blank: true, kind: LINE_KINDS.BLANK });
      pendingBlank = 0;
    };
    /** `line` is a { text, mask } line, or a bare string for a line made only of text cells. */
    const emit = (line, opts) => {
      flushBlank();
      const text = typeof line === "string" ? line : line.text;
      const mask = typeof line === "string" ? MASK.TEXT.repeat(text.length) : line.mask;
      const kind = forcedKind || (opts && opts.kind) || currentKind;
      entries.push({ text, mask, kind, keepNext: !!(opts && opts.keepNext) });
    };

    /** Fill words into lines. Returns the lines (indent included) as { text, mask }. */
    function fill(words, firstCell, runCell, label) {
      const lines = [];
      let cur = "";
      let curMask = "";
      let indent = firstCell - 1;
      const push = () => { lines.push(lineOf(blanks(indent) + cur, indentMask(indent) + curMask)); cur = ""; curMask = ""; indent = runCell - 1; };
      for (const w of words) {
        const need = cur ? cur.length + 1 + w.text.length : w.text.length;
        if (indent + need <= cells) {
          cur = cur ? cur + BLANK + w.text : w.text;
          curMask = curMask ? curMask + MASK.SPACE + w.mask : w.mask;
          continue;
        }
        if (cur) push();
        if (indent + w.text.length <= cells) { cur = w.text; curMask = w.mask; continue; }
        // The word alone is longer than the line.
        let pieces;
        if (w.mathy) {
          const r = breakMaths(w.text, cells - indent, cells - (runCell - 1), ctx.patterns, ctx.stats, ctx.warnings, "inline");
          pieces = r.lines.map((t, i) => lineOf(t, w.mask.slice(r.ranges[i][0], r.ranges[i][1])));
        } else {
          pieces = [];
          let rest = w.text;
          let restMask = w.mask;
          let width = cells - indent;
          while (rest.length > width) {
            pieces.push(lineOf(rest.slice(0, width), restMask.slice(0, width)));
            rest = rest.slice(width);
            restMask = restMask.slice(width);
            width = cells - (runCell - 1);
          }
          pieces.push(lineOf(rest, restMask));
          ctx.stats.wordsCut += 1;
          ctx.warnings.push("A word was longer than a braille line and was cut at the end of the line.");
        }
        pieces.slice(0, -1).forEach((p) => { cur = p.text; curMask = p.mask; push(); });
        cur = pieces[pieces.length - 1].text;
        curMask = pieces[pieces.length - 1].mask;
      }
      if (cur) push();
      return lines;
    }

    function displayLines(text) {
      const d = profile.displayMaths;
      const r = breakMaths(text, cells - (d.first - 1), cells - (d.runover - 1), ctx.patterns, ctx.stats, ctx.warnings, "display");
      return r.lines.map((l, i) => {
        const indent = (i === 0 ? d.first : d.runover) - 1;
        return lineOf(blanks(indent) + l, indentMask(indent) + MASK.MATHS.repeat(l.length));
      });
    }

    function paragraphLike(inlines, firstCell, runCell, blankAround) {
      const tokens = tokensOf(inlines, ctx, { pendingSpace: false });
      const segs = segmentsOf(tokens);
      let first = true;
      if (blankAround) blank(blankAround.before || 0);
      for (const seg of segs) {
        if (seg.display !== undefined) {
          const d = profile.displayMaths;
          blank(d.blankBefore);
          displayLines(seg.display).forEach((l) => emit(l, { kind: LINE_KINDS.MATHS }));
          blank(d.blankAfter);
          first = false;
        } else if (seg.hardBreak) {
          first = false;
        } else {
          fill(seg.words, first ? firstCell : runCell, runCell).forEach((l) => emit(l));
          first = false;
        }
      }
      if (blankAround) blank(blankAround.after || 0);
    }

    function heading(b) {
      const forms = profile.headings;
      const maxRank = Math.max(...Object.keys(forms).map(Number));
      const form = forms[Math.min(b.rank, maxRank)];
      if (!(lastKind === "heading" && profile.blankLines.betweenHeadings === 0)) blank(form.blankBefore);
      const tokens = tokensOf(b.inlines, ctx, { pendingSpace: false });
      const words = segmentsOf(tokens).flatMap((s) => s.words || []);
      if (form.align === "centre") {
        const width = cells - 2 * form.margin;
        const lines = wrapPlain(words, width);
        lines.forEach((l, i) => {
          const pad = Math.floor((cells - l.text.length) / 2);
          emit(lineOf(blanks(pad) + l.text, indentMask(pad) + l.mask), { keepNext: i === lines.length - 1 });
        });
      } else {
        const lines = fill(words, form.first, form.runover);
        lines.forEach((l, i) => emit(l, { keepNext: i === lines.length - 1 }));
      }
      blank(profile.blankLines.afterHeading);
    }

    function wrapPlain(words, width) {
      const lines = [];
      let cur = "";
      let curMask = "";
      for (const w of words) {
        if (cur && cur.length + 1 + w.text.length > width) { lines.push(lineOf(cur, curMask)); cur = ""; curMask = ""; }
        cur = cur ? cur + BLANK + w.text : w.text;
        curMask = curMask ? curMask + MASK.SPACE + w.mask : w.mask;
        while (cur.length > width) {
          lines.push(lineOf(cur.slice(0, width), curMask.slice(0, width)));
          cur = cur.slice(width);
          curMask = curMask.slice(width);
        }
      }
      if (cur) lines.push(lineOf(cur, curMask));
      return lines;
    }

    function list(b, level) {
      const l = profile.list;
      const lv = Math.min(level, l.first.length - 1);
      if (level === 0) blank(l.blankBefore);
      for (const item of b.items) {
        item.blocks.forEach((blk, i) => {
          if (blk.kind === "paragraph" && i === 0) paragraphLike([item.marker, ...blk.inlines], l.first[lv], l.runover[lv]);
          else if (blk.kind === "list") list(blk, level + 1);
          else if (blk.kind === "paragraph") paragraphLike(blk.inlines, l.runover[lv], l.runover[lv]);
          else block(blk);
        });
        if (!item.blocks.length) paragraphLike([item.marker], l.first[lv], l.runover[lv]);
      }
      if (level === 0) blank(l.blankAfter);
    }

    function block(b) {
      const before = currentKind;
      currentKind = KIND_OF_BLOCK[b.kind] || LINE_KINDS.PARAGRAPH;
      try {
        blockInner(b);
      } finally {
        currentKind = before;
      }
      lastKind = b.kind;
    }

    function blockInner(b) {
      if (b.kind === "heading") heading(b);
      else if (b.kind === "paragraph") {
        const p = b.quote ? profile.blockquote : profile.paragraph;
        paragraphLike(b.inlines, p.first, p.runover);
        blank(profile.blankLines.betweenParagraphs);
      } else if (b.kind === "list") list(b, 0);
      else if (b.kind === "table") {
        const t = profile.table;
        blank(t.blankBefore);
        b.rows.forEach((row) => paragraphLike(row, t.first, t.runover));
        blank(t.blankAfter);
      } else if (b.kind === "note") {
        const n = profile.note;
        blank(n.blankBefore);
        paragraphLike(b.inlines, n.first, n.runover);
        blank(n.blankAfter);
      }
    }

    return { block, entries };
  }

  // ============================================================================
  // PAGES
  // ============================================================================

  function pageNumberCells(n) {
    return NUMERIC_INDICATOR + String(n).split("").map((d) => DIGIT_CELLS[Number(d)]).join("");
  }

  function paginate(entries, profile, firstNumber, numbered) {
    const rows = profile.linesPerPage - (numbered ? 1 : 0);
    const pages = [];
    let page = [];
    const closePage = () => {
      while (page.length && page[page.length - 1].blank) page.pop();
      pages.push(page.slice());
      page = [];
    };
    entries.forEach((e, i) => {
      if (page.length === 0 && e.blank) return;
      const lastRow = page.length === rows - 1;
      const hasMore = i < entries.length - 1;
      if (page.length >= rows || (lastRow && e.keepNext && hasMore)) closePage();
      if (page.length === 0 && e.blank) return;
      page.push(e);
    });
    if (page.length || !pages.length) closePage();
    // Each page is a list of entries { text, mask, kind }; the page number line is made here.
    return pages.map((entriesOnPage, i) => {
      if (!numbered) return entriesOnPage;
      const num = pageNumberCells(firstNumber + i);
      const pad = profile.cellsPerLine - num.length;
      const numEntry = { text: blanks(pad) + num, mask: indentMask(pad) + MASK.RAW.repeat(num.length), kind: LINE_KINDS.PAGE_NUMBER };
      if (profile.pageNumberPosition === "bottom-right") {
        const padded = entriesOnPage.slice();
        while (padded.length < profile.linesPerPage - 1) padded.push({ text: "", mask: "", kind: LINE_KINDS.BLANK });
        return [...padded, numEntry];
      }
      return [numEntry, ...entriesOnPage];
    });
  }

  // ============================================================================
  // PUBLIC: format
  // ============================================================================

  const newStats = () => ({
    pages: 0, lines: 0, maxLineLength: 0, mathInline: 0, mathDisplay: 0, subSup: 0, failedMath: 0, failedText: 0,
    textCalls: 0, mathCalls: 0, textTranslated: 0, mathTranslated: 0, figureNotes: 0, decorativeSkipped: 0, tables: 0,
    emphasisCarried: 0, emphasisDropped: 0, textInImageOmitted: 0, wordsCut: 0,
    linesByKind: Object.fromEntries(Object.values(LINE_KINDS).map((k) => [k, 0])),
    breaks: { relation: 0, operation: 0, "cell-limit": 0 }, breakLog: [], warnings: [], warningTotal: 0,
  });

  const todayIso = () => new Date().toISOString().slice(0, 10);

  /**
   * Lay the tree out as braille pages.
   * @param {object} tree - a MathPixDocumentTree tree
   * @param {object} options - { profile: "aba" | "ukaaf" | object, mathCode: "UEB" | "Nemeth", grade: "g2" | "g1", date?, engine?,
   *   includeTextInImage?: boolean (default true; false leaves the text-in-the-image part out of every figure note) }
   * @returns {Promise<{ok:true,pages:string[][],masks:string[][],warnings:string[],stats:object,profile:string,mathCode:string,grade:string}|{ok:false,reason:string}>}
   *   `masks` holds, for every cell of every page line, t (text), m (maths), r (indicator or number) or s (space); it is also
   *   attached to `pages` (not enumerable) so toProof(pages, engine) can tell maths from text.
   */
  async function format(tree, options = {}) {
    if (!tree || !Array.isArray(tree.blocks)) return refusal(REASONS.noTree);
    const profile = resolveProfile(options.profile);
    if (!profile) return refusal(REASONS.badProfile);
    const mathCode = options.mathCode || MATH_CODES.UEB;
    if (!Object.values(MATH_CODES).includes(mathCode)) return refusal(REASONS.badMathCode);
    const grade = options.grade || DEFAULT_GRADE;
    if (!GRADES[grade]) return refusal(REASONS.badGrade);
    const engine = options.engine || window.MathPixBrailleEngine;
    if (!engine) return refusal(REASONS.noEngine);

    try {
      const ready = await engine.ensureReady();
      if (!ready || !ready.ok) return refusal((ready && ready.reason) || REASONS.failed);

      const warnings = [];
      const stats = newStats();
      const date = options.date || todayIso();
      const includeTextInImage = options.includeTextInImage !== false;
      const plan = buildPlan(tree, profile, warnings, stats, includeTextInImage);
      const prelim = profile.preliminaryPage ? buildPrelim(profile, mathCode, date) : [];

      const texts = new Map();
      const maths = new Set();
      collectPlan(plan, texts, maths, mathCode);
      collectPlan(prelim, texts, maths, mathCode);
      [...RELATION_SIGNS, ...OPERATION_SIGNS].forEach((s) => maths.add(calibrationMathml(s)));

      const cache = cacheFor(tree);
      await translateMissing(engine, cache, texts, maths, grade, mathCode, stats);
      const patterns = signPatterns(cache, mathCode);

      const ctx = { cache, grade, code: mathCode, stats, warnings, patterns };

      const laidOut = [];
      if (prelim.length) {
        const layout = createLayout(profile, ctx, LINE_KINDS.PRELIMINARY);
        prelim.forEach((b) => layout.block(b));
        laidOut.push(...paginate(layout.entries, profile, 1, false));
      }
      const body = createLayout(profile, ctx);
      plan.forEach((b) => body.block(b));
      laidOut.push(...paginate(body.entries, profile, 1, true));

      const pages = laidOut.map((page) => page.map((e) => e.text));
      const masks = laidOut.map((page) => page.map((e) => e.mask));
      // Attached, not enumerable, so toProof(pages, engine) can tell maths from text without a third argument.
      Object.defineProperty(pages, "masks", { value: masks });
      Object.defineProperty(pages, "grade", { value: grade });
      Object.defineProperty(pages, "profile", { value: profile.name });

      stats.pages = pages.length;
      laidOut.forEach((page) => page.forEach((e) => {
        stats.lines += 1;
        stats.maxLineLength = Math.max(stats.maxLineLength, e.text.length);
        stats.linesByKind[e.kind] += 1;
      }));
      const uniqueWarnings = [...new Set(warnings)];
      stats.warnings = uniqueWarnings;
      stats.warningTotal = warnings.length;
      logInfo("Formatted", { profile: profile.name, pages: stats.pages });
      return { ok: true, pages, masks, warnings: uniqueWarnings, stats, profile: profile.name, mathCode, grade };
    } catch (e) {
      logError("format failed", e);
      logDebug("format failure detail", String((e && e.message) || e).slice(0, 200));
      return refusal(REASONS.failed);
    }
  }

  // ============================================================================
  // PUBLIC: writers
  // ============================================================================

  /**
   * Braille ASCII file text. UKAAF B010 (Reading Electronic Braille, BRF Files): characters ASCII 33 to 95 and space,
   * "Carriage Return + Line Feed (ASCII 13+10): represents start of new line", "Form Feed (ASCII 12): begins a new page".
   * Every line ends CRLF; one form feed sits between pages (none after the last).
   */
  function toBRF(pages, engine) {
    const eng = engine || window.MathPixBrailleEngine;
    return pages.map((lines) => lines.map((l) => eng.toBrailleAscii(l) + CRLF).join("")).join(FORM_FEED);
  }

  /**
   * Unicode braille text. LF line endings. pageSeparator "formfeed" (default) puts one form feed between pages;
   * "blank" puts one empty line there instead, for a display that does not treat a form feed as a break.
   */
  function toUnicodeText(pages, options = {}) {
    const sep = options.pageSeparator === "blank" ? "\n" : FORM_FEED;
    return pages.map((lines) => lines.map((l) => l + "\n").join("")).join(sep);
  }

  // ============================================================================
  // PUBLIC: proof writer (BR-3c)
  // ============================================================================

  const PROOF = Object.freeze({
    page: "Braille page",
    warnings: "Warnings",
    textFailed: "[text could not be shown]",
    pageNumber: "[braille page number",
    other: "[braille:",
    bullet: "[bullet]",
    noteStart: "[transcriber's note start]",
    noteEnd: "[transcriber's note end]",
    tableSeparator: "[table cell separator]",
  });

  /** Page-number cells back to a number, or null when the run is not a numeric indicator and digits. */
  function decodePageNumber(cells) {
    if (!cells.startsWith(NUMERIC_INDICATOR) || cells.length < 2) return null;
    let n = "";
    for (const c of cells.slice(1)) {
      const d = DIGIT_CELLS.indexOf(c);
      if (d < 0) return null;
      n += String(d);
    }
    return n;
  }

  /** A line's cells as runs of one class each. A space inside a run stays in it; a space between two runs becomes one separator. */
  function runsOfLine(text, mask) {
    const runs = [];
    let current = null;
    let pendingSpaces = "";
    for (let i = 0; i < text.length; i++) {
      const cls = mask[i] || MASK.TEXT;
      if (cls === MASK.SPACE) { if (current) pendingSpaces += text[i]; continue; }
      if (current && current.cls === cls) { current.cells += pendingSpaces + text[i]; pendingSpaces = ""; continue; }
      const joined = !!current && pendingSpaces === ""; // two runs with no space between them stay joined in the proof
      if (current) runs.push(current);
      current = { cls, cells: text[i], joined };
      pendingSpaces = "";
    }
    if (current) runs.push(current);
    return runs;
  }

  /**
   * The proof file: each braille page as "Braille page N" (N is the page's place in the file, the unnumbered preliminary page
   * being 1), then its lines turned back into print with the same table, for a sighted person to check. Text is
   * back-translated; maths is NEVER guessed (the maths engine has no back-translation): it appears as
   * "[maths: N cells, untranslated]" followed by its braille cells. Plain text, LF line endings.
   * @param {string[][]} pages - the pages from format() (carries masks)
   * @param {object} [engine] - defaults to window.MathPixBrailleEngine
   * @param {{warnings?: string[]}} [options] - warnings are listed at the end of the file
   * @returns {Promise<string>}
   */
  async function toProof(pages, engine, options = {}) {
    const eng = engine || window.MathPixBrailleEngine;
    const masks = pages.masks || null;
    const table = GRADES[pages.grade] || GRADES[DEFAULT_GRADE];
    const lineRuns = pages.map((page, p) => page.map((line, l) => runsOfLine(line, masks && masks[p] ? masks[p][l] : MASK.TEXT.repeat(line.length))));

    const spans = new Set();
    lineRuns.forEach((page) => page.forEach((runs) => runs.forEach((run) => { if (run.cls === MASK.TEXT) spans.add(run.cells); })));
    const spanList = [...spans];
    const back = spanList.length ? await eng.backTranslateText(spanList, { table, forms: true }) : [];
    const printOf = new Map(spanList.map((s, i) => [s, back[i] && back[i].ok ? back[i].braille.trim() : PROOF.textFailed]));

    // The indicators the layout wrote itself, named so a sighted checker can read them.
    const profile = profiles[pages.profile];
    const named = new Map([[BULLET_CELLS, PROOF.bullet]]);
    if (profile) {
      named.set(cellAscii(profile.note.open), PROOF.noteStart);
      named.set(cellAscii(profile.note.close), PROOF.noteEnd);
      named.set(profile.table.cellSeparator, PROOF.tableSeparator);
    }

    const render = (run) => {
      if (run.cls === MASK.TEXT) return printOf.get(run.cells);
      if (run.cls === MASK.MATHS) return `[maths: ${run.cells.length} cells, untranslated] ${run.cells}`;
      if (named.has(run.cells)) return named.get(run.cells);
      const n = decodePageNumber(run.cells);
      return n !== null ? `${PROOF.pageNumber} ${n}]` : `${PROOF.other} ${run.cells}]`;
    };
    // A run with no space before it stays joined to the one before, except beside an indicator, which is always set apart to read.
    const renderLine = (runs) =>
      runs.reduce((line, run, i) => line + (i > 0 && (!run.joined || run.cls === MASK.RAW || runs[i - 1].cls === MASK.RAW) ? " " : "") + render(run), "");

    const out = [];
    lineRuns.forEach((page, p) => {
      if (p > 0) out.push("");
      out.push(`${PROOF.page} ${p + 1}`);
      page.forEach((runs) => out.push(renderLine(runs)));
    });
    const warnings = Array.isArray(options.warnings) ? options.warnings : [];
    if (warnings.length) {
      out.push("", PROOF.warnings);
      warnings.forEach((w) => out.push(`- ${w}`));
    }
    return out.join("\n") + "\n";
  }

  window.MathPixBrailleFormatter = Object.freeze({
    format, toBRF, toUnicodeText, toProof, profiles, differingKeys, draftKeys, BREAK_RULES, REASONS, version: "1.1.0",
  });
  logInfo("MathPixBrailleFormatter registered (calls the engine only when format() runs)");
})();
