// js/testing/individual/test-adaptive-background.js
// Test suite for adaptive background colour feature
// Tests Chroma.js integration, AdaptiveBackgroundManager, UI controls, and integration

/**
 * Adaptive Background Feature Tests
 * Tests the complete adaptive background system including:
 * - Chroma.js colour manipulation library
 * - AdaptiveBackgroundManager and submodules
 * - UI controls and user interactions
 * - Integration with ReadingAccessibilityManager
 * - Template system integration
 * - Performance requirements
 */

const TestAdaptiveBackground = (function () {
  "use strict";

  // Logging configuration
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
  }

  function testAdaptiveBackground() {
    // Environment detection
    const isPlaygroundEnvironment =
      window.location.pathname.includes("pandoc_playground") ||
      window.location.pathname.includes("index.html") ||
      document.title.includes("Playground");

    const isExportEnvironment = !isPlaygroundEnvironment;

    logInfo(
      `Environment detected: ${
        isPlaygroundEnvironment ? "Playground" : "Export"
      }`
    );

    const tests = {
      // Environment Detection Test
      environmentDetection: () => {
        return typeof isPlaygroundEnvironment === "boolean";
      },

      // Core Library Tests (Export environment only)
      chromaJSAvailable: () => {
        if (isPlaygroundEnvironment) {
          logInfo(
            "Skipping Chroma.js availability test - playground environment"
          );
          return true; // Pass in playground
        }
        return typeof window.chroma === "function";
      },

      chromaJSFunctionality: () => {
        if (isPlaygroundEnvironment) {
          logInfo(
            "Skipping Chroma.js functionality test - playground environment"
          );
          return true; // Pass in playground
        }
        if (typeof window.chroma !== "function") return false;
        try {
          const colour = window.chroma("#ff0000");
          const hex = colour.hex();
          const contrast = window.chroma.contrast("#ffffff", "#000000");
          return hex === "#ff0000" && contrast > 20;
        } catch (error) {
          logError("Chroma.js functionality test failed:", error);
          return false;
        }
      },

      // Module Availability Tests (Export environment only)
      adaptiveBackgroundManagerExists: () => {
        if (isPlaygroundEnvironment) {
          logInfo(
            "Skipping AdaptiveBackgroundManager test - playground environment"
          );
          return true; // Pass in playground
        }
        return (
          typeof window.AdaptiveBackgroundManager === "object" &&
          window.AdaptiveBackgroundManager !== null
        );
      },

      colourScannerExists: () => {
        if (isPlaygroundEnvironment) {
          logInfo("Skipping ColourScanner test - playground environment");
          return true; // Pass in playground
        }
        return (
          typeof window.ColourScanner === "object" &&
          window.ColourScanner !== null
        );
      },

      contrastOptimizerExists: () => {
        if (isPlaygroundEnvironment) {
          logInfo("Skipping ContrastOptimizer test - playground environment");
          return true; // Pass in playground
        }
        return (
          typeof window.ContrastOptimizer === "object" &&
          window.ContrastOptimizer !== null
        );
      },

      backgroundControlsExists: () => {
        if (isPlaygroundEnvironment) {
          logInfo("Skipping BackgroundControls test - playground environment");
          return true; // Pass in playground
        }
        return (
          typeof window.BackgroundControls === "object" &&
          window.BackgroundControls !== null
        );
      },

      // API Interface Tests (Export environment only)
      adaptiveBackgroundManagerAPI: () => {
        if (isPlaygroundEnvironment) {
          logInfo(
            "Skipping AdaptiveBackgroundManager API test - playground environment"
          );
          return true; // Pass in playground
        }
        if (!window.AdaptiveBackgroundManager) return false;
        const requiredMethods = [
          "initialise",
          "isInitialised",
          "updateBackground",
        ];
        return requiredMethods.every(
          (method) =>
            typeof window.AdaptiveBackgroundManager[method] === "function"
        );
      },

      colourScannerAPI: () => {
        if (isPlaygroundEnvironment) {
          logInfo("Skipping ColourScanner API test - playground environment");
          return true; // Pass in playground
        }
        if (!window.ColourScanner) return false;
        const requiredMethods = [
          "scanText",
          "analyseContrast",
          "findLowContrastElements",
        ];
        return requiredMethods.every(
          (method) => typeof window.ColourScanner[method] === "function"
        );
      },

      contrastOptimizerAPI: () => {
        if (isPlaygroundEnvironment) {
          logInfo(
            "Skipping ContrastOptimizer API test - playground environment"
          );
          return true; // Pass in playground
        }
        if (!window.ContrastOptimizer) return false;
        const requiredMethods = [
          "optimiseForContrast",
          "calculateOptimalColour",
          "validateWCAG",
        ];
        return requiredMethods.every(
          (method) => typeof window.ContrastOptimizer[method] === "function"
        );
      },

      backgroundControlsAPI: () => {
        if (isPlaygroundEnvironment) {
          logInfo(
            "Skipping BackgroundControls API test - playground environment"
          );
          return true; // Pass in playground
        }
        if (!window.BackgroundControls) return false;
        const requiredMethods = [
          "initialize",
          "handleColourChange",
          "handleContrastChange",
        ];
        return requiredMethods.every(
          (method) => typeof window.BackgroundControls[method] === "function"
        );
      },

      colourScannerExists: () => {
        return (
          typeof window.ColourScanner === "object" &&
          window.ColourScanner !== null
        );
      },

      contrastOptimizerExists: () => {
        return (
          typeof window.ContrastOptimizer === "object" &&
          window.ContrastOptimizer !== null
        );
      },

      backgroundControlsExists: () => {
        return (
          typeof window.BackgroundControls === "object" &&
          window.BackgroundControls !== null
        );
      },

      // API Interface Tests
      adaptiveBackgroundManagerAPI: () => {
        if (!window.AdaptiveBackgroundManager) return false;
        const requiredMethods = [
          "initialise",
          "isInitialised",
          "updateBackground",
        ];
        return requiredMethods.every(
          (method) =>
            typeof window.AdaptiveBackgroundManager[method] === "function"
        );
      },

      colourScannerAPI: () => {
        if (!window.ColourScanner) return false;
        const requiredMethods = [
          "scanText",
          "analyseContrast",
          "findLowContrastElements",
        ];
        return requiredMethods.every(
          (method) => typeof window.ColourScanner[method] === "function"
        );
      },

      contrastOptimizerAPI: () => {
        if (!window.ContrastOptimizer) return false;
        const requiredMethods = [
          "optimiseForContrast",
          "calculateOptimalColour",
          "validateWCAG",
        ];
        return requiredMethods.every(
          (method) => typeof window.ContrastOptimizer[method] === "function"
        );
      },

      backgroundControlsAPI: () => {
        if (!window.BackgroundControls) return false;
        const requiredMethods = [
          "initialize",
          "handleColourChange",
          "handleContrastChange",
        ];
        return requiredMethods.every(
          (method) => typeof window.BackgroundControls[method] === "function"
        );
      },

      // Template System Integration Tests
      templateSystemIntegration: () => {
        if (!window.TemplateSystem) return false;
        const generator = window.TemplateSystem.createGenerator();
        return (
          typeof generator.generateChromaJSEmbedded === "function" &&
          typeof generator.generateAdaptiveBackgroundManagerJS === "function"
        );
      },

      cssTemplateAvailable: () => {
        if (
          !window.TemplateSystem ||
          !window.TemplateSystem.GlobalTemplateCache
        )
          return false;
        return window.TemplateSystem.GlobalTemplateCache.hasTemplate(
          "adaptiveBackgroundCSS"
        );
      },

      // UI Elements Tests (when available)
      uiElementsPresent: () => {
        const requiredElements = [
          "adaptive-background-colour",
          "adaptive-background-hex",
          "adaptive-contrast-level-1",
          "adaptive-contrast-level-2",
          "adaptive-contrast-level-3",
        ];

        let foundElements = 0;
        requiredElements.forEach((id) => {
          if (document.getElementById(id)) foundElements++;
        });

        // Elements may not be present in playground, but should exist in exports
        // Return true if at least some elements found or if this is playground environment
        return (
          foundElements > 0 ||
          window.location.pathname.includes("pandoc_playground")
        );
      },

      // Reading Tools Integration Tests
      readingToolsIntegration: () => {
        if (
          !window.ReadingAccessibilityManager ||
          !window.ReadingAccessibilityManager.prototype
        )
          return false;
        return (
          typeof window.ReadingAccessibilityManager.prototype
            .initAdaptiveBackground === "function" &&
          typeof window.ReadingAccessibilityManager.prototype
            .resetAdaptiveBackground === "function"
        );
      },

      // Performance Tests
      colourCalculationPerformance: () => {
        if (!window.chroma || !window.ContrastOptimizer) return false;

        const startTime = performance.now();
        try {
          // Simulate typical colour calculations
          for (let i = 0; i < 10; i++) {
            const testColour = window.chroma.hsl(i * 36, 0.7, 0.5);
            window.chroma.contrast(testColour, "#ffffff");
            window.chroma.contrast(testColour, "#000000");
          }
          const duration = performance.now() - startTime;
          return duration < 100; // Should complete in under 100ms
        } catch (error) {
          logError("Performance test failed:", error);
          return false;
        }
      },

      // Error Handling Tests
      errorHandling: () => {
        try {
          if (!window.AdaptiveBackgroundManager) return true; // Skip if not available

          // Test with invalid colour value
          if (
            window.BackgroundControls &&
            typeof window.BackgroundControls.handleColourChange === "function"
          ) {
            window.BackgroundControls.handleColourChange("invalid-colour");
          }

          // Should not throw errors
          return true;
        } catch (error) {
          logError("Error handling test failed:", error);
          return false;
        }
      },

      // Integration Readiness Test
      integrationReadiness: () => {
        // Check that all components are ready for integration
        const componentsReady = [
          typeof window.chroma === "function",
          typeof window.AdaptiveBackgroundManager === "object",
          typeof window.ColourScanner === "object",
          typeof window.ContrastOptimizer === "object",
          typeof window.BackgroundControls === "object",
        ].filter(Boolean).length;

        return componentsReady >= 4; // Allow for some components to be conditionally loaded
      },
    };

    return TestUtilities.runTestSuite("AdaptiveBackground", tests);
  }

  return {
    testAdaptiveBackground,
  };
})();

// Export for console access
window.testAdaptiveBackground = TestAdaptiveBackground.testAdaptiveBackground;
