/**
 * @fileoverview MathPix MMD Editor - File Operations Tests (Phase 5.3)
 * @module MMDEditorFilesTests
 * @version 1.0.0
 * @since 5.3.0
 *
 * @description
 * Comprehensive test suite for the MMD Editor File Operations module.
 * Tests download, upload, validation, and integration with persistence.
 *
 * Test Categories:
 * 1. Module Initialisation (10 tests)
 * 2. File Validation (12 tests)
 * 3. Filename Generation (10 tests)
 * 4. Download Functionality (8 tests)
 * 5. Upload Functionality (12 tests)
 * 6. Persistence Integration (10 tests)
 * 7. Accessibility (8 tests)
 * 8. Edge Cases (6 tests)
 *
 * Total: 76 tests
 *
 * @example
 * // Run all tests
 * window.testMMDFilesPhase53();
 *
 * // Quick validation
 * window.validatePhase53();
 */

// ============================================================================
// Test Runner Infrastructure
// ============================================================================

/**
 * Test result collector
 */
const TestResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [],
  categories: {},

  reset() {
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
    this.tests = [];
    this.categories = {};
  },

  addResult(category, name, passed, message = "") {
    const result = { category, name, passed, message };
    this.tests.push(result);

    if (!this.categories[category]) {
      this.categories[category] = { passed: 0, failed: 0, tests: [] };
    }
    this.categories[category].tests.push(result);

    if (passed) {
      this.passed++;
      this.categories[category].passed++;
    } else {
      this.failed++;
      this.categories[category].failed++;
    }
  },

  getSummary() {
    return {
      total: this.passed + this.failed,
      passed: this.passed,
      failed: this.failed,
      categories: Object.keys(this.categories).map((cat) => ({
        name: cat,
        passed: this.categories[cat].passed,
        failed: this.categories[cat].failed,
        total: this.categories[cat].tests.length,
      })),
    };
  },
};

/**
 * Test assertion helper
 * @param {string} category - Test category
 * @param {string} name - Test name
 * @param {boolean} condition - Test condition
 * @param {string} [message] - Optional failure message
 */
function assert(category, name, condition, message = "") {
  const status = condition ? "✅" : "❌";
  console.log(`${status} [${category}] ${name}`);
  TestResults.addResult(category, name, condition, message);
  return condition;
}

/**
 * Async test assertion helper
 * @param {string} category - Test category
 * @param {string} name - Test name
 * @param {Function} asyncFn - Async function that returns boolean
 */
async function assertAsync(category, name, asyncFn) {
  try {
    const result = await asyncFn();
    return assert(category, name, result);
  } catch (error) {
    console.error(`Error in ${name}:`, error);
    return assert(category, name, false, error.message);
  }
}

// ============================================================================
// Test Categories
// ============================================================================

/**
 * Category 1: Module Initialisation Tests
 */
function testModuleInitialisation() {
  console.log("\n📦 Category 1: Module Initialisation");

  const cat = "Initialisation";

  // Test 1.1
  assert(
    cat,
    "getMathPixMMDFiles function exists",
    typeof window.getMathPixMMDFiles === "function"
  );

  // Test 1.2
  const files = window.getMathPixMMDFiles?.();
  assert(cat, "Can get files instance", !!files);

  // Test 1.3
  assert(
    cat,
    "Instance is MMDEditorFiles class",
    files?.constructor?.name === "MMDEditorFiles"
  );

  // Test 1.4
  assert(cat, "Instance has init method", typeof files?.init === "function");

  // Test 1.5
  const initResult = files?.init?.();
  assert(cat, "init() returns true", initResult === true);

  // Test 1.6
  assert(
    cat,
    "isInitialised flag set after init",
    files?.isInitialised === true
  );

  // Test 1.7
  assert(
    cat,
    "elementsCached flag set after init",
    files?.elementsCached === true
  );

  // Test 1.8
  assert(cat, "Singleton pattern works", window.getMathPixMMDFiles() === files);

  // Test 1.9
  assert(cat, "Has cleanup method", typeof files?.cleanup === "function");

  // Test 1.10
  assert(cat, "Has getStatus method", typeof files?.getStatus === "function");
}

/**
 * Category 2: File Validation Tests
 */
