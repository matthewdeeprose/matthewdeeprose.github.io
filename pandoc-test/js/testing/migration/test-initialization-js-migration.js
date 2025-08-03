// js/testing/migration/test-initialization-js-migration.js
// JavaScript Template Migration Test - Initialization Function
// Tests the migration from string concatenation to external JavaScript template files

const TestInitializationJSMigration = (function () {
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
      console.error(`[TestInitializationJSMigration] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestInitializationJSMigration] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestInitializationJSMigration] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestInitializationJSMigration] ${message}`, ...args);
  }

  // ===========================================================================================
  // INITIALIZATION JAVASCRIPT MIGRATION TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test initialization JavaScript template migration functionality
   * @returns {Object} Test results with success status and detailed results
   */
  async function testInitializationJSMigration() {
    logInfo("Starting initialization JavaScript template migration tests");

    try {
      const tests = {
        templateFileExists: async () => {
          try {
            const response = await fetch("templates/js/initialization.js");
            const exists = response.ok;
            if (exists) {
              logDebug(
                "✅ Template file templates/js/initialization.js exists"
              );
              // Also verify we can read the content
              const content = await response.text();
              const hasContent = content.length > 100;
              logDebug(
                `✅ Template file contains ${content.length} characters`
              );
              return exists && hasContent;
            } else {
              logError(
                "❌ Template file templates/js/initialization.js not found"
              );
              return false;
            }
          } catch (error) {
            logError("❌ Error checking template file existence:", error);
            return false;
          }
        },

        templateLoadsSuccessfully: async () => {
          if (!window.TemplateSystem) {
            logError("❌ TemplateSystem not available");
            return false;
          }

          try {
            const generator = window.TemplateSystem.createGenerator();
            // Try to load the template directly
            const templateContent = await generator.loadJavaScriptTemplate(
              "initialization.js"
            );

            // Verify it's actual template content, not fallback
            const isTemplateContent =
              templateContent.includes("Component Initialization Manager") &&
              templateContent.includes("initializeAllComponents") &&
              !templateContent.includes("⚠️ Using fallback");

            if (isTemplateContent) {
              logDebug(
                "✅ Template loads successfully via loadJavaScriptTemplate"
              );
              return true;
            } else {
              logError("❌ Template loader returned unexpected content");
              return false;
            }
          } catch (error) {
            logError("❌ Template loading failed:", error);
            return false;
          }
        },

        templateGeneratesValidJS: async () => {
          if (!window.TemplateSystem) {
            logError("❌ TemplateSystem not available");
            return false;
          }

          try {
            const generator = window.TemplateSystem.createGenerator();
            const generatedJS = await generator.generateInitializationJS();

            // Check all critical components are present
            const requiredComponents = [
              "initializeAllComponents",
              "ReadingAccessibilityManager",
              "ThemeToggleManager",
              "PrintButtonManager",
              "ResetControlsManager",
              "DOMContentLoaded",
            ];

            const missingComponents = requiredComponents.filter(
              (comp) => !generatedJS.includes(comp)
            );

            if (missingComponents.length > 0) {
              logError(
                `❌ Generated JS missing components: ${missingComponents.join(
                  ", "
                )}`
              );
              return false;
            }

            // Verify it's NOT using fallback
            if (generatedJS.includes("⚠️ Using fallback")) {
              logError(
                "❌ Generated JS contains fallback warning - template not being used!"
              );
              return false;
            }

            logDebug(
              "✅ Template generates valid JS with all required components"
            );
            return true;
          } catch (error) {
            logError("❌ Error generating JavaScript from template:", error);
            return false;
          }
        },

        templateJSExecutable: async () => {
          try {
            const generator = window.TemplateSystem.createGenerator();
            const jsCode = await generator.generateInitializationJS();

            // Test that JavaScript is syntactically valid
            new Function(jsCode);
            logDebug(
              "✅ Generated JavaScript is syntactically valid and executable"
            );
            return true;
          } catch (error) {
            logError("❌ Generated JavaScript has syntax errors:", error);
            return false;
          }
        },

        realExportUsesTemplate: async () => {
          if (!window.ExportManager) {
            logError("❌ ExportManager not available");
            return false;
          }

          try {
            // Generate a real export
            const html =
              await window.ExportManager.generateEnhancedStandaloneHTML(
                "\\[E = mc^2\\]",
                "Migration Test Document",
                2
              );

            // Check that the export contains template markers
            const containsTemplateMarkers =
              html.includes("// templates/js/initialization.js") ||
              html.includes("Component Initialization Manager");

            // Ensure NO fallback warnings in final output
            const containsFallbackWarning = html.includes("⚠️ Using fallback");

            // Check for actual initialization code
            const containsInitCode =
              html.includes("initializeAllComponents") &&
              html.includes("DOMContentLoaded");

            if (!containsTemplateMarkers) {
              logError("❌ Export doesn't contain template markers");
              return false;
            }

            if (containsFallbackWarning) {
              logError(
                "❌ Export contains fallback warnings - template not being used!"
              );
              return false;
            }

            if (!containsInitCode) {
              logError("❌ Export missing initialization code");
              return false;
            }

            logDebug(
              "✅ Real export successfully uses template without fallback"
            );
            logDebug(`Export size: ${html.length} characters`);
            return true;
          } catch (error) {
            logError("❌ Error testing real export:", error);
            return false;
          }
        },

        templatePerformance: async () => {
          try {
            const generator = window.TemplateSystem.createGenerator();

            // Measure template generation time
            const startTime = performance.now();
            const result = await generator.generateInitializationJS();
            const endTime = performance.now();

            const generationTime = endTime - startTime;

            // Should be fast (under 50ms even for first load)
            const isFast = generationTime < 50;

            if (isFast) {
              logDebug(
                `✅ Template generation fast: ${generationTime.toFixed(2)}ms`
              );
            } else {
              logWarn(
                `⚠️ Template generation slow: ${generationTime.toFixed(2)}ms`
              );
            }

            // Verify result is valid
            const isValid =
              result.length > 100 && !result.includes("⚠️ Using fallback");

            return isFast && isValid;
          } catch (error) {
            logError("❌ Error testing template performance:", error);
            return false;
          }
        },
      };

      // ✅ CRITICAL: Use TestUtilities.runAsyncTestSuite (for async tests)
      return await TestUtilities.runAsyncTestSuite(
        "InitializationJSMigration",
        tests
      );
    } catch (error) {
      logError("Migration test failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if template implementation is ready for production (fallback can be removed)
   * @returns {Object} Detailed readiness report
   */
  async function checkProductionReadiness() {
    logInfo("🔍 Checking if template implementation is production-ready...");

    const checks = {
      templateExists: false,
      templateLoads: false,
      generatesValidJS: false,
      jsExecutable: false,
      realExportsWork: false,
      performanceGood: false,
      noFallbackWarnings: false,
    };

    try {
      // Run all checks
      const generator = window.TemplateSystem.createGenerator();

      // 1. Template file exists
      const response = await fetch("templates/js/initialization.js");
      checks.templateExists = response.ok;

      // 2. Template loads successfully
      try {
        const content = await generator.loadJavaScriptTemplate(
          "initialization.js"
        );
        checks.templateLoads = content.length > 100;
      } catch (e) {
        checks.templateLoads = false;
      }

      // 3. Generates valid JS
      try {
        const js = await generator.generateInitializationJS();
        checks.generatesValidJS =
          js.includes("initializeAllComponents") &&
          !js.includes("⚠️ Using fallback");
      } catch (e) {
        checks.generatesValidJS = false;
      }

      // 4. JS is executable
      try {
        const js = await generator.generateInitializationJS();
        new Function(js);
        checks.jsExecutable = true;
      } catch (e) {
        checks.jsExecutable = false;
      }

      // 5. Real exports work
      try {
        const html = await window.ExportManager.generateEnhancedStandaloneHTML(
          "\\[x^2\\]",
          "Test",
          2
        );
        checks.realExportsWork =
          html.includes("initializeAllComponents") &&
          !html.includes("⚠️ Using fallback");
      } catch (e) {
        checks.realExportsWork = false;
      }

      // 6. Performance is good
      const start = performance.now();
      await generator.generateInitializationJS();
      const time = performance.now() - start;
      checks.performanceGood = time < 50;

      // 7. No fallback warnings in console
      // This is assumed true if all other checks pass
      checks.noFallbackWarnings = Object.values(checks).every(
        (v) => v === true
      );

      // Summary
      const allPassed = Object.values(checks).every((check) => check === true);

      console.log("📊 PRODUCTION READINESS REPORT");
      console.log("================================");
      Object.entries(checks).forEach(([check, passed]) => {
        console.log(
          `${passed ? "✅" : "❌"} ${check}: ${passed ? "READY" : "NOT READY"}`
        );
      });
      console.log("================================");
      console.log(
        `Overall: ${
          allPassed
            ? "✅ READY TO REMOVE FALLBACK"
            : "❌ NOT READY - KEEP FALLBACK"
        }`
      );

      return {
        ready: allPassed,
        checks: checks,
      };
    } catch (error) {
      logError("Error checking production readiness:", error);
      return { ready: false, checks: checks, error: error.message };
    }
  }

  // Return both functions from the IIFE
  return { testInitializationJSMigration, checkProductionReadiness };
})();

// Export to global scope
window.TestInitializationJSMigration = TestInitializationJSMigration;
window.testInitializationJSMigration =
  TestInitializationJSMigration.testInitializationJSMigration;
window.checkInitializationJSProductionReadiness =
  TestInitializationJSMigration.checkProductionReadiness;

console.log(
  "✅ TestInitializationJSMigration loaded - JavaScript template migration testing ready!"
);
window.testInitializationJSMigration =
  TestInitializationJSMigration.testInitializationJSMigration;
window.checkInitializationJSProductionReadiness =
  TestInitializationJSMigration.checkProductionReadiness;

console.log(
  "? TestInitializationJSMigration loaded - JavaScript template migration testing ready!"
);
