/**
 * Shared screen-reader announcer (fix shape B).
 *
 * Repairs the long-missing `window.accessibilityHelpers` global that several
 * tools call defensively but which was never defined in production — so every
 * `announceToScreenReader(...)` / `announce(...)` call was a silent no-op.
 *
 * This is a plain IIFE script (NOT an ES module) deliberately: it carries no
 * dependencies, ensures its own live region exists, and is loaded by a normal
 * <script> tag early in tools.html so the global is published before any tool
 * script can call it. It defines only the method names production callers
 * actually expect (confirmed by scan):
 *   - announceToScreenReader(text)  — Chat + Local Chat (shared state factory)
 *   - announce(message)             — Set Up tool
 * Both are thin aliases over one internal say(text) that writes to a dedicated
 * top-level sr-only aria-live region (`#a11y-sr-announce`), kept SEPARATE from
 * `#radioSRannounce` so tool-switch announcements and tool announcements never
 * clobber each other.
 *
 * Deliberately NOT provided: announceStatus — no window caller needs it and it
 * would re-introduce the `#statusList` coupling this fix exists to avoid.
 *
 * @version 1.0.0
 */
(function () {
  "use strict";

  // ── Logging configuration ───────────────────────────────────────────────
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[A11yAnnouncer]");
      console.error.apply(console, args);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[A11yAnnouncer]");
      console.warn.apply(console, args);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[A11yAnnouncer]");
      console.log.apply(console, args);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[A11yAnnouncer]");
      console.log.apply(console, args);
    }
  }

  // ── Double-definition guard ──────────────────────────────────────────────
  // Respect a global that ALREADY provides these methods — a future real
  // definition, or a test mock (the isolation suite mocks
  // window.accessibilityHelpers). Only bail when BOTH expected methods are
  // already present; a partial/foreign object is completed rather than honoured.
  if (
    window.accessibilityHelpers &&
    typeof window.accessibilityHelpers.announceToScreenReader === "function" &&
    typeof window.accessibilityHelpers.announce === "function"
  ) {
    logWarn(
      "window.accessibilityHelpers already defines announceToScreenReader and announce — leaving it untouched",
    );
    return;
  }

  // ── Live region ──────────────────────────────────────────────────────────
  const REGION_ID = "a11y-sr-announce";

  // Cached reference to the dedicated live region. Resolved lazily via region()
  // so the announcer works whether or not the DOM element was present at load.
  let regionEl = null;

  /**
   * Locate the dedicated live region by id; create it defensively if missing so
   * the announcer never silently fails. The created element mirrors the markup
   * added to tools.html: a visually-hidden polite status region.
   * @returns {HTMLElement} the cached live-region element
   */
  function region() {
    if (regionEl && document.body.contains(regionEl)) return regionEl;

    regionEl = document.getElementById(REGION_ID);
    if (!regionEl) {
      logWarn(
        "live region #" + REGION_ID + " not found in DOM — creating it defensively",
      );
      regionEl = document.createElement("span");
      regionEl.id = REGION_ID;
      regionEl.className = "sr-only";
      regionEl.setAttribute("role", "status");
      regionEl.setAttribute("aria-live", "polite");
      document.body.appendChild(regionEl);
    }
    return regionEl;
  }

  /**
   * Announce text to screen readers via the dedicated live region. To force a
   * re-announcement even when the new text is identical to the current text, the
   * region is cleared first, then set on the next animation frame (falling back
   * to a 50ms timeout) — this guarantees a live-region change event fires.
   * @param {string} text the message to announce; falsy values are ignored
   */
  function say(text) {
    if (!text) return;

    const el = region();
    el.textContent = "";

    const apply = function () {
      el.textContent = text;
      logDebug("announced:", text);
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(apply);
    } else {
      window.setTimeout(apply, 50);
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────
  // Aliases match the exact method names production callers expect.
  function announceToScreenReader(text) {
    say(text);
  }

  function announce(message) {
    say(message);
  }

  window.accessibilityHelpers = {
    announceToScreenReader: announceToScreenReader,
    announce: announce,
    say: say,
  };

  logInfo("window.accessibilityHelpers ready (announceToScreenReader, announce, say)");
})();
