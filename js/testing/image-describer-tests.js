/**
 * ══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER TEST SUITE
 * ══════════════════════════════════════════════════════════════
 *
 * Comprehensive testing for the Image Describer tool.
 * Tests each implementation stage independently.
 *
 * Usage:
 *   testImageDescriberStage1()  - Test Stage 1 (Foundation)
 *   testImageDescriberStage2()  - Test Stage 2 (Model Registry)
 *   testImageDescriberStage3()  - Test Stage 3 (Cost Estimation)
 *   testImageDescriberAll()     - Run all stage tests
 *   viewCostBreakdown()         - Quick cost breakdown helper
 *
 * VERSION: 1.0.0
 * DATE: 07 December 2025
 * ══════════════════════════════════════════════════════════════
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[ImageDescriberTests] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ImageDescriberTests] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ImageDescriberTests] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ImageDescriberTests] ${message}`, ...args);
  }

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  /**
   * Print a section header
   * @param {string} title - Section title
   */
  function printHeader(title) {
    console.log("\n" + "=".repeat(60));
    console.log(title);
    console.log("=".repeat(60));
  }

  /**
   * Print a test result
   * @param {string} name - Test name
   * @param {boolean} passed - Whether test passed
   * @param {string} [detail] - Optional detail message
   */
  function printResult(name, passed, detail = "") {
    const icon = passed ? "✓" : "✗";
    const detailStr = detail ? ` (${detail})` : "";
    console.log(`  ${icon} ${name}${detailStr}`);
  }

  /**
   * Print test summary
   * @param {string} stageName - Name of the stage
   * @param {boolean} allPassed - Whether all tests passed
   */
  function printSummary(stageName, allPassed) {
    console.log("\n" + "=".repeat(60));
    if (allPassed) {
      console.log(`✅ ${stageName} COMPLETE - All tests passed!`);
    } else {
      console.log(`⚠️ ${stageName} - Some tests failed, review above`);
    }
    console.log("=".repeat(60));
  }

  /**
   * Get the controller instance
   * @returns {Object|null} Controller or null if not available
   */
  function getController() {
    return window.ImageDescriberController || null;
  }

  // ============================================================================
  // STAGE 1 TESTS - Foundation Setup
  // ============================================================================

  /**
   * Test Stage 1: Foundation Setup
   * Tests HTML structure, CSS styles, and DOM element caching
   */
  function testStage1() {
    printHeader("STAGE 1 TEST: Foundation Setup");

    const controller = getController();
    let allPassed = true;

    // Test 1: Controller exists
    console.log("\nTest 1: Controller Availability");
    const hasController = !!controller;
    printResult("ImageDescriberController exists", hasController);
    if (!hasController) {
      console.log("  ⚠ Cannot continue tests - controller not found");
      return false;
    }

    // Test 2: Required DOM elements exist
    console.log("\nTest 2: Required DOM Elements");
    const requiredElements = [
      { id: "imgdesc-model", name: "Model selector" },
      { id: "imgdesc-cost-estimate", name: "Cost estimate display" },
      { id: "imgdesc-remember-model", name: "Remember checkbox" },
    ];

    requiredElements.forEach(({ id, name }) => {
      const element = document.getElementById(id);
      const exists = !!element;
      printResult(name, exists, id);
      if (!exists) allPassed = false;
    });

    // Test 3: Elements cached in controller
    console.log("\nTest 3: Cached Elements in Controller");
    if (controller._initialized) {
      const cachedElements = ["modelSelector", "costEstimate", "rememberModel"];
      cachedElements.forEach((name) => {
        const cached = !!controller.elements[name];
        printResult(`elements.${name}`, cached);
        if (!cached) allPassed = false;
      });
    } else {
      console.log("  ⚠ Controller not initialised - skipping cache tests");
    }

    // Test 4: ARIA attributes
    console.log("\nTest 4: ARIA Accessibility Attributes");
    const costEstimate = document.getElementById("imgdesc-cost-estimate");
    if (costEstimate) {
      const hasRole = costEstimate.getAttribute("role") === "status";
      const hasAriaLive = costEstimate.getAttribute("aria-live") === "polite";
      const hasAriaAtomic = costEstimate.getAttribute("aria-atomic") === "true";

      printResult("role='status'", hasRole);
      printResult("aria-live='polite'", hasAriaLive);
      printResult("aria-atomic='true'", hasAriaAtomic);

      if (!hasRole || !hasAriaLive || !hasAriaAtomic) allPassed = false;
    }

    // Test 5: CSS classes exist
    console.log("\nTest 5: CSS Classes Applied");
    const modelSelector = document.getElementById("imgdesc-model-selector");
    const modelSelectorContainer = modelSelector?.closest(
      ".imgdesc-model-selector"
    );

    printResult("Model selector container has class", !!modelSelectorContainer);
    printResult(
      "Cost estimate has class",
      costEstimate?.classList.contains("imgdesc-cost-estimate")
    );

    printSummary("STAGE 1", allPassed);
    return allPassed;
  }

  // ============================================================================
  // STAGE 2 TESTS - Model Registry Integration
  // ============================================================================

  /**
   * Test Stage 2: Model Registry Integration
   * Tests model registry access, dropdown population, and data attributes
   */
  function testStage2() {
    printHeader("STAGE 2 TEST: Model Registry Integration");

    const controller = getController();
    let allPassed = true;

    if (!controller) {
      console.log("  ⚠ Controller not available");
      return false;
    }

    // Test 1: Model registry available
    console.log("\nTest 1: Model Registry Available");
    const hasRegistry = !!window.modelRegistry;
    const hasGetAllModels =
      typeof window.modelRegistry?.getAllModels === "function";

    printResult("modelRegistry exists", hasRegistry);
    printResult("getAllModels function", hasGetAllModels);

    if (!hasRegistry || !hasGetAllModels) {
      console.log("  ⚠ Cannot continue - model registry not available");
      allPassed = false;
    }

    // Test 2: Model selector populated
    console.log("\nTest 2: Model Selector Populated");
    const selector = controller.elements.modelSelector;
    if (selector) {
      const optionCount = selector.options.length;
      const hasOptgroups = selector.querySelectorAll("optgroup").length > 0;

      printResult("Selector exists", true);
      printResult(`Options count: ${optionCount}`, optionCount > 0);
      printResult("Has optgroups", hasOptgroups);

      if (optionCount === 0) allPassed = false;
    } else {
      printResult("Selector exists", false);
      allPassed = false;
    }

    // Test 3: Optgroup structure
    console.log("\nTest 3: Optgroup Structure");
    if (selector) {
      const optgroups = selector.querySelectorAll("optgroup");
      optgroups.forEach((og) => {
        const label = og.label;
        const count = og.querySelectorAll("option").length;
        console.log(`  Tier: "${label}" with ${count} models`);
      });
    }

    // Test 4: Data attributes on options
    console.log("\nTest 4: Data Attributes");
    if (selector && selector.options.length > 0) {
      const firstOption = selector.options[0];
      const hasInputCost = firstOption.dataset.inputCost !== undefined;
      const hasOutputCost = firstOption.dataset.outputCost !== undefined;
      const hasProvider = firstOption.dataset.provider !== undefined;
      const hasCostTier = firstOption.dataset.costTier !== undefined;

      printResult(
        "data-input-cost",
        hasInputCost,
        firstOption.dataset.inputCost
      );
      printResult(
        "data-output-cost",
        hasOutputCost,
        firstOption.dataset.outputCost
      );
      printResult("data-provider", hasProvider, firstOption.dataset.provider);
      printResult("data-cost-tier", hasCostTier, firstOption.dataset.costTier);

      if (!hasInputCost || !hasOutputCost || !hasProvider || !hasCostTier) {
        allPassed = false;
      }
    }

    // Test 5: Controller methods
    console.log("\nTest 5: Controller Methods");
    const requiredMethods = [
      "populateModelSelector",
      "filterVisionModelsFallback",
      "groupModelsByCostTier",
      "getModelCostTier",
      "disableModelSelection",
      "onModelChange",
      "setDefaultModel",
    ];

    requiredMethods.forEach((method) => {
      const exists = typeof controller[method] === "function";
      printResult(method, exists);
      if (!exists) allPassed = false;
    });

    // Test 6: Cost tier calculation
    console.log("\nTest 6: Cost Tier Calculation");
    const testModels = [
      { costs: { input: 0.1, output: 0.2 }, expected: "low" },
      { costs: { input: 3, output: 6 }, expected: "medium" },
      { costs: { input: 15, output: 60 }, expected: "high" },
      { isFree: true, expected: "low" },
    ];

    testModels.forEach((model, i) => {
      const tier = controller.getModelCostTier(model);
      const passed = tier === model.expected;
      printResult(
        `Test model ${i + 1}`,
        passed,
        `expected: ${model.expected}, got: ${tier}`
      );
      if (!passed) allPassed = false;
    });

    // Test 7: onModelChange fires
    console.log("\nTest 7: onModelChange Event");
    let changeFired = false;
    const originalOnChange = controller.onModelChange.bind(controller);
    controller.onModelChange = function () {
      changeFired = true;
      return originalOnChange();
    };

    if (selector) {
      selector.dispatchEvent(new Event("change"));
      printResult("onModelChange fires on change event", changeFired);
      if (!changeFired) allPassed = false;
    }

    // Restore original
    controller.onModelChange = originalOnChange;

    printSummary("STAGE 2", allPassed);
    return allPassed;
  }

  // ============================================================================
  // STAGE 3 TESTS - Cost Estimation
  // ============================================================================

  /**
   * Test Stage 3: Cost Estimation
   * Tests cost calculation, formatting, and display
   */
  function testStage3() {
    printHeader("STAGE 3 TEST: Cost Estimation");

    const controller = getController();
    let allPassed = true;

    if (!controller) {
      console.log("  ⚠ Controller not available");
      return false;
    }

    // Test 1: Cost estimation properties
    console.log("\nTest 1: Cost Estimation Properties");
    const hasTokenEstimates = !!controller.TOKEN_ESTIMATES;
    const hasUsdToGbp = typeof controller.USD_TO_GBP === "number";
    const hasLastEstimatedCost = "lastEstimatedCost" in controller;

    printResult("TOKEN_ESTIMATES", hasTokenEstimates);
    printResult("USD_TO_GBP", hasUsdToGbp, controller.USD_TO_GBP);
    printResult("lastEstimatedCost property", hasLastEstimatedCost);

    if (!hasTokenEstimates || !hasUsdToGbp || !hasLastEstimatedCost) {
      allPassed = false;
    }

    // Test 2: Token estimate values
    console.log("\nTest 2: Token Estimate Values");
    if (hasTokenEstimates) {
      const te = controller.TOKEN_ESTIMATES;
      console.log(`  System prompt: ${te.SYSTEM_PROMPT} tokens`);
      console.log(`  User prompt: ${te.USER_PROMPT} tokens`);
      console.log(`  Image: ${te.IMAGE} tokens`);
      console.log(`  Output: ${te.OUTPUT} tokens`);
      console.log(`  Input total: ${te.INPUT_TOTAL} tokens`);

      const expectedInputTotal = 1600;
      if (te.INPUT_TOTAL !== expectedInputTotal) {
        printResult(
          `INPUT_TOTAL equals ${expectedInputTotal}`,
          false,
          `got ${te.INPUT_TOTAL}`
        );
        allPassed = false;
      } else {
        printResult(`INPUT_TOTAL equals ${expectedInputTotal}`, true);
      }
    }

    // Test 3: Cost calculation methods exist
    console.log("\nTest 3: Cost Calculation Methods");
    const requiredMethods = [
      "updateCostEstimate",
      "formatCostDisplay",
      "getCostTierNote",
      "applyCostTierStyling",
      "getCostBreakdown",
    ];

    requiredMethods.forEach((method) => {
      const exists = typeof controller[method] === "function";
      printResult(method, exists);
      if (!exists) allPassed = false;
    });

    // Test 4: Format cost display function
    console.log("\nTest 4: Cost Formatting");
    if (typeof controller.formatCostDisplay === "function") {
      const testCases = [
        { gbp: 0, expected: "Free" },
        { gbp: 0.0005, expected: "0.05p" },
        { gbp: 0.005, expected: "0.5p" },
        { gbp: 0.04, expected: "4p" },
        { gbp: 0.15, expected: "£0.15" },
      ];

      testCases.forEach((tc) => {
        const result = controller.formatCostDisplay(tc.gbp);
        const passed = result.includes(tc.expected.replace("~", ""));
        printResult(
          `£${tc.gbp.toFixed(4)} → "${result}"`,
          passed,
          `expected contains "${tc.expected}"`
        );
        if (!passed) allPassed = false;
      });
    }

    // Test 5: Cost tier notes
    console.log("\nTest 5: Cost Tier Notes");
    if (typeof controller.getCostTierNote === "function") {
      const lowNote = controller.getCostTierNote("low");
      const mediumNote = controller.getCostTierNote("medium");
      const highNote = controller.getCostTierNote("high");

      printResult(
        "Low tier note contains 'economical'",
        lowNote.includes("economical"),
        lowNote
      );
      printResult(
        "Medium tier note is empty",
        mediumNote === "",
        `"${mediumNote}"`
      );
      printResult(
        "High tier note contains 'premium'",
        highNote.includes("premium"),
        highNote
      );

      if (
        !lowNote.includes("economical") ||
        mediumNote !== "" ||
        !highNote.includes("premium")
      ) {
        allPassed = false;
      }
    }

    // Test 6: Cost display element styling
    console.log("\nTest 6: Cost Display Element");
    const costElement = controller.elements.costEstimate;
    if (costElement) {
      printResult("Cost display element exists", true);
      console.log(`  Current text: "${costElement.textContent}"`);
      console.log(`  Current classes: ${costElement.className}`);

      const hasTierClass =
        costElement.classList.contains("imgdesc-cost-low") ||
        costElement.classList.contains("imgdesc-cost-medium") ||
        costElement.classList.contains("imgdesc-cost-high");
      printResult("Has tier class applied", hasTierClass);
    } else {
      printResult(
        "Cost display element exists",
        false,
        "initialise controller first"
      );
    }

    // Test 7: Get cost breakdown
    console.log("\nTest 7: Cost Breakdown");
    if (typeof controller.getCostBreakdown === "function") {
      const breakdown = controller.getCostBreakdown();
      if (breakdown.error) {
        console.log(`  ⚠ ${breakdown.error}`);
      } else {
        console.log(`  Model: ${breakdown.model.id}`);
        console.log(`  Provider: ${breakdown.model.provider}`);
        console.log(`  Cost tier: ${breakdown.model.costTier}`);
        console.log(
          `  Input cost/1M: $${breakdown.pricing.inputCostPer1M_USD}`
        );
        console.log(
          `  Output cost/1M: $${breakdown.pricing.outputCostPer1M_USD}`
        );
        console.log(
          `  Total cost (USD): $${breakdown.calculatedCosts.totalCostUSD.toFixed(
            6
          )}`
        );
        console.log(
          `  Total cost (GBP): £${breakdown.calculatedCosts.totalCostGBP.toFixed(
            6
          )}`
        );
        console.log(`  Formatted: ${breakdown.formatted}`);

        printResult(
          "Breakdown has all required properties",
          breakdown.model &&
            breakdown.pricing &&
            breakdown.calculatedCosts &&
            breakdown.formatted
        );
      }
    }

    // Test 8: lastEstimatedCost is populated
    console.log("\nTest 8: lastEstimatedCost Storage");
    if (controller.lastEstimatedCost !== null) {
      printResult(
        "lastEstimatedCost populated",
        true,
        `£${controller.lastEstimatedCost.toFixed(6)}`
      );
    } else {
      console.log("  ⚠ lastEstimatedCost is null (select a model first)");
    }

    printSummary("STAGE 3", allPassed);
    return allPassed;
  }

  // ============================================================================
  // STAGE 4 TESTS - Persistence (localStorage)
  // ============================================================================

  /**
   * Test Stage 4: Persistence with localStorage
   * Tests save, restore, expiry, and missing model handling
   */
  function testStage4() {
    printHeader("STAGE 4 TEST: Persistence (localStorage)");

    const controller = getController();
    let allPassed = true;

    if (!controller) {
      console.log("  ⚠ Controller not available");
      return false;
    }

    if (!controller._initialized) {
      console.log(
        "  ⚠ Controller not initialised - run initImageDescriber() first"
      );
      return false;
    }

    const STORAGE_KEY = "imgdesc_model_preference";

    // Test 1: Persistence methods exist
    console.log("\nTest 1: Persistence Methods Exist");
    const methods = [
      "restoreModelPreference",
      "saveModelPreference",
      "clearModelPreference",
      "bindRememberCheckbox",
      "setDefaultModel",
    ];

    methods.forEach((method) => {
      const exists = typeof controller[method] === "function";
      printResult(method, exists);
      if (!exists) allPassed = false;
    });

    // Test 2: Remember checkbox element
    console.log("\nTest 2: Remember Checkbox Element");
    const checkbox = controller.elements.rememberModel;
    const hasCheckbox = !!checkbox;
    const isCheckboxType = checkbox?.type === "checkbox";

    printResult("Remember checkbox exists", hasCheckbox);
    printResult("Is checkbox type", isCheckboxType);

    if (!hasCheckbox || !isCheckboxType) allPassed = false;

    // Test 3: Save and retrieve preference
    console.log("\nTest 3: Save and Retrieve Preference");

    // Clear any existing preference first
    localStorage.removeItem(STORAGE_KEY);

    // Select a model and check remember
    const selector = controller.elements.modelSelector;
    if (selector && selector.options.length > 1) {
      // Select second option (first might be a placeholder)
      const testIndex = 1;
      selector.selectedIndex = testIndex;
      const testModelId = selector.value;
      const testModelName = selector.options[testIndex].textContent.trim();

      // Check the remember checkbox
      if (checkbox) {
        checkbox.checked = true;
      }

      // Trigger save
      controller.saveModelPreference();

      // Check localStorage
      const saved = localStorage.getItem(STORAGE_KEY);
      const hasSaved = !!saved;
      printResult("Preference saved to localStorage", hasSaved);

      if (saved) {
        try {
          const preference = JSON.parse(saved);

          printResult("Has modelId", !!preference.modelId, preference.modelId);
          printResult(
            "Has modelName",
            !!preference.modelName,
            preference.modelName?.substring(0, 30)
          );
          printResult("Has savedAt", !!preference.savedAt);
          printResult("Has version", !!preference.version);
          printResult(
            "modelId matches selected",
            preference.modelId === testModelId
          );

          if (
            !preference.modelId ||
            !preference.savedAt ||
            preference.modelId !== testModelId
          ) {
            allPassed = false;
          }
        } catch (e) {
          printResult("Valid JSON structure", false, e.message);
          allPassed = false;
        }
      } else {
        allPassed = false;
      }
    } else {
      console.log("  ⚠ Cannot test - selector not populated");
    }

    // Test 4: Restore preference
    console.log("\nTest 4: Restore Preference");

    // Change to a different model first
    if (selector && selector.options.length > 2) {
      selector.selectedIndex = 2;
      controller.onModelChange();

      const modelBeforeRestore = selector.value;

      // Now restore
      controller.restoreModelPreference();

      const modelAfterRestore = selector.value;
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const preference = JSON.parse(saved);
        const restored = modelAfterRestore === preference.modelId;
        printResult("Model restored correctly", restored);
        printResult(
          "Checkbox is checked after restore",
          checkbox?.checked === true
        );

        if (!restored || !checkbox?.checked) allPassed = false;
      }
    }

    // Test 5: Clear preference
    console.log("\nTest 5: Clear Preference");

    controller.clearModelPreference();
    const afterClear = localStorage.getItem(STORAGE_KEY);
    const cleared = afterClear === null;
    printResult("Preference cleared from localStorage", cleared);

    if (!cleared) allPassed = false;

    // Test 6: Checkbox uncheck clears preference
    console.log("\nTest 6: Checkbox Uncheck Clears Preference");

    // Save a preference first
    if (checkbox) {
      checkbox.checked = true;
      controller.saveModelPreference();

      // Verify it's saved
      const beforeUncheck = localStorage.getItem(STORAGE_KEY);
      printResult("Preference exists before uncheck", !!beforeUncheck);

      // Uncheck and trigger change event
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event("change"));

      // Check it's cleared
      const afterUncheck = localStorage.getItem(STORAGE_KEY);
      const clearedOnUncheck = afterUncheck === null;
      printResult("Preference cleared on uncheck", clearedOnUncheck);

      if (!clearedOnUncheck) allPassed = false;
    }

    // Test 7: Expiry handling (simulated)
    console.log("\nTest 7: Expiry Handling (Simulated)");

    // Create an expired preference (91 days old)
    const expiredPreference = {
      modelId: selector?.value || "test-model",
      modelName: "Test Model",
      savedAt: Date.now() - 91 * 24 * 60 * 60 * 1000, // 91 days ago
      version: "1.0.0",
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(expiredPreference));

    // Uncheck checkbox first (so restore doesn't auto-save)
    if (checkbox) checkbox.checked = false;

    // Restore should detect expiry and clear
    controller.restoreModelPreference();

    const afterExpiry = localStorage.getItem(STORAGE_KEY);
    const expiredCleared = afterExpiry === null;
    printResult("Expired preference cleared", expiredCleared);

    if (!expiredCleared) allPassed = false;

    // Test 8: Invalid preference handling
    console.log("\nTest 8: Invalid Preference Handling");

    // Save invalid preference structure
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ invalid: "data" }));

    // Restore should detect invalid and clear
    controller.restoreModelPreference();

    const afterInvalid = localStorage.getItem(STORAGE_KEY);
    const invalidCleared = afterInvalid === null;
    printResult("Invalid preference cleared", invalidCleared);

    if (!invalidCleared) allPassed = false;

    // Test 9: Missing model handling
    console.log("\nTest 9: Missing Model Handling");

    // Save preference for a model that doesn't exist
    const missingModelPreference = {
      modelId: "non-existent/model-that-was-removed",
      modelName: "Model That Was Removed",
      savedAt: Date.now(),
      version: "1.0.0",
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(missingModelPreference));

    // Restore should detect missing model and clear
    controller.restoreModelPreference();

    const afterMissing = localStorage.getItem(STORAGE_KEY);
    const missingCleared = afterMissing === null;
    printResult("Missing model preference cleared", missingCleared);

    if (!missingCleared) allPassed = false;

    // Cleanup: Reset to default state
    console.log("\nCleanup: Resetting to default state...");
    localStorage.removeItem(STORAGE_KEY);
    if (checkbox) checkbox.checked = false;
    controller.setDefaultModel();

    printSummary("STAGE 4", allPassed);
    return allPassed;
  }

  /**
   * Helper to view current preference
   * @returns {Object|null} Current preference or null
   */
  function viewModelPreference() {
    const STORAGE_KEY = "imgdesc_model_preference";
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      console.log("No model preference saved");
      return null;
    }

    try {
      const preference = JSON.parse(saved);
      const ageInDays =
        (Date.now() - preference.savedAt) / (1000 * 60 * 60 * 24);

      console.log("\n📋 Model Preference:");
      console.log(`  Model ID: ${preference.modelId}`);
      console.log(`  Model Name: ${preference.modelName}`);
      console.log(`  Saved: ${new Date(preference.savedAt).toLocaleString()}`);
      console.log(`  Age: ${ageInDays.toFixed(1)} days`);
      console.log(`  Expires in: ${(90 - ageInDays).toFixed(1)} days`);
      console.log(`  Version: ${preference.version}`);

      return preference;
    } catch (e) {
      console.log("Error parsing preference:", e.message);
      return null;
    }
  }

  /**
   * Helper to clear model preference
   */
  function clearModelPreference() {
    const STORAGE_KEY = "imgdesc_model_preference";
    localStorage.removeItem(STORAGE_KEY);
    console.log("Model preference cleared");

    // Also uncheck the checkbox if available
    const controller = getController();
    if (controller?.elements?.rememberModel) {
      controller.elements.rememberModel.checked = false;
    }
  }

  // ============================================================================
  // STAGE 5 TESTS - OpenRouter Integration
  // ============================================================================

  /**
   * Test Stage 5: OpenRouter Integration
   * Tests model selection integration, debug panel updates, and API readiness
   */
  function testStage5() {
    printHeader("STAGE 5 TEST: OpenRouter Integration");

    const controller = getController();
    let allPassed = true;

    if (!controller) {
      console.log("  ⚠ Controller not available");
      return false;
    }

    // Test 1: getSelectedModel() method exists and works
    console.log("\nTest 1: getSelectedModel() Method");
    const hasGetSelectedModel =
      typeof controller.getSelectedModel === "function";
    printResult("getSelectedModel exists", hasGetSelectedModel);

    if (hasGetSelectedModel) {
      const selectedModel = controller.getSelectedModel();
      const hasValue =
        typeof selectedModel === "string" && selectedModel.length > 0;
      printResult("Returns valid model ID", hasValue, selectedModel);
      if (!hasValue) allPassed = false;
    } else {
      allPassed = false;
    }

    // Test 2: getSelectedModelDetails() method exists and works
    console.log("\nTest 2: getSelectedModelDetails() Method");
    const hasGetSelectedModelDetails =
      typeof controller.getSelectedModelDetails === "function";
    printResult("getSelectedModelDetails exists", hasGetSelectedModelDetails);

    if (hasGetSelectedModelDetails) {
      const modelDetails = controller.getSelectedModelDetails();
      // May return null if model not in registry, that's acceptable
      const validReturn =
        modelDetails === null || typeof modelDetails === "object";
      printResult(
        "Returns valid result",
        validReturn,
        modelDetails ? "Model found" : "null (acceptable)"
      );

      if (modelDetails) {
        const hasName = !!modelDetails.name;
        const hasId = !!modelDetails.id;
        printResult("Model has name", hasName, modelDetails.name);
        printResult("Model has id", hasId, modelDetails.id);
      }
    } else {
      allPassed = false;
    }

    // Test 3: Model selection matches controller's getSelectedModel()
    console.log("\nTest 3: Model Selection Integration");
    const selector = controller.elements.modelSelector;
    if (selector && hasGetSelectedModel) {
      const selectorValue = selector.value;
      const controllerValue = controller.getSelectedModel();
      const matches =
        selectorValue === controllerValue ||
        (!selectorValue && controllerValue === "anthropic/claude-haiku-4.5");
      printResult(
        "Selector value matches getSelectedModel()",
        matches,
        `"${selectorValue}" vs "${controllerValue}"`
      );
      if (!matches) allPassed = false;
    } else {
      printResult("Model selector available", false);
      allPassed = false;
    }

    // Test 4: Fallback to config default
    console.log("\nTest 4: Fallback to Config Default");
    if (selector && hasGetSelectedModel) {
      // Temporarily clear selection
      const originalValue = selector.value;
      selector.value = "";

      const fallbackModel = controller.getSelectedModel();
      const usesConfigDefault = fallbackModel === "anthropic/claude-haiku-4.5";
      printResult(
        "Falls back to config default",
        usesConfigDefault,
        fallbackModel
      );

      // Restore original
      selector.value = originalValue;
      if (!usesConfigDefault) allPassed = false;
    }

    // Test 5: New debug panel elements exist
    console.log("\nTest 5: New Debug Panel Elements");
    const debugElements = [
      { id: "imgdesc-debug-selected-model", name: "Selected Model element" },
      { id: "imgdesc-debug-model-cost", name: "Model Cost element" },
    ];

    debugElements.forEach(({ id, name }) => {
      const element = document.getElementById(id);
      const exists = !!element;
      printResult(name, exists, id);
      if (!exists) allPassed = false;
    });

    // Test 6: Debug elements cached in controller
    console.log("\nTest 6: Debug Elements Cached");
    if (controller.elements.debugElements) {
      const cachedDebugElements = ["selectedModel", "modelCost"];
      cachedDebugElements.forEach((name) => {
        const cached = !!controller.elements.debugElements[name];
        printResult(`debugElements.${name}`, cached);
        if (!cached) allPassed = false;
      });
    } else {
      printResult("debugElements object exists", false);
      allPassed = false;
    }

    // Test 7: Cost breakdown available for selected model
    console.log("\nTest 7: Cost Breakdown Integration");
    if (typeof controller.getCostBreakdown === "function") {
      const costBreakdown = controller.getCostBreakdown();
      const hasBreakdown = costBreakdown && typeof costBreakdown === "object";
      printResult("getCostBreakdown returns object", hasBreakdown);

      if (hasBreakdown && costBreakdown.calculated) {
        const hasFormatted = !!costBreakdown.calculated.formatted;
        printResult(
          "Cost breakdown has formatted value",
          hasFormatted,
          costBreakdown.calculated.formatted
        );
      }
    } else {
      printResult("getCostBreakdown available", false, "Stage 3 method");
    }

    printSummary("STAGE 5", allPassed);
    return allPassed;
  }

  // ============================================================================
  // STAGE 6 TESTS - Accessibility & Polish
  // ============================================================================

  /**
   * Test Stage 6: Accessibility & Polish
   * Tests screen reader announcements, keyboard navigation, loading states, and error handling
   */
  function testStage6() {
    printHeader("STAGE 6 TEST: Accessibility & Polish");

    const controller = getController();
    let allPassed = true;

    if (!controller) {
      console.log("  ⚠ Controller not available");
      return false;
    }

    // Test 1: announceModelSelection method exists
    console.log("\nTest 1: announceModelSelection() Method");
    const hasAnnounce = typeof controller.announceModelSelection === "function";
    printResult("announceModelSelection exists", hasAnnounce);
    if (!hasAnnounce) allPassed = false;

    // Test 2: enhanceModelSelectorKeyboard method exists
    console.log("\nTest 2: enhanceModelSelectorKeyboard() Method");
    const hasKeyboardEnhance =
      typeof controller.enhanceModelSelectorKeyboard === "function";
    printResult("enhanceModelSelectorKeyboard exists", hasKeyboardEnhance);
    if (!hasKeyboardEnhance) allPassed = false;

    // Test 3: Loading state methods exist
    console.log("\nTest 3: Loading State Methods");
    const hasShowLoading =
      typeof controller.showModelLoadingState === "function";
    const hasClearLoading =
      typeof controller.clearModelLoadingState === "function";
    printResult("showModelLoadingState exists", hasShowLoading);
    printResult("clearModelLoadingState exists", hasClearLoading);
    if (!hasShowLoading || !hasClearLoading) allPassed = false;

    // Test 4: Error handling method exists
    console.log("\nTest 4: Error Handling Method");
    const hasErrorHandler =
      typeof controller.handleModelRegistryError === "function";
    printResult("handleModelRegistryError exists", hasErrorHandler);
    if (!hasErrorHandler) allPassed = false;

    // Test 5: Test keyboard navigation (Ctrl+Home/End)
    console.log("\nTest 5: Keyboard Navigation");
    const selector = controller.elements.modelSelector;
    if (selector && selector.options.length > 1) {
      // Get first and last valid options
      const validOptions = Array.from(selector.options).filter(
        (opt) => opt.value && !opt.disabled
      );

      if (validOptions.length > 1) {
        const firstOption = validOptions[0];
        const lastOption = validOptions[validOptions.length - 1];

        // Test Ctrl+End (jump to last)
        const originalValue = selector.value;
        selector.value = firstOption.value;

        // Create and dispatch Ctrl+End event
        const endEvent = new KeyboardEvent("keydown", {
          key: "End",
          ctrlKey: true,
          bubbles: true,
        });
        selector.dispatchEvent(endEvent);

        const jumpedToLast = selector.value === lastOption.value;
        printResult(
          "Ctrl+End jumps to last option",
          jumpedToLast,
          `${selector.value}`
        );
        if (!jumpedToLast) allPassed = false;

        // Test Ctrl+Home (jump to first)
        const homeEvent = new KeyboardEvent("keydown", {
          key: "Home",
          ctrlKey: true,
          bubbles: true,
        });
        selector.dispatchEvent(homeEvent);

        const jumpedToFirst = selector.value === firstOption.value;
        printResult(
          "Ctrl+Home jumps to first option",
          jumpedToFirst,
          `${selector.value}`
        );
        if (!jumpedToFirst) allPassed = false;

        // Restore original
        selector.value = originalValue;
      } else {
        printResult("Keyboard navigation", false, "Not enough options to test");
        allPassed = false;
      }
    } else {
      printResult("Keyboard navigation", false, "Selector not available");
      allPassed = false;
    }

    // Test 6: Loading state visual test
    console.log("\nTest 6: Loading State Visual Test");
    if (hasShowLoading && hasClearLoading && selector) {
      // Store current state
      const originalInnerHTML = selector.innerHTML;
      const originalDisabled = selector.disabled;

      // Test show loading
      controller.showModelLoadingState();
      const showsLoading =
        selector.disabled === true &&
        selector.getAttribute("aria-busy") === "true";
      printResult("showModelLoadingState disables selector", showsLoading);

      // Test clear loading
      controller.clearModelLoadingState();
      const clearsLoading =
        selector.disabled === false && !selector.hasAttribute("aria-busy");
      printResult("clearModelLoadingState enables selector", clearsLoading);

      // Restore original state
      selector.innerHTML = originalInnerHTML;
      selector.disabled = originalDisabled;
      selector.removeAttribute("aria-busy");

      if (!showsLoading || !clearsLoading) allPassed = false;
    }

    // Test 7: Announcement test (graceful degradation)
    console.log("\nTest 7: Screen Reader Announcement");
    if (hasAnnounce) {
      // Test that announceModelSelection doesn't throw
      try {
        controller.announceModelSelection(
          "Test Model",
          "~0.5p per description"
        );
        printResult("announceModelSelection runs without error", true);
      } catch (error) {
        printResult(
          "announceModelSelection runs without error",
          false,
          error.message
        );
        allPassed = false;
      }

      // Check if a11y helper is available
      const hasA11yHelper = !!window.a11y?.announceStatus;
      printResult(
        "a11y.announceStatus available",
        hasA11yHelper,
        hasA11yHelper ? "Enhanced" : "Using aria-live fallback"
      );
    }

    // Test 8: ARIA attributes on cost estimate
    console.log("\nTest 8: Accessibility Attributes");
    const costEstimate = controller.elements.costEstimate;
    if (costEstimate) {
      const hasRole = costEstimate.getAttribute("role") === "status";
      const hasAriaLive = costEstimate.getAttribute("aria-live") === "polite";
      const hasAriaAtomic = costEstimate.getAttribute("aria-atomic") === "true";

      printResult("Cost estimate role='status'", hasRole);
      printResult("Cost estimate aria-live='polite'", hasAriaLive);
      printResult("Cost estimate aria-atomic='true'", hasAriaAtomic);

      if (!hasRole || !hasAriaLive || !hasAriaAtomic) allPassed = false;
    } else {
      printResult("Cost estimate element", false, "Not found");
      allPassed = false;
    }

    printSummary("STAGE 6", allPassed);
    return allPassed;
  }

  // ============================================================================
  // STAGE 7 TESTS - Reliability Features
  // ============================================================================

  /**
   * Test Stage 7: Reliability Features (Retry + Health Monitoring)
   * Tests retry configuration, health monitoring, and graceful degradation
   */
  function testStage7() {
    printHeader("STAGE 7 TEST: Reliability Features");

    const controller = getController();
    let allPassed = true;

    if (!controller) {
      console.log("  ⚠ Controller not available");
      return false;
    }

    // Test 1: handleRetryAttempt method exists
    console.log("\nTest 1: Retry Handling Method");
    const hasRetryHandler = typeof controller.handleRetryAttempt === "function";
    printResult("handleRetryAttempt() exists", hasRetryHandler);
    if (!hasRetryHandler) allPassed = false;

    // Test 2: handleHealthStatusChange method exists
    console.log("\nTest 2: Health Status Handling Method");
    const hasHealthHandler =
      typeof controller.handleHealthStatusChange === "function";
    printResult("handleHealthStatusChange() exists", hasHealthHandler);
    if (!hasHealthHandler) allPassed = false;

    // Test 3: updateHealthIndicator method exists
    console.log("\nTest 3: Health Indicator Update Method");
    const hasIndicatorUpdate =
      typeof controller.updateHealthIndicator === "function";
    printResult("updateHealthIndicator() exists", hasIndicatorUpdate);
    if (!hasIndicatorUpdate) allPassed = false;

    // Test 4: Retry handler simulation
    console.log("\nTest 4: Retry Handler Simulation");
    if (hasRetryHandler) {
      try {
        // Simulate a retry attempt
        controller.handleRetryAttempt(1, 2000, new Error("Test error"));
        printResult("handleRetryAttempt runs without error", true);
      } catch (error) {
        printResult(
          "handleRetryAttempt runs without error",
          false,
          error.message
        );
        allPassed = false;
      }
    } else {
      printResult("handleRetryAttempt", false, "Method not found");
      allPassed = false;
    }

    // Test 5: Health status handler simulation
    console.log("\nTest 5: Health Status Handler Simulation");
    if (hasHealthHandler) {
      try {
        // Simulate health status change
        controller.handleHealthStatusChange({
          status: "degraded",
          previousStatus: "healthy",
          timestamp: Date.now(),
        });
        printResult("handleHealthStatusChange runs without error", true);
      } catch (error) {
        printResult(
          "handleHealthStatusChange runs without error",
          false,
          error.message
        );
        allPassed = false;
      }
    } else {
      printResult("handleHealthStatusChange", false, "Method not found");
      allPassed = false;
    }

    // Test 6: Health indicator UI update
    console.log("\nTest 6: Health Indicator UI Update");
    const indicator = controller.elements.healthIndicator;
    if (indicator && hasIndicatorUpdate) {
      try {
        // Test healthy status
        controller.updateHealthIndicator(indicator, { status: "healthy" });
        const hasHealthyClass = indicator.classList.contains("health-healthy");
        printResult("Healthy class applied", hasHealthyClass);

        // Test degraded status
        controller.updateHealthIndicator(indicator, { status: "degraded" });
        const hasDegradedClass =
          indicator.classList.contains("health-degraded");
        const noHealthyClass = !indicator.classList.contains("health-healthy");
        printResult("Degraded class applied", hasDegradedClass);
        printResult("Previous class removed", noHealthyClass);

        // Test unhealthy status
        controller.updateHealthIndicator(indicator, { status: "unhealthy" });
        const hasUnhealthyClass =
          indicator.classList.contains("health-unhealthy");
        printResult("Unhealthy class applied", hasUnhealthyClass);

        // Reset to unknown
        controller.updateHealthIndicator(indicator, { status: "unknown" });

        if (
          !hasHealthyClass ||
          !hasDegradedClass ||
          !hasUnhealthyClass ||
          !noHealthyClass
        ) {
          allPassed = false;
        }
      } catch (error) {
        printResult(
          "updateHealthIndicator runs without error",
          false,
          error.message
        );
        allPassed = false;
      }
    } else if (indicator) {
      printResult("Health indicator element", true, "Found");
      printResult("updateHealthIndicator method", false, "Not found");
      allPassed = false;
    } else {
      printResult("Health indicator element", false, "Not found (optional)");
      // Not a failure - health indicator is optional
      console.log("  ℹ Health indicator is optional - skipping UI tests");
    }

    // Test 7: Graceful degradation - retry modules
    console.log("\nTest 7: Graceful Degradation (Retry)");
    const hasRetryModule = !!(
      window.EmbedRetryHandler || window.EmbedRetryHandlerClass
    );
    printResult(
      "EmbedRetryHandler available",
      hasRetryModule,
      hasRetryModule ? "Retry enabled" : "Retry disabled (graceful)"
    );
    // Not a failure - graceful degradation is expected

    // Test 8: Graceful degradation - health modules
    console.log("\nTest 8: Graceful Degradation (Health)");
    const hasHealthModule = !!(
      window.EmbedHealthMonitor || window.EmbedHealthMonitorClass
    );
    printResult(
      "EmbedHealthMonitor available",
      hasHealthModule,
      hasHealthModule
        ? "Health monitoring enabled"
        : "Monitoring disabled (graceful)"
    );
    // Not a failure - graceful degradation is expected

    // Test 9: Health indicator element cached (optional)
    console.log("\nTest 9: Health Indicator Caching");
    if (controller._initialized) {
      const indicatorCached = controller.elements.healthIndicator !== undefined;
      printResult(
        "healthIndicator in elements cache",
        indicatorCached,
        indicatorCached ? "Cached" : "Not present (optional)"
      );
    } else {
      console.log("  ⚠ Controller not initialised - skipping cache test");
    }

    // Test 10: ARIA attributes on health indicator (if present)
    console.log("\nTest 10: Health Indicator Accessibility");
    if (indicator) {
      const hasRole = indicator.getAttribute("role") === "status";
      const hasAriaLive = indicator.getAttribute("aria-live") === "polite";
      const hasAriaLabel = indicator.hasAttribute("aria-label");

      printResult("role='status'", hasRole);
      printResult("aria-live='polite'", hasAriaLive);
      printResult("aria-label present", hasAriaLabel);

      if (!hasRole || !hasAriaLive || !hasAriaLabel) {
        allPassed = false;
      }
    } else {
      console.log(
        "  ℹ Health indicator not present - accessibility tests skipped"
      );
    }

    printSummary("STAGE 7", allPassed);
    return allPassed;
  }

  // ============================================================================
  // COMBINED TEST RUNNER
  // ============================================================================
  /**
   * Run all Image Describer tests
   * @returns {Object} Results for each stage
   */
  function testAll() {
    printHeader("IMAGE DESCRIBER - FULL TEST SUITE");
    console.log("Running all stage tests...\n");

    const results = {
      stage1: testStage1(),
      stage2: testStage2(),
      stage3: testStage3(),
      stage4: testStage4(),
      stage5: testStage5(),
      stage6: testStage6(),
      stage7: testStage7(),
    };

    // Overall summary
    printHeader("OVERALL TEST SUMMARY");
    console.log(
      `  Stage 1 (Foundation):      ${results.stage1 ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log(
      `  Stage 2 (Model Registry):  ${results.stage2 ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log(
      `  Stage 3 (Cost Estimation): ${results.stage3 ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log(
      `  Stage 4 (Persistence):     ${results.stage4 ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log(
      `  Stage 5 (OpenRouter):      ${results.stage5 ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log(
      `  Stage 6 (Accessibility):   ${results.stage6 ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log(
      `  Stage 7 (Reliability):     ${results.stage7 ? "✅ PASS" : "❌ FAIL"}`
    );

    const allPassed = Object.values(results).every((r) => r);
    console.log(
      "\n" + (allPassed ? "✅ ALL TESTS PASSED!" : "⚠️ SOME TESTS FAILED")
    );

    return results;
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Quick helper to view cost breakdown in console
   * @returns {Object} Detailed cost breakdown
   */
  function viewCostBreakdown() {
    const controller = getController();
    if (!controller) {
      console.log("Controller not available");
      return null;
    }

    if (typeof controller.getCostBreakdown !== "function") {
      console.log("getCostBreakdown not implemented (Stage 3 required)");
      return null;
    }

    const breakdown = controller.getCostBreakdown();

    if (breakdown.calculatedCosts) {
      console.log("\n📊 Cost Breakdown:");
      console.table(breakdown.calculatedCosts);
    }

    return breakdown;
  }

  /**
   * Test a specific model by ID
   * @param {string} modelId - Model ID to test
   */
  function testModelCost(modelId) {
    const controller = getController();
    if (!controller || !controller.elements.modelSelector) {
      console.log("Controller or selector not available");
      return;
    }

    const selector = controller.elements.modelSelector;
    const option = Array.from(selector.options).find(
      (o) => o.value === modelId
    );

    if (!option) {
      console.log(`Model not found: ${modelId}`);
      console.log(
        "Available models:",
        Array.from(selector.options)
          .map((o) => o.value)
          .slice(0, 10),
        "..."
      );
      return;
    }

    selector.value = modelId;
    selector.dispatchEvent(new Event("change"));

    console.log(`\nSelected: ${modelId}`);
    return viewCostBreakdown();
  }

  // ============================================================================
  // GLOBAL EXPORTS
  // ============================================================================

  // Stage-specific tests
  window.testImageDescriberStage1 = testStage1;
  window.testImageDescriberStage2 = testStage2;
  window.testImageDescriberStage3 = testStage3;
  window.testImageDescriberStage4 = testStage4;
  window.testImageDescriberStage5 = testStage5;
  window.testImageDescriberStage6 = testStage6;
  window.testImageDescriberStage7 = testStage7;

  // Combined test runner
  window.testImageDescriberAll = testAll;

  // Backwards compatibility aliases
  window.testStage1Complete = testStage1;
  window.testStage2Complete = testStage2;
  window.testStage3Complete = testStage3;
  window.testStage4Complete = testStage4;
  window.testStage5Complete = testStage5;
  window.testStage6Complete = testStage6;
  window.testStage7Complete = testStage7;

  // Helper functions
  window.viewCostBreakdown = viewCostBreakdown;
  window.testModelCost = testModelCost;
  window.viewModelPreference = viewModelPreference;
  window.clearModelPreference = clearModelPreference;

  logInfo("Image Describer Test Suite loaded");
})();
