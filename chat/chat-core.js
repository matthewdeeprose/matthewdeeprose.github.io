/**
 * Unified Chat Tool — Stage 3 step 5a-ii (rich-render wiring in postGeneration)
 *
 * Duplicates Local Chat's send path, scoped entirely to the Chat tool. This file
 * drives window.ChatState ONLY — it never calls any window.LocalChat* /
 * window.localChat* global and never touches window.LocalChatState.
 *
 * It reuses the single engine handle that chat/chat.js already built in
 * buildEngineHandle (stored on S.embed). Before each send it sets that embed's
 * instance properties for the turn — crucially embed.model = S.currentModel, the
 * FULL chosen id (local/…, an OpenRouter id like anthropic/…, or azure-openai/…),
 * which is what lets the embed route cross-provider. It does NOT construct a
 * second embed and does NOT re-prefix the model the way Local Chat does.
 *
 * Bubble creation is intentionally minimal and inline for this step; it reuses
 * Local Chat's CLASS names (local-chat-bubble, -user, -assistant, local-chat-typing)
 * so the richer messages module in step 3 can supersede it without a CSS change.
 *
 * Loads AFTER chat/chat.js so window.ChatState and the engine handle exist.
 *
 * @version 0.2.0 — step 5b-0b: postGeneration delegates the assistant-bubble
 *                   build to the shared window.ChatMessages.renderAssistantTurn
 *                   helper, so the live path and the restore path share one code
 *                   path
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
      args.unshift("[ChatCore]");
      console.error.apply(console, args);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatCore]");
      console.warn.apply(console, args);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatCore]");
      console.log.apply(console, args);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatCore]");
      console.log.apply(console, args);
    }
  }

  // ── State handle ─────────────────────────────────────────────────────────
  // Capture the state OBJECT once at load; chat/chat.js creates it synchronously
  // before this file's IIFE runs. Everything inside (S.els, S.messages,
  // S.currentModel, S.embed) is read LIVE through S at call time, never cached
  // here, mirroring chat.js's own discipline.
  const S = window.ChatState;
  if (!S) {
    logError(
      "window.ChatState is missing — chat/chat.js must load before chat/chat-core.js",
    );
    return;
  }

  // Wire-once guard so init() stays idempotent (the static buttons persist; we
  // must not stack a second click/keydown listener on re-entry).
  let wired = false;

  // ── Element caching ───────────────────────────────────────────────────────
  // Extend S.els with the step-1 message-area elements. chat.js::cacheElements
  // caches only the picker elements, so these keys are additive. We use S.elId()
  // because the ChatState factory's elId prefixes with "chat-", which matches the
  // step-1 HTML ids (chat-messages / chat-input / chat-send / chat-cancel /
  // chat-stats). messageList lands on els.messageList so S.setMessageListLive()
  // (which reads this.els.messageList) works.
  function cacheElements() {
    const els = S.els;
    els.messageList = document.getElementById(S.elId("messages"));
    els.input = document.getElementById(S.elId("input"));
    els.sendBtn = document.getElementById(S.elId("send"));
    els.cancelBtn = document.getElementById(S.elId("cancel"));
    els.stats = document.getElementById(S.elId("stats"));
    // Optional system-prompt input — not present in step 1, so this resolves to
    // null and the per-send systemPrompt becomes undefined.
    els.systemInput = document.getElementById(S.elId("system"));
  }

  // ── Bubble rendering (delegated to the step-3 messages module) ─────────────
  // chat/chat-messages.js loads AFTER this file and registers window.ChatMessages.
  // These thin wrappers keep the send-flow call sites unchanged while routing all
  // rendering through that module. They are only ever called at runtime (send
  // time), by which point window.ChatMessages is defined.

  function createUserBubble(text, index) {
    return window.ChatMessages.createUserBubble(text, index);
  }

  function createAssistantBubble() {
    return window.ChatMessages.createAssistantBubble();
  }

  function addTypingIndicator(bubble) {
    window.ChatMessages.addTypingIndicator(bubble);
  }

  function removeTypingIndicator(bubble) {
    window.ChatMessages.removeTypingIndicator(bubble);
  }

  function scrollMessagesToBottom() {
    window.ChatMessages.scrollMessagesToBottom();
  }

  // ── Send/cancel UI state ───────────────────────────────────────────────────

  function disableSend() {
    const els = S.els;
    if (els.sendBtn) els.sendBtn.disabled = true;
    if (els.cancelBtn) els.cancelBtn.hidden = false;
    if (els.input) els.input.disabled = true;
  }

  function enableSend() {
    const els = S.els;
    if (els.sendBtn) els.sendBtn.disabled = false;
    if (els.cancelBtn) els.cancelBtn.hidden = true;
    if (els.input) {
      els.input.disabled = false;
      els.input.focus();
    }
  }

  // ── Provider id from the full model id ─────────────────────────────────────
  // Single home for the prefix → providerId mapping. Stored on each assistant
  // turn now; the visible per-turn badge that consumes it is step 3.
  function providerIdFromModel(id) {
    if (typeof id !== "string") return "openrouter";
    if (id.indexOf("local/") === 0) return "local";
    if (id.indexOf("azure-openai/") === 0) return "azure-openai";
    return "openrouter";
  }

  // ── Embed handle ───────────────────────────────────────────────────────────

  /**
   * Reuse the engine handle chat/chat.js already built (S.embed). We do NOT
   * construct a second embed here. Per-turn instance properties are set by the
   * caller (sendMessage) immediately before the send. Returns null when the
   * handle is unavailable (e.g. chat.js init has not run, or OpenRouterEmbed is
   * absent); the caller surfaces that as an error in the assistant bubble.
   * @returns {Object|null} the shared OpenRouterEmbed instance, or null
   */
  function getOrCreateEmbed() {
    const embed = S.embed || null;
    if (!embed) {
      logWarn("no engine handle on S.embed — chat/chat.js init/refresh must run first");
    }
    return embed;
  }

  // ── Post-generation / post-error (DRY) ─────────────────────────────────────

  async function postGeneration(assistantBubble, response) {
    removeTypingIndicator(assistantBubble);
    // Derive the provider id ONCE — reused for the stored turn and the badge.
    const providerId = providerIdFromModel(S.currentModel);
    S.messages.push({
      role: "assistant",
      content: response.text,
      model: S.currentModel,
      providerId: providerId,
    });
    const assistantIndex = S.messages.length - 1;

    // Build the assistant bubble through the shared helper so the live path and
    // the restore path (step 5b-i) produce identical bubbles from one code path:
    // rich accessible body first (replacing the streamed plain render), then the
    // badge (inserted before the bubble's first child) and the parity controls
    // (copy, formatted copy, timestamp), then the data-icon glyph population.
    await window.ChatMessages.renderAssistantTurn(
      assistantBubble,
      response.text,
      S.currentModel,
      providerId,
      assistantIndex,
    );

    S.isGenerating = false;
    enableSend();
    // Reply, badge and controls are now in the bubble: switch the log live so the
    // whole response reads cleanly, then announce readiness ONCE.
    S.setMessageListLive("polite");
    S.announceToScreenReader("Response ready.");
    scrollMessagesToBottom();
  }

  function postError(assistantBubble, error) {
    removeTypingIndicator(assistantBubble);
    // Plain-text error for this step; the full error-bubble UI lands later.
    assistantBubble.textContent = "Error: " + (error && error.message ? error.message : error);
    S.isGenerating = false;
    enableSend();
    S.setMessageListLive("polite");
  }

  // ── Send flow ──────────────────────────────────────────────────────────────

  function sendMessage() {
    const els = S.els;
    if (!els.input) return;

    const text = els.input.value.trim();
    if (!text) return;
    if (S.isGenerating) return;

    S.isGenerating = true;
    disableSend();
    S.setMessageListLive("off");

    // Clear the input.
    els.input.value = "";

    // Push the user turn and render it.
    S.messages.push({ role: "user", content: text });
    createUserBubble(text, S.messages.length - 1);
    scrollMessagesToBottom();

    // Empty assistant bubble + typing indicator.
    const assistantBubble = createAssistantBubble();
    addTypingIndicator(assistantBubble);
    // Immediate cue that work has started — heard right away. The clean full
    // read comes on completion ("Response ready."); we do NOT announce per chunk.
    S.announceToScreenReader("Generating response.");

    // Reuse the shared handle.
    const embed = getOrCreateEmbed();
    if (!embed) {
      postError(assistantBubble, {
        message: "Chat engine is not ready yet. Open the Chat tool and pick a model first.",
      });
      return;
    }

    // Set per-turn instance properties. embed.model = the FULL chosen id is what
    // routes the request to the right provider; no "local/" re-prefixing.
    embed.model = S.currentModel;
    const systemPrompt = els.systemInput ? els.systemInput.value.trim() : "";
    embed.systemPrompt = systemPrompt || undefined;
    embed.container = assistantBubble; // the embed renders its output here

    // Multi-turn payload — role/content only.
    const messagesForApi = S.messages.map(function (m) {
      return { role: m.role, content: m.content };
    });

    embed
      .sendStreamingRequest({
        userPrompt: text, // required by the embed core's validation
        messages: messagesForApi,
        onChunk: function () {
          // The embed writes the text into embed.container itself; we only clear
          // the typing indicator and keep the view pinned to the bottom.
          removeTypingIndicator(assistantBubble);
          scrollMessagesToBottom();
        },
        onComplete: async function (response) {
          // postGeneration owns the "Response ready." announcement (after the
          // badge is in place), so we do not announce again here.
          await postGeneration(assistantBubble, response);
          logInfo("response complete —", (response.text || "").length, "chars");
        },
        onError: function (error) {
          postError(assistantBubble, error);
          S.announceToScreenReader("Error generating response.");
          logError("send error:", (error && error.message) || error);
        },
      })
      .catch(function (error) {
        postError(assistantBubble, error);
        S.announceToScreenReader("Error generating response.");
        logError("send error (catch):", (error && error.message) || error);
      });
  }

  /**
   * Minimal cancel for this step: drop the generating flag and restore the send
   * controls. Full cancellation parity (aborting the in-flight request) is a
   * later step.
   */
  function cancel() {
    S.isGenerating = false;
    enableSend();
    logDebug("cancel — generating flag cleared, send re-enabled");
  }

  // ── Global handlers + wiring ───────────────────────────────────────────────

  window.chatSend = sendMessage;
  window.chatCancel = cancel;

  function wire() {
    if (wired) return;
    const els = S.els;
    if (els.sendBtn) {
      els.sendBtn.addEventListener("click", function () {
        window.chatSend();
      });
    }
    if (els.cancelBtn) {
      els.cancelBtn.addEventListener("click", function () {
        window.chatCancel();
      });
    }
    if (els.input) {
      // Enter sends; Shift+Enter inserts a newline.
      els.input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          window.chatSend();
        }
      });
    }
    wired = true;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Initialise the Chat core send loop. Idempotent — re-caches the message-area
   * elements and wires the static buttons exactly once. Safe to call before or
   * after chat.js's picker init, because the handle is fetched lazily at send
   * time, not here.
   */
  function init() {
    cacheElements();
    wire();
    logInfo("init complete (core send loop wired)");
  }

  // Self-init on DOM-ready. The step-1 message-area elements are static HTML, so
  // wiring does not depend on the tool being switched to; and S.embed is read
  // lazily at send time (by then chat.js's init/refresh has built it). This keeps
  // chat-core.js self-contained — no edit to chat.js's lifecycle is required.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ── Expose singleton ───────────────────────────────────────────────────────
  window.ChatCore = {
    init: init,
    sendMessage: sendMessage,
    _getOrCreateEmbed: getOrCreateEmbed,
    _postGeneration: postGeneration,
  };
})();
