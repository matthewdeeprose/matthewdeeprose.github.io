// js/testing/migration/test-enhanced-javascript-orchestrator-optimization.js
// ===========================================================================================
// TEST ENHANCED JAVASCRIPT ORCHESTRATOR OPTIMIZATION - MIGRATION TESTING
// Enhanced Pandoc-WASM Mathematical Playground
// Phase 2A Step 7 - Eliminate hardcoded blocks from generateEnhancedJavaScript()
//
// This test validates that all JavaScript generation is handled through external templates
// and no hardcoded blocks remain in the main orchestrator function
// ===========================================================================================

const TestEnhancedJavaScriptOrchestratorOptimization = (function () {
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
      console.error(
        `[TestEnhancedJSOrchestratorOptimization] ${message}`,
        ...args
      );
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(
        `[TestEnhancedJSOrchestratorOptimization] ${message}`,
        ...args
      );
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(
        `[TestEnhancedJSOrchestratorOptimization] ${message}`,
        ...args
      );
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(
        `[TestEnhancedJSOrchestratorOptimization] ${message}`,
        ...args
      );
  }

  // ===========================================================================================
  // ENHANCED JAVASCRIPT ORCHESTRATOR OPTIMIZATION TESTING IMPLEMENTATION
  // ===========================================================================================

  /**
   * Test Enhanced JavaScript Orchestrator Optimization functionality
   * @returns {Object} Test results with success status and detailed results
   */
  async function testEnhancedJavaScriptOrchestratorOptimization() {
    logInfo("Starting Enhanced JavaScript Orchestrator Optimization tests");

    try {
      if (!window.ExportManager) {
        throw new Error("ExportManager module not available");
      }

      const tests = {
        orchestratorExists: () => {
          return (
            typeof window.ExportManager.generateEnhancedJavaScript ===
            "function"
          );
        },

        mathJaxInitializationNotDuplicated: async () => {
          // Check that hardcoded MathJax initialization is not present
          const functionSource =
            window.ExportManager.generateEnhancedJavaScript.toString();
          const hasDuplicateInit =
            functionSource.includes("Initialize MathJax Controls") &&
            functionSource.includes(
              "window.mathJaxControlsManager = new MathJaxControlsManager"
            );

          logDebug(
            "Function source includes hardcoded MathJax init:",
            hasDuplicateInit
          );
          return !hasDuplicateInit; // Should NOT have hardcoded initialization
        },

        focusTrackingCommandsInTemplate: async () => {
          // Test that focus tracking template includes console commands
          if (!window.TemplateSystem) {
            logWarn("TemplateSystem not available for focus tracking test");
            return true; // Skip test if template system not available
          }

          try {
            const generator = window.TemplateSystem.createGenerator();
            const focusJS = await generator.generateFocusTrackingJS({
              commandsDelayMs: 100,
              enableConsoleCommands: true,
            });

            const hasCommands =
              focusJS.includes("Focus tracking commands available") &&
              focusJS.includes("trackFocus()") &&
              focusJS.includes("stopFocusTracking()") &&
              focusJS.includes("getCurrentFocus()");

            logDebug("Focus template includes console commands:", hasCommands);
            return hasCommands;
          } catch (error) {
            logWarn("Focus tracking template test failed:", error.message);
            return false;
          }
        },

        orchestratorSimplified: async () => {
          // Check that orchestrator doesn't have hardcoded blocks
          const functionSource =
            window.ExportManager.generateEnhancedJavaScript.toString();

          // Check for absence of hardcoded initialization patterns
          const hasHardcodedMathJax =
            functionSource.includes("// Initialize MathJax Controls") &&
            functionSource.includes("window.MathJax.startup.promise");

          const hasHardcodedFocus =
            functionSource.includes("// Initialize Focus Tracking Commands") &&
            functionSource.includes("setTimeout(() => {") &&
            functionSource.includes(
              "console.log('🎯 Focus tracking commands available:');"
            );

          logDebug("Has hardcoded MathJax block:", hasHardcodedMathJax);
          logDebug("Has hardcoded Focus block:", hasHardcodedFocus);

          // Should NOT have hardcoded blocks
          return !hasHardcodedMathJax && !hasHardcodedFocus;
        },

        exportsFunctional: async () => {
          // Test that exports still work after optimization
          try {
            const testContent = "<p>Test with math: $E = mc^2$</p>";
            const html =
              await window.ExportManager.generateEnhancedStandaloneHTML(
                testContent,
                "Optimization Test",
                2
              );

            // Validate essential components are present
            const hasMathJax =
              html.includes("MathJaxControlsManager") ||
              html.includes("mathjax-controls") ||
              html.includes("MathJax");

            const hasFocusTracking =
              html.includes("trackFocus") ||
              html.includes("FocusTracker") ||
              html.includes("focus-tracking");

            const hasMinimumSize = html.length > 50000; // Should be substantial

            logDebug("Export has MathJax functionality:", hasMathJax);
            logDebug("Export has focus tracking:", hasFocusTracking);
            logDebug("Export has minimum size:", hasMinimumSize, html.length);

            return hasMathJax && hasFocusTracking && hasMinimumSize;
          } catch (error) {
            logError("Export functionality test failed:", error);
            return false;
          }
        },

        templateSystemIntegration: async () => {
          // Verify all template functions are being called
          if (!window.TemplateSystem) {
            logWarn("TemplateSystem not available for integration test");
            return true;
          }

          try {
            const generator = window.TemplateSystem.createGenerator();

            // Test key template generation functions
            const initJS = await generator.generateInitializationJS();
            const mathJaxJS = await generator.generateMathJaxControlsJS(2);
            const focusJS = await generator.generateFocusTrackingJS();

            const allValid =
              initJS.length > 100 &&
              mathJaxJS.length > 1000 &&
              focusJS.length > 1000;

            logDebug("Template generation results:");
            logDebug("  - InitJS length:", initJS.length);
            logDebug("  - MathJaxJS length:", mathJaxJS.length);
            logDebug("  - FocusJS length:", focusJS.length);

            return allValid;
          } catch (error) {
            logError("Template system integration test failed:", error);
            return false;
          }
        },
      };

      // ✅ CRITICAL: Use TestUtilities.runAsyncTestSuite for async tests
      return await TestUtilities.runAsyncTestSuite(
        "EnhancedJavaScriptOrchestratorOptimization",
        tests
      );
    } catch (error) {
      logError("Test failed:", error);
      return { success: false, error: error.message };
    }
  }

  return { testEnhancedJavaScriptOrchestratorOptimization };
})();

// Export to global scope
window.TestEnhancedJavaScriptOrchestratorOptimization =
  TestEnhancedJavaScriptOrchestratorOptimization;
window.testEnhancedJavaScriptOrchestratorOptimization =
  TestEnhancedJavaScriptOrchestratorOptimization.testEnhancedJavaScriptOrchestratorOptimization;
