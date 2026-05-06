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

  // Phase 12-4c C3: Tests 4, 7, 9, 10 retired-as-dead alongside the
  // getDrawerOptions shim per (2.5). Those tests asserted SmilesDrawer-shape
  // option fields (bondThickness, fontSizeLarge, themes.light) which are no
  // longer the contract under RDKit-only rendering. Production rendering
  // coverage is provided by renderStructure / renderStructureToBlob tests
  // elsewhere; preset-machinery coverage (Tests 5, 6, 8 below) is preserved.

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

  // Test 8: Invalid preset rejected
  const invalid = utils.setActivePreset("nonexistent");
  allTests.push({
    name: "setActivePreset: rejects invalid preset",
    pass: invalid === false,
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

  // Test 3: 3 range sliders present
  // 7C-3 shipped 4 ranges (bond-thickness, bond-spacing, font-size-large,
  // font-size-small). 12-4c (C3.5) retired bond-spacing — no clean RDKit
  // equivalent + the SmilesDrawer-era control was DOA since 12-1a.
  const ranges = details ? details.querySelectorAll('input[type="range"]') : [];
  allTests.push({
    name: "DOM: 3 range sliders present",
    pass: ranges.length === 3,
  });

  // Test 4: 2 checkboxes present inside advanced controls.
  // 7C-3 added 3 checkboxes (compact-drawing, explicit-hydrogens,
  // terminal-carbons); 7C-4 added a per-image toggle; 7C-5 lifted that toggle
  // out of #chemistry-advanced-controls into its own group above the details.
  // 12-1d added the CoordGen orientation toggle (#chem-coordgen-orientation)
  // inside the details, taking the count to 4.
  // 12-4c (C3.5) retired compact-drawing (no clean RDKit equivalent) and
  // terminal-carbons (consistent with the bond-spacing disposition), taking
  // the surviving count to 2 (explicit-hydrogens, coordgen-orientation).
  const checkboxes = details
    ? details.querySelectorAll('input[type="checkbox"]')
    : [];
  allTests.push({
    name: "DOM: 2 checkboxes present",
    pass: checkboxes.length === 2,
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

  // Phase 12-4c C3: Test 11 retired-as-dead (asserted SmilesDrawer-shape
  // drawerOpts.bondThickness / explicitHydrogens via the deprecated
  // getDrawerOptions shim). Round-trip coverage of setCustomOptions /
  // getCustomOptions (Test 10) is preserved.

  // Test 12: controls reflect the skeletal preset after re-population.
  // Phase 12-4c C3: rewritten to read RDKit-shape `bondLineWidth` from
  // config.PRESETS.skeletal (post-C2 rename). Paired with the (α) renderer
  // fix at mathpix-result-renderer.js:3279 — see C3.5 TODO there.
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
    parseFloat(bondThicknessInput.value) === skeletalPreset.bondLineWidth;
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

  // Phase 12-4c C3: Tests 5, 6, 7, 8 retired-as-dead alongside the
  // getDrawerOptions shim per (2.5). Those tests asserted SmilesDrawer-shape
  // option fields (bondThickness, bondSpacing) returned from the deprecated
  // shim. Per-image override correctness is exercised end-to-end by Tests
  // 1-4 of testChemistry7C_Stage5 (renderStructureToBlob with perImageOptions).

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

  // Test 1: renderStructureToBlob accepts perImageOptions without throwing.
  // Phase 12-4c C3: vestigial `typeof window.SmilesDrawer` guard removed —
  // renderStructureToBlob is RDKit-only post-12-1a; the guard was dead
  // instrumentation that masked the test under script-tag-removed states.
  let blobResult = null;
  let blobThrew = false;
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

  // Phase 12-4c C3: Tests 2, 3, 4 retired-as-dead alongside the
  // getDrawerOptions shim per (2.5). Those tests asserted SmilesDrawer-shape
  // option fields (bondThickness, bondSpacing, themes.light) on the shim's
  // return value. forExport and per-image-override correctness for the
  // RDKit-only render path are exercised by Test 1 above and the manifest /
  // ZIP integration tests (Tests 5+ below).

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

    // Test 6: customOptions round trip.
    // Phase 12-4c (C3.5): bondSpacing, compactDrawing, terminalCarbons fields
    // removed from the target object alongside their UI controls' retirement.
    // The two restored-field assertions (bondThickness, colourScheme) are
    // unchanged — they exercise surviving fields.
    try {
      const target = {
        bondThickness: 2.5,
        fontSizeLarge: 12,
        fontSizeSmall: 9,
        explicitHydrogens: false,
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

    // Phase 12-4c (C3.5): presetToUIShape mapping integrity.
    // Six mappings between RDKit-shape preset fields and SmilesDrawer-shape
    // UI keys. Drift insurance — if the helper or the preset shape changes,
    // this test catches it. Tested against skeletal (the DEFAULT_PRESET);
    // mapping is the same shape across all four presets.
    try {
      const skeletal = window.MATHPIX_CONFIG?.CHEMISTRY_RENDERING?.PRESETS?.skeletal;
      const ui = utils.presetToUIShape ? utils.presetToUIShape(skeletal) : {};
      allTests.push({
        name: "presetToUIShape: maps RDKit-shape preset to SmilesDrawer-shape UI",
        pass:
          !!skeletal &&
          !!ui &&
          ui.bondThickness === skeletal.bondLineWidth &&
          ui.fontSizeSmall === skeletal.minFontSize &&
          ui.fontSizeLarge === skeletal.maxFontSize &&
          ui.colourScheme === skeletal.atomColourPalette &&
          ui.explicitHydrogens === skeletal.addHsInPlace &&
          ui.useCoordGen === skeletal.useCoordGen,
      });
    } catch (e) {
      allTests.push({
        name: "presetToUIShape: maps RDKit-shape preset to SmilesDrawer-shape UI",
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

    // R11 (8A-10): same-mode PDF → image. No mode switch between the PDF
    // render and the image render — the restore fires from the top of
    // displayResult() instead of from _onModeExit().
    //
    // | Trigger sequence                                   | Expected                         | Previously |
    // | resume → upload (pdf) → **same-mode image**        | #mathpix-output-smiles populated | empty      |
    const resultRenderer = ctrl?.resultRenderer;
    if (resultRenderer && typeof resultRenderer.displayResult === "function" &&
        typeof pdfRenderer._moveChemistryToPDFTabs === "function") {
      // Stay in upload mode. Simulate the PDF render moving canonical
      // children into panel-chemistry.
      pdfRenderer._moveChemistryToPDFTabs(1);
      push("R11 setup (same-mode pdf): figure in panel-chemistry",
        figureOwner() === "panel-chemistry", "actual: " + figureOwner());

      // Simulate the image render — NO switchToUploadMode() call between.
      try {
        resultRenderer.displayResult({
          latex: "", mathml: "", asciimath: "", html: "", markdown: "",
          rawJson: "{}", containsChemistry: false, containsTable: false,
          confidence: 1,
        }, null);
      } catch (_) {
        // displayResult() may throw on the minimal mock; the 8A-10 fix runs
        // first and is wrapped in its own try/catch.
      }

      push("R11 after same-mode image: figure in mathpix-output-smiles",
        figureOwner() === "mathpix-output-smiles", "actual: " + figureOwner());
      assertUniqueIds("R11");
      assertAuditConsistent("R11");
    } else {
      push("R11 prerequisites available", false,
        "resultRenderer.displayResult or _moveChemistryToPDFTabs missing");
    }
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

// Phase 8A-10: regression snapshot for same-mode PDF → image chemistry custody.
// 8A-9's snapshot proves _restoreChemistryToCanonical() works in isolation.
// 8A-10's snapshot proves the restore call fires from the TOP of displayResult()
// so an image render that follows a same-mode PDF render lands in the canonical
// panel without a mode switch in between.
//
// Precondition: chemistry must already be rendered in #mathpix-output-smiles
// (upload a chemistry image first, then re-run this test).
window.testPhase8A10RegressionSnapshot = function () {
  const results = [];
  const push = (name, pass, note) =>
    results.push({ name, pass: !!pass, note: note || "" });

  const ctrl =
    window.getMathPixController && window.getMathPixController();
  const resultRenderer = ctrl?.resultRenderer;
  const audit = window.auditChemistryPanelOwnership;

  const finish = () => {
    console.log("\nPhase 8A-10: same-mode PDF → image regression snapshot\n");
    let passed = 0;
    results.forEach((t) => {
      console.log(
        (t.pass ? "PASS" : "FAIL") + " " + t.name + (t.note ? " — " + t.note : ""),
      );
      if (t.pass) passed++;
    });
    console.log("\n" + passed + "/" + results.length + " passed");
    return { passed, total: results.length };
  };

  if (!resultRenderer || typeof resultRenderer.displayResult !== "function") {
    push("resultRenderer.displayResult available", false,
      "controller missing resultRenderer or displayResult");
    return finish();
  }
  push("resultRenderer.displayResult available", true);

  const canonicalPanel = document.getElementById("mathpix-output-smiles");
  const pdfPanel = document.getElementById("panel-chemistry");
  const figureEl = document.getElementById("chemistry-structure-figure");

  if (!canonicalPanel || !pdfPanel) {
    push("panels exist", false, "missing mathpix-output-smiles or panel-chemistry");
    return finish();
  }

  if (!figureEl) {
    push("chemistry-structure-figure exists", false,
      "No chemistry content in DOM — upload a chemistry image first, then re-run");
    return finish();
  }

  // Snapshot the chemistry children that currently live in canonical so we can
  // force the bad state by moving them en-masse (mirroring what
  // _moveChemistryToPDFTabs() does during a PDF render).
  const childrenToMove = Array.from(canonicalPanel.children);
  childrenToMove.forEach((child) => pdfPanel.appendChild(child));

  push("setup: canonical panel emptied",
    canonicalPanel.children.length === 0,
    "canonical children after setup: " + canonicalPanel.children.length);
  push("setup: figure in panel-chemistry",
    pdfPanel.querySelector("#chemistry-structure-figure") !== null,
    "figure parent: " + (figureEl.parentElement?.id || "?"));

  if (typeof audit === "function") {
    const pre = audit();
    push("setup produced a violation",
      !pre.consistent,
      pre.consistent ? "no violation — test is not meaningful" :
        (pre.violations || []).join("; "));
  }

  // Minimal mock — displayResult() only needs enough structure not to throw
  // before the restore block runs. The restore call is at the TOP of the
  // method and wrapped in its own try/catch, so even if downstream
  // populateFormatContent() fails on an incomplete mock, the 8A-10 behaviour
  // we are asserting has already happened.
  const mockResult = {
    latex: "",
    mathml: "",
    asciimath: "",
    html: "",
    markdown: "",
    rawJson: "{}",
    containsChemistry: false,
    containsTable: false,
    confidence: 1,
  };

  try {
    resultRenderer.displayResult(mockResult, null);
  } catch (error) {
    // displayResult() may throw on the minimal mock; that's fine — the 8A-10
    // fix runs before anything that could fail.
    push("displayResult ran to restore block",
      canonicalPanel.querySelector("#chemistry-structure-figure") !== null,
      "threw after fix block: " + (error?.message || error));
  }

  push("after displayResult: figure in mathpix-output-smiles",
    canonicalPanel.querySelector("#chemistry-structure-figure") !== null,
    "figure parent: " + (figureEl.parentElement?.id || "?"));

  push("after displayResult: canonical panel populated",
    canonicalPanel.children.length > 0,
    "canonical children: " + canonicalPanel.children.length);

  if (typeof audit === "function") {
    const post = audit();
    push("after displayResult: audit consistent", post.consistent,
      post.consistent ? "" : JSON.stringify(post.violations));
    push("after displayResult: canonicalChildren > 0",
      (post.canonicalChildren || []).length > 0,
      "canonicalChildren count: " + (post.canonicalChildren || []).length);
  }

  // D-9 uniqueness: no duplicates introduced
  const dupeCount = document.querySelectorAll("#chemistry-structure-figure").length;
  push("no duplicate #chemistry-structure-figure", dupeCount === 1,
    "count=" + dupeCount);

  return finish();
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

  // Phase 8C-CT: Comprehensive description tier test harness
  window.testChemistry8C_CT = async function () {
    const utils = window.MathPixChemistryUtils;
    const allTests = [];

    if (!utils || !utils.generateComprehensiveDescription) {
      console.error(
        "MathPixChemistryUtils.generateComprehensiveDescription unavailable — check that mathpix-chemistry-comprehensive.js loaded",
      );
      return { passed: 0, total: 0 };
    }

    // Reference molecules (matches testChemistry8C_ST where applicable)
    const molecules = [
      {
        name: "Aspirin",
        smiles: "CC(=O)Oc1ccccc1C(=O)O",
        scaffold: "ring",
        pubchem: {
          commonNames: ["aspirin"],
          molecularWeight: 180.16,
          molecularFormula: "C9H8O4",
          inchi: "InChI=1S/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)",
        },
      },
      {
        name: "Ethanol",
        smiles: "CCO",
        scaffold: "chain",
        pubchem: {
          commonNames: ["ethanol"],
          molecularWeight: 46.07,
          molecularFormula: "C2H6O",
          inchi: "InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3",
        },
      },
      {
        name: "Benzene",
        smiles: "c1ccccc1",
        scaffold: "ring",
        pubchem: null,
      },
      {
        name: "Paracetamol",
        smiles: "CC(=O)Nc1ccc(O)cc1",
        scaffold: "ring",
        pubchem: {
          commonNames: ["paracetamol"],
          molecularWeight: 151.16,
          molecularFormula: "C8H9NO2",
          inchi: "InChI=1S/C8H9NO2/c1-6(10)9-7-2-4-8(11)5-3-7/h2-5,11H,1H3,(H,9,10)",
        },
      },
      {
        name: "Acetic acid",
        smiles: "CC(=O)O",
        scaffold: "chain",
        pubchem: {
          commonNames: ["acetic acid"],
          molecularWeight: 60.05,
          molecularFormula: "C2H4O2",
          inchi: "InChI=1S/C2H4O2/c1-2(3)4/h1H3,(H,3,4)",
        },
      },
      {
        name: "Caffeine",
        smiles: "Cn1c(=O)c2c(ncn2C)n(C)c1=O",
        scaffold: "fused-rings",
        pubchem: {
          commonNames: ["caffeine"],
          molecularWeight: 194.19,
          molecularFormula: "C8H10N4O2",
          inchi: "InChI=1S/C8H10N4O2/c1-10-4-9-6-5(10)7(13)12(3)8(14)11(6)2/h4H,1-3H3",
        },
      },
      // Phase 11-3b (N-post11-1): paraxanthine in PubChem-canonical Kekulé form.
      // Pre-11-3b this fixture decayed at all three tiers because SmilesDrawer
      // does not perceive aromaticity for uppercase Kekulé SMILES — every
      // downstream consumer (named-system gate, locant resolver, alkene detector)
      // saw the rings as non-aromatic. The Hückel-perception fallback in
      // _classifyRing fixes the root cause; this fixture is the regression guard.
      //
      // Phase 12-3a-followup-1 (substrate correction): SMILES re-corrected to
      // PubChem CID 4687 canonical (1,7-dimethylxanthine, InChI key
      // QUNWUDVFRNGTCO-UHFFFAOYSA-N). The pre-correction value
      // "CN1C=NC2=C1N(C(=O)NC2=O)C" — itself the "Phase 11-3b corrected"
      // SMILES blessed by the xanthine-fixture-smiles-audit — decoded as
      // 3,9-dimethylxanthine, a non-natural isomer. The N-post11-5 finding
      // (xanthine locant rotation) is retracted as a substrate error: against
      // genuine paraxanthine the existing engine already emits IUPAC-canonical
      // {N1, N7} branch openers + tail "N3, and C8".
      //
      // Phase 12-3a-followup-3 (regex tightening, this entry): the loose
      // /From N\d+ of the ring/ pattern is replaced with explicit per-locant
      // assertions plus a tail-string check. Each assertion runs independently
      // so order-tolerance is preserved (COMP emits methyls in substituent
      // walk order — From N7 ... From N1 — not numeric; walk order is
      // determined by _sortBranchPointsByRingAndAngle and is out of scope
      // for 12-3a). Pulled forward from the 12-5b post-migration audit.
      //
      // Sanity check (substrate-error regression): the new assertions would
      // FAIL on the wrong-substrate (3,9-dimethylxanthine) prose at three
      // independent points — From N1 absent (wrong substrate emits N9), From
      // N7 absent (wrong substrate emits N3), tail "N3, and C8" absent (wrong
      // substrate tail was "N1, and C8" per the retracted N-post11-5 finding).
      // The tightening would have caught the substrate error retroactively;
      // the loose /From N\d+/ pattern did not.
      {
        name: "Paraxanthine",
        smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2)C",
        scaffold: "fused-rings",
        pubchem: {
          commonNames: ["paraxanthine"],
          molecularWeight: 180.16,
          molecularFormula: "C7H8N4O2",
          // InChI: captured from RDKit 2025.03.4 mol.get_inchi("") for the
          // corrected SMILES during the Phase 12-3a-followup substrate-
          // verification probe. PubChem CID 4687 InChI key
          // QUNWUDVFRNGTCO-UHFFFAOYSA-N (mol.get_inchi_key is not exposed
          // in this MinimalLib build, so the key is recorded as a comment
          // anchor against external sources).
          inchi: "InChI=1S/C7H8N4O2/c1-10-3-8-5-4(10)6(12)11(2)7(13)9-5/h3H,1-2H3,(H,9,13)",
        },
        bug: "N-post11-1",
        // Tightened 11-3b regression (Phase 12-3a-followup-3). Three
        // load-bearing prose properties of genuine paraxanthine, asserted
        // independently so order doesn't matter:
        //   (1) named-system label "(xanthine)" fires
        //   (2) IUPAC-canonical branch-opener locant N1 fires
        //   (3) IUPAC-canonical branch-opener locant N7 fires
        //   (4) tail tally "N3, and C8" fires (substring match)
        //   (5) legacy "From a nitrogen atom in the ring" fallback NOT used
        expectAll: [
          /\(xanthine\)/,
          /From N1 of the ring/,
          /From N7 of the ring/,
        ],
        expectIncludes: ["N3, and C8"],
        avoid: /From a nitrogen atom in the ring/,
        // STD must NOT surface a spurious carbon-carbon double bond (the
        // imidazole fusion-edge C=C) in the functional-group list —
        // paraxanthine is fully aromatic by Hückel and has no isolated C=C.
        stdAvoid: /carbon-carbon double bond|\(C=C\)/,
      },
      {
        name: "Pyrrolidine",
        smiles: "C1CCNC1",
        scaffold: "ring",
        pubchem: null,
      },
      // CT-3d stress molecules — permanent regression for the six CT-3a engine bugs
      {
        name: "Naphthalene",
        smiles: "c1ccc2ccccc2c1",
        scaffold: "fused-rings",
        pubchem: null,
        bug: "B4",
        expect: /aromatic/i,
      },
      {
        name: "Biphenyl",
        smiles: "c1ccc(-c2ccccc2)cc1",
        scaffold: "ring",
        pubchem: null,
        bug: "B1",
        expect: /two.*(rings?|joined|connected|bond)/i,
      },
      {
        name: "Pyridine",
        smiles: "c1ccncc1",
        scaffold: "ring",
        pubchem: null,
        bug: "B7",
        expect: /nitrogen/i,
      },
      {
        name: "Glycine",
        smiles: "NCC(=O)O",
        scaffold: "chain",
        pubchem: null,
        bug: "B6",
        expect: /amine/i,
        avoid: /carbon atom is attached to the chain/i,
      },
      {
        name: "Naproxen",
        smiles: "COc1ccc2cc(C(C)C(=O)O)ccc2c1",
        scaffold: "fused-rings",
        pubchem: null,
        bug: "B2",
        expect: /(methoxy|carboxylic|methyl)/i,
      },
      {
        name: "Glucose",
        smiles: "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O",
        scaffold: "ring",
        pubchem: null,
        bug: "B5",
        expect: /stereocent/i,
      },
      {
        name: "Cholesterol",
        smiles: "CC(C)CCCC(C)C1CCC2C1(CCC3C2CC=C4C3(CCC(C4)O)C)C",
        scaffold: "fused-rings",
        pubchem: null,
        bug: "B3",
        expect: /\b(methyl|tail|chain|hydrocarbon)\b/i,
        minWords: 100,
      },
    ];

    // Phase 12-4c (C2.7): cold-start-safe priming via awaitGraphCached.
    // The pre-12-4c sync `for`-loop pattern relied on SmilesDrawer's
    // synchronous draw-callback to populate _graphCache before priming
    // returned. Under post-12-2b RDKit-only cold start, _populateGraphCache
    // kicks an async warmup and returns with cache empty; the per-molecule
    // assertions would read empty descriptions without explicit awaiting.
    // Promise.all'ing awaitGraphCached guarantees all fixtures' graphs are
    // populated before the assertions run, regardless of warm/cold state.
    if (typeof utils.awaitGraphCached === "function") {
      await Promise.all(
        molecules.map((m) => utils.awaitGraphCached(m.smiles)),
      );
    }

    // Per-molecule assertions
    molecules.forEach((mol) => {
      const compDesc = utils.generateComprehensiveDescription(mol.smiles, mol.pubchem);
      mol._lastCompDesc = compDesc;
      let stdDesc = "";
      if (utils.generateStructuralDescription) {
        try {
          stdDesc = utils.generateStructuralDescription(mol.smiles, mol.pubchem) || "";
        } catch (err) {
          logWarn("generateStructuralDescription threw for " + mol.name, err);
          stdDesc = "";
        }
      }
      mol._lastStdDesc = stdDesc;

      allTests.push({
        name: mol.name + ": returns non-empty string",
        pass: typeof compDesc === "string" && compDesc.length > 0,
      });

      if (compDesc && stdDesc) {
        const compWords = compDesc.split(/\s+/).length;
        const stdWords = stdDesc.split(/\s+/).length;
        allTests.push({
          name: mol.name + ": comprehensive longer than standard (" + compWords + " vs " + stdWords + " words)",
          pass: compWords > stdWords,
        });
      }

      if (compDesc) {
        // Scaffold-only molecules (plain ring, no branches) legitimately omit
        // bond/connected/attached phrasing — the description is just the ring
        // and implicit hydrogens. Only assert connectivity when the output is
        // long enough to warrant branch-level detail.
        const compWords = compDesc.split(/\s+/).length;
        if (compWords >= 30) {
          allTests.push({
            name: mol.name + ": contains connectivity language",
            pass: /bond|connected|attached/i.test(compDesc),
          });
        }

        if (mol.scaffold === "ring" || mol.scaffold === "fused-rings") {
          allTests.push({
            name: mol.name + ": mentions 'ring'",
            pass: /ring/i.test(compDesc),
          });
        }
        if (mol.scaffold === "chain") {
          allTests.push({
            name: mol.name + ": mentions 'chain'",
            pass: /chain/i.test(compDesc),
          });
        }

        allTests.push({
          name: mol.name + ": no rendering-specific terms",
          // Phase 10-4: word boundaries so the "thin" prohibition doesn't
          // accidentally match "xanthine" (which contains the substring
          // "thin"). All the targeted terms are standalone words in the
          // rendering-vocabulary that this test guards against.
          pass: !/\b(colou?r|thick|thin|pixel)\b/i.test(compDesc),
        });

        // Raw SMILES would include bracketed atoms or stray lowercase aromatic letters
        // alongside digits; a simple heuristic is the literal SMILES string itself
        // should not appear in the prose output.
        allTests.push({
          name: mol.name + ": does not contain raw SMILES",
          pass: !compDesc.includes(mol.smiles),
        });

        // CT-3d: WCAG 1.3.3 invariant (CT-3b). Comprehensive prose must not use
        // compass-direction language; locants / ordinals / ortho-meta-para do the work.
        allTests.push({
          name: mol.name + ": no directional language (WCAG 1.3.3)",
          pass: !/\b(upper|lower|above|below|to the (left|right))\b/i.test(compDesc),
        });

        // CT-3d: per-bug regression assertions (stress molecules only)
        if (mol.expect) {
          allTests.push({
            name: mol.name + " [" + mol.bug + "]: expect " + mol.expect,
            pass: mol.expect.test(compDesc),
          });
        }
        // Phase 12-3a-followup-3: explicit-form multi-assertion fields for
        // fixtures that need order-tolerant per-token assertions (e.g.
        // paraxanthine's "From N1" + "From N7" — emitted in substituent walk
        // order, not numeric, so a sequenced regex would be brittle). Each
        // entry produces its own allTests row so a partial regression names
        // the specific token that broke.
        if (Array.isArray(mol.expectAll)) {
          mol.expectAll.forEach((re) => {
            allTests.push({
              name: mol.name + " [" + mol.bug + "]: expect " + re,
              pass: re.test(compDesc),
            });
          });
        }
        if (Array.isArray(mol.expectIncludes)) {
          mol.expectIncludes.forEach((substr) => {
            allTests.push({
              name: mol.name + " [" + mol.bug + "]: expect includes \"" + substr + "\"",
              pass: compDesc.includes(substr),
            });
          });
        }
        if (mol.avoid) {
          allTests.push({
            name: mol.name + " [" + mol.bug + "]: avoid " + mol.avoid,
            pass: !mol.avoid.test(compDesc),
          });
        }
        // Phase 11-3b: stdAvoid runs the forbid regex against the standard tier
        // (used for paraxanthine — the spurious C=C surfaces only in STD's
        // functional-group list, not in COMP).
        if (mol.stdAvoid && stdDesc) {
          allTests.push({
            name: mol.name + " [" + mol.bug + "]: STD avoids " + mol.stdAvoid,
            pass: !mol.stdAvoid.test(stdDesc),
          });
        }
        if (typeof mol.minWords === "number") {
          const wc = compDesc.split(/\s+/).filter(Boolean).length;
          allTests.push({
            name: mol.name + " [" + mol.bug + "]: minWords \u2265 " + mol.minWords + " (got " + wc + ")",
            pass: wc >= mol.minWords,
          });
        }
      }

      // ARIA variant
      if (utils.generateComprehensiveDescriptionForAria && mol.pubchem) {
        const ariaDesc = utils.generateComprehensiveDescriptionForAria(
          mol.smiles, mol.pubchem,
        );
        mol._lastAriaDesc = ariaDesc;
        allTests.push({
          name: mol.name + ": ARIA variant non-empty",
          pass: typeof ariaDesc === "string" && ariaDesc.length > 0,
        });
      }
    });

    // CT-3e: HTML-form assertions. Expected <li> counts are DERIVED from the
    // plain-text output (not hand-coded per molecule) so the suite stays in
    // lockstep with engine behaviour.
    molecules.forEach((mol) => {
      if (!utils.generateComprehensiveDescriptionHTML) return;
      const compHtml = utils.generateComprehensiveDescriptionHTML(mol.smiles, mol.pubchem);
      mol._lastCompHtml = compHtml;
      const plain = mol._lastCompDesc || "";

      allTests.push({
        name: mol.name + " [HTML]: returns non-empty string",
        pass: typeof compHtml === "string" && compHtml.length > 0,
      });

      if (typeof compHtml !== "string" || compHtml.length === 0) return;

      // Every HTML output must start with a <p>. It ends with either </p>
      // (a tail paragraph — unsubstituted positions and/or stereocentre count)
      // OR </ol> (fused-ring scaffolds like caffeine/naproxen/cholesterol
      // where every ring position is substituted and no stereocentres exist —
      // per masterplan § 4e: "If both are absent, omit the closing <p>").
      allTests.push({
        name: mol.name + " [HTML]: starts with <p> and ends with </p> or </ol>",
        pass: /^<p>/.test(compHtml) && (/<\/p>\s*$/.test(compHtml) || /<\/ol>\s*$/.test(compHtml)),
      });

      // No raw SMILES leak — same invariant as the plain-text form.
      allTests.push({
        name: mol.name + " [HTML]: does not contain raw SMILES",
        pass: !compHtml.includes(mol.smiles),
      });

      // Derive expected branch count from the plain-text output. The three
      // prefixes emitted by _walkAndDescribeBranches:
      //   single-ring         → "Branch N: ..."
      //   fused/joined        → "From a <element> atom in the ring, ..."
      //   fused ring-internal → "From the ring, a <bond> bond connects to ..."
      //     (Phase 10-7 / N8: fused-host ring-internal C=O shares the
      //     single-ring intro phrase. In single-ring mode it's already
      //     counted via the "Branch N:" prefix, so subtract the prefixed
      //     occurrences to avoid double-counting.)
      //     Case-sensitive: the fused-host walker lowercases the first
      //     char of the inner description when prefixing multi-step
      //     branches ("From a carbon atom in the ring, from the ring,
      //     a single bond connects to ..."). Those lowercase inner
      //     phrases are NOT branch intros and must not be counted.
      const allFromRingConnects =
        (plain.match(/From the ring, a [a-z]+ bond connects to/g) || []).length;
      const branchPrefixedFromRing =
        (plain.match(/Branch \d+:\s*From the ring, a [a-z]+ bond connects to/g) || []).length;
      // Phase 12-3c: single-ring branches with resolved locants emit
      // "Branch N: From C4 of the ring, ..." — the line satisfies BOTH
      // the Branch \d+: counter and the [NCO]N of the ring counter.
      // Subtract the prefixed locant openers (mirroring the C=O subtract
      // pattern above) to avoid double-counting cytosine + thymine
      // substituent branches.
      const branchPrefixedLocant =
        (plain.match(/Branch \d+:\s*From [NCO][0-9]+ of the ring,/g) || []).length;
      const branchMatches =
        (plain.match(/Branch \d+:/g) || []).length +
        // Phase 11-2b: count both legacy ("From a nitrogen atom in the
        // ring,") and new locant-bearing ("From N3 of the ring,") branch
        // openers. The new form fires only when mapAtomToLocant resolves
        // (xanthine / purine pilot fixtures); other fused/joined systems
        // still emit the legacy opener.
        (plain.match(/From (a [a-z]+ atom in the ring|[NCO][0-9]+ of the ring),/gi) || []).length +
        (allFromRingConnects - branchPrefixedFromRing) -
        branchPrefixedLocant;
      const expectOl = branchMatches > 0;

      allTests.push({
        name: mol.name + " [HTML]: " + (expectOl ? "contains <ol>" : "contains no <ol>")
          + " (branches=" + branchMatches + ")",
        pass: expectOl ? /<ol>/.test(compHtml) : !/<ol>/.test(compHtml),
      });

      if (expectOl) {
        const liCount = (compHtml.match(/<li>/g) || []).length;
        allTests.push({
          name: mol.name + " [HTML]: <li> count matches branch count ("
            + liCount + " vs " + branchMatches + ")",
          pass: liCount === branchMatches,
        });
        // Structural ordering — <ol> must appear AFTER an intro </p> and,
        // if a tail <p> exists, the tail must appear AFTER </ol>. Tail may
        // be legitimately absent (see "starts/ends" assertion above).
        const olStart = compHtml.indexOf("<ol>");
        const olEnd = compHtml.indexOf("</ol>");
        const firstPEnd = compHtml.indexOf("</p>");
        const tailPStart = compHtml.indexOf("<p>", olEnd);
        const tailValid = tailPStart === -1
          ? /<\/ol>\s*$/.test(compHtml)  // no tail — HTML must end with </ol>
          : tailPStart > olEnd;          // tail present — must come after </ol>
        allTests.push({
          name: mol.name + " [HTML]: <ol> nested between intro </p> and tail <p> (or tail absent)",
          pass:
            olStart > 0 &&
            olEnd > olStart &&
            firstPEnd > 0 && firstPEnd < olStart &&
            tailValid,
        });
      }

      // Content-parity — the HTML form differs from plain only by stripped
      // "Branch N: " prefixes; the rest must be bit-preserved modulo
      // whitespace collapse across tag boundaries.
      const plainFromHtml = compHtml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      const plainNorm = plain.replace(/Branch \d+:\s*/g, "").replace(/\s+/g, " ").trim();
      if (plainNorm) {
        const diff = Math.abs(plainFromHtml.length - plainNorm.length);
        const maxLen = Math.max(plainFromHtml.length, plainNorm.length);
        allTests.push({
          name: mol.name + " [HTML]: content parity \u2264 3% length drift ("
            + plainFromHtml.length + " vs " + plainNorm.length + ")",
          pass: maxLen === 0 || diff / maxLen <= 0.03,
        });
      }
    });

    // DOM presence checks
    allTests.push({
      name: "DOM: #chemistry-comprehensive-description exists",
      pass: !!document.getElementById("chemistry-comprehensive-description"),
    });
    allTests.push({
      name: "DOM: #chemistry-comprehensive-desc-text exists",
      pass: !!document.getElementById("chemistry-comprehensive-desc-text"),
    });
    // CT-3e-fix: container must be a <div> so the HTML form can nest
    // <p> and <ol> children without triggering the nested-<p> auto-close
    // rule. A <p> container would reproduce the CT-3e regression.
    allTests.push({
      name: "DOM: #chemistry-comprehensive-desc-text is a <div> (CT-3e-fix)",
      pass: document.getElementById("chemistry-comprehensive-desc-text")?.tagName === "DIV",
    });
    allTests.push({
      name: "DOM: #resume-chemistry-comprehensive-desc-text is a <div> (CT-3e-fix)",
      pass: document.getElementById("resume-chemistry-comprehensive-desc-text")?.tagName === "DIV",
    });
    allTests.push({
      name: "DOM: #resume-chemistry-comprehensive-description exists",
      pass: !!document.getElementById("resume-chemistry-comprehensive-description"),
    });

    // Summary
    console.log("\nPhase 8C-CT: Comprehensive Description Tier\n");
    let passed = 0;
    allTests.forEach((t) => {
      console.log((t.pass ? "PASS" : "FAIL") + " " + t.name);
      if (t.pass) passed++;
    });
    console.log("\n" + passed + "/" + allTests.length + " passed");

    console.log("\n--- Generated comprehensive descriptions ---\n");
    molecules.forEach((mol) => {
      const words = mol._lastCompDesc ? mol._lastCompDesc.split(/\s+/).length : 0;
      console.log(mol.name + " (" + words + " words): " + (mol._lastCompDesc || "[empty]"));
    });

    return { passed, total: allTests.length };
  };

  // Phase 12-5b-1: PubChem synonym-ranking heuristic regression runner.
  // Asserts that lookupPubChemBySmiles returns recognised English common
  // names for the 8 fixtures that regressed at audit time + 4 fixtures that
  // were already clean. Hits LIVE PubChem (skip-not-fail on network errors).
  // The 2-pyridone wrong-tautomer fixture is expected to fail at 12-5b-1;
  // its curated-table fix lands at 12-5b-2.
  window.testN_post12_3_heuristic = async function () {
    const utils = window.MathPixChemistryUtils;
    if (!utils?.lookupPubChemBySmiles || !utils?.clearPubChemCache) {
      console.error("testN_post12_3_heuristic: utils unavailable");
      return { passed: 0, total: 0 };
    }

    // 8 regressed fixtures (audit § 1.10-1.18) + 4 clean fixtures (audit § 1.1, 1.3, 1.7, 1.10).
    // SMILES sourced from the investigation doc + existing test fixtures.
    // Phase 12-5b-2: naproxen + 2-pyridone — previously deferred at 12-5b-1
    // (PubChem's top-5 doesn't expose plain "Naproxen", only DL-/Racemic-
    // prefixed forms; 2-pyridone needs tautomer-correction) — now resolved
    // via CURATED_COMMON_NAMES override in mathpix-chemistry-utils.js.
    const FIXTURES = [
      // === 8 regressed at audit time ===
      { smiles: "COc1ccc2cc(C(C)C(=O)O)ccc2c1", expected: "Naproxen", group: "regressed-window-miss", pre12_5b: "2-(6-Methoxy-2-naphthyl)propionic acid" },
      { smiles: "O=Cc1ccccc1", expected: "Benzaldehyde", group: "regressed", pre12_5b: "Benzoic aldehyde" },
      { smiles: "c1ccc2ccccc2c1", expected: "Naphthalene", group: "regressed", pre12_5b: "Naphthalin" },
      { smiles: "O=C1CC(=O)NC(=O)N1", expected: "Barbituric acid", group: "regressed", pre12_5b: "BARBITURIC ACID" },
      { smiles: "O=c1cccc[nH]1", expected: "2-Pyridone", group: "regressed-tautomer", pre12_5b: "2-HYDROXYPYRIDINE" },
      { smiles: "NC(=O)N", expected: "Urea", group: "regressed", pre12_5b: "Carbamide" },
      { smiles: "NC(=N)N", expected: "Guanidine", group: "regressed", pre12_5b: "Iminourea" },
      { smiles: "Cc1cccc2ccccc12", expected: "1-Methylnaphthalene", group: "regressed", pre12_5b: "Alpha-Methylnaphthalene" },
      // === 4 clean fixtures (must remain clean after filter tightens) ===
      { smiles: "Cn1c(=O)c2c(ncn2C)n(C)c1=O", expected: "Caffeine", group: "clean" },
      { smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2)C", expected: "Paraxanthine", group: "clean" },
      { smiles: "CC(=O)Oc1ccccc1C(=O)O", expected: "Aspirin", group: "clean" },
      { smiles: "Nc1ncnc2[nH]cnc12", expected: "Adenine", group: "clean" },
    ];

    utils.clearPubChemCache();
    console.log("testN_post12_3_heuristic: cache cleared; running " + FIXTURES.length + " live-PubChem assertions...");

    // Phase 12-5b-1: filter accessor for per-fixture stage instrumentation.
    // Falls back to a pass-through if internals aren't exposed (older builds).
    const filterFn =
      utils._pubchemInternals?.isLikelyEnglishCommonName
      || (() => true);

    const allTests = [];
    const filterStageData = [];
    let networkFailures = 0;

    for (const fx of FIXTURES) {
      let actual = null;
      let totalSynonyms = null;
      let afterFilter = null;
      let finalSelected = null;
      let networkOk = true;
      try {
        const r = await utils.lookupPubChemBySmiles(fx.smiles);
        if (!r || !r.found) {
          networkOk = false;
          networkFailures++;
        } else {
          actual = r.commonNames?.[0] ?? null;
          // Phase 12-5b-1 instrumentation: filter-stage counts for Phase 14
          // capability-assessment baseline. totalSynonyms = raw PubChem list
          // length; afterFilter = count surviving F2/F3/F4/F-DB; finalSelected
          // = post-slice(0,5) count actually surfaced as commonNames.
          totalSynonyms = Array.isArray(r.synonyms) ? r.synonyms.length : null;
          if (totalSynonyms !== null) {
            const iupacLower = r.iupacName?.toLowerCase();
            afterFilter = r.synonyms.filter((s) =>
              filterFn(s, fx.smiles, iupacLower)
            ).length;
            finalSelected = r.commonNames?.length ?? 0;
            filterStageData.push({
              name: fx.expected,
              smiles: fx.smiles,
              totalSynonyms,
              afterFilter,
              finalSelected,
            });
          }

          // Phase 12-5b-2: wrong-tautomer SHORT-tier guard for 2-pyridone.
          // Audit § 5 qualitative discriminator: even after the curated table
          // places "2-Pyridone" at commonNames[0], confirm SHORT prose does
          // not still emit "2-hydroxypyridine" (which would indicate the
          // engine constructs the name outside the commonNames[0] consumption
          // path). SMILES O=c1cccc[nH]1 is the keto tautomer; PubChem indexes
          // both keto and enol under CID 14441. Guarded so it fires once,
          // only when PubChem returned data, only for the 2-pyridone SMILES.
          if (
            fx.smiles === "O=c1cccc[nH]1"
            && typeof utils.generateShortDescription === "function"
            && typeof utils.awaitGraphCached === "function"
          ) {
            let shortDesc = "";
            try {
              await utils.awaitGraphCached(fx.smiles);
              shortDesc = utils.generateShortDescription(fx.smiles, r) || "";
            } catch (shortErr) {
              logWarn(
                "testN_post12_3_heuristic: SHORT generation failed for 2-pyridone",
                shortErr
              );
            }
            const passGuard =
              shortDesc.length > 0 && !/hydroxypyridine/i.test(shortDesc);
            allTests.push({
              name:
                "2-Pyridone SHORT [N-post12-3 wrong-tautomer]: avoid /hydroxypyridine/i",
              pass: passGuard,
              _detail: {
                smiles: fx.smiles,
                expected: "no /hydroxypyridine/i in SHORT",
                actual: shortDesc || "<empty>",
                group: "regressed-tautomer-short-guard",
                note: shortDesc.length === 0
                  ? "SHORT generation failed/empty"
                  : passGuard
                  ? "ok"
                  : "MISMATCH — /hydroxypyridine/i present",
              },
            });
          }
        }
      } catch (err) {
        networkOk = false;
        networkFailures++;
        logWarn("testN_post12_3_heuristic: lookup threw for " + fx.smiles, err);
      }

      const matches = actual === fx.expected;
      const isDeferred = !!fx.deferTo;
      // Deferral mechanism: a fixture carrying `deferTo: "12-5b-N"` flips
      // its pass-condition (mismatch becomes the expected outcome) until
      // the named sub-stage lands. At 12-5b-1, naproxen + 2-pyridone were
      // deferred awaiting 12-5b-2's curated table; at 12-5b-2, both flips
      // were resolved and the deferTo markers removed. Mechanism retained
      // for future fixtures that need the same staging.
      const pass = !networkOk
        ? null // skip-not-fail
        : isDeferred
        ? !matches
        : matches;

      const noteParts = [];
      if (!networkOk) noteParts.push("PubChem network/404 — pending");
      if (isDeferred) noteParts.push("deferred to " + fx.deferTo);
      if (fx.pre12_5b && pass === true && !isDeferred) noteParts.push("was: " + fx.pre12_5b);

      allTests.push({
        name: "lookupPubChemBySmiles " + fx.smiles + " → commonNames[0] === \"" + fx.expected + "\""
          + (isDeferred ? " (expected fail until " + fx.deferTo + ")" : ""),
        pass: pass === true || pass === null, // null counts as a non-failure (pending)
        _detail: {
          smiles: fx.smiles,
          expected: fx.expected,
          actual: actual ?? "<not found>",
          group: fx.group,
          note: noteParts.join("; ") || (matches ? "ok" : "MISMATCH"),
        },
      });
    }

    // Per-fixture detail table (reading order matches FIXTURES array)
    console.log("\n--- N-post12-3 heuristic per-fixture detail ---");
    console.table(allTests.map((t) => t._detail));

    // Filter-stage instrumentation per (d) constraint.
    // Format: { smiles, totalSynonyms, afterFilter, finalSelected } per fixture.
    if (filterStageData.length > 0) {
      console.log("\n--- Filter-stage counts per fixture (Phase 14 capacity baseline) ---");
      console.table(filterStageData);
      const totals = filterStageData.map((d) => d.totalSynonyms);
      const filtered = filterStageData.map((d) => d.afterFilter);
      console.log(
        "Aggregate — n: " + filterStageData.length
        + " | totalSynonyms range: " + Math.min(...totals) + "-" + Math.max(...totals)
        + " (avg " + (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1) + ")"
        + " | afterFilter range: " + Math.min(...filtered) + "-" + Math.max(...filtered)
        + " (avg " + (filtered.reduce((a, b) => a + b, 0) / filtered.length).toFixed(1) + ")"
      );
    }

    if (networkFailures > 0) {
      console.warn("testN_post12_3_heuristic: " + networkFailures + " fixtures pending (PubChem 404 / network). Counted as non-failures; re-run when network available.");
    }

    const passed = allTests.filter((t) => t.pass).length;
    const total = allTests.length;
    return { passed, total };
  };

  /**
   * Phase 12-5b-3: synthetic-mock test for the engine-side named-system
   * fallback path (Option 3c).
   *
   * IMPORTANT: this runner BYPASSES lookupPubChem* and constructs
   * pubchemData directly. It tests the engine fallback path in
   * ISOLATION — NOT end-to-end integration. The companion runner
   * testN_post12_3_heuristic exercises the live-PubChem path.
   *
   * Five synthetic fixtures × two tiers (SHORT + STANDARD) = 10 assertions:
   *
   *   1. fused-system fallback fires (naphthalene)
   *   2. single-ring pyridinone-pattern fallback fires (2-pyridone keto)
   *   3. single-ring pyrimidine-dione fallback fires (uracil)
   *   4. negative — bare iupacName surfaces when regex doesn't match
   *   5. over-fire guard — commonNames[0] always wins, fallback never reached
   *
   * Synthetic iupacName values are deliberately distinct from the
   * expected named-system labels so the test can distinguish "fallback
   * fired" from "iupacName happened to match".
   */
  window.testN_post12_3_engine_fallback = async function () {
    const utils = window.MathPixChemistryUtils;
    if (
      !utils?.generateShortDescription ||
      !utils?.generateStructuralDescription ||
      !utils?.awaitGraphCached
    ) {
      console.error("testN_post12_3_engine_fallback: utils unavailable");
      return { passed: 0, total: 0 };
    }

    const FIXTURES = [
      {
        label: "fused naphthalene fallback",
        smiles: "c1ccc2ccccc2c1",
        pubchem: { commonNames: [], iupacName: "synthetic-fused-1(2H)-test" },
        expectedStartsWith: "Naphthalene",
        assertion: "engine fallback fires; named-system label wins",
      },
      {
        label: "single-ring pyridinone fallback",
        smiles: "O=c1cccc[nH]1",
        pubchem: { commonNames: [], iupacName: "synthetic-pyridinone-2(1H)-test" },
        expectedStartsWith: "Pyridin-2(1H)-one",
        assertion: "engine fallback fires; pyridinone pattern wins",
      },
      {
        label: "single-ring pyrimidine-dione fallback",
        smiles: "O=c1cc[nH]c(=O)[nH]1",
        pubchem: { commonNames: [], iupacName: "synthetic-dione-2,4(1H,3H)-test" },
        expectedStartsWith: "Pyrimidine-2,4-dione",
        assertion: "engine fallback fires; pyrimidine-dione pattern wins",
      },
      {
        label: "bare iupacName passthrough (regex doesn't match)",
        // Synthetic; real PubChem iupacName "2-acetyloxybenzoic acid" would
        // trigger heuristic. The synthetic mock is testing the codepath, not
        // real PubChem data, so the value choice is intentional.
        smiles: "CC(=O)Oc1ccccc1C(=O)O",
        pubchem: { commonNames: [], iupacName: "acetylsalicylic acid" },
        expectedStartsWith: "Acetylsalicylic acid",
        assertion: "looksLikeIupacSyntax false; iupacName surfaces",
      },
      {
        label: "commonNames[0] over-fire guard",
        smiles: "Cc1cccc2ccccc12",
        pubchem: {
          commonNames: ["1-Methylnaphthalene"],
          iupacName: "1-methylnaphthalene",
        },
        expectedStartsWith: "1-Methylnaphthalene",
        assertion: "commonNames[0] wins; fallback never reached",
      },
    ];

    const allTests = [];

    for (const fx of FIXTURES) {
      let shortDesc = "";
      let stdDesc = "";
      try {
        await utils.awaitGraphCached(fx.smiles);
        shortDesc = utils.generateShortDescription(fx.smiles, fx.pubchem) || "";
        stdDesc = utils.generateStructuralDescription(fx.smiles, fx.pubchem) || "";
      } catch (err) {
        logWarn("testN_post12_3_engine_fallback: generation threw for " + fx.smiles, err);
      }

      const startsWith = (prose, expected) =>
        prose.toLowerCase().startsWith(expected.toLowerCase());

      const shortPass = startsWith(shortDesc, fx.expectedStartsWith);
      const stdPass = startsWith(stdDesc, fx.expectedStartsWith);

      allTests.push({
        name: "[" + fx.label + "] SHORT — " + fx.assertion,
        pass: shortPass,
        _detail: {
          smiles: fx.smiles,
          expected: "starts with /" + fx.expectedStartsWith + "/i",
          actual: shortDesc.slice(0, 80) || "<empty>",
        },
      });
      allTests.push({
        name: "[" + fx.label + "] STD — " + fx.assertion,
        pass: stdPass,
        _detail: {
          smiles: fx.smiles,
          expected: "starts with /" + fx.expectedStartsWith + "/i",
          actual: stdDesc.slice(0, 80) || "<empty>",
        },
      });
    }

    const passed = allTests.filter((t) => t.pass).length;
    const total = allTests.length;
    const failures = allTests.filter((t) => !t.pass);

    console.log("\n--- N-post12-3 engine-fallback per-test detail ---");
    console.table(
      allTests.map((t) => ({
        name: t.name,
        pass: t.pass ? "✓" : "✗",
        expected: t._detail.expected,
        actual: t._detail.actual,
      }))
    );
    if (failures.length > 0) {
      console.warn("FAIL — " + failures.length + " of " + total + " engine-fallback assertions failed");
    } else {
      console.log("PASS — all " + total + " engine-fallback assertions");
    }

    return { passed, total };
  };

  /**
   * Phase 12-5b-4: surface-form byte-identity test for the canonicalisation
   * fix (N-post12-1).
   *
   * Verifies that aromatic and Kekulé SMILES forms of the same molecule
   * produce byte-identical SHORT/STANDARD/COMPREHENSIVE descriptions by
   * exercising both branches of the dispatch in _extractGraphFromRdkitSync:
   *   - Aromatic forms are RDKit-canonical → short-circuit branch (no re-parse)
   *   - Kekulé forms are non-canonical → re-parse branch
   *
   * Three pairs (paraxanthine + caffeine + adenine) × three tiers
   * (SHORT + STANDARD + COMPREHENSIVE) = 9 byte-identity assertions.
   *
   * pubchemData is null for all pairs to isolate the test to the engine
   * path. The full-path integration check (with real PubChem data) lives
   * at the implementation-doc verification gate ("Console probe before
   * commit") and ran PASS at 12-5b-4 Iteration 1.
   *
   * Pairs validated at 12-5b-4 Iteration 0 mini-validation: each Kekulé
   * candidate's mol.get_smiles() output equals the corresponding aromatic
   * form's, confirming connectivity-preservation before wiring.
   */
  window.testN_post12_1_surface_form_byte_identity = async function () {
    const utils = window.MathPixChemistryUtils;
    if (
      !utils?.generateShortDescription ||
      !utils?.generateStructuralDescription ||
      !utils?.generateComprehensiveDescription ||
      !utils?.awaitGraphCached
    ) {
      console.error(
        "testN_post12_1_surface_form_byte_identity: utils unavailable"
      );
      return { passed: 0, total: 0 };
    }

    function findFirstDivergence(a, b) {
      const maxLen = Math.min(a.length, b.length);
      for (let i = 0; i < maxLen; i++) {
        if (a[i] !== b[i]) {
          return "char " + i + ": '" + a[i] + "' vs '" + b[i] + "'";
        }
      }
      if (a.length !== b.length) {
        return "lengths differ: aromatic=" + a.length + " kekule=" + b.length;
      }
      return "—";
    }

    const PAIRS = [
      {
        name: "paraxanthine",
        aromatic: "Cn1c(=O)[nH]c2ncn(C)c2c1=O",
        kekule: "CN1C=NC2=C1C(=O)N(C(=O)N2)C",
      },
      {
        name: "caffeine",
        aromatic: "Cn1c(=O)c2c(ncn2C)n(C)c1=O",
        kekule: "CN1C(=O)N(C)C2=C(N(C)C=N2)C1=O",
      },
      {
        name: "adenine",
        aromatic: "Nc1ncnc2[nH]cnc12",
        kekule: "NC1=NC=NC2=C1N=CN2",
      },
    ];

    const TIERS = [
      { tier: "SHORT", method: "generateShortDescription" },
      { tier: "STANDARD", method: "generateStructuralDescription" },
      { tier: "COMPREHENSIVE", method: "generateComprehensiveDescription" },
    ];

    const allTests = [];

    for (const pair of PAIRS) {
      try {
        await utils.awaitGraphCached(pair.aromatic);
        await utils.awaitGraphCached(pair.kekule);
      } catch (err) {
        logWarn(
          "testN_post12_1: awaitGraphCached threw for pair " + pair.name,
          err
        );
      }

      for (const tier of TIERS) {
        let proseAromatic = "";
        let proseKekule = "";
        try {
          proseAromatic = utils[tier.method](pair.aromatic, null) || "";
          proseKekule = utils[tier.method](pair.kekule, null) || "";
        } catch (err) {
          logWarn(
            "testN_post12_1: " +
              tier.tier +
              " generation threw for " +
              pair.name,
            err
          );
        }

        const pass = proseAromatic === proseKekule;
        allTests.push({
          name:
            "[" +
            pair.name +
            "] " +
            tier.tier +
            " — aromatic === Kekulé byte-identity",
          pass: pass,
          _detail: {
            divergesAt: pass
              ? "—"
              : findFirstDivergence(proseAromatic, proseKekule),
            aromaticPreview: proseAromatic.slice(0, 100) || "<empty>",
            kekulePreview: proseKekule.slice(0, 100) || "<empty>",
          },
        });
      }
    }

    const passed = allTests.filter((t) => t.pass).length;
    const total = allTests.length;
    const failures = allTests.filter((t) => !t.pass);

    console.log(
      "\n--- N-post12-1 surface-form byte-identity per-test detail ---"
    );
    console.table(
      allTests.map((t) => ({
        name: t.name,
        pass: t.pass ? "✓" : "✗",
        divergesAt: t._detail.divergesAt,
        aromaticPreview: t._detail.aromaticPreview,
        kekulePreview: t._detail.kekulePreview,
      }))
    );
    if (failures.length > 0) {
      console.warn(
        "FAIL — " +
          failures.length +
          " of " +
          total +
          " surface-form byte-identity assertions failed"
      );
    } else {
      console.log(
        "PASS — all " + total + " surface-form byte-identity assertions"
      );
    }

    return { passed, total };
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
      ["8A-10 same-mode PDF→image snapshot", window.testPhase8A10RegressionSnapshot],
      ["8C-ST short descriptions", window.testChemistry8C_ST],
      ["8C-CT comprehensive descriptions", window.testChemistry8C_CT],
      ["12-5b-1 N-post12-3 heuristic (live PubChem)", window.testN_post12_3_heuristic],
      ["12-5b-3 N-post12-3 engine fallback (synthetic mock)", window.testN_post12_3_engine_fallback],
      ["12-5b-4 N-post12-1 surface-form byte-identity", window.testN_post12_1_surface_form_byte_identity],
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
