/**
 * Graph Builder UI
 * Handles user interface management, navigation, and screen controls
 *
 * Dependencies:
 * - GraphBuilderNotifications (for user feedback)
 * - GraphBuilderData (for data validation)
 *
 * @version 1.0.0
 */

const GraphBuilderUI = (function () {
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

  // UI State
  const state = {
    currentScreen: "data-input",
    currentDataMethod: "form",
    selectedChartType: null,
    formRowCount: 0,
    previewState: null,
  };

  /**
   * Screen Manager
   * Handles navigation between different screens in the workflow
   */
  class ScreenManager {
    constructor() {
      this.screens = {};
      this.elements = {};
      this.initScreens();
    }

    /**
     * Initialise screen references
     */
    initScreens() {
      this.screens = {
        dataInput: document.getElementById("gb-data-input"),
        chartType: document.getElementById("gb-chart-type"),
        configure: document.getElementById("gb-configure"),
        result: document.getElementById("gb-result"),
      };

      // Progress steps
      this.elements.steps = {
        step1: document.getElementById("gb-step-1"),
        step2: document.getElementById("gb-step-2"),
        step3: document.getElementById("gb-step-3"),
        step4: document.getElementById("gb-step-4"),
      };
    }

    /**
     * Switch to a specific screen
     * @param {string} screenName - Name of screen to switch to
     */
    switchTo(screenName) {
      logInfo(`[Graph Builder UI] Switching to screen: ${screenName}`);

      // Hide all screens
      Object.values(this.screens).forEach((screen) => {
        if (screen) {
          screen.classList.remove("active");
        }
      });

      // Map kebab-case to camelCase for screen names
      const screenMap = {
        "data-input": "dataInput",
        "chart-type": "chartType",
        configure: "configure",
        result: "result",
      };

      const targetScreenKey = screenMap[screenName] || screenName;
      const targetScreen = this.screens[targetScreenKey];

      if (targetScreen) {
        targetScreen.classList.add("active");
        state.currentScreen = screenName;

        // Focus management for accessibility
        setTimeout(() => {
          const heading = targetScreen.querySelector("h2");
          if (heading) {
            heading.focus();
          }
        }, 50); // Reduced timeout since we're not waiting for scroll anymore

        logInfo(`[Graph Builder UI] Successfully switched to ${screenName}`);
      } else {
        logError(`[Graph Builder UI] Screen not found: ${screenName}`);
        GraphBuilderNotifications.error(
          `Error: Could not switch to ${screenName}`
        );
      }
    }

    /**
     * Update progress indicator
     * @param {number} step - Current step number (1-4)
     */
    updateProgress(step) {
      Object.values(this.elements.steps).forEach((stepEl, index) => {
        stepEl.classList.remove("active", "completed");
        stepEl.removeAttribute("aria-current");

        if (index + 1 === step) {
          stepEl.classList.add("active");
          stepEl.setAttribute("aria-current", "step");
        } else if (index + 1 < step) {
          stepEl.classList.add("completed");
        }
      });
    }

    /**
     * Get current screen name
     * @returns {string} Current screen name
     */
    getCurrentScreen() {
      return state.currentScreen;
    }
  }

  /**
   * Tab Manager
   * Handles tab navigation for data input methods
   */
  class TabManager {
    constructor() {
      this.tabs = {};
      this.panels = {};
      this.initTabs();
      this.setupKeyboardNavigation();
    }

    /**
     * Initialise tab references
     */
    initTabs() {
      this.tabs = {
        form: document.getElementById("gb-tab-form"),
        paste: document.getElementById("gb-tab-paste"),
        upload: document.getElementById("gb-tab-upload"),
      };

      this.panels = {
        form: document.getElementById("gb-form-panel"),
        paste: document.getElementById("gb-paste-panel"),
        upload: document.getElementById("gb-upload-panel"),
      };
    }

    /**
     * Switch to a specific tab
     * @param {string} method - Data input method (form, paste, upload)
     * @param {boolean} isUserInitiated - Whether this is a user action (default: true)
     */
    switchTo(method, isUserInitiated = true) {
      logInfo(`[Graph Builder UI] Switching to tab: ${method}`);

      state.currentDataMethod = method;

      // Update tab buttons
      Object.entries(this.tabs).forEach(([key, tab]) => {
        if (tab) {
          tab.classList.toggle("active", key === method);
          tab.setAttribute("aria-selected", key === method ? "true" : "false");
        }
      });

      // Update panels
      Object.entries(this.panels).forEach(([key, panel]) => {
        if (panel) {
          panel.classList.toggle("active", key === method);
        }
      });

      // Focus management (only for user-initiated actions)
      if (isUserInitiated) {
        this.handleTabFocus(method);
      }

      // Only show notifications for user-initiated actions
      if (isUserInitiated) {
        GraphBuilderNotifications.info(`Switched to ${method} input method`);
      }
    }

    /**
     * Handle focus when switching tabs
     * @param {string} method - Active method
     */
    handleTabFocus(method) {
      setTimeout(() => {
        // Focus on the active tab button instead of diving into panel content
        // This follows ARIA tab pattern and prevents unwanted scrolling
        const activeTab = document.querySelector(`#gb-tab-${method}`);
        if (activeTab) {
          activeTab.focus();
          logDebug(`[Graph Builder UI] Focused on tab: ${method}`);
        } else {
          // Fallback: focus on the tab list container
          const tabList = document.querySelector(
            '.gb-method-tabs[role="tablist"]'
          );
          if (tabList) {
            tabList.focus();
            logDebug("[Graph Builder UI] Focused on tab list as fallback");
          }
        }
      }, 50); // Reduced timeout since we're not waiting for scroll
    }

    /**
     * Set up keyboard navigation for the progress indicator
     * Uses standard button navigation without tab role confusion
     */
    setupKeyboardNavigation() {
      const progressContainer = document.querySelector(".gb-progress");
      if (!progressContainer) return;

      // Use event delegation for better performance and dynamic content handling
      progressContainer.addEventListener("keydown", (e) => {
        // Only handle keyboard events on interactive step buttons
        if (!e.target.classList.contains("gb-step-button")) return;

        const buttons = Array.from(
          progressContainer.querySelectorAll(".gb-step-button:not([disabled])")
        );
        const currentIndex = buttons.indexOf(e.target);

        if (currentIndex === -1) return;

        let targetButton = null;

        switch (e.key) {
          case "ArrowRight":
          case "ArrowDown":
            e.preventDefault();
            targetButton = buttons[currentIndex + 1] || buttons[0]; // Wrap to first
            break;
          case "ArrowLeft":
          case "ArrowUp":
            e.preventDefault();
            targetButton =
              buttons[currentIndex - 1] || buttons[buttons.length - 1]; // Wrap to last
            break;
          case "Home":
            e.preventDefault();
            targetButton = buttons[0];
            break;
          case "End":
            e.preventDefault();
            targetButton = buttons[buttons.length - 1];
            break;
          case "Enter":
          case " ":
            // Let the default button behaviour handle this
            e.preventDefault();
            e.target.click();
            return;
        }

        if (targetButton) {
          targetButton.focus();
        }
      });

      logDebug(
        "[Progress Navigator] Accessible keyboard navigation initialised"
      );
    }

    /**
     * Get current tab method
     * @returns {string} Current tab method
     */
    getCurrentMethod() {
      return state.currentDataMethod;
    }
  }

  /**
   * Preview Manager
   * Handles data preview display and interactions
   */
  class PreviewManager {
    constructor() {
      this.container = document.getElementById("gb-data-preview");
      this.statsElement = document.getElementById("gb-preview-stats");
      this.tableElement = document.getElementById("gb-preview-table");
    }

    /**
     * Show data preview
     * @param {Object} data - Data to preview
     */
    show(data) {
      if (!data || !this.container) return;

      logInfo("[Graph Builder UI] Showing data preview for:", data);

      this.container.style.display = "block";
      this.statsElement.textContent = `${data.rows.length} rows, ${data.headers.length} columns`;

      // Initialise preview state
      state.previewState = {
        data: data,
        currentlyShowing: Math.min(10, data.rows.length),
        totalRows: data.rows.length,
        increment: 25,
      };

      this.renderTable();
    }

    /**
     * Hide data preview
     */
    hide() {
      if (this.container) {
        this.container.style.display = "none";
      }
      state.previewState = null;
    }

    /**
     * Render the preview table
     */
    renderTable() {
      if (!state.previewState || !this.tableElement) return;

      const { data, currentlyShowing, totalRows } = state.previewState;
      const thead = this.tableElement.querySelector("thead");
      const tbody = this.tableElement.querySelector("tbody");

      if (!thead || !tbody) {
        logError("[Graph Builder UI] Preview table elements not found");
        return;
      }

      // Clear existing content
      thead.innerHTML = "";
      tbody.innerHTML = "";

      logDebug(
        "[Graph Builder UI] Rebuilding preview table with headers:",
        data.headers
      );

      // Create header row
      const headerRow = document.createElement("tr");
      data.headers.forEach((header) => {
        const th = document.createElement("th");
        th.setAttribute("scope", "col");
        th.textContent = header;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);

      // Create data rows
      const rowsToShow = data.rows.slice(0, currentlyShowing);
      rowsToShow.forEach((row, index) => {
        const tr = document.createElement("tr");
        row.forEach((cell, cellIndex) => {
          const td = document.createElement("td");
          td.setAttribute("data-label", data.headers[cellIndex]);

          // Handle empty cells
          if (cell === "" || cell === null || cell === undefined) {
            td.className = "gb-empty-cell";
            td.innerHTML = "<em>empty</em>";
          } else {
            // Add type-specific classes
            if (typeof cell === "number") {
              td.className = "gb-data-type-number";
              td.textContent = cell;
            } else if (typeof cell === "boolean") {
              td.className = "gb-data-type-boolean";
              td.textContent = cell ? "Yes" : "No";
            } else {
              td.textContent = cell;
            }
          }

          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });

      // Add control row if needed
      this.addControlRow(tbody, data.headers.length);
    }

    /**
     * Add control row for showing more/less data
     * @param {HTMLElement} tbody - Table body element
     * @param {number} columnCount - Number of columns
     */
    addControlRow(tbody, columnCount) {
      if (!state.previewState) return;

      const { currentlyShowing, totalRows, increment } = state.previewState;

      if (totalRows > currentlyShowing) {
        const remaining = totalRows - currentlyShowing;
        const controlRow = document.createElement("tr");
        controlRow.className = "gb-preview-control-row";

        const td = document.createElement("td");
        td.setAttribute("colspan", columnCount);
        td.className = "gb-preview-controls";

        td.innerHTML = `
            <div class="gb-preview-status">
              Showing ${currentlyShowing} of ${totalRows} rows
            </div>
            <div class="gb-preview-actions">
              <button 
                type="button" 
                class="gb-show-more-button"
                aria-label="Show ${Math.min(increment, remaining)} more rows">
                Show ${Math.min(increment, remaining)} more rows
              </button>
              ${
                currentlyShowing > 10
                  ? `
                <button 
                  type="button" 
                  class="gb-show-less-button"
                  aria-label="Show fewer rows">
                  Show less
                </button>`
                  : ""
              }
              <button 
                type="button" 
                class="gb-show-all-button"
                aria-label="Show all ${totalRows} rows">
                Show all (${totalRows})
              </button>
            </div>
          `;

        // Add event listeners
        const showMoreBtn = td.querySelector(".gb-show-more-button");
        const showLessBtn = td.querySelector(".gb-show-less-button");
        const showAllBtn = td.querySelector(".gb-show-all-button");

        if (showMoreBtn) {
          showMoreBtn.addEventListener("click", () => this.showMoreRows());
        }
        if (showLessBtn) {
          showLessBtn.addEventListener("click", () => this.showLessRows());
        }
        if (showAllBtn) {
          showAllBtn.addEventListener("click", () => this.showAllRows());
        }

        controlRow.appendChild(td);
        tbody.appendChild(controlRow);
      } else if (currentlyShowing > 10 && totalRows === currentlyShowing) {
        // Show "Show less" option when all rows are displayed
        const controlRow = document.createElement("tr");
        controlRow.className = "gb-preview-control-row";

        const td = document.createElement("td");
        td.setAttribute("colspan", columnCount);
        td.className = "gb-preview-controls";

        td.innerHTML = `
            <div class="gb-preview-status">
              Showing all ${totalRows} rows
            </div>
            <div class="gb-preview-actions">
              <button 
                type="button" 
                class="gb-show-less-button"
                aria-label="Show fewer rows">
                Show less
              </button>
            </div>
          `;

        const showLessBtn = td.querySelector(".gb-show-less-button");
        if (showLessBtn) {
          showLessBtn.addEventListener("click", () => this.showLessRows());
        }

        controlRow.appendChild(td);
        tbody.appendChild(controlRow);
      }
    }

    /**
     * Show more rows in preview
     */
    showMoreRows() {
      if (!state.previewState) return;

      const { totalRows, currentlyShowing, increment } = state.previewState;
      const remaining = totalRows - currentlyShowing;
      const toAdd = Math.min(increment, remaining);

      state.previewState.currentlyShowing += toAdd;
      this.renderTable();

      GraphBuilderNotifications.info(
        `Now showing ${state.previewState.currentlyShowing} of ${totalRows} rows`
      );
    }

    /**
     * Show all rows in preview
     */
    showAllRows() {
      if (!state.previewState) return;

      const { totalRows } = state.previewState;

      // Warn for very large datasets
      if (totalRows > 200) {
        if (
          !confirm(
            `This will display all ${totalRows} rows, which may affect performance. Continue?`
          )
        ) {
          return;
        }
      }

      state.previewState.currentlyShowing = totalRows;
      this.renderTable();

      GraphBuilderNotifications.info(`Now showing all ${totalRows} rows`);
    }

    /**
     * Show fewer rows in preview
     */
    showLessRows() {
      if (!state.previewState) return;

      state.previewState.currentlyShowing = 10; // Reset to initial view
      this.renderTable();

      GraphBuilderNotifications.info("Now showing first 10 rows");
    }

    /**
     * Get current preview state
     * @returns {Object|null} Preview state
     */
    getState() {
      return state.previewState;
    }
  }

  /**
   * Chart Type Selector
   * Handles chart type selection interface
   */
  class ChartTypeSelector {
    constructor() {
      this.options = document.querySelectorAll(".gb-chart-option");
      // Event listeners are handled by the core controller
    }

    /**
     * Select a chart type
     * @param {HTMLElement} optionElement - Selected option element
     */
    selectType(optionElement) {
      // Clear previous selection
      this.options.forEach((opt) => {
        opt.classList.remove("selected");
        opt.setAttribute("aria-pressed", "false");
      });

      // Select new option
      optionElement.classList.add("selected");
      optionElement.setAttribute("aria-pressed", "true");

      state.selectedChartType = optionElement.dataset.chartType;

      // Enable next button
      const nextButton = document.getElementById("gb-chart-next");
      if (nextButton) {
        nextButton.disabled = false;
      }

      const chartName = optionElement.querySelector("h3").textContent;
      GraphBuilderNotifications.success(`Selected ${chartName}`);
    }

    /**
     * Get selected chart type
     * @returns {string|null} Selected chart type
     */
    getSelectedType() {
      return state.selectedChartType;
    }

    /**
     * Clear selection
     */
    clearSelection() {
      this.options.forEach((opt) => {
        opt.classList.remove("selected");
        opt.setAttribute("aria-pressed", "false");
      });
      state.selectedChartType = null;

      const nextButton = document.getElementById("gb-chart-next");
      if (nextButton) {
        nextButton.disabled = true;
      }
    }
  }

  /**
   * Progress Navigator
   * Handles interactive progress indicator navigation
   */
  class ProgressNavigator {
    constructor() {
      this.steps = [];
      this.currentStep = 1;
      this.maxCompletedStep = 1;
      this.initSteps();
      this.setupEventListeners();
      this.setupKeyboardNavigation();
    }

    /**
     * Initialise step references
     */
    initSteps() {
      this.steps = [
        { id: "gb-step-1", target: "data-input", label: "Add Data" },
        { id: "gb-step-2", target: "chart-type", label: "Choose Chart" },
        { id: "gb-step-3", target: "configure", label: "Configure" },
        { id: "gb-step-4", target: "result", label: "Complete" },
      ];
    }

    /**
     * Set up click event listeners for interactive steps
     */
    setupEventListeners() {
      this.steps.forEach((step, index) => {
        const stepElement = document.getElementById(step.id);
        if (stepElement) {
          const button = stepElement.querySelector(".gb-step-button");
          if (button) {
            button.addEventListener("click", (e) => {
              e.preventDefault();
              this.navigateToStep(index + 1);
            });
          }
        }
      });
    }

    /**
     * Set up keyboard navigation for the progress indicator
     */
    setupKeyboardNavigation() {
      const progressNav = document.querySelector(".gb-progress");
      if (!progressNav) return;

      progressNav.addEventListener("keydown", (e) => {
        const buttons = Array.from(
          progressNav.querySelectorAll(".gb-step-button:not([disabled])")
        );
        const currentIndex = buttons.findIndex(
          (btn) => btn === document.activeElement
        );

        let targetButton = null;

        switch (e.key) {
          case "ArrowRight":
          case "ArrowDown":
            e.preventDefault();
            targetButton = buttons[currentIndex + 1] || buttons[0];
            break;
          case "ArrowLeft":
          case "ArrowUp":
            e.preventDefault();
            targetButton =
              buttons[currentIndex - 1] || buttons[buttons.length - 1];
            break;
          case "Home":
            e.preventDefault();
            targetButton = buttons[0];
            break;
          case "End":
            e.preventDefault();
            targetButton = buttons[buttons.length - 1];
            break;
          case "Enter":
          case " ":
            if (currentIndex >= 0) {
              e.preventDefault();
              buttons[currentIndex].click();
            }
            break;
        }

        if (targetButton) {
          targetButton.focus();
        }
      });
    }

    /**
     * Navigate to a specific step
     * @param {number} stepNumber - Step number (1-4)
     */
    navigateToStep(stepNumber) {
      // Validate step number
      if (stepNumber < 1 || stepNumber > 4) {
        logWarn("[Progress Navigator] Invalid step number:", stepNumber);
        return;
      }

      // Can only navigate to completed steps or current step
      if (stepNumber > this.maxCompletedStep + 1) {
        GraphBuilderNotifications.warning(
          "Please complete the current step before proceeding"
        );
        return;
      }

      // Get the target screen name
      const targetStep = this.steps[stepNumber - 1];
      if (!targetStep) return;

      logInfo(
        `[Progress Navigator] Navigating to step ${stepNumber}: ${targetStep.label}`
      );

      // Use the screen manager to switch screens
      screenManager.switchTo(targetStep.target);
      screenManager.updateProgress(stepNumber);

      // Update current step
      this.currentStep = stepNumber;

      // Announce navigation to screen readers
      GraphBuilderNotifications.info(
        `Navigated to step ${stepNumber}: ${targetStep.label}`
      );

      // Trigger the appropriate navigation method in the core controller
      this.triggerCoreNavigation(targetStep.target);
    }

    /**
     * Trigger the appropriate navigation method in the core controller
     * @param {string} targetScreen - Target screen name
     */
    triggerCoreNavigation(targetScreen) {
      // This will be called by the core controller when available
      if (window.GraphBuilder && window.GraphBuilder._instance) {
        const controller = window.GraphBuilder._instance;

        switch (targetScreen) {
          case "data-input":
            // No additional action needed - screen already switched
            break;
          case "chart-type":
            // Validate that we have data before allowing navigation
            if (!controller.getState().chartData) {
              GraphBuilderNotifications.error("Please add data first");
              this.navigateToStep(1); // Go back to data input
              return;
            }
            break;
          case "configure":
            // Validate that we have data and chart type
            const state = controller.getState();
            if (!state.chartData) {
              GraphBuilderNotifications.error("Please add data first");
              this.navigateToStep(1);
              return;
            }
            if (!state.selectedChartType) {
              GraphBuilderNotifications.error(
                "Please select a chart type first"
              );
              this.navigateToStep(2);
              return;
            }
            // Initialize configuration if needed
            if (controller.initializeConfiguration) {
              controller.initializeConfiguration();
            }
            break;
          case "result":
            // This should typically not be directly navigable
            GraphBuilderNotifications.warning("Please create your chart first");
            this.navigateToStep(3);
            return;
        }
      }
    }

    /**
     * Update progress and make steps interactive
     * @param {number} currentStep - Current step number
     * @param {number} maxCompleted - Maximum completed step
     */
    updateProgress(currentStep, maxCompleted = null) {
      this.currentStep = currentStep;
      if (maxCompleted !== null) {
        this.maxCompletedStep = Math.max(this.maxCompletedStep, maxCompleted);
      } else {
        this.maxCompletedStep = Math.max(this.maxCompletedStep, currentStep);
      }

      this.steps.forEach((step, index) => {
        const stepNumber = index + 1;
        const stepElement = document.getElementById(step.id);
        if (!stepElement) return;

        // Remove all state classes and ARIA attributes
        stepElement.classList.remove("active", "completed");
        stepElement.removeAttribute("aria-current");

        // Set proper step state classes
        if (stepNumber === currentStep) {
          stepElement.classList.add("active");
          stepElement.setAttribute("aria-current", "step");
        } else if (stepNumber < currentStep) {
          stepElement.classList.add("completed");
        }

        // Determine if this step should be interactive
        const shouldBeInteractive = stepNumber <= this.maxCompletedStep;

        // Update the interactive state with proper semantics
        this.updateStepInteractivity(
          stepElement,
          shouldBeInteractive,
          stepNumber,
          step
        );
      });
    }

    /**
     * Update step interactivity with proper semantic HTML
     * @param {HTMLElement} stepElement - Step element
     * @param {boolean} shouldBeInteractive - Whether step should be interactive
     * @param {number} stepNumber - Step number
     * @param {Object} step - Step configuration
     */
    updateStepInteractivity(
      stepElement,
      shouldBeInteractive,
      stepNumber,
      step
    ) {
      // Clear existing content but preserve the li element structure
      const isCurrentStep = stepNumber === this.currentStep;
      const isCompletedStep = stepNumber < this.currentStep;

      if (shouldBeInteractive) {
        // Create accessible interactive step
        stepElement.innerHTML = `
      <button type="button" class="gb-step-button" 
              data-target="${step.target}"
              aria-describedby="gb-step-${stepNumber}-desc"
              ${isCurrentStep ? 'aria-current="step"' : ""}>
        <span class="gb-step-number">${stepNumber}</span>
        <span class="gb-step-label">${step.label}</span>
        <span class="gb-step-status sr-only">
          ${
            isCurrentStep
              ? "Current step"
              : isCompletedStep
              ? "Completed step"
              : "Available step"
          }
        </span>
      </button>
      <span id="gb-step-${stepNumber}-desc" class="sr-only">
        Step ${stepNumber} of 4: ${step.label}. 
        ${shouldBeInteractive ? "Select to navigate to this step." : ""}
      </span>
    `;

        // Re-attach event listener for the new button
        const button = stepElement.querySelector(".gb-step-button");
        if (button) {
          button.addEventListener("click", (e) => {
            e.preventDefault();
            this.navigateToStep(stepNumber);
          });
        }
      } else {
        // Create accessible non-interactive step
        stepElement.innerHTML = `
      <span class="gb-step-non-interactive"
            aria-describedby="gb-step-${stepNumber}-desc">
        <span class="gb-step-number">${stepNumber}</span>
        <span class="gb-step-label">${step.label}</span>
        <span class="gb-step-status sr-only">
          ${
            isCurrentStep
              ? "Current step"
              : "Future step - complete previous steps first"
          }
        </span>
      </span>
      <span id="gb-step-${stepNumber}-desc" class="sr-only">
        Step ${stepNumber} of 4: ${step.label}. 
        Complete previous steps to access this step.
      </span>
    `;
      }
    }

    /**
     * Get current step number
     * @returns {number} Current step number
     */
    getCurrentStep() {
      return this.currentStep;
    }

    /**
     * Get maximum completed step
     * @returns {number} Maximum completed step
     */
    getMaxCompletedStep() {
      return this.maxCompletedStep;
    }
  }

  // Create instances
  const screenManager = new ScreenManager();
  const tabManager = new TabManager();
  const previewManager = new PreviewManager();
  const chartTypeSelector = new ChartTypeSelector();
  const progressNavigator = new ProgressNavigator();

  // Module initialisation message
  logInfo("[Graph Builder UI] Module loaded successfully");

  // Public API
  return {
    // Screen Management
    switchScreen: (screenName) => screenManager.switchTo(screenName),
    updateProgress: (step) => {
      screenManager.updateProgress(step);
      progressNavigator.updateProgress(step); // Add this line
    },
    getCurrentScreen: () => screenManager.getCurrentScreen(),

    // Tab Management
    switchTab: (method, isUserInitiated = true) =>
      tabManager.switchTo(method, isUserInitiated),
    getCurrentDataMethod: () => tabManager.getCurrentMethod(),

    // Preview Management
    showPreview: (data) => previewManager.show(data),
    hidePreview: () => previewManager.hide(),
    getPreviewState: () => previewManager.getState(),

    // Chart Type Selection
    selectChartType: (element) => chartTypeSelector.selectType(element),
    getSelectedChartType: () => chartTypeSelector.getSelectedType(),
    clearChartTypeSelection: () => chartTypeSelector.clearSelection(),

    // Progress Navigation - Add these methods
    navigateToStep: (stepNumber) =>
      progressNavigator.navigateToStep(stepNumber),
    getCurrentStep: () => progressNavigator.getCurrentStep(),
    getMaxCompletedStep: () => progressNavigator.getMaxCompletedStep(),

    // State Access
    getState: () => ({
      ...state,
      currentStep: progressNavigator.getCurrentStep(),
      maxCompletedStep: progressNavigator.getMaxCompletedStep(),
    }),

    // State Updates
    setFormRowCount: (count) => {
      state.formRowCount = count;
    },
    getFormRowCount: () => state.formRowCount,
    incrementFormRowCount: () => ++state.formRowCount,

    // Logging Configuration (public API for debugging)
    setLogLevel: (level) => {
      if (typeof level === "string") {
        currentLogLevel = LOG_LEVELS[level.toUpperCase()] ?? DEFAULT_LOG_LEVEL;
      } else if (typeof level === "number" && level >= 0 && level <= 3) {
        currentLogLevel = level;
      }
    },
    getLogLevel: () => currentLogLevel,
    getLogLevels: () => ({ ...LOG_LEVELS }),

    // For debugging and testing
    _managers: {
      screen: screenManager,
      tab: tabManager,
      preview: previewManager,
      chartType: chartTypeSelector,
      progress: progressNavigator, // Add this line
    },
  };
})();

// Export for other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = GraphBuilderUI;
} else {
  window.GraphBuilderUI = GraphBuilderUI;
}
