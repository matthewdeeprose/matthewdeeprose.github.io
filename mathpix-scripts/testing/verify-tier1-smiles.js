#!/usr/bin/env node
/**
 * @file verify-tier1-smiles.js
 * @description Phase 15-1b Step 1 — SMILES verification for the locked
 * Tier 1 fixture set (paraxanthine-defence: SMILES decode must match
 * the chemistry spec).
 *
 * Drives a headless Chromium browser via Playwright, loads tools.html
 * (where RDKit.js is registered via the unpkg script tag), initialises
 * RDKit.js in the page, and for each of the 15 Tier 1 fixtures extracts:
 *
 *   - canonical SMILES (mol.get_smiles())
 *   - full InChI (mol.get_inchi("")) — substitute for the InChI Key, which
 *     mol.get_inchi_key is NOT exposed on in the pinned RDKit MinimalLib
 *     build (see mathpix-chemistry-tests.js:3018 comment anchor)
 *   - molecular formula — parsed from the InChI formula layer (same
 *     approach the engine uses at mathpix-chemistry-utils.js:282-336)
 *   - heavy-atom count — JSON.parse(mol.get_descriptors()).NumHeavyAtoms
 *   - ring count — JSON.parse(mol.get_descriptors()).NumRings
 *
 * Output is printed to stdout as a JSON array (one entry per fixture)
 * AND as a human-readable table for paste into the walkthrough doc.
 *
 * Usage:
 *   node mathpix-scripts/testing/verify-tier1-smiles.js
 *
 * Exit codes:
 *   0 — success; all 15 fixtures probed (does NOT assert chemistry-correctness;
 *       comparison to the spec is performed off-line by the agent + side-assist)
 *   1 — tools.html not found
 *   2 — Chromium binary missing (run: npx playwright install chromium)
 *   3 — window.initRDKitModule unavailable on page (script tag missing or broken)
 *   4 — RDKit init failed (initRDKitModule rejected)
 *  99 — unhandled error
 *
 * Phase 15-1b only. After 15-1b SEAL, this script may be removed or kept
 * as durable verification infrastructure (decided at Step 3 schema approval).
 */

"use strict";

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
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
    console.error("[verify-tier1]", message, ...args);
}
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn("[verify-tier1]", message, ...args);
}
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log("[verify-tier1]", message, ...args);
}
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log("[verify-tier1]", message, ...args);
}

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const TOOLS_HTML_PATH = path.join(PROJECT_ROOT, "tools.html");
const TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------
// The 15 Tier 1 fixtures (locked per chemistry-phase15-plan.md § 5.2 +
// prompt-phase15-1b-tier1-fixture-selection.md § Chemistry context).
//
// SMILES forms match the prompt verbatim with TWO side-assist authoritative
// pins:
//
//   - Fixture #4 (R)-2-butanol: form is the migration-baseline-consistent
//     C[C@@H](O)CC, NOT the plan-table CC[C@H](C)O. Both encode the same
//     molecule; pinned at pre-Step-1 so tier1-acceptance.json stays
//     consistent with migration-baseline.json for the shared fixture.
//
//   - Fixture #1 (S)-alanine: form is C[C@H](N)C(=O)O (single character
//     flip @@ → @ vs spec). The original spec form C[C@@H](N)C(=O)O
//     decodes to (R)-alanine — InChI /m1 layer is (R) per PubChem CID
//     71080. Side-assist flagged at Step 1 paste-verify gate; user
//     authorised correction via side-assist authoritative pin (Option A
//     minimal-diff). Three-document correction (plan § 5.2 + prompt
//     § Chemistry context + companion § 3) tracked as post-15-1b-seal
//     hygiene followup. Spec-of-record for 15-1b is the corrected SMILES
//     below; spec documents remain incoherent for the duration of 15-1b.
// ---------------------------------------------------------------------
const TIER1_FIXTURES = [
  { idx:  1, name: "(S)-alanine",          smiles: "C[C@H](N)C(=O)O" },
  { idx:  2, name: "cis-2-butene",         smiles: "C/C=C\\C" },
  { idx:  3, name: "trans-2-butene",       smiles: "C/C=C/C" },
  { idx:  4, name: "(R)-2-butanol",        smiles: "C[C@@H](O)CC" },
  { idx:  5, name: "butan-1-ol",           smiles: "CCCCO" },
  { idx:  6, name: "butan-2-ol",           smiles: "CCC(C)O" },
  { idx:  7, name: "tert-butanol",         smiles: "CC(C)(C)O" },
  { idx:  8, name: "propionitrile",        smiles: "CCC#N" },
  { idx:  9, name: "1-propanethiol",       smiles: "CCCS" },
  { idx: 10, name: "dimethyl sulfoxide",   smiles: "CS(=O)C" },
  { idx: 11, name: "diethyl ether",        smiles: "CCOCC" },
  { idx: 12, name: "methylamine",          smiles: "CN" },
  { idx: 13, name: "dimethylamine",        smiles: "CNC" },
  { idx: 14, name: "trimethylamine",       smiles: "CN(C)C" },
  { idx: 15, name: "acetone",              smiles: "CC(=O)C" },
];

