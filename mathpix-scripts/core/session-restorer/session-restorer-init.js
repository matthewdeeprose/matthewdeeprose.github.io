// ─── MathPixSessionRestorer Init Mixin ───────────────────────────────────────
// Initialisation, element caching, and event listener setup.
// Depends on: session-restorer-core.js
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (!window._SRShared) {
    console.error(
      "[SessionRestorer] session-restorer-core.js must load before session-restorer-init.js",
    );
    return;
  }

  const { logError, logWarn, logInfo, logDebug, getIcon, RESTORER_CONFIG } =
    window._SRShared;
  const proto = MathPixSessionRestorer.prototype;

  // =========================================================================
  // INITIALISATION
  // =========================================================================

  /**
   * Initialise the session restorer
   * @returns {Promise<boolean>} Success status
   */
  proto.initialise = async function () {
    logInfo("Initialising session restorer...");

    try {
      // Cache DOM elements
      this.cacheElements();

      // Verify required elements exist
      if (!this.elements.container) {
        logError("Resume mode container not found in DOM");
        return false;
      }

      // Attach event listeners
      this.attachEventListeners();

      // Set up textarea auto-resize
      this.setupTextareaAutoResize();

      // Get parser instance
      this.parser = window.getMathPixZIPParser?.();
      if (!this.parser) {
        logWarn("MathPixZIPParser not available - will retry on first use");
      }

      // Subscribe to MathJax/CDN recovery events
      this.subscribeToRecoveryEvents();

      this.isInitialised = true;
      logInfo("Session restorer initialised successfully", {
        hasRecoverySubscription: !!this.mathJaxRecoveryUnsubscribe,
      });
      return true;
    } catch (error) {
      logError("Failed to initialise session restorer:", error);
      return false;
    }
  };

  // =========================================================================
  // MATHJAX/CDN RECOVERY INTEGRATION
  // =========================================================================

  /**
   * Subscribe to MathJax Manager recovery events AND MMD Preview library ready events
   * When MathJax or the CDN library recovers, re-render pending content
   * @private
   */
  proto.subscribeToRecoveryEvents = function () {
    // Subscribe to MathJax Manager recovery
    if (window.mathJaxManager?.onRecovery) {
      this.mathJaxRecoveryUnsubscribe = window.mathJaxManager.onRecovery(
        (eventData) => {
          logInfo(
            "MathJax recovery notification received in Session Restorer",
            {
              healthy: eventData.healthy,
              pendingPreviewRender: this.pendingPreviewRender,
              hasPendingContent: !!this.pendingContent,
            },
          );

          // When MathJax becomes healthy, it's a good time to try loading the CDN too
          if (
            eventData.healthy &&
            (this.pendingPreviewRender || this.pendingContent)
          ) {
            // Small delay to let MathJax fully stabilise
            setTimeout(() => {
              this.handleRecoveryRerender();
            }, 500);
          }
        },
      );
      logDebug("Session Restorer subscribed to MathJax recovery events");

      // CRITICAL: Also check if MathJax is ALREADY healthy
      // The recovery callback only fires on state CHANGE, not initial state
      // So we need to poll for when MathJax first becomes healthy
      this.monitorMathJaxInitialReady();
    } else {
      logDebug(
        "MathJax Manager not available for recovery subscription - will retry",
      );
      // Retry subscription after a delay
      setTimeout(() => {
        if (
          window.mathJaxManager?.onRecovery &&
          !this.mathJaxRecoveryUnsubscribe
        ) {
          this.subscribeToRecoveryEvents();
        }
      }, 2000);
    }

    // Also monitor for CDN library becoming available
    this.monitorCDNLibraryReady();
  };

  /**
   * Monitor for MathJax Manager to become healthy for the first time
   * This handles the case where we subscribe BEFORE MathJax initialises
   * CRITICAL: Must wait for BOTH MathJax healthy AND pending content before clearing interval
   * @private
   */
  proto.monitorMathJaxInitialReady = function () {
    // If already healthy and we have pending content, trigger immediately
    if (
      window.mathJaxManager?.isHealthy &&
      (this.pendingPreviewRender || this.pendingContent)
    ) {
      logInfo(
        "MathJax already healthy with pending content - triggering recovery render",
      );
      setTimeout(() => {
        this.handleRecoveryRerender();
      }, 500);
      return;
    }

    // Otherwise, poll until BOTH conditions are met:
    // 1. MathJax is healthy
    // 2. We have pending content to render
    let checkCount = 0;
    const maxChecks = 60; // Check for up to 30 seconds (every 500ms)
    let hasTriggeredRecovery = false;

    const checkInterval = setInterval(() => {
      checkCount++;

      const mathJaxHealthy = window.mathJaxManager?.isHealthy;
      const hasPendingContent =
        this.pendingPreviewRender || this.pendingContent;

      // Only clear and trigger when BOTH conditions are met
      if (mathJaxHealthy && hasPendingContent && !hasTriggeredRecovery) {
        hasTriggeredRecovery = true;
        clearInterval(checkInterval);

        logInfo(
          "MathJax healthy AND pending content detected - triggering recovery render",
          {
            checkCount,
            pendingPreviewRender: this.pendingPreviewRender,
          },
        );

        // Small delay for stability
        setTimeout(() => {
          this.handleRecoveryRerender();
        }, 500);
      } else if (checkCount >= maxChecks) {
        clearInterval(checkInterval);

        // Log why we timed out
        if (!mathJaxHealthy) {
          logWarn(
            "MathJax initial ready monitoring timeout - MathJax never became healthy",
          );
        } else if (!hasPendingContent) {
          logDebug(
            "MathJax initial ready monitoring complete - no pending content needed",
          );
        }
      }
    }, 500);

    logDebug("Started monitoring for MathJax initial ready state", {
      mathJaxCurrentlyHealthy: window.mathJaxManager?.isHealthy,
      currentlyPending: this.pendingPreviewRender || !!this.pendingContent,
    });
  };

  /**
   * Monitor for mathpix-markdown-it CDN library to become available
   * @private
   */
  proto.monitorCDNLibraryReady = function () {
    // Check if already available
    if (
      typeof window.MathpixMarkdownModel !== "undefined" ||
      typeof window.markdownToHTML !== "undefined"
    ) {
      logDebug("CDN library already available");
      return;
    }

    logDebug("Monitoring for CDN library availability...");

    let checkCount = 0;
    const maxChecks = 30; // Check for up to 30 seconds

    const checkInterval = setInterval(() => {
      checkCount++;

      // Check for CDN library availability
      const cdnReady =
        typeof window.MathpixMarkdownModel !== "undefined" ||
        typeof window.markdownToHTML !== "undefined";

      if (cdnReady) {
        clearInterval(checkInterval);
        logInfo("CDN library became available - triggering recovery render");

        if (this.pendingPreviewRender && this.pendingContent) {
          this.handleRecoveryRerender();
        }
      } else if (checkCount >= maxChecks) {
        clearInterval(checkInterval);
        logWarn("CDN library monitoring timeout - library may not be loading");
      }
    }, 1000);
  };

  /**
   * Handle recovery by re-rendering the preview content
   * Explicitly ensures CDN library is loaded before attempting render
   * @private
   */
  proto.handleRecoveryRerender = async function () {
    logInfo("Handling recovery re-render in Session Restorer");

    // Check if we have content to re-render
    const contentToRender =
      this.pendingContent || this.restoredSession?.currentMMD;
    if (!contentToRender) {
      logDebug("No content to re-render after recovery");
      this.pendingPreviewRender = false;
      return;
    }

    // Check if the preview element exists and needs re-rendering
    const previewElement = this.elements.mmdPreviewContent;
    if (!previewElement) {
      logWarn("Preview element not found for recovery re-render");
      this.pendingPreviewRender = false;
      return;
    }

    // CRITICAL: Ensure we're targeting the PREVIEW element, not code elements
    // Code elements should NEVER have MathJax applied - they show raw MMD source
    if (
      previewElement.id === "resume-mathpix-pdf-content-mmd" ||
      previewElement.closest(".code-block-wrapper") ||
      previewElement.closest("pre") ||
      previewElement.closest("code")
    ) {
      logWarn(
        "Recovery re-render aborted - target is a code element, not preview",
      );
      this.pendingPreviewRender = false;
      return;
    }

    // Check if content still shows raw LaTeX or loading message (needs re-rendering)
    const needsRerender =
      previewElement.textContent?.includes("\\section") ||
      previewElement.textContent?.includes("\\begin{") ||
      previewElement.textContent?.includes("Unknown environment") ||
      previewElement.textContent?.includes("Loading preview renderer") ||
      previewElement.querySelector(".mmd-preview-loading");

    if (!needsRerender) {
      logDebug("Preview already rendered correctly - no recovery needed");
      this.pendingPreviewRender = false;
      return;
    }

    try {
      logInfo(
        "Attempting recovery re-render - ensuring CDN library is loaded first",
      );

      // Get MMD Preview module
      let mmdPreview = window.getMathPixMMDPreview?.();
      if (!mmdPreview) {
        const controller = window.getMathPixController?.();
        mmdPreview = controller?.getMMDPreview?.();
      }

      if (mmdPreview) {
        // CRITICAL: Explicitly load the CDN library if not ready
        if (!mmdPreview.isReady?.()) {
          logInfo("CDN library not ready - triggering explicit load...");

          try {
            // Force load the library (this is the key fix!)
            await mmdPreview.loadLibrary();
            logInfo("✅ CDN library loaded successfully via explicit call");
          } catch (loadError) {
            logWarn("Failed to load CDN library:", loadError);
            // Continue anyway - might work with fallback
          }
        }

        // Now attempt the render
        logInfo("Re-rendering preview after CDN load...");
        await mmdPreview.render(contentToRender, previewElement);

        // Clear pending state on success
        this.pendingPreviewRender = false;
        this.pendingContent = null;

        // Announce to screen readers
        this.announceToScreenReader("Mathematical content has been rendered");

        logInfo("✅ Recovery re-render completed successfully");
      } else {
        logWarn("MMD Preview module not available for recovery re-render");
        // Keep pending for later retry
      }
    } catch (error) {
      logError("Failed to re-render after recovery:", error);
      // Keep pendingPreviewRender true so we can try again on next recovery event
    }
  };

  /**
   * Cache all resume-prefixed DOM elements
   * @private
   */
  proto.cacheElements = function () {
    logDebug("Caching DOM elements...");

    this.elements = {
      // Main containers
      container: document.getElementById("mathpix-resume-mode-container"),
      uploadSection: document.getElementById("resume-upload-section"),
      workingArea: document.getElementById("resume-working-area"),

      // Upload elements
      dropZone: document.getElementById("resume-drop-zone"),
      fileInput: document.getElementById("resume-file-input"),
      validationMessages: document.getElementById("resume-validation-messages"),

      // Edit selection dialog
      editSelection: document.getElementById("resume-edit-selection"),
      editOptions: document.getElementById("resume-edit-options"),
      editConfirmBtn: document.getElementById("resume-edit-confirm-btn"),
      editCancelBtn: document.getElementById("resume-edit-cancel-btn"),

      // Session header
      sourceName: document.getElementById("resume-source-name"),
      sessionStatus: document.getElementById("resume-session-status"),
      focusModeBtn: document.getElementById("resume-focus-mode-btn"),
      newSessionBtn: document.getElementById("resume-new-session-btn"),

      // Tabs
      tabMmd: document.getElementById("resume-tab-mmd"),
      tabConfidence: document.getElementById("resume-tab-confidence"),
      tabAnalysis: document.getElementById("resume-tab-analysis"),
      tabChemistry: document.getElementById("resume-tab-chemistry"), // Phase 6B
      panelMmd: document.getElementById("resume-panel-mmd"),
      panelConfidence: document.getElementById("resume-panel-confidence"),
      panelAnalysis: document.getElementById("resume-panel-analysis"),
      panelChemistry: document.getElementById("resume-panel-chemistry"), // Phase 6B

      // MMD view controls
      mmdViewCodeBtn: document.getElementById("resume-mmd-view-code-btn"),
      mmdViewPreviewBtn: document.getElementById("resume-mmd-view-preview-btn"),
      mmdViewSplitBtn: document.getElementById("resume-mmd-view-split-btn"),
      mmdViewPdfSplitBtn: document.getElementById(
        "resume-mmd-view-pdf-split-btn",
      ),
      mmdEditBtn: document.getElementById("resume-mmd-edit-btn"),
      mmdFullscreenBtn: document.getElementById("resume-mmd-fullscreen-btn"),
      mmdFullscreenExitBtn: document.getElementById(
        "resume-fullscreen-exit-btn",
      ),
      mmdViewStatus: document.getElementById("resume-mmd-view-status"),

      // Split PDF toggle (Phase 4.2 parity)
      splitPdfToggle: document.getElementById("resume-mmd-split-pdf-toggle"),
      splitPdfCheckbox: document.getElementById("resume-mmd-split-show-pdf"),

      // MMD content areas
      mmdContentArea: document.getElementById("resume-mmd-content-area"),
      mmdCodeContainer: document.getElementById("resume-mmd-code-container"),
      mmdPreviewContainer: document.getElementById(
        "resume-mmd-preview-container",
      ),
      mmdPdfContainer: document.getElementById("resume-mmd-pdf-container"),
      mmdViewDivider: document.getElementById("resume-mmd-view-divider"),
      mmdCodeElement: document.getElementById("resume-mathpix-pdf-content-mmd"),
      mmdEditorTextarea: document.getElementById("resume-mmd-editor-textarea"),
      mmdPreviewContent: document.getElementById("resume-mmd-preview-content"),

      // PDF controls
      pdfPageInput: document.getElementById("resume-mmd-pdf-page-input"),
      pdfTotalPages: document.getElementById("resume-mmd-pdf-total-pages"),
      pdfZoomOut: document.getElementById("resume-mmd-pdf-zoom-out"),
      pdfZoomIn: document.getElementById("resume-mmd-pdf-zoom-in"),
      pdfZoomFit: document.getElementById("resume-mmd-pdf-zoom-fit"),
      pdfZoomLevel: document.getElementById("resume-mmd-pdf-zoom-level"),
      pdfScrollContainer: document.getElementById(
        "resume-mmd-pdf-scroll-container",
      ),
      pdfPagesContainer: document.getElementById("resume-mmd-pdf-pages"),

      // Editor toolbar
      mmdEditorToolbar: document.getElementById("resume-mmd-editor-toolbar"),
      mmdUndoBtn: document.getElementById("resume-mmd-undo-btn"),
      mmdRedoBtn: document.getElementById("resume-mmd-redo-btn"),
      mmdRestoreBtn: document.getElementById("resume-mmd-restore-btn"),
      mmdClearSessionBtn: document.getElementById(
        "resume-mmd-clear-session-btn",
      ),
      mmdDownloadBtn: document.getElementById("resume-mmd-download-btn"),
      mmdUploadInput: document.getElementById("resume-mmd-upload-input"),
      mmdSessionStatus: document.getElementById("resume-mmd-session-status"),
      collapseImagesBtn: document.getElementById("resume-collapse-images-btn"),
      manageImagesBtn: document.getElementById("resume-manage-images-btn"),

      // Image save warning (Phase 9 Feature 1C)
      imageSaveWarning: document.getElementById("resume-image-save-warning"),

      // Storage dashboard (Phase 9 Feature 1A)
      storageDashboard: document.getElementById("resume-storage-dashboard"),
      storageBar: document.getElementById("resume-storage-bar"),
      storageSummary: document.getElementById("resume-storage-summary"),
      manageSessionsBtn: document.getElementById("resume-manage-sessions-btn"),

      // Convert section
      convertSection: document.getElementById("resume-convert-section"),
      convertBtn: document.getElementById("resume-convert-btn"),
      convertCancelBtn: document.getElementById("resume-convert-cancel-btn"),
      convertProgress: document.getElementById("resume-convert-progress"),
      convertProgressList: document.getElementById(
        "resume-convert-progress-list",
      ),
      convertDownloads: document.getElementById("resume-convert-downloads"),
      convertDownloadButtons: document.getElementById(
        "resume-download-buttons",
      ),
      convertErrors: document.getElementById("resume-convert-errors"),
      convertErrorList: document.getElementById("resume-convert-error-list"),
      convertSelectAll: document.getElementById("resume-select-all-formats"),
      convertFormatCheckboxes: null, // Populated after DOM ready
      convertDownloadAllBtn: document.getElementById(
        "resume-download-all-converted-btn",
      ),

      // Download all (main ZIP with edits)
      downloadAllBtn: document.getElementById("resume-download-all-btn"),

      // Confidence visualiser (PDF tab)
      confidenceContainer: document.getElementById(
        "resume-confidence-visualiser-container",
      ),

      // Phase 8.3.4: Confidence gutter (MMD code view)
      confidenceToggle: document.getElementById("resume-mmd-confidence-toggle"),
      confidenceCheckbox: document.getElementById("resume-mmd-show-confidence"),
      confidenceGutter: document.getElementById("resume-mmd-confidence-gutter"),
    };

    // Cache format checkboxes separately
    this.elements.convertFormatCheckboxes = document.querySelectorAll(
      'input[name="resume-convert-format"]',
    );

    // Log element availability
    const foundCount = Object.values(this.elements).filter(Boolean).length;
    const totalCount = Object.keys(this.elements).length;
    logDebug(`Cached ${foundCount}/${totalCount} DOM elements`);
  };

  /**
   * Attach all event listeners
   * @private
   */
  proto.attachEventListeners = function () {
    logDebug("Attaching event listeners...");

    // Drop zone events
    if (this.elements.dropZone) {
      this.elements.dropZone.addEventListener("dragover", (e) =>
        this.handleDragOver(e),
      );
      this.elements.dropZone.addEventListener("dragleave", (e) =>
        this.handleDragLeave(e),
      );
      this.elements.dropZone.addEventListener("drop", (e) =>
        this.handleDrop(e),
      );
      this.elements.dropZone.addEventListener("click", () =>
        this.triggerFileSelect(),
      );
      this.elements.dropZone.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.triggerFileSelect();
        }
      });
    }

    // File input change
    if (this.elements.fileInput) {
      this.elements.fileInput.addEventListener("change", (e) =>
        this.handleFileSelect(e),
      );
    }

    // Edit selection buttons
    if (this.elements.editConfirmBtn) {
      this.elements.editConfirmBtn.addEventListener("click", () =>
        this.confirmEditSelection(),
      );
    }
    if (this.elements.editCancelBtn) {
      this.elements.editCancelBtn.addEventListener("click", () =>
        this.cancelEditSelection(),
      );
    }

    // Focus Mode button (Phase 8.3.3)
    if (this.elements.focusModeBtn) {
      this.elements.focusModeBtn.addEventListener("click", () =>
        this.toggleFocusMode(),
      );
    }

    // New session button
    if (this.elements.newSessionBtn) {
      this.elements.newSessionBtn.addEventListener("click", () =>
        this.startNewSession(),
      );
    }

    // Tab switching
    if (this.elements.tabMmd) {
      this.elements.tabMmd.addEventListener("click", () =>
        this.switchTab("mmd"),
      );
    }
    if (this.elements.tabConfidence) {
      this.elements.tabConfidence.addEventListener("click", () =>
        this.switchTab("confidence"),
      );
    }
    if (this.elements.tabAnalysis) {
      this.elements.tabAnalysis.addEventListener("click", () =>
        this.switchTab("analysis"),
      );
    }
    // Phase 6B: Chemistry tab
    if (this.elements.tabChemistry) {
      this.elements.tabChemistry.addEventListener("click", () =>
        this.switchTab("chemistry"),
      );
    }

    // MMD view controls
    if (this.elements.mmdViewCodeBtn) {
      this.elements.mmdViewCodeBtn.addEventListener("click", () =>
        this.switchMmdView("code"),
      );
    }
    if (this.elements.mmdViewPreviewBtn) {
      this.elements.mmdViewPreviewBtn.addEventListener("click", () =>
        this.switchMmdView("preview"),
      );
    }
    if (this.elements.mmdViewSplitBtn) {
      this.elements.mmdViewSplitBtn.addEventListener("click", () =>
        this.switchMmdView("split"),
      );
    }
    if (this.elements.mmdViewPdfSplitBtn) {
      this.elements.mmdViewPdfSplitBtn.addEventListener("click", () =>
        this.switchMmdView("pdf_split"),
      );
    }

    // Split PDF toggle checkbox
    if (this.elements.splitPdfCheckbox) {
      this.elements.splitPdfCheckbox.addEventListener("change", (e) =>
        this.toggleSplitPDF(e.target.checked),
      );
    }

    // Phase 8.3.4: Confidence toggle checkbox
    if (this.elements.confidenceCheckbox) {
      this.elements.confidenceCheckbox.addEventListener("change", (e) =>
        this.toggleConfidenceHighlighting(e.target.checked),
      );
    }

    if (this.elements.mmdEditBtn) {
      this.elements.mmdEditBtn.addEventListener("click", () =>
        this.toggleEditMode(),
      );
    }

    // Editor toolbar buttons
    if (this.elements.mmdUndoBtn) {
      this.elements.mmdUndoBtn.addEventListener("click", () => this.undoEdit());
    }
    if (this.elements.mmdRedoBtn) {
      this.elements.mmdRedoBtn.addEventListener("click", () => this.redoEdit());
    }
    if (this.elements.mmdRestoreBtn) {
      this.elements.mmdRestoreBtn.addEventListener("click", () =>
        this.restoreOriginal(),
      );
    }
    if (this.elements.mmdClearSessionBtn) {
      this.elements.mmdClearSessionBtn.addEventListener("click", () =>
        this.clearSession(),
      );
    }
    // Phase 8G: Collapse images toggle
    if (this.elements.collapseImagesBtn) {
      this.elements.collapseImagesBtn.addEventListener("click", () =>
        this.toggleImageCollapse(),
      );
    }
    if (this.elements.mmdUploadInput) {
      this.elements.mmdUploadInput.addEventListener("change", (e) =>
        this.handleMmdUpload(e),
      );
    }

    // PDF controls
    if (this.elements.pdfPageInput) {
      this.elements.pdfPageInput.addEventListener("change", (e) =>
        this.goToPage(parseInt(e.target.value, 10)),
      );
      this.elements.pdfPageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.goToPage(parseInt(e.target.value, 10));
        }
      });
    }
    if (this.elements.pdfZoomOut) {
      this.elements.pdfZoomOut.addEventListener("click", () =>
        this.zoomPDF(-0.1),
      );
    }
    if (this.elements.pdfZoomIn) {
      this.elements.pdfZoomIn.addEventListener("click", () =>
        this.zoomPDF(0.1),
      );
    }
    if (this.elements.pdfZoomFit) {
      this.elements.pdfZoomFit.addEventListener("click", () =>
        this.fitPDFToWidth(),
      );
    }

    // Editor textarea changes
    if (this.elements.mmdEditorTextarea) {
      this.elements.mmdEditorTextarea.addEventListener("input", () =>
        this.handleMmdInput(),
      );
    }

    // Download all button
    if (this.elements.downloadAllBtn) {
      this.elements.downloadAllBtn.addEventListener("click", () =>
        this.downloadUpdatedZIP(),
      );
    }

    // Convert section event listeners
    if (this.elements.convertBtn) {
      this.elements.convertBtn.addEventListener("click", () =>
        this.handleConvert(),
      );
    }

    if (this.elements.convertCancelBtn) {
      this.elements.convertCancelBtn.addEventListener("click", () =>
        this.cancelConversion(),
      );
    }

    // Select All checkbox handling
    if (this.elements.convertSelectAll) {
      this.elements.convertSelectAll.addEventListener("change", () => {
        const isChecked = this.elements.convertSelectAll.checked;
        this.elements.convertFormatCheckboxes?.forEach((checkbox) => {
          checkbox.checked = isChecked;
        });
        this.updateConvertButtonState();
      });
    }

    // Format checkbox change events - update Select All state and button
    this.elements.convertFormatCheckboxes?.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        this.updateSelectAllState();
        this.updateConvertButtonState();
      });
    });

    // Download All Converted button
    if (this.elements.convertDownloadAllBtn) {
      this.elements.convertDownloadAllBtn.addEventListener("click", () =>
        this.downloadAllConvertedFiles(),
      );
    }

    // Initial button state
    this.updateConvertButtonState();

    // Phase 7C-7: reveal the Download Updated ZIP button when the user
    // changes chemistry rendering settings on a restored session. Guarded
    // on restoredSession so non-resume chemistry edits in the main flow
    // don't flash a button that isn't wired up there.
    document.addEventListener("chemistry-settings-changed", (e) => {
      if (!this.restoredSession) return;
      // Ignore the restore-hook dispatch that fires during ZIP load —
      // we only want genuine user-initiated changes.
      if (e?.detail?.scope === "global" && this._restoringChemistrySettings) {
        return;
      }
      try {
        this.showDownloadUpdatedButton?.();
      } catch (err) {
        logWarn("Failed to show download button on chemistry change", {
          error: err.message,
        });
      }
    });

    logDebug("Event listeners attached");
  };

  console.log("[SessionRestorer] Init mixin loaded");
})();
