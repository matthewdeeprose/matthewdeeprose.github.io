/**
 * @fileoverview MathPix MMD Editor Persistence Tests - Phase 5.2 Validation Suite
 * @module MathPixMMDEditorPersistenceTests
 * @version 5.2.0
 * @since 5.2.0
 *
 * @description
 * Comprehensive test suite for the MMD Editor Persistence feature (Phase 5.2).
 * Tests auto-save, undo/redo functionality, session management, localStorage
 * operations, keyboard shortcuts, and accessibility compliance.
 *
 * Test Categories:
 * 1. Initialisation - Module creation and setup
 * 2. Element Caching - DOM element references
 * 3. Session Management - Start, restore, clear sessions
 * 4. Content Changes - Auto-save with debounce
 * 5. Undo/Redo - Stack operations
 * 6. Restore Original - Return to MathPix output
 * 7. localStorage - Save/load/remove operations
 * 8. UI State - Button states, status indicator
 * 9. Keyboard Shortcuts - Ctrl+Z, Ctrl+Y
 * 10. Accessibility - ARIA attributes and announcements
 * 11. Editor Integration - Callback registration
 * 12. Session Banner - Restore prompt on load
 *
 * Usage:
 *   await testMMDPersistencePhase52()  // Full test suite
 *   validatePhase52()                   // Quick validation
 *   await demoMMDPersistence()          // Interactive demo
 */

// ============================================================================
// Test Configuration
// ============================================================================

const MMD_PERSISTENCE_TEST_CONFIG = {
  SAMPLE_MMD: `# Sample Document

This is a test document with **bold** and *italic* text.

## Mathematics

Inline math: $E = mc^2$

Block math:
$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Table

| Column 1 | Column 2 |
|----------|----------|
| Data A   | Data B   |
`,
  MODIFIED_MMD: `# Sample Document

This is a MODIFIED document with **bold** and *italic* text.

## New Section

Added during testing.
`,
  STORAGE_KEY: "mathpix-mmd-session",
  TIMEOUT_SHORT: 100,
  TIMEOUT_MEDIUM: 500,
  TIMEOUT_LONG: 1500,
};

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Clean up any existing test session
 */
function cleanupTestSession() {
  localStorage.removeItem(MMD_PERSISTENCE_TEST_CONFIG.STORAGE_KEY);
  const persistence = window.getMathPixMMDPersistence?.();
  if (persistence) {
    persistence.session = null;
    persistence.isModified = false;
    if (persistence.autoSaveTimer) {
      clearTimeout(persistence.autoSaveTimer);
      persistence.autoSaveTimer = null;
    }
    persistence.hideSessionControls?.();
    persistence.dismissBanner?.();
  }
}

/**
 * Wait for specified milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Main Test Suite
// ============================================================================

/**
 * Comprehensive Phase 5.2 MMD Persistence Test Suite
 * @returns {Promise<Object>} Test results with pass/fail counts
 */
