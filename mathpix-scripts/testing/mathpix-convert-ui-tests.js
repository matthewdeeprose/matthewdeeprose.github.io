/**
 * @fileoverview MathPix Convert UI Test Suite
 * @module MathPixConvertUITests
 * @version 1.0.0
 * @since 6.2.0
 *
 * @description
 * Comprehensive test suite for Phase 6.2 Convert UI Section.
 * Tests UI elements, format selection, progress display, download functionality,
 * error handling, and accessibility compliance.
 *
 * Test Commands:
 * - window.testConvertUI() - Run all UI tests (~40 tests)
 * - window.validatePhase62() - Quick validation
 * - window.demoConvertUI() - Interactive demonstration
 * - window.testConvertUIAccessibility() - Accessibility-specific tests
 *
 * @accessibility
 * - Tests verify ARIA attributes
 * - Tests verify keyboard navigation
 * - Tests verify screen reader compatibility
 */

// ============================================================================
// Test Configuration
// ============================================================================

const TEST_CONFIG = {
  verbose: true,
  stopOnFirstFailure: false,
};

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Test result counter
 */
let testsPassed = 0;
let testsFailed = 0;
let testsSkipped = 0;

/**
 * Reset test counters
 */
function resetTestCounters() {
  testsPassed = 0;
  testsFailed = 0;
  testsSkipped = 0;
}

/**
 * Log a test result
 * @param {boolean} passed - Whether test passed
 * @param {string} testName - Name of the test
 * @param {string} [details] - Additional details
 */
function logTestResult(passed, testName, details = "") {
  if (passed) {
    testsPassed++;
    if (TEST_CONFIG.verbose) {
      console.log(`  ✅ ${testName}${details ? ` - ${details}` : ""}`);
    }
  } else {
    testsFailed++;
    console.error(`  ❌ ${testName}${details ? ` - ${details}` : ""}`);
    if (TEST_CONFIG.stopOnFirstFailure) {
      throw new Error(`Test failed: ${testName}`);
    }
  }
}

/**
 * Log a skipped test
 * @param {string} testName - Name of the test
 * @param {string} reason - Reason for skipping
 */
function logTestSkipped(testName, reason) {
  testsSkipped++;
  console.warn(`  ⏭️ ${testName} - SKIPPED: ${reason}`);
}

/**
 * Print test summary
 */
function printTestSummary() {
  const total = testsPassed + testsFailed + testsSkipped;
  console.log("\n" + "=".repeat(50));
  console.log(`📊 Test Summary: ${testsPassed}/${total} passed`);
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`   ⏭️ Skipped: ${testsSkipped}`);
  console.log("=".repeat(50));

  if (testsFailed === 0) {
    console.log("🎉 All tests passed!");
  } else {
    console.log("⚠️ Some tests failed - review errors above");
  }
}

// ============================================================================
// Element Tests
// ============================================================================

/**
 * Test that all required elements exist
 */
function testElementsExist() {
  console.log("\n📋 Testing Element Availability...");

  const requiredElements = [
    { id: "mathpix-convert-section", desc: "Convert section container" },
    { id: "mathpix-convert-btn", desc: "Convert button" },
    { id: "mathpix-convert-cancel-btn", desc: "Cancel button" },
    { id: "convert-status", desc: "Status element" },
    { id: "mathpix-convert-progress", desc: "Progress container" },
    { id: "mathpix-convert-progress-list", desc: "Progress list" },
    { id: "mathpix-convert-downloads", desc: "Downloads container" },
    { id: "mathpix-download-buttons", desc: "Download buttons container" },
    { id: "mathpix-convert-errors", desc: "Errors container" },
    { id: "mathpix-convert-error-list", desc: "Error list" },
  ];

  requiredElements.forEach(({ id, desc }) => {
    const element = document.getElementById(id);
    logTestResult(!!element, `Element exists: ${id}`, desc);
  });

  // Test format checkboxes
  const checkboxes = document.querySelectorAll('input[name="convert-format"]');
  logTestResult(
    checkboxes.length === 7,
    "Format checkboxes exist",
    `Found ${checkboxes.length}/7`
  );

  // Test each format checkbox
  const expectedFormats = [
    "docx",
    "pdf",
    "tex.zip",
    "latex.pdf",
    "html",
    "md",
    "pptx",
  ];
  expectedFormats.forEach((format) => {
    const checkbox = document.getElementById(
      `convert-format-${format.replace(".", "")}`
    );
    // Handle special case for tex.zip -> convert-format-tex
    const altCheckbox = document.querySelector(
      `input[name="convert-format"][value="${format}"]`
    );
    logTestResult(
      !!checkbox || !!altCheckbox,
      `Format checkbox: ${format}`,
      checkbox ? "by ID" : altCheckbox ? "by value" : "not found"
    );
  });
}

