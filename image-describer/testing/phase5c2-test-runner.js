/**
 * ═══════════════════════════════════════════════════════════════
 * PHASE 5C-2 TEST RUNNER — MODEL VERIFICATION COMPARISON
 * ═══════════════════════════════════════════════════════════════
 *
 * Tests whether verification by a capable model improves accuracy,
 * using the updated prompt-verification.txt (with "Do No Harm"
 * principle and describe-first approach).
 *
 * Three configs, no reasoning, 5 problem images, n=3:
 *
 *   A) Sonnet→Sonnet  — describe + verify with Sonnet 4.6
 *   B) Opus→Opus      — describe + verify with Opus 4.6
 *   C) Haiku→Opus     — describe with Haiku 4.5, verify with Opus 4.6
 *
 * Compared against existing baselines from Phase 5C-1:
 *   - Sonnet baseline: 7/15 (47%, corrected)
 *   - Opus baseline:   11/15 (73%, corrected)
 *   - Haiku baseline:  7/15 (47%, Phase 5B2)
 *
 * USAGE:
 *   1. Load this script via <script> tag or paste into console
 *   2. Run: await phase5c2Verify()          — dry-run (no API calls)
 *   3. Run: await phase5c2Run()             — full test (45 runs, ~£28)
 *   4. Run: await phase5c2RunSonnet()       — Sonnet→Sonnet only (15 runs, ~£3)
 *   5. Run: await phase5c2RunOpus()         — Opus→Opus only (15 runs, ~£16)
 *   6. Run: await phase5c2RunHaikuOpus()    — Haiku→Opus only (15 runs, ~£9)
 *
 * Recommended order: Haiku→Opus first (cheapest cross-model test),
 * then Sonnet→Sonnet, then Opus→Opus only if needed.
 *
 * @version 1.0.0
 * @date March 2026
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
  "use strict";

  // ══════════════════════════════════════════════════════════════
  // LOGGING CONFIGURATION
  // ══════════════════════════════════════════════════════════════

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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error(`[Phase5C2] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn(`[Phase5C2] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log(`[Phase5C2] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log(`[Phase5C2] ${message}`, ...args);
  }

  // ══════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ══════════════════════════════════════════════════════════════

  /** Problem images only */
  const TEST_IMAGES = [
    "piston-cylinder",
    "agar-plate-inhibition",
    "siege-rouen",
    "ga-mechanism",
    "tsunami-deaths-map",
  ];

  /** Runs per config per image */
  const RUNS_PER_CONFIG = 3;

  /** Model IDs */
  const MODEL_IDS = {
    haiku: "anthropic/claude-haiku-4.5",
    sonnet: "anthropic/claude-sonnet-4.6",
    opus: "anthropic/claude-opus-4.6",
  };

  /**
   * Verification test configs.
   * Each has a description model and a verification model.
   * No reasoning on any config.
   */
  const CONFIGS = {
    "sonnet-sonnet": {
      label: "sonnet→sonnet",
      descModel: MODEL_IDS.sonnet,
      verifyModel: MODEL_IDS.sonnet,
      verifyEnabled: true,
      shortName: "Sonnet→Sonnet",
      estimatedCost: "~£3",
    },
    "opus-opus": {
      label: "opus→opus",
      descModel: MODEL_IDS.opus,
      verifyModel: MODEL_IDS.opus,
      verifyEnabled: true,
      shortName: "Opus→Opus",
      estimatedCost: "~£16",
    },
    "haiku-opus": {
      label: "haiku→opus",
      descModel: MODEL_IDS.haiku,
      verifyModel: MODEL_IDS.opus,
      verifyEnabled: true,
      shortName: "Haiku→Opus",
      estimatedCost: "~£9",
    },
  };

  // ══════════════════════════════════════════════════════════════
  // VERIFICATION (DRY RUN)
  // ══════════════════════════════════════════════════════════════

  /**
   * Verify everything is ready before spending money.
   * @returns {Promise<boolean>} true if all checks pass
   */
  async function verify() {
    console.log("\n" + "═".repeat(60));
    console.log("PHASE 5C-2 — DRY RUN VERIFICATION");
    console.log("═".repeat(60) + "\n");

    let allPassed = true;

    // 1. Controller
    const ctrl = window.ImageDescriberController;
    if (!ctrl?._initialized) {
      logError("✗ ImageDescriberController not initialised.");
      return false;
    }
    logInfo("✓ Controller initialised");

    // 2. Prompts
    if (!window.PROMPT_IMAGE_DESCRIPTION || !window.PROMPT_WRITING_GUIDE || !window.PROMPT_MARKDOWN) {
      logError("✗ Description prompts not all loaded.");
      return false;
    }
    logInfo("✓ Description prompts loaded");

    // 3. Verification prompt with updates
    if (!window.PROMPT_VERIFICATION) {
      logError("✗ PROMPT_VERIFICATION not loaded.");
      return false;
    }
    if (!window.PROMPT_VERIFICATION.includes("Do No Harm")) {
      logError("✗ PROMPT_VERIFICATION missing 'Do No Harm' principle. Reload after updating prompt-verification.txt.");
      return false;
    }
    if (window.PROMPT_VERIFICATION.includes("Tone, Colour, and Labels")) {
      logInfo("✓ Verification prompt loaded with both updates (Do No Harm + describe-first)");
    } else {
      logWarn("⚠ Verification prompt has Do No Harm but may be missing describe-first update");
    }

    // 4. v1 Accuracy Self-Check
    if (!window.PROMPT_IMAGE_DESCRIPTION.includes("Accuracy Self-Check")) {
      logWarn("⚠ v1 Accuracy Self-Check not found in description prompt");
      allPassed = false;
    } else {
      logInfo("✓ v1 Accuracy Self-Check present");
    }

    // 5. Test harness
    const harness = window.ImageDescriberTestHarness;
    if (!harness) {
      logError("✗ ImageDescriberTestHarness not found.");
      return false;
    }
    logInfo("✓ Test harness loaded");

    // 6. Required functions
    const requiredFunctions = [
      "runComparisonBatch",
      "exportAllResults",
      "clearResults",
      "extractSummary",
      "showComparisonReport",
    ];
    let fnOk = true;
    for (const fn of requiredFunctions) {
      if (typeof window[fn] !== "function") {
        logError(`✗ window.${fn} not available.`);
        fnOk = false;
        allPassed = false;
      }
    }
    if (fnOk) logInfo("✓ All required harness functions available");

    // 7. Test images
    const imgCount = Object.keys(harness.testImages || {}).length;
    if (imgCount < TEST_IMAGES.length) {
      logError(`✗ Only ${imgCount} test images loaded (need ${TEST_IMAGES.length}).`);
      return false;
    }
    let imgOk = true;
    for (const key of TEST_IMAGES) {
      if (!harness.testImages[key]) {
        logError(`✗ Test image "${key}" not found.`);
        imgOk = false;
        allPassed = false;
      }
    }
    if (imgOk) logInfo(`✓ All ${TEST_IMAGES.length} test images loaded`);

    // 8. Verification enabled in controller
    if (typeof ctrl.isVerificationEnabled !== "function") {
      logError("✗ Controller missing isVerificationEnabled() method.");
      return false;
    }
    logInfo("✓ Controller supports verification");

    // 9. tsunami-deaths-map failPattern fix check
    const tsunamiGT = harness.testImages["tsunami-deaths-map"]?.groundTruth;
    const mapType = tsunamiGT?.visualFacts?.find(f => f.id === "map-type");
    if (mapType?.failPattern?.includes("table")) {
      logWarn("⚠ tsunami-deaths-map map-type failPattern still contains 'table' — results may include false failures");
    } else {
      logInfo("✓ tsunami-deaths-map failPattern fix confirmed");
    }

    // 10. Summary
    console.log("\n" + "─".repeat(60));
    if (allPassed) {
      const totalCalls = TEST_IMAGES.length * Object.keys(CONFIGS).length * RUNS_PER_CONFIG;
      console.log("✓ ALL VERIFICATION CHECKS PASSED — safe to run tests");
      console.log(`  ${TEST_IMAGES.length} images × 3 configs × ${RUNS_PER_CONFIG} runs = ${totalCalls} runs`);
      console.log(`  Each run = 1 description + 1 verification = 2 API calls`);
      console.log("");
      console.log("  Cost estimates:");
      for (const [key, cfg] of Object.entries(CONFIGS)) {
        console.log(`    ${cfg.shortName}: ${cfg.estimatedCost}`);
      }
      console.log("");
      console.log("  Recommended order (cheapest first):");
      console.log("    1. await phase5c2RunSonnet()      — Sonnet→Sonnet (~£3)");
      console.log("    2. await phase5c2RunHaikuOpus()    — Haiku→Opus (~£9)");
      console.log("    3. await phase5c2RunOpus()         — Opus→Opus (~£16)");
    } else {
      console.error("✗ SOME CHECKS FAILED — do not run tests until fixed");
    }
    console.log("─".repeat(60) + "\n");

    return allPassed;
  }

  // ══════════════════════════════════════════════════════════════
  // TEST RUNNERS
  // ══════════════════════════════════════════════════════════════

  /**
   * Run a single config across all problem images.
   * @param {object} cfg - Config from CONFIGS
   * @returns {Promise<void>}
   */
  async function runConfig(cfg) {
    console.log("\n" + "═".repeat(60));
    console.log(`CONFIG: ${cfg.shortName}`);
    console.log(`  Describe: ${cfg.descModel}`);
    console.log(`  Verify:   ${cfg.verifyModel}`);
    console.log(`  ${TEST_IMAGES.length} images × ${RUNS_PER_CONFIG} runs = ${TEST_IMAGES.length * RUNS_PER_CONFIG} runs (${TEST_IMAGES.length * RUNS_PER_CONFIG * 2} API calls)`);
    console.log("═".repeat(60) + "\n");

    const batchConfig = [
      {
        descModel: cfg.descModel,
        verifyModel: cfg.verifyModel,
        verifyEnabled: cfg.verifyEnabled,
        label: cfg.label,
        promptRepetition: "none",
      },
    ];

    for (const imageKey of TEST_IMAGES) {
      try {
        await window.runComparisonBatch(imageKey, batchConfig, RUNS_PER_CONFIG);
      } catch (error) {
        logError(`Failed on ${imageKey} with ${cfg.shortName}:`, error.message);

        if (imageKey === TEST_IMAGES[0]) {
          logError("First image failed — aborting this config.");
          logError("Check model IDs are valid at https://openrouter.ai/models");
          return;
        }
      }
    }

    logInfo(`${cfg.shortName} complete.`);
  }

  /**
   * Generate reports and extract summary.
   * @param {string} label - Summary label for export
   * @param {number} startTime - Start timestamp
   */
  function finishRun(label, startTime) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

    console.log("\n" + "═".repeat(60));
    console.log(`PHASE 5C-2 — GENERATING REPORTS (${label})`);
    console.log("═".repeat(60));

    window.showComparisonReport();
    window.extractSummary(label);

    console.log("\n" + "═".repeat(60));
    console.log(`✅ ${label} COMPLETE — ${elapsed} seconds`);
    console.log("═".repeat(60) + "\n");
  }

  /**
   * Full run: all three configs.
   * 5 images × 3 configs × 3 runs = 45 runs (90 API calls, ~£28)
   */
  async function run() {
    const startTime = Date.now();

    console.log("\n" + "═".repeat(60));
    console.log("PHASE 5C-2 — VERIFICATION MODEL COMPARISON");
    console.log("3 configs × 5 images × 3 runs = 45 runs (90 API calls)");
    console.log("═".repeat(60) + "\n");

    const verified = await verify();
    if (!verified) {
      logError("Verification failed. Aborting.");
      return;
    }

    logInfo("Backing up existing results...");
    window.exportAllResults();
    window.clearResults();

    // Run cheapest first
    await runConfig(CONFIGS["sonnet-sonnet"]);
    await runConfig(CONFIGS["haiku-opus"]);
    await runConfig(CONFIGS["opus-opus"]);

    finishRun("phase5c2-verification-comparison", startTime);
  }

  /**
   * Sonnet→Sonnet only.
   * 5 images × 3 runs = 15 runs (30 API calls, ~£3)
   */
  async function runSonnet() {
    const startTime = Date.now();

    console.log("\n" + "═".repeat(60));
    console.log("PHASE 5C-2 — SONNET→SONNET VERIFICATION");
    console.log("═".repeat(60) + "\n");

    const verified = await verify();
    if (!verified) { logError("Verification failed. Aborting."); return; }

    logInfo("Backing up existing results...");
    window.exportAllResults();
    window.clearResults();

    await runConfig(CONFIGS["sonnet-sonnet"]);

    finishRun("phase5c2-sonnet-sonnet", startTime);
  }

  /**
   * Opus→Opus only.
   * 5 images × 3 runs = 15 runs (30 API calls, ~£16)
   */
  async function runOpus() {
    const startTime = Date.now();

    console.log("\n" + "═".repeat(60));
    console.log("PHASE 5C-2 — OPUS→OPUS VERIFICATION");
    console.log("═".repeat(60) + "\n");

    const verified = await verify();
    if (!verified) { logError("Verification failed. Aborting."); return; }

    logInfo("Backing up existing results...");
    window.exportAllResults();
    window.clearResults();

    await runConfig(CONFIGS["opus-opus"]);

    finishRun("phase5c2-opus-opus", startTime);
  }

  /**
   * Haiku→Opus only (cross-model verification).
   * 5 images × 3 runs = 15 runs (30 API calls, ~£9)
   */
  async function runHaikuOpus() {
    const startTime = Date.now();

    console.log("\n" + "═".repeat(60));
    console.log("PHASE 5C-2 — HAIKU→OPUS CROSS-MODEL VERIFICATION");
    console.log("═".repeat(60) + "\n");

    const verified = await verify();
    if (!verified) { logError("Verification failed. Aborting."); return; }

    logInfo("Backing up existing results...");
    window.exportAllResults();
    window.clearResults();

    await runConfig(CONFIGS["haiku-opus"]);

    finishRun("phase5c2-haiku-opus", startTime);
  }

  // ══════════════════════════════════════════════════════════════
  // GLOBAL EXPOSURE
  // ══════════════════════════════════════════════════════════════

  window.phase5c2Verify = verify;
  window.phase5c2Run = run;
  window.phase5c2RunSonnet = runSonnet;
  window.phase5c2RunOpus = runOpus;
  window.phase5c2RunHaikuOpus = runHaikuOpus;

  // Expose config for runtime model ID tweaks
  window.phase5c2ModelIds = MODEL_IDS;
  window.phase5c2Configs = CONFIGS;

  console.log("[Phase5C2] Test runner loaded. Commands:");
  console.log("  phase5c2Verify()         — dry-run verification (no API calls)");
  console.log("  phase5c2Run()            — full test: all 3 configs (45 runs, ~£28)");
  console.log("  phase5c2RunSonnet()      — Sonnet→Sonnet (15 runs, ~£3)");
  console.log("  phase5c2RunHaikuOpus()   — Haiku→Opus (15 runs, ~£9)");
  console.log("  phase5c2RunOpus()        — Opus→Opus (15 runs, ~£16)");
  console.log("");
  console.log("  Recommended order: Sonnet→Sonnet first (cheapest), then Haiku→Opus, then Opus→Opus");
  console.log("");
  console.log("  To change model IDs: window.phase5c2ModelIds.sonnet = 'new/id'");

})();
