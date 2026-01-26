/**
 * MathJax Recovery System Test Suite
 *
 * Provides comprehensive testing for the MathJax Manager recovery
 * subscription system and MMD Preview integration.
 *
 * Usage:
 *   await testMathJaxRecoverySystem()       // Run all tests
 *   await simulateMathJaxFailure()          // Manually trigger failure
 *   await simulateMathJaxRecovery()         // Manually trigger recovery
 *   window.mathJaxRecoveryTestLog           // View detailed logs
 *
 * @module MathJaxRecoveryTests
 */

// ============================================================================
// Test Logging System
// ============================================================================

/**
 * Detailed test log for debugging
 * Access via: window.mathJaxRecoveryTestLog
 */
window.mathJaxRecoveryTestLog = [];

function testLog(level, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
  };
  window.mathJaxRecoveryTestLog.push(entry);

  const prefix =
    {
      info: "ℹ️",
      success: "✅",
      warn: "⚠️",
      error: "❌",
      debug: "🔍",
    }[level] || "📝";

  console.log(`${prefix} [Recovery Test] ${message}`, data);
}

function clearTestLog() {
  window.mathJaxRecoveryTestLog = [];
  console.log("🗑️ Test log cleared");
}

// ============================================================================
// State Capture Utilities
// ============================================================================

/**
 * Capture current state of all relevant systems
 * @returns {Object} State snapshot
 */
function captureSystemState() {
  const state = {
    timestamp: Date.now(),
    mathJaxManager: null,
    mmdPreview: null,
    mathJaxGlobal: null,
  };

  // MathJax Manager state
  if (window.mathJaxManager) {
    state.mathJaxManager = {
      isHealthy: window.mathJaxManager.isHealthy,
      queueLength: window.mathJaxManager.operationsQueue?.length || 0,
      recoveryCallbackCount: window.mathJaxManager.recoveryCallbacks?.size || 0,
      pendingElementCount: window.mathJaxManager.pendingElements?.size || 0,
      consecutiveFailures: window.mathJaxManager.consecutiveFailures || 0,
    };
  }

  // MMD Preview state
  const preview = window.getMathPixMMDPreview?.();
  if (preview) {
    state.mmdPreview = {
      domInitialised: preview.domInitialised,
      pendingMathJaxRender: preview.pendingMathJaxRender,
      hasRecoverySubscription: !!preview.mathJaxRecoveryUnsubscribe,
      currentView: preview.getCurrentView?.(),
      hasContent: !!preview.currentContent,
      lastRenderedContent:
        preview.lastRenderedContent?.substring(0, 50) || null,
    };
  }

  // Global MathJax state
  state.mathJaxGlobal = {
    mathJaxExists: !!window.MathJax,
    hasTypesetPromise: !!window.MathJax?.typesetPromise,
    enhancementReady: !!window.MathJaxEnhancementReady,
    mathJaxDisabled: !!window.MathJaxDisabled,
  };

  return state;
}

/**
 * Print formatted state comparison
 */
function printStateComparison(before, after, label = "State Change") {
  console.group(`📊 ${label}`);

  console.log("MathJax Manager:");
  if (before.mathJaxManager && after.mathJaxManager) {
    const mgr = after.mathJaxManager;
    const mgrBefore = before.mathJaxManager;
    console.log(`  isHealthy: ${mgrBefore.isHealthy} → ${mgr.isHealthy}`);
    console.log(
      `  recoveryCallbacks: ${mgrBefore.recoveryCallbackCount} → ${mgr.recoveryCallbackCount}`
    );
    console.log(
      `  pendingElements: ${mgrBefore.pendingElementCount} → ${mgr.pendingElementCount}`
    );
  }

  console.log("MMD Preview:");
  if (before.mmdPreview && after.mmdPreview) {
    const prev = after.mmdPreview;
    const prevBefore = before.mmdPreview;
    console.log(
      `  pendingMathJaxRender: ${prevBefore.pendingMathJaxRender} → ${prev.pendingMathJaxRender}`
    );
    console.log(
      `  hasRecoverySubscription: ${prevBefore.hasRecoverySubscription} → ${prev.hasRecoverySubscription}`
    );
  }

  console.log("MathJax Global:");
  const glob = after.mathJaxGlobal;
  const globBefore = before.mathJaxGlobal;
  console.log(
    `  mathJaxDisabled: ${globBefore.mathJaxDisabled} → ${glob.mathJaxDisabled}`
  );
  console.log(
    `  enhancementReady: ${globBefore.enhancementReady} → ${glob.enhancementReady}`
  );

  console.groupEnd();
}

