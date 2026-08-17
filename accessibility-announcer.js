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
 *   - announceToScreenReader(text, politeness)  — Chat + Local Chat
 *   - announce(message, politeness)             — Set Up tool, js/accessibility-helpers.js
 * Both are thin aliases over one internal say(text, politeness) that writes to a
 * dedicated top-level sr-only region, kept SEPARATE from `#radioSRannounce` so
 * tool-switch announcements and tool announcements never clobber each other.
 *
 * TWO CHANNELS (added because the polite-only version could not serve the error
 * paths, which explicitly ask for assertive and were reaching nobody at all):
 *   polite    → #a11y-sr-announce  role=status  aria-live=polite     (default)
 *   assertive → #a11y-sr-alert     role=alert   aria-live=assertive
 * `politeness` is optional and additive — every pre-existing caller omits it and
 * keeps the polite behaviour it has always had.
 *
 * Both regions are top-level in tools.html, OUTSIDE every tool <article>. That is
 * load-bearing: the articles ship display:none + aria-hidden="true" until a tool
 * is chosen, so a region nested inside one is silent from every other mode.
 *
 * Deliberately NOT provided: announceStatus — that name belongs to
 * js/accessibility-helpers.js, which owns the visible #statusList history and
 * now delegates its ANNOUNCEMENT here. Adding it would re-introduce the
 * `#statusList` coupling this file exists to avoid.
 *
 * @version 1.1.0
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

  // ── Live regions ─────────────────────────────────────────────────────────
  // Two channels, because politeness cannot be changed on a live region after the
  // fact with any reliability — readers latch it when the region enters the tree.
  // POLITE queues behind whatever is being spoken; ASSERTIVE interrupts, and is
  // for the cases the calling code already marks that way (errors, retry
  // exhaustion, invalid parameters, credits running out).
  const POLITE = "polite";
  const ASSERTIVE = "assertive";

  const REGION_ID = "a11y-sr-announce"; // polite; kept for backwards compatibility
  const ALERT_REGION_ID = "a11y-sr-alert"; // assertive

  const REGION_SPEC = {
    polite: { id: REGION_ID, role: "status", live: POLITE },
    assertive: { id: ALERT_REGION_ID, role: "alert", live: ASSERTIVE },
  };

  // The region is cleared this long after the text is applied, so the reader has
  // spoken it before it goes, and it does not linger as stale browse-mode content
  // above the page's h1.
  const ANNOUNCER_CLEAR_DELAY_MS = 5000;

  // Per-channel state. This MUST NOT be shared between the two: a polite
  // announcement cancelling an assertive one's pending clear would blank the
  // alert early, and a shared sequence counter would make each channel's clear
  // bow out whenever the other had spoken more recently.
  const channels = {
    polite: { el: null, seq: 0, clearHandle: null, lastText: null, lastAt: 0 },
    assertive: { el: null, seq: 0, clearHandle: null, lastText: null, lastAt: 0 },
  };

  // Repeat suppression. Two callers describing one event, or one caller running
  // twice during initialisation, both produce the identical string back-to-back —
  // and the second utterance carries no information while costing the listener the
  // time to hear it. Measured on a page load 2 August 2026: "Selected model: Claude
  // Haiku 4.5 (anthropic)." reached this channel three times and "Maximum Response
  // Length set to 1024. Short, concise responses" five times, before the user had
  // touched anything.
  //
  // Scoped to a WINDOW rather than forever: setting a slider to 5, away, and back to
  // 5 is a real change the user asked for and must still be confirmed. The window
  // matches the clear delay, so a repeat is only dropped while the first is still
  // the region's content.
  const REPEAT_SUPPRESS_MS = ANNOUNCER_CLEAR_DELAY_MS;

  // How long to wait before applying the text when requestAnimationFrame cannot
  // be used or cannot be trusted (see the occlusion note in say()). Short enough
  // that the clear-then-set pair still reads as one change to a screen reader.
  const APPLY_FALLBACK_DELAY_MS = 50;

  /**
   * Normalise a caller-supplied politeness to one of the two channel keys.
   * Anything not explicitly assertive is polite — assertive interrupts, so it is
   * opt-in rather than the fallback.
   * @param {string} [politeness]
   * @returns {"polite"|"assertive"}
   */
  function channelKey(politeness) {
    return politeness === ASSERTIVE ? ASSERTIVE : POLITE;
  }

  /**
   * Locate the dedicated live region by id; create it defensively if missing so
   * the announcer never silently fails. The created element mirrors the markup
   * added to tools.html: a visually-hidden polite status region.
   * @returns {HTMLElement} the cached live-region element
   */
  function region(politeness) {
    const key = channelKey(politeness);
    const spec = REGION_SPEC[key];
    const channel = channels[key];

    if (channel.el && document.body.contains(channel.el)) return channel.el;

    channel.el = document.getElementById(spec.id);
    if (!channel.el) {
      logWarn(
        "live region #" + spec.id + " not found in DOM — creating it defensively",
      );
      channel.el = document.createElement("span");
      channel.el.id = spec.id;
      channel.el.className = "sr-only";
      channel.el.setAttribute("role", spec.role);
      channel.el.setAttribute("aria-live", spec.live);
      document.body.appendChild(channel.el);
    }
    return channel.el;
  }

  /**
   * Announce text to screen readers via the dedicated live region. To force a
   * re-announcement even when the new text is identical to the current text, the
   * region is cleared first, then set on the next animation frame (falling back
   * to a 50ms timeout) — this guarantees a live-region change event fires.
   * @param {string} text the message to announce; falsy values are ignored
   */
  function say(text, politeness) {
    if (!text) return;

    const key = channelKey(politeness);
    const channel = channels[key];

    // Drop an identical repeat inside the window (see REPEAT_SUPPRESS_MS above).
    const now = Date.now();
    if (channel.lastText === text && now - channel.lastAt < REPEAT_SUPPRESS_MS) {
      logDebug("suppressed repeat (" + key + "):", text);
      return;
    }
    channel.lastText = text;
    channel.lastAt = now;

    const el = region(key);
    el.textContent = "";

    // A newer announcement supersedes any clear still pending for the previous one:
    // cancel that timer, then stamp this announcement with its own sequence number.
    // Both are per-CHANNEL — a polite announcement must never cancel an assertive
    // one's clear, nor make it bow out by advancing a shared counter.
    if (channel.clearHandle !== null) {
      window.clearTimeout(channel.clearHandle);
      channel.clearHandle = null;
    }
    channel.seq += 1;
    const mySeq = channel.seq;

    const apply = function () {
      el.textContent = text;
      logDebug("announced (" + key + "):", text);

      // Clear the region once the reader has had time to speak it, so it does not
      // remain as stale browse-mode content above the page's h1. The clear only
      // blanks the announcement it was scheduled for: if a newer say() has since
      // run on THIS channel, mySeq no longer matches and this timer bows out.
      channel.clearHandle = window.setTimeout(function () {
        channel.clearHandle = null;
        if (mySeq !== channel.seq) return;
        el.textContent = "";
        logDebug("cleared " + key + " region after", ANNOUNCER_CLEAR_DELAY_MS, "ms");
      }, ANNOUNCER_CLEAR_DELAY_MS);
    };

    // requestAnimationFrame is fully SUSPENDED while the document is occluded —
    // another window covering the browser is enough. Measured 4 August 2026
    // during a listen: one announcement's region write landed 53 SECONDS late,
    // on re-exposure. By then it speaks stale, describing an event the user
    // finished with long before, which is worse than not speaking at all. The
    // existing timeout path keeps running while hidden, so use it instead.
    // Also removes a timing hazard for automated runs in an occluded window.
    const occluded =
      typeof document.visibilityState === "string" &&
      document.visibilityState === "hidden";

    if (!occluded && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(apply);
    } else {
      window.setTimeout(apply, APPLY_FALLBACK_DELAY_MS);
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────
  // Aliases match the exact method names production callers expect. The optional
  // second argument is additive: every existing caller omits it and keeps the
  // polite behaviour it has always had.
  function announceToScreenReader(text, politeness) {
    say(text, politeness);
  }

  function announce(message, politeness) {
    say(message, politeness);
  }

  window.accessibilityHelpers = {
    announceToScreenReader: announceToScreenReader,
    announce: announce,
    say: say,
  };

  logInfo(
    "window.accessibilityHelpers ready (announceToScreenReader, announce, say; polite + assertive channels)",
  );
})();