// ============================================================================
// Controller Tests
// ============================================================================

/**
 * Test controller instantiation
 */
function testControllerInstantiation() {
  console.log("\n📋 Testing Controller Instantiation...");

  // Test singleton accessor exists
  logTestResult(
    typeof window.getMathPixConvertUI === "function",
    "getMathPixConvertUI function exists"
  );

  // Test class exists
  logTestResult(
    typeof window.MathPixConvertUI === "function",
    "MathPixConvertUI class exists"
  );

  // Test singleton works
  const ui1 = window.getMathPixConvertUI?.();
  const ui2 = window.getMathPixConvertUI?.();
  logTestResult(ui1 === ui2, "Singleton pattern works");

  // Test instance properties
  if (ui1) {
    logTestResult(
      typeof ui1.isInitialised === "boolean",
      "Has isInitialised property"
    );
    logTestResult(
      typeof ui1.isConverting === "boolean",
      "Has isConverting property"
    );
    logTestResult(ui1.elements instanceof Object, "Has elements object");
    logTestResult(
      ui1.completedDownloads instanceof Map,
      "Has completedDownloads Map"
    );
  }
}

/**
 * Test controller methods
 */
function testControllerMethods() {
  console.log("\n📋 Testing Controller Methods...");

  const ui = window.getMathPixConvertUI?.();
  if (!ui) {
    logTestSkipped("All method tests", "Controller not available");
    return;
  }

  // Test method existence
  const requiredMethods = [
    "init",
    "show",
    "hide",
    "reset",
    "getSelectedFormats",
    "getCurrentMMD",
    "startConversion",
    "cancelConversion",
    "setBaseFilename",
    "getState",
  ];

  requiredMethods.forEach((method) => {
    logTestResult(typeof ui[method] === "function", `Method exists: ${method}`);
  });

  // Test getState returns expected shape
  const state = ui.getState();
  logTestResult(
    typeof state.isInitialised === "boolean",
    "getState().isInitialised"
  );
  logTestResult(
    typeof state.isConverting === "boolean",
    "getState().isConverting"
  );
  logTestResult(
    Array.isArray(state.selectedFormats),
    "getState().selectedFormats"
  );
  logTestResult(typeof state.hasMMD === "boolean", "getState().hasMMD");
}

// ============================================================================
// Format Selection Tests
// ============================================================================

/**
 * Test format selection functionality
 */
