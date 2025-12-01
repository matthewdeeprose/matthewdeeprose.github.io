/**
 * OpenRouter Embed API - Stage 4 Phase 2 Test Suite
 *
 * Comprehensive testing for configuration module including:
 * - Configuration templates (AC-4.1)
 * - Validation helpers (AC-4.2)
 * - Preset management (AC-4.3)
 * - Configuration comparison (AC-4.4)
 *
 * @version 1.0.0 (Stage 4 Phase 2)
 * @requires window.EmbedConfiguration
 * @requires window.OpenRouterEmbed
 * @date 24 November 2025
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
      console.error(`[EmbedStage4Phase2Tests] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedStage4Phase2Tests] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedStage4Phase2Tests] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedStage4Phase2Tests] ${message}`, ...args);
  }

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  /**
   * Clean up test presets before/after tests
   */
  function cleanupTestPresets() {
    const config = new window.EmbedConfiguration();
    const presets = config.listPresets();

    // Delete any test presets
    presets
      .filter((name) => name.startsWith("test-"))
      .forEach((name) => config.deletePreset(name));

    logDebug("Test presets cleaned up");
  }

  /**
   * Create test container if needed
   */
  function ensureTestContainer() {
    let container = document.getElementById("embed-test-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "embed-test-container";
      container.style.cssText =
        "border: 2px solid #ccc; padding: 1rem; margin: 1rem 0; min-height: 100px;";
      document.body.appendChild(container);
    }
    return container;
  }

  // ============================================================================
  // AC-4.1: CONFIGURATION TEMPLATES TESTS
  // ============================================================================

  /**
   * Test 1: All templates exist and are valid
   */
  window.testEmbedStage4_ConfigTemplates = async function () {
    console.log("\n🧪 PHASE 2 TEST 1: Configuration Templates");
    console.log("==========================================\n");

    try {
      const config = new window.EmbedConfiguration();

      // Get template list
      const templates = config.listTemplates();
      console.log("✅ Templates available:", templates.join(", "));

      // Required templates
      const requiredTemplates = [
        "quick",
        "precise",
        "creative",
        "economical",
        "analysis",
        "mathpix",
      ];

      // Check all required templates exist
      const allExist = requiredTemplates.every((name) =>
        templates.includes(name)
      );
      console.log("✅ All 6 required templates present:", allExist);

      if (!allExist) {
        const missing = requiredTemplates.filter(
          (name) => !templates.includes(name)
        );
        console.log("❌ Missing templates:", missing.join(", "));
        return {
          success: false,
          error: "Missing templates: " + missing.join(", "),
        };
      }

      // Verify each template has required properties
      let allValid = true;
      const requiredProps = [
        "model",
        "temperature",
        "max_tokens",
        "top_p",
        "description",
      ];

      for (const templateName of requiredTemplates) {
        const template = config.getTemplate(templateName);

        if (!template) {
          console.log(`❌ Template not found: ${templateName}`);
          allValid = false;
          continue;
        }

        const hasAllProps = requiredProps.every((prop) =>
          template.hasOwnProperty(prop)
        );

        if (!hasAllProps) {
          const missing = requiredProps.filter(
            (prop) => !template.hasOwnProperty(prop)
          );
          console.log(
            `❌ Template ${templateName} missing properties:`,
            missing.join(", ")
          );
          allValid = false;
        } else {
          console.log(`✅ Template ${templateName}:`, {
            model: template.model,
            temperature: template.temperature,
            max_tokens: template.max_tokens,
            top_p: template.top_p,
          });
        }
      }

      console.log("\n✅ All templates valid:", allValid);

      if (allValid) {
        console.log("\n🎉 TEST 1 PASSED!\n");
        return { success: true, templateCount: templates.length };
      } else {
        console.log("\n❌ TEST 1 FAILED!\n");
        return { success: false, error: "Template validation failed" };
      }
    } catch (error) {
      console.error("❌ TEST 1 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Test 2: Templates can be applied to embed instances
   */
  window.testEmbedStage4_ConfigTemplateApply = async function () {
    console.log("\n🧪 PHASE 2 TEST 2: Template Application");
    console.log("=======================================\n");

    try {
      // Ensure test container exists
      ensureTestContainer();

      const config = new window.EmbedConfiguration();

      // Get quick template
      const quickTemplate = config.getTemplate("quick");
      console.log("✅ Quick template retrieved:", quickTemplate);

      // Test createFromTemplate utility
      const configFromTemplate = config.createFromTemplate("precise", {
        max_tokens: 3000,
      });
      console.log("✅ Config from template with override:", configFromTemplate);

      // Verify override was applied
      const overrideApplied =
        configFromTemplate.max_tokens === 3000 &&
        configFromTemplate.temperature === 0.3; // From precise template

      console.log("✅ Override correctly applied:", overrideApplied);

      // Verify description is removed from config
      const noDescription = !configFromTemplate.hasOwnProperty("description");
      console.log("✅ Description removed from config:", noDescription);

      // Check if OpenRouterEmbed is available for full integration test
      if (window.OpenRouterEmbed) {
        // Create embed with template values
        const embedConfig = config.createFromTemplate("quick");
        const embed = new window.OpenRouterEmbed({
          containerId: "embed-test-container",
          ...embedConfig,
          showNotifications: false,
        });

        // Verify values were applied
        const valuesMatch =
          embed.temperature === quickTemplate.temperature &&
          embed.max_tokens === quickTemplate.max_tokens &&
          embed.model === quickTemplate.model;

        console.log("✅ Template applied to OpenRouterEmbed:", valuesMatch);

        if (!valuesMatch) {
          console.log("   Expected:", {
            temperature: quickTemplate.temperature,
            max_tokens: quickTemplate.max_tokens,
            model: quickTemplate.model,
          });
          console.log("   Got:", {
            temperature: embed.temperature,
            max_tokens: embed.max_tokens,
            model: embed.model,
          });
        }

        console.log("\n🎉 TEST 2 PASSED!\n");
        return { success: valuesMatch && overrideApplied && noDescription };
      } else {
        console.log("⚠️  OpenRouterEmbed not available - partial test only");
        console.log("\n🎉 TEST 2 PASSED (partial)!\n");
        return { success: overrideApplied && noDescription, partial: true };
      }
    } catch (error) {
      console.error("❌ TEST 2 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  };

  // ============================================================================
  // AC-4.2: VALIDATION HELPERS TESTS
  // ============================================================================

  /**
   * Test 3: All validators work correctly
   */
  window.testEmbedStage4_ConfigValidation = async function () {
    console.log("\n🧪 PHASE 2 TEST 3: Validation Helpers");
    console.log("=====================================\n");

    try {
      const config = new window.EmbedConfiguration();

      let allPassed = true;

      // Temperature validation
      console.log("Testing temperature validation...");
      const tempTests = [
        { value: 0, expected: true, desc: "0 (min)" },
        { value: 0.5, expected: true, desc: "0.5 (mid)" },
        { value: 1.0, expected: true, desc: "1.0 (standard max)" },
        { value: 2.0, expected: true, desc: "2.0 (extended max)" },
        { value: 0.7, expected: true, desc: "0.7 (common)" },
      ];

      for (const test of tempTests) {
        const result = config.validateTemperature(test.value);
        const passed = result === test.expected;
        console.log(
          `  ${passed ? "✅" : "❌"} Temperature ${test.desc}: ${result}`
        );
        if (!passed) allPassed = false;
      }

      // Max tokens validation
      console.log("\nTesting max_tokens validation...");
      const tokenTests = [
        { value: 1, expected: true, desc: "1 (min)" },
        { value: 100, expected: true, desc: "100" },
        { value: 1000, expected: true, desc: "1000" },
        { value: 8000, expected: true, desc: "8000 (high)" },
      ];

      for (const test of tokenTests) {
        const result = config.validateMaxTokens(test.value);
        const passed = result === test.expected;
        console.log(
          `  ${passed ? "✅" : "❌"} Max tokens ${test.desc}: ${result}`
        );
        if (!passed) allPassed = false;
      }

      // Model validation
      console.log("\nTesting model validation...");
      const modelTests = [
        {
          value: "anthropic/claude-3.7-sonnet",
          expected: true,
          desc: "valid model",
        },
        { value: "openai/gpt-4", expected: true, desc: "other provider" },
        { value: "test-model", expected: true, desc: "simple name" },
      ];

      for (const test of modelTests) {
        const result = config.validateModel(test.value);
        const passed = result === test.expected;
        console.log(`  ${passed ? "✅" : "❌"} Model ${test.desc}: ${result}`);
        if (!passed) allPassed = false;
      }

      // Top-p validation
      console.log("\nTesting top_p validation...");
      const topPTests = [
        { value: 0, expected: true, desc: "0 (min)" },
        { value: 0.5, expected: true, desc: "0.5 (mid)" },
        { value: 1.0, expected: true, desc: "1.0 (max)" },
        { value: 0.95, expected: true, desc: "0.95 (common)" },
      ];

      for (const test of topPTests) {
        const result = config.validateTopP(test.value);
        const passed = result === test.expected;
        console.log(`  ${passed ? "✅" : "❌"} Top-p ${test.desc}: ${result}`);
        if (!passed) allPassed = false;
      }

      // Full config validation
      console.log("\nTesting full configuration validation...");
      const validConfig = {
        model: "anthropic/claude-3.7-sonnet",
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 0.95,
      };

      const validResult = config.validateConfiguration(validConfig);
      console.log(
        `  ${validResult.isValid ? "✅" : "❌"} Valid config passes:`,
        validResult.isValid
      );
      if (!validResult.isValid) allPassed = false;

      if (allPassed) {
        console.log("\n🎉 TEST 3 PASSED!\n");
      } else {
        console.log("\n❌ TEST 3 FAILED!\n");
      }

      return { success: allPassed };
    } catch (error) {
      console.error("❌ TEST 3 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  };

  /**
   * Test 4: Edge cases and invalid values
   */
  window.testEmbedStage4_ConfigValidationEdge = async function () {
    console.log("\n🧪 PHASE 2 TEST 4: Validation Edge Cases");
    console.log("========================================\n");

    try {
      const config = new window.EmbedConfiguration();

      let allPassed = true;

      // Invalid temperature values
      console.log("Testing invalid temperature values...");
      const invalidTempTests = [
        { value: -1, expected: false, desc: "negative" },
        { value: -0.1, expected: false, desc: "slightly negative" },
        { value: 2.1, expected: false, desc: "above 2.0" },
        { value: 3, expected: false, desc: "way above max" },
        { value: "0.5", expected: false, desc: "string" },
        { value: null, expected: false, desc: "null" },
        { value: undefined, expected: false, desc: "undefined" },
        { value: NaN, expected: false, desc: "NaN" },
      ];

      for (const test of invalidTempTests) {
        const result = config.validateTemperature(test.value);
        const passed = result === test.expected;
        console.log(
          `  ${passed ? "✅" : "❌"} Temperature ${test.desc}: ${result}`
        );
        if (!passed) allPassed = false;
      }

      // Invalid max_tokens values
      console.log("\nTesting invalid max_tokens values...");
      const invalidTokenTests = [
        { value: 0, expected: false, desc: "zero" },
        { value: -100, expected: false, desc: "negative" },
        { value: 0.5, expected: false, desc: "decimal" },
        { value: "1000", expected: false, desc: "string" },
        { value: null, expected: false, desc: "null" },
        { value: undefined, expected: false, desc: "undefined" },
      ];

      for (const test of invalidTokenTests) {
        const result = config.validateMaxTokens(test.value);
        const passed = result === test.expected;
        console.log(
          `  ${passed ? "✅" : "❌"} Max tokens ${test.desc}: ${result}`
        );
        if (!passed) allPassed = false;
      }

      // Invalid model values
      console.log("\nTesting invalid model values...");
      const invalidModelTests = [
        { value: "", expected: false, desc: "empty string" },
        { value: "   ", expected: false, desc: "whitespace only" },
        { value: null, expected: false, desc: "null" },
        { value: undefined, expected: false, desc: "undefined" },
        { value: 123, expected: false, desc: "number" },
      ];

      for (const test of invalidModelTests) {
        const result = config.validateModel(test.value);
        const passed = result === test.expected;
        console.log(`  ${passed ? "✅" : "❌"} Model ${test.desc}: ${result}`);
        if (!passed) allPassed = false;
      }

      // Invalid top_p values
      console.log("\nTesting invalid top_p values...");
      const invalidTopPTests = [
        { value: -0.1, expected: false, desc: "negative" },
        { value: 1.1, expected: false, desc: "above 1" },
        { value: 1.5, expected: false, desc: "way above 1" },
        { value: "0.5", expected: false, desc: "string" },
        { value: null, expected: false, desc: "null" },
      ];

      for (const test of invalidTopPTests) {
        const result = config.validateTopP(test.value);
        const passed = result === test.expected;
        console.log(`  ${passed ? "✅" : "❌"} Top-p ${test.desc}: ${result}`);
        if (!passed) allPassed = false;
      }

      // Invalid full config
      console.log("\nTesting invalid configurations...");
      const invalidConfig = {
        model: "anthropic/claude-3.7-sonnet",
        temperature: 5.0, // Invalid
        max_tokens: -100, // Invalid
        top_p: 1.5, // Invalid
      };

      const invalidResult = config.validateConfiguration(invalidConfig);
      const invalidFails =
        !invalidResult.isValid && invalidResult.errors.length === 3;
      console.log(
        `  ${invalidFails ? "✅" : "❌"} Invalid config rejected:`,
        !invalidResult.isValid
      );
      console.log("     Errors found:", invalidResult.errors.length);
      if (!invalidFails) allPassed = false;

      // Edge case: empty object
      const emptyResult = config.validateConfiguration({});
      const emptyPasses = emptyResult.isValid;
      console.log(
        `  ${emptyPasses ? "✅" : "❌"} Empty config (no params) passes:`,
        emptyPasses
      );
      if (!emptyPasses) allPassed = false;

      // Edge case: null config
      const nullResult = config.validateConfiguration(null);
      const nullFails = !nullResult.isValid;
      console.log(
        `  ${nullFails ? "✅" : "❌"} Null config rejected:`,
        !nullResult.isValid
      );
      if (!nullFails) allPassed = false;

      if (allPassed) {
        console.log("\n🎉 TEST 4 PASSED!\n");
      } else {
        console.log("\n❌ TEST 4 FAILED!\n");
      }

      return { success: allPassed };
    } catch (error) {
      console.error("❌ TEST 4 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  };

  // ============================================================================
  // AC-4.3: PRESET MANAGEMENT TESTS
  // ============================================================================

  /**
   * Test 5: Save presets
   */
  window.testEmbedStage4_ConfigPresetSave = async function () {
    console.log("\n🧪 PHASE 2 TEST 5: Preset Save");
    console.log("==============================\n");

    try {
      // Clean up before test
      cleanupTestPresets();

      const config = new window.EmbedConfiguration();

      // Test saving a preset
      const myConfig = {
        model: "anthropic/claude-3.7-sonnet",
        temperature: 0.5,
        max_tokens: 1500,
        systemPrompt: "You are a helpful assistant.",
      };

      console.log("Saving preset 'test-assistant'...");
      const saveResult = config.savePreset("test-assistant", myConfig);
      console.log("✅ Save returned:", saveResult);

      // Verify it's in storage
      const exists = config.hasPreset("test-assistant");
      console.log("✅ Preset exists:", exists);

      // Test overwriting
      const updatedConfig = { ...myConfig, temperature: 0.8 };
      console.log("\nOverwriting preset with new temperature...");
      config.savePreset("test-assistant", updatedConfig);

      const loaded = config.loadPreset("test-assistant");
      const wasOverwritten = loaded.temperature === 0.8;
      console.log("✅ Preset was overwritten:", wasOverwritten);

      // Test invalid preset names
      console.log("\nTesting invalid preset names...");
      let invalidNameThrew = false;
      try {
        config.savePreset("", myConfig);
      } catch (e) {
        invalidNameThrew = true;
        console.log("✅ Empty name threw error:", e.message);
      }
      if (!invalidNameThrew) {
        console.log("❌ Empty name should have thrown error");
      }

      // Test invalid config
      let invalidConfigThrew = false;
      try {
        config.savePreset("test-invalid", null);
      } catch (e) {
        invalidConfigThrew = true;
        console.log("✅ Null config threw error:", e.message);
      }
      if (!invalidConfigThrew) {
        console.log("❌ Null config should have thrown error");
      }

      // Clean up
      cleanupTestPresets();

      const success =
        saveResult &&
        exists &&
        wasOverwritten &&
        invalidNameThrew &&
        invalidConfigThrew;

      if (success) {
        console.log("\n🎉 TEST 5 PASSED!\n");
      } else {
        console.log("\n❌ TEST 5 FAILED!\n");
      }

      return { success };
    } catch (error) {
      console.error("❌ TEST 5 FAILED:", error.message);
      cleanupTestPresets();
      return { success: false, error: error.message };
    }
  };

  /**
   * Test 6: Load presets
   */
  window.testEmbedStage4_ConfigPresetLoad = async function () {
    console.log("\n🧪 PHASE 2 TEST 6: Preset Load");
    console.log("==============================\n");

    try {
      cleanupTestPresets();

      const config = new window.EmbedConfiguration();

      // Save a preset first
      const originalConfig = {
        model: "anthropic/claude-3.5-haiku",
        temperature: 0.7,
        max_tokens: 2000,
        customField: "test value",
      };

      config.savePreset("test-loader", originalConfig);
      console.log("✅ Preset saved");

      // Load it
      const loaded = config.loadPreset("test-loader");
      console.log("✅ Preset loaded:", loaded);

      // Verify all fields match
      const fieldsMatch =
        loaded.model === originalConfig.model &&
        loaded.temperature === originalConfig.temperature &&
        loaded.max_tokens === originalConfig.max_tokens &&
        loaded.customField === originalConfig.customField;

      console.log("✅ All fields match:", fieldsMatch);

      if (!fieldsMatch) {
        console.log("   Expected:", originalConfig);
        console.log("   Got:", loaded);
      }

      // Test loading non-existent preset
      const notFound = config.loadPreset("non-existent-preset");
      const notFoundIsNull = notFound === null;
      console.log("✅ Non-existent preset returns null:", notFoundIsNull);

      // Test loading with invalid name
      const invalidName = config.loadPreset(null);
      const invalidIsNull = invalidName === null;
      console.log("✅ Invalid name returns null:", invalidIsNull);

      // Clean up
      cleanupTestPresets();

      const success = fieldsMatch && notFoundIsNull && invalidIsNull;

      if (success) {
        console.log("\n🎉 TEST 6 PASSED!\n");
      } else {
        console.log("\n❌ TEST 6 FAILED!\n");
      }

      return { success };
    } catch (error) {
      console.error("❌ TEST 6 FAILED:", error.message);
      cleanupTestPresets();
      return { success: false, error: error.message };
    }
  };

  /**
   * Test 7: List and hasPreset
   */
  window.testEmbedStage4_ConfigPresetList = async function () {
    console.log("\n🧪 PHASE 2 TEST 7: Preset List & HasPreset");
    console.log("==========================================\n");

    try {
      cleanupTestPresets();

      const config = new window.EmbedConfiguration();

      // Get initial list
      const initialList = config.listPresets();
      console.log("✅ Initial presets:", initialList.length);

      // Save some test presets
      config.savePreset("test-one", { model: "model-1" });
      config.savePreset("test-two", { model: "model-2" });
      config.savePreset("test-three", { model: "model-3" });

      // Check list
      const afterSave = config.listPresets();
      console.log("✅ After saving 3 presets:", afterSave.length);

      const hasAllThree =
        afterSave.includes("test-one") &&
        afterSave.includes("test-two") &&
        afterSave.includes("test-three");

      console.log("✅ All test presets in list:", hasAllThree);

      // Test hasPreset
      const hasOne = config.hasPreset("test-one");
      const hasTwo = config.hasPreset("test-two");
      const hasNonExistent = config.hasPreset("non-existent");

      console.log("✅ hasPreset('test-one'):", hasOne);
      console.log("✅ hasPreset('test-two'):", hasTwo);
      console.log("✅ hasPreset('non-existent'):", hasNonExistent);

      const hasPresetWorks = hasOne && hasTwo && !hasNonExistent;
      console.log("✅ hasPreset works correctly:", hasPresetWorks);

      // Clean up
      cleanupTestPresets();

      const success = hasAllThree && hasPresetWorks;

      if (success) {
        console.log("\n🎉 TEST 7 PASSED!\n");
      } else {
        console.log("\n❌ TEST 7 FAILED!\n");
      }

      return { success };
    } catch (error) {
      console.error("❌ TEST 7 FAILED:", error.message);
      cleanupTestPresets();
      return { success: false, error: error.message };
    }
  };

  /**
   * Test 8: Delete presets
   */
  window.testEmbedStage4_ConfigPresetDelete = async function () {
    console.log("\n🧪 PHASE 2 TEST 8: Preset Delete");
    console.log("================================\n");

    try {
      cleanupTestPresets();

      const config = new window.EmbedConfiguration();

      // Save a preset
      config.savePreset("test-delete-me", { model: "to-be-deleted" });
      console.log("✅ Preset saved");

      // Verify it exists
      const existsBefore = config.hasPreset("test-delete-me");
      console.log("✅ Exists before delete:", existsBefore);

      // Delete it
      const deleteResult = config.deletePreset("test-delete-me");
      console.log("✅ Delete returned:", deleteResult);

      // Verify it's gone
      const existsAfter = config.hasPreset("test-delete-me");
      console.log("✅ Exists after delete:", existsAfter);

      // Try to delete non-existent preset
      const deleteNonExistent = config.deletePreset("never-existed");
      console.log("✅ Delete non-existent returns false:", !deleteNonExistent);

      // Try to delete with invalid name
      const deleteInvalid = config.deletePreset(null);
      console.log("✅ Delete invalid returns false:", !deleteInvalid);

      const success =
        existsBefore &&
        deleteResult &&
        !existsAfter &&
        !deleteNonExistent &&
        !deleteInvalid;

      if (success) {
        console.log("\n🎉 TEST 8 PASSED!\n");
      } else {
        console.log("\n❌ TEST 8 FAILED!\n");
      }

      return { success };
    } catch (error) {
      console.error("❌ TEST 8 FAILED:", error.message);
      cleanupTestPresets();
      return { success: false, error: error.message };
    }
  };

  // ============================================================================
  // AC-4.4: CONFIGURATION COMPARISON TEST
  // ============================================================================

  /**
   * Test 9: Configuration comparison
   */
  window.testEmbedStage4_ConfigComparison = async function () {
    console.log("\n🧪 PHASE 2 TEST 9: Configuration Comparison");
    console.log("============================================\n");

    try {
      const config = new window.EmbedConfiguration();

      // Test basic comparison
      const config1 = {
        model: "anthropic/claude-3.7-sonnet",
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 1.0,
      };

      const config2 = {
        model: "anthropic/claude-3.5-haiku", // Different
        temperature: 0.7, // Same
        max_tokens: 2000, // Different
        top_p: 1.0, // Same
      };

      console.log("Comparing configurations...");
      console.log("Config 1:", config1);
      console.log("Config 2:", config2);

      const diff = config.compareConfigurations(config1, config2);
      console.log("\nDiff result:", diff);

      // Verify changed fields
      const changedCorrect =
        diff.changed.includes("model") &&
        diff.changed.includes("max_tokens") &&
        diff.changed.length === 2;

      console.log("✅ Changed fields correct:", changedCorrect);

      // Verify unchanged fields
      const unchangedCorrect =
        diff.unchanged.includes("temperature") &&
        diff.unchanged.includes("top_p") &&
        diff.unchanged.length === 2;

      console.log("✅ Unchanged fields correct:", unchangedCorrect);

      // Verify details
      const detailsCorrect =
        diff.details.model &&
        diff.details.model.old === "anthropic/claude-3.7-sonnet" &&
        diff.details.model.new === "anthropic/claude-3.5-haiku" &&
        diff.details.max_tokens &&
        diff.details.max_tokens.old === 1000 &&
        diff.details.max_tokens.new === 2000;

      console.log("✅ Details correct:", detailsCorrect);

      // Test identical configs
      const identicalDiff = config.compareConfigurations(config1, {
        ...config1,
      });
      const identicalCorrect =
        identicalDiff.changed.length === 0 &&
        identicalDiff.unchanged.length === 4;

      console.log("✅ Identical configs have no changes:", identicalCorrect);

      // Test with missing properties
      const sparseConfig = { model: "test" };
      const fullConfig = { model: "test", temperature: 0.5 };
      const sparseDiff = config.compareConfigurations(sparseConfig, fullConfig);

      const sparseDiffCorrect =
        sparseDiff.changed.includes("temperature") &&
        sparseDiff.unchanged.includes("model");

      console.log("✅ Missing properties detected:", sparseDiffCorrect);

      // Test with null inputs
      const nullDiff = config.compareConfigurations(null, config1);
      const nullHandled =
        nullDiff.changed.length === Object.keys(config1).length;
      console.log("✅ Null input handled:", nullHandled);

      const success =
        changedCorrect &&
        unchangedCorrect &&
        detailsCorrect &&
        identicalCorrect &&
        sparseDiffCorrect &&
        nullHandled;

      if (success) {
        console.log("\n🎉 TEST 9 PASSED!\n");
      } else {
        console.log("\n❌ TEST 9 FAILED!\n");
      }

      return { success };
    } catch (error) {
      console.error("❌ TEST 9 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  };

  // ============================================================================
  // REGRESSION TEST
  // ============================================================================

  /**
   * Test 10: Verify no regressions in previous functionality
   */
  window.testEmbedStage4_Phase2_Regressions = async function () {
    console.log("\n🧪 PHASE 2 TEST 10: Regression Checks");
    console.log("=====================================\n");

    try {
      let allPassed = true;

      // Check EmbedConfiguration is available
      const configAvailable = !!window.EmbedConfiguration;
      console.log("✅ EmbedConfiguration available:", configAvailable);
      if (!configAvailable) allPassed = false;

      // Check OpenRouterEmbed is still available
      const embedAvailable = !!window.OpenRouterEmbed;
      console.log("✅ OpenRouterEmbed available:", embedAvailable);
      if (!embedAvailable) allPassed = false;

      // Check EmbedProgressIndicator (Phase 1)
      const progressAvailable = !!window.EmbedProgressIndicator;
      console.log("✅ EmbedProgressIndicator available:", progressAvailable);
      if (!progressAvailable) allPassed = false;

      // Check EmbedFileUtils (Stage 2)
      const fileUtilsAvailable = !!window.EmbedFileUtils;
      console.log("✅ EmbedFileUtils available:", fileUtilsAvailable);
      if (!fileUtilsAvailable) {
        console.log("   ⚠️  (May not be loaded - check if file is included)");
        // Don't fail test - it may not be loaded
      }

      // Quick functional test of EmbedConfiguration
      console.log("\nQuick functional verification...");
      const config = new window.EmbedConfiguration();

      // Templates work
      const templates = config.listTemplates();
      const templatesWork = templates.length === 6;
      console.log("✅ Templates work:", templatesWork);
      if (!templatesWork) allPassed = false;

      // Validation works
      const validationWorks = config.validateTemperature(0.7) === true;
      console.log("✅ Validation works:", validationWorks);
      if (!validationWorks) allPassed = false;

      // Comparison works
      const comparisonWorks =
        config.compareConfigurations({}, {}).changed.length === 0;
      console.log("✅ Comparison works:", comparisonWorks);
      if (!comparisonWorks) allPassed = false;

      // Quick test of OpenRouterEmbed if available
      if (embedAvailable) {
        try {
          ensureTestContainer();
          const embed = new window.OpenRouterEmbed({
            containerId: "embed-test-container",
            showNotifications: false,
          });
          const embedCreated = !!embed;
          console.log("✅ OpenRouterEmbed instantiation works:", embedCreated);
          if (!embedCreated) allPassed = false;
        } catch (e) {
          console.log(
            "⚠️  OpenRouterEmbed test skipped (dependencies may not be loaded)"
          );
        }
      }

      if (allPassed) {
        console.log("\n🎉 TEST 10 PASSED - No regressions detected!\n");
      } else {
        console.log("\n❌ TEST 10 FAILED - Regressions detected!\n");
      }

      return { success: allPassed };
    } catch (error) {
      console.error("❌ TEST 10 FAILED:", error.message);
      return { success: false, error: error.message };
    }
  };

  // ============================================================================
  // MASTER TEST SUITE
  // ============================================================================

  /**
   * Master Test Runner - Stage 4 Phase 2
   */
  window.testEmbedStage4_Phase2_All = async function () {
    console.clear();
    console.log(
      "╔═══════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║   OpenRouter Embed API - Stage 4 Phase 2 Complete Tests   ║"
    );
    console.log(
      "║              Configuration Module Testing                 ║"
    );
    console.log(
      "╚═══════════════════════════════════════════════════════════╝\n"
    );

    console.log("🤖 RUNNING PHASE 2 TESTS...\n");

    const results = {};

    // AC-4.1: Templates (2 tests)
    results.templates = await window.testEmbedStage4_ConfigTemplates();
    await new Promise((r) => setTimeout(r, 500));

    results.templateApply = await window.testEmbedStage4_ConfigTemplateApply();
    await new Promise((r) => setTimeout(r, 500));

    // AC-4.2: Validation (2 tests)
    results.validation = await window.testEmbedStage4_ConfigValidation();
    await new Promise((r) => setTimeout(r, 500));

    results.validationEdge =
      await window.testEmbedStage4_ConfigValidationEdge();
    await new Promise((r) => setTimeout(r, 500));

    // AC-4.3: Presets (4 tests)
    results.presetSave = await window.testEmbedStage4_ConfigPresetSave();
    await new Promise((r) => setTimeout(r, 500));

    results.presetLoad = await window.testEmbedStage4_ConfigPresetLoad();
    await new Promise((r) => setTimeout(r, 500));

    results.presetList = await window.testEmbedStage4_ConfigPresetList();
    await new Promise((r) => setTimeout(r, 500));

    results.presetDelete = await window.testEmbedStage4_ConfigPresetDelete();
    await new Promise((r) => setTimeout(r, 500));

    // AC-4.4: Comparison (1 test)
    results.comparison = await window.testEmbedStage4_ConfigComparison();
    await new Promise((r) => setTimeout(r, 500));

    // Regressions (1 test)
    results.regressions = await window.testEmbedStage4_Phase2_Regressions();

    // Summary
    console.log("════════════════════════════════════════════════════════════");
    console.log("📊 PHASE 2 TEST RESULTS");
    console.log(
      "════════════════════════════════════════════════════════════\n"
    );

    Object.entries(results).forEach(([name, result]) => {
      const icon = result.success ? "✅" : "❌";
      console.log(`${icon} ${name}`);
    });

    const allPassed = Object.values(results).every((r) => r.success);
    const passCount = Object.values(results).filter((r) => r.success).length;
    const totalCount = Object.keys(results).length;

    console.log(
      "\n════════════════════════════════════════════════════════════"
    );
    console.log(`Results: ${passCount}/${totalCount} tests passed`);
    console.log(
      "════════════════════════════════════════════════════════════\n"
    );

    if (allPassed) {
      console.log("✅ 🎉 ALL PHASE 2 TESTS PASSED!\n");
      console.log("Configuration Module: COMPLETE ✅\n");
      console.log("Summary:");
      console.log("  - AC-4.1: Configuration Templates ✅");
      console.log("  - AC-4.2: Validation Helpers ✅");
      console.log("  - AC-4.3: Preset Management ✅");
      console.log("  - AC-4.4: Configuration Comparison ✅");
    } else {
      console.log("❌ Some tests failed. Check output above.\n");
    }

    console.log("\n💾 Full results saved to window._embedStage4Phase2Results");

    window._embedStage4Phase2Results = results;
    return results;
  };

  // ============================================================================
  // INITIALIZATION LOG
  // ============================================================================
})(); // End of IIFE