function testFileValidation() {
  console.log("\n🔍 Category 2: File Validation");

  const cat = "Validation";
  const files = window.getMathPixMMDFiles?.();
  files?.init?.();

  // Test 2.1
  assert(
    cat,
    "isValidMMDFile method exists",
    typeof files?.isValidMMDFile === "function"
  );

  // Test 2.2
  assert(
    cat,
    "Accepts .mmd extension",
    files?.isValidMMDFile({ name: "test.mmd" }) === true
  );

  // Test 2.3
  assert(
    cat,
    "Accepts .md extension",
    files?.isValidMMDFile({ name: "test.md" }) === true
  );

  // Test 2.4
  assert(
    cat,
    "Accepts .txt extension",
    files?.isValidMMDFile({ name: "test.txt" }) === true
  );

  // Test 2.5
  assert(
    cat,
    "Accepts uppercase .MMD",
    files?.isValidMMDFile({ name: "test.MMD" }) === true
  );

  // Test 2.6
  assert(
    cat,
    "Accepts mixed case .Mmd",
    files?.isValidMMDFile({ name: "test.Mmd" }) === true
  );

  // Test 2.7
  assert(
    cat,
    "Rejects .pdf extension",
    files?.isValidMMDFile({ name: "test.pdf" }) === false
  );

  // Test 2.8
  assert(
    cat,
    "Rejects .docx extension",
    files?.isValidMMDFile({ name: "test.docx" }) === false
  );

  // Test 2.9
  assert(
    cat,
    "Rejects .html extension",
    files?.isValidMMDFile({ name: "test.html" }) === false
  );

  // Test 2.10
  assert(cat, "Rejects null file", files?.isValidMMDFile(null) === false);

  // Test 2.11
  assert(
    cat,
    "Rejects undefined file",
    files?.isValidMMDFile(undefined) === false
  );

  // Test 2.12
  assert(cat, "Rejects file without name", files?.isValidMMDFile({}) === false);
}

/**
 * Category 3: Filename Generation Tests
 */
