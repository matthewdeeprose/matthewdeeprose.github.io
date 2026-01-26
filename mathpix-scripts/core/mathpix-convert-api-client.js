/**
 * @fileoverview MathPix Convert API Client
 * @module MathPixConvertAPIClient
 * @requires mathpix-config.js
 * @author MathPix Development Team
 * @version 1.0.0
 * @since 6.1.0
 *
 * @description
 * Standalone JavaScript module providing programmatic access to the MathPix Convert API
 * (/v3/converter). Enables conversion of MMD (Mathpix Markdown) content to various
 * document formats including DOCX, PDF, LaTeX, HTML, and PowerPoint.
 *
 * Key Features:
 * - Asynchronous conversion workflow with status polling
 * - Support for 7 output formats with configurable options
 * - Comprehensive error handling with classification
 * - Progress callbacks for UI integration
 * - Cancellation support for active conversions
 * - British English defaults and messaging
 *
 * Integration:
 * - Uses existing credential management from MATHPIX_CONFIG
 * - Compatible with existing notification systems
 * - Singleton pattern for consistent state management
 * - Global exposure for console testing
 *
 * Usage:
 * ```javascript
 * const client = getMathPixConvertClient();
 * const blobs = await client.convertAndDownload(mmdContent, ['docx', 'pdf']);
 * ```
 *
 * @accessibility
 * - All error messages designed for screen reader compatibility
 * - Progress callbacks enable accessible progress announcements
 * - Status updates provide clear conversion state information
 */

console.log("🔵 Convert API Client: Module executing...");

// ============================================================================
// Logging Configuration
// ============================================================================
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

/**
 * Determines if a message should be logged based on current logging configuration
 * @param {number} level - The log level to check
 * @returns {boolean} True if the message should be logged
 */
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

/**
 * Logs error messages with module prefix
 * @param {string} message - The error message
 * @param {...any} args - Additional arguments
 */
function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR))
    console.error(`[ConvertAPI] ${message}`, ...args);
}

/**
 * Logs warning messages with module prefix
 * @param {string} message - The warning message
 * @param {...any} args - Additional arguments
 */
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[ConvertAPI] ${message}`, ...args);
}

/**
 * Logs informational messages with module prefix
 * @param {string} message - The info message
 * @param {...any} args - Additional arguments
 */
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[ConvertAPI] ${message}`, ...args);
}

