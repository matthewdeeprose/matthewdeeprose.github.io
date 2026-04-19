// ─── MathPixSessionRestorer Editor Mixin ─────────────────────────────────────
// Edit mode, fullscreen, focus mode, and textarea.
// Depends on: session-restorer-core.js
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (!window._SRShared) {
    console.error(
      "[SessionRestorer] session-restorer-core.js must load before session-restorer-editor.js",
    );
    return;
  }

  const { logError, logWarn, logInfo, logDebug, getIcon, RESTORER_CONFIG } =
    window._SRShared;
  const proto = MathPixSessionRestorer.prototype;

  // =========================================================================
  // EDITOR FUNCTIONALITY
  // =========================================================================

  /**
   * Toggle edit mode
   * @private
   */
  proto.toggleEditMode = function () {
    const isEditing =
      this.elements.mmdCodeContainer?.dataset.editing === "true";

    // Toggle to opposite state
    this.setEditMode(!isEditing);
  };

  /**
   * Set edit mode to a specific state
   * @param {boolean} enableEditing - Whether editing should be enabled
   * @private
   */
  proto.setEditMode = function (enableEditing) {
    if (this.elements.mmdCodeContainer) {
      this.elements.mmdCodeContainer.dataset.editing = enableEditing.toString();
    }

    // Update button text and aria-pressed to match actual state
    if (this.elements.mmdEditBtn) {
      this.elements.mmdEditBtn.innerHTML = enableEditing
        ? `${getIcon("check")} Stop Editing`
        : `${getIcon("pencil")} Edit MMD`;
      this.elements.mmdEditBtn.setAttribute(
        "aria-pressed",
        enableEditing.toString(),
      );
    }

    // Show/hide editor toolbar based on editing state
    if (this.elements.mmdEditorToolbar) {
      this.elements.mmdEditorToolbar.hidden = !enableEditing;
    }

    logDebug("Edit mode set:", { enableEditing });

    // Auto-resize textarea when entering edit mode
    if (enableEditing) {
      // Use requestAnimationFrame to ensure textarea is visible before measuring
      requestAnimationFrame(() => {
        this.autoResizeTextarea();
      });
    }

    // Show/hide fullscreen button based on editing state (Phase 5.4)
    if (this.elements.mmdFullscreenBtn) {
      this.elements.mmdFullscreenBtn.hidden = !enableEditing;
    }

    // Exit fullscreen when stopping edit mode
    if (!enableEditing && this.isFullscreen) {
      this.exitFullscreen();
    }

    // Phase 8.3.5: Toggle contenteditable on line-based editor
    if (this.lineBasedEditor) {
      const lineContents =
        this.lineBasedEditor.querySelectorAll(".line-content");
      lineContents.forEach((el) => {
        el.setAttribute("contenteditable", enableEditing.toString());
      });
      logDebug(`Line-based editor contenteditable set to ${enableEditing}`);
    }

    // Phase 8.3.4: Manage gutter scroll synchronisation for edit mode (legacy)
    this.manageGutterScrollSync(enableEditing);
  };

  // =========================================================================
  // TEXTAREA AUTO-RESIZE (Phase 8.3.5 Responsive Fix)
  // =========================================================================

  /**
   * Auto-resize textarea to fit its content
   * Prevents internal scrollbars by expanding textarea to full content height
   * @param {HTMLTextAreaElement} [textarea] - Textarea element (defaults to mmdEditorTextarea)
   * @private
   */
  proto.autoResizeTextarea = function (textarea = null) {
    const target = textarea || this.elements.mmdEditorTextarea;
    if (!target) return;

    // Only resize if textarea is visible
    if (target.offsetParent === null) return;

    // Skip auto-resize in fullscreen mode - let CSS handle sizing and enable scrolling
    if (this.isFullscreen) {
      // Clear any previous inline height/flex so CSS can control sizing
      target.style.height = "";
      target.style.flex = "";
      target.style.overflowY = "auto";
      logDebug("Textarea auto-resize skipped (fullscreen mode)");
      return;
    }

    // Store scroll position of parent container
    const scrollContainer = target.closest(".mathpix-format-content");
    const scrollTop = scrollContainer?.scrollTop || 0;

    // Break flex constraint - flex-basis: 0% prevents content-based sizing
    target.style.flex = "none";

    // Reset height to auto to get accurate scrollHeight
    target.style.height = "auto";

    // Set height to scrollHeight plus a small buffer
    const newHeight = target.scrollHeight + 2;
    target.style.height = `${newHeight}px`;

    // Restore scroll position
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollTop;
    }

    logDebug("Textarea auto-resized:", {
      newHeight,
      scrollHeight: target.scrollHeight,
    });
  };

  /**
   * Set up auto-resize behaviour for the MMD editor textarea
   * Called once during initialisation
   * @private
   */
  proto.setupTextareaAutoResize = function () {
    const textarea = this.elements.mmdEditorTextarea;
    if (!textarea) {
      logDebug("Cannot setup textarea auto-resize - element not found");
      return;
    }

    // Resize on window resize (debounced)
    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Only resize if in edit mode and textarea is visible
        const isEditing =
          this.elements.mmdCodeContainer?.dataset.editing === "true";
        if (isEditing) {
          this.autoResizeTextarea(textarea);
        }
      }, 100);
    });

    logDebug("Textarea auto-resize setup complete");
  };

  /**
   * Phase 8.3.4: Manage gutter scroll synchronisation for edit mode
   * In edit mode, the textarea has internal scroll that doesn't affect
   * the parent container, so we need to manually sync the gutter position.
   * @param {boolean} enableEditing - Whether editing is being enabled
   * @private
   */
  proto.manageGutterScrollSync = function (enableEditing) {
    const textarea = this.elements.mmdEditorTextarea;
    const gutter = this.elements.confidenceGutter;

    // Only manage if both elements exist and confidence is enabled
    if (!textarea || !gutter || !this.isConfidenceEnabled) {
      return;
    }

    if (enableEditing) {
      // Create bound handler if not already created
      if (!this.boundEditModeScrollHandler) {
        this.boundEditModeScrollHandler = () => {
          // Apply negative transform to match textarea scroll
          gutter.style.transform = `translateY(-${textarea.scrollTop}px)`;
        };
      }

      // Reset gutter position and attach listener
      gutter.style.transform = "translateY(0)";
      textarea.addEventListener("scroll", this.boundEditModeScrollHandler, {
        passive: true,
      });

      logDebug("Gutter scroll sync enabled for edit mode");
    } else {
      // Remove listener and reset position
      if (this.boundEditModeScrollHandler) {
        textarea.removeEventListener("scroll", this.boundEditModeScrollHandler);
      }
      gutter.style.transform = "";

      logDebug("Gutter scroll sync disabled");
    }
  };

  // =========================================================================
  // FULLSCREEN MODE (Phase 5.4)
  // =========================================================================

  /**
   * Toggle fullscreen edit mode
   */
  proto.toggleFullscreen = function () {
    this.isFullscreen = !this.isFullscreen;

    const { mmdCodeContainer, mmdFullscreenBtn, mmdEditorTextarea } =
      this.elements;

    // Toggle fullscreen class on container
    if (mmdCodeContainer) {
      mmdCodeContainer.classList.toggle("fullscreen", this.isFullscreen);
    }

    // Toggle body and html classes to prevent scrolling
    document.body.classList.toggle(
      "resume-fullscreen-active",
      this.isFullscreen,
    );
    document.documentElement.classList.toggle(
      "resume-fullscreen-active",
      this.isFullscreen,
    );

    // Update button label and icon
    if (mmdFullscreenBtn) {
      const label = this.isFullscreen
        ? "Exit fullscreen"
        : "Toggle fullscreen edit mode";
      mmdFullscreenBtn.setAttribute("aria-label", label);
      mmdFullscreenBtn.innerHTML = this.isFullscreen
        ? getIcon("fullscreenExit")
        : getIcon("fullscreenEnter");
    }

    // Focus textarea when entering fullscreen
    if (this.isFullscreen && mmdEditorTextarea) {
      mmdEditorTextarea.focus();
    }

    // Announce to screen readers
    this.announceToScreenReader(
      this.isFullscreen
        ? "Fullscreen edit mode enabled. Press Escape to exit."
        : "Fullscreen edit mode disabled",
    );

    logDebug("Fullscreen mode:", this.isFullscreen);
  };

  /**
   * Exit fullscreen mode
   * Called when stopping edit mode or pressing Escape
   */
  proto.exitFullscreen = function () {
    if (this.isFullscreen) {
      this.isFullscreen = false;

      const { mmdCodeContainer, mmdFullscreenBtn } = this.elements;

      if (mmdCodeContainer) {
        mmdCodeContainer.classList.remove("fullscreen");
      }

      // Remove body and html classes
      document.body.classList.remove("resume-fullscreen-active");
      document.documentElement.classList.remove("resume-fullscreen-active");

      if (mmdFullscreenBtn) {
        mmdFullscreenBtn.setAttribute(
          "aria-label",
          "Toggle fullscreen edit mode",
        );
        mmdFullscreenBtn.innerHTML = getIcon("fullscreenEnter");
      }

      logDebug("Fullscreen mode exited");
    }
  };

  // =========================================================================
  // FOCUS MODE (Phase 8.3.3)
  // =========================================================================

  /**
   * Enter Focus Mode - page-level fullscreen for immersive editing
   * Hides non-essential UI elements and maximises editing space
   * @returns {void}
   */
  proto.enterFocusMode = function () {
    if (this.isFocusMode) return;

    // Store scroll position for restoration
    this.savedScrollPosition = window.scrollY;

    // Activate focus mode
    document.body.classList.add("resume-focus-mode");
    this.isFocusMode = true;

    // Update button state
    if (this.elements.focusModeBtn) {
      this.elements.focusModeBtn.setAttribute("aria-pressed", "true");
      this.elements.focusModeBtn.innerHTML = `${getIcon(
        "fullscreenExit",
      )} Exit Focus`;
    }

    // Announce to screen readers
    this.announceToScreenReader(
      "Entered Focus Mode. Press Escape or Ctrl+Shift+F to exit.",
    );

    logInfo("Focus Mode entered");
  };

  /**
   * Exit Focus Mode - restore normal page layout
   * @returns {void}
   */
  proto.exitFocusMode = function () {
    if (!this.isFocusMode) return;

    // Deactivate focus mode
    document.body.classList.remove("resume-focus-mode");
    this.isFocusMode = false;

    // Restore scroll position
    if (this.savedScrollPosition !== undefined) {
      window.scrollTo(0, this.savedScrollPosition);
      this.savedScrollPosition = undefined;
    }

    // Update button state
    if (this.elements.focusModeBtn) {
      this.elements.focusModeBtn.setAttribute("aria-pressed", "false");
      this.elements.focusModeBtn.innerHTML = `${getIcon(
        "fullscreenEnter",
      )} Focus Mode`;
    }

    // Announce to screen readers
    this.announceToScreenReader("Exited Focus Mode");

    logInfo("Focus Mode exited");
  };

  /**
   * Toggle Focus Mode on/off
   * @returns {void}
   */
  proto.toggleFocusMode = function () {
    if (this.isFocusMode) {
      this.exitFocusMode();
    } else {
      this.enterFocusMode();
    }
  };

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   * @private
   */
  proto.announceToScreenReader = function (message) {
    const announcer = document.getElementById("radioSRannounce");
    if (announcer) {
      announcer.textContent = message;
      setTimeout(() => {
        announcer.textContent = "";
      }, 3000);
    }
  };

  /**
   * Handle MMD textarea input
   * Integrates with MMDEditorPersistence for auto-save and undo/redo
   * @private
   */
  proto.handleMmdInput = function () {
    this.hasUnsavedChanges = true;

    // Update session status to modified immediately
    this.updateSessionStatus("modified");

    // Phase 8.3.4: Mark confidence data as stale when content changes
    this.markConfidenceAsStale();

    // Auto-resize textarea to fit new content
    this.autoResizeTextarea();

    // Get current content from textarea (may be display content with placeholders)
    const rawContent = this.elements.mmdEditorTextarea?.value || "";

    // Phase 8G: If display layer is active, expand placeholders to get working MMD
    let workingContent = rawContent;
    if (
      this.isDisplayCollapsed &&
      this.displayLayer &&
      this.displayLayer.hasActiveMappings()
    ) {
      workingContent = this.displayLayer.expand(rawContent);
    }

    // Always use session restorer's own auto-save in Resume Mode
    // Save the WORKING content (full URLs), not the display content
    this.scheduleAutoSave(workingContent);

    // Debounced preview update
    clearTimeout(this.previewDebounce);
    this.previewDebounce = setTimeout(() => {
      // Preview uses working content (renders real images)
      this.updatePreview(workingContent);

      // Code element shows display content (what user sees in textarea)
      if (this.elements.mmdCodeElement) {
        this.elements.mmdCodeElement.textContent = rawContent;
        if (typeof Prism !== "undefined") {
          Prism.highlightElement(this.elements.mmdCodeElement);
        }
      }

      // Update stored content — always store WORKING MMD
      if (this.restoredSession) {
        this.restoredSession.currentMMD = workingContent;
        if (this.isDisplayCollapsed) {
          this.restoredSession.workingMMD = workingContent;
        }
      }
    }, 300);
  };

  console.log("[SessionRestorer] Editor mixin loaded");
})();
