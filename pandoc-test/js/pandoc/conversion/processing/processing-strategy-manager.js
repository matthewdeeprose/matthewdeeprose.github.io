// processing-strategy-manager.js
// Processing Strategy Manager - Handles document complexity assessment and processing strategy selection
// Part of Enhanced Pandoc-WASM Mathematical Playground modular refactoring Phase 5

const ProcessingStrategyManager = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger(
    "PROCESSING_STRATEGY",
    {
      level: window.LoggingSystem.LOG_LEVELS.WARN,
    }
  ) || {
    logError: console.error.bind(console, "[PROCESSING_STRATEGY]"),
    logWarn: console.warn.bind(console, "[PROCESSING_STRATEGY]"),
    logInfo: console.log.bind(console, "[PROCESSING_STRATEGY]"),
    logDebug: console.log.bind(console, "[PROCESSING_STRATEGY]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // PROCESSING STRATEGY CONFIGURATION
  // ===========================================================================================

  const PROCESSING_CONFIG = {
    maxComplexityScore: 50, // Threshold for chunked processing
    maxDocumentLength: 10000, // Characters threshold
    defaultTimeout: 10000, // 10 second default timeout

    // Complexity scoring weights
    weights: {
      equations: 1,
      displayMath: 2,
      matrices: 5,
      environments: 2,
      sections: 3,
      tables: 3,
      figures: 2,
      commands: 0.1,
      lengthFactor: 1000, // characters per point
      lineCountFactor: 100, // lines per point
    },

    // Complexity level thresholds
    levels: {
      basic: 10,
      intermediate: 30,
      advanced: 70,
    },
  };

  // ===========================================================================================
  // DOCUMENT COMPLEXITY ASSESSMENT
  // ===========================================================================================

  /**
   * Assess document complexity to determine processing strategy
   * CORE FEATURE: Sophisticated complexity scoring for processing strategy selection
   */
  function assessDocumentComplexity(content) {
    try {
      logDebug("Assessing document complexity...");

      const indicators = {
        equations:
          (content.match(/\$.*?\$/g) || []).length +
          (content.match(/\\\[[\s\S]*?\\\]/g) || []).length,
        displayMath: (content.match(/\$\$[\s\S]*?\$\$/g) || []).length,
        matrices: (content.match(/\\begin\{.*?matrix.*?\}/g) || []).length,
        environments: (content.match(/\\begin\{.*?\}/g) || []).length,
        sections:
          (content.match(/\\section\{/g) || []).length +
          (content.match(/\\subsection\{/g) || []).length,
        tables: (content.match(/\\begin\{table.*?\}/g) || []).length,
        figures: (content.match(/\\begin\{figure.*?\}/g) || []).length,
        commands: (content.match(/\\[a-zA-Z]+/g) || []).length,
        length: content.length,
        lineCount: content.split("\n").length,
      };

      // Calculate complexity score with weighted factors
      const complexityScore =
        indicators.equations * PROCESSING_CONFIG.weights.equations +
        indicators.displayMath * PROCESSING_CONFIG.weights.displayMath +
        indicators.matrices * PROCESSING_CONFIG.weights.matrices +
        indicators.environments * PROCESSING_CONFIG.weights.environments +
        indicators.sections * PROCESSING_CONFIG.weights.sections +
        indicators.tables * PROCESSING_CONFIG.weights.tables +
        indicators.figures * PROCESSING_CONFIG.weights.figures +
        indicators.commands * PROCESSING_CONFIG.weights.commands +
        Math.floor(indicators.length / PROCESSING_CONFIG.weights.lengthFactor) +
        Math.floor(
          indicators.lineCount / PROCESSING_CONFIG.weights.lineCountFactor
        );

      // Determine complexity level
      const level = determineComplexityLevel(complexityScore);

      // Determine if chunked processing is required
      const requiresChunking =
        complexityScore > PROCESSING_CONFIG.maxComplexityScore ||
        indicators.length > PROCESSING_CONFIG.maxDocumentLength;

      // Estimate processing time based on complexity
      const estimatedProcessingTime = Math.min(complexityScore * 100, 15000); // ms

      logInfo(
        `Document complexity assessment: ${level} (score: ${complexityScore.toFixed(
          1
        )})`
      );
      logDebug("Complexity indicators:", indicators);

      return {
        score: complexityScore,
        level: level,
        requiresChunking: requiresChunking,
        indicators: indicators,
        estimatedProcessingTime: estimatedProcessingTime,
        strategy: requiresChunking ? "chunked" : "standard",
        config: {
          timeout: Math.max(
            estimatedProcessingTime,
            PROCESSING_CONFIG.defaultTimeout
          ),
          maxComplexityThreshold: PROCESSING_CONFIG.maxComplexityScore,
          maxLengthThreshold: PROCESSING_CONFIG.maxDocumentLength,
        },
      };
    } catch (error) {
      logError("Error assessing document complexity:", error);
      return createFallbackComplexityResult();
    }
  }

  /**
   * Determine complexity level based on score
   */
  function determineComplexityLevel(score) {
    if (score < PROCESSING_CONFIG.levels.basic) {
      return "Basic";
    } else if (score < PROCESSING_CONFIG.levels.intermediate) {
      return "Intermediate";
    } else if (score < PROCESSING_CONFIG.levels.advanced) {
      return "Advanced";
    } else {
      return "Complex";
    }
  }

  /**
   * Create fallback complexity result for error cases
   */
  function createFallbackComplexityResult() {
    return {
      score: 0,
      level: "Unknown",
      requiresChunking: false,
      indicators: {},
      estimatedProcessingTime: PROCESSING_CONFIG.defaultTimeout,
      strategy: "standard",
      config: {
        timeout: PROCESSING_CONFIG.defaultTimeout,
        maxComplexityThreshold: PROCESSING_CONFIG.maxComplexityScore,
        maxLengthThreshold: PROCESSING_CONFIG.maxDocumentLength,
      },
    };
  }

  // ===========================================================================================
  // PROCESSING STRATEGY SELECTION
  // ===========================================================================================

  /**
   * Select optimal processing strategy based on document characteristics
   */
  function selectProcessingStrategy(content, userPreferences = {}) {
    try {
      const complexity = assessDocumentComplexity(content);

      // Check user preferences for strategy override
      if (userPreferences.forceStrategy) {
        logInfo(
          `User forced processing strategy: ${userPreferences.forceStrategy}`
        );
        complexity.strategy = userPreferences.forceStrategy;
        complexity.forcedByUser = true;
      }

      // Additional strategy refinement based on content characteristics
      const strategyRecommendations = analyzeStrategyRequirements(complexity);

      return {
        ...complexity,
        recommendations: strategyRecommendations,
        selectedStrategy: complexity.strategy,
        reasoning: generateStrategyReasoning(
          complexity,
          strategyRecommendations
        ),
      };
    } catch (error) {
      logError("Error selecting processing strategy:", error);
      return createFallbackComplexityResult();
    }
  }

  /**
   * Analyze specific strategy requirements based on document features
   */
  function analyzeStrategyRequirements(complexity) {
    const recommendations = [];

    if (complexity.indicators.matrices > 5) {
      recommendations.push(
        "Matrix-heavy document - ensure MathJax matrix rendering"
      );
    }

    if (complexity.indicators.sections > 10) {
      recommendations.push(
        "Multi-section document - sequential numbering may be needed"
      );
    }

    if (complexity.indicators.environments > 20) {
      recommendations.push(
        "Environment-heavy document - enhanced LaTeX preservation critical"
      );
    }

    if (complexity.score > 100) {
      recommendations.push(
        "Extremely complex document - consider memory optimization"
      );
    }

    if (complexity.indicators.length > 50000) {
      recommendations.push(
        "Very large document - chunked processing strongly recommended"
      );
    }

    return recommendations;
  }

  /**
   * Generate human-readable reasoning for strategy selection
   */
  function generateStrategyReasoning(complexity, recommendations) {
    const reasons = [];

    if (complexity.strategy === "chunked") {
      reasons.push(
        `Document complexity score (${complexity.score.toFixed(
          1
        )}) exceeds threshold (${PROCESSING_CONFIG.maxComplexityScore})`
      );

      if (complexity.indicators.length > PROCESSING_CONFIG.maxDocumentLength) {
        reasons.push(
          `Document length (${complexity.indicators.length} chars) exceeds limit (${PROCESSING_CONFIG.maxDocumentLength})`
        );
      }
    } else {
      reasons.push(
        `Document complexity (${complexity.level}) suitable for standard processing`
      );
    }

    return {
      primaryReasons: reasons,
      additionalConsiderations: recommendations,
      estimatedTime: `${Math.round(
        complexity.estimatedProcessingTime / 1000
      )}s`,
      memoryImpact:
        complexity.score > 50
          ? "High"
          : complexity.score > 20
          ? "Medium"
          : "Low",
    };
  }

  // ===========================================================================================
  // CONFIGURATION MANAGEMENT
  // ===========================================================================================

  /**
   * Update processing configuration
   */
  function updateProcessingConfig(newConfig) {
    try {
      Object.assign(PROCESSING_CONFIG, newConfig);
      logInfo("Processing configuration updated:", newConfig);
      return true;
    } catch (error) {
      logError("Error updating processing configuration:", error);
      return false;
    }
  }

  /**
   * Get current processing configuration
   */
  function getProcessingConfig() {
    return { ...PROCESSING_CONFIG };
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testProcessingStrategyManager() {
    const tests = {
      moduleExists: () => !!window.ProcessingStrategyManager,

      hasComplexityAssessment: () =>
        typeof ProcessingStrategyManager.assessDocumentComplexity ===
        "function",

      basicComplexityTest: () => {
        const simpleContent = "Hello $x = 1$ world";
        const result = assessDocumentComplexity(simpleContent);
        return (
          result && typeof result.score === "number" && result.level === "Basic"
        );
      },

      complexComplexityTest: () => {
        const complexContent = `
            \\section{Test} \\subsection{Math}
            $$\\begin{matrix} 1 & 2 \\\\ 3 & 4 \\end{matrix}$$
            \\begin{theorem} Test \\end{theorem}
            \\begin{figure} Test \\end{figure}
            \\begin{table} Test \\end{table}
          `.repeat(10);
        const result = assessDocumentComplexity(complexContent);
        return result && result.score > 50 && result.requiresChunking;
      },

      strategySelection: () => {
        const content = "Simple $x$ test";
        const strategy = selectProcessingStrategy(content);
        return strategy && strategy.selectedStrategy === "standard";
      },

      configurationManagement: () => {
        const originalTimeout = PROCESSING_CONFIG.defaultTimeout;
        const testTimeout = 15000;
        updateProcessingConfig({ defaultTimeout: testTimeout });
        const updated = PROCESSING_CONFIG.defaultTimeout === testTimeout;
        updateProcessingConfig({ defaultTimeout: originalTimeout }); // Restore
        return updated;
      },

      errorHandling: () => {
        try {
          // Test with null input
          const result = assessDocumentComplexity(null);
          return result && result.level === "Unknown";
        } catch (error) {
          return false;
        }
      },

      integrationReadiness: () => {
        // Test that all required methods are available for integration
        return (
          typeof assessDocumentComplexity === "function" &&
          typeof selectProcessingStrategy === "function" &&
          typeof updateProcessingConfig === "function"
        );
      },
    };

    return (
      window.TestUtilities?.runTestSuite("ProcessingStrategyManager", tests) ||
      fallbackTesting("ProcessingStrategyManager", tests)
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
    // Core processing strategy functions
    assessDocumentComplexity,
    selectProcessingStrategy,

    // Configuration management
    updateProcessingConfig,
    getProcessingConfig,

    // Utility functions
    determineComplexityLevel,
    analyzeStrategyRequirements,
    generateStrategyReasoning,

    // Testing
    testProcessingStrategyManager,
  };
})();

// Make globally available
window.ProcessingStrategyManager = ProcessingStrategyManager;
