/**
 * Graph Builder Charts
 * Handles chart creation, preview, and configuration management
 *
 * Dependencies:
 * - Chart.js (chart rendering)
 * - ChartBuilderState (chart state management)
 * - ChartAccessibility (accessibility features)
 * - ChartControls (chart controls)
 * - GraphBuilderNotifications (user feedback)
 *
 * @version 1.0.0
 */

const GraphBuilderCharts = (function () {
  "use strict";

  // Logging configuration (inside module scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  let currentLogLevel = DEFAULT_LOG_LEVEL;

  // Helper functions for logging
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Graph Builder Charts] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Graph Builder Charts] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.info(`[Graph Builder Charts] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Graph Builder Charts] DEBUG: ${message}`, ...args);
    }
  }

  // Configuration
  const CONFIG = {
    supportedChartTypes: [
      "bar",
      "line",
      "pie",
      "doughnut",
      "scatter",
      "bubble",
      "radar",
      "polarArea",
    ],
    defaultColourPalette: [
      "#005c84",
      "#005051",
      "#495961",
      "#8D3970",
      "#D5007F",
      "#002e3b",
    ],
    previewDimensions: {
      width: 400,
      height: 300,
    },
    finalChartConstraints: {
      maxWidth: "800px",
      margin: "0 auto",
    },
  };

  // Chart instances registry
  const chartRegistry = {
    preview: null,
    final: null,
  };

  /**
   * Chart Configuration Builder
   * Creates Chart.js configurations for different chart types
   */
  class ChartConfigBuilder {
    /**
     * Build chart configuration
     * @param {Object} data - Chart data
     * @param {string} chartType - Chart type
     * @param {Object} options - Configuration options
     * @returns {Object} Chart.js configuration
     */
    build(data, chartType, options = {}) {
      logDebug("Building chart configuration", { chartType, options });

      const {
        title = "Chart Title",
        xAxisTitle = data.headers?.[0] || "X Axis",
        yAxisTitle = data.headers?.[1] || "Y Axis",
        showLegend = true,
        showGrid = true,
        colourScheme = "default",
      } = options;

      // Prepare data for Chart.js
      const labels = data.rows.map((row) => row[0]);
      const values = data.rows.map((row) => row[1]);

      let datasets;
      if (["pie", "doughnut", "polarArea"].includes(chartType)) {
        datasets = [
          {
            data: values,
            backgroundColor: this.getColours(values.length, colourScheme),
          },
        ];
      } else {
        datasets = [
          {
            label: yAxisTitle,
            data: values,
            backgroundColor: this.getColours(values.length, colourScheme),
            borderColor: "#005c84",
            borderWidth: 1,
          },
        ];
      }

      const config = {
        type: chartType,
        data: {
          labels: labels,
          datasets: datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 2,
          layout: {
            padding: {
              top: 10,
              bottom: 10,
              left: 10,
              right: 10,
            },
          },
          plugins: {
            title: {
              display: true,
              text: title,
              font: { size: 16 },
            },
            legend: {
              display: showLegend,
              position: this.getLegendPosition(chartType),
            },
          },
        },
      };

      // Add scales for appropriate chart types
      if (!["pie", "doughnut", "polarArea", "radar"].includes(chartType)) {
        config.options.scales = {
          x: {
            title: { display: true, text: xAxisTitle },
            grid: { display: showGrid },
          },
          y: {
            title: { display: true, text: yAxisTitle },
            grid: { display: showGrid },
          },
        };
      }

      logDebug("Chart configuration built successfully");
      return config;
    }

    /**
     * Get colour palette
     * @param {number} count - Number of colours needed
     * @param {string} scheme - Colour scheme name
     * @returns {Array} Array of colour values
     */
    getColours(count, scheme = "default") {
      logDebug(`Getting colour palette: ${scheme} with ${count} colours`);

      let palette;

      switch (scheme) {
        case "accessible-blue":
          palette = [
            "#003f5c",
            "#2f4b7c",
            "#665191",
            "#a05195",
            "#d45087",
            "#f95d6a",
          ];
          break;
        case "high-contrast":
          palette = [
            "#000000",
            "#FFFFFF",
            "#FF0000",
            "#00FF00",
            "#0000FF",
            "#FFFF00",
          ];
          break;
        case "warm":
          palette = [
            "#8B4513",
            "#CD853F",
            "#DEB887",
            "#F4A460",
            "#D2691E",
            "#A0522D",
          ];
          break;
        case "cool":
          palette = [
            "#4682B4",
            "#5F9EA0",
            "#87CEEB",
            "#B0C4DE",
            "#87CEFA",
            "#6495ED",
          ];
          break;
        default:
          palette = CONFIG.defaultColourPalette;
      }

      const colours = [];
      for (let i = 0; i < count; i++) {
        colours.push(palette[i % palette.length]);
      }

      return colours;
    }

    /**
     * Get appropriate legend position for chart type
     * @param {string} chartType - Chart type
     * @returns {string} Legend position
     */
    getLegendPosition(chartType) {
      if (["pie", "doughnut", "polarArea"].includes(chartType)) {
        return "right";
      }
      return "top";
    }
  }

  /**
   * Chart Preview Manager
   * Handles chart preview functionality
   */
  class ChartPreviewManager {
    constructor() {
      logDebug("Initialising ChartPreviewManager");
      this.container = document.getElementById("gb-chart-preview");
      this.configBuilder = new ChartConfigBuilder();

      if (this.container) {
        logInfo("Chart preview container found and initialised");
      } else {
        logWarn("Chart preview container not found");
      }
    }

    /**
     * Update chart preview
     * @param {Object} data - Chart data
     * @param {string} chartType - Chart type
     * @param {Object} options - Chart options
     */
    update(data, chartType, options = {}) {
      if (!data || !chartType || !this.container) {
        logWarn(
          "Cannot update preview: missing data, chart type, or container"
        );
        return;
      }

      try {
        logInfo("Updating chart preview", { chartType });

        // Destroy existing preview chart
        this.destroy();

        // Clear and recreate preview container
        this.container.innerHTML = "";

        // Create canvas with unique ID
        const previewId = `gb-preview-${Date.now()}`;
        const canvas = document.createElement("canvas");
        canvas.id = previewId;
        canvas.width = CONFIG.previewDimensions.width;
        canvas.height = CONFIG.previewDimensions.height;
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", "Chart preview");

        this.container.appendChild(canvas);

        // Get configuration
        const config = this.configBuilder.build(data, chartType, options);

        // Add preview-specific options
        config.options = {
          ...config.options,
          responsive: false,
          maintainAspectRatio: true,
          animation: {
            duration: 0, // Disable animations for better performance
          },
        };

        // Create preview chart
        chartRegistry.preview = new Chart(canvas, config);
        logInfo("Preview chart created successfully", { id: previewId });
      } catch (error) {
        logError("Preview creation failed:", error);
        this.container.innerHTML = `
            <div style="color: #D5007F; text-align: center; padding: 2rem;">
              <p>Preview unavailable</p>
              <small>${error.message}</small>
            </div>
          `;
      }
    }

    /**
     * Destroy preview chart
     */
    destroy() {
      if (chartRegistry.preview) {
        logDebug("Destroying preview chart");
        chartRegistry.preview.destroy();
        chartRegistry.preview = null;
      }
    }

    /**
     * Get current preview chart instance
     * @returns {Object|null} Chart instance
     */
    getInstance() {
      return chartRegistry.preview;
    }
  }

  /**
   * Final Chart Creator
   * Handles creation of the final accessible chart
   */
  class FinalChartCreator {
    constructor() {
      logDebug("Initialising FinalChartCreator");
      this.container = document.getElementById("gb-final-chart");
      this.configBuilder = new ChartConfigBuilder();

      if (this.container) {
        logInfo("Final chart container found and initialised");
      } else {
        logWarn("Final chart container not found");
      }
    }

    /**
     * Create final chart with accessibility features
     * @param {Object} data - Chart data
     * @param {string} chartType - Chart type
     * @param {Object} options - Chart options
     * @returns {Promise<Object>} Chart creation result
     */
    async create(data, chartType, options = {}) {
      if (!this.container) {
        const error = "Final chart container not found";
        logError(error);
        throw new Error(error);
      }

      try {
        logInfo("Creating final chart", { chartType, title: options.title });

        // Clean up any existing final chart
        this.destroy();

        // Prepare container
        this.prepareContainer();

        // Use ChartBuilderState for full integration
        await this.createUsingChartBuilderState(data, chartType, options);

        // Initialize accessibility features
        await this.initializeAccessibilityFeatures();

        logInfo("Final chart creation completed successfully");
        return {
          success: true,
          container: this.container,
          sizingApplied:
            typeof window.GraphBuilderSizingIntegration !== "undefined",
          sizingStatus: this.getSizingStatus(),
        };
      } catch (error) {
        logError("Final chart creation failed:", error);
        throw error;
      }
    }

    /**
     * Get the current sizing status for debugging
     * NEW METHOD: Provides sizing integration status
     */
    getSizingStatus() {
      try {
        const gbContainer =
          this.container.closest(".gb-final-chart-container") ||
          this.container.querySelector(".gb-final-chart-container");

        if (!gbContainer) {
          return {
            status: "no-container",
            message: "No Graph Builder container found",
          };
        }

        const controls = gbContainer.querySelector(".chart-view-controls");
        if (!controls) {
          return {
            status: "no-controls",
            message: "No chart view controls found",
          };
        }

        const currentPadding = gbContainer.style.paddingTop || "none";
        const controlsHeight = controls.getBoundingClientRect().height;

        return {
          status: "ready",
          container: gbContainer.id || "unnamed",
          currentPadding: currentPadding,
          controlsHeight: controlsHeight + "px",
          controlsPresent: true,
          integrationAvailable:
            typeof window.GraphBuilderSizingIntegration !== "undefined",
        };
      } catch (error) {
        return { status: "error", message: error.message };
      }
    }

    /**
     * Prepare the final chart container
     */
    prepareContainer() {
      logDebug("Preparing final chart container");

      // Clear existing content
      this.container.innerHTML = "";

      // Apply styling constraints - FIXED: No max-width inline style
      this.container.style.cssText = `
      width: 100%;
      margin: ${CONFIG.finalChartConstraints.margin};
      position: relative;
    `;

      // Apply max-width via CSS class instead of inline style
      // This allows ChartViewControls to override it with .expanded class
      if (!this.container.classList.contains("gb-chart-constrained")) {
        this.container.classList.add("gb-chart-constrained");
      }

      // Ensure container has required classes
      if (!this.container.classList.contains("chart-container")) {
        this.container.classList.add("chart-container");
      }

      logDebug("Container prepared successfully - width toggle compatible");
    }

    /**
     * Create chart using ChartBuilderState integration - ENHANCED VERSION
     * @param {Object} data - Chart data
     * @param {string} chartType - Chart type
     * @param {Object} options - Chart options
     */
    async createUsingChartBuilderState(data, chartType, options) {
      logDebug("Creating chart via enhanced ChartBuilderState integration");

      // Start the chart builder workflow
      await ChartBuilderState.startNewChart({
        chartType: chartType,
        author: "Graph Builder User",
        title: options.title || "Chart",
      });

      // Set data source
      await ChartBuilderState.setDataSource(data);

      // Update chart configuration with enhanced handling
      const config = this.configBuilder.build(data, chartType, options);
      logDebug("Built configuration for ChartBuilderState:", config);

      // Strategy A: Standard ChartBuilderState.updateChartConfig
      try {
        await ChartBuilderState.updateChartConfig(config.options);
        logDebug("Standard ChartBuilderState.updateChartConfig completed");
      } catch (error) {
        logWarn("Standard updateChartConfig failed:", error);
      }

      // Strategy B: Enhanced internal state manipulation (if accessible)
      try {
        if (
          ChartBuilderState._state &&
          typeof ChartBuilderState._state === "object"
        ) {
          // Merge our configuration into the internal state
          if (!ChartBuilderState._state.chartConfig) {
            ChartBuilderState._state.chartConfig = {};
          }

          // Apply our specific configuration values
          Object.assign(ChartBuilderState._state.chartConfig, {
            plugins: {
              ...ChartBuilderState._state.chartConfig.plugins,
              title: {
                display: true,
                text: options.title || "Chart",
              },
              legend: {
                display: options.showLegend !== false,
              },
            },
            scales: {
              ...ChartBuilderState._state.chartConfig.scales,
              x: {
                ...ChartBuilderState._state.chartConfig.scales?.x,
                title: {
                  display: true,
                  text: options.xAxisTitle || "X Axis",
                },
                grid: {
                  display: options.showGrid !== false,
                },
              },
              y: {
                ...ChartBuilderState._state.chartConfig.scales?.y,
                title: {
                  display: true,
                  text: options.yAxisTitle || "Y Axis",
                },
                grid: {
                  display: options.showGrid !== false,
                },
              },
            },
          });

          logDebug("Enhanced internal state manipulation completed");
        }
      } catch (error) {
        logWarn("Enhanced state manipulation failed:", error);
      }

      // Configure accessibility
      ChartBuilderState.configureAccessibility({
        generateDescriptions: true,
        includeDataTable: true,
        includeStatistics: true,
      });

      // Generate final chart
      const result = await ChartBuilderState.generateChart(this.container);

      if (!result || !result.chartInstance) {
        throw new Error("Chart generation failed - no chart instance returned");
      }

      const chartInstance = result.chartInstance;
      logDebug("Chart generated via ChartBuilderState");

      // CRITICAL ENHANCEMENT: Post-generation configuration override
      // This ensures configuration is applied regardless of ChartBuilderState issues
      try {
        logDebug("Applying post-generation configuration fixes");

        const chartOptions = chartInstance.options;

        // Ensure plugins object exists
        if (!chartOptions.plugins) chartOptions.plugins = {};

        // Fix title
        if (!chartOptions.plugins.title) chartOptions.plugins.title = {};
        chartOptions.plugins.title.display = true;
        chartOptions.plugins.title.text = options.title || "Chart";

        // Fix legend
        if (!chartOptions.plugins.legend) chartOptions.plugins.legend = {};
        chartOptions.plugins.legend.display = options.showLegend !== false;

        // Ensure scales object exists
        if (!chartOptions.scales) chartOptions.scales = {};

        // Fix X-axis
        if (!chartOptions.scales.x) chartOptions.scales.x = {};
        if (!chartOptions.scales.x.title) chartOptions.scales.x.title = {};
        chartOptions.scales.x.title.display = true;
        chartOptions.scales.x.title.text = options.xAxisTitle || "X Axis";
        if (!chartOptions.scales.x.grid) chartOptions.scales.x.grid = {};
        chartOptions.scales.x.grid.display = options.showGrid !== false;

        // Fix Y-axis
        if (!chartOptions.scales.y) chartOptions.scales.y = {};
        if (!chartOptions.scales.y.title) chartOptions.scales.y.title = {};
        chartOptions.scales.y.title.display = true;
        chartOptions.scales.y.title.text = options.yAxisTitle || "Y Axis";
        if (!chartOptions.scales.y.grid) chartOptions.scales.y.grid = {};
        chartOptions.scales.y.grid.display = options.showGrid !== false;

        // Force chart update to apply configuration changes
        chartInstance.update("none"); // 'none' for immediate update without animation

        logDebug("Post-generation configuration fixes applied successfully");
        logInfo("Final chart configuration applied:", {
          title: chartOptions.plugins.title.text,
          xAxis: chartOptions.scales.x.title.text,
          yAxis: chartOptions.scales.y.title.text,
          legend: chartOptions.plugins.legend.display,
          grid: chartOptions.scales.x.grid.display,
        });
      } catch (error) {
        logWarn("Post-generation configuration fixes failed:", error);
      }

      // ENHANCEMENT: Update chart registry properly
      try {
        chartRegistry.final = chartInstance;
        logDebug("Chart registry updated successfully");
      } catch (error) {
        logWarn("Chart registry update failed:", error);
      }

      logInfo(
        "Enhanced chart creation completed successfully via ChartBuilderState"
      );
    }

    /**
     * Initialize accessibility features for the chart
     */
    async initializeAccessibilityFeatures() {
      try {
        logInfo("Initialising accessibility features");

        const chartId = `gb-chart-${Date.now()}`;

        // Add chart controls if available
        if (window.ChartControls?.addControlsToContainer) {
          logDebug("Adding chart controls");
          window.ChartControls.addControlsToContainer(this.container, chartId);
        } else {
          logWarn("ChartControls not available");
        }

        // Small delay to ensure controls are initialized
        await new Promise((resolve) => setTimeout(resolve, 200));
        // Apply Graph Builder specific sizing adjustments
        await this.applyGraphBuilderSizing();

        // Initialize accessibility features if available
        if (window.ChartAccessibility?.initAccessibilityFeatures) {
          logDebug("Initialising ChartAccessibility features");
          window.ChartAccessibility.initAccessibilityFeatures(
            this.container,
            chartId
          );

          // Verify accessibility features were added
          await this.verifyAccessibilityFeatures();
        } else {
          logWarn("ChartAccessibility not available");
        }

        logInfo("Accessibility initialisation completed");
      } catch (error) {
        logWarn("Accessibility initialisation encountered issues:", error);
        // Don't throw - chart is still functional
        if (window.GraphBuilderNotifications?.warning) {
          GraphBuilderNotifications.warning(
            "Chart created with limited accessibility features"
          );
        }
      }
    }

    /**
     * Verify accessibility features were properly added
     */
    async verifyAccessibilityFeatures() {
      logDebug("Verifying accessibility features");

      // Give features time to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));

      const csvButton = this.container.querySelector(
        '[aria-label*="CSV"], [aria-label*="csv"]'
      );
      const tableButton = this.container.querySelector(
        '[aria-label*="table"], [aria-label*="Table"]'
      );
      const descButton = this.container.querySelector(
        '[aria-label*="description"], [aria-label*="Description"]'
      );

      const allControlButtons = this.container.querySelectorAll(
        ".chart-control-button"
      );

      logDebug("Accessibility verification results:", {
        csvButton: !!csvButton,
        tableButton: !!tableButton,
        descButton: !!descButton,
        totalButtons: allControlButtons.length,
      });

      if (csvButton && tableButton && descButton) {
        if (window.GraphBuilderNotifications?.success) {
          GraphBuilderNotifications.success(
            "Chart with full accessibility features created successfully!"
          );
        }
        logInfo("Full accessibility features verified");
      } else if (allControlButtons.length > 0) {
        if (window.GraphBuilderNotifications?.success) {
          GraphBuilderNotifications.success(
            "Chart created with accessibility features"
          );
        }
        logInfo("Partial accessibility features verified");
      } else {
        logWarn("No accessibility features detected in verification");
      }
    }

    /**
     * Apply Graph Builder specific sizing adjustments
     * NEW METHOD: Integrates with GraphBuilderSizingIntegration
     */
    async applyGraphBuilderSizing() {
      logDebug("Applying Graph Builder sizing adjustments");

      try {
        // Check if GraphBuilderSizingIntegration is available
        if (typeof window.GraphBuilderSizingIntegration !== "undefined") {
          // Ensure the integration is initialized
          if (!window.GraphBuilderSizingIntegration.isInitialised()) {
            logDebug("Initializing GraphBuilderSizingIntegration");
            window.GraphBuilderSizingIntegration.init();
          }

          // Apply sizing adjustments to the final chart container
          const gbContainer =
            this.container.closest(".gb-final-chart-container") ||
            this.container.querySelector(".gb-final-chart-container");

          if (gbContainer) {
            logDebug("Applying sizing adjustment to Graph Builder container");

            // Schedule immediate adjustment
            window.GraphBuilderSizingIntegration.scheduleAdjustment(
              gbContainer
            );

            // Also schedule a delayed adjustment to catch any late-rendering controls
            setTimeout(() => {
              window.GraphBuilderSizingIntegration.adjustGraphBuilderContainerPadding(
                gbContainer
              );
            }, 100);

            logInfo("Graph Builder sizing adjustments applied successfully");
          } else {
            logDebug("No Graph Builder container found for sizing adjustment");
          }
        } else {
          logWarn("GraphBuilderSizingIntegration not available");
        }
      } catch (error) {
        logWarn("Graph Builder sizing adjustment failed:", error);
      }
    }

    /**
     * Destroy final chart
     */
    destroy() {
      logDebug("Destroying final chart and cleaning up");

      // Destroy Chart.js instances in container
      if (this.container) {
        const canvases = this.container.querySelectorAll("canvas");
        canvases.forEach((canvas) => {
          const chartInstance = Chart.getChart(canvas);
          if (chartInstance) {
            logDebug("Destroying chart instance:", chartInstance.id);
            chartInstance.destroy();
          }
        });

        // Clear container
        this.container.innerHTML = "";
      }

      if (chartRegistry.final) {
        chartRegistry.final = null;
      }

      logDebug("Final chart cleanup completed");
    }

    /**
     * Get current final chart instance
     * @returns {Object|null} Chart instance
     */
    getInstance() {
      return chartRegistry.final;
    }
  }

  /**
   * Chart Validator
   * Validates chart data and configuration
   */
  class ChartValidator {
    /**
     * Validate data for chart creation
     * @param {Object} data - Chart data to validate
     * @param {string} chartType - Chart type
     * @returns {Object} Validation result
     */
    validateData(data, chartType) {
      logDebug("Validating chart data", { chartType });

      const errors = [];
      const warnings = [];

      // Basic data validation
      if (!data || !data.rows || !data.headers) {
        const error = "Invalid data structure";
        logWarn(error);
        errors.push(error);
        return { valid: false, errors, warnings };
      }

      if (data.rows.length === 0) {
        const error = "No data rows provided";
        logWarn(error);
        errors.push(error);
        return { valid: false, errors, warnings };
      }

      // Chart type specific validation
      switch (chartType) {
        case "pie":
        case "doughnut":
        case "polarArea":
          if (data.rows.length < 2) {
            const error = "Pie charts require at least 2 data points";
            logWarn(error);
            errors.push(error);
          }
          break;

        case "scatter":
        case "bubble":
          if (data.headers.length < 2) {
            const error = "Scatter charts require at least 2 columns";
            logWarn(error);
            errors.push(error);
          }
          break;

        case "line":
          if (data.rows.length < 2) {
            const error = "Line charts require at least 2 data points";
            logWarn(error);
            errors.push(error);
          }
          break;
      }

      // Check for valid numeric data in second column
      const numericValues = data.rows.filter(
        (row) => row.length >= 2 && !isNaN(parseFloat(row[1]))
      );

      if (numericValues.length === 0) {
        const error = "No valid numeric data found in second column";
        logWarn(error);
        errors.push(error);
      } else if (numericValues.length < data.rows.length) {
        const warning = `${
          data.rows.length - numericValues.length
        } rows have non-numeric values`;
        logWarn(warning);
        warnings.push(warning);
      }

      const result = {
        valid: errors.length === 0,
        errors,
        warnings,
        validRowCount: numericValues.length,
      };

      logDebug("Data validation completed", result);
      return result;
    }

    /**
     * Validate chart type support
     * @param {string} chartType - Chart type to validate
     * @returns {boolean} Whether chart type is supported
     */
    validateChartType(chartType) {
      const isSupported = CONFIG.supportedChartTypes.includes(chartType);

      if (!isSupported) {
        logWarn(`Unsupported chart type: ${chartType}`);
      }

      return isSupported;
    }
  }

  /**
   * Hook into Stage 4 activation to trigger sizing adjustments
   * This should be called when Graph Builder switches to the results screen
   */
  function hookIntoStage4Activation() {
    logDebug("Setting up Stage 4 activation hook");

    // Watch for Stage 4 becoming active
    const gbResult = document.getElementById("gb-result");
    if (gbResult) {
      // Create observer for class changes (Stage 4 activation)
      const stageObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "class"
          ) {
            const target = mutation.target;
            if (
              target.classList.contains("active") &&
              target.id === "gb-result"
            ) {
              logInfo("Stage 4 activated, applying sizing adjustments");

              // Apply sizing adjustments with multiple retries for robustness
              setTimeout(() => applyMultipleRetryAdjustments(), 50);
              setTimeout(() => applyMultipleRetryAdjustments(), 200);
              setTimeout(() => applyMultipleRetryAdjustments(), 500);
            }
          }
        });
      });

      stageObserver.observe(gbResult, {
        attributes: true,
        attributeFilter: ["class"],
      });

      logInfo("Stage 4 activation hook installed successfully");
    } else {
      logWarn("GB Result element not found, Stage 4 hook not installed");
    }
  }

  /**
   * Apply sizing adjustments with multiple retries
   * Ensures charts get proper sizing even if controls load asynchronously
   */
  function applyMultipleRetryAdjustments() {
    try {
      logDebug("Applying multiple retry adjustments");

      // Method 1: Use GraphBuilderSizingIntegration if available
      if (typeof window.GraphBuilderSizingIntegration !== "undefined") {
        window.GraphBuilderSizingIntegration.adjustAllGraphBuilderCharts();
        logDebug("Applied adjustments via GraphBuilderSizingIntegration");
      }

      // Method 2: Use ChartControls if available
      if (
        typeof window.ChartControls !== "undefined" &&
        window.ChartControls.adjustAllChartContainers
      ) {
        window.ChartControls.adjustAllChartContainers();
        logDebug("Applied adjustments via ChartControls");
      }

      // Method 3: Direct adjustment as fallback
      const gbContainers = document.querySelectorAll(
        ".gb-final-chart-container"
      );
      gbContainers.forEach((container, index) => {
        const controls = container.querySelector(".chart-view-controls");
        if (controls && controls.getBoundingClientRect().height > 0) {
          const controlsHeight = controls.getBoundingClientRect().height;
          const newPadding = Math.ceil(controlsHeight) + 20 + "px";
          container.style.paddingTop = newPadding;
          logDebug(
            `Applied fallback padding to container ${index + 1}: ${newPadding}`
          );
        }
      });
    } catch (error) {
      logWarn("Sizing adjustment failed:", error);
    }
  }

  // ==========================================
  // INITIALIZATION SETUP
  // Location: Add this initialization code after the functions above
  // ==========================================

  /**
   * Initialize the Stage 4 hook system
   * This should be called when the module loads
   */
  function initializeStage4Hook() {
    logDebug("Initializing Stage 4 hook system");

    // Set up the hook immediately if DOM is ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", hookIntoStage4Activation);
    } else {
      // DOM is already ready
      hookIntoStage4Activation();
    }

    // Also set up immediate sizing check for existing charts
    setTimeout(() => {
      const gbContainers = document.querySelectorAll(
        ".gb-final-chart-container"
      );
      if (gbContainers.length > 0) {
        logInfo(
          `Found ${gbContainers.length} existing GB containers, applying initial sizing`
        );
        applyMultipleRetryAdjustments();
      }
    }, 100);
  }

  // Call the initialization
  initializeStage4Hook();

  // Create instances
  const configBuilder = new ChartConfigBuilder();
  const previewManager = new ChartPreviewManager();
  const finalChartCreator = new FinalChartCreator();
  const validator = new ChartValidator();

  // Module initialisation message
  logInfo("Graph Builder Charts module initialised successfully");

  // Public API
  return {
    // Chart Creation
    createFinalChart: (data, chartType, options) =>
      finalChartCreator.create(data, chartType, options),

    // Preview Management
    updatePreview: (data, chartType, options) =>
      previewManager.update(data, chartType, options),
    destroyPreview: () => previewManager.destroy(),
    getPreviewInstance: () => previewManager.getInstance(),

    // Configuration
    buildConfig: (data, chartType, options) =>
      configBuilder.build(data, chartType, options),

    // Validation
    validateData: (data, chartType) => validator.validateData(data, chartType),
    validateChartType: (chartType) => validator.validateChartType(chartType),

    // Cleanup
    destroyAllCharts: () => {
      logInfo("Destroying all charts");
      previewManager.destroy();
      finalChartCreator.destroy();
    },

    // Chart Instances
    getChartRegistry: () => ({ ...chartRegistry }),

    // Configuration Access
    getConfig: () => ({ ...CONFIG }),
    getSupportedTypes: () => [...CONFIG.supportedChartTypes],

    // ==========================================
    // NEW: Graph Builder Sizing Integration API
    // ==========================================

    // Test Graph Builder sizing functionality
    testGraphBuilderSizing: function () {
      console.log("=== Graph Builder Charts Sizing Test ===");

      // Test final chart container
      if (finalChartCreator.container) {
        console.log(
          "Final chart container found:",
          finalChartCreator.container
        );

        const sizingStatus = finalChartCreator.getSizingStatus();
        console.log("Sizing status:", sizingStatus);

        // Test sizing application
        finalChartCreator.applyGraphBuilderSizing();

        setTimeout(() => {
          const updatedStatus = finalChartCreator.getSizingStatus();
          console.log("Updated sizing status:", updatedStatus);
        }, 200);
      } else {
        console.log("No final chart container found");
      }
    },

    // Get comprehensive sizing integration status
    getSizingIntegrationStatus: function () {
      return {
        integrationAvailable:
          typeof window.GraphBuilderSizingIntegration !== "undefined",
        integrationInitialized: window.GraphBuilderSizingIntegration
          ? window.GraphBuilderSizingIntegration.isInitialised()
          : false,
        finalChartContainer: document.getElementById("gb-final-chart") !== null,
        chartViewControlsPresent:
          document.querySelector(
            ".gb-final-chart-container .chart-view-controls"
          ) !== null,
        gbResultScreen: document.getElementById("gb-result") !== null,
        gbResultActive:
          document.getElementById("gb-result")?.classList.contains("active") ||
          false,
        // Additional diagnostics
        gbContainerCount: document.querySelectorAll(".gb-final-chart-container")
          .length,
        chartControlsCount: document.querySelectorAll(
          ".gb-final-chart-container .chart-view-controls"
        ).length,
      };
    },

    // Apply Graph Builder sizing manually (for testing/debugging)
    applySizingAdjustments: function () {
      logInfo("Manually applying Graph Builder sizing adjustments");

      try {
        // Method 1: Use GraphBuilderSizingIntegration if available
        if (typeof window.GraphBuilderSizingIntegration !== "undefined") {
          window.GraphBuilderSizingIntegration.adjustAllGraphBuilderCharts();
          logInfo("Applied sizing via GraphBuilderSizingIntegration");
        }

        // Method 2: Direct application via finalChartCreator
        if (finalChartCreator.applyGraphBuilderSizing) {
          finalChartCreator.applyGraphBuilderSizing();
          logInfo("Applied sizing via finalChartCreator");
        }

        // Method 3: Fallback direct adjustment
        const gbContainers = document.querySelectorAll(
          ".gb-final-chart-container"
        );
        gbContainers.forEach((container, index) => {
          const controls = container.querySelector(".chart-view-controls");
          if (controls && controls.getBoundingClientRect().height > 0) {
            const controlsHeight = controls.getBoundingClientRect().height;
            const newPadding = Math.ceil(controlsHeight) + 20 + "px";
            container.style.paddingTop = newPadding;
            logInfo(
              `Applied fallback padding to container ${
                index + 1
              }: ${newPadding}`
            );
          }
        });

        return true;
      } catch (error) {
        logError("Failed to apply sizing adjustments:", error);
        return false;
      }
    },

    // Get current sizing status for a specific container
    getContainerSizingStatus: function (containerId) {
      try {
        const container = containerId
          ? document.getElementById(containerId)
          : document.querySelector(".gb-final-chart-container");

        if (!container) {
          return { status: "not-found", message: "Container not found" };
        }

        const controls = container.querySelector(".chart-view-controls");
        const currentPadding = container.style.paddingTop || "none";
        const isGraphBuilderContainer =
          container.classList.contains("gb-final-chart-container") ||
          container.closest(".gb-final-chart-container") !== null;

        return {
          status: "found",
          containerId: container.id || "unnamed",
          isGraphBuilderContainer: isGraphBuilderContainer,
          hasControls: !!controls,
          controlsHeight: controls
            ? controls.getBoundingClientRect().height + "px"
            : "N/A",
          currentPadding: currentPadding,
          containerRect: container.getBoundingClientRect(),
          controlsRect: controls ? controls.getBoundingClientRect() : null,
          overlapDetected: controls
            ? this.detectControlsOverlap(container, controls)
            : false,
        };
      } catch (error) {
        return { status: "error", message: error.message };
      }
    },

    // Detect if controls are overlapping with chart content
    detectControlsOverlap: function (container, controls) {
      try {
        const containerRect = container.getBoundingClientRect();
        const controlsRect = controls.getBoundingClientRect();
        const currentPadding = parseInt(container.style.paddingTop) || 0;

        // Check if controls are positioned within the chart area
        const controlsBottom = controlsRect.bottom - containerRect.top;
        const requiredPadding = controlsBottom + 20; // 20px buffer

        return currentPadding < requiredPadding;
      } catch (error) {
        logWarn("Error detecting controls overlap:", error);
        return false;
      }
    },

    // Hook into Stage 4 activation (for external integration)
    onStage4Activation: function (callback) {
      const gbResult = document.getElementById("gb-result");
      if (gbResult && typeof callback === "function") {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (
              mutation.type === "attributes" &&
              mutation.attributeName === "class"
            ) {
              const target = mutation.target;
              if (
                target.classList.contains("active") &&
                target.id === "gb-result"
              ) {
                callback();
              }
            }
          });
        });

        observer.observe(gbResult, {
          attributes: true,
          attributeFilter: ["class"],
        });

        return observer; // Return observer so it can be disconnected if needed
      }
      return null;
    },

    // ==========================================
    // END: Graph Builder Sizing Integration API
    // ==========================================

    // Logging Control
    setLogLevel: (level) => {
      if (Object.values(LOG_LEVELS).includes(level)) {
        currentLogLevel = level;
        logInfo(`Logging level changed to ${Object.keys(LOG_LEVELS)[level]}`);
      } else {
        logWarn(`Invalid log level: ${level}`);
      }
    },

    // For debugging
    _instances: {
      configBuilder,
      previewManager,
      finalChartCreator,
      validator,
    },
  };
})();

