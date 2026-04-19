/**
 * Local Chat Tool — Phase 1b
 * Core orchestrator: init, send, embed management, model selector, UI state,
 * and window global handlers.
 *
 * @version 2.0.0 — Stage R5: slimmed core orchestrator
 */
(function () {
  "use strict";

  // ── Shared state (from local-chat-state.js) ─────────────────────────────
  var S = window.LocalChatState;
  if (!S) {
    console.error(
      "[LocalChat] local-chat-state.js must be loaded before local-chat.js",
    );
    return;
  }

  // ── Chips module reference (from local-chat-chips.js) ──────────────────
  var Chips = window.LocalChatChips;

  // ── Messages module reference (from local-chat-messages.js) ────────────
  var M = window.LocalChatMessages;

  // ── Persistence module reference (from local-chat-persistence.js) ──────
  var P = window.LocalChatPersistence;

  // ── Cached DOM references ───────────────────────────────────────────────
  var els = S.els;

  function navigateToSetupModel(modelKey) {
    var radio = document.getElementById("SetUp");
    if (radio) radio.checked = true;
    if (typeof showSetUp === "function") showSetUp(false);
    setTimeout(function () {
      if (!modelKey) return;
      var card = document.getElementById("setup-tm-model-" + modelKey);
      if (card) {
        card.scrollIntoView({ behavior: "instant", block: "start" });
        card.setAttribute("tabindex", "-1");
        card.focus({ preventScroll: true });
      }
    }, 500);
  }

  function cacheElements() {
    els.select = document.getElementById("local-chat-model-select");
    els.status = document.getElementById("local-chat-model-status");
    els.messageList = document.getElementById("local-chat-messages");
    els.input = document.getElementById("local-chat-input");
    els.sendBtn = document.getElementById("local-chat-send");
    els.cancelBtn = document.getElementById("local-chat-cancel");
    els.stats = document.getElementById("local-chat-stats");
    els.systemInput = document.getElementById("local-chat-system-input");
    els.clearBtn = document.getElementById("local-chat-clear");
    els.downloadBtn = document.getElementById("local-chat-download");
    els.newChatBtn = document.getElementById("local-chat-new-chat");
    els.presetSelect = document.getElementById("local-chat-preset-select");
    els.modelInfo = document.getElementById("local-chat-model-info-body");
    els.scrollBtn = null; // Created dynamically in init
    els.temperatureSlider = document.getElementById("local-chat-temperature");
    els.temperatureValue = document.getElementById(
      "local-chat-temperature-value",
    );
    els.temperatureDesc = document.getElementById(
      "local-chat-temperature-desc",
    );
    els.maxTokensSlider = document.getElementById("local-chat-max-tokens");
    els.maxTokensValue = document.getElementById("local-chat-max-tokens-value");
    els.maxTokensDesc = document.getElementById("local-chat-max-tokens-desc");
    els.inputCounter = document.getElementById("local-chat-input-counter");
  }

  // ── Model selector population ───────────────────────────────────────────

  function populateModelSelector() {
    if (!els.select) return;
    if (!window.LocalTextModelRegistry) {
      S.logWarn(
        "LocalTextModelRegistry not available — cannot populate models",
      );
      return;
    }

    els.select.innerHTML = "";
    const models = window.LocalTextModelRegistry.getEnabled();
    models.forEach(function (model) {
      const option = document.createElement("option");
      option.value = model.key;
      option.textContent = model.userInfo
        ? model.userInfo.displayName
        : model.key;
      els.select.appendChild(option);
    });

    S.currentModel = els.select.value || null;
    S.logInfo(
      "Model selector populated —",
      models.length,
      "models, selected:",
      S.currentModel,
    );
  }

  // ── Model status display ────────────────────────────────────────────────

  function updateModelStatus() {
    if (!els.status || !S.currentModel) return;

    let state = "unknown";

    if (
      window.LocalTextModelManager &&
      typeof window.LocalTextModelManager.getModelState === "function"
    ) {
      state = window.LocalTextModelManager.getModelState(S.currentModel);
    }

    const label = S.STATUS_LABELS[state] || S.STATUS_LABELS.unknown;

    if (state === "not-downloaded") {
      els.status.innerHTML = "Not downloaded \u2014 ";
      var setupLink = document.createElement("a");
      setupLink.href = "#setup-tm-model-" + S.currentModel;
      setupLink.textContent = "download in Set Up";
      setupLink.addEventListener("click", function (e) {
        e.preventDefault();
        navigateToSetupModel(S.currentModel);
      });
      els.status.appendChild(setupLink);
    } else {
      els.status.textContent = label;
    }

    if (els.sendBtn) {
      const canSend = state !== "not-downloaded" && state !== "unknown";
      els.sendBtn.disabled = !canSend;
    }

    if (els.input) {
      els.input.placeholder =
        state === "not-downloaded"
          ? "Model not downloaded \u2014 use Set Up to download first"
          : "Type a message\u2026";
    }

    S.logDebug(
      "Model status:",
      S.currentModel,
      "\u2192",
      state,
      "(" + label + ")",
    );
  }

  // ── Stats display ──────────────────────────────────────────────────────

  function updateStats(metadata) {
    if (!els.stats || !metadata) return;
    const parts = [];
    if (metadata.tokensPerSecond) {
      parts.push(metadata.tokensPerSecond.toFixed(1) + " tok/s");
    }
    if (metadata.tokens && metadata.tokens.completion) {
      parts.push(metadata.tokens.completion + " tokens");
    }
    if (metadata.processingTime) {
      parts.push((metadata.processingTime / 1000).toFixed(1) + "s");
    }
    els.stats.textContent = parts.join(" \u00b7 ");
  }

  // ── Context gauge ──────────────────────────────────────────────────────

  function updateContextGauge() {
    if (!els.stats || !S.currentModel) return;

    // Get context limit from registry
    let contextLimit = 4096; // fallback
    if (window.LocalTextModelRegistry) {
      const modelDef = window.LocalTextModelRegistry.getModel(S.currentModel);
      if (modelDef && modelDef.contextLimit) {
        contextLimit = modelDef.contextLimit;
      }
    }

    // Rough token estimate: ~4 chars per token
    let totalChars = 0;
    S.messages.forEach(function (m) {
      totalChars += m.content.length;
    });
    const estimatedTokens = Math.ceil(totalChars / 4);

    // Update or create the gauge element
    let gauge = document.getElementById("local-chat-context-gauge");
    if (!gauge) {
      gauge = document.createElement("span");
      gauge.id = "local-chat-context-gauge";
      gauge.className = "local-chat-context-gauge";
      els.stats.appendChild(gauge);
    }

    if (S.messages.length === 0) {
      gauge.textContent = "";
      return;
    }

    const percent = Math.round((estimatedTokens / contextLimit) * 100);
    gauge.textContent =
      " \u00b7 ~" +
      estimatedTokens.toLocaleString() +
      " / " +
      contextLimit.toLocaleString() +
      " tokens";

    if (percent > 80) {
      gauge.textContent += " \u2014 context nearly full, consider clearing";
      gauge.classList.add("local-chat-context-warning");
    } else {
      gauge.classList.remove("local-chat-context-warning");
    }
  }

  // ── Message count badge ─────────────────────────────────────────────────

  function updateMessageCount() {
    let countEl = document.getElementById("local-chat-message-count");
    if (!countEl) {
      countEl = document.createElement("span");
      countEl.id = "local-chat-message-count";
      countEl.className = "local-chat-message-count";
      if (els.stats) els.stats.appendChild(countEl);
    }

    if (S.messages.length === 0) {
      countEl.textContent = "";
      return;
    }

    countEl.textContent =
      " \u00b7 " +
      S.messages.length +
      (S.messages.length === 1 ? " message" : " messages");
  }

  // ── Embed instance management ──────────────────────────────────────────

  function getOrCreateEmbed() {
    if (S.currentEmbed && S.currentEmbed.model === "local/" + S.currentModel) {
      return S.currentEmbed;
    }

    // Read system prompt
    let systemPrompt = "";
    if (els.systemInput) {
      systemPrompt = els.systemInput.value.trim();
    }

    S.currentEmbed = new window.OpenRouterEmbed({
      containerId: "local-chat-messages", // Required by constructor; overridden per-send
      model: "local/" + S.currentModel,
      systemPrompt: systemPrompt || undefined,
      max_tokens: S.getMaxTokens(),
      temperature: S.getTemperature(),
      respectReducedMotion: true,
      showNotifications: false,
    });

    S.logInfo("Created embed instance for model: local/" + S.currentModel);
    return S.currentEmbed;
  }

  // ── Button state helpers ────────────────────────────────────────────────

  function updateButtonStates() {
    var hasMessages = S.messages.length > 0;
    if (els.clearBtn) els.clearBtn.disabled = !hasMessages;
    if (els.newChatBtn) els.newChatBtn.disabled = !hasMessages;
    if (els.downloadBtn) els.downloadBtn.disabled = !hasMessages;
  }

  // ── Update all UI helper (called by persistence module) ────────────────

  function updateAllUI() {
    updateModelStatus();
    Chips.updateModelInfo();
    updateButtonStates();
    updateContextGauge();
    updateMessageCount();
  }

  // ── UI state helpers ───────────────────────────────────────────────────

  function disableSend() {
    if (els.sendBtn) els.sendBtn.disabled = true;
    if (els.cancelBtn) els.cancelBtn.hidden = false;
    if (els.input) els.input.disabled = true;
  }

  function enableSend() {
    if (els.sendBtn) els.sendBtn.disabled = false;
    if (els.cancelBtn) els.cancelBtn.hidden = true;
    if (els.input) {
      els.input.disabled = false;
      els.input.focus();
    }
  }

  // ── DRY post-generation / post-error helpers ────────────────────────────
  // Called by sendMessage (here), regenerateLastResponse, and commitEdit
  // (both in the messages module via window.LocalChat._postGeneration).

  function postGeneration(assistantBubble, response) {
    M.removeTypingIndicator(assistantBubble);
    S.messages.push({ role: "assistant", content: response.text, model: S.currentModel });
    M.highlightCodeBlocks(assistantBubble);
    M.typesetMath(assistantBubble);
    M.addModelBadge(assistantBubble, S.currentModel);
    M.addCopyButton(assistantBubble, S.messages.length - 1);
    M.addFormattedCopyButton(assistantBubble, S.messages.length - 1);
    M.addRegenerateButton(assistantBubble);
    M.addReadAloudButton(assistantBubble);
    M.addTimestamp(assistantBubble);
    updateStats(response.metadata);
    S.isGenerating = false;
    enableSend();
    S.setMessageListLive("polite");
    M.scrollMessagesToBottom();
    updateAllUI();
    P.saveSession();
  }

  function postError(assistantBubble, error) {
    M.removeTypingIndicator(assistantBubble);
    M.showErrorInBubble(assistantBubble, error.message || "Unknown error");
    S.isGenerating = false;
    enableSend();
    S.setMessageListLive("polite");
  }

  // ── Send flow ──────────────────────────────────────────────────────────

  function sendMessage() {
    if (!els.input) return;

    const text = els.input.value.trim();
    if (!text) return;
    if (S.isGenerating) return;

    Chips.removeWelcomeCard();
    P.dismissRestoreBanner();
    P.closeHistoryPanel();

    // Stop TTS if speaking
    if (typeof window.TTSController !== "undefined") {
      window.TTSController.stop();
    }

    S.isGenerating = true;
    disableSend();
    S.setMessageListLive("off");

    // Clear input
    els.input.value = "";
    M.autoResizeTextarea();
    M.updateInputTokenCount();

    // Add user message to conversation
    S.messages.push({ role: "user", content: text });
    M.createUserBubble(text, S.messages.length - 1);
    M.scrollMessagesToBottom();

    // Create assistant bubble
    const assistantBubble = M.createAssistantBubble();
    M.addTypingIndicator(assistantBubble);

    // Get or create embed instance
    let embed;
    try {
      embed = getOrCreateEmbed();
    } catch (err) {
      S.logError("Failed to create embed:", err.message);
      M.removeTypingIndicator(assistantBubble);
      M.showErrorInBubble(assistantBubble, err.message);
      S.isGenerating = false;
      enableSend();
      return;
    }

    // Update system prompt on the embed (may have changed)
    const systemPrompt = els.systemInput ? els.systemInput.value.trim() : "";
    embed.systemPrompt = systemPrompt || undefined;
    embed.container = assistantBubble;

    // Build the messages array for multi-turn
    const messagesForApi = S.messages.map(function (m) {
      return { role: m.role, content: m.content };
    });

    // Call sendStreamingRequest
    embed
      .sendStreamingRequest({
        userPrompt: text, // Required to pass validation in embed core
        messages: messagesForApi, // Backend picks this up for multi-turn
        onChunk: function () {
          M.removeTypingIndicator(assistantBubble);
          M.scrollMessagesToBottom();
        },
        onComplete: function (response) {
          postGeneration(assistantBubble, response);
          S.announceToScreenReader("Response complete.");
          S.logInfo("Response complete \u2014", response.text.length, "chars");
        },
        onError: function (error) {
          postError(assistantBubble, error);
          S.announceToScreenReader("Error generating response.");
          S.logError("Send error:", error.message || error);
        },
      })
      .catch(function (error) {
        postError(assistantBubble, error);
        S.announceToScreenReader("Error generating response.");
        S.logError("Send error (catch):", error.message || error);
      });
  }

  // ── WebGPU check ─────────────────────────────────────────────────────────

  function checkWebGPU() {
    const hasWebGPU = !!navigator.gpu;
    if (!hasWebGPU) {
      if (els.messageList) {
        els.messageList.innerHTML =
          '<p class="local-chat-no-webgpu">Local Chat requires WebGPU, ' +
          "which is not available in this browser. Please try Chrome or Edge.</p>";
      }
      if (els.sendBtn) els.sendBtn.disabled = true;
      if (els.input) els.input.disabled = true;
      if (els.select) els.select.disabled = true;
      S.logWarn("WebGPU not available — Local Chat disabled");
    }
    return hasWebGPU;
  }

  // ── Init / Refresh ──────────────────────────────────────────────────────

  function init() {
    cacheElements();

    if (!checkWebGPU()) return;

    populateModelSelector();
    updateModelStatus();

    // Create scroll-to-bottom button
    if (els.messageList) {
      const scrollBtn = document.createElement("button");
      scrollBtn.id = "local-chat-scroll-bottom";
      scrollBtn.className = "local-chat-scroll-bottom";
      scrollBtn.setAttribute("aria-label", "Scroll to latest message");
      scrollBtn.hidden = true;
      scrollBtn.innerHTML = '<span aria-hidden="true">\u2193</span>';
      scrollBtn.addEventListener("click", function () {
        M.scrollMessagesToBottom();
      });
      // Insert after the message list
      els.messageList.parentNode.insertBefore(
        scrollBtn,
        els.messageList.nextSibling,
      );
      els.scrollBtn = scrollBtn;

      // Show/hide on scroll
      els.messageList.addEventListener("scroll", function () {
        const threshold = 100;
        const isAtBottom =
          els.messageList.scrollHeight -
            els.messageList.scrollTop -
            els.messageList.clientHeight <
          threshold;
        if (els.scrollBtn) els.scrollBtn.hidden = isAtBottom;
      });
    }

    // Enter-to-send (Shift+Enter for newline)
    if (els.input) {
      els.input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          window.localChatSend();
        }
      });
      els.input.addEventListener("input", M.autoResizeTextarea);
      els.input.addEventListener("input", M.updateInputTokenCount);
    }

    // Parameter slider listeners (5d)
    if (els.temperatureSlider) {
      els.temperatureSlider.addEventListener("input", function () {
        var val = parseFloat(els.temperatureSlider.value);
        if (els.temperatureValue)
          els.temperatureValue.textContent = val.toFixed(1);
        if (els.temperatureDesc)
          els.temperatureDesc.textContent = S.getTemperatureDescription(val);
        S.currentEmbed = null; // Force recreation on next send
      });
    }

    if (els.maxTokensSlider) {
      els.maxTokensSlider.addEventListener("input", function () {
        var val = parseInt(els.maxTokensSlider.value, 10);
        if (els.maxTokensValue) els.maxTokensValue.textContent = val;
        if (els.maxTokensDesc)
          els.maxTokensDesc.textContent = S.getMaxTokensDescription(val);
        S.currentEmbed = null; // Force recreation on next send
      });
    }

    updateButtonStates();
    initExportMenu();

    // Always start fresh — previous conversation is in history if needed
    P.clearSession();
    Chips.renderWelcomeCard();
    Chips.updateModelInfo();
    P.updateHistoryButton();

    // Escape key closes history panel
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        var panel = document.getElementById("local-chat-history-panel");
        if (panel) {
          P.closeHistoryPanel();
          e.preventDefault();
        }
      }
    });

    S.logInfo("init complete");
  }

  function refresh() {
    cacheElements();
    populateModelSelector();
    updateAllUI();
    P.updateHistoryButton();
    S.logDebug("refresh complete");
  }

  // ── Global handlers (for inline onclick) ────────────────────────────────

  window.localChatSend = function () {
    sendMessage();
  };

  window.localChatRegenerate = function () {
    M.regenerateLastResponse();
  };

  window.localChatDownload = function () {
    P.downloadConversation();
  };

  // ── Export menu ──────────────────────────────────────────────────────────

  var exportMenuOpen = false;

  function getExportTrigger() {
    return document.getElementById("local-chat-download");
  }

  function getExportMenu() {
    return document.getElementById("local-chat-export-menu");
  }

  function openExportMenu() {
    var trigger = getExportTrigger();
    var menu = getExportMenu();
    if (!trigger || !menu) return;
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    exportMenuOpen = true;
    // Focus first menu item
    var first = menu.querySelector('[role="menuitem"]');
    if (first) first.focus();
    // Listen for outside clicks
    setTimeout(function () {
      document.addEventListener("click", handleExportOutsideClick, true);
    }, 0);
  }

  function closeExportMenu(returnFocus) {
    var trigger = getExportTrigger();
    var menu = getExportMenu();
    if (!menu) return;
    menu.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    exportMenuOpen = false;
    document.removeEventListener("click", handleExportOutsideClick, true);
    if (returnFocus && trigger) trigger.focus();
  }

  function handleExportOutsideClick(e) {
    var menu = getExportMenu();
    var trigger = getExportTrigger();
    if (menu && !menu.contains(e.target) && trigger && !trigger.contains(e.target)) {
      closeExportMenu(false);
    }
  }

  function handleExportMenuKeydown(e) {
    var menu = getExportMenu();
    if (!menu || menu.hidden) return;

    var items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
    var current = document.activeElement;
    var idx = items.indexOf(current);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        items[(idx + 1) % items.length].focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length].focus();
        break;
      case "Home":
        e.preventDefault();
        items[0].focus();
        break;
      case "End":
        e.preventDefault();
        items[items.length - 1].focus();
        break;
      case "Escape":
        e.preventDefault();
        closeExportMenu(true);
        break;
      case "Tab":
        closeExportMenu(false);
        break;
    }
  }

  window.localChatToggleExport = function () {
    if (exportMenuOpen) {
      closeExportMenu(true);
    } else {
      openExportMenu();
    }
  };

  window.localChatExport = function (format) {
    closeExportMenu(true);
    switch (format) {
      case "markdown":
        P.downloadConversation();
        break;
      case "text":
        P.exportAsText();
        break;
      case "html":
        P.exportAsHTML();
        break;
      case "json":
        P.exportAsJSON();
        break;
    }
  };

  // Attach keyboard handler to the export menu once DOM is ready
  function initExportMenu() {
    var menu = getExportMenu();
    if (menu) {
      menu.addEventListener("keydown", handleExportMenuKeydown);
    }
  }

  window.localChatHistory = function () {
    P.openHistoryPanel();
  };

  window.localChatPresetChange = function () {
    if (!els.presetSelect || !els.systemInput) return;
    const key = els.presetSelect.value;
    if (key && S.SYSTEM_PRESETS[key]) {
      els.systemInput.value = S.SYSTEM_PRESETS[key];
    } else {
      els.systemInput.value = "";
    }
    S.currentEmbed = null;
    // Refresh welcome card chips if visible
    if (S.messages.length === 0) {
      Chips.removeWelcomeCard();
      Chips.renderWelcomeCard();
    }
    S.logInfo("System prompt preset changed to:", key || "none");
  };

  window.localChatCancel = function () {
    if (!S.isGenerating || !S.currentModel) return;

    // Engine-aware cancellation: WebLLM vs ONNX
    var modelDef = window.LocalTextModelRegistry
      ? window.LocalTextModelRegistry.getModel(S.currentModel)
      : null;

    if (modelDef && modelDef.engine === "webllm") {
      if (window.WebLLMTextEngine) {
        window.WebLLMTextEngine.cancelGeneration();
      }
    } else {
      if (window.LocalTextModelGateway) {
        window.LocalTextModelGateway.cancelGeneration(S.currentModel);
      }
    }

    // Capture partial text from the current assistant bubble
    const lastBubble = els.messageList
      ? els.messageList.querySelector(".local-chat-bubble-assistant:last-child")
      : null;
    if (lastBubble) M.removeTypingIndicator(lastBubble);
    if (lastBubble) {
      const partialText = lastBubble.textContent || "";
      if (partialText.trim()) {
        S.messages.push({
          role: "assistant",
          content: partialText.trim(),
          model: S.currentModel,
        });
        M.highlightCodeBlocks(lastBubble);
        M.typesetMath(lastBubble);
        M.addModelBadge(lastBubble, S.currentModel);
        M.addCopyButton(lastBubble, S.messages.length - 1);
        M.addFormattedCopyButton(lastBubble, S.messages.length - 1);
        M.addRegenerateButton(lastBubble);
        M.addReadAloudButton(lastBubble);
        M.addTimestamp(lastBubble);
      }
    }

    S.isGenerating = false;
    enableSend();
    S.setMessageListLive("polite");
    updateAllUI();
    P.saveSession();
    S.announceToScreenReader("Generation cancelled.");
    S.logInfo("Generation cancelled");
  };

  window.localChatNewChat = function () {
    if (S.messages.length === 0) return;
    P.archiveConversation();
    P.performClear();
    P.updateHistoryButton();
    S.announceToScreenReader(
      "Conversation saved to history. New chat started.",
    );
    S.logInfo("New chat — previous conversation archived");
  };

  window.localChatClear = function () {
    if (S.messages.length === 0) return;

    var confirmFn =
      typeof window.safeConfirm === "function"
        ? window.safeConfirm
        : function (msg) {
            return Promise.resolve(confirm(msg));
          };

    confirmFn(
      "Save this conversation to history before clearing?",
      "Clear Conversation",
    ).then(function (wantsSave) {
      if (wantsSave) {
        P.archiveConversation();
        P.performClear();
        S.announceToScreenReader("Conversation saved to history and cleared.");
        S.logInfo("Conversation archived and cleared");
      } else {
        confirmFn(
          "Discard conversation permanently?",
          "Discard Conversation",
        ).then(function (wantsDiscard) {
          if (!wantsDiscard) return;
          P.performClear();
          S.announceToScreenReader("Conversation cleared.");
          S.logInfo("Conversation discarded");
        });
      }
    });
  };

  window.localChatModelChange = function () {
    if (!els.select) return;
    const newModel = els.select.value;

    // If there's an active conversation, confirm before switching
    if (S.messages.length > 0 && newModel !== S.currentModel) {
      const confirmFn =
        typeof window.safeConfirm === "function"
          ? window.safeConfirm
          : function (msg) {
              return Promise.resolve(confirm(msg));
            };

      confirmFn(
        "Switching models will clear the current conversation. Continue?",
        "Switch Model",
      ).then(function (confirmed) {
        if (!confirmed) {
          els.select.value = S.currentModel;
          return;
        }
        P.archiveConversation();
        P.performClear();
        S.currentModel = newModel;
        updateModelStatus();
        Chips.updateModelInfo();
        Chips.removeWelcomeCard();
        Chips.renderWelcomeCard();
        S.announceToScreenReader(
          "Model changed. Previous conversation saved to history.",
        );
        S.logInfo("Model changed to:", S.currentModel);
      });
      return;
    }

    // No conversation — just switch
    S.currentModel = newModel;
    S.currentEmbed = null;
    updateModelStatus();
    Chips.updateModelInfo();
    P.clearSession();
    if (S.messages.length === 0) {
      Chips.removeWelcomeCard();
      Chips.renderWelcomeCard();
    }
    S.logInfo("Model changed to:", S.currentModel);
  };

  // ── Expose singleton ────────────────────────────────────────────────────

  const LocalChat = {
    init: init,
    refresh: refresh,
    // Internal helpers exposed for cross-module calls (messages, persistence)
    _getOrCreateEmbed: getOrCreateEmbed,
    _postGeneration: postGeneration,
    _postError: postError,
    _disableSend: disableSend,
    _enableSend: enableSend,
    _updateAllUI: updateAllUI,
    _navigateToSetupModel: navigateToSetupModel,
  };

  window.LocalChat = LocalChat;

  // ── Auto-init ───────────────────────────────────────────────────────────

  document.addEventListener("DOMContentLoaded", function () {
    LocalChat.init();
  });
})();
