// performance-monitor.js
// Performance Monitoring and Memory Management Utilities
// Handles performance measurement, memory monitoring, and system diagnostics
// Uses modular logging system from Phase 1

const PerformanceMonitor = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("PERFORMANCE", {
    level: window.LoggingSystem.LOG_LEVELS.WARN, // Less verbose for utilities
  }) || {
    logError: console.error.bind(console, "[PERFORMANCE]"),
    logWarn: console.warn.bind(console, "[PERFORMANCE]"),
    logInfo: console.log.bind(console, "[PERFORMANCE]"),
    logDebug: console.log.bind(console, "[PERFORMANCE]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // PERFORMANCE MEASUREMENT UTILITIES
  // ===========================================================================================

  /**
   * Create a performance timer for measuring operation duration
   * @param {string} operationName - Name of the operation being timed
   * @returns {Object} - Timer object with start, lap, and end methods
   */
  function createPerformanceTimer(operationName) {
    const startTime = performance.now();
    const lapTimes = [];

    logDebug(`⏱️ Started timing: ${operationName}`);

    return {
      operationName,
      startTime,

      lap(lapName) {
        const currentTime = performance.now();
        const lapDuration = currentTime - startTime;
        const lapInfo = {
          name: lapName,
          time: currentTime,
          duration: lapDuration,
          formatted: `${lapDuration.toFixed(2)}ms`,
        };

        lapTimes.push(lapInfo);
        logDebug(`   📍 ${operationName} - ${lapName}: ${lapInfo.formatted}`);
        return lapInfo;
      },

      end() {
        const endTime = performance.now();
        const totalDuration = endTime - startTime;
        const result = {
          operationName,
          startTime,
          endTime,
          totalDuration,
          formatted: `${totalDuration.toFixed(2)}ms`,
          laps: lapTimes,
        };

        logInfo(`✅ ${operationName} completed in ${result.formatted}`);
        return result;
      },
    };
  }

  /**
   * Get current system performance metrics
   * @returns {Object} - Current performance metrics
   */
  function getCurrentMetrics() {
    const metrics = {
      timestamp: Date.now(),
      heapSize: 0,
      domNodes: 0,
      mathElements: 0,
      tempElements: 0,
      activeTimeouts: 0,
    };

    try {
      // Memory metrics
      if (performance.memory) {
        metrics.heapSize = performance.memory.usedJSHeapSize;
        metrics.heapSizeMB = (metrics.heapSize / 1024 / 1024).toFixed(2);
      }

      // DOM metrics
      metrics.domNodes = document.querySelectorAll("*").length;
      metrics.mathElements = document.querySelectorAll("mjx-container").length;
      metrics.tempElements = document.querySelectorAll(
        ".temp-math-processing, .processing-marker, .mathjax-temp"
      ).length;

      // MathJax queue metrics
      metrics.mathJaxQueued = document.querySelectorAll(
        '[data-mml-node="math"]'
      ).length;

      logDebug(
        `📊 Current metrics: ${metrics.heapSizeMB}MB heap, ${metrics.domNodes} DOM nodes`
      );
    } catch (error) {
      logError("Error collecting performance metrics:", error);
    }

    return metrics;
  }

  /**
   * Compare two sets of performance metrics
   * @param {Object} beforeMetrics - Metrics before operation
   * @param {Object} afterMetrics - Metrics after operation
   * @returns {Object} - Comparison results
   */
  function compareMetrics(beforeMetrics, afterMetrics) {
    const comparison = {
      duration: afterMetrics.timestamp - beforeMetrics.timestamp,
      heapChange: (afterMetrics.heapSize || 0) - (beforeMetrics.heapSize || 0),
      domNodeChange: afterMetrics.domNodes - beforeMetrics.domNodes,
      mathElementChange: afterMetrics.mathElements - beforeMetrics.mathElements,
      tempElementChange: afterMetrics.tempElements - beforeMetrics.tempElements,
    };

    // Format changes
    comparison.heapChangeMB = (comparison.heapChange / 1024 / 1024).toFixed(2);
    comparison.summary = {
      memoryEfficient: comparison.heapChange < 10 * 1024 * 1024, // Less than 10MB increase
      domEfficient: comparison.domNodeChange < 100, // Less than 100 nodes added
      cleanOperation: comparison.tempElementChange <= 0, // No temp elements left behind
    };

    logInfo(
      `📈 Metrics comparison: ${comparison.heapChangeMB}MB heap change, ${comparison.domNodeChange} DOM nodes change`
    );

    return comparison;
  }

  /**
   * Monitor operation performance with automatic metrics collection
   * @param {string} operationName - Name of operation to monitor
   * @param {Function} operation - Function to execute and monitor
   * @returns {Promise<Object>} - Operation result with performance data
   */
  async function monitorOperation(operationName, operation) {
    logInfo(`🔍 Starting monitored operation: ${operationName}`);

    const timer = createPerformanceTimer(operationName);
    const beforeMetrics = getCurrentMetrics();

    try {
      timer.lap("started");
      const result = await operation();
      timer.lap("completed");

      const afterMetrics = getCurrentMetrics();
      const timing = timer.end();
      const comparison = compareMetrics(beforeMetrics, afterMetrics);

      const performanceReport = {
        operationName,
        success: true,
        result,
        timing,
        metrics: {
          before: beforeMetrics,
          after: afterMetrics,
          comparison,
        },
      };

      logInfo(`✅ Monitored operation ${operationName} completed successfully`);
      return performanceReport;
    } catch (error) {
      const errorMetrics = getCurrentMetrics();
      const timing = timer.end();

      logError(`❌ Monitored operation ${operationName} failed:`, error);

      return {
        operationName,
        success: false,
        error: error.message,
        timing,
        metrics: {
          before: beforeMetrics,
          error: errorMetrics,
          comparison: compareMetrics(beforeMetrics, errorMetrics),
        },
      };
    }
  }

  // ===========================================================================================
  // MEMORY MONITORING UTILITIES
  // ===========================================================================================

  /**
   * Check if system is under memory pressure
   * @param {Object} thresholds - Memory thresholds to check against
   * @returns {Object} - Memory pressure assessment
   */
  function assessMemoryPressure(thresholds = {}) {
    const defaultThresholds = {
      heapSizeMB: 200,
      domNodes: 5000,
      mathElements: 200,
      tempElements: 50,
    };

    const activeThresholds = { ...defaultThresholds, ...thresholds };
    const metrics = getCurrentMetrics();

    const pressurePoints = {
      heap: metrics.heapSize > activeThresholds.heapSizeMB * 1024 * 1024,
      dom: metrics.domNodes > activeThresholds.domNodes,
      math: metrics.mathElements > activeThresholds.mathElements,
      temp: metrics.tempElements > activeThresholds.tempElements,
    };

    const underPressure = Object.values(pressurePoints).some(Boolean);
    const pressureLevel = underPressure
      ? Object.values(pressurePoints).filter(Boolean).length > 1
        ? "high"
        : "medium"
      : "low";

    const assessment = {
      underPressure,
      pressureLevel,
      pressurePoints,
      metrics,
      thresholds: activeThresholds,
      recommendations: [],
    };

    if (pressurePoints.heap) {
      assessment.recommendations.push(
        "Consider memory cleanup - high heap usage"
      );
    }
    if (pressurePoints.dom) {
      assessment.recommendations.push("Consider DOM cleanup - high node count");
    }
    if (pressurePoints.math) {
      assessment.recommendations.push(
        "Consider MathJax cleanup - many elements"
      );
    }
    if (pressurePoints.temp) {
      assessment.recommendations.push("Cleanup temporary elements immediately");
    }

    if (underPressure) {
      logWarn(`🚨 System under ${pressureLevel} memory pressure`);
      logWarn(
        `💾 Heap: ${metrics.heapSizeMB}MB, DOM: ${metrics.domNodes} nodes`
      );
    }

    return assessment;
  }

  /**
   * Get comprehensive system diagnostics
   * @returns {Object} - Complete diagnostic information
   */
  function getSystemDiagnostics() {
    logInfo("🔍 Collecting comprehensive system diagnostics...");

    const metrics = getCurrentMetrics();
    const memoryPressure = assessMemoryPressure();

    const diagnostics = {
      timestamp: Date.now(),
      performance: {
        metrics,
        memoryPressure,
      },
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookiesEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
      },
      application: {
        mathJaxAvailable: !!window.MathJax,
        pandocAvailable: !!window.ConversionEngine?.isEngineReady(),
        loggingSystemAvailable: !!window.LoggingSystem,
      },
    };

    // Add WebAssembly support check
    diagnostics.browser.webAssemblySupported =
      typeof WebAssembly !== "undefined";

    // Add memory API availability
    diagnostics.performance.memoryAPIAvailable = !!performance.memory;

    logInfo("✅ System diagnostics collection complete");
    return diagnostics;
  }

  // ===========================================================================================
  // TESTING FUNCTIONS
  // ===========================================================================================

  /**
   * Test performance monitor functionality
   */
  function testPerformanceMonitor() {
    const tests = {
      moduleExists: () => !!window.PerformanceMonitor,

      createTimerWorks: () => {
        const timer = createPerformanceTimer("test");
        return (
          timer &&
          typeof timer.lap === "function" &&
          typeof timer.end === "function"
        );
      },

      metricsCollection: () => {
        const metrics = getCurrentMetrics();
        return (
          metrics &&
          typeof metrics.domNodes === "number" &&
          metrics.timestamp > 0
        );
      },

      memoryPressureAssessment: () => {
        const assessment = assessMemoryPressure({ domNodes: 1 }); // Very low threshold
        return assessment && typeof assessment.underPressure === "boolean";
      },

      monitorOperationWorks: async () => {
        const result = await monitorOperation("test", () =>
          Promise.resolve("success")
        );
        return result && result.success && result.operationName === "test";
      },

      systemDiagnostics: () => {
        const diagnostics = getSystemDiagnostics();
        return (
          diagnostics &&
          diagnostics.performance &&
          diagnostics.browser &&
          diagnostics.application
        );
      },

      metricsComparison: () => {
        const before = getCurrentMetrics();
        const after = getCurrentMetrics();
        after.domNodes = before.domNodes + 1; // Simulate change
        const comparison = compareMetrics(before, after);
        return comparison && comparison.domNodeChange === 1;
      },
    };

    // Run tests using TestUtilities pattern from Phase 1
    if (window.TestUtilities?.runTestSuite) {
      return window.TestUtilities.runTestSuite("PerformanceMonitor", tests);
    }

    // Fallback testing with proper async handling
    return new Promise(async (resolve) => {
      let passed = 0;
      let total = 0;

      for (const [testName, testFn] of Object.entries(tests)) {
        total++;
        try {
          const result = await testFn(); // Always await, handles both sync and async
          if (result) {
            passed++;
            logDebug(`  ✅ ${testName}: PASSED`);
          } else {
            logError(`  ❌ ${testName}: FAILED`);
          }
        } catch (error) {
          logError(`  ❌ ${testName}: ERROR - ${error.message}`);
        }
      }

      const success = passed === total;
      logInfo(`📊 PerformanceMonitor: ${passed}/${total} tests passed`);

      resolve({
        success: success,
        allPassed: success,
        passed: passed,
        total: total,
        totalTests: total,
      });
    });
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Performance measurement
    createPerformanceTimer,
    monitorOperation,
    getCurrentMetrics,
    compareMetrics,

    // Memory monitoring
    assessMemoryPressure,
    getSystemDiagnostics,

    // Testing
    testPerformanceMonitor,
  };
})();

window.PerformanceMonitor = PerformanceMonitor;
