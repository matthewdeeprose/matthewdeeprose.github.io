/**
 * @fileoverview Accessibility utilities for managing screen reader announcements,
 * keyboard interactions, and focus management across the application.
 *
 * @module a11y
 * @description A collection of accessibility helper functions that implement WCAG
 * best practices for dynamic content updates, keyboard navigation, and focus management.
 * Provides a centralized interface for consistent accessibility patterns across
 * components.
 *
 * Key features:
 * - Live region management for status announcements
 * - Programmatic focus control
 * - Keyboard interaction handling
 *
 * @example
 * // Status announcement
 * a11y.announceStatus("Processing request...");
 *
 * // Focus management
 * a11y.focusElement("result-heading");
 *
 * // Keyboard support
 * a11y.addKeyboardSupport(element, {
 *   'Enter': (e) => handleActivation(e),
 *   'Space': (e) => handleActivation(e),
 *   'Escape': (e) => handleDismiss(e)
 * });
 *
 * @version 1.0.0
 * @since 2025-01-20
 */

export const a11y = {
  announceStatus(message, type = "info") {
    const statusList = document.getElementById("statusList");
    if (!statusList) return;

    // Create new status item
    const li = document.createElement("li");
    li.className = `status-item ${type}`;

    // Create message text
    const messageSpan = document.createElement("span");
    messageSpan.className = "status-text";
    messageSpan.textContent = message;

    // Create timestamp
    const timeSpan = document.createElement("span");
    timeSpan.className = "status-time";
    const now = new Date();
    timeSpan.textContent = now.toLocaleTimeString();

    // Assemble the item
    li.appendChild(messageSpan);
    li.appendChild(timeSpan);

    // Add to list
    statusList.appendChild(li);

    // Scroll to bottom
    const container = statusList.parentElement;
    container.scrollTop = container.scrollHeight;

    // Keep only last 50 messages
    while (statusList.children.length > 50) {
      statusList.removeChild(statusList.firstChild);
    }

    // Announce to screen readers
    const liveRegion = document.createElement("div");
    liveRegion.setAttribute("role", "status");
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.className = "sr-only";
    liveRegion.textContent = `${message} at ${timeSpan.textContent}`;
    document.body.appendChild(liveRegion);

    // Remove live region after announcement
    setTimeout(() => {
      document.body.removeChild(liveRegion);
    }, 1000);
  },

  focusElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.focus();
    }
  },

  addKeyboardSupport(element, actions) {
    element.addEventListener("keydown", (event) => {
      if (actions[event.key]) {
        actions[event.key](event);
      }
    });
  },

  /**
   * Check if user prefers reduced motion
   * @returns {boolean} Whether reduced motion is preferred
   */
  prefersReducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (error) {
      console.error("Error checking reduced motion preference:", error);
      return false; // Default to standard motion if error occurs
    }
  },

  /**
   * Set up listener for motion preference changes
   * @param {Function} callback - Function to call when preference changes
   * @returns {Function} Function to remove the listener
   */
  watchMotionPreference(callback) {
    try {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      const listener = (event) => {
        console.log(
          `Motion preference changed: ${
            event.matches ? "reduced" : "standard"
          } motion`
        );
        callback(event.matches);
      };

      // Add event listener
      mediaQuery.addEventListener("change", listener);

      // Call immediately with current state
      callback(mediaQuery.matches);

      // Return function to remove listener
      return () => {
        try {
          mediaQuery.removeEventListener("change", listener);
        } catch (error) {
          console.error("Error removing motion preference listener:", error);
        }
      };
    } catch (error) {
      console.error("Error setting up motion preference watcher:", error);
      // Call callback with false (standard motion) and return no-op cleanup function
      callback(false);
      return () => {};
    }
  },
};
