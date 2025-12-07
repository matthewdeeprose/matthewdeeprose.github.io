/**
 * Comprehensive Test Suite for Enhanced Pandoc-WASM Mathematical Playground
 *
 * Automated testing system for validating cross-references, anchors, links,
 * headers, and display coherency in converted LaTeX documents.
 *
 * Usage:
 *   window.TestSuite.runFullTest()  - Run complete test suite
 *   window.TestSuite.testAnchors()  - Test anchors only
 *   window.TestSuite.testLinks()    - Test links only
 *   window.TestSuite.getLastReport() - Get detailed JSON report
 */

const TestSuite = (function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG; // Enable DEBUG for comprehensive testing
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
  }

  // ============================================================================
  // LATEX ANALYSER - Pre-Conversion Analysis
  // ============================================================================

  const LatexAnalyser = {
    /**
     * Analyse LaTeX content before conversion to extract expected structure
     * @param {string} latexContent - Raw LaTeX content
     * @returns {object} Analysis results with expected anchors, links, and labels
     */
    analyseLatexInput(latexContent) {
      logInfo("=== LATEX ANALYSER: Starting pre-conversion analysis ===");

      const result = {
        expectedAnchors: [],
        expectedLinks: [],
        labelMap: new Map(),
        statistics: {
          totalLabels: 0,
          totalReferences: 0,
          labelsByType: {},
          documentSize: latexContent.length,
        },
      };

      // Extract all \label{} commands
      const labelRegex = /\\label\{([^}]+)\}/g;
      let match;
      while ((match = labelRegex.exec(latexContent)) !== null) {
        const label = match[1];
        result.expectedAnchors.push(label);
        result.labelMap.set(label, {
          originalLabel: label,
          expectedId: `content-${label}`,
          found: false,
        });

        // Categorise by type
        const labelType = this._getLabelType(label);
        result.statistics.labelsByType[labelType] =
          (result.statistics.labelsByType[labelType] || 0) + 1;
      }
      result.statistics.totalLabels = result.expectedAnchors.length;

      logDebug(
        `Found ${result.statistics.totalLabels} labels:`,
        result.statistics.labelsByType
      );

      // Extract all cross-reference commands
      const refRegex = /\\(?:eq)?ref\{([^}]+)\}/g;
      while ((match = refRegex.exec(latexContent)) !== null) {
        const ref = match[1];
        result.expectedLinks.push(ref);
      }

      // Extract \cref{} commands
      const crefRegex = /\\cref\{([^}]+)\}/g;
      while ((match = crefRegex.exec(latexContent)) !== null) {
        const ref = match[1];
        result.expectedLinks.push(ref);
      }

      result.statistics.totalReferences = result.expectedLinks.length;

      logInfo(
        `Analysis complete: ${result.statistics.totalLabels} labels, ${result.statistics.totalReferences} references`
      );

      return result;
    },

    /**
     * Determine label type from label name
     * @param {string} label - Label name (e.g., "eq:einstein")
     * @returns {string} Label type (e.g., "equation")
     */
    _getLabelType(label) {
      const prefixes = {
        "eq:": "equation",
        "thm:": "theorem",
        "def:": "definition",
        "fig:": "figure",
        "tab:": "table",
        "sec:": "section",
        "lem:": "lemma",
        "prop:": "proposition",
        "cor:": "corollary",
        "rem:": "remark",
        "ex:": "example",
      };

      for (const [prefix, type] of Object.entries(prefixes)) {
        if (label.startsWith(prefix)) {
          return type;
        }
      }

      return "other";
    },
  };

  // ============================================================================
  // ANCHOR VALIDATOR - Validate Anchor Elements
  // ============================================================================

  const AnchorValidator = {
    /**
     * Validate all anchors in converted output
     * @param {HTMLElement} outputElement - The output container element
     * @param {object} preConversionData - Data from pre-conversion analysis
     * @returns {object} Validation results
     */
    validate(outputElement, preConversionData) {
      logInfo("=== ANCHOR VALIDATOR: Starting anchor validation ===");

      const result = {
        passed: true,
        totalAnchors: 0,
        duplicates: [],
        missing: [],
        invalidPrefix: [],
        orphaned: [],
        details: [],
      };

      // Get all anchors with content- prefix
      const allAnchors = outputElement.querySelectorAll('[id^="content-"]');
      result.totalAnchors = allAnchors.length;

      logDebug(
        `Found ${result.totalAnchors} total anchors with content- prefix`
      );

      // Check for duplicate IDs
      const idMap = new Map();
      allAnchors.forEach((anchor) => {
        const id = anchor.id;
        if (idMap.has(id)) {
          result.duplicates.push(id);
          result.passed = false;
          logError(`Duplicate anchor found: ${id}`);
        } else {
          idMap.set(id, anchor);
        }
      });

      // Check for doubled prefix (content-content-)
      allAnchors.forEach((anchor) => {
        if (anchor.id.includes("content-content-")) {
          result.invalidPrefix.push(anchor.id);
          result.passed = false;
          logError(`Invalid doubled prefix found: ${anchor.id}`);
        }
      });

      // Check for missing expected anchors
      preConversionData.labelMap.forEach((labelInfo, label) => {
        const expectedId = labelInfo.expectedId;
        if (!idMap.has(expectedId)) {
          result.missing.push(label);
          result.passed = false;
          logError(
            `Missing expected anchor: ${expectedId} (from label: ${label})`
          );
        } else {
          labelInfo.found = true;
          logDebug(`✓ Found expected anchor: ${expectedId}`);
        }
      });

      // Check for orphaned anchors (not in expected list)
      allAnchors.forEach((anchor) => {
        const id = anchor.id;
        const label = id.replace(/^content-/, "");

        // Skip special Pandoc anchors
        if (this._isSpecialAnchor(id)) {
          logDebug(`Skipping special anchor: ${id}`);
          return;
        }

        if (!preConversionData.labelMap.has(label)) {
          result.orphaned.push(id);
          logWarn(`Orphaned anchor found (not in LaTeX labels): ${id}`);
        }
      });

      result.details = {
        duplicateCount: result.duplicates.length,
        missingCount: result.missing.length,
        invalidPrefixCount: result.invalidPrefix.length,
        orphanedCount: result.orphaned.length,
      };

      logInfo(
        `Anchor validation complete: ${
          result.passed ? "✅ PASSED" : "❌ FAILED"
        }`
      );

      return result;
    },

    /**
     * Check if anchor ID is a special Pandoc-generated anchor
     * @param {string} id - Anchor ID
     * @returns {boolean} True if special anchor
     */
    _isSpecialAnchor(id) {
      // Section headers, TOC entries, etc.
      const specialPrefixes = [
        "content-toc-",
        "content-section-",
        "content-subsection-",
      ];

      return specialPrefixes.some((prefix) => id.startsWith(prefix));
    },
  };

  // ============================================================================
  // LINK VALIDATOR - Validate Cross-Reference Links
  // ============================================================================

  const LinkValidator = {
    /**
     * Validate all cross-reference links
     * @param {HTMLElement} outputElement - The output container element
     * @param {object} preConversionData - Data from pre-conversion analysis
     * @returns {object} Validation results
     */
    validate(outputElement, preConversionData) {
      logInfo("=== LINK VALIDATOR: Starting link validation ===");

      const result = {
        passed: true,
        totalLinks: 0,
        brokenLinks: [],
        invalidTargets: [],
        orphanedLinks: [],
        validLinks: [],
        details: [],
      };

      // Find all cross-reference links
      const crossRefLinks = outputElement.querySelectorAll(
        'a[data-reference-type="ref"], a[data-reference-type="eqref"]'
      );

      result.totalLinks = crossRefLinks.length;

      logDebug(`Found ${result.totalLinks} cross-reference links`);

      crossRefLinks.forEach((link) => {
        const href = link.getAttribute("href");
        const refType = link.getAttribute("data-reference-type");
        const refTarget = link.getAttribute("data-reference");

        logDebug(
          `Validating link: href="${href}", type="${refType}", target="${refTarget}"`
        );

        // Check if link has href
        if (!href || href === "#") {
          result.brokenLinks.push({
            element: link,
            reason: "Missing or empty href",
            refTarget: refTarget,
          });
          result.passed = false;
          logError(`Broken link found: ${refTarget} (missing href)`);
          return;
        }

        // Extract target ID from href
        const targetId = href.startsWith("#") ? href.substring(1) : href;

        // Check if target exists in DOM
        const targetElement = outputElement.querySelector(
          `#${CSS.escape(targetId)}`
        );

        if (!targetElement) {
          result.invalidTargets.push({
            link: link,
            targetId: targetId,
            refTarget: refTarget,
          });
          result.passed = false;
          logError(`Invalid target: ${targetId} does not exist in DOM`);
          return;
        }

        // Check if link was expected from LaTeX analysis
        if (refTarget && !preConversionData.expectedLinks.includes(refTarget)) {
          result.orphanedLinks.push({
            link: link,
            targetId: targetId,
            refTarget: refTarget,
          });
          logWarn(
            `Orphaned link found (not in LaTeX references): ${refTarget}`
          );
        }

        // Link is valid
        result.validLinks.push({
          link: link,
          targetId: targetId,
          refTarget: refTarget,
          refType: refType,
        });

        logDebug(`✓ Valid link: ${refTarget} → ${targetId}`);
      });

      result.details = {
        brokenCount: result.brokenLinks.length,
        invalidTargetCount: result.invalidTargets.length,
        orphanedCount: result.orphanedLinks.length,
        validCount: result.validLinks.length,
      };

      logInfo(
        `Link validation complete: ${result.passed ? "✅ PASSED" : "❌ FAILED"}`
      );

      return result;
    },
  };

  // ============================================================================
  // DISPLAY VALIDATOR - Validate Display Coherency
  // ============================================================================

  const DisplayValidator = {
    /**
     * Validate display coherency of converted content
     * @param {HTMLElement} outputElement - The output container element
     * @param {object} preConversionData - Data from pre-conversion analysis
     * @returns {object} Validation results
     */
    validate(outputElement, preConversionData) {
      logInfo("=== DISPLAY VALIDATOR: Starting display validation ===");

      const result = {
        passed: true,
        equationNumbering: { consistent: true, issues: [] },
        theoremNumbering: { consistent: true, issues: [] },
        crossRefFormat: { correct: true, issues: [] },
        details: [],
      };

      // Validate equation numbering
      this._validateEquationNumbering(outputElement, result);

      // Validate theorem/definition numbering
      this._validateTheoremNumbering(outputElement, result);

      // Validate cross-reference display format
      this._validateCrossRefFormat(outputElement, result);

      result.passed =
        result.equationNumbering.consistent &&
        result.theoremNumbering.consistent &&
        result.crossRefFormat.correct;

      logInfo(
        `Display validation complete: ${
          result.passed ? "✅ PASSED" : "❌ FAILED"
        }`
      );

      return result;
    },

    /**
     * Validate equation numbering consistency
     * @param {HTMLElement} outputElement - The output container
     * @param {object} result - Result object to populate
     */
    _validateEquationNumbering(outputElement, result) {
      logDebug("Validating equation numbering...");

      const equations = outputElement.querySelectorAll(
        '.math.display, [id^="content-eq:"]'
      );

      let previousNumber = 0;
      let hasNumbering = false;

      equations.forEach((eq, index) => {
        // Try to find equation number in span.eqn-num or similar
        const eqnNumSpan = eq.querySelector(".eqn-num, .equation-number");

        if (eqnNumSpan) {
          hasNumbering = true;
          const numberText = eqnNumSpan.textContent.trim();
          const numberMatch = numberText.match(/\((\d+)\)/);

          if (numberMatch) {
            const currentNumber = parseInt(numberMatch[1], 10);

            // Check if numbering is sequential
            if (currentNumber !== previousNumber + 1 && previousNumber !== 0) {
              result.equationNumbering.consistent = false;
              result.equationNumbering.issues.push({
                equation: eq,
                expected: previousNumber + 1,
                actual: currentNumber,
              });
              logWarn(
                `Equation numbering inconsistency: expected ${
                  previousNumber + 1
                }, got ${currentNumber}`
              );
            }

            previousNumber = currentNumber;
          }
        }
      });

      if (!hasNumbering && equations.length > 0) {
        logDebug("No explicit equation numbering found (may be normal)");
      }

      logDebug(
        `Equation numbering validation: ${
          result.equationNumbering.consistent ? "✓" : "✗"
        }`
      );
    },

    /**
     * Validate theorem/definition numbering
     * @param {HTMLElement} outputElement - The output container
     * @param {object} result - Result object to populate
     */
    _validateTheoremNumbering(outputElement, result) {
      logDebug("Validating theorem/definition numbering...");

      const theorems = outputElement.querySelectorAll(
        '[id^="content-thm:"], [id^="content-def:"], [id^="content-lem:"]'
      );

      const numberMap = new Map();

      theorems.forEach((thm) => {
        const id = thm.id;
        const type = this._getTheoremType(id);

        // Try to find theorem number
        const numberSpan = thm.querySelector(".theorem-number, .header");

        if (numberSpan) {
          const numberText = numberSpan.textContent.trim();
          const numberMatch = numberText.match(/(\d+(?:\.\d+)?)/);

          if (numberMatch) {
            const number = numberMatch[1];

            if (!numberMap.has(type)) {
              numberMap.set(type, []);
            }

            numberMap.get(type).push({
              element: thm,
              number: number,
              id: id,
            });
          }
        }
      });

      // Check for duplicate numbers within same type
      numberMap.forEach((items, type) => {
        const numbers = items.map((item) => item.number);
        const uniqueNumbers = new Set(numbers);

        if (numbers.length !== uniqueNumbers.size) {
          result.theoremNumbering.consistent = false;
          result.theoremNumbering.issues.push({
            type: type,
            reason: "Duplicate numbers found",
            items: items,
          });
          logWarn(`Duplicate theorem numbers found for type: ${type}`);
        }
      });

      logDebug(
        `Theorem numbering validation: ${
          result.theoremNumbering.consistent ? "✓" : "✗"
        }`
      );
    },

    /**
     * Get theorem type from ID
     * @param {string} id - Element ID
     * @returns {string} Theorem type
     */
    _getTheoremType(id) {
      if (id.includes("thm:")) return "theorem";
      if (id.includes("def:")) return "definition";
      if (id.includes("lem:")) return "lemma";
      if (id.includes("prop:")) return "proposition";
      if (id.includes("cor:")) return "corollary";
      return "other";
    },

    /**
     * Validate cross-reference display format
     * @param {HTMLElement} outputElement - The output container
     * @param {object} result - Result object to populate
     */
    _validateCrossRefFormat(outputElement, result) {
      logDebug("Validating cross-reference display format...");

      const crossRefs = outputElement.querySelectorAll(
        'a[data-reference-type="ref"], a[data-reference-type="eqref"]'
      );

      crossRefs.forEach((link) => {
        const refType = link.getAttribute("data-reference-type");
        const displayText = link.textContent.trim();

        // Check if eqref has parentheses
        if (refType === "eqref" && !displayText.match(/\(\d+\)/)) {
          result.crossRefFormat.correct = false;
          result.crossRefFormat.issues.push({
            link: link,
            reason: "eqref should have parentheses format (e.g., (1))",
            actualText: displayText,
          });
          logWarn(`Invalid eqref format: "${displayText}" (should be "(N)")`);
        }

        // Check if ref has appropriate format (number or section reference)
        if (
          refType === "ref" &&
          !displayText.match(/\d+/) &&
          displayText !== "??"
        ) {
          result.crossRefFormat.correct = false;
          result.crossRefFormat.issues.push({
            link: link,
            reason: "ref should contain number or be '??'",
            actualText: displayText,
          });
          logWarn(`Invalid ref format: "${displayText}"`);
        }
      });

      logDebug(
        `Cross-reference format validation: ${
          result.crossRefFormat.correct ? "✓" : "✗"
        }`
      );
    },
  };

  // ============================================================================
  // HEADER VALIDATOR - Validate Headers and TOC
  // ============================================================================

  const HeaderValidator = {
    /**
     * Validate headers and table of contents
     * @param {HTMLElement} outputElement - The output container element
     * @returns {object} Validation results
     */
    validate(outputElement) {
      logInfo("=== HEADER VALIDATOR: Starting header validation ===");

      const result = {
        passed: true,
        totalHeaders: 0,
        duplicateIds: [],
        hierarchyIssues: [],
        tocLinkValidity: { valid: 0, invalid: 0, links: [] },
        details: [],
      };

      // Get all headers
      const headers = outputElement.querySelectorAll("h1, h2, h3, h4, h5, h6");
      result.totalHeaders = headers.length;

      logDebug(`Found ${result.totalHeaders} headers`);

      // Check for duplicate IDs
      const idMap = new Map();
      headers.forEach((header) => {
        if (header.id) {
          if (idMap.has(header.id)) {
            result.duplicateIds.push(header.id);
            result.passed = false;
            logError(`Duplicate header ID: ${header.id}`);
          } else {
            idMap.set(header.id, header);
          }
        }
      });

      // Validate header hierarchy
      this._validateHeaderHierarchy(headers, result);

      // Validate TOC links if TOC exists
      this._validateTocLinks(outputElement, idMap, result);

      result.details = {
        duplicateIdCount: result.duplicateIds.length,
        hierarchyIssueCount: result.hierarchyIssues.length,
        tocValidLinks: result.tocLinkValidity.valid,
        tocInvalidLinks: result.tocLinkValidity.invalid,
      };

      logInfo(
        `Header validation complete: ${
          result.passed ? "✅ PASSED" : "❌ FAILED"
        }`
      );

      return result;
    },

    /**
     * Validate header hierarchy (h1 → h2 → h3, no skipping)
     * @param {NodeList} headers - All header elements
     * @param {object} result - Result object to populate
     */
    _validateHeaderHierarchy(headers, result) {
      logDebug("Validating header hierarchy...");

      let previousLevel = 0;

      headers.forEach((header, index) => {
        const currentLevel = parseInt(header.tagName.substring(1), 10);

        // Check if we're skipping levels (e.g., h1 → h3)
        if (currentLevel > previousLevel + 1 && previousLevel !== 0) {
          result.hierarchyIssues.push({
            header: header,
            currentLevel: currentLevel,
            previousLevel: previousLevel,
            text: header.textContent.trim(),
          });
          logWarn(
            `Header hierarchy skip: h${previousLevel} → h${currentLevel} at "${header.textContent.trim()}"`
          );
        }

        previousLevel = currentLevel;
      });

      logDebug(
        `Header hierarchy validation: ${
          result.hierarchyIssues.length === 0 ? "✓" : "✗"
        }`
      );
    },

    /**
     * Validate table of contents links
     * @param {HTMLElement} outputElement - The output container
     * @param {Map} idMap - Map of header IDs to elements
     * @param {object} result - Result object to populate
     */
    _validateTocLinks(outputElement, idMap, result) {
      logDebug("Validating TOC links...");

      // Find TOC (common IDs: "toc", "TOC", "table-of-contents")
      const toc =
        outputElement.querySelector("#TOC") ||
        outputElement.querySelector("#toc") ||
        outputElement.querySelector("#table-of-contents");

      if (!toc) {
        logDebug("No TOC found (may be normal)");
        return;
      }

      const tocLinks = toc.querySelectorAll("a[href^='#']");

      tocLinks.forEach((link) => {
        const href = link.getAttribute("href");
        const targetId = href.substring(1);

        if (
          idMap.has(targetId) ||
          outputElement.querySelector(`#${CSS.escape(targetId)}`)
        ) {
          result.tocLinkValidity.valid++;
          result.tocLinkValidity.links.push({
            link: link,
            targetId: targetId,
            valid: true,
          });
          logDebug(`✓ Valid TOC link: ${targetId}`);
        } else {
          result.tocLinkValidity.invalid++;
          result.tocLinkValidity.links.push({
            link: link,
            targetId: targetId,
            valid: false,
          });
          result.passed = false;
          logError(`Invalid TOC link: ${targetId} does not exist`);
        }
      });

      logDebug(
        `TOC validation: ${result.tocLinkValidity.valid} valid, ${result.tocLinkValidity.invalid} invalid`
      );
    },
  };

  // ============================================================================
  // RESULTS REPORTER - Generate Structured Reports
  // ============================================================================

  const ResultsReporter = {
    /**
     * Generate comprehensive test report
     * @param {object} allResults - Combined results from all validators
     * @returns {object} Formatted report
     */
    generateReport(allResults) {
      logInfo("=== RESULTS REPORTER: Generating comprehensive report ===");

      const report = {
        timestamp: new Date().toISOString(),
        overallStatus: this._determineOverallStatus(allResults),
        summary: this._generateSummary(allResults),
        detailedResults: allResults,
        performance: allResults.performance || {},
      };

      // Generate console-friendly output
      this._printConsoleReport(report);

      return report;
    },

    /**
     * Determine overall test status
     * @param {object} allResults - All test results
     * @returns {string} Overall status (PASSED/FAILED)
     */
    _determineOverallStatus(allResults) {
      const allPassed =
        allResults.anchors.passed &&
        allResults.links.passed &&
        allResults.display.passed &&
        allResults.headers.passed;

      return allPassed ? "PASSED" : "FAILED";
    },

    /**
     * Generate summary statistics
     * @param {object} allResults - All test results
     * @returns {object} Summary object
     */
    _generateSummary(allResults) {
      return {
        documentSize: allResults.preConversion.statistics.documentSize,
        totalLabels: allResults.preConversion.statistics.totalLabels,
        totalReferences: allResults.preConversion.statistics.totalReferences,
        anchors: {
          total: allResults.anchors.totalAnchors,
          duplicates: allResults.anchors.duplicates.length,
          missing: allResults.anchors.missing.length,
          invalidPrefix: allResults.anchors.invalidPrefix.length,
        },
        links: {
          total: allResults.links.totalLinks,
          broken: allResults.links.brokenLinks.length,
          invalid: allResults.links.invalidTargets.length,
          valid: allResults.links.validLinks.length,
        },
        headers: {
          total: allResults.headers.totalHeaders,
          duplicateIds: allResults.headers.duplicateIds.length,
          hierarchyIssues: allResults.headers.hierarchyIssues.length,
        },
      };
    },

    /**
     * Print formatted report to console
     * @param {object} report - Complete report object
     */
    _printConsoleReport(report) {
      const status = report.overallStatus === "PASSED" ? "✅" : "❌";
      const summary = report.summary;

      console.log("\n" + "=".repeat(60));
      console.log("  COMPREHENSIVE TEST SUITE RESULTS");
      console.log("=".repeat(60));
      console.log(
        `Document Size: ${this._formatBytes(
          summary.documentSize
        )} (${summary.documentSize.toLocaleString()} characters)`
      );
      console.log(`Labels Found: ${summary.totalLabels}`);
      console.log(`Cross-references Found: ${summary.totalReferences}`);
      console.log("");

      // Anchor validation
      const anchorStatus = report.detailedResults.anchors.passed
        ? "✅ PASS"
        : "❌ FAIL";
      console.log(`ANCHOR VALIDATION: ${anchorStatus}`);
      console.log(`  Total anchors: ${summary.anchors.total}`);
      console.log(`  Duplicates: ${summary.anchors.duplicates}`);
      console.log(`  Missing: ${summary.anchors.missing}`);
      console.log(`  Invalid prefix: ${summary.anchors.invalidPrefix}`);
      console.log("");

      // Link validation
      const linkStatus = report.detailedResults.links.passed
        ? "✅ PASS"
        : "❌ FAIL";
      console.log(`LINK VALIDATION: ${linkStatus}`);
      console.log(`  Total links: ${summary.links.total}`);
      console.log(`  Broken links: ${summary.links.broken}`);
      console.log(`  Invalid targets: ${summary.links.invalid}`);
      console.log(`  Valid links: ${summary.links.valid}`);
      console.log("");

      // Display validation
      const displayStatus = report.detailedResults.display.passed
        ? "✅ PASS"
        : "❌ FAIL";
      console.log(`DISPLAY VALIDATION: ${displayStatus}`);
      console.log(
        `  Equation numbering: ${
          report.detailedResults.display.equationNumbering.consistent
            ? "✅"
            : "❌"
        } ${
          report.detailedResults.display.equationNumbering.consistent
            ? "Consistent"
            : "Issues found"
        }`
      );
      console.log(
        `  Theorem numbering: ${
          report.detailedResults.display.theoremNumbering.consistent
            ? "✅"
            : "❌"
        } ${
          report.detailedResults.display.theoremNumbering.consistent
            ? "Consistent"
            : "Issues found"
        }`
      );
      console.log(
        `  Cross-ref format: ${
          report.detailedResults.display.crossRefFormat.correct ? "✅" : "❌"
        } ${
          report.detailedResults.display.crossRefFormat.correct
            ? "Correct"
            : "Issues found"
        }`
      );
      console.log("");

      // Header validation
      const headerStatus = report.detailedResults.headers.passed
        ? "✅ PASS"
        : "❌ FAIL";
      console.log(`HEADER VALIDATION: ${headerStatus}`);
      console.log(`  Total headers: ${summary.headers.total}`);
      console.log(`  Duplicate IDs: ${summary.headers.duplicateIds}`);
      console.log(`  Hierarchy issues: ${summary.headers.hierarchyIssues}`);
      if (report.detailedResults.headers.tocLinkValidity.valid > 0) {
        console.log(
          `  TOC links valid: ${
            report.detailedResults.headers.tocLinkValidity.valid
          }/${
            report.detailedResults.headers.tocLinkValidity.valid +
            report.detailedResults.headers.tocLinkValidity.invalid
          }`
        );
      }
      console.log("");

      // Performance metrics
      if (report.performance.conversionTime) {
        console.log("PERFORMANCE METRICS:");
        console.log(
          `  Conversion time: ${report.performance.conversionTime.toFixed(2)}s`
        );
        console.log(
          `  Test execution: ${report.performance.testExecutionTime.toFixed(
            2
          )}s`
        );
        console.log(
          `  Total time: ${report.performance.totalTime.toFixed(2)}s`
        );
        console.log("");
      }

      console.log(`OVERALL STATUS: ${status} ${report.overallStatus}`);
      console.log("=".repeat(60) + "\n");

      // Print detailed issues if any
      this._printDetailedIssues(report.detailedResults);
    },

    /**
     * Print detailed issues for failed tests
     * @param {object} detailedResults - Detailed test results
     */
    _printDetailedIssues(detailedResults) {
      let hasIssues = false;

      // Anchor issues
      if (detailedResults.anchors.duplicates.length > 0) {
        hasIssues = true;
        console.log("⚠️ DUPLICATE ANCHOR IDs:");
        detailedResults.anchors.duplicates.slice(0, 10).forEach((id) => {
          console.log(`  - ${id}`);
        });
        if (detailedResults.anchors.duplicates.length > 10) {
          console.log(
            `  ... and ${detailedResults.anchors.duplicates.length - 10} more`
          );
        }
        console.log("");
      }

      if (detailedResults.anchors.missing.length > 0) {
        hasIssues = true;
        console.log("⚠️ MISSING ANCHORS:");
        detailedResults.anchors.missing.slice(0, 10).forEach((label) => {
          console.log(`  - ${label}`);
        });
        if (detailedResults.anchors.missing.length > 10) {
          console.log(
            `  ... and ${detailedResults.anchors.missing.length - 10} more`
          );
        }
        console.log("");
      }

      if (detailedResults.anchors.invalidPrefix.length > 0) {
        hasIssues = true;
        console.log("⚠️ INVALID PREFIX (doubled content-content-):");
        detailedResults.anchors.invalidPrefix.slice(0, 10).forEach((id) => {
          console.log(`  - ${id}`);
        });
        if (detailedResults.anchors.invalidPrefix.length > 10) {
          console.log(
            `  ... and ${
              detailedResults.anchors.invalidPrefix.length - 10
            } more`
          );
        }
        console.log("");
      }

      // Link issues
      if (detailedResults.links.brokenLinks.length > 0) {
        hasIssues = true;
        console.log("⚠️ BROKEN LINKS:");
        detailedResults.links.brokenLinks.slice(0, 10).forEach((item) => {
          console.log(`  - ${item.refTarget}: ${item.reason}`);
        });
        if (detailedResults.links.brokenLinks.length > 10) {
          console.log(
            `  ... and ${detailedResults.links.brokenLinks.length - 10} more`
          );
        }
        console.log("");
      }

      if (detailedResults.links.invalidTargets.length > 0) {
        hasIssues = true;
        console.log("⚠️ INVALID LINK TARGETS:");
        detailedResults.links.invalidTargets.slice(0, 10).forEach((item) => {
          console.log(`  - ${item.refTarget} → ${item.targetId} (not found)`);
        });
        if (detailedResults.links.invalidTargets.length > 10) {
          console.log(
            `  ... and ${detailedResults.links.invalidTargets.length - 10} more`
          );
        }
        console.log("");
      }

      if (!hasIssues) {
        logDebug("No detailed issues to display");
      }
    },

    /**
     * Format bytes to human-readable string
     * @param {number} bytes - Number of bytes
     * @returns {string} Formatted string (e.g., "200 KB")
     */
    _formatBytes(bytes) {
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    },
  };

  // ============================================================================
  // TEST ORCHESTRATOR - Main Test Coordinator
  // ============================================================================

  const TestOrchestrator = {
    lastReport: null,

    /**
     * Run full test suite on current document
     * @returns {object} Complete test report
     */
    runFullTest() {
      logInfo("=== TEST ORCHESTRATOR: Starting full test suite ===");

      const startTime = performance.now();

      // Get LaTeX input
      const latexInput = this._getLatexInput();
      if (!latexInput) {
        logError("Cannot run tests: No LaTeX input found");
        return null;
      }

      // Get output element
      const outputElement = this._getOutputElement();
      if (!outputElement) {
        logError("Cannot run tests: No output element found");
        return null;
      }

      // Phase 1: Pre-conversion analysis
      const preConversionData = LatexAnalyser.analyseLatexInput(latexInput);

      // Phase 2: Post-conversion validation
      const anchorResults = AnchorValidator.validate(
        outputElement,
        preConversionData
      );
      const linkResults = LinkValidator.validate(
        outputElement,
        preConversionData
      );
      const displayResults = DisplayValidator.validate(
        outputElement,
        preConversionData
      );
      const headerResults = HeaderValidator.validate(outputElement);

      const testEndTime = performance.now();

      // Combine results
      const allResults = {
        preConversion: preConversionData,
        anchors: anchorResults,
        links: linkResults,
        display: displayResults,
        headers: headerResults,
        performance: {
          testExecutionTime: (testEndTime - startTime) / 1000,
          totalTime: (testEndTime - startTime) / 1000,
        },
      };

      // Phase 3: Generate report
      const report = ResultsReporter.generateReport(allResults);

      this.lastReport = report;

      logInfo("=== TEST ORCHESTRATOR: Full test suite complete ===");

      return report;
    },

    /**
     * Run only anchor validation tests
     * @returns {object} Anchor test results
     */
    testAnchors() {
      logInfo("=== TEST ORCHESTRATOR: Running anchor tests only ===");

      const latexInput = this._getLatexInput();
      const outputElement = this._getOutputElement();

      if (!latexInput || !outputElement) {
        logError("Cannot run tests: Missing input or output");
        return null;
      }

      const preConversionData = LatexAnalyser.analyseLatexInput(latexInput);
      const results = AnchorValidator.validate(
        outputElement,
        preConversionData
      );

      console.log("\n=== ANCHOR TEST RESULTS ===");
      console.log(`Status: ${results.passed ? "✅ PASSED" : "❌ FAILED"}`);
      console.log(`Total anchors: ${results.totalAnchors}`);
      console.log(`Duplicates: ${results.duplicates.length}`);
      console.log(`Missing: ${results.missing.length}`);
      console.log(`Invalid prefix: ${results.invalidPrefix.length}`);
      console.log("===========================\n");

      return results;
    },

    /**
     * Run only link validation tests
     * @returns {object} Link test results
     */
    testLinks() {
      logInfo("=== TEST ORCHESTRATOR: Running link tests only ===");

      const latexInput = this._getLatexInput();
      const outputElement = this._getOutputElement();

      if (!latexInput || !outputElement) {
        logError("Cannot run tests: Missing input or output");
        return null;
      }

      const preConversionData = LatexAnalyser.analyseLatexInput(latexInput);
      const results = LinkValidator.validate(outputElement, preConversionData);

      console.log("\n=== LINK TEST RESULTS ===");
      console.log(`Status: ${results.passed ? "✅ PASSED" : "❌ FAILED"}`);
      console.log(`Total links: ${results.totalLinks}`);
      console.log(`Broken: ${results.brokenLinks.length}`);
      console.log(`Invalid targets: ${results.invalidTargets.length}`);
      console.log(`Valid: ${results.validLinks.length}`);
      console.log("=========================\n");

      return results;
    },

    /**
     * Run only display validation tests
     * @returns {object} Display test results
     */
    testDisplay() {
      logInfo("=== TEST ORCHESTRATOR: Running display tests only ===");

      const latexInput = this._getLatexInput();
      const outputElement = this._getOutputElement();

      if (!latexInput || !outputElement) {
        logError("Cannot run tests: Missing input or output");
        return null;
      }

      const preConversionData = LatexAnalyser.analyseLatexInput(latexInput);
      const results = DisplayValidator.validate(
        outputElement,
        preConversionData
      );

      console.log("\n=== DISPLAY TEST RESULTS ===");
      console.log(`Status: ${results.passed ? "✅ PASSED" : "❌ FAILED"}`);
      console.log(
        `Equation numbering: ${
          results.equationNumbering.consistent ? "✅" : "❌"
        }`
      );
      console.log(
        `Theorem numbering: ${
          results.theoremNumbering.consistent ? "✅" : "❌"
        }`
      );
      console.log(
        `Cross-ref format: ${results.crossRefFormat.correct ? "✅" : "❌"}`
      );
      console.log("============================\n");

      return results;
    },

    /**
     * Run only header validation tests
     * @returns {object} Header test results
     */
    testHeaders() {
      logInfo("=== TEST ORCHESTRATOR: Running header tests only ===");

      const outputElement = this._getOutputElement();

      if (!outputElement) {
        logError("Cannot run tests: No output element found");
        return null;
      }

      const results = HeaderValidator.validate(outputElement);

      console.log("\n=== HEADER TEST RESULTS ===");
      console.log(`Status: ${results.passed ? "✅ PASSED" : "❌ FAILED"}`);
      console.log(`Total headers: ${results.totalHeaders}`);
      console.log(`Duplicate IDs: ${results.duplicateIds.length}`);
      console.log(`Hierarchy issues: ${results.hierarchyIssues.length}`);
      console.log("===========================\n");

      return results;
    },

    /**
     * Get the last test report
     * @returns {object|null} Last report or null
     */
    getLastReport() {
      if (!this.lastReport) {
        console.log(
          "No test report available. Run tests first with runFullTest()"
        );
        return null;
      }

      return this.lastReport;
    },

    /**
     * Export report as JSON string
     * @returns {string|null} JSON string or null
     */
    exportReport() {
      if (!this.lastReport) {
        console.log(
          "No test report available. Run tests first with runFullTest()"
        );
        return null;
      }

      const json = JSON.stringify(this.lastReport, null, 2);
      console.log("=== EXPORTED REPORT (JSON) ===");
      console.log(json);
      console.log("==============================");

      return json;
    },

    /**
     * Get LaTeX input from hidden input field
     * @returns {string|null} LaTeX content or null
     */
    _getLatexInput() {
      const input = document.getElementById("input-hidden");
      if (!input) {
        logError("LaTeX input field (#input-hidden) not found");
        return null;
      }

      return input.value;
    },

    /**
     * Get output element
     * @returns {HTMLElement|null} Output element or null
     */
    _getOutputElement() {
      const output = document.getElementById("output");
      if (!output) {
        logError("Output element not found");
        return null;
      }

      return output;
    },
  };

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  logInfo("Comprehensive Test Suite initialised successfully");

  return {
    // Main test functions
    runFullTest: () => TestOrchestrator.runFullTest(),
    testAnchors: () => TestOrchestrator.testAnchors(),
    testLinks: () => TestOrchestrator.testLinks(),
    testDisplay: () => TestOrchestrator.testDisplay(),
    testHeaders: () => TestOrchestrator.testHeaders(),

    // Report functions
    getLastReport: () => TestOrchestrator.getLastReport(),
    exportReport: () => TestOrchestrator.exportReport(),

    // Individual validators (for advanced usage)
    validators: {
      LatexAnalyser: LatexAnalyser,
      AnchorValidator: AnchorValidator,
      LinkValidator: LinkValidator,
      DisplayValidator: DisplayValidator,
      HeaderValidator: HeaderValidator,
    },
  };
})();

// Expose to window
if (typeof window !== "undefined") {
  window.TestSuite = TestSuite;
  console.log("✅ Comprehensive Test Suite loaded successfully");
  console.log("Usage: window.TestSuite.runFullTest()");
}
