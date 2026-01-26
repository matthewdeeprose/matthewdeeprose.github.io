/**
 * @fileoverview Ally Accessibility Reporting Tool - Main Controller Module
 * @module AllyMainController
 * @requires ALLY_CONFIG
 * @requires ALLY_API_CLIENT
 * @requires ALLY_UI_MANAGER
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Main orchestration controller for the Ally Accessibility Reporting Tool.
 * Coordinates between UI Manager and API Client, handles user interactions,
 * manages credential persistence, and controls query execution flow.
 *
 * Key Features:
 * - Orchestrates all UI interactions
 * - Coordinates between UI Manager and API Client
 * - Handles credential saving/loading from localStorage
 * - Manages query execution with progress updates
 * - Supports request cancellation
 * - Provides connection testing functionality
 *
 * Integration:
 * - Requires ally-config.js, ally-api-client.js, ally-ui-manager.js
 * - Initialised by showAllyReporting() in boilerplate.html
 * - Available globally via ALLY_MAIN_CONTROLLER
 *
 * @example
 * // Initialise the controller
 * ALLY_MAIN_CONTROLLER.initialise();
 *
 * // Test API connection
 * const success = await ALLY_MAIN_CONTROLLER.testConnection();
 *
 * // Execute a query
 * await ALLY_MAIN_CONTROLLER.executeQuery();
 */

