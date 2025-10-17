/**
 * @fileoverview MathPix Strokes API Client for handwriting recognition
 * @module MathPixStrokesAPIClient
 * @requires ./mathpix-config.js
 * @author MathPix Development Team
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Provides API client for processing handwritten mathematical content using
 * the MathPix Strokes API. Converts stroke coordinate data from canvas drawing
 * into structured mathematical formats including LaTeX, MathML, and AsciiMath.
 *
 * Key Features:
 * - Handwritten stroke processing with coordinate arrays
 * - Multi-format mathematical content output
 * - Stroke data validation and formatting
 * - Progress tracking integration with callbacks
 * - Comprehensive error handling and recovery
 * - Privacy-first configuration with GDPR compliance
 * - Response normalisation for consistent data structure
 *
 * Integration:
 * - Works with MathPixStrokesCanvas for stroke data input
 * - Integrates with MathPixConfig for privacy-compliant defaults
 * - Supports MathPixController delegation patterns
 * - Compatible with existing notification systems
 * - Can reuse authentication from main MathPixAPIClient
 *
 * Accessibility:
 * - WCAG 2.2 AA compliant error messaging
 * - Progress callbacks support screen reader announcements
 * - Structured data output enables accessible mathematics rendering
 */

// Logging configuration (module level)
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

/**
 * Determines if logging should occur at the specified level
 * @private
 * @param {number} level - Log level to check
 * @returns {boolean} True if logging should occur
 */
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

/**
 * Logs error messages when appropriate log level is set
 * @private
 * @param {string} message - Primary log message
 * @param {...*} args - Additional arguments to log
 */
function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

/**
 * Logs warning messages when appropriate log level is set
 * @private
 * @param {string} message - Primary log message
 * @param {...*} args - Additional arguments to log
 */
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

/**
 * Logs informational messages when appropriate log level is set
 * @private
 * @param {string} message - Primary log message
 * @param {...*} args - Additional arguments to log
 */
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

/**
 * Logs debug messages when appropriate log level is set
 * @private
 * @param {string} message - Primary log message
 * @param {...*} args - Additional arguments to log
 */
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

import MATHPIX_CONFIG from "./mathpix-config.js";

/**
 * @class MathPixStrokesAPIClient
 * @description API client for MathPix Strokes handwriting recognition services.
 *
 * Handles communication with the MathPix Strokes API endpoint to process
 * handwritten mathematical content captured as stroke coordinate data.
 * Designed for privacy-first operation with GDPR compliance and comprehensive
 * progress tracking support.
 *
 * @example
 * const strokesClient = new MathPixStrokesAPIClient();
 * strokesClient.setCredentials(appId, apiKey);
 *
 * const strokesData = canvas.formatForAPI();
 * const result = await strokesClient.processStrokes(strokesData, {
 *   formats: ['text', 'data']
 * }, progressCallback);
 *
 * console.log(result.latex); // LaTeX output
 * console.log(result.confidence); // Recognition confidence
 *
 * @see {@link MathPixConfig} for configuration options
 * @see {@link MathPixStrokesCanvas} for stroke data generation
 * @since 1.0.0
 */
class MathPixStrokesAPIClient {
  /**
   * Creates a new MathPix Strokes API client instance
   *
   * @description
   * Initialises the client without credentials. Credentials must be set
   * using setCredentials() before processing any strokes.
   *
   * @example
   * const client = new MathPixStrokesAPIClient();
   * // Client ready for credential configuration
   *
   * @accessibility Ensures all error messages are screen reader compatible
   * @since 1.0.0
   */
  constructor() {
    /**
     * MathPix API key for authentication
     * @type {string|null}
     * @private
     */
    this.apiKey = null;

    /**
     * MathPix application ID for authentication
     * @type {string|null}
     * @private
     */
    this.appId = null;

    /**
     * MathPix API base URL for all requests
     * @type {string|null}
     * @private
     * @description Set by main controller to match current endpoint
     */
    this.apiBase = null;

    /**
     * Stores debug data from last API operation
     * @type {Object|null}
     * @private
     * @description Used by developer debug panel for transaction visibility
     */
    this.lastDebugData = null;

    logInfo("MathPixStrokesAPIClient initialised", {
      apiBase: "Will be set by main controller",
    });
  }

