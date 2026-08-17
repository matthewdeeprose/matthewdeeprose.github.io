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
          (key) => LOG_LEVELS[key] === level,
        )}`,
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
        "Notification manager created (container will be initialised when needed)",
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
        "dialog[open], .universal-modal[open]",
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
              "Converted Graph Builder toast container to universal container",
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
            "Cannot create toast container - document.body is not available",
          );
          return false;
        }

        this.container = document.createElement("div");
        this.container.id = "universal-toast-container";
        // Use existing Graph Builder classes for styling
        this.container.className =
          "gb-toast-container universal-toast-container";
        // NOT a live region — deliberately. Each toast carries its own
        // role="status"/"alert" (see createToast). A live CONTAINER announced
        // its own label whenever it emptied, and nested with the error toasts'
        // role="alert" so those spoke twice. role + label stay so the area is
        // still a navigable, named landmark.
        //
        // Kept in step with the markup container in tools.html. This path is a
        // fallback: initContainer() reuses an existing #universal-toast-container
        // or a legacy #gb-toast-container WITHOUT setting any ARIA, so on pages
        // that ship the container in markup this function never runs. Both
        // definitions have to agree or the behaviour depends on which page you
        // are on — the mismatch that made an earlier fix a no-op.
        this.container.setAttribute("role", "region");
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
     * @param {string} message - Notification text
     * @param {string} [type="info"] - "success" | "error" | "warning" | "info" | "loading"
     * @param {Object} [options] - Per-notification options
     * @param {number} [options.duration] - Auto-dismiss ms (type default if omitted)
     * @param {boolean} [options.dismissible=true] - Show dismiss control
     * @param {boolean} [options.persistent=false] - Toast-only: never auto-dismiss
     * @param {Array}   [options.actions] - Action-button definitions
     * @param {boolean} [options.forceToast=false] - Bypass the modal-active
     *   routing check and always render as a global toast. Used by callers
     *   that fire a notification while a modal is about to close (e.g. the
     *   image manager's X-button save-on-close interceptor), where the
     *   in-modal status host would be destroyed by the close animation
     *   before the user could see the toast. See Discovery 19.
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

      // If modal is active AND not forced to toast, use in-modal notification.
      // forceToast: true is used by callers that know the modal is about
      // to close (e.g. save-on-X-close) so the toast would otherwise be
      // eaten by the close animation. See Discovery 19.
      if (this.isModalActive() && !options.forceToast) {
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
          actions: options.actions,
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
        { allowHtml: options.allowHtml, actions: options.actions },
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

      // Announce through the app's PERMANENT announcer region, not from the
      // toast DOM at all. See _announceToast().
      this._announceToast(message, type);

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
     * Speak a notification through the app's shared announcer.
     *
     * WHY NOT FROM THE TOAST DOM
     * --------------------------
     * Three arrangements were tried and measured on NVDA, 3 August 2026:
     *
     *   1. container aria-live="polite"        toasts spoke, but EMPTYING the
     *      (the original)                      container also spoke — every
     *                                          dismiss said "Notifications",
     *                                          and an error toast's role="alert"
     *                                          nested inside it, so errors spoke
     *                                          TWICE, app-wide.
     *   2. + aria-relevant="additions"         no change; the attribute is not
     *      (a8031f9)                           honoured in this combination.
     *   3. role on each toast, container not   "Notifications" gone, but
     *      live (40f4ef4, 9993069)             non-error toasts went SILENT,
     *                                          even after latching the region
     *                                          empty and adding content a frame
     *                                          later.
     *
     * (3) was not a sequencing mistake. Probed while a toast was on screen, the
     * toast read ignored=false, role=status, live=polite, visibility visible —
     * a correctly exposed live region that NVDA still did not speak. A region
     * created milliseconds before its content is not registered in time,
     * whatever order the writes happen in.
     *
     * So the toast DOM is now purely visual, and the announcement goes through
     * window.accessibilityHelpers — a region that exists from page load and has
     * announced reliably throughout. Resolved at call time, never cached, per
     * AGENTS.md § Announcements.
     *
     * One announcement per toast: the toast itself is silent, so this is the
     * only utterance. Callers must still not add their own announce() beside a
     * notify*() — that would be two.
     *
     * @param {string} message - The message text, without icon or close-button markup
     * @param {string} type - success | error | warning | info
     */
    _announceToast(message, type) {
      const announcer = window.accessibilityHelpers;
      if (!announcer || typeof announcer.announce !== "function") {
        logWarn("No screen-reader announcer available; toast not announced");
        return;
      }
      // Errors interrupt; everything else waits its turn.
      announcer.announce(message, type === "error" ? "assertive" : "polite");
      logDebug(`Toast announced (${type}): ${message}`);
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
      options = {},
    ) {
      const toast = document.createElement("div");
      toast.id = toastId;
      // Use existing Graph Builder classes
      toast.className = `gb-toast gb-toast-${type}`;
      // EVERY toast is its own live region, and the CONTAINER is not one.
      //
      // Phase 7.3J previously gave role="alert" to error toasts only and left
      // non-error toasts relying on the container's aria-live="polite". That
      // was half a fix: it removed one nesting (role="status" AND aria-live on
      // the same toast) but left another, because an error toast's role="alert"
      // still sat INSIDE the polite container. Error toasts therefore announced
      // twice, app-wide, in every mode.
      //
      // The container being live also meant that EMPTYING it announced: every
      // auto-dismissing toast was followed by the container's own label and
      // nothing else — heard on NVDA 3 August 2026 as "Notifications", "blank".
      // aria-relevant="additions" was tried first (a8031f9) and NVDA announced
      // the emptying anyway, so that attribute is not honoured here; it has been
      // removed rather than left as a misleading no-op.
      //
      // Moving the liveness onto the toast fixes both: nothing nests, and the
      // element that disappears IS the live region, so its removal is silent.
      //
      // Safe to set the role at creation, before the element is in the DOM.
      // General advice says a live region should exist before its content
      // changes, but the error path here has always done exactly this and error
      // toasts demonstrably announce — measured repeatedly this session. The
      // same construction is now used for both.
      // NO live-region role. The toast is visual only; the announcement goes
      // through the shared announcer in _announceToast(). Giving the toast a
      // role here as well would speak every notification twice — which is the
      // defect this whole sequence started from.

      toast.style.pointerEvents = "auto";
      toast.style.zIndex = "inherit"; // Inherit from container

      // Apply base classes (CSS will handle styling via existing GB classes)
      toast.classList.add("gb-toast-base");

      // Get icon for type
      const icon = this.getIconForType(type);

      // Build content using existing GB structure
      // Phase 7.3J: Auto-dismissing toasts skip the close button entirely
      // to prevent screen readers announcing "Dismiss notification" as part of the message.
      // The button remains for persistent/error toasts (duration === 0).
      const showCloseButton = dismissible && !(duration > 0);

      toast.innerHTML = `
        <div class="gb-toast-icon" aria-hidden="true">${icon}</div>
        <div class="gb-toast-content">${
          options.allowHtml ? message : this.escapeHtml(message)
        }</div>
        <div class="gb-toast-actions"></div>
        ${
          showCloseButton
            ? `
          <button type="button" class="gb-toast-close" aria-label="Close notification">
            <span aria-hidden="true">×</span>
          </button>
        `
            : ""
        }
      `;

      // Populate optional action buttons. Sits alongside .gb-toast-content,
      // outside any aria-live region — labels won't pollute SR announcements.
      const actionsSlot = toast.querySelector(".gb-toast-actions");
      if (
        actionsSlot &&
        Array.isArray(options.actions) &&
        options.actions.length > 0
      ) {
        options.actions.forEach((action) => {
          if (!action || typeof action.onClick !== "function") return;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "gb-toast-action";
          btn.textContent = action.label || "";
          if (action.ariaLabel) {
            btn.setAttribute("aria-label", action.ariaLabel);
          }
          btn.addEventListener("click", () => {
            try {
              action.onClick();
            } catch (err) {
              logError("Toast action onClick threw:", err);
            }
            if (action.dismissOnClick !== false) {
              this.dismiss(toastId);
            }
          });
          actionsSlot.appendChild(btn);
        });
      }

      // Add close functionality (only if close button was rendered)
      if (showCloseButton) {
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
  "🍞 Universal Notifications system ready with Graph Builder compatibility",
);
