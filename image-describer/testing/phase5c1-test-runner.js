/**
 * ═══════════════════════════════════════════════════════════════
 * PHASE 5C-1 TEST RUNNER — MODEL COMPARISON BASELINES
 * ═══════════════════════════════════════════════════════════════
 *
 * Tests Sonnet 4.5 and Opus 4.5 baselines on the 5 problem images,
 * compared against existing Haiku 4.5 data from Phases 1–5B2.
 *
 * Config: Plain baseline only — v1 accuracy principles shipped in
 * prompt, no verification, no repetition, no reasoning.
 *
 * USAGE:
 *   1. Load this script via <script> tag or paste into console
 *   2. Run: await phase5c1Verify()     — dry-run verification (no API calls)
 *   3. Run: await phase5c1Run()        — full test (30 API calls, ~£8–10)
 *   4. Run: await phase5c1RunSonnet()  — Sonnet only (15 calls, ~£1.50)
 *   5. Run: await phase5c1RunOpus()    — Opus only (15 calls, ~£8)
 *
 * No prompt modifications are made — this runner only changes which
 * model is passed to runComparisonBatch().
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error(`[Phase5C1] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn(`[Phase5C1] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log(`[Phase5C1] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log(`[Phase5C1] ${message}`, ...args);
  }

  // ══════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ══════════════════════════════════════════════════════════════

  /** Problem images only — solid images (pv-diagram, exceedance-nomograph) don't need retesting */
  const TEST_IMAGES = [
    "piston-cylinder",
    "agar-plate-inhibition",
    "siege-rouen",
    "ga-mechanism",
    "tsunami-deaths-map",
  ];

  /** Runs per model per image */
  const RUNS_PER_CONFIG = 3;

  /**
   * Models to test.
   *
   * If a model ID doesn't resolve on OpenRouter, update the id here
   * before running. You can check available models at:
   * https://openrouter.ai/models
   *
   * Approximate cost per run (description only, ~8K tokens):
   *   Haiku 4.5:  ~$0.04  (not retested — using existing data)
   *   Sonnet 4.5: ~$0.10
   *   Opus 4.5:   ~$0.55
   */
