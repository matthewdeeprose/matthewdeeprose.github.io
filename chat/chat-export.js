/**
 * Unified Chat Tool — Stage 3 step 7, slice 1 (export data layer)
 *
 * The conversation-export data layer for the Chat tool. A Chat-scoped port of
 * the Local Chat exporters, rebuilt around Chat's cross-provider thread: each
 * assistant turn carries its OWN model + providerId, so attribution is PER TURN
 * (not one file-level model as Local Chat has). This closes the attribution gap
 * called out in the grounding.
 *
 * This file drives window.ChatState ONLY — it never calls any window.LocalChat* /
 * window.localChat* global and never touches window.LocalChatState.
 *
 * Architecture: the four build* serialisers are PURE — they take a resolved
 * messages array plus a meta object and return a string, referencing no
 * window/document/S. ALL impurity (reading S, the picker naming helpers, the
 * system-prompt input) lives in the resolve, meta, wrapper and download
 * functions. That keeps the serialisers directly unit-testable from a fixture.
 *
 * Loads AFTER chat/chat.js (window.ChatState) and chat/chat-messages.js
 * (window.ChatMessages._modelDisplayName / ._providerLabel). Slice 1 only mounts
 * the layer; the export-menu UI that calls the wrappers lands in a later slice.
 *
 * @version 0.1.0 — step 7 slice 1 (pure builders + impure wrappers, no UI)
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
      args.unshift("[ChatExport]");
      console.error.apply(console, args);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatExport]");
      console.warn.apply(console, args);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatExport]");
      console.log.apply(console, args);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatExport]");
      console.log.apply(console, args);
    }
  }

  // ── Isolated wording constants ──────────────────────────────────────────
  // Deliberately isolated here so the visible wording of every format is a
  // one-line change. ATTRIB_SEP joins the three parts of an assistant turn's
  // attribution (label, model name, provider label).
  const FILE_TITLE = "Chat conversation";
  const USER_LABEL = "You";
  const ASSISTANT_LABEL = "Assistant";
  const ATTRIB_SEP = " · "; // " · "

  // ── State handle ─────────────────────────────────────────────────────────
  // Captured once at load; chat/chat.js creates window.ChatState synchronously
  // before this IIFE runs. Everything (S.messages, S.els.systemInput) is read
  // LIVE through S at call time, never cached, mirroring the other chat modules.
  const S = window.ChatState;
  if (!S) {
    logError(
      "window.ChatState is missing — chat/chat.js must load before chat/chat-export.js",
    );
    return;
  }

  // ── Impure resolution (these read page globals) ─────────────────────────
  // The ONLY functions besides the wrappers/download that touch window/S.

  /**
   * Resolve a model id to its display NAME via the shared picker helper. Guarded
   * so a missing helper (load-order accident) never throws — falls back to the
   * raw id.
   * @param {string} modelId the FULL model id (e.g. "azure-openai/gpt-5.2")
   * @returns {string} the display name, or the raw id
   */
  function resolveModelName(modelId) {
    try {
      if (
        window.ChatMessages &&
        typeof window.ChatMessages._modelDisplayName === "function"
      ) {
        return window.ChatMessages._modelDisplayName(modelId);
      }
    } catch (err) {
      logWarn("resolveModelName failed:", (err && err.message) || err);
    }
    return modelId;
  }

  /**
   * Resolve a provider id to its human label via the shared picker helper.
   * Guarded so a missing helper never throws — falls back to the raw id.
   * @param {string} providerId the provider id (e.g. "azure-openai")
   * @returns {string} the provider label, or the raw id
   */
  function resolveProviderLabel(providerId) {
    try {
      if (
        window.ChatMessages &&
        typeof window.ChatMessages._providerLabel === "function"
      ) {
        return window.ChatMessages._providerLabel(providerId);
      }
    } catch (err) {
      logWarn("resolveProviderLabel failed:", (err && err.message) || err);
    }
    return providerId;
  }

  /**
   * Resolve a raw S.messages array into export-ready turns. This is the ONLY
   * place per-turn labels are resolved from the live picker helpers. A user turn
   * carries { role, content }; an assistant turn additionally carries its stored
   * model + providerId and the resolved modelName + providerLabel.
   * @param {Array<Object>} messages the raw thread (S.messages shape)
   * @returns {Array<Object>} resolved export turns
   */
  function resolveExportMessages(messages) {
    return (messages || []).map(function (m) {
      if (m.role === "assistant") {
        return {
          role: "assistant",
          content: m.content,
          model: m.model,
          providerId: m.providerId,
          modelName: resolveModelName(m.model),
          providerLabel: resolveProviderLabel(m.providerId),
        };
      }
      return { role: "user", content: m.content };
    });
  }

  /**
   * Build the export meta. Deliberately carries NO single file-level model — a
   * Chat thread spans models, so attribution is per turn, not per file.
   * @returns {Object} { dateStr, exportedAtISO, exportedAtLocal, count, safeName }
   */
  function getExportMeta() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    return {
      dateStr: dateStr,
      exportedAtISO: now.toISOString(),
      exportedAtLocal: now.toLocaleString(),
      count: S.messages.length,
      safeName: "chat-conversation-" + dateStr,
    };
  }

  // ── Pure attribution helper ─────────────────────────────────────────────

  /**
   * The attribution label for a RESOLVED turn. Pure. A user turn reads "You";
   * an assistant turn reads e.g. "Assistant · GPT-5.2 · Microsoft Foundry".
   * @param {Object} m a resolved export turn
   * @returns {string}
   */
  function attributionLabel(m) {
    if (m.role === "user") return USER_LABEL;
    return ASSISTANT_LABEL + ATTRIB_SEP + m.modelName + ATTRIB_SEP + m.providerLabel;
  }

  // ── Pure HTML escaping ──────────────────────────────────────────────────

  /**
   * Escape the five HTML-significant characters (& < > " '). Pure.
   * @param {string} str
   * @returns {string}
   */
  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ── Pure content renderer for HTML (semantic-but-not-full-render) ───────

  /**
   * Render one message's markdown content to safe, semantic HTML. Pure — depends
   * only on escapeHTML. The order is deliberate:
   *   1. escape the WHOLE content first, so nothing can inject markup and so the
   *      insides of fenced code are already safe before we wrap them;
   *   2. pull fenced code blocks (``` optional-language) OUT to placeholders
   *      BEFORE any inline rule runs, so inline conversion can never mangle code
   *      insides (mermaid arrives fenced, so it lands here as readable source —
   *      the intended v1 behaviour);
   *   3. split the remainder into paragraphs on blank lines; a paragraph that is
   *      exactly a placeholder is emitted as its raw <pre><code> block, everything
   *      else gets inline rules (`code`, **bold**, *italic*, [text](url)) and a
   *      <p> wrapper, with single newlines becoming <br>.
   * Maths is left as its readable source (no MathJax at export time).
   * @param {string} content raw markdown
   * @returns {string} HTML fragment
   */
  function renderContentHTML(content) {
    const escaped = escapeHTML(content);

    // Pull fenced code blocks out first, replacing each with a placeholder token
    // that carries no markdown characters, so the inline pass never touches it.
    const fences = [];
    const withPlaceholders = escaped.replace(
      /```([^\n`]*)\n?([\s\S]*?)```/g,
      function (match, lang, code) {
        const body = code.replace(/\n$/, ""); // drop one trailing newline
        const langAttr =
          lang && lang.trim() ? ' class="language-' + lang.trim() + '"' : "";
        const idx = fences.length;
        fences.push("<pre><code" + langAttr + ">" + body + "</code></pre>");
        return " CHATEXPORTFENCE" + idx + " ";
      },
    );

    const blocks = withPlaceholders.split(/\n{2,}/);
    const rendered = blocks
      .map(function (block) {
        const trimmed = block.trim();
        if (trimmed === "") return "";
        const fenceMatch = trimmed.match(/^ CHATEXPORTFENCE(\d+) $/);
        if (fenceMatch) {
          return fences[parseInt(fenceMatch[1], 10)];
        }
        const inline = trimmed
          .replace(/`([^`]+)`/g, "<code>$1</code>")
          .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
          .replace(/\*([^*]+)\*/g, "<em>$1</em>")
          // The content was already escaped wholesale above, so the captured href
          // is already safe; we defensively escape it again per the export spec
          // (this can only ever over-escape, never under-escape).
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (m, text, href) {
            return '<a href="' + escapeHTML(href) + '">' + text + "</a>";
          })
          .replace(/\n/g, "<br>\n");
        return "<p>" + inline + "</p>";
      })
      .filter(function (s) {
        return s !== "";
      });

    return rendered.join("\n");
  }

  // ── Pure builders (each (exportMsgs, meta) → string; no page globals) ───

  /**
   * Markdown serialiser. Keeps the raw content faithfully (markdown preserved).
   * @param {Array<Object>} exportMsgs resolved turns
   * @param {Object} meta export meta
   * @returns {string}
   */
  function buildMarkdown(exportMsgs, meta) {
    const lines = [
      "# " + FILE_TITLE,
      "*Exported " + meta.exportedAtLocal + " · " + meta.count + " messages*",
      "",
    ];
    exportMsgs.forEach(function (m) {
      lines.push("---");
      lines.push("");
      lines.push("**" + attributionLabel(m) + ":**");
      lines.push(m.content);
      lines.push("");
    });
    return lines.join("\n");
  }

  /**
   * Plain-text serialiser. Strips basic markdown with the same five regexes
   * Local Chat's exportAsText uses (bold, italic, code, headings, links).
   * @param {Array<Object>} exportMsgs resolved turns
   * @param {Object} meta export meta
   * @returns {string}
   */
  function buildText(exportMsgs, meta) {
    const lines = [
      FILE_TITLE,
      "Exported " + meta.exportedAtLocal + " · " + meta.count + " messages",
      "",
    ];
    exportMsgs.forEach(function (m) {
      lines.push("----------------------------------------");
      lines.push(attributionLabel(m) + ":");
      const text = m.content
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`{1,3}([\s\S]*?)`{1,3}/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
      lines.push(text);
      lines.push("");
    });
    return lines.join("\n");
  }

  /**
   * HTML serialiser. A standalone, accessible, AA-contrast document: one <h1>
   * for the file and one <h2> per message holding the attribution, so the
   * attribution is a screen-reader-navigable heading and the hierarchy is
   * h1 → h2 per message. Content is escaped then semantically rendered by
   * renderContentHTML (fenced code as <pre><code>; maths/mermaid left as source).
   * @param {Array<Object>} exportMsgs resolved turns
   * @param {Object} meta export meta
   * @returns {string}
   */
  function buildHTML(exportMsgs, meta) {
    const css = [
      ":root{color-scheme:light}",
      "body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.5;max-width:48rem;margin:2rem auto;padding:0 1rem;color:#1a1a1a;background:#ffffff;}",
      "h1{font-size:1.5rem;margin-bottom:0.25rem;}",
      ".meta{color:#595959;font-size:0.9rem;margin-top:0;margin-bottom:2rem;}",
      ".msg{margin:1.5rem 0;padding:1rem 1.25rem;border:1px solid #767676;border-radius:0.5rem;}",
      ".msg-user{background:#eef4fb;border-left:4px solid #1f5fae;}",
      ".msg-assistant{background:#f5f5f5;border-left:4px solid #2e7d32;}",
      ".msg h2{font-size:1rem;margin:0 0 0.5rem;color:#1a1a1a;}",
      "pre{background:#1e1e1e;color:#f5f5f5;padding:0.75rem 1rem;border-radius:0.4rem;overflow-x:auto;}",
      "pre code{background:transparent;color:inherit;padding:0;}",
      "code{background:#e6e6e6;color:#1a1a1a;padding:0.1rem 0.3rem;border-radius:0.25rem;font-size:0.95em;}",
      "a{color:#0b4fa0;}",
    ].join("\n");

    const parts = [
      "<!DOCTYPE html>",
      '<html lang="en-GB">',
      "<head>",
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>" + FILE_TITLE + "</title>",
      "<style>" + css + "</style>",
      "</head>",
      "<body>",
      "<h1>" + FILE_TITLE + "</h1>",
      '<p class="meta">Exported ' +
        escapeHTML(meta.exportedAtLocal) +
        " · " +
        meta.count +
        " messages</p>",
    ];

    exportMsgs.forEach(function (m) {
      const cls = m.role === "user" ? "msg-user" : "msg-assistant";
      parts.push('<section class="msg ' + cls + '">');
      parts.push("<h2>" + escapeHTML(attributionLabel(m)) + "</h2>");
      parts.push(renderContentHTML(m.content));
      parts.push("</section>");
    });

    parts.push("</body>");
    parts.push("</html>");
    return parts.join("\n");
  }

  /**
   * JSON serialiser. An assistant message emits its full per-turn attribution;
   * a user message emits only role/content. The per-message object is kept
   * intentionally shallow so a later `attachments` field can be added without a
   * schema break.
   * @param {Array<Object>} exportMsgs resolved turns
   * @param {Object} meta export meta (systemPrompt read by the wrapper)
   * @returns {string}
   */
  function buildJSON(exportMsgs, meta) {
    const data = {
      tool: "chat",
      exportedAt: meta.exportedAtISO,
      messageCount: meta.count,
      systemPrompt: meta.systemPrompt || "",
      messages: exportMsgs.map(function (m) {
        if (m.role === "assistant") {
          // Shallow by design — leaves room for a future `attachments` field.
          return {
            role: m.role,
            content: m.content,
            model: m.model,
            providerId: m.providerId,
            modelName: m.modelName,
            providerLabel: m.providerLabel,
          };
        }
        return { role: m.role, content: m.content };
      }),
    };
    return JSON.stringify(data, null, 2);
  }

  // ── Download primitive (ported from Local Chat; generic) ────────────────

  /**
   * Trigger a client-side file download from a Blob, then announce and log.
   * Nothing here is Chat-specific beyond the announce wording.
   * @param {Blob} blob
   * @param {string} filename
   * @param {string} formatLabel human label spoken in the announcement
   */
  function triggerDownload(blob, filename, formatLabel) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    S.announceToScreenReader("Conversation exported as " + formatLabel + ".");
    logInfo("Conversation exported as " + formatLabel);
  }

  // ── Impure export wrappers (resolve → build → download) ─────────────────
  // Each returns early on an empty thread. These, plus resolve*/getExportMeta
  // and triggerDownload, are the only functions that touch page globals.

  function exportMarkdown() {
    if (S.messages.length === 0) return;
    const meta = getExportMeta();
    const msgs = resolveExportMessages(S.messages);
    triggerDownload(
      new Blob([buildMarkdown(msgs, meta)], { type: "text/markdown" }),
      meta.safeName + ".md",
      "Markdown",
    );
  }

  function exportText() {
    if (S.messages.length === 0) return;
    const meta = getExportMeta();
    const msgs = resolveExportMessages(S.messages);
    triggerDownload(
      new Blob([buildText(msgs, meta)], { type: "text/plain" }),
      meta.safeName + ".txt",
      "plain text",
    );
  }

  function exportHTML() {
    if (S.messages.length === 0) return;
    const meta = getExportMeta();
    const msgs = resolveExportMessages(S.messages);
    triggerDownload(
      new Blob([buildHTML(msgs, meta)], { type: "text/html" }),
      meta.safeName + ".html",
      "HTML",
    );
  }

  function exportJSON() {
    if (S.messages.length === 0) return;
    // The system prompt is read impurely here (the only wrapper that needs it)
    // and passed into the pure builder via meta.
    const systemPrompt = S.els.systemInput ? S.els.systemInput.value : "";
    const meta = getExportMeta();
    meta.systemPrompt = systemPrompt;
    const msgs = resolveExportMessages(S.messages);
    triggerDownload(
      new Blob([buildJSON(msgs, meta)], { type: "application/json" }),
      meta.safeName + ".json",
      "JSON",
    );
  }

  // ── Export-menu behaviour (ported from Local Chat, scoped to chat ids) ──
  // A faithful port of local-chat.js's export disclosure-menu behaviour: a
  // toggle trigger, a role="menu" with roving arrow-key focus, Escape/Tab close,
  // and outside-click close. Wired via addEventListener (the markup carries no
  // inline onclick). Element getters read LIVE via S.elId so nothing is cached.
  let exportMenuOpen = false;
  let menuWired = false;

  function getTrigger() {
    return document.getElementById(S.elId("export")); // id "chat-export"
  }

  function getMenu() {
    return document.getElementById(S.elId("export-menu")); // id "chat-export-menu"
  }

  /**
   * Open the menu, focus its first item, and defer arming the outside-click
   * listener so the click that opened the menu cannot immediately close it.
   */
  function openMenu() {
    const trigger = getTrigger();
    const menu = getMenu();
    if (!trigger || !menu) return;
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    exportMenuOpen = true;
    const first = menu.querySelector('[role="menuitem"]');
    if (first) first.focus();
    // Defer: the opening click is still propagating; arming now would let it
    // reach handleOutsideClick and close the menu we just opened.
    setTimeout(function () {
      document.addEventListener("click", handleOutsideClick, true);
    }, 0);
  }

  /**
   * Close the menu, disarm the outside-click listener, and optionally return
   * focus to the trigger.
   * @param {boolean} returnFocus move focus back to the Export button
   */
  function closeMenu(returnFocus) {
    const trigger = getTrigger();
    const menu = getMenu();
    if (!menu) return;
    menu.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    exportMenuOpen = false;
    document.removeEventListener("click", handleOutsideClick, true);
    if (returnFocus && trigger) trigger.focus();
  }

  function toggleMenu() {
    if (exportMenuOpen) closeMenu(true);
    else openMenu();
  }

  /**
   * Capture-phase document click handler: close (without returning focus) when
   * the click lands outside BOTH the menu and the trigger.
   * @param {MouseEvent} e
   */
  function handleOutsideClick(e) {
    const trigger = getTrigger();
    const menu = getMenu();
    const target = e.target;
    const insideMenu = menu && menu.contains(target);
    const onTrigger = trigger && trigger.contains(target);
    if (!insideMenu && !onTrigger) closeMenu(false);
  }

  /**
   * Roving keyboard navigation within the menu. Enter/Space are deliberately NOT
   * handled — the menuitems are native <button>s, so their click fires on those
   * keys and handleItemActivate covers activation.
   * @param {KeyboardEvent} e
   */
  function handleMenuKeydown(e) {
    const menu = getMenu();
    if (!menu || menu.hidden) return;
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
    const len = items.length;
    if (len === 0) return;
    const idx = items.indexOf(document.activeElement);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        items[(idx + 1) % len].focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        items[(idx - 1 + len) % len].focus();
        break;
      case "Home":
        e.preventDefault();
        items[0].focus();
        break;
      case "End":
        e.preventDefault();
        items[len - 1].focus();
        break;
      case "Escape":
        e.preventDefault();
        closeMenu(true);
        break;
      case "Tab":
        // No preventDefault — let Tab move focus on naturally.
        closeMenu(false);
        break;
      default:
        break;
    }
  }

  /**
   * Activate a menu item: close-then-export, mirroring Local Chat's
   * localChatExport. Closing first returns focus to the trigger before the
   * download, so triggerDownload's announce lands after focus is settled.
   * @param {MouseEvent} e
   */
  function handleItemActivate(e) {
    const format = e.currentTarget.dataset.export;
    closeMenu(true);
    switch (format) {
      case "markdown":
        exportMarkdown();
        break;
      case "text":
        exportText();
        break;
      case "html":
        exportHTML();
        break;
      case "json":
        exportJSON();
        break;
      default:
        logWarn("unknown export format:", format);
        break;
    }
  }

  /**
   * Attach the menu listeners once. Safe to call before the button is enabled —
   * the click listener simply won't fire on a disabled button (slice 5 enables
   * it). Guarded so a double-init never double-binds.
   */
  function wire() {
    if (menuWired) return;
    const trigger = getTrigger();
    const menu = getMenu();
    if (!trigger || !menu) {
      logWarn("wire: export trigger or menu missing — menu not wired");
      return;
    }
    trigger.addEventListener("click", toggleMenu);
    menu.addEventListener("keydown", handleMenuKeydown);
    Array.from(menu.querySelectorAll('[role="menuitem"]')).forEach(function (
      item,
    ) {
      item.addEventListener("click", handleItemActivate);
    });
    menuWired = true;
  }

  function init() {
    wire();
    logInfo("Export menu wired");
  }

  // Self-run on DOM-ready, matching chat/chat-core.js's guard.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ── Expose module ────────────────────────────────────────────────────────
  window.ChatExport = {
    // Pure builders — driven directly by the test suite.
    buildMarkdown: buildMarkdown,
    buildText: buildText,
    buildHTML: buildHTML,
    buildJSON: buildJSON,
    // Impure wrappers — called by the export-menu UI (later slice).
    exportMarkdown: exportMarkdown,
    exportText: exportText,
    exportHTML: exportHTML,
    exportJSON: exportJSON,
    // Resolution + primitives, exposed for the suite.
    resolveExportMessages: resolveExportMessages,
    getExportMeta: getExportMeta,
    attributionLabel: attributionLabel,
    escapeHTML: escapeHTML,
    triggerDownload: triggerDownload,
    // Menu behaviour (slice 4).
    openMenu: openMenu,
    closeMenu: closeMenu,
    toggleMenu: toggleMenu,
    init: init,
  };

  logInfo("Export module loaded");
})();
