/**
 * Helpers that every chart family shares.
 *
 * This file exports four small functions: countWord, capitalise, modelCore and
 * joinRuns. The xychart, pie and radar builders all call them.
 *
 * It reads window.ChartDescribeText and window.ChartDescribeModel when a
 * function runs, never when the file loads. So the order of loading is:
 * text.js, model.js, this file, the three family files (charts-xychart.js,
 * charts-pie.js, charts-radar.js), then charts.js.
 *
 * The file exports itself as window.ChartDescribeChartsShared. In Node it also
 * sets module.exports.
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
      console.error(`[Chart Describe Charts Shared] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Chart Describe Charts Shared] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Chart Describe Charts Shared] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Chart Describe Charts Shared] DEBUG: ${message}`, ...args);
    }
  }

  // ---------------------------------------------------------------------
  // The shared text helpers, resolved AT CALL TIME and never cached
  // ---------------------------------------------------------------------
  //
  // A capture of window.ChartDescribeText at load time would stay undefined
  // for good if this file ever ran before text.js. Looking it up on each call
  // costs one property read and cannot go stale. If text.js is missing, the
  // first call throws a TypeError. It never returns wrong text.

  /**
   * The shared text helpers (formatList, capitalize, narrationNumber,
   * escapeHtml), resolved at call time.
   * @returns {Object} ChartDescribeText
   */
  function textCore() {
    return root.ChartDescribeText;
  }

  /**
   * Narration count: words for zero to nine, digits from 10 upwards.
   * @param {number} value - The count
   * @returns {string} The count as it is spoken
   */
  function countWord(value) {
    return textCore().narrationNumber(value);
  }

  /**
   * Capitalise the first character and leave the rest alone. Text that the
   * chart's author wrote is never re-cased. Chart.js lowercases aggressively,
   * and this code deliberately does not.
   * @param {string} text - The sentence opening
   * @returns {string} The capitalised sentence opening
   */
  function capitalise(text) {
    return textCore().capitalize(text);
  }

  /**
   * The model helpers (the run, block and description builders), looked up on each
   * call for the same reason as textCore(): a load-time capture would stay
   * undefined if this file ever ran before model.js.
   * @returns {Object} ChartDescribeModel
   */
  function modelCore() {
    return root.ChartDescribeModel;
  }

  /**
   * Join lists of runs into one list, the way textCore().formatList joins
   * strings. Each entry is a list of runs. The words between entries are
   * ordinary text runs. Zero entries give no runs. One entry gives itself.
   * Two entries are joined by " and ". Three or more are joined by commas with
   * an Oxford comma. The function joins runs, not HTML strings, so the
   * renderer can escape the author's text once, in one place.
   * @param {Array<Array>} entries - One list of runs for each item
   * @returns {Array} The joined runs
   */
  function joinRuns(entries) {
    const { text } = modelCore();
    if (entries.length === 0) return [];
    if (entries.length === 1) return entries[0];
    if (entries.length === 2) return [...entries[0], text(" and "), ...entries[1]];

    const runs = [];
    entries.slice(0, -1).forEach((entry, index) => {
      if (index > 0) runs.push(text(", "));
      runs.push(...entry);
    });
    runs.push(text(", and "), ...entries[entries.length - 1]);
    return runs;
  }

  logInfo("Shared chart helpers initialised successfully");

  const api = {
    countWord,
    capitalise,
    modelCore,
    joinRuns,
  };

  root.ChartDescribeChartsShared = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
