#!/usr/bin/env node
/**
 * @file audit-capture.js
 * @description Phase 14-2 Step 2 audit-capture orchestrator.
 *
 * Drives a headless Chromium browser via Playwright to capture the
 * 20-fixture chemistry-description harness output (COMP/STD/SHORT tiers
 * + structured analysis fields) and writes it to
 * audit-snapshots/audit-snapshot-{ISO-date}.json. The captured JSON is
 * required to be byte-identical (post jq -S canonicalisation) to
 * mathpix-scripts/testing/migration-baseline.json — verified at Step 3.
 *
 * Usage:
 *   npm run audit:capture
 *
 * Prerequisites:
 *   - Node >=22 (see package.json engines)
 *   - npm install (installs playwright + node_modules)
 *   - npx playwright install chromium (~120MB one-time download)
 *
 * Or run the bundled setup script: npm run setup
 *
 * Exit codes:
 *   0 — success; snapshot written
 *   1 — tools.html not found at expected path
 *   2 — Chromium binary missing (run: npx playwright install chromium)
 *   3 — runMigrationHarness not present after _chemistryReady resolved
 *       (indicates tools.html load order or migration-harness.js wiring issue)
 *   4 — captured results failed validation (wrong fixture count, missing
 *       keys, empty tier strings)
 *  99 — unhandled error; check stack trace
 *
 * @see mathpix-scripts/docs/phase14-2-step-0-cold-start-race.md
 * @see mathpix-scripts/docs/phase14-2-step-1-0-walkthrough.md
 * @see mathpix-scripts/docs/audit-capture-usage.md (multi-machine setup; Step 4)
 */

"use strict";

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

// =========================================================================
// Logging configuration (per CLAUDE.md standards; British spelling)
// =========================================================================

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
    console.error("[audit-capture]", message, ...args);
}
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn("[audit-capture]", message, ...args);
}
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log("[audit-capture]", message, ...args);
}
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log("[audit-capture]", message, ...args);
}

// =========================================================================
// Paths + constants
// =========================================================================

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const TOOLS_HTML_PATH = path.join(PROJECT_ROOT, "tools.html");
const SNAPSHOTS_DIR = path.join(PROJECT_ROOT, "audit-snapshots");
// Phase 15-1b post-Step-5 location correction: tier1-acceptance.json lives
// alongside migration-baseline.json under mathpix-scripts/testing/, NOT at
// project root. The OQ #6 co-location rationale held; the path assumption
// (migration-baseline.json at project root) was wrong. Side-assist correction
// at Step 5 paste-verify gate. See phase15-1b-walkthrough.md § 5.7.
const TIER1_ACCEPTANCE_PATH = path.join(
  PROJECT_ROOT,
  "mathpix-scripts",
  "testing",
  "tier1-acceptance.json",
);
const TIMEOUT_MS = 60_000;
const EXPECTED_FIXTURE_COUNT = 20;
// Phase 15-1b: tier1 fixture-set capture target (per approved schema in
// phase15-1b-walkthrough.md § 3).
const TIER1_EXPECTED_FIXTURE_COUNT = 15;
// Per migration-harness.js:139-154 each fixture entry carries 10 keys.
// The 5 prose-tier fields (name, smiles, comp, std, short) MUST be
// populated; the 5 metadata fields (functionalGroups, rings, chain,
// scaffoldType, locants) can legitimately be null when analyseStructure
// throws or returns nothing. Validation checks PRESENCE for all 10, then
// non-empty-string for the prose-tier subset.
const EXPECTED_KEYS = [
  "name",
  "smiles",
  "comp",
  "std",
  "short",
  "functionalGroups",
  "rings",
  "chain",
  "scaffoldType",
  "locants",
];
const PROSE_TIER_KEYS = ["name", "smiles", "comp", "std", "short"];

// =========================================================================
// Helpers
// =========================================================================

function isoDateString() {
  // YYYY-MM-DD — local timezone; same-day re-runs overwrite (simpler invariant
  // than per-second timestamps; the canonical artefact is migration-baseline.json,
  // snapshots are ephemeral evidence).
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function pathToFileUrl(absPath) {
  // Convert OS path to file:// URL. Handles Windows drive letters + spaces
  // (the project lives at a path containing "OneDrive - University of...").
  const normalised = absPath.replace(/\\/g, "/");
  const withSlash = normalised.startsWith("/") ? normalised : "/" + normalised;
  return "file://" + encodeURI(withSlash);
}

function ensureSnapshotsDir() {
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    logInfo("Created snapshots directory:", SNAPSHOTS_DIR);
  }
}

