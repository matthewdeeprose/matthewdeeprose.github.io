/**
 * OpenRouter Embed API - Stage 6 Phase 2 Tests
 * Event System Tests
 *
 * Tests the EmbedEventEmitter module functionality.
 *
 * @version 1.0.0
 * @date 30 November 2025
 */

(function () {
  "use strict";

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  /**
   * Simple test runner
   */
  function runTest(name, testFn) {
    try {
      const result = testFn();
      if (result && typeof result.then === "function") {
        return result.then(
          (res) => ({
            name,
            passed: res?.passed !== false,
            message: res?.message || "Passed",
          }),
          (err) => ({
            name,
            passed: false,
            message: err?.message || String(err),
          })
        );
      }
      return Promise.resolve({
        name,
        passed: result?.passed !== false,
        message: result?.message || "Passed",
      });
    } catch (error) {
      return Promise.resolve({
        name,
        passed: false,
        message: error?.message || String(error),
      });
    }
  }

  /**
   * Format test results for console output
   */
  function formatResults(results) {
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    const total = results.length;

    console.log("\n" + "=".repeat(60));
    console.log("STAGE 6 PHASE 2: EVENT SYSTEM TEST RESULTS");
    console.log("=".repeat(60));

    results.forEach((r) => {
      const icon = r.passed ? "✅" : "❌";
      console.log(`${icon} ${r.name}`);
      if (!r.passed) {
        console.log(`   └─ ${r.message}`);
      }
    });

    console.log("=".repeat(60));
    console.log(`TOTAL: ${passed}/${total} passed, ${failed} failed`);
    console.log("=".repeat(60) + "\n");

    return { passed, failed, total, results };
  }

  // ============================================================================
  // PHASE 2 TESTS: EVENT SYSTEM
  // ============================================================================

  /**
   * P2-01: Module exists with all required methods
   */
  function testP2_01_ModuleExists() {
    // Check singleton instance
    if (!window.EmbedEventEmitter) {
      return {
        passed: false,
        message: "EmbedEventEmitter singleton not found",
      };
    }

    // Check class
    if (!window.EmbedEventEmitterClass) {
      return { passed: false, message: "EmbedEventEmitterClass not found" };
    }

    // Check required methods on singleton
    const requiredMethods = [
      "on",
      "once",
      "off",
      "emit",
      "removeAllListeners",
      "listenerCount",
      "eventNames",
    ];

    for (const method of requiredMethods) {
      if (typeof window.EmbedEventEmitter[method] !== "function") {
        return {
          passed: false,
          message: `Missing required method: ${method}`,
        };
      }
    }

    return { passed: true, message: "All required methods present" };
  }

  /**
   * P2-02: on() subscribes handler
   */
  function testP2_02_OnSubscribes() {
    const emitter = new window.EmbedEventEmitterClass();
    let called = false;

    emitter.on("test", () => {
      called = true;
    });

    emitter.emit("test");

    if (!called) {
      return { passed: false, message: "Handler was not called after emit" };
    }

    return { passed: true, message: "Handler called correctly" };
  }

  /**
   * P2-03: off() unsubscribes handler
   */
  function testP2_03_OffUnsubscribes() {
    const emitter = new window.EmbedEventEmitterClass();
    let callCount = 0;

    const handler = () => {
      callCount++;
    };

    emitter.on("test", handler);
    emitter.emit("test"); // Should call: callCount = 1

    const removed = emitter.off("test", handler);
    emitter.emit("test"); // Should NOT call: callCount still 1

    if (!removed) {
      return { passed: false, message: "off() did not return true" };
    }

    if (callCount !== 1) {
      return {
        passed: false,
        message: `Handler called ${callCount} times, expected 1`,
      };
    }

    return { passed: true, message: "Handler unsubscribed correctly" };
  }

  /**
   * P2-04: once() fires only once
   */
  function testP2_04_OnceFiresOnce() {
    const emitter = new window.EmbedEventEmitterClass();
    let callCount = 0;

    emitter.once("test", () => {
      callCount++;
    });

    emitter.emit("test"); // Should call: callCount = 1
    emitter.emit("test"); // Should NOT call: callCount still 1
    emitter.emit("test"); // Should NOT call: callCount still 1

    if (callCount !== 1) {
      return {
        passed: false,
        message: `Handler called ${callCount} times, expected 1`,
      };
    }

    return { passed: true, message: "once() handler fired exactly once" };
  }

  /**
   * P2-05: emit() calls all handlers
   */
  function testP2_05_EmitCallsAll() {
    const emitter = new window.EmbedEventEmitterClass();
    const calls = [];

    emitter.on("test", () => calls.push("handler1"));
    emitter.on("test", () => calls.push("handler2"));
    emitter.on("test", () => calls.push("handler3"));

    emitter.emit("test");

    if (calls.length !== 3) {
      return {
        passed: false,
        message: `Only ${calls.length} handlers called, expected 3`,
      };
    }

    return { passed: true, message: "All handlers called" };
  }

  /**
   * P2-06: emit() passes data correctly
   */
  function testP2_06_EmitPassesData() {
    const emitter = new window.EmbedEventEmitterClass();
    let receivedData = null;

    const testData = {
      userPrompt: "Test prompt",
      model: "claude-3",
      options: { temperature: 0.7 },
    };

    emitter.on("test", (data) => {
      receivedData = data;
    });

    emitter.emit("test", testData);

    if (receivedData !== testData) {
      return { passed: false, message: "Data not passed correctly" };
    }

    if (receivedData.userPrompt !== "Test prompt") {
      return { passed: false, message: "Data properties not preserved" };
    }

    return { passed: true, message: "Data passed correctly to handler" };
  }

  /**
   * P2-07: on() returns unsubscribe function
   */
  function testP2_07_OnReturnsUnsubscribe() {
    const emitter = new window.EmbedEventEmitterClass();
    let callCount = 0;

    const unsubscribe = emitter.on("test", () => {
      callCount++;
    });

    if (typeof unsubscribe !== "function") {
      return { passed: false, message: "on() did not return a function" };
    }

    emitter.emit("test"); // callCount = 1
    unsubscribe();
    emitter.emit("test"); // Should not call

    if (callCount !== 1) {
      return {
        passed: false,
        message: `Handler called ${callCount} times after unsubscribe, expected 1`,
      };
    }

    return { passed: true, message: "Unsubscribe function works correctly" };
  }

  /**
   * P2-08: removeAllListeners() clears handlers
   */
  function testP2_08_RemoveAllListeners() {
    const emitter = new window.EmbedEventEmitterClass();
    let callCount = 0;

    emitter.on("event1", () => callCount++);
    emitter.on("event1", () => callCount++);
    emitter.on("event2", () => callCount++);

    // Test removing specific event
    emitter.removeAllListeners("event1");
    emitter.emit("event1"); // Should not call
    emitter.emit("event2"); // Should call: callCount = 1

    if (callCount !== 1) {
      return {
        passed: false,
        message: `After removing event1, callCount was ${callCount}, expected 1`,
      };
    }

    // Reset and test removing all
    callCount = 0;
    emitter.on("event1", () => callCount++);
    emitter.on("event3", () => callCount++);

    emitter.removeAllListeners();
    emitter.emit("event1");
    emitter.emit("event2");
    emitter.emit("event3");

    if (callCount !== 0) {
      return {
        passed: false,
        message: `After removeAll, callCount was ${callCount}, expected 0`,
      };
    }

    return { passed: true, message: "removeAllListeners works correctly" };
  }

  /**
   * P2-09: listenerCount() returns correct count
   */
  function testP2_09_ListenerCount() {
    const emitter = new window.EmbedEventEmitterClass();

    // Initially 0
    if (emitter.listenerCount("test") !== 0) {
      return { passed: false, message: "Initial count not 0" };
    }

    // Add handlers
    const unsub1 = emitter.on("test", () => {});
    if (emitter.listenerCount("test") !== 1) {
      return { passed: false, message: "Count not 1 after first add" };
    }

    const unsub2 = emitter.on("test", () => {});
    if (emitter.listenerCount("test") !== 2) {
      return { passed: false, message: "Count not 2 after second add" };
    }

    // Remove one
    unsub1();
    if (emitter.listenerCount("test") !== 1) {
      return { passed: false, message: "Count not 1 after removal" };
    }

    // Remove last
    unsub2();
    if (emitter.listenerCount("test") !== 0) {
      return { passed: false, message: "Count not 0 after all removed" };
    }

    return { passed: true, message: "listenerCount() accurate throughout" };
  }

  /**
   * P2-10: eventNames() returns registered events
   */
  function testP2_10_EventNames() {
    const emitter = new window.EmbedEventEmitterClass();

    // Initially empty
    if (emitter.eventNames().length !== 0) {
      return { passed: false, message: "Initial eventNames not empty" };
    }

    // Add handlers for different events
    emitter.on("alpha", () => {});
    emitter.on("beta", () => {});
    emitter.on("gamma", () => {});

    const names = emitter.eventNames();

    if (names.length !== 3) {
      return {
        passed: false,
        message: `Expected 3 events, got ${names.length}`,
      };
    }

    if (
      !names.includes("alpha") ||
      !names.includes("beta") ||
      !names.includes("gamma")
    ) {
      return {
        passed: false,
        message: `Missing expected event names: ${names.join(", ")}`,
      };
    }

    return { passed: true, message: "eventNames() returns correct list" };
  }

  /**
   * P2-11: Handlers called in subscription order
   */
  function testP2_11_HandlerOrder() {
    const emitter = new window.EmbedEventEmitterClass();
    const order = [];

    emitter.on("test", () => order.push(1));
    emitter.on("test", () => order.push(2));
    emitter.on("test", () => order.push(3));

    emitter.emit("test");

    // Check order
    if (order.length !== 3) {
      return {
        passed: false,
        message: `Expected 3 calls, got ${order.length}`,
      };
    }

    if (order[0] !== 1 || order[1] !== 2 || order[2] !== 3) {
      return {
        passed: false,
        message: `Order was [${order.join(", ")}], expected [1, 2, 3]`,
      };
    }

    return { passed: true, message: "Handlers called in subscription order" };
  }

  /**
   * P2-12: Error in handler doesn't break others
   */
  function testP2_12_ErrorIsolation() {
    const emitter = new window.EmbedEventEmitterClass();
    const calls = [];

    emitter.on("test", () => calls.push("before"));
    emitter.on("test", () => {
      throw new Error("Intentional test error");
    });
    emitter.on("test", () => calls.push("after"));

    // Suppress console.error for this test
    const originalError = console.error;
    console.error = () => {};

    try {
      emitter.emit("test");
    } finally {
      console.error = originalError;
    }

    if (calls.length !== 2) {
      return {
        passed: false,
        message: `Expected 2 calls despite error, got ${calls.length}`,
      };
    }

    if (!calls.includes("before") || !calls.includes("after")) {
      return {
        passed: false,
        message: "Handlers before and after error not both called",
      };
    }

    return {
      passed: true,
      message: "Error in one handler doesn't break others",
    };
  }

  /**
   * P2-13: Integration ready - works with OpenRouterEmbed pattern
   */
  function testP2_13_IntegrationReady() {
    const emitter = new window.EmbedEventEmitterClass();
    const events = [];

    // Simulate the events that would be emitted during a request lifecycle
    emitter.on("beforeRequest", (data) =>
      events.push({ type: "beforeRequest", data })
    );
    emitter.on("retry", (data) => events.push({ type: "retry", data }));
    emitter.on("streamChunk", (data) =>
      events.push({ type: "streamChunk", data })
    );
    emitter.on("streamComplete", (data) =>
      events.push({ type: "streamComplete", data })
    );
    emitter.on("afterRequest", (data) =>
      events.push({ type: "afterRequest", data })
    );
    emitter.on("error", (data) => events.push({ type: "error", data }));

    // Simulate request lifecycle
    emitter.emit("beforeRequest", { userPrompt: "Test", model: "claude-3" });
    emitter.emit("streamChunk", { chunk: "Hello", chunkIndex: 0 });
    emitter.emit("streamChunk", { chunk: " world", chunkIndex: 1 });
    emitter.emit("streamComplete", {
      fullResponse: "Hello world",
      duration: 500,
    });
    emitter.emit("afterRequest", {
      response: "Hello world",
      duration: 500,
      cached: false,
    });

    // Verify all events captured in order
    if (events.length !== 5) {
      return {
        passed: false,
        message: `Expected 5 events, got ${events.length}`,
      };
    }

    const expectedOrder = [
      "beforeRequest",
      "streamChunk",
      "streamChunk",
      "streamComplete",
      "afterRequest",
    ];
    for (let i = 0; i < expectedOrder.length; i++) {
      if (events[i].type !== expectedOrder[i]) {
        return {
          passed: false,
          message: `Event ${i} was ${events[i].type}, expected ${expectedOrder[i]}`,
        };
      }
    }

    // Verify data integrity
    if (events[0].data.userPrompt !== "Test") {
      return { passed: false, message: "beforeRequest data not preserved" };
    }

    if (events[3].data.fullResponse !== "Hello world") {
      return { passed: false, message: "streamComplete data not preserved" };
    }

    return { passed: true, message: "Integration pattern works correctly" };
  }

  // ============================================================================
  // TEST RUNNER
  // ============================================================================

  /**
   * Run all Stage 6 Phase 2 tests
   */
  async function runAllStage6Phase2Tests() {
    console.log("\n🧪 Running Stage 6 Phase 2 (Event System) Tests...\n");

    const tests = [
      [
        "P2-01: Module exists with all required methods",
        testP2_01_ModuleExists,
      ],
      ["P2-02: on() subscribes handler", testP2_02_OnSubscribes],
      ["P2-03: off() unsubscribes handler", testP2_03_OffUnsubscribes],
      ["P2-04: once() fires only once", testP2_04_OnceFiresOnce],
      ["P2-05: emit() calls all handlers", testP2_05_EmitCallsAll],
      ["P2-06: emit() passes data correctly", testP2_06_EmitPassesData],
      [
        "P2-07: on() returns unsubscribe function",
        testP2_07_OnReturnsUnsubscribe,
      ],
      [
        "P2-08: removeAllListeners() clears handlers",
        testP2_08_RemoveAllListeners,
      ],
      ["P2-09: listenerCount() returns correct count", testP2_09_ListenerCount],
      ["P2-10: eventNames() returns registered events", testP2_10_EventNames],
      ["P2-11: Handlers called in subscription order", testP2_11_HandlerOrder],
      [
        "P2-12: Error in handler doesn't break others",
        testP2_12_ErrorIsolation,
      ],
      [
        "P2-13: Integration ready (OpenRouterEmbed pattern)",
        testP2_13_IntegrationReady,
      ],
    ];

    const results = [];

    for (const [name, testFn] of tests) {
      const result = await runTest(name, testFn);
      results.push(result);
    }

    return formatResults(results);
  }

  /**
   * Run regression tests for previous stages
   * Verifies that Phase 2 doesn't break existing functionality
   */
  async function testStage6_Regressions() {
    console.log("\n🔄 Running Stage 6 Regression Tests...\n");

    const results = [];

    // Check Phase 1 (Retry) still works
    if (window.EmbedRetryHandlerClass) {
      try {
        const retryHandler = new window.EmbedRetryHandlerClass();

        // Test basic functionality
        if (typeof retryHandler.execute !== "function") {
          results.push({
            name: "Phase 1: Retry execute method",
            passed: false,
            message: "execute method missing",
          });
        } else {
          results.push({
            name: "Phase 1: Retry execute method",
            passed: true,
            message: "Available",
          });
        }

        if (typeof retryHandler.isRetryable !== "function") {
          results.push({
            name: "Phase 1: Retry isRetryable method",
            passed: false,
            message: "isRetryable method missing",
          });
        } else {
          results.push({
            name: "Phase 1: Retry isRetryable method",
            passed: true,
            message: "Available",
          });
        }

        if (typeof retryHandler.calculateDelay !== "function") {
          results.push({
            name: "Phase 1: Retry calculateDelay method",
            passed: false,
            message: "calculateDelay method missing",
          });
        } else {
          results.push({
            name: "Phase 1: Retry calculateDelay method",
            passed: true,
            message: "Available",
          });
        }
      } catch (error) {
        results.push({
          name: "Phase 1: Retry handler",
          passed: false,
          message: error.message,
        });
      }
    } else {
      results.push({
        name: "Phase 1: Retry handler",
        passed: false,
        message: "EmbedRetryHandlerClass not loaded",
      });
    }

    // Check OpenRouterEmbed still works
    if (window.OpenRouterEmbed) {
      try {
        // Create test container
        const testDiv = document.createElement("div");
        testDiv.id = "regression-test-container";
        document.body.appendChild(testDiv);

        try {
          const embed = new window.OpenRouterEmbed({
            containerId: "regression-test-container",
          });

          // Test core methods exist
          if (typeof embed.sendRequest === "function") {
            results.push({
              name: "OpenRouterEmbed: sendRequest",
              passed: true,
              message: "Available",
            });
          } else {
            results.push({
              name: "OpenRouterEmbed: sendRequest",
              passed: false,
              message: "Missing",
            });
          }

          if (typeof embed.sendStreamingRequest === "function") {
            results.push({
              name: "OpenRouterEmbed: sendStreamingRequest",
              passed: true,
              message: "Available",
            });
          } else {
            results.push({
              name: "OpenRouterEmbed: sendStreamingRequest",
              passed: false,
              message: "Missing",
            });
          }

          // Test retry methods exist
          if (typeof embed.configureRetry === "function") {
            results.push({
              name: "OpenRouterEmbed: configureRetry",
              passed: true,
              message: "Available",
            });
          } else {
            results.push({
              name: "OpenRouterEmbed: configureRetry",
              passed: false,
              message: "Missing",
            });
          }
        } finally {
          testDiv.remove();
        }
      } catch (error) {
        results.push({
          name: "OpenRouterEmbed: Constructor",
          passed: false,
          message: error.message,
        });
      }
    } else {
      results.push({
        name: "OpenRouterEmbed",
        passed: false,
        message: "Not loaded",
      });
    }

    return formatResults(results);
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.runAllStage6Phase2Tests = runAllStage6Phase2Tests;
  window.testStage6_Regressions = testStage6_Regressions;

  // Individual test functions for debugging
  window.testP2_01_ModuleExists = testP2_01_ModuleExists;
  window.testP2_02_OnSubscribes = testP2_02_OnSubscribes;
  window.testP2_03_OffUnsubscribes = testP2_03_OffUnsubscribes;
  window.testP2_04_OnceFiresOnce = testP2_04_OnceFiresOnce;
  window.testP2_05_EmitCallsAll = testP2_05_EmitCallsAll;
  window.testP2_06_EmitPassesData = testP2_06_EmitPassesData;
  window.testP2_07_OnReturnsUnsubscribe = testP2_07_OnReturnsUnsubscribe;
  window.testP2_08_RemoveAllListeners = testP2_08_RemoveAllListeners;
  window.testP2_09_ListenerCount = testP2_09_ListenerCount;
  window.testP2_10_EventNames = testP2_10_EventNames;
  window.testP2_11_HandlerOrder = testP2_11_HandlerOrder;
  window.testP2_12_ErrorIsolation = testP2_12_ErrorIsolation;
  window.testP2_13_IntegrationReady = testP2_13_IntegrationReady;
})();
