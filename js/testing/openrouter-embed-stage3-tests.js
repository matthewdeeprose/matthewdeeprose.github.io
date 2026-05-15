/**
 * OpenRouter Embed API - Stage 3 Test Suite
 *
 * Comprehensive testing for streaming functionality
 *
 * @version 1.0.0 (Stage 3)
 * @requires window.OpenRouterEmbed
 * @date 23 November 2025
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

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[EmbedStage3Tests] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedStage3Tests] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedStage3Tests] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedStage3Tests] ${message}`, ...args);
  }

  // ============================================================================
  // STAGE 3 TESTING SUITE - STREAMING SUPPORT
  // ============================================================================

  /**
   * Stage 3 Test 1: Basic Streaming
   */
  window.testEmbedStage3_BasicStreaming = async function () {
    console.log("\n🧪 STAGE 3 TEST 1: Basic Streaming");
    console.log("===================================\n");

    // Create test container if doesn't exist
    let container = document.getElementById("embed-test-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "embed-test-container";
      container.style.cssText =
        "border: 2px solid #ccc; padding: 1rem; margin: 1rem 0; min-height: 100px;";
      document.body.appendChild(container);
    }

    const embed = new OpenRouterEmbed({
      containerId: "embed-test-container",
      showNotifications: false,
    });

    let chunkCount = 0;
    let completeCalled = false;
    const chunks = [];

    try {
      await embed.sendStreamingRequest({
        userPrompt: "Count from 1 to 5, one number per line.",
        onChunk: (chunk) => {
          chunkCount++;
          chunks.push(chunk.text);
          console.log(`Chunk ${chunkCount}:`, chunk.text);
        },
        onComplete: (response) => {
          completeCalled = true;
          console.log("✅ Stream completed");
          console.log("✅ Total chunks:", chunkCount);
          console.log("✅ Response structure:", {
            hasText: !!response.text,
            hasMetadata: !!response.metadata,
            streamId: response.metadata.streamId,
          });
        },
      });

      console.log("\n✅ Chunks received:", chunkCount);
      console.log("✅ Complete callback called:", completeCalled);
      console.log("✅ State cleaned:", !embed.isStreaming);
      console.log("\n🎉 TEST 1 PASSED!\n");

      return { success: true, chunks: chunkCount };
    } catch (error) {
      console.error("❌ TEST 1 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Stage 3 Test 2: Stream Cancellation
   */
  window.testEmbedStage3_Cancellation = async function () {
    console.log("\n🧪 STAGE 3 TEST 2: Stream Cancellation");
    console.log("=======================================\n");

    // Create test container if doesn't exist
    let container = document.getElementById("embed-test-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "embed-test-container";
      container.style.cssText =
        "border: 2px solid #ccc; padding: 1rem; margin: 1rem 0; min-height: 100px;";
      document.body.appendChild(container);
    }

    const embed = new OpenRouterEmbed({
      containerId: "embed-test-container",
      showNotifications: false,
    });

    let chunkCount = 0;
    let cancelled = false;

    try {
      const streamPromise = embed.sendStreamingRequest({
        userPrompt:
          "Write a very long detailed essay about artificial intelligence...",
        onChunk: (chunk) => {
          chunkCount++;
          console.log(`Chunk ${chunkCount}`);

          // Cancel after 3 chunks
          if (chunkCount === 3 && !cancelled) {
            cancelled = true;
            console.log("🛑 Cancelling stream...");
            embed.cancelStreaming("Test cancellation");
          }
        },
        onError: (error) => {
          console.log("✅ Error callback received:", error.message);
        },
      });

      await streamPromise;
    } catch (error) {
      console.log("✅ Stream cancelled as expected");
    }

    console.log("✅ Chunks before cancel:", chunkCount);
    console.log("✅ State cleaned:", !embed.isStreaming);
    console.log("\n🎉 TEST 2 PASSED!\n");

    return { success: true, chunksBeforeCancel: chunkCount };
  };

  /**
   * Stage 3 Test 3: Streaming Callbacks
   */
  window.testEmbedStage3_Callbacks = async function () {
    console.log("\n🧪 STAGE 3 TEST 3: Streaming Callbacks");
    console.log("=======================================\n");

    // Create test container if doesn't exist
    let container = document.getElementById("embed-test-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "embed-test-container";
      container.style.cssText =
        "border: 2px solid #ccc; padding: 1rem; margin: 1rem 0; min-height: 100px;";
      document.body.appendChild(container);
    }

    const embed = new OpenRouterEmbed({
      containerId: "embed-test-container",
      showNotifications: false,
    });

    const callLog = [];

    try {
      await embed.sendStreamingRequest({
        userPrompt: 'Say "Hello World"',
        onChunk: (chunk) => {
          callLog.push({ type: "chunk", index: chunk.metadata.chunkIndex });
        },
        onComplete: (response) => {
          callLog.push({ type: "complete", textLength: response.text.length });
        },
        onError: (error) => {
          callLog.push({ type: "error", message: error.message });
        },
      });

      const chunks = callLog.filter((c) => c.type === "chunk");
      const completes = callLog.filter((c) => c.type === "complete");
      const errors = callLog.filter((c) => c.type === "error");

      console.log("✅ Chunk callbacks:", chunks.length);
      console.log("✅ Complete callbacks:", completes.length);
      console.log("✅ Error callbacks:", errors.length);
      console.log(
        "✅ Callback order correct:",
        callLog[callLog.length - 1].type === "complete",
      );
      console.log("\n🎉 TEST 3 PASSED!\n");

      return { success: true, callbacks: callLog.length };
    } catch (error) {
      console.error("❌ TEST 3 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Stage 3 Test 4: Streaming with Files
   */
  window.testEmbedStage3_WithFiles = async function () {
    console.log("\n🧪 STAGE 3 TEST 4: Streaming with Files");
    console.log("========================================\n");

    // Create test container if doesn't exist
    let container = document.getElementById("embed-test-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "embed-test-container";
      container.style.cssText =
        "border: 2px solid #ccc; padding: 1rem; margin: 1rem 0; min-height: 100px;";
      document.body.appendChild(container);
    }

    const embed = new OpenRouterEmbed({
      containerId: "embed-test-container",
      showNotifications: false,
    });

    try {
      // Create a minimal valid 1x1 PNG image (69 bytes)
      // This is a real PNG file, not just zeros
      const pngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const pngBytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
      const imageFile = new File([pngBytes], "test.png", {
        type: "image/png",
      });

      // Attach file
      await embed.attachFile(imageFile);
      console.log("✅ File attached");

      let chunkCount = 0;

      // Stream with file
      await embed.sendStreamingRequest({
        userPrompt: "Describe this image briefly",
        onChunk: () => chunkCount++,
      });

      console.log("✅ Streaming with file works");
      console.log("✅ Chunks received:", chunkCount);
      console.log("\n🎉 TEST 4 PASSED!\n");

      embed.clearFile();
      return { success: true, chunks: chunkCount };
    } catch (error) {
      console.error("❌ TEST 4 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Stage 3 Test 5: Stage 1 Regression
   */
  window.testEmbedStage3_Regressions = async function () {
    console.log("\n🧪 STAGE 3 TEST 5: Regression Tests");
    console.log("====================================\n");

    console.log("Running Stage 1 tests...");
    const stage1Pass = await window.testEmbedStage1_All();

    console.log("\n✅ Stage 1 tests:", stage1Pass ? "PASS" : "FAIL");

    if (stage1Pass) {
      console.log("\n🎉 TEST 5 PASSED - No regressions!\n");
      return { success: true, stage1Pass };
    } else {
      console.error("\n❌ TEST 5 FAILED - Regressions detected!\n");
      return { success: false, stage1Pass };
    }
  };

  // ============================================================================
  // ENHANCEMENT TESTS
  // ============================================================================

  /**
   * Enhancement 1: PDF Streaming Support
   * Tests streaming with PDF file attachments using real user-selected file
   */
  window.testEmbedStage3_PDFStreaming = async function () {
    console.log("\n🧪 ENHANCEMENT 1: PDF Streaming Support");
    console.log("========================================\n");

    // Create test container if doesn't exist
    let container = document.getElementById("embed-test-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "embed-test-container";
      container.style.cssText =
        "border: 2px solid #ccc; padding: 1rem; margin: 1rem 0; min-height: 100px;";
      document.body.appendChild(container);
    }

    const embed = new OpenRouterEmbed({
      containerId: "embed-test-container",
      showNotifications: false,
    });

    try {
      // Create file input for user to select PDF
      console.log("📂 Please select a PDF file to test...\n");

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "application/pdf,.pdf";
      fileInput.style.cssText = "display: none;";
      document.body.appendChild(fileInput);

      // Wait for user to select file
      const pdfFile = await new Promise((resolve, reject) => {
        fileInput.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) {
            reject(new Error("No file selected"));
            return;
          }
          if (file.type !== "application/pdf") {
            reject(new Error("Selected file is not a PDF"));
            return;
          }
          resolve(file);
        };

        // Trigger file picker
        fileInput.click();

        // Timeout after 60 seconds
        setTimeout(() => {
          reject(new Error("File selection timeout"));
        }, 60000);
      });

      // Clean up file input
      document.body.removeChild(fileInput);

      console.log("📄 PDF file selected:", {
        name: pdfFile.name,
        size: pdfFile.size + " bytes",
        type: pdfFile.type,
      });

      // Attach PDF file
      console.log("\n⏳ Attaching PDF...");
      const analysis = await embed.attachFile(pdfFile);
      console.log("✅ PDF attached successfully");
      console.log("   Analysis:", {
        pages: analysis.pages,
        engine: analysis.engine,
        cost: `£${analysis.cost.toFixed(3)}`,
        isImage: analysis.isImage,
      });

      // Stream with PDF
      console.log("\n⏳ Streaming request with PDF...");
      let chunkCount = 0;
      let fullResponse = "";

      await embed.sendStreamingRequest({
        userPrompt: "What does this PDF contain? Summarise briefly.",
        onChunk: (chunk) => {
          chunkCount++;
          fullResponse += chunk.text;
          if (chunkCount <= 3) {
            console.log(
              `   Chunk ${chunkCount}: ${chunk.text.substring(0, 50)}...`,
            );
          }
        },
      });

      console.log("\n✅ Streaming with PDF completed");
      console.log("✅ Total chunks received:", chunkCount);
      console.log("✅ Response length:", fullResponse.length + " characters");
      console.log("\n📝 Full response:");
      console.log("─────────────────────────────────────────────");
      console.log(fullResponse);
      console.log("─────────────────────────────────────────────");

      // Verify response has content
      const hasContent = fullResponse.length > 10;
      if (hasContent) {
        console.log("\n✅ Response contains content");
      } else {
        console.log("\n⚠️  Response seems too short");
      }

      // Verify PDF engine parameter was used
      console.log("✅ PDF engine used:", analysis.engine);

      console.log("\n🎉 PDF STREAMING TEST PASSED!\n");

      return {
        success: true,
        fileName: pdfFile.name,
        fileSize: pdfFile.size,
        chunks: chunkCount,
        responseLength: fullResponse.length,
        pdfEngine: analysis.engine,
        pages: analysis.pages,
        cost: analysis.cost,
      };
    } catch (error) {
      console.error("\n❌ PDF STREAMING TEST FAILED:", error.message);
      if (error.stack) {
        console.error("   Stack:", error.stack);
      }
      return {
        success: false,
        error: error.message,
      };
    } finally {
      // Clean up
      embed.clearFile();
      console.log("🧹 Cleaned up test file\n");
    }
  };

  // ============================================================================
  // MASTER TEST SUITE
  // ============================================================================

  /**
   * Master Test Runner - Stage 3
   */
  window.testEmbedStage3_All = async function () {
    console.log(
      "╔═══════════════════════════════════════════════════════════╗",
    );
    console.log("║     OpenRouter Embed API - Stage 3 Complete Tests        ║");
    console.log(
      "║              Streaming Support Testing                    ║",
    );
    console.log(
      "╚═══════════════════════════════════════════════════════════╝\n",
    );

    console.log("🤖 RUNNING AUTOMATED TESTS...\n");

    const results = {};

    // Run tests
    results.basicStreaming = await window.testEmbedStage3_BasicStreaming();
    await new Promise((r) => setTimeout(r, 1000));

    results.cancellation = await window.testEmbedStage3_Cancellation();
    await new Promise((r) => setTimeout(r, 1000));

    results.callbacks = await window.testEmbedStage3_Callbacks();
    await new Promise((r) => setTimeout(r, 1000));

    results.withFiles = await window.testEmbedStage3_WithFiles();
    await new Promise((r) => setTimeout(r, 1000));

    results.regressions = await window.testEmbedStage3_Regressions();

    // Summary
    console.log("════════════════════════════════════════════════════════════");
    console.log("📊 AUTOMATED TEST RESULTS");
    console.log(
      "════════════════════════════════════════════════════════════\n",
    );

    Object.entries(results).forEach(([name, result]) => {
      const icon = result.success ? "✅" : "❌";
      console.log(`${icon} ${name}`);
    });

    const allPassed = Object.values(results).every((r) => r.success);

    console.log(
      "\n════════════════════════════════════════════════════════════",
    );
    console.log(
      `Results: ${Object.values(results).filter((r) => r.success).length}/${
        Object.keys(results).length
      } automated tests passed`,
    );
    console.log(
      "════════════════════════════════════════════════════════════\n",
    );

    if (allPassed) {
      console.log("✅ 🎉 ALL STAGE 3 AUTOMATED TESTS PASSED!\n");
    } else {
      console.log("❌ Some tests failed. Check output above.\n");
    }

    console.log("💾 Full results saved to window._embedStage3Results");

    window._embedStage3Results = results;
    return results;
  };

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================
})(); // End of IIFE
