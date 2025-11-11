// ===========================================================================================
// TEST TEMPLATE SYSTEM - INDIVIDUAL MODULE TESTING
// Enhanced Pandoc-WASM Mathematical Playground
// Individual module test for TemplateSystem functionality validation
//
// This file is part of Phase 5.7 Session 5 - Testing Framework Refactoring
// Following the proven pattern from Sessions 1-4 (all successful)
// ===========================================================================================

const TestTemplateSystem = (function () {
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
      console.error(`[TestTemplateSystem] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestTemplateSystem] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestTemplateSystem] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestTemplateSystem] ${message}`, ...args);
  }

  // ===========================================================================================
  // TEMPLATE SYSTEM MODULE TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test TemplateSystem module functionality
   * Validates template engine operations, external template loading, and performance
   * @returns {Object} Test results with success status and detailed results
   */
  async function testTemplateSystem() {
    logInfo("Starting TemplateSystem module tests");

    try {
      if (!window.TemplateSystem) {
        throw new Error("TemplateSystem module not available");
      }

      const tests = {
        createGenerator: () => {
          const generator = window.TemplateSystem.createGenerator();
          return generator && typeof generator.renderTemplate === "function";
        },

        renderReadingTools: async () => {
          await window.TemplateSystem.ensureTemplatesLoaded();
          const generator = window.TemplateSystem.createGenerator();

          if (generator.engine.templates.size === 0) {
            generator.engine.copyFromGlobalCache();
          }

          const html = generator.renderTemplate("readingToolsSection");
          return (
            html.includes("reading-tools-section") &&
            html.includes("font-family")
          );
        },

        renderSidebar: async () => {
          // ✅ FIXED: Use EnhancedHTMLGenerator with global cache for external templates
          const generator = new window.TemplateSystem.EnhancedHTMLGenerator();
          await generator.engine.initializeFromGlobalCache();
          const metadata = { sections: [] };
          const sidebar = generator.renderTemplate(
            "integratedDocumentSidebar",
            metadata
          );
          return (
            sidebar.includes("document-sidebar") &&
            sidebar.includes("Reading Tools")
          );
        },

        validateSystem: async () => {
          // ✅ Ensure templates loaded before validation
          await window.TemplateSystem.ensureTemplatesLoaded();

          // Wait for templates to settle
          await new Promise((resolve) => setTimeout(resolve, 150));

          const result = await window.TemplateSystem.validateTemplateSystem();
          return result && typeof result.success === "boolean";
        },

        performanceTest: () => {
          const result = window.TemplateSystem.measureTemplatePerformance();
          return result && typeof result.duration === "number";
        },
      };

      // FIXED: Use TestUtilities.runTestSuite (after test-commands.js removal)
      logInfo("Running TemplateSystem test suite with TestUtilities");
      return await TestUtilities.runTestSuite("TemplateSystem", tests);
    } catch (error) {
      logError("TemplateSystem test failed:", error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================================
  // PUBLIC API EXPORTS
  // ===========================================================================================

  return {
    testTemplateSystem,
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Export pattern for global access (matches Sessions 1-4 success pattern)
window.TestTemplateSystem = TestTemplateSystem;
window.testTemplateSystem = TestTemplateSystem.testTemplateSystem;
