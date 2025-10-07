/**
 * @fileoverview Logging utilities for the model registry system.
 * Provides consistent logging with different severity levels and contextual information.
 */

import { ErrorCodes } from "./model-registry-errors.js";

// ========================================
// LOGGING CONFIGURATION - EDIT THESE VALUES
// ========================================

/**
 * Enable or disable all logging
 * Set to false to completely disable all logging output
 */
const LOGGING_ENABLED = false;

/**
 * Set the minimum log level to display
 * Options: "debug", "info", "warn", "error"
 * - "debug": Show all messages (most verbose)
 * - "info": Show info, warnings and errors
 * - "warn": Show warnings and errors only
 * - "error": Show errors only (least verbose)
 */
const LOG_LEVEL = "info";

/**
 * Enable or disable console output
 * Set to false to prevent any console.log/warn/error output
 */
const CONSOLE_OUTPUT = true;

/**
 * Include timestamp in log messages
 * Set to false to make log output cleaner
 */
const INCLUDE_TIMESTAMP = true;

/**
 * Prefix for all log messages
 */
const LOG_PREFIX = "[ModelRegistry]";

// ========================================
// END CONFIGURATION
// ========================================

/**
 * Log levels for the model registry logger
 */
export const LogLevels = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
};

/**
 * ModelRegistryLogger class for handling all logging in the model registry system
 */
export class ModelRegistryLogger {
  /**
   * @param {Object} options - Logger configuration options
   */
  constructor(options = {}) {
    this.options = {
      enabled: options.enabled !== false,
      level: options.level || LogLevels.INFO,
      prefix: options.prefix || "[ModelRegistry]",
      includeTimestamp: options.includeTimestamp !== false,
      consoleOutput: options.consoleOutput !== false,
      customHandler: options.customHandler || null,
    };

    // Map log levels to their severity (higher number = more severe)
    this.levelSeverity = {
      [LogLevels.DEBUG]: 0,
      [LogLevels.INFO]: 1,
      [LogLevels.WARN]: 2,
      [LogLevels.ERROR]: 3,
    };
  }

  /**
   * Format a log message with timestamp and prefix
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   * @returns {Object} Formatted log object
   * @private
   */
  _formatLog(level, message, data = {}) {
    const timestamp = this.options.includeTimestamp
      ? new Date().toISOString()
      : null;

    return {
      level,
      message: `${this.options.prefix} ${message}`,
      timestamp,
      data,
    };
  }

  /**
   * Check if a log level should be output based on current settings
   * @param {string} level - Log level to check
   * @returns {boolean} Whether the log should be output
   * @private
   */
  _shouldLog(level) {
    if (!this.options.enabled) return false;

    const currentSeverity = this.levelSeverity[this.options.level];
    const logSeverity = this.levelSeverity[level];

    return logSeverity >= currentSeverity;
  }

  /**
   * Output a log entry
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   * @private
   */
  _log(level, message, data = {}) {
    if (!this._shouldLog(level)) return;

    const logEntry = this._formatLog(level, message, data);

    // Use console for output
    if (this.options.consoleOutput) {
      const consoleMethod =
        level === LogLevels.ERROR
          ? "error"
          : level === LogLevels.WARN
          ? "warn"
          : level === LogLevels.DEBUG
          ? "debug"
          : "log";

      if (Object.keys(data).length > 0) {
        console[consoleMethod](logEntry.message, data);
      } else {
        console[consoleMethod](logEntry.message);
      }
    }

    // Use custom handler if provided
    if (typeof this.options.customHandler === "function") {
      this.options.customHandler(logEntry);
    }

    return logEntry;
  }

  /**
   * Log a debug message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  debug(message, data = {}) {
    return this._log(LogLevels.DEBUG, message, data);
  }

  /**
   * Log an info message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  info(message, data = {}) {
    return this._log(LogLevels.INFO, message, data);
  }

  /**
   * Log a warning message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  warn(message, data = {}) {
    return this._log(LogLevels.WARN, message, data);
  }

  /**
   * Log an error message
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  error(message, data = {}) {
    return this._log(LogLevels.ERROR, message, data);
  }

  /**
   * Log a model validation error
   * @param {string} modelId - ID of the model
   * @param {Array} issues - Validation issues
   */
  modelValidationError(modelId, issues) {
    return this.error(`Model validation failed for ${modelId}`, {
      modelId,
      issues,
      code: ErrorCodes.VALIDATION_ERROR,
    });
  }

  /**
   * Log a model registration event
   * @param {string} modelId - ID of the model
   * @param {Object} model - Model configuration
   */
  modelRegistered(modelId, model) {
    return this.info(`Model registered: ${modelId}`, {
      modelId,
      provider: model.provider,
      category: model.category,
    });
  }

  /**
   * Log a fallback validation issue
   * @param {string} modelId - ID of the model
   * @param {string} fallbackId - ID of the fallback model
   * @param {string} reason - Reason for invalidity
   */
  fallbackValidationIssue(modelId, fallbackId, reason) {
    return this.warn(
      `Invalid fallback configuration: ${modelId} → ${fallbackId}`,
      {
        modelId,
        fallbackId,
        reason,
        code: ErrorCodes.INVALID_FALLBACK,
      }
    );
  }

  /**
   * Log a fallback correction event
   * @param {string} modelId - ID of the model
   * @param {string} originalFallback - Original fallback ID
   * @param {string} newFallback - New fallback ID
   * @param {string} reason - Reason for correction
   */
  fallbackCorrected(modelId, originalFallback, newFallback, reason) {
    return this.info(`Fallback corrected for ${modelId}`, {
      modelId,
      originalFallback,
      newFallback,
      reason,
    });
  }
}

// Create and export a singleton instance using the configuration variables
export const logger = new ModelRegistryLogger({
  enabled: LOGGING_ENABLED,
  level: LOG_LEVEL,
  consoleOutput: CONSOLE_OUTPUT,
  includeTimestamp: INCLUDE_TIMESTAMP,
  prefix: LOG_PREFIX,
});