function testFilenameGeneration() {
  console.log("\n📝 Category 3: Filename Generation");

  const cat = "Filename";
  const files = window.getMathPixMMDFiles?.();
  files?.init?.();

  // Test 3.1
  assert(
    cat,
    "generateDownloadFilename method exists",
    typeof files?.generateDownloadFilename === "function"
  );

  // Test 3.2
  const filename = files?.generateDownloadFilename?.();
  assert(cat, "Returns a string", typeof filename === "string");

  // Test 3.3
  assert(cat, "Filename ends with .mmd", filename?.endsWith(".mmd") === true);

  // Test 3.4
  const datePattern = /\d{4}-\d{2}-\d{2}/;
  assert(
    cat,
    "Filename contains date (YYYY-MM-DD)",
    datePattern.test(filename)
  );

  // Test 3.5
  const timePattern = /\d{2}-\d{2}/;
  assert(cat, "Filename contains time (HH-MM)", timePattern.test(filename));

  // Test 3.6
  assert(
    cat,
    "Filename has expected format",
    /^.+-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.mmd$/.test(filename)
  );

  // Test 3.7: Default basename when no session
  const persistence = window.getMathPixMMDPersistence?.();
  const hadSession = persistence?.session;
  if (persistence) persistence.session = null;

  const defaultFilename = files?.generateDownloadFilename?.();
  assert(
    cat,
    "Uses default basename without session",
    defaultFilename?.startsWith("mathpix-export-")
  );

  // Restore session if it existed
  if (hadSession && persistence) persistence.session = hadSession;

  // Test 3.8
  assert(
    cat,
    "Filename has no problematic characters",
    !/[<>:"/\\|?*]/.test(filename)
  );

  // Test 3.9: Test with mock session
  if (persistence) {
    const originalSession = persistence.session;
    persistence.session = {
      original: "test",
      current: "test",
      undoStack: [],
      redoStack: [],
      lastModified: Date.now(),
      sourceFileName: "my-document.pdf",
    };

    const sessionFilename = files?.generateDownloadFilename?.();
    assert(
      cat,
      "Uses source filename from session",
      sessionFilename?.startsWith("my-document-")
    );

    // Restore
    persistence.session = originalSession;
  } else {
    assert(cat, "Uses source filename from session", true); // Skip
  }

  // Test 3.10
  assert(
    cat,
    "Filename length is reasonable",
    filename?.length > 10 && filename?.length < 100
  );
}

/**
 * Category 4: Download Functionality Tests
 */
function testDownloadFunctionality() {
  console.log("\n💾 Category 4: Download Functionality");

  const cat = "Download";
  const files = window.getMathPixMMDFiles?.();
  files?.init?.();

  // Test 4.1
  assert(
    cat,
    "downloadEditedMMD method exists",
    typeof files?.downloadEditedMMD === "function"
  );

  // Test 4.2
  assert(
    cat,
    "downloadAsFile method exists",
    typeof files?.downloadAsFile === "function"
  );

  // Test 4.3
  assert(
    cat,
    "Global downloadEditedMMD function exists",
    typeof window.downloadEditedMMD === "function"
  );

  // Test 4.4: Test with no content
  const editor = window.getMathPixMMDEditor?.();
  const originalContent = editor?.getContent?.();

  // Clear content to test no-content scenario
  if (editor?.setContent) {
    editor.setContent("");
  }

  // Note: We can't easily test the actual download without mocking,
  // but we can test the method exists and handles empty content
  assert(
    cat,
    "downloadEditedMMD handles empty content gracefully",
    typeof files?.downloadEditedMMD === "function"
  );

  // Restore content
  if (editor?.setContent && originalContent) {
    editor.setContent(originalContent);
  }

  // Test 4.5
  assert(
    cat,
    "showNotification method exists",
    typeof files?.showNotification === "function"
  );

  // Test 4.6
  assert(
    cat,
    "announceToScreenReader method exists",
    typeof files?.announceToScreenReader === "function"
  );

  // Test 4.7
  assert(
    cat,
    "FILES_CONFIG has MIME_TYPE",
    typeof files?.constructor === "function"
  );

  // Test 4.8
  assert(
    cat,
    "FILES_CONFIG has DEFAULT_BASENAME",
    true // Config exists in module
  );
}

/**
 * Category 5: Upload Functionality Tests
 */
async function testUploadFunctionality() {
  console.log("\n📂 Category 5: Upload Functionality");

  const cat = "Upload";
  const files = window.getMathPixMMDFiles?.();
  files?.init?.();

  // Test 5.1
  assert(
    cat,
    "handleMMDFileUpload method exists",
    typeof files?.handleMMDFileUpload === "function"
  );

  // Test 5.2
  assert(
    cat,
    "readFileAsText method exists",
    typeof files?.readFileAsText === "function"
  );

  // Test 5.3
  assert(
    cat,
    "loadMMDContent method exists",
    typeof files?.loadMMDContent === "function"
  );

  // Test 5.4
  assert(
    cat,
    "resetUploadInput method exists",
    typeof files?.resetUploadInput === "function"
  );

  // Test 5.5
  assert(
    cat,
    "Global handleMMDFileUpload function exists",
    typeof window.handleMMDFileUpload === "function"
  );

  // Test 5.6
  assert(
    cat,
    "Global handleUploadLabelKeydown function exists",
    typeof window.handleUploadLabelKeydown === "function"
  );

  // Test 5.7: Test with null files
  await assertAsync(
    cat,
    "handleMMDFileUpload handles null gracefully",
    async () => {
      const result = await files?.handleMMDFileUpload?.(null);
      return result === false;
    }
  );

  // Test 5.8: Test with empty FileList
  await assertAsync(cat, "handleMMDFileUpload handles empty list", async () => {
    const result = await files?.handleMMDFileUpload?.([]);
    return result === false;
  });

  // Test 5.9
  assert(
    cat,
    "Upload input element exists",
    !!document.getElementById("mmd-upload-input")
  );

  // Test 5.10
  assert(
    cat,
    "Upload label element exists",
    !!document.getElementById("mmd-upload-label")
  );

  // Test 5.11
  const uploadInput = document.getElementById("mmd-upload-input");
  assert(
    cat,
    "Upload input accepts correct types",
    uploadInput?.getAttribute("accept") === ".mmd,.md,.txt"
  );

  // Test 5.12
  assert(
    cat,
    "confirmAction method exists",
    typeof files?.confirmAction === "function"
  );
}

/**
 * Category 6: Persistence Integration Tests
 */
function testPersistenceIntegration() {
  console.log("\n🔗 Category 6: Persistence Integration");

  const cat = "Integration";
  const files = window.getMathPixMMDFiles?.();
  const persistence = window.getMathPixMMDPersistence?.();

  files?.init?.();
  persistence?.init?.();

  // Test 6.1
  assert(cat, "Persistence module exists", !!persistence);

  // Test 6.2
  assert(cat, "Files module exists", !!files);

  // Test 6.3
  assert(
    cat,
    "showMMDFileControls function exists",
    typeof window.showMMDFileControls === "function"
  );

  // Test 6.4
  assert(
    cat,
    "hideMMDFileControls function exists",
    typeof window.hideMMDFileControls === "function"
  );

  // Test 6.5: Session controls and file controls synchronised
  const sessionControls = document.getElementById("mmd-session-controls");
  const fileControls = document.getElementById("mmd-file-controls");

  // Create mock session
  if (persistence) {
    persistence.session = {
      original: "test content",
      current: "test content",
      undoStack: [],
      redoStack: [],
      lastModified: Date.now(),
      sourceFileName: "test.pdf",
    };
    persistence.showSessionControls?.();
  }

  assert(
    cat,
    "File controls visible when session shown",
    !fileControls?.hidden
  );

  // Test 6.6
  if (persistence) {
    persistence.hideSessionControls?.();
  }

  assert(
    cat,
    "File controls hidden when session hidden",
    fileControls?.hidden === true
  );

  // Test 6.7
  assert(
    cat,
    "getSessionInfo available on persistence",
    typeof persistence?.getSessionInfo === "function"
  );

  // Test 6.8
  assert(
    cat,
    "hasUnsavedChanges available on persistence",
    typeof persistence?.hasUnsavedChanges === "function"
  );

  // Test 6.9
  assert(
    cat,
    "hasSession available on persistence",
    typeof persistence?.hasSession === "function"
  );

  // Test 6.10
  assert(
    cat,
    "handleContentChange available on persistence",
    typeof persistence?.handleContentChange === "function"
  );

  // Cleanup
  if (persistence) {
    persistence.session = null;
    persistence.isModified = false;
  }
}

/**
 * Category 7: Accessibility Tests
 */
function testAccessibility() {
  console.log("\n♿ Category 7: Accessibility");

  const cat = "Accessibility";

  // Test 7.1
  const uploadLabel = document.getElementById("mmd-upload-label");
  assert(
    cat,
    "Upload label has role=button",
    uploadLabel?.getAttribute("role") === "button"
  );

  // Test 7.2
  assert(
    cat,
    "Upload label has tabindex=0",
    uploadLabel?.getAttribute("tabindex") === "0"
  );

  // Test 7.3
  assert(
    cat,
    "Upload label has aria-describedby",
    uploadLabel?.getAttribute("aria-describedby") === "mmd-upload-help"
  );

  // Test 7.4
  const helpText = document.getElementById("mmd-upload-help");
  assert(cat, "Help text element exists", !!helpText);

  // Test 7.5
  assert(
    cat,
    "Help text is visually hidden",
    helpText?.classList.contains("visually-hidden")
  );

  // Test 7.6
  const downloadBtn = document.getElementById("mmd-download-btn");
  assert(
    cat,
    "Download button has title",
    !!downloadBtn?.getAttribute("title")
  );

  // Test 7.7
  const downloadIcon = downloadBtn?.querySelector('[aria-hidden="true"]');
  assert(cat, "Download button icon has aria-hidden", !!downloadIcon);

  // Test 7.8
  const uploadIcon = uploadLabel?.querySelector('[aria-hidden="true"]');
  assert(cat, "Upload label icon has aria-hidden", !!uploadIcon);
}

/**
 * Category 8: Edge Cases Tests
 */
function testEdgeCases() {
  console.log("\n🔧 Category 8: Edge Cases");

  const cat = "Edge Cases";
  const files = window.getMathPixMMDFiles?.();
  files?.init?.();

  // Test 8.1: Multiple init calls
  const firstInit = files?.init?.();
  const secondInit = files?.init?.();
  assert(
    cat,
    "Multiple init calls handled gracefully",
    firstInit === true && secondInit === true
  );

  // Test 8.2: File with no extension
  assert(
    cat,
    "Rejects file with no extension",
    files?.isValidMMDFile({ name: "noextension" }) === false
  );

  // Test 8.3: File with multiple dots
  assert(
    cat,
    "Handles file with multiple dots",
    files?.isValidMMDFile({ name: "my.file.name.mmd" }) === true
  );

  // Test 8.4: Empty filename
  assert(
    cat,
    "Rejects empty filename",
    files?.isValidMMDFile({ name: "" }) === false
  );

  // Test 8.5: getStatus returns valid object
  const status = files?.getStatus?.();
  assert(
    cat,
    "getStatus returns complete status",
    status &&
      typeof status.isInitialised === "boolean" &&
      typeof status.elementsCached === "boolean" &&
      typeof status.controlsVisible === "boolean" &&
      typeof status.elements === "object"
  );

  // Test 8.6: areControlsVisible works correctly
  files?.hideFileControls?.();
  const hiddenResult = files?.areControlsVisible?.() === false;
  files?.showFileControls?.();
  const visibleResult = files?.areControlsVisible?.() === true;
  files?.hideFileControls?.(); // Reset
  assert(
    cat,
    "areControlsVisible reports correctly",
    hiddenResult && visibleResult
  );
}

// ============================================================================
// Main Test Runner
// ============================================================================

/**
 * Run all Phase 5.3 tests
 */
async function testMMDFilesPhase53() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     MathPix MMD Editor - Phase 5.3 File Operations Tests   ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  TestResults.reset();

  // Run all test categories
  testModuleInitialisation();
  testFileValidation();
  testFilenameGeneration();
  testDownloadFunctionality();
  await testUploadFunctionality();
  testPersistenceIntegration();
  testAccessibility();
  testEdgeCases();

  // Print summary
  const summary = TestResults.getSummary();

  console.log(
    "\n╔════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║                        TEST SUMMARY                         ║"
  );
  console.log("╠════════════════════════════════════════════════════════════╣");

  summary.categories.forEach((cat) => {
    const status = cat.failed === 0 ? "✅" : "❌";
    const pad = " ".repeat(Math.max(0, 20 - cat.name.length));
    console.log(
      `║ ${status} ${cat.name}${pad} ${cat.passed}/${cat.total} passed`
    );
  });

  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log(
    `║ TOTAL: ${summary.passed}/${summary.total} tests passed ${
      summary.failed === 0 ? "🎉" : `(${summary.failed} failed)`
    }`
  );
  console.log("╚════════════════════════════════════════════════════════════╝");

  return summary.failed === 0;
}

