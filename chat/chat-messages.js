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
    // Edit affordance (step 6). Added only when we have a numeric index to edit
    // against. Because both the live send path and chat-persistence.js's
    // rebuildMessageList() funnel user turns through here, live AND restored user
    // bubbles get the button from this one code path — never at the call sites.
    if (typeof index === "number") addEditButton(bubble, index);
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

  // ── Message editing (step 6) ────────────────────────────────────────────────
  // Slice 1: the user-turn edit affordance only — swap the bubble for a labelled
  // textarea and a Cancel button, and restore on Cancel. NO Re-send, NO thread
  // truncation, NO send-path change in this slice; those land in later slices.
  //
  // The wording, the HIDE_CLASS, and the cancel focus target are isolated here
  // deliberately so they are one-line changes.
  const EDIT_BUTTON_LABEL = "Edit";
  const EDIT_BUTTON_RESEND_LABEL = "Re-send";
  const EDIT_TEXTAREA_LABEL = "Edit your message";
  const EDIT_ANNOUNCE_ENTER = "Editing your message.";
  const EDIT_ANNOUNCE_CANCEL = "Edit cancelled.";
  const EDIT_ANNOUNCE_COMMIT =
    "Message updated. Later messages removed. Generating a new response.";
  // Visually-hidden utility class (main.css) — used to name the edit textarea.
  const HIDE_CLASS = "visually-hidden";

  /**
   * Append an Edit button to a user bubble. The icon is decorative (aria-hidden);
   * the visible "Edit" text is always present as the button's accessible name.
   * @param {HTMLElement} bubble the user bubble
   * @param {number} messageIndex the turn's index in S.messages
   */
  function addEditButton(bubble, messageIndex) {
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "local-chat-edit-btn";
    editBtn.innerHTML =
      '<span aria-hidden="true" data-icon="pencil"></span> ' + EDIT_BUTTON_LABEL;
    editBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      enterEditMode(bubble);
    });
    bubble.appendChild(editBtn);
    // Populate the pencil glyph (injected via innerHTML; the auto-populator only
    // runs once at DOMContentLoaded), mirroring renderAssistantTurn.
    if (typeof window.refreshIcons === "function") {
      window.refreshIcons(bubble);
    }
  }

  /**
   * Swap a user bubble for a labelled edit textarea and a Cancel button. One edit
   * at a time; never while a generation is in flight. Clearing innerHTML below
   * does not remove dataset.messageIndex (an attribute), so it survives for cancel.
   * @param {HTMLElement} bubble the user bubble being edited
   */
  function enterEditMode(bubble) {
    if (S.isGenerating) return;
    if (S.editingBubble) return; // already editing another bubble

    const msgIndex = parseInt(bubble.dataset.messageIndex, 10);
    if (isNaN(msgIndex) || !S.messages[msgIndex]) return;

    S.editingBubble = bubble;
    const originalText = S.messages[msgIndex].content;

    bubble.innerHTML = "";
    bubble.classList.add("local-chat-bubble-editing");

    // Accessible name via a visually-hidden <label> tied by id.
    const taId = S.elId("edit-textarea-" + msgIndex);
    const label = document.createElement("label");
    label.className = HIDE_CLASS;
    label.htmlFor = taId;
    label.textContent = EDIT_TEXTAREA_LABEL;

    const textarea = document.createElement("textarea");
    textarea.id = taId;
    textarea.className = "local-chat-edit-textarea";
    textarea.value = originalText;
    textarea.rows = Math.min(
      8,
      Math.max(2, originalText.split("\n").length + 1),
    );

    bubble.appendChild(label);
    bubble.appendChild(textarea);

    // Buttons bar — Re-send (primary action first) then Cancel.
    const btnBar = document.createElement("div");
    btnBar.className = "local-chat-edit-buttons";

    const resendBtn = document.createElement("button");
    resendBtn.type = "button";
    resendBtn.className = "local-chat-edit-resend";
    resendBtn.textContent = EDIT_BUTTON_RESEND_LABEL;
    resendBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      commitEdit(bubble, msgIndex, textarea.value.trim());
    });
    btnBar.appendChild(resendBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "local-chat-edit-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      cancelEdit(bubble);
    });
    btnBar.appendChild(cancelBtn);
    bubble.appendChild(btnBar);

    S.announceToScreenReader(EDIT_ANNOUNCE_ENTER);
    textarea.focus();
    logDebug("edit mode entered for turn", msgIndex);
  }

  /**
   * Restore a user bubble from its stored message text (NOT stashed innerHTML), so
   * the re-attached Edit button's click listener is live and not orphaned.
   * @param {HTMLElement} bubble the bubble being cancelled
   */
  function cancelEdit(bubble) {
    if (!bubble) return;
    const msgIndex = parseInt(bubble.dataset.messageIndex, 10);

    bubble.classList.remove("local-chat-bubble-editing");
    bubble.innerHTML = "";
    if (!isNaN(msgIndex) && S.messages[msgIndex]) {
      bubble.textContent = S.messages[msgIndex].content; // mirrors createUserBubble
    }
    addEditButton(bubble, msgIndex); // fresh, live button
    S.editingBubble = null;

    S.announceToScreenReader(EDIT_ANNOUNCE_CANCEL);
    // Cancel focus target (easy to change): the freshly re-attached Edit button.
    const btn = bubble.querySelector(".local-chat-edit-btn");
    if (btn) btn.focus();
    logDebug("edit cancelled for turn", msgIndex);
  }

  /**
   * Commit an edited user turn: rewrite the turn, drop the old reply and every
   * later turn, re-render the bubble to rest, persist the truncated thread, and
   * regenerate through the shared send back half. An empty edit discards (like
   * Cancel) and sends nothing.
   * @param {HTMLElement} bubble the user bubble being committed
   * @param {number} msgIndex the turn's index in S.messages
   * @param {string} newText the trimmed edited text
   */
  function commitEdit(bubble, msgIndex, newText) {
    if (!newText) {
      cancelEdit(bubble); // empty edit discards, does not send
      return;
    }

    // These two lines mirror the front-half send-setup dispatchSend deliberately
    // does not own. "off" silences the message-list live log for the DOM surgery
    // below and the streamed reply that follows.
    S.setMessageListLive("off");
    S.isGenerating = true;

    // Rewrite the edited turn, then truncate: the slice drops the edited turn's
    // old reply and every later turn. dispatchSend reads this truncated S.messages
    // live at send time, so the token window re-applies to the new payload.
    S.messages[msgIndex].content = newText;
    S.messages = S.messages.slice(0, msgIndex + 1);

    // Remove the on-screen bubbles after the edited one. Capture the next
    // reference BEFORE removing, and only remove siblings carrying the bubble
    // class — any non-bubble control (e.g. a scroll-to-bottom button) stays put.
    let sibling = bubble.nextElementSibling;
    while (sibling) {
      const next = sibling.nextElementSibling;
      if (sibling.classList.contains("local-chat-bubble")) {
        sibling.remove();
      }
      sibling = next;
    }

    // Rebuild the edited bubble to its resting shape (same construction as
    // cancelEdit). dataset.messageIndex persists through innerHTML changes, so the
    // re-attached Edit button resolves the same index.
    bubble.classList.remove("local-chat-bubble-editing");
    bubble.innerHTML = "";
    bubble.textContent = newText;
    addEditButton(bubble, msgIndex);

    S.editingBubble = null;

    // Persist the truncated thread now, so a failed re-send still leaves the
    // correct saved state.
    window.ChatPersistence.saveSession();

    // Refresh conversation-state UI through the single seam.
    window.ChatCore._updateConversationUI();

    // Regenerate through the shared send back half: disableSend, the assistant
    // bubble, the token window over the truncated thread, the send, and
    // postGeneration (pushes the assistant turn, renders the badge from the
    // CURRENT S.currentModel, re-enables and refocuses the input, saves, announces).
    window.ChatCore._dispatchSend({ userPrompt: newText });

    // Placed AFTER _dispatchSend deliberately: the last write to the shared
    // announcer region wins, so this supersedes dispatchSend's generic cue.
    S.announceToScreenReader(EDIT_ANNOUNCE_COMMIT);

    // Commit focus target (easy to change): the edited bubble's fresh Edit button.
    // The input is refocused on completion by enableSend.
    const editBtn = bubble.querySelector(".local-chat-edit-btn");
    if (editBtn) editBtn.focus();

    logDebug("edit committed for turn", msgIndex);
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
    addEditButton: addEditButton,
    enterEditMode: enterEditMode,
    cancelEdit: cancelEdit,
    commitEdit: commitEdit,
    // Exposed for inspection/testing.
    _modelDisplayName: modelDisplayName,
    _providerLabel: providerLabel,
    _enhanceMathA11y: enhanceMathA11y,
  };

  logInfo("Messages module loaded");
})();
