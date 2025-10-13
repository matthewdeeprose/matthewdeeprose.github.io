/**
 * @fileoverview MathPix PDF Result Renderer - Comprehensive PDF results display and export management
 * @module MathPixPDFResultRenderer
 * @requires MathPixBaseModule
 * @requires MATHPIX_CONFIG
 * @version 2.1.0
 * @since 2.1.0
 *
 * @description
 * Manages comprehensive PDF results display including multi-format content population,
 * tab-based format switching, export functionality, document metadata display, and user actions.
 *
 * Key Features:
 * - Multi-format content display (MMD, HTML, LaTeX, DOCX)
 * - Accessible tab-based format switching with keyboard navigation
 * - Comprehensive export functionality (copy, download, preview)
 * - Document metadata and processing information display
 * - User action management (process another, clear results)
 * - Syntax highlighting integration with Prism.js
 *
 * Integration:
 * - Extends MathPixBaseModule for shared functionality
 * - Coordinates with MathPixController for API access
 * - Uses MathPixPrismBridge for syntax highlighting
 * - Integrates with notification system for user feedback
 * - Works with MathPixAPIClient for DOCX downloads
 *
 * Display Workflow:
 * Results Reception → Format Population → Tab Setup → Export Configuration →
 * Metadata Display → User Action Setup → Accessibility Enhancement
 *
 * Accessibility:
 * - WCAG 2.2 AA compliant throughout
 * - Full keyboard navigation for all tabs and controls
 * - Screen reader compatible with proper ARIA labels
 * - Focus management for tab switching and export actions
 */

// Logging configuration (module level)
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

/**
 * @function shouldLog
 * @description Determines if logging should occur based on configuration
 * @param {number} level - Log level to check
 * @returns {boolean} True if logging should proceed
 * @private
 */
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

/**
 * @function logError
 * @description Logs error-level messages when appropriate
 * @param {string} message - Primary error message
 * @param {...*} args - Additional arguments for detailed error context
 * @private
 */
function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

/**
 * @function logWarn
 * @description Logs warning-level messages when appropriate
 * @param {string} message - Primary warning message
 * @param {...*} args - Additional arguments for warning context
 * @private
 */
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

/**
 * @function logInfo
 * @description Logs informational messages when appropriate
 * @param {string} message - Primary information message
 * @param {...*} args - Additional arguments for information context
 * @private
 */
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

/**
 * @function logDebug
 * @description Logs debug-level messages when appropriate
 * @param {string} message - Primary debug message
 * @param {...*} args - Additional arguments for debug context
 * @private
 */
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

import MathPixBaseModule from "../../core/mathpix-base-module.js";
import MATHPIX_CONFIG from "../../core/mathpix-config.js";

/**
 * @class MathPixPDFResultRenderer
 * @extends MathPixBaseModule
 * @description Manages comprehensive PDF results display and export functionality
 *
 * This class handles the complete PDF results presentation including multi-format
 * content display, accessible tab navigation, export capabilities, and document
 * metadata presentation. It provides a rich, interactive interface for users to
 * explore and utilize processed PDF content.
 *
 * Key Features:
 * - Multi-format content display with syntax highlighting
 * - Accessible tab interface with keyboard navigation support
 * - Comprehensive export options (copy, download, preview)
 * - Document metadata and processing statistics display
 * - User action management for workflow continuation
 * - Integration with existing accessibility and theming systems
 *
 * Supported Formats:
 * - MMD (MultiMarkdown): Markdown with mathematical notation
 * - HTML: Web-ready HTML with embedded mathematics
 * - LaTeX: Professional typesetting format
 * - DOCX: Microsoft Word compatible format (download only)
 *
 * Export Actions:
 * - Copy: Copy content to system clipboard
 * - Download: Save content as file with appropriate extension
 * - Preview: Display content in modal or new window (HTML only)
 *
 * @example
 * const renderer = new MathPixPDFResultRenderer(controller);
 * await renderer.displayPDFResults(processingResults, documentInfo);
 *
 * @see {@link MathPixBaseModule} for inherited functionality
 * @see {@link MathPixPDFProcessor} for processing workflow coordination
 * @since 2.1.0
 */
class MathPixPDFResultRenderer extends MathPixBaseModule {
  /**
   * @constructor
   * @description Initialises the PDF result renderer with display state management
   * @param {MathPixController} controller - Parent controller for API access and coordination
   * @throws {Error} If controller is not provided or invalid
   *
   * @example
   * const controller = getMathPixController();
   * const resultRenderer = new MathPixPDFResultRenderer(controller);
   *
   * @accessibility Ensures all display elements support screen reader navigation
   * @since 2.1.0
   */
  constructor(controller) {
    super(controller);

    /**
     * @member {Object|null} currentResults
     * @description Currently displayed processing results
     */
    this.currentResults = null;

    /**
     * @member {Object|null} documentInfo
     * @description Current document metadata and information
     */
    this.documentInfo = null;

    /**
     * @member {string} activeFormat
     * @description Currently active format tab
     */
    this.activeFormat = "mmd";

    /**
     * @member {Object} formatElements
     * @description Cached references to format-specific DOM elements
     */
    this.formatElements = {
      tabs: {},
      panels: {},
      exportButtons: {},
    };

    /**
     * @member {Object} displayStates
     * @description Track display states for each format
     */
    this.displayStates = {
      mmd: { populated: false, highlighted: false },
      html: { populated: false, highlighted: false },
      latex: { populated: false, highlighted: false },
      docx: { populated: false, available: false },
    };

    this.isInitialised = true;

    // ✅ PHASE 3 FIX: Expose global functions for download buttons
    this.exposeGlobalFunctions();

    logInfo("MathPix PDF Result Renderer initialised", {
      supportedFormats: MATHPIX_CONFIG.PDF_PROCESSING.SUPPORTED_PDF_FORMATS,
      defaultFormat: this.activeFormat,
      globalFunctionsExposed: !!(
        window.downloadLatexZip && window.copyLatexContent
      ),
    });
  }
  /**
   * @method displayPDFResults
   * @description Main entry point for displaying comprehensive PDF processing results
   *
   * Orchestrates the complete results display workflow including content population,
   * tab setup, export configuration, metadata display, and accessibility enhancement.
   * Provides comprehensive error handling and user feedback throughout.
   *
   * @param {Object} results - Processing results containing format-specific content
   * @param {string} [results.mmd] - MultiMarkdown content
   * @param {string} [results.html] - HTML content
   * @param {string} [results.latex] - LaTeX content
   * @param {boolean} [results.docx] - DOCX availability flag
   * @param {Object} [results.processingMetadata] - Processing metadata
   * @param {Object} documentInfo - Document information and metadata
   * @param {string} documentInfo.name - Document filename
   * @param {number} documentInfo.size - Document size in bytes
   * @param {string} [documentInfo.pageCount] - Number of pages processed
   * @param {string} [documentInfo.pageRange] - Page range processed
   *
   * @returns {Promise<void>}
   *
   * @throws {Error} When results display fails
   *
   * @example
   * await renderer.displayPDFResults({
   *   mmd: "# Document Title\nContent...",
   *   html: "<h1>Document Title</h1><p>Content...</p>",
   *   latex: "\\documentclass{article}...",
   *   docx: true,
   *   processingMetadata: { pdfId: "12345", totalTime: 45000 }
   * }, {
   *   name: "document.pdf",
   *   size: 2048576,
   *   pageCount: "10",
   *   pageRange: "1-10"
   * });
   *
   * @accessibility Ensures proper focus management and screen reader announcements
   * @since 2.1.0
   */
  async displayPDFResults(results, documentInfo, pdfBlob = null) {
    // Phase 3.4.2 DEBUG: Comprehensive parameter verification
    console.log("🔍 DEBUG [Renderer]: displayPDFResults called", {
      hasResults: !!results,
      hasDocumentInfo: !!documentInfo,
      hasPdfBlob: !!pdfBlob,
      pdfBlobDetails: pdfBlob
        ? {
            type: pdfBlob.type,
            size: pdfBlob.size,
            constructor: pdfBlob.constructor.name,
          }
        : "NULL - THIS IS THE PROBLEM!",
      thisLinesAnalysis: !!this.linesAnalysis,
      thisDocumentId: !!this.documentId,
    });

    logInfo("Displaying PDF results with enhanced features", {
      hasResults: !!results,
      hasDocumentInfo: !!documentInfo,
      formats: Object.keys(results || {}),
      hasPdfBlob: !!pdfBlob,
    });

    // Store results for reference
    this.currentResults = results;
    this.documentInfo = documentInfo;

    // ✅ STEP 1: Store document ID for Lines API calls (FIXED: pdfId not pdf_id)
    this.documentId = results.processingMetadata?.pdfId || null;

    logInfo("PDF document ID stored for Lines API", {
      documentId: this.documentId,
      hasMetadata: !!results.processingMetadata,
      metadataKeys: results.processingMetadata
        ? Object.keys(results.processingMetadata)
        : [],
      foundInField: this.documentId ? "pdfId (camelCase)" : "NOT FOUND",
    });

    try {
      // Store results and document info
      this.currentResults = results;
      this.documentInfo = documentInfo;

      // Reset display states
      this.resetDisplayStates();

      // ✅ STEP 2: Optional Lines API integration for enhanced page analysis
      if (this.documentId && this.controller.linesDataManager) {
        try {
          logInfo("Fetching Lines API data for enhanced page analysis", {
            documentId: this.documentId,
          });

          // Fetch and analyze lines data
          const linesResults =
            await this.controller.linesDataManager.fetchAndAnalyzeLines(
              this.documentId,
              {
                includePageBreakdown: true,
                calculateConfidenceStats: true,
              }
            );

          // Store for future use
          this.linesAnalysis = linesResults.analysis;
          this.linesData = linesResults.linesData;

          logInfo("Lines API data fetched successfully", {
            totalPages: this.linesAnalysis.totalPages,
            mathElements: this.linesAnalysis.mathElements.count,
            tableCount: this.linesAnalysis.tableStructures.count,
            averageConfidence: this.linesAnalysis.averageConfidence,
            summary: this.linesAnalysis.summary,
          });

          // Log page breakdown availability
          if (this.linesAnalysis.pageBreakdown) {
            logInfo("Page-by-page breakdown available", {
              pagesWithData: this.linesAnalysis.pageBreakdown.length,
            });
          }

          // Update page count display with accurate Lines API data
          const pagesElement = document.getElementById("mathpix-doc-pages");
          if (pagesElement && this.linesAnalysis?.totalPages) {
            pagesElement.textContent = `${this.linesAnalysis.totalPages} pages`;
            logInfo("Updated page count from Lines API", {
              pages: this.linesAnalysis.totalPages,
            });
          }

          // ✅ PHASE 3.3 FIX: Set totalPages from Lines API (authoritative source)
          this.totalPages = this.linesAnalysis.totalPages;
          this.currentPage = 1; // Initialize current page
          logInfo("Total pages set from Lines API", {
            totalPages: this.totalPages,
            currentPage: this.currentPage,
          });

          // ✅ PHASE 3.4.2: Display statistics for first page now that Lines API data is available
          if (this.linesAnalysis && this.linesAnalysis.pageBreakdown) {
            this.updatePageStatistics(1);
            logInfo("Page statistics displayed for page 1", {
              statsVisible: true,
              hasPageBreakdown: true,
            });
          }
        } catch (linesError) {
          // Non-critical: Log but don't break page display
          logWarn("Lines API fetch failed, using basic page parsing", {
            error: linesError.message,
            documentId: this.documentId,
          });
          this.linesAnalysis = null;
          this.linesData = null;
        }
      } else {
        logDebug("Lines API integration skipped", {
          hasDocumentId: !!this.documentId,
          hasLinesDataManager: !!this.controller.linesDataManager,
        });
      }

      // Parse page-by-page content
      await this.parsePageByPageContent(results);

      // Step 1: Cache format-specific DOM elements
      this.cacheFormatElements();

      // Step 2: Show PDF results container
      this.showResultsContainer();

      // Step 3: Update document metadata display
      this.updateDocumentMetadata(documentInfo);

      // Step 4: Populate content for each available format
      await this.populateAllFormatContent(results);

      // ✅ PHASE 2B: Populate archive formats
      if (results["mmd.zip"]) {
        await this.populateMmdZipContent(results);
      }
      if (results["md.zip"]) {
        await this.populateMdZipContent(results);
      }
      if (results["html.zip"]) {
        await this.populateHtmlZipContent(results);
      }

      // Step 5: Setup accessible tab switching
      this.setupTabSwitching();

      // Step 5a: Display diagram text if available (Feature 4)
      if (this.linesAnalysis && this.linesAnalysis.diagramText) {
        this.displayDiagramTextContent(this.linesAnalysis);
        logInfo("Diagram text section displayed", {
          diagramsWithText:
            this.linesAnalysis.diagramTextSummary?.totalDiagrams || 0,
        });
      } else {
        logDebug("No diagram text to display", {
          hasLinesAnalysis: !!this.linesAnalysis,
          hasDiagramText: !!(
            this.linesAnalysis && this.linesAnalysis.diagramText
          ),
        });
      }

      // Step 6: Export functionality already configured by createFormatExportActions()
      // ✅ PHASE 4 FIX: Removed setupExportFunctionality() call that was overwriting working buttons
      // Export buttons are created in populateFormatContent() via createFormatExportActions()
      logDebug(
        "Export functionality configured via createFormatExportActions in content population"
      );

      // Step 6a: Validate export functionality is working correctly
      this.validateExportFunctionality();

      // Step 7: Setup final user actions
      this.setupFinalActions();

      // Step 8: Set initial active format and focus
      await this.setInitialActiveFormat(results);

      logInfo("PDF results display completed successfully", {
        activeFormat: this.activeFormat,
        populatedFormats: Object.keys(this.displayStates).filter(
          (format) => this.displayStates[format].populated
        ),
        documentName: documentInfo.name,
      });

      // Notify user of successful display
      this.showNotification(
        `Document processing complete! Results available in ${
          Object.keys(results).filter(
            (key) => key !== "processingMetadata" && results[key]
          ).length
        } formats.`,
        "success"
      );
    } catch (error) {
      logError("Failed to display PDF results", {
        error: error.message,
        documentName: documentInfo?.name,
      });

      this.showNotification(
        `Failed to display processing results: ${error.message}`,
        "error"
      );

      throw error;
    }
  }

  /**
   * Update page statistics display (now integrated in document info)
   * @param {number} pageNumber - Page number to display statistics for
   */
  updatePageStatistics(pageNumber) {
    if (!this.linesAnalysis || !this.linesAnalysis.pageBreakdown) {
      logDebug("No Lines API data available for statistics");
      return;
    }

    const pageIndex = pageNumber - 1;
    const pageData = this.linesAnalysis.pageBreakdown[pageIndex];

    if (!pageData) {
      logDebug(`No statistics data for page ${pageNumber}`);
      return;
    }

    // Show statistics panel (now always visible in combined view)
    const statsPanel = document.getElementById("mathpix-page-statistics");
    if (statsPanel) {
      statsPanel.style.display = "block";
    }

    // Update all statistics
    const statElements = {
      "page-stat-lines": pageData.lineCount || 0,
      "page-stat-math": pageData.mathElements || 0,
      "page-stat-tables": pageData.tables || 0,
      "page-stat-handwritten": pageData.handwritten || 0,
      "page-stat-printed": pageData.printed || 0,
    };

    Object.entries(statElements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });

