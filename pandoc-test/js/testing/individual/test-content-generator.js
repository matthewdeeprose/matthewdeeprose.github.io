// js/testing/individual/test-content-generator.js
// Individual Test Module for ContentGenerator
// Part of Enhanced Pandoc-WASM Mathematical Playground Phase 5.7 Refactoring
// Tests ContentGenerator functionality with proper WCAG 2.2 AA compliance

const TestContentGenerator = (function () {
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
      console.error(`[TestContentGenerator] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestContentGenerator] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestContentGenerator] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestContentGenerator] ${message}`, ...args);
  }

  // ===========================================================================================
  // CONTENTGENERATOR MODULE TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test ContentGenerator module functionality
   * Validates CSS generation, table of contents, document structure enhancement, and utilities
   * @returns {Object} Test results with success status and detailed results
   */
  function testContentGenerator() {
    logInfo("Starting ContentGenerator module tests");

    try {
      if (!window.ContentGenerator) {
        throw new Error("ContentGenerator module not available");
      }

      const tests = {
        generateCSS: async () => {
          const css = await window.ContentGenerator.generateEnhancedCSS();
          return (
            css.includes("grid") &&
            css.includes("--body-bg") &&
            css.length > 1000
          );
        },

        generateTOC: () => {
          const sections = [
            { title: "Introduction", level: 2, id: "intro" },
            { title: "Methods", level: 2, id: "methods" },
          ];
          const toc = window.ContentGenerator.generateTableOfContents(sections);
          return toc.includes("nav") && toc.includes("Introduction");
        },

enhanceDocument: async () => {
          const testContent = "<p>Test content</p>";
          const metadata = { sections: [] };
          const enhanced = await window.ContentGenerator.enhanceDocumentStructure(
            testContent,
            metadata
          );
          return (
            enhanced.includes("document-wrapper") &&
            enhanced.includes("skip-link")
          );
        },

        escapeHtml: () => {
          const result = window.ContentGenerator.escapeHtml("<test>");
          return result === "&lt;test&gt;";
        },

        minifyCSS: () => {
          const css = "body { color: red; }";
          const minified = window.ContentGenerator.minifyCSS(css);
          return minified.length <= css.length;
        },
      };

      // FIXED: Use TestUtilities.runTestSuite (after test-commands.js removal)
      logInfo("Running ContentGenerator test suite with TestUtilities");
      return TestUtilities.runTestSuite("ContentGenerator", tests);
    } catch (error) {
      logError("ContentGenerator test failed:", error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================================
  // PUBLIC API EXPORTS
  // ===========================================================================================

  return {
    testContentGenerator,
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Export pattern for global access (matches Sessions 1-3 success pattern)
window.TestContentGenerator = TestContentGenerator;
window.testContentGenerator = TestContentGenerator.testContentGenerator;
