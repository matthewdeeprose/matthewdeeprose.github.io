// latex-registry-manager.js
// Global LaTeX Registry Management System
// Manages window.originalLatexRegistry and window.originalLatexByPosition
// Provides thread-safe registry access and cleanup coordination

const LatexRegistryManager = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("LATEX_REGISTRY", {
    level: window.LoggingSystem.LOG_LEVELS.WARN,
  }) || {
    logError: console.error.bind(console, "[LATEX_REGISTRY]"),
    logWarn: console.warn.bind(console, "[LATEX_REGISTRY]"),
    logInfo: console.log.bind(console, "[LATEX_REGISTRY]"),
    logDebug: console.log.bind(console, "[LATEX_REGISTRY]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // GLOBAL REGISTRY MANAGEMENT FUNCTIONS
  // ===========================================================================================

  /**
   * Initialise global LaTeX registries safely
   */
  function initialiseGlobalRegistries() {
    logInfo("Initialising global LaTeX registries...");

    try {
      // Initialise originalLatexRegistry if not exists or invalid
      if (
        !window.originalLatexRegistry ||
        typeof window.originalLatexRegistry !== "object"
      ) {
        window.originalLatexRegistry = {};
        logDebug("Created new originalLatexRegistry");
      }

      // Initialise originalLatexByPosition if not exists or invalid
      if (
        !window.originalLatexByPosition ||
        !Array.isArray(window.originalLatexByPosition)
      ) {
        window.originalLatexByPosition = [];
        logDebug("Created new originalLatexByPosition array");
      }

      logInfo("✅ Global LaTeX registries initialised successfully");
      return true;
    } catch (error) {
      logError("Failed to initialise global LaTeX registries:", error);
      return false;
    }
  }

  /**
   * Store LaTeX expressions in global registries for annotation injection
   */
  function storeInGlobalRegistries(latexMap, orderedExpressions) {
    if (!latexMap || !orderedExpressions) {
      logWarn("Invalid parameters provided for registry storage");
      return false;
    }

    try {
      // Ensure registries are initialised
      initialiseGlobalRegistries();

      // Store the complete LaTeX map
      window.originalLatexRegistry = { ...latexMap };

      // Store position-based array for sequential access
      if (window.LatexExpressionMapper) {
        window.originalLatexByPosition =
          window.LatexExpressionMapper.createPositionBasedArray(
            orderedExpressions
          );
      } else {
        // Fallback creation
        window.originalLatexByPosition = orderedExpressions.map(
          (expr) => expr.latex
        );
      }

      logInfo(
        `Stored ${
          Object.keys(latexMap).length
        } expressions in global registries`
      );
      logDebug(`Registry keys: ${Object.keys(latexMap).join(", ")}`);
      logDebug(
        `Position array length: ${window.originalLatexByPosition.length}`
      );

      return true;
    } catch (error) {
      logError("Error storing expressions in global registries:", error);
      return false;
    }
  }

  /**
   * Retrieve LaTeX expression by index from global registry
   */
  function getLatexByIndex(index) {
    if (!window.originalLatexRegistry) {
      logWarn("Global LaTeX registry not initialised");
      return null;
    }

    try {
      const expression = window.originalLatexRegistry[index];
      if (expression) {
        logDebug(
          `Retrieved expression ${index}: ${expression.latex.substring(
            0,
            30
          )}...`
        );
        return expression;
      } else {
        logWarn(`Expression not found at index ${index}`);
        return null;
      }
    } catch (error) {
      logError("Error retrieving LaTeX by index:", error);
      return null;
    }
  }

  /**
   * Retrieve LaTeX expression by position from global registry
   */
  function getLatexByPosition(position) {
    if (
      !window.originalLatexByPosition ||
      !Array.isArray(window.originalLatexByPosition)
    ) {
      logWarn("Global LaTeX position array not initialised");
      return null;
    }

    try {
      if (position >= 0 && position < window.originalLatexByPosition.length) {
        const latex = window.originalLatexByPosition[position];
        logDebug(
          `Retrieved expression at position ${position}: ${latex.substring(
            0,
            30
          )}...`
        );
        return latex;
      } else {
        logWarn(
          `Position ${position} out of bounds (array length: ${window.originalLatexByPosition.length})`
        );
        return null;
      }
    } catch (error) {
      logError("Error retrieving LaTeX by position:", error);
      return null;
    }
  }

  /**
   * Get current registry status and statistics
   */
  function getRegistryStatus() {
    try {
      const registryExists = !!window.originalLatexRegistry;
      const positionArrayExists = !!window.originalLatexByPosition;

      const registrySize = registryExists
        ? Object.keys(window.originalLatexRegistry).length
        : 0;
      const positionArraySize = positionArrayExists
        ? window.originalLatexByPosition.length
        : 0;

      const status = {
        registryInitialised: registryExists,
        positionArrayInitialised: positionArrayExists,
        registrySize: registrySize,
        positionArraySize: positionArraySize,
        consistent: registrySize === positionArraySize,
        lastUpdate: window.originalLatexRegistry?._lastUpdate || null,
      };

      logDebug("Registry status:", status);
      return status;
    } catch (error) {
      logError("Error getting registry status:", error);
      return {
        registryInitialised: false,
        positionArrayInitialised: false,
        registrySize: 0,
        positionArraySize: 0,
        consistent: false,
        error: error.message,
      };
    }
  }

  /**
   * Clear global LaTeX registries (use with caution - affects annotation injection)
   */
  function clearGlobalRegistries() {
    logWarn(
      "Clearing global LaTeX registries - annotation injection may be affected"
    );

    try {
      if (window.originalLatexRegistry) {
        const clearedCount = Object.keys(window.originalLatexRegistry).length;
        window.originalLatexRegistry = {};
        logDebug(`Cleared ${clearedCount} expressions from registry`);
      }

      if (window.originalLatexByPosition) {
        const clearedArraySize = window.originalLatexByPosition.length;
        window.originalLatexByPosition = [];
        logDebug(`Cleared position array of size ${clearedArraySize}`);
      }

      logWarn("✅ Global LaTeX registries cleared");
      return true;
    } catch (error) {
      logError("Error clearing global registries:", error);
      return false;
    }
  }

  /**
   * Safely cleanup registries with memory management coordination
   */
  function coordinatedCleanup(preserveForAnnotation = true) {
    if (preserveForAnnotation) {
      logInfo(
        "Coordinated cleanup requested - preserving LaTeX registries for annotation injection"
      );

      // Check if annotations are in progress or complete
      const mathElements = document.querySelectorAll("mjx-container").length;
      const annotations = document.querySelectorAll(
        'annotation[encoding="application/x-tex"]'
      ).length;

      if (mathElements > 0 && annotations === 0) {
        logInfo(
          "Math elements present but no annotations - preserving registries"
        );
        return false; // Don't clean up yet
      } else {
        logInfo(
          "Annotations complete or no math elements - safe to preserve registries"
        );
        return true; // Safe state, but still preserve
      }
    } else {
      logWarn("Coordinated cleanup with registry clearing requested");
      return clearGlobalRegistries();
    }
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testLatexRegistryManager() {
    const tests = {
      moduleExists: () => !!window.LatexRegistryManager,

      initialisation: () => {
        clearGlobalRegistries(); // Start clean
        const result = initialiseGlobalRegistries();
        return (
          result &&
          typeof window.originalLatexRegistry === "object" &&
          Array.isArray(window.originalLatexByPosition)
        );
      },

      storageFunction: () => {
        const testMap = {
          0: {
            latex: "x=1",
            type: "inline",
            pattern: "$",
            position: 0,
            index: 0,
          },
          1: {
            latex: "y=2",
            type: "display",
            pattern: "$$",
            position: 10,
            index: 1,
          },
        };
        const orderedExpressions = [
          { latex: "x=1", position: 0 },
          { latex: "y=2", position: 10 },
        ];

        const stored = storeInGlobalRegistries(testMap, orderedExpressions);
        return (
          stored &&
          Object.keys(window.originalLatexRegistry).length === 2 &&
          window.originalLatexByPosition.length === 2
        );
      },

      retrievalByIndex: () => {
        const expression = getLatexByIndex(0);
        return expression && expression.latex === "x=1";
      },

      retrievalByPosition: () => {
        const latex = getLatexByPosition(1);
        return latex === "y=2";
      },

      statusFunction: () => {
        const status = getRegistryStatus();
        return (
          status.registryInitialised &&
          status.positionArrayInitialised &&
          status.consistent &&
          status.registrySize === 2
        );
      },

      coordinatedCleanup: () => {
        const result = coordinatedCleanup(true); // Preserve for annotation
        const status = getRegistryStatus();
        return typeof result === "boolean" && status.registrySize > 0; // Should preserve
      },

      clearFunction: () => {
        const cleared = clearGlobalRegistries();
        const status = getRegistryStatus();
        return (
          cleared && status.registrySize === 0 && status.positionArraySize === 0
        );
      },
    };

    return (
      window.TestUtilities?.runTestSuite("LatexRegistryManager", tests) ||
      fallbackTesting("LatexRegistryManager", tests)
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
    // Core registry functions
    initialiseGlobalRegistries,
    storeInGlobalRegistries,

    // Retrieval functions
    getLatexByIndex,
    getLatexByPosition,

    // Status and management
    getRegistryStatus,
    coordinatedCleanup,
    clearGlobalRegistries,

    // Testing
    testLatexRegistryManager,
  };
})();

window.LatexRegistryManager = LatexRegistryManager;
