// js/testing/migration/test-focus-tracking-js-migration.js

const TestFocusTrackingJSMigration = (function () {
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
      console.error(`[TestFocusTrackingJSMigration] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestFocusTrackingJSMigration] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestFocusTrackingJSMigration] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestFocusTrackingJSMigration] ${message}`, ...args);
  }

  // ===========================================================================================
  // FOCUS TRACKING JS MIGRATION TESTING IMPLEMENTATION
  // ===========================================================================================

  const testParams = {
    enableFocusTracking: true,
    enableKeyboardNavigation: true,
    enableAccessibilityAnnouncements: true,
    enableFocusHistory: true,
    enableConsoleCommands: true,
  };

  /**
   * Test Focus Tracking JavaScript template migration
   * @returns {Object} Test results with success status and detailed results
   */
  async function testFocusTrackingJSMigration() {
    logInfo("Starting Focus Tracking JavaScript template migration tests");

    try {
      const tests = {
        // 1. Template file exists and is readable
        templateFileExists: async () => {
          const response = await fetch("templates/js/focus-tracking.js");
          const content = await response.text();
          return response.ok && content.length > 500;
        },

        // 2. Template system has loader method
        templateSystemHasLoader: () => {
          if (!window.TemplateSystem) return false;
          const generator = window.TemplateSystem.createGenerator();
          return typeof generator.generateFocusTrackingJS === "function";
        },

        // 3. Template loads successfully and generates valid content
        templateGeneratesValidJS: async () => {
          const generator = window.TemplateSystem.createGenerator();
          const js = await generator.generateFocusTrackingJS(testParams);

          const requiredComponents = [
            "FocusTracker",
            "trackFocus",
            "stopFocusTracking",
            "getCurrentFocus",
            "describeElement",
            "logFocusChanges",
          ];
          const missingComponents = requiredComponents.filter(
            (c) => !js.includes(c)
          );

          logDebug(`Generated JS length: ${js.length}`);
          if (missingComponents.length > 0) {
            logError("Missing components:", missingComponents);
          }

          return (
            missingComponents.length === 0 &&
            !js.includes("⚠️ Using fallback") &&
            js.length > 1000
          );
        },

        // 4. Generated JS is executable (syntax check)
        templateJSExecutable: async () => {
          const generator = window.TemplateSystem.createGenerator();
          const js = await generator.generateFocusTrackingJS(testParams);
          try {
            new Function(js); // Throws if invalid syntax
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

        // 5. Real exports use template (integration test)
        realExportUsesTemplate: async () => {
          const html =
            await window.ExportManager.generateEnhancedStandaloneHTML(
              "\\[E = mc^2\\]",
              "Focus Test",
              2
            );

          const hasFocusTracker = html.includes("FocusTracker");
          const hasTrackFocus = html.includes("trackFocus");
          const noFallback = !html.includes("⚠️ Using fallback");

          logDebug(`Export size: ${html.length}`);
          logDebug(`Has FocusTracker: ${hasFocusTracker}`);
          logDebug(`Has trackFocus: ${hasTrackFocus}`);
          logDebug(`No fallback: ${noFallback}`);

          return hasFocusTracker && hasTrackFocus && noFallback;
        },

        // 6. Performance is acceptable
        templatePerformance: async () => {
          const generator = window.TemplateSystem.createGenerator();
          const start = performance.now();
          const result = await generator.generateFocusTrackingJS(testParams);
          const time = performance.now() - start;

          logDebug(`Template generation time: ${time.toFixed(2)}ms`);
          return time < 50 && result.length > 1000;
        },
      };

      // ✅ CRITICAL: Use TestUtilities.runAsyncTestSuite
      return await TestUtilities.runAsyncTestSuite(
        "FocusTrackingJSMigration",
        tests
      );
    } catch (error) {
      logError("Migration test failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check production readiness for Focus Tracking JS migration
   * @returns {Object} Production readiness assessment
   */
  function checkFocusTrackingJSProductionReadiness() {
    logInfo("Performing Focus Tracking JS production readiness check");

    try {
      const checks = {
        templateSystemAvailable: !!window.TemplateSystem,
        loaderMethodExists:
          window.TemplateSystem &&
          typeof window.TemplateSystem.createGenerator()
            .generateFocusTrackingJS === "function",
        exportManagerIntegration: !!window.ExportManager,
        testingFrameworkReady: !!window.TestUtilities,
      };

      const readiness = Object.values(checks).every((check) => check);

      return {
        ready: readiness,
        checks: checks,
        message: readiness
          ? "✅ Focus Tracking JS migration ready for production"
          : "⚠️ Focus Tracking JS migration not ready - check failed components",
      };
    } catch (error) {
      logError("Production readiness check failed:", error);
      return {
        ready: false,
        error: error.message,
        message: "❌ Production readiness check failed",
      };
    }
  }

  return {
    testFocusTrackingJSMigration,
    checkFocusTrackingJSProductionReadiness,
  };
})();

// Export to global scope
window.TestFocusTrackingJSMigration = TestFocusTrackingJSMigration;
window.testFocusTrackingJSMigration =
  TestFocusTrackingJSMigration.testFocusTrackingJSMigration;
window.checkFocusTrackingJSProductionReadiness =
  TestFocusTrackingJSMigration.checkFocusTrackingJSProductionReadiness;

console.log("✅ Focus Tracking JS Migration test loaded - ready for testing!");
