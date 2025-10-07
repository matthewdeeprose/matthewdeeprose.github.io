/**
 * Graph Builder Notifications
 * Enhanced toast notification system for the Graph Builder
 *
 * @version 1.0.0
 */

const GraphBuilderNotifications = (function () {
  "use strict";

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

  // Current logging level
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  /**
   * Check if logging should occur for given level
   * @param {number} level - Log level to check
   * @returns {boolean} Whether logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log error message
   * @param {string} message - Message to log
   */
  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Graph Builder Notifications] ERROR: ${message}`);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Message to log
   */
  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Graph Builder Notifications] WARN: ${message}`);
    }
  }

  /**
   * Log info message
   * @param {string} message - Message to log
   */
  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Graph Builder Notifications] INFO: ${message}`);
    }
  }

  /**
   * Log debug message
   * @param {string} message - Message to log
   */
  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Graph Builder Notifications] DEBUG: ${message}`);
    }
  }

  /**
   * Set current logging level
   * @param {number} level - New logging level
   */
  function setLogLevel(level) {
    if (Object.values(LOG_LEVELS).includes(level)) {
      currentLogLevel = level;
      logInfo(
        `Logging level set to: ${Object.keys(LOG_LEVELS).find(
          (key) => LOG_LEVELS[key] === level
        )}`
      );
    } else {
      logWarn(`Invalid logging level: ${level}`);
    }
  }

  /**
   * Toast Notification Manager
   * Handles all user notifications with accessibility support
   */
  class ToastNotificationManager {
    constructor() {
      this.container = document.getElementById("gb-toast-container");
      this.toasts = new Map();
      this.toastCounter = 0;
      this.maxToasts = 5;

      this.initContainer();
    }

    /**
     * Initialise toast container if it doesn't exist
     */
    initContainer() {
      if (!this.container) {
        logWarn("Toast container not found, creating...");
        this.createToastContainer();
      }
    }

    /**
     * Create toast container in DOM
     */
    createToastContainer() {
      this.container = document.createElement("div");
      this.container.id = "gb-toast-container";
      this.container.className = "gb-toast-container";
      this.container.setAttribute("aria-live", "polite");
      this.container.setAttribute("aria-label", "Notifications");

      // Position at top-right of viewport
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 400px;
      `;

      document.body.appendChild(this.container);
    }

    /**
     * Display a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type: 'success', 'error', 'info', 'warning'
     * @param {Object} options - Additional options
     * @returns {string|null} Toast ID or null if failed
     */
    show(message, type = "info", options = {}) {
      if (!this.container) {
        logWarn("Cannot show toast - container missing");
        return null;
      }

      const {
        duration = this.getDefaultDuration(type),
        dismissible = true,
        persistent = false,
      } = options;

      // Remove excess toasts if needed
      this.limitToasts();

      // Create toast
      const toastId = `gb-toast-${++this.toastCounter}`;
      const toast = this.createToast(toastId, message, type, dismissible);

      // Store reference
      this.toasts.set(toastId, {
        element: toast,
        type,
        timeout: null,
        persistent,
      });

      // Add to container
      this.container.appendChild(toast);

      // Trigger show animation
      requestAnimationFrame(() => {
        toast.classList.add("gb-toast-show");
      });

      // Set up auto-dismiss for non-persistent toasts
      if (!persistent && duration > 0) {
        this.setAutoDisMiss(toastId, duration);
      }

      // Announce to screen readers
      this.announceToast(message, type);

      return toastId;
    }

    /**
     * Create toast DOM element
     * @param {string} toastId - Unique toast ID
     * @param {string} message - Toast message
     * @param {string} type - Toast type
     * @param {boolean} dismissible - Whether toast can be dismissed
     * @returns {HTMLElement} Toast element
     */
    createToast(toastId, message, type, dismissible) {
      const toast = document.createElement("div");
      toast.id = toastId;
      toast.className = `gb-toast gb-toast-${type}`;
      toast.setAttribute("role", type === "error" ? "alert" : "status");
      toast.setAttribute(
        "aria-live",
        type === "error" ? "assertive" : "polite"
      );

      // Apply base classes (CSS will handle styling)
      toast.classList.add("gb-toast-base");

      // Get icon for type
      const icon = this.getIconForType(type);

      // Build content
      toast.innerHTML = `
      <div class="gb-toast-icon" aria-hidden="true">${icon}</div>
      <div class="gb-toast-content">${this.escapeHtml(message)}</div>
      ${
        dismissible
          ? `
        <button type="button" class="gb-toast-close" aria-label="Close notification">
          <span aria-hidden="true">×</span>
        </button>
      `
          : ""
      }
    `;

      // Add close functionality
      if (dismissible) {
        const closeBtn = toast.querySelector(".gb-toast-close");
        closeBtn.addEventListener("click", () => this.dismiss(toastId));

        // Keyboard support
        closeBtn.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.dismiss(toastId);
          }
        });

        // Hover styles
        closeBtn.addEventListener("mouseenter", () => {
          closeBtn.style.background = "rgba(0, 0, 0, 0.1)";
        });
        closeBtn.addEventListener("mouseleave", () => {
          closeBtn.style.background = "none";
        });
      }

      return toast;
    }

    /**
     * Get icon for toast type
     * @param {string} type - Toast type
     * @returns {string} Icon character
     */
    getIconForType(type) {
      const icons = {
        success: "✓",
        error: "⚠",
        info: "ℹ",
        warning: "⚠",
      };
      return icons[type] || icons.info;
    }

    /**
     * Get default duration for toast type
     * @param {string} type - Toast type
     * @returns {number} Duration in milliseconds
     */
    getDefaultDuration(type) {
      const durations = {
        success: 4000,
        info: 5000,
        warning: 7000,
        error: 0, // Don't auto-dismiss errors
      };
      return durations[type] || 5000;
    }

    /**
     * Set up auto-dismiss with progress bar
     * @param {string} toastId - Toast ID
     * @param {number} duration - Duration in milliseconds
     */
    setAutoDisMiss(toastId, duration) {
      const toastData = this.toasts.get(toastId);
      if (!toastData) return;

      const toast = toastData.element;

      // Add progress bar
      const progressBar = document.createElement("div");
      progressBar.className = "gb-toast-progress";
      progressBar.style.cssText = `
      width: 100%;
      transition: width linear;
    `;
      toast.appendChild(progressBar);

      // Animate progress bar
      requestAnimationFrame(() => {
        progressBar.style.width = "0%";
        progressBar.style.transitionDuration = `${duration}ms`;
      });

      // Set timeout for dismissal
      toastData.timeout = setTimeout(() => {
        this.dismiss(toastId);
      }, duration);
    }

    /**
     * Dismiss a toast
     * @param {string} toastId - Toast ID to dismiss
     */
    dismiss(toastId) {
      const toastData = this.toasts.get(toastId);
      if (!toastData) return;

      const toast = toastData.element;

      // Clear timeout if exists
      if (toastData.timeout) {
        clearTimeout(toastData.timeout);
      }

      // Add hide animation
      toast.style.transform = "translateX(100%)";
      toast.style.opacity = "0";

      // Remove from DOM after animation
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
        this.toasts.delete(toastId);
      }, 300);
    }

    /**
     * Clear all toasts
     */
    clearAll() {
      for (const [toastId] of this.toasts) {
        this.dismiss(toastId);
      }
    }

    /**
     * Limit number of toasts
     */
    limitToasts() {
      const excessCount = this.toasts.size - this.maxToasts + 1;

      if (excessCount > 0) {
        const toastIds = Array.from(this.toasts.keys());
        const toastsToRemove = toastIds.slice(0, excessCount);

        toastsToRemove.forEach((toastId) => {
          this.dismiss(toastId);
        });
      }
    }

    /**
     * Announce toast to screen readers
     * @param {string} message - Message to announce
     * @param {string} type - Toast type
     */
    announceToast(message, type) {
      const announcement = `${type === "error" ? "Error: " : ""}${message}`;

      let announcer = document.getElementById("gb-toast-announcer");
      if (!announcer) {
        announcer = document.createElement("div");
        announcer.id = "gb-toast-announcer";
        announcer.setAttribute("aria-live", "assertive");
        announcer.setAttribute("aria-atomic", "true");
        announcer.className = "sr-only";
        announcer.style.cssText = `
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        `;
        document.body.appendChild(announcer);
      }

      announcer.textContent = announcement;

      // Clear after announcement
      setTimeout(() => {
        announcer.textContent = "";
      }, 1000);
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }
  }

  // Create singleton instance
  const toastManager = new ToastNotificationManager();

  /**
   * Display notification (main public API)
   * @param {string} message - Message to display
   * @param {string} type - Type of notification
   * @param {Object} options - Additional options
   * @returns {string|null} Toast ID
   */
  function show(message, type = "info", options = {}) {
    logDebug(`${type.toUpperCase()}: ${message}`);
    return toastManager.show(message, type, options);
  }

  /**
   * Clear all notifications
   */
  function clearAll() {
    toastManager.clearAll();
  }

  /**
   * Dismiss specific notification
   * @param {string} toastId - Toast ID to dismiss
   */
  function dismiss(toastId) {
    toastManager.dismiss(toastId);
  }

  // Log module initialisation
  logInfo("Module loaded successfully");

  // Public API
  return {
    show,
    clearAll,
    dismiss,

    // Convenience methods
    success: (message, options) => show(message, "success", options),
    error: (message, options) => show(message, "error", options),
    warning: (message, options) => show(message, "warning", options),
    info: (message, options) => show(message, "info", options),

    // Logging control methods
    setLogLevel,
    getLogLevel: () => currentLogLevel,
    LOG_LEVELS,

    // For debugging
    _manager: toastManager,
  };
})();

// Export for other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = GraphBuilderNotifications;
} else {
  window.GraphBuilderNotifications = GraphBuilderNotifications;
}

// Export for global access
window.GraphBuilderNotifications = GraphBuilderNotifications;
window.gbDisplayNotification = GraphBuilderNotifications.show;
window.gbClearMessage = GraphBuilderNotifications.clearAll;

// Export toastManager directly for backward compatibility
window.toastManager = GraphBuilderNotifications._manager;
