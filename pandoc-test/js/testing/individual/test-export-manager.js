// ===========================================================================================
// TEST EXPORT MANAGER - INDIVIDUAL MODULE TESTING
// Enhanced Pandoc-WASM Mathematical Playground
// Individual module test for ExportManager functionality validation
//
// This file is part of Phase 5.7 Session 7 - Testing Framework Completion
// Following the proven pattern from Sessions 1-5 (all successful)
// ===========================================================================================

const TestExportManager = (function () {
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
      console.error(`[TestExportManager] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestExportManager] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestExportManager] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestExportManager] ${message}`, ...args);
  }

  // ===========================================================================================
  // EXPORT MANAGER MODULE TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test ExportManager module functionality
   * @returns {Object} Test results with success status and detailed results
   */
  async function testExportManager() {
    logInfo("Starting ExportManager module tests");

    try {
      if (!window.ExportManager) {
        throw new Error("ExportManager module not available");
      }

      const tests = {
        validateDependencies: () => {
          const result = window.ExportManager.validateDependencies();
          return result && typeof result.success === "boolean";
        },

        testGeneration: async () => {
          const result = await window.ExportManager.testExportGeneration();
          return result && typeof result.success === "boolean";
        },

        generateHTML: async () => {
          const testContent = "<p>Test content with $x = 1$</p>";
          try {
            const html =
              await window.ExportManager.generateEnhancedStandaloneHTML(
                testContent,
                "Test",
                2
              );
            return (
              html.includes("<!DOCTYPE html>") &&
              html.includes("reading-tools-section")
            );
          } catch (error) {
            console.error("❌ Generate HTML test failed:", error);
            return false;
          }
        },

        exportFunction: () => {
          return typeof window.exportToHTML === "function";
        },
      };

      // FIXED: Use TestUtilities.runTestSuite (after test-commands.js removal)
      logInfo("Running ExportManager test suite with TestUtilities");
      return await TestUtilities.runTestSuite("ExportManager", tests);
    } catch (error) {
      logError("ExportManager test failed:", error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================================
  // PUBLIC API EXPORTS
  // ===========================================================================================

  return {
    testExportManager,
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Export pattern for global access (PROVEN working pattern)
window.TestExportManager = TestExportManager;
window.testExportManager = TestExportManager.testExportManager;
