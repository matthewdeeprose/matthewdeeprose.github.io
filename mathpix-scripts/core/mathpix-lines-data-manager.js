/**
 * @fileoverview MathPix Lines Data Manager - Advanced content analysis and lines data processing
 * @module MathPixLinesDataManager
 * @requires MathPixBaseModule
 * @requires MATHPIX_CONFIG
 * @author MathPix Development Team
 * @version 3.1.0
 * @since 3.1.0
 *
 * @description
 * Manages Lines Data API integration for advanced content analysis and content-aware features.
 * Provides comprehensive document content analysis including mathematical elements, tables,
 * diagrams, confidence statistics, and page-by-page content breakdown.
 *
 * Key Features:
 * - Lines data fetching from MathPix Lines Data API
 * - Content analysis (math elements, tables, diagrams, confidence stats)
 * - Page-by-page content analysis and statistics
 * - Content summary generation for enhanced user feedback
 * - Foundation architecture for future content-aware features
 * - Integration with enhanced progress tracking
 *
 * Integration:
 * - Extends MathPixBaseModule for shared functionality and logging
 * - Coordinates with MathPixController for API access
 * - Uses MATHPIX_CONFIG for API endpoints and processing options
 * - Integrates with notification system for user feedback
 * - Supports enhanced progress tracking with content insights
 *
 * Architecture:
 * - Modular design for future feature extensions
 * - Efficient caching for lines data and analysis results
 * - Asynchronous processing with proper error handling
 * - Content-aware analysis foundation for advanced workflows
 *
 * Accessibility:
 * - WCAG 2.2 AA compliant content summary displays
 * - Screen reader compatible analysis results
 * - Proper ARIA labels and semantic structure for content insights
 */

// Logging configuration (module level)
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
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

import MathPixBaseModule from "./mathpix-base-module.js";
import MATHPIX_CONFIG from "./mathpix-config.js";

/**
 * @class MathPixLinesDataManager
 * @extends MathPixBaseModule
 * @description Manages Lines Data API integration for advanced content analysis
 *
 * This class provides comprehensive document content analysis through the MathPix Lines Data API,
 * enabling content-aware features and detailed document insights. It establishes the foundation
 * for advanced content analysis whilst maintaining performance and user experience.
 *
 * @example
 * const linesDataManager = new MathPixLinesDataManager(mathPixController);
 * const analysis = await linesDataManager.fetchAndAnalyzeLines(documentId);
 * console.log('Document contains:', analysis.summary);
 *
 * @see {@link MathPixBaseModule} for inherited functionality
 * @see {@link MathPixController} for integration patterns
 * @since 3.1.0
 */
class MathPixLinesDataManager extends MathPixBaseModule {
  /**
   * @constructor
   * @description Initialises the MathPix Lines Data Manager with configuration and caching
   * @param {MathPixController} controller - Parent controller for coordination and API access
   * @throws {Error} If controller is not provided or invalid
   *
   * @example
   * const controller = new MathPixController();
   * const linesDataManager = new MathPixLinesDataManager(controller);
   *
   * @accessibility Ensures all content analysis maintains accessibility standards
   * @since 3.1.0
   */
  constructor(controller) {
    super(controller);

    /**
     * @member {Map} linesDataCache
     * @description Cache for lines data by document ID
     * @private
     */
    this.linesDataCache = new Map();

    /**
     * @member {Map} analysisCache
     * @description Cache for content analysis results
     * @private
     */
    this.analysisCache = new Map();

    /**
     * @member {Object} currentAnalysis
     * @description Current document analysis state
     */
    this.currentAnalysis = null;

    /**
     * @member {string} currentDocumentId
     * @description Current document ID being analyzed
     */
    this.currentDocumentId = null;

    /**
     * @member {Object} contentTypes
     * @description Content type definitions for analysis
     * @readonly
     */
    this.contentTypes = {
      MATH: "math",
      TEXT: "text",
      TABLE: "table",
      IMAGE: "image",
      DIAGRAM: "diagram",
      EQUATION: "equation",
      FIGURE: "figure",
    };

    this.isInitialised = true;

    logInfo("MathPix Lines Data Manager initialised", {
      cacheSize: this.linesDataCache.size,
      contentTypes: Object.keys(this.contentTypes),
    });
  }