const ALLY_MAIN_CONTROLLER = (function () {
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
      console.error("[AllyMainController] " + message, ...args);
  }

  /**
   * Logs warning messages if warning logging is enabled
   * @param {string} message - The warning message to log
   * @param {...any} args - Additional arguments to pass to console.warn
   */
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyMainController] " + message, ...args);
  }

  /**
   * Logs informational messages if info logging is enabled
   * @param {string} message - The info message to log
   * @param {...any} args - Additional arguments to pass to console.log
   */
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyMainController] " + message, ...args);
  }

  /**
   * Logs debug messages if debug logging is enabled
   * @param {string} message - The debug message to log
   * @param {...any} args - Additional arguments to pass to console.log
   */
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyMainController] " + message, ...args);
  }

  // ========================================================================
  // Private State
  // ========================================================================

  /**
   * Initialisation state flag
   * @type {boolean}
   */
  let initialised = false;

  /**
   * Current query state
   * @type {'idle'|'running'|'cancelling'}
   */
  let queryState = "idle";

  /**
   * Reference to bound event handlers (for potential cleanup)
   * @type {Object.<string, Function>}
   */
  const boundHandlers = {};

  /**
   * Current API status state
   * @type {string}
   */
  let apiState = "UNKNOWN";

  /**
   * Idle timer reference (for READY → IDLE transition)
   * @type {number|null}
   */
  let idleTimerId = null;

  /**
   * Idle display update timer reference (for updating "Idle for X minutes")
   * @type {number|null}
   */
  let idleDisplayTimerId = null;

  /**
   * Timestamp when API entered READY state (for calculating idle duration)
   * @type {number|null}
   */
  let readyStateTimestamp = null;

  /**
   * Flag to track if warm-up is in progress
   * @type {boolean}
   */
  let isWarmingUp = false;

  /**
   * Flag to track if Report Builder background refresh is in progress
   * @type {boolean}
   */
  var rbBackgroundRefreshInProgress = false;

  /**
   * Current Report Builder cache key
   * @type {string|null}
   */
  var currentRbCacheKey = null;

  // ========================================================================
  // Private Methods - Credential Management
  // ========================================================================

  /**
   * Loads stored credentials from localStorage
   * @private
   */
  function loadStoredCredentials() {
    if (typeof ALLY_CONFIG === "undefined") {
      logWarn("ALLY_CONFIG not available - cannot load credentials");
      return;
    }

    try {
      const savedToken = localStorage.getItem(ALLY_CONFIG.STORAGE_KEYS.TOKEN);
      const savedClientId = localStorage.getItem(
        ALLY_CONFIG.STORAGE_KEYS.CLIENT_ID,
      );
      const savedRegion = localStorage.getItem(ALLY_CONFIG.STORAGE_KEYS.REGION);
      const saveCredentials = localStorage.getItem(
        ALLY_CONFIG.STORAGE_KEYS.SAVE_CREDENTIALS,
      );

      const values = {};

      if (savedToken) {
        values.token = savedToken;
        logDebug("Loaded stored token");
      }

      if (savedClientId) {
        values.clientId = savedClientId;
        logDebug("Loaded stored client ID");
      }

      if (savedRegion && ALLY_CONFIG.isValidRegion(savedRegion)) {
        values.region = savedRegion;
        logDebug("Loaded stored region: " + savedRegion);
      }

      if (saveCredentials === "true") {
        values.saveCredentials = true;
      }

      // Apply loaded values to form
      if (Object.keys(values).length > 0) {
        ALLY_UI_MANAGER.setFormValues(values);
        logInfo("Restored saved credentials");
      }
    } catch (error) {
      logError("Failed to load stored credentials:", error);
    }
  }

  /**
   * Saves credentials to localStorage if user opted in
   * @private
   * @param {Object} formValues - Form values to save
   */
  function saveCredentials(formValues) {
    if (typeof ALLY_CONFIG === "undefined") {
      logWarn("ALLY_CONFIG not available - cannot save credentials");
      return;
    }

    try {
      if (formValues.saveCredentials) {
        localStorage.setItem(ALLY_CONFIG.STORAGE_KEYS.TOKEN, formValues.token);
        localStorage.setItem(
          ALLY_CONFIG.STORAGE_KEYS.CLIENT_ID,
          formValues.clientId,
        );
        localStorage.setItem(
          ALLY_CONFIG.STORAGE_KEYS.REGION,
          formValues.region,
        );
        localStorage.setItem(ALLY_CONFIG.STORAGE_KEYS.SAVE_CREDENTIALS, "true");
        logInfo("Credentials saved to localStorage");
      } else {
        // Clear stored credentials if user unchecked the option
        localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.TOKEN);
        localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.CLIENT_ID);
        localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.REGION);
        localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.SAVE_CREDENTIALS);
        logDebug("Credentials cleared from localStorage");
      }
    } catch (error) {
      logError("Failed to save credentials:", error);
    }
  }

  // ========================================================================
  // Private Methods - API Status Management
  // ========================================================================

  /**
   * Sets the API state and updates the status indicator
   * @private
   * @param {string} newState - One of ALLY_CONFIG.API_STATES values
   * @param {boolean} [announce=true] - Whether to announce to screen readers
   */
  function setApiState(newState, announce) {
    if (typeof announce === "undefined") {
      announce = true;
    }

    const validStates =
      typeof ALLY_CONFIG !== "undefined" ? ALLY_CONFIG.API_STATES : null;

    if (validStates && !Object.values(validStates).includes(newState)) {
      logWarn("Invalid API state:", newState);
      return;
    }

    const previousState = apiState;
    apiState = newState;

    logDebug("API state changed: " + previousState + " → " + newState);

    // Update visual indicator
    updateStatusIndicator(newState);

    // Announce to screen readers if state changed meaningfully
    if (announce && previousState !== newState) {
      const message = getStatusMessage(newState);
      ALLY_UI_MANAGER.announce("API status: " + message);
    }

    // Manage timers based on state
    if (newState === "READY") {
      readyStateTimestamp = Date.now();
      startIdleTimer();
      stopIdleDisplayUpdates();
    } else if (newState === "IDLE") {
      clearIdleTimer();
      startIdleDisplayUpdates();
    } else {
      clearIdleTimer();
      stopIdleDisplayUpdates();
      readyStateTimestamp = null;
    }

    // Update execute button states based on API readiness
    updateExecuteButtonStates();

    // Offline banner handling
    if (
      typeof ALLY_CACHE_UI !== "undefined" &&
      typeof ALLY_CACHE !== "undefined"
    ) {
      if (newState === "ERROR") {
        var stats = ALLY_CACHE.getStats();
        if (stats.entryCount > 0) {
          ALLY_CACHE_UI.showOfflineBanner();
        }
      } else if (previousState === "ERROR" && newState !== "ERROR") {
        ALLY_CACHE_UI.hideOfflineBanner();
      }
    }
  }

  /**
   * Updates the visual status indicator
   * @private
   * @param {string} state - The API state
   */
  function updateStatusIndicator(state) {
    const dotEl = ALLY_UI_MANAGER.getElement("ally-api-status-dot");
    const textEl = ALLY_UI_MANAGER.getElement("ally-api-status-text");
    const progressContainer = ALLY_UI_MANAGER.getElement(
      "ally-api-progress-container",
    );
    const progressBar = ALLY_UI_MANAGER.getElement("ally-api-progress-bar");
    const progressFill = ALLY_UI_MANAGER.getElement("ally-api-progress-fill");
    const hintEl = ALLY_UI_MANAGER.getElement("ally-api-status-hint");

    if (dotEl) {
      dotEl.setAttribute("data-state", state);
    }

    if (textEl) {
      textEl.textContent = getStatusMessage(state);
    }

    // Hide retry button for all non-ERROR states
    const retryBtn = ALLY_UI_MANAGER.getElement("ally-api-retry-btn");
    if (retryBtn) {
      retryBtn.hidden = true;
    }

    // Handle progress bar visibility and state
    if (state === "WARMING") {
      // Progress bar is shown/updated by updateWarmUpProgress()
      // Just ensure hint is visible with initial message
      if (hintEl && !hintEl.textContent) {
        hintEl.textContent =
          "The API needs to warm up before generating reports.";
      }
    } else if (state === "READY") {
      // Show completed progress bar briefly, then hide
      if (progressBar) {
        progressBar.setAttribute("data-state", "READY");
        progressBar.setAttribute("aria-valuenow", "100");
      }
      if (progressFill) {
        progressFill.style.width = "100%";
      }
      if (hintEl) {
        hintEl.textContent = "API is ready. You can now generate reports.";
      }
      // Hide progress bar after a moment
      setTimeout(function () {
        if (progressContainer && apiState === "READY") {
          progressContainer.hidden = true;
        }
        if (hintEl && apiState === "READY") {
          hintEl.textContent = "";
        }
      }, 2000);
    } else if (state === "ERROR") {
      if (progressContainer) {
        progressContainer.hidden = true;
      }
      if (hintEl) {
        hintEl.textContent = "Please check your credentials and try again.";
      }
      // Show retry button
      const retryBtn = ALLY_UI_MANAGER.getElement("ally-api-retry-btn");
      if (retryBtn) {
        retryBtn.hidden = false;
      }
    } else if (state === "UNKNOWN") {
      if (progressContainer) {
        progressContainer.hidden = true;
      }
      if (hintEl) {
        hintEl.textContent = "Configure your API credentials to get started.";
      }
    } else if (state === "IDLE") {
      if (progressContainer) {
        progressContainer.hidden = true;
      }
      if (hintEl) {
        hintEl.textContent = "";
      }
    }
  }

  /**
   * Gets the user-facing message for an API state
   * @private
   * @param {string} state - The API state
   * @returns {string} User-facing message
   */
  function getStatusMessage(state) {
    if (typeof ALLY_CONFIG === "undefined") {
      return state;
    }

    switch (state) {
      case "UNKNOWN":
        return ALLY_CONFIG.MESSAGES.STATUS_UNKNOWN || "Not configured";
      case "WARMING":
        return ALLY_CONFIG.MESSAGES.STATUS_WARMING || "Preparing...";
      case "READY":
        return ALLY_CONFIG.MESSAGES.STATUS_READY || "Ready";
      case "IDLE":
        return ALLY_CONFIG.MESSAGES.STATUS_IDLE || "Idle – may need warm-up";
      case "ERROR":
        return ALLY_CONFIG.MESSAGES.STATUS_ERROR || "Connection error";
      default:
        return state;
    }
  }

  /**
   * Updates the state of all API-dependent execute buttons
   * @private
   */
  function updateExecuteButtonStates() {
    var apiReady = apiState === "READY";
    var apiNotReadyStates = ["UNKNOWN", "WARMING", "ERROR"];
    var showApiNotReady = apiNotReadyStates.indexOf(apiState) !== -1;

    // Default help messages for course-required buttons
    var defaultCourseMessages = {
      "ally-cr-execute": "Select a module above to enable this button",
      "ally-sp-execute": "Select a module first to enable this button",
    };

    // API-related messages we set (to detect if we changed the help text)
    var apiMessages = [
      "Please wait while the API warms up...",
      "Configure API credentials first",
      "API connection error. Check credentials.",
    ];

    // Get all buttons with data-api-required attribute
    var apiRequiredButtons = document.querySelectorAll(
      '[data-api-required="true"]',
    );

    apiRequiredButtons.forEach(function (button) {
      var helpTextId = button.getAttribute("aria-describedby");
      var helpTextEl = helpTextId ? document.getElementById(helpTextId) : null;
      var requiresCourse =
        button.getAttribute("data-requires-course") === "true";

      // Determine button state and help message
      var shouldDisable = false;
      var helpMessage = "";

      if (!apiReady) {
        // API not ready - always disable and show indicator
        shouldDisable = true;
        button.setAttribute("data-api-not-ready", "true");

        if (apiState === "WARMING") {
          helpMessage = "Please wait while the API warms up...";
        } else if (apiState === "UNKNOWN") {
          helpMessage = "Configure API credentials first";
        } else if (apiState === "ERROR") {
          helpMessage = "API connection error. Check credentials.";
        }
      } else {
        // API is ready - remove indicator
        button.removeAttribute("data-api-not-ready");

        if (requiresCourse) {
          // These buttons also need course selection
          var currentHelpText = helpTextEl ? helpTextEl.textContent : "";

          // Check if we previously set an API-related message
          var isOurApiMessage = apiMessages.indexOf(currentHelpText) !== -1;

          // Check if it's a "select module" message
          var isSelectMessage =
            currentHelpText.toLowerCase().indexOf("select a") !== -1;

          if (isOurApiMessage) {
            // We changed the text during API not-ready state
            // Restore the default "select module" message
            shouldDisable = true;
            helpMessage =
              defaultCourseMessages[button.id] ||
              "Select a module first to enable this button";
          } else if (isSelectMessage) {
            // Original "select module" message - no course selected
            shouldDisable = true;
            helpMessage = currentHelpText; // Keep existing
          } else {
            // Help text is empty or something else - course likely selected
            shouldDisable = false;
            helpMessage = "";
          }
        } else {
          // Button only depends on API being ready
          shouldDisable = false;
          helpMessage = "";
        }
      }

      button.disabled = shouldDisable;

      // Update help text
      if (helpTextEl) {
        if (helpMessage) {
          helpTextEl.textContent = helpMessage;
        } else if (!requiresCourse) {
          // Clear help text for non-course buttons when API ready
          helpTextEl.textContent = "";
        } else if (!shouldDisable) {
          // Course-required button is enabled - clear help text
          helpTextEl.textContent = "";
        }
      }
    });

    logDebug("Execute button states updated for API state: " + apiState);
  }

  /**
   * Formats seconds into a human-readable duration string
   * @private
   * @param {number} seconds - Number of seconds
   * @returns {string} Formatted duration (e.g., "2 min 30 sec", "45 sec")
   */
  function formatDuration(seconds) {
    if (seconds < 0) {
      seconds = 0;
    }

    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);

    if (mins > 0 && secs > 0) {
      return mins + " min " + secs + " sec";
    } else if (mins > 0) {
      return mins + " min";
    } else {
      return secs + " sec";
    }
  }

  /**
   * Updates the warm-up progress display with time estimate and progress bar
   * @private
   * @param {number} attempt - Current polling attempt number
   * @param {number} maxAttempts - Maximum polling attempts
   * @param {number} startTime - Timestamp when warm-up started
   */
  function updateWarmUpProgress(attempt, maxAttempts, startTime) {
    const textEl = ALLY_UI_MANAGER.getElement("ally-api-status-text");
    const progressContainer = ALLY_UI_MANAGER.getElement(
      "ally-api-progress-container",
    );
    const progressBar = ALLY_UI_MANAGER.getElement("ally-api-progress-bar");
    const progressFill = ALLY_UI_MANAGER.getElement("ally-api-progress-fill");
    const hintEl = ALLY_UI_MANAGER.getElement("ally-api-status-hint");

    const typicalDuration =
      typeof ALLY_CONFIG !== "undefined"
        ? ALLY_CONFIG.POLLING.TYPICAL_WARMUP_SECONDS
        : 180;

    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const estimatedRemaining = Math.max(0, typicalDuration - elapsedSeconds);

    // Calculate progress percentage (cap at 95% until actually complete)
    const progressPercent = Math.min(
      95,
      Math.round((elapsedSeconds / typicalDuration) * 100),
    );

    // Build progress message
    let message = "Preparing API";

    if (estimatedRemaining > 0) {
      message += " (~" + formatDuration(estimatedRemaining) + " remaining)";
    } else {
      // Past typical time, show attempt count instead
      message += " (attempt " + attempt + "/" + maxAttempts + ")";
    }

    // Update text
    if (textEl) {
      textEl.textContent = message;
    }

    // Show and update progress bar
    if (progressContainer) {
      progressContainer.hidden = false;
    }

    if (progressBar) {
      progressBar.setAttribute("data-state", "WARMING");
      progressBar.setAttribute("aria-valuenow", progressPercent);
    }

    if (progressFill) {
      progressFill.style.width = progressPercent + "%";
    }

    // Update hint text
    if (hintEl) {
      if (attempt === 1) {
        hintEl.textContent =
          "The API needs to warm up before generating reports. This typically takes 2-3 minutes.";
      } else if (estimatedRemaining <= 30 && estimatedRemaining > 0) {
        hintEl.textContent = "Almost ready...";
      } else if (estimatedRemaining === 0) {
        hintEl.textContent = "Taking longer than usual. Please wait...";
      }
    }
  }

  /**
   * Starts the idle timer.
   * If KEEP_API_WARM is enabled: triggers warm-up to keep API ready
   * If KEEP_API_WARM is disabled: transitions to IDLE state (original behaviour)
   * @private
   */
  function startIdleTimer() {
    clearIdleTimer();

    const timeout =
      typeof ALLY_CONFIG !== "undefined"
        ? ALLY_CONFIG.API_STATUS.IDLE_TIMEOUT_MS
        : 180000;

    const keepWarm =
      typeof ALLY_CONFIG !== "undefined"
        ? ALLY_CONFIG.API_STATUS.KEEP_API_WARM
        : true;

    idleTimerId = setTimeout(function () {
      if (apiState === "READY") {
        if (keepWarm && hasCredentials()) {
          logInfo("API idle timeout reached, triggering keep-warm request");
          performWarmUp();
        } else {
          logInfo("API idle timeout reached, transitioning to IDLE state");
          setApiState("IDLE");
        }
      }
    }, timeout);

    logDebug(
      "Idle timer started (" +
        timeout / 1000 +
        "s, keep-warm: " +
        (keepWarm ? "enabled" : "disabled") +
        ")",
    );
  }

  /**
   * Clears the idle timer
   * @private
   */
  function clearIdleTimer() {
    if (idleTimerId !== null) {
      clearTimeout(idleTimerId);
      idleTimerId = null;
      logDebug("Idle timer cleared");
    }
  }

  /**
   * Starts the idle display update interval
   * Updates the "Idle for X minutes" message every 30 seconds
   * @private
   */
  function startIdleDisplayUpdates() {
    stopIdleDisplayUpdates();

    // Update immediately
    updateIdleDisplayMessage();

    // Then update every 30 seconds
    idleDisplayTimerId = setInterval(function () {
      if (apiState === "IDLE") {
        updateIdleDisplayMessage();
      }
    }, 30000);

    logDebug("Idle display updates started (30s interval)");
  }

  /**
   * Stops the idle display update interval
   * @private
   */
  function stopIdleDisplayUpdates() {
    if (idleDisplayTimerId !== null) {
      clearInterval(idleDisplayTimerId);
      idleDisplayTimerId = null;
      logDebug("Idle display updates stopped");
    }
  }

  /**
   * Updates the idle status message with duration
   * @private
   */
  function updateIdleDisplayMessage() {
    const textEl = ALLY_UI_MANAGER.getElement("ally-api-status-text");
    if (!textEl) return;

    const idleDuration = getIdleDuration();
    const durationText = formatIdleDuration(idleDuration);

    textEl.textContent = "Idle for " + durationText + " – may need warm-up";
  }

  /**
   * Gets how long the API has been idle (in seconds)
   * @private
   * @returns {number} Seconds since entering READY state, or 0 if unknown
   */
  function getIdleDuration() {
    if (!readyStateTimestamp) {
      return 0;
    }
    return Math.floor((Date.now() - readyStateTimestamp) / 1000);
  }

  /**
   * Formats idle duration for display
   * @private
   * @param {number} seconds - Total seconds idle
   * @returns {string} Formatted duration (e.g., "3 minutes", "1 hour 5 minutes")
   */
  function formatIdleDuration(seconds) {
    if (seconds < 60) {
      return "less than a minute";
    }

    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      if (remainingMinutes > 0) {
        return (
          hours +
          (hours === 1 ? " hour " : " hours ") +
          remainingMinutes +
          (remainingMinutes === 1 ? " minute" : " minutes")
        );
      }
      return hours + (hours === 1 ? " hour" : " hours");
    }

    return minutes + (minutes === 1 ? " minute" : " minutes");
  }

  /**
   * Performs an API warm-up request
   * Uses minimal limit=1 request to wake up the API
   * @private
   * @returns {Promise<boolean>} True if warm-up succeeded
   */
  async function performWarmUp() {
    if (isWarmingUp) {
      logDebug("Warm-up already in progress");
      return false;
    }

    const formValues = ALLY_UI_MANAGER.getFormValues();

    // Validate we have credentials
    if (!formValues.clientId || !formValues.token) {
      logDebug("Cannot warm up - credentials not configured");
      setApiState("UNKNOWN", false);
      return false;
    }

    isWarmingUp = true;
    setApiState("WARMING");

    // Track start time for progress estimation
    const warmUpStartTime = Date.now();

    try {
      if (typeof ALLY_API_CLIENT !== "undefined") {
        ALLY_API_CLIENT.setCredentials(formValues.token, formValues.clientId);
        ALLY_API_CLIENT.setRegion(formValues.region);

        const warmupLimit =
          typeof ALLY_CONFIG !== "undefined"
            ? ALLY_CONFIG.API_STATUS.WARMUP_LIMIT
            : 1;

        const maxAttempts =
          typeof ALLY_CONFIG !== "undefined"
            ? ALLY_CONFIG.POLLING.MAX_ATTEMPTS
            : 20;

        logInfo("Starting API warm-up request (limit=" + warmupLimit + ")");

        // Use fetchOverall with minimal limit and progress tracking
        const result = await ALLY_API_CLIENT.fetchOverall({
          limit: warmupLimit,
          onProgress: function (progress) {
            // Update status display with time estimate
            const attempt = progress.attempt || 1;
            updateWarmUpProgress(attempt, maxAttempts, warmUpStartTime);
          },
        });

        if (result && result.data) {
          const duration = Math.round((Date.now() - warmUpStartTime) / 1000);
          logInfo("API warm-up successful after " + duration + " seconds");
          setApiState("READY");
          return true;
        } else {
          logWarn("API warm-up returned no data");
          setApiState("ERROR");
          return false;
        }
      } else {
        logWarn("ALLY_API_CLIENT not available for warm-up");
        setApiState("ERROR");
        return false;
      }
    } catch (error) {
      logError("API warm-up failed:", error);
      setApiState("ERROR");
      return false;
    } finally {
      isWarmingUp = false;
    }
  }

  /**
   * Checks if credentials are available
   * @private
   * @returns {boolean} True if credentials are configured
   */
  function hasCredentials() {
    const formValues = ALLY_UI_MANAGER.getFormValues();
    return !!(formValues.clientId && formValues.token);
  }

  // ========================================================================
  // Private Methods - Credentials Section Highlight (Stage 3)
  // ========================================================================

  /**
   * Highlights the credentials section and scrolls it into view
   * Called when credentials are missing on page load
   * @private
   */
  function highlightCredentialsSection() {
    var detailsEl = document.getElementById("ally-credentials-details");
    if (!detailsEl) {
      logWarn("Credentials details element not found");
      return;
    }

    // Ensure section is open
    detailsEl.open = true;

    // Scroll into view smoothly
    detailsEl.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    // Add highlight class
    detailsEl.classList.add("ally-credentials-highlight");

    // Remove highlight class after animation completes (3 pulses × 0.6s = 1.8s)
    setTimeout(function () {
      detailsEl.classList.remove("ally-credentials-highlight");
    }, 2000);

    // Focus the first empty required field
    setTimeout(function () {
      var clientIdEl = document.getElementById("ally-client-id");
      var tokenEl = document.getElementById("ally-api-token");

      if (clientIdEl && !clientIdEl.value) {
        clientIdEl.focus();
      } else if (tokenEl && !tokenEl.value) {
        tokenEl.focus();
      }
    }, 500); // Delay to allow scroll to complete

    // Announce to screen readers
    ALLY_UI_MANAGER.announce(
      "API credentials required. Please enter your Client ID and API Token to use the Ally Reporting Tool.",
    );

    logDebug("Credentials section highlighted and scrolled into view");
  }

  /**
   * Adds call-to-action styling to Test Connection button
   * @private
   * @param {boolean} show - Whether to show or hide the CTA styling
   */
  function setTestConnectionCTA(show) {
    var testBtn = ALLY_UI_MANAGER.getElement("ally-test-connection");
    if (!testBtn) return;

    if (show) {
      testBtn.classList.add("ally-test-connection-cta");
    } else {
      testBtn.classList.remove("ally-test-connection-cta");
    }
  }

  // ========================================================================
  // Private Methods - Validation
  // ========================================================================

  /**
   * Validates required credentials are present
   * @private
   * @param {Object} formValues - Form values to validate
   * @returns {{valid: boolean, message: string}} Validation result
   */
  function validateCredentials(formValues) {
    if (!formValues.clientId) {
      return {
        valid: false,
        message:
          ALLY_CONFIG?.MESSAGES?.MISSING_CLIENT_ID ||
          "Please enter your Client ID.",
      };
    }

    if (!formValues.token) {
      return {
        valid: false,
        message:
          ALLY_CONFIG?.MESSAGES?.MISSING_TOKEN ||
          "Please enter your API token.",
      };
    }

    if (!ALLY_CONFIG?.isValidRegion(formValues.region)) {
      return {
        valid: false,
        message:
          ALLY_CONFIG?.MESSAGES?.INVALID_REGION || "Invalid region specified.",
      };
    }

    return { valid: true, message: "" };
  }

  // ========================================================================
  // Private Methods - Event Handlers
  // ========================================================================

  /**
   * Handles Test Connection button click
   * @private
   */
  async function handleTestConnection() {
    logDebug("Test connection initiated");

    const formValues = ALLY_UI_MANAGER.getFormValues();

    // Validate credentials
    const validation = validateCredentials(formValues);
    if (!validation.valid) {
      showNotification(validation.message, "error");
      ALLY_UI_MANAGER.announce(validation.message);
      setApiState("UNKNOWN", false);
      return false;
    }

    // Update UI state
    const testBtn = ALLY_UI_MANAGER.getElement("ally-test-connection");
    if (testBtn) {
      testBtn.disabled = true;
      testBtn.innerHTML =
        '<span aria-hidden="true" data-icon="refresh" data-icon-class="icon-spin"></span> Testing...';
      // Populate the new icon
      if (typeof IconLibrary !== "undefined") {
        IconLibrary.populateIcons();
      }
    }

    // Set status to warming during test
    setApiState("WARMING", false);

    try {
      // Set credentials on API client
      if (typeof ALLY_API_CLIENT !== "undefined") {
        ALLY_API_CLIENT.setCredentials(formValues.token, formValues.clientId);
        ALLY_API_CLIENT.setRegion(formValues.region);

        // Test the connection
        const success = await ALLY_API_CLIENT.testConnection();

        if (success) {
          showNotification("Connection successful!", "success");
          ALLY_UI_MANAGER.announce("Connection test successful");

          // Save credentials if opted in
          saveCredentials(formValues);

          // Update API status to READY
          setApiState("READY");

          // Remove CTA styling from Test Connection button
          setTestConnectionCTA(false);

          return true;
        } else {
          showNotification(
            "Connection failed. Please check your credentials.",
            "error",
          );
          ALLY_UI_MANAGER.announce("Connection test failed");
          setApiState("ERROR");
          return false;
        }
      } else {
        showNotification("API client not available.", "error");
        setApiState("ERROR");
        return false;
      }
    } catch (error) {
      logError("Connection test error:", error);
      showNotification("Connection error: " + error.message, "error");
      ALLY_UI_MANAGER.announce("Connection test failed: " + error.message);
      setApiState("ERROR");
      return false;
    } finally {
      // Restore button state
      if (testBtn) {
        testBtn.disabled = false;
        testBtn.innerHTML =
          '<span aria-hidden="true" data-icon="refresh"></span> Test Connection';
        if (typeof IconLibrary !== "undefined") {
          IconLibrary.populateIcons();
        }
      }
    }
  }

  /**
   * Handles Run Query button click
   * @private
   */
  async function handleExecuteQuery() {
    if (queryState !== "idle") {
      logWarn("Query already in progress");
      return;
    }

    logDebug("Query execution initiated");

    const formValues = ALLY_UI_MANAGER.getFormValues();

    // Validate credentials
    const validation = validateCredentials(formValues);
    if (!validation.valid) {
      showNotification(validation.message, "error");
      ALLY_UI_MANAGER.announce(validation.message);
      return;
    }

    // Update state
    queryState = "running";

    // Update UI
    ALLY_UI_MANAGER.setQueryButtonEnabled(false);
    ALLY_UI_MANAGER.showProgress(true);
    ALLY_UI_MANAGER.showResults(false);
    ALLY_UI_MANAGER.updateProgress(
      0,
      ALLY_CONFIG?.MESSAGES?.CONNECTING || "Connecting...",
    );
    ALLY_UI_MANAGER.announce("Query started");

    // Report Builder caching - check cache first
    if (typeof ALLY_CACHE !== "undefined") {
      // Build cache key parameters
      var cacheFilters = {};

      // Add quick filters
      if (formValues.term) {
        cacheFilters.termId = formValues.term;
      }
      if (formValues.department) {
        cacheFilters.departmentId = formValues.department;
      }
      if (formValues.activeOnly) {
        cacheFilters.allyEnabled = "true";
      }

      // Add course search filter
      if (
        typeof ALLY_COURSE_SEARCH !== "undefined" &&
        ALLY_COURSE_SEARCH.isInitialised()
      ) {
        var selectedCourse = ALLY_COURSE_SEARCH.getSelectedCourse();
        if (selectedCourse) {
          cacheFilters.courseName = "eq:" + selectedCourse.name;
        }
      }

      // Add advanced filters
      if (
        typeof ALLY_FILTER_BUILDER !== "undefined" &&
        ALLY_FILTER_BUILDER.isInitialised()
      ) {
        var advFilters = ALLY_FILTER_BUILDER.getFilters();
        advFilters.forEach(function (f) {
          if (f.noOperator) {
            cacheFilters[f.field] = f.value;
          } else {
            cacheFilters[f.field] = f.operator + ":" + f.value;
          }
        });
      }

      var rbCacheKey = ALLY_CACHE.reportBuilderKey(
        formValues.endpoint || "overall",
        cacheFilters,
        formValues.sortField || "",
        formValues.sortOrder || "asc",
        formValues.limit || 100,
      );
      currentRbCacheKey = rbCacheKey;

      var cachedResult = ALLY_CACHE.get(rbCacheKey);
      if (cachedResult && cachedResult.data) {
        logInfo("Cache hit for Report Builder query");

        // Reset query state since we're not making an API call yet
        queryState = "idle";
        ALLY_UI_MANAGER.setQueryButtonEnabled(true);
        ALLY_UI_MANAGER.showProgress(false);

        // Display cached results immediately
        displayResults(cachedResult.data);

        var cachedRecordCount = cachedResult.data.data
          ? cachedResult.data.data.length
          : 0;
        ALLY_UI_MANAGER.announce(
          "Showing cached results. " +
            cachedRecordCount +
            " records. Checking for updates.",
        );

        // Show cached banner
        var resultsSection = document.getElementById("ally-results-section");
        if (resultsSection && typeof ALLY_CACHE_UI !== "undefined") {
          ALLY_CACHE_UI.showCachedBanner(
            resultsSection,
            cachedResult.timestamp,
            false,
          );
        }

        // Background refresh if API available
        if (apiState !== "ERROR" && !rbBackgroundRefreshInProgress) {
          refreshReportBuilderInBackground(
            rbCacheKey,
            cachedResult,
            formValues,
          );
        }

        return; // Don't proceed with API call
      }
    }

    try {
      // Set credentials on API client
      if (typeof ALLY_API_CLIENT !== "undefined") {
        ALLY_API_CLIENT.setCredentials(formValues.token, formValues.clientId);
        ALLY_API_CLIENT.setRegion(formValues.region);

        // Build filters object for API (key=operator:value format)
        // Values can be arrays to support range queries (e.g., overallScore >= 0.1 AND <= 0.7)
        const filters = {};

        /**
         * Adds a filter value, converting to array if field already has a value
         * This supports range queries like: ?overallScore=ge:0.1&overallScore=le:0.7
         * @param {string} field - The filter field name
         * @param {string} value - The filter value (with operator if needed)
         */
        function addFilter(field, value) {
          if (filters[field] === undefined) {
            // First value for this field
            filters[field] = value;
          } else if (Array.isArray(filters[field])) {
            // Already an array, add to it
            filters[field].push(value);
          } else {
            // Convert existing single value to array
            filters[field] = [filters[field], value];
          }
        }

        // Quick filters from form
        if (formValues.term) {
          addFilter("termId", formValues.term);
        }

        if (formValues.department) {
          // Department dropdown uses ID values, so use departmentId parameter
          addFilter("departmentId", formValues.department);
        }

        if (formValues.activeOnly) {
          addFilter("allyEnabled", "true");
        }

        // Course search filter (Phase 4A)
        // Use courseName with eq operator for exact match
        if (
          typeof ALLY_COURSE_SEARCH !== "undefined" &&
          ALLY_COURSE_SEARCH.isInitialised()
        ) {
          const selectedCourse = ALLY_COURSE_SEARCH.getSelectedCourse();
          if (selectedCourse) {
            // Use courseName for filtering (API field)
            addFilter("courseName", "eq:" + selectedCourse.name);
            logDebug(
              "Added course filter: courseName=eq:" + selectedCourse.name,
            );
          }
        }

        // Advanced filters from Filter Builder (Phase 4A)
        // Filter Builder returns: { field, operator, value, noOperator }
        // API expects: field=operator:value (or just field=value for noOperator fields)
        // Using addFilter() allows multiple conditions on same field (range queries)
        if (
          typeof ALLY_FILTER_BUILDER !== "undefined" &&
          ALLY_FILTER_BUILDER.isInitialised()
        ) {
          const advancedFilters = ALLY_FILTER_BUILDER.getFilters();
          advancedFilters.forEach(function (f) {
            if (f.noOperator) {
              // Fields like departmentId/departmentName don't support operators
              addFilter(f.field, f.value);
            } else {
              // Combine operator and value in API format: field=operator:value
              addFilter(f.field, f.operator + ":" + f.value);
            }
          });
          if (advancedFilters.length > 0) {
            logDebug("Added " + advancedFilters.length + " advanced filters");
          }
        }

        // Log final filters for debugging
        const filterCount = Object.keys(filters).length;
        if (filterCount > 0) {
          logDebug(
            "Final filters object (" + filterCount + " fields):",
            filters,
          );
          // Log array filters separately for clarity
          Object.entries(filters).forEach(function (entry) {
            if (Array.isArray(entry[1])) {
              logDebug(
                "  Range filter on '" +
                  entry[0] +
                  "': " +
                  entry[1].join(" AND "),
              );
            }
          });
        }

        // Build query options with filters object
        const queryOptions = {
          limit: formValues.limit,
          filters: filterCount > 0 ? filters : undefined,
          onProgress: function (progress) {
            ALLY_UI_MANAGER.updateProgress(
              progress.percent || 0,
              progress.message || "",
            );
          },
        };

        // Add sorting if specified
        if (formValues.sortField) {
          queryOptions.sort = formValues.sortField;
          queryOptions.order = formValues.sortOrder;
        }

        // Execute the appropriate query
        let result;
        if (formValues.endpoint === "issues") {
          result = await ALLY_API_CLIENT.fetchIssues(queryOptions);
        } else {
          result = await ALLY_API_CLIENT.fetchOverall(queryOptions);
        }

        // Check if cancelled during execution
        if (queryState === "cancelling") {
          logInfo("Query was cancelled");
          return;
        }

        // Handle results
        if (result && result.data) {
          ALLY_UI_MANAGER.updateProgress(100, "Complete!");

          // Save credentials on successful query
          saveCredentials(formValues);

          // Update API status to READY (successful query means API is warm)
          setApiState("READY");

          // Display results (Phase 5 will implement full rendering)
          displayResults(result);

          const recordCount = Array.isArray(result.data)
            ? result.data.length
            : 0;
          ALLY_UI_MANAGER.announce(
            "Query complete. " + recordCount + " records returned.",
          );
          showNotification(
            "Query complete: " + recordCount + " records",
            "success",
          );

          // Cache the result for Report Builder
          if (typeof ALLY_CACHE !== "undefined" && currentRbCacheKey) {
            ALLY_CACHE.set(currentRbCacheKey, {
              type: "report-builder",
              queryDescription:
                (formValues.endpoint || "overall") + " endpoint query",
              endpoint: formValues.endpoint || "overall",
              recordCount: recordCount,
              data: result,
            });
            logDebug("Cached Report Builder result");
          }
        } else {
          throw new Error("No data returned from API");
        }
      } else {
        throw new Error("API client not available");
      }
    } catch (error) {
      if (queryState === "cancelling") {
        logInfo("Query cancelled by user");
        showNotification("Query cancelled", "info");
        ALLY_UI_MANAGER.announce("Query cancelled");
        // Don't change API state on cancel
      } else {
        logError("Query execution error:", error);

        // Try cache fallback for Report Builder
        if (typeof ALLY_CACHE !== "undefined" && currentRbCacheKey) {
          var cachedFallback = ALLY_CACHE.get(currentRbCacheKey);
          if (cachedFallback && cachedFallback.data) {
            logInfo("API error, falling back to cache");

            // Display cached results
            displayResults(cachedFallback.data);

            // Show cached banner with error variant
            var resultsSection = document.getElementById(
              "ally-results-section",
            );
            if (resultsSection && typeof ALLY_CACHE_UI !== "undefined") {
              ALLY_CACHE_UI.showCachedBanner(
                resultsSection,
                cachedFallback.timestamp,
                true,
              );
            }

            var fallbackCount = cachedFallback.data.data
              ? cachedFallback.data.data.length
              : 0;
            ALLY_UI_MANAGER.announce(
              "API unavailable. Showing " +
                fallbackCount +
                " cached records from " +
                ALLY_CACHE.formatAge(cachedFallback.timestamp) +
                ".",
            );
            showNotification(
              "Showing cached results due to API error",
              "warning",
            );

            // Set API state to ERROR
            setApiState("ERROR");
            return; // Don't show error UI
          }
        }

        showNotification("Query failed: " + error.message, "error");
        ALLY_UI_MANAGER.announce("Query failed: " + error.message);
        // Set API state to ERROR on failure
        setApiState("ERROR");
      }
    } finally {
      // Reset state
      queryState = "idle";
      ALLY_UI_MANAGER.setQueryButtonEnabled(true);
      ALLY_UI_MANAGER.showProgress(false);
    }
  }

  /**
   * Handles Cancel Query button click
   * @private
   */
  function handleCancelQuery() {
    if (queryState !== "running") {
      logDebug("No query to cancel");
      return;
    }

    logInfo("Cancelling query...");
    queryState = "cancelling";

    // Cancel via API client
    if (
      typeof ALLY_API_CLIENT !== "undefined" &&
      typeof ALLY_API_CLIENT.cancelRequest === "function"
    ) {
      ALLY_API_CLIENT.cancelRequest();
    }

    ALLY_UI_MANAGER.updateProgress(0, "Cancelling...");
    ALLY_UI_MANAGER.announce("Cancelling query");
  }

  /**
   * Handles Clear Filters button click
   * @private
   */
  function handleClearFilters() {
    logDebug("Clearing filters");

    // Reset form but preserve credentials
    const formValues = ALLY_UI_MANAGER.getFormValues();
    const preservedValues = {
      region: formValues.region,
      clientId: formValues.clientId,
      token: formValues.token,
      saveCredentials: formValues.saveCredentials,
    };

    ALLY_UI_MANAGER.resetForm();
    ALLY_UI_MANAGER.setFormValues(preservedValues);

    // Clear advanced filters (Phase 4)
    if (
      typeof ALLY_FILTER_BUILDER !== "undefined" &&
      ALLY_FILTER_BUILDER.isInitialised()
    ) {
      ALLY_FILTER_BUILDER.clearFilters();
    }

    // Clear course search
    if (
      typeof ALLY_COURSE_SEARCH !== "undefined" &&
      ALLY_COURSE_SEARCH.isInitialised()
    ) {
      ALLY_COURSE_SEARCH.clearSelection();
    }

    ALLY_UI_MANAGER.announce("Filters cleared");
    showNotification("Filters cleared", "info");
  }

  // ========================================================================
  // Private Methods - Results Display
  // ========================================================================

  /**
   * Gets the currently selected endpoint from radio buttons
   * @private
   * @returns {string} 'overall' or 'issues'
   */
  function getCurrentEndpoint() {
    const overallRadio = ALLY_UI_MANAGER.getElement("ally-endpoint-overall");
    return overallRadio && overallRadio.checked ? "overall" : "issues";
  }

  /**
   * Displays query results using the Result Renderer
   * @private
   * @param {Object} result - API result object
   */
  function displayResults(result) {
    // Determine endpoint from current radio selection
    const endpoint = getCurrentEndpoint();

    // Use the Result Renderer if available
    if (typeof ALLY_RESULT_RENDERER !== "undefined") {
      // Initialise renderer if needed
      if (!ALLY_RESULT_RENDERER.isInitialised()) {
        ALLY_RESULT_RENDERER.initialise();
      }

      // Render results
      ALLY_RESULT_RENDERER.render(result, endpoint);
      logInfo("Results rendered via ALLY_RESULT_RENDERER for " + endpoint);
    } else {
      // Fallback to basic display if renderer not available
      logWarn("ALLY_RESULT_RENDERER not available - using basic display");

      const summaryEl = ALLY_UI_MANAGER.getElement("ally-results-summary");
      const tableContainer = ALLY_UI_MANAGER.getElement("ally-table-container");

      if (summaryEl && tableContainer) {
        const recordCount = Array.isArray(result.data) ? result.data.length : 0;
        summaryEl.innerHTML =
          "<p><strong>" + recordCount + "</strong> records returned</p>";

        if (recordCount > 0) {
          tableContainer.innerHTML =
            "<p>Result Renderer not loaded. Data available in debug panel.</p>";
        } else {
          tableContainer.innerHTML =
            "<p>No records found matching your criteria.</p>";
        }
      }
    }

    ALLY_UI_MANAGER.showResults(true);

    // Update debug panel
    updateDebugPanel();
  }

  /**
   * Updates the debug panel with API transaction data
   * @private
   */
  function updateDebugPanel() {
    if (typeof ALLY_API_CLIENT === "undefined") {
      logWarn("ALLY_API_CLIENT not available for debug panel");
      return;
    }

    const debugData = ALLY_API_CLIENT.getDebugData();
    if (!debugData) {
      logDebug("No debug data available");
      return;
    }

    // Update summary stats
    const endpointEl = ALLY_UI_MANAGER.getElement("ally-debug-endpoint");
    const regionEl = ALLY_UI_MANAGER.getElement("ally-debug-region");
    const timingEl = ALLY_UI_MANAGER.getElement("ally-debug-timing");
    const recordCountEl = ALLY_UI_MANAGER.getElement("ally-debug-record-count");
    const statusEl = ALLY_UI_MANAGER.getElement("ally-debug-status");
    const requestDataEl = ALLY_UI_MANAGER.getElement("ally-debug-request-data");
    const responseDataEl = ALLY_UI_MANAGER.getElement(
      "ally-debug-response-data",
    );

    if (endpointEl && debugData.request) {
      endpointEl.textContent = debugData.request.endpoint || "—";
    }

    if (regionEl && debugData.request) {
      const regionInfo = ALLY_CONFIG?.getRegion(debugData.request.region);
      regionEl.textContent = regionInfo
        ? regionInfo.name + " (" + debugData.request.region + ")"
        : debugData.request.region || "—";
    }

    if (timingEl && debugData.timing) {
      const duration = debugData.timing.duration
        ? (debugData.timing.duration / 1000).toFixed(2) + "s"
        : "—";
      const attempts = debugData.timing.pollingAttempts || 0;
      timingEl.textContent =
        "Total: " + duration + " | Polling attempts: " + attempts;
    }

    if (recordCountEl && debugData.response) {
      recordCountEl.textContent =
        debugData.response.recordCount !== undefined
          ? debugData.response.recordCount.toString()
          : "—";
    }

    if (statusEl && debugData.response) {
      statusEl.textContent = debugData.response.metadata?.status || "—";
    }

    // Update request JSON with Prism highlighting
    if (requestDataEl && debugData.request) {
      const requestJson = JSON.stringify(debugData.request, null, 2);
      requestDataEl.textContent = requestJson;
      // Apply Prism highlighting if available
      if (typeof Prism !== "undefined") {
        requestDataEl.innerHTML = Prism.highlight(
          requestJson,
          Prism.languages.json,
          "json",
        );
      }
    }

    // Update response JSON with Prism highlighting
    if (responseDataEl && debugData.response) {
      const responseJson = JSON.stringify(debugData.response, null, 2);
      responseDataEl.textContent = responseJson;
      // Apply Prism highlighting if available
      if (typeof Prism !== "undefined") {
        responseDataEl.innerHTML = Prism.highlight(
          responseJson,
          Prism.languages.json,
          "json",
        );
      }
    }

    // Show debug panel
    const debugPanel = ALLY_UI_MANAGER.getElement("ally-debug-panel");
    if (debugPanel) {
      debugPanel.hidden = false;
    }

    logDebug("Debug panel updated");
  }

  /**
   * Escapes HTML special characters
   * @private
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ========================================================================
  // Private Methods - Notifications
  // ========================================================================

  /**
   * Shows a notification to the user
   * Uses universal notification system if available, falls back to console
   * @private
   * @param {string} message - Message to display
   * @param {'success'|'error'|'warning'|'info'} type - Notification type
   */
  function showNotification(message, type) {
    // Try universal notification system first
    if (typeof window.notifySuccess === "function") {
      switch (type) {
        case "success":
          window.notifySuccess(message);
          break;
        case "error":
          window.notifyError(message);
          break;
        case "warning":
          window.notifyWarning(message);
          break;
        default:
          window.notifyInfo(message);
      }
      return;
    }

    // Fallback to console
    switch (type) {
      case "error":
        console.error("[Ally] " + message);
        break;
      case "warning":
        console.warn("[Ally] " + message);
        break;
      default:
        console.log("[Ally] " + message);
    }
  }

  // ========================================================================
  // Private Methods - Event Binding
  // ========================================================================

  /**
   * Sets up all event listeners
   * @private
   */
  function setupEventListeners() {
    // Test Connection button
    const testBtn = ALLY_UI_MANAGER.getElement("ally-test-connection");
    if (testBtn) {
      boundHandlers.testConnection = handleTestConnection;
      testBtn.addEventListener("click", boundHandlers.testConnection);
      logDebug("Bound test connection handler");
    }

    // Execute Query button
    const queryBtn = ALLY_UI_MANAGER.getElement("ally-execute-query");
    if (queryBtn) {
      boundHandlers.executeQuery = handleExecuteQuery;
      queryBtn.addEventListener("click", boundHandlers.executeQuery);
      logDebug("Bound execute query handler");
    }

    // Cancel Query button
    const cancelBtn = ALLY_UI_MANAGER.getElement("ally-cancel-query");
    if (cancelBtn) {
      boundHandlers.cancelQuery = handleCancelQuery;
      cancelBtn.addEventListener("click", boundHandlers.cancelQuery);
      logDebug("Bound cancel query handler");
    }

    // Clear Filters button
    const clearBtn = ALLY_UI_MANAGER.getElement("ally-clear-filters");
    if (clearBtn) {
      boundHandlers.clearFilters = handleClearFilters;
      clearBtn.addEventListener("click", boundHandlers.clearFilters);
      logDebug("Bound clear filters handler");
    }

    // API Retry button - retries connection when in ERROR state
    const retryBtn = ALLY_UI_MANAGER.getElement("ally-api-retry-btn");
    if (retryBtn) {
      boundHandlers.retryConnection = function () {
        logInfo("Retry connection requested");
        // Trigger warm-up which will attempt to reconnect
        performWarmUp();
      };
      retryBtn.addEventListener("click", boundHandlers.retryConnection);
      logDebug("Bound retry connection handler");
    }

    // Save credentials checkbox - save on change
    const saveCheckbox = ALLY_UI_MANAGER.getElement("ally-save-credentials");
    if (saveCheckbox) {
      saveCheckbox.addEventListener("change", function () {
        const formValues = ALLY_UI_MANAGER.getFormValues();
        saveCredentials(formValues);
      });
      logDebug("Bound save credentials handler");
    }

    // Monitor credential fields for changes to update status and CTA
    var clientIdInput = ALLY_UI_MANAGER.getElement("ally-client-id");
    var tokenInput = ALLY_UI_MANAGER.getElement("ally-api-token");

    var credentialChangeHandler = function () {
      var formValues = ALLY_UI_MANAGER.getFormValues();
      var credentialsPresent = formValues.clientId && formValues.token;

      // If credentials are cleared, reset status to UNKNOWN
      if (!credentialsPresent) {
        if (apiState !== "UNKNOWN") {
          setApiState("UNKNOWN", false);
        }
        // Hide CTA when credentials incomplete
        setTestConnectionCTA(false);
      } else {
        // Credentials entered - show CTA if API not ready
        var apiNotReady = apiState !== "READY" && apiState !== "WARMING";
        setTestConnectionCTA(apiNotReady);
      }
    };

    if (clientIdInput) {
      clientIdInput.addEventListener("input", credentialChangeHandler);
    }
    if (tokenInput) {
      tokenInput.addEventListener("input", credentialChangeHandler);
    }
    logDebug("Bound credential change handlers with CTA");

    // Endpoint radio buttons - update filter builder when endpoint changes
    const endpointRadios = document.querySelectorAll(
      'input[name="ally-endpoint"]',
    );
    if (endpointRadios.length > 0) {
      boundHandlers.endpointChange = function (event) {
        const newEndpoint = event.target.value;
        logDebug("Endpoint changed to: " + newEndpoint);

        // Update Filter Builder to show/hide fields based on endpoint
        if (
          typeof ALLY_FILTER_BUILDER !== "undefined" &&
          ALLY_FILTER_BUILDER.isInitialised()
        ) {
          ALLY_FILTER_BUILDER.updateForEndpoint(newEndpoint);
        }
      };

      endpointRadios.forEach(function (radio) {
        radio.addEventListener("change", boundHandlers.endpointChange);
      });
      logDebug("Bound endpoint change handler");
    }

    logInfo("Event listeners set up");
  }

  // ========================================================================
  // Private Methods - Report Builder Caching
  // ========================================================================

  /**
   * Compares Report Builder data for changes
   * @private
   * @param {Object} oldData - Cached data
   * @param {Object} newData - Fresh data
   * @returns {boolean} True if data has changed
   */
  function rbDataHasChanged(oldData, newData) {
    if (!oldData || !newData) return true;
    if (!oldData.data || !newData.data) return true;

    // Compare record counts
    if (oldData.data.length !== newData.data.length) return true;

    // Compare metadata totals
    var oldTotal = oldData.metadata && oldData.metadata.filteredTotal;
    var newTotal = newData.metadata && newData.metadata.filteredTotal;
    if (oldTotal !== newTotal) return true;

    // Compare first few records' key fields
    var checkCount = Math.min(3, oldData.data.length);
    for (var i = 0; i < checkCount; i++) {
      var oldRecord = oldData.data[i];
      var newRecord = newData.data[i];
      if (!oldRecord || !newRecord) return true;
      if (oldRecord.courseId !== newRecord.courseId) return true;
      if (oldRecord.overallScore !== newRecord.overallScore) return true;
    }

    return false;
  }

  /**
   * Refreshes Report Builder data in background
   * @private
   * @param {string} cacheKey - Cache key
   * @param {Object} cachedEntry - Cached entry
   * @param {Object} formValues - Current form values
   */
  function refreshReportBuilderInBackground(cacheKey, cachedEntry, formValues) {
    if (rbBackgroundRefreshInProgress) return;
    rbBackgroundRefreshInProgress = true;

    logInfo("Starting background refresh for Report Builder");

    // Build query options
    var filters = {};

    // Quick filters
    if (formValues.term) {
      filters.termId = formValues.term;
    }
    if (formValues.department) {
      filters.departmentId = formValues.department;
    }
    if (formValues.activeOnly) {
      filters.allyEnabled = "true";
    }

    // Course search filter
    if (
      typeof ALLY_COURSE_SEARCH !== "undefined" &&
      ALLY_COURSE_SEARCH.isInitialised()
    ) {
      var selectedCourse = ALLY_COURSE_SEARCH.getSelectedCourse();
      if (selectedCourse) {
        filters.courseName = "eq:" + selectedCourse.name;
      }
    }

    // Advanced filters
    if (
      typeof ALLY_FILTER_BUILDER !== "undefined" &&
      ALLY_FILTER_BUILDER.isInitialised()
    ) {
      var advFilters = ALLY_FILTER_BUILDER.getFilters();
      advFilters.forEach(function (f) {
        if (f.noOperator) {
          filters[f.field] = f.value;
        } else {
          filters[f.field] = f.operator + ":" + f.value;
        }
      });
    }

    var queryOptions = {
      limit: formValues.limit || 100,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    };

    if (formValues.sortField) {
      queryOptions.sort = formValues.sortField;
      queryOptions.order = formValues.sortOrder || "asc";
    }

    var endpoint = formValues.endpoint || "overall";
    var fetchMethod =
      endpoint === "issues"
        ? ALLY_API_CLIENT.fetchIssues
        : ALLY_API_CLIENT.fetchOverall;

    fetchMethod(queryOptions)
      .then(function (freshData) {
        rbBackgroundRefreshInProgress = false;

        var resultsSection = document.getElementById("ally-results-section");

        if (rbDataHasChanged(cachedEntry.data, freshData)) {
          logInfo("Fresh data differs from cache");

          // Update cache with fresh data
          var freshRecordCount = freshData.data ? freshData.data.length : 0;
          ALLY_CACHE.set(cacheKey, {
            type: "report-builder",
            queryDescription: endpoint + " endpoint query",
            endpoint: endpoint,
            recordCount: freshRecordCount,
            data: freshData,
          });

          // Show update banner
          if (resultsSection && typeof ALLY_CACHE_UI !== "undefined") {
            ALLY_CACHE_UI.hideCachedBanner(resultsSection);
            ALLY_CACHE_UI.showUpdateBanner(resultsSection, function () {
              // Apply update callback
              displayResults(freshData);
              ALLY_CACHE_UI.hideUpdateBanner(resultsSection);
              ALLY_UI_MANAGER.announce("Results updated with latest data.");
            });
          }
        } else {
          logInfo("Fresh data matches cache, updating timestamp");

          // Silently update cache timestamp
          ALLY_CACHE.set(cacheKey, cachedEntry);

          // Hide cached banner
          if (resultsSection && typeof ALLY_CACHE_UI !== "undefined") {
            ALLY_CACHE_UI.hideCachedBanner(resultsSection);
          }
        }
      })
      .catch(function (error) {
        rbBackgroundRefreshInProgress = false;
        logWarn("Background refresh failed:", error.message);
        // Keep showing cached data, don't interrupt user
      });
  }

  /**
   * Handles cache browser selection
   * @private
   * @param {string} cacheKey - Selected cache key
   * @param {Object} entry - Selected cache entry
   */
  function handleCacheBrowserSelect(cacheKey, entry) {
    if (!entry || !entry.type) {
      logWarn("Invalid cache entry selected");
      return;
    }

    logInfo("Loading cached entry:", entry.type, cacheKey);

    // Hide cache browser
    if (typeof ALLY_CACHE_UI !== "undefined") {
      ALLY_CACHE_UI.hideCacheBrowser();
    }

    // Switch to correct report type and render
    switch (entry.type) {
      case "course-report":
        if (typeof ALLY_REPORT_SWITCHER !== "undefined") {
          ALLY_REPORT_SWITCHER.setReportType("course-report");
        }
        setTimeout(function () {
          if (typeof ALLY_COURSE_REPORT !== "undefined") {
            ALLY_COURSE_REPORT.renderFromCache(entry);
          }
        }, 100);
        break;

      case "statement-preview":
        if (typeof ALLY_REPORT_SWITCHER !== "undefined") {
          ALLY_REPORT_SWITCHER.setReportType("statement-preview");
        }
        setTimeout(function () {
          if (typeof ALLY_STATEMENT_PREVIEW !== "undefined") {
            ALLY_STATEMENT_PREVIEW.renderFromCache(entry);
          }
        }, 100);
        break;

      case "report-builder":
        if (typeof ALLY_REPORT_SWITCHER !== "undefined") {
          ALLY_REPORT_SWITCHER.setReportType("report-builder");
        }
        setTimeout(function () {
          renderReportBuilderFromCache(entry);
        }, 100);
        break;

      default:
        logWarn("Unknown cache entry type:", entry.type);
    }
  }

  /**
   * Renders Report Builder from cached entry
   * @private
   * @param {Object} cachedEntry - Cached entry object
   * @returns {boolean} True if render successful
   */
  function renderReportBuilderFromCache(cachedEntry) {
    if (!cachedEntry || !cachedEntry.data) {
      logWarn("Invalid cached entry for Report Builder");
      return false;
    }

    // Render the data
    displayResults(cachedEntry.data);

    // Show cached banner (not checking for updates when loaded from manager)
    var resultsSection = document.getElementById("ally-results-section");
    if (resultsSection && typeof ALLY_CACHE_UI !== "undefined") {
      ALLY_CACHE_UI.showCachedBanner(
        resultsSection,
        cachedEntry.timestamp,
        false,
        false,
      );
    }

    // Announce to screen readers
    var recordCount = cachedEntry.data.data ? cachedEntry.data.data.length : 0;
    ALLY_UI_MANAGER.announce(
      "Loaded cached query results. " +
        recordCount +
        " records from " +
        ALLY_CACHE.formatAge(cachedEntry.timestamp) +
        ".",
    );

    logInfo("Rendered Report Builder from cache");
    return true;
  }
  // ========================================================================
  // Public API
  // ========================================================================

  const publicAPI = {
    /**
     * Initialises the main controller
     * Sets up UI Manager, loads credentials, and binds events
     * @returns {boolean} True if initialisation succeeded
     */
    initialise: function () {
      if (initialised) {
        logWarn("Already initialised");
        return true;
      }

      logInfo("Initialising Main Controller...");

      // Check dependencies
      if (typeof ALLY_UI_MANAGER === "undefined") {
        logError("ALLY_UI_MANAGER not available");
        return false;
      }

      if (typeof ALLY_CONFIG === "undefined") {
        logWarn("ALLY_CONFIG not available - some features may be limited");
      }

      if (typeof ALLY_API_CLIENT === "undefined") {
        logWarn("ALLY_API_CLIENT not available - API features will not work");
      }

      // Initialise UI Manager if not done
      if (!ALLY_UI_MANAGER.isInitialised()) {
        ALLY_UI_MANAGER.initialise();
      }

      // Initialise Filter Builder if available
      if (
        typeof ALLY_FILTER_BUILDER !== "undefined" &&
        !ALLY_FILTER_BUILDER.isInitialised()
      ) {
        ALLY_FILTER_BUILDER.initialise();
        logDebug("Filter Builder initialised");
      }

      // Initialise Course Search if available (Report Builder)
      if (
        typeof ALLY_COURSE_SEARCH !== "undefined" &&
        !ALLY_COURSE_SEARCH.isInitialised()
      ) {
        ALLY_COURSE_SEARCH.initialise();
        logDebug("Course Search initialised");
      }

      // Initialise Course Report Search if available (Phase 7A)
      if (
        typeof ALLY_COURSE_REPORT_SEARCH !== "undefined" &&
        !ALLY_COURSE_REPORT_SEARCH.isInitialised()
      ) {
        ALLY_COURSE_REPORT_SEARCH.initialise();
        logDebug("Course Report Search initialised");
      }

      // Initialise Course Report Controller if available (Phase 7A.3)
      if (
        typeof ALLY_COURSE_REPORT !== "undefined" &&
        !ALLY_COURSE_REPORT.isInitialised()
      ) {
        ALLY_COURSE_REPORT.initialise();
        logDebug("Course Report Controller initialised");
      }

      // Initialise Report Switcher if available (Phase 7)
      if (
        typeof ALLY_REPORT_SWITCHER !== "undefined" &&
        !ALLY_REPORT_SWITCHER.isInitialised()
      ) {
        ALLY_REPORT_SWITCHER.initialise();
        ALLY_REPORT_SWITCHER.onChange(function (reportType) {
          logInfo("Report type changed to:", reportType);

          // Handle Statement Preview lazy initialisation (Phase 7B)
          if (reportType === "statement-preview") {
            // Use setTimeout to ensure DOM is visible before initialising
            setTimeout(function () {
              // Initialise search module (force reinit to cache elements now visible)
              if (typeof ALLY_STATEMENT_PREVIEW_SEARCH !== "undefined") {
                ALLY_STATEMENT_PREVIEW_SEARCH.initialise(true);
                logDebug("Statement Preview Search initialised/reinitialised");
              }

              // Initialise main controller (force reinit to cache elements now visible)
              if (typeof ALLY_STATEMENT_PREVIEW !== "undefined") {
                ALLY_STATEMENT_PREVIEW.initialise(true);
                logDebug(
                  "Statement Preview Controller initialised/reinitialised",
                );
              }
            }, 50);
          }
        });
        logDebug("Report Switcher initialised");
      }

      // Initialise Cache UI if available (Stage 4)
      if (
        typeof ALLY_CACHE_UI !== "undefined" &&
        !ALLY_CACHE_UI.isInitialised()
      ) {
        ALLY_CACHE_UI.initialise();
        logDebug("Cache UI initialised");
      }

      // Load stored credentials
      loadStoredCredentials();

      // Set credentials section open state and highlight if credentials missing
      // Use timeout to allow browser autofill to complete
      setTimeout(function () {
        var formValues = ALLY_UI_MANAGER.getFormValues();
        var credentialsMissing = !formValues.clientId || !formValues.token;

        if (credentialsMissing) {
          // Highlight and scroll to credentials section
          highlightCredentialsSection();
        } else {
          // Credentials exist - close section and trigger warm-up
          var detailsEl = document.getElementById("ally-credentials-details");
          if (detailsEl) {
            detailsEl.open = false;
          }

          // Trigger API warm-up if credentials present
          performWarmUp();
        }
      }, 150);

      // Set up event listeners
      setupEventListeners();

      initialised = true;
      logInfo("Main Controller initialised successfully");

      return true;
    },

    /**
     * Checks if the controller has been initialised
     * @returns {boolean} True if initialised
     */
    isInitialised: function () {
      return initialised;
    },

    /**
     * Tests the API connection with current credentials
     * @returns {Promise<boolean>} True if connection successful
     */
    testConnection: async function () {
      return await handleTestConnection();
    },

    /**
     * Executes a query with current form values
     * @returns {Promise<void>}
     */
    executeQuery: async function () {
      await handleExecuteQuery();
    },

    /**
     * Cancels the current query
     */
    cancelQuery: function () {
      handleCancelQuery();
    },

    /**
     * Clears all filter values (preserves credentials)
     */
    clearFilters: function () {
      handleClearFilters();
    },

    /**
     * Gets the current query state
     * @returns {'idle'|'running'|'cancelling'} Current state
     */
    getQueryState: function () {
      return queryState;
    },

    /**
     * Gets the current API status state
     * @returns {string} Current API state (UNKNOWN, WARMING, READY, IDLE, ERROR)
     */
    getApiState: function () {
      return apiState;
    },

    /**
     * Triggers an API warm-up if credentials are available
     * Called automatically when switching to Ally Reporting mode
     * @returns {Promise<boolean>} True if warm-up was triggered/successful
     */
    triggerWarmUp: async function () {
      // Only warm up if credentials are available
      if (!hasCredentials()) {
        logDebug("Skipping warm-up - no credentials configured");
        setApiState("UNKNOWN", false);
        return false;
      }

      // Check if page-load warm-up already completed
      if (pageLoadWarmUpComplete) {
        logInfo("Using page-load warm-up result - API already warm");
        setApiState("READY", false);
        pageLoadWarmUpComplete = false; // Reset flag
        return true;
      }

      // Don't warm up if already ready or warming
      if (apiState === "READY" || apiState === "WARMING") {
        logDebug("Skipping warm-up - already " + apiState);
        return apiState === "READY";
      }

      return await performWarmUp();
    },

    /**
     * Resets the API status to UNKNOWN (e.g., when credentials are cleared)
     */
    resetApiStatus: function () {
      clearIdleTimer();
      stopIdleDisplayUpdates();
      readyStateTimestamp = null;
      setApiState("UNKNOWN");
    },

    /**
     * Handles cache browser selection callback
     * @param {string} cacheKey - Selected cache key
     * @param {Object} entry - Selected cache entry
     */
    handleCacheBrowserSelect: handleCacheBrowserSelect,

    /**
     * Renders Report Builder from cached entry
     * @param {Object} cachedEntry - Cached entry object
     * @returns {boolean} True if render successful
     */
    renderReportBuilderFromCache: renderReportBuilderFromCache,
  };

  // ========================================================================
  // Page Load Warm-Up (runs independently of module initialisation)
  // ========================================================================

  /**
   * Attempts to warm up the API on page load if configured.
   * Runs independently - does not require full module initialisation.
   * @private
   */
  function attemptPageLoadWarmUp() {
    // Check if page-load warm-up is enabled
    const warmOnPageLoad =
      typeof ALLY_CONFIG !== "undefined" &&
      ALLY_CONFIG.API_STATUS &&
      ALLY_CONFIG.API_STATUS.WARM_ON_PAGE_LOAD === true;

    if (!warmOnPageLoad) {
      logDebug("Page-load warm-up disabled");
      return;
    }

    logInfo("Page-load warm-up enabled, checking for stored credentials...");

    // Check for stored credentials in localStorage
    try {
      const savedToken = localStorage.getItem(ALLY_CONFIG.STORAGE_KEYS.TOKEN);
      const savedClientId = localStorage.getItem(
        ALLY_CONFIG.STORAGE_KEYS.CLIENT_ID,
      );
      const savedRegion = localStorage.getItem(ALLY_CONFIG.STORAGE_KEYS.REGION);

      if (!savedToken || !savedClientId) {
        logDebug("Page-load warm-up skipped - no stored credentials");
        return;
      }

      logInfo("Found stored credentials, initiating background warm-up...");

      // Set credentials on API client
      if (typeof ALLY_API_CLIENT !== "undefined") {
        ALLY_API_CLIENT.setCredentials(savedToken, savedClientId);
        if (savedRegion && ALLY_CONFIG.isValidRegion(savedRegion)) {
          ALLY_API_CLIENT.setRegion(savedRegion);
        }

        // Perform warm-up (fire and forget - don't block page load)
        const warmupLimit = ALLY_CONFIG.API_STATUS.WARMUP_LIMIT || 1;

        ALLY_API_CLIENT.fetchOverall({ limit: warmupLimit })
          .then(function (result) {
            if (result && result.data) {
              logInfo("Page-load warm-up completed successfully");
              // Set state to READY if module has been initialised
              if (initialised) {
                setApiState("READY", false);
              } else {
                // Store flag so initialise() knows API is already warm
                pageLoadWarmUpComplete = true;
              }
            }
          })
          .catch(function (error) {
            logWarn("Page-load warm-up failed:", error.message);
          });
      }
    } catch (error) {
      logWarn("Page-load warm-up error:", error.message);
    }
  }

  /**
   * Flag to track if page-load warm-up completed before module init
   * @type {boolean}
   */
  let pageLoadWarmUpComplete = false;

  // Schedule page-load warm-up
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attemptPageLoadWarmUp);
  } else {
    // DOM already loaded, run on next tick to not block
    setTimeout(attemptPageLoadWarmUp, 0);
  }

  // Return the public API
  return publicAPI;
})();

