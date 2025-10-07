/**
 * Graph Builder Chart Sizing Integration
 * Extends the existing chart-controls.js system to handle Graph Builder Stage 4 charts
 *
 * This integration prevents chart view controls from overlapping with Graph Builder charts
 * by adapting the existing padding adjustment system for Graph Builder containers.
 *
 * Dependencies:
 * - chart-controls.js (ChartControls module)
 * - graph-builder-charts.js (GraphBuilderCharts module)
 * - chart-view-controls.js (ChartViewControls module)
 *
 * Integration Points:
 * - Hooks into existing scroll observer system
 * - Extends existing resize handlers
 * - Integrates with Graph Builder chart creation flow
 *
 * @version 1.0.0
 */

const GraphBuilderSizingIntegration = (function () {
  "use strict";

  // Logging configuration (module level)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Graph Builder Sizing] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Graph Builder Sizing] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.info(`[Graph Builder Sizing] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Graph Builder Sizing] DEBUG: ${message}`, ...args);
    }
  }

  // Configuration specific to Graph Builder
  const CONFIG = {
    // Graph Builder selectors
    gbFinalChartContainer: ".gb-final-chart-container",
    gbResultScreen: "#gb-result",
    gbChartViewControls: ".chart-view-controls",

    // Standard chart selectors for compatibility
    standardChartContainer: ".chart-container",
    standardChartControls: ".chart-controls",

    // Integration settings
    debounceDelay: 100,
    paddingBuffer: 20,
    maxRetries: 3,
    retryDelay: 50,

    // Debug settings
    debugAttribute: "data-gb-sizing-debug",
    debugClass: "gb-sizing-debug",
  };

  // State management
  const state = {
    initialised: false,
    pendingAdjustments: new Set(),
    retryAttempts: new Map(),
    lastAdjustTimes: new Map(),
    resizeObserver: null,
    mutationObserver: null,
  };

  // Dependencies cache
  const dependencies = {
    chartControls: null,
    chartViewControls: null,
    graphBuilderCharts: null,
  };

  /**
   * Initialise the Graph Builder sizing integration
   */
  function init() {
    if (state.initialised) {
      logDebug("Already initialised, skipping");
      return;
    }

    logInfo("Initialising Graph Builder chart sizing integration");

    // Cache dependencies
    if (!cacheDependencies()) {
      logError("Failed to cache required dependencies");
      return false;
    }

    // Set up Graph Builder-specific observers
    setupGraphBuilderObservers();

    // Integrate with existing chart controls system
    integrateWithExistingSystem();

    // Hook into Graph Builder chart creation
    hookIntoGraphBuilderChartCreation();

    // Set up console testing commands
    setupConsoleTestCommands();

    state.initialised = true;
    logInfo("Graph Builder sizing integration initialised successfully");
    return true;
  }

  /**
   * Cache required dependencies
   */
  function cacheDependencies() {
    logDebug("Caching dependencies");

    // Cache ChartControls
    if (typeof window.ChartControls !== "undefined") {
      dependencies.chartControls = window.ChartControls;
      logDebug("ChartControls dependency cached");
    } else {
      logWarn("ChartControls not available");
    }

    // Cache ChartViewControls
    if (typeof window.ChartViewControls !== "undefined") {
      dependencies.chartViewControls = window.ChartViewControls;
      logDebug("ChartViewControls dependency cached");
    } else {
      logWarn("ChartViewControls not available");
    }

    // Cache GraphBuilderCharts
    if (typeof window.GraphBuilderCharts !== "undefined") {
      dependencies.graphBuilderCharts = window.GraphBuilderCharts;
      logDebug("GraphBuilderCharts dependency cached");
    } else {
      logWarn("GraphBuilderCharts not available");
    }

    // At minimum, we need ChartControls for the core functionality
    return dependencies.chartControls !== null;
  }

  /**
   * Set up Graph Builder-specific observers
   */
  function setupGraphBuilderObservers() {
    logDebug("Setting up Graph Builder observers");

    // Create mutation observer for Graph Builder Stage 4
    state.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          // Check for new Graph Builder charts
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              checkForGraphBuilderCharts(node);
            }
          });
        }

        // Check for Stage 4 activation
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          const target = mutation.target;
          if (
            target.id === "gb-result" &&
            target.classList.contains("active")
          ) {
            logDebug("Stage 4 activated, checking for charts");
            setTimeout(() => {
              adjustAllGraphBuilderCharts();
            }, CONFIG.retryDelay);
          }
        }
      });
    });

    // Observe the Graph Builder container and Stage 4 specifically
    const gbContainer = document.querySelector("#GraphBuilder");
    if (gbContainer) {
      state.mutationObserver.observe(gbContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
      logDebug("Graph Builder mutation observer set up");
    }

    // Create resize observer for Graph Builder containers
    if (typeof ResizeObserver !== "undefined") {
      state.resizeObserver = new ResizeObserver(
        debounce((entries) => {
          entries.forEach((entry) => {
            const container = entry.target;
            if (isGraphBuilderChart(container)) {
              logDebug("Resize detected for Graph Builder chart");
              adjustGraphBuilderContainerPadding(container);
            }
          });
        }, CONFIG.debounceDelay)
      );

      // Observe existing Graph Builder containers
      document
        .querySelectorAll(CONFIG.gbFinalChartContainer)
        .forEach((container) => {
          state.resizeObserver.observe(container);
        });
    }
  }

  /**
   * Integrate with existing ChartControls system
   */
  function integrateWithExistingSystem() {
    logDebug("Integrating with existing ChartControls system");

    if (!dependencies.chartControls) {
      logWarn("ChartControls not available, skipping integration");
      return;
    }

    // Hook into existing scroll observer
    const originalSetupScrollObserver =
      dependencies.chartControls.setupScrollObserver;
    if (originalSetupScrollObserver) {
      // Extend the scroll observer to include Graph Builder charts
      const enhancedScrollObserver = function () {
        // Call original function
        const observer = originalSetupScrollObserver.call(this);

        // Add Graph Builder containers to the observer
        document
          .querySelectorAll(CONFIG.gbFinalChartContainer)
          .forEach((container) => {
            if (observer && typeof observer.observe === "function") {
              observer.observe(container);
              logDebug("Added Graph Builder container to scroll observer");
            }
          });

        return observer;
      };

      // Replace with enhanced version
      dependencies.chartControls.setupScrollObserver = enhancedScrollObserver;
    }

    // Hook into existing resize handler
    const originalAdjustAllChartContainers =
      dependencies.chartControls.adjustAllChartContainers;
    if (originalAdjustAllChartContainers) {
      dependencies.chartControls.adjustAllChartContainers = function () {
        // Call original function
        originalAdjustAllChartContainers.call(this);

        // Add Graph Builder adjustments
        adjustAllGraphBuilderCharts();
      };
    }

    logDebug("Integration with existing system completed");
  }

  /**
   * Hook into Graph Builder chart creation process
   */
  function hookIntoGraphBuilderChartCreation() {
    logDebug("Hooking into Graph Builder chart creation");

    // Wait for GraphBuilderCharts to be available and hook into creation
    const checkAndHook = () => {
      if (typeof window.GraphBuilderCharts !== "undefined") {
        dependencies.graphBuilderCharts = window.GraphBuilderCharts;

        // Hook into the chart creation process
        if (dependencies.graphBuilderCharts.createFinalChart) {
          const originalCreateFinalChart =
            dependencies.graphBuilderCharts.createFinalChart;

          dependencies.graphBuilderCharts.createFinalChart = async function (
            ...args
          ) {
            logDebug("Graph Builder chart creation intercepted");

            // Call original function
            const result = await originalCreateFinalChart.apply(this, args);

            // Apply sizing adjustments after chart creation
            setTimeout(() => {
              adjustAllGraphBuilderCharts();
            }, CONFIG.retryDelay);

            return result;
          };

          logDebug("Successfully hooked into Graph Builder chart creation");
        }
      } else {
        // Retry after a short delay
        setTimeout(checkAndHook, 100);
      }
    };

    checkAndHook();
  }

  /**
   * Check if a container is a Graph Builder chart
   */
  function isGraphBuilderChart(container) {
    return (
      container.closest(CONFIG.gbFinalChartContainer) !== null ||
      container.classList.contains("gb-final-chart-container") ||
      container.querySelector(CONFIG.gbChartViewControls) !== null
    );
  }

  /**
   * Check for Graph Builder charts in a node
   */
  function checkForGraphBuilderCharts(node) {
    // Check if the node itself is a Graph Builder chart
    if (isGraphBuilderChart(node)) {
      logDebug("New Graph Builder chart detected");
      scheduleAdjustment(node);
    }

    // Check child nodes
    if (node.querySelectorAll) {
      const gbCharts = node.querySelectorAll(CONFIG.gbFinalChartContainer);
      gbCharts.forEach((chart) => {
        logDebug("New Graph Builder chart found in children");
        scheduleAdjustment(chart);
      });
    }
  }

  /**
   * Schedule a padding adjustment for a container
   */
  function scheduleAdjustment(container) {
    if (state.pendingAdjustments.has(container)) {
      return; // Already scheduled
    }

    state.pendingAdjustments.add(container);

    // Use requestAnimationFrame for better performance
    requestAnimationFrame(() => {
      adjustGraphBuilderContainerPadding(container);
      state.pendingAdjustments.delete(container);
    });
  }

  /**
   * Adjust padding for a Graph Builder container
   * Adapted from chart-controls.js adjustContainerPadding for Graph Builder
   */
  function adjustGraphBuilderContainerPadding(container) {
    if (!container) {
      logWarn("Cannot adjust padding: Container is null");
      return;
    }

    // Find the chart view controls (different selector for Graph Builder)
    const controlsContainer = container.querySelector(
      CONFIG.gbChartViewControls
    );
    if (!controlsContainer) {
      logDebug("No chart view controls found in Graph Builder container");
      return;
    }

    // Get container ID for tracking
    const containerId = container.id || "gb-chart-" + Date.now();
    if (!container.id) {
      container.id = containerId;
    }

    // Check if we've adjusted recently (prevent excessive adjustments)
    const lastAdjustTime = state.lastAdjustTimes.get(containerId) || 0;
    const now = Date.now();

    if (now - lastAdjustTime < CONFIG.debounceDelay) {
      logDebug(`Skipping adjustment for ${containerId} - too recent`);
      return;
    }

    try {
      // Get the current height of the controls
      const controlsRect = controlsContainer.getBoundingClientRect();
      const controlsHeight = controlsRect.height;

      if (controlsHeight > 0) {
        // Calculate new padding with buffer
        const newPadding =
          Math.ceil(controlsHeight) + CONFIG.paddingBuffer + "px";

        // Only update if padding has changed
        if (container.style.paddingTop !== newPadding) {
          container.style.paddingTop = newPadding;
          logDebug(
            `Adjusted Graph Builder container padding to: ${newPadding} for ${containerId}`
          );

          // Update last adjustment time
          state.lastAdjustTimes.set(containerId, now);

          // Add debug attribute if debugging enabled
          if (shouldLog(LOG_LEVELS.DEBUG)) {
            container.setAttribute(
              CONFIG.debugAttribute,
              `padding-top: ${newPadding}`
            );
          }
        }
      } else {
        // Set a default minimum padding if height is zero
        const fallbackPadding = "80px";
        container.style.paddingTop = fallbackPadding;
        logDebug(
          `Set default Graph Builder padding: ${fallbackPadding} for ${containerId}`
        );
      }

      // Force a browser reflow to ensure padding is applied immediately
      void container.offsetHeight;
    } catch (error) {
      logWarn(
        `Error adjusting Graph Builder padding for ${containerId}:`,
        error
      );

      // Set fallback padding
      container.style.paddingTop = "80px";

      // Track retry attempts
      const retryCount = state.retryAttempts.get(containerId) || 0;
      if (retryCount < CONFIG.maxRetries) {
        state.retryAttempts.set(containerId, retryCount + 1);
        setTimeout(() => {
          adjustGraphBuilderContainerPadding(container);
        }, CONFIG.retryDelay * (retryCount + 1));
      }
    }
  }

  /**
   * Adjust all Graph Builder chart containers
   */
  function adjustAllGraphBuilderCharts() {
    logDebug("Adjusting all Graph Builder charts");

    const gbCharts = document.querySelectorAll(CONFIG.gbFinalChartContainer);
    logDebug(`Found ${gbCharts.length} Graph Builder charts to adjust`);

    gbCharts.forEach((container) => {
      adjustGraphBuilderContainerPadding(container);
    });
  }

  /**
   * Debounce utility function
   */
  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Set up console testing commands
   */
  function setupConsoleTestCommands() {
    // Test Graph Builder specific sizing
    window.testGraphBuilderSizing = function () {
      console.log("=== Graph Builder Sizing Test ===");

      // Test 1: Check dependencies
      console.log("1. Dependencies check:");
      console.log(
        "   ChartControls available:",
        dependencies.chartControls !== null
      );
      console.log(
        "   ChartViewControls available:",
        dependencies.chartViewControls !== null
      );
      console.log(
        "   GraphBuilderCharts available:",
        dependencies.graphBuilderCharts !== null
      );

      // Test 2: Find Graph Builder containers
      console.log("2. Graph Builder containers:");
      const gbContainers = document.querySelectorAll(
        CONFIG.gbFinalChartContainer
      );
      console.log(`   Found ${gbContainers.length} Graph Builder containers`);

      gbContainers.forEach((container, index) => {
        console.log(`   Container ${index + 1}:`, container);
        const controls = container.querySelector(CONFIG.gbChartViewControls);
        console.log(`     Has controls: ${!!controls}`);
        if (controls) {
          console.log(
            `     Controls height: ${controls.getBoundingClientRect().height}px`
          );
        }
        console.log(
          `     Current padding-top: ${container.style.paddingTop || "none"}`
        );
      });

      // Test 3: Apply adjustments
      console.log("3. Applying adjustments:");
      adjustAllGraphBuilderCharts();

      // Test 4: Verify adjustments
      setTimeout(() => {
        console.log("4. Post-adjustment verification:");
        const gbContainersAfter = document.querySelectorAll(
          CONFIG.gbFinalChartContainer
        );
        gbContainersAfter.forEach((container, index) => {
          console.log(
            `   Container ${index + 1} padding: ${
              container.style.paddingTop || "none"
            }`
          );
        });
        console.log("=== Test completed ===");
      }, 100);
    };

    // Manual adjustment trigger
    window.adjustGraphBuilderChart = function (containerId) {
      const container = containerId
        ? document.getElementById(containerId)
        : document.querySelector(CONFIG.gbFinalChartContainer);

      if (container) {
        console.log("Manually adjusting Graph Builder chart:", container);
        adjustGraphBuilderContainerPadding(container);
      } else {
        console.log("Graph Builder container not found");
      }
    };

    // Debug toggle
    window.toggleGraphBuilderSizingDebug = function () {
      const newLevel = shouldLog(LOG_LEVELS.DEBUG)
        ? LOG_LEVELS.WARN
        : LOG_LEVELS.DEBUG;
      // Note: This would typically modify the DEFAULT_LOG_LEVEL constant
      console.log(
        `Graph Builder sizing debug ${
          newLevel === LOG_LEVELS.DEBUG ? "enabled" : "disabled"
        }`
      );
    };

    logDebug("Console testing commands set up");
  }

  /**
   * Public API
   */
  return {
    init: init,
    adjustAllGraphBuilderCharts: adjustAllGraphBuilderCharts,
    adjustGraphBuilderContainerPadding: adjustGraphBuilderContainerPadding,
    isGraphBuilderChart: isGraphBuilderChart,

    // Debugging utilities
    getState: () => ({ ...state }),
    getDependencies: () => ({ ...dependencies }),
    getConfig: () => ({ ...CONFIG }),

    // Manual control for testing
    scheduleAdjustment: scheduleAdjustment,

    // Integration status
    isInitialised: () => state.initialised,
  };
})();

// Auto-initialise when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  console.log(
    "[Graph Builder Sizing] DOM ready, initialising sizing integration"
  );

  // Give other systems time to load first
  setTimeout(() => {
    GraphBuilderSizingIntegration.init();
  }, 100);
});

// Also initialise if script loads after DOM ready
if (document.readyState === "loading") {
  // Document is still loading, event listener will handle it
} else {
  // Document is already loaded
  setTimeout(() => {
    GraphBuilderSizingIntegration.init();
  }, 100);
}

// Export for global access
window.GraphBuilderSizingIntegration = GraphBuilderSizingIntegration;
