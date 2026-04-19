/**
 * ═══════════════════════════════════════════════════════════════
 * PHASE 5A2 TEST RUNNER
 * ═══════════════════════════════════════════════════════════════
 *
 * Tests three Accuracy Self-Check configurations:
 *   A) middle-no-echo  — Self-check in middle of prompt (current)
 *   B) end-no-echo     — Self-check moved to end of prompt
 *   C) end-with-echo   — Self-check at end + condensed echo in user prompt
 *
 * USAGE:
 *   1. Load this script via <script> tag or paste into console
 *   2. Run: await phase5a2Verify()     — dry-run verification (no API calls)
 *   3. Run: await phase5a2Run()        — full test (45 API calls)
 *   4. Run: phase5a2Cleanup()          — restore original prompt
 *
 * The script modifies window.PROMPT_IMAGE_DESCRIPTION between configs
 * and wraps buildUserPrompt() for the echo variant.
 *
 * @version 1.0.0
 * @date March 2026
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
  "use strict";

  // ══════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ══════════════════════════════════════════════════════════════

  /** Problem images only — solid images don't need retesting */
  const TEST_IMAGES = [
    "piston-cylinder",
    "agar-plate-inhibition",
    "siege-rouen",
    "ga-mechanism",
    "tsunami-deaths-map",
  ];

  /** Runs per config per image */
  const RUNS_PER_CONFIG = 3;

  /** Model for all tests */
  const TEST_MODEL = "anthropic/claude-haiku-4.5";

  /** Condensed echo text appended to user prompt for config C */
  const ECHO_TEXT =
    "\n\n---\n" +
    "Before finalising, apply the Accuracy Self-Check: " +
    "verify label positions by re-scanning the image systematically " +
    "(top to bottom, left to right), " +
    "describe tonal regions using neutral visual terms " +
    "(lighter, darker, opaque, translucent) before assigning domain-specific meaning, " +
    "confirm you can describe the visual form of every named object " +
    "independently of its name, " +
    "and cross-check any quantitative rankings against every value in the image.";

  /**
   * Marker strings used to locate the Accuracy Self-Check section
   * within the prompt. These must match the actual prompt text exactly.
   */
  const SECTION_START = "### Accuracy Self-Check";
  const SECTION_END = "### Context You May Receive";

  // ══════════════════════════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════════════════════════

  /** Original prompt stored on first call — never modified */
  let originalPrompt = null;

  /** Three prompt variants, built on initialisation */
  let variants = {
    middle: null, // Config A: self-check in middle (current)
    end: null, // Config B: self-check moved to end
  };
  // Config C uses the same system prompt as 'end', plus echo in user prompt

  /** Reference to original buildUserPrompt method */
  let originalBuildUserPrompt = null;

  /** Whether the echo wrapper is currently active */
  let echoActive = false;

  // ══════════════════════════════════════════════════════════════
  // INITIALISATION
  // ══════════════════════════════════════════════════════════════

  /**
   * Initialise by capturing the current prompt and building variants.
   * Safe to call multiple times — only captures on first call.
   *
   * @returns {boolean} true if initialisation succeeded
   */
  function init() {
    if (originalPrompt !== null) {
      console.log("[Phase5A2] Already initialised.");
      return true;
    }

    // Capture current prompt
    if (!window.PROMPT_IMAGE_DESCRIPTION) {
      console.error("[Phase5A2] window.PROMPT_IMAGE_DESCRIPTION not found. Load prompt-loader.js first.");
      return false;
    }

    originalPrompt = window.PROMPT_IMAGE_DESCRIPTION;
    console.log(`[Phase5A2] Original prompt captured (${originalPrompt.length} chars)`);

    // Verify section markers exist
    if (!originalPrompt.includes(SECTION_START)) {
      console.error(`[Phase5A2] Cannot find "${SECTION_START}" in prompt. Has the self-check been added?`);
      return false;
    }
    if (!originalPrompt.includes(SECTION_END)) {
      console.error(`[Phase5A2] Cannot find "${SECTION_END}" in prompt.`);
      return false;
    }

    // ── Build variant A (middle) — current prompt as-is ──
    variants.middle = originalPrompt;

    // ── Build variant B (end) — move self-check to after Key Principles ──
    // Extract the self-check section (from its heading to just before Context heading)
    const startIdx = originalPrompt.indexOf(SECTION_START);
    const endIdx = originalPrompt.indexOf(SECTION_END);

    if (startIdx >= endIdx) {
      console.error("[Phase5A2] Section markers are in unexpected order.");
      return false;
    }

    // The self-check block includes trailing whitespace up to the next heading
    const selfCheckBlock = originalPrompt.substring(startIdx, endIdx).trim();

    // Remove self-check from its current position
    const promptWithout = originalPrompt.substring(0, startIdx) + originalPrompt.substring(endIdx);

    // Append self-check at the very end
    variants.end = promptWithout.trim() + "\n\n" + selfCheckBlock;

    console.log(`[Phase5A2] Variants built:`);
    console.log(`  middle: ${variants.middle.length} chars (original)`);
    console.log(`  end:    ${variants.end.length} chars`);
    console.log(`  echo text: ${ECHO_TEXT.length} chars (appended to user prompt for config C)`);

    // Verify both variants contain the self-check
    const middleHas = variants.middle.includes(SECTION_START);
    const endHas = variants.end.includes(SECTION_START);
    console.log(`  middle contains self-check: ${middleHas}`);
    console.log(`  end contains self-check: ${endHas}`);

    if (!middleHas || !endHas) {
      console.error("[Phase5A2] Variant construction failed — self-check missing from one or both.");
      return false;
    }

    // Verify the end variant has self-check AFTER Key Principles
    const endSelfCheckPos = variants.end.indexOf(SECTION_START);
    const endKeyPrinciplesPos = variants.end.indexOf("### Key Principles");
    if (endKeyPrinciplesPos >= 0 && endSelfCheckPos < endKeyPrinciplesPos) {
      console.error("[Phase5A2] End variant: self-check is NOT after Key Principles. Position error.");
      return false;
    }
    console.log(`  end variant: self-check is after Key Principles: true`);

    return true;
  }

  // ══════════════════════════════════════════════════════════════
  // PROMPT SWITCHING
  // ══════════════════════════════════════════════════════════════

  /**
   * Activate a specific config by swapping the prompt and optionally
   * wrapping buildUserPrompt for echo.
   *
   * @param {"middle-no-echo"|"end-no-echo"|"end-with-echo"} configLabel
   * @returns {boolean} true if activation succeeded
   */
  function activateConfig(configLabel) {
    if (!originalPrompt) {
      console.error("[Phase5A2] Not initialised. Call init() first.");
      return false;
    }

    // Always remove echo wrapper first
    removeEchoWrapper();

    switch (configLabel) {
      case "middle-no-echo":
        window.PROMPT_IMAGE_DESCRIPTION = variants.middle;
        break;

      case "end-no-echo":
        window.PROMPT_IMAGE_DESCRIPTION = variants.end;
        break;

      case "end-with-echo":
        window.PROMPT_IMAGE_DESCRIPTION = variants.end;
        installEchoWrapper();
        break;

      default:
        console.error(`[Phase5A2] Unknown config: "${configLabel}"`);
        return false;
    }

    console.log(`[Phase5A2] Activated config: ${configLabel}`);
    return true;
  }

  /**
   * Install a wrapper around buildUserPrompt that appends echo text.
   */
  function installEchoWrapper() {
    const ctrl = window.ImageDescriberController;
    if (!ctrl || typeof ctrl.buildUserPrompt !== "function") {
      console.error("[Phase5A2] Controller or buildUserPrompt not found.");
      return;
    }

    // Only wrap once
    if (echoActive) return;

    originalBuildUserPrompt = ctrl.buildUserPrompt.bind(ctrl);

    ctrl.buildUserPrompt = function () {
      const base = originalBuildUserPrompt();
      return base + ECHO_TEXT;
    };

    echoActive = true;
    console.log("[Phase5A2] Echo wrapper installed on buildUserPrompt");
  }

  /**
   * Remove the echo wrapper, restoring original buildUserPrompt.
   */
  function removeEchoWrapper() {
    if (!echoActive) return;

    const ctrl = window.ImageDescriberController;
    if (ctrl && originalBuildUserPrompt) {
      ctrl.buildUserPrompt = originalBuildUserPrompt;
      originalBuildUserPrompt = null;
    }

    echoActive = false;
    console.log("[Phase5A2] Echo wrapper removed from buildUserPrompt");
  }

  // ══════════════════════════════════════════════════════════════
  // VERIFICATION (DRY RUN)
  // ══════════════════════════════════════════════════════════════

  /**
   * Verify all three configs produce the expected prompt lengths
   * and content, without making any API calls.
   *
   * @returns {Promise<boolean>} true if all checks pass
   */
  async function verify() {
    console.log("\n" + "═".repeat(60));
    console.log("PHASE 5A2 — DRY RUN VERIFICATION");
    console.log("═".repeat(60) + "\n");

    // Initialise if needed
    if (!originalPrompt && !init()) {
      return false;
    }

    const ctrl = window.ImageDescriberController;
    if (!ctrl) {
      console.error("[Phase5A2] ImageDescriberController not found.");
      return false;
    }

// Check images are loaded
    const harness = window.ImageDescriberTestHarness;
    const imgCount = harness ? Object.keys(harness.testImages || {}).length : 0;
    if (imgCount < 5) {
      console.error(`✗ Only ${imgCount} test images loaded (need at least 5). Run listTestImages() first.`);
      return false;
    }
    console.log(`✓ ${imgCount} test images loaded`);

    // Check controller is initialised
    if (!ctrl._initialized) {
      console.error("✗ ImageDescriberController not initialised.");
      return false;
    }
    console.log("✓ Controller initialised");

    let allPassed = true;
    const configs = ["middle-no-echo", "end-no-echo", "end-with-echo"];

    for (const label of configs) {
      console.log(`\n─── Config: ${label} ───`);

      // Activate config
      if (!activateConfig(label)) {
        allPassed = false;
        continue;
      }

      // Build system prompt and check length
      const sysPrompt = ctrl.buildSystemPrompt();
      const userPrompt = ctrl.buildUserPrompt();

      console.log(`  System prompt: ${sysPrompt.length} chars`);
      console.log(`  User prompt:   ${userPrompt.length} chars`);
      console.log(`  Contains self-check: ${sysPrompt.includes(SECTION_START)}`);

      // Check self-check position relative to Key Principles
      const selfCheckPos = sysPrompt.indexOf(SECTION_START);
      const keyPrinciplesPos = sysPrompt.indexOf("### Key Principles");

      if (label.startsWith("end")) {
        if (keyPrinciplesPos >= 0 && selfCheckPos < keyPrinciplesPos) {
          console.error(`  ✗ Self-check should be AFTER Key Principles for "${label}"`);
          allPassed = false;
        } else {
          console.log(`  ✓ Self-check is after Key Principles`);
        }
      } else {
        if (keyPrinciplesPos >= 0 && selfCheckPos > keyPrinciplesPos) {
          console.error(`  ✗ Self-check should be BEFORE Key Principles for "${label}"`);
          allPassed = false;
        } else {
          console.log(`  ✓ Self-check is before Key Principles`);
        }
      }

      // Check echo in user prompt
      if (label === "end-with-echo") {
        if (userPrompt.includes("Accuracy Self-Check")) {
          console.log(`  ✓ User prompt contains echo text`);
        } else {
          console.error(`  ✗ User prompt missing echo text`);
          allPassed = false;
        }
      } else {
        if (userPrompt.includes("Accuracy Self-Check")) {
          console.error(`  ✗ User prompt should NOT contain echo text for "${label}"`);
          allPassed = false;
        } else {
          console.log(`  ✓ User prompt does not contain echo text`);
        }
      }
    }

    // Restore original
    activateConfig("middle-no-echo");
    removeEchoWrapper();

    console.log("\n" + "─".repeat(60));
    if (allPassed) {
      console.log("✓ ALL VERIFICATION CHECKS PASSED — safe to run tests");
    } else {
      console.error("✗ SOME CHECKS FAILED — do not run tests until fixed");
    }
    console.log("─".repeat(60) + "\n");

    return allPassed;
  }

  // ══════════════════════════════════════════════════════════════
  // TEST RUNNER
  // ══════════════════════════════════════════════════════════════

  /**
   * Run the full Phase 5A2 comparison test.
   * 5 images × 3 configs × 3 runs = 45 API calls.
   *
   * @returns {Promise<void>}
   */
  async function run() {
    const startTime = Date.now();

    console.log("\n" + "═".repeat(60));
    console.log("PHASE 5A2 — STARTING TEST RUN");
    console.log(`${TEST_IMAGES.length} images × 3 configs × ${RUNS_PER_CONFIG} runs = ${TEST_IMAGES.length * 3 * RUNS_PER_CONFIG} total API calls`);
    console.log("═".repeat(60) + "\n");

    // Initialise if needed
    if (!originalPrompt && !init()) {
      console.error("[Phase5A2] Initialisation failed. Aborting.");
      return;
    }

    // Verify first
    const verified = await verify();
    if (!verified) {
      console.error("[Phase5A2] Verification failed. Aborting test run.");
      return;
    }

    // Back up existing results
    console.log("[Phase5A2] Backing up existing results...");
    window.exportAllResults();
    window.clearResults();

    const configs = [
      { label: "middle-no-echo", configKey: "middle-no-echo" },
      { label: "end-no-echo", configKey: "end-no-echo" },
      { label: "end-with-echo", configKey: "end-with-echo" },
    ];

    // Run each config sequentially across all images
    for (let c = 0; c < configs.length; c++) {
      const cfg = configs[c];

      console.log("\n" + "═".repeat(60));
      console.log(`CONFIG ${c + 1}/3: ${cfg.label}`);
      console.log("═".repeat(60));

      // Activate this config's prompt
      if (!activateConfig(cfg.configKey)) {
        console.error(`[Phase5A2] Failed to activate config "${cfg.configKey}". Skipping.`);
        continue;
      }

      // Verify prompt is correct before spending money
      const sysPrompt = window.ImageDescriberController.buildSystemPrompt();
      console.log(`  System prompt length: ${sysPrompt.length} chars`);
      console.log(`  Self-check in prompt: ${sysPrompt.includes(SECTION_START)}`);

      for (const img of TEST_IMAGES) {
        await window.runComparisonBatch(img, [
          { descModel: TEST_MODEL, label: cfg.label },
        ], RUNS_PER_CONFIG);
      }
    }

    // ── Cleanup ──
    activateConfig("middle-no-echo");
    removeEchoWrapper();

    // ── Results ──
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

    console.log("\n" + "═".repeat(60));
    console.log("PHASE 5A2 — GENERATING REPORTS");
    console.log("═".repeat(60));

    window.showComparisonReport();
    window.extractSummary("phase5a2-position-echo");

    console.log("\n" + "═".repeat(60));
    console.log(`✅ PHASE 5A2 COMPLETE — ${elapsed} seconds total`);
    console.log("Prompt restored to original. Results exported.");
    console.log("═".repeat(60) + "\n");
  }

  /**
   * Restore the original prompt and remove any wrappers.
   * Call this if a test is interrupted or you want to reset.
   */
  function cleanup() {
    removeEchoWrapper();

    if (originalPrompt) {
      window.PROMPT_IMAGE_DESCRIPTION = originalPrompt;
      console.log("[Phase5A2] Original prompt restored.");
    } else {
      console.warn("[Phase5A2] No original prompt stored — nothing to restore.");
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GLOBAL EXPOSURE
  // ══════════════════════════════════════════════════════════════

  window.phase5a2Verify = verify;
  window.phase5a2Run = run;
  window.phase5a2Cleanup = cleanup;
  window.phase5a2Init = init;

  console.log("[Phase5A2] Test runner loaded. Commands:");
  console.log("  phase5a2Verify()   — dry-run verification (no API calls)");
  console.log("  phase5a2Run()      — full test (45 API calls, ~£0.35)");
  console.log("  phase5a2Cleanup()  — restore original prompt");

})();