// ---------------------------------------------------------------------
// CLI parsing (Phase 15-1b)
//
//   --fixture-set default   (default) Drives 20-fixture migration-baseline
//                           capture via runMigrationHarness(); writes
//                           audit-snapshots/audit-snapshot-{ISO-date}.json.
//   --fixture-set tier1     Drives 15-fixture Tier 1 acceptance capture via
//                           runTier1AcceptanceCapture(); writes
//                           tier1-acceptance.json at project root.
// ---------------------------------------------------------------------
function parseCliArgs(argv) {
  const args = { fixtureSet: "default" };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--fixture-set" && i + 1 < argv.length) {
      const val = argv[i + 1];
      if (val === "default" || val === "tier1") {
        args.fixtureSet = val;
      } else {
        logError(
          "Unknown --fixture-set value: " +
            val +
            " (allowed: default, tier1)",
        );
        process.exit(1);
      }
      i++;
    }
  }
  return args;
}

// ---------------------------------------------------------------------
// Tier 1 wrapper-object validation (15-1b approved schema)
// ---------------------------------------------------------------------
const TIER1_FIXTURE_REQUIRED_KEYS = [
  "idx",
  "name",
  "smilesInput",
  "smilesCanonical",
  "inchi",
  "pubchemCID",
  "molFormula",
  "heavyAtomCount",
  "ringCount",
  "numAromaticRings",
  "stereoCenters",
  "bondStereo",
  "role",
  "purpose",
  "expectedCapabilities",
  "baseline",
];
const TIER1_BASELINE_REQUIRED_KEYS = [
  "comp",
  "std",
  "short",
  "functionalGroups",
  "rings",
  "chain",
  "scaffoldType",
  "locants",
];
function validateTier1Wrapper(wrapper) {
  if (!wrapper || typeof wrapper !== "object" || Array.isArray(wrapper)) {
    return "Expected wrapper object; got " + (Array.isArray(wrapper) ? "array" : typeof wrapper);
  }
  if (wrapper.schemaVersion !== "1.0") return "schemaVersion must be '1.0'";
  if (wrapper.tier !== 1) return "tier must be 1";
  if (typeof wrapper.description !== "string" || wrapper.description.length === 0)
    return "description must be a non-empty string";
  if (typeof wrapper.generated !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(wrapper.generated))
    return "generated must be a UTC ISO-8601 string";
  if (!Array.isArray(wrapper.fixtures))
    return "fixtures must be an array";
  if (wrapper.fixtures.length !== TIER1_EXPECTED_FIXTURE_COUNT)
    return "Expected " + TIER1_EXPECTED_FIXTURE_COUNT + " fixtures; got " + wrapper.fixtures.length;
  for (let i = 0; i < wrapper.fixtures.length; i++) {
    const fx = wrapper.fixtures[i];
    if (!fx || typeof fx !== "object")
      return "Fixture " + i + ": not an object";
    for (const k of TIER1_FIXTURE_REQUIRED_KEYS) {
      if (!(k in fx))
        return "Fixture " + i + " (" + (fx.name || "?") + "): missing key '" + k + "'";
    }
    if (fx.idx !== i + 1)
      return "Fixture " + i + ": idx mismatch (expected " + (i + 1) + ", got " + fx.idx + ")";
    if (typeof fx.smilesInput !== "string" || fx.smilesInput.length === 0)
      return "Fixture " + i + " (" + fx.name + "): smilesInput empty";
    if (typeof fx.smilesCanonical !== "string" || fx.smilesCanonical.length === 0)
      return "Fixture " + i + " (" + fx.name + "): smilesCanonical empty";
    if (typeof fx.inchi !== "string" || !fx.inchi.startsWith("InChI="))
      return "Fixture " + i + " (" + fx.name + "): inchi not a valid InChI string";
    if (!Array.isArray(fx.stereoCenters))
      return "Fixture " + i + " (" + fx.name + "): stereoCenters not an array";
    if (!Array.isArray(fx.bondStereo))
      return "Fixture " + i + " (" + fx.name + "): bondStereo not an array";
    if (!Array.isArray(fx.expectedCapabilities))
      return "Fixture " + i + " (" + fx.name + "): expectedCapabilities not an array";
    if (!fx.baseline || typeof fx.baseline !== "object")
      return "Fixture " + i + " (" + fx.name + "): baseline missing or not an object";
    for (const k of TIER1_BASELINE_REQUIRED_KEYS) {
      if (!(k in fx.baseline))
        return "Fixture " + i + " (" + fx.name + "): baseline missing key '" + k + "'";
    }
    for (const k of ["comp", "std", "short"]) {
      if (typeof fx.baseline[k] !== "string" || fx.baseline[k].length === 0)
        return "Fixture " + i + " (" + fx.name + "): baseline.'" + k + "' empty or non-string";
    }
  }
  return null;
}