function testFormatSelection() {
  console.log("\n📋 Testing Format Selection...");

  const ui = window.getMathPixConvertUI?.();
  if (!ui) {
    logTestSkipped("Format selection tests", "Controller not available");
    return;
  }

  // Ensure initialised
  ui.init();

  // Test initial state (nothing selected)
  ui.reset();
  let selected = ui.getSelectedFormats();
  logTestResult(selected.length === 0, "Initial state: no formats selected");

  // Test selecting a format
  const docxCheckbox = document.querySelector(
    'input[name="convert-format"][value="docx"]'
  );
  if (docxCheckbox) {
    docxCheckbox.checked = true;
    docxCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
    selected = ui.getSelectedFormats();
    logTestResult(
      selected.includes("docx"),
      "Single format selection works",
      `Selected: ${selected.join(", ")}`
    );
  } else {
    logTestSkipped("Single format selection", "DOCX checkbox not found");
  }

  // Test selecting multiple formats
  const pdfCheckbox = document.querySelector(
    'input[name="convert-format"][value="pdf"]'
  );
  if (pdfCheckbox) {
    pdfCheckbox.checked = true;
    pdfCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
    selected = ui.getSelectedFormats();
    logTestResult(
      selected.length === 2,
      "Multiple format selection works",
      `Selected: ${selected.join(", ")}`
    );
  }

  // Test deselecting
  if (docxCheckbox) {
    docxCheckbox.checked = false;
    docxCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
    selected = ui.getSelectedFormats();
    logTestResult(
      !selected.includes("docx"),
      "Format deselection works",
      `Selected: ${selected.join(", ")}`
    );
  }

  // Clean up
  ui.reset();
}

// ============================================================================
// Button State Tests
// ============================================================================

/**
 * Test convert button state management
 */
function testButtonState() {
  console.log("\n📋 Testing Button State...");

  const ui = window.getMathPixConvertUI?.();
  const convertBtn = document.getElementById("mathpix-convert-btn");

  if (!ui || !convertBtn) {
    logTestSkipped("Button state tests", "Controller or button not available");
    return;
  }

  ui.init();
  ui.reset();

  // Test disabled when nothing selected
  logTestResult(
    convertBtn.disabled === true,
    "Button disabled when no formats selected"
  );

  // Select a format
  const checkbox = document.querySelector('input[name="convert-format"]');
  if (checkbox) {
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));

    // Button state depends on MMD availability
    const hasMMD = !!ui.getCurrentMMD();
    logTestResult(
      convertBtn.disabled === !hasMMD,
      `Button state correct after selection (hasMMD: ${hasMMD})`
    );
  }

  // Clean up
  ui.reset();
}

// ============================================================================
// Show/Hide Tests
// ============================================================================

/**
 * Test show/hide functionality
 */
function testShowHide() {
  console.log("\n📋 Testing Show/Hide...");

  const ui = window.getMathPixConvertUI?.();
  const section = document.getElementById("mathpix-convert-section");

  if (!ui || !section) {
    logTestSkipped("Show/hide tests", "Controller or section not available");
    return;
  }

  ui.init();

  // Test hide
  ui.hide();
  logTestResult(section.hidden === true, "Hide sets hidden=true");

  // Test show
  ui.show();
  logTestResult(section.hidden === false, "Show sets hidden=false");

  // Test isVisible
  logTestResult(ui.isVisible() === true, "isVisible() returns true when shown");

  ui.hide();
  logTestResult(
    ui.isVisible() === false,
    "isVisible() returns false when hidden"
  );
}

// ============================================================================
// Global Function Tests
// ============================================================================

/**
 * Test global functions
 */
function testGlobalFunctions() {
  console.log("\n📋 Testing Global Functions...");

  logTestResult(
    typeof window.startMMDConversion === "function",
    "startMMDConversion exists"
  );
  logTestResult(
    typeof window.cancelMMDConversion === "function",
    "cancelMMDConversion exists"
  );
  logTestResult(
    typeof window.showConvertSection === "function",
    "showConvertSection exists"
  );
  logTestResult(
    typeof window.hideConvertSection === "function",
    "hideConvertSection exists"
  );
  logTestResult(
    typeof window.resetConvertSection === "function",
    "resetConvertSection exists"
  );
}

// ============================================================================
// Integration Tests
// ============================================================================

/**
 * Test integration with Phase 6.1 API client
 */
function testAPIClientIntegration() {
  console.log("\n📋 Testing API Client Integration...");

  // Check Phase 6.1 client availability
  logTestResult(
    typeof window.getMathPixConvertClient === "function",
    "Phase 6.1 client accessor exists"
  );

  const client = window.getMathPixConvertClient?.();
  if (client) {
    logTestResult(
      typeof client.validateMMD === "function",
      "Client has validateMMD method"
    );
    logTestResult(
      typeof client.getSupportedFormats === "function",
      "Client has getSupportedFormats method"
    );
    logTestResult(
      typeof client.convertAndDownload === "function",
      "Client has convertAndDownload method"
    );
  } else {
    logTestSkipped("API client method tests", "Client not available");
  }
}

