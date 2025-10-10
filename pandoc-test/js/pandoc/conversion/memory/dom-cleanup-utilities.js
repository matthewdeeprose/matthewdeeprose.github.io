// dom-cleanup-utilities.js
// DOM Cleanup Utilities - Annotation-safe DOM manipulation and cleanup
// Phase 3: Memory Management Extraction

const DOMCleanupUtilities = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("DOM_CLEANUP", {
    level: window.LoggingSystem.LOG_LEVELS.WARN,
  }) || {
    logError: console.error.bind(console, "[DOM_CLEANUP]"),
    logWarn: console.warn.bind(console, "[DOM_CLEANUP]"),
    logInfo: console.log.bind(console, "[DOM_CLEANUP]"),
    logDebug: console.log.bind(console, "[DOM_CLEANUP]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // DOM CLEANUP UTILITIES
  // ===========================================================================================

  /**
   * Clean temporary processing elements safely
   * Returns count of elements removed
   */
  function cleanTemporaryElements() {
    logDebug("Cleaning temporary processing elements...");

    let removedCount = 0;
    const tempSelectors = [
      ".temp-math-processing",
      ".processing-marker",
      ".mathjax-temp",
      "[data-temp='true']",
      ".conversion-temp",
    ];

    tempSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        // Double-check it's not containing annotations
        if (
          !element.querySelector('annotation[encoding="application/x-tex"]')
        ) {
          element.remove();
          removedCount++;
        }
      });
    });

    logDebug(`Removed ${removedCount} temporary elements`);
    return removedCount;
  }

  /**
   * Clean orphaned MathJax elements (outside output and without annotations)
   * Returns count of elements removed
   */
  function cleanOrphanedMathElements() {
    logDebug("Cleaning orphaned MathJax elements...");

    let removedCount = 0;
    const potentialOrphans = document.querySelectorAll(
      "mjx-container:not([id])"
    );

    potentialOrphans.forEach((element) => {
      // Skip if element is in output area
      if (element.closest("#output")) {
        return;
      }

      // Skip if element has annotation children
      const hasAnnotations = element.querySelector(
        'annotation[encoding="application/x-tex"]'
      );
      if (hasAnnotations) {
        logDebug("Preserving MathJax element with annotations");
        return;
      }

      element.remove();
      removedCount++;
    });

    logDebug(`Removed ${removedCount} orphaned MathJax elements`);
    return removedCount;
  }

  /**
   * Clean empty elements that don't contain annotations
   * Returns count of elements removed
   */
  function cleanEmptyElements() {
    logDebug("Cleaning safe empty elements...");

    let removedCount = 0;
    const emptyElements = document.querySelectorAll("span:empty, div:empty");

    emptyElements.forEach((element) => {
      if (
        !element.hasAttribute("id") &&
        !element.hasAttribute("class") &&
        !element.closest("mjx-container") &&
        !element.closest("annotation")
      ) {
        element.remove();
        removedCount++;
      }
    });

    logDebug(`Removed ${removedCount} empty elements`);
    return removedCount;
  }

  /**
   * Clear MathJax caches only if safe to do so
   * Returns true if caches were cleared
   */
  function clearMathJaxCachesIfSafe() {
    logDebug("Checking if MathJax cache clearing is safe...");

    // Only clear if we have no active math in output
    const activeMath = document.querySelectorAll("#output mjx-container");

    if (
      activeMath.length === 0 &&
      window.MathJax &&
      window.MathJax.typesetClear
    ) {
      try {
        window.MathJax.typesetClear();
        logDebug("MathJax caches cleared safely");
        return true;
      } catch (error) {
        logWarn("MathJax cache clear failed:", error);
        return false;
      }
    }

    logDebug("MathJax cache clearing skipped - active math present");
    return false;
  }

  /**
   * Check if annotations are present for given math elements
   * Returns annotation status information
   */
  function checkAnnotationStatus() {
    const mathElements = document.querySelectorAll("mjx-container").length;
    const annotations = document.querySelectorAll(
      'annotation[encoding="application/x-tex"]'
    ).length;

    const status = {
      mathElements,
      annotations,
      hasAnnotations: annotations > 0,
      annotationRatio: mathElements > 0 ? annotations / mathElements : 0,
      isAnnotationSafe: mathElements === 0 || annotations > 0,
    };

    logDebug("Annotation status:", status);
    return status;
  }

  /**
   * Perform a comprehensive annotation-safe cleanup
   * Returns summary of cleanup actions
   */
  function performComprehensiveCleanup() {
    logInfo("Performing comprehensive annotation-safe cleanup...");

    const status = checkAnnotationStatus();

    if (!status.isAnnotationSafe) {
      logWarn("Cleanup deferred - math elements present without annotations");
      return {
        performed: false,
        reason: "Annotation protection",
        mathElements: status.mathElements,
        annotations: status.annotations,
      };
    }

    const results = {
      performed: true,
      tempElementsRemoved: cleanTemporaryElements(),
      orphanedMathRemoved: cleanOrphanedMathElements(),
      emptyElementsRemoved: cleanEmptyElements(),
      mathJaxCacheCleared: clearMathJaxCachesIfSafe(),
      memoryHintApplied: false,
    };

    // Apply memory garbage collection hint if available
    if (window.gc && typeof window.gc === "function") {
      try {
        window.gc();
        results.memoryHintApplied = true;
        logDebug("Memory garbage collection hint applied");
      } catch (error) {
        logDebug(
          "Memory garbage collection hint failed (normal in production)"
        );
      }
    }

    const totalRemoved =
      results.tempElementsRemoved +
      results.orphanedMathRemoved +
      results.emptyElementsRemoved;
    logInfo(
      `Comprehensive cleanup completed: ${totalRemoved} elements removed`
    );

    return results;
  }

  /**
   * Get DOM statistics for monitoring
   * Returns current DOM state information
   */
  function getDOMStatistics() {
    const stats = {
      totalElements: document.querySelectorAll("*").length,
      mathElements: document.querySelectorAll("mjx-container").length,
      annotations: document.querySelectorAll(
        'annotation[encoding="application/x-tex"]'
      ).length,
      tempElements: document.querySelectorAll(
        ".temp-math-processing, .processing-marker"
      ).length,
      emptyElements: document.querySelectorAll("span:empty, div:empty").length,
      outputElements: document.querySelectorAll("#output *").length,
      timestamp: Date.now(),
    };

    logDebug("Current DOM statistics:", stats);
    return stats;
  }

  /**
   * Validate DOM health and return recommendations
   * Returns health assessment and recommendations
   */
  function assessDOMHealth() {
    const stats = getDOMStatistics();
    const annotationStatus = checkAnnotationStatus();

    const assessment = {
      healthy: true,
      warnings: [],
      recommendations: [],
      stats,
      annotationStatus,
    };

    // Check for excessive elements
    if (stats.totalElements > 5000) {
      assessment.healthy = false;
      assessment.warnings.push(`High element count: ${stats.totalElements}`);
      assessment.recommendations.push("Consider performing cleanup");
    }

    // Check for temp elements accumulation
    if (stats.tempElements > 10) {
      assessment.warnings.push(
        `Temporary elements accumulating: ${stats.tempElements}`
      );
      assessment.recommendations.push("Clean temporary processing elements");
    }

    // Check annotation consistency
    if (stats.mathElements > 0 && stats.annotations === 0) {
      assessment.warnings.push("Math elements without annotations detected");
      assessment.recommendations.push(
        "Wait for annotation injection or check MathJax configuration"
      );
    }

    // Check for excessive empty elements
    if (stats.emptyElements > 50) {
      assessment.warnings.push(`Many empty elements: ${stats.emptyElements}`);
      assessment.recommendations.push("Clean empty elements");
    }

    logDebug("DOM health assessment:", assessment);
    return assessment;
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testDOMCleanupUtilities() {
    const tests = {
      moduleExists: () => !!window.DOMCleanupUtilities,

      hasCoreFunctions: () => {
        const requiredFunctions = [
          "cleanTemporaryElements",
          "cleanOrphanedMathElements",
          "cleanEmptyElements",
          "clearMathJaxCachesIfSafe",
          "checkAnnotationStatus",
          "performComprehensiveCleanup",
        ];
        return requiredFunctions.every(
          (fn) => typeof window.DOMCleanupUtilities[fn] === "function"
        );
      },

      canCleanTemporaryElements: () => {
        try {
          const result = window.DOMCleanupUtilities.cleanTemporaryElements();
          return typeof result === "number" && result >= 0;
        } catch (error) {
          logError("cleanTemporaryElements failed:", error);
          return false;
        }
      },

      canCleanOrphanedMath: () => {
        try {
          const result = window.DOMCleanupUtilities.cleanOrphanedMathElements();
          return typeof result === "number" && result >= 0;
        } catch (error) {
          logError("cleanOrphanedMathElements failed:", error);
          return false;
        }
      },

      canCheckAnnotationStatus: () => {
        try {
          const status = window.DOMCleanupUtilities.checkAnnotationStatus();
          return (
            status &&
            typeof status.mathElements === "number" &&
            typeof status.annotations === "number" &&
            typeof status.isAnnotationSafe === "boolean"
          );
        } catch (error) {
          logError("checkAnnotationStatus failed:", error);
          return false;
        }
      },

      canGetDOMStatistics: () => {
        try {
          const stats = window.DOMCleanupUtilities.getDOMStatistics();
          return (
            stats &&
            typeof stats.totalElements === "number" &&
            typeof stats.mathElements === "number" &&
            typeof stats.timestamp === "number"
          );
        } catch (error) {
          logError("getDOMStatistics failed:", error);
          return false;
        }
      },

      canPerformComprehensiveCleanup: () => {
        try {
          const result =
            window.DOMCleanupUtilities.performComprehensiveCleanup();
          return result && typeof result.performed === "boolean";
        } catch (error) {
          logError("performComprehensiveCleanup failed:", error);
          return false;
        }
      },

      canAssessDOMHealth: () => {
        try {
          const health = window.DOMCleanupUtilities.assessDOMHealth();
          return (
            health &&
            typeof health.healthy === "boolean" &&
            Array.isArray(health.warnings) &&
            Array.isArray(health.recommendations)
          );
        } catch (error) {
          logError("assessDOMHealth failed:", error);
          return false;
        }
      },
    };

    return (
      window.TestUtilities?.runTestSuite("DOMCleanupUtilities", tests) ||
      fallbackTesting("DOMCleanupUtilities", tests)
    );
  }

  function fallbackTesting(moduleName, tests) {
    logInfo(`Testing ${moduleName} with fallback testing system...`);
    let passed = 0;
    let total = 0;

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const result = testFn();
        if (result) {
          passed++;
          logInfo(`  ✅ ${testName}: PASSED`);
        } else {
          logError(`  ❌ ${testName}: FAILED`);
        }
      } catch (error) {
        logError(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    });

    const success = passed === total;
    logInfo(`📊 ${moduleName}: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
      allPassed: success,
      totalTests: total,
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Core cleanup functions
    cleanTemporaryElements,
    cleanOrphanedMathElements,
    cleanEmptyElements,
    clearMathJaxCachesIfSafe,
    performComprehensiveCleanup,

    // Status and monitoring
    checkAnnotationStatus,
    getDOMStatistics,
    assessDOMHealth,

    // Testing
    testDOMCleanupUtilities,
  };
})();

// Make globally available
window.DOMCleanupUtilities = DOMCleanupUtilities;
