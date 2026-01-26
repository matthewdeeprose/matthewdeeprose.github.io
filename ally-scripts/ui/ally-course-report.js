/**
 * @fileoverview Ally Course Report - Main Controller Module
 * @module AllyCourseReport
 * @requires ALLY_CONFIG
 * @requires ALLY_API_CLIENT
 * @requires ALLY_UI_MANAGER
 * @requires ALLY_COURSE_REPORT_SEARCH
 * @requires ALLY_COURSE_REPORT_CONFIG
 * @version 1.0.0
 * @since Phase 7A.3
 *
 * @description
 * Main controller for the Course Report feature. Handles course selection,
 * API requests, data processing, and report rendering. Provides comprehensive
 * accessibility metrics, content inventory, and issue breakdown for a single course.
 *
 * Key Features:
 * - Integration with Course Report Search module
 * - Dual API requests (Overall + Issues endpoints)
 * - Accessible score meters with ARIA attributes
 * - Content inventory by file type
 * - Issues grouped by category with severity indicators
 * - Export functionality (HTML, CSV, Print)
 *
 * Integration:
 * - Uses ALLY_COURSE_REPORT_SEARCH for course selection
 * - Uses ALLY_API_CLIENT for API requests
 * - Uses ALLY_COURSE_REPORT_CONFIG for data mappings
 * - Uses ALLY_UI_MANAGER for announcements
 *
 * @example
 * // Module auto-initialises, but can be re-initialised if needed
 * ALLY_COURSE_REPORT.initialise();
 *
 * // Generate report programmatically
 * ALLY_COURSE_REPORT.generateReport();
 *
 * // Get current state
 * ALLY_COURSE_REPORT.getDebugInfo();
 */

