/**
 * OpenRouter Embed API - Stage 6 Phase 7 Tests
 * Request Queue with Priority
 *
 * Tests for the EmbedQueue module
 *
 * @version 1.0.0
 * @date 01 December 2025
 */

(function () {
  "use strict";

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  let testResults = {
    passed: 0,
    failed: 0,
    total: 0,
  };

  function resetTestResults() {
    testResults = { passed: 0, failed: 0, total: 0 };
  }

  function logTestResult(testId, description, passed, details = "") {
    testResults.total++;
    if (passed) {
      testResults.passed++;
      console.log(`✅ ${testId}: ${description}`);
    } else {
      testResults.failed++;
      console.error(`❌ ${testId}: ${description}`);
      if (details) console.error(`   Details: ${details}`);
    }
  }

  function logTestSummary(suiteName) {
    console.log("");
    console.log("=".repeat(60));
    console.log(`${suiteName} Summary`);
    console.log("=".repeat(60));
    console.log(
      `Total: ${testResults.total} | Passed: ${testResults.passed} | Failed: ${testResults.failed}`
    );
    const percentage = ((testResults.passed / testResults.total) * 100).toFixed(
      1
    );
    console.log(`Pass Rate: ${percentage}%`);
    console.log("=".repeat(60));
    return testResults.failed === 0;
  }

  /**
   * Sleep utility for async tests
   */
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // P7-01: Module exists with all required methods
  // ============================================================================

  async function testP7_01_ModuleExists() {
    console.log("");
    console.log("P7-01: Module exists with all required methods");
    console.log("-".repeat(50));

    // Check singleton exists
    const singletonExists = !!window.EmbedQueue;
    logTestResult(
      "P7-01a",
      "EmbedQueue singleton exists",
      singletonExists,
      singletonExists ? "" : "window.EmbedQueue is undefined"
    );

    // Check class exists
    const classExists = !!window.EmbedQueueClass;
    logTestResult(
      "P7-01b",
      "EmbedQueueClass exists",
      classExists,
      classExists ? "" : "window.EmbedQueueClass is undefined"
    );

    // Check required methods
    const requiredMethods = [
      "configure",
      "enqueue",
      "dequeue",
      "getLength",
      "getItems",
      "clear",
      "pause",
      "resume",
      "isPaused",
      "getStats",
      "resetStats",
      "getConfig",
      "setExecutor",
      "cleanup",
    ];

    let allMethodsExist = true;
    const missingMethods = [];

    for (const method of requiredMethods) {
      if (typeof window.EmbedQueue[method] !== "function") {
        allMethodsExist = false;
        missingMethods.push(method);
      }
    }

    logTestResult(
      "P7-01c",
      "All required methods exist",
      allMethodsExist,
      missingMethods.length > 0 ? `Missing: ${missingMethods.join(", ")}` : ""
    );

    // Check PRIORITY constants
    const priorityExists =
      window.EmbedQueueClass.PRIORITY &&
      window.EmbedQueueClass.PRIORITY.CRITICAL === 0 &&
      window.EmbedQueueClass.PRIORITY.HIGH === 1 &&
      window.EmbedQueueClass.PRIORITY.NORMAL === 2 &&
      window.EmbedQueueClass.PRIORITY.LOW === 3;

    logTestResult(
      "P7-01d",
      "PRIORITY constants defined correctly",
      priorityExists,
      priorityExists ? "" : "PRIORITY constants missing or incorrect"
    );

    return singletonExists && classExists && allMethodsExist && priorityExists;
  }

  // ============================================================================
  // P7-02: enqueue() adds to queue
  // ============================================================================

  async function testP7_02_EnqueueAdds() {
    console.log("");
    console.log("P7-02: enqueue() adds to queue");
    console.log("-".repeat(50));

    // Create fresh instance
    const queue = new window.EmbedQueueClass();

    // Check initial length
    const initialLength = queue.getLength();
    logTestResult(
      "P7-02a",
      "Initial queue length is 0",
      initialLength === 0,
      `Expected 0, got ${initialLength}`
    );

    // Mock executor to prevent actual processing
    queue.pause(); // Pause to prevent processing

    // Enqueue item (don't await - it won't complete without executor)
    // Catch rejection to prevent unhandled promise rejection
    const enqueuePromise = queue
      .enqueue({ userPrompt: "Test prompt" })
      .catch(() => {});

    // Check queue length increased
    const newLength = queue.getLength();
    logTestResult(
      "P7-02b",
      "Queue length increased to 1",
      newLength === 1,
      `Expected 1, got ${newLength}`
    );

    // Check items
    const items = queue.getItems();
    const hasItem = items.length === 1 && items[0].status === "pending";
    logTestResult(
      "P7-02c",
      "Item appears in getItems() with pending status",
      hasItem,
      hasItem ? "" : `Items: ${JSON.stringify(items)}`
    );

    // Cleanup - clear will reject the promise, which is now caught
    queue.clear();
    queue.cleanup();

    return initialLength === 0 && newLength === 1 && hasItem;
  }

  // ============================================================================
  // P7-03: dequeue() removes from queue
  // ============================================================================

  async function testP7_03_DequeueRemoves() {
    console.log("");
    console.log("P7-03: dequeue() removes from queue");
    console.log("-".repeat(50));

    const queue = new window.EmbedQueueClass();
    queue.pause();

    // Enqueue items
    const promise1 = queue.enqueue({ userPrompt: "Test 1" });
    const promise2 = queue.enqueue({ userPrompt: "Test 2" }).catch(() => {});

    // Get items to find IDs
    const itemsBefore = queue.getItems();
    const firstItemId = itemsBefore[0]?.id;

    logTestResult(
      "P7-03a",
      "Two items enqueued",
      itemsBefore.length === 2,
      `Expected 2, got ${itemsBefore.length}`
    );

    // Dequeue first item
    const removed = queue.dequeue(firstItemId);
    logTestResult("P7-03b", "dequeue() returns true", removed === true);

    // Check length
    const newLength = queue.getLength();
    logTestResult(
      "P7-03c",
      "Queue length decreased to 1",
      newLength === 1,
      `Expected 1, got ${newLength}`
    );

    // Verify promise was rejected
    let wasRejected = false;
    try {
      await promise1;
    } catch (error) {
      wasRejected = error.code === "CANCELLED";
    }
    logTestResult("P7-03d", "Dequeued promise was rejected", wasRejected);

    // Cleanup
    queue.clear();
    queue.cleanup();

    return removed && newLength === 1 && wasRejected;
  }

  // ============================================================================
  // P7-04: Priority ordering works
  // ============================================================================

  async function testP7_04_PriorityOrdering() {
    console.log("");
    console.log("P7-04: Priority ordering works");
    console.log("-".repeat(50));

    const queue = new window.EmbedQueueClass();
    queue.pause();

    // Enqueue items with different priorities (in reverse order)
    // Catch rejections to prevent unhandled promise errors on clear()
    queue
      .enqueue({ userPrompt: "Low priority" }, { priority: "low" })
      .catch(() => {});
    queue
      .enqueue({ userPrompt: "High priority" }, { priority: "high" })
      .catch(() => {});
    queue
      .enqueue({ userPrompt: "Critical" }, { priority: "critical" })
      .catch(() => {});
    queue
      .enqueue({ userPrompt: "Normal" }, { priority: "normal" })
      .catch(() => {});

    // Get items (should be sorted by priority)
    const items = queue.getItems();

    logTestResult(
      "P7-04a",
      "All 4 items enqueued",
      items.length === 4,
      `Expected 4, got ${items.length}`
    );

    // Check order: CRITICAL (0), HIGH (1), NORMAL (2), LOW (3)
    const correctOrder =
      items[0]?.priority === 0 &&
      items[1]?.priority === 1 &&
      items[2]?.priority === 2 &&
      items[3]?.priority === 3;

    logTestResult(
      "P7-04b",
      "Items sorted by priority (CRITICAL first, LOW last)",
      correctOrder,
      correctOrder ? "" : `Order: ${items.map((i) => i.priority).join(", ")}`
    );

    // Cleanup - clear will reject promises, which are now caught
    queue.clear();
    queue.cleanup();

    return items.length === 4 && correctOrder;
  }

  // ============================================================================
  // P7-05: Concurrency limit respected
  // ============================================================================

  async function testP7_05_ConcurrencyLimit() {
    console.log("");
    console.log("P7-05: Concurrency limit respected");
    console.log("-".repeat(50));

    const queue = new window.EmbedQueueClass({
      concurrency: 2, // Allow 2 concurrent
    });

    let activeCount = 0;
    let maxActive = 0;

    // Set up executor that tracks concurrency
    queue.setExecutor(async (request) => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await sleep(100); // Simulate work
      activeCount--;
      return { result: "ok" };
    });

    // Enqueue 5 items
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(queue.enqueue({ userPrompt: `Test ${i}` }));
    }

    // Wait for all to complete
    await Promise.all(promises);

    logTestResult(
      "P7-05a",
      "All 5 items processed",
      true,
      "All promises resolved"
    );

    logTestResult(
      "P7-05b",
      "Max concurrency did not exceed 2",
      maxActive <= 2,
      `Max active was ${maxActive}`
    );

    // Check stats
    const stats = queue.getStats();
    logTestResult(
      "P7-05c",
      "Stats show 5 completed",
      stats.completed === 5,
      `Completed: ${stats.completed}`
    );

    // Cleanup
    queue.cleanup();

    return maxActive <= 2 && stats.completed === 5;
  }

  // ============================================================================
  // P7-06: pause() stops processing
  // ============================================================================

  async function testP7_06_PauseStops() {
    console.log("");
    console.log("P7-06: pause() stops processing");
    console.log("-".repeat(50));

    const queue = new window.EmbedQueueClass();

    let processedCount = 0;

    queue.setExecutor(async (request) => {
      processedCount++;
      return { result: "ok" };
    });

    // Pause immediately
    queue.pause();

    logTestResult(
      "P7-06a",
      "isPaused() returns true after pause()",
      queue.isPaused()
    );

    // Enqueue while paused
    const promise = queue.enqueue({ userPrompt: "Test" });

    // Wait a bit
    await sleep(50);

    // Should still be pending
    logTestResult(
      "P7-06b",
      "Item not processed while paused",
      processedCount === 0,
      `Processed: ${processedCount}`
    );

    logTestResult(
      "P7-06c",
      "Queue length is still 1",
      queue.getLength() === 1,
      `Length: ${queue.getLength()}`
    );

    // Resume and wait for completion
    queue.resume();
    await promise;

    logTestResult(
      "P7-06d",
      "Item processed after resume",
      processedCount === 1,
      `Processed: ${processedCount}`
    );

    // Cleanup
    queue.cleanup();

    return queue.isPaused() === false && processedCount === 1;
  }

  // ============================================================================
  // P7-07: resume() continues processing
  // ============================================================================

  async function testP7_07_ResumeContinues() {
    console.log("");
    console.log("P7-07: resume() continues processing");
    console.log("-".repeat(50));

    const queue = new window.EmbedQueueClass();

    let processedCount = 0;

    queue.setExecutor(async (request) => {
      processedCount++;
      await sleep(10);
      return { result: "ok" };
    });

    // Start paused
    queue.pause();

    // Enqueue multiple items
    const promises = [
      queue.enqueue({ userPrompt: "Test 1" }),
      queue.enqueue({ userPrompt: "Test 2" }),
      queue.enqueue({ userPrompt: "Test 3" }),
    ];

    // Verify paused state
    logTestResult(
      "P7-07a",
      "Queue is paused",
      queue.isPaused(),
      `isPaused: ${queue.isPaused()}`
    );

    logTestResult(
      "P7-07b",
      "3 items pending",
      queue.getLength() === 3,
      `Length: ${queue.getLength()}`
    );

    // Resume
    queue.resume();

    logTestResult(
      "P7-07c",
      "Queue no longer paused after resume()",
      !queue.isPaused(),
      `isPaused: ${queue.isPaused()}`
    );

    // Wait for all to complete
    await Promise.all(promises);

    logTestResult(
      "P7-07d",
      "All 3 items processed after resume",
      processedCount === 3,
      `Processed: ${processedCount}`
    );

    // Cleanup
    queue.cleanup();

    return processedCount === 3;
  }

  // ============================================================================
  // P7-08: maxSize limit enforced
  // ============================================================================

  async function testP7_08_MaxSizeEnforced() {
    console.log("");
    console.log("P7-08: maxSize limit enforced");
    console.log("-".repeat(50));

    const queue = new window.EmbedQueueClass({
      maxSize: 3, // Small limit for testing
    });

    queue.pause(); // Prevent processing

    // Enqueue up to limit - catch rejections for cleanup
    queue.enqueue({ userPrompt: "Item 1" }).catch(() => {});
    queue.enqueue({ userPrompt: "Item 2" }).catch(() => {});
    queue.enqueue({ userPrompt: "Item 3" }).catch(() => {});

    logTestResult(
      "P7-08a",
      "Queue accepts items up to maxSize",
      queue.getLength() === 3,
      `Length: ${queue.getLength()}`
    );

    // Try to exceed limit
    let rejected = false;
    let errorCode = null;
    try {
      await queue.enqueue({ userPrompt: "Item 4 - should fail" });
    } catch (error) {
      rejected = true;
      errorCode = error.code;
    }

    logTestResult(
      "P7-08b",
      "Fourth item rejected with error",
      rejected,
      rejected ? "" : "Item was accepted beyond maxSize"
    );

    logTestResult(
      "P7-08c",
      "Error code is QUEUE_FULL",
      errorCode === "QUEUE_FULL",
      `Error code: ${errorCode}`
    );

    logTestResult(
      "P7-08d",
      "Queue length still at maxSize (3)",
      queue.getLength() === 3,
      `Length: ${queue.getLength()}`
    );

    // Cleanup - clear will reject promises, which are now caught
    queue.clear();
    queue.cleanup();

    return rejected && errorCode === "QUEUE_FULL";
  }
  // ============================================================================
  // P7-09: onQueueChange callback invoked
  // ============================================================================

  async function testP7_09_OnQueueChangeCallback() {
    console.log("");
    console.log("P7-09: onQueueChange callback invoked");
    console.log("-".repeat(50));

    const callbackCalls = [];

    const queue = new window.EmbedQueueClass({
      onQueueChange: (length) => {
        callbackCalls.push(length);
      },
    });

    queue.pause();

    // Enqueue items - catch rejections for cleanup
    queue.enqueue({ userPrompt: "Item 1" }).catch(() => {});
    queue.enqueue({ userPrompt: "Item 2" }).catch(() => {});

    logTestResult(
      "P7-09a",
      "Callback called on enqueue",
      callbackCalls.length >= 2,
      `Calls: ${callbackCalls.length}`
    );

    // Get an ID for dequeue
    const items = queue.getItems();
    const firstId = items[0]?.id;

    // Dequeue
    queue.dequeue(firstId);

    logTestResult(
      "P7-09b",
      "Callback called on dequeue",
      callbackCalls.length >= 3,
      `Calls: ${callbackCalls.length}`
    );

    // Clear - will reject remaining promise, which is now caught
    queue.clear();

    logTestResult(
      "P7-09c",
      "Callback called on clear",
      callbackCalls.length >= 4,
      `Calls: ${callbackCalls.length}`
    );

    // Verify callback received queue lengths
    const hasLengths = callbackCalls.every((len) => typeof len === "number");
    logTestResult(
      "P7-09d",
      "Callback receives queue length as argument",
      hasLengths,
      `Values: ${callbackCalls.join(", ")}`
    );

    // Cleanup
    queue.cleanup();

    return callbackCalls.length >= 4 && hasLengths;
  }

  // ============================================================================
  // P7-10: Integration with OpenRouterEmbed
  // ============================================================================

  async function testP7_10_Integration() {
    console.log("");
    console.log("P7-10: Integration with OpenRouterEmbed");
    console.log("-".repeat(50));

    // Check if OpenRouterEmbed exists
    const embedExists = !!window.OpenRouterEmbed;
    logTestResult(
      "P7-10a",
      "OpenRouterEmbed class exists",
      embedExists,
      embedExists ? "" : "OpenRouterEmbed not loaded"
    );

    if (!embedExists) {
      console.log(
        "   Skipping remaining integration tests - OpenRouterEmbed not loaded"
      );
      return false;
    }

    // Check if EmbedQueueClass can be instantiated
    const canInstantiate = !!window.EmbedQueueClass;
    logTestResult(
      "P7-10b",
      "EmbedQueueClass can be instantiated",
      canInstantiate
    );

    // Check queue can connect to event emitter
    const queue = new window.EmbedQueueClass();
    const eventsReceived = [];

    queue._emitEvent = (event, data) => {
      eventsReceived.push({ event, data });
    };

    queue.pause();
    // Catch rejection for cleanup
    queue.enqueue({ userPrompt: "Test" }).catch(() => {});

    const emitsEvents = eventsReceived.some((e) => e.event === "queueAdd");
    logTestResult(
      "P7-10c",
      "Queue emits events when _emitEvent is set",
      emitsEvents,
      `Events received: ${eventsReceived.map((e) => e.event).join(", ")}`
    );

    // Check queue can use external executor
    let executorCalled = false;
    queue.setExecutor(async (request) => {
      executorCalled = true;
      return { success: true };
    });

    queue.resume();
    await sleep(100);

    logTestResult(
      "P7-10d",
      "External executor is called",
      executorCalled,
      executorCalled ? "" : "Executor was not called"
    );

    // Cleanup
    queue.cleanup();

    return embedExists && canInstantiate && emitsEvents && executorCalled;
  }

  // ============================================================================
  // RUN ALL TESTS
  // ============================================================================

  async function runAllStage6Phase7Tests() {
    console.log("");
    console.log("=".repeat(60));
    console.log("OpenRouter Embed API - Stage 6 Phase 7 Tests");
    console.log("Request Queue with Priority");
    console.log("=".repeat(60));

    resetTestResults();

    await testP7_01_ModuleExists();
    await testP7_02_EnqueueAdds();
    await testP7_03_DequeueRemoves();
    await testP7_04_PriorityOrdering();
    await testP7_05_ConcurrencyLimit();
    await testP7_06_PauseStops();
    await testP7_07_ResumeContinues();
    await testP7_08_MaxSizeEnforced();
    await testP7_09_OnQueueChangeCallback();
    await testP7_10_Integration();

    return logTestSummary("Stage 6 Phase 7");
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.runAllStage6Phase7Tests = runAllStage6Phase7Tests;

  // Individual test exposure for debugging
  window.testP7_01_ModuleExists = testP7_01_ModuleExists;
  window.testP7_02_EnqueueAdds = testP7_02_EnqueueAdds;
  window.testP7_03_DequeueRemoves = testP7_03_DequeueRemoves;
  window.testP7_04_PriorityOrdering = testP7_04_PriorityOrdering;
  window.testP7_05_ConcurrencyLimit = testP7_05_ConcurrencyLimit;
  window.testP7_06_PauseStops = testP7_06_PauseStops;
  window.testP7_07_ResumeContinues = testP7_07_ResumeContinues;
  window.testP7_08_MaxSizeEnforced = testP7_08_MaxSizeEnforced;
  window.testP7_09_OnQueueChangeCallback = testP7_09_OnQueueChangeCallback;
  window.testP7_10_Integration = testP7_10_Integration;

  console.log("[Phase 7 Tests] Stage 6 Phase 7 tests loaded");
  console.log("[Phase 7 Tests] Run: await runAllStage6Phase7Tests()");
})();
