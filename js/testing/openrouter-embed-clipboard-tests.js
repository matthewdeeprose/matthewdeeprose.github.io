/**
 * OpenRouter Embed API - Clipboard Paste Helper Test Suite
 *
 * Tests for Stage 5 Phase 4 Feature 3: Clipboard Paste Helper
 * 10 tests covering all acceptance criteria
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
      console.error(`[Clipboard Tests ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[Clipboard Tests WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[Clipboard Tests INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[Clipboard Tests DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  /**
   * Check if EmbedFileUtils is available
   */
  function checkFileUtilsAvailable() {
    if (typeof window.EmbedFileUtils === "undefined") {
      throw new Error(
        "EmbedFileUtils not loaded. Include openrouter-embed-file.js first."
      );
    }
    return true;
  }

  /**
   * Create a fresh EmbedFileUtils instance
   */
  function createFileUtils() {
    return new window.EmbedFileUtils();
  }

  /**
   * Create a mock File object
   */
  function createMockFile(name, type, size = 1024) {
    const content = new Uint8Array(size);
    return new File([content], name, { type });
  }

  /**
   * Create a mock ClipboardEvent with file data
   */
  function createMockPasteEvent(file, options = {}) {
    // Create mock DataTransferItem
    const mockItem = {
      kind: "file",
      type: file.type,
      getAsFile: () => file,
    };

    // Create mock DataTransferItemList
    const mockItems = {
      length: 1,
      0: mockItem,
      [Symbol.iterator]: function* () {
        yield mockItem;
      },
    };

    // Create mock ClipboardData
    const mockClipboardData = {
      items: mockItems,
      files: [file],
      getData: () => "",
      setData: () => {},
    };

    // Create ClipboardEvent
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: null, // Real clipboardData can't be set this way
      ...options,
    });

    // Override clipboardData property (readonly workaround)
    Object.defineProperty(event, "clipboardData", {
      value: mockClipboardData,
      writable: false,
    });

    return event;
  }

  /**
   * Create a mock paste event with text only (no files)
   */
  function createMockTextPasteEvent(text = "test text") {
    const mockItems = {
      length: 1,
      0: {
        kind: "string",
        type: "text/plain",
        getAsFile: () => null,
        getAsString: (callback) => callback(text),
      },
    };

    const mockClipboardData = {
      items: mockItems,
      files: [],
      getData: (type) => (type === "text/plain" ? text : ""),
      setData: () => {},
    };

    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
    });

    Object.defineProperty(event, "clipboardData", {
      value: mockClipboardData,
      writable: false,
    });

    return event;
  }

  /**
   * Create a test container element
   */
  function createTestContainer(id = "clipboard-test-container") {
    // Remove existing container if present
    const existing = document.getElementById(id);
    if (existing) {
      existing.remove();
    }

    const container = document.createElement("div");
    container.id = id;
    container.style.cssText =
      "position: fixed; top: -1000px; left: -1000px; width: 100px; height: 100px;";
    document.body.appendChild(container);
    return container;
  }

  /**
   * Remove test container
   */
  function removeTestContainer(id = "clipboard-test-container") {
    const container = document.getElementById(id);
    if (container) {
      container.remove();
    }
  }

  // ============================================================================
  // TEST: P4-C1 - Returns cleanup function
  // ============================================================================

  async function testP4_C1_ReturnsCleanupFunction() {
    logInfo("P4-C1: Testing bindClipboardPaste returns cleanup function");

    try {
      checkFileUtilsAvailable();

      // Use a container to avoid polluting document-level state
      const container = createTestContainer("c1-test-container");

      const fileUtils = createFileUtils();

      const cleanup = fileUtils.bindClipboardPaste({
        containerSelector: "#c1-test-container",
        onPaste: () => {},
      });

      // Check cleanup is a function
      if (typeof cleanup !== "function") {
        throw new Error(
          `Expected cleanup to be function, got ${typeof cleanup}`
        );
      }

      // Clean up
      cleanup();
      removeTestContainer("c1-test-container");

      logInfo("✅ P4-C1 PASSED: bindClipboardPaste returns cleanup function");
      return { passed: true, testId: "P4-C1" };
    } catch (error) {
      logError("❌ P4-C1 FAILED:", error.message);
      removeTestContainer("c1-test-container");
      return { passed: false, testId: "P4-C1", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-C2 - Cleanup function removes event listener
  // ============================================================================

  async function testP4_C2_CleanupRemovesListener() {
    logInfo("P4-C2: Testing cleanup function removes event listener");

    try {
      checkFileUtilsAvailable();
      const container = createTestContainer();

      const fileUtils = createFileUtils();
      let pasteCount = 0;

      const cleanup = fileUtils.bindClipboardPaste({
        containerSelector: "#clipboard-test-container",
        onPaste: () => {
          pasteCount++;
        },
      });

      // Create mock paste event
      const mockFile = createMockFile("test.png", "image/png");
      const pasteEvent = createMockPasteEvent(mockFile);

      // Dispatch paste event - should trigger callback
      container.dispatchEvent(pasteEvent);

      const countAfterFirst = pasteCount;
      if (countAfterFirst !== 1) {
        throw new Error(
          `Expected 1 paste after first event, got ${countAfterFirst}`
        );
      }

      // Now cleanup
      cleanup();

      // Dispatch paste event again - should NOT trigger callback
      const pasteEvent2 = createMockPasteEvent(mockFile);
      container.dispatchEvent(pasteEvent2);

      const countAfterSecond = pasteCount;
      if (countAfterSecond !== 1) {
        throw new Error(
          `Expected still 1 paste after cleanup, got ${countAfterSecond}`
        );
      }

      removeTestContainer();

      logInfo("✅ P4-C2 PASSED: Cleanup function removes event listener");
      return { passed: true, testId: "P4-C2" };
    } catch (error) {
      logError("❌ P4-C2 FAILED:", error.message);
      removeTestContainer();
      return { passed: false, testId: "P4-C2", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-C3 - Image paste triggers onPaste callback with File
  // ============================================================================

  async function testP4_C3_ImagePasteTriggers() {
    logInfo("P4-C3: Testing image paste triggers onPaste callback with File");

    try {
      checkFileUtilsAvailable();
      const container = createTestContainer();

      const fileUtils = createFileUtils();
      let receivedFile = null;

      const cleanup = fileUtils.bindClipboardPaste({
        containerSelector: "#clipboard-test-container",
        onPaste: (file) => {
          receivedFile = file;
        },
      });

      // Create mock paste event with image
      const mockFile = createMockFile("test.png", "image/png", 2048);
      const pasteEvent = createMockPasteEvent(mockFile);

      // Dispatch paste event
      container.dispatchEvent(pasteEvent);

      // Check callback was called with File
      if (receivedFile === null) {
        throw new Error("onPaste callback was not called");
      }

      if (!(receivedFile instanceof File)) {
        throw new Error(
          `onPaste received ${typeof receivedFile}, expected File`
        );
      }

      if (receivedFile.type !== "image/png") {
        throw new Error(`Expected image/png, got ${receivedFile.type}`);
      }

      cleanup();
      removeTestContainer();

      logInfo(
        "✅ P4-C3 PASSED: Image paste triggers onPaste callback with File"
      );
      return { passed: true, testId: "P4-C3" };
    } catch (error) {
      logError("❌ P4-C3 FAILED:", error.message);
      removeTestContainer();
      return { passed: false, testId: "P4-C3", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-C4 - Non-image paste does not trigger onPaste
  // ============================================================================

  async function testP4_C4_NonImagePasteIgnored() {
    logInfo("P4-C4: Testing non-image paste does not trigger onPaste");

    try {
      checkFileUtilsAvailable();
      const container = createTestContainer();

      const fileUtils = createFileUtils();
      let pasteCalled = false;

      const cleanup = fileUtils.bindClipboardPaste({
        containerSelector: "#clipboard-test-container",
        onPaste: () => {
          pasteCalled = true;
        },
      });

      // Create mock paste event with text only (no files)
      const textPasteEvent = createMockTextPasteEvent("just some text");

      // Dispatch paste event
      container.dispatchEvent(textPasteEvent);

      // Check callback was NOT called
      if (pasteCalled) {
        throw new Error("onPaste should not be called for text paste");
      }

      cleanup();
      removeTestContainer();

      logInfo("✅ P4-C4 PASSED: Non-image paste does not trigger onPaste");
      return { passed: true, testId: "P4-C4" };
    } catch (error) {
      logError("❌ P4-C4 FAILED:", error.message);
      removeTestContainer();
      return { passed: false, testId: "P4-C4", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-C5 - onError called for unsupported file types
  // ============================================================================

  async function testP4_C5_OnErrorForUnsupportedType() {
    logInfo("P4-C5: Testing onError called for unsupported file types");

    try {
      checkFileUtilsAvailable();
      const container = createTestContainer();

      const fileUtils = createFileUtils();
      let errorReceived = null;
      let pasteCalled = false;

      const cleanup = fileUtils.bindClipboardPaste({
        containerSelector: "#clipboard-test-container",
        onPaste: () => {
          pasteCalled = true;
        },
        onError: (error) => {
          errorReceived = error;
        },
        acceptedTypes: ["image/jpeg", "image/png"], // Only JPEG and PNG
      });

      // Create mock paste event with unsupported type (GIF)
      const mockFile = createMockFile("test.gif", "image/gif");
      const pasteEvent = createMockPasteEvent(mockFile);

      // Dispatch paste event
      container.dispatchEvent(pasteEvent);

      // Check onPaste was NOT called
      if (pasteCalled) {
        throw new Error("onPaste should not be called for unsupported type");
      }

      // Check onError was called
      if (errorReceived === null) {
        throw new Error("onError should be called for unsupported type");
      }

      if (!(errorReceived instanceof Error)) {
        throw new Error(
          `onError received ${typeof errorReceived}, expected Error`
        );
      }

      if (!errorReceived.message.includes("Unsupported file type")) {
        throw new Error(
          `Error message should mention 'Unsupported file type', got: ${errorReceived.message}`
        );
      }

      cleanup();
      removeTestContainer();

      logInfo("✅ P4-C5 PASSED: onError called for unsupported file types");
      return { passed: true, testId: "P4-C5" };
    } catch (error) {
      logError("❌ P4-C5 FAILED:", error.message);
      removeTestContainer();
      return { passed: false, testId: "P4-C5", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-C6 - preventInInputs=true skips paste in input elements
  // ============================================================================

  async function testP4_C6_PreventInInputsTrue() {
    logInfo(
      "P4-C6: Testing preventInInputs=true skips paste in input elements"
    );

    try {
      checkFileUtilsAvailable();
      const container = createTestContainer();

      // Add an input element to the container
      const input = document.createElement("input");
      input.type = "text";
      input.id = "test-input";
      container.appendChild(input);

      const fileUtils = createFileUtils();
      let pasteCalled = false;

      const cleanup = fileUtils.bindClipboardPaste({
        containerSelector: "#clipboard-test-container",
        onPaste: () => {
          pasteCalled = true;
        },
        preventInInputs: true, // Default, but explicit for clarity
      });

      // Focus the input
      input.focus();

      // Create mock paste event
      const mockFile = createMockFile("test.png", "image/png");
      const pasteEvent = createMockPasteEvent(mockFile);

      // Dispatch paste event to input (bubbles up)
      input.dispatchEvent(pasteEvent);

      // Check callback was NOT called (paste in input should be ignored)
      if (pasteCalled) {
        throw new Error(
          "onPaste should not be called when paste is in input element with preventInInputs=true"
        );
      }

      cleanup();
      removeTestContainer();

      logInfo(
        "✅ P4-C6 PASSED: preventInInputs=true skips paste in input elements"
      );
      return { passed: true, testId: "P4-C6" };
    } catch (error) {
      logError("❌ P4-C6 FAILED:", error.message);
      removeTestContainer();
      return { passed: false, testId: "P4-C6", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-C7 - preventInInputs=false allows paste in input elements
  // ============================================================================

  async function testP4_C7_PreventInInputsFalse() {
    logInfo(
      "P4-C7: Testing preventInInputs=false allows paste in input elements"
    );

    try {
      checkFileUtilsAvailable();
      const container = createTestContainer();

      // Add an input element to the container
      const input = document.createElement("input");
      input.type = "text";
      input.id = "test-input-2";
      container.appendChild(input);

      const fileUtils = createFileUtils();
      let receivedFile = null;

      const cleanup = fileUtils.bindClipboardPaste({
        containerSelector: "#clipboard-test-container",
        onPaste: (file) => {
          receivedFile = file;
        },
        preventInInputs: false, // Allow paste in inputs
      });

      // Focus the input
      input.focus();

      // Create mock paste event
      const mockFile = createMockFile("test.png", "image/png");
      const pasteEvent = createMockPasteEvent(mockFile);

      // Dispatch paste event to container (simulating event while input is focused)
      // Note: We need to dispatch to container since we're checking focus, not event target
      container.dispatchEvent(pasteEvent);

      // With preventInInputs=false, paste should be processed
      if (receivedFile === null) {
        throw new Error("onPaste should be called with preventInInputs=false");
      }

      cleanup();
      removeTestContainer();

      logInfo(
        "✅ P4-C7 PASSED: preventInInputs=false allows paste in input elements"
      );
      return { passed: true, testId: "P4-C7" };
    } catch (error) {
      logError("❌ P4-C7 FAILED:", error.message);
      removeTestContainer();
      return { passed: false, testId: "P4-C7", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-C8 - containerSelector limits scope to specific container
  // ============================================================================

  async function testP4_C8_ContainerSelectorLimitsScope() {
    logInfo(
      "P4-C8: Testing containerSelector limits scope to specific container"
    );

    try {
      checkFileUtilsAvailable();

      // Create two containers
      const container1 = createTestContainer("container-1");
      const container2 = createTestContainer("container-2");

      const fileUtils = createFileUtils();
      let container1Pasted = false;
      let container2Pasted = false;

      // Bind to container1 only
      const cleanup = fileUtils.bindClipboardPaste({
        containerSelector: "#container-1",
        onPaste: () => {
          container1Pasted = true;
        },
      });

      // Bind separate handler to container2
      const cleanup2 = fileUtils.bindClipboardPaste({
        containerSelector: "#container-2",
        onPaste: () => {
          container2Pasted = true;
        },
      });

      // Paste to container1
      const mockFile = createMockFile("test.png", "image/png");
      const pasteEvent1 = createMockPasteEvent(mockFile);
      container1.dispatchEvent(pasteEvent1);

      // Check only container1 handler fired
      if (!container1Pasted) {
        throw new Error("Container1 paste handler should have fired");
      }

      if (container2Pasted) {
        throw new Error(
          "Container2 paste handler should NOT have fired for container1 paste"
        );
      }

      // Reset
      container1Pasted = false;
      container2Pasted = false;

      // Paste to container2
      const pasteEvent2 = createMockPasteEvent(mockFile);
      container2.dispatchEvent(pasteEvent2);

      // Check only container2 handler fired
      if (container1Pasted) {
        throw new Error(
          "Container1 paste handler should NOT have fired for container2 paste"
        );
      }

      if (!container2Pasted) {
        throw new Error("Container2 paste handler should have fired");
      }

      cleanup();
      cleanup2();
      removeTestContainer("container-1");
      removeTestContainer("container-2");

      logInfo(
        "✅ P4-C8 PASSED: containerSelector limits scope to specific container"
      );
      return { passed: true, testId: "P4-C8" };
    } catch (error) {
      logError("❌ P4-C8 FAILED:", error.message);
      removeTestContainer("container-1");
      removeTestContainer("container-2");
      return { passed: false, testId: "P4-C8", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-C9 - acceptedTypes filters allowed file types
  // ============================================================================

  async function testP4_C9_AcceptedTypesFilters() {
    logInfo("P4-C9: Testing acceptedTypes filters allowed file types");

    try {
      checkFileUtilsAvailable();
      const container = createTestContainer();

      const fileUtils = createFileUtils();
      let receivedType = null;
      let errorReceived = null;

      const cleanup = fileUtils.bindClipboardPaste({
        containerSelector: "#clipboard-test-container",
        onPaste: (file) => {
          receivedType = file.type;
        },
        onError: (error) => {
          errorReceived = error;
        },
        acceptedTypes: ["image/webp"], // Only WebP
      });

      // Test 1: WebP should be accepted
      const webpFile = createMockFile("test.webp", "image/webp");
      const pasteEvent1 = createMockPasteEvent(webpFile);
      container.dispatchEvent(pasteEvent1);

      if (receivedType !== "image/webp") {
        throw new Error(`WebP should be accepted, got: ${receivedType}`);
      }

      // Reset
      receivedType = null;
      errorReceived = null;

      // Test 2: PNG should be rejected
      const pngFile = createMockFile("test.png", "image/png");
      const pasteEvent2 = createMockPasteEvent(pngFile);
      container.dispatchEvent(pasteEvent2);

      if (receivedType !== null) {
        throw new Error(
          `PNG should NOT be accepted when acceptedTypes is ['image/webp']`
        );
      }

      if (errorReceived === null) {
        throw new Error("Error should be called for rejected PNG");
      }

      cleanup();
      removeTestContainer();

      logInfo("✅ P4-C9 PASSED: acceptedTypes filters allowed file types");
      return { passed: true, testId: "P4-C9" };
    } catch (error) {
      logError("❌ P4-C9 FAILED:", error.message);
      removeTestContainer();
      return { passed: false, testId: "P4-C9", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-C10 - Multiple bindings can coexist independently
  // ============================================================================

  async function testP4_C10_MultipleBindingsCoexist() {
    logInfo("P4-C10: Testing multiple bindings can coexist independently");

    try {
      checkFileUtilsAvailable();
      const container = createTestContainer();

      const fileUtils1 = createFileUtils();
      const fileUtils2 = createFileUtils();

      let handler1Called = false;
      let handler2Called = false;

      // Bind two handlers to the same container
      const cleanup1 = fileUtils1.bindClipboardPaste({
        containerSelector: "#clipboard-test-container",
        onPaste: () => {
          handler1Called = true;
        },
      });

      const cleanup2 = fileUtils2.bindClipboardPaste({
        containerSelector: "#clipboard-test-container",
        onPaste: () => {
          handler2Called = true;
        },
      });

      // Paste once
      const mockFile = createMockFile("test.png", "image/png");
      const pasteEvent = createMockPasteEvent(mockFile);
      container.dispatchEvent(pasteEvent);

      // Both handlers should fire
      if (!handler1Called) {
        throw new Error("Handler 1 should have been called");
      }

      if (!handler2Called) {
        throw new Error("Handler 2 should have been called");
      }

      // Clean up handler1 only
      cleanup1();

      // Reset flags
      handler1Called = false;
      handler2Called = false;

      // Paste again
      const pasteEvent2 = createMockPasteEvent(mockFile);
      container.dispatchEvent(pasteEvent2);

      // Only handler2 should fire
      if (handler1Called) {
        throw new Error("Handler 1 should NOT fire after cleanup");
      }

      if (!handler2Called) {
        throw new Error("Handler 2 should still fire");
      }

      cleanup2();
      removeTestContainer();

      logInfo("✅ P4-C10 PASSED: Multiple bindings can coexist independently");
      return { passed: true, testId: "P4-C10" };
    } catch (error) {
      logError("❌ P4-C10 FAILED:", error.message);
      removeTestContainer();
      return { passed: false, testId: "P4-C10", error: error.message };
    }
  }

  // ============================================================================
  // TEST: P4-C11 - Document-level binding works correctly
  // ============================================================================

  async function testP4_C11_DocumentLevelBinding() {
    logInfo("P4-C11: Testing document-level binding (no containerSelector)");

    try {
      checkFileUtilsAvailable();

      const fileUtils = createFileUtils();
      let receivedFile = null;

      // Bind to document (no containerSelector)
      const cleanup = fileUtils.bindClipboardPaste({
        onPaste: (file) => {
          receivedFile = file;
        },
      });

      // Create mock paste event
      const mockFile = createMockFile("doc-test.png", "image/png");
      const pasteEvent = createMockPasteEvent(mockFile);

      // Dispatch to document
      document.dispatchEvent(pasteEvent);

      // Verify callback was triggered
      if (receivedFile === null) {
        throw new Error("Document-level paste should trigger onPaste callback");
      }

      if (receivedFile.name !== "doc-test.png") {
        throw new Error(`Expected doc-test.png, got ${receivedFile.name}`);
      }

      // Clean up
      cleanup();

      // Verify cleanup works - dispatch again, should not trigger
      receivedFile = null;
      const pasteEvent2 = createMockPasteEvent(mockFile);
      document.dispatchEvent(pasteEvent2);

      if (receivedFile !== null) {
        throw new Error("After cleanup, paste should not trigger callback");
      }

      logInfo("✅ P4-C11 PASSED: Document-level binding works correctly");
      return { passed: true, testId: "P4-C11" };
    } catch (error) {
      logError("❌ P4-C11 FAILED:", error.message);
      return { passed: false, testId: "P4-C11", error: error.message };
    }
  }

  // ============================================================================
  // TEST RUNNER
  // ============================================================================

  /**
   * Run all Phase 4 Feature 3 (Clipboard Paste Helper) tests
   */
  async function runAllPhase4ClipboardTests() {
    console.log("\n" + "=".repeat(70));
    console.log("PHASE 4 FEATURE 3: Clipboard Paste Helper Tests");
    console.log("=".repeat(70) + "\n");

    const results = [];
    const tests = [
      testP4_C1_ReturnsCleanupFunction,
      testP4_C2_CleanupRemovesListener,
      testP4_C3_ImagePasteTriggers,
      testP4_C4_NonImagePasteIgnored,
      testP4_C5_OnErrorForUnsupportedType,
      testP4_C6_PreventInInputsTrue,
      testP4_C7_PreventInInputsFalse,
      testP4_C8_ContainerSelectorLimitsScope,
      testP4_C9_AcceptedTypesFilters,
      testP4_C10_MultipleBindingsCoexist,
      testP4_C11_DocumentLevelBinding, // Run last to avoid affecting container-based tests
    ];

    for (const test of tests) {
      console.log("\n" + "-".repeat(50));

      // Reset focus by blurring active element (body.focus() doesn't work reliably)
      document.activeElement?.blur();

      // Small delay to allow any pending events to settle
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await test();
      results.push(result);
    }

    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("PHASE 4 FEATURE 3 TEST SUMMARY");
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
  window.testP4_C1_ReturnsCleanupFunction = testP4_C1_ReturnsCleanupFunction;
  window.testP4_C2_CleanupRemovesListener = testP4_C2_CleanupRemovesListener;
  window.testP4_C3_ImagePasteTriggers = testP4_C3_ImagePasteTriggers;
  window.testP4_C4_NonImagePasteIgnored = testP4_C4_NonImagePasteIgnored;
  window.testP4_C5_OnErrorForUnsupportedType =
    testP4_C5_OnErrorForUnsupportedType;
  window.testP4_C6_PreventInInputsTrue = testP4_C6_PreventInInputsTrue;
  window.testP4_C7_PreventInInputsFalse = testP4_C7_PreventInInputsFalse;
  window.testP4_C8_ContainerSelectorLimitsScope =
    testP4_C8_ContainerSelectorLimitsScope;
  window.testP4_C9_AcceptedTypesFilters = testP4_C9_AcceptedTypesFilters;
  window.testP4_C10_MultipleBindingsCoexist =
    testP4_C10_MultipleBindingsCoexist;
  window.testP4_C11_DocumentLevelBinding = testP4_C11_DocumentLevelBinding;

  // Test runner
  window.runAllPhase4ClipboardTests = runAllPhase4ClipboardTests;
})();
