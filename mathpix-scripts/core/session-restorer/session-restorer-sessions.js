// ─── MathPixSessionRestorer Sessions Mixin ───────────────────────────────────
// Session discovery, banners, recovery, visibility, image save warnings.
// Cache API image persistence moved to session-restorer-images.js
// Storage dashboard and session manager moved to session-restorer-session-manager.js
// Depends on: session-restorer-core.js
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  "use strict";

  if (!window._SRShared) {
    console.error(
      "[SessionRestorer] session-restorer-core.js must load before session-restorer-sessions.js",
    );
    return;
  }

const { logError, logWarn, logInfo, logDebug, getIcon, RESTORER_CONFIG } =
    window._SRShared;
  const proto = MathPixSessionRestorer.prototype;

  // Lazy-diff threshold: if total diffable versions (localStorage + ZIP edits) is at or
  // below this number, compute all diffs eagerly on banner open for instant previews.
  // Above this number, diffs are computed on demand when the user selects an option.
  const EAGER_DIFF_THRESHOLD = 6;

  // =========================================================================
  // MODE VISIBILITY
  // =========================================================================

  /**
   * Show the resume mode interface
   */
  proto.show = function () {
    logDebug("Showing resume mode");

    if (!this.isInitialised) {
      this.initialise();
    }

    if (this.elements.container) {
      this.elements.container.style.display = "";
    }

    // Reset to upload state if no active session
    if (!this.restoredSession) {
      this.resetToUploadState();
    }

    // Update storage dashboard (Phase 9 Feature 1A)
    this.updateStorageDashboard();
  };

  /**
   * Check for existing localStorage sessions matching the uploaded ZIP
   * Called after ZIP parsing to offer recovery of unsaved edits
   * Returns ALL matching sessions sorted by lastModified (newest first)
   * @param {string} sourceFilename - Filename from the uploaded ZIP
   * @returns {Array} Array of matching sessions, or empty array
   * @private
   */
  proto.checkForMatchingSessions = function (sourceFilename) {
    if (!sourceFilename) return [];

    logDebug("Checking for matching localStorage sessions:", sourceFilename);

    try {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith("mathpix-resume-session"),
      );

      const uploadedBaseName = sourceFilename.replace(/\.[^/.]+$/, "");
      const matchingSessions = [];

      for (const key of keys) {
        try {
          const data = JSON.parse(localStorage.getItem(key));

          // Handle both property name variants for backwards compatibility
          const storedName = data?.sourceFileName || data?.sourceFilename || "";
          const storedBaseName = storedName.replace(/\.[^/.]+$/, "");

          if (
            storedBaseName &&
            storedBaseName === uploadedBaseName &&
            data.current
          ) {
            matchingSessions.push({
              key,
              data,
              lastModified: data.lastModified || 0,
              contentLength: data.current?.length || 0,
            });
          }
        } catch (e) {
          logDebug("Skipping invalid localStorage entry:", key);
        }
      }

      // Sort by lastModified descending (newest first)
      matchingSessions.sort((a, b) => b.lastModified - a.lastModified);

      // Deduplicate sessions with identical content (keeps newest of each)
      const dedupedSessions = this.deduplicateSessions(matchingSessions);

      // Filter out sessions where user made no changes (current === baseline)
      // This catches sessions where user loaded but didn't edit, regardless of
      // minor whitespace differences between ZIP original and stored baseline
      const sessionsWithChanges = dedupedSessions.filter((session) => {
        const current = session.data?.current || "";
        const baseline = session.data?.baseline || "";

        // If no baseline stored, keep the session (older format)
        if (!baseline) return true;

        // Filter out if current equals baseline (no user edits made)
        return current !== baseline;
      });

      const filteredCount = dedupedSessions.length - sessionsWithChanges.length;

      logInfo(
        `Found ${sessionsWithChanges.length} localStorage session(s) with actual changes` +
          (filteredCount > 0
            ? ` (filtered ${filteredCount} with no edits)`
            : "") +
          (dedupedSessions.length !== matchingSessions.length
            ? ` (${matchingSessions.length} total before deduplication)`
            : ""),
      );
      return sessionsWithChanges;
    } catch (error) {
      logWarn("Error checking for matching sessions:", error);
      return [];
    }
  };

  /**
   * Remove duplicate sessions with identical content
   * Keeps sessions with actual edit value when duplicates are found
   * Prefers: 1) Sessions with user edits (current !== baseline)
   *          2) Legacy sessions without baseline (have real edit history)
   *          3) Newest session as fallback
   * @param {Array} sessions - Array of sessions sorted by lastModified (newest first)
   * @returns {Array} Deduplicated sessions array
   * @private
   */
  proto.deduplicateSessions = function (sessions) {
    if (!sessions || sessions.length <= 1) return sessions;

    // Group sessions by their current content
    const contentGroups = new Map();

    for (const session of sessions) {
      const content = session.data?.current || "";

      if (!contentGroups.has(content)) {
        contentGroups.set(content, []);
      }
      contentGroups.get(content).push(session);
    }

    const uniqueSessions = [];

    // For each group of sessions with identical content, pick the best one
    for (const [content, group] of contentGroups) {
      if (group.length === 1) {
        uniqueSessions.push(group[0]);
        continue;
      }

      // Score each session - higher is better
      const scored = group.map((session) => {
        const hasBaseline = !!session.data?.baseline;
        const baseline = session.data?.baseline || "";
        const current = session.data?.current || "";
        const hasUserEdits = hasBaseline && baseline !== current;
        const isLegacyWithEdits = !hasBaseline; // Legacy sessions without baseline have real edits

        let score = 0;
        if (hasUserEdits)
          score = 3; // Best: has baseline and user made changes
        else if (isLegacyWithEdits)
          score = 2; // Good: legacy session with edit history
        else if (hasBaseline) score = 1; // OK: has baseline but no changes yet
        // else score = 0: no baseline, probably broken

        return { session, score };
      });

      // Sort by score (descending), then by lastModified (newest first) as tiebreaker
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.session.lastModified || 0) - (a.session.lastModified || 0);
      });

      // Keep the best session from this group
      uniqueSessions.push(scored[0].session);

      logDebug(
        `Deduplicated ${group.length} sessions with identical content, ` +
          `kept session with score ${scored[0].score}`,
      );
    }

    const removedCount = sessions.length - uniqueSessions.length;
    if (removedCount > 0) {
      logDebug(
        `Deduplicated sessions: removed ${removedCount} duplicate(s), ` +
          `keeping ${uniqueSessions.length} unique version(s)`,
      );
    }

    // Re-sort by lastModified (newest first) since Map iteration order doesn't preserve timestamp sort
    uniqueSessions.sort(
      (a, b) => (b.lastModified || 0) - (a.lastModified || 0),
    );

    return uniqueSessions;
  };

  // =========================================================================
  // BANNER HELPER METHODS (extracted for maintainability and future lazy-diff)
  // =========================================================================

  /**
   * Find the most recent version across localStorage sessions and ZIP edits.
   * Pure logic — no DOM, no HTML.
   *
   * @param {Array} sessions - localStorage sessions
   * @param {Array} zipEdits - ZIP edit entries
   * @returns {{ source: string, index: number, timestamp: number }|null}
   * @private
   */
  proto._findMostRecentVersion = function (sessions, zipEdits) {
    const allTimestamps = [];

    // Collect localStorage timestamps
    sessions.forEach((session, index) => {
      if (session.lastModified) {
        allTimestamps.push({
          source: "localStorage",
          index: index,
          timestamp: new Date(session.lastModified).getTime(),
        });
      }
    });

    // Collect ZIP edit timestamps
    zipEdits.forEach((edit, index) => {
      if (edit.timestamp) {
        allTimestamps.push({
          source: "zipEdit",
          index: -2 - index,
          timestamp: new Date(edit.timestamp).getTime(),
        });
      }
    });

    const mostRecentItem =
      allTimestamps.length > 0
        ? allTimestamps.reduce((newest, current) =>
            current.timestamp > newest.timestamp ? current : newest,
          )
        : null;

    logDebug("Most recent item across all sources:", mostRecentItem);
    return mostRecentItem;
  };

  /**
   * Render a single localStorage session as a radio option HTML string.
   * Contains diff computation — future lazy-diff target.
   *
   * @param {Object} session - localStorage session object
   * @param {number} index - Session index (0+)
   * @param {Object} context - { mostRecentItem, currentSessionIndex, originalMMD }
   * @returns {string} HTML string for this option
   * @private
   */
  proto._renderSessionOption = function (session, index, context) {
    const { mostRecentItem, currentSessionIndex, originalMMD } = context;

    const date = new Date(session.lastModified);
    const isoDateTime = date.toISOString();
    const dateStr = date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timeStr = date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const sizeKB = Math.round((session.contentLength / 1024) * 10) / 10;
    const isNewest =
      mostRecentItem?.source === "localStorage" &&
      mostRecentItem?.index === index;
    const isCurrent = index === currentSessionIndex;

// Eager diff for small version counts; lazy placeholder for large counts.
    // Future extensibility: a cheap summary stat (e.g. character length delta) could be
    // added here as a data-diff-hint attribute or inline text without running the full diff.
    let diffContent = "Select to preview changes";
if (context.eagerDiff) {
      const comparisonContent = session.data?.baseline || originalMMD;
      const diffResult = this.computeDiff(session.data?.current, comparisonContent);
      if (this._distinguishingLines?.has(index)) {
        diffResult.distinguishingLine = this._distinguishingLines.get(index);
      }
      diffContent = this.renderDiffPreview(diffResult);
      this._diffCache.set(index, diffContent);
    }
    const previewHTML = `<span class="resume-session-preview" data-diff-index="${index}" data-diff-type="localStorage">${diffContent}</span>`;
    return `
        <label class="resume-session-option resume-session-option-localstorage ${
          isNewest ? "resume-session-option-newest" : ""
        } ${isCurrent ? "resume-session-option-current" : ""}">
          <input type="radio" name="resume-session-choice" value="${index}" ${
            isNewest && currentSessionIndex === null ? "checked" : ""
          } ${isCurrent ? "checked" : ""}>
          <span class="resume-session-option-content">
<time class="resume-session-option-date" datetime="${isoDateTime}">
              <span class="resume-session-source-icon">${getIcon(session.data?.aiEnhanced ? "aiSparkle" : "disk")}</span>
              <span class="visually-hidden">${session.data?.aiEnhanced ? "AI enhanced, browser storage: " : "Browser storage: "}</span>
              ${this.escapeHtml(dateStr)} at ${this.escapeHtml(timeStr)}
            </time>
            ${
              isNewest
                ? '<strong class="resume-session-badge">Most Recent</strong>'
                : ""
            }
            ${
              isCurrent
                ? '<strong class="resume-session-badge resume-session-badge-current">Currently Loaded</strong>'
                : ""
            }
            ${previewHTML}
            <span class="resume-session-option-size">${sizeKB} KB</span>
          </span>
        </label>
      `;
  };

  /**
   * Render a single ZIP edit as a radio option HTML string.
   * Contains diff computation — future lazy-diff target.
   *
   * @param {Object} edit - ZIP edit object
   * @param {number} index - Edit array index (0-based; converted to -2-N scheme internally)
   * @param {Object} context - { mostRecentItem, currentSessionIndex, originalMMD }
   * @returns {string} HTML string for this option
   * @private
   */
  proto._renderZipEditOption = function (edit, index, context) {
    const { mostRecentItem, currentSessionIndex, originalMMD } = context;

    const editIndex = -2 - index; // -2, -3, -4, etc.
    const date = edit.timestamp ? new Date(edit.timestamp) : null;
    const isoDateTime = date ? date.toISOString() : "";
    const dateStr = date
      ? date.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "Unknown date";
    const timeStr = date
      ? date.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    const sizeKB = edit.content
      ? Math.round((edit.content.length / 1024) * 10) / 10
      : 0;
    const isCurrent = editIndex === currentSessionIndex;

// Eager diff for small version counts; lazy placeholder for large counts.
    // Future extensibility: a cheap summary stat could be shown here without the full diff.
    let diffContent = "Select to preview changes";
if (context.eagerDiff) {
      const diffResult = this.computeDiff(edit.content, originalMMD);
      if (this._distinguishingLines?.has(editIndex)) {
        diffResult.distinguishingLine = this._distinguishingLines.get(editIndex);
      }
      diffContent = this.renderDiffPreview(diffResult);
      this._diffCache.set(editIndex, diffContent);
    }
    const previewHTML = `<span class="resume-session-preview" data-diff-index="${editIndex}" data-diff-type="zipEdit">${diffContent}</span>`;

    // Build date/time display with semantic <time> element when date is available
    const dateTimeDisplay = date
      ? `<time class="resume-session-option-date" datetime="${isoDateTime}">${getIcon(
          "pencil",
        )} ZIP Edit: ${this.escapeHtml(dateStr)}${
          timeStr ? ` at ${this.escapeHtml(timeStr)}` : ""
        }</time>`
      : `<span class="resume-session-option-date">${getIcon(
          "pencil",
        )} ZIP Edit: ${this.escapeHtml(dateStr)}</span>`;

    // Check if this ZIP edit is the globally most recent
    const isNewest =
      mostRecentItem?.source === "zipEdit" &&
      mostRecentItem?.index === editIndex;

    return `
        <label class="resume-session-option resume-session-option-zip-edit ${
          isCurrent ? "resume-session-option-current" : ""
        } ${isNewest ? "resume-session-option-newest" : ""}">
          <input type="radio" name="resume-session-choice" value="${editIndex}" ${
            isCurrent ? "checked" : ""
          }>
          <span class="resume-session-option-content">
            ${dateTimeDisplay}
            ${
              isNewest
                ? '<strong class="resume-session-badge">Most Recent</strong>'
                : ""
            }
            ${
              isCurrent
                ? '<strong class="resume-session-badge resume-session-badge-current">Currently Loaded</strong>'
                : ""
            }
            ${previewHTML}
            <span class="resume-session-option-size">${sizeKB} KB</span>
          </span>
        </label>
      `;
  };

  /**
   * Attach all event listeners to the session recovery banner.
   *
   * @param {HTMLElement} banner - The banner element
   * @param {Object} options - { isReshow, onRestore, onDismiss, currentSessionIndex }
   * @private
   */
  proto._attachBannerEventListeners = function (banner, options) {
    const { isReshow, onRestore, onDismiss } = options;

    document
      .getElementById("resume-session-restore-btn")
      ?.addEventListener("click", () => {
        const selectedIndex = this.getSelectedSessionIndex();

        if (selectedIndex === -1) {
          // User chose ZIP original (results folder)
          banner.remove();
          this.loadZIPContents();
          this._currentSessionIndex = -1;
        } else if (selectedIndex <= -2) {
          // User chose a ZIP edit (index -2, -3, etc.)
          const editIndex = Math.abs(selectedIndex) - 2;
          const zipEdit = this._zipEdits?.[editIndex];
          if (zipEdit) {
            banner.remove();
            this.loadZIPEdit(zipEdit);
            this._currentSessionIndex = selectedIndex;
          }
        } else if (
          selectedIndex !== null &&
          selectedIndex >= 0 &&
          this._recoverySessions[selectedIndex]
        ) {
          // User chose a localStorage session
          const selected = this._recoverySessions[selectedIndex];
          banner.remove();
          this._currentSessionIndex = selectedIndex;
          if (onRestore) onRestore({ key: selected.key, data: selected.data });
        }

        // Show the switch button after loading
        this.showSwitchVersionButton();
      });

    document
      .getElementById("resume-session-close-btn")
      ?.addEventListener("click", () => {
        banner.remove();
        // Show switch button so user can reopen
        if (isReshow || this._currentSessionIndex !== null) {
          this.showSwitchVersionButton();
        }
      });

    document
      .getElementById("resume-session-clear-local-btn")
      ?.addEventListener("click", () => {
        this.clearLocalSavesForCurrentZIP(banner);
      });

    document
      .getElementById("resume-session-close-action-btn")
      ?.addEventListener("click", () => {
        banner.remove();
        // Show switch button so user can reopen
        if (isReshow || this._currentSessionIndex !== null) {
          this.showSwitchVersionButton();
        }
        if (!isReshow && onDismiss) onDismiss();
      });

// Lazy-diff: event delegation — compute diff when a radio option is selected
    const optionsFieldset = banner.querySelector(".resume-session-options");
    if (optionsFieldset) {
      optionsFieldset.addEventListener("change", (e) => {
        if (e.target.type === "radio" && e.target.name === "resume-session-choice") {
          const label = e.target.closest(".resume-session-option");
          const previewEl = label?.querySelector(".resume-session-preview[data-diff-index]");
          if (previewEl) {
            this._computeLazyDiff(previewEl, { silent: false });
          }
        }
      });

      // Auto-trigger diff for the pre-selected (checked) option — silent, no screen reader announcement
      const checkedRadio = optionsFieldset.querySelector("input[name='resume-session-choice']:checked");
      if (checkedRadio) {
        const checkedLabel = checkedRadio.closest(".resume-session-option");
        const checkedPreview = checkedLabel?.querySelector(".resume-session-preview[data-diff-index]");
        if (checkedPreview) {
          this._computeLazyDiff(checkedPreview, { silent: true });
        }
      }
    }

    // Hide switch button while banner is open
    this.hideSwitchVersionButton();
  };

  /**
   * Compute diff on demand for a session preview element.
   * Checks an instance cache to avoid re-computing for previously viewed options.
   * Called when a radio button is selected, or auto-triggered for the pre-selected option.
   *
   * @param {HTMLElement} previewElement - The .resume-session-preview span with data attributes
   * @param {Object} options - { silent: boolean } — if true, skips screen reader announcement
   * @private
   */
  proto._computeLazyDiff = function (previewElement, options) {
    if (!previewElement) return;

    const diffIndex = parseInt(previewElement.getAttribute("data-diff-index"), 10);
    const diffType = previewElement.getAttribute("data-diff-type");
    const silent = options?.silent || false;

    if (isNaN(diffIndex) || !diffType) {
      logWarn("_computeLazyDiff: missing or invalid data attributes on element");
      return;
    }

    // Check cache first
    if (!this._diffCache) {
      this._diffCache = new Map();
    }

    if (this._diffCache.has(diffIndex)) {
      previewElement.innerHTML = this._diffCache.get(diffIndex);
      if (!silent) {
        this.announceToScreenReader("Change preview loaded");
      }
      return;
    }

    // Resolve comparison content based on type
    const originalMMD = this.restoredSession?.originalMMD || "";
    let current = "";
    let comparison = "";

    if (diffType === "localStorage") {
      const session = this._recoverySessions?.[diffIndex];
      if (!session) {
        logWarn("_computeLazyDiff: no localStorage session at index", diffIndex);
        return;
      }
      current = session.data?.current || "";
      comparison = session.data?.baseline || originalMMD;
    } else if (diffType === "zipEdit") {
      const editArrayIndex = Math.abs(diffIndex) - 2;
      const edit = this._zipEdits?.[editArrayIndex];
      if (!edit) {
        logWarn("_computeLazyDiff: no ZIP edit at index", diffIndex);
        return;
      }
      current = edit.content || "";
      comparison = originalMMD;
    } else {
      logWarn("_computeLazyDiff: unknown diff type:", diffType);
      return;
    }

// Compute and cache
    const diffResult = this.computeDiff(current, comparison);
    // Inject cross-referenced distinguishing line if available
    if (this._distinguishingLines?.has(diffIndex)) {
      diffResult.distinguishingLine = this._distinguishingLines.get(diffIndex);
    }
    const html = this.renderDiffPreview(diffResult);

    this._diffCache.set(diffIndex, html);
    previewElement.innerHTML = html;

    if (!silent) {
      this.announceToScreenReader("Change preview loaded");
    }
};

