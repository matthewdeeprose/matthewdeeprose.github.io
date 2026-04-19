// ─── MathPixSessionRestorer Edit Dialog Mixin ────────────────────────────────
// Edit selection dialog.
// Depends on: session-restorer-core.js
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (!window._SRShared) {
    console.error(
      "[SessionRestorer] session-restorer-core.js must load before session-restorer-edit-dialog.js",
    );
    return;
  }

  const { logError, logWarn, logInfo, logDebug, getIcon, RESTORER_CONFIG } =
    window._SRShared;
  const proto = MathPixSessionRestorer.prototype;

  // =========================================================================
  // EDIT SELECTION
  // =========================================================================

  /**
   * Show edit selection dialog when multiple edits exist
   * @param {Array} editFiles - Available edit files
   * @private
   */
  proto.showEditSelectionDialog = function (editFiles) {
    logDebug("Showing edit selection dialog", { count: editFiles.length });

    // Hide upload section
    if (this.elements.uploadSection) {
      this.elements.uploadSection.hidden = true;
    }

    // Generate radio options
    const optionsContainer = this.elements.editOptions;
    if (optionsContainer) {
      // Find the most recent edit (for default selection)
      const mostRecent = this.parseResult?.edits?.mostRecent;
      const mostRecentFilename = mostRecent?.filename;

      // Get original MMD info for the "Load Original" option
      const originalMMD = this.parseResult?.results?.mmd;
      const originalLength = originalMMD?.length || 0;
      const sourceFilename = this.parseResult?.source?.filename || "source";

      let html = "";

      // Add "Load Original" option first
      html += this.generateOriginalOptionHTML(sourceFilename, originalLength);

      // Add separator
      html +=
        '<div class="edit-options-separator" role="separator"><span>Your Edits</span></div>';

      // Classify and add edit files
      editFiles.forEach((editFile, index) => {
        const isDefault = editFile.filename === mostRecentFilename;
        const editType = this.classifyEditFile(editFile, sourceFilename);
        html += this.generateEditOptionHTML(
          editFile,
          index,
          isDefault,
          editType,
        );
      });

      optionsContainer.innerHTML = html;
    }

    // Show dialog
    if (this.elements.editSelection) {
      this.elements.editSelection.hidden = false;

      // Focus the dialog for accessibility
      this.elements.editSelection.focus();
    }
  };

  /**
   * Generate HTML for the "Load Original" option
   * @param {string} sourceFilename - Source filename
   * @param {number} contentLength - Original MMD content length
   * @returns {string} HTML string
   * @private
   */
  proto.generateOriginalOptionHTML = function (sourceFilename, contentLength) {
    const baseName = sourceFilename.replace(/\.[^/.]+$/, "");
    const sizeInfo =
      contentLength > 0 ? ` (${contentLength.toLocaleString()} chars)` : "";

    return `
    <label class="resume-edit-option resume-edit-option-original">
      <input type="radio" name="resume-edit-choice" value="original">
      <span class="edit-option-content">
        <span class="edit-option-filename">
${getIcon("document")} Original MathPix Output
        </span>
        <span class="edit-option-timestamp">${this.escapeHtml(
          baseName,
        )}${sizeInfo}</span>
        <span class="edit-option-badge edit-option-badge-original">Original</span>
      </span>
    </label>
  `;
  };

  /**
   * Classify an edit file by its origin type
   * @param {Object} editFile - Edit file object
   * @param {string} sourceFilename - Original source filename
   * @returns {string} Edit type: 'imported', 'saved', or 'edit'
   * @private
   */
  proto.classifyEditFile = function (editFile, sourceFilename) {
    const filename = editFile.filename || "";
    const baseName = sourceFilename.replace(/\.[^/.]+$/, "");

    // Normalise for comparison (replace spaces with dashes, lowercase)
    const normalisedBase = baseName.toLowerCase().replace(/\s+/g, "-");
    const normalisedFilename = filename.toLowerCase();

    // Check for imported pattern: {basename}-imported-{timestamp}.mmd
    // This takes priority over other classifications
    if (/-imported-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.mmd$/i.test(filename)) {
      return "imported";
    }

    // Check if filename starts with the source basename (auto-collected edit)
    if (normalisedFilename.startsWith(normalisedBase)) {
      // But not if it's an imported file (already handled above)
      return "edit";
    }

    // Check if it has a timestamp pattern (saved file)
    const hasTimestamp = /-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}(-\d{2})?\.mmd$/.test(
      filename,
    );

    if (hasTimestamp) {
      return "saved";
    }

    // No timestamp, different name = legacy imported file (without renamed pattern)
    return "imported";
  };

  /**
   * Check if any edit files are ambiguous (don't clearly belong to this session)
   *
   * Ambiguity exists when edit files have names that don't match the source pattern.
   * Files matching the source are: {sourceBasename}-{timestamp}.mmd or {sourceBasename}-imported-{timestamp}.mmd
   *
   * @param {Array<Object>} editFiles - Array of edit file objects
   * @param {string} sourceFilename - Original source filename
   * @returns {boolean} True if there are ambiguous files requiring user selection
   * @private
   */
  proto.hasAmbiguousEdits = function (editFiles, sourceFilename) {
    if (!editFiles || editFiles.length === 0) {
      return false;
    }

    const baseName = sourceFilename.replace(/\.[^/.]+$/, "");

    // Normalise: lowercase, replace spaces with dashes, collapse multiple dashes
    const normalise = (str) =>
      str.toLowerCase().replace(/\s+/g, "-").replace(/-+/g, "-");
    const normalisedBase = normalise(baseName);

    logDebug("Checking for ambiguous edits:", {
      sourceFilename,
      normalisedBase,
      editCount: editFiles.length,
    });

    for (const editFile of editFiles) {
      const filename = editFile.filename || "";
      const normalisedFilename = normalise(filename);

      // Check if filename starts with normalised source base
      const matchesSource = normalisedFilename.startsWith(normalisedBase);

      if (!matchesSource) {
        logDebug("Ambiguous edit found:", {
          filename,
          normalisedFilename,
          normalisedBase,
          reason: "Does not start with source basename",
        });
        return true; // Found ambiguous file
      }
    }

    logDebug("No ambiguous edits - all files match source pattern");
    return false;
  };

  /**
   * Generate radio option HTML for an edit file
   * @param {Object} editFile - Edit file object
   * @param {number} index - Index in array
   * @param {boolean} isDefault - Whether this is the default (most recent)
   * @param {string} editType - Type of edit: 'imported', 'saved', or 'edit'
   * @returns {string} HTML string
   * @private
   */
  proto.generateEditOptionHTML = function (
    editFile,
    index,
    isDefault,
    editType = "edit",
  ) {
    const timestamp = editFile.timestamp
      ? editFile.timestamp.toLocaleString("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Unknown time";

    // Build badges HTML
    let badgesHtml = "";

    // Type badge with icon - using SVG icons for consistency
    const typeBadgeIcons = {
      imported: "inbox",
      saved: "disk",
      edit: "document",
    };

    const typeBadgeLabels = {
      imported: { label: "Imported", class: "edit-option-badge-imported" },
      saved: { label: "Saved", class: "edit-option-badge-saved" },
      edit: { label: "Edit", class: "edit-option-badge-edit" },
    };

    const iconName = typeBadgeIcons[editType] || "document";
    const typeInfo = typeBadgeLabels[editType] || typeBadgeLabels.edit;
    badgesHtml += `<span class="edit-option-badge ${typeInfo.class}">${getIcon(
      iconName,
    )} ${typeInfo.label}</span>`;

    // Most Recent badge (in addition to type badge)
    if (isDefault) {
      badgesHtml +=
        '<span class="edit-option-badge edit-option-badge-recent">Most Recent</span>';
    }

    // Build original filename info for imported files
    let originalFilenameHtml = "";
    if (editType === "imported" && editFile.originalFilename) {
      originalFilenameHtml = `<span class="edit-option-original-filename">Originally: ${this.escapeHtml(
        editFile.originalFilename,
      )}</span>`;
    }

    return `
    <label class="resume-edit-option resume-edit-option-${editType}">
      <input type="radio" name="resume-edit-choice" value="${index}" ${
        isDefault ? "checked" : ""
      }>
      <span class="edit-option-content">
        <span class="edit-option-filename">${this.escapeHtml(
          editFile.filename,
        )}</span>
        ${originalFilenameHtml}
        <span class="edit-option-timestamp">${this.escapeHtml(timestamp)}</span>
        <span class="edit-option-badges">${badgesHtml}</span>
      </span>
    </label>
  `;
  };

  /**
   * Confirm edit selection and proceed with restoration
   * @private
   */
  proto.confirmEditSelection = async function () {
    logDebug("Confirming edit selection");

    // Get selected edit
    const selectedRadio = document.querySelector(
      'input[name="resume-edit-choice"]:checked',
    );
    if (!selectedRadio) {
      logWarn("No edit selection made");
      return;
    }

    const selectedValue = selectedRadio.value;
    let selectedEdit = null;

    // Handle "original" option (value="original") vs edit index
    if (selectedValue === "original") {
      logInfo("Selected: Original MathPix output");
      selectedEdit = null; // null means load original
    } else {
      const selectedIndex = parseInt(selectedValue, 10);
      const editFiles = this.parseResult?.edits?.files || [];
      selectedEdit = editFiles[selectedIndex] || null;
      logInfo("Selected edit:", selectedEdit?.filename);
    }

    // Hide edit selection dialog
    this.hideEditSelectionDialog();

    // Proceed with restoration
    await this.restoreSession(this.parseResult, selectedEdit);
  };

  /**
   * Cancel edit selection and return to upload state
   * @private
   */
  proto.cancelEditSelection = function () {
    logDebug("Cancelling edit selection");

    this.hideEditSelectionDialog();
    this.resetToUploadState();
  };

  /**
   * Hide edit selection dialog
   * @private
   */
  proto.hideEditSelectionDialog = function () {
    if (this.elements.editSelection) {
      this.elements.editSelection.hidden = true;
    }
  };

  console.log("[SessionRestorer] Edit dialog mixin loaded");
})();