    logDebug("Page statistics updated", {
      page: pageNumber,
      lines: pageData.lineCount,
      math: pageData.mathElements,
      tables: pageData.tables,
      handwritten: pageData.handwritten,
      printed: pageData.printed,
    });
  }

  /**
   * @method populateFormatContent
   * @description Populates content for a specific format with syntax highlighting
   *
   * Handles content population, syntax highlighting, and display state management
   * for individual formats. Provides comprehensive error handling and user feedback.
   *
   * @param {string} format - Format identifier (mmd, html, latex, docx)
   * @param {string|boolean} content - Content to display or availability flag
   *
   * @returns {Promise<void>}
   *
   * @throws {Error} When content population fails
   *
   * @example
   * await renderer.populateFormatContent('latex', '\\documentclass{article}...');
   *
   * @private
   * @since 2.1.0
   */
  async populateFormatContent(format, content) {
    logDebug("Populating content for format", {
      format,
      hasContent: !!content,
      isHTMLFormat: format === "html",
    });

    try {
      const panelElement = this.formatElements.panels[format];
      if (!panelElement) {
        logWarn(`Panel element not found for format: ${format}`);
        return;
      }

      // Handle DOCX format specially (download-only)
      if (format === "docx") {
        this.populateDocxContent(panelElement, !!content);
        this.displayStates[format] = { populated: true, available: !!content };
        return;
      }

      // Handle PPTX format specially (binary download-only)
      if (format === "pptx") {
        this.populatePptxContent(panelElement, !!content);
        this.displayStates[format] = { populated: true, available: !!content };
        return;
      }

      // ✅ PHASE 1: Handle PDF formats (binary download-only)
      if (format === "pdf" || format === "latexpdf") {
        this.populatePdfContent(panelElement, format, !!content);
        this.displayStates[format] = { populated: true, available: !!content };
        return;
      }

      // Handle LaTeX ZIP format specially
      if (format === "latex") {
        await this.populateLatexZipContent(panelElement, content);
        return;
      }

      // ✅ Handle HTML format specially (with preview controls)
      if (format === "html") {
        await this.populateHTMLFormatWithPreview(panelElement, content);
        return;
      }

      // Handle text-based formats
      if (!content || (typeof content === "string" && !content.trim())) {
        logDebug(`No content available for format: ${format}`);
        this.displayStates[format] = { populated: false, highlighted: false };
        return;
      }

      // Create format content container
      const formatContent = document.createElement("div");
      formatContent.className = "mathpix-format-content";

      // Create code block with syntax highlighting
      const codeWrapper = document.createElement("pre");
      codeWrapper.className = this.getLanguageClassForFormat(format);
      codeWrapper.tabIndex = 0;

      const codeElement = document.createElement("code");
      codeElement.className = this.getLanguageClassForFormat(format);
      codeElement.textContent = content;

      codeWrapper.appendChild(codeElement);
      formatContent.appendChild(codeWrapper);

      // Add export actions
      const exportActions = this.createFormatExportActions(format);
      formatContent.appendChild(exportActions);

      // Clear and populate panel
      panelElement.innerHTML = "";
      panelElement.appendChild(formatContent);

      // Apply syntax highlighting if available
      if (window.Prism && window.Prism.highlightElement) {
        try {
          logDebug(`Applying direct Prism highlighting to ${format}`, {
            element: codeElement.tagName,
            className: codeElement.className,
            contentLength: content.length,
          });

          window.Prism.highlightElement(codeElement);

          // Verify highlighting was applied
          const tokensFound = codeElement.querySelectorAll(".token").length;
          const highlightSuccess = tokensFound > 0;

          logInfo(`Direct Prism highlighting result for ${format}`, {
            tokensFound,
            highlightSuccess,
            element: codeElement.className,
          });

          this.displayStates[format] = {
            populated: true,
            highlighted: highlightSuccess,
          };
        } catch (highlightError) {
          logError("Direct Prism highlighting failed", {
            format,
            error: highlightError.message,
            prismAvailable: typeof window.Prism !== "undefined",
          });
          this.displayStates[format] = { populated: true, highlighted: false };
        }
      } else {
        // No Prism available
        logWarn(`No Prism highlighting available for format: ${format}`, {
          prismAvailable: typeof window.Prism !== "undefined",
          prismHighlightElement: !!(
            window.Prism && window.Prism.highlightElement
          ),
        });
        this.displayStates[format] = { populated: true, highlighted: false };
      }
    } catch (error) {
      logError(`Failed to populate content for format: ${format}`, error);

      if (this.formatElements.panels[format]) {
        this.formatElements.panels[format].innerHTML = `
        <div class="mathpix-error-content">
          <p>Error displaying ${format.toUpperCase()} content</p>
          <p>Please try refreshing or contact support if the issue persists.</p>
        </div>
      `;
      }

      this.displayStates[format] = { populated: false, highlighted: false };
      throw error;
    }
  }

  /**
   * @method populateHTMLFormatWithPreview
   * @description Populates HTML format with integrated preview toggle functionality
   * @param {HTMLElement} panelElement - Panel to populate
   * @param {string} content - HTML content to display
   * @returns {Promise<void>}
   * @private
   * @since 3.1.0
   */
  async populateHTMLFormatWithPreview(panelElement, content) {
    logDebug("Populating HTML format with preview controls", {
      hasContent: !!content,
      contentLength: content?.length || 0,
    });

    // Handle empty content
    if (!content || (typeof content === "string" && !content.trim())) {
      logDebug("No HTML content available");
      this.displayStates.html = { populated: false, highlighted: false };
      return;
    }

    // Enhance tables with ARIA before any processing
    content = this.enhanceTablesInHtml(content);
    logDebug("HTML content processed for table accessibility");

    // ✅ PHASE 6 FIX: Update source data so download/copy get enhanced content
    if (this.currentResults && this.currentResults.html) {
      this.currentResults.html = content;
      logDebug("Updated currentResults.html with enhanced content", {
        enhancedLength: content.length,
        hasAria: /role="table"/.test(content),
      });
    }

    try {
      // Create format content container (matching existing architecture)
      const formatContent = document.createElement("div");
      formatContent.className = "mathpix-format-content";

      // Analyze content for preview controls
      const lines = content.split("\n");
      const totalLines = lines.length;
      const previewLines = 10;
      const shouldTruncate = totalLines > previewLines;

      logDebug("HTML preview truncation analysis", {
        totalLines,
        previewLines,
        shouldTruncate,
        willTruncate: shouldTruncate,
      });

      // Create HTML preview controls if content should be truncated
      if (shouldTruncate) {
        const controlsContainer = document.createElement("div");
        controlsContainer.className = "html-preview-controls";
        controlsContainer.innerHTML = `
          <div class="preview-control-header">
            <button type="button" id="html-expand-toggle-pdf" class="preview-toggle-btn" aria-expanded="false">
              <span id="html-toggle-icon-pdf" class="toggle-icon" aria-hidden="true">▼</span>
              <span id="html-toggle-text-pdf" class="toggle-text">Show ${
                totalLines - previewLines
              } more lines</span>
            </button>
            <div class="preview-info">
              <span class="preview-stats">
                Showing <span id="html-visible-lines-pdf" class="line-count">${previewLines}</span> of 
                <span id="html-total-lines-pdf" class="line-count">${totalLines}</span> lines
              </span>
              <span id="html-size-info-pdf" class="size-info">${(
                content.length / 1024
              ).toFixed(1)}KB</span>
            </div>
          </div>
        `;
        formatContent.appendChild(controlsContainer);
      }

      // Create code block container (matching existing architecture)
      const codeWrapper = document.createElement("pre");
      codeWrapper.className = this.getLanguageClassForFormat("html");
      codeWrapper.tabIndex = 0;

      // Create code element with initial content (truncated if needed)
      const codeElement = document.createElement("code");
      codeElement.className = this.getLanguageClassForFormat("html");
      codeElement.id = "mathpix-pdf-content-html";

      // ✅ Fix: Properly handle content truncation with immediate application
      let displayContent;
      if (shouldTruncate) {
        // ✅ Critical Fix: Actually truncate the content for display
        const truncatedLines = lines.slice(0, previewLines);
        displayContent = truncatedLines.join("\n");

        // ✅ Enhanced content storage with proper metadata
        codeElement.dataset.fullContent = content;
        codeElement.dataset.truncatedContent = displayContent;
        codeElement.dataset.isCurrentlyTruncated = "true";
        codeElement.dataset.originalLines = totalLines.toString();
        codeElement.dataset.previewLines = previewLines.toString();
        codeElement.dataset.shouldOptimizeHighlighting = (
          totalLines > 100
        ).toString();

        logDebug("Content truncated for HTML preview", {
          originalLines: totalLines,
          truncatedLines: truncatedLines.length,
          previewLines: previewLines,
          actualDisplayLength: displayContent.split("\n").length,
          isProperlyTruncated:
            displayContent.split("\n").length <= previewLines,
        });
      } else {
        displayContent = content;
        codeElement.dataset.isCurrentlyTruncated = "false";
        codeElement.dataset.fullContent = content;
        codeElement.dataset.originalLines = totalLines.toString();
        codeElement.dataset.previewLines = totalLines.toString();
      }

      // ✅ Critical Fix: Use the displayContent (truncated) not the full content
      codeElement.textContent = displayContent;

      codeWrapper.appendChild(codeElement);

      // Create content container with collapse state if needed
      const htmlContentContainer = document.createElement("div");
      htmlContentContainer.className = "html-content-container";
      if (shouldTruncate) {
        htmlContentContainer.setAttribute("data-collapsed", "true");
        htmlContentContainer.classList.add("html-content-collapsed");
      }

      htmlContentContainer.appendChild(codeWrapper);
      formatContent.appendChild(htmlContentContainer);

      // Add export actions (matching existing architecture)
      const exportActions = this.createFormatExportActions("html");
      formatContent.appendChild(exportActions);

      // Clear and populate panel
      panelElement.innerHTML = "";
      panelElement.appendChild(formatContent);

      // Apply syntax highlighting
      if (window.Prism && window.Prism.highlightElement) {
        try {
          logDebug("Applying Prism highlighting to HTML format", {
            element: codeElement.tagName,
            className: codeElement.className,
            contentLength: displayContent.length,
          });

          window.Prism.highlightElement(codeElement);

          const tokensFound = codeElement.querySelectorAll(".token").length;
          const highlightSuccess = tokensFound > 0;

          logInfo("Prism highlighting result for HTML format", {
            tokensFound,
            highlightSuccess,
          });

          this.displayStates.html = {
            populated: true,
            highlighted: highlightSuccess,
          };
        } catch (highlightError) {
          logError("HTML Prism highlighting failed", {
            error: highlightError.message,
          });
          this.displayStates.html = { populated: true, highlighted: false };
        }
      } else {
        logWarn("No Prism highlighting available for HTML format");
        this.displayStates.html = { populated: true, highlighted: false };
      }

      // Set up toggle functionality if truncated
      if (shouldTruncate) {
        this.setupHTMLToggleForPDF(
          content,
          displayContent,
          totalLines,
          previewLines
        );
      }

      logInfo("HTML format populated with preview controls", {
        totalLines,
        truncated: shouldTruncate,
        previewLines: shouldTruncate ? previewLines : totalLines,
        highlighted: this.displayStates.html.highlighted,
      });
    } catch (error) {
      logError("Failed to populate HTML format with preview", error);

      panelElement.innerHTML = `
        <div class="mathpix-error-content">
          <p>Error displaying HTML content</p>
          <p>Please try refreshing or contact support if the issue persists.</p>
        </div>
      `;

      this.displayStates.html = { populated: false, highlighted: false };
      throw error;
    }
  }

  /**
   * @method setupHTMLToggleForPDF
   * @description Sets up HTML toggle functionality for PDF results with full content management
   * @param {string} fullContent - Complete HTML content
   * @param {string} truncatedContent - Initial truncated content
   * @param {number} totalLines - Total line count
   * @param {number} previewLines - Preview line count
   * @returns {void}
   * @private
   * @since 3.1.0
   */
  setupHTMLToggleForPDF(
    fullContent,
    truncatedContent,
    totalLines,
    previewLines
  ) {
    const toggleButton = document.getElementById("html-expand-toggle-pdf");
    const toggleIcon = document.getElementById("html-toggle-icon-pdf");
    const toggleText = document.getElementById("html-toggle-text-pdf");
    const visibleLines = document.getElementById("html-visible-lines-pdf");
    const container = document.querySelector(".html-content-container");
    const codeElement = document.getElementById("mathpix-pdf-content-html");

    if (!toggleButton || !container || !codeElement) {
      logWarn("HTML toggle elements not found for PDF results");
      return;
    }

    // ✅ Initialize toggle state properly - always start collapsed
    let isExpanded = false;

    // ✅ Reset initial state to ensure consistent testing
    container.classList.remove("html-content-expanded");
    container.classList.add("html-content-collapsed");
    toggleButton.setAttribute("aria-expanded", "false");
    toggleIcon.textContent = "▼";
    toggleText.textContent = `Show ${totalLines - previewLines} more lines`;
    if (visibleLines) visibleLines.textContent = previewLines.toString();

    const toggleHandler = () => {
      // ✅ Enhanced debounce rapid clicks with performance tracking
      if (toggleButton.dataset.toggling === "true") return;
      toggleButton.dataset.toggling = "true";

      const startTime = performance.now();
      isExpanded = !isExpanded;

      logDebug("HTML toggle activated", {
        expanded: isExpanded,
        fromLines: isExpanded ? previewLines : totalLines,
        toLines: isExpanded ? totalLines : previewLines,
      });

      // ✅ Update content using stored data attributes with fallback
      const storedFullContent = codeElement.dataset.fullContent || fullContent;
      const storedTruncatedContent =
        codeElement.dataset.truncatedContent || truncatedContent;

      // ✅ Immediate content update for better performance
      codeElement.textContent = isExpanded
        ? storedFullContent
        : storedTruncatedContent;
      codeElement.dataset.isCurrentlyTruncated = (!isExpanded).toString();

      // Update UI states immediately (before expensive highlighting)
      toggleButton.setAttribute("aria-expanded", isExpanded.toString());
      container.setAttribute("data-collapsed", (!isExpanded).toString());

      if (isExpanded) {
        toggleIcon.textContent = "▲";
        toggleText.textContent = "Show less";
        visibleLines.textContent = totalLines.toString();
        container.classList.add("html-content-expanded");
        container.classList.remove("html-content-collapsed");
      } else {
        toggleIcon.textContent = "▼";
        toggleText.textContent = `Show ${totalLines - previewLines} more lines`;
        visibleLines.textContent = previewLines.toString();
        container.classList.add("html-content-collapsed");
        container.classList.remove("html-content-expanded");

        // Smooth scroll to top when collapsing
        setTimeout(() => {
          container.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }

      // ✅ Async syntax highlighting to prevent blocking
      if (window.Prism && window.Prism.highlightElement) {
        // Only re-highlight for smaller content or when expanding
        const shouldReHighlight = isExpanded || totalLines <= 100;

        if (shouldReHighlight) {
          // Use requestAnimationFrame for non-blocking highlighting
          requestAnimationFrame(() => {
            try {
              window.Prism.highlightElement(codeElement);
              logDebug("Async syntax highlighting completed", {
                expanded: isExpanded,
                lines: isExpanded ? totalLines : previewLines,
              });
            } catch (error) {
              logWarn("Failed to reapply syntax highlighting", error);
            } finally {
              // Reset debounce flag
              setTimeout(() => {
                toggleButton.dataset.toggling = "false";
              }, 50);
            }
          });
        } else {
          // Skip highlighting for large collapsed content
          logDebug("Skipping highlighting for large collapsed content", {
            totalLines,
          });
          setTimeout(() => {
            toggleButton.dataset.toggling = "false";
          }, 50);
        }
      } else {
        setTimeout(() => {
          toggleButton.dataset.toggling = "false";
        }, 50);
      }
    };

    // Remove any existing listeners to prevent duplicates
    if (toggleButton._htmlToggleHandler) {
      toggleButton.removeEventListener(
        "click",
        toggleButton._htmlToggleHandler
      );
    }

    toggleButton._htmlToggleHandler = toggleHandler;
    toggleButton.addEventListener("click", toggleHandler);

    logDebug("HTML toggle functionality setup complete for PDF results", {
      totalLines,
      previewLines,
      contentSize: fullContent.length,
    });
  }

  /**
   * @method populateLatexZipContent
   * @description Extracts and displays LaTeX ZIP content with syntax highlighting
   * @param {HTMLElement} panelElement - Panel element to populate
   * @param {string|Blob|ArrayBuffer} zipData - ZIP file data
   * @returns {Promise<void>}
   * @private
   */
  async populateLatexZipContent(panelElement, zipData) {
    try {
      if (!zipData) {
        logDebug("No LaTeX ZIP content available");
        this.displayStates.latex = { populated: false, highlighted: false };
        return;
      }

      logDebug("Extracting LaTeX ZIP content", {
        dataType: typeof zipData,
        dataSize: zipData.length || zipData.size || "unknown",
      });

      // Check if JSZip is available
      if (typeof JSZip === "undefined") {
        throw new Error("JSZip library not available");
      }

      // Convert string to proper format if needed
      let processedData = zipData;
      if (typeof zipData === "string") {
        const bytes = new Uint8Array(zipData.length);
        for (let i = 0; i < zipData.length; i++) {
          bytes[i] = zipData.charCodeAt(i);
        }
        processedData = bytes;
      }

      // Load and extract ZIP
      const zip = await JSZip.loadAsync(processedData);

      // Find .tex files
      const texFiles = [];
      await Promise.all(
        Object.keys(zip.files).map(async (filename) => {
          const file = zip.files[filename];
          if (
            !file.dir &&
            (filename.endsWith(".tex") || filename.endsWith(".latex"))
          ) {
            const content = await file.async("string");
            texFiles.push({ name: filename, content: content });
          }
        })
      );

      if (texFiles.length > 0) {
        // Display main .tex file with Prism highlighting
        const mainFile = texFiles[0];

        // Create format content container
        const formatContent = document.createElement("div");
        formatContent.className = "mathpix-format-content";

        // Add ZIP info
        const zipInfo = document.createElement("div");
        zipInfo.className = "latex-zip-info";
        zipInfo.style.cssText =
          "margin-bottom: 1rem; padding: 0.5rem; background: #f5f5f5; border-radius: 4px; font-size: 0.9em;";
        zipInfo.innerHTML = `
        <p style="margin: 0 0 0.5rem 0;"><strong><svg height="21" aria-hidden="true" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 4)"><path d="m.5 1.5v9c0 1.1045695.8954305 2 2 2h10c1.1045695 0 2-.8954305 2-2v-6.00280762c.0007656-1.05436179-.8150774-1.91816512-1.8499357-1.99451426l-.1500643-.00468356-5 .00200544-2-2h-4c-.55228475 0-1 .44771525-1 1z"/><path d="m.5 2.5h7"/></g></svg> LaTeX ZIP extracted:</strong> ${
          texFiles.length
        } .tex file(s) found</p>
        <p style="margin: 0;"><strong>Displaying:</strong> ${this.escapeHtml(
          mainFile.name
        )}</p>
      `;
        formatContent.appendChild(zipInfo);

        // Create code block with syntax highlighting
        const codeWrapper = document.createElement("pre");
        codeWrapper.className = "language-latex";
        codeWrapper.tabIndex = 0;

        const codeElement = document.createElement("code");
        codeElement.className = "language-latex";
        codeElement.textContent = mainFile.content;

        codeWrapper.appendChild(codeElement);
        formatContent.appendChild(codeWrapper);

        // Add export actions
        const exportActions = this.createLatexZipExportActions();
        formatContent.appendChild(exportActions);

        // Clear and populate panel
        panelElement.innerHTML = "";
        panelElement.appendChild(formatContent);

        // Apply syntax highlighting
        if (window.Prism && window.Prism.highlightElement) {
          window.Prism.highlightElement(codeElement);
        }

        this.displayStates.latex = { populated: true, highlighted: true };
        logInfo("LaTeX ZIP content extracted and displayed successfully", {
          mainFile: mainFile.name,
          contentLength: mainFile.content.length,
          totalTexFiles: texFiles.length,
        });
      } else {
        throw new Error("No .tex files found in ZIP archive");
      }
    } catch (error) {
      logError("LaTeX ZIP extraction failed", error);

      // Show error with download fallback
      panelElement.innerHTML = `
      <div class="mathpix-format-content">
        <div class="mathpix-error-content">
          <p><strong>Error extracting LaTeX ZIP:</strong> ${this.escapeHtml(
            error.message
          )}</p>
          <p>You can still download the ZIP file directly.</p>
          <div class="mathpix-export-actions">
            <button class="mathpix-action-button mathpix-download-button" onclick="window.downloadLatexZip()" aria-label="Download LaTeX ZIP file">
              <svg height="21" aria-hidden="true" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)"><path d="m2.5.5h7l3 3v7c0 1.1045695-.8954305 2-2 2h-8c-1.1045695 0-2-.8954305-2-2v-8c0-1.1045695.8954305-2 2-2z"/><path d="m4.50000081 8.5h4c.55228475 0 1 .44771525 1 1v3h-6v-3c0-.55228475.44771525-1 1-1z"/><path d="m3.5 3.5h2v2h-2z"/></g></svg>Download ZIP
            </button>
          </div>
        </div>
      </div>
    `;

      this.displayStates.latex = { populated: false, highlighted: false };
    }
  }

  /**
   * @method createLatexZipExportActions
   * @description Creates export actions for LaTeX ZIP content
   * @returns {HTMLElement} Export actions container
   * @private
   */
  createLatexZipExportActions() {
    const actionsContainer = document.createElement("div");
    actionsContainer.className = "mathpix-export-actions";

    // Copy LaTeX button
    const copyButton = document.createElement("button");
    copyButton.className = "mathpix-action-button mathpix-copy-button";
    copyButton.innerHTML =
      '<svg height="21" viewBox="0 0 21 21"width="21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 3)"> <path d="m3.5 1.5c-.44119105-.00021714-1.03893772-.0044496-1.99754087-.00501204-.51283429-.00116132-.93645365.3838383-.99544161.88103343l-.00701752.11906336v10.99753785c.00061498.5520447.44795562.9996604 1 1.0006148l10 .0061982c.5128356.0008356.9357441-.3849039.993815-.882204l.006185-.1172316v-11c0-.55228475-.4477152-1-1-1-.8704853-.00042798-1.56475733.00021399-2 0"/><path d="m4.5.5h4c.55228475 0 1 .44771525 1 1s-.44771525 1-1 1h-4c-.55228475 0-1-.44771525-1-1s.44771525-1 1-1z"/><path d="m2.5 5.5h5" /><path d="m2.5 7.5h7" /><path d="m2.5 9.5h3" /><path d="m2.5 11.5h6" /></g></svg> Copy LaTeX';
    copyButton.setAttribute("aria-label", "Copy LaTeX content to clipboard");
    copyButton.addEventListener("click", () => {
      this.copyLatexContent();
    });
    actionsContainer.appendChild(copyButton);

    // Download ZIP button
    const downloadButton = document.createElement("button");
    downloadButton.className = "mathpix-action-button mathpix-download-button";
    downloadButton.innerHTML =
      ' <svg height="21" aria-hidden="true" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)"><path d="m2.5.5h7l3 3v7c0 1.1045695-.8954305 2-2 2h-8c-1.1045695 0-2-.8954305-2-2v-8c0-1.1045695.8954305-2 2-2z"/><path d="m4.50000081 8.5h4c.55228475 0 1 .44771525 1 1v3h-6v-3c0-.55228475.44771525-1 1-1z"/><path d="m3.5 3.5h2v2h-2z"/></g></svg> Download ZIP';
    downloadButton.setAttribute("aria-label", "Download LaTeX ZIP file");
    downloadButton.addEventListener("click", () => {
      const baseFilename =
        this.documentInfo?.name?.replace(/\.[^/.]+$/, "") || "document";
      const filename = `${baseFilename}.md.zip`;
      this.handleBinaryDownload(content, filename, "md.zip");
    });
    actionsContainer.appendChild(downloadButton);

    return actionsContainer;
  }

  /**
   * @method copyLatexContent
   * @description Copies displayed LaTeX content to clipboard
   * @returns {Promise<void>}
   * @private
   */
  async copyLatexContent() {
    try {
      const codeElement = document.querySelector("#panel-latex code");
      if (codeElement && codeElement.textContent) {
        await navigator.clipboard.writeText(codeElement.textContent);
        this.showNotification("LaTeX content copied to clipboard!", "success");
        logInfo("LaTeX content copied to clipboard");
      } else {
        throw new Error("No LaTeX content found to copy");
      }
    } catch (error) {
      logError("Failed to copy LaTeX content", error);
      this.showNotification("Failed to copy LaTeX content", "error");
    }
  }

  /**
   * @method escapeHtml
   * @description Escapes HTML characters in text
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   * @private
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * @method setupTabSwitching
   * @description Configures accessible tab switching functionality with keyboard support
   *
   * Implements WCAG 2.2 AA compliant tab interface with proper ARIA attributes,
   * keyboard navigation, and screen reader support. Manages tab state and content visibility.
   *
   * @returns {void}
   *
   * @example
   * renderer.setupTabSwitching();
   *
   * @accessibility Full keyboard navigation with arrow keys, home/end, and tab support
   * @since 2.1.0
   */
  setupTabSwitching() {
    logDebug("Setting up accessible tab switching");

    const tabElements = Object.values(this.formatElements.tabs).filter(Boolean);

    if (tabElements.length === 0) {
      logWarn("No tab elements found for tab switching setup");
      return;
    }

    // ✅ PHASE 2B: Add archive format tab listeners
    const archiveFormats = ["mmdzip", "mdzip", "htmlzip"];
    archiveFormats.forEach((format) => {
      const tabElement = document.getElementById(`tab-${format}`);
      if (tabElement) {
        tabElement.addEventListener("click", () => this.switchToFormat(format));
        logDebug(`Archive format tab listener added: ${format}`);
      }
    });

    // Setup ARIA attributes for accessibility
    tabElements.forEach((tabElement, index) => {
      const format = tabElement.getAttribute("data-format");
      const panelElement = this.formatElements.panels[format];

      // Configure tab element
      tabElement.setAttribute("role", "tab");
      tabElement.setAttribute("aria-controls", `panel-${format}`);
      tabElement.setAttribute("aria-selected", "false");
      tabElement.setAttribute("tabindex", index === 0 ? "0" : "-1");

      // Configure panel element
      if (panelElement) {
        panelElement.setAttribute("role", "tabpanel");
        panelElement.setAttribute("aria-labelledby", `tab-${format}`);
        panelElement.setAttribute("id", `panel-${format}`);
        panelElement.style.display = "none"; // Hide all panels initially
      }
    });

    // Add click event listeners
    tabElements.forEach((tabElement) => {
      tabElement.addEventListener("click", (event) => {
        event.preventDefault();
        const format = tabElement.getAttribute("data-format");
        this.switchToFormat(format);
      });
    });

    // Add keyboard navigation support
    tabElements.forEach((tabElement, index) => {
      tabElement.addEventListener("keydown", (event) => {
        this.handleTabKeydown(event, tabElements, index);
      });
    });

    logInfo("Tab switching setup completed", {
      tabCount: tabElements.length,
      availableFormats: tabElements.map((tab) =>
        tab.getAttribute("data-format")
      ),
    });
  }

  // ✅ DEAD CODE REMOVED: setupExportFunctionality and placeholder handlers
  // These methods were causing conflicts with the working export system.
  // Export functionality is now handled exclusively by:
  // - createFormatExportActions() creates buttons with proper event listeners
  // - handleFormatExport() processes all export operations
  //
  // This removal prevents future conflicts and regression issues.

  /**
   * @method handleFormatExport
   * @description Handles export actions for specific formats (copy, download, preview)
   *
   * Provides comprehensive export functionality with format-appropriate handling.
   * Supports clipboard operations, file downloads, and preview displays.
   *
   * @param {string} format - Format to export (mmd, html, latex, docx)
   * @param {string} action - Export action (copy, download, preview)
   *
   * @returns {Promise<void>}
   *
   * @throws {Error} When export operation fails
   *
   * @example
   * await renderer.handleFormatExport('latex', 'copy');
   * await renderer.handleFormatExport('docx', 'download');
   *
   * @accessibility Provides screen reader feedback for export completion
   * @since 2.1.0
   */
  async handleFormatExport(format, action) {
    logInfo("Handling format export", { format, action });

    try {
      // ✅ PHASE 3 FIX: Map UI format names to actual result keys
      const formatMapping = {
        mmd: "mmd",
        html: "html",
        latex: "tex.zip", // Critical fix: latex UI maps to tex.zip result key
        docx: "docx",
      };

      const resultKey = formatMapping[format] || format;

      // Debug current state
      logDebug("Format export debug info", {
        format,
        resultKey,
        hasCurrentResults: !!this.currentResults,
        availableKeys: this.currentResults
          ? Object.keys(this.currentResults)
          : [],
        hasRequestedContent: !!(
          this.currentResults && this.currentResults[resultKey]
        ),
      });

      if (!this.currentResults || !this.currentResults[resultKey]) {
        throw new Error(
          `No content available for ${format} format (looking for key: ${resultKey})`
        );
      }

      switch (action) {
        case "copy":
          await this.copyFormatToClipboard(format, resultKey);
          break;

        case "download":
          await this.downloadFormatFile(format, resultKey);
          break;

        case "preview":
          if (format === "html") {
            await this.previewHtmlContent();
          } else {
            throw new Error(`Preview not supported for ${format} format`);
          }
          break;

        default:
          throw new Error(`Unknown export action: ${action}`);
      }

      logInfo("Format export completed successfully", {
        format,
        action,
        resultKey,
      });
    } catch (error) {
      logError("Format export failed", {
        format,
        action,
        error: error.message,
      });
      this.showNotification(`Export failed: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * @method generateDownloadFile
   * @description Generates appropriate filename for downloads with correct extensions and MIME types
   *
   * Creates properly formatted files for download with correct extensions and MIME types.
   * Handles both text-based and binary formats appropriately.
   *
   * @param {string} format - Format to generate file for
   * @param {string|Blob} content - Content to include in file
   * @param {string} baseFilename - Base filename without extension
   *
   * @returns {Object} Download information including URL, filename, and MIME type
   * @returns {string} returns.url - Blob URL for download
   * @returns {string} returns.filename - Complete filename with extension
   * @returns {string} returns.mimeType - MIME type for file
   *
   * @example
   * const downloadInfo = renderer.generateDownloadFile('latex', content, 'document');
   * // Returns: { url: 'blob:...', filename: 'document.tex', mimeType: 'text/plain' }
   *
   * @private
   * @since 2.1.0
   */
  generateDownloadFile(format, content, baseFilename) {
    logDebug("Generating download file", { format, baseFilename });

    const formatConfig = {
      mmd: { extension: ".md", mimeType: "text/markdown" },
      md: { extension: ".md", mimeType: "text/markdown" }, // Feature 3: Plain Markdown (same extension as MMD)
      html: { extension: ".html", mimeType: "text/html" },
      pdf: {
        extension: ".pdf",
        mimeType: "application/pdf",
      }, // Phase 1: PDF (HTML Rendering)
      latexpdf: {
        extension: ".latex.pdf",
        mimeType: "application/pdf",
      }, // Phase 1: PDF (LaTeX Rendering) - different extension to distinguish
      latex: { extension: ".zip", mimeType: "application/zip" }, // ✅ FIXED: LaTeX is ZIP
      docx: {
        extension: ".docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      pptx: {
        extension: ".pptx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }, // Phase 2: PowerPoint
    };

    const config = formatConfig[format];
    if (!config) {
      throw new Error(`Unsupported format for download: ${format}`);
    }

    const filename = `${baseFilename}${config.extension}`;

    // Handle different content types
    let blob;
    if (content instanceof Blob) {
      // Already a blob (e.g., DOCX from API)
      blob = content;
    } else {
      // Text content - create blob with UTF-8 encoding
      blob = new Blob([content], {
        type: config.mimeType + ";charset=utf-8",
      });
    }

    const url = URL.createObjectURL(blob);

    logDebug("Download file generated", {
      format,
      filename,
      mimeType: config.mimeType,
      size: blob.size,
    });

    return {
      url,
      filename,
      mimeType: config.mimeType,
    };
  }

  /**
   * @method exposeGlobalFunctions
   * @description Exposes download functions globally for button access
   *
   * Makes download functions available as window.* for onclick handlers
   * in dynamically generated content.
   *
   * @returns {void}
   * @since 2.1.0
   */
  exposeGlobalFunctions() {
    // ✅ PHASE 3 FIX: Global download functions for LaTeX ZIP buttons
    window.downloadLatexZip = () => {
      logInfo("Global LaTeX ZIP download called");
      this.handleFormatExport("latex", "download");
    };

    window.copyLatexContent = () => {
      logInfo("Global LaTeX copy called");
      this.handleFormatExport("latex", "copy");
    };

    window.downloadMathPixFormat = (format) => {
      logInfo("Global format download called", { format });
      this.handleFormatExport(format, "download");
    };

    window.copyMathPixFormat = (format) => {
      logInfo("Global format copy called", { format });
      this.handleFormatExport(format, "copy");
    };

    logDebug("✅ Global download functions exposed", {
      downloadLatexZip: typeof window.downloadLatexZip,
      copyLatexContent: typeof window.copyLatexContent,
      downloadMathPixFormat: typeof window.downloadMathPixFormat,
      copyMathPixFormat: typeof window.copyMathPixFormat,
    });
  }

  /**
   * @method updateDocumentMetadata
   * @description Updates document information display with processing metadata
   *
   * Populates document metadata fields including filename, size, page information,
   * and processing statistics. Provides comprehensive document context.
   *
   * @param {Object} documentInfo - Document metadata to display
   *
   * @returns {void}
   *
   * @example
   * renderer.updateDocumentMetadata({
   *   name: "research-paper.pdf",
   *   size: 2048576,
   *   pageCount: "15",
   *   pageRange: "1-15"
   * });
   *
   * @since 2.1.0
   */
  updateDocumentMetadata(documentInfo) {
    logDebug("Updating document metadata", documentInfo);

    try {
      // ✅ CRITICAL FIX: Use direct DOM queries to ensure elements are found
      // Update document name
      const nameElement = document.getElementById("mathpix-doc-name");
      if (nameElement && documentInfo.name) {
        nameElement.textContent = documentInfo.name;
        logDebug("Updated document name", documentInfo.name);
      } else {
        logWarn("Document name element not found or no name provided", {
          elementExists: !!nameElement,
          hasName: !!documentInfo.name,
        });
      }

      // Update page count - prioritize Lines API data over documentInfo
      const pagesElement = document.getElementById("mathpix-doc-pages");
      if (pagesElement) {
        // Use Lines API total pages if available, otherwise fall back to documentInfo
        const pageCount =
          this.linesAnalysis?.totalPages || documentInfo.pageCount;
        if (pageCount) {
          pagesElement.textContent = `${pageCount} pages`;
          logDebug("Updated page count", {
            count: pageCount,
            source: this.linesAnalysis?.totalPages
              ? "Lines API"
              : "documentInfo",
          });
        }
      } else {
        logWarn("Pages element not found or no page count provided", {
          elementExists: !!pagesElement,
          hasPageCount: !!documentInfo.pageCount,
        });
      }

      // ✅ FIX: Update processing time using correct element ID from HTML
      const timeElement = document.getElementById("mathpix-doc-time");
      if (timeElement && this.currentResults?.processingMetadata?.totalTime) {
        const timeSeconds = (
          this.currentResults.processingMetadata.totalTime / 1000
        ).toFixed(1);
        timeElement.textContent = `${timeSeconds} seconds`;
        logDebug("Updated processing time", timeSeconds);
      } else if (timeElement) {
        // Show fallback message if no processing time available
        timeElement.textContent = "Processing complete";
        logDebug("Set fallback processing time message");
      }

      // ✅ FIX: Update formats using correct element ID from HTML
      const formatsElement = document.getElementById("mathpix-doc-formats");
      if (formatsElement && this.currentResults) {
        const availableFormats = Object.keys(this.currentResults)
          .filter(
            (key) => key !== "processingMetadata" && this.currentResults[key]
          )
          .map((format) => format.toUpperCase())
          .join(", ");
        formatsElement.textContent = availableFormats || "Standard formats";
        logDebug("Updated available formats", availableFormats);
      } else {
        logWarn("Formats element not found or no results available", {
          elementExists: !!formatsElement,
          hasResults: !!this.currentResults,
        });
      }

      logDebug("Document metadata updated successfully", {
        name: documentInfo.name,
        pageCount: documentInfo.pageCount,
        hasProcessingTime: !!this.currentResults?.processingMetadata?.totalTime,
      });
    } catch (error) {
      logError("Error updating document metadata", error);
      // Don't throw - this shouldn't break the overall display process
    }
  }

  /**
   * @method validateExportFunctionality
   * @description Validates that export functionality is properly configured
   *
   * Prevents regression issues by checking button health and export method availability.
   * Throws error if critical issues are detected to prevent silent failures.
   *
   * @returns {void}
   * @throws {Error} When export functionality is compromised
   * @since 2.1.0
   */
  validateExportFunctionality() {
    logDebug("Validating export functionality configuration");

    const exportButtons = document.querySelectorAll(".mathpix-action-button");
    let workingButtons = 0;
    let brokenButtons = 0;

    exportButtons.forEach((button) => {
      const hasOnclick = button.getAttribute("onclick");
      const hasThisContext = hasOnclick && hasOnclick.includes("this.");

      if (hasThisContext) {
        brokenButtons++;
        logError(`Export button has broken context: ${button.className}`, {
          onclick: hasOnclick,
          element: button,
        });
      } else {
        workingButtons++;
      }
    });

    // Validate core export method exists
    const hasExportMethod = typeof this.handleFormatExport === "function";

    logInfo(`Export validation completed`, {
      workingButtons,
      brokenButtons,
      hasExportMethod,
      totalButtons: exportButtons.length,
    });

    // Throw error for critical issues
    if (brokenButtons > 0) {
      throw new Error(
        `Export functionality compromised: ${brokenButtons} buttons with context issues detected`
      );
    }

    if (!hasExportMethod) {
      throw new Error("Critical export method handleFormatExport is missing");
    }

    if (workingButtons === 0 && exportButtons.length > 0) {
      throw new Error(
        "No working export buttons found despite buttons being present"
      );
    }

    logDebug("Export functionality validation passed");
  }

  /**
   * @method setupFinalActions
   * @description Configures final user action buttons (process another, clear results)
   *
   * Sets up workflow continuation options with proper event handling and accessibility.
   * Provides clear pathways for users to continue using the system.
   *
   * @returns {void}
   *
   * @example
   * renderer.setupFinalActions();
   *
   * @since 2.1.0
   */
  setupFinalActions() {
    logDebug("Setting up final user actions");

    try {
      // ✅ PHASE 4 FINAL FIX: Use direct DOM queries instead of cached elements
      // These buttons are created dynamically and not cached at initialization

      // Process Another Document button
      const processAnotherButton = document.getElementById(
        "mathpix-process-another-pdf"
      );
      if (processAnotherButton) {
        processAnotherButton.addEventListener("click", () => {
          this.handleProcessAnother();
        });
        logDebug("Process Another button configured successfully");
      } else {
        logWarn(
          "Process Another button not found in DOM - ID: mathpix-process-another-pdf"
        );
      }

      // Clear Results button
      const clearResultsButton = document.getElementById(
        "mathpix-clear-pdf-results"
      );
      if (clearResultsButton) {
        clearResultsButton.addEventListener("click", () => {
          this.handleClearResults();
        });
        logDebug("Clear Results button configured successfully");
      } else {
        logWarn(
          "Clear Results button not found in DOM - ID: mathpix-clear-pdf-results"
        );
      }

      logDebug("Final user actions configured successfully");
    } catch (error) {
      logWarn("Error setting up final actions", error);
    }
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * @method populateAllFormatContent
   * @description Populates content for all available formats with API format mapping
   * @param {Object} results - Processing results
   * @returns {Promise<void>}
   * @private
   */
  async populateAllFormatContent(results) {
    logDebug("Populating all format content", {
      availableFormats: Object.keys(results),
    });

    // Map UI formats to result keys
    const formatMapping = {
      mmd: "mmd",
      md: "md", // Feature 3: Plain Markdown
      html: "html",
      pdf: "pdf", // Phase 1: PDF (HTML Rendering)
      latexpdf: "latex.pdf", // Phase 1: PDF (LaTeX Rendering)
      latex: "tex.zip", // LaTeX comes as ZIP file
      docx: "docx",
      pptx: "pptx", // Phase 2: PowerPoint
    };

    const formats = [
      "mmd",
      "md",
      "html",
      "pdf",
      "latexpdf",
      "latex",
      "docx",
      "pptx",
    ];
    const formatPromises = formats.map(async (format) => {
      const resultKey = formatMapping[format];
      const content = results[resultKey];

      logDebug(`Processing format ${format} (${resultKey})`, {
        hasContent: !!content,
        contentType: typeof content,
        contentSize: content?.length || content?.size || "N/A",
      });

      if (content !== undefined) {
        await this.populateFormatContent(format, content);
      }
    });

    await Promise.all(formatPromises);
  }

  /**
   * @method cacheFormatElements
   * @description Caches references to format-specific DOM elements using direct DOM queries
   * @returns {void}
   * @private
   */
  cacheFormatElements() {
    const formats = [
      "mmd",
      "md",
      "html",
      "pdf",
      "latexpdf",
      "latex",
      "docx",
      "pptx",
      "mmdzip",
      "mdzip",
      "htmlzip",
    ]; // Feature 3: Added "md" | Phase 1: Added "pdf", "latexpdf" | Phase 2: Added "pptx" | Phase 2B: Added archive formats

    formats.forEach((format) => {
      // Use direct DOM queries instead of cached elements to ensure we find existing elements
      this.formatElements.tabs[format] = document.getElementById(
        `tab-${format}`
      );
      this.formatElements.panels[format] = document.getElementById(
        `panel-${format}`
      );
    });

    logDebug("Format elements cached via direct DOM queries", {
      tabs: Object.keys(this.formatElements.tabs).filter(
        (k) => this.formatElements.tabs[k]
      ),
      panels: Object.keys(this.formatElements.panels).filter(
        (k) => this.formatElements.panels[k]
      ),
    });
  }
  /**
   * @method showResultsContainer
   * @description Shows the PDF results container
   * @returns {void}
   * @private
   */
  showResultsContainer() {
    const resultsContainer = this.elements["mathpix-pdf-results"];
    if (resultsContainer) {
      resultsContainer.style.display = "block";
      resultsContainer.setAttribute("aria-hidden", "false");
    }
  }

  /**
   * @method resetDisplayStates
   * @description Resets all display states for new results
   * @returns {void}
   * @private
   */
  resetDisplayStates() {
    Object.keys(this.displayStates).forEach((format) => {
      this.displayStates[format] = { populated: false, highlighted: false };
    });
  }

  /**
   * @method getLanguageClassForFormat
   * @description Gets appropriate Prism.js language class for format
   * @param {string} format - Format identifier
   * @returns {string} Prism.js language class
   * @private
   */
  getLanguageClassForFormat(format) {
    const languageMap = {
      mmd: "language-latex", // MMD from MathPix is actually LaTeX content
      md: "language-markdown", // Feature 3: Plain Markdown with proper syntax highlighting
      html: "language-markup",
      pdf: "language-text", // Phase 1: PDF (binary format, no syntax highlighting)
      latexpdf: "language-text", // Phase 1: PDF (binary format, no syntax highlighting)
      latex: "language-latex",
      pptx: "language-text", // Phase 2: PowerPoint (binary format, no syntax highlighting)
    };

    return languageMap[format] || "language-text";
  }

  /**
   * @method createFormatExportActions
   * @description Creates export action buttons for a format
   * @param {string} format - Format identifier
   * @returns {HTMLElement} Export actions container
   * @private
   */
  createFormatExportActions(format) {
    const actionsContainer = document.createElement("div");
    actionsContainer.className = "mathpix-export-actions";

    // Copy button (all text formats)
    if (format !== "docx") {
      const copyButton = document.createElement("button");
      copyButton.className = "mathpix-action-button mathpix-copy-button";
      copyButton.innerHTML =
        '<svg height="21" viewBox="0 0 21 21"width="21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 3)"> <path d="m3.5 1.5c-.44119105-.00021714-1.03893772-.0044496-1.99754087-.00501204-.51283429-.00116132-.93645365.3838383-.99544161.88103343l-.00701752.11906336v10.99753785c.00061498.5520447.44795562.9996604 1 1.0006148l10 .0061982c.5128356.0008356.9357441-.3849039.993815-.882204l.006185-.1172316v-11c0-.55228475-.4477152-1-1-1-.8704853-.00042798-1.56475733.00021399-2 0"/><path d="m4.5.5h4c.55228475 0 1 .44771525 1 1s-.44771525 1-1 1h-4c-.55228475 0-1-.44771525-1-1s.44771525-1 1-1z"/><path d="m2.5 5.5h5" /><path d="m2.5 7.5h7" /><path d="m2.5 9.5h3" /><path d="m2.5 11.5h6" /></g></svg> Copy';
      copyButton.setAttribute(
        "aria-label",
        `Copy ${format.toUpperCase()} content to clipboard`
      );
      copyButton.addEventListener("click", () => {
        this.handleFormatExport(format, "copy");
      });
      actionsContainer.appendChild(copyButton);
    }

    // Download button (all formats)
    const downloadButton = document.createElement("button");
    downloadButton.className = "mathpix-action-button mathpix-download-button";
    downloadButton.innerHTML =
      ' <svg height="21" aria-hidden="true" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)"><path d="m2.5.5h7l3 3v7c0 1.1045695-.8954305 2-2 2h-8c-1.1045695 0-2-.8954305-2-2v-8c0-1.1045695.8954305-2 2-2z"/><path d="m4.50000081 8.5h4c.55228475 0 1 .44771525 1 1v3h-6v-3c0-.55228475.44771525-1 1-1z"/><path d="m3.5 3.5h2v2h-2z"/></g></svg> Download';
    downloadButton.setAttribute(
      "aria-label",
      `Download ${format.toUpperCase()} file`
    );
    downloadButton.addEventListener("click", () => {
      this.handleFormatExport(format, "download");
    });
    actionsContainer.appendChild(downloadButton);

    // Preview button (HTML only)
    if (format === "html") {
      const previewButton = document.createElement("button");
      previewButton.className = "mathpix-action-button mathpix-preview-button";
      previewButton.innerHTML =
        '<svg height="21" aria-hidden="true" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 5)"><path d="m8.5 11c3.1296136 0 5.9629469-1.83333333 8.5-5.5-2.5370531-3.66666667-5.3703864-5.5-8.5-5.5-3.12961358 0-5.96294692 1.83333333-8.5 5.5 2.53705308 3.66666667 5.37038642 5.5 8.5 5.5z"/><path d="m8.5 2c.18463928 0 .36593924.01429736.54285316.04184538-.02850842.148891-.04285316.30184762-.04285316.45815462 0 1.38071187 1.1192881 2.5 2.5 2.5.156307 0 .3092636-.01434474.4576252-.04178957.0280774.17585033.0423748.35715029.0423748.54178957 0 1.93299662-1.5670034 3.5-3.5 3.5-1.93299662 0-3.5-1.56700338-3.5-3.5s1.56700338-3.5 3.5-3.5z"/></g></svg> Preview';
      previewButton.setAttribute("aria-label", "Preview HTML content");
      previewButton.addEventListener("click", () => {
        this.handleFormatExport(format, "preview");
      });
      actionsContainer.appendChild(previewButton);
    }

    return actionsContainer;
  }

  /**
   * @method populateDocxContent
   * @description Populates DOCX format content (download-only)
   * @param {HTMLElement} panelElement - Panel element to populate
   * @param {boolean} available - Whether DOCX is available
   * @returns {void}
   * @private
   */
  populateDocxContent(panelElement, available) {
    if (available) {
      // Create content structure using DOM creation to preserve event context
      const docxContent = document.createElement("div");
      docxContent.className = "mathpix-docx-content";

      // Create info section
      const docxInfo = document.createElement("div");
      docxInfo.className = "mathpix-docx-info";
      docxInfo.innerHTML = `
        <h3>Microsoft Word Document</h3>
        <p>DOCX format is available for download. This format preserves formatting and is compatible with Microsoft Word and other word processors.</p>
      `;

      // Create export actions container
      const exportActions = document.createElement("div");
      exportActions.className = "mathpix-export-actions";

      // Create download button with proper event listener (preserves context)
      const downloadButton = document.createElement("button");
      downloadButton.className =
        "mathpix-action-button mathpix-download-button";
      downloadButton.innerHTML =
        ' <svg height="21" aria-hidden="true" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)"><path d="m2.5.5h7l3 3v7c0 1.1045695-.8954305 2-2 2h-8c-1.1045695 0-2-.8954305-2-2v-8c0-1.1045695.8954305-2 2-2z"/><path d="m4.50000081 8.5h4c.55228475 0 1 .44771525 1 1v3h-6v-3c0-.55228475.44771525-1 1-1z"/><path d="m3.5 3.5h2v2h-2z"/></g></svg> Download DOCX';
      downloadButton.setAttribute("aria-label", "Download DOCX file");

      // ✅ CRITICAL FIX: Use addEventListener with arrow function to preserve 'this' context
      downloadButton.addEventListener("click", () => {
        this.handleFormatExport("docx", "download");
      });

      // Assemble the structure
      exportActions.appendChild(downloadButton);
      docxContent.appendChild(docxInfo);
      docxContent.appendChild(exportActions);

      // Clear and populate panel
      panelElement.innerHTML = "";
      panelElement.appendChild(docxContent);

      logDebug("DOCX content populated with proper event binding");
    } else {
      panelElement.innerHTML = `
        <div class="mathpix-no-content">
          <p>DOCX format not available</p>
          <p>This format was not requested or could not be generated during processing.</p>
        </div>
      `;
    }
  }

  /**
   * @method populatePptxContent
   * @description Populates PPTX format content (binary download-only)
   * @param {HTMLElement} panelElement - Panel element to populate
   * @param {boolean} available - Whether PPTX is available
   * @returns {void}
   * @private
   * @since 2.0.0 (Phase 2)
   */
  populatePptxContent(panelElement, available) {
    if (available) {
      // Create content structure using DOM creation to preserve event context
      const pptxContent = document.createElement("div");
      pptxContent.className = "mathpix-pptx-content";

      // Create info section
      const pptxInfo = document.createElement("div");
      pptxInfo.className = "mathpix-pptx-info";
      pptxInfo.innerHTML = `
        <h3>Microsoft PowerPoint Presentation</h3>
        <p><strong>Binary Format:</strong> PPTX files cannot be previewed here. Click "Download PPTX" below to save the file to your device.</p>
        <p class="format-description">PowerPoint format preserves slides, layouts, and formatting. Compatible with Microsoft PowerPoint, Google Slides, and other presentation software.</p>
      `;

      // Create export actions container
      const exportActions = document.createElement("div");
      exportActions.className = "mathpix-export-actions";

      // Create download button with proper event listener (preserves context)
      const downloadButton = document.createElement("button");
      downloadButton.className =
        "mathpix-action-button mathpix-download-button";
      downloadButton.innerHTML = `
        <svg height="21" aria-hidden="true" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg">
          <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)">
            <path d="m2.5.5h7l3 3v7c0 1.1045695-.8954305 2-2 2h-8c-1.1045695 0-2-.8954305-2-2v-8c0-1.1045695.8954305-2 2-2z"/>
            <path d="m4.50000081 8.5h4c.55228475 0 1 .44771525 1 1v3h-6v-3c0-.55228475.44771525-1 1-1z"/>
            <path d="m3.5 3.5h2v2h-2z"/>
          </g>
        </svg> Download PPTX
      `;
      downloadButton.setAttribute("aria-label", "Download PPTX file");

      // ✅ CRITICAL FIX: Use addEventListener with arrow function to preserve 'this' context
      downloadButton.addEventListener("click", () => {
        this.handleFormatExport("pptx", "download");
      });

      // Assemble the structure
      exportActions.appendChild(downloadButton);
      pptxContent.appendChild(pptxInfo);
      pptxContent.appendChild(exportActions);

      // Clear and populate panel
      panelElement.innerHTML = "";
      panelElement.appendChild(pptxContent);

      logDebug("PPTX content populated with proper event binding");
    } else {
      panelElement.innerHTML = `
        <div class="mathpix-no-content">
          <p>PPTX format not available</p>
          <p>This format was not requested or could not be generated during processing.</p>
        </div>
      `;
    }
  }

  /**
   * @method populatePdfContent
   * @description Populates PDF format content (binary download-only)
   * @param {HTMLElement} panelElement - Panel element to populate
   * @param {string} format - PDF format type (pdf or latexpdf)
   * @param {boolean} available - Whether PDF is available
   * @returns {void}
   * @private
   * @since 1.0.0 (Phase 1)
   */
  populatePdfContent(panelElement, format, available) {
    if (available) {
      const formatLabel =
        format === "pdf" ? "PDF (HTML Rendering)" : "PDF (LaTeX Rendering)";
      const formatDescription =
        format === "pdf"
          ? "PDF with HTML-rendered mathematics suitable for printing and sharing. Compatible with all PDF viewers."
          : "PDF with LaTeX-rendered mathematics featuring selectable equations. Superior typography for academic papers.";

      // Create content structure using DOM to preserve event context
      const pdfContent = document.createElement("div");
      pdfContent.className = "mathpix-pdf-content";

      // Create info section
      const pdfInfo = document.createElement("div");
      pdfInfo.className = "mathpix-pdf-info";
      pdfInfo.innerHTML = `
        <h3>${formatLabel}</h3>
        <p><strong>Binary Format:</strong> PDF files cannot be previewed here. Click "Download PDF" below to save the file to your device.</p>
        <p class="format-description">${formatDescription}</p>
      `;

      // Create export actions container
      const exportActions = document.createElement("div");
      exportActions.className = "mathpix-export-actions";

      // Create download button with proper event listener
      const downloadButton = document.createElement("button");
      downloadButton.className =
        "mathpix-action-button mathpix-download-button";
      downloadButton.innerHTML = `
        <svg height="21" aria-hidden="true" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg">
          <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)">
            <path d="m2.5.5h7l3 3v7c0 1.1045695-.8954305 2-2 2h-8c-1.1045695 0-2-.8954305-2-2v-8c0-1.1045695.8954305-2 2-2z"/>
            <path d="m4.50000081 8.5h4c.55228475 0 1 .44771525 1 1v3h-6v-3c0-.55228475.44771525-1 1-1z"/>
            <path d="m3.5 3.5h2v2h-2z"/>
          </g>
        </svg> Download PDF
      `;
      downloadButton.setAttribute("aria-label", `Download ${formatLabel}`);
      downloadButton.addEventListener("click", () => {
        this.handleFormatExport(format, "download");
      });

      // Assemble structure
      exportActions.appendChild(downloadButton);
      pdfContent.appendChild(pdfInfo);
      pdfContent.appendChild(exportActions);

      // Clear and populate panel
      panelElement.innerHTML = "";
      panelElement.appendChild(pdfContent);

      logDebug(`${formatLabel} content populated with proper event binding`);
    } else {
      panelElement.innerHTML = `
        <div class="mathpix-no-content">
          <p>${
            format === "pdf" ? "PDF (HTML)" : "PDF (LaTeX)"
          } format not available</p>
          <p>This format was not requested or could not be generated during processing.</p>
        </div>
      `;
    }
  }

  /**
   * @method populateMmdZipContent
   * @description Populates MMD archive format panel with download interface
   * @param {Object} resultData - Processing results containing mmd.zip blob
   * @returns {void}
   * @private
   * @since 2.2.0 (Phase 2B)
   */
  populateMmdZipContent(resultData) {
    const panel = document.getElementById("panel-mmdzip");
    if (!panel) {
      logWarn("MMD ZIP panel not found");
      return;
    }

    const content = resultData["mmd.zip"];
    if (!content) {
      panel.innerHTML = `
        <div class="mathpix-no-content">
          <p>MMD Archive format not available</p>
          <p>This format was not requested or could not be generated during processing.</p>
        </div>
      `;
      this.displayStates.mmdzip = { populated: false, available: false };
      return;
    }

    // Create content structure using DOM to preserve event context
    const mmdZipContent = document.createElement("div");
    mmdZipContent.className = "mathpix-binary-format-content";

    // Create info section
    const formatInfo = document.createElement("div");
    formatInfo.className = "mathpix-format-header";
    formatInfo.innerHTML = `
      <h4>MMD Archive (ZIP) Output</h4>
      <div class="mathpix-binary-format-message">
        <p><strong>Archive Format:</strong> This ZIP archive contains multiple files and cannot be previewed here. Click "Download Archive" below to save to your device.</p>
        <p class="format-description">
          This archive includes the MathPix Markdown (.mmd) file with all embedded images extracted from your PDF document, preserving mathematical notation and document structure.
        </p>
      </div>
    `;

    // Create export actions container
    const exportActions = document.createElement("div");
    exportActions.className = "mathpix-export-actions";

    // Create download button with proper event listener
    const downloadButton = document.createElement("button");
    downloadButton.className = "mathpix-action-button mathpix-download-button";
    downloadButton.innerHTML = `
      <svg height="21" aria-hidden="true" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg">
        <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)">
          <path d="m2.5.5h7l3 3v7c0 1.1045695-.8954305 2-2 2h-8c-1.1045695 0-2-.8954305-2-2v-8c0-1.1045695.8954305-2 2-2z"/>
          <path d="m4.50000081 8.5h4c.55228475 0 1 .44771525 1 1v3h-6v-3c0-.55228475.44771525-1 1-1z"/>
          <path d="m3.5 3.5h2v2h-2z"/>
        </g>
      </svg> Download Archive
    `;
    downloadButton.setAttribute("aria-label", "Download MMD ZIP archive");
    downloadButton.addEventListener("click", () => {
      const baseFilename =
        this.documentInfo?.name?.replace(/\.[^/.]+$/, "") || "document";
      const filename = `${baseFilename}.mmd.zip`;
      this.handleBinaryDownload(content, filename, "mmd.zip");
    });

    // Assemble structure
    exportActions.appendChild(downloadButton);
    mmdZipContent.appendChild(formatInfo);
    mmdZipContent.appendChild(exportActions);

    // Clear and populate panel
    panel.innerHTML = "";
    panel.appendChild(mmdZipContent);

    this.displayStates.mmdzip = { populated: true, available: true };
    logDebug("MMD ZIP content populated with proper event binding");
  }

  /**
   * @method populateMdZipContent
   * @description Populates MD archive format panel with download interface
   * @param {Object} resultData - Processing results containing md.zip blob
   * @returns {void}
   * @private
   * @since 2.2.0 (Phase 2B)
   */
  populateMdZipContent(resultData) {
    const panel = document.getElementById("panel-mdzip");
    if (!panel) {
      logWarn("MD ZIP panel not found");
      return;
    }

    const content = resultData["md.zip"];
    if (!content) {
      panel.innerHTML = `
        <div class="mathpix-no-content">
          <p>MD Archive format not available</p>
          <p>This format was not requested or could not be generated during processing.</p>
        </div>
      `;
      this.displayStates.mdzip = { populated: false, available: false };
      return;
    }

    // Create content structure using DOM to preserve event context
    const mdZipContent = document.createElement("div");
    mdZipContent.className = "mathpix-binary-format-content";

    // Create info section
    const formatInfo = document.createElement("div");
    formatInfo.className = "mathpix-format-header";
    formatInfo.innerHTML = `
      <h4>Markdown Archive (ZIP) Output</h4>
      <div class="mathpix-binary-format-message">
        <p><strong>Archive Format:</strong> This ZIP archive contains multiple files and cannot be previewed here. Click "Download Archive" below to save to your device.</p>
        <p class="format-description">
          This archive includes the plain Markdown (.md) file with all embedded images extracted from your PDF document, suitable for standard Markdown processors.
        </p>
      </div>
    `;

    // Create export actions container
    const exportActions = document.createElement("div");
    exportActions.className = "mathpix-export-actions";

    // Create download button with proper event listener
    const downloadButton = document.createElement("button");
    downloadButton.className = "mathpix-action-button mathpix-download-button";
    downloadButton.innerHTML = `
      <svg height="21" aria-hidden="true" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg">
        <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)">
          <path d="m2.5.5h7l3 3v7c0 1.1045695-.8954305 2-2 2h-8c-1.1045695 0-2-.8954305-2-2v-8c0-1.1045695.8954305-2 2-2z"/>
          <path d="m4.50000081 8.5h4c.55228475 0 1 .44771525 1 1v3h-6v-3c0-.55228475.44771525-1 1-1z"/>
          <path d="m3.5 3.5h2v2h-2z"/>
        </g>
      </svg> Download Archive
    `;
    downloadButton.setAttribute("aria-label", "Download MD ZIP archive");
    downloadButton.addEventListener("click", () => {
      this.handleBinaryDownload(content, "document.md.zip", "md.zip");
    });

    // Assemble structure
    exportActions.appendChild(downloadButton);
    mdZipContent.appendChild(formatInfo);
    mdZipContent.appendChild(exportActions);

    // Clear and populate panel
    panel.innerHTML = "";
    panel.appendChild(mdZipContent);

    this.displayStates.mdzip = { populated: true, available: true };
    logDebug("MD ZIP content populated with proper event binding");
  }

  /**
   * @method populateHtmlZipContent
   * @description Populates HTML archive format panel with download interface
   * @param {Object} resultData - Processing results containing html.zip blob
   * @returns {void}
   * @private
   * @since 2.2.0 (Phase 2B)
   */
  populateHtmlZipContent(resultData) {
    const panel = document.getElementById("panel-htmlzip");
    if (!panel) {
      logWarn("HTML ZIP panel not found");
      return;
    }

    const content = resultData["html.zip"];
    if (!content) {
      panel.innerHTML = `
        <div class="mathpix-no-content">
          <p>HTML Archive format not available</p>
          <p>This format was not requested or could not be generated during processing.</p>
        </div>
      `;
      this.displayStates.htmlzip = { populated: false, available: false };
      return;
    }

    // Create content structure using DOM to preserve event context
    const htmlZipContent = document.createElement("div");
    htmlZipContent.className = "mathpix-binary-format-content";

    // Create info section
    const formatInfo = document.createElement("div");
    formatInfo.className = "mathpix-format-header";
    formatInfo.innerHTML = `
      <h4>HTML Archive (ZIP) Output</h4>
      <div class="mathpix-binary-format-message">
        <p><strong>Archive Format:</strong> This ZIP archive contains multiple files and cannot be previewed here. Click "Download Archive" below to save to your device.</p>
        <p class="format-description">
          This archive includes the HTML file with embedded images and CSS styling extracted from your PDF document, ready for web deployment or viewing in any browser.
        </p>
      </div>
    `;

    // Create export actions container
    const exportActions = document.createElement("div");
    exportActions.className = "mathpix-export-actions";

    // Create download button with proper event listener
    const downloadButton = document.createElement("button");
    downloadButton.className = "mathpix-action-button mathpix-download-button";
    downloadButton.innerHTML = `
      <svg height="21" aria-hidden="true" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg">
        <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)">
          <path d="m2.5.5h7l3 3v7c0 1.1045695-.8954305 2-2 2h-8c-1.1045695 0-2-.8954305-2-2v-8c0-1.1045695.8954305-2 2-2z"/>
          <path d="m4.50000081 8.5h4c.55228475 0 1 .44771525 1 1v3h-6v-3c0-.55228475.44771525-1 1-1z"/>
          <path d="m3.5 3.5h2v2h-2z"/>
        </g>
      </svg> Download Archive
    `;
    downloadButton.setAttribute("aria-label", "Download HTML ZIP archive");
    downloadButton.addEventListener("click", () => {
      const baseFilename =
        this.documentInfo?.name?.replace(/\.[^/.]+$/, "") || "document";
      const filename = `${baseFilename}.html.zip`;
      this.handleBinaryDownload(content, filename, "html.zip");
    });

    // Assemble structure
    exportActions.appendChild(downloadButton);
    htmlZipContent.appendChild(formatInfo);
    htmlZipContent.appendChild(exportActions);

    // Clear and populate panel
    panel.innerHTML = "";
    panel.appendChild(htmlZipContent);

    this.displayStates.htmlzip = { populated: true, available: true };
    logDebug("HTML ZIP content populated with proper event binding");
  }

  /**
   * @method handleBinaryDownload
   * @description Handles download of binary formats (used by archive formats)
   * @param {Blob} blob - Binary content to download
   * @param {string} filename - Filename for download
   * @param {string} format - Format identifier for logging
   * @returns {void}
   * @private
   * @since 2.2.0 (Phase 2B)
   */
  handleBinaryDownload(blob, filename, format) {
    if (!blob || !(blob instanceof Blob)) {
      logError("Invalid blob provided for binary download", {
        format,
        filename,
      });
      this.showNotification("Download failed: Invalid file data", "error");
      return;
    }

    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup blob URL
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      this.showNotification(`${filename} downloaded successfully!`, "success");
      logInfo("Binary format downloaded", {
        format,
        filename,
        size: blob.size,
      });
    } catch (error) {
      logError("Binary download failed", {
        format,
        filename,
        error: error.message,
      });
      this.showNotification(`Download failed: ${error.message}`, "error");
    }
  }

  /**
   * @method setInitialActiveFormat
   * @description Sets the initial active format based on available content
   * @param {Object} results - Processing results
   * @returns {Promise<void>}
   * @private
   */
  async setInitialActiveFormat(results) {
    logDebug("Setting initial active format", {
      availableFormats: Object.keys(results),
      displayStates: this.displayStates,
    });

    // Map UI formats to result keys for proper content checking
    const formatMapping = {
      mmd: "mmd",
      md: "md", // Feature 3: Plain Markdown
      html: "html",
      pdf: "pdf", // Phase 1: PDF (HTML Rendering)
      latexpdf: "latex.pdf", // Phase 1: PDF (LaTeX Rendering)
      latex: "tex.zip",
      docx: "docx",
      pptx: "pptx", // Phase 2: PowerPoint
      mmdzip: "mmd.zip", // Phase 2B: MMD Archive
      mdzip: "md.zip", // Phase 2B: MD Archive
      htmlzip: "html.zip", // Phase 2B: HTML Archive
    };

    const formats = [
      "mmd",
      "md",
      "html",
      "pdf",
      "latexpdf",
      "latex",
      "docx",
      "pptx",
      "mmdzip",
      "mdzip",
      "htmlzip",
    ];

    formats.forEach((format) => {
      const tabElement = this.formatElements.tabs[format];
      const panelElement = this.formatElements.panels[format];

      if (tabElement && panelElement) {
        // Use format mapping to check correct result key
        const resultKey = formatMapping[format];
        const resultContent = results[resultKey];

        // Check if content exists in results (be strict - only show if actually present)
        let hasContentInResults = false;
        if (resultContent) {
          // String content check
          if (
            typeof resultContent === "string" &&
            resultContent.trim().length > 0
          ) {
            hasContentInResults = true;
          }
          // Binary content check (like ZIP files)
          else if (
            resultContent instanceof Blob ||
            resultContent instanceof ArrayBuffer
          ) {
            hasContentInResults = true;
          }
          // Boolean flag check (like DOCX availability)
          else if (typeof resultContent === "boolean") {
            hasContentInResults = resultContent;
          }
        }

        // Also check if displayStates indicates successful population
        const wasSuccessfullyPopulated =
          this.displayStates[format] && this.displayStates[format].populated;

        // Only show tab if content exists OR was successfully populated
        if (hasContentInResults || wasSuccessfullyPopulated) {
          // Show tab
          tabElement.style.display = "block";
          logDebug(`Showing tab for format: ${format}`, {
            resultKey,
            hasContentInResults,
            wasSuccessfullyPopulated,
            contentType: typeof resultContent,
          });
        } else {
          // Hide tab if no content
          tabElement.style.display = "none";
          logDebug(`Hiding tab for format: ${format} (no content)`, {
            resultKey,
            checkedKey: resultKey,
            availableKeys: Object.keys(results),
            displayState: this.displayStates[format],
          });
        }
      }
    });

    // Priority order for initial format selection
    const formatPriority = ["mmd", "html", "latex", "docx"];

    let initialFormat = null;
    for (const format of formatPriority) {
      // Use format mapping to check correct result key
      const resultKey = formatMapping[format];
      const resultContent = results[resultKey];

      // Check for content using proper result key
      let hasResultContent = false;
      if (resultContent) {
        if (
          typeof resultContent === "string" &&
          resultContent.trim().length > 0
        ) {
          hasResultContent = true;
        } else if (
          resultContent instanceof Blob ||
          resultContent instanceof ArrayBuffer
        ) {
          hasResultContent = true;
        } else if (typeof resultContent === "boolean") {
          hasResultContent = resultContent;
        }
      }

      const hasDisplayState =
        this.displayStates[format] && this.displayStates[format].populated;
      const hasVisibleTab =
        this.formatElements.tabs[format] &&
        this.formatElements.tabs[format].style.display !== "none";

      if ((hasResultContent || hasDisplayState) && hasVisibleTab) {
        initialFormat = format;
        break;
      }
    }

    // Activate the initial format
    if (initialFormat) {
      logInfo(`Setting initial active format to: ${initialFormat}`);
      try {
        await this.switchToFormat(initialFormat);
        logInfo(`Successfully activated initial format: ${initialFormat}`);
      } catch (error) {
        logError(`Failed to activate initial format ${initialFormat}:`, error);
        // Fallback to first visible tab
        const firstVisibleFormat = formats.find(
          (f) =>
            this.formatElements.tabs[f] &&
            this.formatElements.tabs[f].style.display !== "none"
        );
        if (firstVisibleFormat) {
          logWarn(
            `Falling back to first visible format: ${firstVisibleFormat}`
          );
          await this.switchToFormat(firstVisibleFormat);
        }
      }
    } else {
      logWarn("No populated formats found for initial display");
      // Fallback to first visible tab even if no content detected
      const firstVisibleFormat = formats.find(
        (f) =>
          this.formatElements.tabs[f] &&
          this.formatElements.tabs[f].style.display !== "none"
      );
      if (firstVisibleFormat) {
        logWarn(
          `No content detected, falling back to first visible: ${firstVisibleFormat}`
        );
        await this.switchToFormat(firstVisibleFormat);
      }
    }
  }

  /**
   * @method switchToFormat
   * @description Switches active format display with accessibility updates
   * @param {string} format - Format to switch to
   * @returns {Promise<void>}
   * @private
   */
  async switchToFormat(format) {
    logDebug("Switching to format", {
      format,
      previousFormat: this.activeFormat,
    });

    try {
      // Hide all panels and deactivate all tabs
      Object.keys(this.formatElements.panels).forEach((f) => {
        const panel = this.formatElements.panels[f];
        const tab = this.formatElements.tabs[f];

        if (panel) {
          panel.style.display = "none";
          panel.setAttribute("aria-hidden", "true");
        }

        if (tab) {
          tab.setAttribute("aria-selected", "false");
          tab.setAttribute("tabindex", "-1");
          tab.classList.remove("active");
        }
      });

      // Show active panel and activate tab
      const activePanel = this.formatElements.panels[format];
      const activeTab = this.formatElements.tabs[format];

      if (activePanel) {
        activePanel.style.display = "block";
        activePanel.setAttribute("aria-hidden", "false");
      }

      if (activeTab) {
        activeTab.setAttribute("aria-selected", "true");
        activeTab.setAttribute("tabindex", "0");
        activeTab.classList.add("active");
        activeTab.focus();
      }

      this.activeFormat = format;

      logInfo("Format switch completed", {
        activeFormat: this.activeFormat,
        panelVisible: !!activePanel,
        tabActive: !!activeTab,
      });
    } catch (error) {
      logError("Error switching format", { format, error: error.message });
      throw error;
    }
  }

  /**
   * @method handleTabKeydown
   * @description Handles keyboard navigation for tabs
   * @param {KeyboardEvent} event - Keyboard event
   * @param {HTMLElement[]} tabElements - Array of tab elements
   * @param {number} currentIndex - Current tab index
   * @returns {void}
   * @private
   */
  handleTabKeydown(event, tabElements, currentIndex) {
    let targetIndex = currentIndex;

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        targetIndex =
          currentIndex > 0 ? currentIndex - 1 : tabElements.length - 1;
        break;

      case "ArrowRight":
        event.preventDefault();
        targetIndex =
          currentIndex < tabElements.length - 1 ? currentIndex + 1 : 0;
        break;

      case "Home":
        event.preventDefault();
        targetIndex = 0;
        break;

      case "End":
        event.preventDefault();
        targetIndex = tabElements.length - 1;
        break;

      case "Enter":
      case " ":
        event.preventDefault();
        const format = tabElements[currentIndex].getAttribute("data-format");
        this.switchToFormat(format);
        return;

      default:
        return;
    }

    // Focus target tab and switch
    const targetTab = tabElements[targetIndex];
    const format = targetTab.getAttribute("data-format");
    this.switchToFormat(format);
  }

  /**
   * @method copyFormatToClipboard
   * @description Copies format content to system clipboard
   * @param {string} format - UI format name
   * @param {string} resultKey - Actual result key to access content
   * @returns {Promise<void>}
   * @private
   */
  async copyFormatToClipboard(format, resultKey) {
    const content = this.currentResults[resultKey];

    // Handle LaTeX ZIP special case - extract text content from displayed code
    if (format === "latex" && resultKey === "tex.zip") {
      const codeElement = document.querySelector("#panel-latex code");
      if (codeElement && codeElement.textContent) {
        const latexContent = codeElement.textContent;
        try {
          await navigator.clipboard.writeText(latexContent);
          this.showNotification(
            "LaTeX content copied to clipboard!",
            "success"
          );
          return;
        } catch (error) {
          // Fallback for older browsers
          const textArea = document.createElement("textarea");
          textArea.value = latexContent;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
          this.showNotification(
            "LaTeX content copied to clipboard!",
            "success"
          );
          return;
        }
      }
    }

    if (!content || typeof content !== "string") {
      throw new Error(`No text content available for ${format} format`);
    }

    try {
      await navigator.clipboard.writeText(content);
      this.showNotification(
        `${format.toUpperCase()} content copied to clipboard!`,
        "success"
      );
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);

      this.showNotification(
        `${format.toUpperCase()} content copied to clipboard!`,
        "success"
      );
    }
  }

  /**
   * @method downloadFormatFile
   * @description Downloads format content as file
   * @param {string} format - UI format name
   * @param {string} resultKey - Actual result key to access content
   * @returns {Promise<void>}
   * @private
   */
  async downloadFormatFile(format, resultKey) {
    let content;

    // Handle DOCX format specially (requires API call)
    if (format === "docx") {
      if (!this.currentResults.processingMetadata?.pdfId) {
        throw new Error("No PDF ID available for DOCX download");
      }

      try {
        content = await this.controller.apiClient.downloadPDFFormat(
          this.currentResults.processingMetadata.pdfId,
          "docx"
        );
      } catch (error) {
        throw new Error(`Failed to download DOCX: ${error.message}`);
      }
    } else {
      // Get content using the correct result key
      content = this.currentResults[resultKey];
      if (!content) {
        throw new Error(
          `No content available for ${format} format (key: ${resultKey})`
        );
      }
    }

    // Generate download file
    const baseFilename =
      this.documentInfo?.name?.replace(/\.[^/.]+$/, "") || "mathpix-result";
    const downloadInfo = this.generateDownloadFile(
      format,
      content,
      baseFilename
    );

    // Trigger download
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadInfo.url;
    downloadLink.download = downloadInfo.filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // Cleanup blob URL
    setTimeout(() => URL.revokeObjectURL(downloadInfo.url), 1000);

    this.showNotification(
      `${downloadInfo.filename} downloaded successfully!`,
      "success"
    );

    logInfo("File download completed", {
      format,
      resultKey,
      filename: downloadInfo.filename,
      contentType: typeof content,
      contentSize: content?.size || content?.length || "unknown",
    });
  }
  /**
   * @method previewHtmlContent
   * @description Opens HTML content in preview modal or window
   * @returns {Promise<void>}
   * @private
   */
  async previewHtmlContent() {
    const htmlContent = this.currentResults.html;
    if (!htmlContent) {
      throw new Error("No HTML content available for preview");
    }

    // Create preview window
    const previewWindow = window.open(
      "",
      "_blank",
      "width=800,height=600,scrollbars=yes,resizable=yes"
    );

    if (!previewWindow) {
      throw new Error(
        "Could not open preview window. Please check popup blocker settings."
      );
    }

    // Write HTML content to preview window
    previewWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HTML Preview - ${this.documentInfo.name}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1, h2, h3, h4, h5, h6 { color: #333; }
          code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
          pre { background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `);

    previewWindow.document.close();
    previewWindow.focus();

    this.showNotification("HTML preview opened in new window", "info");
  }

  /**
   * @method handleProcessAnother
   * @description Handles "Process Another Document" action
   * @returns {void}
   * @private
   */
  handleProcessAnother() {
    logInfo("User requested to process another document");

    // ✅ ACCESSIBILITY FIX: Move focus away from results before hiding
    // Focus file input first to prevent aria-hidden focus trap
    const fileInput = this.elements["mathpix-file-input"];
    if (fileInput) {
      fileInput.focus();
    }

    // Hide results container (now safe since focus moved)
    const resultsContainer = this.elements["mathpix-pdf-results"];
    if (resultsContainer) {
      resultsContainer.style.display = "none";
      resultsContainer.setAttribute("aria-hidden", "true");
    }

    // Show file input area
    const fileInputContainer = this.elements["mathpix-file-input-container"];
    if (fileInputContainer) {
      fileInputContainer.style.display = "block";
      fileInputContainer.setAttribute("aria-hidden", "false");
    }

    // Clear current results
    this.currentResults = null;
    this.documentInfo = null;
    this.activeFormat = "mmd";
    this.resetDisplayStates();

    // ✅ CRITICAL FIX: Delegate to PDF handler to reset drop zone and clear file state
    if (this.controller && this.controller.pdfHandler) {
      // Call PDF handler's processAnotherPDF to properly reset drop zone
      this.controller.pdfHandler.processAnotherPDF();
      logDebug("Delegated reset to PDF handler for drop zone cleanup");
    } else {
      logWarn("PDF handler not available for complete reset");
      // Fallback notification if handler unavailable
      this.showNotification("Ready to process another document", "info");
    }
  }

  /**
   * @method handleClearResults
   * @description Handles "Clear Results" action
   * @returns {void}
   * @private
   */
  handleClearResults() {
    logInfo("User requested to clear results");

    // Cleanup PDF preview blob URL if it exists (Phase 3.4.2)
    if (this.previewPdfUrl) {
      URL.revokeObjectURL(this.previewPdfUrl);
      this.previewPdfUrl = null;
      logDebug("PDF preview blob URL cleaned up");
    }

    // Clear all format panels
    Object.values(this.formatElements.panels).forEach((panel) => {
      if (panel) {
        panel.innerHTML = "";
      }
    });

    // Clear document metadata
    [
      "mathpix-doc-name",
      "mathpix-doc-size",
      "mathpix-doc-pages",
      "mathpix-doc-range",
      "mathpix-processing-time",
    ].forEach((elementId) => {
      const element = this.elements[elementId];
      if (element) {
        element.textContent = "";
      }
    });

    // Reset state
    this.currentResults = null;
    this.documentInfo = null;
    this.activeFormat = "mmd";
    this.resetDisplayStates();

    this.showNotification("Results cleared", "info");
  }

  /**
   * @method validate
   * @description Validates PDF result renderer configuration and dependencies
   * @returns {boolean} True if renderer is properly configured
   * @override
   * @since 2.1.0
   */
  validate() {
    if (!super.validate()) {
      return false;
    }

    // Check for required DOM elements
    const requiredElements = ["mathpix-pdf-results"];
    for (const elementId of requiredElements) {
      if (!this.elements[elementId]) {
        logError(
          `PDF result renderer validation failed - missing element: ${elementId}`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * @method getDebugInfo
   * @description Gets comprehensive debug information for PDF result renderer
   * @returns {Object} Extended debug information including display state
   * @override
   * @since 2.1.0
   */
  getDebugInfo() {
    const baseInfo = super.getDebugInfo();

    return {
      ...baseInfo,
      activeFormat: this.activeFormat,
      hasCurrentResults: !!this.currentResults,
      hasDocumentInfo: !!this.documentInfo,
      displayStates: this.displayStates,
      cachedElements: {
        tabs: Object.keys(this.formatElements.tabs).filter(
          (k) => this.formatElements.tabs[k]
        ),
        panels: Object.keys(this.formatElements.panels).filter(
          (k) => this.formatElements.panels[k]
        ),
      },
    };
  }

  /**
   * @method switchToPage
   * @description
   * Switches to a specific page in page-by-page view mode.
   * Updates page content display and navigation button states.
   *
   * @param {number} pageNumber - Page number to switch to (1-based)
   * @returns {void}
   *
   * @example
   * renderer.switchToPage(3); // Switch to page 3
   */
  switchToPage(pageNumber) {
    if (pageNumber < 1 || pageNumber > this.totalPages) {
      logWarn("Invalid page number", {
        pageNumber,
        totalPages: this.totalPages,
      });
      return;
    }

    logInfo("Switching to page", {
      from: this.currentPage,
      to: pageNumber,
      totalPages: this.totalPages,
    });

    this.currentPage = pageNumber;
    this.refreshCurrentDisplay();

    // Update PDF preview if initialised (Phase 3.4.2)
    if (this.previewInitialized) {
      this.updatePreviewForCurrentPage();
    }
  }

  /**
   * @method updateViewModeControls
   * @description
   * Updates the visibility and state of view mode related controls.
   * Shows/hides page navigation based on current view mode.
   *
   * @returns {void}
   * @private
   */
  updateViewModeControls() {
    // Create page navigation if it doesn't exist
    if (this.currentViewMode === "pages" && !this.pageNavigationCreated) {
      this.createPageNavigation();
    }

    // Show/hide page navigation based on view mode
    const pageNavigation = document.getElementById("mathpix-page-navigation");
    if (pageNavigation) {
      pageNavigation.style.display =
        this.currentViewMode === "pages" ? "flex" : "none";
      pageNavigation.setAttribute(
        "aria-hidden",
        this.currentViewMode === "pages" ? "false" : "true"
      );
    }

    logDebug("View mode controls updated", {
      viewMode: this.currentViewMode,
      pageNavigationVisible: this.currentViewMode === "pages",
      pageNavigationExists: !!pageNavigation,
    });
  }

  /**
   * @method createPageNavigation
   * @description
   * Creates page navigation controls for page-by-page view mode.
   * Adds previous/next buttons and page indicator with full accessibility support.
   *
   * @returns {void}
   * @private
   */
  createPageNavigation() {
    const resultsContainer = this.elements["mathpix-pdf-results"];
    if (!resultsContainer) {
      logWarn("Cannot create page navigation - results container not found");
      return;
    }

    // Check if navigation already exists
    if (document.getElementById("mathpix-page-navigation")) {
      return;
    }

    // Create navigation container
    const navContainer = document.createElement("div");
    navContainer.id = "mathpix-page-navigation";
    navContainer.className = "mathpix-page-navigation";
    navContainer.setAttribute("role", "navigation");
    navContainer.setAttribute("aria-label", "Page navigation");
    navContainer.style.display = "none"; // Hidden by default

    // Create navigation HTML
    navContainer.innerHTML = `
      <div class="mathpix-page-controls">
        <button 
          type="button" 
          id="mathpix-prev-page" 
          class="mathpix-nav-button"
          aria-label="Previous page"
          disabled
        >
          <span aria-hidden="true">←</span> Previous
        </button>
        
        <div class="mathpix-page-info" role="status" aria-live="polite">
          <span id="mathpix-page-current">1</span>
          <span aria-hidden="true"> of </span>
          <span id="mathpix-page-total">1</span>
        </div>
        
        <button 
          type="button" 
          id="mathpix-next-page" 
          class="mathpix-nav-button"
          aria-label="Next page"
          disabled
        >
          Next <span aria-hidden="true">→</span>
        </button>
      </div>
    `;

    // Insert navigation after the view selection controls
    const viewControls = resultsContainer.querySelector(
      ".mathpix-results-controls"
    );
    if (viewControls) {
      viewControls.insertAdjacentElement("afterend", navContainer);
    } else {
      resultsContainer.insertBefore(
        navContainer,
        resultsContainer.querySelector(".mathpix-results-tabs")
      );
    }

    // Attach event handlers
    this.attachPageNavigationHandlers();

    this.pageNavigationCreated = true;

    logInfo("Page navigation controls created", {
      navigationId: navContainer.id,
      accessibility: true,
      buttonsCreated: 2,
    });
  }

  /**
   * @method attachPageNavigationHandlers
   * @description
   * Attaches event handlers for page navigation buttons.
   * Provides keyboard and mouse navigation with proper accessibility.
   *
   * @returns {void}
   * @private
   */
  attachPageNavigationHandlers() {
    const prevButton = document.getElementById("mathpix-prev-page");
    const nextButton = document.getElementById("mathpix-next-page");

    if (prevButton) {
      prevButton.addEventListener("click", () => {
        if (this.currentPage > 1) {
          this.switchToPage(this.currentPage - 1);
        }
      });
    }

    if (nextButton) {
      nextButton.addEventListener("click", () => {
        if (this.currentPage < this.totalPages) {
          this.switchToPage(this.currentPage + 1);
        }
      });
    }

    logDebug("Page navigation handlers attached", {
      prevButton: !!prevButton,
      nextButton: !!nextButton,
    });
  }

  /**
   * @method refreshCurrentDisplay
   * @description
   * Refreshes the current display based on view mode and active format.
   * Shows either combined content or current page content.
   *
   * @returns {void}
   * @private
   */
  refreshCurrentDisplay() {
    if (!this.currentResults) {
      logWarn("No results available to refresh display");
      return;
    }

    const format = this.activeFormat;
    const content = this.getContentForCurrentView(format);

    if (content !== null) {
      this.displayContentInFormat(format, content);
      logDebug("Display refreshed", {
        format,
        viewMode: this.currentViewMode,
        page: this.currentViewMode === "pages" ? this.currentPage : "all",
        contentLength: content ? content.length : 0,
      });
    }
  }

  /**
   * @method getContentForCurrentView
   * @description
   * Gets content appropriate for the current view mode and page.
   * Returns either full content or page-specific content.
   *
   * @param {string} format - Format to get content for
   * @returns {string|null} Content for display
   * @private
   */
  getContentForCurrentView(format) {
    if (this.currentViewMode === "combined") {
      // Map UI format to result key
      const formatMapping = {
        mmd: "mmd",
        html: "html",
        latex: "tex.zip",
        docx: "docx",
      };

      const resultKey = formatMapping[format] || format;
      return this.currentResults[resultKey] || null;
    } else {
      // Page-by-page mode - ensure currentPage is properly set
      if (!this.currentPage || this.currentPage < 1) {
        this.currentPage = 1;
        logWarn("Current page was not set, defaulting to page 1");
      }

      // Use parsed page content
      const pageContent = this.pageContents[format];
      if (pageContent && pageContent.length > 0) {
        const pageIndex = this.currentPage - 1;
        if (pageIndex >= 0 && pageIndex < pageContent.length) {
          return pageContent[pageIndex];
        }
      }

      logWarn("Page content not available", {
        format,
        page: this.currentPage,
        availablePages: pageContent ? pageContent.length : 0,
        currentPageValid: this.currentPage && this.currentPage >= 1,
      });

      return `<div class="mathpix-page-placeholder">
        <p>Page ${
          this.currentPage || 1
        } content not available for ${format.toUpperCase()} format.</p>
        <p>Try switching to combined view or another format.</p>
      </div>`;
    }
  }

  /**
   * @method displayContentInFormat
   * @description
   * Updates the display of content in the specified format panel.
   * Handles syntax highlighting and accessibility.
   *
   * @param {string} format - Format to update
   * @param {string} content - Content to display
   * @returns {void}
   * @private
   */
  displayContentInFormat(format, content) {
    const panel = this.formatElements.panels[format];
    if (!panel) {
      logWarn(`No panel found for format: ${format}`);
      return;
    }

    // For now, just update the text content if a code element exists
    const codeElement = panel.querySelector("code");
    if (codeElement && typeof content === "string") {
      codeElement.textContent = content;

      // Reapply syntax highlighting if available
      if (window.Prism && window.Prism.highlightElement) {
        window.Prism.highlightElement(codeElement);
      }

      logDebug(`Content updated for format: ${format}`, {
        contentLength: content.length,
        hasCodeElement: true,
      });
    }
  }

  /**
   * @method announceViewModeChange
   * @description
   * Announces view mode changes to screen readers.
   * Provides clear feedback about the current view mode.
   *
   * @param {string} viewMode - Current view mode
   * @returns {void}
   * @private
   */
  announceViewModeChange(viewMode) {
    let message;
    if (viewMode === "combined") {
      message = "Switched to combined document view";
    } else if (viewMode === "pages") {
      message = "Switched to page-by-page text view";
    } else if (viewMode === "pdf-preview") {
      message = "Switched to PDF visual preview";
    } else {
      message = "View mode changed";
    }

    if (window.notifyInfo) {
      window.notifyInfo(message);
    }
  }

  /**
   * @method parsePageByPageContent
   * @description
   * Parses page-by-page content from MathPix API data.
   * Extracts individual page content for each format and populates pageContents arrays.
   * Uses simple content analysis as a starting approach.
   *
   * @param {Object} results - Complete API results containing format content
   * @returns {Promise<void>}
   *
   * @example
   * await renderer.parsePageByPageContent(results);
   * console.log(renderer.pageContents.mmd[0]); // First page MMD content
   *
   * @since 2.2.0
   */
  async parsePageByPageContent(results) {
    logInfo("Parsing page-by-page content from API data");

    try {
      // Reset page contents
      this.pageContents = {
        mmd: [],
        html: [],
        latex: [],
        docx: [],
      };

      // For now, use simple content analysis
      // This can be enhanced later with actual MathPix lines API data
      await this.parseFromContentAnalysis(results);

      logInfo("Page parsing completed", {
        totalPages: this.totalPages,
        pagesWithContent: {
          mmd: this.pageContents.mmd.length,
          html: this.pageContents.html.length,
          latex: this.pageContents.latex.length,
          docx: this.pageContents.docx.length,
        },
        method: "content-analysis",
      });
    } catch (error) {
      logError("Failed to parse page content", { error: error.message });

      // Set up minimal single-page fallback
      this.totalPages = 1;
      this.pageContents = {
        mmd: [results.mmd || "Content not available"],
        html: [results.html || "<p>Content not available</p>"],
        latex: [
          results["tex.zip"]
            ? "LaTeX content available for download"
            : "LaTeX not available",
        ],
        docx: [
          results.docx ? "DOCX available for download" : "DOCX not available",
        ],
      };
    }
  }

  /**
   * @method parseFromContentAnalysis
   * @description
   * Parses page content using simple content analysis.
   * Divides content into logical pages for page-by-page viewing.
   *
   * @param {Object} results - Original format results
   * @returns {Promise<void>}
   * @private
   */
  async parseFromContentAnalysis(results) {
    logInfo("Using content analysis for page parsing");

    // Simple approach: divide content by page breaks or length
    const formats = [
      { ui: "mmd", key: "mmd" },
      { ui: "html", key: "html" },
      { ui: "latex", key: "tex.zip" },
      { ui: "docx", key: "docx" },
    ];

    for (const format of formats) {
      const content = results[format.key];

      if (!content) {
        this.pageContents[format.ui] = [];
        continue;
      }

      if (typeof content === "string") {
        // Split content into pages (simple approach)
        const pages = this.splitContentIntoPages(content, format.ui);
        this.pageContents[format.ui] = pages;
      } else {
        // Non-string content (like binary)
        this.pageContents[format.ui] = [
          `${format.ui.toUpperCase()} format available for download`,
        ];
      }
    }

    // ✅ PHASE 3.3 FIX: Only set totalPages if not already set by Lines API
    if (!this.totalPages || this.totalPages === 0) {
      // Fallback: Estimate total pages from largest content array
      this.totalPages = Math.max(
        ...formats.map((f) => this.pageContents[f.ui]?.length || 0),
        1
      );
      logInfo("Content analysis parsing completed (estimated pages)", {
        totalPages: this.totalPages,
        method: "content-analysis-fallback",
      });
    } else {
      logInfo(
        "Content analysis parsing completed (using Lines API page count)",
        {
          totalPages: this.totalPages,
          method: "lines-api-authoritative",
        }
      );
    }
  }

  /**
   * @method splitContentIntoPages
   * @description Splits content into pages using simple heuristics
   * @param {string} content - Content to split
   * @param {string} format - Content format
   * @returns {Array<string>} Array of page contents
   * @private
   */
  splitContentIntoPages(content, format) {
    // Simple page splitting heuristics based on content markers
    const pageBreakPatterns = {
      mmd: /\n#{1,2}\s+Page\s+\d+/gi,
      html: /<h[12][^>]*>Page\s+\d+/gi,
      latex: /\\section\{Page\s+\d+\}/gi,
      docx: content, // DOCX doesn't need splitting
    };

    const pattern = pageBreakPatterns[format];

    if (!pattern || format === "docx") {
      // For formats without clear page breaks, create artificial pages
      return this.createArtificialPages(content, format);
    }

    const pages = content.split(pattern);

    // Filter out empty pages and ensure minimum content
    return pages
      .filter((page) => page.trim().length > 0)
      .map((page, index) => {
        if (index === 0) {
          return page.trim();
        }
        // Add page header back for split pages
        const pageNum = index + 1;
        const header =
          format === "mmd"
            ? `# Page ${pageNum}\n\n`
            : format === "html"
            ? `<h1>Page ${pageNum}</h1>\n`
            : format === "latex"
            ? `\\section{Page ${pageNum}}\n\n`
            : "";
        return header + page.trim();
      });
  }

  /**
   * @method createArtificialPages
   * @description Creates artificial page breaks for content without natural page markers
   * @param {string} content - Content to paginate
   * @param {string} format - Content format
   * @returns {Array<string>} Array of page contents
   * @private
   */
  createArtificialPages(content, format) {
    if (!content || content.length < 1000) {
      // Short content - single page
      return [content];
    }

    // Split by paragraphs or sections
    const breakPatterns = {
      mmd: /\n\n+/g,
      html: /<\/p>\s*<p>/gi,
      latex: /\n\n+/g,
      docx: /\n\n+/g,
    };

    const pattern = breakPatterns[format] || /\n\n+/g;
    const chunks = content.split(pattern);

    if (chunks.length <= 1) {
      return [content];
    }

    // Group chunks into pages (aim for reasonable page sizes)
    const pages = [];
    let currentPage = "";
    let targetPageSize = Math.ceil(content.length / Math.min(chunks.length, 5)); // Max 5 pages initially

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i].trim();

      if (!chunk) continue;

      if (
        currentPage.length + chunk.length > targetPageSize &&
        currentPage.length > 0
      ) {
        // Start new page
        pages.push(currentPage.trim());
        currentPage = chunk;
      } else {
        // Add to current page
        if (currentPage) {
          currentPage += (format === "html" ? "</p><p>" : "\n\n") + chunk;
        } else {
          currentPage = chunk;
        }
      }
    }

    // Add final page
    if (currentPage.trim()) {
      pages.push(currentPage.trim());
    }

    // Add page headers
    return pages.map((page, index) => {
      const pageNum = index + 1;
      const header =
        format === "mmd"
          ? `# Page ${pageNum}\n\n`
          : format === "html"
          ? `<h1>Page ${pageNum}</h1>\n`
          : format === "latex"
          ? `\\section{Page ${pageNum}}\n\n`
          : "";
      return header + page;
    });
  }

  /**
   * @method enhanceTableAccessibility
   * @description Enhance table accessibility with ARIA attributes
   * Safe improvements that work for all table structures
   * @param {HTMLElement} table - Table element to enhance
   * @returns {boolean} True if enhancement successful
   * @private
   * @since 2.2.0
   */
  enhanceTableAccessibility(table) {
    if (!table) return false;

    try {
      // 1. Add table role
      if (!table.hasAttribute("role")) {
        table.setAttribute("role", "table");
      }

      // 2. Add developer guidance comment
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

      // 3. Add screen reader caption
      if (!table.querySelector("caption")) {
        const caption = document.createElement("caption");
        caption.textContent = "Table extracted from PDF via MathPix OCR";
        caption.className = "sr-only";
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
      }

      // 4. Add row roles
      const rows = table.querySelectorAll("tr");
      rows.forEach((row) => {
        if (!row.hasAttribute("role")) {
          row.setAttribute("role", "row");
        }
      });

      // 5. Add cell roles
      const cells = table.querySelectorAll("td");
      cells.forEach((cell) => {
        if (!cell.hasAttribute("role")) {
          cell.setAttribute("role", "cell");
        }
      });

      // 6. Add keyboard navigation hint
      table.setAttribute(
        "aria-label",
        "Use arrow keys to navigate table cells"
      );

      logDebug("Table accessibility enhanced successfully");
      return true;
    } catch (error) {
      logError("Failed to enhance table accessibility", error);
      return false;
    }
  }
  /**
   * @method displayDiagramTextContent
   * @description Displays extracted diagram text in collapsible UI section (Feature 4)
   *
   * Shows text elements found within diagrams, organized by diagram and page.
   * Provides copy functionality and accessible collapsible interface.
   *
   * @param {Object} linesAnalysis - Lines analysis data containing diagram text
   * @returns {void}
   *
   * @example
   * renderer.displayDiagramTextContent(linesAnalysis);
   *
   * @accessibility Full keyboard navigation and screen reader support
   * @since 3.1.0 (Feature 4)
   */
  displayDiagramTextContent(linesAnalysis) {
    logDebug("Displaying diagram text content", {
      hasAnalysis: !!linesAnalysis,
      hasDiagramText: !!(linesAnalysis && linesAnalysis.diagramText),
      hasSummary: !!(linesAnalysis && linesAnalysis.diagramTextSummary),
    });

    // Get UI elements
    const section = document.getElementById("mathpix-diagram-text-section");
    const countDisplay = document.getElementById("mathpix-diagram-count");
    const listContainer = document.getElementById("mathpix-diagram-text-list");
    const emptyState = document.getElementById("mathpix-diagram-text-empty");
    const toggleText = document.querySelector(
      "#mathpix-diagram-text-toggle .toggle-text"
    );

    if (!section || !listContainer) {
      logWarn("Diagram text UI elements not found");
      return;
    }

    // Check if we have diagram text
    const diagramText = linesAnalysis.diagramText || {};
    const summary = linesAnalysis.diagramTextSummary || {};
    const hasDiagrams =
      summary.hasDiagrams && Object.keys(diagramText).length > 0;

    if (!hasDiagrams) {
      // Show empty state
      if (emptyState) {
        emptyState.style.display = "block";
      }
      listContainer.innerHTML = "";
      section.style.display = "none";
      logDebug("No diagrams with text to display");
      return;
    }

    // Show section
    section.style.display = "block";

    // Update count display
    const totalDiagrams = summary.totalDiagrams || 0;
    const totalTextElements = summary.totalTextElements || 0;

    if (countDisplay) {
      countDisplay.textContent = `(${totalDiagrams} ${
        totalDiagrams === 1 ? "diagram" : "diagrams"
      })`;
    }

    if (toggleText) {
      toggleText.textContent = `Show Diagram Text (${totalDiagrams} ${
        totalDiagrams === 1 ? "diagram" : "diagrams"
      })`;
    }

    // Hide empty state
    if (emptyState) {
      emptyState.style.display = "none";
    }

    // Generate diagram cards
    const diagramCards = this.formatDiagramTextForDisplay(diagramText);
    listContainer.innerHTML = diagramCards;

    // Setup toggle functionality
    this.setupDiagramTextToggle();

    // Setup copy buttons for each diagram
    const copyButtons = listContainer.querySelectorAll(".diagram-copy-btn");
    copyButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const diagramId = button.dataset.diagramId;
        const diagram = diagramText[diagramId];
        if (diagram) {
          const text = diagram.textElements.map((el) => el.text).join("\n");
          this.copyDiagramText(text, diagram.pageNumber);
        }
      });
    });

    logInfo("Diagram text content displayed successfully", {
      totalDiagrams,
      totalTextElements,
      diagramIds: Object.keys(diagramText),
    });
  }

  /**
   * @method formatDiagramTextForDisplay
   * @description Formats diagram text data into HTML for display (Feature 4)
   *
   * Creates accessible card-based layout for diagram text with copy functionality.
   *
   * @param {Object} diagramData - Diagram text data from Lines API
   * @returns {string} HTML string for diagram cards
   *
   * @private
   * @since 3.1.0 (Feature 4)
   */
  formatDiagramTextForDisplay(diagramData) {
    if (!diagramData || Object.keys(diagramData).length === 0) {
      return '<p class="no-diagrams">No diagram text found.</p>';
    }

    const diagrams = Object.values(diagramData);

    return diagrams
      .map((diagram, index) => {
        const diagramNumber = index + 1;
        const textElementsList = diagram.textElements
          .map(
            (element) =>
              `<li class="text-element">${this.escapeHtml(element.text)}</li>`
          )
          .join("");

        return `
      <article class="diagram-card" role="article" aria-labelledby="diagram-title-${diagramNumber}">
        <header class="diagram-card-header">
          <h4 id="diagram-title-${diagramNumber}" class="diagram-card-title">
            <svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)">
                <path d="m14.5 6.5v-4h-4"/>
                <path d="m14.5 2.5-5 5"/>
                <path d="m.5 8.5v-6c0-1.1045695.8954305-2 2-2h3"/>
                <path d="m8.5 14.5h6c1.1045695 0 2-.8954305 2-2v-3"/>
              </g>
            </svg>
            Diagram ${diagramNumber} <span class="diagram-page">(Page ${diagram.pageNumber})</span>
          </h4>
          <p class="diagram-stats">
            <span class="stat-label">Text elements:</span>
            <span class="stat-value">${diagram.totalText}</span>
          </p>
        </header>
        
        <div class="diagram-card-content">
          <ul class="text-elements-list" role="list">
            ${textElementsList}
          </ul>
        </div>
        
        <footer class="diagram-card-footer">
          <button 
            type="button" 
            class="diagram-copy-btn"
            data-diagram-id="${diagram.diagramId}"
            aria-label="Copy text from diagram ${diagramNumber}"
          >
            <svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 3)">
                <path d="m3.5 1.5c-.44119105-.00021714-1.03893772-.0044496-1.99754087-.00501204-.51283429-.00116132-.93645365.3838383-.99544161.88103343l-.00701752.11906336v10.99753785c.00061498.5520447.44795562.9996604 1 1.0006148l10 .0061982c.5128356.0008356.9357441-.3849039.993815-.882204l.006185-.1172316v-11c0-.55228475-.4477152-1-1-1-.8704853-.00042798-1.56475733.00021399-2 0"/>
                <path d="m4.5.5h4c.55228475 0 1 .44771525 1 1s-.44771525 1-1 1h-4c-.55228475 0-1-.44771525-1-1s.44771525-1 1-1z"/>
                <path d="m2.5 5.5h5"/>
                <path d="m2.5 7.5h7"/>
                <path d="m2.5 9.5h3"/>
                <path d="m2.5 11.5h6"/>
              </g>
            </svg>
            Copy Text
          </button>
        </footer>
      </article>
    `;
      })
      .join("");
  }

  /**
   * @method setupDiagramTextToggle
   * @description Sets up collapsible toggle for diagram text section (Feature 4)
   *
   * Provides accessible expand/collapse functionality with proper ARIA states.
   *
   * @returns {void}
   *
   * @private
   * @since 3.1.0 (Feature 4)
   */
  setupDiagramTextToggle() {
    const toggleButton = document.getElementById("mathpix-diagram-text-toggle");
    const content = document.getElementById("mathpix-diagram-text-content");
    const toggleIcon = toggleButton?.querySelector(".toggle-icon");
    const toggleText = toggleButton?.querySelector(".toggle-text");

    if (!toggleButton || !content) {
      logWarn("Diagram text toggle elements not found");
      return;
    }

    // Remove any existing listener to prevent duplicates
    if (toggleButton._diagramToggleHandler) {
      toggleButton.removeEventListener(
        "click",
        toggleButton._diagramToggleHandler
      );
    }

    const toggleHandler = () => {
      const isExpanded = toggleButton.getAttribute("aria-expanded") === "true";
      const newState = !isExpanded;

      // Update ARIA state
      toggleButton.setAttribute("aria-expanded", newState.toString());
      content.hidden = !newState;

      // Update icon
      if (toggleIcon) {
        toggleIcon.textContent = newState ? "▲" : "▼";
      }

      // Update text
      if (toggleText) {
        const countText =
          document.getElementById("mathpix-diagram-count")?.textContent || "";
        toggleText.textContent = newState
          ? "Hide Diagram Text"
          : `Show Diagram Text ${countText}`;
      }

      logDebug("Diagram text toggle clicked", {
        expanded: newState,
      });
    };

    toggleButton._diagramToggleHandler = toggleHandler;
    toggleButton.addEventListener("click", toggleHandler);

    logDebug("Diagram text toggle setup complete");
  }

  /**
   * @method copyDiagramText
   * @description Copies diagram text to clipboard (Feature 4)
   *
   * Provides accessible clipboard operation with user feedback.
   *
   * @param {string} text - Text to copy
   * @param {number} pageNumber - Page number for feedback message
   * @returns {Promise<void>}
   *
   * @private
   * @since 3.1.0 (Feature 4)
   */
  async copyDiagramText(text, pageNumber) {
    if (!text) {
      this.showNotification("No text to copy", "warning");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this.showNotification(
        `Diagram text from page ${pageNumber} copied to clipboard!`,
        "success"
      );
      logInfo("Diagram text copied to clipboard", {
        pageNumber,
        textLength: text.length,
      });
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();

      try {
        document.execCommand("copy");
        this.showNotification(
          `Diagram text from page ${pageNumber} copied to clipboard!`,
          "success"
        );
        logInfo("Diagram text copied via fallback", {
          pageNumber,
          textLength: text.length,
        });
      } catch (fallbackError) {
        this.showNotification("Failed to copy diagram text", "error");
        logError("Failed to copy diagram text", {
          error: fallbackError.message,
        });
      } finally {
        document.body.removeChild(textArea);
      }
    }
  }

  /**
   * @method enhanceTablesInHtml
   * @description Enhance tables in HTML content with ARIA attributes
   * @param {string} htmlContent - HTML content that may contain tables
   * @returns {string} HTML with enhanced tables
   * @private
   * @since 2.2.0
   */
  enhanceTablesInHtml(htmlContent) {
    // Check if content contains tables
    const hasTable = /<table[^>]*>/i.test(htmlContent);

    if (!hasTable) {
      logDebug("No tables found in PDF HTML content");
      return htmlContent;
    }

    logDebug("PDF HTML contains tables - applying ARIA enhancements");

    try {
      // Parse HTML to enhance tables
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, "text/html");
      const tables = doc.querySelectorAll("table");

      if (tables.length === 0) {
        logDebug("Table regex matched but querySelectorAll found none");
        return htmlContent;
      }

      // Enhance each table with ARIA
      tables.forEach((table, index) => {
        const enhanced = this.enhanceTableAccessibility(table);
        if (enhanced) {
          logDebug(
            `Enhanced table ${index + 1} of ${tables.length} in PDF HTML`
          );
        }
      });

      // ✅ FIX: Return FULL document with DOCTYPE, head, CSS, etc.
      // Use documentElement.outerHTML to preserve complete HTML structure
      const enhancedHtml = doc.documentElement.outerHTML;

      logInfo("PDF HTML tables enhanced", {
        tablesFound: tables.length,
        originalLength: htmlContent.length,
        enhancedLength: enhancedHtml.length,
      });

      return enhancedHtml;
    } catch (error) {
      logError("Failed to enhance PDF HTML tables", error);
      return htmlContent; // Return original on error
    }
  }
}

