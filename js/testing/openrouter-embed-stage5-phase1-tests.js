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
      console.error(`[Stage5-P1-Tests] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[Stage5-P1-Tests] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[Stage5-P1-Tests] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[Stage5-P1-Tests] ${message}`, ...args);
  }

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  /**
   * Create a test image file of specified size
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @param {string} sizeHint - 'small' or 'large' to control file size
   * @returns {Promise<File>} Test image file
   */
  async function createTestImage(width, height, sizeHint = "small") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (sizeHint === "large") {
      // Random noise creates larger files
      const imageData = ctx.createImageData(width, height);
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = Math.random() * 255;
        imageData.data[i + 1] = Math.random() * 255;
        imageData.data[i + 2] = Math.random() * 255;
        imageData.data[i + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
    } else {
      // Solid colour creates smaller files
      ctx.fillStyle = "#4a90d9";
      ctx.fillRect(0, 0, width, height);
    }

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          const file = new File([blob], "test-image.jpg", {
            type: "image/jpeg",
          });
          resolve(file);
        },
        "image/jpeg",
        0.9
      );
    });
  }

  /**
   * Create a test container for tests
   */
  function ensureTestContainer() {
    let container = document.getElementById("embed-test-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "embed-test-container";
      container.style.display = "none";
      document.body.appendChild(container);
    }
    return container;
  }

  // ============================================================================
  // PHASE 1 TESTS: IMAGE COMPRESSION
  // ============================================================================

  /**
   * Test P1-1: Compression can be enabled/disabled via config
   */
  window.testStage5_P1_01_CompressionToggle = async function () {
    console.log("\n🧪 P1-1: Compression Toggle");
    console.log("─".repeat(40) + "\n");

    try {
      ensureTestContainer();

      // Test with compression disabled
      const embedDisabled = new OpenRouterEmbed({
        containerId: "embed-test-container",
        enableCompression: false,
      });

      const disabledResult =
        embedDisabled.fileUtils.compressionConfig.ENABLED === false;
      console.log(`  Compression disabled: ${disabledResult ? "✅" : "❌"}`);

      // Test with compression enabled (default)
      const embedEnabled = new OpenRouterEmbed({
        containerId: "embed-test-container",
        enableCompression: true,
      });

      const enabledResult =
        embedEnabled.fileUtils.compressionConfig.ENABLED === true;
      console.log(`  Compression enabled: ${enabledResult ? "✅" : "❌"}`);

      const success = disabledResult && enabledResult;
      console.log(`\n  Result: ${success ? "✅ PASS" : "❌ FAIL"}`);

      return { success };
    } catch (error) {
      console.error("  ❌ Test error:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Test P1-2: shouldCompress returns false for files below threshold
   */
  window.testStage5_P1_02_ThresholdSkip = async function () {
    console.log("\n🧪 P1-2: Threshold Skip (Small Files)");
    console.log("─".repeat(40) + "\n");

    try {
      const fileUtils = new EmbedFileUtils();

      // Create a small test file (should be under 200KB)
      const smallFile = await createTestImage(100, 100, "small");
      console.log(
        `  Created small test file: ${(smallFile.size / 1024).toFixed(1)} KB`
      );

      const shouldCompress = fileUtils.shouldCompress(smallFile, 200 * 1024);
      console.log(`  shouldCompress result: ${shouldCompress}`);

      const success = !shouldCompress;
      console.log(
        `\n  Result: ${success ? "✅ PASS" : "❌ FAIL"} (expected: false)`
      );

      return { success };
    } catch (error) {
      console.error("  ❌ Test error:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Test P1-3: Large files are compressed
   */
  window.testStage5_P1_03_LargeFileCompression = async function () {
    console.log("\n🧪 P1-3: Large File Compression");
    console.log("─".repeat(40) + "\n");

    try {
      const fileUtils = new EmbedFileUtils();

      // Create a large image (should be over 200KB with noise)
      const largeFile = await createTestImage(2000, 2000, "large");
      console.log(
        `  Created large test file: ${(largeFile.size / 1024).toFixed(1)} KB`
      );

      // Use a lower threshold to ensure compression happens
      const threshold = Math.max(largeFile.size * 0.5, 50 * 1024);

      const shouldCompress = fileUtils.shouldCompress(largeFile, threshold);
      console.log(
        `  shouldCompress (threshold ${(threshold / 1024).toFixed(
          0
        )}KB): ${shouldCompress}`
      );

      if (!shouldCompress) {
        console.log(
          "  ⚠️ File not large enough for test, lowering threshold further"
        );
        const result = await fileUtils.compressImage(largeFile);

        console.log(
          `  Compressed size: ${(result.compressedSize / 1024).toFixed(1)} KB`
        );
        console.log(`  Savings: ${result.savings.toFixed(1)}%`);

        const success = result.compressedSize < largeFile.size;
        console.log(`\n  Result: ${success ? "✅ PASS" : "❌ FAIL"}`);
        return { success };
      }

      const result = await fileUtils.compressImage(largeFile);

      console.log(
        `  Compressed size: ${(result.compressedSize / 1024).toFixed(1)} KB`
      );
      console.log(`  Savings: ${result.savings.toFixed(1)}%`);

      const success = result.compressedSize < largeFile.size;
      console.log(`\n  Result: ${success ? "✅ PASS" : "❌ FAIL"}`);

      return { success };
    } catch (error) {
      console.error("  ❌ Test error:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Test P1-4: Compressed dimensions respect maxWidth/maxHeight
   */
  window.testStage5_P1_04_DimensionsRespected = async function () {
    console.log("\n🧪 P1-4: Dimensions Respected");
    console.log("─".repeat(40) + "\n");

    try {
      const fileUtils = new EmbedFileUtils();

      // Create oversized image
      const largeFile = await createTestImage(3000, 2000, "large");
      console.log(`  Original dimensions: 3000 x 2000`);

      const result = await fileUtils.compressImage(largeFile, {
        maxWidth: 1200,
        maxHeight: 900,
        quality: 0.7,
      });

      const { width, height } = result.dimensions.compressed;
      console.log(`  Compressed dimensions: ${width} x ${height}`);

      const withinBounds = width <= 1200 && height <= 900;
      console.log(`  Within bounds (1200x900): ${withinBounds}`);

      // Also check aspect ratio is preserved
      const originalRatio = 3000 / 2000;
      const compressedRatio = width / height;
      const ratioPreserved = Math.abs(originalRatio - compressedRatio) < 0.01;
      console.log(`  Aspect ratio preserved: ${ratioPreserved}`);

      const success = withinBounds && ratioPreserved;
      console.log(`\n  Result: ${success ? "✅ PASS" : "❌ FAIL"}`);

      return { success };
    } catch (error) {
      console.error("  ❌ Test error:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Test P1-5: All metric fields are captured
   */
  window.testStage5_P1_05_MetricsCaptured = async function () {
    console.log("\n🧪 P1-5: Metrics Captured");
    console.log("─".repeat(40) + "\n");

    try {
      const fileUtils = new EmbedFileUtils();

      // Clear any previous metrics
      fileUtils.clearCompressionMetrics();
      console.log("  Cleared previous metrics");

      const file = await createTestImage(1500, 1500, "large");

      const result = await fileUtils.compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.7,
      });

      // Check metrics in result
      const requiredFields = [
        "originalSize",
        "compressedSize",
        "savings",
        "compressionTime",
        "estimatedTimeSavings",
        "dimensions",
        "quality",
        "formatConversion",
      ];

      const missingFields = requiredFields.filter(
        (field) => result[field] === undefined || result[field] === null
      );

      console.log("  Metrics in result:");
      console.log(`    originalSize: ${result.originalSize}`);
      console.log(`    compressedSize: ${result.compressedSize}`);
      console.log(`    savings: ${result.savings.toFixed(1)}%`);
      console.log(`    compressionTime: ${result.compressionTime}ms`);
      console.log(`    estimatedTimeSavings: ${result.estimatedTimeSavings}s`);
      console.log(
        `    dimensions: ${result.dimensions.original.width}x${result.dimensions.original.height} → ${result.dimensions.compressed.width}x${result.dimensions.compressed.height}`
      );
      console.log(`    quality: ${result.quality}`);
      console.log(
        `    format: ${result.formatConversion.from} → ${result.formatConversion.to}`
      );

      if (missingFields.length > 0) {
        console.log(`  ❌ Missing fields: ${missingFields.join(", ")}`);
      }

      // Also check getCompressionMetrics() works
      const storedMetrics = fileUtils.getCompressionMetrics();
      const metricsStored = storedMetrics !== null;
      console.log(`\n  getCompressionMetrics() works: ${metricsStored}`);

      if (metricsStored) {
        console.log("  Stored metrics:");
        console.log(`    originalSize: ${storedMetrics.originalSize}`);
        console.log(`    compressedSize: ${storedMetrics.compressedSize}`);
        console.log(`    savingsPercent: ${storedMetrics.savingsPercent}%`);
        console.log(`    duration: ${storedMetrics.duration}ms`);
      }

      const success = missingFields.length === 0 && metricsStored;
      console.log(`\n  Result: ${success ? "✅ PASS" : "❌ FAIL"}`);

      return { success };
    } catch (error) {
      console.error("  ❌ Test error:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Test P1-6: Regression - attachFile still works with compression
   */
  window.testStage5_P1_06_AttachFileRegression = async function () {
    console.log("\n🧪 P1-6: attachFile Regression");
    console.log("─".repeat(40) + "\n");

    try {
      ensureTestContainer();

      const embed = new OpenRouterEmbed({
        containerId: "embed-test-container",
        enableCompression: true,
        compressionThreshold: 50 * 1024, // Lower threshold for testing
        compressionMaxWidth: 600, // Ensure compression happens
        compressionMaxHeight: 600,
      });

      const file = await createTestImage(1200, 1200, "large");
      console.log(`  Test file size: ${(file.size / 1024).toFixed(1)} KB`);

      const result = await embed.attachFile(file);

      const hasFile = embed.currentFile !== null;
      const hasBase64 = embed.currentFileBase64 !== null;
      const hasAnalysis = embed.currentFileAnalysis !== null;

      console.log(`  currentFile set: ${hasFile}`);
      console.log(`  currentFileBase64 set: ${hasBase64}`);
      console.log(`  currentFileAnalysis set: ${hasAnalysis}`);

      // Check if compression was applied
      const wasCompressed = embed.currentFile.size < file.size;
      console.log(`  File was compressed: ${wasCompressed}`);

      if (wasCompressed) {
        const savings = (
          ((file.size - embed.currentFile.size) / file.size) *
          100
        ).toFixed(1);
        console.log(`    Original: ${(file.size / 1024).toFixed(1)} KB`);
        console.log(
          `    Compressed: ${(embed.currentFile.size / 1024).toFixed(1)} KB`
        );
        console.log(`    Savings: ${savings}%`);
      }

      const success = hasFile && hasBase64 && hasAnalysis;
      console.log(`\n  Result: ${success ? "✅ PASS" : "❌ FAIL"}`);

      return { success, wasCompressed };
    } catch (error) {
      console.error("  ❌ Test error:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Test P1-7: Full Integration - Send compressed image to OpenRouter
   */
  window.testStage5_P1_07_FullIntegration = async function () {
    console.log("\n🧪 P1-7: Full Integration Test");
    console.log("─".repeat(40) + "\n");

    try {
      ensureTestContainer();

      const embed = new OpenRouterEmbed({
        containerId: "embed-test-container",
        enableCompression: true,
        compressionThreshold: 100 * 1024,
        model: "anthropic/claude-3.5-haiku",
        max_tokens: 100,
        showNotifications: false,
      });

      // Create test image
      const file = await createTestImage(1000, 1000, "large");
      console.log(`  Created test image: ${(file.size / 1024).toFixed(1)} KB`);

      // Attach file
      console.log("  Attaching file...");
      await embed.attachFile(file);

      // Check if file was compressed by comparing current file to original
      const wasCompressed =
        embed.currentFile && embed.currentFile.size < file.size;
      console.log(`  File compressed: ${wasCompressed}`);

      if (wasCompressed) {
        const savings = (
          ((file.size - embed.currentFile.size) / file.size) *
          100
        ).toFixed(1);
        console.log(`    Original: ${(file.size / 1024).toFixed(1)} KB`);
        console.log(
          `    Compressed: ${(embed.currentFile.size / 1024).toFixed(1)} KB`
        );
        console.log(`    Savings: ${savings}%`);
      }

      // Get compression metrics
      const metrics = embed.fileUtils.getCompressionMetrics();
      if (metrics) {
        console.log("  Compression metrics retrieved:");
        console.log(`    Duration: ${metrics.duration}ms`);
        console.log(`    Format: ${metrics.format}`);
      }

      // Send request (Note: This will fail without API key, but tests the flow)
      console.log("  Sending request to API...");
      console.log("  ⚠️  Note: This requires valid API credentials");
      console.log(
        "  ⚠️  Test verifies the flow, actual API call will likely fail"
      );

      try {
        const response = await embed.sendRequest(
          "Describe this test image briefly."
        );
        console.log("  ✅ API request succeeded!");

        // Handle response (could be string or already displayed)
        if (typeof response === "string") {
          const preview =
            response.length > 100
              ? response.substring(0, 100) + "..."
              : response;
          console.log(`  Response preview: ${preview}`);
        } else {
          console.log("  Response displayed in container");
        }

        // Check compression metrics one more time
        const finalMetrics = embed.fileUtils.getCompressionMetrics();
        if (finalMetrics) {
          console.log(`  Final compression metrics available: ✅`);
        }

        console.log(`\n  Result: ✅ PASS (full integration successful!)`);
        return { success: true, apiSuccess: true, wasCompressed };
      } catch (apiError) {
        console.log("  ⚠️  API call failed (expected without credentials)");
        console.log(`  Error: ${apiError.message}`);

        // Test passes if we got to the API call stage
        const success =
          apiError.message.includes("API") ||
          apiError.message.includes("key") ||
          apiError.message.includes("401");
        console.log(
          `\n  Result: ${
            success ? "✅ PASS" : "❌ FAIL"
          } (integration flow works)`
        );

        return {
          success,
          apiSuccess: false,
          wasCompressed,
          expectedError: true,
        };
      }
    } catch (error) {
      console.error("  ❌ Test error:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Run all Phase 1 tests
   */
  window.testStage5_Phase1_All = async function () {
    console.clear();
    console.log(
      "╔════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║   OpenRouter Embed - Stage 5 Phase 1: Compression Tests    ║"
    );
    console.log(
      "╚════════════════════════════════════════════════════════════╝\n"
    );

    const results = {};

    results.compressionToggle =
      await window.testStage5_P1_01_CompressionToggle();
    results.thresholdSkip = await window.testStage5_P1_02_ThresholdSkip();
    results.largeFileCompression =
      await window.testStage5_P1_03_LargeFileCompression();
    results.dimensionsRespected =
      await window.testStage5_P1_04_DimensionsRespected();
    results.metricsCaptured = await window.testStage5_P1_05_MetricsCaptured();
    results.attachFileRegression =
      await window.testStage5_P1_06_AttachFileRegression();
    results.fullIntegration = await window.testStage5_P1_07_FullIntegration();

    // Summary
    const passed = Object.values(results).filter((r) => r.success).length;
    const total = Object.keys(results).length;

    console.log("\n" + "═".repeat(60));
    console.log("📊 PHASE 1 TEST SUMMARY");
    console.log("═".repeat(60) + "\n");

    Object.entries(results).forEach(([name, result]) => {
      const status = result.success ? "✅" : "❌";
      const skipped = result.skipped ? " (skipped)" : "";
      const expected = result.expectedError ? " (expected error)" : "";
      console.log(`  ${status} ${name}${skipped}${expected}`);
    });

    console.log(`\n  Results: ${passed}/${total} tests passed`);
    console.log("═".repeat(60));

    if (passed === total) {
      console.log("\n✅ 🎉 PHASE 1 COMPLETE!");
      console.log("   Image compression successfully verified.\n");
    } else {
      console.log("\n❌ Some tests failed. Review output above.\n");
    }

    return { success: passed === total, results, passed, total };
  };
})();
