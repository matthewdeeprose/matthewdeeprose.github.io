/**
 * Chart description model (DescriptionModel v0)
 * The vocabulary one chart description is built from: runs of text, blocks
 * (paragraph, list, table), sections and the description that holds them.
 * A model says WHAT is described and which words are the chart author's. It
 * holds no HTML, no class names and no chart family. render.js turns a model
 * into HTML.
 *
 * Every key is always present. A missing value is null. Author strings are
 * raw: the model never holds an HTML entity, because render.js escapes author
 * runs once, at the point where it writes HTML.
 *
 * This file exports the node builders (text, author, strong, term, paragraph,
 * list, item, table, section, description), flatten, and semanticErrors, which
 * checks a model. It needs no other file, so it loads early, after text.js.
 * It exports itself as window.ChartDescribeModel. In Node it also sets
 * module.exports.
 */
(function (root) {
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

  // Current logging level - can be modified at runtime
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Chart Describe Model] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Chart Describe Model] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Chart Describe Model] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Chart Describe Model] DEBUG: ${message}`, ...args);
    }
  }

  const MODEL_VERSION = 0;

  // The kinds of node, as they appear in a node's `type` field.
  const NODE_TYPES = Object.freeze({
    TEXT: "text",
    AUTHOR: "author",
    STRONG: "strong",
    TERM: "term",
    PARAGRAPH: "paragraph",
    LIST: "list",
    TABLE: "table",
  });

  // What a term is.
  const TERM_ROLES = Object.freeze([
    "label",
    "percentage",
    "proportion",
    "value",
    "count",
    "title",
  ]);

  // A raw value must never hold the entities escapeHtml writes.
  const ESCAPE_ARTEFACT = /&(?:amp|lt|gt|quot|#39);/;

  // ---------- constructors ----------

  /**
   * The describer's own words. Never escaped by the model.
   * @param {string} value
   * @returns {{type: string, value: string}}
   */
  function text(value) {
    return { type: NODE_TYPES.TEXT, value };
  }

  /**
   * Chart author text, raw. Escaped once, at the HTML sink.
   * @param {string} value
   * @returns {{type: string, value: string}}
   */
  function author(value) {
    return { type: NODE_TYPES.AUTHOR, value };
  }

  /**
   * Emphasis around other runs.
   * @param {Array} runs
   * @returns {{type: string, runs: Array}}
   */
  function strong(runs) {
    return { type: NODE_TYPES.STRONG, runs };
  }

  /**
   * A meaningful span.
   * @param {string} role - One of TERM_ROLES
   * @param {Array} runs
   * @returns {{type: string, role: string, runs: Array}}
   */
  function term(role, runs) {
    return { type: NODE_TYPES.TERM, role, runs };
  }

  /**
   * Running text.
   * @param {Array} runs
   * @returns {{type: string, runs: Array}}
   */
  function paragraph(runs) {
    return { type: NODE_TYPES.PARAGRAPH, runs };
  }

  /**
   * Bullets or numbers.
   * @param {Array} items - Built with item()
   * @param {{ordered: (boolean|undefined), role: (string|null|undefined)}} [options]
   * @returns {{type: string, ordered: boolean, role: (string|null), items: Array}}
   */
  function list(items, options = {}) {
    const { ordered = false, role = null } = options;
    return { type: NODE_TYPES.LIST, ordered, role, items };
  }

  /**
   * A list entry. `children` holds blocks nested under it (a nested list).
   * @param {Array} runs
   * @param {{role: (string|null|undefined), children: (Array|undefined)}} [options]
   * @returns {{role: (string|null), runs: Array, children: Array}}
   */
  function item(runs, options = {}) {
    const { role = null, children = [] } = options;
    return { role, runs, children };
  }

  /**
   * A table with one header row and no spanning cell. `columns` includes the
   * cell above the row-header column, so every row has as many cells as
   * `columns` has entries, less one when the row has a header.
   * @param {{caption: (Array|null|undefined), columns: Array<Array>, rows: Array<{header: (Array|null), cells: Array<Array>}>}} spec
   *   Cells are given as arrays of runs; each is wrapped as `{ runs }`.
   * @returns {{type: string, caption: (Array|null), columns: Array, rows: Array}}
   */
  function table(spec) {
    const { caption = null, columns, rows } = spec;
    return {
      type: NODE_TYPES.TABLE,
      caption,
      columns: columns.map((runs) => ({ runs })),
      rows: rows.map((row) => ({
        header: row.header ? { runs: row.header } : null,
        cells: row.cells.map((runs) => ({ runs })),
      })),
    };
  }

  /**
   * A headed group of blocks. `role` is a neutral word the profile may use.
   * @param {Array} blocks
   * @param {{role: (string|null|undefined), heading: (Array|null|undefined)}} [options]
   * @returns {{role: (string|null), heading: (Array|null), blocks: Array}}
   */
  function section(blocks, options = {}) {
    const { role = null, heading = null } = options;
    return { role, heading, blocks };
  }

  /**
   * One description: the short sentence as runs, and its sections.
   * @param {Array} short
   * @param {Array} sections
   * @returns {{modelVersion: number, short: Array, sections: Array}}
   */
  function description(short, sections) {
    return { modelVersion: MODEL_VERSION, short, sections };
  }

  /**
   * The plain text of a run list: raw values joined, no markup.
   * @param {Array} runs
   * @returns {string}
   */
  function flatten(runs) {
    return runs
      .map((run) =>
        run.type === NODE_TYPES.TEXT || run.type === NODE_TYPES.AUTHOR
          ? run.value
          : flatten(run.runs)
      )
      .join("");
  }

  // ---------- checking ----------

  const isObject = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);

  /**
   * Checks that `node` is a plain object with exactly the keys named.
   * Returns true when the shape is safe to read.
   */
  function checkKeys(node, keys, path, errs) {
    if (!isObject(node)) {
      errs.push(`${path}: expected an object`);
      return false;
    }
    let ok = true;
    for (const key of keys) {
      if (!(key in node)) {
        errs.push(`${path}: missing required key "${key}"`);
        ok = false;
      }
    }
    for (const key of Object.keys(node)) {
      if (!keys.includes(key)) errs.push(`${path}: unexpected key "${key}"`);
    }
    return ok;
  }

  // Walks an array of runs; returns true when it is an array.
  function checkRunList(runs, path, errs) {
    if (!Array.isArray(runs)) {
      errs.push(`${path}: expected an array of runs`);
      return false;
    }
    runs.forEach((run, i) => checkRun(run, `${path}[${i}]`, errs));
    return true;
  }

  function checkRawValue(run, path, errs) {
    if (typeof run.value !== "string") {
      errs.push(`${path}.value: expected a string`);
      return;
    }
    if (ESCAPE_ARTEFACT.test(run.value)) {
      errs.push(`${path}: escape artefact in a raw value ${JSON.stringify(run.value)}`);
    }
  }

  function checkRun(run, path, errs) {
    if (!isObject(run)) {
      errs.push(`${path}: expected an object`);
      return;
    }
    switch (run.type) {
      case NODE_TYPES.TEXT:
      case NODE_TYPES.AUTHOR:
        if (checkKeys(run, ["type", "value"], path, errs)) checkRawValue(run, path, errs);
        return;
      case NODE_TYPES.STRONG:
        if (checkKeys(run, ["type", "runs"], path, errs)) checkRunList(run.runs, `${path}.runs`, errs);
        return;
      case NODE_TYPES.TERM:
        if (!checkKeys(run, ["type", "role", "runs"], path, errs)) return;
        if (!TERM_ROLES.includes(run.role)) {
          errs.push(`${path}.role: ${JSON.stringify(run.role)} not in the term roles`);
        }
        checkRunList(run.runs, `${path}.runs`, errs);
        return;
      default:
        errs.push(`${path}: unknown run type ${JSON.stringify(run.type)}`);
    }
  }

  function checkOptionalRole(node, path, errs) {
    if (node.role !== null && typeof node.role !== "string") {
      errs.push(`${path}.role: expected a string or null`);
    }
  }

  function checkCell(cell, path, errs) {
    if (checkKeys(cell, ["runs"], path, errs)) checkRunList(cell.runs, `${path}.runs`, errs);
  }

  function checkTable(block, path, errs) {
    if (!checkKeys(block, ["type", "caption", "columns", "rows"], path, errs)) return;
    if (block.caption !== null) checkRunList(block.caption, `${path}.caption`, errs);
    if (!Array.isArray(block.columns)) {
      errs.push(`${path}.columns: expected an array`);
      return;
    }
    if (!Array.isArray(block.rows)) {
      errs.push(`${path}.rows: expected an array`);
      return;
    }
    block.columns.forEach((cell, i) => checkCell(cell, `${path}.columns[${i}]`, errs));

    let withHeader = 0;
    block.rows.forEach((row, i) => {
      const rowPath = `${path}.rows[${i}]`;
      if (!checkKeys(row, ["header", "cells"], rowPath, errs)) return;
      if (row.header !== null) {
        withHeader += 1;
        checkCell(row.header, `${rowPath}.header`, errs);
      }
      if (!Array.isArray(row.cells)) {
        errs.push(`${rowPath}.cells: expected an array`);
        return;
      }
      row.cells.forEach((cell, j) => checkCell(cell, `${rowPath}.cells[${j}]`, errs));

      const cellCount = (row.header !== null ? 1 : 0) + row.cells.length;
      if (block.columns.length !== cellCount) {
        errs.push(`${rowPath}: ${block.columns.length} columns but ${cellCount} cells`);
      }
    });
    if (withHeader !== 0 && withHeader !== block.rows.length) {
      errs.push(`${path}: some rows have a row header and some do not`);
    }
  }

  function checkBlock(block, path, errs) {
    if (!isObject(block)) {
      errs.push(`${path}: expected an object`);
      return;
    }
    switch (block.type) {
      case NODE_TYPES.PARAGRAPH:
        if (checkKeys(block, ["type", "runs"], path, errs)) checkRunList(block.runs, `${path}.runs`, errs);
        return;
      case NODE_TYPES.LIST:
        if (!checkKeys(block, ["type", "ordered", "role", "items"], path, errs)) return;
        if (typeof block.ordered !== "boolean") errs.push(`${path}.ordered: expected a boolean`);
        checkOptionalRole(block, path, errs);
        if (!Array.isArray(block.items)) {
          errs.push(`${path}.items: expected an array`);
          return;
        }
        block.items.forEach((entry, i) => checkItem(entry, `${path}.items[${i}]`, errs));
        return;
      case NODE_TYPES.TABLE:
        checkTable(block, path, errs);
        return;
      default:
        errs.push(`${path}: unknown block type ${JSON.stringify(block.type)}`);
    }
  }

  function checkItem(entry, path, errs) {
    if (!checkKeys(entry, ["role", "runs", "children"], path, errs)) return;
    checkOptionalRole(entry, path, errs);
    checkRunList(entry.runs, `${path}.runs`, errs);
    if (!Array.isArray(entry.children)) {
      errs.push(`${path}.children: expected an array`);
      return;
    }
    entry.children.forEach((child, i) => checkBlock(child, `${path}.children[${i}]`, errs));
  }

  function checkSection(sec, path, errs) {
    if (!checkKeys(sec, ["role", "heading", "blocks"], path, errs)) return;
    checkOptionalRole(sec, path, errs);
    if (sec.heading !== null) checkRunList(sec.heading, `${path}.heading`, errs);
    if (!Array.isArray(sec.blocks)) {
      errs.push(`${path}.blocks: expected an array`);
      return;
    }
    sec.blocks.forEach((block, i) => checkBlock(block, `${path}.blocks[${i}]`, errs));
  }

  /**
   * Find everything wrong with a model. It checks the shape (keys, types, and
   * the closed sets of node types and term roles). It also checks the rules a
   * shape cannot say: table width, row headers on all rows or on none, and no
   * escape artefact in a raw value. It never throws on a malformed model.
   * @param {*} model
   * @returns {string[]} Errors; empty when the model is valid
   */
  function semanticErrors(model) {
    const errs = [];
    if (!checkKeys(model, ["modelVersion", "short", "sections"], "model", errs)) return errs;
    if (model.modelVersion !== MODEL_VERSION) {
      errs.push(`model.modelVersion: expected ${MODEL_VERSION}, got ${JSON.stringify(model.modelVersion)}`);
    }
    checkRunList(model.short, "short", errs);
    if (!Array.isArray(model.sections)) {
      errs.push("sections: expected an array");
      return errs;
    }
    model.sections.forEach((sec, i) => checkSection(sec, `sections[${i}]`, errs));
    return errs;
  }

  logInfo("Description model initialised successfully");

  const api = {
    MODEL_VERSION,
    text,
    author,
    strong,
    term,
    paragraph,
    list,
    item,
    table,
    section,
    description,
    flatten,
    semanticErrors,
  };

  root.ChartDescribeModel = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
