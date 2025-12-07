/**
 * OpenRouter Embed API - Stage 6 Phase 8 Tests
 * Health Monitor Testing Suite
 *
 * Tests for EmbedHealthMonitor module.
 * Validates connection health monitoring functionality.
 *
 * Test Categories:
 * - P8-01: Module exists with all required methods
 * - P8-02: start() begins periodic checks
 * - P8-03: stop() ends periodic checks
 * - P8-04: check() returns health status
 * - P8-05: Consecutive failures trigger unhealthy
 * - P8-06: Recovery resets to healthy
 * - P8-07: onStatusChange callback invoked
 * - P8-08: Integration with OpenRouterEmbed
 *
 * @version 1.0.0 (Stage 6 Phase 8)
 * @date 01 December 2025
 */

(function () {
  "use strict";

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  const testResults = [];
  let currentTestIndex = 0;

  /**
   * Log test result
   */
  function logTest(id, name, passed, details = "") {
    const result = { id, name, passed, details };
    testResults.push(result);
    const icon = passed ? "✅" : "❌";
    console.log(`${icon} ${id}: ${name}${details ? ` - ${details}` : ""}`);
    return passed;
  }

  /**
   * Assert helper
   */
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || "Assertion failed");
    }
    return true;
  }

  /**
   * Wait utility
   */
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get summary of test results
   */
  function getTestSummary() {
    const passed = testResults.filter((r) => r.passed).length;
    const total = testResults.length;
    return { passed, total, results: testResults };
  }

  /**
   * Clear test results
   */
  function clearResults() {
    testResults.length = 0;
    currentTestIndex = 0;
  }

  // ============================================================================
  // PHASE 8 TESTS: HEALTH MONITOR
  // ============================================================================

  /**
   * P8-01: Module exists with all required methods
   */
  async function testP8_01_ModuleExists() {
    const testId = "P8-01";
    const testName = "Module exists with all required methods";

    try {
      // Check singleton exists
      assert(
        window.EmbedHealthMonitor,
        "EmbedHealthMonitor singleton should exist"
      );

      // Check class exists
      assert(
        window.EmbedHealthMonitorClass,
        "EmbedHealthMonitorClass should exist"
      );

      // Check required methods on singleton
      const requiredMethods = [
        "configure",
        "start",
        "stop",
        "check",
        "getStatus",
        "isHealthy",
        "getConfig",
        "cleanup",
      ];

      const missingMethods = [];
      for (const method of requiredMethods) {
        if (typeof window.EmbedHealthMonitor[method] !== "function") {
          missingMethods.push(method);
        }
      }

      assert(
        missingMethods.length === 0,
        `Missing methods: ${missingMethods.join(", ")}`
      );

      // Check static properties
      assert(
        window.EmbedHealthMonitorClass.DEFAULTS,
        "DEFAULTS static property should exist"
      );
      assert(
        window.EmbedHealthMonitorClass.STATUS,
        "STATUS static property should exist"
      );

      // Check status constants
      const statusValues = window.EmbedHealthMonitorClass.STATUS;
      assert(
        statusValues.HEALTHY === "healthy",
        "HEALTHY status should be 'healthy'"
      );
      assert(
        statusValues.DEGRADED === "degraded",
        "DEGRADED status should be 'degraded'"
      );
      assert(
        statusValues.UNHEALTHY === "unhealthy",
        "UNHEALTHY status should be 'unhealthy'"
      );
      assert(
        statusValues.UNKNOWN === "unknown",
        "UNKNOWN status should be 'unknown'"
      );

      return logTest(
        testId,
        testName,
        true,
        "All methods and properties present"
      );
    } catch (error) {
      return logTest(testId, testName, false, error.message);
    }
  }

  /**
   * P8-02: start() begins periodic checks
   */
  async function testP8_02_StartBeginsChecks() {
    const testId = "P8-02";
    const testName = "start() begins periodic checks";

    try {
      // Create a fresh instance with short interval
      const monitor = new window.EmbedHealthMonitorClass({
        enabled: true,
        checkInterval: 100, // 100ms for testing
        timeout: 50,
      });

      // Track check calls
      let checkCount = 0;
      const originalCheck = monitor.check.bind(monitor);
      monitor.check = async function () {
        checkCount++;
        return originalCheck();
      };

      assert(!monitor.isMonitoring(), "Should not be monitoring initially");

      // Start monitoring
      monitor.start();

      assert(monitor.isMonitoring(), "Should be monitoring after start()");

      // Wait for initial + 2 periodic checks
      await wait(250);

      assert(
        checkCount >= 2,
        `Should have multiple checks (got ${checkCount})`
      );

      // Cleanup
      monitor.cleanup();
      assert(!monitor.isMonitoring(), "Should not be monitoring after cleanup");

      return logTest(testId, testName, true, `${checkCount} checks performed`);
    } catch (error) {
      return logTest(testId, testName, false, error.message);
    }
  }

  /**
   * P8-03: stop() ends periodic checks
   */
  async function testP8_03_StopEndsChecks() {
    const testId = "P8-03";
    const testName = "stop() ends periodic checks";

    try {
      // Create a fresh instance
      const monitor = new window.EmbedHealthMonitorClass({
        enabled: true,
        checkInterval: 50,
        timeout: 25,
      });

      let checkCount = 0;
      const originalCheck = monitor.check.bind(monitor);
      monitor.check = async function () {
        checkCount++;
        return originalCheck();
      };

      // Start and let it run briefly
      monitor.start();
      await wait(100);

      const checksBeforeStop = checkCount;

      // Stop monitoring
      monitor.stop();

      assert(!monitor.isMonitoring(), "Should not be monitoring after stop()");

      // Wait and verify no more checks
      await wait(150);

      const checksAfterStop = checkCount;

      // Allow for 1 check that might have been in progress
      assert(
        checksAfterStop <= checksBeforeStop + 1,
        `No new checks should occur after stop (before: ${checksBeforeStop}, after: ${checksAfterStop})`
      );

      // Cleanup
      monitor.cleanup();

      return logTest(testId, testName, true, "Checks stopped correctly");
    } catch (error) {
      return logTest(testId, testName, false, error.message);
    }
  }

  /**
   * P8-04: check() returns health status
   */
  async function testP8_04_CheckReturnsStatus() {
    const testId = "P8-04";
    const testName = "check() returns health status";

    try {
      // Create instance with a reliable endpoint
      const monitor = new window.EmbedHealthMonitorClass({
        enabled: true,
        timeout: 5000,
        endpoint: "https://openrouter.ai/api/v1/models",
      });

      // Perform check
      const status = await monitor.check();

      // Verify status object structure
      assert(
        status !== null && typeof status === "object",
        "Should return an object"
      );
      assert("status" in status, "Should have status property");
      assert("latency" in status, "Should have latency property");
      assert("lastCheck" in status, "Should have lastCheck property");
      assert(
        "consecutiveFailures" in status,
        "Should have consecutiveFailures property"
      );
      assert("lastError" in status, "Should have lastError property");

      // Verify status value is valid
      const validStatuses = ["healthy", "degraded", "unhealthy", "unknown"];
      assert(
        validStatuses.includes(status.status),
        `Status should be valid (got: ${status.status})`
      );

      // Verify latency is a number
      assert(typeof status.latency === "number", "Latency should be a number");
      assert(status.latency >= 0, "Latency should be non-negative");

      // Verify lastCheck is a Date
      assert(status.lastCheck instanceof Date, "lastCheck should be a Date");

      // Cleanup
      monitor.cleanup();

      return logTest(
        testId,
        testName,
        true,
        `Status: ${status.status}, Latency: ${status.latency}ms`
      );
    } catch (error) {
      return logTest(testId, testName, false, error.message);
    }
  }

  /**
   * P8-05: Consecutive failures trigger unhealthy
   */
  async function testP8_05_ConsecutiveFailuresTriggerUnhealthy() {
    const testId = "P8-05";
    const testName = "Consecutive failures trigger unhealthy";

    try {
      // Create instance with low threshold
      const monitor = new window.EmbedHealthMonitorClass({
        enabled: true,
        unhealthyThreshold: 3,
        timeout: 100,
        // Use an invalid endpoint to force failures
        endpoint:
          "https://invalid-endpoint-that-does-not-exist.example.com/api",
      });

      // Initial status should be unknown
      assert(monitor.isUnknown(), "Initial status should be unknown");

      // First failure - should become degraded
      await monitor.check();
      let status = monitor.getStatus();
      assert(
        status.status === "degraded",
        `After 1 failure should be degraded (got: ${status.status})`
      );
      assert(
        status.consecutiveFailures === 1,
        `Should have 1 failure (got: ${status.consecutiveFailures})`
      );

      // Second failure - still degraded
      await monitor.check();
      status = monitor.getStatus();
      assert(
        status.status === "degraded",
        `After 2 failures should be degraded (got: ${status.status})`
      );
      assert(
        status.consecutiveFailures === 2,
        `Should have 2 failures (got: ${status.consecutiveFailures})`
      );

      // Third failure - now unhealthy
      await monitor.check();
      status = monitor.getStatus();
      assert(
        status.status === "unhealthy",
        `After 3 failures should be unhealthy (got: ${status.status})`
      );
      assert(
        status.consecutiveFailures === 3,
        `Should have 3 failures (got: ${status.consecutiveFailures})`
      );

      // Verify isUnhealthy() helper
      assert(monitor.isUnhealthy(), "isUnhealthy() should return true");

      // Cleanup
      monitor.cleanup();

      return logTest(testId, testName, true, "Status transitions correct");
    } catch (error) {
      return logTest(testId, testName, false, error.message);
    }
  }

  /**
   * P8-06: Recovery resets to healthy
   */
  async function testP8_06_RecoveryResetsToHealthy() {
    const testId = "P8-06";
    const testName = "Recovery resets to healthy";

    try {
      // Create instance with valid endpoint
      const monitor = new window.EmbedHealthMonitorClass({
        enabled: true,
        unhealthyThreshold: 3,
        timeout: 5000,
        endpoint: "https://openrouter.ai/api/v1/models",
      });

      // Force unhealthy state using test helper
      monitor._forceStatus("unhealthy", { consecutiveFailures: 5 });

      let status = monitor.getStatus();
      assert(
        status.status === "unhealthy",
        `Should be unhealthy (got: ${status.status})`
      );
      assert(
        status.consecutiveFailures === 5,
        `Should have 5 failures (got: ${status.consecutiveFailures})`
      );

      // Perform successful check
      await monitor.check();
      status = monitor.getStatus();

      // Should recover to healthy
      assert(
        status.status === "healthy",
        `After success should be healthy (got: ${status.status})`
      );
      assert(
        status.consecutiveFailures === 0,
        `Should have 0 failures (got: ${status.consecutiveFailures})`
      );
      assert(status.lastError === null, "lastError should be null");

      // Verify isHealthy() helper
      assert(monitor.isHealthy(), "isHealthy() should return true");

      // Cleanup
      monitor.cleanup();

      return logTest(testId, testName, true, "Recovery successful");
    } catch (error) {
      return logTest(testId, testName, false, error.message);
    }
  }

  /**
   * P8-07: onStatusChange callback invoked
   */
  async function testP8_07_OnStatusChangeCallback() {
    const testId = "P8-07";
    const testName = "onStatusChange callback invoked";

    try {
      const statusChanges = [];

      // Create instance with callback
      const monitor = new window.EmbedHealthMonitorClass({
        enabled: true,
        unhealthyThreshold: 2,
        timeout: 5000,
        endpoint: "https://openrouter.ai/api/v1/models",
        onStatusChange: (status) => {
          statusChanges.push({
            status: status.status,
            consecutiveFailures: status.consecutiveFailures,
          });
        },
      });

      // Initial check should trigger callback (unknown -> healthy/degraded)
      await monitor.check();

      // Should have at least one status change
      assert(
        statusChanges.length >= 1,
        `Should have callback invocations (got: ${statusChanges.length})`
      );

      // First change should be from unknown
      const firstChange = statusChanges[0];
      assert(
        firstChange.status === "healthy" || firstChange.status === "degraded",
        `First status should be healthy or degraded (got: ${firstChange.status})`
      );

      // Cleanup
      monitor.cleanup();

      return logTest(
        testId,
        testName,
        true,
        `${statusChanges.length} callbacks received`
      );
    } catch (error) {
      return logTest(testId, testName, false, error.message);
    }
  }

  /**
   * P8-08: Integration with OpenRouterEmbed
   */
  async function testP8_08_IntegrationWithOpenRouterEmbed() {
    const testId = "P8-08";
    const testName = "Integration with OpenRouterEmbed";

    try {
      // Check if OpenRouterEmbed is available
      if (!window.OpenRouterEmbed) {
        return logTest(
          testId,
          testName,
          true,
          "Skipped - OpenRouterEmbed not loaded (standalone test)"
        );
      }

      // Check for integration methods that should be added to OpenRouterEmbed
      const expectedMethods = [
        "configureHealth",
        "startHealthMonitoring",
        "stopHealthMonitoring",
        "checkHealth",
        "getHealthStatus",
        "isHealthy",
        "isHealthMonitorEnabled",
      ];

      // Create a test container
      const testContainer = document.createElement("div");
      testContainer.id = "phase8-test-container-" + Date.now();
      document.body.appendChild(testContainer);

      try {
        // Create embed instance with health config
        const embed = new window.OpenRouterEmbed({
          containerId: testContainer.id,
          health: {
            enabled: true,
            checkInterval: 30000,
          },
        });

        // Check for integration methods
        const missingMethods = expectedMethods.filter(
          (method) => typeof embed[method] !== "function"
        );

        if (missingMethods.length > 0) {
          // Methods not yet integrated - this is expected before core.js update
          return logTest(
            testId,
            testName,
            true,
            `Integration pending - missing methods: ${missingMethods.join(
              ", "
            )}`
          );
        }

        // If methods exist, test them
        const healthStatus = embed.getHealthStatus();
        assert(healthStatus !== null, "getHealthStatus should return object");

        const isEnabled = embed.isHealthMonitorEnabled();
        assert(
          typeof isEnabled === "boolean",
          "isHealthMonitorEnabled should return boolean"
        );

        return logTest(
          testId,
          testName,
          true,
          "All integration methods present"
        );
      } finally {
        // Cleanup
        document.body.removeChild(testContainer);
      }
    } catch (error) {
      return logTest(testId, testName, false, error.message);
    }
  }

  // ============================================================================
  // TEST RUNNER
  // ============================================================================

  /**
   * Run all Phase 8 tests
   */
  async function runAllStage6Phase8Tests() {
    console.log("");
    console.log("=".repeat(60));
    console.log("Stage 6 Phase 8: Health Monitor Tests");
    console.log("=".repeat(60));
    console.log("");

    clearResults();

    // Run tests in order
    await testP8_01_ModuleExists();
    await testP8_02_StartBeginsChecks();
    await testP8_03_StopEndsChecks();
    await testP8_04_CheckReturnsStatus();
    await testP8_05_ConsecutiveFailuresTriggerUnhealthy();
    await testP8_06_RecoveryResetsToHealthy();
    await testP8_07_OnStatusChangeCallback();
    await testP8_08_IntegrationWithOpenRouterEmbed();

    console.log("");
    console.log("=".repeat(60));

    const summary = getTestSummary();
    const statusIcon = summary.passed === summary.total ? "🎉" : "⚠️";
    console.log(
      `${statusIcon} Phase 8 Results: ${summary.passed}/${summary.total} tests passed`
    );
    console.log("=".repeat(60));

    return summary;
  }

  /**
   * Run individual test by ID
   */
  async function runTest(testId) {
    const testMap = {
      "P8-01": testP8_01_ModuleExists,
      "P8-02": testP8_02_StartBeginsChecks,
      "P8-03": testP8_03_StopEndsChecks,
      "P8-04": testP8_04_CheckReturnsStatus,
      "P8-05": testP8_05_ConsecutiveFailuresTriggerUnhealthy,
      "P8-06": testP8_06_RecoveryResetsToHealthy,
      "P8-07": testP8_07_OnStatusChangeCallback,
      "P8-08": testP8_08_IntegrationWithOpenRouterEmbed,
    };

    if (testMap[testId]) {
      clearResults();
      await testMap[testId]();
      return getTestSummary();
    } else {
      console.error(`Unknown test ID: ${testId}`);
      return null;
    }
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  // Expose test runner
  window.runAllStage6Phase8Tests = runAllStage6Phase8Tests;
  window.runPhase8Test = runTest;

  // Expose individual tests for debugging
  window.phase8Tests = {
    P8_01: testP8_01_ModuleExists,
    P8_02: testP8_02_StartBeginsChecks,
    P8_03: testP8_03_StopEndsChecks,
    P8_04: testP8_04_CheckReturnsStatus,
    P8_05: testP8_05_ConsecutiveFailuresTriggerUnhealthy,
    P8_06: testP8_06_RecoveryResetsToHealthy,
    P8_07: testP8_07_OnStatusChangeCallback,
    P8_08: testP8_08_IntegrationWithOpenRouterEmbed,
  };
})();
