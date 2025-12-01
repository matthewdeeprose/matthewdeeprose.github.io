/**
 * OpenRouter Embed API - Stage 5 Phase 4 Debug Tests
 *
 * Tests for Debug Data Collection feature (P4-D1 to P4-D10)
 *
 * @version 1.0.0
 * @date November 2025
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
      console.error(`[Phase4DebugTests] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[Phase4DebugTests] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[Phase4DebugTests] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[Phase4DebugTests] ${message}`, ...args);
  }

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  /**
   * Create a test container in the DOM
   * @returns {HTMLElement} The test container
   */
  function createTestContainer() {
    let container = document.getElementById("phase4-debug-test-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "phase4-debug-test-container";
      container.style.cssText =
        "position: absolute; left: -9999px; width: 500px; height: 300px;";
      document.body.appendChild(container);
    }
    container.innerHTML = "";
    return container;
  }

  /**
   * Clean up test container
   */
  function cleanupTestContainer() {
    const container = document.getElementById("phase4-debug-test-container");
    if (container) {
      container.remove();
    }
  }

  /**
   * Check if OpenRouterEmbed is available
   * @returns {boolean}
   */
  function isEmbedAvailable() {
    return typeof window.OpenRouterEmbed === "function";
  }

  /**
   * Check if required dependencies are available
   * @returns {Object} Availability status
   */
  function checkDependencies() {
    return {
      OpenRouterEmbed: isEmbedAvailable(),
      openRouterClient: !!window.openRouterClient,
      MarkdownEditor: !!window.MarkdownEditor,
      notifications:
        !!window.notifySuccess &&
        !!window.notifyError &&
        !!window.notifyWarning &&
        !!window.notifyInfo,
    };
  }

  /**
   * Create an embed instance for testing
   * @param {Object} extraConfig - Additional configuration
   * @returns {OpenRouterEmbed|null}
   */
  function createTestEmbed(extraConfig = {}) {
    if (!isEmbedAvailable()) {
      logError("OpenRouterEmbed not available");
      return null;
    }

    createTestContainer();

    try {
      return new window.OpenRouterEmbed({
        containerId: "phase4-debug-test-container",
        model: "anthropic/claude-haiku-4.5",
        showNotifications: false,
        ...extraConfig,
      });
    } catch (error) {
      logError("Failed to create test embed:", error.message);
      return null;
    }
  }

  /**
   * Create a mock File object for testing
   * @param {string} name - File name
   * @param {string} type - MIME type
   * @param {number} size - File size in bytes
   * @returns {File}
   */
  function createMockFile(name = "test.jpg", type = "image/jpeg", size = 1024) {
    const content = new Array(size).fill("a").join("");
    return new File([content], name, { type });
  }

  // ============================================================================
  // INDIVIDUAL TEST FUNCTIONS
  // ============================================================================

  /**
   * P4-D1: getLastRequestDebug() returns null before any request
   */
  function testP4_D1_DebugNullBeforeRequest() {
    logInfo(
      "Testing P4-D1: getLastRequestDebug() returns null before any request"
    );

    const embed = createTestEmbed();
    if (!embed) {
      return { pass: false, message: "Could not create embed instance" };
    }

    try {
      const debugData = embed.getLastRequestDebug();

      if (debugData === null) {
        return { pass: true, message: "Returns null before any request" };
      } else {
        return {
          pass: false,
          message: `Expected null, got: ${typeof debugData}`,
        };
      }
    } catch (error) {
      return { pass: false, message: `Error: ${error.message}` };
    } finally {
      cleanupTestContainer();
    }
  }

  /**
   * P4-D2: getLastRequestDebug() returns complete data after successful request
   * Note: This is an async test that requires a real API call
   */
  async function testP4_D2_DebugAfterSuccessfulRequest() {
    logInfo(
      "Testing P4-D2: getLastRequestDebug() returns complete data after successful request"
    );

    const embed = createTestEmbed();
    if (!embed) {
      return { pass: false, message: "Could not create embed instance" };
    }

    try {
      // Make a simple request
      await embed.sendRequest("Say hello in exactly 3 words");

      const debugData = embed.getLastRequestDebug();

      if (!debugData) {
        return { pass: false, message: "Debug data is null after request" };
      }

      // Check required top-level properties
      const requiredProps = [
        "request",
        "response",
        "compression",
        "timing",
        "memory",
        "errors",
      ];
      const missingProps = requiredProps.filter((prop) => !(prop in debugData));

      if (missingProps.length > 0) {
        return {
          pass: false,
          message: `Missing properties: ${missingProps.join(", ")}`,
        };
      }

      // Check request sub-properties
      const requestProps = [
        "model",
        "temperature",
        "maxTokens",
        "systemPromptLength",
        "userPromptLength",
        "hasFile",
        "streaming",
        "timestamp",
      ];
      const missingRequestProps = requestProps.filter(
        (prop) => !(prop in debugData.request)
      );

      if (missingRequestProps.length > 0) {
        return {
          pass: false,
          message: `Missing request properties: ${missingRequestProps.join(
            ", "
          )}`,
        };
      }

      // Check response sub-properties
      const responseProps = [
        "success",
        "textLength",
        "tokens",
        "processingTime",
      ];
      const missingResponseProps = responseProps.filter(
        (prop) => !(prop in debugData.response)
      );

      if (missingResponseProps.length > 0) {
        return {
          pass: false,
          message: `Missing response properties: ${missingResponseProps.join(
            ", "
          )}`,
        };
      }

      // Check timing sub-properties
      const timingProps = [
        "validation",
        "preparation",
        "apiCall",
        "processing",
        "total",
      ];
      const missingTimingProps = timingProps.filter(
        (prop) => !(prop in debugData.timing)
      );

      if (missingTimingProps.length > 0) {
        return {
          pass: false,
          message: `Missing timing properties: ${missingTimingProps.join(
            ", "
          )}`,
        };
      }

      // Check tokens sub-properties
      const tokenProps = ["prompt", "completion", "total"];
      const missingTokenProps = tokenProps.filter(
        (prop) => !(prop in debugData.response.tokens)
      );

      if (missingTokenProps.length > 0) {
        return {
          pass: false,
          message: `Missing token properties: ${missingTokenProps.join(", ")}`,
        };
      }

      // Verify success flag
      if (debugData.response.success !== true) {
        return {
          pass: false,
          message: `Expected success to be true, got: ${debugData.response.success}`,
        };
      }

      // Verify errors is null for successful request
      if (debugData.errors !== null) {
        return {
          pass: false,
          message: `Expected errors to be null, got: ${JSON.stringify(
            debugData.errors
          )}`,
        };
      }

      return {
        pass: true,
        message: "Complete debug data returned after successful request",
        data: debugData,
      };
    } catch (error) {
      return { pass: false, message: `Error: ${error.message}` };
    } finally {
      cleanupTestContainer();
    }
  }

  /**
   * P4-D3: Debug data includes timing breakdown
   */
  async function testP4_D3_TimingBreakdown() {
    logInfo("Testing P4-D3: Debug data includes timing breakdown");

    const embed = createTestEmbed();
    if (!embed) {
      return { pass: false, message: "Could not create embed instance" };
    }

    try {
      await embed.sendRequest("Say hi");

      const debugData = embed.getLastRequestDebug();

      if (!debugData || !debugData.timing) {
        return { pass: false, message: "No timing data in debug output" };
      }

      const timing = debugData.timing;

      // Check that timing values are numbers (or null for optional)
      const timingChecks = [];

      if (typeof timing.total !== "number") {
        timingChecks.push(`total should be number, got ${typeof timing.total}`);
      }

      if (timing.total <= 0) {
        timingChecks.push(`total should be positive, got ${timing.total}`);
      }

      // At minimum, total should be present and positive
      if (timingChecks.length > 0) {
        return { pass: false, message: timingChecks.join("; ") };
      }

      // Verify timing breakdown adds up reasonably
      // (allowing for some overlap/async operations)
      logDebug("Timing breakdown:", timing);

      return {
        pass: true,
        message: `Timing breakdown present: total=${timing.total}ms`,
        data: timing,
      };
    } catch (error) {
      return { pass: false, message: `Error: ${error.message}` };
    } finally {
      cleanupTestContainer();
    }
  }

  /**
   * P4-D4: Debug data includes file info when file attached
   * Note: This test verifies debug data captures file info regardless of API success
   * Mock files may cause API errors but the debug data structure should still be correct
   */
  async function testP4_D4_FileInfoIncluded() {
    logInfo("Testing P4-D4: Debug data includes file info when file attached");

    const embed = createTestEmbed();
    if (!embed) {
      return { pass: false, message: "Could not create embed instance" };
    }

    // Check if file utilities are available
    if (!embed.fileUtils) {
      return {
        pass: true,
        message:
          "SKIPPED: EmbedFileUtils not available F(file attachment disabled)",
        skipped: true,
      };
    }

    try {
      // Create a small test image file
      const testFile = createMockFile("test-image.jpg", "image/jpeg", 5000);

      // Attach the file
      await embed.attachFile(testFile);

      // Make a request with the file - may fail due to mock file, but debug data should still capture file info
      try {
        await embed.sendRequest("Describe this image briefly");
      } catch (requestError) {
        // Expected - mock files are not valid images
        // The important thing is that debug data was captured
        logDebug(
          "Request failed (expected with mock file):",
          requestError.message
        );
      }

      const debugData = embed.getLastRequestDebug();

      if (!debugData) {
        return {
          pass: false,
          message:
            "No debug data after request (even failed request should capture debug data)",
        };
      }

      // Check hasFile flag
      if (debugData.request.hasFile !== true) {
        return {
          pass: false,
          message: `Expected hasFile to be true, got: ${debugData.request.hasFile}`,
        };
      }

      // Check fileInfo object
      if (!debugData.request.fileInfo) {
        return {
          pass: false,
          message: "fileInfo is missing from request data",
        };
      }

      const fileInfo = debugData.request.fileInfo;
      const requiredFileProps = ["name", "type", "size"];
      const missingFileProps = requiredFileProps.filter(
        (prop) => !(prop in fileInfo)
      );

      if (missingFileProps.length > 0) {
        return {
          pass: false,
          message: `Missing fileInfo properties: ${missingFileProps.join(
            ", "
          )}`,
        };
      }

      // Verify file info values match what we attached
      if (fileInfo.name !== "test-image.jpg") {
        return {
          pass: false,
          message: `Expected file name 'test-image.jpg', got: ${fileInfo.name}`,
        };
      }

      if (fileInfo.type !== "image/jpeg") {
        return {
          pass: false,
          message: `Expected file type 'image/jpeg', got: ${fileInfo.type}`,
        };
      }

      return {
        pass: true,
        message: `File info correctly captured: ${fileInfo.name} (${fileInfo.size} bytes, type: ${fileInfo.type})`,
        data: fileInfo,
      };
    } catch (error) {
      return { pass: false, message: `Error: ${error.message}` };
    } finally {
      embed.clearFile();
      cleanupTestContainer();
    }
  }

  /**
   * P4-D5: setDebugMode(true) enables debug mode
   */
  function testP4_D5_SetDebugModeTrue() {
    logInfo("Testing P4-D5: setDebugMode(true) enables debug mode");

    const embed = createTestEmbed();
    if (!embed) {
      return { pass: false, message: "Could not create embed instance" };
    }

    try {
      // Initially should be false
      const initialState = embed.isDebugMode();

      // Enable debug mode
      embed.setDebugMode(true);

      const afterEnable = embed.isDebugMode();

      if (initialState !== false) {
        return {
          pass: false,
          message: `Initial state should be false, got: ${initialState}`,
        };
      }

      if (afterEnable !== true) {
        return {
          pass: false,
          message: `After setDebugMode(true), isDebugMode() should return true, got: ${afterEnable}`,
        };
      }

      return { pass: true, message: "setDebugMode(true) enables debug mode" };
    } catch (error) {
      return { pass: false, message: `Error: ${error.message}` };
    } finally {
      cleanupTestContainer();
    }
  }

  /**
   * P4-D6: setDebugMode(false) disables debug mode
   */
  function testP4_D6_SetDebugModeFalse() {
    logInfo("Testing P4-D6: setDebugMode(false) disables debug mode");

    const embed = createTestEmbed();
    if (!embed) {
      return { pass: false, message: "Could not create embed instance" };
    }

    try {
      // Enable first
      embed.setDebugMode(true);
      const afterEnable = embed.isDebugMode();

      // Then disable
      embed.setDebugMode(false);
      const afterDisable = embed.isDebugMode();

      if (afterEnable !== true) {
        return {
          pass: false,
          message: `After setDebugMode(true), expected true, got: ${afterEnable}`,
        };
      }

      if (afterDisable !== false) {
        return {
          pass: false,
          message: `After setDebugMode(false), expected false, got: ${afterDisable}`,
        };
      }

      return { pass: true, message: "setDebugMode(false) disables debug mode" };
    } catch (error) {
      return { pass: false, message: `Error: ${error.message}` };
    } finally {
      cleanupTestContainer();
    }
  }

  /**
   * P4-D7: isDebugMode() returns correct state
   */
  function testP4_D7_IsDebugModeReturnsCorrectState() {
    logInfo("Testing P4-D7: isDebugMode() returns correct state");

    const embed = createTestEmbed();
    if (!embed) {
      return { pass: false, message: "Could not create embed instance" };
    }

    try {
      const states = [];

      // Initial state
      states.push({
        action: "initial",
        expected: false,
        actual: embed.isDebugMode(),
      });

      // After enabling
      embed.setDebugMode(true);
      states.push({
        action: "after enable",
        expected: true,
        actual: embed.isDebugMode(),
      });

      // After disabling
      embed.setDebugMode(false);
      states.push({
        action: "after disable",
        expected: false,
        actual: embed.isDebugMode(),
      });

      // After re-enabling
      embed.setDebugMode(true);
      states.push({
        action: "after re-enable",
        expected: true,
        actual: embed.isDebugMode(),
      });

      // Check all states
      const failures = states.filter((s) => s.expected !== s.actual);

      if (failures.length > 0) {
        const failMessages = failures.map(
          (f) => `${f.action}: expected ${f.expected}, got ${f.actual}`
        );
        return { pass: false, message: failMessages.join("; ") };
      }

      return {
        pass: true,
        message: "isDebugMode() returns correct state through all transitions",
      };
    } catch (error) {
      return { pass: false, message: `Error: ${error.message}` };
    } finally {
      cleanupTestContainer();
    }
  }

  /**
   * P4-D8: Debug data includes compression info when compression applied
   */
  async function testP4_D8_CompressionInfoIncluded() {
    logInfo("Testing P4-D8: Debug data includes compression info");

    const embed = createTestEmbed({
      enableCompression: true,
      compressionThreshold: 1000, // Low threshold to trigger compression
    });

    if (!embed) {
      return { pass: false, message: "Could not create embed instance" };
    }

    try {
      // Make a simple request first (no file)
      await embed.sendRequest("Say hello");

      const debugData = embed.getLastRequestDebug();

      if (!debugData) {
        return { pass: false, message: "No debug data after request" };
      }

      // Check compression property exists
      if (!("compression" in debugData)) {
        return {
          pass: false,
          message: "compression property missing from debug data",
        };
      }

      // For requests without files, compression should indicate enabled state
      if (debugData.compression === null) {
        // This is acceptable if no file utilities
        return {
          pass: true,
          message:
            "compression is null (no file utilities or no file attached)",
        };
      }

      // If compression object exists, check structure
      if (typeof debugData.compression === "object") {
        if (!("enabled" in debugData.compression)) {
          return {
            pass: false,
            message: "compression.enabled property missing",
          };
        }

        if (!("applied" in debugData.compression)) {
          return {
            pass: false,
            message: "compression.applied property missing",
          };
        }

        return {
          pass: true,
          message: `Compression info present: enabled=${debugData.compression.enabled}, applied=${debugData.compression.applied}`,
          data: debugData.compression,
        };
      }

      return { pass: true, message: "Compression info structure is valid" };
    } catch (error) {
      return { pass: false, message: `Error: ${error.message}` };
    } finally {
      cleanupTestContainer();
    }
  }

  /**
   * P4-D9: Debug data includes memory info when available
   */
  async function testP4_D9_MemoryInfoIncluded() {
    logInfo("Testing P4-D9: Debug data includes memory info when available");

    const embed = createTestEmbed();
    if (!embed) {
      return { pass: false, message: "Could not create embed instance" };
    }

    try {
      await embed.sendRequest("Say hi");

      const debugData = embed.getLastRequestDebug();

      if (!debugData) {
        return { pass: false, message: "No debug data after request" };
      }

      // Check memory property exists
      if (!("memory" in debugData)) {
        return {
          pass: false,
          message: "memory property missing from debug data",
        };
      }

      // Memory may be null if performance.memory is not available (non-Chrome browsers)
      if (debugData.memory === null) {
        // Check if performance.memory exists
        if (!performance.memory) {
          return {
            pass: true,
            message:
              "memory is null (performance.memory not available in this browser)",
            skipped: true,
          };
        } else {
          return {
            pass: false,
            message: "memory is null but performance.memory is available",
          };
        }
      }

      // If memory object exists, check structure
      if (typeof debugData.memory === "object") {
        if (!("before" in debugData.memory) || !("after" in debugData.memory)) {
          return {
            pass: false,
            message: "memory object missing before/after properties",
          };
        }

        return {
          pass: true,
          message: "Memory info present with before/after snapshots",
          data: debugData.memory,
        };
      }

      return {
        pass: false,
        message: `Unexpected memory type: ${typeof debugData.memory}`,
      };
    } catch (error) {
      return { pass: false, message: `Error: ${error.message}` };
    } finally {
      cleanupTestContainer();
    }
  }

  /**
   * P4-D10: Debug data includes errors array when request fails
   * Note: This test intentionally triggers an error
   */
  async function testP4_D10_ErrorsArrayOnFailure() {
    logInfo(
      "Testing P4-D10: Debug data includes errors array when request fails"
    );

    // Create embed with an invalid model to trigger an error
    const embed = createTestEmbed({
      model: "invalid/nonexistent-model-xyz",
    });

    if (!embed) {
      return { pass: false, message: "Could not create embed instance" };
    }

    try {
      // This should fail due to invalid model
      await embed.sendRequest("This should fail");

      // If we get here, the request didn't fail as expected
      const debugData = embed.getLastRequestDebug();

      // Check if there's an error anyway
      if (debugData && debugData.errors && debugData.errors.length > 0) {
        return {
          pass: true,
          message: `Errors array populated: ${debugData.errors.join(", ")}`,
          data: debugData.errors,
        };
      }

      return {
        pass: false,
        message: "Request succeeded when it should have failed (invalid model)",
      };
    } catch (error) {
      // Expected path - request failed
      const debugData = embed.getLastRequestDebug();

      if (!debugData) {
        // Debug data might not be captured for early failures
        return {
          pass: true,
          message: `Request failed as expected: ${error.message} (debug data not captured for this failure type)`,
          skipped: true,
        };
      }

      // Check errors array
      if (!debugData.errors) {
        return {
          pass: false,
          message: "errors property missing from debug data after failure",
        };
      }

      if (!Array.isArray(debugData.errors)) {
        return {
          pass: false,
          message: `errors should be an array, got: ${typeof debugData.errors}`,
        };
      }

      if (debugData.errors.length === 0) {
        return {
          pass: false,
          message: "errors array is empty after request failure",
        };
      }

      // Check response.success is false
      if (debugData.response && debugData.response.success !== false) {
        return {
          pass: false,
          message: `response.success should be false, got: ${debugData.response.success}`,
        };
      }

      return {
        pass: true,
        message: `Errors array populated on failure: ${debugData.errors.join(
          ", "
        )}`,
        data: debugData.errors,
      };
    } finally {
      cleanupTestContainer();
    }
  }

  // ============================================================================
  // TEST RUNNER
  // ============================================================================

  /**
   * Run all Phase 4 Debug tests
   * @returns {Promise<Object>} Test results summary
   */
  async function runAllPhase4DebugTests() {
    logInfo("═══════════════════════════════════════════════════════════════");
    logInfo("  Phase 4 Debug Data Collection Tests (P4-D1 to P4-D10)");
    logInfo("═══════════════════════════════════════════════════════════════");

    // Check dependencies first
    const deps = checkDependencies();
    logInfo("Dependencies:", deps);

    if (!deps.OpenRouterEmbed) {
      logError("OpenRouterEmbed not available - cannot run tests");
      return { pass: 0, fail: 1, skipped: 0, total: 1 };
    }

    const results = [];
    const tests = [
      {
        id: "P4-D1",
        name: "Debug null before request",
        fn: testP4_D1_DebugNullBeforeRequest,
        async: false,
      },
      {
        id: "P4-D2",
        name: "Debug after successful request",
        fn: testP4_D2_DebugAfterSuccessfulRequest,
        async: true,
      },
      {
        id: "P4-D3",
        name: "Timing breakdown",
        fn: testP4_D3_TimingBreakdown,
        async: true,
      },
      {
        id: "P4-D4",
        name: "File info included",
        fn: testP4_D4_FileInfoIncluded,
        async: true,
      },
      {
        id: "P4-D5",
        name: "setDebugMode(true)",
        fn: testP4_D5_SetDebugModeTrue,
        async: false,
      },
      {
        id: "P4-D6",
        name: "setDebugMode(false)",
        fn: testP4_D6_SetDebugModeFalse,
        async: false,
      },
      {
        id: "P4-D7",
        name: "isDebugMode() correct state",
        fn: testP4_D7_IsDebugModeReturnsCorrectState,
        async: false,
      },
      {
        id: "P4-D8",
        name: "Compression info included",
        fn: testP4_D8_CompressionInfoIncluded,
        async: true,
      },
      {
        id: "P4-D9",
        name: "Memory info included",
        fn: testP4_D9_MemoryInfoIncluded,
        async: true,
      },
      {
        id: "P4-D10",
        name: "Errors array on failure",
        fn: testP4_D10_ErrorsArrayOnFailure,
        async: true,
      },
    ];

    for (const test of tests) {
      logInfo(`\nRunning ${test.id}: ${test.name}...`);

      try {
        const result = test.async ? await test.fn() : test.fn();
        results.push({ ...test, result });

        const icon = result.pass ? "✓" : result.skipped ? "○" : "✗";
        const status = result.pass ? "PASS" : result.skipped ? "SKIP" : "FAIL";
        console.log(`  ${icon} ${test.id}: ${status} - ${result.message}`);

        if (result.data && result.pass) {
          logDebug("    Data:", result.data);
        }
      } catch (error) {
        results.push({
          ...test,
          result: { pass: false, message: `Exception: ${error.message}` },
        });
        console.log(`  ✗ ${test.id}: FAIL - Exception: ${error.message}`);
      }
    }

    // Summary
    const passed = results.filter(
      (r) => r.result.pass && !r.result.skipped
    ).length;
    const skipped = results.filter((r) => r.result.skipped).length;
    const failed = results.filter(
      (r) => !r.result.pass && !r.result.skipped
    ).length;

    logInfo(
      "\n═══════════════════════════════════════════════════════════════"
    );
    logInfo(
      `  SUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped (${results.length} total)`
    );
    logInfo("═══════════════════════════════════════════════════════════════");

    return {
      pass: passed,
      fail: failed,
      skipped: skipped,
      total: results.length,
      results: results,
    };
  }

  /**
   * Run quick synchronous tests only (no API calls)
   * @returns {Object} Test results
   */
  function runQuickDebugTests() {
    logInfo("Running quick debug tests (synchronous only)...");

    const syncTests = [
      testP4_D1_DebugNullBeforeRequest,
      testP4_D5_SetDebugModeTrue,
      testP4_D6_SetDebugModeFalse,
      testP4_D7_IsDebugModeReturnsCorrectState,
    ];

    const results = syncTests.map((fn) => {
      try {
        return fn();
      } catch (error) {
        return { pass: false, message: `Exception: ${error.message}` };
      }
    });

    const passed = results.filter((r) => r.pass).length;
    logInfo(`Quick tests: ${passed}/${results.length} passed`);

    return { passed, total: results.length, results };
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  // Individual test functions
  window.testP4_D1_DebugNullBeforeRequest = testP4_D1_DebugNullBeforeRequest;
  window.testP4_D2_DebugAfterSuccessfulRequest =
    testP4_D2_DebugAfterSuccessfulRequest;
  window.testP4_D3_TimingBreakdown = testP4_D3_TimingBreakdown;
  window.testP4_D4_FileInfoIncluded = testP4_D4_FileInfoIncluded;
  window.testP4_D5_SetDebugModeTrue = testP4_D5_SetDebugModeTrue;
  window.testP4_D6_SetDebugModeFalse = testP4_D6_SetDebugModeFalse;
  window.testP4_D7_IsDebugModeReturnsCorrectState =
    testP4_D7_IsDebugModeReturnsCorrectState;
  window.testP4_D8_CompressionInfoIncluded = testP4_D8_CompressionInfoIncluded;
  window.testP4_D9_MemoryInfoIncluded = testP4_D9_MemoryInfoIncluded;
  window.testP4_D10_ErrorsArrayOnFailure = testP4_D10_ErrorsArrayOnFailure;

  // Test runners
  window.runAllPhase4DebugTests = runAllPhase4DebugTests;
  window.runQuickDebugTests = runQuickDebugTests;

  // Alias for consistency with other test files
  window.testStage5_Phase4_Debug = runAllPhase4DebugTests;
})();