// ---------------------------------------------------------------------
// Parse CLI flags. Supports:
//   --only N    Filter TIER1_FIXTURES to a single idx (1-based). Useful
//               for paste-verify gate re-verification rounds where only
//               one fixture's data has changed (e.g. 15-1b fixture #1
//               re-verification after spec defect correction).
// ---------------------------------------------------------------------
function parseCliArgs(argv) {
  const args = { only: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--only" && i + 1 < argv.length) {
      const n = parseInt(argv[i + 1], 10);
      if (Number.isFinite(n) && n >= 1) {
        args.only = n;
      } else {
        logWarn("Ignoring invalid --only value:", argv[i + 1]);
      }
      i++;
    }
  }
  return args;
}

function pathToFileUrl(absPath) {
  const normalised = absPath.replace(/\\/g, "/");
  const withSlash = normalised.startsWith("/") ? normalised : "/" + normalised;
  return "file://" + encodeURI(withSlash);
}

// ---------------------------------------------------------------------
// Parse the formula layer from an InChI string.
// Mirrors mathpix-chemistry-utils.js parseInChIFormula (lines 282-336).
// InChI shape: InChI=<version>/<formula>/<connections>/<...>
// ---------------------------------------------------------------------
function parseInChIFormula(inchi) {
  if (!inchi || typeof inchi !== "string") return null;
  if (!inchi.startsWith("InChI=")) return null;
  const parts = inchi.split("/");
  if (parts.length < 2) return null;
  const formulaRaw = parts[1];
  if (!formulaRaw || !/^[A-Z]/.test(formulaRaw)) return null;
  return formulaRaw;
}

