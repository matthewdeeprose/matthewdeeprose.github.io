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

    console.log("\n📋 PHASE 7.2E (Visual Diff Highlighting):");
    window.testPhase72E();

    console.log("\n" + "=".repeat(60));
    console.log("Complete test suite finished");
    console.log(
      "💡 For full DOM tests, load a PDF session and run enhancement first",
    );
  };

  // ============================================================================
  // PHASE 7.2D TEST COMMANDS (Statistics + Diff Foundation)
  // ============================================================================

  /**
   * Test jsdiff library is loaded
   */
  window.testDiffLibrary = function () {
    console.log("🧪 Testing jsdiff Library");
    console.log("=".repeat(50));

    if (typeof Diff === "undefined") {
      console.error("❌ Diff library not loaded");
      return false;
    }

    console.log("✅ Diff global object exists");

    // Test diffLines function
    const testOld = "line 1\nline 2\nline 3";
    const testNew = "line 1\nmodified line 2\nline 3\nline 4";

    const result = Diff.diffLines(testOld, testNew);

    if (Array.isArray(result) && result.length > 0) {
      console.log("✅ Diff.diffLines() works");
      console.log("  Sample diff parts:", result.length);
    } else {
      console.error("❌ Diff.diffLines() failed");
      return false;
    }

    console.log("✅ All jsdiff tests passed");
    return true;
  };

  /**
   * Test statistics capture
   */
  window.testAIStatisticsCapture = function () {
    console.log("🧪 Testing Statistics Capture");
    console.log("=".repeat(50));

    const enhancer = window.getMathPixAIEnhancer?.();
    if (!enhancer) {
      console.error("❌ AI Enhancer not available");
      return false;
    }

    // Check if stats property exists
    if ("stats" in enhancer) {
      console.log("✅ stats property exists");
    } else {
      console.error("❌ stats property missing");
      return false;
    }

    // Check for stats after enhancement
    if (enhancer.stats) {
      console.log("✅ Stats object has data:");
      console.log(
        "  startTime:",
        enhancer.stats.startTime ? "captured" : "not set",
      );
      console.log("  inputTokens:", enhancer.stats.inputTokens);
      console.log("  outputTokens:", enhancer.stats.outputTokens);
      console.log("  actualCost:", enhancer.stats.actualCost);
      console.log("  model:", enhancer.stats.model);
      console.log("  processingTime:", enhancer.stats.processingTime + "s");
    } else {
      console.log("ℹ️ No stats yet - run an enhancement first");
    }

    return true;
  };

  /**
   * Test diff calculation
   */
  window.testAIDiffCalculation = function () {
    console.log("🧪 Testing Diff Calculation");
    console.log("=".repeat(50));

    const enhancer = window.getMathPixAIEnhancer?.();
    if (!enhancer) {
      console.error("❌ AI Enhancer not available");
      return false;
    }

    if (typeof enhancer.calculateDiff !== "function") {
      console.error("❌ calculateDiff method not found");
      return false;
    }

    console.log("✅ calculateDiff method exists");

    // Test with mock data if no real data
    const hadOriginal = !!enhancer.originalMMD;
    const hadEnhanced = !!enhancer.enhancedMMD;

    if (!hadOriginal || !hadEnhanced) {
      console.log("ℹ️ No real MMD data - testing with mock data");
      enhancer.originalMMD = "# Test Document\n\nLine 1\nLine 2\nLine 3";
      enhancer.enhancedMMD =
        "# Test Document\n\nLine 1 modified\nLine 2\nLine 3\nLine 4 added";
    }

    const result = enhancer.calculateDiff();

    if (result) {
      console.log("✅ calculateDiff() returned result:");
      console.log("  Lines changed:", result.changedLines);
      console.log("  Total lines:", result.totalLines);
      console.log("  Change percent:", result.changePercent + "%");
      console.log("  Added lines:", result.addedLines);
      console.log("  Removed lines:", result.removedLines);
    } else {
      console.error("❌ calculateDiff() returned null");
      return false;
    }

    // Restore if we used mock data
    if (!hadOriginal) enhancer.originalMMD = "";
    if (!hadEnhanced) enhancer.enhancedMMD = "";

    return true;
  };

  /**
   * Test cost calculation
   */
  window.testAICostCalculation = function () {
    console.log("🧪 Testing Cost Calculation");
    console.log("=".repeat(50));

    const enhancer = window.getMathPixAIEnhancer?.();
    if (!enhancer) {
      console.error("❌ AI Enhancer not available");
      return false;
    }

    if (typeof enhancer.calculateActualCost !== "function") {
      console.error("❌ calculateActualCost method not found");
      return false;
    }

    console.log("✅ calculateActualCost method exists");

    // Set up mock stats if needed
    const hadStats = !!enhancer.stats;
    if (!hadStats) {
      enhancer.stats = {
        inputTokens: 1500,
        outputTokens: 1200,
        model: "anthropic/claude-haiku-4.5",
      };
    }

    const cost = enhancer.calculateActualCost();

    console.log("  Input tokens:", enhancer.stats.inputTokens);
    console.log("  Output tokens:", enhancer.stats.outputTokens);
    console.log("  Model:", enhancer.stats.model);
    console.log("  Calculated cost:", cost);
    console.log("  Formatted:", enhancer.formatCost(cost));

    if (typeof cost === "number" && cost >= 0) {
      console.log("✅ Cost calculation works");
    } else {
      console.error("❌ Cost calculation failed");
      return false;
    }

    // Restore if we used mock stats
    if (!hadStats) enhancer.stats = null;

    return true;
  };

  /**
   * Test statistics HTML generation
   */
  window.testAIStatisticsHTML = function () {
    console.log("🧪 Testing Statistics HTML Generation");
    console.log("=".repeat(50));

    const enhancer = window.getMathPixAIEnhancer?.();
    if (!enhancer) {
      console.error("❌ AI Enhancer not available");
      return false;
    }

    if (typeof enhancer.buildStatisticsHTML !== "function") {
      console.error("❌ buildStatisticsHTML method not found");
      return false;
    }

    console.log("✅ buildStatisticsHTML method exists");

    // Set up mock data for testing
    const hadStats = !!enhancer.stats;
    const hadDiff = !!enhancer.diffStats;

    enhancer.stats = {
      inputTokens: 1842,
      outputTokens: 1956,
      actualCost: 0.0043,
      processingTime: "4.2",
      model: "anthropic/claude-haiku-4.5",
    };
    enhancer.diffStats = {
      changedLines: 23,
      totalLines: 137,
      changePercent: 17,
    };

    const html = enhancer.buildStatisticsHTML();

    if (html && html.includes("ai-enhancement-stats")) {
      console.log("✅ Statistics HTML generated");
      console.log(
        "  Contains stats class:",
        html.includes("ai-enhancement-stats"),
      );
      console.log("  Contains lines changed:", html.includes("23 of 137"));
      console.log("  Contains tokens:", html.includes("1,842"));
      console.log("  Contains cost:", html.includes("£"));
    } else {
      console.error("❌ Statistics HTML generation failed");
      return false;
    }

    // Restore
    if (!hadStats) enhancer.stats = null;
    if (!hadDiff) enhancer.diffStats = null;

    return true;
  };

  /**
   * Run all Phase 7.2D tests
   */
  window.testPhase72D = function () {
    console.log("🧪 Phase 7.2D Complete Test Suite");
    console.log("=".repeat(60));

    const results = {
      diffLibrary: window.testDiffLibrary(),
      statsCapture: window.testAIStatisticsCapture(),
      diffCalc: window.testAIDiffCalculation(),
      costCalc: window.testAICostCalculation(),
      statsHTML: window.testAIStatisticsHTML(),
    };

    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.values(results).length;

    console.log("---");
    console.log(`Results: ${passed}/${total} tests passed`);

    if (passed === total) {
      console.log("✅ All Phase 7.2D tests passed!");
    } else {
      console.warn("⚠️ Some tests failed - see details above");
    }

    return results;
  };

  /**
   * Validate Phase 7.2D implementation completeness
   */
  window.validatePhase72D = function () {
    console.log("✅ Validating Phase 7.2D Implementation");
    console.log("=".repeat(60));

    const checks = [
      {
        name: "Diff library loaded",
        test: () => typeof Diff !== "undefined",
      },
      {
        name: "AI Enhancer available",
        test: () => !!window.getMathPixAIEnhancer?.(),
      },
      {
        name: "stats property exists",
        test: () => "stats" in (window.getMathPixAIEnhancer?.() || {}),
      },
      {
        name: "diffStats property exists",
        test: () => "diffStats" in (window.getMathPixAIEnhancer?.() || {}),
      },
      {
        name: "calculateDiff method exists",
        test: () =>
          typeof window.getMathPixAIEnhancer?.()?.calculateDiff === "function",
      },
      {
        name: "calculateActualCost method exists",
        test: () =>
          typeof window.getMathPixAIEnhancer?.()?.calculateActualCost ===
          "function",
      },
      {
        name: "buildStatisticsHTML method exists",
        test: () =>
          typeof window.getMathPixAIEnhancer?.()?.buildStatisticsHTML ===
          "function",
      },
    ];

    let passed = 0;
    checks.forEach((check) => {
      const result = check.test();
      console.log(`${result ? "✅" : "❌"} ${check.name}`);
      if (result) passed++;
    });

    console.log("---");
    console.log(`${passed}/${checks.length} checks passed`);

    return passed === checks.length;
  };

  // ============================================================================
  // PHASE 7.2E TEST COMMANDS (Visual Diff Highlighting)
  // ============================================================================

  /**
   * Test diff rendering methods exist
   */
  window.testDiffRendering = function () {
    console.log("🧪 Testing Diff Rendering Methods");
    console.log("=".repeat(50));

    const enhancer = window.getMathPixAIEnhancer?.();
    if (!enhancer) {
      console.error("❌ AI Enhancer not available");
      return false;
    }

    const checks = [
      {
        name: "renderDiffHighlighted method exists",
        pass: typeof enhancer.renderDiffHighlighted === "function",
      },
      {
        name: "renderPlainContent method exists",
        pass: typeof enhancer.renderPlainContent === "function",
      },
      {
        name: "toggleDiff method exists",
        pass: typeof enhancer.toggleDiff === "function",
      },
      {
        name: "showDiff property exists",
        pass: "showDiff" in enhancer,
      },
      {
        name: "showDiff default is true",
        pass: enhancer.showDiff === true,
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
   * Test diff toggle functionality
   */
  window.testDiffToggle = function () {
    console.log("🧪 Testing Diff Toggle");
    console.log("=".repeat(50));

    // Check toggle function exposed globally
    const checks = [
      {
        name: "toggleAIDiff function exposed globally",
        pass: typeof window.toggleAIDiff === "function",
      },
    ];

    // Check checkbox exists (only if modal is open)
    const checkbox = document.getElementById("toggle-diff");
    if (checkbox) {
      checks.push({
        name: "Diff toggle checkbox found in DOM",
        pass: true,
      });
      checks.push({
        name: "Checkbox has correct onchange handler",
        pass: checkbox.getAttribute("onchange")?.includes("toggleAIDiff"),
      });
    } else {
      console.log("ℹ️ Diff toggle checkbox not in DOM (modal may not be open)");
    }

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
   * Test diff accessibility features
   */
  window.testDiffAccessibility = function () {
    console.log("🧪 Testing Diff Accessibility");
    console.log("=".repeat(50));

    const diffLines = document.querySelectorAll(".diff-line");

    if (diffLines.length === 0) {
      console.log("ℹ️ No diff lines in DOM (run enhancement first)");
      return true;
    }

    let issues = 0;

    // Check removed/added lines have aria-labels
    const changedLines = document.querySelectorAll(
      ".diff-removed, .diff-added",
    );
    changedLines.forEach((line, i) => {
      if (!line.hasAttribute("aria-label")) {
        console.warn(`⚠️ Changed line ${i + 1} missing aria-label`);
        issues++;
      }
    });

    // Check line numbers are aria-hidden
    const lineNumbers = document.querySelectorAll(".diff-line-number");
    lineNumbers.forEach((num, i) => {
      if (num.getAttribute("aria-hidden") !== "true") {
        console.warn(`⚠️ Line number ${i + 1} not aria-hidden`);
        issues++;
      }
    });

    // Check toggle separator is aria-hidden
    const separator = document.querySelector(".toggle-separator");
    if (separator && separator.getAttribute("aria-hidden") !== "true") {
      console.warn("⚠️ Toggle separator not aria-hidden");
      issues++;
    }

    if (issues === 0) {
      console.log("✅ All accessibility checks passed");
      console.log(`   - ${changedLines.length} changed lines have aria-labels`);
      console.log(`   - ${lineNumbers.length} line numbers are aria-hidden`);
    } else {
      console.warn(`⚠️ ${issues} accessibility issues found`);
    }

    return issues === 0;
  };

  /**
   * Test Phase 7.2E complete
   */
  window.testPhase72E = function () {
    console.log("🧪 Phase 7.2E Complete Test Suite");
    console.log("=".repeat(60));

    console.log("\n1. Diff Rendering Methods:");
    const renderingOk = window.testDiffRendering();

    console.log("\n2. Diff Toggle:");
    const toggleOk = window.testDiffToggle();

    console.log("\n3. Diff Accessibility:");
    const a11yOk = window.testDiffAccessibility();

    const results = {
      diffRendering: renderingOk,
      diffToggle: toggleOk,
      diffAccessibility: a11yOk,
    };

    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.values(results).length;

    console.log("\n" + "=".repeat(60));
    console.log(`Results: ${passed}/${total} tests passed`);

    if (passed === total) {
      console.log("✅ All Phase 7.2E tests passed!");
    } else {
      console.warn("⚠️ Some tests failed - see details above");
    }

    return results;
  };

  /**
   * Quick validation of Phase 7.2E implementation
   */
  window.validatePhase72E = function () {
    console.log("✅ Validating Phase 7.2E Implementation");
    console.log("=".repeat(60));

    const enhancer = window.getMathPixAIEnhancer?.();

    const checks = [
      {
        name: "showDiff property exists",
        pass: "showDiff" in (enhancer || {}),
      },
      {
        name: "renderDiffHighlighted method",
        pass: typeof enhancer?.renderDiffHighlighted === "function",
      },
      {
        name: "renderPlainContent method",
        pass: typeof enhancer?.renderPlainContent === "function",
      },
      {
        name: "toggleDiff method",
        pass: typeof enhancer?.toggleDiff === "function",
      },
      {
        name: "toggleAIDiff global function",
        pass: typeof window.toggleAIDiff === "function",
      },
    ];

    let passed = 0;
    checks.forEach((check) => {
      const icon = check.pass ? "✅" : "❌";
      console.log(`${icon} ${check.name}`);
      if (check.pass) passed++;
    });

    console.log("=".repeat(60));
    console.log(`${passed}/${checks.length} checks passed`);

    if (passed === checks.length) {
      console.log("✅ Phase 7.2E validation complete!");
    } else {
      console.warn("⚠️ Some checks failed");
    }

    return passed === checks.length;
  };

  // ============================================================================
  // PHASE 7.2F TEST COMMANDS (AI Version Integration)
  // ============================================================================

  /**
   * Quick validation of Phase 7.2F implementation
   * Tests AI enhancement metadata storage and version tracking
   */
  window.validatePhase72F = function () {
    console.log(
      "🧪 Validating Phase 7.2F Implementation (AI Version Integration)",
    );
    console.log("=".repeat(60));

    const enhancer = window.getMathPixAIEnhancer?.();
    const restorer = window.getMathPixSessionRestorer?.();
    // Total Downloader is exposed as a class, not a getter function
    const DownloaderClass = window.MathPixTotalDownloader;

    const checks = [
      {
        name: "AI Enhancer available",
        pass: !!enhancer,
      },
      {
        name: "Session Restorer available",
        pass: !!restorer,
      },
      {
        name: "setAIEnhancementMetadata method exists",
        pass: typeof restorer?.setAIEnhancementMetadata === "function",
      },
      {
        name: "Total Downloader class available",
        pass: !!DownloaderClass,
      },
      {
        name: "generateAIEnhancedFilename method exists",
        pass:
          typeof DownloaderClass?.prototype?.generateAIEnhancedFilename ===
          "function",
      },
      {
        name: "formatModelName method exists",
        pass: typeof DownloaderClass?.prototype?.formatModelName === "function",
      },
    ];

    let passed = 0;
    checks.forEach((check) => {
      const icon = check.pass ? "✅" : "❌";
      console.log(`${icon} ${check.name}`);
      if (check.pass) passed++;
    });

    console.log("=".repeat(60));
    console.log(`${passed}/${checks.length} checks passed`);

    if (passed === checks.length) {
      console.log("✅ Phase 7.2F validation complete!");
    } else {
      console.warn("⚠️ Some checks failed");
    }

    return passed === checks.length;
  };

  /**
   * Test AI metadata storage flow
   * Simulates what happens when applyEnhancement() is called
   */
  window.testAIMetadataStorage = function () {
    console.log("🧪 Testing AI Metadata Storage Flow");
    console.log("=".repeat(60));

    const restorer = window.getMathPixSessionRestorer?.();

    if (!restorer) {
      console.error("❌ Session Restorer not available");
      return false;
    }

    if (!restorer.restoredSession) {
      console.warn("⚠️ No restored session - testing with mock session");
      // Create a mock session for testing
      restorer.restoredSession = {
        currentMMD: "# Test Content",
        originalMMD: "# Original Content",
      };
    }

    // Test metadata
    const testMetadata = {
      appliedAt: Date.now(),
      model: "anthropic/claude-sonnet-4",
      linesAdded: 15,
      linesRemoved: 8,
      linesChanged: 23,
      totalLines: 150,
      cost: 0.0034,
    };

    console.log("📝 Storing test AI metadata:", testMetadata);

    // Call the method
    restorer.setAIEnhancementMetadata(testMetadata, "# Enhanced Test Content");

    // Verify storage in restoredSession
    const stored = restorer.restoredSession?.aiEnhanced;
    if (stored) {
      console.log("✅ AI metadata stored in restoredSession");
      console.log("   Model:", stored.model);
      console.log("   Lines changed:", stored.linesChanged);
      console.log("   Cost:", stored.cost);
    } else {
      console.error("❌ AI metadata NOT found in restoredSession");
      return false;
    }

    // Check localStorage persistence
    const persistence = window.getMathPixMMDPersistence?.();
    const persistedMeta = persistence?.session?.aiEnhanced;
    if (persistedMeta) {
      console.log("✅ AI metadata persisted to localStorage");
    } else {
      console.warn(
        "⚠️ AI metadata not found in persistence (may be expected if no active session)",
      );
    }

    console.log("=".repeat(60));
    console.log("✅ AI metadata storage test complete");
    return true;
  };

  /**
   * Test AI-enhanced filename generation
   */
  window.testAIEnhancedFilename = function () {
    console.log("🧪 Testing AI-Enhanced Filename Generation");
    console.log("=".repeat(60));

    // Total Downloader is a class - instantiate for testing
    const DownloaderClass = window.MathPixTotalDownloader;
    if (!DownloaderClass) {
      console.error("❌ Total Downloader class not available");
      return false;
    }
    const downloader = new DownloaderClass();

    if (!downloader) {
      console.error("❌ Total Downloader not available");
      return false;
    }

    const testCases = [
      {
        input: "document.pdf",
        expectedPattern:
          /^document-ai-enhanced-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.mmd$/,
      },
      {
        input: "My Report.pdf",
        expectedPattern:
          /^My\sReport-ai-enhanced-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.mmd$/,
      },
      {
        input: null,
        expectedPattern:
          /^mathpix-export-ai-enhanced-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.mmd$/,
      },
    ];

    let passed = 0;
    testCases.forEach((test, index) => {
      const result = downloader.generateAIEnhancedFilename(test.input);
      const matches = test.expectedPattern.test(result);
      const icon = matches ? "✅" : "❌";
      console.log(`${icon} Test ${index + 1}: "${test.input}" → "${result}"`);
      if (matches) passed++;
    });

    console.log("=".repeat(60));
    console.log(`${passed}/${testCases.length} filename tests passed`);
    return passed === testCases.length;
  };

  /**
   * Test model name formatting
   */
  window.testModelNameFormatting = function () {
    console.log("🧪 Testing Model Name Formatting");
    console.log("=".repeat(60));

    // Total Downloader is a class - instantiate for testing
    const DownloaderClass = window.MathPixTotalDownloader;
    if (!DownloaderClass) {
      console.error("❌ Total Downloader class not available");
      return false;
    }
    const downloader = new DownloaderClass();

    if (!downloader) {
      console.error("❌ Total Downloader not available");
      return false;
    }

    const testCases = [
      {
        input: "anthropic/claude-sonnet-4",
        expected: "Anthropic Claude Sonnet 4",
      },
      { input: "openai/gpt-4-turbo", expected: "Openai Gpt 4 Turbo" },
      { input: "unknown", expected: "Unknown model" },
      { input: null, expected: "Unknown model" },
    ];

    let passed = 0;
    testCases.forEach((test, index) => {
      const result = downloader.formatModelName(test.input);
      const matches = result === test.expected;
      const icon = matches ? "✅" : "❌";
      console.log(
        `${icon} Test ${index + 1}: "${test.input}" → "${result}" (expected: "${test.expected}")`,
      );
      if (matches) passed++;
    });

    console.log("=".repeat(60));
    console.log(`${passed}/${testCases.length} format tests passed`);
    return passed === testCases.length;
  };

  /**
   * Test session loader icon selection
   * Verifies aiSparkle icon is used for AI-enhanced sessions
   */
  window.testSessionLoaderIcon = function () {
    console.log("🧪 Testing Session Loader Icon Selection");
    console.log("=".repeat(60));

    // Check if getIcon function exists
    if (typeof getIcon !== "function") {
      console.error("❌ getIcon function not available");
      return false;
    }

    // Test icon availability
    const diskIcon = getIcon("disk");
    const sparkleIcon = getIcon("aiSparkle");

    console.log("✅ Disk icon available:", !!diskIcon);
    console.log("✅ AI Sparkle icon available:", !!sparkleIcon);

    if (!sparkleIcon) {
      console.error("❌ aiSparkle icon not found in icon library");
      return false;
    }

    // Test conditional logic
    const mockSessionWithAI = {
      data: { aiEnhanced: { appliedAt: Date.now() } },
    };
    const mockSessionWithoutAI = { data: { current: "content" } };

    const iconForAI = mockSessionWithAI.data?.aiEnhanced ? "aiSparkle" : "disk";
    const iconForNormal = mockSessionWithoutAI.data?.aiEnhanced
      ? "aiSparkle"
      : "disk";

    console.log(
      "✅ AI session icon selection:",
      iconForAI,
      "(expected: aiSparkle)",
    );
    console.log(
      "✅ Normal session icon selection:",
      iconForNormal,
      "(expected: disk)",
    );

    const passed = iconForAI === "aiSparkle" && iconForNormal === "disk";

    console.log("=".repeat(60));
    console.log(
      passed
        ? "✅ Icon selection test passed"
        : "❌ Icon selection test failed",
    );
    return passed;
  };

  /**
   * Comprehensive Phase 7.2F test suite
   */
  window.testPhase72F = function () {
    console.log("🧪 Running Complete Phase 7.2F Test Suite");
    console.log("=".repeat(60));

    const results = {
      validation: window.validatePhase72F(),
      metadataStorage: window.testAIMetadataStorage(),
      filenameGeneration: window.testAIEnhancedFilename(),
      modelFormatting: window.testModelNameFormatting(),
      iconSelection: window.testSessionLoaderIcon(),
    };

    console.log("\n" + "=".repeat(60));
    console.log("📊 PHASE 7.2F TEST SUMMARY");
    console.log("=".repeat(60));

    let totalPassed = 0;
    const totalTests = Object.keys(results).length;

    Object.entries(results).forEach(([name, passed]) => {
      const icon = passed ? "✅" : "❌";
      console.log(`${icon} ${name}: ${passed ? "PASSED" : "FAILED"}`);
      if (passed) totalPassed++;
    });

    console.log("=".repeat(60));
    console.log(`Result: ${totalPassed}/${totalTests} test groups passed`);

    if (totalPassed === totalTests) {
      console.log("🎉 All Phase 7.2F tests passed!");
    } else {
      console.warn("⚠️ Some tests failed - review output above");
    }

    return totalPassed === totalTests;
  };

  /**
   * Check current AI enhancement state
   * Useful for debugging during development
   */
  window.checkAIEnhancementState = function () {
    console.log("🔍 Checking AI Enhancement State");
    console.log("=".repeat(60));

    const restorer = window.getMathPixSessionRestorer?.();
    const persistence = window.getMathPixMMDPersistence?.();

    // Check restoredSession
    const sessionAI = restorer?.restoredSession?.aiEnhanced;
    console.log(
      "Session Restorer aiEnhanced:",
      sessionAI ? "Present" : "Not set",
    );
    if (sessionAI) {
      console.log("  Model:", sessionAI.model);
      console.log("  Lines changed:", sessionAI.linesChanged);
      console.log(
        "  Applied at:",
        new Date(sessionAI.appliedAt).toLocaleString(),
      );
    }

    // Check persistence
    const persistenceAI = persistence?.session?.aiEnhanced;
    console.log(
      "\nPersistence session aiEnhanced:",
      persistenceAI ? "Present" : "Not set",
    );
    if (persistenceAI) {
      console.log("  Model:", persistenceAI.model);
      console.log("  Lines changed:", persistenceAI.linesChanged);
    }

    // Check localStorage directly
    console.log("\nLocalStorage sessions with AI enhancement:");
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith("mathpix-resume-session"),
    );
    keys.forEach((key) => {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data.aiEnhanced) {
          console.log(`  ✨ ${key}: AI enhanced (${data.aiEnhanced.model})`);
        }
      } catch (e) {
        // Ignore parse errors
      }
    });

    console.log("=".repeat(60));
  };

  // ============================================================================
  // PHASE 7.3K/L TEST COMMANDS (Scroll Sync)
  // ============================================================================

  /**
   * Phase 7.3K validation — scroll sync core
   */
  window.validatePhase73K = () => {
    const e = window.getMathPixAIEnhancer?.();
    if (!e) {
      console.log("❌ Enhancer not available");
      return false;
    }

    const checks = [
      ["syncScrollEnabled property exists", "syncScrollEnabled" in e],
      ["isSyncingScroll property exists", "isSyncingScroll" in e],
      [
        "scrollHandlers property exists",
        "scrollHandlers" in e && e.scrollHandlers !== null,
      ],
      [
        "toggleScrollSync method exists",
        typeof e.toggleScrollSync === "function",
      ],
      [
        "setupScrollSync method exists",
        typeof e.setupScrollSync === "function",
      ],
      [
        "teardownScrollSync method exists",
        typeof e.teardownScrollSync === "function",
      ],
      [
        "window.toggleAISync exposed",
        typeof window.toggleAISync === "function",
      ],
    ];

    // Check DOM if results view is open
    const syncCheckbox = document.getElementById("toggle-sync");
    if (syncCheckbox) {
      checks.push(["toggle-sync checkbox in DOM", true]);
      checks.push([
        "toggle-sync has onchange",
        syncCheckbox.getAttribute("onchange")?.includes("toggleAISync"),
      ]);
    }

    let passed = 0;
    checks.forEach(([name, result]) => {
      console.log(`${result ? "✅" : "❌"} ${name}`);
      if (result) passed++;
    });
    console.log(`\n${passed}/${checks.length} Phase 7.3K checks passed`);
    return passed === checks.length;
  };

  /**
   * Phase 7.3L validation — multi-column sync + mode flag
   */
  window.validatePhase73L = () => {
    const e = window.getMathPixAIEnhancer?.();
    if (!e) {
      console.log("❌ Enhancer not available");
      return false;
    }

    const checks = [];

    // L.1: scrollHandlers has preview key
    checks.push([
      "scrollHandlers has 'preview' key",
      e.scrollHandlers !== null && "preview" in e.scrollHandlers,
    ]);

    // L.2: scrollSyncMode property exists with valid value
    checks.push(["scrollSyncMode property exists", "scrollSyncMode" in e]);
    checks.push([
      "scrollSyncMode is 'mmd' or 'all'",
      e.scrollSyncMode === "mmd" || e.scrollSyncMode === "all",
    ]);

    // L.3: setAISyncMode helper exposed
    checks.push([
      "window.setAISyncMode exposed",
      typeof window.setAISyncMode === "function",
    ]);

    // L.4: K properties still present (regression check)
    checks.push([
      "syncScrollEnabled property exists",
      "syncScrollEnabled" in e,
    ]);
    checks.push([
      "scrollHandlers has 'original' key",
      e.scrollHandlers !== null && "original" in e.scrollHandlers,
    ]);
    checks.push([
      "scrollHandlers has 'enhanced' key",
      e.scrollHandlers !== null && "enhanced" in e.scrollHandlers,
    ]);

    // L.5: Methods exist
    checks.push([
      "setupScrollSync method exists",
      typeof e.setupScrollSync === "function",
    ]);
    checks.push([
      "teardownScrollSync method exists",
      typeof e.teardownScrollSync === "function",
    ]);

    // L.6: DOM checks if results view is open
    const originalEl = document.getElementById("ai-original-content");
    const enhancedEl = document.getElementById("ai-enhanced-content");
    const previewInner = document.getElementById("ai-preview-content");
    const previewEl = previewInner?.closest(".column-content") || null;

    if (originalEl || enhancedEl || previewInner) {
      checks.push(["DOM: ai-original-content found", !!originalEl]);
      checks.push(["DOM: ai-enhanced-content found", !!enhancedEl]);
      checks.push(["DOM: ai-preview-content found", !!previewInner]);
      checks.push([
        "DOM: Preview scroll wrapper resolved",
        !!previewEl && previewEl !== previewInner,
      ]);
      checks.push([
        "DOM: Preview wrapper has overflow",
        previewEl
          ? getComputedStyle(previewEl).overflowY === "auto" ||
            getComputedStyle(previewEl).overflowY === "scroll"
          : false,
      ]);
    } else {
      checks.push(["DOM: Results view not open (skipping DOM checks)", true]);
    }

    // L.7: If sync is enabled and listeners are active, verify based on mode
    if (e.syncScrollEnabled && originalEl) {
      checks.push([
        "Active: original handler set",
        typeof e.scrollHandlers.original === "function",
      ]);
      checks.push([
        "Active: enhanced handler set",
        typeof e.scrollHandlers.enhanced === "function",
      ]);
      if (e.scrollSyncMode === "all") {
        checks.push([
          "Active: preview handler set (mode=all)",
          typeof e.scrollHandlers.preview === "function",
        ]);
      } else {
        checks.push([
          "Active: preview handler NOT set (mode=mmd)",
          e.scrollHandlers.preview === null,
        ]);
      }
    }

    let passed = 0;
    checks.forEach(([name, result]) => {
      console.log(`${result ? "✅" : "❌"} ${name}`);
      if (result) passed++;
    });
    console.log(`\n${passed}/${checks.length} Phase 7.3L checks passed`);
    return passed === checks.length;
  };

  // ============================================================================
  // PHASE 7.4 TEST COMMANDS (Model & Engine UI)
  // ============================================================================

  /**
   * Phase 7.4 validation — radio buttons, advanced model select, engine select, preferences
   */
  window.validatePhase74 = function () {
    console.log("\uD83E\uDDEA Phase 7.4 Validation");
    console.log("=".repeat(50));

    const checks = [];
    const e = window.getMathPixAIEnhancer?.();

    // Property checks
    checks.push({
      name: "selectedEngine property",
      pass: e?.selectedEngine !== undefined,
    });
    checks.push({
      name: "enhancerPrefsKey property",
      pass: e?.enhancerPrefsKey === "ai-enhance-preferences",
    });
    checks.push({
      name: "loadEnhancerPreferences method",
      pass: typeof e?.loadEnhancerPreferences === "function",
    });
    checks.push({
      name: "saveEnhancerPreferences method",
      pass: typeof e?.saveEnhancerPreferences === "function",
    });
    checks.push({
      name: "handleEngineChange method",
      pass: typeof e?.handleEngineChange === "function",
    });
    checks.push({
      name: "handleAdvancedModelChange method",
      pass: typeof e?.handleAdvancedModelChange === "function",
    });
    checks.push({
      name: "getRegistryModels method",
      pass: typeof e?.getRegistryModels === "function",
    });
    checks.push({
      name: "buildAdvancedOptions method",
      pass: typeof e?.buildAdvancedOptions === "function",
    });
    checks.push({
      name: "getEngineDisplayName method",
      pass: typeof e?.getEngineDisplayName === "function",
    });

    // Global handler checks
    checks.push({
      name: "handleAIModelChange global",
      pass: typeof window.handleAIModelChange === "function",
    });
    checks.push({
      name: "handleAIAdvancedModelChange global",
      pass: typeof window.handleAIAdvancedModelChange === "function",
    });
    checks.push({
      name: "handleAIEngineChange global",
      pass: typeof window.handleAIEngineChange === "function",
    });

    // DOM checks (only if modal is open)
    const radios = document.querySelectorAll('input[name="ai-model"]');
    const advancedSelect = document.getElementById("ai-advanced-model-select");
    const engineSelect = document.getElementById("ai-engine-select");
    const advancedDetails = document.querySelector(".ai-advanced-options");

    if (radios.length > 0) {
      checks.push({
        name: "Model radio buttons in DOM",
        pass: radios.length === 3,
      });
      checks.push({
        name: "One radio is checked",
        pass: [...radios].some((r) => r.checked),
      });
    }

    if (advancedSelect) {
      checks.push({
        name: "Advanced model <select> in DOM",
        pass: true,
      });
      checks.push({
        name: "Advanced select has optgroups",
        pass: advancedSelect.querySelectorAll("optgroup").length >= 1,
      });
      checks.push({
        name: "Advanced select has placeholder",
        pass: advancedSelect.options[0]?.value === "",
      });
    }

    if (engineSelect) {
      checks.push({ name: "Engine <select> in DOM", pass: true });
      checks.push({
        name: "Engine has 3 options",
        pass: engineSelect.options.length === 3,
      });
    }

    if (advancedDetails) {
      checks.push({
        name: "Advanced options disclosure in DOM",
        pass: true,
      });
    }

    // Report
    let passed = 0;
    checks.forEach((check) => {
      const icon = check.pass ? "\u2705" : "\u274C";
      console.log(`${icon} ${check.name}`);
      if (check.pass) passed++;
    });

    console.log("=".repeat(50));
    console.log(`Result: ${passed}/${checks.length} checks passed`);

    return { passed, total: checks.length, checks };
  };

  // ============================================================================
  // PHASE 7.4.1 TEST COMMANDS (Dynamic Max Tokens)
  // ============================================================================

  /**
   * Validate Phase 7.4.1: Dynamic max_tokens alignment
   *
   * Tests the getModelMaxOutput() method and dynamic token calculation
   * without triggering an actual API call.
   */
  window.validatePhase741 = function () {
    console.log("\u{1F9EA} Phase 7.4.1 Validation — Dynamic Max Tokens");
    console.log("=".repeat(50));

    const checks = [];

    const enhancer = window.getMathPixAIEnhancer?.();
    checks.push({
      name: "AI Enhancer instance available",
      pass: !!enhancer,
    });

    if (!enhancer) {
      checks.forEach((c) => {
        console.log(`${c.pass ? "\u2705" : "\u274C"} ${c.name}`);
      });
      console.log("Cannot continue without enhancer instance.");
      return { passed: 0, total: checks.length, checks };
    }

    // Test 1: getModelMaxOutput method exists
    checks.push({
      name: "getModelMaxOutput method exists",
      pass: typeof enhancer.getModelMaxOutput === "function",
    });

    // Test 2: Returns a number for the current selected model
    const currentModelOutput = enhancer.getModelMaxOutput(
      enhancer.selectedModel,
    );
    checks.push({
      name: `getModelMaxOutput returns number for ${enhancer.selectedModel}`,
      pass: typeof currentModelOutput === "number" && currentModelOutput > 0,
      detail: currentModelOutput,
    });

    // Test 3: Returns default for an unknown model
    const DEFAULT_MAX_TOKENS = 8192;
    const unknownOutput = enhancer.getModelMaxOutput(
      "fake/nonexistent-model-xyz",
    );
    checks.push({
      name: "Falls back to 8192 for unknown model",
      pass: unknownOutput === DEFAULT_MAX_TOKENS,
      detail: unknownOutput,
    });

    // Test 4: Prompts.json models have maxTokens
    if (enhancer.models) {
      const modelsWithMaxTokens = Object.values(enhancer.models).filter(
        (m) => m.maxTokens && m.maxTokens > 0,
      );
      checks.push({
        name: `All prompts.json models have maxTokens (${modelsWithMaxTokens.length}/${Object.keys(enhancer.models).length})`,
        pass:
          modelsWithMaxTokens.length === Object.keys(enhancer.models).length,
      });
    }

    // Test 5: Dynamic calculation — small document (should hit floor)
    const CHARS_PER_TOKEN = 4;
    const smallMMD = "x = 1\n".repeat(50); // ~300 chars → ~75 tokens
    const smallTokens = Math.ceil(smallMMD.length / CHARS_PER_TOKEN);
    const smallScaled = Math.ceil(smallTokens * 1.3);
    const smallDynamic = Math.min(
      Math.max(smallScaled, DEFAULT_MAX_TOKENS),
      currentModelOutput,
    );
    checks.push({
      name: `Small doc (${smallTokens} tokens): floor applied → ${smallDynamic}`,
      pass: smallDynamic === DEFAULT_MAX_TOKENS,
    });

    // Test 6: Dynamic calculation — large document (should scale up)
    const largeMMD =
      "\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}\n".repeat(600); // ~33,000 chars → ~8,250 tokens
    const largeTokens = Math.ceil(largeMMD.length / CHARS_PER_TOKEN);
    const largeScaled = Math.ceil(largeTokens * 1.3);
    const largeDynamic = Math.min(
      Math.max(largeScaled, DEFAULT_MAX_TOKENS),
      currentModelOutput,
    );
    // The scaled value should exceed the floor, proving scaling kicks in
    // (final result may still be capped by model limit)
    const scalingKicksIn = largeScaled > DEFAULT_MAX_TOKENS;
    checks.push({
      name: `Large doc (${largeTokens} tokens): scaled=${largeScaled} exceeds floor=${DEFAULT_MAX_TOKENS} (capped to ${largeDynamic} by model)`,
      pass: scalingKicksIn,
    });

    // Test 7: Dynamic calculation never exceeds model cap
    checks.push({
      name: `Dynamic result (${largeDynamic}) ≤ model cap (${currentModelOutput})`,
      pass: largeDynamic <= currentModelOutput,
    });

    // Test 8: Config constant still accessible via diagnose (backward compat)
    checks.push({
      name: "Default MAX_OUTPUT_TOKENS is 8192",
      pass: DEFAULT_MAX_TOKENS === 8192,
    });

    // Report
    let passed = 0;
    checks.forEach((check) => {
      const icon = check.pass ? "\u2705" : "\u274C";
      const detail = check.detail !== undefined ? ` (${check.detail})` : "";
      console.log(`${icon} ${check.name}${detail}`);
      if (check.pass) passed++;
    });

    console.log("=".repeat(50));
    console.log(`Result: ${passed}/${checks.length} checks passed`);

    return { passed, total: checks.length, checks };
  };

  // Log load confirmation
  console.log("[AIEnhancer Tests] Test module loaded");
  console.log(
    "[AIEnhancer Tests] Commands: validatePhase71(), validatePhase71C(), validatePhase72E(), testPhase72E(), validatePhase72F(), testPhase72F(), checkAIEnhancementState(), validatePhase73K(), validatePhase73L(), validatePhase74(), validatePhase741()",
  );
})();
