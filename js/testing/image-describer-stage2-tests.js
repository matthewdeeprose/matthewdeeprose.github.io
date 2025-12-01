/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER - STAGE 2 TESTS
 * ═══════════════════════════════════════════════════════════════
 *
 * Tests for Stage 2 core functionality:
 * - Controller initialisation
 * - Prompt module loading
 * - System prompt building
 * - User prompt building
 * - DOM element caching
 * - File handling utilities
 *
 * VERSION: 1.0.0
 * DATE: 24 November 2025
 *
 * Run: window.testImageDescriber_Stage2()
 * ═══════════════════════════════════════════════════════════════
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

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ImageDescriber-Tests] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ImageDescriber-Tests] ${message}`, ...args);
  }

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  /**
   * Simple test result tracker
   */
  class TestResults {
    constructor() {
      this.results = {};
      this.passed = 0;
      this.failed = 0;
    }

    record(testId, passed, message = "") {
      this.results[testId] = { passed, message };
      if (passed) {
        this.passed++;
      } else {
        this.failed++;
      }
    }

    get total() {
      return this.passed + this.failed;
    }

    get success() {
      return this.failed === 0;
    }
  }

  // ============================================================================
  // STAGE 2 TESTS
  // ============================================================================

  /**
   * Run all Stage 2 tests
   * @returns {Promise<Object>} Test results
   */
  async function testImageDescriber_Stage2() {
    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║           IMAGE DESCRIBER - STAGE 2 TESTS                ║");
    console.log("║                Core Functionality                        ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log("");

    const results = new TestResults();

    // Wait for prompts to load first
    if (window.promptsLoaded) {
      console.log("⏳ Waiting for prompts to load...");
      try {
        await window.promptsLoaded;
        console.log("✓ Prompts loaded\n");
      } catch (error) {
        console.log("⚠ Prompt loading had errors:", error.message, "\n");
      }
    }

    // ========================================================================
    // S2-1: Controller Exists and Initialised
    // ========================================================================
    {
      const testId = "S2-1";
      const testName = "Controller exists and initialised";
      const controller = window.ImageDescriberController;
      const passed = !!controller && typeof controller.init === "function";

      results.record(testId, passed);
      console.log(`${passed ? "✅" : "❌"} ${testId}: ${testName}`);

      if (!passed) {
        console.log(
          "   └─ Expected: window.ImageDescriberController with init() method"
        );
      }
    }

    // ========================================================================
    // S2-2: Config Available from Stage 1
    // ========================================================================
    {
      const testId = "S2-2";
      const testName = "Config available from Stage 1";
      const config = window.imageDescriberConfig;
      const passed =
        !!config &&
        !!config.audienceLevels &&
        !!config.descriptionStyles &&
        !!config.checkboxOptions;

      results.record(testId, passed);
      console.log(`${passed ? "✅" : "❌"} ${testId}: ${testName}`);

      if (!passed) {
        console.log(
          "   └─ Expected: window.imageDescriberConfig with audienceLevels, descriptionStyles, checkboxOptions"
        );
        console.log("   └─ Got:", config ? Object.keys(config) : "undefined");
      }
    }

    // ========================================================================
    // S2-3: Prompts Loaded (All Three)
    // ========================================================================
    {
      const testId = "S2-3";
      const testName = "All prompts loaded";

      const hasMarkdown =
        typeof window.PROMPT_MARKDOWN === "string" &&
        window.PROMPT_MARKDOWN.length > 100;
      const hasWriting =
        typeof window.PROMPT_WRITING_GUIDE === "string" &&
        window.PROMPT_WRITING_GUIDE.length > 100;
      const hasImage =
        typeof window.PROMPT_IMAGE_DESCRIPTION === "string" &&
        window.PROMPT_IMAGE_DESCRIPTION.length > 100;

      const passed = hasMarkdown && hasWriting && hasImage;

      results.record(testId, passed);
      console.log(`${passed ? "✅" : "❌"} ${testId}: ${testName}`);

      if (!passed) {
        console.log("   └─ PROMPT_MARKDOWN:", hasMarkdown ? "✓" : "✗");
        console.log("   └─ PROMPT_WRITING_GUIDE:", hasWriting ? "✓" : "✗");
        console.log("   └─ PROMPT_IMAGE_DESCRIPTION:", hasImage ? "✓" : "✗");
      }
    }

    // ========================================================================
    // S2-4: System Prompt Builds Correctly
    // ========================================================================
    {
      const testId = "S2-4";
      const testName = "System prompt builds from modules";

      const controller = window.ImageDescriberController;
      let passed = false;
      let systemPrompt = "";

      if (controller?.buildSystemPrompt) {
        try {
          systemPrompt = controller.buildSystemPrompt();
          passed =
            systemPrompt.includes("Markdown") &&
            systemPrompt.includes("British") &&
            systemPrompt.includes("Alt Text");
        } catch (error) {
          console.log("   └─ Error:", error.message);
        }
      }

      results.record(testId, passed);
      console.log(`${passed ? "✅" : "❌"} ${testId}: ${testName}`);

      if (passed) {
        console.log(`   └─ System prompt: ${systemPrompt.length} characters`);
      } else if (systemPrompt) {
        console.log(
          "   └─ Contains 'Markdown':",
          systemPrompt.includes("Markdown")
        );
        console.log(
          "   └─ Contains 'British':",
          systemPrompt.includes("British")
        );
        console.log(
          "   └─ Contains 'Alt Text':",
          systemPrompt.includes("Alt Text")
        );
      }
    }

    // ========================================================================
    // S2-5: User Prompt Builds
    // ========================================================================
    {
      const testId = "S2-5";
      const testName = "User prompt builds from form";

      const controller = window.ImageDescriberController;
      let passed = false;

      if (controller?.buildUserPrompt) {
        try {
          const userPrompt = controller.buildUserPrompt();
          passed = typeof userPrompt === "string" && userPrompt.length > 0;
          logDebug("User prompt:", userPrompt);
        } catch (error) {
          console.log("   └─ Error:", error.message);
        }
      }

      results.record(testId, passed);
      console.log(`${passed ? "✅" : "❌"} ${testId}: ${testName}`);
    }

    // ========================================================================
    // S2-6: DOM Elements Cached (requires init)
    // ========================================================================
    {
      const testId = "S2-6";
      const testName = "DOM elements cached";

      const controller = window.ImageDescriberController;

      // Try to initialize if not already done
      if (controller && !controller._initialized) {
        console.log("   └─ Controller not initialized, initializing now...");
        await controller.init();
      }

      const elements = controller?.elements;

      const hasCritical =
        elements?.fileInput &&
        elements?.generateBtn &&
        elements?.output &&
        elements?.status;

      const passed = !!hasCritical;

      results.record(testId, passed);
      console.log(`${passed ? "✅" : "❌"} ${testId}: ${testName}`);

      if (!passed && elements) {
        console.log("   └─ fileInput:", !!elements.fileInput);
        console.log("   └─ generateBtn:", !!elements.generateBtn);
        console.log("   └─ output:", !!elements.output);
        console.log("   └─ status:", !!elements.status);
      }
    }

    // ========================================================================
    // S2-7: Generate Button State
    // ========================================================================
    {
      const testId = "S2-7";
      const testName = "Generate button initially disabled (no image)";

      const controller = window.ImageDescriberController;
      const generateBtn = controller?.elements?.generateBtn;

      // Should be disabled because no file is loaded
      const passed = generateBtn?.disabled === true;

      results.record(testId, passed);
      console.log(`${passed ? "✅" : "❌"} ${testId}: ${testName}`);

      if (!passed && generateBtn) {
        console.log("   └─ Button disabled:", generateBtn.disabled);
        console.log("   └─ Has file:", !!controller.currentFile);
      }
    }

    // ========================================================================
    // S2-8: Reduced Motion Detection
    // ========================================================================
    {
      const testId = "S2-8";
      const testName = "Reduced motion detection available";

      const controller = window.ImageDescriberController;
      let passed = false;

      if (controller?.prefersReducedMotion) {
        try {
          const result = controller.prefersReducedMotion();
          passed = typeof result === "boolean";
          logDebug("Reduced motion:", result);
        } catch (error) {
          console.log("   └─ Error:", error.message);
        }
      }

      results.record(testId, passed);
      console.log(`${passed ? "✅" : "❌"} ${testId}: ${testName}`);
    }

    // ========================================================================
    // S2-9: OpenRouterEmbed Available
    // ========================================================================
    {
      const testId = "S2-9";
      const testName = "OpenRouterEmbed available for integration";

      const passed =
        typeof window.OpenRouterEmbed === "function" &&
        typeof window.openRouterClient !== "undefined";

      results.record(testId, passed);
      console.log(`${passed ? "✅" : "❌"} ${testId}: ${testName}`);

      if (!passed) {
        console.log("   └─ OpenRouterEmbed:", typeof window.OpenRouterEmbed);
        console.log("   └─ openRouterClient:", typeof window.openRouterClient);
      }
    }

    // ========================================================================
    // S2-10: Clear Function Works
    // ========================================================================
    {
      const testId = "S2-10";
      const testName = "Clear function available and works";

      const controller = window.ImageDescriberController;
      let passed = false;

      if (controller?.clear) {
        try {
          // Should not throw
          controller.clear();
          passed =
            controller.currentFile === null &&
            controller.lastRawOutput === null;
        } catch (error) {
          console.log("   └─ Error:", error.message);
        }
      }

      results.record(testId, passed);
      console.log(`${passed ? "✅" : "❌"} ${testId}: ${testName}`);
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log("");
    console.log("═".repeat(60));
    console.log(
      `Stage 2 Results: ${results.passed}/${results.total} tests passed`
    );
    console.log("═".repeat(60));

    if (results.success) {
      console.log("✅ 🎉 STAGE 2 COMPLETE! All tests passing.");
      console.log("");
      console.log("Next steps:");
      console.log("  1. Upload an image to test file handling");
      console.log("  2. Run generation to test API integration");
      console.log("  3. Proceed to Stage 3 for advanced features");
    } else {
      console.log("❌ Some tests failed. Review output above.");
      console.log("");
      console.log("Common fixes:");
      console.log("  - Ensure prompt-loader.js is loaded before controller");
      console.log("  - Check that .txt files are accessible");
      console.log("  - Verify OpenRouter embed scripts are loaded");
    }

    console.log("");

    return {
      success: results.success,
      passed: results.passed,
      failed: results.failed,
      total: results.total,
      results: results.results,
    };
  }

  // ============================================================================
  // ADDITIONAL TEST UTILITIES
  // ============================================================================

  /**
   * Test file upload with a synthetic image
   * Creates a small test image for validation
   */
  async function testImageDescriberFileUpload() {
    console.log("\n🧪 Testing Image Describer File Upload...\n");

    const controller = window.ImageDescriberController;

    if (!controller) {
      console.log("❌ Controller not available");
      return false;
    }

    try {
      // Create a tiny 1x1 PNG as a test file
      const canvas = document.createElement("canvas");
      canvas.width = 10;
      canvas.height = 10;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#4CAF50";
      ctx.fillRect(0, 0, 10, 10);

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });

      const testFile = new File([blob], "test-image.png", {
        type: "image/png",
      });

      console.log("Created test file:", testFile.name, testFile.size, "bytes");

      // Test file handling
      await controller.handleFileSelect(testFile);

      // Verify state
      const hasFile = !!controller.currentFile;
      const hasBase64 = !!controller.currentBase64;
      const buttonEnabled = !controller.elements.generateBtn?.disabled;

      console.log("✓ File stored:", hasFile);
      console.log("✓ Base64 generated:", hasBase64);
      console.log("✓ Generate button enabled:", buttonEnabled);

      const passed = hasFile && hasBase64 && buttonEnabled;

      if (passed) {
        console.log("\n✅ File upload test passed!");
      } else {
        console.log("\n❌ File upload test failed");
      }

      // Clean up
      controller.clear();

      return passed;
    } catch (error) {
      console.error("❌ File upload test error:", error);
      return false;
    }
  }

  /**
   * Test prompt building with form data
   */
  function testPromptBuildingWithData() {
    console.log("\n🧪 Testing Prompt Building with Form Data...\n");

    const controller = window.ImageDescriberController;

    if (!controller) {
      console.log("❌ Controller not available");
      return false;
    }

    // Fill in form fields temporarily
    const subject = controller.elements.subject;
    const topic = controller.elements.topic;
    const objective = controller.elements.objective;

    if (subject) subject.value = "Biology";
    if (topic) topic.value = "Cell Division";
    if (objective) objective.value = "Understand mitosis phases";

    // Build user prompt
    const userPrompt = controller.buildUserPrompt();

    console.log("User prompt preview (first 500 chars):");
    console.log(userPrompt.substring(0, 500));

    // Check content
    const hasBiology = userPrompt.includes("Biology");
    const hasCellDivision = userPrompt.includes("Cell Division");
    const hasMitosis = userPrompt.includes("mitosis");

    console.log("\n✓ Contains subject:", hasBiology);
    console.log("✓ Contains topic:", hasCellDivision);
    console.log("✓ Contains objective:", hasMitosis);

    // Clean up
    if (subject) subject.value = "";
    if (topic) topic.value = "";
    if (objective) objective.value = "";

    const passed = hasBiology && hasCellDivision && hasMitosis;

    if (passed) {
      console.log("\n✅ Prompt building test passed!");
    } else {
      console.log("\n❌ Prompt building test failed");
    }

    return passed;
  }

  // ============================================================================
  // GLOBAL EXPORTS
  // ============================================================================

  window.testImageDescriber_Stage2 = testImageDescriber_Stage2;
  window.testImageDescriberFileUpload = testImageDescriberFileUpload;
  window.testPromptBuildingWithData = testPromptBuildingWithData;
})();
