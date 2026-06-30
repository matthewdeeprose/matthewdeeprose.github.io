/**
 * Unified Chat Tool — step 5a (rich rendering + bubble helpers)
 *
 * Owns the Chat tool's message-bubble rendering. Supersedes the minimal inline
 * bubble helpers that chat/chat-core.js stood up in step 2; core now delegates
 * here. This file drives window.ChatState ONLY — it never calls any
 * window.LocalChat* / window.localChat* global and never touches
 * window.LocalChatState.
 *
 * It reuses Local Chat's CLASS names on the bubbles and typing indicator
 * (local-chat-bubble, local-chat-bubble-user, local-chat-bubble-assistant,
 * local-chat-typing, local-chat-typing-dot) so the styling can be shared later
 * without a CSS change. The per-turn model+provider badge is Chat-specific
 * (Local Chat shows model only), so it gets its OWN class —
 * chat-model-provider-badge — and is not shared.
 *
 * Loads AFTER chat/chat-core.js so window.ChatState (and core's globals) exist.
 *
 * @version 0.3.2 — step 5b-ii-fix-2: renderRichContent now wraps mermaid diagrams
 *                   for accessibility deterministically (initAccessibilityFeatures
 *                   per .mermaid-container) instead of relying on the visibility-gated
 *                   observer, which never fires for diagrams restored into the hidden
 *                   Chat panel. Self-guarded (no-op on already-wrapped live diagrams).
 *                   Builds on 5b-ii-fix: renderRichContent awaits the bridge's readiness
 *                   gate (ensureMarkdownEditorReady) before process(), so the
 *                   restore-on-load path no longer races the bridge's main.js boot
 *                   self-test through the shared debounce. Bounded — a never-ready
 *                   bridge degrades to the plain render. Warm send path is unaffected.
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
      args.unshift("[ChatMessages]");
      console.error.apply(console, args);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatMessages]");
      console.warn.apply(console, args);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatMessages]");
      console.log.apply(console, args);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatMessages]");
      console.log.apply(console, args);
    }
  }

  // ── State handle ─────────────────────────────────────────────────────────
  // Capture the state OBJECT once at load; chat/chat.js creates it synchronously
  // before this file's IIFE runs. Everything inside (S.els, S.messages) is read
  // LIVE through S at call time, never cached here.
  const S = window.ChatState;
  if (!S) {
    logError(
      "window.ChatState is missing — chat/chat.js + chat/chat-core.js must load before chat/chat-messages.js",
    );
    return;
  }

  // ── Provider label lookup (single source of truth: window.Chat.groupOrder) ──

  /**
   * Human-readable provider label for a providerId. Reads the picker's group
   * order/labels from window.Chat.groupOrder (the single source of truth), so
   * there is no duplicated label map here. Falls back to the raw providerId when
   * window.Chat / its groupOrder is missing at call time, or when no entry
   * matches, so the badge degrades to e.g. "azure-openai" rather than throwing.
   * @param {string} providerId
   * @returns {string}
   */
  function providerLabel(providerId) {
    const groupOrder = window.Chat && window.Chat.groupOrder;
    if (Array.isArray(groupOrder)) {
      const entry = groupOrder.find(function (g) {
        return g && g.providerId === providerId;
      });
      if (entry && entry.label) return entry.label;
    }
    return providerId || "Unknown provider";
  }

  /**
   * Resolve the model's DISPLAY NAME (not the raw id) the same way the picker
   * shows it. No dedicated single-model name-lookup helper exists on
   * EmbedModelSelector, so we derive the name from the picker's own rendered
   * <option> (its single source of truth for the label); if the option is not
   * present (e.g. filtered out), we ask EmbedModelSelector.getAllEligibleModels
   * for the unified list and match by id; failing both, we fall back to the raw
   * id.
   * @param {string} modelId the FULL model id (e.g. "local/…", "anthropic/…")
   * @returns {string} the display name, or the raw id as a last resort
   */
  function modelDisplayName(modelId) {
    if (!modelId) return "Unknown model";

    // Primary: the exact label the picker is currently showing for this id.
    const els = S.els;
    if (els && els.select && els.select.options) {
      const opts = els.select.options;
      for (let i = 0; i < opts.length; i++) {
        if (opts[i].value === modelId) return opts[i].textContent;
      }
    }

    // Secondary: ask the selector for the unified list and match by id.
    const selector = window.EmbedModelSelector;
    if (selector && typeof selector.getAllEligibleModels === "function") {
      try {
        const list = selector.getAllEligibleModels({ embed: S.embed });
        const found = list.find(function (m) {
          return m.id === modelId;
        });
        if (found && found.name) return found.name;
      } catch (err) {
        logWarn("model name lookup failed:", (err && err.message) || err);
      }
    }

    // Last resort: the raw id.
    return modelId;
  }

  // ── Bubble rendering ───────────────────────────────────────────────────────

  /**
   * Create and append a user message bubble. Plain text only — never HTML for
   * user input. Reuses Local Chat's class names so styling is shared later.
   * @param {string} text the user's message text
   * @param {number} [index] the message index in S.messages (stored for parity)
   * @returns {HTMLElement} the created bubble
   */
  function createUserBubble(text, index) {
    const els = S.els;
    const bubble = document.createElement("div");
    bubble.className = "local-chat-bubble local-chat-bubble-user";
    bubble.textContent = text; // plain text — never HTML for user input
    if (typeof index === "number") bubble.dataset.messageIndex = index;
    if (els.messageList) els.messageList.appendChild(bubble);
    return bubble;
  }

  /**
   * Create and append an empty assistant bubble. The embed streams its output
   * into this node; the badge is added on completion (addModelProviderBadge).
   * @returns {HTMLElement} the created bubble
   */
  function createAssistantBubble() {
    const els = S.els;
    const bubble = document.createElement("div");
    bubble.className = "local-chat-bubble local-chat-bubble-assistant";
    if (els.messageList) els.messageList.appendChild(bubble);
    return bubble;
  }

  /**
   * Append the animated typing indicator to a bubble while a reply streams.
   * Reuses Local Chat's class names (local-chat-typing / -dot).
   * @param {HTMLElement} bubble
   */
  function addTypingIndicator(bubble) {
    if (!bubble) return;
    const indicator = document.createElement("div");
    indicator.className = "local-chat-typing";
    indicator.setAttribute("role", "status");
    indicator.setAttribute("aria-label", "Generating response");
    indicator.innerHTML =
      '<span class="local-chat-typing-dot"></span>' +
      '<span class="local-chat-typing-dot"></span>' +
      '<span class="local-chat-typing-dot"></span>';
    bubble.appendChild(indicator);
  }

  /**
   * Remove the typing indicator from a bubble (no-op if absent).
   * @param {HTMLElement} bubble
   */
  function removeTypingIndicator(bubble) {
    if (!bubble) return;
    const indicator = bubble.querySelector(".local-chat-typing");
    if (indicator) indicator.remove();
  }

  /**
   * Pin the message list to the bottom so the latest content stays in view.
   */
  function scrollMessagesToBottom() {
    const els = S.els;
    if (!els.messageList) return;
    els.messageList.scrollTop = els.messageList.scrollHeight;
  }

  // ── Per-turn model + provider badge (Chat-specific) ─────────────────────────

  /**
   * Render the per-turn badge inside an assistant bubble, showing the model's
   * display NAME and the provider in human terms (e.g. "On your device",
   * "OpenRouter", "Microsoft Foundry"). The badge has its OWN class
   * (chat-model-provider-badge) since Local Chat has no provider badge to share.
   *
   * Accessibility: the badge text (model name + provider label) is real,
   * readable text — it is NOT hidden from screen readers. Only the decorative
   * separator between the two is aria-hidden.
   *
   * Inserted at the TOP of the bubble (before any streamed content), matching
   * Local Chat's addModelBadge convention.
   *
   * @param {HTMLElement} bubble the assistant bubble
   * @param {string} modelId the FULL model id stored on the turn (S.currentModel)
   * @param {string} providerId the provider id derived in core (providerIdFromModel)
   */
  function addModelProviderBadge(bubble, modelId, providerId) {
    if (!bubble) return;

    const name = modelDisplayName(modelId);
    const label = providerLabel(providerId);

    const badge = document.createElement("span");
    badge.className = "chat-model-provider-badge";

    const nameEl = document.createElement("span");
    nameEl.className = "chat-model-provider-badge-model";
    nameEl.textContent = name;

    // Decorative separator only — kept out of the screen-reader read so the
    // badge voices as "<model name> <provider label>".
    const sep = document.createElement("span");
    sep.className = "chat-model-provider-badge-sep";
    sep.setAttribute("aria-hidden", "true");
    sep.textContent = " · ";

    const provEl = document.createElement("span");
    provEl.className = "chat-model-provider-badge-provider";
    provEl.textContent = label;

    badge.appendChild(nameEl);
    badge.appendChild(sep);
    badge.appendChild(provEl);

    // Insert at the top of the bubble (before any content).
    bubble.insertBefore(badge, bubble.firstChild);

    logDebug("badge added —", name, "/", label, "(" + providerId + ")");
  }

  // ── Copy response button (ported from Local Chat) ───────────────────────────

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
      '<span aria-hidden="true" data-icon="clipboardCopy"></span> Copy';
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
              '<span aria-hidden="true" data-icon="clipboardCopy"></span> Copy';
          }, 2000);
        })
        .catch(function () {
          S.logWarn("Clipboard write failed");
        });
    });
    actions.appendChild(copyBtn);
  }

  // ── Copy formatted button (ported from Local Chat) ──────────────────────────

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
        ".local-chat-bubble-actions, .local-chat-timestamp, .chat-model-provider-badge",
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
        el.removeAttribute("data-chat-enhanced");
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

  // ── Timestamp (ported from Local Chat) ──────────────────────────────────────

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

  // ── Math accessibility (ported from Local Chat) ─────────────────────────────

  // Chat owns its own math a11y rather than relying on the global
  // mathPixEnhanceMathJax (which was built for MathPix mode). Mirrors the
  // minimum set of attributes enhanceSingleMathElement provides:
  //   • tabindex="0" for WCAG 2.1.1 scrollable-region focus
  //   • role="math" + aria-label for screen-reader announcement
  //   • Defuse mjx-containers nested inside <mjx-assistive-mml>/<mathml>
  //     so they cannot grab focus
  // Idempotent via data-chat-enhanced.
  function enhanceMathA11y(bubble) {
    if (!bubble) return;
    var containers = bubble.querySelectorAll("mjx-container");
    for (var i = 0; i < containers.length; i++) {
      var el = containers[i];
      if (el.getAttribute("data-chat-enhanced")) continue;
      if (el.closest("mjx-assistive-mml") || el.closest("mathml")) {
        el.setAttribute("tabindex", "-1");
        el.setAttribute("aria-hidden", "true");
        el.setAttribute("data-chat-enhanced", "duplicate");
        continue;
      }
      el.setAttribute("tabindex", "0");
      if (!el.hasAttribute("role")) {
        el.setAttribute("role", "math");
      }
      // Only synthesise a label when the maths arrives unlabelled. When the bridge
      // has already written a spoken SRE label, keep it — overwriting it with the
      // flattened textContent glyph string would degrade the screen-reader maths.
      if (!el.hasAttribute("aria-label")) {
        var label =
          (el.textContent || "").trim() ||
          "Mathematical expression " + (i + 1);
        el.setAttribute("aria-label", label + ". ");
      }
      el.setAttribute("data-chat-enhanced", "true");
    }
  }

  // ── Rich content rendering (markdown-it bridge) ─────────────────────────────

  async function renderRichContent(bubble, rawMarkdown) {
    if (!bubble) return;
    const bridge =
      (window.resultsManager &&
        window.resultsManager.contentProcessor &&
        window.resultsManager.contentProcessor.markdownItBridge) ||
      (window.MarkdownItBridge && window.MarkdownItBridge.instance) ||
      window.bridgeInstance ||
      null;
    if (!bridge || typeof bridge.process !== "function") {
      logWarn("markdown bridge unavailable — leaving the streamed plain render in place");
      return;
    }
    // The bridge can hand back its boot self-test output if process() runs during
    // the DOMContentLoaded tick (restore-on-load races the bridge's own main.js
    // integration test through the shared debounce). Wait for the bridge's readiness
    // gate first — it resolves after document.readyState is "complete", which also
    // defers us past that collision. Bounded, so a never-ready bridge degrades to the
    // plain render rather than hanging.
    if (typeof bridge.ensureMarkdownEditorReady === "function") {
      const READY_TIMEOUT_MS = 8000;
      let timer = null;
      const ready = await Promise.race([
        bridge.ensureMarkdownEditorReady().then(
          function (v) { return v; },
          function () { return false; },
        ),
        new Promise(function (resolve) {
          timer = setTimeout(function () { resolve("timeout"); }, READY_TIMEOUT_MS);
        }),
      ]);
      if (timer) clearTimeout(timer);
      if (ready === "timeout" || ready === false) {
        logWarn(
          "markdown bridge not ready (" + ready + ") — leaving the streamed plain render in place",
        );
        return;
      }
    }
    try {
      const html = await bridge.process(rawMarkdown);
      bubble.innerHTML = html; // replace the embed's plain render ONLY on success
      if (typeof bridge.processPendingCharts === "function") {
        bridge.processPendingCharts(bubble);
      }
      if (typeof bridge.initializePendingCharts === "function") {
        bridge.initializePendingCharts(bubble);
      }
      // Wrap any mermaid diagrams for accessibility (figure + caption + long
      // description) deterministically, rather than relying on MermaidAccessibility's
      // visibility-gated IntersectionObserver — restored bubbles are built while the
      // Chat panel is hidden, so the observer never fires for them. The feature
      // self-guards on data-accessibility-initialized, so this is a no-op on any
      // diagram the observer already wrapped on the live path.
      if (
        window.MermaidAccessibility &&
        typeof window.MermaidAccessibility.initAccessibilityFeatures === "function"
      ) {
        const mermaidContainers = bubble.querySelectorAll(".mermaid-container");
        mermaidContainers.forEach(function (container, i) {
          try {
            const diagramId =
              container.id || "chat-mermaid-" + Date.now() + "-" + i;
            window.MermaidAccessibility.initAccessibilityFeatures(
              container,
              diagramId,
            );
          } catch (e) {
            logWarn(
              "mermaid accessibility wrap failed for a diagram:",
              (e && e.message) || e,
            );
          }
        });
      }
      enhanceMathA11y(bubble);
    } catch (err) {
      logWarn(
        "bridge render failed — keeping the streamed plain render:",
        (err && err.message) || err,
      );
    }
  }

  // ── Shared assistant-turn render (live + restore parity) ────────────────────

  /**
   * Build a complete assistant bubble from one code path, so the live send path
   * (chat-core.js postGeneration) and the restore path (step 5b-i) produce
   * identical bubbles. Renders the rich accessible body FIRST (replacing any
   * plain render), THEN adds the badge and controls — addModelProviderBadge
   * inserts before the bubble's first child, so it must land on the rich content.
   * Idempotent icon population (refreshIcons) fills the badge + button glyphs.
   * @param {HTMLElement} bubble the assistant bubble
   * @param {string} content the raw markdown reply
   * @param {string} model the FULL model id stored on the turn
   * @param {string} providerId the provider id (providerIdFromModel)
   * @param {number} index the message index in S.messages (for copy)
   */
  async function renderAssistantTurn(bubble, content, model, providerId, index) {
    if (!bubble) return;
    // Rich accessible body first (replaces any plain render); badge and controls
    // are added AFTER, because addModelProviderBadge inserts before the bubble's
    // first child and must land on the rich content.
    await renderRichContent(bubble, content);
    window.ChatMessages.addModelProviderBadge(bubble, model, providerId);
    window.ChatMessages.addCopyButton(bubble, index);
    window.ChatMessages.addFormattedCopyButton(bubble, index);
    window.ChatMessages.addTimestamp(bubble);
    if (typeof window.refreshIcons === "function") {
      window.refreshIcons(bubble);
    }
  }

  // ── Expose module ──────────────────────────────────────────────────────────

  window.ChatMessages = {
    createUserBubble: createUserBubble,
    createAssistantBubble: createAssistantBubble,
    addTypingIndicator: addTypingIndicator,
    removeTypingIndicator: removeTypingIndicator,
    scrollMessagesToBottom: scrollMessagesToBottom,
    addModelProviderBadge: addModelProviderBadge,
    addCopyButton: addCopyButton,
    addFormattedCopyButton: addFormattedCopyButton,
    addTimestamp: addTimestamp,
    renderRichContent: renderRichContent,
    renderAssistantTurn: renderAssistantTurn,
    // Exposed for inspection/testing.
    _modelDisplayName: modelDisplayName,
    _providerLabel: providerLabel,
    _enhanceMathA11y: enhanceMathA11y,
  };

  logInfo("Messages module loaded");
})();
