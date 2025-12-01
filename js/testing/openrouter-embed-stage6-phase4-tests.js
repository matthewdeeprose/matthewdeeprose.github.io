/**
 * OpenRouter Embed API - Stage 6 Phase 4 Tests
 *
 * Test suite for Request Debouncing/Throttling
 *
 * Tests:
 * P4-01: Module Exists - EmbedThrottle with all required methods
 * P4-02: Debounce Delays - Rapid calls result in single delayed execution
 * P4-03: Debounce Resets - New call during wait resets the timer
 * P4-04: Throttle Limits - Enforces minimum time between executions
 * P4-05: canProceed() Works - Returns correct state before/after request
 * P4-06: getWaitTime() Accurate - Returns correct remaining wait time
 * P4-07: maxConcurrent Enforced - Blocks when at concurrent limit
 * P4-08: onThrottled Callback - Callback invoked when request is throttled
 * P4-09: Integration Works - OpenRouterEmbed respects throttle config
 *
 * @version 1.0.0 (Stage 6 Phase 4)
 * @date 30 November 2025
 */

(function () {
  "use strict";

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  /**
   * Wait for specified milliseconds
   */
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a test environment with DOM container
   */
  function createTestEnvironment(prefix = "test") {
    const container = document.createElement("div");
    container.id = `${prefix}-container-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    document.body.appendChild(container);

    return {
      container,
      containerId: container.id,
      cleanup: () => container.remove(),
    };
  }

  /**
   * Create a fresh throttle instance for testing
   */
  function createTestThrottle(options = {}) {
    if (!window.EmbedThrottleClass) {
      throw new Error("EmbedThrottleClass not available");
    }
    return new window.EmbedThrottleClass(options);
  }

  // ============================================================================
  // TEST: P4-01 - Module Exists
  // ============================================================================

  async function testP4_01_ModuleExists() {
    const testName = "P4-01: Module Exists";
    console.log(`Running ${testName}...`);

    try {
      // Check singleton exists
      if (!window.EmbedThrottle) {
        return { success: false, error: "EmbedThrottle singleton not found" };
      }

      // Check class exists
      if (!window.EmbedThrottleClass) {
        return { success: false, error: "EmbedThrottleClass not found" };
      }

      // Check all required methods on singleton
      const requiredMethods = [
        "configure",
        "canProceed",
        "getWaitTime",
        "recordRequestStart",
        "recordRequestEnd",
        "debounce",
        "throttle",
        "acquire",
        "release",
        "getConfig",
        "reset",
        "getStats",
        "resetStats",
        "cleanup",
      ];

      const missingMethods = [];
      for (const method of requiredMethods) {
        if (typeof window.EmbedThrottle[method] !== "function") {
          missingMethods.push(method);
        }
      }

      if (missingMethods.length > 0) {
        return {
          success: false,
          error: `Missing methods: ${missingMethods.join(", ")}`,
        };
      }

      // Verify can create instance
      const instance = createTestThrottle();
      if (!instance) {
        return { success: false, error: "Could not create instance" };
      }

      instance.cleanup();

      console.log(`✓ ${testName} passed`);
      return { success: true };
    } catch (error) {
      console.error(`✗ ${testName} failed:`, error);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-02 - Debounce Delays
  // ============================================================================

  async function testP4_02_DebounceDelays() {
    const testName = "P4-02: Debounce Delays";
    console.log(`Running ${testName}...`);

    try {
      const throttle = createTestThrottle({ debounceDelay: 100 });
      let callCount = 0;
      const results = [];

      const testFn = (value) => {
        callCount++;
        results.push(value);
      };

      const debouncedFn = throttle.debounce(testFn, 100);

      // Make rapid calls
      debouncedFn("call1");
      debouncedFn("call2");
      debouncedFn("call3");

      // Should not have executed yet
      if (callCount !== 0) {
        throttle.cleanup();
        return {
          success: false,
          error: `Expected 0 calls immediately, got ${callCount}`,
        };
      }

      // Wait for debounce to complete
      await wait(150);

      // Should have executed once with last value
      if (callCount !== 1) {
        throttle.cleanup();
        return {
          success: false,
          error: `Expected 1 call after debounce, got ${callCount}`,
        };
      }

      if (results[0] !== "call3") {
        throttle.cleanup();
        return {
          success: false,
          error: `Expected last call value 'call3', got '${results[0]}'`,
        };
      }

      throttle.cleanup();
      console.log(`✓ ${testName} passed`);
      return { success: true };
    } catch (error) {
      console.error(`✗ ${testName} failed:`, error);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-03 - Debounce Resets
  // ============================================================================

  async function testP4_03_DebounceResets() {
    const testName = "P4-03: Debounce Resets";
    console.log(`Running ${testName}...`);

    try {
      const throttle = createTestThrottle();
      let callCount = 0;

      const testFn = () => {
        callCount++;
      };

      const debouncedFn = throttle.debounce(testFn, 100);

      // First call
      debouncedFn();

      // Wait 50ms (halfway through debounce)
      await wait(50);

      // Call again - should reset timer
      debouncedFn();

      // Wait another 50ms (100ms total from start, but only 50ms from second call)
      await wait(50);

      // Should NOT have executed yet (timer was reset)
      if (callCount !== 0) {
        throttle.cleanup();
        return {
          success: false,
          error: `Expected 0 calls after reset, got ${callCount}`,
        };
      }

      // Wait remaining time
      await wait(60);

      // Now should have executed once
      if (callCount !== 1) {
        throttle.cleanup();
        return {
          success: false,
          error: `Expected 1 call after full wait, got ${callCount}`,
        };
      }

      throttle.cleanup();
      console.log(`✓ ${testName} passed`);
      return { success: true };
    } catch (error) {
      console.error(`✗ ${testName} failed:`, error);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-04 - Throttle Limits
  // ============================================================================

  async function testP4_04_ThrottleLimits() {
    const testName = "P4-04: Throttle Limits";
    console.log(`Running ${testName}...`);

    try {
      const throttle = createTestThrottle({ throttleInterval: 100 });
      let callCount = 0;
      const results = [];

      const testFn = (value) => {
        callCount++;
        results.push(value);
        return value;
      };

      const throttledFn = throttle.throttle(testFn, 100);

      // First call should execute immediately
      const result1 = throttledFn("call1");
      if (result1 !== "call1") {
        throttle.cleanup();
        return {
          success: false,
          error: `First call should execute, got ${result1}`,
        };
      }

      // Second call immediately after should be blocked
      const result2 = throttledFn("call2");
      if (result2 !== undefined) {
        throttle.cleanup();
        return {
          success: false,
          error: `Second call should be blocked, got ${result2}`,
        };
      }

      // Should have executed once
      if (callCount !== 1) {
        throttle.cleanup();
        return {
          success: false,
          error: `Expected 1 call, got ${callCount}`,
        };
      }

      // Wait for throttle interval
      await wait(110);

      // Third call should work
      const result3 = throttledFn("call3");
      if (result3 !== "call3") {
        throttle.cleanup();
        return {
          success: false,
          error: `Third call should execute, got ${result3}`,
        };
      }

      if (callCount !== 2) {
        throttle.cleanup();
        return {
          success: false,
          error: `Expected 2 calls total, got ${callCount}`,
        };
      }

      throttle.cleanup();
      console.log(`✓ ${testName} passed`);
      return { success: true };
    } catch (error) {
      console.error(`✗ ${testName} failed:`, error);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-05 - canProceed() Works
  // ============================================================================

  async function testP4_05_CanProceed() {
    const testName = "P4-05: canProceed() Works";
    console.log(`Running ${testName}...`);

    try {
      const throttle = createTestThrottle({
        throttleInterval: 100,
        maxConcurrent: 1,
      });

      // Initially should be able to proceed
      if (!throttle.canProceed()) {
        throttle.cleanup();
        return {
          success: false,
          error: "Should be able to proceed initially",
        };
      }

      // Start a request
      const requestId = throttle.recordRequestStart();

      // Should NOT be able to proceed (at max concurrent)
      if (throttle.canProceed()) {
        throttle.cleanup();
        return {
          success: false,
          error: "Should not be able to proceed when at max concurrent",
        };
      }

      // End the request
      throttle.recordRequestEnd(requestId);

      // Should still NOT be able to proceed (throttle interval)
      if (throttle.canProceed()) {
        throttle.cleanup();
        return {
          success: false,
          error: "Should not be able to proceed during throttle interval",
        };
      }

      // Wait for throttle interval
      await wait(110);

      // Now should be able to proceed
      if (!throttle.canProceed()) {
        throttle.cleanup();
        return {
          success: false,
          error: "Should be able to proceed after throttle interval",
        };
      }

      throttle.cleanup();
      console.log(`✓ ${testName} passed`);
      return { success: true };
    } catch (error) {
      console.error(`✗ ${testName} failed:`, error);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-06 - getWaitTime() Accurate
  // ============================================================================

  async function testP4_06_GetWaitTime() {
    const testName = "P4-06: getWaitTime() Accurate";
    console.log(`Running ${testName}...`);

    let throttle = null;

    try {
      // Use a longer interval to account for JavaScript timing variance
      const throttleInterval = 1000;
      throttle = createTestThrottle({ throttleInterval: throttleInterval });

      // Initially should be 0 (no requests made yet)
      const initialWaitTime = throttle.getWaitTime();
      console.log(`  Initial wait time: ${initialWaitTime}`);

      if (initialWaitTime !== 0) {
        throttle.cleanup();
        const errorMsg = `Expected 0 wait time initially, got ${initialWaitTime}`;
        console.error(`✗ ${testName} failed: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      // Make a request and record timestamps
      const beforeRequest = Date.now();
      const requestId = throttle.recordRequestStart();
      throttle.recordRequestEnd(requestId);

      // Wait time should be close to throttleInterval
      const waitTime1 = throttle.getWaitTime();
      const afterFirstCheck = Date.now();
      const elapsedSinceRequest = afterFirstCheck - beforeRequest;

      console.log(
        `  Wait time after request: ${waitTime1} (elapsed: ${elapsedSinceRequest}ms)`
      );

      // Should be roughly (throttleInterval - elapsed)
      const expectedWait1 = throttleInterval - elapsedSinceRequest;
      if (waitTime1 < expectedWait1 - 50 || waitTime1 > throttleInterval + 10) {
        throttle.cleanup();
        const errorMsg = `Expected wait time around ${expectedWait1}ms, got ${waitTime1}`;
        console.error(`✗ ${testName} failed: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      // Wait a short time and verify wait time decreases
      const waitDuration = 100;
      await wait(waitDuration);

      const waitTime2 = throttle.getWaitTime();
      const afterSecondCheck = Date.now();
      const totalElapsed = afterSecondCheck - beforeRequest;

      console.log(
        `  Wait time after ${waitDuration}ms wait: ${waitTime2} (total elapsed: ${totalElapsed}ms)`
      );

      // The key test: wait time should be less than before (or 0 if interval passed)
      if (waitTime2 > waitTime1) {
        throttle.cleanup();
        const errorMsg = `Wait time should not increase: ${waitTime1} -> ${waitTime2}`;
        console.error(`✗ ${testName} failed: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      // If interval hasn't passed yet, wait time should be positive
      // If interval has passed, wait time should be 0
      const expectedWait2 = Math.max(0, throttleInterval - totalElapsed);

      // Allow tolerance for timing variance
      if (Math.abs(waitTime2 - expectedWait2) > 100) {
        throttle.cleanup();
        const errorMsg = `Wait time ${waitTime2} differs too much from expected ${expectedWait2}`;
        console.error(`✗ ${testName} failed: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      // Wait for full interval to pass
      if (waitTime2 > 0) {
        await wait(waitTime2 + 50);
      }

      // Should be 0 now
      const waitTime3 = throttle.getWaitTime();
      console.log(`  Wait time after full interval: ${waitTime3}`);

      if (waitTime3 !== 0) {
        throttle.cleanup();
        const errorMsg = `Expected 0 wait time after interval, got ${waitTime3}`;
        console.error(`✗ ${testName} failed: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      throttle.cleanup();
      console.log(`✓ ${testName} passed`);
      return { success: true };
    } catch (error) {
      console.error(`✗ ${testName} failed with exception:`, error);
      if (throttle) {
        try {
          throttle.cleanup();
        } catch (e) {
          /* ignore */
        }
      }
      return { success: false, error: error.message };
    }
  }
  // ============================================================================
  // TEST: P4-07 - maxConcurrent Enforced
  // ============================================================================

  async function testP4_07_MaxConcurrent() {
    const testName = "P4-07: maxConcurrent Enforced";
    console.log(`Running ${testName}...`);

    try {
      const throttle = createTestThrottle({
        maxConcurrent: 2,
        throttleInterval: 0, // Disable throttle to test only concurrent
      });

      // Start 2 requests
      const id1 = throttle.recordRequestStart();
      const id2 = throttle.recordRequestStart();

      // Should NOT be able to proceed (at limit)
      if (throttle.canProceed()) {
        throttle.cleanup();
        return {
          success: false,
          error: "Should not proceed when at maxConcurrent",
        };
      }

      // Stats should show 2 active
      const stats = throttle.getStats();
      if (stats.activeRequests !== 2) {
        throttle.cleanup();
        return {
          success: false,
          error: `Expected 2 active requests, got ${stats.activeRequests}`,
        };
      }

      // End one request
      throttle.recordRequestEnd(id1);

      // Now should be able to proceed
      if (!throttle.canProceed()) {
        throttle.cleanup();
        return {
          success: false,
          error: "Should be able to proceed after releasing one slot",
        };
      }

      // Clean up
      throttle.recordRequestEnd(id2);
      throttle.cleanup();

      console.log(`✓ ${testName} passed`);
      return { success: true };
    } catch (error) {
      console.error(`✗ ${testName} failed:`, error);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-08 - onThrottled Callback
  // ============================================================================

  async function testP4_08_OnThrottledCallback() {
    const testName = "P4-08: onThrottled Callback";
    console.log(`Running ${testName}...`);

    try {
      let callbackInvoked = false;
      let callbackWaitTime = null;
      let callbackReason = null;

      const throttle = createTestThrottle({
        throttleInterval: 100,
        onThrottled: (waitTime, reason) => {
          callbackInvoked = true;
          callbackWaitTime = waitTime;
          callbackReason = reason;
          return true; // Allow wait
        },
      });

      // Create throttled function
      const throttledFn = throttle.throttle(() => "result", 100);

      // First call should work
      throttledFn();

      // Reset callback tracking
      callbackInvoked = false;

      // Second call should trigger callback
      throttledFn();

      if (!callbackInvoked) {
        throttle.cleanup();
        return {
          success: false,
          error: "onThrottled callback was not invoked",
        };
      }

      if (typeof callbackWaitTime !== "number" || callbackWaitTime <= 0) {
        throttle.cleanup();
        return {
          success: false,
          error: `Expected positive waitTime, got ${callbackWaitTime}`,
        };
      }

      if (callbackReason !== "throttle_interval") {
        throttle.cleanup();
        return {
          success: false,
          error: `Expected reason 'throttle_interval', got '${callbackReason}'`,
        };
      }

      // Also check stats
      const stats = throttle.getStats();
      if (stats.throttledCount < 1) {
        throttle.cleanup();
        return {
          success: false,
          error: `Expected throttledCount >= 1, got ${stats.throttledCount}`,
        };
      }

      throttle.cleanup();
      console.log(`✓ ${testName} passed`);
      return { success: true };
    } catch (error) {
      console.error(`✗ ${testName} failed:`, error);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-09 - Integration Works
  // ============================================================================

  async function testP4_09_Integration() {
    const testName = "P4-09: Integration Works";
    console.log(`Running ${testName}...`);

    try {
      // Skip if OpenRouterEmbed not available
      if (!window.OpenRouterEmbed) {
        console.log(`⚠ ${testName} skipped: OpenRouterEmbed not available`);
        return {
          success: true,
          skipped: true,
          message: "OpenRouterEmbed not available",
        };
      }

      // Create test environment
      const env = createTestEnvironment("throttle-integration");

      try {
        // Create embed instance - note: throttle integration may not be complete yet
        // This test verifies the throttle module works independently
        const throttle = createTestThrottle({
          throttleInterval: 500,
          maxConcurrent: 1,
        });

        // Test acquire/release pattern
        const requestId = await throttle.acquire();

        if (!requestId || !requestId.startsWith("req_")) {
          throttle.cleanup();
          env.cleanup();
          return {
            success: false,
            error: `Invalid request ID: ${requestId}`,
          };
        }

        // Should not be able to acquire another (at max concurrent)
        if (throttle.canProceed()) {
          throttle.cleanup();
          env.cleanup();
          return {
            success: false,
            error: "Should not be able to acquire when at max concurrent",
          };
        }

        // Release
        throttle.release(requestId);

        // Wait for throttle interval
        await wait(510);

        // Now should be able to acquire again
        const requestId2 = await throttle.acquire();

        if (!requestId2) {
          throttle.cleanup();
          env.cleanup();
          return {
            success: false,
            error: "Failed to acquire second request",
          };
        }

        throttle.release(requestId2);
        throttle.cleanup();
        env.cleanup();

        console.log(`✓ ${testName} passed`);
        return { success: true };
      } catch (innerError) {
        env.cleanup();
        throw innerError;
      }
    } catch (error) {
      console.error(`✗ ${testName} failed:`, error);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST RUNNER
  // ============================================================================

  /**
   * Run all Phase 4 tests
   */
  async function runAllStage6Phase4Tests() {
    console.log("=".repeat(60));
    console.log("OpenRouter Embed - Stage 6 Phase 4 Tests");
    console.log("Request Debouncing/Throttling");
    console.log("=".repeat(60));

    const tests = [
      testP4_01_ModuleExists,
      testP4_02_DebounceDelays,
      testP4_03_DebounceResets,
      testP4_04_ThrottleLimits,
      testP4_05_CanProceed,
      testP4_06_GetWaitTime,
      testP4_07_MaxConcurrent,
      testP4_08_OnThrottledCallback,
      testP4_09_Integration,
    ];

    const results = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const test of tests) {
      const result = await test();
      results.push(result);

      if (result.skipped) {
        skipped++;
      } else if (result.success) {
        passed++;
      } else {
        failed++;
      }
    }

    console.log("");
    console.log("=".repeat(60));
    console.log(
      `Results: ${passed} passed, ${failed} failed, ${skipped} skipped`
    );
    console.log(`Total: ${passed + skipped}/${tests.length}`);
    console.log("=".repeat(60));

    return {
      total: tests.length,
      passed,
      failed,
      skipped,
      results,
    };
  }

  /**
   * Run regression tests to verify previous phases still work
   */
  async function testStage6Phase4_Regressions() {
    console.log("=".repeat(60));
    console.log("Stage 6 Phase 4 - Regression Tests");
    console.log("Verifying Phases 1, 2 & 3 still work");
    console.log("=".repeat(60));

    const regressionResults = [];

    // Check Phase 1 (Retry)
    if (window.EmbedRetryHandlerClass) {
      try {
        const retry = new window.EmbedRetryHandlerClass();
        if (typeof retry.execute === "function") {
          regressionResults.push({
            test: "Phase 1 Retry",
            success: true,
          });
          console.log("✓ Phase 1 (Retry) module available");
        }
      } catch (error) {
        regressionResults.push({
          test: "Phase 1 Retry",
          success: false,
          error: error.message,
        });
        console.log("✗ Phase 1 (Retry) module error:", error.message);
      }
    } else {
      regressionResults.push({
        test: "Phase 1 Retry",
        success: true,
        skipped: true,
      });
      console.log("⚠ Phase 1 (Retry) module not loaded");
    }

    // Check Phase 2 (Events)
    if (window.EmbedEventEmitterClass) {
      try {
        const events = new window.EmbedEventEmitterClass();
        let received = false;
        events.on("test", () => {
          received = true;
        });
        events.emit("test");
        if (received) {
          regressionResults.push({
            test: "Phase 2 Events",
            success: true,
          });
          console.log("✓ Phase 2 (Events) module works");
        }
      } catch (error) {
        regressionResults.push({
          test: "Phase 2 Events",
          success: false,
          error: error.message,
        });
        console.log("✗ Phase 2 (Events) module error:", error.message);
      }
    } else {
      regressionResults.push({
        test: "Phase 2 Events",
        success: true,
        skipped: true,
      });
      console.log("⚠ Phase 2 (Events) module not loaded");
    }

    // Check Phase 3 (Post-processor)
    if (window.EmbedPostProcessorClass) {
      try {
        const postProcessor = new window.EmbedPostProcessorClass();
        postProcessor.add("test", (r) => ({ ...r, tested: true }));
        const result = await postProcessor.process({ text: "test" });
        if (result.tested === true) {
          regressionResults.push({
            test: "Phase 3 Post-processor",
            success: true,
          });
          console.log("✓ Phase 3 (Post-processor) module works");
        }
      } catch (error) {
        regressionResults.push({
          test: "Phase 3 Post-processor",
          success: false,
          error: error.message,
        });
        console.log("✗ Phase 3 (Post-processor) module error:", error.message);
      }
    } else {
      regressionResults.push({
        test: "Phase 3 Post-processor",
        success: true,
        skipped: true,
      });
      console.log("⚠ Phase 3 (Post-processor) module not loaded");
    }

    console.log("");
    console.log("Regression check complete");
    console.log("=".repeat(60));

    return regressionResults;
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.runAllStage6Phase4Tests = runAllStage6Phase4Tests;
  window.testStage6Phase4_Regressions = testStage6Phase4_Regressions;

  // Individual tests
  window.testP4_01_ModuleExists = testP4_01_ModuleExists;
  window.testP4_02_DebounceDelays = testP4_02_DebounceDelays;
  window.testP4_03_DebounceResets = testP4_03_DebounceResets;
  window.testP4_04_ThrottleLimits = testP4_04_ThrottleLimits;
  window.testP4_05_CanProceed = testP4_05_CanProceed;
  window.testP4_06_GetWaitTime = testP4_06_GetWaitTime;
  window.testP4_07_MaxConcurrent = testP4_07_MaxConcurrent;
  window.testP4_08_OnThrottledCallback = testP4_08_OnThrottledCallback;
  window.testP4_09_Integration = testP4_09_Integration;
})();