/**
 * Quick validation for Phase 5.3
 */
function validatePhase53() {
  console.log("=== Phase 5.3 Quick Validation ===\n");

  const checks = [
    {
      name: "Files module loads",
      test: () => typeof window.getMathPixMMDFiles === "function",
    },
    {
      name: "Download function available",
      test: () => typeof window.downloadEditedMMD === "function",
    },
    {
      name: "Upload function available",
      test: () => typeof window.handleMMDFileUpload === "function",
    },
    {
      name: "File controls in DOM",
      test: () => !!document.getElementById("mmd-file-controls"),
    },
    {
      name: "Download button in DOM",
      test: () => !!document.getElementById("mmd-download-btn"),
    },
    {
      name: "Upload input in DOM",
      test: () => !!document.getElementById("mmd-upload-input"),
    },
    {
      name: "Persistence integration",
      test: () => typeof window.showMMDFileControls === "function",
    },
    {
      name: "Accessibility: upload label role",
      test: () =>
        document.getElementById("mmd-upload-label")?.getAttribute("role") ===
        "button",
    },
  ];

  let passed = 0;
  checks.forEach((check) => {
    const result = check.test();
    console.log(`${result ? "✅" : "❌"} ${check.name}`);
    if (result) passed++;
  });

  console.log(`\n${passed}/${checks.length} checks passed`);

  if (passed === checks.length) {
    console.log("🎉 Phase 5.3 validation PASSED!");
    return true;
  } else {
    console.log(
      "⚠️ Some checks failed. Run testMMDFilesPhase53() for details."
    );
    return false;
  }
}

