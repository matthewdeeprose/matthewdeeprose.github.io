/**
 * OpenRouter Client Module - Utilities
 *
 * Provides utility functions and error handling for the OpenRouter client.
 * Includes error types, logging utilities, and helper functions.
 */

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

/**
 * Current logging level - can be modified at runtime
 */
let currentLogLevel = DEFAULT_LOG_LEVEL;

/**
 * Custom error class for OpenRouter client errors
 */
export class OpenRouterClientError extends Error {
  /**
   * Create a new OpenRouterClientError
   * @param {string} message - Error message
   * @param {string} code - Error code from ErrorCodes
   * @param {Object} metadata - Additional error metadata
   */
  constructor(message, code, metadata = {}) {
    super(message);
    this.name = "OpenRouterClientError";
    this.code = code;
    this.metadata = metadata;
  }
}

/**
 * Error codes for OpenRouter client errors
 */
export const ErrorCodes = {
  INVALID_PARAMETERS: "INVALID_PARAMETERS",
  API_ERROR: "API_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  DISPLAY_ERROR: "DISPLAY_ERROR",
};

/**
 * Logging utility for OpenRouter client
 */
export class OpenRouterUtils {
  /**
   * Create a new OpenRouterUtils instance
   */
  constructor() {
    this.debugMode = false; // Maintained for backwards compatibility
    this.logLevel = currentLogLevel;
  }

  /**
   * Enable or disable debug mode (backwards compatibility)
   * @param {boolean} enabled - Whether debug mode should be enabled
   */
  setDebugMode(enabled) {
    this.debugMode = Boolean(enabled);
    // When debug mode is enabled, set log level to DEBUG
    if (enabled) {
      this.setLogLevel(LOG_LEVELS.DEBUG);
    } else {
      this.setLogLevel(DEFAULT_LOG_LEVEL);
    }
  }

  /**
   * Set the current logging level
   * @param {number} level - Log level from LOG_LEVELS
   */
  setLogLevel(level) {
    if (Object.values(LOG_LEVELS).includes(level)) {
      this.logLevel = level;
      currentLogLevel = level;
    } else {
      this.warn("Invalid log level specified", {
        providedLevel: level,
        validLevels: LOG_LEVELS,
      });
    }
  }

  /**
   * Get the current logging level
   * @returns {number} Current log level
   */
  getLogLevel() {
    return this.logLevel;
  }

  /**
   * Check if logging should occur for the specified level
   * @param {number} messageLevel - The level of the message to log
   * @returns {boolean} Whether logging should occur
   */
  shouldLog(messageLevel) {
    // Override flags take precedence
    if (DISABLE_ALL_LOGGING) {
      return false;
    }
    if (ENABLE_ALL_LOGGING) {
      return true;
    }

    // Normal level checking - lower numbers = higher priority
    return messageLevel <= this.logLevel;
  }

  /**
   * Check if error logging is enabled
   * @returns {boolean} Whether error logging should occur
   */
  shouldLogError() {
    return this.shouldLog(LOG_LEVELS.ERROR);
  }

  /**
   * Check if warning logging is enabled
   * @returns {boolean} Whether warning logging should occur
   */
  shouldLogWarn() {
    return this.shouldLog(LOG_LEVELS.WARN);
  }

  /**
   * Check if info logging is enabled
   * @returns {boolean} Whether info logging should occur
   */
  shouldLogInfo() {
    return this.shouldLog(LOG_LEVELS.INFO);
  }

  /**
   * Check if debug logging is enabled
   * @returns {boolean} Whether debug logging should occur
   */
  shouldLogDebug() {
    return this.shouldLog(LOG_LEVELS.DEBUG);
  }

  /**
   * Log a message at the specified level
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  log(level, message, data = {}) {
    // Map string levels to numeric levels
    const levelMap = {
      error: LOG_LEVELS.ERROR,
      warn: LOG_LEVELS.WARN,
      info: LOG_LEVELS.INFO,
      debug: LOG_LEVELS.DEBUG,
    };

    const numericLevel =
      levelMap[level] !== undefined ? levelMap[level] : LOG_LEVELS.INFO;

    // Check if we should log this message
    if (!this.shouldLog(numericLevel)) {
      return;
    }

    // Backwards compatibility check for debug mode
    if (
      level === "debug" &&
      !this.debugMode &&
      this.logLevel < LOG_LEVELS.DEBUG
    ) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      ...data,
    };

    switch (level) {
      case "error":
        console.error(`[OpenRouter][${timestamp}] ${message}`, data);
        break;
      case "warn":
        console.warn(`[OpenRouter][${timestamp}] ${message}`, data);
        break;
      case "debug":
        console.debug(`[OpenRouter][${timestamp}] ${message}`, data);
        break;
      case "info":
      default:
        console.log(`[OpenRouter][${timestamp}] ${message}`, data);
        break;
    }

    return logData;
  }

  /**
   * Log an info message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  info(message, data = {}) {
    return this.log("info", message, data);
  }

  /**
   * Log a warning message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  warn(message, data = {}) {
    return this.log("warn", message, data);
  }

  /**
   * Log an error message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  error(message, data = {}) {
    return this.log("error", message, data);
  }

  /**
   * Log a debug message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  debug(message, data = {}) {
    // Check if debug logging should occur
    if (!this.shouldLogDebug() && !this.debugMode) {
      return;
    }

    const enhancedData = {
      ...data,
      timestamp: new Date().toISOString(),
      debugEnabled: this.debugMode,
      logLevel: this.logLevel,
    };

    console.log(
      `[OpenRouter-Debug][${enhancedData.timestamp}] ${message}`,
      enhancedData
    );

    return this.log("debug", message, enhancedData);
  }

  /**
   * Safely parse JSON with error handling
   * @param {string} jsonString - JSON string to parse
   * @param {Object} defaultValue - Default value to return if parsing fails
   * @returns {Object} Parsed JSON or default value
   */
  safeJsonParse(jsonString, defaultValue = {}) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      this.error("Failed to parse JSON", { error, jsonString });
      return defaultValue;
    }
  }

  /**
   * Safely stringify JSON with error handling
   * @param {Object} data - Data to stringify
   * @param {string} defaultValue - Default value to return if stringification fails
   * @returns {string} Stringified JSON or default value
   */
  safeJsonStringify(data, defaultValue = "{}") {
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      this.error("Failed to stringify JSON", { error, data });
      return defaultValue;
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} content - Content to escape
   * @returns {string} Escaped content
   */
  escapeHtml(content) {
    return String(content)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Get logging configuration information
   * @returns {Object} Current logging configuration
   */
  getLoggingConfig() {
    return {
      currentLevel: this.logLevel,
      debugMode: this.debugMode,
      levels: LOG_LEVELS,
      enableAllLogging: ENABLE_ALL_LOGGING,
      disableAllLogging: DISABLE_ALL_LOGGING,
      shouldLogError: this.shouldLogError(),
      shouldLogWarn: this.shouldLogWarn(),
      shouldLogInfo: this.shouldLogInfo(),
      shouldLogDebug: this.shouldLogDebug(),
    };
  }
}

// Export singleton instance
export const openRouterUtils = new OpenRouterUtils();

// Export logging configuration for external access
export {
  LOG_LEVELS,
  DEFAULT_LOG_LEVEL,
  ENABLE_ALL_LOGGING,
  DISABLE_ALL_LOGGING,
};
