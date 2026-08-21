/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER CONTROLLER — UI & FILE HANDLING SUB-MODULE
 * ═══════════════════════════════════════════════════════════════
 *
 * File handling, preview, output display, copy operations, heading
 * adjustment, layout switching, and reset for the Image Describer
 * controller. Camera capture is now in controller-camera.js.
 *
 * Mixed into window.ImageDescriberController via Object.assign.
 * Must load AFTER image-describer-controller.js (core).
 *
 * VERSION: 1.2.0
 * DATE: 31 March 2026
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[ControllerUI] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ControllerUI] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ControllerUI] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ControllerUI] ${message}`, ...args);
  }

  // ============================================================================
  // FULLSCREEN FOCUS RETURN
  // ============================================================================

  // THE TRIGGER TRAVELS INTO THE MODAL, WHICH IS WHY THIS NEEDED TWO PARTS.
  //
  // showFullscreenImage() passes the workspace ELEMENT as `content`, so
  // UniversalModal appendChild()s #imgdesc-workspace INTO the dialog and leaves
  // a placeholder behind. #imgdesc-fullscreen-btn lives inside that workspace,
  // so at close time it is inside the detached dialog — `returnFocusTo` alone
  // resolves to nothing and the tier chain lands on #main.
  //
  // MEASURED 21 August 2026, before any change: focus settled on main#main for
  // all four journeys, including the CONTROL arm with no nested modal at all.
  // This modal's focus return was broken outright, not merely under nesting.
  //
  // ⚠ CORRECTED THE SAME DAY, and the correction is the useful part. The first
  // fix restored focus at the end of onClose. That IS last, it DID land on the
  // trigger, and a four-journey drive plus an inversion all agreed — yet a real
  // NVDA listen still got the whole-page read. A focus-EVENT log explained it:
  //
  //     focusout -> body
  //     focusin  -> main#main                      <- tier chain, 6ms earlier
  //     focusout -> body
  //     focusin  -> button#imgdesc-fullscreen-btn  <- the onClose fix
  //
  // Focusing the #main landmark is what makes NVDA read the entire main region,
  // and it had already happened. AN END-STATE MEASUREMENT CANNOT SEE A
  // TRANSIENT LANDING — every drive that reported "settled on the trigger" was
  // correct and answered the wrong question.
  //
  // So the DOM restore moved into `onBeforeFocusRestore`, which runs inside
  // finishClose after the dialog is detached and immediately BEFORE the opener
  // is resolved. The trigger is then connected and visible, `returnFocusTo`
  // resolves it, tier 1 fires, and #main is never focused at all. onClose is
  // too late for this by construction (it runs from the show() promise
  // reaction), and the native <dialog> "close" event is too late as well —
  // the spec queues it rather than firing it synchronously.
  const FULLSCREEN_TRIGGER_ID = "imgdesc-fullscreen-btn";
  // Reached only if the preview is gone, which means the image was cleared
  // while fullscreen was open. Landing on the upload control is the surface's
  // remaining primary action; it is `visually-hidden` (clip-based, 1px) rather
  // than display:none, so it keeps a layout box and can genuinely take focus.
  const FULLSCREEN_FALLBACK_ID = "imgdesc-file-input";

  /**
   * Return focus after the fullscreen workspace closes.
   *
   * Resolves by id at call time rather than using a captured element: the
   * preview markup — trigger included — is rebuilt by displayPreview(), so a
   * reference held from open time can be stale.
   *
   * @returns {string|null} id of the element focused, or null if none was usable
   */
  function restoreFocusAfterFullscreen() {
    // A focus call on an element with no layout box is a SILENT no-op, so test
    // reachability rather than mere existence.
    const usable = (el) =>
      !!el && el.isConnected && !el.disabled && el.getClientRects().length > 0;

    for (const id of [FULLSCREEN_TRIGGER_ID, FULLSCREEN_FALLBACK_ID]) {
      const el = document.getElementById(id);
      if (!usable(el)) continue;
      el.focus();
      if (document.activeElement === el) {
        logDebug(`[UI] Focus returned to #${id} after fullscreen close`);
        return id;
      }
    }

    // Deliberately loud. Focus is now wherever the tier chain left it, which is
    // #main and therefore a whole-page read on a screen reader.
    logWarn("[UI] No usable focus target after fullscreen close");
    return null;
  }

  // ============================================================================
  // METHODS (mixed into ImageDescriberController)
  // ============================================================================

  const methods = {
    // ========================================================================
    // FILE HANDLING
    // ========================================================================

    /**
     * Handle file selection
     * @param {File} file - The selected file
     */
    async handleFileSelect(file) {
      logInfo("File selected:", file.name);

      // Access config values via exposed _controllerConfig
      const cfg = this._controllerConfig || {};

      try {
        // Validate file type only (size checked after compression in embed API)
        if (cfg.acceptedTypes && !cfg.acceptedTypes.includes(file.type)) {
          throw new Error(
            `Invalid file type: ${file.type}. Please upload a JPEG, PNG, or WebP image.`,
          );
        }

        // Show info for large files (compression will be applied)
        const fileMB = file.size / (1024 * 1024);
        if (fileMB > 5) {
          logInfo(
            `Large file detected (${fileMB.toFixed(
              1,
            )}MB) - will be compressed before processing`,
          );

          // Show user feedback for large files
          if (window.notifyInfo) {
            window.notifyInfo(
              `Large image (${fileMB.toFixed(
                1,
              )}MB) - will be optimised automatically`,
            );
          }
        }

        // Store file reference
        this.currentFile = file;

        // Phase 9B: Hash file for cache lookup
        this.currentFileHash = null;
        this._cacheHit = false;
        if (typeof window.ImageDescriberCache !== "undefined") {
          try {
            this.currentFileHash =
              await window.ImageDescriberCache.hashFile(file);
            logDebug(
              "File hashed: " + this.currentFileHash.substring(0, 16) + "...",
            );
          } catch (hashErr) {
            logWarn("File hashing failed:", hashErr.message);
          }
        }

        // Convert to base64 for preview only (original file, not compressed)
        this.currentBase64 = await this.fileToBase64(file);

        // Clean up overlay panels from any previous image before showing new one
        if (typeof window.ImageDescriberOverlay !== "undefined") {
          if (window.ImageDescriberOverlay._inReviewMode) {
            window.ImageDescriberOverlay.exitReviewMode();
          }
          window.ImageDescriberOverlay.clearAnalysis();
          window.ImageDescriberOverlay._userEdits = null;
          window.ImageDescriberOverlay._sortedItems = [];
        }
        const overlayToolbar = document.getElementById(
          "imgdesc-overlay-toolbar",
        );
        if (overlayToolbar) overlayToolbar.hidden = true;

        // Phase 11D: hide cache recall banner for new image
        this.hideCacheRecallBanner();

        // Phase 14D: reset accuracy warnings for new image
        if (this.elements.preGenerationWarning) {
          const isQwen = this.elements.localModelSelect && this.elements.localModelSelect.value === "qwen35";
          this.elements.preGenerationWarning.hidden = !isQwen;
        }
        if (this.elements.outputAccuracyWarning) {
          this.elements.outputAccuracyWarning.hidden = true;
        }

        // Collapse upload area to compact "Replace image" bar
        if (this.elements.uploadArea) {
          this.elements.uploadArea.classList.add("imgdesc-upload-collapsed");
          const uploadText = this.elements.uploadArea.querySelector(
            ".imgdesc-upload-text",
          );
          if (uploadText) {
            uploadText.textContent = "Replace image";
          }
        }

        // Show preview
        this.showPreview(file);

        // Start background analysis immediately (runs while user fills in form)
        this.startBackgroundAnalysis();

        // Update button states
        this.updateButtonStates();

        // Announce to screen reader
        this.announceStatus(`Image loaded: ${file.name}`);

        logInfo("File processed successfully", {
          name: file.name,
          sizeMB: fileMB.toFixed(2),
          type: file.type,
        });

        // Reset file input value so re-selecting the same file triggers change
        if (this.elements.fileInput) {
          this.elements.fileInput.value = "";
        }
      } catch (error) {
        logError("File handling error:", error);
        this.showError(error.message);
        this.currentFile = null;
        this.currentBase64 = null;
      }
    },

    /**
     * Convert file to base64 string
     * @param {File} file - The file to convert
     * @returns {Promise<string>} Base64 encoded string (without data URI prefix)
     */
    fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          // Remove data URI prefix (e.g., "data:image/jpeg;base64,")
          const base64 = reader.result.split(",")[1];
          resolve(base64);
        };

        reader.onerror = () => {
          reject(new Error("Failed to read file"));
        };

        reader.readAsDataURL(file);
      });
    },

    /**
     * Show image preview
     * @param {File} file - The file to preview
     */
    showPreview(file) {
      if (!this.elements.preview) return;

      const url = URL.createObjectURL(file);

      // Track the blob URL for cleanup
      this.previewBlobUrls.add(url);

      // Track memory (via core-exposed utility)
      const memUtils = this._memoryUtils;
      if (memUtils?.MemoryMonitor) {
        memUtils.MemoryMonitor.track("ImageDescriber_showPreview", {
          fileName: file.name,
          fileSize: file.size,
        });
      }

      this.elements.preview.innerHTML = `
      <img 
        src="${url}" 
        alt="Preview of ${this.escapeHtml(file.name)}"
        class="imgdesc-preview-image"
      />
      <div class="imgdesc-preview-actions">
        <p class="imgdesc-file-info">
          ${this.escapeHtml(file.name)} (${(file.size / 1024).toFixed(0)} KB)
        </p>
        <button 
          type="button" 
          class="imgdesc-fullscreen-btn secondary-button" 
          id="imgdesc-fullscreen-btn"
          aria-label="View image fullscreen">
          <span aria-hidden="true">⛶</span> Fullscreen
        </button>
      </div>
    `;

      this.elements.preview.hidden = false;

      // Clean up object URL when image loads
      const img = this.elements.preview.querySelector("img");
      if (img) {
        img.onload = () => {
          URL.revokeObjectURL(url);
          this.previewBlobUrls.delete(url);
          logDebug("Preview blob URL revoked");
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          this.previewBlobUrls.delete(url);
          logDebug("Preview blob URL revoked (error)");
        };
      }

      // Bind fullscreen button click handler (Phase 2E)
      const fullscreenBtn = this.elements.preview.querySelector(
        "#imgdesc-fullscreen-btn",
      );
      if (fullscreenBtn) {
        fullscreenBtn.addEventListener("click", () => {
          this.showFullscreenImage();
        });
        logDebug("Fullscreen button handler bound");
      }

      // Initialise overlay container (Phase 5D-1)
      if (typeof window.ImageDescriberOverlay !== "undefined") {
        window.ImageDescriberOverlay.init(this.elements.preview);
        logDebug("Overlay container initialised");
      }
    },

    /**
     * Clear file and preview with memory cleanup
     */
    clearFile() {
      logDebug("Clearing file with memory cleanup");

      // Clean up blob URLs
      if (this.previewBlobUrls.size > 0) {
        logDebug(`Revoking ${this.previewBlobUrls.size} preview blob URLs`);
        this.previewBlobUrls.forEach((url) => {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {
            logDebug("Blob URL cleanup warning:", e.message);
          }
        });
        this.previewBlobUrls.clear();
      }

      // Clear overlay analysis (Phase 5D-1)
      if (typeof window.ImageDescriberOverlay !== "undefined") {
        window.ImageDescriberOverlay.clearAnalysis();
        // Corrections are per-image and index into _sortedItems — clearing the
        // analysis without clearing them leaves getCorrectedAnalysis() returning
        // null while hasCorrections() still reports true. The other three
        // clearAnalysis() call sites already pair the reset this way.
        window.ImageDescriberOverlay._userEdits = null;
        window.ImageDescriberOverlay._sortedItems = [];
      }

      // Clean up preview images
      if (this.elements.preview) {
        const previewImages = this.elements.preview.querySelectorAll("img");
        previewImages.forEach((img) => {
          img.src = "";
          img.onload = null;
          img.onerror = null;
        });

        this.elements.preview.innerHTML = "";
        this.elements.preview.hidden = true;
      }

      // Clear file data
      this.currentFile = null;
      this.currentBase64 = null;

      if (this.elements.fileInput) {
        this.elements.fileInput.value = "";
      }

      // Track memory after cleanup (via core-exposed utility)
      const memUtils = this._memoryUtils;
      if (memUtils?.MemoryMonitor) {
        memUtils.MemoryMonitor.track("ImageDescriber_clearFile", {
          cleaned: true,
        });
      }

      this.updateButtonStates();

      // Clean up camera if active (Phase 2E.2)
      this.cleanupCamera();
      if (this.elements.cameraSection) {
        this.elements.cameraSection.open = false;
      }

      logDebug("File cleared with memory cleanup complete");
    },

    /**
     * Show fullscreen overlay workspace (Phase 7A)
     * Relocates the workspace wrapper into a UniversalModal, preserving all state.
     * On close, the workspace moves back to its original position.
     */
    showFullscreenImage() {
      logDebug("[UI] Opening fullscreen workspace");

      // Check if we have image data
      if (!this.currentFile && !this.currentBase64) {
        logWarn("[UI] No image data available for fullscreen view");
        if (window.notifyError) {
          window.notifyError("No image available to view");
        }
        return;
      }

      // Get workspace element
      const workspace = document.getElementById("imgdesc-workspace");
      if (!workspace) {
        logError("[UI] Workspace wrapper element not found");
        if (window.notifyError) {
          window.notifyError("Fullscreen view not available");
        }
        return;
      }

      // Fix: Move preview back into workspace if relocated to output section
      const layout = document.querySelector(".imgdesc-layout");
      const isOutputMode = layout && layout.classList.contains("imgdesc-output-mode");
      if (isOutputMode && this.elements.preview) {
        workspace.insertBefore(this.elements.preview, workspace.firstChild);
        logDebug("[UI] Preview moved back into workspace for fullscreen");
      }

      // Check UniversalModal availability
      if (!window.UniversalModal?.Modal) {
        logWarn("[UI] Universal Modal not available");
        if (window.notifyError) {
          window.notifyError("Fullscreen view not available");
        }
        return;
      }

      try {
        // Insert placeholder to mark original position
        const placeholder = document.createElement("div");
        placeholder.id = "imgdesc-workspace-placeholder";
        placeholder.hidden = true;
        workspace.parentNode.insertBefore(placeholder, workspace);

        // ────────────────────────────────────────────────────────────
        // FULLSCREEN ESCAPE HANDLER — single authority for all Escape
        // behaviour while the fullscreen modal is open.
        //
        // Registered on document in CAPTURING phase so it fires before
        // every other handler.  It ALWAYS stops propagation, preventing
        // UniversalToggletip, UniversalModal, and native <dialog>
        // cancel from interfering.  Each case is handled explicitly.
        //
        // Cascade order:
        //   1. Open toggletip  → close it, keep modal open
        //   2. Review mode     → deselect item, or exit review
        //   3. Nothing else    → close the fullscreen modal
        // ────────────────────────────────────────────────────────────
        const self = this; // controller reference for case 3

        /**
         * Put the workspace (and, in output mode, the preview) back where they
         * came from. IDEMPOTENT — it is called from onBeforeFocusRestore, which
         * is where it has to run so the trigger exists before focus is
         * restored, and again from onClose as a safety net for any close route
         * that did not reach the hook. The placeholder is the guard: it is
         * removed on the first call, so the second does nothing.
         */
        const restoreWorkspaceToPage = function () {
          workspace.classList.remove("imgdesc-workspace--fullscreen");
          workspace.classList.remove("imgdesc-workspace--view-only");
          // Sidebar layout classes that only apply in fullscreen
          workspace.classList.remove("imgdesc-workspace--review-active");
          workspace.classList.remove("imgdesc-workspace--expanded");

          if (!placeholder.parentNode) return; // already restored

          placeholder.parentNode.insertBefore(workspace, placeholder);
          placeholder.remove();

          // Move the preview back to the output section if still in output mode
          const layoutEl = document.querySelector(".imgdesc-layout");
          if (
            layoutEl &&
            layoutEl.classList.contains("imgdesc-output-mode") &&
            self.elements.preview &&
            self.elements.progress
          ) {
            self.elements.progress.parentElement.insertBefore(
              self.elements.preview,
              self.elements.progress,
            );
            logDebug("[UI] Preview moved back to output section");
          }

          logDebug("[UI] Workspace restored to page");
        };

        const escapeHandler = function (e) {
          if (e.key !== "Escape") return;

          // Take full ownership — no other handler should see this event
          e.preventDefault();
          e.stopImmediatePropagation();

          const overlay = window.ImageDescriberOverlay;
          const toggletipMgr = window.UniversalToggletip;

          // ── Diagnostic state snapshot ──────────────────────────────
          const isActiveResult =
            toggletipMgr &&
            typeof toggletipMgr.isActive === "function" &&
            toggletipMgr.isActive();
          const dialogEl = workspace.closest("dialog");
          const domVisibleEl =
            dialogEl && dialogEl.querySelector(".universal-toggletip-visible");
          const inReview = overlay && overlay._inReviewMode;
          const hasSelection =
            overlay &&
            (overlay._selectedIndex !== null ||
              overlay._selectedAdditionIndex !== null);
          const modalRef = self._fullscreenModal;
          const activeEl = document.activeElement;
          const activeTag = activeEl
            ? activeEl.tagName +
              (activeEl.className ? "." + activeEl.className.split(" ")[0] : "")
            : "null";

          console.group("[EscapeCascade] Escape pressed in fullscreen");
          console.log("  isActive():", isActiveResult);
          console.log(
            "  DOM .universal-toggletip-visible:",
            domVisibleEl ? domVisibleEl.id || "yes" : "none",
          );
          console.log("  inReviewMode:", inReview);
          console.log("  hasSelection:", hasSelection);
          console.log("  _fullscreenModal:", modalRef ? "set" : "NULL");
          console.log("  modalRef.isOpen:", modalRef ? modalRef.isOpen : "n/a");
          console.log("  activeElement:", activeTag);
          console.log(
            "  openToggletips:",
            toggletipMgr && toggletipMgr._manager
              ? toggletipMgr._manager.openToggletips.length
              : "n/a",
          );

          // ── 1. Toggletip open → close it ──────────────────────────
          const hasOpenToggletip = isActiveResult || domVisibleEl;

          if (hasOpenToggletip) {
            console.log(
              "  → CASE 1: closing toggletip (via:",
              isActiveResult ? "isActive" : "DOM query",
              ")",
            );
            console.groupEnd();

            // Grab trigger BEFORE closeAll clears state
            const activeTrigger =
              toggletipMgr &&
              typeof toggletipMgr.getActiveToggletip === "function" &&
              toggletipMgr.getActiveToggletip()
                ? toggletipMgr.getActiveToggletip().trigger
                : null;

            if (toggletipMgr && typeof toggletipMgr.closeAll === "function") {
              toggletipMgr.closeAll();
            }

            // Force-clear internal state — closeAll() does not reliably
            // reset activeToggletip / openToggletips when toggletip
            // elements have been relocated into a <dialog>.
            if (toggletipMgr && toggletipMgr._manager) {
              toggletipMgr._manager.activeToggletip = null;
              toggletipMgr._manager.openToggletips = [];
            }

            // Belt-and-suspenders: forcefully hide any stale visible
            // toggletips inside the dialog
            if (dialogEl) {
              const stale = dialogEl.querySelectorAll(
                ".universal-toggletip-visible",
              );
              for (let s = 0; s < stale.length; s++) {
                stale[s].classList.remove("universal-toggletip-visible");
                stale[s].setAttribute("aria-hidden", "true");
              }
            }

            // Return focus to trigger (or dialog heading as fallback)
            if (activeTrigger && typeof activeTrigger.focus === "function") {
              activeTrigger.focus();
            } else {
              const heading =
                dialogEl && dialogEl.querySelector(".universal-modal-heading");
              if (heading) heading.focus();
            }
            return;
          }

          // ── 2. Review mode → deselect or exit ─────────────────────
          if (inReview) {
            if (hasSelection) {
              // Check for unsaved text changes (mirrors the review
              // panel's own Escape handler in image-describer-overlay.js)
              const textInput = document.getElementById("imgdesc-review-text");
              const currentText = textInput ? textInput.value : "";
              const originalText = overlay._reviewPanelOriginalText || "";
              const hasUnsaved = currentText.trim() !== originalText.trim();

              if (hasUnsaved && typeof window.safeConfirm === "function") {
                console.log("  → CASE 2a: unsaved changes — prompting");
                console.groupEnd();
                window
                  .safeConfirm(
                    "You have unsaved changes to this item. Discard them?",
                    "Unsaved Changes",
                  )
                  .then(function (discard) {
                    if (discard) {
                      overlay.deselectOCRItem();
                    } else if (textInput) {
                      textInput.focus();
                    }
                  });
              } else {
                console.log("  → CASE 2a: deselecting review item");
                console.groupEnd();
                overlay.deselectOCRItem();
              }
            } else {
              console.log("  → CASE 2b: exiting review mode");
              console.groupEnd();
              overlay.exitReviewMode();
            }
            return;
          }

          // ── 3. Nothing else open → close the fullscreen modal ─────
          console.log("  → CASE 3: closing fullscreen modal");
          console.groupEnd();
          if (modalRef) {
            modalRef.close();
          } else {
            console.warn(
              "[EscapeCascade] CASE 3 but _fullscreenModal is null!",
            );
          }
        };

        // Create modal — passing workspace element as content triggers appendChild()
        const modal = new window.UniversalModal.Modal({
          title: "Image Workspace",
          content: workspace,
          size: "fullscreen",
          className: "imgdesc-fullscreen-modal",
          closeOnEscape: true,
          closeOnOverlayClick: true,

          // WHERE FOCUS RETURNS. Works only because onBeforeFocusRestore below
          // has already put the workspace — and therefore this button — back in
          // the page. Resolved by id at close time, since displayPreview()
          // rebuilds the preview markup and a captured element can be stale.
          returnFocusTo: FULLSCREEN_TRIGGER_ID,

          // PUT THE DOM BACK BEFORE ANYTHING IS FOCUSED.
          //
          // This used to live in onClose, and focus still ended up on the right
          // button — but a focus-event log showed #main being focused 6ms FIRST,
          // by the tier chain, because at that instant the trigger was still
          // inside the detached dialog. Landing on the #main landmark is what
          // makes NVDA read the entire main region, so the listen heard a
          // whole-page read even though the final activeElement was correct.
          // An end-state measurement cannot see a transient landing; the event
          // log is what found it.
          onBeforeFocusRestore: function () {
            restoreWorkspaceToPage();
          },

          onOpen: function () {
            workspace.classList.add("imgdesc-workspace--fullscreen");

            // View-only mode: hide review sidebar/toolbar when opened from output
            if (isOutputMode) {
              workspace.classList.add("imgdesc-workspace--view-only");
            }

            // Prevent native <dialog> Escape handling — modern browsers
            // close showModal() dialogs via a close watcher / cancel event
            // BEFORE keydown handlers fire.  We need full control of Escape
            // via the cascade handler, so suppress the native behaviour.
            const dialogEl = workspace.closest("dialog");
            if (dialogEl) {
              dialogEl.addEventListener("cancel", function (ev) {
                ev.preventDefault();
              });
            }

            // If review mode was already active before fullscreen opened,
            // apply the sidebar layout class now that --fullscreen is present.
            // (enterReviewMode skips this when fullscreen isn't active yet.)
            const overlay = window.ImageDescriberOverlay;
            if (overlay && overlay._inReviewMode) {
              workspace.classList.add("imgdesc-workspace--review-active");
              const expandToggle = document.getElementById(
                "imgdesc-expand-toggle",
              );
              if (expandToggle) expandToggle.hidden = false;
            }

            if (window.ImageDescriberOverlay?.refreshLayout) {
              window.ImageDescriberOverlay.refreshLayout();
            }

            // Register capturing listener — fires BEFORE the modal's
            // own bubble-phase document keydown handler
            document.addEventListener("keydown", escapeHandler, true);

            logInfo("[UI] Fullscreen workspace opened");
          },
          onClose: function () {
            // Remove the cascade handler first
            document.removeEventListener("keydown", escapeHandler, true);

            // Remember whether review mode was active — refreshLayout()
            // triggers _renderFromAnalysis() which exits review mode
            // because re-rendering destroys all overlay boxes.
            const overlay = window.ImageDescriberOverlay;
            const wasInReviewMode = overlay && overlay._inReviewMode;

            // The workspace and preview are already back — onBeforeFocusRestore
            // did it, so the trigger existed in time for tier 1. Calling it
            // again is a no-op by design, and is kept so that a close route
            // which somehow skipped that hook still restores the DOM rather
            // than leaving the workspace detached.
            restoreWorkspaceToPage();

            // Rebuild toggletips — the old ones were destroyed when the
            // <dialog> was removed from the DOM.  refreshLayout() detects
            // missing toggletip elements and re-renders the overlay,
            // creating fresh toggletips in document.body.
            if (overlay && typeof overlay.refreshLayout === "function") {
              overlay.refreshLayout();
            }

            // Restore review mode if it was active before fullscreen closed.
            // refreshLayout → _renderFromAnalysis exits review mode because
            // re-rendering destroys all boxes, but the user expects to
            // return to the same state they were in before going fullscreen.
            if (
              wasInReviewMode &&
              overlay &&
              typeof overlay.enterReviewMode === "function"
            ) {
              overlay.enterReviewMode();
            }

            logInfo("[UI] Fullscreen workspace closed, DOM restored");

            // SAFETY NET ONLY. returnFocusTo + onBeforeFocusRestore should
            // already have landed focus on the trigger during finishClose, so
            // in the normal case this does nothing. It stays for the route
            // where the hook did not run, and it is GUARDED so it cannot fire a
            // second, redundant focus move — the whole point of this parcel is
            // that an extra landing is audible even when the final one is right.
            const trigger = document.getElementById(FULLSCREEN_TRIGGER_ID);
            if (document.activeElement !== trigger) {
              restoreFocusAfterFullscreen();
            }
          },
        });

        modal.open();
        this._fullscreenModal = modal;
      } catch (error) {
        logError("[UI] Failed to open fullscreen workspace:", error);
        if (window.notifyError) {
          window.notifyError("Failed to open fullscreen view");
        }
      }
    },

    // ========================================================================
    // LAYOUT SWITCHING (Phase 2B.2)
    // ========================================================================

    /**
     * Show configuration UI, hide output (Phase 2B.2)
     * Used when starting fresh or resetting
     */
    showConfigurationUI() {
      logDebug("Showing configuration UI");

      // Remove output mode class from layout for two-column styling
      const layout = document.querySelector(".imgdesc-layout");
      if (layout) {
        layout.classList.remove("imgdesc-output-mode");
      }

      // Show config panel
      if (this.elements.configPanel) {
        this.elements.configPanel.hidden = false;
      }

      // Show upload area
      if (this.elements.uploadArea) {
        this.elements.uploadArea.style.display = "";
      }

      // Show generate button area
      if (this.elements.generateArea) {
        this.elements.generateArea.hidden = false;
      }

      // Restore camera section visibility (Phase 5E fix)
      const cameraSection = document.getElementById("imgdesc-camera-section");
      if (cameraSection) cameraSection.hidden = false;

      // Restore overlay layer visibility (Phase 6A)
      const overlayContainer = document.querySelector(
        ".imgdesc-overlay-container",
      );
      if (overlayContainer)
        overlayContainer.classList.remove("imgdesc-overlays-hidden");

      // Restore overlay toolbar if analysis data exists
      // (showOutputUI hides it, but returning to config should show it again)
      if (this.lastAnalysis) {
        const overlayToolbar = document.getElementById("imgdesc-overlay-toolbar");
        if (overlayToolbar) overlayToolbar.hidden = false;

        const classBadge = document.getElementById("imgdesc-overlay-classification");
        if (classBadge && classBadge.textContent) classBadge.hidden = false;
      }

      // Restore Florence-2 OCR prompt state (Phase 14J)
      if (typeof this._updateFlorenceOCRPrompt === "function") {
        this._updateFlorenceOCRPrompt();
      }

      // Show the "Upload Image" heading
      const uploadHeading = document.querySelector(
        ".imgdesc-input-column .imgdesc-section h2",
      );
      if (uploadHeading) {
        uploadHeading.style.display = "";
      }

      // Move preview back into the workspace wrapper as its first child.
      // The original DOM order is: workspace → preview → analysis-status → toolbar → sidebar
      const workspace = document.getElementById("imgdesc-workspace");
      if (this.elements.preview && workspace) {
        workspace.insertBefore(this.elements.preview, workspace.firstChild);
        logDebug("Preview moved back into workspace");
      }

      // Hide output section
      if (this.elements.outputSection) {
        this.elements.outputSection.style.display = "none";
      }

      // Clear status
      if (this.elements.status) {
        this.elements.status.textContent = "";
        this.elements.status.className = "imgdesc-status";
      }
    },

    /**
     * Show output UI, hide configuration (Phase 2B.2)
     * Used during and after generation
     */
    showOutputUI() {
      logDebug("Showing output UI");

      // Add output mode class to layout for single-column styling
      const layout = document.querySelector(".imgdesc-layout");
      if (layout) {
        layout.classList.add("imgdesc-output-mode");
      }

      // Hide config panel
      if (this.elements.configPanel) {
        this.elements.configPanel.hidden = true;
      }

      // Hide upload area (keep preview visible)
      if (this.elements.uploadArea) {
        this.elements.uploadArea.style.display = "none";
      }

      // Hide generate button area
      if (this.elements.generateArea) {
        this.elements.generateArea.hidden = true;
      }

      // Hide the "Upload Image" heading
      const uploadHeading = document.querySelector(
        ".imgdesc-input-column .imgdesc-section h2",
      );
      if (uploadHeading) {
        uploadHeading.style.display = "none";
      }

      // Exit review mode and hide review list panel during generation
      if (window.ImageDescriberOverlay && window.ImageDescriberOverlay._inReviewMode) {
        window.ImageDescriberOverlay.exitReviewMode();
      }
      const reviewListPanel = document.getElementById("imgdesc-review-list-panel");
      if (reviewListPanel) reviewListPanel.hidden = true;

      // Hide overlay toolbar during generation output (Phase 5E fix)
      const overlayToolbar = document.getElementById("imgdesc-overlay-toolbar");
      if (overlayToolbar) overlayToolbar.hidden = true;

      // Hide classification badge during generation output (Phase 5E fix)
      const classBadge = document.getElementById(
        "imgdesc-overlay-classification",
      );
      if (classBadge) classBadge.hidden = true;

      // Hide Florence-2 OCR prompt during generation output (Phase 14J)
      const florenceOCRPrompt = document.getElementById("imgdesc-florence-ocr-prompt");
      if (florenceOCRPrompt) florenceOCRPrompt.hidden = true;

      // Hide camera section during generation output (Phase 5E fix)
      const cameraSection = document.getElementById("imgdesc-camera-section");
      if (cameraSection) cameraSection.hidden = true;

      // Hide overlay layers during generation output (Phase 6A)
      if (typeof window.ImageDescriberOverlay !== "undefined") {
        const overlayContainer = document.querySelector(
          ".imgdesc-overlay-container",
        );
        if (overlayContainer)
          overlayContainer.classList.add("imgdesc-overlays-hidden");
      }

      // Hide analysis status line during generation output (Phase 6A)
      const analysisStatusEl = document.getElementById(
        "imgdesc-analysis-status",
      );
      if (analysisStatusEl) analysisStatusEl.hidden = true;

      // Hide profile suggestion banner during generation output (Phase 5C)
      const suggestionBanner = document.getElementById(
        "imgdesc-profile-suggestion",
      );
      if (suggestionBanner) suggestionBanner.hidden = true;

      // Move preview into output section (before progress, so progress/completion/warning appear below it)
      if (this.elements.preview && this.elements.progress) {
        this.elements.progress.parentElement.insertBefore(
          this.elements.preview,
          this.elements.progress,
        );
        logDebug("Preview moved into output section");
      }

      // Show output section
      if (this.elements.outputSection) {
        this.elements.outputSection.style.display = "";
      }
    },

    /**
     * Reset the tool for describing a new image (Phase 2B.2)
     */
    resetForNewImage() {
      logInfo("Resetting for new image");

      // Clear file state
      this.currentFile = null;
      this.compressedFile = null;
      this.compressionInfo = null;

      // Clear file input
      if (this.elements.fileInput) {
        this.elements.fileInput.value = "";
      }

      // Clear preview
      if (this.elements.preview) {
        this.elements.preview.innerHTML = "";
      }

      // Hide clear button
      if (this.elements.clearBtn) {
        this.elements.clearBtn.style.display = "none";
      }

      // Restore full upload area
      if (this.elements.uploadArea) {
        this.elements.uploadArea.classList.remove("imgdesc-upload-collapsed");
        const uploadText = this.elements.uploadArea.querySelector(
          ".imgdesc-upload-text",
        );
        if (uploadText) {
          uploadText.textContent = "Choose an image or drag and drop";
        }
      }

      // Clear output
      if (typeof this._teardownFollowObserver === "function") {
        this._teardownFollowObserver();
      }
      if (this.elements.output) {
        this.elements.output.innerHTML = "";
        this.elements.output.classList.remove("imgdesc-output--follow");
        this.elements.output.setAttribute("tabindex", "-1");
      }

      // Clear form fields (optional - you may want to keep context for similar images)
      // Uncomment the following if you want to clear all fields:
      /*
      if (this.elements.subject) this.elements.subject.value = '';
      if (this.elements.topic) this.elements.topic.value = '';
      if (this.elements.objective) this.elements.objective.value = '';
      if (this.elements.context) this.elements.context.value = '';
      if (this.elements.module) this.elements.module.value = '';
      */

      // Hide completion time
      this.hideCompletionTime();

      // Clear profile suggestion banner (Phase 5C)
      const suggestionBanner = document.getElementById(
        "imgdesc-profile-suggestion",
      );
      if (suggestionBanner) suggestionBanner.hidden = true;
      this._pendingSuggestion = null;

      // Phase 11D: hide cache recall banner
      this.hideCacheRecallBanner();

      // Clear analysis status (Phase 6A)
      const analysisStatus = document.getElementById("imgdesc-analysis-status");
      if (analysisStatus) analysisStatus.hidden = true;

      // Clear overlay (Phase 5D-1)
      if (typeof window.ImageDescriberOverlay !== "undefined") {
        // Exit review mode first if active (Phase 5D-2)
        if (window.ImageDescriberOverlay._inReviewMode) {
          window.ImageDescriberOverlay.exitReviewMode();
        }
        window.ImageDescriberOverlay.clearAnalysis();
        window.ImageDescriberOverlay.destroy();
        // Clear user OCR edits — corrections are per-image (Phase 5D-2)
        window.ImageDescriberOverlay._userEdits = null;
        window.ImageDescriberOverlay._sortedItems = [];
      }
      const overlayToolbar = document.getElementById("imgdesc-overlay-toolbar");
      if (overlayToolbar) overlayToolbar.hidden = true;

      // Clear analysis state (Local Analysis)
      this.lastAnalysis = null;
      this._analysisPending = null;
      this._immediateResult = null;
      this._immediateCanvasData = null;

      // Phase 10D-fix: reset Florence-2 session flag
      this._florenceRanThisSession = false;

      // Phase 10C-fix: reset Florence-2 opt-in state
      const florenceBtn = document.getElementById("imgdesc-florence2-run-btn");
      if (florenceBtn) {
        florenceBtn.disabled = true;
        florenceBtn.innerHTML =
          '<span aria-hidden="true" data-icon="aiSparkle"></span> Run Florence-2';
      }
      const florenceStatus = document.getElementById(
        "imgdesc-florence2-status",
      );
      if (florenceStatus) {
        florenceStatus.hidden = true;
        florenceStatus.textContent = "";
      }
      const florenceOptin = document.getElementById("imgdesc-florence2-optin");
      if (florenceOptin) florenceOptin.hidden = true;

      // Phase 14J: reset Florence-2 OCR quick-access prompt
      this._florenceOCRRunning = false;
      this._florenceOCRLoading = false;
      this._florenceOCRStartTime = null;
      const florenceOCRPrompt = document.getElementById("imgdesc-florence-ocr-prompt");
      if (florenceOCRPrompt) {
        florenceOCRPrompt.hidden = true;
        florenceOCRPrompt.innerHTML = "";
      }

      // Clear debug panel (Phase 2C)
      this.clearDebugPanel();

      // Clear verification state (Two-Pass)
      this.clearVerification();

      // Show configuration UI
      this.showConfigurationUI();

      // Update button states
      this.updateButtonStates();

      // Clean up camera (Phase 2E.2)
      this.cleanupCamera();
      if (this.elements.cameraSection) {
        this.elements.cameraSection.open = false;
      }

      // Focus on file input for accessibility
      if (this.elements.fileInput) {
        this.elements.fileInput.focus();
      }

      logInfo("Reset complete - ready for new image");
    },

    /**
     * Keep the current image but return to the configuration UI so the user
     * can choose a different profile, audience, style, or context fields
     * before regenerating.
     */
    redescribeWithNewOptions() {
      logInfo("Redescribe with new options — keeping current image");

      // Clear output
      if (typeof this._teardownFollowObserver === "function") {
        this._teardownFollowObserver();
      }
      if (this.elements.output) {
        this.elements.output.innerHTML = "";
        this.elements.output.classList.remove("imgdesc-output--follow");
        this.elements.output.setAttribute("tabindex", "-1");
      }

      // Hide completion time
      this.hideCompletionTime();

      // Exit overlay review mode if active, but keep overlay data
      if (typeof window.ImageDescriberOverlay !== "undefined") {
        if (window.ImageDescriberOverlay._inReviewMode) {
          window.ImageDescriberOverlay.exitReviewMode();
        }
      }

      // Clear debug panel
      this.clearDebugPanel();

      // Clear verification state
      this.clearVerification();

      // Re-show the profile suggestion banner if we have analysis data
      if (this.lastAnalysis && this._pendingSuggestion) {
        const suggestionBanner = document.getElementById(
          "imgdesc-profile-suggestion",
        );
        if (suggestionBanner) suggestionBanner.hidden = false;
      }

      // Return to configuration view (shows config panel, generate button,
      // upload area, and moves preview back into workspace)
      this.showConfigurationUI();

      // Update button states
      this.updateButtonStates();

      // Focus the generate button for accessibility — the user likely wants
      // to adjust options then hit Generate
      if (this.elements.generateBtn) {
        this.elements.generateBtn.focus();
      }

      logInfo("Redescribe reset complete — configuration UI restored");
    },

    // ========================================================================
    // OUTPUT DISPLAY
    // ========================================================================

    /**
     * Show the output section
     */
    showOutputSection() {
      if (this.elements.outputSection) {
        this.elements.outputSection.style.display = "";
        this.elements.outputSection.hidden = false;
      }
    },

    /**
     * Hide the output section
     */
    hideOutputSection() {
      if (this.elements.outputSection) {
        this.elements.outputSection.style.display = "none";
        this.elements.outputSection.hidden = true;
      }
    },

    /**
     * Apply MathJax typesetting to rendered output
     * Converts LaTeX notation ($...$ and $$...$$) into rendered mathematics.
     * Uses mathJaxManager queue if available, falls back to direct MathJax call.
     * @param {HTMLElement} container - The container with rendered content
     * @returns {Promise<void>}
     */
    async typesetMathJax(container) {
      if (
        !window.MathJax ||
        typeof window.MathJax.typesetPromise !== "function"
      ) {
        logDebug("MathJax not available - skipping typesetting");
        return;
      }

      try {
        // Try queue system first for race condition prevention
        if (window.mathJaxManager) {
          const managerStatus = window.mathJaxManager.getStatus();

          if (managerStatus.isHealthy) {
            try {
              await window.mathJaxManager.queueTypeset(container);
              logDebug("MathJax rendered via queue manager");
              return;
            } catch (error) {
              logWarn(
                "MathJax queue rendering failed, using direct fallback:",
                error,
              );
            }
          } else {
            logDebug("MathJax Manager unhealthy, using direct rendering");
          }
        }

        // Direct fallback
        await window.MathJax.typesetPromise([container]);
        logDebug("MathJax rendered via direct typesetPromise");
      } catch (error) {
        logWarn("MathJax typesetting failed:", error);
      }
    },

    /**
     * Unwrap <p> tags from inside list items and trim whitespace nodes
     * to prevent loose-list spacing issues.
     * @param {HTMLElement} container - The container with rendered content
     */
    unwrapLooseListItems(container) {
      let unwrapped = 0;
      let trimmed = 0;

      // Step 1: Unwrap <p> tags inside list items
      const wrappedItems = container.querySelectorAll("li > p");
      wrappedItems.forEach((p) => {
        const li = p.parentElement;
        while (p.firstChild) {
          li.insertBefore(p.firstChild, p);
        }
        p.remove();
        unwrapped++;
      });

      // Step 2: Trim leading/trailing whitespace-only text nodes from all list items
      const allItems = container.querySelectorAll("li");
      allItems.forEach((li) => {
        // Trim leading whitespace text nodes
        while (
          li.firstChild &&
          li.firstChild.nodeType === 3 &&
          li.firstChild.textContent.trim() === ""
        ) {
          li.firstChild.remove();
          trimmed++;
        }

        // Trim trailing whitespace text nodes
        while (
          li.lastChild &&
          li.lastChild.nodeType === 3 &&
          li.lastChild.textContent.trim() === ""
        ) {
          li.lastChild.remove();
          trimmed++;
        }
      });

      if (unwrapped > 0 || trimmed > 0) {
        logDebug(
          `List items tidied: ${unwrapped} unwrapped, ${trimmed} whitespace nodes trimmed`,
        );
      }
    },

    /**
     * Adjust heading levels in rendered output (Phase 2B.3)
     * Normalises heading hierarchy to start at h3 and be sequential without gaps
     * @param {HTMLElement} container - The container with rendered content
     */
    adjustHeadingLevels(container) {
      if (!container) {
        logWarn("No container provided for heading adjustment");
        return;
      }

      // Get all headings in document order
      const allHeadings = container.querySelectorAll("h1, h2, h3, h4, h5, h6");

      if (allHeadings.length === 0) {
        logDebug("No headings found to adjust");
        return;
      }

      // Build a mapping of original levels to normalised levels
      const targetStartLevel = 3;

      // Find all unique levels used in the content
      const levelsUsed = [];
      allHeadings.forEach((heading) => {
        const level = parseInt(heading.tagName.charAt(1), 10);
        if (!levelsUsed.includes(level)) {
          levelsUsed.push(level);
        }
      });

      // Sort levels to understand the hierarchy
      levelsUsed.sort((a, b) => a - b);

      // Create mapping: original level → new level (sequential from h3)
      const levelMapping = {};
      levelsUsed.forEach((originalLevel, index) => {
        const newLevel = Math.min(targetStartLevel + index, 6);
        levelMapping[originalLevel] = newLevel;
      });

      logDebug("Heading level mapping:", levelMapping);

      // Apply the mapping to all headings
      allHeadings.forEach((heading) => {
        const originalLevel = parseInt(heading.tagName.charAt(1), 10);
        const newLevel = levelMapping[originalLevel];

        // Only change if level is different
        if (originalLevel !== newLevel) {
          const newHeading = document.createElement(`h${newLevel}`);

          // Copy all attributes
          Array.from(heading.attributes).forEach((attr) => {
            newHeading.setAttribute(attr.name, attr.value);
          });

          // Copy content
          newHeading.innerHTML = heading.innerHTML;

          // Replace original
          heading.replaceWith(newHeading);
        }
      });

      logDebug("Heading levels normalised for accessibility", {
        originalLevels: levelsUsed,
        startLevel: targetStartLevel,
        mappings: levelMapping,
      });
    },

    /**
     * Extract alt text from generated description (Phase 2E)
     * Searches for any heading containing "Alt Text" and extracts following content
     */
    extractAndApplyAltText() {
      if (!this.elements.output) {
        logDebug("No output element to extract alt text from");
        return;
      }

      try {
        // Find any heading containing "alt text" (case-insensitive)
        const allHeadings = this.elements.output.querySelectorAll(
          "h1, h2, h3, h4, h5, h6",
        );
        let altTextHeading = null;

        for (const heading of allHeadings) {
          const headingText = heading.textContent.trim().toLowerCase();
          if (headingText === "alt text" || headingText.includes("alt text")) {
            altTextHeading = heading;
            logDebug(
              `Found alt text heading: <${heading.tagName.toLowerCase()}>`,
            );
            break;
          }
        }

        if (!altTextHeading) {
          logDebug("No 'Alt Text' heading found in output");
          return;
        }

        // Extract text after the heading until next heading, <hr>, or end
        let altText = "";
        let currentNode = altTextHeading.nextElementSibling;

        while (currentNode) {
          // Stop at next heading or horizontal rule (section divider)
          if (
            currentNode.tagName.match(/^H[1-6]$/) ||
            currentNode.tagName === "HR"
          ) {
            break;
          }

          // Accumulate text content from paragraphs and other text elements
          const text = currentNode.textContent.trim();
          if (text) {
            altText += (altText ? " " : "") + text;
          }

          currentNode = currentNode.nextElementSibling;
        }

        if (!altText) {
          logDebug("No alt text content found after 'Alt Text' heading");
          return;
        }

        // Clean up the alt text (remove excessive whitespace)
        altText = altText.replace(/\s+/g, " ").trim();

        // Store for later use
        this.extractedAltText = altText;

        // Update preview image alt text
        const previewImg = this.elements.preview?.querySelector("img");
        if (previewImg) {
          previewImg.alt = altText;
          logInfo("Preview image alt text updated");
        }

        // Update fullscreen button for accessibility
        const fullscreenBtn = this.elements.preview?.querySelector(
          "#imgdesc-fullscreen-btn",
        );
        if (fullscreenBtn) {
          fullscreenBtn.setAttribute(
            "aria-label",
            `View image fullscreen. Image description: ${altText.substring(
              0,
              100,
            )}${altText.length > 100 ? "..." : ""}`,
          );
        }

        logInfo(
          "Alt text extracted and applied:",
          altText.substring(0, 50) + "...",
        );
      } catch (error) {
        logError("Failed to extract alt text:", error);
      }
    },

    // ========================================================================
    // COPY OPERATIONS (Phase 2B.3)
    // ========================================================================

    /**
     * Copy output to clipboard (Phase 2B.3 - updated)
     * Copies the original markdown with original heading structure
     */
    async copyToClipboard() {
      if (!this.lastRawOutput) {
        this.showError("No content to copy");
        return;
      }

      try {
        await navigator.clipboard.writeText(this.lastRawOutput);

        // Show success feedback
        this.showCopyFeedback("imgdesc-copy", "Text copied!");

        logInfo("Plain text copied to clipboard");
      } catch (error) {
        logError("Copy failed:", error);
        this.showError("Failed to copy to clipboard");
      }
    },

    /**
     * Copy formatted text to clipboard (Phase 2B.3)
     * Preserves bold, headings, lists when pasted into Word/Google Docs
     * Uses original HTML (with H1 headings) for standalone context
     */
    async copyFormattedText() {
      if (!this.lastRawHTML && !this.elements.output) {
        this.showError("No content to copy");
        return;
      }

      try {
        // Use original HTML (before heading adjustment) so H1 is preserved
        const rawHtml = this.lastRawHTML || this.elements.output.innerHTML;

        // Wrap fragment in a minimal HTML document. Word maps <h1>..<h6>
        // to its built-in Heading styles, but only when the clipboard HTML
        // is a recognisable document rather than a bare fragment. Without
        // the wrapper, Word pastes the headings as Normal style.
        const html =
          "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body>" +
          rawHtml +
          "</body></html>";

        // Also create plain text fallback
        const text = this.lastRawOutput || this.elements.output.innerText;

        // Create blobs for both formats
        const htmlBlob = new Blob([html], { type: "text/html" });
        const textBlob = new Blob([text], { type: "text/plain" });

        // Write both formats to clipboard
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": htmlBlob,
            "text/plain": textBlob,
          }),
        ]);

        this.showCopyFeedback(
          "imgdesc-copy-formatted",
          "Formatted text copied!",
        );
        logInfo(
          "Formatted text copied to clipboard (with original H1 headings)",
        );
      } catch (error) {
        logError("Failed to copy formatted text:", error);
        // Fallback to plain text if ClipboardItem not supported
        try {
          await navigator.clipboard.writeText(
            this.lastRawOutput || this.elements.output.innerText,
          );
          this.showCopyFeedback(
            "imgdesc-copy-formatted",
            "Text copied (plain)",
          );
          logWarn("ClipboardItem not supported, fell back to plain text");
        } catch (fallbackError) {
          this.showError("Failed to copy");
        }
      }
    },

    /**
     * Copy HTML source to clipboard (Phase 2B.3)
     * For pasting into web pages, CMS, code editors, etc.
     * Uses original HTML (with H1 headings) for standalone context
     */
    async copyAsHTML() {
      if (!this.lastRawHTML && !this.elements.output) {
        this.showError("No content to copy");
        return;
      }

      try {
        // Use original HTML (before heading adjustment) so H1 is preserved
        const html = this.lastRawHTML || this.elements.output.innerHTML;

        // Copy as plain text (the HTML source code itself)
        await navigator.clipboard.writeText(html);

        this.showCopyFeedback("imgdesc-copy-html", "HTML copied!");
        logInfo("HTML source copied to clipboard (with original H1 headings)");
      } catch (error) {
        logError("Failed to copy HTML:", error);
        this.showError("Failed to copy HTML");
      }
    },

    /**
     * Show visual feedback on copy button (Phase 2B.3)
     * @param {string} buttonId - ID of the button to show feedback on
     * @param {string} message - Success message
     */
    showCopyFeedback(buttonId, message) {
      const button = document.getElementById(buttonId);
      if (!button) return;

      const originalHTML = button.innerHTML;
      button.innerHTML = `<span aria-hidden="true">✓</span> ${message}`;
      button.classList.add("imgdesc-copy-success");

      setTimeout(() => {
        button.innerHTML = originalHTML;
        button.classList.remove("imgdesc-copy-success");
      }, 2000);

      // Also show notification for better feedback
      if (window.notifySuccess) {
        window.notifySuccess(message);
      }

      logDebug("Copy feedback shown:", message);
    },

    // ========================================================================
    // CLEAR / RESET
    // ========================================================================

    /**
     * Clear all state and reset form with memory cleanup
     */
    clear() {
      logInfo("Clearing state with memory cleanup...");

      // Track memory before cleanup (via core-exposed utility)
      const memUtils = this._memoryUtils;
      if (memUtils?.MemoryMonitor) {
        memUtils.MemoryMonitor.track("ImageDescriber_clear_start", {
          hadFile: !!this.currentFile,
          hadOutput: !!this.lastRawOutput,
        });
      }

      // Clear file (includes memory cleanup)
      this.clearFile();

      // Clear output
      this.lastRawOutput = null;
      this.lastRawHTML = null;
      if (this.elements.output) {
        this.elements.output.innerHTML = "";
      }
      this.hideOutputSection();

      // Hide status
      this.hideStatus();

      // Clear debug panel (Phase 2C)
      this.clearDebugPanel();

      // Phase 11D: hide cache recall banner
      this.hideCacheRecallBanner();

      // Update button states
      this.updateButtonStates();

      // Announce to screen reader
      this.announceStatus("Form cleared");

      // Track memory after cleanup (via core-exposed utility)
      if (memUtils?.MemoryMonitor) {
        memUtils.MemoryMonitor.track("ImageDescriber_clear_complete", {
          cleaned: true,
        });
      }

      // Suggest garbage collection
      if (window.gc) {
        window.gc();
        logDebug("Garbage collection suggested");
      }

      logInfo("State cleared with memory cleanup complete");
    },
  };

  // ============================================================================
  // MIX INTO CONTROLLER
  // ============================================================================

  if (window.ImageDescriberController) {
    Object.assign(window.ImageDescriberController, methods);
    logInfo("UI and file handling methods loaded");
  } else {
    logError("ImageDescriberController not found \u2014 UI methods not loaded");
  }
})();