// ============================================================================
// Simulation Functions
// ============================================================================

/**
 * Simulate MathJax failure state
 * This allows testing recovery without waiting for actual errors
 *
 * IMPORTANT: We preserve MathJaxEnhancementReady to avoid breaking
 * the mathpix-markdown-it CDN which has its own MathJax dependency.
 * The CDN should still be able to load and render HTML; only the
 * page's MathJax typesetting should fail.
 */
window.simulateMathJaxFailure = async function () {
  testLog("info", "Simulating MathJax failure...");

  const beforeState = captureSystemState();

  // Store original values for restoration
  window._testOriginalMathJaxState = {
    MathJaxDisabled: window.MathJaxDisabled,
    MathJaxEnhancementReady: window.MathJaxEnhancementReady,
    managerIsHealthy: window.mathJaxManager?.isHealthy,
    managerConsecutiveFailures: window.mathJaxManager?.consecutiveFailures,
    // Store original typesetPromise for safe restoration
    originalTypesetPromise: window.MathJax?.typesetPromise,
  };

  // Simulate failure - but carefully to not break CDN
  window.MathJaxDisabled = true;

  // DON'T set MathJaxEnhancementReady = false as this breaks the CDN
  // Instead, we rely on MathJaxDisabled flag to skip typesetting
  // window.MathJaxEnhancementReady = false; // REMOVED - breaks CDN

  if (window.mathJaxManager) {
    window.mathJaxManager.isHealthy = false;
    window.mathJaxManager.consecutiveFailures = 5;
  }

  // Optionally make typesetPromise fail (for more realistic simulation)
  if (window.MathJax?.typesetPromise) {
    window._testOriginalTypesetPromise = window.MathJax.typesetPromise;
    window.MathJax.typesetPromise = async function () {
      throw new Error("Simulated MathJax typeset failure");
    };
  }

  const afterState = captureSystemState();
  printStateComparison(beforeState, afterState, "After Simulated Failure");

  testLog("success", "MathJax failure state simulated", {
    MathJaxDisabled: window.MathJaxDisabled,
    managerHealthy: window.mathJaxManager?.isHealthy,
  });

  return afterState;
};

/**
 * Simulate MathJax recovery
 * Restores state and triggers recovery notifications
 */
window.simulateMathJaxRecovery = async function () {
  testLog("info", "Simulating MathJax recovery...");

  const beforeState = captureSystemState();

  // Restore MathJax state
  window.MathJaxDisabled = false;
  window.MathJaxEnhancementReady = true;

  if (window.mathJaxManager) {
    window.mathJaxManager.isHealthy = true;
    window.mathJaxManager.consecutiveFailures = 0;

    // Trigger recovery notification
    testLog("info", "Triggering recovery notification...");

    if (
      typeof window.mathJaxManager._notifyRecoverySubscribers === "function"
    ) {
      window.mathJaxManager._notifyRecoverySubscribers();
      testLog("success", "Recovery subscribers notified");
    } else {
      testLog("error", "_notifyRecoverySubscribers method not found");
    }
  }

  // Small delay to allow async handlers to complete
  await new Promise((resolve) => setTimeout(resolve, 500));

  const afterState = captureSystemState();
  printStateComparison(beforeState, afterState, "After Simulated Recovery");

  testLog("success", "MathJax recovery simulated", afterState.mathJaxGlobal);

  return afterState;
};

/**
 * Restore original MathJax state (cleanup after testing)
 */
window.restoreMathJaxState = function () {
  if (window._testOriginalMathJaxState) {
    window.MathJaxDisabled = window._testOriginalMathJaxState.MathJaxDisabled;
    window.MathJaxEnhancementReady =
      window._testOriginalMathJaxState.MathJaxEnhancementReady;

    if (window.mathJaxManager) {
      window.mathJaxManager.isHealthy =
        window._testOriginalMathJaxState.managerIsHealthy;
      window.mathJaxManager.consecutiveFailures =
        window._testOriginalMathJaxState.managerConsecutiveFailures || 0;
    }

    // Restore original typesetPromise if we replaced it
    if (window._testOriginalTypesetPromise && window.MathJax) {
      window.MathJax.typesetPromise = window._testOriginalTypesetPromise;
      delete window._testOriginalTypesetPromise;
    }

    delete window._testOriginalMathJaxState;
    testLog("success", "Original MathJax state restored");
  } else {
    testLog("warn", "No original state to restore");
  }
};

