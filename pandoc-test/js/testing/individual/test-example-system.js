// ===========================================================================================
// TEST EXAMPLE SYSTEM - INDIVIDUAL MODULE TESTING
// Enhanced Pandoc-WASM Mathematical Playground
// Individual module test for ExampleSystem functionality validation
//
// This file is part of Phase 5.7 Session 7 - Testing Framework Completion
// Following the proven pattern from Sessions 1-5 (all successful)
// ===========================================================================================

const TestExampleSystem = (function () {
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
      console.error(`[TestExampleSystem] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestExampleSystem] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestExampleSystem] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestExampleSystem] ${message}`, ...args);
  }

  // ===========================================================================================
  // EXAMPLE SYSTEM MODULE TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test ExampleSystem module functionality
   * @returns {Object} Test results with success status and detailed results
   */
  function testExampleSystem() {
    logInfo("Starting ExampleSystem module tests");

    try {
      if (!window.ExampleSystem) {
        throw new Error("ExampleSystem module not available");
      }

      const tests = {
        managerExists: () => !!window.ExampleSystem.manager,

        initialisation: () => window.ExampleSystem.isReady(),

        hasExamples: () => {
          const keys = window.ExampleSystem.getExampleKeys();
          return Array.isArray(keys) && keys.length >= 0;
        },

        canLoadExample: () => {
          const keys = window.ExampleSystem.getExampleKeys();
          if (keys.length === 0) return true;
          const testKey = keys[0];
          const content = window.ExampleSystem.getExample(testKey);
          return content && content.length > 0;
        },

        domElementsConnected: () => {
          return (
            !!document.getElementById("example-select") &&
            !!document.getElementById("random-example-btn")
          );
        },

        statusRetrieval: () => {
          const status = window.ExampleSystem.getSystemStatus();
          return status && typeof status.initialised === "boolean";
        },
      };

      // FIXED: Use TestUtilities.runTestSuite (after test-commands.js removal)
      logInfo("Running ExampleSystem test suite with TestUtilities");
      return TestUtilities.runTestSuite("ExampleSystem", tests);
    } catch (error) {
      logError("ExampleSystem test failed:", error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================================
  // PUBLIC API EXPORTS
  // ===========================================================================================

  return {
    testExampleSystem,
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Export pattern for global access (PROVEN working pattern)
window.TestExampleSystem = TestExampleSystem;
window.testExampleSystem = TestExampleSystem.testExampleSystem;