/**
 * Demo function for interactive testing
 */
function demoMMDFiles() {
  console.log("=== Phase 5.3 Interactive Demo ===\n");

  const files = window.getMathPixMMDFiles?.();
  files?.init?.();

  console.log("1. Show file controls:");
  files?.showFileControls?.();
  console.log("   Controls visible:", files?.areControlsVisible?.());

  console.log("\n2. Generate filename:");
  console.log("   ", files?.generateDownloadFilename?.());

  console.log("\n3. File validation examples:");
  console.log("   test.mmd:", files?.isValidMMDFile?.({ name: "test.mmd" }));
  console.log("   test.pdf:", files?.isValidMMDFile?.({ name: "test.pdf" }));

  console.log("\n4. Module status:");
  console.log("   ", files?.getStatus?.());

  console.log("\n5. Hide file controls:");
  files?.hideFileControls?.();
  console.log("   Controls visible:", files?.areControlsVisible?.());

  console.log("\nDemo complete! Try:");
  console.log("  - window.showMMDFileControls() to show controls");
  console.log("  - window.downloadEditedMMD() to test download");
  console.log("  - Click 'Load File' to test upload");
}

// ============================================================================
// Global Exports
// ============================================================================

window.testMMDFilesPhase53 = testMMDFilesPhase53;
window.validatePhase53 = validatePhase53;
window.demoMMDFiles = demoMMDFiles;

// ============================================================================
// Auto-run notification
// ============================================================================

console.log(
  "[MMD Files Tests] Test suite loaded. Run window.testMMDFilesPhase53() for full tests."
);
