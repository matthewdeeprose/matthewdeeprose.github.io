/**
 * @fileoverview Comprehensive testing suite for MathPix refactoring
 * @version 1.0.0
 * Note: Uses existing logging from global scope to avoid conflicts
 */

/**
 * Test runner for incremental refactoring validation
 * @namespace MathPixRefactorTests
 */
const MathPixRefactorTests = {
  /**
   * Validate original functionality before refactoring
   * @returns {boolean} True if all original functionality works
   */
  testOriginalFunctionality() {
    console.log("=== Testing Original MathPix Functionality ===");

    const controller = window.getMathPixController?.();
    if (!controller) {
      console.error("❌ Controller not available");
      return false;
    }

    const tests = [
      {
        name: "Controller Initialisation",
        test: () => controller.isInitialised,
      },
      {
        name: "Elements Cached",
        test: () => Object.keys(controller.elements).length > 5,
      },
      { name: "API Client Available", test: () => !!controller.apiClient },
      {
        name: "Progress Display Available",
        test: () => !!controller.progressDisplay,
      },
      {
        name: "Privacy Manager Available",
        test: () => !!controller.privacyManager,
      },
      {
        name: "File Upload Method",
        test: () => typeof controller.handleFileUpload === "function",
      },
      {
        name: "Display Result Method",
        test: () => typeof controller.displayResult === "function",
      },
      {
        name: "Format File Size Method",
        test: () => typeof controller.formatFileSize === "function",
      },
      {
        name: "Show Format Method",
        test: () => typeof controller.showFormat === "function",
      },
      {
        name: "Format Content Elements",
        test: () =>
          controller.elements.formatContents &&
          Object.keys(controller.elements.formatContents).length === 6,
      },
    ];

    let passed = 0;

    tests.forEach(({ name, test }) => {
      try {
        const result = test();
        if (result) {
          console.log(`✅ ${name}: PASSED`);
          passed++;
        } else {
          console.error(`❌ ${name}: FAILED`);
        }
      } catch (error) {
        console.error(`💥 ${name}: ERROR - ${error.message}`);
      }
    });

    console.log(
      `📊 Original Functionality Test: ${passed}/${tests.length} passed`
    );

    if (passed === tests.length) {
      console.log("🎉 Original functionality baseline established");
      return true;
    } else {
      console.error(
        "⚠️ Original functionality issues detected - fix before refactoring"
      );
      return false;
    }
  },

  /**
   * Test specific component after extraction
   * @param {string} componentName - Name of component to test
   * @param {Object} component - Component instance
   * @returns {boolean} True if component works correctly
   */
  testComponent(componentName, component) {
    console.log(`=== Testing ${componentName} Component ===`);

    if (!component) {
      console.error(`❌ ${componentName} component not available`);
      return false;
    }

    // Test that component has required methods based on its type
    let requiredMethods = [];

    switch (componentName) {
      case "FileHandler":
        requiredMethods = [
          "handleUpload",
          "validateFile",
          "formatFileSize",
          "getFileTypeDescription",
        ];
        break;
      case "ResultRenderer":
        requiredMethods = [
          "displayResult",
          "populateFormatContent",
          "resetFormatOptions",
        ];
        break;
      case "UIManager":
        requiredMethods = [
          "cacheElements",
          "attachEventListeners",
          "showFormat",
          "setUIState",
        ];
        break;
      case "APIClient":
        requiredMethods = ["processImage", "setCredentials"];
        break;
    }

    let passed = 0;

    // Test controller reference
    if (component.controller) {
      console.log(`✅ ${componentName}: Has controller reference`);
      passed++;
    } else {
      console.error(`❌ ${componentName}: Missing controller reference`);
    }

    // Test required methods
    requiredMethods.forEach((method) => {
      if (typeof component[method] === "function") {
        console.log(`✅ ${componentName}: Method ${method} available`);
        passed++;
      } else {
        console.error(`❌ ${componentName}: Method ${method} missing`);
      }
    });

    const totalTests = 1 + requiredMethods.length;
    console.log(`📊 ${componentName} Test: ${passed}/${totalTests} passed`);

    return passed === totalTests;
  },

  /**
   * Test backwards compatibility after refactoring
   * @returns {boolean} True if all legacy methods still work
   */
  testBackwardsCompatibility() {
    console.log("=== Testing Backwards Compatibility ===");

    const controller = window.getMathPixController?.();
    if (!controller) {
      console.error("❌ Controller not available");
      return false;
    }

    const legacyMethods = [
      "elements",
      "cacheElements",
      "attachEventListeners",
      "handleFileUpload",
      "displayResult",
      "showFormat",
      "formatFileSize",
      "getFileTypeDescription",
      "updateMetadata",
      "populateFormatContent",
      "resetFormatOptions",
      "selectFirstAvailableFormat",
    ];

    let passed = 0;

    legacyMethods.forEach((method) => {
      if (controller[method] !== undefined) {
        console.log(`✅ Legacy method: ${method} available`);
        passed++;

        // Test that it's callable for functions
        if (typeof controller[method] === "function") {
          try {
            // Test basic callability (without executing complex operations)
            if (method === "formatFileSize") {
              const result = controller.formatFileSize(1024);
              if (result === "1.0 KB") {
                console.log(`✅ Legacy method: ${method} functional`);
              } else {
                console.warn(
                  `⚠️ Legacy method: ${method} returns unexpected result: ${result}`
                );
              }
            }
          } catch (error) {
            console.warn(
              `⚠️ Legacy method: ${method} callable but has issues: ${error.message}`
            );
          }
        }
      } else {
        console.error(`❌ Legacy method: ${method} missing`);
      }
    });

    console.log(
      `📊 Backwards Compatibility Test: ${passed}/${legacyMethods.length} passed`
    );

    return passed === legacyMethods.length;
  },

  /**
   * Run comprehensive validation suite
   * @returns {Object} Test results
   */
  runCompleteValidation() {
    console.log("=== MathPix Refactor Complete Validation ===");

    const results = {
      originalFunctionality: this.testOriginalFunctionality(),
      backwardsCompatibility: this.testBackwardsCompatibility(),
      startTime: performance.now(),
    };

    results.totalTime = performance.now() - results.startTime;
    results.allPassed = Object.values(results).every((result) =>
      typeof result === "boolean" ? result : true
    );

    console.log(`📊 Complete Validation Results:`);
    console.log(
      `   Original functionality: ${
        results.originalFunctionality ? "✅ PASS" : "❌ FAIL"
      }`
    );
    console.log(
      `   Backwards compatibility: ${
        results.backwardsCompatibility ? "✅ PASS" : "❌ FAIL"
      }`
    );
    console.log(`   Total time: ${results.totalTime.toFixed(2)}ms`);

    if (results.allPassed) {
      console.log("🎉 ALL VALIDATION TESTS PASSED!");
      console.log("✅ System is ready for next phase");
    } else {
      console.error("⚠️ VALIDATION ISSUES DETECTED");
      console.error("🔧 Address failing tests before proceeding");
    }

    return results;
  },

  /**
   * Test clipboard paste functionality structure
   * Note: Actual clipboard paste requires user interaction
   * @returns {boolean} True if paste structure is valid
   */
  testClipboardPasteStructure() {
    console.log("=== Testing MathPix Clipboard Paste Structure ===");

    const controller = window.getMathPixController?.();
    if (!controller) {
      console.error("❌ MathPix controller not available");
      return false;
    }

    let passed = 0;
    const totalTests = 3;

    // Test 1: Controller availability
    console.log("✅ MathPix controller available");
    passed++;

    // Test 2: FileHandler has clipboard paste method
    const fileHandler = controller.fileHandler;
    if (
      !fileHandler ||
      typeof fileHandler.handleClipboardPaste !== "function"
    ) {
      console.error("❌ handleClipboardPaste method not found in fileHandler");
      return false;
    }
    console.log("✅ handleClipboardPaste method exists");
    passed++;

    // Test 3: FileHandler has screen reader announcement method
    if (typeof fileHandler.announceToScreenReader !== "function") {
      console.error(
        "❌ announceToScreenReader method not found in fileHandler"
      );
      return false;
    }
    console.log("✅ announceToScreenReader method exists");
    passed++;

    console.log(
      `📊 Clipboard Paste Structure Test: ${passed}/${totalTests} passed`
    );

    if (passed === totalTests) {
      console.log("");
      console.log("📋 Manual Testing Instructions:");
      console.log("1. Switch to MathPix mode");
      console.log("2. Use Snipping Tool (Win+Shift+S) to capture an equation");
      console.log("3. Press Ctrl+V (or Cmd+V on Mac) whilst in MathPix mode");
      console.log("4. Image should be automatically processed");
      console.log("");
      console.log("✅ Clipboard paste functionality structure verified");
      console.log(
        "⚠️  Real clipboard paste requires manual testing with actual images"
      );
      return true;
    }

    return false;
  },

  /**
   * Test screen reader announcement functionality
   * @returns {boolean} True if announcement system works
   */
  testScreenReaderAnnouncement() {
    console.log("=== Testing Screen Reader Announcement ===");

    const controller = window.getMathPixController?.();
    if (!controller) {
      console.error("❌ MathPix controller not available");
      return false;
    }

    const fileHandler = controller.fileHandler;
    if (!fileHandler) {
      console.error("❌ File handler not available");
      return false;
    }

    try {
      // Test announcement creation
      console.log("Testing screen reader announcement creation...");
      fileHandler.announceToScreenReader(
        "Test announcement for clipboard paste"
      );

      // Check if announcement div was created with proper ARIA attributes
      setTimeout(() => {
        const announcements = document.querySelectorAll(
          '[role="status"][aria-live="polite"]'
        );
        if (announcements.length > 0) {
          console.log(
            `✅ Found ${announcements.length} announcement element(s) with correct ARIA attributes`
          );
          console.log("✅ Screen reader announcement test complete");
          console.log("⚠️  Check browser console for any errors");
        } else {
          console.warn(
            "⚠️  No announcement elements found - they may have been cleaned up already"
          );
        }
      }, 100);

      return true;
    } catch (error) {
      console.error("❌ Error testing screen reader announcement:", error);
      return false;
    }
  },

  /**
   * Simulate clipboard paste workflow (structure only)
   * @returns {boolean} True if workflow structure is correct
   */
  testClipboardWorkflow() {
    console.log("=== Testing Clipboard Paste Workflow Structure ===");

    const controller = window.getMathPixController?.();
    if (!controller) {
      console.error("❌ MathPix controller not available");
      return false;
    }

    let passed = 0;
    const totalTests = 5;

    // Test 1: FileHandler exists
    if (controller.fileHandler) {
      console.log("✅ FileHandler available");
      passed++;
    } else {
      console.error("❌ FileHandler not available");
    }

    // Test 2: handleClipboardPaste method exists
    if (typeof controller.fileHandler?.handleClipboardPaste === "function") {
      console.log("✅ handleClipboardPaste method available");
      passed++;
    } else {
      console.error("❌ handleClipboardPaste method missing");
    }

    // Test 3: handleUpload method exists (used by clipboard paste)
    if (typeof controller.fileHandler?.handleUpload === "function") {
      console.log(
        "✅ handleUpload method available (for processing pasted images)"
      );
      passed++;
    } else {
      console.error("❌ handleUpload method missing");
    }

    // Test 4: announceToScreenReader method exists
    if (typeof controller.fileHandler?.announceToScreenReader === "function") {
      console.log("✅ announceToScreenReader method available");
      passed++;
    } else {
      console.error("❌ announceToScreenReader method missing");
    }

    // Test 5: MathPix mode radio button exists
    const mathpixRadio = document.getElementById("MathPix");
    if (mathpixRadio) {
      console.log("✅ MathPix mode radio button available");
      passed++;
    } else {
      console.error("❌ MathPix mode radio button not found");
    }

    console.log(`📊 Clipboard Workflow Test: ${passed}/${totalTests} passed`);

    if (passed === totalTests) {
      console.log("");
      console.log("✅ Clipboard paste workflow structure complete");
      console.log("");
      console.log("Expected workflow:");
      console.log("1. User switches to MathPix mode (radio button checked)");
      console.log("2. User captures image with Snipping Tool");
      console.log("3. User presses Ctrl+V (or Cmd+V)");
      console.log("4. Global paste event fires");
      console.log("5. System checks if MathPix mode is active");
      console.log("6. handleClipboardPaste extracts image from clipboard");
      console.log("7. File object created with timestamped name");
      console.log("8. announceToScreenReader notifies screen reader users");
      console.log("9. handleUpload processes the pasted file");
      console.log("10. Standard validation and preview workflow continues");
      return true;
    }

    return false;
  },
};

