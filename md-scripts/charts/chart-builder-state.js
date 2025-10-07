/**
 * Chart Builder State Manager
 * Manages the entire chart building workflow and application state
 * Coordinates between data management, validation, and chart generation
 *
 * Dependencies:
 * - chart-data-manager.js (required)
 * - chart-accessibility.js (optional, for enhanced features)
 * - chart-controls.js (optional, for enhanced features)
 *
 * @version 1.0.0
 */

const ChartBuilderState = (function () {
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

  // Current logging level
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  // Helper functions for logging
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Chart Builder State] ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Chart Builder State] ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Chart Builder State] ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Chart Builder State] ${message}`, ...args);
    }
  }

  // Set logging level function
  function setLogLevel(level) {
    if (typeof level === "string") {
      level = LOG_LEVELS[level.toUpperCase()];
    }
    if (level >= LOG_LEVELS.ERROR && level <= LOG_LEVELS.DEBUG) {
      currentLogLevel = level;
      logInfo(
        `Logging level set to: ${Object.keys(LOG_LEVELS).find(
          (key) => LOG_LEVELS[key] === level
        )}`
      );
    } else {
      logWarn(`Invalid log level: ${level}. Using current level.`);
    }
  }

  // Configuration
  const CONFIG = {
    maxHistorySteps: 50,
    autoSaveInterval: 30000, // 30 seconds
    validationDebounceDelay: 500,
    templateStorageKey: "chart-builder-templates",
    stateStorageKey: "chart-builder-state",
    defaultChartType: "bar",
  };

  // Build step definitions
  const BuildSteps = {
    DATA_INPUT: "data-input",
    DATA_VALIDATION: "data-validation",
    CHART_TYPE: "chart-type",
    CHART_CONFIG: "chart-config",
    ACCESSIBILITY: "accessibility",
    PREVIEW: "preview",
    COMPLETE: "complete",
  };

  // Application states
  const AppStates = {
    IDLE: "idle",
    LOADING: "loading",
    BUILDING: "building",
    VALIDATING: "validating",
    GENERATING: "generating",
    ERROR: "error",
    COMPLETE: "complete",
  };

  // Event types for state changes
  const EventTypes = {
    STATE_CHANGE: "state-change",
    STEP_CHANGE: "step-change",
    DATA_CHANGE: "data-change",
    VALIDATION_CHANGE: "validation-change",
    CHART_CHANGE: "chart-change",
    ERROR: "error",
    SAVE: "save",
    LOAD: "load",
  };

  /**
   * Chart Builder State Manager
   * Central state management for the chart building application
   */
  class ChartBuilderState {
    constructor() {
      this.currentState = AppStates.IDLE;
      this.currentStep = BuildSteps.DATA_INPUT;
      this.buildHistory = [];
      this.undoStack = [];
      this.redoStack = [];
      this.autoSaveTimer = null;
      this.validationTimer = null;
      this.eventListeners = new Map();

      // Core building data
      this.buildData = {
        // Data management
        dataSource: null,
        dataModel: null,
        dataModelId: null,

        // Chart configuration
        chartType: CONFIG.defaultChartType,
        chartConfig: null,
        chartInstance: null,

        // User preferences and settings
        userPreferences: {
          theme: "default",
          accessibility: {
            generateDescriptions: true,
            includeDataTable: true,
            includeStatistics: true,
          },
          export: {
            includeCSV: true,
            includePNG: true,
          },
        },

        // Validation state
        validation: {
          data: { valid: false, errors: [], warnings: [] },
          chart: { valid: false, errors: [], warnings: [] },
          accessibility: { valid: true, errors: [], warnings: [] },
        },

        // Template information
        template: null,
        customisations: {},

        // Metadata
        metadata: {
          created: null,
          lastModified: null,
          version: "1.0.0",
          author: null,
          title: null,
          description: null,
        },
      };

      // State preservation
      this.statePreservation = {
        preservedConfig: null,
        formFields: {
          title: "#gb-chart-title",
          xAxis: "#gb-x-axis-title",
          yAxis: "#gb-y-axis-title",
          colourScheme: "#gb-color-scheme",
          showLegend: "#gb-show-legend",
          showGrid: "#gb-show-grid",
        },
        isListening: false,
      };

      // Initialize
      this.init();
    }

    /**
     * Initialise the state manager
     */
    init() {
      logInfo("Initialising state manager");

      // Check dependencies
      if (typeof window.ChartDataManager === "undefined") {
        logError("ChartDataManager is required but not found");
        this.setState(AppStates.ERROR);
        return;
      }

      // Load saved state if available
      this.loadState();

      // Set up auto-save
      this.setupAutoSave();

      // Set up validation debouncing
      this.setupValidationDebouncing();

      this.setupStatePreservation();

      logInfo("State manager initialised successfully");
      this.setState(AppStates.IDLE);
    }

    /**
     * Set application state
     * @param {string} newState - New application state
     * @param {Object} context - Additional context
     */
    setState(newState, context = {}) {
      const previousState = this.currentState;
      this.currentState = newState;

      logDebug(`State change: ${previousState} → ${newState}`);

      // Emit state change event
      this.emitEvent(EventTypes.STATE_CHANGE, {
        previousState,
        newState,
        context,
        timestamp: new Date(),
      });

      // Handle state-specific logic
      this.handleStateChange(newState, previousState, context);
    }

    /**
     * Set current build step
     * @param {string} newStep - New build step
     * @param {Object} context - Additional context
     */
    setStep(newStep, context = {}) {
      const previousStep = this.currentStep;
      this.currentStep = newStep;

      logDebug(`Step change: ${previousStep} → ${newStep}`);

      // Emit step change event
      this.emitEvent(EventTypes.STEP_CHANGE, {
        previousStep,
        newStep,
        context,
        timestamp: new Date(),
      });

      // Update metadata
      this.buildData.metadata.lastModified = new Date();

      // Trigger auto-save
      this.scheduleAutoSave();
    }

    /**
     * Start new chart building process
     * @param {Object} options - Build options
     * @returns {Promise<boolean>} Success status
     */
    async startNewChart(options = {}) {
      logInfo("Starting new chart build");

      try {
        this.setState(AppStates.BUILDING);

        // Reset build data
        this.resetBuildData();

        // Apply options
        if (options.template) {
          await this.loadTemplate(options.template);
        }

        if (options.chartType) {
          this.buildData.chartType = options.chartType;
        }

        // Set metadata
        this.buildData.metadata = {
          ...this.buildData.metadata,
          created: new Date(),
          lastModified: new Date(),
          author: options.author || null,
          title: options.title || null,
          description: options.description || null,
        };

        // Start with data input step
        this.setStep(BuildSteps.DATA_INPUT);

        // Save initial state
        this.saveState();

        return true;
      } catch (error) {
        logError("Failed to start new chart:", error);
        this.setState(AppStates.ERROR, { error });
        return false;
      }
    }

    /**
     * Set data source for chart building
     * @param {*} dataSource - Data source (CSV, JSON, Array, etc.)
     * @param {Object} options - Data processing options
     * @returns {Promise<boolean>} Success status
     */
    async setDataSource(dataSource, options = {}) {
      logDebug("Setting data source");

      try {
        this.setState(AppStates.LOADING);

        // Store the raw data source
        this.buildData.dataSource = dataSource;

        // Create chart data model
        const result = await window.ChartDataManager.createChartData(
          dataSource,
          this.buildData.chartType,
          options
        );

        this.buildData.dataModel = result.model;
        this.buildData.dataModelId = result.modelId;

        // Update validation state
        this.buildData.validation.data = result.model.validationResult;

        // Emit data change event
        this.emitEvent(EventTypes.DATA_CHANGE, {
          dataSource,
          model: result.model,
          modelId: result.modelId,
          validation: result.model.validationResult,
        });

        // Move to next step if data is valid
        if (result.model.validationResult.valid) {
          this.setStep(BuildSteps.CHART_TYPE);
          this.setState(AppStates.BUILDING);
        } else {
          this.setState(AppStates.VALIDATING);
        }

        return true;
      } catch (error) {
        logError("Failed to set data source:", error);
        this.setState(AppStates.ERROR, { error });
        this.buildData.validation.data = {
          valid: false,
          errors: [error.message],
          warnings: [],
        };
        return false;
      }
    }

    /**
     * Set chart type and update data model
     * @param {string} chartType - Chart type
     * @param {Object} options - Chart-specific options
     * @returns {Promise<boolean>} Success status
     */
    async setChartType(chartType, options = {}) {
      logDebug(`Setting chart type: ${chartType}`);

      try {
        this.setState(AppStates.LOADING);

        const previousType = this.buildData.chartType;
        this.buildData.chartType = chartType;

        // If we have data, update the model for the new chart type
        if (this.buildData.dataSource) {
          const result = await window.ChartDataManager.createChartData(
            this.buildData.dataSource,
            chartType,
            options
          );

          // Clean up old model
          if (this.buildData.dataModelId) {
            window.ChartDataManager.removeModel(this.buildData.dataModelId);
          }

          this.buildData.dataModel = result.model;
          this.buildData.dataModelId = result.modelId;
          this.buildData.validation.data = result.model.validationResult;
        }

        // Emit chart change event
        this.emitEvent(EventTypes.CHART_CHANGE, {
          previousType,
          newType: chartType,
          options,
          validation: this.buildData.validation.data,
        });

        // Move to configuration step
        this.setStep(BuildSteps.CHART_CONFIG);
        this.setState(AppStates.BUILDING);

        return true;
      } catch (error) {
        logError("Failed to set chart type:", error);
        this.setState(AppStates.ERROR, { error });
        return false;
      }
    }

    /**
     * Update chart configuration
     * @param {Object} config - Chart configuration updates
     * @returns {Promise<boolean>} Success status
     */
    async updateChartConfig(config) {
      logDebug("Updating chart configuration");

      try {
        this.setState(AppStates.GENERATING);

        // Generate chart configuration
        const chartConfig = window.ChartDataManager.getChartConfig(
          this.buildData.dataModelId,
          config
        );

        this.buildData.chartConfig = chartConfig;
        this.buildData.customisations = {
          ...this.buildData.customisations,
          ...config,
        };

        // Validate chart configuration
        const chartValidation = this.validateChartConfig(chartConfig);
        this.buildData.validation.chart = chartValidation;

        // Move to accessibility step
        this.setStep(BuildSteps.ACCESSIBILITY);
        this.setState(AppStates.BUILDING);

        return true;
      } catch (error) {
        logError("Failed to update chart config:", error);
        this.setState(AppStates.ERROR, { error });
        return false;
      }
    }

    /**
     * Configure accessibility features
     * @param {Object} accessibilityConfig - Accessibility configuration
     * @returns {boolean} Success status
     */
    configureAccessibility(accessibilityConfig) {
      logDebug("Configuring accessibility");

      try {
        // Update user preferences
        this.buildData.userPreferences.accessibility = {
          ...this.buildData.userPreferences.accessibility,
          ...accessibilityConfig,
        };

        // Validate accessibility configuration
        const accessibilityValidation =
          this.validateAccessibilityConfig(accessibilityConfig);
        this.buildData.validation.accessibility = accessibilityValidation;

        // Move to preview step
        this.setStep(BuildSteps.PREVIEW);

        return true;
      } catch (error) {
        logError("Failed to configure accessibility:", error);
        this.setState(AppStates.ERROR, { error });
        return false;
      }
    }

    /**
     * Generate final chart with all configurations
     * @param {HTMLElement} container - Container element for chart
     * @returns {Promise<Object>} Chart instance and metadata
     */
    async generateChart(container) {
      logInfo("Generating final chart");

      try {
        this.setState(AppStates.GENERATING);

        if (!this.buildData.chartConfig) {
          throw new Error("Chart configuration not ready");
        }

        // Create chart instance
        const canvas =
          container.querySelector("canvas") || this.createCanvas(container);
        const ctx = canvas.getContext("2d");

        // Initialize Chart.js
        const chartInstance = new Chart(ctx, this.buildData.chartConfig);
        this.buildData.chartInstance = chartInstance;

        // Apply accessibility features if available
        // Skip for Graph Builder charts as they handle their own accessibility initialization
        if (
          window.ChartAccessibility &&
          this.buildData.userPreferences.accessibility.generateDescriptions &&
          !container.id?.startsWith("gb-final-chart")
        ) {
          await this.applyAccessibilityFeatures(container, chartInstance);
        }

        // Apply controls if available
        if (window.ChartControls) {
          this.applyChartControls(container, chartInstance);
        }

        // Mark as complete
        this.setStep(BuildSteps.COMPLETE);
        this.setState(AppStates.COMPLETE);

        return {
          chartInstance,
          config: this.buildData.chartConfig,
          metadata: this.buildData.metadata,
          dataModel: this.buildData.dataModel,
        };
      } catch (error) {
        logError("Failed to generate chart:", error);
        this.setState(AppStates.ERROR, { error });
        throw error;
      }
    }

    /**
     * Save current state to localStorage
     */
    saveState() {
      try {
        const stateToSave = {
          currentStep: this.currentStep,
          buildData: {
            ...this.buildData,
            // Don't save the actual chart instance
            chartInstance: null,
          },
          timestamp: new Date(),
        };

        localStorage.setItem(
          CONFIG.stateStorageKey,
          JSON.stringify(stateToSave)
        );
        logDebug("State saved successfully");

        this.emitEvent(EventTypes.SAVE, { timestamp: new Date() });
      } catch (error) {
        logError("Failed to save state:", error);
      }
    }

    /**
     * Load state from localStorage
     */
    loadState() {
      try {
        const savedState = localStorage.getItem(CONFIG.stateStorageKey);
        if (savedState) {
          const state = JSON.parse(savedState);

          // Restore state
          this.currentStep = state.currentStep || BuildSteps.DATA_INPUT;
          this.buildData = {
            ...this.buildData,
            ...state.buildData,
          };

          logInfo("State loaded successfully");
          this.emitEvent(EventTypes.LOAD, { timestamp: new Date() });
        }
      } catch (error) {
        logError("Failed to load state:", error);
      }
    }

    /**
     * Save chart as template
     * @param {string} name - Template name
     * @param {string} description - Template description
     * @returns {boolean} Success status
     */
    saveAsTemplate(name, description = "") {
      try {
        const templates = this.getTemplates();
        const templateId = this.generateTemplateId();

        const template = {
          id: templateId,
          name,
          description,
          chartType: this.buildData.chartType,
          config: this.buildData.customisations,
          accessibility: this.buildData.userPreferences.accessibility,
          metadata: {
            created: new Date(),
            author: this.buildData.metadata.author,
          },
        };

        templates[templateId] = template;
        localStorage.setItem(
          CONFIG.templateStorageKey,
          JSON.stringify(templates)
        );

        logInfo(`Template saved: ${name}`);
        return true;
      } catch (error) {
        logError("Failed to save template:", error);
        return false;
      }
    }

    /**
     * Load chart template
     * @param {string} templateId - Template ID
     * @returns {Promise<boolean>} Success status
     */
    async loadTemplate(templateId) {
      try {
        const templates = this.getTemplates();
        const template = templates[templateId];

        if (!template) {
          throw new Error(`Template not found: ${templateId}`);
        }

        // Apply template
        this.buildData.template = template;
        this.buildData.chartType = template.chartType;
        this.buildData.customisations = { ...template.config };
        this.buildData.userPreferences.accessibility = {
          ...this.buildData.userPreferences.accessibility,
          ...template.accessibility,
        };

        logInfo(`Template loaded: ${template.name}`);
        return true;
      } catch (error) {
        logError("Failed to load template:", error);
        return false;
      }
    }

    /**
     * Get all saved templates
     * @returns {Object} Templates object
     */
    getTemplates() {
      try {
        const templates = localStorage.getItem(CONFIG.templateStorageKey);
        return templates ? JSON.parse(templates) : {};
      } catch (error) {
        logError("Failed to get templates:", error);
        return {};
      }
    }

    /**
     * Validate chart configuration
     * @param {Object} config - Chart configuration
     * @returns {Object} Validation result
     */
    validateChartConfig(config) {
      const errors = [];
      const warnings = [];

      // Basic validation
      if (!config.type) {
        errors.push("Chart type is required");
      }

      if (!config.data || !config.data.datasets) {
        errors.push("Chart data is required");
      }

      // Type-specific validation
      switch (config.type) {
        case "pie":
        case "doughnut":
          if (!config.data.labels || config.data.labels.length === 0) {
            errors.push("Labels are required for pie charts");
          }
          break;

        case "scatter":
        case "bubble":
          if (
            !config.options.scales ||
            !config.options.scales.x ||
            !config.options.scales.y
          ) {
            logWarn("Scales configuration recommended for scatter charts");
          }
          break;
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    }

    /**
     * Validate accessibility configuration
     * @param {Object} config - Accessibility configuration
     * @returns {Object} Validation result
     */
    validateAccessibilityConfig(config) {
      const errors = [];
      const warnings = [];

      // Check if accessibility features are properly configured
      if (config.generateDescriptions && !window.ChartAccessibility) {
        logWarn(
          "Chart accessibility module not loaded - descriptions will not be generated"
        );
      }

      if (
        config.includeDataTable &&
        !document.querySelector(".sortable-table")
      ) {
        logWarn("Sortable table functionality may not be available");
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    }

    /**
     * Apply accessibility features to chart
     * @param {HTMLElement} container - Chart container
     * @param {Object} chartInstance - Chart.js instance
     */
    async applyAccessibilityFeatures(container, chartInstance) {
      try {
        // Generate unique chart ID
        const chartId = container.id || `chart-${Date.now()}`;
        if (!container.id) {
          container.id = chartId;
        }

        // Initialize accessibility features
        if (
          window.ChartAccessibility &&
          window.ChartAccessibility.initAccessibilityFeatures
        ) {
          window.ChartAccessibility.initAccessibilityFeatures(
            container,
            chartId
          );
        }

        logDebug("Accessibility features applied");
      } catch (error) {
        logError("Failed to apply accessibility features:", error);
      }
    }

    /**
     * Apply chart controls to container
     * @param {HTMLElement} container - Chart container
     * @param {Object} chartInstance - Chart.js instance
     */
    applyChartControls(container, chartInstance) {
      try {
        // Add chart controls if available
        if (
          window.ChartControls &&
          window.ChartControls.addControlsToContainer
        ) {
          const chartId = container.id || `chart-${Date.now()}`;
          window.ChartControls.addControlsToContainer(container, chartId);
        }

        logDebug("Chart controls applied");
      } catch (error) {
        logError("Failed to apply chart controls:", error);
      }
    }

    /**
     * Create canvas element for chart with conflict prevention
     * @param {HTMLElement} container - Container element
     * @returns {HTMLCanvasElement} Canvas element
     */
    createCanvas(container) {
      // **ENHANCED: Clean existing canvases first**
      const existingCanvases = container.querySelectorAll("canvas");
      existingCanvases.forEach((canvas) => {
        const chartInstance = Chart.getChart(canvas);
        if (chartInstance) {
          logDebug(`Destroying existing chart: ${chartInstance.id}`);
          chartInstance.destroy();
        }
        canvas.remove();
      });

      // Create new canvas with unique ID
      const canvasId = `chart-canvas-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`;
      const canvas = document.createElement("canvas");
      canvas.id = canvasId;
      canvas.width = 600;
      canvas.height = 400;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "Chart");

      logDebug(`Created canvas with unique ID: ${canvasId}`);

      // Add chart container classes if not present
      if (!container.classList.contains("chart-container")) {
        container.classList.add("chart-container");
      }

      container.appendChild(canvas);
      return canvas;
    }

    /**
     * Reset build data to initial state
     */
    resetBuildData() {
      // Clean up existing model
      if (this.buildData.dataModelId) {
        window.ChartDataManager.removeModel(this.buildData.dataModelId);
      }

      // Reset data
      this.buildData = {
        dataSource: null,
        dataModel: null,
        dataModelId: null,
        chartType: CONFIG.defaultChartType,
        chartConfig: null,
        chartInstance: null,
        userPreferences: {
          theme: "default",
          accessibility: {
            generateDescriptions: true,
            includeDataTable: true,
            includeStatistics: true,
          },
          export: {
            includeCSV: true,
            includePNG: true,
          },
        },
        validation: {
          data: { valid: false, errors: [], warnings: [] },
          chart: { valid: false, errors: [], warnings: [] },
          accessibility: { valid: true, errors: [], warnings: [] },
        },
        template: null,
        customisations: {},
        metadata: {
          created: null,
          lastModified: null,
          version: "1.0.0",
          author: null,
          title: null,
          description: null,
        },
      };
    }

    /**
     * Handle state change logic
     * @param {string} newState - New state
     * @param {string} previousState - Previous state
     * @param {Object} context - Additional context
     */
    handleStateChange(newState, previousState, context) {
      switch (newState) {
        case AppStates.ERROR:
          logError(`Error state: ${context.error?.message || "Unknown error"}`);
          break;

        case AppStates.COMPLETE:
          logInfo("Chart building completed successfully");
          this.saveState();
          break;

        case AppStates.BUILDING:
          if (previousState === AppStates.IDLE) {
            logInfo("Started building process");
          }
          break;
      }
    }

    /**
     * Set up auto-save functionality
     */
    setupAutoSave() {
      if (this.autoSaveTimer) {
        clearInterval(this.autoSaveTimer);
      }

      this.autoSaveTimer = setInterval(() => {
        if (this.currentState === AppStates.BUILDING) {
          this.saveState();
        }
      }, CONFIG.autoSaveInterval);
    }

    /**
     * Schedule auto-save with delay
     */
    scheduleAutoSave() {
      if (this.autoSaveTimer) {
        clearTimeout(this.autoSaveTimer);
      }

      this.autoSaveTimer = setTimeout(() => {
        this.saveState();
      }, 1000);
    }

    /**
     * Set up validation debouncing
     */
    setupValidationDebouncing() {
      // This will be used to debounce validation calls
      this.validationDebounce = this.debounce((dataSource, chartType) => {
        this.validateData(dataSource, chartType);
      }, CONFIG.validationDebounceDelay);
    }

    /**
     * Debounce utility function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    /**
     * Generate unique template ID
     * @returns {string} Unique template ID
     */
    generateTemplateId() {
      return (
        "template-" +
        Date.now() +
        "-" +
        Math.random().toString(36).substring(2, 9)
      );
    }

    /**
     * Add event listener
     * @param {string} eventType - Event type
     * @param {Function} callback - Callback function
     */
    addEventListener(eventType, callback) {
      if (!this.eventListeners.has(eventType)) {
        this.eventListeners.set(eventType, []);
      }
      this.eventListeners.get(eventType).push(callback);
    }

    /**
     * Remove event listener
     * @param {string} eventType - Event type
     * @param {Function} callback - Callback function
     */
    removeEventListener(eventType, callback) {
      if (this.eventListeners.has(eventType)) {
        const listeners = this.eventListeners.get(eventType);
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }

    /**
     * Emit event to listeners
     * @param {string} eventType - Event type
     * @param {Object} data - Event data
     */
    emitEvent(eventType, data) {
      if (this.eventListeners.has(eventType)) {
        this.eventListeners.get(eventType).forEach((callback) => {
          try {
            callback(data);
          } catch (error) {
            logError(`Error in event listener for ${eventType}:`, error);
          }
        });
      }
    }

    /**
     * Get current state summary
     * @returns {Object} State summary
     */
    getStateSummary() {
      return {
        currentState: this.currentState,
        currentStep: this.currentStep,
        hasData: !!this.buildData.dataModel,
        hasChart: !!this.buildData.chartConfig,
        isComplete: this.currentState === AppStates.COMPLETE,
        validation: {
          data: this.buildData.validation.data.valid,
          chart: this.buildData.validation.chart.valid,
          accessibility: this.buildData.validation.accessibility.valid,
        },
        metadata: this.buildData.metadata,
      };
    }

    /**
     * Extract current chart configuration from Chart.js instance
     * @returns {Object|null} Configuration object or null if extraction fails
     */
    extractChartConfiguration() {
      try {
        logDebug("Extracting current chart configuration");

        // Find the chart canvas in Graph Builder result area
        const canvas =
          document.querySelector("#gb-final-chart canvas") ||
          document.querySelector("#gb-chart-preview canvas");

        if (!canvas) {
          logWarn("No chart canvas found for configuration extraction");
          return null;
        }

        // Get Chart.js instance
        const chartInstance = Chart.getChart(canvas);
        if (!chartInstance) {
          logWarn("No Chart.js instance found");
          return null;
        }

        // Extract configuration safely
        const config = {
          title: "",
          xAxis: "",
          yAxis: "",
          colourScheme: "default",
          showLegend: true,
          showGrid: true,
        };

        // Extract title
        if (chartInstance.options?.plugins?.title?.text) {
          config.title = chartInstance.options.plugins.title.text;
        }

        // Extract axis titles
        if (chartInstance.options?.scales?.x?.title?.text) {
          config.xAxis = chartInstance.options.scales.x.title.text;
        }

        if (chartInstance.options?.scales?.y?.title?.text) {
          config.yAxis = chartInstance.options.scales.y.title.text;
        }

        // Extract legend setting
        if (chartInstance.options?.plugins?.legend) {
          config.showLegend =
            chartInstance.options.plugins.legend.display !== false;
        }

        // Extract grid setting
        if (
          chartInstance.options?.scales?.x?.grid ||
          chartInstance.options?.scales?.y?.grid
        ) {
          config.showGrid =
            chartInstance.options.scales.x.grid.display !== false ||
            chartInstance.options.scales.y.grid.display !== false;
        }

        logInfo("Chart configuration extracted successfully:", config);
        return config;
      } catch (error) {
        logError("Error extracting chart configuration:", error);
        return null;
      }
    }

    /**
     * Preserve current chart configuration
     */
    preserveChartConfiguration() {
      logInfo("Preserving current chart configuration");

      this.statePreservation.preservedConfig = this.extractChartConfiguration();

      if (this.statePreservation.preservedConfig) {
        logInfo("Chart configuration preserved successfully");

        // Also save to buildData for consistency
        this.buildData.preservedFormState =
          this.statePreservation.preservedConfig;
      } else {
        logWarn("Failed to preserve chart configuration");
      }
    }

    /**
     * Restore configuration to form fields
     */
    restoreChartConfiguration() {
      const config =
        this.statePreservation.preservedConfig ||
        this.buildData.preservedFormState;

      if (!config) {
        logWarn("No preserved configuration to restore");
        return false;
      }

      logInfo("Restoring chart configuration to form fields");

      try {
        // Restore text fields
        const titleField = document.querySelector(
          this.statePreservation.formFields.title
        );
        if (titleField && config.title) {
          titleField.value = config.title;
        }

        const xAxisField = document.querySelector(
          this.statePreservation.formFields.xAxis
        );
        if (xAxisField && config.xAxis) {
          xAxisField.value = config.xAxis;
        }

        const yAxisField = document.querySelector(
          this.statePreservation.formFields.yAxis
        );
        if (yAxisField && config.yAxis) {
          yAxisField.value = config.yAxis;
        }

        // Restore colour scheme
        const colourField = document.querySelector(
          this.statePreservation.formFields.colourScheme
        );
        if (colourField && config.colourScheme) {
          colourField.value = config.colourScheme;
        }

        // Restore checkboxes
        const legendField = document.querySelector(
          this.statePreservation.formFields.showLegend
        );
        if (legendField) {
          legendField.checked = config.showLegend;
        }

        const gridField = document.querySelector(
          this.statePreservation.formFields.showGrid
        );
        if (gridField) {
          gridField.checked = config.showGrid;
        }

        logInfo("Chart configuration restored successfully");

        // Trigger change events to update preview
        this.triggerFormUpdates();

        // Clear preserved config after use
        this.statePreservation.preservedConfig = null;
        this.buildData.preservedFormState = null;

        return true;
      } catch (error) {
        logError("Error restoring chart configuration:", error);
        return false;
      }
    }

    /**
     * Trigger change events on form fields to update preview
     */
    triggerFormUpdates() {
      logDebug("Triggering form updates for preview refresh");

      Object.values(this.statePreservation.formFields).forEach((selector) => {
        const field = document.querySelector(selector);
        if (field) {
          const event = new Event("change", { bubbles: true });
          field.dispatchEvent(event);
        }
      });
    }

    /**
     * Set up state preservation listeners
     */
    setupStatePreservation() {
      if (this.statePreservation.isListening) {
        logDebug("State preservation already set up");
        return;
      }

      logInfo("Setting up state preservation listeners");

      // Listen for back button clicks
      this.attachBackButtonListener();

      // Monitor for configure screen activation
      this.setupConfigureScreenMonitor();

      this.statePreservation.isListening = true;
      logInfo("State preservation listeners set up successfully");
    }

    /**
     * Attach event listener to back button
     */
    attachBackButtonListener() {
      logDebug("Attaching back button listener");

      const backButton = document.getElementById("gb-result-back");

      if (!backButton) {
        logWarn("Back button not found (gb-result-back)");
        return false;
      }

      // Remove existing listener if any
      backButton.removeEventListener("click", this.backButtonHandler);

      // Create bound handler
      this.backButtonHandler = (event) => {
        logInfo("Back button clicked - preserving state");
        this.preserveChartConfiguration();
      };

      // Attach event listener
      backButton.addEventListener("click", this.backButtonHandler);

      logInfo("Back button listener attached successfully");
      return true;
    }

    /**
     * Monitor for configure screen and restore state when it loads
     */
    setupConfigureScreenMonitor() {
      logDebug("Setting up configure screen monitor");

      // Use MutationObserver to detect when configure screen becomes active
      if (this.configureScreenObserver) {
        this.configureScreenObserver.disconnect();
      }

      this.configureScreenObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "class"
          ) {
            const target = mutation.target;

            // Check if this is the configure screen becoming active
            if (
              target.id === "gb-configure" &&
              target.classList.contains("active")
            ) {
              logInfo(
                "Configure screen became active - checking for state restoration"
              );

              // Small delay to ensure form is fully initialised
              setTimeout(() => {
                if (
                  this.statePreservation.preservedConfig ||
                  this.buildData.preservedFormState
                ) {
                  logInfo("Restoring preserved configuration");
                  this.restoreChartConfiguration();
                }
              }, 100);
            }
          }
        });
      });

      // Find and observe the configure screen
      const configureScreen = document.getElementById("gb-configure");
      if (configureScreen) {
        this.configureScreenObserver.observe(configureScreen, {
          attributes: true,
          attributeFilter: ["class"],
        });

        logInfo("Configure screen monitor set up successfully");
      } else {
        logWarn("Configure screen not found for monitoring");
      }
    }

    /**
     * Test state preservation functionality
     */
    testStatePreservation() {
      logInfo("Running state preservation test");

      const config = this.extractChartConfiguration();
      if (config) {
        logInfo("Test extraction successful:", config);

        // Store and restore for testing
        this.statePreservation.preservedConfig = config;

        setTimeout(() => {
          this.restoreChartConfiguration();
          logInfo("Test restoration completed");
        }, 1000);

        return true;
      } else {
        logWarn("Test extraction failed");
        return false;
      }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
      if (this.configureScreenObserver) {
        this.configureScreenObserver.disconnect();
      }
      if (this.backButtonHandler) {
        const backButton = document.getElementById("gb-result-back");
        if (backButton) {
          backButton.removeEventListener("click", this.backButtonHandler);
        }
      }

      // Clear timers
      if (this.autoSaveTimer) {
        clearInterval(this.autoSaveTimer);
      }

      // Clean up data model
      if (this.buildData.dataModelId) {
        window.ChartDataManager.removeModel(this.buildData.dataModelId);
      }

      // Clear event listeners
      this.eventListeners.clear();

      logInfo("Cleanup completed");
    }
  }

  // Create singleton instance
  const instance = new ChartBuilderState();

  // Log module initialisation
  logInfo("Module loaded successfully");

  // Public API
  return {
    // State management
    getState: () => instance.currentState,
    getStep: () => instance.currentStep,
    getStateSummary: () => instance.getStateSummary(),

    // State preservation methods
    preserveChartConfiguration: () => instance.preserveChartConfiguration(),
    restoreChartConfiguration: () => instance.restoreChartConfiguration(),
    extractChartConfiguration: () => instance.extractChartConfiguration(),
    testStatePreservation: () => instance.testStatePreservation(),

    // Chart building workflow
    startNewChart: (options) => instance.startNewChart(options),
    setDataSource: (data, options) => instance.setDataSource(data, options),
    setChartType: (type, options) => instance.setChartType(type, options),
    updateChartConfig: (config) => instance.updateChartConfig(config),
    configureAccessibility: (config) => instance.configureAccessibility(config),
    generateChart: (container) => instance.generateChart(container),

    // Template management
    saveAsTemplate: (name, description) =>
      instance.saveAsTemplate(name, description),
    loadTemplate: (templateId) => instance.loadTemplate(templateId),
    getTemplates: () => instance.getTemplates(),

    // State persistence
    saveState: () => instance.saveState(),
    loadState: () => instance.loadState(),

    // Event handling
    addEventListener: (type, callback) =>
      instance.addEventListener(type, callback),
    removeEventListener: (type, callback) =>
      instance.removeEventListener(type, callback),

    // Cleanup
    cleanup: () => instance.cleanup(),

    // Logging control
    setLogLevel: setLogLevel,
    getLogLevel: () => currentLogLevel,

    // Constants for external use
    BuildSteps,
    AppStates,
    EventTypes,
    CONFIG,
    LOG_LEVELS,
  };
})();

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = ChartBuilderState;
} else {
  window.ChartBuilderState = ChartBuilderState;
}

window.testGraphBuilderStatePreservation = () => {
  console.log("=== Testing Graph Builder State Preservation ===");

  if (typeof ChartBuilderState === "undefined") {
    console.error("ChartBuilderState not available");
    return;
  }

  // Test 1: Check if back button exists
  const backButton = document.getElementById("gb-result-back");
  console.log("1. Back button found:", !!backButton);
  if (backButton) {
    console.log("   Text content:", backButton.textContent);
    console.log("   Classes:", backButton.className);
  }

  // Test 2: Check if form fields exist
  console.log("2. Form fields check:");
  const formFields = {
    title: "#gb-chart-title",
    xAxis: "#gb-x-axis-title",
    yAxis: "#gb-y-axis-title",
    colourScheme: "#gb-color-scheme",
    showLegend: "#gb-show-legend",
    showGrid: "#gb-show-grid",
  };

  Object.entries(formFields).forEach(([name, selector]) => {
    const field = document.querySelector(selector);
    console.log(`   ${name} (${selector}):`, !!field);
  });

  // Test 3: Test configuration extraction
  console.log("3. Configuration extraction test:");
  try {
    const config = ChartBuilderState.extractChartConfiguration();
    console.log("   Extracted config:", config);
  } catch (error) {
    console.log("   Extraction error:", error.message);
  }

  // Test 4: Test complete system
  console.log("4. Running complete system test:");
  try {
    const result = ChartBuilderState.testStatePreservation();
    console.log("   System test result:", result);
  } catch (error) {
    console.log("   System test error:", error.message);
  }

  console.log("=== Test completed ===");
};
