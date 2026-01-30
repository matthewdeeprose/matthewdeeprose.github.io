/**
 * @fileoverview Ally Accessibility Reporting Tool - Configuration Module
 * @module AllyConfig
 * @requires None - Standalone configuration module
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Central configuration module for the Ally Accessibility Reporting Tool.
 * Provides API endpoint configuration, polling settings, filter definitions,
 * and user interface messages. Optimised for EU data processing with GDPR
 * compliance option.
 *
 * Key Features:
 * - Multi-region API endpoint support (EU, US, CA, SG, AU)
 * - Configurable polling for API warm-up
 * - Filter field definitions with operators
 * - Score threshold configuration for colour coding
 * - User-facing messages with British spelling
 *
 * Integration:
 * - Used by ally-api-client.js for API configuration
 * - Referenced by ally-ui.js for filter building
 * - Available globally via ALLY_CONFIG
 *
 * @example
 * // Get API URL for EU region
 * const url = ALLY_CONFIG.getApiUrl('OVERALL', 'my-client-id', 'EU');
 *
 * // Get score colour class
 * const colourClass = ALLY_CONFIG.getScoreColourClass(0.85);
 *
 * // Format score as percentage
 * const percentage = ALLY_CONFIG.formatScoreAsPercentage(0.856);
 */

