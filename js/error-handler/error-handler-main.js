/**
 * @fileoverview Main Error Handler Integration
 * Comprehensive error handling system that integrates classification, recovery, and user communication
 * Serves as the primary interface for error handling throughout the application
 */

import { errorClassification } from "./error-classification.js";
import { recoveryStrategies } from "./recovery-strategies.js";
import { errorMessages } from "./error-messages.js";

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

export class ErrorHandlerMain {
  constructor() {
    this.config = {
      autoRecoveryEnabled: true,
      maxRecoveryAttempts: 3,
      userNotificationEnabled: true,
      accessibilityAnnouncements: true,
      debugMode: false,
      fallbackToBasicErrors: true,
    };

    // Test mode configuration
    this.testMode = false;

    // Error handling state
    this.errorQueue = [];
    this.activeErrorHandling = new Map();
    this.userInteractionMode = "automatic"; // 'automatic', 'prompt', 'manual'

    // Integration with existing systems
    this.notificationSystem = null;
    this.modalSystem = null;
    this.accessibilitySystem = null;

    // Performance tracking
    this.errorMetrics = {
      totalErrors: 0,
      autoRecoveredErrors: 0,
      userInterventionRequired: 0,
      averageHandlingTime: 0,
    };

    // Initialize integrations
    this.initializeSystemIntegrations();

    logInfo(
      "ErrorHandlerMain: Comprehensive error handling system initialised"
    );
  }

