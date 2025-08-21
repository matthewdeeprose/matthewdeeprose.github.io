// live-latex-editor.js
// Live Syntax Highlighting for LaTeX - Contenteditable Implementation
// Provides real-time Prism.js LaTeX highlighting with contenteditable approach
// REPLACES the previous overlay approach completely

const LiveLaTeXEditor = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (IIFE SCOPE)
  // ===========================================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[LIVE-LATEX]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[LIVE-LATEX]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[LIVE-LATEX]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[LIVE-LATEX]", message, ...args);
  }

  // ===========================================================================================
  // CONTENTEDITABLE LIVE LATEX EDITOR IMPLEMENTATION
  // ===========================================================================================

  class ContentEditableLaTeXEditor {
    constructor() {
      this.isInitialised = false;
      this.isEnabled = false;
      this.originalTextarea = null;
      this.contentEditableElement = null;
      this.hiddenInput = null;
      this.syncTimeout = null;
      this.observer = null;
      this.prismReady = false;
      this.lastKnownContent = "";

      // Performance settings
      this.syncDelay = 150; // ms - debounce for performance
      this.maxContentLength = 50000; // chars - safety limit

      // Accessibility settings
      this.announceChanges = true;
      this.announcementDelay = 2000; // ms
      this.lastAnnouncementTime = 0;

      // Default options
      this.options = {
        syncDelay: this.syncDelay,
        maxContentLength: this.maxContentLength,
        spellcheck: false,
        grammalecte: false,
      };
    }

    /**
     * Initialise the contenteditable LaTeX editor
     */
    async initialise(textareaId = "input", options = {}) {
      logInfo("Initialising contenteditable LaTeX editor...");

      try {
        // Merge options
        this.options = { ...this.options, ...options };

        // Find the original textarea
        this.originalTextarea = document.getElementById(textareaId);
        if (!this.originalTextarea) {
          logError(`Textarea with id '${textareaId}' not found`);
          return false;
        }

        // Wait for Prism.js to be available
        await this.waitForPrism();

        // Convert textarea to contenteditable
        this.convertToContentEditable();

        // Setup event listeners
        this.setupEventListeners();

        // Setup accessibility features
        this.setupAccessibilityFeatures();

        // Mark as initialised
        this.isInitialised = true;
        this.isEnabled = true;

        // Initial highlighting
        this.updateHighlighting();

        logInfo("✅ Contenteditable LaTeX editor initialised successfully");
        return true;
      } catch (error) {
        logError("Failed to initialise contenteditable editor:", error);
        return false;
      }
    }

    /**
     * Wait for Prism.js to be available
     */
    async waitForPrism() {
      logDebug("Waiting for Prism.js...");

      const maxAttempts = 50;
      let attempts = 0;

      while (attempts < maxAttempts) {
        if (
          window.Prism &&
          window.Prism.languages &&
          window.Prism.languages.latex &&
          window.Prism.highlightElement
        ) {
          this.prismReady = true;
          logDebug("✅ Prism.js ready with LaTeX support");
          return true;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }

      logWarn("⚠️ Prism.js not available after waiting");
      return false;
    }

    /**
     * Convert textarea to contenteditable div
     */
    convertToContentEditable() {
      logDebug("Converting textarea to contenteditable...");

      const textarea = this.originalTextarea;
      const textareaStyles = window.getComputedStyle(textarea);

      // Create contenteditable div
      const contentDiv = document.createElement("div");
      contentDiv.id = textarea.id + "-contenteditable";
      contentDiv.className = "language-latex live-latex-contenteditable";
      contentDiv.contentEditable = "true";
      contentDiv.spellcheck = this.options.spellcheck;

      // Disable Grammalecte if configured
      if (!this.options.grammalecte) {
        contentDiv.setAttribute("data-grammalecte-disabled", "true");
      }

      // Copy styles from original textarea
      // EXCLUDED: width, height - let CSS handle container-based sizing
      const stylesToCopy = [];

      stylesToCopy.forEach((style) => {
        if (textareaStyles[style]) {
          contentDiv.style[style] = textareaStyles[style];
        }
      });

      // Ensure proper display and overflow
      contentDiv.style.display = "block";
      contentDiv.style.overflow = "auto";
      contentDiv.style.whiteSpace = "pre-wrap";
      contentDiv.style.wordWrap = "break-word";

      // Copy accessibility attributes
      const accessibilityAttrs = [
        "aria-label",
        "aria-describedby",
        "aria-labelledby",
        "role",
        "tabindex",
        "placeholder",
      ];

      accessibilityAttrs.forEach((attr) => {
        const value = textarea.getAttribute(attr);
        if (value) {
          contentDiv.setAttribute(attr, value);
        }
      });

      // Set initial content
      contentDiv.textContent = textarea.value || "";

      // Create hidden input for form submission
      this.hiddenInput = document.createElement("input");
      this.hiddenInput.type = "hidden";
      this.hiddenInput.name = textarea.name || textarea.id;
      this.hiddenInput.id = textarea.id + "-hidden";

      // Hide original textarea and insert new elements
      textarea.style.display = "none";
      textarea.parentNode.insertBefore(contentDiv, textarea);
      textarea.parentNode.insertBefore(this.hiddenInput, textarea);

      this.contentEditableElement = contentDiv;

      logDebug("✅ Textarea converted to contenteditable");
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
      logDebug("Setting up event listeners...");

      // Content change events
      this.contentEditableElement.addEventListener("input", () => {
        this.debouncedUpdate(); // This will now trigger conversion system
      });

      this.contentEditableElement.addEventListener("paste", (event) => {
        // Handle paste - strip formatting and apply highlighting
        event.preventDefault();
        const text = (event.clipboardData || window.clipboardData).getData(
          "text/plain"
        );
        this.insertPlainText(text);
        this.debouncedUpdate();
      });

      // Focus events
      this.contentEditableElement.addEventListener("focus", () => {
        logDebug("ContentEditable focused");
      });

      this.contentEditableElement.addEventListener("blur", () => {
        this.syncHiddenInput();
        logDebug("ContentEditable blurred, hidden input synced");
      });

      // Keyboard shortcuts
      this.contentEditableElement.addEventListener("keydown", (event) => {
        this.handleKeyDown(event);
      });

      // Form submission handler
      const form = this.contentEditableElement.closest("form");
      if (form) {
        form.addEventListener("submit", () => {
          this.syncHiddenInput();
        });
      }

      logDebug("✅ Event listeners setup complete");
    }

    /**
     * Handle keyboard shortcuts and special keys
     */
    handleKeyDown(event) {
      // Tab key - insert actual tab
      if (event.key === "Tab") {
        event.preventDefault();
        this.insertPlainText("\t");
        this.debouncedUpdate();
        return;
      }

      // Ctrl+A - select all (default behavior)
      if (event.ctrlKey && event.key === "a") {
        // Let default behavior handle this
        return;
      }

      // Enter key - insert line break
      if (event.key === "Enter") {
        event.preventDefault();
        this.insertPlainText("\n");
        this.debouncedUpdate();
        return;
      }
    }

    /**
     * Insert plain text at cursor position
     */
    insertPlainText(text) {
      const selection = window.getSelection();
      if (selection.rangeCount) {
        const range = selection.getRangeAt(0);
        range.deleteContents();

        const textNode = document.createTextNode(text);
        range.insertNode(textNode);

        // Move cursor after inserted text
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    /**
     * Setup accessibility features
     */
    setupAccessibilityFeatures() {
      logDebug("Setting up accessibility features...");

      // Add live region for announcements if not exists
      if (!document.getElementById("live-latex-announcements")) {
        const liveRegion = document.createElement("div");
        liveRegion.id = "live-latex-announcements";
        liveRegion.setAttribute("aria-live", "polite");
        liveRegion.setAttribute("aria-atomic", "true");
        liveRegion.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
          `;
        document.body.appendChild(liveRegion);
      }

      // Update aria-describedby for syntax highlighting info
      const helpId = "live-latex-help";
      if (!document.getElementById(helpId)) {
        const helpText = document.createElement("div");
        helpText.id = helpId;
        helpText.className = "sr-only";
        helpText.textContent =
          "Live LaTeX syntax highlighting is enabled. LaTeX commands and structures will be visually highlighted as you type.";
        document.body.appendChild(helpText);

        const currentDescribedBy =
          this.contentEditableElement.getAttribute("aria-describedby") || "";
        this.contentEditableElement.setAttribute(
          "aria-describedby",
          currentDescribedBy ? `${currentDescribedBy} ${helpId}` : helpId
        );
      }

      logDebug("✅ Accessibility features setup complete");
    }

    /**
     * Debounced update function to avoid excessive re-highlighting
     */
    debouncedUpdate() {
      if (this.updateTimeout) {
        clearTimeout(this.updateTimeout);
      }

      this.updateTimeout = setTimeout(() => {
        this.updateHighlighting();
        // Update content tracking before sync
        this.lastKnownContent = this.getPlainTextContent();
        this.syncHiddenInput();
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

        // Performance check for large content
        if (content.length > this.options.maxContentLength) {
          logWarn("Content too large for live highlighting, disabling");
          this.disable();
          return;
        }

        // Store cursor position
        const cursorPos = this.saveCursorPosition();

        // Apply Prism highlighting
        if (window.Prism && window.Prism.highlightElement) {
          window.Prism.highlightElement(this.contentEditableElement);
        }

        // Restore cursor position
        this.restoreCursorPosition(cursorPos);

        // Accessibility announcement (throttled)
        this.announceHighlightingUpdate();

        logDebug("Highlighting updated, content length:", content.length);
      } catch (error) {
        logError("Error during highlighting update:", error);
      }
    }

    /**
     * Get plain text content from contenteditable
     */
    getPlainTextContent() {
      return this.contentEditableElement.textContent || "";
    }

    /**
     * Sync hidden input with contenteditable content AND trigger conversion ONLY when content changes
     */
    syncHiddenInput() {
      const currentContent = this.getPlainTextContent();

      if (this.hiddenInput) {
        this.hiddenInput.value = currentContent;
      }

      // CRITICAL: Only trigger input events if content actually changed
      if (this.originalTextarea) {
        const previousValue = this.originalTextarea.value;
        this.originalTextarea.value = currentContent;

        // Only dispatch input event if content actually changed
        if (previousValue !== currentContent) {
          const inputEvent = new Event("input", {
            bubbles: true,
            cancelable: true,
          });
          this.originalTextarea.dispatchEvent(inputEvent);

          logDebug(
            "Content changed - triggered input event on original textarea for conversion system"
          );
        } else {
          logDebug(
            "Content unchanged - skipped input event to prevent false conversion triggers"
          );
        }
      }
    }

    /**
     * Save cursor position - IMPROVED: More robust position tracking
     */
    saveCursorPosition() {
      const selection = window.getSelection();
      if (
        selection.rangeCount > 0 &&
        this.contentEditableElement.contains(selection.anchorNode)
      ) {
        const range = selection.getRangeAt(0);

        // Calculate text offset from start of contenteditable element
        const textOffset = this.getTextOffsetFromStart(
          range.startContainer,
          range.startOffset
        );

        return {
          textOffset: textOffset,
          isCollapsed: range.collapsed,
          // Backup: store node references as fallback
          startContainer: range.startContainer,
          startOffset: range.startOffset,
          endContainer: range.endContainer,
          endOffset: range.endOffset,
        };
      }
      return null;
    }

    /**
     * Calculate text offset from start of contenteditable element
     */
    getTextOffsetFromStart(container, offset) {
      let textOffset = 0;
      const walker = document.createTreeWalker(
        this.contentEditableElement,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while ((node = walker.nextNode())) {
        if (node === container) {
          return textOffset + offset;
        }
        textOffset += node.textContent.length;
      }
      return textOffset;
    }

    /**
     * Restore cursor position - IMPROVED: Text offset based restoration
     */
    restoreCursorPosition(cursorPos) {
      if (!cursorPos) return;

      try {
        // Method 1: Try text offset restoration (more reliable after DOM changes)
        if (typeof cursorPos.textOffset === "number") {
          this.restoreCursorByTextOffset(cursorPos.textOffset);
          return;
        }

        // Method 2: Fallback to node-based restoration
        const selection = window.getSelection();
        const range = document.createRange();

        try {
          range.setStart(cursorPos.startContainer, cursorPos.startOffset);
          range.setEnd(cursorPos.endContainer, cursorPos.endOffset);
          selection.removeAllRanges();
          selection.addRange(range);
        } catch (e) {
          // Method 3: Final fallback - place cursor at end
          this.placeCursorAtEnd();
        }
      } catch (error) {
        logDebug("Could not restore cursor position:", error);
        this.placeCursorAtEnd();
      }
    }

    /**
     * Restore cursor by text offset
     */
    restoreCursorByTextOffset(targetOffset) {
      const walker = document.createTreeWalker(
        this.contentEditableElement,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let currentOffset = 0;
      let node;

      while ((node = walker.nextNode())) {
        const nodeLength = node.textContent.length;
        if (currentOffset + nodeLength >= targetOffset) {
          const offsetInNode = targetOffset - currentOffset;
          const range = document.createRange();
          range.setStart(node, Math.min(offsetInNode, nodeLength));
          range.collapse(true);

          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }
        currentOffset += nodeLength;
      }

      // If we couldn't find the exact position, place at end
      this.placeCursorAtEnd();
    }

    /**
     * Place cursor at end of content
     */
    placeCursorAtEnd() {
      const range = document.createRange();
      range.selectNodeContents(this.contentEditableElement);
      range.collapse(false);

      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    /**
     * Announce highlighting updates to screen readers (throttled)
     */
    announceHighlightingUpdate() {
      if (!this.announceChanges) return;

      const now = Date.now();
      if (now - this.lastAnnouncementTime < this.announcementDelay) {
        return;
      }

      const liveRegion = document.getElementById("live-latex-announcements");
      if (liveRegion) {
        const content = this.getPlainTextContent();
        const wordCount = content
          .trim()
          .split(/\s+/)
          .filter((word) => word.length > 0).length;

        liveRegion.textContent = `LaTeX content updated. ${wordCount} words with syntax highlighting.`;
        this.lastAnnouncementTime = now;
      }
    }

    /**
     * Enable the live highlighting
     */
    enable() {
      if (!this.isInitialised) {
        logWarn("Cannot enable: editor not initialised");
        return false;
      }

      this.isEnabled = true;
      if (this.contentEditableElement) {
        this.contentEditableElement.style.display = "";
        this.updateHighlighting();
      }

      logInfo("Live LaTeX highlighting enabled");
      return true;
    }

    /**
     * Disable the live highlighting
     */
    disable() {
      this.isEnabled = false;
      // Note: We don't hide the contenteditable since it's the main input now

      logInfo("Live LaTeX highlighting disabled");
    }

    /**
     * Toggle highlighting on/off
     */
    toggle() {
      if (this.isEnabled) {
        this.disable();
      } else {
        this.enable();
      }
      return this.isEnabled;
    }

    /**
     * Check if the editor is ready and functional
     */
    isReady() {
      return (
        this.isInitialised &&
        this.prismReady &&
        this.contentEditableElement !== null
      );
    }

    /**
     * Get current status information
     */
    getStatus() {
      return {
        initialised: this.isInitialised,
        enabled: this.isEnabled,
        prismReady: this.prismReady,
        contentEditableReady: this.contentEditableElement !== null,
        hiddenInputReady: this.hiddenInput !== null,
        contentLength: this.contentEditableElement
          ? this.getPlainTextContent().length
          : 0,
        implementation: "contenteditable",
      };
    }

    /**
     * Set content programmatically
     */
    setContent(content) {
      if (this.contentEditableElement) {
        this.contentEditableElement.textContent = content;
        this.updateHighlighting();
        this.syncHiddenInput();
        logDebug("Content set programmatically:", content.length, "characters");
      }
    }

    /**
     * Get content for external access
     */
    getContent() {
      return this.getPlainTextContent();
    }
  }

  // ===========================================================================================
  // GLOBAL INSTANCE AND CONSOLE COMMANDS
  // ===========================================================================================

  let liveLaTeXEditor = null;

  /**
   * Console command to initialise live highlighting
   */
  async function initLiveHighlighting(textareaId = "input", options = {}) {
    try {
      liveLaTeXEditor = new ContentEditableLaTeXEditor();
      const success = await liveLaTeXEditor.initialise(textareaId, options);

      if (success) {
        // Make globally available
        window.liveLaTeXEditor = liveLaTeXEditor;
        logInfo("✅ Live LaTeX highlighting initialised (contenteditable)");
        return true;
      } else {
        logError("❌ Live LaTeX highlighting initialisation failed");
        return false;
      }
    } catch (error) {
      logError("Error initialising live highlighting:", error);
      return false;
    }
  }

  /**
   * Console command to toggle live highlighting
   */
  function toggleLiveHighlighting() {
    if (window.liveLaTeXEditor && window.liveLaTeXEditor.isReady()) {
      const newState = window.liveLaTeXEditor.toggle();
      logInfo("Live LaTeX highlighting", newState ? "enabled" : "disabled");
      return newState;
    } else {
      logWarn("Live LaTeX editor not ready. Use initLiveHighlighting() first.");
      return false;
    }
  }

  /**
   * Console command to get live highlighting status
   */
  function liveHighlightingStatus() {
    if (window.liveLaTeXEditor) {
      const status = window.liveLaTeXEditor.getStatus();
      console.table(status);
      return status;
    } else {
      logInfo("Live LaTeX editor not created yet");
      return null;
    }
  }

  /**
   * Testing function
   */
  function testContentEditableLaTeXEditor() {
    logInfo("🧪 Testing ContentEditable LaTeX Editor...");

    const tests = {
      moduleExists: () => !!window.LiveLaTeXEditor,
      classAvailable: () => !!ContentEditableLaTeXEditor,
      canCreateInstance: () => {
        try {
          const instance = new ContentEditableLaTeXEditor();
          return instance instanceof ContentEditableLaTeXEditor;
        } catch (error) {
          return false;
        }
      },
      prismAvailable: () =>
        !!(
          window.Prism &&
          window.Prism.languages &&
          window.Prism.languages.latex
        ),
      consoleCommandsAvailable: () => {
        return !!(
          window.initLiveHighlighting &&
          window.toggleLiveHighlighting &&
          window.liveHighlightingStatus
        );
      },
    };

    let passed = 0;
    let total = 0;

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const result = testFn();
        if (result) {
          passed++;
          logDebug(`  ✅ ${testName}: PASSED`);
        } else {
          logError(`  ❌ ${testName}: FAILED`);
        }
      } catch (error) {
        logError(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    });

    const success = passed === total;
    logInfo(`📊 ContentEditable LaTeX Editor: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
      implementation: "contenteditable",
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Core functionality
    ContentEditableLaTeXEditor: ContentEditableLaTeXEditor,

    // Testing
    testContentEditableLaTeXEditor: testContentEditableLaTeXEditor,

    // Console commands
    initLiveHighlighting: initLiveHighlighting,
    toggleLiveHighlighting: toggleLiveHighlighting,
    liveHighlightingStatus: liveHighlightingStatus,

    // Logging
    logError: logError,
    logWarn: logWarn,
    logInfo: logInfo,
    logDebug: logDebug,
  };
})();

// Make globally available
window.LiveLaTeXEditor = LiveLaTeXEditor;

// Add console commands to global scope for easy access
window.initLiveHighlighting = LiveLaTeXEditor.initLiveHighlighting;
window.toggleLiveHighlighting = LiveLaTeXEditor.toggleLiveHighlighting;
window.liveHighlightingStatus = LiveLaTeXEditor.liveHighlightingStatus;
