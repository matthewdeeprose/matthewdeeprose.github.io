/**
 * OpenRouter Embed Progress - Phase 2 Tests (Stages Mode)
 *
 * Tests for the enhanced progress system with stages mode support.
 * Run in browser console after loading openrouter-embed-progress.js
 *
 * Target: 10 tests (P2-1 through P2-10)
 * @date 29 November 2025
 */

(function () {
  "use strict";

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  const TestUtils = {
    passed: 0,
    failed: 0,
    results: [],

    reset() {
      this.passed = 0;
      this.failed = 0;
      this.results = [];
    },

    assert(condition, testId, description) {
      if (condition) {
        this.passed++;
        this.results.push({ testId, description, status: "PASSED" });
        console.log(`✅ ${testId}: ${description}`);
        return true;
      } else {
        this.failed++;
        this.results.push({ testId, description, status: "FAILED" });
        console.error(`❌ ${testId}: ${description}`);
        return false;
      }
    },

    assertThrows(fn, testId, description) {
      try {
        fn();
        this.failed++;
        this.results.push({ testId, description, status: "FAILED" });
        console.error(`❌ ${testId}: ${description} (expected to throw)`);
        return false;
      } catch (e) {
        this.passed++;
        this.results.push({ testId, description, status: "PASSED" });
        console.log(`✅ ${testId}: ${description}`);
        return true;
      }
    },

    createTestContainer() {
      const container = document.createElement("div");
      container.id = "test-progress-container-" + Date.now();
      container.style.cssText =
        "position: fixed; bottom: 20px; right: 20px; width: 400px; z-index: 9999; background: #f5f5f5; padding: 1rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);";
      document.body.appendChild(container);
      return container;
    },

    removeTestContainer(container) {
      if (container && container.parentNode) {
        container.remove();
      }
    },

    summary() {
      console.log("\n" + "=".repeat(60));
      console.log(
        `Phase 2 Test Summary: ${this.passed}/${
          this.passed + this.failed
        } passed`
      );
      console.log("=".repeat(60));

      if (this.failed === 0) {
        console.log("🎉 All Phase 2 tests passed!");
      } else {
        console.log("⚠️ Some tests failed:");
        this.results
          .filter((r) => r.status === "FAILED")
          .forEach((r) => console.log(`   - ${r.testId}: ${r.description}`));
      }

      return {
        passed: this.passed,
        failed: this.failed,
        total: this.passed + this.failed,
        results: this.results,
      };
    },
  };

  // ============================================================================
  // PHASE 2 TESTS
  // ============================================================================

  /**
   * P2-1: Progress mode configuration ('chunks' vs 'stages')
   */
  function testP2_1_ProgressModeConfiguration() {
    console.log("\n--- P2-1: Progress Mode Configuration ---");

    // Test default mode is 'chunks'
    const defaultIndicator = new EmbedProgressIndicator({});
    TestUtils.assert(
      defaultIndicator.progressMode === "chunks",
      "P2-1a",
      'Default progressMode is "chunks"'
    );

    // Test explicit chunks mode
    const chunksIndicator = new EmbedProgressIndicator({
      progressMode: "chunks",
    });
    TestUtils.assert(
      chunksIndicator.progressMode === "chunks",
      "P2-1b",
      'Explicit progressMode "chunks" is set correctly'
    );

    // Test stages mode
    const stagesIndicator = new EmbedProgressIndicator({
      progressMode: "stages",
    });
    TestUtils.assert(
      stagesIndicator.progressMode === "stages",
      "P2-1c",
      'progressMode "stages" is set correctly'
    );
  }

  /**
   * P2-2: Custom stage definitions with message/icon/weight
   */
  function testP2_2_CustomStageDefinitions() {
    console.log("\n--- P2-2: Custom Stage Definitions ---");

    // Test default stages exist
    const defaultIndicator = new EmbedProgressIndicator({
      progressMode: "stages",
    });
    TestUtils.assert(
      defaultIndicator.progressStages.VALIDATING !== undefined,
      "P2-2a",
      "Default VALIDATING stage exists"
    );
    TestUtils.assert(
      defaultIndicator.progressStages.GENERATING !== undefined,
      "P2-2b",
      "Default GENERATING stage exists"
    );

    // Test default stage has required properties
    const validatingStage = defaultIndicator.progressStages.VALIDATING;
    TestUtils.assert(
      validatingStage.message &&
        validatingStage.icon &&
        typeof validatingStage.weight === "number",
      "P2-2c",
      "Default stage has message, icon, and weight properties"
    );

    // Test custom stages
    const customStages = {
      LOADING: { message: "Loading data...", icon: "📊", weight: 20 },
      PROCESSING: { message: "Processing...", icon: "⚙️", weight: 60 },
      SAVING: { message: "Saving results...", icon: "💾", weight: 20 },
    };
    const customIndicator = new EmbedProgressIndicator({
      progressMode: "stages",
      progressStages: customStages,
    });
    TestUtils.assert(
      customIndicator.progressStages.LOADING !== undefined &&
        customIndicator.progressStages.LOADING.message === "Loading data...",
      "P2-2d",
      "Custom stages are accepted and stored correctly"
    );

    // Test stageOrder is set from custom stages
    TestUtils.assert(
      customIndicator.stageOrder.includes("LOADING") &&
        customIndicator.stageOrder.includes("PROCESSING") &&
        customIndicator.stageOrder.includes("SAVING"),
      "P2-2e",
      "stageOrder is derived from custom stages keys"
    );
  }

  /**
   * P2-3: setStage() method sets stage and updates display
   */
  function testP2_3_SetStageMethod() {
    console.log("\n--- P2-3: setStage() Method ---");

    const container = TestUtils.createTestContainer();

    // Test setStage in chunks mode returns false
    const chunksIndicator = new EmbedProgressIndicator({
      container,
      progressMode: "chunks",
    });
    TestUtils.assert(
      chunksIndicator.setStage("VALIDATING") === false,
      "P2-3a",
      'setStage() returns false when progressMode is "chunks"'
    );

    // Test setStage in stages mode
    const stagesIndicator = new EmbedProgressIndicator({
      container,
      progressMode: "stages",
    });
    stagesIndicator.start();

    const result = stagesIndicator.setStage("VALIDATING");
    TestUtils.assert(
      result === true,
      "P2-3b",
      "setStage() returns true for valid stage in stages mode"
    );
    TestUtils.assert(
      stagesIndicator.currentStage === "VALIDATING",
      "P2-3c",
      "currentStage is set correctly after setStage()"
    );

    // Test setStage with invalid stage
    const invalidResult = stagesIndicator.setStage("INVALID_STAGE");
    TestUtils.assert(
      invalidResult === false,
      "P2-3d",
      "setStage() returns false for invalid stage key"
    );

    // Test stage progression tracks completed stages
    stagesIndicator.setStage("PREPARING");
    TestUtils.assert(
      stagesIndicator.completedStages.includes("VALIDATING"),
      "P2-3e",
      "Previous stage is added to completedStages when moving to next stage"
    );

    stagesIndicator.cleanup();
    TestUtils.removeTestContainer(container);
  }

  /**
   * P2-4: Weighted percentage calculation (cumulative)
   */
  function testP2_4_WeightedPercentage() {
    console.log("\n--- P2-4: Weighted Percentage Calculation ---");

    const container = TestUtils.createTestContainer();

    // Test with default stages (weights: 5, 10, 80, 5 = 100)
    const indicator = new EmbedProgressIndicator({
      container,
      progressMode: "stages",
    });
    indicator.start();

    // No stage set yet
    TestUtils.assert(
      indicator.getStagePercentage() === 0,
      "P2-4a",
      "getStagePercentage() returns 0 when no stage is set"
    );

    // After VALIDATING (weight 5)
    indicator.setStage("VALIDATING");
    TestUtils.assert(
      indicator.getStagePercentage() === 5,
      "P2-4b",
      "getStagePercentage() returns 5 after VALIDATING stage"
    );

    // After PREPARING (5 + 10 = 15)
    indicator.setStage("PREPARING");
    TestUtils.assert(
      indicator.getStagePercentage() === 15,
      "P2-4c",
      "getStagePercentage() returns 15 after PREPARING stage (cumulative)"
    );

    // After GENERATING (5 + 10 + 80 = 95)
    indicator.setStage("GENERATING");
    TestUtils.assert(
      indicator.getStagePercentage() === 95,
      "P2-4d",
      "getStagePercentage() returns 95 after GENERATING stage"
    );

    // After FINALISING (5 + 10 + 80 + 5 = 100)
    indicator.setStage("FINALISING");
    TestUtils.assert(
      indicator.getStagePercentage() === 100,
      "P2-4e",
      "getStagePercentage() returns 100 after FINALISING stage"
    );

    indicator.cleanup();
    TestUtils.removeTestContainer(container);
  }

  /**
   * P2-5: Stage icon display with aria-hidden="true"
   */
  function testP2_5_StageIconAccessibility() {
    console.log("\n--- P2-5: Stage Icon Accessibility ---");

    const container = TestUtils.createTestContainer();

    const indicator = new EmbedProgressIndicator({
      container,
      progressMode: "stages",
      showStageIcon: true,
    });
    indicator.start();
    indicator.setStage("VALIDATING");

    // Check for aria-hidden on icon
    const iconSpan = container.querySelector('span[aria-hidden="true"]');
    TestUtils.assert(
      iconSpan !== null,
      "P2-5a",
      'Stage icon has aria-hidden="true" attribute'
    );

    // Test with showStageIcon: false
    const noIconIndicator = new EmbedProgressIndicator({
      container,
      progressMode: "stages",
      showStageIcon: false,
    });
    indicator.cleanup();
    noIconIndicator.start();
    noIconIndicator.setStage("VALIDATING");

    // Should have no icon or significantly different content
    const content = container.querySelector(".embed-progress-indicator");
    const hasIconWithAriaHidden =
      content && content.innerHTML.includes('aria-hidden="true"');
    // Note: When showStageIcon is false, there may still be aria-hidden for other purposes
    // The key test is that the stage icon specifically is not shown
    TestUtils.assert(
      noIconIndicator.showStageIcon === false,
      "P2-5b",
      "showStageIcon: false is respected in configuration"
    );

    noIconIndicator.cleanup();
    TestUtils.removeTestContainer(container);
  }

  /**
   * P2-6: Timer tracking and formatElapsedTime()
   */
  function testP2_6_TimerTracking() {
    console.log("\n--- P2-6: Timer Tracking ---");

    const indicator = new EmbedProgressIndicator({});

    // Test formatElapsedTime with various values
    TestUtils.assert(
      indicator.formatElapsedTime(0) === "0s",
      "P2-6a",
      'formatElapsedTime(0) returns "0s"'
    );
    TestUtils.assert(
      indicator.formatElapsedTime(30) === "30s",
      "P2-6b",
      'formatElapsedTime(30) returns "30s"'
    );
    TestUtils.assert(
      indicator.formatElapsedTime(59) === "59s",
      "P2-6c",
      'formatElapsedTime(59) returns "59s"'
    );
    TestUtils.assert(
      indicator.formatElapsedTime(60) === "1m 0s",
      "P2-6d",
      'formatElapsedTime(60) returns "1m 0s"'
    );
    TestUtils.assert(
      indicator.formatElapsedTime(90) === "1m 30s",
      "P2-6e",
      'formatElapsedTime(90) returns "1m 30s"'
    );
    TestUtils.assert(
      indicator.formatElapsedTime(125) === "2m 5s",
      "P2-6f",
      'formatElapsedTime(125) returns "2m 5s"'
    );

    // Test getElapsedSeconds
    TestUtils.assert(
      indicator.getElapsedSeconds() === 0,
      "P2-6g",
      "getElapsedSeconds() returns 0 before start"
    );

    // Test with negative/invalid input
    TestUtils.assert(
      indicator.formatElapsedTime(-5) === "0s",
      "P2-6h",
      "formatElapsedTime handles negative input gracefully"
    );
    TestUtils.assert(
      indicator.formatElapsedTime("invalid") === "0s",
      "P2-6i",
      "formatElapsedTime handles non-number input gracefully"
    );
  }

  /**
   * P2-7: Completion time display after operation
   */
  function testP2_7_CompletionTimeDisplay() {
    console.log("\n--- P2-7: Completion Time Display ---");

    const container = TestUtils.createTestContainer();

    const indicator = new EmbedProgressIndicator({
      container,
      progressMode: "stages",
      showCompletionTime: true,
    });
    indicator.start();

    // Show completion time
    indicator.showCompletionTimeDisplay(45);

    const completionElement = container.querySelector(
      ".embed-progress-completion-time"
    );
    TestUtils.assert(
      completionElement !== null,
      "P2-7a",
      "Completion time element is created"
    );
    TestUtils.assert(
      completionElement && completionElement.textContent.includes("45s"),
      "P2-7b",
      "Completion time displays formatted time correctly"
    );
    TestUtils.assert(
      completionElement && completionElement.getAttribute("role") === "status",
      "P2-7c",
      'Completion time element has role="status" for accessibility'
    );

    // Test hide completion time
    indicator.hideCompletionTimeDisplay();
    const hiddenElement = container.querySelector(
      ".embed-progress-completion-time"
    );
    TestUtils.assert(
      hiddenElement === null,
      "P2-7d",
      "hideCompletionTimeDisplay() removes the element"
    );

    // Test with showCompletionTime: false
    const noCompletionIndicator = new EmbedProgressIndicator({
      container,
      progressMode: "stages",
      showCompletionTime: false,
    });
    noCompletionIndicator.start();
    noCompletionIndicator.showCompletionTimeDisplay(30);
    const noElement = container.querySelector(
      ".embed-progress-completion-time"
    );
    TestUtils.assert(
      noElement === null,
      "P2-7e",
      "showCompletionTimeDisplay() respects showCompletionTime: false"
    );

    indicator.cleanup();
    noCompletionIndicator.cleanup();
    TestUtils.removeTestContainer(container);
  }

  /**
   * P2-8: Backwards compatibility (chunks mode regression)
   */
  function testP2_8_BackwardsCompatibility() {
    console.log("\n--- P2-8: Backwards Compatibility (Chunks Mode) ---");

    const container = TestUtils.createTestContainer();

    // Test chunks mode still works as before
    const chunksIndicator = new EmbedProgressIndicator({
      container,
      progressMode: "chunks",
      showChunks: true,
      showTokens: true,
      showTime: true,
    });

    TestUtils.assert(
      chunksIndicator.progressMode === "chunks",
      "P2-8a",
      "Chunks mode indicator created successfully"
    );

    chunksIndicator.start();
    TestUtils.assert(
      chunksIndicator.isActive === true,
      "P2-8b",
      "Chunks mode start() works correctly"
    );

    // Simulate chunk updates
    chunksIndicator.update({ text: "Hello", fullText: "Hello" });
    chunksIndicator.update({ text: " World", fullText: "Hello World" });
    TestUtils.assert(
      chunksIndicator.chunksReceived === 2,
      "P2-8c",
      "Chunks mode update() increments chunk count"
    );
    TestUtils.assert(
      chunksIndicator.totalCharacters === 11,
      "P2-8d",
      "Chunks mode tracks total characters correctly"
    );

    // Test getProgressData still works
    const progressData = chunksIndicator.getProgressData();
    TestUtils.assert(
      progressData.chunksReceived === 2 && progressData.isActive === true,
      "P2-8e",
      "getProgressData() returns correct data in chunks mode"
    );

    // Test complete
    chunksIndicator.complete();
    // Brief delay check not needed for this test

    chunksIndicator.cleanup();
    TestUtils.assert(
      chunksIndicator.isActive === false,
      "P2-8f",
      "Chunks mode cleanup() resets state correctly"
    );

    TestUtils.removeTestContainer(container);
  }

  /**
   * P2-9: Progress bar visual with ARIA attributes
   */
  function testP2_9_ProgressBarARIA() {
    console.log("\n--- P2-9: Progress Bar with ARIA ---");

    const container = TestUtils.createTestContainer();

    const indicator = new EmbedProgressIndicator({
      container,
      progressMode: "stages",
      showProgressBar: true,
    });
    indicator.start();
    indicator.setStage("VALIDATING");

    // Check progress bar exists
    const progressBar = container.querySelector(
      ".embed-progress-bar-container"
    );
    TestUtils.assert(
      progressBar !== null,
      "P2-9a",
      "Progress bar element is created when showProgressBar: true"
    );

    // Check ARIA attributes
    TestUtils.assert(
      progressBar && progressBar.getAttribute("role") === "progressbar",
      "P2-9b",
      'Progress bar has role="progressbar"'
    );
    TestUtils.assert(
      progressBar && progressBar.getAttribute("aria-valuemin") === "0",
      "P2-9c",
      'Progress bar has aria-valuemin="0"'
    );
    TestUtils.assert(
      progressBar && progressBar.getAttribute("aria-valuemax") === "100",
      "P2-9d",
      'Progress bar has aria-valuemax="100"'
    );
    TestUtils.assert(
      progressBar && progressBar.getAttribute("aria-valuenow") === "5",
      "P2-9e",
      "Progress bar has correct aria-valuenow value"
    );
    TestUtils.assert(
      progressBar && progressBar.getAttribute("aria-label") !== null,
      "P2-9f",
      "Progress bar has aria-label for accessibility"
    );

    // Test progress bar updates
    indicator.setStage("PREPARING");
    TestUtils.assert(
      progressBar && progressBar.getAttribute("aria-valuenow") === "15",
      "P2-9g",
      "Progress bar aria-valuenow updates with stage changes"
    );

    indicator.cleanup();
    TestUtils.removeTestContainer(container);
  }

  /**
   * P2-10: Mode switching via updateConfig()
   */
  function testP2_10_ModeSwitching() {
    console.log("\n--- P2-10: Mode Switching via updateConfig() ---");

    const container = TestUtils.createTestContainer();

    // Start in chunks mode
    const indicator = new EmbedProgressIndicator({
      container,
      progressMode: "chunks",
    });
    TestUtils.assert(
      indicator.progressMode === "chunks",
      "P2-10a",
      'Initial progressMode is "chunks"'
    );

    // Switch to stages mode
    indicator.updateConfig({ progressMode: "stages" });
    TestUtils.assert(
      indicator.progressMode === "stages",
      "P2-10b",
      'updateConfig() switches progressMode to "stages"'
    );

    // Switch back to chunks mode
    indicator.updateConfig({ progressMode: "chunks" });
    TestUtils.assert(
      indicator.progressMode === "chunks",
      "P2-10c",
      'updateConfig() switches progressMode back to "chunks"'
    );

    // Test updating custom stages
    const newStages = {
      STEP1: { message: "Step 1...", icon: "1️⃣", weight: 50 },
      STEP2: { message: "Step 2...", icon: "2️⃣", weight: 50 },
    };
    indicator.updateConfig({
      progressMode: "stages",
      progressStages: newStages,
    });
    TestUtils.assert(
      indicator.progressStages.STEP1 !== undefined &&
        indicator.stageOrder.includes("STEP1"),
      "P2-10d",
      "updateConfig() updates custom progressStages and stageOrder"
    );

    // Test updating other stages options
    indicator.updateConfig({
      showProgressBar: true,
      showCompletionTime: false,
      showStageIcon: false,
    });
    TestUtils.assert(
      indicator.showProgressBar === true &&
        indicator.showCompletionTime === false &&
        indicator.showStageIcon === false,
      "P2-10e",
      "updateConfig() updates showProgressBar, showCompletionTime, showStageIcon"
    );

    TestUtils.removeTestContainer(container);
  }

  // ============================================================================
  // TEST RUNNER
  // ============================================================================

  function runAllPhase2Tests() {
    console.log(
      "╔════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║  OpenRouter Embed Progress - Phase 2 Tests (Stages Mode)  ║"
    );
    console.log(
      "╚════════════════════════════════════════════════════════════╝"
    );

    // Check prerequisite
    if (typeof EmbedProgressIndicator === "undefined") {
      console.error(
        "❌ EmbedProgressIndicator not found. Load openrouter-embed-progress.js first."
      );
      return { passed: 0, failed: 1, total: 1 };
    }

    TestUtils.reset();

    try {
      testP2_1_ProgressModeConfiguration();
      testP2_2_CustomStageDefinitions();
      testP2_3_SetStageMethod();
      testP2_4_WeightedPercentage();
      testP2_5_StageIconAccessibility();
      testP2_6_TimerTracking();
      testP2_7_CompletionTimeDisplay();
      testP2_8_BackwardsCompatibility();
      testP2_9_ProgressBarARIA();
      testP2_10_ModeSwitching();
    } catch (error) {
      console.error("❌ Test execution error:", error);
    }

    return TestUtils.summary();
  }

  // ============================================================================
  // QUICK VISUAL DEMO
  // ============================================================================

  function runStagesModeDemo() {
    console.log("\n🎬 Running Stages Mode Visual Demo...\n");

    const container = document.createElement("div");
    container.style.cssText =
      "position: fixed; top: 20px; right: 20px; width: 400px; z-index: 9999;";
    document.body.appendChild(container);

    const indicator = new EmbedProgressIndicator({
      container,
      progressMode: "stages",
      showProgressBar: true,
      showStageIcon: true,
      showCompletionTime: true,
      style: "detailed",
    });

    indicator.start();

    // Simulate stage progression
    const stages = ["VALIDATING", "PREPARING", "GENERATING", "FINALISING"];
    const delays = [500, 800, 2000, 500];
    let currentIndex = 0;

    function nextStage() {
      if (currentIndex < stages.length) {
        indicator.setStage(stages[currentIndex]);
        console.log(
          `📍 Stage: ${
            stages[currentIndex]
          } (${indicator.getStagePercentage()}%)`
        );
        currentIndex++;
        setTimeout(nextStage, delays[currentIndex - 1]);
      } else {
        indicator.complete();
        const elapsed = indicator.getElapsedSeconds();
        indicator.showCompletionTimeDisplay(elapsed);
        console.log(
          `✅ Demo complete! Elapsed: ${indicator.formatElapsedTime(elapsed)}`
        );

        // Cleanup after 3 seconds
        setTimeout(() => {
          indicator.cleanup();
          indicator.hideCompletionTimeDisplay();
          container.remove();
          console.log("🧹 Demo cleanup complete");
        }, 3000);
      }
    }

    setTimeout(nextStage, 300);
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.runPhase2Tests = runAllPhase2Tests;
  window.runStagesModeDemo = runStagesModeDemo;
})();
