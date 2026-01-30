/**
 * @fileoverview Ally Accessibility Reporting Tool - API Client Module
 * @module AllyApiClient
 * @requires ALLY_CONFIG
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * API client for the Ally Accessibility Reporting Tool. Handles authentication,
 * API requests with polling support, and error management. Designed for the
 * asynchronous nature of Ally's reporting API which requires polling until
 * data is ready.
 *
 * Key Features:
 * - Credential management with optional localStorage persistence
 * - Multi-region API support (EU, US, CA, SG, AU)
 * - Polling loop for API warm-up (status: "Processing" -> "Successful")
 * - Request cancellation via AbortController
 * - Progress callbacks for UI updates
 * - Comprehensive error classification and handling
 *
 * Integration:
 * - Requires ally-config.js to be loaded first
 * - Used by ally-ui.js for user-initiated queries
 * - Exposes console testing functions globally
 *
 * @example
 * // Set credentials and query
 * ALLY_API_CLIENT.setCredentials('my-token', 'my-client-id');
 * const result = await ALLY_API_CLIENT.fetchOverall({
 *   limit: 100,
 *   onProgress: (p) => console.log(p.message)
 * });
 *
 * @example
 * // Test connection
 * const isConnected = await ALLY_API_CLIENT.testConnection();
 */

