/**
 * @fileoverview LaTeX tabular to pipe table converter for MathPix Markdown.
 * @module MathPixTableConvert
 * @version 1.0.0
 * @since MathPix AI lane, parcel M-3
 *
 * Pure string parsing: no DOM, no network, no API calls. It is adopted nowhere:
 * no <script> tag loads it and no caller exists (parcel M-3 builds it only).
 * It runs only when a person chooses it; the engine prompt's rule against
 * converting tables binds the engine, not this.
 *
 * A pipe table must have a header row, so convert() never invents one. The
 * person either makes row 1 the header or types a heading for each column.
 *
 * CELL CONTENT RULE. Every cell is copied byte for byte from the LaTeX source,
 * with exactly two changes:
 *   1. outer whitespace is trimmed;
 *   2. each bare "|" becomes "\|", so it cannot split the pipe-table row.
 * Everything else stays as written: inline maths, \text{}, "\&" and other
 * escapes. \hline and \cline at the start of a row are dropped, and the
 * column spec's "|" borders are dropped (a pipe table cannot draw them).
 *
 * Anything the converter cannot carry over faithfully is REFUSED with a reason
 * a person can read: \multicolumn, \multirow, a nested tabular, a row with the
 * wrong number of cells, a line break inside a cell, a cell that runs over two
 * source lines, a paragraph column (p, m, b), an unknown column type, "\|" (a
 * maths double bar, which a pipe table would read as an escaped pipe), an "&"
 * inside maths or braces, a "%" comment, a rule in the middle of a row, and an
 * unclosed brace or "$".
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
      console.error(`[TableConvert] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TableConvert] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TableConvert] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TableConvert] ${message}`, ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  const ALIGN_MARKERS = Object.freeze({ l: ":--", c: ":-:", r: "--:" });

  const BEGIN_TABULAR = "\\begin{tabular}";
  const END_TABULAR = "\\end{tabular}";

  const REASONS = Object.freeze({
    NOT_TEXT: "There is no table text to convert.",
    NOT_A_TABULAR:
      "Pass the table itself, from \\begin{tabular} to \\end{tabular}.",
    NO_SPEC: "This table has no column list after \\begin{tabular}.",
    UNCLOSED: "This table has no \\end{tabular}, so where it ends is unclear.",
    NESTED:
      "This table has another table inside it. A simple table cannot hold a table in a cell.",
    MULTICOLUMN:
      "This table has a cell that spans several columns (\\multicolumn). A simple table cannot merge cells.",
    MULTIROW:
      "This table has a cell that spans several rows (\\multirow). A simple table cannot merge cells.",
    PARAGRAPH_COLUMN:
      "This table has a paragraph column (p, m or b). A simple table cannot keep its line wrapping.",
    UNKNOWN_COLUMN: (token) =>
      `This table's column list uses "${token}", which this converter does not understand.`,
    NO_COLUMNS: "This table's column list has no columns.",
    MULTILINE_CELL:
      "This table has a cell with a line break inside it. A simple table cell holds one line.",
    CELL_SPANS_LINES:
      "A cell runs over two lines of the source. Joining them would change its text, so this table is left as it is.",
    RAGGED: (row, found, expected) =>
      `Row ${row} has ${found} cells, but the table has ${expected} columns.`,
    AMPERSAND_IN_GROUP:
      "A cell has an & inside maths or braces, so the converter cannot tell where the columns split.",
    DOUBLE_BAR:
      "A cell contains \\|, a double bar in maths. A simple table uses | to split columns, and this converter cannot yet keep \\| safe there.",
    COMMENT:
      "A cell has a % comment in it. The converter cannot tell which text the comment hides.",
    MID_ROW_RULE:
      "A line rule (\\hline or \\cline) sits in the middle of a row. The converter cannot tell what it was for.",
    UNBALANCED:
      "This table has an unclosed brace or $ sign, so its cells cannot be read safely.",
    NO_ROWS: "This table has no rows.",
    NO_HEADER:
      "Choose a header row: use the first row as the header, or type a heading for each column. A simple table must have a header row, and a blank one does not tell a screen reader user what each column holds.",
    BOTH_HEADERS:
      "Choose one header: the first row, or your own headings, not both.",
    HEADER_LENGTH: (typed, columns) =>
      `You typed ${typed} headings, but the table has ${columns} columns. Type one heading for each column.`,
    HEADER_NOT_TEXT: (column) => `Heading ${column} must be text.`,
    HEADER_LINE_BREAK: (column) =>
      `Heading ${column} has a line break. A heading must be one line.`,
    BLANK_HEADER: (column) =>
      `Heading ${column} is blank. Every column needs a heading a screen reader can announce.`,
    INTERNAL:
      "Something went wrong converting this table, so it is left as it is.",
  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /** Replace every character except newlines with a space, keeping offsets. */
  function blank(segment) {
    return segment.replace(/[^\n]/g, " ");
  }

  /** Blank fenced and inline code so a tabular shown as code is not found. */
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

  /** Skip spaces and tabs (not newlines) from index i. */
  function skipSpaces(text, i) {
    while (i < text.length && (text[i] === " " || text[i] === "\t")) i++;
    return i;
  }

  /** The one place a cell is changed: each bare "|" becomes "\|". */
  function escapeCell(cell) {
    return cell.replace(/\|/g, "\\|");
  }

  function refuse(reason) {
    return { ok: false, reason };
  }

  // ==========================================================================
  // COLUMN SPEC
  // ==========================================================================

  /**
   * Read a column spec such as "lcc" or "|c|c|c|".
   * @returns {{count: number, aligns: string[]|null, reason: string|null}}
   *   count includes p/m/b columns so a refused table still reports its width.
   */
  function parseSpec(spec) {
    const aligns = [];
    let count = 0;
    let reason = null;

    let i = 0;
    while (i < spec.length) {
      const ch = spec[i];

      if (/\s/.test(ch) || ch === "|") {
        i++;
        continue;
      }

      if (ch === "l" || ch === "c" || ch === "r") {
        aligns.push(ch);
        count++;
        i++;
        continue;
      }

      if (ch === "p" || ch === "m" || ch === "b") {
        count++;
        reason = reason || REASONS.PARAGRAPH_COLUMN;
        const open = spec.indexOf("{", i);
        const close = open === -1 ? -1 : matchGroup(spec, open);
        i = close === -1 ? spec.length : close + 1;
        continue;
      }

      // @{} with nothing in it only removes padding, so dropping it is safe.
      // Anything inside @{...} or !{...} is text between columns: refuse.
      if (ch === "@" || ch === "!") {
        const open = skipSpaces(spec, i + 1);
        const close = spec[open] === "{" ? matchGroup(spec, open) : -1;
        if (close === -1 || spec.slice(open + 1, close).trim() !== "") {
          reason = reason || REASONS.UNKNOWN_COLUMN(ch);
          i = close === -1 ? i + 1 : close + 1;
        } else {
          i = close + 1;
        }
        continue;
      }

      reason = reason || REASONS.UNKNOWN_COLUMN(ch);
      i++;
    }

    if (count === 0) reason = reason || REASONS.NO_COLUMNS;
    return { count, aligns: reason ? null : aligns, reason };
  }

  // ==========================================================================
  // TABULAR BODY
  // ==========================================================================

  /**
   * Read the head of a tabular: \begin{tabular}, optional [pos], then {spec}.
   * @returns {{spec: string, bodyStart: number}|{reason: string}}
   */
  function readHead(src, beginIndex) {
    let i = skipSpaces(src, beginIndex + BEGIN_TABULAR.length);
    if (src[i] === "[") {
      const close = src.indexOf("]", i);
      if (close === -1) return { reason: REASONS.NO_SPEC };
      i = skipSpaces(src, close + 1);
    }
    if (src[i] !== "{") return { reason: REASONS.NO_SPEC };
    const close = matchGroup(src, i);
    if (close === -1) return { reason: REASONS.NO_SPEC };
    return { spec: src.slice(i + 1, close), bodyStart: close + 1 };
  }

  /** Read a command name (letters) starting at index i, after the backslash. */
  function commandName(text, i) {
    let j = i;
    while (j < text.length && /[A-Za-z]/.test(text[j])) j++;
    return text.slice(i, j);
  }

  /**
   * Split a tabular body into rows of raw cells.
   * @returns {{rows: string[][]}|{reason: string}}
   */
  function splitBody(body) {
    const rows = [];
    let row = [];
    let cell = "";
    let depth = 0;
    let maths = null; // null, "$", "$$", "\\(" or "\\["
    let ruleAllowed = true; // true until the row has content

    const endCell = () => {
      row.push(cell);
      cell = "";
    };

    let i = 0;
    while (i < body.length) {
      const c = body[i];
      const next = body[i + 1];

      if (c === "\\") {
        if (next === "\\") {
          if (depth !== 0 || maths) return { reason: REASONS.MULTILINE_CELL };
          endCell();
          rows.push(row);
          row = [];
          ruleAllowed = true;
          i += 2;
          continue;
        }

        if (next === "|") return { reason: REASONS.DOUBLE_BAR };

        // Maths delimiters \( \) \[ \]
        if ((next === "(" || next === "[") && !maths) {
          maths = `\\${next}`;
        } else if (
          (next === ")" && maths === "\\(") ||
          (next === "]" && maths === "\\[")
        ) {
          maths = null;
        }

        if (next !== undefined && /[A-Za-z]/.test(next)) {
          const name = commandName(body, i + 1);
          if (name === "multicolumn") return { reason: REASONS.MULTICOLUMN };
          if (name === "multirow") return { reason: REASONS.MULTIROW };
          if (name === "newline") return { reason: REASONS.MULTILINE_CELL };
          if (name === "begin" && body.startsWith("{tabular}", i + 6)) {
            return { reason: REASONS.NESTED };
          }

          if (name === "hline" || name === "cline") {
            const onlySpaceSoFar = cell.trim() === "" && row.length === 0;
            if (!ruleAllowed || !onlySpaceSoFar || depth !== 0 || maths) {
              return { reason: REASONS.MID_ROW_RULE };
            }
            // Drop the rule (and \cline's {a-b} argument), keep what came before.
            let j = i + 1 + name.length;
            if (name === "cline") {
              const open = skipSpaces(body, j);
              const close = body[open] === "{" ? matchGroup(body, open) : -1;
              if (close === -1) return { reason: REASONS.UNBALANCED };
              j = close + 1;
            }
            i = j;
            continue;
          }

          cell += body.slice(i, i + 1 + name.length);
          i += 1 + name.length;
          ruleAllowed = false;
          continue;
        }

        // Any other escape (\& \{ \$ \% \_ \( ...) is copied as written.
        cell += body.slice(i, i + 2);
        i += 2;
        ruleAllowed = false;
        continue;
      }

      if (c === "%") return { reason: REASONS.COMMENT };

      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth < 0) return { reason: REASONS.UNBALANCED };
      } else if (c === "$") {
        if (next === "$") {
          if (maths === "$$") maths = null;
          else if (!maths) maths = "$$";
          else return { reason: REASONS.UNBALANCED };
          cell += "$$";
          i += 2;
          ruleAllowed = false;
          continue;
        }
        if (maths === "$") maths = null;
        else if (!maths) maths = "$";
        else return { reason: REASONS.UNBALANCED };
      } else if (c === "&") {
        if (depth !== 0 || maths) return { reason: REASONS.AMPERSAND_IN_GROUP };
        endCell();
        ruleAllowed = false;
        i++;
        continue;
      }

      cell += c;
      if (!/\s/.test(c)) ruleAllowed = false;
      i++;
    }

    if (depth !== 0 || maths) return { reason: REASONS.UNBALANCED };

    endCell();
    rows.push(row);

    // The text after the last \\ is usually empty (or only a dropped \hline).
    const last = rows[rows.length - 1];
    if (last.length === 1 && last[0].trim() === "") rows.pop();

    return { rows };
  }

  /**
   * Read a whole tabular source into aligned, trimmed rows.
   * @returns {{ok: true, aligns: string[], rows: string[][]}|{ok: false, reason: string, columns?: number}}
   */
  function analyse(source) {
    if (typeof source !== "string" || source.trim() === "") {
      return refuse(REASONS.NOT_TEXT);
    }

    const src = source.trim();
    if (!src.startsWith(BEGIN_TABULAR)) return refuse(REASONS.NOT_A_TABULAR);

    const head = readHead(src, 0);
    if (head.reason) return refuse(head.reason);

    const spec = parseSpec(head.spec);

    // The source must end at the matching \end{tabular}.
    const ends = findEnvironments(src);
    if (ends.length === 0 || ends[0].end === -1) {
      return { ...refuse(REASONS.UNCLOSED), columns: spec.count };
    }
    if (ends.length !== 1 || ends[0].end !== src.length) {
      return { ...refuse(REASONS.NOT_A_TABULAR), columns: spec.count };
    }
    if (ends[0].nested) return { ...refuse(REASONS.NESTED), columns: spec.count };
    if (spec.reason) return { ...refuse(spec.reason), columns: spec.count };

    const body = src.slice(head.bodyStart, src.length - END_TABULAR.length);
    const split = splitBody(body);
    if (split.reason) return { ...refuse(split.reason), columns: spec.count };

    const rows = split.rows.map((r) => r.map((cell) => cell.trim()));
    if (rows.length === 0) return { ...refuse(REASONS.NO_ROWS), columns: spec.count };

    for (const r of rows) {
      if (r.some((cell) => /[\r\n]/.test(cell))) {
        return { ...refuse(REASONS.CELL_SPANS_LINES), columns: spec.count };
      }
    }
    for (let n = 0; n < rows.length; n++) {
      if (rows[n].length !== spec.count) {
        return {
          ...refuse(REASONS.RAGGED(n + 1, rows[n].length, spec.count)),
          columns: spec.count,
        };
      }
    }

    return { ok: true, aligns: spec.aligns, rows };
  }

  // ==========================================================================
  // FINDING TABULARS
  // ==========================================================================

  /**
   * Top-level \begin{tabular}…\end{tabular} pairs, with nesting noted.
   * @returns {Array<{start: number, end: number, nested: boolean}>} end is -1 if unclosed
   */
  function findEnvironments(text) {
    const found = [];
    const token = /\\(begin|end)\{tabular\}/g;
    let depth = 0;
    let current = null;
    let m;
    while ((m = token.exec(text)) !== null) {
      if (m[1] === "begin") {
        depth++;
        if (depth === 1) current = { start: m.index, end: -1, nested: false };
        else current.nested = true;
      } else if (depth > 0) {
        depth--;
        if (depth === 0) {
          current.end = m.index + m[0].length;
          found.push(current);
          current = null;
        }
      }
    }
    if (current) found.push(current);
    return found;
  }

  /** Top-level \begin{table}…\end{table} ranges (the float wrapper). */
  function findTableWrappers(text) {
    const found = [];
    const token = /\\(begin|end)\{table\*?\}/g;
    let depth = 0;
    let start = -1;
    let m;
    while ((m = token.exec(text)) !== null) {
      if (m[1] === "begin") {
        if (depth === 0) start = m.index;
        depth++;
      } else if (depth > 0) {
        depth--;
        if (depth === 0) found.push({ start, end: m.index + m[0].length });
      }
    }
    return found;
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Find every LaTeX tabular in a MathPix Markdown text, wrapped in
   * \begin{table} or not. Tabulars inside code are skipped.
   *
   * @param {string} mmd - MathPix Markdown text
   * @returns {Array<{start: number, end: number, line: number, columns: number|null,
   *   convertible: boolean, reason: string|null, wrapper: {start: number, end: number}|null}>}
   *   start/end are character offsets of the tabular itself (end exclusive).
   */
  function findTabulars(mmd) {
    if (typeof mmd !== "string" || mmd === "") return [];
    try {
      const code = stripCode(mmd);
      const wrappers = findTableWrappers(code);

      return findEnvironments(code).map((env) => {
        const end = env.end === -1 ? mmd.length : env.end;
        const wrapper =
          wrappers.find((w) => w.start <= env.start && w.end >= end) || null;
        const result =
          env.end === -1
            ? { ...refuse(REASONS.UNCLOSED), columns: null }
            : analyse(mmd.slice(env.start, end));

        const head = readHead(mmd, env.start);
        const columns = head.reason ? null : parseSpec(head.spec).count;

        return {
          start: env.start,
          end,
          line: lineAt(mmd, env.start),
          columns,
          convertible: result.ok === true,
          reason: result.ok ? null : result.reason,
          wrapper,
        };
      });
    } catch (error) {
      logError("findTabulars failed", error);
      return [];
    }
  }

  /**
   * Convert one LaTeX tabular to a pipe table. Never throws.
   *
   * Cell content is kept byte for byte, except that outer whitespace is
   * trimmed and each bare "|" becomes "\|" (see the file header).
   *
   * @param {string} tabularSource - from \begin{tabular} to \end{tabular}
   * @param {{firstRowIsHeader: boolean, headerCells?: string[]}} options
   *   firstRowIsHeader true: row 1 becomes the header.
   *   false with headerCells: the person's own headings, one per column.
   *   false with no headerCells: refused, because a pipe table needs a header
   *   row and a blank one is not accessible.
   * @returns {{ok: true, markdown: string}|{ok: false, reason: string}}
   */
  function convert(tabularSource, options) {
    try {
      const table = analyse(tabularSource);
      if (!table.ok) return refuse(table.reason);

      const opts = options || {};
      const ownHeader = opts.headerCells !== undefined && opts.headerCells !== null;
      const columns = table.aligns.length;

      let header;
      let body;
      if (opts.firstRowIsHeader === true) {
        if (ownHeader) return refuse(REASONS.BOTH_HEADERS);
        header = table.rows[0];
        body = table.rows.slice(1);
      } else if (ownHeader) {
        if (!Array.isArray(opts.headerCells)) return refuse(REASONS.HEADER_NOT_TEXT(1));
        if (opts.headerCells.length !== columns) {
          return refuse(REASONS.HEADER_LENGTH(opts.headerCells.length, columns));
        }
        for (let n = 0; n < columns; n++) {
          const cell = opts.headerCells[n];
          if (typeof cell !== "string") return refuse(REASONS.HEADER_NOT_TEXT(n + 1));
          if (/[\r\n]/.test(cell.trim())) return refuse(REASONS.HEADER_LINE_BREAK(n + 1));
        }
        header = opts.headerCells.map((cell) => cell.trim());
        body = table.rows;
      } else {
        return refuse(REASONS.NO_HEADER);
      }

      for (let n = 0; n < columns; n++) {
        if (header[n] === "") return refuse(REASONS.BLANK_HEADER(n + 1));
      }

      const line = (cells) => `| ${cells.map(escapeCell).join(" | ")} |`;
      const separator = `| ${table.aligns.map((a) => ALIGN_MARKERS[a]).join(" | ")} |`;
      const markdown = [line(header), separator, ...body.map(line)].join("\n");

      logDebug(`convert: ${columns} columns, ${body.length} body rows`);
      return { ok: true, markdown };
    } catch (error) {
      logError("convert failed", error);
      return refuse(REASONS.INTERNAL);
    }
  }

  window.MathPixTableConvert = { findTabulars, convert };

  logInfo("MathPixTableConvert loaded");
})();
