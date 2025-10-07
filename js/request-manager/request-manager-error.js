/**
 * @fileoverview Request Manager Error Handler - Stage 7 Enhanced
 * Handles error conditions with comprehensive classification, recovery, and user communication
 * Integrates with the new Stage 7 error handling system for automatic recovery
 */

import { errorHandler } from "../error-handler/error-handler-main.js";
import { a11y } from "../accessibility-helpers.js";
import { modelRegistry } from "../model-definitions.js";

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

/**
 * Enhanced Request Manager Error Handler with Stage 7 comprehensive error handling
 */
export class RequestManagerError {
  /**
   * Create a new RequestManagerError instance
   * @param {Object} modelManager - Model manager instance
   * @param {Object} progressHandler - Progress handler instance
   */
  constructor(modelManager, progressHandler) {
    this.modelManager = modelManager;
    this.progressHandler = progressHandler;

    // Stage 7 enhanced error handling integration
    this.errorHandlingEnabled = true;
    this.autoRecoveryEnabled = true;
    this.userNotificationEnabled = true;

    // Error context tracking
    this.requestContext = new Map();
    this.errorHistory = [];

    logInfo("RequestManagerError: Stage 7 enhanced error handling initialised");
  }

  /**
   * Enhanced error handling with Stage 7 comprehensive recovery system
   * @param {Error} error - Error object
   * @param {string} inputText - Original input text
   * @param {Object} parameters - Request parameters
   * @param {string} requestId - Current request ID
   * @param {Function} tokenRecorder - Function to record token usage
   * @param {Function} resultsCallback - Callback for results updates
   * @returns {Promise<Object>} Error handling result
   */
  async handleError(
    error,
    inputText,
    parameters,
    requestId,
    tokenRecorder,
    resultsCallback
  ) {
    const errorStartTime = performance.now();
    logError("RequestManagerError: Handling request error:", error);

    try {
      // Record failed attempt if we have a request ID
      if (requestId && tokenRecorder) {
        tokenRecorder(requestId, null, parameters.model, false, error);
      }

      // Build comprehensive error context
      const errorContext = this.buildErrorContext(
        error,
        inputText,
        parameters,
        requestId,
        {
          tokenRecorder,
          resultsCallback,
          modelManager: this.modelManager,
          progressHandler: this.progressHandler,
        }
      );

      // Store context for potential retries
      this.requestContext.set(requestId, {
        inputText,
        parameters,
        tokenRecorder,
        resultsCallback,
        timestamp: Date.now(),
      });

      // Use Stage 7 comprehensive error handling
      if (this.errorHandlingEnabled && errorHandler) {
        const result = await this.handleErrorWithStage7System(
          error,
          errorContext,
          requestId
        );

        // Track error in history
        this.trackErrorInHistory(error, parameters, result);

        logInfo("RequestManagerError: Stage 7 error handling completed:", {
          requestId,
          recovered: result.recovered,
          handled: result.handled,
          duration: `${(performance.now() - errorStartTime).toFixed(2)}ms`,
        });

        return result;
      } else {
        // Fallback to basic error handling
        logWarn("RequestManagerError: Using fallback error handling");
        return await this.handleErrorBasic(
          error,
          inputText,
          parameters,
          requestId
        );
      }
    } catch (handlingError) {
      logError(
        "RequestManagerError: Error handling system failed:",
        handlingError
      );

      // Ultimate fallback
      return await this.handleErrorFallback(
        error,
        handlingError,
        inputText,
        parameters,
        requestId,
        resultsCallback
      );
    }
  }

  /**
   * Handle error with Stage 7 comprehensive system
   * @param {Error} error - Original error
   * @param {Object} errorContext - Comprehensive error context
   * @param {string} requestId - Request ID
   * @returns {Promise<Object>} Handling result
   */
  async handleErrorWithStage7System(error, errorContext, requestId) {
    logInfo("RequestManagerError: Using Stage 7 comprehensive error handling");

    try {
      // Configure error handling for request context
      const handlingConfig = {
        autoRecoveryEnabled: this.autoRecoveryEnabled,
        userNotificationEnabled: this.userNotificationEnabled,
        maxRecoveryAttempts: 3,
        debugMode: false,
        fallbackToBasicErrors: true,
      };

      // Temporarily configure error handler for this request
      const originalConfig = errorHandler.config;
      errorHandler.configure(handlingConfig);

      // Execute comprehensive error handling
      const result = await errorHandler.handleError(error, errorContext);

      // Restore original configuration
      errorHandler.configure(originalConfig);

      // Update progress based on result
      this.updateProgressFromResult(result, requestId);

      // Update results if needed
      this.updateResultsFromHandling(result, errorContext);

      return result;
    } catch (stage7Error) {
      logError("RequestManagerError: Stage 7 system error:", stage7Error);
      throw stage7Error;
    }
  }

