/**
 * Live Markdown Editor - Integration Test Suite
 * Comprehensive tests for stability and integration
 * WCAG 2.2 AA compliant testing approach
 */

(function () {
  "use strict";

  // Logging configuration
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
      console.error("[LiveEditorTests]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[LiveEditorTests]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[LiveEditorTests]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[LiveEditorTests] [DEBUG]", message, ...args);
  }

  /**
   * Test Suite for Live Markdown Editor
   */
  const TestSuite = {
    results: [],
    startTime: 0,

    /**
     * Record test result
     */
    recordResult(name, pass, details = "") {
      this.results.push({ name, pass, details });
      const icon = pass ? "✅" : "❌";
      console.log(`  ${icon} ${name}${details ? " - " + details : ""}`);
    },

    /**
     * Run all tests
     */
    runAll: async function () {
      console.log("🧪 Starting Live Markdown Editor Test Suite\n");
      console.log("=".repeat(60));
      this.results = [];
      this.startTime = Date.now();

      await this.testInitialization();
      await this.testContentSync();
      await this.testModeSwitch();
      await this.testExamplesLoader();
      await this.testToggleFunctionality();
      await this.testClearButton();
      await this.testStateManagement();
      await this.testPerformance();

      this.printResults();
    },

    /**
     * Test 1: Initialization
     */
    testInitialization: async function () {
      console.log("\n📋 Testing: Initialization");

      // Check live editor instance exists
      this.recordResult(
        "Live editor instance exists",
        !!window.markdownLiveEditor
      );

      if (!window.markdownLiveEditor) {
        console.log("⚠️ Cannot continue tests - live editor not initialised");
        return;
      }

      // Check initialization status
      this.recordResult(
        "Editor is initialised",
        window.markdownLiveEditor.isInitialised === true
      );

      // Check Prism ready
      this.recordResult(
        "Prism is ready",
        window.markdownLiveEditor.prismReady === true
      );

      // Check DOM elements exist
      this.recordResult(
        "ContentEditable element exists",
        !!window.markdownLiveEditor.contentEditableElement
      );

      this.recordResult(
        "Hidden input exists",
        !!window.markdownLiveEditor.hiddenInput
      );

      this.recordResult(
        "Original textarea exists",
        !!window.markdownLiveEditor.originalTextarea
      );

      // Check console helpers exist
      this.recordResult(
        "Console helpers exist",
        typeof window.markdownHighlightingStatus === "function" &&
          typeof window.toggleMarkdownHighlighting === "function"
      );
    },

    /**
     * Test 2: Content Synchronization
     */
    testContentSync: async function () {
      console.log("\n📋 Testing: Content Synchronization");

      if (!window.markdownLiveEditor) return;

      // Test content setting
      const testContent = "# Test Heading\n\nTest content for sync.";
      window.markdownLiveEditor.setContent(testContent);

      // Small delay for sync
      await new Promise((resolve) => setTimeout(resolve, 100));

      const retrievedContent = window.markdownLiveEditor.getContent();
      this.recordResult(
        "Content set correctly",
        retrievedContent === testContent
      );

      // Test textarea sync
      const textareaContent = window.markdownLiveEditor.originalTextarea.value;
      this.recordResult(
        "Textarea synced",
        this.normaliseContent(textareaContent) ===
          this.normaliseContent(testContent)
      );

      // Test hidden input sync
      const hiddenInputContent = window.markdownLiveEditor.hiddenInput.value;
      this.recordResult(
        "Hidden input synced",
        this.normaliseContent(hiddenInputContent) ===
          this.normaliseContent(testContent)
      );

      // Test verification function
      const inSync = window.markdownLiveEditor.verifySynchronization();
      this.recordResult("Verification passes", inSync === true);

      // Clean up
      window.markdownLiveEditor.setContent("");
    },

    /**
     * Test 3: Mode Switching
     */
    testModeSwitch: async function () {
      console.log("\n📋 Testing: Mode Switching");

      // Check cleanup function exists
      this.recordResult(
        "Cleanup function exists",
        typeof window.markdownEditorCleanup === "function"
      );

      // Check restore function exists
      this.recordResult(
        "Restore function exists",
        typeof window.markdownEditorRestore === "function"
      );

      // Test cleanup doesn't throw errors
      let cleanupSuccess = true;
      try {
        window.markdownEditorCleanup();
      } catch (error) {
        cleanupSuccess = false;
        logError("Cleanup failed:", error);
      }
      this.recordResult("Cleanup executes without error", cleanupSuccess);

      // Test restore doesn't throw errors
      let restoreSuccess = true;
      try {
        window.markdownEditorRestore();
      } catch (error) {
        restoreSuccess = false;
        logError("Restore failed:", error);
      }
      this.recordResult("Restore executes without error", restoreSuccess);

      // Test content preservation through cleanup/restore
      const testContent = "# Mode Switch Test\n\nContent preservation test.";
      window.markdownLiveEditor.setContent(testContent);
      await new Promise((resolve) => setTimeout(resolve, 100));

      window.markdownEditorCleanup();
      window.markdownEditorRestore();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const restoredContent = window.markdownLiveEditor.getContent();
      this.recordResult(
        "Content preserved after cleanup/restore",
        this.normaliseContent(restoredContent) ===
          this.normaliseContent(testContent)
      );

      // Clean up
      window.markdownLiveEditor.setContent("");
    },

    /**
     * Test 4: Examples Loader Integration
     */
    testExamplesLoader: async function () {
      console.log("\n📋 Testing: Examples Loader Integration");

      // Check examples loader exists
      this.recordResult(
        "Examples loader exists",
        !!window.MarkdownExamplesLoader
      );

      if (!window.MarkdownExamplesLoader) {
        console.log("⚠️ Skipping examples tests - loader not available");
        return;
      }

      // Check if loader is initialised
      const loaderInitialised = window.MarkdownExamplesLoader.isInitialised
        ? window.MarkdownExamplesLoader.isInitialised()
        : false;

      if (!loaderInitialised) {
        this.recordResult(
          "Can retrieve examples",
          false,
          "Examples loader not initialised yet"
        );
        console.log("⚠️ Skipping example load test - loader not initialised");
        return;
      }

      // Check can retrieve examples (using correct API method)
      let examplesAvailable = false;
      try {
        const examples = window.MarkdownExamplesLoader.getAllExamples
          ? window.MarkdownExamplesLoader.getAllExamples()
          : [];
        examplesAvailable = examples && examples.length > 0;
      } catch (error) {
        logError("Could not retrieve examples:", error);
      }
      this.recordResult("Can retrieve examples", examplesAvailable);

      if (examplesAvailable) {
        // Test loading first example
        try {
          const examples = window.MarkdownExamplesLoader.getAllExamples();
          if (examples && examples[0]) {
            const firstExample = examples[0];
            window.markdownLiveEditor.setContent(firstExample.markdown || "");
            await new Promise((resolve) => setTimeout(resolve, 200));

            const contentSet =
              window.markdownLiveEditor.getContent().length > 0;
            this.recordResult(
              "Loading example updates live editor",
              contentSet
            );
          }
        } catch (error) {
          this.recordResult(
            "Loading example updates live editor",
            false,
            error.message
          );
        }
      }

      // Clean up
      window.markdownLiveEditor.setContent("");
    },

    /**
     * Test 5: Toggle Functionality
     */
    testToggleFunctionality: async function () {
      console.log("\n📋 Testing: Toggle Functionality");

      const initialState = window.markdownLiveEditor.isEnabled;

      // Test toggle changes state
      window.markdownLiveEditor.toggle();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const afterFirstToggle = window.markdownLiveEditor.isEnabled;
      this.recordResult(
        "Toggle changes state",
        afterFirstToggle !== initialState
      );

      // Test toggle restores original state
      window.markdownLiveEditor.toggle();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const afterSecondToggle = window.markdownLiveEditor.isEnabled;
      this.recordResult(
        "Toggle restores original state",
        afterSecondToggle === initialState
      );

      // Test global toggle function
      let globalToggleWorks = true;
      try {
        window.toggleMarkdownHighlighting();
        await new Promise((resolve) => setTimeout(resolve, 100));
        window.toggleMarkdownHighlighting();
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        globalToggleWorks = false;
        logError("Global toggle failed:", error);
      }
      this.recordResult("Global toggle function works", globalToggleWorks);
    },

    /**
     * Test 6: Clear Button Integration
     */
    testClearButton: async function () {
      console.log("\n📋 Testing: Clear Button Integration");

      // Set content
      const testContent = "# Clear Test\n\nContent to be cleared.";
      window.markdownLiveEditor.setContent(testContent);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clear using setContent (simulates clear button)
      window.markdownLiveEditor.setContent("");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check all elements cleared
      const contentCleared =
        window.markdownLiveEditor.getContent().length === 0;
      this.recordResult("Clear removes all content", contentCleared);

      const textareaCleared =
        window.markdownLiveEditor.originalTextarea.value.length === 0;
      this.recordResult("Textarea cleared", textareaCleared);

      const hiddenInputCleared =
        window.markdownLiveEditor.hiddenInput.value.length === 0;
      this.recordResult("Hidden input cleared", hiddenInputCleared);
    },

    /**
     * Test 7: State Management
     */
    testStateManagement: async function () {
      console.log("\n📋 Testing: State Management");

      // Test getStateSnapshot exists
      this.recordResult(
        "getStateSnapshot method exists",
        typeof window.markdownLiveEditor.getStateSnapshot === "function"
      );

      // Test restoreStateSnapshot exists
      this.recordResult(
        "restoreStateSnapshot method exists",
        typeof window.markdownLiveEditor.restoreStateSnapshot === "function"
      );

      // Test state save/restore
      const testContent = "# State Test\n\nState management test content.";
      window.markdownLiveEditor.setContent(testContent);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const snapshot = window.markdownLiveEditor.getStateSnapshot();
      this.recordResult("State snapshot created", !!snapshot);
      this.recordResult("Snapshot has content", !!snapshot.content);
      this.recordResult("Snapshot has timestamp", !!snapshot.timestamp);

      // Clear content
      window.markdownLiveEditor.setContent("");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Restore
      const restored = window.markdownLiveEditor.restoreStateSnapshot(snapshot);
      await new Promise((resolve) => setTimeout(resolve, 100));
      this.recordResult("State restore succeeds", restored === true);

      const restoredContent = window.markdownLiveEditor.getContent();
      this.recordResult(
        "Content restored correctly",
        this.normaliseContent(restoredContent) ===
          this.normaliseContent(testContent)
      );

      // Clean up
      window.markdownLiveEditor.setContent("");
    },

    /**
     * Test 8: Performance
     */
    testPerformance: async function () {
      console.log("\n📋 Testing: Performance");

      // Test update speed
      const testContent =
        "# Performance Test\n\n" + "Test content. ".repeat(50);
      const startTime = performance.now();
      window.markdownLiveEditor.setContent(testContent);
      const endTime = performance.now();
      const updateTime = endTime - startTime;

      this.recordResult(
        "Update completes in <200ms",
        updateTime < 200,
        `${updateTime.toFixed(2)}ms`
      );

      // Test multiple rapid updates
      const rapidStartTime = performance.now();
      for (let i = 0; i < 5; i++) {
        window.markdownLiveEditor.setContent(`# Update ${i}\n\nTest content.`);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      const rapidEndTime = performance.now();
      const rapidTime = rapidEndTime - rapidStartTime;

      this.recordResult(
        "Multiple rapid updates handled",
        rapidTime < 1000,
        `${rapidTime.toFixed(2)}ms for 5 updates`
      );

      // Clean up
      window.markdownLiveEditor.setContent("");
    },

    /**
     * Print test results summary
     */
    printResults: function () {
      const duration = Date.now() - this.startTime;

      console.log("\n" + "=".repeat(60));
      console.log("📊 Test Results Summary");
      console.log("=".repeat(60));

      const total = this.results.length;
      const passed = this.results.filter((r) => r.pass).length;
      const failed = total - passed;
      const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

      console.log(`Total Tests: ${total}`);
      console.log(`Passed: ${passed} ✅`);
      console.log(`Failed: ${failed} ❌`);
      console.log(`Success Rate: ${successRate}%`);
      console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);

      if (failed > 0) {
        console.log("\n❌ Failed Tests:");
        this.results
          .filter((r) => !r.pass)
          .forEach((r) => {
            console.log(`  • ${r.name}${r.details ? " - " + r.details : ""}`);
          });
      }

      console.log(
        "\n" + (failed === 0 ? "🎉 All tests passed!" : "⚠️ Some tests failed")
      );
      console.log("=".repeat(60));
    },

    /**
     * Normalise content for comparison
     */
    normaliseContent(content) {
      return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    },
  };

  // Export for global access
  window.markdownLiveEditorTests = TestSuite;

  // Quick command
  window.testMarkdownStability = function () {
    window.markdownLiveEditorTests.runAll();
  };
})();
