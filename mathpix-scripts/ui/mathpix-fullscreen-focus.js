/**
 * @file mathpix-fullscreen-focus.js
 * @description Keeps keyboard focus inside a MathPix fullscreen editor layer.
 * Shared by the three fullscreen editors (Convert source pane, PDF MMD editor,
 * Resume MMD editor). This version makes the page behind the layer inert, the
 * same way UniversalModal makes the page behind a modal inert.
 *
 * hold(layer, { onLost }) — on entering fullscreen
 * release(layer)          — on every way out of fullscreen
 *
 * Only elements this module set inert are released, so an inert set by a
 * modal, or by anything else, is never touched.
 */
const MathPixFullscreenFocus = (function () {
  "use strict";

  // Logging configuration
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[FullscreenFocus]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[FullscreenFocus]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[FullscreenFocus]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[FullscreenFocus]", message, ...args);
  }

  // Regions that must keep speaking while fullscreen is on: the shared
  // announcers, each editor's own status region, and the toast and toggletip
  // containers. Making any of them inert would silence the "Fullscreen edit
  // mode enabled" line or a toast.
  const KEEP_LIVE_IDS = Object.freeze([
    "a11y-sr-announce",
    "a11y-sr-alert",
    "radioSRannounce",
    "convert-mode-status",
    "mmd-editor-status",
    "universal-toast-container",
    "gb-toast-container",
    "ally-sr-announcements",
    "universal-toggletip-live-region",
  ]);

  // Never made inert: dialogs open above everything, and the rest render nothing.
  const SKIP_TAGS = Object.freeze(
    new Set(["DIALOG", "SCRIPT", "STYLE", "TEMPLATE", "LINK", "META", "NOSCRIPT"]),
  );

  // layer -> { added: Set<Element>, observer: ResizeObserver|null }
  const held = new Map();

  /**
   * Set inert on every element that is neither a kept element nor an ancestor
   * of one. An ancestor of a kept element is walked into instead, so the
   * layer and the live regions stay reachable and everything around them
   * does not. Elements already inert are left alone and not recorded.
   */
  function sweep(node, keep, added) {
    for (const child of node.children) {
      if (SKIP_TAGS.has(child.tagName)) continue;
      if (keep.includes(child)) continue;
      if (keep.some((k) => child.contains(k))) {
        sweep(child, keep, added);
        continue;
      }
      if (child.hasAttribute("inert")) continue;
      child.setAttribute("inert", "");
      added.add(child);
    }
  }

  function hold(layer, options = {}) {
    if (!layer) return;
    if (held.has(layer)) release(layer);

    const keep = [layer];
    KEEP_LIVE_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) keep.push(el);
    });

    const added = new Set();
    sweep(document.body, keep, added);

    // If the layer stops being rendered (another tool, view or tab chosen
    // underneath it), leave fullscreen so nothing stays inert.
    let observer = null;
    if (typeof options.onLost === "function" && typeof ResizeObserver === "function") {
      observer = new ResizeObserver(() => {
        if (!held.has(layer)) return;
        if (layer.getClientRects().length) return;
        logDebug("Fullscreen layer no longer rendered; leaving fullscreen");
        options.onLost();
        release(layer);
      });
      observer.observe(layer);
    }

    held.set(layer, { added, observer });
    logDebug(`Fullscreen made ${added.size} element(s) inert`);
  }

  function release(layer) {
    const record = held.get(layer);
    if (!record) return;
    held.delete(layer);
    if (record.observer) record.observer.disconnect();
    record.added.forEach((el) => el.removeAttribute("inert"));
    logDebug(`Fullscreen released ${record.added.size} inert element(s)`);
  }

  logInfo("MathPixFullscreenFocus ready (inert outside the layer)");
  return { hold, release, KEEP_LIVE_IDS };
})();

window.MathPixFullscreenFocus = MathPixFullscreenFocus;
