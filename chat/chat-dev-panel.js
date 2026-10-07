/**
 * Unified Chat Tool — Developer information panel populator (Chat dev panel)
 *
 * Fills the collapsed "Developer information" disclosure (#chat-dev-panel) after
 * each completed turn: the finish reason, the shaped wire request, and the raw
 * response. The request is read from the embed core's scrubbed snapshot
 * (S.embed.getLastWireRequest) so no credential ever reaches the display; for
 * on-device models — where the core captures no wire body — a clearly-labelled
 * pre-shaping PREVIEW is composed from the live engine props and the thread.
 *
 * The panel updates SILENTLY: none of its regions is a live region, so a new
 * turn never speaks the raw JSON. The only spoken cue is the per-block copy
 * button's confirmation, inherited verbatim from the assistant-bubble copy
 * affordance in chat/chat-messages.js.
 *
 * Wired into chat/chat-core.js (postGeneration, postError, updateConversationUI)
 * separately; this file just loads and exposes window.ChatDevPanel. Loads AFTER
 * chat/chat.js (which creates window.ChatState).
 *
 * @version 0.1.0 — Chat developer panel (Stage B)
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
      args.unshift("[ChatDevPanel]");
      console.error.apply(console, args);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatDevPanel]");
      console.warn.apply(console, args);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatDevPanel]");
      console.log.apply(console, args);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatDevPanel]");
      console.log.apply(console, args);
    }
  }

  // ── State handle ─────────────────────────────────────────────────────────
  // Re-bindable module-local reference to this tool's conversation state.
  // Defaults to window.ChatState; attach(state) can re-point it. Internal code
  // reads the state — its currentModel, messages and embed handle — live
  // through S at call time, never caching them at load (parity with
  // chat-model-info.js).
  let S = window.ChatState;
  if (!S) {
    logError(
      "window.ChatState is missing — chat/chat.js must load before chat/chat-dev-panel.js",
    );
    return;
  }

  // Re-point the module at a freshly-attached state object.
  function attach(state) {
    if (state) S = state;
  }

  // ── Element ids (namespaced chat-dev-*; created HTML-first in tools.html) ──
  const FINISH_ID = "chat-dev-finish-reason";
  const REQUEST_ID = "chat-dev-request";
  const RESPONSE_ID = "chat-dev-response";
  const REQUEST_NOTE_ID = "chat-dev-request-note";
  const COPY_REQUEST_ID = "chat-dev-copy-request";
  const COPY_RESPONSE_ID = "chat-dev-copy-response";

  // The confirmation both copy buttons announce (the assistant-bubble copy cue).
  const COPIED_MESSAGE = "Response copied to clipboard.";

  // The local-model request note — the request is a pre-shaping preview, not the
  // real wire body, because the core captures no wire request for on-device runs.
  const LOCAL_REQUEST_NOTE =
    "Request preview — provider shaping is not captured for local models.";

  // ── Shared renderer ─────────────────────────────────────────────────────────
  // Rendering, clearing and copy live in js/dev-panel.js (shared with the Graph
  // Builder image tab). Chat keeps only what is Chat's: its ids, its state handle
  // and the on-device request preview.
  // Chat reads the finish reason from raw.choices only, as it always has, so the
  // factory is told not to read response.finishReason. The announce function reads
  // S at call time, so attach() re-points it too.
  const panel = window.DevPanel
    ? window.DevPanel.create({
        ids: {
          finish: FINISH_ID,
          request: REQUEST_ID,
          response: RESPONSE_ID,
          note: REQUEST_NOTE_ID,
          copyRequest: COPY_REQUEST_ID,
          copyResponse: COPY_RESPONSE_ID,
        },
        copiedMessages: { request: COPIED_MESSAGE, response: COPIED_MESSAGE },
        announce: function (message) {
          S.announceToScreenReader(message);
        },
        wiredKey: "chatDevWired",
        finishReasonFromResponse: false,
      })
    : null;
  if (!panel) {
    logError(
      "window.DevPanel is missing — js/dev-panel.js must load before chat/chat-dev-panel.js",
    );
    return;
  }

  /**
   * Compose a PRE-SHAPING request preview for an on-device model, since the core
   * captures no wire body for local runs. Reads the live engine props off
   * S.embed and the current thread off S.messages. The caller labels this as a
   * preview (see LOCAL_REQUEST_NOTE); it is not the real provider payload.
   *
   * @returns {Object}
   */
  function buildLocalRequestPreview() {
    const e = S.embed || {};
    const preview = {
      model: e.model || S.currentModel || null,
      messages: (S.messages || []).map(function (m) {
        return { role: m.role, content: m.content };
      }),
      temperature: e.temperature,
      top_p: e.top_p,
      frequency_penalty: e.frequency_penalty,
      presence_penalty: e.presence_penalty,
      max_tokens: e.max_tokens,
    };
    if (e.systemPrompt) preview.systemPrompt = e.systemPrompt;
    return preview;
  }

  // ── Public update ──────────────────────────────────────────────────────────

  /**
   * Repopulate the three developer regions from a completed (or errored) turn.
   * Silent: no region is a live region, so this never speaks.
   *
   * @param {Object|null} response - The engine response ({ text, raw, ... }) or
   *                                 an error-shaped { raw } for the error path.
   */
  function update(response) {
    const isLocal =
      typeof S.currentModel === "string" &&
      S.currentModel.indexOf("local/") === 0;
    if (isLocal) {
      panel.update(response, buildLocalRequestPreview(), LOCAL_REQUEST_NOTE);
      return;
    }
    const wire =
      S.embed && typeof S.embed.getLastWireRequest === "function"
        ? S.embed.getLastWireRequest()
        : null;
    panel.update(response, wire, "");
  }

  /**
   * Blank the three regions and reset the finish reason to its resting
   * placeholder. Called through the single conversation-state seam when the
   * thread is emptied, so a cleared chat blanks the panel too.
   */
  function clear() {
    panel.clear();
  }

  // ── Expose module ────────────────────────────────────────────────────────
  window.ChatDevPanel = {
    update: update,
    clear: clear,
    attach: attach,
  };

  logInfo("Developer information module loaded");
})();
