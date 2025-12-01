/**
 * OpenRouter Embed API - Phase 4 Combined Test Runner
 *
 * Runs all Phase 4 tests:
 * - Feature 2: EmbedPromptLoader (12 tests)
 * - Feature 3: Clipboard Paste Helper (10 tests)
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

  function shouldLog(level) {
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[Phase4 Runner INFO] ${message}`, ...args);
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[Phase4 Runner ERROR] ${message}`, ...args);
  }

  // ============================================================================
  // COMBINED TEST RUNNER
  // ============================================================================

  /**
   * Run all Phase 4 tests (Features 2 and 3)
   */
  async function runAllPhase4Tests() {
    console.log("\n" + "═".repeat(70));
    console.log("    STAGE 5 PHASE 4: COMPLETE TEST SUITE");
    console.log("═".repeat(70));

    const allResults = {
      feature2: null,
      feature3: null,
      totalPassed: 0,
      totalFailed: 0,
      totalTests: 0,
    };

    // Check for Feature 2 tests (EmbedPromptLoader)
    console.log("\n" + "─".repeat(70));
    console.log("    FEATURE 2: EmbedPromptLoader Tests");
    console.log("─".repeat(70));

    if (typeof window.runAllPhase4LoaderTests === "function") {
      try {
        allResults.feature2 = await window.runAllPhase4LoaderTests();
        allResults.totalPassed += allResults.feature2.passed;
        allResults.totalFailed += allResults.feature2.failed;
        allResults.totalTests += allResults.feature2.total;
      } catch (error) {
        logError("Feature 2 tests failed:", error.message);
        allResults.feature2 = { error: error.message };
      }
    } else {
      console.log(
        "⚠️ Feature 2 tests not loaded. Include openrouter-embed-prompt-loader-tests.js"
      );
    }

    // Check for Feature 3 tests (Clipboard Paste Helper)
    console.log("\n" + "─".repeat(70));
    console.log("    FEATURE 3: Clipboard Paste Helper Tests");
    console.log("─".repeat(70));

    if (typeof window.runAllPhase4ClipboardTests === "function") {
      try {
        allResults.feature3 = await window.runAllPhase4ClipboardTests();
        allResults.totalPassed += allResults.feature3.passed;
        allResults.totalFailed += allResults.feature3.failed;
        allResults.totalTests += allResults.feature3.total;
      } catch (error) {
        logError("Feature 3 tests failed:", error.message);
        allResults.feature3 = { error: error.message };
      }
    } else {
      console.log(
        "⚠️ Feature 3 tests not loaded. Include openrouter-embed-clipboard-tests.js"
      );
    }

    // Final Summary
    console.log("\n" + "═".repeat(70));
    console.log("    PHASE 4 COMPLETE SUMMARY");
    console.log("═".repeat(70));

    console.log("\nFeature Breakdown:");
    console.log("─".repeat(40));

    if (allResults.feature2 && !allResults.feature2.error) {
      const f2Status = allResults.feature2.allPassed ? "✅" : "❌";
      console.log(
        `  Feature 2 (EmbedPromptLoader):    ${f2Status} ${allResults.feature2.passed}/${allResults.feature2.total}`
      );
    } else {
      console.log(
        `  Feature 2 (EmbedPromptLoader):    ⚠️ ${
          allResults.feature2?.error || "Not loaded"
        }`
      );
    }

    if (allResults.feature3 && !allResults.feature3.error) {
      const f3Status = allResults.feature3.allPassed ? "✅" : "❌";
      console.log(
        `  Feature 3 (Clipboard Paste):      ${f3Status} ${allResults.feature3.passed}/${allResults.feature3.total}`
      );
    } else {
      console.log(
        `  Feature 3 (Clipboard Paste):      ⚠️ ${
          allResults.feature3?.error || "Not loaded"
        }`
      );
    }

    console.log("─".repeat(40));
    console.log(
      `  TOTAL:                            ${allResults.totalPassed}/${allResults.totalTests}`
    );

    // Overall status
    console.log("\n" + "═".repeat(70));
    if (allResults.totalFailed === 0 && allResults.totalTests > 0) {
      console.log("    🎉 ALL PHASE 4 TESTS PASSED!");
    } else if (allResults.totalTests === 0) {
      console.log("    ⚠️ NO TESTS WERE RUN - Check test file loading");
    } else {
      console.log(
        `    ❌ ${allResults.totalFailed} TEST(S) FAILED - Review results above`
      );
    }
    console.log("═".repeat(70) + "\n");

    // Store results globally for debugging
    window._phase4TestResults = allResults;
    logInfo("Results saved to window._phase4TestResults");

    return allResults;
  }

  /**
   * Quick check to verify test files are loaded
   */
  function checkPhase4TestsLoaded() {
    console.log("\n" + "─".repeat(50));
    console.log("Phase 4 Test File Status:");
    console.log("─".repeat(50));

    const feature2Loaded = typeof window.runAllPhase4LoaderTests === "function";
    const feature3Loaded =
      typeof window.runAllPhase4ClipboardTests === "function";

    console.log(
      `  Feature 2 (EmbedPromptLoader): ${
        feature2Loaded ? "✅ Loaded" : "❌ Not loaded"
      }`
    );
    console.log(
      `  Feature 3 (Clipboard Paste):   ${
        feature3Loaded ? "✅ Loaded" : "❌ Not loaded"
      }`
    );
    console.log("─".repeat(50));

    if (!feature2Loaded || !feature3Loaded) {
      console.log("\n⚠️ Missing test files. Include:");
      if (!feature2Loaded)
        console.log("  - openrouter-embed-prompt-loader-tests.js");
      if (!feature3Loaded)
        console.log("  - openrouter-embed-clipboard-tests.js");
    }

    return {
      feature2: feature2Loaded,
      feature3: feature3Loaded,
      allLoaded: feature2Loaded && feature3Loaded,
    };
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.runAllPhase4Tests = runAllPhase4Tests;
  window.checkPhase4TestsLoaded = checkPhase4TestsLoaded;
})();
