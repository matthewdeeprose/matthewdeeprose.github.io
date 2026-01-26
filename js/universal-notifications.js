/**
 * Universal Notifications - Backward Compatible Edition
 * Toast notification system with Graph Builder CSS compatibility
 *
 * Maintains full API compatibility while integrating with new modal system
 * Uses existing Graph Builder CSS classes for consistent styling
 *
 * @version 2.0.0 - Added modal integration and backward compatibility
 */

const UniversalNotifications = (function () {
  "use strict";

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

  // Current logging level
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Universal Notifications] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Universal Notifications] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Universal Notifications] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Universal Notifications] DEBUG: ${message}`, ...args);
    }
  }

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
   * Notification Manager Class
   * Handles all user notifications with accessibility support
   * Uses existing Graph Builder CSS classes for styling
   */
  class NotificationManager {
    constructor() {
      this.container = null;
      this.toasts = new Map();
      this.toastCounter = 0;
      this.maxToasts = 5;
      this.containerInitialised = false;

      // Default durations (in milliseconds)
      this.defaultDurations = {
        success: 4000,
        error: 0, // No auto-dismiss for errors
        warning: 4000,
        info: 4000,
        loading: 0, // No auto-dismiss for loading
      };

      // Duplicate notification suppression
      this.lastNotification = {
        message: null,
        type: null,
        timestamp: 0,
      };
      this.duplicateWindowMs = 2000; // 2 second window to suppress duplicates

      logInfo(
        "Notification manager created (container will be initialised when needed)"
      );
    }

    /**
     * Check if a modal is currently active
     * Integrates with new UniversalModal system
     */
    isModalActive() {
      // Check if UniversalModal exists and has an active modal
      if (
        typeof UniversalModal !== "undefined" &&
        UniversalModal.isModalActive
      ) {
        return UniversalModal.isModalActive();
      }

      // Fallback: check for open dialog elements
      const openModal = document.querySelector(
        "dialog[open], .universal-modal[open]"
      );
      return !!openModal;
    }

    /**
     * Ensure container is initialised - called lazily when needed
     */
    ensureContainer() {
      if (this.containerInitialised && this.container) {
        return true;
      }

      if (!document.body) {
        logWarn("Cannot initialise toast container - document.body not ready");
        return false;
      }

      return this.initContainer();
    }

    /**
     * Initialise toast container with Graph Builder compatibility
     */
    initContainer() {
      try {
        // Look for existing universal container first
        this.container = document.getElementById("universal-toast-container");

        if (!this.container) {
          // Check for legacy Graph Builder container and reuse if available
          this.container = document.getElementById("gb-toast-container");
          if (this.container) {
            // Keep the existing container but update ID for universal access
            this.container.id = "universal-toast-container";
            // Add universal class while keeping existing gb class
            this.container.classList.add("universal-toast-container");
            logInfo(
              "Converted Graph Builder toast container to universal container"
            );
            this.containerInitialised = true;
            return true;
          }
        }

        if (!this.container) {
          logInfo("Toast container not found, creating universal container...");
          return this.createToastContainer();
        }

        this.containerInitialised = true;
        return true;
      } catch (error) {
        logError(`Error initialising toast container: ${error.message}`);
        return false;
      }
    }

    /**
     * Create universal toast container using existing GB classes
     */
    createToastContainer() {
      try {
        if (!document.body) {
          logError(
            "Cannot create toast container - document.body is not available"
          );
          return false;
        }

        this.container = document.createElement("div");
        this.container.id = "universal-toast-container";
        // Use existing Graph Builder classes for styling
        this.container.className =
          "gb-toast-container universal-toast-container";
        this.container.setAttribute("aria-live", "polite");
        this.container.setAttribute("aria-label", "Application notifications");

        // Apply positioning styles
        this.container.style.position = "fixed";
        this.container.style.top = "1rem";
        this.container.style.right = "1rem";
        this.container.style.zIndex = "2147483647"; // Maximum z-index
        this.container.style.pointerEvents = "none";
        this.container.style.maxWidth = "400px";

        document.body.appendChild(this.container);
        this.containerInitialised = true;
        logInfo("Universal toast container created with existing GB classes");
        return true;
      } catch (error) {
        logError(`Error creating toast container: ${error.message}`);
        return false;
      }
    }

    /**
     * Main show method that determines display mode
     * If modal is active, use in-modal notification
     * Otherwise, show as toast
     * @returns {string|null} Toast ID if toast shown, null if in-modal notification or duplicate suppressed
     */
    show(message, type = "info", options = {}) {
      // Check for duplicate notification within time window
      const now = Date.now();
      const isDuplicate =
        this.lastNotification.message === message &&
        this.lastNotification.type === type &&
        now - this.lastNotification.timestamp < this.duplicateWindowMs;

      if (isDuplicate) {
        logDebug(`Duplicate notification suppressed: ${type} - ${message}`);
        return null;
      }

      // Update last notification tracking
      this.lastNotification = { message, type, timestamp: now };

      // If modal is active, use in-modal notification
      if (this.isModalActive()) {
        this.showInModalNotification(message, type, options);
        return null; // In-modal notifications don't have IDs
      } else {
        // Otherwise, show as toast and return its ID
        return this.showToastNotification(message, type, options);
      }
    }

    /**
     * Show notification within active modal
     */
    showInModalNotification(message, type, options) {
      if (typeof UniversalModal !== "undefined" && UniversalModal.showStatus) {
        // Calculate duration based on type if not specified
        const duration =
          options.duration !== undefined
            ? options.duration
            : this.defaultDurations[type];

        UniversalModal.showStatus(message, type, {
          duration: duration,
          dismissible: options.dismissible !== false,
        });

        logDebug(`In-modal notification shown: ${type} - ${message}`);
      } else {
        logWarn("UniversalModal not available, falling back to toast");
        this.showToastNotification(message, type, options);
      }
    }

    /**
     * Show as toast notification using existing GB structure
     */
    showToastNotification(message, type, options) {
      // Ensure container is ready before showing toast
      if (!this.ensureContainer()) {
        logError("Cannot show toast - container initialisation failed");
        // Fallback to console for critical messages
        if (type === "error") {
          console.error(`[Toast Fallback] ${message}`);
        } else {
          console.log(`[Toast Fallback] ${type.toUpperCase()}: ${message}`);
        }
        return null;
      }

      const {
        duration = this.defaultDurations[type],
        dismissible = true,
        persistent = false,
      } = options;

      // Remove excess toasts if needed
      this.limitToasts();

      // Create toast using GB structure
      const toastId = `universal-toast-${++this.toastCounter}`;
      const toast = this.createToast(
        toastId,
        message,
        type,
        dismissible,
        duration,
        { allowHtml: options.allowHtml }
      );

      // Store reference
      this.toasts.set(toastId, {
        element: toast,
        type,
        timeout: null,
        persistent,
      });

      // Add to container
      this.container.appendChild(toast);

      // Trigger show animation using existing GB class
      requestAnimationFrame(() => {
        toast.classList.add("gb-toast-show");
      });

      // Set up auto-dismiss for non-persistent toasts
      if (!persistent && duration > 0) {
        this.setAutoDisMiss(toastId, duration);
      }

      // Note: Screen reader announcement handled by toast's aria-live attribute
      // No need for separate announcer element (prevents duplicate announcements)

      logDebug(`Toast displayed: ${type} - ${message}`);
      return toastId;
    }

    /**
     * Create toast DOM element using existing GB classes and structure
     * @param {Object} options - Additional options including allowHtml
     */
    createToast(
      toastId,
      message,
      type,
      dismissible,
      duration = 0,
      options = {}
    ) {
      const toast = document.createElement("div");
      toast.id = toastId;
      // Use existing Graph Builder classes
      toast.className = `gb-toast gb-toast-${type}`;
      toast.setAttribute("role", type === "error" ? "alert" : "status");
      toast.setAttribute(
        "aria-live",
        type === "error" ? "assertive" : "polite"
      );
      toast.style.pointerEvents = "auto";
      toast.style.zIndex = "inherit"; // Inherit from container

      // Apply base classes (CSS will handle styling via existing GB classes)
      toast.classList.add("gb-toast-base");

      // Get icon for type
      const icon = this.getIconForType(type);

      // Build content using existing GB structure
      // Note: For auto-dismissing toasts, use simpler close label since they auto-dismiss
      const closeLabel = duration > 0 ? "Dismiss" : "Close notification";

      toast.innerHTML = `
        <div class="gb-toast-icon" aria-hidden="true">${icon}</div>
