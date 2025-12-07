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
   * Find all footnote regions in the content
   * Returns array of {start, end} positions for each footnote
   */
  function findFootnoteRegions(content) {
    const footnoteRegions = [];
    const footnotePattern = /\\footnote\{/g;
    let match;

    while ((match = footnotePattern.exec(content)) !== null) {
      const startPos = match.index;
      let braceCount = 1;
      let endPos = match.index + match[0].length;

      // Find matching closing brace
      while (endPos < content.length && braceCount > 0) {
        const char = content[endPos];
        if (char === "{" && content[endPos - 1] !== "\\") {
          braceCount++;
        } else if (char === "}" && content[endPos - 1] !== "\\") {
          braceCount--;
        }
        endPos++;
      }

      if (braceCount === 0) {
        footnoteRegions.push({ start: startPos, end: endPos });
        logDebug(`Found footnote region: ${startPos}-${endPos}`);
      }
    }

    return footnoteRegions;
  }

  /**
   * Check if a position is inside any footnote region
   */
  function isInsideFootnote(position, footnoteRegions) {
    return footnoteRegions.some(
      (region) => position >= region.start && position < region.end
    );
  }

  /**
   * Extract and map all LaTeX expressions from input text BEFORE processing
   * This preserves clean original LaTeX for annotation injection
   * BREAKTHROUGH: Solves semantic pollution by capturing source before MathJax processing
   */
  function extractAndMapLatexExpressions(content) {
    logInfo("🔍 Starting LaTeX expression extraction and mapping...");

    // PHASE 0: Identify footnote regions to exclude
    const footnoteRegions = findFootnoteRegions(content);
    if (footnoteRegions.length > 0) {
      logInfo(
        `📌 Found ${footnoteRegions.length} footnote regions to exclude from extraction`
      );
    }

    // NEW APPROACH: Collect all expressions FIRST, then sort by position
    const mainExpressions = [];
    const footnoteExpressions = [];
    let processedContent = content;

    try {
      // ===================================================================
      // PHASE 1: COLLECT ALL EXPRESSIONS WITH THEIR POSITIONS
      // ===================================================================

      // Pattern 1: Display math with $$..$$
      let lastSearchPos = 0;
      processedContent.replace(
        /\$\$([\s\S]*?)\$\$/g,
        (match, latex, offset) => {
          const cleanLatex = latex.trim();
          if (cleanLatex) {
            // Find position in ORIGINAL content
            const originalOffset = content.indexOf(match, lastSearchPos);
            if (originalOffset !== -1) {
              lastSearchPos = originalOffset + match.length;

              // Separate main content from footnotes
              if (!isInsideFootnote(originalOffset, footnoteRegions)) {
                mainExpressions.push({
                  latex: cleanLatex,
                  type: "display",
                  pattern: "$$",
                  position: originalOffset,
                  isFootnote: false,
                });
              } else {
                footnoteExpressions.push({
                  latex: cleanLatex,
                  type: "display",
                  pattern: "$$",
                  position: originalOffset,
                  isFootnote: true,
                });
                logDebug(
                  `Preserved display math $$ from footnote at position ${originalOffset}`
                );
              }
              logDebug(
                `Collected display math $$: ${cleanLatex.substring(
                  0,
                  30
                )}... at position ${originalOffset}`
              );
            }
          }
          return match;
        }
      );

      // Pattern 2: Display math with \[..\]
      lastSearchPos = 0;
      processedContent.replace(
        /\\\[([\s\S]*?)\\\]/g,
        (match, latex, offset) => {
          const cleanLatex = latex.trim();
          if (cleanLatex) {
            const originalOffset = content.indexOf(match, lastSearchPos);
            if (originalOffset !== -1) {
              lastSearchPos = originalOffset + match.length;

              // Separate main content from footnotes
              if (!isInsideFootnote(originalOffset, footnoteRegions)) {
                mainExpressions.push({
                  latex: cleanLatex,
                  type: "display",
                  pattern: "\\[\\]",
                  position: originalOffset,
                  isFootnote: false,
                });
              } else {
                footnoteExpressions.push({
                  latex: cleanLatex,
                  type: "display",
                  pattern: "\\[\\]",
                  position: originalOffset,
                  isFootnote: true,
                });
                logDebug(
                  `Preserved display math \\[\\] from footnote at position ${originalOffset}`
                );
              }
              logDebug(
                `Collected display math \\[\\]: ${cleanLatex.substring(
                  0,
                  30
                )}... at position ${originalOffset}`
              );
            }
          }
          return match;
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
        lastSearchPos = 0;

        processedContent.replace(pattern, (match, latex, offset) => {
          const cleanLatex = latex.trim();
          if (cleanLatex) {
            const originalOffset = content.indexOf(match, lastSearchPos);
            if (originalOffset !== -1) {
              lastSearchPos = originalOffset + match.length;

              // Separate main content from footnotes
              if (!isInsideFootnote(originalOffset, footnoteRegions)) {
                mainExpressions.push({
                  latex: cleanLatex,
                  type: "environment",
                  pattern: env,
                  position: originalOffset,
                  isFootnote: false,
                });
              } else {
                footnoteExpressions.push({
                  latex: cleanLatex,
                  type: "environment",
                  pattern: env,
                  position: originalOffset,
                  isFootnote: true,
                });
                logDebug(
                  `Preserved ${env} environment from footnote at position ${originalOffset}`
                );
              }
              logDebug(
                `Collected ${env} environment: ${cleanLatex.substring(
                  0,
                  30
                )}... at position ${originalOffset}`
              );
            }
          }
          return match;
        });
      });

      // Pattern 4: Inline math with $..$ (single dollars only)
      lastSearchPos = 0;
      processedContent.replace(
        /(?<!\$)\$([^$]+?)\$(?!\$)/g,
        (match, latex, offset) => {
          const cleanLatex = latex.trim();
          if (cleanLatex) {
            const searchPattern = `$${latex}$`;
            const originalOffset = content.indexOf(
              searchPattern,
              lastSearchPos
            );
            if (originalOffset !== -1) {
              lastSearchPos = originalOffset + searchPattern.length;

              // Separate main content from footnotes
              if (!isInsideFootnote(originalOffset, footnoteRegions)) {
                mainExpressions.push({
                  latex: cleanLatex,
                  type: "inline",
                  pattern: "$",
                  position: originalOffset,
                  isFootnote: false,
                });
              } else {
                footnoteExpressions.push({
                  latex: cleanLatex,
                  type: "inline",
                  pattern: "$",
                  position: originalOffset,
                  isFootnote: true,
                });
                logDebug(
                  `Preserved inline math $ from footnote at position ${originalOffset}: ${cleanLatex.substring(
                    0,
                    30
                  )}...`
                );
              }
              logDebug(
                `Collected inline math $: ${cleanLatex.substring(
                  0,
                  30
                )}... at position ${originalOffset}`
              );
            }
          }
          return match;
        }
      );

      // Pattern 5: Inline math with \(..\)
      lastSearchPos = 0;
      processedContent.replace(
        /\\\(([\s\S]*?)\\\)/g,
        (match, latex, offset) => {
          const cleanLatex = latex.trim();
          if (cleanLatex) {
            const originalOffset = content.indexOf(match, lastSearchPos);
            if (originalOffset !== -1) {
              lastSearchPos = originalOffset + match.length;

              // Separate main content from footnotes
              if (!isInsideFootnote(originalOffset, footnoteRegions)) {
                mainExpressions.push({
                  latex: cleanLatex,
                  type: "inline",
                  pattern: "\\(\\)",
                  position: originalOffset,
                  isFootnote: false,
                });
              } else {
                footnoteExpressions.push({
                  latex: cleanLatex,
                  type: "inline",
                  pattern: "\\(\\)",
                  position: originalOffset,
                  isFootnote: true,
                });
                logDebug(
                  `Preserved inline math \\(\\) from footnote at position ${originalOffset}`
                );
              }
              logDebug(
                `Collected inline math \\(\\): ${cleanLatex.substring(
                  0,
                  30
                )}... at position ${originalOffset}`
              );
            }
          }
          return match;
        }
      );

      // ===================================================================
      // PHASE 2: SORT BOTH ARRAYS BY POSITION
      // ===================================================================
      mainExpressions.sort((a, b) => a.position - b.position);
      footnoteExpressions.sort((a, b) => a.position - b.position);

      logInfo(
        `📊 Collected ${mainExpressions.length} main expressions and ${footnoteExpressions.length} footnote expressions`
      );

      // ===================================================================
      // PHASE 3: ASSIGN SEQUENTIAL INDICES - MAIN CONTENT ONLY (for now)
      // ===================================================================
      const latexMap = {};

      mainExpressions.forEach((expr, index) => {
        latexMap[index] = {
          ...expr,
          index: index,
        };
        logDebug(
          `Assigned index ${index} to ${expr.type} math at position ${
            expr.position
          }: ${expr.latex.substring(0, 30)}...`
        );
      });

      // ===================================================================
      // PHASE 4: STATISTICS AND VALIDATION
      // ===================================================================
      const stats = {
        totalExpressions: Object.keys(latexMap).length,
        byType: {
          display: Object.values(latexMap).filter((e) => e.type === "display")
            .length,
          inline: Object.values(latexMap).filter((e) => e.type === "inline")
            .length,
          environment: Object.values(latexMap).filter(
            (e) => e.type === "environment"
          ).length,
        },
        byPattern: {},
      };

      Object.values(latexMap).forEach((expr) => {
        const pattern = expr.pattern;
        stats.byPattern[pattern] = (stats.byPattern[pattern] || 0) + 1;
      });

      logInfo(`✅ Extraction complete (POSITION-SORTED ORDER):`);
      logInfo(`   Total expressions: ${stats.totalExpressions}`);
      logInfo(`   Display math: ${stats.byType.display}`);
      logInfo(`   Inline math: ${stats.byType.inline}`);
      logInfo(`   Environments: ${stats.byType.environment}`);
      logInfo(`   Registry order: BY DOCUMENT POSITION (matches DOM order)`);
      logInfo(
        `   Footnote expressions collected: ${footnoteExpressions.length} (stored separately)`
      );

      // DEFENSIVE: Validate position ordering to catch extraction bugs
      if (!validatePositionOrder(latexMap)) {
        logWarn("⚠️ Position validation failed - extraction may have errors");
        logWarn(
          "This typically indicates duplicate expressions being mapped to the same position"
        );
      }

      // Store footnote expressions globally for later use
      window._footnoteExpressionsRaw = footnoteExpressions;

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

  /**
   * Validate that extracted positions are strictly increasing
   * DEFENSIVE: Catches duplicate position bugs immediately
   * @param {Object} latexMap - Map of extracted LaTeX expressions
   * @returns {boolean} - True if validation passes, false otherwise
   */
  function validatePositionOrder(latexMap) {
    if (!latexMap || typeof latexMap !== "object") {
      logWarn("Cannot validate positions - invalid latexMap provided");
      return false;
    }

    const expressions = Object.values(latexMap);

    if (expressions.length === 0) {
      logDebug("No expressions to validate");
      return true;
    }

    // Sort expressions by their declared position
    const sortedByPosition = expressions
      .map((expr, idx) => ({
        expr,
        originalIndex: expr.index,
      }))
      .sort((a, b) => a.expr.position - b.expr.position);

    // Check for duplicate positions
    const positionCounts = {};
    let hasDuplicates = false;

    sortedByPosition.forEach(({ expr, originalIndex }) => {
      const pos = expr.position;
      if (positionCounts[pos]) {
        logError(`❌ VALIDATION FAILED: Duplicate position ${pos} detected`);
        logError(
          `  Expression 1 (index ${
            positionCounts[pos].index
          }): "${positionCounts[pos].latex.substring(0, 30)}..."`
        );
        logError(
          `  Expression 2 (index ${originalIndex}): "${expr.latex.substring(
            0,
            30
          )}..."`
        );
        logError(
          `  This indicates a bug in position tracking - expressions mapped to same location`
        );
        hasDuplicates = true;
      } else {
        positionCounts[pos] = {
          latex: expr.latex,
          index: originalIndex,
        };
      }
    });

    if (hasDuplicates) {
      logError(
        "⚠️ Position validation failed - extraction contains duplicate positions"
      );
      return false;
    }

    logDebug(
      `✅ Position validation passed: ${expressions.length} expressions with unique positions`
    );
    return true;
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

      duplicateExpressions: () => {
        const testContent =
          "First occurrence: $\\N$ and second occurrence: $\\N$ should have different positions";
        const result = extractAndMapLatexExpressions(testContent);
        const nExpressions = Object.values(result).filter(
          (expr) => expr.latex === "\\N"
        );

        // Should find exactly 2 expressions
        if (nExpressions.length !== 2) {
          console.error(
            `Expected 2 \\N expressions, found ${nExpressions.length}`
          );
          return false;
        }

        // Should have different positions
        if (nExpressions[0].position === nExpressions[1].position) {
          console.error(
            `Duplicate positions detected: ${nExpressions[0].position}`
          );
          return false;
        }

        // Positions should be in ascending order (first occurrence < second occurrence)
        if (nExpressions[0].position >= nExpressions[1].position) {
          console.error(
            `Positions not in correct order: ${nExpressions[0].position} >= ${nExpressions[1].position}`
          );
          return false;
        }

        // Position difference should be reasonable
        // First $ is at position after "First occurrence: " (18 chars)
        // Second $ is at position after "First occurrence: $\N$ and second occurrence: "
        // which is 18 + 4 + 23 = 45 chars, so distance should be 27 chars minimum
        const actualDistance =
          nExpressions[1].position - nExpressions[0].position;
        const expectedMinDistance = 20; // Reasonable minimum distance between duplicates

        if (actualDistance < expectedMinDistance) {
          console.error(
            `Position distance too small: ${actualDistance} < ${expectedMinDistance}`
          );
          console.error(
            `First position: ${nExpressions[0].position}, Second position: ${nExpressions[1].position}`
          );
          return false;
        }

        return true;
      },

      positionSortedOrder: () => {
        // Test that expressions are indexed in document order, not pattern-type order
        const testContent =
          "First $$display1$$ then $inline1$ then $$display2$$ then $inline2$";
        const result = extractAndMapLatexExpressions(testContent);

        // Should have 4 expressions
        if (Object.keys(result).length !== 4) {
          console.error(
            `Expected 4 expressions, found ${Object.keys(result).length}`
          );
          return false;
        }

        // Check they're in document order (by position)
        const positions = Object.values(result).map((expr) => expr.position);
        const sortedPositions = [...positions].sort((a, b) => a - b);

        // Positions should already be sorted
        for (let i = 0; i < positions.length; i++) {
          if (positions[i] !== sortedPositions[i]) {
            console.error(
              `Expressions not in position order: [${positions.join(", ")}]`
            );
            return false;
          }
        }

        // Verify the actual order matches document order
        // Expected order: display1, inline1, display2, inline2
        if (result[0].latex !== "display1") {
          console.error(
            `Index 0 should be 'display1', got '${result[0].latex}'`
          );
          return false;
        }
        if (result[1].latex !== "inline1") {
          console.error(
            `Index 1 should be 'inline1', got '${result[1].latex}'`
          );
          return false;
        }
        if (result[2].latex !== "display2") {
          console.error(
            `Index 2 should be 'display2', got '${result[2].latex}'`
          );
          return false;
        }
        if (result[3].latex !== "inline2") {
          console.error(
            `Index 3 should be 'inline2', got '${result[3].latex}'`
          );
          return false;
        }

        return true;
      },

      positionValidation: () => {
        // Test that validation function exists and works
        const validMap = {
          0: {
            latex: "x=1",
            type: "inline",
            position: 10,
            index: 0,
            pattern: "$",
          },
          1: {
            latex: "y=2",
            type: "inline",
            position: 20,
            index: 1,
            pattern: "$",
          },
        };

        const invalidMap = {
          0: {
            latex: "x=1",
            type: "inline",
            position: 10,
            index: 0,
            pattern: "$",
          },
          1: {
            latex: "y=2",
            type: "inline",
            position: 10,
            index: 1,
            pattern: "$",
          }, // Duplicate position
        };

        // Note: validatePositionOrder is not exposed in public API
        // This test verifies the extraction process catches duplicates
        const testContent = "Duplicate test: $a$ $a$";
        const result = extractAndMapLatexExpressions(testContent);
        const aExpressions = Object.values(result).filter(
          (expr) => expr.latex === "a"
        );

        // Should have different positions
        return (
          aExpressions.length === 2 &&
          aExpressions[0].position !== aExpressions[1].position
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

  /**
   * Replace LaTeX expressions with annotations for Pandoc processing
   * @param {string} inputText - Original text with LaTeX
   * @param {Object} latexMap - Map from extractAndMapLatexExpressions
   * @returns {string} - Text with LaTeX replaced by LATEX_ANNOTATION markers
   */
  function replaceLatexWithAnnotations(inputText, latexMap) {
    if (!latexMap || Object.keys(latexMap).length === 0) {
      return inputText;
    }

    // Convert map to array and sort by position (reverse order to avoid offset issues)
    const expressions = Object.values(latexMap).sort(
      (a, b) => b.position - a.position
    );

    let result = inputText;

    expressions.forEach((expr) => {
      const { latex, position, type, pattern, index } = expr;

      // Calculate the full match including delimiters
      let fullMatch = "";
      let replacement = "";

      if (type === "inline" && pattern === "$...$") {
        fullMatch = `$${latex}$`;
        replacement = `LATEX_ANNOTATION_${index}_INLINE`;
      } else if (type === "display" && pattern === "\\[...\\]") {
        fullMatch = `\\[${latex}\\]`;
        replacement = `LATEX_ANNOTATION_${index}_DISPLAY`;
      } else if (pattern.startsWith("\\begin{")) {
        // Environment like \begin{equation}...\end{equation}
        const envMatch = pattern.match(/\\begin\{([^}]+)\}/);
        if (envMatch) {
          const envName = envMatch[1];
          fullMatch = `\\begin{${envName}}${latex}\\end{${envName}}`;
          replacement = `LATEX_ANNOTATION_${index}_${envName.toUpperCase()}`;
        }
      }

      if (fullMatch) {
        // Replace this specific occurrence at this position
        const before = result.substring(0, position);
        const after = result.substring(position + fullMatch.length);
        result = before + replacement + after;

        logDebug(
          `Preserved expression ${index}: ${fullMatch.substring(0, 50)}...`
        );
      }
    });

    logInfo(
      `✅ Replaced ${expressions.length} LaTeX expressions with annotations`
    );
    return result;
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    extractAndMapLatexExpressions,
    replaceLatexWithAnnotations,
    validateLatexMap,
    getExtractionStatistics,
    // Testing
    testLatexPreservationEngine,
  };
})();

window.LatexPreservationEngine = LatexPreservationEngine;
// Add alias with correct LaTeX casing for backward compatibility
window.LaTeXPreservationEngine = LatexPreservationEngine;
