// ===========================================================================================
// TEST EVENT MANAGER - INDIVIDUAL MODULE TESTING
// Enhanced Pandoc-WASM Mathematical Playground
// Individual module test for EventManager functionality validation
//
// This file is part of Phase 5.7 Session 7e - Testing Framework Completion
// Following the proven pattern from Sessions 1-7d (all successful)
// ===========================================================================================

const TestEventManager = (function () {
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
      console.error(`[TestEventManager] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestEventManager] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestEventManager] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestEventManager] ${message}`, ...args);
  }

  // ===========================================================================================
  // EVENT MANAGER MODULE TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test EventManager module functionality
   * @returns {Object} Test results with success status and detailed results
   */
  function testEventManager() {
    logInfo("Starting EventManager module tests");

    try {
      if (!window.EventManager) {
        throw new Error("EventManager module not available");
      }

      const tests = {
        managerExists: () => !!window.EventManager.manager,

        initialisation: () => window.EventManager.isInitialised(),

        keyboardShortcuts: () => {
          const shortcuts = window.EventManager.getKeyboardShortcuts();
          return Array.isArray(shortcuts) && shortcuts.length > 0;
        },

        eventEmission: () => {
          let eventReceived = false;
          const testHandler = () => {
            eventReceived = true;
          };

          window.addEventListener("testEventManager", testHandler);
          window.EventManager.emitEvent("testEventManager", { test: true });
          window.removeEventListener("testEventManager", testHandler);

          return eventReceived;
        },

        systemStatus: () => {
          const status = window.EventManager.getSystemStatus();
          return status && typeof status.initialised === "boolean";
        },

        debugLogging: () => {
          window.EventManager.setDebugLogging(true);
          window.EventManager.setDebugLogging(false);
          return true; // Just test it doesn't error
        },
      };

      // FIXED: Use TestUtilities.runTestSuite (after test-commands.js removal)
      logInfo("Running EventManager test suite with TestUtilities");
      return TestUtilities.runTestSuite("EventManager", tests);
    } catch (error) {
      logError("EventManager test failed:", error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================================
  // PUBLIC API EXPORTS
  // ===========================================================================================

  return {
    testEventManager,
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Export pattern for global access (PROVEN working pattern)
window.TestEventManager = TestEventManager;
window.testEventManager = TestEventManager.testEventManager;
