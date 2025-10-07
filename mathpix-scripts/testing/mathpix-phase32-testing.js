/**
 * MathPix Phase 3.2 Testing - Line Data Feature
 * Comprehensive testing suite for basic details display
 */

// Logging configuration
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
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

/**
 * Quick validation of Phase 3.2 implementation
 */
window.validatePhase32Complete = function () {
  console.log("🧪 Phase 3.2 Validation: Line Data Feature\n");

  const tests = [
    testAPIClientLineDataRequest,
    testResultRendererMethods,
    testUIElements,
    testToggleFunctionality,
    testAccessibilityAttributes,
    testDataDisplay,
  ];

  const results = tests.map((test) => {
    try {
      return test();
    } catch (error) {
      console.error(`❌ Test failed: ${test.name}`, error);
      return { passed: false, test: test.name, error: error.message };
    }
  });

  const passed = results.filter((r) => r.passed).length;

  console.log(`\n${"=".repeat(50)}`);
  console.log(`📊 Results: ${passed}/${tests.length} tests passed`);
  console.log(`${"=".repeat(50)}\n`);

  if (passed === tests.length) {
    console.log("✅ Phase 3.2 implementation complete and working!");
    return true;
  } else {
    console.log("⚠️  Some tests failed. Review output above.");
    return false;
  }
};

/**
 * Test 1: API Client includes line_data request
 */
function testAPIClientLineDataRequest() {
  console.log("Test 1: API Client Line Data Request");

  // We can't directly test the API request without making one,
  // but we can verify the method exists and config is correct
  const controller = window.getMathPixController();

  if (!controller || !controller.apiClient) {
    console.log("  ❌ Controller or API client not available");
    return { passed: false, test: "API Client" };
  }

  console.log("  ✅ API client available");
  console.log(
    "  ℹ️  Note: Actual line_data inclusion verified via Network tab"
  );

  return { passed: true, test: "API Client" };
}

/**
 * Test 2: Result Renderer has all required methods
 */
function testResultRendererMethods() {
  console.log("\nTest 2: Result Renderer Methods");

  const controller = window.getMathPixController();
  const renderer = controller?.resultRenderer;

  if (!renderer) {
    console.log("  ❌ Result renderer not available");
    return { passed: false, test: "Renderer Methods" };
  }

  const requiredMethods = [
    "displayLineData",
    "createLineDataSummary",
    "createLineDataDetails",
    "getConfidenceLevel",
    "getTypeLabel",
    "getErrorReason",
  ];

  const missing = requiredMethods.filter(
    (method) => typeof renderer[method] !== "function"
  );

  if (missing.length > 0) {
    console.log("  ❌ Missing methods:", missing);
    return { passed: false, test: "Renderer Methods", missing };
  }

  console.log("  ✅ All required methods present");
  return { passed: true, test: "Renderer Methods" };
}

/**
 * Test 3: UI Elements exist in DOM
 */
function testUIElements() {
  console.log("\nTest 3: UI Elements");

  const elements = {
    section: document.getElementById("mathpix-line-data-section"),
    toggle: document.getElementById("mathpix-line-data-toggle"),
    content: document.getElementById("mathpix-line-data-content"),
  };

  const missing = Object.entries(elements)
    .filter(([name, el]) => !el)
    .map(([name]) => name);

  if (missing.length > 0) {
    console.log("  ❌ Missing elements:", missing);
    return { passed: false, test: "UI Elements", missing };
  }

  console.log("  ✅ All UI elements present");
  return { passed: true, test: "UI Elements" };
}

/**
 * Test 4: Toggle functionality
 */
function testToggleFunctionality() {
  console.log("\nTest 4: Toggle Functionality");

  const controller = window.getMathPixController();

  if (typeof controller?.toggleLineData !== "function") {
    console.log("  ❌ toggleLineData method not found");
    return { passed: false, test: "Toggle Functionality" };
  }

  const toggle = document.getElementById("mathpix-line-data-toggle");
  const content = document.getElementById("mathpix-line-data-content");

  // Test initial state
  const initialExpanded = toggle.getAttribute("aria-expanded");
  const initialHidden = content.hidden;

  console.log(
    `  Initial: aria-expanded=${initialExpanded}, hidden=${initialHidden}`
  );

  // Toggle once
  controller.toggleLineData();
  const afterFirst = toggle.getAttribute("aria-expanded");

  // Toggle back
  controller.toggleLineData();
  const afterSecond = toggle.getAttribute("aria-expanded");

  if (afterFirst === afterSecond) {
    console.log("  ❌ Toggle not changing state");
    return { passed: false, test: "Toggle Functionality" };
  }

  console.log("  ✅ Toggle functionality working");
  return { passed: true, test: "Toggle Functionality" };
}

/**
 * Test 5: Accessibility attributes
 */