  /**
   * @method fetchLinesData
   * @description Fetches lines data from MathPix API for a document
   *
   * Retrieves detailed line-by-line content data from the MathPix Lines Data API,
   * providing comprehensive information about document structure and content elements.
   *
   * @param {string} documentId - Document ID from PDF processing
   * @param {Object} [options={}] - Optional parameters for lines data fetching
   * @param {boolean} [options.useCache=true] - Whether to use cached data if available
   * @param {Array<string>} [options.includeTypes] - Specific content types to include
   * @returns {Promise<Object>} Lines data object with content breakdown
   * @throws {Error} If API request fails or document ID is invalid
   *
   * @example
   * const linesData = await linesDataManager.fetchLinesData('doc-123', {
   *   includeTypes: ['math', 'table', 'text']
   * });
   *
   * @since 3.1.0
   */
  async fetchLinesData(documentId, options = {}) {
    if (!documentId) {
      throw new Error("Document ID is required for lines data fetching");
    }

    const { useCache = true, includeTypes = [] } = options;

    // Check cache first if enabled
    if (useCache && this.linesDataCache.has(documentId)) {
      logDebug("Using cached lines data", { documentId });
      return this.linesDataCache.get(documentId);
    }

    try {
      logInfo("Fetching lines data from API", { documentId, includeTypes });

      // Use the existing API client from the controller
      if (!this.controller.apiClient) {
        throw new Error("API client not available for lines data fetching");
      }

      // Call API client with simple PDF ID (GET request)
      const linesData = await this.controller.apiClient.fetchLinesData(
        documentId
      );

      if (!linesData) {
        throw new Error("No lines data returned from API");
      }

      // Cache the results
      this.linesDataCache.set(documentId, linesData);

      logInfo("Lines data fetched successfully", {
        documentId,
        lineCount: linesData.lines?.length || 0,
        pageCount: linesData.pages?.length || 0,
      });

      return linesData;
    } catch (error) {
      logError("Failed to fetch lines data", {
        documentId,
        error: error.message,
      });
      throw new Error(`Lines data fetching failed: ${error.message}`);
    }
  }

