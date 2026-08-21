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
   * Last known institutional sign-in state, so the entra:changed handler can
   * act on a genuine FLIP and ignore everything else.
   *
   * Load-bearing: that event fires for several reasons — "renewal-failed"
   * among them — with the signed-in state unchanged. Resyncing the form on one
   * of those would discard whatever the colleague had typed into it.
   * @type {boolean|null}
   */
  let lastKnownSignedIn = null;

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
   * Flag to track whether the warm-up midpoint announcement has been made.
   * The status card is silenced (aria-live="off" on #ally-api-status), so a
   * two-to-three-minute warm-up would otherwise pass without a word. One
   * announcement is made per warm-up, at the halfway mark; this flag is what
   * keeps it to one, since the progress callback fires on every poll.
   * @type {boolean}
   */
  let warmUpMidpointAnnounced = false;

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

      // Every field is set unconditionally, empty string included: this runs on
      // credentials:changed as well as at startup, so an absent key means the
      // value was CLEARED elsewhere (the Set Up page) and the form must follow.
      // Setting only the truthy ones would leave a stale client ID and token on
      // screen after a clear.
      //
      // That still holds for the token and the worker URL. It NO LONGER holds
      // for the client ID: getEffectiveClientId() supplies the built-in default
      // when nothing is stored, so for a signed-in colleague a clear now
      // REPOPULATES the default rather than blanking the field. That is the
      // intended behaviour — the default is what they should be using — but it
      // is a real change from "a clear always empties this box".
      const values = {};

      values.token = savedToken || "";

      // A stored client ID still wins; the default only fills a gap, and it is
      // gated on the sign-in inside getEffectiveClientId().
      values.clientId =
        savedClientId ||
        (typeof ALLY_CONFIG.getEffectiveClientId === "function"
          ? ALLY_CONFIG.getEffectiveClientId()
          : "");

      // The region select has no empty option, so it falls back to the default
      // rather than to "" — blanking a select is not a meaningful state.
      values.region =
        savedRegion && ALLY_CONFIG.isValidRegion(savedRegion)
          ? savedRegion
          : ALLY_CONFIG.DEFAULT_REGION || "EU";

      values.saveCredentials = saveCredentials === "true";

      logDebug(
        "Loaded stored credentials, region: " +
          values.region +
          ", client ID: " +
          (values.clientId ? "present" : "absent") +
          ", token: " +
          (values.token ? "present" : "absent"),
      );

      // The worker URL is stored independently of the "remember credentials"
      // opt-in — it carries no secret and is the fallback that keeps the app
      // working without a token, so it loads whether or not that box is ticked.
      // Always set the key (even to "") so a cleared value syncs into the form.
      const savedWorkerUrl = localStorage.getItem(
        ALLY_CONFIG.STORAGE_KEYS.WORKER_URL,
      );
      values.workerUrl = ALLY_CONFIG.normaliseWorkerUrl(savedWorkerUrl);
      if (values.workerUrl) {
        logDebug("Loaded stored worker URL");
      }

      // Apply loaded values to form. No emptiness gate: `values` now always
      // carries every field, and an all-empty set is itself a valid instruction
      // (it is what a clear looks like).
      ALLY_UI_MANAGER.setFormValues(values);
      setWorkerUrlError("");
      logInfo("Restored saved credentials");
    } catch (error) {
      logError("Failed to load stored credentials:", error);
    }
  }

  /**
   * Persists (or removes) the proxy-worker URL, normalised to its base form.
   *
   * Deliberately separate from saveCredentials()' opt-in branch: the worker URL
   * is not a credential, so it is written whether or not "remember credentials"
   * is ticked, and it is not swept up by the clear path.
   *
   * @private
   * @param {string} rawUrl - Raw value from the form (may be empty)
   * @returns {string} The normalised URL that was stored ("" if removed)
   */
  /**
   * Shows or hides the inline validation message on the worker-URL field.
   * The message element is referenced from the input's aria-describedby
   * alongside the help text, so a screen reader reads the error with the field.
   * @private
   * @param {string} message - Text to show; "" hides the message and the flag
   */
  function setWorkerUrlError(message) {
    const input = ALLY_UI_MANAGER.getElement("ally-worker-url");
    const errorEl = ALLY_UI_MANAGER.getElement("ally-worker-url-error");

    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = !message;
    }

    if (!input) return;
    if (message) {
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("aria-invalid");
    }
  }

  /**
   * Reports whether the worker-URL field holds text the normaliser rejects.
   *
   * A non-empty entry that will not normalise is a typo — most often a missing
   * scheme — not a request to remove the worker, so callers must refuse it
   * rather than let persistWorkerUrl() delete a URL that was working.
   *
   * @private
   * @param {Object} formValues - Form values to inspect
   * @returns {boolean} True if the field is populated but unusable
   */
  function workerUrlIsInvalid(formValues) {
    const raw = formValues && formValues.workerUrl;
    if (typeof raw !== "string" || !raw.trim()) return false;
    return !ALLY_CONFIG.normaliseWorkerUrl(raw);
  }

  function persistWorkerUrl(rawUrl) {
    // undefined means the form has no worker-URL field at all — leave whatever
    // is stored alone rather than treating "absent" as "cleared".
    if (typeof rawUrl !== "string") {
      return ALLY_CONFIG.getWorkerUrl();
    }

    const normalised = ALLY_CONFIG.normaliseWorkerUrl(rawUrl);

    if (normalised) {
      localStorage.setItem(ALLY_CONFIG.STORAGE_KEYS.WORKER_URL, normalised);
      logDebug("Worker URL saved");
    } else {
      localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.WORKER_URL);
      logDebug("Worker URL cleared");
    }

    return normalised;
  }

  /**
   * Notifies Set Up and other listeners that Ally credentials changed
   * (Phase SU-3). Emitted only on a user-initiated save/clear — never when
   * merely LOADING stored values, which would bounce the sync back and forth.
   * @private
   * @param {string} action - "saved" or "cleared"
   */
  function emitCredentialsChanged(action) {
    if (
      window.EmbedEventEmitter &&
      typeof window.EmbedEventEmitter.emit === "function"
    ) {
      window.EmbedEventEmitter.emit("credentials:changed", {
        service: "ally",
        action: action,
      });
    }
  }

  /**
   * Reports whether the form supplies a usable TRANSPORT: an API token, a
   * worker URL (from the form when the person has typed one, else from storage
   * or the built-in default), or an institutional sign-in, which makes the
   * built-in worker reachable without any configuration at all.
   *
   * The client ID is checked separately — it is required either way, because
   * the worker reads it from the request payload and has no default.
   *
   * @private
   * @param {Object} formValues - Form values to inspect
   * @returns {boolean} True if a request could be issued
   */
  function formHasTransport(formValues) {
    if (formValues && formValues.token) return true;

    // A field the person has TYPED INTO governs; an empty one does not.
    //
    // An empty field means "I have not chosen one", not "there is none", and
    // the built-in default is what answers that — standing rule 15, default
    // rather than disable. This tested `typeof workerUrl === "string"`, and an
    // empty string is still a string, so the hasUsableWorkerUrl() fallback
    // below was unreachable on any page that carries the field at all. A
    // signed-in colleague with an empty field was told they had no credentials
    // while Set Up, which asks hasUsableWorkerUrl() directly, read Configured.
    const typedWorkerUrl =
      formValues && typeof formValues.workerUrl === "string"
        ? formValues.workerUrl.trim()
        : "";

    if (typedWorkerUrl) {
      return !!ALLY_CONFIG.normaliseWorkerUrl(typedWorkerUrl);
    }

    return (
      typeof ALLY_CONFIG.hasUsableWorkerUrl === "function" &&
      ALLY_CONFIG.hasUsableWorkerUrl()
    );
  }

  /**
   * Pushes the form's credentials onto the API client, choosing the transport:
   * a token if there is one, otherwise the token-free worker mode.
   *
   * Persists the worker URL first, because the client resolves it from storage
   * — so a URL typed but not yet saved would otherwise fail its own guard.
   *
   * @private
   * @param {Object} formValues - Form values to apply
   * @returns {boolean} True if credentials were applied
   */
  function applyCredentialsToClient(formValues) {
    if (typeof ALLY_API_CLIENT === "undefined") return false;

    persistWorkerUrl(formValues.workerUrl);

    const applied = formValues.token
      ? ALLY_API_CLIENT.setCredentials(formValues.token, formValues.clientId)
      : ALLY_API_CLIENT.setWorkerCredentials(formValues.clientId);

    if (applied) {
      ALLY_API_CLIENT.setRegion(formValues.region);
    }

    return applied;
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
      // The worker URL is persisted independently of the "remember credentials"
      // opt-in, and SURVIVES an unchecked clear: it carries no secret, and it is
      // the fallback that keeps the app working when no token is set. Normalise
      // to the base form so /issues and /query can both be derived from it.
      persistWorkerUrl(formValues.workerUrl);

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

        emitCredentialsChanged("saved");
      } else {
        // Clear stored credentials if user unchecked the option
        localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.TOKEN);
        localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.CLIENT_ID);
        localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.REGION);
        localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.SAVE_CREDENTIALS);
        logDebug("Credentials cleared from localStorage");

        emitCredentialsChanged("cleared");
      }
    } catch (error) {
      logError("Failed to save credentials:", error);
    }
  }

  /**
   * Handles the Save credentials button.
   *
   * Until this existed, credentials persisted only as a side-effect of a
   * successful Test Connection, a successful query, or toggling Remember —
   * there was no way to commit a set the user was simply happy with, and
   * nothing to emit credentials:changed so the Set Up page could follow.
   *
   * @private
   */
  function handleSaveCredentials() {
    const formValues = ALLY_UI_MANAGER.getFormValues();

    if (workerUrlIsInvalid(formValues)) {
      setWorkerUrlError(
        "Enter a full URL including https://, for example https://your-proxy.workers.dev",
      );
      ALLY_UI_MANAGER.announce(
        "The proxy worker URL is not valid. Enter a full URL including https://.",
      );
      logWarn("Save rejected: worker URL could not be normalised");
      return;
    }
    setWorkerUrlError("");

    if (!formValues.clientId || !formHasTransport(formValues)) {
      const message =
        "Enter a Client ID, and either an API token or a proxy worker URL, before saving.";
      showNotification(message, "warning");
      logWarn("Save rejected: missing client ID or transport");
      return;
    }

    // Saving is an explicit statement of intent, so it implies Remember —
    // otherwise the button would write the worker URL and silently drop the
    // credentials the user just asked to keep.
    const saveCheckbox = ALLY_UI_MANAGER.getElement("ally-save-credentials");
    if (saveCheckbox && !saveCheckbox.checked) {
      saveCheckbox.checked = true;
      formValues.saveCredentials = true;
    }

    saveCredentials(formValues);
    applyCredentialsToClient(formValues);

    const message = "Ally credentials saved for the " + formValues.region + " region.";
    showNotification(message, "success");
    logInfo("Credentials saved from the Save button");
  }

  /**
   * Handles the Clear credentials button. Confirms first, because this deletes
   * a token the user may not have stored anywhere else.
   * @private
   */
  function handleClearCredentials() {
    const message =
      "Are you sure you want to clear your Ally credentials? The proxy worker URL will be removed as well.";

    if (typeof window.safeConfirm === "function") {
      window
        .safeConfirm(message, "Clear Ally Credentials")
        .then(function (confirmed) {
          if (confirmed) performClearCredentials();
        });
      return;
    }

    // Fallback if the universal modal has not loaded
    if (confirm(message)) performClearCredentials();
  }

  /**
   * Removes the Ally credential keys AND the stored worker URL, and blanks
   * their fields.
   *
   * The worker URL IS cleared, because a control labelled Clear should clear
   * it — that is what people expect of it. This is only safe as of abcea04:
   * before then an empty worker-URL field made formHasTransport() return false,
   * so removing the URL would have left a signed-in colleague unable to use the
   * tool. An empty field now falls through to the built-in default, so a
   * signed-in colleague keeps a working transport after a clear.
   *
   * Set Up's clear does the same thing, and the two must change together — one
   * of them alone rebuilds the asymmetry between the two surfaces.
   *
   * @private
   */
  function performClearCredentials() {
    try {
      localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.TOKEN);
      localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.CLIENT_ID);
      localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.REGION);
      localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.SAVE_CREDENTIALS);
      localStorage.removeItem(ALLY_CONFIG.STORAGE_KEYS.WORKER_URL);
    } catch (error) {
      logError("Failed to clear credentials:", error);
    }

    // An empty string is a meaningful instruction to setFormValues, which
    // tests for the PRESENCE of each property — omitting workerUrl would leave
    // the field showing a URL that is no longer stored.
    ALLY_UI_MANAGER.setFormValues({
      region: ALLY_CONFIG.DEFAULT_REGION || "EU",
      clientId: "",
      token: "",
      workerUrl: "",
      saveCredentials: false,
    });
    setWorkerUrlError("");

    setApiState("UNKNOWN", false);
    emitCredentialsChanged("cleared");

    // The clear removes what the PERSON stored, which is not the same as
    // removing their access: a signed-in colleague keeps the built-in client ID
    // and the built-in worker, so Ally still works for them. Read AFTER the
    // removals above, so the sentence describes the post-clear state.
    //
    // hasInstitutionalSignIn() rather than hasUsableWorkerUrl() or a composite:
    // Set Up gates the same sentence on isAllyConfigured(), and once an
    // EXPLICIT clear has run that composite collapses to exactly this predicate
    // — no stored client ID and no stored token survive, so its client-ID half
    // reduces to getEffectiveClientId(), which is gated on the sign-in, and its
    // transport half reduces to hasUsableWorkerUrl() with no stored URL left,
    // which is also the sign-in. Naming the sign-in directly is what makes the
    // two sentences mean the same thing rather than merely look alike, and it
    // stays honest if a removal above throws: hasUsableWorkerUrl() would then
    // read true off a surviving URL and credit the sign-in for it.
    const signedIn =
      typeof ALLY_CONFIG !== "undefined" &&
      typeof ALLY_CONFIG.hasInstitutionalSignIn === "function" &&
      ALLY_CONFIG.hasInstitutionalSignIn();

    // Output once, through the shared notification path, which announces to
    // the screen reader itself — so a second private-announcer write here
    // would be heard twice. Still built before the call, because the sentence
    // varies with the sign-in state.
    let message =
      "Ally credentials cleared. The proxy worker URL was removed as well.";
    if (signedIn) {
      message += " Ally still works with your University sign-in.";
    }
    showNotification(message, "info");
    logInfo("Credentials cleared from the Clear button");
  }

  // ========================================================================
  // Private Methods - API Status Management
  // ========================================================================

  /**
   * Sets the API state and updates the status indicator
   * @private
   * @param {string} newState - One of ALLY_CONFIG.API_STATES values
   * @param {boolean} [announce=true] - Whether to announce to screen readers
   * @param {{label: string, hint: string}} [errorInfo] - For the ERROR state,
   *   an optional context-specific label/hint (see apiErrorInfo). When omitted,
   *   the ERROR state falls back to the generic "check your credentials" hint.
   */
  function setApiState(newState, announce, errorInfo) {
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
    updateStatusIndicator(newState, errorInfo);

    // Announce to screen readers if state changed meaningfully
    if (announce && previousState !== newState) {
      const message =
        newState === "ERROR" && errorInfo && errorInfo.label
          ? errorInfo.label
          : getStatusMessage(newState);
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
   * @param {{label: string, hint: string}} [errorInfo] - Optional ERROR-state
   *   label/hint (see apiErrorInfo); overrides the generic label/credentials hint.
   */
  function updateStatusIndicator(state, errorInfo) {
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

    setTextIfChanged(
      textEl,
      state === "ERROR" && errorInfo && errorInfo.label
        ? errorInfo.label
        : getStatusMessage(state),
    );

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
        setTextIfChanged(
          hintEl,
          "The API needs to warm up before generating reports.",
        );
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
      setTextIfChanged(hintEl, "API is ready. You can now generate reports.");
      // Hide progress bar after a moment
      setTimeout(function () {
        if (progressContainer && apiState === "READY") {
          progressContainer.hidden = true;
        }
        if (apiState === "READY") {
          setTextIfChanged(hintEl, "");
        }
      }, 2000);
    } else if (state === "ERROR") {
      if (progressContainer) {
        progressContainer.hidden = true;
      }
      setTextIfChanged(
        hintEl,
        (errorInfo && errorInfo.hint) ||
          (ALLY_CONFIG &&
            ALLY_CONFIG.MESSAGES &&
            ALLY_CONFIG.MESSAGES.CREDENTIALS_HINT) ||
          "Please check your credentials and try again.",
      );
      // Show retry button
      const retryBtn = ALLY_UI_MANAGER.getElement("ally-api-retry-btn");
      if (retryBtn) {
        retryBtn.hidden = false;
      }
    } else if (state === "UNKNOWN") {
      if (progressContainer) {
        progressContainer.hidden = true;
      }
      setTextIfChanged(
        hintEl,
        "Configure your API credentials to get started.",
      );
    } else if (state === "IDLE") {
      if (progressContainer) {
        progressContainer.hidden = true;
      }
      setTextIfChanged(hintEl, "");
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
   * Writes text into an element only when the value would actually change.
   *
   * AGENTS.md's write-if-changed rule. An identical-value textContent
   * assignment is NOT a no-op: measured 16 August 2026 on this card, it
   * destroys the existing text node and inserts a new one, arriving as a
   * childList mutation (added 1, removed 1) rather than a characterData one.
   * Every such mutation is a chance for a live region to speak again, so the
   * comparison has to happen before the assignment, not be relied on after it.
   *
   * @private
   * @param {Element|null} el - Target element; a missing element is a no-op
   * @param {string} text - The text to write
   * @returns {boolean} True if the element was written to, false otherwise
   */
  function setTextIfChanged(el, text) {
    if (!el) {
      return false;
    }

    if (el.textContent === text) {
      return false;
    }

    el.textContent = text;
    return true;
  }

  /**
   * Maps a classified API error to the ERROR-state status label and hint, so
   * the indicator reflects the real cause. A genuine auth failure keeps the
   * "check your credentials" hint; a server-side fault (502/503/504), an
   * unreachable server, or a timeout makes clear the problem is not the user's
   * credentials. Falls back to the credentials hint when the cause is unknown.
   * @private
   * @param {Object|null} error - Classified error (see ALLY_API_CLIENT.ERROR_TYPES)
   * @returns {{label: string, hint: string}}
   */
  function apiErrorInfo(error) {
    var M = (typeof ALLY_CONFIG !== "undefined" && ALLY_CONFIG.MESSAGES) || {};
    var TYPES =
      (typeof ALLY_API_CLIENT !== "undefined" && ALLY_API_CLIENT.ERROR_TYPES) ||
      {};
    var defaultInfo = {
      label: M.STATUS_ERROR || "Connection error",
      hint: M.CREDENTIALS_HINT || "Please check your credentials and try again.",
    };
    if (!error || !error.type) return defaultInfo;

    // The status-aware sentences on the WORKER transport each need their own
    // heading, and error.type cannot tell them apart: two are AUTH and two are
    // SERVER. Match on the MESSAGE, by identity against the shared
    // ALLY_CONFIG.MESSAGES constant the client built it from.
    //
    // Why message identity rather than the type or a transport field: it gives
    // each sentence its own heading, needs nothing read out of a response body,
    // and leaves every other error untouched BY CONSTRUCTION rather than by a
    // guard. AUTH_ERROR is deliberately not a key here, so the direct-token
    // path still falls through to defaultInfo exactly as before.
    //
    // This runs BEFORE the SERVER branch on purpose: the gate's 503 would
    // otherwise be told that Ally returned it, and Ally never saw the request,
    // and the 502 would be told "Ally service unavailable" when this tool's own
    // Ally token may be the thing at fault. Display only — the ERROR_TYPE is
    // untouched, so both stay retryable.
    //
    // Order mirrors the declaration order in ALLY_CONFIG.MESSAGES. Matching is
    // by message identity, so order cannot affect correctness; it is kept so
    // the two lists read as one.
    const statusAwareHeadings = [
      {
        message: M.SIGN_IN_REQUIRED,
        label: M.STATUS_SIGN_IN_REQUIRED,
        fallbackLabel: "Sign-in required",
      },
      {
        message: M.NOT_PERMITTED,
        label: M.STATUS_NOT_PERMITTED,
        fallbackLabel: "Account not permitted",
      },
      {
        message: M.SIGN_IN_CHECK_UNAVAILABLE,
        label: M.STATUS_SIGN_IN_CHECK_UNAVAILABLE,
        fallbackLabel: "Sign-in check unavailable",
      },
      {
        message: M.REPORTING_SERVICE_ERROR,
        label: M.STATUS_REPORTING_SERVICE_ERROR,
        fallbackLabel: "Reporting service error",
      },
    ];

    const heading = statusAwareHeadings.find(function (entry) {
      // Both halves must be present: an absent MESSAGES key must never match an
      // error that happens to carry no message.
      return Boolean(entry.message) && error.message === entry.message;
    });

    if (heading) {
      return {
        label: heading.label || heading.fallbackLabel,
        hint: error.message,
      };
    }

    if (error.type === TYPES.SERVER) {
      var serverHint =
        M.SERVER_ERROR_HINT ||
        "This looks like a temporary problem at Ally's end, not your credentials. Please wait a few minutes and try again.";
      if (error.status) {
        serverHint = "Ally returned a " + error.status + " error. " + serverHint;
      }
      return {
        label: M.STATUS_SERVER_ERROR || "Ally service unavailable",
        hint: serverHint,
      };
    }
    if (error.type === TYPES.NETWORK) {
      return {
        label: M.STATUS_ERROR || "Connection error",
        hint:
          M.NETWORK_HINT ||
          "Could not reach the Ally service. Check your internet connection and try again.",
      };
    }
    if (error.type === TYPES.TIMEOUT) {
      return {
        label: M.STATUS_SERVER_ERROR || "Ally service unavailable",
        hint:
          M.TIMEOUT_HINT ||
          "The Ally service did not respond in time. It may be busy — please try again shortly.",
      };
    }
    // AUTH, VALIDATION, UNKNOWN → the credentials hint is the safe default.
    return defaultInfo;
  }

  /**
   * Help text shown while the API cannot serve a request, keyed by API state.
   * Every non-READY state has an entry, so no state can leave stale text behind.
   * @private
   * @type {Object.<string, string>}
   */
  const API_NOT_READY_MESSAGES = Object.freeze({
    UNKNOWN: "Configure API credentials first",
    WARMING: "Please wait while the API warms up...",
    ERROR: "API connection error. Check credentials.",
    IDLE: "The connection has gone idle. It will reconnect automatically.",
  });

  /**
   * Help text shown to a course-required button when no module is selected.
   * The two wordings differ deliberately — the Course Report search sits above
   * its button, the Statement Preview one does not.
   * @private
   * @type {Object.<string, string>}
   */
  const COURSE_REQUIRED_MESSAGES = Object.freeze({
    "ally-cr-execute": "Select a module above to enable this button",
    "ally-sp-execute": "Select a module first to enable this button",
  });

  /** @private @type {string} Fallback for a course-required button not listed above */
  const COURSE_REQUIRED_MESSAGE_DEFAULT =
    "Select a module first to enable this button";

  /**
   * Updates the state of all API-dependent execute buttons.
   *
   * This is the SINGLE arbiter of `disabled` and of the help text for every
   * `[data-api-required="true"]` button. Course-selection state is read from the
   * button's own `data-course-selected` attribute, written by the search module
   * that owns the selection.
   *
   * It is deliberately NOT inferred from the help text. This function is also what
   * overwrites that help text during a warm-up, so reading it back made a selected
   * module read as "no module selected" on the way back to READY — which disabled
   * the Generate button roughly three minutes into every session and kept it
   * disabled thereafter.
   *
   * @private
   */
  function updateExecuteButtonStates() {
    const apiReady = apiState === "READY";

    const apiRequiredButtons = document.querySelectorAll(
      '[data-api-required="true"]',
    );

    apiRequiredButtons.forEach(function (button) {
      const helpTextId = button.getAttribute("aria-describedby");
      const helpTextEl = helpTextId
        ? document.getElementById(helpTextId)
        : null;
      const requiresCourse =
        button.getAttribute("data-requires-course") === "true";
      const courseSelected =
        button.getAttribute("data-course-selected") === "true";

      let shouldDisable;
      let helpMessage;

      if (!apiReady) {
        // The API cannot serve a request in any state but READY.
        shouldDisable = true;
        helpMessage = API_NOT_READY_MESSAGES[apiState] || "";
        button.setAttribute("data-api-not-ready", "true");
      } else {
        button.removeAttribute("data-api-not-ready");

        shouldDisable = requiresCourse && !courseSelected;
        helpMessage = shouldDisable
          ? COURSE_REQUIRED_MESSAGES[button.id] ||
            COURSE_REQUIRED_MESSAGE_DEFAULT
          : "";
      }

      button.disabled = shouldDisable;

      // Written from state, never read back. Write-if-changed because the span is
      // an aria-describedby target, and rewriting identical text is at best waste.
      if (helpTextEl && helpTextEl.textContent !== helpMessage) {
        helpTextEl.textContent = helpMessage;
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
    // The state is guaranteed WARMING only at the FIRST progress callback:
    // performWarmUp sets it synchronously before awaiting the request, then
    // never re-asserts it. Five concurrent paths can change it mid-poll, none
    // of them guarded by isWarmingUp — handleTestConnection (WARMING, then
    // READY or ERROR), a successful query (READY), a failed query (ERROR),
    // resetApiStatus on a credentials clear (UNKNOWN), and the page-load
    // warm-up settling (READY). Without this guard a late callback repaints
    // stale "Preparing API" text over whichever state has since settled.
    if (apiState !== "WARMING") {
      logDebug(
        "Ignoring warm-up progress callback - state is " +
          apiState +
          ", not WARMING",
      );
      return;
    }

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

    // One midpoint announcement per warm-up. The card itself is silent now
    // (aria-live="off"), so without this a two-to-three-minute wait passes
    // without a word. formatDuration is the same helper the visible message
    // uses, so what is spoken matches what is on screen. The second branch
    // guards the past-typical case, where formatDuration(0) would otherwise
    // announce "about 0 sec remaining".
    if (!warmUpMidpointAnnounced && progressPercent >= 50) {
      warmUpMidpointAnnounced = true;
      ALLY_UI_MANAGER.announce(
        estimatedRemaining > 0
          ? "API status: still preparing, about " +
              formatDuration(estimatedRemaining) +
              " remaining."
          : "API status: still preparing, taking longer than usual.",
      );
    }

    // Build progress message
    let message = "Preparing API";

    if (estimatedRemaining > 0) {
      message += " (~" + formatDuration(estimatedRemaining) + " remaining)";
    } else {
      // Past typical time, show attempt count instead
      message += " (attempt " + attempt + "/" + maxAttempts + ")";
    }

    // Update text
    setTextIfChanged(textEl, message);

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
        setTextIfChanged(
          hintEl,
          "The API needs to warm up before generating reports. This typically takes 2-3 minutes.",
        );
      } else if (estimatedRemaining <= 30 && estimatedRemaining > 0) {
        setTextIfChanged(hintEl, "Almost ready...");
      } else if (estimatedRemaining === 0) {
        setTextIfChanged(hintEl, "Taking longer than usual. Please wait...");
      }
    }
  }

  /**
   * Updates warm-up progress display when API errors are occurring
   * Shows error count and message while continuing to retry
   * @private
   * @param {number} attempt - Current polling attempt
   * @param {number} maxAttempts - Maximum polling attempts
   * @param {number} startTime - Timestamp when warm-up started
   * @param {Object} progress - Progress object with error details
   */
  function updateWarmUpProgressWithError(
    attempt,
    maxAttempts,
    startTime,
    progress,
  ) {
    // Same guard, same reason, as updateWarmUpProgress: the state is
    // guaranteed WARMING only at the first progress callback, and five
    // concurrent paths can change it mid-poll — handleTestConnection, a
    // successful query, a failed query, resetApiStatus, and the page-load
    // warm-up settling. None of them is guarded by isWarmingUp.
    if (apiState !== "WARMING") {
      logDebug(
        "Ignoring warm-up error callback - state is " +
          apiState +
          ", not WARMING",
      );
      return;
    }

    const textEl = ALLY_UI_MANAGER.getElement("ally-api-status-text");
    const progressContainer = ALLY_UI_MANAGER.getElement(
      "ally-api-progress-container",
    );
    const progressBar = ALLY_UI_MANAGER.getElement("ally-api-progress-bar");
    const progressFill = ALLY_UI_MANAGER.getElement("ally-api-progress-fill");
    const hintEl = ALLY_UI_MANAGER.getElement("ally-api-status-hint");
    const dotEl = ALLY_UI_MANAGER.getElement("ally-api-status-dot");

    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

    // Calculate progress percentage (cap at 95% until actually complete)
    const typicalDuration =
      typeof ALLY_CONFIG !== "undefined"
        ? ALLY_CONFIG.POLLING.TYPICAL_WARMUP_SECONDS
        : 180;
    const progressPercent = Math.min(
      95,
      Math.round((elapsedSeconds / typicalDuration) * 100),
    );

    // Build error-aware message
    const errorCount = progress.errorCount || 1;
    let message = "API issues - retrying";
    message += " (attempt " + attempt + "/" + maxAttempts + ")";

    // Update text
    setTextIfChanged(textEl, message);

    // Show progress bar with error state
    if (progressContainer) {
      progressContainer.hidden = false;
    }

    if (progressBar) {
      progressBar.setAttribute("data-state", "ERROR");
      progressBar.setAttribute("aria-valuenow", progressPercent);
    }

    if (progressFill) {
      progressFill.style.width = progressPercent + "%";
    }

    // Update hint with error details
    if (hintEl) {
      const errorMsg = progress.lastError || "Unknown error";
      setTextIfChanged(
        hintEl,
        "Error: " +
          errorMsg +
          " (" +
          errorCount +
          " consecutive error" +
          (errorCount > 1 ? "s" : "") +
          "). Will keep trying...",
      );
    }

    // Update dot to show error state
    if (dotEl) {
      dotEl.setAttribute("data-status", "ERROR");
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

    // Validate we have credentials: a client ID, plus a token OR a worker URL
    if (!formValues.clientId || !formHasTransport(formValues)) {
      logDebug("Cannot warm up - credentials not configured");
      setApiState("UNKNOWN", false);
      return false;
    }

    isWarmingUp = true;
    warmUpMidpointAnnounced = false;
    setApiState("WARMING");

    // Track start time for progress estimation
    const warmUpStartTime = Date.now();

    try {
      if (typeof ALLY_API_CLIENT !== "undefined") {
        applyCredentialsToClient(formValues);

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

            // Handle degraded/error states from API issues
            if (progress.status === "error" || progress.status === "degraded") {
              updateWarmUpProgressWithError(
                attempt,
                maxAttempts,
                warmUpStartTime,
                progress,
              );
            } else {
              updateWarmUpProgress(attempt, maxAttempts, warmUpStartTime);
            }
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
      setApiState("ERROR", true, apiErrorInfo(error));
      return false;
    } finally {
      isWarmingUp = false;
      warmUpMidpointAnnounced = false;
    }
  }

  /**
   * Checks if credentials are available
   * @private
   * @returns {boolean} True if credentials are configured
   */
  function hasCredentials() {
    const formValues = ALLY_UI_MANAGER.getFormValues();
    return !!formValues.clientId && formHasTransport(formValues);
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
    // Computed ONCE and read twice. The client-ID branch needs it now too:
    // "no client ID" and "no transport at all" are different faults with
    // different remedies, and only the PAIR identifies the signed-out
    // colleague who has configured nothing.
    const hasTransport = formHasTransport(formValues);

    if (!formValues.clientId) {
      // Signed out with no route of their own: the sign-in is the fault, and
      // the empty client ID is a SYMPTOM of it (see SIGN_IN_OR_CREDENTIALS in
      // ally-config.js).
      //
      // With a token typed, or with their own worker URL, they have chosen a
      // route and genuinely do need to supply the ID, so MISSING_CLIENT_ID
      // stays correct for them below.
      if (!hasTransport) {
        return {
          valid: false,
          message:
            ALLY_CONFIG?.MESSAGES?.SIGN_IN_OR_CREDENTIALS ||
            "Sign in with your University account to use Ally Reporting. " +
              "If you do not have one, enter your Client ID and API token instead.",
        };
      }

      return {
        valid: false,
        message:
          ALLY_CONFIG?.MESSAGES?.MISSING_CLIENT_ID ||
          "Please enter your Client ID.",
      };
    }

    // Either transport will do: an API token, or a proxy worker URL.
    if (!hasTransport) {
      return {
        valid: false,
        message:
          ALLY_CONFIG?.MESSAGES?.MISSING_CREDENTIALS ||
          "Please enter your API token, or a proxy worker URL.",
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
        applyCredentialsToClient(formValues);

        // Test the connection
        const success = await ALLY_API_CLIENT.testConnection();

        if (success) {
          showNotification("Connection test successful", "success");

          // Save credentials if opted in
          saveCredentials(formValues);

          // Update API status to READY
          setApiState("READY");

          // Remove CTA styling from Test Connection button
          setTestConnectionCTA(false);

          return true;
        } else {
          // testConnection returns a bare boolean; read the classified error it
          // captured so a 502/503/504 or network fault is not mislabelled as a
          // credentials problem.
          const lastErr =
            typeof ALLY_API_CLIENT.getLastError === "function"
              ? ALLY_API_CLIENT.getLastError()
              : null;
          const info = apiErrorInfo(lastErr);
          showNotification("Connection test failed. " + info.hint, "error");
          setApiState("ERROR", true, info);
          return false;
        }
      } else {
        showNotification("API client not available.", "error");
        setApiState("ERROR");
        return false;
      }
    } catch (error) {
      logError("Connection test error:", error);
      const info = apiErrorInfo(error && error.type ? error : null);
      showNotification("Connection test failed: " + error.message, "error");
      setApiState("ERROR", true, info);
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
          // Key the cache by the unique courseId so same-named courses do not
          // collide; fall back to courseName only if the id is somehow absent.
          if (selectedCourse.id) {
            cacheFilters.courseId = selectedCourse.id;
          } else {
            cacheFilters.courseName = "eq:" + selectedCourse.name;
          }
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
        applyCredentialsToClient(formValues);

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
            // Filter by the unique courseId so name-duplicate courses cannot
            // return the wrong record; fall back to courseName if id is absent.
            if (selectedCourse.id) {
              addFilter("courseId", selectedCourse.id);
              logDebug("Added course filter: courseId=" + selectedCourse.id);
            } else {
              addFilter("courseName", "eq:" + selectedCourse.name);
              logDebug(
                "Added course filter: courseName=eq:" + selectedCourse.name,
              );
            }
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
          showNotification(
            "Query complete. " + recordCount + " records returned.",
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
            showNotification(
              "API unavailable. Showing " +
                fallbackCount +
                " cached records from " +
                ALLY_CACHE.formatAge(cachedFallback.timestamp) +
                ".",
              "warning",
            );

            // Set API state to ERROR
            setApiState("ERROR", true, apiErrorInfo(error));
            return; // Don't show error UI
          }
        }

        showNotification("Query failed: " + error.message, "error");
        // Set API state to ERROR on failure
        setApiState("ERROR", true, apiErrorInfo(error));
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
      workerUrl: formValues.workerUrl,
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
    // Save credentials button
    const saveBtn = ALLY_UI_MANAGER.getElement("ally-save-credentials-btn");
    if (saveBtn) {
      boundHandlers.saveCredentials = handleSaveCredentials;
      saveBtn.addEventListener("click", boundHandlers.saveCredentials);
      logDebug("Bound save credentials button handler");
    }

    // Clear credentials button
    const clearCredsBtn = ALLY_UI_MANAGER.getElement(
      "ally-clear-credentials-btn",
    );
    if (clearCredsBtn) {
      boundHandlers.clearCredentials = handleClearCredentials;
      clearCredsBtn.addEventListener("click", boundHandlers.clearCredentials);
      logDebug("Bound clear credentials button handler");
    }

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
    var workerUrlInput = ALLY_UI_MANAGER.getElement("ally-worker-url");

    var credentialChangeHandler = function () {
      var formValues = ALLY_UI_MANAGER.getFormValues();
      var credentialsPresent =
        formValues.clientId && formHasTransport(formValues);

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

    if (workerUrlInput) {
      // A worker URL is a transport in its own right, so typing one must
      // update the status/CTA exactly as typing a token does.
      workerUrlInput.addEventListener("input", credentialChangeHandler);
      // Persist on blur so the value survives without a Test Connection, and
      // so Set Up picks it up through the credentials:changed round-trip.
      workerUrlInput.addEventListener("change", function () {
        var values = ALLY_UI_MANAGER.getFormValues();

        // Refuse a populated-but-unusable entry rather than letting
        // persistWorkerUrl() read it as "" and delete a URL that was working.
        if (workerUrlIsInvalid(values)) {
          setWorkerUrlError(
            "Enter a full URL including https://, for example https://your-proxy.workers.dev",
          );
          logWarn("Worker URL not persisted: could not be normalised");
          return;
        }

        setWorkerUrlError("");
        persistWorkerUrl(values.workerUrl);
        emitCredentialsChanged("saved");
      });
    }
    logDebug("Bound credential change handlers with CTA");

    // Follow the institutional sign-in state. Signing in resolves a client ID
    // that was not there a moment ago, so the form and the API status have to
    // resync — the person did not touch a field, but their credentials changed.
    //
    // The event name is read from EntraAuth so a rename there cannot silently
    // unbind this; the literal is only a fallback for the deferred-load window.
    boundHandlers.signInChange = function (event) {
      const detail = (event && event.detail) || {};
      const signedIn = detail.isSignedIn === true;

      // Act on a genuine FLIP only. This event also fires for "renewal-failed"
      // and other reasons with the state unchanged, and resyncing on one of
      // those would wipe whatever is currently typed into the form.
      if (signedIn === lastKnownSignedIn) {
        logDebug(
          "Ignoring " +
            (detail.reason || "unknown") +
            " sign-in event — signed-in state unchanged",
        );
        return;
      }

      lastKnownSignedIn = signedIn;
      logInfo(
        "Institutional sign-in state changed to " +
          signedIn +
          " — resyncing credential form",
      );

      // Resync the form, then let the existing handler settle the API status
      // and the Test Connection call-to-action. Both own their own messaging,
      // so nothing is announced from here — a second announcement would double.
      loadStoredCredentials();
      credentialChangeHandler();
    };

    window.addEventListener(
      (window.EntraAuth && window.EntraAuth.CHANGE_EVENT) || "entra:changed",
      boundHandlers.signInChange,
    );
    logDebug("Bound institutional sign-in change handler");

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
        // Filter by the unique courseId so name-duplicate courses cannot return
        // the wrong record; fall back to courseName only if the id is absent.
        if (selectedCourse.id) {
          filters.courseId = selectedCourse.id;
        } else {
          filters.courseName = "eq:" + selectedCourse.name;
        }
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

      // Listen for credential changes from Set Up (Phase SU-3)
      if (window.EmbedEventEmitter && typeof window.EmbedEventEmitter.on === 'function') {
        window.EmbedEventEmitter.on('credentials:changed', function (data) {
          if (data && data.service === 'ally') {
            loadStoredCredentials();
          }
        });
      }

      // Set credentials section open state and highlight if credentials missing
      // Use timeout to allow browser autofill to complete
      setTimeout(function () {
        var formValues = ALLY_UI_MANAGER.getFormValues();
        var credentialsMissing =
          !formValues.clientId || !formHasTransport(formValues);

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
     * Re-arbitrates the enabled state and help text of every
     * [data-api-required="true"] button against the current API state and each
     * button's own data-course-selected attribute.
     *
     * Called by the course-search modules after they change a selection, so that
     * a selected module and a not-yet-ready API can never disagree about whether
     * the button should be pressable.
     */
    refreshExecuteButtonStates: function () {
      updateExecuteButtonStates();
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
        setApiState("READY");
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

      // A stored token is no longer required — a client ID plus a usable worker
      // is a complete set of credentials on the worker transport, whether that
      // worker is usable because the user configured their own URL or because
      // an institutional sign-in makes the built-in one reachable.
      const hasWorker =
        typeof ALLY_CONFIG.hasUsableWorkerUrl === "function" &&
        ALLY_CONFIG.hasUsableWorkerUrl();

      // A STORED client ID wins; the built-in default only fills a gap, and
      // getEffectiveClientId() gates that default on the sign-in itself.
      const clientId =
        savedClientId ||
        (typeof ALLY_CONFIG.getEffectiveClientId === "function"
          ? ALLY_CONFIG.getEffectiveClientId()
          : "");

      if (!clientId || (!savedToken && !hasWorker)) {
        logDebug("Page-load warm-up skipped - no stored credentials");
        return;
      }

      logInfo("Found stored credentials, initiating background warm-up...");

      // Set credentials on API client
      if (typeof ALLY_API_CLIENT !== "undefined") {
        if (savedToken) {
          ALLY_API_CLIENT.setCredentials(savedToken, clientId);
        } else {
          ALLY_API_CLIENT.setWorkerCredentials(clientId);
        }
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
                setApiState("READY");
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

  /**
   * Guard so the sign-in warm-up retry runs at most once per page.
   * @type {boolean}
   */
  let signInWarmUpAttempted = false;

  // Retry the warm-up when sign-in ARRIVES, which is later than the scheduling
  // above can see. auth/entra-auth.js is a DEFERRED script and its init()
  // awaits handleRedirectPromise(), so at DOMContentLoaded isSignedIn() is
  // still false even for a colleague who genuinely is signed in: the warm-up
  // checks, finds nothing, and skips. Their first query would then pay the cold
  // start (ALLY_CONFIG.POLLING.TYPICAL_WARMUP_SECONDS is 180), so widening the
  // guard alone does not fix it — the attempt has to happen again afterwards.
  //
  // This sits at module load rather than in the bound handlers deliberately:
  // those bind only when the Ally tool is first opened, by which point the
  // normal init path has already warmed up and the gap has been paid.
  window.addEventListener(
    (window.EntraAuth && window.EntraAuth.CHANGE_EVENT) || "entra:changed",
    function (event) {
      const detail = (event && event.detail) || {};
      if (detail.isSignedIn !== true || signInWarmUpAttempted) return;
      signInWarmUpAttempted = true;
      logInfo("Sign-in arrived after page load — retrying warm-up");
      // attemptPageLoadWarmUp guards its own preconditions.
      attemptPageLoadWarmUp();
    },
  );

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
