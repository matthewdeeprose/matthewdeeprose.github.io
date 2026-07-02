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
 * @version 0.4.0 — step 5b-iii: standing Clear-conversation button + the
 *                   conversation-state UI seam (updateConversationUI) — the one
 *                   place conversation-dependent controls are enabled/disabled.
 *                   Today the seam owns exactly one control (the clear button);
 *                   parity controls (sliders, regenerate, history) hook in here
 *                   later instead of toggling inline.
 *                   step 5b-ii: wire persistence into the lifecycle — restore the
 *                   saved session (and show the restore banner) on init, and save
 *                   the session at the end of postGeneration so each completed
 *                   assistant turn (with its model + providerId) is persisted
 */
(function () {
  "use strict";

  // ── Logging configuration ───────────────────────────────────────────────
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Tokens held back beyond the answer reservation, to absorb the estimator's
  // approximation and any slack in a copied/borrowed context limit. Tunable.
  const BUDGET_SAFETY_MARGIN = 512;
  // Answer-room reservation used only if the embed exposes no numeric max_tokens;
  // matches the embed's own default so behaviour stays consistent if it fires.
  const DEFAULT_ANSWER_RESERVATION = 2000;

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
    els.clearBtn = document.getElementById(S.elId("clear"));
    els.stats = document.getElementById(S.elId("stats"));
    // Optional system-prompt input — not present in step 1, so this resolves to
    // null and the per-send systemPrompt becomes undefined.
    els.systemInput = document.getElementById(S.elId("system"));
    // Generation-parameters panel (5c-i). Cached into the SAME S.els the shared
    // helpers read, so S.getTemperature()/S.getMaxTokens() see the live sliders.
    els.temperatureSlider = document.getElementById(S.elId("temperature"));
    els.temperatureValue = document.getElementById(S.elId("temperature-value"));
    els.temperatureDesc = document.getElementById(S.elId("temperature-desc"));
    els.maxTokensSlider = document.getElementById(S.elId("max-tokens"));
    els.maxTokensValue = document.getElementById(S.elId("max-tokens-value"));
    els.maxTokensDesc = document.getElementById(S.elId("max-tokens-desc"));
    // System-prompt preset select (5c-ii-b). Changing it fills the system box from
    // the shared S.SYSTEM_PRESETS map; "None (custom)" clears it. Wired in wire().
    els.presetSelect = document.getElementById(S.elId("preset-select"));
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

  // Trim notice — written to the visible stats region (#chat-stats), an <output>
  // with implicit role="status"/aria-live="polite", so it is seen AND announced
  // without colliding with the shared "Generating response." cue. Wording makes
  // clear the model won't see older turns; nothing is deleted.
  function announceTrim(dropped) {
    if (!S.els.stats) return;
    S.els.stats.textContent =
      dropped > 0
        ? "Older messages aren't sent to this model, to fit its context limit."
        : "";
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
    // Persist the thread now the assistant turn is pushed and rendered, so the
    // saved session includes the completed turn with its model + providerId.
    window.ChatPersistence.saveSession();
    // Refresh conversation-state-dependent UI (the clear button) now the thread
    // has a completed turn — routed through the single seam, not toggled inline.
    updateConversationUI();
  }

  function postError(assistantBubble, error) {
    removeTypingIndicator(assistantBubble);
    // Plain-text error for this step; the full error-bubble UI lands later.
    assistantBubble.textContent = "Error: " + (error && error.message ? error.message : error);
    S.isGenerating = false;
    enableSend();
    S.setMessageListLive("polite");
  }

  // ── Token-budget sliding window ────────────────────────────────────────────

  // Impure estimate via the published bridge (step one). Separate so the pure
  // window function stays testable with an injected estimate.
  function estimateWithBridge(messages) {
    if (window.TokenEstimator && typeof window.TokenEstimator.estimateTokens === "function") {
      return window.TokenEstimator.estimateTokens(messages);
    }
    logError("window.TokenEstimator unavailable — trimming to the latest turn only");
    return Number.MAX_SAFE_INTEGER; // fail safe: trim rather than over-send
  }

  /**
   * Pure limit-aware sliding window. Keeps a recent slice of the thread that fits
   * the model's context window once the answer reservation and safety margin are
   * held back. Never returns empty — the most recent message is always kept, even
   * if it alone exceeds the budget (a tiny placeholder window). Trims the PAYLOAD
   * only; the caller's stored S.messages is untouched.
   * @returns {{messages: Array, dropped: number}}
   */
  function applyTokenWindow(o) {
    const estimate = o.estimate || estimateWithBridge;
    const inputBudget = o.limit - o.answerReservation - o.safetyMargin;
    const sysMsgs =
      o.systemPrompt && o.systemPrompt.trim()
        ? [{ role: "system", content: o.systemPrompt }]
        : [];
    const kept = o.messages.slice();
    while (kept.length > 1 && estimate(sysMsgs.concat(kept)) > inputBudget) {
      kept.shift();
    }
    return { messages: kept, dropped: o.messages.length - kept.length };
  }

  // ── Send flow ──────────────────────────────────────────────────────────────

  function sendMessage() {
    const els = S.els;
    if (!els.input) return;

    const text = els.input.value.trim();
    if (!text) return;
    if (S.isGenerating) return;

    S.isGenerating = true;
    S.setMessageListLive("off");

    // Clear the input.
    els.input.value = "";

    // Push the user turn and render it.
    S.messages.push({ role: "user", content: text });
    createUserBubble(text, S.messages.length - 1);
    scrollMessagesToBottom();

    // Hand off to the shared back half (assistant bubble → embed → stream).
    dispatchSend({ userPrompt: text });
  }

  /**
   * Shared send back-half: create the assistant bubble, set the per-turn embed
   * properties, apply the token window and fire the streaming request. Extracted
   * verbatim from sendMessage so a later edit-resend slice can reuse it.
   *
   * Owns the disableSend() side (moved here from sendMessage's front half); the
   * enable side stays with postGeneration/postError, which the callbacks below
   * call. assistantBubble is closed over by the callbacks.
   * @param {{userPrompt: string}} opts
   */
  function dispatchSend(opts) {
    disableSend();

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
    const systemPrompt = S.els.systemInput ? S.els.systemInput.value.trim() : "";
    embed.systemPrompt = systemPrompt || undefined;
    embed.container = assistantBubble; // the embed renders its output here

    // Per-turn generation parameters from the Parameters panel. Reading the helpers
    // (not the elements) keeps the slider as the single source. max_tokens is set
    // BEFORE the budget block below, so the answer reservation tracks the slider.
    embed.temperature = S.getTemperature();
    embed.max_tokens = S.getMaxTokens();

    // Normalise the full thread to role/content.
    const fullThread = S.messages.map(function (m) {
      return { role: m.role, content: m.content };
    });
    // Limit-aware sliding window: keep a recent slice that fits the chosen
    // model's context window, reserving room for the answer. Trims the PAYLOAD
    // only — S.messages and the on-screen thread are untouched. The reservation
    // reads the embed's live max_tokens, so when the max-tokens slider lands it
    // tracks the slider with no change here.
    const contextLimit = window.Chat.getContextLimit(S.currentModel);
    const answerReservation =
      embed && typeof embed.max_tokens === "number"
        ? embed.max_tokens
        : DEFAULT_ANSWER_RESERVATION;
    const windowed = applyTokenWindow({
      messages: fullThread,
      limit: contextLimit,
      answerReservation: answerReservation,
      safetyMargin: BUDGET_SAFETY_MARGIN,
      systemPrompt: systemPrompt,
    });
    announceTrim(windowed.dropped);
    if (windowed.dropped > 0) {
      logInfo("token budget: dropped", windowed.dropped, "oldest turn(s) to fit", contextLimit, "tokens for", S.currentModel);
    }
    const messagesForApi = windowed.messages;

    embed
      .sendStreamingRequest({
        userPrompt: opts.userPrompt, // required by the embed core's validation
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

  // ── Conversation-state UI seam ─────────────────────────────────────────────

  // Single source of truth for conversation-state-dependent UI. Every control
  // whose enabled/visible state depends on the thread (today: the clear button;
  // later, as we reach parity: sliders, regenerate, history) is updated HERE, and
  // callers that change the thread call updateConversationUI() afterwards rather
  // than toggling a control inline. This keeps controls from drifting out of sync
  // with the thread.
  function updateConversationUI() {
    const hasMessages = S.messages.length > 0;
    if (S.els.clearBtn) {
      S.els.clearBtn.disabled = !hasMessages;
    }
    // Future parity controls hook in here.
  }

  // ── Clear conversation ─────────────────────────────────────────────────────

  // Confirm-then-clear, no archive (Chat has no history). Local Chat consumes
  // window.safeConfirm asynchronously (it returns a Promise), so we await it here
  // and match that contract. performClear() (confirmed in 5b) already clears the
  // session, empties S.messages and the message list, focuses the input, and
  // announces "Conversation cleared." — we do not duplicate any of that; we only
  // confirm, call performClear, then refresh the UI seam.
  async function handleClear() {
    if (S.messages.length === 0) return; // nothing to clear
    const ok =
      typeof window.safeConfirm === "function"
        ? await window.safeConfirm("Clear this conversation? This cannot be undone.")
        : window.confirm("Clear this conversation? This cannot be undone.");
    if (!ok) return;
    window.ChatPersistence.performClear();
    updateConversationUI();
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
    if (els.clearBtn) {
      els.clearBtn.addEventListener("click", function () {
        handleClear();
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
    // Parameters panel (5c-i): live value + description on drag. The banding is
    // owned by the shared description helpers — we do not reimplement it here.
    if (els.temperatureSlider) {
      els.temperatureSlider.addEventListener("input", function () {
        const val = parseFloat(els.temperatureSlider.value);
        if (els.temperatureValue) els.temperatureValue.textContent = val.toFixed(1);
        if (els.temperatureDesc) els.temperatureDesc.textContent = S.getTemperatureDescription(val);
      });
    }
    if (els.maxTokensSlider) {
      els.maxTokensSlider.addEventListener("input", function () {
        const val = parseInt(els.maxTokensSlider.value, 10);
        if (els.maxTokensValue) els.maxTokensValue.textContent = val;
        if (els.maxTokensDesc) els.maxTokensDesc.textContent = S.getMaxTokensDescription(val);
      });
    }
    // System-prompt preset (5c-ii-b): selecting a preset fills the system box from
    // the shared S.SYSTEM_PRESETS map; "None (custom)" clears it. Textarea only —
    // Chat has no welcome card / currentEmbed to touch.
    if (els.presetSelect) {
      els.presetSelect.addEventListener("change", function () {
        if (!els.systemInput) return;
        const key = els.presetSelect.value;
        if (key && S.SYSTEM_PRESETS[key]) {
          els.systemInput.value = S.SYSTEM_PRESETS[key];
        } else {
          els.systemInput.value = "";
        }
        S.logInfo("Chat system-prompt preset changed to:", key || "none (custom)");
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
    // Restore any saved session once on load (cacheElements() above has populated
    // S.els.messageList, which the restore path rebuilds into). Persistence binds
    // its own state via its default window.ChatState capture — core does not call
    // attach on the other modules, so we do not add an attach call here. init() is
    // not async and self-runs on DOMContentLoaded, so kick the restore off without
    // blocking; show the banner only when a thread was actually restored.
    window.ChatPersistence.restoreSession().then(function (restored) {
      if (restored) {
        window.ChatPersistence.showRestoreBanner();
      }
      // In all cases, sync the conversation-state UI once after restore resolves
      // through the single seam, so the clear button reflects whether a thread was
      // restored (enabled) or not (disabled on a fresh load).
      updateConversationUI();
    });
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
    _dispatchSend: dispatchSend,
    _getOrCreateEmbed: getOrCreateEmbed,
    _postGeneration: postGeneration,
    _updateConversationUI: updateConversationUI,
    applyTokenWindow: applyTokenWindow,
  };
})();