/**
 * Logs debug messages with module prefix
 * @param {string} message - The debug message
 * @param {...any} args - Additional arguments
 */
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[ConvertAPI] ${message}`, ...args);
}

// ============================================================================
// Error Definitions
// ============================================================================

/**
 * Error type definitions for Convert API operations
 * @constant {Object}
 * @description Each error type includes:
 * - code: Unique identifier for programmatic handling
 * - message: User-friendly message template (supports {placeholder} substitution)
 * - recoverable: Whether the operation can be retried
 */
const CONVERT_ERRORS = {
  INVALID_MMD: {
    code: "INVALID_MMD",
    message: "MMD content is invalid or empty",
    recoverable: false,
  },
  MMD_TOO_LARGE: {
    code: "MMD_TOO_LARGE",
    message: "MMD content exceeds 10MB limit ({sizeBytes} bytes provided)",
    recoverable: false,
  },
  INVALID_FORMAT: {
    code: "INVALID_FORMAT",
    message: 'Unsupported format: "{format}"',
    recoverable: false,
  },
  NO_FORMATS: {
    code: "NO_FORMATS",
    message: "No valid formats specified for conversion",
    recoverable: false,
  },
  API_ERROR: {
    code: "API_ERROR",
    message: "MathPix API returned an error: {details}",
    recoverable: true,
  },
  TIMEOUT: {
    code: "TIMEOUT",
    message: "Conversion timed out after {seconds} seconds",
    recoverable: true,
  },
  FORMAT_ERROR: {
    code: "FORMAT_ERROR",
    message: "Failed to convert to {format}: {error}",
    recoverable: false,
  },
  NETWORK_ERROR: {
    code: "NETWORK_ERROR",
    message: "Network connection failed: {details}",
    recoverable: true,
  },
  AUTH_ERROR: {
    code: "AUTH_ERROR",
    message: "API credentials invalid or missing",
    recoverable: false,
  },
  DOWNLOAD_ERROR: {
    code: "DOWNLOAD_ERROR",
    message: "Failed to download {format} result: {details}",
    recoverable: true,
  },
  CANCELLED: {
    code: "CANCELLED",
    message: "Conversion was cancelled",
    recoverable: false,
  },
  INVALID_CONVERSION_ID: {
    code: "INVALID_CONVERSION_ID",
    message: "Invalid or missing conversion ID",
    recoverable: false,
  },
  UNKNOWN_STATUS: {
    code: "UNKNOWN_STATUS",
    message: 'Unknown conversion status: "{status}"',
    recoverable: true,
  },
};

/**
 * Custom error class for Convert API errors
 * @class ConvertError
 * @extends Error
 * @description Provides structured error information with code, message substitution,
 * and recoverability indication for error handling workflows.
 *
 * @example
 * throw new ConvertError(CONVERT_ERRORS.MMD_TOO_LARGE, { sizeBytes: 15000000 });
 * // Error: "MMD content exceeds 10MB limit (15000000 bytes provided)"
 */
class ConvertError extends Error {
  /**
   * Creates a new ConvertError
   * @param {Object} errorType - Error type from CONVERT_ERRORS
   * @param {Object} [substitutions={}] - Values to substitute into message template
   */
  constructor(errorType, substitutions = {}) {
    let message = errorType.message;

    // Substitute placeholders in message
    Object.entries(substitutions).forEach(([key, value]) => {
      message = message.replace(`{${key}}`, value);
    });

    super(message);

    this.name = "ConvertError";
    this.code = errorType.code;
    this.recoverable = errorType.recoverable;
    this.substitutions = substitutions;
  }
}

// ============================================================================
// Main Class
// ============================================================================

/**
 * MathPix Convert API Client
 * @class MathPixConvertAPIClient
 * @description Handles conversion of MMD content to various document formats
 * via the MathPix Convert API. Provides a complete workflow from validation
 * through conversion to download.
 *
 * @example
 * const client = getMathPixConvertClient();
 *
 * // Simple conversion
 * const result = await client.convertAndDownload(mmd, ['docx', 'pdf']);
 *
 * // With progress tracking
 * const result = await client.convertAndDownload(mmd, ['docx'], {
 *   onProgress: (status) => console.log(status)
 * });
 */
class MathPixConvertAPIClient {
  /**
   * Creates a new MathPixConvertAPIClient instance
   * @constructor
   */
  constructor() {
    // Lazily cache config reference
    this.config = null;

    // Track active conversions for cancellation support
    this.activeConversions = new Map();

    logDebug("MathPixConvertAPIClient initialised");
  }

  /**
   * Gets the configuration, lazily loading from MATHPIX_CONFIG
   * @private
   * @returns {Object} Convert API configuration
   */
  _getConfig() {
    if (!this.config) {
      if (typeof MATHPIX_CONFIG === "undefined" || !MATHPIX_CONFIG.CONVERT) {
        logError("MATHPIX_CONFIG.CONVERT not available");
        throw new ConvertError(CONVERT_ERRORS.API_ERROR, {
          details: "Configuration not loaded",
        });
      }
      this.config = MATHPIX_CONFIG.CONVERT;
    }
    return this.config;
  }

  /**
   * Builds request headers using existing credential management
   * @private
   * @returns {Object} Headers object for API requests
   * @throws {ConvertError} If credentials are not available
   *
   * @description
   * Credentials are retrieved in the following priority order:
   * 1. MATHPIX_CONFIG.APP_ID / MATHPIX_CONFIG.APP_KEY (if set directly in config)
   * 2. localStorage "mathpix-app-id" / "mathpix-app-key" (UI-saved credentials)
   *
   * Note: The localStorage keys use hyphens (mathpix-app-id) to match the
   * existing UI manager pattern in mathpix-ui-manager.js
   */
  _buildHeaders() {
    // Follow existing pattern from mathpix-ui-manager.js
    // Note: localStorage keys use hyphens, not underscores
    const appId =
      (typeof MATHPIX_CONFIG !== "undefined" && MATHPIX_CONFIG.APP_ID) ||
      localStorage.getItem("mathpix-app-id");
    const appKey =
      (typeof MATHPIX_CONFIG !== "undefined" && MATHPIX_CONFIG.APP_KEY) ||
      localStorage.getItem("mathpix-app-key");

    if (!appId || !appKey) {
      logError("API credentials not configured");
      logDebug("Checked: MATHPIX_CONFIG.APP_ID, localStorage 'mathpix-app-id'");
      throw new ConvertError(CONVERT_ERRORS.AUTH_ERROR);
    }

    logDebug("Credentials loaded successfully");

    return {
      app_id: appId,
      app_key: appKey,
      "Content-Type": "application/json",
    };
  }

  /**
   * Builds request body for conversion
   * @private
   * @param {string} mmd - MMD content to convert
   * @param {string[]} formats - Array of format keys
   * @param {Object} options - Optional conversion_options per format
   * @returns {Object} Request body for POST to /v3/converter
   */
  _buildRequestBody(mmd, formats, options = {}) {
    const config = this._getConfig();

    // Build formats object with true values
    const formatsObj = {};
    formats.forEach((format) => {
      formatsObj[format] = true;
    });

    const body = {
      mmd: mmd,
      formats: formatsObj,
    };

    // Add conversion_options if provided or use defaults
    const conversionOptions = {};
    let hasOptions = false;

    formats.forEach((format) => {
      // Merge default options with provided options
      const formatDefaults = config.DEFAULT_OPTIONS[format] || {};
      const formatOptions = options[format] || {};
      const mergedOptions = { ...formatDefaults, ...formatOptions };

      if (Object.keys(mergedOptions).length > 0) {
        conversionOptions[format] = mergedOptions;
        hasOptions = true;
      }
    });

    if (hasOptions) {
      body.conversion_options = conversionOptions;
    }

    logDebug("Built request body:", body);
    return body;
  }

  /**
   * Validates MMD content before conversion
   * @param {string} mmd - MMD content to validate
   * @returns {{valid: boolean, error?: string, sizeBytes: number}}
   *
   * @example
   * const result = client.validateMMD(content);
   * if (!result.valid) {
   *   console.error(result.error);
   * }
   */
  validateMMD(mmd) {
    const config = this._getConfig();

    // Check for empty or non-string content
    if (!mmd || typeof mmd !== "string") {
      return {
        valid: false,
        error: "MMD content is empty or not a string",
        sizeBytes: 0,
      };
    }

    // Check for whitespace-only content
    if (mmd.trim().length === 0) {
      return {
        valid: false,
        error: "MMD content contains only whitespace",
        sizeBytes: 0,
      };
    }

    // Calculate size in bytes (UTF-8)
    const sizeBytes = new TextEncoder().encode(mmd).length;

    // Check size limit
    if (sizeBytes > config.MAX_MMD_SIZE_BYTES) {
      return {
        valid: false,
        error: `MMD content (${sizeBytes} bytes) exceeds ${config.MAX_MMD_SIZE_BYTES} byte limit`,
        sizeBytes: sizeBytes,
      };
    }

    return {
      valid: true,
      sizeBytes: sizeBytes,
    };
  }

  /**
   * Gets supported formats sorted by priority
   * @returns {Array<{key: string, label: string, extension: string, binary: boolean, mimeType: string, priority: number, description: string}>}
   *
   * @example
   * const formats = client.getSupportedFormats();
   * formats.forEach(f => console.log(f.label));
   */
  getSupportedFormats() {
    const config = this._getConfig();

    return Object.entries(config.FORMATS)
      .map(([key, data]) => ({
        key,
        ...data,
      }))
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Validates format keys against supported formats
   * @private
   * @param {string[]} formats - Array of format keys to validate
   * @returns {{valid: boolean, validFormats: string[], invalidFormats: string[]}}
   */
  _validateFormats(formats) {
    const config = this._getConfig();
    const validFormats = [];
    const invalidFormats = [];

    if (!Array.isArray(formats) || formats.length === 0) {
      return { valid: false, validFormats: [], invalidFormats: [] };
    }

    formats.forEach((format) => {
      if (config.FORMATS[format]) {
        validFormats.push(format);
      } else {
        invalidFormats.push(format);
      }
    });

    return {
      valid: validFormats.length > 0,
      validFormats,
      invalidFormats,
    };
  }

  /**
   * Starts a conversion job
   * @param {string} mmd - MMD content to convert
   * @param {string[]} formats - Array of format keys (e.g., ['docx', 'pdf'])
   * @param {Object} [options={}] - Optional conversion_options per format
   * @returns {Promise<{conversionId: string, formats: string[]}>}
   * @throws {ConvertError} If validation fails or API returns error
   *
   * @example
   * const { conversionId } = await client.startConversion(mmd, ['docx', 'pdf']);
   */
  async startConversion(mmd, formats, options = {}) {
    logInfo("Starting conversion for formats:", formats);

    // Validate MMD
    const mmdValidation = this.validateMMD(mmd);
    if (!mmdValidation.valid) {
      if (mmdValidation.sizeBytes > this._getConfig().MAX_MMD_SIZE_BYTES) {
        throw new ConvertError(CONVERT_ERRORS.MMD_TOO_LARGE, {
          sizeBytes: mmdValidation.sizeBytes,
        });
      }
      throw new ConvertError(CONVERT_ERRORS.INVALID_MMD);
    }

    // Validate formats
    const formatValidation = this._validateFormats(formats);
    if (formatValidation.invalidFormats.length > 0) {
      logWarn("Invalid formats:", formatValidation.invalidFormats);
    }
    if (!formatValidation.valid) {
      if (formatValidation.invalidFormats.length > 0) {
        throw new ConvertError(CONVERT_ERRORS.INVALID_FORMAT, {
          format: formatValidation.invalidFormats.join(", "),
        });
      }
      throw new ConvertError(CONVERT_ERRORS.NO_FORMATS);
    }

    // Build request
    const config = this._getConfig();
    const headers = this._buildHeaders();
    const body = this._buildRequestBody(
      mmd,
      formatValidation.validFormats,
      options
    );

    try {
      logDebug("Sending POST to", config.ENDPOINT);

      const response = await fetch(config.ENDPOINT, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logError("API error response:", response.status, errorText);

        if (response.status === 401 || response.status === 403) {
          throw new ConvertError(CONVERT_ERRORS.AUTH_ERROR);
        }

        throw new ConvertError(CONVERT_ERRORS.API_ERROR, {
          details: `HTTP ${response.status}: ${errorText}`,
        });
      }

      const data = await response.json();
      logDebug("Conversion started:", data);

      if (!data.conversion_id) {
        throw new ConvertError(CONVERT_ERRORS.API_ERROR, {
          details: "No conversion_id in response",
        });
      }

      // Track this conversion
      this.activeConversions.set(data.conversion_id, {
        formats: formatValidation.validFormats,
        startTime: Date.now(),
        cancelled: false,
      });

      return {
        conversionId: data.conversion_id,
        formats: formatValidation.validFormats,
      };
    } catch (error) {
      if (error instanceof ConvertError) {
        throw error;
      }

      // Network or other error
      logError("Network error:", error);
      throw new ConvertError(CONVERT_ERRORS.NETWORK_ERROR, {
        details: error.message,
      });
    }
  }

  /**
   * Checks status of a conversion
   * @param {string} conversionId - The conversion ID to check
   * @returns {Promise<{status: string, formatStatuses: Object}>}
   * @throws {ConvertError} If the status check fails
   *
   * @example
   * const status = await client.checkStatus(conversionId);
   * console.log(status.formatStatuses.docx.status); // 'completed'
   */
  async checkStatus(conversionId) {
    if (!conversionId || typeof conversionId !== "string") {
      throw new ConvertError(CONVERT_ERRORS.INVALID_CONVERSION_ID);
    }

    const config = this._getConfig();
    const headers = this._buildHeaders();
    const url = `${config.ENDPOINT}/${conversionId}`;

    try {
      logDebug("Checking status:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logError("Status check error:", response.status, errorText);

        if (response.status === 401 || response.status === 403) {
          throw new ConvertError(CONVERT_ERRORS.AUTH_ERROR);
        }

        throw new ConvertError(CONVERT_ERRORS.API_ERROR, {
          details: `HTTP ${response.status}: ${errorText}`,
        });
      }

      const data = await response.json();
      logDebug("Status response:", data);

      // Normalise response
      return {
        status: data.status || "unknown",
        formatStatuses: data.conversion_status || {},
      };
    } catch (error) {
      if (error instanceof ConvertError) {
        throw error;
      }

      logError("Network error during status check:", error);
      throw new ConvertError(CONVERT_ERRORS.NETWORK_ERROR, {
        details: error.message,
      });
    }
  }

  /**
   * Polls until all formats complete or timeout
   * @param {string} conversionId - The conversion ID to poll
   * @param {Function} [onProgress] - Callback for progress updates: (statusObject) => void
   * @returns {Promise<{completed: string[], failed: string[], errors: Object}>}
   * @throws {ConvertError} If polling fails or times out
   *
   * @example
   * const result = await client.pollUntilComplete(conversionId, (status) => {
   *   console.log('Progress:', status);
   * });
   */
  async pollUntilComplete(conversionId, onProgress = null) {
    const config = this._getConfig();
    const conversionInfo = this.activeConversions.get(conversionId);

    if (!conversionInfo) {
      logWarn("Polling for untracked conversion:", conversionId);
    }

    const expectedFormats = conversionInfo?.formats || [];
    let attempts = 0;
    const completed = [];
    const failed = [];
    const errors = {};

    logInfo("Starting polling for conversion:", conversionId);

    while (attempts < config.MAX_POLL_ATTEMPTS) {
      // Check for cancellation
      if (conversionInfo?.cancelled) {
        logInfo("Conversion cancelled:", conversionId);
        throw new ConvertError(CONVERT_ERRORS.CANCELLED);
      }

      attempts++;
      logDebug(`Poll attempt ${attempts}/${config.MAX_POLL_ATTEMPTS}`);

      try {
        const statusResult = await this.checkStatus(conversionId);

        // Process format statuses
        const formatStatuses = statusResult.formatStatuses;
        let allComplete = true;
        let currentCompleted = 0;

        for (const [format, statusInfo] of Object.entries(formatStatuses)) {
          const formatStatus = statusInfo.status || statusInfo;

          if (formatStatus === "completed") {
            if (!completed.includes(format)) {
              completed.push(format);
              logInfo(`Format completed: ${format}`);
            }
            currentCompleted++;
          } else if (formatStatus === "error") {
            if (!failed.includes(format)) {
              failed.push(format);
              errors[format] = statusInfo.error_info || "Unknown error";
              logWarn(`Format failed: ${format}`, errors[format]);
            }
          } else if (formatStatus === "processing") {
            allComplete = false;
          } else {
            // Unknown status, keep polling
            allComplete = false;
            logDebug(`Unknown status for ${format}: ${formatStatus}`);
          }
        }

        // Call progress callback
        if (onProgress) {
          try {
            onProgress({
              status: statusResult.status,
              formatStatuses: formatStatuses,
              completed: completed.slice(),
              failed: failed.slice(),
              attempts,
              maxAttempts: config.MAX_POLL_ATTEMPTS,
            });
          } catch (callbackError) {
            logWarn("Progress callback error:", callbackError);
          }
        }

        // Check if all formats are done (completed or failed)
        const totalDone = completed.length + failed.length;
        const totalExpected =
          expectedFormats.length || Object.keys(formatStatuses).length;

        if (allComplete || totalDone >= totalExpected) {
          logInfo("Polling complete:", { completed, failed });
          return { completed, failed, errors };
        }

        // Wait before next poll
        await this._sleep(config.POLL_INTERVAL_MS);
      } catch (error) {
        if (error instanceof ConvertError && error.code === "CANCELLED") {
          throw error;
        }

        logWarn(`Poll attempt ${attempts} failed:`, error.message);

        // Continue polling on recoverable errors
        if (
          error.recoverable !== false &&
          attempts < config.MAX_POLL_ATTEMPTS
        ) {
          await this._sleep(config.POLL_INTERVAL_MS);
          continue;
        }

        throw error;
      }
    }

    // Timeout
    const timeoutSeconds =
      (config.MAX_POLL_ATTEMPTS * config.POLL_INTERVAL_MS) / 1000;
    logError("Polling timed out after", timeoutSeconds, "seconds");
    throw new ConvertError(CONVERT_ERRORS.TIMEOUT, {
      seconds: timeoutSeconds,
    });
  }

  /**
   * Downloads a completed conversion
   * @param {string} conversionId - The conversion ID
   * @param {string} format - The format to download
   * @returns {Promise<Blob>}
   * @throws {ConvertError} If download fails
   *
   * @example
   * const blob = await client.downloadResult(conversionId, 'docx');
   * // Use blob for download or further processing
   */
  async downloadResult(conversionId, format) {
    if (!conversionId || typeof conversionId !== "string") {
      throw new ConvertError(CONVERT_ERRORS.INVALID_CONVERSION_ID);
    }

    const config = this._getConfig();
    const formatInfo = config.FORMATS[format];

    if (!formatInfo) {
      throw new ConvertError(CONVERT_ERRORS.INVALID_FORMAT, { format });
    }

    const headers = this._buildHeaders();
    // Remove Content-Type for download requests
    delete headers["Content-Type"];

    const url = `${config.ENDPOINT}/${conversionId}.${format}`;

    try {
      logDebug("Downloading:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logError("Download error:", response.status, errorText);

        throw new ConvertError(CONVERT_ERRORS.DOWNLOAD_ERROR, {
          format: formatInfo.label,
          details: `HTTP ${response.status}`,
        });
      }

      const blob = await response.blob();
      logInfo(`Downloaded ${format}: ${blob.size} bytes`);

      return blob;
    } catch (error) {
      if (error instanceof ConvertError) {
        throw error;
      }

      logError("Network error during download:", error);
      throw new ConvertError(CONVERT_ERRORS.DOWNLOAD_ERROR, {
        format: formatInfo.label,
        details: error.message,
      });
    }
  }

  /**
   * Full workflow: start, poll, download all completed formats
   * @param {string} mmd - MMD content to convert
   * @param {string[]} formats - Array of format keys
   * @param {Object} [callbacks={}] - Callback functions for workflow events
   * @param {Function} [callbacks.onStart] - Called when conversion starts: (conversionId) => void
   * @param {Function} [callbacks.onProgress] - Called on status updates: (statusObject) => void
   * @param {Function} [callbacks.onFormatComplete] - Called when a format completes: (format, blob) => void
   * @param {Function} [callbacks.onComplete] - Called when all done: (results) => void
   * @param {Function} [callbacks.onError] - Called on errors: (error) => void
   * @returns {Promise<Map<string, Blob>>} - Map of format key to Blob
   *
   * @example
   * const blobs = await client.convertAndDownload(mmd, ['docx', 'pdf'], {
   *   onStart: (id) => console.log('Started:', id),
   *   onProgress: (status) => updateProgressUI(status),
   *   onFormatComplete: (format, blob) => console.log(`${format} ready`),
   *   onComplete: (results) => console.log('All done!'),
   *   onError: (error) => handleError(error)
   * });
   */
  async convertAndDownload(mmd, formats, callbacks = {}) {
    const { onStart, onProgress, onFormatComplete, onComplete, onError } =
      callbacks;
    const results = new Map();

    try {
      // 1. Start conversion
      logInfo("Starting convertAndDownload workflow");
      const { conversionId, formats: validFormats } =
        await this.startConversion(mmd, formats);

      if (onStart) {
        try {
          onStart(conversionId);
        } catch (e) {
          logWarn("onStart callback error:", e);
        }
      }

      // 2. Poll until complete
      const pollResult = await this.pollUntilComplete(conversionId, onProgress);

      // 3. Download completed formats
      for (const format of pollResult.completed) {
        try {
          const blob = await this.downloadResult(conversionId, format);
          results.set(format, blob);

          if (onFormatComplete) {
            try {
              onFormatComplete(format, blob);
            } catch (e) {
              logWarn("onFormatComplete callback error:", e);
            }
          }
        } catch (downloadError) {
          logWarn(`Failed to download ${format}:`, downloadError.message);
          if (onError) {
            try {
              onError(downloadError);
            } catch (e) {
              logWarn("onError callback error:", e);
            }
          }
        }
      }

      // 4. Report completion
      const completionResult = {
        conversionId,
        results,
        completed: pollResult.completed,
        failed: pollResult.failed,
        errors: pollResult.errors,
      };

      if (onComplete) {
        try {
          onComplete(completionResult);
        } catch (e) {
          logWarn("onComplete callback error:", e);
        }
      }

      // Clean up tracking
      this.activeConversions.delete(conversionId);

      logInfo("convertAndDownload complete:", {
        completed: pollResult.completed,
        failed: pollResult.failed,
      });

      return results;
    } catch (error) {
      logError("convertAndDownload failed:", error);

      if (onError) {
        try {
          onError(error);
        } catch (e) {
          logWarn("onError callback error:", e);
        }
      }

      throw error;
    }
  }

  /**
   * Cancels an active conversion (stops polling, does not cancel server-side)
   * @param {string} conversionId - The conversion ID to cancel
   * @returns {boolean} - True if cancellation was successful
   *
   * @example
   * const cancelled = client.cancelConversion(conversionId);
   */
  cancelConversion(conversionId) {
    const conversionInfo = this.activeConversions.get(conversionId);

    if (!conversionInfo) {
      logWarn("Cannot cancel unknown conversion:", conversionId);
      return false;
    }

    conversionInfo.cancelled = true;
    logInfo("Conversion marked for cancellation:", conversionId);

    return true;
  }

  /**
   * Gets the number of active conversions
   * @returns {number} Number of active conversions
   */
  getActiveConversionCount() {
    return this.activeConversions.size;
  }

  /**
   * Clears all active conversion tracking (does not cancel server-side)
   */
  clearActiveConversions() {
    const count = this.activeConversions.size;
    this.activeConversions.clear();
    logInfo(`Cleared ${count} active conversions`);
  }

  /**
   * Sleep helper for polling
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let convertClientInstance = null;

/**
 * Gets the singleton MathPixConvertAPIClient instance
 * @function getMathPixConvertClient
 * @returns {MathPixConvertAPIClient} The client instance
 *
 * @example
 * const client = getMathPixConvertClient();
 */
function getMathPixConvertClient() {
  if (!convertClientInstance) {
    convertClientInstance = new MathPixConvertAPIClient();
  }
  return convertClientInstance;
}

// ============================================================================
// Global Exposure for Console Testing
// ============================================================================
console.log("🔵 Convert API Client: Reaching global exposure...");
window.getMathPixConvertClient = getMathPixConvertClient;
window.MathPixConvertAPIClient = MathPixConvertAPIClient;
window.ConvertError = ConvertError;
window.CONVERT_ERRORS = CONVERT_ERRORS;

// ============================================================================
// Export (ES6 Module Support)
// ============================================================================

export {
  MathPixConvertAPIClient,
  getMathPixConvertClient,
  ConvertError,
  CONVERT_ERRORS,
};
export default MathPixConvertAPIClient;
