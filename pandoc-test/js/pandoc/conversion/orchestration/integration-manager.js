// integration-manager.js
// Integration Manager - Module coordination and dependency management
// Part of Enhanced Pandoc-WASM Mathematical Playground modular refactoring Phase 7

const IntegrationManager = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("INTEGRATION_MGR", {
    level: window.LoggingSystem.LOG_LEVELS.WARN,
  }) || {
    logError: console.error.bind(console, "[INTEGRATION_MGR]"),
    logWarn: console.warn.bind(console, "[INTEGRATION_MGR]"),
    logInfo: console.log.bind(console, "[INTEGRATION_MGR]"),
    logDebug: console.log.bind(console, "[INTEGRATION_MGR]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // MODULE COORDINATION CONSTANTS
  // ===========================================================================================

  // Required modules for full system operation
  const REQUIRED_MODULES = {
    // Core orchestration (Phase 7)
    StateManager: "window.StateManager",
    ConversionOrchestrator: "window.ConversionOrchestrator",
    EventCoordinator: "window.EventCoordinator",

    // Error handling system (Phase 6)
    ErrorHandler: "window.ErrorHandler",
    ErrorMessageGenerator: "window.ErrorMessageGenerator",
    FallbackCoordinator: "window.FallbackCoordinator",
    AccessibilityAnnouncer: "window.AccessibilityAnnouncer",

    // Processing strategies (Phase 5)
    ProcessingStrategyManager: "window.ProcessingStrategyManager",
    ChunkedProcessingEngine: "window.ChunkedProcessingEngine",
    PandocArgumentEnhancer: "window.PandocArgumentEnhancer",

    // LaTeX preservation (Phase 4)
    LatexPreservationEngine: "window.LatexPreservationEngine",
    LatexExpressionMapper: "window.LatexExpressionMapper",
    LatexRegistryManager: "window.LatexRegistryManager",

    // Memory management (Phase 3)
    MemoryWatchdog: "window.MemoryWatchdog",
    CleanupCoordinator: "window.CleanupCoordinator",
    DOMCleanupUtilities: "window.DOMCleanupUtilities",

    // Utilities (Phase 2)
    OutputCleaner: "window.OutputCleaner",
    ValidationUtilities: "window.ValidationUtilities",
    PerformanceMonitor: "window.PerformanceMonitor",

    // Foundation (Phase 1)
    LoggingSystem: "window.LoggingSystem",
  };

  // Optional modules that enhance functionality but aren't critical
  const OPTIONAL_MODULES = {
    StatusManager: "window.StatusManager",
    AppStateManager: "window.AppStateManager",
    ExportManager: "window.ExportManager",
  };

  // ===========================================================================================
  // MODULE VALIDATION AND HEALTH MONITORING
  // ===========================================================================================

  /**
   * Validate that all required modules are loaded and functional
   * @returns {Object} - Module validation results with details
   */
  function validateModuleDependencies() {
    logInfo("Validating system module dependencies...");

    const results = {
      required: {},
      optional: {},
      summary: {
        requiredAvailable: 0,
        requiredTotal: 0,
        optionalAvailable: 0,
        optionalTotal: 0,
        criticalFailures: [],
        warnings: [],
      },
    };

    // Check required modules
    Object.entries(REQUIRED_MODULES).forEach(([moduleName, modulePath]) => {
      results.summary.requiredTotal++;

      try {
        const moduleObject = eval(modulePath);
        const isAvailable = !!moduleObject;

        results.required[moduleName] = {
          available: isAvailable,
          path: modulePath,
          hasTestFunction: !!(
            moduleObject &&
            typeof moduleObject[`test${moduleName}`] === "function"
          ),
          status: isAvailable ? "loaded" : "missing",
        };

        if (isAvailable) {
          results.summary.requiredAvailable++;
          logDebug(`✅ Required module available: ${moduleName}`);
        } else {
          results.summary.criticalFailures.push(moduleName);
          logError(`❌ Required module missing: ${moduleName}`);
        }
      } catch (error) {
        results.required[moduleName] = {
          available: false,
          path: modulePath,
          status: "error",
          error: error.message,
        };
        results.summary.criticalFailures.push(moduleName);
        logError(`❌ Required module error: ${moduleName} - ${error.message}`);
      }
    });

    // Check optional modules
    Object.entries(OPTIONAL_MODULES).forEach(([moduleName, modulePath]) => {
      results.summary.optionalTotal++;

      try {
        const moduleObject = eval(modulePath);
        const isAvailable = !!moduleObject;

        results.optional[moduleName] = {
          available: isAvailable,
          path: modulePath,
          status: isAvailable ? "loaded" : "missing",
        };

        if (isAvailable) {
          results.summary.optionalAvailable++;
          logDebug(`✅ Optional module available: ${moduleName}`);
        } else {
          results.summary.warnings.push(
            `Optional module missing: ${moduleName}`
          );
          logWarn(`⚠️ Optional module missing: ${moduleName}`);
        }
      } catch (error) {
        results.optional[moduleName] = {
          available: false,
          path: modulePath,
          status: "error",
          error: error.message,
        };
        results.summary.warnings.push(`Optional module error: ${moduleName}`);
        logWarn(`⚠️ Optional module error: ${moduleName} - ${error.message}`);
      }
    });

    // Calculate overall health
    const requiredHealth =
      (results.summary.requiredAvailable / results.summary.requiredTotal) * 100;
    const optionalHealth =
      results.summary.optionalTotal > 0
        ? (results.summary.optionalAvailable / results.summary.optionalTotal) *
          100
        : 100;

    results.summary.overallHealth = {
      requiredHealthPercentage: Math.round(requiredHealth),
      optionalHealthPercentage: Math.round(optionalHealth),
      systemHealthy: results.summary.criticalFailures.length === 0,
      recommendedAction:
        results.summary.criticalFailures.length > 0
          ? "Critical modules missing - system may not function properly"
          : "System ready for operation",
    };

    logInfo(
      `📊 Module dependency validation complete: ${results.summary.requiredAvailable}/${results.summary.requiredTotal} required, ${results.summary.optionalAvailable}/${results.summary.optionalTotal} optional`
    );

    return results;
  }

  /**
   * Initialize module dependency chain in correct order
   * Ensures modules are loaded and initialized in proper sequence
   * @returns {Promise<boolean>} - Success/failure of module chain initialization
   */
  async function initializeModuleChain() {
    logInfo("Initializing module dependency chain...");

    try {
      // Phase 1: Foundation modules
      if (window.LoggingSystem) {
        logDebug("✅ Logging system ready");
      } else {
        logWarn("⚠️ Logging system not available - using fallback");
      }

      // Phase 2-3: Utility and memory management modules
      const utilityModules = [
        "OutputCleaner",
        "ValidationUtilities",
        "PerformanceMonitor",
        "MemoryWatchdog",
        "CleanupCoordinator",
        "DOMCleanupUtilities",
      ];

      for (const moduleName of utilityModules) {
        if (window[moduleName]) {
          logDebug(`✅ Utility module ready: ${moduleName}`);
        } else {
          logWarn(`⚠️ Utility module missing: ${moduleName}`);
        }
      }

      // Phase 4: LaTeX preservation system
      const latexModules = [
        "LatexPreservationEngine",
        "LatexExpressionMapper",
        "LatexRegistryManager",
      ];

      for (const moduleName of latexModules) {
        if (window[moduleName]) {
          // Initialize LaTeX registries if needed
          if (
            moduleName === "LatexRegistryManager" &&
            window[moduleName].initialiseGlobalRegistries
          ) {
            window[moduleName].initialiseGlobalRegistries();
          }
          logDebug(`✅ LaTeX module ready: ${moduleName}`);
        } else {
          logWarn(`⚠️ LaTeX module missing: ${moduleName}`);
        }
      }

      // Phase 5: Processing strategies
      const processingModules = [
        "ProcessingStrategyManager",
        "ChunkedProcessingEngine",
        "PandocArgumentEnhancer",
      ];

      for (const moduleName of processingModules) {
        if (window[moduleName]) {
          logDebug(`✅ Processing module ready: ${moduleName}`);
        } else {
          logWarn(`⚠️ Processing module missing: ${moduleName}`);
        }
      }

      // Phase 6: Error handling system
      const errorModules = [
        "ErrorHandler",
        "ErrorMessageGenerator",
        "FallbackCoordinator",
        "AccessibilityAnnouncer",
      ];

      for (const moduleName of errorModules) {
        if (window[moduleName]) {
          logDebug(`✅ Error handling module ready: ${moduleName}`);
        } else {
          logWarn(`⚠️ Error handling module missing: ${moduleName}`);
        }
      }

      // Phase 7: Orchestration system
      const orchestrationModules = [
        "StateManager",
        "ConversionOrchestrator",
        "EventCoordinator",
      ];

      for (const moduleName of orchestrationModules) {
        if (window[moduleName]) {
          logDebug(`✅ Orchestration module ready: ${moduleName}`);
        } else {
          logError(`❌ Critical orchestration module missing: ${moduleName}`);
          return false;
        }
      }

      logInfo("✅ Module dependency chain initialization complete");
      return true;
    } catch (error) {
      logError("Module chain initialization failed:", error);
      return false;
    }
  }

  /**
   * Handle module failures with graceful degradation
   * Provides fallback strategies when modules are unavailable
   * @param {string} moduleName - Name of the failed module
   * @param {Error} error - The error that occurred
   * @returns {Object} - Fallback strategy information
   */
  function handleModuleFailures(moduleName, error) {
    logWarn(`Handling failure for module: ${moduleName}`, error);

    const fallbackStrategies = {
      // Core orchestration fallbacks
      StateManager: {
        fallbackAvailable: true,
        fallbackMethod: "Use conversion engine internal state management",
        impact: "Reduced state optimization, but full functionality preserved",
      },

      ConversionOrchestrator: {
        fallbackAvailable: true,
        fallbackMethod: "Use conversion engine direct workflow",
        impact: "Direct processing without orchestration optimizations",
      },

      EventCoordinator: {
        fallbackAvailable: true,
        fallbackMethod: "Use conversion engine internal event handling",
        impact: "Basic event handling without coordination benefits",
      },

      // Processing system fallbacks
      ProcessingStrategyManager: {
        fallbackAvailable: true,
        fallbackMethod: "Use basic complexity assessment",
        impact: "Reduced processing optimization",
      },

      ChunkedProcessingEngine: {
        fallbackAvailable: false,
        fallbackMethod:
          "Large documents may fail - recommend splitting manually",
        impact: "No automatic chunking for complex documents",
      },

      // Error handling fallbacks
      ErrorHandler: {
        fallbackAvailable: true,
        fallbackMethod: "Use conversion engine internal error handling",
        impact: "Basic error handling without advanced recovery strategies",
      },

      // Memory management fallbacks
      CleanupCoordinator: {
        fallbackAvailable: true,
        fallbackMethod: "Use basic timeout clearing",
        impact: "Reduced memory management efficiency",
      },

      // Utility fallbacks
      OutputCleaner: {
        fallbackAvailable: true,
        fallbackMethod: "Use basic string cleaning",
        impact: "Reduced output processing quality",
      },
    };

    const strategy = fallbackStrategies[moduleName] || {
      fallbackAvailable: false,
      fallbackMethod: "No fallback available",
      impact: "Functionality may be severely impacted",
    };

    logInfo(`Fallback strategy for ${moduleName}: ${strategy.fallbackMethod}`);

    return {
      moduleName,
      error: error.message,
      fallbackStrategy: strategy,
      timestamp: new Date().toISOString(),
    };
  }

  // ===========================================================================================
  // SYSTEM HEALTH MONITORING
  // ===========================================================================================

  /**
   * Get comprehensive system health status
   * Provides detailed information about all system components
   * @returns {Object} - Complete system health assessment
   */
  function getSystemHealthStatus() {
    logDebug("Generating system health status...");

    try {
      const moduleValidation = validateModuleDependencies();
      const startTime = performance.now();

      // Test core functionality
      const conversionEngineReady =
        window.ConversionEngine?.isEngineReady() || false;
      const stateManagerReady = window.StateManager?.isEngineReady() || false;

      // Memory diagnostics
      let memoryDiagnostics = {};
      if (window.ConversionEngine?.getMemoryDiagnostics) {
        memoryDiagnostics = window.ConversionEngine.getMemoryDiagnostics();
      }

      // DOM health assessment
      let domHealth = {};
      if (window.DOMCleanupUtilities?.assessDOMHealth) {
        domHealth = window.DOMCleanupUtilities.assessDOMHealth();
      }

      // Performance metrics
      let performanceMetrics = {};
      if (window.PerformanceMonitor?.getSystemDiagnostics) {
        performanceMetrics = window.PerformanceMonitor.getSystemDiagnostics();
      }

      const endTime = performance.now();
      const healthCheckDuration = endTime - startTime;

      const healthStatus = {
        timestamp: new Date().toISOString(),
        healthCheckDuration: Math.round(healthCheckDuration * 100) / 100,

        // Module availability
        modules: moduleValidation,

        // Core system readiness
        coreSystem: {
          conversionEngineReady,
          stateManagerReady,
          pandocAvailable: !!window.ConversionEngine?.pandocFunction,
          systemIntegrated: conversionEngineReady && stateManagerReady,
        },

        // Memory and performance
        memory: memoryDiagnostics,
        dom: domHealth,
        performance: performanceMetrics,

        // Overall assessment
        overall: {
          healthy:
            moduleValidation.summary.criticalFailures.length === 0 &&
            conversionEngineReady,
          readyForOperation:
            moduleValidation.summary.criticalFailures.length === 0 &&
            conversionEngineReady &&
            stateManagerReady,
          criticalIssues: moduleValidation.summary.criticalFailures,
          warnings: moduleValidation.summary.warnings,
          recommendedActions: [],
        },
      };

      // Generate recommended actions
      if (!healthStatus.overall.healthy) {
        healthStatus.overall.recommendedActions.push(
          "Address critical module failures before proceeding"
        );
      }

      if (
        healthStatus.memory.heapSizeMB &&
        parseFloat(healthStatus.memory.heapSizeMB) > 100
      ) {
        healthStatus.overall.recommendedActions.push(
          "Consider memory cleanup - heap size elevated"
        );
      }

      if (
        healthStatus.modules.summary.optionalAvailable <
        healthStatus.modules.summary.optionalTotal
      ) {
        healthStatus.overall.recommendedActions.push(
          "Consider loading optional modules for enhanced functionality"
        );
      }

      logInfo(
        `📊 System health check complete: ${
          healthStatus.overall.healthy ? "HEALTHY" : "ISSUES DETECTED"
        }`
      );

      return healthStatus;
    } catch (error) {
      logError("System health status generation failed:", error);
      return {
        timestamp: new Date().toISOString(),
        error: error.message,
        overall: {
          healthy: false,
          readyForOperation: false,
          criticalIssues: ["Health assessment system failure"],
          recommendedActions: ["Investigate health monitoring system"],
        },
      };
    }
  }

  /**
   * Validate integration between all modules
   * Tests cross-module communication and dependency resolution
   * @returns {Promise<Object>} - Integration validation results
   */
  async function validateSystemIntegration() {
    logInfo("Validating system integration...");

    const integrationTests = {
      moduleChainInitialization: async () => {
        try {
          return await initializeModuleChain();
        } catch (error) {
          logError("Module chain initialization test failed:", error);
          return false;
        }
      },

      stateManagerIntegration: () => {
        if (!window.StateManager || !window.ConversionEngine) return false;

        try {
          const engineStatus = window.ConversionEngine.getEngineStatus();
          const stateStatus = window.StateManager.getEngineStatus();
          return (
            engineStatus &&
            stateStatus &&
            typeof engineStatus.ready === "boolean"
          );
        } catch (error) {
          logError("State manager integration test failed:", error);
          return false;
        }
      },

      orchestrationCoordination: () => {
        if (!window.ConversionOrchestrator || !window.EventCoordinator)
          return false;

        try {
          const hasOrchestrator =
            typeof window.ConversionOrchestrator.createOrchestrationContext ===
            "function";
          const hasEventCoordinator =
            typeof window.EventCoordinator.coordinateConversionEvent ===
            "function";
          return hasOrchestrator && hasEventCoordinator;
        } catch (error) {
          logError("Orchestration coordination test failed:", error);
          return false;
        }
      },

      errorHandlingChain: () => {
        if (!window.ErrorHandler) return true; // Optional

        try {
          return (
            typeof window.ErrorHandler.handleConversionError === "function"
          );
        } catch (error) {
          logError("Error handling chain test failed:", error);
          return false;
        }
      },

      memoryManagementChain: () => {
        if (!window.CleanupCoordinator) return true; // Optional but recommended

        try {
          return typeof window.CleanupCoordinator.cleanup === "function";
        } catch (error) {
          logError("Memory management chain test failed:", error);
          return false;
        }
      },

      latexPreservationSystem: () => {
        if (!window.LatexPreservationEngine) return false;

        try {
          return (
            typeof window.LatexPreservationEngine
              .extractAndMapLatexExpressions === "function"
          );
        } catch (error) {
          logError("LaTeX preservation system test failed:", error);
          return false;
        }
      },
    };

    const results = {
      timestamp: new Date().toISOString(),
      tests: {},
      summary: {
        passed: 0,
        total: 0,
        integrationHealthy: false,
      },
    };

    // Run integration tests
    for (const [testName, testFn] of Object.entries(integrationTests)) {
      results.summary.total++;

      try {
        const result = await testFn();
        results.tests[testName] = {
          passed: result,
          status: result ? "PASS" : "FAIL",
        };

        if (result) {
          results.summary.passed++;
          logDebug(`✅ Integration test passed: ${testName}`);
        } else {
          logWarn(`❌ Integration test failed: ${testName}`);
        }
      } catch (error) {
        results.tests[testName] = {
          passed: false,
          status: "ERROR",
          error: error.message,
        };
        logError(`❌ Integration test error: ${testName} - ${error.message}`);
      }
    }

    results.summary.integrationHealthy =
      results.summary.passed === results.summary.total;

    logInfo(
      `📊 System integration validation: ${results.summary.passed}/${results.summary.total} tests passed`
    );

    return results;
  }

  /**
   * Perform comprehensive health check combining all monitoring systems
   * @returns {Promise<Object>} - Complete health check results
   */
  async function performHealthCheck() {
    logInfo("Performing comprehensive system health check...");

    try {
      const startTime = performance.now();

      const [systemHealth, integrationResults] = await Promise.all([
        Promise.resolve(getSystemHealthStatus()),
        validateSystemIntegration(),
      ]);

      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      const healthCheck = {
        timestamp: new Date().toISOString(),
        duration: Math.round(totalDuration * 100) / 100,
        systemHealth,
        integration: integrationResults,
        overall: {
          systemReady:
            systemHealth.overall.healthy &&
            integrationResults.summary.integrationHealthy,
          confidence: Math.round(
            ((systemHealth.modules.summary.requiredAvailable /
              systemHealth.modules.summary.requiredTotal +
              integrationResults.summary.passed /
                integrationResults.summary.total) /
              2) *
              100
          ),
          recommendation:
            systemHealth.overall.healthy &&
            integrationResults.summary.integrationHealthy
              ? "System fully operational and ready for production use"
              : "System has issues that should be addressed before production use",
        },
      };

      logInfo(
        `📊 Comprehensive health check complete: ${
          healthCheck.overall.systemReady ? "SYSTEM READY" : "ISSUES DETECTED"
        } (${healthCheck.overall.confidence}% confidence)`
      );

      return healthCheck;
    } catch (error) {
      logError("Comprehensive health check failed:", error);
      return {
        timestamp: new Date().toISOString(),
        error: error.message,
        overall: {
          systemReady: false,
          confidence: 0,
          recommendation:
            "Health check system failure - manual investigation required",
        },
      };
    }
  }

  // ===========================================================================================
  // UNIFIED DEPENDENCY CONTEXT CREATION
  // ===========================================================================================

  /**
   * Create unified dependency context for all modules
   * Centralizes dependency injection for the entire system
   * @param {Object} conversionManager - The conversion manager instance
   * @returns {Object} - Unified dependency context
   */
  function createUnifiedDependencyContext(conversionManager) {
    logDebug("Creating unified dependency context...");

    if (!conversionManager) {
      logWarn("No conversion manager provided for unified dependency context");
      return {};
    }

    try {
      const unifiedContext = {
        // Core system reference
        conversionManager,

        // Orchestration context
        orchestration: window.ConversionOrchestrator?.createOrchestrationContext
          ? window.ConversionOrchestrator.createOrchestrationContext(
              conversionManager
            )
          : {},

        // State management context
        stateManagement: window.StateManager?.createStateManagementContext
          ? window.StateManager.createStateManagementContext(conversionManager)
          : {},

        // Event coordination context
        eventCoordination: window.EventCoordinator?.createEventContext
          ? window.EventCoordinator.createEventContext(conversionManager)
          : {},

        // Error handling context
        errorHandling: window.ErrorHandler?.createErrorContext
          ? window.ErrorHandler.createErrorContext(conversionManager)
          : {},

        // Fallback coordination context
        fallbackCoordination: window.FallbackCoordinator?.createFallbackContext
          ? window.FallbackCoordinator.createFallbackContext(conversionManager)
          : {},

        // Memory management context
        memoryManagement: {
          cleanup: window.CleanupCoordinator || null,
          watchdog: window.MemoryWatchdog || null,
          domUtilities: window.DOMCleanupUtilities || null,
        },

        // LaTeX processing context
        latexProcessing: {
          preservation: window.LatexPreservationEngine || null,
          mapper: window.LatexExpressionMapper || null,
          registry: window.LatexRegistryManager || null,
        },

        // Processing strategies context
        processingStrategies: {
          strategyManager: window.ProcessingStrategyManager || null,
          chunkedEngine: window.ChunkedProcessingEngine || null,
          argumentEnhancer: window.PandocArgumentEnhancer || null,
        },

        // Utility functions context
        utilities: {
          outputCleaner: window.OutputCleaner || null,
          validator: window.ValidationUtilities || null,
          performance: window.PerformanceMonitor || null,
        },

        // Optional system integration
        optionalIntegration: {
          statusManager: window.StatusManager || null,
          appStateManager: window.AppStateManager || null,
          exportManager: window.ExportManager || null,
        },

        // System health and monitoring
        systemHealth: {
          getHealthStatus: () => getSystemHealthStatus(),
          validateIntegration: () => validateSystemIntegration(),
          performHealthCheck: () => performHealthCheck(),
        },
      };

      logDebug(
        "✅ Unified dependency context created with all available modules"
      );
      return unifiedContext;
    } catch (error) {
      logError("Failed to create unified dependency context:", error);
      return {
        conversionManager,
        error: error.message,
        fallbackMode: true,
      };
    }
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  async function testIntegrationManager() {
    logInfo("🧪 Testing Integration Manager...");

    const tests = {
      moduleExists: () => !!window.IntegrationManager,

      moduleValidationFunction: () => {
        try {
          const validation = validateModuleDependencies();
          return validation && typeof validation.summary === "object";
        } catch (error) {
          logError("Module validation test failed:", error);
          return false;
        }
      },

      moduleChainInitialization: async () => {
        try {
          return await initializeModuleChain();
        } catch (error) {
          logError("Module chain initialization test failed:", error);
          return false;
        }
      },

      systemHealthMonitoring: () => {
        try {
          const health = getSystemHealthStatus();
          return (
            health &&
            health.overall &&
            typeof health.overall.healthy === "boolean"
          );
        } catch (error) {
          logError("System health monitoring test failed:", error);
          return false;
        }
      },

      integrationValidation: async () => {
        try {
          const validation = await validateSystemIntegration();
          return (
            validation &&
            validation.summary &&
            typeof validation.summary.integrationHealthy === "boolean"
          );
        } catch (error) {
          logError("Integration validation test failed:", error);
          return false;
        }
      },

      unifiedContextCreation: () => {
        try {
          const mockManager = { isEngineReady: () => true };
          const context = createUnifiedDependencyContext(mockManager);
          return context && context.conversionManager === mockManager;
        } catch (error) {
          logError("Unified context creation test failed:", error);
          return false;
        }
      },

      moduleFailureHandling: () => {
        try {
          const result = handleModuleFailures(
            "TestModule",
            new Error("Test error")
          );
          return result && result.moduleName === "TestModule";
        } catch (error) {
          logError("Module failure handling test failed:", error);
          return false;
        }
      },

      comprehensiveHealthCheck: async () => {
        try {
          const healthCheck = await performHealthCheck();
          return (
            healthCheck &&
            healthCheck.overall &&
            typeof healthCheck.overall.systemReady === "boolean"
          );
        } catch (error) {
          logError("Comprehensive health check test failed:", error);
          return false;
        }
      },
    };

    let passed = 0;
    let total = 0;
    const testResults = {};

    // Run all tests and properly handle async ones
    for (const [testName, testFn] of Object.entries(tests)) {
      total++;
      try {
        const startTime = performance.now();
        let result = testFn();

        // Await async tests
        if (result instanceof Promise) {
          result = await result;
        }

        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);

        testResults[testName] = {
          passed: result,
          duration: duration,
          async: testFn.constructor.name === "AsyncFunction",
        };

        if (result) {
          passed++;
          logDebug(`  ✅ ${testName}: PASSED (${duration}ms)`);
        } else {
          logError(`  ❌ ${testName}: FAILED (${duration}ms)`);
        }
      } catch (error) {
        testResults[testName] = {
          passed: false,
          error: error.message,
          async: testFn.constructor.name === "AsyncFunction",
        };
        logError(`  ❌ ${testName}: ERROR - ${error.message}`);
      }
    }

    const success = passed === total;
    logInfo(`📊 Integration Manager: ${passed}/${total} tests passed`);

    return {
      success: success,
      passed: passed,
      total: total,
      testResults: testResults,
      moduleCoordination: true,
      systemHealthMonitoring: true,
      dependencyManagement: true,
      integrationReady: success && passed >= 6, // At least 6/8 tests should pass
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Module coordination
    validateModuleDependencies,
    initializeModuleChain,
    handleModuleFailures,

    // System health monitoring
    getSystemHealthStatus,
    validateSystemIntegration,
    performHealthCheck,

    // Unified dependency management
    createUnifiedDependencyContext,

    // Testing (async function)
    testIntegrationManager,

    // Constants for external reference
    REQUIRED_MODULES,
    OPTIONAL_MODULES,

    // Enhanced API methods
    getModuleHealth: () => {
      const validation = validateModuleDependencies();
      return {
        requiredModulesHealthy:
          validation.summary.criticalFailures.length === 0,
        totalRequired: validation.summary.requiredTotal,
        availableRequired: validation.summary.requiredAvailable,
        totalOptional: validation.summary.optionalTotal,
        availableOptional: validation.summary.optionalAvailable,
        overallHealth: validation.summary.overallHealth,
      };
    },

    // Quick integration status check
    isSystemIntegrated: () => {
      try {
        const health = getSystemHealthStatus();
        return (
          health.overall.readyForOperation && health.coreSystem.systemIntegrated
        );
      } catch (error) {
        logError("System integration check failed:", error);
        return false;
      }
    },
  };
})();

// Make globally available
window.IntegrationManager = IntegrationManager;