<div class="gb-toast-content">${
        options.allowHtml ? message : this.escapeHtml(message)
      }</div>
        ${
          dismissible
            ? `
          <button type="button" class="gb-toast-close" aria-label="${closeLabel}">
            <span aria-hidden="true">×</span>
          </button>
        `
            : ""
        }
      `;

      // Add close functionality
      if (dismissible) {
        const closeBtn = toast.querySelector(".gb-toast-close");
        if (closeBtn) {
          closeBtn.addEventListener("click", () => this.dismiss(toastId));

          // Keyboard support
          closeBtn.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              this.dismiss(toastId);
            }
          });

          // Hover styles (if not already handled by CSS)
          closeBtn.addEventListener("mouseenter", () => {
            closeBtn.style.background = "rgba(0, 0, 0, 0.1)";
          });
          closeBtn.addEventListener("mouseleave", () => {
            closeBtn.style.background = "none";
          });
        }
      }

      return toast;
    }

    /**
     * Get icon for toast type
     */
    getIconForType(type) {
      const icons = {
        success: "✓",
        error: "⚠",
        info: "ℹ",
        warning: "⚠",
        loading: null, // Will use spinner
      };
      return icons[type] || icons.info;
    }

    /**
     * Set up auto-dismiss with progress bar using existing GB classes
     */
    setAutoDisMiss(toastId, duration) {
      const toastData = this.toasts.get(toastId);
      if (!toastData) return;

      const toast = toastData.element;

      // Add progress bar using existing GB class
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
     * Dismiss a toast using existing GB animation classes
     */
    dismiss(toastId) {
      const toastData = this.toasts.get(toastId);
      if (!toastData) return;

      const toast = toastData.element;

      // Clear timeout if exists
      if (toastData.timeout) {
        clearTimeout(toastData.timeout);
      }

      // Add hide animation (existing GB CSS should handle this)
      toast.style.transform = "translateX(100%)";
      toast.style.opacity = "0";

      // Remove from DOM after animation
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
        this.toasts.delete(toastId);
      }, 300);

      logDebug(`Toast dismissed: ${toastId}`);
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
     * Clear specific toast by ID
     */
    clear(toastId) {
      this.dismiss(toastId);
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
     * @deprecated No longer needed - toast element itself has aria-live attribute
     * Kept for backward compatibility but not called by default
     */
    announceToast(message, type) {
      const announcement = `${type === "error" ? "Error: " : ""}${message}`;

      let announcer = document.getElementById("universal-toast-announcer");
      if (!announcer && document.body) {
        announcer = document.createElement("div");
        announcer.id = "universal-toast-announcer";
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

      if (announcer) {
        announcer.textContent = announcement;

        // Clear after announcement
        setTimeout(() => {
          announcer.textContent = "";
        }, 1000);
      }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }
  }

  // Create singleton instance (but don't initialise container yet)
  const notificationManager = new NotificationManager();

  /**
   * Display notification (main public API)
   */
  function show(message, type = "info", options = {}) {
    logDebug(`${type.toUpperCase()}: ${message}`);
    return notificationManager.show(message, type, options);
  }

  /**
   * Clear all notifications
   */
  function clearAll() {
    notificationManager.clearAll();
  }

  /**
   * Dismiss specific notification
   */
  function dismiss(toastId) {
    notificationManager.dismiss(toastId);
  }

  /**
   * Clear specific notification (alias for dismiss)
   */
  function clear(toastId) {
    notificationManager.clear(toastId);
  }

  // Log module initialisation
  logInfo("Universal notification system loaded with modal integration");

  // ====== PUBLIC API ======
  return {
    // Main methods
    show,
    clearAll,
    dismiss,
    clear,

    // Convenience methods
    success: (message, options) => show(message, "success", options),
    error: (message, options) => show(message, "error", options),
    warning: (message, options) => show(message, "warning", options),
    info: (message, options) => show(message, "info", options),
    loading: (message, options) => show(message, "loading", options),

    // Logging control methods
    setLogLevel,
    getLogLevel: () => currentLogLevel,
    LOG_LEVELS,

    // For debugging
    _manager: notificationManager,
  };
})();

// ====== GLOBAL INTEGRATION (PRESERVED FOR COMPATIBILITY) ======

// Export for other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = UniversalNotifications;
}

// Make available globally
window.UniversalNotifications = UniversalNotifications;

// ====== PRESERVED GLOBAL FUNCTIONS (BACKWARD COMPATIBILITY) ======

// Standard global functions
window.notify = UniversalNotifications.show;
window.notifySuccess = UniversalNotifications.success;
window.notifyError = UniversalNotifications.error;
window.notifyWarning = UniversalNotifications.warning;
window.notifyInfo = UniversalNotifications.info;
window.clearNotifications = UniversalNotifications.clearAll;

// Backward compatibility with Graph Builder
window.GraphBuilderNotifications = UniversalNotifications;
window.gbDisplayNotification = UniversalNotifications.show;
window.gbClearMessage = UniversalNotifications.clearAll;
window.toastManager = UniversalNotifications._manager;

// Additional legacy aliases that might be used
window.showNotification = UniversalNotifications.show;
window.showToast = UniversalNotifications.show;
window.toast = UniversalNotifications.show;
window.dismissNotification = UniversalNotifications.dismiss;
window.clearToasts = UniversalNotifications.clearAll;

// Log that system is ready
console.log(
  "🍞 Universal Notifications system ready with Graph Builder compatibility"
);
