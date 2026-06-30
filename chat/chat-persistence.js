/**
 * Unified Chat Tool — Persistence Module
 * Chat persistence: reload-only session save/restore + restore banner.
 *
 * A lean, Chat-scoped port of local-chat/local-chat-persistence.js. It drives
 * window.ChatState ONLY — it never calls any window.LocalChat* / window.localChat*
 * global and never touches window.LocalChatState. Rendering is delegated to the
 * shared window.ChatMessages.renderAssistantTurn helper, so the restore path and
 * the live send path build identical assistant bubbles from one code path.
 *
 * Decision 1: clear-and-discard (no conversation archive). Decision 3: reuse the
 * local-chat-restore-banner-* classes (styled in local-chat.css, loaded on the
 * page) for styling parity, with Chat-scoped ids via S.elId().
 *
 * Loads AFTER chat/chat.js (window.ChatState) and chat/chat-messages.js
 * (window.ChatMessages). Wiring into chat-core's init/postGeneration is step
 * 5b-ii; this file just loads and exposes window.ChatPersistence.
 *
 * @version 0.1.0 — step 5b-i (reload-only session save/restore + restore banner)
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
      args.unshift("[ChatPersistence]");
      console.error.apply(console, args);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatPersistence]");
      console.warn.apply(console, args);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatPersistence]");
      console.log.apply(console, args);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatPersistence]");
      console.log.apply(console, args);
    }
  }

  // ── State handle ─────────────────────────────────────────────────────────
  // Re-bindable module-local reference to this tool's conversation state.
  // Defaults to window.ChatState; attach(state) can re-point it. Internal code
  // reads the state — its messages[] array, els{} DOM map, and storage keys —
  // live through S at call time, never caching them at load.
  let S = window.ChatState;
  if (!S) {
    logError(
      "window.ChatState is missing — chat/chat.js must load before chat/chat-persistence.js",
    );
    return;
  }

  // Re-point the module at a freshly-attached state object (parity with
  // chat-core/chat-messages's attach discipline).
  function attach(state) {
    if (state) S = state;
  }

  // ── Session persistence ───────────────────────────────────────────────────

  /**
   * Persist the live thread to sessionStorage. Chat stores only what Chat has —
   * the messages array (each turn already carries role/content and, for
   * assistant turns, model/providerId) and the current model id. No
   * systemPrompt/temperature/maxTokens: Chat caches no such elements, so writing
   * them would only add inert fields.
   */
  function saveSession() {
    const messages = S.messages;
    try {
      const data = {
        messages: messages,
        currentModel: S.currentModel,
      };
      const json = JSON.stringify(data);
      if (json.length > S.SESSION_MAX_BYTES) {
        S.logWarn(
          "Session too large to save:",
          json.length,
          "bytes (cap:",
          S.SESSION_MAX_BYTES,
          ")",
        );
        return;
      }
      sessionStorage.setItem(S.SESSION_KEY, json);
    } catch (e) {
      S.logWarn("Failed to save session:", e.message);
    }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(S.SESSION_KEY);
    } catch (e) {
      // Ignore
    }
  }

  // ── Session restore ─────────────────────────────────────────────────────

  /**
   * Restore the saved thread from sessionStorage and rebuild its bubbles. Unlike
   * Local Chat, this NEVER validates the saved model against the local registry —
   * a Chat session's model is a full cloud or local id, and gating on
   * window.LocalTextModelRegistry would silently delete every cloud session.
   * The thread is restored regardless of provider, keeping each turn's stored
   * model + providerId. Async because rebuildMessageList awaits the shared
   * renderAssistantTurn helper per turn.
   * @returns {Promise<boolean>} true on a successful restore, else false
   */
  async function restoreSession() {
    const els = S.els;
    try {
      const json = sessionStorage.getItem(S.SESSION_KEY);
      if (!json) return false;

      const data = JSON.parse(json);
      if (!data || !Array.isArray(data.messages) || data.messages.length === 0)
        return false;

      // Restore the model verbatim (full id, any provider) — no registry gate.
      // Reflect it into the picker programmatically; do NOT dispatch 'change',
      // so the opening-model / re-resolve logic does not fire on a restore.
      S.currentModel = data.currentModel;
      if (els.select && S.currentModel) els.select.value = S.currentModel;

      // Restore messages and rebuild the DOM through the shared render helper.
      S.messages = data.messages;
      await rebuildMessageList();

      return true;
    } catch (e) {
      S.logWarn("Failed to restore session:", e.message);
      clearSession();
      return false;
    }
  }

  // ── Rebuild message list from messages array ────────────────────────────

  /**
   * Rebuild the message list from S.messages, rendering each turn through the
   * shared window.ChatMessages helpers (NOT a bare markdown-it instance — the
   * helper owns rich rendering, badge and controls). Indexed loop so each
   * assistant turn can be awaited; the assistant bubble is attached to the live
   * list before renderAssistantTurn runs, so the mermaid accessibility observers
   * see it in the visible DOM.
   */
  async function rebuildMessageList() {
    const els = S.els;
    if (!els.messageList) return;
    els.messageList.innerHTML = "";

    const msgs = S.messages;
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      if (msg.role === "user") {
        // createUserBubble appends itself to els.messageList and returns it.
        window.ChatMessages.createUserBubble(msg.content, i);
      } else if (msg.role === "assistant") {
        // createAssistantBubble also appends itself; the explicit appendChild
        // guarantees the node is in the live DOM (a harmless re-attach that keeps
        // it last) before renderAssistantTurn applies the rich body + a11y.
        const bubble = window.ChatMessages.createAssistantBubble();
        els.messageList.appendChild(bubble);
        await window.ChatMessages.renderAssistantTurn(
          bubble,
          msg.content,
          msg.model,
          msg.providerId,
          i,
        );
      }
    }

    window.ChatMessages.scrollMessagesToBottom();
  }

  // ── Clear helper (clear-and-discard, no archive) ────────────────────────

  /**
   * Clear the live thread and discard its saved session. Chat does not archive
   * (Decision 1), so there is no archiveConversation / welcome-card / _updateAllUI
   * call here. Mirrors the fresh-load UI state: empty list, focus the input.
   */
  function performClear() {
    const els = S.els;
    clearSession();
    S.messages = [];
    if (els.messageList) els.messageList.innerHTML = "";
    if (els.input) els.input.focus();
    S.announceToScreenReader("Conversation cleared.");
  }

  // ── Restore banner ──────────────────────────────────────────────────────

  /**
   * Show the "previous conversation restored" banner at the top of the message
   * list, offering Continue or Start fresh. Reuses the local-chat-restore-banner-*
   * classes (Decision 3) for styling parity; ids are Chat-scoped via S.elId().
   */
  function showRestoreBanner() {
    const messages = S.messages;
    const els = S.els;
    if (!els.messageList) return;

    const banner = document.createElement("div");
    banner.className = "local-chat-restore-banner";
    banner.setAttribute("role", "status");
    banner.id = S.elId("restore-banner");

    const msgCount = messages.length;
    const text = document.createElement("span");
    text.className = "local-chat-restore-banner-text";
    text.textContent =
      "Previous conversation restored (" +
      msgCount +
      (msgCount === 1 ? " message" : " messages") +
      ")";
    banner.appendChild(text);

    const actions = document.createElement("div");
    actions.className = "local-chat-restore-banner-actions";

    const continueBtn = document.createElement("button");
    continueBtn.className = "local-chat-restore-banner-btn";
    continueBtn.innerHTML =
      '<span aria-hidden="true" data-icon="check"></span> Continue';
    continueBtn.addEventListener("click", function () {
      dismissRestoreBanner();
      if (els.input) els.input.focus();
    });

    const freshBtn = document.createElement("button");
    freshBtn.className = "local-chat-restore-banner-btn";
    freshBtn.innerHTML =
      '<span aria-hidden="true" data-icon="refresh"></span> Start fresh';
    freshBtn.addEventListener("click", function () {
      dismissRestoreBanner();
      performClear();
      S.announceToScreenReader("New conversation started.");
    });

    actions.appendChild(continueBtn);
    actions.appendChild(freshBtn);
    banner.appendChild(actions);

    // Insert at the top of the message list (before any restored messages).
    els.messageList.insertBefore(banner, els.messageList.firstChild);

    // Populate the data-icon glyphs (injected via innerHTML; the auto-populator
    // only runs once at DOMContentLoaded).
    if (typeof window.refreshIcons === "function") {
      window.refreshIcons(banner);
    }

    S.announceToScreenReader(
      "Previous conversation restored. " +
        msgCount +
        " messages. " +
        "Choose to continue or start fresh.",
    );
  }

  function dismissRestoreBanner() {
    const banner = document.getElementById(S.elId("restore-banner"));
    if (banner) banner.remove();
  }

  // ── Expose module ────────────────────────────────────────────────────────

  window.ChatPersistence = {
    saveSession: saveSession,
    restoreSession: restoreSession,
    clearSession: clearSession,
    performClear: performClear,
    showRestoreBanner: showRestoreBanner,
    dismissRestoreBanner: dismissRestoreBanner,
    attach: attach,
  };

  logInfo("Persistence module loaded");
})();
