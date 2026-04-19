/**
 * Profile Hint Automated Test Harness
 *
 * Compares local VLM output with and without profile hints.
 * Paste this entire script into the browser console to run.
 *
 * Prerequisites:
 * - Image Describer tool must be active
 * - FastVLM and/or Qwen3.5 models should be loaded
 * - Test images must be served from image-describer/testing/images/
 */
(async () => {
  "use strict";

  // =========================================================================
  // CONFIGURATION
  // =========================================================================

  const TEST_IMAGES = [
    { file: "pv.png", profile: "chart" },
    { file: "piston.png", profile: "diagram" },
    { file: "Proposed mechanism of action of GA.png", profile: "diagram" },
    { file: "Siège_de_Rouen_(1418-1419).jpg", profile: "painting" },
    { file: "Probability_of_exceedance__intensity_.jpg", profile: "chart" },
    { file: "Bacteria_on_an_agar_plate.jpg", profile: "diagram" },
    { file: "Indian_Ocean_Tsunami.png", profile: "map" },
  ];

  const IMAGE_BASE_PATH = "image-describer/testing/images/";
  const PAUSE_BETWEEN_RUNS_MS = 2000;
  const ESTIMATED_SECONDS_PER_RUN = 30; // conservative average

  // =========================================================================
  // LOGGING HELPERS
  // =========================================================================

  const LOG_PREFIX = "[ProfileHintTest]";

  function logHeader(msg) {
    console.log(
      `%c${LOG_PREFIX} ${msg}`,
      "color: #2196F3; font-weight: bold; font-size: 14px;",
    );
  }

  function logProgress(msg) {
    console.log(`%c${LOG_PREFIX} ${msg}`, "color: #4CAF50;");
  }

  function logWarn(msg) {
    console.warn(`${LOG_PREFIX} ${msg}`);
  }

  function logError(msg) {
    console.error(`${LOG_PREFIX} ${msg}`);
  }

  // =========================================================================
  // PRE-FLIGHT CHECKS
  // =========================================================================

  logHeader("Profile Hint Test Harness — Starting");

  // Check gateway availability
  const gateway =
    typeof ImageDescriberAnalyserTransformers !== "undefined"
      ? ImageDescriberAnalyserTransformers
      : null;

  if (!gateway) {
    logError(
      "ImageDescriberAnalyserTransformers not found. " +
        "Ensure Image Describer tool is active and scripts are loaded.",
    );
    return;
  }

  const controller =
    typeof ImageDescriberController !== "undefined"
      ? ImageDescriberController
      : null;

  if (!controller) {
    logError(
      "ImageDescriberController not found. " +
        "Ensure Image Describer tool is active.",
    );
    return;
  }

  if (
    typeof controller.buildLocalPrompt !== "function" ||
    typeof controller.buildQwenPrompt !== "function"
  ) {
    logError(
      "Controller missing buildLocalPrompt() or buildQwenPrompt(). " +
        "Ensure the generate module is loaded.",
    );
    return;
  }

  if (typeof controller.setSelectedProfile !== "function") {
    logError("Controller missing setSelectedProfile().");
    return;
  }

  const fastVLMReady = gateway.getFastVLMStatus() === "ready";
  const qwenReady = gateway.getQwenStatus() === "ready";

  logProgress(`FastVLM status: ${gateway.getFastVLMStatus()}`);
  logProgress(`Qwen3.5 status: ${gateway.getQwenStatus()}`);

  if (!fastVLMReady && !qwenReady) {
    logError(
      "Neither FastVLM nor Qwen3.5 is loaded. " +
        "Load at least one model before running this test.\n" +
        "  FastVLM: use the Image Describer debug panel to load it\n" +
        "  Qwen3.5: use the debug panel or await gateway.ensureQwen()",
    );
    return;
  }

  if (!fastVLMReady) {
    logWarn("FastVLM not loaded — FastVLM tests will be skipped.");
  }
  if (!qwenReady) {
    logWarn("Qwen3.5 not loaded — Qwen tests will be skipped.");
  }

  // =========================================================================
  // ESTIMATE TOTAL TIME
  // =========================================================================

  const conditionsPerImage =
    (fastVLMReady ? 2 : 0) + (qwenReady ? 2 : 0);
  const totalRuns = TEST_IMAGES.length * conditionsPerImage;
  const estimatedTotalSec =
    totalRuns * ESTIMATED_SECONDS_PER_RUN +
    (totalRuns - 1) * (PAUSE_BETWEEN_RUNS_MS / 1000);
  const estimatedMin = Math.ceil(estimatedTotalSec / 60);

  logProgress(
    `${TEST_IMAGES.length} images × ${conditionsPerImage} conditions = ` +
      `${totalRuns} runs. Estimated time: ~${estimatedMin} minutes.`,
  );

  // =========================================================================
  // IMAGE LOADER
  // =========================================================================

  async function loadImageElement(filename) {
    const url = IMAGE_BASE_PATH + encodeURIComponent(filename);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${filename}: ${response.status} ${response.statusText}`,
      );
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ img, blobUrl });
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error(`Failed to load image element for ${filename}`));
      };
      img.src = blobUrl;
    });
  }

  // =========================================================================
  // SINGLE RUN HELPER
  // =========================================================================

  async function runGeneration(modelName, imgElement, profileName) {
    // Set the profile via the controller (updates DOM radio buttons)
    controller.setSelectedProfile(profileName);

    // Build the prompt via the controller (reads the selected profile)
    const prompt =
      modelName === "fastvlm"
        ? controller.buildLocalPrompt()
        : controller.buildQwenPrompt();

    const startTime = performance.now();
    let rawResult = null;

    try {
      if (modelName === "fastvlm") {
        rawResult = await gateway.generateLocalDescription(imgElement, {
          prompt: prompt,
          maxTokens: 512,
        });
      } else {
        rawResult = await gateway.generateQwenDescription(imgElement, {
          prompt: prompt,
          maxTokens: 512,
        });
      }
    } catch (err) {
      rawResult = `[ERROR] ${err.message}`;
    }

    const elapsed = Math.round(performance.now() - startTime);

    // Gateway returns { text, status, duration, model } or a string on error
    const outputText =
      typeof rawResult === "object" && rawResult !== null
        ? rawResult.text || ""
        : String(rawResult || "");

    // Approximate token count: ~4 chars per token for English text
    const tokenCount = Math.round(outputText.length * 0.25);

    return {
      prompt: prompt,
      output: outputText,
      timeMs: elapsed,
      tokenCount: tokenCount,
    };
  }

  // =========================================================================
  // PAUSE HELPER
  // =========================================================================

  function pause(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // =========================================================================
  // MAIN TEST LOOP
  // =========================================================================

  const results = [];
  let completedRuns = 0;
  const overallStart = performance.now();

  for (let i = 0; i < TEST_IMAGES.length; i++) {
    const testCase = TEST_IMAGES[i];
    logHeader(
      `[${i + 1}/${TEST_IMAGES.length}] Testing: ${testCase.file} ` +
        `(profile: ${testCase.profile})`,
    );

    // Load image
    let imgElement;
    let blobUrl;
    try {
      const loaded = await loadImageElement(testCase.file);
      imgElement = loaded.img;
      blobUrl = loaded.blobUrl;
    } catch (err) {
      logError(`Skipping ${testCase.file}: ${err.message}`);
      results.push({
        image: testCase.file,
        assignedProfile: testCase.profile,
        clipLabel: null,
        error: err.message,
        results: {},
      });
      continue;
    }

    const imageResult = {
      image: testCase.file,
      assignedProfile: testCase.profile,
      clipLabel: null,
      results: {},
    };

    // --- FastVLM: no hint (default profile) ---
    if (fastVLMReady) {
      logProgress("  Running: FastVLM — no hint (default)...");
      imageResult.results.fastvlm_no_hint = await runGeneration(
        "fastvlm",
        imgElement,
        "default",
      );
      completedRuns++;
      logProgress(
        `  Done (${imageResult.results.fastvlm_no_hint.timeMs}ms). ` +
          `[${completedRuns}/${totalRuns} runs complete]`,
      );
      await pause(PAUSE_BETWEEN_RUNS_MS);

      // --- FastVLM: with hint (assigned profile) ---
      logProgress(
        `  Running: FastVLM — with hint (${testCase.profile})...`,
      );
      imageResult.results.fastvlm_with_hint = await runGeneration(
        "fastvlm",
        imgElement,
        testCase.profile,
      );
      completedRuns++;
      logProgress(
        `  Done (${imageResult.results.fastvlm_with_hint.timeMs}ms). ` +
          `[${completedRuns}/${totalRuns} runs complete]`,
      );
      await pause(PAUSE_BETWEEN_RUNS_MS);
    } else {
      imageResult.results.fastvlm_no_hint = {
        prompt: "",
        output: "skipped — not loaded",
        timeMs: 0,
        tokenCount: 0,
      };
      imageResult.results.fastvlm_with_hint = {
        prompt: "",
        output: "skipped — not loaded",
        timeMs: 0,
        tokenCount: 0,
      };
    }

    // --- Qwen3.5: no hint (default profile) ---
    if (qwenReady) {
      logProgress("  Running: Qwen3.5 — no hint (default)...");
      imageResult.results.qwen_no_hint = await runGeneration(
        "qwen",
        imgElement,
        "default",
      );
      completedRuns++;
      logProgress(
        `  Done (${imageResult.results.qwen_no_hint.timeMs}ms). ` +
          `[${completedRuns}/${totalRuns} runs complete]`,
      );
      await pause(PAUSE_BETWEEN_RUNS_MS);

      // --- Qwen3.5: with hint (assigned profile) ---
      logProgress(
        `  Running: Qwen3.5 — with hint (${testCase.profile})...`,
      );
      imageResult.results.qwen_with_hint = await runGeneration(
        "qwen",
        imgElement,
        testCase.profile,
      );
      completedRuns++;
      logProgress(
        `  Done (${imageResult.results.qwen_with_hint.timeMs}ms). ` +
          `[${completedRuns}/${totalRuns} runs complete]`,
      );
      if (i < TEST_IMAGES.length - 1 || completedRuns < totalRuns) {
        await pause(PAUSE_BETWEEN_RUNS_MS);
      }
    } else {
      imageResult.results.qwen_no_hint = {
        prompt: "",
        output: "skipped — not loaded",
        timeMs: 0,
        tokenCount: 0,
      };
      imageResult.results.qwen_with_hint = {
        prompt: "",
        output: "skipped — not loaded",
        timeMs: 0,
        tokenCount: 0,
      };
    }

    // Clean up blob URL
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }

    results.push(imageResult);

    // Time estimate for remaining
    const elapsedSoFar = (performance.now() - overallStart) / 1000;
    const avgPerRun = elapsedSoFar / completedRuns;
    const remainingRuns = totalRuns - completedRuns;
    const remainingSec = Math.round(remainingRuns * avgPerRun);
    if (remainingRuns > 0) {
      logProgress(
        `  Estimated time remaining: ~${Math.ceil(remainingSec / 60)} min ` +
          `(${remainingSec}s)`,
      );
    }
  }

  // =========================================================================
  // FINAL REPORT
  // =========================================================================

  const totalElapsed = Math.round((performance.now() - overallStart) / 1000);

  // Reset profile to default when done
  controller.setSelectedProfile("default");

  // Store globally for easy access
  window._profileHintResults = results;

  logHeader("Profile Hint Test Harness — Complete");
  logProgress(`Total time: ${totalElapsed}s (${Math.ceil(totalElapsed / 60)} min)`);
  logProgress(`Results stored in window._profileHintResults`);

  // Print summary table
  const summaryRows = [];
  for (const r of results) {
    if (r.error) {
      summaryRows.push({
        Image: r.image,
        Profile: r.assignedProfile,
        Error: r.error,
      });
      continue;
    }
    for (const [condition, data] of Object.entries(r.results)) {
      summaryRows.push({
        Image: r.image,
        Profile: r.assignedProfile,
        Condition: condition,
        "Time (ms)": data.timeMs,
        "~Tokens": data.tokenCount,
        "Output preview": (data.output || "").substring(0, 80) + "…",
      });
    }
  }
  console.table(summaryRows);

  // Full JSON output for copy-paste
  console.log(JSON.stringify(window._profileHintResults, null, 2));
})();