// ========================================================================
// Global Helper - Copy Debug Data
// ========================================================================

/**
 * Copies debug data to clipboard (called from HTML onclick)
 * @param {'request'|'response'} type - Which data to copy
 */
function copyAllyDebugData(type) {
  if (typeof ALLY_API_CLIENT === "undefined") {
    console.error("[Ally] API client not available");
    return;
  }

  const debugData = ALLY_API_CLIENT.getDebugData();
  if (!debugData) {
    console.warn("[Ally] No debug data available to copy");
    return;
  }

  let dataToCopy;
  if (type === "request") {
    dataToCopy = debugData.request;
  } else if (type === "response") {
    dataToCopy = debugData.response;
  } else {
    console.error("[Ally] Unknown debug data type:", type);
    return;
  }

  if (!dataToCopy) {
    console.warn("[Ally] No " + type + " data available");
    return;
  }

  const jsonString = JSON.stringify(dataToCopy, null, 2);

  navigator.clipboard
    .writeText(jsonString)
    .then(function () {
      // Show success notification if available
      if (typeof window.notifySuccess === "function") {
        window.notifySuccess(
          type.charAt(0).toUpperCase() +
            type.slice(1) +
            " data copied to clipboard",
        );
      } else {
        console.log("[Ally] " + type + " data copied to clipboard");
      }
    })
    .catch(function (err) {
      console.error("[Ally] Failed to copy to clipboard:", err);
      if (typeof window.notifyError === "function") {
        window.notifyError("Failed to copy to clipboard");
      }
    });
}

// Tests moved to ally-tests.js
