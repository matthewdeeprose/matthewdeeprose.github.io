/**
 * @fileoverview The "convert this LaTeX table" item for the enhancer's
 * "things to check" panel.
 * @module MathPixAITableAction
 * @version 1.0.0
 * @since MathPix AI lane, parcel M-2c
 *
 * Builds the item's HTML, reads the person's heading choice from it, and turns
 * the choice into new enhanced text. It never changes the page's state on its
 * own: applyConversion() is pure (no DOM, no notify), and the DOM helpers touch
 * only the item element they are given. The enhancer owns the click handler,
 * the re-render, the focus move and the one announcement.
 *
 * Needs window.MathPixTableConvert, resolved at call time. If it is absent,
 * applyConversion() refuses and the enhancer shows no table items.
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
      console.error(`[TableAction] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TableAction] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TableAction] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TableAction] ${message}`, ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  const BEGIN_TABULAR = "\\begin{tabular}";

  const MODE = Object.freeze({ FIRST_ROW: "first-row", TYPED: "typed" });

  const TEXT = Object.freeze({
    CAN_CONVERT:
      "This LaTeX table can become a markdown table, which screen readers can move through by row and column.",
    CANNOT_CONVERT: "This LaTeX table can't become a markdown table.",
    LEGEND: "Headings for the table",
    FIRST_ROW: "The first row is the headings",
    TYPED: "I'll type the headings",
    BUTTON: "Convert table",
    CONVERTED: "Converted to a markdown table.",
  });

  const REFUSALS = Object.freeze({
    NO_CONVERTER: "The table converter is not loaded, so this table is left as it is.",
    STALE:
      "The text has changed since this table was found, so it is left as it is. Reopen the list to try again.",
  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  function itemKey(tabular) {
    return `ai-tbl-${Number.isInteger(tabular.index) ? tabular.index : tabular.line}`;
  }

  function refuse(reason, field) {
    return field === undefined ? { ok: false, reason } : { ok: false, reason, field };
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * HTML for the detail part of one table item (the enhancer wraps it in the
   * list item and adds the number). Everything that came from the text is
   * escaped through the function passed in.
   *
   * @param {{index?: number, line: number, columns: number|null,
   *   convertible: boolean, reason: string|null}} tabular
   * @param {function(string): string} escapeHtml
   * @returns {string} HTML for the item's detail block
   */
  function buildTableItemHTML(tabular, escapeHtml) {
    const line = Number(tabular.line);

    if (!tabular.convertible) {
      return `
            <div class="ai-uncertainty-detail">
              <span class="ai-uncertainty-comment">Line ${line}: ${escapeHtml(TEXT.CANNOT_CONVERT)} ${escapeHtml(tabular.reason || "")}</span>
            </div>`;
    }

    const key = itemKey(tabular);
    const group = `${key}-headings`;
    const errorId = `${key}-error`;
    const columns = Number(tabular.columns) || 0;

    let inputs = "";
    for (let n = 1; n <= columns; n++) {
      inputs += `
                <div class="ai-table-heading-field">
                  <label for="${key}-h${n}">Heading for column ${n}</label>
                  <input type="text" id="${key}-h${n}" data-table-heading autocomplete="off">
                </div>`;
    }

    return `
            <div class="ai-uncertainty-detail">
              <span class="ai-uncertainty-comment">Line ${line}: ${escapeHtml(TEXT.CAN_CONVERT)}</span>
              <fieldset class="ai-table-headings">
                <legend>${TEXT.LEGEND}</legend>
                <label class="ai-table-choice">
                  <input type="radio" name="${group}" value="${MODE.FIRST_ROW}" data-table-mode>
                  ${TEXT.FIRST_ROW}
                </label>
                <label class="ai-table-choice">
                  <input type="radio" name="${group}" value="${MODE.TYPED}" data-table-mode checked>
                  ${TEXT.TYPED}
                </label>
                <div class="ai-table-typed" data-table-typed>${inputs}
                </div>
                <p class="ai-table-error" id="${errorId}" data-table-error hidden></p>
              </fieldset>
              <button type="button" class="ai-table-convert" data-table-convert>${TEXT.BUTTON}</button>
            </div>`;
  }

  /**
   * Show the typed-heading inputs only when "I'll type the headings" is chosen.
   * Uses the hidden attribute, so hidden inputs leave the tab order.
   *
   * @param {Element} itemEl - the table item
   */
  function syncHeadingMode(itemEl) {
    const typed = itemEl.querySelector("[data-table-typed]");
    const chosen = itemEl.querySelector("[data-table-mode]:checked");
    if (!typed) return;
    typed.hidden = !(chosen && chosen.value === MODE.TYPED);
  }

  /**
   * Read the person's choice from the item.
   *
   * @param {Element} itemEl - the table item
   * @returns {{firstRowIsHeader: boolean, headerCells?: string[]}}
   */
  function readChoice(itemEl) {
    const chosen = itemEl.querySelector("[data-table-mode]:checked");
    if (!chosen || chosen.value !== MODE.TYPED) {
      return { firstRowIsHeader: true };
    }
    const headerCells = Array.from(
      itemEl.querySelectorAll("[data-table-heading]"),
    ).map((input) => input.value);
    return { firstRowIsHeader: false, headerCells };
  }

  /**
   * Replace one tabular in the text with its markdown table. Pure.
   *
   * @param {string} mmd - the enhanced text the tabular was found in
   * @param {{start: number, end: number, columns?: number|null}} tabular
   * @param {{firstRowIsHeader: boolean, headerCells?: string[]}} choice
   * @returns {{ok: true, mmd: string}|{ok: false, reason: string, field?: number}}
   *   field is the 0-based column of the first blank typed heading, when that
   *   is why it was refused.
   */
  function applyConversion(mmd, tabular, choice) {
    try {
      const converter = window.MathPixTableConvert;
      if (!converter || typeof converter.convert !== "function") {
        return refuse(REFUSALS.NO_CONVERTER);
      }
      if (typeof mmd !== "string" || !tabular) return refuse(REFUSALS.STALE);

      const source = mmd.slice(tabular.start, tabular.end);
      if (!source.startsWith(BEGIN_TABULAR)) return refuse(REFUSALS.STALE);

      const result = converter.convert(source, choice);
      if (!result.ok) {
        const typed = choice && Array.isArray(choice.headerCells);
        const field = typed
          ? choice.headerCells.findIndex(
              (cell) => typeof cell !== "string" || cell.trim() === "",
            )
          : -1;
        return refuse(result.reason, field >= 0 ? field : undefined);
      }

      logDebug(`converted the table at line ${tabular.line}`);
      return {
        ok: true,
        mmd: mmd.slice(0, tabular.start) + result.markdown + mmd.slice(tabular.end),
      };
    } catch (error) {
      logError("applyConversion failed", error);
      return refuse(REFUSALS.STALE);
    }
  }

  /**
   * Show an inline error under the inputs and tie it to the inputs with
   * aria-describedby. Not a live region: the enhancer moves focus to the
   * offending input, and the description is read from there.
   *
   * @param {Element} itemEl
   * @param {string} message
   */
  function showError(itemEl, message) {
    const error = itemEl.querySelector("[data-table-error]");
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
    itemEl.querySelectorAll("[data-table-heading]").forEach((input) => {
      input.setAttribute("aria-describedby", error.id);
    });
  }

  /** Remove the inline error and the descriptions that pointed at it. */
  function clearError(itemEl) {
    const error = itemEl.querySelector("[data-table-error]");
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
    itemEl.querySelectorAll("[data-table-heading]").forEach((input) => {
      input.removeAttribute("aria-describedby");
    });
  }

  /**
   * The input to focus after a refusal: the first blank heading when the
   * choice was typed, otherwise the first heading input.
   *
   * @param {Element} itemEl
   * @param {number} [field] - 0-based column from applyConversion
   * @returns {Element|null}
   */
  function inputToFocus(itemEl, field) {
    const inputs = Array.from(itemEl.querySelectorAll("[data-table-heading]"));
    if (Number.isInteger(field) && inputs[field]) return inputs[field];
    return inputs.find((input) => input.value.trim() === "") || inputs[0] || null;
  }

  window.MathPixAITableAction = {
    TEXT,
    buildTableItemHTML,
    syncHeadingMode,
    readChoice,
    applyConversion,
    showError,
    clearError,
    inputToFocus,
  };

  logInfo("MathPixAITableAction loaded");
})();