  /**
   * @method analyzeDocumentContent
   * @description Performs comprehensive content analysis on lines data
   *
   * Analyzes the document content to provide detailed statistics about mathematical elements,
   * tables, text blocks, and other content types for enhanced user feedback and insights.
   *
   * @param {Object} linesData - Lines data from MathPix API
   * @param {Object} [options={}] - Analysis options
   * @param {boolean} [options.includePageBreakdown=true] - Include page-by-page analysis
   * @param {boolean} [options.calculateConfidenceStats=true] - Calculate confidence statistics
   * @returns {Object} Comprehensive content analysis object
   *
   * @example
   * const analysis = await linesDataManager.analyzeDocumentContent(linesData, {
   *   includePageBreakdown: true,
   *   calculateConfidenceStats: true
   * });
   *
   * @since 3.1.0
   */
  analyzeDocumentContent(linesData, options = {}) {
    logDebug("📊 Analyzing document content", {
      hasData: !!linesData,
      structure: linesData ? Object.keys(linesData) : "no data",
    });

    // Validate Lines API response structure
    if (!linesData) {
      throw new Error("No lines data provided for analysis");
    }

    if (!linesData.pages) {
      throw new Error('Lines data missing "pages" property');
    }

    if (!Array.isArray(linesData.pages)) {
      throw new Error('Lines data "pages" must be an array');
    }

    if (linesData.pages.length === 0) {
      throw new Error("Lines data has no pages");
    }

    // Validate first page has required structure
    const firstPage = linesData.pages[0];
    if (!firstPage.lines || !Array.isArray(firstPage.lines)) {
      throw new Error('Page data missing or invalid "lines" array');
    }

    logInfo("✅ Lines data validation passed", {
      pageCount: linesData.pages.length,
      firstPageLines: firstPage.lines.length,
    });

    // Extract options
    const {
      includePageBreakdown = true,
      calculateConfidenceStats = true,
      filterByType = null,
    } = options;

    // Initialize analysis object with correct structure for displayPDFResults
    const analysis = {
      totalPages: linesData.pages.length,
      totalLines: 0,
      contentTypes: {},
      mathElements: { count: 0, inline: 0, display: 0 },
      tableStructures: { count: 0, types: [] },
      textStatistics: { totalCharacters: 0, handwritten: 0, printed: 0 },
      diagrams: 0,
      handwrittenLines: 0,
      printedLines: 0,
      averageConfidence: 0,
      summary: "",
      pageBreakdown: includePageBreakdown ? [] : null,
    };

    let confidenceSum = 0;
    let confidenceCount = 0;

    // Analyze each page
    linesData.pages.forEach((page, pageIndex) => {
      const pageAnalysis = {
        page: page.page || pageIndex + 1,
        imageId: page.image_id,
        lineCount: page.lines.length,
        dimensions: {
          width: page.page_width,
          height: page.page_height,
        },
        contentTypes: {},
        mathElements: 0,
        tables: 0,
        diagrams: 0,
        handwritten: 0,
        printed: 0,
      };

      // Analyze each line on the page
      page.lines.forEach((line) => {
        analysis.totalLines++;

        // Count content types
        if (line.type) {
          analysis.contentTypes[line.type] =
            (analysis.contentTypes[line.type] || 0) + 1;
          pageAnalysis.contentTypes[line.type] =
            (pageAnalysis.contentTypes[line.type] || 0) + 1;

          // Count specific types with correct structure
          if (line.type === "math") {
            analysis.mathElements.count++;
            pageAnalysis.mathElements++;
          } else if (line.type === "table") {
            analysis.tableStructures.count++;
            pageAnalysis.tables++;
          } else if (line.type === "diagram") {
            analysis.diagrams++;
            pageAnalysis.diagrams++;
          }
        }

        // Text statistics
        if (line.text) {
          analysis.textStatistics.totalCharacters += line.text.length;
        }

        // Count handwritten vs printed
        if (line.is_handwritten) {
          analysis.handwrittenLines++;
          analysis.textStatistics.handwritten++;
          pageAnalysis.handwritten++;
        }
        if (line.is_printed) {
          analysis.printedLines++;
          analysis.textStatistics.printed++;
          pageAnalysis.printed++;
        }

        // Aggregate confidence if available
        if (calculateConfidenceStats && typeof line.confidence === "number") {
          confidenceSum += line.confidence;
          confidenceCount++;
        }
      });

      if (includePageBreakdown) {
        analysis.pageBreakdown.push(pageAnalysis);
      }
    });

    // Calculate average confidence (note: averageConfidence not avgConfidence)
    if (confidenceCount > 0) {
      analysis.averageConfidence = confidenceSum / confidenceCount;
    }

    // Generate summary for displayPDFResults
    analysis.summary =
      `Analyzed ${analysis.totalPages} pages with ${analysis.totalLines} lines. ` +
      `Tables: ${analysis.tableStructures.count}, Math: ${analysis.mathElements.count}, ` +
      `Avg confidence: ${analysis.averageConfidence.toFixed(3)}`;

    logInfo("📈 Document analysis complete", {
      pages: analysis.totalPages,
      lines: analysis.totalLines,
      math: analysis.mathElements.count,
      tables: analysis.tableStructures.count,
      confidence: analysis.averageConfidence.toFixed(3),
    });

    return analysis;
  }

  /**
   * @method analyzeContentTypes
   * @description Analyzes and categorizes different content types in the document
   * @param {Array} lines - Lines data array
   * @returns {Object} Content type breakdown with counts and percentages
   * @private
   * @since 3.1.0
   */
  analyzeContentTypes(lines) {
    const contentTypes = {};
    const total = lines.length;

    lines.forEach((line) => {
      const type = this.identifyContentType(line);
      contentTypes[type] = (contentTypes[type] || 0) + 1;
    });

    // Calculate percentages
    Object.keys(contentTypes).forEach((type) => {
      const count = contentTypes[type];
      contentTypes[type] = {
        count,
        percentage: Math.round((count / total) * 100),
      };
    });

    return contentTypes;
  }

