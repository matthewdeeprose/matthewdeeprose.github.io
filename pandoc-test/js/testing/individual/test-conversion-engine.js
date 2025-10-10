// ===========================================================================================
// TEST CONVERSION ENGINE - INDIVIDUAL MODULE TESTING
// Enhanced Pandoc-WASM Mathematical Playground
// Individual module test for ConversionEngine functionality validation
//
// This file is part of Phase 5.7 Session 7d - Testing Framework Completion
// Following the proven pattern from Sessions 1-7c (all successful)
// ===========================================================================================

const TestConversionEngine = (function () {
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
      console.error(`[TestConversionEngine] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestConversionEngine] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestConversionEngine] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestConversionEngine] ${message}`, ...args);
  }

  // ===========================================================================================
  // CONVERSION ENGINE MODULE TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test ConversionEngine module functionality
   * @returns {Object} Test results with success status and detailed results
   */
  function testConversionEngine() {
    logInfo("Starting ConversionEngine module tests");

    try {
      if (!window.ConversionEngine) {
        throw new Error("ConversionEngine module not available");
      }

      const tests = {
        managerExists: () => !!window.ConversionEngine.manager,

        initialisation: () => {
          const status = window.ConversionEngine.getEngineStatus();
          return status && typeof status.initialised === "boolean";
        },

        domElementsConnected: () => {
          return (
            !!document.getElementById("input") &&
            !!document.getElementById("output") &&
            !!document.getElementById("arguments")
          );
        },

        contentManagement: () => {
          const originalInput = window.ConversionEngine.getCurrentInput() || "";
          window.ConversionEngine.setInputContent("Test content");
          const newInput = window.ConversionEngine.getCurrentInput();
          window.ConversionEngine.setInputContent(originalInput); // Restore
          return newInput === "Test content";
        },

        outputRetrieval: () => {
          const output = window.ConversionEngine.getCurrentOutput();
          return typeof output === "string";
        },

        engineStatus: () => {
          const status = window.ConversionEngine.getEngineStatus();
          return status && typeof status.ready === "boolean";
        },

        clearContent: () => {
          window.ConversionEngine.clearContent();
          return window.ConversionEngine.getCurrentInput() === "";
        },
      };

      // FIXED: Use TestUtilities.runTestSuite (after test-commands.js removal)
      logInfo("Running ConversionEngine test suite with TestUtilities");
      return TestUtilities.runTestSuite("ConversionEngine", tests);
    } catch (error) {
      logError("ConversionEngine test failed:", error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================================
  // PUBLIC API EXPORTS
  // ===========================================================================================

  return {
    testConversionEngine,
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Export pattern for global access (PROVEN working pattern)
window.TestConversionEngine = TestConversionEngine;
window.testConversionEngine = TestConversionEngine.testConversionEngine;
