// ─── MathPixSessionRestorer Confidence Mixin ─────────────────────────────────
// Confidence highlighting, gutter, and line-based editor.
// Depends on: session-restorer-core.js
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (!window._SRShared) {
    console.error(
      "[SessionRestorer] session-restorer-core.js must load before session-restorer-confidence.js",
    );
    return;
  }

  const { logError, logWarn, logInfo, logDebug, getIcon, RESTORER_CONFIG } =
    window._SRShared;
  const proto = MathPixSessionRestorer.prototype;

  // ==========================================================================
  // PHASE 8.3.4: CONFIDENCE HIGHLIGHTING
  // ==========================================================================

  /**
   * Toggle confidence highlighting in the MMD code view
   * @param {boolean} enabled - Whether to enable highlighting
   */
  proto.toggleConfidenceHighlighting = function (enabled) {
    logDebug("Toggling confidence highlighting:", enabled);

    this.isConfidenceEnabled = enabled;

    // Update UI state
    if (this.elements.mmdCodeContainer) {
      this.elements.mmdCodeContainer.classList.toggle(
        "mmd-confidence-enabled",
        enabled,
      );
    }

    if (enabled) {
      // Build confidence map if not already done
      if (!this.confidenceMapper) {
        this.initConfidenceMapper();
      }

      // Phase 8.3.5: Use line-based editor instead of gutter
      // Pass current edit state to determine if content is editable
      const isEditing =
        this.elements.mmdCodeContainer?.dataset.editing === "true";
      this.renderLineBasedConfidenceEditor(isEditing);

      // Announce to screen reader
      this.announceToScreenReader("Confidence highlighting enabled");
    } else {
      // Phase 8.3.5: Destroy line-based editor and restore textarea
      this.destroyLineBasedEditor();

      // Clear old gutter (legacy cleanup)
      this.clearConfidenceGutter();

      // Announce to screen reader
      this.announceToScreenReader("Confidence highlighting disabled");
    }

    // Update toggle button state
    if (this.elements.confidenceCheckbox) {
      this.elements.confidenceCheckbox.checked = enabled;
    }
  };

  /**
   * Initialise the confidence mapper with current session data
   * @private
   */
  proto.initConfidenceMapper = function () {
    logDebug("Initialising confidence mapper");

    // Check if MathPixConfidenceMapper class is available
    if (typeof window.MathPixConfidenceMapper !== "function") {
      logWarn("MathPixConfidenceMapper not loaded");
      return;
    }

    // Create mapper instance
    this.confidenceMapper = new window.MathPixConfidenceMapper();

    // Build initial map
    const linesData = this.restoredSession?.linesData;
    const mmdContent = this.restoredSession?.currentMMD;

    if (linesData && mmdContent) {
      this.confidenceMapper.buildConfidenceMap(linesData, mmdContent);

      const stats = this.confidenceMapper.getStats();
      logInfo("Confidence map built:", stats);

      // Show review warning if many low-confidence lines
      const lowConfidenceCount = stats.low + stats.veryLow;
      if (lowConfidenceCount > 0) {
        this.showConfidenceWarning(lowConfidenceCount);
      }
    } else {
      logWarn("Cannot build confidence map - missing data");
    }
  };

  /**
   * Render confidence indicators in the gutter
   * @private
   */
  proto.renderConfidenceGutter = function () {
    const gutter = this.elements.confidenceGutter;
    if (!gutter || !this.confidenceMapper) {
      logDebug("Cannot render gutter - missing elements or mapper");
      return;
    }

    // Clear existing indicators
    gutter.innerHTML = "";

    // Get the code element to calculate line heights
    const codeElement = this.elements.mmdCodeElement;
    if (!codeElement) {
      logDebug("Cannot render gutter - no code element");
      return;
    }

    // Get the scrollable container to match gutter height to content
    const formatContent = this.elements.mmdCodeContainer?.querySelector(
      ".mathpix-format-content",
    );
    if (formatContent) {
      // Set gutter height to match full scrollable content
      gutter.style.height = `${formatContent.scrollHeight}px`;
      logDebug(`Set gutter height to ${formatContent.scrollHeight}px`);
    }

    // Calculate line height from computed styles
    const computedStyle = getComputedStyle(codeElement);
    const lineHeight = parseFloat(computedStyle.lineHeight);
    const fontSize = parseFloat(computedStyle.fontSize);

    // Use line height if valid, otherwise estimate from font size
    this.gutterLineHeight =
      !isNaN(lineHeight) && lineHeight > 0 ? lineHeight : fontSize * 1.5 || 20;

    // Get padding-top from the pre element to offset indicators
    const preElement = codeElement.closest("pre");
    const prePaddingTop = preElement
      ? parseFloat(getComputedStyle(preElement).paddingTop) || 0
      : 0;

    // Get confidence map
    const map = this.confidenceMapper.confidenceMap;
    if (map.size === 0) {
      logDebug("No confidence data to render");
      return;
    }

    // Create indicators for each mapped line
    const fragment = document.createDocumentFragment();

    map.forEach((data, lineNumber) => {
      const indicator = this.createConfidenceIndicator(lineNumber, data);
      fragment.appendChild(indicator);
    });

    gutter.appendChild(fragment);

    // Mark as stale if mapper indicates content changed
    if (this.confidenceMapper.isStale) {
      gutter.classList.add("mmd-confidence--stale");
    } else {
      gutter.classList.remove("mmd-confidence--stale");
    }

    logDebug(
      `Rendered ${map.size} confidence indicators (line height: ${this.gutterLineHeight}px)`,
    );
  };

  /**
   * Create a confidence indicator element for a line
   * @param {number} lineNumber - 1-indexed line number
   * @param {Object} data - Confidence data
   * @returns {HTMLElement} Indicator element
   * @private
   */
  proto.createConfidenceIndicator = function (lineNumber, data) {
    const indicator = document.createElement("button");
    indicator.type = "button";
    indicator.className = `mmd-confidence-indicator ${data.level.cssClass}`;

    // Position based on line number
    const topPosition = (lineNumber - 1) * this.gutterLineHeight + 4;
    indicator.style.top = `${topPosition}px`;

    // Accessibility attributes
    const percentText = this.confidenceMapper.formatConfidencePercent(
      data.confidence,
    );
    indicator.setAttribute(
      "aria-label",
      this.confidenceMapper.buildAccessibleLabel(lineNumber),
    );
    indicator.setAttribute("tabindex", "0");
    indicator.dataset.lineNumber = lineNumber;
    indicator.dataset.confidence = data.confidence;

    // Tooltip content
    const tooltip = document.createElement("span");
    tooltip.className = "mmd-confidence-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.innerHTML = `
      <strong>Line ${lineNumber}</strong>
      Confidence: ${percentText}<br>
      Level: ${data.level.name}
      ${data.type ? `<br>Type: ${data.type}` : ""}
      ${data.isHandwritten ? "<br><small>(Handwritten)</small>" : ""}
    `;
    indicator.appendChild(tooltip);

    // Click handler - scroll to line
    indicator.addEventListener("click", () => {
      this.scrollToLine(lineNumber);
    });

    return indicator;
  };

  /**
   * Clear the confidence gutter
   * @private
   */
  proto.clearConfidenceGutter = function () {
    if (this.elements.confidenceGutter) {
      this.elements.confidenceGutter.innerHTML = "";
      this.elements.confidenceGutter.classList.remove("mmd-confidence--stale");
    }
  };

  /**
   * Mark confidence data as stale after content edit
   * Called from handleMmdInput when content changes
   * @private
   */
  proto.markConfidenceAsStale = function () {
    if (this.confidenceMapper && !this.confidenceMapper.isStale) {
      this.confidenceMapper.markAsStale();

      // Update gutter visual state
      if (this.elements.confidenceGutter && this.isConfidenceEnabled) {
        this.elements.confidenceGutter.classList.add("mmd-confidence--stale");
      }

      logDebug("Confidence data marked as stale");
    }
  };

  // =========================================================================
  // LINE-BASED CONFIDENCE EDITOR (Phase 8.3.5)
  // =========================================================================

  /**
   * Render line-based confidence editor
   * Replaces gutter approach with integrated line-by-line display
   * Each line shows confidence percentage alongside content
   * @param {boolean} [editable=false] - Whether content should be editable
   * @private
   */
  proto.renderLineBasedConfidenceEditor = function (editable = false) {
    const textarea = this.elements.mmdEditorTextarea;
    const formatContent = this.elements.mmdCodeContainer?.querySelector(
      ".mathpix-format-content",
    );
    const codeBlockWrapper = this.elements.mmdCodeContainer?.querySelector(
      ".code-block-wrapper",
    );
    const editorWrapper = document.getElementById("resume-mmd-editor-wrapper");
    const map = this.confidenceMapper?.confidenceMap;

    if (!textarea || !formatContent || !map) {
      logWarn("Cannot render line-based editor - missing elements");
      return;
    }

    // Hide the original textarea
    textarea.style.display = "none";

    // Hide the code-block-wrapper (code view)
    if (codeBlockWrapper) {
      codeBlockWrapper.style.display = "none";
    }

    // Hide the editor wrapper (contains textarea)
    if (editorWrapper) {
      editorWrapper.style.display = "none";
    }

    // Hide the old gutter
    if (this.elements.confidenceGutter) {
      this.elements.confidenceGutter.style.display = "none";
    }

    // Remove any previous line editor
    const existingEditor = document.getElementById("resume-mmd-line-editor");
    if (existingEditor) existingEditor.remove();

    // Get line data
    const mmdLines = textarea.value.split("\n");
    const textareaStyle = getComputedStyle(textarea);
    const lineHeight = parseFloat(textareaStyle.lineHeight);

    // Helper for confidence styling
    const getConfidenceClass = (confData) => {
      if (!confData) return "mmd-confidence--none";
      return confData.level?.cssClass || "mmd-confidence--none";
    };

    const getConfidenceLabel = (confData) => {
      if (!confData) return "—";
      return Math.round(confData.confidence * 100).toString();
    };

    // Create the line-based editor container
    const editor = document.createElement("div");
    editor.id = "resume-mmd-line-editor";
    editor.setAttribute("role", "application");
    editor.setAttribute(
      "aria-label",
      `MMD editor with ${mmdLines.length} lines. ${
        editable ? "Edit mode active. " : ""
      }Use arrow keys to navigate between lines.`,
    );
    editor.setAttribute(
      "aria-describedby",
      "resume-mmd-line-editor-instructions",
    );

    // Add visually hidden instructions for screen readers
    const instructions = document.createElement("div");
    instructions.id = "resume-mmd-line-editor-instructions";
    instructions.className = "visually-hidden";
    instructions.textContent = editable
      ? "Use Up and Down arrow keys to navigate between lines. Tab to exit the editor."
      : "Use Up and Down arrow keys to navigate between lines. Press Enter or click Edit MMD button to enable editing.";
    editor.appendChild(instructions);
    editor.style.cssText = `
      width: 100%;
      height: 100%;
      overflow: auto;
      font-family: "Consolas", "Monaco", "Courier New", monospace;
      font-size: ${textareaStyle.fontSize};
      line-height: ${lineHeight}px;
      border: 1px solid currentcolor;
      border-radius: 4px;
    `;

    // Set line height as CSS custom property for dynamic sizing
    editor.style.setProperty("--mmd-line-height", `${lineHeight}px`);

    // Create each line
    mmdLines.forEach((content, index) => {
      const lineNum = index + 1;
      const confData = map.get(lineNum);
      const isEdited = this.isLineEdited(index, content);

      // Determine styling: edited lines override confidence
      let confClass, confLabel, ariaLabel, titleText;

      if (isEdited) {
        confClass = "mmd-confidence--edited";
        confLabel = null; // Will use pencil icon
        ariaLabel = `Line ${lineNum}, edited`;
        titleText = `Line ${lineNum}: Edited (original confidence no longer applies)`;
      } else {
        confClass = getConfidenceClass(confData);
        const confLevelName = confData?.level?.name || "No data";
        const confPercent = confData
          ? Math.round(confData.confidence * 100)
          : null;
        confLabel = getConfidenceLabel(confData);
        ariaLabel =
          confPercent !== null
            ? `Line ${lineNum}, ${confPercent}% confidence, ${confLevelName}`
            : `Line ${lineNum}, no confidence data`;
        titleText = confData
          ? `Line ${lineNum}: ${confPercent}% (${confLevelName})`
          : `Line ${lineNum}: No OCR data`;
      }

      const lineDiv = document.createElement("div");
      lineDiv.className = `mmd-editor-line ${confClass}`;
      lineDiv.dataset.line = lineNum;
      lineDiv.setAttribute("role", "group");
      lineDiv.setAttribute("aria-label", ariaLabel);

      // Confidence label (hidden from screen readers - info in parent aria-label)
      const confSpan = document.createElement("span");
      confSpan.className = "line-confidence";
      confSpan.setAttribute("aria-hidden", "true");
      confSpan.title = titleText;

      if (isEdited) {
        // Show pencil icon for edited lines
        confSpan.appendChild(this.createPencilIcon());
      } else {
        confSpan.textContent = confLabel;
      }

      // Content span (editable when in edit mode)
      const contentSpan = document.createElement("span");
      contentSpan.className = "line-content";
      contentSpan.setAttribute("contenteditable", editable.toString());
      contentSpan.setAttribute("role", editable ? "textbox" : "presentation");
      contentSpan.setAttribute("aria-label", `Line ${lineNum} content`);
      contentSpan.setAttribute("tabindex", editable ? "0" : "-1");
      contentSpan.dataset.lineIndex = index; // For keyboard navigation
      contentSpan.textContent = content;

      lineDiv.appendChild(confSpan);
      lineDiv.appendChild(contentSpan);
      editor.appendChild(lineDiv);
    });

    // Add to format content container (visible in both view and edit modes)
    formatContent.appendChild(editor);

    // Sync back to textarea on changes and update edit status
    editor.addEventListener("input", (event) => {
      this.syncLineEditorToTextarea();
      this.updateLineEditStatus(event.target);
    });

    // Keyboard navigation for line-based editor
    editor.addEventListener("keydown", (event) => {
      this.handleLineEditorKeydown(event);
    });

    // Store reference
    this.lineBasedEditor = editor;

    logDebug(`Created line-based editor with ${mmdLines.length} lines`);
  };

  /**
   * Sync line-based editor content back to textarea
   * Called on input events to keep textarea in sync for form submission
   * @private
   */
  proto.syncLineEditorToTextarea = function () {
    if (!this.lineBasedEditor || !this.elements.mmdEditorTextarea) return;

    const lines = this.lineBasedEditor.querySelectorAll(".line-content");
    const content = Array.from(lines)
      .map((el) => el.textContent)
      .join("\n");
    this.elements.mmdEditorTextarea.value = content;

    // Trigger input event for any listeners
    this.elements.mmdEditorTextarea.dispatchEvent(
      new Event("input", { bubbles: true }),
    );
  };

  /**
   * Destroy line-based editor and restore textarea
   * @private
   */
  proto.destroyLineBasedEditor = function () {
    if (this.lineBasedEditor) {
      // Sync final content
      this.syncLineEditorToTextarea();

      // Remove editor
      this.lineBasedEditor.remove();
      this.lineBasedEditor = null;
    }

    // Restore code-block-wrapper
    const codeBlockWrapper = this.elements.mmdCodeContainer?.querySelector(
      ".code-block-wrapper",
    );
    if (codeBlockWrapper) {
      codeBlockWrapper.style.display = "";
    }

    // Restore editor wrapper
    const editorWrapper = document.getElementById("resume-mmd-editor-wrapper");
    if (editorWrapper) {
      editorWrapper.style.display = "";
    }

    // Restore textarea
    if (this.elements.mmdEditorTextarea) {
      this.elements.mmdEditorTextarea.style.display = "";
    }

    // Restore gutter (will be hidden if confidence disabled)
    if (this.elements.confidenceGutter) {
      this.elements.confidenceGutter.style.display = "";
    }

    logDebug("Destroyed line-based editor");
  };

  /**
   * Handle keyboard navigation in line-based editor
   * Enables arrow key navigation between lines
   * @param {KeyboardEvent} event - The keyboard event
   * @private
   */
  proto.handleLineEditorKeydown = function (event) {
    if (!this.lineBasedEditor) return;

    const activeElement = document.activeElement;
    const isLineContent = activeElement?.classList.contains("line-content");

    if (!isLineContent) return;

    const currentIndex = parseInt(activeElement.dataset.lineIndex, 10);
    const allLineContents = Array.from(
      this.lineBasedEditor.querySelectorAll(".line-content"),
    );
    const totalLines = allLineContents.length;

    // Helper to check if cursor is at start/end of line
    const getCursorPosition = () => {
      const selection = window.getSelection();
      if (!selection.rangeCount) return { atStart: true, atEnd: true };

      const range = selection.getRangeAt(0);
      const textLength = activeElement.textContent?.length || 0;

      return {
        atStart: range.startOffset === 0 && range.collapsed,
        atEnd: range.endOffset >= textLength && range.collapsed,
      };
    };

    // Helper to move focus to a line
    const focusLine = (index, cursorPosition = "start") => {
      const targetLine = allLineContents[index];
      if (!targetLine) return;

      targetLine.focus();

      // Position cursor at start or end
      const textNode = targetLine.firstChild;
      if (textNode && window.getSelection) {
        const selection = window.getSelection();
        const range = document.createRange();

        if (cursorPosition === "end" && textNode.nodeType === Node.TEXT_NODE) {
          range.setStart(textNode, textNode.length);
          range.setEnd(textNode, textNode.length);
        } else {
          range.setStart(targetLine, 0);
          range.setEnd(targetLine, 0);
        }

        selection.removeAllRanges();
        selection.addRange(range);
      }
    };

    const { atStart, atEnd } = getCursorPosition();

    switch (event.key) {
      case "ArrowUp":
        // Move to previous line if at start of current line or with Ctrl
        if (event.ctrlKey || atStart) {
          if (currentIndex > 0) {
            event.preventDefault();
            focusLine(currentIndex - 1, "end");
          }
        }
        break;

      case "ArrowDown":
        // Move to next line if at end of current line or with Ctrl
        if (event.ctrlKey || atEnd) {
          if (currentIndex < totalLines - 1) {
            event.preventDefault();
            focusLine(currentIndex + 1, "start");
          }
        }
        break;

      case "Home":
        // Ctrl+Home: Go to first line
        if (event.ctrlKey) {
          event.preventDefault();
          focusLine(0, "start");
        }
        break;

      case "End":
        // Ctrl+End: Go to last line
        if (event.ctrlKey) {
          event.preventDefault();
          focusLine(totalLines - 1, "end");
        }
        break;

      case "Escape":
        // Blur the editor (handled by document-level listener)
        // But also remove focus from current line
        activeElement.blur();
        break;
    }
  };

  /**
   * Create pencil SVG icon for edited lines
   * @returns {SVGElement} Pencil icon
   * @private
   */
  proto.createPencilIcon = function () {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("viewBox", "0 0 21 21");
    svg.setAttribute("aria-hidden", "true");

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", "currentColor");
    g.setAttribute("stroke-linecap", "round");
    g.setAttribute("stroke-linejoin", "round");
    g.setAttribute("transform", "translate(3 3)");

    const path1 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    path1.setAttribute(
      "d",
      "m14 1c.8284271.82842712.8284271 2.17157288 0 3l-9.5 9.5-4 1 1-3.9436508 9.5038371-9.55252193c.7829896-.78700064 2.0312313-.82943964 2.864366-.12506788z",
    );

    const path2 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    path2.setAttribute("d", "m6.5 14.5h8");

    const path3 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    path3.setAttribute("d", "m12.5 3.5 1 1");

    g.appendChild(path1);
    g.appendChild(path2);
    g.appendChild(path3);
    svg.appendChild(g);

    return svg;
  };

  /**
   * Check if a line has been edited from the original OCR output
   * @param {number} lineIndex - Zero-based line index
   * @param {string} currentContent - Current line content
   * @returns {boolean} True if line differs from original
   * @private
   */
  proto.isLineEdited = function (lineIndex, currentContent) {
    if (!this.originalMmdLines) return false;
    const originalContent = this.originalMmdLines[lineIndex];
    if (originalContent === undefined) return true; // New line added
    return originalContent !== currentContent;
  };

  /**
   * Update a single line's edit status after user input
   * @param {HTMLElement} target - The edited element
   * @private
   */
  proto.updateLineEditStatus = function (target) {
    // Find the line content element
    const lineContent = target.closest(".line-content") || target;
    if (!lineContent.classList.contains("line-content")) return;

    const lineDiv = lineContent.closest(".mmd-editor-line");
    if (!lineDiv) return;

    const lineIndex = parseInt(lineContent.dataset.lineIndex, 10);
    const currentContent = lineContent.textContent;
    const isEdited = this.isLineEdited(lineIndex, currentContent);
    const lineNum = lineIndex + 1;

    const confSpan = lineDiv.querySelector(".line-confidence");
    if (!confSpan) return;

    // Update class
    const wasEdited = lineDiv.classList.contains("mmd-confidence--edited");

    if (isEdited && !wasEdited) {
      // Line became edited - remove old confidence class, add edited
      lineDiv.className = lineDiv.className
        .replace(/mmd-confidence--\w+/g, "")
        .trim();
      lineDiv.classList.add("mmd-editor-line", "mmd-confidence--edited");

      // Update confidence span
      confSpan.textContent = "";
      confSpan.appendChild(this.createPencilIcon());
      confSpan.title = `Line ${lineNum}: Edited (original confidence no longer applies)`;

      // Update ARIA
      lineDiv.setAttribute("aria-label", `Line ${lineNum}, edited`);

      logDebug(`Line ${lineNum} marked as edited`);
    } else if (!isEdited && wasEdited) {
      // Line restored to original - restore confidence display
      const map = this.confidenceMapper?.confidenceMap;
      const confData = map?.get(lineNum);

      const getConfidenceClass = (data) => {
        if (!data) return "mmd-confidence--none";
        return data.level?.cssClass || "mmd-confidence--none";
      };

      const getConfidenceLabel = (data) => {
        if (!data) return "—";
        return Math.round(data.confidence * 100).toString();
      };

      const confClass = getConfidenceClass(confData);
      const confLevelName = confData?.level?.name || "No data";
      const confPercent = confData
        ? Math.round(confData.confidence * 100)
        : null;

      // Update class
      lineDiv.className = `mmd-editor-line ${confClass}`;

      // Update confidence span
      confSpan.textContent = getConfidenceLabel(confData);
      confSpan.title = confData
        ? `Line ${lineNum}: ${confPercent}% (${confLevelName})`
        : `Line ${lineNum}: No OCR data`;

      // Update ARIA
      lineDiv.setAttribute(
        "aria-label",
        confPercent !== null
          ? `Line ${lineNum}, ${confPercent}% confidence, ${confLevelName}`
          : `Line ${lineNum}, no confidence data`,
      );

      logDebug(`Line ${lineNum} restored to original`);
    }
  };

  /**
   * Store original MMD content for edit comparison
   * Called during session restoration
   * @param {string} originalMmd - Original MMD content from OCR
   */
  proto.setOriginalMmdContent = function (originalMmd) {
    if (originalMmd) {
      this.originalMmdLines = originalMmd.split("\n");
      logDebug(
        `Stored ${this.originalMmdLines.length} original lines for edit tracking`,
      );
    }
  };

  /**
   * Scroll the code view to a specific line
   * @param {number} lineNumber - 1-indexed line number
   */
  proto.scrollToLine = function (lineNumber) {
    const container = this.elements.mmdCodeContainer;
    const codeElement = this.elements.mmdCodeElement;

    if (!container || !codeElement) return;

    // Calculate scroll position
    const lineTop = (lineNumber - 1) * this.gutterLineHeight;
    const containerHeight = container.clientHeight;
    const scrollTarget = lineTop - containerHeight / 3;

    // Smooth scroll to line
    container.scrollTo({
      top: Math.max(0, scrollTarget),
      behavior: "smooth",
    });

    logDebug(`Scrolled to line ${lineNumber}`);
  };

  /**
   * Show confidence toggle when PDF with lines data is loaded
   * @private
   */
  proto.showConfidenceToggle = function () {
    if (this.elements.confidenceToggle) {
      this.elements.confidenceToggle.hidden = false;
      logDebug("Confidence toggle shown");
    }
  };

  /**
   * Hide confidence toggle (for non-PDF sources)
   * @private
   */
  proto.hideConfidenceToggle = function () {
    if (this.elements.confidenceToggle) {
      this.elements.confidenceToggle.hidden = true;
    }

    // Also disable highlighting if it was on
    if (this.isConfidenceEnabled) {
      this.toggleConfidenceHighlighting(false);
    }
  };

  /**
   * Show warning about low-confidence lines
   * @param {number} count - Number of low-confidence lines
   * @private
   */
  proto.showConfidenceWarning = function (count) {
    // Use existing notification system
    const message = `${count} line${
      count !== 1 ? "s" : ""
    } may need review (low OCR confidence)`;

    if (typeof notifyInfo === "function") {
      notifyInfo(message, { duration: 5000 });
    } else {
      logInfo(message);
    }
  };

  /**
   * Refresh confidence mapping after content changes
   * Can be called manually if user wants to re-map after edits
   */
  proto.refreshConfidenceMapping = function () {
    if (!this.confidenceMapper || !this.restoredSession) {
      logWarn("Cannot refresh - no mapper or session");
      return;
    }

    const linesData = this.restoredSession.linesData;
    const currentContent = this.restoredSession.currentMMD;

    this.confidenceMapper.refreshMapping(linesData, currentContent);

    // Re-render gutter if enabled
    if (this.isConfidenceEnabled) {
      this.renderConfidenceGutter();
    }

    this.announceToScreenReader("Confidence mapping refreshed");
    logInfo("Confidence mapping refreshed");
  };

  /**
   * Update session status indicator
   * @param {string} state - 'modified', 'saving', or 'saved'
   * @private
   */
  proto.updateSessionStatus = function (state) {
    const statusText = {
      modified: RESTORER_CONFIG.MESSAGES.SESSION_MODIFIED,
      saving: "Saving...",
      saved: RESTORER_CONFIG.MESSAGES.SESSION_SAVED,
    };

    const text = statusText[state] || state;

    if (this.elements.mmdSessionStatus) {
      this.elements.mmdSessionStatus.textContent = text;
      this.elements.mmdSessionStatus.dataset.state = state;
    }
    if (this.elements.sessionStatus) {
      this.elements.sessionStatus.textContent = text;
      this.elements.sessionStatus.dataset.state = state;
    }

    // Show/hide Download Updated ZIP button based on whether there are edits
    this.updateDownloadButtonVisibility();

    logDebug("Session status updated:", state);
  };

  /**
   * Update visibility of the Download Updated ZIP button
   * Shows button when session has edits (current !== original)
   * @private
   */
  proto.updateDownloadButtonVisibility = function () {
    // Check restorer's own session tracking first
    const currentMMD = this.restoredSession?.currentMMD;
    const originalMMD = this.restoredSession?.originalMMD;

    // Also check persistence module as fallback
    const persistence = window.getMathPixMMDPersistence?.();
    const persistenceSession = persistence?.session;

    // Has edits if either tracking shows changes
    const hasEditsFromRestorer =
      currentMMD && originalMMD && currentMMD !== originalMMD;
    const hasEditsFromPersistence =
      persistenceSession &&
      persistenceSession.current &&
      persistenceSession.original &&
      persistenceSession.current !== persistenceSession.original;

    const hasEdits = hasEditsFromRestorer || hasEditsFromPersistence;

    logDebug("Download button visibility check:", {
      hasEditsFromRestorer,
      hasEditsFromPersistence,
      hasEdits,
    });

    if (hasEdits) {
      this.showDownloadUpdatedButton();
    } else {
      this.hideDownloadUpdatedButton();
    }
  };

  /**
   * Schedule auto-save with debounce (fallback if persistence module unavailable)
   * @param {string} content - Content to save
   * @private
   */
  proto.scheduleAutoSave = function (content) {
    clearTimeout(this.autoSaveTimer);

    this.autoSaveTimer = setTimeout(() => {
      this.saveContentToStorage(content);
    }, 1000); // 1 second debounce
  };

  /**
   * Save content to localStorage
   * @param {string} content - Content to save
   * @private
   */
  proto.saveContentToStorage = function (content) {
    this.updateSessionStatus("saving");

    try {
      // Push to undo stack before saving
      if (
        this.restoredSession?.currentMMD &&
        this.restoredSession.currentMMD !== content
      ) {
        this.pushToUndoStack(this.restoredSession.currentMMD);
      }

      // Update current content
      if (this.restoredSession) {
        this.restoredSession.currentMMD = content;
        this.restoredSession.lastModified = Date.now();

        // Use the full storage key (with mathpix-resume-session- prefix)
        // This must match the key used in startPersistenceSession
        const storageKey =
          this.restoredSession.storageKey ||
          (this.restoredSession.sessionKey
            ? `mathpix-resume-session-${this.restoredSession.sessionKey}`
            : "mathpix-resume-session-fallback");

        const sessionData = {
          // Session identification
          key: this.restoredSession.sessionKey,
          storageKey: storageKey,

          // Source file info
          sourceFileName: this.restoredSession.source?.filename || "",

          // Content — all stored with CDN URLs (blob URLs are ephemeral)
          // Phase 8H.3: current uses getMMDForStorage (compact placeholders for user-added images)
          // to avoid localStorage quota overflow from embedded data URIs
          original: this.getMMDForAPI(
            this.restoredSession.baselineMMD ||
              this.restoredSession.originalMMD,
          ),
          baseline: this.getMMDForAPI(this.restoredSession.baselineMMD),
          current: this.getMMDForStorage(content),

          // Edit history — sanitise blob URLs before persisting (Fix F13)
          // Blob URLs are page-session-scoped and die on refresh.
          undoStack: (this.undoStack || []).map((entry) =>
            typeof entry === "string" ? this.getMMDForStorage(entry) : entry,
          ),
          redoStack: (this.redoStack || []).map((entry) =>
            typeof entry === "string" ? this.getMMDForStorage(entry) : entry,
          ),

          // AI enhancement metadata (if applied)
          // Enables: AI sparkle icon in session loader, special ZIP filename
          aiEnhanced: this.restoredSession.aiEnhanced || null,

          // Timestamps
          lastModified: Date.now(),
        };

        localStorage.setItem(storageKey, JSON.stringify(sessionData));
        logDebug("Saved to localStorage:", storageKey);
      }

      this.updateSessionStatus("saved");
      this.hasUnsavedChanges = false;

      logDebug("Content auto-saved");
    } catch (error) {
      logError("Failed to auto-save:", error);
      this.updateSessionStatus("modified"); // Revert to modified on error
    }
  };

  /**
   * Push content to undo stack
   * @param {string} content - Content to push
   * @private
   */
  proto.pushToUndoStack = function (content) {
    if (!content) return;

    this.undoStack.push(content);

    // Limit stack size
    if (this.undoStack.length > this.maxUndoLevels) {
      this.undoStack.shift();
    }

    // Clear redo stack on new changes
    this.redoStack = [];

    // Update button states
    this.updateUndoRedoButtons();

    logDebug("Pushed to undo stack:", { stackSize: this.undoStack.length });
  };

  /**
   * Undo last edit
   * @private
   */
  proto.undoEdit = function () {
    logDebug("Undo edit requested");

    // Try persistence module first
    const persistence = window.getMathPixMMDPersistence?.();
    if (persistence && persistence.hasSession()) {
      const result = persistence.undo();
      if (result) {
        // Sync our state with persistence
        this.syncFromPersistence();
        return;
      }
    }

    // Fallback to our own stack
    if (this.undoStack.length === 0) {
      this.showNotification("Nothing to undo", "info");
      return;
    }

    // Push current to redo
    const current = this.getCurrentMMDContent();
    if (current) {
      this.redoStack.push(current);
    }

    // Pop from undo
    const previousContent = this.undoStack.pop();

    // Apply content
    this.loadMMDContent(
      previousContent,
      this.restoredSession?.originalMMD || previousContent,
    );
    if (this.restoredSession) {
      this.restoredSession.currentMMD = previousContent;
    }

    // Update UI
    this.updateUndoRedoButtons();
    this.updateSessionStatus("saved");
    this.hasUnsavedChanges = false;

    this.showNotification("Change undone", "success");
    logDebug("Undo applied, remaining:", this.undoStack.length);
  };

  /**
   * Redo last undone edit
   * @private
   */
  proto.redoEdit = function () {
    logDebug("Redo edit requested");

    // Try persistence module first
    const persistence = window.getMathPixMMDPersistence?.();
    if (persistence && persistence.hasSession()) {
      const result = persistence.redo();
      if (result) {
        // Sync our state with persistence
        this.syncFromPersistence();
        return;
      }
    }

    // Fallback to our own stack
    if (this.redoStack.length === 0) {
      this.showNotification("Nothing to redo", "info");
      return;
    }

    // Push current to undo
    const current = this.getCurrentMMDContent();
    if (current) {
      this.undoStack.push(current);
    }

    // Pop from redo
    const nextContent = this.redoStack.pop();

    // Apply content
    this.loadMMDContent(
      nextContent,
      this.restoredSession?.originalMMD || nextContent,
    );
    if (this.restoredSession) {
      this.restoredSession.currentMMD = nextContent;
    }

    // Update UI
    this.updateUndoRedoButtons();
    this.updateSessionStatus("saved");
    this.hasUnsavedChanges = false;

    this.showNotification("Change redone", "success");
    logDebug("Redo applied, remaining:", this.redoStack.length);
  };

  /**
   * Update undo/redo button states
   * @private
   */
  proto.updateUndoRedoButtons = function () {
    // Check persistence module first
    const persistence = window.getMathPixMMDPersistence?.();

    let canUndo = this.undoStack.length > 0;
    let canRedo = this.redoStack.length > 0;

    if (persistence && persistence.hasSession()) {
      canUndo = canUndo || persistence.session?.undoStack?.length > 0;
      canRedo = canRedo || persistence.session?.redoStack?.length > 0;
    }

    if (this.elements.mmdUndoBtn) {
      this.elements.mmdUndoBtn.disabled = !canUndo;
    }
    if (this.elements.mmdRedoBtn) {
      this.elements.mmdRedoBtn.disabled = !canRedo;
    }

    logDebug("Undo/redo buttons updated:", { canUndo, canRedo });
  };

  /**
   * Sync state from persistence module after undo/redo
   * @private
   */
  proto.syncFromPersistence = function () {
    const persistence = window.getMathPixMMDPersistence?.();
    if (!persistence || !persistence.session) return;

    const content = persistence.session.current;
    if (content && this.restoredSession) {
      this.restoredSession.currentMMD = content;

      // Phase 8G: Determine textarea content (collapsed or raw)
      let textareaContent = content;
      if (this.isDisplayCollapsed && this.displayLayer) {
        this.restoredSession.workingMMD = content;
        const { displayMMD } = this.displayLayer.collapse(
          content,
          this.imageRegistry,
        );
        textareaContent = displayMMD;
      }

      // Update textarea
      if (this.elements.mmdEditorTextarea) {
        this.elements.mmdEditorTextarea.value = textareaContent;
      }

      // Update code element
      if (this.elements.mmdCodeElement) {
        this.elements.mmdCodeElement.textContent = textareaContent;
        if (typeof Prism !== "undefined") {
          Prism.highlightElement(this.elements.mmdCodeElement);
        }
      }

      // Update preview (uses working content for real images)
      this.updatePreview(content);
    }

    this.updateUndoRedoButtons();
    this.updateSessionStatus("saved");
  };

  /**
   * Restore original MMD content
   * @private
   */
  proto.restoreOriginal = function () {
    logDebug("Restoring original MMD content");

    const original = this.restoredSession?.originalMMD;
    if (!original) {
      logWarn("No original MMD content to restore");
      return;
    }

    this.loadMMDContent(original, original);

    if (this.restoredSession) {
      this.restoredSession.currentMMD = original;
    }

    this.hasUnsavedChanges = false;

    // Update status
    if (this.elements.mmdSessionStatus) {
      this.elements.mmdSessionStatus.textContent = "Restored";
      this.elements.mmdSessionStatus.dataset.state = "saved";
    }

    this.showNotification("Original content restored", "success");
  };

  /**
   * Clear current session
   * @private
   */
  proto.clearSession = function () {
    logDebug("Clearing session");

    if (this.hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Clear session anyway?")) {
        return;
      }
    }

    // Clear stored session
    if (this.restoredSession?.sessionKey) {
      try {
        localStorage.removeItem(
          `mathpix-resume-session-${this.restoredSession.sessionKey}`,
        );
      } catch (error) {
        logWarn("Failed to remove session from localStorage:", error);
      }
    }

    this.restoredSession = null;
    this.hasUnsavedChanges = false;

    this.resetToUploadState();
    this.showNotification("Session cleared", "info");
  };

  /**
   * Download current MMD content
   * @private
   */
  proto.downloadMmd = function () {
    logDebug("Downloading MMD content");

    const content = this.getCurrentMMDContent();
    if (!content) {
      this.showNotification("No content to download", "warning");
      return;
    }

    const filename = this.restoredSession?.source?.filename || "document";
    const baseName = filename.replace(/\.[^/.]+$/, "");
    const downloadName = `${baseName}-edited.mmd`;

    const blob = new Blob([content], { type: "text/x-mmd" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    this.showNotification(`Downloaded ${downloadName}`, "success");
  };

  /**
   * Handle MMD file upload
   * @param {Event} e - Change event
   * @private
   */
  proto.handleMmdUpload = function (e) {
    const file = e.target?.files?.[0];
    if (!file) return;

    logDebug("Loading MMD file:", file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        if (this.elements.mmdEditorTextarea) {
          this.elements.mmdEditorTextarea.value = content;
        }
        this.handleMmdInput();
        this.showNotification(`Loaded ${file.name}`, "success");
      }
    };
    reader.onerror = () => {
      this.showNotification("Failed to read file", "error");
    };
    reader.readAsText(file);

    // Reset input
    if (e.target) {
      e.target.value = "";
    }
  };

  console.log("[SessionRestorer] Confidence mixin loaded");
})();