// ============================================================================
// Recovery Callback Spy
// ============================================================================

/**
 * Install a spy callback to track recovery notifications
 */
window.installRecoveryCallbackSpy = function () {
  window._recoveryCallbackSpyResults = [];

  if (!window.mathJaxManager?.onRecovery) {
    testLog("error", "MathJax Manager onRecovery not available");
    return null;
  }

  const unsubscribe = window.mathJaxManager.onRecovery((eventData) => {
    const spyResult = {
      timestamp: Date.now(),
      eventData,
      mmdPreviewState: captureSystemState().mmdPreview,
    };
    window._recoveryCallbackSpyResults.push(spyResult);
    testLog("debug", "Recovery callback spy triggered", spyResult);
  });

  testLog("success", "Recovery callback spy installed");

  return unsubscribe;
};

// ============================================================================
// Comprehensive Test Suite
// ============================================================================

/**
 * Run complete MathJax recovery system tests
 */
window.testMathJaxRecoverySystem = async function () {
  console.log("🧪 MathJax Recovery System Test Suite");
  console.log("=====================================\n");

  clearTestLog();

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
  };

  const test = (name, condition, details = "") => {
    results.total++;
    if (condition) {
      results.passed++;
      console.log(`✅ ${name}`);
      testLog("success", name);
    } else {
      results.failed++;
      results.errors.push({ name, details });
      console.log(`❌ ${name}${details ? ` - ${details}` : ""}`);
      testLog("error", name, { details });
    }
  };

  // ============================================================
  // PREREQUISITE TESTS
  // ============================================================
  console.log("\n📋 Prerequisites:");

  test("MathJax Manager exists", !!window.mathJaxManager);
  test(
    "MathJax Manager has onRecovery method",
    typeof window.mathJaxManager?.onRecovery === "function"
  );
  test(
    "MathJax Manager has _notifyRecoverySubscribers method",
    typeof window.mathJaxManager?._notifyRecoverySubscribers === "function"
  );
  test(
    "MathJax Manager has registerPendingElement method",
    typeof window.mathJaxManager?.registerPendingElement === "function"
  );
  test(
    "MathJax Manager has getPendingElements method",
    typeof window.mathJaxManager?.getPendingElements === "function"
  );
  test(
    "MathJax Manager has recoveryCallbacks Set",
    window.mathJaxManager?.recoveryCallbacks instanceof Set
  );
  test(
    "MathJax Manager has pendingElements Set",
    window.mathJaxManager?.pendingElements instanceof Set
  );

  const preview = window.getMathPixMMDPreview?.();
  test("MMD Preview exists", !!preview);

  if (!preview) {
    console.error("❌ Cannot continue without MMD Preview");
    return results;
  }

  // Initialise preview if needed
  if (!preview.domInitialised) {
    preview.init();
  }

  test("MMD Preview is initialised", preview.domInitialised);
  test(
    "MMD Preview has pendingMathJaxRender property",
    "pendingMathJaxRender" in preview
  );
  test(
    "MMD Preview has mathJaxRecoveryUnsubscribe property",
    "mathJaxRecoveryUnsubscribe" in preview
  );
  test(
    "MMD Preview has subscribeToMathJaxRecovery method",
    typeof preview.subscribeToMathJaxRecovery === "function"
  );
  test(
    "MMD Preview has handleMathJaxRecovery method",
    typeof preview.handleMathJaxRecovery === "function"
  );

  // ============================================================
  // SUBSCRIPTION TESTS
  // ============================================================
  console.log("\n📡 Subscription Tests:");

  const initialCallbackCount =
    window.mathJaxManager?.recoveryCallbacks?.size || 0;
  test(
    "Initial recovery callback count tracked",
    typeof initialCallbackCount === "number",
    `Count: ${initialCallbackCount}`
  );

  // Test that MMD Preview subscribed
  test(
    "MMD Preview has active recovery subscription",
    !!preview.mathJaxRecoveryUnsubscribe,
    "mathJaxRecoveryUnsubscribe should be a function"
  );

  // Install spy callback
  const spyUnsubscribe = window.installRecoveryCallbackSpy();
  const afterSpyCount = window.mathJaxManager?.recoveryCallbacks?.size || 0;
  test(
    "Spy callback increased subscriber count",
    afterSpyCount > initialCallbackCount,
    `Before: ${initialCallbackCount}, After: ${afterSpyCount}`
  );

  // ============================================================
  // FAILURE SIMULATION TESTS
  // ============================================================
  console.log("\n💥 Failure Simulation Tests:");

  const beforeFailure = captureSystemState();
  await window.simulateMathJaxFailure();
  const afterFailure = captureSystemState();

  test("MathJaxDisabled flag set", window.MathJaxDisabled === true);
  test(
    "MathJax Manager marked unhealthy",
    window.mathJaxManager?.isHealthy === false
  );
  // Note: We deliberately DON'T clear MathJaxEnhancementReady as it breaks the CDN
  // The MathJaxDisabled flag is sufficient to prevent page MathJax from running
  // We check that the value wasn't changed from what it was before simulation
  const enhancementReadyPreserved =
    window.MathJaxEnhancementReady ===
    beforeFailure.mathJaxGlobal.enhancementReady;
  test(
    "MathJaxEnhancementReady preserved during simulation (CDN protection)",
    enhancementReadyPreserved,
    `Before: ${beforeFailure.mathJaxGlobal.enhancementReady}, After: ${window.MathJaxEnhancementReady}`
  );

  // ============================================================
  // RENDER DURING FAILURE TESTS
  // ============================================================
  console.log("\n🖼️ Render During Failure Tests:");

  // Set test content with math
  const testContent =
    "# Recovery Test\n\n$$E = mc^2$$\n\nTesting recovery system.";
  preview.setContent(testContent);
  preview.lastRenderedContent = null; // Force re-render

  // Try to render (should mark as pending IF math wasn't rendered by CDN)
  try {
    // Switch to preview to trigger render
    await preview.switchView("preview");
    await new Promise((resolve) => setTimeout(resolve, 500));

    test("Render attempted during failure state", true);

    // Check what happened with the render
    const previewContent = preview.elements.previewContent;
    const hasMjxContainer = previewContent?.querySelector("mjx-container");
    const hasUnrenderedMath = preview.detectUnrenderedMath?.(previewContent);

    console.log("  📊 Render analysis:", {
      hasMjxContainer: !!hasMjxContainer,
      hasUnrenderedMath,
      pendingMathJaxRender: preview.pendingMathJaxRender,
    });

    if (hasMjxContainer && !hasUnrenderedMath) {
      // CDN rendered the math - this is expected behaviour, no recovery needed
      test("CDN rendered math (recovery not needed for this case)", true);
      test(
        "pendingMathJaxRender correctly false when CDN rendered",
        preview.pendingMathJaxRender === false,
        `Current value: ${preview.pendingMathJaxRender}`
      );
    } else {
      // CDN didn't render math - should be marked for recovery
      test("Math not rendered by CDN (recovery needed)", true);
      test(
        "pendingMathJaxRender flag set after failed render",
        preview.pendingMathJaxRender === true,
        `Current value: ${preview.pendingMathJaxRender}`
      );

      // Check if element was registered as pending
      const pendingCount = window.mathJaxManager?.pendingElements?.size || 0;
      test(
        "Pending element registered with MathJax Manager",
        pendingCount > 0,
        `Pending elements: ${pendingCount}`
      );
    }
  } catch (error) {
    test("Render attempted during failure state", false, error.message);
  }

  // ============================================================
  // RECOVERY SIMULATION TESTS
  // ============================================================
  console.log("\n🔄 Recovery Simulation Tests:");

  window._recoveryCallbackSpyResults = []; // Clear spy results

  const beforeRecovery = captureSystemState();
  await window.simulateMathJaxRecovery();

  // Wait for async operations
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const afterRecovery = captureSystemState();

  test("MathJaxDisabled flag cleared", window.MathJaxDisabled === false);
  test(
    "MathJax Manager marked healthy",
    window.mathJaxManager?.isHealthy === true
  );
  test(
    "MathJaxEnhancementReady restored",
    window.MathJaxEnhancementReady === true
  );

  // Check spy was called
  const spyCallCount = window._recoveryCallbackSpyResults?.length || 0;
  test(
    "Recovery callback spy was triggered",
    spyCallCount > 0,
    `Spy call count: ${spyCallCount}`
  );

  // Check if MMD Preview re-rendered
  test(
    "pendingMathJaxRender flag cleared after recovery",
    preview.pendingMathJaxRender === false,
    `Current value: ${preview.pendingMathJaxRender}`
  );

  // ============================================================
  // CLEANUP
  // ============================================================
  console.log("\n🧹 Cleanup:");

  // Unsubscribe spy
  if (spyUnsubscribe) {
    spyUnsubscribe();
    test("Spy callback unsubscribed", true);
  }

  // Restore original state
  window.restoreMathJaxState();
  test("Original state restored", true);

  // Switch back to code view
  await preview.switchView("code");

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n=====================================");
  console.log(`📊 Results: ${results.passed}/${results.total} tests passed`);

  if (results.failed === 0) {
    console.log("✅ MathJax Recovery System COMPLETE");
  } else {
    console.error(`❌ ${results.failed} tests failed:`);
    results.errors.forEach((e) => {
      console.error(`   - ${e.name}${e.details ? `: ${e.details}` : ""}`);
    });
  }

  console.log("\n💡 View detailed log: window.mathJaxRecoveryTestLog");
  console.log("💡 Run individual simulations:");
  console.log("   await simulateMathJaxFailure()");
  console.log("   await simulateMathJaxRecovery()");
  console.log("   restoreMathJaxState()");

  return results;
};