  /**
   * Set test mode for automated testing
   * @param {boolean} enabled - Whether test mode is enabled
   */
  setTestMode(enabled) {
    this.testMode = enabled;
    logInfo(`ErrorHandlerMain: Test mode ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Initialize integrations with existing systems
   */
  initializeSystemIntegrations() {
    // Universal notification system
    if (typeof window !== "undefined") {
      this.notificationSystem = {
        success: window.notifySuccess,
        error: window.notifyError,
        warning: window.notifyWarning,
        info: window.notifyInfo,
      };

      // Universal modal system
      this.modalSystem = window.UniversalModal;

      // Accessibility system
      this.accessibilitySystem = window.a11y || window.accessibility;
    }

    logDebug("ErrorHandlerMain: System integrations initialised");
  }

  /**
   * Main error handling entry point
   * @param {Error|Object|string} error - Error to handle
   * @param {Object} context - Error context and handling options
   * @returns {Promise<Object>} Handling result
   */
  async handleError(error, context = {}) {
    const handlingStartTime = performance.now();
    const handlingId = this.generateHandlingId();

    logInfo("ErrorHandlerMain: Starting comprehensive error handling:", {
      handlingId,
      errorType: typeof error,
      hasContext: !!Object.keys(context).length,
    });

    try {
      // Step 1: Classify the error
      const classification = this.classifyError(error, context);

      // Step 2: Create handling record
      const handlingRecord = this.createHandlingRecord(
        handlingId,
        error,
        classification,
        context,
        handlingStartTime
      );

      this.activeErrorHandling.set(handlingId, handlingRecord);

      // Step 3: Determine handling strategy
      const handlingStrategy = this.determineHandlingStrategy(
        classification,
        context
      );

      // Step 4: Execute handling strategy
      const result = await this.executeHandlingStrategy(
        handlingStrategy,
        classification,
        context,
        handlingRecord
      );

      // Step 5: Complete handling
      this.completeErrorHandling(handlingId, result, handlingStartTime);

      return result;
    } catch (handlingError) {
      logError("ErrorHandlerMain: Error handling failed:", handlingError);

      // Fallback error handling
      const fallbackResult = await this.handleFallbackError(
        error,
        handlingError,
        context,
        handlingId
      );

      this.completeErrorHandling(handlingId, fallbackResult, handlingStartTime);
      return fallbackResult;
    }
  }

  /**
   * Classify error using enhanced classification system
   * @param {Error|Object|string} error - Error to classify
   * @param {Object} context - Error context
   * @returns {Object} Error classification
   */
  classifyError(error, context) {
    try {
      return errorClassification.classifyError(error, context);
    } catch (classificationError) {
      logWarn(
        "ErrorHandlerMain: Classification failed, using fallback:",
        classificationError
      );

      // Fallback classification
      return {
        category: "UNKNOWN",
        priority: "medium",
        recoverable: true,
        userAction: "retry",
        message: this.extractErrorMessage(error),
        timestamp: Date.now(),
        context: context,
      };
    }
  }

  /**
   * Determine handling strategy based on classification and context
   * @param {Object} classification - Error classification
   * @param {Object} context - Error context
   * @returns {Object} Handling strategy
   */
  determineHandlingStrategy(classification, context) {
    const strategy = {
      approach: "comprehensive",
      notifyUser: this.config.userNotificationEnabled,
      attemptRecovery:
        this.config.autoRecoveryEnabled && classification.recoverable,
      requireUserDecision: false,
      fallbackToManual: true,
    };

    // Context-based strategy adjustments
    if (context.silent) {
      strategy.notifyUser = false;
      strategy.approach = "silent";
    }

    if (context.critical) {
      strategy.notifyUser = true;
      strategy.requireUserDecision = true;
      strategy.approach = "critical";
    }

    if (context.backgroundOperation) {
      strategy.attemptRecovery = true;
      strategy.notifyUser = classification.priority === "critical";
      strategy.approach = "background";
    }

    // Priority-based adjustments
    if (classification.priority === "critical") {
      strategy.notifyUser = true;
      strategy.requireUserDecision = true;
    }

    // User interaction mode adjustments
    if (this.userInteractionMode === "manual") {
      strategy.attemptRecovery = false;
      strategy.requireUserDecision = true;
    } else if (this.userInteractionMode === "prompt") {
      strategy.requireUserDecision = classification.priority !== "low";
    }

    logDebug("ErrorHandlerMain: Determined handling strategy:", strategy);
    return strategy;
  }

  /**
   * Execute the determined handling strategy
   * @param {Object} strategy - Handling strategy
   * @param {Object} classification - Error classification
   * @param {Object} context - Error context
   * @param {Object} handlingRecord - Handling record
   * @returns {Promise<Object>} Handling result
   */
  async executeHandlingStrategy(
    strategy,
    classification,
    context,
    handlingRecord
  ) {
    const result = {
      handled: false,
      recovered: false,
      userNotified: false,
      strategy: strategy.approach,
      classification: classification,
    };

    try {
      // Phase 1: User notification (if required)
      if (strategy.notifyUser) {
        await this.notifyUser(
          classification,
          context,
          strategy,
          handlingRecord
        );
        result.userNotified = true;
      }

      // Phase 2: Recovery attempt (if enabled and applicable)
      if (strategy.attemptRecovery) {
        const recoveryResult = await this.attemptRecovery(
          classification,
          context,
          strategy,
          handlingRecord
        );

        if (recoveryResult.success) {
          result.recovered = true;
          result.recoveryMethod = recoveryResult.method;
          result.handled = true;

          // Notify user of successful recovery
          await this.notifyRecoverySuccess(
            classification,
            recoveryResult,
            handlingRecord
          );
          return result;
        } else {
          result.recoveryAttempted = true;
          result.recoveryFailureReason = recoveryResult.reason;
        }
      }

      // Phase 3: User decision (if required)
      if (strategy.requireUserDecision) {
        const userDecision = await this.getUserDecision(
          classification,
          context,
          strategy,
          handlingRecord
        );

        result.userDecision = userDecision;

        if (userDecision.action === "retry" && context.retryFunction) {
          const retryResult = await this.executeUserRetry(
            context,
            handlingRecord
          );
          result.handled = retryResult.success;
          result.retryResult = retryResult;
        } else if (userDecision.action === "ignore") {
          result.handled = true;
          result.ignoredByUser = true;
        }
      }

      // Phase 4: Fallback handling
      if (!result.handled && strategy.fallbackToManual) {
        await this.executeFallbackHandling(
          classification,
          context,
          handlingRecord
        );
        result.handled = true;
        result.fallbackUsed = true;
      }

      return result;
    } catch (strategyError) {
      logError("ErrorHandlerMain: Strategy execution failed:", strategyError);
      throw strategyError;
    }
  }

  /**
   * Notify user about error with appropriate method
   * @param {Object} classification - Error classification
   * @param {Object} context - Error context
   * @param {Object} strategy - Handling strategy
   * @param {Object} handlingRecord - Handling record
   */
  async notifyUser(classification, context, strategy, handlingRecord) {
    try {
      // Generate user-friendly message
      const userMessage = errorMessages.getUserMessage(classification, {
        recovering: strategy.attemptRecovery,
        urgent: classification.priority === "critical",
        userContext: context.userContext,
        screenReaderOptimised: this.config.accessibilityAnnouncements,
      });

      // Choose notification method based on priority and context
      const notificationMethod = this.chooseNotificationMethod(
        classification.priority,
        strategy.approach,
        context.notificationPreference
      );

      // Send notification
      await this.sendNotification(
        userMessage,
        notificationMethod,
        handlingRecord
      );

      // Accessibility announcement
      if (this.config.accessibilityAnnouncements && this.accessibilitySystem) {
        const srText = userMessage.screenReaderText || userMessage.message;
        const priority =
          classification.priority === "critical" ? "assertive" : "polite";

        if (this.accessibilitySystem.announceStatus) {
          this.accessibilitySystem.announceStatus(srText, priority);
        }
      }

      logDebug("ErrorHandlerMain: User notification sent:", {
        method: notificationMethod,
        priority: classification.priority,
      });
    } catch (notificationError) {
      logWarn("ErrorHandlerMain: User notification failed:", notificationError);

      // Fallback to console for critical errors
      if (classification.priority === "critical") {
        console.error("CRITICAL ERROR:", classification.message);
      }
    }
  }

  /**
   * Attempt automatic recovery
   * @param {Object} classification - Error classification
   * @param {Object} context - Error context
   * @param {Object} strategy - Handling strategy
   * @param {Object} handlingRecord - Handling record
   * @returns {Promise<Object>} Recovery result
   */
  async attemptRecovery(classification, context, strategy, handlingRecord) {
    logInfo("ErrorHandlerMain: Attempting automatic recovery");

    try {
      // Get recovery strategy
      const recoveryStrategy = recoveryStrategies.getStrategy(classification, {
        urgentRecovery: classification.priority === "critical",
        conservativeRecovery: context.conservativeRecovery,
      });

      // Update user about recovery attempt
      if (this.notificationSystem?.info && !context.silent) {
        const recoveryMessage = errorMessages.getRecoveryMessage(
          recoveryStrategy.name,
          "starting"
        );

        this.notificationSystem.info(recoveryMessage, { duration: 8000 });
      }

      // Execute recovery
      const recoveryResult = await recoveryStrategies.executeStrategy(
        recoveryStrategy,
        {
          ...context,
          attemptNumber: recoveryStrategy.attemptNumber,
          maxAttempts: this.config.maxRecoveryAttempts,
        }
      );

      return {
        success: true,
        method: recoveryStrategy.name,
        result: recoveryResult,
        attemptNumber: recoveryStrategy.attemptNumber,
      };
    } catch (recoveryError) {
      logWarn("ErrorHandlerMain: Recovery attempt failed:", recoveryError);

      return {
        success: false,
        reason: recoveryError.message,
        error: recoveryError,
      };
    }
  }

  /**
   * Get user decision for error handling
   * @param {Object} classification - Error classification
   * @param {Object} context - Error context
   * @param {Object} strategy - Handling strategy
   * @param {Object} handlingRecord - Handling record
   * @returns {Promise<Object>} User decision
   */
  async getUserDecision(classification, context, strategy, handlingRecord) {
    try {
      // Skip user decision modal in test mode
      if (this.testMode) {
        logDebug("ErrorHandlerMain: Test mode - skipping user decision modal");
        return {
          action: "ignore",
          reason: "test_mode_skip",
          testMode: true,
          simulatedDecision: "auto_handled",
        };
      }

      if (!this.modalSystem?.confirm) {
        logWarn("ErrorHandlerMain: Modal system unavailable for user decision");
        return { action: "ignore", reason: "no_modal_system" };
      }

      // Create decision prompt
      const userMessage = errorMessages.getUserMessage(classification, {
        showTechnical: this.config.debugMode,
        userContext: context.userContext,
      });

      const modalContent = errorMessages.formatForModal(userMessage);

      const decisions = await this.presentErrorDecisionModal(
        modalContent,
        classification,
        context
      );

      logDebug("ErrorHandlerMain: User decision received:", decisions);
      return decisions;
    } catch (decisionError) {
      logError("ErrorHandlerMain: User decision failed:", decisionError);
      return {
        action: "ignore",
        reason: "decision_error",
        error: decisionError,
      };
    }
  }

  /**
   * Present error decision modal to user
   * @param {string} modalContent - Modal content HTML
   * @param {Object} classification - Error classification
   * @param {Object} context - Error context
   * @returns {Promise<Object>} User decision
   */
  async presentErrorDecisionModal(modalContent, classification, context) {
    return new Promise((resolve) => {
      const modalConfig = {
        title: `Error: ${classification.category}`,
        content: modalContent,
        size: "medium",
        buttons: this.generateModalButtons(classification, context, resolve),
        onClose: () => resolve({ action: "ignore", method: "modal_closed" }),
      };

      this.modalSystem.create(modalConfig);
    });
  }

  /**
   * Generate modal buttons based on error type
   * @param {Object} classification - Error classification
   * @param {Object} context - Error context
   * @param {Function} resolve - Promise resolve function
   * @returns {Array} Modal buttons
   */
  generateModalButtons(classification, context, resolve) {
    const buttons = [];

    // Retry button (if applicable)
    if (classification.recoverable && context.retryFunction) {
      buttons.push({
        text: "Try Again",
        style: "primary",
        onClick: () => resolve({ action: "retry", method: "user_retry" }),
      });
    }

    // Ignore/Continue button
    buttons.push({
      text: "Continue",
      style: "secondary",
      onClick: () => resolve({ action: "ignore", method: "user_continue" }),
    });

    // Get help button (for critical errors)
    if (classification.priority === "critical") {
      buttons.push({
        text: "Get Help",
        style: "tertiary",
        onClick: () => resolve({ action: "help", method: "user_help" }),
      });
    }

    return buttons;
  }

  /**
   * Execute user retry
   * @param {Object} context - Error context
   * @param {Object} handlingRecord - Handling record
   * @returns {Promise<Object>} Retry result
   */
  async executeUserRetry(context, handlingRecord) {
    try {
      if (!context.retryFunction) {
        throw new Error("No retry function provided");
      }

      logInfo("ErrorHandlerMain: Executing user-requested retry");

      // Update user about retry
      if (this.notificationSystem?.info) {
        this.notificationSystem.info("Retrying as requested...", {
          duration: 5000,
        });
      }

      const retryResult = await context.retryFunction();

      // Success notification
      if (this.notificationSystem?.success) {
        this.notificationSystem.success("Retry successful!", {
          duration: 4000,
        });
      }

      return { success: true, result: retryResult };
    } catch (retryError) {
      logWarn("ErrorHandlerMain: User retry failed:", retryError);

      // Failure notification
      if (this.notificationSystem?.error) {
        this.notificationSystem.error(
          "Retry failed. Please try a different approach.",
          {
            duration: 8000,
          }
        );
      }

      return { success: false, error: retryError };
    }
  }

  /**
   * Execute fallback handling
   * @param {Object} classification - Error classification
   * @param {Object} context - Error context
   * @param {Object} handlingRecord - Handling record
   */
  async executeFallbackHandling(classification, context, handlingRecord) {
    logInfo("ErrorHandlerMain: Executing fallback handling");

    // Basic error logging
    logError("Fallback error handling:", {
      category: classification.category,
      message: classification.message,
      context: context,
    });

    // Basic user notification
    if (this.notificationSystem?.warning && !context.silent) {
      const fallbackMessage = `An error occurred: ${classification.message}. Please try again or contact support.`;
      this.notificationSystem.warning(fallbackMessage, { duration: 10000 });
    }

    // Console notification for debugging
    if (this.config.debugMode) {
      console.group("Error Handling Fallback");
      console.error("Original Error:", classification);
      console.log("Context:", context);
      console.log("Handling Record:", handlingRecord);
      console.groupEnd();
    }
  }

  /**
   * Notify user of successful recovery
   * @param {Object} classification - Error classification
   * @param {Object} recoveryResult - Recovery result
   * @param {Object} handlingRecord - Handling record
   */
  async notifyRecoverySuccess(classification, recoveryResult, handlingRecord) {
    try {
      const successMessage = errorMessages.getRecoverySuccessMessage(
        classification.category,
        "automatic"
      );

      if (this.notificationSystem?.success) {
        this.notificationSystem.success(successMessage, { duration: 6000 });
      }

      // Accessibility announcement
      if (
        this.config.accessibilityAnnouncements &&
        this.accessibilitySystem?.announceStatus
      ) {
        this.accessibilitySystem.announceStatus(
          `Recovery successful: ${successMessage}`,
          "polite"
        );
      }
    } catch (notificationError) {
      logWarn(
        "ErrorHandlerMain: Recovery success notification failed:",
        notificationError
      );
    }
  }

  /**
   * Handle fallback errors (when main error handling fails)
   * @param {*} originalError - Original error
   * @param {*} handlingError - Error in handling
   * @param {Object} context - Error context
   * @param {string} handlingId - Handling ID
   * @returns {Promise<Object>} Fallback result
   */
  async handleFallbackError(originalError, handlingError, context, handlingId) {
    logError("ErrorHandlerMain: Fallback error handling activated:", {
      originalError: this.extractErrorMessage(originalError),
      handlingError: handlingError.message,
      handlingId,
    });

    // Basic fallback result
    const fallbackResult = {
      handled: true,
      fallback: true,
      originalError: this.extractErrorMessage(originalError),
      handlingError: handlingError.message,
      timestamp: Date.now(),
    };

    // Try basic user notification
    try {
      if (this.config.fallbackToBasicErrors && this.notificationSystem?.error) {
        const message = `An error occurred: ${this.extractErrorMessage(
          originalError
        )}`;
        this.notificationSystem.error(message, { duration: 8000 });
        fallbackResult.userNotified = true;
      }
    } catch (fallbackNotificationError) {
      logError(
        "ErrorHandlerMain: Even fallback notification failed:",
        fallbackNotificationError
      );

      // Last resort: console error
      console.error("CRITICAL: All error handling failed:", {
        original: originalError,
        handling: handlingError,
        fallback: fallbackNotificationError,
      });
    }

    return fallbackResult;
  }

  /**
   * Utility methods
   */

  createHandlingRecord(handlingId, error, classification, context, startTime) {
    return {
      id: handlingId,
      error: error,
      classification: classification,
      context: context,
      startTime: startTime,
      status: "active",
      attempts: [],
      notifications: [],
    };
  }

  generateHandlingId() {
    return `handling-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  extractErrorMessage(error) {
    if (typeof error === "string") return error;
    if (error?.message) return error.message;
    if (error?.statusText) return error.statusText;
    return "Unknown error occurred";
  }

  chooseNotificationMethod(priority, approach, preference) {
    if (preference) return preference;

    if (priority === "critical" || approach === "critical") return "modal";
    if (approach === "silent") return "none";
    if (approach === "background") return "toast";

    return priority === "high" ? "persistent_toast" : "toast";
  }

  async sendNotification(userMessage, method, handlingRecord) {
    const notificationConfig = errorMessages.formatForNotification(
      userMessage,
      method
    );

    switch (method) {
      case "modal":
        if (this.modalSystem?.create) {
          const modal = this.modalSystem.create({
            title: notificationConfig.title,
            content: errorMessages.formatForModal(userMessage),
            size: "medium",
          });
          handlingRecord.notifications.push({ type: "modal", id: modal.id });
        }
        break;

      case "persistent_toast":
        if (this.notificationSystem?.warning) {
          const id = this.notificationSystem.warning(
            notificationConfig.message,
            {
              duration: 0, // Persistent
              dismissible: true,
            }
          );
          handlingRecord.notifications.push({ type: "persistent_toast", id });
        }
        break;

      case "toast":
        const notifyFunction =
          this.notificationSystem?.[notificationConfig.type];
        if (notifyFunction) {
          const id = notifyFunction(notificationConfig.message, {
            duration: notificationConfig.duration,
            dismissible: notificationConfig.dismissible,
          });
          handlingRecord.notifications.push({ type: "toast", id });
        }
        break;

      case "none":
        // Silent mode - no notification
        break;
    }
  }

  completeErrorHandling(handlingId, result, startTime) {
    const handlingTime = performance.now() - startTime;

    // Update metrics
    this.updateErrorMetrics(result, handlingTime);

    // Clean up handling record
    this.activeErrorHandling.delete(handlingId);

    logInfo("ErrorHandlerMain: Error handling completed:", {
      handlingId,
      duration: `${handlingTime.toFixed(2)}ms`,
      recovered: result.recovered,
      handled: result.handled,
    });
  }

  updateErrorMetrics(result, handlingTime) {
    this.errorMetrics.totalErrors++;

    if (result.recovered) {
      this.errorMetrics.autoRecoveredErrors++;
    }

    if (result.userDecision) {
      this.errorMetrics.userInterventionRequired++;
    }

    // Update average handling time
    const total = this.errorMetrics.totalErrors;
    const currentAvg = this.errorMetrics.averageHandlingTime;
    this.errorMetrics.averageHandlingTime =
      (currentAvg * (total - 1) + handlingTime) / total;
  }

  /**
   * Public API methods
   */

  /**
   * Configure error handling behaviour
   * @param {Object} config - Configuration options
   */
  configure(config) {
    Object.assign(this.config, config);
    logInfo("ErrorHandlerMain: Configuration updated:", config);
  }

  /**
   * Set user interaction mode
   * @param {string} mode - Interaction mode ('automatic', 'prompt', 'manual')
   */
  setUserInteractionMode(mode) {
    this.userInteractionMode = mode;
    logInfo("ErrorHandlerMain: User interaction mode set to:", mode);
  }

  /**
   * Get error handling metrics
   * @returns {Object} Error metrics
   */
  getMetrics() {
    return {
      ...this.errorMetrics,
      activeHandlings: this.activeErrorHandling.size,
      queueSize: this.errorQueue.length,
    };
  }

  /**
   * Get system status
   * @returns {Object} System status
   */
  getSystemStatus() {
    return {
      initialized: true,
      config: { ...this.config },
      integrations: {
        notifications: !!this.notificationSystem,
        modals: !!this.modalSystem,
        accessibility: !!this.accessibilitySystem,
      },
      subsystems: {
        classification: !!errorClassification,
        recovery: !!recoveryStrategies,
        messages: !!errorMessages,
      },
      metrics: this.getMetrics(),
    };
  }

  /**
   * Clear all error history and reset metrics
   */
  clearHistory() {
    errorClassification.clearHistory();
    this.errorMetrics = {
      totalErrors: 0,
      autoRecoveredErrors: 0,
      userInterventionRequired: 0,
      averageHandlingTime: 0,
    };
    this.errorQueue.length = 0;
    this.activeErrorHandling.clear();

    logInfo("ErrorHandlerMain: History and metrics cleared");
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandlerMain();