  /**
   * @method analyzeMathematicalContent
   * @description Analyzes mathematical content in the document
   * @param {Array} lines - Lines data array
   * @returns {Object} Mathematical content analysis
   * @private
   * @since 3.1.0
   */
  analyzeMathematicalContent(lines) {
    const mathLines = lines.filter(
      (line) => this.identifyContentType(line) === this.contentTypes.MATH
    );

    return {
      total: mathLines.length,
      equations: mathLines.filter((line) => this.isEquation(line)).length,
      expressions: mathLines.filter((line) => this.isExpression(line)).length,
      symbols: this.countMathSymbols(mathLines),
      averageConfidence: this.calculateAverageConfidence(mathLines),
    };
  }

  /**
   * @method analyzeTableStructures
   * @description Analyzes table structures in the document
   * @param {Array} lines - Lines data array
   * @returns {Object} Table structure analysis
   * @private
   * @since 3.1.0
   */
  analyzeTableStructures(lines) {
    const tableLines = lines.filter(
      (line) => this.identifyContentType(line) === this.contentTypes.TABLE
    );

    return {
      count: this.countDistinctTables(tableLines),
      totalCells: tableLines.length,
      averageRowsPerTable: this.calculateAverageTableSize(tableLines),
      containsNumericData: this.hasNumericTableData(tableLines),
    };
  }

  /**
   * @method analyzeTextContent
   * @description Analyzes text content statistics
   * @param {Array} lines - Lines data array
   * @returns {Object} Text content statistics
   * @private
   * @since 3.1.0
   */
  analyzeTextContent(lines) {
    const textLines = lines.filter(
      (line) => this.identifyContentType(line) === this.contentTypes.TEXT
    );
    const totalText = textLines.map((line) => line.text || "").join(" ");

    return {
      lineCount: textLines.length,
      wordCount: totalText.split(/\s+/).filter((word) => word.length > 0)
        .length,
      characterCount: totalText.length,
      averageWordsPerLine:
        textLines.length > 0
          ? Math.round(totalText.split(/\s+/).length / textLines.length)
          : 0,
      languages: this.detectLanguages(textLines),
    };
  }

  /**
   * @method calculateConfidenceStatistics
   * @description Calculates confidence statistics for content analysis
   * @param {Array} lines - Lines data array
   * @returns {Object} Confidence statistics
   * @private
   * @since 3.1.0
   */
  calculateConfidenceStatistics(lines) {
    const confidenceValues = lines
      .map((line) => line.confidence || 0)
      .filter((conf) => conf > 0);

    if (confidenceValues.length === 0) {
      return { available: false, message: "No confidence data available" };
    }

    const sorted = confidenceValues.sort((a, b) => a - b);
    const sum = confidenceValues.reduce((acc, val) => acc + val, 0);

    return {
      available: true,
      average: Math.round(sum / confidenceValues.length),
      median: sorted[Math.floor(sorted.length / 2)],
      minimum: sorted[0],
      maximum: sorted[sorted.length - 1],
      highConfidenceLines: confidenceValues.filter((conf) => conf >= 90).length,
      lowConfidenceLines: confidenceValues.filter((conf) => conf < 70).length,
    };
  }

  /**
   * @method analyzeByPage
   * @description Provides page-by-page content analysis
   * @param {Object} linesData - Complete lines data object
   * @returns {Array} Page-by-page analysis results
   * @private
   * @since 3.1.0
   */
  analyzeByPage(linesData) {
    if (!linesData.pages || !Array.isArray(linesData.pages)) {
      return [];
    }

    return linesData.pages.map((page, index) => {
      const pageLines = linesData.lines.filter(
        (line) => line.page === index + 1
      );

      return {
        pageNumber: index + 1,
        lineCount: pageLines.length,
        contentTypes: this.analyzeContentTypes(pageLines),
        mathElementCount: pageLines.filter(
          (line) => this.identifyContentType(line) === this.contentTypes.MATH
        ).length,
        tableCount: this.countDistinctTables(
          pageLines.filter(
            (line) => this.identifyContentType(line) === this.contentTypes.TABLE
          )
        ),
        wordCount: pageLines.reduce(
          (count, line) =>
            count +
            (line.text || "").split(/\s+/).filter((word) => word.length > 0)
              .length,
          0
        ),
      };
    });
  }

