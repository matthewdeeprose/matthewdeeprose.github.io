// test-cross-reference-fixer.js
// Individual test module for CrossReferenceFixer
// Part of Enhanced Pandoc-WASM Mathematical Playground testing framework

const TestCrossReferenceFixer = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION
  // ===========================================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[TEST_CROSS_REF_FIXER] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[TEST_CROSS_REF_FIXER] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[TEST_CROSS_REF_FIXER] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[TEST_CROSS_REF_FIXER] ${message}`, ...args);
  }

  // ===========================================================================================
  // TEST DATA SETUP
  // ===========================================================================================

  /**
   * Create test LaTeX content with various label types
   */
  function createTestLatexContent() {
    return `
\\section{Introduction}\\label{sec:intro}
This is the introduction section.

\\subsection{Background}\\label{sec:background}
Some background information.

\\begin{equation}\\label{eq:test}
E = mc^2
\\end{equation}

\\begin{figure}
\\centering
\\includegraphics{test.png}
\\caption{Test figure}\\label{fig:test}
\\end{figure}

\\begin{table}
\\centering
\\begin{tabular}{cc}
A & B \\\\
1 & 2
\\end{tabular}
\\caption{Test table}\\label{tab:test}
\\end{table}

\\begin{theorem}\\label{thm:main}
This is a theorem.
\\end{theorem}

\\begin{definition}\\label{def:important}
This is a definition.
\\end{definition}

See Section~\\ref{sec:intro} and Equation~\\ref{eq:test}.
Also refer to Figure~\\ref{fig:test} and Table~\\ref{tab:test}.
The proof uses Theorem~\\ref{thm:main} and Definition~\\ref{def:important}.
`;
  }

  /**
   * Create test HTML content with cross-reference links but missing anchors
   */
  function createTestHtmlContent() {
    return `
<section id="content-introduction">
<h1>Introduction</h1>
<p>This is the introduction section.</p>
</section>

<section id="content-background">
<h2>Background</h2>
<p>Some background information.</p>
</section>

<mjx-container jax="CHTML" display="true">
<mjx-math display="true">
<mjx-semantics>
<mjx-mrow>
<mjx-mi>E</mjx-mi>
<mjx-mo>=</mjx-mo>
<mjx-mi>m</mjx-mi>
<mjx-msup>
<mjx-mi>c</mjx-mi>
<mjx-mn>2</mjx-mn>
</mjx-msup>
</mjx-mrow>
</mjx-semantics>
</mjx-math>
</mjx-container>

<figure>
<img src="test.png" alt="Test image" />
<figcaption>Test figure</figcaption>
</figure>

<table>
<thead>
<tr><th>A</th><th>B</th></tr>
</thead>
<tbody>
<tr><td>1</td><td>2</td></tr>
</tbody>
<caption>Test table</caption>
</table>

<p>See Section <a href="#content-sec:intro" data-reference-type="ref" data-reference="sec:intro">sec:intro</a> 
and Equation <a href="#content-eq:test" data-reference-type="ref" data-reference="eq:test">eq:test</a>.</p>

<p>Also refer to Figure <a href="#content-fig:test" data-reference-type="ref" data-reference="fig:test">fig:test</a> 
and Table <a href="#content-tab:test" data-reference-type="ref" data-reference="tab:test">tab:test</a>.</p>

<p>The proof uses Theorem <a href="#content-thm:main" data-reference-type="ref" data-reference="thm:main">thm:main</a> 
and Definition <a href="#content-def:important" data-reference-type="ref" data-reference="def:important">def:important</a>.</p>
`;
  }

  /**
   * Setup test environment with DOM elements
   */
  function setupTestEnvironment() {
    // Ensure output div exists
    let outputDiv = document.getElementById("output");
    if (!outputDiv) {
      outputDiv = document.createElement("div");
      outputDiv.id = "output";
      document.body.appendChild(outputDiv);
    }
    return outputDiv;
  }

  /**
   * Cleanup test environment
   */
  function cleanupTestEnvironment(outputDiv) {
    if (outputDiv && outputDiv.parentNode) {
      outputDiv.innerHTML = "";
      // Don't remove the div as other tests might need it
    }
  }

  // ===========================================================================================
  // INDIVIDUAL TEST FUNCTIONS
  // ===========================================================================================

  /**
   * Test module existence and basic API
   */
  function testModuleExists() {
    return {
      moduleAvailable: () => {
        return typeof window.CrossReferenceFixer !== "undefined";
      },

      hasMainFunction: () => {
        return (
          window.CrossReferenceFixer &&
          typeof window.CrossReferenceFixer.fixCrossReferences === "function"
        );
      },

      hasVerificationFunction: () => {
        return (
          window.CrossReferenceFixer &&
          typeof window.CrossReferenceFixer.verifyCrossReferences === "function"
        );
      },

      hasAnalysisFunction: () => {
        return (
          window.CrossReferenceFixer &&
          typeof window.CrossReferenceFixer.analyseLaTeXLabels === "function"
        );
      },

      hasModuleInfo: () => {
        return (
          window.CrossReferenceFixer &&
          window.CrossReferenceFixer.name === "CrossReferenceFixer" &&
          typeof window.CrossReferenceFixer.version === "string"
        );
      },
    };
  }

  /**
   * Test LaTeX label analysis functionality
   */
  function testLaTeXAnalysis() {
    const testLatex = createTestLatexContent();

    return {
      analysesLabels: () => {
        if (!window.CrossReferenceFixer) return false;

        const labels = window.CrossReferenceFixer.analyseLaTeXLabels(testLatex);
        return Array.isArray(labels) && labels.length > 0;
      },

      identifiesCorrectLabels: () => {
        if (!window.CrossReferenceFixer) return false;

        const labels = window.CrossReferenceFixer.analyseLaTeXLabels(testLatex);
        const labelNames = labels.map((l) => l.label);

        const expectedLabels = [
          "sec:intro",
          "sec:background",
          "eq:test",
          "fig:test",
          "tab:test",
          "thm:main",
          "def:important",
        ];
        return expectedLabels.every((expected) =>
          labelNames.includes(expected)
        );
      },

      determinesLabelTypes: () => {
        if (!window.CrossReferenceFixer) return false;

        const labels = window.CrossReferenceFixer.analyseLaTeXLabels(testLatex);
        const sectionLabel = labels.find((l) => l.label === "sec:intro");
        const equationLabel = labels.find((l) => l.label === "eq:test");
        const figureLabel = labels.find((l) => l.label === "fig:test");

        return (
          sectionLabel?.type === "section" &&
          equationLabel?.type === "equation" &&
          figureLabel?.type === "figure"
        );
      },

      handlesEmptyInput: () => {
        if (!window.CrossReferenceFixer) return false;

        const labels = window.CrossReferenceFixer.analyseLaTeXLabels("");
        return Array.isArray(labels) && labels.length === 0;
      },
    };
  }

  /**
   * Test label type determination
   */
  function testLabelTypeDetermination() {
    return {
      identifiesSectionsByPrefix: () => {
        if (!window.CrossReferenceFixer) return false;

        const type = window.CrossReferenceFixer.determineLabelType(
          "",
          "sec:introduction"
        );
        return type === "section";
      },

      identifiesEquationsByPrefix: () => {
        if (!window.CrossReferenceFixer) return false;

        const type = window.CrossReferenceFixer.determineLabelType(
          "",
          "eq:einstein"
        );
        return type === "equation";
      },

      identifiesFiguresByPrefix: () => {
        if (!window.CrossReferenceFixer) return false;

        const type = window.CrossReferenceFixer.determineLabelType(
          "",
          "fig:diagram"
        );
        return type === "figure";
      },

      identifiesTablesByPrefix: () => {
        if (!window.CrossReferenceFixer) return false;

        const type = window.CrossReferenceFixer.determineLabelType(
          "",
          "tab:results"
        );
        return type === "table";
      },

      identifiesTheoremsByPrefix: () => {
        if (!window.CrossReferenceFixer) return false;

        const type = window.CrossReferenceFixer.determineLabelType(
          "",
          "thm:main"
        );
        return type === "theorem";
      },

      identifiesDefinitionsByPrefix: () => {
        if (!window.CrossReferenceFixer) return false;

        const type = window.CrossReferenceFixer.determineLabelType(
          "",
          "def:important"
        );
        return type === "definition";
      },

      identifiesByContext: () => {
        if (!window.CrossReferenceFixer) return false;

        const sectionContext = "\\section{Introduction} \\label{intro}";
        const equationContext = "\\begin{equation} E=mc^2 \\label{einstein}";

        const sectionType = window.CrossReferenceFixer.determineLabelType(
          sectionContext,
          "intro"
        );
        const equationType = window.CrossReferenceFixer.determineLabelType(
          equationContext,
          "einstein"
        );

        return sectionType === "section" && equationType === "equation";
      },

      fallsBackToGeneric: () => {
        if (!window.CrossReferenceFixer) return false;

        const type = window.CrossReferenceFixer.determineLabelType(
          "",
          "unknown"
        );
        return type === "generic";
      },
    };
  }

  /**
   * Test cross-reference fixing workflow
   */
  function testCrossReferenceFix() {
    const outputDiv = setupTestEnvironment();

    return {
      fixesWithoutLatexInput: () => {
        try {
          if (!window.CrossReferenceFixer) return false;

          // Set up test HTML with broken cross-references
          outputDiv.innerHTML = createTestHtmlContent();

          const results = window.CrossReferenceFixer.fixCrossReferences();

          return (
            results &&
            typeof results.processed === "number" &&
            typeof results.fixed === "number" &&
            typeof results.failed === "number"
          );
        } finally {
          cleanupTestEnvironment(outputDiv);
        }
      },

      fixesWithLatexInput: () => {
        try {
          if (!window.CrossReferenceFixer) return false;

          const testLatex = createTestLatexContent();
          outputDiv.innerHTML = createTestHtmlContent();

          const results =
            window.CrossReferenceFixer.fixCrossReferences(testLatex);

          return (
            results && results.processed > 0 && Array.isArray(results.details)
          );
        } finally {
          cleanupTestEnvironment(outputDiv);
        }
      },

      createsAnchors: () => {
        try {
          if (!window.CrossReferenceFixer) return false;

          const testLatex = createTestLatexContent();
          outputDiv.innerHTML = createTestHtmlContent();

          // Count existing anchors before fixing
          const beforeCount =
            outputDiv.querySelectorAll('[id^="content-"]').length;

          const results =
            window.CrossReferenceFixer.fixCrossReferences(testLatex);

          // Count anchors after fixing
          const afterCount =
            outputDiv.querySelectorAll('[id^="content-"]').length;

          return afterCount > beforeCount && results.fixed > 0;
        } finally {
          cleanupTestEnvironment(outputDiv);
        }
      },

      handlesNoReferences: () => {
        try {
          if (!window.CrossReferenceFixer) return false;

          outputDiv.innerHTML = "<p>No cross-references here.</p>";

          const results = window.CrossReferenceFixer.fixCrossReferences();

          return results && results.processed === 0;
        } finally {
          cleanupTestEnvironment(outputDiv);
        }
      },
    };
  }

  /**
   * Test verification functionality
   */
  function testVerification() {
    const outputDiv = setupTestEnvironment();

    return {
      verifiesWorkingReferences: () => {
        try {
          if (!window.CrossReferenceFixer) return false;

          // Create HTML with working cross-references
          outputDiv.innerHTML = `
            <p id="content-sec:intro">Introduction</p>
            <p>See <a href="#content-sec:intro" data-reference-type="ref" data-reference="sec:intro">section</a></p>
          `;

          const results = window.CrossReferenceFixer.verifyCrossReferences();

          return (
            results &&
            results.total === 1 &&
            results.working === 1 &&
            results.broken === 0
          );
        } finally {
          cleanupTestEnvironment(outputDiv);
        }
      },

      identifiesBrokenReferences: () => {
        try {
          if (!window.CrossReferenceFixer) return false;

          // Create HTML with broken cross-references
          outputDiv.innerHTML = `
            <p>See <a href="#content-missing" data-reference-type="ref" data-reference="missing">missing</a></p>
          `;

          const results = window.CrossReferenceFixer.verifyCrossReferences();

          return (
            results &&
            results.total === 1 &&
            results.working === 0 &&
            results.broken === 1
          );
        } finally {
          cleanupTestEnvironment(outputDiv);
        }
      },

      handlesNoReferences: () => {
        try {
          if (!window.CrossReferenceFixer) return false;

          outputDiv.innerHTML = "<p>No references</p>";

          const results = window.CrossReferenceFixer.verifyCrossReferences();

          return results && results.total === 0;
        } finally {
          cleanupTestEnvironment(outputDiv);
        }
      },
    };
  }

  /**
   * Test error handling and edge cases
   */
  function testErrorHandling() {
    const outputDiv = setupTestEnvironment();

    return {
      handlesInvalidLatexInput: () => {
        try {
          if (!window.CrossReferenceFixer) return false;

          outputDiv.innerHTML = createTestHtmlContent();

          // Should not throw error with invalid LaTeX input
          const results = window.CrossReferenceFixer.fixCrossReferences(null);
          return results && typeof results === "object";
        } catch (error) {
          return false;
        } finally {
          cleanupTestEnvironment(outputDiv);
        }
      },

      handlesCorruptedDOM: () => {
        try {
          if (!window.CrossReferenceFixer) return false;

          // Create malformed HTML
          outputDiv.innerHTML =
            '<a href="#broken" data-reference-type="ref">broken link';

          // Should not throw error
          const results = window.CrossReferenceFixer.fixCrossReferences();
          return results && typeof results === "object";
        } catch (error) {
          return false;
        } finally {
          cleanupTestEnvironment(outputDiv);
        }
      },

      gracefulDegradation: () => {
        try {
          if (!window.CrossReferenceFixer) return false;

          // Test with no output div available
          const originalDiv = document.getElementById("output");
          if (originalDiv) originalDiv.remove();

          const results = window.CrossReferenceFixer.fixCrossReferences();

          // Should return results even if no output div
          return results && typeof results === "object";
        } catch (error) {
          return false;
        } finally {
          // Restore output div
          if (!document.getElementById("output")) {
            const newDiv = document.createElement("div");
            newDiv.id = "output";
            document.body.appendChild(newDiv);
          }
        }
      },
    };
  }

  /**
   * Test integration with logging system
   */
  function testLoggingIntegration() {
    return {
      hasLoggingSystem: () => {
        return (
          window.CrossReferenceFixer &&
          window.CrossReferenceFixer._config &&
          typeof window.CrossReferenceFixer._config.hasLoggingSystem ===
            "boolean"
        );
      },

      canGetLogger: () => {
        return (
          window.CrossReferenceFixer &&
          typeof window.CrossReferenceFixer.getLogger === "function"
        );
      },

      loggingSystemIntegration: () => {
        if (!window.CrossReferenceFixer) return false;

        const config = window.CrossReferenceFixer._config;

        // Should indicate whether LoggingSystem is available
        return typeof config.hasLoggingSystem === "boolean";
      },
    };
  }

  // ===========================================================================================
  // MAIN TEST FUNCTION
  // ===========================================================================================

  /**
   * Main test function for CrossReferenceFixer module
   * @returns {Object} - Test results
   */
  function testCrossReferenceFixer() {
    logInfo("Starting CrossReferenceFixer module tests...");

    const testSuites = [
      { name: "Module Existence", tests: testModuleExists() },
      { name: "LaTeX Analysis", tests: testLaTeXAnalysis() },
      { name: "Label Type Determination", tests: testLabelTypeDetermination() },
      { name: "Cross-Reference Fixing", tests: testCrossReferenceFix() },
      { name: "Verification", tests: testVerification() },
      { name: "Error Handling", tests: testErrorHandling() },
      { name: "Logging Integration", tests: testLoggingIntegration() },
    ];

    let totalPassed = 0;
    let totalTests = 0;
    const results = {};

    testSuites.forEach((suite) => {
      logDebug(`Running ${suite.name} tests...`);

      let suitePassed = 0;
      let suiteTotal = 0;

      Object.entries(suite.tests).forEach(([testName, testFn]) => {
        suiteTotal++;
        totalTests++;

        try {
          const result = testFn();
          if (result) {
            suitePassed++;
            totalPassed++;
            logDebug(`  ✅ ${testName}: PASSED`);
          } else {
            logWarn(`  ❌ ${testName}: FAILED`);
          }
        } catch (error) {
          logError(`  ❌ ${testName}: ERROR - ${error.message}`);
        }
      });

      results[suite.name] = {
        passed: suitePassed,
        total: suiteTotal,
        success: suitePassed === suiteTotal,
      };

      logInfo(`${suite.name}: ${suitePassed}/${suiteTotal} tests passed`);
    });

    const overallSuccess = totalPassed === totalTests;

    logInfo(
      `📊 CrossReferenceFixer: ${totalPassed}/${totalTests} tests passed overall`
    );

    if (overallSuccess) {
      logInfo("✅ All CrossReferenceFixer tests PASSED");
    } else {
      logWarn(
        `❌ ${totalTests - totalPassed} CrossReferenceFixer tests FAILED`
      );
    }

    return {
      success: overallSuccess,
      allPassed: overallSuccess,
      passed: totalPassed,
      total: totalTests,
      totalTests: totalTests,
      results: results,
      moduleName: "CrossReferenceFixer",
    };
  }

  // ===========================================================================================
  // CONSOLE TESTING UTILITIES
  // ===========================================================================================

  /**
   * Quick diagnostic test for console use
   */
  function quickDiagnostic() {
    const outputDiv = setupTestEnvironment();

    try {
      if (!window.CrossReferenceFixer) {
        console.log("❌ CrossReferenceFixer module not available");
        return false;
      }

      console.log("🔧 CrossReferenceFixer Quick Diagnostic");
      console.log("=====================================");

      // Test with sample data
      const testLatex = createTestLatexContent();
      outputDiv.innerHTML = createTestHtmlContent();

      console.log("📝 LaTeX Analysis Test:");
      const labels = window.CrossReferenceFixer.analyseLaTeXLabels(testLatex);
      console.log(
        `  Found ${labels.length} labels:`,
        labels.map((l) => `${l.label}(${l.type})`)
      );

      console.log("\n🔗 Cross-Reference Fixing Test:");
      const beforeLinks = outputDiv.querySelectorAll(
        'a[data-reference-type="ref"]'
      ).length;
      const beforeAnchors =
        outputDiv.querySelectorAll('[id^="content-"]').length;

      const results = window.CrossReferenceFixer.fixCrossReferences(testLatex);

      const afterAnchors =
        outputDiv.querySelectorAll('[id^="content-"]').length;

      console.log(`  Links processed: ${results.processed}`);
      console.log(`  Anchors created: ${results.fixed}`);
      console.log(`  Failed attempts: ${results.failed}`);
      console.log(`  Anchors before: ${beforeAnchors}, after: ${afterAnchors}`);

      console.log("\n✅ Verification Test:");
      const verification = window.CrossReferenceFixer.verifyCrossReferences();
      console.log(
        `  Working links: ${verification.working}/${verification.total}`
      );
      console.log(
        `  Broken links: ${verification.broken}/${verification.total}`
      );

      console.log("\n🎯 Quick Diagnostic Complete");

      return {
        moduleAvailable: true,
        labelsFound: labels.length,
        linksProcessed: results.processed,
        anchorsCreated: results.fixed,
        workingLinks: verification.working,
        brokenLinks: verification.broken,
      };
    } catch (error) {
      console.error("❌ Quick diagnostic failed:", error);
      return false;
    } finally {
      cleanupTestEnvironment(outputDiv);
    }
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Main test function
    testCrossReferenceFixer,

    // Individual test suites (for detailed testing)
    testModuleExists,
    testLaTeXAnalysis,
    testLabelTypeDetermination,
    testCrossReferenceFix,
    testVerification,
    testErrorHandling,
    testLoggingIntegration,

    // Utilities
    quickDiagnostic,
    setupTestEnvironment,
    cleanupTestEnvironment,

    // Test data generators
    createTestLatexContent,
    createTestHtmlContent,
  };
})();

