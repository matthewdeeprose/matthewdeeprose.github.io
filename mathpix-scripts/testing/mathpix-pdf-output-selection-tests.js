/**
 * MathPix PDF Format Selection Testing Suite
 *
 * Comprehensive tests for verifying format selection state management,
 * HTML/JS synchronization, and Select All checkbox behaviour.
 */

window.MathPixPDFTests = {
  /**
   * Test 1: Verify default format initialization
   * Run immediately after PDF upload to confirm all formats initialized
   */
  testDefaultFormats() {
    console.log("🧪 Test 1: Default Format Initialization");
    const handler = window.getMathPixController()?.pdfHandler;
    if (!handler) return console.error("❌ PDF handler not available");

    const formats = handler.currentProcessingOptions?.formats || [];
    const expectedCount = 10;

    console.log("Initialized Formats:", formats);
    console.log(`Expected: ${expectedCount}, Got: ${formats.length}`);

    return {
      pass: formats.length === expectedCount,
      formats,
      expectedCount,
    };
  },

  /**
   * Test 2: Verify HTML/JS synchronization
   * Confirms checkbox states match JavaScript application state
   */
  testHTMLJSSync() {
    console.log("🧪 Test 2: HTML/JavaScript Synchronization");
    const handler = window.getMathPixController()?.pdfHandler;
    if (!handler) return console.error("❌ PDF handler not available");

    const htmlChecked = Array.from(
      document.querySelectorAll('[id^="pdf-format-"]:checked:not(:disabled)')
    ).map((cb) => cb.value);

    const jsFormats = handler.currentProcessingOptions?.formats || [];

    const match =
      JSON.stringify(htmlChecked.sort()) === JSON.stringify(jsFormats.sort());

    console.log("HTML Checked:", htmlChecked);
    console.log("JS Formats:", jsFormats);
    console.log(match ? "✅ Synchronized" : "⚠️ Mismatch");

    return { htmlChecked, jsFormats, match };
  },

  /**
   * Test 3: Verify Select All state accuracy
   * Confirms Select All checkbox reflects aggregate format state
   */
  testSelectAllState() {
    console.log("🧪 Test 3: Select All State Accuracy");
    const selectAll = document.getElementById("select-all-formats");
    const handler = window.getMathPixController()?.pdfHandler;

    if (!selectAll || !handler) {
      return console.error("❌ Required elements not available");
    }

    const enabledFormats = Array.from(
      document.querySelectorAll('[id^="pdf-format-"]:not(:disabled)')
    ).filter((cb) => cb.id !== "pdf-format-mmd");

    const checkedFormats = enabledFormats.filter((cb) => cb.checked);

    const expectedChecked = enabledFormats.length === checkedFormats.length;
    const expectedIndeterminate =
      checkedFormats.length > 0 &&
      checkedFormats.length < enabledFormats.length;

    const stateCorrect =
      selectAll.checked === expectedChecked &&
      selectAll.indeterminate === expectedIndeterminate;

    console.log("Select All State:", {
      checked: selectAll.checked,
      indeterminate: selectAll.indeterminate,
    });
    console.log("Format Counts:", {
      total: enabledFormats.length,
      checked: checkedFormats.length,
    });
    console.log(stateCorrect ? "✅ State Correct" : "⚠️ State Incorrect");

    return {
      actual: {
        checked: selectAll.checked,
        indeterminate: selectAll.indeterminate,
      },
      expected: {
        checked: expectedChecked,
        indeterminate: expectedIndeterminate,
      },
      correct: stateCorrect,
    };
  },

  /**
   * Test 4: Verify endpoint-aware format availability
   * Confirms format restrictions based on API endpoint
   */
  testEndpointAvailability() {
    console.log("🧪 Test 4: Endpoint-Aware Format Availability");
    const handler = window.getMathPixController()?.pdfHandler;
    const apiClient = window.getMathPixController()?.apiClient;

    if (!handler || !apiClient) {
      return console.error("❌ Required components not available");
    }

    const currentEndpoint = apiClient.currentEndpoint || "EU";
    const latexpdfCheckbox = document.getElementById("pdf-format-latexpdf");
    const latexpdfAvailable = !latexpdfCheckbox?.disabled;

    console.log("Current Endpoint:", currentEndpoint);
    console.log("LaTeX PDF Available:", latexpdfAvailable);
    console.log(
      "Expected:",
      currentEndpoint === "US" ? "available" : "unavailable"
    );

    const expectationMet =
      (currentEndpoint === "US" && latexpdfAvailable) ||
      (currentEndpoint === "EU" && !latexpdfAvailable);

    console.log(
      expectationMet ? "✅ Correct Availability" : "⚠️ Unexpected Availability"
    );

    return {
      endpoint: currentEndpoint,
      latexpdfAvailable,
      expectationMet,
    };
  },

  /**
   * Test 5: Verify Select All toggle functionality
   * Confirms Select All checkbox correctly controls all enabled formats
   */
  testSelectAllToggle() {
    console.log("🧪 Test 5: Select All Toggle Functionality");
    const selectAll = document.getElementById("select-all-formats");
    const handler = window.getMathPixController()?.pdfHandler;

    if (!selectAll || !handler) {
      return console.error("❌ Required elements not available");
    }

    // Store initial state
    const initialState = selectAll.checked;
    console.log("Initial Select All State:", initialState);

    // Toggle to opposite state
    selectAll.checked = !initialState;
    selectAll.dispatchEvent(new Event("change"));

    // Check if all enabled formats match new state
    const enabledFormats = Array.from(
      document.querySelectorAll('[id^="pdf-format-"]:not(:disabled)')
    ).filter((cb) => cb.id !== "pdf-format-mmd");

    const allMatch = enabledFormats.every(
      (cb) => cb.checked === selectAll.checked
    );

    console.log("After Toggle - Select All:", selectAll.checked);
    console.log("Enabled Formats Match:", allMatch);

    // Restore original state
    selectAll.checked = initialState;
    selectAll.dispatchEvent(new Event("change"));

    console.log(
      allMatch ? "✅ Toggle Works Correctly" : "⚠️ Toggle Malfunction"
    );

    return {
      initialState,
      toggledState: !initialState,
      allMatch,
      restored: selectAll.checked === initialState,
    };
  },

  /**
   * Run all tests sequentially
   * Comprehensive validation of entire format selection system
   */
  runAll() {
    console.log(
      "🚀 Running Complete MathPix PDF Format Selection Test Suite\n"
    );

    const results = {
      test1: this.testDefaultFormats(),
      test2: this.testHTMLJSSync(),
      test3: this.testSelectAllState(),
      test4: this.testEndpointAvailability(),
      test5: this.testSelectAllToggle(),
    };

    console.log("\n📊 Test Suite Summary:");
    console.table({
      "Default Formats": results.test1?.pass ? "✅ Pass" : "❌ Fail",
      "HTML/JS Sync": results.test2?.match ? "✅ Pass" : "❌ Fail",
      "Select All State": results.test3?.correct ? "✅ Pass" : "❌ Fail",
      "Endpoint Availability": results.test4?.expectationMet
        ? "✅ Pass"
        : "❌ Fail",
      "Select All Toggle": results.test5?.allMatch ? "✅ Pass" : "❌ Fail",
    });

    const allPassed =
      results.test1?.pass &&
      results.test2?.match &&
      results.test3?.correct &&
      results.test4?.expectationMet &&
      results.test5?.allMatch;

    console.log(
      allPassed
        ? "\n🎉 All tests passed! Format selection system functioning perfectly."
        : "\n⚠️ Some tests failed. Review individual test output for details."
    );

    return results;
  },
};

// Convenience aliases for quick testing
window.testPDFFormats = () => window.MathPixPDFTests.runAll();
window.testPDFFormatSync = () => window.MathPixPDFTests.testHTMLJSSync();
window.testPDFSelectAll = () => window.MathPixPDFTests.testSelectAllState();
