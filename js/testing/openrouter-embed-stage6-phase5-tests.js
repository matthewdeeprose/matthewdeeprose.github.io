/**
 * OpenRouter Embed API - Stage 6 Phase 5 Tests
 *
 * Response Caching Tests
 *
 * Tests: 10
 * - P5-01: Module exists with all required methods
 * - P5-02: get() returns cached response
 * - P5-03: get() returns null for uncached
 * - P5-04: TTL expires entries
 * - P5-05: maxEntries evicts oldest (LRU)
 * - P5-06: Custom keyGenerator used
 * - P5-07: excludeModels prevents caching
 * - P5-08: Statistics tracked correctly
 * - P5-09: clear() removes all entries
 * - P5-10: Integration with OpenRouterEmbed
 *
 * @version 6.5.0
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
      console.error(`[Phase5Tests ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[Phase5Tests WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[Phase5Tests INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[Phase5Tests DEBUG] ${message}`, ...args);
  }

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
   * Create a fresh cache instance for testing
   */
  function createTestCache(config = {}) {
    if (!window.EmbedCacheClass) {
      throw new Error("EmbedCacheClass not available");
    }
    return new window.EmbedCacheClass(config);
  }

  /**
   * Create a mock request object
   */
  function createMockRequest(overrides = {}) {
    return {
      userPrompt: "Test prompt " + Math.random().toString(36).substring(7),
      systemPrompt: "You are a helpful assistant",
      model: "test-model",
      temperature: 0.7,
      max_tokens: 2000,
      ...overrides,
    };
  }

  /**
   * Create a mock response object
   */
  function createMockResponse(overrides = {}) {
    return {
      text: "Test response " + Math.random().toString(36).substring(7),
      html: "<p>Test response</p>",
      markdown: "Test response",
      raw: { model: "test-model" },
      metadata: {
        model: "test-model",
        tokens: { prompt: 10, completion: 20, total: 30 },
        processingTime: 100,
      },
      ...overrides,
    };
  }

  /**
   * Create test container for OpenRouterEmbed
   */
  function createTestEnvironment(prefix = "cache-test") {
    const container = document.createElement("div");
    container.id = `${prefix}-container-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    document.body.appendChild(container);

    return {
      container,
      containerId: container.id,
      cleanup: () => container.remove(),
    };
  }

  // ============================================================================
  // PHASE 5 TESTS
  // ============================================================================

  /**
   * P5-01: Module exists with all required methods
   */
  async function testP5_01_ModuleExists() {
    logInfo("P5-01: Testing module exists with all required methods...");

    try {
      // Check singleton exists
      if (!window.EmbedCache) {
        return { success: false, error: "EmbedCache singleton not found" };
      }

      // Check class exists
      if (!window.EmbedCacheClass) {
        return { success: false, error: "EmbedCacheClass not found" };
      }

      // Check all required methods on singleton
      const requiredMethods = [
        "configure",
        "get",
        "set",
        "has",
        "delete",
        "clear",
        "getStats",
        "resetStats",
        "generateKey",
        "getConfig",
        "cleanup",
        "reset",
      ];

      for (const method of requiredMethods) {
        if (typeof window.EmbedCache[method] !== "function") {
          return {
            success: false,
            error: `Method '${method}' not found or not a function`,
          };
        }
      }

      // Verify class can be instantiated
      const cache = new window.EmbedCacheClass();
      if (!cache) {
        return {
          success: false,
          error: "Failed to instantiate EmbedCacheClass",
        };
      }

      logInfo("P5-01: ✓ All methods present");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P5-02: get() returns cached response
   */
  async function testP5_02_GetReturnsCached() {
    logInfo("P5-02: Testing get() returns cached response...");

    try {
      const cache = createTestCache({ enabled: true });
      const request = createMockRequest({ userPrompt: "Hello world" });
      const response = createMockResponse({ text: "Hi there!" });

      // Cache the response
      const setResult = cache.set(request, response);
      if (!setResult) {
        return { success: false, error: "set() returned false" };
      }

      // Retrieve it
      const cached = cache.get(request);

      if (!cached) {
        return {
          success: false,
          error: "get() returned null for cached response",
        };
      }

      if (cached.text !== response.text) {
        return {
          success: false,
          error: `Response text mismatch: expected '${response.text}', got '${cached.text}'`,
        };
      }

      logInfo("P5-02: ✓ get() returns cached response correctly");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P5-03: get() returns null for uncached
   */
  async function testP5_03_GetReturnsNull() {
    logInfo("P5-03: Testing get() returns null for uncached request...");

    try {
      const cache = createTestCache({ enabled: true });
      cache.clear(); // Ensure empty

      const request = createMockRequest({ userPrompt: "Unknown request" });

      const result = cache.get(request);

      if (result !== null) {
        return {
          success: false,
          error: `Expected null, got ${typeof result}`,
        };
      }

      // Also test with cache disabled
      const disabledCache = createTestCache({ enabled: false });
      disabledCache.set(request, createMockResponse());
      const disabledResult = disabledCache.get(request);

      if (disabledResult !== null) {
        return {
          success: false,
          error: "Disabled cache should return null",
        };
      }

      logInfo("P5-03: ✓ get() returns null for uncached request");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P5-04: TTL expires entries
   */
  async function testP5_04_TTLExpiresEntries() {
    logInfo("P5-04: Testing TTL expiration...");

    try {
      // Use a very short TTL for testing
      const cache = createTestCache({
        enabled: true,
        ttl: 100, // 100ms TTL
      });

      const request = createMockRequest({ userPrompt: "TTL test" });
      const response = createMockResponse({ text: "TTL response" });

      // Cache the response
      cache.set(request, response);

      // Should be available immediately
      const immediate = cache.get(request);
      if (!immediate) {
        return { success: false, error: "Response not cached initially" };
      }

      // Wait for TTL to expire
      await wait(150);

      // Should be expired now
      const expired = cache.get(request);
      if (expired !== null) {
        return {
          success: false,
          error: "Response should have expired after TTL",
        };
      }

      // Verify eviction was tracked
      const stats = cache.getStats();
      if (stats.evictions < 1) {
        return {
          success: false,
          error: "Eviction not tracked in statistics",
        };
      }

      logInfo("P5-04: ✓ TTL expires entries correctly");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P5-05: maxEntries evicts oldest (LRU)
   */
  async function testP5_05_MaxEntriesEvictsOldest() {
    logInfo("P5-05: Testing maxEntries LRU eviction...");

    try {
      const cache = createTestCache({
        enabled: true,
        maxEntries: 3,
        ttl: 60000, // Long TTL so expiration doesn't interfere
      });

      // Add 3 entries
      const requests = [];
      for (let i = 0; i < 3; i++) {
        const request = createMockRequest({ userPrompt: `Entry ${i}` });
        const response = createMockResponse({ text: `Response ${i}` });
        cache.set(request, response);
        requests.push(request);
        await wait(10); // Ensure different access times
      }

      // Verify all 3 are cached
      if (cache.getStats().size !== 3) {
        return { success: false, error: "Expected 3 entries in cache" };
      }

      // Access first entry to make it "recently used"
      cache.get(requests[0]);
      await wait(10);

      // Add a 4th entry - should evict the least recently used (entry 1)
      const newRequest = createMockRequest({ userPrompt: "Entry 3" });
      const newResponse = createMockResponse({ text: "Response 3" });
      cache.set(newRequest, newResponse);

      // Should still have 3 entries
      if (cache.getStats().size !== 3) {
        return {
          success: false,
          error: `Expected 3 entries after eviction, got ${
            cache.getStats().size
          }`,
        };
      }

      // Entry 0 should still be cached (was accessed recently)
      if (!cache.has(requests[0])) {
        return {
          success: false,
          error: "Recently accessed entry should not be evicted",
        };
      }

      // Entry 1 should be evicted (least recently used)
      if (cache.has(requests[1])) {
        return {
          success: false,
          error: "Least recently used entry should be evicted",
        };
      }

      // Verify eviction was tracked
      if (cache.getStats().evictions < 1) {
        return { success: false, error: "Eviction not tracked" };
      }

      logInfo("P5-05: ✓ maxEntries evicts oldest (LRU) correctly");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P5-06: Custom keyGenerator used
   */
  async function testP5_06_CustomKeyGenerator() {
    logInfo("P5-06: Testing custom keyGenerator...");

    try {
      let keyGeneratorCalled = false;
      let keyGeneratorRequest = null;

      const cache = createTestCache({
        enabled: true,
        keyGenerator: (request) => {
          keyGeneratorCalled = true;
          keyGeneratorRequest = request;
          return `custom_${request.userPrompt}`;
        },
      });

      const request = createMockRequest({ userPrompt: "custom-test" });
      const response = createMockResponse({ text: "Custom response" });

      // Set should use custom generator
      cache.set(request, response);

      if (!keyGeneratorCalled) {
        return { success: false, error: "Custom keyGenerator was not called" };
      }

      if (keyGeneratorRequest.userPrompt !== request.userPrompt) {
        return {
          success: false,
          error: "Custom keyGenerator received wrong request",
        };
      }

      // Verify key is what we expect
      const key = cache.generateKey(request);
      if (key !== "custom_custom-test") {
        return {
          success: false,
          error: `Expected custom key, got '${key}'`,
        };
      }

      // Get should also use custom generator and find the entry
      const cached = cache.get(request);
      if (!cached) {
        return {
          success: false,
          error: "get() failed to find entry with custom key",
        };
      }

      logInfo("P5-06: ✓ Custom keyGenerator used correctly");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P5-07: excludeModels prevents caching
   */
  async function testP5_07_ExcludeModels() {
    logInfo("P5-07: Testing excludeModels...");

    try {
      const cache = createTestCache({
        enabled: true,
        excludeModels: ["excluded-model", "another-excluded"],
      });

      // Request with excluded model
      const excludedRequest = createMockRequest({ model: "excluded-model" });
      const excludedResponse = createMockResponse({ text: "Should not cache" });

      // set() should return false for excluded model
      const setResult = cache.set(excludedRequest, excludedResponse);
      if (setResult !== false) {
        return {
          success: false,
          error: "set() should return false for excluded model",
        };
      }

      // get() should return null
      const cached = cache.get(excludedRequest);
      if (cached !== null) {
        return {
          success: false,
          error: "get() should return null for excluded model",
        };
      }

      // Non-excluded model should work
      const allowedRequest = createMockRequest({ model: "allowed-model" });
      const allowedResponse = createMockResponse({ text: "Should cache" });

      cache.set(allowedRequest, allowedResponse);
      const allowedCached = cache.get(allowedRequest);

      if (!allowedCached) {
        return {
          success: false,
          error: "Non-excluded model should be cached",
        };
      }

      logInfo("P5-07: ✓ excludeModels works correctly");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P5-08: Statistics tracked correctly
   */
  async function testP5_08_StatisticsTracked() {
    logInfo("P5-08: Testing statistics tracking...");

    try {
      const cache = createTestCache({ enabled: true });
      cache.resetStats();

      const request1 = createMockRequest({ userPrompt: "Stats test 1" });
      const request2 = createMockRequest({ userPrompt: "Stats test 2" });
      const response = createMockResponse();

      // Initial stats
      let stats = cache.getStats();
      if (stats.hits !== 0 || stats.misses !== 0 || stats.sets !== 0) {
        return { success: false, error: "Initial stats should be zero" };
      }

      // Miss (uncached request)
      cache.get(request1);
      stats = cache.getStats();
      if (stats.misses !== 1) {
        return {
          success: false,
          error: `Expected 1 miss, got ${stats.misses}`,
        };
      }

      // Set
      cache.set(request1, response);
      stats = cache.getStats();
      if (stats.sets !== 1) {
        return { success: false, error: `Expected 1 set, got ${stats.sets}` };
      }

      // Hit
      cache.get(request1);
      stats = cache.getStats();
      if (stats.hits !== 1) {
        return { success: false, error: `Expected 1 hit, got ${stats.hits}` };
      }

      // Another miss
      cache.get(request2);
      stats = cache.getStats();
      if (stats.misses !== 2) {
        return {
          success: false,
          error: `Expected 2 misses, got ${stats.misses}`,
        };
      }

      // Hit rate calculation
      // 1 hit, 2 misses = 1/3 = 0.333...
      const expectedHitRate = 1 / 3;
      if (Math.abs(stats.hitRate - expectedHitRate) > 0.01) {
        return {
          success: false,
          error: `Expected hitRate ~${expectedHitRate.toFixed(
            3
          )}, got ${stats.hitRate.toFixed(3)}`,
        };
      }

      // Reset stats
      cache.resetStats();
      stats = cache.getStats();
      if (stats.hits !== 0 || stats.misses !== 0) {
        return { success: false, error: "resetStats() did not clear stats" };
      }

      logInfo("P5-08: ✓ Statistics tracked correctly");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P5-09: clear() removes all entries
   */
  async function testP5_09_ClearRemovesAll() {
    logInfo("P5-09: Testing clear() removes all entries...");

    try {
      const cache = createTestCache({ enabled: true });

      // Add multiple entries
      for (let i = 0; i < 5; i++) {
        const request = createMockRequest({ userPrompt: `Clear test ${i}` });
        const response = createMockResponse({ text: `Response ${i}` });
        cache.set(request, response);
      }

      // Verify entries exist
      if (cache.getStats().size !== 5) {
        return { success: false, error: "Expected 5 entries before clear" };
      }

      // Clear
      cache.clear();

      // Verify empty
      if (cache.getStats().size !== 0) {
        return {
          success: false,
          error: `Expected 0 entries after clear, got ${cache.getStats().size}`,
        };
      }

      // Verify entries are truly gone
      for (let i = 0; i < 5; i++) {
        const request = createMockRequest({ userPrompt: `Clear test ${i}` });
        if (cache.has(request)) {
          return {
            success: false,
            error: `Entry ${i} still exists after clear`,
          };
        }
      }

      logInfo("P5-09: ✓ clear() removes all entries correctly");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * P5-10: Integration with OpenRouterEmbed
   */
  async function testP5_10_Integration() {
    logInfo("P5-10: Testing integration with OpenRouterEmbed...");

    try {
      // Check if OpenRouterEmbed is available
      if (!window.OpenRouterEmbed) {
        return {
          success: false,
          error: "OpenRouterEmbed not available - integration test skipped",
        };
      }

      // Check if required components are available
      if (!window.openRouterClient || !window.MarkdownEditor) {
        return {
          success: false,
          error: "Required components not available - integration test skipped",
        };
      }

      const env = createTestEnvironment("cache-integration");

      try {
        // Create embed with cache enabled
        const embed = new window.OpenRouterEmbed({
          containerId: env.containerId,
          cache: {
            enabled: true,
            maxEntries: 10,
            ttl: 60000,
          },
        });

        // Verify cache methods are available
        const expectedMethods = [
          "configureCache",
          "getCacheConfig",
          "getCacheStats",
          "clearCache",
          "isCacheEnabled",
        ];

        for (const method of expectedMethods) {
          if (typeof embed[method] !== "function") {
            return {
              success: false,
              error: `OpenRouterEmbed.${method}() not available - cache not integrated`,
            };
          }
        }

        // Test configuration
        const config = embed.getCacheConfig();
        if (!config.enabled) {
          return {
            success: false,
            error: "Cache should be enabled",
          };
        }

        // Test isCacheEnabled
        if (!embed.isCacheEnabled()) {
          return {
            success: false,
            error: "isCacheEnabled() should return true",
          };
        }

        // Test stats
        const stats = embed.getCacheStats();
        if (stats === null || typeof stats.hits !== "number") {
          return {
            success: false,
            error: "getCacheStats() should return valid stats object",
          };
        }

        // Test clearCache
        embed.clearCache();
        const clearedStats = embed.getCacheStats();
        if (clearedStats.size !== 0) {
          return {
            success: false,
            error: "clearCache() should empty the cache",
          };
        }

        logInfo("P5-10: ✓ Integration with OpenRouterEmbed works");
        return { success: true };
      } finally {
        env.cleanup();
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // TEST RUNNER
  // ============================================================================

  /**
   * Run all Phase 5 tests
   */
  async function runAllStage6Phase5Tests() {
    console.log("\n" + "=".repeat(60));
    console.log("OpenRouter Embed - Stage 6 Phase 5 Tests");
    console.log("Response Caching");
    console.log("=".repeat(60) + "\n");

    const tests = [
      { id: "P5-01", name: "Module exists", fn: testP5_01_ModuleExists },
      {
        id: "P5-02",
        name: "get() returns cached",
        fn: testP5_02_GetReturnsCached,
      },
      { id: "P5-03", name: "get() returns null", fn: testP5_03_GetReturnsNull },
      {
        id: "P5-04",
        name: "TTL expires entries",
        fn: testP5_04_TTLExpiresEntries,
      },
      {
        id: "P5-05",
        name: "maxEntries evicts oldest",
        fn: testP5_05_MaxEntriesEvictsOldest,
      },
      {
        id: "P5-06",
        name: "Custom keyGenerator",
        fn: testP5_06_CustomKeyGenerator,
      },
      { id: "P5-07", name: "excludeModels works", fn: testP5_07_ExcludeModels },
      {
        id: "P5-08",
        name: "Statistics tracked",
        fn: testP5_08_StatisticsTracked,
      },
      { id: "P5-09", name: "clear() works", fn: testP5_09_ClearRemovesAll },
      { id: "P5-10", name: "Integration works", fn: testP5_10_Integration },
    ];

    let passed = 0;
    let failed = 0;
    const results = [];

    for (const test of tests) {
      try {
        console.log(`Running ${test.id}: ${test.name}...`);
        const result = await test.fn();

        if (result.success) {
          console.log(`  ✅ PASSED`);
          passed++;
        } else {
          console.log(`  ❌ FAILED: ${result.error}`);
          failed++;
        }

        results.push({
          id: test.id,
          name: test.name,
          ...result,
        });
      } catch (error) {
        console.log(`  ❌ FAILED (exception): ${error.message}`);
        failed++;
        results.push({
          id: test.id,
          name: test.name,
          success: false,
          error: error.message,
        });
      }
    }

    console.log("\n" + "-".repeat(60));
    console.log(`Results: ${passed}/${tests.length} passed`);

    if (failed === 0) {
      console.log("🎉 All Phase 5 tests passed!");
    } else {
      console.log(`⚠️  ${failed} test(s) failed`);
    }
    console.log("-".repeat(60) + "\n");

    return {
      passed,
      failed,
      total: tests.length,
      results,
    };
  }

  /**
   * Run regression tests (verify previous phases still work)
   */
  async function testStage6Phase5_Regressions() {
    console.log("\n" + "=".repeat(60));
    console.log("Stage 6 Phase 5 - Regression Tests");
    console.log("=".repeat(60) + "\n");

    const results = [];
    let passed = 0;
    let failed = 0;

    // Test 1: Events still work
    try {
      console.log("Testing events system...");
      if (window.EmbedEventEmitterClass) {
        const emitter = new window.EmbedEventEmitterClass();
        let called = false;
        emitter.on("test", () => {
          called = true;
        });
        emitter.emit("test", {});
        if (called) {
          console.log("  ✅ Events: PASSED");
          passed++;
        } else {
          console.log("  ❌ Events: FAILED - handler not called");
          failed++;
        }
      } else {
        console.log("  ⏭️  Events: SKIPPED (not available)");
      }
    } catch (error) {
      console.log(`  ❌ Events: FAILED - ${error.message}`);
      failed++;
    }

    // Test 2: Post-processor still works
    try {
      console.log("Testing post-processor...");
      if (window.EmbedPostProcessorClass) {
        const processor = new window.EmbedPostProcessorClass();
        processor.add("test", (response) => ({
          ...response,
          tested: true,
        }));
        const result = await processor.process({ text: "test" });
        if (result.tested) {
          console.log("  ✅ Post-processor: PASSED");
          passed++;
        } else {
          console.log("  ❌ Post-processor: FAILED - processor not applied");
          failed++;
        }
      } else {
        console.log("  ⏭️  Post-processor: SKIPPED (not available)");
      }
    } catch (error) {
      console.log(`  ❌ Post-processor: FAILED - ${error.message}`);
      failed++;
    }

    // Test 3: Throttle still works
    try {
      console.log("Testing throttle...");
      if (window.EmbedThrottleClass) {
        const throttle = new window.EmbedThrottleClass({ throttleInterval: 0 });
        if (throttle.canProceed() === true) {
          console.log("  ✅ Throttle: PASSED");
          passed++;
        } else {
          console.log("  ❌ Throttle: FAILED - unexpected canProceed result");
          failed++;
        }
      } else {
        console.log("  ⏭️  Throttle: SKIPPED (not available)");
      }
    } catch (error) {
      console.log(`  ❌ Throttle: FAILED - ${error.message}`);
      failed++;
    }

    console.log("\n" + "-".repeat(60));
    console.log(`Regression Results: ${passed} passed, ${failed} failed`);
    console.log("-".repeat(60) + "\n");

    return { passed, failed };
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.runAllStage6Phase5Tests = runAllStage6Phase5Tests;
  window.testStage6Phase5_Regressions = testStage6Phase5_Regressions;

  // Individual test exposure
  window.testP5_01_ModuleExists = testP5_01_ModuleExists;
  window.testP5_02_GetReturnsCached = testP5_02_GetReturnsCached;
  window.testP5_03_GetReturnsNull = testP5_03_GetReturnsNull;
  window.testP5_04_TTLExpiresEntries = testP5_04_TTLExpiresEntries;
  window.testP5_05_MaxEntriesEvictsOldest = testP5_05_MaxEntriesEvictsOldest;
  window.testP5_06_CustomKeyGenerator = testP5_06_CustomKeyGenerator;
  window.testP5_07_ExcludeModels = testP5_07_ExcludeModels;
  window.testP5_08_StatisticsTracked = testP5_08_StatisticsTracked;
  window.testP5_09_ClearRemovesAll = testP5_09_ClearRemovesAll;
  window.testP5_10_Integration = testP5_10_Integration;
})();