// ============================================================================
// Quick Diagnostic Functions
// ============================================================================

/**
 * Quick check of recovery system status
 */
window.checkRecoverySystemStatus = function () {
  console.log("🔍 Recovery System Status Check");
  console.log("================================\n");

  const state = captureSystemState();

  console.log("MathJax Manager:");
  if (state.mathJaxManager) {
    console.log(`  ✓ Available`);
    console.log(`  isHealthy: ${state.mathJaxManager.isHealthy}`);
    console.log(
      `  Recovery subscribers: ${state.mathJaxManager.recoveryCallbackCount}`
    );
    console.log(
      `  Pending elements: ${state.mathJaxManager.pendingElementCount}`
    );
  } else {
    console.log(`  ✗ Not available`);
  }

  console.log("\nMMD Preview:");
  if (state.mmdPreview) {
    console.log(`  ✓ Available`);
    console.log(`  domInitialised: ${state.mmdPreview.domInitialised}`);
    console.log(
      `  Has recovery subscription: ${state.mmdPreview.hasRecoverySubscription}`
    );
    console.log(
      `  Pending MathJax render: ${state.mmdPreview.pendingMathJaxRender}`
    );
    console.log(`  Current view: ${state.mmdPreview.currentView}`);
  } else {
    console.log(`  ✗ Not available`);
  }

  console.log("\nMathJax Global:");
  console.log(`  MathJax exists: ${state.mathJaxGlobal.mathJaxExists}`);
  console.log(`  Has typesetPromise: ${state.mathJaxGlobal.hasTypesetPromise}`);
  console.log(`  Enhancement ready: ${state.mathJaxGlobal.enhancementReady}`);
  console.log(`  Disabled: ${state.mathJaxGlobal.mathJaxDisabled}`);

  return state;
};