  /**
   * Build comprehensive error context for Stage 7 system
   * @param {Error} error - Original error
   * @param {string} inputText - Input text
   * @param {Object} parameters - Request parameters
   * @param {string} requestId - Request ID
   * @param {Object} handlers - Handler functions
   * @returns {Object} Comprehensive error context
   */
  buildErrorContext(error, inputText, parameters, requestId, handlers) {
    return {
      // Request information
      requestId,
      inputText,
      inputLength: inputText?.length || 0,
      parameters,
      model: parameters?.model,

      // Error specifics
      retryAfter: error.headers?.get("Retry-After"),
      httpStatus: error.status,
      httpMethod: error.config?.method,
      requestUrl: error.config?.url,

      // Context for recovery
      retryFunction: async () => {
        logInfo("RequestManagerError: Executing context retry function");
        return await this.executeRetry(requestId, handlers);
      },

      // System integrations
      modelManager: handlers.modelManager,
      progressHandler: handlers.progressHandler,
      authManager: window.authManager,
      fileHandler: window.fileHandler,

      // User context
      userContext: {
        hasFileUploaded: window.fileHandler?.hasValidFile || false,
        usingAdvancedFeatures: this.isUsingAdvancedFeatures(parameters),
        isFirstTimeUser: this.isFirstTimeUser(),
        currentModel: parameters?.model,
      },

      // Recovery context
      maxRetries: 3,
      conservativeRecovery: false,
      urgentRecovery: false,
      backgroundOperation: false,

      // Notification preferences
      notificationPreference: "toast", // 'toast', 'modal', 'silent'
      silent: false,
      critical: this.isErrorCritical(error),
    };
  }

  /**
   * Execute retry with preserved context
   * @param {string} requestId - Request ID
   * @param {Object} handlers - Handler functions
   * @returns {Promise<Object>} Retry result
   */
  async executeRetry(requestId, handlers) {
    const context = this.requestContext.get(requestId);
    if (!context) {
      throw new Error("No retry context available");
    }

    logInfo("RequestManagerError: Executing retry with preserved context");

    // Trigger retry event for the request manager
    window.dispatchEvent(
      new CustomEvent("retryRequest", {
        detail: {
          requestId,
          inputText: context.inputText,
          parameters: context.parameters,
        },
      })
    );

    return { retryTriggered: true, requestId };
  }

  /**
   * Update progress from error handling result
   * @param {Object} result - Error handling result
   * @param {string} requestId - Request ID
   */
  updateProgressFromResult(result, requestId) {
    if (!this.progressHandler) return;

    if (result.recovered) {
      this.progressHandler.complete("Request recovered successfully");
    } else if (result.handled) {
      this.progressHandler.complete("Request completed with assistance");
    } else {
      this.progressHandler.complete("Request failed - please try again", false);
    }
  }

  /**
   * Update results from error handling
   * @param {Object} result - Error handling result
   * @param {Object} errorContext - Error context
   */
  updateResultsFromHandling(result, errorContext) {
    const resultsCallback = errorContext.retryFunction?.resultsCallback;
    if (!resultsCallback) return;

    if (result.recovered) {
      resultsCallback("Request recovered - processing continuing...");
    } else if (result.degraded) {
      resultsCallback(
        "Running in limited mode - some features may be unavailable."
      );
    } else if (!result.handled) {
      resultsCallback(
        "Unable to process request automatically. Please check your input and try again."
      );
    }
  }

  /**
   * Check if using advanced features
   * @param {Object} parameters - Request parameters
   * @returns {boolean} True if using advanced features
   */
  isUsingAdvancedFeatures(parameters) {
    if (!parameters) return false;

    return (
      parameters.temperature > 0.7 ||
      parameters.top_p < 0.9 ||
      parameters.frequency_penalty > 0 ||
      parameters.presence_penalty > 0 ||
      parameters.max_tokens > 2000
    );
  }

