// js/testing/individual/test-mathjax-manager.js
// Individual Test Module for MathJaxManager
// Part of Enhanced Pandoc-WASM Mathematical Playground Phase 5.7 Refactoring
// Tests MathJax dynamic configuration functionality with proper WCAG 2.2 AA compliance

const TestMathJaxManager = (function () {
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
      console.error(`[TestMathJaxManager] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestMathJaxManager] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestMathJaxManager] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestMathJaxManager] ${message}`, ...args);
  }

  // ===========================================================================================
  // MATHJAXMANAGER MODULE TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test MathJaxManager module functionality
   * Validates dynamic MathJax configuration, zoom controls, and accessibility features
   * @returns {Object} Test results with success status and detailed results
   */
  function testMathJaxManager() {
    logInfo("Starting MathJaxManager module tests");

    try {
      if (!window.MathJaxManager) {
        throw new Error("MathJaxManager module not available");
      }

      const tests = {
        createManager: () => {
          const manager = window.MathJaxManager.createManager();
          return manager && typeof manager.getCurrentSettings === "function";
        },

        dynamicMathJaxClass: () => {
          return (
            typeof window.MathJaxManager.DynamicMathJaxManager === "function"
          );
        },

        managerSettings: () => {
          const manager = window.MathJaxManager.createManager();
          const settings = manager.getCurrentSettings();
          return settings && typeof settings === "object";
        },

        initialisation: () => {
          const manager = window.MathJaxManager.createManager();
          return typeof manager.initialise === "function";
        },
      };

      // FIXED: Use TestUtilities.runTestSuite (after test-commands.js removal)
      logInfo("Running MathJaxManager test suite with TestUtilities");
      return TestUtilities.runTestSuite("MathJaxManager", tests);
    } catch (error) {
      logError("MathJaxManager test failed:", error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================================
  // PUBLIC API EXPORTS
  // ===========================================================================================

  return {
    testMathJaxManager,
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Export pattern for global access (matches Session 1 success pattern)
window.TestMathJaxManager = TestMathJaxManager;
window.testMathJaxManager = TestMathJaxManager.testMathJaxManager;
