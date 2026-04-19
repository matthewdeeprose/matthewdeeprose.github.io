// ─── MathPixSessionRestorer Session Manager Mixin ────────────────────────────
// Storage dashboard and session manager modal UI.
// Split from session-restorer-sessions.js (Phase 2 refactor).
// Depends on: session-restorer-core.js
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (!window._SRShared) {
    console.error(
      "[SessionRestorer] session-restorer-core.js must load before session-restorer-session-manager.js",
    );
    return;
  }

  const { logError, logWarn, logInfo, logDebug, getIcon, RESTORER_CONFIG } =
    window._SRShared;
  const proto = MathPixSessionRestorer.prototype;

  // =========================================================================
  // STORAGE DASHBOARD (Phase 9 Feature 1A)
  // =========================================================================

  /**
   * Update the storage usage dashboard
   * Scans localStorage for MathPix resume sessions, calculates sizes,
   * and updates the visual progress bar and summary text.
   * Called when resume mode is shown and after any session add/remove.
   */
  proto.updateStorageDashboard = function () {
    const bar = this.elements.storageBar;
    const summary = this.elements.storageSummary;
    const dashboard = this.elements.storageDashboard;
    if (!bar || !summary || !dashboard) return;

    // Calculate total localStorage usage (all keys, not just ours)
    let totalBytes = 0;
    let mathpixBytes = 0;
    let sessionCount = 0;
    const documentMap = new Map(); // baseName → { count, bytes }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      const keyBytes = (key.length + value.length) * 2; // UTF-16 encoding
      totalBytes += keyBytes;

      if (key.startsWith("mathpix-resume-session")) {
        mathpixBytes += keyBytes;
        sessionCount++;

        try {
          const data = JSON.parse(value);
          const filename =
            data.sourceFileName || data.sourceFilename || "Unknown";
          const baseName = filename.replace(/\.[^/.]+$/, "");
          const existing = documentMap.get(baseName) || {
            count: 0,
            bytes: 0,
          };
          existing.count++;
          existing.bytes += keyBytes;
          documentMap.set(baseName, existing);
        } catch {
          // Include unparseable entries in count but skip grouping
          const existing = documentMap.get("Corrupted entries") || {
            count: 0,
            bytes: 0,
          };
          existing.count++;
          existing.bytes += keyBytes;
          documentMap.set("Corrupted entries", existing);
        }
      }
    }

    // Hide dashboard if no sessions exist
    if (sessionCount === 0) {
      dashboard.hidden = true;
      return;
    }

    // Show dashboard
    dashboard.hidden = false;

    const maxBytes = 5 * 1024 * 1024; // ~5 MB typical browser cap
    const percentage = Math.min(100, (totalBytes / maxBytes) * 100);
    const mathpixMB = (mathpixBytes / (1024 * 1024)).toFixed(1);
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);

    bar.style.width = `${percentage}%`;
    bar.setAttribute("aria-valuenow", Math.round(percentage));

    // Colour coding via CSS classes (colour is never sole indicator)
    bar.classList.remove(
      "resume-storage-bar-ok",
      "resume-storage-bar-warning",
      "resume-storage-bar-danger",
    );
    if (percentage > 85) {
      bar.classList.add("resume-storage-bar-danger");
    } else if (percentage > 60) {
      bar.classList.add("resume-storage-bar-warning");
    } else {
      bar.classList.add("resume-storage-bar-ok");
    }

    const docCount = documentMap.size;
    const sessionLabel = sessionCount !== 1 ? "sessions" : "session";
    const docLabel = docCount !== 1 ? "documents" : "document";
    summary.textContent = `${mathpixMB} MB used by ${sessionCount} ${sessionLabel} across ${docCount} ${docLabel} (${totalMB} MB total of ~5 MB limit)`;

    logDebug("Storage dashboard updated:", {
      sessionCount,
      docCount,
      mathpixMB,
      totalMB,
      percentage: Math.round(percentage),
    });
  };

  // =========================================================================
  // SESSION MANAGER (Phase 9 Feature 1B)
  // =========================================================================

  /**
   * Collect all MathPix resume sessions from localStorage.
   * Returns an array of session info objects without loading full session data.
   * @returns {Array<{key: string, filename: string, baseName: string, lastModified: number, bytes: number}>}
   * @private
   */
  proto._collectAllSessions = function () {
    const sessions = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key.startsWith("mathpix-resume-session")) continue;

      try {
        const value = localStorage.getItem(key);
        const bytes = (key.length + value.length) * 2; // UTF-16
        const data = JSON.parse(value);
        const filename =
          data.sourceFileName || data.sourceFilename || "Unknown";
        const baseName = filename.replace(/\.[^/.]+$/, "");

        sessions.push({
          key,
          filename,
          baseName,
          lastModified: data.lastModified || 0,
          bytes,
        });
      } catch {
        // Corrupted entry — still include so user can delete it
        const value = localStorage.getItem(key) || "";
        sessions.push({
          key,
          filename: "Corrupted entry",
          baseName: "Corrupted entry",
          lastModified: 0,
          bytes: (key.length + value.length) * 2,
        });
      }
    }

    // Sort newest first
    sessions.sort((a, b) => b.lastModified - a.lastModified);
    return sessions;
  };

  /**
   * Group sessions by their base document name.
   * @param {Array} sessions - Array from _collectAllSessions()
   * @returns {Map<string, {sessions: Array, totalBytes: number}>} Grouped sessions
   * @private
   */
  proto._groupSessionsByDocument = function (sessions) {
    const groups = new Map();

    for (const session of sessions) {
      if (!groups.has(session.baseName)) {
        groups.set(session.baseName, { sessions: [], totalBytes: 0 });
      }
      const group = groups.get(session.baseName);
      group.sessions.push(session);
      group.totalBytes += session.bytes;
    }

    return groups;
  };

  /**
   * Format byte count as human-readable string.
   * @param {number} bytes - Byte count
   * @returns {string} Formatted size (e.g. "1.2 MB", "340 KB")
   * @private
   */
  proto._formatBytes = function (bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * Show the Session Manager modal.
   * Lists all saved sessions grouped by document with checkboxes for deletion.
   * Sessions for the currently loaded document are marked as protected.
   */
  proto.showSessionManager = function () {
    const allSessions = this._collectAllSessions();
    const groups = this._groupSessionsByDocument(allSessions);

    // Identify the currently loaded session key (if any)
    const currentKey =
      this.restoredSession?.loadedFromKey ||
      this.restoredSession?.storageKey ||
      this.restoredSession?.sessionKey ||
      null;

    logInfo(
      `Opening session manager: ${allSessions.length} sessions, ${groups.size} documents, currentKey: ${currentKey}`,
    );

    // Build the modal content HTML
    const contentHTML = this._buildSessionManagerHTML(
      groups,
      allSessions.length,
      currentKey,
    );

    // Create and open modal
    const modal = new UniversalModal.Modal({
      title: "Manage Saved Sessions",
      content: contentHTML,
      size: "large",
      className: "session-manager-modal",
      closeOnOverlayClick: true,
      onOpen: () => {
        // Attach event listeners after modal renders
        requestAnimationFrame(() => {
          this._attachSessionManagerEvents(modal, currentKey);

          // Populate icons in dynamically generated content
          if (typeof populateIcons === "function") {
            const dialogEl = document.querySelector(
              "dialog[open].universal-modal",
            );
            if (dialogEl) populateIcons(dialogEl);
          }
        });
      },
      onClose: () => {
        logDebug("Session manager modal closed");
      },
    });

    modal.open();
  };

  /**
   * Build the HTML content for the session manager modal.
   * @param {Map} groups - Grouped sessions from _groupSessionsByDocument()
   * @param {number} totalCount - Total number of sessions
   * @param {string|null} currentKey - Currently loaded session key (protected)
   * @returns {string} HTML string
   * @private
   */
  proto._buildSessionManagerHTML = function (groups, totalCount, currentKey) {
    if (totalCount === 0) {
      return `<div class="session-manager-content">
        <p class="session-manager-empty">No saved sessions found.</p>
      </div>`;
    }

    let html = `<div class="session-manager-content">`;

    // Toolbar: Select All + Delete button
    html += `<div class="session-manager-toolbar">
      <label class="session-manager-select-all">
        <input type="checkbox" id="sm-select-all"
          aria-label="Select all sessions for deletion" />
        Select all (${totalCount})
      </label>
      <button type="button"
        id="sm-delete-btn"
        class="session-manager-delete-btn"
        disabled
        aria-live="polite">
        <span aria-hidden="true" data-icon="trash"></span>
        <span id="sm-delete-text">Delete Selected (0)</span>
      </button>
    </div>`;

    // Document groups
    let groupIndex = 0;
    for (const [baseName, group] of groups) {
      const groupId = `sm-group-${groupIndex}`;
      const groupSessions = group.sessions;
      const groupSize = this._formatBytes(group.totalBytes);
      const sessionLabel = groupSessions.length !== 1 ? "sessions" : "session";
      const collapsible = groupSessions.length > 5;
      const visibleCount = collapsible ? 3 : groupSessions.length;

      html += `<fieldset class="session-manager-group" data-group="${groupIndex}">`;

      // Group header with checkbox — using <legend> for semantic grouping
      html += `<legend class="session-manager-group-header">
        <input type="checkbox" id="${groupId}-cb"
          class="sm-group-checkbox"
          data-group="${groupIndex}" />
        <label for="${groupId}-cb" class="session-manager-group-title">
          <span aria-hidden="true" data-icon="document"></span>
          ${this.escapeHtml(baseName)}
        </label>
        <span class="session-manager-group-meta">
          ${groupSessions.length} ${sessionLabel} · ${groupSize}
        </span>
      </legend>`;

      // Session list — build a helper to render one session item
      const renderSessionItem = (session) => {
        const isProtected = session.key === currentKey;
        const sessionSize = this._formatBytes(session.bytes);
        const dateStr = session.lastModified
          ? new Date(session.lastModified).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Unknown date";
        const protectedClass = isProtected
          ? " session-manager-item-protected"
          : "";

        return `<li class="session-manager-item${protectedClass}"
          data-group="${groupIndex}"
          data-session-key="${this.escapeHtml(session.key)}">
          <label class="session-manager-item-label">
            <input type="checkbox"
              class="sm-session-checkbox"
              data-group="${groupIndex}"
              data-session-key="${this.escapeHtml(session.key)}"
              ${isProtected ? "disabled" : ""}
              aria-label="${isProtected ? "Currently loaded session — cannot delete" : `Select session from ${dateStr}`}" />
            <span class="session-manager-item-info">
              <span class="session-manager-item-date">${dateStr}</span>
              <span class="session-manager-item-size">(${sessionSize})</span>
              ${isProtected ? '<span class="session-manager-item-badge session-manager-item-badge-active">currently loaded</span>' : ""}
            </span>
          </label>
        </li>`;
      };

      if (collapsible) {
        // Show first few items, then overflow in <details>
        html += `<ul class="session-manager-list" role="list">`;
        for (let i = 0; i < visibleCount; i++) {
          html += renderSessionItem(groupSessions[i]);
        }
        html += `</ul>`;

        const remainingCount = groupSessions.length - visibleCount;
        html += `<details class="session-manager-overflow">
          <summary class="session-manager-toggle-summary">
            Show ${remainingCount} more session${remainingCount !== 1 ? "s" : ""}
          </summary>
          <ul class="session-manager-list" role="list">`;
        for (let i = visibleCount; i < groupSessions.length; i++) {
          html += renderSessionItem(groupSessions[i]);
        }
        html += `</ul></details>`;
      } else {
        // All sessions visible — single list
        html += `<ul class="session-manager-list" role="list">`;
        for (let i = 0; i < groupSessions.length; i++) {
          html += renderSessionItem(groupSessions[i]);
        }
        html += `</ul>`;
      }

      html += `</fieldset>`;
      groupIndex++;
    }

    html += `</div>`;
    return html;
  };

  /**
   * Attach event listeners to the session manager modal content.
   * @param {Object} modal - UniversalModal.Modal instance
   * @param {string|null} currentKey - Currently loaded session key (protected)
   * @private
   */
  proto._attachSessionManagerEvents = function (modal, currentKey) {
    const modalEl = document.querySelector("dialog[open].universal-modal");
    if (!modalEl) {
      logWarn("Could not find open modal for event attachment");
      return;
    }

    const selectAllCb = modalEl.querySelector("#sm-select-all");
    const deleteBtn = modalEl.querySelector("#sm-delete-btn");
    const deleteText = modalEl.querySelector("#sm-delete-text");

    if (!selectAllCb || !deleteBtn || !deleteText) {
      logWarn("Session manager controls not found in modal");
      return;
    }

    /**
     * Update the delete button text and state based on current selection count.
     */
    const updateDeleteButton = () => {
      const checked = modalEl.querySelectorAll(
        ".sm-session-checkbox:checked:not(:disabled)",
      );
      const count = checked.length;
      deleteText.textContent = `Delete Selected (${count})`;
      deleteBtn.disabled = count === 0;
    };

    /**
     * Sync group checkbox state with its child session checkboxes.
     * @param {number} groupIndex - Group index to sync
     */
    const syncGroupCheckbox = (groupIndex) => {
      const groupCb = modalEl.querySelector(
        `.sm-group-checkbox[data-group="${groupIndex}"]`,
      );
      if (!groupCb) return;

      const sessionCbs = modalEl.querySelectorAll(
        `.sm-session-checkbox[data-group="${groupIndex}"]:not(:disabled)`,
      );
      const checkedCbs = modalEl.querySelectorAll(
        `.sm-session-checkbox[data-group="${groupIndex}"]:checked:not(:disabled)`,
      );

      if (sessionCbs.length === 0) {
        groupCb.checked = false;
        groupCb.indeterminate = false;
      } else if (checkedCbs.length === sessionCbs.length) {
        groupCb.checked = true;
        groupCb.indeterminate = false;
      } else if (checkedCbs.length > 0) {
        groupCb.checked = false;
        groupCb.indeterminate = true;
      } else {
        groupCb.checked = false;
        groupCb.indeterminate = false;
      }
    };

    /**
     * Sync the "Select All" checkbox with all group checkboxes.
     */
    const syncSelectAll = () => {
      const allCbs = modalEl.querySelectorAll(
        ".sm-session-checkbox:not(:disabled)",
      );
      const allChecked = modalEl.querySelectorAll(
        ".sm-session-checkbox:checked:not(:disabled)",
      );

      if (allCbs.length === 0) {
        selectAllCb.checked = false;
        selectAllCb.indeterminate = false;
      } else if (allChecked.length === allCbs.length) {
        selectAllCb.checked = true;
        selectAllCb.indeterminate = false;
      } else if (allChecked.length > 0) {
        selectAllCb.checked = false;
        selectAllCb.indeterminate = true;
      } else {
        selectAllCb.checked = false;
        selectAllCb.indeterminate = false;
      }
    };

    // ---- Select All checkbox ----
    selectAllCb.addEventListener("change", () => {
      const isChecked = selectAllCb.checked;
      const allCbs = modalEl.querySelectorAll(
        ".sm-session-checkbox:not(:disabled)",
      );
      allCbs.forEach((cb) => {
        cb.checked = isChecked;
      });

      // Sync all group checkboxes
      const groupCbs = modalEl.querySelectorAll(".sm-group-checkbox");
      groupCbs.forEach((cb) => {
        const groupIdx = cb.dataset.group;
        syncGroupCheckbox(groupIdx);
      });

      updateDeleteButton();
    });

    // ---- Group checkboxes ----
    const groupCheckboxes = modalEl.querySelectorAll(".sm-group-checkbox");
    groupCheckboxes.forEach((groupCb) => {
      groupCb.addEventListener("change", () => {
        const groupIndex = groupCb.dataset.group;
        const isChecked = groupCb.checked;
        const sessionCbs = modalEl.querySelectorAll(
          `.sm-session-checkbox[data-group="${groupIndex}"]:not(:disabled)`,
        );
        sessionCbs.forEach((cb) => {
          cb.checked = isChecked;
        });

        syncSelectAll();
        updateDeleteButton();
      });
    });

    // ---- Individual session checkboxes (event delegation on modal body) ----
    modalEl.addEventListener("change", (e) => {
      if (e.target.classList.contains("sm-session-checkbox")) {
        const groupIndex = e.target.dataset.group;
        syncGroupCheckbox(groupIndex);
        syncSelectAll();
        updateDeleteButton();
      }
    });

    // ---- Delete button ----
    deleteBtn.addEventListener("click", async () => {
      const checked = modalEl.querySelectorAll(
        ".sm-session-checkbox:checked:not(:disabled)",
      );
      const count = checked.length;
      if (count === 0) return;

      // Collect keys to delete
      const keysToDelete = [];
      checked.forEach((cb) => {
        keysToDelete.push(cb.dataset.sessionKey);
      });

      // Confirm deletion
      const sessionWord = count !== 1 ? "sessions" : "session";
      const confirmed = await window.safeConfirm(
        `Permanently delete ${count} saved ${sessionWord}? This cannot be undone.`,
        "Delete Sessions",
      );

      if (!confirmed) return;

      // Perform deletion
      let deletedCount = 0;
      for (const key of keysToDelete) {
        try {
          localStorage.removeItem(key);
          deletedCount++;
          logDebug("Deleted session:", key);
        } catch (error) {
          logError("Failed to delete session:", key, error);
        }
      }

      logInfo(`Deleted ${deletedCount} of ${count} sessions`);

      // Refresh the modal content
      const freshSessions = this._collectAllSessions();
      const freshGroups = this._groupSessionsByDocument(freshSessions);
      const freshHTML = this._buildSessionManagerHTML(
        freshGroups,
        freshSessions.length,
        currentKey,
      );
      modal.setContent(freshHTML);

      // Re-attach events (content was replaced)
      requestAnimationFrame(() => {
        this._attachSessionManagerEvents(modal, currentKey);

        if (typeof populateIcons === "function") {
          const dialogEl = document.querySelector(
            "dialog[open].universal-modal",
          );
          if (dialogEl) populateIcons(dialogEl);
        }
      });

      // Update the storage dashboard behind the modal
      this.updateStorageDashboard();

      // Notify user
      const deleteWord = deletedCount !== 1 ? "sessions" : "session";
      this.showNotification(
        `Deleted ${deletedCount} ${deleteWord}.`,
        "success",
      );

      // If all sessions were deleted, close the modal
      if (freshSessions.length === 0) {
        modal.close();
      }
    });

    logDebug("Session manager events attached");
  };

  console.log("[SessionRestorer] Session manager mixin loaded");
})();