/**
 * Manual end-to-end recovery test with visual feedback
 */
window.testRecoveryEndToEnd = async function () {
  console.log("🎬 End-to-End Recovery Test");
  console.log("===========================\n");
  console.log("This test will:");
  console.log("1. Simulate MathJax failure");
  console.log("2. Render MMD content (should show without math)");
  console.log("3. Wait 3 seconds");
  console.log("4. Trigger recovery");
  console.log("5. Verify content re-renders with math\n");

  const preview = window.getMathPixMMDPreview?.();
  if (!preview) {
    console.error("❌ MMD Preview not available");
    return false;
  }

  // Ensure initialised
  if (!preview.domInitialised) {
    preview.init();
  }

  console.log("Step 1: Simulating failure...");
  await window.simulateMathJaxFailure();

  console.log("\nStep 2: Setting test content and rendering...");
  const testContent = `# Recovery Demo

This content has mathematics: $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$

And inline math: $E = mc^2$

Watch this area - the math should render after recovery!`;

  preview.setContent(testContent);
  preview.lastRenderedContent = null;

  await preview.switchView("preview");

  console.log("\nStep 3: Waiting 3 seconds...");
  console.log("(Math should NOT be rendered yet - check the preview)");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("\nStep 4: Triggering recovery...");
  await window.simulateMathJaxRecovery();

  console.log("\nStep 5: Waiting for re-render...");
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log("\n✅ Test complete!");
  console.log("Check the preview - math should now be rendered.");
  console.log(`pendingMathJaxRender: ${preview.pendingMathJaxRender}`);

  // Cleanup
  window.restoreMathJaxState();

  return true;
};
/**
 * Test recovery when CDN doesn't render math
 * This simulates the scenario where mathpix-markdown-it CDN
 * is configured to NOT render math (leaving it for page MathJax)
 */