// ============================================================================
// Accessibility Tests
// ============================================================================

/**
 * Test accessibility attributes
 */
function testAccessibility() {
  console.log("\n📋 Testing Accessibility...");

  // Test section has proper heading
  const section = document.getElementById("mathpix-convert-section");
  const heading = document.getElementById("mathpix-convert-heading");
  logTestResult(
    section?.getAttribute("aria-labelledby") === "mathpix-convert-heading",
    "Section has aria-labelledby"
  );
  logTestResult(!!heading, "Heading element exists");

  // Test fieldset has legend
  const fieldset = document.querySelector(".mathpix-convert-format-selection");
  const legend = fieldset?.querySelector("legend");
  logTestResult(!!legend, "Fieldset has legend");

  // Test button has aria-describedby
  const convertBtn = document.getElementById("mathpix-convert-btn");
  logTestResult(
    convertBtn?.getAttribute("aria-describedby") === "convert-status",
    "Convert button has aria-describedby"
  );

  // Test status has aria-live
  const status = document.getElementById("convert-status");
  logTestResult(
    status?.getAttribute("aria-live") === "polite",
    "Status has aria-live=polite"
  );

  // Test progress has role=region
  const progress = document.getElementById("mathpix-convert-progress");
  logTestResult(
    progress?.getAttribute("role") === "region",
    "Progress has role=region"
  );

  // Test downloads has role=region
  const downloads = document.getElementById("mathpix-convert-downloads");
  logTestResult(
    downloads?.getAttribute("role") === "region",
    "Downloads has role=region"
  );

  // Test errors has role=alert
  const errors = document.getElementById("mathpix-convert-errors");
  logTestResult(
    errors?.getAttribute("role") === "alert",
    "Errors has role=alert"
  );

  // Test visually hidden elements
  const visuallyHidden = document.querySelectorAll(
    "#mathpix-convert-progress .visually-hidden"
  );
  logTestResult(
    visuallyHidden.length > 0,
    "Has visually hidden elements for screen readers"
  );
}

// ============================================================================
// Main Test Runners
// ============================================================================

/**
 * Run all Convert UI tests
 * @returns {Object} Test results
 */
window.testConvertUI = function () {
  console.log("\n" + "=".repeat(50));
  console.log("🧪 MathPix Convert UI Test Suite (Phase 6.2)");
  console.log("=".repeat(50));

  resetTestCounters();

  try {
    testElementsExist();
    testControllerInstantiation();
    testControllerMethods();
    testFormatSelection();
    testButtonState();
    testShowHide();
    testGlobalFunctions();
    testAPIClientIntegration();
    testAccessibility();
  } catch (error) {
    console.error("Test suite error:", error);
  }

  printTestSummary();

  return {
    passed: testsPassed,
    failed: testsFailed,
    skipped: testsSkipped,
    total: testsPassed + testsFailed + testsSkipped,
  };
};

/**
 * Quick validation for Phase 6.2
 * @returns {boolean} True if basic validation passes
 */
window.validatePhase62 = function () {
  console.log("\n" + "=".repeat(50));
  console.log("✅ Phase 6.2 Quick Validation");
  console.log("=".repeat(50));

  const checks = [
    {
      name: "Convert section exists",
      pass: !!document.getElementById("mathpix-convert-section"),
    },
    {
      name: "Controller available",
      pass: typeof window.getMathPixConvertUI === "function",
    },
    {
      name: "Controller instantiates",
      pass: !!window.getMathPixConvertUI?.(),
    },
    {
      name: "Format checkboxes exist",
      pass:
        document.querySelectorAll('input[name="convert-format"]').length > 0,
    },
    {
      name: "Convert button exists",
      pass: !!document.getElementById("mathpix-convert-btn"),
    },
    {
      name: "API client available",
      pass: typeof window.getMathPixConvertClient === "function",
    },
    {
      name: "startMMDConversion global function",
      pass: typeof window.startMMDConversion === "function",
    },
  ];

  let allPassed = true;
  checks.forEach(({ name, pass }) => {
    console.log(`${pass ? "✅" : "❌"} ${name}`);
    if (!pass) allPassed = false;
  });

  console.log(
    "\n" + (allPassed ? "🎉 Validation PASSED" : "⚠️ Validation FAILED")
  );
  return allPassed;
};

