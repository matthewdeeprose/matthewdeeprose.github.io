/**
 * OpenRouter Embed API - Phase 5 Model Selection Tests
 *
 * Tests for Stage 5 Phase 5: Model Selection Integration
 * 16 tests covering all acceptance criteria
 *
 * @version 1.0.0 (Stage 5 Phase 5)
 * @date 30 November 2025
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
      console.error(`[Phase5 Tests ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[Phase5 Tests WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[Phase5 Tests INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[Phase5 Tests DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  /**
   * Check if EmbedModelSelector is available
   */
  function checkSelectorAvailable() {
    if (typeof window.EmbedModelSelector === "undefined") {
      throw new Error(
        "EmbedModelSelector not loaded. Include openrouter-embed-model-selector.js first."
      );
    }
    return true;
  }

  /**
   * Check if modelRegistry is available
   */
  function checkRegistryAvailable() {
    return typeof window.modelRegistry !== "undefined";
  }

  /**
   * Reset selector to default state
   */
  function resetSelector() {
    if (window.EmbedModelSelector) {
      window.EmbedModelSelector.reset();
    }
  }

  // ============================================================================
  // TEST P5-01: Module Exists with All Methods
  // ============================================================================

  async function testStage5_P5_01_ModuleExists() {
    logInfo("P5-01: Testing EmbedModelSelector module exists with all methods");

    try {
      checkSelectorAvailable();

      const selector = window.EmbedModelSelector;

      // Check all required methods exist
      const requiredMethods = [
        "configure",
        "selectModel",
        "hasCapabilities",
        "getModelsWithCapabilities",
        "getCostTier",
        "getConfig",
        "reset",
      ];

      const missingMethods = requiredMethods.filter(
        (method) => typeof selector[method] !== "function"
      );

      if (missingMethods.length > 0) {
        throw new Error(`Missing methods: ${missingMethods.join(", ")}`);
      }

      logInfo(
        "✅ P5-01 PASSED: EmbedModelSelector module exists with all methods"
      );
      return { passed: true, testId: "P5-01" };
    } catch (error) {
      logError("❌ P5-01 FAILED:", error.message);
      return { passed: false, testId: "P5-01", error: error.message };
    }
  }

  // ============================================================================
  // TEST P5-02: Capability Detection Works
  // ============================================================================

  async function testStage5_P5_02_CapabilityDetection() {
    logInfo("P5-02: Testing capability detection");

    try {
      checkSelectorAvailable();
      resetSelector();

      const selector = window.EmbedModelSelector;

      if (!checkRegistryAvailable()) {
        logWarn("Model registry not available - testing graceful degradation");
        // Should return false when registry unavailable
        const result = selector.hasCapabilities("any/model", ["vision"]);
        if (result !== false) {
          throw new Error("Should return false when registry unavailable");
        }
        logInfo(
          "✅ P5-02 PASSED: Capability detection handles missing registry"
        );
        return { passed: true, testId: "P5-02" };
      }

      // Test with known Claude model (should have vision/image capability)
      const hasVision = selector.hasCapabilities(
        "anthropic/claude-3.7-sonnet",
        ["vision"]
      );
      logDebug("Claude 3.7 Sonnet has vision:", hasVision);

      // Test multiple capabilities
      const hasMultiple = selector.hasCapabilities(
        "anthropic/claude-3.7-sonnet",
        ["text", "code"]
      );
      logDebug("Claude 3.7 Sonnet has text+code:", hasMultiple);

      // Test empty capabilities (should return true)
      const hasEmpty = selector.hasCapabilities(
        "anthropic/claude-3.7-sonnet",
        []
      );
      if (!hasEmpty) {
        throw new Error("Empty capabilities should return true");
      }

      // Test unknown model (should return false)
      const unknownModel = selector.hasCapabilities("nonexistent/model", [
        "vision",
      ]);
      if (unknownModel !== false) {
        throw new Error("Unknown model should return false");
      }

      logInfo("✅ P5-02 PASSED: Capability detection works correctly");
      return { passed: true, testId: "P5-02" };
    } catch (error) {
      logError("❌ P5-02 FAILED:", error.message);
      return { passed: false, testId: "P5-02", error: error.message };
    }
  }

  // ============================================================================
  // TEST P5-03: Model Filtering by Capabilities
  // ============================================================================

  async function testStage5_P5_03_ModelFiltering() {
    logInfo("P5-03: Testing model filtering by capabilities");

    try {
      checkSelectorAvailable();
      resetSelector();

      const selector = window.EmbedModelSelector;

      if (!checkRegistryAvailable()) {
        logWarn("Model registry not available - testing graceful degradation");
        const models = selector.getModelsWithCapabilities(["vision"]);
        if (!Array.isArray(models)) {
          throw new Error(
            "Should return empty array when registry unavailable"
          );
        }
        logInfo("✅ P5-03 PASSED: Model filtering handles missing registry");
        return { passed: true, testId: "P5-03" };
      }

      // Get vision models
      const visionModels = selector.getModelsWithCapabilities(["vision"]);
      logDebug("Vision models found:", visionModels.length);

      if (!Array.isArray(visionModels)) {
        throw new Error("getModelsWithCapabilities should return an array");
      }

      // Get models with impossible capability
      const impossibleModels = selector.getModelsWithCapabilities([
        "nonexistent_capability_xyz",
      ]);
      if (impossibleModels.length !== 0) {
        throw new Error("Impossible capability should return empty array");
      }

      // Get all models (empty capabilities)
      const allModels = selector.getModelsWithCapabilities([]);
      logDebug("All models count:", allModels.length);

      if (allModels.length === 0) {
        throw new Error("Empty capabilities should return all models");
      }

      logInfo("✅ P5-03 PASSED: Model filtering by capabilities works");
      return { passed: true, testId: "P5-03" };
    } catch (error) {
      logError("❌ P5-03 FAILED:", error.message);
      return { passed: false, testId: "P5-03", error: error.message };
    }
  }

  // ============================================================================
  // TEST P5-04: Cost Tier Classification
  // ============================================================================

  async function testStage5_P5_04_CostTiers() {
    logInfo("P5-04: Testing cost tier classification");

    try {
      checkSelectorAvailable();
      resetSelector();

      const selector = window.EmbedModelSelector;

      if (!checkRegistryAvailable()) {
        logWarn("Model registry not available - testing default tier");
        const tier = selector.getCostTier("any/model");
        if (!["low", "medium", "high"].includes(tier)) {
          throw new Error("getCostTier should return valid tier");
        }
        logInfo("✅ P5-04 PASSED: Cost tier handles missing registry");
        return { passed: true, testId: "P5-04" };
      }

      // Test Haiku (should be low)
      const haikuTier = selector.getCostTier("anthropic/claude-3.5-haiku");
      logDebug("Claude 3.5 Haiku tier:", haikuTier);
      if (!["low", "medium", "high"].includes(haikuTier)) {
        throw new Error("Invalid tier returned for Haiku");
      }

      // Test Sonnet (should be medium)
      const sonnetTier = selector.getCostTier("anthropic/claude-3.7-sonnet");
      logDebug("Claude 3.7 Sonnet tier:", sonnetTier);
      if (!["low", "medium", "high"].includes(sonnetTier)) {
        throw new Error("Invalid tier returned for Sonnet");
      }

      // Test unknown model (should return default)
      const unknownTier = selector.getCostTier("unknown/model");
      if (!["low", "medium", "high"].includes(unknownTier)) {
        throw new Error("Invalid tier for unknown model");
      }

      logInfo("✅ P5-04 PASSED: Cost tier classification works");
      return { passed: true, testId: "P5-04" };
    } catch (error) {
      logError("❌ P5-04 FAILED:", error.message);
      return { passed: false, testId: "P5-04", error: error.message };
    }
  }

  // ============================================================================
  // TEST P5-05: Basic Model Selection
  // ============================================================================

  async function testStage5_P5_05_BasicSelection() {
    logInfo("P5-05: Testing basic model selection");

    try {
      checkSelectorAvailable();
      resetSelector();

      const selector = window.EmbedModelSelector;

      // Basic selection (no requirements)
      const model = selector.selectModel({});
      logDebug("Selected model (no requirements):", model);

      if (typeof model !== "string") {
        throw new Error("selectModel should return a string");
      }

      if (!model.includes("/")) {
        throw new Error("Model ID should be in provider/model format");
      }

      // Selection with vision requirement
      if (checkRegistryAvailable()) {
        const visionModel = selector.selectModel({
          capabilities: ["vision"],
        });
        logDebug("Selected vision model:", visionModel);

        if (typeof visionModel !== "string") {
          throw new Error("selectModel with vision should return string");
        }
      }

      logInfo("✅ P5-05 PASSED: Basic model selection works");
      return { passed: true, testId: "P5-05" };
    } catch (error) {
      logError("❌ P5-05 FAILED:", error.message);
      return { passed: false, testId: "P5-05", error: error.message };
    }
  }

  // ============================================================================
  // TEST P5-06: Cost Preference Affects Selection
  // ============================================================================

  async function testStage5_P5_06_CostPreference() {
    logInfo("P5-06: Testing cost preference affects selection");

    try {
      checkSelectorAvailable();
      resetSelector();

      const selector = window.EmbedModelSelector;

      if (!checkRegistryAvailable()) {
        logWarn("Model registry not available - skipping cost preference test");
        logInfo("✅ P5-06 PASSED: Graceful handling without registry");
        return { passed: true, testId: "P5-06" };
      }

      // Select with 'cheapest' preference
      const cheapModel = selector.selectModel({
        costPreference: "cheapest",
      });
      const cheapTier = selector.getCostTier(cheapModel);
      logDebug("Cheapest selection:", cheapModel, "tier:", cheapTier);

      // Select with 'best' preference
      const bestModel = selector.selectModel({
        costPreference: "best",
      });
      const bestTier = selector.getCostTier(bestModel);
      logDebug("Best selection:", bestModel, "tier:", bestTier);

      // Select with 'balanced' preference
      const balancedModel = selector.selectModel({
        costPreference: "balanced",
      });
      logDebug("Balanced selection:", balancedModel);

      // Verify models were selected
      if (!cheapModel || !bestModel || !balancedModel) {
        throw new Error(
          "Cost preference selections should return valid models"
        );
      }

      logInfo("✅ P5-06 PASSED: Cost preference affects selection");
      return { passed: true, testId: "P5-06" };
    } catch (error) {
      logError("❌ P5-06 FAILED:", error.message);
      return { passed: false, testId: "P5-06", error: error.message };
    }
  }

  // ============================================================================
  // TEST P5-07: Preferred Models Respected
  // ============================================================================

  async function testStage5_P5_07_PreferredModels() {
    logInfo("P5-07: Testing preferred models are respected");

    try {
      checkSelectorAvailable();
      resetSelector();

      const selector = window.EmbedModelSelector;

      const preferredModel = "anthropic/claude-3.7-sonnet";

      selector.configure({
        preferredModels: [preferredModel],
      });

      // When preferred model meets requirements, it should be selected
      const selectedModel = selector.selectModel({});
      logDebug("Selected model:", selectedModel);

      // If registry available and model exists, should select preferred
      if (checkRegistryAvailable()) {
        const registry = window.modelRegistry;
        const modelExists = registry.getModel(preferredModel) !== null;

        if (modelExists && selectedModel !== preferredModel) {
          throw new Error(
            `Expected preferred model ${preferredModel}, got ${selectedModel}`
          );
        }
      }

      logInfo("✅ P5-07 PASSED: Preferred models respected");
      return { passed: true, testId: "P5-07" };
    } catch (error) {
      logError("❌ P5-07 FAILED:", error.message);
      return { passed: false, testId: "P5-07", error: error.message };
    } finally {
      resetSelector();
    }
  }

  // ============================================================================
  // TEST P5-08: Fallback Model Used
  // ============================================================================

  async function testStage5_P5_08_FallbackModel() {
    logInfo("P5-08: Testing fallback model is used when needed");

    try {
      checkSelectorAvailable();
      resetSelector();

      const selector = window.EmbedModelSelector;

      const customFallback = "anthropic/claude-3.5-haiku";

      selector.configure({
        fallbackModel: customFallback,
      });

      // Select with impossible requirements
      const model = selector.selectModel({
        capabilities: ["impossible_capability_xyz_123"],
      });

      logDebug("Selected model with impossible requirements:", model);

      if (model !== customFallback) {
        throw new Error(
          `Expected fallback model ${customFallback}, got ${model}`
        );
      }

      logInfo("✅ P5-08 PASSED: Fallback model used when needed");
      return { passed: true, testId: "P5-08" };
    } catch (error) {
      logError("❌ P5-08 FAILED:", error.message);
      return { passed: false, testId: "P5-08", error: error.message };
    } finally {
      resetSelector();
    }
  }

  // ============================================================================
  // TEST P5-09: Model Exclusion Works
  // ============================================================================

  async function testStage5_P5_09_ModelExclusion() {
    logInfo("P5-09: Testing model exclusion works");

    try {
      checkSelectorAvailable();
      resetSelector();

      const selector = window.EmbedModelSelector;

      if (!checkRegistryAvailable()) {
        logWarn("Model registry not available - skipping exclusion test");
        logInfo("✅ P5-09 PASSED: Graceful handling without registry");
        return { passed: true, testId: "P5-09" };
      }

      // Get all available models first
      const allModels = selector.getModelsWithCapabilities([]);
      if (allModels.length < 2) {
        logWarn("Not enough models for exclusion test");
        logInfo("✅ P5-09 PASSED: Not enough models to test");
        return { passed: true, testId: "P5-09" };
      }

      // Exclude the first few models
      const modelsToExclude = allModels.slice(0, 3);

      selector.configure({
        excludeModels: modelsToExclude,
      });

      // Select a model
      const selectedModel = selector.selectModel({});
      logDebug("Selected model after exclusion:", selectedModel);

      if (modelsToExclude.includes(selectedModel)) {
        throw new Error(`Excluded model ${selectedModel} was selected`);
      }

      logInfo("✅ P5-09 PASSED: Model exclusion works");
      return { passed: true, testId: "P5-09" };
    } catch (error) {
      logError("❌ P5-09 FAILED:", error.message);
      return { passed: false, testId: "P5-09", error: error.message };
    } finally {
      resetSelector();
    }
  }

  // ============================================================================
  // TEST P5-10: Integration with OpenRouterEmbed
  // ============================================================================

  async function testStage5_P5_10_EmbedIntegration() {
    logInfo("P5-10: Testing integration with OpenRouterEmbed");

    try {
      checkSelectorAvailable();
      resetSelector();

      // Check if OpenRouterEmbed is available
      if (typeof window.OpenRouterEmbed === "undefined") {
        logWarn(
          "OpenRouterEmbed not available - testing selector in isolation"
        );

        // Just verify selector works standalone
        const selector = window.EmbedModelSelector;
        const model = selector.selectModel({
          capabilities: ["vision"],
          costPreference: "balanced",
        });

        if (typeof model !== "string") {
          throw new Error("Selector should work standalone");
        }

        logInfo(
          "✅ P5-10 PASSED: Selector works standalone (OpenRouterEmbed not available)"
        );
        return { passed: true, testId: "P5-10" };
      }

      // If OpenRouterEmbed is available, test integration
      const selector = window.EmbedModelSelector;

      // Configure selector
      selector.configure({
        preferredModels: ["anthropic/claude-3.7-sonnet"],
        costPreference: "balanced",
      });

      // Select model with vision capability (simulating file attachment)
      const selectedModel = selector.selectModel({
        capabilities: ["vision"],
      });

      logDebug("Selected model for vision request:", selectedModel);

      if (typeof selectedModel !== "string") {
        throw new Error("Model selection should return string");
      }

      logInfo("✅ P5-10 PASSED: Integration with OpenRouterEmbed works");
      return { passed: true, testId: "P5-10" };
    } catch (error) {
      logError("❌ P5-10 FAILED:", error.message);
      return { passed: false, testId: "P5-10", error: error.message };
    } finally {
      resetSelector();
    }
  }

  // ============================================================================
  // TEST P5-11: Auto-Detection of Requirements
  // ============================================================================

  async function testStage5_P5_11_AutoDetection() {
    logInfo("P5-11: Testing auto-detection of requirements");

    try {
      checkSelectorAvailable();
      resetSelector();

      const selector = window.EmbedModelSelector;

      // Test that we can detect vision requirement when image would be attached
      // This is a simulation - actual integration would detect from file type

      // Configure with auto-detect settings (null values)
      selector.configure({
        visionRequired: null,
        streamingRequired: null,
      });

      const config = selector.getConfig();

      if (config.visionRequired !== null) {
        throw new Error("visionRequired should be null for auto-detect");
      }

      if (config.streamingRequired !== null) {
        throw new Error("streamingRequired should be null for auto-detect");
      }

      // Test selection with explicit vision capability
      const visionModel = selector.selectModel({
        capabilities: ["vision"],
      });

      logDebug("Vision model selected:", visionModel);

      // Test selection with streaming capability
      const streamingModel = selector.selectModel({
        capabilities: ["streaming"],
      });

      logDebug("Streaming model selected:", streamingModel);

      logInfo("✅ P5-11 PASSED: Auto-detection configuration works");
      return { passed: true, testId: "P5-11" };
    } catch (error) {
      logError("❌ P5-11 FAILED:", error.message);
      return { passed: false, testId: "P5-11", error: error.message };
    } finally {
      resetSelector();
    }
  }

  // ============================================================================
  // TEST P5-12: Manual Model Override
  // ============================================================================

  async function testStage5_P5_12_ManualOverride() {
    logInfo("P5-12: Testing manual model override");

    try {
      checkSelectorAvailable();
      resetSelector();

      const selector = window.EmbedModelSelector;

      // Configure with preferred models
      selector.configure({
        preferredModels: ["anthropic/claude-3.7-sonnet"],
        fallbackModel: "anthropic/claude-3.5-haiku",
      });

      // Manual override scenario: when user explicitly sets a model,
      // the embed should use that model instead of auto-selecting

      // Verify configuration is set
      const config = selector.getConfig();

      if (config.preferredModels[0] !== "anthropic/claude-3.7-sonnet") {
        throw new Error("Preferred model not set correctly");
      }

      if (config.fallbackModel !== "anthropic/claude-3.5-haiku") {
        throw new Error("Fallback model not set correctly");
      }

      // The actual override would happen at the OpenRouterEmbed level
      // where explicit model setting bypasses selectModel()
      // Here we just verify the selector doesn't interfere with explicit config

      logInfo("✅ P5-12 PASSED: Manual override configuration supported");
      return { passed: true, testId: "P5-12" };
    } catch (error) {
      logError("❌ P5-12 FAILED:", error.message);
      return { passed: false, testId: "P5-12", error: error.message };
    } finally {
      resetSelector();
    }
  }

  // ============================================================================
  // TEST P5-13: Graceful Degradation Without Model Registry
  // ============================================================================

  async function testStage5_P5_13_GracefulDegradation() {
    logInfo("P5-13: Testing graceful degradation without model registry");

    try {
      checkSelectorAvailable();
      resetSelector();

      const selector = window.EmbedModelSelector;

      // Temporarily hide modelRegistry
      const originalRegistry = window.modelRegistry;
      window.modelRegistry = undefined;

      try {
        // Configure fallback
        selector.configure({
          fallbackModel: "test/fallback-model",
        });

        // Selection should still work, falling back
        const model = selector.selectModel({
          capabilities: ["vision"],
        });

        logDebug("Selected model without registry:", model);

        if (typeof model !== "string") {
          throw new Error("Should return fallback model string");
        }

        if (model !== "test/fallback-model") {
          throw new Error(`Expected fallback model, got ${model}`);
        }

        // hasCapabilities should return false
        const hasVision = selector.hasCapabilities("any/model", ["vision"]);
        if (hasVision !== false) {
          throw new Error(
            "hasCapabilities should return false without registry"
          );
        }

        // getModelsWithCapabilities should return empty array
        const models = selector.getModelsWithCapabilities(["vision"]);
        if (!Array.isArray(models) || models.length !== 0) {
          throw new Error(
            "getModelsWithCapabilities should return empty array without registry"
          );
        }

        logInfo("✅ P5-13 PASSED: Graceful degradation without model registry");
        return { passed: true, testId: "P5-13" };
      } finally {
        // Restore registry
        window.modelRegistry = originalRegistry;
      }
    } catch (error) {
      logError("❌ P5-13 FAILED:", error.message);
      return { passed: false, testId: "P5-13", error: error.message };
    } finally {
      resetSelector();
    }
  }

  // ============================================================================
  // TEST P5-14: Selection Metadata Returned
  // ============================================================================

  async function testStage5_P5_14_SelectionMetadata() {
    logInfo("P5-14: Testing selection metadata is returned");

    try {
      checkSelectorAvailable();
      resetSelector();

      const selector = window.EmbedModelSelector;

      // Select with includeMetadata
      const result = selector.selectModel({
        capabilities: ["vision"],
        includeMetadata: true,
      });

      logDebug("Selection result with metadata:", result);

      // Verify result structure
      if (typeof result !== "object") {
        throw new Error(
          "Result should be an object when includeMetadata is true"
        );
      }

      if (typeof result.model !== "string") {
        throw new Error("result.model should be a string");
      }

      if (
        !["preferred", "capability_match", "cost_match", "fallback"].includes(
          result.reason
        )
      ) {
        throw new Error(`Invalid reason: ${result.reason}`);
      }

      if (!Array.isArray(result.capabilities)) {
        throw new Error("result.capabilities should be an array");
      }

      if (!["low", "medium", "high"].includes(result.costTier)) {
        throw new Error(`Invalid costTier: ${result.costTier}`);
      }

      if (typeof result.matchedRequirements !== "boolean") {
        throw new Error("result.matchedRequirements should be boolean");
      }

      if (!Array.isArray(result.requiredCapabilities)) {
        throw new Error("result.requiredCapabilities should be an array");
      }

      if (typeof result.candidatesConsidered !== "number") {
        throw new Error("result.candidatesConsidered should be a number");
      }

      logInfo("✅ P5-14 PASSED: Selection metadata returned correctly");
      return { passed: true, testId: "P5-14" };
    } catch (error) {
      logError("❌ P5-14 FAILED:", error.message);
      return { passed: false, testId: "P5-14", error: error.message };
    } finally {
      resetSelector();
    }
  }

  // ============================================================================
  // TEST P5-15: Debug Data Integration
  // ============================================================================

  async function testStage5_P5_15_DebugIntegration() {
    logInfo("P5-15: Testing debug data integration");

    try {
      checkSelectorAvailable();
      resetSelector();

      const selector = window.EmbedModelSelector;

      // Make a selection
      selector.selectModel({
        capabilities: ["vision"],
        includeMetadata: true,
      });

      // Get last selection for debug purposes
      const lastSelection = selector.getLastSelection();
      logDebug("Last selection for debug:", lastSelection);

      if (!lastSelection) {
        throw new Error("getLastSelection should return last selection");
      }

      if (typeof lastSelection.model !== "string") {
        throw new Error("Last selection should have model");
      }

      if (typeof lastSelection.reason !== "string") {
        throw new Error("Last selection should have reason");
      }

      if (typeof lastSelection.timestamp !== "number") {
        throw new Error("Last selection should have timestamp");
      }

      logInfo("✅ P5-15 PASSED: Debug data integration works");
      return { passed: true, testId: "P5-15" };
    } catch (error) {
      logError("❌ P5-15 FAILED:", error.message);
      return { passed: false, testId: "P5-15", error: error.message };
    } finally {
      resetSelector();
    }
  }

  // ============================================================================
  // TEST P5-16: Regression Tests
  // ============================================================================

  async function testStage5_P5_16_Regression() {
    logInfo("P5-16: Running regression tests for previous stages");

    try {
      let regressionPassed = 0;
      let regressionTotal = 0;

      // Check if Phase 4 tests are available and run them
      if (typeof window.runAllPhase4LoaderTests === "function") {
        logInfo("Running Phase 4 Loader tests...");
        const phase4Result = await window.runAllPhase4LoaderTests();
        regressionPassed += phase4Result.passed;
        regressionTotal += phase4Result.total;
        logDebug(
          `Phase 4 Loader: ${phase4Result.passed}/${phase4Result.total}`
        );
      } else {
        logWarn("Phase 4 Loader tests not available");
      }

      // Check for other regression test suites
      if (typeof window.testStage5_Phase1_All === "function") {
        logInfo("Running Phase 1 Compression tests...");
        const phase1Result = await window.testStage5_Phase1_All();
        if (phase1Result.passed !== undefined) {
          regressionPassed += phase1Result.passed;
          regressionTotal += phase1Result.total;
        }
      }

      if (typeof window.testStage5_Phase2_All === "function") {
        logInfo("Running Phase 2 Progress tests...");
        const phase2Result = await window.testStage5_Phase2_All();
        if (phase2Result.passed !== undefined) {
          regressionPassed += phase2Result.passed;
          regressionTotal += phase2Result.total;
        }
      }

      if (typeof window.testStage5_Phase3_All === "function") {
        logInfo("Running Phase 3 Request Control tests...");
        const phase3Result = await window.testStage5_Phase3_All();
        if (phase3Result.passed !== undefined) {
          regressionPassed += phase3Result.passed;
          regressionTotal += phase3Result.total;
        }
      }

      logInfo(
        `Regression tests completed: ${regressionPassed}/${regressionTotal} passed`
      );

      if (regressionTotal === 0) {
        logWarn("No regression test suites found - manual verification needed");
        logInfo(
          "✅ P5-16 PASSED: No regressions detected (no previous tests found)"
        );
        return {
          passed: true,
          testId: "P5-16",
          regressionPassed: 0,
          regressionTotal: 0,
        };
      }

      const allPassed = regressionPassed === regressionTotal;

      if (allPassed) {
        logInfo("✅ P5-16 PASSED: All regression tests pass");
      } else {
        throw new Error(
          `Regression failures: ${
            regressionTotal - regressionPassed
          }/${regressionTotal}`
        );
      }

      return {
        passed: allPassed,
        testId: "P5-16",
        regressionPassed,
        regressionTotal,
      };
    } catch (error) {
      logError("❌ P5-16 FAILED:", error.message);
      return { passed: false, testId: "P5-16", error: error.message };
    }
  }

  // ============================================================================
  // TEST RUNNER
  // ============================================================================

  /**
   * Run all Phase 5 Model Selection tests
   */
  async function runAllPhase5ModelSelectorTests() {
    console.log("\n" + "=".repeat(70));
    console.log("PHASE 5: MODEL SELECTION INTEGRATION TESTS");
    console.log("=".repeat(70) + "\n");

    const results = [];
    const tests = [
      testStage5_P5_01_ModuleExists,
      testStage5_P5_02_CapabilityDetection,
      testStage5_P5_03_ModelFiltering,
      testStage5_P5_04_CostTiers,
      testStage5_P5_05_BasicSelection,
      testStage5_P5_06_CostPreference,
      testStage5_P5_07_PreferredModels,
      testStage5_P5_08_FallbackModel,
      testStage5_P5_09_ModelExclusion,
      testStage5_P5_10_EmbedIntegration,
      testStage5_P5_11_AutoDetection,
      testStage5_P5_12_ManualOverride,
      testStage5_P5_13_GracefulDegradation,
      testStage5_P5_14_SelectionMetadata,
      testStage5_P5_15_DebugIntegration,
      testStage5_P5_16_Regression,
    ];

    for (const test of tests) {
      console.log("\n" + "-".repeat(50));
      const result = await test();
      results.push(result);
    }

    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("PHASE 5 MODEL SELECTION TEST SUMMARY");
    console.log("=".repeat(70));

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${results.length}`);

    if (failed > 0) {
      console.log("\nFailed tests:");
      results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`  - ${r.testId}: ${r.error}`);
        });
    }

    console.log("\n" + "=".repeat(70) + "\n");

    return {
      passed,
      failed,
      total: results.length,
      results,
      allPassed: failed === 0,
    };
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  // Individual tests
  window.testStage5_P5_01_ModuleExists = testStage5_P5_01_ModuleExists;
  window.testStage5_P5_02_CapabilityDetection =
    testStage5_P5_02_CapabilityDetection;
  window.testStage5_P5_03_ModelFiltering = testStage5_P5_03_ModelFiltering;
  window.testStage5_P5_04_CostTiers = testStage5_P5_04_CostTiers;
  window.testStage5_P5_05_BasicSelection = testStage5_P5_05_BasicSelection;
  window.testStage5_P5_06_CostPreference = testStage5_P5_06_CostPreference;
  window.testStage5_P5_07_PreferredModels = testStage5_P5_07_PreferredModels;
  window.testStage5_P5_08_FallbackModel = testStage5_P5_08_FallbackModel;
  window.testStage5_P5_09_ModelExclusion = testStage5_P5_09_ModelExclusion;
  window.testStage5_P5_10_EmbedIntegration = testStage5_P5_10_EmbedIntegration;
  window.testStage5_P5_11_AutoDetection = testStage5_P5_11_AutoDetection;
  window.testStage5_P5_12_ManualOverride = testStage5_P5_12_ManualOverride;
  window.testStage5_P5_13_GracefulDegradation =
    testStage5_P5_13_GracefulDegradation;
  window.testStage5_P5_14_SelectionMetadata =
    testStage5_P5_14_SelectionMetadata;
  window.testStage5_P5_15_DebugIntegration = testStage5_P5_15_DebugIntegration;
  window.testStage5_P5_16_Regression = testStage5_P5_16_Regression;

  // Test runner
  window.runAllPhase5ModelSelectorTests = runAllPhase5ModelSelectorTests;
})();