function validateResults(results) {
  if (!Array.isArray(results)) {
    return `Expected array; got ${typeof results}`;
  }
  if (results.length !== EXPECTED_FIXTURE_COUNT) {
    return `Expected ${EXPECTED_FIXTURE_COUNT} fixtures; got ${results.length}`;
  }
  for (let i = 0; i < results.length; i++) {
    const entry = results[i];
    if (!entry || typeof entry !== "object") {
      return `Fixture ${i}: entry is not an object`;
    }
    // Presence check across all 10 keys (metadata fields permitted to be null)
    for (const key of EXPECTED_KEYS) {
      if (!(key in entry)) {
        return `Fixture ${i} (${entry.name || "?"}): missing key "${key}"`;
      }
    }
    // Prose-tier subset MUST be non-empty strings
    for (const key of PROSE_TIER_KEYS) {
      if (typeof entry[key] !== "string" || entry[key].length === 0) {
        return `Fixture ${i} (${entry.name || "?"}): prose-tier key "${key}" empty or non-string`;
      }
    }
  }
  return null; // PASS
}

// =========================================================================
// Main capture orchestration
// =========================================================================

async function captureAuditSnapshot(fixtureSet) {
  const set = fixtureSet || "default";
  if (set === "tier1") {
    logInfo("Phase 15-1b — Tier 1 acceptance capture starting");
  } else {
    logInfo("Phase 14-2 Step 2 — audit-capture starting");
  }
  logInfo("Project root:", PROJECT_ROOT);
  logInfo("Tools HTML:", TOOLS_HTML_PATH);
  logInfo("Fixture set:", set);

  if (!fs.existsSync(TOOLS_HTML_PATH)) {
    logError("tools.html not found at:", TOOLS_HTML_PATH);
    return { ok: false, exitCode: 1 };
  }

  // SNAPSHOTS_DIR only needed for default-set capture; tier1 writes to
  // project root.
  if (set !== "tier1") {
    ensureSnapshotsDir();
  }

  const fileUrl = pathToFileUrl(TOOLS_HTML_PATH);
  logInfo("File URL:", fileUrl);

  let browser = null;
  try {
    logInfo("Launching headless Chromium...");
    try {
      browser = await chromium.launch({ headless: true });
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      // Playwright's missing-binary error message includes "Executable doesn't
      // exist" or references browserType.launch failure. Match either.
      if (
        msg.includes("Executable doesn't exist") ||
        msg.includes("browserType.launch")
      ) {
        logError("Chromium binary not installed.");
        logError("Run: npx playwright install chromium");
        logError("Or:  npm run setup  (installs deps + Chromium in one step)");
        return { ok: false, exitCode: 2 };
      }
      throw err;
    }

    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT_MS);

    // Forward page console messages to Node console for diagnosis.
    // INFO/log messages are suppressed by default (DEBUG level) to keep
    // capture output readable; WARN + ERROR surface for triage.
    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === "error") logError("[page]", text);
      else if (type === "warning") logWarn("[page]", text);
      else logDebug("[page:" + type + "]", text);
    });
    page.on("pageerror", (err) => {
      logError(
        "[page] uncaught:",
        err && err.message ? err.message : String(err),
      );
    });

    logInfo("Navigating to tools.html...");
    await page.goto(fileUrl, { waitUntil: "load", timeout: TIMEOUT_MS });

    logInfo(
      "Awaiting window._chemistryReady (Race A primitive from Step 1)...",
    );
    await page.evaluate(() => window._chemistryReady);

    // Branch on fixture set — default path uses runMigrationHarness (20-fixture
    // byte-identical canary); tier1 path uses runTier1AcceptanceCapture
    // (15-fixture acceptance set per Phase 15-1b approved schema).
    if (set === "tier1") {
      const harnessAvailable = await page.evaluate(
        () => typeof window.runTier1AcceptanceCapture === "function",
      );
      if (!harnessAvailable) {
        logError(
          "window.runTier1AcceptanceCapture not present after _chemistryReady resolved.",
        );
        logError(
          "Check tools.html load order; migration-harness.js should expose the Tier 1 API.",
        );
        return { ok: false, exitCode: 3 };
      }
      logInfo(
        "Invoking runTier1AcceptanceCapture() — capturing 15-fixture Tier 1 acceptance set...",
      );
      const t0 = Date.now();
      const wrapper = await page.evaluate(async () => {
        // eslint-disable-next-line no-undef
        return await window.runTier1AcceptanceCapture();
      });
      const elapsed = Date.now() - t0;
      logInfo("Tier 1 capture completed in", elapsed, "ms");

      const validationError = validateTier1Wrapper(wrapper);
      if (validationError) {
        logError("Tier 1 validation failed:", validationError);
        return { ok: false, exitCode: 4 };
      }

      const json = JSON.stringify(wrapper, null, 2) + "\n";
      fs.writeFileSync(TIER1_ACCEPTANCE_PATH, json, "utf8");
      logInfo("Tier 1 acceptance written:", TIER1_ACCEPTANCE_PATH);
      logInfo(
        "File size:",
        json.length,
        "bytes;",
        wrapper.fixtures.length,
        "fixtures",
      );

      return {
        ok: true,
        exitCode: 0,
        snapshotPath: TIER1_ACCEPTANCE_PATH,
        fixtureCount: wrapper.fixtures.length,
      };
    }

    // Default fixture-set: 20-fixture migration baseline capture.
    logInfo("Verifying runMigrationHarness availability...");
    const harnessAvailable = await page.evaluate(
      () => typeof window.runMigrationHarness === "function",
    );
    if (!harnessAvailable) {
      logError(
        "window.runMigrationHarness not present after _chemistryReady resolved.",
      );
      logError(
        "Check tools.html load order; migration-harness.js script tag should load after chemistry block.",
      );
      return { ok: false, exitCode: 3 };
    }

    logInfo(
      "Invoking runMigrationHarness() — capturing 20-fixture description engine output...",
    );
    const t0 = Date.now();
    const results = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      return await window.runMigrationHarness();
    });
    const elapsed = Date.now() - t0;
    logInfo("Harness completed in", elapsed, "ms");

    const validationError = validateResults(results);
    if (validationError) {
      logError("Validation failed:", validationError);
      return { ok: false, exitCode: 4 };
    }

    const snapshotPath = path.join(
      SNAPSHOTS_DIR,
      `audit-snapshot-${isoDateString()}.json`,
    );
    // Match migration-baseline.json formatting: JSON.stringify(data, null, 2)
    // followed by trailing newline. byte-identical equality at Step 3 uses
    // jq -S canonicalisation so trailing-newline differences are tolerated,
    // but matching the convention keeps raw file diffs clean.
    const json = JSON.stringify(results, null, 2) + "\n";
    fs.writeFileSync(snapshotPath, json, "utf8");
    logInfo("Snapshot written:", snapshotPath);
    logInfo(
      "Snapshot size:",
      json.length,
      "bytes;",
      results.length,
      "fixtures",
    );

    return {
      ok: true,
      exitCode: 0,
      snapshotPath,
      fixtureCount: results.length,
    };
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

// =========================================================================
// Entrypoint
// =========================================================================

(async () => {
  try {
    const cli = parseCliArgs(process.argv);
    const { ok, exitCode, snapshotPath, fixtureCount } =
      await captureAuditSnapshot(cli.fixtureSet);
    if (ok) {
      logInfo(
        `SUCCESS — captured ${fixtureCount} fixtures to ${snapshotPath}`,
      );
      if (cli.fixtureSet === "tier1") {
        logInfo(
          "Next: Step 5 paste-verify gate (walkthrough § 6 + first-3/last-2 fixture review)",
        );
      } else {
        logInfo(
          "Next: Step 3 byte-identical verification gate (jq -S diff vs migration-baseline.json)",
        );
      }
    }
    process.exit(exitCode);
  } catch (err) {
    logError("Unhandled error:", err && err.stack ? err.stack : String(err));
    process.exit(99);
  }
})();