/**
 * Interactive demonstration of the Convert UI
 */
window.demoConvertUI = function () {
  console.log("\n" + "=".repeat(50));
  console.log("🎬 Convert UI Demo");
  console.log("=".repeat(50));

  const ui = window.getMathPixConvertUI?.();
  if (!ui) {
    console.error("❌ Convert UI not available");
    return;
  }

  // Initialise and show
  ui.init();
  ui.show();
  console.log("✅ Convert section shown");

  // Pre-select some formats
  const formats = ["docx", "pdf"];
  formats.forEach((format) => {
    const checkbox = document.querySelector(
      `input[name="convert-format"][value="${format}"]`
    );
    if (checkbox) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  console.log(`✅ Pre-selected formats: ${formats.join(", ")}`);

  // Show current state
  console.log("\n📊 Current State:");
  console.log(JSON.stringify(ui.getState(), null, 2));

  console.log("\n💡 Demo complete! The convert section is now visible.");
  console.log(
    "   Select formats and click 'Convert Selected' to test conversion."
  );
  console.log("   Note: Requires valid MathPix API credentials.");
};

/**
 * Run accessibility-specific tests
 */
window.testConvertUIAccessibility = function () {
  console.log("\n" + "=".repeat(50));
  console.log("♿ Convert UI Accessibility Tests");
  console.log("=".repeat(50));

  resetTestCounters();

  try {
    testAccessibility();

    // Additional detailed accessibility tests
    console.log("\n📋 Testing Keyboard Navigation...");

    // Test that checkboxes are focusable
    const checkboxes = document.querySelectorAll(
      'input[name="convert-format"]'
    );
    checkboxes.forEach((cb, i) => {
      logTestResult(
        cb.tabIndex >= 0 || !cb.hasAttribute("tabindex"),
        `Checkbox ${i + 1} is keyboard accessible`
      );
    });

    // Test buttons are focusable
    const buttons = document.querySelectorAll(
      "#mathpix-convert-section button:not([hidden])"
    );
    buttons.forEach((btn, i) => {
      logTestResult(
        btn.tabIndex >= 0 || !btn.hasAttribute("tabindex"),
        `Button ${i + 1} is keyboard accessible`
      );
    });

    // Test icons are hidden from screen readers
    console.log("\n📋 Testing Icon Accessibility...");
    const icons = document.querySelectorAll(
      "#mathpix-convert-section [aria-hidden='true']"
    );
    logTestResult(icons.length > 0, "Icons have aria-hidden=true");

    // Test minimum touch targets (44x44px)
    console.log("\n📋 Testing Touch Targets...");
    const interactiveElements = document.querySelectorAll(
      "#mathpix-convert-section button, #mathpix-convert-section input, #mathpix-convert-section label.mathpix-convert-format-option"
    );
    let smallTargets = 0;
    interactiveElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) {
        smallTargets++;
      }
    });
    logTestResult(
      smallTargets === 0,
      "All touch targets meet 44x44px minimum",
      smallTargets > 0 ? `${smallTargets} elements too small` : ""
    );
  } catch (error) {
    console.error("Accessibility test error:", error);
  }

  printTestSummary();
};

// ============================================================================
// Auto-run validation on load (optional)
// ============================================================================

// Uncomment to auto-run validation
// if (document.readyState === 'complete') {
//   window.validatePhase62();
// } else {
//   window.addEventListener('load', () => window.validatePhase62());
// }
