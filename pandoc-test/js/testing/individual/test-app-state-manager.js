// ===========================================================================================
// TEST APP STATE MANAGER - INDIVIDUAL MODULE TESTING
// Enhanced Pandoc-WASM Mathematical Playground
// Individual module test for AppStateManager functionality validation
//
// This file is part of Phase 5.7 Session 7f - Testing Framework Completion
// Following the proven pattern from Sessions 1-7e (all successful)
// ===========================================================================================

const TestAppStateManager = (function () {
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
      console.error(`[TestAppStateManager] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestAppStateManager] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestAppStateManager] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestAppStateManager] ${message}`, ...args);
  }

  // ===========================================================================================
  // APP STATE MANAGER MODULE TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test AppStateManager module functionality
   * @returns {Object} Test results with success status and detailed results
   */
  function testAppStateManager() {
    logInfo("Starting AppStateManager module tests");

    try {
      if (!window.AppStateManager) {
        throw new Error("AppStateManager module not available");
      }

      const tests = {
        managerExists: () => !!window.AppStateManager.manager,

        initialisation: () => window.AppStateManager.isInitialised(),

        applicationReady: () => window.AppStateManager.isReady(),

        statusRetrieval: () => {
          const status = window.AppStateManager.getApplicationStatus();
          return status && typeof status.ready === "boolean";
        },

        pandocFunction: () => !!window.AppStateManager.getPandocFunction(),

        moduleValidation: () => {
          const status = window.AppStateManager.getApplicationStatus();
          return status.modules && Object.keys(status.modules).length > 0;
        },

        phaseTracking: () => {
          const status = window.AppStateManager.getApplicationStatus();
          return status.phase && typeof status.phase === "string";
        },
      };

      // FIXED: Use TestUtilities.runTestSuite (after test-commands.js removal)
      logInfo("Running AppStateManager test suite with TestUtilities");
      return TestUtilities.runTestSuite("AppStateManager", tests);
    } catch (error) {
      logError("AppStateManager test failed:", error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================================
  // PUBLIC API EXPORTS
  // ===========================================================================================

  return {
    testAppStateManager,
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Export pattern for global access (PROVEN working pattern)
window.TestAppStateManager = TestAppStateManager;
window.testAppStateManager = TestAppStateManager.testAppStateManager;