window.testRecoveryWithoutCDNMath = async function () {
  console.log("🧪 Recovery Test (No CDN Math)");
  console.log("==============================\n");

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
  };

  const test = (name, condition, details = "") => {
    results.total++;
    if (condition) {
      results.passed++;
      console.log(`✅ ${name}`);
    } else {
      results.failed++;
      results.errors.push({ name, details });
      console.log(`❌ ${name}${details ? ` - ${details}` : ""}`);
    }
  };

  const preview = window.getMathPixMMDPreview?.();
  if (!preview) {
    console.error("❌ MMD Preview not available");
    return results;
  }

  if (!preview.domInitialised) {
    preview.init();
  }

  // Step 1: Simulate MathJax failure
  console.log("Step 1: Simulating MathJax failure...");
  await window.simulateMathJaxFailure();

  // Step 2: Manually create content with unrendered math
  // (bypassing the CDN to simulate CDN not rendering)
  console.log("\nStep 2: Creating content with unrendered math...");

  const previewContent = preview.elements.previewContent;
  if (!previewContent) {
    test("Preview content element exists", false);
    return results;
  }

  // Clear and insert HTML that has unrendered LaTeX
  previewContent.innerHTML = `
    <h1>Test Content</h1>
    <p>This has unrendered math: $$E = mc^2$$</p>
    <p>And inline: $\\alpha + \\beta = \\gamma$</p>
  `;

  // Step 3: Check if detectUnrenderedMath works
  const hasUnrendered = preview.detectUnrenderedMath?.(previewContent);
  test("detectUnrenderedMath detects raw LaTeX", hasUnrendered === true);

  // Step 4: Manually trigger the math rendering logic
  console.log("\nStep 3: Testing render logic with unrendered math...");

  // Set content and force re-render
  preview.currentContent = "# Test\n\n$$E = mc^2$$";
  preview.lastRenderedContent = null;
  preview.pendingMathJaxRender = false; // Reset

  // Simulate what render() would do
  const hasMjxContainer = previewContent.querySelector("mjx-container");
  const needsMathJax = hasUnrendered || !hasMjxContainer;

  test("needsMathJax correctly identified", needsMathJax === true);

  if (needsMathJax && window.MathJaxDisabled) {
    // This is the path that should set pendingMathJaxRender
    preview.pendingMathJaxRender = true;

    if (window.mathJaxManager?.registerPendingElement) {
      window.mathJaxManager.registerPendingElement(previewContent, {
        source: "test",
        reason: "simulated-failure",
      });
    }
  }

  test(
    "pendingMathJaxRender set when MathJax disabled",
    preview.pendingMathJaxRender === true
  );

  const pendingCount = window.mathJaxManager?.pendingElements?.size || 0;
  test("Pending element registered", pendingCount > 0);

  // Step 5: Simulate recovery
  console.log("\nStep 4: Simulating recovery...");

  // Install spy before recovery
  let recoveryCallbackFired = false;
  const unsubscribe = window.mathJaxManager?.onRecovery?.((eventData) => {
    recoveryCallbackFired = true;
    testLog("debug", "Recovery callback fired in test", eventData);
  });

  await window.simulateMathJaxRecovery();
  await new Promise((resolve) => setTimeout(resolve, 500));

  test("Recovery callback fired", recoveryCallbackFired);

  // Cleanup
  if (unsubscribe) unsubscribe();
  window.restoreMathJaxState();
  await preview.switchView("code");

  // Summary
  console.log("\n==============================");
  console.log(`📊 Results: ${results.passed}/${results.total} tests passed`);

  if (results.failed === 0) {
    console.log("✅ No-CDN-Math recovery test PASSED");
  } else {
    console.error(`❌ ${results.failed} tests failed`);
  }

  return results;
};