/**
   * Compute a distinguishing line for each version using pairwise comparison.
   * Compares each version against the next-older version to find lines that
   * were added in that specific edit session. This captures progressive edits
   * (e.g. user adds one line per save) even when those lines appear across
   * multiple newer versions.
   *
   * Results are stored in this._distinguishingLines (Map<versionIndex, string>).
   * Called once in showSessionRecoveryBanner; consumed by _computeLazyDiff
   * and the eager-diff path in _renderSessionOption / _renderZipEditOption.
   *
   * @param {Array} sessions - localStorage sessions
   * @param {Array} zipEdits - ZIP edit entries
   * @param {string} originalMMD - Original MMD content (common base)
   * @private
   */
  proto._computeDistinguishingLines = function (sessions, zipEdits, originalMMD) {
    this._distinguishingLines = new Map();

    // Build version list with content and timestamps
    const versions = [];

    sessions.forEach((session, i) => {
      versions.push({
        index: i,
        timestamp: session.lastModified || 0,
        content: session.data?.current || "",
      });
    });

    zipEdits.forEach((edit, i) => {
      versions.push({
        index: -2 - i,
        timestamp: edit.timestamp ? new Date(edit.timestamp).getTime() : 0,
        content: edit.content || "",
      });
    });

    if (versions.length < 2) return;

    // Sort newest first by timestamp
    versions.sort((a, b) => b.timestamp - a.timestamp);

    const maxLen = 50;
    const truncate = (str) =>
      str.length > maxLen ? str.substring(0, maxLen - 1) + "…" : str;

    // Pairwise comparison: find lines added since the next-older version
    for (let v = 0; v < versions.length; v++) {
      const currentLines = versions[v].content
        .split("\n").map((l) => l.trim()).filter((l) => l);

      // Compare against next-older version, or original if this is the oldest edit
      const olderContent =
        v < versions.length - 1 ? versions[v + 1].content : (originalMMD || "");
      const olderSet = new Set(
        olderContent.split("\n").map((l) => l.trim()).filter((l) => l),
      );

      const addedLines = currentLines.filter((l) => !olderSet.has(l));

      if (addedLines.length > 0) {
        // Prefer first substantive line (>3 chars) — in document order this is
        // typically the user's most visible edit, near the top of their changes
        const best =
          addedLines.find((l) => l.length > 3) || addedLines[0];
        this._distinguishingLines.set(versions[v].index, truncate(best));
      }
    }

    logDebug(
      `Distinguishing lines computed for ${this._distinguishingLines.size} of ${versions.length} versions`,
    );
  };

  // =========================================================================
  // SESSION RECOVERY BANNER (orchestrator)
  // =========================================================================
  /**
   * Show the session recovery banner with available versions.
   * Orchestrates helper methods for rendering and event binding.
   * Includes localStorage sessions, ZIP edits, and ZIP original.
   *
   * @param {Array} sessions - localStorage sessions
   * @param {Function} onRestore - Callback for restore action
   * @param {Function} onDismiss - Callback for dismiss action
   * @param {Object} options - Display options (isReshow, currentSessionIndex)
   */
  proto.showSessionRecoveryBanner = function (
    sessions,
    onRestore,
    onDismiss,
    options,
  ) {
    options = options || {};
    const isReshow = options.isReshow || false;
    const currentSessionIndex =
      options.currentSessionIndex !== undefined
        ? options.currentSessionIndex
        : null;

    logDebug("[SessionRestorer] showSessionRecoveryBanner called:", {
      sessionCount: sessions?.length,
      isReshow,
      currentSessionIndex,
      options,
    });

// Clear lazy-diff cache on each show/re-show
    this._diffCache = new Map();

    // Remove any existing banner first
    const existingBanner = document.getElementById("resume-session-banner");
    if (existingBanner) {
      existingBanner.remove();
    }

    // Create banner element
    const banner = document.createElement("div");
    banner.id = "resume-session-banner";
    banner.className = "resume-session-banner";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-labelledby", "resume-session-banner-title");

    // Gather data
    const zipEdits = this.parseResult?.edits?.files || [];
    const originalMMD = this.restoredSession?.originalMMD || "";

    // Find the globally most recent version across all sources
    const mostRecentItem = this._findMostRecentVersion(sessions, zipEdits);

// Build shared context for rendering helpers
    // Eager diff for small version counts — instant previews without selection
    const diffableCount = sessions.length + zipEdits.length;
    const eagerDiff = diffableCount <= EAGER_DIFF_THRESHOLD;
    const context = { mostRecentItem, currentSessionIndex, originalMMD, eagerDiff };

    // Cross-reference unique lines across all versions (cheap line-level operation)
    // Must run before rendering helpers so _distinguishingLines is populated
    this._computeDistinguishingLines(sessions, zipEdits, originalMMD);

    // Render option groups via helpers
    const localStorageOptionsHTML = sessions
      .map((session, index) =>
        this._renderSessionOption(session, index, context),
      )
      .join("");

    const zipEditsOptionsHTML = zipEdits
      .map((edit, index) => this._renderZipEditOption(edit, index, context))
      .join("");

    // ZIP original option (inline — simple static template)
    const zipPreview = this.getContentPreview(originalMMD);
    const zipOriginalOptionHTML = `
      <label class="resume-session-option resume-session-option-zip ${
        currentSessionIndex === -1 ? "resume-session-option-current" : ""
      }">
        <input type="radio" name="resume-session-choice" value="-1" ${
          currentSessionIndex === -1 ? "checked" : ""
        }>
<span class="resume-session-option-content">
          <span class="resume-session-option-date">
            ${getIcon("box")} ZIP Original (Results)
          </span>
          ${
            currentSessionIndex === -1
              ? '<strong class="resume-session-badge resume-session-badge-current">Currently Loaded</strong>'
              : ""
          }
          <span class="resume-session-preview">${getIcon(
            "document",
          )} ${this.escapeHtml(zipPreview)}</span>
          <span class="resume-session-option-size">Original</span>
        </span>
      </label>
    `;

    // Assemble all options with dividers
    const hasLocalStorage = sessions && sessions.length > 0;
    const hasZipEdits = zipEdits.length > 0;
    let optionsHTML = "";

    if (hasLocalStorage) {
      optionsHTML += localStorageOptionsHTML;
    }

    if (hasZipEdits) {
      if (hasLocalStorage) {
        optionsHTML += `
          <div class="resume-session-options-divider">
            <span>or use ZIP saved edit${zipEdits.length > 1 ? "s" : ""}</span>
          </div>
        `;
      }
      optionsHTML += zipEditsOptionsHTML;
    }

    optionsHTML += `
      <div class="resume-session-options-divider">
        <span>or use original</span>
      </div>
    `;
    optionsHTML += zipOriginalOptionHTML;

    // Build banner content
    const totalVersions = (sessions?.length || 0) + zipEdits.length + 1;
    const titleText = isReshow ? "Switch Version" : "Unsaved Edits Found";
    const messageText = isReshow
      ? `You can switch between ${totalVersions} available version${
          totalVersions > 1 ? "s" : ""
        }.`
      : `Found previous edits for this document. Would you like to restore one?`;

    banner.innerHTML = `
      <div class="resume-session-banner-header">
        <h3 id="resume-session-banner-title">
          ${isReshow ? getIcon("refresh") : getIcon("disk")} ${titleText}
        </h3>
        <button type="button" 
                id="resume-session-close-btn" 
                class="resume-session-close-btn"
                aria-label="Close version selector">
          ${getIcon("close")}
        </button>
      </div>
      
      <p id="resume-session-banner-message">${messageText}</p>
      
      <fieldset class="resume-session-options">
        <legend class="visually-hidden">Select a version to load</legend>
        ${optionsHTML}
      </fieldset>
      
<div class="resume-session-banner-actions">
        <button type="button" id="resume-session-restore-btn" class="resume-btn resume-btn-primary">
          ${getIcon("returnArrow")} Load Selected
        </button>
        <button type="button" id="resume-session-clear-local-btn" class="resume-btn resume-btn-secondary">
          ${getIcon("trash")} Clear Local Saves
        </button>
        <button type="button" id="resume-session-close-action-btn" class="resume-btn resume-btn-secondary">
          Cancel
        </button>
      </div>
    `;

    // Insert at top of working area
    if (this.elements.workingArea) {
      this.elements.workingArea.insertBefore(
        banner,
        this.elements.workingArea.firstChild,
      );
    }

    // Store references for restore action
    this._recoverySessions = sessions;
    this._zipEdits = zipEdits;
    this._currentSessionIndex = currentSessionIndex;

    // Attach event listeners via helper
    this._attachBannerEventListeners(banner, {
      isReshow,
      onRestore,
      onDismiss,
      currentSessionIndex,
    });

    logInfo("Session recovery banner shown with", sessions.length, "options");
  };

  /**
   * Show an informational banner after auto-restoring the most recent localStorage session
   * This replaces the selection banner when auto-restore is enabled
   *
   * @param {Object} restoredSession - The session that was auto-restored
   * @param {number} restoredSession.lastModified - Timestamp of the restored session
   * @param {string} restoredSession.key - Storage key of the restored session
   * @param {Object} restoredSession.data - Session data
   * @private
   */
  proto.showAutoRestoredBanner = function (restoredSession) {
    logDebug("Showing auto-restored banner for session:", restoredSession?.key);

    // Remove any existing banners first
    const existingBanner = document.getElementById("resume-session-banner");
    if (existingBanner) {
      existingBanner.remove();
    }
    const existingAutoBanner = document.getElementById(
      "resume-auto-restored-banner",
    );
    if (existingAutoBanner) {
      existingAutoBanner.remove();
    }

    // Format the restoration date/time
    const restoredDate = new Date(restoredSession.lastModified);
    const isoDateTime = restoredDate.toISOString();
    const dateStr = restoredDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timeStr = restoredDate.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Create the banner element
    const banner = document.createElement("div");
    banner.id = "resume-auto-restored-banner";
    banner.className = "resume-auto-restored-banner";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    banner.setAttribute("aria-labelledby", "resume-auto-restored-title");

    banner.innerHTML = `
    <div class="resume-auto-restored-header">
      <h3 id="resume-auto-restored-title">
        ${getIcon("disk")} Restored from Browser Storage
      </h3>
      <button type="button" 
              id="resume-auto-restored-close-btn" 
              class="resume-session-close-btn"
              aria-label="Dismiss restoration notice">
        ${getIcon("close")}
      </button>
    </div>
    
    <p id="resume-auto-restored-message">
      Your most recent edit 
      (<time datetime="${isoDateTime}">${this.escapeHtml(
        dateStr,
      )} at ${this.escapeHtml(timeStr)}</time>) 
      was automatically loaded. Browser storage is temporary — download a ZIP 
      to save your work permanently.
    </p>
    
    <div class="resume-auto-restored-actions">
      <button type="button" 
              id="resume-auto-restored-download-btn" 
              class="resume-btn resume-btn-primary">
        ${getIcon("box")} Download ZIP
      </button>
      <button type="button" 
              id="resume-auto-restored-switch-btn" 
              class="resume-btn resume-btn-secondary">
        ${getIcon("refresh")} Switch Version
      </button>
      <button type="button" 
              id="resume-auto-restored-dismiss-btn" 
              class="resume-btn resume-btn-tertiary">
        Dismiss
      </button>
    </div>
  `;

    // Insert at top of working area
    if (this.elements.workingArea) {
      this.elements.workingArea.insertBefore(
        banner,
        this.elements.workingArea.firstChild,
      );
    }

    // Set up event listeners
    this.setupAutoRestoredBannerListeners(banner);

    // Announce to screen readers
    this.announceToScreenReader(
      `Your edit from ${dateStr} at ${timeStr} was automatically restored from browser storage.`,
    );

    logInfo("Auto-restored banner shown for session from:", dateStr, timeStr);
  };

  /**
   * Set up event listeners for the auto-restored banner buttons
   * @param {HTMLElement} banner - The banner element
   * @private
   */
  proto.setupAutoRestoredBannerListeners = function (banner) {
    // Download ZIP button
    const downloadBtn = document.getElementById(
      "resume-auto-restored-download-btn",
    );
    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => {
        logDebug("Download ZIP clicked from auto-restored banner");
        this.triggerDownloadZIP();
      });
    }

    // Switch Version button
    const switchBtn = document.getElementById(
      "resume-auto-restored-switch-btn",
    );
    if (switchBtn) {
      switchBtn.addEventListener("click", () => {
        logDebug("Switch Version clicked from auto-restored banner");
        banner.remove();
        this.reshowSessionSelector();
      });
    }

    // Dismiss button
    const dismissBtn = document.getElementById(
      "resume-auto-restored-dismiss-btn",
    );
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        logDebug("Dismiss clicked on auto-restored banner");
        this.dismissAutoRestoredBanner(banner);
      });
    }

    // Close (X) button
    const closeBtn = document.getElementById("resume-auto-restored-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        logDebug("Close clicked on auto-restored banner");
        this.dismissAutoRestoredBanner(banner);
      });
    }
  };

  /**
   * Dismiss the auto-restored banner and show the Switch Version button
   * @param {HTMLElement} banner - The banner element to remove
   * @private
   */
  proto.dismissAutoRestoredBanner = function (banner) {
    banner.remove();
    // Show the Switch Version button so user can still access version switching
    this.showSwitchVersionButton();
  };

  /**
   * Trigger the Download ZIP functionality
   * Uses the existing Total Downloader if available
   * @private
   */
  proto.triggerDownloadZIP = function () {
    // Try to get the Total Downloader instance
    const downloader = window.getMathPixTotalDownloader?.();

    if (downloader && typeof downloader.downloadAll === "function") {
      // Use the Total Downloader
      downloader.downloadAll();
    } else if (this.elements.downloadAllBtn) {
      // Fall back to clicking the download button
      this.elements.downloadAllBtn.click();
    } else {
      logWarn("Download ZIP not available - no downloader or button found");
      this.showNotification(
        "Download is not available at this time. Please try again later.",
        "warning",
      );
    }
  };

  // NOTE: announceToScreenReader is defined in session-restorer-editor.js
  // (the runtime winner from the original monolith). Removed from here to
  // eliminate dead code. If this file's methods need screen reader
  // announcements, they call this.announceToScreenReader() which resolves
  // to the editor version on the shared prototype.

  // =========================================================================
  // IMAGE SAVE WARNING (Phase 9 Feature 1C)
  // =========================================================================

  /**
   * Show the image save warning banner.
   * Called after any image mutation (add, swap, delete).
   */
  proto.showImageSaveWarning = function () {
    // Only announce on first trigger (avoid repeated announcements)
    const wasAlreadyShowing = this.hasUnsavedImageChanges;
    this.hasUnsavedImageChanges = true;
    if (this.elements.imageSaveWarning) {
      this.elements.imageSaveWarning.hidden = false;
    }
    // Belt-and-braces: explicit screen reader announcement on first show
    if (!wasAlreadyShowing) {
      this.announceToScreenReader(
        "Warning: You have made changes to images. Download an updated ZIP to make your changes safe across sessions.",
      );
    }
    logDebug("Image save warning shown");
  };

  /**
   * Dismiss the image save warning banner.
   * Note: does NOT clear hasUnsavedImageChanges — only ZIP download does that.
   */
  proto.dismissImageSaveWarning = function () {
    if (this.elements.imageSaveWarning) {
      this.elements.imageSaveWarning.hidden = true;
    }
    logDebug("Image save warning dismissed (flag still set)");
  };

  /**
   * Clear the image save warning completely (flag + banner).
   * Called after a successful ZIP download.
   * @private
   */
  proto._clearImageSaveWarning = function () {
    this.hasUnsavedImageChanges = false;
    if (this.elements.imageSaveWarning) {
      this.elements.imageSaveWarning.hidden = true;
    }
    logDebug("Image save warning cleared (ZIP downloaded)");
  };

  /**
   * Load the original ZIP contents (discard localStorage version)
   * @private
   */
  proto.loadZIPContents = function () {
    logInfo("Loading original ZIP contents (results folder)");

    const originalMMD = this.restoredSession?.originalMMD;

    if (originalMMD) {
      // Reset to original content
      this.restoredSession.currentMMD = originalMMD;
      this.restoredSession.baselineMMD = originalMMD;

      // Fix 9: Rebuild registry from original MMD to purge ghost entries.
      // After reconcileRecoveredImages() runs during auto-restore, the registry
      // may contain ghost entries (user-added images from a previous session).
      // The originalMMD only references the 'real' ZIP images, so any registry
      // entry not referenced in originalMMD is a ghost and must be removed.
      if (this.imageRegistry) {
        const originalImageUrls = new Set();
        const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
        let match;
        while ((match = imgRegex.exec(originalMMD)) !== null) {
          originalImageUrls.add(match[1]);
        }

        // Remove registry entries that aren't referenced in original MMD
        const allImages = this.imageRegistry.getAllImages();
        for (const img of allImages) {
          const blobUrl =
            this.imageBlobUrlMap?.get(img.originalUrl) || img.originalUrl;
          if (
            !originalImageUrls.has(blobUrl) &&
            !originalImageUrls.has(img.originalUrl)
          ) {
            logDebug(
              `loadZIPContents: purging ghost registry entry ${img.id} (status: ${img.status})`,
            );
            this.imageRegistry.removeImage(img.id);
          }
        }

        logInfo(
          `loadZIPContents: registry purged to ${this.imageRegistry.getCount()} image(s)`,
        );
      }

      // Reinitialise display layer with correct image count
      this.initialiseDisplayLayer(originalMMD);

      this.loadMMDContent(originalMMD, originalMMD);
      this.updateSessionStatus("saved");
      this.hasUnsavedChanges = false;

      // Update manage images button state (count may have changed)
      this.updateManageImagesButtonState();

      this.showNotification("Loaded original ZIP contents", "success");
    }
  };

  /**
   * Load a specific ZIP edit
   * @param {Object} zipEdit - ZIP edit object with content and metadata
   * @private
   */
  proto.loadZIPEdit = function (zipEdit) {
    logInfo("Loading ZIP edit:", zipEdit.filename || "unknown");

    const originalMMD = this.restoredSession?.originalMMD;
    let editContent = zipEdit.content;

    if (editContent) {
      // Phase 8H.3: Rewrite relative image paths to blob URLs for display
      editContent = this.rewriteRelativePathsToBlobUrls(editContent);
      // Also apply standard CDN→blob rewriting (for any CDN URLs in the content)
      editContent = this.rewriteMMDWithBlobUrls(editContent);

      this.restoredSession.currentMMD = editContent;
      this.restoredSession.baselineMMD = editContent;
      this.restoredSession.selectedEdit = zipEdit;

      // Fix F12: Purge ghost registry entries not referenced in the ZIP edit.
      // Same pattern as Fix 9 (loadZIPContents). The registry was built from
      // the ZIP's image-registry.json but the edit may reference a different
      // set of images (e.g. user added images in a later session that aren't
      // in this edit's MMD).
      if (this.imageRegistry) {
        const editImageUrls = new Set();
        const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
        let match;
        while ((match = imgRegex.exec(editContent)) !== null) {
          editImageUrls.add(match[1]);
        }

        const allImages = this.imageRegistry.getAllImages();
        let purgedCount = 0;
        for (const img of allImages) {
          const blobUrl =
            this.imageBlobUrlMap?.get(img.originalUrl) || img.originalUrl;
          // Also check relative path from filenameMap (ZIP edits store relative paths)
          const fnEntry = this.imageFilenameMap?.[img.id];
          const relativePath = fnEntry?.filename
            ? `images/${fnEntry.filename}`
            : null;
          const isReferenced =
            editImageUrls.has(blobUrl) ||
            editImageUrls.has(img.originalUrl) ||
            (relativePath && editImageUrls.has(relativePath));
          if (!isReferenced) {
            logDebug(
              `loadZIPEdit: purging ghost registry entry ${img.id} (status: ${img.status})`,
            );
            this.imageRegistry.removeImage(img.id);
            purgedCount++;
          }
        }
        if (purgedCount > 0) {
          logInfo(
            `loadZIPEdit: purged ${purgedCount} ghost registry entry/entries`,
          );
        }
      }

      // Reinitialise display layer with correct image count
      this.initialiseDisplayLayer(editContent);

      this.loadMMDContent(editContent, originalMMD);
      this.updateSessionStatus("saved");
      this.hasUnsavedChanges = false;

      // Update manage images button state (count may have changed)
      this.updateManageImagesButtonState();

      const dateStr = zipEdit.timestamp
        ? new Date(zipEdit.timestamp).toLocaleString("en-GB")
        : "unknown date";
      this.showNotification(`Loaded ZIP edit from ${dateStr}`, "success");
    }
  };

  /**
   * Show the "Switch Version" button near session controls
   * @private
   */
  proto.showSwitchVersionButton = function () {
    // Check if button already exists
    let switchBtn = document.getElementById("resume-switch-version-btn");

    if (!switchBtn) {
      // Find a suitable container - prefer the header area with New Session button
      const newSessionBtn = this.elements.newSessionBtn;
      const container =
        newSessionBtn?.parentElement || this.elements.workingArea;

      if (!container) {
        logWarn("Cannot show switch version button - no container found");
        return;
      }

      // Create the button
      switchBtn = document.createElement("button");
      switchBtn.type = "button";
      switchBtn.id = "resume-switch-version-btn";
      switchBtn.className =
        "resume-btn resume-btn-secondary resume-switch-version-btn";
      switchBtn.innerHTML = `${getIcon("refresh")} Switch Version`;
      switchBtn.title = "Switch to a different saved version";

      switchBtn.addEventListener("click", () => this.reshowSessionSelector());

      // Insert before the New Session button if possible, otherwise at start of container
      if (newSessionBtn && newSessionBtn.parentElement === container) {
        container.insertBefore(switchBtn, newSessionBtn);
      } else {
        container.insertBefore(switchBtn, container.firstChild);
      }

      logDebug("Switch version button created");
    }

    // DEFENSIVE: Ensure button is truly visible
    switchBtn.hidden = false;
    switchBtn.style.display = ""; // Clear any inline display:none
    switchBtn.removeAttribute("aria-hidden");

    logDebug("Switch version button shown", {
      hidden: switchBtn.hidden,
      display: getComputedStyle(switchBtn).display,
    });
  };

  /**
   * Hide the "Switch Version" button
   * @private
   */
  proto.hideSwitchVersionButton = function () {
    const switchBtn = document.getElementById("resume-switch-version-btn");
    if (switchBtn) {
      switchBtn.hidden = true;
    }
  };

  /**
   * Show the "Download Updated ZIP" button when session has edits
   * @private
   */
  proto.showDownloadUpdatedButton = function () {
    // Check if button already exists
    let downloadBtn = document.getElementById("resume-download-updated-btn");

    if (!downloadBtn) {
      // Find a suitable container - prefer the header area with New Session button
      const newSessionBtn = this.elements.newSessionBtn;
      const container =
        newSessionBtn?.parentElement || this.elements.workingArea;

      if (!container) {
        logWarn("Cannot show download updated button - no container found");
        return;
      }

      // Create the button
      downloadBtn = document.createElement("button");
      downloadBtn.type = "button";
      downloadBtn.id = "resume-download-updated-btn";
      downloadBtn.className =
        "resume-btn resume-btn-primary resume-download-updated-btn";
      downloadBtn.innerHTML = `${getIcon("download")} Download Updated ZIP`;
      downloadBtn.title = "Download ZIP archive with your edits";

      downloadBtn.addEventListener("click", () =>
        this.triggerUpdatedZIPDownload(),
      );

      // Insert at the start of container (before other buttons)
      const switchBtn = document.getElementById("resume-switch-version-btn");
      if (switchBtn && switchBtn.parentElement === container) {
        container.insertBefore(downloadBtn, switchBtn);
      } else if (newSessionBtn && newSessionBtn.parentElement === container) {
        container.insertBefore(downloadBtn, newSessionBtn);
      } else {
        container.insertBefore(downloadBtn, container.firstChild);
      }

      logDebug("Download updated button created");
    }

    // Ensure button is visible
    downloadBtn.hidden = false;
    downloadBtn.style.display = "";
    downloadBtn.removeAttribute("aria-hidden");

    logDebug("Download updated button shown");
  };

  /**
   * Hide the "Download Updated ZIP" button
   * @private
   */
  proto.hideDownloadUpdatedButton = function () {
    const downloadBtn = document.getElementById("resume-download-updated-btn");
    if (downloadBtn) {
      downloadBtn.hidden = true;
    }
  };

  /**
   * Trigger download of updated ZIP with edits
   * @private
   */
  proto.triggerUpdatedZIPDownload = async function () {
    logInfo("Triggering updated ZIP download...");

    try {
      // Use the existing downloadUpdatedZIP method which handles everything
      await this.downloadUpdatedZIP();
    } catch (error) {
      logError("Failed to trigger updated ZIP download:", error);
      this.showNotification(
        "Failed to download ZIP: " + error.message,
        "error",
      );
    }
  };

  /**
   * Reshow the session selector banner
   * @private
   */
  proto.reshowSessionSelector = function () {
    const sourceFilename = this.restoredSession?.source?.filename;
    if (!sourceFilename) {
      logWarn("Cannot reshow session selector - no source filename");
      return;
    }

    // Get all matching sessions (not just newer ones)
    const allSessions = this.checkForMatchingSessions(sourceFilename);

    // Filter to only sessions with actual user edits (current !== baseline)
    const sessionsWithEdits = allSessions.filter((session) => {
      const baseline = session.data?.baseline || session.data?.original;
      const current = session.data?.current;
      return baseline !== current;
    });

    logDebug("Session filtering:", {
      total: allSessions.length,
      withEdits: sessionsWithEdits.length,
    });

    // Check if there's anything to switch to
    const zipEdits = this.parseResult?.edits?.files || [];
    const hasZipOptions = zipEdits.length > 0; // Has ZIP edits besides original

    if (sessionsWithEdits.length === 0 && !hasZipOptions) {
      this.showNotification("No alternative versions available", "info");
      return;
    }

    // Store sessions reference for validation (use filtered list)
    this._recoverySessions = sessionsWithEdits;

    // DEFENSIVE: Validate _currentSessionIndex against actual content
    const actualVersion = this.getCurrentVersionType();
    if (actualVersion.index !== this._currentSessionIndex) {
      logWarn(
        `Index mismatch in reshowSessionSelector: stored=${this._currentSessionIndex}, actual=${actualVersion.index}`,
      );
      this._currentSessionIndex = actualVersion.index;
    }

    logDebug("Reshowing session selector", {
      sessionCount: allSessions.length,
      currentIndex: this._currentSessionIndex,
      versionType: actualVersion.type,
    });

    // Show banner with validated current selection
    this.showSessionRecoveryBanner(
      sessionsWithEdits,
      (sessionInfo) => this.applyRecoveredSession(sessionInfo),
      () => logDebug("Session selector closed"),
      {
        isReshow: true,
        currentSessionIndex: this._currentSessionIndex,
      },
    );
  };

  /**
   * Get the index of the selected session from radio buttons
   * @returns {number|null} Selected index or null
   * @private
   */
  proto.getSelectedSessionIndex = function () {
    const selected = document.querySelector(
      'input[name="resume-session-choice"]:checked',
    );
    if (selected) {
      return parseInt(selected.value, 10);
    }
    return null;
  };

  /**
   * Clear multiple stored sessions from localStorage
   * @param {Array} sessions - Sessions to clear
   * @private
   */
  proto.clearMatchingSessions = function (sessions) {
    sessions.forEach((session) => {
      try {
        localStorage.removeItem(session.key);
        logDebug("Cleared stored session:", session.key);
      } catch (error) {
        logWarn("Failed to clear stored session:", session.key, error);
      }
    });
  };

  /**
   * Clear a stored session from localStorage
   * @param {string} key - Session storage key
   * @private
   */
  proto.clearStoredSession = function (key) {
    try {
      localStorage.removeItem(key);
      logDebug("Cleared stored session:", key);
    } catch (error) {
      logWarn("Failed to clear stored session:", error);
    }
  };

  /**
   * Apply recovered localStorage edits to current session
   * @param {Object} sessionInfo - Session info with recovered data
   * @private
   */
  proto.applyRecoveredSession = async function (sessionInfo) {
    logInfo("Applying recovered session edits");

    const data = sessionInfo.data;

    // Update current session with recovered edits
    if (this.restoredSession && data.current) {
      this.restoredSession.currentMMD = data.current;

      // Phase 8G: Normalise stored content to CDN URLs, then rewrite to fresh blob URLs
      // Stored content may contain: CDN URLs (post-fix), fresh blobs (current session),
      // or stale blobs (previous page loads that getMMDForAPI cannot reverse)
      if (this.imageBlobUrlMap.size > 0 && this.restoredSession.currentMMD) {
        // Step 1: Try standard normalisation (handles CDN URLs and fresh blob URLs)
        let normalisedContent = this.getMMDForAPI(
          this.restoredSession.currentMMD,
        );

        // Step 2: If stale blob URLs remain, fall back to positional replacement
        // using CDN URLs from the raw ZIP original (which was never rewritten)
        if (normalisedContent.includes("blob:")) {
          const rawZipMMD = this.restoredSession.results?.mmd || "";
          const cdnUrls = [];
          const cdnRegex = /https:\/\/cdn\.mathpix\.com\/[^\s)}"\\]+/g;
          let match;
          while ((match = cdnRegex.exec(rawZipMMD)) !== null) {
            cdnUrls.push(match[0]);
          }

          if (cdnUrls.length > 0) {
            let urlIndex = 0;
            normalisedContent = normalisedContent.replace(
              /blob:[^\s)}"\\]+/g,
              () => (urlIndex < cdnUrls.length ? cdnUrls[urlIndex++] : ""),
            );
            logInfo(
              `Replaced ${urlIndex} stale blob URL(s) via positional matching`,
            );
          }
        }

        // Step 3: Rewrite relative paths (from Phase 8H.3 ZIP saves) to blob URLs
        normalisedContent =
          this.rewriteRelativePathsToBlobUrls(normalisedContent);

        // Step 4: Rewrite CDN URLs to fresh blob URLs for local display
        this.restoredSession.currentMMD =
          this.rewriteMMDWithBlobUrls(normalisedContent);
        logDebug("Normalised and rewrote image URLs in recovered session");
      }

      // Step 5 (Phase 8H.3): Reconcile recovered images — resolve placeholders and legacy data URIs
      // Phase 9 Feature 2: Pre-fetch cached images for placeholder resolution
      const cachedImages = await this._prefetchCachedImages();
      this.restoredSession.currentMMD = this.reconcileRecoveredImages(
        this.restoredSession.currentMMD,
        cachedImages,
      );

      // Step 5b: Generate dataUris for cache-recovered images
      // reconcileRecoveredImages is synchronous so cannot await FileReader;
      // do it here where we have an async context.
      const allImages = this.imageRegistry?.getAllImages() || [];
      for (const img of allImages) {
        if (
          (img.source === "cache-recovery" || img.source === "user-upload") &&
          !img.dataUri &&
          img.blob instanceof Blob
        ) {
          try {
            const dataUri = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(img.blob);
            });
            if (dataUri) {
              this.imageRegistry.replaceImage(img.id, { dataUri });
              logDebug(
                `Generated dataUri for recovered image ${img.id} (${(dataUri.length / 1024).toFixed(1)} KB)`,
              );
            }
          } catch (err) {
            logWarn(`Failed to generate dataUri for ${img.id}: ${err.message}`);
          }
        }
      }

      // Fix 13: Sync registry to recovered MMD — purge entries not in working content.
      // The registry was built from the ZIP's image-registry.json (all original images),
      // but the recovered MMD may have had images deleted by the user before refresh.
      // Without this sync, deleted images reappear as ghost entries in Image Manager.
      if (this.imageRegistry) {
        const workingMMD = this.restoredSession.currentMMD;
        const referencedUrls = new Set();
        const imgRefRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
        let refMatch;
        while ((refMatch = imgRefRegex.exec(workingMMD)) !== null) {
          referencedUrls.add(refMatch[1]);
        }

        const allImgs = this.imageRegistry.getAllImages();
        let purgedCount = 0;
        for (const img of allImgs) {
          const blobUrl =
            this.imageBlobUrlMap?.get(img.originalUrl) || img.originalUrl;
          if (
            !referencedUrls.has(blobUrl) &&
            !referencedUrls.has(img.originalUrl)
          ) {
            logDebug(
              `applyRecoveredSession: purging unreferenced registry entry ${img.id} (status: ${img.status})`,
            );
            this.imageRegistry.removeImage(img.id);
            purgedCount++;
          }
        }
        if (purgedCount > 0) {
          logInfo(
            `applyRecoveredSession: purged ${purgedCount} unreferenced registry entry/entries`,
          );
        }
      }

      this.restoredSession.loadedFromKey = sessionInfo.key;

      // Copy undo/redo stacks — reconstitute stored URLs to blob URLs (Fix F13)
      // Stored entries use CDN URLs and [user-image:] placeholders (from getMMDForStorage).
      // Rewrite them to blob URLs so undo/redo works after a refresh.
      const reconstituteUndoEntry = (entry) => {
        if (typeof entry !== "string") return entry;
        // Step 1: CDN → blob for OCR images
        let reconstituted = this.rewriteMMDWithBlobUrls(entry);
        // Step 2: Resolve [user-image:] placeholders from registry
        if (this.imageRegistry && reconstituted.includes("[user-image:")) {
          const allImgs = this.imageRegistry.getAllImages();
          for (const img of allImgs) {
            if (
              img.source === "user-upload" ||
              img.status === "user-added" ||
              img.source === "cache-recovery"
            ) {
              if (!img.originalUrl) continue;
              const fnEntry = this.imageFilenameMap?.[img.id];
              const withFilename = fnEntry?.filename
                ? `[user-image:${img.id}|${fnEntry.filename}]`
                : null;
              const withoutFilename = `[user-image:${img.id}]`;
              if (withFilename) {
                reconstituted = reconstituted.replaceAll(
                  withFilename,
                  img.originalUrl,
                );
              }
              reconstituted = reconstituted.replaceAll(
                withoutFilename,
                img.originalUrl,
              );
            }
          }
        }
        return reconstituted;
      };

      this.undoStack = (data.undoStack || []).map(reconstituteUndoEntry);
      this.redoStack = (data.redoStack || []).map(reconstituteUndoEntry);

      // Load the recovered content into UI
      // Use rewritten currentMMD (blob URLs), not raw localStorage data (CDN URLs)
      this.loadMMDContent(
        this.restoredSession.currentMMD,
        this.restoredSession.originalMMD,
      );

      // Update UI state
      this.updateUndoRedoButtons();
      this.updateSessionStatus("saved");
      this.hasUnsavedChanges = false;

      // Show the switch version button
      this.showSwitchVersionButton();

      const date = new Date(data.lastModified).toLocaleString();
      this.showNotification(`Loaded version from ${date}`, "success");
    }
  };

  /**
   * Hide the resume mode interface
   */
  proto.hide = function () {
    logDebug("Hiding resume mode");

    if (this.elements.container) {
      this.elements.container.style.display = "none";
    }
  };

  console.log("[SessionRestorer] Sessions mixin loaded");
})();
