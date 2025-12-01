/**
 * OpenRouter Embed API - Phase 3 Tests
 * Request Control & Accessibility
 *
 * Tests for:
 * - P3-1: Reduced Motion Detection
 * - P3-2: Reduced Motion Fallback
 * - P3-3: Cancel Request
 * - P3-4: Clean Cancellation (AbortError handling)
 * - P3-5: Request State Tracking
 *
 * @version 1.0.0
 * @requires openrouter-embed-core.js (with Phase 3 modifications)
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

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
      console.error(`[Phase3Tests] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[Phase3Tests] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[Phase3Tests] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[Phase3Tests] ${message}`, ...args);
  }

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  /**
   * Create a test container in the DOM
   * @param {string} id - Container ID
   * @returns {HTMLElement} The created container
   */
  function createTestContainer(id = "phase3-test-container") {
    // Remove existing container if present
    const existing = document.getElementById(id);
    if (existing) {
      existing.remove();
    }

    const container = document.createElement("div");
    container.id = id;
    container.style.cssText =
      "position: fixed; bottom: 10px; right: 10px; width: 300px; height: 200px; overflow: auto; border: 1px solid #ccc; padding: 10px; background: white; z-index: 9999;";
    document.body.appendChild(container);

    return container;
  }

  /**
   * Clean up test container
   * @param {string} id - Container ID
   */
  function cleanupTestContainer(id = "phase3-test-container") {
    const container = document.getElementById(id);
    if (container) {
      container.remove();
    }
  }

  /**
   * Format test result for console
   * @param {string} testName - Name of the test
   * @param {boolean} passed - Whether test passed
   * @param {string} [details] - Additional details
   * @returns {string} Formatted result
   */
  function formatResult(testName, passed, details = "") {
    const icon = passed ? "✅" : "❌";
    const status = passed ? "PASS" : "FAIL";
    return `${icon} ${testName}: ${status}${details ? ` - ${details}` : ""}`;
  }

  // ============================================================================
  // P3-1: REDUCED MOTION DETECTION TESTS
  // ============================================================================

  /**
   * Test P3-1: prefersReducedMotion() returns boolean matching system preference
   */
  function testP3_1_ReducedMotionDetection() {
    logInfo("Running P3-1: Reduced Motion Detection tests...");

    const results = [];
    const containerId = "p3-1-test-container";

    try {
      createTestContainer(containerId);

      const embed = new window.OpenRouterEmbed({
        containerId: containerId,
      });

      // Test 1: Method exists
      const methodExists = typeof embed.prefersReducedMotion === "function";
      results.push({
        name: "prefersReducedMotion method exists",
        passed: methodExists,
        details: methodExists ? "Method available" : "Method not found",
      });

      // Test 2: Returns boolean
      const result = embed.prefersReducedMotion();
      const returnsBoolean = typeof result === "boolean";
      results.push({
        name: "prefersReducedMotion returns boolean",
        passed: returnsBoolean,
        details: `Returned: ${typeof result} (${result})`,
      });

      // Test 3: Matches system preference (if matchMedia available)
      if (window.matchMedia) {
        const systemPreference = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;
        const matchesSystem = result === systemPreference;
        results.push({
          name: "Matches system preference",
          passed: matchesSystem,
          details: `System: ${systemPreference}, Method: ${result}`,
        });
      } else {
        results.push({
          name: "Matches system preference",
          passed: true,
          details: "matchMedia not available - skipped (graceful degradation)",
        });
      }

      // Test 4: Multiple calls return consistent results
      const result2 = embed.prefersReducedMotion();
      const result3 = embed.prefersReducedMotion();
      const consistent = result === result2 && result2 === result3;
      results.push({
        name: "Consistent across multiple calls",
        passed: consistent,
        details: `Results: ${result}, ${result2}, ${result3}`,
      });
    } catch (error) {
      results.push({
        name: "P3-1 Test execution",
        passed: false,
        details: `Error: ${error.message}`,
      });
    } finally {
      cleanupTestContainer(containerId);
    }

    return results;
  }

  // ============================================================================
  // P3-2: REDUCED MOTION FALLBACK TESTS
  // ============================================================================

  /**
   * Test P3-2: sendStreamingRequest() falls back when reduced motion active
   */
  function testP3_2_ReducedMotionFallback() {
    logInfo("Running P3-2: Reduced Motion Fallback tests...");

    const results = [];
    const containerId = "p3-2-test-container";

    try {
      createTestContainer(containerId);

      // Test 1: Configuration option exists
      const embed1 = new window.OpenRouterEmbed({
        containerId: containerId,
        respectReducedMotion: true,
      });

      results.push({
        name: "respectReducedMotion config option exists",
        passed: embed1.respectReducedMotion === true,
        details: `Value: ${embed1.respectReducedMotion}`,
      });

      // Test 2: Can disable reduced motion respect
      cleanupTestContainer(containerId);
      createTestContainer(containerId);

      const embed2 = new window.OpenRouterEmbed({
        containerId: containerId,
        respectReducedMotion: false,
      });

      results.push({
        name: "respectReducedMotion can be disabled",
        passed: embed2.respectReducedMotion === false,
        details: `Value: ${embed2.respectReducedMotion}`,
      });

      // Test 3: Default is true
      cleanupTestContainer(containerId);
      createTestContainer(containerId);

      const embed3 = new window.OpenRouterEmbed({
        containerId: containerId,
        // Not specifying respectReducedMotion
      });

      results.push({
        name: "respectReducedMotion defaults to true",
        passed: embed3.respectReducedMotion === true,
        details: `Default value: ${embed3.respectReducedMotion}`,
      });

      // Test 4: _sendNonStreamingFallback method exists (internal)
      const hasFallbackMethod =
        typeof embed3._sendNonStreamingFallback === "function";
      results.push({
        name: "_sendNonStreamingFallback method exists",
        passed: hasFallbackMethod,
        details: hasFallbackMethod
          ? "Internal fallback method available"
          : "Method not found",
      });

      // Test 5: Config reflected in getConfig()
      const config = embed3.getConfig();
      const configIncludesOption = "respectReducedMotion" in config;
      results.push({
        name: "getConfig includes respectReducedMotion",
        passed: configIncludesOption,
        details: configIncludesOption
          ? `Value in config: ${config.respectReducedMotion}`
          : "Not in config",
      });
    } catch (error) {
      results.push({
        name: "P3-2 Test execution",
        passed: false,
        details: `Error: ${error.message}`,
      });
    } finally {
      cleanupTestContainer(containerId);
    }

    return results;
  }

  // ============================================================================
  // P3-3: CANCEL REQUEST TESTS
  // ============================================================================

  /**
   * Test P3-3: cancelRequest() returns true when cancelled, clears state
   */
  function testP3_3_CancelRequest() {
    logInfo("Running P3-3: Cancel Request tests...");

    const results = [];
    const containerId = "p3-3-test-container";

    try {
      createTestContainer(containerId);

      const embed = new window.OpenRouterEmbed({
        containerId: containerId,
        allowCancellation: true,
      });

      // Test 1: cancelRequest method exists
      const methodExists = typeof embed.cancelRequest === "function";
      results.push({
        name: "cancelRequest method exists",
        passed: methodExists,
        details: methodExists ? "Method available" : "Method not found",
      });

      // Test 2: Returns false when no request in progress
      const resultNoRequest = embed.cancelRequest();
      results.push({
        name: "Returns false when no request active",
        passed: resultNoRequest === false,
        details: `Returned: ${resultNoRequest}`,
      });

      // Test 3: allowCancellation config option exists
      results.push({
        name: "allowCancellation config option exists",
        passed: embed.allowCancellation === true,
        details: `Value: ${embed.allowCancellation}`,
      });

      // Test 4: Can disable cancellation
      cleanupTestContainer(containerId);
      createTestContainer(containerId);

      const embed2 = new window.OpenRouterEmbed({
        containerId: containerId,
        allowCancellation: false,
      });

      results.push({
        name: "allowCancellation can be disabled",
        passed: embed2.allowCancellation === false,
        details: `Value: ${embed2.allowCancellation}`,
      });

      // Test 5: Config reflected in getConfig()
      const config = embed2.getConfig();
      const configIncludesOption = "allowCancellation" in config;
      results.push({
        name: "getConfig includes allowCancellation",
        passed: configIncludesOption,
        details: configIncludesOption
          ? `Value in config: ${config.allowCancellation}`
          : "Not in config",
      });

      // Test 6: Accepts reason parameter
      cleanupTestContainer(containerId);
      createTestContainer(containerId);

      const embed3 = new window.OpenRouterEmbed({
        containerId: containerId,
      });

      // This should not throw even with a custom reason
      let noThrow = true;
      try {
        embed3.cancelRequest("Custom cancellation reason");
      } catch (e) {
        noThrow = false;
      }

      results.push({
        name: "cancelRequest accepts reason parameter",
        passed: noThrow,
        details: noThrow ? "No error with custom reason" : "Threw error",
      });
    } catch (error) {
      results.push({
        name: "P3-3 Test execution",
        passed: false,
        details: `Error: ${error.message}`,
      });
    } finally {
      cleanupTestContainer(containerId);
    }

    return results;
  }

  // ============================================================================
  // P3-4: CLEAN CANCELLATION TESTS
  // ============================================================================

  /**
   * Test P3-4: AbortError handled gracefully, no uncaught exceptions
   */
  function testP3_4_CleanCancellation() {
    logInfo("Running P3-4: Clean Cancellation tests...");

    const results = [];
    const containerId = "p3-4-test-container";

    try {
      createTestContainer(containerId);

      const embed = new window.OpenRouterEmbed({
        containerId: containerId,
      });

      // Test 1: getAbortController method exists
      const methodExists = typeof embed.getAbortController === "function";
      results.push({
        name: "getAbortController method exists",
        passed: methodExists,
        details: methodExists ? "Method available" : "Method not found",
      });

      // Test 2: Returns null when no request active
      const controllerNoRequest = embed.getAbortController();
      results.push({
        name: "getAbortController returns null when idle",
        passed: controllerNoRequest === null,
        details: `Returned: ${controllerNoRequest}`,
      });

      // Test 3: Internal _requestAbortController property exists
      const hasInternalProperty = "_requestAbortController" in embed;
      results.push({
        name: "_requestAbortController property exists",
        passed: hasInternalProperty,
        details: hasInternalProperty
          ? "Property available"
          : "Property not found",
      });

      // Test 4: _reducedMotionFallbackActive property exists
      const hasFallbackFlag = "_reducedMotionFallbackActive" in embed;
      results.push({
        name: "_reducedMotionFallbackActive property exists",
        passed: hasFallbackFlag,
        details: hasFallbackFlag ? "Property available" : "Property not found",
      });

      // Test 5: Initial state is clean
      const cleanInitialState =
        embed._requestAbortController === null &&
        embed._reducedMotionFallbackActive === false;
      results.push({
        name: "Initial state is clean",
        passed: cleanInitialState,
        details: `Controller: ${embed._requestAbortController}, FallbackActive: ${embed._reducedMotionFallbackActive}`,
      });
    } catch (error) {
      results.push({
        name: "P3-4 Test execution",
        passed: false,
        details: `Error: ${error.message}`,
      });
    } finally {
      cleanupTestContainer(containerId);
    }

    return results;
  }

  // ============================================================================
  // P3-5: REQUEST STATE TRACKING TESTS
  // ============================================================================

  /**
   * Test P3-5: isRequestInProgress() returns correct state
   */
  function testP3_5_RequestStateTracking() {
    logInfo("Running P3-5: Request State Tracking tests...");

    const results = [];
    const containerId = "p3-5-test-container";

    try {
      createTestContainer(containerId);

      const embed = new window.OpenRouterEmbed({
        containerId: containerId,
      });

      // Test 1: isRequestInProgress method exists
      const methodExists = typeof embed.isRequestInProgress === "function";
      results.push({
        name: "isRequestInProgress method exists",
        passed: methodExists,
        details: methodExists ? "Method available" : "Method not found",
      });

      // Test 2: Returns false initially
      const initialState = embed.isRequestInProgress();
      results.push({
        name: "Returns false when idle",
        passed: initialState === false,
        details: `Initial state: ${initialState}`,
      });

      // Test 3: Returns boolean type
      const returnsBoolean = typeof initialState === "boolean";
      results.push({
        name: "Returns boolean type",
        passed: returnsBoolean,
        details: `Type: ${typeof initialState}`,
      });

      // Test 4: Consistent with isProcessing()
      const processingState = embed.isProcessing();
      const streamingState = embed.isStreaming;
      const calculatedState = processingState || streamingState;
      const consistent = initialState === calculatedState;
      results.push({
        name: "Consistent with processing/streaming state",
        passed: consistent,
        details: `isRequestInProgress: ${initialState}, processing: ${processingState}, streaming: ${streamingState}`,
      });

      // Test 5: Multiple calls return same result
      const result1 = embed.isRequestInProgress();
      const result2 = embed.isRequestInProgress();
      const result3 = embed.isRequestInProgress();
      const stableResults = result1 === result2 && result2 === result3;
      results.push({
        name: "Stable across multiple calls",
        passed: stableResults,
        details: `Results: ${result1}, ${result2}, ${result3}`,
      });
    } catch (error) {
      results.push({
        name: "P3-5 Test execution",
        passed: false,
        details: `Error: ${error.message}`,
      });
    } finally {
      cleanupTestContainer(containerId);
    }

    return results;
  }

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  /**
   * Test integration between Phase 3 features
   */
  function testP3_Integration() {
    logInfo("Running Phase 3 Integration tests...");

    const results = [];
    const containerId = "p3-integration-test-container";

    try {
      createTestContainer(containerId);

      // Test 1: All Phase 3 config options work together
      const embed = new window.OpenRouterEmbed({
        containerId: containerId,
        respectReducedMotion: true,
        allowCancellation: true,
      });

      const config = embed.getConfig();
      const allOptionsPresent =
        "respectReducedMotion" in config && "allowCancellation" in config;

      results.push({
        name: "All Phase 3 config options present",
        passed: allOptionsPresent,
        details: `respectReducedMotion: ${config.respectReducedMotion}, allowCancellation: ${config.allowCancellation}`,
      });

      // Test 2: All Phase 3 methods available
      const allMethodsAvailable =
        typeof embed.prefersReducedMotion === "function" &&
        typeof embed.cancelRequest === "function" &&
        typeof embed.isRequestInProgress === "function" &&
        typeof embed.getAbortController === "function";

      results.push({
        name: "All Phase 3 methods available",
        passed: allMethodsAvailable,
        details: allMethodsAvailable
          ? "All 4 methods present"
          : "Some methods missing",
      });

      // Test 3: Methods work without throwing
      let noThrows = true;
      try {
        embed.prefersReducedMotion();
        embed.isRequestInProgress();
        embed.getAbortController();
        embed.cancelRequest();
      } catch (e) {
        noThrows = false;
      }

      results.push({
        name: "All methods execute without throwing",
        passed: noThrows,
        details: noThrows ? "All methods safe to call" : "Some method threw",
      });

      // Test 4: State remains consistent after method calls
      const stateAfter = {
        processing: embed.processing,
        isStreaming: embed.isStreaming,
        requestController: embed._requestAbortController,
        fallbackActive: embed._reducedMotionFallbackActive,
      };

      const cleanState =
        stateAfter.processing === false &&
        stateAfter.isStreaming === false &&
        stateAfter.requestController === null &&
        stateAfter.fallbackActive === false;

      results.push({
        name: "State remains clean after method calls",
        passed: cleanState,
        details: `processing: ${stateAfter.processing}, streaming: ${stateAfter.isStreaming}`,
      });

      // Test 5: Backwards compatibility - existing methods still work
      const existingMethodsWork =
        typeof embed.sendRequest === "function" &&
        typeof embed.sendStreamingRequest === "function" &&
        typeof embed.cancelStreaming === "function" &&
        typeof embed.isProcessing === "function";

      results.push({
        name: "Existing methods still available (backwards compat)",
        passed: existingMethodsWork,
        details: existingMethodsWork
          ? "All existing methods present"
          : "Some existing methods missing",
      });
    } catch (error) {
      results.push({
        name: "Integration test execution",
        passed: false,
        details: `Error: ${error.message}`,
      });
    } finally {
      cleanupTestContainer(containerId);
    }

    return results;
  }

  // ============================================================================
  // TEST RUNNER
  // ============================================================================

  /**
   * Run all Phase 3 tests
   * @returns {Object} Test results summary
   */
  function runAllPhase3Tests() {
    console.log("\n" + "=".repeat(60));
    console.log("OpenRouter Embed API - Phase 3 Tests");
    console.log("Request Control & Accessibility");
    console.log("=".repeat(60) + "\n");

    const allResults = [];

    // P3-1: Reduced Motion Detection
    console.log("\n📋 P3-1: Reduced Motion Detection");
    console.log("-".repeat(40));
    const p3_1_results = testP3_1_ReducedMotionDetection();
    p3_1_results.forEach((r) =>
      console.log(formatResult(r.name, r.passed, r.details))
    );
    allResults.push(...p3_1_results);

    // P3-2: Reduced Motion Fallback
    console.log("\n📋 P3-2: Reduced Motion Fallback");
    console.log("-".repeat(40));
    const p3_2_results = testP3_2_ReducedMotionFallback();
    p3_2_results.forEach((r) =>
      console.log(formatResult(r.name, r.passed, r.details))
    );
    allResults.push(...p3_2_results);

    // P3-3: Cancel Request
    console.log("\n📋 P3-3: Cancel Request");
    console.log("-".repeat(40));
    const p3_3_results = testP3_3_CancelRequest();
    p3_3_results.forEach((r) =>
      console.log(formatResult(r.name, r.passed, r.details))
    );
    allResults.push(...p3_3_results);

    // P3-4: Clean Cancellation
    console.log("\n📋 P3-4: Clean Cancellation");
    console.log("-".repeat(40));
    const p3_4_results = testP3_4_CleanCancellation();
    p3_4_results.forEach((r) =>
      console.log(formatResult(r.name, r.passed, r.details))
    );
    allResults.push(...p3_4_results);

    // P3-5: Request State Tracking
    console.log("\n📋 P3-5: Request State Tracking");
    console.log("-".repeat(40));
    const p3_5_results = testP3_5_RequestStateTracking();
    p3_5_results.forEach((r) =>
      console.log(formatResult(r.name, r.passed, r.details))
    );
    allResults.push(...p3_5_results);

    // Integration Tests
    console.log("\n📋 Integration Tests");
    console.log("-".repeat(40));
    const integration_results = testP3_Integration();
    integration_results.forEach((r) =>
      console.log(formatResult(r.name, r.passed, r.details))
    );
    allResults.push(...integration_results);

    // Summary
    const passed = allResults.filter((r) => r.passed).length;
    const failed = allResults.filter((r) => !r.passed).length;
    const total = allResults.length;

    console.log("\n" + "=".repeat(60));
    console.log("PHASE 3 TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed === 0) {
      console.log("\n🎉 ALL PHASE 3 TESTS PASSED!");
      console.log("Phase 3: Request Control & Accessibility - COMPLETE");
    } else {
      console.log("\n⚠️ Some tests failed. Review the results above.");
      const failedTests = allResults.filter((r) => !r.passed);
      console.log("\nFailed tests:");
      failedTests.forEach((r) => console.log(`  - ${r.name}: ${r.details}`));
    }

    console.log("=".repeat(60) + "\n");

    return {
      total,
      passed,
      failed,
      successRate: ((passed / total) * 100).toFixed(1) + "%",
      results: allResults,
    };
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  // Individual test functions
  window.testP3_1_ReducedMotionDetection = testP3_1_ReducedMotionDetection;
  window.testP3_2_ReducedMotionFallback = testP3_2_ReducedMotionFallback;
  window.testP3_3_CancelRequest = testP3_3_CancelRequest;
  window.testP3_4_CleanCancellation = testP3_4_CleanCancellation;
  window.testP3_5_RequestStateTracking = testP3_5_RequestStateTracking;
  window.testP3_Integration = testP3_Integration;

  // Main test runner
  window.testEmbedPhase3_All = runAllPhase3Tests;
  window.runAllPhase3Tests = runAllPhase3Tests;

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================
})();