// Make available globally
if (typeof window !== "undefined") {
  window.TestCrossReferenceFixer = TestCrossReferenceFixer;
}

// Console shortcuts
if (typeof window !== "undefined") {
  window.testCrossReferenceFixer =
    TestCrossReferenceFixer.testCrossReferenceFixer;
  window.quickDiagnosticCrossRef = TestCrossReferenceFixer.quickDiagnostic;
}

function testCrossReferenceStatus() {
  console.log("=== CROSS-REFERENCE STATUS TEST ===");

  const crossRefLinks = document.querySelectorAll(
    'a[data-reference-type="ref"]'
  );
  console.log(`Total cross-reference links found: ${crossRefLinks.length}`);

  let working = 0;
  let broken = 0;
  const results = [];

  crossRefLinks.forEach((link, index) => {
    const href = link.getAttribute("href");
    const targetId = href ? href.replace("#", "") : null;
    const target = targetId ? document.getElementById(targetId) : null;
    const originalRef = link.getAttribute("data-reference");
    const linkText = link.textContent.trim();

    if (target) {
      working++;
      results.push(
        `✅ ${index + 1}: "${linkText}" → ${targetId} (${target.tagName})`
      );
    } else {
      broken++;
      results.push(`❌ ${index + 1}: "${linkText}" → ${targetId} (MISSING)`);
    }
  });

  console.log(`\n=== RESULTS ===`);
  console.log(`Working: ${working}`);
  console.log(`Broken: ${broken}`);
  console.log(
    `Success Rate: ${((working / crossRefLinks.length) * 100).toFixed(1)}%`
  );

  console.log(`\n=== DETAILED RESULTS ===`);
  results.forEach((result) => console.log(result));

  return {
    total: crossRefLinks.length,
    working,
    broken,
    successRate: (working / crossRefLinks.length) * 100,
  };
}