window.testMMDPersistencePhase52 = async function () {
  console.log("🧪 MMD Persistence Phase 5.2 Test Suite");
  console.log("=======================================\n");

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
  };

  const test = (name, condition) => {
    results.total++;
    if (condition) {
      results.passed++;
      console.log(`✅ ${name}`);
    } else {
      results.failed++;
      results.errors.push(name);
      console.log(`❌ ${name}`);
    }
  };

  const asyncTest = async (name, asyncCondition) => {
    results.total++;
    try {
      const condition = await asyncCondition();
      if (condition) {
        results.passed++;
        console.log(`✅ ${name}`);
      } else {
        results.failed++;
        results.errors.push(name);
        console.log(`❌ ${name}`);
      }
    } catch (error) {
      results.failed++;
      results.errors.push(`${name} (Error: ${error.message})`);
      console.log(`❌ ${name} - Error: ${error.message}`);
    }
  };

  // Clean up before tests
  cleanupTestSession();

  // ============================================================
  // 1. INITIALISATION TESTS
  // ============================================================
  console.log("\n📦 1. Initialisation:");

  test(
    "getMathPixMMDPersistence function exists",
    typeof window.getMathPixMMDPersistence === "function"
  );

  const persistence = window.getMathPixMMDPersistence?.();
  test("Persistence instance created", !!persistence);

  if (!persistence) {
    console.error("❌ Cannot continue without persistence instance");
    return results;
  }

  // Initialise if not already done
  if (!persistence.isInitialised) {
    persistence.init();
  }

  test("Persistence initialised flag set", persistence.isInitialised === true);
  test("Elements cached flag set", persistence.elementsCached === true);

  // ============================================================
  // 2. ELEMENT CACHING TESTS
  // ============================================================
  console.log("\n🗂️ 2. Element Caching:");

  const requiredElements = [
    "sessionControls",
    "sessionStatus",
    "undoBtn",
    "redoBtn",
    "restoreBtn",
    "clearBtn",
    "srStatus",
    "sessionBanner",
  ];

  requiredElements.forEach((name) => {
    test(`Element cached: ${name}`, !!persistence.elements[name]);
  });

  // ============================================================
  // 3. SESSION MANAGEMENT TESTS
  // ============================================================
  console.log("\n📁 3. Session Management:");

  // Start a session
  persistence.startSession(
    MMD_PERSISTENCE_TEST_CONFIG.SAMPLE_MMD,
    "test-document.pdf"
  );

  test("Session started", persistence.hasSession() === true);
  test(
    "Session controls visible",
    !persistence.elements.sessionControls?.hidden
  );

  const sessionInfo = persistence.getSessionInfo();
  test("Session info available", sessionInfo !== null);
  test(
    "Session has correct filename",
    sessionInfo?.fileName === "test-document.pdf"
  );
  test(
    "Session has original content",
    sessionInfo?.originalLength === MMD_PERSISTENCE_TEST_CONFIG.SAMPLE_MMD.length
  );
  test(
    "Session has current content",
    sessionInfo?.contentLength === MMD_PERSISTENCE_TEST_CONFIG.SAMPLE_MMD.length
  );
  test("Undo stack initially empty", sessionInfo?.undoCount === 0);
  test("Redo stack initially empty", sessionInfo?.redoCount === 0);

  // ============================================================
  // 4. CONTENT CHANGE TESTS
  // ============================================================
  console.log("\n✏️ 4. Content Changes:");

  // Simulate content change
  persistence.handleContentChange(MMD_PERSISTENCE_TEST_CONFIG.MODIFIED_MMD);

  test("Modified flag set after change", persistence.isModified === true);
  test(
    "Status shows modified",
    persistence.elements.sessionStatus?.dataset.state === "modified"
  );

  // Wait for auto-save debounce
  await wait(MMD_PERSISTENCE_TEST_CONFIG.TIMEOUT_LONG);

  test("Modified flag cleared after save", persistence.isModified === false);
  test(
    "Status shows saved",
    persistence.elements.sessionStatus?.dataset.state === "saved"
  );

  // Check undo stack was populated
  const infoAfterChange = persistence.getSessionInfo();
  test("Undo stack has entry after change", infoAfterChange?.undoCount === 1);

  // ============================================================
  // 5. UNDO/REDO TESTS
  // ============================================================
  console.log("\n↶↷ 5. Undo/Redo:");

  // Current content should be modified version
  test(
    "Current content is modified",
    persistence.session?.current === MMD_PERSISTENCE_TEST_CONFIG.MODIFIED_MMD
  );

  // Undo
  const undoResult = persistence.undo();
  test("Undo returns true", undoResult === true);
  test(
    "Content restored to original after undo",
    persistence.session?.current === MMD_PERSISTENCE_TEST_CONFIG.SAMPLE_MMD
  );
  test("Undo stack empty after undo", persistence.getUndoCount() === 0);
  test("Redo stack has entry after undo", persistence.getRedoCount() === 1);
  test("Undo button disabled after undo", persistence.elements.undoBtn?.disabled === true);
  test("Redo button enabled after undo", persistence.elements.redoBtn?.disabled === false);

  // Redo
  const redoResult = persistence.redo();
  test("Redo returns true", redoResult === true);
  test(
    "Content restored to modified after redo",
    persistence.session?.current === MMD_PERSISTENCE_TEST_CONFIG.MODIFIED_MMD
  );
  test("Undo stack has entry after redo", persistence.getUndoCount() === 1);
  test("Redo stack empty after redo", persistence.getRedoCount() === 0);
  test("Undo button enabled after redo", persistence.elements.undoBtn?.disabled === false);
  test("Redo button disabled after redo", persistence.elements.redoBtn?.disabled === true);

  // Test undo when nothing to undo
  persistence.undo(); // Back to original
  const noUndoResult = persistence.undo();
  test("Undo returns false when nothing to undo", noUndoResult === false);

  // Test redo when nothing to redo
  persistence.redo(); // Back to modified
  const noRedoResult = persistence.redo();
  test("Redo returns false when nothing to redo", noRedoResult === false);

  // ============================================================
  // 6. RESTORE ORIGINAL TESTS
  // ============================================================
  console.log("\n↩️ 6. Restore Original:");

  // Ensure we're at modified content
  test(
    "Starting with modified content",
    persistence.session?.current === MMD_PERSISTENCE_TEST_CONFIG.MODIFIED_MMD
  );

  // Restore original
  await persistence.restoreOriginal();

  test(
    "Content is original after restore",
    persistence.session?.current === MMD_PERSISTENCE_TEST_CONFIG.SAMPLE_MMD
  );
  test(
    "Undo stack has entry after restore (can undo restore)",
    persistence.getUndoCount() >= 1
  );

  // ============================================================
  // 7. LOCALSTORAGE TESTS
  // ============================================================
  console.log("\n💾 7. localStorage:");

  // Check storage has session
  const storedRaw = localStorage.getItem(MMD_PERSISTENCE_TEST_CONFIG.STORAGE_KEY);
  test("Session stored in localStorage", storedRaw !== null);

  const stored = JSON.parse(storedRaw || "{}");
  test("Stored session has original", !!stored.original);
  test("Stored session has current", !!stored.current);
  test("Stored session has undoStack", Array.isArray(stored.undoStack));
  test("Stored session has redoStack", Array.isArray(stored.redoStack));
  test("Stored session has lastModified", typeof stored.lastModified === "number");
  test("Stored session has sourceFileName", stored.sourceFileName === "test-document.pdf");

  // ============================================================
  // 8. UI STATE TESTS
  // ============================================================
  console.log("\n🎨 8. UI State:");

  test(
    "Session status element has aria-live",
    persistence.elements.sessionStatus?.getAttribute("aria-live") === "polite"
  );
  test(
    "Undo button has aria-keyshortcuts",
    persistence.elements.undoBtn?.getAttribute("aria-keyshortcuts") === "Control+z"
  );
  test(
    "Redo button has aria-keyshortcuts",
    persistence.elements.redoBtn?.getAttribute("aria-keyshortcuts") === "Control+y"
  );

  // ============================================================
  // 9. KEYBOARD SHORTCUT TESTS
  // ============================================================
  console.log("\n⌨️ 9. Keyboard Shortcuts:");

  // We can't fully simulate keyboard events in this context,
  // but we can verify the handler exists
  test(
    "handleKeyboardShortcut method exists",
    typeof persistence.handleKeyboardShortcut === "function"
  );

  // ============================================================
  // 10. ACCESSIBILITY TESTS
  // ============================================================
  console.log("\n♿ 10. Accessibility:");

  test(
    "SR status element exists",
    !!persistence.elements.srStatus
  );
  test(
    "SR status has aria-live",
    persistence.elements.srStatus?.getAttribute("aria-live") === "polite"
  );
  test(
    "SR status has aria-atomic",
    persistence.elements.srStatus?.getAttribute("aria-atomic") === "true"
  );

  // Test announcement
  persistence.announceStatus("Test announcement");
  await wait(MMD_PERSISTENCE_TEST_CONFIG.TIMEOUT_SHORT);
  test(
    "SR status receives announcements",
    persistence.elements.srStatus?.textContent === "Test announcement"
  );

  // ============================================================
  // 11. EDITOR INTEGRATION TESTS
  // ============================================================
  console.log("\n🔗 11. Editor Integration:");

  const editor = window.getMathPixMMDEditor?.();
  test("Editor available", !!editor);

  if (editor) {
    test(
      "Editor has registerContentChangeCallback",
      typeof editor.registerContentChangeCallback === "function"
    );

    // Register persistence callback
    let callbackReceived = false;
    const unregister = editor.registerContentChangeCallback((content) => {
      callbackReceived = true;
    });

    // Notify callbacks
    editor.notifyContentChangeCallbacks("test");
    test("Persistence can receive editor callbacks", callbackReceived === true);

    // Cleanup
    unregister();
  }

  // ============================================================
  // 12. SESSION BANNER TESTS
  // ============================================================
  console.log("\n📢 12. Session Banner:");

  test("Session banner element exists", !!persistence.elements.sessionBanner);
  test(
    "Session banner has role=alert",
    persistence.elements.sessionBanner?.getAttribute("role") === "alert"
  );

  // Test banner display
  persistence.showSessionBanner({
    sourceFileName: "banner-test.pdf",
    lastModified: Date.now(),
  });
  test(
    "Session banner can be shown",
    !persistence.elements.sessionBanner?.hidden
  );

  // Dismiss banner
  persistence.dismissBanner();
  test(
    "Session banner can be dismissed",
    persistence.elements.sessionBanner?.hidden === true
  );

  // ============================================================
  // 13. GLOBAL FUNCTION TESTS
  // ============================================================
  console.log("\n🌐 13. Global Functions:");

  test("undoMMDEdit exists", typeof window.undoMMDEdit === "function");
  test("redoMMDEdit exists", typeof window.redoMMDEdit === "function");
  test("restoreOriginalMMD exists", typeof window.restoreOriginalMMD === "function");
  test("clearMMDSession exists", typeof window.clearMMDSession === "function");
  test("restoreMMDSession exists", typeof window.restoreMMDSession === "function");
  test("dismissMMDSessionBanner exists", typeof window.dismissMMDSessionBanner === "function");

  // ============================================================
  // CLEANUP
  // ============================================================
  console.log("\n🧹 Cleanup:");

  cleanupTestSession();
  test(
    "Test session cleaned up",
    localStorage.getItem(MMD_PERSISTENCE_TEST_CONFIG.STORAGE_KEY) === null
  );

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n=======================================");
  console.log(`📊 Results: ${results.passed}/${results.total} tests passed`);

  if (results.failed === 0) {
    console.log("🎉 Phase 5.2 MMD Persistence COMPLETE - All tests passed!");
  } else {
    console.error(`❌ ${results.failed} tests failed:`);
    results.errors.forEach((e) => console.error(`   - ${e}`));
  }

  return results;
};