// Export for other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = GraphBuilderCharts;
} else {
  window.GraphBuilderCharts = GraphBuilderCharts;
}

window.testGraphBuilderChartSizing = function () {
  console.log("=== Comprehensive Graph Builder Chart Sizing Test ===");

  // Test 1: Module availability
  console.log("1. Module availability:");
  console.log(
    "   GraphBuilderCharts:",
    typeof window.GraphBuilderCharts !== "undefined"
  );
  console.log(
    "   GraphBuilderSizingIntegration:",
    typeof window.GraphBuilderSizingIntegration !== "undefined"
  );

  // Test 2: Integration status
  if (
    typeof window.GraphBuilderCharts !== "undefined" &&
    window.GraphBuilderCharts.getSizingIntegrationStatus
  ) {
    console.log("2. Integration status:");
    const status = window.GraphBuilderCharts.getSizingIntegrationStatus();
    console.log("   Status:", status);
  }

  // Test 3: Chart container detection
  console.log("3. Container detection:");
  const gbContainers = document.querySelectorAll(".gb-final-chart-container");
  console.log(`   Found ${gbContainers.length} Graph Builder containers`);

  gbContainers.forEach((container, index) => {
    const controls = container.querySelector(".chart-view-controls");
    const currentPadding = container.style.paddingTop || "none";
    console.log(`   Container ${index + 1}:`, {
      id: container.id || "unnamed",
      hasControls: !!controls,
      controlsHeight: controls
        ? controls.getBoundingClientRect().height + "px"
        : "N/A",
      currentPadding: currentPadding,
    });
  });

  // Test 4: Manual sizing application
  console.log("4. Manual sizing application:");
  if (typeof window.GraphBuilderSizingIntegration !== "undefined") {
    window.GraphBuilderSizingIntegration.adjustAllGraphBuilderCharts();
    console.log(
      "   Applied sizing adjustments via GraphBuilderSizingIntegration"
    );
  }

  if (
    typeof window.GraphBuilderCharts !== "undefined" &&
    window.GraphBuilderCharts.testGraphBuilderSizing
  ) {
    window.GraphBuilderCharts.testGraphBuilderSizing();
    console.log("   Applied sizing adjustments via GraphBuilderCharts");
  }

  // Test 5: Verify changes
  setTimeout(() => {
    console.log("5. Post-adjustment verification:");
    const gbContainersAfter = document.querySelectorAll(
      ".gb-final-chart-container"
    );
    gbContainersAfter.forEach((container, index) => {
      console.log(
        `   Container ${index + 1} final padding: ${
          container.style.paddingTop || "none"
        }`
      );
    });
    console.log("=== Comprehensive test completed ===");
  }, 300);
};
