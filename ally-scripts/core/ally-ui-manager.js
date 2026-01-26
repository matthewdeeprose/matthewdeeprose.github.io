/**
 * @fileoverview Ally Accessibility Reporting Tool - UI Manager Module
 * @module AllyUIManager
 * @requires ALLY_LOOKUP
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * UI element caching, event management, and DOM manipulation for the Ally
 * Accessibility Reporting Tool. Provides safe element access with null checks,
 * dropdown population from lookup data, and screen reader announcements.
 *
 * Key Features:
 * - Cached UI element references for performance
 * - Safe element access with null checks
 * - Token visibility toggle management
 * - Dropdown population from ALLY_LOOKUP data
 * - Progress bar and section visibility management
 * - Screen reader announcement support
 *
 * Integration:
 * - Requires ally-lookup-data.js to be loaded first
 * - Used by ally-main-controller.js for UI operations
 * - Available globally via ALLY_UI_MANAGER
 *
 * @example
 * // Initialise the UI manager
 * ALLY_UI_MANAGER.initialise();
 *
 * // Get an element safely
 * const input = ALLY_UI_MANAGER.getElement('ally-client-id');
 *
 * // Update progress
 * ALLY_UI_MANAGER.updateProgress(50, 'Processing...');
 */

const ALLY_UI_MANAGER = (function () {
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
      console.error("[AllyUIManager] " + message, ...args);
  }

  /**
   * Logs warning messages if warning logging is enabled
   * @param {string} message - The warning message to log
   * @param {...any} args - Additional arguments to pass to console.warn
   */
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyUIManager] " + message, ...args);
  }

  /**
   * Logs informational messages if info logging is enabled
   * @param {string} message - The info message to log
   * @param {...any} args - Additional arguments to pass to console.log
   */
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyUIManager] " + message, ...args);
  }

  /**
   * Logs debug messages if debug logging is enabled
   * @param {string} message - The debug message to log
   * @param {...any} args - Additional arguments to pass to console.log
   */
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyUIManager] " + message, ...args);
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
   * Cached element references
   * @type {Object.<string, HTMLElement|null>}
   */
  const elements = {};

  /**
   * List of element IDs to cache on initialisation
   * @type {string[]}
   */
  const ELEMENT_IDS = [
    // Configuration section
    "ally-region-select",
    "ally-client-id",
    "ally-api-token",
    "ally-toggle-token",
    "ally-save-credentials",
    "ally-test-connection",

    // Query section
    "ally-endpoint-overall",
    "ally-endpoint-issues",
    "ally-term-select",
    "ally-department-select",
    "ally-active-only",
    "ally-sort-field",
    "ally-sort-order",
    "ally-limit",
    "ally-execute-query",
    "ally-clear-filters",

    // Filter builder (Phase 4)
    "ally-filter-builder",
    "ally-filter-rows",
    "ally-add-filter",

    // Progress section
    "ally-progress-section",
    "ally-progress-fill",
    "ally-progress-message",
    "ally-cancel-query",

    // Results section
    "ally-results-section",
    "ally-results-summary",
    "ally-table-container",
    "ally-chart-container",
    "ally-column-options",
    "ally-export-visible-csv",
    "ally-export-all-csv",
    "ally-export-json",

    // Debug panel
    "ally-debug-panel",
    "ally-debug-endpoint",
    "ally-debug-region",
    "ally-debug-timing",
    "ally-debug-record-count",
    "ally-debug-status",
    "ally-debug-request-data",
    "ally-debug-response-data",

    // API Status indicator
    "ally-api-status",
    "ally-api-status-dot",
    "ally-api-status-text",
    "ally-api-progress-container",
    "ally-api-progress-bar",
    "ally-api-progress-fill",
    "ally-api-status-hint",

    // Screen reader announcements
    "ally-sr-announcements",

    // Report switcher (Phase 7)
    "ally-report-course",
    "ally-report-statement",
    "ally-report-builder",
    "ally-course-report-section",
    "ally-statement-preview-section",
    "ally-report-builder-section",
    "ally-cr-execute",
    "ally-cr-results",

    // Statement Preview (Phase 7B)
    "ally-sp-search-container",
    "ally-sp-search-input",
    "ally-sp-search-results",
    "ally-sp-search-listbox",
    "ally-sp-selected",
    "ally-sp-search-clear",
    "ally-sp-search-status",
    "ally-sp-execute",
    "ally-sp-progress",
    "ally-sp-progress-fill",
    "ally-sp-progress-message",
    "ally-sp-results",
    "ally-sp-course-details",
    "ally-sp-course-metadata",
  ];
  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Caches all UI element references
   * @private
   */
  function cacheElements() {
    let cachedCount = 0;
    let missingCount = 0;

    ELEMENT_IDS.forEach(function (id) {
      const element = document.getElementById(id);
      elements[id] = element;

      if (element) {
        cachedCount++;
        logDebug("Cached element: " + id);
      } else {
        missingCount++;
        logWarn("Element not found: " + id);
      }
    });

    logInfo(
      "Cached " + cachedCount + " elements, " + missingCount + " missing",
    );
  }

  /**
   * Sets up event listeners for token visibility toggle
   * @private
   */
  function setupTokenToggle() {
    const toggleBtn = elements["ally-toggle-token"];
    const tokenInput = elements["ally-api-token"];

    if (!toggleBtn || !tokenInput) {
      logWarn("Token toggle elements not found");
      return;
    }

    toggleBtn.addEventListener("click", function () {
      const isPassword = tokenInput.type === "password";
      tokenInput.type = isPassword ? "text" : "password";

      // Update button state
      toggleBtn.setAttribute("aria-pressed", isPassword ? "true" : "false");
      toggleBtn.setAttribute(
        "aria-label",
        isPassword ? "Hide token" : "Show token",
      );

      logDebug(
        "Token visibility toggled: " + (isPassword ? "visible" : "hidden"),
      );
    });

    logDebug("Token toggle initialised");
  }

  /**
   * Populates a select element with options
   * @private
   * @param {HTMLSelectElement} select - The select element
   * @param {Array<{value: string, label: string}>} options - Options to add
   * @param {string} defaultLabel - Label for the default empty option
   */
  function populateSelect(select, options, defaultLabel) {
    if (!select) {
      logWarn("Cannot populate null select element");
      return;
    }

    // Clear existing options (keep first "All" option)
    while (select.options.length > 1) {
      select.remove(1);
    }

    // Update default option label if provided
    if (defaultLabel && select.options.length > 0) {
      select.options[0].textContent = defaultLabel;
    }

    // Add new options
    options.forEach(function (opt) {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    });

    logDebug("Populated select with " + options.length + " options");
  }

  // ========================================================================
  // Public API
  // ========================================================================

  const publicAPI = {
    /**
     * Initialises the UI manager
     * Caches element references and sets up event listeners
     * @returns {boolean} True if initialisation succeeded
     */
    initialise: function () {
      if (initialised) {
        logWarn("Already initialised");
        return true;
      }

      logInfo("Initialising UI Manager...");

      // Cache all element references
      cacheElements();

      // Set up token visibility toggle
      setupTokenToggle();

      // Populate dropdowns if ALLY_LOOKUP is available
      if (typeof ALLY_LOOKUP !== "undefined") {
        this.populateTermDropdown();
        this.populateDepartmentDropdown();
      } else {
        logWarn("ALLY_LOOKUP not available - dropdowns not populated");
      }

      initialised = true;
      logInfo("UI Manager initialised successfully");

      return true;
    },

    /**
     * Checks if the UI manager has been initialised
     * @returns {boolean} True if initialised
     */
    isInitialised: function () {
      return initialised;
    },

    /**
     * Gets a cached element by ID
     * @param {string} id - The element ID (without 'ally-' prefix if desired)
     * @returns {HTMLElement|null} The element or null if not found
     */
    getElement: function (id) {
      // Try exact ID first
      if (elements[id] !== undefined) {
        return elements[id];
      }

      // Try with 'ally-' prefix
      const prefixedId = "ally-" + id;
      if (elements[prefixedId] !== undefined) {
        return elements[prefixedId];
      }

      // Fall back to direct DOM query
      logDebug("Element not cached, querying DOM: " + id);
      return document.getElementById(id);
    },

    /**
     * Gets all cached elements
     * @returns {Object.<string, HTMLElement|null>} All cached elements
     */
    getElements: function () {
      return elements;
    },

    /**
     * Populates the term dropdown from ALLY_LOOKUP data
     */
    populateTermDropdown: function () {
      const select = elements["ally-term-select"];

      if (!select) {
        logWarn("Term select element not found");
        return;
      }

      if (typeof ALLY_LOOKUP === "undefined") {
        logWarn("ALLY_LOOKUP not available");
        return;
      }

      // Clear existing options
      select.innerHTML = "";

      // Add default "All terms" option
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "All terms";
      select.appendChild(defaultOption);

      // Get all terms sorted (academic first, then system)
      const allTerms = ALLY_LOOKUP.getAllTermsSorted();

      // Separate into academic and system terms
      const academicTerms = allTerms.filter(function (term) {
        return term.type === "academic";
      });
      const systemTerms = allTerms.filter(function (term) {
        return term.type === "system";
      });

      // Create Academic Years optgroup
      if (academicTerms.length > 0) {
        const academicGroup = document.createElement("optgroup");
        academicGroup.label = "Academic Years";

        academicTerms.forEach(function (term) {
          const option = document.createElement("option");
          option.value = term.id;
          option.textContent = term.name;
          academicGroup.appendChild(option);
        });

        select.appendChild(academicGroup);
      }

      // Create System/Other optgroup
      if (systemTerms.length > 0) {
        const systemGroup = document.createElement("optgroup");
        systemGroup.label = "System / Other";

        systemTerms.forEach(function (term) {
          const option = document.createElement("option");
          option.value = term.id;
          option.textContent = term.name;
          systemGroup.appendChild(option);
        });

        select.appendChild(systemGroup);
      }

      logInfo(
        "Populated term dropdown with " +
          academicTerms.length +
          " academic terms and " +
          systemTerms.length +
          " system terms",
      );
    },

    /**
     * Populates the department dropdown from ALLY_LOOKUP data
     */
    populateDepartmentDropdown: function () {
      const select = elements["ally-department-select"];

      if (!select) {
        logWarn("Department select element not found");
        return;
      }

      if (typeof ALLY_LOOKUP === "undefined") {
        logWarn("ALLY_LOOKUP not available");
        return;
      }

      // Get sorted departments from lookup
      const departments = ALLY_LOOKUP.getDepartmentsSorted();
      const options = departments.map(function (dept) {
        return {
          value: dept.id,
          label: dept.name,
        };
      });

      populateSelect(select, options, "All departments");
      logInfo(
        "Populated department dropdown with " + options.length + " departments",
      );
    },

    /**
     * Shows or hides the progress section
     * @param {boolean} show - Whether to show the section
     */
    showProgress: function (show) {
      const section = elements["ally-progress-section"];

      if (!section) {
        logWarn("Progress section not found");
        return;
      }

      if (show) {
        section.hidden = false;
        section.setAttribute("aria-hidden", "false");
      } else {
        section.hidden = true;
        section.setAttribute("aria-hidden", "true");
      }

      logDebug("Progress section " + (show ? "shown" : "hidden"));
    },

    /**
     * Shows or hides the results section
     * @param {boolean} show - Whether to show the section
     */
    showResults: function (show) {
      const section = elements["ally-results-section"];

      if (!section) {
        logWarn("Results section not found");
        return;
      }

      if (show) {
        section.hidden = false;
        section.setAttribute("aria-hidden", "false");
      } else {
        section.hidden = true;
        section.setAttribute("aria-hidden", "true");
      }

      logDebug("Results section " + (show ? "shown" : "hidden"));
    },

    /**
     * Updates the progress bar and message
     * @param {number} percent - Progress percentage (0-100)
     * @param {string} [message] - Optional progress message
     */
    updateProgress: function (percent, message) {
      const fill = elements["ally-progress-fill"];
      const messageEl = elements["ally-progress-message"];
      const progressBar = fill ? fill.parentElement : null;

      // Update fill width
      if (fill) {
        fill.style.width = Math.min(100, Math.max(0, percent)) + "%";
      }

      // Update ARIA value
      if (progressBar) {
        progressBar.setAttribute("aria-valuenow", Math.round(percent));
      }

      // Update message
      if (messageEl && message) {
        messageEl.textContent = message;
      }

      logDebug("Progress updated: " + percent + "% - " + (message || ""));
    },

    /**
     * Makes a screen reader announcement
     * @param {string} message - The message to announce
     */
    announce: function (message) {
      const announcer = elements["ally-sr-announcements"];

      if (!announcer) {
        logWarn("Screen reader announcer not found");
        return;
      }

      // Clear and set message (triggers announcement)
      announcer.textContent = "";

      // Small delay to ensure the clear is processed
      setTimeout(function () {
        announcer.textContent = message;
        logDebug("Announced: " + message);
      }, 50);
    },

    /**
     * Resets all form fields to their default values
     */
    resetForm: function () {
      // Reset dropdowns
      const regionSelect = elements["ally-region-select"];
      const termSelect = elements["ally-term-select"];
      const deptSelect = elements["ally-department-select"];
      const sortField = elements["ally-sort-field"];
      const sortOrder = elements["ally-sort-order"];
      const limitSelect = elements["ally-limit"];

      if (regionSelect) regionSelect.value = "EU";
      if (termSelect) termSelect.value = "";
      if (deptSelect) deptSelect.value = "";
      if (sortField) sortField.value = "";
      if (sortOrder) sortOrder.value = "asc";
      if (limitSelect) limitSelect.value = "1000";

      // Reset checkboxes
      const activeOnly = elements["ally-active-only"];
      if (activeOnly) activeOnly.checked = true;

      // Reset radio buttons
      const overallRadio = elements["ally-endpoint-overall"];
      if (overallRadio) overallRadio.checked = true;

      // Hide progress and results
      this.showProgress(false);
      this.showResults(false);

      logInfo("Form reset to defaults");
    },

    /**
     * Enables or disables the query execution button
     * @param {boolean} enabled - Whether to enable the button
     */
    setQueryButtonEnabled: function (enabled) {
      const btn = elements["ally-execute-query"];
      if (btn) {
        btn.disabled = !enabled;
        logDebug("Query button " + (enabled ? "enabled" : "disabled"));
      }
    },

    /**
     * Enables or disables the cancel button
     * @param {boolean} enabled - Whether to enable the button
     */
    setCancelButtonEnabled: function (enabled) {
      const btn = elements["ally-cancel-query"];
      if (btn) {
        btn.disabled = !enabled;
        logDebug("Cancel button " + (enabled ? "enabled" : "disabled"));
      }
    },

    /**
     * Gets the current form values
     * @returns {Object} Object containing all form values
     */
    getFormValues: function () {
      return {
        region: elements["ally-region-select"]?.value || "EU",
        clientId: elements["ally-client-id"]?.value?.trim() || "",
        token: elements["ally-api-token"]?.value?.trim() || "",
        saveCredentials: elements["ally-save-credentials"]?.checked || false,
        endpoint:
          document.querySelector('input[name="ally-endpoint"]:checked')
            ?.value || "overall",
        term: elements["ally-term-select"]?.value || "",
        department: elements["ally-department-select"]?.value || "",
        activeOnly: elements["ally-active-only"]?.checked || false,
        sortField: elements["ally-sort-field"]?.value || "",
        sortOrder: elements["ally-sort-order"]?.value || "asc",
        limit: parseInt(elements["ally-limit"]?.value, 10) || 1000,
      };
    },

    /**
     * Sets form values (e.g., from stored credentials)
     * @param {Object} values - Object containing form values to set
     */
    setFormValues: function (values) {
      if (!values) return;

      if (values.region && elements["ally-region-select"]) {
        elements["ally-region-select"].value = values.region;
      }

      if (values.clientId && elements["ally-client-id"]) {
        elements["ally-client-id"].value = values.clientId;
      }

      if (values.token && elements["ally-api-token"]) {
        elements["ally-api-token"].value = values.token;
      }

      if (
        typeof values.saveCredentials === "boolean" &&
        elements["ally-save-credentials"]
      ) {
        elements["ally-save-credentials"].checked = values.saveCredentials;
      }

      logDebug("Form values set");
    },
  };

  // Return the public API
  return publicAPI;
})();

// Tests moved to ally-tests.js
