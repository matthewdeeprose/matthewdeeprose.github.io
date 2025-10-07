// test-enhanced-commands.js
// Enhanced Testing Commands Integration
// Unified interface for mathematical consistency + accessibility + comprehensive testing

const TestEnhancedCommands = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (IIFE SCOPE)
  // ===========================================================================================

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
      console.error("[ENHANCED-TEST]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[ENHANCED-TEST]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[ENHANCED-TEST]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[ENHANCED-TEST]", message, ...args);
  }

  // ===========================================================================================
  // ENHANCED TESTING COMMAND INTERFACES
  // ===========================================================================================

  /**
   * Session startup protocol - mandatory first steps
   */
  function sessionStartupProtocol() {
    console.log("\n" + "🚀 SESSION STARTUP PROTOCOL".padEnd(60, "="));
    console.log("Enhanced Pandoc-WASM Mathematical Playground");
    console.log("Comprehensive Testing & Accessibility Validation");
    console.log("=".repeat(60));

    console.log("\n📋 Step 1: Activating Phase 2B Enhancement...");
    let phase2bResult = null;
    if (window.LaTeXProcessor && window.LaTeXProcessor.runPhase2BEnhancement) {
      try {
        phase2bResult = window.LaTeXProcessor.runPhase2BEnhancement();
        console.log(
          `✅ Phase 2B Enhancement: ${phase2bResult.annotationCoveragePercent.toFixed(
            1
          )}% annotation coverage`
        );
      } catch (error) {
        console.log("❌ Phase 2B Enhancement failed:", error.message);
      }
    } else {
      console.log("⚠️ Phase 2B Enhancement not available");
    }

    console.log("\n📋 Step 2: System Health Check...");
    const health = window.testAllSafe
      ? window.testAllSafe()
      : { overallSuccess: false };
    console.log(
      `${health.overallSuccess ? "✅" : "❌"} System Health: ${
        health.overallSuccess ? "HEALTHY" : "NEEDS ATTENTION"
      }`
    );

    console.log("\n📋 Step 3: Mathematical Rendering Verification...");
    const containers = document.querySelectorAll("mjx-container");
    console.log(
      `${containers.length > 0 ? "✅" : "❌"} Mathematical Rendering: ${
        containers.length
      } containers`
    );

    console.log("\n📋 Step 4: Accessibility Controls Investigation...");
    const zoomControls = document.querySelectorAll('[name="zoom-trigger"]');
    const dynamicManager = window.dynamicMathJaxManager;
    console.log(
      `${zoomControls.length >= 3 ? "✅" : "❌"} Zoom Controls: ${
        zoomControls.length
      } controls`
    );
    console.log(
      `${!!dynamicManager ? "✅" : "❌"} Dynamic MathJax Manager: ${
        !!dynamicManager ? "ACTIVE" : "MISSING"
      }`
    );

    if (
      dynamicManager &&
      typeof dynamicManager.getCurrentSettings === "function"
    ) {
      try {
        const settings = dynamicManager.getCurrentSettings();
        console.log("📊 Current MathJax Settings:", settings);
      } catch (error) {
        console.log("⚠️ Could not retrieve MathJax settings:", error.message);
      }
    }

    console.log("\n=".repeat(60));
    const overallReady =
      phase2bResult &&
      health.overallSuccess &&
      containers.length > 0 &&
      zoomControls.length >= 3;
    console.log(
      `🎯 Startup Status: ${
        overallReady ? "✅ READY FOR DEVELOPMENT" : "⚠️ ISSUES DETECTED"
      }`
    );
    console.log("=".repeat(60));

    // Store startup results for reference
    window._startupProtocolResults = {
      timestamp: new Date().toISOString(),
      phase2b: phase2bResult,
      systemHealth: health,
      mathContainers: containers.length,
      zoomControls: zoomControls.length,
      dynamicManager: !!dynamicManager,
      overallReady: overallReady,
    };

    return {
      success: overallReady,
      phase2b: phase2bResult,
      health: health,
      mathContainers: containers.length,
      accessibility: {
        zoomControls: zoomControls.length,
        dynamicManager: !!dynamicManager,
      },
    };
  }

  /**
   * Enhanced comprehensive testing - all frameworks combined
   */
  function testAllEnhanced() {
    console.log("\n" + "🧪 ENHANCED COMPREHENSIVE TESTING".padEnd(60, "="));
    console.log("Mathematical Consistency + Accessibility + Integration");
    console.log("=".repeat(60));

    const results = {};

    // Mathematical consistency testing
    console.log("\n🧮 Mathematical Consistency Testing...");
    if (window.TestMathematicalConsistency) {
      results.mathematical =
        window.TestMathematicalConsistency.testAllMathExpressions();
      console.log(
        `${results.mathematical.success ? "✅" : "❌"} Mathematical: ${
          results.mathematical.passed
        }/${results.mathematical.total} tests`
      );
    } else {
      console.log("⚠️ Mathematical testing framework not available");
      results.mathematical = {
        success: false,
        error: "Framework not available",
      };
    }

    // Accessibility validation and restoration
    console.log("\n♿ Accessibility Validation & Restoration...");
    if (window.TestAccessibilityRestoration) {
      results.accessibility =
        window.TestAccessibilityRestoration.validateAndRestoreAccessibility();
      console.log(
        `${results.accessibility.success ? "✅" : "❌"} Accessibility: ${
          results.accessibility.passed
        }/${results.accessibility.total} tests`
      );
    } else {
      console.log("⚠️ Accessibility testing framework not available");
      results.accessibility = {
        success: false,
        error: "Framework not available",
      };
    }

    // Comprehensive integration testing
    console.log("\n🔬 Comprehensive Integration Testing...");
    if (window.TestComprehensiveIntegration) {
      results.integration =
        window.TestComprehensiveIntegration.runComprehensiveValidation();
      console.log(
        `${
          results.integration.success ? "✅" : "❌"
        } Integration: ${results.integration.overallScore.toFixed(
          1
        )}% overall score`
      );
    } else {
      console.log("⚠️ Integration testing framework not available");
      results.integration = {
        success: false,
        error: "Framework not available",
      };
    }

    // Legacy system testing
    console.log("\n🏛️ Legacy System Testing...");
    if (window.testAllSafe) {
      results.legacy = window.testAllSafe();
      console.log(
        `${results.legacy.overallSuccess ? "✅" : "❌"} Legacy: ${
          results.legacy.overallSuccess ? "PASS" : "FAIL"
        }`
      );
    } else {
      console.log("⚠️ Legacy testing not available");
      results.legacy = { overallSuccess: false };
    }

    // Compile overall results
    const successCount = Object.values(results).filter(
      (r) => r.success || r.overallSuccess
    ).length;
    const totalCategories = Object.keys(results).length;
    const overallSuccess = successCount === totalCategories;

    console.log("\n=".repeat(60));
    console.log(
      `🎯 ENHANCED TESTING RESULTS: ${
        overallSuccess ? "✅ ALL PASSED" : "❌ ISSUES DETECTED"
      } (${successCount}/${totalCategories})`
    );
    console.log("=".repeat(60));

    return {
      success: overallSuccess,
      categories: successCount,
      total: totalCategories,
      results: results,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Quick mathematical and accessibility check
   */
  function quickMathAccessibilityCheck() {
    console.log("\n⚡ QUICK MATH & ACCESSIBILITY CHECK");
    console.log("=".repeat(40));

    // Mathematical rendering
    const mathContainers = document.querySelectorAll("mjx-container").length;
    console.log(
      `🧮 Math Containers: ${mathContainers} ${
        mathContainers > 0 ? "✅" : "❌"
      }`
    );

    // Phase 2B enhancement
    let phase2bStatus = false;
    if (window.LaTeXProcessor && window.LaTeXProcessor.runPhase2BEnhancement) {
      try {
        const result = window.LaTeXProcessor.runPhase2BEnhancement();
        phase2bStatus = result && result.annotationCoveragePercent >= 80;
        console.log(
          `🚀 Phase 2B: ${phase2bStatus ? "✅" : "❌"} ${
            result ? result.annotationCoveragePercent.toFixed(1) : 0
          }% coverage`
        );
      } catch (error) {
        console.log("🚀 Phase 2B: ❌ ERROR");
      }
    } else {
      console.log("🚀 Phase 2B: ⚠️ NOT AVAILABLE");
    }

    // Accessibility controls
    const zoomControls = document.querySelectorAll(
      'input[name="zoom-trigger"]'
    ).length;
    const assistiveMml = document.getElementById("assistive-mathml");
    const tabNavigation = document.getElementById("tab-navigation");
    const dynamicManager = !!window.dynamicMathJaxManager;

    console.log(
      `🎛️ Zoom Controls: ${zoomControls >= 3 ? "✅" : "❌"} ${zoomControls}/3`
    );
    console.log(
      `♿ Assistive MathML: ${
        assistiveMml
          ? assistiveMml.checked
            ? "✅ ON"
            : "⚠️ OFF"
          : "❌ MISSING"
      }`
    );
    console.log(
      `⌨️ Tab Navigation: ${
        tabNavigation
          ? tabNavigation.checked
            ? "✅ ON"
            : "⚠️ OFF"
          : "❌ MISSING"
      }`
    );
    console.log(
      `⚙️ Dynamic Manager: ${dynamicManager ? "✅ ACTIVE" : "❌ MISSING"}`
    );

    // Export functionality
    const exportButton = document.getElementById("export-button");
    const exportReady = exportButton && !exportButton.disabled;
    console.log(
      `📤 Export Ready: ${exportReady ? "✅" : "❌"} ${
        exportReady ? "ENABLED" : "DISABLED"
      }`
    );

    // Overall health score
    const checks = [
      mathContainers > 0,
      phase2bStatus,
      zoomControls >= 3,
      dynamicManager,
      exportReady,
    ];
    const healthScore = (checks.filter(Boolean).length / checks.length) * 100;

    console.log("=".repeat(40));
    console.log(
      `🎯 Quick Health: ${
        healthScore >= 80 ? "✅ HEALTHY" : "⚠️ NEEDS ATTENTION"
      } (${healthScore.toFixed(1)}%)`
    );

    return {
      success: healthScore >= 80,
      score: healthScore,
      details: {
        mathContainers,
        phase2bStatus,
        zoomControls,
        assistiveMml: assistiveMml ? assistiveMml.checked : false,
        tabNavigation: tabNavigation ? tabNavigation.checked : false,
        dynamicManager,
        exportReady,
      },
    };
  }

  /**
   * Mathematical expression testing with accessibility validation
   */
  function testMathExpressionWithAccessibility(
    expression,
    context = "user-provided"
  ) {
    console.log(
      `\n🧮 Testing Expression: ${expression.substring(0, 50)}${
        expression.length > 50 ? "..." : ""
      }`
    );

    let results = {
      expression: expression,
      context: context,
      rendering: false,
      accessibility: false,
      export: false,
      overall: false,
    };

    // Test mathematical rendering
    try {
      if (window.TestMathematicalConsistency) {
        results.rendering =
          window.TestMathematicalConsistency.testMathExpression(
            expression,
            context
          );
        console.log(`   🎨 Rendering: ${results.rendering ? "✅" : "❌"}`);
      }
    } catch (error) {
      console.log(`   🎨 Rendering: ❌ ERROR - ${error.message}`);
    }

    // Test accessibility features
    try {
      // Check if expression would have proper accessibility
      const hasAccessibilityFeatures =
        document.getElementById("assistive-mathml")?.checked ||
        document.getElementById("tab-navigation")?.checked ||
        !!window.dynamicMathJaxManager;
      results.accessibility = hasAccessibilityFeatures;
      console.log(
        `   ♿ Accessibility: ${results.accessibility ? "✅" : "❌"}`
      );
    } catch (error) {
      console.log(`   ♿ Accessibility: ❌ ERROR - ${error.message}`);
    }

    // Test export compatibility
    try {
      if (window.LaTeXProcessor) {
        const processed =
          window.LaTeXProcessor.processLatexDocument(expression);
        results.export = processed && processed.includes("mjx-container");
        console.log(`   📤 Export: ${results.export ? "✅" : "❌"}`);
      }
    } catch (error) {
      console.log(`   📤 Export: ❌ ERROR - ${error.message}`);
    }

    results.overall =
      results.rendering && results.accessibility && results.export;
    console.log(`   🎯 Overall: ${results.overall ? "✅ PASS" : "❌ FAIL"}`);

    return results;
  }

  /**
   * Accessibility restoration with mathematical validation
   */
  function restoreAccessibilityWithMathValidation() {
    console.log("\n🔧 ACCESSIBILITY RESTORATION WITH MATH VALIDATION");
    console.log("=".repeat(55));

    // Step 1: Check current mathematical rendering
    console.log("📋 Step 1: Mathematical Rendering Status");
    const mathContainersBefore =
      document.querySelectorAll("mjx-container").length;
    console.log(`   Current containers: ${mathContainersBefore}`);

    // Step 2: Run accessibility restoration
    console.log("\n📋 Step 2: Accessibility Restoration");
    let restorationResult = { success: false };
    if (window.TestAccessibilityRestoration) {
      restorationResult =
        window.TestAccessibilityRestoration.restoreAccessibilityFeatures();
      console.log(
        `   Restoration: ${
          restorationResult.success ? "✅ SUCCESS" : "❌ FAILED"
        }`
      );
      console.log(
        `   Features restored: ${restorationResult.restoredFeatures || 0}/${
          restorationResult.totalFeatures || 0
        }`
      );
    } else {
      console.log("   ⚠️ Accessibility restoration framework not available");
    }

    // Step 3: Validate mathematical rendering preservation
    console.log("\n📋 Step 3: Mathematical Rendering Preservation");
    const mathContainersAfter =
      document.querySelectorAll("mjx-container").length;
    const mathPreserved = mathContainersAfter >= mathContainersBefore;
    console.log(`   Containers after: ${mathContainersAfter}`);
    console.log(
      `   Preservation: ${mathPreserved ? "✅ PRESERVED" : "❌ DEGRADED"}`
    );

    // Step 4: Test Phase 2B enhancement
    console.log("\n📋 Step 4: Phase 2B Enhancement Validation");
    let phase2bWorking = false;
    if (window.LaTeXProcessor && window.LaTeXProcessor.runPhase2BEnhancement) {
      try {
        const result = window.LaTeXProcessor.runPhase2BEnhancement();
        phase2bWorking = result && result.annotationCoveragePercent >= 80;
        console.log(
          `   Phase 2B: ${phase2bWorking ? "✅" : "❌"} ${
            result ? result.annotationCoveragePercent.toFixed(1) : 0
          }% coverage`
        );
      } catch (error) {
        console.log(`   Phase 2B: ❌ ERROR - ${error.message}`);
      }
    } else {
      console.log("   Phase 2B: ⚠️ NOT AVAILABLE");
    }

    // Step 5: Final validation
    console.log("\n📋 Step 5: Final Validation");
    const finalSuccess =
      restorationResult.success && mathPreserved && phase2bWorking;
    console.log(
      `   Overall success: ${finalSuccess ? "✅ COMPLETE" : "❌ INCOMPLETE"}`
    );

    console.log("=".repeat(55));

    return {
      success: finalSuccess,
      restoration: restorationResult,
      mathPreservation: {
        before: mathContainersBefore,
        after: mathContainersAfter,
        preserved: mathPreserved,
      },
      phase2bWorking: phase2bWorking,
    };
  }

  /**
   * Export validation with mathematical and accessibility consistency
   */
  function validateExportConsistency() {
    console.log("\n📤 EXPORT CONSISTENCY VALIDATION");
    console.log("=".repeat(40));

    const validationResults = {};

    // Check export manager availability
    console.log("📋 Export Manager Status");
    validationResults.exportManager = !!window.ExportManager;
    console.log(
      `   Export Manager: ${
        validationResults.exportManager ? "✅ AVAILABLE" : "❌ MISSING"
      }`
    );

    // Check template system
    console.log("\n📋 Template System Status");
    validationResults.templateSystem = false;
    if (window.TemplateSystem) {
      try {
        const generator = window.TemplateSystem.createGenerator();
        const testTemplate = generator.renderTemplate(
          "mathJaxAccessibilityControls"
        );
        validationResults.templateSystem =
          testTemplate && testTemplate.includes("zoom-trigger");
        console.log(
          `   Template System: ${
            validationResults.templateSystem
              ? "✅ FUNCTIONAL"
              : "❌ DYSFUNCTIONAL"
          }`
        );
      } catch (error) {
        console.log(`   Template System: ❌ ERROR - ${error.message}`);
      }
    } else {
      console.log("   Template System: ❌ MISSING");
    }

    // Check mathematical preservation in export
    console.log("\n📋 Mathematical Export Preservation");
    validationResults.mathExport = false;
    if (window.LaTeXProcessor) {
      try {
        const testMath = "x^2 + y^2 = z^2";
        const processed = window.LaTeXProcessor.processLatexDocument(testMath);
        validationResults.mathExport =
          processed && processed.includes("mjx-container");
        console.log(
          `   Math Export: ${
            validationResults.mathExport ? "✅ WORKING" : "❌ BROKEN"
          }`
        );
      } catch (error) {
        console.log(`   Math Export: ❌ ERROR - ${error.message}`);
      }
    } else {
      console.log("   Math Export: ❌ PROCESSOR MISSING");
    }

    // Check accessibility preservation in export
    console.log("\n📋 Accessibility Export Preservation");
    validationResults.accessibilityExport = validationResults.templateSystem; // Simplified check
    console.log(
      `   Accessibility Export: ${
        validationResults.accessibilityExport ? "✅ WORKING" : "❌ BROKEN"
      }`
    );

    // Check export button functionality
    console.log("\n📋 Export Button Functionality");
    const exportButton = document.getElementById("export-button");
    validationResults.exportButton = exportButton && !exportButton.disabled;
    console.log(
      `   Export Button: ${
        validationResults.exportButton ? "✅ ENABLED" : "❌ DISABLED"
      }`
    );

    // Overall assessment
    const validationScore =
      Object.values(validationResults).filter(Boolean).length;
    const totalChecks = Object.keys(validationResults).length;
    const exportReady = validationScore === totalChecks;

    console.log("=".repeat(40));
    console.log(
      `🎯 Export Readiness: ${
        exportReady ? "✅ READY" : "❌ NOT READY"
      } (${validationScore}/${totalChecks})`
    );

    return {
      success: exportReady,
      score: validationScore,
      total: totalChecks,
      details: validationResults,
    };
  }

  /**
   * Development readiness check
   */
  function checkDevelopmentReadiness() {
    console.log("\n🚀 DEVELOPMENT READINESS CHECK");
    console.log("=".repeat(35));

    const checks = {
      // System health
      systemHealth: (() => {
        if (window.testAllSafe) {
          const result = window.testAllSafe();
          return result.overallSuccess;
        }
        return false;
      })(),

      // Mathematical rendering
      mathRendering: document.querySelectorAll("mjx-container").length > 10,

      // Phase 2B enhancement
      phase2bActive: (() => {
        try {
          if (
            window.LaTeXProcessor &&
            window.LaTeXProcessor.runPhase2BEnhancement
          ) {
            const result = window.LaTeXProcessor.runPhase2BEnhancement();
            return result && result.annotationCoveragePercent >= 80;
          }
        } catch (error) {
          return false;
        }
        return false;
      })(),

      // Accessibility framework
      accessibilityFramework: !!(
        window.TestAccessibilityRestoration && window.dynamicMathJaxManager
      ),

      // Testing frameworks
      testingFrameworks: !!(
        window.TestMathematicalConsistency &&
        window.TestComprehensiveIntegration
      ),

      // Export functionality
      exportReadiness: (() => {
        const button = document.getElementById("export-button");
        return button && !button.disabled && !!window.ExportManager;
      })(),
    };

    for (const [check, status] of Object.entries(checks)) {
      console.log(`${status ? "✅" : "❌"} ${check}`);
    }

    const readinessScore = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const isReady = readinessScore === totalChecks;

    console.log("=".repeat(35));
    console.log(
      `🎯 Ready for Development: ${
        isReady ? "✅ YES" : "❌ NO"
      } (${readinessScore}/${totalChecks})`
    );

    if (!isReady) {
      console.log("\n💡 Issues to resolve:");
      for (const [check, status] of Object.entries(checks)) {
        if (!status) {
          console.log(`   • ${check} needs attention`);
        }
      }
    }

    return {
      success: isReady,
      score: readinessScore,
      total: totalChecks,
      checks: checks,
    };
  }

  // ===========================================================================================
  // ENHANCED COMMAND SHORTCUTS
  // ===========================================================================================

  /**
   * Ultra-safe comprehensive testing (bypasses verbose components)
   */
  function testAllEnhancedSafe() {
    try {
      // Suppress verbose logging temporarily
      const originalLogLevel = DEFAULT_LOG_LEVEL;

      const result = testAllEnhanced();

      // Simple one-line result
      console.log(
        `\n🎯 Enhanced Testing Result: ${
          result.success ? "✅ ALL PASSED" : "❌ ISSUES DETECTED"
        } (${result.categories}/${result.total} categories)`
      );

      return result;
    } catch (error) {
      console.log("❌ Enhanced testing failed:", error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pre-development mandatory check
   */
  function preDevelopmentCheck() {
    console.log("\n🔒 PRE-DEVELOPMENT MANDATORY CHECK");
    console.log("=".repeat(40));

    const baseline = sessionStartupProtocol();

    if (!baseline.success) {
      console.log("❌ DEVELOPMENT BLOCKED: System not ready");
      console.log(
        "💡 Run restoreAccessibilityWithMathValidation() to fix issues"
      );
      throw new Error("Cannot begin development with failing baseline tests");
    }

    console.log("✅ DEVELOPMENT APPROVED: System ready for changes");
    return baseline;
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main enhanced testing commands
    sessionStartupProtocol,
    testAllEnhanced,
    testAllEnhancedSafe,

    // Quick validation commands
    quickMathAccessibilityCheck,
    checkDevelopmentReadiness,
    preDevelopmentCheck,

    // Specialized testing
    testMathExpressionWithAccessibility,
    restoreAccessibilityWithMathValidation,
    validateExportConsistency,

    // Utility functions
    establishBaseline: () =>
      window.TestComprehensiveIntegration
        ? window.TestComprehensiveIntegration.establishBaseline()
        : sessionStartupProtocol(),
    compareToBaseline: () =>
      window.TestComprehensiveIntegration
        ? window.TestComprehensiveIntegration.compareToBaseline()
        : quickMathAccessibilityCheck(),
  };
})();

// Export enhanced testing commands globally
if (typeof window !== "undefined") {
  // Session and development commands
  window.sessionStartupProtocol = TestEnhancedCommands.sessionStartupProtocol;
  window.testAllEnhanced = TestEnhancedCommands.testAllEnhanced;
  window.testAllEnhancedSafe = TestEnhancedCommands.testAllEnhancedSafe;
  window.preDevelopmentCheck = TestEnhancedCommands.preDevelopmentCheck;

  // Quick validation commands
  window.quickMathAccessibilityCheck =
    TestEnhancedCommands.quickMathAccessibilityCheck;
  window.checkDevelopmentReadiness =
    TestEnhancedCommands.checkDevelopmentReadiness;

  // Specialized testing
  window.testMathExpressionWithAccessibility =
    TestEnhancedCommands.testMathExpressionWithAccessibility;
  window.restoreAccessibilityWithMathValidation =
    TestEnhancedCommands.restoreAccessibilityWithMathValidation;
  window.validateExportConsistency =
    TestEnhancedCommands.validateExportConsistency;

  // Convenience aliases
  window.startupProtocol = TestEnhancedCommands.sessionStartupProtocol;
  window.quickCheck = TestEnhancedCommands.quickMathAccessibilityCheck;

  console.log("🚀 Enhanced Testing Commands Framework loaded");
  console.log("📋 SESSION COMMANDS:");
  console.log(
    "   • sessionStartupProtocol() - Mandatory session initialization"
  );
  console.log(
    "   • testAllEnhanced() - Comprehensive testing (all frameworks)"
  );
  console.log("   • testAllEnhancedSafe() - Safe comprehensive testing");
  console.log("   • preDevelopmentCheck() - Mandatory before development");
  console.log("");
  console.log("📋 QUICK COMMANDS:");
  console.log("   • quickMathAccessibilityCheck() - Fast health check");
  console.log("   • checkDevelopmentReadiness() - Development approval");
  console.log("   • validateExportConsistency() - Export validation");
  console.log("");
  console.log("📋 RESTORATION COMMANDS:");
  console.log(
    "   • restoreAccessibilityWithMathValidation() - Fix accessibility"
  );
  console.log(
    "   • testMathExpressionWithAccessibility('expr') - Test expression"
  );
  console.log("");
  console.log("💡 QUICK START: Run sessionStartupProtocol() first!");
}

console.log("✅ Enhanced Testing Commands Framework ready");