const MODELS = {
    sonnet: {
      id: "anthropic/claude-sonnet-4.6",
      label: "sonnet-4.6",
      shortName: "Sonnet 4.6",
    },
    opus: {
      id: "anthropic/claude-opus-4.6",
      label: "opus-4.6",
      shortName: "Opus 4.6",
    },
  };

  // ══════════════════════════════════════════════════════════════
  // VERIFICATION (DRY RUN)
  // ══════════════════════════════════════════════════════════════

  /**
   * Verify everything is ready before spending money.
   * Checks: controller, prompts, test images, harness functions.
   * No API calls are made.
   *
   * @returns {Promise<boolean>} true if all checks pass
   */
  async function verify() {
    console.log("\n" + "═".repeat(60));
    console.log("PHASE 5C-1 — DRY RUN VERIFICATION");
    console.log("═".repeat(60) + "\n");

    let allPassed = true;

    // 1. Controller available and initialised
    const ctrl = window.ImageDescriberController;
    if (!ctrl) {
      logError("✗ ImageDescriberController not found.");
      return false;
    }
    if (!ctrl._initialized) {
      logError("✗ ImageDescriberController not initialised.");
      return false;
    }
    logInfo("✓ Controller initialised");

    // 2. Prompts loaded
    if (!window.PROMPT_IMAGE_DESCRIPTION) {
      logError("✗ PROMPT_IMAGE_DESCRIPTION not loaded.");
      return false;
    }
    if (!window.PROMPT_WRITING_GUIDE) {
      logError("✗ PROMPT_WRITING_GUIDE not loaded.");
      return false;
    }
    if (!window.PROMPT_MARKDOWN) {
      logError("✗ PROMPT_MARKDOWN not loaded.");
      return false;
    }
    logInfo("✓ All 3 prompts loaded");

    // 3. v1 Accuracy Self-Check present in description prompt
    const hasAccuracyCheck = window.PROMPT_IMAGE_DESCRIPTION.includes("Accuracy Self-Check");
    if (!hasAccuracyCheck) {
      logWarn("⚠ PROMPT_IMAGE_DESCRIPTION does not contain 'Accuracy Self-Check'.");
      logWarn("  This is expected to be shipped permanently. Check prompt-image-description.txt.");
      allPassed = false;
    } else {
      logInfo("✓ v1 Accuracy Self-Check present in description prompt");
    }

    // 4. Test harness loaded
    const harness = window.ImageDescriberTestHarness;
    if (!harness) {
      logError("✗ ImageDescriberTestHarness not found. Load the test harness first.");
      return false;
    }
    logInfo("✓ Test harness loaded");

    // 5. Required harness functions available
    const requiredFunctions = [
      "runComparisonBatch",
      "exportAllResults",
      "clearResults",
      "extractSummary",
      "showComparisonReport",
    ];
    for (const fn of requiredFunctions) {
      if (typeof window[fn] !== "function") {
        logError(`✗ window.${fn} not available.`);
        allPassed = false;
      }
    }
    if (allPassed) {
      logInfo("✓ All required harness functions available");
    }

    // 6. Test images loaded
    const imgCount = harness ? Object.keys(harness.testImages || {}).length : 0;
    if (imgCount < TEST_IMAGES.length) {
      logError(`✗ Only ${imgCount} test images loaded (need at least ${TEST_IMAGES.length}). Run listTestImages() first.`);
      return false;
    }

    // Check each required image exists
    for (const imgKey of TEST_IMAGES) {
      if (!harness.testImages[imgKey]) {
        logError(`✗ Test image "${imgKey}" not found in harness.`);
        allPassed = false;
      }
    }
    if (allPassed) {
      logInfo(`✓ All ${TEST_IMAGES.length} test images loaded`);
    }

    // 7. Build and inspect prompts (no API call)
    const sysPrompt = ctrl.buildSystemPrompt();
    const userPrompt = ctrl.buildUserPrompt();
    logInfo(`  System prompt: ${sysPrompt.length} chars`);
    logInfo(`  User prompt:   ${userPrompt.length} chars`);

    // 8. Model ID sanity check (can't fully verify without API, but check format)
    for (const [key, model] of Object.entries(MODELS)) {
      if (!model.id.includes("/")) {
        logError(`✗ Model ID "${model.id}" doesn't look like an OpenRouter model ID (missing /).`);
        allPassed = false;
      } else {
        logInfo(`✓ Model "${key}": ${model.id} (format OK — availability checked at runtime)`);
      }
    }

    // 9. Summary
    console.log("\n" + "─".repeat(60));
    if (allPassed) {
      const totalCalls = TEST_IMAGES.length * Object.keys(MODELS).length * RUNS_PER_CONFIG;
      console.log("✓ ALL VERIFICATION CHECKS PASSED — safe to run tests");
      console.log(`  ${TEST_IMAGES.length} images × ${Object.keys(MODELS).length} models × ${RUNS_PER_CONFIG} runs = ${totalCalls} API calls`);
      console.log(`  Estimated cost: ~£8–10 total (Sonnet ~£1.50, Opus ~£8)`);
      console.log(`  To run Sonnet only (cheaper): await phase5c1RunSonnet()`);
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
   * Run a single model's baseline across all problem images.
   *
   * @param {object} model - Model config from MODELS object
   * @returns {Promise<void>}
   */
  async function runModelBaseline(model) {
    console.log("\n" + "═".repeat(60));
    console.log(`MODEL: ${model.shortName} (${model.id})`);
    console.log(`${TEST_IMAGES.length} images × ${RUNS_PER_CONFIG} runs = ${TEST_IMAGES.length * RUNS_PER_CONFIG} API calls`);
    console.log("═".repeat(60) + "\n");

    const config = [
      {
        descModel: model.id,
        label: model.label,
        promptRepetition: "none",
      },
    ];

    for (const imageKey of TEST_IMAGES) {
      try {
        await window.runComparisonBatch(imageKey, config, RUNS_PER_CONFIG);
      } catch (error) {
        logError(`Failed on ${imageKey} with ${model.shortName}:`, error.message);

        // If the first image fails (likely model ID issue), ask whether to continue
        if (imageKey === TEST_IMAGES[0]) {
          logError("First image failed — the model ID may be incorrect.");
          logError(`Check that "${model.id}" is valid at https://openrouter.ai/models`);
          logError("Aborting this model. Fix the ID in MODELS config and retry.");
          return;
        }
      }
    }

    logInfo(`${model.shortName} baseline complete.`);
  }

  /**
   * Run the full Phase 5C-1 test: both Sonnet and Opus baselines.
   * 5 images × 2 models × 3 runs = 30 API calls.
   *
   * @returns {Promise<void>}
   */
  async function run() {
    const startTime = Date.now();

    console.log("\n" + "═".repeat(60));
    console.log("PHASE 5C-1 — MODEL COMPARISON BASELINES");
    console.log(`${TEST_IMAGES.length} images × 2 models × ${RUNS_PER_CONFIG} runs = ${TEST_IMAGES.length * 2 * RUNS_PER_CONFIG} total API calls`);
    console.log("═".repeat(60) + "\n");

    // Verify first
    const verified = await verify();
    if (!verified) {
      logError("Verification failed. Aborting test run.");
      return;
    }

    // Back up existing results
    logInfo("Backing up existing results...");
    window.exportAllResults();
    window.clearResults();

    // Run Sonnet first (cheaper — confirms setup works before Opus spend)
    await runModelBaseline(MODELS.sonnet);

    // Then Opus
    await runModelBaseline(MODELS.opus);

    // Generate reports
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

    console.log("\n" + "═".repeat(60));
    console.log("PHASE 5C-1 — GENERATING REPORTS");
    console.log("═".repeat(60));

    window.showComparisonReport();
    window.extractSummary("phase5c1-model-comparison");

    console.log("\n" + "═".repeat(60));
    console.log(`✅ PHASE 5C-1 COMPLETE — ${elapsed} seconds total`);
    console.log("Results exported. Compare against Haiku baseline from Phase 5B2.");
    console.log("═".repeat(60) + "\n");
  }

  /**
   * Run Sonnet baseline only.
   * 5 images × 1 model × 3 runs = 15 API calls (~£1.50).
   *
   * Use this to test Sonnet first before committing to the
   * more expensive Opus runs. If Sonnet already solves most
   * failures, Opus may not be needed.
   *
   * @returns {Promise<void>}
   */
  async function runSonnet() {
    const startTime = Date.now();

    console.log("\n" + "═".repeat(60));
    console.log("PHASE 5C-1 — SONNET BASELINE ONLY");
    console.log("═".repeat(60) + "\n");

    const verified = await verify();
    if (!verified) {
      logError("Verification failed. Aborting.");
      return;
    }

    logInfo("Backing up existing results...");
    window.exportAllResults();
    window.clearResults();

    await runModelBaseline(MODELS.sonnet);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

    console.log("\n" + "═".repeat(60));
    console.log("PHASE 5C-1 — GENERATING REPORTS (SONNET)");
    console.log("═".repeat(60));

    window.showComparisonReport();
    window.extractSummary("phase5c1-sonnet-baseline");

    console.log("\n" + "═".repeat(60));
    console.log(`✅ SONNET BASELINE COMPLETE — ${elapsed} seconds`);
    console.log("Review results before deciding whether to run Opus.");
    console.log("  To run Opus next: await phase5c1RunOpus()");
    console.log("═".repeat(60) + "\n");
  }

  /**
   * Run Opus baseline only.
   * 5 images × 1 model × 3 runs = 15 API calls (~£8).
   *
   * @returns {Promise<void>}
   */
  async function runOpus() {
    const startTime = Date.now();

    console.log("\n" + "═".repeat(60));
    console.log("PHASE 5C-1 — OPUS BASELINE ONLY");
    console.log("═".repeat(60) + "\n");

    const verified = await verify();
    if (!verified) {
      logError("Verification failed. Aborting.");
      return;
    }

    logInfo("Backing up existing results...");
    window.exportAllResults();
    window.clearResults();

    await runModelBaseline(MODELS.opus);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

    console.log("\n" + "═".repeat(60));
    console.log("PHASE 5C-1 — GENERATING REPORTS (OPUS)");
    console.log("═".repeat(60));

    window.showComparisonReport();
    window.extractSummary("phase5c1-opus-baseline");

    console.log("\n" + "═".repeat(60));
    console.log(`✅ OPUS BASELINE COMPLETE — ${elapsed} seconds`);
    console.log("═".repeat(60) + "\n");
  }

  // ══════════════════════════════════════════════════════════════
  // GLOBAL EXPOSURE
  // ══════════════════════════════════════════════════════════════

  window.phase5c1Verify = verify;
  window.phase5c1Run = run;
  window.phase5c1RunSonnet = runSonnet;
  window.phase5c1RunOpus = runOpus;

  // Expose config for easy model ID adjustment
  window.phase5c1Models = MODELS;

  console.log("[Phase5C1] Test runner loaded. Commands:");
  console.log("  phase5c1Verify()      — dry-run verification (no API calls)");
  console.log("  phase5c1Run()         — full test: Sonnet + Opus (30 calls, ~£8–10)");
  console.log("  phase5c1RunSonnet()   — Sonnet only (15 calls, ~£1.50)");
  console.log("  phase5c1RunOpus()     — Opus only (15 calls, ~£8)");
  console.log("");
  console.log("  To change model IDs: window.phase5c1Models.sonnet.id = 'new/id'");
  console.log("  To change model IDs: window.phase5c1Models.opus.id = 'new/id'");

})();
