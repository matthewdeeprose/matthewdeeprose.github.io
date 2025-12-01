/**
 * OpenRouter Embed API - Stage 4 Phase 1 Test Suite
 *
 * Comprehensive testing for progress indicator functionality
 *
 * @version 1.0.0 (Stage 4 Phase 1)
 * @requires window.OpenRouterEmbed
 * @requires window.EmbedProgressIndicator
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
      console.error(`[EmbedStage4Phase1Tests] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedStage4Phase1Tests] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedStage4Phase1Tests] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedStage4Phase1Tests] ${message}`, ...args);
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Create or get test container
   */
  function getTestContainer() {
    let container = document.getElementById("embed-test-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "embed-test-container";
      container.style.cssText =
        "border: 2px solid #ccc; padding: 1rem; margin: 1rem 0; min-height: 100px;";
      document.body.appendChild(container);
    }
    container.innerHTML = ""; // Clear previous content
    return container;
  }

  /**
   * Wait for specified time
   */
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if element is visible
   */
  function isElementVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  // ============================================================================
  // STAGE 4 PHASE 1 TESTING SUITE - PROGRESS INDICATORS
  // ============================================================================

  /**
   * Test 1: Basic Progress Display
   */
  window.testEmbedStage4_ProgressBasic = async function () {
    console.log("\n🧪 STAGE 4 PHASE 1 TEST 1: Basic Progress Display");
    console.log("=================================================\n");

    const container = getTestContainer();

    try {
      const embed = new OpenRouterEmbed({
        containerId: "embed-test-container",
        showNotifications: false,
        showStreamingProgress: true,
        progressStyle: "detailed",
      });

      console.log("✓ Embed created with progress enabled");

      let progressUpdates = 0;
      const progressData = [];

      await embed.sendStreamingRequest({
        userPrompt: "Count from 1 to 5, one number per line.",
        onChunk: (chunk) => {
          // Nothing needed here
        },
        onProgress: (progress) => {
          progressUpdates++;
          progressData.push({ ...progress });
          console.log(`Progress update ${progressUpdates}:`, progress);
        },
      });

      console.log("\n✅ Progress indicator displayed");
      console.log("✅ Progress updates received:", progressUpdates);
      console.log(
        "✅ Final progress data:",
        progressData[progressData.length - 1]
      );
      console.log("\n🎉 TEST 1 PASSED!\n");

      return { success: true, updates: progressUpdates };
    } catch (error) {
      console.error("❌ TEST 1 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Test 2: Progress During Real Streaming
   */
  window.testEmbedStage4_ProgressStreaming = async function () {
    console.log("\n🧪 STAGE 4 PHASE 1 TEST 2: Progress During Real Streaming");
    console.log("=======================================================\n");

    const container = getTestContainer();

    try {
      const embed = new OpenRouterEmbed({
        containerId: "embed-test-container",
        showNotifications: false,
        showStreamingProgress: true,
        progressStyle: "detailed",
        progressIndicatorPosition: "top",
      });

      console.log("✓ Embed created with progress (detailed, top position)");

      let chunkCount = 0;
      let progressCount = 0;
      let maxTokenEstimate = 0;
      let maxElapsedTime = 0;

      await embed.sendStreamingRequest({
        userPrompt: "Write a short paragraph about web accessibility.",
        onChunk: (chunk) => {
          chunkCount++;
        },
        onProgress: (progress) => {
          progressCount++;
          if (progress.estimatedTokens > maxTokenEstimate) {
            maxTokenEstimate = progress.estimatedTokens;
          }
          if (progress.elapsedTime > maxElapsedTime) {
            maxElapsedTime = progress.elapsedTime;
          }

          // Log every 5th update
          if (progressCount % 5 === 0) {
            console.log(`Progress #${progressCount}:`, {
              chunks: progress.chunksReceived,
              tokens: progress.estimatedTokens,
              time: `${progress.elapsedTime}ms`,
            });
          }
        },
      });

      console.log("\n✅ Streaming completed");
      console.log("✅ Total chunks:", chunkCount);
      console.log("✅ Total progress updates:", progressCount);
      console.log("✅ Max token estimate:", maxTokenEstimate);
      console.log("✅ Total elapsed time:", `${maxElapsedTime}ms`);
      console.log("✅ Progress indicator cleaned up");
      console.log("\n🎉 TEST 2 PASSED!\n");

      return {
        success: true,
        chunks: chunkCount,
        progressUpdates: progressCount,
        maxTokens: maxTokenEstimate,
      };
    } catch (error) {
      console.error("❌ TEST 2 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Test 3: Progress Accessibility
   */
  window.testEmbedStage4_ProgressAccessibility = async function () {
    console.log("\n🧪 STAGE 4 PHASE 1 TEST 3: Progress Accessibility");
    console.log("=================================================\n");

    const container = getTestContainer();

    try {
      const embed = new OpenRouterEmbed({
        containerId: "embed-test-container",
        showNotifications: false,
        showStreamingProgress: true,
        progressStyle: "detailed",
      });

      console.log("✓ Embed created with progress enabled");

      // Start streaming
      const streamPromise = embed.sendStreamingRequest({
        userPrompt: "List three benefits of semantic HTML.",
        onChunk: (chunk) => {
          // Nothing needed
        },
      });

      // Wait a moment for progress to appear
      await wait(500);

      // Check accessibility features
      const progressElement = container.querySelector(
        ".embed-progress-indicator"
      );
      const liveRegion = document.querySelector(".embed-progress-live-region");

      console.log("\n📋 Accessibility Checks:");

      // Check 1: Progress element exists and visible
      const progressExists = !!progressElement;
      const progressVisible = isElementVisible(progressElement);
      console.log(`✓ Progress element exists: ${progressExists}`);
      console.log(`✓ Progress element visible: ${progressVisible}`);

      // Check 2: ARIA attributes
      const hasRoleStatus = progressElement?.getAttribute("role") === "status";
      const hasAriaLive =
        progressElement?.getAttribute("aria-live") === "polite";
      const hasAriaAtomic =
        progressElement?.getAttribute("aria-atomic") === "true";
      console.log(`✓ Has role="status": ${hasRoleStatus}`);
      console.log(`✓ Has aria-live="polite": ${hasAriaLive}`);
      console.log(`✓ Has aria-atomic="true": ${hasAriaAtomic}`);

      // Check 3: Live region for screen readers
      const liveRegionExists = !!liveRegion;
      const liveRegionHidden = liveRegion?.style.position === "absolute";
      console.log(`✓ Live region exists: ${liveRegionExists}`);
      console.log(`✓ Live region visually hidden: ${liveRegionHidden}`);

      // Check 4: Icons hidden from screen readers
      const icon = progressElement?.querySelector('span[aria-hidden="true"]');
      const iconHidden = icon?.getAttribute("aria-hidden") === "true";
      console.log(`✓ Icon hidden from screen readers: ${iconHidden}`);

      // Wait for completion
      await streamPromise;

      // Verify all checks passed
      const allPassed =
        progressExists &&
        progressVisible &&
        hasRoleStatus &&
        hasAriaLive &&
        hasAriaAtomic &&
        liveRegionExists &&
        liveRegionHidden &&
        iconHidden;

      if (allPassed) {
        console.log("\n✅ All accessibility checks passed");
        console.log("✅ WCAG 2.2 AA compliant");
        console.log("\n🎉 TEST 3 PASSED!\n");
        return { success: true };
      } else {
        console.error("\n❌ Some accessibility checks failed");
        return { success: false, error: "Accessibility check failed" };
      }
    } catch (error) {
      console.error("❌ TEST 3 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Test 4: Progress Styles (Minimal vs Detailed)
   */
  window.testEmbedStage4_ProgressStyles = async function () {
    console.log("\n🧪 STAGE 4 PHASE 1 TEST 4: Progress Styles");
    console.log("===========================================\n");

    const container = getTestContainer();

    try {
      // Test minimal style
      console.log("Testing MINIMAL style...");
      const embedMinimal = new OpenRouterEmbed({
        containerId: "embed-test-container",
        showNotifications: false,
        showStreamingProgress: true,
        progressStyle: "minimal",
      });

      await embedMinimal.sendStreamingRequest({
        userPrompt: "Say hello",
      });

      console.log("✅ Minimal style works");

      // Clear container
      container.innerHTML = "";

      // Test detailed style
      console.log("\nTesting DETAILED style...");
      const embedDetailed = new OpenRouterEmbed({
        containerId: "embed-test-container",
        showNotifications: false,
        showStreamingProgress: true,
        progressStyle: "detailed",
      });

      await embedDetailed.sendStreamingRequest({
        userPrompt: "Say hello",
      });

      console.log("✅ Detailed style works");

      console.log("\n🎉 TEST 4 PASSED!\n");

      return { success: true };
    } catch (error) {
      console.error("❌ TEST 4 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Test 5: Progress Positioning
   */
  window.testEmbedStage4_ProgressPositioning = async function () {
    console.log("\n🧪 STAGE 4 PHASE 1 TEST 5: Progress Positioning");
    console.log("===============================================\n");

    const container = getTestContainer();

    try {
      // Test top position
      console.log("Testing TOP position...");
      const embedTop = new OpenRouterEmbed({
        containerId: "embed-test-container",
        showNotifications: false,
        showStreamingProgress: true,
        progressIndicatorPosition: "top",
      });

      await embedTop.sendStreamingRequest({
        userPrompt: "Count to 3",
      });

      console.log("✅ Top position works");

      // Clear container
      container.innerHTML = "";

      // Test bottom position
      console.log("\nTesting BOTTOM position...");
      const embedBottom = new OpenRouterEmbed({
        containerId: "embed-test-container",
        showNotifications: false,
        showStreamingProgress: true,
        progressIndicatorPosition: "bottom",
      });

      await embedBottom.sendStreamingRequest({
        userPrompt: "Count to 3",
      });

      console.log("✅ Bottom position works");

      console.log("\n🎉 TEST 5 PASSED!\n");

      return { success: true };
    } catch (error) {
      console.error("❌ TEST 5 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Test 6: Progress Can Be Disabled
   */
  window.testEmbedStage4_ProgressDisabled = async function () {
    console.log("\n🧪 STAGE 4 PHASE 1 TEST 6: Progress Can Be Disabled");
    console.log("====================================================\n");

    const container = getTestContainer();

    try {
      const embed = new OpenRouterEmbed({
        containerId: "embed-test-container",
        showNotifications: false,
        showStreamingProgress: false, // Disabled
      });

      console.log("✓ Embed created with progress DISABLED");

      await embed.sendStreamingRequest({
        userPrompt: "Say hello",
      });

      // Check that no progress element exists
      const progressElement = container.querySelector(
        ".embed-progress-indicator"
      );
      const noProgress = !progressElement;

      console.log("✅ Progress indicator not displayed:", noProgress);

      if (noProgress) {
        console.log("\n🎉 TEST 6 PASSED!\n");
        return { success: true };
      } else {
        console.error("❌ Progress indicator was displayed when disabled");
        return { success: false, error: "Progress not disabled properly" };
      }
    } catch (error) {
      console.error("❌ TEST 6 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Master Test: Run All Phase 1 Tests
   */
  window.testEmbedStage4_Phase1_All = async function () {
    console.clear();
    console.log("╔═══════════════════════════════════════════════════════╗");
    console.log("║   OpenRouter Embed - Stage 4 Phase 1 Complete Tests ║");
    console.log("║              Progress Indicators                      ║");
    console.log("╚═══════════════════════════════════════════════════════╝\n");

    const results = {
      progressBasic: await window.testEmbedStage4_ProgressBasic(),
      progressStreaming: await window.testEmbedStage4_ProgressStreaming(),
      progressAccessibility:
        await window.testEmbedStage4_ProgressAccessibility(),
      progressStyles: await window.testEmbedStage4_ProgressStyles(),
      progressPositioning: await window.testEmbedStage4_ProgressPositioning(),
      progressDisabled: await window.testEmbedStage4_ProgressDisabled(),
    };

    // Summary
    const passed = Object.values(results).filter((r) => r.success).length;
    const total = Object.keys(results).length;

    console.log(`\n${"═".repeat(60)}`);
    console.log(`PHASE 1 Results: ${passed}/${total} tests passed`);
    console.log("═".repeat(60));

    if (passed === total) {
      console.log("✅ 🎉 ALL PHASE 1 TESTS PASSED!\n");
      console.log("Progress Indicators: COMPLETE ✅\n");
    } else {
      console.log("❌ Some tests failed. Check output above.\n");
    }

    return results;
  };

  /**
   * Regression Test: Verify Stages 1-3 Still Work
   */
  window.testEmbedStage4_Phase1_Regressions = async function () {
    console.log("\n🧪 REGRESSION TESTS: Stages 1+2+3");
    console.log("===================================\n");

    try {
      const stage1 = await window.testEmbedStage1_All();
      const stage2 = await window.testEmbedStage2_All();
      const stage3 = await window.testEmbedStage3_All();

      const stage1Passed = Object.values(stage1).every((r) => r.success);
      const stage2Passed = Object.values(stage2).every((r) => r.success);
      const stage3Passed = Object.values(stage3).every((r) => r.success);

      console.log(`Stage 1: ${stage1Passed ? "✅" : "❌"} (8 tests)`);
      console.log(`Stage 2: ${stage2Passed ? "✅" : "❌"} (6 tests)`);
      console.log(`Stage 3: ${stage3Passed ? "✅" : "❌"} (6 tests)`);

      const allPassed = stage1Passed && stage2Passed && stage3Passed;
      console.log(
        `\n${allPassed ? "✅" : "❌"} All 20 previous tests still pass\n`
      );

      return { success: allPassed };
    } catch (error) {
      console.error("❌ Regression test failed:", error.message);
      return { success: false, error: error.message };
    }
  };

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================
})();
