/**
 * @fileoverview Ally Chart Renderer - Visual chart representations of accessibility data
 * @module AllyChartRenderer
 * @requires ALLY_CONFIG
 * @requires ALLY_RESULT_RENDERER
 * @requires ChartBuilder
 * @requires ChartControls
 * @requires ChartAccessibility
 * @version 1.0.0
 * @since Phase 6
 *
 * @description
 * Renders accessibility data as interactive charts using the existing Chart.js infrastructure.
 * Provides visual representations including:
 * - Score distribution (bar chart)
 * - Score comparison (grouped bar chart)
 * - Issue severity breakdown (doughnut chart)
 * - Top issues (horizontal bar chart)
 *
 * @example
 * // Render charts for current data
 * ALLY_CHART_RENDERER.render(result, 'overall');
 *
 * // Destroy all charts
 * ALLY_CHART_RENDERER.destroy();
 */

const ALLY_CHART_RENDERER = (function () {
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
      console.error("[AllyChartRenderer] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyChartRenderer] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyChartRenderer] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyChartRenderer] " + message, ...args);
  }

  // ========================================================================
  // Configuration
  // ========================================================================

  /**
   * Chart configuration
   * @type {Object}
   */
  const CONFIG = {
    /** Container element ID */
    containerId: "ally-chart-container",
    /** Default chart palette */
    defaultPalette: "Okabe and Ito",
    /** Chart colours for score levels (WCAG AA compliant) */
    scoreColours: {
      veryPoor: "#9a0007", // Dark red
      poor: "#d32f2f", // Red
      fair: "#ed6c02", // Orange
      good: "#388e3c", // Green
      excellent: "#1b5e20", // Dark green
    },
    /** Severity colours (WCAG AA compliant) */
    severityColours: {
      severe: "#9a0007",
      major: "#d32f2f",
      minor: "#ed6c02",
    },
    /** Chart dimensions */
    dimensions: {
      width: "100%",
      height: 320,
    },
  };

  // ========================================================================
  // State
  // ========================================================================

  /** Active chart instances (for cleanup) */
  let activeCharts = [];

  /** Flag indicating if dependencies are available */
  let dependenciesValidated = false;

  // ========================================================================
  // Issue Field Definitions
  // ========================================================================

  /**
   * Issue fields with labels and severity levels
   * Based on Ally API documentation
   * @type {Object}
   */
  const ISSUE_FIELDS = {
    // Severe Issues (suffix 1)
    scanned1: { label: "Not Scanned", severity: "severe" },
    security1: { label: "Security Restricted", severity: "severe" },
    parsable1: { label: "Unparsable", severity: "severe" },
    imageSeizure1: { label: "Seizure Risk", severity: "severe" },

    // Major Issues (suffix 2)
    alternativeText2: { label: "Missing Alt Text", severity: "major" },
    contrast2: { label: "Contrast Issues", severity: "major" },
    headingsPresence2: { label: "Missing Headings", severity: "major" },
    tableHeaders2: { label: "Missing Table Headers", severity: "major" },
    tagged2: { label: "Untagged PDF", severity: "major" },
    imageDecorative2: { label: "Decorative Image", severity: "major" },
    imageContrast2: { label: "Image Contrast", severity: "major" },
    imageDescription2: { label: "Image Description", severity: "major" },
    ocred2: { label: "Scanned PDF (OCR)", severity: "major" },
    htmlImageAlt2: { label: "HTML Image Alt", severity: "major" },
    htmlEmptyHeading2: { label: "Empty Heading", severity: "major" },
    htmlHeadingsStart2: { label: "Heading Start", severity: "major" },
    htmlHeadingsPresence2: { label: "HTML Headings", severity: "major" },
    htmlLabel2: { label: "Form Label", severity: "major" },
    htmlCaption2: { label: "Caption Missing", severity: "major" },
    htmlObjectAlt2: { label: "Object Alt Text", severity: "major" },
    htmlColorContrast2: { label: "HTML Contrast", severity: "major" },
    htmlTdHasHeader2: { label: "Table Cell Header", severity: "major" },
    htmlEmptyTableHeader2: { label: "Empty Table Header", severity: "major" },
    htmlBrokenLink2: { label: "Broken Link", severity: "major" },

    // Minor Issues (suffix 3)
    title3: { label: "Missing Title", severity: "minor" },
    languagePresence3: { label: "Language Not Set", severity: "minor" },
    languageCorrect3: { label: "Wrong Language", severity: "minor" },
    headingsSequential3: { label: "Heading Sequence", severity: "minor" },
    headingsStartAtOne3: { label: "Heading Start Level", severity: "minor" },
    headingsHigherLevel3: { label: "High Level Heading", severity: "minor" },
    imageOcr3: { label: "Image Text (OCR)", severity: "minor" },
    htmlTitle3: { label: "HTML Title", severity: "minor" },
    htmlHasLang3: { label: "HTML Language", severity: "minor" },
    htmlHeadingOrder3: { label: "Heading Order", severity: "minor" },
    htmlLinkName3: { label: "Link Name", severity: "minor" },
    htmlList3: { label: "List Structure", severity: "minor" },
    htmlDefinitionList3: { label: "Definition List", severity: "minor" },
    htmlImageRedundantAlt3: { label: "Redundant Alt Text", severity: "minor" },
  };

  // ========================================================================
  // Dependency Validation
  // ========================================================================

  /**
   * Validates that required dependencies are available
   * @returns {boolean} True if all dependencies are available
   */
  function validateDependencies() {
    if (dependenciesValidated) return true;

    const dependencies = [
      { name: "Chart.js", check: () => typeof Chart !== "undefined" },
      {
        name: "ChartBuilder",
        check: () => typeof ChartBuilder !== "undefined",
      },
      {
        name: "ChartControls",
        check: () => typeof ChartControls !== "undefined",
      },
      { name: "ALLY_CONFIG", check: () => typeof ALLY_CONFIG !== "undefined" },
    ];

    const missing = dependencies.filter((dep) => !dep.check());

    if (missing.length > 0) {
      const missingNames = missing.map((dep) => dep.name).join(", ");
      logError("Missing dependencies: " + missingNames);
      return false;
    }

    dependenciesValidated = true;
    logDebug("All dependencies validated");
    return true;
  }

  // ========================================================================
  // Data Processing Functions
  // ========================================================================

  /**
   * Calculates score distribution across bins
   * @param {Array} data - Array of result rows
   * @param {string} scoreField - Field to analyse (default: 'overallScore')
   * @returns {Object} { labels: [], counts: [], total: number }
   */
  function calculateScoreDistribution(data, scoreField) {
    scoreField = scoreField || "overallScore";

    const bins = {
      veryPoor: 0, // 0-30%
      poor: 0, // 30-50%
      fair: 0, // 50-70%
      good: 0, // 70-90%
      excellent: 0, // 90-100%
    };

    let validCount = 0;

    data.forEach(function (row) {
      const score = row[scoreField];
      if (typeof score !== "number" || isNaN(score)) return;

      validCount++;
      if (score >= 0.9) bins.excellent++;
      else if (score >= 0.7) bins.good++;
      else if (score >= 0.5) bins.fair++;
      else if (score >= 0.3) bins.poor++;
      else bins.veryPoor++;
    });

    return {
      labels: ["0-30%", "30-50%", "50-70%", "70-90%", "90-100%"],
      counts: [bins.veryPoor, bins.poor, bins.fair, bins.good, bins.excellent],
      total: validCount,
    };
  }

  /**
   * Calculates average scores from data
   * @param {Array} data - Array of result rows
   * @returns {Object} { overall: number, files: number, wysiwyg: number }
   */
  function calculateAverageScores(data) {
    const totals = { overall: 0, files: 0, wysiwyg: 0 };
    const counts = { overall: 0, files: 0, wysiwyg: 0 };

    data.forEach(function (row) {
      if (typeof row.overallScore === "number" && !isNaN(row.overallScore)) {
        totals.overall += row.overallScore;
        counts.overall++;
      }
      if (typeof row.filesScore === "number" && !isNaN(row.filesScore)) {
        totals.files += row.filesScore;
        counts.files++;
      }
      if (typeof row.WYSIWYGScore === "number" && !isNaN(row.WYSIWYGScore)) {
        totals.wysiwyg += row.WYSIWYGScore;
        counts.wysiwyg++;
      }
    });

    return {
      overall: counts.overall > 0 ? totals.overall / counts.overall : null,
      files: counts.files > 0 ? totals.files / counts.files : null,
      wysiwyg: counts.wysiwyg > 0 ? totals.wysiwyg / counts.wysiwyg : null,
    };
  }

  /**
   * Calculates issue totals by severity
   * @param {Array} data - Array of result rows
   * @returns {Object} { severe: n, major: n, minor: n, total: n }
   */
  function calculateIssueSeverityTotals(data) {
    let severe = 0;
    let major = 0;
    let minor = 0;

    data.forEach(function (row) {
      Object.keys(ISSUE_FIELDS).forEach(function (field) {
        const value = row[field];
        if (typeof value === "number" && !isNaN(value)) {
          const severity = ISSUE_FIELDS[field].severity;
          if (severity === "severe") severe += value;
          else if (severity === "major") major += value;
          else if (severity === "minor") minor += value;
        }
      });
    });

    return {
      severe: severe,
      major: major,
      minor: minor,
      total: severe + major + minor,
    };
  }

  /**
   * Gets top N issues sorted by count
   * @param {Array} data - Array of result rows
   * @param {number} n - Number of top issues to return (default: 10)
   * @returns {Array} [{ field, label, count, severity }]
   */
  function getTopIssues(data, n) {
    n = n || 10;
    const totals = [];

    Object.keys(ISSUE_FIELDS).forEach(function (field) {
      let count = 0;
      data.forEach(function (row) {
        if (typeof row[field] === "number" && !isNaN(row[field])) {
          count += row[field];
        }
      });

      if (count > 0) {
        totals.push({
          field: field,
          label: ISSUE_FIELDS[field].label,
          count: count,
          severity: ISSUE_FIELDS[field].severity,
        });
      }
    });

    // Sort by count descending
    totals.sort(function (a, b) {
      return b.count - a.count;
    });

    return totals.slice(0, n);
  }

  // ========================================================================
  // Chart Configuration Generators
  // ========================================================================

  /**
   * Creates configuration for score distribution chart
   * @param {Array} data - Data array
   * @returns {Object} Chart.js configuration
   */
  function createScoreDistributionConfig(data) {
    const distribution = calculateScoreDistribution(data, "overallScore");

    return {
      type: "bar",
      data: {
        labels: distribution.labels,
        datasets: [
          {
            label: "Course Count",
            data: distribution.counts,
            backgroundColor: [
              CONFIG.scoreColours.veryPoor,
              CONFIG.scoreColours.poor,
              CONFIG.scoreColours.fair,
              CONFIG.scoreColours.good,
              CONFIG.scoreColours.excellent,
            ],
            borderWidth: 1,
            borderColor: "#000000",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: "Score Distribution (" + distribution.total + " courses)",
            font: { size: 16 },
          },
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Accessibility Score Range",
            },
          },
          y: {
            title: {
              display: true,
              text: "Number of Courses",
            },
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
      },
    };
  }

  /**
   * Creates configuration for score comparison chart
   * @param {Array} data - Data array
   * @returns {Object|null} Chart.js configuration or null if insufficient data
   */
  function createScoreComparisonConfig(data) {
    const averages = calculateAverageScores(data);

    // Build labels and data arrays only for available scores
    const labels = [];
    const values = [];
    const colours = [];

    if (averages.overall !== null) {
      labels.push("Overall Score");
      values.push(Math.round(averages.overall * 100));
      colours.push(getScoreColour(averages.overall));
    }
    if (averages.files !== null) {
      labels.push("Files Score");
      values.push(Math.round(averages.files * 100));
      colours.push(getScoreColour(averages.files));
    }
    if (averages.wysiwyg !== null) {
      labels.push("WYSIWYG Score");
      values.push(Math.round(averages.wysiwyg * 100));
      colours.push(getScoreColour(averages.wysiwyg));
    }

    if (labels.length === 0) {
      return null;
    }

    return {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Average Score (%)",
            data: values,
            backgroundColor: colours,
            borderWidth: 1,
            borderColor: "#000000",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y", // Horizontal bars
        plugins: {
          title: {
            display: true,
            text: "Average Scores Across " + data.length + " Courses",
            font: { size: 16 },
          },
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Score (%)",
            },
            min: 0,
            max: 100,
          },
          y: {
            title: {
              display: false,
            },
          },
        },
      },
    };
  }

  /**
   * Creates configuration for severity breakdown chart (doughnut)
   * @param {Array} data - Data array
   * @returns {Object|null} Chart.js configuration or null if no issues
   */
  function createSeverityBreakdownConfig(data) {
    const severityTotals = calculateIssueSeverityTotals(data);

    if (severityTotals.total === 0) {
      return null;
    }

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
            backgroundColor: [
              CONFIG.severityColours.severe,
              CONFIG.severityColours.major,
              CONFIG.severityColours.minor,
            ],
            borderWidth: 2,
            borderColor: "#ffffff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text:
              "Issue Severity Distribution (" +
              severityTotals.total.toLocaleString() +
              " total)",
            font: { size: 16 },
          },
          legend: {
            display: true,
            position: "bottom",
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = context.raw;
                const percentage = (
                  (value / severityTotals.total) *
                  100
                ).toFixed(1);
                return (
                  context.label +
                  ": " +
                  value.toLocaleString() +
                  " (" +
                  percentage +
                  "%)"
                );
              },
            },
          },
        },
      },
    };
  }

  /**
   * Creates configuration for top issues chart (horizontal bar)
   * @param {Array} data - Data array
   * @returns {Object|null} Chart.js configuration or null if no issues
   */
  function createTopIssuesConfig(data) {
    const topIssues = getTopIssues(data, 10);

    if (topIssues.length === 0) {
      return null;
    }

    const labels = topIssues.map(function (issue) {
      return issue.label;
    });
    const values = topIssues.map(function (issue) {
      return issue.count;
    });
    const colours = topIssues.map(function (issue) {
      return CONFIG.severityColours[issue.severity];
    });

    return {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Issue Count",
            data: values,
            backgroundColor: colours,
            borderWidth: 1,
            borderColor: "#000000",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y", // Horizontal bars
        plugins: {
          title: {
            display: true,
            text: "Top " + topIssues.length + " Most Common Issues",
            font: { size: 16 },
          },
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Number of Occurrences",
            },
            beginAtZero: true,
          },
          y: {
            title: {
              display: false,
            },
          },
        },
      },
    };
  }

  // ========================================================================
  // Helper Functions
  // ========================================================================

  /**
   * Gets colour for a score value
   * @param {number} score - Score between 0 and 1
   * @returns {string} Colour hex code
   */
  function getScoreColour(score) {
    if (score >= 0.9) return CONFIG.scoreColours.excellent;
    if (score >= 0.7) return CONFIG.scoreColours.good;
    if (score >= 0.5) return CONFIG.scoreColours.fair;
    if (score >= 0.3) return CONFIG.scoreColours.poor;
    return CONFIG.scoreColours.veryPoor;
  }

  /**
   * Determines which charts are applicable for the current data
   * @param {Object} result - API result object
   * @param {string} endpoint - 'overall' or 'issues'
   * @returns {string[]} Array of chart type identifiers
   */
  function getApplicableCharts(result, endpoint) {
    const charts = [];
    const data = result.data || [];

    if (data.length === 0) return charts;

    if (endpoint === "overall") {
      // Always show score distribution for overall
      charts.push("scoreDistribution");

      // Show score comparison if we have score data
      const hasScores = data.some(function (row) {
        return (
          row.overallScore != null ||
          row.filesScore != null ||
          row.WYSIWYGScore != null
        );
      });
      if (hasScores) {
        charts.push("scoreComparison");
      }
    } else if (endpoint === "issues") {
      // Show severity breakdown for issues
      charts.push("severityBreakdown");
      // Show top issues
      charts.push("topIssues");
    }

    return charts;
  }

  /**
   * Generates accessible description for a chart
   * @param {string} chartType - Chart type identifier
   * @param {Object} result - Result data
   * @param {string} endpoint - Endpoint type
   * @returns {string} Accessible description
   */
  function generateChartDescription(chartType, result, endpoint) {
    const data = result.data || [];
    const count = data.length;

    switch (chartType) {
      case "scoreDistribution":
        return (
          "Bar chart showing the distribution of " +
          count +
          " courses across five accessibility score ranges: 0-30%, 30-50%, 50-70%, 70-90%, and 90-100%."
        );
      case "scoreComparison":
        return (
          "Horizontal bar chart comparing the average overall, files, and WYSIWYG accessibility scores across " +
          count +
          " courses."
        );
      case "severityBreakdown":
        return (
          "Doughnut chart showing the proportion of severe, major, and minor accessibility issues found across " +
          count +
          " courses."
        );
      case "topIssues":
        return (
          "Horizontal bar chart showing the ten most common accessibility issues across " +
          count +
          " courses, coloured by severity level."
        );
      default:
        return "Accessibility data chart.";
    }
  }

  /**
   * Generates HTML for the chart container structure
   * @param {string[]} chartTypes - Array of chart types to render
   * @param {Object} result - Result data for descriptions
   * @param {string} endpoint - Endpoint type
   * @returns {string} HTML string
   */
  function generateChartContainerHtml(chartTypes, result, endpoint) {
    if (chartTypes.length === 0) {
      return '<p class="ally-no-results">No data available for chart visualisation.</p>';
    }

    var html = '<div class="ally-charts-grid">';

    chartTypes.forEach(function (chartType, index) {
      var chartId = "ally-chart-" + chartType + "-" + Date.now() + "-" + index;
      var description = generateChartDescription(chartType, result, endpoint);

      html += '<div class="ally-chart-wrapper">';
      html += '<p class="ally-chart-description" id="' + chartId + '-desc">';
      html += description;
      html += "</p>";
      // Use chart-container class for controls styling, but mark as ally-managed
      // to allow our manual control integration while preventing auto-detection issues
      html +=
        '<div class="chart-container ally-chart-container-inner" id="' +
        chartId +
        '" role="figure" aria-describedby="' +
        chartId +
        '-desc" data-chart-type="' +
        chartType +
        '" data-ally-chart="true">';
      html +=
        '<canvas id="' +
        chartId +
        '-canvas" width="600" height="320"></canvas>';
      html += "</div>";
      html += "</div>";
    });

    html += "</div>";
    return html;
  }

  // ========================================================================
  // Chart Rendering
  // ========================================================================

  /**
   * Renders a single chart with integrated controls and accessibility
   * @param {string} chartType - Chart type identifier
   * @param {Object} result - Result data
   * @param {HTMLElement} container - Container element for the chart
   * @param {number} chartIndex - Index for view controls
   * @returns {Object|null} Chart info or null on failure
   */
  function renderChart(chartType, result, container, chartIndex) {
    var data = result.data || [];
    var config = null;

    switch (chartType) {
      case "scoreDistribution":
        config = createScoreDistributionConfig(data);
        break;
      case "scoreComparison":
        config = createScoreComparisonConfig(data);
        break;
      case "severityBreakdown":
        config = createSeverityBreakdownConfig(data);
        break;
      case "topIssues":
        config = createTopIssuesConfig(data);
        break;
      default:
        logWarn("Unknown chart type: " + chartType);
        return null;
    }

    if (!config) {
      logWarn("No config generated for chart type: " + chartType);
      return null;
    }

    try {
      var canvas = container.querySelector("canvas");
      if (!canvas) {
        logError("No canvas found in container");
        return null;
      }

      // Store original colours before any palette system can override them
      var originalColours = null;
      if (config.data && config.data.datasets && config.data.datasets[0]) {
        originalColours = {
          backgroundColor: config.data.datasets[0].backgroundColor,
          borderColor: config.data.datasets[0].borderColor,
        };
      }

      // Apply Ally-specific chart defaults
      applyAllyChartDefaults(config);

      // Store the chart config for controls (needed by ChartControls)
      container.setAttribute(
        "data-chart-code",
        encodeURIComponent(JSON.stringify(config)),
      );

      // Create chart instance directly
      var chartInstance = new Chart(canvas, config);

      // Generate a unique chart ID for controls
      var chartId =
        container.id || "ally-chart-" + Date.now() + "-" + chartIndex;

      // Integrate chart controls (theme selector, export buttons, etc.)
      integrateChartControls(
        container,
        canvas,
        chartInstance,
        chartId,
        chartIndex,
        originalColours,
      );

      logDebug("Chart rendered with controls: " + chartType);
      return {
        instance: chartInstance,
        container: container,
        type: chartType,
        chartId: chartId,
        originalColours: originalColours,
      };
    } catch (error) {
      logError("Failed to render chart: " + error.message, error);
      return null;
    }
  }

  /**
   * Applies Ally-specific styling defaults to chart config
   * @param {Object} config - Chart.js configuration
   */
  function applyAllyChartDefaults(config) {
    config.options = config.options || {};
    config.options.responsive = true;
    config.options.maintainAspectRatio = false;

    // Ensure plugins object exists
    config.options.plugins = config.options.plugins || {};

    // Style the legend for better readability
    config.options.plugins.legend = config.options.plugins.legend || {};
    config.options.plugins.legend.labels =
      config.options.plugins.legend.labels || {};
    config.options.plugins.legend.labels.color = "#212529";
    config.options.plugins.legend.labels.font = { size: 12 };

    // Style the title
    if (config.options.plugins.title) {
      config.options.plugins.title.color = "#212529";
      config.options.plugins.title.font =
        config.options.plugins.title.font || {};
      config.options.plugins.title.font.size = 14;
      config.options.plugins.title.font.weight = "600";
    }

    // Style scales (for bar/line charts)
    if (config.options.scales) {
      Object.keys(config.options.scales).forEach(function (axis) {
        var scale = config.options.scales[axis];
        scale.ticks = scale.ticks || {};
        scale.ticks.color = "#495057";
        scale.grid = scale.grid || {};
        scale.grid.color = "rgba(0, 0, 0, 0.1)";
        if (scale.title) {
          scale.title.color = "#212529";
        }
      });
    }
  }

  /**
   * Integrates existing chart control systems
   * @param {HTMLElement} container - Chart container
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {Chart} chartInstance - Chart.js instance
   * @param {string} chartId - Unique chart ID
   * @param {number} chartIndex - Chart index for view controls
   */
  function integrateChartControls(
    container,
    canvas,
    chartInstance,
    chartId,
    chartIndex,
  ) {
    // Mark container to prevent auto-detection by mutation observers
    container.setAttribute("data-ally-managed", "true");

    // Add ChartViewControls (expand width, fullscreen)
    if (
      typeof ChartViewControls !== "undefined" &&
      ChartViewControls.addViewControlsToContainer
    ) {
      try {
        ChartViewControls.addViewControlsToContainer(container, chartIndex);
        logDebug("View controls added for chart: " + chartId);
      } catch (e) {
        logWarn("Failed to add view controls: " + e.message);
      }
    }

    // Add ChartControls (theme selector, copy code, save PNG, CSV, data table, description)
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
        // Small delay to ensure controls are fully rendered
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

  // ========================================================================
  // Public API
  // ========================================================================

  var publicAPI = {
    /**
     * Renders charts for the given result data
     * @param {Object} result - API result object { metadata, data }
     * @param {string} endpoint - Endpoint name ('overall' or 'issues')
     */
    render: function (result, endpoint) {
      if (!validateDependencies()) {
        logError("Cannot render charts: missing dependencies");
        return;
      }

      if (!result || !result.data || result.data.length === 0) {
        logWarn("No data available for chart rendering");
        var container = document.getElementById(CONFIG.containerId);
        if (container) {
          container.innerHTML =
            '<p class="ally-no-results">No data available for chart visualisation.</p>';
        }
        return;
      }

      // Destroy existing charts first
      this.destroy();

      var container = document.getElementById(CONFIG.containerId);
      if (!container) {
        logError("Chart container not found: " + CONFIG.containerId);
        return;
      }

      // Determine applicable charts
      var chartTypes = getApplicableCharts(result, endpoint);
      logDebug(
        "Applicable charts for " + endpoint + ": " + chartTypes.join(", "),
      );

      // Generate container HTML
      container.innerHTML = generateChartContainerHtml(
        chartTypes,
        result,
        endpoint,
      );

      // Render each chart
      chartTypes.forEach(function (chartType, index) {
        // Find the container for this chart type
        var chartContainer = container.querySelector(
          '[data-chart-type="' + chartType + '"]',
        );

        if (chartContainer) {
          var chartInfo = renderChart(chartType, result, chartContainer, index);
          if (chartInfo) {
            activeCharts.push(chartInfo);
            logDebug("Rendered chart: " + chartType);
          }
        }
      });

      logInfo(
        "Rendered " + activeCharts.length + " charts for " + endpoint + " data",
      );

      // Announce to screen readers
      if (typeof ALLY_UI_MANAGER !== "undefined" && ALLY_UI_MANAGER.announce) {
        ALLY_UI_MANAGER.announce(
          activeCharts.length +
            " charts rendered showing accessibility data visualisation",
        );
      }
    },

    /**
     * Destroys all active charts
     */
    destroy: function () {
      activeCharts.forEach(function (chartInfo) {
        try {
          if (
            chartInfo.instance &&
            typeof chartInfo.instance.destroy === "function"
          ) {
            chartInfo.instance.destroy();
          }
        } catch (e) {
          logWarn("Error destroying chart: " + e.message);
        }
      });

      activeCharts = [];
      logDebug("All charts destroyed");
    },

    /**
     * Gets the number of active charts
     * @returns {number} Active chart count
     */
    getActiveChartCount: function () {
      return activeCharts.length;
    },

    // ========================================================================
    // Data Processing Methods (exposed for testing)
    // ========================================================================

    /**
     * Calculates score distribution
     * @param {Array} data - Data array
     * @param {string} scoreField - Score field name
     * @returns {Object} Distribution data
     */
    calculateScoreDistribution: calculateScoreDistribution,

    /**
     * Calculates average scores
     * @param {Array} data - Data array
     * @returns {Object} Average scores
     */
    calculateAverageScores: calculateAverageScores,

    /**
     * Calculates issue severity totals
     * @param {Array} data - Data array
     * @returns {Object} Severity totals
     */
    calculateIssueSeverityTotals: calculateIssueSeverityTotals,

    /**
     * Gets top issues
     * @param {Array} data - Data array
     * @param {number} n - Number of issues
     * @returns {Array} Top issues
     */
    getTopIssues: getTopIssues,

    /**
     * Gets applicable chart types
     * @param {Object} result - Result object
     * @param {string} endpoint - Endpoint type
     * @returns {string[]} Chart types
     */
    getApplicableCharts: getApplicableCharts,

    /**
     * Gets configuration object (read-only)
     * @returns {Object} Configuration copy
     */
    getConfig: function () {
      return Object.assign({}, CONFIG);
    },
  };

  // Log initialisation
  logInfo("ALLY_CHART_RENDERER initialised");

  return publicAPI;
})();

// Expose globally
if (typeof window !== "undefined") {
  window.ALLY_CHART_RENDERER = ALLY_CHART_RENDERER;
}
