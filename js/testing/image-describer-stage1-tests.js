/**
 * Image Describer - Stage 1 Tests
 * Tests HTML structure, form population, and accessibility
 * Version: 1.0.0
 * Date: 24 November 2025
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

  // ============================================================================
  // STAGE 1 TESTS - HTML STRUCTURE AND FORM POPULATION
  // ============================================================================

  /**
   * Stage 1 Tests - HTML Structure and Form Population
   * Run with: window.testImageDescriber_Stage1()
   */
  function testImageDescriber_Stage1() {
    console.log("\n🧪 IMAGE DESCRIBER - STAGE 1 TESTS");
    console.log("===================================\n");

    const results = {};

    // S1-1: HTML structure exists
    const container = document.getElementById("image-describe-app");
    results.htmlExists = !!container;
    console.log(
      `${results.htmlExists ? "✅" : "❌"} S1-1: HTML structure exists`
    );

    // S1-2: Key elements present (using imgdesc- prefix)
    const elements = [
      "imgdesc-file-input",
      "imgdesc-preview",
      "imgdesc-subject",
      "imgdesc-topic",
      "imgdesc-objective",
      "imgdesc-context",
      "imgdesc-audience",
      "imgdesc-generate",
      "imgdesc-output",
      "imgdesc-copy",
    ];

    const missingElements = elements.filter(
      (id) => !document.getElementById(id)
    );
    results.elementsPresent = missingElements.length === 0;
    console.log(
      `${results.elementsPresent ? "✅" : "❌"} S1-2: All key elements present`
    );
    if (missingElements.length > 0) {
      console.log("   Missing:", missingElements.join(", "));
    }

    // S1-3: File input has correct accept attribute
    const fileInput = document.getElementById("imgdesc-file-input");
    results.acceptAttribute =
      fileInput?.accept === "image/jpeg,image/png,image/webp";
    console.log(
      `${
        results.acceptAttribute ? "✅" : "❌"
      } S1-3: File input accepts correct types`
    );

    // S1-4: Generate button is disabled
    const generateBtn = document.getElementById("imgdesc-generate");
    results.buttonDisabled = generateBtn?.disabled === true;
    console.log(
      `${
        results.buttonDisabled ? "✅" : "❌"
      } S1-4: Generate button initially disabled`
    );

    // S1-5: Style radio buttons populated
    const styleOptions = document.getElementById("imgdesc-style-options");
    const styleRadios =
      styleOptions?.querySelectorAll('input[type="radio"]') || [];
    results.styleRadios = styleRadios.length >= 3;
    console.log(
      `${
        results.styleRadios ? "✅" : "❌"
      } S1-5: Style radio buttons populated (${styleRadios.length}/3)`
    );

    // S1-6: Audience options populated
    const audienceSelect = document.getElementById("imgdesc-audience");
    const audienceOptions = audienceSelect?.querySelectorAll("option") || [];
    results.audienceOptions = audienceOptions.length >= 7;
    console.log(
      `${
        results.audienceOptions ? "✅" : "❌"
      } S1-6: Audience options populated (${audienceOptions.length}/7)`
    );

    // S1-7: Checkbox options populated
    const checkboxContainer = document.getElementById(
      "imgdesc-checkbox-options"
    );
    const checkboxes =
      checkboxContainer?.querySelectorAll('input[type="checkbox"]') || [];
    results.checkboxOptions = checkboxes.length >= 5;
    console.log(
      `${
        results.checkboxOptions ? "✅" : "❌"
      } S1-7: Checkbox options populated (${checkboxes.length}/5)`
    );

    // Summary
    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;

    console.log(`\n${"═".repeat(40)}`);
    console.log(`Stage 1 Results: ${passed}/${total} tests passed`);
    console.log("═".repeat(40));

    if (passed === total) {
      console.log("✅ 🎉 STAGE 1 COMPLETE!\n");
    } else {
      console.log("❌ Some tests failed. Review output above.\n");
    }

    return { success: passed === total, results };
  }

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================

  /**
   * Accessibility Tests for Stage 1
   * Run with: window.testImageDescriber_Stage1_A11y()
   */
  function testImageDescriber_Stage1_A11y() {
    console.log("\n♿ IMAGE DESCRIBER - STAGE 1 ACCESSIBILITY TESTS");
    console.log("=================================================\n");

    const results = {};

    // A11y-1: All form inputs have associated labels
    const inputs = document.querySelectorAll(
      '#image-describe-app input:not([type="radio"]):not([type="checkbox"]), #image-describe-app textarea, #image-describe-app select'
    );
    const unlabelledInputs = [];

    inputs.forEach((input) => {
      const hasLabel = document.querySelector(`label[for="${input.id}"]`);
      const hasAriaLabel = input.getAttribute("aria-label");
      const hasAriaLabelledby = input.getAttribute("aria-labelledby");

      if (!hasLabel && !hasAriaLabel && !hasAriaLabelledby) {
        unlabelledInputs.push(input.id || input.name || "unnamed");
      }
    });

    results.labelsPresent = unlabelledInputs.length === 0;
    console.log(
      `${
        results.labelsPresent ? "✅" : "❌"
      } A11y-1: All form inputs have labels`
    );
    if (unlabelledInputs.length > 0) {
      console.log("   Unlabelled:", unlabelledInputs.join(", "));
    }

    // A11y-2: Radio group has proper ARIA
    const radioGroup = document.getElementById("imgdesc-style-options");
    const hasRadioRole = radioGroup?.getAttribute("role") === "radiogroup";
    const hasRadioLabel = radioGroup?.getAttribute("aria-labelledby");
    results.radioGroupA11y = hasRadioRole && hasRadioLabel;
    console.log(
      `${
        results.radioGroupA11y ? "✅" : "❌"
      } A11y-2: Radio group has proper ARIA (role="${radioGroup?.getAttribute(
        "role"
      )}", aria-labelledby="${hasRadioLabel}")`
    );

    // A11y-3: Live regions present
    const liveRegions = document.querySelectorAll(
      "#image-describe-app [aria-live]"
    );
    results.liveRegions = liveRegions.length >= 2;
    console.log(
      `${results.liveRegions ? "✅" : "❌"} A11y-3: Live regions present (${
        liveRegions.length
      }/2 minimum)`
    );

    // A11y-4: Icons are hidden from screen readers
    const icons = document.querySelectorAll(
      "#image-describe-app .imgdesc-upload-icon, #image-describe-app button span[aria-hidden]"
    );
    const visibleIcons = Array.from(icons).filter(
      (icon) => icon.getAttribute("aria-hidden") !== "true"
    );
    results.iconsHidden = visibleIcons.length === 0;
    console.log(
      `${
        results.iconsHidden ? "✅" : "❌"
      } A11y-4: Decorative icons hidden from screen readers`
    );

    // A11y-5: Buttons have visible text (not just icons)
    const buttons = document.querySelectorAll("#image-describe-app button");
    const iconOnlyButtons = [];

    buttons.forEach((btn) => {
      const textContent = btn.textContent.trim();
      // Remove hidden icon text to check for visible text
      const visibleText = textContent.replace(/[📷✕✨📋🔄]/g, "").trim();
      if (visibleText.length < 2) {
        iconOnlyButtons.push(btn.id || "unnamed");
      }
    });

    results.buttonsHaveText = iconOnlyButtons.length === 0;
    console.log(
      `${
        results.buttonsHaveText ? "✅" : "❌"
      } A11y-5: Buttons have visible text`
    );
    if (iconOnlyButtons.length > 0) {
      console.log("   Icon-only buttons:", iconOnlyButtons.join(", "));
    }

    // Summary
    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;

    console.log(`\n${"═".repeat(40)}`);
    console.log(`Accessibility Results: ${passed}/${total} tests passed`);
    console.log("═".repeat(40));

    return { success: passed === total, results };
  }

  // ============================================================================
  // COMBINED TEST RUNNER
  // ============================================================================

  /**
   * Run all Stage 1 tests
   * Run with: window.testImageDescriber_Stage1_All()
   */
  function testImageDescriber_Stage1_All() {
    const stage1 = testImageDescriber_Stage1();
    const a11y = testImageDescriber_Stage1_A11y();

    const allPassed = stage1.success && a11y.success;

    console.log("\n" + "═".repeat(50));
    console.log("COMBINED STAGE 1 RESULTS");
    console.log("═".repeat(50));
    console.log(`Structure Tests: ${stage1.success ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`Accessibility Tests: ${a11y.success ? "✅ PASS" : "❌ FAIL"}`);
    console.log("═".repeat(50));

    if (allPassed) {
      console.log("🎉 ALL STAGE 1 TESTS PASSED! Ready for Stage 2.\n");
    } else {
      console.log(
        "⚠️ Some tests failed. Please review and fix before proceeding.\n"
      );
    }

    return {
      success: allPassed,
      stage1: stage1.results,
      accessibility: a11y.results,
    };
  }

  // ============================================================================
  // GLOBAL EXPORTS
  // ============================================================================

  window.testImageDescriber_Stage1 = testImageDescriber_Stage1;
  window.testImageDescriber_Stage1_A11y = testImageDescriber_Stage1_A11y;
  window.testImageDescriber_Stage1_All = testImageDescriber_Stage1_All;
})();
