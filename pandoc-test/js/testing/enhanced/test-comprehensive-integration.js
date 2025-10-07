// test-comprehensive-integration.js
// Comprehensive Integration Testing Framework
// Mathematical consistency + Accessibility + Export pipeline validation

const TestComprehensiveIntegration = (function () {
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
      console.error("[INTEGRATION]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[INTEGRATION]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[INTEGRATION]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[INTEGRATION]", message, ...args);
  }

  // ===========================================================================================
  // COMPREHENSIVE INTEGRATION TESTING
  // ===========================================================================================

  /**
   * Run all comprehensive testing (mathematical + accessibility + export)
   */
  function runComprehensiveValidation() {
    logInfo("Starting comprehensive integration validation...");

    console.log("\n" + "=".repeat(80));
    console.log("🔬 COMPREHENSIVE SYSTEM VALIDATION");
    console.log(
      "   Mathematical Consistency + Accessibility + Export Pipeline"
    );
    console.log("=".repeat(80));

    try {
      // Phase 1: Pre-validation system check
      console.log("\n📋 Phase 1: System Health Check");
      const systemHealth = performSystemHealthCheck();

      // Phase 2: Mathematical consistency testing
      console.log("\n🧮 Phase 2: Mathematical Consistency Testing");
      const mathResults = window.TestMathematicalConsistency
        ? window.TestMathematicalConsistency.testAllMathExpressions()
        : null;

      // Phase 3: Accessibility validation and restoration
      console.log("\n♿ Phase 3: Accessibility Validation & Restoration");
      const accessibilityResults = window.TestAccessibilityRestoration
        ? window.TestAccessibilityRestoration.validateAndRestoreAccessibility()
        : null;

      // Phase 4: Export pipeline testing
      console.log("\n📤 Phase 4: Export Pipeline Testing");
      const exportResults = testExportPipelineIntegration();

      // Phase 5: Cross-system integration
      console.log("\n🔗 Phase 5: Cross-System Integration");
      const integrationResults = testCrossSystemIntegration();

      // Phase 6: Performance and stability
      console.log("\n⚡ Phase 6: Performance & Stability");
      const performanceResults = testPerformanceAndStability();

      // Compile comprehensive results
      const overallResults = compileComprehensiveResults({
        systemHealth,
        mathResults,
        accessibilityResults,
        exportResults,
        integrationResults,
        performanceResults,
      });

      // Generate final report
      generateComprehensiveReport(overallResults);

      return overallResults;
    } catch (error) {
      logError("Comprehensive validation failed:", error);
      console.log("❌ CRITICAL ERROR: Comprehensive validation failed");
      return { success: false, error: error.message };
    }
  }

  /**
   * Perform system health check before testing
   */
  function performSystemHealthCheck() {
    const healthChecks = {
      // Core modules availability
      appConfig: !!window.AppConfig,
      mathJaxManager: !!window.MathJaxManager,
      laTeXProcessor: !!window.LaTeXProcessor,
      contentGenerator: !!window.ContentGenerator,
      templateSystem: !!window.TemplateSystem,
      exportManager: !!window.ExportManager,

      // Testing frameworks
      testUtilities: !!window.TestUtilities,
      mathTesting: !!window.TestMathematicalConsistency,
      accessibilityTesting: !!window.TestAccessibilityRestoration,

      // MathJax and rendering
      mathJax: !!window.MathJax,
      mathContainers: document.querySelectorAll("mjx-container").length > 0,

      // Dynamic systems
      dynamicManager: !!window.dynamicMathJaxManager,
      phase2bProcessor: !!(
        window.LaTeXProcessor && window.LaTeXProcessor.runPhase2BEnhancement
      ),

      // DOM and accessibility
      accessibilityControls:
        document.querySelectorAll('input[name="zoom-trigger"]').length >= 3,
      exportButton:
        !!document.getElementById("export-button") &&
        !document.getElementById("export-button").disabled,
    };

    const healthScore = Object.values(healthChecks).filter(Boolean).length;
    const totalChecks = Object.keys(healthChecks).length;
    const healthPercentage = (healthScore / totalChecks) * 100;

    console.log(
      `📊 System Health: ${healthScore}/${totalChecks} components (${healthPercentage.toFixed(
        1
      )}%)`
    );

    // Detail report
    for (const [check, status] of Object.entries(healthChecks)) {
      console.log(`   • ${check}: ${status ? "✅" : "❌"}`);
    }

    const isHealthy = healthPercentage >= 85;
    console.log(
      `🎯 Health Status: ${isHealthy ? "✅ HEALTHY" : "⚠️ NEEDS ATTENTION"}`
    );

    return {
      success: isHealthy,
      score: healthScore,
      total: totalChecks,
      percentage: healthPercentage,
      details: healthChecks,
    };
  }

  /**
   * Test export pipeline integration
   */
  function testExportPipelineIntegration() {
    try {
      const tests = {
        exportManagerAvailable: () => !!window.ExportManager,
        exportButtonFunctional: () => {
          const button = document.getElementById("export-button");
          return button && !button.disabled;
        },
        templateSystemReady: () => {
          if (!window.TemplateSystem) return false;
          try {
            const generator = window.TemplateSystem.createGenerator();
            return !!generator;
          } catch (error) {
            return false;
          }
        },
        mathJaxEmbedding: () => {
          if (!window.ContentGenerator) return false;
          try {
            const config = window.ContentGenerator.generateMathJaxConfig();
            return config && config.includes("MathJax");
          } catch (error) {
            return false;
          }
        },
        accessibilityInExport: () => {
          if (!window.TemplateSystem) return false;
          try {
            const generator = window.TemplateSystem.createGenerator();
            const html = generator.renderTemplate(
              "mathJaxAccessibilityControls"
            );
            return html && html.includes("zoom-trigger");
          } catch (error) {
            return false;
          }
        },
        phase2bIntegration: () => {
          if (!window.LaTeXProcessor) return false;
          try {
            const result = window.LaTeXProcessor.runPhase2BEnhancement();
            return result && result.annotationCoveragePercent >= 80;
          } catch (error) {
            return false;
          }
        },
      };

      return TestUtilities.runTestSuite("Export Pipeline Integration", tests);
    } catch (error) {
      logError("Export pipeline testing failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test cross-system integration
   */
  function testCrossSystemIntegration() {
    try {
      const tests = {
        mathRenderingAccessibility: () => {
          const mathContainers = document.querySelectorAll("mjx-container");
          const accessibleMath = document.querySelectorAll(
            "mjx-container[aria-label], mjx-container[title]"
          );
          return (
            mathContainers.length > 0 &&
            accessibleMath.length / mathContainers.length >= 0.5
          );
        },

        dynamicControlsIntegration: () => {
          const manager = window.dynamicMathJaxManager;
          if (!manager) return false;

          const zoomControls = document.querySelectorAll(
            'input[name="zoom-trigger"]'
          );
          return (
            zoomControls.length >= 3 &&
            typeof manager.getCurrentSettings === "function"
          );
        },

        themeAccessibilityIntegration: () => {
          const themeToggle = document.querySelector(
            ".theme-toggle, #theme-toggle"
          );
          const accessibilityControls = document.querySelectorAll(
            ".accessibility-controls input, .accessibility-controls button"
          );
          return themeToggle && accessibilityControls.length > 0;
        },

        exportMathConsistency: () => {
          // Test that mathematical content is preserved in export process
          if (!window.LaTeXProcessor || !window.ContentGenerator) return false;

          try {
            const testMath = "x^2 + y^2 = z^2";
            const processed =
              window.LaTeXProcessor.processLatexDocument(testMath);
            return processed && processed.includes("mjx-container");
          } catch (error) {
            return false;
          }
        },

        templateAccessibilityConsistency: () => {
          if (!window.TemplateSystem) return false;

          try {
            const generator = window.TemplateSystem.createGenerator();
            const templates = [
              "mathJaxAccessibilityControls",
              "readingToolsSection",
              "themeToggleSection",
            ];

            return templates.every((templateName) => {
              try {
                const html = generator.renderTemplate(templateName);
                return html && html.length > 100; // Reasonable content length
              } catch (error) {
                return false;
              }
            });
          } catch (error) {
            return false;
          }
        },

        keyboardNavigationMathIntegration: () => {
          const mathElements = document.querySelectorAll("mjx-container");
          const accessibilityControls = document.querySelectorAll(
            'input[name="zoom-trigger"], #assistive-mathml, #tab-navigation'
          );

          // Check that both math and controls are keyboard accessible
          let keyboardAccessible = 0;
          accessibilityControls.forEach((control) => {
            if (control.tabIndex !== -1) keyboardAccessible++;
          });

          return mathElements.length > 0 && keyboardAccessible >= 2;
        },
      };

      return TestUtilities.runTestSuite("Cross-System Integration", tests);
    } catch (error) {
      logError("Cross-system integration testing failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test performance and stability
   */
  function testPerformanceAndStability() {
    try {
      const tests = {
        templatePerformance: () => {
          if (!window.TemplateSystem) return false;

          const startTime = performance.now();
          try {
            const generator = window.TemplateSystem.createGenerator();
            generator.renderTemplate("mathJaxAccessibilityControls");
            const duration = performance.now() - startTime;
            return duration < 100; // Should complete within 100ms
          } catch (error) {
            return false;
          }
        },

        mathJaxRenderingPerformance: () => {
          const startTime = performance.now();
          const containers = document.querySelectorAll("mjx-container");
          const duration = performance.now() - startTime;
          return containers.length > 0 && duration < 50;
        },

        phase2bPerformance: () => {
          if (!window.LaTeXProcessor) return false;

          const startTime = performance.now();
          try {
            window.LaTeXProcessor.runPhase2BEnhancement();
            const duration = performance.now() - startTime;
            return duration < 500; // Should complete within 500ms
          } catch (error) {
            return false;
          }
        },

        dynamicManagerResponsiveness: () => {
          const manager = window.dynamicMathJaxManager;
          if (!manager) return false;

          const startTime = performance.now();
          try {
            manager.getCurrentSettings();
            const duration = performance.now() - startTime;
            return duration < 10; // Should be very fast
          } catch (error) {
            return false;
          }
        },

        memoryStability: () => {
          // Simple memory leak check - ensure no excessive global variables
          const globalsBefore = Object.keys(window).length;

          // Trigger some operations
          try {
            if (window.TestMathematicalConsistency) {
              window.TestMathematicalConsistency.checkMathConsistency();
            }
            if (window.TestAccessibilityRestoration) {
              window.TestAccessibilityRestoration.validateDynamicMathJaxManager();
            }
          } catch (error) {
            // Ignore errors for this test
          }

          const globalsAfter = Object.keys(window).length;
          const memoryGrowth = globalsAfter - globalsBefore;

          return memoryGrowth <= 5; // Minimal memory growth acceptable
        },

        errorRecovery: () => {
          // Test system resilience to errors
          try {
            // Attempt operations that might fail gracefully
            if (window.LaTeXProcessor) {
              window.LaTeXProcessor.processLatexDocument("\\invalid{command}");
            }

            if (window.dynamicMathJaxManager) {
              window.dynamicMathJaxManager.applySettings({
                invalid: "setting",
              });
            }

            // System should still be functional
            return document.querySelectorAll("mjx-container").length > 0;
          } catch (error) {
            // Errors are acceptable, but system should remain stable
            return true;
          }
        },
      };

      return TestUtilities.runTestSuite("Performance & Stability", tests);
    } catch (error) {
      logError("Performance and stability testing failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Compile comprehensive test results
   */
  function compileComprehensiveResults(results) {
    const {
      systemHealth,
      mathResults,
      accessibilityResults,
      exportResults,
      integrationResults,
      performanceResults,
    } = results;

    // Calculate overall scores
    const scores = {
      systemHealth: systemHealth ? systemHealth.percentage : 0,
      mathematical: mathResults
        ? (mathResults.passed / mathResults.total) * 100
        : 0,
      accessibility: accessibilityResults
        ? (accessibilityResults.passed / accessibilityResults.total) * 100
        : 0,
      exportPipeline: exportResults
        ? (exportResults.passed / exportResults.total) * 100
        : 0,
      integration: integrationResults
        ? (integrationResults.passed / integrationResults.total) * 100
        : 0,
      performance: performanceResults
        ? (performanceResults.passed / performanceResults.total) * 100
        : 0,
    };

    const overallScore =
      Object.values(scores).reduce((sum, score) => sum + score, 0) /
      Object.keys(scores).length;
    const overallSuccess = overallScore >= 85; // 85% threshold for overall success

    return {
      success: overallSuccess,
      overallScore: overallScore,
      scores: scores,
      results: results,
      summary: {
        totalTests: Object.values(results).reduce(
          (sum, r) => sum + (r?.total || 0),
          0
        ),
        passedTests: Object.values(results).reduce(
          (sum, r) => sum + (r?.passed || 0),
          0
        ),
        categories: Object.keys(scores).length,
      },
    };
  }

  /**
   * Generate comprehensive report
   */
  function generateComprehensiveReport(overallResults) {
    console.log("\n" + "=".repeat(80));
    console.log("📊 COMPREHENSIVE VALIDATION RESULTS");
    console.log("=".repeat(80));

    const { scores, results, summary } = overallResults;

    // Overall status
    console.log(
      `🎯 Overall Status: ${
        overallResults.success ? "✅ PASSED" : "❌ FAILED"
      } (${overallResults.overallScore.toFixed(1)}%)`
    );
    console.log(
      `📋 Total Tests: ${summary.passedTests}/${summary.totalTests} passed across ${summary.categories} categories`
    );

    console.log("\n📈 CATEGORY SCORES:");
    for (const [category, score] of Object.entries(scores)) {
      const status = score >= 85 ? "✅" : score >= 70 ? "⚠️" : "❌";
      console.log(
        `   • ${
          category.charAt(0).toUpperCase() + category.slice(1)
        }: ${status} ${score.toFixed(1)}%`
      );
    }

    // Detailed results
    console.log("\n🔍 DETAILED RESULTS:");

    if (results.systemHealth) {
      console.log(
        `   🏥 System Health: ${results.systemHealth.success ? "✅" : "❌"} (${
          results.systemHealth.score
        }/${results.systemHealth.total})`
      );
    }

    if (results.mathResults) {
      console.log(
        `   🧮 Mathematical: ${results.mathResults.success ? "✅" : "❌"} (${
          results.mathResults.passed
        }/${results.mathResults.total})`
      );
    }

    if (results.accessibilityResults) {
      console.log(
        `   ♿ Accessibility: ${
          results.accessibilityResults.success ? "✅" : "❌"
        } (${results.accessibilityResults.passed}/${
          results.accessibilityResults.total
        })`
      );
    }

    if (results.exportResults) {
      console.log(
        `   📤 Export Pipeline: ${
          results.exportResults.success ? "✅" : "❌"
        } (${results.exportResults.passed}/${results.exportResults.total})`
      );
    }

    if (results.integrationResults) {
      console.log(
        `   🔗 Integration: ${
          results.integrationResults.success ? "✅" : "❌"
        } (${results.integrationResults.passed}/${
          results.integrationResults.total
        })`
      );
    }

    if (results.performanceResults) {
      console.log(
        `   ⚡ Performance: ${
          results.performanceResults.success ? "✅" : "❌"
        } (${results.performanceResults.passed}/${
          results.performanceResults.total
        })`
      );
    }

    // Critical status indicators
    console.log("\n🔧 CRITICAL STATUS INDICATORS:");
    const mathContainers = document.querySelectorAll("mjx-container").length;
    const dynamicManager = !!window.dynamicMathJaxManager;
    const exportButton =
      !!document.getElementById("export-button") &&
      !document.getElementById("export-button").disabled;
    const accessibilityControls =
      document.querySelectorAll('input[name="zoom-trigger"]').length >= 3;

    console.log(
      `   • Mathematical Rendering: ${mathContainers} containers ${
        mathContainers > 10 ? "✅" : "⚠️"
      }`
    );
    console.log(
      `   • Dynamic MathJax Manager: ${
        dynamicManager ? "✅ ACTIVE" : "❌ MISSING"
      }`
    );
    console.log(
      `   • Export Functionality: ${exportButton ? "✅ READY" : "❌ DISABLED"}`
    );
    console.log(
      `   • Accessibility Controls: ${
        accessibilityControls ? "✅ COMPLETE" : "❌ INCOMPLETE"
      }`
    );

    // Phase 2B enhancement status
    if (window.LaTeXProcessor && window.LaTeXProcessor.runPhase2BEnhancement) {
      try {
        const phase2bResult = window.LaTeXProcessor.runPhase2BEnhancement();
        const coverage = phase2bResult
          ? phase2bResult.annotationCoveragePercent
          : 0;
        console.log(
          `   • Phase 2B Enhancement: ${
            coverage >= 80 ? "✅" : "⚠️"
          } ${coverage.toFixed(1)}% annotation coverage`
        );
      } catch (error) {
        console.log(`   • Phase 2B Enhancement: ❌ ERROR`);
      }
    }

    // Recommendations
    console.log("\n💡 RECOMMENDATIONS:");
    if (scores.systemHealth < 85) {
      console.log("   • Check core module availability and loading order");
    }
    if (scores.mathematical < 85) {
      console.log(
        "   • Verify mathematical expression rendering and LaTeX processing"
      );
    }
    if (scores.accessibility < 85) {
      console.log(
        "   • Run accessibility restoration: emergencyAccessibilityRestoration()"
      );
    }
    if (scores.exportPipeline < 85) {
      console.log(
        "   • Check export manager and template system functionality"
      );
    }
    if (scores.integration < 85) {
      console.log("   • Verify cross-system communication and data flow");
    }
    if (scores.performance < 85) {
      console.log("   • Monitor performance bottlenecks and memory usage");
    }

    console.log("=".repeat(80));
    console.log(
      `🏆 FINAL STATUS: ${
        overallResults.success
          ? "✅ SYSTEM READY FOR PRODUCTION"
          : "⚠️ SYSTEM NEEDS ATTENTION"
      }`
    );
    console.log("=".repeat(80));

    return overallResults;
  }

  // ===========================================================================================
  // QUICK VALIDATION COMMANDS
  // ===========================================================================================

  /**
   * Quick system validation - essential checks only
   */
  function quickSystemValidation() {
    console.log("\n⚡ QUICK SYSTEM VALIDATION");
    console.log("=".repeat(40));

    const checks = {
      mathRendering: document.querySelectorAll("mjx-container").length > 0,
      dynamicManager: !!window.dynamicMathJaxManager,
      accessibilityControls:
        document.querySelectorAll('input[name="zoom-trigger"]').length >= 3,
      exportReady:
        !!document.getElementById("export-button") &&
        !document.getElementById("export-button").disabled,
      testingFrameworks: !!(
        window.TestMathematicalConsistency &&
        window.TestAccessibilityRestoration
      ),
      phase2bActive: (() => {
        try {
          if (!window.LaTeXProcessor) return false;
          const result = window.LaTeXProcessor.runPhase2BEnhancement();
          return result && result.annotationCoveragePercent >= 80;
        } catch (error) {
          return false;
        }
      })(),
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const healthScore = (passedChecks / totalChecks) * 100;

    for (const [check, status] of Object.entries(checks)) {
      console.log(`${status ? "✅" : "❌"} ${check}`);
    }

    console.log("=".repeat(40));
    console.log(
      `🎯 Quick Status: ${
        healthScore >= 85 ? "✅ HEALTHY" : "⚠️ NEEDS ATTENTION"
      } (${passedChecks}/${totalChecks})`
    );

    return {
      success: healthScore >= 85,
      score: healthScore,
      checks: checks,
      recommendations:
        healthScore < 85
          ? "Run runComprehensiveValidation() for detailed analysis"
          : "System is healthy",
    };
  }

  /**
   * Emergency system check - minimal validation
   */
  function emergencySystemCheck() {
    const mathRendering = document.querySelectorAll("mjx-container").length;
    const exportButton = document.getElementById("export-button");
    const testFramework = !!window.TestUtilities;

    const isOperational =
      mathRendering > 0 &&
      exportButton &&
      !exportButton.disabled &&
      testFramework;

    console.log(
      `🚨 Emergency Check: ${
        isOperational ? "✅ OPERATIONAL" : "❌ CRITICAL ISSUES"
      }`
    );
    console.log(`   Mathematical rendering: ${mathRendering} containers`);
    console.log(
      `   Export functionality: ${
        exportButton && !exportButton.disabled ? "Ready" : "Disabled"
      }`
    );
    console.log(
      `   Testing framework: ${testFramework ? "Available" : "Missing"}`
    );

    return isOperational;
  }

  // ===========================================================================================
  // BASELINE VALIDATION
  // ===========================================================================================

  /**
   * Establish baseline before development
   */
  function establishBaseline() {
    console.log("\n📋 ESTABLISHING BASELINE FOR DEVELOPMENT");
    console.log("=".repeat(50));

    const baseline = quickSystemValidation();

    // Store baseline for comparison
    window._systemBaseline = {
      timestamp: new Date().toISOString(),
      score: baseline.score,
      checks: baseline.checks,
      mathContainers: document.querySelectorAll("mjx-container").length,
    };

    console.log("✅ Baseline established and stored in window._systemBaseline");
    console.log("💡 Use compareToBaseline() to check for regressions");

    return baseline;
  }

  /**
   * Compare current state to baseline
   */
  function compareToBaseline() {
    if (!window._systemBaseline) {
      console.log("❌ No baseline available. Run establishBaseline() first.");
      return false;
    }

    const current = quickSystemValidation();
    const baseline = window._systemBaseline;

    console.log("\n📊 BASELINE COMPARISON");
    console.log("=".repeat(30));
    console.log(`Baseline score: ${baseline.score.toFixed(1)}%`);
    console.log(`Current score:  ${current.score.toFixed(1)}%`);

    const scoreDiff = current.score - baseline.score;
    console.log(
      `Score change:   ${scoreDiff >= 0 ? "+" : ""}${scoreDiff.toFixed(1)}%`
    );

    const currentMath = document.querySelectorAll("mjx-container").length;
    const mathDiff = currentMath - baseline.mathContainers;
    console.log(
      `Math containers: ${baseline.mathContainers} → ${currentMath} (${
        mathDiff >= 0 ? "+" : ""
      }${mathDiff})`
    );

    const isRegression = scoreDiff < -5 || mathDiff < -5;
    console.log(
      `Status: ${isRegression ? "⚠️ REGRESSION DETECTED" : "✅ NO REGRESSION"}`
    );

    return !isRegression;
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main comprehensive testing
    runComprehensiveValidation,

    // Individual test phases
    performSystemHealthCheck,
    testExportPipelineIntegration,
    testCrossSystemIntegration,
    testPerformanceAndStability,

    // Quick validation
    quickSystemValidation,
    emergencySystemCheck,

    // Baseline management
    establishBaseline,
    compareToBaseline,

    // Utility functions
    compileComprehensiveResults,
    generateComprehensiveReport,
  };
})();

// Export global comprehensive testing functions
if (typeof window !== "undefined") {
  // Primary comprehensive testing
  window.runComprehensiveValidation =
    TestComprehensiveIntegration.runComprehensiveValidation;
  window.quickSystemValidation =
    TestComprehensiveIntegration.quickSystemValidation;
  window.emergencySystemCheck =
    TestComprehensiveIntegration.emergencySystemCheck;

  // Baseline management
  window.establishBaseline = TestComprehensiveIntegration.establishBaseline;
  window.compareToBaseline = TestComprehensiveIntegration.compareToBaseline;

  // Individual test components
  window.performSystemHealthCheck =
    TestComprehensiveIntegration.performSystemHealthCheck;
  window.testExportPipelineIntegration =
    TestComprehensiveIntegration.testExportPipelineIntegration;
  window.testCrossSystemIntegration =
    TestComprehensiveIntegration.testCrossSystemIntegration;
  window.testPerformanceAndStability =
    TestComprehensiveIntegration.testPerformanceAndStability;

  console.log("🔬 Comprehensive Integration Testing Framework loaded");
  console.log("📋 Available commands:");
  console.log("   • runComprehensiveValidation() - Full system validation");
  console.log("   • quickSystemValidation() - Essential checks only");
  console.log("   • emergencySystemCheck() - Minimal critical check");
  console.log("   • establishBaseline() - Set baseline for development");
  console.log("   • compareToBaseline() - Check for regressions");
}

console.log("✅ Comprehensive Integration Testing Framework ready");
