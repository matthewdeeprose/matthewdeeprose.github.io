/**
 * @file audio-export-progress.js
 * @description Shared DOM writer for the page-level audio-export progress
 * surface, #audio-export-progress in tools.html.
 *
 * Extracted 20 August 2026 from three private copies that were declared inside
 * their own IIFEs and exposed on nothing — chat/chat-messages.js,
 * local-chat/local-chat-messages.js and tts/tts-read-aloud.js. The three copies
 * were token-for-token identical, inline comments included; they differed only
 * in declaration keyword (const vs var) and quote style, which is per-file
 * formatting rather than per-tool behaviour.
 *
 * WHAT THIS MODULE OWNS
 * ---------------------
 * The DOM writes to the shared surface, and nothing else. Reveal it, write one
 * progress step into it, hide and reset it.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT OWN — READ THIS BEFORE EXTENDING IT
 * -------------------------------------------------------------------------
 * OWNERSHIP. The tts:exportProgress event is emitted once by
 * tts/tts-controller.js and is heard by all three tools at once, so each tool
 * must decide for itself whether an in-flight export is ITS export before
 * writing. One tool's event must never write while another tool is the owner:
 * that defect shipped, and it wrote Image Describer's DOM while Image Describer
 * was display:none, leaving a stale accessible name on a button that nothing
 * restored.
 *
 * Each tool keeps its own guard, and the three predicates are deliberately
 * DIFFERENT because the three tools track ownership differently:
 *
 *   tts/tts-read-aloud.js          updateExportProgress()
 *     if (!exporting || !totalChunks) return;
 *     `exporting` is a module-scope BOOLEAN. One Save button in the tool, so
 *     ownership is a simple in-flight flag. Payload shape is checked one level
 *     out, in the EmbedEventEmitter listener wrapper, not in the guard.
 *
 *   chat/chat-messages.js          onExportProgress(data)
 *     if (!activeExportingBtn) return;  + a three-clause payload typecheck
 *     `activeExportingBtn` is a module-scope ELEMENT — the specific bubble's
 *     Save button — because a conversation has many bubbles and only one may
 *     export at a time.
 *
 *   local-chat/local-chat-messages.js  onExportProgress(data)
 *     Same shape as Chat, over its own separate `activeExportingBtn` in its own
 *     separate IIFE.
 *
 * Three predicates over three private variables is CORRECT, not duplication.
 * Unifying them here would require this module to see state it has no business
 * seeing, and would collapse the one distinction that keeps the tools apart.
 *
 * The surface itself is NOT a live region and has no live ancestor, on purpose
 * — see the comment on the markup in tools.html for why. Nothing in this module
 * announces.
 *
 * @module AudioExportProgress
 * @since 20 August 2026
 */
const AudioExportProgress = (function () {
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
      console.error("[AudioExportProgress]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AudioExportProgress]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AudioExportProgress]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AudioExportProgress]", message, ...args);
  }

  // =========================================================================
  // The shared surface
  // =========================================================================

  /**
   * The four element ids, private to this module. No consumer reaches them
   * directly and none needs to.
   *
   * REACH THESE BY ID ONLY — NEVER BY CLASS. The surface carries
   * .imgdesc-mm-progress, .imgdesc-mm-progress-bar,
   * .imgdesc-mm-progress-bar-fill and .imgdesc-mm-progress-text, reused
   * deliberately from image-describer.css so this feature added no CSS. Those
   * same classes are used by three model-manager UIs —
   * tts/tts-model-ui.js, image-describer/image-describer-model-manager-ui.js
   * and openrouter-embed/local-text-model-manager-ui.js. Every one of their
   * lookups is SCOPED to a model card (card.querySelector / item.querySelector),
   * so nothing collides today. A document-scoped class selector in this module
   * would reach all of them at once and drive progress bars belonging to model
   * downloads. getElementById cannot make that mistake.
   */
  const EXPORT_PROGRESS_IDS = Object.freeze({
    wrapper: "audio-export-progress",
    bar: "audio-export-progress-bar",
    fill: "audio-export-progress-fill",
    text: "audio-export-progress-text",
  });

  /**
   * Write one progress step. chunk/totalChunks of 0 clears the surface.
   * @param {number} chunk — 1-based chunk index just started
   * @param {number} totalChunks — total chunks in this export
   */
  function setExportProgress(chunk, totalChunks) {
    const bar = document.getElementById(EXPORT_PROGRESS_IDS.bar);
    const fill = document.getElementById(EXPORT_PROGRESS_IDS.fill);
    const text = document.getElementById(EXPORT_PROGRESS_IDS.text);
    const percent =
      totalChunks > 0 ? Math.round((chunk / totalChunks) * 100) : 0;

    if (bar) bar.setAttribute("aria-valuenow", String(percent));
    if (fill) fill.style.width = percent + "%";
    if (text) {
      // The surface no longer sits on the control, so it names what it is
      // doing rather than relying on the button for context.
      text.textContent =
        totalChunks > 0 ? "Saving audio, " + chunk + " of " + totalChunks : "";
    }

    logDebug("Progress step", { chunk, totalChunks, percent });
  }

  /**
   * Reveal the shared surface at export start.
   */
  function showExportProgress() {
    const wrapper = document.getElementById(EXPORT_PROGRESS_IDS.wrapper);
    if (!wrapper) {
      logWarn("Surface not found, cannot show", EXPORT_PROGRESS_IDS.wrapper);
      return;
    }
    setExportProgress(0, 0);
    wrapper.hidden = false;
  }

  /**
   * Hide the shared surface and reset it. Consumers call this from the finally
   * of their export chain, so it runs on the success and the failure path.
   */
  function hideExportProgress() {
    const wrapper = document.getElementById(EXPORT_PROGRESS_IDS.wrapper);
    if (!wrapper) {
      logWarn("Surface not found, cannot hide", EXPORT_PROGRESS_IDS.wrapper);
      return;
    }
    wrapper.hidden = true;
    setExportProgress(0, 0);
  }

  logInfo("Audio export progress module loaded");

  // =========================================================================
  // PUBLIC API — exactly three names
  // =========================================================================

  return {
    setExportProgress: setExportProgress,
    showExportProgress: showExportProgress,
    hideExportProgress: hideExportProgress,
  };
})();

// The const above is a top-level BINDING, not a window property, so the alias
// below is what makes window.AudioExportProgress resolve at all. Without it the
// bare identifier would still work while every window.AudioExportProgress
// reference read undefined — which is exactly the trap AGENTS.md § Announcements
// (SC 4.1.3), under "The four SHARED ANNOUNCEMENT CHANNELS", records for
// ALLY_UI_MANAGER, UniversalModal and UniversalNotifications: all three are
// top-level const declarations, so a console probe or a driven harness that
// reaches them through window silently instruments nothing.
window.AudioExportProgress = AudioExportProgress;