async function verifyAllFixtures(cli) {
  const fixtures = cli && cli.only
    ? TIER1_FIXTURES.filter((f) => f.idx === cli.only)
    : TIER1_FIXTURES;
  if (cli && cli.only && fixtures.length === 0) {
    logError("--only " + cli.only + " did not match any fixture idx");
    return { ok: false, exitCode: 1 };
  }
  if (cli && cli.only) {
    logInfo("Filtering to fixture idx=" + cli.only + " only (" + fixtures.length + " fixture)");
  }
  if (!fs.existsSync(TOOLS_HTML_PATH)) {
    logError("tools.html not found at:", TOOLS_HTML_PATH);
    return { ok: false, exitCode: 1 };
  }

  const fileUrl = pathToFileUrl(TOOLS_HTML_PATH);
  logInfo("Tools URL:", fileUrl);
  logInfo("Launching headless Chromium...");

  let browser = null;
  try {
    try {
      browser = await chromium.launch({ headless: true });
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      if (
        msg.includes("Executable doesn't exist") ||
        msg.includes("browserType.launch")
      ) {
        logError("Chromium binary not installed. Run: npx playwright install chromium");
        return { ok: false, exitCode: 2 };
      }
      throw err;
    }

    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT_MS);

    // Suppress page console noise (CORS errors from file:// loader); only
    // surface real errors with [verify-tier1] context.
    page.on("pageerror", (err) => {
      logWarn(
        "[page] uncaught:",
        err && err.message ? err.message : String(err),
      );
    });

    logInfo("Navigating to tools.html...");
    await page.goto(fileUrl, { waitUntil: "load", timeout: TIMEOUT_MS });

    logInfo("Waiting for window.initRDKitModule to register...");
    await page.waitForFunction(
      () => typeof window.initRDKitModule === "function",
      null,
      { timeout: TIMEOUT_MS },
    );

    logInfo("Initialising RDKit.js (~2 MB WASM)...");
    const rdkitReady = await page.evaluate(async () => {
      try {
        window.__rdkitForVerify = await window.initRDKitModule();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err && err.message ? err.message : String(err) };
      }
    });

    if (!rdkitReady.ok) {
      logError("RDKit init failed:", rdkitReady.error);
      return { ok: false, exitCode: 4 };
    }

    logInfo("RDKit ready. Probing " + fixtures.length + " fixture(s)...");

    const probeResults = await page.evaluate((fixtures) => {
      const RDKit = window.__rdkitForVerify;
      if (!RDKit || typeof RDKit.get_mol !== "function") {
        return { ok: false, error: "RDKit.get_mol unavailable post-init" };
      }
      const out = [];
      for (const fx of fixtures) {
        const row = {
          idx: fx.idx,
          name: fx.name,
          smilesInput: fx.smiles,
          smilesCanonical: null,
          inchi: null,
          molFormula: null,
          heavyAtomCount: null,
          ringCount: null,
          numAromaticRings: null,
          numAtomStereoCenters: null,
          // cipCodes: per-atom CIP descriptors from RDKit's rdkitRepresentation
          // extension. Shape: { atomIdx: "R" | "S", ... }. Empty object when
          // mol has no specified stereo. Mirrors the engine's extraction at
          // mathpix-chemistry-utils.js _extractGraphFromRdkit (rdkit-poc.html
          // lines 1290-1298 is the canonical reference).
          cipCodes: {},
          // stereoCenters: [{atomIdx, cipCode: "R"|"S"|null}] — per the
          // Phase 15-1b approved schema (walkthrough § 3, side-assist approval).
          // Includes UNSPECIFIED-configuration centres (cipCode: null), e.g.
          // fixture #6 butan-2-ol which has numAtomStereoCenters: 1 but no
          // /t/m/s InChI layer. Side-assist Step 4 instruction:
          //   "If RDKit's JSON doesn't surface unspecified centers, halt
          //    and surface; do not silently emit empty stereoCenters for #6."
          // Below path scans atoms[] for the `stereo` field (which RDKit emits
          // for unspecified centres too, as e.g. "either") and layers in CIP
          // codes from the rdkitRepresentation extension over it.
          stereoCenters: [],
          // bondStereo: [{bondIdx, ezCode: "E"|"Z"|null}] — per the Phase 15-1b
          // approved schema. Bond E/Z stereochemistry for double bonds.
          // Sourced from mol.get_stereo_tags() CIP_bonds. ezCode null when
          // RDKit perceives potential E/Z but configuration unspecified.
          bondStereo: [],
          parseValid: false,
          errors: [],
        };
        let mol = null;
        try {
          mol = RDKit.get_mol(fx.smiles);
          if (!mol || typeof mol.is_valid !== "function" || !mol.is_valid()) {
            row.errors.push("get_mol returned invalid mol");
          } else {
            row.parseValid = true;
            try {
              row.smilesCanonical =
                typeof mol.get_smiles === "function" ? mol.get_smiles() : null;
            } catch (e) {
              row.errors.push("get_smiles threw: " + (e && e.message));
            }
            try {
              row.inchi =
                typeof mol.get_inchi === "function" ? mol.get_inchi("") : null;
            } catch (e) {
              row.errors.push("get_inchi threw: " + (e && e.message));
            }
            try {
              if (typeof mol.get_descriptors === "function") {
                const descStr = mol.get_descriptors();
                const desc = JSON.parse(descStr || "{}");
                row.heavyAtomCount =
                  typeof desc.NumHeavyAtoms === "number"
                    ? desc.NumHeavyAtoms
                    : null;
                row.ringCount =
                  typeof desc.NumRings === "number" ? desc.NumRings : null;
                row.numAromaticRings =
                  typeof desc.NumAromaticRings === "number"
                    ? desc.NumAromaticRings
                    : null;
                row.numAtomStereoCenters =
                  typeof desc.NumAtomStereoCenters === "number"
                    ? desc.NumAtomStereoCenters
                    : null;
              }
            } catch (e) {
              row.errors.push("get_descriptors threw: " + (e && e.message));
            }
            try {
              // Primary stereo-extraction path: mol.get_stereo_tags() returns
              //   { CIP_atoms: [[atomIdx, "(R)"|"(S)"|"(?)"], ...],          // 2-tuple
              //     CIP_bonds: [[atomIdx1, atomIdx2, "(E)"|"(Z)"|"(?)"], ...]  // 3-tuple (atom pair!)
              //   }
              // NB. CIP_bonds entries are 3-tuples (atomIdx1, atomIdx2, code)
              // — RDKit identifies the bond by its endpoint atoms, NOT by
              // bondIdx. We map (atomIdx1, atomIdx2) → bondIdx by scanning
              // bonds[].atoms in the JSON.
              //
              // Crucially, get_stereo_tags surfaces UNSPECIFIED centres
              // as "(?)" — the path the atoms[].stereo + extensions.cipCodes
              // scan in the earlier draft missed for fixture #6 (RDKit JSON
              // didn't carry any field for the unspecified butan-2-ol centre).
              // Discovered empirically via _probe-rdkit-mol-methods.js +
              // _probe-rdkit-bond-stereo.js (probes deleted post-Step-4).
              if (typeof mol.get_stereo_tags === "function") {
                let tags;
                try {
                  tags = JSON.parse(mol.get_stereo_tags() || "{}");
                } catch (e) {
                  row.errors.push("get_stereo_tags parse threw: " + (e && e.message));
                  tags = {};
                }
                const stripParens = (s) =>
                  typeof s === "string" && s.startsWith("(") && s.endsWith(")")
                    ? s.slice(1, -1)
                    : s;
                const codeToNullable = (raw) => {
                  const stripped = stripParens(raw);
                  if (stripped === "R" || stripped === "S") return stripped;
                  if (stripped === "E" || stripped === "Z") return stripped;
                  // "?" denotes unspecified-but-perceived stereo per the
                  // approved-schema null contract.
                  return null;
                };

                // CIP_atoms: 2-tuple [atomIdx, code]
                if (Array.isArray(tags.CIP_atoms)) {
                  for (const triple of tags.CIP_atoms) {
                    if (Array.isArray(triple) && triple.length >= 2) {
                      const atomIdx = triple[0];
                      const cipCode = codeToNullable(triple[1]);
                      row.stereoCenters.push({ atomIdx, cipCode });
                      // Keep cipCodes map populated for back-compat with the
                      // table-formatter — only specified codes go here.
                      if (cipCode === "R" || cipCode === "S") {
                        row.cipCodes[String(atomIdx)] = cipCode;
                      }
                    }
                  }
                  row.stereoCenters.sort((a, b) => a.atomIdx - b.atomIdx);
                }

                // CIP_bonds: 3-tuple [atomIdx1, atomIdx2, code]
                // Map atom pair → bondIdx via JSON bonds[].atoms scan.
                if (Array.isArray(tags.CIP_bonds) && tags.CIP_bonds.length > 0) {
                  // Need the bond list to translate. Read it from get_json
                  // once for this fixture.
                  let bondsList = null;
                  try {
                    if (typeof mol.get_json === "function") {
                      const json = JSON.parse(mol.get_json() || "{}");
                      const molecules = Array.isArray(json.molecules)
                        ? json.molecules
                        : [json];
                      bondsList = (molecules[0] && molecules[0].bonds) || [];
                    }
                  } catch (e) {
                    row.errors.push(
                      "get_json for CIP_bonds mapping threw: " + (e && e.message),
                    );
                    bondsList = [];
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
                      const a = triple[0];
                      const b = triple[1];
                      const ezCode = codeToNullable(triple[2]);
                      const bondIdx = findBondIdx(a, b);
                      if (bondIdx < 0) {
                        row.errors.push(
                          "CIP_bonds entry [" + a + "," + b + "," + triple[2] +
                          "] did not match any bond in get_json bonds[]",
                        );
                        continue;
                      }
                      row.bondStereo.push({ bondIdx, ezCode });
                    }
                  }
                  row.bondStereo.sort((a, b) => a.bondIdx - b.bondIdx);
                }
              } else {
                row.errors.push(
                  "mol.get_stereo_tags unavailable in this RDKit MinimalLib build — Step 4 stereo extraction depends on it",
                );
              }

              // Halt-and-surface check (per side-assist Step 4 instruction):
              // if numAtomStereoCenters > 0 but stereoCenters is still empty,
              // surface as an error rather than silently emitting empty.
              if (
                row.numAtomStereoCenters &&
                row.numAtomStereoCenters > 0 &&
                row.stereoCenters.length === 0
              ) {
                row.errors.push(
                  "STEREO_EXTRACTION_MISS: numAtomStereoCenters=" +
                    row.numAtomStereoCenters +
                    " but get_stereo_tags returned no CIP_atoms entries",
                );
              }
            } catch (e) {
              row.errors.push("stereo extraction threw: " + (e && e.message));
            }
          }
        } catch (e) {
          row.errors.push("get_mol threw: " + (e && e.message));
        } finally {
          if (mol) {
            try {
              mol.delete();
            } catch (e) {
              row.errors.push("mol.delete threw: " + (e && e.message));
            }
          }
        }
        out.push(row);
      }
      return { ok: true, results: out };
    }, fixtures);

    if (!probeResults.ok) {
      logError("Probe failed:", probeResults.error);
      return { ok: false, exitCode: 99 };
    }

    // Decorate with parsed formula (from InChI) on the Node side — keeps
    // the in-page evaluate() block self-contained and side-effect-free.
    for (const row of probeResults.results) {
      row.molFormulaFromInChI = parseInChIFormula(row.inchi);
    }

    return { ok: true, exitCode: 0, results: probeResults.results };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (err) {
        logWarn(
          "browser.close() threw:",
          err && err.message ? err.message : String(err),
        );
      }
    }
  }
}