const ALLY_COURSE_REPORT = (function () {
  "use strict";

  // ========================================================================
  // Logging Configuration (IIFE-scoped)
  // ========================================================================

  var LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  var DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  var ENABLE_ALL_LOGGING = false;
  var DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.error.apply(
        console,
        ["[AllyCourseReport] " + message].concat(args),
      );
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.warn.apply(
        console,
        ["[AllyCourseReport] " + message].concat(args),
      );
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.log.apply(
        console,
        ["[AllyCourseReport] " + message].concat(args),
      );
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.log.apply(
        console,
        ["[AllyCourseReport] " + message].concat(args),
      );
    }
  }

  // ========================================================================
  // Chart Management
  // ========================================================================

  /**
   * Track created chart instances for cleanup
   */
  var chartInstances = [];
  var chartIndex = 0;

  /**
   * Checks if chart infrastructure is available
   * @returns {boolean}
   */
  function isChartAvailable() {
    return typeof Chart !== "undefined" && typeof ChartControls !== "undefined";
  }

  /**
   * Creates an accessible chart with full controls integration
   * @param {Object} config - Chart.js configuration (without colours - theme handles those)
   * @param {string} chartId - Unique chart ID
   * @param {string} description - Accessible description for the chart
   * @param {HTMLElement} appendTo - Element to append chart to
   * @returns {Object|null} Chart info or null on failure
   */
  function createAccessibleChart(config, chartId, description, appendTo) {
    if (!isChartAvailable()) {
      logWarn("Chart infrastructure not available");
      return null;
    }

    try {
      // Create container structure matching existing pattern
      var wrapper = createElement("div", {
        className: "ally-cr-chart-wrapper",
      });

      // Description for accessibility
      var descId = chartId + "-desc";
      var descElement = createElement(
        "p",
        {
          className: "ally-chart-description visually-hidden",
          id: descId,
        },
        description,
      );
      wrapper.appendChild(descElement);

      // Chart container with required classes and attributes
      var container = createElement("div", {
        className: "chart-container ally-cr-chart-container",
        id: chartId,
        role: "figure",
        ariaDescribedby: descId,
      });

      // Canvas element
      var canvas = document.createElement("canvas");
      canvas.id = chartId + "-canvas";
      canvas.width = 600;
      canvas.height = 320;
      container.appendChild(canvas);

      wrapper.appendChild(container);
      appendTo.appendChild(wrapper);

      // Apply responsive defaults
      config.options = config.options || {};
      config.options.responsive = true;
      config.options.maintainAspectRatio = false;

      // Store chart code for controls (needed by ChartControls theme system)
      container.setAttribute(
        "data-chart-code",
        encodeURIComponent(JSON.stringify(config)),
      );

      // Create chart instance
      var chartInstance = new Chart(canvas, config);
      chartInstances.push(chartInstance);

      // Integrate with existing control systems
      integrateChartControlsCR(container, canvas, chartInstance, chartId);

      logDebug("Created accessible chart: " + chartId);

      return {
        instance: chartInstance,
        container: container,
        chartId: chartId,
      };
    } catch (error) {
      logError("Failed to create chart: " + error.message);
      return null;
    }
  }

  /**
   * Integrates chart control systems (theme, export, accessibility)
   * @param {HTMLElement} container - Chart container
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {Chart} chartInstance - Chart.js instance
   * @param {string} chartId - Unique chart ID
   */
  function integrateChartControlsCR(container, canvas, chartInstance, chartId) {
    // Mark container to prevent auto-detection conflicts
    container.setAttribute("data-ally-managed", "true");

    // Add ChartViewControls (expand width, fullscreen)
    if (
      typeof ChartViewControls !== "undefined" &&
      ChartViewControls.addViewControlsToContainer
    ) {
      try {
        ChartViewControls.addViewControlsToContainer(container, chartIndex);
        chartIndex++;
        logDebug("View controls added for chart: " + chartId);
      } catch (e) {
        logWarn("Failed to add view controls: " + e.message);
      }
    }

    // Add ChartControls (theme selector, export buttons)
    if (
      typeof ChartControls !== "undefined" &&
      ChartControls.addControlsToContainer
    ) {
      try {
        ChartControls.addControlsToContainer(container, chartId);
        container.setAttribute("data-has-chart-controls", "true");
        logDebug("Chart controls added for chart: " + chartId);
      } catch (e) {
        logWarn("Failed to add chart controls: " + e.message);
      }
    }

    // Add ChartAccessibility features (data table, descriptions)
    if (
      typeof ChartAccessibility !== "undefined" &&
      ChartAccessibility.initAccessibilityFeatures
    ) {
      try {
        setTimeout(function () {
          ChartAccessibility.initAccessibilityFeatures(container, chartId);
          container.setAttribute("data-accessibility-initialized", "true");
          logDebug("Accessibility features added for chart: " + chartId);
        }, 100);
      } catch (e) {
        logWarn("Failed to add accessibility features: " + e.message);
      }
    }
  }

  /**
   * Creates a doughnut chart configuration for file type distribution
   * @param {Array} types - Array of file type objects with label and count
   * @param {string} title - Chart title
   * @returns {Object} Chart.js configuration
   */
  function createFileTypeChartConfig(types, title) {
    var total = types.reduce(function (sum, t) {
      return sum + t.count;
    }, 0);

    return {
      type: "doughnut",
      data: {
        labels: types.map(function (t) {
          return t.label;
        }),
        datasets: [
          {
            data: types.map(function (t) {
              return t.count;
            }),
            // No colours specified - theme system handles this
            borderWidth: 2,
            borderColor: "#ffffff",
          },
        ],
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: title,
            font: { size: 14, weight: "600" },
          },
          subtitle: {
            display: true,
            text: total.toLocaleString() + " items",
            font: { size: 12 },
            padding: { bottom: 10 },
          },
          legend: {
            display: true,
            position: "right",
            labels: {
              boxWidth: 12,
              padding: 8,
              font: { size: 11 },
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                var value = context.raw;
                var percentage = ((value / total) * 100).toFixed(1);
                return context.label + ": " + value + " (" + percentage + "%)";
              },
            },
          },
        },
      },
    };
  }

  /**
   * Creates a doughnut chart configuration for severity breakdown
   * @param {Object} severityTotals - Severity totals object with severe, major, minor, total
   * @returns {Object} Chart.js configuration
   */
  function createSeverityBreakdownChartConfig(severityTotals) {
    return {
      type: "doughnut",
      data: {
        labels: ["Severe", "Major", "Minor"],
        datasets: [
          {
            data: [
              severityTotals.severe,
              severityTotals.major,
              severityTotals.minor,
            ],
            // Explicit severity colours to match the UI
            backgroundColor: ["#c62828", "#e65100", "#f9a825"],
            borderWidth: 2,
            borderColor: "#ffffff",
          },
        ],
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: "Accessibility Issues by Severity",
            font: { size: 14, weight: "600" },
          },
          subtitle: {
            display: true,
            text: severityTotals.total.toLocaleString() + " issues total",
            font: { size: 12 },
            padding: { bottom: 10 },
          },
          legend: {
            display: true,
            position: "right",
            labels: {
              boxWidth: 12,
              padding: 8,
              font: { size: 11 },
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                var value = context.raw;
                var percentage = ((value / severityTotals.total) * 100).toFixed(
                  1,
                );
                return context.label + ": " + value + " (" + percentage + "%)";
              },
            },
          },
        },
      },
    };
  }

  /**
   * Creates a horizontal bar chart configuration for issue categories
   * @param {Object} categoryCounts - Category counts object
   * @returns {Object} Chart.js configuration
   */
  function createIssueCategoryChartConfig(categoryCounts) {
    var categories = Object.keys(categoryCounts)
      .filter(function (cat) {
        return categoryCounts[cat].total > 0;
      })
      .sort(function (a, b) {
        return categoryCounts[b].total - categoryCounts[a].total;
      });

    var total = categories.reduce(function (sum, cat) {
      return sum + categoryCounts[cat].total;
    }, 0);

    return {
      type: "bar",
      data: {
        labels: categories,
        datasets: [
          {
            label: "Issues",
            data: categories.map(function (cat) {
              return categoryCounts[cat].total;
            }),
            // No colours specified - theme system handles this
            borderWidth: 1,
          },
        ],
      },
      options: {
        indexAxis: "y",
        plugins: {
          title: {
            display: true,
            text: "Accessibility Issues by Category",
            font: { size: 14, weight: "600" },
          },
          subtitle: {
            display: true,
            text:
              total.toLocaleString() +
              " issues across " +
              categories.length +
              " categories",
            font: { size: 12 },
            padding: { bottom: 10 },
          },
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                var value = context.raw;
                var percentage = ((value / total) * 100).toFixed(1);
                return value + " issues (" + percentage + "%)";
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              precision: 0,
            },
            title: {
              display: true,
              text: "Number of Issues",
            },
            grid: {
              display: false,
            },
          },
          y: {
            ticks: {
              font: { size: 11 },
            },
            grid: {
              display: false,
            },
          },
        },
      },
    };
  }

  /**
   * Destroys all chart instances and resets index
   */
  function destroyCharts() {
    chartInstances.forEach(function (chart) {
      try {
        if (chart && typeof chart.destroy === "function") {
          chart.destroy();
        }
      } catch (e) {
        logWarn("Error destroying chart: " + e.message);
      }
    });
    chartInstances = [];
    chartIndex = 0;
    logDebug("Destroyed all course report charts");
  }

  // ========================================================================
  // Dependency Check
  // ========================================================================

  function checkDependencies() {
    var missing = [];
    if (typeof ALLY_CONFIG === "undefined") missing.push("ALLY_CONFIG");
    if (typeof ALLY_API_CLIENT === "undefined") missing.push("ALLY_API_CLIENT");
    if (typeof ALLY_UI_MANAGER === "undefined") missing.push("ALLY_UI_MANAGER");
    if (typeof ALLY_COURSE_REPORT_SEARCH === "undefined")
      missing.push("ALLY_COURSE_REPORT_SEARCH");
    if (typeof ALLY_COURSE_REPORT_CONFIG === "undefined")
      missing.push("ALLY_COURSE_REPORT_CONFIG");

    if (missing.length > 0) {
      logError("Missing dependencies:", missing.join(", "));
      return false;
    }
    return true;
  }

  // ========================================================================
  // Private State
  // ========================================================================

  var initialised = false;
  var selectedCourse = null;
  var isGenerating = false;
  var lastReportData = null;

  // Cache integration state
  var backgroundRefreshInProgress = false;
  var currentCacheKey = null;

  // Cached DOM elements
  var elements = {
    executeButton: null,
    progressSection: null,
    progressFill: null,
    progressMessage: null,
    resultsContainer: null,
  };

  // ========================================================================
  // DOM Utilities
  // ========================================================================

  /**
   * Caches DOM elements for performance
   * @returns {boolean} True if all elements found
   */
  function cacheElements() {
    elements.executeButton = document.getElementById("ally-cr-execute");
    elements.progressSection = document.getElementById("ally-cr-progress");
    elements.progressFill = document.getElementById("ally-cr-progress-fill");
    elements.progressMessage = document.getElementById(
      "ally-cr-progress-message",
    );
    elements.resultsContainer = document.getElementById("ally-cr-results");

    var allFound =
      elements.executeButton &&
      elements.progressSection &&
      elements.progressFill &&
      elements.progressMessage &&
      elements.resultsContainer;

    if (!allFound) {
      logWarn("Some Course Report elements not found");
    }

    return allFound;
  }

  /**
   * Creates an HTML element with attributes
   * @param {string} tag - Element tag name
   * @param {Object} attrs - Attributes to set
   * @param {string|Array} children - Text content or child elements
   * @returns {HTMLElement}
   */
  function createElement(tag, attrs, children) {
    var el = document.createElement(tag);

    if (attrs) {
      for (var key in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, key)) {
          if (key === "className") {
            el.className = attrs[key];
          } else if (key === "dataset") {
            for (var dataKey in attrs[key]) {
              if (Object.prototype.hasOwnProperty.call(attrs[key], dataKey)) {
                el.dataset[dataKey] = attrs[key][dataKey];
              }
            }
          } else if (key.startsWith("aria")) {
            el.setAttribute(
              key.replace(/([A-Z])/g, "-$1").toLowerCase(),
              attrs[key],
            );
          } else {
            el.setAttribute(key, attrs[key]);
          }
        }
      }
    }

    if (children) {
      if (typeof children === "string") {
        el.textContent = children;
      } else if (Array.isArray(children)) {
        children.forEach(function (child) {
          if (child) {
            if (typeof child === "string") {
              el.appendChild(document.createTextNode(child));
            } else {
              el.appendChild(child);
            }
          }
        });
      }
    }

    return el;
  }

  /**
   * Escapes HTML entities for safe display
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    if (!text) return "";
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ========================================================================
  // Progress Management
  // ========================================================================

  /**
   * Shows progress indicator
   * @param {string} message - Progress message
   * @param {number} percent - Progress percentage (0-100)
   */
  function showProgress(message, percent) {
    if (!elements.progressSection) return;

    elements.progressSection.hidden = false;
    elements.progressMessage.textContent = message;
    elements.progressFill.style.width = percent + "%";

    var progressBar = elements.progressFill.parentElement;
    if (progressBar) {
      progressBar.setAttribute("aria-valuenow", percent);
    }
  }

  /**
   * Hides progress indicator
   */
  function hideProgress() {
    if (!elements.progressSection) return;
    elements.progressSection.hidden = true;
  }

  // ========================================================================
  // Course Selection Handler
  // ========================================================================

  /**
   * Handles course selection changes from search module
   * @param {Object|null} course - Selected course or null if cleared
   */
  function handleCourseSelectionChange(course) {
    var previousCourse = selectedCourse;
    selectedCourse = course;
    logDebug("Course selection changed:", course ? course.name : "none");

    // Enable/disable execute button
    if (elements.executeButton) {
      elements.executeButton.disabled = !course;
    }

    // Only clear results when selecting a DIFFERENT course (not when clearing)
    // This preserves the report when user clicks Clear button
    if (course && previousCourse && course.id !== previousCourse.id) {
      if (elements.resultsContainer) {
        elements.resultsContainer.hidden = true;
        elements.resultsContainer.innerHTML = "";
      }
    }

    // Announce to screen readers
    if (course && typeof ALLY_UI_MANAGER !== "undefined") {
      ALLY_UI_MANAGER.announce(
        "Course selected: " +
          course.name +
          ". Press Generate Report button to view accessibility report.",
      );
    }
  }

  // ========================================================================
  // API Request Handling
  // ========================================================================

  /**
   * Fetches course data from both Overall and Issues endpoints
   * @param {Object} course - Course object with name property
   * @returns {Promise<Object>} Combined data from both endpoints
   */
  async function fetchCourseData(course) {
    if (!ALLY_API_CLIENT.hasCredentials()) {
      throw new Error(
        "API credentials not configured. Please enter your API token and Client ID.",
      );
    }

    logInfo("Fetching data for course:", course.name);

    // Debug tracking - comprehensive data for developer panel
    var debugData = {
      startTime: Date.now(),
      overallTiming: null,
      issuesTiming: null,
      requests: {},
      responses: {},
      status: "pending",
      region: null, // Will be set after getting credentials
    };

    // Track progress across both requests
    var totalAttempts = 0;
    var maxTotalAttempts = ALLY_CONFIG.POLLING.MAX_ATTEMPTS * 2;

    function handleProgress(progressData, endpoint) {
      totalAttempts++;
      var percent = Math.min(
        90,
        Math.round((totalAttempts / maxTotalAttempts) * 90),
      );
      var message = "Fetching " + endpoint + " data... " + progressData.message;
      showProgress(message, percent);
    }

    // Fetch Overall data first
    showProgress("Fetching course overview...", 10);

    var overallStartTime = Date.now();

    // Get credentials from API client
    var credentials = ALLY_API_CLIENT.getCredentials();
    var clientId = credentials.clientId || "unknown";
    var region = credentials.region || "unknown";

    // Update debug data with region
    debugData.region = region;

    // Build base URL
    var baseUrl =
      typeof ALLY_CONFIG !== "undefined"
        ? ALLY_CONFIG.getApiUrl("OVERALL", clientId, region).replace(
            /\/reports\/overall$/,
            "",
          )
        : "https://prod.ally.ac/api/v2/clients/" + clientId;

    var overallFilters = {
      allyEnabled: "true",
      courseName: "eq:" + course.name,
    };

    debugData.requests.overall = {
      endpoint: "OVERALL",
      region: region,
      url:
        baseUrl +
        "/reports/overall?limit=1&offset=0&allyEnabled=true&courseName=" +
        encodeURIComponent("eq:" + course.name),
      options: {
        limit: 1,
        offset: 0,
        filters: overallFilters,
      },
      headers: {
        Authorization: "Bearer [REDACTED]",
        Accept: "application/json",
      },
      timestamp: new Date().toISOString(),
    };

    var overallResult;
    try {
      overallResult = await ALLY_API_CLIENT.fetchOverall({
        limit: 1,
        filters: {
          allyEnabled: "true",
          courseName: "eq:" + course.name,
        },
        onProgress: function (p) {
          handleProgress(p, "overview");
        },
      });
      debugData.overallTiming = Date.now() - overallStartTime;
      debugData.responses.overall = {
        status: 200,
        statusText: "OK",
        metadata: overallResult.metadata || null,
        recordCount: overallResult.data ? overallResult.data.length : 0,
        dataSample:
          overallResult.data && overallResult.data.length > 0
            ? [overallResult.data[0]]
            : [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      debugData.overallTiming = Date.now() - overallStartTime;
      debugData.responses.overall = { error: error.message };
      debugData.status = "error";
      updateDebugPanel(debugData, course);
      logError("Overall fetch failed:", error);
      throw new Error("Failed to fetch course overview: " + error.message);
    }

    // Check if course found
    if (!overallResult.data || overallResult.data.length === 0) {
      throw new Error(
        "Course not found in Ally data. The course may not have Ally enabled or may not have been scanned yet.",
      );
    }

    var overallData = overallResult.data[0];
    logDebug("Overall data received:", overallData.courseName);

    // Fetch Issues data
    showProgress("Fetching issue details...", 50);

    var issuesStartTime = Date.now();
    var issuesFilters = {
      allyEnabled: "true",
      courseName: "eq:" + course.name,
    };

    debugData.requests.issues = {
      endpoint: "ISSUES",
      region: region,
      url:
        baseUrl +
        "/reports/issues?limit=1&offset=0&allyEnabled=true&courseName=" +
        encodeURIComponent("eq:" + course.name),
      options: {
        limit: 1,
        offset: 0,
        filters: issuesFilters,
      },
      headers: {
        Authorization: "Bearer [REDACTED]",
        Accept: "application/json",
      },
      timestamp: new Date().toISOString(),
    };

    var issuesResult;
    try {
      issuesResult = await ALLY_API_CLIENT.fetchIssues({
        limit: 1,
        filters: {
          allyEnabled: "true",
          courseName: "eq:" + course.name,
        },
        onProgress: function (p) {
          handleProgress(p, "issues");
        },
      });
      debugData.issuesTiming = Date.now() - issuesStartTime;
      debugData.responses.issues = {
        status: 200,
        statusText: "OK",
        metadata: issuesResult.metadata || null,
        recordCount: issuesResult.data ? issuesResult.data.length : 0,
        dataSample:
          issuesResult.data && issuesResult.data.length > 0
            ? [issuesResult.data[0]]
            : [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      debugData.issuesTiming = Date.now() - issuesStartTime;
      debugData.responses.issues = { error: error.message };
      debugData.status = "error";
      updateDebugPanel(debugData, course);
      logError("Issues fetch failed:", error);
      throw new Error("Failed to fetch issue details: " + error.message);
    }

    var issuesData =
      issuesResult.data && issuesResult.data.length > 0
        ? issuesResult.data[0]
        : {};
    logDebug("Issues data received");

    showProgress("Processing report data...", 95);

    // Update debug panel with successful data
    debugData.status = "success";
    debugData.totalTiming = Date.now() - debugData.startTime;
    updateDebugPanel(debugData, course);

    return {
      overall: overallData,
      issues: issuesData,
      timestamp: new Date().toISOString(),
    };
  }

  // ========================================================================
  // Debug Panel Population
  // ========================================================================

  /**
   * Updates the debug panel with Course Report transaction data
   * @param {Object} debugData - Debug data object with timing and request/response info
   * @param {Object} course - Course object
   */
  function updateDebugPanel(debugData, course) {
    try {
      // Endpoint - show both
      var endpointEl = document.getElementById("ally-debug-endpoint");
      if (endpointEl) {
        endpointEl.textContent = "Overall + Issues (Course Report)";
      }

      // Region
      var regionEl = document.getElementById("ally-debug-region");
      if (regionEl) {
        regionEl.textContent = debugData.region || "Not configured";
      }

      // Timing - show breakdown
      var timingEl = document.getElementById("ally-debug-timing");
      if (timingEl) {
        var timingParts = [];
        if (debugData.overallTiming !== null) {
          timingParts.push("Overall: " + debugData.overallTiming + "ms");
        }
        if (debugData.issuesTiming !== null) {
          timingParts.push("Issues: " + debugData.issuesTiming + "ms");
        }
        if (debugData.totalTiming) {
          timingParts.push("Total: " + debugData.totalTiming + "ms");
        }
        timingEl.textContent = timingParts.join(" | ") || "—";
      }

      // Record count
      var recordCountEl = document.getElementById("ally-debug-record-count");
      if (recordCountEl) {
        var overallCount = debugData.responses.overall?.recordCount || 0;
        var issuesCount = debugData.responses.issues?.recordCount || 0;
        recordCountEl.textContent =
          overallCount + " overall record, " + issuesCount + " issues record";
      }

      // Status
      var statusEl = document.getElementById("ally-debug-status");
      if (statusEl) {
        // Remove any existing status classes
        statusEl.classList.remove(
          "ally-debug-status-success",
          "ally-debug-status-error",
          "ally-debug-status-pending",
        );

        if (debugData.status === "success") {
          statusEl.textContent = "✓ Success";
          statusEl.classList.add("ally-debug-status-success");
        } else if (debugData.status === "error") {
          statusEl.textContent = "✗ Error";
          statusEl.classList.add("ally-debug-status-error");
        } else {
          statusEl.textContent = "Pending...";
          statusEl.classList.add("ally-debug-status-pending");
        }
      }

      // Request data - full detail for both requests
      var requestDataEl = document.getElementById("ally-debug-request-data");
      if (requestDataEl) {
        var requestObj = {
          courseReport: true,
          course: course.name,
          requests: {
            overall: debugData.requests.overall || null,
            issues: debugData.requests.issues || null,
          },
        };
        requestDataEl.textContent = JSON.stringify(requestObj, null, 2);

        // Apply syntax highlighting if Prism is available
        if (typeof Prism !== "undefined") {
          Prism.highlightElement(requestDataEl);
        }
      }

      // Response data - full detail for both responses
      var responseDataEl = document.getElementById("ally-debug-response-data");
      if (responseDataEl) {
        var responseObj = {
          courseReport: true,
          timing: {
            overall: debugData.overallTiming
              ? debugData.overallTiming + "ms"
              : null,
            issues: debugData.issuesTiming
              ? debugData.issuesTiming + "ms"
              : null,
            total: debugData.totalTiming ? debugData.totalTiming + "ms" : null,
          },
          responses: {
            overall: debugData.responses.overall || null,
            issues: debugData.responses.issues || null,
          },
        };
        responseDataEl.textContent = JSON.stringify(responseObj, null, 2);

        // Apply syntax highlighting if Prism is available
        if (typeof Prism !== "undefined") {
          Prism.highlightElement(responseDataEl);
        }
      }

      logDebug("Debug panel updated for Course Report");
    } catch (error) {
      logWarn("Failed to update debug panel:", error.message);
    }
  }

  // ========================================================================
  // Report Rendering - Header Section
  // ========================================================================

  /**
   * Renders the report header with course info
   * @param {Object} data - Overall data from API
   * @returns {HTMLElement}
   */
  function renderReportHeader(data) {
    var header = createElement("header", { className: "ally-cr-header" });

    // Course title
    var title = createElement(
      "h3",
      { className: "ally-cr-title" },
      data.courseName || "Unknown Course",
    );
    header.appendChild(title);

    // Course metadata
    var metaList = createElement("dl", { className: "ally-cr-meta" });

    // Term
    if (data.termName) {
      metaList.appendChild(createElement("dt", {}, "Term"));
      metaList.appendChild(createElement("dd", {}, data.termName));
    }

    // Department
    if (data.departmentName) {
      metaList.appendChild(createElement("dt", {}, "Department"));
      metaList.appendChild(createElement("dd", {}, data.departmentName));
    }

    // Students
    if (typeof data.numberOfStudents === "number") {
      metaList.appendChild(createElement("dt", {}, "Students"));
      metaList.appendChild(
        createElement("dd", {}, data.numberOfStudents.toLocaleString()),
      );
    }

    // Note: Last Scanned date is shown in the Data Freshness Warning instead

    header.appendChild(metaList);

    // Course link
    if (data.courseUrl) {
      var linkContainer = createElement("p", {
        className: "ally-cr-course-link",
      });
      var link = createElement(
        "a",
        {
          href: data.courseUrl,
          target: "_blank",
          rel: "noopener noreferrer",
        },
        [
          createElement("span", {
            ariaHidden: "true",
            dataset: { icon: "external" },
          }),
          "Open course in Blackboard",
        ],
      );
      linkContainer.appendChild(link);
      header.appendChild(linkContainer);
    }

    return header;
  }

  /**
   * Renders the data freshness warning box
   * @param {Object} data - Overall data from API
   * @returns {HTMLElement}
   */
  function renderDataFreshnessWarning(data) {
    var warning = createElement("div", {
      className: "ally-cr-data-warning",
      role: "note",
      ariaLabel: "Data freshness notice",
    });

    // Icon
    warning.appendChild(
      createElement("span", {
        ariaHidden: "true",
        className: "ally-cr-warning-icon",
        dataset: { icon: "warning" },
      }),
    );

    // Content
    var content = createElement("div", {
      className: "ally-cr-warning-content",
    });

    var heading = createElement("strong", {}, "Data freshness: ");
    content.appendChild(heading);

    // Calculate age of data
    var ageText = "";
    if (data.lastCheckedOn) {
      var lastChecked = new Date(data.lastCheckedOn);
      var now = new Date();
      var diffMs = now - lastChecked;
      var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        ageText = "today";
      } else if (diffDays === 1) {
        ageText = "yesterday";
      } else if (diffDays < 7) {
        ageText = diffDays + " days ago";
      } else if (diffDays < 30) {
        var weeks = Math.floor(diffDays / 7);
        ageText = weeks === 1 ? "1 week ago" : weeks + " weeks ago";
      } else {
        var months = Math.floor(diffDays / 30);
        ageText = months === 1 ? "1 month ago" : months + " months ago";
      }
    }

    // Build message
    var messageText = "This report is based on data last checked ";
    if (data.lastCheckedOn) {
      // Create time element for semantic markup
      var timeEl = createElement(
        "time",
        {
          datetime: data.lastCheckedOn,
        },
        formatDate(data.lastCheckedOn),
      );

      var span = document.createElement("span");
      span.appendChild(document.createTextNode(messageText));
      span.appendChild(timeEl);
      if (ageText) {
        span.appendChild(document.createTextNode(" (" + ageText + ")"));
      }
      span.appendChild(
        document.createTextNode(
          ". Accessibility scores may have changed since then.",
        ),
      );
      content.appendChild(span);
    } else {
      content.appendChild(
        document.createTextNode(
          messageText +
            "at an unknown time. Accessibility scores may have changed since then.",
        ),
      );
    }

    warning.appendChild(content);

    return warning;
  }

  /**
   * Formats a date string for display
   * @param {string} dateStr - Date string from API
   * @returns {string} Formatted date
   */
  function formatDate(dateStr) {
    if (!dateStr) return "Unknown";
    try {
      var date = new Date(dateStr);
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return dateStr;
    }
  }

  // ========================================================================
  // Report Rendering - Scores Section
  // ========================================================================

  /**
   * Renders the accessibility scores section
   * @param {Object} data - Overall data from API
   * @returns {HTMLElement}
   */
  function renderScoresSection(data) {
    var section = createElement("section", {
      className: "ally-cr-section ally-cr-scores-section",
      ariaLabelledby: "ally-cr-scores-heading",
    });

    var heading = createElement(
      "h4",
      {
        id: "ally-cr-scores-heading",
        className: "ally-cr-section-heading",
      },
      "Accessibility Scores",
    );
    section.appendChild(heading);

    var scoresGrid = createElement("div", { className: "ally-cr-scores-grid" });

    // Overall Score
    scoresGrid.appendChild(
      renderScoreMeter("Overall Score", data.overallScore, "overall-score"),
    );

    // Files Score
    scoresGrid.appendChild(
      renderScoreMeter("Files Score", data.filesScore, "files-score"),
    );

    // WYSIWYG Score
    scoresGrid.appendChild(
      renderScoreMeter("WYSIWYG Score", data.WYSIWYGScore, "wysiwyg-score"),
    );

    section.appendChild(scoresGrid);

    return section;
  }

  /**
   * Renders an accessible score meter
   * @param {string} label - Score label
   * @param {number} score - Score value (0-1)
   * @param {string} id - Unique ID for the meter
   * @returns {HTMLElement}
   */
  function renderScoreMeter(label, score, id) {
    var container = createElement("div", { className: "ally-cr-score-item" });

    var labelId = "ally-cr-" + id + "-label";
    var labelEl = createElement(
      "span",
      {
        className: "ally-cr-score-label",
        id: labelId,
      },
      label,
    );
    container.appendChild(labelEl);

    var rating = ALLY_COURSE_REPORT_CONFIG.getScoreRating(score);
    var percent =
      typeof score === "number" && !isNaN(score)
        ? Math.round(score * 100)
        : null;
    var percentStr = percent !== null ? percent + "%" : "N/A";

    var meterWrapper = createElement("div", {
      className: "ally-cr-score-meter-wrapper",
    });

    // Meter element
    var meter = createElement("div", {
      className: "ally-cr-score-meter",
      role: "meter",
      ariaValuenow: percent !== null ? percent : "",
      ariaValuemin: "0",
      ariaValuemax: "100",
      ariaValuetext:
        percent !== null
          ? percent + " percent, " + rating.label
          : "Not available",
      ariaLabelledby: labelId,
    });

    var fill = createElement("div", {
      className: "ally-cr-score-meter-fill " + rating.cssClass,
    });
    fill.style.width = (percent !== null ? percent : 0) + "%";
    meter.appendChild(fill);
    meterWrapper.appendChild(meter);

    // Score value
    var valueEl = createElement(
      "span",
      {
        className: "ally-cr-score-value",
      },
      percentStr,
    );
    meterWrapper.appendChild(valueEl);

    // Rating label
    var ratingEl = createElement(
      "span",
      {
        className: "ally-cr-score-rating " + rating.cssClass,
      },
      rating.label,
    );
    meterWrapper.appendChild(ratingEl);

    container.appendChild(meterWrapper);

    return container;
  }

  // ========================================================================
  // Report Rendering - Content Inventory Section
  // ========================================================================

  /**
   * Renders the content inventory section
   * @param {Object} data - Overall data from API
   * @returns {HTMLElement}
   */
  function renderContentInventory(data) {
    var section = createElement("section", {
      className: "ally-cr-section ally-cr-inventory-section",
      ariaLabelledby: "ally-cr-inventory-heading",
    });

    var heading = createElement(
      "h4",
      {
        id: "ally-cr-inventory-heading",
        className: "ally-cr-section-heading",
      },
      "Content Inventory",
    );
    section.appendChild(heading);

    // Calculate file type counts
    var fileTypeCounts =
      ALLY_COURSE_REPORT_CONFIG.calculateFileTypeCounts(data);

    // Summary counts using semantic definition list
    var totalFiles = data.totalFiles || 0;
    var totalWYSIWYG = data.totalWYSIWYG || 0;

    var summary = createElement("dl", {
      className: "ally-cr-inventory-summary",
    });

    // Files summary item
    var filesItem = createElement("div", {
      className: "ally-cr-summary-item",
    });
    filesItem.appendChild(createElement("dt", {}, "Total Files"));
    filesItem.appendChild(createElement("dd", {}, totalFiles.toLocaleString()));
    summary.appendChild(filesItem);

    // WYSIWYG summary item
    var wysiwygItem = createElement("div", {
      className: "ally-cr-summary-item",
    });
    wysiwygItem.appendChild(createElement("dt", {}, "WYSIWYG Content"));
    wysiwygItem.appendChild(
      createElement("dd", {}, totalWYSIWYG.toLocaleString()),
    );
    summary.appendChild(wysiwygItem);

    section.appendChild(summary);

    // External Files
    if (fileTypeCounts.external.total > 0) {
      section.appendChild(
        renderFileTypeTable(
          "External Files",
          "Files uploaded to the course",
          fileTypeCounts.external.types,
          "ally-cr-external-files",
        ),
      );
    }

    // Blackboard Content
    if (fileTypeCounts.blackboard.total > 0) {
      section.appendChild(
        renderFileTypeTable(
          "Blackboard Content",
          "Content created within Blackboard",
          fileTypeCounts.blackboard.types,
          "ally-cr-blackboard-content",
        ),
      );
    }

    return section;
  }

  /**
   * Renders a file type table with optional chart
   * @param {string} title - Table title
   * @param {string} description - Table description
   * @param {Array} types - Array of file type objects
   * @param {string} id - Table ID
   * @returns {HTMLElement}
   */
  function renderFileTypeTable(title, description, types, id) {
    var container = createElement("div", {
      className: "ally-cr-file-category",
    });

    var headingId = id + "-heading";
    var heading = createElement(
      "h5",
      { id: headingId, className: "ally-cr-file-category-heading" },
      title,
    );
    container.appendChild(heading);

    var desc = createElement(
      "p",
      { className: "ally-cr-file-category-desc" },
      description,
    );
    container.appendChild(desc);

    // Layout wrapper for table and chart
    var layoutWrapper = createElement("div", {
      className: "ally-cr-table-chart-layout",
    });

    // Table wrapper
    var tableWrapper = createElement("div", {
      className: "ally-cr-table-wrapper",
    });

    var table = createElement("table", {
      className: "ally-cr-file-table sortable-table",
      ariaLabelledby: headingId,
    });

    var thead = createElement("thead");
    var headerRow = createElement("tr");
    headerRow.appendChild(createElement("th", { scope: "col" }, "Type"));
    headerRow.appendChild(
      createElement(
        "th",
        { scope: "col", className: "ally-cr-count-col", "data-type": "number" },
        "Count",
      ),
    );
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = createElement("tbody");
    var total = 0;
    types.forEach(function (type) {
      var row = createElement("tr");
      row.appendChild(
        createElement("td", {}, [
          createElement("span", {
            ariaHidden: "true",
            dataset: { icon: type.icon },
          }),
          " ",
          type.label,
        ]),
      );
      row.appendChild(
        createElement(
          "td",
          { className: "ally-cr-count-col" },
          type.count.toLocaleString(),
        ),
      );
      tbody.appendChild(row);
      total += type.count;
    });

    var totalRow = createElement("tr", { className: "ally-cr-total-row" });
    totalRow.appendChild(createElement("td", {}, "Total"));
    totalRow.appendChild(
      createElement(
        "td",
        { className: "ally-cr-count-col" },
        total.toLocaleString(),
      ),
    );
    tbody.appendChild(totalRow);

    table.appendChild(tbody);
    tableWrapper.appendChild(table);

    // Add chart BEFORE table if chart infrastructure is available and there's enough data
    if (isChartAvailable() && types.length > 1) {
      var chartWrapper = createElement("div", {
        className: "ally-cr-chart-area",
      });
      layoutWrapper.appendChild(chartWrapper);

      var chartTitle = title + " by Type";
      var chartConfig = createFileTypeChartConfig(types, chartTitle);
      var chartDescription =
        "Doughnut chart showing the distribution of " +
        types.length +
        " different " +
        title.toLowerCase() +
        ".";

      // Defer chart creation until after DOM insertion
      setTimeout(function () {
        createAccessibleChart(
          chartConfig,
          id + "-chart",
          chartDescription,
          chartWrapper,
        );
      }, 50);
    }
    // Append table wrapper after chart (DOM order matters for focus)
    layoutWrapper.appendChild(tableWrapper);
    container.appendChild(layoutWrapper);
    return container;
  }
  // ========================================================================
  // Report Rendering - Issues Section
  // ========================================================================

  /**
   * Renders the issues overview section
   * @param {Object} issuesData - Issues data from API
   * @returns {HTMLElement}
   */
  function renderIssuesSection(issuesData) {
    var section = createElement("section", {
      className: "ally-cr-section ally-cr-issues-section",
      ariaLabelledby: "ally-cr-issues-heading",
    });

    var heading = createElement(
      "h4",
      {
        id: "ally-cr-issues-heading",
        className: "ally-cr-section-heading",
      },
      "Accessibility Issues",
    );
    section.appendChild(heading);

    // Calculate severity totals
    var severityTotals =
      ALLY_COURSE_REPORT_CONFIG.calculateSeverityTotals(issuesData);

    // Severity summary
    section.appendChild(renderSeveritySummary(severityTotals));

    // Tab interface for issue grouping
    var tabContainer = createElement("div", {
      className: "ally-cr-issues-tabs-container",
    });

    // Tablist
    var tablist = createElement("div", {
      className: "ally-cr-issues-tabs",
      role: "tablist",
      ariaLabel: "Issue grouping options",
    });

    // By Category tab
    var categoryTab = createElement(
      "button",
      {
        role: "tab",
        id: "ally-cr-tab-category",
        ariaSelected: "true",
        ariaControls: "ally-cr-panel-category",
        className: "ally-cr-tab ally-cr-tab-active",
        type: "button",
      },
      "By Category",
    );
    categoryTab.addEventListener("click", function () {
      switchIssueTab("category");
    });
    tablist.appendChild(categoryTab);

    // By Severity tab
    var severityTab = createElement(
      "button",
      {
        role: "tab",
        id: "ally-cr-tab-severity",
        ariaSelected: "false",
        ariaControls: "ally-cr-panel-severity",
        className: "ally-cr-tab",
        tabindex: "-1",
        type: "button",
      },
      "By Severity",
    );
    severityTab.addEventListener("click", function () {
      switchIssueTab("severity");
    });
    tablist.appendChild(severityTab);

    tabContainer.appendChild(tablist);

    // Tab panels
    var panelsContainer = createElement("div", {
      className: "ally-cr-tab-panels",
    });

    // Category panel (default visible)
    var categoryCounts =
      ALLY_COURSE_REPORT_CONFIG.calculateCategoryIssueCounts(issuesData);
    var categoryPanel = createElement("div", {
      role: "tabpanel",
      id: "ally-cr-panel-category",
      ariaLabelledby: "ally-cr-tab-category",
      className: "ally-cr-tab-panel",
    });

    // Add issues by category chart
    if (isChartAvailable() && severityTotals.total > 0) {
      var issuesChartWrapper = createElement("div", {
        className: "ally-cr-chart-area ally-cr-issues-chart-area",
      });
      categoryPanel.appendChild(issuesChartWrapper);

      var issuesChartConfig = createIssueCategoryChartConfig(categoryCounts);
      var issuesChartDescription =
        "Horizontal bar chart showing the distribution of " +
        severityTotals.total +
        " accessibility issues across " +
        Object.keys(categoryCounts).filter(function (cat) {
          return categoryCounts[cat].total > 0;
        }).length +
        " categories.";

      // Defer chart creation until after DOM insertion
      setTimeout(function () {
        createAccessibleChart(
          issuesChartConfig,
          "ally-cr-issues-category-chart",
          issuesChartDescription,
          issuesChartWrapper,
        );
      }, 50);
    }

    categoryPanel.appendChild(renderIssueCategories(categoryCounts));
    panelsContainer.appendChild(categoryPanel);

    // Severity panel (hidden by default)
    var severityGroups =
      ALLY_COURSE_REPORT_CONFIG.calculateIssuesBySeverity(issuesData);
    var severityPanel = createElement("div", {
      role: "tabpanel",
      id: "ally-cr-panel-severity",
      ariaLabelledby: "ally-cr-tab-severity",
      className: "ally-cr-tab-panel",
      hidden: true,
    });

    // Add severity breakdown chart
    if (isChartAvailable() && severityTotals.total > 0) {
      var severityChartWrapper = createElement("div", {
        className: "ally-cr-chart-area ally-cr-severity-chart-area",
      });
      severityPanel.appendChild(severityChartWrapper);

      var severityChartConfig =
        createSeverityBreakdownChartConfig(severityTotals);
      var severityChartDescription =
        "Doughnut chart showing the distribution of " +
        severityTotals.total +
        " accessibility issues by severity: " +
        severityTotals.severe +
        " severe, " +
        severityTotals.major +
        " major, and " +
        severityTotals.minor +
        " minor.";

      // Defer chart creation - will be created when tab is shown
      // Store config for lazy creation
      severityChartWrapper.dataset.chartPending = "true";
      severityChartWrapper.dataset.chartId = "ally-cr-severity-breakdown-chart";
      severityChartWrapper.dataset.chartDescription = severityChartDescription;
      severityChartWrapper.dataset.chartConfig =
        JSON.stringify(severityChartConfig);
    }

    severityPanel.appendChild(
      renderIssuesBySeverity(severityGroups, severityTotals),
    );
    panelsContainer.appendChild(severityPanel);

    tabContainer.appendChild(panelsContainer);
    section.appendChild(tabContainer);

    // Library references (if present)
    if (issuesData.libraryReference && issuesData.libraryReference > 0) {
      section.appendChild(renderLibraryReferences(issuesData.libraryReference));
    }

    return section;
  }

  /**
   * Switches between issue tab panels
   * @param {string} tabId - 'category' or 'severity'
   */
  function switchIssueTab(tabId) {
    var categoryTab = document.getElementById("ally-cr-tab-category");
    var severityTab = document.getElementById("ally-cr-tab-severity");
    var categoryPanel = document.getElementById("ally-cr-panel-category");
    var severityPanel = document.getElementById("ally-cr-panel-severity");

    if (!categoryTab || !severityTab || !categoryPanel || !severityPanel) {
      logWarn("Tab elements not found");
      return;
    }

    if (tabId === "category") {
      // Activate category tab
      categoryTab.setAttribute("aria-selected", "true");
      categoryTab.classList.add("ally-cr-tab-active");
      categoryTab.removeAttribute("tabindex");

      severityTab.setAttribute("aria-selected", "false");
      severityTab.classList.remove("ally-cr-tab-active");
      severityTab.setAttribute("tabindex", "-1");

      categoryPanel.hidden = false;
      severityPanel.hidden = true;
    } else {
      // Activate severity tab
      severityTab.setAttribute("aria-selected", "true");
      severityTab.classList.add("ally-cr-tab-active");
      severityTab.removeAttribute("tabindex");

      categoryTab.setAttribute("aria-selected", "false");
      categoryTab.classList.remove("ally-cr-tab-active");
      categoryTab.setAttribute("tabindex", "-1");

      severityPanel.hidden = false;
      categoryPanel.hidden = true;

      // Initialise sortable tables in severity panel if just revealed
      if (typeof initSortableTables === "function") {
        initSortableTables();
      }

      // Create pending charts in severity panel (lazy loading)
      var pendingCharts = severityPanel.querySelectorAll(
        "[data-chart-pending='true']",
      );
      pendingCharts.forEach(function (wrapper) {
        try {
          var chartConfig = JSON.parse(wrapper.dataset.chartConfig);
          var chartId = wrapper.dataset.chartId;
          var chartDescription = wrapper.dataset.chartDescription;

          createAccessibleChart(
            chartConfig,
            chartId,
            chartDescription,
            wrapper,
          );

          // Mark as no longer pending
          wrapper.removeAttribute("data-chart-pending");
          wrapper.removeAttribute("data-chart-config");
        } catch (e) {
          logWarn("Failed to create pending chart: " + e.message);
        }
      });
    }
  }

  /**
   * Renders severity summary with visual bars
   * @param {Object} totals - Severity totals object
   * @returns {HTMLElement}
   */
  function renderSeveritySummary(totals) {
    var container = createElement("div", {
      className: "ally-cr-severity-summary",
    });

    var summaryHeading = createElement(
      "h5",
      { className: "ally-cr-subsection-heading" },
      "Issue Summary",
    );
    container.appendChild(summaryHeading);

    var summaryText = createElement("p", {
      className: "ally-cr-severity-total",
    });
    summaryText.textContent =
      "Total issues found: " + totals.total.toLocaleString();
    container.appendChild(summaryText);

    var bars = createElement("div", { className: "ally-cr-severity-bars" });

    // Severe
    bars.appendChild(
      renderSeverityBar(
        "Severe",
        totals.severe,
        totals.total,
        "ally-severity-severe",
      ),
    );

    // Major
    bars.appendChild(
      renderSeverityBar(
        "Major",
        totals.major,
        totals.total,
        "ally-severity-major",
      ),
    );

    // Minor
    bars.appendChild(
      renderSeverityBar(
        "Minor",
        totals.minor,
        totals.total,
        "ally-severity-minor",
      ),
    );

    container.appendChild(bars);

    return container;
  }

  /**
   * Renders a severity bar
   * @param {string} label - Severity label
   * @param {number} count - Count for this severity
   * @param {number} total - Total issues
   * @param {string} cssClass - CSS class for styling
   * @returns {HTMLElement}
   */
  function renderSeverityBar(label, count, total, cssClass) {
    var container = createElement("div", {
      className: "ally-cr-severity-bar-item",
    });

    var labelRow = createElement("div", {
      className: "ally-cr-severity-bar-label",
    });
    labelRow.appendChild(createElement("span", { className: cssClass }, label));
    labelRow.appendChild(
      createElement(
        "span",
        { className: "ally-cr-severity-count" },
        count.toLocaleString(),
      ),
    );
    container.appendChild(labelRow);

    var barOuter = createElement("div", {
      className: "ally-cr-severity-bar-outer",
    });
    var percent = total > 0 ? Math.round((count / total) * 100) : 0;
    var barInner = createElement("div", {
      className: "ally-cr-severity-bar-inner " + cssClass,
    });
    barInner.style.width = percent + "%";
    barOuter.appendChild(barInner);
    container.appendChild(barOuter);

    return container;
  }

  /**
   * Renders issue categories with expandable details
   * @param {Object} categoryCounts - Category counts object
   * @returns {HTMLElement}
   */
  function renderIssueCategories(categoryCounts) {
    var container = createElement("div", {
      className: "ally-cr-issue-categories",
    });

    var catHeading = createElement(
      "h5",
      { className: "ally-cr-subsection-heading" },
      "Issues by Category",
    );
    container.appendChild(catHeading);

    // Sort categories by total count (descending)
    var sortedCategories = Object.keys(categoryCounts).sort(function (a, b) {
      return categoryCounts[b].total - categoryCounts[a].total;
    });

    // Filter to categories with issues
    var categoriesWithIssues = sortedCategories.filter(function (cat) {
      return categoryCounts[cat].total > 0;
    });

    if (categoriesWithIssues.length === 0) {
      container.appendChild(
        createElement(
          "p",
          { className: "ally-cr-no-issues" },
          "No accessibility issues detected.",
        ),
      );
      return container;
    }

    // Render each category as expandable details
    categoriesWithIssues.forEach(function (categoryName) {
      var category = categoryCounts[categoryName];
      container.appendChild(renderIssueCategory(categoryName, category));
    });

    return container;
  }

  /**
   * Renders a single issue category
   * @param {string} name - Category name
   * @param {Object} category - Category data
   * @returns {HTMLElement}
   */
  function renderIssueCategory(name, category) {
    var details = createElement("details", {
      className: "ally-cr-category-details",
    });

    // Summary (clickable header)
    var summary = createElement("summary", {
      className: "ally-cr-category-summary",
    });

    var summaryContent = createElement("span", {
      className: "ally-cr-category-summary-content",
    });

    // Icon
    summaryContent.appendChild(
      createElement("span", {
        ariaHidden: "true",
        className: "ally-cr-category-icon",
        dataset: { icon: category.icon },
      }),
    );

    // Name
    summaryContent.appendChild(
      createElement("span", { className: "ally-cr-category-name" }, name),
    );

    // Count badge
    var badge = createElement("span", { className: "ally-cr-category-badge" }, [
      category.total.toLocaleString(),
      createElement("span", { className: "visually-hidden" }, " issues"),
    ]);
    summaryContent.appendChild(badge);

    // Severity indicators
    if (category.severe > 0) {
      summaryContent.appendChild(
        createElement(
          "span",
          {
            className: "ally-cr-mini-badge ally-severity-severe",
            title: category.severe + " severe",
          },
          category.severe.toString(),
        ),
      );
    }
    if (category.major > 0) {
      summaryContent.appendChild(
        createElement(
          "span",
          {
            className: "ally-cr-mini-badge ally-severity-major",
            title: category.major + " major",
          },
          category.major.toString(),
        ),
      );
    }
    if (category.minor > 0) {
      summaryContent.appendChild(
        createElement(
          "span",
          {
            className: "ally-cr-mini-badge ally-severity-minor",
            title: category.minor + " minor",
          },
          category.minor.toString(),
        ),
      );
    }

    summary.appendChild(summaryContent);
    details.appendChild(summary);

    // Content
    var content = createElement("div", {
      className: "ally-cr-category-content",
    });

    // Description
    content.appendChild(
      createElement(
        "p",
        { className: "ally-cr-category-desc" },
        category.description,
      ),
    );

    // Issue table
    if (category.issues.length > 0) {
      var issueTable = createElement("table", {
        className: "ally-cr-issue-table sortable-table",
      });

      // Table header
      var thead = createElement("thead");
      var headerRow = createElement("tr");
      headerRow.appendChild(createElement("th", { scope: "col" }, "Severity"));
      headerRow.appendChild(
        createElement(
          "th",
          {
            scope: "col",
            className: "ally-cr-count-col",
            "data-type": "number",
          },
          "Count",
        ),
      );
      headerRow.appendChild(createElement("th", { scope: "col" }, "Issue"));
      thead.appendChild(headerRow);
      issueTable.appendChild(thead);

      // Table body
      var tbody = createElement("tbody");
      category.issues.forEach(function (issue) {
        var severityInfo = ALLY_COURSE_REPORT_CONFIG.getSeverityLevel(
          issue.severity,
        );
        var row = createElement("tr");

        // Severity cell
        var severityCell = createElement("td");
        severityCell.appendChild(
          createElement(
            "span",
            {
              className: "ally-cr-issue-severity " + severityInfo.cssClass,
            },
            severityInfo.label,
          ),
        );
        row.appendChild(severityCell);

        // Count cell
        row.appendChild(
          createElement(
            "td",
            { className: "ally-cr-count-col" },
            issue.count.toLocaleString(),
          ),
        );

        // Description cell
        row.appendChild(createElement("td", {}, issue.description));

        tbody.appendChild(row);
      });

      issueTable.appendChild(tbody);
      content.appendChild(issueTable);
    }

    details.appendChild(content);

    return details;
  }

  /**
   * Renders issues grouped by severity level
   * @param {Object} severityGroups - Issues grouped by severity
   * @param {Object} severityTotals - Severity totals for counts
   * @returns {HTMLElement}
   */
  function renderIssuesBySeverity(severityGroups, severityTotals) {
    var container = createElement("div", {
      className: "ally-cr-issues-by-severity",
    });

    // Render each severity level as expandable details
    var severityLevels = [
      {
        key: "severe",
        label: "Severe Issues",
        count: severityTotals.severe,
        cssClass: "ally-severity-severe",
      },
      {
        key: "major",
        label: "Major Issues",
        count: severityTotals.major,
        cssClass: "ally-severity-major",
      },
      {
        key: "minor",
        label: "Minor Issues",
        count: severityTotals.minor,
        cssClass: "ally-severity-minor",
      },
    ];

    severityLevels.forEach(function (level) {
      if (level.count > 0) {
        container.appendChild(
          renderSeverityGroup(
            level.key,
            level.label,
            level.cssClass,
            severityGroups[level.key],
          ),
        );
      }
    });

    if (severityTotals.total === 0) {
      container.appendChild(
        createElement(
          "p",
          { className: "ally-cr-no-issues" },
          "No accessibility issues detected.",
        ),
      );
    }

    return container;
  }

  /**
   * Renders a single severity group with expandable details
   * @param {string} key - Severity key (severe, major, minor)
   * @param {string} label - Display label
   * @param {string} cssClass - CSS class for styling
   * @param {Array} issues - Array of issues in this severity
   * @returns {HTMLElement}
   */
  function renderSeverityGroup(key, label, cssClass, issues) {
    var details = createElement("details", {
      className: "ally-cr-severity-details",
    });

    // Summary (clickable header)
    var summary = createElement("summary", {
      className: "ally-cr-severity-summary",
    });

    var summaryContent = createElement("span", {
      className: "ally-cr-severity-summary-content",
    });

    // Expand/collapse icon
    summaryContent.appendChild(
      createElement("span", {
        ariaHidden: "true",
        className: "ally-cr-expand-icon",
        dataset: { icon: "arrowRight" },
      }),
    );

    // Severity badge
    summaryContent.appendChild(
      createElement(
        "span",
        { className: "ally-cr-severity-label " + cssClass },
        label,
      ),
    );

    // Count badge
    var totalCount = issues.reduce(function (sum, issue) {
      return sum + issue.count;
    }, 0);
    summaryContent.appendChild(
      createElement("span", { className: "ally-cr-category-badge" }, [
        totalCount.toLocaleString(),
        createElement("span", { className: "visually-hidden" }, " issues"),
      ]),
    );

    summary.appendChild(summaryContent);
    details.appendChild(summary);

    // Content - table of issues
    var content = createElement("div", {
      className: "ally-cr-severity-content",
    });

    if (issues.length > 0) {
      var issueTable = createElement("table", {
        className: "ally-cr-issue-table sortable-table",
      });

      // Table header
      var thead = createElement("thead");
      var headerRow = createElement("tr");
      headerRow.appendChild(createElement("th", { scope: "col" }, "Category"));
      headerRow.appendChild(
        createElement(
          "th",
          {
            scope: "col",
            className: "ally-cr-count-col",
            "data-type": "number",
          },
          "Count",
        ),
      );
      headerRow.appendChild(createElement("th", { scope: "col" }, "Issue"));
      thead.appendChild(headerRow);
      issueTable.appendChild(thead);

      // Table body
      var tbody = createElement("tbody");
      issues.forEach(function (issue) {
        var row = createElement("tr");

        // Category cell with icon
        var categoryCell = createElement("td");
        categoryCell.appendChild(
          createElement("span", {
            ariaHidden: "true",
            className: "ally-cr-category-icon",
            dataset: { icon: issue.categoryIcon },
          }),
        );
        categoryCell.appendChild(document.createTextNode(" " + issue.category));
        row.appendChild(categoryCell);

        // Count cell
        row.appendChild(
          createElement(
            "td",
            { className: "ally-cr-count-col" },
            issue.count.toLocaleString(),
          ),
        );

        // Description cell
        row.appendChild(createElement("td", {}, issue.description));

        tbody.appendChild(row);
      });

      issueTable.appendChild(tbody);
      content.appendChild(issueTable);
    }

    details.appendChild(content);

    return details;
  }

  /**
   * Renders library references section
   * @param {number} count - Number of library references
   * @returns {HTMLElement}
   */
  function renderLibraryReferences(count) {
    var container = createElement("div", { className: "ally-cr-library-refs" });

    var heading = createElement(
      "h5",
      { className: "ally-cr-subsection-heading" },
      "Library References",
    );
    container.appendChild(heading);

    var text = createElement("p");
    text.innerHTML =
      "This course contains " +
      count.toLocaleString() +
      " files whose accessibility score could be improved through <a href='https://help.blackboard.com/Ally/Ally_for_LMS/Instructor/Improve_File_Accessibility/Add_a_Library_Reference'>adding a library reference</a> to accessible versions of the content.";
    container.appendChild(text);

    return container;
  }

  // ========================================================================
  // Report Rendering - Actions Section
  // ========================================================================

  /**
   * Renders the export actions section
   * @returns {HTMLElement}
   */
  function renderActionsSection() {
    var section = createElement("section", {
      className: "ally-cr-section ally-cr-actions-section",
      ariaLabelledby: "ally-cr-actions-heading",
    });

    var heading = createElement(
      "h4",
      {
        id: "ally-cr-actions-heading",
        className: "ally-cr-section-heading",
      },
      "Export Options",
    );
    section.appendChild(heading);

    var actions = createElement("div", { className: "ally-cr-export-actions" });

    // Export HTML button
    var htmlBtn = createElement(
      "button",
      {
        type: "button",
        className: "ally-secondary-btn",
      },
      [
        createElement("span", {
          ariaHidden: "true",
          dataset: { icon: "download" },
        }),
        " Export HTML",
      ],
    );
    htmlBtn.addEventListener("click", exportHTML);
    actions.appendChild(htmlBtn);

    // Export CSV button
    var csvBtn = createElement(
      "button",
      {
        type: "button",
        className: "ally-secondary-btn",
      },
      [
        createElement("span", {
          ariaHidden: "true",
          dataset: { icon: "download" },
        }),
        " Export CSV",
      ],
    );
    csvBtn.addEventListener("click", exportCSV);
    actions.appendChild(csvBtn);

    section.appendChild(actions);

    return section;
  }

  // ========================================================================
  // Export Functions
  // ========================================================================

  /**
   * Exports report as comprehensive HTML file
   * Includes all report data: metadata, scores, file types, issues, library references
   */
  function exportHTML() {
    if (!lastReportData) {
      logWarn("No report data to export");
      return;
    }

    logInfo("Exporting comprehensive HTML...");

    var overall = lastReportData.overall;
    var issues = lastReportData.issues;
    var rating = ALLY_COURSE_REPORT_CONFIG.getScoreRating(overall.overallScore);
    var filesRating = ALLY_COURSE_REPORT_CONFIG.getScoreRating(
      overall.filesScore,
    );
    var wysiwygRating = ALLY_COURSE_REPORT_CONFIG.getScoreRating(
      overall.WYSIWYGScore,
    );
    var percent = Math.round((overall.overallScore || 0) * 100);
    var filesPercent = Math.round((overall.filesScore || 0) * 100);
    var wysiwygPercent = Math.round((overall.WYSIWYGScore || 0) * 100);

    // Calculate all data
    var fileTypeCounts =
      ALLY_COURSE_REPORT_CONFIG.calculateFileTypeCounts(overall);
    var severityTotals =
      ALLY_COURSE_REPORT_CONFIG.calculateSeverityTotals(issues);
    var categoryCounts =
      ALLY_COURSE_REPORT_CONFIG.calculateCategoryIssueCounts(issues);

    var html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
    html += '<meta charset="UTF-8">\n';
    html +=
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
    html +=
      "<title>Accessibility Report - " +
      escapeHtml(overall.courseName) +
      "</title>\n";
    html += "<style>\n";
    html +=
      "body { font-family: system-ui, -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #333; }\n";
    html +=
      "h1 { color: #333; border-bottom: 2px solid #006dcc; padding-bottom: 0.5rem; }\n";
    html +=
      "h2 { color: #444; margin-top: 2.5rem; border-bottom: 1px solid #eee; padding-bottom: 0.25rem; }\n";
    html += "h3 { color: #555; margin-top: 1.5rem; }\n";
    html +=
      "table { border-collapse: collapse; width: 100%; margin: 1rem 0; }\n";
    html +=
      "th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; }\n";
    html += "th { background: #f5f5f5; font-weight: 600; }\n";
    html +=
      ".score-card { display: inline-block; padding: 1rem 1.5rem; margin: 0.5rem 0.5rem 0.5rem 0; border-radius: 0.5rem; background: #f8f9fa; border-left: 4px solid #ccc; }\n";
    html += ".score-card strong { display: block; font-size: 1.5rem; }\n";
    html +=
      ".score-excellent { border-left-color: #2e7d32; } .score-excellent strong { color: #2e7d32; }\n";
    html +=
      ".score-good { border-left-color: #558b2f; } .score-good strong { color: #558b2f; }\n";
    html +=
      ".score-fair { border-left-color: #f9a825; } .score-fair strong { color: #f9a825; }\n";
    html +=
      ".score-poor { border-left-color: #ef6c00; } .score-poor strong { color: #ef6c00; }\n";
    html +=
      ".score-very-poor { border-left-color: #c62828; } .score-very-poor strong { color: #c62828; }\n";
    html +=
      ".severity-severe { background: #ffebee; color: #b71c1c; padding: 0.125rem 0.5rem; border-radius: 4px; font-weight: 600; }\n";
    html +=
      ".severity-major { background: #fff3e0; color: #bf360c; padding: 0.125rem 0.5rem; border-radius: 4px; font-weight: 600; }\n";
    html +=
      ".severity-minor { background: #fffde7; color: #6d4c00; padding: 0.125rem 0.5rem; border-radius: 4px; font-weight: 600; }\n";
    html +=
      ".summary-box { background: #e3f2fd; border-left: 4px solid #1976d2; padding: 1rem; margin: 1rem 0; border-radius: 0 0.25rem 0.25rem 0; }\n";
    html +=
      ".warning-box { background: #fff8e1; border-left: 4px solid #ffa000; padding: 1rem; margin: 1rem 0; border-radius: 0 0.25rem 0.25rem 0; }\n";
    html += ".count-col { text-align: right; }\n";
    html +=
      "footer { margin-top: 3rem; padding-top: 1rem; border-top: 2px solid #eee; color: #666; font-size: 0.875rem; }\n";
    html += "@media print { body { max-width: none; } }\n";
    html += "</style>\n</head>\n<body>\n";

    // ===== Header =====
    html += "<h1>Accessibility Report</h1>\n";
    html += "<h2>" + escapeHtml(overall.courseName) + "</h2>\n";

    // Course metadata
    html += "<table>\n";
    html +=
      "<tr><th>Term</th><td>" +
      escapeHtml(overall.termName || "N/A") +
      "</td></tr>\n";
    html +=
      "<tr><th>Department</th><td>" +
      escapeHtml(overall.departmentName || "N/A") +
      "</td></tr>\n";
    html +=
      "<tr><th>Enrolled Students</th><td>" +
      (overall.numberOfStudents || 0).toLocaleString() +
      "</td></tr>\n";
    html +=
      "<tr><th>Last Scanned</th><td>" +
      formatDate(overall.lastCheckedOn) +
      "</td></tr>\n";
    if (overall.courseUrl) {
      html +=
        '<tr><th>Course Link</th><td><a href="' +
        escapeHtml(overall.courseUrl) +
        '">' +
        escapeHtml(overall.courseUrl) +
        "</a></td></tr>\n";
    }
    html += "</table>\n";

    // Data freshness warning
    if (overall.lastCheckedOn) {
      var daysSinceCheck = Math.floor(
        (Date.now() - new Date(overall.lastCheckedOn).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysSinceCheck > 7) {
        html += '<div class="warning-box">\n';
        html +=
          "<strong>Data Freshness Warning:</strong> This course was last scanned " +
          daysSinceCheck +
          " days ago. ";
        html += "The accessibility data may not reflect recent changes.\n";
        html += "</div>\n";
      }
    }

    // ===== Accessibility Scores =====
    html += "<h2>Accessibility Scores</h2>\n";
    html += '<div class="score-card ' + rating.cssClass + '">\n';
    html += "<span>Overall Score</span>\n";
    html += "<strong>" + percent + "%</strong>\n";
    html += "<span>" + rating.label + "</span>\n";
    html += "</div>\n";
    html += '<div class="score-card ' + filesRating.cssClass + '">\n';
    html += "<span>Files Score</span>\n";
    html += "<strong>" + filesPercent + "%</strong>\n";
    html += "<span>" + filesRating.label + "</span>\n";
    html += "</div>\n";
    html += '<div class="score-card ' + wysiwygRating.cssClass + '">\n';
    html += "<span>WYSIWYG Score</span>\n";
    html += "<strong>" + wysiwygPercent + "%</strong>\n";
    html += "<span>" + wysiwygRating.label + "</span>\n";
    html += "</div>\n";

    // ===== Content Inventory =====
    html += "<h2>Content Inventory</h2>\n";
    html += '<div class="summary-box">\n';
    html +=
      "<strong>Total Files:</strong> " +
      (overall.totalFiles || 0).toLocaleString() +
      " &nbsp;&nbsp;|&nbsp;&nbsp; ";
    html +=
      "<strong>WYSIWYG Content:</strong> " +
      (overall.totalWYSIWYG || 0).toLocaleString() +
      "\n";
    html += "</div>\n";

    // External Files
    if (fileTypeCounts.external.total > 0) {
      html +=
        "<h3>External Files (" +
        fileTypeCounts.external.total.toLocaleString() +
        ")</h3>\n";
      html +=
        '<table>\n<tr><th>File Type</th><th class="count-col">Count</th></tr>\n';
      fileTypeCounts.external.types.forEach(function (type) {
        html +=
          "<tr><td>" +
          escapeHtml(type.label) +
          '</td><td class="count-col">' +
          type.count.toLocaleString() +
          "</td></tr>\n";
      });
      html += "</table>\n";
    }

    // Blackboard Content
    if (fileTypeCounts.blackboard.total > 0) {
      html +=
        "<h3>Blackboard Content (" +
        fileTypeCounts.blackboard.total.toLocaleString() +
        ")</h3>\n";
      html +=
        '<table>\n<tr><th>Content Type</th><th class="count-col">Count</th></tr>\n';
      fileTypeCounts.blackboard.types.forEach(function (type) {
        html +=
          "<tr><td>" +
          escapeHtml(type.label) +
          '</td><td class="count-col">' +
          type.count.toLocaleString() +
          "</td></tr>\n";
      });
      html += "</table>\n";
    }

    // ===== Accessibility Issues =====
    html += "<h2>Accessibility Issues</h2>\n";

    // Severity summary
    html += "<h3>Issue Summary</h3>\n";
    html +=
      '<table>\n<tr><th>Severity</th><th class="count-col">Count</th><th class="count-col">Percentage</th></tr>\n';
    var severePercent =
      severityTotals.total > 0
        ? ((severityTotals.severe / severityTotals.total) * 100).toFixed(1)
        : "0.0";
    var majorPercent =
      severityTotals.total > 0
        ? ((severityTotals.major / severityTotals.total) * 100).toFixed(1)
        : "0.0";
    var minorPercent =
      severityTotals.total > 0
        ? ((severityTotals.minor / severityTotals.total) * 100).toFixed(1)
        : "0.0";
    html +=
      '<tr><td><span class="severity-severe">Severe</span></td><td class="count-col">' +
      severityTotals.severe.toLocaleString() +
      '</td><td class="count-col">' +
      severePercent +
      "%</td></tr>\n";
    html +=
      '<tr><td><span class="severity-major">Major</span></td><td class="count-col">' +
      severityTotals.major.toLocaleString() +
      '</td><td class="count-col">' +
      majorPercent +
      "%</td></tr>\n";
    html +=
      '<tr><td><span class="severity-minor">Minor</span></td><td class="count-col">' +
      severityTotals.minor.toLocaleString() +
      '</td><td class="count-col">' +
      minorPercent +
      "%</td></tr>\n";
    html +=
      '<tr><td><strong>Total</strong></td><td class="count-col"><strong>' +
      severityTotals.total.toLocaleString() +
      '</strong></td><td class="count-col"><strong>100%</strong></td></tr>\n';
    html += "</table>\n";

    // Issues by category
    html += "<h3>Issues by Category</h3>\n";

    // Sort categories by total count
    var sortedCategories = Object.keys(categoryCounts)
      .filter(function (cat) {
        return categoryCounts[cat].total > 0;
      })
      .sort(function (a, b) {
        return categoryCounts[b].total - categoryCounts[a].total;
      });

    if (sortedCategories.length === 0) {
      html += "<p>No accessibility issues detected.</p>\n";
    } else {
      sortedCategories.forEach(function (categoryName) {
        var category = categoryCounts[categoryName];
        html +=
          "<h4>" +
          escapeHtml(categoryName) +
          " (" +
          category.total.toLocaleString() +
          " issues)</h4>\n";
        html += "<p><em>" + escapeHtml(category.description) + "</em></p>\n";

        if (category.issues.length > 0) {
          html +=
            '<table>\n<tr><th>Severity</th><th class="count-col">Count</th><th>Issue</th></tr>\n';
          category.issues.forEach(function (issue) {
            var severityInfo = ALLY_COURSE_REPORT_CONFIG.getSeverityLevel(
              issue.severity,
            );
            var severityClass = "severity-" + severityInfo.label.toLowerCase();
            html +=
              '<tr><td><span class="' +
              severityClass +
              '">' +
              severityInfo.label +
              "</span></td>";
            html +=
              '<td class="count-col">' + issue.count.toLocaleString() + "</td>";
            html += "<td>" + escapeHtml(issue.description) + "</td></tr>\n";
          });
          html += "</table>\n";
        }
      });
    }

    // ===== Library References =====
    if (issues.libraryReference && issues.libraryReference > 0) {
      html += "<h2>Library References</h2>\n";
      html +=
        "<p>This course contains <strong>" +
        issues.libraryReference.toLocaleString() +
        '</strong> files whose accessibility score could be improved through <a href="https://help.blackboard.com/Ally/Ally_for_LMS/Instructor/Improve_File_Accessibility/Add_a_Library_Reference">adding a library reference</a> to accessible versions of the content. ';
      html += "</p>\n";
    }

    // ===== Footer =====
    html += "<footer>\n";
    html +=
      "<p><strong>Report Generated:</strong> " +
      new Date().toLocaleString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) +
      "</p>\n";
    html +=
      "<p><strong>Data Source:</strong> Ally Accessibility Reporting API</p>\n";
    html +=
      "<p><em>This report provides a snapshot of accessibility metrics. For the most current data, generate a new report from the Ally Reporting Tool.</em></p>\n";
    html += "</footer>\n";
    html += "</body>\n</html>";

    downloadFile(
      html,
      "accessibility-report-" + sanitiseFilename(overall.courseName) + ".html",
      "text/html",
    );

    if (typeof ALLY_UI_MANAGER !== "undefined") {
      ALLY_UI_MANAGER.announce("Comprehensive HTML report downloaded");
    }

    logInfo("HTML export complete");
  }
  /**
   * Exports report as CSV file
   */
  function exportCSV() {
    if (!lastReportData) {
      logWarn("No report data to export");
      return;
    }

    logInfo("Exporting CSV...");

    var overall = lastReportData.overall;
    var issues = lastReportData.issues;

    var rows = [];

    // Header
    rows.push(["Accessibility Report - " + overall.courseName]);
    rows.push(["Generated", new Date().toISOString()]);
    rows.push([]);

    // Course info
    rows.push(["Course Information"]);
    rows.push(["Course Name", overall.courseName]);
    rows.push(["Term", overall.termName || ""]);
    rows.push(["Department", overall.departmentName || ""]);
    rows.push(["Students", overall.numberOfStudents || 0]);
    rows.push(["Last Scanned", overall.lastCheckedOn || ""]);
    rows.push([]);

    // Scores
    rows.push(["Accessibility Scores"]);
    rows.push(["Score Type", "Value", "Percentage"]);
    rows.push([
      "Overall Score",
      overall.overallScore || 0,
      Math.round((overall.overallScore || 0) * 100) + "%",
    ]);
    rows.push([
      "Files Score",
      overall.filesScore || 0,
      Math.round((overall.filesScore || 0) * 100) + "%",
    ]);
    rows.push([
      "WYSIWYG Score",
      overall.WYSIWYGScore || 0,
      Math.round((overall.WYSIWYGScore || 0) * 100) + "%",
    ]);
    rows.push([]);

    // Content inventory
    rows.push(["Content Inventory"]);
    rows.push(["Content Type", "Count"]);
    rows.push(["Total Files", overall.totalFiles || 0]);
    rows.push(["Total WYSIWYG", overall.totalWYSIWYG || 0]);
    rows.push(["PDF", overall.pdf || 0]);
    rows.push(["Documents", overall.document || 0]);
    rows.push(["Images", overall.image || 0]);
    rows.push(["Presentations", overall.presentation || 0]);
    rows.push([]);

    // Issues
    rows.push(["Accessibility Issues"]);
    rows.push(["Issue Type", "Severity", "Count"]);

    for (var field in issues) {
      if (
        Object.prototype.hasOwnProperty.call(issues, field) &&
        field.match(/\d$/)
      ) {
        var count = issues[field];
        if (typeof count === "number" && count > 0) {
          var severity = ALLY_COURSE_REPORT_CONFIG.getSeverityFromField(field);
          var severityLabel =
            ALLY_COURSE_REPORT_CONFIG.getSeverityLevel(severity).label;
          var description =
            ALLY_COURSE_REPORT_CONFIG.getIssueDescription(field);
          rows.push([description, severityLabel, count]);
        }
      }
    }

    // Convert to CSV
    var csv = rows
      .map(function (row) {
        return row
          .map(function (cell) {
            var str = String(cell);
            if (
              str.indexOf(",") !== -1 ||
              str.indexOf('"') !== -1 ||
              str.indexOf("\n") !== -1
            ) {
              return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
          })
          .join(",");
      })
      .join("\n");

    downloadFile(
      csv,
      "accessibility-report-" + sanitiseFilename(overall.courseName) + ".csv",
      "text/csv",
    );

    if (typeof ALLY_UI_MANAGER !== "undefined") {
      ALLY_UI_MANAGER.announce("CSV report downloaded");
    }
  }

  /**
   * Prints the report
   */
  function printReport() {
    logInfo("Printing report...");
    window.print();
  }

  /**
   * Downloads a file
   * @param {string} content - File content
   * @param {string} filename - File name
   * @param {string} mimeType - MIME type
   */
  function downloadFile(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Sanitises a string for use in filenames
   * @param {string} str - String to sanitise
   * @returns {string} Sanitised string
   */
  function sanitiseFilename(str) {
    if (!str) return "course";
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50);
  }

  // ========================================================================
  // Cache Integration Helpers
  // ========================================================================

  /**
   * Checks if cached and fresh data are meaningfully different
   * @param {Object} oldData - Cached data with overall/issues
   * @param {Object} newData - Fresh data with overall/issues
   * @returns {boolean} True if data has meaningfully changed
   */
  function dataHasChanged(oldData, newData) {
    if (!oldData || !newData) return true;

    var oldOverall = oldData.overall || {};
    var newOverall = newData.overall || {};

    // Check overall score
    if (oldOverall.overallScore !== newOverall.overallScore) return true;

    // Check file counts
    if (oldOverall.filesCount !== newOverall.filesCount) return true;

    // Check issue totals if available
    var oldIssues = oldData.issues || {};
    var newIssues = newData.issues || {};

    // Compare total issues by severity
    var oldSevere = (oldIssues.totalsBySeverity || {}).severe || 0;
    var newSevere = (newIssues.totalsBySeverity || {}).severe || 0;
    if (oldSevere !== newSevere) return true;

    var oldMajor = (oldIssues.totalsBySeverity || {}).major || 0;
    var newMajor = (newIssues.totalsBySeverity || {}).major || 0;
    if (oldMajor !== newMajor) return true;

    return false;
  }

  /**
   * Renders the report from cached or fresh data object
   * @param {Object} data - Report data with overall and issues properties
   */
  function renderReportFromData(data) {
    if (!data || !elements.resultsContainer) {
      logWarn("Cannot render: missing data or container");
      return;
    }

    logDebug("Rendering report from data");

    // Destroy any existing charts
    destroyCharts();

    // Build report
    var fragment = document.createDocumentFragment();

    // Header
    fragment.appendChild(renderReportHeader(data.overall));

    // Data Freshness Warning
    fragment.appendChild(renderDataFreshnessWarning(data.overall));

    // Scores
    fragment.appendChild(renderScoresSection(data.overall));

    // Content inventory
    fragment.appendChild(renderContentInventory(data.overall));

    // Issues
    fragment.appendChild(renderIssuesSection(data.issues));

    // Export actions
    fragment.appendChild(renderActionsSection());

    // Display report
    elements.resultsContainer.innerHTML = "";
    elements.resultsContainer.appendChild(fragment);
    elements.resultsContainer.hidden = false;

    // Populate SVG icons in dynamically created content
    if (
      typeof IconLibrary !== "undefined" &&
      typeof IconLibrary.populateIcons === "function"
    ) {
      IconLibrary.populateIcons();
    }

    // Initialise sortable tables
    if (typeof AccessibleSortableTable !== "undefined") {
      var sortableTables = elements.resultsContainer.querySelectorAll(
        "table.sortable-table",
      );
      sortableTables.forEach(function (table) {
        try {
          new AccessibleSortableTable(table);
        } catch (e) {
          logWarn("Failed to enhance table:", e.message);
        }
      });
      logDebug("Initialised " + sortableTables.length + " sortable tables");
    }
  }

  /**
   * Refreshes data in background without blocking UI
   * @param {string} cacheKey - The cache key
   * @param {Object} cachedEntry - The current cached entry
   */
  function refreshInBackground(cacheKey, cachedEntry) {
    if (backgroundRefreshInProgress) {
      logDebug("Background refresh already in progress");
      return;
    }

    backgroundRefreshInProgress = true;
    logInfo("Starting background refresh for:", cacheKey);

    // Use the selected course (should match cached data)
    var courseToFetch = selectedCourse || {
      id: cachedEntry.courseId,
      name: cachedEntry.data.overall
        ? cachedEntry.data.overall.courseName
        : cachedEntry.courseName,
      code: cachedEntry.courseCode,
      termName: cachedEntry.termName,
    };

    // Fetch fresh data silently
    fetchCourseData(courseToFetch)
      .then(function (freshData) {
        backgroundRefreshInProgress = false;

        // Check if data has changed
        if (dataHasChanged(cachedEntry.data, freshData)) {
          logInfo("Fresh data differs from cache");

          // Update cache with fresh data
          var newEntry = {
            type: "course-report",
            courseId: cachedEntry.courseId,
            courseName: cachedEntry.courseName,
            courseCode: cachedEntry.courseCode,
            termName: cachedEntry.termName,
            data: freshData,
          };
          ALLY_CACHE.set(cacheKey, newEntry);

          // Show update banner
          ALLY_CACHE_UI.showUpdateBanner(
            elements.resultsContainer,
            function () {
              // Apply update callback
              lastReportData = freshData;
              renderReportFromData(freshData);
              ALLY_CACHE_UI.hideUpdateBanner(elements.resultsContainer);

              // Announce to screen readers
              if (typeof ALLY_UI_MANAGER !== "undefined") {
                ALLY_UI_MANAGER.announce("Report updated with latest data");
              }
            },
          );
        } else {
          logInfo("Fresh data matches cache, updating timestamp only");

          // Data is same - just update the timestamp silently
          var updatedEntry = Object.assign({}, cachedEntry, {
            timestamp: Date.now(),
            accessedAt: Date.now(),
          });
          ALLY_CACHE.set(cacheKey, updatedEntry);

          // Hide the "checking for updates" banner
          ALLY_CACHE_UI.hideCachedBanner(elements.resultsContainer);
        }
      })
      .catch(function (error) {
        backgroundRefreshInProgress = false;
        logWarn("Background refresh failed:", error.message);
        // Keep showing cached data - don't show error, just hide the checking message
        // Update banner text to indicate we couldn't check
        var banner = elements.resultsContainer.querySelector(
          "#ally-cache-data-banner",
        );
        if (banner) {
          var textSpan = banner.querySelector(".ally-cache-banner-text");
          if (textSpan) {
            var age = ALLY_CACHE.formatAge(cachedEntry.timestamp);
            textSpan.innerHTML =
              'Showing cached data from <span class="ally-cache-banner-age">' +
              age +
              "</span>. Unable to check for updates.";
          }
        }
      });
  }

  // ========================================================================
  // Main Report Generation
  // ========================================================================

  /**
   * Generates and displays the course report
   * @returns {Promise<void>}
   */
  async function generateReport() {
    if (isGenerating) {
      logWarn("Report generation already in progress");
      return;
    }

    if (!selectedCourse) {
      logWarn("No course selected");
      return;
    }

    logInfo("Generating report for:", selectedCourse.name);

    // ====== Check Cache First ======
    var cacheKey = ALLY_CACHE.courseReportKey(selectedCourse.id);
    currentCacheKey = cacheKey;
    var cached = null;

    // Only check cache if ALLY_CACHE is available
    if (typeof ALLY_CACHE !== "undefined") {
      cached = ALLY_CACHE.get(cacheKey);
    }

    if (cached && cached.data) {
      logInfo("Cache hit for course:", selectedCourse.id);

      // Show cached data immediately (no loading spinner)
      lastReportData = cached.data;

      // Clear previous results first
      if (elements.resultsContainer) {
        elements.resultsContainer.innerHTML = "";
      }

      renderReportFromData(cached.data);

      // Show cached banner
      if (typeof ALLY_CACHE_UI !== "undefined") {
        ALLY_CACHE_UI.showCachedBanner(
          resultsContainer,
          cachedEntry.timestamp,
          false,
          false,
        );
      }

      // Announce to screen readers
      if (typeof ALLY_UI_MANAGER !== "undefined") {
        var rating = ALLY_COURSE_REPORT_CONFIG.getScoreRating(
          cached.data.overall.overallScore,
        );
        var percent = Math.round((cached.data.overall.overallScore || 0) * 100);
        ALLY_UI_MANAGER.announce(
          "Showing cached report. Overall accessibility score: " +
            percent +
            " percent, rated " +
            rating.label +
            ". Checking for updates.",
        );
      }

      // Start background refresh if API is likely available
      if (typeof ALLY_MAIN_CONTROLLER !== "undefined") {
        var apiState = ALLY_MAIN_CONTROLLER.getApiState();
        if (apiState !== "ERROR" && apiState !== "UNKNOWN") {
          refreshInBackground(cacheKey, cached);
        } else {
          // API not ready - update banner to indicate no refresh
          var banner = elements.resultsContainer.querySelector(
            "#ally-cache-data-banner",
          );
          if (banner) {
            var textSpan = banner.querySelector(".ally-cache-banner-text");
            if (textSpan) {
              var age = ALLY_CACHE.formatAge(cached.timestamp);
              textSpan.innerHTML =
                'Showing cached data from <span class="ally-cache-banner-age">' +
                age +
                "</span>. API not available to check for updates.";
            }
          }
        }
      } else {
        // ALLY_MAIN_CONTROLLER not available - try refresh anyway
        refreshInBackground(cacheKey, cached);
      }

      return; // Don't proceed with normal API call
    }

    // ====== No cache - proceed with normal API call ======
    logInfo("Cache miss for course:", selectedCourse.id);
    isGenerating = true;

    // Disable execute button during generation
    if (elements.executeButton) {
      elements.executeButton.disabled = true;
    }

    // Destroy any existing charts
    destroyCharts();

    // Clear previous results
    if (elements.resultsContainer) {
      elements.resultsContainer.hidden = true;
      elements.resultsContainer.innerHTML = "";
    }

    // Announce start
    if (typeof ALLY_UI_MANAGER !== "undefined") {
      ALLY_UI_MANAGER.announce(
        "Generating accessibility report for " + selectedCourse.name,
      );
    }

    try {
      // Fetch data
      var data = await fetchCourseData(selectedCourse);
      lastReportData = data;

      // Cache the result
      if (typeof ALLY_CACHE !== "undefined") {
        var cacheEntry = {
          type: "course-report",
          courseId: selectedCourse.id,
          courseName: selectedCourse.name,
          courseCode: selectedCourse.code,
          termName: selectedCourse.termName || "",
          data: data,
        };
        ALLY_CACHE.set(currentCacheKey, cacheEntry);
        logInfo("Cached course report:", currentCacheKey);
      }

      showProgress("Rendering report...", 98);

      // Build report
      var fragment = document.createDocumentFragment();

      // Header
      fragment.appendChild(renderReportHeader(data.overall));

      // Data Freshness Warning
      fragment.appendChild(renderDataFreshnessWarning(data.overall));

      // Scores
      fragment.appendChild(renderScoresSection(data.overall));

      // Content inventory
      fragment.appendChild(renderContentInventory(data.overall));

      // Issues
      fragment.appendChild(renderIssuesSection(data.issues));

      // Export actions
      fragment.appendChild(renderActionsSection());

      // Display report
      elements.resultsContainer.innerHTML = "";
      elements.resultsContainer.appendChild(fragment);
      elements.resultsContainer.hidden = false;

      // Populate SVG icons in dynamically created content
      if (
        typeof IconLibrary !== "undefined" &&
        typeof IconLibrary.populateIcons === "function"
      ) {
        IconLibrary.populateIcons();
      }

      // Initialise sortable tables
      if (typeof AccessibleSortableTable !== "undefined") {
        var sortableTables = elements.resultsContainer.querySelectorAll(
          "table.sortable-table",
        );
        sortableTables.forEach(function (table) {
          try {
            new AccessibleSortableTable(table);
          } catch (e) {
            logWarn("Failed to enhance table:", e.message);
          }
        });
        logDebug("Initialised " + sortableTables.length + " sortable tables");
      }

      hideProgress();

      // Announce completion
      var rating = ALLY_COURSE_REPORT_CONFIG.getScoreRating(
        data.overall.overallScore,
      );
      var percent = Math.round((data.overall.overallScore || 0) * 100);
      if (typeof ALLY_UI_MANAGER !== "undefined") {
        ALLY_UI_MANAGER.announce(
          "Report generated. Overall accessibility score: " +
            percent +
            " percent, rated " +
            rating.label,
        );
      }

      logInfo("Report generated successfully");
    } catch (error) {
      logError("Report generation failed:", error);
      hideProgress();

      // Try to fallback to cache
      if (currentCacheKey && typeof ALLY_CACHE !== "undefined") {
        var cachedFallback = ALLY_CACHE.get(currentCacheKey);
        if (cachedFallback && cachedFallback.data) {
          logInfo("Falling back to cached data due to API error");

          lastReportData = cachedFallback.data;
          renderReportFromData(cachedFallback.data);

          // Show error variant of cached banner
          if (typeof ALLY_CACHE_UI !== "undefined") {
            ALLY_CACHE_UI.showCachedBanner(
              elements.resultsContainer,
              cachedFallback.timestamp,
              true, // isError = true
            );
          }

          if (typeof ALLY_UI_MANAGER !== "undefined") {
            ALLY_UI_MANAGER.announce(
              "Connection error. Showing cached data from " +
                ALLY_CACHE.formatAge(cachedFallback.timestamp),
            );
          }

          // Exit without showing error UI
          return;
        }
      }

      // No cache fallback available - show error (existing behaviour)
      if (elements.resultsContainer) {
        var errorMsg = createElement("div", {
          className: "ally-cr-error",
          role: "alert",
        });
        errorMsg.appendChild(
          createElement("h4", {}, "Report Generation Failed"),
        );
        errorMsg.appendChild(
          createElement(
            "p",
            {},
            error.message || "An unexpected error occurred.",
          ),
        );
        elements.resultsContainer.innerHTML = "";
        elements.resultsContainer.appendChild(errorMsg);
        elements.resultsContainer.hidden = false;
      }

      if (typeof ALLY_UI_MANAGER !== "undefined") {
        ALLY_UI_MANAGER.announce("Error generating report: " + error.message);
      }
    } finally {
      isGenerating = false;

      // Re-enable execute button if course still selected
      if (elements.executeButton && selectedCourse) {
        elements.executeButton.disabled = false;
      }
    }
  }

  // ========================================================================
  // Initialisation
  // ========================================================================

  /**
   * Initialises the Course Report module
   * @returns {boolean} True if initialisation successful
   */
  function initialise() {
    if (initialised) {
      logWarn("Already initialised");
      return true;
    }

    logInfo("Initialising ALLY_COURSE_REPORT...");

    // Check dependencies
    if (!checkDependencies()) {
      logError("Initialisation failed: missing dependencies");
      return false;
    }

    // Cache DOM elements
    if (!cacheElements()) {
      logWarn("Some elements not found, but continuing...");
    }

    // Register for course selection changes
    ALLY_COURSE_REPORT_SEARCH.onSelectionChange(handleCourseSelectionChange);
    logDebug("Registered for course selection changes");

    // Bind execute button
    if (elements.executeButton) {
      elements.executeButton.addEventListener("click", function () {
        generateReport();
      });
      logDebug("Execute button bound");
    }

    // Check for already selected course
    var existingSelection = ALLY_COURSE_REPORT_SEARCH.getSelectedCourse();
    if (existingSelection) {
      handleCourseSelectionChange(existingSelection);
    }

    initialised = true;
    logInfo("ALLY_COURSE_REPORT initialised successfully");

    return true;
  }

  // ========================================================================
  // Debug & Testing
  // ========================================================================

  /**
   * Gets debug information
   * @returns {Object} Debug info
   */
  function getDebugInfo() {
    return {
      initialised: initialised,
      selectedCourse: selectedCourse,
      isGenerating: isGenerating,
      hasLastReportData: !!lastReportData,
      elementsFound: {
        executeButton: !!elements.executeButton,
        progressSection: !!elements.progressSection,
        progressFill: !!elements.progressFill,
        progressMessage: !!elements.progressMessage,
        resultsContainer: !!elements.resultsContainer,
      },
      dependencies: {
        ALLY_CONFIG: typeof ALLY_CONFIG !== "undefined",
        ALLY_API_CLIENT: typeof ALLY_API_CLIENT !== "undefined",
        ALLY_UI_MANAGER: typeof ALLY_UI_MANAGER !== "undefined",
        ALLY_COURSE_REPORT_SEARCH:
          typeof ALLY_COURSE_REPORT_SEARCH !== "undefined",
        ALLY_COURSE_REPORT_CONFIG:
          typeof ALLY_COURSE_REPORT_CONFIG !== "undefined",
      },
    };
  }

  // ========================================================================
  // Public API
  // ========================================================================

  return {
    // Initialisation
    initialise: initialise,
    isInitialised: function () {
      return initialised;
    },

    // Report generation
    generateReport: generateReport,

    // State access
    getSelectedCourse: function () {
      return selectedCourse;
    },
    getLastReportData: function () {
      return lastReportData;
    },
    isGenerating: function () {
      return isGenerating;
    },

    // Export functions
    exportHTML: exportHTML,
    exportCSV: exportCSV,
    printReport: printReport,

    // Cache integration
    /**
     * Renders a report from a cached entry (for cache browser integration)
     * @param {Object} cachedEntry - The cached entry from ALLY_CACHE
     * @returns {boolean} True if rendering succeeded
     */
    renderFromCache: function (cachedEntry) {
      if (!cachedEntry || !cachedEntry.data) {
        logWarn("Invalid cached entry for renderFromCache");
        return false;
      }

      // Set the selected course from cache
      selectedCourse = {
        id: cachedEntry.courseId,
        name: cachedEntry.courseName,
        code: cachedEntry.courseCode,
        termName: cachedEntry.termName,
      };

      // Update the search display if available
      if (typeof ALLY_COURSE_REPORT_SEARCH !== "undefined") {
        ALLY_COURSE_REPORT_SEARCH.setSelectedCourse(selectedCourse);
      }

      // Store the data
      lastReportData = cachedEntry.data;
      currentCacheKey = ALLY_CACHE.courseReportKey(cachedEntry.courseId);

      // Render the report
      renderReportFromData(cachedEntry.data);

      // Show cached banner
      if (typeof ALLY_CACHE_UI !== "undefined") {
        ALLY_CACHE_UI.showCachedBanner(
          elements.resultsContainer,
          cachedEntry.timestamp,
          false,
        );
      }

      logInfo("Rendered report from cache:", currentCacheKey);
      return true;
    },

    // Debug
    getDebugInfo: getDebugInfo,
  };
})();