function testCrossReferenceTypes() {
  console.log("=== CROSS-REFERENCE TYPE ANALYSIS ===");

  const crossRefLinks = document.querySelectorAll(
    'a[data-reference-type="ref"]'
  );
  const typeAnalysis = {};

  crossRefLinks.forEach((link) => {
    const href = link.getAttribute("href");
    const targetId = href ? href.replace("#", "") : null;
    const target = targetId ? document.getElementById(targetId) : null;
    const originalRef = link.getAttribute("data-reference") || "unknown";

    // Determine type from reference
    let type = "generic";
    if (originalRef.startsWith("sec:")) type = "section";
    else if (originalRef.startsWith("eq:")) type = "equation";
    else if (originalRef.startsWith("fig:")) type = "figure";
    else if (originalRef.startsWith("tab:")) type = "table";
    else if (originalRef.startsWith("thm:")) type = "theorem";
    else if (originalRef.startsWith("def:")) type = "definition";
    else if (originalRef.startsWith("lem:")) type = "lemma";
    else if (originalRef.startsWith("cor:")) type = "corollary";

    if (!typeAnalysis[type]) {
      typeAnalysis[type] = { total: 0, working: 0, broken: 0 };
    }

    typeAnalysis[type].total++;
    if (target) {
      typeAnalysis[type].working++;
    } else {
      typeAnalysis[type].broken++;
    }
  });

  Object.entries(typeAnalysis).forEach(([type, stats]) => {
    const successRate = ((stats.working / stats.total) * 100).toFixed(1);
    console.log(
      `${type.toUpperCase()}: ${stats.working}/${
        stats.total
      } working (${successRate}%)`
    );
  });

  return typeAnalysis;
}

