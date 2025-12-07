// validation-utilities.js
// Input Validation and Sanitization Utilities
// Handles LaTeX syntax validation, content sanitization, and input preprocessing
// Uses modular logging system from Phase 1

const ValidationUtilities = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("VALIDATION", {
    level: window.LoggingSystem.LOG_LEVELS.WARN, // Less verbose for utilities
  }) || {
    logError: console.error.bind(console, "[VALIDATION]"),
    logWarn: console.warn.bind(console, "[VALIDATION]"),
    logInfo: console.log.bind(console, "[VALIDATION]"),
    logDebug: console.log.bind(console, "[VALIDATION]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // LATEX VALIDATION UTILITIES
  // ===========================================================================================

  /**
   * Validate LaTeX syntax for common issues
   * @param {string} content - LaTeX content to validate
   * @returns {Object} - Validation result with issues found
   */
  function validateLatexSyntax(content) {
    logDebug("Starting LaTeX syntax validation...");

    if (!content || typeof content !== "string") {
      return {
        valid: false,
        issues: ["No content provided for validation"],
        warnings: [],
        suggestions: [],
      };
    }

    const issues = [];
    const warnings = [];
    const suggestions = [];

    // Check for unmatched braces
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push(
        `Unmatched braces: ${openBraces} opening, ${closeBraces} closing`
      );
    }

    // Check for unmatched math delimiters
    const dollarSigns = (content.match(/\$/g) || []).length;
    if (dollarSigns % 2 !== 0) {
      issues.push("Unmatched dollar sign math delimiters");
    }

    // Check for unmatched display math
    const displayMathOpen = (content.match(/\$\$/g) || []).length;
    if (displayMathOpen % 2 !== 0) {
      issues.push("Unmatched display math delimiters ($$)");
    }

    // Check for unmatched bracket math
    const bracketMathOpen = (content.match(/\\\[/g) || []).length;
    const bracketMathClose = (content.match(/\\\]/g) || []).length;
    if (bracketMathOpen !== bracketMathClose) {
      issues.push(
        `Unmatched bracket math: ${bracketMathOpen} \\[, ${bracketMathClose} \\]`
      );
    }

    // Check for unmatched parenthesis math
    const parenMathOpen = (content.match(/\\\(/g) || []).length;
    const parenMathClose = (content.match(/\\\)/g) || []).length;
    if (parenMathOpen !== parenMathClose) {
      issues.push(
        `Unmatched parenthesis math: ${parenMathOpen} \\(, ${parenMathClose} \\)`
      );
    }

    // Check for problematic commands
    const problematicCommands = [
      /\\index\{[^}]*\}/g,
      /\\qedhere\b/g,
      /\\usepackage\{[^}]*\}/g, // Often causes issues in web context
    ];

    problematicCommands.forEach((regex) => {
      const matches = content.match(regex);
      if (matches) {
        warnings.push(
          `Found ${matches.length} potentially problematic command(s): ${matches[0]}`
        );
        suggestions.push(
          "Consider removing document-level commands for web conversion"
        );
      }
    });

    // Check for nested math environments
    if (
      content.includes("$$") &&
      (content.includes("\\(") || content.includes("$"))
    ) {
      warnings.push("Mixed math delimiter styles detected");
      suggestions.push("Use consistent math delimiters throughout document");
    }

    const isValid = issues.length === 0;

    logInfo(`LaTeX validation complete: ${isValid ? "Valid" : "Issues found"}`);
    if (issues.length > 0) {
      logWarn(`Validation issues: ${issues.join(", ")}`);
    }

    return {
      valid: isValid,
      issues: issues,
      warnings: warnings,
      suggestions: suggestions,
      statistics: {
        length: content.length,
        mathExpressions: (
          content.match(/\$[^$]+\$|\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]/g) || []
        ).length,
        commands: (content.match(/\\[a-zA-Z]+/g) || []).length,
      },
    };
  }

  /**
   * Sanitise LaTeX input for safe processing
   * Removes problematic commands that cause MathJax errors
   * @param {string} rawInput - Raw LaTeX input
   * @returns {Object} - Sanitised content and report
   */
  function sanitizeInput(rawInput) {
    logDebug("Starting input sanitisation...");

    if (!rawInput || typeof rawInput !== "string") {
      return {
        sanitised: "",
        removed: [],
        warnings: ["No valid input provided for sanitisation"],
      };
    }

    let sanitised = rawInput;
    const removed = [];

    // TIKZ PRESERVATION: Extract and preserve TikZ blocks for future rendering
    // This prevents TikZ math (axis labels, etc.) from interfering with document math
    if (window.TikzPreservationManager) {
      const tikzResult =
        window.TikzPreservationManager.extractAndPreserveTikz(sanitised);
      if (tikzResult.extracted > 0) {
        sanitised = tikzResult.processed;
        removed.push({
          count: tikzResult.extracted,
          description: `TikZ picture environments (preserved for future rendering, ${tikzResult.statistics.totalCharacters} chars)`,
          examples: Object.keys(tikzResult.registry)
            .slice(0, 3)
            .map((id) => `[${id}]`),
        });
        logInfo(
          `🎨 Preserved ${tikzResult.extracted} TikZ block(s) for future rendering`
        );
        logInfo(
          `   - Registry: ${Object.keys(tikzResult.registry).length} entries`
        );
        logInfo(`   - Statistics: ${JSON.stringify(tikzResult.statistics)}`);
      }
    } else {
      logWarn(
        "⚠️ TikzPreservationManager not available - TikZ content may cause issues"
      );
    }

    // Remove document-level LaTeX commands that cause MathJax errors
    const removalPatterns = [
      {
        pattern: /\\index\{[^}]*\}/g,
        description: "index commands (document indexing)",
      },
      {
        pattern: /\\qedhere\b/g,
        description: "qedhere commands (QED symbol positioning)",
      },
      // CROSS-REFERENCE FIX: DO NOT remove label commands!
      // Labels are essential for cross-referencing and are processed by CrossReferencePreprocessor
      // Removing them here breaks the entire cross-reference system
      // {
      //   pattern: /\\label\{[^}]*\}\s*$/gm,
      //   description: "standalone label commands",
      // },
    ];

    removalPatterns.forEach(({ pattern, description }) => {
      const matches = sanitised.match(pattern);
      if (matches) {
        removed.push({
          count: matches.length,
          description: description,
          examples: matches.slice(0, 3), // Show first 3 examples
        });
        sanitised = sanitised.replace(pattern, "");
      }
    });

    // Clean up extra whitespace created by removals
    sanitised = sanitised.replace(/\n\s*\n\s*\n/g, "\n\n"); // Multiple newlines to double
    sanitised = sanitised.replace(/[ \t]+$/gm, ""); // Trailing spaces

    const totalRemoved = removed.reduce((sum, item) => sum + item.count, 0);

    if (totalRemoved > 0) {
      logInfo(
        `Input sanitisation complete: removed ${totalRemoved} problematic elements`
      );
    } else {
      logDebug("Input sanitisation complete: no changes needed");
    }

    return {
      sanitised: sanitised.trim(),
      removed: removed,
      warnings:
        removed.length > 0
          ? [
              `Removed ${totalRemoved} document-level commands to prevent MathJax errors`,
            ]
          : [],
    };
  }

  /**
   * Validate content is suitable for web conversion
   * @param {string} content - Content to validate
   * @returns {Object} - Suitability assessment
   */
  function validateWebSuitability(content) {
    const issues = [];
    const warnings = [];
    const recommendations = [];

    // Check for LaTeX-specific document structure
    if (content.includes("\\documentclass")) {
      warnings.push("Full LaTeX document structure detected");
      recommendations.push(
        "Consider extracting only the document body for web conversion"
      );
    }

    // Check for complex packages
    const complexPackages = [
      "tikz",
      "pgfplots",
      "listings",
      "algorithm",
      "algorithmic",
    ];

    complexPackages.forEach((pkg) => {
      if (content.includes(`\\usepackage{${pkg}}`)) {
        warnings.push(`Complex package detected: ${pkg}`);
        recommendations.push(
          `Package ${pkg} may not render correctly in web environment`
        );
      }
    });

    // Check for file inclusions
    if (content.includes("\\includegraphics") || content.includes("\\input")) {
      warnings.push("File inclusion commands detected");
      recommendations.push(
        "Ensure all referenced files are available or use embedded alternatives"
      );
    }

    return {
      suitable: issues.length === 0,
      issues: issues,
      warnings: warnings,
      recommendations: recommendations,
    };
  }

  /**
   * Comprehensive input validation combining multiple checks
   * @param {string} input - Input to validate comprehensively
   * @returns {Object} - Complete validation report
   */
  function comprehensiveValidation(input) {
    logInfo("Running comprehensive input validation...");

    const syntaxValidation = validateLatexSyntax(input);
    const sanitisationResult = sanitizeInput(input);
    const webSuitability = validateWebSuitability(input);

    const overallValid = syntaxValidation.valid && webSuitability.suitable;

    const report = {
      overall: {
        valid: overallValid,
        confidence: overallValid ? "high" : "medium",
        recommendation: overallValid ? "proceed" : "review_issues",
      },
      syntax: syntaxValidation,
      sanitisation: sanitisationResult,
      webSuitability: webSuitability,
      summary: {
        criticalIssues: syntaxValidation.issues.length,
        warnings:
          syntaxValidation.warnings.length + webSuitability.warnings.length,
        elementsRemoved: sanitisationResult.removed.reduce(
          (sum, item) => sum + item.count,
          0
        ),
      },
    };

    logInfo(
      `Comprehensive validation complete: ${
        overallValid ? "PASSED" : "ISSUES FOUND"
      }`
    );
    return report;
  }

  // ===========================================================================================
  // TESTING FUNCTIONS
  // ===========================================================================================

  /**
   * Test validation utilities functionality
   */
  function testValidationUtilities() {
    const tests = {
      moduleExists: () => !!window.ValidationUtilities,

      validateLatexSyntaxExists: () =>
        typeof validateLatexSyntax === "function",

      detectsUnmatchedBraces: () => {
        const result = validateLatexSyntax("\\frac{1{2}");
        return (
          !result.valid &&
          result.issues.some((issue) => issue.includes("Unmatched braces"))
        );
      },

      detectsUnmatchedMath: () => {
        const result = validateLatexSyntax("This has $unmatched math");
        return (
          !result.valid &&
          result.issues.some((issue) => issue.includes("dollar sign"))
        );
      },

      sanitizeInputWorks: () => {
        const result = sanitizeInput("Content \\index{test} here \\qedhere");
        return (
          result.sanitised === "Content  here" && result.removed.length === 2
        );
      },

      webSuitabilityCheck: () => {
        const result = validateWebSuitability(
          "\\documentclass{article}\\usepackage{tikz}"
        );
        return result.warnings.length >= 2; // Should detect both documentclass and tikz
      },

      comprehensiveValidation: () => {
        const result = comprehensiveValidation("Valid $x = 1$ content");
        return (
          typeof result.overall === "object" &&
          typeof result.syntax === "object" &&
          typeof result.sanitisation === "object"
        );
      },
    };

    // Run tests using TestUtilities pattern from Phase 1
    if (window.TestUtilities?.runTestSuite) {
      return window.TestUtilities.runTestSuite("ValidationUtilities", tests);
    }

    // Fallback testing if TestUtilities not available
    let passed = 0;
    let total = 0;

    Object.entries(tests).forEach(([testName, testFn]) => {
      total++;
      try {
        const result = testFn();
        if (result) {
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
    logInfo(`📊 ValidationUtilities: ${passed}/${total} tests passed`);

    return {
      success: success,
      allPassed: success,
      passed: passed,
      total: total,
      totalTests: total,
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Core validation functions
    validateLatexSyntax,
    sanitizeInput,
    validateWebSuitability,
    comprehensiveValidation,

    // Testing
    testValidationUtilities,
  };
})();

window.ValidationUtilities = ValidationUtilities;
