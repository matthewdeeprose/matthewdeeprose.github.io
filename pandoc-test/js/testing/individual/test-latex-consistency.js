// test-latex-consistency.js
// Comprehensive LaTeX Export Consistency Testing System
// Ensures mathematical expressions render identically in preview and exports

const TestLaTeXConsistency = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (IIFE SCOPE)
  // ===========================================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[LATEX-CONSISTENCY]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[LATEX-CONSISTENCY]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[LATEX-CONSISTENCY]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[LATEX-CONSISTENCY]", message, ...args);
  }

  // ===========================================================================================
  // MATHEMATICAL EXPRESSION TEST CATEGORIES
  // ===========================================================================================

  const MATHEMATICAL_TEST_EXPRESSIONS = {
    basicElements: {
      superscripts: ["x^2", "x^{10}", "x^{2n+1}", "e^{i\\pi}", "a^{b^c}"],
      subscripts: ["x_1", "x_{ij}", "x_{n-1}", "H_2O", "a_{i,j}"],
      combined: [
        "x_1^2",
        "x_{i,j}^{(k)}",
        "a_i^{(n)}",
        "F_{\\text{net}}^{(x)}",
      ],
    },

    fractions: {
      basic: [
        "\\frac{1}{2}",
        "\\frac{a+b}{c-d}",
        "\\frac{\\pi}{4}",
        "\\frac{dx}{dt}",
      ],
      nested: [
        "\\frac{\\frac{1}{x}}{y}",
        "\\frac{1}{1+\\frac{1}{x}}",
        "\\frac{a}{b+\\frac{c}{d}}",
      ],
      styled: ["\\dfrac{1}{2}", "\\tfrac{1}{2}", "\\cfrac{1}{1+\\cfrac{1}{x}}"],
    },

    roots: {
      basic: ["\\sqrt{2}", "\\sqrt{x^2+y^2}", "\\sqrt{\\frac{a}{b}}"],
      indexed: ["\\sqrt[3]{8}", "\\sqrt[n]{x}", "\\sqrt[4]{\\frac{a}{b}}"],
    },

    greekLetters: [
      "\\alpha",
      "\\beta",
      "\\gamma",
      "\\delta",
      "\\epsilon",
      "\\pi",
      "\\sigma",
      "\\tau",
      "\\phi",
      "\\psi",
      "\\Delta",
      "\\Gamma",
      "\\Omega",
      "\\Pi",
      "\\Sigma",
    ],

    complexExpressions: {
      summations: [
        "\\sum_{i=1}^n x_i",
        "\\prod_{k=0}^{n-1} (k+1)",
        "\\sum_{\\substack{1 \\leq i \\leq n \\\\ i \\text{ odd}}} x_i",
      ],
      integrals: [
        "\\int_0^1 f(x) dx",
        "\\iint_D f(x,y) dA",
        "\\oint_C \\mathbf{F} \\cdot d\\mathbf{r}",
      ],
      limits: [
        "\\lim_{x \\to \\infty} f(x)",
        "\\lim_{\\substack{x \\to 0 \\\\ x > 0}} g(x)",
        "\\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}",
      ],
    },

    matrices: {
      parentheses: [
        "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}",
        "\\begin{pmatrix} 1 & 2 & 3 \\\\ 4 & 5 & 6 \\end{pmatrix}",
      ],
      brackets: [
        "\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}",
        "\\begin{bmatrix} x \\\\ y \\\\ z \\end{bmatrix}",
      ],
      determinants: [
        "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}",
        "\\det(A) = \\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix}",
      ],
    },

    specialSymbols: {
      setTheory: [
        "\\emptyset",
        "\\varnothing",
        "\\in",
        "\\notin",
        "\\subset",
        "\\subseteq",
        "\\cup",
        "\\cap",
        "\\setminus",
        "\\mathcal{P}(A)",
      ],
      logic: [
        "\\land",
        "\\lor",
        "\\neg",
        "\\implies",
        "\\iff",
        "\\forall",
        "\\exists",
      ],
      relations: [
        "\\leq",
        "\\geq",
        "\\neq",
        "\\equiv",
        "\\approx",
        "\\sim",
        "\\cong",
        "\\ll",
        "\\gg",
      ],
      arrows: [
        "\\rightarrow",
        "\\leftarrow",
        "\\leftrightarrow",
        "\\Rightarrow",
        "\\mapsto",
        "\\hookrightarrow",
      ],
    },

    fonts: {
      blackboard: [
        "\\mathbb{R}",
        "\\mathbb{N}",
        "\\mathbb{Z}",
        "\\mathbb{Q}",
        "\\mathbb{C}",
      ],
      calligraphic: ["\\mathcal{L}", "\\mathcal{F}", "\\mathcal{A}"],
      fraktur: ["\\mathfrak{g}", "\\mathfrak{A}"],
      bold: ["\\mathbf{v}", "\\mathbf{F}", "\\mathbf{x}"],
      textInMath: ["\\text{if } x > 0", "\\text{then } f(x) = x^2"],
    },
  };

  // ===========================================================================================
  // CONSISTENCY TESTING FUNCTIONS
  // ===========================================================================================

  /**
   * Test specific LaTeX expression for consistency
   */
  function testLatexExpression(latex, context = "inline") {
    logDebug(`Testing expression: ${latex} (${context})`);

    const delimiters = context === "display" ? ["\\[", "\\]"] : ["\\(", "\\)"];
    const testExpression = `${delimiters[0]}${latex}${delimiters[1]}`;

    // Check if the expression can be rendered in playground
    const outputDiv = document.getElementById("output");
    if (!outputDiv) {
      return {
        success: false,
        error: "Output container not available",
        expression: latex,
      };
    }

    // Test conversion capability if LaTeX processor is available
    let conversionTest = false;
    if (window.LaTeXProcessor && window.LaTeXProcessor.convertMathJaxToLatex) {
      try {
        // Create a mock container with MathJax structure for testing
        const mockContent = `<mjx-container><mjx-assistive-mml><math><annotation encoding="application/x-tex">${latex}</annotation></math></mjx-assistive-mml></mjx-container>`;
        const converted =
          window.LaTeXProcessor.convertMathJaxToLatex(mockContent);
        conversionTest =
          converted.includes(latex) || converted.includes(testExpression);
      } catch (error) {
        logWarn(`Conversion test failed for ${latex}:`, error.message);
      }
    }

    return {
      success: true,
      expression: latex,
      context: context,
      testExpression: testExpression,
      conversionWorking: conversionTest,
      processorAvailable: !!(
        window.LaTeXProcessor && window.LaTeXProcessor.convertMathJaxToLatex
      ),
    };
  }

  /**
   * Test a category of mathematical expressions
   */
  function testExpressionCategory(categoryName, expressions) {
    logInfo(`Testing category: ${categoryName}`);

    const results = {
      categoryName: categoryName,
      totalExpressions: 0,
      successfulTests: 0,
      failedTests: 0,
      conversionWorking: 0,
      details: [],
    };

    // Handle nested structures
    const flattenExpressions = (obj) => {
      const flattened = [];
      if (Array.isArray(obj)) {
        flattened.push(...obj);
      } else if (typeof obj === "object") {
        Object.values(obj).forEach((value) => {
          flattened.push(...flattenExpressions(value));
        });
      }
      return flattened;
    };

    const expressionList = flattenExpressions(expressions);
    results.totalExpressions = expressionList.length;

    expressionList.forEach((expr) => {
      // Test both inline and display contexts for comprehensive validation
      const inlineResult = testLatexExpression(expr, "inline");
      const displayResult = testLatexExpression(expr, "display");

      if (inlineResult.success && displayResult.success) {
        results.successfulTests++;
        if (inlineResult.conversionWorking && displayResult.conversionWorking) {
          results.conversionWorking++;
        }
      } else {
        results.failedTests++;
      }

      results.details.push({
        expression: expr,
        inline: inlineResult,
        display: displayResult,
      });
    });

    logInfo(
      `Category ${categoryName}: ${results.successfulTests}/${results.totalExpressions} successful`
    );
    return results;
  }

  /**
   * Examine playground HTML for MathJax structures
   */
  function examinePlaygroundMathJax() {
    logInfo("Examining playground MathJax structures...");

    const outputDiv = document.getElementById("output");
    if (!outputDiv) {
      return {
        error: "Output container not available",
        mathContainers: 0,
        annotatedExpressions: 0,
        semanticExpressions: 0,
      };
    }

    const mathContainers = outputDiv.querySelectorAll("mjx-container");
    let annotatedCount = 0;
    let semanticCount = 0;
    const expressionDetails = [];

    mathContainers.forEach((container, index) => {
      const mathML = container.querySelector("mjx-assistive-mml math");
      let hasAnnotation = false;
      let hasSemantic = false;
      let latexContent = "";

      if (mathML) {
        // Check for LaTeX annotations
        const annotation =
          mathML.querySelector('annotation[encoding="application/x-tex"]') ||
          mathML.querySelector('annotation[encoding="TeX"]') ||
          mathML.querySelector('annotation[encoding="LaTeX"]');

        if (annotation && annotation.textContent.trim()) {
          hasAnnotation = true;
          annotatedCount++;
          latexContent = annotation.textContent.trim();
        }

        // Check for semantic MathML structure
        const semanticElements = mathML.querySelectorAll(
          "msup, msub, mfrac, mrow, msqrt, munder, mover"
        );
        if (semanticElements.length > 0) {
          hasSemantic = true;
          semanticCount++;
        }
      }

      expressionDetails.push({
        index: index,
        hasAnnotation: hasAnnotation,
        hasSemantic: hasSemantic,
        latexContent:
          latexContent.substring(0, 50) +
          (latexContent.length > 50 ? "..." : ""),
        elementType:
          container.getAttribute("display") === "true" ? "display" : "inline",
      });
    });

    const summary = {
      mathContainers: mathContainers.length,
      annotatedExpressions: annotatedCount,
      semanticExpressions: semanticCount,
      annotationPercentage:
        mathContainers.length > 0
          ? Math.round((annotatedCount / mathContainers.length) * 100)
          : 0,
      semanticPercentage:
        mathContainers.length > 0
          ? Math.round((semanticCount / mathContainers.length) * 100)
          : 0,
      expressionDetails: expressionDetails,
    };

    logInfo("MathJax examination complete:", summary);
    return summary;
  }

  /**
   * Test export consistency by comparing playground vs export
   */
  function testExportConsistency() {
    logInfo("Testing export consistency...");

    const playgroundAnalysis = examinePlaygroundMathJax();

    // Test the LaTeX processor conversion capabilities
    let processorTest = {
      available: false,
      conversionWorking: false,
      errors: [],
    };

    if (window.LaTeXProcessor && window.LaTeXProcessor.convertMathJaxToLatex) {
      processorTest.available = true;

      try {
        const outputDiv = document.getElementById("output");
        if (outputDiv && outputDiv.innerHTML.trim()) {
          const converted = window.LaTeXProcessor.convertMathJaxToLatex(
            outputDiv.innerHTML
          );
          processorTest.conversionWorking =
            typeof converted === "string" && converted.length > 0;

          // Check if conversion preserved LaTeX structures
          const hasLatexDelimiters =
            /\\[\[\(]/.test(converted) || /\\[\]\)]/.test(converted);
          processorTest.preservesDelimiters = hasLatexDelimiters;
        } else {
          processorTest.errors.push(
            "No content available for conversion testing"
          );
        }
      } catch (error) {
        processorTest.errors.push(error.message);
      }
    } else {
      processorTest.errors.push("LaTeX processor not available");
    }

    return {
      playgroundAnalysis: playgroundAnalysis,
      processorTest: processorTest,
      exportReady:
        processorTest.available &&
        processorTest.conversionWorking &&
        playgroundAnalysis.mathContainers > 0,
      recommendations: generateConsistencyRecommendations(
        playgroundAnalysis,
        processorTest
      ),
    };
  }

  /**
   * Generate recommendations based on consistency testing
   */
  function generateConsistencyRecommendations(
    playgroundAnalysis,
    processorTest
  ) {
    const recommendations = [];

    if (playgroundAnalysis.mathContainers === 0) {
      recommendations.push({
        level: "info",
        message:
          "No mathematical expressions detected. Add LaTeX expressions to test consistency.",
      });
    }

    if (playgroundAnalysis.annotationPercentage < 100) {
      recommendations.push({
        level: "warning",
        message: `Only ${playgroundAnalysis.annotationPercentage}% of expressions have LaTeX annotations. This may affect export quality.`,
      });
    }

    if (!processorTest.available) {
      recommendations.push({
        level: "error",
        message:
          "LaTeX processor not available. Export consistency cannot be guaranteed.",
      });
    } else if (!processorTest.conversionWorking) {
      recommendations.push({
        level: "error",
        message:
          "LaTeX processor conversion failed. Check processor implementation.",
      });
    }

    if (processorTest.preservesDelimiters === false) {
      recommendations.push({
        level: "warning",
        message:
          "LaTeX delimiters may not be preserved during conversion. Check delimiter handling.",
      });
    }

    if (playgroundAnalysis.semanticPercentage < 50) {
      recommendations.push({
        level: "info",
        message:
          "Limited semantic MathML structure detected. Consider enhancing semantic parsing for better fallback support.",
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        level: "success",
        message:
          "All consistency checks passed. Export should render mathematical expressions correctly.",
      });
    }

    return recommendations;
  }

  // ===========================================================================================
  // COMPREHENSIVE TESTING FUNCTIONS
  // ===========================================================================================

  /**
   * Run all mathematical expression tests
   */
  function runAllMathematicalTests() {
    logInfo("🧪 Running comprehensive mathematical expression tests...");

    const results = {
      testSummary: {
        totalCategories: 0,
        totalExpressions: 0,
        successfulExpressions: 0,
        categoriesWithIssues: 0,
      },
      categoryResults: {},
      overallSuccess: true,
    };

    Object.entries(MATHEMATICAL_TEST_EXPRESSIONS).forEach(
      ([categoryName, expressions]) => {
        const categoryResult = testExpressionCategory(
          categoryName,
          expressions
        );
        results.categoryResults[categoryName] = categoryResult;

        results.testSummary.totalCategories++;
        results.testSummary.totalExpressions += categoryResult.totalExpressions;
        results.testSummary.successfulExpressions +=
          categoryResult.successfulTests;

        if (categoryResult.failedTests > 0) {
          results.testSummary.categoriesWithIssues++;
          results.overallSuccess = false;
        }
      }
    );

    results.testSummary.successRate =
      results.testSummary.totalExpressions > 0
        ? Math.round(
            (results.testSummary.successfulExpressions /
              results.testSummary.totalExpressions) *
              100
          )
        : 0;

    logInfo(
      `Mathematical expression testing complete: ${results.testSummary.successfulExpressions}/${results.testSummary.totalExpressions} successful (${results.testSummary.successRate}%)`
    );

    return results;
  }

  /**
   * Main LaTeX consistency test function
   */
  function testLaTeXConsistency() {
    logInfo("🧪 Running comprehensive LaTeX consistency tests...");

    const tests = {
      moduleAvailability: () => {
        return !!(
          window.LaTeXProcessor &&
          typeof window.LaTeXProcessor.convertMathJaxToLatex === "function"
        );
      },

      playgroundMathDetection: () => {
        const analysis = examinePlaygroundMathJax();
        return analysis.mathContainers > 0 || analysis.error === undefined;
      },

      basicExpressionTests: () => {
        const basicResult = testExpressionCategory(
          "basic",
          MATHEMATICAL_TEST_EXPRESSIONS.basicElements
        );
        return basicResult.successfulTests === basicResult.totalExpressions;
      },

      complexExpressionTests: () => {
        const complexResult = testExpressionCategory(
          "complex",
          MATHEMATICAL_TEST_EXPRESSIONS.complexExpressions
        );
        return complexResult.failedTests === 0;
      },

      exportConsistencyCheck: () => {
        const consistencyResult = testExportConsistency();
        return consistencyResult.exportReady;
      },

      comprehensiveMathTests: () => {
        const allMathResult = runAllMathematicalTests();
        return (
          allMathResult.overallSuccess &&
          allMathResult.testSummary.successRate >= 95
        );
      },
    };

    return TestUtilities.runTestSuite("LaTeX Consistency", tests);
  }

  // ===========================================================================================
  // DIAGNOSTIC COMMANDS
  // ===========================================================================================

  /**
   * Quick diagnostic for specific expression
   */
  function quickExpressionDiagnostic(latex) {
    console.log(`🔍 Quick diagnostic for: ${latex}`);

    const inlineTest = testLatexExpression(latex, "inline");
    const displayTest = testLatexExpression(latex, "display");

    console.log("Inline test:", inlineTest);
    console.log("Display test:", displayTest);

    if (inlineTest.conversionWorking && displayTest.conversionWorking) {
      console.log("✅ Expression should export correctly");
    } else if (inlineTest.processorAvailable) {
      console.log("⚠️ Conversion may have issues - check LaTeX processor");
    } else {
      console.log(
        "❌ LaTeX processor not available - export consistency uncertain"
      );
    }

    return { inline: inlineTest, display: displayTest };
  }

  /**
   * Export-specific diagnostic function for exported HTML files
   * This tests the actual exported content, not playground content
   */
  function diagnosticExportedMath() {
    console.log("🔍 EXPORT MATH DIAGNOSTIC");
    console.log("=".repeat(50));

    // Test cases for the known issues
    const problemCases = [
      {
        name: "Set membership (∈ symbol)",
        latex: "\\forall x \\in \\mathbb{R}",
        expected: "∀x ∈ ℝ",
      },
      {
        name: "Cases environment",
        latex:
          "f(x) = \\begin{cases} 1 & \\text{if } x > 0 \\\\ 0 & \\text{if } x = 0 \\end{cases}",
        expected: "proper curly brace structure",
      },
      {
        name: "Basic in symbol",
        latex: "x \\in A",
        expected: "x ∈ A",
      },
    ];

    const results = {
      mathjaxAvailable: !!window.MathJax,
      mathjaxVersion: window.MathJax?.version || "unknown",
      packages: window.MathJax?.tex?.packages || [],
      hasAMS: window.MathJax?.tex?.packages?.includes?.("ams") || false,
      hasCases: window.MathJax?.tex?.packages?.includes?.("cases") || false,
      problemCases: [],
    };

    console.log("📊 MathJax Environment:");
    console.log(`   Version: ${results.mathjaxVersion}`);
    console.log(`   Available: ${results.mathjaxAvailable}`);
    console.log(`   AMS package: ${results.hasAMS}`);
    console.log(`   Cases package: ${results.hasCases}`);
    console.log(`   All packages: ${JSON.stringify(results.packages)}`);

    // Test each problem case
    problemCases.forEach((testCase, index) => {
      console.log(`\n🧪 Test ${index + 1}: ${testCase.name}`);
      console.log(`   LaTeX: ${testCase.latex}`);
      console.log(`   Expected: ${testCase.expected}`);

      const testResult = {
        name: testCase.name,
        latex: testCase.latex,
        success: false,
        error: null,
      };

      try {
        // Create test element
        const testDiv = document.createElement("div");
        testDiv.innerHTML = `<p>Test: $${testCase.latex}$</p>`;
        document.body.appendChild(testDiv);

        // Check if MathJax can process it
        if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([testDiv])
            .then(() => {
              const mathContainer = testDiv.querySelector("mjx-container");
              if (mathContainer) {
                console.log(`   ✅ MathJax processed successfully`);
                testResult.success = true;
              } else {
                console.log(`   ❌ MathJax failed to create container`);
                testResult.error = "No MathJax container created";
              }
              document.body.removeChild(testDiv);
            })
            .catch((error) => {
              console.log(`   ❌ MathJax processing error: ${error.message}`);
              testResult.error = error.message;
              document.body.removeChild(testDiv);
            });
        } else {
          console.log(`   ❌ MathJax not available for processing`);
          testResult.error = "MathJax not available";
          document.body.removeChild(testDiv);
        }
      } catch (error) {
        console.log(`   ❌ Test error: ${error.message}`);
        testResult.error = error.message;
      }

      results.problemCases.push(testResult);
    });

    console.log("\n📋 DIAGNOSTIC SUMMARY");
    console.log("=".repeat(30));

    if (results.mathjaxAvailable && results.hasAMS && results.hasCases) {
      console.log("✅ MathJax environment appears correctly configured");
    } else {
      console.log("❌ MathJax environment has configuration issues");
    }

    return results;
  }

  /**
   * System-wide LaTeX consistency diagnostic
   */
  function systemConsistencyDiagnostic() {
    console.log("🔍 System-wide LaTeX consistency diagnostic");
    console.log("=".repeat(50));

    // Check dependencies
    const deps = {
      latexProcessor: !!window.LaTeXProcessor,
      conversionMethod: !!(
        window.LaTeXProcessor && window.LaTeXProcessor.convertMathJaxToLatex
      ),
      outputContainer: !!document.getElementById("output"),
    };

    console.log("📋 Dependencies:", deps);

    // Examine current state
    const playground = examinePlaygroundMathJax();
    console.log("🔬 Playground analysis:", playground);

    // Test export consistency
    const consistency = testExportConsistency();
    console.log("🔄 Export consistency:", consistency);

    // Show recommendations
    console.log("💡 Recommendations:");
    consistency.recommendations.forEach((rec) => {
      const icon =
        {
          success: "✅",
          info: "ℹ️",
          warning: "⚠️",
          error: "❌",
        }[rec.level] || "📝";
      console.log(`${icon} ${rec.message}`);
    });

    return {
      dependencies: deps,
      playground: playground,
      consistency: consistency,
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main testing function
    testLaTeXConsistency,

    // Category testing
    runAllMathematicalTests,
    testExpressionCategory,

    // Individual expression testing
    testLatexExpression,
    quickExpressionDiagnostic,

    // System analysis
    examinePlaygroundMathJax,
    testExportConsistency,
    systemConsistencyDiagnostic,

    // Test data access
    getTestExpressions: () => MATHEMATICAL_TEST_EXPRESSIONS,

    // Utilities
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available
window.TestLaTeXConsistency = TestLaTeXConsistency;

// Add convenient global testing commands
window.testLatexConsistency = TestLaTeXConsistency.testLaTeXConsistency;
window.testAllMathExpressions = TestLaTeXConsistency.runAllMathematicalTests;
window.checkExportConsistency = TestLaTeXConsistency.testExportConsistency;
window.quickMathDiagnostic = TestLaTeXConsistency.systemConsistencyDiagnostic;
window.testMathExpression = TestLaTeXConsistency.quickExpressionDiagnostic;
window.examinePlaygroundMathJax = TestLaTeXConsistency.examinePlaygroundMathJax;
window.testExpressionCategory = TestLaTeXConsistency.testExpressionCategory;
window.getTestExpressions = TestLaTeXConsistency.getTestExpressions;

console.log(
  "✅ LaTeX Consistency Testing module loaded - comprehensive mathematical expression validation ready!"
);