// ============================================================================
// Quick Validation
// ============================================================================

/**
 * Quick validation for Phase 5.2 implementation
 * @returns {boolean} True if all critical checks pass
 */
window.validatePhase52 = function () {
  console.log("🔍 Phase 5.2 Quick Validation");
  console.log("=============================\n");

  let allPassed = true;

  const check = (name, condition) => {
    const status = condition ? "✅" : "❌";
    console.log(`${status} ${name}`);
    if (!condition) allPassed = false;
    return condition;
  };

  // Critical checks
  check(
    "getMathPixMMDPersistence exists",
    typeof window.getMathPixMMDPersistence === "function"
  );
  check("undoMMDEdit exists", typeof window.undoMMDEdit === "function");
  check("redoMMDEdit exists", typeof window.redoMMDEdit === "function");
  check("restoreOriginalMMD exists", typeof window.restoreOriginalMMD === "function");
  check("clearMMDSession exists", typeof window.clearMMDSession === "function");

  const persistence = window.getMathPixMMDPersistence?.();
  check("Persistence instance created", !!persistence);

  if (persistence) {
    persistence.init();
    check("Persistence initialised", persistence.isInitialised);
    check("Session controls element found", !!persistence.elements.sessionControls);
    check("Undo button element found", !!persistence.elements.undoBtn);
    check("Redo button element found", !!persistence.elements.redoBtn);
  }

  const editor = window.getMathPixMMDEditor?.();
  check(
    "Editor has registerContentChangeCallback",
    typeof editor?.registerContentChangeCallback === "function"
  );

  console.log("\n=============================");
  console.log(
    allPassed ? "🎉 Quick validation PASSED" : "❌ Quick validation FAILED"
  );

  return allPassed;
};

