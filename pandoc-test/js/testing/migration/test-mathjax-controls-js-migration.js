// js/testing/migration/test-mathjax-controls-js-migration.js
// MathJax Controls JavaScript Template Migration Testing
// Tests migration from string concatenation to external template

const TestMathJaxControlsJSMigration = (function () {
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
      console.error(`[TestMathJaxControlsJSMigration] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestMathJaxControlsJSMigration] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestMathJaxControlsJSMigration] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestMathJaxControlsJSMigration] ${message}`, ...args);
  }

  // ===========================================================================================
  // MATHJAX CONTROLS JS MIGRATION TESTING
  // ===========================================================================================

  /**
   * Test MathJax Controls JavaScript template migration
   * @returns {Object} Test results with success status and detailed results
   */
  async function testMathJaxControlsJSMigration() {
    logInfo("Starting MathJax Controls JavaScript template migration tests");

    try {
      // Test configuration for template rendering
      const testConfig = {
        zoomTrigger: "Click",
        zoomScale: "200%",
        assistiveMathML: true,
        tabNavigation: false,
        explorerEnabled: false,
      };

      const tests = {
        // 1. Template file exists and is readable
        templateFileExists: async () => {
          try {
            const response = await fetch("templates/js/mathjax-controls.js");
            const content = await response.text();
            return response.ok && content.length > 500; // Substantial content expected
          } catch (error) {
            logError("Template file check failed:", error);
            return false;
          }
        },

        // 2. Template system has loader method
        templateSystemHasLoader: () => {
          if (!window.TemplateSystem) {
            logError("TemplateSystem not available");
            return false;
          }
          const generator = window.TemplateSystem.createGenerator();
          return typeof generator.generateMathJaxControlsJS === "function";
        },

        // 3. Template loads successfully and generates valid content
        templateGeneratesValidJS: async () => {
          try {
            const generator = window.TemplateSystem.createGenerator();
            const js = await generator.generateMathJaxControlsJS(1); // Basic accessibility level

            const requiredComponents = [
              "MathJaxControlsManager",
              "setupZoomTriggerControls",
              "setupScreenReaderControls",
              "updateMathJaxConfig",
              "announceToScreenReader",
            ];

            const missingComponents = requiredComponents.filter(
              (component) => !js.includes(component)
            );

            if (missingComponents.length > 0) {
              logError("Missing required components:", missingComponents);
              return false;
            }

            return !js.includes("⚠️ Using fallback") && js.length > 1000;
          } catch (error) {
            logError("Template generation failed:", error);
            return false;
          }
        },

        // 4. Generated JS is executable (syntax check)
        templateJSExecutable: async () => {
          try {
            const generator = window.TemplateSystem.createGenerator();
            const js = await generator.generateMathJaxControlsJS(1);
            new Function(js); // Throws if invalid syntax
            return true;
          } catch (error) {
            logError("Generated JavaScript is not executable:", error);
            return false;
          }
        },

        // 5. Real exports use template (not fallback)
        realExportUsesTemplate: async () => {
          try {
            const html =
              await window.ExportManager.generateEnhancedStandaloneHTML(
                "\\[E = mc^2\\]",
                "MathJax Controls Test",
                2 // Higher accessibility level
              );

            const hasRequiredElements =
              html.includes("MathJaxControlsManager") &&
              html.includes("setupZoomTriggerControls") &&
              !html.includes("⚠️ Using fallback");

            if (!hasRequiredElements) {
              logError(
                "Export does not contain expected MathJax controls elements"
              );
            }

            return hasRequiredElements;
          } catch (error) {
            logError("Real export test failed:", error);
            return false;
          }
        },

        // 6. Performance is acceptable
        templatePerformance: async () => {
          try {
            const generator = window.TemplateSystem.createGenerator();
            const start = performance.now();
            const result = await generator.generateMathJaxControlsJS(2);
            const time = performance.now() - start;

            const performanceGood = time < 50 && result.length > 1000;

            if (!performanceGood) {
              logWarn(`Performance warning: ${time}ms, ${result.length} chars`);
            }

            return performanceGood;
          } catch (error) {
            logError("Performance test failed:", error);
            return false;
          }
        },
      };

      // ✅ CRITICAL: Use TestUtilities.runAsyncTestSuite
      return await TestUtilities.runAsyncTestSuite(
        "MathJaxControlsJSMigration",
        tests
      );
    } catch (error) {
      logError("Migration test failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check production readiness for MathJax Controls template
   */
  async function checkMathJaxControlsJSProductionReadiness() {
    console.log("📊 MATHJAX CONTROLS JS PRODUCTION READINESS REPORT");
    console.log("==================================================");

    const testResults = await testMathJaxControlsJSMigration();

    if (testResults.success && testResults.results) {
      testResults.results.forEach((result) => {
        const status = result.passed ? "✅" : "❌";
        const readiness = result.passed ? "READY" : "NOT READY";
        console.log(`${status} ${result.name}: ${readiness}`);
      });
    }

    const allReady =
      testResults.success &&
      testResults.results &&
      testResults.results.every((result) => result.passed);

    console.log("==================================================");
    console.log(
      `Overall: ${
        allReady
          ? "✅ READY TO REMOVE FALLBACK"
          : "❌ NOT READY - KEEP FALLBACK"
      }`
    );

    return { allReady, testResults };
  }

  return {
    testMathJaxControlsJSMigration,
    checkMathJaxControlsJSProductionReadiness,
  };
})();

// Export to global scope
window.TestMathJaxControlsJSMigration = TestMathJaxControlsJSMigration;
window.testMathJaxControlsJSMigration =
  TestMathJaxControlsJSMigration.testMathJaxControlsJSMigration;
window.checkMathJaxControlsJSProductionReadiness =
  TestMathJaxControlsJSMigration.checkMathJaxControlsJSProductionReadiness;