  /**
   * Check if this is a first-time user
   * @returns {boolean} True if first-time user
   */
  isFirstTimeUser() {
    // Simple heuristic - could be enhanced
    return !localStorage.getItem("previous_successful_request");
  }

  /**
   * Check if error is critical
   * @param {Error} error - Error to check
   * @returns {boolean} True if critical
   */
  isErrorCritical(error) {
    if (!error) return false;

    // Critical error indicators
    const criticalPatterns = [
      /quota.*exceeded/i,
      /authentication.*failed/i,
      /unauthorized/i,
      /service.*unavailable/i,
    ];

    return criticalPatterns.some(
      (pattern) =>
        pattern.test(error.message || "") ||
        pattern.test(error.statusText || "")
    );
  }

  /**
   * Track error in history for pattern analysis
   * @param {Error} error - Original error
   * @param {Object} parameters - Request parameters
   * @param {Object} result - Handling result
   */
  trackErrorInHistory(error, parameters, result) {
    this.errorHistory.push({
      timestamp: Date.now(),
      error: {
        message: error.message,
        status: error.status,
        type: error.constructor.name,
      },
      parameters: {
        model: parameters?.model,
        inputLength: parameters?.inputLength,
      },
      result: {
        handled: result.handled,
        recovered: result.recovered,
        method: result.strategy,
      },
    });

    // Keep only last 50 errors
    if (this.errorHistory.length > 50) {
      this.errorHistory.shift();
    }
  }

  /**
   * Basic error handling fallback
   * @param {Error} error - Error object
   * @param {string} inputText - Input text
   * @param {Object} parameters - Request parameters
   * @param {string} requestId - Request ID
   * @returns {Promise<Object>} Basic result
   */
  async handleErrorBasic(error, inputText, parameters, requestId) {
    logWarn("RequestManagerError: Using basic error handling fallback");

    // Update progress with generic message
    this.progressHandler.complete("Request failed. Please try again.", false);

    return {
      handled: true,
      recovered: false,
      method: "basic_fallback",
      error: error.message || "Unknown error",
    };
  }

  /**
   * Ultimate fallback error handling
   * @param {Error} originalError - Original error
   * @param {Error} handlingError - Error in handling
   * @param {string} inputText - Input text
   * @param {Object} parameters - Request parameters
   * @param {string} requestId - Request ID
   * @param {Function} resultsCallback - Results callback
   * @returns {Promise<Object>} Fallback result
   */
  async handleErrorFallback(
    originalError,
    handlingError,
    inputText,
    parameters,
    requestId,
    resultsCallback
  ) {
    logError("RequestManagerError: Using ultimate fallback handling:", {
      originalError: originalError.message,
      handlingError: handlingError.message,
      requestId,
    });

    // Console error for debugging
    console.error("CRITICAL: All error handling failed:", {
      original: originalError,
      handling: handlingError,
      requestId,
    });

    // Basic user notification
    if (window.notifyError) {
      window.notifyError(
        "A serious error occurred. Please refresh the page and try again.",
        {
          duration: 10000,
          persistent: true,
        }
      );
    }

    // Update progress
    this.progressHandler.complete(
      "Critical error - please refresh page",
      false
    );

    // Update results
    if (resultsCallback) {
      resultsCallback(
        "A critical error occurred. Please refresh the page and try again."
      );
    }

    return {
      handled: true,
      recovered: false,
      critical: true,
      method: "ultimate_fallback",
      originalError: originalError.message,
      handlingError: handlingError.message,
    };
  }

  /**
   * Reduce parameters for retry
   * @param {Object} parameters - Current parameters
   * @returns {Object} Reduced parameters
   */
  reduceParameters(parameters) {
    return {
      ...parameters,
      max_tokens: Math.floor(parameters.max_tokens * 0.75),
      temperature: Math.max(0, parameters.temperature - 0.1),
      top_p: Math.max(0.1, parameters.top_p - 0.1),
    };
  }

  /**
   * Switch to fallback model
   * @param {string} currentModel - Current model ID
   * @returns {Promise<string|null>} New model ID or null
   */
  async switchToFallbackModel(currentModel) {
    const fallbackModel = modelRegistry.getFallbackModel(currentModel);
    if (fallbackModel) {
      await this.modelManager.updateModel(fallbackModel);
      return fallbackModel;
    }
    return null;
  }
}
