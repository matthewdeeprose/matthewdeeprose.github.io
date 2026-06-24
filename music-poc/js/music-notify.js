// music-notify.js
// Notification adapter for the Accessible Music proof of concept.
//
// Today this runs in FALLBACK mode: notifications are delivered through
// window.MusicAnnounce (the visible aria-live status region) and logged via
// MusicLog. Its signatures and return contract are written to match the real
// notification system exactly, so wiring in the real system later is a
// one-line change at the SWAP POINT inside show(). Exposed as
// window.MusicNotify.

const MusicNotify = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Identical-(message,type) notifications within this window are suppressed,
  // mirroring the real system's duplicate-suppression behaviour.
  const DUPLICATE_WINDOW_MS = 2000;
  const recent = new Map(); // key `${type}::${message}` -> last-shown timestamp (ms)
  let toastCounter = 0; // for fallback id strings

  // Map a notification type to the log function that should record it. Defined
  // after the destructure so the real functions are captured.
  const LOG_BY_TYPE = {
    error: logError,
    warning: logWarn,
    info: logInfo,
    success: logInfo,
    loading: logDebug,
  };

  // True if an identical (message, type) was shown within DUPLICATE_WINDOW_MS.
  // Records the timestamp for non-duplicates so the window is rolling.
  function isDuplicate(message, type) {
    const key = type + "::" + message;
    const now = Date.now();
    const last = recent.get(key);
    if (last !== undefined && now - last < DUPLICATE_WINDOW_MS) return true;
    recent.set(key, now);
    return false;
  }

  // Fallback delivery: speak/show via MusicAnnounce and log by type. Returns an
  // opaque id-style string, or null if delivery could not happen (mirroring the
  // real system returning null when its container fails).
  function deliverFallback(message, type) {
    if (!window.MusicAnnounce || typeof window.MusicAnnounce.announce !== "function") {
      logWarn("MusicAnnounce unavailable; notification not delivered");
      return null;
    }
    window.MusicAnnounce.announce(message);
    (LOG_BY_TYPE[type] || logInfo)(message);
    toastCounter += 1;
    return "music-toast-" + toastCounter;
  }

  // Primary entry point. Suppresses duplicates, then delivers. The options
  // object (duration, dismissible, persistent, actions, allowHtml, forceToast)
  // is accepted here and passed straight to the real system at the SWAP POINT;
  // the fallback itself needs only message + type.
  function show(message, type, options = {}) {
    if (isDuplicate(message, type)) {
      logDebug("Suppressed duplicate notification: " + type + " " + message);
      return null;
    }
    // === SWAP POINT — to wire the real system, replace the next line with:
    //        return window.notify(message, type, options);
    return deliverFallback(message, type);
  }

  // Convenience methods — names mirror the real notification object exactly.
  function info(message, options) {
    return show(message, "info", options);
  }
  function success(message, options) {
    return show(message, "success", options);
  }
  function warning(message, options) {
    return show(message, "warning", options);
  }
  function error(message, options) {
    return show(message, "error", options);
  }

  // Self-test: verifies the adapter's surface, the duplicate contract, options
  // acceptance, and that delivery routes through MusicAnnounce. Uses a fresh
  // unique message per assertion so dedup never interferes between assertions,
  // except the duplicate test which deliberately reuses one message twice.
  // Captures and restores #status so the page is left untouched. Uses only
  // info() for behavioural checks (logInfo is silent at the WARN default) —
  // error()/warning() would print to the console.
  function selfTest() {
    const statusEl = document.getElementById("status");
    const priorText = statusEl ? statusEl.textContent : "";

    // Unique-message helper so distinct assertions never collide on dedup.
    const uniq = (label) =>
      "selftest-" + label + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

    const uniqueA = uniq("A");
    const uniqueB = uniq("B");
    const uniqueC = uniq("C");
    const dupMsg = uniq("dup");

    const idA = info(uniqueA);
    const dupFirst = info(dupMsg);
    const dupSecond = info(dupMsg);
    const idB = info(uniqueB, { forceToast: true, duration: 0 });
    info(uniqueC);

    const results = {
      hasShow: typeof show === "function",
      hasInfo: typeof info === "function",
      hasSuccess: typeof success === "function",
      hasWarning: typeof warning === "function",
      hasError: typeof error === "function",
      duplicateWindowIs2000: DUPLICATE_WINDOW_MS === 2000,
      returnsIdString: typeof idA === "string" && idA.length > 0,
      duplicateReturnsNull: typeof dupFirst === "string" && dupSecond === null,
      acceptsForceToast: typeof idB === "string",
      routesToAnnounce:
        !!statusEl && document.getElementById("status").textContent === uniqueC,
    };

    // Restore the original status text so the test leaves no leftover.
    if (statusEl) statusEl.textContent = priorText;

    console.table(results);
    return results;
  }

  return { show, info, success, warning, error, selfTest };
})();

window.MusicNotify = MusicNotify;
