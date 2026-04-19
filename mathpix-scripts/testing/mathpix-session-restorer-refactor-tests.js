/**
 * @fileoverview MathPix Session Restorer - Refactor Verification Test Suite
 * @module mathpix-session-restorer-refactor-tests
 * @version 1.0.0
 *
 * @description
 * Tests that all ~165 methods exist on MathPixSessionRestorer.prototype.
 * Grouped by target mixin file so we can identify which file failed to load.
 * Run BEFORE refactoring to establish baseline, then AFTER each extraction step.
 *
 * @usage
 * Include this file after mathpix-session-restorer.js in your HTML.
 * Run tests via browser console:
 *   - window.runSessionRestorerRefactorTests()  - Full method existence check
 *   - window.runSessionRestorerMixinTest(n)     - Test specific mixin group (1-17)
 *   - window.showSessionRestorerMethodCount()   - Show total method count
 *
 * @accessibility
 * Test results are logged to console with pass/fail indicators for quick scanning.
 */

(function () {
  "use strict";

  // =========================================================================
  // TEST INFRASTRUCTURE
  // =========================================================================

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const failedMethods = [];

  function resetCounters() {
    totalTests = 0;
    passedTests = 0;
    failedTests = 0;
    failedMethods.length = 0;
  }

  function checkMethod(methodName) {
    totalTests++;
    const exists =
      typeof MathPixSessionRestorer.prototype[methodName] === "function";
    if (exists) {
      passedTests++;
    } else {
      failedTests++;
      failedMethods.push(methodName);
      console.error(`  FAIL: ${methodName} - not found on prototype`);
    }
    return exists;
  }

  function checkProperty(obj, propName, label) {
    totalTests++;
    const exists = obj !== undefined && obj !== null;
    if (exists) {
      passedTests++;
    } else {
      failedTests++;
      failedMethods.push(label || propName);
      console.error(`  FAIL: ${label || propName} - not available`);
    }
    return exists;
  }

  function reportGroup(groupName, groupPassed, groupTotal) {
    const status = groupPassed === groupTotal ? "PASS" : "FAIL";
    console.log(
      `  ${status}: ${groupName} (${groupPassed}/${groupTotal} methods)`,
    );
  }

  // =========================================================================
  // MIXIN GROUP DEFINITIONS
  // =========================================================================

  /**
   * Each group maps to one target mixin file in the refactored structure.
   * Methods are listed in the order they appear in the original file.
   */
  const MIXIN_GROUPS = {
    1: {
      name: "session-restorer-core.js",
      description: "Class + constructor, shared utilities",
      methods: ["getCurrentVersionType", "validateCurrentSessionIndex"],
    },

    2: {
      name: "session-restorer-init.js",
      description: "Initialisation, element caching, event listeners",
      methods: [
        "initialise",
        "subscribeToRecoveryEvents",
        "monitorMathJaxInitialReady",
        "monitorCDNLibraryReady",
        "handleRecoveryRerender",
        "cacheElements",
        "attachEventListeners",
      ],
    },

    3: {
      name: "session-restorer-sessions.js",
      description:
        "Session discovery, banners, recovery, visibility, image save warnings",
      methods: [
        "show",
        "checkForMatchingSessions",
        "deduplicateSessions",
        "_findMostRecentVersion",
        "_renderSessionOption",
        "_renderZipEditOption",
"_attachBannerEventListeners",
        "_computeLazyDiff",
        "_computeDistinguishingLines",
        "showSessionRecoveryBanner",
        "showAutoRestoredBanner",
        "setupAutoRestoredBannerListeners",
        "dismissAutoRestoredBanner",
        "triggerDownloadZIP",
        "showImageSaveWarning",
        "dismissImageSaveWarning",
        "_clearImageSaveWarning",
        "hide",
      ],
    },

    4: {
      name: "session-restorer-sessions.js (version switching)",
      description:
        "Version switching, session recovery — methods also in sessions file",
      methods: [
        "loadZIPContents",
        "loadZIPEdit",
        "showSwitchVersionButton",
        "hideSwitchVersionButton",
        "showDownloadUpdatedButton",
        "hideDownloadUpdatedButton",
        "triggerUpdatedZIPDownload",
        "reshowSessionSelector",
        "getSelectedSessionIndex",
        "clearMatchingSessions",
        "clearStoredSession",
        "applyRecoveredSession",
      ],
    },

    5: {
      name: "session-restorer-file-handling.js",
      description: "Drag/drop, ZIP handling, validation messages",
      methods: [
        "handleDragOver",
        "handleDragLeave",
        "handleDrop",
        "triggerFileSelect",
        "handleFileSelect",
        "handleZIPFile",
        "validateZIPFile",
        "showLoadingState",
        "hideLoadingState",
        "displayValidationMessages",
        "clearValidationMessages",
      ],
    },

    6: {
      name: "session-restorer-diff-preview.js",
      description: "Content preview and diff display",
      methods: [
        "getContentPreview",
        "findFirstDifference",
        "truncatePreview",
        "computeDiff",
"findFirstWordChange",
        "findLastWordChange",
        "getUniqueLines",
        "getFirstMeaningfulLine",
        "renderDiffPreview",
        "escapeHtml",
      ],
    },

    7: {
      name: "session-restorer-edit-dialog.js",
      description: "Edit selection dialog",
      methods: [
        "showEditSelectionDialog",
        "generateOriginalOptionHTML",
        "classifyEditFile",
        "hasAmbiguousEdits",
        "generateEditOptionHTML",
        "confirmEditSelection",
        "cancelEditSelection",
        "hideEditSelectionDialog",
      ],
    },

    8: {
      name: "session-restorer-restore.js",
      description: "Main restoration orchestrator",
      methods: [
        "restoreSession",
        "integratePersistenceModule",
        "updateAIEnhanceButton",
        "setupPersistenceStatusSync",
        "configureUIForSourceType",
        "updateSessionHeader",
      ],
    },

    9: {
      name: "session-restorer-images.js",
      description:
        "Image extraction, MMD rewriting, swap/add/delete, Cache API image persistence",
      methods: [
        "extractAndRestoreImages",
        "rewriteMMDWithBlobUrls",
        "getMMDForAPI",
        "getMMDForStorage",
        "rewriteMMDForZIP",
        "_findImageIdByCdnUrl",
        "rewriteRelativePathsToBlobUrls",
        "reconcileRecoveredImages",
        "swapImage",
        "addImageToDocument",
        "deleteImage",
        "_hasCacheAPI",
        "_cacheImage",
        "_removeCachedImage",
        "_prefetchCachedImages",
        "clearLocalSavesForCurrentZIP",
      ],
    },

    10: {
      name: "session-restorer-display-layer.js",
      description: "Display layer, content loading, preview",
      methods: [
        "initialiseDisplayLayer",
        "toggleImageCollapse",
        "updateCollapseButtonState",
        "updateManageImagesButtonState",
        "loadMMDContent",
        "updatePreview",
      ],
    },

    11: {
      name: "session-restorer-pdf.js",
      description: "PDF rendering, navigation, zoom, view/tab switching",
      methods: [
        "loadSourcePDF",
        "renderPDFForComparison",
        "ensurePDFJSLoaded",
        "loadScript",
        "loadConfidenceVisualiser",
        "startPersistenceSession",
        "sanitiseFilename",
        "switchMmdView",
        "handlePreviewSkip",
        "goToPage",
        "zoomPDF",
        "fitPDFToWidth",
        "rerenderPDFAtScale",
        "toggleSplitPDF",
        "switchTab",
        "lazyLoadDocumentAnalysis",
        "lazyLoadConfidenceVisualiser",
      ],
    },

    12: {
      name: "session-restorer-editor.js",
      description: "Edit mode, fullscreen, focus mode, textarea, screen reader",
      methods: [
        "toggleEditMode",
        "setEditMode",
        "autoResizeTextarea",
        "setupTextareaAutoResize",
        "manageGutterScrollSync",
        "toggleFullscreen",
        "exitFullscreen",
        "enterFocusMode",
        "exitFocusMode",
        "toggleFocusMode",
        "announceToScreenReader",
      ],
    },

    13: {
      name: "session-restorer-confidence.js",
      description: "Confidence highlighting, gutter, line-based editor",
      methods: [
        "handleMmdInput",
        "toggleConfidenceHighlighting",
        "initConfidenceMapper",
        "renderConfidenceGutter",
        "createConfidenceIndicator",
        "clearConfidenceGutter",
        "markConfidenceAsStale",
        "renderLineBasedConfidenceEditor",
        "syncLineEditorToTextarea",
        "destroyLineBasedEditor",
        "handleLineEditorKeydown",
        "createPencilIcon",
        "isLineEdited",
        "updateLineEditStatus",
        "setOriginalMmdContent",
        "scrollToLine",
        "showConfidenceToggle",
        "hideConfidenceToggle",
        "showConfidenceWarning",
        "refreshConfidenceMapping",
      ],
    },

    14: {
      name: "session-restorer-persistence.js",
      description: "Auto-save, undo/redo, file operations, ZIP download",
      methods: [
        "updateSessionStatus",
        "updateDownloadButtonVisibility",
        "scheduleAutoSave",
        "saveContentToStorage",
        "pushToUndoStack",
        "undoEdit",
        "redoEdit",
        "updateUndoRedoButtons",
        "syncFromPersistence",
        "restoreOriginal",
        "clearSession",
        "downloadMmd",
        "handleMmdUpload",
        "downloadUpdatedZIP",
        "setupPersistenceForEdits",
      ],
    },

    15: {
      name: "session-restorer-convert.js",
      description: "Format conversion UI, progress, downloads",
      methods: [
        "updateConvertButtonState",
        "getSelectedConvertFormats",
        "handleConvert",
        "cancelConversion",
        "showConvertProgress",
        "updateConvertProgressItem",
        "updateConvertProgress",
        "hideConvertProgress",
        "showConvertDownloads",
        "triggerDownload",
        "hideConvertDownloads",
        "downloadConvertedFile",
        "showConvertError",
        "showConvertErrors",
        "hideConvertErrors",
        "getFormatLabel",
        "getFormatInfo",
        "updateSelectAllState",
        "downloadAllConvertedFiles",
      ],
    },

    16: {
      name: "session-restorer-file-registration.js",
      description: "File registration, cleanup, utilities",
      methods: [
        "registerSavedMMDVersion",
        "setAIEnhancementMetadata",
        "registerLoadedFile",
        "generateImportedFilename",
        "getLoadedSourceFilename",
        "getLoadedMMDVersions",
        "setupConvertUIForDownload",
        "setupPersistenceForDownload",
        "storeConversionsForDownload",
        "getCurrentMMDContent",
        "getNewConversions",
        "startNewSession",
        "resetToUploadState",
        "cleanup",
        "showNotification",
        "getDebugInfo",
        "validate",
      ],
    },

    17: {
      name: "session-restorer-index.js",
      description: "Singleton, globals, keyboard handler",
      methods: [],
      // This group tests globals rather than prototype methods
    },

    18: {
      name: "session-restorer-session-manager.js",
      description: "Storage dashboard and session manager modal UI",
      methods: [
        "updateStorageDashboard",
        "_collectAllSessions",
        "_groupSessionsByDocument",
        "_formatBytes",
        "showSessionManager",
        "_buildSessionManagerHTML",
        "_attachSessionManagerEvents",
      ],
    },
  };

  // =========================================================================
  // TEST RUNNERS
  // =========================================================================

  /**
   * Run method existence tests for a specific mixin group
   * @param {number} groupNum - Group number (1-17)
   * @returns {Object} Results with passed/total counts
   */
  function runMixinTest(groupNum) {
    const group = MIXIN_GROUPS[groupNum];
    if (!group) {
      console.error(`Unknown mixin group: ${groupNum}`);
      return null;
    }

    console.group(`Mixin ${groupNum}: ${group.name}`);
    console.log(`  ${group.description}`);

    let groupPassed = 0;
    let groupTotal = 0;

    // Test prototype methods
    for (const methodName of group.methods) {
      groupTotal++;
      if (checkMethod(methodName)) {
        groupPassed++;
      }
    }

    // Special tests for index file (group 17)
    if (groupNum === 17) {
      groupTotal += 4;

      // Test singleton getter
      if (
        checkProperty(
          window.getMathPixSessionRestorer,
          "getMathPixSessionRestorer",
          "window.getMathPixSessionRestorer",
        )
      ) {
        groupPassed++;
      }

      // Test class exposure
      if (
        checkProperty(
          window.MathPixSessionRestorer,
          "MathPixSessionRestorer",
          "window.MathPixSessionRestorer",
        )
      ) {
        groupPassed++;
      }

      // Test onclick handlers
      if (
        checkProperty(
          window.toggleResumeMMDFullscreen,
          "toggleResumeMMDFullscreen",
          "window.toggleResumeMMDFullscreen",
        )
      ) {
        groupPassed++;
      }

      if (
        checkProperty(
          window.toggleResumeMMDEdit,
          "toggleResumeMMDEdit",
          "window.toggleResumeMMDEdit",
        )
      ) {
        groupPassed++;
      }
    }

    reportGroup(group.name, groupPassed, groupTotal);
    console.groupEnd();

    return { passed: groupPassed, total: groupTotal };
  }

  /**
   * Run all refactor verification tests
   * @returns {Object} Full results summary
   */
  function runAllRefactorTests() {
    resetCounters();

    console.group("Session Restorer - Refactor Verification Tests");
    console.log(
      "Checking all methods exist on MathPixSessionRestorer.prototype...",
    );
    console.log("");

    // Check class exists first
    if (typeof MathPixSessionRestorer !== "function") {
      console.error("CRITICAL: MathPixSessionRestorer class not found!");
      console.error("Ensure session-restorer-core.js is loaded.");
      console.groupEnd();
      return { passed: 0, total: 1, failed: 1 };
    }

    // Run each mixin group
    const groupResults = {};
    for (let i = 1; i <= 18; i++) {
      groupResults[i] = runMixinTest(i);
    }

    // Summary
    console.log("");
    console.log("=".repeat(60));
    console.log(
      `TOTAL: ${passedTests}/${totalTests} passed` +
        (failedTests > 0 ? ` (${failedTests} FAILED)` : " - ALL CLEAR"),
    );

    if (failedMethods.length > 0) {
      console.log("");
      console.log("Failed methods:");
      for (const method of failedMethods) {
        console.log(`  - ${method}`);
      }
    }

    // Show method count for integrity check
    const protoMethods = Object.getOwnPropertyNames(
      MathPixSessionRestorer.prototype,
    ).filter(
      (name) =>
        typeof MathPixSessionRestorer.prototype[name] === "function" &&
        name !== "constructor",
    );
    console.log("");
    console.log(`Prototype method count: ${protoMethods.length}`);
    console.log("=".repeat(60));
    console.groupEnd();

    return {
      passed: passedTests,
      total: totalTests,
      failed: failedTests,
      failedMethods: [...failedMethods],
      prototypeMethodCount: protoMethods.length,
      groupResults,
    };
  }

  /**
   * Show current prototype method count (quick check)
   */
  function showMethodCount() {
    if (typeof MathPixSessionRestorer !== "function") {
      console.error("MathPixSessionRestorer class not found");
      return 0;
    }

    const protoMethods = Object.getOwnPropertyNames(
      MathPixSessionRestorer.prototype,
    ).filter(
      (name) =>
        typeof MathPixSessionRestorer.prototype[name] === "function" &&
        name !== "constructor",
    );

    // Count expected methods from all groups
    let expectedCount = 0;
    for (let i = 1; i <= 18; i++) {
      expectedCount += MIXIN_GROUPS[i].methods.length;
    }

    console.log(`Prototype methods: ${protoMethods.length}`);
    console.log(`Expected (from test groups): ${expectedCount}`);

    if (protoMethods.length < expectedCount) {
      console.warn(
        `WARNING: ${expectedCount - protoMethods.length} methods may be missing`,
      );
    } else if (protoMethods.length > expectedCount) {
      // Find methods not covered by tests
      const testedMethods = new Set();
      for (let i = 1; i <= 18; i++) {
        for (const method of MIXIN_GROUPS[i].methods) {
          testedMethods.add(method);
        }
      }
      const untested = protoMethods.filter((m) => !testedMethods.has(m));
      if (untested.length > 0) {
        console.warn(`Methods on prototype not covered by refactor tests:`);
        for (const method of untested) {
          console.warn(`  - ${method}`);
        }
      }
    }

    return protoMethods.length;
  }

  // =========================================================================
  // FUNCTIONAL TEST: SESSION MANAGER (Task 5)
  // =========================================================================

  /**
   * Functional tests for the session manager modal methods.
   * Exercises _collectAllSessions, _groupSessionsByDocument, _formatBytes,
   * _buildSessionManagerHTML, and updateStorageDashboard using mock data.
   *
   * Uses a distinctive TEST- prefix for localStorage entries to avoid
   * interfering with real sessions.
   *
   * @returns {Object} Results with passed/total counts
   */
  function testSessionManagerFunctional() {
    let passed = 0;
    let total = 0;
    const failures = [];
    const TEST_PREFIX = "mathpix-resume-session-TEST-";

    function assert(condition, label) {
      total++;
      if (condition) {
        passed++;
      } else {
        failures.push(label);
        console.error(`  FAIL: ${label}`);
      }
    }

    // ---- Helper: clean up any leftover test entries ----
    function cleanupTestEntries() {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(TEST_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
      return keysToRemove.length;
    }

    // ---- Helper: create mock session entry ----
    function createMockSession(suffix, filename, lastModified) {
      const key = TEST_PREFIX + suffix;
      const data = {
        sourceFileName: filename,
        lastModified: lastModified,
        current: "mock MMD content for " + suffix,
        baseline: "mock baseline for " + suffix,
      };
      localStorage.setItem(key, JSON.stringify(data));
      return key;
    }

    console.group("Session Manager — Functional Tests");

    // ---- Pre-cleanup ----
    const priorCleanup = cleanupTestEntries();
    if (priorCleanup > 0) {
      console.log(`  Cleaned ${priorCleanup} leftover test entries`);
    }

    // ---- Get the singleton ----
    let restorer = null;
    try {
      restorer = window.getMathPixSessionRestorer();
      assert(
        restorer !== null && restorer !== undefined,
        "Singleton available via getMathPixSessionRestorer()",
      );
    } catch (err) {
      assert(
        false,
        "Singleton available via getMathPixSessionRestorer() — threw: " +
          err.message,
      );
    }

    if (!restorer) {
      console.error(
        "  Cannot continue without singleton — aborting functional tests",
      );
      console.groupEnd();
      return { passed, total, failures };
    }

    // =========================================================================
    // Test 1: _formatBytes with various values
    // =========================================================================
    console.group("1. _formatBytes");

    assert(restorer._formatBytes(0) === "0 B", "_formatBytes(0) returns '0 B'");
    assert(
      restorer._formatBytes(512) === "512 B",
      "_formatBytes(512) returns '512 B'",
    );
    assert(
      restorer._formatBytes(1023) === "1023 B",
      "_formatBytes(1023) returns '1023 B'",
    );

    const kb100 = restorer._formatBytes(100 * 1024);
    assert(
      kb100 === "100 KB",
      "_formatBytes(102400) returns '100 KB', got: " + kb100,
    );

    const mb1 = restorer._formatBytes(1024 * 1024);
    assert(
      mb1 === "1.0 MB",
      "_formatBytes(1048576) returns '1.0 MB', got: " + mb1,
    );

    const mb2_5 = restorer._formatBytes(2.5 * 1024 * 1024);
    assert(
      mb2_5 === "2.5 MB",
      "_formatBytes(2621440) returns '2.5 MB', got: " + mb2_5,
    );

    console.groupEnd();

    // =========================================================================
    // Test 2: _collectAllSessions with mock data
    // =========================================================================
    console.group("2. _collectAllSessions");

    // Create 3 mock sessions across 2 documents
    const key1 = createMockSession("doc1-v1", "algebra-notes.zip", 1000);
    const key2 = createMockSession("doc1-v2", "algebra-notes.zip", 2000);
    const key3 = createMockSession("doc2-v1", "calculus-exam.zip", 1500);

    const collected = restorer._collectAllSessions();

    // Filter to just our test entries
    const testSessions = collected.filter((s) => s.key.startsWith(TEST_PREFIX));

    assert(
      testSessions.length === 3,
      "_collectAllSessions finds 3 test sessions, got: " + testSessions.length,
    );

    // Check they're sorted newest first (2000, 1500, 1000)
    assert(
      testSessions[0].lastModified >= testSessions[1].lastModified,
      "Sessions sorted newest first (first >= second)",
    );
    assert(
      testSessions[1].lastModified >= testSessions[2].lastModified,
      "Sessions sorted newest first (second >= third)",
    );

    // Check structure of first entry
    const first = testSessions[0];
    assert(typeof first.key === "string", "Session has key (string)");
    assert(typeof first.filename === "string", "Session has filename (string)");
    assert(typeof first.baseName === "string", "Session has baseName (string)");
    assert(
      typeof first.lastModified === "number",
      "Session has lastModified (number)",
    );
    assert(
      typeof first.bytes === "number" && first.bytes > 0,
      "Session has bytes (positive number)",
    );

    // Check baseName strips extension
    const algebraSession = testSessions.find(
      (s) => s.filename === "algebra-notes.zip",
    );
    assert(
      algebraSession && algebraSession.baseName === "algebra-notes",
      "baseName strips .zip extension",
    );

    console.groupEnd();

    // =========================================================================
    // Test 3: _groupSessionsByDocument
    // =========================================================================
    console.group("3. _groupSessionsByDocument");

    const groups = restorer._groupSessionsByDocument(testSessions);

    assert(groups instanceof Map, "_groupSessionsByDocument returns a Map");
    assert(
      groups.size === 2,
      "Groups 3 sessions into 2 documents, got: " + groups.size,
    );

    const algebraGroup = groups.get("algebra-notes");
    assert(
      algebraGroup && algebraGroup.sessions.length === 2,
      "'algebra-notes' group has 2 sessions",
    );
    assert(
      algebraGroup && algebraGroup.totalBytes > 0,
      "'algebra-notes' group has positive totalBytes",
    );

    const calculusGroup = groups.get("calculus-exam");
    assert(
      calculusGroup && calculusGroup.sessions.length === 1,
      "'calculus-exam' group has 1 session",
    );

    console.groupEnd();

    // =========================================================================
    // Test 4: _buildSessionManagerHTML
    // =========================================================================
    console.group("4. _buildSessionManagerHTML");

    // Check escapeHtml is available (dependency from diff-preview mixin)
    assert(
      typeof restorer.escapeHtml === "function",
      "escapeHtml dependency available",
    );

    const html = restorer._buildSessionManagerHTML(
      groups,
      testSessions.length,
      null,
    );

    assert(
      typeof html === "string" && html.length > 0,
      "_buildSessionManagerHTML returns non-empty string",
    );

    // Parse into a temporary container to inspect structure
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    // Should have a select-all checkbox
    const selectAll = tempDiv.querySelector("#sm-select-all");
    assert(
      selectAll !== null,
      "HTML contains select-all checkbox (#sm-select-all)",
    );

    // Should have a delete button
    const deleteBtn = tempDiv.querySelector("#sm-delete-btn");
    assert(deleteBtn !== null, "HTML contains delete button (#sm-delete-btn)");
    assert(
      deleteBtn && deleteBtn.disabled === true,
      "Delete button starts disabled",
    );

    // Should have fieldsets for each document group
    const fieldsets = tempDiv.querySelectorAll(
      "fieldset.session-manager-group",
    );
    assert(
      fieldsets.length === 2,
      "HTML contains 2 group fieldsets, got: " + fieldsets.length,
    );

    // Should have session checkboxes
    const sessionCbs = tempDiv.querySelectorAll(".sm-session-checkbox");
    assert(
      sessionCbs.length === 3,
      "HTML contains 3 session checkboxes, got: " + sessionCbs.length,
    );

    // None should be disabled (no currentKey passed)
    const disabledCbs = tempDiv.querySelectorAll(
      ".sm-session-checkbox:disabled",
    );
    assert(
      disabledCbs.length === 0,
      "No checkboxes disabled when currentKey is null",
    );

    // Test with a currentKey — that checkbox should be disabled
    const htmlWithProtected = restorer._buildSessionManagerHTML(
      groups,
      testSessions.length,
      key1,
    );
    const tempDiv2 = document.createElement("div");
    tempDiv2.innerHTML = htmlWithProtected;

    const protectedCbs = tempDiv2.querySelectorAll(
      ".sm-session-checkbox:disabled",
    );
    assert(
      protectedCbs.length === 1,
      "1 checkbox disabled when currentKey matches, got: " +
        protectedCbs.length,
    );

    // Check the protected session has a badge or indicator
    const protectedItem = tempDiv2.querySelector(
      `.sm-session-checkbox[data-session-key="${key1}"]`,
    );
    if (protectedItem) {
      const listItem = protectedItem.closest("li");
      const hasBadge =
        listItem &&
        (listItem.querySelector(".session-protected-badge") !== null ||
          listItem.textContent.includes("Current") ||
          listItem.textContent.includes("current") ||
          listItem.textContent.includes("Active") ||
          listItem.textContent.includes("active"));
      assert(hasBadge, "Protected session has a visual indicator");
    } else {
      assert(false, "Protected session checkbox found by data-session-key");
    }

    console.groupEnd();

    // =========================================================================
    // Test 5: updateStorageDashboard (with mock DOM elements)
    // =========================================================================
    console.group("5. updateStorageDashboard");

    // Save original element references
    const origBar = restorer.elements.storageBar;
    const origSummary = restorer.elements.storageSummary;
    const origDashboard = restorer.elements.storageDashboard;

    // Create mock DOM elements
    const mockBar = document.createElement("div");
    mockBar.setAttribute("aria-valuenow", "0");
    mockBar.style.width = "0%";

    const mockSummary = document.createElement("span");
    const mockDashboard = document.createElement("div");
    mockDashboard.hidden = true;

    // Temporarily swap in mock elements
    restorer.elements.storageBar = mockBar;
    restorer.elements.storageSummary = mockSummary;
    restorer.elements.storageDashboard = mockDashboard;

    try {
      restorer.updateStorageDashboard();

      // We have 3 test sessions, so dashboard should be visible
      assert(
        mockDashboard.hidden === false,
        "Dashboard shown when sessions exist",
      );
      assert(mockBar.style.width !== "0%", "Storage bar width updated from 0%");
      assert(mockSummary.textContent.length > 0, "Summary text populated");
      assert(
        mockSummary.textContent.includes("session"),
        "Summary mentions 'session'",
      );
      assert(
        mockSummary.textContent.includes("document"),
        "Summary mentions 'document'",
      );

      const ariaValue = parseInt(mockBar.getAttribute("aria-valuenow"), 10);
      assert(
        !isNaN(ariaValue) && ariaValue >= 0,
        "aria-valuenow is a valid number",
      );
    } finally {
      // Restore original elements regardless of test outcome
      restorer.elements.storageBar = origBar;
      restorer.elements.storageSummary = origSummary;
      restorer.elements.storageDashboard = origDashboard;
    }

    console.groupEnd();

    // =========================================================================
    // Cleanup
    // =========================================================================
    const cleanedCount = cleanupTestEntries();
    console.log(`  Cleaned up ${cleanedCount} test entries from localStorage`);

    // =========================================================================
    // Summary
    // =========================================================================
    console.log("");
    console.log("=".repeat(60));
    console.log(
      `SESSION MANAGER FUNCTIONAL: ${passed}/${total} passed` +
        (failures.length > 0 ? ` (${failures.length} FAILED)` : " — ALL CLEAR"),
    );

    if (failures.length > 0) {
      console.log("Failed tests:");
      for (const f of failures) {
        console.log(`  - ${f}`);
      }
    }
    console.log("=".repeat(60));
    console.groupEnd();

    return { passed, total, failures };
  }

  // =========================================================================
  // GLOBAL EXPOSURE
  // =========================================================================

  window.runSessionRestorerRefactorTests = runAllRefactorTests;
  window.runSessionRestorerMixinTest = runMixinTest;
  window.showSessionRestorerMethodCount = showMethodCount;
  window.testSessionManagerFunctional = testSessionManagerFunctional;

  console.log(
    "[SessionRestorerRefactorTests] Loaded. Run window.runSessionRestorerRefactorTests() to verify.",
  );
})();
