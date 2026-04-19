/**
 * @fileoverview Phase 6 Chemistry Testing Suite
 * @module MathPixPhase6Testing
 * @version 6.0.0
 * @since 6.0.0
 *
 * @description
 * Comprehensive testing suite for Phase 6 chemistry pipeline.
 * Validates the PDF chemistry completeness features: PubChem SMILES lookup,
 * InChI back-population, caption context extraction, integration flow,
 * and WCAG 2.2 AA accessibility DOM checks.
 *
 * Test Categories:
 * 1. 6A — PubChem SMILES lookup (lookupPubChemBySmiles)
 * 2. 6B — Back-population (InChI/InChI Key from SMILES lookup)
 * 3. 6C — Caption context extraction (extractCaptionContext)
 * 4. 6D — Integration (extractChemistryFromResponse with MMD)
 * 5. 6E — Accessibility DOM checks
 *
 * @example
 * // Run complete Phase 6 test suite
 * await window.testChemistryPhase6()
 *
 * // Quick DOM-only validation (no network)
 * window.validatePhase6Quick()
 */

(function () {
  // Logging configuration
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;

  function shouldLog(level) {
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
  }

  // =========================================================================
  // Helper utilities
  // =========================================================================

  /**
   * Simple assertion helper — returns pass/fail status with a message.
   * @param {boolean} condition - Assertion condition
   * @param {string} label - Test label
   * @returns {{ label: string, passed: boolean }}
   */
  function assert(condition, label) {
    return { label, passed: !!condition };
  }

  /**
   * Collect assertion results into a console.table-friendly object.
   * @param {Array<{label: string, passed: boolean}>} assertions
   * @returns {Object} Object keyed by label with pass/fail emoji values
   */
  function summarise(assertions) {
    const results = {};
    assertions.forEach((a) => {
      results[a.label] = a.passed ? "\u2705" : "\u274C";
    });
    return results;
  }

  // =========================================================================
  // 1. 6A — PubChem SMILES lookup
  // =========================================================================

  /**
   * Test lookupPubChemBySmiles() with known compounds and edge cases.
   * @returns {Promise<Object>} Test results
   */
  async function testPubChemSmilesLookup() {
    console.log("\n\ud83e\uddea 1. 6A — PubChem SMILES Lookup Tests\n");

    const utils = window.MathPixChemistryUtils;
    const assertions = [];

    // Pre-check
    assertions.push(assert(!!utils, "MathPixChemistryUtils available"));
    assertions.push(
      assert(
        typeof utils?.lookupPubChemBySmiles === "function",
        "lookupPubChemBySmiles is a function",
      ),
    );

    if (!utils || typeof utils.lookupPubChemBySmiles !== "function") {
      const r = summarise(assertions);
      console.table(r);
      return r;
    }

    // Clear cache for fresh lookups
    utils.clearPubChemCache();

    // Test 1: Aspirin SMILES
    try {
      const aspirin = await utils.lookupPubChemBySmiles("CC(=O)Oc1ccccc1C(=O)O");
      assertions.push(
        assert(
          aspirin.found === true && aspirin.pubchemCid === 2244,
          "1. Aspirin: found, CID 2244",
        ),
      );
      assertions.push(
        assert(!!aspirin.iupacName, "1. Aspirin: has IUPAC name (" + (aspirin.iupacName || "?") + ")"),
      );
      assertions.push(
        assert(!!aspirin.inchi && !!aspirin.inchiKey, "1. Aspirin: InChI + InChI Key populated"),
      );
    } catch (error) {
      assertions.push(assert(false, "1. Aspirin threw: " + error.message));
    }

    // Test 2: Caffeine SMILES
    try {
      const caffeine = await utils.lookupPubChemBySmiles("Cn1cnc2c1c(=O)n(c(=O)n2C)C");
      assertions.push(
        assert(
          caffeine.found === true && caffeine.pubchemCid === 2519,
          "2. Caffeine: found, CID 2519",
        ),
      );
    } catch (error) {
      assertions.push(assert(false, "2. Caffeine threw: " + error.message));
    }

    // Test 3: Null/empty — graceful failure
    try {
      const nullResult = await utils.lookupPubChemBySmiles(null);
      assertions.push(
        assert(nullResult.found === false, "3. Null SMILES: found = false"),
      );
      assertions.push(
        assert(
          "inchi" in nullResult && "inchiKey" in nullResult,
          "3. Null SMILES: result has inchi and inchiKey fields",
        ),
      );

      const emptyResult = await utils.lookupPubChemBySmiles("");
      assertions.push(
        assert(emptyResult.found === false, "3. Empty SMILES: found = false"),
      );
    } catch (error) {
      assertions.push(assert(false, "3. Null/empty threw: " + error.message));
    }

    // Test 4: Cache hit — second call for aspirin should be < 5ms
    try {
      const t0 = performance.now();
      const cached = await utils.lookupPubChemBySmiles("CC(=O)Oc1ccccc1C(=O)O");
      const cacheTime = performance.now() - t0;
      assertions.push(
        assert(
          cached.found === true && cacheTime < 5,
          "4. Cache hit: < 5ms (" + cacheTime.toFixed(2) + "ms)",
        ),
      );
    } catch (error) {
      assertions.push(assert(false, "4. Cache hit threw: " + error.message));
    }

    // Test 5: Result shape — verify inchi and inchiKey fields exist
    try {
      const aspirin = await utils.lookupPubChemBySmiles("CC(=O)Oc1ccccc1C(=O)O");
      assertions.push(
        assert(
          "inchi" in aspirin && "inchiKey" in aspirin,
          "5. Result shape: inchi and inchiKey fields exist",
        ),
      );
    } catch (error) {
      assertions.push(assert(false, "5. Result shape threw: " + error.message));
    }

    const results = summarise(assertions);
    console.table(results);
    return results;
  }

  // =========================================================================
  // 2. 6B — Back-population
  // =========================================================================

  /**
   * Test that SMILES lookup returns InChI/InChI Key for back-population.
   * @returns {Promise<Object>} Test results
   */
  async function testBackPopulation() {
    console.log("\n\ud83e\uddea 2. 6B — Back-population Tests\n");

    const utils = window.MathPixChemistryUtils;
    const assertions = [];

    if (!utils || typeof utils.lookupPubChemBySmiles !== "function") {
      assertions.push(assert(false, "lookupPubChemBySmiles not available"));
      const r = summarise(assertions);
      console.table(r);
      return r;
    }

    try {
      // Use cached aspirin result (from test 1)
      const result = await utils.lookupPubChemBySmiles("CC(=O)Oc1ccccc1C(=O)O");

      // Test 6: InChI and InChI Key are strings (not null)
      assertions.push(
        assert(
          typeof result.inchi === "string" && typeof result.inchiKey === "string",
          "6. InChI and InChI Key are strings (not null)",
        ),
      );

      // Test 7: InChI starts with "InChI=1S/"
      assertions.push(
        assert(
          result.inchi && result.inchi.startsWith("InChI=1S/"),
          "7. InChI starts with 'InChI=1S/' (" + (result.inchi || "").substring(0, 20) + "...)",
        ),
      );

      // Test 8: InChI Key matches pattern
      const inchiKeyPattern = /^[A-Z]{14}-[A-Z]{10}-[A-Z]$/;
      assertions.push(
        assert(
          inchiKeyPattern.test(result.inchiKey),
          "8. InChI Key matches pattern (" + (result.inchiKey || "") + ")",
        ),
      );
    } catch (error) {
      assertions.push(assert(false, "Back-population threw: " + error.message));
    }

    const results = summarise(assertions);
    console.table(results);
    return results;
  }

  // =========================================================================
  // 3. 6C — Caption context extraction
  // =========================================================================

  /**
   * Test extractCaptionContext() with various MMD patterns.
   * @returns {Object} Test results
   */
  function testCaptionContext() {
    console.log("\n\ud83e\uddea 3. 6C — Caption Context Extraction Tests\n");

    const utils = window.MathPixChemistryUtils;
    const assertions = [];

    if (!utils || typeof utils.extractCaptionContext !== "function") {
      assertions.push(assert(false, "extractCaptionContext not available"));
      const r = summarise(assertions);
      console.table(r);
      return r;
    }

    // Test 9: Figure with caption, Fig. prefix stripped
    const mmd9 = "\\begin{figure}\\includegraphics[alt={<smiles>CC</smiles>}]{url}\\caption{Fig. 1: Ethane}\\end{figure}";
    const smilesPos9 = mmd9.indexOf("<smiles>");
    const result9 = utils.extractCaptionContext(mmd9, smilesPos9);
    assertions.push(
      assert(
        result9 !== null && result9.trim() === "Ethane",
        "9. Caption with Fig. prefix: '" + (result9 || "null") + "' (expect 'Ethane')",
      ),
    );

    // Test 10: Caption with \textbf LaTeX stripped
    const mmd10 = "\\begin{figure}\\includegraphics[alt={<smiles>CC(=O)Oc1ccccc1C(=O)O</smiles>}]{url}\\caption{\\textbf{Aspirin}}\\end{figure}";
    const smilesPos10 = mmd10.indexOf("<smiles>");
    const result10 = utils.extractCaptionContext(mmd10, smilesPos10);
    assertions.push(
      assert(
        result10 !== null && result10.trim() === "Aspirin",
        "10. Caption with \\textbf: '" + (result10 || "null") + "' (expect 'Aspirin')",
      ),
    );

    // Test 11: No figure block — expect null
    const mmd11 = "Some text with <smiles>CC</smiles> but no figure block";
    const smilesPos11 = mmd11.indexOf("<smiles>");
    const result11 = utils.extractCaptionContext(mmd11, smilesPos11);
    assertions.push(
      assert(result11 === null, "11. No figure block: null (got " + JSON.stringify(result11) + ")"),
    );

    // Test 12: Figure but no caption — expect null
    const mmd12 = "\\begin{figure}\\includegraphics[alt={<smiles>CC</smiles>}]{url}\\end{figure}";
    const smilesPos12 = mmd12.indexOf("<smiles>");
    const result12 = utils.extractCaptionContext(mmd12, smilesPos12);
    assertions.push(
      assert(result12 === null, "12. Figure without caption: null (got " + JSON.stringify(result12) + ")"),
    );

    const results = summarise(assertions);
    console.table(results);
    return results;
  }

  // =========================================================================
  // 4. 6D — Integration (extractChemistryFromResponse with MMD)
  // =========================================================================

  /**
   * Test extractChemistryFromResponse() with PDF-style MMD containing figures.
   * @returns {Object} Test results
   */
  function testIntegration() {
    console.log("\n\ud83e\uddea 4. 6D — Integration Tests\n");

    const utils = window.MathPixChemistryUtils;
    const assertions = [];

    if (!utils || typeof utils.extractChemistryFromResponse !== "function") {
      assertions.push(assert(false, "extractChemistryFromResponse not available"));
      const r = summarise(assertions);
      console.table(r);
      return r;
    }

    // MMD text simulating PDF output with a figure containing SMILES and caption
    const mmdText =
      "Some text before.\n" +
      "\\begin{figure}\n" +
      "\\includegraphics[alt={<smiles>CC(=O)Oc1ccccc1C(=O)O</smiles>}]{https://cdn.example.com/image.png}\n" +
      "\\caption{Aspirin}\n" +
      "\\end{figure}\n" +
      "Some text after.";

    const response = { text: mmdText };
    const extracted = utils.extractChemistryFromResponse(response);

    // Test 13: context field is "Aspirin"
    const firstItem = extracted[0] || {};
    assertions.push(
      assert(
        firstItem.context !== null &&
          firstItem.context !== undefined &&
          firstItem.context.trim() === "Aspirin",
        "13. Context field: '" + (firstItem.context || "null") + "' (expect 'Aspirin')",
      ),
    );

    // Test 14: notation field contains the SMILES string
    assertions.push(
      assert(
        firstItem.notation === "CC(=O)Oc1ccccc1C(=O)O",
        "14. Notation field: '" + (firstItem.notation || "null") + "'",
      ),
    );

    // Test 15: inchi is null (PDF mode has no InChI in the tag)
    assertions.push(
      assert(
        firstItem.inchi === null || firstItem.inchi === undefined,
        "15. InChI is null (PDF mode): " + JSON.stringify(firstItem.inchi),
      ),
    );

    const results = summarise(assertions);
    console.table(results);
    return results;
  }

  // =========================================================================
  // 5. 6E — Accessibility DOM checks
  // =========================================================================

  /**
   * Test WCAG 2.2 AA accessibility DOM state for chemistry panel.
   * @returns {Object} Test results
   */
  function testAccessibilityDOM() {
    console.log("\n\ud83e\uddea 5. 6E — Accessibility DOM Checks\n");

    const assertions = [];

    // Test 16: #chemistry-live-region exists in DOM
    const liveRegion = document.getElementById("chemistry-live-region");
    assertions.push(
      assert(!!liveRegion, "16. #chemistry-live-region exists in DOM"),
    );

    // Test 17: #chemistry-live-region is NOT inside #mathpix-output-smiles
    const smilesOutput = document.getElementById("mathpix-output-smiles");
    const isInsideSmilesOutput = smilesOutput && liveRegion
      ? smilesOutput.contains(liveRegion)
      : false;
    assertions.push(
      assert(
        liveRegion && !isInsideSmilesOutput,
        "17. #chemistry-live-region NOT inside #mathpix-output-smiles",
      ),
    );

    // Test 18: #chemistry-formula-display does NOT have aria-label attribute
    const formulaDisplay = document.getElementById("chemistry-formula-display");
    const hasAriaLabel = formulaDisplay
      ? formulaDisplay.hasAttribute("aria-label")
      : true; // fail if element missing
    assertions.push(
      assert(
        formulaDisplay && !hasAriaLabel,
        "18. #chemistry-formula-display has no aria-label attribute",
      ),
    );

    // Test 19: #resume-tab-chemistry has tabindex="-1"
    const resumeTab = document.getElementById("resume-tab-chemistry");
    const resumeTabIndex = resumeTab ? resumeTab.getAttribute("tabindex") : null;
    assertions.push(
      assert(
        resumeTab && resumeTabIndex === "-1",
        "19. #resume-tab-chemistry has tabindex='-1' (got: " + JSON.stringify(resumeTabIndex) + ")",
      ),
    );

    // Test 20: #panel-chemistry has the hidden attribute
    const panelChemistry = document.getElementById("panel-chemistry");
    const hasHidden = panelChemistry ? panelChemistry.hasAttribute("hidden") : false;
    assertions.push(
      assert(
        panelChemistry && hasHidden,
        "20. #panel-chemistry has hidden attribute",
      ),
    );

    // Test 21: #chemistry-describe-btn has a non-empty aria-label
    const describeBtn = document.getElementById("chemistry-describe-btn");
    const describeBtnLabel = describeBtn
      ? describeBtn.getAttribute("aria-label")
      : null;
    assertions.push(
      assert(
        describeBtn && describeBtnLabel && describeBtnLabel.trim().length > 0,
        "21. #chemistry-describe-btn has non-empty aria-label",
      ),
    );

    const results = summarise(assertions);
    console.table(results);
    return results;
  }

  // =========================================================================
  // Main test runner
  // =========================================================================

  /**
   * Run all Phase 6 chemistry tests and output a summary.
   * @returns {Promise<Object>} Combined results from all test categories
   */
  window.testChemistryPhase6 = async () => {
    console.log("=".repeat(60));
    console.log("\ud83d\udd2c PHASE 6 CHEMISTRY TEST SUITE");
    console.log("=".repeat(60));

    const allResults = {};
    const categoryStatus = {};

    // 1. 6A — PubChem SMILES lookup (async — requires network)
    const smilesResults = await testPubChemSmilesLookup();
    Object.assign(allResults, smilesResults);
    categoryStatus["1. 6A PubChem SMILES"] = Object.values(smilesResults).every(
      (v) => v === "\u2705",
    )
      ? "\u2705 PASS"
      : "\u274C FAIL";

    // 2. 6B — Back-population (async — uses cached results)
    const backPopResults = await testBackPopulation();
    Object.assign(allResults, backPopResults);
    categoryStatus["2. 6B Back-population"] = Object.values(backPopResults).every(
      (v) => v === "\u2705",
    )
      ? "\u2705 PASS"
      : "\u274C FAIL";

    // 3. 6C — Caption context extraction
    const captionResults = testCaptionContext();
    Object.assign(allResults, captionResults);
    categoryStatus["3. 6C Caption Context"] = Object.values(captionResults).every(
      (v) => v === "\u2705",
    )
      ? "\u2705 PASS"
      : "\u274C FAIL";

    // 4. 6D — Integration
    const integrationResults = testIntegration();
    Object.assign(allResults, integrationResults);
    categoryStatus["4. 6D Integration"] = Object.values(integrationResults).every(
      (v) => v === "\u2705",
    )
      ? "\u2705 PASS"
      : "\u274C FAIL";

    // 5. 6E — Accessibility DOM checks
    const a11yResults = testAccessibilityDOM();
    Object.assign(allResults, a11yResults);
    categoryStatus["5. 6E Accessibility"] = Object.values(a11yResults).every(
      (v) => v === "\u2705",
    )
      ? "\u2705 PASS"
      : "\u274C FAIL";

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("PHASE 6 CHEMISTRY TEST SUMMARY");
    console.log("=".repeat(60));
    console.table(categoryStatus);

    const allPassed = Object.values(categoryStatus).every((v) =>
      v.includes("PASS"),
    );

    if (allPassed) {
      console.log("\n\ud83c\udf89 ALL PHASE 6 CHEMISTRY TESTS PASSED!");
    } else {
      console.log(
        "\n\u26a0\ufe0f SOME TESTS FAILED \u2014 review output above",
      );
    }
    console.log("=".repeat(60));

    return { categories: categoryStatus, details: allResults, allPassed };
  };

  /**
   * Quick validation — runs DOM accessibility checks only (no network calls).
   * Tests 16–21 from the Phase 6 suite.
   * @returns {boolean} True if all DOM checks pass
   */
  window.validatePhase6Quick = () => {
    console.log("\u26a1 Quick Phase 6 Validation (DOM checks only, no network)\n");

    const a11yResults = testAccessibilityDOM();
    const captionResults = testCaptionContext();
    const integrationResults = testIntegration();

    const allSync = {
      ...captionResults,
      ...integrationResults,
      ...a11yResults,
    };
    const allPassed = Object.values(allSync).every((v) => v === "\u2705");

    const summary = {};
    summary["Overall"] = allPassed ? "\u2705 ALL PASS" : "\u274C SOME FAILED";
    console.table(summary);

    return allPassed;
  };
})();
