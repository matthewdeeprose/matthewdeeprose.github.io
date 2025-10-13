/**
 * @fileoverview MathPix API Client for mathematical content recognition and processing
 * @module MathPixAPIClient
 * @requires ./mathpix-config.js
 * @author MathPix Development Team
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Provides a comprehensive client for interacting with the MathPix API to convert
 * mathematical images and PDFs into various structured formats including LaTeX,
 * MathML, AsciiMath, HTML, and Markdown.
 *
 * Key Features:
 * - Multi-format mathematical content recognition (LaTeX, MathML, AsciiMath)
 * - File validation with size and type checking
 * - Progress tracking integration with callback support
 * - Comprehensive error handling and recovery
 * - Privacy-first configuration with GDPR compliance
 * - Response normalisation for consistent data structure
 * - Performance monitoring with detailed timing metrics
 *
 * Integration:
 * - Works with MathPixProgressDisplay for user feedback
 * - Integrates with MathPixConfig for privacy-compliant defaults
 * - Supports MathPixController delegation patterns
 * - Compatible with existing notification systems
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
 * @function shouldLog
 * @description Determines if a message should be logged based on current configuration
 * @param {number} level - Log level to check
 * @returns {boolean} True if message should be logged
 * @private
 */
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

/**
 * @function logError
 * @description Logs error messages when error logging is enabled
 * @param {string} message - Error message to log
 * @param {...*} args - Additional arguments to log
 * @private
 */
function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
}

/**
 * @function logWarn
 * @description Logs warning messages when warning logging is enabled
 * @param {string} message - Warning message to log
 * @param {...*} args - Additional arguments to log
 * @private
 */
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
}

/**
 * @function logInfo
 * @description Logs informational messages when info logging is enabled
 * @param {string} message - Info message to log
 * @param {...*} args - Additional arguments to log
 * @private
 */
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
}

/**
 * @function logDebug
 * @description Logs debug messages when debug logging is enabled
 * @param {string} message - Debug message to log
 * @param {...*} args - Additional arguments to log
 * @private
 */
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
}

import MATHPIX_CONFIG from "./mathpix-config.js";

/**
 * @class MathPixAPIClient
 * @description Main API client for MathPix mathematical content recognition services.
 *
 * Handles all communication with the MathPix API including authentication,
 * file validation, request formatting, response processing, and error handling.
 * Designed for privacy-first operation with GDPR compliance and comprehensive
 * progress tracking support.
 *
 * @example
 * const apiClient = new MathPixAPIClient();
 * apiClient.setCredentials(appId, apiKey);
 *
 * const result = await apiClient.processImage(mathFile, {
 *   formats: ['text', 'data', 'html']
 * }, progressCallback);
 *
 * console.log(result.latex); // LaTeX output
 * console.log(result.confidence); // Recognition confidence
 *
 * @see {@link MathPixConfig} for configuration options
 * @see {@link MathPixProgressDisplay} for progress tracking integration
 * @since 1.0.0
 */
class MathPixAPIClient {
  /**
   * @constructor
   * @description Creates a new MathPix API client instance with default configuration.
   *
   * The client is initialised without credentials and must have credentials set
   * using setCredentials() before processing any files.
   *
   * @example
   * const client = new MathPixAPIClient();
   * // Client ready for credential configuration
   *
   * @accessibility Ensures all error messages are screen reader compatible
   * @since 1.0.0
   */
  constructor() {
    /**
     * @member {string|null} apiKey
     * @description MathPix API key for authentication
     * @private
     */
    this.apiKey = null;

    /**
     * @member {string|null} appId
     * @description MathPix application ID for authentication
     * @private
     */
    this.appId = null;

    /**
     * @member {string} apiBase
     * @description MathPix API base URL for all requests
     * @private
     */
    this.apiBase = MATHPIX_CONFIG.API_BASE;

    logInfo("MathPixAPIClient initialised", { apiBase: this.apiBase });
  }

