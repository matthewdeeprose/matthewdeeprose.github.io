// js/testing/migration/test-reading-accessibility-manager-class-js-migration.js

const TestReadingAccessibilityManagerClassJSMigration = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (IIFE SCOPE) - LESSON 1 INTEGRATION
  // ===========================================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
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
      console.error(
        `[TestReadingAccessibilityManagerClassJSMigration] ${message}`,
        ...args
      );
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(
        `[TestReadingAccessibilityManagerClassJSMigration] ${message}`,
        ...args
      );
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(
        `[TestReadingAccessibilityManagerClassJSMigration] ${message}`,
        ...args
      );
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(
        `[TestReadingAccessibilityManagerClassJSMigration] ${message}`,
        ...args
      );
  }

  // ===========================================================================================
  // MIGRATION TESTING IMPLEMENTATION
  // ===========================================================================================

  const testParams = {
    defaultFontSize: "1.0",
    defaultFontFamily: "Verdana, sans-serif",
    defaultReadingWidth: "medium",
    defaultLineHeight: "1.6",
    defaultParagraphSpacing: "1.0",
    enableAdvancedControls: true,
  };

  async function testReadingAccessibilityManagerClassJSMigration() {
    logInfo(
      "Starting Reading Accessibility Manager Class JavaScript template migration tests"
    );

    try {
      const tests = {
        templateFileExists: async () => {
          try {
            const response = await fetch(
              "templates/js/reading-accessibility-manager-class.js"
            );
            const content = await response.text();
            const hasContent = content.length > 2000; // Large class file
            const hasClass = content.includes(
              "class ReadingAccessibilityManager"
            );
            const hasMethods =
              content.includes("updateFontFamily") &&
              content.includes("resetAllSettings");

            logDebug(
              `Template file - Size: ${content.length}, Has class: ${hasClass}, Has methods: ${hasMethods}`
            );
            return response.ok && hasContent && hasClass && hasMethods;
          } catch (error) {
            logError("Template file check failed:", error);
            return false;
          }
        },

        templateSystemHasLoader: () => {
          if (!window.TemplateSystem) {
            logError("TemplateSystem not available");
            return false;
          }
          const generator = window.TemplateSystem.createGenerator();
          const hasMethod =
            typeof generator.generateReadingAccessibilityManagerClassJS ===
            "function";
          logDebug(`Template system loader method available: ${hasMethod}`);
          return hasMethod;
        },

        templateGeneratesValidJS: async () => {
          try {
            const generator = window.TemplateSystem.createGenerator();
            const js =
              await generator.generateReadingAccessibilityManagerClassJS(
                testParams
              );

            const requiredComponents = [
              "class ReadingAccessibilityManager",
              "constructor()",
              "setupEventHandlers()",
              "updateFontFamily(",
              "updateFontSize(",
              "updateLineHeight(",
              "updateReadingWidth(",
              "updateParagraphSpacing(",
              "resetAllSettings(",
              "announceChange(",
            ];

            const missingComponents = requiredComponents.filter(
              (c) => !js.includes(c)
            );
            const hasValidContent =
              !js.includes("⚠️ Using fallback") && js.length > 2000;
            const hasVariableSubstitution = js.includes(
              testParams.defaultFontFamily
            );

            if (missingComponents.length > 0) {
              logError("Missing components:", missingComponents);
            }

            logDebug(
              `Generated JS - Length: ${js.length}, Has variables: ${hasVariableSubstitution}, Valid: ${hasValidContent}`
            );
            return (
              missingComponents.length === 0 &&
              hasValidContent &&
              hasVariableSubstitution
            );
          } catch (error) {
            logError("Template generation failed:", error);
            return false;
          }
        },

        templateJSExecutable: async () => {
          try {
            const generator = window.TemplateSystem.createGenerator();
            const js =
              await generator.generateReadingAccessibilityManagerClassJS(
                testParams
              );

            // Test syntax by creating a function
            new Function(js);
            logDebug("✅ Generated JavaScript has valid syntax");
            return true;
          } catch (syntaxError) {
            logError(
              "❌ Syntax error in generated JavaScript:",
              syntaxError.message
            );
            return false;
          }
        },

        // LESSON 2 INTEGRATION: Critical Promise string detection
        realExportUsesTemplate: async () => {
          try {
            const html =
              await window.ExportManager.generateEnhancedStandaloneHTML(
                "\\[E = mc^2\\]",
                "Reading Manager Test",
                2
              );

            const hasManagerClass = html.includes(
              "class ReadingAccessibilityManager"
            );
            const noFallback = !html.includes("⚠️ Using fallback");
            const noPromiseStrings = !html.includes("[object Promise]"); // CRITICAL CHECK
            const hasProperMethods =
              html.includes("updateFontFamily") &&
              html.includes("resetAllSettings");

            if (html.includes("[object Promise]")) {
              logError(
                "❌ CRITICAL: Found [object Promise] in export - missing await in export-manager.js"
              );
            }

            logDebug(
              `Export validation - Has class: ${hasManagerClass}, No fallback: ${noFallback}, No promises: ${noPromiseStrings}, Has methods: ${hasProperMethods}`
            );
            return (
              hasManagerClass &&
              noFallback &&
              noPromiseStrings &&
              hasProperMethods
            );
          } catch (error) {
            logError("Real export test failed:", error);
            return false;
          }
        },

        templatePerformance: async () => {
          try {
            const generator = window.TemplateSystem.createGenerator();
            const start = performance.now();
            const result =
              await generator.generateReadingAccessibilityManagerClassJS(
                testParams
              );
            const time = performance.now() - start;

            const performanceGood = time < 50; // Under 50ms
            const contentGenerated = result.length > 2000;

            logDebug(
              `Performance - Time: ${time.toFixed(2)}ms, Content length: ${
                result.length
              }`
            );
            return performanceGood && contentGenerated;
          } catch (error) {
            logError("Performance test failed:", error);
            return false;
          }
        },
      };

      return await TestUtilities.runAsyncTestSuite(
        "ReadingAccessibilityManagerClassJSMigration",
        tests
      );
    } catch (error) {
      logError("Migration test failed:", error);
      return { success: false, error: error.message };
    }
  }

  return { testReadingAccessibilityManagerClassJSMigration };
})();

window.TestReadingAccessibilityManagerClassJSMigration =
  TestReadingAccessibilityManagerClassJSMigration;
window.testReadingAccessibilityManagerClassJSMigration =
  TestReadingAccessibilityManagerClassJSMigration.testReadingAccessibilityManagerClassJSMigration;

// LESSON 1 INTEGRATION: Use console.log for global scope
console.log(
  "✅ Reading Accessibility Manager Class JS Migration test loaded - ready for testing!"
);
