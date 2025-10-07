/**
 * @module ResultsManagerUtils
 * @description Utility functions for the ResultsManager modules
 */
export class ResultsManagerUtils {
  // Logging configuration
  static LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  static DEFAULT_LOG_LEVEL = ResultsManagerUtils.LOG_LEVELS.WARN;
  static ENABLE_ALL_LOGGING = false;
  static DISABLE_ALL_LOGGING = false;

  /**
   * Current logging configuration
   * @private
   */
  #currentLogLevel = ResultsManagerUtils.DEFAULT_LOG_LEVEL;

  /**
   * Constructor
   */
  constructor() {
    // Apply override flags
    if (ResultsManagerUtils.ENABLE_ALL_LOGGING) {
      this.#currentLogLevel = ResultsManagerUtils.LOG_LEVELS.DEBUG;
    } else if (ResultsManagerUtils.DISABLE_ALL_LOGGING) {
      this.#currentLogLevel = -1; // Below ERROR level
    }
  }

  /**
   * Set the current logging level
   * @param {number} level - Log level to set
   */
  setLogLevel(level) {
    if (ResultsManagerUtils.DISABLE_ALL_LOGGING) {
      return; // Cannot override if all logging is disabled
    }

    if (Object.values(ResultsManagerUtils.LOG_LEVELS).includes(level)) {
      this.#currentLogLevel = level;
    } else {
      this.logError("Invalid log level specified", { level });
    }
  }

  /**
   * Get the current logging level
   * @returns {number} Current log level
   */
  getLogLevel() {
    return this.#currentLogLevel;
  }

  /**
   * Check if logging should occur for the given level
   * @param {number} level - Log level to check
   * @returns {boolean} True if logging should occur
   * @private
   */
  #shouldLog(level) {
    if (ResultsManagerUtils.DISABLE_ALL_LOGGING) {
      return false;
    }

    if (ResultsManagerUtils.ENABLE_ALL_LOGGING) {
      return true;
    }

