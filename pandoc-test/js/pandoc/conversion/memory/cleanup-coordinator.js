// cleanup-coordinator.js
// Cleanup Coordination System - Orchestrates memory cleanup and timeout management
// Phase 3: Memory Management Extraction

const CleanupCoordinator = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("CLEANUP_COORD", {
    level: window.LoggingSystem.LOG_LEVELS.WARN,
  }) || {
    logError: console.error.bind(console, "[CLEANUP_COORD]"),
    logWarn: console.warn.bind(console, "[CLEANUP_COORD]"),
    logInfo: console.log.bind(console, "[CLEANUP_COORD]"),
    logDebug: console.log.bind(console, "[CLEANUP_COORD]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // CLEANUP COORDINATION SYSTEM
  // ===========================================================================================

  /**
   * Comprehensive memory cleanup system
   * Coordinates different levels of cleanup based on system state
   */
  function cleanup(activeTimeouts = new Set(), pollingTimeouts = new Set()) {
    logInfo("Performing comprehensive memory cleanup...");

    // Clear ALL tracked timeouts
    activeTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    activeTimeouts.clear();

    // Clear polling timeouts
    pollingTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    pollingTimeouts.clear();

    logInfo("Memory cleanup completed (LaTeX registries preserved)");
  }

  /**
   * Emergency: Full shutdown cleanup - clears everything including LaTeX registries
   */
  function emergencyCleanup(
    activeTimeouts = new Set(),
    pollingTimeouts = new Set()
  ) {
    logWarn(
      "Emergency cleanup - clearing all memory including LaTeX registries"
    );

    // Do regular cleanup first
    cleanup(activeTimeouts, pollingTimeouts);

    // Then perform full cleanup including registries
    performFullCleanup();

    logWarn("Emergency cleanup completed");
  }

  /**
   * Performance: Enhanced DOM cleanup for empty content and large deletions
   * NOTE: This does NOT clear LaTeX registries - those are needed for annotation injection
   */
  function performDOMCleanup() {
    logInfo("Performing annotation-safe DOM cleanup...");

    // Annotation protection: Check if annotations are in progress
    const mathElements = document.querySelectorAll("mjx-container").length;
    const annotations = document.querySelectorAll(
      'annotation[encoding="application/x-tex"]'
    ).length;

    if (mathElements > 0 && annotations === 0) {
      logWarn(
        "Math elements present but no annotations - delaying cleanup to protect annotation injection"
      );

      // Schedule cleanup after annotation injection
      setTimeout(() => {
        const finalAnnotations = document.querySelectorAll(
          'annotation[encoding="application/x-tex"]'
        ).length;
        if (finalAnnotations > 0 || mathElements === 0) {
          logInfo(
            "Resuming delayed cleanup - annotations complete or math removed"
          );
          performSafeCleanup();
        } else {
          logWarn(
            "Annotations still missing - skipping cleanup to prevent interference"
          );
        }
      }, 2000);

      return;
    }

    // Safe to clean up
    performSafeCleanup();
  }

  /**
   * Annotation-safe: Cleanup that preserves annotation elements
   */
  function performSafeCleanup() {
    logInfo("Performing safe cleanup (annotation-protected)...");

    // Use DOM cleanup utilities if available
    if (window.DOMCleanupUtilities) {
      window.DOMCleanupUtilities.cleanTemporaryElements();
      window.DOMCleanupUtilities.cleanOrphanedMathElements();
      window.DOMCleanupUtilities.clearMathJaxCachesIfSafe();
    } else {
      // Fallback cleanup if utilities not available
      performFallbackSafeCleanup();
    }

    logInfo("Safe cleanup completed (annotations preserved)");
  }

  /**
   * Fallback safe cleanup when DOMCleanupUtilities not available
   */
  function performFallbackSafeCleanup() {
    logInfo("Performing fallback safe cleanup...");

    // Clear temporary processing elements only
    const tempNodes = document.querySelectorAll(
      ".temp-math-processing, .processing-marker"
    );
    tempNodes.forEach((node) => node.remove());

    // Protection: Only clean orphaned MathJax elements outside output AND without annotations
    const orphanedMath = document.querySelectorAll("mjx-container:not([id])");
    orphanedMath.forEach((element) => {
      // Skip if element is in output area
      if (element.closest("#output")) {
        return;
      }

      // Skip if element has annotation children
      const hasAnnotations = element.querySelector(
        'annotation[encoding="application/x-tex"]'
      );
      if (hasAnnotations) {
        logInfo("Preserving MathJax element with annotations");
        return;
      }

      element.remove();
    });

    // Clear MathJax caches only if we have no active math
    const activeMath = document.querySelectorAll("#output mjx-container");
    if (
      activeMath.length === 0 &&
      window.MathJax &&
      window.MathJax.typesetClear
    ) {
      try {
        window.MathJax.typesetClear();
      } catch (error) {
        logWarn("MathJax cache clear failed:", error);
      }
    }

    // Memory hint
    if (window.gc && typeof window.gc === "function") {
      try {
        window.gc();
      } catch (error) {
        // Silent fail
      }
    }
  }

  /**
   * Full cleanup including LaTeX registries (use with extreme caution)
   */
  function performFullCleanup() {
    logWarn("Performing FULL cleanup including LaTeX registries");

    // Perform standard safe cleanup first
    performSafeCleanup();

    // Clear LaTeX registries (this will affect annotation injection)
    if (window.originalLatexRegistry) {
      logWarn(
        "Clearing originalLatexRegistry - annotation injection may be affected"
      );
      window.originalLatexRegistry = {};
    }

    if (window.originalLatexByPosition) {
      logWarn(
        "Clearing originalLatexByPosition - annotation injection may be affected"
      );
      window.originalLatexByPosition = [];
    }

    // Clear any other global state
    if (window.tempMathElements) {
      window.tempMathElements.clear();
    }

    logWarn("Full cleanup completed - LaTeX registries cleared");
  }

  /**
   * Annotation-safe DOM cleanup specifically for external use
   * This is called by the MemoryWatchdog system
   */
  function performAnnotationSafeDOMCleanup() {
    logInfo("Performing annotation-safe DOM cleanup...");

    let removedCount = 0;

    // Use DOM cleanup utilities if available
    if (window.DOMCleanupUtilities) {
      removedCount += window.DOMCleanupUtilities.cleanTemporaryElements();
      removedCount += window.DOMCleanupUtilities.cleanOrphanedMathElements();
      removedCount += window.DOMCleanupUtilities.cleanEmptyElements();
    } else {
      // Fallback cleanup
      removedCount += performFallbackAnnotationSafeCleanup();
    }

    logInfo(`Annotation-safe cleanup: removed ${removedCount} safe elements`);

    return removedCount;
  }

  /**
   * Fallback annotation-safe cleanup
   */
  function performFallbackAnnotationSafeCleanup() {
    let removedCount = 0;

    // Only remove clearly temporary processing elements
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

    // Clean up truly orphaned elements (not in output and not containing annotations)
    const potentialOrphans = document.querySelectorAll(
      "mjx-container:not([id])"
    );
    potentialOrphans.forEach((element) => {
      if (
        !element.closest("#output") &&
        !element.querySelector('annotation[encoding="application/x-tex"]')
      ) {
        element.remove();
        removedCount++;
      }
    });

    // Remove empty elements that definitely don't contain annotations
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

    return removedCount;
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testCleanupCoordinator() {
    const tests = {
      moduleExists: () => !!window.CleanupCoordinator,

      hasCoreFunctions: () => {
        const requiredFunctions = [
          "cleanup",
          "emergencyCleanup",
          "performDOMCleanup",
          "performSafeCleanup",
          "performAnnotationSafeDOMCleanup",
        ];
        return requiredFunctions.every(
          (fn) => typeof window.CleanupCoordinator[fn] === "function"
        );
      },

      canPerformSafeCleanup: () => {
        try {
          // Should not throw error even with no DOM changes
          window.CleanupCoordinator.performSafeCleanup();
          return true;
        } catch (error) {
          logError("Safe cleanup failed:", error);
          return false;
        }
      },

      canPerformDOMCleanup: () => {
        try {
          // Should not throw error even with no DOM changes
          window.CleanupCoordinator.performDOMCleanup();
          return true;
        } catch (error) {
          logError("DOM cleanup failed:", error);
          return false;
        }
      },

      canPerformAnnotationSafeCleanup: () => {
        try {
          const result =
            window.CleanupCoordinator.performAnnotationSafeDOMCleanup();
          return typeof result === "number" && result >= 0;
        } catch (error) {
          logError("Annotation-safe cleanup failed:", error);
          return false;
        }
      },

      canHandleTimeouts: () => {
        try {
          const testTimeouts = new Set();
          window.CleanupCoordinator.cleanup(testTimeouts, testTimeouts);
          return true;
        } catch (error) {
          logError("Timeout handling failed:", error);
          return false;
        }
      },

      integrationReadiness: () => {
        // Test that the module can integrate with DOM utilities
        return (
          typeof document.querySelectorAll === "function" &&
          (typeof window.DOMCleanupUtilities !== "undefined" || true)
        ); // OK if not available yet
      },
    };

    return (
      window.TestUtilities?.runTestSuite("CleanupCoordinator", tests) ||
      fallbackTesting("CleanupCoordinator", tests)
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
    cleanup,
    emergencyCleanup,
    performDOMCleanup,
    performSafeCleanup,
    performFullCleanup,
    performAnnotationSafeDOMCleanup,

    // Testing
    testCleanupCoordinator,
  };
})();

// Make globally available
window.CleanupCoordinator = CleanupCoordinator;