  /**
   * Configures the API client with MathPix authentication credentials
   *
   * @description
   * Sets authentication credentials for API requests. Both appId and apiKey
   * are required. Credentials are validated during the first API call.
   *
   * @param {string} appId - MathPix application ID
   * @param {string} apiKey - MathPix API key
   *
   * @throws {Error} If appId or apiKey are not provided or are empty strings
   *
   * @example
   * client.setCredentials('your-app-id', 'your-api-key');
   * // Client now ready for processing requests
   *
   * @security Credentials are stored in memory only and not persisted
   * @since 1.0.0
   */
  setCredentials(appId, apiKey) {
    if (!appId || !apiKey) {
      throw new Error("Both appId and apiKey are required");
    }

    this.appId = appId;
    this.apiKey = apiKey;
    logDebug("MathPix Strokes credentials configured");
  }

  /**
   * Processes handwritten mathematical strokes using the MathPix Strokes API
   *
   * @description
   * This is the primary method for handwriting recognition. It handles
   * stroke data validation, API communication, progress tracking, and
   * response normalisation. Supports multiple output formats and provides
   * detailed timing metrics.
   *
   * @param {Object} strokesData - Stroke coordinate data from canvas
   * @param {Object} strokesData.strokes - Strokes container object
   * @param {Object} strokesData.strokes.strokes - Nested strokes with x,y arrays
   * @param {Array<Array<number>>} strokesData.strokes.strokes.x - X coordinate arrays
   * @param {Array<Array<number>>} strokesData.strokes.strokes.y - Y coordinate arrays
   * @param {Object} [options={}] - Processing options to override defaults
   * @param {Array<string>} [options.formats] - Output formats to request
   * @param {Object} [options.metadata] - Metadata options (improve_mathpix, etc.)
   * @param {Object} [options.data_options] - Data extraction options
   * @param {Object} [progressCallback=null] - Progress tracking callback object
   * @param {Function} [progressCallback.nextStep] - Called when advancing to next step
   * @param {Function} [progressCallback.updateTiming] - Called with timing updates
   * @param {Function} [progressCallback.handleError] - Called when errors occur
   *
   * @returns {Promise<Object>} Normalised processing result with multiple formats
   * @returns {string} returns.latex - LaTeX representation of mathematics
   * @returns {string} returns.mathml - MathML representation
   * @returns {string} returns.asciimath - AsciiMath representation
   * @returns {number} returns.confidence - Recognition confidence (0-1)
   * @returns {boolean} returns.isHandwritten - True (always true for strokes)
   * @returns {Object} returns.processingTiming - Detailed timing information
   * @returns {Object} returns.rawResponse - Original API response
   *
   * @throws {Error} When API credentials are not configured
   * @throws {Error} When stroke data validation fails
   * @throws {Error} When API request fails or returns error response
   *
   * @example
   * // Basic usage
   * const strokesData = canvas.formatForAPI();
   * const result = await client.processStrokes(strokesData);
   * console.log(result.latex);
   *
   * @example
   * // With progress tracking
   * const progressHandler = {
   *   nextStep: () => console.log('Next step'),
   *   updateTiming: (info) => console.log('Progress:', info),
   *   handleError: (err, context) => console.error('Error:', err, context)
   * };
   *
   * const result = await client.processStrokes(
   *   strokesData,
   *   { formats: ['text', 'data'] },
   *   progressHandler
   * );
   *
   * @accessibility Progress callbacks support screen reader announcements
   * @performance Includes detailed timing metrics for performance monitoring
   * @privacy Respects GDPR-compliant configuration from MathPixConfig
   * @since 1.0.0
   */
  async processStrokes(strokesData, options = {}, progressCallback = null) {
    if (!this.appId || !this.apiKey) {
      throw new Error("MathPix API credentials not configured");
    }

    const processingStartTime = Date.now();

    logInfo("Starting MathPix strokes processing", {
      strokeCount: strokesData?.strokes?.strokes?.x?.length || 0,
      hasProgressCallback: !!progressCallback,
    });

    // Validate stroke data
    this.validateStrokesData(strokesData);

    try {
      // Notify progress: Starting processing
      if (progressCallback && typeof progressCallback.nextStep === "function") {
        progressCallback.nextStep();
      }

      // ENHANCED: Get user preferences from UI Manager (shared with Text API)
      let userPrefs = {
        // 🎯 PRIORITY: Table extraction (default TRUE for better UX)
        includeTableHtml: true,
        includeTsv: true,

        // Delimiter preferences
        delimiterFormat: "latex",
        equationNumbering: false,

        // Processing options
        rmSpaces: true,
        rmFonts: false,
        idiomaticEqnArrays: false,
        idiomaticBraces: false,
      };

      // Try to get preferences from UI Manager if available
      if (typeof window !== "undefined" && window.getMathPixController) {
        try {
          const controller = window.getMathPixController();
          if (controller?.uiManager?.getCurrentPreferences) {
            const loadedPrefs = controller.uiManager.getCurrentPreferences();
            userPrefs = { ...userPrefs, ...loadedPrefs };
            logDebug(
              "[Strokes API] User preferences loaded from UI Manager",
              userPrefs
            );
          }
        } catch (e) {
          logWarn(
            "[Strokes API] Could not load user preferences, using defaults",
            e
          );
        }
      }

      // ENHANCED: Delimiter configurations
      const DELIMITER_CONFIG = {
        latex: {
          inline: ["\\(", "\\)"],
          display: ["\\[", "\\]"],
        },
        markdown: {
          inline: ["$", "$"],
          display: ["$$", "$$"],
        },
      };

      const selectedDelimiters =
        DELIMITER_CONFIG[userPrefs.delimiterFormat] || DELIMITER_CONFIG.latex;

      // ENHANCED: Prepare comprehensive request payload with user preferences
      const requestPayload = {
        ...strokesData,
        formats: options.formats || MATHPIX_CONFIG.DEFAULT_REQUEST.formats,
        metadata: options.metadata || MATHPIX_CONFIG.DEFAULT_REQUEST.metadata,

        // ENHANCED: Data options with table extraction (Priority #1)
        data_options: {
          include_latex: true,
          include_asciimath: true,
          include_mathml: true,
          // 🎯 PRIORITY: Table extraction options (default TRUE)
          include_table_html:
            userPrefs.includeTableHtml !== undefined
              ? userPrefs.includeTableHtml
              : true,
          include_tsv:
            userPrefs.includeTsv !== undefined ? userPrefs.includeTsv : true,
          ...options.data_options,
        },

        // ENHANCED: Enable advanced table processing for complex hand-drawn tables
        enable_tables_fallback: true,

        // ENHANCED: User-configurable delimiter format
        math_inline_delimiters: selectedDelimiters.inline,
        math_display_delimiters: selectedDelimiters.display,

        // ENHANCED: Processing options
        rm_spaces: userPrefs.rmSpaces !== undefined ? userPrefs.rmSpaces : true,
        rm_fonts: userPrefs.rmFonts || false,
        include_equation_tags: userPrefs.equationNumbering || false,
        idiomatic_eqn_arrays: userPrefs.idiomaticEqnArrays || false,
        idiomatic_braces: userPrefs.idiomaticBraces || false,
      };

      logInfo("[Strokes API] Processing with enhanced parameters", {
        tableHtml: requestPayload.data_options.include_table_html,
        tableTsv: requestPayload.data_options.include_tsv,
        delimiterFormat: userPrefs.delimiterFormat,
        rmSpaces: requestPayload.rm_spaces,
        equationNumbering: requestPayload.include_equation_tags,
      });

      logDebug("Strokes API request payload", {
        strokeCount: strokesData.strokes.strokes.x.length,
        totalPoints: strokesData.strokes.strokes.x.reduce(
          (sum, arr) => sum + arr.length,
          0
        ),
        formats: requestPayload.formats,
        tableExtractionEnabled: requestPayload.data_options.include_table_html,
        delimiters: {
          inline: requestPayload.math_inline_delimiters,
          display: requestPayload.math_display_delimiters,
        },
      });

      // Notify progress: Sending to API
      if (progressCallback && typeof progressCallback.nextStep === "function") {
        progressCallback.nextStep();
      }

      // Make API request with timing measurement
      const requestStartTime = Date.now();
      const response = await fetch(`${this.apiBase}/strokes`, {
        method: "POST",
        headers: {
          app_id: this.appId,
          app_key: this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
        timeout: MATHPIX_CONFIG.TIMEOUT,
      });

      const requestDuration = Date.now() - requestStartTime;
      logDebug("Strokes API request completed", {
        duration: `${requestDuration}ms`,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logError("MathPix Strokes API error response", errorText);
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      // Update progress with confidence information
      if (
        progressCallback &&
        typeof progressCallback.updateTiming === "function"
      ) {
        const confidence = result.confidence
          ? Math.round(result.confidence * 100)
          : 0;
        progressCallback.updateTiming(`${confidence}% confidence detected`);
      }

      // Notify progress: Formatting results
      if (progressCallback && typeof progressCallback.nextStep === "function") {
        progressCallback.nextStep();
      }

      const totalProcessingTime = Date.now() - processingStartTime;
      logInfo("MathPix strokes processing completed successfully", {
        totalTime: `${totalProcessingTime}ms`,
        apiTime: `${requestDuration}ms`,
        confidence: result.confidence,
      });

      logDebug("MathPix Strokes API response", result);

      const normalisedResult = this.normaliseStrokesResponse(result);

      // Add timing information to result
      normalisedResult.processingTiming = {
        total: totalProcessingTime,
        apiRequest: requestDuration,
        processing: totalProcessingTime - requestDuration,
      };

      // ✅ CRITICAL: Capture debug data for developer panel
      this.lastDebugData = {
        timestamp: new Date().toISOString(),
        operation: "processStrokes",
        endpoint: `${this.apiBase}/strokes`,
        request: {
          headers: {
            app_id: this.appId,
            app_key: this.maskApiKey(this.apiKey),
          },
          strokesData: {
            strokeCount: strokesData?.strokes?.strokes?.x?.length || 0,
            totalPoints:
              strokesData?.strokes?.strokes?.x?.reduce(
                (sum, arr) => sum + arr.length,
                0
              ) || 0,
          },
          formats: requestPayload.formats,
          options: {
            tableExtractionEnabled:
              requestPayload.data_options.include_table_html,
            delimiterFormat: userPrefs.delimiterFormat,
            rmSpaces: requestPayload.rm_spaces,
          },
        },
        response: {
          status: 200,
          statusText: "OK",
          confidence: result.confidence,
          contentType:
            result.is_handwritten !== false ? "handwritten" : "printed", // ✅ ADDED
          isHandwritten: result.is_handwritten,
          containsTable: normalisedResult.containsTable,
          data: result,
        },
        timing: {
          total: totalProcessingTime,
          api: requestDuration,
          processing: totalProcessingTime - requestDuration,
        },
        metadata: {
          confidence: result.confidence || 0,
          isHandwritten: result.is_handwritten !== false,
          containsTable: normalisedResult.containsTable,
          strokeCount: strokesData?.strokes?.strokes?.x?.length || 0,
        },
      };

      logDebug("Debug data captured for strokes operation", {
        operation: this.lastDebugData.operation,
        timing: this.lastDebugData.timing,
      });

      return normalisedResult;
    } catch (error) {
      logError("MathPix Strokes API request failed", error);

      // ✅ CRITICAL: Capture debug data even on error
      const totalProcessingTime = Date.now() - processingStartTime;
      this.lastDebugData = {
        timestamp: new Date().toISOString(),
        operation: "processStrokes",
        endpoint: `${this.apiBase}/strokes`,
        error: {
          message: error.message,
          stack: error.stack,
        },
        request: {
          headers: {
            app_id: this.appId,
            app_key: this.maskApiKey(this.apiKey),
          },
          strokesData: {
            strokeCount: strokesData?.strokes?.strokes?.x?.length || 0,
          },
        },
        timing: {
          total: totalProcessingTime,
          api: null,
          processing: null,
        },
      };

      logDebug("Debug data captured for failed strokes operation", {
        error: error.message,
      });

      // Notify progress callback of error
      if (
        progressCallback &&
        typeof progressCallback.handleError === "function"
      ) {
        progressCallback.handleError(error, "during strokes API processing");
      }

      throw new Error(`Strokes processing failed: ${error.message}`);
    }
  }

  /**
   * Validates stroke data before API submission
   *
   * @description
   * Checks stroke data structure and content to ensure it meets API requirements.
   * Validates coordinate array structure and ensures sufficient stroke data exists.
   *
   * @param {Object} strokesData - Stroke data to validate
   *
   * @throws {Error} When stroke data structure is invalid
   * @throws {Error} When stroke data is empty or insufficient
   *
   * @example
   * try {
   *   client.validateStrokesData(strokesData);
   *   // Data is valid, proceed with processing
   * } catch (error) {
   *   console.error('Validation failed:', error.message);
   * }
   *
   * @accessibility Error messages are formatted for screen reader compatibility
   * @since 1.0.0
   */
  validateStrokesData(strokesData) {
    // Check top-level structure
    if (!strokesData || typeof strokesData !== "object") {
      throw new Error("Invalid strokes data: must be an object");
    }

    if (!strokesData.strokes || typeof strokesData.strokes !== "object") {
      throw new Error("Invalid strokes data: missing strokes container");
    }

    if (
      !strokesData.strokes.strokes ||
      typeof strokesData.strokes.strokes !== "object"
    ) {
      throw new Error("Invalid strokes data: missing nested strokes object");
    }

    const { x, y } = strokesData.strokes.strokes;

    // Check coordinate arrays exist
    if (!Array.isArray(x) || !Array.isArray(y)) {
      throw new Error("Invalid strokes data: x and y must be arrays");
    }

    // Check arrays have same length
    if (x.length !== y.length) {
      throw new Error(
        "Invalid strokes data: x and y arrays must have same length"
      );
    }

    // Check for empty strokes
    if (x.length === 0) {
      throw new Error("Invalid strokes data: no strokes provided");
    }

    // Validate each stroke has coordinate arrays
    for (let i = 0; i < x.length; i++) {
      if (!Array.isArray(x[i]) || !Array.isArray(y[i])) {
        throw new Error(
          `Invalid strokes data: stroke ${i} coordinates must be arrays`
        );
      }

      if (x[i].length !== y[i].length) {
        throw new Error(
          `Invalid strokes data: stroke ${i} x and y arrays must have same length`
        );
      }

      if (x[i].length < 2) {
        throw new Error(
          `Invalid strokes data: stroke ${i} must have at least 2 points`
        );
      }
    }

    logDebug("Stroke data validation passed", {
      strokeCount: x.length,
      totalPoints: x.reduce((sum, arr) => sum + arr.length, 0),
    });
  }

  /**
   * Normalises Strokes API response to standard format
   *
   * @description
   * Extracts and organises recognised mathematical content from the
   * MathPix Strokes API response. Provides format support including
   * LaTeX, MathML, AsciiMath, and structured JSON.
   *
   * @param {Object} apiResponse - Raw API response from MathPix Strokes
   * @param {string} [apiResponse.text] - LaTeX text content
   * @param {string} [apiResponse.latex_styled] - Styled LaTeX representation
   * @param {Array} [apiResponse.data] - Additional format data array
   * @param {number} [apiResponse.confidence] - Recognition confidence (0-1)
   * @param {boolean} [apiResponse.is_handwritten] - Handwritten flag (always true)
   *
   * @returns {Object} Normalised multi-format response object
   * @returns {string} returns.latex - LaTeX mathematical notation
   * @returns {string} returns.asciimath - AsciiMath notation
   * @returns {string} returns.mathml - MathML XML representation
   * @returns {string} returns.rawJson - Complete API response as formatted JSON
   * @returns {number} returns.confidence - Recognition confidence (0-1)
   * @returns {boolean} returns.isHandwritten - True (always true for strokes)
   * @returns {Object} returns.rawResponse - Original unmodified API response
   *
   * @example
   * const result = client.normaliseStrokesResponse(apiResponse);
   * console.log(result.latex);     // 3x^{2}
   * console.log(result.asciimath); // 3x^2
   *
   * @accessibility All formats support accessible mathematics rendering
   * @since 1.0.0
   */
  normaliseStrokesResponse(apiResponse) {
    // Extract all formats from data array
    const htmlValue = this.extractDataValue(apiResponse.data, "html");
    const tsvValue = this.extractDataValue(apiResponse.data, "tsv");

    // Detect if response contains table data
    const containsTable = !!(htmlValue || tsvValue);

    // ✅ Generate markdown table from TSV if available
    const markdownTableValue = tsvValue
      ? this.convertTsvToMarkdown(tsvValue)
      : "";

    const result = {
      // Primary LaTeX output
      latex: apiResponse.text || apiResponse.latex_styled || "",

      // Extract additional formats from data array
      asciimath: this.extractDataValue(apiResponse.data, "asciimath"),
      mathml: this.extractDataValue(apiResponse.data, "mathml"),

      // ✅ FIXED: Table formats with correct property names
      // Note: API returns "html" in data array for tables, we store as both html and tableHtml
      html: htmlValue || "", // For general HTML output container
      tableHtml: htmlValue || "", // For table-specific HTML container
      tsv: tsvValue || "",
      tableMarkdown: markdownTableValue, // ✅ Generated from TSV

      // Table detection flag
      containsTable: containsTable,

      // Recognition metadata
      confidence: apiResponse.confidence || 0,
      isHandwritten: apiResponse.is_handwritten !== false, // Default to true for strokes

      // Complete response data
      rawJson: JSON.stringify(apiResponse, null, 2),
      rawResponse: apiResponse,
    };

    logDebug("Strokes response normalised", {
      hasLatex: !!result.latex,
      hasAsciimath: !!result.asciimath,
      hasMathml: !!result.mathml,
      hasHtml: !!result.html,
      hasTableHtml: !!result.tableHtml,
      hasTsv: !!result.tsv,
      hasTableMarkdown: !!result.tableMarkdown,
      containsTable: result.containsTable,
      confidence: result.confidence,
    });

    return result;
  }

  /**
   * Extracts specific format data from API data array
   *
   * @description
   * The MathPix API returns additional formats in a data array structure.
   * This method safely extracts values for specific format types.
   *
   * @param {Array} dataArray - Data array from API response
   * @param {string} type - Format type to extract (e.g., 'asciimath', 'mathml')
   *
   * @returns {string} Extracted format value or empty string if not found
   *
   * @example
   * const mathml = client.extractDataValue(response.data, 'mathml');
   * const asciimath = client.extractDataValue(response.data, 'asciimath');
   *
   * @private
   * @since 1.0.0
   */
  extractDataValue(dataArray, type) {
    if (!Array.isArray(dataArray)) return "";

    const dataItem = dataArray.find((item) => item.type === type);
    return dataItem ? dataItem.value || "" : "";
  }

  /**
   * Gets the configured API base URL
   *
   * @returns {string} API base URL
   *
   * @example
   * console.log(client.getApiBase()); // "https://api.mathpix.com/v3"
   *
   * @since 1.0.0
   */
  getApiBase() {
    return this.apiBase;
  }

  /**
   * Checks if credentials are configured
   *
   * @returns {boolean} True if both appId and apiKey are set
   *
   * @example
   * if (client.hasCredentials()) {
   *   await client.processStrokes(strokesData);
   * }
   *
   * @since 1.0.0
   */
  hasCredentials() {
    return !!(this.appId && this.apiKey);
  }

  /**
   * Gets client debug information
   *
   * @returns {Object} Debug information about client state
   * @returns {boolean} returns.hasCredentials - Whether credentials are configured
   * @returns {string} returns.apiBase - API base URL
   * @returns {boolean} returns.hasAppId - Whether app ID is set
   * @returns {boolean} returns.hasApiKey - Whether API key is set
   *
   * @example
   * const debugInfo = client.getDebugInfo();
   * console.log('Client status:', debugInfo);
   *
   * @since 1.0.0
   */
  getDebugInfo() {
    return {
      hasCredentials: this.hasCredentials(),
      apiBase: this.apiBase,
      hasAppId: !!this.appId,
      hasApiKey: !!this.apiKey,
    };
  }
  /**
   * Convert TSV (Tab-Separated Values) to Markdown table format
   *
   * @description
   * Generates a Markdown table from TSV data for display in the table-markdown format.
   * First row is treated as headers, subsequent rows as data.
   *
   * @param {string} tsv - Tab-separated values string
   * @returns {string} Markdown formatted table
   *
   * @example
   * const tsv = "Name\tAge\nAlice\t25\nBob\t30";
   * const markdown = client.convertTsvToMarkdown(tsv);
   * // Returns:
   * // | Name | Age |
   * // |------|-----|
   * // | Alice | 25 |
   * // | Bob | 30 |
   *
   * @accessibility Generated tables maintain semantic structure for screen readers
   * @since 1.0.0
   */
  convertTsvToMarkdown(tsv) {
    if (!tsv || typeof tsv !== "string" || tsv.trim() === "") {
      return "";
    }

    try {
      // Split into rows
      const rows = tsv.trim().split("\n");

      if (rows.length === 0) {
        return "";
      }

      // Process each row
      const processedRows = rows.map((row) => {
        // Split on tabs and trim each cell
        const cells = row.split("\t").map((cell) => cell.trim());
        // Join cells with markdown table separators
        return `| ${cells.join(" | ")} |`;
      });

      // If we have at least one row, add separator after first row (headers)
      if (processedRows.length >= 1) {
        const headerRow = processedRows[0];
        // Count columns from header row
        const columnCount = headerRow.split("|").filter((s) => s.trim()).length;

        // Create separator row with correct number of columns
        const separatorRow = "|" + " --- |".repeat(columnCount);

        // Insert separator after header
        processedRows.splice(1, 0, separatorRow);
      }

      const markdownTable = processedRows.join("\n");

      logDebug("Converted TSV to Markdown table", {
        rowCount: rows.length,
        columnCount: rows[0]?.split("\t").length || 0,
        markdownLength: markdownTable.length,
      });

      return markdownTable;
    } catch (error) {
      logError("Failed to convert TSV to Markdown", error);
      return ""; // Return empty string on error
    }
  }

  /**
   * Masks API key for secure logging and display
   *
   * @description
   * Protects API key by showing only last 4 characters, masking the rest.
   * Used in debug panel to prevent credential exposure.
   *
   * @param {string} apiKey - API key to mask
   * @returns {string} Masked API key (e.g., "****************************ddcb")
   *
   * @example
   * const masked = client.maskApiKey("abcdef1234567890");
   * console.log(masked); // "************7890"
   *
   * @security CRITICAL for preventing credential leakage
   * @since 1.0.0
   */
  maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 8) {
      return "****";
    }
    const visibleChars = 4;
    const maskedLength = apiKey.length - visibleChars;
    return "*".repeat(maskedLength) + apiKey.slice(-visibleChars);
  }

  /**
   * Gets debug data from last API operation
   *
   * @description
   * Returns detailed transaction data from the most recent processStrokes()
   * call. Used by developer debug panel for comprehensive API visibility.
   *
   * @returns {Object|null} Debug data object or null if no operations performed
   * @returns {string} returns.timestamp - ISO 8601 timestamp
   * @returns {string} returns.operation - Operation type ('processStrokes')
   * @returns {string} returns.endpoint - API endpoint URL
   * @returns {Object} returns.request - Request details (masked credentials)
   * @returns {Object} returns.response - Response data and metadata
   * @returns {Object} returns.timing - Performance timing metrics
   *
   * @example
   * await client.processStrokes(strokesData);
   * const debugData = client.getLastDebugData();
   * console.log(debugData.timing.total); // 1450 (ms)
   *
   * @since 1.0.0
   */
  getLastDebugData() {
    return this.lastDebugData;
  }
}

export default MathPixStrokesAPIClient;