function _formatTable(rows) {
  // Compact pipe-table for paste into the walkthrough doc.
  const header = [
    "| # | Name | Input SMILES | Canonical SMILES | Formula (InChI) | Heavy atoms | Rings | Aromatic rings | Stereo centres | CIP codes | Parse |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  const body = rows.map((r) => {
    const cipDisplay = r.cipCodes && Object.keys(r.cipCodes).length > 0
      ? Object.entries(r.cipCodes)
          .map(([atomIdx, code]) => `atom ${atomIdx}: ${code}`)
          .join("; ")
      : "—";
    const cols = [
      r.idx,
      r.name,
      "`" + r.smilesInput + "`",
      r.smilesCanonical ? "`" + r.smilesCanonical + "`" : "—",
      r.molFormulaFromInChI || "—",
      r.heavyAtomCount === null ? "—" : r.heavyAtomCount,
      r.ringCount === null ? "—" : r.ringCount,
      r.numAromaticRings === null ? "—" : r.numAromaticRings,
      r.numAtomStereoCenters === null ? "—" : r.numAtomStereoCenters,
      cipDisplay,
      r.parseValid ? "✓" : "✗",
    ];
    return "| " + cols.join(" | ") + " |";
  });
  return header.concat(body).join("\n");
}

(async () => {
  try {
    const cli = parseCliArgs(process.argv);
    const { ok, exitCode, results } = await verifyAllFixtures(cli);
    if (!ok) {
      process.exit(exitCode);
    }
    // Print JSON and table to stdout (separate streams isn't needed; both
    // captured by the agent for the walkthrough doc).
    console.log("\n========== TIER 1 SMILES VERIFICATION (JSON) ==========");
    console.log(JSON.stringify(results, null, 2));
    console.log("\n========== TIER 1 SMILES VERIFICATION (TABLE) ==========");
    console.log(_formatTable(results));
    console.log("\n========== END ==========");
    process.exit(exitCode);
  } catch (err) {
    logError("Unhandled error:", err && err.stack ? err.stack : String(err));
    process.exit(99);
  }
})();