  /**
   * @method generateContentSummary
   * @description Generates human-readable content summary
   * @param {Object} analysis - Content analysis object
   * @returns {string} Human-readable summary
   * @private
   * @since 3.1.0
   */
  generateContentSummary(analysis) {
    const summaryParts = [];

    if (analysis.totalPages > 1) {
      summaryParts.push(`${analysis.totalPages} pages`);
    }

    if (analysis.mathElements.total > 0) {
      summaryParts.push(`${analysis.mathElements.total} mathematical elements`);
    }

    if (analysis.tableStructures.count > 0) {
      summaryParts.push(`${analysis.tableStructures.count} tables`);
    }

    if (analysis.textStatistics.wordCount > 0) {
      summaryParts.push(`${analysis.textStatistics.wordCount} words of text`);
    }

    return summaryParts.length > 0
      ? summaryParts.join(", ")
      : "Document structure analyzed";
  }

  /**
   * @method identifyContentType
   * @description Identifies the content type of a line
   * @param {Object} line - Line data object
   * @returns {string} Content type identifier
   * @private
   * @since 3.1.0
   */
  identifyContentType(line) {
    if (!line) return this.contentTypes.TEXT;

    // Check for mathematical content
    if (
      line.type === "math" ||
      (line.text && /\$.*\$|\\\(.*\\\)|\\\[.*\\\]/.test(line.text))
    ) {
      return this.contentTypes.MATH;
    }

    // Check for table content
    if (line.type === "table" || (line.geometry && line.geometry.table)) {
      return this.contentTypes.TABLE;
    }

    // Check for images or figures
    if (line.type === "image" || line.type === "figure") {
      return this.contentTypes.IMAGE;
    }

    // Default to text
    return this.contentTypes.TEXT;
  }