export default MathPixPDFResultRenderer;

/**
 * Global validation function for MathPix export functionality
 * Provides ongoing protection against regression issues
 *
 * Usage: window.validateMathPixExportFunctionality()
 * Returns: boolean indicating system health
 */
if (typeof window !== "undefined") {
  window.validateMathPixExportFunctionality = () => {
    console.log("🧪 MathPix Export Functionality Validation");

    const controller = window.getMathPixController?.();
    const renderer = controller?.pdfResultRenderer;

    // Test 1: Core functionality exists
    const hasRenderer = !!renderer;
    const hasResults = !!(renderer && renderer.currentResults);
    const hasMethod = !!(
      renderer && typeof renderer.handleFormatExport === "function"
    );

    console.log("✅ Core Systems:", { hasRenderer, hasResults, hasMethod });

    // Test 2: Button health check
    const buttons = document.querySelectorAll(".mathpix-action-button");
    let healthyButtons = 0;
    let problematicButtons = 0;

    buttons.forEach((btn, i) => {
      const hasOnclick = btn.getAttribute("onclick");
      const hasThisRef = hasOnclick && hasOnclick.includes("this.");

      if (hasThisRef) {
        problematicButtons++;
        console.log(`❌ Button ${i + 1}: Context issue detected`);
      } else {
        healthyButtons++;
      }
    });

    console.log(
      `📊 Button Health: ${healthyButtons} healthy, ${problematicButtons} problematic`
    );

    // Test 3: Format availability
    if (renderer && renderer.currentResults) {
      const formats = ["mmd", "html", "tex.zip", "docx"];
      formats.forEach((format) => {
        const available = !!renderer.currentResults[format];
        console.log(`📋 ${format}: ${available ? "✅" : "❌"}`);
      });
    }

    // Test 4: Metadata validation
    const metadataElements = [
      "mathpix-doc-name",
      "mathpix-doc-pages",
      "mathpix-doc-time",
      "mathpix-doc-formats",
    ];
    let populatedMetadata = 0;
    metadataElements.forEach((id) => {
      const el = document.getElementById(id);
      const isEmpty =
        !el?.textContent ||
        el.textContent.trim() === "-" ||
        el.textContent.trim() === "";
      if (!isEmpty) populatedMetadata++;
    });

    console.log(
      `📄 Metadata: ${populatedMetadata}/${metadataElements.length} populated`
    );

    // Overall result
    const allGood =
      hasRenderer &&
      hasResults &&
      hasMethod &&
      problematicButtons === 0 &&
      populatedMetadata > 0;
    console.log(
      `🎯 Overall Status: ${allGood ? "✅ HEALTHY" : "❌ ISSUES DETECTED"}`
    );

    return allGood;
  };
}
