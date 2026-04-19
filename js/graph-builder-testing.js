/**
 * Graph Builder Testing Utilities
 * Console commands and integration verification for enhanced functionality.
 *
 * Usage:
 *   testGraphBuilderIntegration()  — run integration tests
 *   inspectGraphBuilder()          — inspect system state
 *
 * @version 1.0.0
 */

const GraphBuilderTesting = (function () {
  "use strict";

  // ============================================
  // LOGGING CONFIGURATION
  // ============================================

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
      console.error("[GB Testing] " + message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[GB Testing] " + message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[GB Testing] " + message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[GB Testing] " + message, ...args);
  }

  // ============================================
  // TEST DATA SAMPLES
  // ============================================

  const TEST_DATA = {
    basicTwoColumn:
      "Category,Value\nApples,45\nOranges,30\nBananas,25",
    multiSeries:
      "Month,Sales,Profit\nJanuary,15000,3000\nFebruary,18000,4500\nMarch,16500,3800",
    timeSeries:
      "Date,Temperature,Humidity\n2024-01-01,18.5,65%\n2024-01-02,20.2,58%\n2024-01-03,17.8,72%",
    currency:
      "Product,Price,Sales\nWidget A,£150,45\nWidget B,£200,30\nWidget C,£175,25",
    percentage:
      "Subject,Score,Pass Rate\nMaths,85,92%\nEnglish,78,88%\nScience,91,95%",
  };

  // ============================================
  // INDIVIDUAL TESTS
  // ============================================

  function testModuleAvailability() {
    var available = typeof window.GraphBuilderEnhanced !== "undefined";
    return {
      testName: "Module Availability",
      passed: available,
      message: available ? "GraphBuilderEnhanced loaded" : "Module not found on window",
    };
  }

  function testFormEnhancement() {
    if (!window.GraphBuilderEnhanced) {
      return { testName: "Form Enhancement", passed: false, message: "Module not available" };
    }

    var isEnhanced = window.GraphBuilderEnhanced.isFormEnhanced();
    var hasPanel = !!document.getElementById("gb-enhanced-config");

    return {
      testName: "Form Enhancement",
      passed: isEnhanced || hasPanel,
      message: isEnhanced
        ? "Form enhanced successfully"
        : hasPanel
          ? "Panel present in DOM"
          : "Not enhanced — Graph Builder may not be visible",
    };
  }

  function testColumnConfiguration() {
    if (!window.GraphBuilderEnhanced) {
      return { testName: "Column Configuration", passed: false, message: "Module not available" };
    }

    try {
      var testCols = [
        { name: "Test Category", type: "text", role: "label" },
        { name: "Test Value", type: "number", role: "value" },
      ];

      var setResult = window.GraphBuilderEnhanced.setColumnConfiguration(testCols, true);
      var retrieved = window.GraphBuilderEnhanced.getColumnConfiguration();

      var passed =
        setResult &&
        retrieved.length === 2 &&
        retrieved[0].name === "Test Category" &&
        retrieved[1].type === "number";

      // Reset to defaults
      window.GraphBuilderEnhanced.setColumnConfiguration(
        [
          { name: "Category", type: "text", role: "label" },
          { name: "Value", type: "number", role: "value" },
        ],
        false
      );

      return {
        testName: "Column Configuration",
        passed: passed,
        message: passed ? "Get/set configuration working" : "Configuration round-trip failed",
      };
    } catch (error) {
      return { testName: "Column Configuration", passed: false, message: error.message };
    }
  }

  function testCSVProcessing() {
    if (!window.GraphBuilderEnhanced) {
      return { testName: "CSV Processing", passed: false, message: "Module not available" };
    }

    try {
      var result = window.GraphBuilderEnhanced.processCSV(TEST_DATA.basicTwoColumn);

      var passed =
        result.headers &&
        result.headers.length === 2 &&
        result.rows &&
        result.rows.length === 3 &&
        result.metadata &&
        result.metadata.intelligentConfig &&
        result.metadata.intelligentConfig.columns.length === 2;

      return {
        testName: "CSV Processing",
        passed: passed,
        message: passed
          ? "Parsed 2 headers, 3 rows with intelligent config"
          : "Processing returned unexpected structure",
      };
    } catch (error) {
      return { testName: "CSV Processing", passed: false, message: error.message };
    }
  }

  // ============================================
  // TEST RUNNER
  // ============================================

  function runTests() {
    console.log(
      "%c[Graph Builder Testing]%c Running integration tests...",
      "font-weight: bold; color: #005c84;",
      "color: inherit;"
    );

    var results = [
      testModuleAvailability(),
      testFormEnhancement(),
      testColumnConfiguration(),
      testCSVProcessing(),
    ];

    var passed = results.filter(function (r) { return r.passed; }).length;
    var total = results.length;

    // Display as table
    var tableData = {};
    results.forEach(function (r) {
      tableData[r.testName] = (r.passed ? "PASS" : "FAIL") + " — " + r.message;
    });
    console.table(tableData);

    var colour = passed === total ? "color: #005051;" : "color: #d5007f;";
    console.log(
      "%c[Integration Tests]%c " + passed + "/" + total + " tests passed",
      "font-weight: bold; " + colour,
      "color: inherit;"
    );

    return {
      totalTests: total,
      passedTests: passed,
      overallResult: passed === total ? "PASS" : "FAIL",
      results: results,
    };
  }

  // ============================================
  // SYSTEM INSPECTOR
  // ============================================

  function inspectSystem() {
    var info = {
      modules: {
        GraphBuilderEnhanced: !!window.GraphBuilderEnhanced,
        GraphBuilderNotifications: !!window.GraphBuilderNotifications,
        GraphBuilderCore: !!window.GraphBuilderCore,
      },
      enhanced: {
        formEnhanced: window.GraphBuilderEnhanced
          ? window.GraphBuilderEnhanced.isFormEnhanced()
          : false,
        advancedMode: window.GraphBuilderEnhanced
          ? window.GraphBuilderEnhanced.isAdvancedMode()
          : false,
      },
      ui: {
        enhancementPanel: !!document.getElementById("gb-enhanced-config"),
        advancedOptions: !!document.getElementById("gb-advanced-options"),
        dynamicColumns: !!document.getElementById("gb-dynamic-columns"),
        addColumnBtn: !!document.getElementById("gb-add-column-enhanced"),
      },
    };

    console.table(info.modules);
    console.table(info.enhanced);
    console.table(info.ui);

    return info;
  }

  logInfo("Module loaded — console commands: testGraphBuilderIntegration(), inspectGraphBuilder()");

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    runTests: runTests,
    getTestData: function () { return TEST_DATA; },
    inspectSystem: inspectSystem,
  };
})();

// Attach to window
window.GraphBuilderTesting = GraphBuilderTesting;

// Global convenience commands
window.testGraphBuilderIntegration = function () {
  return GraphBuilderTesting.runTests();
};
window.inspectGraphBuilder = function () {
  return GraphBuilderTesting.inspectSystem();
};
