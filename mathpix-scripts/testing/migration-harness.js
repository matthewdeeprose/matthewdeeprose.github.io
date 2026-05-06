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
          out[t + "Before"] = (b[t] || "").slice(0, 160);
          out[t + "After"] = (r[t] || "").slice(0, 160);
        }
      }
      return out;
    });
  }

  // Expose globally per the 12-0a acceptance criteria.
  window.captureDescriptionBaseline = captureDescriptionBaseline;
  window.runMigrationHarness = runMigrationHarness;
  window.compareMigrationResults = compareMigrationResults;

  logInfo(
    "Migration harness loaded (Phase 12-0a + 12-2a — async sweep with awaitGraphCached; compareMigrationResults helper exposed)",
  );
})();
