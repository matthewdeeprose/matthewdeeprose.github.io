// ===========================================================================================
// TEST LAYOUT DEBUGGER - INDIVIDUAL MODULE TESTING
// Enhanced Pandoc-WASM Mathematical Playground
// Individual module test for LayoutDebugger functionality validation
//
// This file is part of Phase 5.7 Session 7g - Testing Framework Completion (FINAL FILE!)
// Following the proven pattern from Sessions 1-7f (all successful)
// ===========================================================================================

const TestLayoutDebugger = (function () {
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

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[TestLayoutDebugger] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestLayoutDebugger] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestLayoutDebugger] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestLayoutDebugger] ${message}`, ...args);
  }

  // ===========================================================================================
  // LAYOUT DEBUGGER MODULE TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test LayoutDebugger module functionality
   * @returns {Object} Test results with success status and detailed results
   */
  function testLayoutDebugger() {
    logInfo("Starting LayoutDebugger module tests");

    try {
      if (!window.LayoutDebugger) {
        logWarn("LayoutDebugger module not available (optional)");
        return { success: true, skipped: true, reason: "Optional module" };
      }

      const tests = {
        debuggerExists: () => !!window.LayoutDebugger,

        enableDisable: () => {
          if (typeof window.LayoutDebugger.enable === "function") {
            window.LayoutDebugger.enable();
            const enabled = window.LayoutDebugger.isEnabled();
            if (enabled) window.LayoutDebugger.disable();
            return enabled;
          }
          return true; // Skip if not available
        },

        analysis: () => {
          return typeof window.LayoutDebugger.logLayoutState === "function";
        },
      };

      // FIXED: Use TestUtilities.runTestSuite (after test-commands.js removal)
      logInfo("Running LayoutDebugger test suite with TestUtilities");
      return TestUtilities.runTestSuite("LayoutDebugger", tests);
    } catch (error) {
      logError("LayoutDebugger test failed:", error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================================
  // PUBLIC API EXPORTS
  // ===========================================================================================

  return {
    testLayoutDebugger,
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Export pattern for global access (PROVEN working pattern)
window.TestLayoutDebugger = TestLayoutDebugger;
window.testLayoutDebugger = TestLayoutDebugger.testLayoutDebugger;
