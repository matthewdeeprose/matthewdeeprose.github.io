// js/testing/individual/test-comprehensive-annotation-diagnostics.js
// Comprehensive MathJax Annotation System Diagnostic Coordinator
// Integrates all existing diagnostic tools for complete system analysis

const TestComprehensiveAnnotationDiagnostics = (function () {
  "use strict";

  // Logging configuration
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
      console.error("[COMPREHENSIVE-DIAGNOSTICS]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[COMPREHENSIVE-DIAGNOSTICS]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[COMPREHENSIVE-DIAGNOSTICS]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[COMPREHENSIVE-DIAGNOSTICS]", message, ...args);
  }

  /**
   * Phase 1: Baseline Assessment
   */
  function runBaselineAssessment() {
    console.log("=== PHASE 1: BASELINE ASSESSMENT ===");

    // 1. System health check
    console.log("1. Memory and System Status:");
    const memoryStatus = window.memoryCommands?.check() || {
      status: "Memory commands not available",
    };
    const systemStatus = window.testAllSafe
      ? window.testAllSafe()
      : { overallSuccess: false, reason: "testAllSafe not available" };

    logInfo("Memory:", memoryStatus);
    logInfo(
      "System tests:",
      systemStatus.overallSuccess ? "✅ PASS" : "❌ FAIL"
    );

    // 2. Current annotation state
    console.log("2. Current Annotation State:");
    const currentState =
      window.annotationDebug?.check() ||
      window.checkAnnotationQuality?.() ||
      getBasicAnnotationState();
    logInfo("Current annotations:", currentState);

    // 3. Available tools verification
    console.log("3. Available Diagnostic Tools:");
    const availableTools = {
      exampleDebug: !!window.exampleDebug,
      TestAnnotationTiming: !!window.TestAnnotationTiming,
      TestExampleAnnotationTiming: !!window.TestExampleAnnotationTiming,
      TestMathJaxAccessibilityDiagnostics:
        !!window.TestMathJaxAccessibilityDiagnostics,
      checkAnnotationQuality: !!window.checkAnnotationQuality,
      MathJax: !!window.MathJax,
      injectMathJaxAnnotations: !!window.injectMathJaxAnnotations,
      memoryCommands: !!window.memoryCommands,
      ConversionEngine: !!window.ConversionEngine,
      ExampleSystem: !!window.ExampleSystem,
    };

    Object.entries(availableTools).forEach(([tool, available]) => {
      logInfo(`- ${tool}:`, available ? "✅ Available" : "❌ Missing");
    });

    console.log("=== BASELINE COMPLETE ===");

    return {
      memoryStatus,
      systemStatus,
      currentState,
      availableTools,
      overallHealth:
        systemStatus.overallSuccess &&
        Object.values(availableTools).filter(Boolean).length >= 5,
    };
  }

  /**
   * Basic annotation state check when advanced tools unavailable
   */
  function getBasicAnnotationState() {
    const mathElements = document.querySelectorAll("mjx-container").length;
    const annotations = document.querySelectorAll(
      'annotation[encoding="application/x-tex"]'
    ).length;
    const ratio =
      mathElements > 0 ? ((annotations / mathElements) * 100).toFixed(1) : "0";

    return {
      mathElements,
      annotations,
      percentage: parseFloat(ratio),
      status: annotations > 0 ? "✅ WORKING" : "❌ FAILING",
    };
  }

  /**
   * Phase 2: Deep Annotation Investigation
   */
  async function runAnnotationSystemDeepDive() {
    console.log("=== PHASE 2: ANNOTATION SYSTEM INVESTIGATION ===");

    try {
      // Clear any existing content
      const input = document.getElementById("input");
      if (input) input.value = "";
      await new Promise((resolve) => setTimeout(resolve, 500));

      logInfo("🔍 Starting comprehensive annotation diagnostic...");

      const results = {};

      // Test 1: Monitor example loading process using existing tools
      console.log("TEST 1: Example Loading Timeline Analysis");
      if (window.TestExampleAnnotationTiming) {
        results.timeline =
          await window.TestExampleAnnotationTiming.monitorExampleLoadingProcess(
            "statistics"
          );

        logInfo("📊 Timeline Analysis:");
        if (results.timeline?.events) {
          results.timeline.events.forEach((event) => {
            logInfo(`  ${event.timestamp}ms: ${event.event}`, event);
          });
        }
      } else {
        logWarn(
          "TestExampleAnnotationTiming not available, using basic monitoring"
        );
        results.timeline = await basicExampleMonitoring();
      }

      // Test 2: Test specific examples
      console.log("\nTEST 2: Individual Example Testing");
      const examples = ["basic-math", "statistics", "equations"];
      results.exampleResults = {};

      for (const example of examples) {
        logInfo(`Testing ${example}...`);
        results.exampleResults[example] = await testIndividualExample(example);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Gap between tests
      }

      logInfo("📊 Example Test Results:");
      Object.entries(results.exampleResults).forEach(([key, result]) => {
        const success = result.annotations > 0;
        logInfo(
          `  ${key}: ${success ? "✅" : "❌"} ${result.annotations}/${
            result.mathElements
          } annotations`
        );
      });

      // Test 3: Timing analysis using existing TestAnnotationTiming
      console.log("\nTEST 3: Annotation Timing Analysis");
      if (window.testAnnotationTiming) {
        results.timingResults = await window.testAnnotationTiming();
      } else {
        logWarn("testAnnotationTiming not available");
        results.timingResults = { success: false, reason: "Tool unavailable" };
      }

      // Generate summary
      results.summary = {
        issueResolved: Object.values(results.exampleResults).every(
          (r) => r.annotations > 0
        ),
        affectedExamples: Object.entries(results.exampleResults)
          .filter(([k, v]) => v.annotations === 0)
          .map(([k, v]) => k),
        successfulExamples: Object.entries(results.exampleResults)
          .filter(([k, v]) => v.annotations > 0)
          .map(([k, v]) => k),
        totalMathElements: Object.values(results.exampleResults).reduce(
          (sum, r) => sum + r.mathElements,
          0
        ),
        totalAnnotations: Object.values(results.exampleResults).reduce(
          (sum, r) => sum + r.annotations,
          0
        ),
      };

      return results;
    } catch (error) {
      logError("❌ Diagnostic failed:", error);
      return null;
    }
  }

  /**
   * Basic example monitoring when advanced tools unavailable
   */
  async function basicExampleMonitoring() {
    const timeline = {
      startTime: Date.now(),
      events: [],
      finalState: null,
    };

    timeline.events.push({ timestamp: 0, event: "basic_monitoring_start" });

    // Load example
    if (window.ExampleSystem?.loadExample) {
      timeline.events.push({
        timestamp: Date.now() - timeline.startTime,
        event: "example_load_initiated",
      });
      window.ExampleSystem.loadExample("statistics");

      // Wait and monitor
      await new Promise((resolve) => setTimeout(resolve, 3000));
      timeline.events.push({
        timestamp: Date.now() - timeline.startTime,
        event: "load_wait_complete",
      });

      const finalState = getBasicAnnotationState();
      timeline.events.push({
        timestamp: Date.now() - timeline.startTime,
        event: "final_state_check",
        ...finalState,
      });

      timeline.finalState = finalState;
    } else {
      timeline.events.push({
        timestamp: Date.now() - timeline.startTime,
        event: "example_system_unavailable",
      });
    }

    return timeline;
  }

  /**
   * Test individual example
   */
  async function testIndividualExample(exampleKey) {
    logDebug(`Testing individual example: ${exampleKey}`);

    try {
      // Load example
      if (window.ExampleSystem?.loadExample) {
        window.ExampleSystem.loadExample(exampleKey);

        // Wait for processing
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Check results
        const state = getBasicAnnotationState();

        return {
          example: exampleKey,
          mathElements: state.mathElements,
          annotations: state.annotations,
          percentage: state.percentage,
          success: state.annotations > 0,
        };
      } else {
        return {
          example: exampleKey,
          mathElements: 0,
          annotations: 0,
          percentage: 0,
          success: false,
          error: "ExampleSystem unavailable",
        };
      }
    } catch (error) {
      return {
        example: exampleKey,
        mathElements: 0,
        annotations: 0,
        percentage: 0,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Phase 3: Resolution Verification
   */
  async function runResolutionVerification() {
    console.log("=== PHASE 3: RESOLUTION VERIFICATION ===");

    logInfo("🔧 Testing resolution strategies...");

    const results = {};

    // Strategy 1: Test without memory cleanup interference
    if (window.TestAnnotationTiming?.testAnnotationWithoutCleanup) {
      console.log("Strategy 1: Testing without cleanup interference");
      results.withoutCleanup =
        await window.TestAnnotationTiming.testAnnotationWithoutCleanup();
      logInfo(
        "Without cleanup:",
        results.withoutCleanup?.success ? "✅ SUCCESS" : "❌ FAILED"
      );
    }

    // Strategy 2: Test with delayed cleanup
    if (window.TestAnnotationTiming?.testAnnotationWithDelayedCleanup) {
      console.log("Strategy 2: Testing with delayed cleanup");
      results.withDelayedCleanup =
        await window.TestAnnotationTiming.testAnnotationWithDelayedCleanup();
      logInfo(
        "Delayed cleanup:",
        results.withDelayedCleanup?.success ? "✅ SUCCESS" : "❌ FAILED"
      );
    }

    // Strategy 3: Test different loading methods
    if (window.TestExampleAnnotationTiming?.testExampleLoadingMethods) {
      console.log("Strategy 3: Testing different loading methods");
      results.methodComparison =
        await window.TestExampleAnnotationTiming.testExampleLoadingMethods();
      logInfo("Method comparison:", results.methodComparison);
    }

    // Determine root cause
    if (
      results.withoutCleanup?.success &&
      !results.withDelayedCleanup?.success
    ) {
      logInfo("🎯 ROOT CAUSE: Memory cleanup timing interference");
      results.rootCause = "CLEANUP_INTERFERENCE";
    } else if (!results.withoutCleanup?.success) {
      logInfo("🎯 ROOT CAUSE: Annotation injection system failure");
      results.rootCause = "INJECTION_FAILURE";
    } else {
      logInfo("🎯 ROOT CAUSE: Example loading timing issue");
      results.rootCause = "LOADING_TIMING";
    }

    return results;
  }

  /**
   * Main comprehensive diagnostic function
   */
  async function runComprehensiveDiagnostic() {
    logInfo("🚀 Starting Comprehensive MathJax Annotation Diagnostic...");

    const diagnosticResults = {
      timestamp: new Date().toISOString(),
      phases: {},
    };

    // Phase 1: Baseline
    diagnosticResults.phases.baseline = runBaselineAssessment();

    // Phase 2: Deep dive (only if baseline shows issues or we want full analysis)
    diagnosticResults.phases.investigation =
      await runAnnotationSystemDeepDive();

    // Phase 3: Resolution verification (only if issues persist)
    const issuesFound =
      !diagnosticResults.phases.investigation?.summary?.issueResolved;
    if (issuesFound) {
      diagnosticResults.phases.resolution = await runResolutionVerification();
    }

    // Final summary
    console.log("=== COMPREHENSIVE DIAGNOSTIC COMPLETE ===");

    if (diagnosticResults.phases.investigation?.summary) {
      const summary = diagnosticResults.phases.investigation.summary;
      logInfo("📋 SUMMARY:", summary);

      if (summary.issueResolved) {
        logInfo("✅ ANNOTATION ISSUE RESOLVED");
        logInfo(
          `Successfully processing ${summary.totalAnnotations}/${summary.totalMathElements} annotations`
        );
      } else {
        logInfo("❌ ANNOTATION ISSUE PERSISTS");
        logInfo("Affected examples:", summary.affectedExamples);

        if (diagnosticResults.phases.resolution?.rootCause) {
          logInfo(
            "Root cause identified:",
            diagnosticResults.phases.resolution.rootCause
          );
        }
      }
    }

    return diagnosticResults;
  }

  /**
   * Quick status check for ongoing monitoring
   */
  function quickAnnotationStatus() {
    const state = getBasicAnnotationState();

    return {
      status: state.status,
      math: state.mathElements,
      annotations: state.annotations,
      ratio: state.percentage + "%",
      timestamp: new Date().toISOString(),
    };
  }

  return {
    runComprehensiveDiagnostic,
    runBaselineAssessment,
    runAnnotationSystemDeepDive,
    runResolutionVerification,
    quickAnnotationStatus,
    getBasicAnnotationState,
  };
})();

// Export for console access
window.TestComprehensiveAnnotationDiagnostics =
  TestComprehensiveAnnotationDiagnostics;
window.runComprehensiveDiagnostic =
  TestComprehensiveAnnotationDiagnostics.runComprehensiveDiagnostic;
window.quickStatus =
  TestComprehensiveAnnotationDiagnostics.quickAnnotationStatus;
