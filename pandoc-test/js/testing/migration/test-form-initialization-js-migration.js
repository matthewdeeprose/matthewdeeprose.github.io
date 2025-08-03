// js/testing/migration/test-form-initialization-js-migration.js
// Form Initialization JavaScript Migration Test
// Tests migration from string concatenation to external template system
// ✅ PHASE 2A STEP 4: Form Initialization JS Migration Test

const TestFormInitializationJSMigration = (function () {
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
      console.error(`[TestFormInitializationJSMigration] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestFormInitializationJSMigration] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestFormInitializationJSMigration] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestFormInitializationJSMigration] ${message}`, ...args);
  }

  // ===========================================================================================
  // FORM INITIALIZATION JS MIGRATION TESTING
  // ===========================================================================================

  /**
   * Test Form Initialization JavaScript template migration
   * @returns {Object} Test results with success status and detailed results
   */
  async function testFormInitializationJSMigration() {
    logInfo("Starting Form Initialization JavaScript template migration tests");

    try {
      const tests = {
        // 1. Template file exists and is readable
        templateFileExists: async () => {
          try {
            const response = await fetch("templates/js/form-initialization.js");
            const content = await response.text();
            const exists = response.ok && content.length > 500;

            if (exists) {
              logDebug(
                "✅ Template file templates/js/form-initialization.js exists and has content"
              );
            } else {
              logError(
                "❌ Template file templates/js/form-initialization.js not found or empty"
              );
            }
            return exists;
          } catch (error) {
            logError("❌ Error checking template file existence:", error);
            return false;
          }
        },

        // 2. Template system has loader method
        templateSystemHasLoader: () => {
          if (!window.TemplateSystem) {
            logError("❌ TemplateSystem not available");
            return false;
          }

          const generator = window.TemplateSystem.createGenerator();
          const hasLoader =
            typeof generator.generateFormInitializationJS === "function";

          if (hasLoader) {
            logDebug(
              "✅ Form Initialization JavaScript template loader method available"
            );
          } else {
            logError(
              "❌ generateFormInitializationJS method not found in TemplateSystem"
            );
          }
          return hasLoader;
        },

        // 3. Template loads successfully and generates valid content
        templateGeneratesValidJS: async () => {
          try {
            const generator = window.TemplateSystem.createGenerator();
            const testParams = {
              defaultFontSize: "1.2",
              defaultFontSizePercent: "120%",
              defaultLineHeight: "1.8",
              enableValidation: true,
              enableAccessibility: true,
              enablePreferences: true,
            };

            const js = await generator.generateFormInitializationJS(testParams);

            // Check for expected components from external template
            const requiredComponents = [
              "initializeFormDefaults",
              "setupFormValidation",
              "setupAccessibilityFeatures",
              "setupUserPreferences",
              "initializeAllFormFeatures",
            ];

            const missingComponents = requiredComponents.filter(
              (component) => !js.includes(component)
            );

            const validGeneration =
              missingComponents.length === 0 &&
              !js.includes("⚠️ Using fallback") &&
              js.length > 1000;

            if (validGeneration) {
              logDebug(
                "✅ Generated JavaScript contains all expected form initialization components"
              );
              logDebug(`Generated content length: ${js.length} characters`);
            } else {
              if (missingComponents.length > 0) {
                logError(
                  `❌ Missing expected components: ${missingComponents.join(
                    ", "
                  )}`
                );
              }
              if (js.includes("⚠️ Using fallback")) {
                logError(
                  "❌ Still using fallback method instead of external template"
                );
              }
              if (js.length <= 1000) {
                logError(
                  `❌ Generated content too short: ${js.length} characters`
                );
              }
            }

            return validGeneration;
          } catch (error) {
            logError("❌ Error generating JavaScript from template:", error);
            return false;
          }
        },

        // 4. Generated JS is executable (syntax check)
        templateJSExecutable: async () => {
          try {
            const generator = window.TemplateSystem.createGenerator();
            const js = await generator.generateFormInitializationJS({
              enableValidation: true,
              enableAccessibility: true,
            });

            // Test that JavaScript is syntactically valid
            new Function(js);
            logDebug("✅ Generated JavaScript is syntactically valid");
            return true;
          } catch (error) {
            logError("❌ Generated JavaScript has syntax errors:", error);
            return false;
          }
        },

        // 5. Real exports use template (integration test)
        realExportUsesTemplate: async () => {
          try {
            const html =
              await window.ExportManager.generateEnhancedStandaloneHTML(
                "\\[E = mc^2\\]",
                "Form Initialization Test",
                2
              );

            const usesTemplate =
              html.includes("initializeFormDefaults") &&
              html.includes("setupFormValidation") &&
              !html.includes("⚠️ Using fallback");

            if (usesTemplate) {
              logDebug(
                "✅ Real exports successfully use Form Initialization template"
              );
              logDebug(`Export size: ${html.length} characters`);
            } else {
              logError(
                "❌ Real exports not using Form Initialization template"
              );
            }

            return usesTemplate;
          } catch (error) {
            logError("❌ Error testing real export integration:", error);
            return false;
          }
        },

        // 6. Performance is acceptable
        templatePerformance: async () => {
          try {
            const generator = window.TemplateSystem.createGenerator();

            const startTime = performance.now();
            const result = await generator.generateFormInitializationJS({
              defaultFontSize: "1.1",
              enableValidation: true,
              enableAccessibility: true,
              enablePreferences: true,
            });
            const endTime = performance.now();

            const processingTime = endTime - startTime;
            const hasValidOutput = result.length > 1000;
            const isReasonablyFast = processingTime < 50; // Should be much faster, but allow margin

            logDebug(
              `Performance test - Time: ${processingTime.toFixed(
                2
              )}ms, Output length: ${
                result.length
              }, Fast enough: ${isReasonablyFast}`
            );

            return isReasonablyFast && hasValidOutput;
          } catch (error) {
            logError("Performance test failed:", error);
            return false;
          }
        },
      };

      // ✅ CRITICAL: Use TestUtilities.runAsyncTestSuite (proven working pattern)
      return await TestUtilities.runAsyncTestSuite(
        "FormInitializationJSMigration",
        tests
      );
    } catch (error) {
      logError("Migration test failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check production readiness of Form Initialization JS migration
   * @returns {Object} Production readiness assessment
   */
  async function checkFormInitializationJSProductionReadiness() {
    logInfo(
      "🔍 Checking Form Initialization JS migration production readiness..."
    );

    try {
      // Step 1: Properly await the migration test results
      logDebug("Running migration tests...");
      const migrationResults = await testFormInitializationJSMigration();

      logDebug("Migration results received:", migrationResults);

      // Step 2: Extract the actual results
      const migrationTestsPassing =
        migrationResults && migrationResults.success === true;
      const passedTests = migrationResults
        ? migrationResults.passedTests || 0
        : 0;
      const totalTests = migrationResults
        ? migrationResults.totalTests || 0
        : 0;

      // Step 3: Additional system checks
      const systemChecks = {
        templateSystemAvailable: typeof window.TemplateSystem !== "undefined",
        exportManagerAvailable: typeof window.ExportManager !== "undefined",
        generatorHasMethod: false,
        canLoadTemplate: false,
      };

      if (systemChecks.templateSystemAvailable) {
        const generator = window.TemplateSystem.createGenerator();
        systemChecks.generatorHasMethod =
          typeof generator.generateFormInitializationJS === "function";

        if (systemChecks.generatorHasMethod) {
          try {
            await generator.generateFormInitializationJS({
              enableValidation: false,
            });
            systemChecks.canLoadTemplate = true;
          } catch (error) {
            logDebug("Template loading test failed:", error.message);
          }
        }
      }

      // Step 4: Calculate readiness score
      const systemScore = Object.values(systemChecks).filter(Boolean).length;
      const migrationScore = migrationTestsPassing ? 6 : passedTests;
      const totalPossibleScore = 4 + 6; // 4 system checks + 6 migration tests
      const readinessPercentage =
        ((systemScore + migrationScore) / totalPossibleScore) * 100;

      const isReady = migrationTestsPassing && systemScore >= 3;

      const result = {
        isReady: isReady,
        readinessPercentage: Math.round(readinessPercentage),
        migrationTests: {
          passing: migrationTestsPassing,
          score: `${passedTests}/${totalTests}`,
          results: migrationResults,
        },
        systemChecks: systemChecks,
        systemScore: `${systemScore}/4`,
        overallScore: `${systemScore + migrationScore}/${totalPossibleScore}`,
        recommendation: isReady
          ? "✅ READY FOR PRODUCTION - All tests passing"
          : "❌ NOT READY - Fix failing tests before deployment",
      };

      // Step 5: Log detailed results
      console.log("\n🎯 FORM INITIALIZATION JS MIGRATION PRODUCTION READINESS");
      console.log("==================================================");
      console.log(`Overall Status: ${result.recommendation}`);
      console.log(
        `Readiness Score: ${result.overallScore} (${result.readinessPercentage}%)`
      );
      console.log(
        `Migration Tests: ${result.migrationTests.score} ${
          migrationTestsPassing ? "✅" : "❌"
        }`
      );
      console.log(
        `System Checks: ${result.systemScore} ${systemScore >= 3 ? "✅" : "❌"}`
      );
      console.log("==================================================");

      return result;
    } catch (error) {
      logError("Production readiness check failed:", error);
      return {
        isReady: false,
        error: error.message,
        recommendation:
          "❌ ERROR - Cannot assess readiness due to system error",
      };
    }
  }

  return {
    testFormInitializationJSMigration,
    checkFormInitializationJSProductionReadiness,
  };
})();

// Export to global scope
window.TestFormInitializationJSMigration = TestFormInitializationJSMigration;
window.testFormInitializationJSMigration =
  TestFormInitializationJSMigration.testFormInitializationJSMigration;
window.checkFormInitializationJSProductionReadiness =
  TestFormInitializationJSMigration.checkFormInitializationJSProductionReadiness;

console.log(
  "✅ TestFormInitializationJSMigration loaded - Form Initialization JavaScript template migration testing ready!"
);
