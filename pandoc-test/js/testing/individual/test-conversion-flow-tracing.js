// test-conversion-flow-tracing.js
// Conversion Flow Tracing Test Module
// Enhanced Pandoc-WASM Mathematical Playground

const TestConversionFlowTracing = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION
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

  // ===========================================================================================
  // TRACING SCENARIO FUNCTIONS
  // ===========================================================================================

  /**
   * Execute the four standard tracing scenarios from the protocol
   * @returns {Promise<Object>} - Complete tracing results for all scenarios
   */
  async function executeTracingProtocol() {
    if (!window.LoggingSystem) {
      logError("LoggingSystem not available - cannot execute tracing protocol");
      return { success: false, error: "LoggingSystem not available" };
    }

    if (!window.ConversionEngine) {
      logError(
        "ConversionEngine not available - cannot execute tracing protocol"
      );
      return { success: false, error: "ConversionEngine not available" };
    }

    const results = {
      scenarioResults: {},
      overallAnalysis: {},
      success: false,
    };

    try {
      // Scenario A: Simple Equation Conversion
      results.scenarioResults.simple = await executeSimpleEquationScenario();
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait between scenarios

      // Scenario B: Complex Document Processing
      results.scenarioResults.complex = await executeComplexDocumentScenario();
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Scenario C: Error Recovery Scenario
      results.scenarioResults.error = await executeErrorRecoveryScenario();
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Scenario D: Performance Optimization Scenario
      results.scenarioResults.performance = await executePerformanceScenario();

      // Generate overall analysis
      results.overallAnalysis = generateOverallAnalysis(
        results.scenarioResults
      );
      results.success = true;

      logInfo("=== CONVERSION FLOW TRACING PROTOCOL COMPLETED ===");
      console.log("Complete results:", results);

      return results;
    } catch (error) {
      logError("Tracing protocol execution failed:", error);
      results.error = error.message;
      return results;
    }
  }

  /**
   * Scenario A: Simple Equation Conversion
   */
  async function executeSimpleEquationScenario() {
    logInfo("=== SCENARIO A: SIMPLE EQUATION START ===");

    const sessionId = window.LoggingSystem.traceSimpleEquation();
    const input = "$x = 1$";

    logInfo("Input:", input);
    logInfo("Expected modules: CONVERSION, STATE_MGR, basic processing chain");

    const scenarioStart = performance.now();

    try {
      // Set input and trigger conversion
      if (window.ConversionEngine.setInputContent) {
        window.ConversionEngine.setInputContent(input);
      }

      // Wait for conversion to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      logError("Simple equation conversion failed:", error);
    }

    const scenarioEnd = performance.now();
    const duration = scenarioEnd - scenarioStart;

    const results = window.LoggingSystem.disableConversionTracing();

    logInfo("=== SCENARIO A: SIMPLE EQUATION END ===");
    logInfo(`Duration: ${duration.toFixed(2)}ms`);

    return { ...results, actualDuration: duration };
  }

  /**
   * Scenario B: Complex Document Processing
   */
  async function executeComplexDocumentScenario() {
    logInfo("=== SCENARIO B: COMPLEX DOCUMENT START ===");

    const sessionId = window.LoggingSystem.traceComplexDocument();
    const input = `
  \\documentclass{article}
  \\usepackage{amsmath}
  \\begin{document}
  \\section{Complex Mathematics}
  \\begin{align}
  f(x) &= \\sum_{n=0}^{\\infty} \\frac{x^n}{n!} \\\\
  g(x) &= \\int_0^x e^{t^2} dt \\\\
  \\end{align}
  
  \\begin{matrix}
  1 & 2 & 3 \\\\
  4 & 5 & 6 \\\\
  7 & 8 & 9
  \\end{matrix}
  
  \\begin{equation}
  \\lim_{x \\to \\infty} \\frac{\\sin x}{x} = 0
  \\end{equation}
  \\end{document}`;

    logInfo("Input: Complex document with equations, matrices, environments");
    logInfo(
      "Expected modules: Complexity assessment, chunked processing, memory coordination"
    );

    const scenarioStart = performance.now();

    try {
      if (window.ConversionEngine.setInputContent) {
        window.ConversionEngine.setInputContent(input);
      }

      await new Promise((resolve) => setTimeout(resolve, 2000)); // Longer wait for complex processing
    } catch (error) {
      logError("Complex document conversion failed:", error);
    }

    const scenarioEnd = performance.now();
    const duration = scenarioEnd - scenarioStart;

    const results = window.LoggingSystem.disableConversionTracing();

    logInfo("=== SCENARIO B: COMPLEX DOCUMENT END ===");
    logInfo(`Duration: ${duration.toFixed(2)}ms`);

    return { ...results, actualDuration: duration };
  }

  /**
   * Scenario C: Error Recovery Scenario
   */
  async function executeErrorRecoveryScenario() {
    logInfo("=== SCENARIO C: ERROR RECOVERY START ===");

    const sessionId = window.LoggingSystem.traceErrorRecovery();
    const input = `
  \\begin{broken_environment}
  $\\invalid{command} 
  \\unclosed{bracket
  \\missing\\command{
  \\end{wrong_environment}`;

    logInfo("Input: Malformed LaTeX designed to trigger errors");
    logInfo(
      "Expected modules: Error detection, fallback coordinator, recovery strategies"
    );

    const scenarioStart = performance.now();

    try {
      if (window.ConversionEngine.setInputContent) {
        window.ConversionEngine.setInputContent(input);
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (error) {
      logInfo("Expected error during error recovery scenario:", error);
    }

    const scenarioEnd = performance.now();
    const duration = scenarioEnd - scenarioStart;

    const results = window.LoggingSystem.disableConversionTracing();

    logInfo("=== SCENARIO C: ERROR RECOVERY END ===");
    logInfo(`Duration: ${duration.toFixed(2)}ms`);

    return { ...results, actualDuration: duration };
  }

  /**
   * Scenario D: Performance Optimization Scenario
   */
  async function executePerformanceScenario() {
    logInfo("=== SCENARIO D: PERFORMANCE OPTIMIZATION START ===");

    const sessionId = window.LoggingSystem.tracePerformanceOptimization();

    logInfo("Input: Rapid successive conversions with state changes");
    logInfo(
      "Expected modules: State caching, optimization triggers, performance monitoring"
    );

    const scenarioStart = performance.now();

    try {
      // Execute rapid successive conversions
      const testInputs = [
        "$x = 1$",
        "$y = x^2 + 1$",
        "$\\frac{dy}{dx} = 2x$",
        "$\\int x dx = \\frac{x^2}{2} + C$",
        "$\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$",
      ];

      for (const input of testInputs) {
        if (window.ConversionEngine.setInputContent) {
          window.ConversionEngine.setInputContent(input);
        }
        await new Promise((resolve) => setTimeout(resolve, 200)); // Quick succession
      }
    } catch (error) {
      logError("Performance scenario failed:", error);
    }

    const scenarioEnd = performance.now();
    const duration = scenarioEnd - scenarioStart;

    const results = window.LoggingSystem.disableConversionTracing();

    logInfo("=== SCENARIO D: PERFORMANCE OPTIMIZATION END ===");
    logInfo(`Duration: ${duration.toFixed(2)}ms`);

    return { ...results, actualDuration: duration };
  }

  /**
   * Generate overall analysis from all scenarios
   */
  function generateOverallAnalysis(scenarioResults) {
    const allModuleCounts = {};
    let totalEvents = 0;
    let totalDecisionPoints = 0;

    // Aggregate data from all scenarios
    Object.values(scenarioResults).forEach((scenario) => {
      if (scenario.moduleCallCounts) {
        Object.entries(scenario.moduleCallCounts).forEach(([module, count]) => {
          allModuleCounts[module] = (allModuleCounts[module] || 0) + count;
        });
      }
      totalEvents += scenario.summary?.totalEvents || 0;
      totalDecisionPoints += scenario.summary?.decisionPointCount || 0;
    });

    // Generate top modules list
    const topModules = Object.entries(allModuleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      topModules,
      totalEvents,
      totalDecisionPoints,
      scenarioCount: Object.keys(scenarioResults).length,
      recommendations: generateRecommendations(scenarioResults, topModules),
    };
  }

  /**
   * Generate architectural recommendations based on tracing results
   */
  function generateRecommendations(scenarioResults, topModules) {
    const recommendations = [];

    // Identify most active modules
    if (topModules.length > 0) {
      recommendations.push(
        `Most active module: ${topModules[0][0]} (${topModules[0][1]} calls total)`
      );
    }

    // Check for potential bottlenecks
    const slowScenarios = Object.entries(scenarioResults)
      .filter(([name, data]) => data.actualDuration > 1000)
      .map(([name]) => name);

    if (slowScenarios.length > 0) {
      recommendations.push(
        `Potential performance bottlenecks in scenarios: ${slowScenarios.join(
          ", "
        )}`
      );
    }

    // Check error handling effectiveness
    const errorScenario = scenarioResults.error;
    if (errorScenario?.summary?.errorEventCount > 0) {
      recommendations.push(
        `Error handling system activated ${errorScenario.summary.errorEventCount} times`
      );
    }

    return recommendations;
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    executeTracingProtocol,
    executeSimpleEquationScenario,
    executeComplexDocumentScenario,
    executeErrorRecoveryScenario,
    executePerformanceScenario,

    // Quick testing function
    testConversionFlowTracing: () => {
      const tests = {
        loggingSystemExists: () => !!window.LoggingSystem,
        tracingMethodsAvailable: () => {
          return (
            window.LoggingSystem &&
            typeof window.LoggingSystem.enableConversionTracing ===
              "function" &&
            typeof window.LoggingSystem.disableConversionTracing === "function"
          );
        },
        conversionEngineAvailable: () => !!window.ConversionEngine,
        canExecuteBasicTrace: async () => {
          try {
            const sessionId = window.LoggingSystem.traceSimpleEquation();
            const status = window.LoggingSystem.getTracingStatus();
            window.LoggingSystem.disableConversionTracing();
            return status.enabled && sessionId;
          } catch (error) {
            return false;
          }
        },
      };

      return (
        window.TestUtilities?.runTestSuite("ConversionFlowTracing", tests) || {
          success: false,
          error: "TestUtilities not available",
        }
      );
    },
  };
})();

// Make available globally for console access
window.TestConversionFlowTracing = TestConversionFlowTracing;

// Global console commands for easy access
window.executeTracingProtocol =
  TestConversionFlowTracing.executeTracingProtocol;
window.testConversionFlowTracing =
  TestConversionFlowTracing.testConversionFlowTracing;