function testAnchorValidation() {
  console.log("=== ANCHOR VALIDATION TEST ===");

  const anchors = document.querySelectorAll("[data-original-label]");
  console.log(`Cross-reference anchors found: ${anchors.length}`);

  const anchorTypes = {};
  anchors.forEach((anchor) => {
    const type = anchor.getAttribute("data-label-type") || "unknown";
    const originalLabel =
      anchor.getAttribute("data-original-label") || "unknown";

    if (!anchorTypes[type]) {
      anchorTypes[type] = [];
    }
    anchorTypes[type].push({
      id: anchor.id,
      label: originalLabel,
      visible: anchor.style.visibility !== "hidden",
    });
  });

  Object.entries(anchorTypes).forEach(([type, anchors]) => {
    console.log(`${type.toUpperCase()} anchors: ${anchors.length}`);
    anchors.forEach((anchor) => {
      console.log(`  - #${anchor.id} (${anchor.label})`);
    });
  });

  return anchorTypes;
}

function testCrossReferenceClicks() {
  console.log("=== INTERACTIVE CLICK TEST ===");
  console.log("This will test clicking on cross-reference links...");

  const crossRefLinks = document.querySelectorAll(
    'a[data-reference-type="ref"]'
  );
  let testCount = 0;
  const maxTests = Math.min(5, crossRefLinks.length); // Test first 5 links

  function testNextLink() {
    if (testCount >= maxTests) {
      console.log("✅ Click test completed successfully!");
      return;
    }

    const link = crossRefLinks[testCount];
    const href = link.getAttribute("href");
    const linkText = link.textContent.trim();

    console.log(`Testing link ${testCount + 1}: "${linkText}" → ${href}`);

    // Scroll to target to test navigation
    const targetId = href.replace("#", "");
    const target = document.getElementById(targetId);

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        console.log(`✅ Successfully navigated to ${targetId}`);
        testCount++;
        setTimeout(testNextLink, 1000); // Wait 1s between tests
      }, 500);
    } else {
      console.log(`❌ Target ${targetId} not found`);
      testCount++;
      setTimeout(testNextLink, 100);
    }
  }

  testNextLink();
}

