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

  // ── Multimodal content helpers (Unified Chat attachments, checkpoint 1) ─────
  //
  // A user turn's content is EITHER a string (text-only, unchanged from before)
  // OR a multimodal array: an image part plus a text part, e.g.
  //   [ { type:"image_url", image_url:{ url:"data:…" } }, { type:"text", text } ]
  // On restore the image part is a BYTE-FREE reference from ChatAttach.buildReference:
  //   [ { kind:"image", filename, mimeType, size }, { type:"text", text } ]
  // These helpers read both shapes; string turns fall straight through untouched.

  function isMultimodalContent(content) {
    return Array.isArray(content);
  }

  /** Concatenate the text parts (and bare strings) of array content into one string. */
  function extractUserText(content) {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    const parts = [];
    for (const p of content) {
      if (typeof p === "string") parts.push(p);
      else if (p && p.type === "text" && typeof p.text === "string") parts.push(p.text);
    }
    return parts.join("");
  }

  /**
   * Classify the attachment element of array content — image OR pdf:
   *   { kind:"live", media:"image", url }                       — a live image turn (has base64 bytes)
   *   { kind:"live", media:"pdf", filename }                    — a live pdf turn (bytes carried in the file part)
   *   { kind:"reference", media:"image", filename, mimeType, size } — a restored, byte-free image reference
   *   { kind:"reference", media:"pdf", filename, mimeType, size }   — a restored, byte-free pdf reference
   *   null                                                      — no attachment element present
   */
  function classifyAttachmentPart(content) {
    if (!Array.isArray(content)) return null;
    for (const p of content) {
      if (!p || typeof p !== "object") continue;
      if (p.type === "image_url") {
        const url =
          p.image_url && typeof p.image_url === "object"
            ? p.image_url.url
            : typeof p.image_url === "string"
              ? p.image_url
              : null;
        if (typeof url === "string" && url) return { kind: "live", media: "image", url: url };
      }
      if (p.type === "file") {
        return {
          kind: "live",
          media: "pdf",
          filename: (p.file && p.file.filename) || "Document",
        };
      }
      if (p.kind === "image") {
        return {
          kind: "reference",
          media: "image",
          filename: p.filename,
          mimeType: p.mimeType,
          size: p.size,
        };
      }
      if (p.kind === "pdf") {
        return {
          kind: "reference",
          media: "pdf",
          filename: p.filename,
          mimeType: p.mimeType,
          size: p.size,
        };
      }
    }
    return null;
  }

  /**
   * Rewrite ONLY the text of array content, preserving every non-text part (the
   * image, live or reference) untouched — used when an image-bearing turn is
   * edited. v1 never re-attaches on edit, so the image element carries through
   * verbatim; order becomes [image…, text] to match the send-build order.
   */
  function setTextOfArrayContent(content, newText) {
    const nonText = content.filter(function (p) {
      if (typeof p === "string") return false;
      if (p && p.type === "text") return false;
      return true; // keep image_url parts, reference objects, anything non-text
    });
    return nonText.concat([{ type: "text", text: newText }]);
  }

  /**
   * Build the in-bubble attachment chip. DISPLAY ONLY — no remove control on a
   * committed turn (removing part of a sent/restored message would desync
   * S.messages, and v1 leaves a turn's image untouched). The pre-send preview
   * chip (chat-attach.js) is where an attachment is removed BEFORE it is sent.
   */
  function buildBubbleAttachmentChip(att) {
    const chip = document.createElement("span");
    chip.className = "chat-bubble-attachment";

    if (att.kind === "live" && att.media === "image") {
      const thumb = document.createElement("img");
      thumb.className = "chat-bubble-attachment-thumb";
      thumb.src = att.url;
      // No description is available for a user's own upload — an honest, non-empty
      // alt so the image is announced rather than skipped.
      thumb.alt = "Attached image";
      chip.appendChild(thumb);
      return chip;
    }

    // Icon + label chip: a reference (restored image/pdf, no bytes) or a live pdf
    // (present this session, so no "not restored" suffix). The reference class is
    // layout-only (currently unstyled), so it is safe to reuse for the live pdf.
    chip.classList.add("chat-bubble-attachment-reference");
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("data-icon", att.media === "pdf" ? "pdf" : "image");
    chip.appendChild(icon);
    const label = document.createElement("span");
    const fallbackName = att.media === "pdf" ? "Document" : "Image";
    const filename = att.filename || fallbackName;
    label.textContent =
      att.kind === "reference" ? filename + " — attached, not restored" : filename;
    chip.appendChild(label);
    // data-icon injected dynamically — populate now (auto-populator ran at load).
    if (window.IconLibrary && typeof window.IconLibrary.populateIcons === "function") {
      window.IconLibrary.populateIcons(chip);
    } else if (typeof window.refreshIcons === "function") {
      window.refreshIcons(chip);
    }
    return chip;
  }

  /**
   * Render a user turn's resting content into a bubble. String content is written
   * byte-identically to before (bubble.textContent). Array content renders the
   * text part plus the attachment chip. Shared by createUserBubble, cancelEdit and
   * commitEdit so live and restored turns render the same way.
   */
  function renderUserContent(bubble, content) {
    if (!isMultimodalContent(content)) {
      bubble.textContent = content; // text-only path — unchanged
      return;
    }
    const textSpan = document.createElement("span");
    textSpan.className = "chat-bubble-user-text";
    textSpan.textContent = extractUserText(content); // textContent — never HTML
    bubble.appendChild(textSpan);
    const att = classifyAttachmentPart(content);
    if (att) bubble.appendChild(buildBubbleAttachmentChip(att));
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
    // `text` is EITHER a string (text-only) OR a multimodal array (image + text).
    // renderUserContent keeps the string path byte-identical and renders the chip
    // for arrays — never HTML for user-supplied text.
    renderUserContent(bubble, text);
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
          logWarn("Clipboard write failed");
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
        ".local-chat-bubble-actions, .local-chat-timestamp, .chat-model-provider-badge, .chat-response-clamp-controls",
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
        logWarn("Clipboard write failed for formatted copy");
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

  // ── Read Aloud (TTS) — ported from Local Chat ───────────────────────────────
  // The manual Read Aloud button and its plumbing come across here. Save-as-audio
  // (the split button, engine badge, format toggle and the activeExportingBtn
  // export lock) is ported in its own section below, placed AFTER Read Aloud so it
  // can share the module-local activeBubbleBtn and the read-aloud helpers.

  // Module-local active-speaker flag: tracks the currently-speaking bubble's
  // button so the shared TTS events only ever update the right one. Deliberately
  // NOT a window global — a stray second speaker must never be able to reach in.
  let activeBubbleBtn = null;

  /**
   * Stop Chat's own read-aloud IF one of our bubbles is currently speaking.
   * activeBubbleBtn is Chat's ownership signal: it is only non-null while a Chat
   * bubble owns the shared TTS engine. Guarding on it means clearing or editing
   * in Chat stops only Chat's own speech, and never cuts off Local Chat or any
   * other tool mid-sentence. We deliberately do NOT reassign or null
   * activeBubbleBtn here — the tts:end handler in wireReadAloudEvents already
   * resets the button to idle and clears the flag, so we mirror that pattern
   * rather than duplicate the clearing.
   */
  function stopReadAloudIfActive() {
    if (!activeBubbleBtn) return; // nothing of ours is speaking
    if (window.TTSController && typeof window.TTSController.stop === "function") {
      window.TTSController.stop();
    }
  }

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
    // Use semantic lineariser if available. The .imgdesc-save-audio-note sibling
    // (".Processed locally on your device.") stays in the skip list ahead of the
    // save-audio slice — it lives inside the bubble for layout but must never be
    // read aloud or exported. The badge class is Chat's own
    // (.chat-model-provider-badge), swapped in from Local Chat's
    // .local-chat-model-badge.
    if (
      window.TTSSemantic &&
      typeof window.TTSSemantic.linearise === "function"
    ) {
      const result = window.TTSSemantic.linearise(bubble, {
        verbosity: window.TTSSemantic.getVerbosity(),
        skipSelectors:
          ".local-chat-bubble-actions, .chat-model-provider-badge, .local-chat-timestamp, .imgdesc-save-audio-note, .chat-response-clamp-controls",
      });
      if (result && result.text) return result;
    }

    // Fallback: clone-and-strip approach (no sections — controller uses legacy chunking)
    const clone = bubble.cloneNode(true);
    const remove = clone.querySelectorAll(
      ".local-chat-bubble-actions, .chat-model-provider-badge, .local-chat-timestamp, .imgdesc-save-audio-note, .chat-response-clamp-controls",
    );
    for (let i = 0; i < remove.length; i++) remove[i].remove();
    const plainText = (clone.innerText || clone.textContent || "").trim();
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
    if (
      window.TTSRewriters &&
      typeof window.TTSRewriters.preparePanelForTts === "function"
    ) {
      return window.TTSRewriters.preparePanelForTts(bubble);
    }
    logWarn(
      "TTSRewriters.preparePanelForTts not available — returning unmodified clone",
    );
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
      if (
        window.TTSSemantic &&
        typeof window.TTSSemantic.linearise === "function"
      ) {
        const result = window.TTSSemantic.linearise(target, {
          verbosity: window.TTSSemantic.getVerbosity(),
          // Same skipSelectors as the sync path — never read action bar,
          // badge, timestamp, or the "Processed locally on your device"
          // reassurance note aloud. Plus belt-and-braces math source-format
          // guards in case any leaked past the math pass.
          skipSelectors:
            ".local-chat-bubble-actions, .chat-model-provider-badge, .local-chat-timestamp, .imgdesc-save-audio-note, .chat-response-clamp-controls, mathml, asciimath, latex",
        });
        if (result && result.text) return result;
      }
      const plain = (target.innerText || target.textContent || "").trim();
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
    const label = btn.querySelector(".local-chat-read-aloud-label");
    const icon = btn.querySelector("[data-icon]");
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
   * Add a Read Aloud button to an assistant bubble's action bar. Reuses Local
   * Chat's local-chat-read-aloud / local-chat-read-aloud-label classes so the
   * styling comes from the already-loaded local-chat.css with no CSS change.
   */
  function addReadAloudButton(bubble) {
    if (
      typeof window.TTSController === "undefined" ||
      !window.TTSController.isAvailable()
    ) {
      logDebug("TTSController not available — skipping Read Aloud button");
      return;
    }

    // Preload the neural TTS model in the background if applicable.
    if (typeof window.TTSController.preloadIfNeeded === "function") {
      try {
        window.TTSController.preloadIfNeeded();
      } catch (e) {
        logDebug("preloadIfNeeded threw (non-critical): " + e.message);
      }
    }

    const actions = getOrCreateActions(bubble);
    const btn = document.createElement("button");
    btn.className = "local-chat-read-aloud";
    btn.setAttribute("data-tts-state", "idle");
    btn.innerHTML =
      '<span aria-hidden="true" data-icon="message"></span> <span class="local-chat-read-aloud-label">Read Aloud</span>';
    if (typeof window.refreshIcons === "function") window.refreshIcons(btn);
    actions.appendChild(btn);

    btn.addEventListener("click", function () {
      const state = btn.getAttribute("data-tts-state");
      switch (state) {
        case "idle":
          // Cheap synchronous text-presence check first — don't disrupt an
          // already-speaking bubble if this one has nothing to read.
          const preflight = getBubbleResultFast(bubble);
          if (!preflight || !preflight.text) return;

          // Stop any other bubble that is currently speaking. tts:end will
          // fire and the wired listener will reset that bubble's button to
          // idle, then clear the previous activeBubbleBtn. Stopping BEFORE we
          // claim activeBubbleBtn is the intended single-speaker behaviour.
          window.TTSController.stop();
          activeBubbleBtn = btn;

          // Skip the LOADING frame on cache-hit clicks (SRE already cached).
          // Mirrors the Image Describer Stage 1 UX — the prepare-pipeline
          // resolves so quickly when SRE is warm that showing "Preparing…"
          // would be visual noise.
          const sreCached = !!(
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
              logError("Bubble prepare-pipeline failed", err);
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
   * Every handler is guarded on the module-local activeBubbleBtn, so a speaker
   * owned by another panel (e.g. Image Describer) never disturbs Chat's buttons.
   */
  function wireReadAloudEvents() {
    if (
      !window.EmbedEventEmitter ||
      typeof window.EmbedEventEmitter.on !== "function"
    ) {
      logWarn(
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

    logDebug("Read Aloud TTS events wired");
  }

  // Initialise event wiring once.
  wireReadAloudEvents();

  // ── Save as Audio (TTS companion controls) — ported from Local Chat ─────────
  //
  // Per-bubble Save-as-MP3/WAV button mirroring the Image Describer pattern
  // (tts-read-aloud.js §5.1). Distinct from Image Describer's single-output
  // model, Chat has many bubbles each with its own Save button. State tracking:
  //   activeBubbleBtn        — currently speaking bubble (Read Aloud, above).
  //   activeExportingBtn     — currently exporting bubble (here).
  // Both are independent: a user can listen to bubble A while exporting B.
  //
  // Panel-level export lock: TTSController.exportMp3/exportWav have NO internal
  // concurrency guard. We enforce one-at-a-time at the panel level via
  // activeExportingBtn. While set, every other bubble's Save button is disabled
  // (the refresh predicate gates on it).
  //
  // The localStorage key is Chat-scoped ("chat-tts-export-format") so Chat and
  // Local Chat keep independent format defaults. The engine badge is
  // conversation-level (one #chat-read-aloud-engine span, added in slice 4);
  // Save buttons are per-bubble.

  const EXPORT_FORMAT_KEY = "chat-tts-export-format";
  const DEFAULT_EXPORT_FORMAT = "mp3";

  /** Currently-exporting bubble's main Save button — panel-level lock. */
  let activeExportingBtn = null;

  // ── Format toggle (MP3 ↔ WAV) ──────────────────────────────────────

  function getChatExportFormat() {
    try {
      const stored = localStorage.getItem(EXPORT_FORMAT_KEY);
      if (stored === "wav" || stored === "mp3") return stored;
    } catch (e) {
      /* localStorage unavailable */
    }
    return DEFAULT_EXPORT_FORMAT;
  }

  function setChatExportFormat(format) {
    if (format !== "wav" && format !== "mp3") return;
    try {
      localStorage.setItem(EXPORT_FORMAT_KEY, format);
    } catch (e) {
      /* localStorage unavailable */
    }
    refreshAllChatSaveAudioButtons();
  }

  /**
   * Sync a single Save button's labels to the current format. Called by
   * refreshChatSaveAudioEnabled when the button is in its "ready" branch
   * (text present, engine = neural, model loaded, no other export).
   * Disabled-with-reason branches override the label themselves.
   */
  function refreshSaveButtonFormatLabels(btn) {
    if (!btn) return;
    const label = btn.querySelector(".chat-save-audio-label");
    const formatBtn = btn.parentElement
      ? btn.parentElement.querySelector(".chat-save-audio-format")
      : null;
    const formatLabel = formatBtn
      ? formatBtn.querySelector(".chat-save-audio-format-label")
      : null;
    const format = getChatExportFormat();
    const upper = format.toUpperCase();
    if (label) label.textContent = "Save as " + upper;
    btn.setAttribute("aria-label", "Save bubble as " + upper + " audio file");
    if (formatLabel) formatLabel.textContent = upper;
    if (formatBtn) {
      formatBtn.setAttribute(
        "aria-label",
        "Change audio format. Currently " + upper + ".",
      );
    }
  }

  // ── Per-bubble enabled-state predicate ─────────────────────────────

  /**
   * Recompute a single bubble's Save button enabled state + label and
   * apply it. Mirrors tts-read-aloud.js refreshSaveAudioEnabled with two
   * additions:
   *   1) The panel-level export lock — if another bubble is exporting,
   *      this bubble's Save button is disabled.
   *   2) "Empty bubble" (no text yet) — disabled. Chat bubbles can exist
   *      briefly with only a typing indicator.
   *
   * Does not touch the in-flight visuals (Generating… / Encoding MP3 X%…)
   * — those are the click handler's responsibility. The click handler
   * calls this in its finally to restore the resting label.
   */
  function refreshChatSaveAudioEnabled(bubble) {
    if (!bubble) return;
    const btn = bubble.querySelector(".chat-save-audio-main");
    const formatBtn = bubble.querySelector(".chat-save-audio-format");
    if (!btn) return;
    // Don't disturb the in-flight visuals — the click handler owns the
    // disabled flag while activeExportingBtn === btn.
    if (activeExportingBtn === btn) return;

    const label = btn.querySelector(".chat-save-audio-label");
    const format = getChatExportFormat();
    const upper = format.toUpperCase();

    const preflight = getBubbleResultFast(bubble);
    const hasText = !!(preflight && preflight.text);
    const isGenerating = !!S.isGenerating;
    const engine =
      window.TTSController &&
      typeof window.TTSController.getEngine === "function"
        ? window.TTSController.getEngine()
        : "webspeech";
    const isNeural = engine !== "webspeech";
    let modelReady = false;
    if (
      isNeural &&
      window.TTSNeuralGateway &&
      typeof window.TTSNeuralGateway.getModelState === "function"
    ) {
      const state = window.TTSNeuralGateway.getModelState("supertonic");
      modelReady = state === "loaded" || state === "cached";
    }
    const someoneElseExporting =
      activeExportingBtn && activeExportingBtn !== btn;

    const canExport =
      hasText && !isGenerating && isNeural && modelReady && !someoneElseExporting;
    btn.disabled = !canExport;
    if (formatBtn) formatBtn.disabled = !canExport;

    // Label nudges users to the action required (most-specific first).
    if (!isNeural) {
      if (label)
        label.textContent = "Save as " + upper + " (requires natural voice)";
      btn.setAttribute(
        "aria-label",
        "Save as " + upper + " — requires natural voice engine",
      );
    } else if (!modelReady) {
      if (label) label.textContent = "Save as " + upper + " (model loading…)";
      btn.setAttribute(
        "aria-label",
        "Save as " + upper + " — model is loading",
      );
    } else if (someoneElseExporting) {
      if (label)
        label.textContent = "Save as " + upper + " (another export running)";
      btn.setAttribute(
        "aria-label",
        "Save as " + upper + " — another export is in progress",
      );
    } else {
      refreshSaveButtonFormatLabels(btn);
    }
  }

  // Chat's assistant bubbles reuse the local-chat-bubble-assistant class, so Local
  // Chat's page-wide save-audio sweep can reach Chat's bubbles. Chat-specific lookup
  // classes (chat-save-audio-*) mean each tool's per-bubble query finds only its own
  // buttons, so neither tool's refresh disturbs the other's Save button. This refresh
  // is additionally scoped to Chat's own message container rather than a page-wide
  // query, so it never even iterates Local Chat's bubbles.
  function refreshAllChatSaveAudioButtons() {
    const container = document.getElementById(S.elId("messages"));
    if (!container) return;
    const bubbles = container.querySelectorAll(".local-chat-bubble-assistant");
    for (let i = 0; i < bubbles.length; i++) {
      refreshChatSaveAudioEnabled(bubbles[i]);
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
   * refreshChatSaveAudioEnabled(bubble) in the finally block.
   */
  function handleChatSaveAudioClick(bubble, btn) {
    if (!window.TTSController) {
      logWarn("TTSController not available");
      return;
    }

    // Panel-level export lock — at most one export in flight.
    if (activeExportingBtn && activeExportingBtn !== btn) {
      if (typeof window.notifyWarning === "function") {
        window.notifyWarning(
          "Another audio export is already in progress. Please wait for it to finish.",
        );
      }
      return;
    }

    const format = getChatExportFormat();
    const exportFn =
      format === "mp3"
        ? window.TTSController.exportMp3
        : window.TTSController.exportWav;
    if (typeof exportFn !== "function") {
      logWarn("TTSController.export" + format.toUpperCase() + " not available");
      return;
    }

    // Cheap synchronous text-presence check — don't lock the UI for a
    // bubble with nothing to export. The actual payload sent to the
    // controller is the Clearspeak-rewritten one from getPreparedBubbleResult.
    const preflight = getBubbleResultFast(bubble);
    if (!preflight || !preflight.text) {
      logWarn("No text to export");
      return;
    }

    const label = btn.querySelector(".chat-save-audio-label");
    const icon = btn.querySelector("[data-icon]");
    const formatBtn = bubble.querySelector(".chat-save-audio-format");

    // Claim the panel lock and lock the clicked button immediately.
    activeExportingBtn = btn;
    btn.disabled = true;
    if (formatBtn) formatBtn.disabled = true;
    if (label) label.textContent = "Generating…";
    if (icon) {
      icon.setAttribute("data-icon", "hourglass");
      if (typeof window.refreshIcons === "function") window.refreshIcons(icon);
    }
    // Cascade-disable every other bubble's Save button via the refresh
    // predicate (which gates on activeExportingBtn).
    refreshAllChatSaveAudioButtons();
    if (typeof S.announceToScreenReader === "function") {
      S.announceToScreenReader(
        "Generating " + format.toUpperCase() + " audio file.",
      );
    }

    getPreparedBubbleResult(bubble)
      .then(function (result) {
        if (!result || !result.text) {
          throw new Error("No text to export after rewriter pipeline");
        }
        return exportFn.call(window.TTSController, result);
      })
      .then(function () {
        if (typeof S.announceToScreenReader === "function") {
          S.announceToScreenReader("Audio file saved.");
        }
        if (typeof window.notifySuccess === "function") {
          window.notifySuccess("Audio file saved successfully.");
        }
        // Reassurance note (tts-semantic-rendering-guide.md §7), added ONLY after
        // a successful save and scoped to the AUDIO, not the reply: the
        // Save-as-Audio path can only run through the on-device neural engine
        // (webspeech is rejected for export) and the WAV/MP3 encode is in-browser,
        // so the saved file is produced on your device. Idempotent — one note per
        // bubble across repeat saves. Kept out of the TTS payload and export by
        // its class (.imgdesc-save-audio-note).
        if (!bubble.querySelector(".imgdesc-save-audio-note")) {
          const note = document.createElement("small");
          note.className = "imgdesc-save-audio-note";
          note.textContent = "Audio generated on your device.";
          bubble.appendChild(note);
        }
      })
      .catch(function (err) {
        logError("Audio export failed", err);
        const msg = err && err.message ? err.message : "unknown error";
        if (typeof S.announceToScreenReader === "function") {
          S.announceToScreenReader("Audio export failed: " + msg);
        }
        if (typeof window.notifyWarning === "function") {
          window.notifyWarning("Audio export failed: " + msg);
        }
      })
      .then(function () {
        // finally — always restore the panel lock, icon, and labels.
        activeExportingBtn = null;
        if (icon) {
          icon.setAttribute("data-icon", "download");
          if (typeof window.refreshIcons === "function")
            window.refreshIcons(icon);
        }
        // Refresh every bubble so the cascade-disabled siblings come back.
        refreshAllChatSaveAudioButtons();
      });
  }

  // ── In-flight progress label updates (events) ──────────────────────

  /**
   * tts:exportProgress handler — only fires for the actively-exporting
   * bubble. Image Describer's identical listener fires globally; here we
   * filter on activeExportingBtn so we never react to Image Describer's
   * exports. Updates the Save button's label only — deliberately no inline
   * progress bar (chat bubbles are short; the Image Describer reference
   * uses one, but that is over-spec for the per-bubble Chat case).
   */
  function onExportProgress(data) {
    if (!activeExportingBtn) return;
    if (
      !data ||
      typeof data.chunk !== "number" ||
      typeof data.totalChunks !== "number"
    )
      return;
    const label = activeExportingBtn.querySelector(".chat-save-audio-label");
    if (label) {
      label.textContent =
        "Generating " + data.chunk + " of " + data.totalChunks + "…";
    }
  }

  function onExportEncodeProgress(data) {
    if (!activeExportingBtn) return;
    if (!data || typeof data.percent !== "number") return;
    const percent = Math.max(0, Math.min(100, Math.round(data.percent)));
    const label = activeExportingBtn.querySelector(".chat-save-audio-label");
    if (label) label.textContent = "Encoding MP3 " + percent + "%…";
  }

  // ── Engine badge (conversation-level) ──────────────────────────────

  /**
   * Show the conversation-level engine badge. Called from tts:start when
   * the active speaker is a Chat bubble (i.e. activeBubbleBtn is set —
   * that flag is the singleton-coexistence guard against reacting to
   * Image Describer's playback events).
   */
  function showChatEngineBadge() {
    const badge = document.getElementById(S.elId("read-aloud-engine"));
    if (!badge) return;
    const engine =
      window.TTSController &&
      typeof window.TTSController.getEngine === "function"
        ? window.TTSController.getEngine()
        : "webspeech";
    badge.textContent =
      engine === "webspeech" ? "Browser voice" : "Natural voice";
    badge.hidden = false;
  }

  function hideChatEngineBadge() {
    const badge = document.getElementById(S.elId("read-aloud-engine"));
    if (!badge) return;
    badge.textContent = "";
    badge.hidden = true;
  }

  // ── Save-button HTML generator ─────────────────────────────────────

  /**
   * Add the Save-as-Audio split button to an assistant bubble's action
   * bar. Mirrors Image Describer's HTML structure (.imgdesc-save-audio-*
   * classes for visual styling; .chat-save-audio-* classes for JS lookup
   * to avoid colliding with Image Describer's and Local Chat's buttons).
   *
   * The "Processed locally on your device" note is a sibling <small>
   * inside the bubble (but outside .local-chat-bubble-actions) — it has
   * display:block and reads as its own line below the action bar. It is
   * in the skipSelectors in getBubbleResultFast/getPreparedBubbleResult
   * so it is not read aloud or exported.
   */
  function addSaveAudioButton(bubble) {
    if (
      typeof window.TTSController === "undefined" ||
      !window.TTSController.isAvailable()
    ) {
      logDebug("TTSController not available — skipping Save Audio button");
      return;
    }

    const actions = getOrCreateActions(bubble);

    // Split-button container — Image Describer pattern, role="group".
    const split = document.createElement("span");
    split.className = "imgdesc-save-audio-split";
    split.setAttribute("role", "group");
    split.setAttribute("aria-label", "Save audio");

    const main = document.createElement("button");
    main.type = "button";
    main.className =
      "chat-save-audio-main imgdesc-save-audio-main local-chat-read-aloud";
    main.innerHTML =
      '<span aria-hidden="true" data-icon="download"></span>' +
      ' <span class="chat-save-audio-label">Save as MP3</span>';

    const formatBtn = document.createElement("button");
    formatBtn.type = "button";
    formatBtn.className =
      "chat-save-audio-format imgdesc-format-toggle local-chat-read-aloud";
    formatBtn.innerHTML =
      '<span aria-hidden="true" data-icon="arrowDown"></span>' +
      '<span class="visually-hidden chat-save-audio-format-label">MP3</span>';

    split.appendChild(main);
    split.appendChild(formatBtn);
    actions.appendChild(split);
    if (typeof window.refreshIcons === "function") window.refreshIcons(split);

    main.addEventListener("click", function () {
      handleChatSaveAudioClick(bubble, main);
    });
    formatBtn.addEventListener("click", function () {
      // Refuse format changes mid-export — would relabel the running
      // button mid-stream and look like a bug.
      if (activeExportingBtn) return;
      const current = getChatExportFormat();
      const next = current === "mp3" ? "wav" : "mp3";
      setChatExportFormat(next);
      if (typeof S.announceToScreenReader === "function") {
        S.announceToScreenReader(
          "Audio format set to " + next.toUpperCase() + ".",
        );
      }
    });

    // Initial state — disabled-with-reason until conditions are met.
    // Deferred to a microtask because Chat's postGeneration sequence
    // (chat-core.js) flips S.isGenerating = false AFTER renderAssistantTurn
    // — and thus addSaveAudioButton — has run. A synchronous refresh here
    // would read isGenerating === true and disable the button while falling
    // into the base-label branch (no "with reason" tag) — confusing UI.
    // The microtask runs after the current synchronous task settles, by
    // which time isGenerating is correctly false.
    Promise.resolve().then(function () {
      refreshChatSaveAudioEnabled(bubble);
    });
  }

  // ── Save-audio event wiring ────────────────────────────────────────

  /**
   * Register the Save-audio listeners on EmbedEventEmitter:
   *   - tts:start / tts:end / tts:error → engine badge (when a Chat bubble
   *     owns playback, i.e. activeBubbleBtn set).
   *   - tts:engineChanged / model:stateChange → recompute Save buttons.
   *   - tts:exportProgress / tts:exportEncodeProgress → update the
   *     actively-exporting bubble's label (filtered by activeExportingBtn).
   *
   * Engine-badge wiring lives here rather than in wireReadAloudEvents
   * because it's conceptually a Save-audio control (companion to Save audio)
   * even though it reacts to the Read Aloud speech events. Multiple
   * listeners on the same event are supported by EmbedEventEmitter.
   */
  function wireChatSaveAudioEvents() {
    if (
      !window.EmbedEventEmitter ||
      typeof window.EmbedEventEmitter.on !== "function"
    ) {
      logWarn(
        "EmbedEventEmitter not available — Save Audio events will not be wired",
      );
      return;
    }

    window.EmbedEventEmitter.on("tts:start", function () {
      // Singleton-coexistence guard: only show our badge when a Chat bubble
      // triggered playback. Image Describer's tts:start fires for its own
      // button — activeBubbleBtn is null then.
      if (activeBubbleBtn) showChatEngineBadge();
    });
    window.EmbedEventEmitter.on("tts:end", function () {
      hideChatEngineBadge();
    });
    window.EmbedEventEmitter.on("tts:error", function () {
      hideChatEngineBadge();
    });

    window.EmbedEventEmitter.on("tts:engineChanged", function () {
      hideChatEngineBadge(); // engine changed mid-playback → hide stale label
      refreshAllChatSaveAudioButtons();
    });
    window.EmbedEventEmitter.on("model:stateChange", function (data) {
      if (data && data.category && data.category !== "tts") return;
      refreshAllChatSaveAudioButtons();
    });

    window.EmbedEventEmitter.on("tts:exportProgress", onExportProgress);
    window.EmbedEventEmitter.on(
      "tts:exportEncodeProgress",
      onExportEncodeProgress,
    );

    logDebug("Save Audio TTS events wired");
  }

  wireChatSaveAudioEvents();

  // ── Response-size clamp (per-turn visual height clamp) ──────────────────────
  //
  // When an assistant reply's raw markdown exceeds RESPONSE_SIZE_THRESHOLD, the
  // rendered rich body is wrapped and given a VISUAL height clamp (the CSS lands
  // in Stage B) plus a "Show full response" / "Show less" toggle. The clamp is
  // visual ONLY — the whole reply stays in the DOM, so a screen-reader user reads
  // all of it regardless of the clamp state. This is NOT an LLM summary and NOT a
  // text truncation. Per-turn, attached from the single renderAssistantTurn path
  // so live and restored turns share it.
  //
  // Supersedes the old shared-region ResponseSizeManager (js/response-size-manager.js):
  // that swapped .results-content innerHTML between a filtered "summary" and the
  // original content (destructive, one shared region, announced via notifyInfo,
  // with a Download button, byte-size threshold of RESPONSE_SIZE_WARNING = 1 MB).
  // Here nothing leaves the DOM, each turn owns its own clamp, the notice is not
  // announced, there is no Download button (export already covers it), and the
  // threshold is a raw-markdown character count.

  // Raw-markdown character count above which a reply is clamped. 2000 chars is
  // roughly a medium reply (~300-350 words); a ~600-word reply is comfortably over
  // and a short reply comfortably under.
  const RESPONSE_SIZE_THRESHOLD = 4000;

  const RESPONSE_CLAMP_WRAPPER_CLASS = "chat-response-clamped";
  const RESPONSE_CLAMP_CONTROLS_CLASS = "chat-response-clamp-controls";
  const RESPONSE_CLAMP_NOTICE_CLASS = "chat-response-clamp-notice";
  const RESPONSE_CLAMP_TOGGLE_CLASS = "chat-response-clamp-toggle";
  const RESPONSE_CLAMP_TOGGLE_LABEL_CLASS = "chat-response-clamp-toggle-label";
  const RESPONSE_CLAMP_NOTICE_TEXT = "Long response — showing a preview";
  const RESPONSE_CLAMP_SHOW_LABEL = "Show full response";
  const RESPONSE_CLAMP_HIDE_LABEL = "Show less";

  // Monotonic id source for the clamped body (aria-controls target). A counter,
  // not Date.now(), so ids are stable and collision-free within a session.
  let responseClampSeq = 0;

  /**
   * Pure predicate: is this reply large enough to clamp? True when the raw
   * markdown length exceeds the threshold. Null/empty-safe → false. Kept pure
   * (no DOM, no side effects) and exposed as window.ChatMessages._isLargeResponse
   * for the regression suite.
   * @param {string} content the raw markdown reply
   * @param {number} [threshold] optional override; defaults to RESPONSE_SIZE_THRESHOLD
   * @returns {boolean}
   */
  function isLargeResponse(content, threshold) {
    const limit =
      typeof threshold === "number" && threshold >= 0
        ? threshold
        : RESPONSE_SIZE_THRESHOLD;
    if (!content || typeof content !== "string") return false;
    return content.length > limit;
  }

  /**
   * When isLargeResponse(content) is true, wrap the assistant bubble's rich body
   * in a clamped container and append a visible (non-live) notice plus a
   * "Show full response" / "Show less" toggle. Small replies get nothing.
   *
   * MUST run AFTER renderRichContent (so the rich body is the bubble's children)
   * and BEFORE the badge/controls are added, so those land OUTSIDE the clamp. The
   * wrapper is reparented (nodes moved, not cloned), so chart canvases, mermaid
   * figures, and the math a11y attributes set up in renderRichContent survive.
   *
   * Accessibility: the toggle is a real <button> whose visible label changes with
   * state and whose aria-expanded reflects it; aria-controls points at the clamped
   * body's id. Focus stays on the toggle across a click (no loss, no trap). The
   * notice is a plain <p> — deliberately NOT a live region, so it is visible but
   * never auto-announced. Nothing is removed from the DOM.
   *
   * @param {HTMLElement} bubble the assistant bubble (rich body already rendered)
   * @param {string} content the raw markdown reply (measured by isLargeResponse)
   */
  function attachResponseClamp(bubble, content) {
    if (!bubble) {
      logWarn("attachResponseClamp: missing bubble — no clamp applied");
      return;
    }
    if (!isLargeResponse(content)) return; // small replies get nothing

    // Wrap the rich body (current bubble children) so the clamp is visual-only and
    // the badge/controls added afterwards stay OUTSIDE the clamped region.
    const wrapper = document.createElement("div");
    wrapper.className = RESPONSE_CLAMP_WRAPPER_CLASS;
    responseClampSeq += 1;
    const wrapperId =
      typeof S.elId === "function"
        ? S.elId("response-body-" + responseClampSeq)
        : "chat-response-body-" + responseClampSeq;
    wrapper.id = wrapperId;
    // Move (reparent, not clone) every existing child — the rendered rich body —
    // into the wrapper. Reparenting preserves canvas pixels, svg, and listeners.
    while (bubble.firstChild) wrapper.appendChild(bubble.firstChild);
    bubble.appendChild(wrapper);

    // Controls sit OUTSIDE the clamp so overflow:hidden never clips the toggle and
    // it stays reachable. This container is skipped by the TTS linearise and
    // copy-formatted paths (see their skip lists) so the reply's audio/copy never
    // carries the clamp chrome.
    const controls = document.createElement("div");
    controls.className = RESPONSE_CLAMP_CONTROLS_CLASS;

    const notice = document.createElement("p");
    notice.className = RESPONSE_CLAMP_NOTICE_CLASS;
    notice.textContent = RESPONSE_CLAMP_NOTICE_TEXT;
    // Deliberately NOT a live region (no role / aria-live) — visible cue only.

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = RESPONSE_CLAMP_TOGGLE_CLASS;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", wrapperId);
    toggle.innerHTML =
      '<span aria-hidden="true" data-icon="eye"></span> ' +
      '<span class="' +
      RESPONSE_CLAMP_TOGGLE_LABEL_CLASS +
      '">' +
      RESPONSE_CLAMP_SHOW_LABEL +
      "</span>";

    toggle.addEventListener("click", function () {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      const next = !expanded; // next expanded state
      toggle.setAttribute("aria-expanded", next ? "true" : "false");
      // Expanded → drop the clamp class (full height); collapsed → restore it.
      wrapper.classList.toggle(RESPONSE_CLAMP_WRAPPER_CLASS, !next);
      const labelEl = toggle.querySelector(
        "." + RESPONSE_CLAMP_TOGGLE_LABEL_CLASS,
      );
      if (labelEl) {
        labelEl.textContent = next
          ? RESPONSE_CLAMP_HIDE_LABEL
          : RESPONSE_CLAMP_SHOW_LABEL;
      }
      const iconEl = toggle.querySelector("[data-icon]");
      if (iconEl) {
        iconEl.setAttribute("data-icon", next ? "eyeOff" : "eye");
        if (typeof window.refreshIcons === "function") {
          window.refreshIcons(toggle);
        }
      }
      // Keep focus on the toggle — predictable, no focus loss, no trap.
      toggle.focus();
    });

    controls.appendChild(notice);
    controls.appendChild(toggle);
    bubble.appendChild(controls);

    // Populate the toggle glyph (injected via innerHTML; the auto-populator only
    // runs once at DOMContentLoaded), mirroring the other per-turn affordances.
    if (typeof window.refreshIcons === "function") {
      window.refreshIcons(controls);
    }

    logDebug("response clamp attached — raw markdown length " + content.length);
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
    // Response-size clamp: when the reply exceeds RESPONSE_SIZE_THRESHOLD, wrap the
    // rich body and add the Show full / Show less toggle. Runs BEFORE the badge and
    // controls so those stay OUTSIDE the clamped region. Visual only — the whole
    // reply stays in the DOM. A no-op for small replies.
    attachResponseClamp(bubble, content);
    window.ChatMessages.addModelProviderBadge(bubble, model, providerId);
    window.ChatMessages.addCopyButton(bubble, index);
    window.ChatMessages.addFormattedCopyButton(bubble, index);
    // Read Aloud goes through getOrCreateActions, so live and restored bubbles
    // share it from this one path — renderAssistantTurn runs on both.
    window.ChatMessages.addReadAloudButton(bubble);
    // Save-as-Audio joins the same shared path (one attach covers live + restored).
    window.ChatMessages.addSaveAudioButton(bubble);
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
    // Edit the TEXT only. For an image-bearing turn this is the text part; the
    // image is left untouched and re-applied on commit (v1 never re-attaches).
    const originalText = extractUserText(S.messages[msgIndex].content);

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
      // Re-render resting content (text + chip for an image turn) — mirrors createUserBubble
      renderUserContent(bubble, S.messages[msgIndex].content);
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

    // Stop any Chat read-aloud still speaking before we tear down later bubbles —
    // removing a bubble node does not stop TTSController playback (it reads from a
    // linearised snapshot, not the live DOM), so a later reply would keep talking
    // after its bubble is gone. Guarded on Chat's ownership signal, so it never
    // interrupts another tool's speech.
    stopReadAloudIfActive();

    // Rewrite the edited turn, then truncate: the slice drops the edited turn's
    // old reply and every later turn. dispatchSend reads this truncated S.messages
    // live at send time, so the token window re-applies to the new payload.
    // For an image-bearing turn, rewrite ONLY the text and keep the image part
    // (v1 leaves the image untouched on edit).
    const existingContent = S.messages[msgIndex].content;
    S.messages[msgIndex].content = isMultimodalContent(existingContent)
      ? setTextOfArrayContent(existingContent, newText)
      : newText;
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
    renderUserContent(bubble, S.messages[msgIndex].content);
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
    addReadAloudButton: addReadAloudButton,
    addSaveAudioButton: addSaveAudioButton,
    // Exposed so the conversation-state seam (updateConversationUI in chat-core.js) can re-check every Chat Save button after a send, once S.isGenerating has flipped false.
    refreshAllChatSaveAudioButtons: refreshAllChatSaveAudioButtons,
    // Exposed so the clear path (chat-persistence.js, landing next) can stop
    // Chat's own speech through the same guarded helper.
    stopReadAloudIfActive: stopReadAloudIfActive,
    // Exposed for a verification probe and the later save-audio slice.
    getBubbleResultFast: getBubbleResultFast,
    addEditButton: addEditButton,
    enterEditMode: enterEditMode,
    cancelEdit: cancelEdit,
    commitEdit: commitEdit,
    // Exposed for inspection/testing.
    _modelDisplayName: modelDisplayName,
    _providerLabel: providerLabel,
    _enhanceMathA11y: enhanceMathA11y,
    // Pure predicate exposed for the regression suite; attach helper for the
    // browser gate. isLargeResponse has no DOM/side effects.
    _isLargeResponse: isLargeResponse,
    _attachResponseClamp: attachResponseClamp,
    // Exposed as a testability seam for the in-bubble attachment classifier
    // (image + pdf, live + reference) — pure, no DOM, no side effects.
    _classifyAttachmentPart: classifyAttachmentPart,
  };

  logInfo("Messages module loaded");
})();
