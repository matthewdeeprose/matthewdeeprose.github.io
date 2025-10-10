// latex-preservation-engine.js
// Core LaTeX Expression Extraction Engine
// BREAKTHROUGH TECHNOLOGY: Preserves clean original LaTeX for annotation injection
// Solves semantic pollution by capturing source before MathJax processing

const LatexPreservationEngine = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("LATEX", {
    level: window.LoggingSystem.LOG_LEVELS.WARN,
  }) || {
    logError: console.error.bind(console, "[LATEX]"),
    logWarn: console.warn.bind(console, "[LATEX]"),
    logInfo: console.log.bind(console, "[LATEX]"),
    logDebug: console.log.bind(console, "[LATEX]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // CORE LATEX PRESERVATION ENGINE
  // ===========================================================================================

  /**
   * Extract and map all LaTeX expressions from input text BEFORE processing
   * This preserves clean original LaTeX for annotation injection
   * BREAKTHROUGH: Solves semantic pollution by capturing source before MathJax processing
   */
  function extractAndMapLatexExpressions(content) {
    logInfo("🔍 Starting LaTeX expression extraction and mapping...");

    const latexMap = {};
    let globalIndex = 0;
    let processedContent = content;

    try {
      // Process in order of precedence to avoid conflicts
      // First, mark and extract display math patterns to avoid conflicts with inline patterns

      // Pattern 1: Display math with $$..$$
      processedContent = processedContent.replace(
        /\$\$([\s\S]*?)\$\$/g,
        (match, latex, offset) => {
          const cleanLatex = latex.trim();
          if (cleanLatex) {
            latexMap[globalIndex] = {
              latex: cleanLatex,
              type: "display",
              pattern: "$$",
              position: offset,
              index: globalIndex,
            };
            logDebug(
              `Extracted display math ${globalIndex}: ${cleanLatex.substring(
                0,
                30
              )}...`
            );
            globalIndex++;
          }
          // Replace with placeholder to avoid conflicts with inline patterns
          return `__DISPLAY_MATH_${globalIndex - 1}__`;
        }
      );

      // Pattern 2: Display math with \[..\]
      processedContent = processedContent.replace(
        /\\\[([\s\S]*?)\\\]/g,
        (match, latex, offset) => {
          const cleanLatex = latex.trim();
          if (cleanLatex) {
            // Adjust offset to account for previous replacements
            const originalOffset = content.indexOf(match);
            latexMap[globalIndex] = {
              latex: cleanLatex,
              type: "display",
              pattern: "\\[\\]",
              position: originalOffset,
              index: globalIndex,
            };
            logDebug(
              `Extracted display math ${globalIndex}: ${cleanLatex.substring(
                0,
                30
              )}...`
            );
            globalIndex++;
          }
          return `__DISPLAY_MATH_${globalIndex - 1}__`;
        }
      );

      // Pattern 3: Math environments (equation, align, gather, etc.)
      const mathEnvironments = [
        "equation",
        "align",
        "gather",
        "multline",
        "eqnarray",
        "alignat",
      ];
      mathEnvironments.forEach((env) => {
        const pattern = new RegExp(
          `\\\\begin\\{${env}\\*?\\}([\\s\\S]*?)\\\\end\\{${env}\\*?\\}`,
          "g"
        );
        processedContent = processedContent.replace(
          pattern,
          (match, latex, offset) => {
            const cleanLatex = latex.trim();
            if (cleanLatex) {
              const originalOffset = content.indexOf(match);
              latexMap[globalIndex] = {
                latex: cleanLatex,
                type: "environment",
                pattern: env,
                position: originalOffset,
                index: globalIndex,
              };
              logDebug(
                `Extracted ${env} environment ${globalIndex}: ${cleanLatex.substring(
                  0,
                  30
                )}...`
              );
              globalIndex++;
            }
            return `__ENV_MATH_${globalIndex - 1}__`;
          }
        );
      });

      // Now process inline patterns on the content with display patterns removed
      // Pattern 4: Inline math with $..$ (single dollars only)
      processedContent.replace(
        /(?<!\$)\$([^$]+?)\$(?!\$)/g,
        (match, latex, offset) => {
          const cleanLatex = latex.trim();
          if (cleanLatex) {
            // Find position in original content
            const beforeMatch = processedContent.substring(0, offset);
            const placeholderCount = (
              beforeMatch.match(/__\w+_MATH_\d+__/g) || []
            ).length;
            let originalOffset = offset;

            // Rough approximation of original position - this is a limitation of this approach
            // In practice, we might need a more sophisticated mapping
            const originalMatch = content.indexOf(`$${latex}$`);
            if (originalMatch !== -1) {
              originalOffset = originalMatch;
            }

            latexMap[globalIndex] = {
              latex: cleanLatex,
              type: "inline",
              pattern: "$",
              position: originalOffset,
              index: globalIndex,
            };
            logDebug(
              `Extracted inline math ${globalIndex}: ${cleanLatex.substring(
                0,
                30
              )}...`
            );
            globalIndex++;
          }
          return match;
        }
      );

      // Pattern 5: Inline math with \(..\)
      processedContent.replace(
        /\\\(([\s\S]*?)\\\)/g,
        (match, latex, offset) => {
          const cleanLatex = latex.trim();
          if (cleanLatex) {
            const originalOffset = content.indexOf(match);
            latexMap[globalIndex] = {
              latex: cleanLatex,
              type: "inline",
              pattern: "\\(\\)",
              position: originalOffset,
              index: globalIndex,
            };
            logDebug(
              `Extracted inline math ${globalIndex}: ${cleanLatex.substring(
                0,
                30
              )}...`
            );
            globalIndex++;
          }
          return match;
        }
      );

      logInfo(
        `✅ LaTeX extraction complete: ${globalIndex} expressions preserved`
      );
      logInfo(
        `📊 Expression types found: ${JSON.stringify(
          Object.values(latexMap).reduce((acc, expr) => {
            acc[expr.type] = (acc[expr.type] || 0) + 1;
            return acc;
          }, {})
        )}`
      );

      return latexMap;
    } catch (error) {
      logError("❌ Error during LaTeX extraction:", error);
      return {};
    }
  }

  /**
   * Validate LaTeX expression map structure
   */
  function validateLatexMap(latexMap) {
    if (!latexMap || typeof latexMap !== "object") {
      return false;
    }

    // Check that each entry has required properties
    for (const [index, expression] of Object.entries(latexMap)) {
      if (
        !expression.latex ||
        !expression.type ||
        typeof expression.position !== "number" ||
        typeof expression.index !== "number"
      ) {
        logWarn(`Invalid LaTeX map entry at index ${index}:`, expression);
        return false;
      }
    }

    return true;
  }

  /**
   * Get statistics about extracted LaTeX expressions
   */
  function getExtractionStatistics(latexMap) {
    if (!latexMap) {
      return { totalExpressions: 0, byType: {}, byPattern: {} };
    }

    const expressions = Object.values(latexMap);
    const byType = {};
    const byPattern = {};

    expressions.forEach((expr) => {
      byType[expr.type] = (byType[expr.type] || 0) + 1;
      byPattern[expr.pattern] = (byPattern[expr.pattern] || 0) + 1;
    });

    return {
      totalExpressions: expressions.length,
      byType,
      byPattern,
    };
  }

  // ===========================================================================================
  // TESTING FUNCTION
  // ===========================================================================================

  function testLatexPreservationEngine() {
    const tests = {
      moduleExists: () => !!window.LatexPreservationEngine,

      extractionFunction: () =>
        typeof extractAndMapLatexExpressions === "function",

      basicExtractionDisplayMath: () => {
        const testContent = "Some text $$x = 1$$ more text";
        const result = extractAndMapLatexExpressions(testContent);
        return (
          result &&
          Object.keys(result).length === 1 &&
          result["0"] &&
          result["0"].latex === "x = 1" &&
          result["0"].type === "display"
        );
      },

      basicExtractionInlineMath: () => {
        const testContent = "Some text $y = 2$ more text";
        const result = extractAndMapLatexExpressions(testContent);
        return (
          result &&
          Object.keys(result).length === 1 &&
          result["0"] &&
          result["0"].latex === "y = 2" &&
          result["0"].type === "inline"
        );
      },

      multipleExpressions: () => {
        const testContent = "Text $a = 1$ and $$b = 2$$ and \\[c = 3\\]";
        const result = extractAndMapLatexExpressions(testContent);
        return result && Object.keys(result).length === 3;
      },

      environmentExtraction: () => {
        const testContent = "\\begin{equation}x = 1\\end{equation}";
        const result = extractAndMapLatexExpressions(testContent);
        return (
          result &&
          Object.keys(result).length === 1 &&
          result["0"] &&
          result["0"].type === "environment" &&
          result["0"].pattern === "equation"
        );
      },

      validationFunction: () => {
        const validMap = {
          0: {
            latex: "x=1",
            type: "inline",
            position: 0,
            index: 0,
            pattern: "$",
          },
        };
        const invalidMap = { 0: { latex: "x=1" } }; // missing required fields
        return validateLatexMap(validMap) && !validateLatexMap(invalidMap);
      },

      statisticsFunction: () => {
        const testContent = "Text $a = 1$ and $$b = 2$$";
        const result = extractAndMapLatexExpressions(testContent);
        const stats = getExtractionStatistics(result);
        return (
          stats.totalExpressions === 2 &&
          stats.byType.inline === 1 &&
          stats.byType.display === 1
        );
      },
    };

    return (
      window.TestUtilities?.runTestSuite("LatexPreservationEngine", tests) ||
      fallbackTesting("LatexPreservationEngine", tests)
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
    // Core extraction function
    extractAndMapLatexExpressions,

    // Validation and utilities
    validateLatexMap,
    getExtractionStatistics,

    // Testing
    testLatexPreservationEngine,
  };
})();

window.LatexPreservationEngine = LatexPreservationEngine;
