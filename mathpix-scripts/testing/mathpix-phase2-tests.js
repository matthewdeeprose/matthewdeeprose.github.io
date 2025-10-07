/**
 * @fileoverview MathPix Phase 2 Testing Suite - User-configurable processing options
 * @module MathPixPhase2Tests
 * @author MathPix Development Team
 * @version 2.0.0
 * @since Phase 2
 *
 * @description
 * Comprehensive testing suite for Phase 2 user-configurable processing options.
 * Tests UI element availability, preference persistence, API integration, and
 * complete workflow functionality for the Text API processing options.
 *
 * Test Coverage:
 * - UI element caching and availability
 * - Preference loading from localStorage
 * - Preference application to UI controls
 * - Preference saving and persistence
 * - Delimiter configuration validation
 * - API integration with user preferences
 * - Complete workflow simulation
 *
 * Console Commands:
 * - window.testMathPixPhase2UIElements() - Test UI element availability
 * - window.testMathPixPhase2Preferences() - Test preference loading/storage
 * - window.testMathPixPhase2PreferenceApplication() - Test preference UI application
 * - window.testMathPixPhase2Delimiters() - Verify delimiter configuration
 * - window.testMathPixPhase2Workflow() - Simulate complete workflow
 * - window.testMathPixPhase2Complete() - Run all tests
 * - window.validatePhase2Complete() - Quick validation
 */

// Logging configuration (module level)
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;

function shouldLog(level) {
  return level <= DEFAULT_LOG_LEVEL;
}
function logError(msg, ...args) {
  if (shouldLog(0)) console.error(msg, ...args);
}
function logWarn(msg, ...args) {
  if (shouldLog(1)) console.warn(msg, ...args);
}
function logInfo(msg, ...args) {
  if (shouldLog(2)) console.log(msg, ...args);
}
function logDebug(msg, ...args) {
  if (shouldLog(3)) console.log(msg, ...args);
}

/**
 * Test 1: UI Element Availability
 * Verifies all Phase 2 UI elements are cached and accessible
 */
window.testMathPixPhase2UIElements = function () {
  console.group("🧪 Test 1: UI Element Availability");

  try {
    const controller = window.getMathPixController();
    if (!controller) {
      logError("❌ MathPix controller not available");
      console.groupEnd();
      return false;
    }

    const checks = {
      "Processing options container":
        !!controller.uiManager.controller.elements.processingOptions,
      "Equation numbering checkbox":
        !!controller.uiManager.controller.elements.equationNumberingCheckbox,
      "Delimiter radios (2 expected)":
        controller.uiManager.controller.elements.delimiterRadios?.length === 2,
      "Page info checkbox":
        !!controller.uiManager.controller.elements.pageInfoCheckbox,
      "Preferences listeners flag":
        controller.uiManager._preferencesListenersAttached !== undefined,
    };

    let allPassed = true;
    Object.entries(checks).forEach(([name, passed]) => {
      console.log(`${passed ? "✅" : "❌"} ${name}`);
      if (!passed) allPassed = false;
    });

    console.groupEnd();
    return allPassed;
  } catch (e) {
    logError("❌ Test failed with error:", e);
    console.groupEnd();
    return false;
  }
};

/**
 * Test 2: Preference Loading and Storage
 * Tests localStorage integration for preference persistence
 */
window.testMathPixPhase2Preferences = function () {
  console.group("🧪 Test 2: Preference Loading and Storage");

  try {
    const controller = window.getMathPixController();

    // Test loading
    const loadedPrefs = controller.uiManager.loadUserPreferences();
    console.log("✅ Loaded preferences:", loadedPrefs);

    // Verify structure
    const hasRequiredKeys =
      loadedPrefs.hasOwnProperty("equationNumbering") &&
      loadedPrefs.hasOwnProperty("delimiterFormat") &&
      loadedPrefs.hasOwnProperty("includePageInfo");

    console.log(`${hasRequiredKeys ? "✅" : "❌"} Preference structure valid`);

    // Test getting current values
    const currentPrefs = controller.uiManager.getCurrentPreferences();
    console.log("✅ Current UI preferences:", currentPrefs);

    // Test saving
    controller.uiManager.saveUserPreferences();
    console.log("✅ Preferences saved to localStorage");

    // Verify localStorage
    const stored = {
      equationNumbering: localStorage.getItem("mathpix-equation-numbering"),
      delimiterFormat: localStorage.getItem("mathpix-delimiter-format"),
      includePageInfo: localStorage.getItem("mathpix-page-info"),
    };
    console.log("✅ localStorage values:", stored);

    const allStored = Object.values(stored).every((val) => val !== null);
    console.log(
      `${allStored ? "✅" : "❌"} All preferences persisted to localStorage`
    );

    console.groupEnd();
    return hasRequiredKeys && allStored;
  } catch (e) {
    logError("❌ Test failed with error:", e);
    console.groupEnd();
    return false;
  }
};

/**
 * Test 3: Preference Application to UI
 * Verifies preferences correctly update UI controls
 */
