// js/testing/individual/test-app-config.js
// Individual Test Module for AppConfig
// Part of Enhanced Pandoc-WASM Mathematical Playground Phase 5.7 Refactoring
// Tests core AppConfig functionality with proper WCAG 2.2 AA compliance

const TestAppConfig = (function () {
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
      console.error(`[TestAppConfig] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestAppConfig] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestAppConfig] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestAppConfig] ${message}`, ...args);
  }

  // ===========================================================================================
  // APPCONFIG MODULE TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test AppConfig module functionality
   * Validates core utilities, content validation, browser compatibility, and state management
   * @returns {Object} Test results with success status and detailed results
   */
  function testAppConfig() {
    logInfo("Starting AppConfig module tests");

    try {
      if (!window.AppConfig) {
        throw new Error("AppConfig module not available");
      }

      const tests = {
        escapeHtml: () => {
          const result = window.AppConfig.escapeHtml(
            "<script>alert('test')</script>"
          );
          return result === "&lt;script&gt;alert('test')&lt;/script&gt;";
        },

        generateFilename: () => {
          const metadata = { title: "Test Document" };
          const filename = window.AppConfig.generateEnhancedFilename(metadata);
          return (
            filename.includes("test-document") && filename.endsWith(".html")
          );
        },

        validateContent: () => {
          try {
            window.AppConfig.validateEnhancedContent("Some test content");
            return true;
          } catch (error) {
            return false;
          }
        },

        browserCompatibility: () => {
          const result = window.AppConfig.checkBrowserCompatibility();
          return result && typeof result.compatible === "boolean";
        },

        stateManagement: () => {
          if (!window.AppConfig.AppState) return false;
          window.AppConfig.AppState.set("testKey", "testValue");
          return window.AppConfig.AppState.get("testKey") === "testValue";
        },
      };

      // FIXED: Use TestUtilities.runTestSuite (after test-commands.js removal)
      logInfo("Running AppConfig test suite with TestUtilities");
      return TestUtilities.runTestSuite("AppConfig", tests);
    } catch (error) {
      logError("AppConfig test failed:", error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    testAppConfig,
    // Expose logging for debugging
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Export pattern for global access
window.TestAppConfig = TestAppConfig;

// Immediately register the global command for backward compatibility
window.testAppConfig = TestAppConfig.testAppConfig;
