// Enhanced Pandoc-WASM Mathematical Playground - Testing Framework Utilities
// Foundation utilities for the refactored testing system
// Provides core functionality for test execution, logging, and performance measurement

const TestUtilities = (function () {
  // Logging configuration (standard pattern for all testing files)
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
      console.error(`[TestUtilities] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TestUtilities] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TestUtilities] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TestUtilities] ${message}`, ...args);
  }

  // Core test execution function
  function runTestSuite(suiteName, tests) {
    logInfo(`Starting test suite: ${suiteName}`);
    let passed = 0;
    let failed = 0;
    const failedTests = [];
    let totalTime = 0;

    console.log(`\n🧪 Running ${suiteName} Tests:`);
    console.log("=".repeat(50));

    for (const [testName, testFunction] of Object.entries(tests)) {
      try {
        const startTime = performance.now();
        const result = testFunction();
        const endTime = performance.now();
        const testTime = endTime - startTime;
        totalTime += testTime;

        if (result === true) {
          console.log(`✅ ${testName}: PASSED (${testTime.toFixed(2)}ms)`);
          passed++;
        } else if (result === false) {
          console.log(`❌ ${testName}: FAILED`);
          failed++;
          failedTests.push(testName);
        } else {
          // Handle promise or complex result objects
          console.log(`🔄 ${testName}: ${result} (${testTime.toFixed(2)}ms)`);
          passed++;
        }
      } catch (error) {
        console.log(`💥 ${testName}: ERROR - ${error.message}`);
        logError(`Test ${testName} threw error:`, error);
        failed++;
        failedTests.push(testName);
      }
    }

    // Summary
    console.log("=".repeat(50));
    const totalTests = passed + failed;
    const successRate =
      totalTests > 0 ? ((passed / totalTests) * 100).toFixed(1) : 0;

    if (failed === 0) {
      console.log(
        `🎉 ${suiteName}: ALL ${totalTests} TESTS PASSED (${totalTime.toFixed(
          2
        )}ms total)`
      );
      console.log(`📊 Success Rate: ${successRate}%`);
    } else {
      console.log(
        `⚠️  ${suiteName}: ${passed}/${totalTests} PASSED, ${failed} FAILED (${totalTime.toFixed(
          2
        )}ms total)`
      );
      console.log(`📊 Success Rate: ${successRate}%`);
      console.log(`❌ Failed Tests: ${failedTests.join(", ")}`);
    }

    logInfo(
      `Test suite ${suiteName} completed: ${passed} passed, ${failed} failed`
    );

    return {
      suiteName,
      passed,
      failed,
      totalTests,
      successRate: parseFloat(successRate),
      totalTime,
      failedTests: [...failedTests],
      allPassed: failed === 0,
    };
  }

  // Async version of runTestSuite for tests that return promises
  async function runAsyncTestSuite(suiteName, tests) {
    logInfo(`Starting async test suite: ${suiteName}`);
    let passed = 0;
    let failed = 0;
    const failedTests = [];
    let totalTime = 0;

    console.log(`\n🧪 Running ${suiteName} Tests (Async):`);
    console.log("=".repeat(50));

    for (const [testName, testFunction] of Object.entries(tests)) {
      try {
        const startTime = performance.now();
        const result = await testFunction();
        const endTime = performance.now();
        const testTime = endTime - startTime;
        totalTime += testTime;

        if (result === true) {
          console.log(`✅ ${testName}: PASSED (${testTime.toFixed(2)}ms)`);
          passed++;
        } else if (result === false) {
          console.log(`❌ ${testName}: FAILED`);
          failed++;
          failedTests.push(testName);
        } else {
          console.log(`🔄 ${testName}: ${result} (${testTime.toFixed(2)}ms)`);
          passed++;
        }
      } catch (error) {
        console.log(`💥 ${testName}: ERROR - ${error.message}`);
        logError(`Async test ${testName} threw error:`, error);
        failed++;
        failedTests.push(testName);
      }
    }

    // Summary
    console.log("=".repeat(50));
    const totalTests = passed + failed;
    const successRate =
      totalTests > 0 ? ((passed / totalTests) * 100).toFixed(1) : 0;

    if (failed === 0) {
      console.log(
        `🎉 ${suiteName}: ALL ${totalTests} TESTS PASSED (${totalTime.toFixed(
          2
        )}ms total)`
      );
      console.log(`📊 Success Rate: ${successRate}%`);
    } else {
      console.log(
        `⚠️  ${suiteName}: ${passed}/${totalTests} PASSED, ${failed} FAILED (${totalTime.toFixed(
          2
        )}ms total)`
      );
      console.log(`📊 Success Rate: ${successRate}%`);
      console.log(`❌ Failed Tests: ${failedTests.join(", ")}`);
    }

    logInfo(
      `Async test suite ${suiteName} completed: ${passed} passed, ${failed} failed`
    );

    return {
      suiteName,
      passed,
      failed,
      totalTests,
      successRate: parseFloat(successRate),
      totalTime,
      failedTests: [...failedTests],
      allPassed: failed === 0,
    };
  }

  // Performance measurement utilities
  function measurePerformance(operation, iterations = 1000) {
    logInfo(
      `Measuring performance for operation over ${iterations} iterations`
    );

    const times = [];
    let totalTime = 0;

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      try {
        operation();
      } catch (error) {
        logError(`Performance test iteration ${i} failed:`, error);
        continue;
      }
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      times.push(executionTime);
      totalTime += executionTime;
    }

    if (times.length === 0) {
      logError("All performance test iterations failed");
      return null;
    }

    const avgTime = totalTime / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    // Calculate percentiles
    const sortedTimes = times.sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

    const results = {
      iterations: times.length,
      avgTime: parseFloat(avgTime.toFixed(3)),
      minTime: parseFloat(minTime.toFixed(3)),
      maxTime: parseFloat(maxTime.toFixed(3)),
      p50: parseFloat(p50.toFixed(3)),
      p95: parseFloat(p95.toFixed(3)),
      p99: parseFloat(p99.toFixed(3)),
      totalTime: parseFloat(totalTime.toFixed(3)),
    };

    logInfo("Performance measurement completed:", results);
    return results;
  }

  // Utility to validate module availability
  function validateModuleAvailability(moduleName, moduleObject) {
    try {
      if (typeof moduleObject === "undefined") {
        logError(`Module ${moduleName} is undefined`);
        return false;
      }

      if (moduleObject === null) {
        logError(`Module ${moduleName} is null`);
        return false;
      }

      if (
        typeof moduleObject !== "object" &&
        typeof moduleObject !== "function"
      ) {
        logError(
          `Module ${moduleName} is not an object or function (type: ${typeof moduleObject})`
        );
        return false;
      }

      logDebug(`Module ${moduleName} is available and valid`);
      return true;
    } catch (error) {
      logError(`Error validating module ${moduleName}:`, error);
      return false;
    }
  }

  // Utility to check if a function exists and is callable
  function validateFunctionAvailability(functionName, functionObject) {
    try {
      if (typeof functionObject !== "function") {
        logError(
          `Function ${functionName} is not a function (type: ${typeof functionObject})`
        );
        return false;
      }

      logDebug(`Function ${functionName} is available and callable`);
      return true;
    } catch (error) {
      logError(`Error validating function ${functionName}:`, error);
      return false;
    }
  }

  // Utility to create test result summary
  function createTestSummary(testResults) {
    let totalPassed = 0;
    let totalFailed = 0;
    let totalTests = 0;
    let totalTime = 0;
    const failedSuites = [];

    for (const result of testResults) {
      totalPassed += result.passed;
      totalFailed += result.failed;
      totalTests += result.totalTests;
      totalTime += result.totalTime;

      if (!result.allPassed) {
        failedSuites.push(result.suiteName);
      }
    }

    const overallSuccessRate =
      totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;

    return {
      totalSuites: testResults.length,
      totalPassed,
      totalFailed,
      totalTests,
      totalTime: parseFloat(totalTime.toFixed(2)),
      overallSuccessRate: parseFloat(overallSuccessRate),
      allSuitesPassed: failedSuites.length === 0,
      failedSuites: [...failedSuites],
    };
  }

  // Utility to format test results for console output
  function formatTestResults(summary) {
    console.log("\n" + "=".repeat(60));
    console.log("🏆 COMPREHENSIVE TEST RESULTS SUMMARY");
    console.log("=".repeat(60));

    if (summary.allSuitesPassed) {
      console.log(
        `🎉 ALL TESTS PASSED! ${summary.totalPassed}/${summary.totalTests} tests successful`
      );
    } else {
      console.log(
        `⚠️  ${summary.totalPassed}/${summary.totalTests} tests passed (${summary.totalFailed} failed)`
      );
      console.log(`❌ Failed Suites: ${summary.failedSuites.join(", ")}`);
    }

    console.log(`📊 Overall Success Rate: ${summary.overallSuccessRate}%`);
    console.log(`⏱️  Total Execution Time: ${summary.totalTime}ms`);
    console.log(`📝 Test Suites Run: ${summary.totalSuites}`);
    console.log("=".repeat(60));

    return summary.allSuitesPassed;
  }

  // Browser compatibility check utility
  function checkBrowserCompatibility() {
    const results = {
      webAssembly: typeof WebAssembly !== "undefined",
      promises: typeof Promise !== "undefined",
      asyncAwait: (async () => {})().constructor === Promise,
      es6Modules:
        typeof document !== "undefined" &&
        "noModule" in document.createElement("script"),
      performanceAPI:
        typeof performance !== "undefined" &&
        typeof performance.now === "function",
      localStorage: typeof localStorage !== "undefined",
      sessionStorage: typeof sessionStorage !== "undefined",
      fetch: typeof fetch !== "undefined",
      console:
        typeof console !== "undefined" && typeof console.log === "function",
    };

    logInfo("Browser compatibility check results:", results);
    return results;
  }

  // Public API
  return {
    // Core test execution
    runTestSuite,
    runAsyncTestSuite,

    // Performance utilities
    measurePerformance,

    // Validation utilities
    validateModuleAvailability,
    validateFunctionAvailability,
    checkBrowserCompatibility,

    // Result formatting
    createTestSummary,
    formatTestResults,

    // Logging utilities (for other test files)
    logError,
    logWarn,
    logInfo,
    logDebug,

    // Constants
    LOG_LEVELS,
  };
})();

// Export pattern for global access (PROVEN working pattern)
window.TestUtilities = TestUtilities;

console.log("✅ TestUtilities loaded and exported to global scope");
console.log("🧪 Available utilities:");
console.log("  • TestUtilities.runTestSuite(name, tests) - Execute test suite");
console.log(
  "  • TestUtilities.runAsyncTestSuite(name, tests) - Execute async test suite"
);
console.log(
  "  • TestUtilities.measurePerformance(operation, iterations) - Performance testing"
);
console.log(
  "  • TestUtilities.validateModuleAvailability(name, module) - Module validation"
);
console.log(
  "  • TestUtilities.createTestSummary(results) - Format test results"
);
console.log(
  "  • TestUtilities.checkBrowserCompatibility() - Browser feature check"
);
