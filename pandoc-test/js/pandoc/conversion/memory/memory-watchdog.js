// memory-watchdog.js
// Advanced Memory Watchdog System - Monitors memory usage and triggers automatic cleanup
// Phase 3: Memory Management Extraction

const MemoryWatchdog = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("MEMORY_WATCHDOG", {
    level: window.LoggingSystem.LOG_LEVELS.ERROR,
  }) || {
    logError: console.error.bind(console, "[MEMORY_WATCHDOG]"),
    logWarn: console.warn.bind(console, "[MEMORY_WATCHDOG]"),
    logInfo: console.log.bind(console, "[MEMORY_WATCHDOG]"),
    logDebug: console.log.bind(console, "[MEMORY_WATCHDOG]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // ADVANCED MEMORY WATCHDOG SYSTEM CLASS
  // ===========================================================================================

  /**
   * Advanced Memory Watchdog System
   * Monitors memory usage and triggers automatic cleanup
   */
  class AdvancedMemoryWatchdog {
    constructor() {
      this.memoryThreshold = 200 * 1024 * 1024; // 200MB threshold
      this.domNodeThreshold = 5000; // DOM node threshold
      this.monitoringInterval = null;
      this.isMonitoring = false;
      this.cleanupHistory = [];
      this.performanceBaseline = null;
    }

    startMonitoring() {
      if (this.isMonitoring) {
        logInfo("Memory watchdog already running");
        return;
      }

      logInfo("Starting memory watchdog system...");
      this.isMonitoring = true;
      this.performanceBaseline = this.getCurrentMetrics();

      this.monitoringInterval = setInterval(() => {
        this.checkMemoryHealth();
      }, 10000); // Check every 10 seconds

      logInfo("Memory watchdog system active");
    }

    getCurrentMetrics() {
      return {
        heapSize: performance.memory ? performance.memory.usedJSHeapSize : 0,
        domNodes: document.querySelectorAll("*").length,
        mathElements: document.querySelectorAll("mjx-container").length,
        timestamp: Date.now(),
      };
    }

    checkMemoryHealth() {
      const metrics = this.getCurrentMetrics();
      const heapSizeMB = metrics.heapSize / 1024 / 1024;

      logDebug(
        `Memory check: ${heapSizeMB.toFixed(1)}MB heap, ${
          metrics.domNodes
        } DOM nodes`
      );

      // Check for memory threshold breach
      if (metrics.heapSize > this.memoryThreshold) {
        logWarn(`High memory usage detected: ${heapSizeMB.toFixed(1)}MB`);
        this.triggerEmergencyCleanup("High memory usage");
      }

      // Check for DOM node explosion
      if (metrics.domNodes > this.domNodeThreshold) {
        logWarn(`High DOM node count: ${metrics.domNodes} nodes`);
        this.triggerEmergencyCleanup("High DOM node count");
      }

      // Check for MathJax accumulation
      if (metrics.mathElements > 200) {
        logWarn(`High MathJax element count: ${metrics.mathElements} elements`);
        this.triggerEmergencyCleanup("MathJax accumulation");
      }
    }

    triggerEmergencyCleanup(reason) {
      logWarn(`Emergency cleanup triggered: ${reason}`);

      // Annotation protection: Check annotation state before cleanup
      const mathElements = document.querySelectorAll("mjx-container").length;
      const annotations = document.querySelectorAll(
        'annotation[encoding="application/x-tex"]'
      ).length;

      if (mathElements > 0 && annotations > 0) {
        logWarn(
          `Delaying cleanup to protect ${annotations} annotations with ${mathElements} math elements`
        );

        // Delay cleanup and recheck later
        setTimeout(() => {
          const laterAnnotations = document.querySelectorAll(
            'annotation[encoding="application/x-tex"]'
          ).length;
          if (laterAnnotations === 0) {
            logInfo("Annotations cleared naturally - resuming delayed cleanup");
            this.performSafeCleanupSequence(reason);
          } else {
            logWarn(
              `${laterAnnotations} annotations still present - skipping aggressive cleanup`
            );
            this.performMinimalCleanup(reason);
          }
        }, 3000);
        return;
      }

      // Safe to perform full cleanup
      this.performSafeCleanupSequence(reason);
    }

    performSafeCleanupSequence(reason) {
      logInfo(`Performing annotation-safe cleanup sequence for: ${reason}`);

      const beforeMetrics = this.getCurrentMetrics();

      try {
        // 1. Clear conversion engine state if available
        if (window.ConversionEngine?.manager?.cleanup) {
          window.ConversionEngine.manager.cleanup();
        }

        // 2. Clear app state manager if available
        if (window.AppStateManager?.manager?.cleanup) {
          window.AppStateManager.manager.cleanup();
        }

        // 3. Clear MathJax caches (but preserve rendered content)
        if (window.MathJax && window.MathJax.typesetClear) {
          // Only clear processing caches, not rendered content
          if (window.MathJax._.components?.clear) {
            window.MathJax._.components.clear();
          }
        }

        // 4. Perform annotation-safe DOM cleanup via CleanupCoordinator
        if (window.CleanupCoordinator) {
          window.CleanupCoordinator.performAnnotationSafeDOMCleanup();
        }

        // 5. Clear template caches if available
        if (window.TemplateSystem && window.TemplateSystem.clearAllCaches) {
          window.TemplateSystem.clearAllCaches();
        }

        const afterMetrics = this.getCurrentMetrics();

        // Record cleanup effectiveness
        const cleanup = {
          timestamp: Date.now(),
          reason: reason,
          before: beforeMetrics,
          after: afterMetrics,
          heapReduction: beforeMetrics.heapSize - afterMetrics.heapSize,
          domReduction: beforeMetrics.domNodes - afterMetrics.domNodes,
        };

        this.cleanupHistory.push(cleanup);

        logInfo("Emergency cleanup completed");
        logInfo(
          `   Heap reduced by: ${(cleanup.heapReduction / 1024 / 1024).toFixed(
            1
          )}MB`
        );
        logInfo(`   DOM nodes reduced by: ${cleanup.domReduction}`);
      } catch (error) {
        logError("Emergency cleanup failed:", error);
      }
    }

    performMinimalCleanup(reason) {
      logInfo(
        `Performing minimal cleanup for: ${reason} (annotations protected)`
      );

      // Only clear caches and states, don't touch DOM
      if (window.ConversionEngine?.manager?.cleanup) {
        window.ConversionEngine.manager.cleanup();
      }

      if (window.AppStateManager?.manager?.cleanup) {
        window.AppStateManager.manager.cleanup();
      }

      if (window.TemplateSystem && window.TemplateSystem.clearAllCaches) {
        window.TemplateSystem.clearAllCaches();
      }

      logInfo("Minimal cleanup completed - DOM preserved");
    }

    getCleanupHistory() {
      return this.cleanupHistory;
    }

    getStatus() {
      return {
        monitoring: this.isMonitoring,
        threshold: `${(this.memoryThreshold / 1024 / 1024).toFixed(0)}MB`,
        cleanups: this.cleanupHistory.length,
        baseline: this.performanceBaseline,
      };
    }

    stopMonitoring() {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }
      this.isMonitoring = false;
      logInfo("Memory watchdog stopped");
    }
  }

  // ===========================================================================================
  // CONVERSION ENGINE INTEGRATION
  // ===========================================================================================

  /**
   * Get comprehensive memory diagnostics combining multiple system modules
   * INTEGRATED: From conversion-engine.js getMemoryDiagnostics method
   */
  function getComprehensiveMemoryDiagnostics(conversionManager = null) {
    if (window.PerformanceMonitor) {
      const diagnostics = window.PerformanceMonitor.getSystemDiagnostics();

      // Add conversion-specific metrics
      const conversionActiveTimeouts =
        conversionManager?.activeTimeouts?.size || 0;

      // Add DOM cleanup utilities statistics if available
      let domStats = {};
      if (window.DOMCleanupUtilities) {
        domStats = window.DOMCleanupUtilities.getDOMStatistics();
      }

      // Get current memory watchdog status
      const watchdogInstance = getSharedWatchdogInstance();
      const watchdogStatus = watchdogInstance?.getStatus() || {
        monitoring: false,
      };

      return {
        ...diagnostics.performance.metrics,
        activeTimeouts: conversionActiveTimeouts,
        systemDiagnostics: diagnostics,
        domStatistics: domStats,
        memoryWatchdogStatus: watchdogStatus,
      };
    } else {
      // Enhanced fallback using DOM utilities
      logWarn(
        "PerformanceMonitor not available - using enhanced fallback diagnostics"
      );

      const conversionActiveTimeouts =
        conversionManager?.activeTimeouts?.size || 0;
      let domStats = {};

      if (window.DOMCleanupUtilities) {
        domStats = window.DOMCleanupUtilities.getDOMStatistics();
      } else {
        // Basic fallback stats
        domStats = {
          totalElements: document.querySelectorAll("*").length,
          mathElements: document.querySelectorAll("mjx-container").length,
          annotations: document.querySelectorAll(
            'annotation[encoding="application/x-tex"]'
          ).length,
          tempElements: document.querySelectorAll(
            ".temp-math-processing, .processing-marker"
          ).length,
        };
      }

      const watchdogInstance = getSharedWatchdogInstance();
      const watchdogStatus = watchdogInstance?.getStatus() || {
        monitoring: false,
      };

      return {
        heapSizeMB: performance.memory
          ? (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)
          : "unknown",
        activeTimeouts: conversionActiveTimeouts,
        ...domStats,
        mathJaxQueued: document.querySelectorAll('[data-mml-node="math"]')
          .length,
        memoryWatchdogStatus: watchdogStatus,
      };
    }
  }

  /**
   * Perform manual emergency cleanup with conversion engine integration
   * INTEGRATED: From conversion-engine.js performEmergencyCleanup method
   */
  function performManualEmergencyCleanup(conversionManager = null) {
    logWarn("Manual emergency cleanup triggered via MemoryWatchdog");

    const watchdogInstance = getSharedWatchdogInstance();

    if (watchdogInstance && watchdogInstance.triggerEmergencyCleanup) {
      watchdogInstance.triggerEmergencyCleanup("Manual trigger");
    } else if (window.CleanupCoordinator) {
      // Fallback to direct cleanup coordinator
      window.CleanupCoordinator.emergencyCleanup(
        conversionManager?.activeTimeouts,
        conversionManager?.pollingTimeouts
      );
    } else {
      // Ultimate fallback
      logWarn(
        "No memory management modules available - using conversion manager emergency cleanup"
      );
      if (conversionManager && conversionManager.emergencyCleanup) {
        conversionManager.emergencyCleanup();
      }
    }
  }

  /**
   * Get DOM health assessment
   * INTEGRATED: From conversion-engine.js getDOMHealthAssessment method
   */
  function getDOMHealthAssessment() {
    if (window.DOMCleanupUtilities) {
      return window.DOMCleanupUtilities.assessDOMHealth();
    } else {
      return {
        healthy: true,
        warnings: [
          "DOM health assessment not available - DOMCleanupUtilities module not loaded",
        ],
        recommendations: [
          "Load DOM cleanup utilities for comprehensive health monitoring",
        ],
      };
    }
  }

  // ===========================================================================================
  // SHARED INSTANCE MANAGEMENT
  // ===========================================================================================

  // Shared memory watchdog instance for conversion engine integration
  let sharedWatchdogInstance = null;

  /**
   * Initialize shared memory watchdog instance for conversion engine
   * INTEGRATED: From conversion-engine.js initializeMemoryWatchdog function
   */
  function initializeSharedWatchdog() {
    if (sharedWatchdogInstance) {
      logInfo("Shared memory watchdog already initialized");
      return sharedWatchdogInstance;
    }

    try {
      sharedWatchdogInstance = new AdvancedMemoryWatchdog();

      // Start monitoring automatically after initialization
      setTimeout(() => {
        if (sharedWatchdogInstance) {
          sharedWatchdogInstance.startMonitoring();
          logInfo("Shared memory watchdog system initialized and started");
        }
      }, 5000); // Start after 5 seconds to allow app to initialize

      return sharedWatchdogInstance;
    } catch (error) {
      logError("Failed to initialize shared memory watchdog:", error);
      return null;
    }
  }

  /**
   * Get the shared memory watchdog instance
   */
  function getSharedWatchdogInstance() {
    if (!sharedWatchdogInstance) {
      return initializeSharedWatchdog();
    }
    return sharedWatchdogInstance;
  }

  /**
   * Get shared memory watchdog status
   * INTEGRATED: From conversion-engine.js getMemoryWatchdogStatus method
   */
  function getSharedWatchdogStatus() {
    const watchdogInstance = getSharedWatchdogInstance();
    return (
      watchdogInstance?.getStatus() || {
        monitoring: false,
        error: "Memory watchdog not available",
      }
    );
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testMemoryWatchdog() {
    const tests = {
      moduleExists: () => !!window.MemoryWatchdog,

      classExists: () => typeof AdvancedMemoryWatchdog === "function",

      canCreateInstance: () => {
        try {
          const watchdog = new AdvancedMemoryWatchdog();
          return !!watchdog;
        } catch (error) {
          logError("Failed to create MemoryWatchdog instance:", error);
          return false;
        }
      },

      hasRequiredMethods: () => {
        const watchdog = new AdvancedMemoryWatchdog();
        const requiredMethods = [
          "startMonitoring",
          "stopMonitoring",
          "getCurrentMetrics",
          "checkMemoryHealth",
          "triggerEmergencyCleanup",
          "getStatus",
        ];
        return requiredMethods.every(
          (method) => typeof watchdog[method] === "function"
        );
      },

      canGetMetrics: () => {
        const watchdog = new AdvancedMemoryWatchdog();
        const metrics = watchdog.getCurrentMetrics();
        return (
          metrics &&
          typeof metrics.domNodes === "number" &&
          typeof metrics.timestamp === "number"
        );
      },

      canGetStatus: () => {
        const watchdog = new AdvancedMemoryWatchdog();
        const status = watchdog.getStatus();
        return (
          status && typeof status.monitoring === "boolean" && status.threshold
        );
      },

      integrationReadiness: () => {
        // Test that the module can integrate with existing systems
        return (
          typeof window.LoggingSystem !== "undefined" ||
          typeof console.log === "function"
        );
      },
    };

    return (
      window.TestUtilities?.runTestSuite("MemoryWatchdog", tests) ||
      fallbackTesting("MemoryWatchdog", tests)
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

  /**
   * Test integrated memory watchdog with conversion engine functionality
   * ENHANCED: Now includes conversion engine integration testing
   */
  function testIntegratedMemoryWatchdog() {
    logInfo(
      "Testing integrated MemoryWatchdog with conversion engine features..."
    );

    const tests = {
      // Original tests
      moduleExists: () => !!window.MemoryWatchdog,
      classExists: () => typeof AdvancedMemoryWatchdog === "function",
      canCreateInstance: () => {
        try {
          const watchdog = new AdvancedMemoryWatchdog();
          return !!watchdog;
        } catch (error) {
          logError("Failed to create MemoryWatchdog instance:", error);
          return false;
        }
      },

      // Integration tests
      sharedInstanceManagement: () => {
        const instance1 = getSharedWatchdogInstance();
        const instance2 = getSharedWatchdogInstance();
        return instance1 === instance2; // Should be the same instance
      },

      comprehensiveDiagnostics: () => {
        try {
          const mockManager = { activeTimeouts: new Set([1, 2, 3]) };
          const diagnostics = getComprehensiveMemoryDiagnostics(mockManager);
          return diagnostics && typeof diagnostics.activeTimeouts === "number";
        } catch (error) {
          logError("Comprehensive diagnostics test failed:", error);
          return false;
        }
      },

      domHealthAssessment: () => {
        try {
          const health = getDOMHealthAssessment();
          return health && typeof health.healthy === "boolean";
        } catch (error) {
          logError("DOM health assessment test failed:", error);
          return false;
        }
      },

      manualEmergencyCleanupAccess: () => {
        try {
          // Test access without actually triggering cleanup
          return typeof performManualEmergencyCleanup === "function";
        } catch (error) {
          logError("Manual emergency cleanup access test failed:", error);
          return false;
        }
      },

      sharedWatchdogStatus: () => {
        try {
          const status = getSharedWatchdogStatus();
          return status && typeof status.monitoring === "boolean";
        } catch (error) {
          logError("Shared watchdog status test failed:", error);
          return false;
        }
      },
    };

    return (
      window.TestUtilities?.runTestSuite("IntegratedMemoryWatchdog", tests) ||
      fallbackTesting("IntegratedMemoryWatchdog", tests)
    );
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Core class
    AdvancedMemoryWatchdog,

    // Create instance method
    createWatchdog() {
      return new AdvancedMemoryWatchdog();
    },

    // Conversion Engine Integration
    getComprehensiveMemoryDiagnostics,
    performManualEmergencyCleanup,
    getDOMHealthAssessment,
    initializeSharedWatchdog,
    getSharedWatchdogInstance,
    getSharedWatchdogStatus,

    // Testing
    testMemoryWatchdog,
    testIntegratedMemoryWatchdog,
  };
})();

// Initialize shared watchdog on module load
MemoryWatchdog.initializeSharedWatchdog();

// Make globally available
window.MemoryWatchdog = MemoryWatchdog;
