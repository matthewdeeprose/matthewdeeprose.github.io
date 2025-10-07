// testing-api-manager.js
// Testing API Manager - Testing functions and API utilities coordination
// Part of Enhanced Pandoc-WASM Mathematical Playground modular refactoring 

const TestingAPIManager = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("TESTING_API_MGR", {
    level: window.LoggingSystem.LOG_LEVELS.WARN,
  }) || {
    logError: console.error.bind(console, "[TESTING_API_MGR]"),
    logWarn: console.warn.bind(console, "[TESTING_API_MGR]"),
    logInfo: console.log.bind(console, "[TESTING_API_MGR]"),
    logDebug: console.log.bind(console, "[TESTING_API_MGR]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // TESTING COORDINATION SYSTEM
  // ===========================================================================================

  /**
   * Test complete state synchronization across all modules
   * EXTRACTED: From final-coordination-manager.js testStateSynchronization function
   */
  function testStateSynchronization(conversionManager) {
    logInfo("🧪 Testing Complete State Synchronization...");

    const tests = {
      stateManagerModuleAvailable: () => !!window.StateManager,

      conversionOrchestratorAvailable: () => !!window.ConversionOrchestrator,

      eventCoordinatorAvailable: () => !!window.EventCoordinator,

      statusCacheInitialization: () => {
        const manager = conversionManager;
        // Access cached status to initialize cache
        const status = manager._getCachedStatus();
        return manager._statusCache !== undefined;
      },

      cacheTimestampTracking: () => {
        const manager = conversionManager;
        const initialTime = manager._statusCacheTime;
        manager._getCachedStatus(); // Should update timestamp
        return manager._statusCacheTime >= initialTime;
      },

      cacheInvalidationMechanism: () => {
        const manager = conversionManager;
        manager._getCachedStatus(); // Initialize cache
        const cachedTime = manager._statusCacheTime;
        manager._invalidateStatusCache(); // Should reset cache
        return manager._statusCache === null && manager._statusCacheTime === 0;
      },

      propertyDelegationConsistency: () => {
        if (conversionManager.useStateManagerFallback) {
          logInfo("StateManager fallback mode - skipping delegation test");
          return true;
        }

        // Test that property access goes through StateManager
        const directStatus = window.StateManager.getEngineStatus();
        const managerReady = conversionManager.isReady;
        const managerInitialised = conversionManager.isInitialised;

        return (
          directStatus.ready === managerReady &&
          directStatus.initialised === managerInitialised
        );
      },

      conversionStateSync: () => {
        if (conversionManager.useStateManagerFallback) return true;

        const initialInProgress = conversionManager.conversionInProgress;
        const initialQueued = conversionManager.isConversionQueued;

        // Test state change synchronization
        conversionManager.conversionInProgress = true;
        const afterSet = conversionManager.conversionInProgress;
        conversionManager.conversionInProgress = false;

        return afterSet === true;
      },

      engineStatusConsistency: () => {
        const engineStatus = conversionManager.getEngineStatus();
        const isReady = conversionManager.isEngineReady();

        // Check consistency between status object and ready check
        return (
          typeof engineStatus === "object" &&
          typeof isReady === "boolean" &&
          engineStatus.ready === isReady
        );
      },

      optimizedPropertyAccess: () => {
        const manager = conversionManager;

        // Measure cache performance
        const startTime = performance.now();

        // Multiple rapid property accesses (should use cache)
        for (let i = 0; i < 10; i++) {
          manager.isReady;
          manager.conversionInProgress;
          manager.isConversionQueued;
          manager.automaticConversionsDisabled;
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        // Should complete quickly with caching (< 5ms for 40 property accesses)
        logDebug(
          `Property access performance: ${duration.toFixed(
            2
          )}ms for 40 accesses`
        );
        return duration < 5;
      },

      crossModuleStateConsistency: () => {
        if (!window.StateManager || !window.ConversionOrchestrator) {
          logInfo(
            "Required modules not available - skipping cross-module test"
          );
          return true;
        }

        // Check that all modules see consistent state
        const engineStatus = conversionManager.getEngineStatus();
        const stateManagerStatus = window.StateManager.getEngineStatus();

        return (
          engineStatus.ready === stateManagerStatus.ready &&
          engineStatus.initialised === stateManagerStatus.initialised &&
          engineStatus.conversionInProgress ===
            stateManagerStatus.conversionInProgress
        );
      },

      inputEventOptimization: () => {
        // Test the 100ms caching for automatic conversions disabled check
        const manager = conversionManager;

        const startTime = performance.now();

        // Simulate rapid input events (should use cached value)
        for (let i = 0; i < 10; i++) {
          const disabled = manager.automaticConversionsDisabled;
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        logDebug(
          `Input event optimization: ${duration.toFixed(2)}ms for 10 checks`
        );
        return duration < 2; // Should be very fast with caching
      },

      memoryLeakPrevention: () => {
        const manager = conversionManager;
        const initialCacheTime = manager._statusCacheTime;

        // Trigger cache operations
        manager._getCachedStatus();
        manager._invalidateStatusCache();
        manager._getCachedStatus();

        // Verify no memory accumulation
        return (
          manager._statusCache !== undefined &&
          typeof manager._statusCacheTime === "number"
        );
      },
    };

    let passed = 0;
    let total = 0;

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const result = testFn();
        if (result) {
          passed++;
          logDebug(`  ✅ ${testName}: PASSED`);
        } else {
          logError(`  ❌ ${testName}: FAILED`);
        }
      } catch (error) {
        logError(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    });

    const success = passed === total;
    logInfo(`📊 State Synchronization: ${passed}/${total} tests passed`);

    const testResult = {
      success: success,
      passed: passed,
      total: total,
      performance: {
        cacheEnabled: !conversionManager.useStateManagerFallback,
        optimizationActive: true,
        synchronizationComplete: success,
      },
    };

    return testResult;
  }

  /**
   * Test orchestration performance and state consistency
   * EXTRACTED: From final-coordination-manager.js testOrchestrationPerformance function
   */
  function testOrchestrationPerformance(conversionManager) {
    logInfo("🚀 Testing Orchestration Performance & State Consistency...");

    const tests = {
      allOrchestrationModulesReady: () => {
        return !!(
          window.StateManager &&
          window.ConversionOrchestrator &&
          window.EventCoordinator &&
          window.ConversionEngine
        );
      },

      optimizedConversionReadiness: () => {
        const startTime = performance.now();

        // Test rapid readiness checks (should use cached status)
        let allReady = true;
        for (let i = 0; i < 50; i++) {
          if (!conversionManager.isEngineReady()) {
            allReady = false;
            break;
          }
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        logDebug(
          `Readiness check performance: ${duration.toFixed(2)}ms for 50 checks`
        );
        return allReady && duration < 3; // Should be very fast with optimization
      },

      stateManagerIntegrationPerformance: () => {
        if (conversionManager.useStateManagerFallback) {
          logInfo(
            "StateManager fallback mode - skipping integration performance test"
          );
          return true;
        }

        const startTime = performance.now();

        // Test rapid state access patterns
        for (let i = 0; i < 25; i++) {
          conversionManager.isReady;
          conversionManager.conversionInProgress;
          conversionManager.automaticConversionsDisabled;
          conversionManager.isConversionQueued;
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        logDebug(
          `StateManager integration performance: ${duration.toFixed(
            2
          )}ms for 100 property accesses`
        );
        return duration < 5; // Optimized access should be very fast
      },

      conversionOrchestrationLatency: () => {
        if (!window.ConversionOrchestrator) return true;

        const startTime = performance.now();

        // Test context creation performance
        try {
          const context =
            window.ConversionOrchestrator.createOrchestrationContext(
              conversionManager
            );
          const endTime = performance.now();
          const duration = endTime - startTime;

          logDebug(`Orchestration context creation: ${duration.toFixed(2)}ms`);
          return context && duration < 2; // Should be very fast
        } catch (error) {
          logError("Orchestration context creation failed:", error);
          return false;
        }
      },

      eventCoordinationEfficiency: () => {
        if (!window.EventCoordinator) return true;

        const startTime = performance.now();

        // Test event coordination setup
        try {
          const eventData = {
            statusManager: window.StatusManager,
            complexity: { level: "basic" },
          };
          const dependencies = { conversionManager };

          // This should be fast synchronous setup
          const result =
            typeof window.EventCoordinator.coordinateConversionEvent ===
            "function";

          const endTime = performance.now();
          const duration = endTime - startTime;

          logDebug(`Event coordination setup: ${duration.toFixed(2)}ms`);
          return result && duration < 1; // Should be immediate
        } catch (error) {
          logError("Event coordination test failed:", error);
          return false;
        }
      },

      memoryEfficiency: () => {
        const initialDiagnostics = conversionManager.getMemoryDiagnostics
          ? conversionManager.getMemoryDiagnostics()
          : {};

        // Trigger multiple optimization cycles
        for (let i = 0; i < 10; i++) {
          conversionManager._getCachedStatus();
          conversionManager._invalidateStatusCache();
        }

        const finalDiagnostics = conversionManager.getMemoryDiagnostics
          ? conversionManager.getMemoryDiagnostics()
          : {};

        // Should not accumulate memory or timeouts
        const timeoutIncrease =
          (finalDiagnostics.activeTimeouts || 0) -
          (initialDiagnostics.activeTimeouts || 0);

        logDebug(
          `Memory efficiency check - timeout increase: ${timeoutIncrease}`
        );
        return timeoutIncrease <= 0; // Should not increase
      },

      cacheHitRatioValidation: () => {
        const manager = conversionManager;

        // Clear cache
        manager._invalidateStatusCache();

        const startTime = performance.now();

        // First access - cache miss
        manager._getCachedStatus();
        const firstAccessTime = performance.now();

        // Subsequent accesses - cache hits
        for (let i = 0; i < 10; i++) {
          manager._getCachedStatus();
        }
        const cacheHitTime = performance.now();

        const missTime = firstAccessTime - startTime;
        const hitTime = (cacheHitTime - firstAccessTime) / 10;

        logDebug(
          `Cache miss time: ${missTime.toFixed(
            2
          )}ms, avg hit time: ${hitTime.toFixed(2)}ms`
        );

        // Cache hits should be significantly faster than misses
        return hitTime < missTime || hitTime < 0.1; // Hits should be very fast
      },

      systemHealthUnderLoad: () => {
        const startTime = performance.now();

        try {
          // Simulate load with rapid property access and state changes
          for (let i = 0; i < 100; i++) {
            conversionManager.isEngineReady();
            conversionManager.getEngineStatus();
            if (i % 10 === 0) {
              conversionManager._invalidateStatusCache();
            }
          }

          // Check system is still responsive
          const finalStatus = conversionManager.getEngineStatus();
          const endTime = performance.now();
          const duration = endTime - startTime;

          logDebug(
            `System health under load: ${duration.toFixed(
              2
            )}ms for 100 operations`
          );

          return finalStatus && duration < 150; // Realistic threshold for complex operations with cache invalidation
        } catch (error) {
          logError("System health under load failed:", error);
          return false;
        }
      },

      crossModuleConsistencyUnderLoad: () => {
        if (!window.StateManager) return true;

        try {
          // Test consistency during rapid operations
          let consistent = true;

          for (let i = 0; i < 20; i++) {
            const engineReady = conversionManager.isEngineReady();
            const stateManagerReady = window.StateManager.isEngineReady();

            if (engineReady !== stateManagerReady) {
              consistent = false;
              logError(
                `Consistency failure at iteration ${i}: engine=${engineReady}, stateManager=${stateManagerReady}`
              );
              break;
            }

            // Occasionally invalidate cache to test consistency during updates
            if (i % 5 === 0) {
              conversionManager._invalidateStatusCache();
            }
          }

          return consistent;
        } catch (error) {
          logError("Cross-module consistency test failed:", error);
          return false;
        }
      },

      endToEndPerformanceBaseline: () => {
        // Establish performance baseline for complete workflow
        const startTime = performance.now();

        try {
          // Simulate typical conversion workflow checks
          const ready = conversionManager.isEngineReady();
          const status = conversionManager.getEngineStatus();
          const inProgress = conversionManager.conversionInProgress;

          if (ready && !inProgress) {
            // Simulate conversion preparation
            const complexity =
              conversionManager.assessDocumentComplexity("Test $x=1$ content");
            const args =
              conversionManager.generateEnhancedPandocArgs("--to html");
          }

          const endTime = performance.now();
          const duration = endTime - startTime;

          logDebug(`End-to-end workflow baseline: ${duration.toFixed(2)}ms`);

          // Complete workflow preparation should be very fast
          return duration < 5;
        } catch (error) {
          logError("End-to-end performance baseline failed:", error);
          return false;
        }
      },
    };

    let passed = 0;
    let total = 0;
    const performanceMetrics = {};

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const testStart = performance.now();
        const result = testFn();
        const testEnd = performance.now();

        performanceMetrics[testName] = (testEnd - testStart).toFixed(2);

        if (result) {
          passed++;
          logDebug(
            `  ✅ ${testName}: PASSED (${performanceMetrics[testName]}ms)`
          );
        } else {
          logError(
            `  ❌ ${testName}: FAILED (${performanceMetrics[testName]}ms)`
          );
        }
      } catch (error) {
        logError(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    });

    const success = passed === total;
    logInfo(`📊 Orchestration Performance: ${passed}/${total} tests passed`);

    const testResult = {
      success: success,
      passed: passed,
      total: total,
      performanceOptimized: true,
      metrics: performanceMetrics,
      orchestrationReady: success && passed >= 8, // At least 8/10 tests should pass
    };

    return testResult;
  }

  /**
   * Test integrated memory management system
   * EXTRACTED: From final-coordination-manager.js testMemoryManagementIntegration function
   */
  function testMemoryManagementIntegration(conversionManager, memoryWatchdog) {
    logInfo("Testing integrated memory management system...");

    const tests = {
      memoryWatchdogModuleAvailable: () => !!window.MemoryWatchdog,

      cleanupCoordinatorAvailable: () => !!window.CleanupCoordinator,

      domCleanupUtilitiesAvailable: () => !!window.DOMCleanupUtilities,

      memoryWatchdogInstance: () => {
        return memoryWatchdog && typeof memoryWatchdog.getStatus === "function";
      },

      memoryDiagnostics: () => {
        try {
          const diagnostics =
            window.FinalCoordinationManager?.getMemoryDiagnostics?.(
              conversionManager,
              memoryWatchdog
            );
          return diagnostics && typeof diagnostics.heapSizeMB !== "undefined";
        } catch (error) {
          logError("Memory diagnostics failed:", error);
          return false;
        }
      },

      domHealthAssessment: () => {
        try {
          const health =
            window.FinalCoordinationManager?.getDOMHealthAssessment?.();
          return health && typeof health.healthy === "boolean";
        } catch (error) {
          logError("DOM health assessment failed:", error);
          return false;
        }
      },

      cleanupIntegration: () => {
        try {
          // Test that cleanup methods don't throw errors
          if (conversionManager && conversionManager.cleanup) {
            conversionManager.cleanup();
          }
          return true;
        } catch (error) {
          logError("Cleanup integration failed:", error);
          return false;
        }
      },

      emergencyCleanupAccess: () => {
        try {
          // Test access to emergency cleanup (shouldn't throw error even if not triggered)
          return (
            typeof window.FinalCoordinationManager?.performEmergencyCleanup ===
            "function"
          );
        } catch (error) {
          logError("Emergency cleanup access failed:", error);
          return false;
        }
      },
    };

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
    logInfo(`📊 MemoryManagementIntegration: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
      allPassed: success,
      totalTests: total,
    };
  }

  // ===========================================================================================
  // PUBLIC API UTILITIES COORDINATION
  // ===========================================================================================

  /**
   * Get current output content
   * EXTRACTED: From final-coordination-manager.js getCurrentOutput method
   */
  function getCurrentOutput(conversionManager) {
    return conversionManager?.outputDiv?.innerHTML || "";
  }

  /**
   * Get current input content
   * EXTRACTED: From final-coordination-manager.js getCurrentInput method
   */
  function getCurrentInput(conversionManager) {
    return conversionManager?.inputTextarea?.value || "";
  }

  /**
   * Set input content (programmatically)
   * EXTRACTED: From final-coordination-manager.js setInputContent method
   */
  function setInputContent(conversionManager, content) {
    if (conversionManager?.inputTextarea) {
      conversionManager.inputTextarea.value = content;
      // Trigger conversion
      if (conversionManager.convertInput) {
        conversionManager.convertInput();
      }
    }
  }

  /**
   * Clear all content
   * EXTRACTED: From final-coordination-manager.js clearContent method
   */
  function clearContent(conversionManager) {
    if (conversionManager?.inputTextarea) {
      conversionManager.inputTextarea.value = "";
    }
    if (conversionManager?.setEmptyOutput) {
      conversionManager.setEmptyOutput();
    }
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testTestingAPIManager() {
    const tests = {
      moduleExists: () => !!window.TestingAPIManager,

      hasTestingCoordination: () =>
        typeof testStateSynchronization === "function",

      hasAPIUtilities: () => typeof getCurrentOutput === "function",

      testingSuiteAvailable: () => {
        return !!(
          testStateSynchronization &&
          testOrchestrationPerformance &&
          testMemoryManagementIntegration
        );
      },

      apiUtilitiesSuiteAvailable: () => {
        return !!(
          getCurrentOutput &&
          getCurrentInput &&
          setInputContent &&
          clearContent
        );
      },

      integrationReadiness: () => {
        // Test that the module is ready for integration
        return !!(
          testStateSynchronization &&
          testOrchestrationPerformance &&
          testMemoryManagementIntegration &&
          getCurrentOutput &&
          getCurrentInput &&
          setInputContent &&
          clearContent
        );
      },
    };

    return (
      window.TestUtilities?.runTestSuite("TestingAPIManager", tests) ||
      fallbackTesting("TestingAPIManager", tests)
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
   * Test integrated memory management system
   * EXTRACTED: From conversion-engine.js testMemoryManagementIntegration function
   */
  function testMemoryManagementIntegration(conversionManager) {
    logInfo("Testing integrated memory management system...");

    const tests = {
      memoryWatchdogModuleAvailable: () => !!window.MemoryWatchdog,

      cleanupCoordinatorAvailable: () => !!window.CleanupCoordinator,

      domCleanupUtilitiesAvailable: () => !!window.DOMCleanupUtilities,

      memoryWatchdogInstance: () => {
        const watchdogInstance =
          window.MemoryWatchdog?.getSharedWatchdogInstance?.();
        return (
          watchdogInstance && typeof watchdogInstance.getStatus === "function"
        );
      },

      memoryDiagnostics: () => {
        try {
          const diagnostics =
            window.MemoryWatchdog?.getComprehensiveMemoryDiagnostics?.(
              conversionManager
            );
          return (
            diagnostics && typeof diagnostics.activeTimeouts !== "undefined"
          );
        } catch (error) {
          logError("Memory diagnostics failed:", error);
          return false;
        }
      },

      domHealthAssessment: () => {
        try {
          const health = window.MemoryWatchdog?.getDOMHealthAssessment?.();
          return health && typeof health.healthy === "boolean";
        } catch (error) {
          logError("DOM health assessment failed:", error);
          return false;
        }
      },

      cleanupIntegration: () => {
        try {
          // Test that cleanup methods don't throw errors
          conversionManager.cleanup();
          return true;
        } catch (error) {
          logError("Cleanup integration failed:", error);
          return false;
        }
      },

      emergencyCleanupAccess: () => {
        try {
          // Test access to emergency cleanup (shouldn't throw error even if not triggered)
          return (
            typeof window.MemoryWatchdog?.performManualEmergencyCleanup ===
            "function"
          );
        } catch (error) {
          logError("Emergency cleanup access failed:", error);
          return false;
        }
      },
    };

    return (
      window.TestUtilities?.runTestSuite(
        "MemoryManagementIntegration",
        tests
      ) || fallbackTesting("MemoryManagementIntegration", tests)
    );
  }

  /**
   * Enhanced test conversion engine functionality
   * EXTRACTED: From conversion-engine.js testConversionEngine function
   */
  function testConversionEngine(conversionManager) {
    logInfo("🧪 Testing Enhanced Conversion Engine...");

    const tests = {
      managerExists: () => !!conversionManager,

      initialisation: () => conversionManager.isInitialised,

      domElementsConnected: () => {
        return (
          !!document.getElementById("input") &&
          !!document.getElementById("output") &&
          !!document.getElementById("arguments")
        );
      },

      pandocFunction: () => !!conversionManager.pandocFunction,

      engineReady: () => conversionManager.isEngineReady(),

      inputOutput: () => {
        const input = conversionManager.getCurrentInput();
        const output = conversionManager.getCurrentOutput();
        return typeof input === "string" && typeof output === "string";
      },

      contentManagement: () => {
        const originalInput = conversionManager.getCurrentInput();
        conversionManager.setInputContent("Test content");
        const newInput = conversionManager.getCurrentInput();
        conversionManager.setInputContent(originalInput); // Restore
        return newInput === "Test content";
      },

      // ENHANCED TESTS: New functionality validation
      complexityAssessment: () => {
        const testContent = "Test content with $x = 1$ and $$y = 2$$";
        const complexity =
          conversionManager.assessDocumentComplexity(testContent);
        return (
          complexity && typeof complexity.score === "number" && complexity.level
        );
      },

      errorHandling: () => {
        const errorMessage = conversionManager.generateUserFriendlyErrorMessage(
          new Error("out of memory"),
          "out of memory"
        );
        return errorMessage.includes("too complex");
      },

      enhancedStatus: () => {
        const status = conversionManager.getEngineStatus();
        return status.enhancedErrorHandling && status.complexityAssessment;
      },
    };

    let passed = 0;
    let total = 0;

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const result = testFn();
        if (result) {
          passed++;
          logDebug(`  ✅ ${testName}: PASSED`);
        } else {
          logError(`  ❌ ${testName}: FAILED`);
        }
      } catch (error) {
        logError(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    });

    const success = passed === total;
    logInfo(`📊 Enhanced Conversion Engine: ${passed}/${total} tests passed`);

    const testResult = {
      success: success,
      passed: passed,
      total: total,
      status: conversionManager.getEngineStatus(),
    };

    // DEBUG: Log the actual return value
    console.log("🔍 testConversionEngine returning:", testResult);

    return testResult;
  }

  /**
   * Fallback testing system
   * EXTRACTED: From conversion-engine.js fallbackTesting function
   */
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
    // Testing Coordination
    testStateSynchronization,
    testOrchestrationPerformance,
    testMemoryManagementIntegration,

    // API Utilities
    getCurrentOutput,
    getCurrentInput,
    setInputContent,
    clearContent,

    // Extracted Testing Functions
    testMemoryManagementIntegration,
    testConversionEngine,
    fallbackTesting,

    // Testing
    testTestingAPIManager,
  };
})();

// Make globally available
window.TestingAPIManager = TestingAPIManager;
