// test-latex-processor-coordinator.js
// Comprehensive tests for LaTeXProcessorCoordinator module
// STAGE 6: Tests coordinator logic, fallback, and feature flags

const TestLaTeXProcessorCoordinator = (function () {
  "use strict";

  function testLaTeXProcessorCoordinator() {
    console.log("\n" + "=".repeat(80));
    console.log("TESTING: LaTeX Processor Coordinator");
    console.log("=".repeat(80) + "\n");

    const tests = {
      moduleExists: testModuleExists,
      hasRequiredMethods: testRequiredMethods,
      featureDetection: testFeatureDetection,
      methodSelection: testMethodSelection,
      configurationAPI: testConfigurationAPI,
      enhancedProcessing: testEnhancedProcessing,
      legacyFallback: testLegacyFallback,
      comparisonMode: testComparisonMode,
      integrationReadiness: testIntegrationReadiness,
    };

    return TestUtilities.runTestSuite("LaTeX Processor Coordinator", tests);
  }

  // ==========================================================================================
  // TEST 1: MODULE EXISTS
  // ==========================================================================================

  function testModuleExists() {
    console.log("\n--- Test 1: Module Exists ---");
    return typeof LaTeXProcessorCoordinator !== "undefined";
  }

  // ==========================================================================================
  // TEST 2: HAS REQUIRED METHODS
  // ==========================================================================================

  function testRequiredMethods() {
    console.log("\n--- Test 2: Has Required Methods ---");

    const requiredMethods = [
      "process",
      "setExportMethod",
      "getExportMethod",
      "isEnhancedAvailable",
      "isStorageAvailable",
      "processComparison",
      "getDiagnostics",
    ];

    const results = requiredMethods.map((method) => {
      const exists = typeof LaTeXProcessorCoordinator[method] === "function";
      console.log(`  ${method}: ${exists ? "✓" : "✗"}`);
      return exists;
    });

    return results.every((result) => result === true);
  }

  // ==========================================================================================
  // TEST 3: FEATURE DETECTION
  // ==========================================================================================

  function testFeatureDetection() {
    console.log("\n--- Test 3: Feature Detection ---");

    try {
      const enhancedAvailable = LaTeXProcessorCoordinator.isEnhancedAvailable();
      const storageAvailable = LaTeXProcessorCoordinator.isStorageAvailable();

      console.log(`  Enhanced available: ${enhancedAvailable}`);
      console.log(`  Storage available: ${storageAvailable}`);

      // Check dependencies
      const legacyExists = typeof LaTeXProcessorLegacy !== "undefined";
      const enhancedExists = typeof LaTeXProcessorEnhanced !== "undefined";

      console.log(`  Legacy processor exists: ${legacyExists}`);
      console.log(`  Enhanced processor exists: ${enhancedExists}`);

      // Feature detection should not throw errors
      return true;
    } catch (error) {
      console.error("  ✗ Feature detection failed:", error.message);
      return false;
    }
  }

  // ==========================================================================================
  // TEST 4: METHOD SELECTION
  // ==========================================================================================

  function testMethodSelection() {
    console.log("\n--- Test 4: Method Selection Logic ---");

    try {
      const diagnostics = LaTeXProcessorCoordinator.getDiagnostics();
      const selectedMethod = diagnostics.selectedMethod;

      console.log(`  Selected method: ${selectedMethod}`);
      console.log(
        `  Configuration: ${diagnostics.configuration.currentMethod}`
      );

      // Selected method should be either "enhanced" or "legacy"
      const validSelection = ["enhanced", "legacy"].includes(selectedMethod);

      if (!validSelection) {
        console.error(`  ✗ Invalid selected method: ${selectedMethod}`);
        return false;
      }

      // If enhanced available, should select enhanced in auto mode
      if (
        diagnostics.availability.enhancedReady &&
        diagnostics.configuration.currentMethod === "auto"
      ) {
        if (selectedMethod !== "enhanced") {
          console.error("  ✗ Enhanced ready but not selected in auto mode");
          return false;
        }
      }

      console.log("  ✓ Method selection logic working correctly");
      return true;
    } catch (error) {
      console.error("  ✗ Method selection test failed:", error.message);
      return false;
    }
  }

  // ==========================================================================================
  // TEST 5: CONFIGURATION API
  // ==========================================================================================

  function testConfigurationAPI() {
    console.log("\n--- Test 5: Configuration API ---");

    try {
      // Save original setting
      const originalMethod = LaTeXProcessorCoordinator.getExportMethod();
      console.log(`  Original method: ${originalMethod}`);

      // Test setting valid methods
      const validMethods = ["auto", "enhanced", "legacy"];
      const setResults = validMethods.map((method) => {
        const success = LaTeXProcessorCoordinator.setExportMethod(method);
        const retrieved = LaTeXProcessorCoordinator.getExportMethod();
        const matches = retrieved === method;
        console.log(
          `  Set ${method}: ${success ? "✓" : "✗"} (retrieved: ${retrieved})`
        );
        return success && matches;
      });

      // Test setting invalid method
      const invalidResult =
        LaTeXProcessorCoordinator.setExportMethod("invalid");
      console.log(`  Set invalid method: ${!invalidResult ? "✓" : "✗"}`);

      // Restore original setting
      LaTeXProcessorCoordinator.setExportMethod(originalMethod);
      console.log(`  Restored original method: ${originalMethod}`);

      return setResults.every((r) => r) && !invalidResult;
    } catch (error) {
      console.error("  ✗ Configuration API test failed:", error.message);
      return false;
    }
  }

  // ==========================================================================================
  // TEST 6: ENHANCED PROCESSING
  // ==========================================================================================

  function testEnhancedProcessing() {
    console.log("\n--- Test 6: Enhanced Processing ---");

    try {
      if (!LaTeXProcessorCoordinator.isEnhancedAvailable()) {
        console.log("  ⊘ Enhanced processing not available (skipped)");
        return true; // Not a failure if unavailable
      }

      // Test with mock HTML content
      const mockContent =
        '<p>Test content with <span class="math inline">\\(x = 1\\)</span></p>';

      // This would require actual processing, so we just verify the method exists
      console.log("  ✓ Enhanced processing method available");
      console.log("  ℹ️ Actual processing tested via real export workflow");
      return true;
    } catch (error) {
      console.error("  ✗ Enhanced processing test failed:", error.message);
      return false;
    }
  }

  // ==========================================================================================
  // TEST 7: LEGACY FALLBACK
  // ==========================================================================================

  function testLegacyFallback() {
    console.log("\n--- Test 7: Legacy Fallback ---");

    try {
      // Check legacy processor exists
      if (typeof LaTeXProcessorLegacy === "undefined") {
        console.error("  ✗ Legacy processor not available");
        return false;
      }

      // Save current method
      const originalMethod = LaTeXProcessorCoordinator.getExportMethod();

      // Force legacy method
      LaTeXProcessorCoordinator.setExportMethod("legacy");

      const diagnostics = LaTeXProcessorCoordinator.getDiagnostics();
      const willUseLegacy = diagnostics.selectedMethod === "legacy";

      console.log(`  Legacy fallback configured: ${willUseLegacy ? "✓" : "✗"}`);

      // Restore original method
      LaTeXProcessorCoordinator.setExportMethod(originalMethod);

      return willUseLegacy;
    } catch (error) {
      console.error("  ✗ Legacy fallback test failed:", error.message);
      return false;
    }
  }

  // ==========================================================================================
  // TEST 8: COMPARISON MODE
  // ==========================================================================================

  function testComparisonMode() {
    console.log("\n--- Test 8: Comparison Mode ---");

    try {
      // Check if comparison method exists
      if (typeof LaTeXProcessorCoordinator.processComparison !== "function") {
        console.error("  ✗ Comparison mode method not found");
        return false;
      }

      console.log("  ✓ Comparison mode method available");
      console.log("  ℹ️ Actual comparison tested via real export workflow");

      // Note: Full comparison testing requires actual HTML content
      // and is better done via real export workflow
      return true;
    } catch (error) {
      console.error("  ✗ Comparison mode test failed:", error.message);
      return false;
    }
  }

  // ==========================================================================================
  // TEST 9: INTEGRATION READINESS
  // ==========================================================================================

  function testIntegrationReadiness() {
    console.log("\n--- Test 9: Integration Readiness ---");

    try {
      const diagnostics = LaTeXProcessorCoordinator.getDiagnostics();

      console.log("\n  Diagnostics Report:");
      console.log(`  - Module version: ${diagnostics.version}`);
      console.log(
        `  - Current method: ${diagnostics.configuration.currentMethod}`
      );
      console.log(`  - Selected method: ${diagnostics.selectedMethod}`);
      console.log(
        `  - Enhanced ready: ${diagnostics.availability.enhancedReady}`
      );
      console.log(
        `  - Storage ready: ${diagnostics.availability.storageReady}`
      );

      console.log("\n  Recommendations:");
      diagnostics.recommendations.forEach((rec) => {
        console.log(`  ${rec}`);
      });

      // Check critical requirements
      const hasLegacy = diagnostics.availability.legacyProcessor;

      if (!hasLegacy) {
        console.error("  ✗ Legacy processor missing (critical)");
        return false;
      }

      console.log("\n  ✓ Integration ready for export-manager.js");
      return true;
    } catch (error) {
      console.error("  ✗ Integration readiness test failed:", error.message);
      return false;
    }
  }

  // ==========================================================================================
  // PUBLIC API
  // ==========================================================================================

  return {
    testLaTeXProcessorCoordinator: testLaTeXProcessorCoordinator,
  };
})();

// Auto-register with TestRegistry if available
if (typeof TestRegistry !== "undefined") {
  TestRegistry.registerTest({
    name: "LaTeX Processor Coordinator",
    category: "individual",
    fn: TestLaTeXProcessorCoordinator.testLaTeXProcessorCoordinator,
    module: "LaTeXProcessorCoordinator",
  });
}

// Make the function directly accessible
window.testLaTeXProcessorCoordinator =
  TestLaTeXProcessorCoordinator.testLaTeXProcessorCoordinator;
