// fallback-coordinator.js
// Fallback Coordinator - Conversion fallback strategies and simplified processing
// Part of Enhanced Pandoc-WASM Mathematical Playground modular refactoring Phase 6

const FallbackCoordinator = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("FALLBACK_COORD", {
    level: window.LoggingSystem.LOG_LEVELS.WARN,
  }) || {
    logError: console.error.bind(console, "[FALLBACK_COORD]"),
    logWarn: console.warn.bind(console, "[FALLBACK_COORD]"),
    logInfo: console.log.bind(console, "[FALLBACK_COORD]"),
    logDebug: console.log.bind(console, "[FALLBACK_COORD]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // FALLBACK COORDINATOR IMPLEMENTATION
  // ===========================================================================================

  /**
   * Attempt simplified conversion with reduced arguments
   * Provides fallback conversion strategies when primary conversion fails
   * @param {string} inputText - The LaTeX input text
   * @param {string} simplifiedArgs - Simplified Pandoc arguments
   * @param {Function} pandocFunction - The Pandoc conversion function
   * @param {Object} dependencies - Required dependencies for conversion
   * @returns {Promise<boolean>} - Success/failure of simplified conversion
   */
  async function attemptSimplifiedConversion(
    inputText,
    simplifiedArgs,
    pandocFunction,
    dependencies = {}
  ) {
    logInfo("Attempting simplified conversion with reduced arguments");

    if (!pandocFunction || typeof pandocFunction !== "function") {
      logError("Pandoc function not available for simplified conversion");
      return false;
    }

    const { outputDiv, statusManager, renderMathJax, cleanPandocOutput } =
      dependencies;

    try {
      // Update status if available
      if (statusManager && statusManager.setLoading) {
        statusManager.setLoading("Retrying with simplified processing...", 50);
      }

      // Create timeout wrapper for simplified conversion
      const simplifiedPromise = new Promise((resolve, reject) => {
        try {
          const output = pandocFunction(simplifiedArgs, inputText);
          resolve(output);
        } catch (simplifiedError) {
          reject(simplifiedError);
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Simplified conversion timeout"));
        }, 8000); // 8 second timeout for simplified conversion
      });

      const output = await Promise.race([simplifiedPromise, timeoutPromise]);

      // Clean output using available cleaner with LaTeX input for cross-reference fixing
      let cleanOutput = output;
      if (cleanPandocOutput && typeof cleanPandocOutput === "function") {
        cleanOutput = cleanPandocOutput(output, inputText);
      } else {
        cleanOutput = output ? output.trim() : "";
      }

      // Set output content
      if (outputDiv) {
        outputDiv.innerHTML = cleanOutput;
      }

      // Re-render MathJax if available
      if (renderMathJax && typeof renderMathJax === "function") {
        await renderMathJax();
      }

      // Update status to success
      if (statusManager && statusManager.setReady) {
        statusManager.setReady("✅ Simplified conversion completed");
      }

      logInfo("✅ Simplified conversion successful");
      return true;
    } catch (simplifiedError) {
      logError("Simplified conversion also failed:", simplifiedError);

      // Update status to show simplified conversion failed
      if (statusManager && statusManager.setError) {
        statusManager.setError(
          "Both standard and simplified conversion failed"
        );
      }

      return false;
    }
  }

  /**
   * Generate simplified Pandoc arguments for fallback conversion
   * Creates progressively simpler argument sets for different fallback levels
   * @param {string} originalArgs - Original Pandoc arguments
   * @param {number} fallbackLevel - Level of simplification (1-4)
   * @returns {string} - Simplified Pandoc arguments
   */
  function generateSimplifiedArgs(originalArgs = "", fallbackLevel = 1) {
    logDebug(`Generating simplified args at fallback level ${fallbackLevel}`);

    // Fallback level 1: Remove complex features but keep MathJax
    if (fallbackLevel === 1) {
      return "--from latex --to html5 --mathjax";
    }

    // Fallback level 2: Use MathML instead of MathJax
    if (fallbackLevel === 2) {
      return "--from latex --to html5 --mathml";
    }

    // Fallback level 3: Plain HTML with minimal math
    if (fallbackLevel === 3) {
      return "--from latex --to html5";
    }

    // Fallback level 4: Absolute minimal conversion
    if (fallbackLevel === 4) {
      return "--from latex --to html";
    }

    // Default fallback
    return "--from latex --to html5 --mathjax";
  }

  /**
   * Attempt progressive fallback conversion
   * Tries multiple levels of simplified conversion progressively
   * @param {string} inputText - The LaTeX input text
   * @param {string} originalArgs - Original Pandoc arguments
   * @param {Function} pandocFunction - The Pandoc conversion function
   * @param {Object} dependencies - Required dependencies for conversion
   * @returns {Promise<Object>} - Result of progressive fallback attempt
   */
  async function attemptProgressiveFallback(
    inputText,
    originalArgs,
    pandocFunction,
    dependencies = {}
  ) {
    logInfo("Starting progressive fallback conversion sequence");

    const maxFallbackLevels = 4;
    const { statusManager } = dependencies;

    for (let level = 1; level <= maxFallbackLevels; level++) {
      try {
        logInfo(`Attempting fallback level ${level}/${maxFallbackLevels}`);

        // Update status for each attempt
        if (statusManager && statusManager.setLoading) {
          statusManager.setLoading(
            `Trying simplified conversion (attempt ${level}/${maxFallbackLevels})...`,
            30 + level * 15
          );
        }

        const simplifiedArgs = generateSimplifiedArgs(originalArgs, level);
        logDebug(`Level ${level} args: ${simplifiedArgs}`);

        const success = await attemptSimplifiedConversion(
          inputText,
          simplifiedArgs,
          pandocFunction,
          dependencies
        );

        if (success) {
          logInfo(`✅ Progressive fallback succeeded at level ${level}`);
          return {
            success: true,
            level: level,
            args: simplifiedArgs,
            message: `Conversion succeeded with simplified processing (level ${level})`,
          };
        }

        logWarn(`Fallback level ${level} failed, trying next level...`);
      } catch (levelError) {
        logError(`Fallback level ${level} error:`, levelError);
        // Continue to next level
      }
    }

    logError("All progressive fallback levels exhausted");
    return {
      success: false,
      level: maxFallbackLevels,
      args: null,
      message: "All fallback conversion strategies failed",
    };
  }

  /**
   * Determine if content is suitable for simplified conversion
   * Analyses content complexity to recommend fallback strategies
   * @param {string} inputText - The LaTeX input text
   * @returns {Object} - Suitability assessment for fallback conversion
   */
  function assessFallbackSuitability(inputText) {
    if (!inputText || typeof inputText !== "string") {
      return {
        suitable: false,
        recommendedLevel: 4,
        reasons: ["No input text provided"],
      };
    }

    const analysis = {
      suitable: true,
      recommendedLevel: 1,
      reasons: [],
      features: {
        mathExpressions: (inputText.match(/\$[^$]*\$/g) || []).length,
        displayMath: (inputText.match(/\$\$[\s\S]*?\$\$/g) || []).length,
        environments: (inputText.match(/\\begin\{[^}]+\}/g) || []).length,
        customCommands: (inputText.match(/\\newcommand/g) || []).length,
        packages: (inputText.match(/\\usepackage/g) || []).length,
        length: inputText.length,
      },
    };

    // Assess complexity and recommend fallback level
    let complexityScore = 0;

    // Math complexity
    complexityScore += analysis.features.mathExpressions * 0.5;
    complexityScore += analysis.features.displayMath * 1;
    complexityScore += analysis.features.environments * 2;

    // Document structure complexity
    complexityScore += analysis.features.customCommands * 3;
    complexityScore += analysis.features.packages * 2;
    complexityScore += Math.floor(analysis.features.length / 1000);

    // Determine recommended fallback level
    if (complexityScore < 5) {
      analysis.recommendedLevel = 1;
      analysis.reasons.push("Low complexity - MathJax fallback suitable");
    } else if (complexityScore < 15) {
      analysis.recommendedLevel = 2;
      analysis.reasons.push("Medium complexity - MathML fallback recommended");
    } else if (complexityScore < 30) {
      analysis.recommendedLevel = 3;
      analysis.reasons.push("High complexity - plain HTML fallback needed");
    } else {
      analysis.recommendedLevel = 4;
      analysis.reasons.push(
        "Very high complexity - minimal conversion required"
      );
    }

    // Check for unsupported features
    if (analysis.features.customCommands > 0) {
      analysis.reasons.push(
        "Custom commands detected - may require higher fallback level"
      );
    }

    if (analysis.features.packages > 5) {
      analysis.reasons.push(
        "Many packages detected - simplified conversion recommended"
      );
    }

    logDebug("Fallback suitability analysis:", analysis);
    return analysis;
  }

  /**
   * Create fallback context with available dependencies
   * Prepares dependency context for fallback conversion attempts
   * @param {Object} conversionManager - The conversion manager instance
   * @returns {Object} - Fallback conversion dependencies
   */
  function createFallbackContext(conversionManager) {
    if (!conversionManager) {
      logWarn("No conversion manager provided for fallback context");
      return {};
    }

    return {
      outputDiv: conversionManager.outputDiv,
      statusManager: window.StatusManager,
      renderMathJax: conversionManager.renderMathJax?.bind(conversionManager),
      cleanPandocOutput:
        conversionManager.cleanPandocOutput?.bind(conversionManager),
      pandocFunction: conversionManager.pandocFunction,
    };
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testFallbackCoordinator() {
    const tests = {
      moduleExists: () => !!window.FallbackCoordinator,

      hasMainFunction: () => typeof attemptSimplifiedConversion === "function",

      hasProgressiveFunction: () =>
        typeof attemptProgressiveFallback === "function",

      simplifiedArgsGeneration: () => {
        const level1 = generateSimplifiedArgs("", 1);
        const level4 = generateSimplifiedArgs("", 4);
        return level1.includes("--mathjax") && level4.includes("--to html");
      },

      fallbackSuitabilityAssessment: () => {
        const simpleText = "Hello $x = 1$ world";
        const complexText =
          "\\usepackage{amsmath} \\newcommand{\\test}{} " +
          "$$\\int_0^1 x dx$$".repeat(10);

        const simpleAssessment = assessFallbackSuitability(simpleText);
        const complexAssessment = assessFallbackSuitability(complexText);

        return (
          simpleAssessment.recommendedLevel <= 2 &&
          complexAssessment.recommendedLevel >= 3
        );
      },

      contextCreation: () => {
        const mockManager = {
          outputDiv: document.createElement("div"),
          renderMathJax: () => {},
          cleanPandocOutput: (text) => text,
          pandocFunction: () => "test output",
        };
        const context = createFallbackContext(mockManager);
        return (
          context.outputDiv &&
          typeof context.renderMathJax === "function" &&
          typeof context.cleanPandocOutput === "function"
        );
      },

      simplifiedConversionWithoutDependencies: async () => {
        try {
          const mockPandoc = () => "mock output";
          const result = await attemptSimplifiedConversion(
            "test",
            "--from latex --to html",
            mockPandoc,
            {}
          );
          return result === true;
        } catch (error) {
          return false;
        }
      },

      progressiveFallbackStructure: async () => {
        try {
          const mockPandoc = () => {
            throw new Error("Mock failure");
          };
          const result = await attemptProgressiveFallback(
            "test",
            "--from latex",
            mockPandoc,
            {}
          );
          return (
            typeof result === "object" &&
            typeof result.success === "boolean" &&
            typeof result.level === "number"
          );
        } catch (error) {
          return false;
        }
      },

      emptyInputHandling: () => {
        const assessment = assessFallbackSuitability("");
        return !assessment.suitable && assessment.reasons.length > 0;
      },

      integrationReadiness: () => {
        return (
          typeof attemptSimplifiedConversion === "function" &&
          typeof attemptProgressiveFallback === "function" &&
          typeof assessFallbackSuitability === "function" &&
          typeof createFallbackContext === "function"
        );
      },
    };

    return (
      window.TestUtilities?.runTestSuite("FallbackCoordinator", tests) ||
      fallbackTesting("FallbackCoordinator", tests)
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
    // Core fallback functions
    attemptSimplifiedConversion,
    attemptProgressiveFallback,

    // Utility functions
    generateSimplifiedArgs,
    assessFallbackSuitability,
    createFallbackContext,

    // Testing
    testFallbackCoordinator,
  };
})();

// Make globally available
window.FallbackCoordinator = FallbackCoordinator;