window.testMathPixPhase2PreferenceApplication = function () {
  console.group("🧪 Test 3: Preference Application");

  try {
    const controller = window.getMathPixController();

    // Test different preference combinations
    const testCases = [
      {
        equationNumbering: true,
        delimiterFormat: "latex",
        includePageInfo: true,
      },
      {
        equationNumbering: false,
        delimiterFormat: "markdown",
        includePageInfo: false,
      },
      {
        equationNumbering: true,
        delimiterFormat: "markdown",
        includePageInfo: true,
      },
      {
        equationNumbering: false,
        delimiterFormat: "latex",
        includePageInfo: false,
      },
    ];

    let allPassed = true;

    testCases.forEach((testPrefs, i) => {
      console.log(`\nTest case ${i + 1}:`, testPrefs);

      // Apply preferences
      controller.uiManager.applyPreferencesToUI(testPrefs);

      // Verify application
      const applied = controller.uiManager.getCurrentPreferences();

      const match =
        applied.equationNumbering === testPrefs.equationNumbering &&
        applied.delimiterFormat === testPrefs.delimiterFormat &&
        applied.includePageInfo === testPrefs.includePageInfo;

      console.log(
        `${match ? "✅" : "❌"} Preferences ${
          match ? "applied correctly" : "MISMATCH"
        }`
      );
      if (!match) {
        console.log("Expected:", testPrefs);
        console.log("Got:", applied);
        allPassed = false;
      }
    });

    console.groupEnd();
    return allPassed;
  } catch (e) {
    logError("❌ Test failed with error:", e);
    console.groupEnd();
    return false;
  }
};

/**
 * Test 4: Delimiter Configuration
 * Validates delimiter format definitions and rendering compatibility
 */
window.testMathPixPhase2Delimiters = function () {
  console.group("🧪 Test 4: Delimiter Configuration");

  const DELIMITER_CONFIG = {
    latex: {
      inline: ["\\(", "\\)"],
      display: ["\\[", "\\]"],
    },
    markdown: {
      inline: ["$", "$"],
      display: ["$$", "$$"],
    },
  };

  console.log("LaTeX delimiters:");
  console.log("  Inline:", DELIMITER_CONFIG.latex.inline.join(" ... "));
  console.log("  Display:", DELIMITER_CONFIG.latex.display.join(" ... "));

  console.log("\nMarkdown delimiters:");
  console.log("  Inline:", DELIMITER_CONFIG.markdown.inline.join(" ... "));
  console.log("  Display:", DELIMITER_CONFIG.markdown.display.join(" ... "));

  // Test rendering compatibility
  let renderingCompatible = true;

  if (window.Prism && window.Prism.languages.latex) {
    const testLatex = String.raw`\( x^2 + y^2 = z^2 \)`;
    const testMarkdown = String.raw`$ x^2 + y^2 = z^2 $`;

    console.log("\n✅ Prism.js rendering test:");
    const latexHighlighted = Prism.highlight(
      testLatex,
      Prism.languages.latex,
      "latex"
    );
    const markdownHighlighted = Prism.highlight(
      testMarkdown,
      Prism.languages.latex,
      "latex"
    );

    console.log("  LaTeX:", latexHighlighted.substring(0, 100) + "...");
    console.log("  Markdown:", markdownHighlighted.substring(0, 100) + "...");

    // Check both are highlighted (contain span tags)
    const bothHighlighted =
      latexHighlighted.includes("<span") &&
      markdownHighlighted.includes("<span");
    console.log(
      `${
        bothHighlighted ? "✅" : "❌"
      } Both delimiter formats highlighted by Prism.js`
    );
    renderingCompatible = renderingCompatible && bothHighlighted;
  } else {
    console.log("⚠️ Prism.js not available, skipping syntax highlighting test");
  }

  if (window.MathJax && window.MathJax.config) {
    const delims = MathJax.config.tex?.inlineMath || [];
    console.log("\n✅ MathJax configured delimiters:", delims);

    // Check MathJax supports both delimiter types
    const hasLatex = delims.some(
      (pair) => pair[0] === "\\(" && pair[1] === "\\)"
    );
    const hasMarkdown = delims.some(
      (pair) => pair[0] === "$" && pair[1] === "$"
    );

    console.log(`${hasLatex ? "✅" : "❌"} LaTeX delimiters in MathJax config`);
    console.log(
      `${hasMarkdown ? "✅" : "❌"} Markdown delimiters in MathJax config`
    );

    renderingCompatible = renderingCompatible && hasLatex && hasMarkdown;
  } else {
    console.log("⚠️ MathJax not available, skipping MathJax delimiter test");
  }

  console.groupEnd();
  return renderingCompatible;
};

/**
 * Test 5: Complete Workflow Simulation
 * Simulates full user workflow from showing options to persistence
 */
