/**
 * MathPix Chemistry Description Migration Harness
 *
 * Phase 12-0a: re-runnable harness that captures the description engine's
 * COMP/STD/SHORT outputs for the 17-fixture post-11-2d audit set under the
 * current SmilesDrawer pipeline. Signature is stable across Phase 12 sub-
 * stages — the same harness re-runs unchanged at 12-5a against the post-
 * migration RDKit pipeline; only the call-site `source` arg differs.
 *
 * Public API (window):
 *   captureDescriptionBaseline()         — runs all 17 fixtures, returns
 *                                          the array of entries, downloads
 *                                          migration-baseline.json
 *   runMigrationHarness()                — same fixture sweep, returns the
 *                                          captured array. Compares against
 *                                          migration-baseline.json via
 *                                          compareMigrationResults.
 *
 * The harness consumes only the public API on window.MathPixChemistryUtils:
 *   - renderStructure()                  — primes the description graph cache
 *   - analyseStructure()                 — structured analysis snapshot
 *   - generateComprehensiveDescription() — COMP tier
 *   - generateStructuralDescription()    — STD tier
 *   - generateShortDescription()         — SHORT tier
 *
 * Phase 12-2b reroutes that public boundary to RDKit. Reaching into private
 * description-engine methods is out of scope.
 *
 * No PubChem data is supplied at capture time — the baseline measures pure
 * engine output for each SMILES. Live PubChem responses aren't reproducible
 * across runs and would make baseline diffs non-deterministic.
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

  // ---------------------------------------------------------------------
  // Post-11-2d audit fixture set (20 fixtures).
  //
  // SMILES sources (verified 2026-04-26):
  //   - Aspirin, Caffeine, Naphthalene, Naproxen, Paraxanthine — match the
  //     test-suite literal in mathpix-chemistry-tests.js.
  //   - Paraxanthine uses the Phase 12-3a-followup re-corrected PubChem CID
  //     4687 canonical (1,7-dimethylxanthine, InChI key
  //     QUNWUDVFRNGTCO-UHFFFAOYSA-N). The 11-3b "corrected" Kekulé form
  //     "CN1C=NC2=C1N(C(=O)NC2=O)C" was itself wrong — it decoded as
  //     3,9-dimethylxanthine, a non-natural isomer. The 11-3b xanthine
  //     SMILES audit caught the original audit-doc theobromine decode but
  //     missed this second-order error. Verified against five independent
  //     sources (Wikidata, MassBank, biosynth, smolecule); see
  //     xanthine-fixture-smiles-audit.md addendum.
  //   - Theobromine, Theophylline — audit-doc appendix
  //     (chemistry-description-plan-review-delta-post-10-8.md lines 472-488),
  //     not present in the test suite; verified in xanthine-fixture-smiles-audit.md.
  //   - Uracil, Cytosine, 2-Pyridone, Thymine, Adenine, Barbituric acid,
  //     Urea, Guanidine, 1-Methylnaphthalene, Benzaldehyde — audit-doc
  //     appendix; verified Mode F → E in non-xanthine-fixture-smiles-audit.md.
  //
  // Phase 14-1b additions (regression canaries; close zero-coverage paths
  // surfaced at 14-1a § 2.5):
  //   - Biphenyl — joined-non-fused-ring scaffold; closes
  //     _describeJoinedRingSystem zero-coverage.
  //   - Ethanol — multi-carbon chain (length=2); closes _orderChainAtoms
  //     multi-carbon branch zero-coverage.
  //   - (R)-2-butanol — stereocenter-bearing; closes _countStereocenters
  //     zero-coverage; seeds Phase 15 stereo work. Stereo descriptors are
  //     wired via the RDKit translator since 12-2a (vertex._rdkit.cipCode,
  //     edge._rdkit.stereo) but no consumer in the current engine — expected
  //     baseline contains no stereo prose.
  // ---------------------------------------------------------------------
  const FIXTURES = [
    { name: "Caffeine",            smiles: "Cn1c(=O)c2c(ncn2C)n(C)c1=O" },
    { name: "Theobromine",         smiles: "Cn1cnc2c1c(=O)[nH]c(=O)n2C" },
    { name: "Theophylline",        smiles: "Cn1c(=O)c2[nH]cnc2n(C)c1=O" },
    { name: "Paraxanthine",        smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2)C" },
    { name: "Uracil",              smiles: "O=c1cc[nH]c(=O)[nH]1" },
    { name: "Cytosine",            smiles: "Nc1cc[nH]c(=O)n1" },
    { name: "2-Pyridone",          smiles: "O=c1cccc[nH]1" },
    { name: "Thymine",             smiles: "Cc1c[nH]c(=O)[nH]c1=O" },
    { name: "Adenine",             smiles: "Nc1ncnc2[nH]cnc12" },
    { name: "Aspirin",             smiles: "CC(=O)Oc1ccccc1C(=O)O" },
    { name: "Naproxen",            smiles: "COc1ccc2cc(C(C)C(=O)O)ccc2c1" },
    { name: "Barbituric acid",     smiles: "O=C1CC(=O)NC(=O)N1" },
    { name: "Urea",                smiles: "NC(=O)N" },
    { name: "Guanidine",           smiles: "NC(=N)N" },
    { name: "Naphthalene",         smiles: "c1ccc2ccccc2c1" },
    { name: "1-Methylnaphthalene", smiles: "Cc1cccc2ccccc12" },
    { name: "Benzaldehyde",        smiles: "O=Cc1ccccc1" },
    { name: "Biphenyl",            smiles: "c1ccc(-c2ccccc2)cc1" },
    { name: "Ethanol",             smiles: "CCO" },
    { name: "(R)-2-butanol",       smiles: "C[C@@H](O)CC" },
  ];

  const BASELINE_FILENAME = "migration-baseline.json";

  // ---------------------------------------------------------------------
  // Phase 15-1b Tier 1 acceptance fixture set.
  //
  // The 15 fixtures locked at chemistry-phase15-plan.md § 5.2 +
  // prompt-phase15-1b-tier1-fixture-selection.md § Chemistry context, with
  // two side-assist authoritative pins documented in
  // phase15-1b-walkthrough.md §§ 1.6 + 1.7:
  //
  //   - #1 (S)-alanine: SMILES C[C@H](N)C(=O)O (NOT spec C[C@@H](N)C(=O)O
  //     which decodes to (R)-alanine; spec documents remain incoherent for
  //     the duration of 15-1b; three-document cleanup is post-seal hygiene).
  //   - #4 (R)-2-butanol: SMILES C[C@@H](O)CC (the migration-baseline-
  //     consistent form, not plan § 5.2's CC[C@H](C)O — both encode the
  //     same molecule).
  //
  // Per-fixture metadata fields (role, purpose, expectedCapabilities) are
  // set here from the spec; identity + stereo + baseline-snapshot fields
  // are populated at capture time by runTier1AcceptanceCapture().
  // ---------------------------------------------------------------------
  const TIER1_FIXTURES = [
    {
      idx: 1,
      name: "(S)-alanine",
      smiles: "C[C@H](N)C(=O)O",
      role: "Coverage",
      purpose: "Atom-level CIP consumer (R/S at α-carbon); Phase 15-2a wires consumer.",
      expectedCapabilities: ["cipPrefixInOpener", "cipDescriptorInCOMP"],
    },
    {
      idx: 2,
      name: "cis-2-butene",
      smiles: "C/C=C\\C",
      role: "Coverage",
      purpose: "Bond-level stereo consumer (cis/Z); Phase 15-2a wires consumer.",
      expectedCapabilities: ["alkeneGeometryInOpener"],
    },
    {
      idx: 3,
      name: "trans-2-butene",
      smiles: "C/C=C/C",
      role: "Disambig",
      purpose: "Bond-level stereo consumer (trans/E); disambiguates from #2; Phase 15-2a wires consumer.",
      expectedCapabilities: ["alkeneGeometryInOpener"],
    },
    {
      idx: 4,
      name: "(R)-2-butanol",
      smiles: "C[C@@H](O)CC",
      role: "Coverage",
      purpose: "Atom-level CIP consumer (R); already in migration baseline; Phase 15-2a wires consumer.",
      expectedCapabilities: ["cipPrefixInOpener", "cipDescriptorInCOMP"],
    },
    {
      idx: 5,
      name: "butan-1-ol",
      smiles: "CCCCO",
      role: "Disambig",
      purpose: "Chain locants — primary alcohol on terminal carbon; Phase 15-2b wires.",
      expectedCapabilities: ["chainLocantInName"],
    },
    {
      idx: 6,
      name: "butan-2-ol",
      smiles: "CCC(C)O",
      role: "Disambig",
      purpose: "Chain locants — secondary alcohol on internal carbon; Phase 15-2b wires.",
      expectedCapabilities: ["chainLocantInName"],
    },
    {
      idx: 7,
      name: "tert-butanol",
      smiles: "CC(C)(C)O",
      role: "Disambig",
      purpose: "Chain locants + branching — tertiary alcohol on quaternary carbon; Phase 15-2b wires.",
      expectedCapabilities: ["chainLocantInName"],
    },
    {
      idx: 8,
      name: "propionitrile",
      smiles: "CCC#N",
      role: "Coverage",
      purpose: "Nitrile group classification; Phase 15-2c adds.",
      expectedCapabilities: ["functionalGroupClassifier:nitrile"],
    },
    {
      idx: 9,
      name: "1-propanethiol",
      smiles: "CCCS",
      role: "Coverage",
      purpose: "Thiol group classification; Phase 15-2c adds.",
      expectedCapabilities: ["functionalGroupClassifier:thiol"],
    },
    {
      idx: 10,
      name: "dimethyl sulfoxide",
      smiles: "CS(=O)C",
      role: "Coverage",
      purpose: "Sulfoxide group classification; Phase 15-2c adds.",
      expectedCapabilities: ["functionalGroupClassifier:sulfoxide"],
    },
    {
      idx: 11,
      name: "diethyl ether",
      smiles: "CCOCC",
      role: "Coverage",
      purpose: "Acyclic ether group classification; Phase 15-2c adds.",
      expectedCapabilities: ["functionalGroupClassifier:etherAcyclic"],
    },
    {
      idx: 12,
      name: "methylamine",
      smiles: "CN",
      role: "Coverage",
      purpose: "1° amine subtype; Phase 15-2c adds.",
      expectedCapabilities: ["functionalGroupClassifier:amineSubtype1"],
    },
    {
      idx: 13,
      name: "dimethylamine",
      smiles: "CNC",
      role: "Coverage",
      purpose: "2° amine subtype; Phase 15-2c adds.",
      expectedCapabilities: ["functionalGroupClassifier:amineSubtype2"],
    },
    {
      idx: 14,
      name: "trimethylamine",
      smiles: "CN(C)C",
      role: "Coverage",
      purpose: "3° amine subtype; Phase 15-2c adds.",
      expectedCapabilities: ["functionalGroupClassifier:amineSubtype3"],
    },
    {
      idx: 15,
      name: "acetone",
      smiles: "CC(=O)C",
      role: "Sanity",
      purpose: "Ketone sanity canary — should already work; catches 15-2c classifier-ordering regressions.",
      expectedCapabilities: ["sanityNoRegression"],
    },
  ];

  // ---------------------------------------------------------------------
  // Capture pipeline (SmilesDrawer)
  // ---------------------------------------------------------------------

  // Prime the description-engine graph cache for one SMILES by rendering
  // it to a temporary offscreen canvas. SmilesDrawer's success callback
  // fires synchronously during draw(), populating the cache before we
  // call the description APIs.
  function _primeGraphCache(utils, smiles, canvas) {
    try {
      utils.renderStructure(smiles, canvas);
    } catch (err) {
      logWarn("renderStructure threw", {
        smiles,
        error: err && err.message,
      });
    }
  }

  function _captureFixtureSmilesdrawer(utils, fixture) {
    const entry = {
      name: fixture.name,
      smiles: fixture.smiles,
      comp: "",
      std: "",
      short: "",
      // Optional structured-data fields — populated from analyseStructure()
      // when available. Locants are not surfaced as structured data by the
      // public API; they appear only in the prose strings, so the field
      // stays null and 12-3a's locant fix is observed via prose diffs.
      functionalGroups: null,
      rings: null,
      chain: null,
      scaffoldType: null,
      locants: null,
    };

    try {
      entry.comp =
        utils.generateComprehensiveDescription(fixture.smiles, null) || "";
    } catch (err) {
      logWarn("generateComprehensiveDescription threw", {
        name: fixture.name,
        error: err && err.message,
      });
    }
    try {
      entry.std =
        utils.generateStructuralDescription(fixture.smiles, null) || "";
    } catch (err) {
      logWarn("generateStructuralDescription threw", {
        name: fixture.name,
        error: err && err.message,
      });
    }
    try {
      entry.short = utils.generateShortDescription(fixture.smiles, null) || "";
    } catch (err) {
      logWarn("generateShortDescription threw", {
        name: fixture.name,
        error: err && err.message,
      });
    }

    try {
      const analysis = utils.analyseStructure(fixture.smiles);
      if (analysis) {
        // Strip private fields (_graphData, _adjacency) — they aren't stable
        // across SmilesDrawer/RDKit and would make diffs noisy. Keep only
        // serialisable structured outputs.
        entry.functionalGroups = (analysis.functionalGroups || []).map(
          (g) => ({ shortName: g.shortName }),
        );
        entry.rings = (analysis.rings || []).map((r) => ({
          type: r.type || null,
          size:
            typeof r.size === "number"
              ? r.size
              : Array.isArray(r.atoms)
                ? r.atoms.length
                : null,
        }));
        entry.scaffoldType = analysis.scaffoldType || null;
        if (analysis.chain) {
          entry.chain = {
            length: analysis.chain.length || null,
            type: analysis.chain.type || null,
          };
        }
      }
    } catch (err) {
      logWarn("analyseStructure threw", {
        name: fixture.name,
        error: err && err.message,
      });
    }

    return entry;
  }

  async function _captureAllSmilesdrawer() {
    const utils = window.MathPixChemistryUtils;
    if (!utils || typeof utils.renderStructure !== "function") {
      logError(
        "MathPixChemistryUtils not available — cannot capture baseline",
      );
      return null;
    }
    if (
      typeof utils.generateComprehensiveDescription !== "function" ||
      typeof utils.generateStructuralDescription !== "function" ||
      typeof utils.generateShortDescription !== "function"
    ) {
      logError(
        "Description-engine APIs missing on MathPixChemistryUtils — check load order",
      );
      return null;
    }

    // Phase 12-2b: clear the graph cache before each sweep so flag-on /
    // flag-off runs don't see stale entries from a previous run. Without
    // this, switching the flag mid-session would mix SmilesDrawer-shape
    // and RDKit-shape entries in the same diff.
    if (typeof utils.clearGraphCache === "function") {
      utils.clearGraphCache();
    }

    // One offscreen canvas for the whole sweep. Matches the existing
    // testChemistry8C_CT pattern (mathpix-chemistry-tests.js around line 3258).
    const canvas = document.createElement("canvas");
    canvas.id = "migration-harness-canvas";
    canvas.width = 300;
    canvas.height = 300;
    canvas.style.position = "absolute";
    canvas.style.left = "-9999px";
    canvas.style.top = "-9999px";
    document.body.appendChild(canvas);

    const results = [];
    try {
      // Phase 12-2b: for…of with await per fixture. Under flag-on RDKit
      // cold-start, _populateGraphCache returns with the cache empty after
      // kicking off a warmup; awaitGraphCached blocks until that warmup
      // resolves so the description APIs see a populated cache.
      let idx = 0;
      for (const fixture of FIXTURES) {
        logInfo(
          "Capturing fixture " +
            fixture.name +
            " (" +
            (idx + 1) +
            "/" +
            FIXTURES.length +
            "): " +
            fixture.smiles,
        );
        _primeGraphCache(utils, fixture.smiles, canvas);
        if (typeof utils.awaitGraphCached === "function") {
          await utils.awaitGraphCached(fixture.smiles);
        }
        results.push(_captureFixtureSmilesdrawer(utils, fixture));
        idx++;
      }
    } finally {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    return results;
  }

  // ---------------------------------------------------------------------
  // Output helpers — Blob-driven download + console.table summary
  // ---------------------------------------------------------------------

  function _downloadJson(data, filename) {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revoke so the browser has time to start the download.
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1500);
      logInfo("Downloaded baseline as " + filename);
    } catch (err) {
      logWarn(
        "Blob download failed — copy(JSON.stringify(result, null, 2)) from console instead",
        { error: err && err.message },
      );
    }
  }

  function _logSummaryTable(results) {
    try {
      const summary = results.map(function (r) {
        return {
          name: r.name,
          smiles: r.smiles,
          compLength: r.comp ? r.comp.length : 0,
          stdLength: r.std ? r.std.length : 0,
          shortLength: r.short ? r.short.length : 0,
        };
      });
      // eslint-disable-next-line no-console
      console.table(summary);
    } catch (err) {
      logWarn("console.table failed", { error: err && err.message });
    }
  }

  // ---------------------------------------------------------------------
  // Public API — three console-callable entry points
  // ---------------------------------------------------------------------

  async function captureDescriptionBaseline() {
    const results = await _captureAllSmilesdrawer();
    if (!results) return null;
    _logSummaryTable(results);
    _downloadJson(results, BASELINE_FILENAME);
    return results;
  }

  async function runMigrationHarness() {
    const results = await _captureAllSmilesdrawer();
    if (!results) return null;
    _logSummaryTable(results);
    return results;
  }

  // ---------------------------------------------------------------------
  // Phase 12-2b: per-fixture diff helper for the harness gate triage. Compares
  // an RDKit-pipeline run against the committed SmilesDrawer-era baseline
  // with whitespace-normalisation; emits 160-char before/after previews for
  // changed cells so the user can scan the diff in one console.table call.
  // ---------------------------------------------------------------------

  function _normaliseForDiff(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  function _findFirstDiffOffset(a, b) {
    const min = Math.min(a.length, b.length);
    for (let i = 0; i < min; i++) {
      if (a[i] !== b[i]) return i;
    }
    // Strings equal up to min length; if lengths differ, that's the first diff
    return a.length === b.length ? -1 : min;
  }

  function compareMigrationResults(rdkitRun, baseline) {
    if (!Array.isArray(rdkitRun) || !Array.isArray(baseline)) return null;
    return rdkitRun.map(function (r, i) {
      const b = baseline[i] || {};
      const out = { name: r.name, smiles: r.smiles };
      const tiers = ["comp", "std", "short"];
      for (const t of tiers) {
        const same = _normaliseForDiff(r[t]) === _normaliseForDiff(b[t]);
        out[t + "Changed"] = !same;
        if (!same) {
          const bRaw = b[t] || "";
          const rRaw = r[t] || "";
          const offset = _findFirstDiffOffset(bRaw, rRaw);
          const windowStart = Math.max(0, offset - 80);
          const windowEnd = offset + 80;
          if (offset >= 0) out[t + "Offset"] = offset;
          out[t + "Before"] = bRaw.slice(windowStart, windowEnd);
          out[t + "After"] = rRaw.slice(windowStart, windowEnd);
        }
      }
      return out;
    });
  }

  // ---------------------------------------------------------------------
  // Phase 15-1b: Tier 1 acceptance capture (separate code path; does NOT
  // touch runMigrationHarness, _captureAllSmilesdrawer, or the 20-fixture
  // FIXTURES constant per side-assist discipline reminder at Step 3 OQ #5).
  //
  // runTier1AcceptanceCapture() drives a sweep of the 15 Tier 1 fixtures,
  // returning a wrapper object that conforms to the approved schema in
  // phase15-1b-walkthrough.md § 3 / § 4 (gate-approved at Step 3):
  //
  //   {
  //     schemaVersion: "1.0",
  //     tier: 1,
  //     description: <string>,
  //     generated: <UTC ISO-8601>,
  //     fixtures: [ /* 15 per-fixture objects */ ]
  //   }
  //
  // Each per-fixture object combines: (a) identity + stereo extracted from
  // RDKit via mol.get_smiles / mol.get_inchi / mol.get_descriptors /
  // mol.get_stereo_tags (the same extraction logic verify-tier1-smiles.js
  // uses), and (b) baseline-snapshot fields captured via the existing
  // _captureFixtureSmilesdrawer pipeline (same description-engine APIs as
  // the 20-fixture migration harness).
  // ---------------------------------------------------------------------

  function _stripParens(s) {
    return typeof s === "string" && s.startsWith("(") && s.endsWith(")")
      ? s.slice(1, -1)
      : s;
  }

  function _codeToNullable(raw) {
    const stripped = _stripParens(raw);
    if (
      stripped === "R" ||
      stripped === "S" ||
      stripped === "E" ||
      stripped === "Z"
    ) {
      return stripped;
    }
    // "?" denotes unspecified-but-perceived per the approved-schema null
    // contract (fixture #6 butan-2-ol case).
    return null;
  }

  function _captureTier1Identity(RDKit, fixture) {
    const result = {
      smilesCanonical: null,
      inchi: null,
      molFormula: null,
      heavyAtomCount: null,
      ringCount: null,
      numAromaticRings: null,
      stereoCenters: [],
      bondStereo: [],
    };

    let mol = null;
    try {
      mol = RDKit.get_mol(fixture.smiles);
      if (!mol || (typeof mol.is_valid === "function" && !mol.is_valid())) {
        logWarn("Tier 1 identity capture: invalid mol for " + fixture.name);
        return result;
      }

      try {
        if (typeof mol.get_smiles === "function") {
          result.smilesCanonical = mol.get_smiles();
        }
      } catch (e) {
        logWarn("mol.get_smiles threw for " + fixture.name, {
          error: e && e.message,
        });
      }
      try {
        if (typeof mol.get_inchi === "function") {
          result.inchi = mol.get_inchi("");
        }
      } catch (e) {
        logWarn("mol.get_inchi threw for " + fixture.name, {
          error: e && e.message,
        });
      }
      try {
        if (typeof mol.get_descriptors === "function") {
          const desc = JSON.parse(mol.get_descriptors() || "{}");
          result.heavyAtomCount =
            typeof desc.NumHeavyAtoms === "number" ? desc.NumHeavyAtoms : null;
          result.ringCount =
            typeof desc.NumRings === "number" ? desc.NumRings : null;
          result.numAromaticRings =
            typeof desc.NumAromaticRings === "number"
              ? desc.NumAromaticRings
              : null;
        }
      } catch (e) {
        logWarn("mol.get_descriptors threw for " + fixture.name, {
          error: e && e.message,
        });
      }

      // Formula from InChI layer (same approach as the engine's
      // mathpix-chemistry-utils.js parseInChIFormula at lines 282-336).
      if (result.inchi && typeof result.inchi === "string") {
        const parts = result.inchi.split("/");
        if (parts.length >= 2 && parts[1] && /^[A-Z]/.test(parts[1])) {
          result.molFormula = parts[1];
        }
      }

      // Stereo via mol.get_stereo_tags. CIP_atoms is 2-tuple
      // [atomIdx, code]; CIP_bonds is 3-tuple [atomIdx1, atomIdx2, code].
      // Empirically confirmed at Step 4 via
      // mathpix-scripts/testing/_probe-rdkit-bond-stereo.js (deleted).
      try {
        if (typeof mol.get_stereo_tags === "function") {
          const tags = JSON.parse(mol.get_stereo_tags() || "{}");

          if (Array.isArray(tags.CIP_atoms)) {
            for (const pair of tags.CIP_atoms) {
              if (Array.isArray(pair) && pair.length >= 2) {
                result.stereoCenters.push({
                  atomIdx: pair[0],
                  cipCode: _codeToNullable(pair[1]),
                });
              }
            }
            result.stereoCenters.sort((a, b) => a.atomIdx - b.atomIdx);
          }

          if (Array.isArray(tags.CIP_bonds) && tags.CIP_bonds.length > 0) {
            // Map (atomIdx1, atomIdx2) → bondIdx via get_json bonds[].atoms.
            let bondsList = [];
            try {
              if (typeof mol.get_json === "function") {
                const json = JSON.parse(mol.get_json() || "{}");
                const molecules = Array.isArray(json.molecules)
                  ? json.molecules
                  : [json];
                bondsList = (molecules[0] && molecules[0].bonds) || [];
              }
            } catch (e) {
              logWarn("get_json for CIP_bonds mapping threw for " + fixture.name, {
                error: e && e.message,
              });
            }
            const findBondIdx = (a, b) => {
              for (let bi = 0; bi < bondsList.length; bi++) {
                const atoms = bondsList[bi] && bondsList[bi].atoms;
                if (!atoms || atoms.length < 2) continue;
                if (
                  (atoms[0] === a && atoms[1] === b) ||
                  (atoms[0] === b && atoms[1] === a)
                ) {
                  return bi;
                }
              }
              return -1;
            };
            for (const triple of tags.CIP_bonds) {
              if (Array.isArray(triple) && triple.length >= 3) {
                const bondIdx = findBondIdx(triple[0], triple[1]);
                if (bondIdx >= 0) {
                  result.bondStereo.push({
                    bondIdx,
                    ezCode: _codeToNullable(triple[2]),
                  });
                }
              }
            }
            result.bondStereo.sort((a, b) => a.bondIdx - b.bondIdx);
          }
        }
      } catch (e) {
        logWarn("get_stereo_tags threw for " + fixture.name, {
          error: e && e.message,
        });
      }
    } catch (err) {
      logWarn("Tier 1 identity capture threw for " + fixture.name, {
        error: err && err.message,
      });
    } finally {
      if (mol) {
        try {
          mol.delete();
        } catch (e) {
          logWarn("mol.delete threw for " + fixture.name, {
            error: e && e.message,
          });
        }
      }
    }

    return result;
  }

  async function _captureAllTier1Acceptance() {
    const utils = window.MathPixChemistryUtils;
    if (!utils || typeof utils.renderStructure !== "function") {
      logError(
        "MathPixChemistryUtils not available — cannot capture Tier 1 acceptance",
      );
      return null;
    }
    if (
      typeof utils.generateComprehensiveDescription !== "function" ||
      typeof utils.generateStructuralDescription !== "function" ||
      typeof utils.generateShortDescription !== "function"
    ) {
      logError(
        "Description-engine APIs missing on MathPixChemistryUtils — check load order",
      );
      return null;
    }
    if (typeof window.initRDKitModule !== "function") {
      logError(
        "window.initRDKitModule unavailable — Tier 1 identity capture depends on RDKit-JS",
      );
      return null;
    }

    let RDKit;
    try {
      RDKit = await window.initRDKitModule();
    } catch (err) {
      logError("initRDKitModule rejected", {
        error: err && err.message,
      });
      return null;
    }
    if (!RDKit || typeof RDKit.get_mol !== "function") {
      logError("RDKit module loaded but get_mol unavailable");
      return null;
    }

    if (typeof utils.clearGraphCache === "function") {
      utils.clearGraphCache();
    }

    // Single offscreen canvas for the whole sweep — same pattern as
    // _captureAllSmilesdrawer.
    const canvas = document.createElement("canvas");
    canvas.id = "tier1-acceptance-harness-canvas";
    canvas.width = 300;
    canvas.height = 300;
    canvas.style.position = "absolute";
    canvas.style.left = "-9999px";
    canvas.style.top = "-9999px";
    document.body.appendChild(canvas);

    const fixtures = [];
    try {
      let idx = 0;
      for (const fx of TIER1_FIXTURES) {
        logInfo(
          "Capturing Tier 1 fixture #" +
            fx.idx +
            " " +
            fx.name +
            " (" +
            (idx + 1) +
            "/" +
            TIER1_FIXTURES.length +
            "): " +
            fx.smiles,
        );

        // Identity + stereo from RDKit directly.
        const identity = _captureTier1Identity(RDKit, fx);

        // Baseline snapshot via the same description-engine path the
        // 20-fixture harness uses. Reuses _captureFixtureSmilesdrawer to
        // keep the capture-pipeline contract single-sourced.
        _primeGraphCache(utils, fx.smiles, canvas);
        if (typeof utils.awaitGraphCached === "function") {
          await utils.awaitGraphCached(fx.smiles);
        }
        const baselineSnap = _captureFixtureSmilesdrawer(utils, {
          name: fx.name,
          smiles: fx.smiles,
        });

        fixtures.push({
          // Identity (Step-1-verified at file generation)
          idx: fx.idx,
          name: fx.name,
          smilesInput: fx.smiles,
          smilesCanonical: identity.smilesCanonical,
          inchi: identity.inchi,
          pubchemCID: null, // forward-compat hook; not fetched at capture (Q2)
          molFormula: identity.molFormula,
          heavyAtomCount: identity.heavyAtomCount,
          ringCount: identity.ringCount,
          numAromaticRings: identity.numAromaticRings,

          // Stereo
          stereoCenters: identity.stereoCenters,
          bondStereo: identity.bondStereo,

          // Tier-1 metadata (static; from TIER1_FIXTURES)
          role: fx.role,
          purpose: fx.purpose,
          expectedCapabilities: fx.expectedCapabilities.slice(),

          // Baseline snapshots (mirror migration-baseline.json shape)
          baseline: {
            comp: baselineSnap.comp,
            std: baselineSnap.std,
            short: baselineSnap.short,
            functionalGroups: baselineSnap.functionalGroups,
            rings: baselineSnap.rings,
            chain: baselineSnap.chain,
            scaffoldType: baselineSnap.scaffoldType,
            locants: baselineSnap.locants,
          },
        });

        idx++;
      }
    } finally {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    return fixtures;
  }

  async function runTier1AcceptanceCapture() {
    const fixtures = await _captureAllTier1Acceptance();
    if (!fixtures) return null;
    const wrapper = {
      schemaVersion: "1.0",
      tier: 1,
      description:
        "Tier 1 Phase 15-1b acceptance fixture set — pre-fix baselines captured pre-Phase-15-2.",
      generated: new Date().toISOString(), // UTC ISO-8601 per Step 3 OQ #1
      fixtures,
    };
    try {
      const summary = fixtures.map((f) => ({
        idx: f.idx,
        name: f.name,
        formula: f.molFormula,
        heavy: f.heavyAtomCount,
        rings: f.ringCount,
        stereoCenters: f.stereoCenters.length,
        bondStereo: f.bondStereo.length,
        compLen: f.baseline.comp ? f.baseline.comp.length : 0,
        stdLen: f.baseline.std ? f.baseline.std.length : 0,
        shortLen: f.baseline.short ? f.baseline.short.length : 0,
      }));
      // eslint-disable-next-line no-console
      console.table(summary);
    } catch (err) {
      logWarn("Tier 1 acceptance summary table failed", {
        error: err && err.message,
      });
    }
    return wrapper;
  }

  // Expose globally per the 12-0a acceptance criteria + 15-1b additions.
  window.captureDescriptionBaseline = captureDescriptionBaseline;
  window.runMigrationHarness = runMigrationHarness;
  window.compareMigrationResults = compareMigrationResults;
  window.runTier1AcceptanceCapture = runTier1AcceptanceCapture;

  logInfo(
    "Migration harness loaded (Phase 12-0a + 12-2a — async sweep with awaitGraphCached; compareMigrationResults helper exposed)",
  );
})();
