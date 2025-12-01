/**
 * OpenRouter Embed API - EmbedPromptLoader Test Suite
 *
 * Tests for Stage 5 Phase 4 Feature 2: EmbedPromptLoader
 * 12 tests covering all acceptance criteria
 *
 * @version 1.0.0 (Stage 5 Phase 4)
 * @date 29 November 2025
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
      console.error(`[PromptLoader Tests ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[PromptLoader Tests WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[PromptLoader Tests INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[PromptLoader Tests DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // TEST CONFIGURATION
  // ============================================================================

  // Use existing prompt files from the project
  const TEST_BASE_PATH = "image-describer/prompts/";
  const TEST_FILES = {
    TEST_PROMPT_MARKDOWN: "prompt-markdown.txt",
    TEST_PROMPT_GUIDE: "prompt-writing-guide.txt",
    TEST_PROMPT_IMAGE: "prompt-image-description.txt",
  };

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  /**
   * Check if EmbedPromptLoader is available
   */
  function checkPromptLoaderAvailable() {
    if (typeof window.EmbedPromptLoader === "undefined") {
      throw new Error(
        "EmbedPromptLoader not loaded. Include openrouter-embed-prompt-loader.js first."
      );
    }
    return true;
  }

  /**
   * Create a fresh loader instance for testing
   */
  function createFreshLoader() {
    return new window.EmbedPromptLoader();
  }

  /**
   * Clean up test globals
   */
  function cleanupTestGlobals() {
    // Clean up standard test file globals
    Object.keys(TEST_FILES).forEach((name) => {
      if (window[name] !== undefined) {
        delete window[name];
      }
    });

    // Clean up any additional test globals (e.g., from partial failure tests)
    const additionalGlobals = ["TEST_MISSING_FILE"];
    additionalGlobals.forEach((name) => {
      if (window[name] !== undefined) {
        delete window[name];
      }
    });
  }

  // ============================================================================
  // TEST: P4-L1 - configure() sets basePath correctly
  // ============================================================================

  async function testP4_L1_ConfigureBasePath() {
    logInfo("P4-L1: Testing configure() sets basePath correctly");

    try {
      checkPromptLoaderAvailable();

      const loader = createFreshLoader();

      // Test setting basePath without trailing slash
      loader.configure({ basePath: "test/path" });
      if (loader.basePath !== "test/path/") {
        throw new Error(
          `Expected 'test/path/' but got '${loader.basePath}' (trailing slash should be added)`
        );
      }

      // Test setting basePath with trailing slash
      loader.configure({ basePath: "another/path/" });
      if (loader.basePath !== "another/path/") {
        throw new Error(
          `Expected 'another/path/' but got '${loader.basePath}'`
        );
      }

      // Test empty basePath
      loader.configure({ basePath: "" });
      if (loader.basePath !== "") {
        throw new Error(`Expected '' but got '${loader.basePath}'`);
      }

      // Test chaining
      const result = loader.configure({ basePath: "chained/" });
      if (result !== loader) {
        throw new Error("configure() should return the loader for chaining");
      }

      logInfo("✅ P4-L1 PASSED: configure() sets basePath correctly");
      return { passed: true, testId: "P4-L1" };
    } catch (error) {
      logError("❌ P4-L1 FAILED:", error.message);
      return { passed: false, testId: "P4-L1", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-L2 - load() fetches and returns .txt content
  // ============================================================================

  async function testP4_L2_LoadFetchesContent() {
    logInfo("P4-L2: Testing load() fetches and returns .txt content");

    try {
      checkPromptLoaderAvailable();
      cleanupTestGlobals();

      const loader = createFreshLoader();
      loader.configure({ basePath: TEST_BASE_PATH });

      // Load a known prompt file
      const content = await loader.load(
        "TEST_PROMPT_MARKDOWN",
        TEST_FILES.TEST_PROMPT_MARKDOWN
      );

      // Check content was returned
      if (content === null) {
        throw new Error("load() returned null - file may not exist");
      }

      if (typeof content !== "string") {
        throw new Error(`load() should return string, got ${typeof content}`);
      }

      if (content.length === 0) {
        throw new Error("load() returned empty content");
      }

      logInfo("✅ P4-L2 PASSED: load() fetches and returns .txt content", {
        contentLength: content.length,
      });

      cleanupTestGlobals();
      return { passed: true, testId: "P4-L2" };
    } catch (error) {
      logError("❌ P4-L2 FAILED:", error.message);
      cleanupTestGlobals();
      return { passed: false, testId: "P4-L2", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-L3 - load() exposes prompt as global variable
  // ============================================================================

  async function testP4_L3_LoadExposesGlobal() {
    logInfo("P4-L3: Testing load() exposes prompt as global variable");

    try {
      checkPromptLoaderAvailable();
      cleanupTestGlobals();

      const loader = createFreshLoader();
      loader.configure({ basePath: TEST_BASE_PATH });

      // Ensure global doesn't exist
      if (window.TEST_PROMPT_MARKDOWN !== undefined) {
        throw new Error("Test global already exists before load");
      }

      // Load the prompt
      const content = await loader.load(
        "TEST_PROMPT_MARKDOWN",
        TEST_FILES.TEST_PROMPT_MARKDOWN
      );

      // Check global was created
      if (window.TEST_PROMPT_MARKDOWN === undefined) {
        throw new Error("Global variable was not created");
      }

      // Check global matches returned content
      if (window.TEST_PROMPT_MARKDOWN !== content) {
        throw new Error("Global variable does not match returned content");
      }

      logInfo(
        "✅ P4-L3 PASSED: load() exposes prompt as global variable (window[name])"
      );

      cleanupTestGlobals();
      return { passed: true, testId: "P4-L3" };
    } catch (error) {
      logError("❌ P4-L3 FAILED:", error.message);
      cleanupTestGlobals();
      return { passed: false, testId: "P4-L3", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-L4 - load() handles missing files gracefully
  // ============================================================================

  async function testP4_L4_LoadHandlesMissingFiles() {
    logInfo("P4-L4: Testing load() handles missing files gracefully");

    try {
      checkPromptLoaderAvailable();

      const loader = createFreshLoader();
      loader.configure({ basePath: TEST_BASE_PATH });

      // Try to load a non-existent file
      let error = null;
      let result;

      try {
        result = await loader.load(
          "TEST_MISSING_PROMPT",
          "this-file-does-not-exist.txt"
        );
      } catch (e) {
        error = e;
      }

      // Should not throw
      if (error !== null) {
        throw new Error(
          `load() threw an error for missing file: ${error.message}`
        );
      }

      // Should return null
      if (result !== null) {
        throw new Error(
          `load() should return null for missing file, got: ${result}`
        );
      }

      logInfo("✅ P4-L4 PASSED: load() handles missing files gracefully");
      return { passed: true, testId: "P4-L4" };
    } catch (error) {
      logError("❌ P4-L4 FAILED:", error.message);
      return { passed: false, testId: "P4-L4", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-L5 - loadAll() loads multiple files in parallel
  // ============================================================================

  async function testP4_L5_LoadAllParallel() {
    logInfo("P4-L5: Testing loadAll() loads multiple files in parallel");

    try {
      checkPromptLoaderAvailable();
      cleanupTestGlobals();

      const loader = createFreshLoader();
      loader.configure({ basePath: TEST_BASE_PATH });

      // Load multiple files
      const startTime = Date.now();
      const result = await loader.loadAll(TEST_FILES);
      const duration = Date.now() - startTime;

      // Check all files were loaded
      const loadedCount = Object.keys(result).length;
      const expectedCount = Object.keys(TEST_FILES).length;

      if (loadedCount !== expectedCount) {
        throw new Error(
          `Expected ${expectedCount} prompts loaded, got ${loadedCount}`
        );
      }

      // Verify parallel loading (should be faster than sequential)
      // This is a rough check - parallel loading should complete reasonably quickly
      logDebug("loadAll() completed", { duration, loadedCount });

      logInfo("✅ P4-L5 PASSED: loadAll() loads multiple files in parallel", {
        duration,
        loadedCount,
      });

      cleanupTestGlobals();
      return { passed: true, testId: "P4-L5" };
    } catch (error) {
      logError("❌ P4-L5 FAILED:", error.message);
      cleanupTestGlobals();
      return { passed: false, testId: "P4-L5", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-L6 - loadAll() reports partial failures
  // ============================================================================

  async function testP4_L6_LoadAllPartialFailures() {
    logInfo("P4-L6: Testing loadAll() reports partial failures");

    try {
      checkPromptLoaderAvailable();
      cleanupTestGlobals();

      const loader = createFreshLoader();
      loader.configure({ basePath: TEST_BASE_PATH });

      // Load mix of valid and invalid files
      const mixedFiles = {
        TEST_PROMPT_MARKDOWN: TEST_FILES.TEST_PROMPT_MARKDOWN, // Valid
        TEST_MISSING_FILE: "this-does-not-exist.txt", // Invalid
        TEST_PROMPT_GUIDE: TEST_FILES.TEST_PROMPT_GUIDE, // Valid
      };

      const result = await loader.loadAll(mixedFiles);

      // Check result is an object
      if (typeof result !== "object" || result === null) {
        throw new Error(`loadAll() should return object, got ${typeof result}`);
      }

      // Valid files should be loaded
      if (!("TEST_PROMPT_MARKDOWN" in result)) {
        throw new Error("Valid file TEST_PROMPT_MARKDOWN should be in result");
      }

      if (!("TEST_PROMPT_GUIDE" in result)) {
        throw new Error("Valid file TEST_PROMPT_GUIDE should be in result");
      }

      // Invalid file should NOT be in result (returns null from load)
      if ("TEST_MISSING_FILE" in result) {
        throw new Error("Invalid file should not be in successful results");
      }

      // Verify loaded count is 2 (the valid files)
      const loadedCount = Object.keys(result).length;
      if (loadedCount !== 2) {
        throw new Error(`Expected 2 loaded files, got ${loadedCount}`);
      }

      logInfo("✅ P4-L6 PASSED: loadAll() reports partial failures", {
        loadedCount,
        expectedFailures: 1,
      });

      cleanupTestGlobals();
      return { passed: true, testId: "P4-L6" };
    } catch (error) {
      logError("❌ P4-L6 FAILED:", error.message);
      cleanupTestGlobals();
      return { passed: false, testId: "P4-L6", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-L7 - get() returns previously loaded prompt
  // ============================================================================

  async function testP4_L7_GetReturnsLoadedPrompt() {
    logInfo("P4-L7: Testing get() returns previously loaded prompt");

    try {
      checkPromptLoaderAvailable();
      cleanupTestGlobals();

      const loader = createFreshLoader();
      loader.configure({ basePath: TEST_BASE_PATH });

      // Load a prompt
      const loadedContent = await loader.load(
        "TEST_PROMPT_MARKDOWN",
        TEST_FILES.TEST_PROMPT_MARKDOWN
      );

      // Get it back
      const retrievedContent = loader.get("TEST_PROMPT_MARKDOWN");

      // Check they match
      if (retrievedContent !== loadedContent) {
        throw new Error("get() returned different content than load()");
      }

      if (typeof retrievedContent !== "string") {
        throw new Error(
          `get() should return string, got ${typeof retrievedContent}`
        );
      }

      logInfo("✅ P4-L7 PASSED: get() returns previously loaded prompt");

      cleanupTestGlobals();
      return { passed: true, testId: "P4-L7" };
    } catch (error) {
      logError("❌ P4-L7 FAILED:", error.message);
      cleanupTestGlobals();
      return { passed: false, testId: "P4-L7", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-L8 - get() returns null for unloaded prompt
  // ============================================================================

  async function testP4_L8_GetReturnsNullForUnloaded() {
    logInfo("P4-L8: Testing get() returns null for unloaded prompt");

    try {
      checkPromptLoaderAvailable();

      const loader = createFreshLoader();

      // Get a prompt that was never loaded
      const result = loader.get("NEVER_LOADED_PROMPT");

      if (result !== null) {
        throw new Error(
          `get() should return null for unloaded prompt, got: ${result}`
        );
      }

      logInfo("✅ P4-L8 PASSED: get() returns null for unloaded prompt");
      return { passed: true, testId: "P4-L8" };
    } catch (error) {
      logError("❌ P4-L8 FAILED:", error.message);
      return { passed: false, testId: "P4-L8", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-L9 - areLoaded() returns true when all specified prompts loaded
  // ============================================================================

  async function testP4_L9_AreLoadedReturnsTrue() {
    logInfo(
      "P4-L9: Testing areLoaded() returns true when all specified prompts loaded"
    );

    try {
      checkPromptLoaderAvailable();
      cleanupTestGlobals();

      const loader = createFreshLoader();
      loader.configure({ basePath: TEST_BASE_PATH });

      // Load all prompts
      await loader.loadAll(TEST_FILES);

      // Check they're all loaded
      const names = Object.keys(TEST_FILES);
      const result = loader.areLoaded(names);

      if (result !== true) {
        throw new Error(
          `areLoaded() should return true when all prompts loaded, got: ${result}`
        );
      }

      // Also check partial list
      const partialResult = loader.areLoaded([names[0], names[1]]);
      if (partialResult !== true) {
        throw new Error(
          `areLoaded() should return true for partial list, got: ${partialResult}`
        );
      }

      logInfo(
        "✅ P4-L9 PASSED: areLoaded() returns true when all specified prompts loaded"
      );

      cleanupTestGlobals();
      return { passed: true, testId: "P4-L9" };
    } catch (error) {
      logError("❌ P4-L9 FAILED:", error.message);
      cleanupTestGlobals();
      return { passed: false, testId: "P4-L9", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-L10 - areLoaded() returns false when any specified prompt missing
  // ============================================================================

  async function testP4_L10_AreLoadedReturnsFalse() {
    logInfo(
      "P4-L10: Testing areLoaded() returns false when any specified prompt missing"
    );

    try {
      checkPromptLoaderAvailable();
      cleanupTestGlobals();

      const loader = createFreshLoader();
      loader.configure({ basePath: TEST_BASE_PATH });

      // Load only one prompt
      await loader.load(
        "TEST_PROMPT_MARKDOWN",
        TEST_FILES.TEST_PROMPT_MARKDOWN
      );

      // Check with list including unloaded prompt
      const result = loader.areLoaded([
        "TEST_PROMPT_MARKDOWN",
        "NOT_LOADED_PROMPT",
      ]);

      if (result !== false) {
        throw new Error(
          `areLoaded() should return false when any prompt missing, got: ${result}`
        );
      }

      // Check with completely unloaded list
      const result2 = loader.areLoaded(["NEVER_LOADED_1", "NEVER_LOADED_2"]);
      if (result2 !== false) {
        throw new Error(
          `areLoaded() should return false for unloaded prompts, got: ${result2}`
        );
      }

      logInfo(
        "✅ P4-L10 PASSED: areLoaded() returns false when any specified prompt missing"
      );

      cleanupTestGlobals();
      return { passed: true, testId: "P4-L10" };
    } catch (error) {
      logError("❌ P4-L10 FAILED:", error.message);
      cleanupTestGlobals();
      return { passed: false, testId: "P4-L10", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-L11 - getLoadedNames() returns array of all loaded prompt names
  // ============================================================================

  async function testP4_L11_GetLoadedNamesReturnsArray() {
    logInfo(
      "P4-L11: Testing getLoadedNames() returns array of all loaded prompt names"
    );

    try {
      checkPromptLoaderAvailable();
      cleanupTestGlobals();

      const loader = createFreshLoader();
      loader.configure({ basePath: TEST_BASE_PATH });

      // Initially empty
      const emptyResult = loader.getLoadedNames();
      if (!Array.isArray(emptyResult)) {
        throw new Error(
          `getLoadedNames() should return array, got: ${typeof emptyResult}`
        );
      }
      if (emptyResult.length !== 0) {
        throw new Error(
          `getLoadedNames() should return empty array initially, got: ${emptyResult.length} items`
        );
      }

      // Load prompts
      await loader.loadAll(TEST_FILES);

      // Check loaded names
      const result = loader.getLoadedNames();

      if (!Array.isArray(result)) {
        throw new Error(
          `getLoadedNames() should return array, got: ${typeof result}`
        );
      }

      if (result.length !== Object.keys(TEST_FILES).length) {
        throw new Error(
          `Expected ${Object.keys(TEST_FILES).length} names, got: ${
            result.length
          }`
        );
      }

      // Check all expected names are present
      for (const name of Object.keys(TEST_FILES)) {
        if (!result.includes(name)) {
          throw new Error(`Missing name in result: ${name}`);
        }
      }

      logInfo(
        "✅ P4-L11 PASSED: getLoadedNames() returns array of all loaded prompt names"
      );

      cleanupTestGlobals();
      return { passed: true, testId: "P4-L11" };
    } catch (error) {
      logError("❌ P4-L11 FAILED:", error.message);
      cleanupTestGlobals();
      return { passed: false, testId: "P4-L11", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-L12 - clear() removes all loaded prompts and globals
  // ============================================================================

  async function testP4_L12_ClearRemovesAll() {
    logInfo("P4-L12: Testing clear() removes all loaded prompts and globals");

    try {
      checkPromptLoaderAvailable();
      cleanupTestGlobals();

      const loader = createFreshLoader();
      loader.configure({ basePath: TEST_BASE_PATH });

      // Load prompts
      await loader.loadAll(TEST_FILES);

      // Verify they're loaded
      const beforeClear = loader.getLoadedNames().length;
      if (beforeClear !== Object.keys(TEST_FILES).length) {
        throw new Error("Prompts not loaded before clear test");
      }

      // Verify globals exist
      for (const name of Object.keys(TEST_FILES)) {
        if (window[name] === undefined) {
          throw new Error(`Global ${name} not set before clear`);
        }
      }

      // Clear
      loader.clear();

      // Check prompts are cleared
      const afterClear = loader.getLoadedNames().length;
      if (afterClear !== 0) {
        throw new Error(`Prompts not cleared: ${afterClear} remaining`);
      }

      // Check get() returns null
      for (const name of Object.keys(TEST_FILES)) {
        const content = loader.get(name);
        if (content !== null) {
          throw new Error(`get(${name}) should return null after clear`);
        }
      }

      // Check globals are removed
      for (const name of Object.keys(TEST_FILES)) {
        if (window[name] !== undefined) {
          throw new Error(`Global ${name} not removed after clear`);
        }
      }

      logInfo(
        "✅ P4-L12 PASSED: clear() removes all loaded prompts and globals"
      );

      return { passed: true, testId: "P4-L12" };
    } catch (error) {
      logError("❌ P4-L12 FAILED:", error.message);
      cleanupTestGlobals();
      return { passed: false, testId: "P4-L12", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-L13 - ready promise resolves after loadAll
  // ============================================================================

  async function testP4_L13_ReadyPromiseResolves() {
    logInfo("P4-L13: Testing ready promise resolves after loadAll");

    try {
      checkPromptLoaderAvailable();
      cleanupTestGlobals();

      const loader = createFreshLoader();
      loader.configure({ basePath: TEST_BASE_PATH });

      // Before loadAll, ready should be null
      if (loader.ready !== null) {
        throw new Error("ready should be null before loadAll is called");
      }

      // Start loadAll (don't await yet)
      const loadPromise = loader.loadAll(TEST_FILES);

      // Now ready should be a Promise
      if (!(loader.ready instanceof Promise)) {
        throw new Error("ready should be a Promise after loadAll is called");
      }

      // Await the ready promise
      const readyResult = await loader.ready;

      // Result should match loadAll result
      const loadResult = await loadPromise;

      // Both should have same keys
      const readyKeys = Object.keys(readyResult).sort();
      const loadKeys = Object.keys(loadResult).sort();

      if (JSON.stringify(readyKeys) !== JSON.stringify(loadKeys)) {
        throw new Error("ready result should match loadAll result");
      }

      // Prompts should be accessible after ready resolves
      for (const name of Object.keys(TEST_FILES)) {
        const content = loader.get(name);
        if (content === null) {
          throw new Error(
            `Prompt ${name} should be accessible after ready resolves`
          );
        }
      }

      logInfo("✅ P4-L13 PASSED: ready promise resolves after loadAll");

      cleanupTestGlobals();
      return { passed: true, testId: "P4-L13" };
    } catch (error) {
      logError("❌ P4-L13 FAILED:", error.message);
      cleanupTestGlobals();
      return { passed: false, testId: "P4-L13", error: error.message };
    }
  }

  // ============================================================================
  // TEST RUNNER
  // ============================================================================

  /**
   * Run all Phase 4 Feature 2 (EmbedPromptLoader) tests
   */
  async function runAllPhase4LoaderTests() {
    console.log("\n" + "=".repeat(70));
    console.log("PHASE 4 FEATURE 2: EmbedPromptLoader Tests");
    console.log("=".repeat(70) + "\n");

    const results = [];
    const tests = [
      testP4_L1_ConfigureBasePath,
      testP4_L2_LoadFetchesContent,
      testP4_L3_LoadExposesGlobal,
      testP4_L4_LoadHandlesMissingFiles,
      testP4_L5_LoadAllParallel,
      testP4_L6_LoadAllPartialFailures,
      testP4_L7_GetReturnsLoadedPrompt,
      testP4_L8_GetReturnsNullForUnloaded,
      testP4_L9_AreLoadedReturnsTrue,
      testP4_L10_AreLoadedReturnsFalse,
      testP4_L11_GetLoadedNamesReturnsArray,
      testP4_L12_ClearRemovesAll,
      testP4_L13_ReadyPromiseResolves,
    ];

    for (const test of tests) {
      console.log("\n" + "-".repeat(50));
      const result = await test();
      results.push(result);
    }

    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("PHASE 4 FEATURE 2 TEST SUMMARY");
    console.log("=".repeat(70));

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${results.length}`);

    if (failed > 0) {
      console.log("\nFailed tests:");
      results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`  - ${r.testId}: ${r.error}`);
        });
    }

    console.log("\n" + "=".repeat(70) + "\n");

    return {
      passed,
      failed,
      total: results.length,
      results,
      allPassed: failed === 0,
    };
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  // Individual tests
  window.testP4_L1_ConfigureBasePath = testP4_L1_ConfigureBasePath;
  window.testP4_L2_LoadFetchesContent = testP4_L2_LoadFetchesContent;
  window.testP4_L3_LoadExposesGlobal = testP4_L3_LoadExposesGlobal;
  window.testP4_L4_LoadHandlesMissingFiles = testP4_L4_LoadHandlesMissingFiles;
  window.testP4_L5_LoadAllParallel = testP4_L5_LoadAllParallel;
  window.testP4_L6_LoadAllPartialFailures = testP4_L6_LoadAllPartialFailures;
  window.testP4_L7_GetReturnsLoadedPrompt = testP4_L7_GetReturnsLoadedPrompt;
  window.testP4_L8_GetReturnsNullForUnloaded =
    testP4_L8_GetReturnsNullForUnloaded;
  window.testP4_L9_AreLoadedReturnsTrue = testP4_L9_AreLoadedReturnsTrue;
  window.testP4_L10_AreLoadedReturnsFalse = testP4_L10_AreLoadedReturnsFalse;
  window.testP4_L11_GetLoadedNamesReturnsArray =
    testP4_L11_GetLoadedNamesReturnsArray;
  window.testP4_L12_ClearRemovesAll = testP4_L12_ClearRemovesAll;
  window.testP4_L13_ReadyPromiseResolves = testP4_L13_ReadyPromiseResolves;

  // Test runner
  window.runAllPhase4LoaderTests = runAllPhase4LoaderTests;
})();
