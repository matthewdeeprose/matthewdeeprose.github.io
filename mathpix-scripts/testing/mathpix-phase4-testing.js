/**
 * @fileoverview Phase 4 Chemistry Testing Suite
 * @module MathPixPhase4Testing
 * @version 4.0.0
 * @since 4.0.0
 *
 * @description
 * Comprehensive testing suite for Phase 4 chemistry SMILES support.
 * Validates chemistry detection, extraction, display, and integration.
 *
 * Test Categories:
 * - Basic functionality tests
 * - SMILES extraction tests
 * - UI element validation
 * - Display functionality tests
 * - Integration workflow tests
 * - Edge case handling
 *
 * @example
 * // Run complete test suite
 * await window.testChemistryComplete()
 *
 * @example
 * // Run individual test categories
 * window.testChemistryDetection()
 * window.testChemistryDisplay()
 */

// Logging configuration
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;

function shouldLog(level) {
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
 * Test chemistry detection in API client
 * @returns {Promise<boolean>} Test result
 */
window.testChemistryDetection = async () => {
  console.log("🧪 Testing Chemistry Detection...\n");

  try {
    const controller = window.getMathPixController();

    if (!controller?.apiClient) {
      console.error("❌ API client not available");
      return false;
    }

    // Test 1: Method existence
    if (typeof controller.apiClient.extractSMILESFromResponse !== "function") {
      console.error("❌ extractSMILESFromResponse method not found");
      return false;
    }
    console.log("✅ extractSMILESFromResponse method exists");

    // Test 2: Single SMILES extraction
    const singleResponse = {
      text: "Water molecule: <smiles>O</smiles>",
      detections: { contains_chemistry: true },
    };

    const singleResult =
      controller.apiClient.extractSMILESFromResponse(singleResponse);

    if (singleResult.length !== 1) {
      console.error(`❌ Expected 1 SMILES, got ${singleResult.length}`);
      return false;
    }

    if (singleResult[0].notation !== "O") {
      console.error(
        `❌ Expected notation 'O', got '${singleResult[0].notation}'`
      );
      return false;
    }
    console.log("✅ Single SMILES extraction working");

    // Test 3: Multiple SMILES extraction
    const multipleResponse = {
      text: "Water is <smiles>O</smiles> and ethanol is <smiles>CCO</smiles>",
      detections: { contains_chemistry: true },
    };

    const multipleResult =
      controller.apiClient.extractSMILESFromResponse(multipleResponse);

    if (multipleResult.length !== 2) {
      console.error(`❌ Expected 2 SMILES, got ${multipleResult.length}`);
      return false;
    }
    console.log("✅ Multiple SMILES extraction working");

    // Test 4: Line data extraction
    const lineDataResponse = {
      text: "",
      line_data: [
        {
          id: "line1",
          type: "diagram",
          subtype: "chemistry",
          text: "<smiles>C1=CC=CC=C1</smiles>",
        },
      ],
    };

    const lineDataResult =
      controller.apiClient.extractSMILESFromResponse(lineDataResponse);

    if (lineDataResult.length !== 1) {
      console.error(
        `❌ Line data extraction failed: expected 1, got ${lineDataResult.length}`
      );
      return false;
    }

    if (lineDataResult[0].notation !== "C1=CC=CC=C1") {
      console.error(`❌ Line data notation incorrect`);
      return false;
    }
    console.log("✅ Line data SMILES extraction working");

    // Test 5: Empty response handling
    const emptyResponse = {
      text: "No chemistry here",
      detections: { contains_chemistry: false },
    };

    const emptyResult =
      controller.apiClient.extractSMILESFromResponse(emptyResponse);

    if (emptyResult.length !== 0) {
      console.error(
        `❌ Empty response should return 0 SMILES, got ${emptyResult.length}`
      );
      return false;
    }
    console.log("✅ Empty response handling correct");

    console.log("\n🎉 All chemistry detection tests passed!");
    return true;
  } catch (error) {
    console.error("❌ Chemistry detection test failed:", error);
    return false;
  }
};

/**
 * Test chemistry UI elements
 * @returns {boolean} Test result
 */
window.testChemistryDisplay = () => {
  console.log("🎨 Testing Chemistry Display...\n");

  try {
    // Test 1: UI elements exist
    const elementsToCheck = {
      "mathpix-format-smiles": "SMILES format radio button",
      "mathpix-output-smiles": "SMILES output panel",
      "mathpix-content-smiles": "SMILES content area",
    };

    let allFound = true;

    for (const [id, description] of Object.entries(elementsToCheck)) {
      const element = document.getElementById(id);
      if (!element) {
        console.error(`❌ Missing element: ${description} (${id})`);
        allFound = false;
      } else {
        console.log(`✅ Found: ${description}`);
      }
    }

    if (!allFound) return false;

    // Test 2: Renderer methods exist
    const controller = window.getMathPixController();
    const renderer = controller?.resultRenderer;

    if (!renderer) {
      console.error("❌ Result renderer not available");
      return false;
    }

    if (typeof renderer.populateChemistryFormat !== "function") {
      console.error("❌ populateChemistryFormat method not found");
      return false;
    }
    console.log("✅ populateChemistryFormat method exists");

    if (typeof renderer.showChemistryTab !== "function") {
      console.error("❌ showChemistryTab method not found");
      return false;
    }
    console.log("✅ showChemistryTab method exists");

    // Test 3: Tab visibility control
    renderer.showChemistryTab(true);
    const formatOption = document.getElementById("mathpix-format-smiles");
    const parentLabel = formatOption?.closest(".mathpix-format-option");
    const isVisible = parentLabel?.style.display !== "none";

    if (!isVisible) {
      console.error(
        "❌ Chemistry tab not visible after showChemistryTab(true)"
      );
      return false;
    }
    console.log("✅ Chemistry tab visibility control working");

    // Test 4: Content population
    const mockSMILES = [
      { notation: "O", context: "water molecule" },
      { notation: "CCO", context: "ethanol" },
    ];

    renderer.populateChemistryFormat(mockSMILES);

    const contentElement = document.getElementById("mathpix-content-smiles");
    const hasContent =
      contentElement?.textContent?.includes("O") &&
      contentElement?.textContent?.includes("CCO");

    if (!hasContent) {
      console.error("❌ Chemistry content not populated correctly");
      return false;
    }
    console.log("✅ Chemistry content population working");

    // Clean up
    renderer.showChemistryTab(false);

    console.log("\n🎉 All chemistry display tests passed!");
    return true;
  } catch (error) {
    console.error("❌ Chemistry display test failed:", error);
    return false;
  }
};

/**
 * Test complete chemistry integration workflow
 * @returns {Promise<Object>} Test results
 */
window.testChemistryComplete = async () => {
  console.log("🔬 Running Complete Chemistry Tests...\n");
  console.log("=".repeat(60));

  const results = {
    detection: false,
    extraction: false,
    display: false,
    rendering: false,
    integration: false,
  };

  try {
    // Test 1: Detection
    console.log("\n📋 Test 1: Chemistry Detection");
    console.log("-".repeat(60));
    results.detection = await window.testChemistryDetection();

    // Test 2: Display UI
    console.log("\n📋 Test 2: Chemistry Display");
    console.log("-".repeat(60));
    results.display = window.testChemistryDisplay();

    // Test 3: Extraction with context
    console.log("\n📋 Test 3: SMILES Extraction with Context");
    console.log("-".repeat(60));
    const controller = window.getMathPixController();
    const mockData = {
      text: "Benzene molecule <smiles>C1=CC=CC=C1</smiles> is aromatic",
      detections: { contains_chemistry: true },
    };

    const extracted = controller.apiClient.extractSMILESFromResponse(mockData);
    results.extraction =
      extracted.length === 1 &&
      extracted[0].notation === "C1=CC=CC=C1" &&
      !!extracted[0].context;

    console.log(
      results.extraction
        ? "✅ Extraction with context working"
        : "❌ Extraction failed"
    );

    // Test 4: Rendering integration
    console.log("\n📋 Test 4: Chemistry Rendering");
    console.log("-".repeat(60));
    const mockResult = {
      smiles: extracted,
      containsChemistry: true,
      latex: "",
      mathml: "",
      asciimath: "",
      html: "",
      markdown: "",
    };

    controller.resultRenderer.populateChemistryFormat(mockResult.smiles);
    const content = document.getElementById(
      "mathpix-content-smiles"
    ).textContent;
    results.rendering =
      content.includes("C1=CC=CC=C1") && content.includes("Structure 1");

    console.log(
      results.rendering ? "✅ Rendering working" : "❌ Rendering failed"
    );

    // Test 5: Integration with normaliseMultiFormatResponse
    console.log("\n📋 Test 5: API Response Integration");
    console.log("-".repeat(60));
    const apiResponse = {
      text: "Test <smiles>CCO</smiles>",
      detections: { contains_chemistry: true },
      data: [],
      html: "",
      confidence: 0.95,
    };

    const normalised =
      controller.apiClient.normaliseMultiFormatResponse(apiResponse);
    results.integration =
      normalised.containsChemistry === true &&
      Array.isArray(normalised.smiles) &&
      normalised.smiles.length === 1;

    console.log(
      results.integration
        ? "✅ API integration working"
        : "❌ API integration failed"
    );

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("CHEMISTRY TEST SUMMARY:");
    console.log("=".repeat(60));

    const testResults = [
      { name: "Detection", passed: results.detection },
      { name: "Extraction", passed: results.extraction },
      { name: "Display", passed: results.display },
      { name: "Rendering", passed: results.rendering },
      { name: "Integration", passed: results.integration },
    ];

    testResults.forEach((test) => {
      console.log(
        `${test.passed ? "✅" : "❌"} ${test.name}: ${
          test.passed ? "PASS" : "FAIL"
        }`
      );
    });

    const allPassed = Object.values(results).every((r) => r === true);

    console.log("\n" + "=".repeat(60));
    if (allPassed) {
      console.log("🎉 ALL PHASE 4 CHEMISTRY TESTS PASSED!");
      console.log(
        "\nPhase 4 implementation is complete and working correctly."
      );
    } else {
      console.log("⚠️ SOME TESTS FAILED - Review output above");
    }
    console.log("=".repeat(60));

    return results;
  } catch (error) {
    console.error("❌ Complete chemistry test error:", error);
    return results;
  }
};

/**
 * Quick validation - runs essential tests only
 * @returns {Promise<boolean>} Overall pass/fail
 */
window.validatePhase4Complete = async () => {
  console.log("⚡ Quick Phase 4 Validation\n");

  const results = await window.testChemistryComplete();
  const allPassed = Object.values(results).every((r) => r === true);

  return allPassed;
};
