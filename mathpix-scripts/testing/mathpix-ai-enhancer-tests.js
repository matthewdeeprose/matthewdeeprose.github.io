/**
 * @fileoverview MathPix AI Enhancer - Test Suite
 * @module MathPixAIEnhancerTests
 * @version 1.0.0
 * @since Phase 7.1C
 *
 * Test commands for validating AI Enhancement functionality.
 * Separated from main module for cleaner code organisation.
 *
 * @requires MathPixAIEnhancer - Main enhancer module
 */

(function () {
  "use strict";

  // ============================================================================
  // PHASE 7.1 TEST COMMANDS (Core Functionality)
  // ============================================================================

  /**
   * Quick validation of Phase 7.1 implementation
   */
  window.validatePhase71 = function () {
    console.log("🧪 Phase 7.1 Validation");
    console.log("=".repeat(50));

    const checks = [
      {
        name: "OpenRouterEmbed available",
        pass: typeof OpenRouterEmbed !== "undefined",
      },
      {
        name: "EmbedFileUtils available",
        pass: typeof EmbedFileUtils !== "undefined",
      },
      {
        name: "UniversalModal available",
        pass: typeof UniversalModal !== "undefined",
      },
      {
        name: "MathPixAIEnhancer available",
        pass: typeof MathPixAIEnhancer !== "undefined",
      },
      {
        name: "getMathPixAIEnhancer function exists",
        pass: typeof window.getMathPixAIEnhancer === "function",
      },
      {
        name: "AI Enhance button exists",
        pass: !!document.getElementById("resume-ai-enhance-btn"),
      },
      {
        name: "openAIEnhancementModal function exists",
        pass: typeof window.openAIEnhancementModal === "function",
      },
    ];

    let passed = 0;
    checks.forEach((check) => {
      const icon = check.pass ? "✅" : "❌";
      console.log(`${icon} ${check.name}`);
      if (check.pass) passed++;
    });

    console.log("=".repeat(50));
    console.log(`Result: ${passed}/${checks.length} checks passed`);

    return passed === checks.length;
  };

  /**
   * Test enhancement availability detection
   */
  window.testAIEnhanceAvailability = function () {
    const enhancer = window.getMathPixAIEnhancer?.();
    if (!enhancer) {
      console.error("❌ AI Enhancer not initialised");
      return false;
    }

    const available = enhancer.isEnhancementAvailable();
    console.log(`AI Enhancement available: ${available ? "✅ Yes" : "❌ No"}`);

    // Show why if not available
    if (!available) {
      const restorer = window.getMathPixSessionRestorer?.();
      console.log(
        "  - Session restorer initialised:",
        !!restorer?.isInitialised,
      );
      console.log("  - Is PDF source:", !!restorer?.restoredSession?.isPDF);
      console.log(
        "  - Has source file:",
        !!restorer?.restoredSession?.source?.blob,
      );
      console.log(
        "  - Has MMD content:",
        !!(restorer?.elements?.mmdEditorTextarea?.value?.length > 0),
      );
    }

    return available;
  };

  /**
   * Test modal opening (requires valid session)
   */
  window.testOpenAIModal = function () {
    if (!window.testAIEnhanceAvailability()) {
      console.log("⚠️ Cannot test modal - enhancement not available");
      console.log("Load a PDF resume session first");
      return;
    }

    window.openAIEnhancementModal();
    console.log("✅ Modal should now be open");
  };

  /**
   * Test system prompt loading
   */
  window.testAISystemPrompt = async function () {
    const enhancer = window.getMathPixAIEnhancer?.();
    if (!enhancer) {
      console.error("❌ AI Enhancer not initialised");
      return;
    }

    const prompt = await enhancer.loadSystemPrompt();
    console.log("System prompt loaded:");
    console.log(prompt.substring(0, 500) + "...");
    console.log(`Total length: ${prompt.length} characters`);
  };

  /**
   * Run all Phase 7.1 tests
   */
  window.testPhase71Complete = async function () {
    console.log("🧪 Running Phase 7.1 Complete Test Suite");
    console.log("=".repeat(60));

    // 1. Validation
    console.log("\n1. Component Validation:");
    const valid = window.validatePhase71();

    // 2. Availability check
    console.log("\n2. Enhancement Availability:");
    window.testAIEnhanceAvailability();

    // 3. System prompt
    console.log("\n3. System Prompt:");
    await window.testAISystemPrompt();

    console.log("\n" + "=".repeat(60));
    console.log("Test suite complete");
  };

  // ============================================================================
  // PHASE 7.1C TEST COMMANDS (4-Column View)
  // ============================================================================

  /**
   * Test column toggle functionality
   */
  window.testAIColumnToggles = function () {
    console.log("🧪 Testing Column Toggle Functionality");
    console.log("=".repeat(50));

    const enhancer = window.getMathPixAIEnhancer?.();
    if (!enhancer) {
      console.error("❌ AI Enhancer not available");
      return false;
    }

    const checks = [
      {
        name: "toggleColumn method exists",
        pass: typeof enhancer.toggleColumn === "function",
      },
      {
        name: "loadColumnPreferences method exists",
        pass: typeof enhancer.loadColumnPreferences === "function",
      },
      {
        name: "saveColumnPreferences method exists",
        pass: typeof enhancer.saveColumnPreferences === "function",
      },
      {
        name: "renderSourcePDF method exists",
        pass: typeof enhancer.renderSourcePDF === "function",
      },
      {
        name: "ensurePDFJSLoaded method exists",
        pass: typeof enhancer.ensurePDFJSLoaded === "function",
      },
      {
        name: "pdfRendered property exists",
        pass: "pdfRendered" in enhancer,
      },
      {
        name: "toggleAIColumn global function exists",
        pass: typeof window.toggleAIColumn === "function",
      },
    ];

    let passed = 0;
    checks.forEach((check) => {
      const icon = check.pass ? "✅" : "❌";
      console.log(`${icon} ${check.name}`);
      if (check.pass) passed++;
    });

    console.log("=".repeat(50));
    console.log(`Result: ${passed}/${checks.length} checks passed`);

    return passed === checks.length;
  };

  /**
   * Test column preferences persistence
   */
  window.testAIColumnPreferences = function () {
    console.log("🧪 Testing Column Preferences");
    console.log("=".repeat(50));

    const enhancer = window.getMathPixAIEnhancer?.();
    if (!enhancer) {
      console.error("❌ AI Enhancer not available");
      return false;
    }

    // Load current preferences
    const prefs = enhancer.loadColumnPreferences();
    console.log("Current preferences:", prefs);

    // Verify structure
    const hasAllKeys =
      "original" in prefs &&
      "enhanced" in prefs &&
      "preview" in prefs &&
      "pdf" in prefs;

    console.log(
      hasAllKeys
        ? "✅ All preference keys present"
        : "❌ Missing preference keys",
    );

    // Verify defaults
    console.log("Current values (may differ if user changed):", {
      original: prefs.original,
      enhanced: prefs.enhanced,
      preview: prefs.preview,
      pdf: prefs.pdf,
    });

    return hasAllKeys;
  };

  /**
   * Test 4-column results view (requires active modal with results)
   */
  window.testAI4ColumnView = function () {
    console.log("🧪 Testing 4-Column Results View");
    console.log("=".repeat(50));

    const checks = [
      {
        name: "Column toggles fieldset exists",
        pass: !!document.querySelector(".ai-column-toggles"),
      },
      {
        name: "Comparison grid exists",
        pass: !!document.querySelector(".ai-comparison-grid"),
      },
      {
        name: "Original column exists",
        pass: !!document.getElementById("ai-col-original"),
      },
      {
        name: "Enhanced column exists",
        pass: !!document.getElementById("ai-col-enhanced"),
      },
      {
        name: "Preview column exists",
        pass: !!document.getElementById("ai-col-preview"),
      },
      {
        name: "PDF column exists",
        pass: !!document.getElementById("ai-col-pdf"),
      },
      {
        name: "Toggle checkboxes exist",
        pass:
          !!document.getElementById("toggle-original") &&
          !!document.getElementById("toggle-enhanced") &&
          !!document.getElementById("toggle-preview") &&
          !!document.getElementById("toggle-pdf"),
      },
    ];

    let passed = 0;
    checks.forEach((check) => {
      const icon = check.pass ? "✅" : "❌";
      console.log(`${icon} ${check.name}`);
      if (check.pass) passed++;
    });

    console.log("=".repeat(50));
    console.log(`Result: ${passed}/${checks.length} checks passed`);

    if (passed === 0) {
      console.log(
        "💡 Tip: Run this test after enhancement completes and results are displayed",
      );
    }

    return passed === checks.length;
  };

  /**
   * Validate Phase 7.1C implementation
   */
  window.validatePhase71C = function () {
    console.log("🧪 Phase 7.1C Validation (4-Column View)");
    console.log("=".repeat(60));

    console.log("\n1. Method Availability:");
    const methodsOk = window.testAIColumnToggles();

    console.log("\n2. Preferences System:");
    const prefsOk = window.testAIColumnPreferences();

    console.log("\n3. DOM Elements (if modal open with results):");
    const domOk = window.testAI4ColumnView();

    console.log("\n" + "=".repeat(60));
    const allPassed = methodsOk && prefsOk;
    console.log(
      allPassed
        ? "✅ Phase 7.1C core validation passed"
        : "⚠️ Some checks failed",
    );
    console.log("Note: DOM tests require results view to be open");

    return allPassed;
  };

  /**
   * Reset column preferences to defaults
   */
  window.resetAIColumnPreferences = function () {
    const defaults = {
      original: false,
      enhanced: true,
      preview: true,
      pdf: false,
    };

    try {
      localStorage.setItem("ai-enhance-column-prefs", JSON.stringify(defaults));
      console.log("✅ Column preferences reset to defaults:", defaults);
    } catch (error) {
      console.error("❌ Failed to reset preferences:", error);
    }
  };

  /**
   * Run complete test suite for all phases
   */
  window.testAIEnhancerComplete = async function () {
    console.log("🧪 AI Enhancer Complete Test Suite");
    console.log("=".repeat(60));

    console.log("\n📋 PHASE 7.1 (Core):");
    await window.testPhase71Complete();

    console.log("\n📋 PHASE 7.1C (4-Column View):");
    window.validatePhase71C();

    console.log("\n" + "=".repeat(60));
    console.log("Complete test suite finished");
    console.log(
      "💡 For full DOM tests, load a PDF session and run enhancement first",
    );
  };

  // Log load confirmation
  console.log("[AIEnhancer Tests] Test module loaded");
  console.log(
    "[AIEnhancer Tests] Commands: validatePhase71(), validatePhase71C(), testAIEnhancerComplete()",
  );
})();
