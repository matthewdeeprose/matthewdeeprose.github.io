// /mathpix-scripts/ui/components/mathpix-result-renderer.js
// Logging configuration (module level)
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

import MathPixBaseModule from "../../core/mathpix-base-module.js";
import MATHPIX_CONFIG from "../../core/mathpix-config.js";
import { LaTeXTransformer } from "../../core/mathpix-latex-transformer.js";

// =============================================================================
// SVG ICON REGISTRY
// =============================================================================

/**
 * SVG icons for UI elements
 * All icons use currentColor for theme compatibility
 */
const ICONS = {
  bullet:
    '<svg class="icon icon-bullet" aria-hidden="true" height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><circle cx="10.5" cy="10.5" r="3" fill="currentColor"/></svg>',
  check:
    '<svg class="icon icon-check" aria-hidden="true" height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><path d="m.5 5.5 3 3 8.028-8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(5 6)"/></svg>',
  warning:
    '<svg class="icon icon-warning" aria-hidden="true" height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" transform="translate(1 1)"><path d="m9.5.5 9 16h-18z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="m9.5 10.5v-5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="13.5" fill="currentColor" r="1"/></g></svg>',
};

/**
 * Get an SVG icon by name
 * @param {string} name - Icon name from ICONS registry (bullet, check, warning)
 * @returns {string} SVG HTML string with aria-hidden attribute
 */
function getIcon(name) {
  const svg = ICONS[name];
  if (!svg) {
    logWarn(`Unknown icon requested: ${name}`);
    return "";
  }
  return svg;
}

/**
 * MathPix Result Renderer Module
 * Handles all result display, format switching, and MathJax integration
 */
class MathPixResultRenderer extends MathPixBaseModule {
  constructor(controller) {
    super(controller);

    this.supportedFormats = [
      "latex",
      "mathml",
      "asciimath",
      "html",
      "markdown",
      "json",
      "table-html",
      "table-markdown",
      "table-tsv",
      "smiles",
    ];
    this.currentFormat = "latex"; // Default format

    // MathJax recovery integration
    this.pendingMathJaxRender = false;
    this.mathJaxRecoveryUnsubscribe = null;
    this.lastRenderedElement = null; // Track element for re-render

    this.isInitialised = true;

    // Subscribe to MathJax recovery events
    this.subscribeToMathJaxRecovery();

    logInfo("MathPix Result Renderer initialised", {
      supportedFormats: this.supportedFormats,
      defaultFormat: this.currentFormat,
      mathJaxRecoverySubscribed: !!this.mathJaxRecoveryUnsubscribe,
    });
  }

  // =============================================================================
  // MATHJAX RECOVERY INTEGRATION
  // =============================================================================

  /**
   * Subscribe to MathJax recovery events from MathJax Manager
   * When MathJax recovers from failures, this will trigger re-rendering
   * of any pending mathematical content
   * @private
   */
  subscribeToMathJaxRecovery() {
    // Check if MathJax Manager is available
    if (!window.mathJaxManager?.onRecovery) {
      logDebug(
        "MathJax Manager not available for recovery subscription - will retry later",
      );

      // Retry subscription after a delay (MathJax Manager may load later)
      setTimeout(() => {
        if (
          window.mathJaxManager?.onRecovery &&
          !this.mathJaxRecoveryUnsubscribe
        ) {
          this.subscribeToMathJaxRecovery();
        }
      }, 2000);
      return;
    }

    // Subscribe to recovery events
    this.mathJaxRecoveryUnsubscribe = window.mathJaxManager.onRecovery(
      (eventData) => {
        logInfo("MathJax recovery notification received in Result Renderer", {
          healthy: eventData.healthy,
          pendingMathJaxRender: this.pendingMathJaxRender,
          hasCurrentResult: !!this.currentResult,
        });

        // Re-render if we have pending math content
        if (this.pendingMathJaxRender && eventData.healthy) {
          this.handleMathJaxRecovery();
        }
      },
    );

    logInfo("Result Renderer subscribed to MathJax recovery events");
  }

  /**
   * Handle MathJax recovery by re-rendering the processed output panel
   * @private
   */
  async handleMathJaxRecovery() {
    logInfo("Handling MathJax recovery in Result Renderer");

    // Check if we have content to re-render
    if (!this.currentResult) {
      logDebug("No current result to re-render after MathJax recovery");
      this.pendingMathJaxRender = false;
      return;
    }

    const renderedOutput = document.getElementById("mathpix-rendered-output");
    if (!renderedOutput) {
      logWarn("Rendered output element not found for MathJax recovery");
      this.pendingMathJaxRender = false;
      return;
    }

    // Check if the element still has the fallback class (meaning it needs re-rendering)
    if (!renderedOutput.classList.contains("mathjax-fallback")) {
      logDebug("Rendered output already has MathJax - no recovery needed");
      this.pendingMathJaxRender = false;
      return;
    }

    try {
      logInfo("Re-rendering processed output after MathJax recovery");

      // Re-populate the processed output panel
      this.populateProcessedOutputPanel(this.currentResult);

      // Clear the pending flag
      this.pendingMathJaxRender = false;

      // Announce to screen readers
      this.announceToScreenReader("Mathematical content has been rendered");

      logInfo("✅ MathJax recovery re-render completed successfully");
    } catch (error) {
      logError("Failed to re-render after MathJax recovery", error);
      // Keep pendingMathJaxRender true so we can try again
    }
  }

  /**
   * Announce message to screen readers using ARIA live region
   * @param {string} message - Message to announce
   * @private
   */
  announceToScreenReader(message) {
    // Look for existing live region or create one
    let liveRegion = document.getElementById("mathpix-sr-announcements");

    if (!liveRegion) {
      liveRegion = document.createElement("div");
      liveRegion.id = "mathpix-sr-announcements";
      liveRegion.setAttribute("aria-live", "polite");
      liveRegion.setAttribute("aria-atomic", "true");
      liveRegion.className = "sr-only";
      liveRegion.style.cssText =
        "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;";
      document.body.appendChild(liveRegion);
    }

    // Clear and set message (clearing first ensures re-announcement)
    liveRegion.textContent = "";
    setTimeout(() => {
      liveRegion.textContent = message;
    }, 100);
  }

  /**
   * Display multi-format processing result
   * @param {Object} result - Processing result from MathPix API
   * @param {File} [originalFile] - Original/transformed file for comparison view (Phase 1F.2)
   */
  displayResult(result, originalFile) {
    logInfo("=== displayResult CALLED ===", {
      resultExists: !!result,
      resultKeys: result ? Object.keys(result) : [],
      hasLineData: !!result?.line_data,
      lineDataLength: result?.line_data?.length || 0,
    });

    logInfo("Displaying multi-format result", {
      hasLatex: !!result.latex,
      hasHtml: !!result.html,
      hasAsciimath: !!result.asciimath,
      hasMathml: !!result.mathml,
      containsTable: !!result.containsTable,
      hasLineData: !!result.line_data, // CHANGE 1: Add to initial logging
      confidence: result.confidence,
    });

    // Clean up any pending CDN retry from a previous result
    if (this._cdnRetryTimer) {
      clearInterval(this._cdnRetryTimer);
      this._cdnRetryTimer = null;
    }

    // Store current result for later access
    this.currentResult = result;
    logInfo("Result stored in currentResult", {
      stored: !!this.currentResult,
      hasLineData: !!this.currentResult?.line_data,
    });

    // Reset all format options to available state first
    this.resetFormatOptions();

    // Populate all format content areas
    this.populateFormatContent("latex", result.latex);
    this.populateFormatContent("mathml", result.mathml);
    this.populateFormatContent("asciimath", result.asciimath);
    this.populateFormatContent("html", result.html);
    this.populateFormatContent("markdown", result.markdown);
    this.populateFormatContent("json", result.rawJson);

    // Phase 4: Populate chemistry format if available
    if (result.containsChemistry && result.smiles) {
      this.populateChemistryFormat(result.smiles);
      this.showChemistryTab(true);

      logInfo("Chemistry content detected and displayed", {
        structureCount: result.smiles.length,
        notations: result.smiles.map((s) => s.notation),
      });
    } else {
      this.showChemistryTab(false);
    }

    // Populate table formats if available
    if (result.containsTable) {
      // Show and populate table tabs
      if (result.tableHtml) {
        this.populateFormatContent("table-html", result.tableHtml);
        // Show Table (HTML) tab
        const tableHtmlTab = document.getElementById("mathpix-tab-table-html");
        if (tableHtmlTab) {
          tableHtmlTab.style.display = "";
          tableHtmlTab.removeAttribute("aria-disabled");
        }
      }
      if (result.tableMarkdown) {
        this.populateFormatContent("table-markdown", result.tableMarkdown);
        // Show Table (Markdown) tab
        const tableMarkdownTab = document.getElementById(
          "mathpix-tab-table-markdown",
        );
        if (tableMarkdownTab) {
          tableMarkdownTab.style.display = "";
          tableMarkdownTab.removeAttribute("aria-disabled");
        }
      }
      if (result.tsv) {
        this.populateFormatContent("table-tsv", result.tsv);
        // Show Table (TSV) tab
        const tableTsvTab = document.getElementById("mathpix-tab-table-tsv");
        if (tableTsvTab) {
          tableTsvTab.style.display = "";
          tableTsvTab.removeAttribute("aria-disabled");
        }
      }

      logInfo("Table formats populated and tabs shown", {
        hasTableHtml: !!result.tableHtml,
        hasTableMarkdown: !!result.tableMarkdown,
        hasTsv: !!result.tsv,
      });

      // Notify user of table detection
      const formatList = [];
      if (result.tableHtml) formatList.push("HTML");
      if (result.tableMarkdown) formatList.push("Markdown");
      if (result.tsv) formatList.push("TSV");

      if (formatList.length > 0) {
        this.showNotification(
          `Table detected! Available in ${formatList.join(", ")} format${
            formatList.length > 1 ? "s" : ""
          }.`,
          "success",
        );
      }

      // Smart hide: Only hide markdown if it contains ONLY table LaTeX
      const markdownPanel = this.controller.elements.formatPanels["markdown"];
      const markdownRadio = document.getElementById("mathpix-format-markdown");

      // Check if markdown is ONLY table LaTeX (no other content)
      const isOnlyTable =
        result.markdown &&
        result.markdown.includes("\\begin{table}") &&
        result.markdown.trim().startsWith("\\begin{table}") &&
        result.markdown.trim().endsWith("\\end{table}");

      if (isOnlyTable) {
        // Pure table - hide markdown format
        if (markdownPanel) {
          markdownPanel.style.display = "none";
          logDebug("Hidden markdown panel (contains only table LaTeX)");
        }

        // Hide markdown tab button
        const markdownTab = document.getElementById("mathpix-tab-markdown");
        if (markdownTab) {
          markdownTab.style.display = "none";
          logDebug("Hidden markdown tab (contains only table LaTeX)");
        }

        // Legacy: Hide radio button if still exists
        if (markdownRadio) {
          const markdownLabel = markdownRadio.closest("label");
          if (markdownLabel) {
            markdownLabel.style.display = "none";
            logDebug("Hidden markdown radio (contains only table LaTeX)");
          }
        }
      } else if (result.markdown?.includes("\\begin{table}")) {
        // Mixed content - add warning but keep visible
        const markdownLabel = markdownRadio?.closest("label");
        const formatDesc = markdownLabel?.querySelector(".format-description");
        if (formatDesc) {
          formatDesc.textContent =
            "Contains table LaTeX (use Table formats for table data)";
          logDebug("Added warning to markdown (mixed content with tables)");
        }
      }
    }

    // Auto-select first available format
    this.selectFirstAvailableFormat();

    // Update metadata
    this.updateMetadata(result);

    // Show HTML preview if HTML content is available
    if (result.html && this.elements.htmlPreview) {
      // Show MathML for proper browser-native mathematics rendering
      // Hide asciimath and latex (plain text representations)
      const parser = new DOMParser();
      const previewDoc = parser.parseFromString(result.html, "text/html");

      // Show mathml tags - browsers render MathML natively
      const mathmlTags = previewDoc.querySelectorAll("mathml");
      mathmlTags.forEach((tag) => {
        tag.setAttribute("style", "display: inline;");
      });

      // Hide asciimath tags - plain text, not rendered
      const asciimathTags = previewDoc.querySelectorAll("asciimath");
      asciimathTags.forEach((tag) => {
        tag.setAttribute("style", "display: none;");
      });

      // Hide latex tags - plain text, not rendered
      const latexTags = previewDoc.querySelectorAll("latex");
      latexTags.forEach((tag) => {
        tag.setAttribute("style", "display: none;");
      });

      this.elements.htmlPreview.innerHTML = previewDoc.body.innerHTML;

      logDebug("HTML preview populated with MathML rendering", {
        originalLength: result.html.length,
        mathmlShown: mathmlTags.length,
        asciimathHidden: asciimathTags.length,
        latexHidden: latexTags.length,
      });
    }

    // Phase 1F.2: Display responsive visual comparison with transformed file
    // Use passed originalFile parameter (which may be transformed) for comparison
    if (originalFile) {
      logInfo("Creating responsive visual comparison", {
        originalFile:
          originalFile instanceof File
            ? originalFile.name
            : typeof originalFile,
        hasLatex: !!result.latex,
        confidence: result.confidence,
        resultFormats: Object.keys(result).filter((key) => result[key]),
      });
      this.displayResponsiveComparison(originalFile, result);
    } else if (
      this.controller.fileHandler &&
      this.controller.fileHandler.currentUploadedFile
    ) {
      // Fallback: Use current uploaded file directly (synchronous access)
      logWarn("No originalFile provided, using currentUploadedFile directly");
      this.displayResponsiveComparison(
        this.controller.fileHandler.currentUploadedFile,
        result,
      );
    }

    // CHANGE 2: Phase 3.2 - Display line data if available
    if (
      result.line_data &&
      Array.isArray(result.line_data) &&
      result.line_data.length > 0
    ) {
      logInfo(
        "Line data available in API response, displaying processing details",
        {
          lineCount: result.line_data.length,
          types: [...new Set(result.line_data.map((line) => line.type))],
        },
      );
      this.displayLineData(result.line_data);
    } else {
      logDebug("No line data in API response or empty array");
    }

    // Phase 4: Post-processing UI cleanup
    if (MATHPIX_CONFIG.PHASE_4?.CLEANUP_AFTER_PROCESSING !== false) {
      this.performPostProcessingCleanup();
    }

    // Show output container and default to LaTeX format
    const outputContainer = this.elements["output-container"];
    if (outputContainer) {
      outputContainer.style.display = "block";
    }
    this.showFormat("latex");

    logInfo("Multi-format result displayed successfully", {
      postProcessingCleanup:
        MATHPIX_CONFIG.PHASE_4?.CLEANUP_AFTER_PROCESSING !== false,
      lineDataDisplayed: !!(result.line_data && result.line_data.length > 0), // CHANGE 3: Add to final logging
    });
  }

  /**
   * Populate content for specific format
   * @param {string} format - Format name
   * @param {string} content - Content to populate
   */
  populateFormatContent(format, content) {
    const contentElement = this.elements.formatContents?.[format];
    const formatOption = document
      .querySelector(`.mathpix-format-option input[value="${format}"]`)
      ?.closest(".mathpix-format-option");

    if (!contentElement) {
      logWarn(`Content element not found for format: ${format}`);
      return;
    }

    if (!content || content.trim() === "") {
      // Handle empty content
      contentElement.textContent = `No ${format.toUpperCase()} content available for this image.`;
      contentElement.classList.add("empty-content");

      // Hide tab button for unavailable format
      const tabButton = document.getElementById(`mathpix-tab-${format}`);
      if (tabButton) {
        tabButton.style.display = "none";
        tabButton.setAttribute("aria-disabled", "true");
        logDebug(`Tab button hidden for unavailable format: ${format}`);
      }

      // Legacy: Mark format option as unavailable (if radio buttons still exist)
      if (formatOption) {
        formatOption.classList.add("unavailable");
        const radioInput = formatOption.querySelector('input[type="radio"]');
        if (radioInput) {
          radioInput.disabled = true;
        }
      }

      logDebug(`Format ${format} marked as unavailable (no content)`);
      return;
    }

    // Show tab button for available format
    const tabButton = document.getElementById(`mathpix-tab-${format}`);
    if (tabButton) {
      tabButton.style.display = "";
      tabButton.removeAttribute("aria-disabled");
      logDebug(`Tab button shown for available format: ${format}`);
    }

    // Legacy: Mark format option as available (if radio buttons still exist)
    if (formatOption) {
      formatOption.classList.remove("unavailable");
      const radioInput = formatOption.querySelector('input[type="radio"]');
      if (radioInput) {
        radioInput.disabled = false;
      }
    }

    // Special handling for LaTeX format - provide multiple delimiter formats
    if (format === "latex") {
      this.populateLatexWithMultipleFormats(contentElement, content);
      return;
    }

    // Special handling for table formats
    if (
      format === "table-html" ||
      format === "table-markdown" ||
      format === "table-tsv"
    ) {
      this.populateTableFormat(format, content, contentElement);
      return;
    }

    // Special handling for HTML format - enhance any embedded tables
    if (format === "html") {
      this.populateHtmlFormatWithTableEnhancements(content, contentElement);
      return;
    }

    // Standard format handling for non-LaTeX formats
    // Apply enhanced syntax highlighting using Prism bridge
    const highlightingSuccess =
      this.controller.prismBridge?.applySyntaxHighlighting(
        contentElement,
        format,
        content,
      );

    // Prepare for existing MarkdownCodeCopy system
    const preElement = contentElement.parentElement;
    if (preElement && preElement.tagName === "PRE") {
      // Store original content for the existing copy system
      preElement.dataset.originalCode = content;

      // Add necessary classes for styling
      preElement.classList.add("code-block-container");

      // Trigger the existing copy button system
      if (
        window.MarkdownCodeCopy &&
        typeof window.MarkdownCodeCopy.init === "function"
      ) {
        // Re-initialize copy buttons for this specific container
        window.MarkdownCodeCopy.init(preElement.parentElement);
        logDebug(`Integrated with existing copy button system for ${format}`);
      }
    }

    logDebug(`Format ${format} populated successfully`, {
      length: content.length,
      syntaxHighlighting: highlightingSuccess,
      integratedWithCopySystem: !!preElement?.dataset.originalCode,
    });
  }

  /**
   * Populate LaTeX format with multiple delimiter options
   * Simply shows original, then $ version, then $$ version below it
   * @param {HTMLElement} contentElement - The LaTeX content element (the <code> tag)
   * @param {string} latexContent - The original LaTeX content
   */
  populateLatexWithMultipleFormats(contentElement, latexContent) {
    try {
      // Get wrapper and clean up any previous multi-format additions
      const preElement = contentElement.parentElement;
      const wrapper = preElement?.parentElement;

      if (wrapper) {
        // Remove any elements we added previously (marked with data attribute)
        const previousAdditions = wrapper.querySelectorAll(
          '[data-latex-addition="true"]',
        );
        previousAdditions.forEach((element) => element.remove());
        logDebug(
          `Cleaned up ${previousAdditions.length} previous LaTeX format additions`,
        );
      }

      // Transform LaTeX into multiple formats
      const transformed =
        LaTeXTransformer.transformWithFormatPreservation(latexContent);

      // Apply syntax highlighting to original in the existing code element
      this.controller.prismBridge?.applySyntaxHighlighting(
        contentElement,
        "latex",
        transformed.original,
      );

      // Set up copy for original
      if (preElement && preElement.tagName === "PRE") {
        preElement.dataset.originalCode = transformed.original;
      }

      if (!wrapper) return;

      // Add label for original
      const originalLabel = document.createElement("p");
      originalLabel.textContent = "LaTeX (From MathPix)";
      originalLabel.setAttribute("data-latex-addition", "true");
      originalLabel.style.marginTop = "0";
      originalLabel.style.marginBottom = "0.5rem";
      originalLabel.style.fontWeight = "600";
      wrapper.insertBefore(originalLabel, preElement);

      // Phase 2: Check user's delimiter preference
      // Only show MS Word conversion section if LaTeX delimiters are selected
      // (If Markdown delimiters selected, API already returns $ format, no conversion needed)
      let userDelimiterFormat = "latex"; // Default assumption

      if (window.getMathPixController) {
        try {
          const controller = window.getMathPixController();
          if (
            controller &&
            controller.uiManager &&
            controller.uiManager.getCurrentPreferences
          ) {
            const prefs = controller.uiManager.getCurrentPreferences();
            userDelimiterFormat = prefs.delimiterFormat || "latex";
            logDebug(
              "[Result Renderer] User delimiter preference:",
              userDelimiterFormat,
            );
          }
        } catch (e) {
          logWarn(
            "[Result Renderer] Could not retrieve delimiter preference, assuming LaTeX",
            e,
          );
        }
      }

      // Only show MS Word conversion section for LaTeX delimiter format
      // When Markdown delimiters selected, the original IS already in $ format
      if (userDelimiterFormat === "latex") {
        // Add section header for MS Word versions
        const wordHeader = document.createElement("p");
        wordHeader.textContent =
          "Versions for MS Word Equation Editor (automatically converted, may be inaccurate)";
        wordHeader.setAttribute("data-latex-addition", "true");
        wordHeader.style.marginTop = "1.5rem";
        wordHeader.style.marginBottom = "0.75rem";
        wordHeader.style.fontWeight = "600";
        wrapper.appendChild(wordHeader);

        // Add inline expression label
        const inlineLabel = document.createElement("p");
        inlineLabel.textContent = "Inline expression";
        inlineLabel.setAttribute("data-latex-addition", "true");
        inlineLabel.style.marginTop = "0";
        inlineLabel.style.marginBottom = "0.25rem";
        inlineLabel.style.fontSize = "0.9em";
        wrapper.appendChild(inlineLabel);

        // Add dollar format with its own wrapper
        const dollarWrapper = document.createElement("div");
        dollarWrapper.className = "code-block-wrapper";
        dollarWrapper.style.marginBottom = "1rem";
        dollarWrapper.setAttribute("data-latex-addition", "true");

        const dollarPre = document.createElement("pre");
        dollarPre.className = "code-block-container language-latex";
        dollarPre.tabIndex = 0;
        dollarPre.dataset.originalCode = transformed.dollarFormat;

        const dollarCode = document.createElement("code");
        dollarCode.className = "language-latex";
        this.controller.prismBridge?.applySyntaxHighlighting(
          dollarCode,
          "latex",
          transformed.dollarFormat,
        );

        dollarPre.appendChild(dollarCode);
        dollarWrapper.appendChild(dollarPre);

        // Clone and attach copy button to WRAPPER (not pre) so it doesn't scroll with content
        const originalCopyBtnDollar =
          preElement.querySelector(".code-copy-button");
        if (originalCopyBtnDollar) {
          const dollarCopyBtn = originalCopyBtnDollar.cloneNode(true);

          // Attach click handler to copy the dollar format
          dollarCopyBtn.addEventListener("click", async () => {
            const originalContent = dollarCopyBtn.innerHTML;
            try {
              await navigator.clipboard.writeText(transformed.dollarFormat);
              // Match MarkdownCodeCopy behavior
              dollarCopyBtn.innerHTML = `${
                dollarCopyBtn.querySelector("svg").outerHTML
              } Copied`;
              setTimeout(() => {
                dollarCopyBtn.innerHTML = originalContent;
              }, 2000);
              logDebug("Dollar format copied to clipboard");
            } catch (error) {
              dollarCopyBtn.innerHTML = `${
                dollarCopyBtn.querySelector("svg").outerHTML
              } Failed to copy`;
              setTimeout(() => {
                dollarCopyBtn.innerHTML = originalContent;
              }, 2000);
              logError("Failed to copy dollar format", error);
            }
          });

          dollarWrapper.appendChild(dollarCopyBtn);
          logDebug("Copy button cloned and attached for dollar format");
        }
        wrapper.appendChild(dollarWrapper);

        // Add single line expression label
        const displayLabel = document.createElement("p");
        displayLabel.textContent = "Single line expression";
        displayLabel.setAttribute("data-latex-addition", "true");
        displayLabel.style.marginTop = "0";
        displayLabel.style.marginBottom = "0.25rem";
        displayLabel.style.fontSize = "0.9em";
        wrapper.appendChild(displayLabel);

        // Add double dollar format with its own wrapper
        const doubleWrapper = document.createElement("div");
        doubleWrapper.className = "code-block-wrapper";
        doubleWrapper.setAttribute("data-latex-addition", "true");

        const doublePre = document.createElement("pre");
        doublePre.className = "code-block-container language-latex";
        doublePre.tabIndex = 0;
        doublePre.dataset.originalCode = transformed.doubleDollarFormat;

        const doubleCode = document.createElement("code");
        doubleCode.className = "language-latex";
        this.controller.prismBridge?.applySyntaxHighlighting(
          doubleCode,
          "latex",
          transformed.doubleDollarFormat,
        );

        doublePre.appendChild(doubleCode);
        doubleWrapper.appendChild(doublePre);

        // Clone and attach copy button to WRAPPER (not pre) so it doesn't scroll with content
        const originalCopyBtnDouble =
          preElement.querySelector(".code-copy-button");
        if (originalCopyBtnDouble) {
          const doubleCopyBtn = originalCopyBtnDouble.cloneNode(true);

          // Attach click handler to copy the double dollar format
          doubleCopyBtn.addEventListener("click", async () => {
            const originalContent = doubleCopyBtn.innerHTML;
            try {
              await navigator.clipboard.writeText(
                transformed.doubleDollarFormat,
              );
              // Match MarkdownCodeCopy behavior
              doubleCopyBtn.innerHTML = `${
                doubleCopyBtn.querySelector("svg").outerHTML
              } Copied`;
              setTimeout(() => {
                doubleCopyBtn.innerHTML = originalContent;
              }, 2000);
              logDebug("Double dollar format copied to clipboard");
            } catch (error) {
              doubleCopyBtn.innerHTML = `${
                doubleCopyBtn.querySelector("svg").outerHTML
              } Failed to copy`;
              setTimeout(() => {
                doubleCopyBtn.innerHTML = originalContent;
              }, 2000);
              logError("Failed to copy double dollar format", error);
            }
          });

          doubleWrapper.appendChild(doubleCopyBtn);
          logDebug("Copy button cloned and attached for double format");
        }
        wrapper.appendChild(doubleWrapper);

        logInfo(
          "Added dollar and double-dollar LaTeX formats with labels and copy buttons (LaTeX delimiters selected)",
        );
      } else {
        logInfo(
          "Skipped MS Word conversion section - Markdown delimiters already selected by user",
        );
      }
    } catch (error) {
      logError("Failed to add alternative LaTeX formats", error);
      // Fallback - just show original
      this.applySingleLatexFormat(contentElement, latexContent);
    }
  }

