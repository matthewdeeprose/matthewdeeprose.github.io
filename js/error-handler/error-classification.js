/**
 * @fileoverview Error Classification System
 * Categorises and prioritises errors for appropriate handling
 * Follows British spelling conventions and WCAG 2.2 AA accessibility standards
 */

// Logging configuration
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

export class ErrorClassification {
  constructor() {
    this.errorCategories = {
      NETWORK: {
        priority: "high",
        recoverable: true,
        userAction: "retry",
        patterns: [
          /network/i,
          /fetch/i,
          /connection/i,
          /timeout/i,
          /ERR_NETWORK/i,
        ],
        description: "Network connectivity issues",
      },
      RATE_LIMIT: {
        priority: "medium",
        recoverable: true,
        userAction: "wait",
        patterns: [/rate.?limit/i, /429/, /too.?many/i, /quota.*exceeded/i],
        description: "API rate limiting",
      },
      AUTH: {
        priority: "critical",
        recoverable: false,
        userAction: "reauthenticate",
        patterns: [
          /401/,
          /403/,
          /unauthorized/i,
          /forbidden/i,
          /invalid.*key/i,
        ],
        description: "Authentication and authorisation issues",
      },
      FILE_PROCESSING: {
        priority: "high",
        recoverable: true,
        userAction: "check_file",
        patterns: [
          /file/i,
          /upload/i,
          /corrupt/i,
          /invalid.?format/i,
          /too.?large/i,
        ],
        description: "File upload and processing errors",
      },
      API_ERROR: {
        priority: "high",
        recoverable: true,
        userAction: "retry",
        patterns: [
          /500/,
          /502/,
          /503/,
          /504/,
          /internal.?server/i,
          /service.?unavailable/i,
        ],
        description: "API server errors",
      },
      VALIDATION: {
        priority: "low",
        recoverable: true,
        userAction: "correct_input",
        patterns: [/validation/i, /invalid/i, /required/i, /missing/i],
        description: "Input validation errors",
      },
      QUOTA: {
        priority: "medium",
        recoverable: false,
        userAction: "upgrade",
        patterns: [
          /quota/i,
          /limit.?exceeded/i,
          /insufficient.?funds/i,
          /balance/i,
        ],
        description: "Usage quota and billing issues",
      },
      BROWSER: {
        priority: "medium",
        recoverable: true,
        userAction: "refresh",
        patterns: [
          /dom/i,
          /element.*not.*found/i,
          /localStorage/i,
          /sessionStorage/i,
        ],
        description: "Browser compatibility and DOM issues",
      },
    };

    this.errorHistory = [];
    this.maxHistorySize = 100;
    this.patternCache = new Map();

    // Performance tracking
    this.classificationMetrics = {
      totalClassifications: 0,
      categoryCounts: {},
      averageClassificationTime: 0,
    };

    logInfo("ErrorClassification: System initialised with enhanced patterns");
  }

  /**
   * Classify an error based on its characteristics
   * @param {Error|Object|string} error - Error to classify
   * @param {Object} context - Additional context about the error
   * @returns {Object} Classification details
   */
  classifyError(error, context = {}) {
    const startTime = performance.now();
    logDebug("ErrorClassification: Classifying error:", error);

    const errorString = this.getErrorString(error);
    const classification = {
      category: "UNKNOWN",
      priority: "medium",
      recoverable: false,
      userAction: "retry",
      message: errorString,
      originalError: error,
      timestamp: Date.now(),
      context: {
        ...this.getErrorContext(error),
        ...context,
      },
      classificationTime: 0,
    };

    // Check cache first for performance
    const cacheKey = this.getCacheKey(errorString, error.status);
    if (this.patternCache.has(cacheKey)) {
      const cached = this.patternCache.get(cacheKey);
      Object.assign(classification, cached);
      logDebug("ErrorClassification: Used cached classification");
    } else {
      // Classify by patterns
      this.classifyByPatterns(errorString, classification);

      // Special handling for HTTP status codes
      if (error.status || error.code) {
        this.classifyByStatusCode(error.status || error.code, classification);
      }

      // Cache the result
      this.patternCache.set(cacheKey, {
        category: classification.category,
        priority: classification.priority,
        recoverable: classification.recoverable,
        userAction: classification.userAction,
      });
    }

    // Enhanced classification based on context
    this.enhanceClassificationWithContext(classification, context);

    // Performance tracking
    const classificationTime = performance.now() - startTime;
    classification.classificationTime = classificationTime;
    this.updateMetrics(classification, classificationTime);

    // Add to history
    this.addToHistory(classification);

    logInfo("ErrorClassification: Error classified:", {
      category: classification.category,
      priority: classification.priority,
      recoverable: classification.recoverable,
      time: `${classificationTime.toFixed(2)}ms`,
    });

    return classification;
  }

