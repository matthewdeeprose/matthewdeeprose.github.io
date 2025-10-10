// conversion-api-manager.js
// Conversion API Manager - Public API delegation and coordination
// Part of Enhanced Pandoc-WASM Mathematical Playground modular refactoring Phase 7 Step 28

const ConversionAPIManager = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("CONV_API_MGR", {
    level: window.LoggingSystem.LOG_LEVELS.WARN,
  }) || {
    logError: console.error.bind(console, "[CONV_API_MGR]"),
    logWarn: console.warn.bind(console, "[CONV_API_MGR]"),
    logInfo: console.log.bind(console, "[CONV_API_MGR]"),
    logDebug: console.log.bind(console, "[CONV_API_MGR]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // PUBLIC API DELEGATION METHODS
  // ===========================================================================================

  /**
   * Create public API for conversion engine
   * EXTRACTED: From conversion-engine.js main return block
   */
  function createPublicAPI(conversionManager) {
    return {
      // Manager instance (required by other modules)
      manager: conversionManager,

      // Core functionality (required by app-state-manager.js)
      initialise() {
        return conversionManager.initialise();
      },

      setPandocFunction(pandocFn) {
        return conversionManager.setPandocFunction(pandocFn);
      },

      convertInput() {
        return conversionManager.convertInput();
      },

      // Content management (delegated to FinalCoordinationManager)
      getCurrentOutput() {
        return (
          window.FinalCoordinationManager?.getCurrentOutput(
            conversionManager
          ) || ""
        );
      },

      getCurrentInput() {
        return (
          window.FinalCoordinationManager?.getCurrentInput(conversionManager) ||
          ""
        );
      },

      setInputContent(content) {
        return window.FinalCoordinationManager?.setInputContent(
          conversionManager,
          content
        );
      },

      clearContent() {
        return window.FinalCoordinationManager?.clearContent(conversionManager);
      },

      // Status
      isEngineReady() {
        return conversionManager.isEngineReady();
      },

      getEngineStatus() {
        return conversionManager.getEngineStatus();
      },

      // ENHANCED: New API methods
      assessDocumentComplexity(content) {
        return conversionManager.assessDocumentComplexity(content);
      },

      // Enhanced Pandoc methods for export integration
      generateEnhancedPandocArgs(baseArgs) {
        return conversionManager.generateEnhancedPandocArgs(baseArgs);
      },

      getEnhancementsByPreset(preset) {
        return conversionManager.getEnhancementsByPreset(preset);
      },

      cleanPandocOutput(output) {
        return conversionManager.cleanPandocOutput(output);
      },

      // Direct Pandoc function access for enhanced exports
      pandocFunction(args, input) {
        if (!conversionManager.pandocFunction) {
          throw new Error(
            "Pandoc function not available - WebAssembly not initialized"
          );
        }
        return conversionManager.pandocFunction(args, input);
      },

      // Testing
      testConversionEngine() {
        return (
          window.TestingAPIManager?.testConversionEngine?.(
            conversionManager
          ) || { success: false, error: "TestingAPIManager not available" }
        );
      },

      testStateSynchronization() {
        return (
          window.TestingAPIManager?.testStateSynchronization?.(
            conversionManager
          ) || { success: false, error: "TestingAPIManager not available" }
        );
      },

      testOrchestrationPerformance() {
        return (
          window.TestingAPIManager?.testOrchestrationPerformance?.(
            conversionManager
          ) || { success: false, error: "TestingAPIManager not available" }
        );
      },

      testMemoryManagementIntegration() {
        return (
          window.TestingAPIManager?.testMemoryManagementIntegration?.(
            conversionManager
          ) || { success: false, error: "TestingAPIManager not available" }
        );
      },

      // Memory management: Advanced memory utilities using enhanced memory watchdog
      get memoryWatchdog() {
        return window.MemoryWatchdog?.getSharedWatchdogInstance?.() || null;
      },

      getMemoryDiagnostics() {
        return (
          window.MemoryWatchdog?.getComprehensiveMemoryDiagnostics?.(
            conversionManager
          ) || { error: "Memory diagnostics not available" }
        );
      },

      performEmergencyCleanup() {
        return window.MemoryWatchdog?.performManualEmergencyCleanup?.(
          conversionManager
        );
      },

      getMemoryWatchdogStatus() {
        return (
          window.MemoryWatchdog?.getSharedWatchdogStatus?.() || {
            monitoring: false,
            error: "Memory watchdog not available",
          }
        );
      },

      getDOMHealthAssessment() {
        return (
          window.MemoryWatchdog?.getDOMHealthAssessment?.() || {
            healthy: true,
            warnings: ["DOM health assessment not available"],
          }
        );
      },

      // Logging
      logError,
      logWarn,
      logInfo,
      logDebug,
    };
  }

  /**
   * Test ConversionAPIManager functionality
   */
  function testConversionAPIManager() {
    logInfo("Testing ConversionAPIManager...");

    const tests = {
      moduleExists: () => !!window.ConversionAPIManager,

      canCreateAPI: () => {
        try {
          const mockManager = {
            initialise: () => true,
            isEngineReady: () => true,
            getEngineStatus: () => ({ ready: true }),
          };
          const api = createPublicAPI(mockManager);
          return api && typeof api.initialise === "function";
        } catch (error) {
          logError("API creation test failed:", error);
          return false;
        }
      },

      hasRequiredMethods: () => {
        const mockManager = {
          initialise: () => true,
          isEngineReady: () => true,
          getEngineStatus: () => ({ ready: true }),
        };
        const api = createPublicAPI(mockManager);
        const requiredMethods = [
          "initialise",
          "setPandocFunction",
          "convertInput",
          "getCurrentOutput",
          "getCurrentInput",
          "setInputContent",
          "isEngineReady",
          "getEngineStatus",
        ];
        return requiredMethods.every(
          (method) => typeof api[method] === "function"
        );
      },

      memoryIntegration: () => {
        const mockManager = {
          initialise: () => true,
          isEngineReady: () => true,
          getEngineStatus: () => ({ ready: true }),
        };
        const api = createPublicAPI(mockManager);
        return (
          typeof api.getMemoryDiagnostics === "function" &&
          typeof api.performEmergencyCleanup === "function"
        );
      },

      testingIntegration: () => {
        const mockManager = {
          initialise: () => true,
          isEngineReady: () => true,
          getEngineStatus: () => ({ ready: true }),
        };
        const api = createPublicAPI(mockManager);
        return (
          typeof api.testConversionEngine === "function" &&
          typeof api.testMemoryManagementIntegration === "function"
        );
      },

      loggingIntegration: () => {
        const mockManager = {
          initialise: () => true,
          isEngineReady: () => true,
          getEngineStatus: () => ({ ready: true }),
        };
        const api = createPublicAPI(mockManager);
        return (
          typeof api.logError === "function" &&
          typeof api.logInfo === "function"
        );
      },
    };

    return (
      window.TestUtilities?.runTestSuite("ConversionAPIManager", tests) ||
      fallbackTesting("ConversionAPIManager", tests)
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
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    createPublicAPI,
    testConversionAPIManager,
  };
})();

// Make globally available
window.ConversionAPIManager = ConversionAPIManager;