const ALLY_CONFIG = (function () {
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
      console.error("[AllyConfig] " + message, ...args);
  }

  /**
   * Logs warning messages if warning logging is enabled
   * @param {string} message - The warning message to log
   * @param {...any} args - Additional arguments to pass to console.warn
   */
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyConfig] " + message, ...args);
  }

  /**
   * Logs informational messages if info logging is enabled
   * @param {string} message - The info message to log
   * @param {...any} args - Additional arguments to pass to console.log
   */
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyConfig] " + message, ...args);
  }

  /**
   * Logs debug messages if debug logging is enabled
   * @param {string} message - The debug message to log
   * @param {...any} args - Additional arguments to pass to console.log
   */
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyConfig] " + message, ...args);
  }

  // ========================================================================
  // Configuration Object
  // ========================================================================

  const config = {
    /**
     * Regional API endpoints
     * @type {Object.<string, Object>}
     */
    REGIONS: {
      EU: {
        name: "European Union",
        baseUrl: "https://prod-eu-central-1.ally.ac",
        location: "Frankfurt, Germany",
        gdprCompliant: true,
      },
      US: {
        name: "United States",
        baseUrl: "https://prod.ally.ac",
        location: "US East",
        gdprCompliant: false,
      },
      CA: {
        name: "Canada",
        baseUrl: "https://prod-ca-central-1.ally.ac",
        location: "Canada Central",
        gdprCompliant: false,
      },
      SG: {
        name: "Singapore",
        baseUrl: "https://prod-ap-southeast-1.ally.ac",
        location: "Singapore",
        gdprCompliant: false,
      },
      AU: {
        name: "Australia",
        baseUrl: "https://prod-ap-southeast-2.ally.ac",
        location: "Sydney",
        gdprCompliant: false,
      },
    },

    /**
     * Default region for API requests
     * @type {string}
     */
    DEFAULT_REGION: "EU",

    /**
     * API endpoints (appended to region baseUrl)
     * @type {Object.<string, string>}
     */
    ENDPOINTS: {
      OVERALL: "/api/v2/clients/{clientId}/reports/overall",
      ISSUES: "/api/v2/clients/{clientId}/reports/issues",
    },

    /**
     * Polling configuration for API warm-up
     * @type {Object}
     */
    POLLING: {
      /** Initial delay before first poll (milliseconds) */
      INITIAL_DELAY_MS: 1000,
      /** Interval between polls (milliseconds) - increased to reduce server load */
      INTERVAL_MS: 10000,
      /** Maximum number of poll attempts */
      MAX_ATTEMPTS: 30,
      /** Typical warm-up duration in seconds (based on observed behaviour) */
      TYPICAL_WARMUP_SECONDS: 180,
    },

    /**
     * Pagination defaults
     * @type {Object}
     */
    PAGINATION: {
      /** Default number of results per page */
      DEFAULT_LIMIT: 1000,
      /** Maximum allowed limit per request */
      MAX_LIMIT: 10000,
    },

    /**
     * localStorage keys for credential persistence
     * @type {Object.<string, string>}
     */
    STORAGE_KEYS: {
      TOKEN: "ally-api-token",
      CLIENT_ID: "ally-client-id",
      REGION: "ally-region",
      SAVE_CREDENTIALS: "ally-save-credentials",
    },

    /**
     * API Status States for status indicator
     * @type {Object.<string, string>}
     */
    API_STATES: {
      /** Credentials not configured */
      UNKNOWN: "UNKNOWN",
      /** API is warming up (first request after idle) */
      WARMING: "WARMING",
      /** API is ready for fast responses */
      READY: "READY",
      /** API has been idle, may need warm-up */
      IDLE: "IDLE",
      /** API connection error */
      ERROR: "ERROR",
    },

    /**
     * API Status Configuration
     * @type {Object}
     */
    API_STATUS: {
      /** Time (ms) before API transitions from READY to IDLE (3 minutes) */
      IDLE_TIMEOUT_MS: 180000,
      /** Limit for warm-up request (minimal data) */
      WARMUP_LIMIT: 1,
      /**
       * Keep API warm by auto-triggering warm-up when idle timer fires.
       * When true: READY → (3 min) → auto warm-up → READY → ...
       * When false: READY → (3 min) → IDLE (original behaviour)
       * @type {boolean}
       */
      KEEP_API_WARM: true,
      /**
       * Trigger API warm-up on page load (before user opens Ally Reporting).
       * When true: warm-up starts as soon as boilerplate.html loads
       * When false: warm-up only starts when user first opens Ally Reporting
       * @type {boolean}
       */
      WARM_ON_PAGE_LOAD: true,
    },

    /**
     * User-facing messages (British spelling)
     * @type {Object.<string, string>}
     */
    MESSAGES: {
      CONNECTING: "Connecting to Ally API...",
      WARMING_UP: "Warming up API... This may take a moment.",
      POLLING: "Retrieving data ({attempts}/{maxAttempts})...",
      SUCCESS: "Query completed successfully!",
      AUTH_ERROR: "Authentication failed. Please check your API token.",
      NETWORK_ERROR: "Network error. Please check your internet connection.",
      TIMEOUT: "Request timed out. Please try again.",
      MISSING_TOKEN: "Please enter your API token.",
      MISSING_CLIENT_ID: "Please enter your Client ID.",
      INVALID_REGION: "Invalid region specified.",
      LOADING_COURSES: "Loading course data...",
      COURSES_LOADED: "Course data loaded successfully.",
      COURSES_FAILED:
        "Failed to load course data. Course lookups will be unavailable.",
      // API Status messages
      STATUS_UNKNOWN: "Not configured",
      STATUS_WARMING: "Preparing...",
      STATUS_READY: "Ready",
      STATUS_IDLE: "Idle – may need warm-up",
      STATUS_ERROR: "Connection error",
    },

    /**
     * Filter field definitions for query building
     * Based on Ally Reporting API documentation
     * Note: courseCode is NOT valid for filtering per API docs
     * @type {Object.<string, Object>}
     */
    FILTER_FIELDS: {
      courseName: {
        type: "string",
        label: "Course Name",
        description: "The full name of the course (e.g. Chemistry 101)",
        endpoints: ["overall", "issues"],
      },
      // Note: courseId removed from filter options because:
      // 1. Internal IDs like "_111003_1" are not user-friendly
      // 2. Course Search provides better course selection
      // 3. courseName with "contains" operator handles pattern matching
      termName: {
        type: "string",
        label: "Term Name",
        description: "Academic term name (e.g. Summer)",
        endpoints: ["overall", "issues"],
      },
      // Note: termId removed - users have Term dropdown and termName filter
      departmentName: {
        type: "string",
        label: "Department Name",
        description: "Department or school name (exact match only)",
        noOperator: true,
        endpoints: ["overall", "issues"],
      },
      // Note: departmentId removed - users have Department dropdown and departmentName filter
      overallScore: {
        type: "number",
        label: "Overall Score",
        description: "Overall accessibility score (0-1 scale, e.g. 0.9 = 90%)",
        isScore: true,
        endpoints: ["overall"],
      },
      filesScore: {
        type: "number",
        label: "Files Score",
        description: "File accessibility score (0-1 scale)",
        isScore: true,
        endpoints: ["overall"],
      },
      wysiwygScore: {
        type: "number",
        label: "WYSIWYG Score",
        description: "WYSIWYG content score (LMS only, 0-1 scale)",
        isScore: true,
        endpoints: ["overall"],
      },
      allyEnabled: {
        type: "boolean",
        label: "Ally Enabled",
        description: "Whether Ally is enabled for the course",
        endpoints: ["overall", "issues"],
      },
    },

    /**
     * Operators by field type for filter construction
     * Based on Ally Reporting API documentation
     * @type {Object.<string, Array>}
     */
    OPERATORS: {
      string: [
        { value: "eq", label: "equals", symbol: "=" },
        { value: "ne", label: "does not equal", symbol: "≠" },
        { value: "co", label: "contains", symbol: "∋" },
        { value: "nc", label: "does not contain", symbol: "∌" },
        { value: "sw", label: "starts with", symbol: "^" },
      ],
      number: [
        { value: "eq", label: "equals", symbol: "=" },
        { value: "ne", label: "does not equal", symbol: "≠" },
        { value: "lt", label: "less than", symbol: "<" },
        { value: "le", label: "less than or equal", symbol: "≤" },
        { value: "gt", label: "greater than", symbol: ">" },
        { value: "ge", label: "greater than or equal", symbol: "≥" },
      ],
      boolean: [
        { value: "eq", label: "equals", symbol: "=" },
        { value: "ne", label: "does not equal", symbol: "≠" },
      ],
    },

    /**
     * Score thresholds for colour coding (0-1 scale)
     * @type {Object.<string, number>}
     */
    SCORE_THRESHOLDS: {
      EXCELLENT: 0.9,
      GOOD: 0.7,
      FAIR: 0.5,
      POOR: 0.3,
    },

    /**
     * CSS classes for score colour coding
     * @type {Object.<string, string>}
     */
    SCORE_CLASSES: {
      EXCELLENT: "score-excellent",
      GOOD: "score-good",
      FAIR: "score-fair",
      POOR: "score-poor",
      VERY_POOR: "score-very-poor",
      UNKNOWN: "score-unknown",
    },

    /**
     * Report type identifiers (Phase 7)
     * @type {Object.<string, string>}
     */
    REPORT_TYPES: {
      COURSE_REPORT: "course-report",
      STATEMENT_PREVIEW: "statement-preview",
      REPORT_BUILDER: "report-builder",
    },

    /**
     * Default report type on load (easily configurable)
     * @type {string}
     */
    DEFAULT_REPORT_TYPE: "course-report",

    /**
     * Report type display labels (British spelling)
     * @type {Object.<string, string>}
     */
    REPORT_TYPE_LABELS: {
      "course-report": "Course Report",
      "statement-preview": "Accessibility Statement Preview",
      "report-builder": "Report Builder",
    },

    /**
     * Report type descriptions for accessibility
     * @type {Object.<string, string>}
     */
    REPORT_TYPE_DESCRIPTIONS: {
      "course-report":
        "Generate detailed accessibility report for a single course",
      "statement-preview": "Preview accessibility statement for publication",
      "report-builder": "Build custom queries with filters and export options",
    },
  };

  // ========================================================================
  // Helper Functions (exposed as part of config)
  // ========================================================================

  /**
   * Gets the full API URL for an endpoint
   * @param {string} endpointKey - Key from ENDPOINTS (e.g., 'OVERALL', 'ISSUES')
   * @param {string} clientId - Client ID to substitute into the URL
   * @param {string} [regionKey] - Region key, defaults to DEFAULT_REGION
   * @returns {string|null} Full API URL or null if invalid parameters
   *
   * @example
   * const url = ALLY_CONFIG.getApiUrl('OVERALL', 'my-client-123', 'EU');
   * // Returns: 'https://prod-eu-central-1.ally.ac/api/v2/clients/my-client-123/reports/overall'
   */
  config.getApiUrl = function (endpointKey, clientId, regionKey) {
    regionKey = regionKey || config.DEFAULT_REGION;
    const region = config.REGIONS[regionKey];
    const endpoint = config.ENDPOINTS[endpointKey];

    if (!region) {
      logError("Invalid region key:", regionKey);
      return null;
    }

    if (!endpoint) {
      logError("Invalid endpoint key:", endpointKey);
      return null;
    }

    if (!clientId || typeof clientId !== "string") {
      logError("Invalid client ID provided");
      return null;
    }

    return region.baseUrl + endpoint.replace("{clientId}", clientId);
  };

  /**
   * Gets operators for a specific field type
   * @param {string} fieldKey - Key from FILTER_FIELDS
   * @returns {Array} Array of operator objects, empty array if field not found
   *
   * @example
   * const operators = ALLY_CONFIG.getOperatorsForField('overallScore');
   * // Returns: [{ value: 'eq', label: 'equals', symbol: '=' }, ...]
   */
  config.getOperatorsForField = function (fieldKey) {
    const field = config.FILTER_FIELDS[fieldKey];
    if (!field) {
      logWarn("Unknown filter field:", fieldKey);
      return [];
    }
    return config.OPERATORS[field.type] || [];
  };

  /**
   * Gets the field definition for a filter field
   * @param {string} fieldKey - Key from FILTER_FIELDS
   * @returns {Object|null} Field definition or null if not found
   */
  config.getFieldDefinition = function (fieldKey) {
    return config.FILTER_FIELDS[fieldKey] || null;
  };

  /**
   * Gets CSS class for score colour coding
   * @param {number} score - Score between 0 and 1
   * @returns {string} CSS class name for the score level
   *
   * @example
   * ALLY_CONFIG.getScoreColourClass(0.95); // Returns: 'score-excellent'
   * ALLY_CONFIG.getScoreColourClass(0.75); // Returns: 'score-good'
   * ALLY_CONFIG.getScoreColourClass(0.45); // Returns: 'score-fair'
   */
  config.getScoreColourClass = function (score) {
    if (typeof score !== "number" || isNaN(score)) {
      return config.SCORE_CLASSES.UNKNOWN;
    }

    if (score >= config.SCORE_THRESHOLDS.EXCELLENT) {
      return config.SCORE_CLASSES.EXCELLENT;
    }
    if (score >= config.SCORE_THRESHOLDS.GOOD) {
      return config.SCORE_CLASSES.GOOD;
    }
    if (score >= config.SCORE_THRESHOLDS.FAIR) {
      return config.SCORE_CLASSES.FAIR;
    }
    if (score >= config.SCORE_THRESHOLDS.POOR) {
      return config.SCORE_CLASSES.POOR;
    }
    return config.SCORE_CLASSES.VERY_POOR;
  };

  /**
   * Formats a score (0-1) as a percentage string
   * @param {number} score - Score between 0 and 1
   * @param {number} [decimals=1] - Number of decimal places
   * @returns {string} Formatted percentage (e.g., "85.6%") or "N/A" if invalid
   *
   * @example
   * ALLY_CONFIG.formatScoreAsPercentage(0.856);    // Returns: "85.6%"
   * ALLY_CONFIG.formatScoreAsPercentage(0.856, 2); // Returns: "85.60%"
   * ALLY_CONFIG.formatScoreAsPercentage(null);     // Returns: "N/A"
   */
  config.formatScoreAsPercentage = function (score, decimals) {
    if (typeof score !== "number" || isNaN(score)) {
      return "N/A";
    }
    decimals = typeof decimals === "number" ? decimals : 1;
    return (score * 100).toFixed(decimals) + "%";
  };

  /**
   * Gets the polling message with attempt count substituted
   * @param {number} attempts - Current attempt number
   * @returns {string} Formatted polling message
   *
   * @example
   * ALLY_CONFIG.getPollingMessage(5); // Returns: "Retrieving data (5/30)..."
   */
  config.getPollingMessage = function (attempts) {
    return config.MESSAGES.POLLING.replace("{attempts}", attempts).replace(
      "{maxAttempts}",
      config.POLLING.MAX_ATTEMPTS,
    );
  };

  /**
   * Validates a region key
   * @param {string} regionKey - Region key to validate
   * @returns {boolean} True if the region key is valid
   *
   * @example
   * ALLY_CONFIG.isValidRegion('EU'); // Returns: true
   * ALLY_CONFIG.isValidRegion('XX'); // Returns: false
   */
  config.isValidRegion = function (regionKey) {
    return Object.prototype.hasOwnProperty.call(config.REGIONS, regionKey);
  };

  /**
   * Gets all available region keys
   * @returns {string[]} Array of region keys
   *
   * @example
   * ALLY_CONFIG.getAvailableRegions(); // Returns: ['EU', 'US', 'CA', 'SG', 'AU']
   */
  config.getAvailableRegions = function () {
    return Object.keys(config.REGIONS);
  };

  /**
   * Gets region details by key
   * @param {string} regionKey - Region key
   * @returns {Object|null} Region configuration or null if not found
   */
  config.getRegion = function (regionKey) {
    return config.REGIONS[regionKey] || null;
  };

  /**
   * Gets all filter field keys
   * @returns {string[]} Array of filter field keys
   */
  config.getFilterFieldKeys = function () {
    return Object.keys(config.FILTER_FIELDS);
  };

  /**
   * Gets filter field keys valid for a specific endpoint
   * @param {string} endpoint - Endpoint name ('overall' or 'issues')
   * @returns {string[]} Array of filter field keys valid for the endpoint
   *
   * @example
   * ALLY_CONFIG.getFilterFieldKeysForEndpoint('overall');
   * // Returns all fields including score fields
   *
   * ALLY_CONFIG.getFilterFieldKeysForEndpoint('issues');
   * // Returns fields without score fields (overallScore, filesScore, wysiwygScore)
   */
  config.getFilterFieldKeysForEndpoint = function (endpoint) {
    const normalised = (endpoint || "overall").toLowerCase();
    return Object.keys(config.FILTER_FIELDS).filter(function (key) {
      const field = config.FILTER_FIELDS[key];
      // If no endpoints specified, assume available for all
      if (!field.endpoints || field.endpoints.length === 0) {
        return true;
      }
      return field.endpoints.includes(normalised);
    });
  };

  /**
   * Checks if a filter field is valid for a specific endpoint
   * @param {string} fieldKey - The filter field key
   * @param {string} endpoint - Endpoint name ('overall' or 'issues')
   * @returns {boolean} True if the field is valid for the endpoint
   */
  config.isFieldValidForEndpoint = function (fieldKey, endpoint) {
    const field = config.FILTER_FIELDS[fieldKey];
    if (!field) return false;

    const normalised = (endpoint || "overall").toLowerCase();
    // If no endpoints specified, assume available for all
    if (!field.endpoints || field.endpoints.length === 0) {
      return true;
    }
    return field.endpoints.includes(normalised);
  };

  /**
   * Checks if a field is a score field (for special formatting)
   * @param {string} fieldKey - Field key to check
   * @returns {boolean} True if the field is a score field
   */
  config.isScoreField = function (fieldKey) {
    const field = config.FILTER_FIELDS[fieldKey];
    return field ? !!field.isScore : false;
  };

  /**
   * Gets a storage key with optional prefix
   * @param {string} keyName - Key name from STORAGE_KEYS
   * @returns {string|null} Storage key or null if not found
   */
  config.getStorageKey = function (keyName) {
    return config.STORAGE_KEYS[keyName] || null;
  };

  /**
   * Validates configuration integrity (for debugging)
   * @returns {Object} Validation result with status and any issues found
   */
  config.validateConfiguration = function () {
    const issues = [];

    // Check regions have required fields
    Object.entries(config.REGIONS).forEach(function (entry) {
      var key = entry[0];
      var region = entry[1];
      if (!region.baseUrl) {
        issues.push("Region " + key + " missing baseUrl");
      }
      if (!region.name) {
        issues.push("Region " + key + " missing name");
      }
    });

    // Check endpoints exist
    if (Object.keys(config.ENDPOINTS).length === 0) {
      issues.push("No endpoints defined");
    }

    // Check filter fields have valid types
    Object.entries(config.FILTER_FIELDS).forEach(function (entry) {
      var key = entry[0];
      var field = entry[1];
      if (!config.OPERATORS[field.type]) {
        issues.push("Filter field " + key + " has invalid type: " + field.type);
      }
    });

    return {
      valid: issues.length === 0,
      issues: issues,
    };
  };

  // Log initialisation
  logInfo("ALLY_CONFIG initialised");

  // Return the public API
  return config;
})();

// Tests moved to ally-tests.js
