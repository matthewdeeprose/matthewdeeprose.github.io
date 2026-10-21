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

  // S6-1g: the one line spoken when the Upload result has no document to hand over
  const BRIDGE_NO_DOCUMENT_LINE =
    "This result has no document to open in Resume mode.";

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
   * S6-1d: resolves to the restore outcome, {line, outcome, imageCount}, or to
   * {outcome: "error", line} when the archive could not be read. With
   * {quiet: true} it raises nothing: the outcome and the error are returned,
   * and the inline validation message is left unwritten.
   * @param {File} file - ZIP file
   * @param {{quiet?: boolean}} [options]
   * @returns {Promise<?{line: string, outcome: string, imageCount?: number}>}
   */
  proto.handleZIPFile = async function (file, { quiet = false } = {}) {
    logInfo("Processing ZIP file:", file.name);

    this.lastRestoreOutcome = null;

    // SV-1: a ZIP being opened is a saved document by definition; the hand-over
    // from Upload sets the flag again after this returns.
    this.setArchiveUnsaved(false);
    this.clearSaveStatus();

    // Phase 8F: Store raw file for image extraction in restoreSession
    this._rawZIPFile = file;

    // S6-1d: report a read failure inline (default) or hand it back (quiet).
    const readFailure = (line, errors = [line]) => {
      if (!quiet) this.displayValidationMessages({ errors, warnings: [] });
      return { outcome: "error", line };
    };

    // Validate file type
    if (!this.validateZIPFile(file)) {
      return readFailure("Please select a valid ZIP archive file (.zip)");
    }

    // Ensure parser is available
    if (!this.parser) {
      this.parser = window.getMathPixZIPParser?.();
      if (!this.parser) {
        return readFailure("ZIP parser not available. Please refresh the page.");
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
      if (
        !quiet &&
        (parseResult.errors.length > 0 || parseResult.warnings.length > 0)
      ) {
        this.displayValidationMessages({
          errors: parseResult.errors,
          warnings: parseResult.warnings,
        });
      }

      // Check if valid
      if (!parseResult.valid) {
        logWarn("ZIP archive validation failed");
        return {
          outcome: "error",
          line: parseResult.errors.join(" ") || "ZIP archive validation failed",
        };
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
          return { outcome: "choice-required", line: "The archive holds several edits and the person must choose one." };
        } else {
          // All edits match source pattern - auto-restore most recent
          // User can access older versions via "Switch Version" button
          logInfo(
            "Multiple edits found, all match source - auto-restoring most recent",
          );
          const selectedEdit = parseResult.edits.mostRecent || null;
          await this.restoreSession(parseResult, selectedEdit, { quiet });
        }
      } else {
        // Single edit or no edits - proceed directly
        const selectedEdit = parseResult.edits.mostRecent || null;
        await this.restoreSession(parseResult, selectedEdit, { quiet });
      }
      return this.lastRestoreOutcome;
    } catch (error) {
      logError("Failed to parse ZIP:", error);
      this.hideLoadingState();
      return readFailure(`Failed to parse ZIP archive: ${error.message}`);
    }
  };

  /**
   * S6-1d: the Upload-to-Resume hand-off as a callable. Builds the session
   * archive from the Upload result (non-interactive: no Health Check dialog),
   * wraps it as a File named for the PDF, switches to Resume quietly and
   * restores the File quietly. Raises nothing: the caller owns the one line.
   * S6-1e: the Open in Resume mode control calls it (download manager).
   * @returns {Promise<{report: Object, health: ?Object, restored: ?Object}>}
   */
  proto.bridgeUploadResultToResume = async function () {
    const controller = window.getMathPixController?.();
    const downloader = controller?.downloadManager?.downloader;
    if (!controller || !downloader) {
      throw new Error("The Upload result is not available to hand over");
    }

    const sourceState = downloader.getRealSourceState(controller);
    const response = downloader.getRealResponse(controller);
    const request = downloader.getRealRequest(controller);
    const debugData = downloader.getRealDebugData(controller);
    const linesData = controller.pdfResultRenderer?.getLinesData
      ? controller.pdfResultRenderer.getLinesData()
      : null;

    // S6-1g: the parser needs a .mmd document, and only a PDF result holds one.
    // A Text or Strokes result is refused here, before anything is built or switched.
    const hasDocument = !!response && typeof response.mmd === "string" && response.mmd.trim().length > 0;
    if (!hasDocument) {
      return {
        report: null,
        health: null,
        restored: { outcome: "refused", line: BRIDGE_NO_DOCUMENT_LINE },
      };
    }

    const built = await downloader.buildArchive(
      { sourceState, response, request, debugData, linesData },
      { interactive: false },
    );

    if (!built) throw new Error("The session archive could not be built");

    // SV-1 (P2 measured): named as the downloader names its own archive
    // ("<pdf>-mathpix.zip"), not "<pdf>.zip" as S6-1d did. The ZIP a person saves
    // after the hand-over, the File restored here and a later Resume-mode save then
    // share ONE base name, and a return visit matches stored sessions by it.
    const fileName = built.filename;
    const file = new File([built.blob], fileName, {
      type: "application/zip",
      lastModified: Date.now(),
    });

    controller.modeSwitcher.switchToResumeMode({ quiet: true });
    const restored = await this.handleZIPFile(file, { quiet: true });

    // S6-1e (B-D1): a no-edit session from an earlier hand-over of the same
    // result is dropped by the chooser filter and would pile up beside the new
    // one. Run after the restore because the archive's registry key is only
    // held once the restore has built it; the session now in use is kept.
    if (restored && restored.outcome !== "error" && restored.outcome !== "choice-required") {
      const sessionKey = this.restoredSession?.sessionKey;
      // SV-1: stored sessions carry the PDF name (parseResult.source.filename), not the
      // ZIP name, so the prune keys on that. It matched before only because the File was
      // named "<pdf>.zip"; with the ZIP named as the downloader names it, it must say so.
      this.pruneUnchangedSessions(this.restoredSession?.source?.filename || fileName, {
        keepKey: sessionKey ? `mathpix-resume-session-${sessionKey}` : null,
      });
    }

    // SV-1: after a successful hand-over the archive (PDF, original pictures)
    // exists only in memory, so the document counts as unsaved until a ZIP is saved.
    const succeeded =
      restored && restored.outcome !== "error" && restored.outcome !== "choice-required";
    if (succeeded) this.setArchiveUnsaved(true);

    return {
      report: built.report,
      health: built.health,
      restored,
      blob: built.blob,
      filename: fileName,
    };
  };

  /**
   * SV-1: the document held in Resume mode has (true) or has not (false) been
   * saved as a ZIP since the hand-over from Upload. While unsaved the page
   * carries the browser's leave-page prompt; clearing removes it and hides the
   * notice. Showing the notice is the caller's decision (showUnsavedNotice).
   * @param {boolean} unsaved
   */
  proto.setArchiveUnsaved = function (unsaved) {
    this._archiveUnsaved = unsaved === true;

    if (this._archiveUnsaved) {
      if (!this._beforeUnloadHandler) {
        this._beforeUnloadHandler = (event) => {
          event.preventDefault();
          event.returnValue = "";
          return "";
        };
        window.addEventListener("beforeunload", this._beforeUnloadHandler);
      }
      return;
    }

    if (this._beforeUnloadHandler) {
      window.removeEventListener("beforeunload", this._beforeUnloadHandler);
      this._beforeUnloadHandler = null;
    }
    const notice = document.getElementById("resume-unsaved-notice");
    if (notice) notice.hidden = true;
  };

  /**
   * SV-3: hide and empty the Download ZIP now outcome so a later document never
   * shows the previous one's line. Called wherever the unsaved flag is reset.
   */
  proto.clearSaveStatus = function () {
    const status = document.getElementById("resume-save-status");
    if (!status) return;
    status.textContent = "";
    status.hidden = true;
  };

  /**
   * SV-1: show the visible "not saved" notice under the Resume heading, with a
   * control that runs the Resume-mode save (so later edits are included).
   * Raises nothing: the notice is visible text.
   */
  proto.showUnsavedNotice = function () {
    const notice = document.getElementById("resume-unsaved-notice");
    if (!notice) return;
    const button = document.getElementById("resume-unsaved-download-btn");
    if (button && !button.dataset.unsavedListenerAttached) {
      button.addEventListener("click", async () => {
        if (button.disabled) return;
        button.disabled = true;
        try {
          await this.downloadUpdatedZIP();
        } finally {
          button.disabled = false;
        }
      });
      button.dataset.unsavedListenerAttached = "true";
    }
    notice.hidden = false;
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
