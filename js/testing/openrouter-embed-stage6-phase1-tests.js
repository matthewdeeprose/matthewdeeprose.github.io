/**
 * OpenRouter Embed API - Stage 6 Phase 1 Test Suite
 *
 * Tests for Retry with Exponential Backoff
 * 12 tests covering all acceptance criteria
 *
 * @version 1.0.0 (Stage 6 Phase 1)
 * @date 30 November 2025
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
      console.error(`[Stage6-P1-Tests ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[Stage6-P1-Tests WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[Stage6-P1-Tests INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[Stage6-P1-Tests DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  /**
   * Check if EmbedRetryHandler is available
   */
  function checkRetryHandlerAvailable() {
    if (typeof window.EmbedRetryHandler === "undefined") {
      throw new Error(
        "EmbedRetryHandler not loaded. Include openrouter-embed-retry.js first."
      );
    }
    return true;
  }

  /**
   * Create a fresh retry handler instance for testing
   */
  function createFreshHandler() {
    return new window.EmbedRetryHandlerClass();
  }

  /**
   * Create a mock error with specific properties
   */
  function createMockError(options = {}) {
    const error = new Error(options.message || "Test error");
    if (options.status) error.status = options.status;
    if (options.code) error.code = options.code;
    return error;
  }

  /**
   * Create a function that fails N times then succeeds
   */
  function createFailThenSucceed(failCount, successValue = "success") {
    let attempts = 0;
    return async () => {
      attempts++;
      if (attempts <= failCount) {
        const error = createMockError({
          message: "Network error",
          status: 503,
        });
        throw error;
      }
      return successValue;
    };
  }

  /**
   * Create a function that always fails
   */
  function createAlwaysFail(errorOptions = {}) {
    return async () => {
      throw createMockError({
        message: "Persistent failure",
        status: 503,
        ...errorOptions,
      });
    };
  }

  // ============================================================================
  // TEST P1-01: Module Exists with All Required Methods
  // ============================================================================

  async function testP1_01_ModuleExists() {
    logInfo("P1-01: Testing module exists with all required methods");

    try {
      checkRetryHandlerAvailable();

      const handler = window.EmbedRetryHandler;

      // Check all required methods
      const requiredMethods = [
        "configure",
        "execute",
        "isRetryable",
        "calculateDelay",
        "getConfig",
        "reset",
        "getStats",
        "resetStats",
      ];

      const missingMethods = [];
      for (const method of requiredMethods) {
        if (typeof handler[method] !== "function") {
          missingMethods.push(method);
        }
      }

      if (missingMethods.length > 0) {
        throw new Error(`Missing methods: ${missingMethods.join(", ")}`);
      }

      // Check class is also exposed
      if (typeof window.EmbedRetryHandlerClass !== "function") {
        throw new Error("EmbedRetryHandlerClass not exposed");
      }

      logInfo("✅ P1-01 PASSED: Module exists with all required methods");
      return { success: true };
    } catch (error) {
      logError("❌ P1-01 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST P1-02: Disabled No Retry
  // ============================================================================

  async function testP1_02_DisabledNoRetry() {
    logInfo("P1-02: Testing disabled handler does not retry");

    try {
      checkRetryHandlerAvailable();

      const handler = createFreshHandler();
      handler.configure({ enabled: false });

      let attemptCount = 0;
      const failingFn = async () => {
        attemptCount++;
        throw createMockError({ message: "Test failure", status: 503 });
      };

      try {
        await handler.execute(failingFn);
        throw new Error("Should have thrown");
      } catch (error) {
        if (error.message === "Should have thrown") {
          throw error;
        }
        // Expected to fail
      }

      if (attemptCount !== 1) {
        throw new Error(
          `Expected 1 attempt when disabled, got ${attemptCount}`
        );
      }

      logInfo("✅ P1-02 PASSED: Disabled handler does not retry");
      return { success: true };
    } catch (error) {
      logError("❌ P1-02 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST P1-03: Enabled Retries Up To maxRetries
  // ============================================================================

  async function testP1_03_EnabledRetries() {
    logInfo("P1-03: Testing enabled handler retries up to maxRetries");

    try {
      checkRetryHandlerAvailable();

      const handler = createFreshHandler();
      handler.configure({
        enabled: true,
        maxRetries: 3,
        initialDelay: 10, // Fast for testing
        jitter: false,
      });

      let attemptCount = 0;
      const alwaysFail = async () => {
        attemptCount++;
        throw createMockError({ message: "Network error", status: 503 });
      };

      try {
        await handler.execute(alwaysFail);
        throw new Error("Should have thrown");
      } catch (error) {
        if (error.message === "Should have thrown") {
          throw error;
        }
        // Expected to fail after retries
      }

      // Should be initial attempt + 3 retries = 4 total
      if (attemptCount !== 4) {
        throw new Error(
          `Expected 4 attempts (1 + 3 retries), got ${attemptCount}`
        );
      }

      logInfo("✅ P1-03 PASSED: Handler retries up to maxRetries");
      return { success: true };
    } catch (error) {
      logError("❌ P1-03 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST P1-04: Successful Retry Returns Result
  // ============================================================================

  async function testP1_04_SuccessfulRetry() {
    logInfo("P1-04: Testing successful retry returns correct result");

    try {
      checkRetryHandlerAvailable();

      const handler = createFreshHandler();
      handler.configure({
        enabled: true,
        maxRetries: 3,
        initialDelay: 10,
        jitter: false,
      });

      // Fail twice, succeed on third attempt
      const failThenSucceed = createFailThenSucceed(2, "expected-result");

      const result = await handler.execute(failThenSucceed);

      if (result !== "expected-result") {
        throw new Error(`Expected 'expected-result', got '${result}'`);
      }

      // Check stats recorded successful retry
      const stats = handler.getStats();
      if (stats.successfulRetries !== 1) {
        throw new Error(
          `Expected successfulRetries=1, got ${stats.successfulRetries}`
        );
      }

      logInfo("✅ P1-04 PASSED: Successful retry returns correct result");
      return { success: true };
    } catch (error) {
      logError("❌ P1-04 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST P1-05: Exponential Backoff Increases Delays
  // ============================================================================

  async function testP1_05_ExponentialBackoff() {
    logInfo("P1-05: Testing exponential backoff increases delays");

    try {
      checkRetryHandlerAvailable();

      const handler = createFreshHandler();
      handler.configure({
        initialDelay: 100,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: false, // Disable jitter for predictable testing
      });

      const delay0 = handler.calculateDelay(0);
      const delay1 = handler.calculateDelay(1);
      const delay2 = handler.calculateDelay(2);
      const delay3 = handler.calculateDelay(3);

      // Expected: 100, 200, 400, 800
      if (delay0 !== 100) {
        throw new Error(`Expected delay0=100, got ${delay0}`);
      }
      if (delay1 !== 200) {
        throw new Error(`Expected delay1=200, got ${delay1}`);
      }
      if (delay2 !== 400) {
        throw new Error(`Expected delay2=400, got ${delay2}`);
      }
      if (delay3 !== 800) {
        throw new Error(`Expected delay3=800, got ${delay3}`);
      }

      // Verify increasing pattern
      if (!(delay0 < delay1 && delay1 < delay2 && delay2 < delay3)) {
        throw new Error("Delays should be strictly increasing");
      }

      logInfo(
        "✅ P1-05 PASSED: Exponential backoff increases delays correctly"
      );
      return { success: true };
    } catch (error) {
      logError("❌ P1-05 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST P1-06: Jitter Adds Randomness
  // ============================================================================

  async function testP1_06_JitterRandomness() {
    logInfo("P1-06: Testing jitter adds randomness to delays");

    try {
      checkRetryHandlerAvailable();

      const handler = createFreshHandler();
      handler.configure({
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        jitter: true,
      });

      // Calculate delay multiple times and check for variation
      const delays = [];
      for (let i = 0; i < 10; i++) {
        delays.push(handler.calculateDelay(1));
      }

      // With jitter, we expect variation (not all the same value)
      const uniqueDelays = new Set(delays);

      // Should have some variation (at least 2 different values out of 10)
      if (uniqueDelays.size < 2) {
        throw new Error(
          `Expected variation with jitter, but all delays were: ${delays[0]}`
        );
      }

      // All delays should be within ±25% of base delay (1000 * 2 = 2000)
      const baseDelay = 2000;
      const minExpected = baseDelay * 0.75;
      const maxExpected = baseDelay * 1.25;

      for (const delay of delays) {
        if (delay < minExpected || delay > maxExpected) {
          throw new Error(
            `Delay ${delay} outside expected range [${minExpected}, ${maxExpected}]`
          );
        }
      }

      logInfo("✅ P1-06 PASSED: Jitter adds randomness to delays");
      return { success: true };
    } catch (error) {
      logError("❌ P1-06 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST P1-07: Max Delay Cap
  // ============================================================================

  async function testP1_07_MaxDelayCap() {
    logInfo("P1-07: Testing delay never exceeds maxDelay");

    try {
      checkRetryHandlerAvailable();

      const handler = createFreshHandler();
      handler.configure({
        initialDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 10, // Aggressive multiplier to hit cap quickly
        jitter: false,
      });

      // With multiplier 10: attempt 0=1000, 1=10000 (capped to 5000), etc.
      const delay0 = handler.calculateDelay(0);
      const delay1 = handler.calculateDelay(1);
      const delay2 = handler.calculateDelay(2);
      const delay5 = handler.calculateDelay(5);
      const delay10 = handler.calculateDelay(10);

      if (delay0 !== 1000) {
        throw new Error(`Expected delay0=1000, got ${delay0}`);
      }

      // All delays after 0 should be capped at 5000
      if (delay1 !== 5000) {
        throw new Error(`Expected delay1=5000 (capped), got ${delay1}`);
      }
      if (delay2 !== 5000) {
        throw new Error(`Expected delay2=5000 (capped), got ${delay2}`);
      }
      if (delay5 !== 5000) {
        throw new Error(`Expected delay5=5000 (capped), got ${delay5}`);
      }
      if (delay10 !== 5000) {
        throw new Error(`Expected delay10=5000 (capped), got ${delay10}`);
      }

      logInfo("✅ P1-07 PASSED: Delay never exceeds maxDelay");
      return { success: true };
    } catch (error) {
      logError("❌ P1-07 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST P1-08: Non-Retryable Errors Fail Immediately
  // ============================================================================

  async function testP1_08_NonRetryableImmediate() {
    logInfo("P1-08: Testing non-retryable errors fail immediately");

    try {
      checkRetryHandlerAvailable();

      const handler = createFreshHandler();
      handler.configure({
        enabled: true,
        maxRetries: 3,
        initialDelay: 10,
      });

      // Test 400 Bad Request - should not retry
      let attemptCount = 0;
      const badRequest = async () => {
        attemptCount++;
        throw createMockError({ message: "Bad request", status: 400 });
      };

      try {
        await handler.execute(badRequest);
        throw new Error("Should have thrown");
      } catch (error) {
        if (error.message === "Should have thrown") {
          throw error;
        }
      }

      if (attemptCount !== 1) {
        throw new Error(`400 error: Expected 1 attempt, got ${attemptCount}`);
      }

      // Test 401 Unauthorized - should not retry
      attemptCount = 0;
      const unauthorized = async () => {
        attemptCount++;
        throw createMockError({ message: "Unauthorized", status: 401 });
      };

      try {
        await handler.execute(unauthorized);
        throw new Error("Should have thrown");
      } catch (error) {
        if (error.message === "Should have thrown") {
          throw error;
        }
      }

      if (attemptCount !== 1) {
        throw new Error(`401 error: Expected 1 attempt, got ${attemptCount}`);
      }

      // Test 403 Forbidden - should not retry
      attemptCount = 0;
      const forbidden = async () => {
        attemptCount++;
        throw createMockError({ message: "Forbidden", status: 403 });
      };

      try {
        await handler.execute(forbidden);
        throw new Error("Should have thrown");
      } catch (error) {
        if (error.message === "Should have thrown") {
          throw error;
        }
      }

      if (attemptCount !== 1) {
        throw new Error(`403 error: Expected 1 attempt, got ${attemptCount}`);
      }

      logInfo("✅ P1-08 PASSED: Non-retryable errors fail immediately");
      return { success: true };
    } catch (error) {
      logError("❌ P1-08 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST P1-09: Abort Signal Cancels Retries
  // ============================================================================

  async function testP1_09_AbortSignalCancels() {
    logInfo("P1-09: Testing abort signal cancels retries");

    try {
      checkRetryHandlerAvailable();

      const handler = createFreshHandler();
      handler.configure({
        enabled: true,
        maxRetries: 5,
        initialDelay: 100,
        jitter: false,
      });

      const controller = new AbortController();
      let attemptCount = 0;

      const slowFailure = async () => {
        attemptCount++;
        if (attemptCount === 2) {
          // Abort after second attempt
          controller.abort();
        }
        throw createMockError({ message: "Network error", status: 503 });
      };

      let wasAborted = false;
      try {
        await handler.execute(slowFailure, {}, controller.signal);
        throw new Error("Should have thrown");
      } catch (error) {
        if (error.name === "AbortError") {
          wasAborted = true;
        } else if (error.message === "Should have thrown") {
          throw error;
        }
      }

      if (!wasAborted) {
        throw new Error("Expected AbortError to be thrown");
      }

      // Should have stopped before all 5 retries
      if (attemptCount >= 5) {
        throw new Error(
          `Expected fewer than 5 attempts due to abort, got ${attemptCount}`
        );
      }

      logInfo("✅ P1-09 PASSED: Abort signal cancels retries");
      return { success: true };
    } catch (error) {
      logError("❌ P1-09 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST P1-10: onRetry Callback Invoked
  // ============================================================================

  async function testP1_10_OnRetryCallback() {
    logInfo("P1-10: Testing onRetry callback is invoked with correct args");

    try {
      checkRetryHandlerAvailable();

      const handler = createFreshHandler();

      const callbackCalls = [];
      handler.configure({
        enabled: true,
        maxRetries: 2,
        initialDelay: 10,
        jitter: false,
        onRetry: (attempt, delay, error) => {
          callbackCalls.push({ attempt, delay, error: error.message });
        },
      });

      const failThenSucceed = createFailThenSucceed(2, "success");

      await handler.execute(failThenSucceed);

      // Should have been called twice (for attempts before success)
      if (callbackCalls.length !== 2) {
        throw new Error(
          `Expected 2 callback calls, got ${callbackCalls.length}`
        );
      }

      // Check first callback
      if (callbackCalls[0].attempt !== 1) {
        throw new Error(
          `First callback attempt should be 1, got ${callbackCalls[0].attempt}`
        );
      }

      // Check second callback
      if (callbackCalls[1].attempt !== 2) {
        throw new Error(
          `Second callback attempt should be 2, got ${callbackCalls[1].attempt}`
        );
      }

      // Delays should be provided
      if (
        typeof callbackCalls[0].delay !== "number" ||
        callbackCalls[0].delay <= 0
      ) {
        throw new Error("First callback should have positive delay");
      }

      // Error message should be provided
      if (!callbackCalls[0].error) {
        throw new Error("Callback should receive error message");
      }

      logInfo("✅ P1-10 PASSED: onRetry callback invoked with correct args");
      return { success: true };
    } catch (error) {
      logError("❌ P1-10 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST P1-11: Statistics Tracked Correctly
  // ============================================================================

  async function testP1_11_StatisticsTracked() {
    logInfo("P1-11: Testing statistics are tracked correctly");

    try {
      checkRetryHandlerAvailable();

      const handler = createFreshHandler();
      handler.configure({
        enabled: true,
        maxRetries: 2,
        initialDelay: 10,
        jitter: false,
      });
      handler.resetStats();

      // Test 1: Successful retry
      const failOnce = createFailThenSucceed(1, "success");
      await handler.execute(failOnce);

      let stats = handler.getStats();
      if (stats.totalRetries !== 1) {
        throw new Error(`Expected totalRetries=1, got ${stats.totalRetries}`);
      }
      if (stats.successfulRetries !== 1) {
        throw new Error(
          `Expected successfulRetries=1, got ${stats.successfulRetries}`
        );
      }

      // Test 2: Failed after retries
      const alwaysFail = createAlwaysFail({ status: 503 });
      try {
        await handler.execute(alwaysFail);
      } catch (error) {
        // Expected
      }

      stats = handler.getStats();
      if (stats.totalRetries !== 3) {
        // 1 from before + 2 from this attempt
        throw new Error(`Expected totalRetries=3, got ${stats.totalRetries}`);
      }
      if (stats.failedAfterRetries !== 1) {
        throw new Error(
          `Expected failedAfterRetries=1, got ${stats.failedAfterRetries}`
        );
      }

      // Test 3: Reset stats
      handler.resetStats();
      stats = handler.getStats();
      if (
        stats.totalRetries !== 0 ||
        stats.successfulRetries !== 0 ||
        stats.failedAfterRetries !== 0
      ) {
        throw new Error("resetStats() should clear all statistics");
      }

      logInfo("✅ P1-11 PASSED: Statistics tracked correctly");
      return { success: true };
    } catch (error) {
      logError("❌ P1-11 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST P1-12: Integration Ready (Works with OpenRouterEmbed Pattern)
  // ============================================================================

  async function testP1_12_IntegrationReady() {
    logInfo(
      "P1-12: Testing integration readiness with OpenRouterEmbed pattern"
    );

    try {
      checkRetryHandlerAvailable();

      const handler = createFreshHandler();
      handler.configure({
        enabled: true,
        maxRetries: 2,
        initialDelay: 10,
        jitter: false,
      });

      // Simulate how OpenRouterEmbed would use the retry handler
      // This mimics wrapping a fetch call
      let requestCount = 0;
      const mockApiCall = async () => {
        requestCount++;
        if (requestCount <= 1) {
          // First request fails with rate limit
          const error = new Error("Rate limited");
          error.status = 429;
          throw error;
        }
        // Second request succeeds
        return {
          text: "AI response",
          model: "test-model",
          usage: { total_tokens: 100 },
        };
      };

      // Execute with retry - simulating OpenRouterEmbed.sendRequest
      const response = await handler.execute(mockApiCall);

      // Verify response structure
      if (!response.text || response.text !== "AI response") {
        throw new Error("Response should contain expected text");
      }

      // Verify retry occurred
      if (requestCount !== 2) {
        throw new Error(`Expected 2 requests (1 retry), got ${requestCount}`);
      }

      // Test that getConfig returns expected structure
      const config = handler.getConfig();
      if (typeof config.enabled !== "boolean") {
        throw new Error("Config should have enabled property");
      }
      if (typeof config.maxRetries !== "number") {
        throw new Error("Config should have maxRetries property");
      }

      logInfo(
        "✅ P1-12 PASSED: Integration ready with OpenRouterEmbed pattern"
      );
      return { success: true };
    } catch (error) {
      logError("❌ P1-12 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // RUN ALL PHASE 1 TESTS
  // ============================================================================

  async function runAllStage6Phase1Tests() {
    console.clear();
    console.log(
      "╔═══════════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║  OpenRouter Embed - Stage 6 Phase 1: Retry with Backoff Tests    ║"
    );
    console.log(
      "╚═══════════════════════════════════════════════════════════════════╝\n"
    );

    const results = {};

    results["P1-01"] = await testP1_01_ModuleExists();
    results["P1-02"] = await testP1_02_DisabledNoRetry();
    results["P1-03"] = await testP1_03_EnabledRetries();
    results["P1-04"] = await testP1_04_SuccessfulRetry();
    results["P1-05"] = await testP1_05_ExponentialBackoff();
    results["P1-06"] = await testP1_06_JitterRandomness();
    results["P1-07"] = await testP1_07_MaxDelayCap();
    results["P1-08"] = await testP1_08_NonRetryableImmediate();
    results["P1-09"] = await testP1_09_AbortSignalCancels();
    results["P1-10"] = await testP1_10_OnRetryCallback();
    results["P1-11"] = await testP1_11_StatisticsTracked();
    results["P1-12"] = await testP1_12_IntegrationReady();

    // Summary
    const passed = Object.values(results).filter((r) => r.success).length;
    const total = Object.keys(results).length;

    console.log("\n" + "═".repeat(68));
    console.log("📊 STAGE 6 PHASE 1 TEST RESULTS");
    console.log("═".repeat(68) + "\n");

    Object.entries(results).forEach(([name, result]) => {
      console.log(`${result.success ? "✅" : "❌"} ${name}`);
    });

    console.log(`\nResults: ${passed}/${total} tests passed`);
    console.log("═".repeat(68));

    if (passed === total) {
      console.log("✅ 🎉 STAGE 6 PHASE 1 COMPLETE!");
      console.log("    Retry with Exponential Backoff is ready!\n");
    } else {
      console.log("❌ Some tests failed. Review output above.\n");
    }

    return { success: passed === total, results, passed, total };
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  // Expose test runner
  window.runAllStage6Phase1Tests = runAllStage6Phase1Tests;

  // Expose individual tests for debugging
  window.testP1_01_ModuleExists = testP1_01_ModuleExists;
  window.testP1_02_DisabledNoRetry = testP1_02_DisabledNoRetry;
  window.testP1_03_EnabledRetries = testP1_03_EnabledRetries;
  window.testP1_04_SuccessfulRetry = testP1_04_SuccessfulRetry;
  window.testP1_05_ExponentialBackoff = testP1_05_ExponentialBackoff;
  window.testP1_06_JitterRandomness = testP1_06_JitterRandomness;
  window.testP1_07_MaxDelayCap = testP1_07_MaxDelayCap;
  window.testP1_08_NonRetryableImmediate = testP1_08_NonRetryableImmediate;
  window.testP1_09_AbortSignalCancels = testP1_09_AbortSignalCancels;
  window.testP1_10_OnRetryCallback = testP1_10_OnRetryCallback;
  window.testP1_11_StatisticsTracked = testP1_11_StatisticsTracked;
  window.testP1_12_IntegrationReady = testP1_12_IntegrationReady;

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================
})();
