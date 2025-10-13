/**
 * Live Markdown Syntax Highlighting
 * Provides real-time markdown syntax highlighting using Prism.js
 * WCAG 2.2 AA compliant with full accessibility features
 *
 * Pattern adapted from proven LaTeX editor implementation
 *
 * Architecture: Three-element system
 * 1. ContentEditable DIV (visible, user types here, Prism highlights)
 * 2. Hidden Input (reliable synchronisation layer)
 * 3. Original Textarea (hidden, receives input events, existing code unchanged)
 */

(function () {
  "use strict";

  // Logging configuration (inside IIFE scope to avoid global conflicts)
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
      console.error("[MarkdownLiveEditor]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[MarkdownLiveEditor]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[MarkdownLiveEditor]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[MarkdownLiveEditor] [DEBUG]", message, ...args);
  }

  /**
   * ContentEditable Markdown Editor with Live Syntax Highlighting
   */
  class ContentEditableMarkdownEditor {
    constructor() {
      // DOM Elements
      this.originalTextarea = null;
      this.contentEditableElement = null;
      this.hiddenInput = null;

      // State Management
      this.isInitialised = false;
      this.isEnabled = false;
      this.prismReady = false;
      this.lastKnownContent = "";
      this.pendingSyncOperation = false;
      this.autoDisabledByContentLimit = false; // Track if auto-disabled to auto-restore

      // Timeout Handles (for debouncing)
      this.syncTimeout = null;
      this.updateTimeout = null;
      this.blurSyncTimeout = null;

      // Performance Configuration
      this.syncDelay = 150; // ms - debounce delay

      // ⚙️ CONFIGURABLE: Adjust this value to tune performance limits
      // Default: 50,000 chars (tested safe limit)
      // Increase if you have powerful hardware: 75,000 or 100,000
      // Decrease if performance issues: 25,000 or 30,000
      this.maxContentLength = 50000; // chars - auto-disable threshold

      // Accessibility Configuration
      this.announceChanges = true;
      this.announcementDelay = 2000; // ms - throttle SR announcements
      this.lastAnnouncementTime = 0;

      // Preference key for localStorage
      this.storageKey = "markdown-live-highlighting-enabled";
    }

    /**
     * Initialise the live editor
     * @param {string} textareaId - ID of the textarea to enhance
     * @param {Object} options - Configuration options
     * @returns {Promise<boolean>} Success status
     */
    async initialise(textareaId, options = {}) {
      try {
        logInfo("Initialising live markdown editor...");

        // Apply configuration options
        if (options.syncDelay !== undefined) {
          this.syncDelay = options.syncDelay;
        }
        if (options.maxContentLength !== undefined) {
          this.maxContentLength = options.maxContentLength;
        }
        if (options.announceChanges !== undefined) {
          this.announceChanges = options.announceChanges;
        }

        // Find original textarea
        this.originalTextarea = document.getElementById(textareaId);
        if (!this.originalTextarea) {
          logError(`Textarea with ID "${textareaId}" not found`);
          return false;
        }

        // Wait for Prism.js to be ready
        const prismLoaded = await this.waitForPrism();
        if (!prismLoaded) {
          logError("Prism.js failed to load - live highlighting unavailable");
          return false;
        }

        // Convert textarea to contenteditable system
        this.convertToContentEditable();

        // Setup event listeners
        this.setupEventListeners();

        // Setup accessibility features
        this.setupAccessibilityFeatures();

        // Check user preference from localStorage
        let shouldEnable =
          options.enableByDefault !== undefined
            ? options.enableByDefault
            : true;

        try {
          const savedPref = localStorage.getItem(this.storageKey);
          if (savedPref !== null) {
            shouldEnable = savedPref === "true";
            logDebug(
              `Loaded user preference: ${shouldEnable ? "enabled" : "disabled"}`
            );
          }
        } catch (e) {
          logWarn("Could not access localStorage for preference");
        }

        // Enable if preference says so
        if (shouldEnable) {
          this.enable();
        } else {
          // Still initialised, but not enabled
          this.isInitialised = true;

          // Check button state even when disabled
          // Important: Content may have been loaded from localStorage on page load
          this.updateToggleButtonState();
        }

        logInfo("Live markdown editor initialised successfully");
        return true;
      } catch (error) {
        logError("Initialisation failed:", error);
        return false;
      }
    }

    /**
     * Wait for Prism.js to be ready
     * @returns {Promise<boolean>} Whether Prism is ready
     */
    async waitForPrism() {
      const maxAttempts = 50;
      const delayMs = 100;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (
          window.Prism &&
          window.Prism.languages &&
          window.Prism.languages.markdown
        ) {
          this.prismReady = true;
          logDebug("Prism.js markdown language detected");
          return true;
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      logError("Prism.js markdown language not available after waiting");
      return false;
    }

    /**
     * Convert textarea to contenteditable system
     */
    convertToContentEditable() {
      // Create contenteditable div
      const div = document.createElement("div");
      div.id = this.originalTextarea.id + "-contenteditable";
      div.className = "language-markdown markdown-live-contenteditable";
      div.contentEditable = "true";
      div.spellcheck = false;

      // Copy ARIA attributes from textarea
      const ariaAttrs = ["aria-describedby", "aria-label"];
      ariaAttrs.forEach((attr) => {
        const value = this.originalTextarea.getAttribute(attr);
        if (value) {
          div.setAttribute(attr, value);
        }
      });

      // Set initial content
      div.textContent = this.originalTextarea.value;

      // Create hidden input for reliable sync
      const hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.id = this.originalTextarea.id + "-hidden-sync";
      hiddenInput.value = this.originalTextarea.value;

      // Insert elements into DOM
      this.originalTextarea.parentNode.insertBefore(div, this.originalTextarea);
      this.originalTextarea.parentNode.insertBefore(
        hiddenInput,
        this.originalTextarea
      );

      // Store references
      this.contentEditableElement = div;
      this.hiddenInput = hiddenInput;

      // Hide original textarea (but keep it in DOM for existing code)
      this.originalTextarea.style.display = "none";

      logDebug("ContentEditable system created");
    }

    /**
     * Setup event listeners for contenteditable and textarea
     */
    setupEventListeners() {
      // ContentEditable: Input event - trigger debounced update
      this.contentEditableElement.addEventListener("input", () => {
        this.debouncedUpdate();
      });

      // ContentEditable: Paste event - ensure plain text only
      this.contentEditableElement.addEventListener("paste", (event) => {
        event.preventDefault();
        const text = event.clipboardData.getData("text/plain");
        this.insertPlainText(text);
        this.debouncedUpdate();
      });

      // ContentEditable: Keydown - handle special keys
      this.contentEditableElement.addEventListener("keydown", (event) => {
        this.handleKeyDown(event);
      });

      // ContentEditable: Blur - sync immediately
      this.contentEditableElement.addEventListener("blur", () => {
        this.smartSyncHiddenInput("blur");
      });

      // ContentEditable: Focus tracking
      this.contentEditableElement.addEventListener("focus", () => {
        logDebug("ContentEditable focused");
      });

      // CRITICAL: Textarea input listener for button state updates
      // When highlighting is disabled, user types in textarea
      // We need to check button state as content length changes
      this.originalTextarea.addEventListener("input", () => {
        // Update button state based on textarea content length
        this.updateToggleButtonStateFromTextarea();
      });

      logDebug("Event listeners configured");
    }

    /**
     * Debounced update - prevents excessive highlighting
     */
    debouncedUpdate() {
      // Clear existing timeout
      if (this.updateTimeout) {
        clearTimeout(this.updateTimeout);
      }

      // Mark pending operation
      this.pendingSyncOperation = true;

      // Schedule update
      this.updateTimeout = setTimeout(() => {
        this.updateHighlighting();
        this.smartSyncHiddenInput("debounced");
        this.pendingSyncOperation = false;

        // Always update button state, even when disabled
        // This allows button to re-enable when user deletes content below limit
        this.updateToggleButtonState();
      }, this.syncDelay);
    }

    /**
     * Update syntax highlighting
     */
    updateHighlighting() {
      if (!this.isEnabled || !this.prismReady) {
        return;
      }

      try {
        const content = this.getPlainTextContent();
        const contentLength = content.length;

        // Update toggle button state based on content length
        this.updateToggleButtonState();

        // Check content length limit
        if (contentLength > this.maxContentLength) {
          logWarn(
            `Content exceeds ${this.maxContentLength} chars - auto-disabling`
          );

          // Notify user
          if (window.UniversalNotifications) {
            window.UniversalNotifications.warning(
              `Live highlighting auto-disabled: content exceeds ${this.maxContentLength.toLocaleString()} characters. Reduce content below this limit to re-enable.`,
              { duration: 8000, dismissible: true }
            );
          }

          // Set flag before disabling - indicates auto-disable for future auto-restore
          this.autoDisabledByContentLimit = true;
          this.disable();
          return;
        }

        // Save cursor position
        const cursorPos = this.saveCursorPosition();

        // Apply Prism highlighting
        Prism.highlightElement(this.contentEditableElement);

        // Restore cursor position
        this.restoreCursorPosition(cursorPos);

        // Announce to screen readers (throttled)
        this.announceHighlightingUpdate(contentLength);

        logDebug(`Highlighting updated (${contentLength} chars)`);
      } catch (error) {
        logError("Highlighting update failed:", error);
      }
    }

    /**
     * Save cursor position using text offset method
     * @returns {Object} Cursor position data
     */
    saveCursorPosition() {
      try {
        const selection = window.getSelection();
        if (!selection.rangeCount) {
          return { textOffset: 0, isCollapsed: true };
        }

        const range = selection.getRangeAt(0);
        const textOffset = this.getTextOffsetFromStart(
          range.startContainer,
          range.startOffset
        );

        return {
          textOffset,
          isCollapsed: range.collapsed,
          // Backup method data
          startContainer: range.startContainer,
          startOffset: range.startOffset,
          endContainer: range.endContainer,
          endOffset: range.endOffset,
        };
      } catch (error) {
        logWarn("Failed to save cursor position:", error);
        return { textOffset: 0, isCollapsed: true };
      }
    }

    /**
     * Get text offset from start of contenteditable
     * @param {Node} container - Container node
     * @param {number} offset - Offset within container
     * @returns {number} Text offset from start
     */
    getTextOffsetFromStart(container, offset) {
      const walker = document.createTreeWalker(
        this.contentEditableElement,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let textOffset = 0;
      let currentNode;

      while ((currentNode = walker.nextNode())) {
        if (currentNode === container) {
          return textOffset + offset;
        }
        textOffset += currentNode.textContent.length;
      }

      return textOffset;
    }

    /**
     * Restore cursor position
     * @param {Object} cursorPos - Saved cursor position
     */
    restoreCursorPosition(cursorPos) {
      if (!cursorPos) {
        this.placeCursorAtEnd();
        return;
      }

      try {
        // Try text offset method first (most reliable after Prism highlighting)
        const restored = this.restoreCursorByTextOffset(cursorPos.textOffset);
        if (restored) {
          return;
        }

        // Fallback: try node-based restoration
        if (cursorPos.startContainer && cursorPos.startContainer.parentNode) {
          const selection = window.getSelection();
          const range = document.createRange();
          range.setStart(cursorPos.startContainer, cursorPos.startOffset);
          if (!cursorPos.isCollapsed && cursorPos.endContainer) {
            range.setEnd(cursorPos.endContainer, cursorPos.endOffset);
          } else {
            range.collapse(true);
          }
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }

        // Final fallback
        this.placeCursorAtEnd();
      } catch (error) {
        logWarn("Cursor restoration failed:", error);
        this.placeCursorAtEnd();
      }
    }

    /**
     * Restore cursor by text offset
     * @param {number} targetOffset - Target text offset
     * @returns {boolean} Success status
     */
    restoreCursorByTextOffset(targetOffset) {
      try {
        const walker = document.createTreeWalker(
          this.contentEditableElement,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        let textOffset = 0;
        let currentNode;

        while ((currentNode = walker.nextNode())) {
          const nodeLength = currentNode.textContent.length;

          if (textOffset + nodeLength >= targetOffset) {
            const offsetInNode = targetOffset - textOffset;
            const selection = window.getSelection();
            const range = document.createRange();
            range.setStart(currentNode, Math.min(offsetInNode, nodeLength));
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            return true;
          }

          textOffset += nodeLength;
        }

        return false;
      } catch (error) {
        logWarn("Text offset restoration failed:", error);
        return false;
      }
    }

    /**
     * Place cursor at end of content
     */
    placeCursorAtEnd() {
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(this.contentEditableElement);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (error) {
        logWarn("Failed to place cursor at end:", error);
      }
    }

    /**
     * Smart sync to hidden input - prevents duplicate sync on blur
     * @param {string} source - Source of sync ('blur' or 'debounced')
     */
    smartSyncHiddenInput(source) {
      // If there's a pending debounced operation and this is a blur,
      // don't sync immediately - let the debounced operation complete
      if (this.pendingSyncOperation && source === "blur") {
        logDebug("Skipping blur sync - debounced operation pending");
        return;
      }

      // For blur events, add a small delay to ensure debounced operation completes
      if (source === "blur") {
        if (this.blurSyncTimeout) {
          clearTimeout(this.blurSyncTimeout);
        }
        this.blurSyncTimeout = setTimeout(() => {
          this.syncHiddenInput("blur-delayed");
        }, 50);
      } else {
        this.syncHiddenInput(source);
      }
    }

    /**
     * Sync content to hidden input and original textarea
     * @param {string} source - Source of sync call
     */
    syncHiddenInput(source = "unknown") {
      try {
        const currentContent = this.getPlainTextContent();

        // Update hidden input
        this.hiddenInput.value = currentContent;

        // Normalise content for comparison
        const normalisedCurrent = this.normaliseContent(currentContent);
        const normalisedPrevious = this.normaliseContent(this.lastKnownContent);

        // Update textarea
        this.originalTextarea.value = currentContent;

        // Only dispatch input event if content actually changed
        if (normalisedCurrent !== normalisedPrevious) {
          const event = new Event("input", { bubbles: true, cancelable: true });
          this.originalTextarea.dispatchEvent(event);
          this.lastKnownContent = currentContent;
          logDebug(
            `Content synced (${source}): ${currentContent.length} chars`
          );
        }
      } catch (error) {
        logError("Sync failed:", error);
      }
    }

    /**
     * Normalise content for comparison
     * @param {string} content - Content to normalise
     * @returns {string} Normalised content
     */
    normaliseContent(content) {
      return content
        .replace(/\r\n/g, "\n") // Windows line endings
        .replace(/\r/g, "\n") // Old Mac line endings
        .trim();
    }

    /**
     * Get plain text content from contenteditable
     * @returns {string} Plain text content
     */
    getPlainTextContent() {
      return this.contentEditableElement
        ? this.contentEditableElement.textContent || ""
        : "";
    }

    /**
     * Set content programmatically
     * @param {string} content - Content to set
     */
    setContent(content) {
      this.contentEditableElement.textContent = content;
      this.hiddenInput.value = content;
      this.originalTextarea.value = content;
      this.lastKnownContent = content;

      if (this.isEnabled) {
        this.updateHighlighting();
      }

      // Update toggle button state based on new content length
      this.updateToggleButtonState();

      logDebug("Content set programmatically");
    }

    /**
     * Get current content
     * @returns {string} Current content
     */
    getContent() {
      return this.getPlainTextContent();
    }

    /**
     * Update toggle button state based on content length
     * Disables button when content exceeds maxContentLength
     */
    updateToggleButtonState() {
      const toggleBtn = document.getElementById("toggle-highlighting-btn");
      if (!toggleBtn) {
        return; // Button not found, nothing to update
      }

      const contentLength = this.getPlainTextContent().length;
      const exceedsLimit = contentLength > this.maxContentLength;

      if (exceedsLimit) {
        // Disable button and update attributes
        toggleBtn.disabled = true;
        toggleBtn.setAttribute("aria-disabled", "true");
        toggleBtn.title = `Live highlighting disabled: content exceeds ${this.maxContentLength.toLocaleString()} characters (current: ${contentLength.toLocaleString()})`;

        logDebug(
          `Toggle button disabled: ${contentLength} > ${this.maxContentLength}`
        );
      } else {
        // Enable button and update attributes
        toggleBtn.disabled = false;
        toggleBtn.setAttribute("aria-disabled", "false");
        toggleBtn.title = "Enable or disable live markdown syntax highlighting";

        logDebug(
          `Toggle button enabled: ${contentLength} <= ${this.maxContentLength}`
        );
      }
    }

    /**
     * Update toggle button state based on content length
     * Disables button when content exceeds maxContentLength
     */
    updateToggleButtonState() {
      const toggleBtn = document.getElementById("toggle-highlighting-btn");
      if (!toggleBtn) {
        return; // Button not found, nothing to update
      }

      const contentLength = this.getPlainTextContent().length;
      const exceedsLimit = contentLength > this.maxContentLength;

      if (exceedsLimit) {
        // Disable button and update attributes
        toggleBtn.disabled = true;
        toggleBtn.setAttribute("aria-disabled", "true");
        toggleBtn.title = `Live highlighting disabled: content exceeds ${this.maxContentLength.toLocaleString()} characters (current: ${contentLength.toLocaleString()})`;

        logDebug(
          `Toggle button disabled: ${contentLength} > ${this.maxContentLength}`
        );
      } else {
        // Enable button and update attributes
        toggleBtn.disabled = false;
        toggleBtn.setAttribute("aria-disabled", "false");
        toggleBtn.title = "Enable or disable live markdown syntax highlighting";

        logDebug(
          `Toggle button enabled: ${contentLength} <= ${this.maxContentLength}`
        );
      }
    }

    /**
     * Update toggle button state based on textarea content length
     * Called when user types in textarea (highlighting disabled)
     * Automatically re-enables highlighting if it was auto-disabled by content limit
     */
    updateToggleButtonStateFromTextarea() {
      const toggleBtn = document.getElementById("toggle-highlighting-btn");
      if (!toggleBtn) {
        return;
      }

      // Get content length from textarea (not contentEditable)
      const contentLength = this.originalTextarea.value.length;
      const exceedsLimit = contentLength > this.maxContentLength;
      const wasButtonDisabled = toggleBtn.disabled;

      if (exceedsLimit) {
        // Disable button
        toggleBtn.disabled = true;
        toggleBtn.setAttribute("aria-disabled", "true");
        toggleBtn.title = `Live highlighting disabled: content exceeds ${this.maxContentLength.toLocaleString()} characters (current: ${contentLength.toLocaleString()})`;

        logDebug(
          `[Textarea] Toggle button disabled: ${contentLength} > ${this.maxContentLength}`
        );
      } else {
        // Enable button
        toggleBtn.disabled = false;
        toggleBtn.setAttribute("aria-disabled", "false");
        toggleBtn.title = "Enable or disable live markdown syntax highlighting";

        logDebug(
          `[Textarea] Toggle button enabled: ${contentLength} <= ${this.maxContentLength}`
        );

        // AUTO-RESTORE FEATURE:
        // If button was previously disabled AND highlighting was auto-disabled by content limit,
        // automatically re-enable highlighting now that content is back below limit
        if (
          wasButtonDisabled &&
          this.autoDisabledByContentLimit &&
          !this.isEnabled
        ) {
          logInfo(
            `Auto-restoring live highlighting: content reduced to ${contentLength} chars`
          );

          // Clear the auto-disabled flag
          this.autoDisabledByContentLimit = false;

          // Auto-enable highlighting
          this.enable();

          // Notify user
          if (window.UniversalNotifications) {
            window.UniversalNotifications.success(
              `Live highlighting automatically restored: content is now ${contentLength.toLocaleString()} characters.`,
              { duration: 4000, dismissible: true }
            );
          }
        }
      }
    }

    /**
     * Verify content synchronisation across all three elements
     * @returns {boolean} Whether content is in sync
     */
    verifySynchronization() {
      if (!this.isInitialised) {
        logDebug("Editor not initialised - sync verification skipped");
        return true;
      }

      const contentEditableContent = this.getPlainTextContent();
      const textareaContent = this.originalTextarea.value;
      const hiddenInputContent = this.hiddenInput.value;

      const allMatch =
        this.normaliseContent(contentEditableContent) ===
          this.normaliseContent(textareaContent) &&
        this.normaliseContent(contentEditableContent) ===
          this.normaliseContent(hiddenInputContent);

      if (!allMatch) {
        logWarn("Content synchronisation mismatch detected", {
          contentEditableLength: contentEditableContent.length,
          textareaLength: textareaContent.length,
          hiddenInputLength: hiddenInputContent.length,
        });
      } else {
        logDebug("Content synchronisation verified - all elements in sync");
      }

      return allMatch;
    }

    /**
     * Force synchronisation recovery
     * Uses contenteditable as source of truth
     */
    forceSynchronization() {
      if (!this.isInitialised) {
        logWarn("Cannot force synchronisation - editor not initialised");
        return false;
      }

      logWarn("Forcing content synchronisation");

      try {
        // Use contenteditable as source of truth
        const content = this.getPlainTextContent();

        // Update all elements
        this.hiddenInput.value = content;
        this.originalTextarea.value = content;
        this.lastKnownContent = content;

        // Trigger input event on textarea for existing code
        const event = new Event("input", { bubbles: true, cancelable: true });
        this.originalTextarea.dispatchEvent(event);

        logInfo("Content synchronisation forced successfully", {
          contentLength: content.length,
        });

        return true;
      } catch (error) {
        logError("Failed to force synchronisation:", error);
        return false;
      }
    }

    /**
     * Get complete state snapshot
     * @returns {Object} State snapshot
     */
    getStateSnapshot() {
      const snapshot = {
        isInitialised: this.isInitialised,
        isEnabled: this.isEnabled,
        prismReady: this.prismReady,
        content: this.getPlainTextContent(),
        contentLength: this.getPlainTextContent().length,
        cursorPosition: null,
        timestamp: Date.now(),
      };

      // Try to capture cursor position if editor is enabled
      if (this.isEnabled && this.contentEditableElement) {
        try {
          snapshot.cursorPosition = this.saveCursorPosition();
        } catch (error) {
          logWarn("Could not capture cursor position in snapshot:", error);
        }
      }

      logDebug("State snapshot created", {
        contentLength: snapshot.contentLength,
        isEnabled: snapshot.isEnabled,
        hasCursorPosition: !!snapshot.cursorPosition,
      });

      return snapshot;
    }

    /**
     * Restore from state snapshot
     * @param {Object} snapshot - State snapshot
     * @returns {boolean} Success
     */
    restoreStateSnapshot(snapshot) {
      if (!snapshot || !this.isInitialised) {
        logWarn(
          "Cannot restore snapshot - invalid snapshot or not initialised"
        );
        return false;
      }

      try {
        logInfo("Restoring state snapshot", {
          snapshotAge: Date.now() - snapshot.timestamp,
          contentLength: snapshot.contentLength,
        });

        // Restore content
        if (snapshot.content !== undefined) {
          this.setContent(snapshot.content);
        }

        // Restore enabled state if different
        if (
          snapshot.isEnabled !== undefined &&
          snapshot.isEnabled !== this.isEnabled
        ) {
          if (snapshot.isEnabled) {
            this.enable();
          } else {
            this.disable();
          }
        }

        // Restore cursor position if possible and editor is enabled
        if (
          snapshot.cursorPosition &&
          this.isEnabled &&
          this.contentEditableElement
        ) {
          try {
            // Small delay to ensure content is rendered
            setTimeout(() => {
              this.restoreCursorPosition(snapshot.cursorPosition);
              logDebug("Cursor position restored from snapshot");
            }, 50);
          } catch (error) {
            logWarn("Could not restore cursor position:", error);
          }
        }

        logInfo("State snapshot restored successfully");
        return true;
      } catch (error) {
        logError("Failed to restore state snapshot:", error);
        return false;
      }
    }

    /**
     * Enable live highlighting
     */
    enable() {
      if (!this.isInitialised && !this.prismReady) {
        logWarn("Cannot enable - not properly initialised");
        return false;
      }

      logInfo("Enable called - syncing textarea content to contenteditable");

      // CRITICAL: Sync textarea content to contenteditable BEFORE checking length
      // User may have typed in textarea while highlighting was disabled
      const textareaContent = this.originalTextarea.value;

      logDebug(
        `Syncing ${textareaContent.length} chars from textarea to contentEditable`
      );

      this.contentEditableElement.textContent = textareaContent;
      this.hiddenInput.value = textareaContent;
      this.lastKnownContent = textareaContent;

      // Verify sync worked
      const syncedContent = this.getPlainTextContent();
      if (syncedContent.length !== textareaContent.length) {
        logWarn("Content length mismatch after sync", {
          textareaLength: textareaContent.length,
          contentEditableLength: syncedContent.length,
        });
      } else {
        logDebug("Content sync verified - lengths match");
      }

      // Now check if content exceeds limit
      const contentLength = syncedContent.length;
      if (contentLength > this.maxContentLength) {
        logWarn(
          `Cannot enable - content exceeds limit: ${contentLength} > ${this.maxContentLength}`
        );

        // Notify user with exact character count
        if (window.UniversalNotifications) {
          window.UniversalNotifications.warning(
            `Cannot enable live highlighting: content is ${contentLength.toLocaleString()} characters (limit: ${this.maxContentLength.toLocaleString()}). Please reduce content by ${(
              contentLength - this.maxContentLength
            ).toLocaleString()} characters.`,
            { duration: 8000, dismissible: true }
          );
        }

        // CRITICAL FIX: Ensure isEnabled is false to prevent state desync
        this.isEnabled = false;

        // Keep contenteditable hidden since we're not enabling
        this.contentEditableElement.style.display = "none";
        this.originalTextarea.style.display = "block";

        // Ensure button is disabled
        this.updateToggleButtonState();
        return false;
      }
      logInfo(
        `Enabling highlighting with ${contentLength} chars (within limit)`
      );

      // Content is within limit, proceed with enabling
      this.contentEditableElement.style.display = "block";
      this.originalTextarea.style.display = "none";
      this.isEnabled = true;
      this.isInitialised = true;

      // Save preference
      try {
        localStorage.setItem(this.storageKey, "true");
      } catch (e) {
        logWarn("Could not save enabled preference");
      }

      // Update button state
      this.updateToggleButtonState();

      // Focus contenteditable
      setTimeout(() => {
        this.contentEditableElement.focus();
        logDebug("ContentEditable focused after enabling");
      }, 50);

      // Trigger initial highlighting
      this.updateHighlighting();

      logInfo("Live highlighting enabled successfully");
      return true;
    }

    /**
     * Disable live highlighting
     */
    disable() {
      // Sync final content before disabling
      this.syncHiddenInput("disable");

      // Clear all pending timeouts
      if (this.syncTimeout) clearTimeout(this.syncTimeout);
      if (this.updateTimeout) clearTimeout(this.updateTimeout);
      if (this.blurSyncTimeout) clearTimeout(this.blurSyncTimeout);

      this.contentEditableElement.style.display = "none";
      this.originalTextarea.style.display = "block";
      this.isEnabled = false;

      // Clear auto-disabled flag - this is a manual disable
      // (unless it's already set by updateHighlighting, in which case keep it)
      // We only clear it if user manually clicked button
      if (!this.autoDisabledByContentLimit) {
        // This is a manual disable, not an auto-disable
        logDebug("Manual disable - will not auto-restore");
      }

      // Save preference
      try {
        localStorage.setItem(this.storageKey, "false");
      } catch (e) {
        logWarn("Could not save disabled preference");
      }

      // Update button state (button might be disabled due to content length)
      this.updateToggleButtonState();

      logInfo("Live highlighting disabled");
    }

    /**
     * Toggle live highlighting
     * @returns {boolean} New enabled state
     */
    toggle() {
      if (this.isEnabled) {
        this.disable();
        return false;
      } else {
        this.enable();
        return true;
      }
    }

    /**
     * Check if editor is ready
     * @returns {boolean} Ready status
     */
    isReady() {
      return this.isInitialised && this.prismReady;
    }

    /**
     * Get current status
     * @returns {Object} Status object
     */
    getStatus() {
      return {
        initialised: this.isInitialised,
        enabled: this.isEnabled,
        prismReady: this.prismReady,
        contentEditableReady: !!this.contentEditableElement,
        hiddenInputReady: !!this.hiddenInput,
        contentLength: this.getPlainTextContent().length,
        maxContentLength: this.maxContentLength,
      };
    }

    /**
     * Setup accessibility features
     */
    setupAccessibilityFeatures() {
      // Create ARIA live region for announcements
      let liveRegion = document.getElementById("markdown-live-announcements");
      if (!liveRegion) {
        liveRegion = document.createElement("div");
        liveRegion.id = "markdown-live-announcements";
        liveRegion.setAttribute("aria-live", "polite");
        liveRegion.setAttribute("aria-atomic", "true");
        liveRegion.className = "sr-only";
        document.body.appendChild(liveRegion);
      }

      // Create help text
      let helpText = document.getElementById("markdown-live-help");
      if (!helpText) {
        helpText = document.createElement("div");
        helpText.id = "markdown-live-help";
        helpText.className = "sr-only";
        helpText.textContent =
          "Live markdown syntax highlighting enabled. Type to see highlighting update in real-time.";
        document.body.appendChild(helpText);
      }

      // Link contenteditable to help text
      const existingDescribedBy =
        this.contentEditableElement.getAttribute("aria-describedby") || "";
      const describedByIds = existingDescribedBy.split(" ").filter((id) => id);
      if (!describedByIds.includes("markdown-live-help")) {
        describedByIds.push("markdown-live-help");
      }
      this.contentEditableElement.setAttribute(
        "aria-describedby",
        describedByIds.join(" ")
      );

      logDebug("Accessibility features configured");
    }

    /**
     * Announce highlighting updates to screen readers (throttled)
     * @param {number} contentLength - Current content length
     */
    announceHighlightingUpdate(contentLength) {
      if (!this.announceChanges) return;

      const now = Date.now();
      if (now - this.lastAnnouncementTime < this.announcementDelay) {
        return; // Throttle announcements
      }

      const liveRegion = document.getElementById("markdown-live-announcements");
      if (liveRegion) {
        const wordCount = this.getPlainTextContent()
          .split(/\s+/)
          .filter((w) => w).length;
        liveRegion.textContent = `${wordCount} words`;
        this.lastAnnouncementTime = now;
      }
    }

    /**
     * Handle special keydown events
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyDown(event) {
      // Tab key - insert tab character
      if (event.key === "Tab") {
        event.preventDefault();
        this.insertPlainText("\t");
        this.debouncedUpdate();
      }

      // Enter key - insert newline
      else if (event.key === "Enter") {
        event.preventDefault();
        this.insertPlainText("\n");
        this.debouncedUpdate();
      }
    }

    /**
     * Insert plain text at cursor position
     * @param {string} text - Text to insert
     */
    insertPlainText(text) {
      try {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        range.deleteContents();

        const textNode = document.createTextNode(text);
        range.insertNode(textNode);

        // Move cursor after inserted text
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (error) {
        logError("Failed to insert text:", error);
      }
    }
  }

  // Export for global access
  window.ContentEditableMarkdownEditor = ContentEditableMarkdownEditor;

  // Console testing helpers
  window.markdownHighlightingStatus = function () {
    if (window.markdownLiveEditor) {
      console.table(window.markdownLiveEditor.getStatus());
    } else {
      console.warn("Live editor not initialised yet");
    }
  };

  window.toggleMarkdownHighlighting = function () {
    if (window.markdownLiveEditor) {
      const newState = window.markdownLiveEditor.toggle();
      console.log(`Live highlighting: ${newState ? "ON" : "OFF"}`);
      return newState;
    } else {
      console.warn("Live editor not initialised yet");
      return false;
    }
  };

  window.testMarkdownHighlighting = function () {
    if (!window.markdownLiveEditor) {
      console.error("Live editor not initialised");
      return;
    }

    console.log("Testing markdown syntax highlighting...\n");

    const tests = [
      { name: "Headings", content: "# Heading 1\n## Heading 2\n### Heading 3" },
      { name: "Bold/Italic", content: "**bold text** and *italic text*" },
      { name: "Lists", content: "- Item 1\n- Item 2\n  - Nested item" },
      { name: "Code", content: "Inline `code` and\n```\ncode block\n```" },
      { name: "Links", content: "[Link text](https://example.com)" },
    ];

    let currentTest = 0;

    function runNextTest() {
      if (currentTest >= tests.length) {
        console.log("\n✅ All tests complete! Check visual highlighting.");
        return;
      }

      const test = tests[currentTest];
      console.log(`${currentTest + 1}. Testing ${test.name}...`);
      window.markdownLiveEditor.setContent(test.content);

      currentTest++;
      setTimeout(runNextTest, 2000);
    }

    runNextTest();
  };

  /**
   * Console helper: Verify content synchronisation
   */
  window.verifyMarkdownSync = function () {
    if (!window.markdownLiveEditor) {
      console.error("❌ Live editor not initialised");
      return false;
    }

    const inSync = window.markdownLiveEditor.verifySynchronization();

    if (inSync) {
      console.log("✅ Content in sync across all elements");
    } else {
      console.warn("⚠️ Content out of sync!");
      console.log(
        "To fix, run: window.markdownLiveEditor.forceSynchronization()"
      );
    }

    return inSync;
  };

  /**
   * Console helper: Save current state
   */
  window.saveMarkdownState = function () {
    if (!window.markdownLiveEditor) {
      console.error("❌ Live editor not initialised");
      return null;
    }

    const snapshot = window.markdownLiveEditor.getStateSnapshot();
    window.__markdownStateBackup = snapshot;

    console.log("✅ State saved successfully");
    console.table({
      "Content Length": snapshot.contentLength,
      "Is Enabled": snapshot.isEnabled,
      "Has Cursor Position": !!snapshot.cursorPosition,
      Timestamp: new Date(snapshot.timestamp).toLocaleTimeString(),
    });

    return snapshot;
  };

  /**
   * Console helper: Restore saved state
   */
  window.restoreMarkdownState = function () {
    if (!window.markdownLiveEditor) {
      console.error("❌ Live editor not initialised");
      return false;
    }

    if (!window.__markdownStateBackup) {
      console.error(
        "❌ No saved state found. Run window.saveMarkdownState() first."
      );
      return false;
    }

    const success = window.markdownLiveEditor.restoreStateSnapshot(
      window.__markdownStateBackup
    );

    if (success) {
      const age = Date.now() - window.__markdownStateBackup.timestamp;
      console.log(`✅ State restored (saved ${Math.round(age / 1000)}s ago)`);
    } else {
      console.error("❌ Failed to restore state");
    }

    return success;
  };

  logInfo("Live Markdown Editor module loaded");
})();