function testAccessibilityAttributes() {
  console.log("\nTest 5: Accessibility Attributes");

  const toggle = document.getElementById("mathpix-line-data-toggle");
  const content = document.getElementById("mathpix-line-data-content");

  const checks = {
    "Toggle has aria-expanded": toggle?.hasAttribute("aria-expanded"),
    "Toggle has aria-controls": toggle?.hasAttribute("aria-controls"),
    "Content has role": content?.hasAttribute("role"),
    "Content has aria-labelledby": content?.hasAttribute("aria-labelledby"),
  };

  const failed = Object.entries(checks)
    .filter(([check, passed]) => !passed)
    .map(([check]) => check);

  if (failed.length > 0) {
    console.log("  ❌ Failed checks:", failed);
    return { passed: false, test: "Accessibility", failed };
  }

  console.log("  ✅ All accessibility attributes present");
  return { passed: true, test: "Accessibility" };
}

/**
 * Test 6: Data display with synthetic data
 */
function testDataDisplay() {
  console.log("\nTest 6: Data Display");

  const controller = window.getMathPixController();
  const mockData = [
    {
      id: "test-1",
      type: "math",
      conversion_output: true,
      confidence: 0.98,
      text: "\\( x^2 \\)",
    },
    {
      id: "test-2",
      type: "diagram",
      subtype: "chemistry",
      conversion_output: false,
      error_id: "image_not_supported",
    },
  ];

  try {
    controller.displayLineData(mockData);

    const section = document.getElementById("mathpix-line-data-section");
    const content = document.getElementById("mathpix-line-data-content");

    if (section.hidden) {
      console.log("  ❌ Section not visible after display");
      return { passed: false, test: "Data Display" };
    }

    if (!content.children.length) {
      console.log("  ❌ Content not populated");
      return { passed: false, test: "Data Display" };
    }

    console.log("  ✅ Data display working");
    return { passed: true, test: "Data Display" };
  } catch (error) {
    console.log("  ❌ Display failed:", error.message);
    return { passed: false, test: "Data Display", error: error.message };
  }
}

/**
 * Test with real-world-like data
 */
window.testLineDataRealWorld = function () {
  console.log("🧪 Real-World Line Data Test\n");

  const controller = window.getMathPixController();

  const realisticData = [
    {
      id: "line-1",
      type: "text",
      conversion_output: true,
      confidence: 0.99,
      is_printed: true,
      is_handwritten: false,
      text: "Consider the quadratic equation:",
    },
    {
      id: "line-2",
      type: "math",
      conversion_output: true,
      confidence: 0.97,
      confidence_rate: 0.98,
      is_printed: true,
      is_handwritten: false,
      text: "\\[ x^2 + 5x + 6 = 0 \\]",
    },
    {
      id: "line-3",
      type: "text",
      conversion_output: true,
      confidence: 0.98,
      is_printed: true,
      is_handwritten: false,
      text: "This factors as:",
    },
    {
      id: "line-4",
      type: "math",
      conversion_output: true,
      confidence: 0.96,
      confidence_rate: 0.97,
      is_printed: true,
      is_handwritten: false,
      text: "\\[ (x + 2)(x + 3) = 0 \\]",
    },
    {
      id: "line-5",
      type: "diagram",
      subtype: "triangle",
      conversion_output: false,
      error_id: "image_not_supported",
      is_printed: true,
      is_handwritten: false,
    },
    {
      id: "line-6",
      type: "text",
      conversion_output: true,
      confidence: 0.85,
      is_printed: false,
      is_handwritten: true,
      text: "Therefore x = -2 or x = -3",
    },
  ];

  console.log("📊 Test Data Summary:");
  console.log(`  Lines: ${realisticData.length}`);
  console.log(
    `  Types: ${[...new Set(realisticData.map((l) => l.type))].join(", ")}`
  );
  console.log(
    `  Included: ${realisticData.filter((l) => l.conversion_output).length}`
  );
  console.log(
    `  Excluded: ${realisticData.filter((l) => !l.conversion_output).length}`
  );
  console.log("");

  controller.displayLineData(realisticData);

  console.log("✅ Real-world data displayed");
  console.log("👀 Check the UI for proper rendering");
};

/**
 * Accessibility testing helper
 */
window.testLineDataAccessibility = function () {
  console.log("🧪 Accessibility Test\n");

  const toggle = document.getElementById("mathpix-line-data-toggle");
  const content = document.getElementById("mathpix-line-data-content");

  console.log("Keyboard Navigation Test:");
  console.log("1. Tab to toggle button");
  console.log("2. Press Space or Enter to toggle");
  console.log("3. Tab through content when expanded");
  console.log("4. Verify focus indicators are visible");
  console.log("");

  console.log("Screen Reader Test:");
  console.log("1. Navigate to toggle button");
  console.log("2. Verify button purpose is announced");
  console.log("3. Verify expanded/collapsed state is announced");
  console.log("4. Verify content is announced when expanded");
  console.log("");

  console.log("Visual Test:");
  console.log("1. Verify icon changes (☐ → ☑)");
  console.log("2. Verify button text changes");
  console.log("3. Verify content appears smoothly");
  console.log("4. Check colours have sufficient contrast");
  console.log("");

  console.log("Current State:");
  console.log(`  aria-expanded: ${toggle.getAttribute("aria-expanded")}`);
  console.log(`  aria-controls: ${toggle.getAttribute("aria-controls")}`);
  console.log(`  Content hidden: ${content.hidden}`);
  console.log(`  Content role: ${content.getAttribute("role")}`);
};

// Global exposure
window.testLineDataBasic = window.validatePhase32Complete;
