/**
 * @fileoverview Ally Report Type Switcher - IIFE Module
 * @module ALLY_REPORT_SWITCHER
 * @requires ALLY_CONFIG
 * @requires ALLY_UI_MANAGER
 * @version 1.0.0
 * @since Phase 7
 *
 * @description
 * Manages switching between report types in the Ally interface.
 * Provides radio button selection, section visibility management,
 * and screen reader announcements.
 *
 * Key Features:
 * - Radio button report type selection
 * - Section visibility management (show/hide)
 * - Report-specific initialisation hooks
 * - Screen reader announcements for type changes
 * - Configurable default report type
 * - WCAG 2.2 AA accessibility support
 */

const ALLY_REPORT_SWITCHER = (function () {
  "use strict";

  // ========================================================================
  // Logging Configuration (IIFE-scoped)
  // ========================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[ALLY_REPORT_SWITCHER]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[ALLY_REPORT_SWITCHER]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[ALLY_REPORT_SWITCHER]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[ALLY_REPORT_SWITCHER]", message, ...args);
  }

  // ========================================================================
  // Private State
  // ========================================================================

  /** @type {string|null} Current active report type */
  var currentReportType = null;

  /** @type {boolean} Initialisation state */
  var initialised = false;

  /** @type {Object} Cached section elements */
  var sections = {
    courseReport: null,
    statementPreview: null,
    reportBuilder: null,
  };

  /** @type {Object} Report Builder related sections (siblings that should hide with it) */
  var reportBuilderRelated = {
    results: null,
    progress: null,
  };

  /** @type {Object} Tracks visibility state of related sections before hiding */
  var relatedSectionsState = {
    resultsWasVisible: false,
    progressWasVisible: false,
  };

  /** @type {Object} Cached radio button elements */
  var radios = {
    courseReport: null,
    statementPreview: null,
    reportBuilder: null,
  };

  /** @type {Function|null} Optional callback for type changes */
  var onChangeCallback = null;

  // ========================================================================
  // Private Functions
  // ========================================================================

  /**
   * Shows specified section, hides others
   * @private
   * @param {string} reportType - Report type to show
   */
  function showSection(reportType) {
    logDebug("Showing section for:", reportType);

    // Before hiding Report Builder, save related sections' visibility state
    if (currentReportType === "report-builder") {
      if (reportBuilderRelated.results) {
        relatedSectionsState.resultsWasVisible =
          !reportBuilderRelated.results.hidden;
      }
      if (reportBuilderRelated.progress) {
        relatedSectionsState.progressWasVisible =
          !reportBuilderRelated.progress.hidden;
      }
      logDebug("Saved related sections state:", relatedSectionsState);
    }

    // Hide all main sections
    Object.values(sections).forEach(function (section) {
      if (section) {
        section.hidden = true;
        section.setAttribute("aria-hidden", "true");
      }
    });

    // Hide Report Builder related sections when switching away
    if (reportType !== "report-builder") {
      if (reportBuilderRelated.results) {
        reportBuilderRelated.results.hidden = true;
        reportBuilderRelated.results.setAttribute("aria-hidden", "true");
      }
      if (reportBuilderRelated.progress) {
        reportBuilderRelated.progress.hidden = true;
        reportBuilderRelated.progress.setAttribute("aria-hidden", "true");
      }
    }

    // Map report type to section
    var sectionMap = {
      "course-report": sections.courseReport,
      "statement-preview": sections.statementPreview,
      "report-builder": sections.reportBuilder,
    };

    // Show selected section
    var targetSection = sectionMap[reportType];
    if (targetSection) {
      targetSection.hidden = false;
      targetSection.removeAttribute("aria-hidden");
      logDebug("Section shown:", reportType);
    } else {
      logWarn("Section not found for report type:", reportType);
    }

    // Restore Report Builder related sections' visibility when switching back
    if (reportType === "report-builder") {
      if (
        reportBuilderRelated.results &&
        relatedSectionsState.resultsWasVisible
      ) {
        reportBuilderRelated.results.hidden = false;
        reportBuilderRelated.results.removeAttribute("aria-hidden");
        logDebug("Restored results section visibility");
      }
      if (
        reportBuilderRelated.progress &&
        relatedSectionsState.progressWasVisible
      ) {
        reportBuilderRelated.progress.hidden = false;
        reportBuilderRelated.progress.removeAttribute("aria-hidden");
        logDebug("Restored progress section visibility");
      }
    }
  }

  /**
   * Announces report type change to screen readers
   * @private
   * @param {string} reportType - New report type
   */
  function announceChange(reportType) {
    var label = "Unknown report type";

    if (typeof ALLY_CONFIG !== "undefined" && ALLY_CONFIG.REPORT_TYPE_LABELS) {
      label = ALLY_CONFIG.REPORT_TYPE_LABELS[reportType] || reportType;
    } else {
      // Fallback labels
      var fallbackLabels = {
        "course-report": "Course Report",
        "statement-preview": "Accessibility Statement Preview",
        "report-builder": "Report Builder",
      };
      label = fallbackLabels[reportType] || reportType;
    }

    // Use UI Manager's announce function if available
    if (
      typeof ALLY_UI_MANAGER !== "undefined" &&
      typeof ALLY_UI_MANAGER.announce === "function"
    ) {
      ALLY_UI_MANAGER.announce("Switched to " + label);
    } else {
      logDebug("Screen reader announcement (UI Manager not available):", label);
    }
  }

  /**
   * Handles radio button change events
   * @private
   * @param {Event} event - Change event
   */
  function handleReportTypeChange(event) {
    var newType = event.target.value;

    if (newType === currentReportType) {
      logDebug("Already on requested report type:", newType);
      return;
    }

    logInfo("Report type changed:", newType);

    currentReportType = newType;
    showSection(newType);
    announceChange(newType);

    // Trigger callback if registered
    if (typeof onChangeCallback === "function") {
      try {
        onChangeCallback(newType);
      } catch (error) {
        logError("Change callback error:", error);
      }
    }
  }

  /**
   * Caches DOM element references
   * @private
   * @returns {boolean} True if all critical elements found
   */
  function cacheElements() {
    // Cache section elements
    sections.courseReport = document.getElementById(
      "ally-course-report-section",
    );
    sections.statementPreview = document.getElementById(
      "ally-statement-preview-section",
    );
    sections.reportBuilder = document.getElementById(
      "ally-report-builder-section",
    );

    // Cache Report Builder related sections (siblings that should hide with it)
    reportBuilderRelated.results = document.getElementById(
      "ally-results-section",
    );
    reportBuilderRelated.progress = document.getElementById(
      "ally-progress-section",
    );

    // Cache radio elements
    radios.courseReport = document.getElementById("ally-report-course");
    radios.statementPreview = document.getElementById("ally-report-statement");
    radios.reportBuilder = document.getElementById("ally-report-builder");

    // Log what was found
    logDebug("Cached elements:", {
      sections: {
        courseReport: !!sections.courseReport,
        statementPreview: !!sections.statementPreview,
        reportBuilder: !!sections.reportBuilder,
      },
      reportBuilderRelated: {
        results: !!reportBuilderRelated.results,
        progress: !!reportBuilderRelated.progress,
      },
      radios: {
        courseReport: !!radios.courseReport,
        statementPreview: !!radios.statementPreview,
        reportBuilder: !!radios.reportBuilder,
      },
    });

    // Check for critical elements
    var hasRadios =
      radios.courseReport && radios.statementPreview && radios.reportBuilder;
    var hasSections =
      sections.courseReport &&
      sections.statementPreview &&
      sections.reportBuilder;

    if (!hasRadios) {
      logError("Missing radio button elements");
    }
    if (!hasSections) {
      logError("Missing section elements");
    }

    return hasRadios && hasSections;
  }
  /**
   * Attaches event listeners to radio buttons
   * @private
   */
  function attachEventListeners() {
    Object.values(radios).forEach(function (radio) {
      if (radio) {
        radio.addEventListener("change", handleReportTypeChange);
      }
    });
    logDebug("Event listeners attached");
  }

  /**
   * Gets default report type from config or fallback
   * @private
   * @returns {string} Default report type
   */
  function getDefaultReportType() {
    if (typeof ALLY_CONFIG !== "undefined" && ALLY_CONFIG.DEFAULT_REPORT_TYPE) {
      return ALLY_CONFIG.DEFAULT_REPORT_TYPE;
    }
    return "course-report"; // Fallback default
  }

  // ========================================================================
  // Public API
  // ========================================================================

  return {
    /**
     * Initialises the report switcher
     * @returns {boolean} True if initialisation successful
     */
    initialise: function () {
      if (initialised) {
        logWarn("Report switcher already initialised");
        return true;
      }

      logInfo("Initialising report switcher...");

      // Cache DOM elements
      var elementsFound = cacheElements();
      if (!elementsFound) {
        logError("Initialisation failed - missing required elements");
        return false;
      }

      // Attach event listeners
      attachEventListeners();

      // Set default report type
      var defaultType = getDefaultReportType();
      this.setReportType(defaultType, true); // true = skip announcement on init

      initialised = true;
      logInfo(
        "Report switcher initialised successfully. Default type:",
        defaultType,
      );
      return true;
    },

    /**
     * Gets current report type
     * @returns {string|null} Current report type value
     */
    getCurrentReport: function () {
      return currentReportType;
    },

    /**
     * Sets report type programmatically
     * @param {string} reportType - Report type to set
     * @param {boolean} [skipAnnounce=false] - Skip screen reader announcement
     * @returns {boolean} True if type was changed
     */
    setReportType: function (reportType, skipAnnounce) {
      var validTypes = ["course-report", "statement-preview", "report-builder"];

      if (validTypes.indexOf(reportType) === -1) {
        logError(
          "Invalid report type:",
          reportType,
          "Valid types:",
          validTypes,
        );
        return false;
      }

      if (reportType === currentReportType) {
        logDebug("Already on requested report type:", reportType);
        return false;
      }

      logInfo("Setting report type to:", reportType);

      // Update radio button
      var radioMap = {
        "course-report": radios.courseReport,
        "statement-preview": radios.statementPreview,
        "report-builder": radios.reportBuilder,
      };

      var targetRadio = radioMap[reportType];
      if (targetRadio) {
        targetRadio.checked = true;
      }

      currentReportType = reportType;
      showSection(reportType);

      if (!skipAnnounce) {
        announceChange(reportType);
      }

      // Trigger callback if registered
      if (typeof onChangeCallback === "function") {
        try {
          onChangeCallback(reportType);
        } catch (error) {
          logError("Change callback error:", error);
        }
      }

      return true;
    },

    /**
     * Registers callback for report type changes
     * @param {Function} callback - Function to call on change (receives reportType)
     */
    onChange: function (callback) {
      if (typeof callback === "function") {
        onChangeCallback = callback;
        logDebug("Change callback registered");
      } else {
        logWarn("onChange requires a function");
      }
    },

    /**
     * Checks if currently showing Course Report
     * @returns {boolean}
     */
    isCourseReport: function () {
      return currentReportType === "course-report";
    },

    /**
     * Checks if currently showing Statement Preview
     * @returns {boolean}
     */
    isStatementPreview: function () {
      return currentReportType === "statement-preview";
    },

    /**
     * Checks if currently showing Report Builder
     * @returns {boolean}
     */
    isReportBuilder: function () {
      return currentReportType === "report-builder";
    },

    /**
     * Gets initialisation state
     * @returns {boolean}
     */
    isInitialised: function () {
      return initialised;
    },

    /**
     * Gets debug information
     * @returns {Object}
     */
    getDebugInfo: function () {
      return {
        currentReportType: currentReportType,
        initialised: initialised,
        defaultType: getDefaultReportType(),
        elements: {
          hasCourseReportSection: !!sections.courseReport,
          hasStatementPreviewSection: !!sections.statementPreview,
          hasReportBuilderSection: !!sections.reportBuilder,
          hasCourseReportRadio: !!radios.courseReport,
          hasStatementPreviewRadio: !!radios.statementPreview,
          hasReportBuilderRadio: !!radios.reportBuilder,
        },
        hasChangeCallback: typeof onChangeCallback === "function",
      };
    },

    /**
     * Resets the switcher (for testing)
     * @returns {void}
     */
    reset: function () {
      currentReportType = null;
      initialised = false;
      onChangeCallback = null;
      logInfo("Report switcher reset");
    },
  };
})();