const ALLY_API_CLIENT = (function () {
  "use strict";

  // ========================================================================
  // Logging Configuration (IIFE-scoped)
  // ========================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  /**
   * Determines if a message should be logged based on current configuration
   * @param {number} level - The log level to check
   * @returns {boolean} True if the message should be logged
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  /**
   * Logs error messages if error logging is enabled
   * @param {string} message - The error message to log
   * @param {...any} args - Additional arguments to pass to console.error
   */
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[AllyApiClient] " + message, ...args);
  }

  /**
   * Logs warning messages if warning logging is enabled
   * @param {string} message - The warning message to log
   * @param {...any} args - Additional arguments to pass to console.warn
   */
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyApiClient] " + message, ...args);
  }

  /**
   * Logs informational messages if info logging is enabled
   * @param {string} message - The info message to log
   * @param {...any} args - Additional arguments to pass to console.log
   */
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyApiClient] " + message, ...args);
  }

  /**
   * Logs debug messages if debug logging is enabled
   * @param {string} message - The debug message to log
   * @param {...any} args - Additional arguments to pass to console.log
   */
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyApiClient] " + message, ...args);
  }

  // ========================================================================
  // Dependency Check
  // ========================================================================

  if (typeof ALLY_CONFIG === "undefined") {
    console.error(
      "[AllyApiClient] FATAL: ALLY_CONFIG is not loaded. Please ensure ally-config.js is loaded before ally-api-client.js",
    );
  }

  // ========================================================================
  // Private State
  // ========================================================================

  /** @type {string|null} Current API token */
  let _token = null;

  /** @type {string|null} Current client ID */
  let _clientId = null;

  /** @type {string} Current region key */
  let _region = ALLY_CONFIG ? ALLY_CONFIG.DEFAULT_REGION : "EU";

  /** @type {AbortController|null} Current request abort controller */
  let _abortController = null;

  /** @type {boolean} Whether a request is currently in progress */
  let _requestInProgress = false;

  /** @type {Object|null} Debug data from the last API transaction */
  let _debugData = null;

  // ========================================================================
  // Error Type Constants
  // ========================================================================

  /**
   * Error type constants for classification
   * @type {Object.<string, string>}
   */
  const ERROR_TYPES = {
    AUTH: "auth",
    NETWORK: "network",
    TIMEOUT: "timeout",
    SERVER: "server",
    CANCELLED: "cancelled",
    VALIDATION: "validation",
    UNKNOWN: "unknown",
  };

  // ========================================================================
  // Private Helper Functions
  // ========================================================================

  /**
   * Creates a structured error object
   * @param {string} type - Error type from ERROR_TYPES
   * @param {string} message - Human-readable error message
   * @param {number|null} status - HTTP status code if applicable
   * @param {Object|null} details - Additional error details
   * @returns {Object} Structured error object
   */
  function createError(type, message, status, details) {
    return {
      type: type || ERROR_TYPES.UNKNOWN,
      message: message || "An unknown error occurred",
      status: status || null,
      details: details || null,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Classifies an error based on its properties
   * @param {Error|Response} error - The error or response to classify
   * @returns {Object} Structured error object
   */
  function classifyError(error) {
    // Cancelled request
    if (error.name === "AbortError") {
      return createError(ERROR_TYPES.CANCELLED, "Request was cancelled", null, {
        aborted: true,
      });
    }

    // HTTP error response (from fetch Response object or error with status)
    if (error.status) {
      const status = error.status;
      const statusText = error.statusText || "";

      // Authentication errors
      if (status === 401 || status === 403) {
        return createError(
          ERROR_TYPES.AUTH,
          ALLY_CONFIG.MESSAGES.AUTH_ERROR,
          status,
          { statusText: statusText },
        );
      }

      // Proxy/Gateway errors (502, 503, 504)
      if (status === 502) {
        return createError(
          ERROR_TYPES.SERVER,
          "API server unavailable (502 Bad Gateway). The service may be temporarily down.",
          status,
          { statusText: statusText },
        );
      }

      if (status === 503) {
        return createError(
          ERROR_TYPES.SERVER,
          "API service unavailable (503). The service is temporarily overloaded or under maintenance.",
          status,
          { statusText: statusText },
        );
      }

      if (status === 504) {
        return createError(
          ERROR_TYPES.SERVER,
          "API gateway timeout (504). The service is taking too long to respond.",
          status,
          { statusText: statusText },
        );
      }

      // Other server errors (5xx)
      if (status >= 500) {
        return createError(
          ERROR_TYPES.SERVER,
          "API server error (" + status + "). Please try again later.",
          status,
          { statusText: statusText },
        );
      }

      // Client errors (4xx)
      if (status >= 400) {
        return createError(
          ERROR_TYPES.VALIDATION,
          "Invalid request (" + status + "): " + (statusText || "Bad request"),
          status,
          { statusText: statusText },
        );
      }
    }

    // Network error (fetch threw TypeError - connection failed, CORS, etc.)
    if (error instanceof TypeError) {
      // Check for common network-related messages
      const msg = error.message.toLowerCase();
      if (
        msg.includes("fetch") ||
        msg.includes("network") ||
        msg.includes("failed to fetch")
      ) {
        return createError(
          ERROR_TYPES.NETWORK,
          "Unable to connect to API server. This could be a network issue or the server may be unreachable.",
          null,
          { originalError: error.message },
        );
      }
    }

    // Timeout
    if (error.message && error.message.toLowerCase().includes("timeout")) {
      return createError(
        ERROR_TYPES.TIMEOUT,
        ALLY_CONFIG.MESSAGES.TIMEOUT,
        null,
        { originalError: error.message },
      );
    }

    // Unknown error - preserve original message
    return createError(
      ERROR_TYPES.UNKNOWN,
      error.message || "An unexpected error occurred",
      null,
      { originalError: error.toString() },
    );
  }

  /**
   * Builds query string from options object
   * @param {Object} options - Query options
   * @returns {string} URL query string (without leading ?)
   */
  function buildQueryString(options) {
    const params = [];

    // Pagination
    if (options.limit !== undefined) {
      params.push("limit=" + encodeURIComponent(options.limit));
    }
    if (options.offset !== undefined) {
      params.push("offset=" + encodeURIComponent(options.offset));
    }

    // Sorting
    if (options.sort) {
      params.push("sort=" + encodeURIComponent(options.sort));
    }
    if (options.order) {
      params.push("order=" + encodeURIComponent(options.order));
    }

    // Filters
    // Supports both single values and arrays (for range queries like overallScore=ge:0.1&overallScore=le:0.7)
    if (options.filters && typeof options.filters === "object") {
      Object.entries(options.filters).forEach(function (entry) {
        var key = entry[0];
        var value = entry[1];

        if (value === undefined || value === null || value === "") {
          return; // Skip empty values
        }

        // Handle array values (multiple conditions on same field)
        if (Array.isArray(value)) {
          value.forEach(function (v) {
            if (v !== undefined && v !== null && v !== "") {
              params.push(
                encodeURIComponent(key) + "=" + encodeURIComponent(v),
              );
            }
          });
        } else {
          // Single value
          params.push(
            encodeURIComponent(key) + "=" + encodeURIComponent(value),
          );
        }
      });
    }

    return params.join("&");
  }

  /**
   * Makes an authenticated API request
   * @param {string} url - Full API URL
   * @param {AbortSignal} signal - Abort signal for cancellation
   * @returns {Promise<Response>} Fetch response
   */
  async function makeRequest(url, signal) {
    logDebug("Making request to:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + _token,
        Accept: "application/json",
      },
      signal: signal,
    });

    return response;
  }

  /**
   * Parses API response and checks for errors
   * @param {Response} response - Fetch response
   * @returns {Promise<Object>} Parsed JSON response
   * @throws {Object} Structured error if response is not OK
   */
  async function parseResponse(response) {
    if (!response.ok) {
      const error = classifyError(response);
      logError("API error:", error);
      throw error;
    }

    try {
      return await response.json();
    } catch (parseError) {
      throw createError(
        ERROR_TYPES.SERVER,
        "Failed to parse API response",
        response.status,
        { parseError: parseError.message },
      );
    }
  }

  /**
   * Delays execution for specified milliseconds
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Executes an API query with polling support
   * @param {string} endpointKey - Key from ALLY_CONFIG.ENDPOINTS
   * @param {Object} options - Query options
   * @returns {Promise<Object>} API response data
   */
  async function executeQuery(endpointKey, options) {
    options = options || {};

    // Validate credentials
    if (!_token || !_clientId) {
      const error = createError(
        ERROR_TYPES.VALIDATION,
        !_token
          ? ALLY_CONFIG.MESSAGES.MISSING_TOKEN
          : ALLY_CONFIG.MESSAGES.MISSING_CLIENT_ID,
        null,
        { missingToken: !_token, missingClientId: !_clientId },
      );
      if (options.onError) options.onError(error);
      throw error;
    }

    // Validate region
    if (!ALLY_CONFIG.isValidRegion(_region)) {
      const error = createError(
        ERROR_TYPES.VALIDATION,
        ALLY_CONFIG.MESSAGES.INVALID_REGION,
        null,
        { region: _region },
      );
      if (options.onError) options.onError(error);
      throw error;
    }

    // Build URL
    const baseUrl = ALLY_CONFIG.getApiUrl(endpointKey, _clientId, _region);
    if (!baseUrl) {
      const error = createError(
        ERROR_TYPES.VALIDATION,
        "Failed to construct API URL",
        null,
        { endpointKey: endpointKey, clientId: _clientId, region: _region },
      );
      if (options.onError) options.onError(error);
      throw error;
    }

    // Apply defaults
    const queryOptions = {
      limit:
        options.limit !== undefined
          ? options.limit
          : ALLY_CONFIG.PAGINATION.DEFAULT_LIMIT,
      offset: options.offset !== undefined ? options.offset : 0,
      sort: options.sort,
      order: options.order,
      filters: options.filters,
    };

    const queryString = buildQueryString(queryOptions);
    const fullUrl = queryString ? baseUrl + "?" + queryString : baseUrl;

    // Create abort controller - use local variable to prevent race conditions
    // when multiple requests run concurrently
    const localAbortController = new AbortController();
    _abortController = localAbortController; // For external cancellation via cancelRequest()
    _requestInProgress = true;

    // Helper to safely get the signal (guards against null)
    const getSignal = function () {
      return localAbortController.signal;
    };

    // Initialise debug data capture
    const requestStartTime = Date.now();
    _debugData = {
      request: {
        endpoint: endpointKey,
        region: _region,
        url: fullUrl,
        options: queryOptions,
        headers: {
          Authorization:
            "Bearer " +
            (_token
              ? _token.substring(0, 4) +
                "****" +
                _token.substring(_token.length - 4)
              : "null"),
          Accept: "application/json",
        },
        timestamp: new Date().toISOString(),
      },
      response: null,
      timing: {
        startTime: requestStartTime,
        endTime: null,
        duration: null,
        pollingAttempts: 0,
      },
    };

    try {
      logInfo("Starting query to " + endpointKey);
      logDebug("Full URL:", fullUrl);

      // Notify progress: connecting
      if (options.onProgress) {
        options.onProgress({
          attempt: 0,
          maxAttempts: ALLY_CONFIG.POLLING.MAX_ATTEMPTS,
          status: "connecting",
          message: ALLY_CONFIG.MESSAGES.CONNECTING,
        });
      }

      // Initial delay
      await delay(ALLY_CONFIG.POLLING.INITIAL_DELAY_MS);

      // Check if cancelled during initial delay
      if (getSignal().aborted) {
        throw new DOMException("Request cancelled", "AbortError");
      }

      // Polling loop
      let attempts = 0;
      let result = null;
      let consecutiveErrors = 0;
      let lastError = null;
      const MAX_CONSECUTIVE_ERRORS = 5; // Give up after 5 consecutive errors

      while (attempts < ALLY_CONFIG.POLLING.MAX_ATTEMPTS) {
        attempts++;

        logDebug(
          "Polling attempt " +
            attempts +
            " of " +
            ALLY_CONFIG.POLLING.MAX_ATTEMPTS,
        );

        // Notify progress (include error info if we've had issues)
        if (options.onProgress) {
          const progressInfo = {
            attempt: attempts,
            maxAttempts: ALLY_CONFIG.POLLING.MAX_ATTEMPTS,
            status: consecutiveErrors > 0 ? "degraded" : "polling",
            message: ALLY_CONFIG.getPollingMessage(attempts),
          };

          // Add error context if API is having issues
          if (consecutiveErrors > 0 && lastError) {
            progressInfo.errorCount = consecutiveErrors;
            progressInfo.lastError = lastError.message || "Unknown error";
            progressInfo.message =
              "API experiencing issues - retrying... (" +
              consecutiveErrors +
              " error" +
              (consecutiveErrors > 1 ? "s" : "") +
              ")";
          }

          options.onProgress(progressInfo);
        }

        // Make request with error handling for transient failures
        try {
          const response = await makeRequest(fullUrl, getSignal());
          result = await parseResponse(response);

          // Successful response - reset error count
          consecutiveErrors = 0;
          lastError = null;

          logDebug("Response status:", result.metadata?.status);

          // Check if data is ready
          if (result.metadata && result.metadata.status === "Successful") {
            logInfo("Query successful after " + attempts + " attempt(s)");

            // Capture debug response data
            const requestEndTime = Date.now();
            if (_debugData) {
              _debugData.response = {
                status: 200,
                statusText: "OK",
                metadata: result.metadata,
                recordCount: Array.isArray(result.data)
                  ? result.data.length
                  : 0,
                // Include first 3 records as sample (avoid huge debug output)
                dataSample: Array.isArray(result.data)
                  ? result.data.slice(0, 3)
                  : null,
                timestamp: new Date().toISOString(),
              };
              _debugData.timing.endTime = requestEndTime;
              _debugData.timing.duration =
                requestEndTime - _debugData.timing.startTime;
              _debugData.timing.pollingAttempts = attempts;
            }

            // Notify success
            if (options.onProgress) {
              options.onProgress({
                attempt: attempts,
                maxAttempts: ALLY_CONFIG.POLLING.MAX_ATTEMPTS,
                status: "complete",
                message: ALLY_CONFIG.MESSAGES.SUCCESS,
              });
            }

            if (options.onComplete) {
              options.onComplete(result);
            }

            return result;
          }

          // Still processing - wait before next poll
          if (result.metadata && result.metadata.status === "Processing") {
            logDebug(
              "API still processing, waiting " +
                ALLY_CONFIG.POLLING.INTERVAL_MS +
                "ms",
            );
            await delay(ALLY_CONFIG.POLLING.INTERVAL_MS);

            // Check if cancelled during delay
            if (getSignal().aborted) {
              throw new DOMException("Request cancelled", "AbortError");
            }
          } else {
            // Unexpected status
            logWarn("Unexpected API status:", result.metadata?.status);
            break;
          }
        } catch (pollError) {
          // Handle transient errors during polling
          consecutiveErrors++;
          lastError = pollError.type ? pollError : classifyError(pollError);

          // Check for cancellation - don't retry
          if (
            pollError.name === "AbortError" ||
            lastError.type === "cancelled"
          ) {
            throw pollError;
          }

          logWarn(
            "Polling error (attempt " +
              attempts +
              "/" +
              ALLY_CONFIG.POLLING.MAX_ATTEMPTS +
              ", consecutive errors: " +
              consecutiveErrors +
              "):",
            lastError.message,
          );

          // Give up after too many consecutive errors
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            logError(
              "Too many consecutive errors (" +
                consecutiveErrors +
                "), giving up",
            );
            if (options.onError) options.onError(lastError);
            throw lastError;
          }

          // Notify user of degraded state
          if (options.onProgress) {
            options.onProgress({
              attempt: attempts,
              maxAttempts: ALLY_CONFIG.POLLING.MAX_ATTEMPTS,
              status: "error",
              message:
                "API error: " +
                (lastError.message || "Unknown error") +
                " - retrying in " +
                Math.round(ALLY_CONFIG.POLLING.INTERVAL_MS / 1000) +
                "s...",
              errorCount: consecutiveErrors,
              lastError: lastError.message,
            });
          }

          // Wait before retry
          await delay(ALLY_CONFIG.POLLING.INTERVAL_MS);

          // Check if cancelled during delay
          if (getSignal().aborted) {
            throw new DOMException("Request cancelled", "AbortError");
          }
        }
      }

      // Timeout - max attempts reached
      const timeoutError = createError(
        ERROR_TYPES.TIMEOUT,
        ALLY_CONFIG.MESSAGES.TIMEOUT + " (Max polling attempts reached)",
        null,
        { attempts: attempts, maxAttempts: ALLY_CONFIG.POLLING.MAX_ATTEMPTS },
      );
      if (options.onError) options.onError(timeoutError);
      throw timeoutError;
    } catch (error) {
      // Classify and handle error
      const classifiedError = error.type ? error : classifyError(error);
      logError("Query failed:", classifiedError);

      if (options.onError && !error.type) {
        options.onError(classifiedError);
      }

      throw classifiedError;
    } finally {
      _requestInProgress = false;
      _abortController = null;
    }
  }

  // ========================================================================
  // Public API
  // ========================================================================

  logInfo("ALLY_API_CLIENT initialised");

  return {
    // ======================================================================
    // Credential Management
    // ======================================================================

    /**
     * Sets API credentials
     * @param {string} token - Ally API bearer token
     * @param {string} clientId - Ally client ID
     * @returns {boolean} True if credentials were set successfully
     *
     * @example
     * ALLY_API_CLIENT.setCredentials('my-api-token', '577');
     */
    setCredentials: function (token, clientId) {
      if (!token || typeof token !== "string") {
        logError("Invalid token provided");
        return false;
      }
      if (!clientId || typeof clientId !== "string") {
        logError("Invalid clientId provided");
        return false;
      }

      _token = token.trim();
      _clientId = clientId.trim();
      logInfo("Credentials set for client:", _clientId);
      return true;
    },

    /**
     * Gets current credentials (token is masked for security)
     * @returns {Object} Current credentials object
     *
     * @example
     * const creds = ALLY_API_CLIENT.getCredentials();
     * // { token: '****...', clientId: '577', region: 'EU' }
     */
    getCredentials: function () {
      return {
        token: _token
          ? _token.substring(0, 4) + "..." + _token.substring(_token.length - 4)
          : null,
        tokenLength: _token ? _token.length : 0,
        clientId: _clientId,
        region: _region,
      };
    },

    /**
     * Clears all stored credentials
     *
     * @example
     * ALLY_API_CLIENT.clearCredentials();
     */
    clearCredentials: function () {
      _token = null;
      _clientId = null;
      logInfo("Credentials cleared");
    },

    /**
     * Loads saved credentials from localStorage
     * @returns {boolean} True if credentials were loaded successfully
     *
     * @example
     * if (ALLY_API_CLIENT.loadSavedCredentials()) {
     *   console.log('Credentials loaded from storage');
     * }
     */
    loadSavedCredentials: function () {
      try {
        // Check if saving is enabled
        const saveEnabled = localStorage.getItem(
          ALLY_CONFIG.STORAGE_KEYS.SAVE_CREDENTIALS,
        );
        if (saveEnabled !== "true") {
          logDebug("Credential saving not enabled");
          return false;
        }

        const savedToken = localStorage.getItem(ALLY_CONFIG.STORAGE_KEYS.TOKEN);
        const savedClientId = localStorage.getItem(
          ALLY_CONFIG.STORAGE_KEYS.CLIENT_ID,
        );
        const savedRegion = localStorage.getItem(
          ALLY_CONFIG.STORAGE_KEYS.REGION,
        );

        if (savedToken && savedClientId) {
          _token = savedToken;
          _clientId = savedClientId;
          if (savedRegion && ALLY_CONFIG.isValidRegion(savedRegion)) {
            _region = savedRegion;
          }
          logInfo("Credentials loaded from localStorage");
          return true;
        }

        logDebug("No saved credentials found");
        return false;
      } catch (e) {
        logWarn("Failed to load credentials from localStorage:", e.message);
        return false;
      }
    },

    /**
     * Saves current credentials to localStorage
     * @param {boolean} enable - Whether to enable credential saving
     * @returns {boolean} True if credentials were saved successfully
     *
     * @example
     * ALLY_API_CLIENT.saveCredentials(true); // Save credentials
     * ALLY_API_CLIENT.saveCredentials(false); // Clear saved credentials
     */
    saveCredentials: function (enable) {
      try {
        if (enable) {
          if (!_token || !_clientId) {
            logWarn("Cannot save: no credentials set");
            return false;
          }

          localStorage.setItem(
            ALLY_CONFIG.STORAGE_KEYS.SAVE_CREDENTIALS,
            "true",
          );
          localStorage.setItem(ALLY_CONFIG.STORAGE_KEYS.TOKEN, _token);
          localStorage.setItem(ALLY_CONFIG.STORAGE_KEYS.CLIENT_ID, _clientId);
          localStorage.setItem(ALLY_CONFIG.STORAGE_KEYS.REGION, _region);
          logInfo("Credentials saved to localStorage");
          return true;
        } else {
          localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.SAVE_CREDENTIALS);
          localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.TOKEN);
          localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.CLIENT_ID);
          localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.REGION);
          logInfo("Saved credentials cleared from localStorage");
          return true;
        }
      } catch (e) {
        logError("Failed to save credentials to localStorage:", e.message);
        return false;
      }
    },

    /**
     * Checks if credentials are currently set
     * @returns {boolean} True if both token and clientId are set
     *
     * @example
     * if (ALLY_API_CLIENT.hasCredentials()) {
     *   // Ready to make requests
     * }
     */
    hasCredentials: function () {
      return !!_token && !!_clientId;
    },

    // ======================================================================
    // Region Management
    // ======================================================================

    /**
     * Sets the API region
     * @param {string} regionKey - Region key (EU, US, CA, SG, AU)
     * @returns {boolean} True if region was set successfully
     *
     * @example
     * ALLY_API_CLIENT.setRegion('EU'); // Use European endpoint
     */
    setRegion: function (regionKey) {
      if (!ALLY_CONFIG.isValidRegion(regionKey)) {
        logError("Invalid region:", regionKey);
        return false;
      }

      _region = regionKey;
      logInfo("Region set to:", regionKey);
      return true;
    },

    /**
     * Gets the current region
     * @returns {string} Current region key
     *
     * @example
     * const region = ALLY_API_CLIENT.getRegion(); // 'EU'
     */
    getRegion: function () {
      return _region;
    },

    /**
     * Gets full region information
     * @returns {Object} Region configuration object
     *
     * @example
     * const regionInfo = ALLY_API_CLIENT.getRegionInfo();
     * // { name: 'European Union', baseUrl: '...', gdprCompliant: true }
     */
    getRegionInfo: function () {
      return ALLY_CONFIG.getRegion(_region);
    },

    // ======================================================================
    // API Queries
    // ======================================================================

    /**
     * Fetches data from the Overall endpoint with polling
     * @param {Object} options - Query options
     * @param {number} [options.limit=1000] - Number of results (max: 10000)
     * @param {number} [options.offset=0] - Starting position
     * @param {string} [options.sort] - Field to sort by
     * @param {string} [options.order='asc'] - Sort order ('asc' or 'desc')
     * @param {Object} [options.filters] - Filter object (field: value pairs)
     * @param {Function} [options.onProgress] - Progress callback
     * @param {Function} [options.onComplete] - Completion callback
     * @param {Function} [options.onError] - Error callback
     * @returns {Promise<Object>} API response with metadata and data
     *
     * @example
     * const result = await ALLY_API_CLIENT.fetchOverall({
     *   limit: 100,
     *   filters: { termId: '_344_1', 'overallScore': 'lt:0.5' },
     *   onProgress: (p) => console.log(p.message)
     * });
     */
    fetchOverall: function (options) {
      return executeQuery("OVERALL", options);
    },

    /**
     * Fetches data from the Issues endpoint with polling
     * @param {Object} options - Query options (same as fetchOverall)
     * @returns {Promise<Object>} API response with metadata and data
     *
     * @example
     * const issues = await ALLY_API_CLIENT.fetchIssues({ limit: 50 });
     */
    fetchIssues: function (options) {
      return executeQuery("ISSUES", options);
    },

    // ======================================================================
    // Connection Testing
    // ======================================================================

    /**
     * Tests the API connection with current credentials
     * @returns {Promise<boolean>} True if connection is successful
     *
     * @example
     * const isConnected = await ALLY_API_CLIENT.testConnection();
     * if (isConnected) {
     *   console.log('API connection successful');
     * }
     */
    testConnection: async function () {
      logInfo("Testing API connection...");

      try {
        // Attempt a minimal query
        const result = await this.fetchOverall({
          limit: 1,
          onProgress: function (progress) {
            logDebug("Connection test progress:", progress.status);
          },
        });

        const success =
          result && result.metadata && result.metadata.status === "Successful";
        logInfo("Connection test result:", success ? "Success" : "Failed");
        return success;
      } catch (error) {
        logError("Connection test failed:", error.message);
        return false;
      }
    },

    // ======================================================================
    // Request Control
    // ======================================================================

    /**
     * Cancels any in-flight request
     * @returns {boolean} True if a request was cancelled
     *
     * @example
     * // Start a long-running query
     * const queryPromise = ALLY_API_CLIENT.fetchOverall({ limit: 10000 });
     *
     * // Cancel it
     * ALLY_API_CLIENT.cancelRequest();
     */
    cancelRequest: function () {
      if (_abortController && _requestInProgress) {
        _abortController.abort();
        logInfo("Request cancelled");
        return true;
      }
      logDebug("No request to cancel");
      return false;
    },

    /**
     * Checks if a request is currently in progress
     * @returns {boolean} True if a request is in progress
     *
     * @example
     * if (ALLY_API_CLIENT.isRequestInProgress()) {
     *   console.log('Please wait for the current request to complete');
     * }
     */
    isRequestInProgress: function () {
      return _requestInProgress;
    },

    // ======================================================================
    // Error Constants (exposed for external use)
    // ======================================================================

    /**
     * Error type constants
     * @type {Object.<string, string>}
     */
    ERROR_TYPES: ERROR_TYPES,

    // ======================================================================
    // Debug Data Access
    // ======================================================================

    /**
     * Gets the debug data from the last API transaction
     * @returns {Object|null} Debug data object or null if no transaction
     *
     * @example
     * const debugData = ALLY_API_CLIENT.getDebugData();
     * if (debugData) {
     *   console.log('Last request:', debugData.request);
     *   console.log('Last response:', debugData.response);
     *   console.log('Timing:', debugData.timing);
     * }
     */
    getDebugData: function () {
      return _debugData;
    },

    /**
     * Clears the stored debug data
     */
    clearDebugData: function () {
      _debugData = null;
      logDebug("Debug data cleared");
    },
  };
})();
