/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER - STAGE 3 TESTS
 * ═══════════════════════════════════════════════════════════════
 *
 * Tests real-world functionality, copy, error handling, and polish.
 *
 * Stage 3 Objectives:
 * - Test real image upload and generation
 * - Verify copy functionality
 * - Test error handling
 * - Test reduced motion mode
 * - Regression testing
 *
 * VERSION: 1.0.0
 * DATE: 24 November 2025
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

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
  }

  // ============================================================================
  // TEST RESULTS HELPER
  // ============================================================================

  class TestResults {
    constructor() {
      this.passed = 0;
      this.failed = 0;
      this.results = {};
    }

    pass(testId, message) {
      this.passed++;
      this.results[testId] = { success: true, message };
      console.log(`✅ ${testId}: ${message}`);
    }

    fail(testId, message, details = null) {
      this.failed++;
      this.results[testId] = { success: false, message, details };
      console.log(`❌ ${testId}: ${message}`);
      if (details) {
        console.log("   Details:", details);
      }
    }

    get total() {
      return this.passed + this.failed;
    }

    get success() {
      return this.failed === 0;
    }

    summary() {
      console.log("\n" + "═".repeat(50));
      console.log(`Stage 3 Results: ${this.passed}/${this.total} tests passed`);
      console.log("═".repeat(50));
      return this.success;
    }
  }

  // ============================================================================
  // STAGE 3 AUTOMATED TESTS
  // ============================================================================

  /**
   * Run all Stage 3 automated tests
   * @returns {Promise<Object>} Test results
   */
  async function testImageDescriber_Stage3() {
    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║           IMAGE DESCRIBER - STAGE 3 TESTS                ║");
    console.log("║              Polish & Integration                        ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log("");

    const results = new TestResults();
    const controller = window.ImageDescriberController;

    // -------------------------------------------------------------------------
    // S3-1: Controller ready for generation
    // -------------------------------------------------------------------------
    const s3_1 =
      controller &&
      controller._initialized &&
      typeof controller.generate === "function" &&
      typeof controller.copyToClipboard === "function";

    if (s3_1) {
      results.pass("S3-1", "Controller initialised and ready for generation");
    } else {
      results.fail("S3-1", "Controller not ready", {
        hasController: !!controller,
        initialised: controller?._initialized,
        hasGenerate: typeof controller?.generate === "function",
        hasCopy: typeof controller?.copyToClipboard === "function",
      });
    }

    // -------------------------------------------------------------------------
    // S3-2: File upload elements present and functional
    // -------------------------------------------------------------------------
    const fileInput = document.getElementById("imgdesc-file-input");
    const uploadArea = document.getElementById("imgdesc-upload-area");
    const preview = document.getElementById("imgdesc-preview");

    const s3_2 =
      fileInput &&
      uploadArea &&
      preview &&
      fileInput.type === "file" &&
      fileInput.accept.includes("image/jpeg");

    if (s3_2) {
      results.pass("S3-2", "File upload elements present and configured");
    } else {
      results.fail("S3-2", "File upload elements missing or misconfigured", {
        hasFileInput: !!fileInput,
        hasUploadArea: !!uploadArea,
        hasPreview: !!preview,
        acceptTypes: fileInput?.accept,
      });
    }

    // -------------------------------------------------------------------------
    // S3-3: Generate button state management
    // -------------------------------------------------------------------------
    const generateBtn = document.getElementById("imgdesc-generate");
    const initiallyDisabled = generateBtn?.disabled === true;

    // Controller should have methods to update button states
    const hasStateManagement =
      typeof controller?.updateButtonStates === "function";

    const s3_3 = generateBtn && initiallyDisabled && hasStateManagement;

    if (s3_3) {
      results.pass(
        "S3-3",
        "Generate button has proper state management (disabled without file)"
      );
    } else {
      results.fail("S3-3", "Generate button state management issue", {
        hasButton: !!generateBtn,
        initiallyDisabled,
        hasStateManagement,
      });
    }

    // -------------------------------------------------------------------------
    // S3-4: Copy button present and accessible
    // -------------------------------------------------------------------------
    const copyBtn = document.getElementById("imgdesc-copy");
    const copyBtnText = copyBtn?.textContent?.trim();
    const copyBtnDisabledInitially = copyBtn?.disabled;

    const s3_4 =
      copyBtn &&
      copyBtnText &&
      copyBtnText.length > 0 &&
      copyBtnDisabledInitially;

    if (s3_4) {
      results.pass(
        "S3-4",
        `Copy button present with text "${copyBtnText}" (disabled initially)`
      );
    } else {
      results.fail("S3-4", "Copy button configuration issue", {
        hasButton: !!copyBtn,
        text: copyBtnText,
        disabledInitially: copyBtnDisabledInitially,
      });
    }

    // -------------------------------------------------------------------------
    // S3-5: Regenerate button present
    // -------------------------------------------------------------------------
    const regenerateBtn = document.getElementById("imgdesc-regenerate");
    const regenerateBtnText = regenerateBtn?.textContent?.trim();

    const s3_5 =
      regenerateBtn && regenerateBtnText && regenerateBtnText.length > 0;

    if (s3_5) {
      results.pass(
        "S3-5",
        `Regenerate button present with text "${regenerateBtnText}"`
      );
    } else {
      results.fail("S3-5", "Regenerate button missing or misconfigured", {
        hasButton: !!regenerateBtn,
        text: regenerateBtnText,
      });
    }

    // -------------------------------------------------------------------------
    // S3-6: Clear functionality available
    // -------------------------------------------------------------------------
    const clearBtn = document.getElementById("imgdesc-clear");
    const hasClearMethod = typeof controller?.clear === "function";
    const hasClearFileMethod = typeof controller?.clearFile === "function";

    const s3_6 = clearBtn && hasClearMethod && hasClearFileMethod;

    if (s3_6) {
      results.pass("S3-6", "Clear functionality available (button + methods)");
    } else {
      results.fail("S3-6", "Clear functionality incomplete", {
        hasButton: !!clearBtn,
        hasClearMethod,
        hasClearFileMethod,
      });
    }

    // -------------------------------------------------------------------------
    // S3-7: Error handling methods present
    // -------------------------------------------------------------------------
    const hasShowError = typeof controller?.showError === "function";
    const hasShowStatus = typeof controller?.showStatus === "function";
    const hasHideStatus = typeof controller?.hideStatus === "function";
    const statusElement = document.getElementById("imgdesc-status");

    const s3_7 =
      hasShowError && hasShowStatus && hasHideStatus && statusElement;

    if (s3_7) {
      results.pass("S3-7", "Error handling methods and UI elements present");
    } else {
      results.fail("S3-7", "Error handling incomplete", {
        hasShowError,
        hasShowStatus,
        hasHideStatus,
        hasStatusElement: !!statusElement,
      });
    }

    // -------------------------------------------------------------------------
    // S3-8: Reduced motion detection
    // -------------------------------------------------------------------------
    const hasPrefersReducedMotion =
      typeof controller?.prefersReducedMotion === "function";
    let reducedMotionWorks = false;

    if (hasPrefersReducedMotion) {
      try {
        const result = controller.prefersReducedMotion();
        reducedMotionWorks = typeof result === "boolean";
      } catch (e) {
        logWarn("Reduced motion test error:", e);
      }
    }

    const s3_8 = hasPrefersReducedMotion && reducedMotionWorks;

    if (s3_8) {
      results.pass(
        "S3-8",
        `Reduced motion detection works (current: ${controller.prefersReducedMotion()})`
      );
    } else {
      results.fail("S3-8", "Reduced motion detection issue", {
        hasMethod: hasPrefersReducedMotion,
        methodWorks: reducedMotionWorks,
      });
    }

    // -------------------------------------------------------------------------
    // S3-9: Output container accessibility
    // -------------------------------------------------------------------------
    const outputSection = document.getElementById("imgdesc-output-section");
    const output = document.getElementById("imgdesc-output");
    const hasAriaLive =
      output?.getAttribute("aria-live") ||
      outputSection?.getAttribute("aria-live");
    const hasAriaAtomic =
      output?.getAttribute("aria-atomic") ||
      outputSection?.getAttribute("aria-atomic");

    const s3_9 = output && outputSection && (hasAriaLive || hasAriaAtomic);

    if (s3_9) {
      results.pass("S3-9", "Output container has accessibility attributes");
    } else {
      results.fail("S3-9", "Output container accessibility incomplete", {
        hasOutputSection: !!outputSection,
        hasOutput: !!output,
        hasAriaLive: !!hasAriaLive,
        hasAriaAtomic: !!hasAriaAtomic,
      });
    }

    // -------------------------------------------------------------------------
    // S3-10: OpenRouter Embed API available
    // -------------------------------------------------------------------------
    const hasOpenRouterEmbed = typeof window.OpenRouterEmbed === "function";
    const hasOpenRouterClient = !!window.openRouterClient;
    const hasEmbedFileUtils = typeof window.EmbedFileUtils === "function";

    const s3_10 = hasOpenRouterEmbed && hasOpenRouterClient;

    if (s3_10) {
      results.pass("S3-10", "OpenRouter Embed API and client available");
    } else {
      results.fail("S3-10", "OpenRouter Embed dependencies missing", {
        hasOpenRouterEmbed,
        hasOpenRouterClient,
        hasEmbedFileUtils,
      });
    }

    // Summary
    results.summary();

    if (results.success) {
      console.log("🎉 ALL STAGE 3 AUTOMATED TESTS PASSED!\n");
      console.log("Next steps:");
      console.log("  1. Run manual tests with real images");
      console.log("  2. Test: await window.testRealGeneration()");
      console.log("  3. Test: await window.testCopy()");
      console.log("  4. Test: window.testReducedMotionMode()");
    } else {
      console.log("⚠️ Some tests failed. Review output above.\n");
    }

    return { success: results.success, results: results.results };
  }

  // ============================================================================
  // MANUAL TEST HELPERS
  // ============================================================================

  /**
   * Create a test image file for testing purposes
   * Creates a small coloured PNG image
   * @returns {File} Test image file
   */
  function createTestImageFile() {
    // Create a small canvas and convert to blob
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");

    // Draw a simple test pattern
    ctx.fillStyle = "#4A90D9";
    ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TEST", 50, 50);

    // Convert to blob synchronously using toDataURL
    const dataURL = canvas.toDataURL("image/png");
    const byteString = atob(dataURL.split(",")[1]);
    const mimeString = dataURL.split(",")[0].split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    const blob = new Blob([ab], { type: mimeString });
    return new File([blob], "test-image.png", { type: "image/png" });
  }

  /**
   * Simulate file upload for testing
   * @returns {Promise<boolean>} Success status
   */
  async function simulateFileUpload() {
    const controller = window.ImageDescriberController;

    if (!controller || !controller._initialized) {
      console.log(
        "❌ Controller not ready. Switch to Image Describer tool first."
      );
      return false;
    }

    console.log("📁 Creating test image file...");
    const testFile = createTestImageFile();

    console.log("📤 Simulating file upload...");
    try {
      await controller.handleFileSelect(testFile);
      console.log("✅ File upload simulated successfully");
      console.log("   File name:", controller.currentFile?.name);
      console.log("   Has base64:", !!controller.currentBase64);
      return true;
    } catch (error) {
      console.log("❌ File upload failed:", error.message);
      return false;
    }
  }

  /**
   * Test generation with a real image
   * Requires manual image upload first, or use simulateFileUpload()
   */
  async function testRealGeneration() {
    console.log("\n🧪 TESTING REAL GENERATION");
    console.log("═".repeat(40));

    const controller = window.ImageDescriberController;

    if (!controller || !controller._initialized) {
      console.log(
        "❌ Controller not ready. Switch to Image Describer tool first."
      );
      console.log("   Then run: window.testImageDescriber_Stage3()");
      return false;
    }

    // Check if file is uploaded
    if (!controller.currentFile) {
      console.log("⚠️ No image uploaded. Simulating upload...");
      const uploaded = await simulateFileUpload();
      if (!uploaded) {
        console.log("❌ Could not simulate file upload.");
        console.log("   Please upload an image manually and try again.");
        return false;
      }
    }

    console.log("📝 Current file:", controller.currentFile?.name);
    console.log("📊 Starting generation...");
    console.log("");

    const startTime = performance.now();

    try {
      await controller.generate();
      const elapsed = Math.round(performance.now() - startTime);

      console.log("");
      console.log("✅ Generation complete!");
      console.log("   Time:", elapsed, "ms");
      console.log(
        "   Output length:",
        controller.lastRawOutput?.length || 0,
        "chars"
      );

      // Check if output has expected sections
      const output = controller.lastRawOutput || "";
      const hasTitle = /## 1\. Title|# Title/i.test(output);
      const hasAltText = /## 2\. Alt Text|# Alt Text/i.test(output);
      const hasLongDesc = /## 3\. Long Description|# Long Description/i.test(
        output
      );
      const hasTextContent = /## 4\. Text Content|# Text Content/i.test(output);

      console.log("");
      console.log("📋 Output sections:");
      console.log(`   Title: ${hasTitle ? "✅" : "❌"}`);
      console.log(`   Alt Text: ${hasAltText ? "✅" : "❌"}`);
      console.log(`   Long Description: ${hasLongDesc ? "✅" : "❌"}`);
      console.log(`   Text Content: ${hasTextContent ? "✅" : "❌"}`);

      if (hasTitle && hasAltText && hasLongDesc && hasTextContent) {
        console.log("");
        console.log("🎉 All expected sections present!");
      }

      // Preview the output
      console.log("");
      console.log("📝 Output preview (first 500 chars):");
      console.log("─".repeat(40));
      console.log(
        output.substring(0, 500) + (output.length > 500 ? "..." : "")
      );
      console.log("─".repeat(40));

      return true;
    } catch (error) {
      console.log("");
      console.log("❌ Generation failed:", error.message);
      console.log("   Error details:", error);
      return false;
    }
  }

  /**
   * Test copy functionality
   */
  async function testCopy() {
    console.log("\n🧪 TESTING COPY FUNCTIONALITY");
    console.log("═".repeat(40));

    const controller = window.ImageDescriberController;

    if (!controller || !controller._initialized) {
      console.log("❌ Controller not ready.");
      return false;
    }

    if (!controller.lastRawOutput) {
      console.log("⚠️ No output to copy. Generate first.");
      console.log("   Run: await window.testRealGeneration()");
      return false;
    }

    console.log("📋 Attempting to copy output...");
    console.log("   Output length:", controller.lastRawOutput.length, "chars");

    try {
      await controller.copyToClipboard();
      console.log("");
      console.log("✅ Copy method completed successfully");
      console.log("   Try pasting (Ctrl+V) to verify the content was copied.");
      console.log("");
      console.log("   First 100 chars of copied content:");
      console.log("   " + controller.lastRawOutput.substring(0, 100) + "...");
      return true;
    } catch (error) {
      console.log("");
      console.log("❌ Copy failed:", error.message);
      console.log("   This might be due to clipboard permissions.");
      return false;
    }
  }

  /**
   * Test reduced motion mode
   */
  function testReducedMotionMode() {
    console.log("\n🧪 TESTING REDUCED MOTION MODE");
    console.log("═".repeat(40));

    const controller = window.ImageDescriberController;

    if (!controller) {
      console.log("❌ Controller not available.");
      return false;
    }

    const prefersReduced = controller.prefersReducedMotion();

    console.log("Current reduced motion preference:", prefersReduced);
    console.log("");

    if (prefersReduced) {
      console.log("✅ Reduced motion is ENABLED");
      console.log("   Generation will use non-streaming mode");
    } else {
      console.log("✅ Reduced motion is DISABLED");
      console.log("   Generation will use streaming mode");
    }

    console.log("");
    console.log("To test reduced motion mode:");
    console.log("  1. Open DevTools (F12)");
    console.log("  2. Open Command Menu (Ctrl+Shift+P)");
    console.log("  3. Type 'rendering' and select 'Show Rendering'");
    console.log("  4. Find 'Emulate CSS media feature prefers-reduced-motion'");
    console.log("  5. Select 'prefers-reduced-motion: reduce'");
    console.log("  6. Run window.testReducedMotionMode() again");
    console.log("  7. Then run await window.testRealGeneration()");
    console.log("");
    console.log("In reduced motion mode, the AI response should appear");
    console.log("all at once instead of streaming character by character.");

    return prefersReduced;
  }

  /**
   * Test error handling
   * Note: The controller handles errors gracefully by showing error messages
   * rather than throwing exceptions - this is the correct UX approach.
   */
  async function testErrorHandling() {
    console.log("\n🧪 TESTING ERROR HANDLING");
    console.log("═".repeat(40));

    const controller = window.ImageDescriberController;

    if (!controller || !controller._initialized) {
      console.log("❌ Controller not ready.");
      return false;
    }

    let testsRun = 0;
    let testsPassed = 0;
    const status = document.getElementById("imgdesc-status");

    // Test 1: Generate without file (should show error, not throw)
    console.log("\n📋 Test 1: Generate without file");
    const originalFile = controller.currentFile;
    const originalBase64 = controller.currentBase64;

    controller.currentFile = null;
    controller.currentBase64 = null;
    controller.hideStatus(); // Reset status first

    await controller.generate();

    // Check that error was shown (graceful handling)
    const showedNoFileError =
      !status.hidden &&
      status.textContent.toLowerCase().includes("upload") &&
      status.classList.contains("imgdesc-status-error");

    if (showedNoFileError) {
      console.log("   ✅ Correctly showed error message for missing file");
      testsPassed++;
    } else {
      console.log("   ❌ Did not show expected error message");
      console.log("      Status hidden:", status.hidden);
      console.log("      Status text:", status.textContent);
    }
    testsRun++;

    // Restore state
    controller.currentFile = originalFile;
    controller.currentBase64 = originalBase64;
    controller.hideStatus();

    // Test 2: Show/hide status
    console.log("\n📋 Test 2: Status display");

    controller.showStatus("Test message", "processing");
    const showsProcessing =
      !status.hidden && status.textContent === "Test message";

    controller.hideStatus();
    const hidesCorrectly = status.hidden;

    if (showsProcessing && hidesCorrectly) {
      console.log("   ✅ Status show/hide works correctly");
      testsPassed++;
    } else {
      console.log("   ❌ Status display issue");
      console.log("      Shows processing:", showsProcessing);
      console.log("      Hides correctly:", hidesCorrectly);
    }
    testsRun++;

    // Test 3: Show error
    console.log("\n📋 Test 3: Error display");
    controller.showError("Test error message");
    const showsError =
      !status.hidden &&
      status.textContent === "Test error message" &&
      status.classList.contains("imgdesc-status-error");

    if (showsError) {
      console.log("   ✅ Error display works correctly");
      testsPassed++;
    } else {
      console.log("   ❌ Error display issue");
    }
    testsRun++;
    controller.hideStatus();

    // Test 4: Invalid file type handling (should show error, not store file)
    console.log("\n📋 Test 4: Invalid file type rejection");
    const textFile = new File(["hello"], "test.txt", { type: "text/plain" });

    // Clear any existing file state first
    controller.currentFile = null;
    controller.currentBase64 = null;
    controller.hideStatus();

    // Try to select invalid file
    await controller.handleFileSelect(textFile);

    // Check that:
    // 1. Error message was shown
    // 2. No file was stored
    const showedInvalidTypeError =
      !status.hidden &&
      status.textContent.toLowerCase().includes("invalid") &&
      status.classList.contains("imgdesc-status-error");
    const fileNotStored = controller.currentFile === null;

    if (showedInvalidTypeError && fileNotStored) {
      console.log("   ✅ Correctly rejected invalid file type");
      testsPassed++;
    } else {
      console.log("   ❌ Invalid file handling issue");
      console.log("      Error shown:", showedInvalidTypeError);
      console.log("      File not stored:", fileNotStored);
      console.log("      Status text:", status.textContent);
    }
    testsRun++;
    controller.hideStatus();

    console.log("");
    console.log("═".repeat(40));
    console.log(`Error handling tests: ${testsPassed}/${testsRun} passed`);

    return testsPassed === testsRun;
  }

  /**
   * Test clear functionality
   */
  async function testClearFunctionality() {
    console.log("\n🧪 TESTING CLEAR FUNCTIONALITY");
    console.log("═".repeat(40));

    const controller = window.ImageDescriberController;

    if (!controller || !controller._initialized) {
      console.log("❌ Controller not ready.");
      return false;
    }

    // First, ensure we have some state
    if (!controller.currentFile) {
      console.log("📁 Setting up test state...");
      await simulateFileUpload();
    }

    const hadFile = !!controller.currentFile;
    console.log("State before clear:");
    console.log("  Has file:", hadFile);
    console.log("  Has base64:", !!controller.currentBase64);
    console.log("  Has output:", !!controller.lastRawOutput);

    // Run clear
    console.log("\n🧹 Running clear()...");
    controller.clear();

    // Check state after clear
    const clearedFile = controller.currentFile === null;
    const clearedBase64 = controller.currentBase64 === null;
    const clearedOutput = controller.lastRawOutput === null;
    const previewHidden = document.getElementById("imgdesc-preview")?.hidden;
    const outputSectionHidden = document.getElementById(
      "imgdesc-output-section"
    )?.hidden;

    console.log("\nState after clear:");
    console.log("  File cleared:", clearedFile ? "✅" : "❌");
    console.log("  Base64 cleared:", clearedBase64 ? "✅" : "❌");
    console.log("  Output cleared:", clearedOutput ? "✅" : "❌");
    console.log("  Preview hidden:", previewHidden ? "✅" : "❌");
    console.log("  Output section hidden:", outputSectionHidden ? "✅" : "❌");

    const allCleared =
      clearedFile &&
      clearedBase64 &&
      clearedOutput &&
      previewHidden &&
      outputSectionHidden;

    if (allCleared) {
      console.log("\n✅ Clear functionality works correctly!");
    } else {
      console.log("\n❌ Clear functionality incomplete");
    }

    return allCleared;
  }

  /**
   * Run comprehensive Stage 3 test suite
   */
  async function runFullStage3Suite() {
    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║         FULL STAGE 3 TEST SUITE                          ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log("");

    let totalTests = 0;
    let passedTests = 0;

    // 1. Automated tests
    console.log("📋 Running automated tests...\n");
    const autoResults = await testImageDescriber_Stage3();
    totalTests += Object.keys(autoResults.results).length;
    passedTests += Object.values(autoResults.results).filter(
      (r) => r.success
    ).length;

    // 2. Error handling tests
    console.log("\n📋 Running error handling tests...\n");
    const errorResult = await testErrorHandling();
    totalTests += 4;
    if (errorResult) passedTests += 4;

    // 3. Clear functionality test
    console.log("\n📋 Running clear functionality test...\n");
    const clearResult = await testClearFunctionality();
    totalTests += 1;
    if (clearResult) passedTests += 1;

    // Summary
    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║              STAGE 3 COMPLETE RESULTS                    ║");
    console.log("╠══════════════════════════════════════════════════════════╣");
    console.log(`║  Total Tests: ${totalTests.toString().padEnd(41)}║`);
    console.log(`║  Passed: ${passedTests.toString().padEnd(46)}║`);
    console.log(
      `║  Failed: ${(totalTests - passedTests).toString().padEnd(46)}║`
    );
    console.log("╚══════════════════════════════════════════════════════════╝");

    if (passedTests === totalTests) {
      console.log("\n🎉 ALL STAGE 3 TESTS PASSED!");
      console.log("\nManual tests still recommended:");
      console.log("  - await window.testRealGeneration() with real image");
      console.log("  - await window.testCopy() and paste to verify");
      console.log("  - window.testReducedMotionMode() with DevTools setting");
    } else {
      console.log("\n⚠️ Some tests failed. Review output above.");
    }

    return {
      total: totalTests,
      passed: passedTests,
      failed: totalTests - passedTests,
      success: passedTests === totalTests,
    };
  }

  // ============================================================================
  // REGRESSION TEST - RUN PREVIOUS STAGE TESTS
  // ============================================================================

  /**
   * Run regression tests (Stage 1)
   */
  async function runRegressionTests() {
    console.log("\n🔄 RUNNING REGRESSION TESTS");
    console.log("═".repeat(40));

    let allPassed = true;

    // Stage 1 tests
    if (typeof window.testImageDescriber_Stage1 === "function") {
      console.log("\n📋 Running Stage 1 tests...");
      const stage1 = window.testImageDescriber_Stage1();
      if (!stage1.success) {
        allPassed = false;
        console.log("❌ Stage 1 regression failed");
      } else {
        console.log("✅ Stage 1 tests still passing");
      }
    } else {
      console.log("⚠️ Stage 1 tests not available");
    }

    // Stage 2 tests (if available)
    if (typeof window.testImageDescriber_Stage2 === "function") {
      console.log("\n📋 Running Stage 2 tests...");
      const stage2 = await window.testImageDescriber_Stage2();
      if (!stage2.success) {
        allPassed = false;
        console.log("❌ Stage 2 regression failed");
      } else {
        console.log("✅ Stage 2 tests still passing");
      }
    } else {
      console.log("⚠️ Stage 2 tests not available");
    }

    return allPassed;
  }

  // ============================================================================
  // DIAGNOSTIC HELPERS
  // ============================================================================

  /**
   * Show current controller state
   */
  function showControllerState() {
    const controller = window.ImageDescriberController;

    console.log("\n📊 IMAGE DESCRIBER CONTROLLER STATE");
    console.log("═".repeat(40));

    if (!controller) {
      console.log("❌ Controller not available");
      return;
    }

    console.log("Initialisation:");
    console.log("  _initialized:", controller._initialized);
    console.log("  config loaded:", !!controller.config);

    console.log("\nFile State:");
    console.log("  currentFile:", controller.currentFile?.name || "none");
    console.log(
      "  currentBase64:",
      controller.currentBase64
        ? `${controller.currentBase64.length} chars`
        : "none"
    );

    console.log("\nGeneration State:");
    console.log("  isGenerating:", controller.isGenerating);
    console.log(
      "  lastRawOutput:",
      controller.lastRawOutput
        ? `${controller.lastRawOutput.length} chars`
        : "none"
    );
    console.log("  embedInstance:", !!controller.embedInstance);

    console.log("\nCached Elements:");
    const elementCount = Object.keys(controller.elements || {}).length;
    const nullElements = Object.entries(controller.elements || {})
      .filter(([, v]) => v === null)
      .map(([k]) => k);
    console.log("  Total cached:", elementCount);
    console.log(
      "  Null elements:",
      nullElements.length > 0 ? nullElements.join(", ") : "none"
    );

    console.log("\nPrompts:");
    console.log(
      "  PROMPT_MARKDOWN:",
      window.PROMPT_MARKDOWN
        ? `${window.PROMPT_MARKDOWN.length} chars`
        : "not loaded"
    );
    console.log(
      "  PROMPT_WRITING_GUIDE:",
      window.PROMPT_WRITING_GUIDE
        ? `${window.PROMPT_WRITING_GUIDE.length} chars`
        : "not loaded"
    );
    console.log(
      "  PROMPT_IMAGE_DESCRIPTION:",
      window.PROMPT_IMAGE_DESCRIPTION
        ? `${window.PROMPT_IMAGE_DESCRIPTION.length} chars`
        : "not loaded"
    );
  }

  /**
   * Check all dependencies
   */
  function checkDependencies() {
    console.log("\n🔍 CHECKING DEPENDENCIES");
    console.log("═".repeat(40));

    const deps = {
      ImageDescriberController: !!window.ImageDescriberController,
      OpenRouterEmbed: typeof window.OpenRouterEmbed === "function",
      openRouterClient: !!window.openRouterClient,
      EmbedFileUtils: typeof window.EmbedFileUtils === "function",
      MarkdownEditor: !!window.MarkdownEditor,
      notifySuccess: typeof window.notifySuccess === "function",
      notifyError: typeof window.notifyError === "function",
      notifyInfo: typeof window.notifyInfo === "function",
      safeConfirm: typeof window.safeConfirm === "function",
      imageDescriberConfig: !!window.imageDescriberConfig,
      promptsLoaded: !!window.promptsLoaded,
    };

    let allPresent = true;
    Object.entries(deps).forEach(([name, present]) => {
      console.log(`  ${present ? "✅" : "❌"} ${name}`);
      if (!present) allPresent = false;
    });

    console.log("");
    if (allPresent) {
      console.log("✅ All dependencies present");
    } else {
      console.log("⚠️ Some dependencies missing");
    }

    return allPresent;
  }

  // ============================================================================
  // GLOBAL EXPORTS
  // ============================================================================

  // Main test functions
  window.testImageDescriber_Stage3 = testImageDescriber_Stage3;
  window.runFullStage3Suite = runFullStage3Suite;
  window.runRegressionTests = runRegressionTests;

  // Manual test helpers
  window.testRealGeneration = testRealGeneration;
  window.testCopy = testCopy;
  window.testReducedMotionMode = testReducedMotionMode;
  window.testErrorHandling = testErrorHandling;
  window.testClearFunctionality = testClearFunctionality;

  // Utility functions
  window.simulateFileUpload = simulateFileUpload;
  window.createTestImageFile = createTestImageFile;

  // Diagnostic functions
  window.showControllerState = showControllerState;
  window.checkDependencies = checkDependencies;
})();
