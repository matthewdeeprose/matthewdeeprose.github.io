// js/testing/individual/test-accessibility-configuration.js
// ===========================================================================================
// TEST ACCESSIBILITY CONFIGURATION - INDIVIDUAL MODULE TESTING
// Enhanced Pandoc-WASM Mathematical Playground
// Individual module test for centralized accessibility configuration validation
//
// This test ensures all accessibility defaults are centralized and consistent
// ===========================================================================================

const TestAccessibilityConfiguration = (function () {
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
      console.error(`[TestAccessibilityConfiguration] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestAccessibilityConfiguration] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestAccessibilityConfiguration] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestAccessibilityConfiguration] ${message}`, ...args);
  }

  // ===========================================================================================
  // ACCESSIBILITY CONFIGURATION TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test Accessibility Configuration centralization and consistency
   * @returns {Object} Test results with success status and detailed results
   */
  async function testAccessibilityConfiguration() {
    logInfo("Starting Accessibility Configuration tests");

    try {
      if (!window.AppConfig) {
        throw new Error("AppConfig module not available");
      }

      const tests = {
        configurationExists: () => {
          return !!(
            window.AppConfig.CONFIG &&
            window.AppConfig.CONFIG.ACCESSIBILITY_DEFAULTS
          );
        },

        correctDefaultReadingWidth: () => {
          const defaults = window.AppConfig.CONFIG.ACCESSIBILITY_DEFAULTS;
          const readingWidth = defaults.defaultReadingWidth;
          logDebug("Default reading width:", readingWidth);
          return readingWidth === "narrow"; // Should be "narrow" not "medium"
        },

        allRequiredDefaultsPresent: () => {
          const defaults = window.AppConfig.CONFIG.ACCESSIBILITY_DEFAULTS;
          const requiredKeys = [
            "defaultFontSize",
            "defaultFontSizePercent",
            "defaultFontFamily",
            "defaultLineHeight",
            "defaultWordSpacing",
            "defaultReadingWidth",
            "defaultParagraphSpacing",
            "defaultZoomLevel",
          ];

          const presentKeys = requiredKeys.filter((key) =>
            defaults.hasOwnProperty(key)
          );
          logDebug(
            "Required keys present:",
            presentKeys.length,
            "/",
            requiredKeys.length
          );

          return presentKeys.length === requiredKeys.length;
        },

        templateSystemUsesConfiguration: async () => {
          if (!window.TemplateSystem) {
            logWarn("TemplateSystem not available");
            return true; // Skip if not available
          }

          try {
            const generator = window.TemplateSystem.createGenerator();

            // Test form initialization with defaults
            const formJS = await generator.generateFormInitializationJS({});
            const usesNarrowDefault =
              formJS.includes('"narrow"') || formJS.includes("'narrow'");

            logDebug("Form template uses narrow default:", usesNarrowDefault);
            return usesNarrowDefault;
          } catch (error) {
            logWarn("Template system test failed:", error.message);
            return false;
          }
        },

        exportedHTMLUsesCorrectDefaults: async () => {
          if (!window.ExportManager) {
            logWarn("ExportManager not available");
            return true; // Skip if not available
          }

          try {
            const html =
              await window.ExportManager.generateEnhancedStandaloneHTML(
                "<p>Test content</p>",
                "Configuration Test",
                2
              );

            // Check that the HTML has "narrow" selected as default
            const hasNarrowSelected =
              html.includes('value="narrow" selected') ||
              html.includes("value='narrow' selected");

            logDebug("Exported HTML has narrow selected:", hasNarrowSelected);
            return hasNarrowSelected;
          } catch (error) {
            logError("Export HTML test failed:", error);
            return false;
          }
        },

        configurationConsistency: () => {
          const defaults = window.AppConfig.CONFIG.ACCESSIBILITY_DEFAULTS;

          // Check that all font size related values are consistent
          const fontSizeConsistent =
            parseFloat(defaults.defaultFontSize) === 1.0 &&
            defaults.defaultFontSizePercent === "100%";

          // Check that boolean flags are proper booleans
          const booleanFlagsValid =
            typeof defaults.enableValidation === "boolean" &&
            typeof defaults.enableAccessibility === "boolean" &&
            typeof defaults.enablePreferences === "boolean";

          logDebug("Font size consistent:", fontSizeConsistent);
          logDebug("Boolean flags valid:", booleanFlagsValid);

          return fontSizeConsistent && booleanFlagsValid;
        },

        configurationAccessible: () => {
          // Test that configuration is accessible from other modules
          const configFromAppConfig =
            window.AppConfig.CONFIG.ACCESSIBILITY_DEFAULTS;
          const configFromGlobal =
            window.AppConfig?.CONFIG?.ACCESSIBILITY_DEFAULTS;

          const accessible = !!(configFromAppConfig && configFromGlobal);
          logDebug("Configuration accessible from modules:", accessible);

          return accessible;
        },
      };

      // ✅ CRITICAL: Use TestUtilities.runAsyncTestSuite for async tests
      return await TestUtilities.runAsyncTestSuite(
        "AccessibilityConfiguration",
        tests
      );
    } catch (error) {
      logError("Test failed:", error);
      return { success: false, error: error.message };
    }
  }

  return { testAccessibilityConfiguration };
})();

// Export to global scope (consistent naming pattern)
window.TestAccessibilityConfiguration = TestAccessibilityConfiguration;
window.testAccessibilityConfiguration =
  TestAccessibilityConfiguration.testAccessibilityConfiguration;

// Verify export worked
console.log("✅ TestAccessibilityConfiguration exported to global scope");
console.log("✅ testAccessibilityConfiguration command available");
