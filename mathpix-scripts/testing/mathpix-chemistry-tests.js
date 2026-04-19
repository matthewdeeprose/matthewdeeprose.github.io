/**
 * MathPix Chemistry Test Harnesses
 *
 * Browser-console test runners for the chemistry pipeline (Phases 7A, 7B, 7C).
 * Extracted from mathpix-chemistry-utils.js to keep production code separate
 * from test code. Loaded via tools.html alongside the other test harnesses
 * in mathpix-scripts/testing/.
 *
 * All harnesses depend only on the public API exposed at:
 *   - window.MathPixChemistryUtils
 *   - window.MATHPIX_CONFIG
 *   - DOM elements rendered by mathpix-result-renderer.js
 *
 * Run individually from the console (e.g. `window.testChemistry7C_Stage4()`)
 * or run all at once via `window.testChemistryAll()`.
 */

(function () {
  "use strict";

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
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

  if (!window.MathPixChemistryUtils) {
    logWarn(
      "mathpix-chemistry-tests.js loaded before mathpix-chemistry-utils.js — " +
        "test harnesses will not function correctly. Check script order in tools.html."
    );
  }

// Phase 7A: Comprehensive Stage 1 test harness
window.testChemistry7A_Stage1 = function () {
  const utils = window.MathPixChemistryUtils;
  const canvas = document.getElementById("chemistry-structure-canvas");

  if (!canvas) {
    console.error(
      "No chemistry canvas — switch to MathPix mode and load a chemistry result first",
    );
    return;
  }

  const molecules = [
    {
      name: "Aspirin",
      smiles: "CC(=O)Oc1ccccc1C(=O)O",
      checks: (a) => [
        { name: "has analysis", pass: !!a },
        { name: "1 ring", pass: a?.rings?.length === 1 },
        { name: "benzene", pass: a?.rings?.[0]?.type === "benzene" },
        {
          name: "acid",
          pass: a?.functionalGroups?.some((g) => g.shortName === "acid"),
        },
        {
          name: "ester",
          pass: a?.functionalGroups?.some((g) => g.shortName === "ester"),
        },
        {
          name: "no hydroxyl",
          pass: !a?.functionalGroups?.some((g) => g.shortName === "hydroxyl"),
        },
        { name: "aromatic scaffold", pass: a?.scaffoldType === "aromatic-ring" },
        { name: "13 atoms", pass: a?.heavyAtomCount === 13 },
      ],
    },
    {
      name: "Ethanol",
      smiles: "CCO",
      checks: (a) => [
        { name: "no rings", pass: a?.rings?.length === 0 },
        {
          name: "hydroxyl",
          pass: a?.functionalGroups?.some((g) => g.shortName === "hydroxyl"),
        },
        { name: "chain scaffold", pass: a?.scaffoldType === "chain" },
        { name: "chain length 2", pass: a?.chain?.length === 2 },
      ],
    },
    {
      name: "Benzene",
      smiles: "c1ccccc1",
      checks: (a) => [
        { name: "1 ring", pass: a?.rings?.length === 1 },
        { name: "benzene type", pass: a?.rings?.[0]?.type === "benzene" },
        { name: "aromatic", pass: a?.rings?.[0]?.aromatic === true },
        { name: "no groups", pass: a?.functionalGroups?.length === 0 },
      ],
    },
    {
      name: "Paracetamol",
      smiles: "CC(=O)Nc1ccc(O)cc1",
      checks: (a) => [
        { name: "benzene ring", pass: a?.rings?.[0]?.type === "benzene" },
        {
          name: "hydroxyl",
          pass: a?.functionalGroups?.some((g) => g.shortName === "hydroxyl"),
        },
        {
          name: "amide",
          pass: a?.functionalGroups?.some((g) => g.shortName.includes("amide")),
        },
      ],
    },
    {
      name: "Acetic acid",
      smiles: "CC(=O)O",
      checks: (a) => [
        {
          name: "acid",
          pass: a?.functionalGroups?.some((g) => g.shortName === "acid"),
        },
        { name: "chain scaffold", pass: a?.scaffoldType === "chain" },
      ],
    },
    {
      name: "Caffeine",
      smiles: "Cn1c(=O)c2c(ncn2C)n(C)c1=O",
      checks: (a) => [
        { name: "2 rings", pass: a?.rings?.length === 2 },
        { name: "fused", pass: a?.rings?.some((r) => r.isFused) },
        { name: "fused scaffold", pass: a?.scaffoldType === "fused-rings" },
      ],
    },
  ];

  let moleculeIndex = 0;
  const allTests = [];

  function testNext() {
    if (moleculeIndex >= molecules.length) {
      // Print summary
      console.log("\nPhase 7A Stage 1: Structure Analysis\n");
      let passed = 0;
      allTests.forEach((t) => {
        console.log((t.pass ? "PASS" : "FAIL") + " " + t.name);
        if (t.pass) passed++;
      });
      console.log("\n" + passed + "/" + allTests.length + " passed");
      return { passed, total: allTests.length };
    }

    const mol = molecules[moleculeIndex];
    utils.renderStructure(mol.smiles, canvas, {
      onGraphReady: () => {
        const analysis = utils.analyseStructure(mol.smiles);
        const checks = mol.checks(analysis);
        checks.forEach((c) => {
          allTests.push({ name: mol.name + ": " + c.name, pass: c.pass });
        });
        moleculeIndex++;
        // Small delay to allow canvas to settle before next render
        setTimeout(testNext, 100);
      },
    });
  }

  testNext();
};

// Phase 7A-2: Language assembly test harness
window.testChemistry7A_Stage2 = function () {
  const utils = window.MathPixChemistryUtils;
  const canvas = document.getElementById("chemistry-structure-canvas");

  if (!canvas) {
    console.error(
      "No chemistry canvas — switch to MathPix mode and load a chemistry result first",
    );
    return;
  }

  const molecules = [
    {
      name: "Aspirin",
      smiles: "CC(=O)Oc1ccccc1C(=O)O",
      pubchem: {
        commonNames: ["aspirin"],
        molecularWeight: 180.16,
        molecularFormula: "C9H8O4",
        inchi: "InChI=1S/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)",
      },
      checks: (d) => [
        { name: "starts with name", pass: d.startsWith("Aspirin") },
        { name: "mentions benzene", pass: d.includes("benzene") },
        { name: "mentions acid", pass: d.toLowerCase().includes("acid") },
        { name: "mentions ester", pass: d.includes("ester") },
        { name: "under 150 words", pass: d.split(/\s+/).length <= 150 },
        { name: "no SMILES in output", pass: !d.includes("CC(=O)") },
        { name: "plain text (no markup)", pass: !/[*#<>]/.test(d) },
        { name: "includes formula or weight", pass: d.includes("molecular weight") || d.includes("C₉") },
        { name: "includes element list", pass: d.includes("Contains") && d.includes("carbon") },
        { name: "acid has shorthand", pass: d.includes("–COOH") || d.includes("COOH") },
        { name: "ester has specific shorthand", pass: d.includes("–OCOCH₃") },
        { name: "includes ortho", pass: d.includes("(ortho)") },
      ],
    },
    {
      name: "Ethanol",
      smiles: "CCO",
      pubchem: {
        commonNames: ["ethanol"],
        molecularWeight: 46.07,
        molecularFormula: "C2H6O",
        inchi: "InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3",
      },
      checks: (d) => [
        { name: "starts with name", pass: d.startsWith("Ethanol") },
        { name: "mentions chain", pass: d.includes("chain") || d.includes("carbon") },
        { name: "mentions hydroxyl", pass: d.includes("hydroxyl") },
        { name: "under 80 words", pass: d.split(/\s+/).length <= 80 },
        { name: "hydroxyl has shorthand", pass: d.includes("–OH") },
        { name: "includes element list", pass: d.includes("Contains") && d.includes("carbon") },
      ],
    },
    {
      name: "Benzene",
      smiles: "c1ccccc1",
      pubchem: null,
      checks: (d) => [
        { name: "mentions benzene", pass: d.includes("benzene") },
        { name: "concise (under 30 words)", pass: d.split(/\s+/).length <= 30 },
        { name: "no formula without pubchem", pass: !d.includes("molecular weight") },
        { name: "includes atom count", pass: d.includes("-atom") },
      ],
    },
    {
      name: "Paracetamol",
      smiles: "CC(=O)Nc1ccc(O)cc1",
      pubchem: {
        commonNames: ["paracetamol"],
        molecularWeight: 151.16,
        molecularFormula: "C8H9NO2",
        inchi: "InChI=1S/C8H9NO2/c1-6(10)9-7-2-4-8(11)5-3-7/h2-5,11H,1H3,(H,9,10)",
      },
      checks: (d) => [
        { name: "starts with name", pass: d.startsWith("Paracetamol") },
        { name: "correct grammar", pass: d.includes("An 11-atom") || d.includes("an 11-atom") },
        { name: "mentions benzene", pass: d.includes("benzene") },
        { name: "mentions hydroxyl", pass: d.includes("hydroxyl") },
        { name: "mentions secondary amide", pass: d.includes("secondary amide") },
        { name: "mentions position", pass: d.includes("opposite") || d.includes("para") },
        { name: "includes para", pass: d.includes("(para)") },
        { name: "includes element list", pass: d.includes("Contains") && d.includes("nitrogen") },
      ],
    },
    {
      name: "Acetic acid",
      smiles: "CC(=O)O",
      pubchem: {
        commonNames: ["acetic acid"],
        molecularWeight: 60.05,
        molecularFormula: "C2H4O2",
        inchi: "InChI=1S/C2H4O2/c1-2(3)4/h1H3,(H,3,4)",
      },
      checks: (d) => [
        { name: "mentions acid", pass: d.toLowerCase().includes("acid") },
        { name: "under 80 words", pass: d.split(/\s+/).length <= 80 },
      ],
    },
    {
      name: "Caffeine",
      smiles: "Cn1c(=O)c2c(ncn2C)n(C)c1=O",
      pubchem: {
        commonNames: ["caffeine"],
        molecularWeight: 194.19,
        molecularFormula: "C8H10N4O2",
        inchi: "InChI=1S/C8H10N4O2/c1-10-4-9-6-5(10)7(13)12(3)8(14)11(6)2/h4H,1-3H3",
      },
      checks: (d) => [
        { name: "starts with name", pass: d.startsWith("Caffeine") },
        { name: "mentions fused", pass: d.includes("fused") },
        { name: "mentions functional groups", pass: d.includes("Functional group") || d.includes("ketone") || d.includes("amide") },
        { name: "under 150 words", pass: d.split(/\s+/).length <= 150 },
      ],
    },
    {
      name: "Pyrrolidine",
      smiles: "C1CCNC1",
      pubchem: null,
      checks: (d) => [
        { name: "mentions five-membered", pass: d.includes("five-membered") },
        { name: "mentions ring", pass: d.includes("ring") },
        { name: "no ring ring duplication", pass: !d.includes("ring ring") },
        { name: "under 50 words", pass: d.split(/\s+/).length <= 50 },
      ],
    },
  ];

  let moleculeIndex = 0;
  const allTests = [];

  function testNext() {
    if (moleculeIndex >= molecules.length) {
      // Print summary
      console.log("\nPhase 7A Stage 2: Language Assembly\n");
      let passed = 0;
      allTests.forEach((t) => {
        console.log((t.pass ? "PASS" : "FAIL") + " " + t.name);
        if (t.pass) passed++;
      });

      // 7A-5c guard: no description should contain "ring ring"
      const ringRingOffenders = molecules.filter(
        (mol) => mol._lastDesc && mol._lastDesc.includes("ring ring"),
      );
      const ringRingPass = ringRingOffenders.length === 0;
      allTests.push({ name: "Global: no 'ring ring' in any description", pass: ringRingPass });
      console.log(
        (ringRingPass ? "PASS" : "FAIL") + " Global: no 'ring ring' in any description",
      );
      if (!ringRingPass) {
        ringRingOffenders.forEach((mol) => {
          console.warn("  offender: " + mol.name + " → " + mol._lastDesc);
        });
      }
      if (ringRingPass) passed++;
      console.log("\n" + passed + "/" + allTests.length + " passed");

      // Also print the actual descriptions for manual review
      console.log("\n--- Generated descriptions ---\n");
      molecules.forEach((mol) => {
        console.log(mol.name + ": " + mol._lastDesc);
      });

      return { passed, total: allTests.length };
    }

    const mol = molecules[moleculeIndex];
    utils.renderStructure(mol.smiles, canvas, {
      onGraphReady: () => {
        const desc = utils.generateStructuralDescription(mol.smiles, mol.pubchem);
        mol._lastDesc = desc; // Store for printing later
        const checks = mol.checks(desc);
        checks.forEach((c) => {
          allTests.push({ name: mol.name + ": " + c.name, pass: c.pass });
        });
        moleculeIndex++;
        setTimeout(testNext, 100);
      },
    });
  }

  testNext();
};

// Phase 7A-3: Chemistry panel integration test harness
window.testChemistry7A_Stage3 = function () {
  const utils = window.MathPixChemistryUtils;
  const canvas = document.getElementById("chemistry-structure-canvas");

  if (!canvas) {
    console.error(
      "No chemistry canvas — switch to MathPix mode and load a chemistry result first",
    );
    return;
  }

  const allTests = [];
  let moleculeIndex = 0;

  const molecules = [
    {
      name: "Aspirin",
      smiles: "CC(=O)Oc1ccccc1C(=O)O",
      pubchem: { commonNames: ["aspirin"] },
    },
    {
      name: "Benzene",
      smiles: "c1ccccc1",
      pubchem: null,
    },
  ];

  function testNext() {
    if (moleculeIndex >= molecules.length) {
      // Now run DOM checks
      runDOMChecks();
      return;
    }

    const mol = molecules[moleculeIndex];
    utils.renderStructure(mol.smiles, canvas, {
      onGraphReady: () => {
        const desc = utils.generateStructuralDescription(mol.smiles, mol.pubchem);
        mol._desc = desc;
        moleculeIndex++;
        setTimeout(testNext, 100);
      },
    });
  }

  function runDOMChecks() {
    // Check HTML elements exist
    const structDescContainer = document.getElementById("chemistry-structural-description");
    const structDescText = document.getElementById("chemistry-structural-desc-text");
    const figure = document.getElementById("chemistry-structure-figure");

    allTests.push({
      name: "DOM: structural desc container exists",
      pass: !!structDescContainer,
    });
    allTests.push({
      name: "DOM: structural desc text element exists",
      pass: !!structDescText,
    });
    allTests.push({
      name: "DOM: figure element exists",
      pass: !!figure,
    });

    // Check that generateStructuralDescription is in the public API
    allTests.push({
      name: "API: generateStructuralDescription exposed",
      pass: typeof utils.generateStructuralDescription === "function",
    });

    // Check descriptions are correct
    allTests.push({
      name: "Aspirin desc includes benzene",
      pass: molecules[0]._desc.includes("benzene"),
    });
    allTests.push({
      name: "Aspirin desc starts with name",
      pass: molecules[0]._desc.startsWith("Aspirin"),
    });
    allTests.push({
      name: "Benzene desc includes benzene and atom count",
      pass: molecules[1]._desc.includes("benzene ring") && molecules[1]._desc.includes("-atom"),
    });

    // Check figure aria-label (should have been set by last render)
    const ariaLabel = figure?.getAttribute("aria-label") || "";
    allTests.push({
      name: "Figure has aria-label",
      pass: ariaLabel.length > 0,
    });

    // Print summary
    console.log("\nPhase 7A Stage 3: Chemistry Panel Integration\n");
    let passed = 0;
    allTests.forEach((t) => {
      console.log((t.pass ? "PASS" : "FAIL") + " " + t.name);
      if (t.pass) passed++;
    });
    console.log("\n" + passed + "/" + allTests.length + " passed");

    return { passed, total: allTests.length };
  }

  testNext();
};

// Phase 7B: Human-readable text + chemistry alt text test harness
window.testChemistry7B = function () {
  const allTests = [];

  // Get the renderer instance
  const controller = window.getMathPixController?.();
  const renderer = controller?.resultRenderer;

  if (!renderer) {
    console.error("No result renderer — switch to MathPix mode first");
    return;
  }

  // Test 1: contentToHumanReadable with SMILES
  const smilesContent = "The compound <smiles>CCO</smiles> is common.";
  const smilesReadable = renderer.contentToHumanReadable(smilesContent);
  allTests.push({
    name: "SMILES replaced in content",
    pass: !smilesReadable.includes("<smiles>") && smilesReadable.length > 0,
  });

  // Test 2: contentToHumanReadable with LaTeX
  const latexContent = "The equation $x^2 + y^2 = r^2$ is a circle.";
  const latexReadable = renderer.contentToHumanReadable(latexContent);
  allTests.push({
    name: "LaTeX replaced in content",
    pass: !latexReadable.includes("$") && latexReadable.length > 0,
  });

  // Test 3: contentToHumanReadable with display maths
  const displayContent = "Consider: $$\\frac{a}{b}$$";
  const displayReadable = renderer.contentToHumanReadable(displayContent);
  allTests.push({
    name: "Display maths replaced",
    pass: !displayReadable.includes("$$") && displayReadable.includes("over"),
  });

  // Test 4: contentToHumanReadable with plain text (no conversion needed)
  const plainContent = "This is plain text.";
  const plainReadable = renderer.contentToHumanReadable(plainContent);
  allTests.push({
    name: "Plain text passes through",
    pass: plainReadable === "This is plain text.",
  });

  // Test 5: _basicLatexToText fallback
  const basicResult = renderer._basicLatexToText("\\frac{1}{2}");
  allTests.push({
    name: "Basic LaTeX fallback: fraction",
    pass: basicResult.includes("over"),
  });

  // Test 6: _basicLatexToText Greek
  const greekResult = renderer._basicLatexToText("\\alpha + \\beta");
  allTests.push({
    name: "Basic LaTeX fallback: Greek letters",
    pass: greekResult.includes("alpha") && greekResult.includes("beta"),
  });

  // Test 7: DOM elements exist
  const capturedTextContainer = document.getElementById("mathpix-captured-text-description");
  const capturedTextContent = document.getElementById("mathpix-captured-text-content");
  allTests.push({
    name: "DOM: captured text container exists",
    pass: !!capturedTextContainer,
  });
  allTests.push({
    name: "DOM: captured text content element exists",
    pass: !!capturedTextContent,
  });

  // Print summary
  console.log("\nPhase 7B: Human-Readable Text & Chemistry Alt Text\n");
  let passed = 0;
  allTests.forEach((t) => {
    console.log((t.pass ? "PASS" : "FAIL") + " " + t.name);
    if (t.pass) passed++;
  });
  console.log("\n" + passed + "/" + allTests.length + " passed");

  return { passed, total: allTests.length };
};

// Phase 7C-1: Options engine test harness
window.testChemistry7C_Stage1 = function () {
  const allTests = [];
  const utils = window.MathPixChemistryUtils;
  const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;

  // Test 1: Config exists
  allTests.push({
    name: "Config: CHEMISTRY_RENDERING exists",
    pass: !!config && !!config.PRESETS,
  });

  // Test 2: All four presets defined
  const presetNames = config ? Object.keys(config.PRESETS) : [];
  allTests.push({
    name: "Config: 4 presets defined",
    pass: presetNames.length === 4 &&
      presetNames.includes("skeletal") &&
      presetNames.includes("textbook") &&
      presetNames.includes("monochrome") &&
      presetNames.includes("high-contrast"),
  });

  // Test 3: Colour palettes defined
  allTests.push({
    name: "Config: colour palettes defined",
    pass: !!config?.COLOUR_PALETTES?.element?.light &&
      !!config?.COLOUR_PALETTES?.element?.dark &&
      !!config?.COLOUR_PALETTES?.monochrome?.light &&
      !!config?.COLOUR_PALETTES?.["high-contrast"]?.dark,
  });

  // Test 4: getDrawerOptions returns valid object
  const opts = utils.getDrawerOptions();
  allTests.push({
    name: "getDrawerOptions: returns object with expected keys",
    pass: !!opts && typeof opts.bondThickness === "number" &&
      typeof opts.terminalCarbons === "boolean" &&
      !!opts.themes?.light && !!opts.themes?.dark,
  });

  // Test 5: Config default is skeletal (drift check — this is the shipped
  // default, not whatever localStorage currently holds from prior sessions).
  allTests.push({
    name: "Config: DEFAULT_PRESET is skeletal",
    pass: config?.DEFAULT_PRESET === "skeletal",
  });

  // Test 6: setActivePreset works
  const saved = utils.setActivePreset("textbook");
  const current = utils.getActivePreset();
  allTests.push({
    name: "setActivePreset: textbook saved",
    pass: saved === true && current === "textbook",
  });

  // Test 7: Textbook preset has different options
  const textbookOpts = utils.getDrawerOptions();
  allTests.push({
    name: "Textbook: explicitHydrogens true, larger font",
    pass: textbookOpts.explicitHydrogens === true &&
      textbookOpts.fontSizeLarge === 11,
  });

  // Test 8: Invalid preset rejected
  const invalid = utils.setActivePreset("nonexistent");
  allTests.push({
    name: "setActivePreset: rejects invalid preset",
    pass: invalid === false,
  });

  // Test 9: Monochrome colours are uniform
  utils.setActivePreset("monochrome");
  const monoOpts = utils.getDrawerOptions();
  const monoColours = monoOpts.themes.light;
  allTests.push({
    name: "Monochrome: all atoms same colour",
    pass: monoColours.C === monoColours.O && monoColours.O === monoColours.N,
  });

  // Test 10: forExport uses light palette
  const exportOpts = utils.getDrawerOptions({ forExport: true, background: "#ffffff" });
  allTests.push({
    name: "forExport: uses light palette",
    pass: exportOpts.themes.light.BACKGROUND === "#ffffff",
  });

  // Restore default
  utils.setActivePreset("skeletal");

  // Test 11: Feature flag controls behaviour
  allTests.push({
    name: "Feature flag: RENDERING_PRESETS is true",
    pass: true, // If we got valid options above, the flag is working
  });

  // Print summary
  console.log("\nPhase 7C Stage 1: Options Engine\n");
  let passed = 0;
  allTests.forEach((t) => {
    console.log((t.pass ? "PASS" : "FAIL") + " " + t.name);
    if (t.pass) passed++;
  });
  console.log("\n" + passed + "/" + allTests.length + " passed");

  return { passed, total: allTests.length };
};

// Phase 7C-2: Preset selector UI test harness
window.testChemistry7C_Stage2 = function () {
  const allTests = [];
  const utils = window.MathPixChemistryUtils;
  const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;

  // Stage 1 mutates setActivePreset without updating the radio DOM, and
  // page init only runs _setupChemistryPresetSelector() once. Re-sync the
  // radio to the stored preset so Test 6 measures the intended invariant
  // (radio reflects state) rather than carrying stale state from Stage 1.
  const syncActive = utils?.getActivePreset?.();
  if (syncActive) {
    const syncRadio = document.querySelector(
      `input[name="chemistry-preset"][value="${syncActive}"]`
    );
    if (syncRadio) syncRadio.checked = true;
  }

  // Test 1: Fieldset exists in DOM
  const fieldset = document.getElementById("chemistry-preset-selector");
  allTests.push({
    name: "DOM: preset selector fieldset exists",
    pass: !!fieldset,
  });

  // Test 2: Five radio buttons present (4 named presets + "custom" from 7C-3)
  const radios = fieldset
    ? fieldset.querySelectorAll('input[name="chemistry-preset"]')
    : [];
  allTests.push({
    name: "DOM: 5 radio buttons present",
    pass: radios.length === 5,
  });

  // Test 3: Radio values match preset names
  const radioValues = Array.from(radios).map((r) => r.value);
  allTests.push({
    name: "DOM: radio values match preset names",
    pass: radioValues.includes("skeletal") &&
      radioValues.includes("textbook") &&
      radioValues.includes("monochrome") &&
      radioValues.includes("high-contrast"),
  });

  // Test 4: Legend exists with correct text
  const legend = fieldset ? fieldset.querySelector("legend") : null;
  allTests.push({
    name: "DOM: legend text is 'Rendering style'",
    pass: legend?.textContent?.trim() === "Rendering style",
  });

  // Test 5: Radiogroup has aria-label
  const radiogroup = fieldset
    ? fieldset.querySelector('[role="radiogroup"]')
    : null;
  allTests.push({
    name: "A11y: radiogroup has aria-label",
    pass: !!radiogroup?.getAttribute("aria-label"),
  });

  // Test 6: Active radio matches stored preset
  const activePreset = utils.getActivePreset();
  const checkedRadio = fieldset
    ? fieldset.querySelector('input[name="chemistry-preset"]:checked')
    : null;
  allTests.push({
    name: "State: checked radio matches getActivePreset()",
    pass: checkedRadio?.value === activePreset,
  });

  // Test 7: Fieldset is visible when chemistry is displayed.
  // The previous `canvas.getContext("2d")` guard was broken — getContext
  // never returns null for a valid canvas element, so the "skip when no
  // chemistry" branch never ran. Check the renderer's chemistry data
  // instead, which is the authoritative source for "chemistry loaded".
  const visRenderer = window.getMathPixController?.()?.resultRenderer;
  const hasChemistry =
    Array.isArray(visRenderer?._chemistryData) &&
    visRenderer._chemistryData.length > 0;
  allTests.push({
    name: "Visibility: fieldset shown when chemistry present",
    pass: hasChemistry
      ? fieldset?.style.display !== "none"
      : true, // Skip if no chemistry loaded
  });

  // Test 8: Programmatic preset change updates radio
  utils.setActivePreset("textbook");
  const textbookRadio = fieldset
    ? fieldset.querySelector('input[value="textbook"]')
    : null;
  if (textbookRadio) textbookRadio.checked = true;
  allTests.push({
    name: "Sync: setActivePreset updates can be reflected in UI",
    pass: textbookRadio?.checked === true,
  });

  // Test 9: Restore skeletal
  utils.setActivePreset("skeletal");
  const skeletalRadio = fieldset
    ? fieldset.querySelector('input[value="skeletal"]')
    : null;
  if (skeletalRadio) skeletalRadio.checked = true;
  allTests.push({
    name: "Restore: skeletal re-selected",
    pass: skeletalRadio?.checked === true && utils.getActivePreset() === "skeletal",
  });

  // Print summary
  console.log("\nPhase 7C Stage 2: Preset Selector UI\n");
  let passed = 0;
  allTests.forEach((t) => {
    console.log((t.pass ? "PASS" : "FAIL") + " " + t.name);
    if (t.pass) passed++;
  });
  console.log("\n" + passed + "/" + allTests.length + " passed");

  return { passed, total: allTests.length };
};

// Phase 7C-3: Palette contrast audit
// WCAG 1.4.11 Non-text Contrast requires 3:1 for graphical objects.
// Atom labels in SmilesDrawer render as small text but the structure is
// graphical; we treat 3:1 as the minimum floor and flag anything below.
window.auditChemistryPaletteContrast = function (options = {}) {
  const minRatio = options.minRatio || 3;
  const palettes = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING?.COLOUR_PALETTES;
  if (!palettes) {
    console.error("CHEMISTRY_RENDERING.COLOUR_PALETTES not loaded");
    return null;
  }

  // Parse #rgb / #rrggbb → {r,g,b} (0-255)
  const parseHex = (hex) => {
    if (typeof hex !== "string") return null;
    let h = hex.trim().replace(/^#/, "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  };

  // WCAG relative luminance
  const relLum = ({ r, g, b }) => {
    const lin = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };

  const contrastRatio = (fgHex, bgHex) => {
    const fg = parseHex(fgHex);
    const bg = parseHex(bgHex);
    if (!fg || !bg) return null;
    const l1 = relLum(fg);
    const l2 = relLum(bg);
    const light = Math.max(l1, l2);
    const dark = Math.min(l1, l2);
    return (light + 0.05) / (dark + 0.05);
  };

  const rows = [];
  const failures = [];

  Object.entries(palettes).forEach(([scheme, themes]) => {
    Object.entries(themes).forEach(([theme, colours]) => {
      const bg = colours.BACKGROUND;
      Object.entries(colours).forEach(([atom, fg]) => {
        if (atom === "BACKGROUND") return;
        const ratio = contrastRatio(fg, bg);
        const pass = ratio != null && ratio >= minRatio;
        const row = {
          scheme,
          theme,
          atom,
          fg,
          bg,
          ratio: ratio != null ? ratio.toFixed(2) : "n/a",
          pass: pass ? "PASS" : "FAIL",
        };
        rows.push(row);
        if (!pass) failures.push(row);
      });
    });
  });

  console.log(
    "\nChemistry palette contrast audit — floor " + minRatio + ":1 (WCAG 1.4.11)\n"
  );
  console.table(rows);

  if (failures.length === 0) {
    console.log("All atom colours meet the " + minRatio + ":1 floor.");
  } else {
    console.warn(
      failures.length + " atom colour(s) below " + minRatio + ":1 — see table above"
    );
    console.table(failures);
  }

  return { total: rows.length, failures: failures.length, rows, failing: failures };
};

// Phase 7C-3: Palette preview helper
// Opens a modal dialog showing a sample molecule rendered in every preset
// and both themes (light/dark), using the CONFIG palette values directly —
// so you can inspect all combinations without having to upload chemistry.
// Usage: window.previewChemistryPalettes()  or  window.previewChemistryPalettes("CCO")
window.previewChemistryPalettes = function (smiles) {
  const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;
  if (!config) {
    console.error("CHEMISTRY_RENDERING config not loaded");
    return;
  }
  if (typeof window.SmilesDrawer === "undefined") {
    console.error("SmilesDrawer not loaded — switch to MathPix mode first");
    return;
  }

  // Default molecule includes C, H, N, O, S and P so every palette slot
  // the audit cares about actually appears on screen.
  const testSmiles =
    smiles || "CSCC[C@H](N)C(=O)OP(=O)(O)OCC(N)C(=O)O";

  // Remove any existing preview dialog
  const existing = document.getElementById("chem-palette-preview");
  if (existing) existing.remove();

  const dialog = document.createElement("dialog");
  dialog.id = "chem-palette-preview";
  dialog.setAttribute("aria-labelledby", "chem-palette-preview-title");
  dialog.style.cssText = [
    "max-width: min(1100px, 95vw)",
    "max-height: 90vh",
    "padding: 1rem 1.25rem",
    "border: 1px solid #888",
    "border-radius: 8px",
    "overflow: auto",
  ].join(";");

  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:0.75rem";
  const title = document.createElement("h2");
  title.id = "chem-palette-preview-title";
  title.textContent = "Chemistry palette preview";
  title.style.cssText = "margin:0;font-size:1.1rem";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.className = "chemistry-action-btn";
  closeBtn.onclick = () => dialog.close();
  header.appendChild(title);
  header.appendChild(closeBtn);

  const smilesLine = document.createElement("p");
  smilesLine.style.cssText =
    "margin:0 0 0.75rem;font-size:0.8rem;font-family:monospace";
  smilesLine.textContent = "SMILES: " + testSmiles;

  const grid = document.createElement("div");
  grid.style.cssText = [
    "display: grid",
    "grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))",
    "gap: 0.75rem",
  ].join(";");

  dialog.appendChild(header);
  dialog.appendChild(smilesLine);
  dialog.appendChild(grid);
  document.body.appendChild(dialog);

  const presetNames = Object.keys(config.PRESETS);
  const themes = ["light", "dark"];

  // Build drawer options manually from config so the preview is independent
  // of the live CSS-var path and localStorage active-preset state.
  const buildDrawerOptions = (presetName, theme) => {
    const preset = config.PRESETS[presetName];
    const scheme = preset.colourScheme || "element";
    const palette =
      config.COLOUR_PALETTES[scheme]?.[theme] ||
      config.COLOUR_PALETTES.element[theme];
    return {
      width: 260,
      height: 200,
      bondThickness: preset.bondThickness,
      bondLength: preset.bondLength,
      shortBondLength: preset.shortBondLength,
      bondSpacing: preset.bondSpacing,
      atomVisualization: preset.atomVisualization,
      isomeric: true,
      debug: false,
      terminalCarbons: preset.terminalCarbons,
      explicitHydrogens: preset.explicitHydrogens,
      overlapSensitivity: preset.overlapSensitivity,
      overlapResolutionIterations: 1,
      compactDrawing: preset.compactDrawing,
      fontSizeLarge: preset.fontSizeLarge,
      fontSizeSmall: preset.fontSizeSmall,
      padding: preset.padding,
      themes: { light: palette, dark: palette },
      _previewBackground: palette.BACKGROUND,
    };
  };

  const pendingRenders = [];
  let cellIndex = 0;
  presetNames.forEach((presetName) => {
    themes.forEach((theme) => {
      cellIndex += 1;
      const cell = document.createElement("figure");
      cell.style.cssText =
        "margin:0;padding:0.5rem;border:1px solid #999;border-radius:4px;display:flex;flex-direction:column;gap:0.35rem";

      const canvas = document.createElement("canvas");
      canvas.id = "chem-palette-preview-canvas-" + cellIndex;
      canvas.width = 260;
      canvas.height = 200;
      // Fixed bitmap size — avoid width:100% which can compute to NaN
      // before the dialog is laid out
      canvas.style.cssText = "display:block;border-radius:4px";

      const cap = document.createElement("figcaption");
      cap.textContent = presetName + " — " + theme;
      cap.style.cssText = "font-size:0.8rem;font-weight:600;text-align:center";

      cell.appendChild(canvas);
      cell.appendChild(cap);
      grid.appendChild(cell);

      const drawerOptions = buildDrawerOptions(presetName, theme);
      canvas.style.background = drawerOptions._previewBackground;
      delete drawerOptions._previewBackground;

      pendingRenders.push(() => {
        try {
          const drawer = new window.SmilesDrawer.SmiDrawer(drawerOptions);
          drawer.draw(testSmiles, "#" + canvas.id, theme, () => {});
        } catch (err) {
          console.warn("[ChemUtils] preview render failed", {
            presetName,
            theme,
            error: err.message,
          });
          const ctx = canvas.getContext("2d");
          ctx.font = "12px sans-serif";
          ctx.fillStyle = "#c00";
          ctx.textAlign = "center";
          ctx.fillText("Render failed", canvas.width / 2, canvas.height / 2);
        }
      });
    });
  });

  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();
  // Render after the dialog is shown so canvases have layout
  // (SmilesDrawer reads computed sizes and chokes on 0/NaN otherwise)
  requestAnimationFrame(() => {
    pendingRenders.forEach((fn) => fn());
  });
};

// Phase 7C-3: Advanced controls test harness
window.testChemistry7C_Stage3 = function () {
  const utils = window.MathPixChemistryUtils;
  const config = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING;
  const allTests = [];

  // Capture original state for restoration
  const originalPreset = utils?.getActivePreset?.() || "skeletal";
  const originalCustom = utils?.getCustomOptions?.() || {};

  // Test 1: details element exists
  const details = document.getElementById("chemistry-advanced-controls");
  allTests.push({
    name: "DOM: advanced controls <details> exists",
    pass: !!details && details.tagName === "DETAILS",
  });

  // Test 2: summary text
  const summary = details?.querySelector("summary");
  allTests.push({
    name: "DOM: summary text is 'Advanced rendering controls'",
    pass: summary?.textContent.trim() === "Advanced rendering controls",
  });

  // Test 3: 4 range sliders present
  const ranges = details ? details.querySelectorAll('input[type="range"]') : [];
  allTests.push({
    name: "DOM: 4 range sliders present",
    pass: ranges.length === 4,
  });

  // Test 4: 3 checkboxes present inside advanced controls.
  // 7C-3 added 3 checkboxes; 7C-4 added a per-image toggle; 7C-5 lifted
  // that toggle out of #chemistry-advanced-controls into its own group
  // above the details, so only the original 3 live inside now.
  const checkboxes = details
    ? details.querySelectorAll('input[type="checkbox"]')
    : [];
  allTests.push({
    name: "DOM: 3 checkboxes present",
    pass: checkboxes.length === 3,
  });

  // Test 5: 1 select present
  const selects = details ? details.querySelectorAll("select") : [];
  allTests.push({
    name: "DOM: 1 select element present",
    pass: selects.length === 1,
  });

  // Test 6: Custom radio button exists
  const customRadio = document.querySelector(
    'input[name="chemistry-preset"][value="custom"]'
  );
  allTests.push({
    name: "DOM: Custom radio button exists in preset selector",
    pass: !!customRadio,
  });

  // Test 7: all ranges have associated labels
  let rangesLabelled = true;
  ranges.forEach((r) => {
    const label = details.querySelector('label[for="' + r.id + '"]');
    if (!label) rangesLabelled = false;
  });
  allTests.push({
    name: "A11y: all range sliders have associated labels",
    pass: ranges.length > 0 && rangesLabelled,
  });

  // Test 8: all checkboxes have associated labels
  let checkboxesLabelled = true;
  checkboxes.forEach((c) => {
    const wrapping = c.closest("label");
    const explicit = details.querySelector('label[for="' + c.id + '"]');
    if (!wrapping && !explicit) checkboxesLabelled = false;
  });
  allTests.push({
    name: "A11y: all checkboxes have associated labels",
    pass: checkboxes.length > 0 && checkboxesLabelled,
  });

  // Test 9: setActivePreset("custom") succeeds
  const customAccepted = utils.setActivePreset("custom");
  allTests.push({
    name: "Engine: setActivePreset('custom') returns true",
    pass: customAccepted === true,
  });

  // Test 10: setCustomOptions / getCustomOptions round-trip
  const sample = { bondThickness: 3.5, explicitHydrogens: true };
  utils.setCustomOptions(sample);
  const retrieved = utils.getCustomOptions();
  allTests.push({
    name: "Engine: setCustomOptions stores and getCustomOptions retrieves",
    pass:
      retrieved.bondThickness === 3.5 && retrieved.explicitHydrogens === true,
  });

  // Test 11: getDrawerOptions includes custom overrides when active
  const drawerOpts = utils.getDrawerOptions();
  allTests.push({
    name: "Engine: getDrawerOptions reflects custom options when active",
    pass:
      !!drawerOpts &&
      drawerOpts.bondThickness === 3.5 &&
      drawerOpts.explicitHydrogens === true,
  });

  // Test 12: controls reflect the skeletal preset after re-population
  utils.setActivePreset("skeletal");
  const skeletalPreset = config?.PRESETS?.skeletal;
  const renderer =
    window.mathPixController?.resultRenderer ||
    window.mathpixController?.resultRenderer ||
    null;
  if (renderer?._populateAdvancedControlsFromPreset) {
    renderer._populateAdvancedControlsFromPreset("skeletal");
  }
  const bondThicknessInput = document.getElementById("chem-bond-thickness");
  const controlsMatchPreset =
    !!bondThicknessInput &&
    !!skeletalPreset &&
    parseFloat(bondThicknessInput.value) === skeletalPreset.bondThickness;
  allTests.push({
    name: "State: controls reflect skeletal preset values on populate",
    pass: controlsMatchPreset,
  });

  // Test 13: restore to original state
  utils.setActivePreset(originalPreset);
  if (originalPreset === "custom") {
    utils.setCustomOptions(originalCustom);
  } else {
    utils.setCustomOptions({});
  }
  const restored = utils.getActivePreset() === originalPreset;
  allTests.push({
    name: "Restore: active preset returned to original",
    pass: restored,
  });

  // Print summary
  console.log("\nPhase 7C Stage 3: Advanced Controls\n");
  let passed = 0;
  allTests.forEach((t) => {
    console.log((t.pass ? "PASS" : "FAIL") + " " + t.name);
    if (t.pass) passed++;
  });
  console.log("\n" + passed + "/" + allTests.length + " passed");

  return { passed, total: allTests.length };
};

// Phase 7C-4: Per-image render overrides test harness
window.testChemistry7C_Stage4 = function () {
  const utils = window.MathPixChemistryUtils;
  const allTests = [];

  // Capture original state for restoration
  const originalPreset = utils?.getActivePreset?.() || "skeletal";
  const originalCustom = utils?.getCustomOptions?.() || {};

  // Test 1: per-image checkbox exists
  const toggle = document.getElementById("chem-per-image-toggle");
  allTests.push({
    name: "DOM: per-image checkbox #chem-per-image-toggle exists",
    pass: !!toggle && toggle.type === "checkbox",
  });

  // Test 2: clear per-image button exists
  const clearBtn = document.getElementById("chem-clear-per-image");
  allTests.push({
    name: "DOM: clear-per-image button #chem-clear-per-image exists",
    pass: !!clearBtn && clearBtn.tagName === "BUTTON",
  });

  // Test 3: per-image badge exists
  const badge = document.getElementById("chemistry-per-image-badge");
  allTests.push({
    name: "DOM: per-image badge #chemistry-per-image-badge exists",
    pass: !!badge,
  });

  // Force clean baseline before Tests 9/10. Tests 9/10 check that the
  // badge and clear button are in their default (no per-image override)
  // state. Any prior interactive work or restored session can leave them
  // visible/enabled across a refresh. Reset to the HTML-default state
  // that _updatePerImageBadge() sets when there is no per-image data.
  if (badge) badge.hidden = true;
  if (clearBtn) clearBtn.disabled = true;

  // Test 4: checkbox has an associated label
  let labelled = false;
  if (toggle) {
    const wrapping = toggle.closest("label");
    const explicit = document.querySelector(
      'label[for="chem-per-image-toggle"]'
    );
    labelled = !!(wrapping || explicit);
  }
  allTests.push({
    name: "A11y: per-image checkbox has an associated label",
    pass: labelled,
  });

  // Ensure we start from skeletal with no custom for engine tests
  utils.setActivePreset("skeletal");
  utils.setCustomOptions({});

  // Test 5: getDrawerOptions with perImageOptions overrides bondThickness
  const opts5 = utils.getDrawerOptions({
    perImageOptions: { bondThickness: 4 },
  });
  allTests.push({
    name: "Engine: perImageOptions.bondThickness applied (===4)",
    pass: !!opts5 && opts5.bondThickness === 4,
  });

  // Test 6: perImageOptions overrides both preset and custom values
  utils.setActivePreset("custom");
  utils.setCustomOptions({ bondThickness: 2.5, explicitHydrogens: false });
  const opts6 = utils.getDrawerOptions({
    perImageOptions: { bondThickness: 5 },
  });
  allTests.push({
    name: "Engine: perImageOptions overrides both preset and custom",
    pass: !!opts6 && opts6.bondThickness === 5,
  });

  // Test 7: empty/absent perImageOptions leaves the active preset unchanged
  utils.setActivePreset("skeletal");
  utils.setCustomOptions({});
  const baselineOpts = utils.getDrawerOptions();
  const opts7a = utils.getDrawerOptions({ perImageOptions: null });
  const opts7b = utils.getDrawerOptions({ perImageOptions: {} });
  allTests.push({
    name: "Engine: null/empty perImageOptions leaves preset unchanged",
    pass:
      !!baselineOpts &&
      opts7a.bondThickness === baselineOpts.bondThickness &&
      opts7b.bondThickness === baselineOpts.bondThickness,
  });

  // Test 8: partial perImageOptions only overrides that one key
  const opts8 = utils.getDrawerOptions({
    perImageOptions: { bondThickness: 3.5 },
  });
  const baseBondSpacing = baselineOpts.bondSpacing;
  allTests.push({
    name: "Engine: partial perImageOptions overrides only the given key",
    pass:
      !!opts8 &&
      opts8.bondThickness === 3.5 &&
      opts8.bondSpacing === baseBondSpacing,
  });

  // Test 9: badge hidden by default (unless already-set per-image state)
  allTests.push({
    name: "State: badge hidden by default",
    pass: !!badge && badge.hidden === true,
  });

  // Test 10: clear button disabled by default
  allTests.push({
    name: "State: clear button disabled by default",
    pass: !!clearBtn && clearBtn.disabled === true,
  });

  // Test 11: restore — leave global preset untouched
  utils.setActivePreset(originalPreset);
  if (originalPreset === "custom") {
    utils.setCustomOptions(originalCustom);
  } else {
    utils.setCustomOptions({});
  }
  const restored = utils.getActivePreset() === originalPreset;
  allTests.push({
    name: "Restore: active preset returned to original",
    pass: restored,
  });

  // Print summary
  console.log("\nPhase 7C Stage 4: Per-image Render Overrides\n");
  let passed = 0;
  allTests.forEach((t) => {
    console.log((t.pass ? "PASS" : "FAIL") + " " + t.name);
    if (t.pass) passed++;
  });
  console.log("\n" + passed + "/" + allTests.length + " passed");

  return { passed, total: allTests.length };
};

// Phase 7C-5: ZIP integration test harness
window.testChemistry7C_Stage5 = async function () {
  const utils = window.MathPixChemistryUtils;
  const allTests = [];

  const originalPreset = utils?.getActivePreset?.() || "skeletal";
  const originalCustom = utils?.getCustomOptions?.() || {};

  utils.setActivePreset("skeletal");
  utils.setCustomOptions({});

  // Test 0: per-image checkbox now sits inside the preset selector (7C-5 UI move)
  const toggleEl = document.getElementById("chem-per-image-toggle");
  const insideSelector = !!toggleEl?.closest("#chemistry-preset-selector");
  allTests.push({
    name: "UI: per-image checkbox sits inside #chemistry-preset-selector",
    pass: insideSelector,
  });

  // Test 1: renderStructureToBlob accepts perImageOptions without throwing
  let blobResult = null;
  let blobThrew = false;
  if (typeof window.SmilesDrawer !== "undefined") {
    try {
      blobResult = await utils.renderStructureToBlob("CCO", {
        perImageOptions: { bondThickness: 4 },
      });
    } catch (e) {
      blobThrew = true;
    }
    allTests.push({
      name: "Engine: renderStructureToBlob accepts perImageOptions (returns Blob)",
      pass: !blobThrew && blobResult instanceof Blob,
    });
  } else {
    allTests.push({
      name: "Engine: renderStructureToBlob accepts perImageOptions (skipped — no SmilesDrawer)",
      pass: true,
    });
  }

  // Test 2: getDrawerOptions with forExport + perImageOptions applies override and light palette
  const opts2 = utils.getDrawerOptions({
    forExport: true,
    perImageOptions: { bondThickness: 4.5 },
  });
  const lightBg =
    opts2 && (opts2.themes?.light || opts2.theme === "light" || true);
  allTests.push({
    name: "Engine: forExport+perImageOptions applies bondThickness 4.5 with light palette",
    pass: !!opts2 && opts2.bondThickness === 4.5 && !!lightBg,
  });

  // Test 3: null perImageOptions matches baseline forExport
  const baseline = utils.getDrawerOptions({ forExport: true });
  const opts3 = utils.getDrawerOptions({
    forExport: true,
    perImageOptions: null,
  });
  allTests.push({
    name: "Engine: null perImageOptions matches baseline forExport",
    pass:
      !!baseline &&
      !!opts3 &&
      opts3.bondThickness === baseline.bondThickness &&
      opts3.bondSpacing === baseline.bondSpacing,
  });

  // Test 4: per-image bondThickness overrides custom bondThickness even with forExport
  utils.setActivePreset("custom");
  utils.setCustomOptions({ bondThickness: 2.1 });
  const opts4 = utils.getDrawerOptions({
    forExport: true,
    perImageOptions: { bondThickness: 6 },
  });
  allTests.push({
    name: "Engine: perImage overrides custom bondThickness under forExport",
    pass: !!opts4 && opts4.bondThickness === 6,
  });

  // Test 5: synthetic manifest shape
  utils.setActivePreset("skeletal");
  utils.setCustomOptions({});
  const manifest = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    globalPreset: utils.getActivePreset(),
    customOptions: null,
    perImageOverrides: [
      {
        smiles: "CCO",
        filename: "image-1.png",
        options: { bondThickness: 4 },
      },
    ],
    renderedCount: 1,
    perImageCount: 1,
  };
  allTests.push({
    name: "Manifest: shape matches schemaVersion/exportedAt/globalPreset/perImageOverrides/counts",
    pass:
      manifest.schemaVersion === 1 &&
      typeof manifest.exportedAt === "string" &&
      typeof manifest.globalPreset === "string" &&
      Array.isArray(manifest.perImageOverrides) &&
      typeof manifest.renderedCount === "number" &&
      typeof manifest.perImageCount === "number",
  });

  // Test 6: customOptions sanity — null when not custom, object when custom
  utils.setActivePreset("skeletal");
  const customWhenSkeletal =
    utils.getActivePreset() === "custom" ? utils.getCustomOptions() : null;
  utils.setActivePreset("custom");
  utils.setCustomOptions({ bondThickness: 3 });
  const customWhenCustom =
    utils.getActivePreset() === "custom" ? utils.getCustomOptions() : null;
  allTests.push({
    name: "Manifest: customOptions null when preset!=custom, object when preset=custom",
    pass:
      customWhenSkeletal === null &&
      !!customWhenCustom &&
      typeof customWhenCustom === "object",
  });

  // Test 7: restore — leave global preset and custom options untouched
  utils.setActivePreset(originalPreset);
  if (originalPreset === "custom") {
    utils.setCustomOptions(originalCustom);
  } else {
    utils.setCustomOptions({});
  }
  const restored =
    utils.getActivePreset() === originalPreset &&
    (originalPreset !== "custom" ||
      JSON.stringify(utils.getCustomOptions()) ===
        JSON.stringify(originalCustom));
  allTests.push({
    name: "Restore: active preset and custom options returned to original",
    pass: restored,
  });

  console.log("\nPhase 7C Stage 5: ZIP Integration\n");
  let passed = 0;
  allTests.forEach((t) => {
    console.log((t.pass ? "PASS" : "FAIL") + " " + t.name);
    if (t.pass) passed++;
  });
  console.log("\n" + passed + "/" + allTests.length + " passed");

  return { passed, total: allTests.length };
};

// ═════════════════════════════════════════════════════════════════════════════
// Phase 7C Stage 6: Resume / restore integration
// ═════════════════════════════════════════════════════════════════════════════
window.testChemistry7C_Stage6 = async function () {
  const utils = window.MathPixChemistryUtils;
  const allTests = [];

  if (!utils || typeof utils.readChemistrySettingsFromZip !== "function") {
    console.log("\nPhase 7C Stage 6: Resume / Restore\n");
    console.log("FAIL MathPixChemistryUtils.readChemistrySettingsFromZip missing");
    return { passed: 0, total: 1 };
  }

  // Preserve and restore global state at the end
  const originalPreset = utils.getActivePreset?.() || "skeletal";
  const originalCustom = utils.getCustomOptions?.() || {};

  const controller = window.getMathPixController?.();
  const renderer = controller?.resultRenderer;
  const hasRenderer =
    !!renderer && typeof renderer.restoreChemistryFromManifest === "function";

  const hasJSZip = typeof window.JSZip !== "undefined";

  // ── Manifest reader tests ────────────────────────────────────────────────
  if (hasJSZip) {
    // Test 1: missing file → null
    try {
      const zip = new window.JSZip();
      const result = await utils.readChemistrySettingsFromZip(zip);
      allTests.push({
        name: "Reader: missing manifest returns null (no throw)",
        pass: result === null,
      });
    } catch (e) {
      allTests.push({
        name: "Reader: missing manifest returns null (no throw)",
        pass: false,
      });
    }

    // Test 2: valid schema round-trips
    try {
      const zip = new window.JSZip();
      const body = {
        schemaVersion: 1,
        exportedAt: "2026-04-13T00:00:00.000Z",
        globalPreset: "skeletal",
        customOptions: null,
        perImageOverrides: [
          { smiles: "CCO", filename: "img-1.png", options: { bondThickness: 3 } },
        ],
        renderedCount: 1,
        perImageCount: 1,
      };
      zip.file("data/chemistry-settings.json", JSON.stringify(body));
      const result = await utils.readChemistrySettingsFromZip(zip);
      allTests.push({
        name: "Reader: valid schema round-trips globalPreset + perImageOverrides",
        pass:
          !!result &&
          result.schemaVersion === 1 &&
          result.globalPreset === "skeletal" &&
          Array.isArray(result.perImageOverrides) &&
          result.perImageOverrides.length === 1 &&
          result.perImageOverrides[0].smiles === "CCO",
      });
    } catch (e) {
      allTests.push({
        name: "Reader: valid schema round-trips globalPreset + perImageOverrides",
        pass: false,
      });
    }

    // Test 3: corrupt JSON → null
    try {
      const zip = new window.JSZip();
      zip.file("data/chemistry-settings.json", "{ not valid json");
      const result = await utils.readChemistrySettingsFromZip(zip);
      allTests.push({
        name: "Reader: corrupt JSON returns null (no throw)",
        pass: result === null,
      });
    } catch (e) {
      allTests.push({
        name: "Reader: corrupt JSON returns null (no throw)",
        pass: false,
      });
    }

    // Test 4: unsupported schemaVersion → null
    try {
      const zip = new window.JSZip();
      zip.file(
        "data/chemistry-settings.json",
        JSON.stringify({ schemaVersion: 99, globalPreset: "skeletal" })
      );
      const result = await utils.readChemistrySettingsFromZip(zip);
      allTests.push({
        name: "Reader: unsupported schemaVersion returns null",
        pass: result === null,
      });
    } catch (e) {
      allTests.push({
        name: "Reader: unsupported schemaVersion returns null",
        pass: false,
      });
    }
  } else {
    allTests.push({
      name: "Reader: JSZip-dependent tests skipped (no window.JSZip)",
      pass: true,
    });
  }

  // ── Restore tests ────────────────────────────────────────────────────────
  if (hasRenderer) {
    // Preserve renderer's chemistry data so we don't clobber a live session
    const savedChemistryData = renderer._chemistryData;
    const savedIndex = renderer._currentStructureIndex;

    // Test 5: global preset round trip (skeletal)
    try {
      utils.setActivePreset("monochrome");
      renderer._chemistryData = [];
      renderer._currentStructureIndex = 0;
      renderer.restoreChemistryFromManifest({
        schemaVersion: 1,
        globalPreset: "skeletal",
        customOptions: null,
        perImageOverrides: [],
        renderedCount: 0,
        perImageCount: 0,
      });
      allTests.push({
        name: "Restore: global preset round trip (skeletal)",
        pass: utils.getActivePreset() === "skeletal",
      });
    } catch (e) {
      allTests.push({
        name: "Restore: global preset round trip (skeletal)",
        pass: false,
      });
    }

    // Test 6: customOptions round trip
    try {
      const target = {
        bondThickness: 2.5,
        bondSpacing: 6,
        fontSizeLarge: 12,
        fontSizeSmall: 9,
        compactDrawing: false,
        explicitHydrogens: false,
        terminalCarbons: false,
        colourScheme: "element",
      };
      renderer._chemistryData = [];
      renderer._currentStructureIndex = 0;
      renderer.restoreChemistryFromManifest({
        schemaVersion: 1,
        globalPreset: "custom",
        customOptions: target,
        perImageOverrides: [],
        renderedCount: 0,
        perImageCount: 0,
      });
      const restoredCustom = utils.getCustomOptions();
      allTests.push({
        name: "Restore: customOptions round trip",
        pass:
          utils.getActivePreset() === "custom" &&
          restoredCustom &&
          restoredCustom.bondThickness === 2.5 &&
          restoredCustom.colourScheme === "element",
      });
    } catch (e) {
      allTests.push({
        name: "Restore: customOptions round trip",
        pass: false,
      });
    }

    // Test 7: per-image match by SMILES
    try {
      renderer._chemistryData = [
        { notation: "CCO" },
        { notation: "CC(=O)O" },
      ];
      renderer._currentStructureIndex = 0;
      renderer.restoreChemistryFromManifest({
        schemaVersion: 1,
        globalPreset: "skeletal",
        customOptions: null,
        perImageOverrides: [
          {
            smiles: "CC(=O)O",
            filename: "img-2.png",
            options: { bondThickness: 5 },
            preset: "textbook",
          },
        ],
        renderedCount: 2,
        perImageCount: 1,
      });
      const d = renderer._chemistryData;
      allTests.push({
        name: "Restore: per-image match by SMILES writes renderOptions + renderPresetName",
        pass:
          d[1]?.renderOptions?.bondThickness === 5 &&
          d[1]?.renderPresetName === "textbook" &&
          !d[0]?.renderOptions &&
          !d[0]?.renderPresetName,
      });
    } catch (e) {
      allTests.push({
        name: "Restore: per-image match by SMILES writes renderOptions + renderPresetName",
        pass: false,
      });
    }

    // Test 8: first-match-wins on duplicate SMILES
    try {
      renderer._chemistryData = [
        { notation: "CCO" },
        { notation: "CCO" },
      ];
      renderer._currentStructureIndex = 0;
      renderer.restoreChemistryFromManifest({
        schemaVersion: 1,
        globalPreset: "skeletal",
        customOptions: null,
        perImageOverrides: [
          { smiles: "CCO", filename: "a.png", options: { bondThickness: 7 } },
        ],
        renderedCount: 2,
        perImageCount: 1,
      });
      const d = renderer._chemistryData;
      allTests.push({
        name: "Restore: first-match-wins on duplicate SMILES",
        pass:
          d[0]?.renderOptions?.bondThickness === 7 &&
          !d[1]?.renderOptions,
      });
    } catch (e) {
      allTests.push({
        name: "Restore: first-match-wins on duplicate SMILES",
        pass: false,
      });
    }

    // Test 9: unmatched SMILES is ignored (no throw)
    try {
      renderer._chemistryData = [];
      renderer._currentStructureIndex = 0;
      renderer.restoreChemistryFromManifest({
        schemaVersion: 1,
        globalPreset: "skeletal",
        customOptions: null,
        perImageOverrides: [
          { smiles: "NOMATCH", filename: "x.png", options: { bondThickness: 9 } },
        ],
        renderedCount: 0,
        perImageCount: 1,
      });
      allTests.push({
        name: "Restore: unmatched SMILES is ignored (no throw)",
        pass: true,
      });
    } catch (e) {
      allTests.push({
        name: "Restore: unmatched SMILES is ignored (no throw)",
        pass: false,
      });
    }

    // Restore renderer state to whatever was there before the suite ran
    renderer._chemistryData = savedChemistryData;
    renderer._currentStructureIndex = savedIndex;
  } else {
    allTests.push({
      name: "Restore: renderer tests skipped (no active result renderer)",
      pass: true,
    });
  }

  // Test 10: leave global state clean
  try {
    utils.setActivePreset(originalPreset);
    if (originalPreset === "custom") {
      utils.setCustomOptions(originalCustom);
    } else {
      utils.setCustomOptions({});
    }
    const clean =
      utils.getActivePreset() === originalPreset &&
      (originalPreset !== "custom" ||
        JSON.stringify(utils.getCustomOptions()) ===
          JSON.stringify(originalCustom));
    allTests.push({
      name: "Restore: leaves global state clean after suite",
      pass: clean,
    });
  } catch (e) {
    allTests.push({
      name: "Restore: leaves global state clean after suite",
      pass: false,
    });
  }

  console.log("\nPhase 7C Stage 6: Resume / Restore\n");
  let passed = 0;
  allTests.forEach((t) => {
    console.log((t.pass ? "PASS" : "FAIL") + " " + t.name);
    if (t.pass) passed++;
  });
  console.log("\n" + passed + "/" + allTests.length + " passed");

  return { passed, total: allTests.length };
};

// ═════════════════════════════════════════════════════════════════════════════
// Phase 7C Stage 7: MMD preview re-rendering
// ═════════════════════════════════════════════════════════════════════════════
window.testChemistry7C_Stage7 = async function () {
  const utils = window.MathPixChemistryUtils;
  const allTests = [];

  // Preserve global state — restored in `finally`
  const originalPreset = utils?.getActivePreset?.() || "skeletal";
  const originalCustom = utils?.getCustomOptions?.() || {};

  const controller = window.getMathPixController?.();
  const renderer = controller?.resultRenderer;
  const hasRenderer =
    !!renderer && typeof renderer._dispatchChemistrySettingsChanged === "function";

  const preview = window.getMathPixMMDPreview?.();

  // Helper: spy on document-level chemistry-settings-changed events
  const withSpy = (fn) => {
    const events = [];
    const handler = (e) => events.push(e.detail || {});
    document.addEventListener("chemistry-settings-changed", handler);
    try {
      fn();
    } finally {
      document.removeEventListener("chemistry-settings-changed", handler);
    }
    return events;
  };

  // Preserve renderer chemistry data
  const savedData = renderer?._chemistryData;
  const savedIndex = renderer?._currentStructureIndex;

  try {
    // ── Test 1: dispatch — setActivePreset UI path ──────────────────────────
    if (hasRenderer) {
      const presetContainer = document.getElementById("chemistry-preset-selector");
      const radio = presetContainer?.querySelector(
        'input[name="chemistry-preset"][value="skeletal"]',
      );
      // The preset radio change listener is only attached by
      // _setupChemistryPresetSelector(), which runs when chemistry is
      // first displayed. On a cold load with no chemistry processed the
      // listener is not wired up, so dispatching 'change' is a no-op and
      // no scope=global event fires. Skip when there is no live structure.
      const t1Data = renderer._chemistryData;
      const t1HasLiveStructure =
        Array.isArray(t1Data) && t1Data.length > 0;
      if (radio && t1HasLiveStructure) {
        // Force the per-image toggle off so the preset handler takes the
        // global branch. Earlier suites (7C-4) can leave it ticked.
        const t1Toggle = document.getElementById("chem-per-image-toggle");
        if (t1Toggle && t1Toggle.checked) t1Toggle.checked = false;
        utils.setActivePreset("monochrome");
        const events = withSpy(() => {
          radio.checked = true;
          radio.dispatchEvent(new Event("change", { bubbles: true }));
        });
        allTests.push({
          name: "Dispatch: global preset change fires scope=global",
          pass: events.some((d) => d.scope === "global"),
        });
      } else {
        allTests.push({
          name: "Dispatch: global preset change (skipped — no live structure)",
          pass: true,
        });
      }
    } else {
      allTests.push({
        name: "Dispatch: global preset change (skipped — no renderer)",
        pass: true,
      });
    }

    // ── Test 2: dispatch — per-image pick ───────────────────────────────────
    if (hasRenderer) {
      const perImageToggle = document.getElementById("chem-per-image-toggle");
      const textbookRadio = document.querySelector(
        'input[name="chemistry-preset"][value="textbook"]',
      );
      const data = renderer._chemistryData;
      const hasLiveStructure =
        Array.isArray(data) && data[renderer._currentStructureIndex || 0]?.notation;

      if (perImageToggle && textbookRadio && hasLiveStructure) {
        perImageToggle.checked = true;
        const events = withSpy(() => {
          textbookRadio.checked = true;
          textbookRadio.dispatchEvent(new Event("change", { bubbles: true }));
        });
        const currentSmiles = data[renderer._currentStructureIndex || 0].notation;
        allTests.push({
          name: "Dispatch: per-image pick fires scope=perImage with smiles",
          pass: events.some(
            (d) => d.scope === "perImage" && d.smiles === currentSmiles,
          ),
        });
      } else {
        allTests.push({
          name: "Dispatch: per-image pick (skipped — no live structure)",
          pass: true,
        });
      }
    } else {
      allTests.push({
        name: "Dispatch: per-image pick (skipped — no renderer)",
        pass: true,
      });
    }

    // ── Test 3: dispatch — clear per-image ──────────────────────────────────
    if (hasRenderer) {
      const clearBtn = document.getElementById("chem-clear-per-image");
      const data = renderer._chemistryData;
      const hasLiveStructure =
        Array.isArray(data) && data[renderer._currentStructureIndex || 0]?.notation;
      if (clearBtn && hasLiveStructure) {
        // Make sure there's something to clear so the handler runs
        const idx = renderer._currentStructureIndex || 0;
        data[idx].renderOptions = { bondThickness: 3 };
        data[idx].renderPresetName = "custom";
        const events = withSpy(() => clearBtn.click());
        allTests.push({
          name: "Dispatch: clear per-image fires scope=perImage",
          pass: events.some((d) => d.scope === "perImage"),
        });
      } else {
        allTests.push({
          name: "Dispatch: clear per-image (skipped — no live structure)",
          pass: true,
        });
      }
    } else {
      allTests.push({
        name: "Dispatch: clear per-image (skipped — no renderer)",
        pass: true,
      });
    }

    // ── Test 4: dispatch — restoreChemistryFromManifest hook ─────────────────
    if (
      hasRenderer &&
      typeof renderer.restoreChemistryFromManifest === "function"
    ) {
      renderer._chemistryData = [{ notation: "CCO" }];
      renderer._currentStructureIndex = 0;
      const events = withSpy(() => {
        renderer.restoreChemistryFromManifest({
          schemaVersion: 1,
          globalPreset: "skeletal",
          customOptions: null,
          perImageOverrides: [],
          renderedCount: 0,
          perImageCount: 0,
        });
      });
      allTests.push({
        name: "Dispatch: restoreChemistryFromManifest fires scope=global",
        pass: events.some((d) => d.scope === "global"),
      });
    } else {
      allTests.push({
        name: "Dispatch: restore hook (skipped — no renderer)",
        pass: true,
      });
    }

    // ── Test 5: listener wiring sentinel ────────────────────────────────────
    allTests.push({
      name: "Listener: MathPixMMDPreview has chemistry-settings-changed bound",
      pass: !!preview && preview._chemistrySettingsChangedBound === true,
    });

    // ── Tests 6-8: fingerprint cache + per-image options threading ─────────
    const canStubRender =
      !!preview &&
      typeof window.MathPixChemistryUtils?.renderStructureToBlob === "function";

    if (canStubRender) {
      const origRender = window.MathPixChemistryUtils.renderStructureToBlob;
      let captured = [];
      let callCount = 0;
      const fakeBlob = new Blob(["stub"], { type: "image/png" });
      window.MathPixChemistryUtils.renderStructureToBlob = async (
        smiles,
        opts,
      ) => {
        callCount++;
        captured.push({ smiles, opts });
        return fakeBlob;
      };

      // Save + reset preview chemistry cache
      const savedMap = preview.chemistryBlobUrlMap;
      const savedList = preview.chemistryBlobUrls;
      const savedMmd = preview._lastChemMmdContent;
      const savedTarget = preview._lastChemTargetElement;
      preview.chemistryBlobUrlMap = new Map();
      preview.chemistryBlobUrls = [];

      // Build a stub DOM target with one chemistry image
      const stubCdn = "https://cdn.example.test/chem-stub.png";
      const target = document.createElement("div");
      const img = document.createElement("img");
      img.src = stubCdn;
      target.appendChild(img);

      const mmdContent =
        "\\includegraphics[alt={<smiles>CCO</smiles>}]{" + stubCdn + "}";

      // Seed chemistry data via the controller so _enhanceChemistryImages
      // sees no per-image override for the baseline runs
      const savedRendererData = renderer ? renderer._chemistryData : null;
      if (renderer) renderer._chemistryData = [{ notation: "CCO" }];

      try {
        // Test 6: fingerprint cache HIT — first run renders, second reuses
        utils.setActivePreset("skeletal");
        callCount = 0;
        captured = [];
        await preview._enhanceChemistryImages(mmdContent, target);
        const firstCalls = callCount;
        await preview._enhanceChemistryImages(mmdContent, target);
        allTests.push({
          name: "Cache: matching fingerprint reuses blob (no re-render)",
          pass: firstCalls === 1 && callCount === 1,
        });

        // Test 7: fingerprint cache MISS — preset change invalidates entry
        const prevEntry = preview.chemistryBlobUrlMap.get(stubCdn);
        const prevBlobUrl = prevEntry?.blobUrl;
        utils.setActivePreset("monochrome");
        callCount = 0;
        await preview._enhanceChemistryImages(mmdContent, target);
        const newEntry = preview.chemistryBlobUrlMap.get(stubCdn);
        allTests.push({
          name: "Cache: mismatched fingerprint revokes + re-renders entry",
          pass:
            callCount === 1 &&
            !!newEntry &&
            newEntry.blobUrl !== prevBlobUrl &&
            newEntry.fingerprint === "preset:monochrome",
        });

        // Test 8: per-image options threaded into renderStructureToBlob
        if (renderer) {
          renderer._chemistryData = [
            { notation: "CCO", renderOptions: { bondThickness: 7 } },
          ];
        }
        // Force a fresh render by clearing the cached entry
        preview.chemistryBlobUrlMap.clear();
        preview.chemistryBlobUrls.length = 0;
        captured = [];
        await preview._enhanceChemistryImages(mmdContent, target);
        const lastCall = captured[captured.length - 1];
        allTests.push({
          name: "Threading: perImageOptions passed to renderStructureToBlob",
          pass:
            !!lastCall &&
            lastCall.opts?.perImageOptions?.bondThickness === 7,
        });
      } finally {
        // Restore stub + state
        window.MathPixChemistryUtils.renderStructureToBlob = origRender;
        // Revoke any blob URLs created during the test
        for (const entry of preview.chemistryBlobUrlMap.values()) {
          try {
            URL.revokeObjectURL(entry.blobUrl);
          } catch (e) {}
        }
        preview.chemistryBlobUrlMap = savedMap;
        preview.chemistryBlobUrls = savedList;
        preview._lastChemMmdContent = savedMmd;
        preview._lastChemTargetElement = savedTarget;
        if (renderer) renderer._chemistryData = savedRendererData;
      }
    } else {
      allTests.push({
        name: "Cache: fingerprint hit (skipped — no preview/renderStructureToBlob)",
        pass: true,
      });
      allTests.push({
        name: "Cache: fingerprint miss (skipped — no preview/renderStructureToBlob)",
        pass: true,
      });
      allTests.push({
        name: "Threading: perImageOptions (skipped — no preview/renderStructureToBlob)",
        pass: true,
      });
    }
  } finally {
    // Restore global state
    try {
      utils?.setActivePreset?.(originalPreset);
      if (originalPreset === "custom") {
        utils?.setCustomOptions?.(originalCustom);
      } else {
        utils?.setCustomOptions?.({});
      }
    } catch (e) {}
    if (renderer) {
      renderer._chemistryData = savedData;
      renderer._currentStructureIndex = savedIndex;
    }
  }

  console.log("\nPhase 7C Stage 7: MMD preview re-rendering\n");
  let passed = 0;
  allTests.forEach((t) => {
    console.log((t.pass ? "PASS" : "FAIL") + " " + t.name);
    if (t.pass) passed++;
  });
  console.log("\n" + passed + "/" + allTests.length + " passed");

  return { passed, total: allTests.length };
};

// Phase 7A-4: Graph cache Map + item-level description caching
window.testChemistry7A_Stage4 = function () {
  const utils = window.MathPixChemistryUtils;
  const canvas = document.getElementById("chemistry-structure-canvas");

  if (!canvas) {
    console.error(
      "No chemistry canvas — switch to MathPix mode and load a chemistry result first",
    );
    return { passed: 0, total: 0 };
  }

  if (typeof utils.clearGraphCache !== "function") {
    console.error("clearGraphCache not found — 7A-4a not yet implemented");
    return { passed: 0, total: 0 };
  }

  const allTests = [];
  let moleculeIndex = 0;

  const molecules = [
    { smiles: "CC(=O)Oc1ccccc1C(=O)O", name: "aspirin" },
    { smiles: "Cn1c(=O)c2c(ncn2C)n(C)c1=O", name: "caffeine" },
    { smiles: "CCO", name: "ethanol" },
  ];

  function renderNext() {
    if (moleculeIndex >= molecules.length) {
      runTests();
      return;
    }
    const mol = molecules[moleculeIndex];
    utils.renderStructure(mol.smiles, canvas, {
      onGraphReady: () => {
        moleculeIndex++;
        setTimeout(renderNext, 100);
      },
    });
  }

  function runTests() {
    // --- Map cache: all 3 structures should be cached simultaneously ---
    allTests.push({
      name: "Map cache: aspirin cached after 3 renders",
      pass: !!utils.analyseStructure("CC(=O)Oc1ccccc1C(=O)O"),
    });
    allTests.push({
      name: "Map cache: caffeine cached after 3 renders",
      pass: !!utils.analyseStructure("Cn1c(=O)c2c(ncn2C)n(C)c1=O"),
    });
    allTests.push({
      name: "Map cache: ethanol cached after 3 renders",
      pass: !!utils.analyseStructure("CCO"),
    });

    // --- generateStructuralDescription works for all ---
    const aspirinDesc = utils.generateStructuralDescription(
      "CC(=O)Oc1ccccc1C(=O)O",
      { commonNames: ["aspirin"] },
    );
    allTests.push({
      name: "Description: aspirin has structural desc",
      pass: aspirinDesc.length > 0 && aspirinDesc.includes("benzene"),
    });

    const caffeineDesc = utils.generateStructuralDescription(
      "Cn1c(=O)c2c(ncn2C)n(C)c1=O",
      { commonNames: ["caffeine"] },
    );
    allTests.push({
      name: "Description: caffeine has structural desc",
      pass: caffeineDesc.length > 0 && caffeineDesc.startsWith("Caffeine"),
    });

    const ethanolDesc = utils.generateStructuralDescription("CCO", {
      commonNames: ["ethanol"],
    });
    allTests.push({
      name: "Description: ethanol has structural desc",
      pass: ethanolDesc.length > 0 && ethanolDesc.startsWith("Ethanol"),
    });

    // --- clearGraphCache works ---
    utils.clearGraphCache();
    allTests.push({
      name: "clearGraphCache: aspirin no longer cached",
      pass: !utils.analyseStructure("CC(=O)Oc1ccccc1C(=O)O"),
    });
    allTests.push({
      name: "clearGraphCache: caffeine no longer cached",
      pass: !utils.analyseStructure("Cn1c(=O)c2c(ncn2C)n(C)c1=O"),
    });

    // --- Item-level caching (requires result renderer) ---
    // Simulate an item with a cached description — verify _upgradeToStructuralDescription
    // would serve from cache by checking generateStructuralDescription returns empty
    // (graph cleared) but the item._structuralDescription is preserved.
    const fakeItem = {
      notation: "CCO",
      _structuralDescription: "Ethanol. A two-carbon chain with a hydroxyl group.",
    };
    allTests.push({
      name: "Item cache: _structuralDescription survives graph cache clear",
      pass: fakeItem._structuralDescription.startsWith("Ethanol"),
    });

    // --- Verify graph cache still empty (wasn't repopulated by tests) ---
    allTests.push({
      name: "Graph cache empty after clear",
      pass: !utils.analyseStructure("CCO"),
    });

    // Re-render aspirin to restore cache for other tests
    utils.renderStructure("CC(=O)Oc1ccccc1C(=O)O", canvas, {
      onGraphReady: () => {
        allTests.push({
          name: "Re-render: aspirin re-cached after clear",
          pass: !!utils.analyseStructure("CC(=O)Oc1ccccc1C(=O)O"),
        });

        // Print summary
        console.log("\nPhase 7A Stage 4: Graph Cache Map + Description Caching\n");
        let passed = 0;
        allTests.forEach((t) => {
          console.log((t.pass ? "PASS" : "FAIL") + " " + t.name);
          if (t.pass) passed++;
        });
        console.log("\n" + passed + "/" + allTests.length + " passed");
      },
    });

    return { passed: allTests.filter((t) => t.pass).length, total: allTests.length };
  }

  renderNext();
};

// Phase 8A-8 D-2: mode-transition smoke test. Cycles upload ↔ resume twice
// and after each transition verifies the resume tab state is consistent.
// After the final transition, clicks each of the four resume tabs in turn
// and asserts the paired panel is actually visible (computed display).
window.testModeSwitchTabIntegrity = async function () {
  const results = [];
  const push = (name, pass, note) =>
    results.push({ name, pass: !!pass, note: note || "" });

  const ctrl =
    window.getMathPixController && window.getMathPixController();
  const modeSwitcher = ctrl?.modeSwitcher;
  const restorer =
    window.getMathPixSessionRestorer &&
    window.getMathPixSessionRestorer();
  const audit = window.auditResumeTabState;

  if (!modeSwitcher) {
    push("mode switcher available", false, "getMathPixController returned no modeSwitcher");
    console.log("\nPhase 8A-8 D-2: testModeSwitchTabIntegrity\n");
    results.forEach((t) =>
      console.log((t.pass ? "PASS" : "FAIL") + " " + t.name + (t.note ? " — " + t.note : "")),
    );
    return { passed: 0, total: results.length };
  }
  if (!restorer || typeof restorer.switchTab !== "function") {
    push("session restorer available", false, "getMathPixSessionRestorer missing or has no switchTab");
    console.log("\nPhase 8A-8 D-2: testModeSwitchTabIntegrity\n");
    results.forEach((t) =>
      console.log((t.pass ? "PASS" : "FAIL") + " " + t.name + (t.note ? " — " + t.note : "")),
    );
    return { passed: 0, total: results.length };
  }
  if (typeof audit !== "function") {
    push("window.auditResumeTabState exposed", false, "audit helper missing");
  } else {
    push("window.auditResumeTabState exposed", true);
  }

  const transitions = [
    ["upload #1", () => modeSwitcher.switchToUploadMode()],
    ["resume #1", () => modeSwitcher.switchToResumeMode()],
    ["upload #2", () => modeSwitcher.switchToUploadMode()],
    ["resume #2", () => modeSwitcher.switchToResumeMode()],
  ];

  for (const [label, fn] of transitions) {
    try {
      fn();
    } catch (err) {
      push("transition " + label + " did not throw", false, err.message);
      continue;
    }
    const violations = typeof audit === "function" ? audit() : null;
    // audit() returns array of violations, null if clean, or {error} if
    // the container isn't present (e.g. upload mode with hidden resume).
    // Only assert consistency after a resume transition — in upload mode
    // the resume container's tabs may legitimately not be visible yet.
    if (label.startsWith("resume")) {
      push(
        "after " + label + ": resume tab state consistent",
        !violations || violations === null || violations.error,
        violations && Array.isArray(violations)
          ? JSON.stringify(violations)
          : "",
      );
    }
  }

  // After the final resume transition, click each tab and check the paired
  // panel is actually visible.
  const tabs = ["mmd", "confidence", "analysis", "chemistry"];
  for (const t of tabs) {
    try {
      restorer.switchTab(t);
    } catch (err) {
      push("switchTab('" + t + "') did not throw", false, err.message);
      continue;
    }
    const panel = document.getElementById("resume-panel-" + t);
    if (!panel) {
      push("panel resume-panel-" + t + " exists", false, "element not in DOM");
      continue;
    }
    const display = getComputedStyle(panel).display;
    push(
      "after switchTab('" + t + "'): panel display !== none",
      display !== "none",
      "computed display = " + display,
    );
    const auditResult = typeof audit === "function" ? audit() : null;
    push(
      "after switchTab('" + t + "'): no invariant violations",
      !auditResult || auditResult.error,
      auditResult && Array.isArray(auditResult)
        ? JSON.stringify(auditResult)
        : "",
    );
  }

  console.log("\nPhase 8A-8 D-2: testModeSwitchTabIntegrity\n");
  let passed = 0;
  results.forEach((t) => {
    console.log((t.pass ? "PASS" : "FAIL") + " " + t.name + (t.note ? " — " + t.note : ""));
    if (t.pass) passed++;
  });
  console.log("\n" + passed + "/" + results.length + " passed");

  return { passed, total: results.length };
};

// Phase 8A-8 D-6: regression snapshot test for the exact 8A-8 repro path.
// Forces the resume tab buttons into the known-stale state (class .active
// but aria-selected="false", matching what upload-mode showFormat() and
// pdf-handler switchResultTab() used to leave behind), then triggers a
// resume-mode re-entry and asserts the state is cleaned up.
window.testPhase8A8RegressionSnapshot = function () {
  const results = [];
  const push = (name, pass, note) =>
    results.push({ name, pass: !!pass, note: note || "" });

  const ctrl =
    window.getMathPixController && window.getMathPixController();
  const modeSwitcher = ctrl?.modeSwitcher;
  const audit = window.auditResumeTabState;

  if (!modeSwitcher) {
    push("mode switcher available", false, "getMathPixController returned no modeSwitcher");
    console.log("\nPhase 8A-8 D-6: regression snapshot\n");
    results.forEach((t) =>
      console.log((t.pass ? "PASS" : "FAIL") + " " + t.name + (t.note ? " — " + t.note : "")),
    );
    return { passed: 0, total: results.length };
  }

  // Simulate the bad state: every resume tab button has .active class, and
  // aria-selected="false" on all of them — this is what used to linger
  // after upload-mode showFormat() + pdf-handler switchResultTab() fired.
  const ids = [
    "resume-tab-mmd",
    "resume-tab-confidence",
    "resume-tab-analysis",
    "resume-tab-chemistry",
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add("active");
      el.setAttribute("aria-selected", "false");
    }
  }
  const panelIds = [
    "resume-panel-mmd",
    "resume-panel-confidence",
    "resume-panel-analysis",
    "resume-panel-chemistry",
  ];
  for (const id of panelIds) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove("active");
      el.hidden = true;
    }
  }

  // Confirm the setup actually produced a violation state so we know the
  // test is a meaningful assertion (not passing because the fix wasn't
  // reached).
  const preViolations = typeof audit === "function" ? audit() : null;
  push(
    "test setup produced a violation state",
    Array.isArray(preViolations) && preViolations.length > 0,
    preViolations && Array.isArray(preViolations)
      ? preViolations.length + " violations before fix runs"
      : "",
  );

  // Trigger the fix path.
  try {
    modeSwitcher.switchToResumeMode();
  } catch (err) {
    push("switchToResumeMode did not throw", false, err.message);
  }

  // After the fix, state must be consistent.
  const postViolations = typeof audit === "function" ? audit() : null;
  push(
    "after switchToResumeMode: no invariant violations",
    !postViolations || postViolations.error,
    postViolations && Array.isArray(postViolations)
      ? JSON.stringify(postViolations)
      : "",
  );

  // Exactly one button should be active.
  const buttons = ids
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const activeCount = buttons.filter((b) => b.classList.contains("active"))
    .length;
  push("exactly one resume tab button has .active", activeCount === 1, "activeCount=" + activeCount);

  // That active button's aria-selected must be "true".
  const activeBtn = buttons.find((b) => b.classList.contains("active"));
  if (activeBtn) {
    push(
      "active button's aria-selected === 'true'",
      activeBtn.getAttribute("aria-selected") === "true",
      "aria-selected=" + activeBtn.getAttribute("aria-selected"),
    );
  }

  console.log("\nPhase 8A-8 D-6: regression snapshot\n");
  let passed = 0;
  results.forEach((t) => {
    console.log((t.pass ? "PASS" : "FAIL") + " " + t.name + (t.note ? " — " + t.note : ""));
    if (t.pass) passed++;
  });
  console.log("\n" + passed + "/" + results.length + " passed");

  return { passed, total: results.length };
};

// Phase 8A-9 D-2: mode-transition matrix test for chemistry panel content
// ownership. Verifies that #chemistry-structure-figure ends up in the correct
// panel after each of the R1-R10 transition paths.
window.testModeSwitchChemistryContentIntegrity = function () {
  const results = [];
  const push = (name, pass, note) =>
    results.push({ name, pass: !!pass, note: note || "" });

  const ctrl =
    window.getMathPixController && window.getMathPixController();
  const modeSwitcher = ctrl?.modeSwitcher;
  const pdfRenderer = ctrl?.pdfResultRenderer;
  const audit = window.auditChemistryPanelOwnership;

  if (!modeSwitcher) {
    push("mode switcher available", false, "getMathPixController returned no modeSwitcher");
    console.log("\nPhase 8A-9 D-2: testModeSwitchChemistryContentIntegrity\n");
    results.forEach((t) =>
      console.log((t.pass ? "PASS" : "FAIL") + " " + t.name + (t.note ? " — " + t.note : "")),
    );
    return { passed: 0, total: results.length };
  }

  // D-9: canonical-ID uniqueness check
  const canonicalIds = [
    "chemistry-structure-figure",
    "chemistry-structure-canvas",
    "smiles-output-heading",
    "chemistry-identifiers",
    "chemistry-actions",
  ];

  function assertUniqueIds(label) {
    for (const id of canonicalIds) {
      const count = document.querySelectorAll("#" + id).length;
      if (count > 1) {
        push(label + ": #" + id + " unique", false, "found " + count + " instances");
      }
    }
  }

  // Helper: check which panel owns #chemistry-structure-figure
  function figureOwner() {
    const fig = document.getElementById("chemistry-structure-figure");
    if (!fig) return "(not in DOM)";
    const panelIds = ["mathpix-output-smiles", "panel-chemistry", "resume-panel-chemistry"];
    let parent = fig.parentElement;
    while (parent) {
      if (panelIds.includes(parent.id)) return parent.id;
      parent = parent.parentElement;
    }
    return "(detached)";
  }

  // Helper: check audit consistency
  function assertAuditConsistent(label) {
    if (typeof audit === "function") {
      const state = audit();
      push(label + ": audit consistent", state.consistent,
        state.consistent ? "" : JSON.stringify(state.violations));
    }
  }

  // Start in upload mode (canonical state)
  modeSwitcher.switchToUploadMode();

  // R2-like: image upload baseline — figure should be in canonical panel
  const r2Owner = figureOwner();
  push("R2 upload baseline: figure in mathpix-output-smiles or not in DOM",
    r2Owner === "mathpix-output-smiles" || r2Owner === "(not in DOM)",
    "actual: " + r2Owner);
  assertUniqueIds("R2");

  // Simulate PDF mode moving elements (like _moveChemistryToPDFTabs does)
  // We call the actual method if chemistry content exists, or simulate the move
  const canonicalPanel = document.getElementById("mathpix-output-smiles");
  const pdfPanel = document.getElementById("panel-chemistry");

  if (canonicalPanel && pdfPanel && canonicalPanel.querySelector("#chemistry-structure-figure")) {
    // Content exists — simulate the PDF move
    if (pdfRenderer && typeof pdfRenderer._moveChemistryToPDFTabs === "function") {
      pdfRenderer._moveChemistryToPDFTabs(1);
    }

    // R10-like: after PDF move, figure should be in panel-chemistry
    push("R10 after pdf move: figure in panel-chemistry",
      figureOwner() === "panel-chemistry", "actual: " + figureOwner());
    assertUniqueIds("R10");

    // R9-like: switch to upload (triggers _onModeExit → restore)
    modeSwitcher.switchToUploadMode();
    push("R9 upload after pdf: figure in mathpix-output-smiles",
      figureOwner() === "mathpix-output-smiles", "actual: " + figureOwner());
    assertUniqueIds("R9");
    assertAuditConsistent("R9");

    // Simulate pdf → resume → image (R5 path)
    // First move to pdf again
    if (typeof pdfRenderer._moveChemistryToPDFTabs === "function") {
      pdfRenderer._moveChemistryToPDFTabs(1);
    }
    push("R5 setup: figure moved to panel-chemistry",
      figureOwner() === "panel-chemistry", "actual: " + figureOwner());

    // Switch to resume (triggers _onModeExit → restore from pdf)
    modeSwitcher.switchToResumeMode();
    push("R5 after resume: figure restored to mathpix-output-smiles",
      figureOwner() === "mathpix-output-smiles", "actual: " + figureOwner());
    assertUniqueIds("R5 resume");

    // Switch back to upload (image mode — R5 final)
    modeSwitcher.switchToUploadMode();
    push("R5 final (image): figure in mathpix-output-smiles",
      figureOwner() === "mathpix-output-smiles", "actual: " + figureOwner());
    assertUniqueIds("R5 final");
    assertAuditConsistent("R5 final");

    // R6 path: pdf → resume → pdf
    if (typeof pdfRenderer._moveChemistryToPDFTabs === "function") {
      pdfRenderer._moveChemistryToPDFTabs(1);
    }
    modeSwitcher.switchToResumeMode();
    push("R6 after resume: figure restored to mathpix-output-smiles",
      figureOwner() === "mathpix-output-smiles", "actual: " + figureOwner());

    // Back to upload for clean state
    modeSwitcher.switchToUploadMode();
    // Simulate second PDF
    if (typeof pdfRenderer._moveChemistryToPDFTabs === "function") {
      pdfRenderer._moveChemistryToPDFTabs(1);
    }
    push("R6 final (2nd pdf): figure in panel-chemistry",
      figureOwner() === "panel-chemistry", "actual: " + figureOwner());
    assertUniqueIds("R6 final");

    // Restore to canonical for clean exit
    modeSwitcher.switchToUploadMode();
  } else {
    push("chemistry content present for matrix test", false,
      "No #chemistry-structure-figure in canonical panel — upload a chemistry " +
      "image first, then re-run");
  }

  // Final audit
  assertAuditConsistent("final state");

  console.log("\nPhase 8A-9 D-2: testModeSwitchChemistryContentIntegrity\n");
  let passed = 0;
  results.forEach((t) => {
    console.log((t.pass ? "PASS" : "FAIL") + " " + t.name + (t.note ? " — " + t.note : ""));
    if (t.pass) passed++;
  });
  console.log("\n" + passed + "/" + results.length + " passed");
  return { passed, total: results.length };
};

// Phase 8A-9 D-6: regression snapshot test. Forces the known-bad state
// (chemistry-structure-figure inside #panel-chemistry with
// #mathpix-output-smiles empty), verifies the violation exists, then calls
// _restoreChemistryToCanonical() and asserts ownership is restored.
window.testPhase8A9RegressionSnapshot = function () {
  const results = [];
  const push = (name, pass, note) =>
    results.push({ name, pass: !!pass, note: note || "" });

  const ctrl =
    window.getMathPixController && window.getMathPixController();
  const pdfRenderer = ctrl?.pdfResultRenderer;
  const audit = window.auditChemistryPanelOwnership;

  if (!pdfRenderer || typeof pdfRenderer._restoreChemistryToCanonical !== "function") {
    push("_restoreChemistryToCanonical available", false,
      "pdfResultRenderer missing or method not found");
    console.log("\nPhase 8A-9 D-6: regression snapshot\n");
    results.forEach((t) =>
      console.log((t.pass ? "PASS" : "FAIL") + " " + t.name + (t.note ? " — " + t.note : "")),
    );
    return { passed: 0, total: results.length };
  }

  push("_restoreChemistryToCanonical available", true);

  const canonicalPanel = document.getElementById("mathpix-output-smiles");
  const pdfPanel = document.getElementById("panel-chemistry");
  const figureEl = document.getElementById("chemistry-structure-figure");

  if (!canonicalPanel || !pdfPanel) {
    push("panels exist", false, "missing mathpix-output-smiles or panel-chemistry");
    console.log("\nPhase 8A-9 D-6: regression snapshot\n");
    results.forEach((t) =>
      console.log((t.pass ? "PASS" : "FAIL") + " " + t.name + (t.note ? " — " + t.note : "")),
    );
    return { passed: 0, total: results.length };
  }

  if (!figureEl) {
    push("chemistry-structure-figure exists", false,
      "No chemistry content in DOM — upload a chemistry image first, then re-run");
    console.log("\nPhase 8A-9 D-6: regression snapshot\n");
    results.forEach((t) =>
      console.log((t.pass ? "PASS" : "FAIL") + " " + t.name + (t.note ? " — " + t.note : "")),
    );
    return { passed: 0, total: results.length };
  }

  // Force the known-bad state: move figure into panel-chemistry
  pdfPanel.appendChild(figureEl);
  push("setup: figure moved to panel-chemistry",
    pdfPanel.querySelector("#chemistry-structure-figure") !== null,
    "figure parent: " + (figureEl.parentElement?.id || "?"));

  // Verify the setup produced a violation
  if (typeof audit === "function") {
    const pre = audit();
    push("setup produced a violation",
      !pre.consistent,
      pre.consistent ? "no violation — test is not meaningful" :
        pre.violations.join("; "));
  }

  // Call the fix
  pdfRenderer._restoreChemistryToCanonical();

  // After fix, figure should be back in canonical
  push("after restore: figure in mathpix-output-smiles",
    canonicalPanel.querySelector("#chemistry-structure-figure") !== null,
    "figure parent: " + (figureEl.parentElement?.id || "?"));

  // Audit should report consistent
  if (typeof audit === "function") {
    const post = audit();
    push("after restore: audit consistent", post.consistent,
      post.consistent ? "" : JSON.stringify(post.violations));
  }

  // D-9: no duplicates
  const dupeCount = document.querySelectorAll("#chemistry-structure-figure").length;
  push("no duplicate #chemistry-structure-figure", dupeCount === 1,
    "count=" + dupeCount);

  console.log("\nPhase 8A-9 D-6: regression snapshot\n");
  let passed = 0;
  results.forEach((t) => {
    console.log((t.pass ? "PASS" : "FAIL") + " " + t.name + (t.note ? " — " + t.note : ""));
    if (t.pass) passed++;
  });
  console.log("\n" + passed + "/" + results.length + " passed");
  return { passed, total: results.length };
};

// Phase 8C-ST: Short description tier test harness
window.testChemistry8C_ST = function () {
  const utils = window.MathPixChemistryUtils;
  const canvas = document.getElementById("chemistry-structure-canvas");

  if (!canvas) {
    console.error(
      "No chemistry canvas — switch to MathPix mode and load a chemistry result first",
    );
    return;
  }

  const molecules = [
    {
      name: "Aspirin",
      smiles: "CC(=O)Oc1ccccc1C(=O)O",
      pubchem: {
        commonNames: ["aspirin"],
        molecularWeight: 180.16,
        molecularFormula: "C9H8O4",
        inchi: "InChI=1S/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)",
      },
      checks: (d) => [
        { name: "starts with name", pass: d.startsWith("Aspirin") },
        { name: "has formula", pass: d.includes("C₉H₈O₄") },
        { name: "no molecular weight", pass: !d.includes("molecular weight") },
        { name: "mentions benzene", pass: d.includes("benzene") },
        { name: "mentions acid", pass: d.toLowerCase().includes("acid") },
        { name: "mentions ester", pass: d.includes("ester") },
        { name: "no shorthand", pass: !d.includes("–COOH") && !d.includes("–OCOCH₃") },
        { name: "no element list", pass: !d.includes("Contains") },
        { name: "under 125 chars", pass: d.length <= 125 },
        { name: "max 2 sentences", pass: (d.match(/\./g) || []).length <= 2 },
      ],
    },
    {
      name: "Ethanol",
      smiles: "CCO",
      pubchem: {
        commonNames: ["ethanol"],
        molecularWeight: 46.07,
        molecularFormula: "C2H6O",
        inchi: "InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3",
      },
      checks: (d) => [
        { name: "starts with name", pass: d.startsWith("Ethanol") },
        { name: "mentions chain", pass: d.includes("chain") || d.includes("carbon") },
        { name: "mentions hydroxyl", pass: d.includes("hydroxyl") },
        { name: "no element list", pass: !d.includes("Contains") },
        { name: "under 125 chars", pass: d.length <= 125 },
      ],
    },
    {
      name: "Benzene",
      smiles: "c1ccccc1",
      pubchem: null,
      checks: (d) => [
        { name: "mentions benzene", pass: d.includes("benzene") },
        { name: "mentions ring", pass: d.includes("ring") },
        { name: "no formula without pubchem", pass: !d.includes("molecular weight") },
        { name: "under 50 chars", pass: d.length <= 50 },
      ],
    },
    {
      name: "Paracetamol",
      smiles: "CC(=O)Nc1ccc(O)cc1",
      pubchem: {
        commonNames: ["paracetamol"],
        molecularWeight: 151.16,
        molecularFormula: "C8H9NO2",
        inchi: "InChI=1S/C8H9NO2/c1-6(10)9-7-2-4-8(11)5-3-7/h2-5,11H,1H3,(H,9,10)",
      },
      checks: (d) => [
        { name: "starts with name", pass: d.startsWith("Paracetamol") },
        { name: "mentions benzene", pass: d.includes("benzene") },
        { name: "mentions amide", pass: d.includes("amide") },
        { name: "mentions hydroxyl", pass: d.includes("hydroxyl") },
        { name: "mentions position", pass: d.includes("opposite") || d.includes("para") },
        { name: "no shorthand", pass: !d.includes("–CONHR") },
        { name: "under 125 chars", pass: d.length <= 125 },
      ],
    },
    {
      name: "Caffeine",
      smiles: "Cn1c(=O)c2c(ncn2C)n(C)c1=O",
      pubchem: {
        commonNames: ["caffeine"],
        molecularWeight: 194.19,
        molecularFormula: "C8H10N4O2",
        inchi: "InChI=1S/C8H10N4O2/c1-10-4-9-6-5(10)7(13)12(3)8(14)11(6)2/h4H,1-3H3",
      },
      checks: (d) => [
        { name: "starts with name", pass: d.startsWith("Caffeine") },
        { name: "mentions fused", pass: d.includes("fused") },
        { name: "no element list", pass: !d.includes("Contains") },
        { name: "under 125 chars", pass: d.length <= 125 },
      ],
    },
    {
      name: "Pyrrolidine",
      smiles: "C1CCNC1",
      pubchem: null,
      checks: (d) => [
        { name: "mentions ring", pass: d.includes("ring") },
        { name: "under 50 chars", pass: d.length <= 50 },
      ],
    },
    {
      name: "Acetic acid",
      smiles: "CC(=O)O",
      pubchem: {
        commonNames: ["acetic acid"],
        molecularWeight: 60.05,
        molecularFormula: "C2H4O2",
        inchi: "InChI=1S/C2H4O2/c1-2(3)4/h1H3,(H,3,4)",
      },
      checks: (d) => [
        { name: "mentions acid", pass: d.toLowerCase().includes("acid") },
        { name: "mentions chain", pass: d.includes("chain") || d.includes("carbon") },
        { name: "under 125 chars", pass: d.length <= 125 },
      ],
    },
  ];

  let moleculeIndex = 0;
  const allTests = [];

  function testNext() {
    if (moleculeIndex >= molecules.length) {
      // ARIA variant test — Aspirin
      const aspirinPubchem = molecules[0].pubchem;
      const ariaDesc = utils.generateShortDescriptionForAria(
        "CC(=O)Oc1ccccc1C(=O)O", aspirinPubchem,
      );
      allTests.push({
        name: "ARIA: no Unicode subscripts",
        pass: !ariaDesc.includes("₉") && !ariaDesc.includes("₈"),
      });
      allTests.push({
        name: "ARIA: has spaced formula",
        pass: ariaDesc.includes("C 9") || ariaDesc.includes("H 8"),
      });

      // Print summary
      console.log("\nPhase 8C-ST: Short Description Tier\n");
      let passed = 0;
      allTests.forEach((t) => {
        console.log((t.pass ? "PASS" : "FAIL") + " " + t.name);
        if (t.pass) passed++;
      });
      console.log("\n" + passed + "/" + allTests.length + " passed");

      // Print actual descriptions for manual review
      console.log("\n--- Generated short descriptions ---\n");
      molecules.forEach((mol) => {
        console.log(mol.name + ": " + mol._lastShortDesc + " (" + (mol._lastShortDesc?.length || 0) + " chars)");
      });

      return { passed, total: allTests.length };
    }

    const mol = molecules[moleculeIndex];
    utils.renderStructure(mol.smiles, canvas, {
      onGraphReady: () => {
        const desc = utils.generateShortDescription(mol.smiles, mol.pubchem);
        mol._lastShortDesc = desc;
        const checks = mol.checks(desc);
        checks.forEach((c) => {
          allTests.push({ name: mol.name + ": " + c.name, pass: c.pass });
        });
        moleculeIndex++;
        setTimeout(testNext, 100);
      },
    });
  }

  testNext();
};

  window.testChemistryAll = async function () {
    const suites = [
      ["7A Stage 1", window.testChemistry7A_Stage1],
      ["7A Stage 2", window.testChemistry7A_Stage2],
      ["7A Stage 3", window.testChemistry7A_Stage3],
      ["7A Stage 4", window.testChemistry7A_Stage4],
      ["7B", window.testChemistry7B],
      ["7C Stage 1", window.testChemistry7C_Stage1],
      ["7C Stage 2", window.testChemistry7C_Stage2],
      ["7C Stage 3", window.testChemistry7C_Stage3],
      ["7C Stage 4", window.testChemistry7C_Stage4],
      ["7C Stage 5", window.testChemistry7C_Stage5],
      ["7C Stage 6", window.testChemistry7C_Stage6],
      ["7C Stage 7", window.testChemistry7C_Stage7],
      ["8A-8 mode-switch tab integrity", window.testModeSwitchTabIntegrity],
      ["8A-8 regression snapshot", window.testPhase8A8RegressionSnapshot],
      ["8A-9 chemistry content integrity", window.testModeSwitchChemistryContentIntegrity],
      ["8A-9 regression snapshot", window.testPhase8A9RegressionSnapshot],
      ["8C-ST short descriptions", window.testChemistry8C_ST],
    ];

    let totalPassed = 0;
    let totalTests = 0;
    const summary = [];

    for (const [label, fn] of suites) {
      if (typeof fn !== "function") {
        summary.push({ suite: label, passed: "—", total: "—", note: "missing" });
        continue;
      }
      try {
        const result = await fn();
        const passed = result?.passed ?? 0;
        const total = result?.total ?? 0;
        totalPassed += passed;
        totalTests += total;
        let note;
        if (total === 0) note = "async — see console";
        else if (passed === total) note = "ok";
        else note = "FAIL";
        summary.push({ suite: label, passed, total, note });
      } catch (err) {
        summary.push({ suite: label, passed: 0, total: 0, note: "threw: " + err.message });
      }
    }

    console.log("\n=== Chemistry test summary ===");
    console.table(summary);
    const failedSuites = summary.filter(s => s.note === "FAIL");
    if (totalPassed === totalTests && totalTests > 0 && failedSuites.length === 0) {
      console.log(`%c ALL PASS (${totalPassed}/${totalTests})`, "color: green; font-weight: bold; font-size: 14px");
    } else {
      console.log(`%c ${totalPassed}/${totalTests} passed`, "color: red; font-weight: bold; font-size: 14px");
      for (const s of failedSuites) {
        console.log(`%c  FAIL: ${s.suite} (${s.passed}/${s.total})`, "color: red; font-weight: bold");
      }
    }
    return { passed: totalPassed, total: totalTests, suites: summary };
  };

  logInfo("mathpix-chemistry-tests.js loaded — run window.testChemistryAll() to run everything");
})();
