// ─── MathPixSessionRestorer File Handling Mixin ──────────────────────────────
// Drag/drop, ZIP handling, validation, and loading states.
// Depends on: session-restorer-core.js
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (!window._SRShared) {
    console.error(
      "[SessionRestorer] session-restorer-core.js must load before session-restorer-file-handling.js",
    );
    return;
  }

  const { logError, logWarn, logInfo, logDebug, getIcon, RESTORER_CONFIG } =
    window._SRShared;
  const proto = MathPixSessionRestorer.prototype;

  // =========================================================================
  // DRAG AND DROP HANDLING
  // =========================================================================

  /**
   * Handle dragover event
   * @param {DragEvent} e - Drag event
   * @private
   */
  proto.handleDragOver = function (e) {
    e.preventDefault();
    e.stopPropagation();
    this.elements.dropZone?.classList.add("drag-over");
  };

  /**
   * Handle dragleave event
   * @param {DragEvent} e - Drag event
   * @private
   */
  proto.handleDragLeave = function (e) {
    e.preventDefault();
    e.stopPropagation();
    this.elements.dropZone?.classList.remove("drag-over");
  };

  /**
   * Handle drop event
   * @param {DragEvent} e - Drop event
   * @private
   */
  proto.handleDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    this.elements.dropZone?.classList.remove("drag-over");

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleZIPFile(files[0]);
    }
  };

  /**
   * Trigger file input click
   * @private
   */
  proto.triggerFileSelect = function () {
    this.elements.fileInput?.click();
  };

  /**
   * Handle file input selection
   * @param {Event} e - Change event
   * @private
   */
  proto.handleFileSelect = function (e) {
    const files = e.target?.files;
    if (files && files.length > 0) {
      this.handleZIPFile(files[0]);
    }
    // Reset input so same file can be selected again
    if (this.elements.fileInput) {
      this.elements.fileInput.value = "";
    }
  };

  // =========================================================================
  // ZIP FILE HANDLING
  // =========================================================================

  /**
   * Handle ZIP file selection/drop
   * @param {File} file - ZIP file
   */
  proto.handleZIPFile = async function (file) {
    logInfo("Processing ZIP file:", file.name);

    // Phase 8F: Store raw file for image extraction in restoreSession
    this._rawZIPFile = file;

    // Validate file type
    if (!this.validateZIPFile(file)) {
      this.displayValidationMessages({
        errors: ["Please select a valid ZIP archive file (.zip)"],
        warnings: [],
      });
      return;
    }

    // Ensure parser is available
    if (!this.parser) {
      this.parser = window.getMathPixZIPParser?.();
      if (!this.parser) {
        this.displayValidationMessages({
          errors: ["ZIP parser not available. Please refresh the page."],
          warnings: [],
        });
        return;
      }
    }

    // Show loading state
    this.showLoadingState();

    try {
      // Parse ZIP file
      const parseResult = await this.parser.parse(file);
      logDebug("Parse result:", parseResult);

      // Store parse result
      this.parseResult = parseResult;

      // Hide loading state
      this.hideLoadingState();

      // Display errors/warnings
      if (parseResult.errors.length > 0 || parseResult.warnings.length > 0) {
        this.displayValidationMessages({
          errors: parseResult.errors,
          warnings: parseResult.warnings,
        });
      }

      // Check if valid
      if (!parseResult.valid) {
        logWarn("ZIP archive validation failed");
        return;
      }

      // Clear validation messages for valid ZIP
      this.clearValidationMessages();

      // Check for multiple edits and ambiguity
      if (parseResult.edits.hasEdits && parseResult.edits.files.length > 1) {
        // Check if any edits are ambiguous (don't match source pattern)
        const sourceFilename = parseResult.source?.filename || "";
        const hasAmbiguity = this.hasAmbiguousEdits(
          parseResult.edits.files,
          sourceFilename,
        );

        if (hasAmbiguity) {
          // Genuine ambiguity - user must choose
          logInfo("Ambiguous edits found, showing selection dialog");
          this.showEditSelectionDialog(parseResult.edits.files);
        } else {
          // All edits match source pattern - auto-restore most recent
          // User can access older versions via "Switch Version" button
          logInfo(
            "Multiple edits found, all match source - auto-restoring most recent",
          );
          const selectedEdit = parseResult.edits.mostRecent || null;
          await this.restoreSession(parseResult, selectedEdit);
        }
      } else {
        // Single edit or no edits - proceed directly
        const selectedEdit = parseResult.edits.mostRecent || null;
        await this.restoreSession(parseResult, selectedEdit);
      }
    } catch (error) {
      logError("Failed to parse ZIP:", error);
      this.hideLoadingState();
      this.displayValidationMessages({
        errors: [`Failed to parse ZIP archive: ${error.message}`],
        warnings: [],
      });
    }
  };

  /**
   * Validate file is a ZIP
   * @param {File} file - File to validate
   * @returns {boolean} True if valid ZIP file
   */
  proto.validateZIPFile = function (file) {
    if (!file) return false;

    const validTypes = RESTORER_CONFIG.VALID_ZIP_TYPES;
    const validExtension = file.name.toLowerCase().endsWith(".zip");

    return validTypes.includes(file.type) || validExtension;
  };

  /**
   * Show loading state during ZIP parsing
   * @private
   */
  proto.showLoadingState = function () {
    if (this.elements.dropZone) {
      this.elements.dropZone.innerHTML = `
        <div class="resume-loading-state">
          <div class="resume-loading-spinner" aria-hidden="true"></div>
          <p class="resume-loading-text">${RESTORER_CONFIG.MESSAGES.LOADING}</p>
        </div>
      `;
      this.elements.dropZone.setAttribute("aria-busy", "true");
    }
  };

  /**
   * Hide loading state and restore drop zone
   * @private
   */
  proto.hideLoadingState = function () {
    if (this.elements.dropZone) {
      this.elements.dropZone.innerHTML = `
        <div class="drop-zone-content">
          <svg aria-hidden="true" class="drop-zone-icon" viewBox="0 0 48 48" width="48" height="48">
            <path fill="currentColor" d="M40 12H22l-4-4H8c-2.21 0-4 1.79-4 4v24c0 2.21 1.79 4 4 4h32c2.21 0 4-1.79 4-4V16c0-2.21-1.79-4-4-4z"/>
          </svg>
          <p class="drop-zone-text">
            <strong>${RESTORER_CONFIG.MESSAGES.DROP_HINT}</strong>
            <span>${RESTORER_CONFIG.MESSAGES.ACCEPTED_FILES}</span>
          </p>
        </div>
      `;
      this.elements.dropZone.removeAttribute("aria-busy");
    }
  };

  // =========================================================================
  // VALIDATION MESSAGES
  // =========================================================================

  /**
   * Display validation errors/warnings
   * @param {Object} messages - Object with errors and warnings arrays
   * @private
   */
  proto.displayValidationMessages = function (messages) {
    const container = this.elements.validationMessages;
    if (!container) return;

    const { errors = [], warnings = [] } = messages;

    if (errors.length === 0 && warnings.length === 0) {
      this.clearValidationMessages();
      return;
    }

    let html = "";

    // Add errors
    errors.forEach((error) => {
      html += `<div class="resume-validation-error" role="alert">${this.escapeHtml(
        error,
      )}</div>`;
    });

    // Add warnings
    warnings.forEach((warning) => {
      html += `<div class="resume-validation-warning">${this.escapeHtml(
        warning,
      )}</div>`;
    });

    container.innerHTML = html;
    container.hidden = false;

    // Set appropriate class
    container.classList.remove("has-errors", "has-warnings");
    if (errors.length > 0) {
      container.classList.add("has-errors");
    } else if (warnings.length > 0) {
      container.classList.add("has-warnings");
    }
  };

  /**
   * Clear validation messages
   * @private
   */
  proto.clearValidationMessages = function () {
    if (this.elements.validationMessages) {
      this.elements.validationMessages.innerHTML = "";
      this.elements.validationMessages.hidden = true;
      this.elements.validationMessages.classList.remove(
        "has-errors",
        "has-warnings",
      );
    }
  };

  console.log("[SessionRestorer] File handling mixin loaded");
})();
