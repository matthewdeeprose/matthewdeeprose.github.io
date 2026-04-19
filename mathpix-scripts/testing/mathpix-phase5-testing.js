/**
 * @fileoverview Phase 5 Chemistry Testing Suite
 * @module MathPixPhase5Testing
 * @version 5.0.0
 * @since 5.0.0
 *
 * @description
 * Comprehensive testing suite for Phase 5 chemistry pipeline.
 * Validates the full chemistry stack: extraction, formula parsing,
 * screen reader formatting, accessible descriptions, PubChem lookup,
 * AI description service, structure rendering, and panel population.
 *
 * Test Categories:
 * 1. Chemistry extraction (MathPixChemistryUtils.extractChemistryFromResponse)
 * 2. InChI formula parsing (parseInChIFormula)
 * 3. Screen reader & HTML formatting (formatFormulaForScreenReader, formatFormulaAsHTML)
 * 4. Accessible description generation (generateBasicAccessibleDescription)
 * 5. PubChem lookup (lookupPubChem + cache + CAS filter)
 * 6. AI description service (getDescriptionService)
 * 7. Structure rendering (renderStructure)
 * 8. Chemistry panel DOM population
 *
 * @example
 * // Run complete Phase 5 test suite
 * await window.testChemistryPhase5()
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
  // 1. Chemistry extraction
  // =========================================================================

  /**
   * Test MathPixChemistryUtils.extractChemistryFromResponse()
   * @returns {Object} Test results keyed by test name
   */
  function testChemistryExtraction() {
    console.log("\n\ud83e\uddea 1. Chemistry Extraction Tests\n");

    const utils = window.MathPixChemistryUtils;
    const assertions = [];

    // Pre-check
    assertions.push(assert(!!utils, "MathPixChemistryUtils available"));
    assertions.push(
      assert(
        typeof utils?.extractChemistryFromResponse === "function",
        "extractChemistryFromResponse is a function",
      ),
    );

    if (!utils) {
      const r = summarise(assertions);
      console.table(r);
      return r;
    }

    // Test: Extract from text with attributes
    const attrResponse = {
      text: 'Ethanol: <smiles inchi="InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3" inchi_key="LFQSCWFLJHTTHZ-UHFFFAOYSA-N">CCO</smiles>',
    };
    const attrResult = utils.extractChemistryFromResponse(attrResponse);
    assertions.push(
      assert(attrResult.length === 1, "Extract from text: 1 result"),
    );
    assertions.push(
      assert(
        attrResult[0]?.notation === "CCO",
        "Extract from text: notation = CCO",
      ),
    );
    assertions.push(
      assert(
        attrResult[0]?.inchi?.includes("C2H6O"),
        "Extract from text: InChI parsed",
      ),
    );
    assertions.push(
      assert(
        attrResult[0]?.inchiKey === "LFQSCWFLJHTTHZ-UHFFFAOYSA-N",
        "Extract from text: InChI Key parsed",
      ),
    );

    // Test: Extract from line_data with chemistry subtype
    const lineDataResponse = {
      text: "",
      line_data: [
        {
          id: "line1",
          type: "diagram",
          subtype: "chemistry",
          text: "<smiles>C1=CC=CC=C1</smiles>",
        },
      ],
    };
    const lineResult = utils.extractChemistryFromResponse(lineDataResponse);
    assertions.push(
      assert(lineResult.length === 1, "Extract from line_data: 1 result"),
    );
    assertions.push(
      assert(
        lineResult[0]?.notation === "C1=CC=CC=C1",
        "Extract from line_data: notation = benzene",
      ),
    );

    // Test: Deduplication between text and line_data
    const dedupResponse = {
      text: "Water: <smiles>O</smiles>",
      line_data: [
        {
          id: "line1",
          type: "diagram",
          subtype: "chemistry",
          text: "<smiles>O</smiles>",
        },
      ],
    };
    const dedupResult = utils.extractChemistryFromResponse(dedupResponse);
    assertions.push(
      assert(dedupResult.length === 1, "Deduplication: 1 result (not 2)"),
    );

    // Test: Multiple SMILES in text
    const multiResponse = {
      text: "Water <smiles>O</smiles> and ethanol <smiles>CCO</smiles>",
    };
    const multiResult = utils.extractChemistryFromResponse(multiResponse);
    assertions.push(
      assert(multiResult.length === 2, "Multiple SMILES: 2 results"),
    );

    // Test: Empty/null response handling
    assertions.push(
      assert(
        utils.extractChemistryFromResponse(null).length === 0,
        "Null response: empty array",
      ),
    );
    assertions.push(
      assert(
        utils.extractChemistryFromResponse({}).length === 0,
        "Empty object: empty array",
      ),
    );
    assertions.push(
      assert(
        utils.extractChemistryFromResponse({ text: "No chemistry here" })
          .length === 0,
        "No SMILES tags: empty array",
      ),
    );

    const results = summarise(assertions);
    console.table(results);
    return results;
  }

  // =========================================================================
  // 2. Formula parsing
  // =========================================================================

  /**
   * Test parseInChIFormula()
   * @returns {Object} Test results
   */
  function testFormulaParsing() {
    console.log("\n\ud83e\uddea 2. Formula Parsing Tests\n");

    const utils = window.MathPixChemistryUtils;
    const assertions = [];

    if (!utils) {
      assertions.push(assert(false, "MathPixChemistryUtils not available"));
      const r = summarise(assertions);
      console.table(r);
      return r;
    }

    // Standard ethanol InChI
    const ethanol = utils.parseInChIFormula(
      "InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3",
    );
    assertions.push(assert(!!ethanol, "Ethanol InChI: parsed"));
    assertions.push(
      assert(ethanol?.raw === "C2H6O", "Ethanol InChI: raw = C2H6O"),
    );
    assertions.push(assert(ethanol?.elements?.C === 2, "Ethanol: C = 2"));
    assertions.push(assert(ethanol?.elements?.H === 6, "Ethanol: H = 6"));
    assertions.push(assert(ethanol?.elements?.O === 1, "Ethanol: O = 1"));

    // Complex formula — caffeine
    const caffeine = utils.parseInChIFormula(
      "InChI=1S/C8H10N4O2/c1-10-4-9-6-5(10)7(13)12(3)8(14)11(6)2/h4H,1-3H3",
    );
    assertions.push(assert(!!caffeine, "Caffeine InChI: parsed"));
    assertions.push(
      assert(caffeine?.raw === "C8H10N4O2", "Caffeine: raw = C8H10N4O2"),
    );
    assertions.push(assert(caffeine?.elements?.C === 8, "Caffeine: C = 8"));
    assertions.push(assert(caffeine?.elements?.N === 4, "Caffeine: N = 4"));

    // Invalid / missing InChI
    assertions.push(
      assert(
        utils.parseInChIFormula(null) === null,
        "Null input: returns null",
      ),
    );
    assertions.push(
      assert(
        utils.parseInChIFormula("") === null,
        "Empty string: returns null",
      ),
    );
    assertions.push(
      assert(
        utils.parseInChIFormula("not-an-inchi") === null,
        "Invalid format: returns null",
      ),
    );

    const results = summarise(assertions);
    console.table(results);
    return results;
  }

  // =========================================================================
  // 3. Screen reader & HTML formatting
  // =========================================================================

  /**
   * Test formatFormulaForScreenReader() and formatFormulaAsHTML()
   * @returns {Object} Test results
   */
  function testScreenReaderFormatting() {
    console.log("\n\ud83e\uddea 3. Screen Reader & HTML Formatting Tests\n");

    const utils = window.MathPixChemistryUtils;
    const assertions = [];

    if (!utils) {
      assertions.push(assert(false, "MathPixChemistryUtils not available"));
      const r = summarise(assertions);
      console.table(r);
      return r;
    }

    // Screen reader formatting
    const srWater = utils.formatFormulaForScreenReader("H2O");
    assertions.push(assert(srWater === "H 2, O", "SR: H2O \u2192 'H 2, O'"));

    const srEthanol = utils.formatFormulaForScreenReader("C2H6O");
    assertions.push(
      assert(srEthanol === "C 2, H 6, O", "SR: C2H6O \u2192 'C 2, H 6, O'"),
    );

    assertions.push(
      assert(
        utils.formatFormulaForScreenReader("") === "",
        "SR: empty string \u2192 empty",
      ),
    );
    assertions.push(
      assert(
        utils.formatFormulaForScreenReader(null) === "",
        "SR: null \u2192 empty",
      ),
    );

    // HTML formatting
    const htmlEthanol = utils.formatFormulaAsHTML("C2H6O");
    assertions.push(
      assert(
        htmlEthanol === "C<sub>2</sub>H<sub>6</sub>O",
        "HTML: C2H6O \u2192 subscripts",
      ),
    );

    const htmlWater = utils.formatFormulaAsHTML("H2O");
    assertions.push(
      assert(htmlWater === "H<sub>2</sub>O", "HTML: H2O \u2192 subscript"),
    );

    assertions.push(
      assert(utils.formatFormulaAsHTML("") === "", "HTML: empty \u2192 empty"),
    );

    const results = summarise(assertions);
    console.table(results);
    return results;
  }

  // =========================================================================
  // 4. Accessible description
  // =========================================================================

  /**
   * Test generateBasicAccessibleDescription()
   * @returns {Object} Test results
   */
  function testAccessibleDescription() {
    console.log("\n\ud83e\uddea 4. Accessible Description Tests\n");

    const utils = window.MathPixChemistryUtils;
    const assertions = [];

    if (!utils) {
      assertions.push(assert(false, "MathPixChemistryUtils not available"));
      const r = summarise(assertions);
      console.table(r);
      return r;
    }

    // With IUPAC name and formula
    const withName = utils.generateBasicAccessibleDescription({
      notation: "CCO",
      formula: { raw: "C2H6O" },
      iupacName: "ethanol",
    });
    assertions.push(
      assert(withName.includes("ethanol"), "With name: includes 'ethanol'"),
    );
    assertions.push(
      assert(
        withName.includes("Molecular formula"),
        "With name: includes formula section",
      ),
    );
    assertions.push(
      assert(
        withName.includes("SMILES notation: CCO"),
        "With name: includes SMILES",
      ),
    );

    // Without IUPAC name
    const withoutName = utils.generateBasicAccessibleDescription({
      notation: "O",
      formula: { raw: "H2O" },
    });
    assertions.push(
      assert(
        withoutName.startsWith("Chemical structure"),
        "Without name: starts with generic prefix",
      ),
    );
    assertions.push(
      assert(
        !withoutName.includes("ethanol"),
        "Without name: no IUPAC name present",
      ),
    );

    // Without formula
    const noFormula = utils.generateBasicAccessibleDescription({
      notation: "O",
    });
    assertions.push(
      assert(
        !noFormula.includes("Molecular formula"),
        "No formula: omits formula section",
      ),
    );
    assertions.push(
      assert(
        noFormula.includes("SMILES notation: O"),
        "No formula: includes SMILES",
      ),
    );

    // Empty / null
    assertions.push(
      assert(
        utils.generateBasicAccessibleDescription(null) === "",
        "Null: returns empty string",
      ),
    );
    assertions.push(
      assert(
        utils.generateBasicAccessibleDescription({}) === "",
        "Empty object: returns empty string",
      ),
    );

    const results = summarise(assertions);
    console.table(results);
    return results;
  }

  // =========================================================================
  // 5. PubChem lookup
  // =========================================================================

  /**
   * Test lookupPubChem() with a known compound (caffeine).
   * Also tests cache hit speed and CAS number filtering.
   * @returns {Promise<Object>} Test results
   */
  async function testPubChemLookup() {
    console.log("\n\ud83e\uddea 5. PubChem Lookup Tests\n");

    const utils = window.MathPixChemistryUtils;
    const assertions = [];

    if (!utils || typeof utils.lookupPubChem !== "function") {
      assertions.push(assert(false, "lookupPubChem not available"));
      const r = summarise(assertions);
      console.table(r);
      return r;
    }

    // Clear cache to ensure a fresh lookup
    utils.clearPubChemCache();

    // Caffeine InChI Key
    const caffeineKey = "RYYVLZVUVIJVGH-UHFFFAOYSA-N";

    try {
      const t0 = performance.now();
      const result = await utils.lookupPubChem(caffeineKey);
      const firstLookupTime = performance.now() - t0;

      assertions.push(assert(result.found === true, "Caffeine: found = true"));
      assertions.push(
        assert(
          !!result.iupacName,
          "Caffeine: has IUPAC name (" + (result.iupacName || "?") + ")",
        ),
      );
      assertions.push(
        assert(typeof result.pubchemCid === "number", "Caffeine: has CID"),
      );
      assertions.push(
        assert(
          typeof result.molecularWeight === "number",
          "Caffeine: has molecular weight (" + result.molecularWeight + ")",
        ),
      );
      assertions.push(assert(!!result.pubchemUrl, "Caffeine: has PubChem URL"));

      // CAS number filter: commonNames should NOT contain CAS-style numbers
      const hasCAS = result.commonNames?.some((name) =>
        /^\d[\d-]+\d$/.test(name),
      );
      assertions.push(
        assert(!hasCAS, "CAS filter: no CAS numbers in commonNames"),
      );

      // Cache hit test — second lookup should be < 5ms
      const t1 = performance.now();
      const cached = await utils.lookupPubChem(caffeineKey);
      const cacheTime = performance.now() - t1;

      assertions.push(assert(cached.found === true, "Cache hit: found = true"));
      assertions.push(
        assert(
          cacheTime < 5,
          "Cache hit: < 5ms (" + cacheTime.toFixed(2) + "ms)",
        ),
      );

      logInfo(
        "First lookup: " +
          firstLookupTime.toFixed(0) +
          "ms, cache: " +
          cacheTime.toFixed(2) +
          "ms",
      );
    } catch (error) {
      assertions.push(assert(false, "PubChem lookup threw: " + error.message));
    }

    // Invalid InChI Key
    try {
      const invalid = await utils.lookupPubChem("INVALID-KEY-XXXXXXXX");
      assertions.push(
        assert(invalid.found === false, "Invalid key: found = false"),
      );
    } catch (error) {
      assertions.push(assert(false, "Invalid key threw: " + error.message));
    }

    // No key
    const noKey = await utils.lookupPubChem(null);
    assertions.push(assert(noKey.found === false, "Null key: found = false"));

    const results = summarise(assertions);
    console.table(results);
    return results;
  }

  // =========================================================================
  // 6. AI description service
  // =========================================================================

  /**
   * Test getDescriptionService() initialisation and caching.
   * Only tests the actual API call if an API key is present.
   * @returns {Promise<Object>} Test results
   */
  async function testDescriptionService() {
    console.log("\n\ud83e\uddea 6. AI Description Service Tests\n");

    const utils = window.MathPixChemistryUtils;
    const assertions = [];

    if (!utils || typeof utils.getDescriptionService !== "function") {
      assertions.push(assert(false, "getDescriptionService not available"));
      const r = summarise(assertions);
      console.table(r);
      return r;
    }

    const service = utils.getDescriptionService();
    assertions.push(assert(!!service, "Service created (lazy init)"));
    assertions.push(
      assert(
        typeof service.describe === "function",
        "describe() method exists",
      ),
    );
    assertions.push(
      assert(
        typeof service.clearCache === "function",
        "clearCache() method exists",
      ),
    );

    // Same service returned on second call (singleton)
    const service2 = utils.getDescriptionService();
    assertions.push(assert(service === service2, "Singleton: same instance"));

    // Test describe() with missing data
    const emptyDesc = await service.describe(null);
    assertions.push(
      assert(
        emptyDesc === "No chemical structure data available.",
        "Null input: fallback message",
      ),
    );

    // Test with API key present (real call) or absent (graceful fallback)
    const hasApiKey = !!localStorage.getItem("openrouter_api_key");
    const hasEmbed = typeof window.OpenRouterEmbed !== "undefined";

    if (hasApiKey && hasEmbed) {
      try {
        const t0 = performance.now();
        const desc = await service.describe({
          notation: "CCO",
          formula: "C2H6O",
          iupacName: "ethanol",
        });
        const descTime = performance.now() - t0;

        assertions.push(
          assert(
            typeof desc === "string" && desc.length > 10,
            "API call: got description (" +
              desc.length +
              " chars, " +
              descTime.toFixed(0) +
              "ms)",
          ),
        );

        // Cache test
        const t1 = performance.now();
        const cached = await service.describe({ notation: "CCO" });
        const cacheTime = performance.now() - t1;

        assertions.push(
          assert(
            cacheTime < 5,
            "Cache: < 5ms (" + cacheTime.toFixed(2) + "ms)",
          ),
        );
      } catch (error) {
        assertions.push(
          assert(false, "API describe() threw: " + error.message),
        );
      }
    } else {
      const fallback = await service.describe({ notation: "CCO" });
      assertions.push(
        assert(
          typeof fallback === "string",
          "No API key/Embed: graceful fallback (" +
            fallback.substring(0, 50) +
            ")",
        ),
      );
    }

    const results = summarise(assertions);
    console.table(results);
    return results;
  }

  // =========================================================================
  // 7. Structure rendering
  // =========================================================================

  /**
   * Test renderStructure() with SmilesDrawer.
   * @returns {Object} Test results
   */
  function testChemistryRendering() {
    console.log("\n\ud83e\uddea 7. Structure Rendering Tests\n");

    const utils = window.MathPixChemistryUtils;
    const assertions = [];

    if (!utils || typeof utils.renderStructure !== "function") {
      assertions.push(assert(false, "renderStructure not available"));
      const r = summarise(assertions);
      console.table(r);
      return r;
    }

    // Check SmilesDrawer availability
    const hasSmilesDrawer = typeof window.SmilesDrawer !== "undefined";
    assertions.push(assert(hasSmilesDrawer, "SmilesDrawer library available"));

    // Check canvas element exists
    const canvas = document.getElementById("chemistry-structure-canvas");
    assertions.push(assert(!!canvas, "Canvas element exists"));

    if (hasSmilesDrawer && canvas) {
      // Render simple SMILES (ethanol)
      const rendered = utils.renderStructure("CCO", canvas);
      assertions.push(
        assert(rendered === true, "renderStructure(CCO): returned true"),
      );

      // Render benzene ring
      const benzene = utils.renderStructure("C1=CC=CC=C1", canvas);
      assertions.push(
        assert(benzene === true, "renderStructure(benzene): returned true"),
      );
    }

    // Missing SmilesDrawer — graceful handling
    if (!hasSmilesDrawer) {
      const result = utils.renderStructure("CCO", canvas);
      assertions.push(
        assert(result === false, "No SmilesDrawer: returns false gracefully"),
      );
    }

    // Missing canvas element
    const nullCanvas = utils.renderStructure("CCO", null);
    assertions.push(assert(nullCanvas === false, "Null canvas: returns false"));

    const results = summarise(assertions);
    console.table(results);
    return results;
  }

  // =========================================================================
  // 8. Panel population (DOM state)
  // =========================================================================

  /**
   * Test that chemistry panel DOM elements are populated correctly.
   * @returns {Object} Test results
   */
  function testPanelPopulation() {
    console.log("\n\ud83e\uddea 8. Panel Population Tests\n");

    const assertions = [];

    const controller = window.getMathPixController?.();
    const renderer = controller?.resultRenderer;

    assertions.push(assert(!!controller, "MathPix controller available"));
    assertions.push(assert(!!renderer, "Result renderer available"));

    if (!renderer) {
      const r = summarise(assertions);
      console.table(r);
      return r;
    }

    assertions.push(
      assert(
        typeof renderer.populateChemistryFormat === "function",
        "populateChemistryFormat() exists",
      ),
    );
    assertions.push(
      assert(
        typeof renderer.showChemistryTab === "function",
        "showChemistryTab() exists",
      ),
    );

    // Populate with mock data
    const mockData = [
      {
        notation: "CCO",
        inchi: "InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3",
        inchiKey: "LFQSCWFLJHTTHZ-UHFFFAOYSA-N",
        context: "Ethanol molecule",
        confidence: 0.98,
        lineId: null,
      },
    ];

    renderer.populateChemistryFormat(mockData);
    renderer.showChemistryTab(true);

    // Check DOM state
    const tabBtn = document.getElementById("mathpix-tab-smiles");
    assertions.push(
      assert(
        tabBtn && tabBtn.style.display !== "none",
        "Chemistry tab visible",
      ),
    );

    const smilesEl = document.getElementById("chemistry-smiles-display");
    assertions.push(
      assert(
        smilesEl?.textContent?.includes("CCO"),
        "SMILES display populated",
      ),
    );

    const inchiEl = document.getElementById("chemistry-inchi-display");
    assertions.push(
      assert(
        inchiEl?.textContent?.includes("InChI="),
        "InChI display populated",
      ),
    );

    const inchikeyEl = document.getElementById("chemistry-inchikey-display");
    assertions.push(
      assert(
        inchikeyEl?.textContent?.includes("LFQSCWFLJHTTHZ"),
        "InChI Key display populated",
      ),
    );

    const formulaEl = document.getElementById("chemistry-formula-display");
    assertions.push(
      assert(
        formulaEl?.innerHTML?.includes("<sub>"),
        "Formula display has subscripts",
      ),
    );

    const figure = document.getElementById("chemistry-structure-figure");
    const ariaLabel = figure?.getAttribute("aria-label") || "";
    assertions.push(assert(ariaLabel.length > 0, "Figure has aria-label"));

    // Clean up: hide chemistry tab
    renderer.showChemistryTab(false);

    const results = summarise(assertions);
    console.table(results);
    return results;
  }

  // =========================================================================
  // Main test runner
  // =========================================================================

  /**
   * Run all Phase 5 chemistry tests and output a summary.
   * @returns {Promise<Object>} Combined results from all test categories
   */
  window.testChemistryPhase5 = async () => {
    console.log("=".repeat(60));
    console.log("\ud83d\udd2c PHASE 5 CHEMISTRY TEST SUITE");
    console.log("=".repeat(60));

    const allResults = {};
    const categoryStatus = {};

    // 1. Chemistry extraction
    const extractionResults = testChemistryExtraction();
    Object.assign(allResults, extractionResults);
    categoryStatus["1. Extraction"] = Object.values(extractionResults).every(
      (v) => v === "\u2705",
    )
      ? "\u2705 PASS"
      : "\u274C FAIL";

    // 2. Formula parsing
    const formulaResults = testFormulaParsing();
    Object.assign(allResults, formulaResults);
    categoryStatus["2. Formula Parsing"] = Object.values(formulaResults).every(
      (v) => v === "\u2705",
    )
      ? "\u2705 PASS"
      : "\u274C FAIL";

    // 3. Screen reader formatting
    const srResults = testScreenReaderFormatting();
    Object.assign(allResults, srResults);
    categoryStatus["3. SR Formatting"] = Object.values(srResults).every(
      (v) => v === "\u2705",
    )
      ? "\u2705 PASS"
      : "\u274C FAIL";

    // 4. Accessible description
    const descResults = testAccessibleDescription();
    Object.assign(allResults, descResults);
    categoryStatus["4. Accessible Desc"] = Object.values(descResults).every(
      (v) => v === "\u2705",
    )
      ? "\u2705 PASS"
      : "\u274C FAIL";

    // 5. PubChem lookup (async — requires network)
    const pubchemResults = await testPubChemLookup();
    Object.assign(allResults, pubchemResults);
    categoryStatus["5. PubChem Lookup"] = Object.values(pubchemResults).every(
      (v) => v === "\u2705",
    )
      ? "\u2705 PASS"
      : "\u274C FAIL";

    // 6. AI description service
    const aiResults = await testDescriptionService();
    Object.assign(allResults, aiResults);
    categoryStatus["6. AI Description"] = Object.values(aiResults).every(
      (v) => v === "\u2705",
    )
      ? "\u2705 PASS"
      : "\u274C FAIL";

    // 7. Structure rendering
    const renderResults = testChemistryRendering();
    Object.assign(allResults, renderResults);
    categoryStatus["7. Rendering"] = Object.values(renderResults).every(
      (v) => v === "\u2705",
    )
      ? "\u2705 PASS"
      : "\u274C FAIL";

    // 8. Panel population
    const panelResults = testPanelPopulation();
    Object.assign(allResults, panelResults);
    categoryStatus["8. Panel Population"] = Object.values(panelResults).every(
      (v) => v === "\u2705",
    )
      ? "\u2705 PASS"
      : "\u274C FAIL";

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("PHASE 5 CHEMISTRY TEST SUMMARY");
    console.log("=".repeat(60));
    console.table(categoryStatus);

    const allPassed = Object.values(categoryStatus).every((v) =>
      v.includes("PASS"),
    );

    if (allPassed) {
      console.log("\n\ud83c\udf89 ALL PHASE 5 CHEMISTRY TESTS PASSED!");
    } else {
      console.log(
        "\n\u26a0\ufe0f SOME TESTS FAILED \u2014 review output above",
      );
    }
    console.log("=".repeat(60));

    return { categories: categoryStatus, details: allResults, allPassed };
  };

  /**
   * Quick validation — runs essential tests only (no network calls).
   * @returns {Object} Pass/fail for core tests
   */
  window.validatePhase5Quick = () => {
    console.log("\u26a1 Quick Phase 5 Validation (no network)\n");

    const results = {};

    // Run synchronous tests only
    const extraction = testChemistryExtraction();
    const formula = testFormulaParsing();
    const sr = testScreenReaderFormatting();
    const desc = testAccessibleDescription();
    const rendering = testChemistryRendering();
    const panel = testPanelPopulation();

    const allSync = {
      ...extraction,
      ...formula,
      ...sr,
      ...desc,
      ...rendering,
      ...panel,
    };
    const allPassed = Object.values(allSync).every((v) => v === "\u2705");

    results["Overall"] = allPassed ? "\u2705 ALL PASS" : "\u274C SOME FAILED";
    console.table(results);

    return allPassed;
  };
})();
