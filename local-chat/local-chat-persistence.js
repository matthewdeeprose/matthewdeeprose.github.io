/**
 * Local Chat — Persistence Module
 * Session save/restore, conversation archive, history panel, download,
 * restore banner, clear helper, and related functions.
 *
 * @version 1.0.0 — Stage R4 of Local Chat refactor
 */
(function () {
  "use strict";

  // ── Guard: state module must be loaded first ─────────────────────────────
  var S = window.LocalChatState;
  if (!S) {
    console.error(
      "[LocalChatPersistence] local-chat-state.js must be loaded before local-chat-persistence.js",
    );
    return;
  }

  // Local aliases — mutations (push/pop/splice) work through the alias.
  // Reassignments must also write through to S.messages.
  var messages = S.messages;
  var els = S.els;

  // ── Messages module reference (from local-chat-messages.js) ────────────
  var M = window.LocalChatMessages;

  // ── Chips module reference (from local-chat-chips.js) ──────────────────
  var Chips = window.LocalChatChips;

  // ── Constants from shared state ────────────────────────────────────────
  var SESSION_KEY = S.SESSION_KEY;
  var SESSION_MAX_BYTES = S.SESSION_MAX_BYTES;
  var ARCHIVE_KEY = S.ARCHIVE_KEY;
  var ARCHIVE_MAX_CONVERSATIONS = S.ARCHIVE_MAX_CONVERSATIONS;
  var ARCHIVE_MAX_BYTES = S.ARCHIVE_MAX_BYTES;

  // ── Session persistence (5c) ────────────────────────────────────────────

  function saveSession() {
    // Re-read messages from S to stay in sync after reassignments
    messages = S.messages;

    try {
      var data = {
        messages: messages,
        currentModel: S.currentModel,
        systemPrompt: els.systemInput ? els.systemInput.value : "",
        temperature: S.getTemperature(),
        maxTokens: S.getMaxTokens(),
      };
      var json = JSON.stringify(data);
      if (json.length > SESSION_MAX_BYTES) {
        S.logWarn(
          "Session too large to save:",
          json.length,
          "bytes (cap:",
          SESSION_MAX_BYTES,
          ")",
        );
        return;
      }
      sessionStorage.setItem(SESSION_KEY, json);
    } catch (e) {
      S.logWarn("Failed to save session:", e.message);
    }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {
      // Ignore
    }
  }

  // ── Conversation archive (5h-A) ─────────────────────────────────────────

  function archiveConversation() {
    // Re-read messages from S to stay in sync after reassignments
    messages = S.messages;

    if (messages.length === 0) return false;

    // Build archive entry
    var firstUserMsg = "";
    for (var i = 0; i < messages.length; i++) {
      if (messages[i].role === "user") {
        firstUserMsg = messages[i].content;
        break;
      }
    }
    var title =
      firstUserMsg.length > 60
        ? firstUserMsg.substring(0, 57) + "..."
        : firstUserMsg || "Untitled conversation";

    var modelDisplayName = S.currentModel || "unknown";
    if (window.LocalTextModelRegistry) {
      var modelDef = window.LocalTextModelRegistry.getModel(S.currentModel);
      if (modelDef && modelDef.userInfo) {
        modelDisplayName = modelDef.userInfo.displayName;
      }
    }

    var now = new Date().toISOString();
    var entry = {
      id: "lc-" + Date.now(),
      title: title,
      model: S.currentModel,
      modelDisplayName: modelDisplayName,
      messageCount: messages.length,
      created: now,
      lastActive: now,
      systemPrompt: els.systemInput ? els.systemInput.value : "",
      messages: messages.slice(), // shallow copy
    };

    var archive = loadArchive();

    // Check size cap before adding
    var testArchive = [entry].concat(archive);
    var testJson = JSON.stringify(testArchive);
    if (testJson.length > ARCHIVE_MAX_BYTES) {
      S.logWarn(
        "Archive would exceed 2MB cap — conversation not archived. Consider deleting old conversations.",
      );
      return false;
    }

    // Prepend new entry (newest first)
    archive.unshift(entry);

    // Enforce conversation count cap
    if (archive.length > ARCHIVE_MAX_CONVERSATIONS) {
      archive = archive.slice(0, ARCHIVE_MAX_CONVERSATIONS);
    }

    try {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
      S.logInfo(
        "Conversation archived:",
        title,
        "(" + entry.messageCount + " messages)",
      );
      return true;
    } catch (e) {
      S.logWarn("Failed to save archive:", e.message);
      return false;
    }
  }

  function loadArchive() {
    try {
      var json = localStorage.getItem(ARCHIVE_KEY);
      if (!json) return [];
      var archive = JSON.parse(json);
      return Array.isArray(archive) ? archive : [];
    } catch (e) {
      S.logWarn("Failed to load archive:", e.message);
      return [];
    }
  }

  function deleteArchived(id) {
    var archive = loadArchive();
    archive = archive.filter(function (entry) {
      return entry.id !== id;
    });
    try {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
      S.logInfo("Archived conversation deleted:", id);
    } catch (e) {
      S.logWarn("Failed to save archive after delete:", e.message);
    }
  }

  function getArchiveSize() {
    try {
      var json = localStorage.getItem(ARCHIVE_KEY);
      return json ? json.length : 0;
    } catch (e) {
      return 0;
    }
  }

  // ── Clear helper (5h-A) ─────────────────────────────────────────────────

  function performClear() {
    messages = S.messages = [];
    S.currentEmbed = null;
    if (els.messageList) els.messageList.innerHTML = "";
    if (els.stats) els.stats.textContent = "";
    clearSession();
    // Delegate UI button updates to core (if loaded)
    if (window.LocalChat && window.LocalChat._updateAllUI) {
      window.LocalChat._updateAllUI();
    }
    Chips.renderWelcomeCard();
  }

  // ── Session restore ─────────────────────────────────────────────────────

  function restoreSession() {
    try {
      var json = sessionStorage.getItem(SESSION_KEY);
      if (!json) return false;

      var data = JSON.parse(json);
      if (!data || !Array.isArray(data.messages) || data.messages.length === 0)
        return false;

      // Validate the saved model still exists in the registry
      if (data.currentModel && window.LocalTextModelRegistry) {
        var modelDef = window.LocalTextModelRegistry.getModel(
          data.currentModel,
        );
        if (!modelDef) {
          S.logWarn(
            "Saved model no longer in registry:",
            data.currentModel,
            "— discarding session",
          );
          clearSession();
          return false;
        }
      }

      // Restore model
      if (data.currentModel) {
        S.currentModel = data.currentModel;
        if (els.select) els.select.value = S.currentModel;
      }

      // Restore system prompt
      if (data.systemPrompt && els.systemInput) {
        els.systemInput.value = data.systemPrompt;
        // Try to match a preset
        if (els.presetSelect) {
          var matched = false;
          Object.keys(S.SYSTEM_PRESETS).forEach(function (key) {
            if (S.SYSTEM_PRESETS[key] === data.systemPrompt) {
              els.presetSelect.value = key;
              matched = true;
            }
          });
          if (!matched) els.presetSelect.value = "";
        }
      }

      // Restore parameter values (5d)
      if (typeof data.temperature === "number" && els.temperatureSlider) {
        els.temperatureSlider.value = data.temperature;
        if (els.temperatureValue)
          els.temperatureValue.textContent = data.temperature.toFixed(1);
        if (els.temperatureDesc)
          els.temperatureDesc.textContent = S.getTemperatureDescription(
            data.temperature,
          );
      }
      if (typeof data.maxTokens === "number" && els.maxTokensSlider) {
        els.maxTokensSlider.value = data.maxTokens;
        if (els.maxTokensValue) els.maxTokensValue.textContent = data.maxTokens;
        if (els.maxTokensDesc)
          els.maxTokensDesc.textContent = S.getMaxTokensDescription(
            data.maxTokens,
          );
      }

      // Restore messages and rebuild DOM
      messages = S.messages = data.messages;
      rebuildMessageList();

      // Force embed to recreate with restored system prompt
      S.currentEmbed = null;

      return true;
    } catch (e) {
      S.logWarn("Failed to restore session:", e.message);
      clearSession();
      return false;
    }
  }

  // ── Rebuild message list from messages array ────────────────────────────

  function rebuildMessageList() {
    // Re-read messages from S to stay in sync after reassignments
    messages = S.messages;

    if (!els.messageList) return;
    els.messageList.innerHTML = "";

    // Create a markdown-it instance for rendering (same approach as embed)
    var md = null;
    if (window.markdownit) {
      md = window.markdownit({
        html: true,
        breaks: true,
        linkify: true,
        typographer: true,
      });
      if (window.markdownitTaskLists) {
        md.use(window.markdownitTaskLists);
      }
    }

    messages.forEach(function (msg, index) {
      if (msg.role === "user") {
        M.createUserBubble(msg.content, index);
      } else if (msg.role === "assistant") {
        var bubble = M.createAssistantBubble();
        // Render markdown the same way the embed does
        if (md) {
          bubble.innerHTML = md.render(msg.content);
        } else {
          bubble.textContent = msg.content;
        }
        M.highlightCodeBlocks(bubble);
        M.typesetMath(bubble);
        if (msg.model) {
          M.addModelBadge(bubble, msg.model);
        }
        M.addCopyButton(bubble, index);
        M.addFormattedCopyButton(bubble, index);
        // Only add regenerate button to the last assistant message
        if (index === messages.length - 1) {
          M.addRegenerateButton(bubble);
        }
        M.addTimestamp(bubble);
      }
    });

    M.scrollMessagesToBottom();
  }

  // ── Restore banner ──────────────────────────────────────────────────────

  function showRestoreBanner() {
    // Re-read messages from S to stay in sync after reassignments
    messages = S.messages;

    if (!els.messageList) return;

    var banner = document.createElement("div");
    banner.className = "local-chat-restore-banner";
    banner.setAttribute("role", "status");
    banner.id = "local-chat-restore-banner";

    var msgCount = messages.length;
    var text = document.createElement("span");
    text.className = "local-chat-restore-banner-text";
    text.textContent =
      "Previous conversation restored (" +
      msgCount +
      (msgCount === 1 ? " message" : " messages") +
      ")";
    banner.appendChild(text);

    var actions = document.createElement("div");
    actions.className = "local-chat-restore-banner-actions";

    var continueBtn = document.createElement("button");
    continueBtn.className = "local-chat-restore-banner-btn";
    continueBtn.innerHTML =
      '<span aria-hidden="true" data-icon="check"></span> Continue';
    continueBtn.addEventListener("click", function () {
      dismissRestoreBanner();
      if (els.input) els.input.focus();
    });

    var freshBtn = document.createElement("button");
    freshBtn.className = "local-chat-restore-banner-btn";
    freshBtn.innerHTML =
      '<span aria-hidden="true" data-icon="refresh"></span> Start fresh';
    freshBtn.addEventListener("click", function () {
      archiveConversation();
      dismissRestoreBanner();
      performClear();
      S.announceToScreenReader(
        "New conversation started. Previous conversation saved to history.",
      );
    });

    actions.appendChild(continueBtn);
    actions.appendChild(freshBtn);
    banner.appendChild(actions);

    // Insert at the top of the message list (before any restored messages)
    els.messageList.insertBefore(banner, els.messageList.firstChild);

    S.announceToScreenReader(
      "Previous conversation restored. " +
        msgCount +
        " messages. " +
        "Choose to continue or start fresh.",
    );
  }

  function dismissRestoreBanner() {
    var banner = document.getElementById("local-chat-restore-banner");
    if (banner) banner.remove();
  }

  // ── Export helpers ─────────────────────────────────────────────────────

  /**
   * Returns model display name and safe filename slug.
   */
  function getExportMeta() {
    messages = S.messages;
    var modelName = S.currentModel || "unknown";
    if (window.LocalTextModelRegistry) {
      var modelDef = window.LocalTextModelRegistry.getModel(S.currentModel);
      if (modelDef && modelDef.userInfo) {
        modelName = modelDef.userInfo.displayName;
      }
    }
    var dateStr = new Date().toISOString().slice(0, 10);
    var safeModel = (S.currentModel || "chat").replace(/[^a-z0-9-]/gi, "-");
    return { modelName: modelName, dateStr: dateStr, safeModel: safeModel };
  }

  /**
   * Triggers a file download from a Blob.
   */
  function triggerDownload(blob, filename, formatLabel) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    S.announceToScreenReader("Conversation exported as " + formatLabel + ".");
    S.logInfo("Conversation exported as " + formatLabel);
  }

  // ── Download conversation (Markdown) ────────────────────────────────

  function downloadConversation() {
    messages = S.messages;
    if (messages.length === 0) return;
    var meta = getExportMeta();

    var lines = [
      "# Local Chat \u2014 " + meta.modelName,
      "*Exported " + new Date().toLocaleString() + "*",
      "",
    ];

    messages.forEach(function (m) {
      lines.push("---");
      lines.push("");
      if (m.role === "user") {
        lines.push("**You:** " + m.content);
      } else {
        lines.push("**Assistant:** " + m.content);
      }
      lines.push("");
    });

    var blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    triggerDownload(blob, "local-chat-" + meta.safeModel + "-" + meta.dateStr + ".md", "Markdown");
  }

  // ── Export as plain text ────────────────────────────────────────────

  function exportAsText() {
    messages = S.messages;
    if (messages.length === 0) return;
    var meta = getExportMeta();

    var lines = [
      "Local Chat \u2014 " + meta.modelName,
      "Exported " + new Date().toLocaleString(),
      "",
    ];

    messages.forEach(function (m) {
      lines.push("----------------------------------------");
      lines.push("");
      var label = m.role === "user" ? "You" : "Assistant";
      // Strip basic markdown formatting for plain text
      var text = m.content
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`{1,3}([\s\S]*?)`{1,3}/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
      lines.push(label + ": " + text);
      lines.push("");
    });

    var blob = new Blob([lines.join("\n")], { type: "text/plain" });
    triggerDownload(blob, "local-chat-" + meta.safeModel + "-" + meta.dateStr + ".txt", "plain text");
  }

  // ── Export as HTML ──────────────────────────────────────────────────

  function exportAsHTML() {
    messages = S.messages;
    if (messages.length === 0) return;
    var meta = getExportMeta();

    var css = [
      "body{font-family:system-ui,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;background:#f9f9f9;color:#222;}",
      "h1{font-size:1.4rem;}",
      ".meta{color:#666;font-size:0.85rem;margin-bottom:1.5rem;}",
      ".msg{margin:1rem 0;padding:0.75rem 1rem;border-radius:0.5rem;}",
      ".msg-user{background:#e3f2fd;border-left:3px solid #1976d2;}",
      ".msg-assistant{background:#fff;border-left:3px solid #43a047;}",
      ".role{font-weight:bold;margin-bottom:0.25rem;}",
      "pre{background:#263238;color:#eee;padding:0.75rem;border-radius:0.35rem;overflow-x:auto;}",
    ].join("\n");

    var body = messages.map(function (m) {
      var roleLabel = m.role === "user" ? "You" : "Assistant";
      var cls = m.role === "user" ? "msg-user" : "msg-assistant";
      // Basic markdown-to-HTML conversion for readability
      var html = escapeHTML(m.content)
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\n/g, "<br>");
      return '<div class="msg ' + cls + '"><div class="role">' + roleLabel + '</div><div>' + html + '</div></div>';
    }).join("\n");

    var htmlDoc = [
      "<!DOCTYPE html>",
      '<html lang="en">',
      "<head>",
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      "<title>Local Chat \u2014 " + escapeHTML(meta.modelName) + "</title>",
      "<style>" + css + "</style>",
      "</head>",
      "<body>",
      "<h1>Local Chat \u2014 " + escapeHTML(meta.modelName) + "</h1>",
      '<p class="meta">Exported ' + escapeHTML(new Date().toLocaleString()) + "</p>",
      body,
      "</body>",
      "</html>",
    ].join("\n");

    var blob = new Blob([htmlDoc], { type: "text/html" });
    triggerDownload(blob, "local-chat-" + meta.safeModel + "-" + meta.dateStr + ".html", "HTML");
  }

  /**
   * Escapes HTML special characters.
   */
  function escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Export as JSON ──────────────────────────────────────────────────

  function exportAsJSON() {
    messages = S.messages;
    if (messages.length === 0) return;
    var meta = getExportMeta();

    // Get current system prompt
    var systemPrompt = "";
    var systemInput = document.getElementById("local-chat-system");
    if (systemInput) systemPrompt = systemInput.value || "";

    var data = {
      model: S.currentModel || "unknown",
      modelDisplayName: meta.modelName,
      exportedAt: new Date().toISOString(),
      systemPrompt: systemPrompt,
      messages: messages.map(function (m) {
        return { role: m.role, content: m.content };
      }),
    };

    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: "application/json" });
    triggerDownload(blob, "local-chat-" + meta.safeModel + "-" + meta.dateStr + ".json", "JSON");
  }

  // ── History section & panel (5h-B) ──────────────────────────────────────

  function renderHistorySection(container) {
    var archive = loadArchive();
    if (archive.length === 0) return;

    var section = document.createElement("div");
    section.className = "local-chat-history-section";

    var heading = document.createElement("h3");
    heading.className = "local-chat-history-heading";
    heading.textContent = "Previous conversations";
    section.appendChild(heading);

    var list = document.createElement("ul");
    list.className = "local-chat-history-list";

    var showCount = Math.min(archive.length, 5);
    for (var i = 0; i < showCount; i++) {
      list.appendChild(createHistoryEntry(archive[i]));
    }

    section.appendChild(list);

    // "Show all" button if more than 5
    if (archive.length > 5) {
      var showAllBtn = document.createElement("button");
      showAllBtn.className = "local-chat-history-show-all";
      showAllBtn.textContent = "Show all (" + archive.length + ")";
      showAllBtn.addEventListener("click", function () {
        // Expand the list with remaining entries
        for (var j = showCount; j < archive.length; j++) {
          list.appendChild(createHistoryEntry(archive[j]));
        }
        showAllBtn.remove();
      });
      section.appendChild(showAllBtn);
    }

    container.appendChild(section);
  }

  function createHistoryEntry(entry) {
    var li = document.createElement("li");
    li.className = "local-chat-history-entry";
    li.dataset.archiveId = entry.id;

    var title = document.createElement("span");
    title.className = "local-chat-history-title";
    title.textContent = entry.title;
    li.appendChild(title);

    var meta = document.createElement("span");
    meta.className = "local-chat-history-meta";
    var date = new Date(entry.lastActive);
    var dateStr =
      date.toLocaleDateString([], { day: "numeric", month: "short" }) +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    meta.textContent =
      (entry.modelDisplayName || entry.model || "Unknown model") +
      " \u00b7 " +
      entry.messageCount +
      (entry.messageCount === 1 ? " message" : " messages") +
      " \u00b7 " +
      dateStr;
    li.appendChild(meta);

    var actions = document.createElement("div");
    actions.className = "local-chat-history-actions";

    var resumeBtn = document.createElement("button");
    resumeBtn.className = "local-chat-history-btn";
    resumeBtn.innerHTML =
      '<span aria-hidden="true" data-icon="refresh"></span> Resume';
    resumeBtn.setAttribute(
      "aria-label",
      "Resume conversation from " + dateStr + " about " + entry.title,
    );
    resumeBtn.addEventListener("click", function () {
      resumeArchived(entry.id);
    });

    var deleteBtn = document.createElement("button");
    deleteBtn.className =
      "local-chat-history-btn local-chat-history-btn-delete";
    deleteBtn.innerHTML =
      '<span aria-hidden="true" data-icon="trash"></span> Delete';
    deleteBtn.setAttribute(
      "aria-label",
      "Delete conversation from " + dateStr + " about " + entry.title,
    );
    deleteBtn.addEventListener("click", function () {
      var confirmFn =
        typeof window.safeConfirm === "function"
          ? window.safeConfirm
          : function (msg) {
              return Promise.resolve(confirm(msg));
            };

      confirmFn(
        "Delete this conversation? This cannot be undone.",
        "Delete Conversation",
      ).then(function (confirmed) {
        if (!confirmed) return;
        deleteArchived(entry.id);
        li.remove();
        S.announceToScreenReader("Conversation deleted.");
        // Refresh history UI — if list is now empty, remove the section
        refreshHistoryUI();
        updateHistoryButton();
      });
    });

    actions.appendChild(resumeBtn);
    actions.appendChild(deleteBtn);
    li.appendChild(actions);

    return li;
  }

  function resumeArchived(id) {
    // Re-read messages from S to stay in sync after reassignments
    messages = S.messages;

    var archive = loadArchive();
    var entry = null;
    for (var i = 0; i < archive.length; i++) {
      if (archive[i].id === id) {
        entry = archive[i];
        break;
      }
    }
    if (!entry) {
      S.logWarn("Archive entry not found:", id);
      return;
    }

    // If there's an active conversation, archive it first
    if (messages.length > 0) {
      archiveConversation();
    }

    // Clear current state
    performClear();
    Chips.removeWelcomeCard();

    // Load the archived conversation
    messages = S.messages = entry.messages;

    // Restore model if it still exists
    if (entry.model && window.LocalTextModelRegistry) {
      var modelDef = window.LocalTextModelRegistry.getModel(entry.model);
      if (modelDef) {
        S.currentModel = entry.model;
        if (els.select) els.select.value = S.currentModel;
      } else {
        S.logWarn(
          "Archived model no longer available:",
          entry.model,
          "— keeping current model",
        );
      }
    }

    // Restore system prompt
    if (entry.systemPrompt && els.systemInput) {
      els.systemInput.value = entry.systemPrompt;
      // Try to match a preset
      if (els.presetSelect) {
        var matched = false;
        Object.keys(S.SYSTEM_PRESETS).forEach(function (key) {
          if (S.SYSTEM_PRESETS[key] === entry.systemPrompt) {
            els.presetSelect.value = key;
            matched = true;
          }
        });
        if (!matched) els.presetSelect.value = "";
      }
    }

    // Force embed to recreate with restored system prompt
    S.currentEmbed = null;

    // Rebuild DOM
    rebuildMessageList();

    // Remove from archive (it's now the active session)
    deleteArchived(id);

    // Close history panel if open
    closeHistoryPanel();

    // Update all UI state via core
    if (window.LocalChat && window.LocalChat._updateAllUI) {
      window.LocalChat._updateAllUI();
    }
    updateHistoryButton();
    saveSession();

    if (els.input) els.input.focus();
    S.announceToScreenReader(
      "Conversation restored. " + messages.length + " messages.",
    );
    S.logInfo("Resumed archived conversation:", entry.title);
  }

  function refreshHistoryUI() {
    // Refresh history panel (if open)
    var panel = document.getElementById("local-chat-history-panel");
    if (panel) {
      renderHistoryPanelContent(panel);
    }
  }

  function openHistoryPanel() {
    // If panel already exists, close it
    if (document.getElementById("local-chat-history-panel")) {
      closeHistoryPanel();
      return;
    }

    var panel = document.createElement("div");
    panel.id = "local-chat-history-panel";
    panel.className = "local-chat-history-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Conversation history");

    var header = document.createElement("div");
    header.className = "local-chat-history-panel-header";

    var panelHeading = document.createElement("h3");
    panelHeading.textContent = "Conversation history";
    header.appendChild(panelHeading);

    var closeBtn = document.createElement("button");
    closeBtn.className = "local-chat-history-panel-close";
    closeBtn.innerHTML =
      '<span aria-hidden="true" data-icon="close"></span> Close';
    closeBtn.addEventListener("click", closeHistoryPanel);
    header.appendChild(closeBtn);

    panel.appendChild(header);

    renderHistoryPanelContent(panel);

    // Insert before the message list
    if (els.messageList && els.messageList.parentNode) {
      els.messageList.parentNode.insertBefore(panel, els.messageList);
    }

    // Hide message list while panel is open
    if (els.messageList) els.messageList.hidden = true;

    S.announceToScreenReader("Conversation history opened.");
    closeBtn.focus();
  }

  function renderHistoryPanelContent(panel) {
    // Remove existing list if re-rendering
    var existingList = panel.querySelector(".local-chat-history-list");
    if (existingList) existingList.remove();
    var existingEmpty = panel.querySelector(".local-chat-history-empty");
    if (existingEmpty) existingEmpty.remove();

    var archive = loadArchive();

    if (archive.length === 0) {
      var empty = document.createElement("p");
      empty.className = "local-chat-history-empty";
      empty.textContent =
        "No saved conversations yet. Conversations are saved when you clear or switch models.";
      panel.appendChild(empty);
      return;
    }

    var list = document.createElement("ul");
    list.className = "local-chat-history-list";

    archive.forEach(function (entry) {
      list.appendChild(createHistoryEntry(entry));
    });

    panel.appendChild(list);
  }

  function closeHistoryPanel() {
    var panel = document.getElementById("local-chat-history-panel");
    if (panel) panel.remove();

    // Show message list again
    if (els.messageList) els.messageList.hidden = false;

    S.announceToScreenReader("Conversation history closed.");
  }

  function updateHistoryButton() {
    var historyBtn = document.getElementById("local-chat-history");
    if (!historyBtn) return;
    var archive = loadArchive();
    historyBtn.disabled = archive.length === 0;
  }

  // ── Expose module ────────────────────────────────────────────────────

  window.LocalChatPersistence = {
    saveSession: saveSession,
    clearSession: clearSession,
    restoreSession: restoreSession,
    archiveConversation: archiveConversation,
    loadArchive: loadArchive,
    deleteArchived: deleteArchived,
    getArchiveSize: getArchiveSize,
    performClear: performClear,
    rebuildMessageList: rebuildMessageList,
    showRestoreBanner: showRestoreBanner,
    dismissRestoreBanner: dismissRestoreBanner,
    downloadConversation: downloadConversation,
    exportAsText: exportAsText,
    exportAsHTML: exportAsHTML,
    exportAsJSON: exportAsJSON,
    renderHistorySection: renderHistorySection,
    openHistoryPanel: openHistoryPanel,
    closeHistoryPanel: closeHistoryPanel,
    updateHistoryButton: updateHistoryButton,
  };

  S.logInfo("Persistence module loaded");
})();
