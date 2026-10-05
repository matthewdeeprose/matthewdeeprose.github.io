/**
 * Graph Builder Image Reply
 * Turns a vision model's reply to the image-to-table prompt into either a checked table or a refusal.
 * Pure functions: no DOM, no network, no other Graph Builder file. Nothing calls it yet (parcel B-1).
 *
 * Contract it reads: md-scripts/charts/prompts/image-to-table.txt
 *
 * @version 1.0.0
 */

const GraphBuilderImageReply = (function () {
  "use strict";

  // Logging configuration (inside module scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Current logging level
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  /**
   * Check if logging should occur for given level
   * @param {number} level - Log level to check
   * @returns {boolean} Whether logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log error message
   * @param {string} message - Message to log
   */
  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Graph Builder Image Reply] ERROR: ${message}`);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Message to log
   */
  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Graph Builder Image Reply] WARN: ${message}`);
    }
  }

  /**
   * Log info message
   * @param {string} message - Message to log
   */
  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Graph Builder Image Reply] INFO: ${message}`);
    }
  }

  /**
   * Log debug message
   * @param {string} message - Message to log
   */
  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Graph Builder Image Reply] DEBUG: ${message}`);
    }
  }

  // ============================================
  // CONSTANTS
  // ============================================

  /** Why a reply was refused. `parse` returns one of these in `reason` when `ok` is false. */
  const REASON = Object.freeze({
    TRUNCATED: "truncated",
    NOT_JSON: "not-json",
    NOT_OBJECT: "not-object",
    STATUS_MISSING: "status-missing",
    STATUS_UNKNOWN: "status-unknown",
    STATUS_UNSUPPORTED: "status-unsupported",
    STATUS_INSUFFICIENT: "status-insufficient-information",
    TABLE_MISSING: "table-missing",
    TABLE_SHAPE: "table-shape",
    TOO_FEW_COLUMNS: "too-few-columns",
    ROW_LENGTH: "row-length",
    NO_ROWS: "no-rows",
    BAD_LABEL: "bad-label",
  });

  /** What was repaired in a reply that was still accepted. */
  const WARNING_CODE = Object.freeze({
    NON_NUMERIC_CELL: "non-numeric-cell",
    NUMERIC_LABEL: "numeric-label",
    UNKNOWN_TYPE: "unknown-suggested-type",
    UNKNOWN_FAMILY: "unknown-chart-family",
    BAD_TITLE: "bad-title",
    BAD_VALUE_AXIS: "bad-value-axis",
    BAD_ISSUE: "bad-issue",
    BAD_ISSUES: "bad-issues-list",
    BAD_STACKED: "bad-stacked",
    BAD_ORIENTATION: "bad-orientation",
    UNEXPECTED_KEY: "unexpected-key",
  });

  const STATUS = Object.freeze({
    OK: "ok",
    APPROXIMATE: "approximate",
    UNSUPPORTED: "unsupported",
    INSUFFICIENT: "insufficient_information",
  });
  const KNOWN_STATUSES = Object.freeze(Object.values(STATUS));

  // Graph Builder's nine chart types (md-scripts/charts/graph-builder-ui.js selectChartType buttons).
  const CHART_TYPES = Object.freeze(["bar", "line", "combo", "pie", "doughnut", "scatter", "bubble", "radar", "polarArea"]);
  const CHART_FAMILIES = Object.freeze(["area", "bar", "bubble", "doughnut", "pie", "line", "mixed", "polarArea", "radar", "scatter"]);
  const ISSUE_KINDS = Object.freeze(["estimate", "missing", "ambiguity", "limitation", "unsupported"]);
  const CONTRACT_KEYS = Object.freeze(["status", "chartFamily", "suggestedType", "orientation", "stacked", "title", "valueAxis", "table", "issues"]);

  // Column roles and types as js/graph-builder-column-manager.js uses them
  // (validateConfiguration / getCompatibleChartTypes read "label", "value", "radius").
  const COLUMN_ROLE = Object.freeze({ LABEL: "label", VALUE: "value", RADIUS: "radius" });
  const COLUMN_TYPE = Object.freeze({ TEXT: "text", NUMBER: "number" });

  const ORIENTATIONS = Object.freeze(["vertical", "horizontal"]);

  const BUBBLE_TYPE = "bubble";
  const BUBBLE_RADIUS_HEADER = "r";
  const FINISH_LENGTH = "length";
  const MIN_COLUMNS = 2;

  // One surrounding Markdown fence, with or without a language tag.
  const FENCE = /^```[A-Za-z]*[ \t]*\n([\s\S]*?)\n?```$/;

  const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const isNumber = (v) => typeof v === "number" && Number.isFinite(v);

  // ============================================
  // RESULT BUILDERS
  // ============================================

  function refuse(reason, detail, raw, extra) {
    logDebug(`refused: ${reason} - ${detail}`);
    return Object.assign({ ok: false, reason, detail, raw, issues: [] }, extra || {});
  }

  function warning(code, message, position) {
    return Object.assign({ code, message }, position || {});
  }

  // ============================================
  // PARSING
  // ============================================

  /**
   * The text as JSON. The rule: the whole reply is the JSON, optionally inside ONE surrounding Markdown fence.
   * Prose before or after the JSON is a refusal, not something to dig the JSON out of.
   * @returns {{ok: boolean, value: *}}
   */
  function readJson(text) {
    const trimmed = String(text).trim();
    try {
      return { ok: true, value: JSON.parse(trimmed) };
    } catch (e) {
      // fall through to the fence test
    }
    const fenced = FENCE.exec(trimmed);
    if (fenced) {
      try {
        return { ok: true, value: JSON.parse(fenced[1]) };
      } catch (e) {
        // a fence around something that is not JSON is still not JSON
      }
    }
    return { ok: false, value: null };
  }

  /** Issues that are well formed, plus a warning per entry dropped. Used for refusals and acceptances alike. */
  function readIssues(value, warnings) {
    if (value === undefined) return [];
    if (!Array.isArray(value)) {
      warnings.push(warning(WARNING_CODE.BAD_ISSUES, "issues was not a list and was ignored"));
      return [];
    }
    const kept = [];
    value.forEach((issue, i) => {
      const wellFormed =
        isObject(issue) && ISSUE_KINDS.includes(issue.kind) && typeof issue.location === "string" && typeof issue.message === "string";
      if (!wellFormed) {
        warnings.push(warning(WARNING_CODE.BAD_ISSUE, `issue ${i + 1} was malformed and was dropped`, { index: i }));
        return;
      }
      kept.push({ kind: issue.kind, location: issue.location, message: issue.message });
    });
    return kept;
  }

  /**
   * Check the table's shape. Returns a refusal, or null when the shape is usable.
   * A zero-row table is refused: there is nothing to chart.
   */
  function checkTableShape(table, raw, issues) {
    const extra = { issues };
    if (table === null || table === undefined) {
      return refuse(REASON.TABLE_MISSING, "the reply carries no table", raw, extra);
    }
    if (!isObject(table) || !Array.isArray(table.headers) || !Array.isArray(table.rows)) {
      return refuse(REASON.TABLE_SHAPE, "table is not { headers: [], rows: [] }", raw, extra);
    }
    if (!table.headers.every((h) => typeof h === "string")) {
      return refuse(REASON.TABLE_SHAPE, "table.headers is not a list of strings", raw, extra);
    }
    if (table.headers.length < MIN_COLUMNS) {
      return refuse(REASON.TOO_FEW_COLUMNS, `table has ${table.headers.length} column(s); a chart needs at least ${MIN_COLUMNS}`, raw, extra);
    }
    if (table.rows.length === 0) {
      return refuse(REASON.NO_ROWS, "table has no rows", raw, extra);
    }
    const width = table.headers.length;
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];
      if (!Array.isArray(row)) {
        return refuse(REASON.TABLE_SHAPE, `row ${i + 1} is not a list`, raw, extra);
      }
      if (row.length !== width) {
        return refuse(REASON.ROW_LENGTH, `row ${i + 1} has ${row.length} cells for ${width} headers`, raw, extra);
      }
    }
    return null;
  }

  /**
   * Normalise the cells. Column 0 becomes text; every other cell is a finite number or null.
   * A value that is not a number is NEVER parsed (a comma is not read as a decimal point, "42" is not 42)
   * and an unknown is NEVER turned into 0: it becomes null with a warning naming its row and column.
   * Returns { table } or a refusal.
   */
  function normaliseCells(table, raw, issues, warnings) {
    const rows = [];
    for (let i = 0; i < table.rows.length; i++) {
      const source = table.rows[i];
      const row = [];
      const label = source[0];
      if (typeof label === "string") {
        row.push(label);
      } else if (isNumber(label)) {
        row.push(String(label));
        warnings.push(warning(WARNING_CODE.NUMERIC_LABEL, `row ${i + 1}: the label ${label} was a number and was kept as text`, { row: i, column: 0 }));
      } else {
        return refuse(REASON.BAD_LABEL, `row ${i + 1} has no usable label`, raw, { issues });
      }
      for (let j = 1; j < source.length; j++) {
        const cell = source[j];
        if (isNumber(cell)) {
          row.push(cell);
          continue;
        }
        row.push(null);
        if (cell !== null) {
          warnings.push(
            warning(WARNING_CODE.NON_NUMERIC_CELL, `row ${i + 1}, column ${j + 1}: ${JSON.stringify(cell)} is not a number and was left empty`, { row: i, column: j }),
          );
        }
      }
      rows.push(row);
    }
    return { table: { headers: table.headers.slice(), rows } };
  }

  /** The value axis as { label, min, max, logarithmic }, or null. Each bad part becomes null with a warning. */
  function readValueAxis(axis, warnings) {
    if (axis === null || axis === undefined) return null;
    if (!isObject(axis)) {
      warnings.push(warning(WARNING_CODE.BAD_VALUE_AXIS, "valueAxis was not an object and was ignored"));
      return null;
    }
    const part = (key, ok) => {
      if (axis[key] === null || axis[key] === undefined) return null;
      if (ok(axis[key])) return axis[key];
      warnings.push(warning(WARNING_CODE.BAD_VALUE_AXIS, `valueAxis.${key} was not usable and was ignored`));
      return null;
    };
    return {
      label: part("label", (v) => typeof v === "string"),
      min: part("min", isNumber),
      max: part("max", isNumber),
      // null is a legitimate answer: a pie or doughnut has no log-scale opinion (IC-3 ruling)
      logarithmic: part("logarithmic", (v) => typeof v === "boolean"),
    };
  }

  /**
   * The column configuration in the shape GraphBuilderEnhanced.setColumnConfiguration takes.
   * Column 0 is the label; the rest are values. For a bubble chart a column headed "r" takes the radius role.
   */
  function buildColumnConfiguration(headers, suggestedType) {
    return headers.map((name, index) => {
      if (index === 0) return { name, type: COLUMN_TYPE.TEXT, role: COLUMN_ROLE.LABEL };
      const isRadius = suggestedType === BUBBLE_TYPE && name.trim().toLowerCase() === BUBBLE_RADIUS_HEADER;
      return { name, type: COLUMN_TYPE.NUMBER, role: isRadius ? COLUMN_ROLE.RADIUS : COLUMN_ROLE.VALUE };
    });
  }

  // ============================================
  // PUBLIC: parse
  // ============================================

  /**
   * Parse and check a model's reply.
   * @param {string} text - the reply text (message content)
   * @param {{finishReason?: string|null}} [options] - the response's finishReason; "length" is refused before anything is parsed
   * @returns {object} { ok: false, reason, detail, raw, issues } or
   *   { ok: true, status, suggestedType, chartFamily, stacked, orientation, title, valueAxis, table, issues, columnConfiguration, warnings }
   */
  function parse(text, options) {
    const finishReason = options && options.finishReason;
    const raw = typeof text === "string" ? text : null;

    // A cut-off reply is not a short reply: refuse it before it can parse to something plausible.
    if (finishReason === FINISH_LENGTH) {
      return refuse(REASON.TRUNCATED, "the reply was cut off at the token limit", raw);
    }
    if (raw === null) {
      return refuse(REASON.NOT_JSON, "the reply has no text", raw);
    }

    const read = readJson(raw);
    if (!read.ok) {
      return refuse(REASON.NOT_JSON, "the reply is not JSON", raw);
    }
    const reply = read.value;
    if (!isObject(reply)) {
      return refuse(REASON.NOT_OBJECT, "the reply is not a JSON object", raw);
    }

    const warnings = [];
    for (const key of Object.keys(reply)) {
      if (!CONTRACT_KEYS.includes(key)) {
        warnings.push(warning(WARNING_CODE.UNEXPECTED_KEY, `unexpected key "${key}" was ignored`));
      }
    }

    if (!("status" in reply) || reply.status === null || reply.status === undefined) {
      return refuse(REASON.STATUS_MISSING, "the reply has no status", raw);
    }
    if (!KNOWN_STATUSES.includes(reply.status)) {
      return refuse(REASON.STATUS_UNKNOWN, `status ${JSON.stringify(reply.status)} is not one the contract allows`, raw);
    }

    const issues = readIssues(reply.issues, warnings);

    if (reply.status === STATUS.UNSUPPORTED) {
      return refuse(REASON.STATUS_UNSUPPORTED, "the model says this image is not a chart it can read", raw, { status: reply.status, issues });
    }
    if (reply.status === STATUS.INSUFFICIENT) {
      return refuse(REASON.STATUS_INSUFFICIENT, "the model says the image does not hold enough to recover the data", raw, { status: reply.status, issues });
    }

    const shapeRefusal = checkTableShape(reply.table, raw, issues);
    if (shapeRefusal) return Object.assign(shapeRefusal, { status: reply.status });

    const cells = normaliseCells(reply.table, raw, issues, warnings);
    if (cells.ok === false) return Object.assign(cells, { status: reply.status });

    let suggestedType = null;
    if (reply.suggestedType !== null && reply.suggestedType !== undefined) {
      if (CHART_TYPES.includes(reply.suggestedType)) {
        suggestedType = reply.suggestedType;
      } else {
        warnings.push(warning(WARNING_CODE.UNKNOWN_TYPE, `suggestedType ${JSON.stringify(reply.suggestedType)} is not a Graph Builder chart type and was ignored`));
      }
    }

    let chartFamily = null;
    if (reply.chartFamily !== null && reply.chartFamily !== undefined) {
      if (CHART_FAMILIES.includes(reply.chartFamily)) {
        chartFamily = reply.chartFamily;
      } else {
        warnings.push(warning(WARNING_CODE.UNKNOWN_FAMILY, `chartFamily ${JSON.stringify(reply.chartFamily)} was not recognised and was ignored`));
      }
    }

    let title = null;
    if (typeof reply.title === "string") {
      title = reply.title;
    } else if (reply.title !== null && reply.title !== undefined) {
      warnings.push(warning(WARNING_CODE.BAD_TITLE, "title was not text and was ignored"));
    }

    // Graph Builder draws neither stacked nor horizontal charts; the parser keeps what the reply said
    // so the caller can tell a person the redraw differs from the source.
    let stacked = null;
    if (typeof reply.stacked === "boolean") {
      stacked = reply.stacked;
    } else if (reply.stacked !== null && reply.stacked !== undefined) {
      warnings.push(warning(WARNING_CODE.BAD_STACKED, "stacked was not true or false and was ignored"));
    }

    let orientation = null;
    if (ORIENTATIONS.includes(reply.orientation)) {
      orientation = reply.orientation;
    } else if (reply.orientation !== null && reply.orientation !== undefined) {
      warnings.push(warning(WARNING_CODE.BAD_ORIENTATION, `orientation ${JSON.stringify(reply.orientation)} was not "vertical" or "horizontal" and was ignored`));
    }

    const result = {
      ok: true,
      status: reply.status,
      suggestedType,
      chartFamily,
      stacked,
      orientation,
      title,
      valueAxis: readValueAxis(reply.valueAxis, warnings),
      table: cells.table,
      issues,
      columnConfiguration: buildColumnConfiguration(cells.table.headers, suggestedType),
      warnings,
    };
    logDebug(`accepted: ${cells.table.rows.length} row(s), ${warnings.length} warning(s)`);
    return result;
  }

  logInfo("Module loaded");

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    parse,
    REASON,
    WARNING_CODE,
  };
})();

// Attach to window
window.GraphBuilderImageReply = GraphBuilderImageReply;
