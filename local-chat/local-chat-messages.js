/**
 * Local Chat — Messages Module
 * Bubble CRUD, editing, regeneration, copy, code highlighting, typing indicators,
 * and related helpers.
 *
 * @version 1.1.0 — Stage 5e (error retry + formatted copy)
 */
(function () {
  "use strict";

  // ── Guard: state module must be loaded first ─────────────────────────────
  var S = window.LocalChatState;
  if (!S) {
    console.error(
      "[LocalChatMessages] local-chat-state.js must be loaded before local-chat-messages.js",
    );
    return;
  }

  // Local alias — mutations (push/pop/splice) work through the alias.
  // Reassignments must also write through to S.messages.
  var messages = S.messages;
  var els = S.els;

  // ── Message rendering helpers ───────────────────────────────────────────

  function createUserBubble(text, messageIndex) {
    var bubble = document.createElement("div");
    bubble.className = "local-chat-bubble local-chat-bubble-user";
    bubble.textContent = text; // Plain text — no HTML for user input
    bubble.dataset.messageIndex = messageIndex;

    addTimestamp(bubble);
    addEditButton(bubble, messageIndex);

    if (els.messageList) {
      els.messageList.appendChild(bubble);
    }
    return bubble;
  }

  function createAssistantBubble() {
    var bubble = document.createElement("div");
    bubble.className = "local-chat-bubble local-chat-bubble-assistant";
    if (els.messageList) {
      els.messageList.appendChild(bubble);
    }
    return bubble;
  }

  function showErrorInBubble(bubble, errorMessage) {
    if (!bubble) return;
    bubble.innerHTML = "";

    var span = document.createElement("span");
    span.className = "local-chat-bubble-error";
    span.setAttribute("role", "alert");
    span.textContent = "Error: " + errorMessage;

    if (/has not been downloaded yet/i.test(errorMessage)) {
      span.appendChild(document.createTextNode(" "));
      var modelKey = S.currentModel || "";
      var link = document.createElement("a");
      link.href = "#setup-tm-model-" + modelKey;
      link.textContent = "Download in Set Up";
      link.addEventListener("click", function (e) {
        e.preventDefault();
        if (window.LocalChat && window.LocalChat._navigateToSetupModel) {
          window.LocalChat._navigateToSetupModel(modelKey);
        } else if (typeof showSetUp === "function") {
          showSetUp();
        }
      });
      span.appendChild(link);
    }

    bubble.appendChild(span);

    // Add retry button (5e)
    var retryBtn = document.createElement("button");
    retryBtn.className = "local-chat-retry";
    retryBtn.innerHTML =
      '<span aria-hidden="true" data-icon="refresh"></span> Retry';
    retryBtn.disabled = S.isGenerating;
    retryBtn.addEventListener("click", function () {
      retryLastMessage(bubble);
    });
    bubble.appendChild(retryBtn);

    // Populate any data-icon spans added dynamically
    if (typeof populateIcons === "function") {
      populateIcons(bubble);
    } else if (window.populateIcons) {
      window.populateIcons(bubble);
    }
  }

  // ── Retry from error (5e) ────────────────────────────────────────────────

  function retryLastMessage(errorBubble) {
    // Re-read messages from S to stay in sync after reassignments
    messages = S.messages;

    if (S.isGenerating) return;
    if (messages.length === 0) return;

    // Last entry in messages[] should be the user message that triggered the error
    var lastUserMsg = messages[messages.length - 1];
    if (!lastUserMsg || lastUserMsg.role !== "user") return;

    // Remove the error bubble from the DOM
    if (errorBubble && errorBubble.parentNode) {
      errorBubble.remove();
    }

    S.announceToScreenReader("Retrying last message.");

    // Re-send: create a new assistant bubble and stream
    S.isGenerating = true;
    if (window.LocalChat && window.LocalChat._disableSend) {
      window.LocalChat._disableSend();
    }
    S.setMessageListLive("off");

    var assistantBubble = createAssistantBubble();
    addTypingIndicator(assistantBubble);
    scrollMessagesToBottom();

    var embed;
    try {
      embed = window.LocalChat._getOrCreateEmbed();
    } catch (err) {
      S.logError("Failed to create embed for retry:", err.message);
      removeTypingIndicator(assistantBubble);
      showErrorInBubble(assistantBubble, err.message);
      S.isGenerating = false;
      if (window.LocalChat && window.LocalChat._enableSend) {
        window.LocalChat._enableSend();
      }
      return;
    }

    var systemPrompt = els.systemInput ? els.systemInput.value.trim() : "";
    embed.systemPrompt = systemPrompt || undefined;
    embed.container = assistantBubble;

    var messagesForApi = messages.map(function (m) {
      return { role: m.role, content: m.content };
    });

    embed
      .sendStreamingRequest({
        userPrompt: lastUserMsg.content,
        messages: messagesForApi,
        onChunk: function () {
          removeTypingIndicator(assistantBubble);
          scrollMessagesToBottom();
        },
        onComplete: function (response) {
          window.LocalChat._postGeneration(assistantBubble, response);
          S.announceToScreenReader("Response complete after retry.");
          S.logInfo(
            "Retry complete \u2014",
            response.text.length,
            "chars",
          );
        },
        onError: function (error) {
          window.LocalChat._postError(assistantBubble, error);
          S.announceToScreenReader("Error retrying response.");
          S.logError("Retry error:", error.message || error);
        },
      })
      .catch(function (error) {
        window.LocalChat._postError(assistantBubble, error);
        S.announceToScreenReader("Error retrying response.");
        S.logError("Retry error (catch):", error.message || error);
      });
  }

  // ── Typing indicator ────────────────────────────────────────────────────

  function addTypingIndicator(bubble) {
    var indicator = document.createElement("div");
    indicator.className = "local-chat-typing";
    indicator.setAttribute("role", "status");
    indicator.setAttribute("aria-label", "Generating response");
    indicator.innerHTML =
      '<span class="local-chat-typing-dot"></span>' +
      '<span class="local-chat-typing-dot"></span>' +
      '<span class="local-chat-typing-dot"></span>';
    bubble.appendChild(indicator);
  }

  function removeTypingIndicator(bubble) {
    var indicator = bubble.querySelector(".local-chat-typing");
    if (indicator) indicator.remove();
  }

  function scrollMessagesToBottom() {
    if (!els.messageList) return;
    els.messageList.scrollTop = els.messageList.scrollHeight;
  }

  function autoResizeTextarea() {
    if (!els.input) return;
    els.input.style.height = "auto";
    var maxHeight =
      parseInt(getComputedStyle(els.input).lineHeight, 10) * 8 || 200;
    els.input.style.height = Math.min(els.input.scrollHeight, maxHeight) + "px";
  }

  // ── Input token counter (5d) ───────────────────────────────────────────

  function updateInputTokenCount() {
    if (!els.inputCounter || !els.input) return;

    var text = els.input.value;
    if (!text || text.trim().length === 0) {
      els.inputCounter.hidden = true;
      return;
    }

    var estimatedTokens = Math.ceil(text.length / 4);
    var display = "~" + estimatedTokens.toLocaleString() + " tokens";

    // Check against model context window
    var contextLimit = 4096;
    if (window.LocalTextModelRegistry && S.currentModel) {
      var modelDef = window.LocalTextModelRegistry.getModel(S.currentModel);
      if (modelDef && modelDef.contextLimit) {
        contextLimit = modelDef.contextLimit;
      }
    }

    var percent = (estimatedTokens / contextLimit) * 100;
    if (percent > 50) {
      display += " \u2014 over half the context window";
      els.inputCounter.classList.add("local-chat-input-counter-warning");
    } else {
      els.inputCounter.classList.remove("local-chat-input-counter-warning");
    }

    els.inputCounter.textContent = display;
    els.inputCounter.hidden = false;
  }

  // ── Code block syntax highlighting ──────────────────────────────────────

  function highlightCodeBlocks(bubble) {
    if (typeof Prism !== "undefined" && Prism.highlightAllUnder) {
      Prism.highlightAllUnder(bubble);
    }
    addCodeCopyButtons(bubble);
  }

  // ── MathJax LaTeX rendering ─────────────────────────────────────────────

  function typesetMath(bubble) {
    if (
      !window.MathJax ||
      typeof window.MathJax.typesetPromise !== "function"
    ) {
      S.logDebug("MathJax not available — skipping typeset");
      return;
    }
    window.MathJax.typesetPromise([bubble]).catch(function (err) {
      S.logWarn("MathJax typeset failed:", err.message || err);
    });
  }

  function addCodeCopyButtons(bubble) {
    var pres = bubble.querySelectorAll("pre");
    pres.forEach(function (pre) {
      // Skip if already has a copy button
      if (pre.querySelector(".local-chat-code-copy")) return;

      // Wrap in a relative container for positioning
      var wrapper = document.createElement("div");
      wrapper.className = "local-chat-code-wrapper";
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      var btn = document.createElement("button");
      btn.className = "local-chat-code-copy";
      btn.innerHTML =
        '<span aria-hidden="true" data-icon="clipboard"></span> Copy code';
      btn.addEventListener("click", function () {
        var code = pre.querySelector("code");
        var text = code ? code.textContent : pre.textContent;
        navigator.clipboard
          .writeText(text)
          .then(function () {
            btn.innerHTML =
              '<span aria-hidden="true" data-icon="check"></span> Copied';
            S.announceToScreenReader("Code copied to clipboard.");
            setTimeout(function () {
              btn.innerHTML =
                '<span aria-hidden="true" data-icon="clipboard"></span> Copy code';
            }, 2000);
          })
          .catch(function () {
            S.logWarn("Clipboard write failed for code block");
          });
      });
      wrapper.appendChild(btn);
    });
  }

  // ── Copy response button ────────────────────────────────────────────────

  function getOrCreateActions(bubble) {
    var actions = bubble.querySelector(".local-chat-bubble-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "local-chat-bubble-actions";
      bubble.appendChild(actions);
    }
    return actions;
  }

  function addCopyButton(bubble, messageIndex) {
    var actions = getOrCreateActions(bubble);
    var copyBtn = document.createElement("button");
    copyBtn.className = "local-chat-copy";
    copyBtn.setAttribute("aria-label", "Copy response");
    copyBtn.innerHTML =
      '<span aria-hidden="true" data-icon="copy"></span> Copy';
    copyBtn.addEventListener("click", function () {
      // Re-read messages from S to stay in sync after reassignments
      var msgs = S.messages;
      var text = msgs[messageIndex]
        ? msgs[messageIndex].content
        : bubble.textContent;
      navigator.clipboard
        .writeText(text)
        .then(function () {
          copyBtn.innerHTML =
            '<span aria-hidden="true" data-icon="check"></span> Copied';
          S.announceToScreenReader("Response copied to clipboard.");
          setTimeout(function () {
            copyBtn.innerHTML =
              '<span aria-hidden="true" data-icon="copy"></span> Copy';
          }, 2000);
        })
        .catch(function () {
          S.logWarn("Clipboard write failed");
        });
    });
    actions.appendChild(copyBtn);
  }

  // ── Copy formatted button (5e) ──────────────────────────────────────────

  function addFormattedCopyButton(bubble, messageIndex) {
    var actions = getOrCreateActions(bubble);
    var btn = document.createElement("button");
    btn.className = "local-chat-copy-formatted";
    btn.innerHTML =
      '<span aria-hidden="true" data-icon="clipboard"></span> Copy formatted';

    btn.addEventListener("click", function () {
      // Re-read messages from S to stay in sync
      var msgs = S.messages;
      var plainText = msgs[messageIndex]
        ? msgs[messageIndex].content
        : bubble.textContent;

      // Get rendered HTML from the bubble (excluding action buttons, timestamp, badge)
      var clone = bubble.cloneNode(true);
      var toRemove = clone.querySelectorAll(
        ".local-chat-bubble-actions, .local-chat-timestamp, .local-chat-model-badge",
      );
      toRemove.forEach(function (el) { el.remove(); });
      var htmlContent = clone.innerHTML;

      // Try ClipboardItem API for rich copy
      if (typeof ClipboardItem !== "undefined") {
        var textBlob = new Blob([plainText], { type: "text/plain" });
        var htmlBlob = new Blob([htmlContent], { type: "text/html" });
        navigator.clipboard
          .write([
            new ClipboardItem({
              "text/plain": textBlob,
              "text/html": htmlBlob,
            }),
          ])
          .then(function () {
            btn.innerHTML =
              '<span aria-hidden="true" data-icon="check"></span> Copied';
            S.announceToScreenReader(
              "Formatted response copied to clipboard.",
            );
            setTimeout(function () {
              btn.innerHTML =
                '<span aria-hidden="true" data-icon="clipboard"></span> Copy formatted';
            }, 2000);
          })
          .catch(function () {
            // Fall back to plain text
            fallbackPlainCopy(plainText, btn);
          });
      } else {
        // Browser does not support ClipboardItem — fall back
        fallbackPlainCopy(plainText, btn);
      }
    });

    actions.appendChild(btn);
  }

  function fallbackPlainCopy(text, btn) {
    navigator.clipboard
      .writeText(text)
      .then(function () {
        btn.innerHTML =
          '<span aria-hidden="true" data-icon="check"></span> Copied';
        S.announceToScreenReader("Response copied to clipboard.");
        setTimeout(function () {
          btn.innerHTML =
            '<span aria-hidden="true" data-icon="clipboard"></span> Copy formatted';
        }, 2000);
      })
      .catch(function () {
        S.logWarn("Clipboard write failed for formatted copy");
      });
  }

  // ── Regenerate button ──────────────────────────────────────────────────

  function addRegenerateButton(bubble) {
    // Remove any existing regenerate button from other bubbles
    if (els.messageList) {
      var existing = els.messageList.querySelectorAll(
        ".local-chat-regenerate",
      );
      existing.forEach(function (btn) {
        btn.remove();
      });
    }

    var actions = getOrCreateActions(bubble);
    var regenBtn = document.createElement("button");
    regenBtn.className = "local-chat-regenerate";
    regenBtn.innerHTML =
      '<span aria-hidden="true" data-icon="refresh"></span> Regenerate';
    regenBtn.addEventListener("click", function () {
      regenerateLastResponse();
    });
    actions.appendChild(regenBtn);
  }

  function regenerateLastResponse() {
    // Re-read messages from S to stay in sync after reassignments
    messages = S.messages;

    if (S.isGenerating) return;
    if (messages.length < 2) return; // Need at least user + assistant

    // Check last message is from assistant
    var lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant") return;

    // Remove last assistant message and its bubble
    messages.pop();
    // Delegate session save to persistence module (or core fallback)
    if (window.LocalChatPersistence) {
      window.LocalChatPersistence.saveSession();
    }
    var lastBubble = els.messageList
      ? els.messageList.querySelector(".local-chat-bubble-assistant:last-child")
      : null;
    if (lastBubble) lastBubble.remove();

    // Find the last user message text (still in messages[])
    var lastUserMsg = messages[messages.length - 1];
    if (!lastUserMsg || lastUserMsg.role !== "user") return;

    // Re-send: create new assistant bubble and stream
    S.isGenerating = true;
    if (window.LocalChat && window.LocalChat._disableSend) {
      window.LocalChat._disableSend();
    }
    S.setMessageListLive("off");

    var assistantBubble = createAssistantBubble();
    addTypingIndicator(assistantBubble);
    scrollMessagesToBottom();

    var embed;
    try {
      embed = window.LocalChat._getOrCreateEmbed();
    } catch (err) {
      S.logError("Failed to create embed for regenerate:", err.message);
      removeTypingIndicator(assistantBubble);
      showErrorInBubble(assistantBubble, err.message);
      S.isGenerating = false;
      if (window.LocalChat && window.LocalChat._enableSend) {
        window.LocalChat._enableSend();
      }
      return;
    }

    var systemPrompt = els.systemInput ? els.systemInput.value.trim() : "";
    embed.systemPrompt = systemPrompt || undefined;
    embed.container = assistantBubble;

    var messagesForApi = messages.map(function (m) {
      return { role: m.role, content: m.content };
    });

    embed
      .sendStreamingRequest({
        userPrompt: lastUserMsg.content,
        messages: messagesForApi,
        onChunk: function () {
          removeTypingIndicator(assistantBubble);
          scrollMessagesToBottom();
        },
        onComplete: function (response) {
          window.LocalChat._postGeneration(assistantBubble, response);
          S.announceToScreenReader("Response regenerated.");
          S.logInfo(
            "Regeneration complete \u2014",
            response.text.length,
            "chars",
          );
        },
        onError: function (error) {
          window.LocalChat._postError(assistantBubble, error);
          S.announceToScreenReader("Error regenerating response.");
          S.logError("Regenerate error:", error.message || error);
        },
      })
      .catch(function (error) {
        window.LocalChat._postError(assistantBubble, error);
        S.announceToScreenReader("Error regenerating response.");
        S.logError("Regenerate error (catch):", error.message || error);
      });
  }

  // ── Model badge ────────────────────────────────────────────────────────

  function addModelBadge(bubble, modelKey) {
    var displayName = modelKey || "unknown";
    if (window.LocalTextModelRegistry) {
      var modelDef = window.LocalTextModelRegistry.getModel(modelKey);
      if (modelDef && modelDef.userInfo) {
        displayName = modelDef.userInfo.displayName;
      }
    }

    var badge = document.createElement("span");
    badge.className = "local-chat-model-badge";
    badge.textContent = displayName;
    // Insert at the top of the bubble (before any content)
    bubble.insertBefore(badge, bubble.firstChild);
  }

  // ── Timestamp ─────────────────────────────────────────────────────────

  function addTimestamp(bubble) {
    var ts = document.createElement("time");
    ts.className = "local-chat-timestamp";
    var now = new Date();
    ts.dateTime = now.toISOString();
    ts.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    bubble.appendChild(ts);
  }

  // ── Edit button on user bubbles ──────────────────────────────────────

  function addEditButton(bubble, messageIndex) {
    var editBtn = document.createElement("button");
    editBtn.className = "local-chat-edit-btn";
    editBtn.innerHTML =
      '<span aria-hidden="true" data-icon="pencil"></span> Edit';
    editBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      enterEditMode(bubble);
    });
    bubble.appendChild(editBtn);
  }

  function enterEditMode(bubble) {
    // Re-read messages from S to stay in sync after reassignments
    messages = S.messages;

    if (S.isGenerating) return;
    if (S.editingBubble) return; // Already editing another bubble

    var msgIndex = parseInt(bubble.dataset.messageIndex, 10);
    if (isNaN(msgIndex) || !messages[msgIndex]) return;

    S.editingBubble = bubble;
    var originalText = messages[msgIndex].content;

    // Store original content for cancel
    bubble.dataset.originalHtml = bubble.innerHTML;

    // Replace bubble content with edit UI
    bubble.innerHTML = "";
    bubble.classList.add("local-chat-bubble-editing");

    var textarea = document.createElement("textarea");
    textarea.className = "local-chat-edit-textarea";
    textarea.value = originalText;
    textarea.rows = Math.min(
      8,
      Math.max(2, originalText.split("\n").length + 1),
    );
    bubble.appendChild(textarea);

    var btnBar = document.createElement("div");
    btnBar.className = "local-chat-edit-buttons";

    var resendBtn = document.createElement("button");
    resendBtn.textContent = "Re-send";
    resendBtn.className = "local-chat-edit-resend";
    resendBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      commitEdit(bubble, msgIndex, textarea.value.trim());
    });

    var cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "local-chat-edit-cancel";
    cancelBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      cancelEdit(bubble);
    });

    btnBar.appendChild(resendBtn);
    btnBar.appendChild(cancelBtn);
    bubble.appendChild(btnBar);

    textarea.focus();
  }

  function cancelEdit(bubble) {
    if (!bubble || !bubble.dataset.originalHtml) return;
    bubble.innerHTML = bubble.dataset.originalHtml;
    bubble.classList.remove("local-chat-bubble-editing");
    delete bubble.dataset.originalHtml;
    S.editingBubble = null;
  }

  function commitEdit(bubble, msgIndex, newText) {
    // Re-read messages from S to stay in sync after reassignments
    messages = S.messages;

    if (!newText) {
      cancelEdit(bubble);
      return;
    }

    // Update the message content
    messages[msgIndex].content = newText;

    // Truncate messages[] to this point (remove everything after this user message)
    messages = S.messages = messages.slice(0, msgIndex + 1);
    // Delegate session save to persistence module (or core fallback)
    if (window.LocalChatPersistence) {
      window.LocalChatPersistence.saveSession();
    }

    // Remove all DOM bubbles after this one
    var nextSibling = bubble.nextElementSibling;
    while (nextSibling) {
      var toRemove = nextSibling;
      nextSibling = nextSibling.nextElementSibling;
      // Don't remove the scroll-to-bottom button
      if (!toRemove.classList.contains("local-chat-scroll-bottom")) {
        toRemove.remove();
      }
    }

    // Restore the bubble to non-edit state with new text
    bubble.innerHTML = "";
    bubble.textContent = newText;
    bubble.classList.remove("local-chat-bubble-editing");
    delete bubble.dataset.originalHtml;
    S.editingBubble = null;

    // Re-add timestamp and edit button
    addTimestamp(bubble);
    addEditButton(bubble, msgIndex);

    // Now send (reuse the existing send flow from the edited message)
    S.isGenerating = true;
    if (window.LocalChat && window.LocalChat._disableSend) {
      window.LocalChat._disableSend();
    }
    S.setMessageListLive("off");

    var assistantBubble = createAssistantBubble();
    addTypingIndicator(assistantBubble);
    scrollMessagesToBottom();

    var embed;
    try {
      embed = window.LocalChat._getOrCreateEmbed();
    } catch (err) {
      S.logError("Failed to create embed for edit re-send:", err.message);
      removeTypingIndicator(assistantBubble);
      showErrorInBubble(assistantBubble, err.message);
      S.isGenerating = false;
      if (window.LocalChat && window.LocalChat._enableSend) {
        window.LocalChat._enableSend();
      }
      return;
    }

    var systemPrompt = els.systemInput ? els.systemInput.value.trim() : "";
    embed.systemPrompt = systemPrompt || undefined;
    embed.container = assistantBubble;

    var messagesForApi = messages.map(function (m) {
      return { role: m.role, content: m.content };
    });

    embed
      .sendStreamingRequest({
        userPrompt: newText,
        messages: messagesForApi,
        onChunk: function () {
          removeTypingIndicator(assistantBubble);
          scrollMessagesToBottom();
        },
        onComplete: function (response) {
          window.LocalChat._postGeneration(assistantBubble, response);
          S.announceToScreenReader("Response complete after edit.");
          S.logInfo(
            "Edit re-send complete \u2014",
            response.text.length,
            "chars",
          );
        },
        onError: function (error) {
          window.LocalChat._postError(assistantBubble, error);
          S.announceToScreenReader("Error generating response.");
          S.logError("Edit re-send error:", error.message || error);
        },
      })
      .catch(function (error) {
        window.LocalChat._postError(assistantBubble, error);
        S.announceToScreenReader("Error generating response.");
        S.logError("Edit re-send error (catch):", error.message || error);
      });
  }

  // ── Read Aloud (TTS) ─────────────────────────────────────────────────

  var activeBubbleBtn = null; // Tracks currently-speaking bubble's button

  /**
   * Extract a semantic result object from a bubble, excluding action bar, badges, timestamps.
   * Returns { text, sections } when TTSSemantic is available, or
   * { text, sections: null } as a fallback (controller uses legacy chunking).
   * @param {HTMLElement} bubble
   * @returns {{ text: string, sections: Array|null }|null}
   */
  function getBubbleResult(bubble) {
    // Use semantic lineariser if available
    if (window.TTSSemantic && typeof window.TTSSemantic.linearise === 'function') {
      var result = window.TTSSemantic.linearise(bubble, {
        verbosity: window.TTSSemantic.getVerbosity(),
        skipSelectors: '.local-chat-bubble-actions, .local-chat-model-badge, .local-chat-timestamp'
      });
      if (result && result.text) return result;
    }

    // Fallback: clone-and-strip approach (no sections — controller uses legacy chunking)
    var clone = bubble.cloneNode(true);
    var remove = clone.querySelectorAll(
      ".local-chat-bubble-actions, .local-chat-model-badge, .local-chat-timestamp"
    );
    for (var i = 0; i < remove.length; i++) remove[i].remove();
    var plainText = (clone.innerText || clone.textContent || "").trim();
    return plainText ? { text: plainText, sections: null } : null;
  }

  /**
   * Update a read-aloud button's visual state (idle / speaking / paused).
   */
  function updateBubbleBtnState(btn, state) {
    btn.setAttribute("data-tts-state", state);
    var label = btn.querySelector(".local-chat-read-aloud-label");
    var icon = btn.querySelector("[data-icon]");
    switch (state) {
      case "speaking":
        if (label) label.textContent = "Stop";
        if (icon) icon.setAttribute("data-icon", "close");
        btn.setAttribute("aria-label", "Stop reading");
        break;
      case "paused":
        if (label) label.textContent = "Resume";
        if (icon) icon.setAttribute("data-icon", "message");
        btn.setAttribute("aria-label", "Resume reading");
        break;
      case "idle":
      default:
        if (label) label.textContent = "Read Aloud";
        if (icon) icon.setAttribute("data-icon", "message");
        btn.removeAttribute("aria-label");
        break;
    }
    if (typeof window.refreshIcons === "function") window.refreshIcons(btn);
  }

  /**
   * Add a Read Aloud button to an assistant bubble's action bar.
   */
  function addReadAloudButton(bubble) {
    if (
      typeof window.TTSController === "undefined" ||
      !window.TTSController.isAvailable()
    ) {
      S.logDebug("TTSController not available — skipping Read Aloud button");
      return;
    }

    // Preload the neural TTS model in the background if applicable.
    if (typeof window.TTSController.preloadIfNeeded === "function") {
      try {
        window.TTSController.preloadIfNeeded();
      } catch (e) {
        S.logDebug("preloadIfNeeded threw (non-critical): " + e.message);
      }
    }

    var actions = getOrCreateActions(bubble);
    var btn = document.createElement("button");
    btn.className = "local-chat-read-aloud";
    btn.setAttribute("data-tts-state", "idle");
    btn.innerHTML =
      '<span aria-hidden="true" data-icon="message"></span> <span class="local-chat-read-aloud-label">Read Aloud</span>';
    if (typeof window.refreshIcons === "function") window.refreshIcons(btn);
    actions.appendChild(btn);

    btn.addEventListener("click", function () {
      var state = btn.getAttribute("data-tts-state");
      switch (state) {
        case "idle":
          var result = getBubbleResult(bubble);
          if (!result || !result.text) return;
          // Stop any other bubble that is currently speaking
          window.TTSController.stop();
          activeBubbleBtn = btn;
          window.TTSController.speak(result);
          break;
        case "speaking":
          window.TTSController.stop();
          break;
        case "paused":
          window.TTSController.resume();
          break;
      }
    });
  }

  /**
   * Wire global TTS events (once) to update whichever bubble button is active.
   */
  function wireReadAloudEvents() {
    if (
      !window.EmbedEventEmitter ||
      typeof window.EmbedEventEmitter.on !== "function"
    ) {
      S.logWarn(
        "EmbedEventEmitter not available — TTS events will not update Read Aloud buttons",
      );
      return;
    }

    window.EmbedEventEmitter.on("tts:start", function () {
      if (activeBubbleBtn) updateBubbleBtnState(activeBubbleBtn, "speaking");
    });
    window.EmbedEventEmitter.on("tts:end", function () {
      if (activeBubbleBtn) updateBubbleBtnState(activeBubbleBtn, "idle");
      activeBubbleBtn = null;
    });
    window.EmbedEventEmitter.on("tts:error", function () {
      if (activeBubbleBtn) updateBubbleBtnState(activeBubbleBtn, "idle");
      activeBubbleBtn = null;
    });
    window.EmbedEventEmitter.on("tts:pause", function () {
      if (activeBubbleBtn) updateBubbleBtnState(activeBubbleBtn, "paused");
    });
    window.EmbedEventEmitter.on("tts:resume", function () {
      if (activeBubbleBtn) updateBubbleBtnState(activeBubbleBtn, "speaking");
    });

    S.logDebug("Read Aloud TTS events wired");
  }

  // Initialise event wiring once
  wireReadAloudEvents();

  // ── Expose module ────────────────────────────────────────────────────

  window.LocalChatMessages = {
    createUserBubble: createUserBubble,
    createAssistantBubble: createAssistantBubble,
    showErrorInBubble: showErrorInBubble,
    retryLastMessage: retryLastMessage,
    addTypingIndicator: addTypingIndicator,
    removeTypingIndicator: removeTypingIndicator,
    scrollMessagesToBottom: scrollMessagesToBottom,
    autoResizeTextarea: autoResizeTextarea,
    updateInputTokenCount: updateInputTokenCount,
    highlightCodeBlocks: highlightCodeBlocks,
    typesetMath: typesetMath,
    addCopyButton: addCopyButton,
    addFormattedCopyButton: addFormattedCopyButton,
    addRegenerateButton: addRegenerateButton,
    addReadAloudButton: addReadAloudButton,
    addModelBadge: addModelBadge,
    addTimestamp: addTimestamp,
    addEditButton: addEditButton,
    regenerateLastResponse: regenerateLastResponse,
  };

  S.logInfo("Messages module loaded");
})();