window.testMathPixPhase2Workflow = function () {
  console.group("🧪 Test 5: Complete Workflow Simulation");

  try {
    const controller = window.getMathPixController();

    console.log("Step 1: Show processing options");
    controller.uiManager.showProcessingOptions();

    const optionsVisible =
      controller.uiManager.controller.elements.processingOptions.style
        .display !== "none";
    console.log(
      `${optionsVisible ? "✅" : "❌"} Processing options panel visible`
    );

    console.log("\nStep 2: Get default preferences");
    const defaults = controller.uiManager.getCurrentPreferences();
    console.log("  Default preferences:", defaults);

    console.log("\nStep 3: Modify preferences in UI");
    const testPrefs = {
      equationNumbering: false,
      delimiterFormat: "markdown",
      includePageInfo: false,
    };
    controller.uiManager.applyPreferencesToUI(testPrefs);

    console.log("\nStep 4: Get modified preferences");
    const modified = controller.uiManager.getCurrentPreferences();
    console.log("  Modified preferences:", modified);

    const modificationsApplied =
      modified.equationNumbering === testPrefs.equationNumbering &&
      modified.delimiterFormat === testPrefs.delimiterFormat &&
      modified.includePageInfo === testPrefs.includePageInfo;

    console.log(
      `${modificationsApplied ? "✅" : "❌"} Modifications applied correctly`
    );

    console.log("\nStep 5: Save preferences");
    controller.uiManager.saveUserPreferences();

    console.log("\nStep 6: Hide and re-show options");
    controller.uiManager.hideProcessingOptions();
    const hiddenAfterHide =
      controller.uiManager.controller.elements.processingOptions.style
        .display === "none";
    console.log(
      `${
        hiddenAfterHide ? "✅" : "❌"
      } Options hidden after hideProcessingOptions()`
    );

    controller.uiManager.showProcessingOptions();
    const shownAfterShow =
      controller.uiManager.controller.elements.processingOptions.style
        .display !== "none";
    console.log(
      `${
        shownAfterShow ? "✅" : "❌"
      } Options shown after showProcessingOptions()`
    );

    console.log("\nStep 7: Verify persistence");
    const reloaded = controller.uiManager.getCurrentPreferences();
    console.log("  Reloaded preferences:", reloaded);

    const persisted =
      reloaded.equationNumbering === modified.equationNumbering &&
      reloaded.delimiterFormat === modified.delimiterFormat &&
      reloaded.includePageInfo === modified.includePageInfo;

    console.log(
      `${persisted ? "✅" : "❌"} Preferences ${
        persisted ? "persisted correctly" : "LOST"
      }`
    );

    console.log("\nStep 8: Verify event listeners attached");
    const listenersAttached =
      controller.uiManager._preferencesListenersAttached === true;
    console.log(
      `${listenersAttached ? "✅" : "❌"} Auto-save event listeners attached`
    );

    // Restore defaults for next test
    controller.uiManager.applyPreferencesToUI({
      equationNumbering: true,
      delimiterFormat: "latex",
      includePageInfo: true,
    });
    controller.uiManager.saveUserPreferences();

    const allStepsPassed =
      optionsVisible &&
      modificationsApplied &&
      hiddenAfterHide &&
      shownAfterShow &&
      persisted &&
      listenersAttached;

    console.groupEnd();
    return allStepsPassed;
  } catch (e) {
    logError("❌ Test failed with error:", e);
    console.groupEnd();
    return false;
  }
};

/**
 * Run all Phase 2 tests
 * Executes complete test suite with summary report
 */
window.testMathPixPhase2Complete = function () {
  console.clear();
  console.log("🚀 Running MathPix Phase 2 Complete Test Suite\n");
  console.log("Phase 2: User-Configurable Processing Options (Text API)");
  console.log("Testing: Equation numbering, Delimiter format, Page info\n");

  const tests = [
    { name: "UI Element Availability", fn: window.testMathPixPhase2UIElements },
    {
      name: "Preference Loading/Storage",
      fn: window.testMathPixPhase2Preferences,
    },
    {
      name: "Preference Application",
      fn: window.testMathPixPhase2PreferenceApplication,
    },
    { name: "Delimiter Configuration", fn: window.testMathPixPhase2Delimiters },
    { name: "Complete Workflow", fn: window.testMathPixPhase2Workflow },
  ];

  const results = tests.map((test) => {
    const passed = test.fn();
    return { name: test.name, passed };
  });

  console.log("\n" + "=".repeat(60));
  console.log("📊 Test Results Summary:");
  console.log("=".repeat(60));
  results.forEach((r) => {
    console.log(`${r.passed ? "✅" : "❌"} ${r.name}`);
  });

  const allPassed = results.every((r) => r.passed);
  const passedCount = results.filter((r) => r.passed).length;

  console.log("=".repeat(60));
  console.log(`Result: ${passedCount}/${results.length} tests passed`);
  console.log("=".repeat(60));
  console.log(
    allPassed
      ? "🎉 ALL TESTS PASSED - Phase 2 Complete!"
      : "⚠️ SOME TESTS FAILED - Review failures above"
  );

  return allPassed;
};

/**
 * Quick validation
 * Alias for complete test suite
 */
window.validatePhase2Complete = function () {
  return window.testMathPixPhase2Complete();
};
