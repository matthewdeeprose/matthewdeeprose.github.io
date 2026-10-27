/**
 * Word Table Prep
 * Prepares tables in clipboard HTML so Word pastes them with the header row
 * repeating at the top of each page and rows that do not split across pages.
 * Shared by every "Copy formatted" feature that can carry a table.
 *
 * @version 1.0.0
 */

(function () {
  "use strict";

  // Logging configuration
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
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Word Table Prep] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Word Table Prep] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Word Table Prep] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Word Table Prep] DEBUG: ${message}`, ...args);
    }
  }

  // Word reads page-break-inside on a row as "Allow row to break across pages" off
  const ROW_NO_BREAK_STYLE = "page-break-inside:avoid;break-inside:avoid";

  /**
   * Prepare every table in an HTML fragment for Word.
   * Header row goes in <thead> (Word: "Repeat as header row"), and every row
   * is marked unbreakable. Works on a detached copy.
   * @param {string} html - HTML fragment
   * @returns {string} HTML fragment with tables prepared; the input on error
   */
  function prepare(html) {
    try {
      const container = document.createElement("div");
      container.innerHTML = html;

      container.querySelectorAll("table").forEach((table) => {
        // Move the first row into a <thead> if there isn't one
        if (!table.tHead) {
          const firstRow = table.rows[0];
          if (firstRow) {
            const thead = table.createTHead();
            thead.appendChild(firstRow);
            firstRow.querySelectorAll("td").forEach((td) => {
              const th = document.createElement("th");
              th.innerHTML = td.innerHTML;
              td.replaceWith(th);
            });
          }
        }

        table.querySelectorAll("th").forEach((th) => {
          if (!th.hasAttribute("scope")) th.setAttribute("scope", "col");
        });

        table.querySelectorAll("tr").forEach((tr) => {
          tr.setAttribute("style", ROW_NO_BREAK_STYLE);
        });
      });

      logDebug("Tables prepared for Word");
      return container.innerHTML;
    } catch (error) {
      logError("Could not prepare tables for Word:", error);
      return html;
    }
  }

  window.WordTablePrep = Object.freeze({ prepare });
  logInfo("Word Table Prep ready");
})();
