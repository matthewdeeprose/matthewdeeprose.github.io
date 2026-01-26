/**
 * @fileoverview MathPix Session Restorer Test Suite
 * @module mathpix-session-restorer-tests
 * @version 1.1.0
 * @since 8.2.0
 *
 * @description
 * Comprehensive testing suite for MathPix Session Restorer functionality.
 * Includes tests for:
 * - Core functionality (Phase 8.2)
 * - Session recovery bug fixes (Bug 3 & Bug 4)
 * - Content preview feature
 * - Version switching workflow
 *
 * @usage
 * Include this file after mathpix-session-restorer.js in your HTML.
 * Run tests via browser console:
 *   - window.testSessionRestorer() - Full functionality tests
 *   - window.validatePhase82() - Quick Phase 8.2 validation
 *   - window.validateSessionRecoveryFixes() - Bug fix validation
 *   - window.runAllSessionRestorerTests() - Run everything
 *
 * @accessibility
 * Test results are logged to console with emoji indicators for quick scanning.
 * All tests use semantic naming for screen reader compatibility.
 */

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
    console.error(`[SessionRestorerTests] ${message}`, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[SessionRestorerTests] ${message}`, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[SessionRestorerTests] ${message}`, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[SessionRestorerTests] ${message}`, ...args);
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Create test results object
 * @returns {Object} Fresh test results object
 */
function createTestResults() {
  return {
    passed: 0,
    failed: 0,
    tests: [],
  };
}

/**
 * Run a single test and record result
 * @param {Object} results - Test results object to update
 * @param {string} name - Test name
 * @param {boolean} condition - Test condition
 */
function runTest(results, name, condition) {
  const passed = !!condition;
  results.tests.push({ name, passed });
  if (passed) {
    results.passed++;
    console.log(`✅ ${name}`);
  } else {
    results.failed++;
    console.log(`❌ ${name}`);
  }
}

/**
 * Print test summary
 * @param {Object} results - Test results object
 * @param {string} [suiteName] - Optional suite name
 */
function printTestSummary(results, suiteName = "Tests") {
  const total = results.passed + results.failed;
  const status = results.failed === 0 ? "✅ PASSED" : "❌ FAILED";
  console.log(
    `\n📊 ${suiteName}: ${results.passed}/${total} tests passed ${status}`
  );
}

// ============================================================================
// CORE FUNCTIONALITY TESTS (Phase 8.2)
// ============================================================================

/**
 * Test session restorer core functionality
 * @returns {Promise<Object>} Test results
 */
window.testSessionRestorer = async function () {
  console.log("🧪 Testing MathPix Session Restorer Core Functionality...\n");

  const results = createTestResults();
  const test = (name, condition) => runTest(results, name, condition);

  // Get instance
  const restorer = window.getMathPixSessionRestorer?.();

  // Basic availability tests
  test("Class available on window", !!window.MathPixSessionRestorer);
  test(
    "Getter available on window",
    typeof window.getMathPixSessionRestorer === "function"
  );
  test("Instance created", !!restorer);
  test("Is initialised", restorer?.isInitialised);

  // Core method tests
  test("Has initialise method", typeof restorer?.initialise === "function");
  test("Has show method", typeof restorer?.show === "function");
  test("Has hide method", typeof restorer?.hide === "function");
  test(
    "Has handleZIPFile method",
    typeof restorer?.handleZIPFile === "function"
  );
  test(
    "Has validateZIPFile method",
    typeof restorer?.validateZIPFile === "function"
  );
  test(
    "Has restoreSession method",
    typeof restorer?.restoreSession === "function"
  );
  test(
    "Has downloadUpdatedZIP method",
    typeof restorer?.downloadUpdatedZIP === "function"
  );
  test("Has cleanup method", typeof restorer?.cleanup === "function");
  test("Has getDebugInfo method", typeof restorer?.getDebugInfo === "function");
  test("Has validate method", typeof restorer?.validate === "function");

  // Element caching tests
  test("Container element cached", !!restorer?.elements?.container);
  test("Upload section cached", !!restorer?.elements?.uploadSection);
  test("Drop zone cached", !!restorer?.elements?.dropZone);
  test("File input cached", !!restorer?.elements?.fileInput);
  test("Working area cached", !!restorer?.elements?.workingArea);

  // Parser availability
  test(
    "Parser reference available",
    !!restorer?.parser || typeof window.getMathPixZIPParser === "function"
  );

  // ZIP validation tests
  if (restorer?.validateZIPFile) {
    const mockZipFile = new File(["test"], "test.zip", {
      type: "application/zip",
    });
    const mockNonZipFile = new File(["test"], "test.pdf", {
      type: "application/pdf",
    });
    test("Validates ZIP file correctly", restorer.validateZIPFile(mockZipFile));
    test("Rejects non-ZIP file", !restorer.validateZIPFile(mockNonZipFile));
  }

  printTestSummary(results, "Core Functionality");
  return results;
};

/**
 * Quick validation of Phase 8.2 implementation
 * @returns {boolean} True if all critical checks pass
 */
window.validatePhase82 = function () {
  console.log("🔍 Validating Phase 8.2 implementation...\n");

  const checks = [
    ["MathPixSessionRestorer class", !!window.MathPixSessionRestorer],
    [
      "getMathPixSessionRestorer function",
      typeof window.getMathPixSessionRestorer === "function",
    ],
    ["Instance creates successfully", !!window.getMathPixSessionRestorer?.()],
    [
      "Container element exists",
      !!document.getElementById("mathpix-resume-mode-container"),
    ],
    ["Drop zone element exists", !!document.getElementById("resume-drop-zone")],
    ["File input exists", !!document.getElementById("resume-file-input")],
    ["Working area exists", !!document.getElementById("resume-working-area")],
    [
      "Resume mode radio exists",
      !!document.getElementById("mathpix-resume-mode-radio"),
    ],
  ];

  let allPassed = true;

  checks.forEach(([name, passed]) => {
    console.log(`${passed ? "✅" : "❌"} ${name}`);
    if (!passed) allPassed = false;
  });

  console.log(
    `\n${
      allPassed
        ? "✅ Phase 8.2 validation PASSED"
        : "❌ Phase 8.2 validation FAILED"
    }`
  );

  return allPassed;
};

// ============================================================================
// SESSION RECOVERY BUG FIX TESTS
// ============================================================================

/**
 * Test session recovery bug fixes (Bug 3 & Bug 4)
 * @returns {Object} Test results
 */
window.validateSessionRecoveryFixes = function () {
  console.log("🧪 Validating Session Recovery Bug Fixes...\n");

  const results = createTestResults();
  const test = (name, condition) => runTest(results, name, condition);

  const restorer = window.getMathPixSessionRestorer?.();

  // Bug 3 fixes: _currentSessionIndex tracking
  console.log("\n--- Bug 3: Session Index Tracking ---");
  test(
    "getCurrentVersionType method exists",
    typeof restorer?.getCurrentVersionType === "function"
  );
  test(
    "validateCurrentSessionIndex method exists",
    typeof restorer?.validateCurrentSessionIndex === "function"
  );

  // Test getter/setter functionality
  if (restorer) {
    const originalIndex = restorer._currentSessionIndex;
    restorer._currentSessionIndex = 99;
    test(
      "_currentSessionIndex setter works",
      restorer._currentSessionIndex === 99
    );
    restorer._currentSessionIndex = originalIndex; // Restore
  }

  // Bug 4 fixes: Switch version button visibility
  console.log("\n--- Bug 4: Switch Version Button ---");
  test(
    "showSwitchVersionButton method exists",
    typeof restorer?.showSwitchVersionButton === "function"
  );
  test(
    "hideSwitchVersionButton method exists",
    typeof restorer?.hideSwitchVersionButton === "function"
  );

  printTestSummary(results, "Bug Fix Validation");
  return results;
};

/**
 * Test version type detection
 * @returns {void}
 */
window.testVersionSwitch = function () {
  const restorer = window.getMathPixSessionRestorer?.();
  const currentMMD = restorer?.restoredSession?.currentMMD || "";
  const originalMMD = restorer?.restoredSession?.originalMMD || "";

  console.log("🔄 Version Switch Test:");
  console.log("  _currentSessionIndex:", restorer?._currentSessionIndex);

  if (restorer?.getCurrentVersionType) {
    const versionType = restorer.getCurrentVersionType();
    console.log("  Actual version type:", versionType);
  } else {
    console.log("  ⚠️ getCurrentVersionType not available");
  }

  console.log("  Content matches ZIP:", currentMMD === originalMMD);
  console.log("  Content has user edits:", currentMMD !== originalMMD);

  // Validate index
  if (restorer?.validateCurrentSessionIndex) {
    const validated = restorer.validateCurrentSessionIndex();
    console.log("  Validated index:", validated);
  }
};

/**
 * Test Switch Version button visibility
 * @returns {Object} Button status
 */
window.testSwitchVersionButton = function () {
  const btn = document.getElementById("resume-switch-version-btn");

  console.log("🔘 Switch Version Button Test:");
  console.log("  Button exists:", !!btn);

  if (btn) {
    console.log("  Button hidden attribute:", btn.hidden);
    console.log("  Button display style:", getComputedStyle(btn).display);
    console.log(
      "  Button visible:",
      !btn.hidden && getComputedStyle(btn).display !== "none"
    );
  } else {
    console.log("  ⚠️ Button not found in DOM");
  }

  return {
    exists: !!btn,
    hidden: btn?.hidden,
    display: btn ? getComputedStyle(btn).display : null,
    visible: btn && !btn.hidden && getComputedStyle(btn).display !== "none",
  };
};

// ============================================================================
// CONTENT PREVIEW FEATURE TESTS
// ============================================================================

/**
 * Test content preview feature
 * @returns {Object} Test results
 */
window.testContentPreview = function () {
  console.log("📝 Testing Content Preview Feature...\n");

  const results = createTestResults();
  const test = (name, condition) => runTest(results, name, condition);

  const restorer = window.getMathPixSessionRestorer?.();

  // Method availability
  test(
    "getContentPreview method exists",
    typeof restorer?.getContentPreview === "function"
  );
  test(
    "findFirstDifference method exists",
    typeof restorer?.findFirstDifference === "function"
  );
  test(
    "truncatePreview method exists",
    typeof restorer?.truncatePreview === "function"
  );

  if (!restorer?.getContentPreview) {
    console.log(
      "⚠️ Content preview methods not available - skipping functional tests"
    );
    printTestSummary(results, "Content Preview");
    return results;
  }

  // Test with sample content
  console.log("\n--- Functional Tests ---");

  // Basic preview
  const basicContent = "Test content with $4 5$ minutes of work";
  const basicPreview = restorer.getContentPreview(basicContent);
  test("Basic preview returns string", typeof basicPreview === "string");
  test("Basic preview is quoted", basicPreview.startsWith('"'));
  console.log(`  Preview output: ${basicPreview}`);

  // Empty content
  const emptyPreview = restorer.getContentPreview("");
  test("Empty content returns '(empty)'", emptyPreview === "(empty)");

  // Null content
  const nullPreview = restorer.getContentPreview(null);
  test("Null content returns '(empty)'", nullPreview === "(empty)");

  // Difference detection
  console.log("\n--- Difference Detection ---");
  const original = "Duration: $4 5$ minutes";
  const modified = "Duration: **45** minutes";
  const diffPreview = restorer.getContentPreview(modified, original);
  console.log(`  Original: "${original}"`);
  console.log(`  Modified: "${modified}"`);
  console.log(`  Diff preview: ${diffPreview}`);
  test("Diff preview shows changed content", diffPreview.includes("45"));

  // findFirstDifference tests
  const diff = restorer.findFirstDifference(modified, original);
  test("findFirstDifference finds change", diff !== null);
  console.log(`  First difference: "${diff}"`);

  // No difference case
  const noDiff = restorer.findFirstDifference(original, original);
  test(
    "findFirstDifference returns null for identical strings",
    noDiff === null
  );

  // Truncation tests
  console.log("\n--- Truncation ---");
  const longContent = "A".repeat(100);
  const truncated = restorer.truncatePreview(longContent, 50);
  test("Long content is truncated", truncated.length <= 55); // 50 + quotes + ellipsis
  test("Truncated content ends with ellipsis", truncated.endsWith('..."'));
  console.log(`  Truncated (50 chars): ${truncated}`);

  printTestSummary(results, "Content Preview");
  return results;
};

/**
 * Verify edit saved with preview
 * @returns {boolean} True if edit was saved
 */
window.verifyEditWithPreview = function () {
  const restorer = window.getMathPixSessionRestorer?.();
  const session = restorer?.restoredSession;
  const storageKey = session?.storageKey;

  console.log("📝 Edit Verification:");

  if (!storageKey) {
    console.log("  ⚠️ No active session found");
    return false;
  }

  const stored = localStorage.getItem(storageKey);
  const data = stored ? JSON.parse(stored) : null;

  if (!data) {
    console.log("  ⚠️ No stored data found for key:", storageKey);
    return false;
  }

  const hasChanges = data.original !== data.current;
  console.log("  Content Changed:", hasChanges);

  if (restorer?.getContentPreview) {
    // Use baseline (content at session start) for showing user's recent edits
    // Fall back to original if baseline not available (older sessions)
    const comparisonContent = data.baseline || data.original;
    console.log(
      "  Preview:",
      restorer.getContentPreview(data.current, comparisonContent)
    );
  }

  return hasChanges;
};

// ============================================================================
// FOCUS MODE TESTS (Phase 8.3.3)
// ============================================================================

/**
 * Test Focus Mode functionality
 * @returns {Object} Test results
 */
window.testFocusMode = function () {
  console.log("🎯 Testing Focus Mode (Phase 8.3.3)...\n");

  const results = createTestResults();
  const test = (name, condition) => runTest(results, name, condition);

  // Get restorer instance
  const restorer = window.getMathPixSessionRestorer?.();

  // Test 1: Restorer exists and is initialised
  test("Session restorer exists", !!restorer);
  test("Session restorer is initialised", restorer?.isInitialised);

  // Test 2: Focus mode properties exist
  console.log("\n--- Property Tests ---");
  test(
    "isFocusMode property exists",
    restorer && typeof restorer.isFocusMode === "boolean"
  );
  test(
    "savedScrollPosition property exists",
    restorer && "savedScrollPosition" in restorer
  );

  // Test 3: Focus mode methods exist
  console.log("\n--- Method Tests ---");
  test(
    "enterFocusMode method exists",
    typeof restorer?.enterFocusMode === "function"
  );
  test(
    "exitFocusMode method exists",
    typeof restorer?.exitFocusMode === "function"
  );
  test(
    "toggleFocusMode method exists",
    typeof restorer?.toggleFocusMode === "function"
  );

  // Test 4: Focus mode button cached
  console.log("\n--- Element Tests ---");
  test(
    "Focus mode button is cached",
    restorer?.elements?.focusModeBtn instanceof HTMLElement
  );

  // Test 5: Button has correct initial state
  const btn = restorer?.elements?.focusModeBtn;
  test("Button has aria-pressed attribute", btn?.hasAttribute("aria-pressed"));
  test(
    "Button aria-pressed is initially false",
    btn?.getAttribute("aria-pressed") === "false"
  );

  // Test 6: CSS class exists (check if styles are loaded)
  console.log("\n--- CSS Tests ---");
  const testDiv = document.createElement("div");
  document.body.appendChild(testDiv);
  document.body.classList.add("resume-focus-mode");
  const computedStyle = window.getComputedStyle(document.body);
  const hasOverflowHidden = computedStyle.overflow === "hidden";
  document.body.classList.remove("resume-focus-mode");
  testDiv.remove();
  test("Focus mode CSS is loaded (body overflow hidden)", hasOverflowHidden);

  // Test 7: Toggle functionality (only if container is visible)
  const container = document.getElementById("mathpix-resume-mode-container");
  if (
    container &&
    container.style.display !== "none" &&
    restorer?.isInitialised
  ) {
    console.log("\n--- Toggle Functionality Tests ---");

    // Initial state
    const initialState = restorer.isFocusMode;
    test("Initial focus mode state is false", initialState === false);

    // Enter focus mode
    restorer.enterFocusMode();
    test(
      "enterFocusMode sets isFocusMode to true",
      restorer.isFocusMode === true
    );
    test(
      "enterFocusMode adds body class",
      document.body.classList.contains("resume-focus-mode")
    );
    test(
      "enterFocusMode sets aria-pressed to true",
      btn?.getAttribute("aria-pressed") === "true"
    );

    // Exit focus mode
    restorer.exitFocusMode();
    test(
      "exitFocusMode sets isFocusMode to false",
      restorer.isFocusMode === false
    );
    test(
      "exitFocusMode removes body class",
      !document.body.classList.contains("resume-focus-mode")
    );
    test(
      "exitFocusMode sets aria-pressed to false",
      btn?.getAttribute("aria-pressed") === "false"
    );

    // Toggle test
    restorer.toggleFocusMode();
    test("toggleFocusMode enters focus mode", restorer.isFocusMode === true);
    restorer.toggleFocusMode();
    test("toggleFocusMode exits focus mode", restorer.isFocusMode === false);
  } else {
    console.log(
      "\n⚠️ Skipping toggle tests - Resume Mode container not visible"
    );
    console.log("   Load a ZIP file first to test full functionality");
  }

  printTestSummary(results, "Focus Mode");

  console.log("\n💡 Manual testing checklist:");
  console.log("   1. Click 'Focus Mode' button - should enter focus mode");
  console.log("   2. Press Escape - should exit focus mode");
  console.log("   3. Press Ctrl+Shift+F - should toggle focus mode");
  console.log("   4. Check scroll position is restored after exit");
  console.log("   5. Verify screen reader announcement works");

  return results;
};

/**
 * Quick validation of Focus Mode implementation
 * @returns {boolean} True if all critical checks pass
 */
window.validateFocusMode = function () {
  console.log("🔍 Validating Focus Mode (Phase 8.3.3)...\n");

  const restorer = window.getMathPixSessionRestorer?.();

  const checks = [
    ["isFocusMode property exists", typeof restorer?.isFocusMode === "boolean"],
    [
      "enterFocusMode method exists",
      typeof restorer?.enterFocusMode === "function",
    ],
    [
      "exitFocusMode method exists",
      typeof restorer?.exitFocusMode === "function",
    ],
    [
      "toggleFocusMode method exists",
      typeof restorer?.toggleFocusMode === "function",
    ],
    [
      "Focus mode button exists",
      !!document.getElementById("resume-focus-mode-btn"),
    ],
    [
      "Focus mode button cached",
      restorer?.elements?.focusModeBtn instanceof HTMLElement,
    ],
  ];

  let allPassed = true;

  checks.forEach(([name, passed]) => {
    console.log(`${passed ? "✅" : "❌"} ${name}`);
    if (!passed) allPassed = false;
  });

  console.log(
    `\n${
      allPassed
        ? "✅ Focus Mode validation PASSED"
        : "❌ Focus Mode validation FAILED"
    }`
  );

  return allPassed;
};

/**
 * Test Focus Mode keyboard shortcuts
 * Note: This creates synthetic events for testing
 * @returns {Object} Test results
 */
window.testFocusModeKeyboard = function () {
  console.log("⌨️ Testing Focus Mode Keyboard Shortcuts...\n");

  const results = createTestResults();
  const test = (name, condition) => runTest(results, name, condition);

  const restorer = window.getMathPixSessionRestorer?.();
  const container = document.getElementById("mathpix-resume-mode-container");

  if (!restorer?.isInitialised) {
    console.log("⚠️ Session restorer not initialised");
    return results;
  }

  if (!container || container.style.display === "none") {
    console.log("⚠️ Resume Mode container not visible");
    console.log("   Navigate to Resume Mode to test keyboard shortcuts");
    return results;
  }

  // Ensure we start in a known state
  if (restorer.isFocusMode) {
    restorer.exitFocusMode();
  }

  // Test Ctrl+Shift+F to enter focus mode
  console.log("Testing Ctrl+Shift+F...");
  const enterEvent = new KeyboardEvent("keydown", {
    key: "F",
    ctrlKey: true,
    shiftKey: true,
    bubbles: true,
  });
  document.dispatchEvent(enterEvent);

  // Small delay to allow event processing
  test("Ctrl+Shift+F enters focus mode", restorer.isFocusMode === true);

  // Test Escape to exit focus mode
  console.log("Testing Escape...");
  const escapeEvent = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
  });
  document.dispatchEvent(escapeEvent);

  test("Escape exits focus mode", restorer.isFocusMode === false);

  // Test Ctrl+Shift+F toggle
  console.log("Testing Ctrl+Shift+F toggle...");
  document.dispatchEvent(enterEvent);
  const afterFirstToggle = restorer.isFocusMode;
  document.dispatchEvent(enterEvent);
  const afterSecondToggle = restorer.isFocusMode;

  test(
    "Ctrl+Shift+F toggles on then off",
    afterFirstToggle === true && afterSecondToggle === false
  );

  printTestSummary(results, "Keyboard Shortcuts");
  return results;
};

// ============================================================================
// UTILITY TEST COMMANDS
// ============================================================================

/**
 * Clear all session storage for fresh testing
 * @returns {number} Number of sessions cleared
 */
window.clearAllResumeSessions = function () {
  const keys = Object.keys(localStorage).filter((k) =>
    k.startsWith("mathpix-resume-session")
  );
  keys.forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem("mathpix-resume-active-index");
  console.log(`🗑️ Cleared ${keys.length} session(s)`);
  return keys.length;
};

/**
 * List all stored resume sessions
 * @returns {Array} Session summaries
 */
window.listResumeSessions = function () {
  const keys = Object.keys(localStorage).filter((k) =>
    k.startsWith("mathpix-resume-session")
  );

  console.log(`📋 Found ${keys.length} stored session(s):\n`);

  const sessions = keys.map((key) => {
    try {
      const data = JSON.parse(localStorage.getItem(key));
      const date = new Date(data.lastModified);
      const sizeKB = Math.round(((data.current?.length || 0) / 1024) * 10) / 10;

      console.log(`  📄 ${key}`);
      console.log(`     Last modified: ${date.toLocaleString()}`);
      console.log(`     Size: ${sizeKB} KB`);
      console.log(`     Has changes: ${data.original !== data.current}`);

      return { key, date, sizeKB, hasChanges: data.original !== data.current };
    } catch (e) {
      console.log(`  ⚠️ ${key} (invalid data)`);
      return { key, error: true };
    }
  });

  return sessions;
};

/**
 * Get debug info for current session
 * @returns {Object} Debug information
 */
window.getSessionDebugInfo = function () {
  const restorer = window.getMathPixSessionRestorer?.();

  if (!restorer) {
    console.log("⚠️ Session restorer not available");
    return null;
  }

  const info = restorer.getDebugInfo?.() || {};
  const versionType = restorer.getCurrentVersionType?.() || {
    type: "unknown",
    index: null,
  };

  console.log("🔍 Session Debug Info:");
  console.log("  Initialised:", info.isInitialised);
  console.log("  Has parser:", info.hasParser);
  console.log("  Has parse result:", info.hasParseResult);
  console.log("  Has restored session:", info.hasRestoredSession);
  console.log("  Unsaved changes:", info.hasUnsavedChanges);
  console.log("  Session key:", info.sessionKey);
  console.log("  Source filename:", info.sourceFilename);
  console.log("  Is PDF:", info.isPDF);
  console.log("  Current session index:", restorer._currentSessionIndex);
  console.log("  Version type:", versionType.type);
  console.log("  Version index:", versionType.index);

  return { ...info, versionType };
};

// ============================================================================
// DEMO COMMANDS
// ============================================================================

/**
 * Demo ZIP resume workflow with test data
 * @returns {Promise<void>}
 */
window.demoZIPResume = async function () {
  console.log("🎬 Demonstrating ZIP resume workflow...\n");

  // Check if parser has test function
  if (typeof window.createTestZIPForResume === "function") {
    console.log("Creating test ZIP file...");
    const testZip = await window.createTestZIPForResume();

    console.log("Getting session restorer...");
    const restorer = window.getMathPixSessionRestorer?.();

    if (!restorer) {
      console.log("❌ Session restorer not available");
      return;
    }

    console.log("Processing test ZIP...");
    await restorer.handleZIPFile(testZip);

    console.log("✅ Demo complete - check UI for results");
  } else {
    console.log("⚠️ Test ZIP creator not available");
    console.log("\nTo test manually:");
    console.log("1. Select 'Resume Session' mode");
    console.log("2. Drop a MathPix ZIP archive onto the drop zone");
    console.log("3. If multiple edits exist, select one");
    console.log("4. Session should restore with full editing capability");
  }
};

// ============================================================================
// COMPREHENSIVE TEST RUNNER
// ============================================================================

/**
 * Run all session restorer tests
 * @returns {Promise<Object>} Combined test results
 */
window.runAllSessionRestorerTests = async function () {
  console.log("═".repeat(60));
  console.log("🧪 MATHPIX SESSION RESTORER - COMPREHENSIVE TEST SUITE");
  console.log("═".repeat(60));
  console.log("");

  const allResults = {
    passed: 0,
    failed: 0,
    suites: [],
  };

  // Run Phase 8.2 validation
  console.log("─".repeat(60));
  const phase82Passed = window.validatePhase82();
  allResults.suites.push({
    name: "Phase 8.2 Validation",
    passed: phase82Passed,
  });
  if (phase82Passed) allResults.passed++;
  else allResults.failed++;

  console.log("");

  // Run core functionality tests
  console.log("─".repeat(60));
  const coreResults = await window.testSessionRestorer();
  allResults.suites.push({
    name: "Core Functionality",
    ...coreResults,
  });
  allResults.passed += coreResults.passed;
  allResults.failed += coreResults.failed;

  console.log("");

  // Run bug fix validation
  console.log("─".repeat(60));
  const bugFixResults = window.validateSessionRecoveryFixes();
  allResults.suites.push({
    name: "Bug Fix Validation",
    ...bugFixResults,
  });
  allResults.passed += bugFixResults.passed;
  allResults.failed += bugFixResults.failed;

  console.log("");

  // Run content preview tests
  console.log("─".repeat(60));
  const previewResults = window.testContentPreview();
  allResults.suites.push({
    name: "Content Preview",
    ...previewResults,
  });
  allResults.passed += previewResults.passed;
  allResults.failed += previewResults.failed;

  console.log("");

  // Run Focus Mode tests (Phase 8.3.3)
  console.log("─".repeat(60));
  const focusModeResults = window.testFocusMode();
  allResults.suites.push({
    name: "Focus Mode (8.3.3)",
    ...focusModeResults,
  });
  allResults.passed += focusModeResults.passed;
  allResults.failed += focusModeResults.failed;

  // Final summary
  console.log("");
  console.log("═".repeat(60));
  console.log("📊 FINAL SUMMARY");
  console.log("═".repeat(60));

  allResults.suites.forEach((suite) => {
    const status = suite.failed === 0 || suite.passed === true ? "✅" : "❌";
    if (suite.tests) {
      console.log(
        `${status} ${suite.name}: ${suite.passed}/${
          suite.passed + suite.failed
        }`
      );
    } else {
      console.log(
        `${status} ${suite.name}: ${suite.passed ? "PASSED" : "FAILED"}`
      );
    }
  });

  console.log("");
  console.log(
    `Total: ${allResults.passed} passed, ${allResults.failed} failed`
  );
  console.log(
    allResults.failed === 0 ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"
  );
  console.log("═".repeat(60));

  return allResults;
};

// ============================================================================
// HELP COMMAND
// ============================================================================

/**
 * Display available test commands
 */
window.showSessionRestorerTestHelp = function () {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     MATHPIX SESSION RESTORER TEST COMMANDS                   ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  COMPREHENSIVE TESTING                                       ║
║  ─────────────────────                                       ║
║  runAllSessionRestorerTests()  Run all tests                 ║
║                                                              ║
║  INDIVIDUAL TEST SUITES                                      ║
║  ──────────────────────                                      ║
║  testSessionRestorer()         Core functionality tests      ║
║  validatePhase82()             Phase 8.2 validation          ║
║  validateSessionRecoveryFixes() Bug 3 & 4 fix tests          ║
║  testContentPreview()          Preview feature tests         ║
║  testFocusMode()               Focus Mode tests (8.3.3)      ║
║                                                              ║
║  SPECIFIC TESTS                                              ║
║  ──────────────────                                          ║
║  testVersionSwitch()           Version type detection        ║
║  testSwitchVersionButton()     Button visibility test        ║
║  verifyEditWithPreview()       Check edit was saved          ║
║  validateFocusMode()           Quick Focus Mode validation   ║
║  testFocusModeKeyboard()       Keyboard shortcut tests       ║
║                                                              ║
║  UTILITIES                                                   ║
║  ─────────                                                   ║
║  clearAllResumeSessions()      Clear localStorage sessions   ║
║  listResumeSessions()          List stored sessions          ║
║  getSessionDebugInfo()         Current session debug info    ║
║                                                              ║
║  DEMOS                                                       ║
║  ─────                                                       ║
║  demoZIPResume()               Demo workflow with test ZIP   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
};

// ============================================================================
// MODULE LOAD CONFIRMATION
// ============================================================================

logInfo("MathPix Session Restorer Test Suite loaded");
console.log(
  "💡 Type showSessionRestorerTestHelp() for available test commands"
);
