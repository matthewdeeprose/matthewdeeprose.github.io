// js/testing/migration/test-reading-tools-setup-js-migration.js
// JavaScript Template Migration Test - Reading Tools Setup Function
// Tests the migration from string concatenation to external JavaScript template files

const TestReadingToolsSetupJSMigration = (function () {
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
      console.error(`[TestReadingToolsSetupJSMigration] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestReadingToolsSetupJSMigration] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestReadingToolsSetupJSMigration] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestReadingToolsSetupJSMigration] ${message}`, ...args);
  }

  // ===========================================================================================
  // READING TOOLS SETUP JAVASCRIPT MIGRATION TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test Reading Tools Setup JavaScript template migration functionality
   * @returns {Object} Test results with success status and detailed results
   */
  async function testReadingToolsSetupJSMigration() {
    logInfo("Starting Reading Tools Setup JavaScript template migration tests");

    try {
      const tests = {
        // 1. Template file exists and is readable
        templateFileExists: async () => {
          try {
            const response = await fetch("templates/js/reading-tools-setup.js");
            const content = await response.text();
            const exists = response.ok && content.length > 1000;
            if (exists) {
              logDebug(
                "✅ Template file templates/js/reading-tools-setup.js exists and has content"
              );
            } else {
              logError(
                "❌ Template file templates/js/reading-tools-setup.js not found or empty"
              );
            }
            return exists;
          } catch (error) {
            logError("❌ Error checking template file existence:", error);
            return false;
          }
        },

        // 2. Template system has the new loader method
        templateSystemHasLoader: () => {
          if (!window.TemplateSystem) {
            logError("❌ TemplateSystem not available");
            return false;
          }

          const generator = window.TemplateSystem.createGenerator();
          const hasMethod =
            typeof generator.generateReadingToolsSetupJS === "function";

          if (hasMethod) {
            logDebug(
              "✅ TemplateSystem has generateReadingToolsSetupJS method"
            );
          } else {
            logError(
              "❌ TemplateSystem missing generateReadingToolsSetupJS method"
            );
          }

          return hasMethod;
        },

        // 3. Template loads successfully and generates valid JavaScript content
        templateGeneratesValidJS: async () => {
          try {
            const generator = window.TemplateSystem.createGenerator();
            const js = await generator.generateReadingToolsSetupJS(2);

            // Check for key components that should be in the generated JavaScript
            const requiredComponents = [
              "ReadingAccessibilityManager",
              "setupEventHandlers",
              "updateFontFamily",
              "updateFontSize",
              "updateReadingWidth",
              "announceChange",
              "resetAllSettings",
            ];

            const missingComponents = requiredComponents.filter(
              (component) => !js.includes(component)
            );

            const isValid =
              missingComponents.length === 0 &&
              !js.includes("⚠️ Using fallback") &&
              js.length > 2000;

            if (isValid) {
              logDebug(
                "✅ Template generates valid JavaScript with all required components"
              );
            } else {
              logError("❌ Template missing components:", missingComponents);
              logError("❌ Generated JS length:", js.length);
            }

            return isValid;
          } catch (error) {
            logError("❌ Template generation failed:", error);
            return false;
          }
        },

        // 4. Generated JavaScript is syntactically valid (can be parsed)
        templateJSExecutable: async () => {
          try {
            const generator = window.TemplateSystem.createGenerator();
            const js = await generator.generateReadingToolsSetupJS(2);

            // Test syntax by creating a function (this will throw if invalid syntax)
            new Function(js);

            logDebug("✅ Generated JavaScript has valid syntax");
            return true;
          } catch (error) {
            logError("❌ Generated JavaScript has syntax errors:", error);
            return false;
          }
        },

        // 5. Real exports use the template (integration test)
        realExportUsesTemplate: async () => {
          try {
            const testContent = "\\[E = mc^2\\]";
            const html =
              await window.ExportManager.generateEnhancedStandaloneHTML(
                testContent,
                "Reading Tools Test",
                2
              );

            // Check that the exported HTML contains the reading accessibility manager
            const hasReadingManager = html.includes(
              "ReadingAccessibilityManager"
            );
            const hasSetupMethods = html.includes("setupEventHandlers");
            const noFallbackWarnings = !html.includes("⚠️ Using fallback");

            const success =
              hasReadingManager && hasSetupMethods && noFallbackWarnings;

            if (success) {
              logDebug(
                "✅ Real exports contain Reading Tools Setup from template"
              );
            } else {
              logError(
                "❌ Real exports missing Reading Tools Setup components"
              );
              logError("Has ReadingAccessibilityManager:", hasReadingManager);
              logError("Has setup methods:", hasSetupMethods);
              logError("No fallback warnings:", noFallbackWarnings);
            }

            return success;
          } catch (error) {
            logError("❌ Real export integration test failed:", error);
            return false;
          }
        },

        // 6. Template performance is acceptable
        templatePerformance: async () => {
          try {
            const generator = window.TemplateSystem.createGenerator();
            const start = performance.now();
            const result = await generator.generateReadingToolsSetupJS(2);
            const time = performance.now() - start;

            const isPerformant = time < 50 && result.length > 2000;

            if (isPerformant) {
              logDebug(
                `✅ Template performance acceptable: ${time.toFixed(2)}ms`
              );
            } else {
              logError(
                `❌ Template performance issues: ${time.toFixed(2)}ms, ${
                  result.length
                } chars`
              );
            }

            return isPerformant;
          } catch (error) {
            logError("❌ Template performance test failed:", error);
            return false;
          }
        },
      };

      // ✅ CRITICAL: Use TestUtilities.runAsyncTestSuite (proven working pattern)
      return await TestUtilities.runAsyncTestSuite(
        "ReadingToolsSetupJSMigration",
        tests
      );
    } catch (error) {
      logError("Reading Tools Setup JS migration test failed:", error);
      return { success: false, error: error.message };
    }
  }

  return { testReadingToolsSetupJSMigration };
})();

// Export to global scope
window.TestReadingToolsSetupJSMigration = TestReadingToolsSetupJSMigration;
window.testReadingToolsSetupJSMigration =
  TestReadingToolsSetupJSMigration.testReadingToolsSetupJSMigration;

console.log(
  "✅ TestReadingToolsSetupJSMigration loaded - Reading Tools Setup JavaScript migration testing ready!"
);
