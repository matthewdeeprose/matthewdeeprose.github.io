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

    this.isInitialised = true;

    logInfo("MathPix Result Renderer initialised", {
      supportedFormats: this.supportedFormats,
      defaultFormat: this.currentFormat,
    });
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
          "mathpix-tab-table-markdown"
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
          "success"
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
      // Unhide asciimath tags for currency/simple math display
      // Keep mathml and latex hidden to prevent triple display
      let previewHtml = result.html;

      // Unhide asciimath for clean currency display
      previewHtml = previewHtml.replace(
        /<asciimath\s+style="display:\s*none;"/gi,
        '<asciimath style="display: inline;"'
      );

      // Parse HTML and hide mathml/latex tags to prevent duplicates
      const parser = new DOMParser();
      const previewDoc = parser.parseFromString(previewHtml, "text/html");

      // Hide mathml tags
      const mathmlTags = previewDoc.querySelectorAll("mathml");
      mathmlTags.forEach((tag) => {
        tag.setAttribute("style", "display: none;");
      });

      // Hide latex tags
      const latexTags = previewDoc.querySelectorAll("latex");
      latexTags.forEach((tag) => {
        tag.setAttribute("style", "display: none;");
      });

      this.elements.htmlPreview.innerHTML = previewDoc.body.innerHTML;

      logDebug("HTML preview populated with currency visibility fix", {
        originalLength: result.html.length,
        asciimathUnhidden: true,
        mathmlHidden: mathmlTags.length,
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
        result
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
        }
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
        content
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
          '[data-latex-addition="true"]'
        );
        previousAdditions.forEach((element) => element.remove());
        logDebug(
          `Cleaned up ${previousAdditions.length} previous LaTeX format additions`
        );
      }

      // Transform LaTeX into multiple formats
      const transformed =
        LaTeXTransformer.transformWithFormatPreservation(latexContent);

      // Apply syntax highlighting to original in the existing code element
      this.controller.prismBridge?.applySyntaxHighlighting(
        contentElement,
        "latex",
        transformed.original
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
              userDelimiterFormat
            );
          }
        } catch (e) {
          logWarn(
            "[Result Renderer] Could not retrieve delimiter preference, assuming LaTeX",
            e
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
          transformed.dollarFormat
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
          transformed.doubleDollarFormat
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
                transformed.doubleDollarFormat
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
          "Added dollar and double-dollar LaTeX formats with labels and copy buttons (LaTeX delimiters selected)"
        );
      } else {
        logInfo(
          "Skipped MS Word conversion section - Markdown delimiters already selected by user"
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
        latexContent
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
        '[data-table-addition="true"]'
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
        content
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
        "info"
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
          logWarn("Failed to process math in table format preview", error)
        );
    } else if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([previewContainer]).catch((error) =>
        logWarn("Failed to process math in table format preview", error)
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
      sourceHtml
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
      content
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
        "Use arrow keys to navigate table cells"
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
            /(border|padding|margin|color|background|text-align|width|height)/i
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
          (1 - cleanHtml.length / tableHtml.length) * 100
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
      "mathpix-preserve-table-styles"
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
      "success"
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
   * Show specific format panel
   * @param {string} format - Format to show
   */
  showFormat(format) {
    logInfo(`Switching to format: ${format}`);

    // Update all tabs - set aria-selected
    const allTabs = document.querySelectorAll(
      '.mathpix-format-tab[role="tab"]'
    );
    allTabs.forEach((tab) => {
      const isSelected = tab.dataset.format === format;
      tab.setAttribute("aria-selected", isSelected.toString());
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
    // Reset all format tab buttons to available state and make visible
    document
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
    // Find first available format tab and select it
    const availableTab = document.querySelector(
      '.mathpix-tab-header[role="tab"]:not([aria-disabled="true"]):not([style*="display: none"])'
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
      "mathpix-line-data-section"
    );
    const lineDataContent = document.getElementById(
      "mathpix-line-data-content"
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
      (line) => line.conversion_output
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
        item.innerHTML = `<span aria-hidden="true">•</span> ${count} ${typeLabel}${
          count > 1 ? "s" : ""
        } (${included} included, ${excluded} excluded)`;
      } else {
        item.innerHTML = `<span aria-hidden="true">•</span> ${count} ${typeLabel}${
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
      const statusIcon = line.conversion_output ? "✓" : "⚠";
      const statusText = line.conversion_output ? "Included" : "Excluded";
      const typeLabel = this.getTypeLabel(line.type, line.subtype);

      const header = document.createElement("div");
      header.style.fontWeight = "600";
      header.style.marginBottom = "0.25rem";
      header.innerHTML = `<span aria-hidden="true">${statusIcon}</span> Line ${
        index + 1
      }: ${typeLabel}`;

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
    const contentElement = document.getElementById("mathpix-content-smiles");

    if (!contentElement) {
      logWarn("SMILES content element not found in DOM");
      return;
    }

    if (!Array.isArray(smilesArray) || smilesArray.length === 0) {
      contentElement.textContent =
        "No chemistry structures detected in this image.";
      contentElement.classList.add("empty-content");
      logDebug("No SMILES data to display");
      return;
    }

    // Format SMILES data for display with structure separation
    const formattedContent = smilesArray
      .map((item, index) => {
        let output = `// Structure ${index + 1}\n`;
        output += `SMILES: ${item.notation}\n`;

        if (item.context) {
          output += `Context: ${item.context}\n`;
        }

        if (item.lineId) {
          output += `Source: Line ${item.lineId}\n`;
        }

        return output;
      })
      .join("\n" + "─".repeat(60) + "\n\n");

    contentElement.textContent = formattedContent;

    // Apply syntax highlighting if Prism is available
    if (this.controller.prismBridge?.applySyntaxHighlighting) {
      this.controller.prismBridge.applySyntaxHighlighting(
        contentElement,
        "markup",
        formattedContent
      );
    }

    // Set up copy functionality
    const preElement = contentElement.parentElement;
    if (preElement && preElement.tagName === "PRE") {
      preElement.dataset.originalCode = formattedContent;
      preElement.classList.add("code-block-container");

      // Integrate with existing copy button system
      if (
        window.MarkdownCodeCopy &&
        typeof window.MarkdownCodeCopy.init === "function"
      ) {
        window.MarkdownCodeCopy.init(preElement.parentElement);
        logDebug("Chemistry format integrated with copy button system");
      }
    }

    logInfo("Chemistry format populated successfully", {
      structureCount: smilesArray.length,
      totalLength: formattedContent.length,
      hasSyntaxHighlighting: !!this.controller.prismBridge,
    });
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
          result[key] && typeof result[key] === "string" && result[key].trim()
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
        "Comparison container not found in DOM - this should be present in boilerplate.html"
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
      originalFile.size
    )} | <span class="sr-only">File type: </span>${this.controller.fileHandler.getFileTypeDescription(
          originalFile.type
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
      '<span class="tex2jax_ignore">$$$1</span>'
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
      // Clear existing content
      renderedOutput.innerHTML = "";

      // CRITICAL: Check for tables FIRST before MathJax rendering
      if (result.containsTable && result.tableHtml) {
        logDebug("Displaying table preview in comparison view");

        // Protect currency values from MathJax while allowing real math to be processed
        let processedTableHtml = this.protectCurrencyFromMathJax(
          result.tableHtml
        );

        // Remove display:none from mathml tags only so MathJax renders are visible
        // MathPix API hides format tags by default, but MathJax inserts rendered SVG inside <mathml>
        // Keep <latex> and <asciimath> hidden since they contain raw text strings
        processedTableHtml = processedTableHtml.replace(
          /<mathml\s+style="display:\s*none;"/gi,
          '<mathml style="display: inline;"'
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
              logWarn("Failed to process math in table cells", error)
            );
        } else if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([renderedOutput])
            .then(() => logDebug("MathJax processed table cells (direct)"))
            .catch((error) =>
              logWarn("Failed to process math in table cells", error)
            );
        }

        return true;
      }

      // Determine best content to render (prioritise LaTeX for MathJax)
      let contentToRender = "";
      let renderType = "text";

      if (result.latex && result.latex.trim()) {
        contentToRender = result.latex;
        renderType = "latex";
        logDebug("Using LaTeX content for MathJax rendering");
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

      // Render content with MathJax integration
      this.renderContentWithMathJax(
        contentToRender,
        renderType,
        renderedOutput
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
        "mathpix-confidence-low"
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
        `Confidence: ${confidencePercent}% (${confidenceLabel})`
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
      "mathpix-comparison-container"
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
        "no-mathjax"
      );
    }

    // Reset confidence indicator
    const confidenceBadge = document.getElementById("mathpix-confidence-badge");
    if (confidenceBadge) {
      confidenceBadge.textContent = "";
      confidenceBadge.classList.remove(
        "mathpix-confidence-high",
        "mathpix-confidence-medium",
        "mathpix-confidence-low"
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
      "mathpix-image-preview-container"
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
      ".mathpix-comparison-panel:first-child"
    );

    if (
      originalBtn &&
      originalImagePanel &&
      this.controller.fileHandler?.getCurrentFile()
    ) {
      // Check if button already exists in comparison panel
      let comparisonBtn = document.getElementById(
        "mathpix-comparison-open-btn"
      );

      if (comparisonBtn) {
        // Button already exists - just update its onclick handler and ensure visibility
        comparisonBtn.onclick = () =>
          this.controller.fileHandler.openOriginalInNewWindow(
            this.controller.fileHandler.getCurrentFile()
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
        newBtn.onclick = () =>
          this.controller.fileHandler.openOriginalInNewWindow(
            this.controller.fileHandler.getCurrentFile()
          );

        // CRITICAL: Remove aria-hidden from button (WCAG 2.2 AA compliance)
        // Interactive elements must not be hidden from assistive technology
        // Only decorative icons within the button should have aria-hidden
        newBtn.removeAttribute("aria-hidden");

        // Find the file info div in the comparison panel
        const originalInfo = originalImagePanel.querySelector(
          "#mathpix-original-info"
        );

        if (originalInfo) {
          // Insert button after the file info div
          originalInfo.insertAdjacentElement("afterend", newBtn);
          logDebug(
            "Open original button relocated to comparison panel after file info"
          );
        } else {
          // Fallback - try to find the title and add after it
          const comparisonTitle = originalImagePanel.querySelector(
            ".mathpix-comparison-title"
          );
          if (comparisonTitle) {
            comparisonTitle.insertAdjacentElement("afterend", newBtn);
            logDebug(
              "Open original button relocated to comparison panel after title (fallback)"
            );
          } else {
            // Final fallback - add to beginning of panel
            originalImagePanel.insertBefore(
              newBtn,
              originalImagePanel.firstChild
            );
            logDebug(
              "Open original button added to comparison panel (final fallback)"
            );
          }
        }
      }

      // Hide original button in preview container
      originalBtn.style.display = "none";
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
        "no-mathjax"
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
          const renderSuccess = await this.renderWithMathJaxManager(
            targetElement
          );

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
              ".MathJax, mjx-container, .MathJax_Display, mjx-math"
            );

            if (hasMathJaxElements) {
              logInfo("✅ MathJax elements detected - rendering successful", {
                mathJaxElementType: hasMathJaxElements.tagName,
                mathJaxClasses: hasMathJaxElements.className,
              });
            } else {
              logWarn(
                "⚠️ MathJax completed but no MathJax elements found - trying alternatives"
              );

              // Try alternative rendering approach
              await this.tryAlternativeMathJaxRendering(
                content,
                type,
                targetElement
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
        setTimeout(() => reject(new Error("Direct rendering timeout")), 10000)
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
              }
            );

            // Set content and clear previous state
            targetElement.innerHTML = altContent;
            targetElement.classList.remove(
              "mathjax-rendered",
              "mathjax-fallback",
              "mathjax-alternative",
              "delimiter-failed"
            );

            // Clear MathJax state
            if (window.MathJax.typesetClear) {
              window.MathJax.typesetClear([targetElement]);
            }

            // Process with MathJax using queue system
            const renderSuccess = await this.renderWithMathJaxManager(
              targetElement
            );

            if (!renderSuccess) {
              throw new Error("Alternative rendering failed");
            }

            // Check if rendering was successful
            const hasMathJaxElements = targetElement.querySelector(
              ".MathJax, mjx-container, .MathJax_Display, mjx-math"
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
                "mathjax-alternative"
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
            ".MathJax, mjx-container, .MathJax_Display, mjx-math"
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
        "All MathJax rendering attempts failed, showing formatted source"
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
   * Apply MathPix-specific MathJax enhancements
   * @param {HTMLElement} targetElement - Element containing rendered mathematics
   */
  applyMathPixMathJaxEnhancements(targetElement) {
    try {
      // Find all MathJax elements in the target
      const mathJaxElements = targetElement.querySelectorAll(
        ".MathJax, mjx-container, .MathJax_Display, mjx-math"
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
            ".mathpix-rendered-output"
          );
          if (parentContainer && !parentContainer.hasAttribute("tabindex")) {
            parentContainer.setAttribute("tabindex", "0");
            parentContainer.setAttribute("role", "math");
            parentContainer.setAttribute(
              "aria-label",
              `Mathematical expression ${
                index + 1
              }. Click to zoom or right-click for options.`
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
            `${mathContent}. Click to zoom or right-click for options.`
          );
        }

        // Add visual indicator that the math is interactive
        mathElement.style.cursor = "pointer";
        mathElement.title = "Click to zoom, right-click for menu options";

        logDebug(`Enhanced MathJax element ${index + 1}`, {
          hasAriaLabel: !!mathElement.getAttribute("aria-label"),
          hasTabIndex: !!mathElement.getAttribute("tabindex"),
          isAccessible: true,
        });
      });

      // Add keyboard event handlers for enhanced navigation
      targetElement.addEventListener(
        "keydown",
        this.handleMathJaxKeyboard.bind(this)
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
      ".MathJax, mjx-container, mjx-math"
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
}

export default MathPixResultRenderer;
