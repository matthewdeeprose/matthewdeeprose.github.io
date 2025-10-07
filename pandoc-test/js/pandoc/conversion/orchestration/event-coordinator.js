// event-coordinator.js
// Event Coordinator - Conversion event handling and lifecycle management
// Part of Enhanced Pandoc-WASM Mathematical Playground modular refactoring Phase 7

const EventCoordinator = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("EVENT_COORDINATOR", {
    level: window.LoggingSystem.LOG_LEVELS.WARN,
  }) || {
    logError: console.error.bind(console, "[EVENT_COORDINATOR]"),
    logWarn: console.warn.bind(console, "[EVENT_COORDINATOR]"),
    logInfo: console.log.bind(console, "[EVENT_COORDINATOR]"),
    logDebug: console.log.bind(console, "[EVENT_COORDINATOR]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // EVENT COORDINATION IMPLEMENTATION
  // ===========================================================================================

  /**
   * Coordinate conversion lifecycle events and status updates
   * Manages the complete conversion event flow from start to completion
   * @param {string} phase - The conversion phase ('start', 'processing', 'completion', 'error')
   * @param {Object} eventData - Data associated with the event
   * @param {Object} dependencies - Required dependencies for event handling
   * @returns {Promise<boolean>} - Success/failure of event coordination
   */
  async function coordinateConversionEvent(phase, eventData = {}, dependencies = {}) {
    logDebug(`Coordinating conversion event: ${phase}`, eventData);

    try {
      const { statusManager, conversionInProgress } = dependencies;

      switch (phase) {
        case 'start':
          return await handleConversionStart(eventData, dependencies);
        
        case 'processing':
          return await handleConversionProcessing(eventData, dependencies);
        
        case 'completion':
          return await handleConversionCompletion(eventData, dependencies);
        
        case 'error':
          return await handleConversionError(eventData, dependencies);
        
        default:
          logWarn(`Unknown conversion phase: ${phase}`);
          return false;
      }

    } catch (error) {
      logError(`Error coordinating conversion event ${phase}:`, error);
      return false;
    }
  }

  /**
   * Handle conversion start events
   * @param {Object} eventData - Start event data
   * @param {Object} dependencies - Required dependencies
   * @returns {Promise<boolean>} - Success/failure of start event handling
   */
  async function handleConversionStart(eventData, dependencies) {
    logInfo("🚀 Handling conversion start event");

    const { statusManager, complexity = {} } = eventData;
    const { conversionManager } = dependencies;

try {
  // Check if conversion is already in progress (avoid double-setting)
  if (conversionManager && !conversionManager.conversionInProgress) {
    conversionManager.conversionInProgress = true;
    logDebug("Conversion state set to in progress via EventCoordinator");
  } else if (conversionManager && conversionManager.conversionInProgress) {
    logDebug("Conversion already in progress - state coordination successful");
  }

  // Update status with complexity information
  if (statusManager) {
    const complexityMessage = complexity.requiresChunking
      ? `Processing complex ${complexity.level} document...`
      : `Converting ${complexity.level} document...`;
    
    statusManager.updateConversionStatus("CONVERT_START", 10);
    statusManager.setLoading(complexityMessage, 15);
  }

      // Log complexity assessment
      if (complexity.level) {
        logInfo(`Document complexity: ${complexity.level} (score: ${complexity.score?.toFixed(1) || 'unknown'})`);
      }

      // Small delay to allow UI to update
      await new Promise((resolve) => setTimeout(resolve, 10));

      logInfo("✅ Conversion start event handled successfully");
      return true;

    } catch (error) {
      logError("Error handling conversion start event:", error);
      return false;
    }
  }

  /**
   * Handle conversion processing events
   * @param {Object} eventData - Processing event data
   * @param {Object} dependencies - Required dependencies
   * @returns {Promise<boolean>} - Success/failure of processing event handling
   */
  async function handleConversionProcessing(eventData, dependencies) {
    logDebug("⚙️ Handling conversion processing event");

    const { stage, progress, message } = eventData;
    const { statusManager } = dependencies;

    try {
      if (statusManager && stage) {
        statusManager.updateConversionStatus(stage, progress || 50);
        
        if (message) {
          statusManager.setLoading(message, progress || 50);
        }
      }

      // Standard processing milestones
      switch (stage) {
        case 'CONVERT_MATH':
          logDebug("Processing mathematical expressions...");
          break;
        
        case 'CONVERT_CLEAN':
          logDebug("Cleaning Pandoc output...");
          break;
        
        case 'CONVERT_MATHJAX':
          logDebug("Rendering MathJax...");
          break;
        
        default:
          logDebug(`Processing stage: ${stage}`);
      }

      return true;

    } catch (error) {
      logError("Error handling conversion processing event:", error);
      return false;
    }
  }

  /**
   * Handle conversion completion events
   * @param {Object} eventData - Completion event data
   * @param {Object} dependencies - Required dependencies
   * @returns {Promise<boolean>} - Success/failure of completion event handling
   */
  async function handleConversionCompletion(eventData, dependencies) {
    logInfo("🎉 Handling conversion completion event");

    const { success, complexity = {}, enhanced = false } = eventData;
    const { statusManager, conversionManager } = dependencies;

    try {
      // Clear conversion in progress flag
      if (conversionManager) {
        conversionManager.conversionInProgress = false;
      }

      if (success && statusManager) {
        // Generate success message based on complexity and enhancement mode
        const enhancedMode = enhanced || document.getElementById("pandoc-enhanced-mode")?.checked;
        
        let successMessage;
        if (enhancedMode) {
          successMessage = `🧪 Enhanced ${complexity.level || 'document'} converted. Check output for improvements.`;
        } else if (complexity.level === "basic") {
          successMessage = "Conversion complete! Ready for export.";
        } else {
          successMessage = `${complexity.level || 'Document'} converted. Ready for export.`;
        }

        statusManager.setReady(successMessage);

        // Trigger export button enablement if available
        if (window.AppStateManager?.enableExportButtons) {
          window.AppStateManager.enableExportButtons("Conversion completed successfully");
        }
      }

      logInfo("✅ Conversion completion event handled successfully");
      return true;

    } catch (error) {
      logError("Error handling conversion completion event:", error);
      return false;
    }
  }

  /**
   * Handle conversion error events
   * @param {Object} eventData - Error event data
   * @param {Object} dependencies - Required dependencies
   * @returns {Promise<boolean>} - Success/failure of error event handling
   */
  async function handleConversionError(eventData, dependencies) {
    logError("❌ Handling conversion error event");

    const { error, errorMessage, userFriendlyMessage } = eventData;
    const { statusManager, conversionManager } = dependencies;

    try {
      // Clear conversion in progress flag
      if (conversionManager) {
        conversionManager.conversionInProgress = false;
      }

      // Update status with error information
      if (statusManager) {
        const displayMessage = userFriendlyMessage || errorMessage || "Conversion failed";
        statusManager.setError(`Conversion failed: ${displayMessage}`);
      }

      // Log technical error details
      if (error) {
        logError("Technical error details:", error);
      }

      logInfo("✅ Conversion error event handled successfully");
      return true;

    } catch (eventError) {
      logError("Error handling conversion error event:", eventError);
      return false;
    }
  }

  /**
   * Track conversion progress with milestone reporting
   * @param {string} milestone - The conversion milestone reached
   * @param {number} progress - Progress percentage (0-100)
   * @param {Object} dependencies - Required dependencies
   * @returns {boolean} - Success/failure of progress tracking
   */
  function trackConversionProgress(milestone, progress = 0, dependencies = {}) {
    logDebug(`Tracking conversion progress: ${milestone} (${progress}%)`);

    try {
      const { statusManager } = dependencies;

      if (statusManager) {
        statusManager.updateConversionStatus(milestone, progress);
      }

      // Emit progress event if event manager available
      if (window.EventManager?.emitEvent) {
        window.EventManager.emitEvent('conversionProgress', {
          milestone,
          progress,
          timestamp: Date.now()
        });
      }

      return true;

    } catch (error) {
      logError("Error tracking conversion progress:", error);
      return false;
    }
  }

  /**
   * Handle conversion timeout events
   * @param {Object} eventData - Timeout event data
   * @param {Object} dependencies - Required dependencies
   * @returns {Promise<boolean>} - Success/failure of timeout handling
   */
  async function handleConversionTimeout(eventData, dependencies) {
    logWarn("⏱️ Handling conversion timeout event");

    const { timeoutMs, operation } = eventData;
    const { statusManager, conversionManager } = dependencies;

    try {
      // Clear conversion in progress flag
      if (conversionManager) {
        conversionManager.conversionInProgress = false;
      }

      // Update status with timeout information
      if (statusManager) {
        const timeoutMessage = `Processing timed out after ${timeoutMs}ms - document may be too complex`;
        statusManager.setError(timeoutMessage);
      }

      logWarn(`Conversion timeout: ${operation} exceeded ${timeoutMs}ms limit`);
      return true;

    } catch (error) {
      logError("Error handling conversion timeout:", error);
      return false;
    }
  }

  /**
   * Create event coordination context with available dependencies
   * @param {Object} conversionManager - The conversion manager instance
   * @returns {Object} - Event coordination dependencies
   */
  function createEventContext(conversionManager) {
    if (!conversionManager) {
      logWarn("No conversion manager provided for event context");
      return {};
    }

    return {
      conversionManager: conversionManager,
      statusManager: window.StatusManager,
      eventManager: window.EventManager,
      appStateManager: window.AppStateManager
    };
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testEventCoordinator() {
    const tests = {
      moduleExists: () => !!window.EventCoordinator,

      hasMainCoordinationFunction: () => typeof coordinateConversionEvent === "function",

      hasStartHandler: () => typeof handleConversionStart === "function",

      hasProcessingHandler: () => typeof handleConversionProcessing === "function",

      hasCompletionHandler: () => typeof handleConversionCompletion === "function",

      hasErrorHandler: () => typeof handleConversionError === "function",

      hasProgressTracking: () => typeof trackConversionProgress === "function",

      hasTimeoutHandler: () => typeof handleConversionTimeout === "function",

      hasContextCreation: () => typeof createEventContext === "function",

      contextCreationWorks: () => {
        const mockManager = {
          conversionInProgress: false,
        };
        const context = createEventContext(mockManager);
        return context && context.conversionManager === mockManager;
      },

      progressTrackingWorks: () => {
        const result = trackConversionProgress("TEST_MILESTONE", 50, {});
        return result === true;
      },

      errorHandling: () => {
        try {
          createEventContext(null);
          return true; // Should not throw, just return empty object
        } catch (error) {
          return false;
        }
      },

      integrationReadiness: () => {
        return (
          typeof coordinateConversionEvent === "function" &&
          typeof createEventContext === "function" &&
          typeof trackConversionProgress === "function"
        );
      },
    };

    return (
      window.TestUtilities?.runTestSuite("EventCoordinator", tests) ||
      fallbackTesting("EventCoordinator", tests)
    );
  }

  function fallbackTesting(moduleName, tests) {
    logInfo(`Testing ${moduleName} with fallback testing system...`);
    let passed = 0;
    let total = 0;

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const result = testFn();
        if (result === true || (result && result.then)) {
          passed++;
          logDebug(`  ✅ ${testName}: PASSED`);
        } else {
          logError(`  ❌ ${testName}: FAILED`);
        }
      } catch (error) {
        logError(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    });

    const success = passed === total;
    logInfo(`📊 ${moduleName}: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
      allPassed: success,
      totalTests: total,
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Core event coordination functions
    coordinateConversionEvent,
    handleConversionStart,
    handleConversionProcessing,
    handleConversionCompletion,
    handleConversionError,
    handleConversionTimeout,
    trackConversionProgress,
    createEventContext,

    // Testing
    testEventCoordinator,
  };
})();

window.EventCoordinator = EventCoordinator;