function runCrossReferenceTestSuite() {
  console.log("🧪 COMPREHENSIVE CROSS-REFERENCE TEST SUITE");
  console.log("=".repeat(50));

  const results = {
    timestamp: new Date().toISOString(),
    tests: {},
  };

  // Test 1: Basic Status
  console.log("\n1. BASIC STATUS TEST");
  results.tests.status = testCrossReferenceStatus();

  // Test 2: Type Analysis
  console.log("\n2. TYPE ANALYSIS TEST");
  results.tests.types = testCrossReferenceTypes();

  // Test 3: Anchor Validation
  console.log("\n3. ANCHOR VALIDATION TEST");
  results.tests.anchors = testAnchorValidation();

  // Test 4: CrossReferenceFixer Module Test
  console.log("\n4. MODULE INTEGRATION TEST");
  if (window.CrossReferenceFixer) {
    const verification = window.CrossReferenceFixer.verifyCrossReferences();
    results.tests.verification = verification;
    console.log(
      `Module verification: ${verification.working}/${verification.total} working`
    );
  } else {
    console.log("❌ CrossReferenceFixer module not available");
    results.tests.verification = { error: "Module not available" };
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 SUMMARY");
  const totalLinks = results.tests.status.total;
  const workingLinks = results.tests.status.working;
  const successRate = results.tests.status.successRate;

  console.log(`Total References: ${totalLinks}`);
  console.log(`Working References: ${workingLinks}`);
  console.log(`Success Rate: ${successRate.toFixed(1)}%`);

  if (successRate === 100) {
    console.log("🎉 PERFECT! All cross-references working!");
  } else {
    console.log("⚠️ Some cross-references need attention");
  }

  return results;
}

function analyzeAnchorPlacements() {
  console.log("🔍 ENHANCED ANCHOR PLACEMENT ANALYSIS");
  console.log("=".repeat(60));

  const anchors = document.querySelectorAll("[data-original-label]");
  console.log(`Found ${anchors.length} anchors to analyze\n`);

  const issues = [];

  anchors.forEach((anchor, index) => {
    const label = anchor.getAttribute("data-original-label");
    const type = anchor.getAttribute("data-label-type");
    const anchorId = anchor.id;

    console.log(`📍 ANCHOR #${index + 1}: ${label} (${type})`);
    console.log(`   ID: ${anchorId}`);

    // ENHANCED: Show actual DOM placement context
    console.log(`   📍 DOM CONTEXT:`);
    console.log(
      `      Parent: ${anchor.parentElement?.tagName}${
        anchor.parentElement?.id ? "#" + anchor.parentElement.id : ""
      }${
        anchor.parentElement?.className
          ? "." + anchor.parentElement.className.split(" ")[0]
          : ""
      }`
    );
    console.log(
      `      Parent content (first 80 chars): "${(
        anchor.parentElement?.textContent || ""
      )
        .trim()
        .substring(0, 80)}"`
    );

    // ENHANCED: Look for content in multiple directions
    const contentSources = {
      nextSibling: null,
      previousSibling: null,
      parentNext: null,
      parentPrevious: null,
      firstChild: null,
    };

    // Check next sibling
    let current = anchor.nextSibling;
    let attempts = 0;
    while (current && attempts < 5) {
      if (current.nodeType === 1 && current.textContent?.trim()) {
        contentSources.nextSibling = current.textContent
          .trim()
          .substring(0, 100);
        break;
      } else if (current.nodeType === 3 && current.textContent?.trim()) {
        contentSources.nextSibling = current.textContent
          .trim()
          .substring(0, 100);
        break;
      }
      current = current.nextSibling;
      attempts++;
    }

    // Check previous sibling
    current = anchor.previousSibling;
    attempts = 0;
    while (current && attempts < 5) {
      if (current.nodeType === 1 && current.textContent?.trim()) {
        contentSources.previousSibling = current.textContent
          .trim()
          .substring(0, 100);
        break;
      } else if (current.nodeType === 3 && current.textContent?.trim()) {
        contentSources.previousSibling = current.textContent
          .trim()
          .substring(0, 100);
        break;
      }
      current = current.previousSibling;
      attempts++;
    }

    // Check parent's next sibling
    if (anchor.parentElement?.nextSibling) {
      contentSources.parentNext =
        anchor.parentElement.nextSibling.textContent
          ?.trim()
          .substring(0, 100) || null;
    }

    // Check parent's previous sibling
    if (anchor.parentElement?.previousSibling) {
      contentSources.parentPrevious =
        anchor.parentElement.previousSibling.textContent
          ?.trim()
          .substring(0, 100) || null;
    }

    // Check first child of parent
    if (
      anchor.parentElement?.firstChild &&
      anchor.parentElement.firstChild !== anchor
    ) {
      contentSources.firstChild =
        anchor.parentElement.firstChild.textContent?.trim().substring(0, 100) ||
        null;
    }

    console.log(`   📄 NEARBY CONTENT:`);
    Object.entries(contentSources).forEach(([direction, content]) => {
      if (content) {
        console.log(`      ${direction}: "${content}"`);
      }
    });

    // ENHANCED: Check for specific content types based on anchor type
    let specificChecks = {};
    const parent = anchor.parentElement;

    switch (type) {
      case "equation":
        specificChecks = {
          parentHasMath: parent?.querySelector("mjx-container, .math")
            ? "✅ Found math container"
            : "❌ No math container",
          nearbyMath: (() => {
            const mathElements = document.querySelectorAll(
              'mjx-container[display="true"]'
            );
            let closestDistance = Infinity;
            let closestMath = null;
            mathElements.forEach((math) => {
              const distance = Math.abs(
                getElementIndex(math) - getElementIndex(anchor)
              );
              if (distance < closestDistance) {
                closestDistance = distance;
                closestMath = math;
              }
            });
            return closestMath
              ? `✅ Closest math (${closestDistance} elements away): "${closestMath.textContent?.substring(
                  0,
                  40
                )}"`
              : "❌ No math found";
          })(),
        };
        break;

      case "theorem":
      case "definition":
      case "lemma":
      case "corollary":
        specificChecks = {
          parentHasClass: parent?.className
            ? `Parent classes: ${parent.className}`
            : "No classes on parent",
          hasTheoremContent: parent?.textContent?.toLowerCase().includes(type)
            ? `✅ Found ${type} content`
            : `❌ No ${type} content nearby`,
        };
        break;

      case "table":
        specificChecks = {
          nearbyTable:
            anchor.closest("table") || document.querySelector("table")
              ? "✅ Table found"
              : "❌ No table found",
          parentIsTable:
            parent?.tagName === "TABLE"
              ? "✅ Parent is table"
              : "❌ Parent not table",
        };
        break;

      case "figure":
        specificChecks = {
          nearbyFigure:
            anchor.closest("figure") || document.querySelector("figure")
              ? "✅ Figure found"
              : "❌ No figure found",
          parentIsFigure:
            parent?.tagName === "FIGURE"
              ? "✅ Parent is figure"
              : "❌ Parent not figure",
        };
        break;
    }

    console.log(`   🔍 TYPE-SPECIFIC CHECKS (${type}):`);
    Object.entries(specificChecks).forEach(([check, result]) => {
      console.log(`      ${check}: ${result}`);
    });

    // Determine if placement looks correct
    const hasRelevantContent = Object.values(contentSources).some(
      (content) => content && content.length > 10 && !content.match(/^[.\s]*$/)
    );

    const placementQuality = hasRelevantContent
      ? contentSources.nextSibling
        ? "GOOD"
        : "FAIR"
      : "POOR";

    console.log(`   📊 PLACEMENT QUALITY: ${placementQuality}`);

    if (placementQuality === "POOR") {
      issues.push({
        label,
        type,
        anchorId,
        placement: placementQuality,
        parentTag: parent?.tagName,
        contentSources,
      });
    }

    console.log("");
  });

  // Helper function to get element index in document
  function getElementIndex(element) {
    const allElements = Array.from(document.querySelectorAll("*"));
    return allElements.indexOf(element);
  }

  console.log("=".repeat(60));
  console.log(`📊 SUMMARY: ${issues.length} placement issues found`);

  if (issues.length > 0) {
    console.log("\n🚨 DETAILED ISSUES:");
    issues.forEach((issue, i) => {
      console.log(
        `   ${i + 1}. ${issue.label} (${issue.type}): ${
          issue.placement
        } placement`
      );
      console.log(
        `      Parent: ${issue.parentTag}, Available content sources: ${
          Object.keys(issue.contentSources).filter(
            (k) => issue.contentSources[k]
          ).length
        }`
      );
    });
  } else {
    console.log("🎉 All anchors appear to have reasonable content nearby!");
  }

  return { totalAnchors: anchors.length, issues };
}

function analyzeAnchorPlacementPrecision() {
  console.log("🔍 PRECISION ANCHOR PLACEMENT ANALYSIS");
  console.log("=".repeat(50));

  const anchors = document.querySelectorAll("[data-original-label]");
  const issues = [];

  anchors.forEach((anchor, index) => {
    const label = anchor.getAttribute("data-original-label");
    const type = anchor.getAttribute("data-label-type");

    // Check if anchor is at document root (major problem)
    const isAtDocumentRoot =
      anchor.parentElement?.id === "output" &&
      anchor.parentElement?.firstChild === anchor;

    // Check if anchor is in a relevant parent
    const parent = anchor.parentElement;
    const parentRelevant = checkParentRelevance(parent, type, label);

    let status = "✅ GOOD";
    let issue = null;

    if (isAtDocumentRoot) {
      status = "❌ AT DOCUMENT ROOT";
      issue = `Anchor is at top of output div instead of near ${type} content`;
    } else if (!parentRelevant.isRelevant) {
      status = "⚠️ POOR PLACEMENT";
      issue = `Parent (${parent?.tagName}) not relevant for ${type}: ${parentRelevant.reason}`;
    }

    console.log(`📍 ${label} (${type}): ${status}`);
    if (issue) {
      console.log(`   Issue: ${issue}`);
      issues.push({ label, type, issue });
    }
  });

  function checkParentRelevance(parent, type, label) {
    if (!parent) return { isRelevant: false, reason: "No parent element" };

    const parentClass = parent.className || "";
    const parentTag = parent.tagName;
    const parentContent = parent.textContent?.toLowerCase() || "";

    switch (type) {
      case "lemma":
        return {
          isRelevant:
            parentClass.includes("lemma") || parentContent.includes("lemma"),
          reason: parentClass.includes("lemma")
            ? "Has lemma class"
            : "No lemma class or content",
        };
      case "corollary":
        return {
          isRelevant:
            parentClass.includes("corollary") ||
            parentContent.includes("corollary"),
          reason: parentClass.includes("corollary")
            ? "Has corollary class"
            : "No corollary class or content",
        };
      case "equation":
        return {
          isRelevant:
            parentTag === "MJX-CONTAINER" || parentClass.includes("math"),
          reason:
            parentTag === "MJX-CONTAINER"
              ? "Inside math container"
              : "Not in math container",
        };
      case "section":
        return {
          isRelevant: /^H[1-6]$/.test(parentTag),
          reason: /^H[1-6]$/.test(parentTag)
            ? "Inside heading"
            : "Not inside heading",
        };
      default:
        return { isRelevant: true, reason: "Generic type" };
    }
  }

  console.log(`\n📊 SUMMARY: ${issues.length} precision issues found`);
  issues.forEach((issue) => {
    console.log(`   - ${issue.label}: ${issue.issue}`);
  });

  return { total: anchors.length, issues };
}
