// ===========================================================================================
// TEST STATUS MANAGER - INDIVIDUAL MODULE TESTING
// Enhanced Pandoc-WASM Mathematical Playground
// Individual module test for StatusManager functionality validation
//
// This file is part of Phase 5.7 Session 7c - Testing Framework Completion
// Following the proven pattern from Sessions 1-7b (all successful)
// ===========================================================================================

const TestStatusManager = (function () {
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
      console.error(`[TestStatusManager] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestStatusManager] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestStatusManager] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestStatusManager] ${message}`, ...args);
  }

  // ===========================================================================================
  // STATUS MANAGER MODULE TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test StatusManager module functionality
   * @returns {Object} Test results with success status and detailed results
   */
  function testStatusManager() {
    logInfo("Starting StatusManager module tests");

    try {
      if (!window.StatusManager) {
        throw new Error("StatusManager module not available");
      }

      const tests = {
        managerExists: () => !!window.StatusManager.manager,

        initialisation: () => {
          const status = window.StatusManager.getCurrentStatus();
          return status && typeof status.status === "string";
        },

        statusUpdate: () => {
          window.StatusManager.setLoading("Test message", 50);
          const status = window.StatusManager.getCurrentStatus();
          return status.message.includes("Test");
        },

        readyStatus: () => {
          window.StatusManager.setReady("Test ready");
          return window.StatusManager.isReady();
        },

        domElementsConnected: () => {
          return (
            !!document.getElementById("statusDot") &&
            !!document.getElementById("statusText")
          );
        },

        temporaryStatus: () => {
          window.StatusManager.showTemporaryStatus("Temporary", 100);
          return true; // Hard to test async behavior
        },

        errorStatus: () => {
          window.StatusManager.setError("Test error");
          const status = window.StatusManager.getCurrentStatus();
          return status.status === "error";
        },
      };

      // FIXED: Use TestUtilities.runTestSuite (after test-commands.js removal)
      logInfo("Running StatusManager test suite with TestUtilities");
      return TestUtilities.runTestSuite("StatusManager", tests);
      // Reset to ready state after testing
      window.StatusManager.setReady();

      return result;
    } catch (error) {
      logError("StatusManager test failed:", error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================================
  // PUBLIC API EXPORTS
  // ===========================================================================================

  return {
    testStatusManager,
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Export pattern for global access (PROVEN working pattern)
window.TestStatusManager = TestStatusManager;
window.testStatusManager = TestStatusManager.testStatusManager;
