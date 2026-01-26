/**
 * @fileoverview MathPix MMD Editor Tests - Phase 5.1 Validation Suite
 * @module MathPixMMDEditorTests
 * @version 5.1.0
 * @since 5.1.0
 *
 * @description
 * Comprehensive test suite for the MMD Editor feature (Phase 5.1).
 * Tests in-place editing functionality, live preview synchronisation,
 * accessibility compliance, and integration with existing systems.
 *
 * Test Categories:
 * 1. Initialisation - Module creation and setup
 * 2. Element Caching - DOM element references
 * 3. Button State - Edit button visibility and text
 * 4. Toggle Edit Mode - Start/stop editing workflow
 * 5. Content Sync - Textarea ↔ code element synchronisation
 * 6. View Restrictions - Edit only in code/split views
 * 7. Accessibility - ARIA attributes and announcements
 * 8. Keyboard Shortcuts - Escape key handling
 * 9. Global Functions - Window-level function exposure
 * 10. Controller Integration - notifyMMDContentAvailable()
 * 11. Cleanup - State reset verification
 *
 * Usage:
 *   await testMMDEditorPhase51()     // Full test suite
 *   validatePhase51()                 // Quick validation
 *   await demoMMDEditor()             // Interactive demo
 */

// ============================================================================
// Test Configuration
// ============================================================================

const MMD_EDITOR_TEST_CONFIG = {
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
  TIMEOUT_SHORT: 100,
  TIMEOUT_MEDIUM: 500,
  TIMEOUT_LONG: 1000,
};

// ============================================================================
// Main Test Suite
// ============================================================================

/**
 * Comprehensive Phase 5.1 MMD Editor Test Suite
 * @returns {Promise<Object>} Test results with pass/fail counts
 */