// ============================================================================
// Interactive Demo
// ============================================================================

/**
 * Interactive demo of MMD Persistence functionality
 * @returns {Promise<void>}
 */
window.demoMMDPersistence = async function () {
  console.log("🎬 MMD Persistence Demo");
  console.log("=======================\n");

  const persistence = window.getMathPixMMDPersistence?.();
  const editor = window.getMathPixMMDEditor?.();

  if (!persistence || !editor) {
    console.error("❌ Persistence or Editor not available");
    return;
  }

  // Clean up any existing session
  cleanupTestSession();
  persistence.init();
  editor.init();

  console.log("1. Starting a new session...");
  persistence.startSession(
    MMD_PERSISTENCE_TEST_CONFIG.SAMPLE_MMD,
    "demo-document.pdf"
  );
  await wait(1000);

  console.log("2. Simulating content changes...");
  persistence.handleContentChange(
    MMD_PERSISTENCE_TEST_CONFIG.SAMPLE_MMD + "\n\n## Change 1\nFirst edit."
  );
  await wait(1500);

  console.log("3. Making another change...");
  persistence.handleContentChange(
    MMD_PERSISTENCE_TEST_CONFIG.SAMPLE_MMD + "\n\n## Change 2\nSecond edit."
  );
  await wait(1500);

  console.log("4. Checking session info...");
  console.log("   Session info:", persistence.getSessionInfo());

  console.log("5. Undoing last change...");
  persistence.undo();
  await wait(1000);

  console.log("6. Session info after undo:", persistence.getSessionInfo());

  console.log("7. Redoing change...");
  persistence.redo();
  await wait(1000);

  console.log("8. Restoring original...");
  await persistence.restoreOriginal();
  await wait(1000);

  console.log("\n✅ Demo complete!");
  console.log("💡 Session controls are visible - try the buttons!");
  console.log("💡 Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y (redo)");
};

