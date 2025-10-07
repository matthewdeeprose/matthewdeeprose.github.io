// fallback-workflow-manager.js
// Fallback Workflow Manager - Fallback conversion workflows and state management
// Part of Enhanced Pandoc-WASM Mathematical Playground modular refactoring Phase 7 Step 27

const FallbackWorkflowManager = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("FALLBACK_WORKFLOW", {
    level: window.LoggingSystem.LOG_LEVELS.WARN,
  }) || {
    logError: console.error.bind(console, "[FALLBACK_WORKFLOW]"),
    logWarn: console.warn.bind(console, "[FALLBACK_WORKFLOW]"),
    logInfo: console.log.bind(console, "[FALLBACK_WORKFLOW]"),
    logDebug: console.log.bind(console, "[FALLBACK_WORKFLOW]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // FALLBACK IMPLEMENTATION SYSTEM COORDINATION
  // ===========================================================================================

  /**
   * Initialize fallback state management when StateManager module not available
   * EXTRACTED: From final-coordination-manager.js initializeFallbackState method
   */
  function initializeFallbackState(conversionManager) {
    if (!conversionManager) {
      logError(
        "No conversion manager provided for fallback state initialization"
      );
      return false;
    }

    try {
      conversionManager._isReady = false;
      conversionManager._isInitialised = false;
      conversionManager._conversionInProgress = false;
      conversionManager._isConversionQueued = false;
      conversionManager.lastConversionTime = 0;
      conversionManager.DEBOUNCE_DELAY = 800;
      conversionManager.maxComplexityScore = 50;
      conversionManager.maxDocumentLength = 10000;
      conversionManager.defaultTimeout = 10000;
      conversionManager._activeTimeouts = new Set();
      conversionManager.memoryOptimisationEnabled = true;
      conversionManager.pollingTimeouts = new Set();
      conversionManager._automaticConversionsDisabled = false;

      logInfo("✅ Fallback state management initialized");
      return true;
    } catch (error) {
      logError("Failed to initialize fallback state:", error);
      return false;
    }
  }

  /**
   * Fallback conversion workflow when ConversionOrchestrator not available
   * EXTRACTED: From final-coordination-manager.js fallbackConversionWorkflow method
   */
  async function fallbackConversionWorkflow(
    conversionManager,
    inputText,
    argumentsText
  ) {
    logWarn("Using fallback conversion workflow");

    if (!conversionManager) {
      logError("No conversion manager provided for fallback workflow");
      return false;
    }

    try {
      // ENHANCEMENT: Assess document complexity before processing
      const complexity = conversionManager.assessDocumentComplexity(inputText);
      logInfo(
        `Document complexity: ${complexity.level} (score: ${
          complexity.score?.toFixed(1) || "unknown"
        })`
      );

      // Update status with complexity information
      if (window.StatusManager) {
        const complexityMessage = complexity.requiresChunking
          ? `Processing complex ${complexity.level} document...`
          : `Converting ${complexity.level} document...`;
        window.StatusManager.updateConversionStatus("CONVERT_START", 10);
        window.StatusManager.setLoading(complexityMessage, 15);
      }

      // Small delay to allow UI to update
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check for comparison mode first
      const comparisonResult = await conversionManager.handleComparisonMode(
        inputText,
        argumentsText
      );

      if (comparisonResult !== null) {
        // Comparison mode handled the conversion
        logInfo("✅ Comparison mode conversion completed");
        return true;
      }

      // Choose processing strategy based on complexity
      let conversionResult;

      if (complexity.requiresChunking) {
        logInfo("Document requires chunked processing due to complexity");
        conversionResult = await conversionManager.processInChunks(
          inputText,
          argumentsText
        );
      } else {
        // Standard processing with enhanced error handling
        conversionResult = await performStandardConversion(
          conversionManager,
          inputText,
          argumentsText,
          complexity
        );
      }

      return conversionResult;
    } catch (fallbackError) {
      logError("Fallback conversion workflow failed:", fallbackError);
      throw fallbackError;
    }
  }

  /**
   * Perform standard conversion with enhanced monitoring and error detection
   * EXTRACTED: From final-coordination-manager.js performStandardConversion method
   */
  async function performStandardConversion(
    conversionManager,
    inputText,
    userArgumentsText,
    complexity
  ) {
    try {
      // 🔍 DEBUG: Log the user's arguments before any processing
      logInfo("🔍 DEBUGGING: User's original arguments:");
      logInfo(`User args: "${userArgumentsText}"`);
      console.log("🔍 USER ARGS DEBUG:", userArgumentsText);

      // 🧪 INVESTIGATION: Check if we should use enhanced arguments
      // FIXED: Use user's manually entered arguments as the base, not some other baseArgumentsText
      const finalArgumentsText =
        conversionManager.generateEnhancedPandocArgs(userArgumentsText);

      // 🔍 DEBUG: Log the final arguments after processing
      logInfo("🔍 DEBUGGING: Final arguments after enhancement processing:");
      logInfo(`Final args: "${finalArgumentsText}"`);
      console.log("🔍 FINAL ARGS DEBUG:", finalArgumentsText);

      // Set up timeout based on estimated processing time
      const timeoutMs = Math.max(complexity.estimatedProcessingTime, 5000);
      logDebug(`Setting conversion timeout to ${timeoutMs}ms`);

      // 🎯 BREAKTHROUGH: Extract and preserve original LaTeX BEFORE Pandoc processing
      logInfo(
        "🔍 Extracting original LaTeX expressions for annotation preservation..."
      );
      const originalLatexMap =
        conversionManager.extractAndMapLatexExpressions(inputText);
      const orderedExpressions = Object.values(originalLatexMap).sort(
        (a, b) => a.position - b.position
      );

      // Store in global registries for annotation injection
      window.originalLatexRegistry = originalLatexMap;
      window.originalLatexByPosition = orderedExpressions.map(
        (expr) => expr.latex
      );

      logInfo(
        `✅ Preserved ${orderedExpressions.length} original LaTeX expressions for clean annotations`
      );

      if (window.StatusManager) {
        window.StatusManager.updateConversionStatus("CONVERT_MATH", 40);
      }

      // ENHANCEMENT: Wrap Pandoc call with timeout and memory monitoring
      const conversionPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error(`Conversion timeout after ${timeoutMs}ms`));
        }, timeoutMs);

        try {
          // 🔍 DEBUG: Log exactly what arguments we're passing to Pandoc
          logInfo("🔍 DEBUGGING: Final arguments being passed to Pandoc:");
          logInfo(`Arguments: "${finalArgumentsText}"`);
          console.log("🔍 PANDOC ARGS DEBUG:", finalArgumentsText);

          const output = conversionManager.pandocFunction(
            finalArgumentsText,
            inputText
          );
          resolve(output);
        } catch (error) {
          reject(error);
        }
      });

      // Add timeout wrapper
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Conversion timeout after ${timeoutMs}ms - document may be too complex`
            )
          );
        }, timeoutMs);
      });

      const output = await Promise.race([conversionPromise, timeoutPromise]);

      if (window.StatusManager) {
        window.StatusManager.updateConversionStatus("CONVERT_CLEAN", 70);
      }

      // Clean and process output with original LaTeX input for cross-reference fixing
      const cleanOutput = conversionManager.cleanPandocOutput(
        output,
        inputText
      );

      // Set output content
      if (conversionManager.outputDiv) {
        conversionManager.outputDiv.innerHTML = cleanOutput;
      }

      if (window.StatusManager) {
        window.StatusManager.updateConversionStatus("CONVERT_MATHJAX", 85);
      }

      // Re-render MathJax
      await conversionManager.renderMathJax();

      // Final success status
      if (window.StatusManager) {
        const enhancedMode = document.getElementById(
          "pandoc-enhanced-mode"
        )?.checked;
        const successMessage = enhancedMode
          ? `🧪 Enhanced ${complexity.level} document converted. Check output for improvements.`
          : complexity.level === "basic"
          ? " Conversion complete! Ready for export."
          : ` ${complexity.level} document converted. Ready for export.`;
        window.StatusManager.setReady(successMessage);
      }

      return true;
    } catch (standardError) {
      logError("Standard conversion failed:", standardError);
      throw standardError; // Will be caught by main convertInput method
    }
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testFallbackWorkflowManager() {
    const tests = {
      moduleExists: () => !!window.FallbackWorkflowManager,

      hasInitializeFallbackState: () =>
        typeof initializeFallbackState === "function",

      hasFallbackConversionWorkflow: () =>
        typeof fallbackConversionWorkflow === "function",

      hasPerformStandardConversion: () =>
        typeof performStandardConversion === "function",

      fallbackStateInitialization: () => {
        const mockManager = {};
        const result = initializeFallbackState(mockManager);
        return (
          result === true &&
          mockManager._isReady === false &&
          mockManager._isInitialised === false &&
          mockManager.DEBOUNCE_DELAY === 800
        );
      },

      integrationReadiness: () => {
        return !!(
          initializeFallbackState &&
          fallbackConversionWorkflow &&
          performStandardConversion
        );
      },
    };

    return (
      window.TestUtilities?.runTestSuite("FallbackWorkflowManager", tests) ||
      fallbackTesting("FallbackWorkflowManager", tests)
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
    // Fallback System Coordination
    initializeFallbackState,
    fallbackConversionWorkflow,
    performStandardConversion,

    // Testing
    testFallbackWorkflowManager,
  };
})();

// Make globally available
window.FallbackWorkflowManager = FallbackWorkflowManager;
