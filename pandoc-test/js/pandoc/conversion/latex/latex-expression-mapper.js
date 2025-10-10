// latex-expression-mapper.js
// LaTeX Expression Pattern Matching and Processing Utilities
// Provides ordering, sorting, and pattern-specific processing for LaTeX expressions

const LatexExpressionMapper = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("LATEX_MAPPER", {
    level: window.LoggingSystem.LOG_LEVELS.WARN,
  }) || {
    logError: console.error.bind(console, "[LATEX_MAPPER]"),
    logWarn: console.warn.bind(console, "[LATEX_MAPPER]"),
    logInfo: console.log.bind(console, "[LATEX_MAPPER]"),
    logDebug: console.log.bind(console, "[LATEX_MAPPER]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // EXPRESSION MAPPING AND ORDERING FUNCTIONS
  // ===========================================================================================

  /**
   * Order LaTeX expressions by position for sequential processing
   */
  function orderExpressionsByPosition(latexMap) {
    if (!latexMap || typeof latexMap !== "object") {
      logWarn("Invalid LaTeX map provided for ordering");
      return [];
    }

    try {
      const expressions = Object.values(latexMap);
      const orderedExpressions = expressions.sort(
        (a, b) => a.position - b.position
      );

      logDebug(`Ordered ${orderedExpressions.length} expressions by position`);
      return orderedExpressions;
    } catch (error) {
      logError("Error ordering expressions by position:", error);
      return [];
    }
  }

  /**
   * Create position-based LaTeX array for annotation injection
   */
  function createPositionBasedArray(orderedExpressions) {
    if (!Array.isArray(orderedExpressions)) {
      logWarn("Invalid ordered expressions provided");
      return [];
    }

    try {
      const positionArray = orderedExpressions.map((expr) => expr.latex);
      logDebug(
        `Created position-based array with ${positionArray.length} expressions`
      );
      return positionArray;
    } catch (error) {
      logError("Error creating position-based array:", error);
      return [];
    }
  }

  /**
   * Filter expressions by type (display, inline, environment)
   */
  function filterExpressionsByType(latexMap, type) {
    if (!latexMap || typeof latexMap !== "object") {
      return {};
    }

    try {
      const filtered = {};
      Object.entries(latexMap).forEach(([index, expression]) => {
        if (expression.type === type) {
          filtered[index] = expression;
        }
      });

      logDebug(
        `Filtered ${Object.keys(filtered).length} expressions of type: ${type}`
      );
      return filtered;
    } catch (error) {
      logError("Error filtering expressions by type:", error);
      return {};
    }
  }

  /**
   * Filter expressions by pattern ($$, $, \[, etc.)
   */
  function filterExpressionsByPattern(latexMap, pattern) {
    if (!latexMap || typeof latexMap !== "object") {
      return {};
    }

    try {
      const filtered = {};
      Object.entries(latexMap).forEach(([index, expression]) => {
        if (expression.pattern === pattern) {
          filtered[index] = expression;
        }
      });

      logDebug(
        `Filtered ${
          Object.keys(filtered).length
        } expressions with pattern: ${pattern}`
      );
      return filtered;
    } catch (error) {
      logError("Error filtering expressions by pattern:", error);
      return {};
    }
  }

  /**
   * Clean and normalise LaTeX expression content
   */
  function cleanLatexExpression(latex) {
    if (typeof latex !== "string") {
      return "";
    }

    try {
      // Remove excessive whitespace
      let cleaned = latex.trim();

      // Normalise internal whitespace
      cleaned = cleaned.replace(/\s+/g, " ");

      // Remove empty lines
      cleaned = cleaned.replace(/\n\s*\n/g, "\n");

      return cleaned;
    } catch (error) {
      logError("Error cleaning LaTeX expression:", error);
      return latex;
    }
  }

  /**
   * Validate expression pattern consistency
   */
  function validateExpressionPattern(expression) {
    if (!expression || typeof expression !== "object") {
      return false;
    }

    const { latex, type, pattern } = expression;

    if (!latex || !type || !pattern) {
      return false;
    }

    // Validate type-pattern consistency
    const typePatternMap = {
      display: ["$$", "\\[\\]"],
      inline: ["$", "\\(\\)"],
      environment: [
        "equation",
        "align",
        "gather",
        "multline",
        "eqnarray",
        "alignat",
      ],
    };

    const validPatterns = typePatternMap[type];
    if (!validPatterns || !validPatterns.includes(pattern)) {
      logWarn(`Inconsistent type-pattern combination: ${type} with ${pattern}`);
      return false;
    }

    return true;
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testLatexExpressionMapper() {
    const tests = {
      moduleExists: () => !!window.LatexExpressionMapper,

      orderingFunction: () => {
        const testMap = {
          0: { latex: "x=1", position: 10, type: "inline", pattern: "$" },
          1: { latex: "y=2", position: 5, type: "display", pattern: "$$" },
        };
        const ordered = orderExpressionsByPosition(testMap);
        return (
          ordered.length === 2 &&
          ordered[0].latex === "y=2" &&
          ordered[1].latex === "x=1"
        );
      },

      positionArrayFunction: () => {
        const orderedExpressions = [
          { latex: "a=1", position: 0 },
          { latex: "b=2", position: 10 },
        ];
        const positionArray = createPositionBasedArray(orderedExpressions);
        return (
          positionArray.length === 2 &&
          positionArray[0] === "a=1" &&
          positionArray[1] === "b=2"
        );
      },

      typeFilterFunction: () => {
        const testMap = {
          0: { latex: "x=1", type: "inline", pattern: "$" },
          1: { latex: "y=2", type: "display", pattern: "$$" },
          2: { latex: "z=3", type: "inline", pattern: "$" },
        };
        const inlineExpressions = filterExpressionsByType(testMap, "inline");
        return Object.keys(inlineExpressions).length === 2;
      },

      patternFilterFunction: () => {
        const testMap = {
          0: { latex: "x=1", type: "inline", pattern: "$" },
          1: { latex: "y=2", type: "display", pattern: "$$" },
          2: { latex: "z=3", type: "display", pattern: "$$" },
        };
        const dollarPatterns = filterExpressionsByPattern(testMap, "$$");
        return Object.keys(dollarPatterns).length === 2;
      },

      cleaningFunction: () => {
        const messy = "  x   =   1  \n\n  ";
        const cleaned = cleanLatexExpression(messy);
        return cleaned === "x = 1";
      },

      validationFunction: () => {
        const validExpression = { latex: "x=1", type: "inline", pattern: "$" };
        const invalidExpression = {
          latex: "x=1",
          type: "inline",
          pattern: "$$",
        }; // wrong pattern for type
        return (
          validateExpressionPattern(validExpression) &&
          !validateExpressionPattern(invalidExpression)
        );
      },
    };

    return (
      window.TestUtilities?.runTestSuite("LatexExpressionMapper", tests) ||
      fallbackTesting("LatexExpressionMapper", tests)
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
    // Core mapping functions
    orderExpressionsByPosition,
    createPositionBasedArray,

    // Filtering functions
    filterExpressionsByType,
    filterExpressionsByPattern,

    // Utility functions
    cleanLatexExpression,
    validateExpressionPattern,

    // Testing
    testLatexExpressionMapper,
  };
})();

window.LatexExpressionMapper = LatexExpressionMapper;