// ============================================================================
// Undo Stack Stress Test
// ============================================================================

/**
 * Test undo stack limit (10 levels)
 * @returns {Promise<Object>} Test results
 */
window.testUndoStackLimit = async function () {
  console.log("🧪 Undo Stack Limit Test");
  console.log("========================\n");

  const persistence = window.getMathPixMMDPersistence?.();
  if (!persistence) {
    console.error("❌ Persistence not available");
    return { success: false };
  }

  cleanupTestSession();
  persistence.init();

  // Start session
  persistence.startSession("Original content", "stack-test.pdf");

  // Make 15 changes (should only keep 10)
  for (let i = 1; i <= 15; i++) {
    persistence.handleContentChange(`Change ${i}`);
    await wait(1200); // Wait for auto-save
    console.log(`   Made change ${i}, undo stack size: ${persistence.getUndoCount()}`);
  }

  const finalUndoCount = persistence.getUndoCount();
  console.log(`\n📊 Final undo stack size: ${finalUndoCount}`);
  console.log(finalUndoCount === 10 ? "✅ Stack correctly limited to 10" : "❌ Stack limit not working");

  // Cleanup
  cleanupTestSession();

  return { success: finalUndoCount === 10, undoCount: finalUndoCount };
};

// ============================================================================
// Test Aliases
// ============================================================================

window.testMMDPersistence = window.testMMDPersistencePhase52;
window.testPhase52 = window.testMMDPersistencePhase52;
window.testPersistence = window.testMMDPersistencePhase52;