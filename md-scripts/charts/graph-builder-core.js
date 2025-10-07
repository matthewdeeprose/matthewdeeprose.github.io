/**
 * Graph Builder Core
 * Main controller that coordinates all Graph Builder modules
 *
 * Dependencies (loaded in order):
 * - GraphBuilderUtils (utilities and helpers)
 * - GraphBuilderNotifications (user feedback)
 * - GraphBuilderData (data processing)
 * - GraphBuilderUI (interface management)
 * - GraphBuilderCharts (chart creation)
 * - Chart.js ecosystem (ChartDataManager, ChartBuilderState, etc.)
 *
 * @version 1.0.0
 */

const GraphBuilder = (function () {
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

  // Helper functions for logging
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(message, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(message, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(message, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(message, ...args);
    }
  }

  // Application state
  const state = {
    initialized: false,
    currentScreen: "data-input",
    currentDataMethod: "form",
    selectedChartType: null,
    chartData: null,
    formRowCount: 0,
    container: null,
  };

  /**
   * Main Graph Builder Controller
   * Coordinates all modules and manages the overall workflow
   */
  class GraphBuilderController {
    /**
     * Force refresh accessibility for all charts
     */
    forceRefreshAccessibility() {
      if (this.accessibilityManager) {
        // Use the new forceRefreshAll method that handles both accessibility and view controls
        this.accessibilityManager.forceRefreshAll();
      }
    }

    /**
     * Get accessibility status for debugging
     */
    getAccessibilityStatus() {
      if (this.accessibilityManager) {
        return this.accessibilityManager.getStatus();
      }
      return { error: "Accessibility manager not initialized" };
    }
    /**
     * NEW: Ensure view controls for a specific chart
     */
    ensureChartViewControls(chartId) {
      if (this.accessibilityManager) {
        const container = document.getElementById(chartId);
        if (container) {
          this.accessibilityManager.applyViewControls(container, chartId);
        }
      }
    }
    /**
     * NEW: Force refresh view controls only
     */
    forceRefreshViewControls() {
      if (this.accessibilityManager) {
        this.accessibilityManager.ensureViewControls();
      }
    }

    /**
     * NEW: Check if view controls are needed for specific chart
     */
    checkViewControlsStatus(chartId) {
      if (this.accessibilityManager) {
        const container = document.getElementById(chartId);
        if (container) {
          return {
            needsViewControls:
              this.accessibilityManager.needsViewControlsEnhancement(container),
            hasViewControls: !!container.querySelector(".chart-view-controls"),
            hasCanvas: !!container.querySelector("canvas"),
          };
        }
      }
      return {
        error: "Chart not found or accessibility manager not available",
      };
    }

    /**
     * Ensure accessibility for a specific chart
     */
    ensureChartAccessibility(chartId) {
      if (this.accessibilityManager) {
        const container = document.getElementById(chartId);
        if (container) {
          this.accessibilityManager.applyAccessibilityFeatures(
            container,
            chartId
          );
        }
      }
    }
    constructor() {
      this.dependencies = {
        utils: null,
        notifications: null,
        data: null,
        ui: null,
        charts: null,
      };

      this.elements = {
        dataInput: {},
        chartType: {},
        configure: {},
        result: {},
      };

      this.accessibilityManager = new AccessibilityEnhancementManager(this);
    }

    /**
     * Initialize the Graph Builder application
     * @returns {boolean} Success status
     */
    init() {
      logInfo("[Graph Builder Core] Initialising...");

      try {
        // Check if already initialized
        if (state.initialized) {
          logInfo("[Graph Builder Core] Already initialised");
          return true;
        }

        // Verify dependencies are loaded
        if (!this.verifyDependencies()) {
          return false;
        }
        // Cache dependencies with validation
        const dependencyCachingSuccess = this.cacheDependencies();
        if (!dependencyCachingSuccess) {
          logError("[Graph Builder Core] Dependency caching failed");

          // Try to provide helpful error message
          const availableModules = Object.keys(window).filter(
            (key) => key.includes("GraphBuilder") || key.includes("Universal")
          );

          logError(
            "[Graph Builder Core] Available modules on window:",
            availableModules
          );
          logError(
            "[Graph Builder Core] This typically indicates a script loading order issue"
          );

          // Don't return false immediately - try to continue with limited functionality
          if (window.UniversalNotifications) {
            window.UniversalNotifications.error(
              "Graph Builder initialization incomplete - some features may not work"
            );
          }

          // You could still try to continue, but dependency issues will cause problems
          logWarn(
            "[Graph Builder Core] Attempting to continue with incomplete dependencies..."
          );
        }

        // Find container
        state.container = document.getElementById("GraphBuilderContainer");
        if (!state.container) {
          logError("[Graph Builder Core] Container not found");
          this.dependencies.notifications.error(
            "Graph Builder container not found"
          );
          return false;
        }

        // Check if Graph Builder section is visible
        const graphBuilderArticle = document.getElementById("graph-builder");
        if (graphBuilderArticle?.classList.contains("hidden")) {
          logWarn("[Graph Builder Core] Graph Builder section is hidden");
        }

        // Cache DOM elements
        this.cacheElements();

        // Verify critical elements
        if (!this.verifyCriticalElements()) {
          return false;
        }

        // Set up event listeners
        this.setupEventListeners();

        // Initialize first screen
        this.initializeDataInput();

        // Initialize accessibility enhancement system
        this.accessibilityManager.init();

        // Mark as initialized
        state.initialized = true;

        logInfo("[Graph Builder Core] Initialised successfully");

        return true;
      } catch (error) {
        logError("[Graph Builder Core] Initialisation failed:", error);
        this.dependencies.notifications?.error(
          "Graph Builder initialisation failed"
        );
        return false;
      }
    }

    /**
     * Verify all required dependencies are loaded
     * @returns {boolean} Dependencies status
     */
    verifyDependencies() {
      const required = [
        "GraphBuilderUtils",
        "GraphBuilderNotifications",
        "GraphBuilderData",
        "GraphBuilderUI",
        "GraphBuilderCharts",
        "Chart",
        "ChartDataManager",
        "ChartBuilderState",
      ];

      logDebug("[Graph Builder Core] Checking dependencies...");

      // Debug: Check what's actually available
      required.forEach((dep) => {
        logDebug(
          `[Graph Builder Core] ${dep}:`,
          typeof window[dep] !== "undefined" ? "✓" : "✗"
        );
      });

      const missing = required.filter(
        (dep) => typeof window[dep] === "undefined"
      );

      if (missing.length > 0) {
        logError("[Graph Builder Core] Missing dependencies:", missing);

        // More helpful error message
        if (missing.includes("GraphBuilderNotifications")) {
          logError(
            "[Graph Builder Core] Check that graph-builder-notifications.js exports to window.GraphBuilderNotifications"
          );
        }

        return false;
      }

      // Check for optional dependencies
      const optional = ["ChartAccessibility", "ChartControls"];
      const missingOptional = optional.filter(
        (dep) => typeof window[dep] === "undefined"
      );

      if (missingOptional.length > 0) {
        logWarn(
          "[Graph Builder Core] Missing optional dependencies:",
          missingOptional
        );
      }

      logInfo("[Graph Builder Core] All dependencies verified ✓");
      return true;
    }

    /**
     * Cache dependency references for performance
     * Enhanced version with error handling and fallbacks
     */
    cacheDependencies() {
      logDebug("[Graph Builder Core] Caching dependencies...");

      // Initialize dependencies object
      this.dependencies = {};

      // Define dependency mappings with fallbacks
      const dependencyMappings = {
        utils: {
          primary: "GraphBuilderUtils",
          fallback: null,
          required: true,
        },
        notifications: {
          primary: "GraphBuilderNotifications",
          fallback: "UniversalNotifications",
          required: true,
        },
        data: {
          primary: "GraphBuilderData",
          fallback: null,
          required: true,
        },
        ui: {
          primary: "GraphBuilderUI",
          fallback: null,
          required: true,
        },
        charts: {
          primary: "GraphBuilderCharts",
          fallback: null,
          required: true,
        },
      };

      // Cache each dependency with validation
      const cachingResults = {};
      let allRequired = true;

      Object.entries(dependencyMappings).forEach(([key, config]) => {
        let dependency = null;
        let source = null;

        // Try primary dependency
        if (window[config.primary]) {
          dependency = window[config.primary];
          source = config.primary;
        }
        // Try fallback if primary not available
        else if (config.fallback && window[config.fallback]) {
          dependency = window[config.fallback];
          source = config.fallback;
          logWarn(
            `[Graph Builder Core] Using fallback ${config.fallback} for ${key}`
          );
        }

        // Cache the dependency
        this.dependencies[key] = dependency;

        // Track results
        cachingResults[key] = {
          found: !!dependency,
          source: source || "not found",
          required: config.required,
        };

        // Check if required dependency is missing
        if (config.required && !dependency) {
          logError(
            `[Graph Builder Core] Required dependency missing: ${config.primary}`
          );
          allRequired = false;
        } else if (dependency) {
          logDebug(`[Graph Builder Core] Cached ${key} from ${source} ✓`);
        }
      });

      // Log comprehensive caching results
      logInfo(
        "[Graph Builder Core] Dependency caching results:",
        cachingResults
      );

      // Validate critical methods are available
      const criticalMethods = this.validateCriticalMethods();

      if (!allRequired) {
        logError(
          "[Graph Builder Core] Cannot proceed - required dependencies missing"
        );
        logError(
          "[Graph Builder Core] Available on window:",
          Object.keys(window).filter((key) => key.includes("GraphBuilder"))
        );
        return false;
      }

      if (!criticalMethods.allValid) {
        logWarn(
          "[Graph Builder Core] Some critical methods unavailable:",
          criticalMethods.missing
        );
        // Don't fail completely, but warn
      }

      logInfo("[Graph Builder Core] Dependencies cached successfully ✓");
      return true;
    }

    /**
     * Validate that critical methods are available on cached dependencies
     * @returns {Object} Validation results
     */
    validateCriticalMethods() {
      const criticalMethods = {
        "data.extractFormData": this.dependencies.data?.extractFormData,
        "data.validateData": this.dependencies.data?.validateData,
        "data.parseCSV": this.dependencies.data?.parseCSV,
        "charts.createFinalChart": this.dependencies.charts?.createFinalChart,
        "charts.validateData": this.dependencies.charts?.validateData,
        "utils.dom.getById": this.dependencies.utils?.dom?.getById,
        "notifications.success":
          this.dependencies.notifications?.success ||
          this.dependencies.notifications?.notifySuccess,
        "notifications.error":
          this.dependencies.notifications?.error ||
          this.dependencies.notifications?.notifyError,
        "ui.switchScreen": this.dependencies.ui?.switchScreen,
        "ui.updateProgress": this.dependencies.ui?.updateProgress,
      };

      const missing = [];
      const available = [];

      Object.entries(criticalMethods).forEach(([methodPath, method]) => {
        if (typeof method === "function") {
          available.push(methodPath);
        } else {
          missing.push(methodPath);
        }
      });

      logDebug(
        `[Graph Builder Core] Critical methods - Available: ${available.length}, Missing: ${missing.length}`
      );

      if (missing.length > 0) {
        logWarn("[Graph Builder Core] Missing critical methods:", missing);
      }

      return {
        allValid: missing.length === 0,
        available,
        missing,
        criticalCount: Object.keys(criticalMethods).length,
      };
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
      logDebug("[Graph Builder Core] Caching DOM elements...");

      // Data input elements
      this.elements.dataInput = {
        tabForm: this.dependencies.utils.dom.getById("gb-tab-form"),
        tabPaste: this.dependencies.utils.dom.getById("gb-tab-paste"),
        tabUpload: this.dependencies.utils.dom.getById("gb-tab-upload"),
        dataRows: this.dependencies.utils.dom.getById("gb-data-rows"),
        addRowButton: this.dependencies.utils.dom.getById("gb-add-row"),
        csvInput: this.dependencies.utils.dom.getById("gb-csv-input"),
        fileInput: this.dependencies.utils.dom.getById("gb-file-input"),
        nextButton: this.dependencies.utils.dom.getById("gb-data-next"),
        columnHeaders: {
          col1: this.dependencies.utils.dom.getById("gb-column-1"),
          col2: this.dependencies.utils.dom.getById("gb-column-2"),
        },
      };

      // Chart type elements
      this.elements.chartType = {
        options: this.dependencies.utils.dom.queryAll(".gb-chart-option"),
        backButton: this.dependencies.utils.dom.getById("gb-chart-back"),
        nextButton: this.dependencies.utils.dom.getById("gb-chart-next"),
      };

      // Configuration elements
      this.elements.configure = {
        titleInput: this.dependencies.utils.dom.getById("gb-chart-title"),
        xAxisInput: this.dependencies.utils.dom.getById("gb-x-axis-title"),
        yAxisInput: this.dependencies.utils.dom.getById("gb-y-axis-title"),
        colourScheme: this.dependencies.utils.dom.getById("gb-color-scheme"),
        showLegend: this.dependencies.utils.dom.getById("gb-show-legend"),
        showGrid: this.dependencies.utils.dom.getById("gb-show-grid"),
        backButton: this.dependencies.utils.dom.getById("gb-config-back"),
        createButton: this.dependencies.utils.dom.getById("gb-config-create"),
      };

      // Result elements
      this.elements.result = {
        useInDocument:
          this.dependencies.utils.dom.getById("gb-use-in-document"),
        saveTemplate: this.dependencies.utils.dom.getById("gb-save-template"),
        createAnother: this.dependencies.utils.dom.getById("gb-create-another"),
        backButton: this.dependencies.utils.dom.getById("gb-result-back"),
      };
    }

    /**
     * Verify critical elements exist
     * @returns {boolean} Elements status
     */
    verifyCriticalElements() {
      const critical = [
        this.elements.dataInput.dataRows,
        this.elements.dataInput.addRowButton,
        this.elements.dataInput.nextButton,
        this.elements.result.backButton,
      ];

      const missing = critical.filter((el) => !el);

      if (missing.length > 0) {
        logError("[Graph Builder Core] Missing critical elements");
        this.dependencies.notifications.error("Graph Builder setup incomplete");
        return false;
      }

      return true;
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
      logDebug("[Graph Builder Core] Setting up event listeners...");

      // Data input method tabs
      this.dependencies.utils.dom.addListener(
        this.elements.dataInput.tabForm,
        "click",
        () => this.switchDataMethod("form", true)
      );

      this.dependencies.utils.dom.addListener(
        this.elements.dataInput.tabPaste,
        "click",
        () => this.switchDataMethod("paste", true)
      );

      this.dependencies.utils.dom.addListener(
        this.elements.dataInput.tabUpload,
        "click",
        () => this.switchDataMethod("upload", true)
      );

      // Data input interactions
      this.dependencies.utils.dom.addListener(
        this.elements.dataInput.addRowButton,
        "click",
        () => this.addDataRow()
      );

      this.dependencies.utils.dom.addListener(
        this.elements.dataInput.csvInput,
        "input",
        this.dependencies.utils.performance.debounce(
          () => this.handleCSVInput(),
          300
        )
      );

      this.dependencies.utils.dom.addListener(
        this.elements.dataInput.fileInput,
        "change",
        (e) => this.handleFileUpload(e)
      );

      // NEW: Set up drag and drop functionality for file upload
      this.setupDragAndDrop();

      // Column header changes
      this.dependencies.utils.dom.addListener(
        this.elements.dataInput.columnHeaders.col1,
        "input",
        () => this.updateRowLabels()
      );

      this.dependencies.utils.dom.addListener(
        this.elements.dataInput.columnHeaders.col2,
        "input",
        () => this.updateRowLabels()
      );

      // Navigation buttons
      this.dependencies.utils.dom.addListener(
        this.elements.dataInput.nextButton,
        "click",
        () => this.goToChartType()
      );

      this.dependencies.utils.dom.addListener(
        this.elements.chartType.backButton,
        "click",
        () => this.goToDataInput()
      );

      this.dependencies.utils.dom.addListener(
        this.elements.chartType.nextButton,
        "click",
        () => this.goToConfigure()
      );

      this.dependencies.utils.dom.addListener(
        this.elements.configure.backButton,
        "click",
        () => this.goToChartType()
      );

      this.dependencies.utils.dom.addListener(
        this.elements.configure.createButton,
        "click",
        () => this.createChart()
      );

      // Result actions
      this.dependencies.utils.dom.addListener(
        this.elements.result.createAnother,
        "click",
        () => this.startOver()
      );

      this.dependencies.utils.dom.addListener(
        this.elements.result.backButton,
        "click",
        () => this.goBackToConfigure()
      );

      // Chart type selection with keyboard support
      this.elements.chartType.options.forEach((option) => {
        // Click event
        this.dependencies.utils.dom.addListener(option, "click", (e) => {
          this.selectChartType(e.currentTarget);
        });

        // Keyboard support
        this.dependencies.utils.dom.addListener(option, "keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.selectChartType(e.currentTarget);
          }
        });
      });

      // Configuration input changes (debounced)
      const configInputs = [
        this.elements.configure.titleInput,
        this.elements.configure.xAxisInput,
        this.elements.configure.yAxisInput,
        this.elements.configure.colourScheme,
        this.elements.configure.showLegend,
        this.elements.configure.showGrid,
      ].filter(Boolean);

      configInputs.forEach((input) => {
        const eventType = input.type === "checkbox" ? "change" : "input";
        this.dependencies.utils.dom.addListener(
          input,
          eventType,
          this.dependencies.utils.performance.debounce(
            () => this.updateChartPreview(),
            300
          )
        );
      });
    }

    /**
     * Set up drag and drop functionality for file upload
     */
    setupDragAndDrop() {
      const fileLabel = this.dependencies.utils.dom.query(".gb-file-label");

      if (!fileLabel) {
        logWarn(
          "[Graph Builder Core] File upload label not found - drag and drop not available"
        );
        return;
      }

      logDebug("[Graph Builder Core] Setting up drag and drop for file upload");

      // Prevent default drag behaviours on the document
      this.dependencies.utils.dom.addListener(document, "dragenter", (e) =>
        e.preventDefault()
      );
      this.dependencies.utils.dom.addListener(document, "dragover", (e) =>
        e.preventDefault()
      );
      this.dependencies.utils.dom.addListener(document, "drop", (e) =>
        e.preventDefault()
      );

      // Drag enter - highlight drop zone
      this.dependencies.utils.dom.addListener(fileLabel, "dragenter", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleDragEnter(fileLabel);
      });

      // Drag over - maintain highlight and show copy cursor
      this.dependencies.utils.dom.addListener(fileLabel, "dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        this.handleDragOver(fileLabel);
      });

      // Drag leave - remove highlight when leaving drop zone
      this.dependencies.utils.dom.addListener(fileLabel, "dragleave", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Only remove highlight if we're actually leaving the drop zone
        // (not just moving between child elements)
        if (!fileLabel.contains(e.relatedTarget)) {
          this.handleDragLeave(fileLabel);
        }
      });

      // Drop - handle the dropped file
      this.dependencies.utils.dom.addListener(fileLabel, "drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleFileDrop(e, fileLabel);
      });

      logInfo("[Graph Builder Core] Drag and drop functionality initialised");
    }

    /**
     * Handle drag enter event
     * @param {HTMLElement} fileLabel - File upload label element
     */
    handleDragEnter(fileLabel) {
      logDebug("[Graph Builder Core] File drag enter");

      fileLabel.classList.add("gb-drag-active");

      // Update visual feedback
      const uploadText = fileLabel.querySelector(".gb-upload-text");
      if (uploadText) {
        uploadText.dataset.originalText = uploadText.textContent;
        uploadText.textContent = "Drop CSV file here";
      }
    }

    /**
     * Handle drag over event
     * @param {HTMLElement} fileLabel - File upload label element
     */
    handleDragOver(fileLabel) {
      logDebug("[Graph Builder Core] File drag over");

      // Ensure the visual state is maintained
      if (!fileLabel.classList.contains("gb-drag-active")) {
        fileLabel.classList.add("gb-drag-active");
      }
    }

    /**
     * Handle drag leave event
     * @param {HTMLElement} fileLabel - File upload label element
     */
    handleDragLeave(fileLabel) {
      logDebug("[Graph Builder Core] File drag leave");

      fileLabel.classList.remove("gb-drag-active");

      // Restore original text
      const uploadText = fileLabel.querySelector(".gb-upload-text");
      if (uploadText && uploadText.dataset.originalText) {
        uploadText.textContent = uploadText.dataset.originalText;
        delete uploadText.dataset.originalText;
      }
    }

    /**
     * Handle file drop event
     * @param {DragEvent} event - Drop event
     * @param {HTMLElement} fileLabel - File upload label element
     */
    async handleFileDrop(event, fileLabel) {
      logInfo("[Graph Builder Core] File dropped");

      // Clean up drag state
      this.handleDragLeave(fileLabel);

      try {
        const files = event.dataTransfer.files;

        if (files.length === 0) {
          this.dependencies.notifications.warning("No files detected in drop");
          return;
        }

        if (files.length > 1) {
          this.dependencies.notifications.warning(
            "Please drop only one CSV file at a time"
          );
          return;
        }

        const file = files[0];

        // Validate file type
        if (!this.validateDroppedFile(file)) {
          return; // Error already shown in validation
        }

        // Process the dropped file using existing file handling logic
        await this.processDroppedFile(file);
      } catch (error) {
        logError("[Graph Builder Core] Error handling dropped file:", error);
        this.dependencies.notifications.error(
          "Error processing dropped file: " + error.message
        );
      }
    }

    /**
     * Validate dropped file
     * @param {File} file - Dropped file
     * @returns {boolean} Whether file is valid
     */
    validateDroppedFile(file) {
      logDebug("[Graph Builder Core] Validating dropped file:", file.name);

      // Check file type
      const fileName = file.name.toLowerCase();
      const validExtensions = [".csv", ".txt"];
      const hasValidExtension = validExtensions.some((ext) =>
        fileName.endsWith(ext)
      );

      if (!hasValidExtension) {
        this.dependencies.notifications.error(
          `Invalid file type. Please drop a CSV file (.csv or .txt). You dropped: ${file.name}`
        );
        return false;
      }

      // Check file size (1MB limit)
      const maxSize = 1024 * 1024; // 1MB
      if (file.size > maxSize) {
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        this.dependencies.notifications.error(
          `File too large (${fileSizeMB}MB). Maximum size is 1MB. Please choose a smaller file.`
        );
        return false;
      }

      // Check if file is empty
      if (file.size === 0) {
        this.dependencies.notifications.error(
          "File appears to be empty. Please choose a file with data."
        );
        return false;
      }

      return true;
    }

    /**
     * Process dropped file
     * @param {File} file - File to process
     */
    async processDroppedFile(file) {
      logInfo("[Graph Builder Core] Processing dropped file:", file.name);

      try {
        // Clear existing state
        this.clearDataState();

        // Show loading notification
        this.dependencies.notifications.info(
          `Processing dropped file "${file.name}"...`
        );

        // Process file using existing data processing pipeline
        state.chartData = await this.dependencies.data.processFile(file);

        // Show preview
        this.dependencies.ui.showPreview(state.chartData);

        // Enable next button
        if (this.elements.dataInput.nextButton) {
          this.elements.dataInput.nextButton.disabled = false;
        }

        // Update file input to reflect the dropped file
        const fileInput = this.elements.dataInput.fileInput;
        if (fileInput) {
          // Create a new FileList with the dropped file
          const dt = new DataTransfer();
          dt.items.add(file);
          fileInput.files = dt.files;
        }

        // Success notification
        this.dependencies.notifications.success(
          `File "${file.name}" uploaded successfully (${state.chartData.rows.length} rows, ${state.chartData.headers.length} columns)`
        );

        logInfo("[Graph Builder Core] File processed successfully");
      } catch (error) {
        logError("[Graph Builder Core] Dropped file processing error:", error);
        this.dependencies.notifications.error(
          `Error processing "${file.name}": ${error.message}`
        );
        this.clearDataState();
      }
    }

    /**
     * Handle file upload (existing method - no changes needed)
     * @param {Event} event - File input change event
     */
    async handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      try {
        this.clearDataState();
        this.dependencies.notifications.info(`Loading file "${file.name}"...`);

        state.chartData = await this.dependencies.data.processFile(file);
        this.dependencies.ui.showPreview(state.chartData);

        if (this.elements.dataInput.nextButton) {
          this.elements.dataInput.nextButton.disabled = false;
        }

        this.dependencies.notifications.success(
          `File "${file.name}" loaded successfully (${state.chartData.rows.length} rows)`
        );
      } catch (error) {
        logError("[Graph Builder Core] File processing error:", error);
        this.dependencies.notifications.error(
          `Error reading file: ${error.message}`
        );
        event.target.value = ""; // Reset file input
        this.clearDataState();
      }
    }

    /**
     * Initialize the data input screen
     */
    initializeDataInput() {
      // Set default column headers
      if (this.elements.dataInput.columnHeaders.col1) {
        this.elements.dataInput.columnHeaders.col1.value = "Category";
      }
      if (this.elements.dataInput.columnHeaders.col2) {
        this.elements.dataInput.columnHeaders.col2.value = "Value";
      }

      // Add initial data rows
      this.addDataRow();
      this.addDataRow();

      // Switch to form method (silent initialization)
      this.switchDataMethod("form", false);
    }

    /**
     * Switch between data input methods
     * @param {string} method - Data input method (form, paste, upload)
     * @param {boolean} isUserInitiated - Whether this is a user action (default: true)
     */
    switchDataMethod(method, isUserInitiated = true) {
      state.currentDataMethod = method;
      this.dependencies.ui.switchTab(method, isUserInitiated);

      // Clear state when switching methods
      this.clearDataState();
    }

    /**
     * Clear data state for method switching
     */
    clearDataState() {
      state.chartData = null;
      this.dependencies.ui.hidePreview();

      if (this.elements.dataInput.nextButton) {
        this.elements.dataInput.nextButton.disabled = true;
      }

      // Clear inputs based on method
      if (
        state.currentDataMethod !== "upload" &&
        this.elements.dataInput.fileInput
      ) {
        this.elements.dataInput.fileInput.value = "";
      }

      if (
        state.currentDataMethod !== "paste" &&
        this.elements.dataInput.csvInput
      ) {
        this.elements.dataInput.csvInput.value = "";
      }
    }

    /**
     * Add a new data row to the form
     */
    addDataRow() {
      if (!this.elements.dataInput.dataRows) {
        logError("[Graph Builder Core] Data rows container not found");
        return;
      }

      state.formRowCount++;
      const rowId = `gb-row-${state.formRowCount}`;

      // Get current column names
      const col1Name =
        this.elements.dataInput.columnHeaders.col1?.value || "Category";
      const col2Name =
        this.elements.dataInput.columnHeaders.col2?.value || "Value";

      // Create row element
      const rowDiv = this.dependencies.utils.dom.create("div", {
        className: "gb-data-row",
        "data-row-id": rowId,
      });

      rowDiv.innerHTML = `
      <div class="gb-input-group">
        <label for="${rowId}-col1" class="gb-row-label">${col1Name}:</label>
        <input 
          type="text" 
          id="${rowId}-col1" 
          name="${rowId}-col1"
          required 
          aria-describedby="${rowId}-col1-help"
        >
        <span id="${rowId}-col1-help" class="sr-only">Enter ${col1Name.toLowerCase()} for row ${
        state.formRowCount
      }</span>
      </div>
      <div class="gb-input-group">
        <label for="${rowId}-col2" class="gb-row-label">${col2Name}:</label>
        <input 
          type="number" 
          id="${rowId}-col2" 
          name="${rowId}-col2"
          step="any"
          required 
          aria-describedby="${rowId}-col2-help"
        >
        <span id="${rowId}-col2-help" class="sr-only">Enter ${col2Name.toLowerCase()} for row ${
        state.formRowCount
      }</span>
      </div>
      <button 
        type="button" 
        class="gb-remove-row-button" 
        onclick="window.GraphBuilder.removeDataRow('${rowId}')" 
        aria-label="Remove row ${state.formRowCount}">
        <svg 
          height="21" 
          viewBox="0 0 21 21" 
          width="21" 
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          class="gb-remove-icon">
          <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 2)">
            <path d="m2.5 2.5h10v12c0 1.1045695-.8954305 2-2 2h-6c-1.1045695 0-2-.8954305-2-2zm5-2c1.0543618 0 1.91816512.81587779 1.99451426 1.85073766l.00548574.14926234h-4c0-1.1045695.8954305-2 2-2z"/>
            <path d="m.5 2.5h14"/>
            <path d="m5.5 5.5v8"/>
            <path d="m9.5 5.5v8"/>
          </g>
        </svg>
        Remove
      </button>
    `;

      this.elements.dataInput.dataRows.appendChild(rowDiv);

      // Focus the new input
      const firstInput = document.getElementById(`${rowId}-col1`);
      if (firstInput) {
        this.dependencies.utils.dom.focus(firstInput);
      }

      // Add validation listeners
      rowDiv.querySelectorAll("input").forEach((input) => {
        this.dependencies.utils.dom.addListener(input, "input", () =>
          this.validateFormData()
        );
      });

      this.validateFormData();
    }

    /**
     * Remove a data row from the form
     * @param {string} rowId - Row ID to remove
     */
    removeDataRow(rowId) {
      const row = this.dependencies.utils.dom.query(`[data-row-id="${rowId}"]`);
      if (row) {
        row.remove();
        this.validateFormData();
        this.dependencies.notifications.info("Row removed");
      }
    }

    /**
     * Update row labels when column headers change
     */
    updateRowLabels() {
      const col1Name =
        this.elements.dataInput.columnHeaders.col1?.value || "Category";
      const col2Name =
        this.elements.dataInput.columnHeaders.col2?.value || "Value";

      // Update all existing row labels
      this.dependencies.utils.dom
        .queryAll(".gb-data-row", this.elements.dataInput.dataRows)
        .forEach((row) => {
          const inputGroups = row.querySelectorAll(".gb-input-group");

          if (inputGroups[0]) {
            const col1Label = inputGroups[0].querySelector(".gb-row-label");
            if (col1Label) col1Label.textContent = `${col1Name}:`;
          }

          if (inputGroups[1]) {
            const col2Label = inputGroups[1].querySelector(".gb-row-label");
            if (col2Label) col2Label.textContent = `${col2Name}:`;
          }
        });
    }

    /**
     * Validate form data and update UI
     */
    validateFormData() {
      const rows = this.dependencies.utils.dom.queryAll(
        ".gb-data-row",
        this.elements.dataInput.dataRows
      );
      const validation = this.dependencies.data.validateFormData(rows);

      if (this.elements.dataInput.nextButton) {
        this.elements.dataInput.nextButton.disabled = !validation.valid;
      }

      if (validation.valid) {
        this.generateFormData();
      }
    }

    /**
     * Generate chart data from form inputs
     */
    generateFormData() {
      const rows = this.dependencies.utils.dom.queryAll(
        ".gb-data-row",
        this.elements.dataInput.dataRows
      );
      const columnHeaders = {
        col1Name:
          this.elements.dataInput.columnHeaders.col1?.value || "Category",
        col2Name: this.elements.dataInput.columnHeaders.col2?.value || "Value",
      };

      state.chartData = this.dependencies.data.extractFormData(
        rows,
        columnHeaders
      );

      if (state.chartData.rows.length >= 2) {
        this.dependencies.ui.showPreview(state.chartData);
      }
    }

    /**
     * Handle CSV input
     */
    async handleCSVInput() {
      const csvText = this.elements.dataInput.csvInput?.value.trim();

      if (!csvText) {
        this.clearDataState();
        return;
      }

      try {
        state.chartData = this.dependencies.data.parseCSV(csvText);
        this.dependencies.ui.showPreview(state.chartData);

        if (this.elements.dataInput.nextButton) {
          this.elements.dataInput.nextButton.disabled = false;
        }

        this.dependencies.notifications.success(
          `CSV parsed successfully (${state.chartData.rows.length} rows)`
        );
      } catch (error) {
        logError("[Graph Builder Core] CSV parsing failed:", error);
        this.dependencies.notifications.error(
          `CSV parsing error: ${error.message}`
        );
        this.clearDataState();
      }
    }

    /**
     * Handle file upload
     * @param {Event} event - File input change event
     */
    async handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      try {
        this.clearDataState();
        this.dependencies.notifications.info(`Loading file "${file.name}"...`);

        state.chartData = await this.dependencies.data.processFile(file);
        this.dependencies.ui.showPreview(state.chartData);

        if (this.elements.dataInput.nextButton) {
          this.elements.dataInput.nextButton.disabled = false;
        }

        this.dependencies.notifications.success(
          `File "${file.name}" loaded successfully (${state.chartData.rows.length} rows)`
        );
      } catch (error) {
        logError("[Graph Builder Core] File processing error:", error);
        this.dependencies.notifications.error(
          `Error reading file: ${error.message}`
        );
        event.target.value = ""; // Reset file input
        this.clearDataState();
      }
    }

    /**
     * Navigate to chart type selection
     */
    goToChartType() {
      if (!state.chartData) {
        this.dependencies.notifications.error("Please add data first");
        return;
      }

      this.dependencies.ui.switchScreen("chart-type");
      this.dependencies.ui.updateProgress(2);
    }

    /**
     * Navigate to data input
     */
    goToDataInput() {
      this.dependencies.ui.switchScreen("data-input");
      this.dependencies.ui.updateProgress(1);
    }

    /**
     * Navigate to configuration
     */
    goToConfigure() {
      if (!state.selectedChartType) {
        this.dependencies.notifications.error("Please select a chart type");
        return;
      }

      this.dependencies.ui.switchScreen("configure");
      this.dependencies.ui.updateProgress(3);
      this.initializeConfiguration();
    }

    /**
     * Navigate back to configuration from result
     */
    goBackToConfigure() {
      logInfo("[Graph Builder Core] Navigating back to configure from result");

      // Clear any existing charts in preview
      if (this.dependencies.charts.destroyPreview) {
        this.dependencies.charts.destroyPreview();
      }

      this.dependencies.ui.switchScreen("configure");
      this.dependencies.ui.updateProgress(3);

      // Re-initialise the configuration screen with current data
      if (state.chartData && state.selectedChartType) {
        this.initializeConfiguration();
      }
    }

    /**
     * Select chart type
     * @param {HTMLElement} optionElement - Selected chart type element
     */
    selectChartType(optionElement) {
      this.dependencies.ui.selectChartType(optionElement);
      state.selectedChartType = this.dependencies.ui.getSelectedChartType();
    }

    /**
     * Initialize configuration screen
     */
    initializeConfiguration() {
      // Set default values
      if (this.elements.configure.titleInput) {
        this.elements.configure.titleInput.value = "Chart Title";
      }
      if (this.elements.configure.xAxisInput) {
        this.elements.configure.xAxisInput.value =
          state.chartData.headers[0] || "X Axis";
      }
      if (this.elements.configure.yAxisInput) {
        this.elements.configure.yAxisInput.value =
          state.chartData.headers[1] || "Y Axis";
      }

      // Generate initial preview
      this.updateChartPreview();
    }

    /**
     * Update chart preview
     */
    updateChartPreview() {
      if (!state.chartData || !state.selectedChartType) return;

      const options = this.getConfigurationOptions();
      this.dependencies.charts.updatePreview(
        state.chartData,
        state.selectedChartType,
        options
      );
    }

    /**
     * Get current configuration options
     * @returns {Object} Configuration options
     */
    getConfigurationOptions() {
      return {
        title: this.elements.configure.titleInput?.value || "Chart Title",
        xAxisTitle: this.elements.configure.xAxisInput?.value || "X Axis",
        yAxisTitle: this.elements.configure.yAxisInput?.value || "Y Axis",
        colourScheme: this.elements.configure.colourScheme?.value || "default",
        showLegend: this.elements.configure.showLegend?.checked ?? true,
        showGrid: this.elements.configure.showGrid?.checked ?? true,
      };
    }

    /**
     * Create the final chart
     */
    async createChart() {
      try {
        this.dependencies.notifications.info(
          "Creating your accessible chart..."
        );

        // Validate data and chart type
        const validation = this.dependencies.charts.validateData(
          state.chartData,
          state.selectedChartType
        );
        if (!validation.valid) {
          throw new Error(
            `Data validation failed: ${validation.errors.join(", ")}`
          );
        }

        // Get configuration options
        const options = this.getConfigurationOptions();

        // Create the chart
        await this.dependencies.charts.createFinalChart(
          state.chartData,
          state.selectedChartType,
          options
        );

        // Switch to result screen
        this.dependencies.ui.switchScreen("result");
        this.dependencies.ui.updateProgress(4);

        this.dependencies.notifications.success("Chart created successfully!");
      } catch (error) {
        logError("[Graph Builder Core] Chart creation error:", error);
        this.dependencies.notifications.error(
          `Error creating chart: ${error.message}`
        );
      }
    }

    /**
     * Start over with a new chart
     */
    startOver() {
      logInfo("[Graph Builder Core] Starting over - resetting state");

      // Clean up charts
      this.dependencies.charts.destroyAllCharts();

      // Reset state
      Object.assign(state, {
        currentScreen: "data-input",
        currentDataMethod: "form",
        selectedChartType: null,
        chartData: null,
        formRowCount: 0,
      });

      // Clear UI
      this.dependencies.ui.clearChartTypeSelection();
      this.dependencies.ui.hidePreview();

      // Clear forms
      if (this.elements.dataInput.csvInput) {
        this.elements.dataInput.csvInput.value = "";
      }
      if (this.elements.dataInput.fileInput) {
        this.elements.dataInput.fileInput.value = "";
      }
      if (this.elements.dataInput.dataRows) {
        this.elements.dataInput.dataRows.innerHTML = "";
      }

      // Reset UI state
      this.dependencies.ui.switchScreen("data-input");
      this.dependencies.ui.updateProgress(1);

      if (this.elements.dataInput.nextButton) {
        this.elements.dataInput.nextButton.disabled = true;
      }
      if (this.elements.chartType.nextButton) {
        this.elements.chartType.nextButton.disabled = true;
      }

      // Re-initialize
      this.initializeDataInput();

      this.dependencies.notifications.info("Ready to create a new chart");
    }

    /**
     * Get current application state (for debugging)
     * @returns {Object} Current state
     */
    getState() {
      return {
        ...state,
        initialized: state.initialized,
        dependencies: Object.keys(this.dependencies).filter(
          (key) => !!this.dependencies[key]
        ),
      };
    }
  }

  /**
   * Accessibility Enhancement Manager
   * Ensures accessibility features are consistently applied to all charts
   */
  class AccessibilityEnhancementManager {
    constructor(controller) {
      this.controller = controller;
      this.initialized = false;
      this.enhancementAttempts = new Map(); // Track enhancement attempts per chart
      this.viewControlsAttempts = new Map(); // Track view controls attempts per chart
      this.maxAttempts = 3;
    }

    /**
     * Initialize the accessibility enhancement system
     */
    init() {
      if (this.initialized) return;

      logInfo(
        "[Accessibility Manager] Initializing enhancement system with view controls"
      );

      // Hook into chart creation process
      this.hookIntoChartCreation();

      // Set up navigation observers
      this.setupNavigationObservers();

      // Monitor for new charts being added to the DOM
      this.setupChartObserver();

      this.initialized = true;
      logInfo(
        "[Accessibility Manager] Enhancement system initialized with view controls support"
      );
    }

    /**
     * Hook into the chart creation process to automatically apply accessibility
     */
    hookIntoChartCreation() {
      if (!this.controller.createChart) {
        logWarn("[Accessibility Manager] createChart method not found");
        return;
      }

      // Store original method
      const originalCreateChart = this.controller.createChart.bind(
        this.controller
      );

      // Override with enhanced version
      this.controller.createChart = async (...args) => {
        logDebug("[Accessibility Manager] Enhanced chart creation triggered");

        try {
          // Call original chart creation
          const result = await originalCreateChart(...args);

          // Apply both accessibility and view controls enhancement after chart creation
          setTimeout(() => {
            this.ensureAccessibilityFeatures();
            this.ensureViewControls();
          }, 300); // Allow time for chart DOM to be ready

          return result;
        } catch (error) {
          logError(
            "[Accessibility Manager] Error in enhanced chart creation:",
            error
          );
          throw error;
        }
      };

      logInfo(
        "[Accessibility Manager] Hooked into chart creation process with view controls"
      );
    }

    /**
     * Set up observers for navigation events that might affect accessibility
     */
    setupNavigationObservers() {
      // Observe navigation button clicks
      const navigationMethods = [
        "goToChartType",
        "goToDataInput",
        "goToConfigure",
        "goBackToConfigure",
      ];

      navigationMethods.forEach((methodName) => {
        if (this.controller[methodName]) {
          const originalMethod = this.controller[methodName].bind(
            this.controller
          );

          this.controller[methodName] = (...args) => {
            logDebug(`[Accessibility Manager] Navigation: ${methodName}`);

            const result = originalMethod(...args);

            // Delayed enhancement check after navigation for both systems
            setTimeout(() => {
              this.ensureAccessibilityFeatures();
              this.ensureViewControls();
            }, 500);

            return result;
          };
        }
      });

      logInfo(
        "[Accessibility Manager] Navigation observers set up with view controls"
      );
    }

    /**
     * Set up MutationObserver to watch for new charts
     */
    setupChartObserver() {
      const observer = new MutationObserver((mutations) => {
        let newChartsDetected = false;

        mutations.forEach((mutation) => {
          if (mutation.type === "childList") {
            mutation.addedNodes.forEach((node) => {
              if (
                node.nodeType === Node.ELEMENT_NODE &&
                (node.classList.contains("chart-container") ||
                  node.querySelector(".chart-container"))
              ) {
                newChartsDetected = true;
              }
            });
          }
        });

        if (newChartsDetected) {
          logDebug("[Accessibility Manager] New charts detected via observer");
          setTimeout(() => {
            this.ensureAccessibilityFeatures();
            this.ensureViewControls();
          }, 100);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      logInfo(
        "[Accessibility Manager] Chart observer set up with view controls monitoring"
      );
    }

    /**
     * Check if a node is a chart container
     */
    isChartContainer(node) {
      return node.classList && node.classList.contains("chart-container");
    }

    /**
     * Ensure accessibility features are applied to all charts
     */
    ensureAccessibilityFeatures() {
      if (!window.ChartAccessibility) {
        logWarn("[Accessibility Manager] ChartAccessibility not available");
        return;
      }

      const containers = document.querySelectorAll(".chart-container");
      logDebug(
        `[Accessibility Manager] Checking ${containers.length} chart containers for accessibility`
      );

      let enhancementsApplied = 0;

      containers.forEach((container) => {
        if (this.needsAccessibilityEnhancement(container)) {
          const chartId = this.getOrCreateChartId(container);

          if (this.shouldAttemptEnhancement(chartId)) {
            logDebug(
              `[Accessibility Manager] Applying accessibility to ${chartId}`
            );

            try {
              this.applyAccessibilityFeatures(container, chartId);
              enhancementsApplied++;
            } catch (error) {
              logError(
                `[Accessibility Manager] Failed to enhance ${chartId}:`,
                error
              );
              this.recordEnhancementAttempt(chartId, false);
            }
          }
        }
      });

      if (enhancementsApplied > 0) {
        logInfo(
          `[Accessibility Manager] Applied accessibility to ${enhancementsApplied} charts`
        );
      }
    }

    /**
     * NEW: Ensure view controls are applied to all charts
     */
    ensureViewControls() {
      const containers = document.querySelectorAll(".chart-container");
      logDebug(
        `[Accessibility Manager] Checking ${containers.length} chart containers for view controls`
      );

      let viewControlsApplied = 0;

      containers.forEach((container) => {
        if (this.needsViewControlsEnhancement(container)) {
          const chartId = this.getOrCreateChartId(container);

          if (this.shouldAttemptViewControlsEnhancement(chartId)) {
            logDebug(
              `[Accessibility Manager] Applying view controls to ${chartId}`
            );

            try {
              this.applyViewControls(container, chartId);
              viewControlsApplied++;
            } catch (error) {
              logError(
                `[Accessibility Manager] Failed to add view controls to ${chartId}:`,
                error
              );
              this.recordViewControlsAttempt(chartId, false);
            }
          }
        }
      });

      if (viewControlsApplied > 0) {
        logInfo(
          `[Accessibility Manager] Applied view controls to ${viewControlsApplied} charts`
        );
      }
    }

    /**
     * NEW: Check if a container needs view controls enhancement
     */
    needsViewControlsEnhancement(container) {
      const hasCanvas = !!container.querySelector("canvas");
      const hasViewControls = !!container.querySelector(".chart-view-controls");
      return hasCanvas && !hasViewControls;
    }

    /**
     * NEW: Check if we should attempt view controls enhancement for this chart
     */
    shouldAttemptViewControlsEnhancement(chartId) {
      const attempts = this.viewControlsAttempts.get(chartId) || 0;
      return attempts < this.maxAttempts;
    }

    /**
     * NEW: Apply view controls to a specific container
     */
    applyViewControls(container, chartId) {
      // Method 1: Try ChartViewControls API first
      try {
        // Remove stale processing flag if DOM elements are missing
        if (
          container.classList.contains("view-controls-added") &&
          !container.querySelector(".chart-view-controls")
        ) {
          logDebug(
            `[Accessibility Manager] Removing stale view-controls-added flag from ${chartId}`
          );
          container.classList.remove("view-controls-added");
        }

        if (
          window.ChartViewControls &&
          typeof window.ChartViewControls.init === "function"
        ) {
          window.ChartViewControls.init(container);

          // Check if it worked
          setTimeout(() => {
            if (container.querySelector(".chart-view-controls")) {
              logDebug(
                `[Accessibility Manager] ChartViewControls.init() succeeded for ${chartId}`
              );
              this.recordViewControlsAttempt(chartId, true);
            } else {
              logDebug(
                `[Accessibility Manager] ChartViewControls.init() failed for ${chartId}, trying manual creation`
              );
              this.createViewControlsManually(container, chartId);
            }
          }, 50);
        } else {
          throw new Error("ChartViewControls.init not available");
        }
      } catch (error) {
        logDebug(
          `[Accessibility Manager] ChartViewControls API failed for ${chartId}, using manual creation`
        );
        this.createViewControlsManually(container, chartId);
      }
    }

    /**
     * NEW: Manually create view controls for a container
     */
    createViewControlsManually(container, chartId) {
      try {
        // Prevent duplicate creation
        if (container.querySelector(".chart-view-controls")) {
          return;
        }

        // Mark as processed
        container.classList.add("view-controls-added");

        // Create view controls container
        const viewControls = document.createElement("div");
        viewControls.className = "chart-view-controls";
        viewControls.setAttribute("role", "toolbar");
        viewControls.setAttribute("aria-label", "Chart view controls");

        // Create buttons with basic functionality
        const expandButton = this.createViewControlButton(
          this.getExpandIconSVG(),
          "Expand Width",
          `toggle-width-${chartId}`,
          "Toggle chart width"
        );

        const fullscreenButton = this.createViewControlButton(
          this.getFullscreenIconSVG(),
          "Fullscreen",
          `toggle-fullscreen-${chartId}`,
          "Toggle fullscreen mode"
        );

        // Add event handlers
        this.addViewControlEventHandlers(
          container,
          expandButton,
          fullscreenButton
        );

        // Add buttons to controls
        viewControls.appendChild(expandButton);
        viewControls.appendChild(fullscreenButton);

        // Insert at beginning of container
        if (container.firstChild) {
          container.insertBefore(viewControls, container.firstChild);
        } else {
          container.appendChild(viewControls);
        }

        this.recordViewControlsAttempt(chartId, true);
        logDebug(
          `[Accessibility Manager] Manual view controls created for ${chartId}`
        );
      } catch (error) {
        logError(
          `[Accessibility Manager] Manual view controls creation failed for ${chartId}:`,
          error
        );
        this.recordViewControlsAttempt(chartId, false);
      }
    }

    /**
     * NEW: Create a view control button
     */
    createViewControlButton(icon, text, id, ariaLabel) {
      const button = document.createElement("button");
      button.id = id;
      button.className = "chart-view-button";
      button.innerHTML = `${icon} <span class="button-text">${text}</span>`;
      button.setAttribute("aria-label", ariaLabel);
      button.setAttribute("type", "button");
      return button;
    }

    /**
     * NEW: Add event handlers for view control buttons
     */
    addViewControlEventHandlers(container, expandButton, fullscreenButton) {
      // Expand/collapse handler
      expandButton.addEventListener("click", () => {
        const isExpanded = container.classList.toggle("expanded");
        expandButton.innerHTML = isExpanded
          ? `${this.getCollapseIconSVG()} <span class="button-text">Collapse Width</span>`
          : `${this.getExpandIconSVG()} <span class="button-text">Expand Width</span>`;

        // Trigger resize for Chart.js
        window.dispatchEvent(new Event("resize"));

        const canvas = container.querySelector("canvas");
        if (canvas && typeof Chart !== "undefined") {
          const chartInstance = Chart.getChart(canvas);
          if (chartInstance) {
            chartInstance.resize();
          }
        }
      });

      // Fullscreen handler
      fullscreenButton.addEventListener("click", () => {
        const isFullscreen = container.classList.contains("fullscreen-mode");

        if (isFullscreen) {
          container.classList.remove("fullscreen-mode");
          document.body.style.overflow = "";
          fullscreenButton.innerHTML = `${this.getFullscreenIconSVG()} <span class="button-text">Fullscreen</span>`;
        } else {
          container.classList.add("fullscreen-mode");
          document.body.style.overflow = "hidden";
          fullscreenButton.innerHTML = `${this.getExitFullscreenIconSVG()} <span class="button-text">Exit Fullscreen</span>`;
        }
      });
    }

    /**
     * NEW: Record a view controls enhancement attempt
     */
    recordViewControlsAttempt(chartId, success) {
      if (success) {
        this.viewControlsAttempts.delete(chartId);
      } else {
        const currentAttempts = this.viewControlsAttempts.get(chartId) || 0;
        this.viewControlsAttempts.set(chartId, currentAttempts + 1);

        if (currentAttempts + 1 >= this.maxAttempts) {
          logWarn(
            `[Accessibility Manager] Max view controls attempts reached for ${chartId}`
          );
        }
      }
    }

    /**
     * Check if a container needs accessibility enhancement
     */
    needsAccessibilityEnhancement(container) {
      const csvButton = container.querySelector(
        '[aria-label*="CSV"], [aria-label*="csv"]'
      );
      const tableButton = container.querySelector(
        '[aria-label*="table"], [aria-label*="Table"]'
      );
      const descButton = container.querySelector(
        '[aria-label*="description"], [aria-label*="Description"]'
      );

      return !(csvButton && tableButton && descButton);
    }

    getOrCreateChartId(container) {
      if (container.id) {
        return container.id;
      }

      const chartId = `gb-chart-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}`;
      container.id = chartId;
      return chartId;
    }

    /**
     * Get or create a chart ID for a container
     */
    getOrCreateChartId(container) {
      if (container.id) {
        return container.id;
      }

      // Generate a unique ID
      const chartId = `gb-chart-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}`;
      container.id = chartId;
      return chartId;
    }

    /**
     * Check if we should attempt enhancement for this chart
     */
    shouldAttemptEnhancement(chartId) {
      const attempts = this.enhancementAttempts.get(chartId) || 0;
      return attempts < this.maxAttempts;
    }

    /**
     * Apply accessibility features to a specific container
     */
    applyAccessibilityFeatures(container, chartId) {
      container.removeAttribute("data-accessibility-initialized");
      window.ChartAccessibility.initAccessibilityFeatures(container, chartId);
      this.recordEnhancementAttempt(chartId, true);

      setTimeout(() => {
        if (this.needsAccessibilityEnhancement(container)) {
          logWarn(
            `[Accessibility Manager] Enhancement verification failed for ${chartId}`
          );
          this.recordEnhancementAttempt(chartId, false);
        } else {
          logDebug(
            `[Accessibility Manager] Enhancement verified for ${chartId}`
          );
        }
      }, 100);
    }

    /**
     * Record an enhancement attempt
     */
    recordEnhancementAttempt(chartId, success) {
      if (success) {
        this.enhancementAttempts.delete(chartId);
      } else {
        const currentAttempts = this.enhancementAttempts.get(chartId) || 0;
        this.enhancementAttempts.set(chartId, currentAttempts + 1);

        if (currentAttempts + 1 >= this.maxAttempts) {
          logWarn(
            `[Accessibility Manager] Max enhancement attempts reached for ${chartId}`
          );
        }
      }
    }

    /**
     * Force refresh accessibility for all charts (manual override)
     */
    forceRefreshAll() {
      logInfo(
        "[Accessibility Manager] Force refreshing all chart accessibility and view controls"
      );

      // Clear all attempt records
      this.enhancementAttempts.clear();
      this.viewControlsAttempts.clear();

      // Remove all initialization flags
      const containers = document.querySelectorAll(".chart-container");
      containers.forEach((container) => {
        container.removeAttribute("data-accessibility-initialized");
        container.classList.remove("view-controls-added");

        // Remove existing view controls to prevent duplicates
        const existingControls = container.querySelector(
          ".chart-view-controls"
        );
        if (existingControls) {
          existingControls.remove();
        }
      });

      // Apply both enhancements
      this.ensureAccessibilityFeatures();
      this.ensureViewControls();
    }
    /**
     * Get status information for debugging
     */
    getStatus() {
      const containers = document.querySelectorAll(".chart-container");
      const containerStatus = Array.from(containers).map((container) => {
        const chartId = container.id || "no-id";
        return {
          chartId,
          needsAccessibilityEnhancement:
            this.needsAccessibilityEnhancement(container),
          needsViewControlsEnhancement:
            this.needsViewControlsEnhancement(container),
          accessibilityAttempts: this.enhancementAttempts.get(chartId) || 0,
          viewControlsAttempts: this.viewControlsAttempts.get(chartId) || 0,
          initialized:
            container.getAttribute("data-accessibility-initialized") === "true",
          hasViewControls: !!container.querySelector(".chart-view-controls"),
        };
      });

      return {
        totalContainers: containers.length,
        containerStatus,
        enhancementAttempts: Array.from(this.enhancementAttempts.entries()),
        viewControlsAttempts: Array.from(this.viewControlsAttempts.entries()),
        chartAccessibilityAvailable: !!window.ChartAccessibility,
        chartViewControlsAvailable: !!window.ChartViewControls,
      };
    }
    // NEW: SVG icon methods for manual creation
    getExpandIconSVG() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <polyline points="15 3 21 3 21 9"></polyline>
      <polyline points="9 21 3 21 3 15"></polyline>
      <line x1="21" y1="3" x2="14" y2="10"></line>
      <line x1="3" y1="21" x2="10" y2="14"></line>
    </svg>`;
    }

    getCollapseIconSVG() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <polyline points="4 14 10 14 10 20"></polyline>
      <polyline points="20 10 14 10 14 4"></polyline>
      <line x1="14" y1="10" x2="21" y2="3"></line>
      <line x1="3" y1="21" x2="10" y2="14"></line>
    </svg>`;
    }

    getFullscreenIconSVG() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
    </svg>`;
    }

    getExitFullscreenIconSVG() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
    </svg>`;
    }
  }

  // Create singleton instance
  const controller = new GraphBuilderController();

  // Initialize when DOM is ready (only if Graph Builder section is visible)
  document.addEventListener("DOMContentLoaded", function () {
    const graphBuilderArticle = document.getElementById("graph-builder");
    if (
      graphBuilderArticle &&
      !graphBuilderArticle.classList.contains("hidden")
    ) {
      // Small delay to ensure all modules are loaded
      setTimeout(() => {
        controller.init();
      }, 100);
    }
  });

  logInfo("[Graph Builder Core] Module loaded successfully");

  // Public API
  return {
    // Main interface
    init: () => controller.init(),

    // Navigation methods (called by UI)
    removeDataRow: (rowId) => controller.removeDataRow(rowId),

    // Configuration initialization (for progress navigation)
    initializeConfiguration: () => controller.initializeConfiguration(),

    // State access
    getState: () => controller.getState(),

    // View controls management (NEW)
    forceRefreshViewControls: () => controller.forceRefreshViewControls(),
    ensureChartViewControls: (chartId) =>
      controller.ensureChartViewControls(chartId),
    checkViewControlsStatus: (chartId) =>
      controller.checkViewControlsStatus(chartId),

    // For debugging and testing
    // Accessibility management
    forceRefreshAccessibility: () => controller.forceRefreshAccessibility(),
    getAccessibilityStatus: () => controller.getAccessibilityStatus(),
    ensureChartAccessibility: (chartId) =>
      controller.ensureChartAccessibility(chartId),

    _instance: controller,
    _state: state,
  };
})();

// Make available globally for onclick handlers and debugging
window.GraphBuilder = GraphBuilder;
window.graphBuilder = GraphBuilder; // Backward compatibility