window.testMMDEditorPhase51 = async function () {
  console.log("🧪 MMD Editor Phase 5.1 Test Suite");
  console.log("==================================\n");

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

  // ============================================================
  // 1. INITIALISATION TESTS
  // ============================================================
  console.log("\n📦 1. Initialisation:");

  test(
    "getMathPixMMDEditor function exists",
    typeof window.getMathPixMMDEditor === "function"
  );

  const editor = window.getMathPixMMDEditor?.();
  test("Editor instance created", !!editor);

  if (!editor) {
    console.error("❌ Cannot continue without editor instance");
    return results;
  }

  // Initialise if not already done
  if (!editor.isInitialised) {
    editor.init();
  }

  test("Editor initialised flag set", editor.isInitialised === true);
  test("Elements cached flag set", editor.elementsCached === true);

  // ============================================================
  // 2. ELEMENT CACHING TESTS
  // ============================================================
  console.log("\n🗂️ 2. Element Caching:");

  const requiredElements = [
    "editBtn",
    "codeContainer",
    "codeElement",
    "editorWrapper",
    "textarea",
    "statusElement",
    "contentArea",
  ];

  requiredElements.forEach((name) => {
    test(`Element cached: ${name}`, !!editor.elements[name]);
  });

  // ============================================================
  // 3. BUTTON STATE TESTS
  // ============================================================
  console.log("\n🔘 3. Button State:");

  const editBtn = editor.elements.editBtn;

  test("Edit button exists", !!editBtn);
  test("Edit button initially hidden (no content)", editBtn?.hidden === true);
  test(
    "Edit button has aria-pressed attribute",
    editBtn?.hasAttribute("aria-pressed")
  );
  test(
    'Edit button aria-pressed is "false"',
    editBtn?.getAttribute("aria-pressed") === "false"
  );

  // ============================================================
  // 4. TOGGLE EDIT MODE TESTS
  // ============================================================
  console.log("\n✏️ 4. Toggle Edit Mode:");

  // First, add sample content and show button
  const codeElement = editor.elements.codeElement;
  if (codeElement) {
    codeElement.textContent = MMD_EDITOR_TEST_CONFIG.SAMPLE_MMD;
  }

  // Ensure we're in code view
  const preview = window.getMathPixMMDPreview?.();
  if (preview) {
    await preview.switchView("code");
  }

  // Show the button (simulating content available)
  editor.showEditButton();

  test("Edit button visible after showEditButton()", !editBtn?.hidden);

  // Start editing
  editor.startEditing();

  test("isEditing flag set after startEditing()", editor.isEditing === true);
  test(
    'aria-pressed="true" after startEditing()',
    editBtn?.getAttribute("aria-pressed") === "true"
  );
  test(
    'Button text changed to "Stop Editing"',
    editBtn?.textContent?.includes("Stop")
  );
  test(
    'Code container has data-editing="true"',
    editor.elements.codeContainer?.dataset.editing === "true"
  );
  test("Editor wrapper visible", !editor.elements.editorWrapper?.hidden);

  // Stop editing
  editor.stopEditing();

  test(
    "isEditing flag cleared after stopEditing()",
    editor.isEditing === false
  );
  test(
    'aria-pressed="false" after stopEditing()',
    editBtn?.getAttribute("aria-pressed") === "false"
  );
  test(
    'Button text changed back to "Edit MMD"',
    editBtn?.textContent?.includes("Edit")
  );
  test(
    "Code container data-editing cleared",
    editor.elements.codeContainer?.dataset.editing !== "true"
  );
  test("Editor wrapper hidden", editor.elements.editorWrapper?.hidden === true);

  // ============================================================
  // 5. CONTENT SYNC TESTS
  // ============================================================
  console.log("\n🔄 5. Content Sync:");

  // Start editing again
  editor.startEditing();

  const textarea = editor.elements.textarea;
  test(
    "Textarea populated with code content",
    textarea?.value === MMD_EDITOR_TEST_CONFIG.SAMPLE_MMD
  );

  // Modify textarea content
  const modifiedContent =
    MMD_EDITOR_TEST_CONFIG.SAMPLE_MMD + "\n\n## New Section\n\nAdded content.";
  if (textarea) {
    textarea.value = modifiedContent;
  }

  // Stop editing (should sync back)
  editor.stopEditing();

  test(
    "Code element updated after sync",
    codeElement?.textContent === modifiedContent
  );

  // ============================================================
  // 6. VIEW RESTRICTION TESTS
  // ============================================================
  console.log("\n👁️ 6. View Restrictions:");

  if (preview) {
    // Test code view - should allow editing
    await preview.switchView("code");
    await new Promise((r) =>
      setTimeout(r, MMD_EDITOR_TEST_CONFIG.TIMEOUT_SHORT)
    );

    test("Edit button visible in code view", !editBtn?.hidden);

    // Test split view - should allow editing
    await preview.switchView("split");
    await new Promise((r) =>
      setTimeout(r, MMD_EDITOR_TEST_CONFIG.TIMEOUT_SHORT)
    );

    test("Edit button visible in split view", !editBtn?.hidden);

    // Test preview view - should hide editing
    await preview.switchView("preview");
    await new Promise((r) =>
      setTimeout(r, MMD_EDITOR_TEST_CONFIG.TIMEOUT_SHORT)
    );

    test("Edit button hidden in preview view", editBtn?.hidden === true);

    // Return to code view for remaining tests
    await preview.switchView("code");
    await new Promise((r) =>
      setTimeout(r, MMD_EDITOR_TEST_CONFIG.TIMEOUT_SHORT)
    );
  } else {
    console.log(
      "⚠️ Preview module not available - skipping view restriction tests"
    );
  }

  // ============================================================
  // 7. ACCESSIBILITY TESTS
  // ============================================================
  console.log("\n♿ 7. Accessibility:");

  test(
    "Textarea has associated label",
    !!document.querySelector('label[for="mmd-editor-textarea"]')
  );
  test(
    "Textarea has aria-describedby",
    textarea?.hasAttribute("aria-describedby")
  );
  test(
    "Status element exists for announcements",
    !!editor.elements.statusElement
  );
  test(
    "Status element has aria-live",
    editor.elements.statusElement?.getAttribute("aria-live") === "polite"
  );

  // Test announcement
  editor.announceStatus("Test announcement");
  await new Promise((r) => setTimeout(r, MMD_EDITOR_TEST_CONFIG.TIMEOUT_SHORT));
  test(
    "Status element receives announcements",
    editor.elements.statusElement?.textContent === "Test announcement"
  );

  // ============================================================
  // 8. KEYBOARD SHORTCUT TESTS
  // ============================================================
  console.log("\n⌨️ 8. Keyboard Shortcuts:");

  // Start editing
  editor.startEditing();
  test("Editing started for keyboard test", editor.isEditing === true);

  // Simulate Escape key
  const escapeEvent = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });

  textarea?.dispatchEvent(escapeEvent);
  await new Promise((r) => setTimeout(r, MMD_EDITOR_TEST_CONFIG.TIMEOUT_SHORT));

  test("Escape key exits edit mode", editor.isEditing === false);

  // ============================================================
  // 9. GLOBAL FUNCTION TESTS
  // ============================================================
  console.log("\n🌐 9. Global Functions:");

  test(
    "toggleMMDEdit function exists",
    typeof window.toggleMMDEdit === "function"
  );
  test(
    "getMathPixMMDEditor function exists",
    typeof window.getMathPixMMDEditor === "function"
  );

  // Test toggle function
  const wasEditing = editor.isEditing;
  window.toggleMMDEdit();
  await new Promise((r) => setTimeout(r, MMD_EDITOR_TEST_CONFIG.TIMEOUT_SHORT));

  test("toggleMMDEdit changes edit state", editor.isEditing !== wasEditing);

  // Toggle back
  window.toggleMMDEdit();

  // ============================================================
  // 10. CONTROLLER INTEGRATION TESTS
  // ============================================================
  console.log("\n🔗 10. Controller Integration:");

  const controller = window.getMathPixController?.();
  test("Controller available", !!controller);

  if (controller) {
    test(
      "notifyMMDContentAvailable method exists",
      typeof controller.notifyMMDContentAvailable === "function"
    );

    // Hide button first
    editor.hideEditButton();
    test("Edit button hidden before notification", editBtn?.hidden === true);

    // Call notification method
    controller.notifyMMDContentAvailable();
    await new Promise((r) =>
      setTimeout(r, MMD_EDITOR_TEST_CONFIG.TIMEOUT_SHORT)
    );

    // Button should be visible if we're in an allowed view
    const currentView = preview?.getCurrentView() || "code";
    const shouldBeVisible = ["code", "split"].includes(currentView);
    test(
      `Edit button ${
        shouldBeVisible ? "visible" : "hidden"
      } after notification (view: ${currentView})`,
      shouldBeVisible ? !editBtn?.hidden : editBtn?.hidden
    );
  } else {
    console.log("⚠️ Controller not available - skipping integration tests");
  }

  // ============================================================
  // 11. CLEANUP TESTS
  // ============================================================
  console.log("\n🧹 11. Cleanup:");

  // Ensure we're not editing
  if (editor.isEditing) {
    editor.stopEditing();
  }

  test("Final state: not editing", editor.isEditing === false);
  test(
    "Final state: editor wrapper hidden",
    editor.elements.editorWrapper?.hidden === true
  );

  // Cleanup test content
  if (codeElement) {
    codeElement.textContent = "";
  }
  editor.hideEditButton();

  test("Final state: edit button hidden", editBtn?.hidden === true);

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n==================================");
  console.log(`📊 Results: ${results.passed}/${results.total} tests passed`);

  if (results.failed === 0) {
    console.log("🎉 Phase 5.1 MMD Editor COMPLETE - All tests passed!");
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
 * Quick validation for Phase 5.1 implementation
 * @returns {boolean} True if all critical checks pass
 */
window.validatePhase51 = function () {
  console.log("🔍 Phase 5.1 Quick Validation");
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
    "getMathPixMMDEditor exists",
    typeof window.getMathPixMMDEditor === "function"
  );
  check("toggleMMDEdit exists", typeof window.toggleMMDEdit === "function");

  const editor = window.getMathPixMMDEditor?.();
  check("Editor instance created", !!editor);

  if (editor) {
    editor.init();
    check("Editor initialised", editor.isInitialised);
    check("Edit button element found", !!editor.elements.editBtn);
    check("Textarea element found", !!editor.elements.textarea);
  }

  const controller = window.getMathPixController?.();
  check(
    "Controller notifyMMDContentAvailable exists",
    typeof controller?.notifyMMDContentAvailable === "function"
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
 * Interactive demo of MMD Editor functionality
 * @returns {Promise<void>}
 */
window.demoMMDEditor = async function () {
  console.log("🎬 MMD Editor Demo");
  console.log("==================\n");

  const editor = window.getMathPixMMDEditor?.();
  const preview = window.getMathPixMMDPreview?.();

  if (!editor) {
    console.error("❌ Editor not available");
    return;
  }

  editor.init();

  // Ensure code view
  if (preview) {
    console.log("1. Switching to code view...");
    await preview.switchView("code");
    await new Promise((r) => setTimeout(r, 500));
  }

  // Add sample content
  console.log("2. Adding sample MMD content...");
  const codeElement = editor.elements.codeElement;
  if (codeElement) {
    codeElement.textContent = MMD_EDITOR_TEST_CONFIG.SAMPLE_MMD;

    // Apply Prism highlighting
    if (window.Prism) {
      window.Prism.highlightElement(codeElement);
    }
  }

  // Show edit button
  console.log("3. Showing edit button...");
  editor.showEditButton();
  await new Promise((r) => setTimeout(r, 1000));

  // Start editing
  console.log("4. Starting edit mode...");
  editor.startEditing();
  await new Promise((r) => setTimeout(r, 2000));

  // Make a change
  console.log("5. Making a change to content...");
  if (editor.elements.textarea) {
    editor.elements.textarea.value +=
      "\n\n## Demo Addition\n\nThis was added during the demo!";
  }
  await new Promise((r) => setTimeout(r, 1500));

  // Stop editing
  console.log("6. Stopping edit mode (syncing changes)...");
  editor.stopEditing();
  await new Promise((r) => setTimeout(r, 1000));

  console.log("\n✅ Demo complete!");
  console.log(
    "💡 The content was modified and synced back to the code element."
  );
  console.log('💡 Try clicking "Edit MMD" button to edit manually.');
};

// ============================================================================
// Test Aliases
// ============================================================================

window.testMMDEditor = window.testMMDEditorPhase51;
window.testPhase51 = window.testMMDEditorPhase51;
