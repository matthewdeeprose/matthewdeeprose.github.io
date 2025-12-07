// test-cross-references.js
// Cross-Reference Regression Test Suite
// Comprehensive testing for cross-references, footnotes, anchors, and equation links
// Part of Enhanced Pandoc-WASM Mathematical Playground testing framework

const TestCrossReferences = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (USING MODULAR SYSTEM)
  // ===========================================================================================

  const logger = window.LoggingSystem?.createModuleLogger("TEST_CROSS_REF", {
    level: window.LoggingSystem?.LOG_LEVELS?.INFO || 2,
  }) || {
    logError: console.error.bind(console, "[TEST_CROSS_REF]"),
    logWarn: console.warn.bind(console, "[TEST_CROSS_REF]"),
    logInfo: console.log.bind(console, "[TEST_CROSS_REF]"),
    logDebug: console.log.bind(console, "[TEST_CROSS_REF]"),
  };

  const { logError, logWarn, logInfo, logDebug } = logger;

  // ===========================================================================================
  // TEST CONFIGURATION
  // ===========================================================================================

  /**
   * Known broken references that are genuinely missing from LaTeX source
   * These should be excluded from failure counts
   */
  const KNOWN_MISSING_LABELS = [
    "chainrule", // Missing from calculus test file
  ];

  /**
   * Expected thresholds for the large calculus test file
   * Update these when the test file changes
   */
  const CALCULUS_TEST_THRESHOLDS = {
    minEquations: 190,           // Minimum expected MathJax equations
    minCrossRefLinks: 160,       // Minimum expected cross-reference links
    minMathJaxAnchors: 190,      // Minimum expected mjx-eqn: anchors
    maxBrokenLinks: 1,           // Maximum allowed broken links (known missing)
    minWorkingPercentage: 99,    // Minimum % of working links
  };

  // ===========================================================================================
  // CORE TEST UTILITIES
  // ===========================================================================================

  /**
   * Check if a label is known to be missing (not a bug)
   * @param {string} label - The label to check
   * @returns {boolean} - True if known missing
   */
  function isKnownMissingLabel(label) {
    const cleanLabel = label.replace("content-", "").replace("#", "");
    return KNOWN_MISSING_LABELS.some(known => 
      cleanLabel === known || cleanLabel.includes(known)
    );
  }

  /**
   * Get all cross-reference links in the document
   * @returns {Array} - Array of link elements
   */
  function getAllCrossRefLinks() {
    return [...document.querySelectorAll('a[href^="#content-"]')];
  }

  /**
   * Get all MathJax equation anchors
   * @returns {Array} - Array of anchor elements
   */
  function getMathJaxAnchors() {
    return [...document.querySelectorAll('[id^="mjx-eqn:"]')];
  }

  /**
   * Get all footnote references
   * @returns {Array} - Array of footnote link elements
   */
  function getFootnoteLinks() {
    return [...document.querySelectorAll('a[href^="#content-fn"]')];
  }

  /**
   * Get all section references
   * @returns {Array} - Array of section link elements
   */
  function getSectionLinks() {
    return getAllCrossRefLinks().filter(link => 
      link.textContent.includes("Section") || 
      link.getAttribute("href")?.includes("sec:")
    );
  }

  /**
   * Get all theorem-type references (Theorem, Lemma, Corollary, etc.)
   * @returns {Array} - Array of theorem link elements
   */
  function getTheoremLinks() {
    return getAllCrossRefLinks().filter(link => 
      /Theorem|Lemma|Corollary|Proposition|Definition|Example/i.test(link.textContent)
    );
  }

  /**
   * Get all equation number links (displayed as "(N)")
   * @returns {Array} - Array of equation link elements
   */
  function getEquationNumberLinks() {
    return getAllCrossRefLinks().filter(link => 
      /^\(\d+\)$/.test(link.textContent.trim())
    );
  }

  // ===========================================================================================
  // INDIVIDUAL TEST FUNCTIONS
  // ===========================================================================================

  /**
   * Test: CrossReferenceFixer module exists and has required methods
   */
  function testModuleExists() {
    const required = [
      "fixCrossReferences",
      "verifyCrossReferences",
      "fixBrokenEquationLinks",
      "getMathJaxEquationInfo" // May be internal
    ];

    const module = window.CrossReferenceFixer;
    if (!module) {
      return { pass: false, message: "CrossReferenceFixer module not found" };
    }

    const missing = required.filter(method => 
      typeof module[method] !== "function" && 
      method !== "getMathJaxEquationInfo" // Internal function
    );

    if (missing.length > 0) {
      return { pass: false, message: `Missing methods: ${missing.join(", ")}` };
    }

    return { pass: true, message: "Module exists with required methods" };
  }

  /**
   * Test: All cross-reference links have valid targets
   */
  function testAllLinksHaveTargets() {
    const links = getAllCrossRefLinks();
    let working = 0;
    let broken = 0;
    const brokenLabels = [];

    links.forEach(link => {
      const href = link.getAttribute("href");
      const targetId = href ? href.substring(1) : null;
      const target = targetId ? document.getElementById(targetId) : null;

      if (target) {
        working++;
      } else {
        const label = targetId?.replace("content-", "") || "unknown";
        if (!isKnownMissingLabel(label)) {
          broken++;
          brokenLabels.push(label);
        }
      }
    });

    const percentage = links.length > 0 
      ? ((working / links.length) * 100).toFixed(1) 
      : 100;

    if (broken > 0) {
      return { 
        pass: false, 
        message: `${broken} unexpected broken links: ${brokenLabels.slice(0, 5).join(", ")}${brokenLabels.length > 5 ? "..." : ""}`,
        details: { working, broken, total: links.length, percentage }
      };
    }

    return { 
      pass: true, 
      message: `${working}/${links.length} links working (${percentage}%)`,
      details: { working, broken, total: links.length, percentage }
    };
  }

  /**
   * Test: MathJax equation anchors exist
   */
  function testMathJaxAnchorsExist() {
    const anchors = getMathJaxAnchors();
    const equations = document.querySelectorAll('mjx-container[display="true"]');

    if (anchors.length === 0 && equations.length > 0) {
      return { 
        pass: false, 
        message: `No MathJax anchors but ${equations.length} display equations found` 
      };
    }

    return { 
      pass: true, 
      message: `${anchors.length} MathJax anchors, ${equations.length} display equations`,
      details: { anchors: anchors.length, equations: equations.length }
    };
  }

  /**
   * Test: Equation links display numbers not raw labels
   */
  function testEquationLinksShowNumbers() {
    const eqLinks = getAllCrossRefLinks().filter(link => {
      const href = link.getAttribute("href") || "";
      // Equation links typically reference eq: labels or numbered equations
      return href.includes("eq:") || 
             href.includes("eq-") || 
             /^\(\d+\)$/.test(link.textContent.trim());
    });

    if (eqLinks.length === 0) {
      return { pass: true, message: "No equation links to test" };
    }

    const withNumbers = eqLinks.filter(l => /^\(\d+\)$/.test(l.textContent.trim()));
    const withLabels = eqLinks.filter(l => !/^\(\d+\)$/.test(l.textContent.trim()));

    // Most equation links should show numbers
    const numberPercentage = (withNumbers.length / eqLinks.length) * 100;

    if (numberPercentage < 50 && eqLinks.length > 5) {
      return { 
        pass: false, 
        message: `Only ${numberPercentage.toFixed(0)}% of equation links show numbers`,
        details: { withNumbers: withNumbers.length, withLabels: withLabels.length }
      };
    }

    return { 
      pass: true, 
      message: `${withNumbers.length}/${eqLinks.length} equation links show numbers`,
      details: { withNumbers: withNumbers.length, withLabels: withLabels.length }
    };
  }

  /**
   * Test: Footnote references work correctly
   */
  function testFootnoteLinks() {
    const footnoteLinks = getFootnoteLinks();

    if (footnoteLinks.length === 0) {
      return { pass: true, message: "No footnote links in document" };
    }

    let working = 0;
    let broken = 0;

    footnoteLinks.forEach(link => {
      const targetId = link.getAttribute("href")?.substring(1);
      if (targetId && document.getElementById(targetId)) {
        working++;
      } else {
        broken++;
      }
    });

    if (broken > 0) {
      return { 
        pass: false, 
        message: `${broken}/${footnoteLinks.length} footnote links broken`,
        details: { working, broken }
      };
    }

    return { 
      pass: true, 
      message: `${working} footnote links working`,
      details: { working, broken }
    };
  }

  /**
   * Test: Section references work correctly
   */
  function testSectionLinks() {
    const sectionLinks = getSectionLinks();

    if (sectionLinks.length === 0) {
      return { pass: true, message: "No section links in document" };
    }

    let working = 0;
    let broken = 0;
    const brokenSections = [];

    sectionLinks.forEach(link => {
      const targetId = link.getAttribute("href")?.substring(1);
      const label = targetId?.replace("content-", "") || "unknown";

      if (targetId && document.getElementById(targetId)) {
        working++;
      } else if (!isKnownMissingLabel(label)) {
        broken++;
        brokenSections.push(link.textContent.trim());
      }
    });

    if (broken > 0) {
      return { 
        pass: false, 
        message: `${broken} section links broken: ${brokenSections.slice(0, 3).join(", ")}`,
        details: { working, broken }
      };
    }

    return { 
      pass: true, 
      message: `${working} section links working`,
      details: { working, broken }
    };
  }

  /**
   * Test: Theorem-type references work correctly
   */
  function testTheoremLinks() {
    const theoremLinks = getTheoremLinks();

    if (theoremLinks.length === 0) {
      return { pass: true, message: "No theorem links in document" };
    }

    let working = 0;
    let broken = 0;

    theoremLinks.forEach(link => {
      const targetId = link.getAttribute("href")?.substring(1);
      if (targetId && document.getElementById(targetId)) {
        working++;
      } else {
        broken++;
      }
    });

    if (broken > 0) {
      return { 
        pass: false, 
        message: `${broken}/${theoremLinks.length} theorem links broken`,
        details: { working, broken }
      };
    }

    return { 
      pass: true, 
      message: `${working} theorem/example links working`,
      details: { working, broken }
    };
  }

  /**
   * Test: Cross-reference registry is functioning
   */
  function testRegistryFunctions() {
    const fixer = window.CrossReferenceFixer;
    if (!fixer) {
      return { pass: false, message: "CrossReferenceFixer not available" };
    }

    try {
      // Test registry initialization
      if (typeof fixer.initialiseCrossReferenceRegistry === "function") {
        fixer.initialiseCrossReferenceRegistry();
      }

      // Test registry status
      if (typeof fixer.getCrossReferenceRegistryStatus === "function") {
        const status = fixer.getCrossReferenceRegistryStatus();
        if (!status || typeof status !== "object") {
          return { pass: false, message: "Registry status returned invalid data" };
        }
        return { 
          pass: true, 
          message: `Registry: ${status.totalEntries || 0} entries, ${status.completionRate || "0%"} complete`,
          details: status
        };
      }

      return { pass: true, message: "Registry functions available" };
    } catch (error) {
      return { pass: false, message: `Registry error: ${error.message}` };
    }
  }

  /**
   * Test: Post-MathJax cleanup function works
   */
  function testPostMathJaxCleanup() {
    const fixer = window.CrossReferenceFixer;
    if (!fixer?.fixBrokenEquationLinks) {
      return { pass: false, message: "fixBrokenEquationLinks not available" };
    }

    try {
      const results = fixer.fixBrokenEquationLinks();
      
      if (!results || typeof results !== "object") {
        return { pass: false, message: "Cleanup returned invalid results" };
      }

      return { 
        pass: true, 
        message: `Cleanup checked ${results.checked || 0}, fixed ${results.fixed || 0}, still broken ${results.stillBroken || 0}`,
        details: results
      };
    } catch (error) {
      return { pass: false, message: `Cleanup error: ${error.message}` };
    }
  }

  /**
   * Test: Verify cross-references function works
   */
  function testVerifyFunction() {
    const fixer = window.CrossReferenceFixer;
    if (!fixer?.verifyCrossReferences) {
      return { pass: false, message: "verifyCrossReferences not available" };
    }

    try {
      const results = fixer.verifyCrossReferences();
      
      if (!results || typeof results !== "object") {
        return { pass: false, message: "Verification returned invalid results" };
      }

      // Count unexpected broken (excluding known missing)
      const unexpectedBroken = (results.details || [])
        .filter(d => !d.working && !isKnownMissingLabel(d.targetId || ""))
        .length;

      if (unexpectedBroken > 0) {
        return { 
          pass: false, 
          message: `${unexpectedBroken} unexpected broken references found`,
          details: results
        };
      }

      return { 
        pass: true, 
        message: `Verified ${results.total}: ${results.working} working, ${results.broken} broken (${results.broken} known missing)`,
        details: results
      };
    } catch (error) {
      return { pass: false, message: `Verification error: ${error.message}` };
    }
  }

  // ===========================================================================================
  // CALCULUS TEST FILE SPECIFIC TESTS
  // ===========================================================================================

  /**
   * Test: Calculus file has expected number of equations
   */
  function testCalculusEquationCount() {
    const equations = document.querySelectorAll('mjx-container[display="true"]');
    const threshold = CALCULUS_TEST_THRESHOLDS.minEquations;

    if (equations.length < threshold) {
      return { 
        pass: false, 
        message: `Only ${equations.length} equations, expected ≥${threshold}`,
        details: { found: equations.length, expected: threshold }
      };
    }

    return { 
      pass: true, 
      message: `${equations.length} display equations (≥${threshold} expected)`,
      details: { found: equations.length, expected: threshold }
    };
  }

  /**
   * Test: Calculus file has expected number of cross-references
   */
  function testCalculusCrossRefCount() {
    const links = getAllCrossRefLinks();
    const threshold = CALCULUS_TEST_THRESHOLDS.minCrossRefLinks;

    if (links.length < threshold) {
      return { 
        pass: false, 
        message: `Only ${links.length} cross-ref links, expected ≥${threshold}`,
        details: { found: links.length, expected: threshold }
      };
    }

    return { 
      pass: true, 
      message: `${links.length} cross-ref links (≥${threshold} expected)`,
      details: { found: links.length, expected: threshold }
    };
  }

  /**
   * Test: Calculus file working percentage meets threshold
   */
  function testCalculusWorkingPercentage() {
    const links = getAllCrossRefLinks();
    let working = 0;

    links.forEach(link => {
      const targetId = link.getAttribute("href")?.substring(1);
      if (targetId && document.getElementById(targetId)) {
        working++;
      }
    });

    const percentage = links.length > 0 ? (working / links.length) * 100 : 100;
    const threshold = CALCULUS_TEST_THRESHOLDS.minWorkingPercentage;

    if (percentage < threshold) {
      return { 
        pass: false, 
        message: `Only ${percentage.toFixed(1)}% working, expected ≥${threshold}%`,
        details: { working, total: links.length, percentage: percentage.toFixed(1) }
      };
    }

    return { 
      pass: true, 
      message: `${percentage.toFixed(1)}% working (≥${threshold}% expected)`,
      details: { working, total: links.length, percentage: percentage.toFixed(1) }
    };
  }

  // ===========================================================================================
  // TEST RUNNER
  // ===========================================================================================

  /**
   * Run all generic cross-reference tests
   * @returns {Object} - Test results summary
   */
  function runGenericTests() {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║     CROSS-REFERENCE GENERIC REGRESSION TESTS               ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    const tests = {
      "Module Exists": testModuleExists,
      "All Links Have Targets": testAllLinksHaveTargets,
      "MathJax Anchors Exist": testMathJaxAnchorsExist,
      "Equation Links Show Numbers": testEquationLinksShowNumbers,
      "Footnote Links Work": testFootnoteLinks,
      "Section Links Work": testSectionLinks,
      "Theorem Links Work": testTheoremLinks,
      "Registry Functions": testRegistryFunctions,
      "Post-MathJax Cleanup": testPostMathJaxCleanup,
      "Verify Function": testVerifyFunction,
    };

    return runTestSuite("Generic Tests", tests);
  }

  /**
   * Run calculus test file specific tests
   * @returns {Object} - Test results summary
   */
  function runCalculusTests() {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║     CALCULUS TEST FILE SPECIFIC TESTS                      ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    const tests = {
      "Equation Count Threshold": testCalculusEquationCount,
      "Cross-Reference Count Threshold": testCalculusCrossRefCount,
      "Working Percentage Threshold": testCalculusWorkingPercentage,
    };

    return runTestSuite("Calculus File Tests", tests);
  }

  /**
   * Run a test suite and return results
   * @param {string} suiteName - Name of the test suite
   * @param {Object} tests - Object of test name -> test function
   * @returns {Object} - Test results
   */
  function runTestSuite(suiteName, tests) {
    let passed = 0;
    let failed = 0;
    const results = [];

    Object.entries(tests).forEach(([name, testFn]) => {
      try {
        const result = testFn();
        const status = result.pass ? "✅" : "❌";
        
        console.log(`${status} ${name}: ${result.message}`);
        
        if (result.pass) {
          passed++;
        } else {
          failed++;
        }

        results.push({
          name,
          ...result
        });
      } catch (error) {
        console.log(`❌ ${name}: ERROR - ${error.message}`);
        failed++;
        results.push({
          name,
          pass: false,
          message: `Error: ${error.message}`
        });
      }
    });

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`${suiteName}: ${passed} passed, ${failed} failed`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    return {
      suite: suiteName,
      passed,
      failed,
      total: passed + failed,
      success: failed === 0,
      results
    };
  }

  /**
   * Run all tests (generic + calculus-specific)
   * @returns {Object} - Combined test results
   */
  function runAllTests() {
    console.log("\n" + "═".repeat(64));
    console.log("   CROSS-REFERENCE COMPLETE REGRESSION TEST SUITE");
    console.log("═".repeat(64) + "\n");

    const genericResults = runGenericTests();
    const calculusResults = runCalculusTests();

    const totalPassed = genericResults.passed + calculusResults.passed;
    const totalFailed = genericResults.failed + calculusResults.failed;
    const totalTests = totalPassed + totalFailed;

    console.log("\n" + "═".repeat(64));
    console.log(`   FINAL RESULTS: ${totalPassed}/${totalTests} tests passed`);
    console.log("═".repeat(64));

    if (totalFailed === 0) {
      console.log("\n🎉 All cross-reference regression tests PASSED!\n");
    } else {
      console.log(`\n⚠️  ${totalFailed} test(s) FAILED - investigate before deployment\n`);
    }

    return {
      success: totalFailed === 0,
      totalPassed,
      totalFailed,
      totalTests,
      generic: genericResults,
      calculus: calculusResults
    };
  }

  /**
   * Quick health check (silent, returns boolean)
   * @returns {boolean} - True if all critical tests pass
   */
  function quickCheck() {
    const links = getAllCrossRefLinks();
    let working = 0;

    links.forEach(link => {
      const targetId = link.getAttribute("href")?.substring(1);
      if (targetId && document.getElementById(targetId)) {
        working++;
      }
    });

    const percentage = links.length > 0 ? (working / links.length) * 100 : 100;
    return percentage >= 99;
  }

  /**
   * Get a quick status summary (for console)
   * @returns {Object} - Status summary
   */
  function getStatus() {
    const links = getAllCrossRefLinks();
    const anchors = getMathJaxAnchors();
    let working = 0;
    let broken = 0;
    const brokenLabels = [];

    links.forEach(link => {
      const targetId = link.getAttribute("href")?.substring(1);
      if (targetId && document.getElementById(targetId)) {
        working++;
      } else {
        broken++;
        brokenLabels.push(targetId?.replace("content-", "") || "unknown");
      }
    });

    return {
      crossRefLinks: links.length,
      working,
      broken,
      mathJaxAnchors: anchors.length,
      workingPercentage: links.length > 0 
        ? ((working / links.length) * 100).toFixed(1) + "%" 
        : "100%",
      brokenLabels: brokenLabels.slice(0, 5),
      knownMissing: brokenLabels.filter(l => isKnownMissingLabel(l))
    };
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Test runners
    runAllTests,
    runGenericTests,
    runCalculusTests,
    
    // Quick utilities
    quickCheck,
    getStatus,
    
    // Individual tests (for targeted debugging)
    tests: {
      moduleExists: testModuleExists,
      allLinksHaveTargets: testAllLinksHaveTargets,
      mathJaxAnchorsExist: testMathJaxAnchorsExist,
      equationLinksShowNumbers: testEquationLinksShowNumbers,
      footnoteLinks: testFootnoteLinks,
      sectionLinks: testSectionLinks,
      theoremLinks: testTheoremLinks,
      registryFunctions: testRegistryFunctions,
      postMathJaxCleanup: testPostMathJaxCleanup,
      verifyFunction: testVerifyFunction,
      calculusEquationCount: testCalculusEquationCount,
      calculusCrossRefCount: testCalculusCrossRefCount,
      calculusWorkingPercentage: testCalculusWorkingPercentage,
    },
    
    // Utility functions
    utils: {
      getAllCrossRefLinks,
      getMathJaxAnchors,
      getFootnoteLinks,
      getSectionLinks,
      getTheoremLinks,
      getEquationNumberLinks,
      isKnownMissingLabel,
    },
    
    // Configuration
    config: {
      KNOWN_MISSING_LABELS,
      CALCULUS_TEST_THRESHOLDS,
    },

    // Module info
    name: "TestCrossReferences",
    version: "1.0.0",
  };
})();

// Make available globally
if (typeof window !== "undefined") {
  window.TestCrossReferences = TestCrossReferences;
  
  // Convenience aliases
  window.testCrossRefs = TestCrossReferences.runAllTests;
  window.testCrossRefsQuick = TestCrossReferences.quickCheck;
  window.crossRefStatus = TestCrossReferences.getStatus;
}