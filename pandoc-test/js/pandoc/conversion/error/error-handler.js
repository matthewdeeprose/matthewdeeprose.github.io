// error-handler.js
// Error Handler Core - Main error orchestration and recovery strategies
// Part of Enhanced Pandoc-WASM Mathematical Playground modular refactoring Phase 6

const ErrorHandler = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("ERROR_HANDLER", {
    level: window.LoggingSystem.LOG_LEVELS.WARN,
  }) || {
    logError: console.error.bind(console, "[ERROR_HANDLER]"),
    logWarn: console.warn.bind(console, "[ERROR_HANDLER]"),
    logInfo: console.log.bind(console, "[ERROR_HANDLER]"),
    logDebug: console.log.bind(console, "[ERROR_HANDLER]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // ERROR HANDLER CORE IMPLEMENTATION
  // ===========================================================================================

  /**
   * Handle WebAssembly and Pandoc-specific errors with graceful fallback
   * Main error orchestration with attempt tracking and recovery strategies
   * @param {Error} error - The error that occurred
   * @param {string} inputText - The input text that caused the error
   * @param {string} argumentsText - The Pandoc arguments used
   * @param {number} attempt - Current attempt number (default: 1)
   * @param {Object} dependencies - Required dependencies for error handling
   * @returns {Promise<boolean>} - Success/failure of error handling
   */
  async function handleConversionError(
    error,
    inputText,
    argumentsText,
    attempt = 1,
    dependencies = {}
  ) {
    logError(`Conversion error (attempt ${attempt}):`, error);

    const errorMessage = error.message || error.toString();
    const isMemoryError =
      errorMessage.includes("out of memory") ||
      errorMessage.includes("Stack space overflow") ||
      errorMessage.includes("Maximum call stack");
    const isWasmError =
      errorMessage.includes("wasm") ||
      errorMessage.includes("WebAssembly") ||
      errorMessage.includes("trap");
    const isTimeoutError =
      errorMessage.includes("timeout") || errorMessage.includes("Timeout");

    // Extract required dependencies
    const {
      processInChunks,
      attemptSimplifiedConversion,
      generateUserFriendlyErrorMessage,
      announceErrorToScreenReader,
      setErrorOutput,
      statusManager,
    } = dependencies;

    // Attempt recovery strategies based on error type
    if (isMemoryError && attempt === 1) {
      logWarn("Memory error detected - attempting chunked processing");

      if (processInChunks && typeof processInChunks === "function") {
        try {
          return await processInChunks(inputText, argumentsText);
        } catch (chunkError) {
          logError("Chunked processing also failed:", chunkError);
          // Continue to other recovery strategies
        }
      } else {
        logWarn("Chunked processing not available for memory error recovery");
      }
    }

    if (isWasmError && attempt === 1) {
      logWarn("WebAssembly error detected - attempting simplified arguments");

      if (
        attemptSimplifiedConversion &&
        typeof attemptSimplifiedConversion === "function"
      ) {
        try {
          const simplifiedArgs = "--from latex --to html5 --mathml";
          return await attemptSimplifiedConversion(inputText, simplifiedArgs);
        } catch (simplifiedError) {
          logError("Simplified conversion also failed:", simplifiedError);
          // Continue to error display
        }
      } else {
        logWarn(
          "Simplified conversion not available for WebAssembly error recovery"
        );
      }
    }

    if (isTimeoutError) {
      logWarn("Timeout error detected - document may be too complex");
    }

    // Generate user-friendly error message
    let userMessage =
      "Conversion failed. Please check LaTeX syntax and try again.";
    if (
      generateUserFriendlyErrorMessage &&
      typeof generateUserFriendlyErrorMessage === "function"
    ) {
      try {
        userMessage = generateUserFriendlyErrorMessage(error, errorMessage);
      } catch (messageError) {
        logError("Error generating user-friendly message:", messageError);
        // Use fallback message above
      }
    }

    // Set error output
    if (setErrorOutput && typeof setErrorOutput === "function") {
      try {
        setErrorOutput(new Error(userMessage));
      } catch (outputError) {
        logError("Error setting error output:", outputError);
      }
    }

    // Update status manager
    if (statusManager && statusManager.setError) {
      try {
        statusManager.setError(`Conversion failed: ${userMessage}`);
      } catch (statusError) {
        logError("Error updating status manager:", statusError);
      }
    }

    // Announce error to screen readers
    if (
      announceErrorToScreenReader &&
      typeof announceErrorToScreenReader === "function"
    ) {
      try {
        announceErrorToScreenReader(userMessage);
      } catch (announcementError) {
        logError("Error announcing to screen reader:", announcementError);
      }
    }

    logError("Error handling completed - all recovery strategies exhausted");
    return false;
  }

  /**
   * Analyse error type and determine recovery strategy
   * @param {Error} error - The error to analyse
   * @returns {Object} - Error analysis and recommended strategy
   */
  function analyseError(error) {
    const errorMessage = error.message || error.toString();

    const analysis = {
      type: "unknown",
      severity: "medium",
      recoverable: true,
      strategy: "retry",
      details: errorMessage,
    };

    // Memory errors
    if (
      errorMessage.includes("out of memory") ||
      errorMessage.includes("Stack space overflow") ||
      errorMessage.includes("Maximum call stack")
    ) {
      analysis.type = "memory";
      analysis.severity = "high";
      analysis.strategy = "chunked_processing";
    }
    // WebAssembly errors
    else if (
      errorMessage.includes("wasm") ||
      errorMessage.includes("WebAssembly") ||
      errorMessage.includes("trap")
    ) {
      analysis.type = "webassembly";
      analysis.severity = "high";
      analysis.strategy = "simplified_conversion";
    }
    // Timeout errors
    else if (
      errorMessage.includes("timeout") ||
      errorMessage.includes("Timeout")
    ) {
      analysis.type = "timeout";
      analysis.severity = "medium";
      analysis.strategy = "chunked_processing";
    }
    // Syntax errors
    else if (
      errorMessage.includes("syntax") ||
      errorMessage.includes("parse") ||
      errorMessage.includes("Unknown command")
    ) {
      analysis.type = "syntax";
      analysis.severity = "low";
      analysis.strategy = "user_correction";
      analysis.recoverable = false;
    }

    logDebug("Error analysis:", analysis);
    return analysis;
  }

  /**
   * Create error recovery context with available dependencies
   * @param {Object} conversionManager - The conversion manager instance
   * @returns {Object} - Error handling dependencies
   */
  function createErrorContext(conversionManager) {
    if (!conversionManager) {
      logWarn("No conversion manager provided for error context");
      return {};
    }

    return {
      processInChunks:
        conversionManager.processInChunks?.bind(conversionManager),
      attemptSimplifiedConversion:
        conversionManager.attemptSimplifiedConversion?.bind(conversionManager),
      generateUserFriendlyErrorMessage:
        conversionManager.generateUserFriendlyErrorMessage?.bind(
          conversionManager
        ),
      announceErrorToScreenReader:
        conversionManager.announceErrorToScreenReader?.bind(conversionManager),
      setErrorOutput: conversionManager.setErrorOutput?.bind(conversionManager),
      statusManager: window.StatusManager,
    };
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testErrorHandler() {
    const tests = {
      moduleExists: () => !!window.ErrorHandler,

      hasMainFunction: () => typeof handleConversionError === "function",

      hasAnalysisFunction: () => typeof analyseError === "function",

      errorAnalysis: () => {
        const memoryError = new Error("out of memory");
        const analysis = analyseError(memoryError);
        return (
          analysis.type === "memory" &&
          analysis.strategy === "chunked_processing"
        );
      },

      wasmErrorAnalysis: () => {
        const wasmError = new Error("WebAssembly trap");
        const analysis = analyseError(wasmError);
        return (
          analysis.type === "webassembly" &&
          analysis.strategy === "simplified_conversion"
        );
      },

      syntaxErrorAnalysis: () => {
        const syntaxError = new Error("syntax error");
        const analysis = analyseError(syntaxError);
        return analysis.type === "syntax" && !analysis.recoverable;
      },

      contextCreation: () => {
        const mockManager = {
          processInChunks: () => {},
          setErrorOutput: () => {},
        };
        const context = createErrorContext(mockManager);
        return typeof context.processInChunks === "function";
      },

      errorHandlingWithoutDependencies: async () => {
        try {
          const testError = new Error("Test error");
          const result = await handleConversionError(
            testError,
            "test",
            "test",
            1,
            {}
          );
          return result === false; // Should fail gracefully without dependencies
        } catch (error) {
          return false;
        }
      },

      integrationReadiness: () => {
        return (
          typeof handleConversionError === "function" &&
          typeof analyseError === "function" &&
          typeof createErrorContext === "function"
        );
      },
    };

    return (
      window.TestUtilities?.runTestSuite("ErrorHandler", tests) ||
      fallbackTesting("ErrorHandler", tests)
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
    // Core error handling functions
    handleConversionError,
    analyseError,
    createErrorContext,

    // Testing
    testErrorHandler,
  };
})();

// Make globally available
window.ErrorHandler = ErrorHandler;
