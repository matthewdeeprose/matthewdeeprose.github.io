// js/testing/individual/test-mathjax-manager.js
// Standard MathJax Manager Testing Module

const TestMathJaxManager = (function () {
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
      console.error("[TEST-MATHJAX-MANAGER]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[TEST-MATHJAX-MANAGER]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[TEST-MATHJAX-MANAGER]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[TEST-MATHJAX-MANAGER]", message, ...args);
  }

  // ===========================================================================================
  // MATHJAX MANAGER TESTING
  // ===========================================================================================

  function testMathJaxManager() {
    const tests = {
      moduleExists: () => {
        return typeof window.MathJaxManager !== "undefined";
      },

      dynamicManagerExists: () => {
        return (
          window.MathJaxManager &&
          typeof window.MathJaxManager.DynamicMathJaxManager !== "undefined"
        );
      },

      mathJaxAvailable: () => {
        return typeof window.MathJax !== "undefined";
      },

      accessibilityModulesLoaded: () => {
        if (!window.MathJax || !window.MathJax._) return false;
        const a11yModules = Object.keys(window.MathJax._.a11y || {});
        return a11yModules.length >= 1; // At least assistive-mml should be loaded
      },

      managerInitialisation: () => {
        try {
          if (
            window.MathJaxManager &&
            window.MathJaxManager.DynamicMathJaxManager
          ) {
            const manager = new window.MathJaxManager.DynamicMathJaxManager();
            return !!manager.currentSettings;
          }
          return false;
        } catch (error) {
          logError("Manager initialisation failed:", error);
          return false;
        }
      },

      settingsConfiguration: () => {
        try {
          if (
            window.MathJaxManager &&
            window.MathJaxManager.DynamicMathJaxManager
          ) {
            const manager = new window.MathJaxManager.DynamicMathJaxManager();
            const settings = manager.getCurrentSettings();
            return !!settings && typeof settings === "object";
          }
          return false;
        } catch (error) {
          logError("Settings configuration test failed:", error);
          return false;
        }
      },

      mathJaxConfigurationGeneration: () => {
        // Test if MathJax configuration can be generated
        if (
          window.LaTeXProcessor &&
          typeof window.LaTeXProcessor.generateMathJaxConfig === "function"
        ) {
          try {
            const config = window.LaTeXProcessor.generateMathJaxConfig();
            return typeof config === "string" && config.length > 0;
          } catch (error) {
            logError("MathJax config generation failed:", error);
            return false;
          }
        }
        return false;
      },

      accessibilitySupport: () => {
        // Check if accessibility features are working
        const containers = document.querySelectorAll("mjx-container");
        if (containers.length === 0) return true; // No math to test

        let accessibleCount = 0;
        containers.forEach((container) => {
          if (
            container.getAttribute("aria-label") ||
            container.querySelector("mjx-assistive-mml")
          ) {
            accessibleCount++;
          }
        });

        return accessibleCount > 0; // At least some containers should be accessible
      },
    };

    return TestUtilities.runTestSuite("MathJax Manager", tests);
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    testMathJaxManager,
  };
})();

// Global function for easy access
window.testMathJaxManager = TestMathJaxManager.testMathJaxManager;