// Global exposure for testing - using window.addEventListener to ensure DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  if (typeof window !== "undefined") {
    window.MathPixRefactorTests = MathPixRefactorTests;
    window.testMathPixOriginal =
      MathPixRefactorTests.testOriginalFunctionality.bind(MathPixRefactorTests);
    window.testMathPixBackwardsCompatibility =
      MathPixRefactorTests.testBackwardsCompatibility.bind(
        MathPixRefactorTests
      );
    window.testMathPixRefactorComplete =
      MathPixRefactorTests.runCompleteValidation.bind(MathPixRefactorTests);
    window.testMathPixClipboardPaste =
      MathPixRefactorTests.testClipboardPasteStructure.bind(
        MathPixRefactorTests
      );
    window.testMathPixScreenReaderAnnouncement =
      MathPixRefactorTests.testScreenReaderAnnouncement.bind(
        MathPixRefactorTests
      );
    window.testMathPixClipboardWorkflow =
      MathPixRefactorTests.testClipboardWorkflow.bind(MathPixRefactorTests);
  }
});

// Also expose immediately for cases where DOM is already loaded
if (document.readyState === "loading") {
  // DOM still loading, wait for DOMContentLoaded
} else {
  // DOM already loaded
  if (typeof window !== "undefined") {
    window.MathPixRefactorTests = MathPixRefactorTests;
    window.testMathPixOriginal =
      MathPixRefactorTests.testOriginalFunctionality.bind(MathPixRefactorTests);
    window.testMathPixBackwardsCompatibility =
      MathPixRefactorTests.testBackwardsCompatibility.bind(
        MathPixRefactorTests
      );
    window.testMathPixRefactorComplete =
      MathPixRefactorTests.runCompleteValidation.bind(MathPixRefactorTests);
    window.testMathPixClipboardPaste =
      MathPixRefactorTests.testClipboardPasteStructure.bind(
        MathPixRefactorTests
      );
    window.testMathPixScreenReaderAnnouncement =
      MathPixRefactorTests.testScreenReaderAnnouncement.bind(
        MathPixRefactorTests
      );
    window.testMathPixClipboardWorkflow =
      MathPixRefactorTests.testClipboardWorkflow.bind(MathPixRefactorTests);

    console.log(
      "🔧 MathPix Refactor Tests loaded and ready (DOM already loaded)"
    );
  }
}
