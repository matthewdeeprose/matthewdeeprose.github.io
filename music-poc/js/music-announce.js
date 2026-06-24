// music-announce.js
// Dependency-free aria-live announcer for the Accessible Music proof of
// concept. It targets the existing visible status region declared in
// index.html (<p id="status" aria-live="polite">), so announcements are both
// seen and spoken. Exposed as window.MusicAnnounce.

const MusicAnnounce = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // Cache for resolved DOM elements.
  const els = {};

  // Resolve (and cache) the live region. Lazy by design — callers never need
  // to call an init() first.
  function ensureRegion() {
    // Reuse the cached region only if it is still attached to the document.
    if (els.region && document.contains(els.region)) {
      return els.region;
    }

    // Prefer the status region the page already declares.
    const existing = document.getElementById("status");
    if (existing) {
      els.region = existing;
      return els.region;
    }

    // Defensive fallback: the page should always provide #status, but if it is
    // missing we create a VISIBLE replacement (no CSS, no hidden region) so
    // announcements still reach screen readers and sighted users alike.
    const region = document.createElement("p");
    region.id = "status";
    region.setAttribute("aria-live", "polite");
    const host = document.querySelector("main") || document.body;
    host.appendChild(region);
    logWarn("No #status element found; created a fallback live region");
    els.region = region;
    return els.region;
  }

  // Announce a message by writing it into the live region's text content.
  function announce(message) {
    const region = ensureRegion();
    region.textContent = String(message ?? "");
    logDebug("Announced: " + region.textContent);
    return region.textContent;
  }

  // Self-test: verifies the announcer's surface and that a message reaches the
  // region. Captures and restores the region's prior text so the page is left
  // exactly as it was found.
  function selfTest() {
    const region = ensureRegion();
    const priorText = region ? region.textContent : "";

    const results = {
      hasAnnounce: typeof announce === "function",
      regionResolved: !!ensureRegion(),
      regionIsLive: ensureRegion().getAttribute("aria-live") === "polite",
      announceUpdatesRegion:
        announce("MusicAnnounce self-test") === "MusicAnnounce self-test" &&
        region.textContent === "MusicAnnounce self-test",
    };

    // Restore the original status text so no leftover announcement remains.
    region.textContent = priorText;

    console.table(results);
    return results;
  }

  return { announce, selfTest };
})();

window.MusicAnnounce = MusicAnnounce;
