// test-annotation-timing.js
// Annotation Injection Timing Analysis
// Diagnoses memory cleanup interference with annotation system

const TestAnnotationTiming = (function () {
  "use strict";

  // Logging configuration
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;

  function logInfo(message, ...args) {
    console.log("[ANNOTATION-TIMING]", message, ...args);
  }

  function logWarn(message, ...args) {
    console.warn("[ANNOTATION-TIMING]", message, ...args);
  }

  /**
   * Monitor annotation injection process step by step
   */
  async function monitorAnnotationProcess() {
    logInfo("🔍 Starting annotation injection monitoring...");

    const monitoring = {
      startTime: Date.now(),
      events: [],
      mathElements: [],
      annotations: [],
      cleanupEvents: [],
      finalState: null,
    };

    // Hook into annotation injection system
    const originalInjectAnnotations = window.injectMathJaxAnnotations;
    if (originalInjectAnnotations) {
      window.injectMathJaxAnnotations = function (...args) {
        monitoring.events.push({
          timestamp: Date.now(),
          event: "annotation_injection_start",
          args: args.length,
        });

        const result = originalInjectAnnotations.apply(this, args);

        monitoring.events.push({
          timestamp: Date.now(),
          event: "annotation_injection_complete",
          result: typeof result,
        });

        return result;
      };
    }

    // Hook into memory cleanup systems
    const originalPerformDOMCleanup =
      window.ConversionEngine?.manager?.performDOMCleanup;
    if (originalPerformDOMCleanup) {
      window.ConversionEngine.manager.performDOMCleanup = function (...args) {
        const mathBefore = document.querySelectorAll("mjx-container").length;
        const annotationsBefore = document.querySelectorAll(
          'annotation[encoding="application/x-tex"]'
        ).length;

        monitoring.cleanupEvents.push({
          timestamp: Date.now(),
          event: "dom_cleanup_start",
          mathElementsBefore: mathBefore,
          annotationsBefore: annotationsBefore,
        });

        const result = originalPerformDOMCleanup.apply(this, args);

        const mathAfter = document.querySelectorAll("mjx-container").length;
        const annotationsAfter = document.querySelectorAll(
          'annotation[encoding="application/x-tex"]'
        ).length;

        monitoring.cleanupEvents.push({
          timestamp: Date.now(),
          event: "dom_cleanup_complete",
          mathElementsAfter: mathAfter,
          annotationsAfter: annotationsAfter,
          mathRemoved: mathBefore - mathAfter,
          annotationsRemoved: annotationsBefore - annotationsAfter,
        });

        return result;
      };
    }

    return monitoring;
  }

  /**
   * Test annotation injection without memory cleanup interference
   */
  async function testAnnotationWithoutCleanup() {
    logInfo("🧪 Testing annotation injection with cleanup disabled...");

    // Temporarily disable memory cleanup
    const originalCleanup = window.ConversionEngine?.manager?.performDOMCleanup;
    const originalWatchdog =
      window.ConversionEngine?.memoryWatchdog?.checkMemoryHealth;

    try {
      // Disable cleanup systems
      if (window.ConversionEngine?.manager) {
        window.ConversionEngine.manager.performDOMCleanup = () => {
          logInfo("🚫 DOM cleanup disabled for test");
        };
      }

      if (window.ConversionEngine?.memoryWatchdog) {
        window.ConversionEngine.memoryWatchdog.checkMemoryHealth = () => {
          logInfo("🚫 Memory watchdog disabled for test");
        };
      }

      // Load example and test annotations
      window.ExampleSystem.loadExample("statistics");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check annotation quality
      const quality = checkAnnotationQuality();

      logInfo("📊 Annotation results without cleanup:", {
        totalAnnotations: quality.total || 0,
        qualityPercentage: quality.percentage || 0,
        mathElements: document.querySelectorAll("mjx-container").length,
      });

      return {
        success: quality.total > 0,
        totalAnnotations: quality.total || 0,
        qualityPercentage: quality.percentage || 0,
      };
    } finally {
      // Restore original functions
      if (originalCleanup && window.ConversionEngine?.manager) {
        window.ConversionEngine.manager.performDOMCleanup = originalCleanup;
      }
      if (originalWatchdog && window.ConversionEngine?.memoryWatchdog) {
        window.ConversionEngine.memoryWatchdog.checkMemoryHealth =
          originalWatchdog;
      }
    }
  }

  /**
   * Test annotation injection with delayed cleanup
   */
  async function testAnnotationWithDelayedCleanup() {
    logInfo("🧪 Testing annotation injection with delayed cleanup...");

    // Load example
    window.ExampleSystem.loadExample("statistics");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Wait for annotations to complete
    let annotationCount = 0;
    let attempts = 0;
    const maxAttempts = 10;

    while (annotationCount === 0 && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      annotationCount = document.querySelectorAll(
        'annotation[encoding="application/x-tex"]'
      ).length;
      attempts++;
      logInfo(
        `⏳ Waiting for annotations... Attempt ${attempts}, found ${annotationCount}`
      );
    }

    // Now run cleanup
    if (annotationCount > 0) {
      logInfo("✅ Annotations detected, running cleanup...");
      if (window.ConversionEngine?.manager?.performDOMCleanup) {
        window.ConversionEngine.manager.performDOMCleanup();
      }
    }

    // Check final state
    const finalAnnotationCount = document.querySelectorAll(
      'annotation[encoding="application/x-tex"]'
    ).length;
    const quality = checkAnnotationQuality();

    return {
      success: finalAnnotationCount > 0,
      annotationsBeforeCleanup: annotationCount,
      annotationsAfterCleanup: finalAnnotationCount,
      qualityPercentage: quality.percentage || 0,
    };
  }

  /**
   * Main annotation timing test suite
   */
  function testAnnotationTiming() {
    logInfo("🧪 Testing Annotation Timing and Cleanup Interference...");

    const tests = {
      annotationSystemExists: () => {
        return !!(
          window.injectMathJaxAnnotations &&
          window.triggerAnnotationInjection &&
          window.checkAnnotationQuality
        );
      },

      memoryCleanupExists: () => {
        return !!window.ConversionEngine?.manager?.performDOMCleanup;
      },

      annotationWithoutCleanup: () => testAnnotationWithoutCleanup(),

      annotationWithDelayedCleanup: () => testAnnotationWithDelayedCleanup(),

      currentAnnotationState: () => {
        const mathElements = document.querySelectorAll("mjx-container").length;
        const annotations = document.querySelectorAll(
          'annotation[encoding="application/x-tex"]'
        ).length;
        logInfo(
          `📊 Current state: ${mathElements} math elements, ${annotations} annotations`
        );
        return mathElements > 0 || annotations >= 0; // Always pass, just for info
      },
    };

    return TestUtilities.runTestSuite("Annotation Timing", tests);
  }

  return {
    testAnnotationTiming,
    monitorAnnotationProcess,
    testAnnotationWithoutCleanup,
    testAnnotationWithDelayedCleanup,
  };
})();

// Export for testing framework
window.TestAnnotationTiming = TestAnnotationTiming;
window.testAnnotationTiming = TestAnnotationTiming.testAnnotationTiming;
