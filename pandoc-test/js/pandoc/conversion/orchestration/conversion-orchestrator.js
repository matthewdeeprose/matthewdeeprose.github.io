// conversion-orchestrator.js
// Conversion Orchestrator - Main conversion workflow coordination
// Part of Enhanced Pandoc-WASM Mathematical Playground modular refactoring Phase 7

const ConversionOrchestrator = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger(
    "CONVERSION_ORCHESTRATOR",
    {
      level: window.LoggingSystem.LOG_LEVELS.INFO,
    }
  ) || {
    logError: console.error.bind(console, "[CONVERSION_ORCHESTRATOR]"),
    logWarn: console.warn.bind(console, "[CONVERSION_ORCHESTRATOR]"),
    logInfo: console.log.bind(console, "[CONVERSION_ORCHESTRATOR]"),
    logDebug: console.log.bind(console, "[CONVERSION_ORCHESTRATOR]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // CONVERSION ORCHESTRATION IMPLEMENTATION
  // ===========================================================================================

  /**
   * Orchestrate the main conversion workflow
   * Coordinates complexity assessment, strategy selection, and conversion execution
   * @param {string} inputText - The LaTeX input text
   * @param {string} userArgumentsText - User-provided Pandoc arguments
   * @param {Object} dependencies - Required dependencies for conversion
   * @returns {Promise<boolean>} - Success/failure of conversion
   */
  async function orchestrateConversion(
    inputText,
    userArgumentsText,
    dependencies = {}
  ) {
    logInfo("🚀 Starting conversion orchestration...");

    try {
      const {
        assessDocumentComplexity,
        generateEnhancedPandocArgs,
        handleComparisonMode,
        processInChunks,
        performStandardConversion,
        statusManager,
      } = dependencies;

      // ENHANCEMENT: Assess document complexity before processing
      const complexity = assessDocumentComplexity
        ? assessDocumentComplexity(inputText)
        : {
            level: "unknown",
            requiresChunking: false,
            estimatedProcessingTime: 5000,
          };

      logInfo(
        `Document complexity: ${complexity.level} (score: ${
          complexity.score?.toFixed(1) || "unknown"
        })`
      );

      // ENHANCED: Use EventCoordinator for start event handling
      if (window.EventCoordinator) {
        const eventContext = window.EventCoordinator.createEventContext(
          dependencies.conversionManager
        );
        await window.EventCoordinator.coordinateConversionEvent(
          "start",
          {
            statusManager,
            complexity,
          },
          eventContext
        );
      } else {
        // Fallback: Direct status management
        if (statusManager) {
          const complexityMessage = complexity.requiresChunking
            ? `Processing complex ${complexity.level} document...`
            : `Converting ${complexity.level} document...`;
          statusManager.updateConversionStatus("CONVERT_START", 10);
          statusManager.setLoading(complexityMessage, 15);
        }

        // Small delay to allow UI to update
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // INVESTIGATION: Check for comparison mode first
      if (handleComparisonMode) {
        const comparisonResult = await handleComparisonMode(
          inputText,
          userArgumentsText
        );
        if (comparisonResult !== null) {
          logInfo("✅ Comparison mode conversion completed");
          return true;
        }
      }

      // ENHANCEMENT: Choose processing strategy based on complexity
      let conversionResult;

      if (complexity.requiresChunking && processInChunks) {
        logInfo("Document requires chunked processing due to complexity");
        conversionResult = await processInChunks(inputText, userArgumentsText);
      } else if (performStandardConversion) {
        // Standard processing with enhanced orchestration
        conversionResult = await executeStandardConversion(
          inputText,
          userArgumentsText,
          complexity,
          dependencies
        );
      } else {
        logError("No suitable conversion method available");
        return false;
      }

      if (conversionResult) {
        logInfo("✅ Conversion orchestration completed successfully");
      }

      return conversionResult;
    } catch (error) {
      logError("Conversion orchestration error:", error);
      throw error; // Re-throw for higher-level error handling
    }
  }

  /**
   * Execute standard conversion with enhanced monitoring and error detection
   * @param {string} inputText - The LaTeX input text
   * @param {string} userArgumentsText - User-provided Pandoc arguments
   * @param {Object} complexity - Document complexity analysis
   * @param {Object} dependencies - Required dependencies
   * @returns {Promise<boolean>} - Success/failure of conversion
   */
  async function executeStandardConversion(
    inputText,
    userArgumentsText,
    complexity,
    dependencies
  ) {
    try {
      const {
        generateEnhancedPandocArgs,
        extractAndMapLatexExpressions,
        pandocFunction,
        cleanPandocOutput,
        renderMathJax,
        outputDiv,
        statusManager,
      } = dependencies;

      // Debug logging for argument processing
      logInfo("🔍 Processing arguments for standard conversion:");
      logInfo(`User args: "${userArgumentsText}"`);

      // Generate enhanced arguments if available
      const finalArgumentsText = generateEnhancedPandocArgs
        ? generateEnhancedPandocArgs(userArgumentsText)
        : userArgumentsText;

      logInfo("🔍 Final arguments after enhancement:");
      logInfo(`Final args: "${finalArgumentsText}"`);

      // Set up timeout based on estimated processing time
      const timeoutMs = Math.max(
        complexity.estimatedProcessingTime || 5000,
        5000
      );
      logDebug(`Setting conversion timeout to ${timeoutMs}ms`);

      // PHASE 1F PART B: Populate environment registry BEFORE Pandoc conversion
      // This ensures restoration has data to work with on first conversion
      if (window.MathJaxManagerInstance?.registerSourceEnvironments) {
        try {
          window.MathJaxManagerInstance.registerSourceEnvironments(inputText);
          logInfo("✅ Populated environment registry before Pandoc conversion");
        } catch (registryError) {
          logWarn("⚠️ Failed to populate environment registry:", registryError);
        }
      }

      // BREAKTHROUGH: Extract and preserve original LaTeX BEFORE Pandoc processing
      if (extractAndMapLatexExpressions) {
        logInfo(
          "🔍 Extracting original LaTeX expressions for annotation preservation..."
        );
        const originalLatexMap = extractAndMapLatexExpressions(inputText);
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
      }

      // ENHANCED: Use EventCoordinator for processing events
      if (window.EventCoordinator) {
        const eventContext = window.EventCoordinator.createEventContext(
          dependencies.conversionManager
        );
        await window.EventCoordinator.coordinateConversionEvent(
          "processing",
          {
            stage: "CONVERT_MATH",
            progress: 40,
            message: "Processing mathematical expressions...",
          },
          eventContext
        );
      } else {
        if (statusManager) {
          statusManager.updateConversionStatus("CONVERT_MATH", 40);
        }
      }

      // Execute Pandoc conversion with timeout protection
      const output = await executeWithTimeout(
        () => pandocFunction(finalArgumentsText, inputText),
        timeoutMs,
        `Conversion timeout after ${timeoutMs}ms - document may be too complex`
      );

      if (statusManager) {
        statusManager.updateConversionStatus("CONVERT_CLEAN", 70);
      }

      // Clean and process output
      const cleanOutput = cleanPandocOutput
        ? cleanPandocOutput(output)
        : output;

      // PHASE 1F PART B: Restore environment wrappers for playground numbering
      // Pandoc converts environments (align→aligned, gather→gathered) and wraps in \[...\]
      // This prevents MathJax from numbering. We restore original environments from registry.
      let processedOutput = cleanOutput;
      if (window.MathJaxManagerInstance?.restoreEnvironmentWrappersInHTML) {
        try {
          processedOutput =
            window.MathJaxManagerInstance.restoreEnvironmentWrappersInHTML(
              cleanOutput
            );
          logInfo("✅ Restored environment wrappers for playground numbering");

          // DEBUG: Check what we're about to set
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = processedOutput;
          const mathSpans = tempDiv.querySelectorAll("span.math.display");
          logInfo(`🔍 About to set ${mathSpans.length} math spans to DOM`);
          mathSpans.forEach((span, i) => {
            const content = span.textContent.substring(0, 100);
            logInfo(`  Span ${i + 1}: ${content}...`);
            logInfo(
              `    Has \\begin{align}: ${content.includes("\\begin{align}")}`
            );
          });
        } catch (restoreError) {
          logWarn("Failed to restore environment wrappers:", restoreError);
          // Non-critical - use original output
          processedOutput = cleanOutput;
        }
      }

      // Set output content
      if (outputDiv) {
        outputDiv.innerHTML = processedOutput;

        // DEBUG: Check what's in DOM immediately after setting
        const domSpans = outputDiv.querySelectorAll("span.math.display");
        logInfo(`🔍 DOM has ${domSpans.length} spans after innerHTML set`);
        domSpans.forEach((span, i) => {
          const content = span.textContent.substring(0, 100);
          logInfo(`  DOM Span ${i + 1}: ${content}...`);
        });
      }

      // ═══════════════════════════════════════════════════════════════════════════════════════
      // STAGE 5 INTEGRATION: Store original LaTeX for enhanced export method
      // ═══════════════════════════════════════════════════════════════════════════════════════
      // Store original LaTeX after successful conversion for the enhanced processor.
      // This enables custom command preservation in exports without impacting the conversion
      // pipeline. Storage happens automatically and silently - failures are logged but don't
      // break the conversion workflow.
      try {
        if (
          typeof LaTeXProcessorEnhanced !== "undefined" &&
          LaTeXProcessorEnhanced.storeOriginalLatex
        ) {
          const stored = LaTeXProcessorEnhanced.storeOriginalLatex(inputText);
          if (stored) {
            logDebug(
              `✅ Stored ${inputText.length} characters of original LaTeX for enhanced export`
            );
          } else {
            logWarn(
              "[Stage 5] Failed to store original LaTeX - enhanced export features may be unavailable"
            );
          }
        } else {
          logDebug(
            "[Stage 5] LaTeXProcessorEnhanced not available - using legacy export method only"
          );
        }
      } catch (storageError) {
        logWarn("[Stage 5] Error storing original LaTeX:", storageError);
        // Don't break conversion if storage fails - enhanced features are optional
      }
      // ═══════════════════════════════════════════════════════════════════════════════════════

      if (statusManager) {
        statusManager.updateConversionStatus("CONVERT_MATHJAX", 85);
      }

      // ===========================================================================
      // PHASE 1F PART B: Reset equation counter before MathJax rendering
      // This ensures each conversion starts numbering from (1)
      // ===========================================================================
      if (window.MathJaxManagerInstance?.resetEquationCounter) {
        try {
          const resetSuccess =
            window.MathJaxManagerInstance.resetEquationCounter();
          if (resetSuccess) {
            logInfo(
              "✅ Equation counter reset - numbering will start from (1)"
            );
          } else {
            logWarn(
              "⚠️ Counter reset returned false - numbers may continue from previous conversion"
            );
          }
        } catch (resetError) {
          logWarn("⚠️ Failed to reset equation counter:", resetError);
        }
      }
      // ===========================================================================

      // ===========================================================================
      // PHASE 1F PART B FIX: Clear MathJax processing state before re-rendering
      // Problem: MathJax auto-processes content after innerHTML set, caching wrong environments
      // Solution: Clear the processing state for outputDiv, forcing complete re-processing
      // ===========================================================================
      if (renderMathJax && outputDiv) {
        try {
          // Clear MathJax's memory of having processed this container
          if (window.MathJax?.typesetClear) {
            logInfo(
              "🧹 Clearing MathJax processing state for output container..."
            );
            window.MathJax.typesetClear([outputDiv]);
            logInfo("✅ MathJax state cleared - ready for fresh processing");
          } else {
            logWarn(
              "⚠️ MathJax.typesetClear not available - using standard render"
            );
          }

          // Now re-render with correct environments
          logInfo("🔄 Re-rendering MathJax with corrected environments...");
          await renderMathJax();

          // Verify equation numbers were created
          const equationTags = outputDiv.querySelectorAll(
            ".mjx-tag, .mjx-label"
          );
          if (equationTags.length > 0) {
            logInfo(
              `✅ Equation numbering successful: ${equationTags.length} number tags created`
            );
          } else {
            logWarn("⚠️ No equation number tags found after rendering");
          }
        } catch (renderError) {
          logError("Error during MathJax re-rendering:", renderError);
          // Non-fatal - content is still rendered, just might lack proper numbering
        }
      } else if (renderMathJax) {
        // Fallback if outputDiv not available
        await renderMathJax();
      }
      // ===========================================================================

      // Final success status
      if (statusManager) {
        const enhancedMode = document.getElementById(
          "pandoc-enhanced-mode"
        )?.checked;
        const successMessage = enhancedMode
          ? `🧪 Enhanced ${complexity.level} document converted. Check output for improvements.`
          : complexity.level === "basic"
          ? "Conversion complete! Ready for export."
          : `${complexity.level} document converted. Ready for export.`;
        statusManager.setReady(successMessage);
      }

      return true;
    } catch (standardError) {
      logError("Standard conversion execution failed:", standardError);
      throw standardError;
    }
  }

  /**
   * Execute a function with timeout protection
   * @param {Function} fn - Function to execute
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} timeoutMessage - Error message for timeout
   * @returns {Promise} - Promise that resolves with function result or rejects on timeout
   */
  async function executeWithTimeout(fn, timeoutMs, timeoutMessage) {
    const conversionPromise = new Promise((resolve, reject) => {
      try {
        const result = fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    });

    return Promise.race([conversionPromise, timeoutPromise]);
  }

  /**
   * Create orchestration context with available dependencies
   * @param {Object} conversionManager - The conversion manager instance
   * @returns {Object} - Orchestration dependencies
   */
  function createOrchestrationContext(conversionManager) {
    if (!conversionManager) {
      logWarn("No conversion manager provided for orchestration context");
      return {};
    }

    return {
      // Include the original conversion manager for EventCoordinator
      conversionManager: conversionManager,

      // Bound methods for orchestration
      assessDocumentComplexity:
        conversionManager.assessDocumentComplexity?.bind(conversionManager),
      generateEnhancedPandocArgs:
        conversionManager.generateEnhancedPandocArgs?.bind(conversionManager),
      handleComparisonMode:
        conversionManager.handleComparisonMode?.bind(conversionManager),
      processInChunks:
        conversionManager.processInChunks?.bind(conversionManager),
      performStandardConversion:
        conversionManager.performStandardConversion?.bind(conversionManager),
      extractAndMapLatexExpressions:
        conversionManager.extractAndMapLatexExpressions?.bind(
          conversionManager
        ),
      cleanPandocOutput:
        conversionManager.cleanPandocOutput?.bind(conversionManager),
      renderMathJax: conversionManager.renderMathJax?.bind(conversionManager),
      pandocFunction: conversionManager.pandocFunction,
      outputDiv: conversionManager.outputDiv,
      statusManager: window.StatusManager,
    };
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testConversionOrchestrator() {
    const tests = {
      moduleExists: () => !!window.ConversionOrchestrator,

      hasOrchestrationFunction: () =>
        typeof orchestrateConversion === "function",

      hasStandardConversionFunction: () =>
        typeof executeStandardConversion === "function",

      hasTimeoutUtility: () => typeof executeWithTimeout === "function",

      hasContextCreation: () =>
        typeof createOrchestrationContext === "function",

      contextCreationWorks: () => {
        const mockManager = {
          assessDocumentComplexity: () => ({}),
          pandocFunction: () => "test",
          outputDiv: {},
        };
        const context = createOrchestrationContext(mockManager);
        return (
          context && typeof context.assessDocumentComplexity === "function"
        );
      },

      timeoutUtilityWorks: async () => {
        try {
          const result = await executeWithTimeout(
            () => "success",
            1000,
            "timeout"
          );
          return result === "success";
        } catch (error) {
          return false;
        }
      },

      errorHandling: () => {
        try {
          createOrchestrationContext(null);
          return true; // Should not throw, just return empty object
        } catch (error) {
          return false;
        }
      },

      integrationReadiness: () => {
        return (
          typeof orchestrateConversion === "function" &&
          typeof createOrchestrationContext === "function"
        );
      },
    };

    return (
      window.TestUtilities?.runTestSuite("ConversionOrchestrator", tests) ||
      fallbackTesting("ConversionOrchestrator", tests)
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
        if (result === true || (result && result.then)) {
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
    // Core orchestration functions
    orchestrateConversion,
    executeStandardConversion,
    executeWithTimeout,
    createOrchestrationContext,

    // Testing
    testConversionOrchestrator,
  };
})();

window.ConversionOrchestrator = ConversionOrchestrator;