  /**
   * Apply single LaTeX format (fallback when transformation fails)
   * @param {HTMLElement} contentElement - The content element
   * @param {string} latexContent - The LaTeX content
   */
  applySingleLatexFormat(contentElement, latexContent) {
    logDebug("Applying single LaTeX format (fallback mode)");

    // Apply syntax highlighting using Prism bridge
    const highlightingSuccess =
      this.controller.prismBridge?.applySyntaxHighlighting(
        contentElement,
        "latex",
        latexContent,
      );

    // Set up copy button
    const preElement = contentElement.parentElement;
    if (preElement && preElement.tagName === "PRE") {
      preElement.dataset.originalCode = latexContent;
      preElement.classList.add("code-block-container");

      if (
        window.MarkdownCodeCopy &&
        typeof window.MarkdownCodeCopy.init === "function"
      ) {
        window.MarkdownCodeCopy.init(preElement.parentElement);
      }
    }

    logDebug("Single LaTeX format applied (fallback)", {
      syntaxHighlighting: highlightingSuccess,
    });
  }

  /**
   * Populate table format content with proper rendering and export options
   * @param {string} format - Format type (table-html, table-markdown, table-tsv)
   * @param {string} content - Table content
   * @param {HTMLElement} contentElement - Target element
   */
  populateTableFormat(format, content, contentElement) {
    // Store original table HTML for styling toggle functionality
    if (format === "table-html") {
      this.controller.originalTableHtml = content;
      logDebug("Original table HTML stored for styling toggle");
    }
    logDebug(`Populating table format: ${format}`, {
      contentLength: content.length,
    });

    const preElement = contentElement.parentElement;
    const wrapper = preElement?.parentElement;

    if (!wrapper) {
      logWarn("No wrapper element found for table format");
      return;
    }

    try {
      // Clean up previous content
      const previousAdditions = wrapper.querySelectorAll(
        '[data-table-addition="true"]',
      );
      previousAdditions.forEach((el) => el.remove());

      // Determine display approach based on format
      switch (format) {
        case "table-html":
          this.renderTableHtml(content, contentElement, wrapper);
          break;
        case "table-markdown":
          this.renderTableMarkdown(content, contentElement, wrapper);
          break;
        case "table-tsv":
          this.renderTableTsv(content, contentElement, wrapper);
          break;
      }

      // Add table-specific export options
      this.addTableExportOptions(format, content, wrapper);

      logInfo(`Table format ${format} populated successfully`);
    } catch (error) {
      logError(`Failed to populate table format ${format}`, error);
      contentElement.textContent = `Error displaying ${format}: ${error.message}`;
    }
  }

  /**
   * Populate HTML format with automatic table accessibility enhancements
   * @param {string} content - HTML content that may contain tables
   * @param {HTMLElement} contentElement - Target element for content
   */
  populateHtmlFormatWithTableEnhancements(content, contentElement) {
    // Check if content contains tables
    const hasTable = /<table[^>]*>/i.test(content);

    if (hasTable) {
      logDebug("HTML format contains tables - applying ARIA enhancements");

      // Parse HTML to enhance tables
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, "text/html");
      const tables = doc.querySelectorAll("table");

      // Enhance each table with ARIA
      tables.forEach((table, index) => {
        this.enhanceTableAccessibility(table);
        logDebug(`Enhanced table ${index + 1} in HTML format`);
      });

      // Get the enhanced HTML
      content = doc.body.innerHTML;
    }

    // Apply standard syntax highlighting
    const highlightingSuccess =
      this.controller.prismBridge?.applySyntaxHighlighting(
        contentElement,
        "html",
        content,
      );

    // Prepare for existing MarkdownCodeCopy system
    const preElement = contentElement.parentElement;
    if (preElement && preElement.tagName === "PRE") {
      preElement.dataset.originalCode = content;
      preElement.classList.add("code-block-container");

      if (
        window.MarkdownCodeCopy &&
        typeof window.MarkdownCodeCopy.init === "function"
      ) {
        window.MarkdownCodeCopy.init(preElement.parentElement);
        logDebug(`Integrated HTML format with copy button system`);
      }
    }

