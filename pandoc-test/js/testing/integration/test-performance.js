// js/testing/integration/test-performance.js
const TestPerformance = (function () {
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
      console.error(`[TestPerformance] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestPerformance] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestPerformance] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestPerformance] ${message}`, ...args);
  }

  // ===========================================================================================
  // PERFORMANCE TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test module performance
   * @returns {Object} Test results with success status and detailed results
   */
  async function testPerformance() {
    logInfo("Starting module performance tests");

    try {
      if (
        !window.ContentGenerator ||
        !window.TemplateSystem ||
        !window.ExportManager
      ) {
        throw new Error(
          "Required modules not available for performance testing"
        );
      }

      const tests = {
        cssGeneration: () => {
          const start = performance.now();
          const css = window.ContentGenerator.generateEnhancedCSS();
          const duration = performance.now() - start;

          console.log(`⏱️ CSS Generation: ${duration.toFixed(2)}ms`);
          console.log(`📏 CSS Size: ${css.length} characters`);
          console.log(
            `📊 CSS Generation: ${
              duration < 100
                ? "EXCELLENT"
                : duration < 200
                ? "GOOD"
                : "NEEDS IMPROVEMENT"
            }`
          );

          return css && css.length > 1000 && duration < 500;
        },

        templateRendering: () => {
          const generator = window.TemplateSystem.createGenerator();
          const start = performance.now();

          // Test multiple template renders
          const templates = [
            "readingToolsSection",
            "themeToggleSection",
            "printButtonSection",
            "resetControlsSection",
          ];

          let totalSize = 0;
          for (const template of templates) {
            const result = generator.renderTemplate(template);
            totalSize += result.length;
          }

          const duration = performance.now() - start;
          const avgPerTemplate = duration / templates.length;

          console.log(`⏱️ Template Rendering: ${duration.toFixed(2)}ms total`);
          console.log(
            `📊 Average per template: ${avgPerTemplate.toFixed(2)}ms`
          );
          console.log(`📏 Total rendered size: ${totalSize} characters`);
          console.log(
            `📊 Template Performance: ${
              avgPerTemplate < 1
                ? "EXCELLENT"
                : avgPerTemplate < 5
                ? "GOOD"
                : "NEEDS IMPROVEMENT"
            }`
          );

          return avgPerTemplate < 10 && totalSize > 500;
        },

        exportGeneration: async () => {
          const testContent = `
            <h1>Performance Test Document</h1>
            <h2>Mathematical Content</h2>
            <p>Testing performance with: $E = mc^2$</p>
            <p>Complex equation: $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$</p>
            <h2>Additional Content</h2>
            <p>More content to test export performance...</p>
          `;

          const start = performance.now();
          // CRITICAL FIX: Await the async function - generateEnhancedStandaloneHTML returns Promise
          const result =
            await window.ExportManager.generateEnhancedStandaloneHTML(
              testContent,
              "Performance Test",
              2
            );
          const duration = performance.now() - start;

          console.log(`⏱️ Export Generation: ${duration.toFixed(2)}ms`);
          console.log(`📏 Export Size: ${result.length} characters`);
          console.log(
            `📊 Efficiency: ${(result.length / duration).toFixed(0)} chars/ms`
          );
          console.log(
            `📊 Export Performance: ${
              duration < 500
                ? "EXCELLENT"
                : duration < 1000
                ? "GOOD"
                : "NEEDS IMPROVEMENT"
            }`
          );

          return result && result.length > 50000 && duration < 2000;
        },

        memoryEfficiency: () => {
          // Test memory usage during operations
          const initialMemory = performance.memory
            ? performance.memory.usedJSHeapSize
            : 0;

          // Perform memory-intensive operations
          const generator = window.TemplateSystem.createGenerator();
          const largeContent = "<p>Test content</p>".repeat(1000);
          const enhanced = window.ContentGenerator.enhanceDocumentStructure(
            largeContent,
            { sections: [] }
          );

          const finalMemory = performance.memory
            ? performance.memory.usedJSHeapSize
            : 0;
          const memoryIncrease = finalMemory - initialMemory;

          if (performance.memory) {
            console.log(
              `💾 Memory Usage: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`
            );
            console.log(
              `📈 Memory Increase: ${(memoryIncrease / 1024).toFixed(2)} KB`
            );
            console.log(
              `📊 Memory Efficiency: ${
                memoryIncrease < 1024 * 1024 ? "EXCELLENT" : "GOOD"
              }`
            );
          } else {
            console.log("💾 Memory monitoring not available in this browser");
          }

          return enhanced && enhanced.length > largeContent.length;
        },
      };

      // FIXED: Use TestUtilities.runTestSuite (after test-commands.js removal)
      logInfo("Running Performance test suite with TestUtilities");
      return await TestUtilities.runTestSuite("Performance", tests);
    } catch (error) {
      logError("Performance test failed:", error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================================
  // PUBLIC API EXPORTS
  // ===========================================================================================

  return {
    testPerformance,
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Export pattern for global access (matches Sessions 1-5 success pattern)
window.TestPerformance = TestPerformance;
window.testPerformance = TestPerformance.testPerformance;
