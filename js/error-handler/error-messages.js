/**
 * @fileoverview User-Friendly Error Messages
 * Provides clear, actionable error messages for users with British spelling
 * Integrates with existing universal notification and accessibility systems
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

export class ErrorMessages {
  constructor() {
    this.messages = {
      NETWORK: {
        title: "Connection Issue",
        message:
          "Unable to connect to the service. Please check your internet connection.",
        actions: [
          "Check your internet connection is working",
          "Try refreshing the page",
          "Wait a moment and try again",
          "Contact support if the issue persists",
        ],
        icon: "🌐",
        severity: "medium",
        category: "connectivity",
      },
      RATE_LIMIT: {
        title: "Too Many Requests",
        message:
          "You've made too many requests recently. Please wait before trying again.",
        actions: [
          "Wait 60 seconds before retrying",
          "Reduce the frequency of requests",
          "Consider upgrading your plan for higher limits",
          "Check your usage in account settings",
        ],
        icon: "⏱️",
        severity: "low",
        category: "usage",
      },
      AUTH: {
        title: "Authentication Required",
        message: "Your session has expired or you need to sign in again.",
        actions: [
          "Refresh the page and sign in again",
          "Check your API key in settings",
          "Clear browser cache and try again",
          "Contact support if you continue having issues",
        ],
        icon: "🔐",
        severity: "high",
        category: "authentication",
      },
      FILE_PROCESSING: {
        title: "File Processing Error",
        message: "There was an issue processing your file.",
        actions: [
          "Check the file format is supported (PDF, JPG, PNG)",
          "Ensure the file isn't corrupted or damaged",
          "Try a smaller file size (under 10MB recommended)",
          "Convert the file to a different format",
          "Remove any special characters from the filename",
        ],
        icon: "📄",
        severity: "medium",
        category: "file",
      },
      API_ERROR: {
        title: "Service Temporarily Unavailable",
        message: "The AI service is experiencing temporary issues.",
        actions: [
          "Wait a few minutes and try again",
          "Check the service status page",
          "Try a different AI model if available",
          "Contact support if the issue continues",
        ],
        icon: "⚠️",
        severity: "high",
        category: "service",
      },
      VALIDATION: {
        title: "Invalid Input",
        message: "Please check your input and try again.",
        actions: [
          "Review the input requirements",
          "Ensure all required fields are completed",
          "Check for invalid characters or formats",
          "Try shortening your message if it's very long",
        ],
        icon: "✏️",
        severity: "low",
        category: "input",
      },
      QUOTA: {
        title: "Usage Limit Reached",
        message: "You've reached your usage limit for this service.",
        actions: [
          "Wait until your quota resets",
          "Upgrade your plan for more capacity",
          "Check your usage in account settings",
          "Contact support for assistance",
        ],
        icon: "📊",
        severity: "medium",
        category: "billing",
      },
      BROWSER: {
        title: "Browser Compatibility Issue",
        message: "Your browser may not fully support this feature.",
        actions: [
          "Try refreshing the page",
          "Update your browser to the latest version",
          "Clear browser cache and cookies",
          "Try a different browser (Chrome, Firefox, Safari)",
        ],
        icon: "🌏",
        severity: "medium",
        category: "browser",
      },
      UNKNOWN: {
        title: "Unexpected Error",
        message: "Something unexpected happened. Please try again.",
        actions: [
          "Refresh the page and try again",
          "Try again in a moment",
          "Check your internet connection",
          "Contact support with error details if it continues",
        ],
        icon: "❓",
        severity: "medium",
        category: "general",
      },
    };

    // Configuration
    this.technicalDetailsEnabled = false;
    this.userPreferences = {
      verboseMessages: false,
      showTechnicalDetails: false,
      preferredNotificationDuration: 6000,
    };

    // Error context enhancement
    this.contextEnhancers = {
      browser: this.getBrowserContext.bind(this),
      network: this.getNetworkContext.bind(this),
      performance: this.getPerformanceContext.bind(this),
    };

    logInfo("ErrorMessages: System initialised with British spelling");
  }

  /**
   * Get user-friendly message for error classification
   * @param {Object} classification - Error classification
   * @param {Object} options - Message options
   * @returns {Object} User-friendly message
   */
  getUserMessage(classification, options = {}) {
    const template =
      this.messages[classification.category] || this.messages.UNKNOWN;

    const message = {
      ...template,
      timestamp: new Date().toISOString(),
      category: classification.category,
      priority: classification.priority,
      recoverable: classification.recoverable,
      errorId: this.generateErrorId(),
      classification: classification,
    };

    // Enhance message based on options
    this.enhanceMessageWithOptions(message, options);
    this.enhanceMessageWithContext(message, classification.context);
    this.personaliseMessage(message, classification);

    // Add recovery information
    if (options.recovering) {
      message.recovering = true;
      message.recoveryMessage =
        options.recoveryMessage || "Attempting automatic recovery...";
      message.showProgress = true;
    }

    // Add retry information
    if (classification.recoverable && options.retryCount) {
      message.retryInfo = {
        attempt: options.retryCount,
        maxAttempts: options.maxRetries || 3,
        nextRetryIn: options.nextRetryDelay || 0,
      };
    }

    // Add technical details if enabled
    if (this.shouldShowTechnicalDetails(options)) {
      message.technical = this.buildTechnicalDetails(classification, options);
    }

    logDebug("ErrorMessages: Generated user message:", {
      category: message.category,
      errorId: message.errorId,
      hasRecovery: !!message.recovering,
      hasRetryInfo: !!message.retryInfo,
    });

    return message;
  }

  /**
   * Enhance message with options
   * @param {Object} message - Message to enhance
   * @param {Object} options - Enhancement options
   */
  enhanceMessageWithOptions(message, options) {
    // Severity-based adjustments
    if (options.urgent || message.severity === "high") {
      message.urgentNotification = true;
      message.persistentNotification = true;
    }

    // Custom actions
    if (options.customActions && Array.isArray(options.customActions)) {
      message.actions = [...message.actions, ...options.customActions];
    }

    // User context
    if (options.userContext) {
      this.addUserContextActions(message, options.userContext);
    }

    // Accessibility enhancements
    if (options.screenReaderOptimised) {
      message.screenReaderText = this.generateScreenReaderText(message);
    }
  }

  /**
   * Enhance message with error context
   * @param {Object} message - Message to enhance
   * @param {Object} context - Error context
   */
  enhanceMessageWithContext(message, context) {
    if (!context) return;

    // File context
    if (context.fileSize && context.fileSize > 10 * 1024 * 1024) {
      message.actions.unshift("Try a smaller file (under 10MB)");
    }

    // Network context
    if (context.online === false) {
      message.message =
        "You appear to be offline. Please check your internet connection.";
      message.actions = [
        "Check your internet connection",
        "Try again when back online",
        "Check if other websites are working",
      ];
    }

    // Browser context
    if (context.userAgent) {
      const browserInfo = this.parseBrowserInfo(context.userAgent);
      if (browserInfo.isOldBrowser) {
        message.actions.unshift("Update your browser to the latest version");
      }
    }

    // Performance context
    if (context.performanceIssue) {
      message.actions.push("Close other browser tabs to free up memory");
      message.actions.push("Restart your browser if performance is poor");
    }
  }

  /**
   * Personalise message based on user history and preferences
   * @param {Object} message - Message to personalise
   * @param {Object} classification - Error classification
   */
  personaliseMessage(message, classification) {
    // Check for repeated errors
    if (window.errorClassification?.hasRepeatedErrors) {
      const hasRepeated = window.errorClassification.hasRepeatedErrors(
        classification.category,
        3,
        300000
      );

      if (hasRepeated) {
        message.repeatedError = true;
        message.message += " This error has occurred multiple times recently.";
        message.actions.unshift("Consider trying a different approach");

        if (classification.category === "NETWORK") {
          message.actions.unshift(
            "Check if this is a widespread connectivity issue"
          );
        }
      }
    }

    // User preference adjustments
    if (this.userPreferences.verboseMessages) {
      message.detailedExplanation = this.getDetailedExplanation(
        classification.category
      );
    }
  }

  /**
   * Format error message for display in notifications
   * @param {Object} userMessage - User message object
   * @param {string} displayType - Display type ('toast', 'modal', 'inline')
   * @returns {Object} Formatted message for notifications
   */
  formatForNotification(userMessage, displayType = "toast") {
    const notificationConfig = {
      title: userMessage.title,
      message: userMessage.message,
      type: this.getNotificationType(userMessage.severity),
      duration: this.getNotificationDuration(userMessage, displayType),
      dismissible: true,
      ariaLabel: this.generateAriaLabel(userMessage),
    };

    // Add actions for appropriate display types
    if (displayType === "modal" && userMessage.actions.length > 0) {
      notificationConfig.actions = userMessage.actions
        .slice(0, 3)
        .map((action) => ({
          label: action,
          primary: false,
        }));
    }

    // Recovery-specific formatting
    if (userMessage.recovering) {
      notificationConfig.showProgress = true;
      notificationConfig.progressMessage = userMessage.recoveryMessage;
      notificationConfig.type = "info"; // Recovery notifications are informational
    }

    // Retry information
    if (userMessage.retryInfo) {
      notificationConfig.subtitle = `Retry ${userMessage.retryInfo.attempt} of ${userMessage.retryInfo.maxAttempts}`;
      if (userMessage.retryInfo.nextRetryIn > 0) {
        notificationConfig.countdown = userMessage.retryInfo.nextRetryIn;
      }
    }

    // Urgent notifications
    if (userMessage.urgentNotification) {
      notificationConfig.persistent = true;
      notificationConfig.priority = "high";
    }

    return notificationConfig;
  }

  /**
   * Format error for display in modal dialogs
   * @param {Object} userMessage - User message object
   * @returns {string} HTML formatted message
   */
  formatForModal(userMessage) {
    const parts = [
      `
      <div class="error-modal-content" role="alert">
        <div class="error-header">
          <span class="error-icon" aria-hidden="true">${userMessage.icon}</span>
          <h3 class="error-title">${userMessage.title}</h3>
        </div>
        <div class="error-description">
          <p>${userMessage.message}</p>
        </div>
    `,
    ];

    // Recovery status
    if (userMessage.recovering) {
      parts.push(`
        <div class="error-recovery" aria-live="polite">
          <div class="recovery-indicator">
            <span class="spinner" aria-hidden="true">🔄</span>
            <span>${userMessage.recoveryMessage}</span>
          </div>
        </div>
      `);
    }

    // Actions list
    if (userMessage.actions && userMessage.actions.length > 0) {
      parts.push('<div class="error-actions"><h4>What you can do:</h4><ul>');
      userMessage.actions.forEach((action) => {
        parts.push(`<li>${action}</li>`);
      });
      parts.push("</ul></div>");
    }

    // Retry information
    if (userMessage.retryInfo) {
      parts.push(`
        <div class="retry-info">
          <p><strong>Retry ${userMessage.retryInfo.attempt} of ${
        userMessage.retryInfo.maxAttempts
      }</strong></p>
          ${
            userMessage.retryInfo.nextRetryIn > 0
              ? `<p>Next automatic retry in ${Math.ceil(
                  userMessage.retryInfo.nextRetryIn / 1000
                )} seconds</p>`
              : ""
          }
        </div>
      `);
    }

    // Technical details (collapsible)
    if (userMessage.technical) {
      parts.push(`
        <details class="technical-details">
          <summary>Technical Details</summary>
          <div class="technical-content">
            <p><strong>Error ID:</strong> ${userMessage.errorId}</p>
            <p><strong>Category:</strong> ${userMessage.category}</p>
            <p><strong>Timestamp:</strong> ${new Date(
              userMessage.timestamp
            ).toLocaleString()}</p>
            ${
              userMessage.technical.originalMessage
                ? `<p><strong>Original Message:</strong> ${userMessage.technical.originalMessage}</p>`
                : ""
            }
            ${
              userMessage.technical.context
                ? `<pre>${JSON.stringify(
                    userMessage.technical.context,
                    null,
                    2
                  )}</pre>`
                : ""
            }
          </div>
        </details>
      `);
    }

    parts.push("</div>");
    return parts.join("");
  }

  /**
   * Generate screen reader optimised text
   * @param {Object} userMessage - User message object
   * @returns {string} Screen reader text
   */
  generateScreenReaderText(userMessage) {
    let srText = `Error: ${userMessage.title}. ${userMessage.message}`;

    if (userMessage.recovering) {
      srText += ` ${userMessage.recoveryMessage}`;
    }

    if (userMessage.actions && userMessage.actions.length > 0) {
      srText += ` Suggested actions: ${userMessage.actions
        .slice(0, 3)
        .join(", ")}.`;
    }

    if (userMessage.retryInfo) {
      srText += ` This is retry attempt ${userMessage.retryInfo.attempt} of ${userMessage.retryInfo.maxAttempts}.`;
    }

    return srText;
  }

  /**
   * Get recovery status messages
   * @param {string} strategyName - Recovery strategy name
   * @param {string} stage - Recovery stage ('starting', 'progress', 'success', 'failure')
   * @returns {string} Recovery message
   */
  getRecoveryMessage(strategyName, stage = "progress") {
    const strategyMessages = {
      immediate_retry: {
        starting: "Starting immediate retry...",
        progress: "Retrying connection...",
        success: "Connection restored successfully!",
        failure: "Immediate retry failed",
      },
      exponential_backoff: {
        starting: "Starting retry with delay...",
        progress: "Retrying with exponential backoff...",
        success: "Connection restored after retry!",
        failure: "Retry attempts failed",
      },
      rate_limit_wait: {
        starting: "Detected rate limit, waiting...",
        progress: "Waiting for rate limit to reset...",
        success: "Rate limit cleared, ready to continue!",
        failure: "Rate limit wait unsuccessful",
      },
      fallback_model: {
        starting: "Switching to fallback model...",
        progress: "Using alternative AI model...",
        success: "Successfully switched to fallback model!",
        failure: "Fallback model unavailable",
      },
      file_optimization: {
        starting: "Optimising file for upload...",
        progress: "Processing file for better compatibility...",
        success: "File optimised successfully!",
        failure: "File optimisation failed",
      },
      connection_check: {
        starting: "Checking network connection...",
        progress: "Verifying connectivity...",
        success: "Network connection verified!",
        failure: "Connection check failed",
      },
      degraded_mode: {
        starting: "Switching to limited mode...",
        progress: "Running in reduced functionality mode...",
        success: "Limited mode active - some features available",
        failure: "Unable to enter limited mode",
      },
    };

    const messages =
      strategyMessages[strategyName] || strategyMessages.immediate_retry;
    return messages[stage] || messages.progress;
  }

  /**
   * Get success message after recovery
   * @param {string} category - Error category that was recovered
   * @param {string} method - Recovery method used
   * @returns {string} Success message
   */
  getRecoverySuccessMessage(category, method = "automatic") {
    const categoryMessages = {
      NETWORK: "Connection restored successfully!",
      RATE_LIMIT: "Request limits reset. You can continue.",
      FILE_PROCESSING: "File processed successfully!",
      API_ERROR: "Service connection restored!",
      AUTH: "Authentication refreshed successfully!",
      BROWSER: "Browser compatibility issue resolved!",
      VALIDATION: "Input validation passed!",
      QUOTA: "Usage quota refreshed!",
      default: "Issue resolved successfully!",
    };

    let message = categoryMessages[category] || categoryMessages.default;

    if (method === "automatic") {
      message += " The system recovered automatically.";
    } else if (method === "user_assisted") {
      message += " Thank you for your assistance in resolving this.";
    }

    return message;
  }

  /**
   * Helper methods
   */

  shouldShowTechnicalDetails(options) {
    return (
      this.technicalDetailsEnabled ||
      this.userPreferences.showTechnicalDetails ||
      options.showTechnical
    );
  }

  buildTechnicalDetails(classification, options) {
    return {
      errorId: this.generateErrorId(),
      originalMessage: classification.message,
      category: classification.category,
      priority: classification.priority,
      context: classification.context,
      timestamp: classification.timestamp,
      classificationTime: classification.classificationTime,
      httpStatus: classification.context?.status,
      userAgent: classification.context?.userAgent,
    };
  }

  generateErrorId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `ERR-${timestamp}-${random}`.toUpperCase();
  }

  getNotificationType(severity) {
    const typeMap = {
      low: "info",
      medium: "warning",
      high: "error",
      critical: "error",
    };
    return typeMap[severity] || "warning";
  }

  getNotificationDuration(userMessage, displayType) {
    if (userMessage.persistentNotification) return 0; // Persistent
    if (userMessage.recovering) return 8000; // Longer for recovery
    if (displayType === "modal") return 0; // Modal handles its own duration

    const baseDuration = this.userPreferences.preferredNotificationDuration;
    const severityMultiplier = { low: 0.8, medium: 1, high: 1.5, critical: 2 };

    return baseDuration * (severityMultiplier[userMessage.severity] || 1);
  }

  generateAriaLabel(userMessage) {
    return `${userMessage.title}: ${userMessage.message}${
      userMessage.recovering ? ". Recovery in progress." : ""
    }`;
  }

  parseBrowserInfo(userAgent) {
    // Simple browser detection for compatibility warnings
    const browsers = {
      chrome: /Chrome\/(\d+)/.exec(userAgent),
      firefox: /Firefox\/(\d+)/.exec(userAgent),
      safari: /Safari\/(\d+)/.exec(userAgent),
      edge: /Edge\/(\d+)/.exec(userAgent),
    };

    const detected = Object.keys(browsers).find((name) => browsers[name]);
    if (!detected) return { isOldBrowser: true };

    const version = parseInt(browsers[detected][1]);
    const minVersions = { chrome: 90, firefox: 88, safari: 14, edge: 90 };

    return {
      browser: detected,
      version,
      isOldBrowser: version < minVersions[detected],
    };
  }

  getDetailedExplanation(category) {
    const explanations = {
      NETWORK:
        "Network errors occur when your device cannot communicate with our servers. This might be due to internet connectivity issues, firewall restrictions, or temporary service disruptions.",
      RATE_LIMIT:
        "Rate limiting protects our service from being overwhelmed. Each user has limits on how many requests can be made within a specific time period.",
      AUTH: "Authentication errors happen when your login session expires or your access credentials are invalid. This is a security measure to protect your account.",
      FILE_PROCESSING:
        "File processing errors occur when our system cannot read, parse, or process your uploaded file. This might be due to file format, size, or content issues.",
      API_ERROR:
        "API errors indicate problems with our backend services. These are usually temporary and resolve automatically.",
      VALIDATION:
        "Validation errors occur when the input provided doesn't meet the required format or constraints.",
      QUOTA:
        "Quota errors indicate you've reached the usage limits for your current plan or billing period.",
      BROWSER:
        "Browser compatibility issues can occur due to outdated browser versions or disabled features like JavaScript.",
    };

    return (
      explanations[category] ||
      "This error requires investigation to determine the root cause."
    );
  }

  getBrowserContext() {
    return {
      userAgent: navigator.userAgent,
      online: navigator.onLine,
      cookieEnabled: navigator.cookieEnabled,
      language: navigator.language,
    };
  }

  getNetworkContext() {
    return {
      online: navigator.onLine,
      connection: navigator.connection
        ? {
            effectiveType: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink,
            rtt: navigator.connection.rtt,
          }
        : null,
    };
  }

  getPerformanceContext() {
    return {
      memory: performance.memory
        ? {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
          }
        : null,
      timing: performance.timing
        ? {
            loadTime:
              performance.timing.loadEventEnd -
              performance.timing.navigationStart,
          }
        : null,
    };
  }

  addUserContextActions(message, userContext) {
    if (userContext.isFirstTimeUser) {
      message.actions.unshift("Check the getting started guide");
    }

    if (userContext.hasFileUploaded) {
      message.actions.push("Try without the uploaded file");
    }

    if (userContext.usingAdvancedFeatures) {
      message.actions.push("Try with basic settings first");
    }
  }

  /**
   * Configure user preferences
   * @param {Object} preferences - User preferences
   */
  setUserPreferences(preferences) {
    Object.assign(this.userPreferences, preferences);
    logInfo("ErrorMessages: User preferences updated");
  }

  /**
   * Enable or disable technical details
   * @param {boolean} enabled - Whether to show technical details
   */
  setTechnicalDetailsEnabled(enabled) {
    this.technicalDetailsEnabled = enabled;
    logInfo(
      "ErrorMessages: Technical details",
      enabled ? "enabled" : "disabled"
    );
  }
}

// Export singleton instance
export const errorMessages = new ErrorMessages();