    return level <= this.#currentLogLevel;
  }

  /**
   * Helper method to check if error logging is enabled
   * @returns {boolean} True if error logging is enabled
   */
  isErrorLoggingEnabled() {
    return this.#shouldLog(ResultsManagerUtils.LOG_LEVELS.ERROR);
  }

  /**
   * Helper method to check if warning logging is enabled
   * @returns {boolean} True if warning logging is enabled
   */
  isWarnLoggingEnabled() {
    return this.#shouldLog(ResultsManagerUtils.LOG_LEVELS.WARN);
  }

  /**
   * Helper method to check if info logging is enabled
   * @returns {boolean} True if info logging is enabled
   */
  isInfoLoggingEnabled() {
    return this.#shouldLog(ResultsManagerUtils.LOG_LEVELS.INFO);
  }

  /**
   * Helper method to check if debug logging is enabled
   * @returns {boolean} True if debug logging is enabled
   */
  isDebugLoggingEnabled() {
    return this.#shouldLog(ResultsManagerUtils.LOG_LEVELS.DEBUG);
  }

  /**
   * Log an error message
   * @param {string} message - Message to log
   * @param {Object} [context={}] - Context object
   */
  logError(message, context = {}) {
    if (this.#shouldLog(ResultsManagerUtils.LOG_LEVELS.ERROR)) {
      console.error(`ResultsManager: ${message}`, context);
    }
  }

  /**
   * Log a warning message
   * @param {string} message - Message to log
   * @param {Object} [context={}] - Context object
   */
  logWarn(message, context = {}) {
    if (this.#shouldLog(ResultsManagerUtils.LOG_LEVELS.WARN)) {
      console.warn(`ResultsManager: ${message}`, context);
    }
  }

  /**
   * Log an info message
   * @param {string} message - Message to log
   * @param {Object} [context={}] - Context object
   */
  logInfo(message, context = {}) {
    if (this.#shouldLog(ResultsManagerUtils.LOG_LEVELS.INFO)) {
      console.info(`ResultsManager: ${message}`, context);
    }
  }

  /**
   * Log a debug message
   * @param {string} message - Message to log
   * @param {Object} [context={}] - Context object
   */
  logDebug(message, context = {}) {
    if (this.#shouldLog(ResultsManagerUtils.LOG_LEVELS.DEBUG)) {
      console.log(`ResultsManager: ${message}`, context);
    }
  }

  /**
   * Generic log method (maintained for backwards compatibility)
   * @param {string} message - Message to log
   * @param {Object} [context={}] - Context object
   * @param {string} [level='info'] - Log level (error, warn, info, debug)
   * @deprecated Use specific log methods (logError, logWarn, logInfo, logDebug) instead
   */
  log(message, context = {}, level = "info") {
    switch (level) {
      case "error":
        this.logError(message, context);
        break;
      case "warn":
        this.logWarn(message, context);
        break;
      case "info":
        this.logInfo(message, context);
        break;
      case "debug":
        this.logDebug(message, context);
        break;
      default:
        this.logInfo(message, context);
    }
  }

  /**
   * Get current logging configuration
   * @returns {Object} Current logging configuration
   */
  getLoggingConfig() {
    return {
      currentLevel: this.#currentLogLevel,
      levels: { ...ResultsManagerUtils.LOG_LEVELS },
      enableAllLogging: ResultsManagerUtils.ENABLE_ALL_LOGGING,
      disableAllLogging: ResultsManagerUtils.DISABLE_ALL_LOGGING,
      defaultLevel: ResultsManagerUtils.DEFAULT_LOG_LEVEL,
    };
  }

  /**
   * Sanitise URL to prevent XSS
   * @param {string} url - URL to sanitise
   * @returns {string|null} Sanitised URL or null if unsafe
   */
  sanitizeUrl(url) {
    if (!url) return null;

    try {
      // Basic sanitisation - only allow http/https URLs
      const sanitised = url.trim();

      // Handle URLs with closing parenthesis that might be part of Markdown syntax
      // If the URL ends with a closing parenthesis and doesn't have a matching opening one
      let cleanedUrl = sanitised;
      if (sanitised.endsWith(")") && !this.hasBalancedParentheses(sanitised)) {
        cleanedUrl = sanitised.slice(0, -1);
        this.logDebug("Removed trailing parenthesis from URL", {
          original: sanitised,
          cleaned: cleanedUrl,
        });
      }

      if (
        cleanedUrl.startsWith("http://") ||
        cleanedUrl.startsWith("https://")
      ) {
        // Additional checks could be added here
        return cleanedUrl;
      }
      return null;
    } catch (error) {
      this.logError("Error sanitising URL", { error, url });
      return null;
    }
  }

  /**
   * Check if a string has balanced parentheses
   * @param {string} str - String to check
   * @returns {boolean} True if parentheses are balanced
   */
  hasBalancedParentheses(str) {
    let count = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "(") {
        count++;
      } else if (str[i] === ")") {
        count--;
        if (count < 0) return false; // More closing than opening
      }
    }
    return count === 0; // Should be balanced at the end
  }

  /**
   * Capitalise the first letter of a phase name
   * @param {string} phaseName - Phase name to capitalise
   * @returns {string} Capitalised phase name
   */
  capitalizePhase(phaseName) {
    if (!phaseName) return "";

    this.logDebug("Capitalising phase name", { phaseName });

    return phaseName.charAt(0).toUpperCase() + phaseName.slice(1);
  }

  /**
   * Format time in a human-readable format
   * @param {number} milliseconds - Time in milliseconds
   * @param {boolean} [compact=false] - Whether to use compact format
   * @returns {string} Formatted time string
   */
  formatTime(milliseconds, compact = false) {
    if (!milliseconds || isNaN(milliseconds)) {
      this.logWarn("Invalid milliseconds value provided to formatTime", {
        milliseconds,
        compact,
      });
      return compact ? "0s" : "0 seconds";
    }

    const seconds = Math.floor(milliseconds / 1000);

    this.logDebug("Formatting time", {
      milliseconds,
      seconds,
      compact,
    });

    if (seconds < 60) {
      return compact
        ? `${seconds}s`
        : `${seconds} second${seconds !== 1 ? "s" : ""}`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (compact) {
      return `${minutes}m ${remainingSeconds}s`;
    }

    return `${minutes} minute${
      minutes !== 1 ? "s" : ""
    } ${remainingSeconds} second${remainingSeconds !== 1 ? "s" : ""}`;
  }

  /**
   * Escape HTML special characters to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return "";

    this.logDebug("Escaping HTML text", {
      originalLength: text.length,
    });

    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Generate a unique ID for elements
   * @param {string} prefix - Prefix for the ID
   * @returns {string} Unique ID
   */
  generateUniqueId(prefix = "element") {
    const id = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    this.logDebug("Generated unique ID", {
      prefix,
      id,
    });

    return id;
  }

  /**
   * Check if reduced motion is preferred
   * @param {Object} a11y - Accessibility helpers object
   * @returns {boolean} True if reduced motion is preferred
   */
  checkReducedMotion(a11y) {
    const result = a11y.prefersReducedMotion
      ? a11y.prefersReducedMotion()
      : false;

    this.logInfo("Checked reduced motion preference", {
      prefersReducedMotion: result,
      hasA11yHelper: !!a11y.prefersReducedMotion,
    });

    return result;
  }
}
