// test-original-parity.js
// Validates refactored template system against original template-system.js
// Ensures no functionality was lost or broken during the refactoring
// Used by: TestFramework, TestRegistry
// Category: Validation

const TestOriginalParity = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION
  // ===========================================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[TestOriginalParity]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[TestOriginalParity]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[TestOriginalParity]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[TestOriginalParity]", message, ...args);
  }

  // ===========================================================================================
  // HELPER UTILITIES
  // ===========================================================================================

  /**
   * Simple assertion helper
   * @param {boolean} condition - Condition to assert
   * @param {string} message - Error message if assertion fails
   * @throws {Error} If condition is false
   */
  function assert(condition, message = "Assertion failed") {
    if (!condition) {
      throw new Error(message);
    }
  }

  /**
   * Check if a value is a non-null object
   * @param {*} value - Value to check
   * @returns {boolean} True if value is an object
   */
  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  // ===========================================================================================
  // MAIN TEST SUITE
  // ===========================================================================================

  /**
   * Compare refactored system against original template-system.js
   * Ensures no functionality was lost or broken
   *
   * @returns {Promise<Object>} Test results object
   */
  async function testOriginalParity() {
    logInfo("🔍 Starting Original Parity Validation Tests...");

    const tests = {
      // ===================================================================
      // PUBLIC API PARITY TESTS
      // ===================================================================

      "All original classes still accessible": () => {
        // Original had: EnhancedTemplateEngine, EnhancedHTMLGenerator, GlobalTemplateCache
        assert(
          !!window.TemplateSystem.EnhancedTemplateEngine,
          "EnhancedTemplateEngine class missing"
        );
        assert(
          !!window.TemplateSystem.EnhancedHTMLGenerator,
          "EnhancedHTMLGenerator class missing"
        );
        assert(
          !!window.TemplateSystem.GlobalTemplateCache,
          "GlobalTemplateCache missing"
        );
        return true;
      },

      "All original factory methods work": () => {
        // Original had: createEngine(), createGenerator()
        const engine = window.TemplateSystem.createEngine();
        const generator = window.TemplateSystem.createGenerator();
        assert(engine, "createEngine() failed");
        assert(generator, "createGenerator() failed");
        assert(
          engine.constructor.name === "EnhancedTemplateEngine",
          "createEngine() returned wrong type"
        );
        assert(
          generator.constructor.name === "EnhancedHTMLGenerator",
          "createGenerator() returned wrong type"
        );
        return true;
      },

      "GlobalTemplateCache singleton accessible": () => {
        // Verify global cache exists and has expected methods
        const cache = window.TemplateSystem.GlobalTemplateCache;
        assert(cache, "GlobalTemplateCache not accessible");
        assert(
          typeof cache.ensureTemplatesLoaded === "function",
          "ensureTemplatesLoaded method missing"
        );
        assert(
          typeof cache.getAllTemplates === "function",
          "getAllTemplates method missing"
        );
        assert(
          typeof cache.clearCache === "function",
          "clearCache method missing"
        );
        return true;
      },

      "Template loading system functional": async () => {
        // Ensure templates can be loaded
        await window.TemplateSystem.ensureTemplatesLoaded();
        const cache = window.TemplateSystem.GlobalTemplateCache;
        const templates = cache.getAllTemplates();
        assert(templates.size > 0, "No templates loaded");
        assert(
          templates.size >= 10,
          `Expected at least 10 templates, got ${templates.size}`
        );
        return true;
      },

      "All template helpers preserved": async () => {
        // Actual helpers: formatPercent, formatSize, formatId, equals, notEquals, greaterThan, lessThan, britishSpelling
        const engine = window.TemplateSystem.createEngine();
        await window.TemplateSystem.ensureTemplatesLoaded();

        const requiredHelpers = [
          "formatPercent",
          "formatSize",
          "formatId",
          "equals",
          "notEquals",
          "greaterThan",
          "lessThan",
          "britishSpelling",
        ];
        requiredHelpers.forEach((helper) => {
          assert(engine.helpers.has(helper), `Helper '${helper}' missing`);
        });

        logDebug(`✅ All ${requiredHelpers.length} required helpers present`);
        return true;
      },

      "All template filters preserved": async () => {
        // Filters: uppercase, lowercase, capitalise, truncate, default, json, length
        const engine = window.TemplateSystem.createEngine();
        await window.TemplateSystem.ensureTemplatesLoaded();

        const requiredFilters = [
          "uppercase",
          "lowercase",
          "capitalise",
          "truncate",
          "default",
          "json",
          "length",
        ];
        requiredFilters.forEach((filter) => {
          assert(engine.filters.has(filter), `Filter '${filter}' missing`);
        });

        logDebug(`✅ All ${requiredFilters.length} required filters present`);
        return true;
      },

      "Template rendering produces valid output": async () => {
        // Render a known template and verify output structure
        // NOTE: Template name is "readingToolsSection" (camelCase), not "reading-tools-section"
        await window.TemplateSystem.ensureTemplatesLoaded();
        const engine = window.TemplateSystem.createEngine();

        const output = engine.render("readingToolsSection", {});

        // Check for key elements that should be in output
        assert(output, "Render returned no output");
        assert(output.length > 100, "Output too short");
        assert(
          output.includes("font") || output.includes("select"),
          "Output missing expected content"
        );

        return true;
      },

      "Font loading system works": async () => {
        // Verify font loading functionality
        const generator = window.TemplateSystem.createGenerator();
        const fontData = await generator.loadFontData();

        // Check structure matches original expectations
        assert(isObject(fontData), "Font data not an object");
        assert(fontData.base64Regular, "Regular font missing");
        assert(fontData.base64Bold, "Bold font missing");
        assert(fontData.base64Italic, "Italic font missing");
        assert(fontData.base64BoldItalic, "Bold-italic font missing");

        // Verify fonts are valid base64
        assert(
          fontData.base64Regular.length > 1000,
          "Regular font data too small"
        );

        return true;
      },

      "JavaScript template generation works": async () => {
        // Test JS template loading
        await window.TemplateSystem.ensureTemplatesLoaded();
        const generator = window.TemplateSystem.createGenerator();

        const jsCode = await generator.loadJavaScriptTemplate(
          "focus-tracking.js"
        );

        assert(jsCode, "No JS code generated");
        assert(jsCode.length > 0, "JS template empty");
        assert(typeof jsCode === "string", "JS template not a string");

        return true;
      },

      "Complete export pipeline functional": async () => {
        // Test the full pipeline that original supported
        await window.TemplateSystem.ensureTemplatesLoaded();

        const generator = window.TemplateSystem.createGenerator();
        const fontData = await generator.loadFontData();
        const jsCode =
          await generator.generateReadingAccessibilityManagerClassJS();

        assert(fontData, "Font loading failed in pipeline");
        assert(jsCode, "JS generation failed in pipeline");
        assert(jsCode.length > 0, "Generated JS code empty");

        return true;
      },

      // ===================================================================
      // PERFORMANCE PARITY TESTS
      // ===================================================================

      "Template rendering speed maintained": async () => {
        await window.TemplateSystem.ensureTemplatesLoaded();
        const engine = window.TemplateSystem.createEngine();

        const iterations = 100;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          engine.render("readingToolsSection", {});
        }

        const duration = performance.now() - start;
        const avgTime = duration / iterations;

        logDebug(`Average render time: ${avgTime.toFixed(2)}ms`);

        // Original target was <5ms per render
        assert(
          avgTime < 10,
          `Render time ${avgTime.toFixed(
            2
          )}ms exceeds 10ms target (degraded from original 5ms)`
        );

        return true;
      },

      "Memory usage reasonable": async () => {
        // Skip if performance.memory not available
        if (!performance.memory) {
          logWarn("⚠️ Performance.memory API not available - skipping test");
          return true;
        }

        const initialMemory = performance.memory.usedJSHeapSize;

        // Create 50 engines and generators
        await window.TemplateSystem.ensureTemplatesLoaded();
        const instances = [];

        for (let i = 0; i < 50; i++) {
          instances.push(window.TemplateSystem.createEngine());
          instances.push(window.TemplateSystem.createGenerator());
        }

        const finalMemory = performance.memory.usedJSHeapSize;
        const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;

        logDebug(
          `Memory increase: ${memoryIncrease.toFixed(2)}MB for 100 instances`
        );

        // Should not use more than 10MB for 100 instances
        assert(
          memoryIncrease < 10,
          `Memory increase ${memoryIncrease.toFixed(2)}MB exceeds 10MB limit`
        );

        // Clear for GC
        instances.length = 0;
        return true;
      },

      // ===================================================================
      // BACKWARD COMPATIBILITY TESTS
      // ===================================================================

      "Legacy API methods still work": () => {
        // Verify old method names still function
        assert(
          typeof window.TemplateSystem.createEngine === "function",
          "createEngine method missing"
        );
        assert(
          typeof window.TemplateSystem.createGenerator === "function",
          "createGenerator method missing"
        );
        assert(
          typeof window.TemplateSystem.ensureTemplatesLoaded === "function",
          "ensureTemplatesLoaded method missing"
        );
        assert(
          typeof window.TemplateSystem.clearAllCaches === "function",
          "clearAllCaches method missing"
        );
        return true;
      },

      "Test suite still accessible": () => {
        // Verify built-in test method works
        assert(
          typeof window.TemplateSystem.test === "function",
          "test method missing"
        );
        assert(
          typeof window.TemplateSystem.validateTemplateSystem === "function",
          "validateTemplateSystem method missing"
        );
        return true;
      },

      "Performance reporting available": () => {
        // Verify performance methods exist
        const engine = window.TemplateSystem.createEngine();
        assert(
          typeof engine.getPerformanceReport === "function",
          "getPerformanceReport method missing"
        );
        return true;
      },

      // ===================================================================
      // CACHE MANAGEMENT TESTS
      // ===================================================================

      "Cache clearing works": async () => {
        // Load templates
        await window.TemplateSystem.ensureTemplatesLoaded();
        let cache = window.TemplateSystem.GlobalTemplateCache;
        let templates = cache.getAllTemplates();
        assert(templates.size > 0, "Templates not loaded");

        // Clear cache
        window.TemplateSystem.clearAllCaches();
        cache = window.TemplateSystem.GlobalTemplateCache;
        templates = cache.getAllTemplates();

        assert(templates.size === 0, "Cache not cleared");

        // Reload to restore state
        await window.TemplateSystem.ensureTemplatesLoaded();

        return true;
      },

      "Cache status reporting works": async () => {
        await window.TemplateSystem.ensureTemplatesLoaded();
        const status = window.TemplateSystem.getGlobalCacheStatus();

        assert(isObject(status), "Status not an object");
        assert(
          typeof status.templatesCount === "number",
          "templatesCount missing"
        );
        assert(status.templatesCount > 0, "No templates in status");

        return true;
      },
    };

    // Run all tests using TestUtilities
    const results = await window.TestUtilities.runAsyncTestSuite(
      "OriginalParity",
      tests
    );

    // Calculate total and success from the results
    const totalTests = Object.keys(tests).length;
    const passedTests = results.passed || 0;
    const failedTests = results.failed || totalTests - passedTests;
    const isSuccess = failedTests === 0 && passedTests === totalTests;

    // Enhanced reporting
    logInfo("📊 Original Parity Validation Results:");
    logInfo(`  Total Tests: ${totalTests}`);
    logInfo(`  Passed: ${passedTests}`);
    logInfo(`  Failed: ${failedTests}`);
    logInfo(`  Success: ${isSuccess ? "✅ YES" : "❌ NO"}`);

    if (!isSuccess) {
      logError(
        "❌ PARITY VALIDATION FAILED - Refactoring may have broken functionality"
      );

      // Check if results array exists before filtering
      if (results.results && Array.isArray(results.results)) {
        results.results
          .filter((r) => !r.passed)
          .forEach((r) => {
            logError(`  ❌ ${r.name}: ${r.error || "Unknown error"}`);
          });
      }
    } else {
      logInfo(
        "✅ PARITY VALIDATION PASSED - All original functionality preserved"
      );
    }

    // Add success flag to results for consistency
    results.success = isSuccess;
    results.totalTests = totalTests;

    return results;
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    testOriginalParity,
  };
})();

// ===========================================================================================
// GLOBAL EXPORTS & AUTO-REGISTRATION
// ===========================================================================================

window.TestOriginalParity = TestOriginalParity;
window.testOriginalParity = TestOriginalParity.testOriginalParity;

// Auto-register with TestRegistry
if (window.TestRegistry && window.TestRegistry.registerTest) {
  window.TestRegistry.registerTest(
    "testOriginalParity",
    TestOriginalParity.testOriginalParity,
    {
      category: "validation",
      module: "TemplateSystem",
      description:
        "Validates refactored template system against original functionality",
      dependencies: ["TemplateSystem", "TestUtilities"],
    }
  );
  console.log("✅ TestOriginalParity registered with TestRegistry");
}

console.log("✅ TestOriginalParity module loaded");
console.log("💡 Usage: await testOriginalParity()");
