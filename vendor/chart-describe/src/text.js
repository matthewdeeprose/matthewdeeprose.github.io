/**
 * Chart description text helpers
 * Four small functions that the chart describers share: list joining,
 * capitalisation, number-as-words and HTML escaping.
 *
 * Each one behaves exactly like the function of the same name in
 * md-scripts/mermaid/mermaid-accessibility-common.js, including its edge
 * cases. A standing check (.claude/chart-describe/prove-text-parity.mjs)
 * compares the two. If they ever differ, make one call the other; do not edit
 * both.
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
      console.error(`[Chart Describe Text] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Chart Describe Text] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Chart Describe Text] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Chart Describe Text] DEBUG: ${message}`, ...args);
    }
  }

  /**
   * Format a list of items with proper grammar (Oxford comma)
   * @param {Array} items - Array of item strings
   * @returns {string} Formatted list
   */
  function formatList(items) {
    logDebug("Formatting list with items:", items);

    if (!items || items.length === 0) {
      return "";
    }

    if (items.length === 1) {
      return items[0];
    }

    if (items.length === 2) {
      return `${items[0]} and ${items[1]}`;
    }

    // Three or more items use the Oxford comma
    const lastItem = items[items.length - 1];
    const otherItems = items.slice(0, -1);
    return `${otherItems.join(", ")}, and ${lastItem}`;
  }

  /**
   * Simple string capitalisation
   * @param {string} str - The string to capitalise
   * @returns {string} Capitalised string
   */
  function capitalize(str) {
    if (!str) {
      return "";
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Counts and references are words for zero to nine, digits from 10.
  const NARRATION_NUMBER_WORDS = Object.freeze([
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
  ]);

  /**
   * A number as narration: a word for zero to nine, digits from 10.
   * A non-integer between 0 and 9 (2.5) returns undefined, because it indexes
   * the word list with a fractional key. This matches the original on purpose.
   * @param {number} value - The number to express
   * @returns {string} The narration form
   */
  function narrationNumber(value) {
    logDebug("Narration number for:", value);
    return value >= 0 && value <= 9
      ? NARRATION_NUMBER_WORDS[value]
      : String(value);
  }

  /**
   * Escape the characters that are significant in HTML, so chart text can be
   * interpolated into a description without being parsed as markup.
   *
   * The ampersand is replaced first, or the entities added by the later
   * replacements would themselves be re-escaped.
   *
   * Apply this to chart text at the point it is interpolated: a title, a
   * label, a series name. Never apply it to a whole output string, which mixes
   * chart text with markup the describer writes itself.
   *
   * @param {string} text - The chart text to escape
   * @returns {string} The text with HTML-significant characters replaced
   */
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  logInfo("Text helpers initialised successfully");

  const api = {
    formatList,
    capitalize,
    narrationNumber,
    escapeHtml,
  };

  root.ChartDescribeText = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