  /**
   * Classify by pattern matching
   * @param {string} errorString - Error string to match
   * @param {Object} classification - Classification to update
   */
  classifyByPatterns(errorString, classification) {
    for (const [category, config] of Object.entries(this.errorCategories)) {
      if (config.patterns.some((pattern) => pattern.test(errorString))) {
        classification.category = category;
        classification.priority = config.priority;
        classification.recoverable = config.recoverable;
        classification.userAction = config.userAction;
        classification.description = config.description;
        break;
      }
    }
  }

  /**
   * Classify by HTTP status code or error code
   * @param {number|string} statusCode - Status code to classify
   * @param {Object} classification - Classification to update
   */
  classifyByStatusCode(statusCode, classification) {
    const status = parseInt(statusCode);

    if (status === 429) {
      classification.category = "RATE_LIMIT";
      classification.recoverable = true;
      classification.userAction = "wait";
      classification.priority = "medium";
    } else if (status === 401 || status === 403) {
      classification.category = "AUTH";
      classification.priority = "critical";
      classification.recoverable = false;
    } else if (status >= 500 && status < 600) {
      classification.category = "API_ERROR";
      classification.priority = "high";
      classification.recoverable = true;
    } else if (status === 413) {
      classification.category = "FILE_PROCESSING";
      classification.message = "File too large";
      classification.recoverable = true;
    } else if (status >= 400 && status < 500) {
      classification.category = "VALIDATION";
      classification.priority = "low";
      classification.recoverable = true;
    }
  }

  /**
   * Enhance classification with context information
   * @param {Object} classification - Classification to enhance
   * @param {Object} context - Context information
   */
  enhanceClassificationWithContext(classification, context) {
    // File-related context
    if (context.fileSize && context.fileSize > 10 * 1024 * 1024) {
      // 10MB
      if (
        classification.category === "UNKNOWN" ||
        classification.category === "NETWORK"
      ) {
        classification.category = "FILE_PROCESSING";
        classification.userAction = "reduce_file_size";
      }
    }

    // Request-related context
    if (
      context.requestType === "streaming" &&
      classification.category === "NETWORK"
    ) {
      classification.recoverable = true;
      classification.userAction = "retry";
    }

    // Model-related context
    if (context.model && classification.category === "API_ERROR") {
      classification.context.suggestedFallbackModel = true;
    }

    // Browser context
    if (
      context.userAgent &&
      context.userAgent.includes("Safari") &&
      classification.category === "UNKNOWN"
    ) {
      classification.category = "BROWSER";
      classification.recoverable = true;
    }
  }

  /**
   * Get string representation of error
   * @param {Error|Object|string} error - Error to stringify
   * @returns {string} Error string
   */
  getErrorString(error) {
    if (typeof error === "string") return error;
    if (error?.message) return error.message;
    if (error?.error) return this.getErrorString(error.error);
    if (error?.statusText) return error.statusText;
    if (error?.name)
      return `${error.name}: ${error.message || "Unknown error"}`;
    return JSON.stringify(error);
  }

