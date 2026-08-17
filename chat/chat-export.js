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
  // The Object Replacement Character (U+FFFC), used as a collision-safe,
  // null-free placeholder delimiter so git keeps this file as text.
  const FENCE_SENTINEL = "\uFFFC";
  // Privacy note \u2014 emitted (JSON + HTML only) when at least one turn embeds
  // attachment bytes. Embedding the base64 also embeds the filename, so a
  // recipient of the exported file receives both; this states that plainly.
  // Text/markdown never embed bytes, so they carry no note.
  const PRIVACY_NOTE =
    "Embedded attachment bytes include the document and its filename; anyone you share this file with receives them.";

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
   * Join the visible text of an array-content user turn into a single string,
   * so the pure builders keep receiving a STRING body. Local to this module —
   * it deliberately does NOT reach into ChatCore/ChatMessages. Bare strings and
   * { type:"text", text } parts contribute; the attachment part is skipped.
   * @param {Array} content an array-shaped turn content
   * @returns {string}
   */
  function extractArrayText(content) {
    const parts = [];
    for (let i = 0; i < content.length; i++) {
      const p = content[i];
      if (typeof p === "string") parts.push(p);
      else if (p && p.type === "text" && typeof p.text === "string")
        parts.push(p.text);
    }
    return parts.join("");
  }

  /**
   * Build an attachment descriptor for a raw user turn whose content is an
   * array, or null when the turn carries no attachment. Metadata comes from
   * turn.attachment (a LIVE turn) or the byte-free reference part in content (a
   * RESTORED turn). Bytes come from the { type:"file" } part (file.file_data) or
   * the { type:"image_url" } part (image_url.url) — present only on a live turn;
   * a restored turn yields data = null, bytesIncluded = false.
   * @param {Object} m a raw user turn (content is an array)
   * @returns {Object|null} { kind, filename, mimeType, size, bytesIncluded, data }
   */
  function buildAttachmentDescriptor(m) {
    const content = m.content;
    if (!Array.isArray(content)) return null;

    // Metadata: live turn's byte-free reference, else the restored reference part.
    let metaSrc = null;
    if (m.attachment && typeof m.attachment === "object") {
      metaSrc = m.attachment;
    } else {
      metaSrc = content.find(function (p) {
        return p && (p.kind === "image" || p.kind === "pdf");
      });
    }
    if (!metaSrc) return null; // array content but no attachment — nothing to emit

    // Bytes: a live turn carries them in the file / image_url part.
    let data = null;
    let bytesIncluded = false;
    const filePart = content.find(function (p) {
      return p && p.type === "file";
    });
    if (filePart && filePart.file && typeof filePart.file.file_data === "string") {
      data = filePart.file.file_data;
      bytesIncluded = true;
    } else {
      const imagePart = content.find(function (p) {
        return p && p.type === "image_url";
      });
      const url =
        imagePart && imagePart.image_url && typeof imagePart.image_url === "object"
          ? imagePart.image_url.url
          : imagePart && typeof imagePart.image_url === "string"
          ? imagePart.image_url
          : null;
      if (typeof url === "string" && url) {
        data = url;
        bytesIncluded = true;
      }
    }

    return {
      kind: metaSrc.kind,
      filename: metaSrc.filename,
      mimeType: metaSrc.mimeType,
      size: metaSrc.size,
      bytesIncluded: bytesIncluded,
      data: data,
    };
  }

  /**
   * Resolve a raw S.messages array into export-ready turns. This is the ONLY
   * place per-turn labels are resolved from the live picker helpers. A user turn
   * carries { role, content }; an assistant turn additionally carries its stored
   * model + providerId and the resolved modelName + providerLabel. A user turn
   * whose content is an ARRAY (an attachment turn) is split into a STRING text
   * body plus an `attachment` descriptor, so the builders keep receiving a
   * string body and stay pure; the descriptor is attached ONLY when built.
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
      if (Array.isArray(m.content)) {
        const resolved = { role: "user", content: extractArrayText(m.content) };
        const descriptor = buildAttachmentDescriptor(m);
        if (descriptor) resolved.attachment = descriptor;
        return resolved;
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

  // ── Pure attachment helpers ─────────────────────────────────────────────

  /**
   * Human-readable file size (bytes → B / KB / MB). Pure. Mirrors the wording
   * of chat-attach.js's formatFileSize, reimplemented locally so the pure
   * builders reach into no other module.
   * @param {number} bytes
   * @returns {string}
   */
  function humanFileSize(bytes) {
    const n = typeof bytes === "number" ? bytes : Number(bytes);
    if (!n || n <= 0) return "0 KB";
    const kb = n / 1024;
    if (kb < 1024) return Math.round(kb) + " KB";
    return (kb / 1024).toFixed(1) + " MB";
  }

  /**
   * Render a resolved turn's attachment descriptor to safe HTML. Pure — depends
   * only on escapeHTML/humanFileSize. The filename is ALWAYS escaped; the data
   * URI (a controlled data: URI, base64 alphabet only) is embedded verbatim.
   *   live image → <img> plus a caption line naming the file
   *   live pdf   → a download anchor carrying the data URI + human size
   *   restored   → a reference line, bytes not included (same-session only)
   * @param {Object} att { kind, filename, mimeType, size, bytesIncluded, data }
   * @returns {string} HTML fragment
   */
  function renderAttachmentHTML(att) {
    const fn = escapeHTML(att.filename);
    if (!att.bytesIncluded) {
      return (
        '<p class="attachment-ref">Attachment: ' +
        fn +
        " (" +
        escapeHTML(att.kind) +
        ") — not included (same-session only).</p>"
      );
    }
    if (att.kind === "image") {
      return (
        '<img src="' +
        att.data +
        '" alt="' +
        fn +
        '" style="max-width:100%;height:auto">\n' +
        '<p class="attachment-caption">' +
        fn +
        "</p>"
      );
    }
    return (
      '<p>a <a href="' +
      att.data +
      '" download="' +
      fn +
      '">' +
      fn +
      "</a> (" +
      humanFileSize(att.size) +
      ") — PDF attached.</p>"
    );
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
        return FENCE_SENTINEL + "CHATEXPORTFENCE" + idx + FENCE_SENTINEL;
      },
    );

    const blocks = withPlaceholders.split(/\n{2,}/);
    const rendered = blocks
      .map(function (block) {
        const trimmed = block.trim();
        if (trimmed === "") return "";
        const fenceMatch = trimmed.match(new RegExp("^" + FENCE_SENTINEL + "CHATEXPORTFENCE(\\d+)" + FENCE_SENTINEL + "$"));
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
      // Attachment reference only — markdown never embeds bytes. A restored turn
      // (bytes gone) appends the not-included note.
      if (m.attachment) {
        let ref =
          "> Attachment: " + m.attachment.filename + " (" + m.attachment.kind + ")";
        if (!m.attachment.bytesIncluded) ref += " — not included";
        lines.push(ref);
      }
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
      // Attachment reference only — plain text never embeds bytes. A restored
      // turn (bytes gone) appends the not-included note.
      if (m.attachment) {
        let ref =
          "Attachment: " + m.attachment.filename + " (" + m.attachment.kind + ")";
        if (!m.attachment.bytesIncluded) ref += " — not included";
        lines.push(ref);
      }
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
    // Privacy note appears only when at least one turn embeds attachment bytes.
    const anyBytes = exportMsgs.some(function (m) {
      return m.attachment && m.attachment.bytesIncluded;
    });
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
      ".privacy-note{color:#8a4b00;background:#fff4e5;border:1px solid #b35900;border-radius:0.4rem;padding:0.5rem 0.75rem;font-size:0.9rem;margin:0 0 2rem;}",
      ".attachment-caption{color:#595959;font-size:0.9rem;margin-top:0.25rem;}",
      ".attachment-ref{color:#595959;font-style:italic;}",
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

    // Privacy note (bytes embedded include the document + filename — see PRIVACY_NOTE).
    if (anyBytes) {
      parts.push('<p class="privacy-note">' + escapeHTML(PRIVACY_NOTE) + "</p>");
    }

    exportMsgs.forEach(function (m) {
      const cls = m.role === "user" ? "msg-user" : "msg-assistant";
      parts.push('<section class="msg ' + cls + '">');
      parts.push("<h2>" + escapeHTML(attributionLabel(m)) + "</h2>");
      parts.push(renderContentHTML(m.content));
      // Attachment block (image/pdf/reference) after the message body.
      if (m.attachment) parts.push(renderAttachmentHTML(m.attachment));
      parts.push("</section>");
    });

    parts.push("</body>");
    parts.push("</html>");
    return parts.join("\n");
  }

  /**
   * JSON serialiser. An assistant message emits its full per-turn attribution;
   * a plain user message emits only role/content. A user turn carrying an
   * attachment additionally emits `attachments: [ { kind, filename, mimeType,
   * size, bytesIncluded } ]`, with `data` (the base64 data URI) present ONLY
   * when bytesIncluded is true (a live turn). A top-level `privacyNote` appears
   * only when at least one turn embeds bytes.
   * @param {Array<Object>} exportMsgs resolved turns
   * @param {Object} meta export meta (systemPrompt read by the wrapper)
   * @returns {string}
   */
  function buildJSON(exportMsgs, meta) {
    // Privacy note appears only when at least one turn embeds attachment bytes.
    const anyBytes = exportMsgs.some(function (m) {
      return m.attachment && m.attachment.bytesIncluded;
    });
    const data = {
      tool: "chat",
      exportedAt: meta.exportedAtISO,
      messageCount: meta.count,
      systemPrompt: meta.systemPrompt || "",
      messages: exportMsgs.map(function (m) {
        if (m.role === "assistant") {
          // Assistant turns never carry an attachment — shallow by design.
          return {
            role: m.role,
            content: m.content,
            model: m.model,
            providerId: m.providerId,
            modelName: m.modelName,
            providerLabel: m.providerLabel,
          };
        }
        // A plain (string-content) user turn stays exactly { role, content }.
        const obj = { role: m.role, content: m.content };
        if (m.attachment) {
          const a = m.attachment;
          const att = {
            kind: a.kind,
            filename: a.filename,
            mimeType: a.mimeType,
            size: a.size,
            bytesIncluded: a.bytesIncluded,
          };
          // Emit the base64 `data` ONLY when bytes are actually embedded.
          if (a.bytesIncluded) att.data = a.data;
          obj.attachments = [att];
        }
        return obj;
      }),
    };
    // Privacy note: embedded bytes include the document + filename; recipients get them.
    if (anyBytes) data.privacyNote = PRIVACY_NOTE;
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