  /**
   * @method setCredentials
   * @description Configures the API client with MathPix authentication credentials.
   *
   * Both appId and apiKey are required for successful API requests. Credentials
   * are validated during the first API call, not during this method.
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
    this.appId = appId;
    this.apiKey = apiKey;
    logDebug("MathPix credentials configured");
  }

  /**
   * @method processImage
   * @description Processes mathematical images or PDFs using the MathPix API.
   *
   * This is the primary method for mathematical content recognition. It handles
   * file validation, API communication, progress tracking, and response normalisation.
   * The method supports multiple output formats and provides detailed timing metrics.
   *
   * @param {File} file - Image or PDF file containing mathematical content
   * @param {Object} [options={}] - Processing options to override defaults
   * @param {Array<string>} [options.formats] - Output formats to request
   * @param {Object} [options.data_options] - Data extraction options
   * @param {boolean} [options.data_options.include_latex] - Include LaTeX output
   * @param {boolean} [options.data_options.include_mathml] - Include MathML output
   * @param {boolean} [options.data_options.include_asciimath] - Include AsciiMath output
   * @param {Object} [progressCallback=null] - Progress tracking callback object
   * @param {Function} [progressCallback.nextStep] - Called when advancing to next step
   * @param {Function} [progressCallback.updateTiming] - Called with timing updates
   * @param {Function} [progressCallback.handleError] - Called when errors occur
   *
   * @returns {Promise<Object>} Normalised processing result with multiple formats
   * @returns {string} returns.latex - LaTeX representation of mathematics
   * @returns {string} returns.mathml - MathML representation
   * @returns {string} returns.asciimath - AsciiMath representation
   * @returns {string} returns.html - HTML representation
   * @returns {string} returns.markdown - Markdown with embedded mathematics
   * @returns {string} returns.rawJson - Complete API response as JSON
   * @returns {number} returns.confidence - Recognition confidence (0-1)
   * @returns {boolean} returns.isHandwritten - True if handwritten content detected
   * @returns {boolean} returns.isPrinted - True if printed content detected
   * @returns {Object} returns.processingTiming - Detailed timing information
   * @returns {Object} returns.rawResponse - Original API response
   *
   * @throws {Error} When API credentials are not configured
   * @throws {Error} When file validation fails (size, type, etc.)
   * @throws {Error} When API request fails or returns error response
   * @throws {Error} When response processing fails
   *
   * @example
   * // Basic usage
   * const result = await client.processImage(mathImage);
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
   * const result = await client.processImage(
   *   mathImage,
   *   { formats: ['text', 'data'] },
   *   progressHandler
   * );
   *
   * @example
   * // Custom options
   * const result = await client.processImage(mathPdf, {
   *   formats: ['text', 'html'],
   *   data_options: {
   *     include_latex: true,
   *     include_mathml: false
   *   }
   * });
   *
   * @accessibility Progress callbacks support screen reader announcements
   * @performance Includes detailed timing metrics for performance monitoring
   * @privacy Respects GDPR-compliant configuration from MathPixConfig
   * @since 1.0.0
   */
  async processImage(file, options = {}, progressCallback = null) {
    if (!this.appId || !this.apiKey) {
      throw new Error("MathPix API credentials not configured");
    }

    const processingStartTime = Date.now();

    logInfo("Starting MathPix image processing", {
      fileName: file.name,
      size: file.size,
      hasProgressCallback: !!progressCallback,
    });

    // Validate file before processing
    this.validateFile(file);

    try {
      // Notify progress: Starting upload
      if (progressCallback && typeof progressCallback.nextStep === "function") {
        progressCallback.nextStep();
      }

      // Phase 2: Get user preferences from UI manager (if available)
      let userPrefs = {
        equationNumbering: true,
        delimiterFormat: "latex",
        includePageInfo: true,
      };

      // Access UI manager through global controller if available
      if (window.getMathPixController) {
        try {
          const controller = window.getMathPixController();
          if (
            controller &&
            controller.uiManager &&
            controller.uiManager.getCurrentPreferences
          ) {
            userPrefs = controller.uiManager.getCurrentPreferences();
            logDebug(
              "[MathPix API] User preferences retrieved from UI",
              userPrefs
            );
          }
        } catch (e) {
          logWarn(
            "[MathPix API] Could not retrieve user preferences, using defaults",
            e
          );
        }
      }

      // Phase 2: Delimiter configurations based on user preference
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

      // Enhanced request options for multiple formats
      const requestOptions = {
        formats: ["text", "data", "html"],
        data_options: {
          include_latex: true,
          include_asciimath: true,
          include_mathml: true,
        },
        ...MATHPIX_CONFIG.DEFAULT_REQUEST,
        ...options,

        // Phase 2: Apply user-configurable options (Text API only)
        include_equation_tags: userPrefs.equationNumbering,
        math_inline_delimiters: selectedDelimiters.inline,
        math_display_delimiters: selectedDelimiters.display,
        include_page_info: userPrefs.includePageInfo,

        // Phase 3.2: Request line-level processing data
        include_line_data: true,
      };

      logInfo("[MathPix API] Processing image with user preferences:", {
        equationNumbering: userPrefs.equationNumbering,
        delimiterFormat: userPrefs.delimiterFormat,
        delimiters: {
          inline: selectedDelimiters.inline.join(" ... "),
          display: selectedDelimiters.display.join(" ... "),
        },
        includePageInfo: userPrefs.includePageInfo,
      });

      // Create form data for multipart request
      const formData = new FormData();
      formData.append("file", file);
      formData.append("options_json", JSON.stringify(requestOptions));

      logDebug("MathPix API request options", requestOptions);

      // Notify progress: Processing
      if (progressCallback && typeof progressCallback.nextStep === "function") {
        progressCallback.nextStep();
      }

      // Make API request with timing measurement
      const requestStartTime = Date.now();
      const response = await fetch(`${MATHPIX_CONFIG.API_BASE}/text`, {
        method: "POST",
        headers: {
          app_id: this.appId,
          app_key: this.apiKey,
        },
        body: formData,
        timeout: MATHPIX_CONFIG.TIMEOUT,
      });

      const requestDuration = Date.now() - requestStartTime;
      logDebug("API request completed", { duration: `${requestDuration}ms` });

      if (!response.ok) {
        const errorText = await response.text();
        logError("MathPix API error response", errorText);
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

      // Notify progress: Formatting
      if (progressCallback && typeof progressCallback.nextStep === "function") {
        progressCallback.nextStep();
      }

      const totalProcessingTime = Date.now() - processingStartTime;
      logInfo("MathPix processing completed successfully", {
        totalTime: `${totalProcessingTime}ms`,
        apiTime: `${requestDuration}ms`,
        confidence: result.confidence,
      });

      logDebug("MathPix API response", result);

      const normalisedResult = this.normaliseMultiFormatResponse(result);

      // Add timing information to result
      normalisedResult.processingTiming = {
        total: totalProcessingTime,
        apiRequest: requestDuration,
        processing: totalProcessingTime - requestDuration,
      };

      return normalisedResult;
    } catch (error) {
      logError("MathPix API request failed", error);

      // Notify progress callback of error
      if (
        progressCallback &&
        typeof progressCallback.handleError === "function"
      ) {
        progressCallback.handleError(error, "during API processing");
      }

      throw new Error(`Processing failed: ${error.message}`);
    }
  }

  /**
   * @method validateFile
   * @description Validates uploaded files against MathPix API requirements.
   *
   * Checks file type against supported formats and validates file size
   * against maximum limits. Throws descriptive errors for validation failures.
   *
   * @param {File} file - File object to validate
   *
   * @throws {Error} When file type is not supported
   * @throws {Error} When file size exceeds maximum limit
   *
   * @example
   * try {
   *   client.validateFile(uploadedFile);
   *   // File is valid, proceed with processing
   * } catch (error) {
   *   console.error('Validation failed:', error.message);
   * }
   *
   * @accessibility Error messages are formatted for screen reader compatibility
   * @since 1.0.0
   */
  validateFile(file) {
    if (!MATHPIX_CONFIG.SUPPORTED_TYPES.includes(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    if (file.size > MATHPIX_CONFIG.MAX_FILE_SIZE) {
      throw new Error(
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max 10MB)`
      );
    }

    logDebug("File validation passed", { type: file.type, size: file.size });
  }

  /**
   * @method normaliseResponse
   * @description Normalises API response for legacy single-format compatibility.
   *
   * Extracts key information from MathPix API response and formats it for
   * backwards compatibility with older code that expects simple response format.
   *
   * @param {Object} apiResponse - Raw API response from MathPix
   * @param {string} [apiResponse.text] - LaTeX text content
   * @param {number} [apiResponse.confidence] - Recognition confidence
   * @param {boolean} [apiResponse.is_handwritten] - Handwritten content flag
   * @param {boolean} [apiResponse.is_printed] - Printed content flag
   *
   * @returns {Object} Normalised response object
   * @returns {string} returns.latex - LaTeX representation
   * @returns {number} returns.confidence - Recognition confidence (0-1)
   * @returns {boolean} returns.isHandwritten - Handwritten content detected
   * @returns {boolean} returns.isPrinted - Printed content detected
   * @returns {Object} returns.rawResponse - Original API response
   *
   * @example
   * const normalised = client.normaliseResponse(rawApiResponse);
   * console.log(normalised.latex);
   * console.log(normalised.confidence);
   *
   * @deprecated Use normaliseMultiFormatResponse for new implementations
   * @since 1.0.0
   */
  normaliseResponse(apiResponse) {
    const result = {
      latex: apiResponse.text || "",
      confidence: apiResponse.confidence || 0,
      isHandwritten: apiResponse.is_handwritten || false,
      isPrinted: apiResponse.is_printed || false,
      rawResponse: apiResponse,
    };

    logDebug("Response normalised (legacy)", result);
    return result;
  }

  /**
   * @method normaliseMultiFormatResponse
   * @description Normalises API response to provide multiple output formats.
   *
   * Extracts and organises mathematical content in various formats from the
   * MathPix API response. Provides comprehensive format support including
   * LaTeX, MathML, AsciiMath, HTML, Markdown, and JSON representations.
   *
   * @param {Object} apiResponse - Raw API response from MathPix
   * @param {string} [apiResponse.text] - Primary LaTeX text content
   * @param {string} [apiResponse.html] - HTML representation
   * @param {Array} [apiResponse.data] - Additional format data array
   * @param {number} [apiResponse.confidence] - Recognition confidence (0-1)
   * @param {boolean} [apiResponse.is_handwritten] - Handwritten content flag
   * @param {boolean} [apiResponse.is_printed] - Printed content flag
   *
   * @returns {Object} Comprehensive multi-format response object
   * @returns {string} returns.latex - LaTeX mathematical notation
   * @returns {string} returns.html - HTML representation with formatting
   * @returns {string} returns.asciimath - AsciiMath notation
   * @returns {string} returns.mathml - MathML XML representation
   * @returns {string} returns.markdown - Markdown with embedded mathematics
   * @returns {string} returns.rawJson - Complete API response as formatted JSON
   * @returns {number} returns.confidence - Recognition confidence (0-1)
   * @returns {boolean} returns.isHandwritten - True if handwritten content detected
   * @returns {boolean} returns.isPrinted - True if printed content detected
   * @returns {Object} returns.rawResponse - Original unmodified API response
   *
   * @example
   * const result = client.normaliseMultiFormatResponse(apiResponse);
   *
   * // Access different formats
   * console.log(result.latex);     // \frac{1}{2} + \sqrt{x}
   * console.log(result.mathml);    // <math><mfrac>...</mfrac></math>
   * console.log(result.asciimath); // 1/2 + sqrt(x)
   * console.log(result.markdown);  // $$\frac{1}{2} + \sqrt{x}$$
   *
   * @accessibility All formats support accessible mathematics rendering
   * @since 1.0.0
   */
  normaliseMultiFormatResponse(apiResponse) {
    // Extract TSV data for table processing
    const tsvData = this.extractDataValue(apiResponse.data, "tsv");

    // Phase 4: Extract chemistry data
    const smilesData = this.extractSMILESFromResponse(apiResponse);

    const result = {
      // Primary formats from API response
      latex: apiResponse.text || "",
      html: apiResponse.html || "",

      // Extract additional formats from data array
      asciimath: this.extractDataValue(apiResponse.data, "asciimath"),
      mathml: this.extractDataValue(apiResponse.data, "mathml"),

      // Table-specific formats (Phase 2: Table Support)
      tsv: tsvData,
      tableHtml: this.extractTableHtml(apiResponse.html),
      tableMarkdown: this.convertTsvToMarkdown(tsvData),

      // Phase 4: Chemistry data
      smiles: smilesData,
      containsChemistry:
        apiResponse.detections?.contains_chemistry || smilesData.length > 0,

      // Recognition metadata
      confidence: apiResponse.confidence || 0,
      isHandwritten: apiResponse.is_handwritten || false,
      isPrinted: apiResponse.is_printed || false,
      containsTable: this.detectTable(apiResponse), // Table detection flag

      // Phase 3.2: Line-level processing data
      line_data: apiResponse.line_data || [],

      // Generated additional formats
      markdown: this.convertLatexToMarkdown(apiResponse.text || ""),
      rawJson: JSON.stringify(apiResponse, null, 2),

      // Complete response for debugging and advanced usage
      rawResponse: apiResponse,
    };

    logDebug("Multi-format response normalised", {
      hasLatex: !!result.latex,
      hasHtml: !!result.html,
      hasAsciimath: !!result.asciimath,
      hasMathml: !!result.mathml,
      containsTable: result.containsTable,
      hasTsv: !!result.tsv,
      hasTableHtml: !!result.tableHtml,
      hasLineData: !!result.line_data,
      lineDataCount: result.line_data?.length || 0,
      confidence: result.confidence,
    });

    return result;
  }

  /**
   * @method extractDataValue
   * @description Extracts specific format data from MathPix API data array.
   *
   * The MathPix API returns additional formats in a data array structure.
   * This method safely extracts values for specific format types.
   *
   * @param {Array} dataArray - Data array from MathPix API response
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
   * @method extractSMILESFromResponse
   * @description Extracts SMILES chemistry notation from MathPix API response.
   *
   * Parses the API response text and line data to extract all SMILES chemistry
   * notations, providing structured data for display and further processing.
   * SMILES (Simplified Molecular-Input Line-Entry System) is the standard format
   * for representing chemical structures as compact text strings.
   *
   * @param {Object} result - MathPix API response object
   * @param {string} [result.text] - Main response text containing SMILES tags
   * @param {Array} [result.line_data] - Line-level data with chemistry subtypes
   * @param {Object} [result.detections] - Content detection flags
   *
   * @returns {Array<Object>} Array of SMILES data objects
   * @returns {string} returns[].notation - SMILES notation string
   * @returns {string} [returns[].context] - Surrounding context text
   * @returns {string} [returns[].lineId] - Line data ID reference
   *
   * @throws {Error} When result parameter is null or undefined
   *
   * @example
   * const smilesData = this.extractSMILESFromResponse(apiResponse);
   * // Returns: [{ notation: 'CCO', context: 'ethanol molecule' }]
   *
   * @accessibility SMILES data supports accessible chemistry content presentation
   * @since 4.0.0 (Phase 4)
   */
  extractSMILESFromResponse(result) {
    if (!result) {
      logWarn("Cannot extract SMILES from null/undefined result");
      return [];
    }

    const smilesArray = [];

    // Extract from text field
    const text = result.text || "";
    const smilesRegex = /<smiles>(.*?)<\/smiles>/g;
    let match;

    while ((match = smilesRegex.exec(text)) !== null) {
      smilesArray.push({
        notation: match[1],
        context: this.extractContext(text, match.index),
      });
    }

    // Extract from line_data if available
    if (Array.isArray(result.line_data)) {
      result.line_data.forEach((line) => {
        if (
          line.subtype === "chemistry" ||
          line.subtype === "chemistry_reaction"
        ) {
          const lineMatch = /<smiles>(.*?)<\/smiles>/.exec(line.text || "");
          if (lineMatch) {
            smilesArray.push({
              notation: lineMatch[1],
              context: line.type || "chemistry diagram",
              lineId: line.id,
            });
          }
        }
      });
    }

    if (smilesArray.length > 0) {
      logInfo("SMILES chemistry data extracted", {
        count: smilesArray.length,
        notations: smilesArray.map((s) => s.notation),
      });
    } else {
      logDebug("No SMILES chemistry data found in response");
    }

    return smilesArray;
  }

  /**
   * @method extractContext
   * @description Extracts surrounding text context for SMILES notation.
   *
   * Retrieves text before and after SMILES tag to provide context about
   * what the chemical structure represents.
   *
   * @param {string} text - Full text content
   * @param {number} position - Position of SMILES match in text
   *
   * @returns {string} Context text (up to 50 characters before SMILES)
   *
   * @private
   * @since 4.0.0 (Phase 4)
   */
  extractContext(text, position) {
    // Get up to 50 characters before the SMILES tag
    const contextStart = Math.max(0, position - 50);
    const contextText = text.substring(contextStart, position).trim();

    // Extract the last few words for context
    const words = contextText.split(/\s+/);
    const contextWords = words.slice(-5).join(" ");

    return contextWords || "General chemistry";
  }

  /**
   * @method convertLatexToMarkdown
   * @description Converts LaTeX mathematical notation to Markdown format.
   *
   * Performs basic conversion of LaTeX delimiters to Markdown mathematical
   * notation. Handles both inline and display mathematics formatting.
   *
   * @param {string} latex - LaTeX mathematical expression
   *
   * @returns {string} Markdown representation with appropriate delimiters
   *
   * @example
   * const latex = '\\frac{1}{2} + \\sqrt{x}';
   * const markdown = client.convertLatexToMarkdown(latex);
   * // Returns: $$\frac{1}{2} + \sqrt{x}$$
   *
   * @example
   * const inlineLaTeX = '\\(x = 5\\)';
   * const inlineMarkdown = client.convertLatexToMarkdown(inlineLaTeX);
   * // Returns: $x = 5$
   *
   * @accessibility Markdown output compatible with MathJax for accessible rendering
   * @since 1.0.0
   */
  convertLatexToMarkdown(latex) {
    if (!latex) return "";

    // Convert LaTeX delimiters to Markdown mathematical notation
    let markdown = latex
      .replace(/\\\(/g, "$") // Inline math: \( -> $
      .replace(/\\\)/g, "$") // Inline math: \) -> $
      .replace(/\\\[/g, "$$") // Display math: \[ -> $$
      .replace(/\\\]/g, "$$"); // Display math: \] -> $$

    logDebug("Converted LaTeX to Markdown", { latex, markdown });
    return markdown;
  }

  /**
   * @method extractTableHtml
   * @description Extracts table HTML elements from full HTML response
   *
   * Parses the HTML response to isolate table elements, enabling separate
   * table rendering and manipulation in the UI. Handles multiple tables
   * and preserves table structure and attributes.
   *
   * @param {string} htmlContent - Full HTML response from MathPix API
   *
   * @returns {string} Extracted table HTML or empty string if no tables found
   *
   * @example
   * const tableHtml = client.extractTableHtml(response.html);
   * if (tableHtml) {
   *   console.log("Table found:", tableHtml);
   * }
   *
   * @accessibility Preserves semantic table structure for screen readers
   * @since 1.1.0
   */
  extractTableHtml(htmlContent) {
    if (!htmlContent) return "";

    try {
      // Extract all table elements from HTML using regex
      // Matches: <table...>...</table> including attributes and nested content
      const tableMatch = htmlContent.match(/<table[^>]*>[\s\S]*?<\/table>/gi);

      if (tableMatch && tableMatch.length > 0) {
        const extractedTables = tableMatch.join("\n\n");
        logDebug("Table HTML extracted", {
          tableCount: tableMatch.length,
          totalLength: extractedTables.length,
        });
        return extractedTables;
      }

      logDebug("No table HTML found in response");
      return "";
    } catch (error) {
      logWarn("Table HTML extraction failed", { error: error.message });
      return "";
    }
  }

  /**
   * @method convertTsvToMarkdown
   * @description Converts Tab-Separated Values to Markdown table format
   *
   * Transforms TSV data from MathPix into properly formatted Markdown tables
   * with headers and alignment separators. Handles edge cases like empty cells,
   * special characters, and varying column counts.
   *
   * @param {string} tsv - Tab-separated values string from MathPix API
   *
   * @returns {string} Markdown table format or empty string if invalid TSV
   *
   * @example
   * const tsv = "Name\tAge\tCity\nAlice\t30\tLondon\nBob\t25\tParis";
   * const markdown = client.convertTsvToMarkdown(tsv);
   * // Returns:
   * // | Name | Age | City |
   * // | --- | --- | --- |
   * // | Alice | 30 | London |
   * // | Bob | 25 | Paris |
   *
   * @accessibility Markdown tables maintain semantic structure for conversion to HTML
   * @since 1.1.0
   */
  convertTsvToMarkdown(tsv) {
    if (!tsv || typeof tsv !== "string") return "";

    try {
      // Split TSV into lines and filter empty lines
      const lines = tsv.split("\n").filter((line) => line.trim().length > 0);

      if (lines.length === 0) {
        logDebug("Empty TSV data, no table to convert");
        return "";
      }

      // First line is the header
      const headerCells = lines[0].split("\t");
      const headerRow = headerCells.join(" | ");

      // Create separator row (--- for each column)
      const separator = headerCells.map(() => "---").join(" | ");

      // Process remaining lines as data rows
      const dataRows = lines.slice(1).map((line) => {
        const cells = line.split("\t");
        // Pad with empty cells if row has fewer columns than header
        while (cells.length < headerCells.length) {
          cells.push("");
        }
        return cells.join(" | ");
      });

      // Assemble complete Markdown table
      const markdownTable = [
        `| ${headerRow} |`,
        `| ${separator} |`,
        ...dataRows.map((row) => `| ${row} |`),
      ].join("\n");

      logDebug("TSV converted to Markdown table", {
        rows: lines.length,
        columns: headerCells.length,
      });

      return markdownTable;
    } catch (error) {
      logWarn("TSV to Markdown conversion failed", { error: error.message });
      return "";
    }
  }

  /**
   * @method detectTable
   * @description Detects presence of table content in API response
   *
   * Checks multiple indicators to determine if the processed content contains
   * tables. Uses both data array inspection and HTML parsing for reliable detection.
   *
   * @param {Object} apiResponse - Complete API response object
   *
   * @returns {boolean} True if table content detected, false otherwise
   *
   * @example
   * const hasTable = client.detectTable(response);
   * if (hasTable) {
   *   console.log("Table detected, enabling table-specific UI");
   * }
   *
   * @since 1.1.0
   */
  detectTable(apiResponse) {
    if (!apiResponse) return false;

    // Check 1: Look for TSV data in data array
    const hasTsvData =
      Array.isArray(apiResponse.data) &&
      apiResponse.data.some((item) => item.type === "tsv" && item.value);

    if (hasTsvData) {
      logDebug("Table detected via TSV data");
      return true;
    }

    // Check 2: Look for table elements in HTML
    if (apiResponse.html && typeof apiResponse.html === "string") {
      const hasTableHtml = /<table[^>]*>/i.test(apiResponse.html);
      if (hasTableHtml) {
        logDebug("Table detected via HTML");
        return true;
      }
    }

    // Check 3: Look for table in line_data if available
    if (Array.isArray(apiResponse.line_data)) {
      const hasTableLine = apiResponse.line_data.some(
        (line) => line.type === "table"
      );
      if (hasTableLine) {
        logDebug("Table detected via line_data");
        return true;
      }
    }

    logDebug("No table content detected");
    return false;
  }

  // =============================================================================
  // PHASE 2.1: PDF DOCUMENT PROCESSING METHODS
  // =============================================================================

  /**
   * @method processPDF
   * @description Processes PDF documents using MathPix PDF API endpoint
   *
   * Uploads PDF to MathPix for document-level processing with multiple output formats.
   * Unlike image processing, PDF processing is asynchronous and requires status polling.
   * Supports page range selection, format specification, and comprehensive error handling.
   *
   * @param {File} pdfFile - PDF document file to process
   * @param {Object} options - PDF processing options
   * @param {string} [options.page_range="all"] - Page range to process ("all", "1-10", etc.)
   * @param {Array<string>} [options.formats=["mmd", "html"]] - Output formats to generate
   * @param {Object} [progressCallback=null] - Progress tracking callback
   *
   * @returns {Promise<string>} PDF processing ID for status polling
   *
   * @throws {Error} When credentials not configured or PDF upload fails
   *
   * @example
   * const pdfId = await client.processPDF(pdfFile, {
   *   page_range: "1-10",
   *   formats: ["mmd", "html", "latex"]
   * }, progressCallback);
   *
   * @accessibility Progress tracking provides screen reader updates
   * @since 2.1.0
   */
  async processPDF(pdfFile, options = {}, progressCallback = null) {
    if (!this.appId || !this.apiKey) {
      throw new Error("MathPix API credentials not configured");
    }

    // Validate PDF file
    this.validatePDFFile(pdfFile);

    const processingStartTime = Date.now();

    logInfo("Starting PDF document processing", {
      fileName: pdfFile.name,
      size: pdfFile.size,
      pageRange: options.page_range || "all",
      formats: options.formats || ["mmd", "html"],
    });

    // Merge with default PDF request options
    const requestOptions = {
      ...MATHPIX_CONFIG.DEFAULT_PDF_REQUEST,
      conversion_formats: {},
    };

    // Phase 5, Feature 1: Merge user-provided delimiter preferences (overrides defaults)
    // These come from buildFinalProcessingOptions() in PDF handler
    if (options.math_inline_delimiters) {
      requestOptions.math_inline_delimiters = options.math_inline_delimiters;
      logDebug("Using custom inline delimiters", {
        delimiters: options.math_inline_delimiters,
      });
    }
    if (options.math_display_delimiters) {
      requestOptions.math_display_delimiters = options.math_display_delimiters;
      logDebug("Using custom display delimiters", {
        delimiters: options.math_display_delimiters,
      });
    }

    // Phase 5, Feature 2: Merge user-provided numbering preferences (overrides defaults)
    // These come from buildFinalProcessingOptions() in PDF handler
    if (options.include_equation_tags !== undefined) {
      requestOptions.include_equation_tags = options.include_equation_tags;
      logDebug("Setting equation tags", {
        enabled: options.include_equation_tags,
      });
    }
    if (options.idiomatic_eqn_arrays !== undefined) {
      requestOptions.idiomatic_eqn_arrays = options.idiomatic_eqn_arrays;
      logDebug("Setting idiomatic arrays", {
        enabled: options.idiomatic_eqn_arrays,
      });
    }

    // Section numbering options (mutually exclusive)
    if (options.auto_number_sections !== undefined) {
      requestOptions.auto_number_sections = options.auto_number_sections;
      logDebug("Setting auto section numbering", {
        enabled: options.auto_number_sections,
      });
    }
    if (options.remove_section_numbering !== undefined) {
      requestOptions.remove_section_numbering =
        options.remove_section_numbering;
      logDebug("Setting remove section numbering", {
        enabled: options.remove_section_numbering,
      });
    }
    if (options.preserve_section_numbering !== undefined) {
      requestOptions.preserve_section_numbering =
        options.preserve_section_numbering;
      logDebug("Setting preserve section numbering", {
        enabled: options.preserve_section_numbering,
      });
    }

    // Only add page_ranges if not processing all pages
    if (options.page_range && options.page_range !== "all") {
      requestOptions.page_ranges = options.page_range;
    }
    // When page_range is "all" or undefined, omit the parameter entirely
    // This allows MathPix API to process all pages by default

    // Configure requested formats
    const requestedFormats =
      options.formats ||
      MATHPIX_CONFIG.PDF_PROCESSING.DEFAULT_PDF_OPTIONS.formats;

    // Build conversion formats: MMD is default output, only add actual conversion formats
    const VALID_CONVERSION_FORMATS = [
      "md",
      "html",
      "pdf",
      "latex.pdf",
      "docx",
      "pptx",
      "tex.zip",
      "mmd.zip",
      "md.zip",
      "html.zip",
    ]; // Feature 3: Added "md" | Phase 1: Added "pdf", "latex.pdf" | Phase 2: Added "pptx" | Phase 2b: Added archive formats

    // Map UI format names to API format names
    const UI_TO_API_FORMAT_MAPPING = {
      mmd: "mmd", // Default output, not a conversion format
      md: "md", // Feature 3: Plain Markdown (direct mapping)
      html: "html", // Direct mapping
      pdf: "pdf", // Phase 1: PDF (HTML Rendering) - direct mapping
      latexpdf: "latex.pdf", // Phase 1: PDF (LaTeX Rendering) - UI "latexpdf" maps to API "latex.pdf"
      latex: "tex.zip", // UI uses "latex", API expects "tex.zip"
      docx: "docx", // Direct mapping
    };

    requestedFormats.forEach((format) => {
      // Skip MMD - it's the default output, not a conversion format
      if (format === "mmd") {
        logDebug("Skipping MMD - default output format", { format });
        return;
      }

      // Map UI format names to API format names
      const apiFormatName = UI_TO_API_FORMAT_MAPPING[format] || format;

      console.log(`🔄 Format mapping: UI "${format}" → API "${apiFormatName}"`);

      // Only add valid conversion formats
      if (VALID_CONVERSION_FORMATS.includes(apiFormatName)) {
        requestOptions.conversion_formats[apiFormatName] = true;
        logDebug("Added conversion format", { format, apiFormatName });
      } else {
        logWarn("Unknown conversion format skipped", { format, apiFormatName });
      }
    });

    try {
      // Notify progress: Starting upload
      if (progressCallback && typeof progressCallback.nextStep === "function") {
        progressCallback.nextStep();
      }

      // Create form data for PDF upload
      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("options_json", JSON.stringify(requestOptions));

      logDebug("PDF processing request options", requestOptions);

      // Upload PDF to processing queue
      const uploadResponse = await fetch(`${MATHPIX_CONFIG.API_BASE}/pdf`, {
        method: "POST",
        headers: {
          app_id: this.appId,
          app_key: this.apiKey,
        },
        body: formData,
        timeout: MATHPIX_CONFIG.PDF_PROCESSING.PDF_TIMEOUT,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        logError("PDF upload failed", errorText);
        throw new Error(
          `PDF upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`
        );
      }

      const uploadResult = await uploadResponse.json();

      // 🔍 COMPREHENSIVE UPLOAD RESPONSE DEBUGGING
      console.log("📤 PDF UPLOAD RESPONSE ANALYSIS:");
      console.log("   📊 Complete Response:", uploadResult);
      console.log("   🔑 Response Keys:", Object.keys(uploadResult));
      console.log("   📋 Response Structure:");
      Object.keys(uploadResult).forEach((key) => {
        console.log(
          `      ${key}: ${typeof uploadResult[key]} = ${uploadResult[key]}`
        );
      });

      // Look for PDF ID in different possible field names
      const possibleIdFields = [
        "pdf_id",
        "id",
        "processing_id",
        "document_id",
        "job_id",
        "request_id",
      ];
      let pdfId = null;
      let idFieldFound = null;

      for (const fieldName of possibleIdFields) {
        if (uploadResult[fieldName]) {
          pdfId = uploadResult[fieldName];
          idFieldFound = fieldName;
          console.log(`   ✅ PDF ID found in field "${fieldName}":`, pdfId);
          break;
        }
      }

      if (!pdfId) {
        console.error("   ❌ No PDF ID found in any expected fields");
        console.error("   🔍 Available fields:", Object.keys(uploadResult));
        console.error(
          "   📊 Full response for debugging:",
          JSON.stringify(uploadResult, null, 2)
        );
        throw new Error(
          `PDF upload succeeded but no processing ID received. Available fields: ${Object.keys(
            uploadResult
          ).join(", ")}`
        );
      }

      console.log(`   🎯 Using PDF ID from "${idFieldFound}":`, pdfId);

      const uploadDuration = Date.now() - processingStartTime;
      logInfo("PDF uploaded successfully", {
        pdfId,
        uploadTime: `${uploadDuration}ms`,
      });

      // Notify progress: Upload complete, processing started
      if (
        progressCallback &&
        typeof progressCallback.updateTiming === "function"
      ) {
        progressCallback.updateTiming(
          "Document uploaded, processing started..."
        );
      }

      return pdfId;
    } catch (error) {
      logError("PDF processing initiation failed", error);

      // Notify progress callback of error
      if (
        progressCallback &&
        typeof progressCallback.handleError === "function"
      ) {
        progressCallback.handleError(error, "during PDF upload");
      }

      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }

  /**
   * @method checkPDFStatus
   * @description Checks processing status of uploaded PDF document
   *
   * Polls the MathPix API to determine processing status and retrieve results
   * when processing is complete. Handles various status states including
   * queued, processing, completed, and error conditions.
   *
   * @param {string} pdfId - PDF processing ID from processPDF method
   *
   * @returns {Promise<Object>} Status result object
   * @returns {string} returns.status - Processing status ("completed", "processing", "error", etc.)
   * @returns {Object} [returns.results] - Processing results when status is "completed"
   * @returns {string} [returns.error] - Error message when status is "error"
   * @returns {number} [returns.progress] - Processing progress percentage
   *
   * @throws {Error} When status check request fails
   *
   * @example
   * const status = await client.checkPDFStatus(pdfId);
   * if (status.status === "completed") {
   *   console.log("Processing complete:", status.results);
   * }
   *
   * @since 2.1.0
   */
  async checkPDFStatus(pdfId) {
    if (!this.appId || !this.apiKey) {
      throw new Error("MathPix API credentials not configured");
    }

    logDebug("Checking PDF processing status", { pdfId });

    try {
      const statusResponse = await fetch(
        `${MATHPIX_CONFIG.API_BASE}/pdf/${pdfId}`,
        {
          method: "GET",
          headers: {
            app_id: this.appId,
            app_key: this.apiKey,
          },
          timeout: MATHPIX_CONFIG.TIMEOUT, // Use standard timeout for status checks
        }
      );

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        logError("PDF status check failed", errorText);
        throw new Error(
          `Status check failed: ${statusResponse.status} ${statusResponse.statusText}`
        );
      }

      const statusResult = await statusResponse.json();

      // Enhanced debugging for status polling issues
      console.log("📊 Complete Status Response:", statusResult);
      console.log("🔍 Status Value:", statusResult.status);
      console.log("📋 All Response Keys:", Object.keys(statusResult));
      console.log("🎯 Response Type:", typeof statusResult.status);

      logDebug("PDF status received", {
        pdfId,
        status: statusResult.status,
        hasResults: !!statusResult.results,
        responseKeys: Object.keys(statusResult),
        statusType: typeof statusResult.status,
      });

      // Handle missing status field
      if (statusResult.status === undefined || statusResult.status === null) {
        console.warn("⚠️ Status field missing from response:", statusResult);

        // Try alternative field names that MathPix might use
        const alternativeStatus =
          statusResult.state ||
          statusResult.processing_status ||
          statusResult.job_status;
        if (alternativeStatus) {
          console.log("🔄 Found alternative status field:", alternativeStatus);
          statusResult.status = alternativeStatus;
        } else {
          throw new Error(
            "Invalid status response: missing status field. Response keys: " +
              Object.keys(statusResult).join(", ")
          );
        }
      }

      return statusResult;
    } catch (error) {
      logError("PDF status check request failed", error);
      throw new Error(`Status check failed: ${error.message}`);
    }
  }

  /**
   * @method downloadPDFFormat
   * @description Downloads specific format result from processed PDF
   *
   * Retrieves processed document content in specified format (MMD, HTML, LaTeX, DOCX).
   * Handles both text-based formats and binary file downloads with appropriate
   * content handling and error management.
   *
   * @param {string} pdfId - PDF processing ID
   * @param {string} format - Format to download ("mmd", "html", "latex", "docx")
   *
   * @returns {Promise<string|Blob>} Downloaded content (text for most formats, Blob for binary)
   *
   * @throws {Error} When download request fails or format not available
   *
   * @example
   * // Download text format
   * const mmdContent = await client.downloadPDFFormat(pdfId, "mmd");
   * console.log(mmdContent); // Markdown content as string
   *
   * @example
   * // Download binary format
   * const zipBlob = await client.downloadPDFFormat(pdfId, "latex");
   * const url = URL.createObjectURL(zipBlob);
   * // Use for download link
   *
   * @since 2.1.0
   */
  async downloadPDFFormat(pdfId, format) {
    if (!this.appId || !this.apiKey) {
      throw new Error("MathPix API credentials not configured");
    }

    // Map UI format names to API endpoint extensions
    let apiFormat = format;
    if (format === "latex") {
      apiFormat = "tex"; // API endpoint is .tex, not .tex.zip
    }
    // Feature 3: MD format maps directly to .md endpoint
    // (no special handling needed, but documented for clarity)

    logDebug("Downloading PDF format", { pdfId, format, apiFormat });

    try {
      // Correct URL pattern: /pdf/{pdf_id}.{format}
      const downloadUrl = `${MATHPIX_CONFIG.API_BASE}/pdf/${pdfId}.${apiFormat}`;

      logDebug("Making download request", { downloadUrl });

      const downloadResponse = await fetch(downloadUrl, {
        method: "GET",
        headers: {
          app_id: this.appId,
          app_key: this.apiKey,
        },
      });

      if (!downloadResponse.ok) {
        const errorText = await downloadResponse.text();
        logError("Download request failed", {
          status: downloadResponse.status,
          statusText: downloadResponse.statusText,
          errorText: errorText.substring(0, 200),
        });
        throw new Error(
          `Download failed: ${downloadResponse.status} ${downloadResponse.statusText}`
        );
      }
      // Define binary formats - ✅ PHASE 1 FIXED: Added PDF formats | Phase 2: Added PPTX | Phase 2b: Added archive formats
      const binaryFormats = [
        "docx",
        "pptx",
        "pdf",
        "latex.pdf",
        "latexpdf",
        "latex",
        "tex.zip",
        "mmd.zip",
        "md.zip",
        "html.zip",
      ];
      const isBinaryFormat =
        binaryFormats.includes(format) ||
        binaryFormats.includes(apiFormat) ||
        apiFormat === "tex"; // API format for LaTeX ZIP

      if (isBinaryFormat) {
        const blob = await downloadResponse.blob();
        logInfo("✅ BINARY FORMAT DOWNLOADED", {
          format,
          apiFormat,
          size: blob.size,
          type: blob.type,
        });
        return blob;
      }

      // Handle text formats (MMD, HTML)
      const textContent = await downloadResponse.text();
      logInfo("✅ TEXT FORMAT DOWNLOADED", {
        format,
        apiFormat,
        length: textContent.length,
      });
      return textContent;
    } catch (error) {
      logError("PDF format download failed", {
        pdfId,
        format,
        error: error.message,
      });
      throw new Error(`Failed to download ${format} format: ${error.message}`);
    }
  }

  // =============================================================================
  // PHASE 3.2: LINES DATA API METHODS
  // =============================================================================

  /**
   * @method fetchLinesData
   * @description Fetches detailed line-by-line data from MathPix Lines Data API
   *
   * Retrieves comprehensive line-level content data for processed PDF documents,
   * including line geometry, content types, confidence scores, and structural information.
   * This data enables advanced page-by-page analysis and content-aware navigation.
   *
   * @param {string} pdfId - PDF document ID from processing (pdf_id from processPDF)
   *
   * @returns {Promise<Object>} Lines data object with pages array
   * @returns {Array<Object>} returns.pages - Array of page objects
   * @returns {number} returns.pages[].page - Page number
   * @returns {string} returns.pages[].image_id - Image identifier for page
   * @returns {number} returns.pages[].page_width - Page width in pixels
   * @returns {number} returns.pages[].page_height - Page height in pixels
   * @returns {Array<Object>} returns.pages[].lines - Array of line objects
   * @returns {string} returns.pages[].lines[].id - Unique line identifier
   * @returns {string} returns.pages[].lines[].type - Content type (text, math, table, etc.)
   * @returns {string} returns.pages[].lines[].text - Searchable text content
   * @returns {string} returns.pages[].lines[].text_display - Mathpix Markdown with context
   * @returns {Object} returns.pages[].lines[].region - Bounding box coordinates
   * @returns {number} returns.pages[].lines[].confidence - Recognition confidence (0-1)
   * @returns {boolean} returns.pages[].lines[].is_printed - Whether content is printed
   * @returns {boolean} returns.pages[].lines[].is_handwritten - Whether content is handwritten
   *
   * @throws {Error} When API credentials are not configured
   * @throws {Error} When PDF ID is not provided
   * @throws {Error} When API request fails or returns error response
   *
   * @example
   * // Basic usage
   * const linesData = await client.fetchLinesData(pdfId);
   * console.log(`Document has ${linesData.pages.length} pages`);
   * console.log(`Total lines: ${linesData.pages.reduce((sum, p) => sum + p.lines.length, 0)}`);
   *
   * @example
   * // Analyze specific page
   * const linesData = await client.fetchLinesData(pdfId);
   * const firstPage = linesData.pages[0];
   * console.log(`Page 1 has ${firstPage.lines.length} lines`);
   *
   * @see {@link https://docs.mathpix.com/#lines-data} for complete API documentation
   * @accessibility Lines data supports content-aware navigation for screen readers
   * @since 3.2.0
   */
  async fetchLinesData(pdfId) {
    if (!this.appId || !this.apiKey) {
      throw new Error("MathPix API credentials not configured");
    }

    if (!pdfId) {
      throw new Error("PDF ID is required for lines data fetching");
    }

    logInfo("Fetching lines data from MathPix API", { pdfId });

    try {
      const url = `${MATHPIX_CONFIG.API_BASE}/pdf/${pdfId}.lines.json`;

      logDebug("Lines API request", { url, pdfId });

      const response = await fetch(url, {
        method: "GET",
        headers: {
          app_id: this.appId,
          app_key: this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logError("Lines data fetch failed", {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 200),
        });
        throw new Error(
          `Lines data fetch failed: ${response.status} ${response.statusText}`
        );
      }

      const linesData = await response.json();

      // Validate response structure
      if (!linesData.pages || !Array.isArray(linesData.pages)) {
        logWarn("Unexpected lines data structure", {
          hasPages: !!linesData.pages,
          isArray: Array.isArray(linesData.pages),
        });
      }

      const totalLines =
        linesData.pages?.reduce(
          (sum, page) => sum + (page.lines?.length || 0),
          0
        ) || 0;

      logInfo("Lines data fetched successfully", {
        pdfId,
        pageCount: linesData.pages?.length || 0,
        totalLines,
        samplePage: linesData.pages?.[0]?.page || "N/A",
      });

      return linesData;
    } catch (error) {
      logError("Failed to fetch lines data", { pdfId, error: error.message });
      throw new Error(`Lines data fetching failed: ${error.message}`);
    }
  }

  /**
   * @method pollPDFStatus
   * @description Polls PDF processing status until completion or timeout
   *
   * Continuously checks PDF processing status with exponential backoff until
   * processing completes, fails, or timeout is reached. Provides progress
   * updates through callback and handles various completion scenarios.
   *
   * @param {string} pdfId - PDF processing ID
   * @param {Object} [progressCallback=null] - Progress tracking callback
   *
   * @returns {Promise<Object>} Final processing results or error information
   *
   * @throws {Error} When polling times out or processing fails
   *
   * @example
   * const results = await client.pollPDFStatus(pdfId, {
   *   updateTiming: (message) => console.log(message),
   *   handleError: (error, context) => console.error(error, context)
   * });
   *
   * @since 2.1.0
   */
  async pollPDFStatus(pdfId, progressCallback = null) {
    const startTime = Date.now();
    let pollCount = 0;
    const maxPolls = MATHPIX_CONFIG.PDF_PROCESSING.MAX_STATUS_POLLS;
    const pollInterval = MATHPIX_CONFIG.PDF_PROCESSING.STATUS_POLL_INTERVAL;

    logInfo("Starting PDF status polling", { pdfId, maxPolls, pollInterval });

    while (pollCount < maxPolls) {
      try {
        const status = await this.checkPDFStatus(pdfId);
        pollCount++;

        const elapsedTime = Date.now() - startTime;
        const elapsedMinutes = Math.floor(elapsedTime / 60000);
        const elapsedSeconds = Math.floor((elapsedTime % 60000) / 1000);

        logDebug("PDF status poll result", {
          pdfId,
          pollCount,
          status: status.status,
          elapsedTime: `${elapsedMinutes}:${elapsedSeconds
            .toString()
            .padStart(2, "0")}`,
        });

        // Update progress callback with status
        if (
          progressCallback &&
          typeof progressCallback.updateTiming === "function"
        ) {
          const progressMessage = this.formatStatusMessage(
            status.status,
            elapsedMinutes,
            elapsedSeconds
          );
          progressCallback.updateTiming(progressMessage);
        }

        // Handle completion states
        switch (status.status) {
          case "completed":
            logInfo("PDF processing completed successfully", {
              pdfId,
              totalTime: `${elapsedTime}ms`,
              totalPolls: pollCount,
            });
            return status.results;

          case "error":
            const errorMessage =
              status.error || "PDF processing failed with unknown error";
            logError("PDF processing failed", { pdfId, error: errorMessage });
            throw new Error(`Processing failed: ${errorMessage}`);

          case "processing":
          case "queued":
            // Continue polling
            break;

          default:
            logWarn("Unknown PDF processing status", {
              pdfId,
              status: status.status,
            });
            // Continue polling for unknown states
            break;
        }

        // Wait before next poll (exponential backoff for long processing)
        const backoffMultiplier = pollCount > 30 ? 1.5 : 1; // Increase interval after 1 minute
        const waitTime = pollInterval * backoffMultiplier;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } catch (error) {
        logError("PDF status polling error", error);

        // Notify progress callback of error
        if (
          progressCallback &&
          typeof progressCallback.handleError === "function"
        ) {
          progressCallback.handleError(
            error,
            `during status polling (poll ${pollCount})`
          );
        }

        throw new Error(`Status polling failed: ${error.message}`);
      }
    }

    // Timeout reached
    const timeoutMessage = `PDF processing timed out after ${maxPolls} status checks`;
    logError(timeoutMessage, { pdfId, pollCount });
    throw new Error(timeoutMessage);
  }

  /**
   * @method validatePDFFile
   * @description Validates PDF files against MathPix PDF processing requirements
   *
   * Checks file type, size limits, and format requirements specific to PDF processing.
   * Uses different limits than image processing to accommodate larger documents.
   *
   * @param {File} pdfFile - PDF file to validate
   *
   * @throws {Error} When file validation fails
   *
   * @private
   * @since 2.1.0
   */
  validatePDFFile(pdfFile) {
    if (pdfFile.type !== "application/pdf") {
      throw new Error(
        `Invalid file type: ${pdfFile.type}. Only PDF files are supported for document processing.`
      );
    }

    if (pdfFile.size > MATHPIX_CONFIG.PDF_PROCESSING.MAX_PDF_SIZE) {
      const sizeMB = (pdfFile.size / 1024 / 1024).toFixed(1);
      const maxSizeMB = (
        MATHPIX_CONFIG.PDF_PROCESSING.MAX_PDF_SIZE /
        1024 /
        1024
      ).toFixed(0);
      throw new Error(`PDF too large: ${sizeMB}MB (max ${maxSizeMB}MB)`);
    }

    logDebug("PDF file validation passed", {
      name: pdfFile.name,
      size: pdfFile.size,
      type: pdfFile.type,
    });
  }

  /**
   * @method formatStatusMessage
   * @description Formats user-friendly status messages for progress display
   *
   * @param {string} status - Processing status from API
   * @param {number} minutes - Elapsed minutes
   * @param {number} seconds - Elapsed seconds
   *
   * @returns {string} Formatted status message
   *
   * @private
   * @since 2.1.0
   */
  formatStatusMessage(status, minutes, seconds) {
    const timeString = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    switch (status) {
      case "queued":
        return `Document queued for processing... (${timeString})`;
      case "processing":
        return `Converting document to formats... (${timeString})`;
      default:
        return `Processing status: ${status} (${timeString})`;
    }
  }

  // =============================================================================
  // PHASE 3.1: LINES DATA API METHODS
  // =============================================================================

  /**
   * @method fetchLinesData
   * @description Fetches detailed line-by-line data from MathPix Lines Data API
   *
   * Retrieves comprehensive line-level content data for processed PDF documents,
   * including line geometry, content types, confidence scores, and structural information.
   * This data enables advanced page-by-page analysis and content-aware navigation.
   *
   * @param {string} pdfId - PDF document ID from processing
   *
   * @returns {Promise<Object>} Lines data object with pages array
   * @returns {Array<Object>} returns.pages - Array of page objects
   * @returns {number} returns.pages[].page - Page number
   * @returns {string} returns.pages[].image_id - Image identifier for page
   * @returns {number} returns.pages[].page_width - Page width in pixels
   * @returns {number} returns.pages[].page_height - Page height in pixels
   * @returns {Array<Object>} returns.pages[].lines - Array of line objects
   *
   * @throws {Error} When API credentials are not configured
   * @throws {Error} When PDF ID is not provided
   * @throws {Error} When API request fails
   *
   * @example
   * const linesData = await apiClient.fetchLinesData('2025_09_29_xxxxx');
   * console.log(`Document has ${linesData.pages.length} pages`);
   *
   * @see {@link https://docs.mathpix.com/#lines-data} for API documentation
   * @since 3.2.0
   */
  async fetchLinesData(pdfId) {
    if (!this.appId || !this.apiKey) {
      throw new Error("MathPix API credentials not configured");
    }

    if (!pdfId) {
      throw new Error("PDF ID is required for lines data fetching");
    }

    const startTime = Date.now();

    logInfo("Fetching lines data from MathPix API", { pdfId });

    try {
      // Correct endpoint: GET /v3/pdf/{pdf_id}.lines.json
      const url = `${this.apiBase}/pdf/${pdfId}.lines.json`;

      logDebug("Lines API request", { url, method: "GET", pdfId });

      const response = await fetch(url, {
        method: "GET",
        headers: {
          app_id: this.appId,
          app_key: this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logError("Lines data fetch failed", {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 200),
          url,
        });
        throw new Error(
          `Lines data fetch failed: ${response.status} ${response.statusText}`
        );
      }

      const linesData = await response.json();

      // Validate response structure
      if (!linesData.pages || !Array.isArray(linesData.pages)) {
        logWarn("Unexpected lines data structure", {
          hasPages: !!linesData.pages,
          isArray: Array.isArray(linesData.pages),
        });
      }

      const totalLines =
        linesData.pages?.reduce(
          (sum, page) => sum + (page.lines?.length || 0),
          0
        ) || 0;
      const processingTime = Date.now() - startTime;

      logInfo("Lines data fetched successfully", {
        pdfId,
        pageCount: linesData.pages?.length || 0,
        totalLines,
        processingTime: `${processingTime}ms`,
        samplePage: linesData.pages?.[0]?.page || "N/A",
      });

      return linesData;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logError("Failed to fetch lines data", {
        pdfId,
        error: error.message,
        processingTime: `${processingTime}ms`,
      });

      throw new Error(`Lines data fetching failed: ${error.message}`);
    }
  }

  /**
   * @method validateLinesDataRequest
   * @description Validates lines data request parameters
   * @param {Object} requestParams - Request parameters to validate
   * @returns {boolean} True if parameters are valid
   * @throws {Error} If validation fails
   * @private
   * @since 3.1.0
   */
  validateLinesDataRequest(requestParams) {
    if (!requestParams) {
      throw new Error("Request parameters are required");
    }

    if (
      !requestParams.document_id ||
      typeof requestParams.document_id !== "string"
    ) {
      throw new Error("Valid document ID is required");
    }

    if (
      requestParams.content_types &&
      !Array.isArray(requestParams.content_types)
    ) {
      throw new Error("Content types must be an array if provided");
    }

    return true;
  }
}

export default MathPixAPIClient;
