// test-memory-management.js
// Memory Management Testing Module
// Tests memory leak prevention and performance optimisation

const TestMemoryManagement = (function () {
  "use strict";

  // Logging configuration
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
      console.error("[MEMORY-TEST]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[MEMORY-TEST]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[MEMORY-TEST]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[MEMORY-TEST]", message, ...args);
  }

  /**
   * Enhanced memory diagnostic function
   */
  function runMemoryDiagnostics() {
    return (
      window.ConversionEngine?.getMemoryDiagnostics?.() || {
        heapSizeMB: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(
          2
        ),
        domNodes: document.querySelectorAll("*").length,
        mathElements: document.querySelectorAll("mjx-container").length,
        activeTimeouts: 0,
        pollingTimeouts:
          window.AppStateManager?.manager?.pollingTimeouts?.size || 0,
        tempElements: 0,
        mathJaxQueued: 0,
      }
    );
  }

  /**
   * Test memory stress scenarios
   */
  async function testMemoryStress() {
    logInfo("🧪 Starting memory stress test...");

    const initialMetrics = runMemoryDiagnostics();
    logInfo("📊 Initial state:", initialMetrics);

    try {
      // Simulate multiple load/clear cycles
      for (let i = 0; i < 3; i++) {
        logInfo(`🔄 Stress cycle ${i + 1}/3`);

        // Load example if available
        if (window.ExampleSystem?.loadExample) {
          window.ExampleSystem.loadExample("statistics");
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Clear content (simulate deletion)
        const input = document.getElementById("input");
        if (input) {
          input.value = "";
          input.dispatchEvent(new Event("input"));
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      // Trigger cleanup
      if (window.ConversionEngine?.manager?.cleanup) {
        window.ConversionEngine.manager.cleanup();
      }
      if (window.AppStateManager?.manager?.cleanup) {
        window.AppStateManager.manager.cleanup();
      }

      const finalMetrics = runMemoryDiagnostics();
      const growthMB =
        parseFloat(finalMetrics.heapSizeMB) -
        parseFloat(initialMetrics.heapSizeMB);

      logInfo(`📊 Memory growth: ${growthMB.toFixed(1)}MB`);

      return growthMB < 10; // Success if less than 10MB growth
    } catch (error) {
      logError("Memory stress test failed:", error);
      return false;
    }
  }

  /**
   * Test large deletion performance
   */
  async function testLargeDeletionPerformance() {
    logInfo("⚡ Testing large deletion performance...");

    try {
      // Create large content
      const input = document.getElementById("input");
      if (!input) return false;

      const largeContent = "\\section{Test}\n" + "$x = 1$\n".repeat(100);
      input.value = largeContent;
      input.dispatchEvent(new Event("input"));

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Measure deletion
      const startTime = performance.now();
      input.value = "";
      input.dispatchEvent(new Event("input"));

      await new Promise((resolve) => setTimeout(resolve, 1000));
      const endTime = performance.now();

      const deletionTime = endTime - startTime;
      logInfo(`⚡ Deletion time: ${deletionTime.toFixed(0)}ms`);

      return deletionTime < 1000; // Success if under 1 second
    } catch (error) {
      logError("Large deletion test failed:", error);
      return false;
    }
  }

  /**
   * Test memory management functionality
   */
  function testMemoryManagement() {
    logInfo("🧪 Testing Memory Management...");

    const tests = {
      memoryWatchdogExists: () => !!window.ConversionEngine?.memoryWatchdog,

      diagnosticsAvailable: () =>
        !!window.ConversionEngine?.getMemoryDiagnostics,

      cleanupMethodsExist: () => {
        return !!(
          window.ConversionEngine?.manager?.cleanup &&
          window.AppStateManager?.manager?.cleanup
        );
      },

      timeoutTrackingWorks: () => {
        const diagnostics = runMemoryDiagnostics();
        return typeof diagnostics.activeTimeouts === "number";
      },

      domCleanupWorks: () => {
        // Create temporary elements
        const tempDiv = document.createElement("div");
        tempDiv.className = "temp-math-processing";
        document.body.appendChild(tempDiv);

        // Test cleanup
        if (window.ConversionEngine?.manager?.performDOMCleanup) {
          window.ConversionEngine.manager.performDOMCleanup();
        }

        // Check if removed
        const remaining = document.querySelectorAll(".temp-math-processing");
        return remaining.length === 0;
      },

      memoryStressTest: () => testMemoryStress(),

      largeDeletionTest: () => testLargeDeletionPerformance(),
    };

    return TestUtilities.runTestSuite("Memory Management", tests);
  }

  // Global memory commands
  window.memoryCommands = {
    check: () => {
      logInfo("🔍 Quick Memory Check:");
      const metrics = runMemoryDiagnostics();

      const warnings = [];
      if (parseFloat(metrics.heapSizeMB) > 200)
        warnings.push("High heap usage");
      if (metrics.domNodes > 3000) warnings.push("High DOM node count");
      if (metrics.activeTimeouts > 5) warnings.push("Many active timeouts");
      if (metrics.pollingTimeouts > 2)
        warnings.push("Multiple polling timeouts");

      if (warnings.length > 0) {
        logWarn("⚠️ Warnings:", warnings.join(", "));
      } else {
        logInfo("✅ Memory health looks good");
      }

      return metrics;
    },

    clean: () => {
      logInfo("🧹 Performing quick cleanup...");
      const before = runMemoryDiagnostics();

      if (window.ConversionEngine?.manager?.cleanup) {
        window.ConversionEngine.manager.cleanup();
      }
      if (window.AppStateManager?.manager?.cleanup) {
        window.AppStateManager.manager.cleanup();
      }

      const after = runMemoryDiagnostics();
      logInfo("✅ Cleanup completed");
      logInfo(`   Heap: ${before.heapSizeMB}MB → ${after.heapSizeMB}MB`);

      return { before, after };
    },

    stress: () => testMemoryStress(),
    deletion: () => testLargeDeletionPerformance(),
    watchdog: () =>
      window.ConversionEngine?.memoryWatchdog?.getStatus?.() || "Not available",
  };

  return {
    testMemoryManagement,
    runMemoryDiagnostics,
    testMemoryStress,
    testLargeDeletionPerformance,
  };
})();

// Export for testing framework
window.TestMemoryManagement = TestMemoryManagement;

// Export individual functions globally like other test modules
window.testMemoryManagement = TestMemoryManagement.testMemoryManagement;
window.testMemoryStress = TestMemoryManagement.testMemoryStress;
window.testLargeDeletionPerformance =
  TestMemoryManagement.testLargeDeletionPerformance;
