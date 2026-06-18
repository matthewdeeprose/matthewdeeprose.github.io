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
    if (typeof window.refreshIcons === "function") {
      window.refreshIcons(bubble);
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

  // Local Chat owns its own math a11y rather than relying on the global
  // mathPixEnhanceMathJax (which was built for MathPix mode). Mirrors the
  // minimum set of attributes enhanceSingleMathElement provides:
  //   • tabindex="0" for WCAG 2.1.1 scrollable-region focus
  //   • role="math" + aria-label for screen-reader announcement
  //   • Defuse mjx-containers nested inside <mjx-assistive-mml>/<mathml>
  //     so they cannot grab focus
  // Idempotent via data-local-chat-enhanced.
  function enhanceMathA11y(bubble) {
    if (!bubble) return;
    var containers = bubble.querySelectorAll("mjx-container");
    for (var i = 0; i < containers.length; i++) {
      var el = containers[i];
      if (el.getAttribute("data-local-chat-enhanced")) continue;
      if (el.closest("mjx-assistive-mml") || el.closest("mathml")) {
        el.setAttribute("tabindex", "-1");
        el.setAttribute("aria-hidden", "true");
        el.setAttribute("data-local-chat-enhanced", "duplicate");
        continue;
      }
      el.setAttribute("tabindex", "0");
      if (!el.hasAttribute("role")) {
        el.setAttribute("role", "math");
      }
      var label =
        (el.textContent || "").trim() ||
        "Mathematical expression " + (i + 1);
      el.setAttribute("aria-label", label + ". ");
      el.setAttribute("data-local-chat-enhanced", "true");
    }
  }

  function typesetMath(bubble) {
    if (
      !window.MathJax ||
      typeof window.MathJax.typesetPromise !== "function"
    ) {
      S.logDebug("MathJax not available — skipping typeset");
      return;
    }
    // Prefer the unwrapped typesetPromise stashed in tools.html so Local
    // Chat bypasses the global mathPixEnhanceMathJax wrapper (which is for
    // MathPix mode). Fall back to the wrapped function if the unwrapped
    // reference isn't there yet (very early init).
    var fn =
      typeof window.originalTypesetPromise === "function"
        ? window.originalTypesetPromise
        : window.MathJax.typesetPromise;
    fn.call(window.MathJax, [bubble])
      .then(function () {
        enhanceMathA11y(bubble);
      })
      .catch(function (err) {
        S.logWarn("MathJax typeset failed:", err && err.message ? err.message : err);
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
      // Strip mathpix/local-chat internal attrs from cloned math elements
      // so pasted output doesn't carry our enhancement markers. Keep
      // role="math" + aria-label — they're useful in the paste target.
      var mathEls = clone.querySelectorAll(
        "mjx-container, mjx-assistive-mml",
      );
      mathEls.forEach(function (el) {
        el.removeAttribute("data-mathpix-enhanced");
        el.removeAttribute("data-math-index");
        el.removeAttribute("data-local-chat-enhanced");
        el.removeAttribute("tabindex");
      });
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
   * Synchronous semantic linearise. Used for cheap enabled-state / preflight
   * checks where running SRE on every call would be wasteful. Returns
   * { text, sections } when TTSSemantic is available, or
   * { text, sections: null } as a fallback (controller uses legacy chunking).
   *
   * Stage 3: the Clearspeak-rewritten payload (with maths in Clearspeak and
   * header-less tables read as paragraphs) is built only on actual Speak
   * clicks via getPreparedBubbleResult(). The sync/async split mirrors
   * Image Describer's Stage 1 lesson — see semantic-tts-plan.md.
   *
   * @param {HTMLElement} bubble
   * @returns {{ text: string, sections: Array|null }|null}
   */
  function getBubbleResultFast(bubble) {
    // Use semantic lineariser if available. Stage 4 adds the
    // .imgdesc-save-audio-note sibling (".Processed locally on your device.")
    // to the skip list — it lives inside the bubble for layout but must not
    // be read aloud or exported.
    if (window.TTSSemantic && typeof window.TTSSemantic.linearise === 'function') {
      var result = window.TTSSemantic.linearise(bubble, {
        verbosity: window.TTSSemantic.getVerbosity(),
        skipSelectors:
          '.local-chat-bubble-actions, .local-chat-model-badge, .local-chat-timestamp, .imgdesc-save-audio-note'
      });
      if (result && result.text) return result;
    }

    // Fallback: clone-and-strip approach (no sections — controller uses legacy chunking)
    var clone = bubble.cloneNode(true);
    var remove = clone.querySelectorAll(
      ".local-chat-bubble-actions, .local-chat-model-badge, .local-chat-timestamp, .imgdesc-save-audio-note"
    );
    for (var i = 0; i < remove.length; i++) remove[i].remove();
    var plainText = (clone.innerText || clone.textContent || "").trim();
    return plainText ? { text: plainText, sections: null } : null;
  }

  /**
   * Stage 3: clone the bubble and run the shared math + table rewriter
   * passes via window.TTSRewriters.preparePanelForTts. Returns the mutated
   * clone (live DOM is untouched). On missing shared helper or SRE failure,
   * resolves with an unmodified clone so the lineariser still has a tree
   * to walk (formulas keep their existing aria-labels — degraded but
   * audible).
   *
   * @param {HTMLElement} bubble
   * @returns {Promise<Element|null>}
   */
  function prepareBubbleForTts(bubble) {
    if (window.TTSRewriters && typeof window.TTSRewriters.preparePanelForTts === 'function') {
      return window.TTSRewriters.preparePanelForTts(bubble);
    }
    S.logWarn('TTSRewriters.preparePanelForTts not available — returning unmodified clone');
    return Promise.resolve(bubble ? bubble.cloneNode(true) : null);
  }

  /**
   * Stage 3: async counterpart to getBubbleResultFast. Runs the prepare
   * pipeline (clone + math rewriter + table rewriter), then linearises the
   * result for TTSController.speak(). On failure resolves with null rather
   * than throwing — degradation is silent, audio plays from whatever the
   * fallback produced.
   *
   * Preserves the existing skipSelectors so action bar, badge, and timestamp
   * are never read aloud.
   *
   * @param {HTMLElement} bubble
   * @returns {Promise<{ text: string, sections: Array|null }|null>}
   */
  function getPreparedBubbleResult(bubble) {
    if (!bubble) return Promise.resolve(null);

    return prepareBubbleForTts(bubble).then(function (target) {
      if (!target) return null;
      if (window.TTSSemantic && typeof window.TTSSemantic.linearise === 'function') {
        var result = window.TTSSemantic.linearise(target, {
          verbosity: window.TTSSemantic.getVerbosity(),
          // Same skipSelectors as the sync path — never read action bar,
          // badge, timestamp, or the Stage 4 "Processed locally on your
          // device" reassurance note aloud. Plus belt-and-braces math
          // source-format guards in case any leaked past the math pass.
          skipSelectors:
            '.local-chat-bubble-actions, .local-chat-model-badge, .local-chat-timestamp, .imgdesc-save-audio-note, mathml, asciimath, latex'
        });
        if (result && result.text) return result;
      }
      var plain = (target.innerText || target.textContent || '').trim();
      return plain ? { text: plain, sections: null } : null;
    });
  }

  /**
   * Update a read-aloud button's visual state.
   * States: "idle" | "loading" | "speaking" | "paused".
   * The "loading" state was added in Stage 3 to cover SRE prepare-pipeline
   * latency (~1-2 s on first click only — cache-hit clicks skip this frame).
   */
  function updateBubbleBtnState(btn, state) {
    btn.setAttribute("data-tts-state", state);
    var label = btn.querySelector(".local-chat-read-aloud-label");
    var icon = btn.querySelector("[data-icon]");
    switch (state) {
      case "loading":
        if (label) label.textContent = "Preparing…";
        if (icon) icon.setAttribute("data-icon", "hourglass");
        btn.setAttribute("aria-label", "Preparing speech, please wait");
        btn.disabled = true;
        break;
      case "speaking":
        if (label) label.textContent = "Stop";
        if (icon) icon.setAttribute("data-icon", "close");
        btn.setAttribute("aria-label", "Stop reading");
        btn.disabled = false;
        break;
      case "paused":
        if (label) label.textContent = "Resume";
        if (icon) icon.setAttribute("data-icon", "message");
        btn.setAttribute("aria-label", "Resume reading");
        btn.disabled = false;
        break;
      case "idle":
      default:
        if (label) label.textContent = "Read Aloud";
        if (icon) icon.setAttribute("data-icon", "message");
        btn.removeAttribute("aria-label");
        btn.disabled = false;
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
          // Cheap synchronous text-presence check first — don't disrupt an
          // already-speaking bubble if this one has nothing to read.
          var preflight = getBubbleResultFast(bubble);
          if (!preflight || !preflight.text) return;

          // Stop any other bubble that is currently speaking. tts:end will
          // fire and the wired listener will reset that bubble's button to
          // idle, then clear the previous activeBubbleBtn.
          window.TTSController.stop();
          activeBubbleBtn = btn;

          // Skip the LOADING frame on cache-hit clicks (SRE already cached).
          // Mirrors the Image Describer Stage 1 UX — the prepare-pipeline
          // resolves so quickly when SRE is warm that showing "Preparing…"
          // would be visual noise.
          var sreCached = !!(
            window.TTSSreLoader &&
            typeof window.TTSSreLoader.isLoaded === "function" &&
            window.TTSSreLoader.isLoaded()
          );
          if (!sreCached) {
            updateBubbleBtnState(btn, "loading");
          }

          getPreparedBubbleResult(bubble)
            .then(function (result) {
              // Bail if the user navigated away, the bubble was removed
              // (e.g. edit/regenerate), or another bubble took ownership
              // during the await.
              if (!document.contains(bubble) || activeBubbleBtn !== btn) {
                if (btn.getAttribute("data-tts-state") === "loading") {
                  updateBubbleBtnState(btn, "idle");
                }
                return;
              }
              if (!result || !result.text) {
                if (btn.getAttribute("data-tts-state") === "loading") {
                  updateBubbleBtnState(btn, "idle");
                }
                if (activeBubbleBtn === btn) activeBubbleBtn = null;
                return;
              }
              // tts:start fires the wired listener that flips this button
              // to "speaking" (which re-enables it so the user can Stop).
              window.TTSController.speak(result);
            })
            .catch(function (err) {
              // preparePanelForTts swallows SRE load failures, so reaching
              // here means linearise or speak threw — degrade to idle
              // rather than leaving the button stuck on LOADING.
              S.logError("Bubble prepare-pipeline failed", err);
              if (btn.getAttribute("data-tts-state") === "loading") {
                updateBubbleBtnState(btn, "idle");
              }
              if (activeBubbleBtn === btn) activeBubbleBtn = null;
            });
          break;
        case "loading":
          // Re-entrancy guard — ignore clicks during prepare-pipeline await.
          // The button is already visually disabled in this state; this
          // branch is defensive against future programmatic dispatchers.
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

  // ── Save as Audio (Stage 4 — TTS companion controls) ─────────────────
  //
  // Per-bubble Save-as-MP3/WAV button mirroring the Image Describer pattern
  // (tts-read-aloud.js §5.1). Distinct from Image Describer's single-output
  // model, Local Chat has many bubbles each with its own Save button. State
  // tracking:
  //   activeBubbleBtn        — currently speaking bubble (Stage 3, above).
  //   activeExportingBtn     — currently exporting bubble (Stage 4, here).
  // Both are independent: a user can listen to bubble A while exporting B.
  //
  // Panel-level export lock: TTSController.exportMp3/exportWav have NO
  // internal concurrency guard (verified in tts-controller.js:1581-1697).
  // We enforce one-at-a-time at the panel level via activeExportingBtn.
  // While set, every other bubble's Save button is disabled (the existing
  // refresh predicate gates on it).
  //
  // localStorage key is Local-Chat-specific (per Stage 4 plan task 2 —
  // users may want different defaults per panel). Engine badge is
  // conversation-level (one #local-chat-read-aloud-engine span next to the
  // existing Voice Settings link); Save buttons are per-bubble.

  var EXPORT_FORMAT_KEY = 'local-chat-tts-export-format';
  var DEFAULT_EXPORT_FORMAT = 'mp3';

  /** Currently-exporting bubble's main Save button — panel-level lock. */
  var activeExportingBtn = null;

  // ── Format toggle (MP3 ↔ WAV) ──────────────────────────────────────

  function getLocalChatExportFormat() {
    try {
      var stored = localStorage.getItem(EXPORT_FORMAT_KEY);
      if (stored === 'wav' || stored === 'mp3') return stored;
    } catch (e) { /* localStorage unavailable */ }
    return DEFAULT_EXPORT_FORMAT;
  }

  function setLocalChatExportFormat(format) {
    if (format !== 'wav' && format !== 'mp3') return;
    try {
      localStorage.setItem(EXPORT_FORMAT_KEY, format);
    } catch (e) { /* localStorage unavailable */ }
    refreshAllSaveAudioButtons();
  }

  /**
   * Sync a single Save button's labels to the current format. Called by
   * refreshLocalChatSaveAudioEnabled when the button is in its "ready"
   * branch (text present, engine = neural, model loaded, no other export).
   * Disabled-with-reason branches override the label themselves.
   */
  function refreshSaveButtonFormatLabels(btn) {
    if (!btn) return;
    var label = btn.querySelector('.local-chat-save-audio-label');
    var formatBtn = btn.parentElement
      ? btn.parentElement.querySelector('.local-chat-save-audio-format')
      : null;
    var formatLabel = formatBtn
      ? formatBtn.querySelector('.local-chat-save-audio-format-label')
      : null;
    var format = getLocalChatExportFormat();
    var upper = format.toUpperCase();
    if (label) label.textContent = 'Save as ' + upper;
    btn.setAttribute('aria-label', 'Save bubble as ' + upper + ' audio file');
    if (formatLabel) formatLabel.textContent = upper;
    if (formatBtn) {
      formatBtn.setAttribute(
        'aria-label',
        'Change audio format. Currently ' + upper + '.'
      );
    }
  }

  // ── Per-bubble enabled-state predicate ─────────────────────────────

  /**
   * Recompute a single bubble's Save button enabled state + label and
   * apply it. Mirrors tts-read-aloud.js refreshSaveAudioEnabled with two
   * Local-Chat additions:
   *   1) The panel-level export lock — if another bubble is exporting,
   *      this bubble's Save button is disabled.
   *   2) "Empty bubble" (no text yet) — disabled. Local Chat bubbles can
   *      exist briefly with only a typing indicator.
   *
   * Does not touch the in-flight visuals (Generating… / Encoding MP3 X%…)
   * — those are the click handler's responsibility. The click handler
   * calls this in its finally to restore the resting label.
   */
  function refreshLocalChatSaveAudioEnabled(bubble) {
    if (!bubble) return;
    var btn = bubble.querySelector('.local-chat-save-audio-main');
    var formatBtn = bubble.querySelector('.local-chat-save-audio-format');
    if (!btn) return;
    // Don't disturb the in-flight visuals — the click handler owns the
    // disabled flag while activeExportingBtn === btn.
    if (activeExportingBtn === btn) return;

    var label = btn.querySelector('.local-chat-save-audio-label');
    var format = getLocalChatExportFormat();
    var upper = format.toUpperCase();

    var preflight = getBubbleResultFast(bubble);
    var hasText = !!(preflight && preflight.text);
    var isGenerating = !!S.isGenerating;
    var engine = (window.TTSController && typeof window.TTSController.getEngine === 'function')
      ? window.TTSController.getEngine()
      : 'webspeech';
    var isNeural = engine !== 'webspeech';
    var modelReady = false;
    if (isNeural && window.TTSNeuralGateway &&
        typeof window.TTSNeuralGateway.getModelState === 'function') {
      var state = window.TTSNeuralGateway.getModelState('supertonic');
      modelReady = (state === 'loaded' || state === 'cached');
    }
    var someoneElseExporting = (activeExportingBtn && activeExportingBtn !== btn);

    var canExport =
      hasText && !isGenerating && isNeural && modelReady && !someoneElseExporting;
    btn.disabled = !canExport;
    if (formatBtn) formatBtn.disabled = !canExport;

    // Label nudges users to the action required (most-specific first).
    if (!isNeural) {
      if (label) label.textContent = 'Save as ' + upper + ' (requires natural voice)';
      btn.setAttribute(
        'aria-label',
        'Save as ' + upper + ' — requires natural voice engine'
      );
    } else if (!modelReady) {
      if (label) label.textContent = 'Save as ' + upper + ' (model loading…)';
      btn.setAttribute(
        'aria-label',
        'Save as ' + upper + ' — model is loading'
      );
    } else if (someoneElseExporting) {
      if (label) label.textContent = 'Save as ' + upper + ' (another export running)';
      btn.setAttribute(
        'aria-label',
        'Save as ' + upper + ' — another export is in progress'
      );
    } else {
      refreshSaveButtonFormatLabels(btn);
    }
  }

  /**
   * Iterate every rendered Local Chat Save button and refresh its
   * enabled-state. Hooked into tts:engineChanged, model:stateChange, and
   * format-toggle clicks. Cheap — O(n) over assistant bubbles per call.
   */
  function refreshAllSaveAudioButtons() {
    var bubbles = document.querySelectorAll(
      '.local-chat-bubble-assistant'
    );
    for (var i = 0; i < bubbles.length; i++) {
      refreshLocalChatSaveAudioEnabled(bubbles[i]);
    }
  }

  // ── Save-audio click handler ───────────────────────────────────────

  /**
   * Handle a click on a bubble's Save-as-Audio main button.
   * Panel-level lock: if another bubble is mid-export, refuse and tell
   * the user. Otherwise run the prepared payload through exportMp3/Wav.
   *
   * In-flight visuals (Generating… → Encoding MP3 X%…) are managed
   * inline here; the resting-label restore is delegated to
   * refreshLocalChatSaveAudioEnabled(bubble) in the finally block.
   */
  function handleLocalChatSaveAudioClick(bubble, btn) {
    if (!window.TTSController) {
      S.logWarn('TTSController not available');
      return;
    }

    // Panel-level export lock — at most one export in flight.
    if (activeExportingBtn && activeExportingBtn !== btn) {
      if (typeof window.notifyWarning === 'function') {
        window.notifyWarning(
          'Another audio export is already in progress. Please wait for it to finish.'
        );
      }
      return;
    }

    var format = getLocalChatExportFormat();
    var exportFn = format === 'mp3'
      ? window.TTSController.exportMp3
      : window.TTSController.exportWav;
    if (typeof exportFn !== 'function') {
      S.logWarn('TTSController.export' + format.toUpperCase() + ' not available');
      return;
    }

    // Cheap synchronous text-presence check — don't lock the UI for a
    // bubble with nothing to export. The actual payload sent to the
    // controller is the Clearspeak-rewritten one from getPreparedBubbleResult.
    var preflight = getBubbleResultFast(bubble);
    if (!preflight || !preflight.text) {
      S.logWarn('No text to export');
      return;
    }

    var label = btn.querySelector('.local-chat-save-audio-label');
    var icon = btn.querySelector('[data-icon]');
    var formatBtn = bubble.querySelector('.local-chat-save-audio-format');

    // Claim the panel lock and lock the clicked button immediately.
    activeExportingBtn = btn;
    btn.disabled = true;
    if (formatBtn) formatBtn.disabled = true;
    if (label) label.textContent = 'Generating…';
    if (icon) {
      icon.setAttribute('data-icon', 'hourglass');
      if (typeof window.refreshIcons === 'function') window.refreshIcons(icon);
    }
    // Cascade-disable every other bubble's Save button via the refresh
    // predicate (which gates on activeExportingBtn).
    refreshAllSaveAudioButtons();
    if (typeof S.announceToScreenReader === 'function') {
      S.announceToScreenReader('Generating ' + format.toUpperCase() + ' audio file.');
    }

    getPreparedBubbleResult(bubble)
      .then(function (result) {
        if (!result || !result.text) {
          throw new Error('No text to export after rewriter pipeline');
        }
        return exportFn.call(window.TTSController, result);
      })
      .then(function () {
        if (typeof S.announceToScreenReader === 'function') {
          S.announceToScreenReader('Audio file saved.');
        }
        if (typeof window.notifySuccess === 'function') {
          window.notifySuccess('Audio file saved successfully.');
        }
      })
      .catch(function (err) {
        S.logError('Audio export failed', err);
        var msg = (err && err.message) ? err.message : 'unknown error';
        if (typeof S.announceToScreenReader === 'function') {
          S.announceToScreenReader('Audio export failed: ' + msg);
        }
        if (typeof window.notifyWarning === 'function') {
          window.notifyWarning('Audio export failed: ' + msg);
        }
      })
      .then(function () {
        // finally — always restore the panel lock, icon, and labels.
        activeExportingBtn = null;
        if (icon) {
          icon.setAttribute('data-icon', 'download');
          if (typeof window.refreshIcons === 'function') window.refreshIcons(icon);
        }
        // Refresh every bubble so the cascade-disabled siblings come back.
        refreshAllSaveAudioButtons();
      });
  }

  // ── In-flight progress label updates (events) ──────────────────────

  /**
   * tts:exportProgress handler — only fires for the actively-exporting
   * bubble. Image Describer's identical listener fires globally; here we
   * filter on activeExportingBtn so we never react to Image Describer's
   * exports. Updates the Save button's label only — Stage 4 deliberately
   * does NOT use an inline progress bar (chat bubbles are short; the
   * Image Describer reference does, but its pattern is over-spec for
   * the per-bubble Local Chat case).
   */
  function onExportProgress(data) {
    if (!activeExportingBtn) return;
    if (!data || typeof data.chunk !== 'number' || typeof data.totalChunks !== 'number') return;
    var label = activeExportingBtn.querySelector('.local-chat-save-audio-label');
    if (label) {
      label.textContent = 'Generating ' + data.chunk + ' of ' + data.totalChunks + '…';
    }
  }

  function onExportEncodeProgress(data) {
    if (!activeExportingBtn) return;
    if (!data || typeof data.percent !== 'number') return;
    var percent = Math.max(0, Math.min(100, Math.round(data.percent)));
    var label = activeExportingBtn.querySelector('.local-chat-save-audio-label');
    if (label) label.textContent = 'Encoding MP3 ' + percent + '%…';
  }

  // ── Engine badge (conversation-level) ──────────────────────────────

  /**
   * Show the conversation-level engine badge. Called from tts:start when
   * the active speaker is a Local Chat bubble (i.e. activeBubbleBtn is
   * set — that flag is the Stage 3-established singleton-coexistence
   * guard against reacting to Image Describer's playback events).
   */
  function showLocalChatEngineBadge() {
    var badge = document.getElementById('local-chat-read-aloud-engine');
    if (!badge) return;
    var engine = (window.TTSController && typeof window.TTSController.getEngine === 'function')
      ? window.TTSController.getEngine()
      : 'webspeech';
    badge.textContent = engine === 'webspeech' ? 'Browser voice' : 'Natural voice';
    badge.hidden = false;
  }

  function hideLocalChatEngineBadge() {
    var badge = document.getElementById('local-chat-read-aloud-engine');
    if (!badge) return;
    badge.textContent = '';
    badge.hidden = true;
  }

  // ── Save-button HTML generator ─────────────────────────────────────

  /**
   * Add the Save-as-Audio split button to an assistant bubble's action
   * bar. Mirrors Image Describer's HTML structure (.imgdesc-save-audio-*
   * classes for visual styling; .local-chat-save-audio-* classes for
   * JS lookup to avoid colliding with Image Describer's IDs).
   *
   * The "Processed locally on your device" note is a sibling <small>
   * inside the bubble (but outside .local-chat-bubble-actions) — it has
   * display:block and reads as its own line below the action bar. Added
   * to the skipSelectors in getBubbleResultFast/getPreparedBubbleResult
   * so it's not read aloud or exported.
   */
  function addSaveAudioButton(bubble) {
    if (typeof window.TTSController === 'undefined' ||
        !window.TTSController.isAvailable()) {
      S.logDebug('TTSController not available — skipping Save Audio button');
      return;
    }

    var actions = getOrCreateActions(bubble);

    // Split-button container — Image Describer pattern, role="group".
    var split = document.createElement('span');
    split.className = 'imgdesc-save-audio-split';
    split.setAttribute('role', 'group');
    split.setAttribute('aria-label', 'Save audio');

    var main = document.createElement('button');
    main.type = 'button';
    main.className =
      'local-chat-save-audio-main imgdesc-save-audio-main local-chat-read-aloud';
    main.innerHTML =
      '<span aria-hidden="true" data-icon="download"></span>' +
      ' <span class="local-chat-save-audio-label">Save as MP3</span>';

    var formatBtn = document.createElement('button');
    formatBtn.type = 'button';
    formatBtn.className =
      'local-chat-save-audio-format imgdesc-format-toggle local-chat-read-aloud';
    formatBtn.innerHTML =
      '<span aria-hidden="true" data-icon="arrowDown"></span>' +
      '<span class="visually-hidden local-chat-save-audio-format-label">MP3</span>';

    split.appendChild(main);
    split.appendChild(formatBtn);
    actions.appendChild(split);
    if (typeof window.refreshIcons === 'function') window.refreshIcons(split);

    // Reassurance note — GDPR/UK education compliance signalling per
    // tts-semantic-rendering-guide.md §7. Skipped from TTS payload.
    var note = document.createElement('small');
    note.className = 'imgdesc-save-audio-note';
    note.textContent = 'Processed locally on your device.';
    bubble.appendChild(note);

    main.addEventListener('click', function () {
      handleLocalChatSaveAudioClick(bubble, main);
    });
    formatBtn.addEventListener('click', function () {
      // Refuse format changes mid-export — would relabel the running
      // button mid-stream and look like a bug.
      if (activeExportingBtn) return;
      var current = getLocalChatExportFormat();
      var next = current === 'mp3' ? 'wav' : 'mp3';
      setLocalChatExportFormat(next);
      if (typeof S.announceToScreenReader === 'function') {
        S.announceToScreenReader('Audio format set to ' + next.toUpperCase() + '.');
      }
    });

    // Initial state — disabled-with-reason until conditions are met.
    // Deferred to a microtask because Local Chat's post-response sequence
    // (local-chat.js after-receive block) flips S.isGenerating = false
    // AFTER calling addSaveAudioButton. A synchronous refresh here would
    // read isGenerating === true and disable the button while falling
    // into the base-label branch (no "with reason" tag) — confusing UI.
    // The microtask runs after the current synchronous task settles, by
    // which time isGenerating is correctly false.
    Promise.resolve().then(function () {
      refreshLocalChatSaveAudioEnabled(bubble);
    });
  }

  // ── Stage 4 event wiring ───────────────────────────────────────────

  /**
   * Register Stage 4 listeners on EmbedEventEmitter:
   *   - tts:start / tts:end / tts:error → engine badge (when a Local
   *     Chat bubble owns playback, i.e. activeBubbleBtn set).
   *   - tts:engineChanged / model:stateChange → recompute Save buttons.
   *   - tts:exportProgress / tts:exportEncodeProgress → update the
   *     actively-exporting bubble's label (filtered by activeExportingBtn).
   *
   * Engine-badge wiring lives here rather than in wireReadAloudEvents
   * because it's conceptually a Stage 4 control (companion to Save audio)
   * even though it reacts to Stage 3's speech events. Multiple listeners
   * on the same event are supported by EmbedEventEmitter.
   */
  function wireSaveAudioEvents() {
    if (!window.EmbedEventEmitter ||
        typeof window.EmbedEventEmitter.on !== 'function') {
      S.logWarn(
        'EmbedEventEmitter not available — Save Audio events will not be wired'
      );
      return;
    }

    window.EmbedEventEmitter.on('tts:start', function () {
      // Singleton-coexistence guard: only show our badge when a Local
      // Chat bubble triggered playback. Image Describer's tts:start
      // fires for its own button — activeBubbleBtn is null then.
      if (activeBubbleBtn) showLocalChatEngineBadge();
    });
    window.EmbedEventEmitter.on('tts:end', function () {
      hideLocalChatEngineBadge();
    });
    window.EmbedEventEmitter.on('tts:error', function () {
      hideLocalChatEngineBadge();
    });

    window.EmbedEventEmitter.on('tts:engineChanged', function () {
      hideLocalChatEngineBadge(); // engine changed mid-playback → hide stale label
      refreshAllSaveAudioButtons();
    });
    window.EmbedEventEmitter.on('model:stateChange', function (data) {
      if (data && data.category && data.category !== 'tts') return;
      refreshAllSaveAudioButtons();
    });

    window.EmbedEventEmitter.on('tts:exportProgress', onExportProgress);
    window.EmbedEventEmitter.on('tts:exportEncodeProgress', onExportEncodeProgress);

    S.logDebug('Save Audio TTS events wired');
  }

  wireSaveAudioEvents();

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
    addSaveAudioButton: addSaveAudioButton,
    addModelBadge: addModelBadge,
    addTimestamp: addTimestamp,
    addEditButton: addEditButton,
    regenerateLastResponse: regenerateLastResponse,
  };

  S.logInfo("Messages module loaded");
})();