  /**
   * Get comprehensive error context
   * @param {Error|Object} error - Error object
   * @returns {Object} Context information
   */
  getErrorContext(error) {
    return {
      stack: error?.stack,
      code: error?.code,
      status: error?.status,
      statusText: error?.statusText,
      url: error?.url,
      method: error?.method,
      headers: error?.headers,
      timestamp: new Date().toISOString(),
      userAgent: navigator?.userAgent,
      online: navigator?.onLine,
      connection: navigator?.connection?.effectiveType,
    };
  }

  /**
   * Generate cache key for pattern matching
   * @param {string} errorString - Error string
   * @param {number} status - HTTP status
   * @returns {string} Cache key
   */
  getCacheKey(errorString, status) {
    const key = `${errorString.toLowerCase().substring(0, 50)}_${
      status || "nostatus"
    }`;
    return key.replace(/[^a-z0-9_]/g, "_");
  }

  /**
   * Add error to history with size management
   * @param {Object} classification - Error classification
   */
  addToHistory(classification) {
    // Create lightweight history entry
    const historyEntry = {
      category: classification.category,
      priority: classification.priority,
      timestamp: classification.timestamp,
      message: classification.message.substring(0, 100), // Truncate for memory
      recoverable: classification.recoverable,
      classificationTime: classification.classificationTime,
    };

    this.errorHistory.unshift(historyEntry);

    // Maintain size limit
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.pop();
    }
  }

  /**
   * Update classification metrics
   * @param {Object} classification - Error classification
   * @param {number} classificationTime - Time taken to classify
   */
  updateMetrics(classification, classificationTime) {
    this.classificationMetrics.totalClassifications++;

    // Update category counts
    const category = classification.category;
    this.classificationMetrics.categoryCounts[category] =
      (this.classificationMetrics.categoryCounts[category] || 0) + 1;

    // Update average classification time
    const total = this.classificationMetrics.totalClassifications;
    const currentAvg = this.classificationMetrics.averageClassificationTime;
    this.classificationMetrics.averageClassificationTime =
      (currentAvg * (total - 1) + classificationTime) / total;
  }

  /**
   * Get recent errors of specific category
   * @param {string} category - Error category (optional)
   * @param {number} timeWindow - Time window in milliseconds
   * @returns {Array} Recent errors
   */
  getRecentErrors(category = null, timeWindow = 60000) {
    const cutoff = Date.now() - timeWindow;
    return this.errorHistory.filter(
      (error) =>
        error.timestamp > cutoff && (!category || error.category === category)
    );
  }

  /**
   * Check if experiencing repeated errors
   * @param {string} category - Error category
   * @param {number} threshold - Error count threshold
   * @param {number} timeWindow - Time window in milliseconds
   * @returns {boolean} True if repeated errors detected
   */
  hasRepeatedErrors(category, threshold = 3, timeWindow = 30000) {
    const recentErrors = this.getRecentErrors(category, timeWindow);
    return recentErrors.length >= threshold;
  }

  /**
   * Get error pattern statistics
   * @returns {Object} Pattern statistics
   */
  getErrorStatistics() {
    return {
      totalErrors: this.errorHistory.length,
      categoryCounts: { ...this.classificationMetrics.categoryCounts },
      averageClassificationTime:
        this.classificationMetrics.averageClassificationTime,
      cacheHitRate:
        this.patternCache.size > 0
          ? (this.classificationMetrics.totalClassifications -
              this.patternCache.size) /
            this.classificationMetrics.totalClassifications
          : 0,
      recentErrorRate: this.getRecentErrors(null, 300000).length, // Last 5 minutes
    };
  }

  /**
   * Clear error history and reset metrics
   */
  clearHistory() {
    this.errorHistory.length = 0;
    this.patternCache.clear();
    this.classificationMetrics = {
      totalClassifications: 0,
      categoryCounts: {},
      averageClassificationTime: 0,
    };
    logInfo("ErrorClassification: History and metrics cleared");
  }

  /**
   * Export error data for analysis
   * @returns {Object} Exportable error data
   */
  exportErrorData() {
    return {
      history: this.errorHistory,
      metrics: this.classificationMetrics,
      categories: Object.keys(this.errorCategories),
      exportedAt: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const errorClassification = new ErrorClassification();
