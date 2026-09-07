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
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
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
      STATEMENT_ENVIRONMENT: "ally-statement-environment",
      // Phase 3: per-browser override for the statement-refresh feature flag.
      // When present, its "true"/"false" value overrides STATEMENT_REFRESH_ENABLED.
      STATEMENT_REFRESH_ENABLED: "ally-statement-refresh-enabled",
      // Base URL of an Ally proxy Worker (no trailing /issues or /query — those
      // are derived). Carries no credential, so unlike TOKEN/CLIENT_ID/REGION it
      // deliberately SURVIVES an unchecked-"Remember credentials" clear: it is
      // the fallback that keeps the app working without a token.
      WORKER_URL: "ally-worker-url",

      // Stage 3 tenant identity. These three are the ONLY new storage the
      // tenant record introduces: region, client id, token and worker URL keep
      // their existing keys above, and the record is a VIEW over them rather
      // than a second copy. Two sources of truth for a credential is how the
      // stored/live divergence Stage 1 closed came about in the first place.
      TENANT_ID: "ally-tenant-id",
      TENANT_NAME: "ally-tenant-name",
      TENANT_DATA_SOURCE: "ally-tenant-data-source",

      // Stage 6: where a tenant's course data is fetched from, and in which
      // form. Not credentials: like WORKER_URL they survive an unticked
      // Remember box and go only on an explicit clear. The URL is kept when
      // the fetched copy is removed, so a refresh does not mean re-typing it.
      TENANT_DATA_URL: "ally-tenant-data-url",
      TENANT_DATA_URL_FORMAT: "ally-tenant-data-url-format",
    },

    /**
     * Built-in default Ally proxy Worker, used when no WORKER_URL is configured.
     * BASE url only — callers derive /issues and /query from it via
     * getWorkerEndpointUrl(). The Worker holds a read-only Ally token as a
     * server-side secret; see ally-issues-proxy/worker.js.
     * @type {string}
     */
    DEFAULT_WORKER_URL: "https://ally-issues-proxy.matthewdeeprose.workers.dev",

    /**
     * Built-in default Ally client id, used when no CLIENT_ID is configured.
     * NOT a secret: it already appears verbatim in the placeholder text of both
     * Ally forms in tools.html, and it identifies an institution rather than
     * authorising anything on its own. It is nonetheless supplied ONLY to a
     * colleague with an institutional sign-in — read it through
     * getEffectiveClientId(), which gates the default on that sign-in, rather
     * than reading this property directly.
     * @type {string}
     */
    DEFAULT_CLIENT_ID: "577",

    /**
     * Discriminator written into an exported tenant configuration file and
     * required on import. A JSON file that does not carry it is refused rather
     * than partly applied — an import overwrites live credentials, so "looks
     * like JSON" is nowhere near a strong enough test to act on.
     * @type {string}
     */
    TENANT_RECORD_KIND: "ally-tenant-configuration",

    /**
     * Schema version of the exported tenant record. Bump it only for a change
     * an older reader could MISREAD; parseTenantRecord refuses a version it
     * does not know rather than guessing at the shape.
     * @type {number}
     */
    TENANT_RECORD_VERSION: 1,

    /**
     * Where a tenant's course data comes from. BUNDLED is the Southampton
     * default, UPLOAD is an export parsed in the browser (Stage 4), and REMOTE
     * is a payload fetched once from a URL and stored (Stage 6). The record
     * carried the field from Stage 3, so an export written then still parses
     * now, with no version bump to gain a key.
     * @type {Object.<string, string>}
     */
    DATA_SOURCES: Object.freeze({
      BUNDLED: "bundled",
      UPLOAD: "upload",
      REMOTE: "remote",
    }),

    /**
     * The two forms a hosted course payload can take (Stage 6). JSON is a
     * data-only fetch and the default. SCRIPT loads the converter's two
     * generated modules by <script src> — it works from any host, and it runs
     * that host's code inside this origin beside every stored key, which is
     * why it is an explicit opt-in with a visible warning and never a default.
     * @type {Object.<string, string>}
     */
    DATA_URL_FORMATS: Object.freeze({
      JSON: "json",
      SCRIPT: "script",
    }),

    /**
     * The format assumed when none is stored or a record names none.
     * @type {string}
     */
    DEFAULT_DATA_URL_FORMAT: "json",

    /**
     * Hosts a browser treats as secure without https. Mixed-content blocking
     * never applies to them, and they are where the preview server lives, so
     * normaliseDataUrl accepts http for these and refuses it everywhere else.
     * @type {Array<string>}
     */
    LOOPBACK_HOSTS: Object.freeze(["localhost", "127.0.0.1", "[::1]"]),

    /**
     * Paths the proxy Worker exposes, appended to the base worker URL.
     * POST /issues — the single-course export-refresh contract (load-bearing for
     * already-distributed exports). POST /query — the general report query that
     * backs the app when no API token is set.
     * @type {Object.<string, string>}
     */
    WORKER_PATHS: {
      ISSUES: "/issues",
      QUERY: "/query",
    },

    /**
     * Phase 3 feature flag — code default for the "Update accessibility data"
     * live-refresh capability in exported statements. Read at EXPORT time, so
     * flipping it changes only future exports; already-distributed files are
     * unaffected. A GUI toggle persists a per-browser override in localStorage
     * (STORAGE_KEYS.STATEMENT_REFRESH_ENABLED) which wins over this default;
     * resolve the effective value via isStatementRefreshEnabled().
     * @type {boolean}
     */
    STATEMENT_REFRESH_ENABLED: false,

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
      // The next three cover the Entra sign-in gate on the WORKER transport
      // only. On the direct-token transport AUTH_ERROR above stays correct,
      // because there the person's own API token really is the thing at fault.
      //
      // Each sentence is followed by the short heading that goes above it on
      // the API status card. The PAIRING is load-bearing: apiErrorInfo() in
      // ally-main-controller.js matches an error's message by identity against
      // the sentence here, then uses the STATUS_ key beside it as the label.
      // So a sentence and its heading must be edited together, and a sentence
      // must never be duplicated under a second key — identity is the match.
      //
      // ADDING A PAIR HERE IS NOT SUFFICIENT ON ITS OWN. apiErrorInfo() does
      // not iterate this object; it matches against a hard-coded array,
      // statusAwareHeadings in ally-main-controller.js, and a sentence absent
      // from that array falls straight through to the generic SERVER branch and
      // is labelled "Ally service unavailable" — which names the wrong system
      // whenever the fault is ours. A new pair here therefore needs a matching
      // entry there, in the same order, or the sentence is computed correctly
      // and discarded one function short of the screen.
      //
      // The fallback heading in apiErrorInfo() covers less than it looks like
      // it does. It is reached only when a STATUS_ key here is missing. Remove
      // a SENTENCE key instead and the client stops attaching that sentence at
      // all, so nothing matches, the card falls back to the generic connection
      // error, and the fallback heading is never reached. Neither key is
      // optional; the fallback protects one of the pair, not the pairing.
      SIGN_IN_REQUIRED:
        "You are not signed in. Please sign in with your University account, " +
        "then run the report again.",
      // Heading for SIGN_IN_REQUIRED. "Connection error" is wrong here —
      // nothing failed to connect.
      STATUS_SIGN_IN_REQUIRED: "Sign-in required",
      // The fact is flat, not hedged: the Worker has already decided, so only
      // the cause is uncertain, and the uncertainty belongs on the remedy.
      // Deliberately does NOT suggest signing in again — the person already is
      // signed in, and repeating the sign-in cannot change the answer. Matches
      // the choice made for Chat under F2.
      NOT_PERMITTED:
        "Your account cannot use this service. If you think that is wrong, " +
        "please contact the service owner.",
      // Heading for NOT_PERMITTED.
      STATUS_NOT_PERMITTED: "Account not permitted",
      // The Microsoft-outage case. Must not read as the person's fault, and
      // must invite a retry, because waiting genuinely can fix this one.
      SIGN_IN_CHECK_UNAVAILABLE:
        "We could not check your sign-in just now. Please try again shortly.",
      // Heading for SIGN_IN_CHECK_UNAVAILABLE. "Ally service unavailable" is
      // wrong here — Ally never saw the request.
      STATUS_SIGN_IN_CHECK_UNAVAILABLE: "Sign-in check unavailable",
      // The worker-transport 502. Two causes arrive on this one status and the
      // client cannot tell them apart, by design: the Worker remaps an upstream
      // 401 or 403 on /query to 502 so a rejected ALLY_API_TOKEN cannot wear
      // the same status the Entra gate uses for the person's own credentials —
      // and a genuine Ally fault is a 502 in its own right. The sentence must
      // therefore be true of both, name neither, and above all deny the one
      // thing that is certainly not at fault: the person's sign-in. The remedy
      // is escalation, not a retry, because no action of theirs can help.
      REPORTING_SERVICE_ERROR:
        "The reporting service returned an error this tool cannot resolve. " +
        "Your sign-in is not the problem. If this continues, please contact " +
        "the service owner.",
      // Heading for REPORTING_SERVICE_ERROR. "Ally service unavailable" is
      // wrong here — it names Ally when our own token may be the cause.
      STATUS_REPORTING_SERVICE_ERROR: "Reporting service error",
      NETWORK_ERROR: "Network error. Please check your internet connection.",
      TIMEOUT: "Request timed out. Please try again.",
      MISSING_TOKEN: "Please enter your API token.",
      MISSING_CLIENT_ID: "Please enter your Client ID.",
      // A signed-out colleague with no transport of their own has an empty
      // client ID field BECAUSE they are signed out: getEffectiveClientId()
      // gates DEFAULT_CLIENT_ID on hasInstitutionalSignIn(). MISSING_CLIENT_ID
      // is therefore the wrong instruction for them — it sends them to the
      // Institutional Report for an ID they were never issued. Deliberately
      // NOT a reuse of SIGN_IN_REQUIRED: that sentence is matched by MESSAGE
      // IDENTITY in apiErrorInfo's statusAwareHeadings array, and putting one
      // string on both a gated error path and an ungated validation path is
      // the exact collision that array's comment warns about. Its wording is
      // also wrong here — it ends "then run the report again", and nothing
      // has been run.
      //
      // Names both routes because both are real: signing in alone is a
      // complete instruction under goal A, and a person without a University
      // account can still use their own client ID and token.
      SIGN_IN_OR_CREDENTIALS:
        "Sign in with your University account to use Ally Reporting. If you " +
        "do not have one, enter your Client ID and API token instead.",
      // Shown when neither transport is available. The app needs a client ID and
      // region, then EITHER an API token OR a proxy worker URL.
      MISSING_CREDENTIALS:
        "Please enter your API token, or a proxy worker URL.",
      // A worker origin-rejection (403) carries no Access-Control-Allow-Origin
      // header, so in a browser it is INDISTINGUISHABLE from an unreachable
      // worker. This message must therefore cover both causes and claim neither.
      WORKER_UNREACHABLE:
        "Could not reach the proxy worker. Check the worker URL is correct, " +
        "and that this site's address is on the worker's allow-list.",
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
      STATUS_SERVER_ERROR: "Ally service unavailable",
      // Status hints — shown beneath the status indicator. The credentials hint
      // is the default for genuine auth failures; the others make clear when the
      // fault is at Ally's end (a 502/503/504 or an unreachable server) rather
      // than a problem the user can fix by re-checking their token.
      CREDENTIALS_HINT: "Please check your credentials and try again.",
      SERVER_ERROR_HINT:
        "This looks like a temporary problem at Ally's end, not your credentials. Please wait a few minutes and try again.",
      NETWORK_HINT:
        "Could not reach the Ally service. Check your internet connection and try again.",
      TIMEOUT_HINT:
        "The Ally service did not respond in time. It may be busy — please try again shortly.",
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
      trends: "Accessibility Over Time",
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
   * Resolves the effective state of the Phase 3 statement-refresh feature flag.
   * A per-browser localStorage override (set by the GUI toggle) wins over the
   * STATEMENT_REFRESH_ENABLED code default; only the exact strings "true"/"false"
   * are honoured as an override, anything else (or an unreadable/partitioned
   * store) falls back to the code default. The export path calls this to decide
   * whether to bake the refresh island + embed into an export.
   * @returns {boolean} True if statement refresh is enabled in this environment.
   *
   * @example
   * if (ALLY_CONFIG.isStatementRefreshEnabled()) { // build the refresh island }
   */
  config.isStatementRefreshEnabled = function () {
    try {
      const override = window.localStorage.getItem(
        config.STORAGE_KEYS.STATEMENT_REFRESH_ENABLED,
      );
      if (override === "true") return true;
      if (override === "false") return false;
    } catch (e) {
      logWarn("Could not read statement-refresh override:", e.message);
    }
    return config.STATEMENT_REFRESH_ENABLED === true;
  };

  /**
   * Normalises a pasted proxy-Worker URL down to its BASE form.
   *
   * Users may paste any of the forms the docs and exports show, so strip a
   * trailing endpoint path and any trailing slashes. Only absolute http(s) URLs
   * are accepted; anything else returns "" so a bad paste is never persisted.
   *
   * @param {string} url - Raw user input
   * @returns {string} Normalised base URL, or "" if unusable
   *
   * @example
   * ALLY_CONFIG.normaliseWorkerUrl("https://example.workers.dev/issues/");
   * // Returns: 'https://example.workers.dev'
   */
  config.normaliseWorkerUrl = function (url) {
    if (!url || typeof url !== "string") return "";

    let trimmed = url.trim();
    if (!trimmed) return "";

    // Reject anything that is not an absolute http(s) URL before touching it.
    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch (e) {
      logWarn("Worker URL is not a valid absolute URL:", trimmed);
      return "";
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      logWarn("Worker URL must be http or https, got:", parsed.protocol);
      return "";
    }

    // Drop any query string or fragment — the base URL carries neither.
    trimmed = parsed.origin + parsed.pathname;

    // Strip trailing slashes, then a trailing endpoint path, then slashes again
    // (so ".../issues/" and ".../issues" both reduce to the same base).
    trimmed = trimmed.replace(/\/+$/, "");
    Object.values(config.WORKER_PATHS).forEach(function (path) {
      if (trimmed.toLowerCase().endsWith(path)) {
        trimmed = trimmed.slice(0, -path.length);
      }
    });
    trimmed = trimmed.replace(/\/+$/, "");

    return trimmed;
  };

  /**
   * Normalises a course-data URL (multi-tenancy Stage 6).
   *
   * Same idiom as normaliseWorkerUrl — new URL() in a try/catch, a protocol
   * check, origin + pathname, trailing slashes stripped — with ONE stricter
   * rule: https only, except on a loopback host. The production site is
   * https, so the browser would block an http fetch or script as mixed
   * content anyway; refusing here produces a sentence where the browser
   * would fail silently. The query string and fragment are dropped: a JSON
   * file needs neither, and the script route appends two filenames to what
   * is returned, which a query string would break.
   *
   * @param {string} url - Raw user input
   * @returns {string} Normalised URL, or "" if unusable
   *
   * @example
   * ALLY_CONFIG.normaliseDataUrl("https://example.github.io/ally/ally-course-payload.json ");
   * // Returns: 'https://example.github.io/ally/ally-course-payload.json'
   */
  config.normaliseDataUrl = function (url) {
    if (!url || typeof url !== "string") return "";

    const trimmed = url.trim();
    if (!trimmed) return "";

    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch (e) {
      logWarn("Data URL is not a valid absolute URL:", trimmed);
      return "";
    }

    const loopback = config.LOOPBACK_HOSTS.indexOf(parsed.hostname) !== -1;
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) {
      logWarn("Data URL must be https, got:", parsed.protocol);
      return "";
    }

    return (parsed.origin + parsed.pathname).replace(/\/+$/, "");
  };

  /**
   * Whether a value names one of the two payload formats.
   * @param {*} value
   * @returns {boolean}
   */
  config.isValidDataUrlFormat = function (value) {
    return Object.values(config.DATA_URL_FORMATS).indexOf(value) !== -1;
  };

  /**
   * Resolves the effective Ally proxy-Worker BASE url: a configured
   * localStorage value wins over the DEFAULT_WORKER_URL code default. An
   * unreadable or partitioned store falls back to the default rather than
   * throwing. Never returns a trailing slash.
   * @returns {string} Worker base URL
   *
   * @example
   * const url = ALLY_CONFIG.getWorkerUrl(); // 'https://…workers.dev'
   */
  config.getWorkerUrl = function () {
    try {
      const stored = window.localStorage.getItem(config.STORAGE_KEYS.WORKER_URL);
      const normalised = config.normaliseWorkerUrl(stored);
      if (normalised) return normalised;
    } catch (e) {
      logWarn("Could not read configured worker URL:", e.message);
    }
    return config.DEFAULT_WORKER_URL;
  };

  /**
   * Reports whether the user has configured their OWN worker URL, as distinct
   * from falling back to DEFAULT_WORKER_URL. getWorkerUrl() always returns a
   * usable URL, so callers that need to know whether the user actually supplied
   * one — a credential guard, a status summary — must ask this instead.
   * @returns {boolean} True if a valid worker URL is stored
   */
  config.hasConfiguredWorkerUrl = function () {
    try {
      const stored = window.localStorage.getItem(config.STORAGE_KEYS.WORKER_URL);
      return !!config.normaliseWorkerUrl(stored);
    } catch (e) {
      logWarn("Could not read configured worker URL:", e.message);
      return false;
    }
  };

  /**
   * Reports whether this browser has an institutional Entra sign-in available.
   *
   * LOAD-BEARING: every part of the window.EntraAuth read happens INSIDE this
   * function body, deliberately. ally-config.js is a BLOCKING classic script at
   * tools.html:23075 and auth/entra-auth.js is DEFERRED at tools.html:23126, so
   * window.EntraAuth does not exist at the moment this module evaluates. A
   * module-scope capture would be permanently undefined and this predicate
   * would answer false forever. Do not hoist the lookup.
   *
   * @returns {boolean} True only when EntraAuth is present and reports signed in
   */
  config.hasInstitutionalSignIn = function () {
    try {
      const auth = window.EntraAuth;
      if (!auth || typeof auth.isSignedIn !== "function") return false;
      return auth.isSignedIn() === true;
    } catch (e) {
      logWarn("Could not read institutional sign-in state:", e.message);
      return false;
    }
  };

  /**
   * Reports whether a worker request will succeed for this person right now.
   *
   * This is NOT hasConfiguredWorkerUrl() under another name, and neither
   * replaces the other. hasConfiguredWorkerUrl() answers "did the user supply
   * their OWN worker URL" — a question about configuration, deliberately
   * falsifiable, and the right guard for a settings summary. This one answers
   * "will a worker request succeed for this person right now", which is also
   * true for a signed-in colleague who has configured nothing at all.
   *
   * @returns {boolean} True if a stored worker URL or an institutional sign-in
   *   makes a worker request viable
   */
  config.hasUsableWorkerUrl = function () {
    return config.hasConfiguredWorkerUrl() || config.hasInstitutionalSignIn();
  };

  /**
   * Resolves the effective Ally client id: a stored CLIENT_ID wins, otherwise
   * DEFAULT_CLIENT_ID — but only for a signed-in colleague. The default is
   * GATED on institutional sign-in, so a signed-out caller with nothing stored
   * gets an empty string rather than an id they were never given.
   *
   * Always returns a string; never null and never undefined. An unreadable or
   * partitioned store falls through to the sign-in branch rather than throwing
   * or short-circuiting to "".
   *
   * @returns {string} The client id, or "" when none applies
   */
  config.getEffectiveClientId = function () {
    try {
      const stored = window.localStorage.getItem(config.STORAGE_KEYS.CLIENT_ID);
      const trimmed = typeof stored === "string" ? stored.trim() : "";
      if (trimmed) return trimmed;
    } catch (e) {
      logWarn("Could not read configured client id:", e.message);
    }
    return config.hasInstitutionalSignIn() ? config.DEFAULT_CLIENT_ID : "";
  };

  /**
   * Builds a full worker endpoint URL from the configured base.
   * @param {string} pathKey - Key from WORKER_PATHS ('ISSUES' | 'QUERY')
   * @param {string} [baseUrl] - Explicit base, defaults to getWorkerUrl()
   * @returns {string|null} Full endpoint URL, or null for an unknown pathKey
   *
   * @example
   * ALLY_CONFIG.getWorkerEndpointUrl('QUERY');
   * // Returns: 'https://…workers.dev/query'
   */
  config.getWorkerEndpointUrl = function (pathKey, baseUrl) {
    const path = config.WORKER_PATHS[pathKey];
    if (!path) {
      logError("Invalid worker path key:", pathKey);
      return null;
    }

    const base =
      baseUrl !== undefined && baseUrl !== null && baseUrl !== ""
        ? config.normaliseWorkerUrl(baseUrl)
        : config.getWorkerUrl();
    if (!base) return null;

    return base + path;
  };

  // ==========================================================================
  // Tenant record (Stage 3) — one institution's configuration, exportable
  // ==========================================================================
  //
  // A tenant record is a VIEW over the credential keys above plus three
  // identity keys, NOT a second copy of them. Region, client id, token and
  // worker URL keep their own storage and their own owners; nothing here
  // becomes an alternative source of truth for a credential.
  //
  // Read § "Two constraints that will bite" in
  // ally-scripts/docs/multi-tenancy-stage-3-dispatch.md before changing any of
  // this. The short form:
  //
  //   1. LIVE credentials are authoritative. Resolving a tenant from
  //      localStorage alone reintroduces the cross-institution cache leak
  //      Stage 1 closed, and it fails SILENTLY — the tool works, the scope is
  //      just wrong.
  //   2. DEFAULT_CLIENT_ID must stay unreachable from here. This is a NEW
  //      resolution path and must not become a second route to Southampton's
  //      id, so nothing below calls getEffectiveClientId().

  /**
   * Reads the client id and region the API client is CURRENTLY querying under.
   *
   * Deliberately mirrors the private readLiveCredentials() in
   * ally-scripts/core/ally-cache.js rather than sharing it: that function is
   * module-private and this file loads before it. The two must agree, so a
   * change to either belongs in both.
   *
   * The pair is ATOMIC. The client's region always holds a value — it defaults
   * to EU at load — so reading the region alone would override a stored region
   * for a client that was never configured at all.
   *
   * ALLY_API_CLIENT is read INSIDE the function body: ally-api-client.js is a
   * LATER <script> than this file, so a module-scope capture would be
   * permanently undefined. Same rule as hasInstitutionalSignIn() above.
   *
   * @returns {{clientId: string, region: string}|null} The live pair, or null
   *   when the client is absent, unloaded, or holds no client id
   */
  config.readLiveTenantIdentity = function () {
    try {
      if (
        typeof ALLY_API_CLIENT === "undefined" ||
        !ALLY_API_CLIENT ||
        typeof ALLY_API_CLIENT.getCredentials !== "function"
      ) {
        return null;
      }

      const creds = ALLY_API_CLIENT.getCredentials();
      const clientId =
        creds && typeof creds.clientId === "string" ? creds.clientId.trim() : "";
      if (!clientId) return null;

      return {
        clientId: clientId,
        region:
          creds && typeof creds.region === "string" ? creds.region.trim() : "",
      };
    } catch (e) {
      logWarn("Could not read live tenant identity:", e.message);
      return null;
    }
  };

  /**
   * Reads a stored value and trims it, returning "" for anything unusable.
   * @private
   * @param {string} key - A STORAGE_KEYS value
   * @returns {string} Trimmed stored value, or ""
   */
  function readStoredTrimmed(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return typeof raw === "string" ? raw.trim() : "";
    } catch (e) {
      logWarn("Could not read " + key + ":", e.message);
      return "";
    }
  }

  /**
   * Caps a free-text field so a hostile or corrupt file cannot write an
   * unbounded string into localStorage.
   * @private
   */
  const TENANT_TEXT_MAX_LENGTH = 120;

  /**
   * Builds the tenant record describing this browser's current configuration.
   *
   * The client id and region come from the LIVE API client when it holds a
   * client id, and from storage otherwise — as one pair, never mixed. See
   * constraint 1 above.
   *
   * The stored client id is read RAW. getEffectiveClientId() is deliberately
   * NOT used, because its sign-in-gated fallback to DEFAULT_CLIENT_ID would
   * make an export from a signed-in colleague's browser silently carry
   * Southampton's client id to another institution. See constraint 2.
   *
   * @param {Object} [options] - Options
   * @param {boolean} [options.includeToken=false] - Include the API token. The
   *   token is a credential: anyone holding the exported file can query as the
   *   exporter, so this is opt-in and defaults to OFF.
   * @returns {Object} The tenant record. The `token` key is ABSENT rather than
   *   empty when not included, so a reader can tell "withheld" from "blank".
   *
   * @example
   * const record = ALLY_CONFIG.getTenantRecord({ includeToken: false });
   */
  config.getTenantRecord = function (options) {
    const includeToken = !!(options && options.includeToken === true);

    const live = config.readLiveTenantIdentity();
    const clientId = live
      ? live.clientId
      : readStoredTrimmed(config.STORAGE_KEYS.CLIENT_ID);
    const rawRegion = live
      ? live.region
      : readStoredTrimmed(config.STORAGE_KEYS.REGION);
    const region = config.isValidRegion(rawRegion)
      ? rawRegion
      : config.DEFAULT_REGION || "EU";

    const storedDataSource = readStoredTrimmed(
      config.STORAGE_KEYS.TENANT_DATA_SOURCE,
    );
    const dataSource = Object.values(config.DATA_SOURCES).includes(
      storedDataSource,
    )
      ? storedDataSource
      : config.DATA_SOURCES.BUNDLED;

    const record = {
      kind: config.TENANT_RECORD_KIND,
      version: config.TENANT_RECORD_VERSION,
      // A stable handle for this tenant. Falls back to the same shape the cache
      // uses for its scope token, so the two read alike in a log line.
      id:
        readStoredTrimmed(config.STORAGE_KEYS.TENANT_ID) ||
        (clientId ? clientId + "@" + region : ""),
      displayName: readStoredTrimmed(config.STORAGE_KEYS.TENANT_NAME),
      region: region,
      clientId: clientId,
      dataSource: dataSource,
    };

    // Only a worker URL the user CONFIGURED is exported. DEFAULT_WORKER_URL is
    // Southampton's proxy — origin-restricted to *.soton.ac.uk and gated on
    // Southampton's Entra tenant — so exporting it would hand another
    // institution an endpoint that can only fail for them, confusingly.
    if (config.hasConfiguredWorkerUrl()) {
      record.workerUrl = config.getWorkerUrl();
    }

    // The course-data URL and its format travel together, and only when a
    // URL that normalises is stored: a format with no URL describes nothing.
    // Not a secret - it is where a colleague's copy of the tool will fetch
    // the institution's course data from, which is the point of exporting it.
    const dataUrl = config.normaliseDataUrl(
      readStoredTrimmed(config.STORAGE_KEYS.TENANT_DATA_URL),
    );
    if (dataUrl) {
      record.dataUrl = dataUrl;
      const storedFormat = readStoredTrimmed(
        config.STORAGE_KEYS.TENANT_DATA_URL_FORMAT,
      );
      record.dataUrlFormat = config.isValidDataUrlFormat(storedFormat)
        ? storedFormat
        : config.DEFAULT_DATA_URL_FORMAT;
    }

    if (includeToken) {
      const token = readStoredTrimmed(config.STORAGE_KEYS.TOKEN);
      if (token) record.token = token;
    }

    return record;
  };

  /**
   * Serialises a tenant record for download.
   *
   * `exportedAt` is stamped HERE rather than in getTenantRecord() so that
   * function stays deterministic and comparable between calls.
   *
   * @param {Object} record - A record from getTenantRecord()
   * @returns {string} Pretty-printed JSON
   */
  config.serialiseTenantRecord = function (record) {
    const payload = Object.assign({}, record, {
      exportedAt: new Date().toISOString(),
    });
    return JSON.stringify(payload, null, 2);
  };

  /**
   * Parses and VALIDATES an exported tenant record.
   *
   * Refuses rather than half-applies. An import overwrites live credentials, so
   * every field is checked here and applyTenantRecord() receives only a
   * normalised record — a caller can never write raw file content to storage.
   *
   * @param {string} text - Raw file contents
   * @returns {{ok: boolean, record: (Object|null), error: string}} A normalised
   *   record on success; a human-readable reason on failure
   *
   * @example
   * const parsed = ALLY_CONFIG.parseTenantRecord(fileText);
   * if (!parsed.ok) showError(parsed.error);
   */
  config.parseTenantRecord = function (text) {
    function refuse(reason) {
      return { ok: false, record: null, error: reason };
    }

    let raw;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return refuse("That file is not valid JSON.");
    }

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return refuse("That file does not contain an Ally configuration.");
    }
    if (raw.kind !== config.TENANT_RECORD_KIND) {
      return refuse(
        "That file is not an Ally configuration export. Choose the file you " +
          "downloaded with Export configuration.",
      );
    }
    if (raw.version !== config.TENANT_RECORD_VERSION) {
      return refuse(
        "That configuration file was written by a different version of this " +
          "tool and cannot be read.",
      );
    }

    const clientId =
      typeof raw.clientId === "string" ? raw.clientId.trim() : "";
    if (!clientId) {
      return refuse("That configuration file has no Client ID.");
    }

    const region = typeof raw.region === "string" ? raw.region.trim() : "";
    if (!config.isValidRegion(region)) {
      return refuse(
        "That configuration file names a region this tool does not support.",
      );
    }

    const record = {
      kind: config.TENANT_RECORD_KIND,
      version: config.TENANT_RECORD_VERSION,
      id:
        typeof raw.id === "string"
          ? raw.id.trim().slice(0, TENANT_TEXT_MAX_LENGTH)
          : "",
      displayName:
        typeof raw.displayName === "string"
          ? raw.displayName.trim().slice(0, TENANT_TEXT_MAX_LENGTH)
          : "",
      region: region,
      clientId: clientId.slice(0, TENANT_TEXT_MAX_LENGTH),
      dataSource: Object.values(config.DATA_SOURCES).includes(raw.dataSource)
        ? raw.dataSource
        : config.DATA_SOURCES.BUNDLED,
    };
    if (!record.id) record.id = record.clientId + "@" + record.region;

    // A worker URL that will not normalise is a typo, not a request to drop the
    // worker — the same reasoning saveAllyCredentials() applies to the field.
    // Refuse it, rather than silently importing a tenant with no transport.
    if (raw.workerUrl !== undefined && raw.workerUrl !== null && raw.workerUrl !== "") {
      const workerUrl = config.normaliseWorkerUrl(raw.workerUrl);
      if (!workerUrl) {
        return refuse(
          "That configuration file has a proxy worker URL this tool cannot " +
            "read. It must be a full http or https URL.",
        );
      }
      record.workerUrl = workerUrl;
    }

    // A course-data URL that will not normalise is refused the same way, not
    // silently dropped: dropping it would import a tenant whose data source
    // says "remote" with nowhere to fetch from, and that fails quietly as
    // "no course data" on the colleague's machine. An unknown format falls
    // back to JSON - the data-only route is the safe direction to default in.
    if (raw.dataUrl !== undefined && raw.dataUrl !== null && raw.dataUrl !== "") {
      const dataUrl = config.normaliseDataUrl(raw.dataUrl);
      if (!dataUrl) {
        return refuse(
          "That configuration file has a course data URL this tool cannot " +
            "read. It must be a full https address.",
        );
      }
      record.dataUrl = dataUrl;
      record.dataUrlFormat = config.isValidDataUrlFormat(raw.dataUrlFormat)
        ? raw.dataUrlFormat
        : config.DEFAULT_DATA_URL_FORMAT;
    }
    if (record.dataSource === config.DATA_SOURCES.REMOTE && !record.dataUrl) {
      return refuse(
        "That configuration file says course data comes from a URL but " +
          "does not name one.",
      );
    }

    // Absent and empty are treated alike HERE, because both mean "no token to
    // apply". They are NOT alike on export, where an absent key is what says
    // the token was deliberately withheld.
    if (typeof raw.token === "string" && raw.token.trim()) {
      record.token = raw.token.trim();
    }

    return { ok: true, record: record, error: "" };
  };

  /**
   * Applies a tenant record: writes it to storage AND pushes it into the live
   * API client.
   *
   * THE TWO HALVES MUST NEVER BE SEPARATED, and that is why they are one
   * function rather than two. ally-cache.js scopes its entries on the LIVE
   * credentials in preference to the stored ones, so an import that wrote
   * localStorage and stopped would leave ALLY_API_CLIENT holding the PREVIOUS
   * tenant's client id — and the new tenant's reports would be cached under the
   * old tenant's scope. That is the Stage 1 leak arriving from the opposite
   * direction, and it fails silently: everything works, the scope is wrong.
   *
   * setWorkerCredentials() is used rather than clearCredentials() for a
   * token-free record. Both null the previous tenant's token, which is the part
   * that matters; setWorkerCredentials additionally keeps the client id the
   * worker transport needs, where clearCredentials would leave the client
   * unable to issue a request at all.
   *
   * SAVE_CREDENTIALS is set because an import is an explicit instruction to
   * configure this browser for this tenant. Without it loadSavedCredentials()
   * refuses on the next page load and the import evaporates on reload.
   *
   * @param {Object} record - A record from parseTenantRecord()
   * @returns {{ok: boolean, error: string, pushedToClient: boolean,
   *   transport: string}} transport is "direct" (token) or "worker"
   *
   * @example
   * const applied = ALLY_CONFIG.applyTenantRecord(parsed.record);
   */
  config.applyTenantRecord = function (record) {
    const failure = {
      ok: false,
      error: "That configuration could not be applied.",
      pushedToClient: false,
      transport: "",
    };

    // Re-checked rather than trusted: a caller that skipped parseTenantRecord
    // must not be able to write a broken tenant into storage.
    if (!record || typeof record !== "object") return failure;
    const clientId =
      typeof record.clientId === "string" ? record.clientId.trim() : "";
    const region = typeof record.region === "string" ? record.region.trim() : "";
    if (!clientId || !config.isValidRegion(region)) return failure;

    const token = typeof record.token === "string" ? record.token.trim() : "";
    const workerUrl = config.normaliseWorkerUrl(record.workerUrl || "");
    const keys = config.STORAGE_KEYS;

    try {
      window.localStorage.setItem(keys.REGION, region);
      window.localStorage.setItem(keys.CLIENT_ID, clientId);
      if (token) {
        window.localStorage.setItem(keys.TOKEN, token);
      } else {
        window.localStorage.removeItem(keys.TOKEN);
      }

      // An import is a TENANT SWITCH, so a worker URL the record does not carry
      // is removed rather than left behind. Keeping the previous tenant's proxy
      // would point the new institution at an endpoint belonging to the old
      // one. This is not the "WORKER_URL survives a credentials clear" rule
      // being weakened — that rule is about an unticked Remember box, which is
      // a save; this is an explicit instruction to become someone else.
      if (workerUrl) {
        window.localStorage.setItem(keys.WORKER_URL, workerUrl);
      } else {
        window.localStorage.removeItem(keys.WORKER_URL);
      }

      window.localStorage.setItem(keys.SAVE_CREDENTIALS, "true");
      window.localStorage.setItem(
        keys.TENANT_ID,
        record.id || clientId + "@" + region,
      );
      if (record.displayName) {
        window.localStorage.setItem(keys.TENANT_NAME, record.displayName);
      } else {
        window.localStorage.removeItem(keys.TENANT_NAME);
      }
      window.localStorage.setItem(
        keys.TENANT_DATA_SOURCE,
        record.dataSource || config.DATA_SOURCES.BUNDLED,
      );

      // Same tenant-switch reasoning as the worker URL: a course-data URL the
      // record does not carry is removed, so the new institution never
      // fetches the previous one's data. The two keys move together.
      const dataUrl = config.normaliseDataUrl(record.dataUrl || "");
      if (dataUrl) {
        window.localStorage.setItem(keys.TENANT_DATA_URL, dataUrl);
        window.localStorage.setItem(
          keys.TENANT_DATA_URL_FORMAT,
          config.isValidDataUrlFormat(record.dataUrlFormat)
            ? record.dataUrlFormat
            : config.DEFAULT_DATA_URL_FORMAT,
        );
      } else {
        window.localStorage.removeItem(keys.TENANT_DATA_URL);
        window.localStorage.removeItem(keys.TENANT_DATA_URL_FORMAT);
      }
    } catch (e) {
      logError("Could not write tenant record to storage:", e.message);
      return failure;
    }

    // The second half. Read at call time — see readLiveTenantIdentity().
    let pushedToClient = false;
    try {
      if (typeof ALLY_API_CLIENT !== "undefined" && ALLY_API_CLIENT) {
        pushedToClient = token
          ? ALLY_API_CLIENT.setCredentials(token, clientId) === true
          : ALLY_API_CLIENT.setWorkerCredentials(clientId) === true;
        ALLY_API_CLIENT.setRegion(region);
      } else {
        logWarn("ALLY_API_CLIENT unavailable; live credentials not updated");
      }
    } catch (e) {
      logError("Could not push tenant record to the API client:", e.message);
    }

    logInfo(
      "Tenant record applied for client " +
        clientId +
        " (" +
        region +
        "), live client updated: " +
        pushedToClient,
    );

    return {
      ok: true,
      error: "",
      pushedToClient: pushedToClient,
      transport: token ? "direct" : "worker",
    };
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