  /**
   * @method fetchAndAnalyzeLines
   * @description Convenience method to fetch lines data and perform analysis
   *
   * Combines fetching lines data and content analysis into a single operation,
   * providing complete document insights in one method call.
   *
   * @param {string} documentId - Document ID from PDF processing
   * @param {Object} [options={}] - Combined options for fetching and analysis
   * @returns {Promise<Object>} Complete analysis with lines data
   * @throws {Error} If fetching or analysis fails
   *
   * @example
   * const results = await linesDataManager.fetchAndAnalyzeLines('doc-123');
   * console.log('Analysis:', results.analysis.summary);
   *
   * @since 3.1.0
   */
  async fetchAndAnalyzeLines(documentId, options = {}) {
    try {
      logInfo("Starting combined lines data fetch and analysis", {
        documentId,
      });

      const linesData = await this.fetchLinesData(documentId, options);
      const analysis = await this.analyzeDocumentContent(linesData, options);

      this.currentDocumentId = documentId;
      this.currentAnalysis = analysis;

      const results = {
        documentId,
        linesData,
        analysis,
        timestamp: new Date().toISOString(),
      };

      // Cache the complete analysis
      this.analysisCache.set(documentId, results);

      logInfo("Combined lines data and analysis completed", {
        documentId,
        summary: analysis.summary,
      });

      return results;
    } catch (error) {
      logError("Combined lines data and analysis failed", {
        documentId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * @method displayContentSummary
   * @description Displays content summary in the UI
   *
   * Updates the content summary display container with analysis results,
   * providing users with insights about their document content.
   *
   * @param {Object} analysis - Content analysis object
   * @param {Object} [options={}] - Display options
   * @param {boolean} [options.includeDetails=true] - Include detailed breakdown
   * @returns {void}
   *
   * @accessibility Uses semantic HTML and proper ARIA labels for content summary
   * @since 3.1.0
   */
  displayContentSummary(analysis, options = {}) {
    const { includeDetails = true } = options;
    const summaryContainer = document.getElementById("content-summary-display");

    if (!summaryContainer || !analysis) {
      logWarn("Content summary display not available", {
        hasContainer: !!summaryContainer,
        hasAnalysis: !!analysis,
      });
      return;
    }

    try {
      // Build summary HTML with accessibility considerations
      let summaryHTML = `
        <div class="content-summary-header">
          <h4>Document Content Analysis</h4>
          <p class="summary-overview">${analysis.summary}</p>
        </div>
      `;

      if (includeDetails && analysis.contentTypes) {
        summaryHTML += `
          <div class="content-breakdown">
            <h5>Content Breakdown:</h5>
            <dl class="content-stats">
        `;

        Object.entries(analysis.contentTypes).forEach(([type, data]) => {
          if (data.count > 0) {
            summaryHTML += `
              <dt>${this.formatContentTypeName(type)}:</dt>
              <dd>${data.count} items (${data.percentage}%)</dd>
            `;
          }
        });

        summaryHTML += `</dl></div>`;
      }

      summaryContainer.innerHTML = summaryHTML;
      summaryContainer.style.display = "block";

      logDebug("Content summary displayed", {
        summary: analysis.summary,
        includeDetails,
      });
    } catch (error) {
      logError("Failed to display content summary", error);
    }
  }

  /**
   * @method formatContentTypeName
   * @description Formats content type names for display
   * @param {string} type - Content type identifier
   * @returns {string} Formatted display name
   * @private
   * @since 3.1.0
   */
  formatContentTypeName(type) {
    const displayNames = {
      [this.contentTypes.MATH]: "Mathematical Elements",
      [this.contentTypes.TABLE]: "Tables",
      [this.contentTypes.TEXT]: "Text Content",
      [this.contentTypes.IMAGE]: "Images & Figures",
      [this.contentTypes.DIAGRAM]: "Diagrams",
      [this.contentTypes.EQUATION]: "Equations",
      [this.contentTypes.FIGURE]: "Figures",
    };

    return displayNames[type] || type.charAt(0).toUpperCase() + type.slice(1);
  }

  /**
   * @method clearCache
   * @description Clears cached lines data and analysis results
   * @param {string} [documentId] - Specific document ID to clear, or all if not provided
   * @returns {void}
   * @since 3.1.0
   */
  clearCache(documentId = null) {
    if (documentId) {
      this.linesDataCache.delete(documentId);
      this.analysisCache.delete(documentId);
      logDebug("Cache cleared for document", { documentId });
    } else {
      this.linesDataCache.clear();
      this.analysisCache.clear();
      logDebug("All caches cleared");
    }
  }

  /**
   * @method getCurrentAnalysis
   * @description Gets the current document analysis
   * @returns {Object|null} Current analysis object or null
   * @since 3.1.0
   */
  getCurrentAnalysis() {
    return this.currentAnalysis;
  }

  /**
   * @method getCachedAnalysis
   * @description Gets cached analysis for a document
   * @param {string} documentId - Document ID
   * @returns {Object|null} Cached analysis or null
   * @since 3.1.0
   */
  getCachedAnalysis(documentId) {
    return this.analysisCache.get(documentId) || null;
  }

  // Helper methods for content analysis
  isEquation(line) {
    return !!(line.text && /=/.test(line.text));
  }
  isExpression(line) {
    return !!(line.text && /[+\-*/^]/.test(line.text));
  }
  countMathSymbols(lines) {
    return lines.reduce(
      (count, line) => count + (line.text?.match(/[∑∫∆∇πθφψω]/g) || []).length,
      0
    );
  }
  calculateAverageConfidence(lines) {
    const confidences = lines
      .map((l) => l.confidence || 0)
      .filter((c) => c > 0);
    return confidences.length > 0
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : 0;
  }
  countDistinctTables(tableLines) {
    return new Set(tableLines.map((line) => line.tableId || line.page)).size;
  }
  calculateAverageTableSize(tableLines) {
    return tableLines.length > 0
      ? Math.round(tableLines.length / this.countDistinctTables(tableLines))
      : 0;
  }
  hasNumericTableData(tableLines) {
    return tableLines.some((line) => line.text && /\d/.test(line.text));
  }
  detectLanguages(textLines) {
    return ["en"];
  } // Simplified - could be enhanced with language detection

  /**
   * @method cleanup
   * @description Cleans up resources and resets state
   * @returns {void}
   * @since 3.1.0
   */
  cleanup() {
    this.clearCache();
    this.currentAnalysis = null;
    this.currentDocumentId = null;

    // Hide content summary if displayed
    const summaryContainer = document.getElementById("content-summary-display");
    if (summaryContainer) {
      summaryContainer.style.display = "none";
    }

    super.cleanup();
    logDebug("Lines Data Manager cleanup completed");
  }
}

export default MathPixLinesDataManager;
