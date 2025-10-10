// js/testing/integration/test-export-pipeline.js
const TestExportPipeline = (function () {
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
      console.error(`[TestExportPipeline] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestExportPipeline] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestExportPipeline] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestExportPipeline] ${message}`, ...args);
  }

  // ===========================================================================================
  // EXPORT PIPELINE INTEGRATION TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test export pipeline integration
   * @returns {Object} Test results with success status and detailed results
   */
  async function testExportPipeline() {
    logInfo("Starting Export Pipeline integration tests");

    try {
      // Test content with various features for comprehensive validation
      const testContent = `
        <h1>Mathematical Document</h1>
        <h2>Introduction</h2>
        <p>This document contains mathematical expressions:</p>
        <p>Inline math: $E = mc^2$</p>
        <p>Display math: $$\\int_0^1 x^2 dx = \\frac{1}{3}$$</p>
        <h2>Conclusion</h2>
        <p>This concludes our test document.</p>
      `;

      const tests = {
        latexConversion: () => {
          const converted =
            window.LaTeXProcessor.convertMathJaxToLatex(testContent);
          return converted && converted.length > 0;
        },

        metadataExtraction: () => {
          const metadata =
            window.LaTeXProcessor.extractDocumentMetadata(testContent);
          return (
            metadata && metadata.sections && metadata.sections.length === 3
          );
        },

        contentGeneration: () => {
          const metadata =
            window.LaTeXProcessor.extractDocumentMetadata(testContent);
          const enhanced = window.ContentGenerator.enhanceDocumentStructure(
            testContent,
            metadata
          );
          return (
            enhanced.includes("document-wrapper") && enhanced.includes("main")
          );
        },

        templateRendering: () => {
          const generator = window.TemplateSystem.createGenerator();
          const metadata = {
            sections: [{ title: "Test", level: 2, id: "test" }],
          };
          const sidebar = generator.renderTemplate(
            "integratedDocumentSidebar",
            metadata
          );
          return sidebar.includes("accessibility-controls");
        },

        fullExport: async () => {
          // CRITICAL FIX: Await the async function - generateEnhancedStandaloneHTML returns Promise
          const html =
            await window.ExportManager.generateEnhancedStandaloneHTML(
              testContent,
              "Test Document",
              2
            );
          return (
            html.includes("<!DOCTYPE html>") &&
            html.includes("MathJax") &&
            html.includes("reading-tools-section") &&
            html.includes("theme-toggle")
          );
        },
      };

      // FIXED: Use TestUtilities.runTestSuite (after test-commands.js removal)
      logInfo("Running Export Pipeline test suite with TestUtilities");
      return await TestUtilities.runTestSuite("Export Pipeline", tests);
    } catch (error) {
      logError("Export pipeline test failed:", error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================================
  // PUBLIC API EXPORTS
  // ===========================================================================================

  return {
    testExportPipeline,
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Export pattern for global access - ENHANCED to ensure module object availability
const TestExportPipelineModule = TestExportPipeline;
window.TestExportPipeline = TestExportPipelineModule;
window.testExportPipeline = TestExportPipelineModule.testExportPipeline;
