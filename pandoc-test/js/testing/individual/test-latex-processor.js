// js/testing/individual/test-latex-processor.js
// Individual Test Module for LaTeXProcessor
// Part of Enhanced Pandoc-WASM Mathematical Playground Phase 5.7 Refactoring
// Tests LaTeX processing functionality with proper WCAG 2.2 AA compliance

const TestLaTeXProcessor = (function () {
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
      console.error(`[TestLaTeXProcessor] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestLaTeXProcessor] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestLaTeXProcessor] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestLaTeXProcessor] ${message}`, ...args);
  }

  // ===========================================================================================
  // LATEXPROCESSOR MODULE TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test LaTeXProcessor module functionality
   * Validates LaTeX processing, MathJax conversion, metadata extraction, and content validation
   * @returns {Object} Test results with success status and detailed results
   */
  function testLaTeXProcessor() {
    logInfo("Starting LaTeXProcessor module tests");

    try {
      if (!window.LaTeXProcessor) {
        throw new Error("LaTeXProcessor module not available");
      }

      const tests = {
        sharedUtilitiesAvailable: () => {
          // Verify core module has shared utilities, NOT legacy methods
          const hasShared =
            typeof window.LaTeXProcessor.extractDocumentMetadata ===
              "function" &&
            typeof window.LaTeXProcessor.cleanLatexContent === "function" &&
            typeof window.LaTeXProcessor.validateLatexSyntax === "function";

          const noLegacy =
            typeof window.LaTeXProcessor.convertMathJaxToLatex === "undefined";

          return hasShared && noLegacy;
        },

        generateMathJaxConfig: () => {
          const config = window.LaTeXProcessor.generateMathJaxConfig(2);
          return (
            config.includes("MathJax") &&
            config.includes("Enhanced MathJax Configuration")
          );
        },

        // Phase 1E: Test MathJax extension loading
        mathJaxExtensionsInConfig: () => {
          const config = window.LaTeXProcessor.generateMathJaxConfig(2);

          // Check cancel extension in loader
          const hasCancelLoader = config.includes("'[tex]/cancel'");
          if (!hasCancelLoader) {
            throw new Error("Missing [tex]/cancel in loader configuration");
          }

          // Check color extension in loader
          const hasColorLoader = config.includes("'[tex]/color'");
          if (!hasColorLoader) {
            throw new Error("Missing [tex]/color in loader configuration");
          }

          // Check cancel in packages array
          const hasCancelPackage = config.includes("'cancel'");
          if (!hasCancelPackage) {
            throw new Error("Missing 'cancel' in packages array");
          }

          // Check color in packages array
          const hasColorPackage = config.includes("'color'");
          if (!hasColorPackage) {
            throw new Error("Missing 'color' in packages array");
          }

          // Check coloneqq macro exists
          const hasColoneqqMacro = config.includes("coloneqq");
          if (!hasColoneqqMacro) {
            throw new Error("Missing coloneqq macro in configuration");
          }

          return true;
        },

        // Phase 1E: Test default macros include coloneqq
        mathJaxDefaultMacros: () => {
          const config = window.LaTeXProcessor.generateMathJaxConfig(2);

          // Check widecheck macro (existing default)
          const hasWidecheck = config.includes("widecheck");
          if (!hasWidecheck) {
            throw new Error("Missing default widecheck macro");
          }

          // Check coloneqq macro (new in Phase 1E)
          const hasColoneqq =
            config.includes("coloneqq") && config.includes("\\\\mathrel{:=}");
          if (!hasColoneqq) {
            throw new Error("Missing or malformed coloneqq macro");
          }

          return true;
        },

        extractMetadata: () => {
          const testContent = "<h1>Test Title</h1><h2>Section 1</h2>";
          const metadata =
            window.LaTeXProcessor.extractDocumentMetadata(testContent);
          return metadata && metadata.title && metadata.sections;
        },

        validateLatex: () => {
          const testLatex = "x^2 + y^2 = z^2";
          const result = window.LaTeXProcessor.validateLatexSyntax(testLatex);
          return result && result.valid === true;
        },

        cleanContent: () => {
          const content = window.LaTeXProcessor.cleanLatexContent(
            "  \n\nTest content\n\n  "
          );
          return content === "Test content";
        },
      };

      // FIXED: Use TestUtilities.runTestSuite (after test-commands.js removal)
      logInfo("Running LaTeXProcessor test suite with TestUtilities");
      return TestUtilities.runTestSuite("LaTeXProcessor", tests);
    } catch (error) {
      logError("LaTeXProcessor test failed:", error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================================
  // PUBLIC API EXPORTS
  // ===========================================================================================

  return {
    testLaTeXProcessor,
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Export pattern for global access (matches Sessions 1-2 success pattern)
window.TestLaTeXProcessor = TestLaTeXProcessor;
window.testLaTeXProcessor = TestLaTeXProcessor.testLaTeXProcessor;
