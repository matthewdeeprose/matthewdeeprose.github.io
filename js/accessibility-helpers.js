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

// Maximum entries kept in the visible status history before the oldest are trimmed.
const MAX_STATUS_HISTORY = 50;

/**
 * Speak a status message through the shared announcer.
 *
 * The announcer is resolved HERE, at announce time, rather than being captured
 * once — accessibility-announcer.js is a plain script and this is a deferred ES
 * module, so the ordering happens to work today, but a cached reference would
 * fail silently the moment load order shifted. That is exactly the bug class this
 * function used to embody.
 *
 * @param {string} message
 * @param {string} type caller-supplied urgency: "assertive", "polite" or "info"
 */
function speak(message, type) {
  const announcer = window.accessibilityHelpers;
  if (!announcer || typeof announcer.announce !== "function") return;

  // Anything not explicitly assertive stays polite — interrupting is opt-in.
  announcer.announce(message, type === "assertive" ? "assertive" : "polite");
}

export const a11y = {
  announceStatus(message, type = "info") {
    // Announce FIRST, and unconditionally. This used to return early when
    // #statusList was absent, so a page without the visible history announced
    // nothing at all; and the announcement itself was a hand-rolled region whose
    // textContent was set BEFORE it was appended, which gives the live-region
    // monitor no mutation to react to. Both are now the announcer's job — it owns
    // a top-level region that is exposed from every mode, whereas #statusList
    // lives inside #openrouter-app and is aria-hidden until that tool is chosen.
    //
    // The timestamp is deliberately NOT spoken: it is a column in the visible log,
    // and "Error occurred at 14:32:05" on every status is noise in the ear.
    speak(message, type);

    // The visible status history is a separate, sighted-user feature. It is
    // populated when present and simply skipped when it is not.
    const statusList = document.getElementById("statusList");
    if (!statusList) return;

    // Create new status item
    const li = document.createElement("li");
    li.className = `status-item ${type}`;

    // Create message text
    const messageSpan = document.createElement("span");
    messageSpan.className = "status-text";
    messageSpan.textContent = message;

    // Create timestamp. Hidden from assistive technology: it is a column for
    // sighted scanning, and #statusList is a role="log" region, so every entry was
    // being read with its clock time appended and no separator — a listener on
    // 2 August 2026 heard "Short, concise responses09:00:47". Announcing the time
    // after every status is noise even when it is separated properly.
    const timeSpan = document.createElement("span");
    timeSpan.className = "status-time";
    timeSpan.setAttribute("aria-hidden", "true");
    const now = new Date();
    timeSpan.textContent = now.toLocaleTimeString();

    // Assemble the item
    li.appendChild(messageSpan);
    li.appendChild(timeSpan);

    // Add to list
    statusList.appendChild(li);

    // Scroll to bottom
    const container = statusList.parentElement;
    if (container) container.scrollTop = container.scrollHeight;

    // Keep only the most recent entries
    while (statusList.children.length > MAX_STATUS_HISTORY) {
      statusList.removeChild(statusList.firstChild);
    }
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
