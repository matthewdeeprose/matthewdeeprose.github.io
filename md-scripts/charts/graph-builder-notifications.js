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

      this._trackFocusOutside();

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
      // Deliberately NOT a live region. A live container announces its own
      // emptying (heard on NVDA as "Notifications" after every dismiss) and
      // nests an error toast's role="alert" inside it, so errors speak twice.
      // The announcement goes through announceToast() instead — see the
      // arrangement history in createToast() in js/universal-notifications.js.

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

      // While a dialog is open this notifier's toast would be painted under the
      // dialog, inert and outside the accessibility tree. Hand the message to the
      // page notifier, which shows it in the dialog's own message bar. Both
      // globals are resolved at call time, and forceToast keeps an explicit choice.
      const pageNotifier = window.UniversalNotifications;
      const modal = window.UniversalModal;
      if (
        !options.forceToast &&
        pageNotifier &&
        pageNotifier !== window.GraphBuilderNotifications &&
        typeof pageNotifier.show === "function" &&
        modal &&
        typeof modal.isModalActive === "function" &&
        modal.isModalActive()
      ) {
        return pageNotifier.show(message, type, options);
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
        returnFocusTo: this._captureFocusOrigin(),
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
      // NO live-region role on the toast. A per-toast role="status" was
      // measured SILENT on NVDA (4 August 2026, Test D) — a live region
      // created in the same tick as its content is not registered in time —
      // and role="alert" made errors speak twice (Test E). The toast is
      // visual only; the single announcement goes through announceToast().

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
        // Focus returns whatever the input: a screen reader's browse mode clicks like a
        // mouse. Only a key press (detail 0) also scrolls the control into view.
        closeBtn.addEventListener("click", (e) =>
          this.dismiss(toastId, {
            returnFocus: true,
            scrollIntoView: e.detail === 0,
          }),
        );

        // Keyboard support
        closeBtn.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.dismiss(toastId, { returnFocus: true, scrollIntoView: true });
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
    dismiss(toastId, options = {}) {
      const toastData = this.toasts.get(toastId);
      if (!toastData) return;

      const toast = toastData.element;

      // Clear timeout if exists
      if (toastData.timeout) {
        clearTimeout(toastData.timeout);
      }

      if (options.returnFocus) {
        this._returnFocusAfterClose(toast, toastData, options);
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
     * A focus move made by a real pointer press, or by a key press that is not
     * Tab or a lone modifier, replaces where an open toast's close returns
     * focus: a person who clicks on to another control, or moves on by arrow
     * keys, is sent there. Focus that arrives with no press behind it (the
     * browser handing focus back to the page, a screen reader's cursor passing a
     * control) and a Tab walk to the toast leave the target alone. A pointer
     * press counts from its pointerdown until just after its click, so a label
     * handing focus to its input during the click is covered; a key press counts
     * until the end of its own task, which covers focus moved by its handler or
     * default action. Space counts on release as well as on press, because a
     * button runs its Space action on release.
     */
    _trackFocusOutside() {
      const PRESS_FALLBACK_MS = 400;
      const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);
      let tabHeld = false;
      let pointerEvidence = false;
      let keyEvidence = false;
      let fallbackTimer = 0;
      const inToastArea = (node) =>
        node instanceof Element && node.closest(".gb-toast-container, .gb-toast") !== null;
      const endEvidence = () => {
        pointerEvidence = false;
        keyEvidence = false;
        clearTimeout(fallbackTimer);
      };
      document.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          tabHeld = true;
          return;
        }
        if (!e.isTrusted || MODIFIER_KEYS.has(e.key) || inToastArea(e.target)) return;
        keyEvidence = true;
        setTimeout(endEvidence, 0);
      }, true);
      document.addEventListener("keyup", (e) => {
        tabHeld = false;
        if (e.key !== " " || !e.isTrusted || inToastArea(e.target)) return;
        keyEvidence = true;
        setTimeout(endEvidence, 0);
      }, true);
      document.addEventListener("pointerdown", (e) => {
        if (!e.isTrusted || inToastArea(e.target)) return;
        pointerEvidence = true;
      }, true);
      document.addEventListener("pointerup", () => {
        clearTimeout(fallbackTimer);
        fallbackTimer = setTimeout(endEvidence, PRESS_FALLBACK_MS);
      }, true);
      document.addEventListener("click", () => { setTimeout(endEvidence, 0); }, true);
      document.addEventListener("pointercancel", endEvidence, true);
      document.addEventListener("focusin", (e) => {
        if (tabHeld || !(pointerEvidence || keyEvidence)) return;
        const target = e.target;
        if (!(target instanceof Element)) return;
        if (target === document.body || target === document.documentElement) return;
        if (target.closest(".gb-toast-container, .gb-toast")) return;
        for (const toastData of this.toasts.values()) toastData.returnFocusTo = target;
      });
    }

    /**
     * The control that had focus when a toast appeared, so a keyboard close can
     * send focus back to it. Null when focus was on the page itself or inside
     * the toast area.
     */
    _captureFocusOrigin() {
      const active = document.activeElement;
      if (!active || active === document.body || active === document.documentElement) return null;
      if (this.container && this.container.contains(active)) return null;
      return active;
    }

    /**
     * True when focus() on this element would land: it is still in the page,
     * not disabled, not inert and not hidden by itself or any ancestor.
     */
    _canReceiveFocus(el) {
      if (!el) return false;
      if (!el.isConnected) return false;
      if (el.disabled || el.closest("[inert]")) return false;
      for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return false;
      }
      return true;
    }

    /**
     * True when the element lies entirely outside the box of an ancestor that
     * clips it and actually overflows (a scrolling panel that has scrolled the
     * element out of its own window). Such a control is on the page but hidden.
     */
    _isClippedOut(el, rect) {
      for (let node = el.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
        const style = getComputedStyle(node);
        const clips = ["auto", "scroll", "hidden"];
        if (!clips.includes(style.overflowX) && !clips.includes(style.overflowY)) continue;
        if (node.scrollHeight <= node.clientHeight && node.scrollWidth <= node.clientWidth) continue;
        const box = node.getBoundingClientRect();
        const left = box.left + node.clientLeft;
        const top = box.top + node.clientTop;
        const right = left + node.clientWidth;
        const bottom = top + node.clientHeight;
        if (rect.bottom <= top || rect.top >= bottom || rect.right <= left || rect.left >= right) return true;
      }
      return false;
    }

    /**
     * Focus an element. A pointer close leaves the page where it is while any
     * part of the element is in view, so it never jumps under a mouse user, but
     * scrolls the element in when it is entirely out of view (off the viewport,
     * or scrolled out of the window of its own scrolling panel), so the control
     * focus returns to is never left hidden. A keyboard close
     * (scrollIntoView) always makes sure the element is on screen: the page
     * root can scroll smoothly, and a smooth scroll already under way can beat
     * the one focus() starts, leaving the focused control outside the viewport.
     * An instant "nearest" scroll moves nothing when the element is already
     * fully in view, and brings a clipped element into every scrolling ancestor.
     */
    _focusInView(el, scrollIntoView) {
      if (!scrollIntoView) {
        el.focus({ preventScroll: true });
        const rect = el.getBoundingClientRect();
        const offScreen = rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth || this._isClippedOut(el, rect);
        if (!offScreen) return;
      }
      const place = () => {
        el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
        this._keepClearOfToasts(el);
        // Pin the scroll position: an instant scroll to where the page already is
        // cancels a smooth scroll still running from an earlier focus change.
        window.scrollTo({ left: window.scrollX, top: window.scrollY, behavior: "instant" });
      };
      el.focus({ preventScroll: true });
      place();
      // A scroll the browser had already queued can still nudge the page on the
      // next frame, so settle once more if focus has not moved on.
      requestAnimationFrame(() => {
        if (document.activeElement === el) place();
      });
    }

    /**
     * Where the toast container is fixed over the page (the strip along the top
     * of a narrow page), a control the scroll above has pinned to the page edge
     * can sit under a toast that is staying. Move the page, and then any
     * scrolling panel the control is in, so the control sits just below the
     * live toasts. A toast on its way out does not count. A control taller than
     * the space left is aligned to the top of that space.
     */
    _keepClearOfToasts(el) {
      if (!this.container || getComputedStyle(this.container).position !== "fixed") return;
      const clearancePx = 8; // 0.5rem, the gap the strip keeps from the page edge
      const rect = el.getBoundingClientRect();
      // A control that already runs above the top of the screen stays where the
      // person scrolled it; moving the page to clear it would throw them to the
      // top of the control. One the scroll above has pinned to the edge reads
      // within a pixel of zero, so that much slack is allowed.
      const pinnedSlackPx = 1;
      if (rect.top < -pinnedSlackPx) return;
      let needed = 0;
      for (const toast of this.container.querySelectorAll(".gb-toast")) {
        if (toast.getAttribute("data-dismissing") === "true") continue;
        const box = toast.getBoundingClientRect();
        const overlaps = box.left < rect.right && box.right > rect.left && box.top < rect.bottom && box.bottom > rect.top;
        if (overlaps) needed = Math.max(needed, box.bottom + clearancePx - rect.top);
      }
      if (needed <= 0) return;
      window.scrollBy({ top: -needed, behavior: "instant" });
      let remaining = needed - (el.getBoundingClientRect().top - rect.top);
      for (let node = el.parentElement; node && remaining > 0 && node !== document.body && node !== document.documentElement; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (!["auto", "scroll"].includes(style.overflowY) || node.scrollTop <= 0) continue;
        const before = node.scrollTop;
        node.scrollTop = Math.max(0, before - remaining);
        remaining -= before - node.scrollTop;
      }
    }

    /**
     * Close button of the first other toast that is not itself on its way out.
     */
    _nextCloseButton(closing) {
      if (!this.container) return null;
      for (const button of this.container.querySelectorAll(".gb-toast-close")) {
        const owner = button.closest(".gb-toast");
        if (owner && owner !== closing && owner.getAttribute("data-dismissing") !== "true") return button;
      }
      return null;
    }

    /**
     * Closing the toast would drop focus on <body>, so place it deliberately.
     * Order: the control that had focus when the toast appeared (or the one the
     * person has since moved on to by a real press, see _trackFocusOutside), then
     * the next toast's close button, then the first rendered heading in #main.
     * options.scrollIntoView is set for a key press; see _focusInView for a pointer.
     */
    _returnFocusAfterClose(toast, toastData, options) {
      if (toast.getAttribute("data-dismissing") === "true") return;
      toast.setAttribute("data-dismissing", "true");

      const scroll = options.scrollIntoView === true;
      const origin = toastData.returnFocusTo;
      if (this._canReceiveFocus(origin)) {
        this._focusInView(origin, scroll);
        return;
      }

      const next = this._nextCloseButton(toast);
      if (next) {
        this._focusInView(next, scroll);
        return;
      }

      const heading = Array.from(document.querySelectorAll("#main h1, #main h2, #main h3, #main h4, #main h5, #main h6")).find(
        (el) => !el.closest(".gb-toast-container") && this._canReceiveFocus(el),
      );
      if (!heading) return;
      if (!heading.hasAttribute("tabindex")) {
        heading.setAttribute("tabindex", "-1");
        heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
      }
      this._focusInView(heading, scroll);
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
      // Speak through the app's PERMANENT announcer (window.accessibilityHelpers,
      // resolved at call time, never cached — AGENTS.md § Announcements), exactly
      // as js/universal-notifications.js does. The previous self-made
      // #gb-toast-announcer was created in the same tick as its first message,
      // which screen readers do not register in time (its first toast was
      // measured silent on NVDA, 4 August 2026), and it was assertive, so every
      // later info toast interrupted whatever was being spoken.
      const announcer = window.accessibilityHelpers;
      if (!announcer || typeof announcer.announce !== "function") {
        logWarn("No screen-reader announcer available; toast not announced");
        return;
      }
      // Errors interrupt; everything else waits its turn.
      announcer.announce(message, type === "error" ? "assertive" : "polite");
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
