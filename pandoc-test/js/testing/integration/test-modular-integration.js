// js/testing/integration/test-modular-integration.js
const TestModularIntegration = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (IIFE SCOPE)
  // ===========================================================================================

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
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[TestModularIntegration] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestModularIntegration] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestModularIntegration] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestModularIntegration] ${message}`, ...args);
  }

  // ===========================================================================================
  // MODULAR INTEGRATION TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test modular application integration
   * @returns {Object} Test results with success status and detailed results
   */
  async function testModularIntegration() {
    logInfo("Starting modular application integration tests");

    try {
      if (
        !window.AppStateManager ||
        !window.StatusManager ||
        !window.EventManager ||
        !window.ConversionEngine ||
        !window.ExampleSystem
      ) {
        throw new Error(
          "Required modules not available for modular integration testing"
        );
      }

      const tests = {
        appStateCoordination: () => {
          const status = window.AppStateManager.getApplicationStatus();
          return (
            status && status.modules && Object.keys(status.modules).length >= 10
          );
        },

        statusIntegration: () => {
          // Test that StatusManager can be controlled by other modules
          window.StatusManager.setLoading("Integration test", 50);
          const isLoading = !window.StatusManager.isReady();
          window.StatusManager.setReady();
          const isReady = window.StatusManager.isReady();
          return isLoading && isReady;
        },

        eventCoordination: () => {
          // Test that EventManager can coordinate between modules
          let eventReceived = false;
          const handler = () => {
            eventReceived = true;
          };

          window.addEventListener("testModularIntegration", handler);
          window.EventManager.emitEvent("testModularIntegration", {});
          window.removeEventListener("testModularIntegration", handler);

          return eventReceived;
        },

        conversionPipeline: () => {
          // Test conversion engine with status updates
          const engineStatus = window.ConversionEngine.getEngineStatus();
          return engineStatus && typeof engineStatus.initialised === "boolean";
        },

        exampleSystemIntegration: () => {
          // Test that example system can interact with conversion engine
          const exampleStatus = window.ExampleSystem.getSystemStatus();
          return (
            exampleStatus && typeof exampleStatus.initialised === "boolean"
          );
        },
      };

      // FIXED: Use TestUtilities.runTestSuite (after test-commands.js removal)
      logInfo("Running Modular Integration test suite with TestUtilities");
      return await TestUtilities.runTestSuite("Modular Integration", tests);
    } catch (error) {
      logError("Modular integration test failed:", error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================================
  // PUBLIC API EXPORTS
  // ===========================================================================================

  return {
    testModularIntegration,
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Export pattern for global access - ENHANCED to ensure module object availability
const TestModularIntegrationModule = TestModularIntegration;
window.TestModularIntegration = TestModularIntegrationModule;
window.testModularIntegration =
  TestModularIntegrationModule.testModularIntegration;