    logDebug(`HTML format populated successfully`, {
      length: content.length,
      syntaxHighlighting: highlightingSuccess,
      tablesEnhanced: hasTable,
    });
  }

  /**
   * Render HTML table with preview
   */
  renderTableHtml(content, contentElement, wrapper) {
    // Count table rows for performance optimisation
    const rowCount = (content.match(/<tr>/g) || []).length;
    const isLargeTable = rowCount > 50;

    if (isLargeTable) {
      this.showNotification(
        `Large table detected (${rowCount} rows). Preview may take a moment to render.`,
        "info",
      );
    }

    // Add preview section
    const previewLabel = document.createElement("p");
    previewLabel.textContent = "Table Preview:";
    previewLabel.setAttribute("data-table-addition", "true");
    previewLabel.style.fontWeight = "600";
    previewLabel.style.marginBottom = "0.5rem";
    wrapper.insertBefore(previewLabel, contentElement.parentElement);

    // Create preview container with processed HTML (applies user styling preference)
    const previewContainer = document.createElement("div");
    previewContainer.className = "table-preview-container";
    previewContainer.setAttribute("data-table-addition", "true");

    // Apply styling preference to preview
    let processedHtml = this.getProcessedTableHtml(content);

    // Always unhide asciimath in PREVIEW for visual display
    // (code block keeps original formatting based on checkbox)
    const parser = new DOMParser();
    const previewDoc = parser.parseFromString(processedHtml, "text/html");

    // Unhide asciimath tags for currency display
    const asciimathTags = previewDoc.querySelectorAll("asciimath");
    asciimathTags.forEach((tag) => {
      tag.setAttribute("style", "display: inline;");
    });

    // Ensure mathml and latex stay hidden
    const mathmlTags = previewDoc.querySelectorAll("mathml");
    mathmlTags.forEach((tag) => {
      tag.setAttribute("style", "display: none;");
    });

    const latexTags = previewDoc.querySelectorAll("latex");
    latexTags.forEach((tag) => {
      tag.setAttribute("style", "display: none;");
    });

    previewContainer.innerHTML = previewDoc.body.innerHTML;

    logDebug("Table preview prepared with currency visibility", {
      asciimathUnhidden: asciimathTags.length,
      mathmlHidden: mathmlTags.length,
      latexHidden: latexTags.length,
    });

    previewContainer.style.marginBottom = "1rem";
    previewContainer.style.overflow = "auto";

    // Enhance table accessibility with ARIA attributes
    const table = previewContainer.querySelector("table");
    if (table) {
      const enhanceSuccess = this.enhanceTableAccessibility(table);
      if (enhanceSuccess) {
        logInfo("Table accessibility enhancements applied to preview");
      }
    }

    wrapper.insertBefore(previewContainer, contentElement.parentElement);

    // Process any mathematics within table cells (fire-and-forget)
    if (window.mathJaxManager) {
      window.mathJaxManager
        .queueTypeset(previewContainer)
        .then(() => logDebug("MathJax processed table format preview"))
        .catch((error) =>
          logWarn("Failed to process math in table format preview", error),
        );
    } else if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([previewContainer]).catch((error) =>
        logWarn("Failed to process math in table format preview", error),
      );
    }

    // Add source code section
    const sourceLabel = document.createElement("p");
    sourceLabel.textContent = "HTML Source:";
    sourceLabel.setAttribute("data-table-addition", "true");
    sourceLabel.style.fontWeight = "600";
    sourceLabel.style.marginBottom = "0.5rem";
    wrapper.insertBefore(sourceLabel, contentElement.parentElement);

    // Apply syntax highlighting to HTML source (with styling preference)
    const sourceHtml = this.getProcessedTableHtml(content);
    this.controller.prismBridge?.applySyntaxHighlighting(
      contentElement,
      "html",
      sourceHtml,
    );

    // Set up copy functionality (uses processed HTML)
    const preElement = contentElement.parentElement;
    if (preElement) {
      preElement.dataset.originalCode = sourceHtml;
    }
  }

  /**
   * Render Markdown table
   */
  renderTableMarkdown(content, contentElement, wrapper) {
    const label = document.createElement("p");
    label.textContent = "Markdown Table Format:";
    label.setAttribute("data-table-addition", "true");
    label.style.fontWeight = "600";
    label.style.marginBottom = "0.5rem";
    wrapper.insertBefore(label, contentElement.parentElement);

    // Apply syntax highlighting
    this.controller.prismBridge?.applySyntaxHighlighting(
      contentElement,
      "markdown",
      content,
    );

    const preElement = contentElement.parentElement;
    if (preElement) {
      preElement.dataset.originalCode = content;
    }
  }

  /**
   * Render TSV (Tab-Separated Values)
   */
  renderTableTsv(content, contentElement, wrapper) {
    const label = document.createElement("p");
    label.textContent = "Tab-Separated Values (TSV):";
    label.setAttribute("data-table-addition", "true");
    label.style.fontWeight = "600";
    label.style.marginBottom = "0.5rem";
    wrapper.insertBefore(label, contentElement.parentElement);

    // Show TSV with basic formatting
    contentElement.textContent = content;
    contentElement.style.fontFamily = "monospace";
    contentElement.style.whiteSpace = "pre";

    const preElement = contentElement.parentElement;
    if (preElement) {
      preElement.dataset.originalCode = content;
    }
  }

  /**
   * Enhance table accessibility with ARIA attributes
   * Safe improvements that work for all table structures
   * @param {HTMLElement} table - Table element to enhance
   * @returns {boolean} True if enhancement successful
   */
  enhanceTableAccessibility(table) {
    if (!table) {
      logWarn("No table provided for accessibility enhancement");
      return false;
    }

    try {
      // Add table role if not present
      if (!table.hasAttribute("role")) {
        table.setAttribute("role", "table");
      }

      // Add caption for screen readers if missing
      if (!table.querySelector("caption")) {
        // Add developer note as HTML comment
        const note = document.createComment(`
  ACCESSIBILITY NOTE: This table has basic ARIA enhancements applied automatically.
  
  REQUIRED: Customise the caption below to describe this specific table's content.
  
  RECOMMENDED: Further semantic improvements:
  - Convert first row to <thead> with <th> elements if it contains headers
  - Add scope="col" or scope="row" to <th> elements
  - Consider adding a summary for complex tables
  - Verify ARIA roles match your table structure
  
  The caption below is visually hidden (sr-only) but announced by screen readers.
`);
        table.insertBefore(note, table.firstChild);

        const caption = document.createElement("caption");
        caption.textContent = "Table extracted from image via MathPix OCR";
        caption.className = "sr-only"; // Screen reader only
        caption.style.position = "absolute";
        caption.style.width = "1px";
        caption.style.height = "1px";
        caption.style.padding = "0";
        caption.style.margin = "-1px";
        caption.style.overflow = "hidden";
        caption.style.clip = "rect(0, 0, 0, 0)";
        caption.style.whiteSpace = "nowrap";
        caption.style.border = "0";
        table.insertBefore(caption, table.firstChild.nextSibling);
        logDebug("Added screen reader caption to table with developer note");
      }
      // Add row roles
      const rows = table.querySelectorAll("tr");
      rows.forEach((row) => {
        if (!row.hasAttribute("role")) {
          row.setAttribute("role", "row");
        }
      });

      // Add cell roles to all td elements
      const cells = table.querySelectorAll("td");
      cells.forEach((cell) => {
        if (!cell.hasAttribute("role")) {
          cell.setAttribute("role", "cell");
        }
      });

      // Add cell roles to any th elements (unlikely but possible)
      const headers = table.querySelectorAll("th");
      headers.forEach((header) => {
        if (!header.hasAttribute("role")) {
          const scope = header.getAttribute("scope");
          if (scope === "row") {
            header.setAttribute("role", "rowheader");
          } else {
            header.setAttribute("role", "columnheader");
          }
        }
      });

      // Add keyboard navigation hint
      table.setAttribute(
        "aria-label",
        "Use arrow keys to navigate table cells",
      );

      logDebug("Table accessibility enhanced", {
        rows: rows.length,
        cells: cells.length,
        headers: headers.length,
        hasCaption: !!table.querySelector("caption"),
      });

      return true;
    } catch (error) {
      logError("Failed to enhance table accessibility", error);
      return false;
    }
  }

  /**
   * Remove inline styles from table HTML
   * Allows users to apply custom CSS styling
   * @param {string} tableHtml - Original table HTML with inline styles
   * @returns {string} Clean table HTML without inline styles
   */
  stripInlineTableStyles(tableHtml) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(tableHtml, "text/html");
      const table = doc.querySelector("table");

      if (!table) {
        logWarn("No table found in HTML for style stripping");
        return tableHtml;
      }

      // Remove inline styles from table and all descendants
      const elementsWithStyles = table.querySelectorAll("[style]");
      let removedCount = 0;

      elementsWithStyles.forEach((element) => {
        element.removeAttribute("style");
        removedCount++;
      });

      // Re-hide mathml and latex tags to prevent triple display of currency
      // Only asciimath should be visible when styles are stripped
      const mathmlElements = table.querySelectorAll("mathml");
      mathmlElements.forEach((element) => {
        element.setAttribute("style", "display: none;");
      });

      const latexElements = table.querySelectorAll("latex");
      latexElements.forEach((element) => {
        element.setAttribute("style", "display: none;");
      });

      logDebug("Re-hidden mathml and latex tags after style stripping", {
        mathmlCount: mathmlElements.length,
        latexCount: latexElements.length,
      });

      // Also remove style classes that might contain inline-like styling
      const elementsWithClasses = table.querySelectorAll("[class]");
      elementsWithClasses.forEach((element) => {
        // Keep structural classes, remove styling classes
        const classes = element.className.split(" ");
        const keepClasses = classes.filter((cls) => {
          // Keep: structural, semantic, utility classes
          // Remove: presentation-specific classes
          return !cls.match(
            /(border|padding|margin|color|background|text-align|width|height)/i,
          );
        });

        if (keepClasses.length > 0) {
          element.className = keepClasses.join(" ");
        } else {
          element.removeAttribute("class");
        }
      });

      const cleanHtml = table.outerHTML;

      logInfo("Table inline styles stripped", {
        originalLength: tableHtml.length,
        cleanedLength: cleanHtml.length,
        stylesRemoved: removedCount,
        reductionPercent: Math.round(
          (1 - cleanHtml.length / tableHtml.length) * 100,
        ),
      });

      return cleanHtml;
    } catch (error) {
      logError("Failed to strip inline table styles", error);
      return tableHtml; // Return original on error
    }
  }

  /**
   * Get current table HTML with optional style stripping and ARIA enhancement
   * Processes table for copyable source code with accessibility improvements
   * @param {string} originalHtml - Original table HTML from MathPix
   * @returns {string} Processed table HTML (with ARIA, styled or clean based on preference)
   */
  getProcessedTableHtml(originalHtml) {
    const preserveStylesCheckbox = document.getElementById(
      "mathpix-preserve-table-styles",
    );
    const shouldPreserveStyles = preserveStylesCheckbox
      ? preserveStylesCheckbox.checked
      : true;

    // Step 1: Handle styling preference
    let processedHtml = shouldPreserveStyles
      ? originalHtml
      : this.stripInlineTableStyles(originalHtml);

    // Step 2: Add ARIA enhancements to source code for accessibility
    processedHtml = this.addAriaToTableHtml(processedHtml);

    logDebug("Table HTML processed for source code", {
      preservedStyles: shouldPreserveStyles,
      ariaEnhanced: true,
    });

    return processedHtml;
  }

  /**
   * Add ARIA attributes to table HTML string (for source code)
   * Creates accessible HTML that users can copy and use
   * @param {string} tableHtml - Table HTML to enhance
   * @returns {string} Table HTML with ARIA attributes
   */
  addAriaToTableHtml(tableHtml) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(tableHtml, "text/html");
      const table = doc.querySelector("table");

      if (!table) {
        logWarn("No table found in HTML for ARIA enhancement");
        return tableHtml;
      }

      // Apply same enhancements as preview
      this.enhanceTableAccessibility(table);

      // Return enhanced HTML
      const enhancedHtml = table.outerHTML;

      logDebug("ARIA attributes added to source code", {
        originalLength: tableHtml.length,
        enhancedLength: enhancedHtml.length,
      });

      return enhancedHtml;
    } catch (error) {
      logError("Failed to add ARIA to table HTML", error);
      return tableHtml; // Return original on error
    }
  }

  /**
   * Add table-specific export options
   */
  addTableExportOptions(format, content, wrapper) {
    const exportContainer = document.createElement("div");
    exportContainer.className = "table-export-options";
    exportContainer.setAttribute("data-table-addition", "true");
    exportContainer.style.marginTop = "1rem";
    exportContainer.style.display = "flex";
    exportContainer.style.gap = "0.5rem";

    // Download button
    const downloadBtn = document.createElement("button");
    downloadBtn.className = "action-button";
    downloadBtn.innerHTML =
      '<svg aria-hidden="true" height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)"><path d="m2.5.5h7l3 3v7c0 1.1045695-.8954305 2-2 2h-8c-1.1045695 0-2-.8954305-2-2v-8c0-1.1045695.8954305-2 2-2z"/><path d="m4.50000081 8.5h4c.55228475 0 1 .44771525 1 1v3h-6v-3c0-.55228475.44771525-1 1-1z"/><path d="m3.5 3.5h2v2h-2z"/></g></svg> Download';
    downloadBtn.onclick = () => this.downloadTableFormat(format, content);

    // Copy button
    const copyBtn = document.createElement("button");
    copyBtn.className = "action-button";
    copyBtn.innerHTML =
      '<svg aria-hidden="true" height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 3)"><path d="m3.5 1.5c-.44119105-.00021714-1.03893772-.0044496-1.99754087-.00501204-.51283429-.00116132-.93645365.3838383-.99544161.88103343l-.00701752.11906336v10.99753785c.00061498.5520447.44795562.9996604 1 1.0006148l10 .0061982c.5128356.0008356.9357441-.3849039.993815-.882204l.006185-.1172316v-11c0-.55228475-.4477152-1-1-1-.8704853-.00042798-1.56475733.00021399-2 0"/><path d="m4.5.5h4c.55228475 0 1 .44771525 1 1s-.44771525 1-1 1h-4c-.55228475 0-1-.44771525-1-1s.44771525-1 1-1z"/><path d="m2.5 5.5h5"/><path d="m2.5 7.5h7"/><path d="m2.5 9.5h3"/><path d="m2.5 11.5h6"/></g></svg> Copy';
    copyBtn.onclick = () => this.copyTableToClipboard(content, format);

    exportContainer.appendChild(downloadBtn);
    exportContainer.appendChild(copyBtn);

    wrapper.appendChild(exportContainer);
  }

  /**
   * Download table in specified format
   */
  downloadTableFormat(format, content) {
    const extension =
      format === "table-html"
        ? "html"
        : format === "table-markdown"
          ? "md"
          : "tsv";

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `table.${extension}`;
    a.click();
    URL.revokeObjectURL(url);

    this.showNotification(
      `Table downloaded as ${extension.toUpperCase()}`,
      "success",
    );
  }

  /**
   * Copy table content to clipboard
   */
  async copyTableToClipboard(content, format) {
    try {
      await navigator.clipboard.writeText(content);
      this.showNotification("Table copied to clipboard!", "success");
    } catch (error) {
      this.showNotification("Failed to copy table", "error");
      logError("Table copy failed", error);
    }
  }

  /**
   * Show specific format panel.
   *
   * WARNING — two independent tab-switching systems exist in this codebase:
   *
   *   1. This one (mathpix-result-renderer.js `showFormat`) manages the
   *      canonical upload-mode panels. It uses `.selected` on tab buttons
   *      (not `.active`) and `.active` on panels via the cached
   *      `formatPanels` map, matching by `tab.dataset.format`.
   *
   *   2. The resume-mode system is
   *      core/session-restorer/session-restorer-pdf.js `switchTab`, which
   *      uses `.active` on buttons AND panels, plus `aria-selected` via
   *      direct setAttribute, plus `panel.hidden`.
   *
   * If you add a new format or a new mode, you MUST update BOTH systems,
   * OR document in a comment why only one is affected. Cross-system state
   * leaks were the root cause of the 8A-8 regression where resume tab
   * buttons kept stale `.active` classes after upload-mode tab switching.
   * See mathpix-scripts/docs/chemistry-phase8-masterplan.md § 8A-8.
   *
   * This duplication is a candidate for consolidation in a future phase
   * (8F or 9). Do NOT introduce more duplicate conventions.
   *
   * @param {string} format - Format to show
   */
  showFormat(format) {
    // Phase 8A-9: guard against falsy format (e.g. from unscoped query
    // matching a resume tab with no data-format attribute)
    if (!format) {
      logWarn("showFormat called with falsy format — aborting", { format });
      return;
    }

    logInfo(`Switching to format: ${format}`);

    // Phase 8A-9: scope tab query to upload output container to avoid
    // accidentally mutating resume/PDF tabs that share the same CSS class.
    // Fallback to document for safety if the container isn't cached yet.
    const tabScope = this.elements["output-container"] || document;
    const allTabs = tabScope.querySelectorAll(
      '.mathpix-tab-header[role="tab"]',
    );
    allTabs.forEach((tab) => {
      const isSelected = tab.dataset.format === format;
      tab.setAttribute("aria-selected", isSelected.toString());
      // WCAG: Only selected tab should be in tab order
      tab.setAttribute("tabindex", isSelected ? "0" : "-1");
      if (isSelected) {
        tab.classList.add("selected");
      } else {
        tab.classList.remove("selected");
      }
    });

    // Update all panels - show/hide and set aria-hidden
    Object.entries(this.elements.formatPanels || {}).forEach(([fmt, panel]) => {
      if (panel) {
        const isVisible = fmt === format;

        // Toggle active class for CSS styling
        if (isVisible) {
          panel.classList.add("active");
        } else {
          panel.classList.remove("active");
        }

        // Set aria-hidden for screen readers
        panel.setAttribute("aria-hidden", (!isVisible).toString());

        // Remove tabindex from hidden panels, add to visible panel
        if (isVisible) {
          panel.setAttribute("tabindex", "0");
        } else {
          panel.removeAttribute("tabindex");
        }
      }
    });

    // Update current format
    this.currentFormat = format;

    logDebug(`Format switched to: ${format}`, {
      panelVisible:
        this.elements.formatPanels?.[format]?.classList.contains("active"),
      tabSelected:
        document
          .getElementById(`mathpix-tab-${format}`)
          ?.getAttribute("aria-selected") === "true",
    });
  }

  // Skip link method removed - arrow key navigation provides direct access to content

  /**
   * Reset all format options to available state
   */
  resetFormatOptions() {
    // Phase 8A-9: scope to upload output container to avoid resetting
    // resume/PDF tabs that share the same CSS class
    const tabScope = this.elements["output-container"] || document;
    tabScope
      .querySelectorAll('.mathpix-tab-header[role="tab"]')
      .forEach((tab) => {
        tab.classList.remove("unavailable");
        tab.removeAttribute("aria-disabled");
        tab.style.display = ""; // Show all tabs initially
      });

    // Hide table tabs by default (shown only when tables detected)
    const tableTabs = [
      "mathpix-tab-table-html",
      "mathpix-tab-table-markdown",
      "mathpix-tab-table-tsv",
    ];
    tableTabs.forEach((tabId) => {
      const tab = document.getElementById(tabId);
      if (tab) {
        tab.style.display = "none";
        tab.setAttribute("aria-disabled", "true");
      }
    });

    // Clear empty content styling
    Object.values(this.elements.formatContents || {}).forEach((element) => {
      if (element) {
        element.classList.remove("empty-content");
      }
    });

    logDebug("Format options reset, table tabs hidden by default");
  }

  /**
   * Select first available format and display it
   */
  selectFirstAvailableFormat() {
    // Phase 8A-9: scope to upload output container to avoid matching
    // resume tabs (which lack data-format, producing showFormat(undefined))
    const tabScope = this.elements["output-container"] || document;
    const availableTab = tabScope.querySelector(
      '.mathpix-tab-header[role="tab"]:not([aria-disabled="true"]):not([style*="display: none"])',
    );
    if (availableTab) {
      const format = availableTab.dataset.format;
      this.showFormat(format);
      logDebug(`Auto-selected first available format: ${format}`);
    } else {
      // Fallback to JSON which should always be available
      this.showFormat("json");
    }
  }

  /**
   * Update metadata display
   * @param {Object} result - Processing result
   */
  updateMetadata(result) {
    // Update confidence
    if (this.elements.confidence) {
      const confidencePercent = Math.round((result.confidence || 0) * 100);
      this.elements.confidence.textContent = `${confidencePercent}%`;
    }

    // Update type
    if (this.elements.type) {
      const types = [];
      if (result.isHandwritten) types.push("Handwritten");
      if (result.isPrinted) types.push("Printed");
      if (result.containsTable) types.push("Contains Table");
      this.elements.type.textContent = types.join(", ") || "Unknown";
    }

    // Update available formats
    if (this.elements.formats) {
      const availableFormats = [];
      if (result.latex) availableFormats.push("LaTeX");
      if (result.mathml) availableFormats.push("MathML");
      if (result.asciimath) availableFormats.push("AsciiMath");
      if (result.html) availableFormats.push("HTML");
      if (result.markdown) availableFormats.push("Markdown");

      // Add table formats if available
      if (result.tableHtml) availableFormats.push("Table (HTML)");
      if (result.tableMarkdown) availableFormats.push("Table (Markdown)");
      if (result.tsv) availableFormats.push("Table (TSV)");

      availableFormats.push("JSON"); // Always available

      this.elements.formats.textContent = availableFormats.join(", ");
    }
  }

  // =============================================================================
  // PHASE 3.2: LINE DATA DISPLAY METHODS
  // =============================================================================

  /**
   * Display line-level processing data
   * @param {Array} lineData - Line data array from MathPix API response
   */
  displayLineData(lineData) {
    logInfo("Displaying line data", {
      lineCount: lineData?.length || 0,
      hasData: !!lineData && lineData.length > 0,
    });

    // Get line data section element
    const lineDataSection = document.getElementById(
      "mathpix-line-data-section",
    );
    const lineDataContent = document.getElementById(
      "mathpix-line-data-content",
    );

    if (!lineDataSection || !lineDataContent) {
      logWarn("Line data section elements not found in DOM");
      return;
    }

    // Check if line data is available
    if (!lineData || !Array.isArray(lineData) || lineData.length === 0) {
      logInfo("No line data available to display");
      lineDataSection.hidden = true;
      return;
    }

    try {
      // Clear previous content
      lineDataContent.innerHTML = "";

      // Create summary section
      const summaryHtml = this.createLineDataSummary(lineData);
      lineDataContent.appendChild(summaryHtml);

      // Create details section
      const detailsHtml = this.createLineDataDetails(lineData);
      lineDataContent.appendChild(detailsHtml);

      // Show the section
      lineDataSection.hidden = false;

      logInfo("Line data displayed successfully", {
        totalLines: lineData.length,
        includedLines: lineData.filter((line) => line.conversion_output).length,
        excludedLines: lineData.filter((line) => !line.conversion_output)
          .length,
      });
    } catch (error) {
      logError("Failed to display line data", error);
      this.showNotification("Failed to display processing details", "error");
      lineDataSection.hidden = true;
    }
  }

  /**
   * Create line data summary with statistics
   * @param {Array} lineData - Line data array
   * @returns {HTMLElement} Summary container element
   */
  createLineDataSummary(lineData) {
    const summaryContainer = document.createElement("div");
    summaryContainer.className = "line-data-summary";

    // Calculate statistics
    const totalLines = lineData.length;
    const includedLines = lineData.filter(
      (line) => line.conversion_output,
    ).length;
    const excludedLines = totalLines - includedLines;

    // Count by type
    const typeCounts = {};
    const excludedTypes = {};

    lineData.forEach((line) => {
      const type = line.type || "unknown";

      if (!typeCounts[type]) {
        typeCounts[type] = 0;
        excludedTypes[type] = 0;
      }

      typeCounts[type]++;

      if (!line.conversion_output) {
        excludedTypes[type]++;
      }
    });

    // Create summary heading
    const heading = document.createElement("h4");
    heading.textContent = "Processing Summary:";
    heading.style.marginTop = "0";
    heading.style.marginBottom = "0.75rem";
    summaryContainer.appendChild(heading);

    // Create summary list
    const summaryList = document.createElement("ul");
    summaryList.className = "line-data-summary-list";
    summaryList.style.listStyle = "none";
    summaryList.style.padding = "0";
    summaryList.style.margin = "0";

    // Add type summaries
    Object.keys(typeCounts).forEach((type) => {
      const count = typeCounts[type];
      const excluded = excludedTypes[type];
      const included = count - excluded;

      const item = document.createElement("li");
      item.style.marginBottom = "0.5rem";

      const typeLabel = this.getTypeLabel(type);

      if (excluded > 0) {
        item.innerHTML = `${getIcon("bullet")} ${count} ${typeLabel}${
          count > 1 ? "s" : ""
        } (${included} included, ${excluded} excluded)`;
      } else {
        item.innerHTML = `${getIcon("bullet")} ${count} ${typeLabel}${
          count > 1 ? "s" : ""
        } (all included)`;
      }

      summaryList.appendChild(item);
    });

    summaryContainer.appendChild(summaryList);

    logDebug("Line data summary created", {
      totalLines,
      includedLines,
      excludedLines,
      typeCount: Object.keys(typeCounts).length,
    });

    return summaryContainer;
  }

  /**
   * Create detailed line data breakdown
   * @param {Array} lineData - Line data array
   * @returns {HTMLElement} Details container element
   */
  createLineDataDetails(lineData) {
    const detailsContainer = document.createElement("div");
    detailsContainer.className = "line-data-details";
    detailsContainer.style.marginTop = "1.5rem";

    // Create details heading
    const heading = document.createElement("h4");
    heading.textContent = "Element Details:";
    heading.style.marginTop = "0";
    heading.style.marginBottom = "0.75rem";
    detailsContainer.appendChild(heading);

    // Create details list
    const detailsList = document.createElement("ul");
    detailsList.className = "line-data-details-list";
    detailsList.style.listStyle = "none";
    detailsList.style.padding = "0";
    detailsList.style.margin = "0";

    // Add each line
    lineData.forEach((line, index) => {
      const item = document.createElement("li");
      item.className = "line-data-item";
      item.style.marginBottom = "1rem";
      item.style.paddingBottom = "1rem";
      item.style.borderBottom = "1px solid var(--border-color, #e0e0e0)";

      // Status indicator and type
      const statusIcon = line.conversion_output
        ? getIcon("check")
        : getIcon("warning");
      const statusText = line.conversion_output ? "Included" : "Excluded";
      const typeLabel = this.getTypeLabel(line.type, line.subtype);

      const header = document.createElement("div");
      header.style.fontWeight = "600";
      header.style.marginBottom = "0.25rem";
      header.innerHTML = `${statusIcon} Line ${index + 1}: ${typeLabel}`;

      // Add screen reader text for status
      const srStatus = document.createElement("span");
      srStatus.className = "sr-only";
      srStatus.textContent = ` (${statusText})`;
      header.appendChild(srStatus);

      item.appendChild(header);

      // Add confidence if included
      if (line.conversion_output && line.confidence !== undefined) {
        const confidenceText = document.createElement("div");
        confidenceText.style.fontSize = "0.9em";
        confidenceText.style.marginBottom = "0.25rem";

        const confidenceLevel = this.getConfidenceLevel(line.confidence);
        const confidencePercent = Math.round(line.confidence * 100);

        confidenceText.textContent = `Confidence: ${confidencePercent}% (${confidenceLevel})`;
        item.appendChild(confidenceText);
      }

      // Add exclusion reason if excluded
      if (!line.conversion_output && line.error_id) {
        const reasonText = document.createElement("div");
        reasonText.style.fontSize = "0.9em";
        reasonText.style.color = "var(--warning-color, #856404)";
        reasonText.style.marginTop = "0.25rem";

        const reasonLabel = this.getErrorReason(line.error_id);
        reasonText.textContent = `Excluded: ${reasonLabel}`;
        item.appendChild(reasonText);
      }

      detailsList.appendChild(item);
    });

    detailsContainer.appendChild(detailsList);

    logDebug("Line data details created", {
      itemCount: lineData.length,
    });

    return detailsContainer;
  }

  /**
   * Get confidence level classification
   * @param {number} confidence - Confidence value (0-1)
   * @returns {string} Confidence level description
   */
  getConfidenceLevel(confidence) {
    if (confidence >= 0.95) return "Very High";
    if (confidence >= 0.85) return "High";
    if (confidence >= 0.7) return "Medium";
    return "Low";
  }

  /**
   * Populate chemistry format with SMILES notation data
   * @param {Array<Object>} smilesArray - Array of SMILES data objects
   */
  populateChemistryFormat(smilesArray) {
    if (!Array.isArray(smilesArray) || smilesArray.length === 0) {
      logDebug("No SMILES data to display");
      return;
    }

    // Store chemistry data for navigation
    this._chemistryData = smilesArray;
    this._currentStructureIndex = 0;

    // Populate legacy element for backwards compatibility
    const legacyElement = document.getElementById("mathpix-content-smiles");
    if (legacyElement) {
      const legacyText = smilesArray
        .map((item, i) => `// Structure ${i + 1}\nSMILES: ${item.notation}`)
        .join("\n\n");
      legacyElement.textContent = legacyText;
    }

    // Display first structure
    this._displayChemistryStructure(0);

    // Show/hide structure selector based on count
    const selector = document.getElementById("chemistry-structure-selector");
    if (selector) {
      selector.style.display = smilesArray.length > 1 ? "" : "none";
    }

    // Set up navigation buttons
    this._setupChemistryNavigation();

    // Phase 7C-2: Set up rendering preset selector
    this._setupChemistryPresetSelector();

    // Phase 7C-3: Set up advanced rendering controls
    this._setupChemistryAdvancedControls();

    // Set up action buttons
    this._setupChemistryActions();

    // Phase 6D: Set initial heading (count-based; names update as lookups resolve)
    this._updateChemistryHeading();

    // Announce to screen readers
    const liveRegion = document.getElementById("chemistry-live-region");
    if (liveRegion) {
      const count = smilesArray.length;
      liveRegion.textContent =
        count === 1
          ? "One chemical structure detected"
          : `${count} chemical structures detected`;
    }

    logInfo("Chemistry format populated", {
      structureCount: smilesArray.length,
      notations: smilesArray.map((s) => s.notation),
    });

    // Phase 7A-4: Background pre-fetch PubChem data + structural descriptions
    // for all structures so navigation is instant and accessible
    if (smilesArray.length > 1) {
      this._prefetchAllChemistryData().catch((err) => {
        logWarn("Background chemistry pre-fetch failed", { error: err.message });
      });
    }
  }

  /**
   * Phase 7A-4: Pre-fetch PubChem data and structural descriptions for all
   * chemistry structures in the background. Runs after the first structure is
   * displayed, so the user can navigate to any structure without waiting.
   *
   * PubChem utils have a session cache, so concurrent calls for the same key
   * are deduplicated at the network level. Structural descriptions are cached
   * per-item on `_structuralDescription`.
   *
   * @private
   */
  async _prefetchAllChemistryData() {
    const data = this._chemistryData;
    if (!Array.isArray(data) || data.length === 0) return;

    const utils = window.MathPixChemistryUtils;
    if (!utils) return;

    // Run all items in parallel — PubChem cache dedupes network calls
    const promises = data.map((item, index) =>
      this._prefetchPubChemForItem(item, index),
    );
    await Promise.allSettled(promises);

    logInfo("Background chemistry pre-fetch complete", {
      count: data.length,
      resolved: data.filter((i) => i._pubchemResolved).length,
      withDescription: data.filter((i) => i._structuralDescription).length,
    });
  }

  /**
   * Phase 7A-4: Pre-fetch PubChem data for a single item and cache it on the
   * item object. Does not touch the DOM — that happens later via
   * `_lookupAndPopulateName` when the user navigates to the structure.
   *
   * After PubChem resolves, attempts to generate the structural description
   * if the molecular graph is already cached (e.g. from the MMD preview's
   * `renderStructureToBlob` call). If the graph isn't ready, the description
   * will be generated when the user navigates to the structure.
   *
   * @param {Object} item - Chemistry data item
   * @param {number} index - Index in _chemistryData (for logging)
   * @private
   */
  async _prefetchPubChemForItem(item, index) {
    if (item._pubchemResolved) return;

    const utils = window.MathPixChemistryUtils;
    if (!utils) return;

    try {
      let result = null;
      if (item.inchiKey && utils.lookupPubChem) {
        result = await utils.lookupPubChem(item.inchiKey);
      } else if (item.notation && utils.lookupPubChemBySmiles) {
        result = await utils.lookupPubChemBySmiles(item.notation);
      } else {
        item._pubchemResolved = true;
        return;
      }

      item._pubchemResolved = true;

      if (result && result.found) {
        // Cache data on the item so _displayChemistryStructure / _lookupAndPopulate*
        // have access when the user navigates here
        const commonName = result.commonNames?.[0];
        if (commonName || result.iupacName) {
          item._resolvedName = commonName || result.iupacName;
        }
        if (result.commonNames) item.commonNames = result.commonNames;
        if (result.iupacName) item.iupacName = result.iupacName;
        if (result.molecularWeight) item.molecularWeight = result.molecularWeight;
        if (result.pubchemUrl) item.pubchemUrl = result.pubchemUrl;
        if (result.pubchemCid) item.pubchemCid = result.pubchemCid;

        // Back-populate identifiers (PDF mode: item had notation but no inchi/inchiKey)
        if (!item.inchi && result.inchi) item.inchi = result.inchi;
        if (!item.inchiKey && result.inchiKey) item.inchiKey = result.inchiKey;
      }

      // Try to generate structural description if the molecular graph is
      // already cached (from the MMD preview's renderStructureToBlob).
      if (utils.generateStructuralDescription && !item._structuralDescription) {
        const pubchemData = {
          commonNames: item.commonNames || (item._resolvedName ? [item._resolvedName] : []),
          iupacName: item.iupacName || null,
          molecularWeight: item.molecularWeight || null,
          molecularFormula: item.molecularFormula || null,
          inchi: item.inchi || null,
        };
        let desc = utils.generateStructuralDescription(item.notation, pubchemData);

        // Phase 7A-5a: If desc is null the graph is not yet cached (race with
        // MMD preview rendering). Prime the cache by rendering to a throw-away
        // blob, then retry description generation.
        if (!desc && utils.renderStructureToBlob) {
          try {
            await utils.renderStructureToBlob(item.notation);
            desc = utils.generateStructuralDescription(item.notation, pubchemData);
            if (desc) {
              logDebug("Graph cache primed for structural description", {
                index,
                smiles: item.notation,
              });
            }
          } catch (primeError) {
            logDebug("Graph cache priming failed (non-blocking)", {
              index,
              smiles: item.notation,
              error: primeError.message,
            });
          }
        }

        if (desc) {
          item._structuralDescription = desc;
          logDebug("Background structural description generated", {
            index,
            smiles: item.notation,
          });
        }
      }
    } catch (error) {
      item._pubchemResolved = true;
      logDebug("Background PubChem pre-fetch failed for item", {
        index,
        notation: item.notation,
        error: error.message,
      });
    }
  }

  /**
   * Phase 7C-6: Restore chemistry rendering state from a chemistry-settings
   * manifest extracted from a resumed ZIP.
   *
   * Applies the global preset and (if applicable) customOptions, then walks
   * the manifest's perImageOverrides, matching each entry by SMILES against
   * `_chemistryData`. First-match-wins on duplicate SMILES (same rule as the
   * export side). Unmatched entries are logged but do not throw. After state
   * is written, re-syncs the currently-visible structure and re-renders its
   * canvas with the restored per-image options.
   *
   * Defensive throughout: the session-restore pipeline must not break if the
   * manifest is partial, corrupt, or references SMILES that no longer exist.
   *
   * @param {Object} manifest - Parsed manifest from readChemistrySettingsFromZip
   */
  /**
   * Phase 7C-7: Dispatch a `chemistry-settings-changed` event on document so
   * the MMD preview (and anything else interested) can re-enhance in response
   * to a genuine rendering-preference change. Safe to call repeatedly.
   *
   * @param {Object} [detail={}] - Event detail payload (e.g. { scope: "global" })
   * @private
   */
  _dispatchChemistrySettingsChanged(detail = {}) {
    try {
      document.dispatchEvent(
        new CustomEvent("chemistry-settings-changed", { detail }),
      );
    } catch (err) {
      logWarn("Failed to dispatch chemistry-settings-changed", {
        error: err.message,
      });
    }
  }

  restoreChemistryFromManifest(manifest) {
    if (!manifest || typeof manifest !== "object") {
      logWarn("restoreChemistryFromManifest: invalid manifest, skipping");
      return;
    }

    const utils = window.MathPixChemistryUtils;
    if (!utils) {
      logWarn("restoreChemistryFromManifest: chemistry utils unavailable");
      return;
    }

    // 1. Restore global preset
    if (
      typeof manifest.globalPreset === "string" &&
      typeof utils.setActivePreset === "function"
    ) {
      try {
        utils.setActivePreset(manifest.globalPreset);
      } catch (err) {
        logWarn("restoreChemistryFromManifest: setActivePreset failed", {
          error: err.message,
        });
      }
    }

    // 2. Restore customOptions when the global preset is "custom"
    if (
      manifest.globalPreset === "custom" &&
      manifest.customOptions &&
      typeof manifest.customOptions === "object" &&
      typeof utils.setCustomOptions === "function"
    ) {
      try {
        utils.setCustomOptions(manifest.customOptions);
      } catch (err) {
        logWarn("restoreChemistryFromManifest: setCustomOptions failed", {
          error: err.message,
        });
      }
    }

    // 3. Select the matching preset radio in the DOM (if rendered)
    if (typeof manifest.globalPreset === "string") {
      const presetRadio = document.querySelector(
        `input[name="chemistry-preset"][value="${manifest.globalPreset}"]`
      );
      if (presetRadio) presetRadio.checked = true;
    }

    // 4. Walk perImageOverrides and write back onto matching _chemistryData
    const overrides = Array.isArray(manifest.perImageOverrides)
      ? manifest.perImageOverrides
      : [];
    const data = Array.isArray(this._chemistryData) ? this._chemistryData : [];
    const claimed = new Set();
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (const entry of overrides) {
      if (!entry || typeof entry !== "object") {
        unmatchedCount++;
        continue;
      }
      const targetSmiles = entry.smiles;
      if (typeof targetSmiles !== "string" || !targetSmiles) {
        unmatchedCount++;
        continue;
      }

      // First-match wins — same rule as Phase 7C-5 export
      let matchIndex = -1;
      for (let i = 0; i < data.length; i++) {
        if (claimed.has(i)) continue;
        if (data[i]?.notation === targetSmiles) {
          matchIndex = i;
          break;
        }
      }

      if (matchIndex === -1) {
        unmatchedCount++;
        logDebug("restoreChemistryFromManifest: unmatched SMILES", {
          smiles: targetSmiles,
        });
        continue;
      }

      claimed.add(matchIndex);
      if (entry.options && typeof entry.options === "object") {
        data[matchIndex].renderOptions = { ...entry.options };
      }
      if (typeof entry.preset === "string") {
        data[matchIndex].renderPresetName = entry.preset;
      }
      matchedCount++;
    }

    // 5. Re-sync the currently-visible structure
    const currentIndex = this._currentStructureIndex || 0;
    if (typeof this._syncPerImageStateForIndex === "function") {
      try {
        this._syncPerImageStateForIndex(currentIndex);
      } catch (err) {
        logWarn(
          "restoreChemistryFromManifest: _syncPerImageStateForIndex failed",
          { error: err.message }
        );
      }
    }

    // 6. Re-render the visible canvas with any restored per-image options
    const currentItem = data[currentIndex];
    if (currentItem && currentItem.notation) {
      const canvas = document.getElementById("chemistry-structure-canvas");
      if (canvas && typeof utils.renderStructure === "function") {
        try {
          const perImageOptions =
            currentItem.renderOptions &&
            typeof currentItem.renderOptions === "object"
              ? currentItem.renderOptions
              : undefined;
          utils.renderStructure(currentItem.notation, canvas, {
            onGraphReady: () => {
              if (typeof this._upgradeToStructuralDescription === "function") {
                this._upgradeToStructuralDescription(currentItem, currentIndex);
              }
            },
            perImageOptions,
          });
        } catch (err) {
          logWarn("restoreChemistryFromManifest: re-render failed", {
            error: err.message,
          });
        }
      }
    }

    logInfo("Phase 7C-6: chemistry settings restored", {
      globalPreset: manifest.globalPreset,
      perImageCount: overrides.length,
      matchedCount,
      unmatchedCount,
    });

    // Phase 7C-7: notify listeners (MMD preview) so the live preview rebuilds
    // its chemistry images to match the restored state. Directly fixes the
    // 7C-6 gap where the MMD preview stayed on the pre-restore global preset.
    this._dispatchChemistrySettingsChanged({ scope: "global" });
  }

  /**
   * Display a specific chemistry structure in the panel.
   *
   * @param {number} index - Index into this._chemistryData
   * @private
   */
  _displayChemistryStructure(index) {
    const data = this._chemistryData;
    if (!data || index < 0 || index >= data.length) return;

    // Phase 7A-4: Cancel any pending structural description timeout from the
    // previous structure before switching
    const prevItem = this._currentStructureIndex != null
      ? data[this._currentStructureIndex]
      : null;
    if (prevItem?._structDescTimerId) {
      clearTimeout(prevItem._structDescTimerId);
      prevItem._structDescTimerId = null;
    }

    const item = data[index];
    this._currentStructureIndex = index;

    // Reset PubChem-populated fields from previous structure (5D-2)
    const pubchemRow = document.getElementById("chemistry-row-pubchem");
    if (pubchemRow) pubchemRow.remove();

    const weightRow = document.getElementById("chemistry-row-weight");
    if (weightRow) {
      const weightDisplay = weightRow.querySelector(".chemistry-value");
      if (weightDisplay) weightDisplay.textContent = "—";
    }

    // Hide description area and clear provenance when switching structures (5E-1)
    const descArea = document.getElementById("chemistry-description-area");
    if (descArea) descArea.style.display = "none";
    const copyDescBtn = document.getElementById("chemistry-copy-description-btn");
    if (copyDescBtn) copyDescBtn.style.display = "none";
    const provEl = document.getElementById("chemistry-description-provenance");
    if (provEl) provEl.textContent = "";

    const utils = window.MathPixChemistryUtils;

    // Clear AI description flag for new structure (Phase 7A-3)
    const figure = document.getElementById("chemistry-structure-figure");
    if (figure) delete figure.dataset.aiDescribed;

    // Phase 7C-4: look up per-image override for this structure
    const perImageOptions =
      item.renderOptions && typeof item.renderOptions === "object" &&
      Object.keys(item.renderOptions).length > 0
        ? item.renderOptions
        : null;

    // Phase 7A-4: Clear structural description BEFORE renderStructure() so that
    // a synchronous SmilesDrawer callback cannot set the description and then
    // have it immediately cleared by later code.
    const structDescEl = document.getElementById("chemistry-structural-desc-text");
    const structDescContainer = document.getElementById("chemistry-structural-description");
    if (structDescEl) structDescEl.textContent = "";
    if (structDescContainer) structDescContainer.style.display = "none";

    // 1. Render structure diagram on canvas
    const canvas = document.getElementById("chemistry-structure-canvas");
    if (canvas && utils?.renderStructure) {
      utils.renderStructure(item.notation, canvas, {
        onGraphReady: () => {
          this._upgradeToStructuralDescription(item, index);
        },
        perImageOptions,
      });
    }

    // Phase 7C-2: Show preset selector
    const presetSelector = document.getElementById("chemistry-preset-selector");
    if (presetSelector) presetSelector.style.display = "";

    // Phase 7C-3: Show advanced rendering controls
    const advancedControls = document.getElementById("chemistry-advanced-controls");
    if (advancedControls) advancedControls.style.display = "";

    // Phase 7C-4: Sync per-image checkbox, badge, clear button, and control values
    this._syncPerImageStateForIndex(index);

    // 2. Populate identifiers
    const smilesEl = document.getElementById("chemistry-smiles-display");
    if (smilesEl) smilesEl.textContent = item.notation || "—";

    const inchiEl = document.getElementById("chemistry-inchi-display");
    if (inchiEl) inchiEl.textContent = item.inchi || "—";

    const inchikeyEl = document.getElementById("chemistry-inchikey-display");
    if (inchikeyEl) inchikeyEl.textContent = item.inchiKey || "—";

    // Parse and display molecular formula
    const formulaEl = document.getElementById("chemistry-formula-display");
    if (formulaEl && utils) {
      const parsed = item.inchi ? utils.parseInChIFormula(item.inchi) : null;
      if (parsed?.raw) {
        formulaEl.innerHTML = utils.formatFormulaAsHTML(parsed.raw);
        formulaEl.setAttribute(
          "aria-label",
          "Molecular formula: " +
            utils.formatFormulaForScreenReader(parsed.raw)
        );
      } else {
        formulaEl.textContent = "—";
        formulaEl.setAttribute("aria-label", "");
      }
    }

    // 5D-2 + 6B: Look up compound name from PubChem
    const nameEl = document.getElementById("chemistry-name-display");

    // Phase 7A-5b: Short-circuit when PubChem already resolved (pre-fetch path).
    // Populate all UI elements from the item cache — avoids a redundant session-
    // cache lookup that would re-trigger _upgradeToStructuralDescription and
    // produce a duplicate "Structural description set" log.
    if (nameEl && item._pubchemResolved) {
      nameEl.classList.remove("chemistry-loading", "chemistry-not-found");

      const displayName = item._resolvedName;
      if (displayName) {
        const commonName = item.commonNames?.[0];
        if (commonName && item.iupacName && commonName !== item.iupacName) {
          nameEl.textContent = commonName;
          const iupacSpan = document.createElement("span");
          iupacSpan.className = "chemistry-iupac-secondary";
          iupacSpan.textContent = ` (${item.iupacName})`;
          nameEl.appendChild(iupacSpan);
        } else {
          nameEl.textContent = displayName;
        }

        // Update heading with resolved name
        this._updateChemistryHeading();

        // Molecular weight
        if (item.molecularWeight) {
          const weightDisplay = document.getElementById("chemistry-weight-display");
          if (weightDisplay) {
            weightDisplay.textContent = item.molecularWeight.toFixed(2) + " g/mol";
          }
        }

        // PubChem link
        if (item.pubchemUrl) {
          this._addPubChemLink(item.pubchemUrl, item.pubchemCid);
        }

        // Update aria-label on figure with compound name
        if (figure && utils) {
          const parsed = item.inchi ? utils.parseInChIFormula(item.inchi) : null;
          const descData = {
            notation: item.notation,
            formula: parsed,
            iupacName: displayName,
          };
          const description = utils.generateBasicAccessibleDescription(descData);
          figure.setAttribute("aria-label", description);
        }

        // Update figcaption with compound name
        const caption = document.getElementById("chemistry-structure-caption");
        if (caption) {
          caption.textContent = `2D structural diagram of ${displayName}`;
        }

        // Screen reader announcement
        this._announceChemistry(`Compound identified: ${displayName}`);
      } else {
        // PubChem resolved but no name found
        nameEl.textContent = "Not found in PubChem";
        nameEl.classList.add("chemistry-not-found");
      }

      logInfo("Navigation UI populated from pre-fetch cache", {
        smiles: item.notation,
        name: displayName || "(none)",
      });
    } else if (nameEl && item.inchiKey) {
      // Image mode path: have InChI Key, look up by key
      nameEl.textContent = "Looking up…";
      nameEl.classList.add("chemistry-loading");
      nameEl.classList.remove("chemistry-not-found");
      this._lookupAndPopulateName(item, index);
    } else if (nameEl && !item.inchiKey && item.notation) {
      // PDF mode path (Phase 6B): no InChI Key, look up by SMILES notation
      nameEl.textContent = "Looking up…";
      nameEl.classList.add("chemistry-loading");
      nameEl.classList.remove("chemistry-not-found");
      this._lookupAndPopulateBySmiles(item, index);
    } else if (nameEl) {
      nameEl.textContent = "—";
      nameEl.classList.remove("chemistry-loading", "chemistry-not-found");
      // Phase 7A-4: no PubChem lookup possible — unblock deferred description
      item._pubchemResolved = true;
    }

    // 3. Update figure aria-label with accessible description
    // Phase 7A-5b: use resolved name when available (pre-fetch cache path)
    if (figure && utils) {
      const parsed = item.inchi ? utils.parseInChIFormula(item.inchi) : null;
      const descData = {
        notation: item.notation,
        formula: parsed,
        iupacName: item._resolvedName || null,
      };
      const description =
        utils.generateBasicAccessibleDescription(descData);
      figure.setAttribute("aria-label", description);
    }

    // 4. Update figcaption
    // Phase 7A-5b: use resolved name when available (pre-fetch cache path)
    const caption = document.getElementById("chemistry-structure-caption");
    if (caption) {
      if (item._resolvedName) {
        caption.textContent = `2D structural diagram of ${item._resolvedName}`;
      } else {
        const parsed = item.inchi
          ? utils?.parseInChIFormula(item.inchi)
          : null;
        caption.textContent = parsed?.raw
          ? `2D structural diagram of ${parsed.raw}`
          : "2D structural diagram";
      }
    }

    // 5. Update structure counter
    const counter = document.getElementById("chemistry-structure-counter");
    if (counter) {
      counter.textContent = `Structure ${index + 1} of ${data.length}`;
    }

    // 6. Update navigation button states
    const prevBtn = document.getElementById("chemistry-prev-structure");
    const nextBtn = document.getElementById("chemistry-next-structure");
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === data.length - 1;

    // 7. Enable action buttons (they start disabled in HTML)
    const copySmiles = document.getElementById("chemistry-copy-smiles-btn");
    const copyInchi = document.getElementById("chemistry-copy-inchi-btn");
    if (copySmiles) copySmiles.disabled = !item.notation;
    if (copyInchi) copyInchi.disabled = !item.inchi;

    // Lookup and Describe buttons enabled if we have the required data
    const lookupBtn = document.getElementById("chemistry-lookup-btn");
    const describeBtn = document.getElementById("chemistry-describe-btn");
    if (lookupBtn) lookupBtn.disabled = !item.inchiKey;
    if (describeBtn) describeBtn.disabled = !item.notation;

    // Phase 8B: Save image button enabled when SMILES is available
    const saveImageBtn = document.getElementById("chemistry-save-image-btn");
    if (saveImageBtn) saveImageBtn.disabled = !item.notation;

    logDebug("Chemistry structure displayed", {
      index,
      notation: item.notation,
    });
  }

  /**
   * Set up chemistry structure navigation (prev/next buttons).
   *
   * @private
   */
  _setupChemistryNavigation() {
    const prevBtn = document.getElementById("chemistry-prev-structure");
    const nextBtn = document.getElementById("chemistry-next-structure");

    if (prevBtn) {
      prevBtn.onclick = () => {
        if (this._currentStructureIndex > 0) {
          this._displayChemistryStructure(
            this._currentStructureIndex - 1
          );
          this._announceNavigatedStructure();
        }
      };
    }

    if (nextBtn) {
      nextBtn.onclick = () => {
        if (
          this._currentStructureIndex <
          this._chemistryData.length - 1
        ) {
          this._displayChemistryStructure(
            this._currentStructureIndex + 1
          );
          this._announceNavigatedStructure();
        }
      };
    }
  }

  /**
   * Phase 7C-2: Set up chemistry rendering preset selector.
   * Reads active preset from localStorage, wires change handler to re-render.
   * @private
   */
  _setupChemistryPresetSelector() {
    const container = document.getElementById("chemistry-preset-selector");
    if (!container) return;

    const utils = window.MathPixChemistryUtils;
    const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;
    if (!utils || !config) return;

    // Set the radio to match the stored preset
    const activePreset = utils.getActivePreset();
    const activeRadio = container.querySelector(
      `input[name="chemistry-preset"][value="${activePreset}"]`
    );
    if (activeRadio) activeRadio.checked = true;

    // Listen for changes on the radio group
    const radios = container.querySelectorAll('input[name="chemistry-preset"]');
    radios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        const presetName = radio.value;

        // Phase 7C-5: when the per-image toggle is ticked, the preset pick
        // applies ONLY to the current structure — the global preset is left
        // alone. This is what lets users choose Skeletal for diagram 1 and
        // Textbook for diagram 2.
        const perImageToggle =
          document.getElementById("chem-per-image-toggle");
        const perImageActive = !!(perImageToggle && perImageToggle.checked);
        const index = this._currentStructureIndex;
        const item = this._chemistryData?.[index];

        if (perImageActive && item) {
          let resolvedOptions;
          if (presetName === "custom") {
            // Custom keeps whatever the user currently has on-screen
            resolvedOptions = this._collectAdvancedControlValues();
          } else {
            const presetOpts = config.PRESETS[presetName];
            resolvedOptions = presetOpts ? { ...presetOpts } : {};
            // Phase 7C-5 fix: presets that don't explicitly set colourScheme
            // (skeletal, textbook) must default to "element" so they don't
            // inherit the global preset's palette via the merge chain —
            // otherwise picking Textbook over a monochrome global leaks
            // monochrome colours into the render.
            if (!resolvedOptions.colourScheme) {
              resolvedOptions.colourScheme = "element";
            }
          }

          item.renderOptions = resolvedOptions;
          item.renderPresetName = presetName;

          this._populateAdvancedControlsFromOptions(resolvedOptions);
          this._updatePerImageBadge(index);

          const canvas = document.getElementById(
            "chemistry-structure-canvas"
          );
          if (canvas && item.notation) {
            utils.renderStructure(item.notation, canvas, {
              onGraphReady: () => {
                this._upgradeToStructuralDescription(item, index);
              },
              perImageOptions: resolvedOptions,
            });
          }

          const perImageLabel =
            presetName === "custom"
              ? "Custom"
              : config.PRESETS[presetName]?.label || presetName;
          this.announceToScreenReader(
            "Per-image rendering style set to " +
              perImageLabel +
              " for this structure"
          );

          // Phase 7C-7: notify MMD preview to re-enhance this SMILES
          this._dispatchChemistrySettingsChanged({
            scope: "perImage",
            index,
            smiles: item.notation,
          });
          return;
        }

        // Global preset branch (unchanged 7C-3 behaviour)
        const saved = utils.setActivePreset(presetName);
        if (!saved) return;

        // Phase 7C-3: when a named preset is chosen, sync the advanced
        // controls back to that preset's values (not for "custom", which
        // is driven by the advanced controls themselves)
        if (presetName !== "custom") {
          this._populateAdvancedControlsFromPreset(presetName);
        }

        // Re-render current structure with new preset
        const canvas = document.getElementById("chemistry-structure-canvas");
        if (canvas && item?.notation) {
          utils.renderStructure(item.notation, canvas, {
            onGraphReady: () => {
              this._upgradeToStructuralDescription(
                item,
                this._currentStructureIndex
              );
            },
            perImageOptions: item.renderOptions || null,
          });
        }

        // Announce to screen readers
        const presetLabel =
          presetName === "custom"
            ? "Custom"
            : config.PRESETS[presetName]?.label || presetName;
        this.announceToScreenReader(
          "Rendering style changed to " + presetLabel
        );

        // Phase 7C-7: notify MMD preview to re-enhance non-overridden structures
        this._dispatchChemistrySettingsChanged({ scope: "global" });
      });
    });
  }

  /**
   * Phase 7C-5: Collect current advanced control values into a flat options
   * object. Shared by preset + custom apply paths.
   * @private
   */
  _collectAdvancedControlValues() {
    const el = (id) => document.getElementById(id);
    const safeFloat = (node, fallback) => {
      const v = node ? parseFloat(node.value) : NaN;
      return Number.isFinite(v) ? v : fallback;
    };
    return {
      bondThickness: safeFloat(el("chem-bond-thickness"), 2),
      bondSpacing: safeFloat(el("chem-bond-spacing"), 5),
      fontSizeLarge: safeFloat(el("chem-font-size-large"), 11),
      fontSizeSmall: safeFloat(el("chem-font-size-small"), 4),
      compactDrawing: !!el("chem-compact-drawing")?.checked,
      explicitHydrogens: !!el("chem-explicit-hydrogens")?.checked,
      terminalCarbons: !!el("chem-terminal-carbons")?.checked,
      colourScheme: el("chem-colour-scheme")?.value || "element",
    };
  }

  /**
   * Phase 7C-3: Set up advanced rendering controls (sliders, checkboxes, select).
   *
   * On any control change:
   *  - selects the "Custom" radio in the preset selector
   *  - collects all control values into an options object
   *  - persists the custom options and re-renders
   *  - announces "Custom rendering style applied" to screen readers
   *
   * Range sliders are debounced (150ms) to avoid overwhelming SmilesDrawer
   * while the user drags.
   *
   * @private
   */
  _setupChemistryAdvancedControls() {
    const container = document.getElementById("chemistry-advanced-controls");
    if (!container) return;

    const utils = window.MathPixChemistryUtils;
    const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;
    if (!utils || !config) return;

    // Guard against double wiring when populateChemistryFormat runs again
    if (container.dataset.wired === "true") {
      // Still refresh control values to current preset so the panel
      // reflects the active structure's rendering state
      this._populateAdvancedControlsFromPreset(utils.getActivePreset());
      return;
    }
    container.dataset.wired = "true";

    const ids = {
      bondThickness: "chem-bond-thickness",
      bondSpacing: "chem-bond-spacing",
      fontSizeLarge: "chem-font-size-large",
      fontSizeSmall: "chem-font-size-small",
      compactDrawing: "chem-compact-drawing",
      explicitHydrogens: "chem-explicit-hydrogens",
      terminalCarbons: "chem-terminal-carbons",
      colourScheme: "chem-colour-scheme",
    };

    // Populate from current active preset
    this._populateAdvancedControlsFromPreset(utils.getActivePreset());

    // Debounce timer shared by range sliders
    let debounceTimer = null;

    const collectOptions = () => {
      const el = (id) => document.getElementById(id);
      return {
        bondThickness: parseFloat(el(ids.bondThickness).value),
        bondSpacing: parseFloat(el(ids.bondSpacing).value),
        fontSizeLarge: parseFloat(el(ids.fontSizeLarge).value),
        fontSizeSmall: parseFloat(el(ids.fontSizeSmall).value),
        compactDrawing: el(ids.compactDrawing).checked,
        explicitHydrogens: el(ids.explicitHydrogens).checked,
        terminalCarbons: el(ids.terminalCarbons).checked,
        colourScheme: el(ids.colourScheme).value,
      };
    };

    const applyCustom = () => {
      const options = collectOptions();

      // Phase 7C-4: when the per-image toggle is checked, writes go to the
      // current structure's renderOptions instead of the global custom preset.
      const perImageToggle = document.getElementById("chem-per-image-toggle");
      const perImageActive = !!(perImageToggle && perImageToggle.checked);
      const index = this._currentStructureIndex;
      const item = this._chemistryData?.[index];

      if (perImageActive && item) {
        item.renderOptions = options;
        // Phase 7C-5: hand-tweaking implies custom for this structure
        item.renderPresetName = "custom";

        // Snap the per-image preset radio to Custom so the UI is honest
        const customRadio = document.querySelector(
          'input[name="chemistry-preset"][value="custom"]'
        );
        if (customRadio) customRadio.checked = true;

        this._updatePerImageBadge(index);

        // Re-render with per-image overrides
        const canvas = document.getElementById("chemistry-structure-canvas");
        if (canvas && item.notation) {
          utils.renderStructure(item.notation, canvas, {
            onGraphReady: () => {
              this._upgradeToStructuralDescription(item, index);
            },
            perImageOptions: options,
          });
        }

        this.announceToScreenReader(
          "Per-image rendering updated for this structure"
        );

        // Phase 7C-7: notify MMD preview to re-enhance this SMILES
        this._dispatchChemistrySettingsChanged({
          scope: "perImage",
          index,
          smiles: item.notation,
        });
        return;
      }

      // Global-custom branch (7C-3 behaviour, unchanged)
      utils.setActivePreset("custom");
      utils.setCustomOptions(options);

      // Select the Custom radio button
      const customRadio = document.querySelector(
        'input[name="chemistry-preset"][value="custom"]'
      );
      if (customRadio) customRadio.checked = true;

      // Re-render current structure
      const canvas = document.getElementById("chemistry-structure-canvas");
      if (canvas && item?.notation) {
        utils.renderStructure(item.notation, canvas, {
          onGraphReady: () => {
            this._upgradeToStructuralDescription(
              item,
              this._currentStructureIndex
            );
          },
          perImageOptions: null,
        });
      }

      this.announceToScreenReader("Custom rendering style applied");

      // Phase 7C-7: notify MMD preview — global custom options changed
      this._dispatchChemistrySettingsChanged({ scope: "global" });
    };

    const debouncedApply = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        applyCustom();
      }, 150);
    };

    // Wire range sliders — update <output> immediately, debounce re-render
    const rangeIds = [
      ids.bondThickness,
      ids.bondSpacing,
      ids.fontSizeLarge,
      ids.fontSizeSmall,
    ];
    rangeIds.forEach((id) => {
      const input = document.getElementById(id);
      if (!input) return;
      const output = document.getElementById(id + "-value");
      input.addEventListener("input", () => {
        if (output) output.textContent = input.value;
        debouncedApply();
      });
    });

    // Wire checkboxes and select — immediate re-render
    [
      ids.compactDrawing,
      ids.explicitHydrogens,
      ids.terminalCarbons,
      ids.colourScheme,
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", () => applyCustom());
    });

    // Reset-to-preset button
    const resetBtn = document.getElementById("chem-reset-to-preset");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        // Find currently selected named preset (ignore custom)
        let targetPreset = utils.getActivePreset();
        if (targetPreset === "custom") {
          // Fall back to the last non-custom radio that exists, else default
          targetPreset = config.DEFAULT_PRESET;
        }

        // Set the named preset radio, persist, and sync controls
        utils.setActivePreset(targetPreset);
        const radio = document.querySelector(
          `input[name="chemistry-preset"][value="${targetPreset}"]`
        );
        if (radio) radio.checked = true;
        this._populateAdvancedControlsFromPreset(targetPreset);

        // Re-render
        const canvas = document.getElementById("chemistry-structure-canvas");
        const item = this._chemistryData?.[this._currentStructureIndex];
        if (canvas && item?.notation) {
          utils.renderStructure(item.notation, canvas, {
            onGraphReady: () => {
              this._upgradeToStructuralDescription(
                item,
                this._currentStructureIndex
              );
            },
            perImageOptions: item.renderOptions || null,
          });
        }

        const presetLabel =
          config.PRESETS[targetPreset]?.label || targetPreset;
        this.announceToScreenReader(
          "Advanced controls reset to " + presetLabel + " preset"
        );
      });
    }

    // Phase 7C-4: per-image toggle
    const perImageToggle = document.getElementById("chem-per-image-toggle");
    if (perImageToggle) {
      perImageToggle.addEventListener("change", () => {
        const index = this._currentStructureIndex;
        const item = this._chemistryData?.[index];
        if (!item) return;

        if (perImageToggle.checked) {
          // Phase 7C-5: capture current control values AND the currently
          // selected preset radio. This lets the user then switch presets
          // per-structure (Skeletal for one, Textbook for another).
          item.renderOptions = collectOptions();
          const checkedRadio = document.querySelector(
            'input[name="chemistry-preset"]:checked'
          );
          item.renderPresetName =
            checkedRadio?.value || utils.getActivePreset() || "skeletal";
          this._updatePerImageBadge(index);
          this.announceToScreenReader(
            "Per-image settings enabled for this structure"
          );
        } else {
          // Remove per-image override and revert to global preset
          delete item.renderOptions;
          delete item.renderPresetName;
          this._updatePerImageBadge(index);

          // Re-sync the preset radio group to the global active preset
          const globalPreset = utils.getActivePreset();
          const globalRadio = document.querySelector(
            `input[name="chemistry-preset"][value="${globalPreset}"]`
          );
          if (globalRadio) globalRadio.checked = true;
          this._populateAdvancedControlsFromPreset(globalPreset);

          this.announceToScreenReader(
            "Per-image settings disabled, using global preset"
          );
        }

        // Re-render with the current (possibly null) per-image override
        const canvas = document.getElementById("chemistry-structure-canvas");
        if (canvas && item.notation) {
          utils.renderStructure(item.notation, canvas, {
            onGraphReady: () => {
              this._upgradeToStructuralDescription(item, index);
            },
            perImageOptions: item.renderOptions || null,
          });
        }

        // Phase 7C-7: notify MMD preview — toggling flips this SMILES
        // between its override and the global preset.
        this._dispatchChemistrySettingsChanged({
          scope: "perImage",
          index,
          smiles: item.notation,
        });
      });
    }

    // Phase 7C-4: Clear per-image settings button
    const clearPerImageBtn = document.getElementById("chem-clear-per-image");
    if (clearPerImageBtn) {
      clearPerImageBtn.addEventListener("click", () => {
        const index = this._currentStructureIndex;
        const item = this._chemistryData?.[index];
        if (!item) return;

        delete item.renderOptions;
        delete item.renderPresetName;

        // Untick the checkbox
        const toggle = document.getElementById("chem-per-image-toggle");
        if (toggle) toggle.checked = false;

        // Hide badge, disable clear button
        this._updatePerImageBadge(index);

        // Re-sync preset radio group + controls to the global preset
        const globalPreset = utils.getActivePreset();
        const globalRadio = document.querySelector(
          `input[name="chemistry-preset"][value="${globalPreset}"]`
        );
        if (globalRadio) globalRadio.checked = true;
        this._populateAdvancedControlsFromPreset(globalPreset);

        // Re-render
        const canvas = document.getElementById("chemistry-structure-canvas");
        if (canvas && item.notation) {
          utils.renderStructure(item.notation, canvas, {
            onGraphReady: () => {
              this._upgradeToStructuralDescription(item, index);
            },
            perImageOptions: null,
          });
        }

        this.announceToScreenReader("Per-image settings cleared");

        // Phase 7C-7: notify MMD preview — structure falls back to global preset
        this._dispatchChemistrySettingsChanged({
          scope: "perImage",
          index,
          smiles: item.notation,
        });
      });
    }
  }

  /**
   * Phase 7C-4: Update the per-image badge and clear button state for the
   * given structure index.
   * @private
   */
  _updatePerImageBadge(index) {
    const item = this._chemistryData?.[index];
    const hasPerImage =
      item?.renderOptions &&
      typeof item.renderOptions === "object" &&
      Object.keys(item.renderOptions).length > 0;

    const badge = document.getElementById("chemistry-per-image-badge");
    if (badge) badge.hidden = !hasPerImage;

    const clearBtn = document.getElementById("chem-clear-per-image");
    if (clearBtn) clearBtn.disabled = !hasPerImage;
  }

  /**
   * Phase 7C-4: Sync the per-image checkbox, badge, clear button, and
   * advanced-control values to the state stored for the given structure
   * index. Called on navigation so each structure reflects its own state.
   * @private
   */
  _syncPerImageStateForIndex(index) {
    const item = this._chemistryData?.[index];
    if (!item) return;

    const utils = window.MathPixChemistryUtils;
    const hasPerImage =
      item.renderOptions &&
      typeof item.renderOptions === "object" &&
      Object.keys(item.renderOptions).length > 0;

    const toggle = document.getElementById("chem-per-image-toggle");
    if (toggle) toggle.checked = !!hasPerImage;

    // Phase 7C-5: select the appropriate preset radio — per-structure when
    // a per-image override is active, otherwise the global preset.
    const targetPreset = hasPerImage
      ? item.renderPresetName || "custom"
      : utils?.getActivePreset?.() || "skeletal";
    const targetRadio = document.querySelector(
      `input[name="chemistry-preset"][value="${targetPreset}"]`
    );
    if (targetRadio) targetRadio.checked = true;

    if (hasPerImage) {
      this._populateAdvancedControlsFromOptions(item.renderOptions);
    } else if (utils?.getActivePreset) {
      this._populateAdvancedControlsFromPreset(utils.getActivePreset());
    }

    this._updatePerImageBadge(index);
  }

  /**
   * Phase 7C-4: Populate advanced controls from a plain options object.
   * Like _populateAdvancedControlsFromPreset() but takes values directly,
   * used to restore per-image override state on navigation.
   * @private
   */
  _populateAdvancedControlsFromOptions(optionsObj) {
    const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;
    if (!config) return;
    const base = config.PRESETS[config.DEFAULT_PRESET] || {};
    const values = { ...base, ...(optionsObj || {}) };

    const setRange = (id, value) => {
      const input = document.getElementById(id);
      if (!input || value == null) return;
      input.value = value;
      const output = document.getElementById(id + "-value");
      if (output) output.textContent = String(value);
    };
    const setCheckbox = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!value;
    };
    const setSelect = (id, value) => {
      const el = document.getElementById(id);
      if (el && value) el.value = value;
    };

    setRange("chem-bond-thickness", values.bondThickness);
    setRange("chem-bond-spacing", values.bondSpacing);
    setRange("chem-font-size-large", values.fontSizeLarge);
    setRange("chem-font-size-small", values.fontSizeSmall);
    setCheckbox("chem-compact-drawing", values.compactDrawing);
    setCheckbox("chem-explicit-hydrogens", values.explicitHydrogens);
    setCheckbox("chem-terminal-carbons", values.terminalCarbons);
    setSelect("chem-colour-scheme", values.colourScheme || "element");
  }

  /**
   * Phase 7C-3: Populate advanced controls to reflect a named preset's values.
   * When presetName is "custom", merges stored custom options on top of the
   * skeletal defaults so controls show the user's last custom values.
   *
   * @param {string} presetName - Preset name from config.PRESETS or "custom"
   * @private
   */
  _populateAdvancedControlsFromPreset(presetName) {
    const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;
    if (!config) return;

    const utils = window.MathPixChemistryUtils;

    let values;
    if (presetName === "custom" && utils?.getCustomOptions) {
      const base = config.PRESETS[config.DEFAULT_PRESET] || {};
      values = { ...base, ...utils.getCustomOptions() };
    } else {
      values =
        config.PRESETS[presetName] ||
        config.PRESETS[config.DEFAULT_PRESET] ||
        {};
    }

    const setRange = (id, value) => {
      const input = document.getElementById(id);
      if (!input || value == null) return;
      input.value = value;
      const output = document.getElementById(id + "-value");
      if (output) output.textContent = String(value);
    };
    const setCheckbox = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!value;
    };
    const setSelect = (id, value) => {
      const el = document.getElementById(id);
      if (el && value) el.value = value;
    };

    setRange("chem-bond-thickness", values.bondThickness);
    setRange("chem-bond-spacing", values.bondSpacing);
    setRange("chem-font-size-large", values.fontSizeLarge);
    setRange("chem-font-size-small", values.fontSizeSmall);
    setCheckbox("chem-compact-drawing", values.compactDrawing);
    setCheckbox("chem-explicit-hydrogens", values.explicitHydrogens);
    setCheckbox("chem-terminal-carbons", values.terminalCarbons);
    setSelect("chem-colour-scheme", values.colourScheme || "element");
  }

  /**
   * Set up chemistry action button event handlers (copy, lookup, describe).
   *
   * @private
   */
  _setupChemistryActions() {
    const self = this;

    // Copy SMILES
    const copySmiles = document.getElementById("chemistry-copy-smiles-btn");
    if (copySmiles) {
      copySmiles.onclick = async () => {
        const item =
          self._chemistryData?.[self._currentStructureIndex];
        if (!item?.notation) return;
        try {
          await navigator.clipboard.writeText(item.notation);
          self._announceChemistry(
            "SMILES notation copied to clipboard"
          );
        } catch (err) {
          logWarn("Clipboard write failed", { error: err.message });
          self._announceChemistry(
            "Failed to copy — please select and copy manually"
          );
        }
      };
    }

    // Copy InChI
    const copyInchi = document.getElementById("chemistry-copy-inchi-btn");
    if (copyInchi) {
      copyInchi.onclick = async () => {
        const item =
          self._chemistryData?.[self._currentStructureIndex];
        if (!item?.inchi) return;
        try {
          await navigator.clipboard.writeText(item.inchi);
          self._announceChemistry(
            "InChI identifier copied to clipboard"
          );
        } catch (err) {
          logWarn("Clipboard write failed", { error: err.message });
          self._announceChemistry(
            "Failed to copy — please select and copy manually"
          );
        }
      };
    }

    // Copy Description (Phase 6D)
    const copyDesc = document.getElementById("chemistry-copy-description-btn");
    if (copyDesc) {
      copyDesc.onclick = async () => {
        const descText = document.getElementById("chemistry-description-text");
        if (!descText?.textContent) return;
        try {
          await navigator.clipboard.writeText(descText.textContent);
          // Brief "Copied!" feedback
          const originalHTML = copyDesc.innerHTML;
          const checkHtml = typeof window.getIcon === "function"
            ? window.getIcon("check")
            : '<span aria-hidden="true" data-icon="check"></span>';
          copyDesc.innerHTML = checkHtml + " Copied!";
          self._announceChemistry("Description copied to clipboard");
          setTimeout(() => {
            copyDesc.innerHTML = originalHTML;
          }, 2000);
        } catch (err) {
          logWarn("Clipboard write failed", { error: err.message });
          self._announceChemistry(
            "Failed to copy — please select and copy manually"
          );
        }
      };
    }

    // Look Up Compound (wired to PubChem in 5D-2)
    const lookupBtn = document.getElementById("chemistry-lookup-btn");
    if (lookupBtn) {
      lookupBtn.onclick = () => {
        const item =
          self._chemistryData?.[self._currentStructureIndex];
        if (!item?.inchiKey) return;

        // Phase 5D-2 will replace this with PubChem panel integration
        // For now, open PubChem search in new tab
        const url = `https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(item.inchiKey)}`;
        window.open(url, "_blank", "noopener,noreferrer");
        self._announceChemistry(
          "Opening PubChem search in new tab"
        );
      };
    }

    // Describe Structure (5E-1: AI description via OpenRouter Embed)
    const describeBtn = document.getElementById("chemistry-describe-btn");
    if (describeBtn) {
      describeBtn.onclick = async () => {
        const item =
          self._chemistryData?.[self._currentStructureIndex];
        if (!item?.notation) return;

        const utils = window.MathPixChemistryUtils;
        const service = utils?.getDescriptionService?.();
        if (!service) {
          self._announceChemistry("Description service not available");
          return;
        }

        // Show loading state (Phase 6E — E5: sync aria-label with visual state)
        describeBtn.disabled = true;
        describeBtn.setAttribute("aria-busy", "true");
        describeBtn.setAttribute("aria-label", "Generating description, please wait");
        const iconHtml = typeof window.getIcon === "function"
          ? window.getIcon("hourglass")
          : '<span aria-hidden="true" data-icon="hourglass"></span>';
        describeBtn.innerHTML = iconHtml + " Generating…";
        self._announceChemistry("Generating accessible description…");

        // Build context from current panel state
        const nameEl = document.getElementById("chemistry-name-display");
        const nameText = nameEl?.textContent || "";
        const iupacName =
          nameText !== "—" &&
          nameText !== "Looking up…" &&
          nameText !== "Not found in PubChem"
            ? nameText.split(" (")[0] // Strip IUPAC secondary text
            : null;

        const parsed = item.inchi
          ? utils.parseInChIFormula(item.inchi)
          : null;

        const chemData = {
          notation: item.notation,
          formula: parsed?.raw || null,
          iupacName: iupacName,
          commonNames: [],
        };

        try {
          const startTime = performance.now();
          const description = await service.describe(chemData);
          const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

          // Show description in the panel
          const descArea = document.getElementById(
            "chemistry-description-area"
          );
          const descText = document.getElementById(
            "chemistry-description-text"
          );
          if (descArea && descText) {
            descText.textContent = description;
            descArea.style.display = "";
          }

          // Phase 6D: Show Copy Description button
          const copyDescBtn = document.getElementById("chemistry-copy-description-btn");
          if (copyDescBtn) copyDescBtn.style.display = "";

          // Populate provenance line
          const provEl = document.getElementById(
            "chemistry-description-provenance"
          );
          if (provEl) {
            const modelName =
              service._embed?.model || "anthropic/claude-haiku-4.5";
            const shortModel = modelName.split("/").pop();
            const now = new Date();
            const dateStr = now.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            const timeStr = now.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            });
            provEl.textContent =
              `Generated by ${shortModel} in ${elapsed}s on ${dateStr} at ${timeStr}`;
          }

          // Update figure aria-label to include the AI description
          const figure = document.getElementById(
            "chemistry-structure-figure"
          );
          if (figure) {
            const currentLabel =
              figure.getAttribute("aria-label") || "";
            figure.setAttribute(
              "aria-label",
              currentLabel + ". " + description
            );
            figure.dataset.aiDescribed = "true";
          }

          // Phase 6E (E3): Hide figcaption from a11y tree to prevent
          // double-announce — aria-label on the figure is the canonical name
          const caption = document.getElementById(
            "chemistry-structure-caption"
          );
          if (caption) {
            caption.setAttribute("aria-hidden", "true");
          }

          self._announceChemistry(
            "Description generated: " + description.substring(0, 120)
          );

          logInfo("Chemistry description displayed", {
            notation: item.notation,
            descriptionLength: description.length,
            generationTime: elapsed + "s",
          });
        } catch (error) {
          logWarn("Chemistry description failed", {
            error: error.message,
          });
          self._announceChemistry("Failed to generate description");
        } finally {
          // Restore button (Phase 6E — E5: restore aria-label)
          describeBtn.disabled = false;
          describeBtn.removeAttribute("aria-busy");
          describeBtn.setAttribute("aria-label", "Generate accessible description of chemical structure");
          const sparkleHtml = typeof window.getIcon === "function"
            ? window.getIcon("aiSparkle")
            : '<span aria-hidden="true" data-icon="aiSparkle"></span>';
          describeBtn.innerHTML = sparkleHtml + " Describe Structure";
        }
      };
    }

    // Phase 8B: Save structure image
    const saveImageBtn = document.getElementById("chemistry-save-image-btn");
    if (saveImageBtn) {
      saveImageBtn.onclick = async () => {
        const item = self._chemistryData?.[self._currentStructureIndex];
        if (!item?.notation) return;

        const utils = window.MathPixChemistryUtils;
        if (!utils?.renderStructureToBlob) return;

        saveImageBtn.disabled = true;
        const originalHTML = saveImageBtn.innerHTML;
        const hourglassHtml = typeof window.getIcon === "function"
          ? window.getIcon("hourglass")
          : '<span aria-hidden="true" data-icon="hourglass"></span>';
        saveImageBtn.innerHTML = hourglassHtml + " Saving…";

        try {
          // Phase 7C-7: retry once on a null return. SmilesDrawer has an
          // intermittent "canvas appears blank" race — a short async gap
          // is enough for the next call to succeed.
          const renderOpts = {
            width: 800,
            height: 600,
            background: "#ffffff",
            forExport: true,
            perImageOptions: item.renderOptions || null,
          };
          let blob = await utils.renderStructureToBlob(item.notation, renderOpts);
          if (!blob) {
            logWarn("Phase 8B: first render returned null — retrying", {
              notation: item.notation,
            });
            await new Promise((resolve) => setTimeout(resolve, 50));
            blob = await utils.renderStructureToBlob(item.notation, renderOpts);
          }

          if (!blob) {
            self._announceChemistry("Failed to generate image");
            if (typeof window.notifyError === "function") {
              window.notifyError("Failed to generate structure image");
            }
            return;
          }

          const name = item._resolvedName || item.commonNames?.[0] || item.iupacName;
          const filename = name
            ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "") + ".png"
            : "structure-" + (self._currentStructureIndex + 1) + ".png";

          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          // Revoke after a delay — the browser reads the blob asynchronously
          // once a.click() triggers the download, so revoking synchronously
          // can race the download and produce a silent no-op save.
          setTimeout(() => URL.revokeObjectURL(url), 1000);

          self._announceChemistry("Structure image saved as " + filename);
          if (typeof window.notifySuccess === "function") {
            window.notifySuccess("Saved " + filename);
          }
        } catch (err) {
          logWarn("Phase 8B: Save image failed", { error: err.message });
          self._announceChemistry("Failed to save image");
          if (typeof window.notifyError === "function") {
            window.notifyError("Failed to save structure image");
          }
        } finally {
          saveImageBtn.disabled = false;
          saveImageBtn.innerHTML = originalHTML;
        }
      };
    }
  }

  /**
   * Phase 6D: Update the chemistry heading to include resolved compound names.
   * Collects all known names from _chemistryData and updates the heading text.
   * Called after each successful PubChem lookup resolves a name.
   *
   * @private
   */
  _updateChemistryHeading() {
    const heading = document.getElementById("smiles-output-heading");
    if (!heading || !this._chemistryData?.length) return;

    // Collect resolved names from _chemistryData
    const names = this._chemistryData
      .map(item => item._resolvedName)
      .filter(Boolean);

    if (names.length > 0) {
      heading.textContent = "Chemistry Detected: " + names.join(", ");
    } else {
      const count = this._chemistryData.length;
      heading.textContent = `Chemistry Detected: ${count} structure${count !== 1 ? "s" : ""}`;
    }
  }

  /**
   * Look up compound on PubChem and populate name + metadata in the panel.
   * Called asynchronously — updates the panel when the response arrives.
   *
   * @param {Object} item - Chemistry data object (notation, inchi, inchiKey)
   * @param {number} expectedIndex - Structure index at time of call (guards against navigation race)
   * @private
   */
  async _lookupAndPopulateName(item, expectedIndex) {
    const utils = window.MathPixChemistryUtils;
    if (!utils?.lookupPubChem) {
      logWarn("lookupPubChem not available on MathPixChemistryUtils");
      item._pubchemResolved = true; // Phase 7A-4: unblock deferred description
      return;
    }

    try {
      const result = await utils.lookupPubChem(item.inchiKey);

      // Phase 7A-4: mark PubChem as resolved regardless of result
      item._pubchemResolved = true;

      // Guard: user may have navigated to a different structure while we waited
      if (this._currentStructureIndex !== expectedIndex) {
        logDebug("PubChem result arrived but structure index changed", {
          expected: expectedIndex,
          current: this._currentStructureIndex,
        });
        return;
      }

      const nameEl = document.getElementById("chemistry-name-display");
      if (!nameEl) return;

      nameEl.classList.remove("chemistry-loading");

      if (result.found && result.iupacName) {
        // Build name display with common name if available
        const commonName = result.commonNames?.[0];
        if (commonName) {
          nameEl.textContent = commonName;

          // Add IUPAC name as secondary text
          const iupacSpan = document.createElement("span");
          iupacSpan.className = "chemistry-iupac-secondary";
          iupacSpan.textContent = ` (${result.iupacName})`;
          nameEl.appendChild(iupacSpan);
        } else {
          nameEl.textContent = result.iupacName;
        }

        // Phase 6D: Store resolved name and update heading
        this._chemistryData[expectedIndex]._resolvedName = commonName || result.iupacName;
        this._updateChemistryHeading();

        // Phase 7A-3: Re-generate structural description with compound name
        this._upgradeToStructuralDescription(item, expectedIndex);

        // Add molecular weight if available
        if (result.molecularWeight) {
          const weightDisplay = document.getElementById("chemistry-weight-display");
          if (weightDisplay) {
            weightDisplay.textContent = result.molecularWeight.toFixed(2) + " g/mol";
          }
        }

        // Add PubChem link
        if (result.pubchemUrl) {
          this._addPubChemLink(result.pubchemUrl, result.pubchemCid);
        }

        // Update aria-label on figure with the human-readable name
        const figure = document.getElementById("chemistry-structure-figure");
        if (figure && utils) {
          const parsed = item.inchi ? utils.parseInChIFormula(item.inchi) : null;
          const descData = {
            notation: item.notation,
            formula: parsed,
            iupacName: commonName || result.iupacName,
          };
          const description = utils.generateBasicAccessibleDescription(descData);
          figure.setAttribute("aria-label", description);
        }

        // Update figcaption with human-readable name
        const caption = document.getElementById("chemistry-structure-caption");
        if (caption) {
          caption.textContent = `2D structural diagram of ${commonName || result.iupacName}`;
        }

        // Announce to screen readers
        const displayName = commonName || result.iupacName;
        this._announceChemistry(`Compound identified: ${displayName}`);

        logInfo("PubChem lookup populated", {
          inchiKey: item.inchiKey,
          iupacName: result.iupacName,
          commonName,
          cid: result.pubchemCid,
        });
      } else {
        nameEl.textContent = "Not found in PubChem";
        nameEl.classList.add("chemistry-not-found");
        logDebug("Compound not found in PubChem", { inchiKey: item.inchiKey });
        // Phase 7A-4: PubChem resolved with no name — show deferred description
        this._upgradeToStructuralDescription(item, expectedIndex);
      }
    } catch (error) {
      logWarn("PubChem lookup failed", { error: error.message });
      item._pubchemResolved = true; // Phase 7A-4: unblock deferred description

      const nameEl = document.getElementById("chemistry-name-display");
      if (nameEl) {
        nameEl.classList.remove("chemistry-loading");
        nameEl.textContent = "—";
      }
      // Phase 7A-4: PubChem failed — show deferred description (nameless)
      this._upgradeToStructuralDescription(item, expectedIndex);
    }
  }

  /**
   * Phase 6B: Look up compound on PubChem by SMILES notation and back-populate
   * chemistry data with the returned InChI, InChI Key, and compound metadata.
   *
   * This is the PDF-mode equivalent of _lookupAndPopulateName(). After a successful
   * lookup, the chemistry data object is enriched so that navigating back to this
   * structure shows all data immediately without re-fetching.
   *
   * @param {Object} item - Chemistry data object (notation present, inchi/inchiKey null)
   * @param {number} expectedIndex - Structure index at time of call (guards against navigation race)
   * @private
   */
  async _lookupAndPopulateBySmiles(item, expectedIndex) {
    const utils = window.MathPixChemistryUtils;
    if (!utils?.lookupPubChemBySmiles) {
      logWarn("lookupPubChemBySmiles not available on MathPixChemistryUtils");
      item._pubchemResolved = true; // Phase 7A-4: unblock deferred description
      return;
    }

    try {
      const result = await utils.lookupPubChemBySmiles(item.notation);

      // Phase 7A-4: mark PubChem as resolved regardless of result
      item._pubchemResolved = true;

      // Guard: user may have navigated to a different structure while we waited
      if (this._currentStructureIndex !== expectedIndex) {
        logDebug("PubChem SMILES result arrived but structure index changed", {
          expected: expectedIndex,
          current: this._currentStructureIndex,
        });
        return;
      }

      // Back-populate chemistry data so navigation back shows cached data (Phase 6B)
      if (result.found) {
        if (result.inchi) this._chemistryData[expectedIndex].inchi = result.inchi;
        if (result.inchiKey) this._chemistryData[expectedIndex].inchiKey = result.inchiKey;
      }

      const nameEl = document.getElementById("chemistry-name-display");
      if (!nameEl) return;

      nameEl.classList.remove("chemistry-loading");

      if (result.found && result.iupacName) {
        // Build name display with common name if available
        const commonName = result.commonNames?.[0];
        if (commonName) {
          nameEl.textContent = commonName;
          const iupacSpan = document.createElement("span");
          iupacSpan.className = "chemistry-iupac-secondary";
          iupacSpan.textContent = ` (${result.iupacName})`;
          nameEl.appendChild(iupacSpan);
        } else {
          nameEl.textContent = result.iupacName;
        }

        // Phase 6D: Store resolved name and update heading
        this._chemistryData[expectedIndex]._resolvedName = commonName || result.iupacName;
        this._updateChemistryHeading();

        // Phase 7A-3: Re-generate structural description with compound name
        this._upgradeToStructuralDescription(item, expectedIndex);

        // Update molecular weight
        if (result.molecularWeight) {
          const weightDisplay = document.getElementById("chemistry-weight-display");
          if (weightDisplay) {
            weightDisplay.textContent = result.molecularWeight.toFixed(2) + " g/mol";
          }
        }

        // Add PubChem link
        if (result.pubchemUrl) {
          this._addPubChemLink(result.pubchemUrl, result.pubchemCid);
        }

        // Phase 6B: Update InChI and InChI Key displays (were "—" before)
        if (result.inchi) {
          const inchiEl = document.getElementById("chemistry-inchi-display");
          if (inchiEl) inchiEl.textContent = result.inchi;
        }

        if (result.inchiKey) {
          const inchikeyEl = document.getElementById("chemistry-inchikey-display");
          if (inchikeyEl) inchikeyEl.textContent = result.inchiKey;
        }

        // Phase 6B: Update molecular formula display (was "—" before)
        if (result.inchi && utils) {
          const formulaEl = document.getElementById("chemistry-formula-display");
          if (formulaEl) {
            const parsed = utils.parseInChIFormula(result.inchi);
            if (parsed?.raw) {
              formulaEl.innerHTML = utils.formatFormulaAsHTML(parsed.raw);
              formulaEl.setAttribute(
                "aria-label",
                "Molecular formula: " + utils.formatFormulaForScreenReader(parsed.raw)
              );
            }
          }
        }

        // Phase 6B: Enable buttons that were disabled due to missing data
        const copyInchi = document.getElementById("chemistry-copy-inchi-btn");
        if (copyInchi && result.inchi) copyInchi.disabled = false;

        const lookupBtn = document.getElementById("chemistry-lookup-btn");
        if (lookupBtn && result.inchiKey) lookupBtn.disabled = false;

        // Update aria-label on figure with enriched data
        const figure = document.getElementById("chemistry-structure-figure");
        if (figure && utils) {
          const parsed = result.inchi ? utils.parseInChIFormula(result.inchi) : null;
          const descData = {
            notation: item.notation,
            formula: parsed,
            iupacName: commonName || result.iupacName,
          };
          const description = utils.generateBasicAccessibleDescription(descData);
          figure.setAttribute("aria-label", description);
        }

        // Update figcaption with human-readable name
        const caption = document.getElementById("chemistry-structure-caption");
        if (caption) {
          caption.textContent = `2D structural diagram of ${commonName || result.iupacName}`;
        }

        // Announce to screen readers
        const displayName = commonName || result.iupacName;
        this._announceChemistry(`Compound identified: ${displayName}`);

        logInfo("PubChem SMILES lookup populated and back-populated", {
          smiles: item.notation,
          iupacName: result.iupacName,
          commonName,
          cid: result.pubchemCid,
          backPopulated: { inchi: !!result.inchi, inchiKey: !!result.inchiKey },
        });
      } else {
        nameEl.textContent = "Not found in PubChem";
        nameEl.classList.add("chemistry-not-found");
        logDebug("Compound not found in PubChem by SMILES", { smiles: item.notation });
        // Phase 7A-4: PubChem resolved with no name — show deferred description
        this._upgradeToStructuralDescription(item, expectedIndex);
      }
    } catch (error) {
      logWarn("PubChem SMILES lookup failed", { error: error.message });
      item._pubchemResolved = true; // Phase 7A-4: unblock deferred description

      const nameEl = document.getElementById("chemistry-name-display");
      if (nameEl) {
        nameEl.classList.remove("chemistry-loading");
        nameEl.textContent = "—";
      }
      // Phase 7A-4: PubChem failed — show deferred description (nameless)
      this._upgradeToStructuralDescription(item, expectedIndex);
    }
  }

  /**
   * Add a PubChem link to the chemistry panel identifiers list.
   *
   * @param {string} url - PubChem compound URL
   * @param {number|null} cid - PubChem CID for display
   * @private
   */
  _addPubChemLink(url, cid) {
    // Check if link already exists
    let linkEl = document.getElementById("chemistry-pubchem-link");

    if (!linkEl) {
      // Create PubChem link row in the identifiers section
      const dataList = document.querySelector(".chemistry-data-list");
      if (!dataList) return;

      const row = document.createElement("div");
      row.className = "chemistry-data-row";
      row.id = "chemistry-row-pubchem";

      const dt = document.createElement("dt");
      dt.textContent = "PubChem";

      const dd = document.createElement("dd");
      const link = document.createElement("a");
      link.id = "chemistry-pubchem-link";
      link.className = "chemistry-value chemistry-link";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      dd.appendChild(link);

      row.appendChild(dt);
      row.appendChild(dd);
      dataList.appendChild(row);

      linkEl = link;
    }

    if (linkEl) {
      linkEl.href = url;
      linkEl.textContent = cid ? `CID ${cid} — View on PubChem` : "View on PubChem";
      linkEl.setAttribute(
        "aria-label",
        cid
          ? `View compound CID ${cid} on PubChem (opens in new tab)`
          : "View on PubChem (opens in new tab)"
      );
    }
  }

  /**
   * Phase 6E (E2): Announce the newly-navigated structure's name and formula.
   * Only called from prev/next button handlers, not from initial load.
   *
   * @private
   */
  _announceNavigatedStructure() {
    const item = this._chemistryData?.[this._currentStructureIndex];
    if (!item) return;

    const index = this._currentStructureIndex;
    const utils = window.MathPixChemistryUtils;

    // Phase 7A-3: Try structural description first (richer announcement)
    if (utils?.generateStructuralDescription) {
      const pubchemData = {
        commonNames: item.commonNames || (item._resolvedName ? [item._resolvedName] : []),
        iupacName: item.iupacName || null,
        molecularWeight: item.molecularWeight || null,
        molecularFormula: item.molecularFormula || null,
        inchi: item.inchi || null,
      };
      const desc = utils.generateStructuralDescription(item.notation, pubchemData);
      if (desc) {
        this._announceChemistry(desc);
        return;
      }
    }

    // Fallback: name + formula announcement
    const name = item._resolvedName;
    const parsed = item.inchi ? utils?.parseInChIFormula(item.inchi) : null;
    const formula = parsed?.raw || null;

    if (name && formula) {
      this._announceChemistry(`Showing ${name}, ${utils.formatFormulaForScreenReader(formula)}`);
    } else if (name) {
      this._announceChemistry(`Showing ${name}`);
    } else {
      this._announceChemistry(`Showing structure ${index + 1}`);
    }
  }

  /**
   * Phase 7A-3: Upgrade the chemistry panel with a structural description.
   * Called from the onGraphReady callback after SmilesDrawer has rendered.
   *
   * @param {Object} item - Chemistry data item
   * @param {number} expectedIndex - Index when the render was initiated
   * @private
   */
  _upgradeToStructuralDescription(item, expectedIndex) {
    // Guard: user may have navigated away while render was in progress
    if (this._currentStructureIndex !== expectedIndex) return;

    const utils = window.MathPixChemistryUtils;
    if (!utils?.generateStructuralDescription) return;

    // Build pubchemData from whatever we know at this point
    const pubchemData = {
      commonNames: item.commonNames || (item._resolvedName ? [item._resolvedName] : []),
      iupacName: item.iupacName || null,
      molecularWeight: item.molecularWeight || null,
      molecularFormula: item.molecularFormula || null,
      inchi: item.inchi || null,
    };

    // Phase 7A-4: Check item-level cache first.
    // Reuse the cached description if it already includes the compound name
    // (i.e., PubChem has resolved and the description was regenerated with the name).
    // When PubChem resolves a name, the caller re-invokes us with updated pubchemData,
    // so we skip the cache when the name is available but the cached description
    // doesn't start with it — that means we need to regenerate to include the name prefix.
    const namePrefix = pubchemData.commonNames?.[0];
    const cachedDesc = item._structuralDescription;
    if (cachedDesc) {
      // Phase 7A-5b: case-insensitive comparison — PubChem names are lowercase
      // but generateStructuralDescription capitalises the first character
      const nameAlreadyIncluded = !namePrefix ||
        cachedDesc.toLowerCase().startsWith(namePrefix.toLowerCase());
      if (nameAlreadyIncluded) {
        // Serve from item cache — show immediately, no deferral needed
        this._showStructuralDescription(cachedDesc, item);
        logInfo("Structural description served from item cache", { smiles: item.notation });
        return;
      }
    }

    const desc = utils.generateStructuralDescription(item.notation, pubchemData);
    if (!desc) return;

    // Phase 7A-4: Cache on the item so navigation / resume can reuse it
    // without needing the molecular graph cache
    item._structuralDescription = desc;

    // Phase 7A-4: Deferred display — avoid flicker for vestibular/seizure safety.
    // On the very first render, PubChem hasn't resolved yet. Rather than showing
    // a nameless description and then flashing in the name ~1 second later, we
    // defer display until PubChem completes (or a 10-second timeout fires).
    // Once PubChem has resolved (success or failure), show immediately.
    if (item._pubchemResolved || namePrefix) {
      // PubChem done or name already available — show now
      if (item._structDescTimerId) {
        clearTimeout(item._structDescTimerId);
        item._structDescTimerId = null;
      }
      this._showStructuralDescription(desc, item);
      logInfo("Structural description set", { smiles: item.notation, desc });
    } else {
      // PubChem still pending — defer display, wait up to 10 seconds
      if (!item._structDescTimerId) {
        item._structDescTimerId = setTimeout(() => {
          item._structDescTimerId = null;
          if (this._currentStructureIndex !== expectedIndex) return;
          const currentDesc = item._structuralDescription;
          if (currentDesc) {
            this._showStructuralDescription(currentDesc, item);
            logInfo("Structural description shown after PubChem timeout", {
              smiles: item.notation,
            });
          }
        }, 10000);
      }
      logDebug("Structural description deferred — waiting for PubChem", {
        smiles: item.notation,
      });
    }
  }

  /**
   * Phase 7A-4: Show a structural description in the DOM.
   * Extracted helper to avoid duplication between immediate and deferred paths.
   *
   * @param {string} desc - Description text to display
   * @param {Object} item - Chemistry data item (for aiDescribed check)
   * @private
   */
  _showStructuralDescription(desc, item) {
    const textEl = document.getElementById("chemistry-structural-desc-text");
    const container = document.getElementById("chemistry-structural-description");
    if (textEl) textEl.textContent = desc;
    if (container) container.style.display = "";

    // Phase 8C-ST: use short description for aria-label (standard remains as visible text)
    const figure = document.getElementById("chemistry-structure-figure");
    if (figure && !figure.dataset.aiDescribed) {
      const utils = window.MathPixChemistryUtils;
      if (utils?.generateShortDescriptionForAria && item?.notation) {
        const pubchemData = {
          commonNames: item.commonNames || (item._resolvedName ? [item._resolvedName] : []),
          iupacName: item.iupacName || null,
          molecularWeight: item.molecularWeight || null,
          molecularFormula: item.molecularFormula || null,
          inchi: item.inchi || null,
        };
        const shortDesc = utils.generateShortDescriptionForAria(item.notation, pubchemData);
        figure.setAttribute("aria-label", shortDesc || desc);
      } else {
        figure.setAttribute("aria-label", desc);
      }
    }
  }

  /**
   * Announce a message via the chemistry live region.
   *
   * @param {string} message - Message to announce
   * @private
   */
  _announceChemistry(message) {
    const liveRegion = document.getElementById("chemistry-live-region");
    if (liveRegion) {
      liveRegion.textContent = "";
      // Brief delay ensures screen readers detect the change
      requestAnimationFrame(() => {
        liveRegion.textContent = message;
      });
    }
  }

  /**
   * Show or hide chemistry tab based on content detection
   * @param {boolean} visible - Whether to show the chemistry tab
   */
  showChemistryTab(visible) {
    // Update tab button
    const tabButton = document.getElementById("mathpix-tab-smiles");
    if (tabButton) {
      tabButton.style.display = visible ? "" : "none";
      if (visible) {
        tabButton.removeAttribute("aria-disabled");
      } else {
        tabButton.setAttribute("aria-disabled", "true");
      }
      logDebug(`Chemistry tab button ${visible ? "shown" : "hidden"}`);
    } else {
      logWarn("SMILES tab button not found in DOM");
    }

    // Legacy: Update radio button if it still exists
    const formatOption = document.getElementById("mathpix-format-smiles");
    if (formatOption) {
      const parentLabel = formatOption.closest(".mathpix-format-option");
      if (parentLabel) {
        parentLabel.style.display = visible ? "flex" : "none";
        formatOption.disabled = !visible;
        logDebug(`Chemistry radio ${visible ? "shown" : "hidden"} (legacy)`);
      }
    }

    logDebug(`Chemistry tab ${visible ? "shown" : "hidden"}`, {
      tabButtonFound: !!tabButton,
      visible: visible,
    });
  }

  /**
   * Get human-readable type label
   * @param {string} type - Line type from API
   * @param {string} [subtype] - Optional subtype
   * @returns {string} Human-readable label
   */
  getTypeLabel(type, subtype = null) {
    const typeLabels = {
      text: "Text",
      math: "Mathematical equation",
      diagram: "Diagram",
      table: "Table",
      chart: "Chart",
      equation_number: "Equation number",
      page_info: "Page information",
      chemistry: "Chemistry structure", // Phase 4: Chemistry type
      unknown: "Unknown content",
    };

    const baseLabel = typeLabels[type] || typeLabels.unknown;

    // Add subtype if available and meaningful
    if (subtype) {
      const subtypeLabels = {
        chemistry: "Chemistry diagram",
        chemistry_reaction: "Chemistry reaction",
        triangle: "Triangle diagram",
        algorithm: "Algorithm",
        pseudocode: "Pseudocode",
        column: "Column chart",
        bar: "Bar chart",
        line: "Line chart",
        pie: "Pie chart",
        scatter: "Scatter chart",
        area: "Area chart",
        vertical: "Vertical text",
        big_capital_letter: "Large capital letter",
      };

      return subtypeLabels[subtype] || `${baseLabel} (${subtype})`;
    }

    return baseLabel;
  }

  /**
   * Get human-readable error reason
   * @param {string} errorId - Error ID from API
   * @returns {string} Human-readable error description
   */
  getErrorReason(errorId) {
    const errorReasons = {
      image_not_supported: "Not supported by OCR engine",
      image_max_size: "Element exceeds maximum size",
      math_confidence: "Low confidence recognition",
      image_no_content: "Invalid image dimensions",
    };

    return errorReasons[errorId] || "Unknown reason";
  }

  /**
   * Display responsive visual comparison with MathJax integration
   * @param {File} originalFile - The original uploaded file
   * @param {Object} result - The processing result
   */
  displayResponsiveComparison(originalFile, result) {
    logInfo("Creating responsive visual comparison", {
      originalFile: originalFile.name,
      hasLatex: !!result.latex,
      confidence: result.confidence,
      resultFormats: Object.keys(result).filter(
        (key) =>
          result[key] && typeof result[key] === "string" && result[key].trim(),
      ),
    });

    try {
      // Get or create comparison container
      const comparisonContainer = this.getOrCreateComparisonContainer();
      if (!comparisonContainer) {
        logError("Failed to create comparison container");
        return false;
      }

      // Populate original image panel
      this.populateOriginalImagePanel(originalFile);

      // Populate processed output panel with MathJax integration
      this.populateProcessedOutputPanel(result);

      // Update confidence indicator
      this.updateConfidenceIndicator(result.confidence || 0);

      // Show comparison container with responsive layout
      comparisonContainer.style.display = "grid";
      this.controller.elements.comparisonContainer = comparisonContainer;

      logInfo("Responsive visual comparison displayed successfully", {
        originalFile: originalFile.name,
        confidence: Math.round((result.confidence || 0) * 100),
        outputRendered: true,
      });

      return true;
    } catch (error) {
      logError("Failed to display responsive comparison", error);
      this.showNotification("Failed to create visual comparison", "error");
      return false;
    }
  }

  /**
   * Get or create the comparison container element
   * @returns {HTMLElement|null} The comparison container element
   */
  getOrCreateComparisonContainer() {
    let container = document.getElementById("mathpix-comparison-container");

    if (!container) {
      logWarn(
        "Comparison container not found in DOM - this should be present in boilerplate.html",
      );
      return null;
    }

    logDebug("Comparison container found and ready", {
      hasContainer: !!container,
      currentDisplay: container.style.display,
    });

    return container;
  }

  /**
   * Populate the original image panel with uploaded file
   * @param {File} originalFile - The original uploaded file
   */
  populateOriginalImagePanel(originalFile) {
    const originalImage = document.getElementById("mathpix-original-image");
    const originalInfo = document.getElementById("mathpix-original-info");

    if (!originalImage || !originalInfo) {
      logWarn("Original image panel elements not found");
      return false;
    }

    try {
      // Clean up any existing blob URL
      if (originalImage.src && originalImage.src.startsWith("blob:")) {
        URL.revokeObjectURL(originalImage.src);
      }

      // Create new blob URL for original image
      const imageUrl = URL.createObjectURL(originalFile);

      // Set up original image
      originalImage.src = imageUrl;
      originalImage.alt = `Original mathematics: ${originalFile.name}`;
      originalImage.style.display = "block";

      // Populate file information with screen reader context
      if (this.controller.fileHandler) {
        originalInfo.innerHTML = `
    <strong>
      <span class="sr-only">Filename: </span>${originalFile.name}
    </strong><br>
    <span class="sr-only">File size: </span>${this.controller.fileHandler.formatFileSize(
      originalFile.size,
    )} | <span class="sr-only">File type: </span>${this.controller.fileHandler.getFileTypeDescription(
      originalFile.type,
    )}
  `;
      } else {
        originalInfo.innerHTML = `<strong><span class="sr-only">Filename: </span>${originalFile.name}</strong>`;
      }

      // Store blob URL for cleanup
      originalImage.dataset.blobUrl = imageUrl;

      logDebug("Original image panel populated", {
        fileName: originalFile.name,
        blobUrl: imageUrl,
      });

      return true;
    } catch (error) {
      logError("Failed to populate original image panel", error);
      return false;
    }
  }

  /**
   * Protect currency dollar signs from MathJax by wrapping them in ignore spans
   * This allows MathJax to still process real math equations while preserving currency
   * @param {string} html - The HTML string to process
   * @returns {string} - HTML with currency values protected
   */
  protectCurrencyFromMathJax(html) {
    if (!html || typeof html !== "string") return html;

    // Wrap currency patterns in spans that MathJax will ignore
    // Pattern matches: $ followed by optional spaces and digits (with optional decimal)
    // Examples: $300, $20, $1200, $99.99, $ 50
    // Won't match LaTeX expressions like $x$ or $\frac{1}{2}$ or $x^2$
    const protectedHtml = html.replace(
      /\$(\s*\d+(?:\.\d{2})?)/g,
      '<span class="tex2jax_ignore">$$$1</span>',
    );

    logDebug("Protected currency dollar signs from MathJax", {
      originalLength: html.length,
      protectedLength: protectedHtml.length,
      changesMade: html !== protectedHtml,
    });

    return protectedHtml;
  }

  populateProcessedOutputPanel(result) {
    const renderedOutput = document.getElementById("mathpix-rendered-output");

    if (!renderedOutput) {
      logWarn("Rendered output element not found");
      return false;
    }

    try {
      // Phase 7B: Reset human-readable section
      const capturedTextContainer = document.getElementById("mathpix-captured-text-description");
      if (capturedTextContainer) capturedTextContainer.hidden = true;

      // Clear existing content
      renderedOutput.innerHTML = "";

      // CRITICAL: Check for tables FIRST before MathJax rendering
      if (result.containsTable && result.tableHtml) {
        logDebug("Displaying table preview in comparison view");

        // Protect currency values from MathJax while allowing real math to be processed
        let processedTableHtml = this.protectCurrencyFromMathJax(
          result.tableHtml,
        );

        // Remove display:none from mathml tags only so MathJax renders are visible
        // MathPix API hides format tags by default, but MathJax inserts rendered SVG inside <mathml>
        // Keep <latex> and <asciimath> hidden since they contain raw text strings
        processedTableHtml = processedTableHtml.replace(
          /<mathml\s+style="display:\s*none;"/gi,
          '<mathml style="display: inline;"',
        );

        renderedOutput.innerHTML = processedTableHtml;
        renderedOutput.style.overflow = "auto";
        renderedOutput.style.maxHeight = "400px";
        renderedOutput.classList.add("mathjax-rendered");

        // Process mathematics within table cells - currency values are now protected
        // MathJax will skip <span class="tex2jax_ignore"> elements
        if (window.mathJaxManager) {
          window.mathJaxManager
            .queueTypeset(renderedOutput)
            .then(() => logDebug("MathJax processed equations in table cells"))
            .catch((error) =>
              logWarn("Failed to process math in table cells", error),
            );
        } else if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([renderedOutput])
            .then(() => logDebug("MathJax processed table cells (direct)"))
            .catch((error) =>
              logWarn("Failed to process math in table cells", error),
            );
        }

        return true;
      }

      // Determine best content to render
      // Phase 6J: Prefer result.latex (which is apiResponse.text — MMD format)
      // for the CDN path, as it handles <smiles>, LaTeX, and mixed content natively.
      let contentToRender = "";
      let renderType = "text";

      if (result.latex && result.latex.trim()) {
        contentToRender = result.latex;
        renderType = "latex";
        logDebug("Using LaTeX/MMD content for rendering");
      } else if (result.mathml && result.mathml.trim()) {
        contentToRender = result.mathml;
        renderType = "mathml";
        logDebug("Using MathML content for rendering");
      } else if (result.asciimath && result.asciimath.trim()) {
        contentToRender = result.asciimath;
        renderType = "asciimath";
        logDebug("Using AsciiMath content for rendering");
      } else if (result.html && result.html.trim()) {
        contentToRender = result.html;
        renderType = "html";
        logDebug("Using HTML content for rendering");
      } else {
        contentToRender =
          "No mathematical content could be extracted from this image.";
        renderType = "text";
        logWarn("No suitable content found for rendering");
      }

      // Phase 6J: Try CDN rendering first (handles chemistry + maths natively)
      // Show a loading message while the CDN loads, then render.
      // Falls back to MathJax if CDN is unavailable.
      if (renderType === "latex" || renderType === "text") {
        // Check if CDN is already loaded — render immediately if so
        if (typeof window.markdownToHTML === "function") {
          const cdnSuccess = this.renderWithCDNLibrary(
            contentToRender,
            renderedOutput,
          );
          if (cdnSuccess) {
            logInfo("Phase 6J: Comparison panel rendered via CDN (immediate)");
            // Phase 7B: Add chemistry alt text to CDN-rendered structures
            this.addChemistryAltText(renderedOutput);
            // Phase 7B: Populate human-readable text
            this.populateCapturedTextDescription(result);
            return true;
          }
          // CDN render failed — fall through to MathJax
        } else {
          // CDN not loaded yet — show loading indicator and load async
          renderedOutput.innerHTML =
            '<div class="phase6j-loading" role="status">' +
            '<span aria-hidden="true" data-icon="hourglass"></span> ' +
            "Loading preview renderer\u2026" +
            "</div>";

          // Kick off async CDN load + render, fall back to MathJax on failure
          this.ensureCDNLibraryLoaded().then((loaded) => {
            if (loaded) {
              const cdnSuccess = this.renderWithCDNLibrary(
                contentToRender,
                renderedOutput,
              );
              if (cdnSuccess) {
                logInfo(
                  "Phase 6J: Comparison panel rendered via CDN (after load)",
                );
                // Phase 7B: Add chemistry alt text to CDN-rendered structures
                this.addChemistryAltText(renderedOutput);
                // Phase 7B: Populate human-readable text
                this.populateCapturedTextDescription(result);
                return;
              }
            }

            // CDN unavailable or failed — fall back to MathJax
            logInfo("Phase 6J: Falling back to MathJax for comparison panel");
            this.renderContentWithMathJax(
              contentToRender,
              renderType,
              renderedOutput,
            );
          });

          return true;
        }
      }

      // MathJax fallback path (also used for mathml, asciimath, html types)
      this.renderContentWithMathJax(
        contentToRender,
        renderType,
        renderedOutput,
      );

      return true;
    } catch (error) {
      logError("Failed to populate processed output panel", error);
      renderedOutput.innerHTML = `<div class="error-message">Failed to render mathematical content</div>`;
      return false;
    }
  }

  /**
   * Update confidence indicator with color coding
   * @param {number} confidence - Confidence value (0-1)
   */
  updateConfidenceIndicator(confidence) {
    const confidenceBadge = document.getElementById("mathpix-confidence-badge");

    if (!confidenceBadge) {
      logWarn("Confidence badge element not found");
      return false;
    }

    try {
      const confidencePercent = Math.round(confidence * 100);
      confidenceBadge.textContent = `${confidencePercent}%`;

      // Remove existing confidence classes
      confidenceBadge.classList.remove(
        "mathpix-confidence-high",
        "mathpix-confidence-medium",
        "mathpix-confidence-low",
      );

      // Apply appropriate confidence class based on percentage
      let confidenceClass = "mathpix-confidence-low";
      let confidenceLabel = "Low";

      if (confidencePercent >= 80) {
        confidenceClass = "mathpix-confidence-high";
        confidenceLabel = "High";
      } else if (confidencePercent >= 60) {
        confidenceClass = "mathpix-confidence-medium";
        confidenceLabel = "Medium";
      }

      confidenceBadge.classList.add(confidenceClass);
      confidenceBadge.setAttribute(
        "aria-label",
        `Confidence: ${confidencePercent}% (${confidenceLabel})`,
      );

      logDebug("Confidence indicator updated", {
        confidence: confidence,
        percent: confidencePercent,
        class: confidenceClass,
        label: confidenceLabel,
      });

      return true;
    } catch (error) {
      logError("Failed to update confidence indicator", error);
      return false;
    }
  }

  /**
   * Hide responsive comparison and clean up resources
   */
  hideResponsiveComparison() {
    const comparisonContainer = document.getElementById(
      "mathpix-comparison-container",
    );

    if (comparisonContainer) {
      comparisonContainer.style.display = "none";
    }

    // Clean up blob URLs
    const originalImage = document.getElementById("mathpix-original-image");
    if (originalImage && originalImage.dataset.blobUrl) {
      URL.revokeObjectURL(originalImage.dataset.blobUrl);
      delete originalImage.dataset.blobUrl;
      originalImage.src = "";
      originalImage.style.display = "none";
    }

    // Clear rendered output
    const renderedOutput = document.getElementById("mathpix-rendered-output");
    if (renderedOutput) {
      renderedOutput.innerHTML = "";
      renderedOutput.classList.remove(
        "mathjax-rendered",
        "mathjax-fallback",
        "no-mathjax",
      );
    }

    // Reset confidence indicator
    const confidenceBadge = document.getElementById("mathpix-confidence-badge");
    if (confidenceBadge) {
      confidenceBadge.textContent = "";
      confidenceBadge.classList.remove(
        "mathpix-confidence-high",
        "mathpix-confidence-medium",
        "mathpix-confidence-low",
      );
    }

    this.controller.elements.comparisonContainer = null;

    logDebug("Responsive comparison hidden and resources cleaned up");
  }

  /**
   * Perform post-processing UI cleanup
   */
  performPostProcessingCleanup() {
    logDebug("Performing post-processing UI cleanup");

    // Hide the image preview container since we now have comparison panel
    const previewContainer = document.getElementById(
      "mathpix-image-preview-container",
    );
    if (previewContainer) {
      previewContainer.style.display = "none";
      logDebug("Image preview container hidden after processing");
    }

    // Phase 4: Move open original button to comparison panel if configured
    if (MATHPIX_CONFIG.PHASE_4?.MOVE_BUTTON_TO_COMPARISON !== false) {
      this.relocateOpenOriginalButton();
    }

    logDebug("Post-processing UI cleanup completed", {
      previewContainerHidden: !!previewContainer,
      buttonRelocated:
        MATHPIX_CONFIG.PHASE_4?.MOVE_BUTTON_TO_COMPARISON !== false,
    });
  }

  /**
   * Relocate open original button to comparison panel
   */
  relocateOpenOriginalButton() {
    const originalBtn = document.getElementById("mathpix-open-original-btn");
    const originalImagePanel = document.querySelector(
      ".mathpix-comparison-panel:first-child",
    );

    if (
      originalBtn &&
      originalImagePanel &&
      this.controller.fileHandler?.getCurrentFile()
    ) {
      // Check if button already exists in comparison panel
      let comparisonBtn = document.getElementById(
        "mathpix-comparison-open-btn",
      );

      if (comparisonBtn) {
        // Button already exists - just update its onclick handler and ensure visibility
        // Use currentUploadedFile directly (synchronous) - getCurrentFile() is async
        comparisonBtn.onclick = () =>
          this.controller.fileHandler.openOriginalInNewWindow(
            this.controller.fileHandler.currentUploadedFile,
          );
        comparisonBtn.style.display = "inline-flex";

        // Ensure accessibility compliance - button should not have aria-hidden
        comparisonBtn.removeAttribute("aria-hidden");

        logDebug("Updated existing open original button in comparison panel");
      } else {
        // Button doesn't exist - create it
        const newBtn = originalBtn.cloneNode(true);
        newBtn.id = "mathpix-comparison-open-btn"; // Unique ID for comparison panel
        newBtn.style.display = "inline-flex";
        // Use currentUploadedFile directly (synchronous) - getCurrentFile() is async
        newBtn.onclick = () =>
          this.controller.fileHandler.openOriginalInNewWindow(
            this.controller.fileHandler.currentUploadedFile,
          );

        // CRITICAL: Remove aria-hidden from button (WCAG 2.2 AA compliance)
        // Interactive elements must not be hidden from assistive technology
        // Only decorative icons within the button should have aria-hidden
        newBtn.removeAttribute("aria-hidden");

        // Find the file info div in the comparison panel
        const originalInfo = originalImagePanel.querySelector(
          "#mathpix-original-info",
        );

        if (originalInfo) {
          // Insert button after the file info div
          originalInfo.insertAdjacentElement("afterend", newBtn);
          logDebug(
            "Open original button relocated to comparison panel after file info",
          );
        } else {
          // Fallback - try to find the title and add after it
          const comparisonTitle = originalImagePanel.querySelector(
            ".mathpix-comparison-title",
          );
          if (comparisonTitle) {
            comparisonTitle.insertAdjacentElement("afterend", newBtn);
            logDebug(
              "Open original button relocated to comparison panel after title (fallback)",
            );
          } else {
            // Final fallback - add to beginning of panel
            originalImagePanel.insertBefore(
              newBtn,
              originalImagePanel.firstChild,
            );
            logDebug(
              "Open original button added to comparison panel (final fallback)",
            );
          }
        }
      }

      // Hide original button in preview container
      originalBtn.style.display = "none";
    }
  }
  // =========================================================================
  // Phase 6J: CDN Library Rendering for Comparison Panel
  // =========================================================================

  /**
   * Ensure the mathpix-markdown-it CDN library is loaded and ready.
   * Lazy-loads via the controller's MMD Preview instance if not already available.
   * @returns {Promise<boolean>} True if library is ready, false if loading failed
   * @since Phase 6J
   */
  async ensureCDNLibraryLoaded() {
    // Already available — nothing to do
    if (typeof window.markdownToHTML === "function") {
      logDebug("Phase 6J: CDN library already available");
      return true;
    }

    // Try to load via the controller's MMD Preview system
    try {
      let mmdPreview = this.controller.mmdPreview;
      if (!mmdPreview) {
        mmdPreview = this.controller.initMMDPreview();
      }

      if (!mmdPreview) {
        logWarn("Phase 6J: Could not initialise MMD Preview for CDN loading");
        return false;
      }

      logInfo("Phase 6J: Loading CDN library for comparison panel...");
      await mmdPreview.loadLibrary();

      if (typeof window.markdownToHTML === "function") {
        logInfo("Phase 6J: CDN library loaded successfully");
        return true;
      }

      logWarn("Phase 6J: CDN library loaded but markdownToHTML not available");
      return false;
    } catch (error) {
      logWarn("Phase 6J: CDN library loading failed, will fall back to MathJax", error);
      return false;
    }
  }

  /**
   * Render content using the mathpix-markdown-it CDN library.
   * Handles LaTeX, chemistry (<smiles> tags), and mixed content natively.
   * @param {string} content - MMD/LaTeX content from the API response
   * @param {HTMLElement} targetElement - Target element for rendered output
   * @returns {boolean} True if rendering succeeded
   * @since Phase 6J
   */
  renderWithCDNLibrary(content, targetElement) {
    if (typeof window.markdownToHTML !== "function") {
      logWarn("Phase 6J: markdownToHTML not available for CDN rendering");
      return false;
    }

    try {
      // Use the same render options as the MMD Preview system
      const renderOptions = MATHPIX_CONFIG.MMD_PREVIEW?.RENDER_OPTIONS || {
        htmlTags: true,
        mmdExtensions: { smiles: true },
        accessibility: { assistiveMml: true },
      };

      const html = window.markdownToHTML(content, renderOptions);

      if (!html || !html.trim()) {
        logWarn("Phase 6J: CDN produced empty output");
        return false;
      }

      targetElement.innerHTML = html;
      targetElement.classList.add("mathjax-rendered", "phase6j-cdn-rendered");

      // Prevent MathJax from re-processing CDN-rendered content.
      // The CDN already produces MathML for screen readers; MathJax
      // re-processing would cause duplicate or broken output.
      targetElement.classList.add("tex2jax_ignore");

      // Clean up any duplicate MathJax containers that page MathJax
      // may have created before tex2jax_ignore took effect
      if (typeof window.sanitiseMathPixPreviewMath === "function") {
        window.sanitiseMathPixPreviewMath();
      }

      logInfo("Phase 6J: CDN rendering successful", {
        inputLength: content.length,
        outputLength: html.length,
        hasSmiles: content.includes("<smiles"),
        hasMath: /\$|\\\(|\\\[/.test(content),
      });

      return true;
    } catch (error) {
      logError("Phase 6J: CDN rendering failed", error);
      return false;
    }
  }

  /**
   * Render content with MathJax integration using existing MathJax system
   * @param {string} content - Content to render
   * @param {string} type - Type of content (latex, mathml, asciimath, html, text)
   * @param {HTMLElement} targetElement - Target element for rendering
   */
  async renderContentWithMathJax(content, type, targetElement) {
    logDebug("Rendering content with MathJax integration", {
      contentLength: content.length,
      type: type,
      mathJaxAvailable: typeof window.MathJax !== "undefined",
      mathJaxReady: !!(window.MathJax && window.MathJax.typesetPromise),
      originalContent: content.substring(0, 100) + "...",
    });

    try {
      // Clean and prepare content for MathJax rendering based on type
      let displayContent = "";

      switch (type) {
        case "latex":
          // Clean LaTeX content and ensure proper delimiters
          displayContent = this.cleanLatexForMathJax(content);
          break;

        case "mathml":
          displayContent = content; // MathML can be rendered directly
          break;

        case "asciimath":
          // Convert AsciiMath to LaTeX display format
          displayContent = `\\[${content}\\]`;
          break;

        case "html":
          displayContent = content; // HTML can be inserted directly
          break;

        default:
          displayContent = `<pre class="math-text-fallback">${content}</pre>`;
          break;
      }

      // Insert content into target element
      targetElement.innerHTML = displayContent;

      logDebug("Content prepared for MathJax", {
        originalContent: content.substring(0, 50) + "...",
        preparedContent: displayContent.substring(0, 50) + "...",
        type: type,
      });

      // Use MathJax Manager for safe, queued rendering
      logDebug("Initiating MathJax Manager rendering...");

      // Clear any existing MathJax classes
      targetElement.classList.remove(
        "mathjax-rendered",
        "mathjax-fallback",
        "no-mathjax",
      );

      // Ensure the element is visible and in the DOM before rendering
      const ensureMathJaxProcessing = async () => {
        // Validate element state
        const isVisible = targetElement.offsetParent !== null;
        const isInDOM = document.contains(targetElement);
        const hasContent = targetElement.innerHTML.trim().length > 0;

        logDebug("Pre-MathJax element state", {
          isVisible: isVisible,
          isInDOM: isInDOM,
          hasContent: hasContent,
          elementDisplay: getComputedStyle(targetElement).display,
          elementVisibility: getComputedStyle(targetElement).visibility,
          innerHTML: targetElement.innerHTML.substring(0, 100) + "...",
        });

        if (!isVisible || !isInDOM || !hasContent) {
          logWarn("Element not ready for MathJax processing", {
            isVisible: isVisible,
            isInDOM: isInDOM,
            hasContent: hasContent,
          });

          // Retry after a short delay
          setTimeout(() => {
            if (document.contains(targetElement)) {
              ensureMathJaxProcessing();
            }
          }, 100);
          return;
        }

        // Render using MathJax Manager queue system
        try {
          const renderSuccess =
            await this.renderWithMathJaxManager(targetElement);

          if (renderSuccess) {
            logInfo("✅ MathJax rendering completed successfully", {
              type: type,
              contentPreview: content.substring(0, 50) + "...",
              finalHTML: targetElement.innerHTML.substring(0, 100) + "...",
            });

            // Add success indicator
            targetElement.classList.add("mathjax-rendered");

            // Apply MathPix-specific MathJax enhancements
            this.applyMathPixMathJaxEnhancements(targetElement);

            // Verify MathJax actually processed the content
            const hasMathJaxElements = targetElement.querySelector(
              ".MathJax, mjx-container, .MathJax_Display, mjx-math",
            );

            if (hasMathJaxElements) {
              logInfo("✅ MathJax elements detected - rendering successful", {
                mathJaxElementType: hasMathJaxElements.tagName,
                mathJaxClasses: hasMathJaxElements.className,
              });
            } else {
              logWarn(
                "⚠️ MathJax completed but no MathJax elements found - trying alternatives",
              );

              // Try alternative rendering approach
              await this.tryAlternativeMathJaxRendering(
                content,
                type,
                targetElement,
              );
            }
          } else {
            throw new Error("MathJax Manager rendering returned false");
          }
        } catch (error) {
          logWarn("MathJax rendering failed, showing plain content", error);

          // Fallback to plain content display with readable formatting
          if (type === "latex") {
            // Make LaTeX more readable without MathJax
            const readableLatex = content
              .replace(/\\\\/g, "\\")
              .replace(/\\\{/g, "{")
              .replace(/\\\}/g, "}");
            targetElement.innerHTML = `<pre class="latex-fallback">${readableLatex}</pre>`;
          } else {
            targetElement.innerHTML = `<pre class="math-fallback">${content}</pre>`;
          }
          targetElement.classList.add("mathjax-fallback");

          // Register for MathJax recovery
          this.pendingMathJaxRender = true;
          this.lastRenderedElement = targetElement;

          // Register element with MathJax Manager for recovery notification
          if (window.mathJaxManager?.registerPendingElement) {
            window.mathJaxManager.registerPendingElement(targetElement, {
              source: "mathpix-result-renderer",
              reason: "mathjax-rendering-failed",
              error: error.message,
              contentType: type,
            });
            logInfo("Registered rendered output for MathJax recovery");
          }
        }
      };

      // Start the MathJax processing with proper timing
      requestAnimationFrame(() => {
        ensureMathJaxProcessing();
      });

      logDebug("Content rendering initiated", {
        type: type,
        mathJaxAvailable: typeof window.MathJax !== "undefined",
        managerAvailable: !!window.mathJaxManager,
      });
    } catch (error) {
      logError("Content rendering failed", error);
      targetElement.innerHTML = `<div class="render-error">Rendering failed: ${error.message}</div>`;
    }
  }

  /**
   * Wait for MathJax to be fully initialised and ready
   * @param {number} timeout - Maximum time to wait in milliseconds
   * @returns {Promise<boolean>} True if MathJax is ready, false if timeout
   */
  waitForMathJax(timeout = 5000) {
    return new Promise((resolve) => {
      // Check if MathJax is already ready
      if (
        typeof window.MathJax !== "undefined" &&
        window.MathJax.typesetPromise &&
        typeof window.MathJax.typesetPromise === "function"
      ) {
        logDebug("MathJax already ready");
        resolve(true);
        return;
      }

      logDebug("MathJax not ready, waiting for initialisation...", {
        mathJaxExists: typeof window.MathJax !== "undefined",
        hasTypesetPromise: !!(window.MathJax && window.MathJax.typesetPromise),
        timeout: timeout,
      });

      let elapsed = 0;
      const checkInterval = 100; // Check every 100ms

      const checkMathJax = setInterval(() => {
        elapsed += checkInterval;

        if (
          typeof window.MathJax !== "undefined" &&
          window.MathJax.typesetPromise &&
          typeof window.MathJax.typesetPromise === "function"
        ) {
          logInfo("✅ MathJax became ready", {
            elapsedTime: elapsed + "ms",
          });
          clearInterval(checkMathJax);
          resolve(true);
        } else if (elapsed >= timeout) {
          logWarn("⚠️ MathJax wait timeout reached", {
            timeout: timeout + "ms",
            mathJaxExists: typeof window.MathJax !== "undefined",
          });
          clearInterval(checkMathJax);
          resolve(false);
        } else {
          logDebug("Still waiting for MathJax...", {
            elapsed: elapsed + "ms",
            mathJaxExists: typeof window.MathJax !== "undefined",
            hasTypesetPromise: !!(
              window.MathJax && window.MathJax.typesetPromise
            ),
          });
        }
      }, checkInterval);
    });
  }

  /**
   * Render element using MathJax Manager queue system
   * @param {HTMLElement} element - Element to typeset
   * @returns {Promise<boolean>} True if successful
   */
  async renderWithMathJaxManager(element) {
    try {
      // Check if MathJax Manager is available
      if (!window.mathJaxManager) {
        logWarn("MathJax Manager not available, using direct rendering");
        return await this.renderWithMathJaxDirect(element);
      }

      // Check manager health
      const status = window.mathJaxManager.getStatus();
      if (!status.isHealthy) {
        logWarn("MathJax Manager unhealthy, attempting direct rendering");
        return await this.renderWithMathJaxDirect(element);
      }

      // Use queue system for safe rendering
      logDebug("Using MathJax Manager queue for rendering");
      await window.mathJaxManager.queueTypeset(element);

      logDebug("✅ MathJax Manager queue rendering successful");
      return true;
    } catch (error) {
      logError("MathJax Manager queue rendering failed:", error);

      // Attempt direct fallback
      try {
        logWarn("Attempting direct MathJax fallback...");
        return await this.renderWithMathJaxDirect(element);
      } catch (fallbackError) {
        logError("Direct MathJax fallback also failed:", fallbackError);
        return false;
      }
    }
  }

  /**
   * Direct MathJax rendering (fallback only)
   * @param {HTMLElement} element - Element to typeset
   * @returns {Promise<boolean>} True if successful
   */
  async renderWithMathJaxDirect(element) {
    logDebug("Using direct MathJax rendering (fallback mode)");

    // Ensure MathJax is ready
    const mathJaxReady = await this.waitForMathJax(5000);
    if (!mathJaxReady) {
      throw new Error("MathJax not ready for direct rendering");
    }

    // Validate element is in DOM
    if (!document.body.contains(element)) {
      throw new Error("Element not in DOM");
    }

    // Clear previous MathJax state if available
    if (window.MathJax.typesetClear) {
      window.MathJax.typesetClear([element]);
    }

    // Render with timeout protection
    await Promise.race([
      window.MathJax.typesetPromise([element]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Direct rendering timeout")), 10000),
      ),
    ]);

    logDebug("✅ Direct MathJax rendering successful");
    return true;
  }

  /**
   * Clean LaTeX content for proper MathJax rendering
   * @param {string} latex - Raw LaTeX content from MathPix
   * @returns {string} Cleaned LaTeX suitable for MathJax
   */
  cleanLatexForMathJax(latex) {
    if (!latex || typeof latex !== "string") {
      return "";
    }

    let cleaned = latex.trim();

    logDebug("Cleaning LaTeX for MathJax", {
      originalLength: cleaned.length,
      originalContent: cleaned.substring(0, 50) + "...",
    });

    // Remove mixed delimiters - if we have both \[ and \( style delimiters, clean them up
    // This is common with MathPix output
    if (cleaned.includes("\\[") && cleaned.includes("\\(")) {
      // Remove outer display delimiters and inner inline delimiters
      cleaned = cleaned
        .replace(/^\\\[\s*/, "") // Remove opening \[
        .replace(/\s*\\\]$/, "") // Remove closing \]
        .replace(/^\\\(\s*/, "") // Remove opening \(
        .replace(/\s*\\\)$/, ""); // Remove closing \)
    } else if (cleaned.includes("\\[")) {
      // Already has display delimiters, remove them so we can add clean ones
      cleaned = cleaned
        .replace(/^\\\[\s*/, "") // Remove opening \[
        .replace(/\s*\\\]$/, ""); // Remove closing \]
    } else if (cleaned.includes("\\(")) {
      // Has inline delimiters, remove them
      cleaned = cleaned
        .replace(/^\\\(\s*/, "") // Remove opening \(
        .replace(/\s*\\\)$/, ""); // Remove closing \)
    } else if (cleaned.includes("$$")) {
      // Has display delimiters, remove them
      cleaned = cleaned
        .replace(/^\$\$\s*/, "") // Remove opening $$
        .replace(/\s*\$\$$/, ""); // Remove closing $$
    } else if (cleaned.includes("$")) {
      // Has inline delimiters, remove them
      cleaned = cleaned
        .replace(/^\$\s*/, "") // Remove opening $
        .replace(/\s*\$$/, ""); // Remove closing $
    }

    // Ensure we have clean content without extra whitespace

    cleaned = cleaned.trim();

    // Add proper display math delimiters for MathJax
    const finalLatex = `\\[${cleaned}\\]`;

    logDebug("LaTeX cleaning completed", {
      originalLength: latex.length,
      cleanedLength: cleaned.length,
      finalLength: finalLatex.length,
      finalContent: finalLatex.substring(0, 50) + "...",
    });

    return finalLatex;
  }

  /**
   * Try alternative MathJax rendering approaches when standard method fails
   * @param {string} content - Original content
   * @param {string} type - Content type
   * @param {HTMLElement} targetElement - Target element
   */
  async tryAlternativeMathJaxRendering(content, type, targetElement) {
    logDebug("Attempting alternative MathJax rendering approach");

    try {
      // Method 1: Try with different delimiter patterns sequentially
      if (type === "latex") {
        // Get the raw LaTeX without any delimiters first
        const rawLatex = content
          .replace(/^\\\[/, "")
          .replace(/\\\]$/, "")
          .replace(/^\\\(/, "")
          .replace(/\\\)$/, "")
          .replace(/^\$\$/, "")
          .replace(/\$\$$/, "")
          .replace(/^\$/, "")
          .replace(/\$$/, "")
          .trim();

        const alternativeDelimiters = [
          `\\[${rawLatex}\\]`, // Display style (should work)
          `$$${rawLatex}$$`, // Double dollar (fallback)
          `\\(${rawLatex}\\)`, // Inline parentheses (fallback)
          `$${rawLatex}$`, // Single dollar (last resort)
        ];

        logDebug("Trying alternative MathJax rendering with raw LaTeX", {
          originalContent: content,
          rawLatex: rawLatex,
          alternativeCount: alternativeDelimiters.length,
        });

        // Try each delimiter pattern
        for (let i = 0; i < alternativeDelimiters.length; i++) {
          const altContent = alternativeDelimiters[i];

          try {
            logDebug(
              `Attempting delimiter ${i + 1}/${alternativeDelimiters.length}`,
              {
                delimiter: altContent.substring(0, 10) + "...",
                fullContent: altContent,
              },
            );

            // Set content and clear previous state
            targetElement.innerHTML = altContent;
            targetElement.classList.remove(
              "mathjax-rendered",
              "mathjax-fallback",
              "mathjax-alternative",
              "delimiter-failed",
            );

            // Clear MathJax state
            if (window.MathJax.typesetClear) {
              window.MathJax.typesetClear([targetElement]);
            }

            // Process with MathJax using queue system
            const renderSuccess =
              await this.renderWithMathJaxManager(targetElement);

            if (!renderSuccess) {
              throw new Error("Alternative rendering failed");
            }

            // Check if rendering was successful
            const hasMathJaxElements = targetElement.querySelector(
              ".MathJax, mjx-container, .MathJax_Display, mjx-math",
            );

            if (hasMathJaxElements) {
              logInfo("✓ Alternative MathJax rendering successful", {
                usedDelimiter: altContent.substring(0, 20) + "...",
                delimiterpPattern:
                  i === 0
                    ? "Display \\[...\\]"
                    : i === 1
                      ? "Double dollar $$...$$"
                      : i === 2
                        ? "Inline \\(...\\)"
                        : "Single dollar $...$",
                mathJaxElementType: hasMathJaxElements.tagName,
              });

              targetElement.classList.add(
                "mathjax-rendered",
                "mathjax-alternative",
              );
              return true; // Success!
            } else {
              logDebug(`Delimiter ${i + 1} failed - no MathJax elements found`);
            }
          } catch (error) {
            logDebug(`Delimiter ${i + 1} failed with error:`, {
              delimiter: altContent.substring(0, 10) + "...",
              error: error.message,
            });
          }
        }
      }

      // Method 2: If LaTeX approaches fail, try direct MathML if available
      if (
        type === "mathml" ||
        (type === "latex" && content.includes("<math"))
      ) {
        logDebug("Trying direct MathML rendering");

        // Extract MathML if embedded in LaTeX response
        let mathmlContent = content;
        if (type === "latex" && content.includes("<math")) {
          const mathmlMatch = content.match(/<math[^>]*>.*?<\/math>/s);
          if (mathmlMatch) {
            mathmlContent = mathmlMatch[0];
          }
        }

        targetElement.innerHTML = mathmlContent;
        targetElement.classList.remove("delimiter-failed");
        targetElement.classList.add("mathml-direct");

        try {
          await window.MathJax.typesetPromise([targetElement]);
          const hasMathJaxElements = targetElement.querySelector(
            ".MathJax, mjx-container, .MathJax_Display, mjx-math",
          );

          if (hasMathJaxElements) {
            logInfo("✓ Direct MathML rendering successful");
            targetElement.classList.add("mathjax-rendered", "mathjax-mathml");
            return true;
          }
        } catch (error) {
          logDebug("Direct MathML rendering failed", error);
        }
      }

      // Method 3: Last resort - show formatted LaTeX source
      logDebug(
        "All MathJax rendering attempts failed, showing formatted source",
      );

      const formattedContent = content
        .replace(/\\\[/g, "")
        .replace(/\\\]/g, "")
        .replace(/\\\(/g, "")
        .replace(/\\\)/g, "")
        .replace(/\$\$/g, "")
        .replace(/\$/g, "")
        .trim();

      targetElement.innerHTML = `
        <div class="math-source-display">
          <div class="math-source-label">LaTeX Source:</div>
          <div class="math-source-content"><code>${formattedContent}</code></div>
          <div class="math-source-note">MathJax rendering failed - showing LaTeX source</div>
        </div>
      `;

      targetElement.classList.add("mathjax-fallback", "source-display");

      // Register for MathJax recovery so re-render is attempted if MathJax
      // later transitions to healthy (matches pattern at line ~3586)
      this.pendingMathJaxRender = true;
      if (window.mathJaxManager?.registerPendingElement) {
        window.mathJaxManager.registerPendingElement(targetElement, {
          source: "mathpix-result-renderer",
          reason: "all-mathjax-attempts-failed",
          contentType: type,
        });
      }

      // Phase 6J fix: <smiles> tags can ONLY be rendered by the CDN library.
      // MathJax will never handle them. Schedule a retry that waits for the
      // CDN to become available, then re-renders automatically.
      if (content.includes("<smiles")) {
        logInfo(
          "Phase 6J: SMILES content detected in MathJax fallback — scheduling CDN retry",
        );
        targetElement.classList.add("pending-cdn-render");
        this.scheduleCDNRetryForSmiles(content, targetElement);
      }

      return false;
    } catch (error) {
      logError("Alternative MathJax rendering completely failed", error);

      targetElement.innerHTML = `
        <div class="math-error-display">
          <div class="math-error-content">Failed to render mathematical content</div>
          <details class="math-error-details">
            <summary>Technical Details</summary>
            <pre>${error.message}</pre>
          </details>
        </div>
      `;
      targetElement.classList.add("mathjax-error");
      return false;
    }
  }

  /**
   * Schedule a CDN retry for SMILES content that MathJax cannot render.
   *
   * The CDN bundle (mathpix-markdown-it) calls MathJax.loader.preLoad on
   * load. If page MathJax has not fully initialised yet, this throws and
   * the CDN's markdownToHTML function is never defined. Simply polling for
   * the function is therefore not enough — we must wait for MathJax to be
   * ready and then trigger a fresh CDN reload via ensureCDNLibraryLoaded().
   *
   * @param {string} content - Original MMD content containing <smiles> tags
   * @param {HTMLElement} targetElement - Element currently showing the fallback
   * @private
   * @since Phase 6J fix
   */
  scheduleCDNRetryForSmiles(content, targetElement) {
    // Clear any previous retry timer
    if (this._cdnRetryTimer) {
      clearInterval(this._cdnRetryTimer);
      this._cdnRetryTimer = null;
    }

    const maxWaitMs = 45000; // 45 seconds total (MathJax can take ~15s)
    const checkIntervalMs = 1000; // Check every second
    let elapsed = 0;
    let cdnReloadAttempted = false;

    this._cdnRetryTimer = setInterval(async () => {
      elapsed += checkIntervalMs;

      // CDN has loaded — render immediately
      if (typeof window.markdownToHTML === "function") {
        clearInterval(this._cdnRetryTimer);
        this._cdnRetryTimer = null;

        // Only re-render if the target still shows the fallback
        if (
          document.body.contains(targetElement) &&
          targetElement.classList.contains("pending-cdn-render")
        ) {
          logInfo("Phase 6J: CDN now available — re-rendering SMILES content");
          const success = this.renderWithCDNLibrary(content, targetElement);
          if (success) {
            targetElement.classList.remove(
              "mathjax-fallback",
              "source-display",
              "pending-cdn-render",
            );
            this.pendingMathJaxRender = false;
            this.announceToScreenReader(
              "Chemistry content has been rendered",
            );
            logInfo("Phase 6J: SMILES CDN retry rendering succeeded");
          }
        }
        return;
      }

      // Once MathJax is fully ready, attempt a CDN reload (once only).
      // The initial CDN load failed because MathJax.loader.preLoad did
      // not exist yet; now that MathJax is ready the reload should succeed.
      if (
        !cdnReloadAttempted &&
        window.MathJax?.typesetPromise &&
        window.MathJaxEnhancementReady
      ) {
        cdnReloadAttempted = true;
        logInfo(
          "Phase 6J: MathJax now ready — triggering CDN reload for SMILES",
        );

        try {
          // Reset the MMD Preview load state so it will attempt a fresh load
          const mmdPreview = this.controller?.mmdPreview;
          if (mmdPreview) {
            mmdPreview.loadState =
              mmdPreview.config?.LOAD_STATES?.IDLE || "idle";
            mmdPreview.loadAttempts = 0;
            mmdPreview.loadError = null;
          }

          const loaded = await this.ensureCDNLibraryLoaded();
          if (loaded) {
            logInfo("Phase 6J: CDN reload succeeded after MathJax ready");
            // Next interval tick will pick up markdownToHTML and render
          } else {
            logWarn("Phase 6J: CDN reload returned false");
          }
        } catch (reloadError) {
          logWarn(
            "Phase 6J: CDN reload failed:",
            reloadError.message,
          );
        }
      }

      // Timeout — stop checking
      if (elapsed >= maxWaitMs) {
        clearInterval(this._cdnRetryTimer);
        this._cdnRetryTimer = null;
        logWarn(
          "Phase 6J: CDN retry timed out for SMILES content after " +
            maxWaitMs +
            "ms",
        );
      }
    }, checkIntervalMs);
  }

  /**
   * Apply MathPix-specific MathJax enhancements
   * @param {HTMLElement} targetElement - Element containing rendered mathematics
   */
  applyMathPixMathJaxEnhancements(targetElement) {
    try {
      // Find all MathJax elements in the target
      const mathJaxElements = targetElement.querySelectorAll(
        ".MathJax, mjx-container, .MathJax_Display, mjx-math",
      );

      mathJaxElements.forEach((mathElement, index) => {
        // Add MathPix-specific attributes for enhanced accessibility
        mathElement.setAttribute("data-mathpix-enhanced", "true");
        mathElement.setAttribute("data-math-index", index);

        // Handle accessibility properly for MathJax elements
        if (mathElement.hasAttribute("aria-hidden")) {
          // If MathJax set aria-hidden, don't add tabindex to avoid focus conflicts
          // Instead, make the parent container focusable
          const parentContainer = mathElement.closest(
            ".mathpix-rendered-output",
          );
          if (parentContainer && !parentContainer.hasAttribute("tabindex")) {
            parentContainer.setAttribute("tabindex", "0");
            parentContainer.setAttribute("role", "math");
            parentContainer.setAttribute(
              "aria-label",
              `Mathematical expression ${
                index + 1
              }. Click to zoom or right-click for options.`,
            );
          }
        } else {
          // Safe to add tabindex if no aria-hidden conflict
          if (!mathElement.hasAttribute("tabindex")) {
            mathElement.setAttribute("tabindex", "0");
          }

          // Add aria-label for better screen reader support
          const mathContent =
            mathElement.getAttribute("aria-label") ||
            mathElement.textContent.trim() ||
            `Mathematical expression ${index + 1}`;
          mathElement.setAttribute(
            "aria-label",
            `${mathContent}. Click to zoom or right-click for options.`,
          );
        }

        // Add visual indicator that the math is interactive
        mathElement.style.cursor = "pointer";

        logDebug(`Enhanced MathJax element ${index + 1}`, {
          hasAriaLabel: !!mathElement.getAttribute("aria-label"),
          hasTabIndex: !!mathElement.getAttribute("tabindex"),
          isAccessible: true,
        });
      });

      // Add keyboard event handlers for enhanced navigation
      targetElement.addEventListener(
        "keydown",
        this.handleMathJaxKeyboard.bind(this),
      );

      logInfo("🎯 MathPix MathJax enhancements applied", {
        enhancedElements: mathJaxElements.length,
        keyboardNavigation: true,
        accessibilityEnhanced: true,
      });
    } catch (error) {
      logWarn("Failed to apply MathPix MathJax enhancements", error);
    }
  }

  /**
   * Handle keyboard navigation for MathJax elements
   * @param {KeyboardEvent} event - The keyboard event
   */
  handleMathJaxKeyboard(event) {
    const mathElement = event.target.closest(
      ".MathJax, mjx-container, mjx-math",
    );

    if (!mathElement) return;

    switch (event.key) {
      case "Enter":
      case " ":
        // Trigger zoom on Enter or Space
        event.preventDefault();
        mathElement.click();
        break;
      case "Escape":
        // Clear focus and close any open menus
        mathElement.blur();
        break;
    }
  }

  /**
   * Get current display format
   * @returns {string} Current format name
   */
  getCurrentFormat() {
    return this.currentFormat;
  }

  /**
   * Get rendering capabilities for debugging
   * @returns {Object} Capabilities information
   */
  getRenderingCapabilities() {
    return {
      mathJax: typeof window.MathJax !== "undefined",
      syntaxHighlighting: !!this.controller.prismBridge,
      copySystem: typeof window.MarkdownCodeCopy !== "undefined",
      formats: this.supportedFormats,
      currentFormat: this.currentFormat,
      elements: {
        formatContents: Object.keys(this.elements.formatContents || {}),
        formatPanels: Object.keys(this.elements.formatPanels || {}),
        outputContainer: !!this.elements["output-container"],
      },
    };
  }

  /**
   * Clean up result renderer resources
   */
  cleanup() {
    // Unsubscribe from MathJax recovery events
    if (this.mathJaxRecoveryUnsubscribe) {
      this.mathJaxRecoveryUnsubscribe();
      this.mathJaxRecoveryUnsubscribe = null;
      logDebug("Unsubscribed from MathJax recovery events");
    }

    // Reset recovery state
    this.pendingMathJaxRender = false;
    this.lastRenderedElement = null;

    // Hide comparison panel
    this.hideResponsiveComparison();

    // Hide output container
    const outputContainer = this.elements["output-container"];
    if (outputContainer) {
      outputContainer.style.display = "none";
    }

    // Reset format state
    this.currentFormat = "latex";
    this.resetFormatOptions();

    super.cleanup();
    logDebug("Result renderer cleanup completed");
  }

  // ──────────────────────────────────────────────────────────────────
  // Phase 7B: Human-readable text & chemistry alt text
  // ──────────────────────────────────────────────────────────────────

  /**
   * Phase 7B: Convert <smiles> tags in content to human-readable chemistry text.
   * Uses structural descriptions (7A) with basic fallback.
   *
   * @param {string} content - Raw content containing <smiles> tags
   * @returns {string} Content with <smiles> tags replaced by descriptions
   * @private
   */
  _convertSmilesToReadable(content) {
    if (!content || typeof content !== "string") return content || "";

    const utils = window.MathPixChemistryUtils;
    if (!utils) return content;

    const chemData = this._chemistryData || [];
    let smilesIndex = 0;

    return content.replace(/<smiles[^>]*>(.*?)<\/smiles>/g, (match, notation) => {
      const chemItem = chemData[smilesIndex] || { notation };
      smilesIndex++;

      // Try structural description (7A) first
      const structural = utils.generateStructuralDescription?.(
        chemItem.notation || notation,
        {
          commonNames: chemItem.commonNames || (chemItem._resolvedName ? [chemItem._resolvedName] : []),
          iupacName: chemItem.iupacName || null,
          molecularWeight: chemItem.molecularWeight || null,
          molecularFormula: chemItem.molecularFormula || null,
          inchi: chemItem.inchi || null,
        },
      );
      if (structural) return structural;

      // Fallback to basic accessible description
      const parsed = chemItem.inchi ? utils.parseInChIFormula(chemItem.inchi) : null;
      const descData = {
        notation: chemItem.notation || notation,
        formula: parsed,
        iupacName: chemItem._resolvedName || null,
      };
      const basic = utils.generateBasicAccessibleDescription?.(descData);
      if (basic) return basic;

      // Last resort
      return "chemical structure: " + (chemItem.notation || notation);
    });
  }

  /**
   * Phase 7B: Convert LaTeX maths in content to human-readable speech text.
   * Uses window.latexToSpeech() if available, falls back to basic conversion.
   *
   * @param {string} content - Content containing LaTeX delimiters
   * @returns {string} Content with LaTeX replaced by speech text
   * @private
   */
  _latexToReadable(content) {
    if (!content || typeof content !== "string") return content || "";

    const convert = window.latexToSpeech || this._basicLatexToText.bind(this);

    // Display maths: $$...$$ and \[...\]
    content = content.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
      return convert(latex.trim()) || match;
    });
    content = content.replace(/\\\[([\s\S]*?)\\\]/g, (match, latex) => {
      return convert(latex.trim()) || match;
    });

    // Inline maths: $...$ and \(...\)
    content = content.replace(/\$([^\$\n]+?)\$/g, (match, latex) => {
      return convert(latex.trim()) || match;
    });
    content = content.replace(/\\\((.*?)\\\)/g, (match, latex) => {
      return convert(latex.trim()) || match;
    });

    return content;
  }

  /**
   * Phase 7B: Basic LaTeX to text fallback for common patterns.
   * Used when window.latexToSpeech is not available.
   *
   * @param {string} latex - Raw LaTeX string (without delimiters)
   * @returns {string} Approximate text representation
   * @private
   */
  _basicLatexToText(latex) {
    if (!latex) return "";

    let text = latex;

    // Fractions: \frac{a}{b} → a over b
    text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2");

    // Superscripts: x^{2} or x^2 → x to the power of 2
    text = text.replace(/\^{([^}]+)}/g, " to the power of $1");
    text = text.replace(/\^(\w)/g, " to the power of $1");

    // Subscripts: x_{n} or x_n → x sub n
    text = text.replace(/_{([^}]+)}/g, " sub $1");
    text = text.replace(/_(\w)/g, " sub $1");

    // Square roots: \sqrt{x} → square root of x
    text = text.replace(/\\sqrt\{([^}]+)\}/g, "square root of $1");

    // Greek letters
    const greek = {
      alpha: "alpha", beta: "beta", gamma: "gamma", delta: "delta",
      epsilon: "epsilon", theta: "theta", lambda: "lambda", mu: "mu",
      pi: "pi", sigma: "sigma", omega: "omega",
      Alpha: "Alpha", Beta: "Beta", Gamma: "Gamma", Delta: "Delta",
      Theta: "Theta", Lambda: "Lambda", Pi: "Pi", Sigma: "Sigma", Omega: "Omega",
    };
    for (const [cmd, name] of Object.entries(greek)) {
      text = text.replace(new RegExp(`\\\\${cmd}\\b`, "g"), name);
    }

    // Comparison operators
    text = text.replace(/\\leq?\b/g, " less than or equal to ");
    text = text.replace(/\\geq?\b/g, " greater than or equal to ");
    text = text.replace(/\\neq?\b/g, " not equal to ");
    text = text.replace(/\\approx\b/g, " approximately ");
    text = text.replace(/\\times\b/g, " times ");
    text = text.replace(/\\cdot\b/g, " times ");
    text = text.replace(/\\pm\b/g, " plus or minus ");
    text = text.replace(/\\infty\b/g, "infinity");

    // Clean up remaining commands
    text = text.replace(/\\(?:text|mathrm|mathbf|mathit)\{([^}]+)\}/g, "$1");
    text = text.replace(/\\(?:left|right|Big|big)/g, "");
    text = text.replace(/\\\\/g, " ");
    text = text.replace(/[{}]/g, "");

    // Clean up whitespace
    text = text.replace(/\s+/g, " ").trim();

    return text;
  }

  /**
   * Phase 7B: Convert raw API response content to human-readable plain text.
   * Processes SMILES tags first (before LaTeX, since SMILES contain LaTeX-like characters),
   * then converts LaTeX maths to speech text.
   *
   * @param {string} content - Raw content from API response
   * @returns {string} Human-readable plain text
   */
  contentToHumanReadable(content) {
    if (!content || typeof content !== "string") return "";

    let readable = content;

    // 1. Convert SMILES tags first (before LaTeX — SMILES contain special characters)
    readable = this._convertSmilesToReadable(readable);

    // 2. Convert LaTeX maths to speech text
    readable = this._latexToReadable(readable);

    // 3. Clean up remaining markup
    readable = readable.replace(/\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g, "[mathematical expression]");
    readable = readable.replace(/\n{3,}/g, "\n\n");
    readable = readable.trim();

    return readable;
  }

  /**
   * Phase 7B: Add accessible alt text to CDN-rendered chemistry structures.
   * Finds .smiles-inline elements and adds role="img" and aria-label.
   *
   * @param {HTMLElement} container - Container with CDN-rendered content
   */
  addChemistryAltText(container) {
    if (!container) return;

    const smilesElements = container.querySelectorAll(".smiles-inline");
    if (smilesElements.length === 0) return;

    const utils = window.MathPixChemistryUtils;
    const chemData = this._chemistryData || [];

    smilesElements.forEach((el, index) => {
      const chemItem = chemData[index] || {};

      el.setAttribute("role", "img");

      // Phase 8C-ST: use short description for aria-label on MMD preview
      const pubchemObj = {
        commonNames: chemItem.commonNames || (chemItem._resolvedName ? [chemItem._resolvedName] : []),
        iupacName: chemItem.iupacName || null,
        molecularWeight: chemItem.molecularWeight || null,
        molecularFormula: chemItem.molecularFormula || null,
        inchi: chemItem.inchi || null,
      };
      const shortAria = utils?.generateShortDescriptionForAria?.(
        chemItem.notation, pubchemObj,
      );
      if (shortAria) {
        el.setAttribute("aria-label", shortAria);
        return;
      }

      // Fallback: try standard structural description
      const structural = utils?.generateStructuralDescription?.(
        chemItem.notation, pubchemObj,
      );
      if (structural) {
        el.setAttribute("aria-label", structural);
        return;
      }

      // Fallback to basic description
      const parsed = chemItem.inchi ? utils?.parseInChIFormula(chemItem.inchi) : null;
      const descData = {
        notation: chemItem.notation || "",
        formula: parsed,
        iupacName: chemItem._resolvedName || null,
      };
      const basic = utils?.generateBasicAccessibleDescription?.(descData);

      el.setAttribute("aria-label", basic || "Chemical structure: " + (chemItem.notation || "unknown"));
    });

    logInfo("Chemistry alt text applied", { count: smilesElements.length });
  }

  /**
   * Phase 7B: Populate the human-readable text description section.
   * Converts raw API content to plain text and shows it below the comparison panel.
   *
   * @param {Object} result - API response result object
   */
  populateCapturedTextDescription(result) {
    const contentEl = document.getElementById("mathpix-captured-text-content");
    const container = document.getElementById("mathpix-captured-text-description");
    if (!contentEl || !container) return;

    // Get raw text content from the result
    const rawContent = result?.text || "";
    if (!rawContent.trim()) {
      container.hidden = true;
      return;
    }

    // Check if content is plain text (no LaTeX, no SMILES) — hide to avoid redundancy
    const hasLatex = /\$.*?\$|\\[(\[]/.test(rawContent);
    const hasSmiles = /<smiles/.test(rawContent);
    if (!hasLatex && !hasSmiles) {
      container.hidden = true;
      return;
    }

    const readable = this.contentToHumanReadable(rawContent);
    if (!readable.trim()) {
      container.hidden = true;
      return;
    }

    contentEl.textContent = readable;
    container.hidden = false;

    // Wire copy button
    const copyBtn = document.getElementById("copy-captured-text");
    if (copyBtn && !copyBtn.dataset.wired) {
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(readable).then(
          () => {
            this._announceChemistry("Human-readable text copied to clipboard");
          },
          () => {
            this._announceChemistry("Failed to copy text");
          },
        );
      });
      copyBtn.dataset.wired = "true";
    }
  }
}

export default MathPixResultRenderer;
