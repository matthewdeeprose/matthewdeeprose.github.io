/**
 * ===================================================================
 * SPIKE: Phi-3.5-Vision-Instruct Browser Viability Test (v2)
 * ===================================================================
 *
 * Standalone spike — does NOT modify any production code.
 * Tests whether Phi-3.5-vision-instruct (4.2B) can run in the browser
 * via Transformers.js and produce quality image descriptions.
 *
 * Tries multiple library versions in order:
 *   1. @latest (newest, most likely to have ONNX op support)
 *   2. v3.8.1 (stable, used by gateway for v3 models)
 *
 * Run from console:
 *   Phi35Spike.run()                 — full test (tries @latest, then v3)
 *   Phi35Spike.run("latest")         — force @latest only
 *   Phi35Spike.run("v3")             — force v3.8.1 only
 *   Phi35Spike.run("pinned")         — force v4.0.0-next.9 only
 *   Phi35Spike.loadModel("latest")   — load model with specific version
 *   Phi35Spike.describe(prompt)      — run inference with custom prompt
 *   Phi35Spike.cleanup()             — dispose model, free memory
 *
 * Requires an image to be uploaded in Image Describer first.
 * Uses the preview <img> element as the image source.
 *
 * DATE: 31 March 2026
 * STATUS: Throwaway spike — remove after evaluation
 * ===================================================================
 */
(function () {
  "use strict";

  // ───────────────────────────────────────────────────────
  // Logging configuration
  // ───────────────────────────────────────────────────────
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG; // DEBUG for spike
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error.apply(console, ["[Phi35Spike]", message].concat(args));
  }

  function logWarn(message) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn.apply(console, ["[Phi35Spike]", message].concat(args));
  }

  function logInfo(message) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.INFO))
      console.log.apply(console, ["[Phi35Spike]", message].concat(args));
  }

  function logDebug(message) {
    const args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log.apply(console, ["[Phi35Spike]", message].concat(args));
  }

  // ───────────────────────────────────────────────────────
  // Constants
  // ───────────────────────────────────────────────────────
  const CDN_VERSIONS = {
    latest: "https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest",
    pinned:
      "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.9",
    v3: "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1",
  };

  const MODEL_ID = "onnx-community/Phi-3.5-vision-instruct";
  const TARGET_CLASS = "AutoModelForCausalLM";

  // Phi-3.5-vision uses multi-part quantisation.
  // q4 everywhere is safest for VRAM; q4f16 for model is higher quality
  // but caused OOM on RTX 4060 8 GB in initial test.
  const DTYPE_CONFIGS = {
    safe: {
      vision_encoder: "q4",
      prepare_inputs_embeds: "q4",
      model: "q4",
    },
    quality: {
      vision_encoder: "q4",
      prepare_inputs_embeds: "q4",
      model: "q4f16",
    },
  };

  // ───────────────────────────────────────────────────────
  // Spike state
  // ───────────────────────────────────────────────────────
  let spikeModule = null;
  let spikeModel = null;
  let spikeProcessor = null;
  let versionUsed = null;
  let dtypeUsed = null;

  // ───────────────────────────────────────────────────────
  // Import a specific CDN version
  // ───────────────────────────────────────────────────────
  async function importVersion(versionKey) {
    const url = CDN_VERSIONS[versionKey];
    if (!url) {
      logError("Unknown version key: " + versionKey);
      return null;
    }

    logInfo("Importing Transformers.js from: " + url);
    try {
      const mod = await import(url);
      const hasClass = typeof mod[TARGET_CLASS] === "function";
      const detected =
        mod.env && mod.env.version ? mod.env.version : versionKey;
      logInfo(
        TARGET_CLASS + " in v" + detected + ": " + (hasClass ? "YES" : "NO"),
      );

      if (!hasClass) {
        logWarn(TARGET_CLASS + " not found in " + versionKey + " — skipping.");
        return null;
      }

      return { module: mod, version: detected, key: versionKey };
    } catch (err) {
      logWarn("Failed to import " + versionKey + ": " + err.message);
      return null;
    }
  }

  // ───────────────────────────────────────────────────────
  // Check class availability across versions
  // ───────────────────────────────────────────────────────
  async function checkClass(versionKey) {
    logInfo("=== Checking " + TARGET_CLASS + " availability ===");

    if (versionKey) {
      // Single version check
      const result = await importVersion(versionKey);
      if (result) {
        spikeModule = result.module;
        versionUsed = result.version;
      }
      return !!result;
    }

    // Check all versions
    const keys = Object.keys(CDN_VERSIONS);
    const results = {};
    for (let i = 0; i < keys.length; i++) {
      const result = await importVersion(keys[i]);
      results[keys[i]] = result ? "AVAILABLE" : "NOT FOUND";
    }

    logInfo("────────────────────────────────────────");
    logInfo("Version availability:");
    for (const key of Object.keys(results)) {
      logInfo("  " + key + ": " + results[key]);
    }
    logInfo("────────────────────────────────────────");

    return results;
  }

  // ───────────────────────────────────────────────────────
  // Load model with a specific version
  // ───────────────────────────────────────────────────────
  async function loadModel(versionKey, dtypeKey) {
    dtypeKey = dtypeKey || "safe";
    const dtypeConfig = DTYPE_CONFIGS[dtypeKey] || DTYPE_CONFIGS.safe;

    // If already loaded with same version, reuse
    if (
      spikeModel &&
      spikeProcessor &&
      versionKey &&
      versionUsed === versionKey
    ) {
      logInfo("Model already loaded with " + versionUsed + ".");
      return { model: spikeModel, processor: spikeProcessor };
    }

    // Clean up any previous model before loading with new version
    if (spikeModel || spikeProcessor) {
      logInfo("Cleaning up previous model before loading new version...");
      await cleanup();
    }

    // Import the requested version
    if (!spikeModule || (versionKey && versionUsed !== versionKey)) {
      const result = await importVersion(versionKey || "latest");
      if (!result) {
        logError(
          "Cannot load model — class not found in " +
            (versionKey || "latest") +
            ".",
        );
        return null;
      }
      spikeModule = result.module;
      versionUsed = result.version;
    }

    // Check WebGPU
    if (!navigator.gpu) {
      logError("WebGPU is NOT available. Phi-3.5-vision requires WebGPU.");
      return null;
    }
    logInfo("WebGPU: available.");

    // Load model
    logInfo(
      "=== Loading Phi-3.5-vision (" +
        versionUsed +
        ", dtype: " +
        dtypeKey +
        ") ===",
    );
    logInfo("dtype config:", JSON.stringify(dtypeConfig));
    dtypeUsed = dtypeKey;

    try {
      console.time("[Phi35Spike] Model load (" + versionUsed + ")");
      spikeModel = await spikeModule.AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        {
          dtype: dtypeConfig,
          device: "webgpu",
          progress_callback: function (progress) {
            if (progress.status === "downloading") {
              const pct = progress.progress
                ? Math.round(progress.progress) + "%"
                : "...";
              logDebug(
                "  Downloading: " + (progress.file || "unknown") + " " + pct,
              );
            } else if (progress.status === "ready") {
              logInfo("  File ready: " + (progress.file || ""));
            }
          },
        },
      );
      console.timeEnd("[Phi35Spike] Model load (" + versionUsed + ")");
    } catch (err) {
      console.timeEnd("[Phi35Spike] Model load (" + versionUsed + ")");
      logError("Model loading failed (" + versionUsed + "):", err.message);

      if (
        err.message &&
        (err.message.includes("bad_alloc") ||
          err.message.includes("memory") ||
          err.message.includes("OOM"))
      ) {
        logError(
          "GPU memory issue. Phi-3.5-vision (4.2B) may not fit on this GPU.",
        );
      }

      spikeModel = null;
      return null;
    }

    // Load processor
    try {
      console.time("[Phi35Spike] Processor load (" + versionUsed + ")");
      spikeProcessor = await spikeModule.AutoProcessor.from_pretrained(
        MODEL_ID,
        { legacy: true },
      );
      console.timeEnd("[Phi35Spike] Processor load (" + versionUsed + ")");
    } catch (err) {
      console.timeEnd("[Phi35Spike] Processor load (" + versionUsed + ")");
      logError("Processor loading failed:", err.message);
      spikeProcessor = null;
      return null;
    }

    logInfo("Model and processor loaded successfully (" + versionUsed + ").");
    return { model: spikeModel, processor: spikeProcessor };
  }

  // ───────────────────────────────────────────────────────
  // Get image from Image Describer preview
  // ───────────────────────────────────────────────────────
  async function getPreviewImage() {
    const previewImg = document.querySelector("#imgdesc-preview img");
    if (!previewImg || !previewImg.src) {
      logError(
        "No image in preview. Upload an image in Image Describer first.",
      );
      return null;
    }

    logInfo("Reading image from preview...");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = previewImg.naturalWidth || previewImg.width;
      canvas.height = previewImg.naturalHeight || previewImg.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(previewImg, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      logDebug(
        "Converted preview to data URL (" +
          canvas.width +
          "x" +
          canvas.height +
          ")",
      );

      // Prefer load_image (v3+) over RawImage
      if (typeof spikeModule.load_image === "function") {
        const image = await spikeModule.load_image(dataUrl);
        logDebug("Image loaded via load_image()");
        return image;
      }

      const image = await spikeModule.RawImage.read(dataUrl);
      logDebug(
        "Image loaded via RawImage: " + image.width + "x" + image.height,
      );
      return image;
    } catch (err) {
      logError("Failed to read image:", err.message);
      return null;
    }
  }

  // ───────────────────────────────────────────────────────
  // Inference helper
  // ───────────────────────────────────────────────────────
  async function runInference(prompt, image, label, maxTokens) {
    maxTokens = maxTokens || 512;

    // Phi-3.5-vision uses <|image_1|> placeholder
    const messages = [{ role: "user", content: "<|image_1|>\n" + prompt }];

    logDebug("Building input for: " + label);

    const text = spikeProcessor.tokenizer.apply_chat_template(messages, {
      tokenize: false,
      add_generation_prompt: true,
    });
    logDebug("Formatted prompt length: " + text.length + " chars");

    const inputs = await spikeProcessor(text, image, { num_crops: 4 });

    logInfo(
      "Running inference: " + label + " (max_tokens: " + maxTokens + ")...",
    );
    const startTime = performance.now();

    let tokensGenerated = 0;
    let streamedText = "";
    const generateOptions = {
      ...inputs,
      max_new_tokens: maxTokens,
      do_sample: false,
    };

    // Set up TextStreamer if available
    if (typeof spikeModule.TextStreamer === "function") {
      generateOptions.streamer = new spikeModule.TextStreamer(
        spikeProcessor.tokenizer,
        {
          skip_prompt: true,
          skip_special_tokens: true,
          callback_function: function (token) {
            streamedText += token;
            tokensGenerated++;
            if (tokensGenerated % 50 === 0) {
              const elapsed = Math.round(performance.now() - startTime);
              const tps = (tokensGenerated / (elapsed / 1000)).toFixed(1);
              logDebug("  " + tokensGenerated + " tokens, " + tps + " tok/s");
            }
          },
        },
      );
    }

    const outputs = await spikeModel.generate(generateOptions);
    const elapsed = Math.round(performance.now() - startTime);

    let result;
    if (streamedText.length > 0) {
      result = streamedText.trim();
    } else {
      const inputLength = inputs.input_ids.dims.at(-1);
      const outputSlice = outputs.slice(null, [inputLength, null]);
      const decoded = spikeProcessor.tokenizer.batch_decode(outputSlice, {
        skip_special_tokens: true,
      });
      result = (decoded[0] || "").trim();
      tokensGenerated = outputSlice.dims ? outputSlice.dims.at(-1) : 0;
    }

    const tokensPerSecond =
      elapsed > 0 ? (tokensGenerated / (elapsed / 1000)).toFixed(1) : "N/A";

    logInfo(
      label +
        " completed in " +
        elapsed +
        "ms (" +
        result.length +
        " chars, ~" +
        tokensGenerated +
        " tokens, " +
        tokensPerSecond +
        " tok/s)",
    );

    return {
      output: result,
      timeMs: elapsed,
      chars: result.length,
      tokens: tokensGenerated,
      tokensPerSecond: parseFloat(tokensPerSecond) || 0,
    };
  }

  // ───────────────────────────────────────────────────────
  // describe() — public method for custom prompts
  // ───────────────────────────────────────────────────────
  async function describe(prompt, maxTokens) {
    if (!spikeModel || !spikeProcessor) {
      logError("Model not loaded. Run Phi35Spike.loadModel() first.");
      return null;
    }

    const image = await getPreviewImage();
    if (!image) return null;

    const result = await runInference(
      prompt || "Describe this image in detail.",
      image,
      "Custom prompt",
      maxTokens,
    );
    console.log("=== CUSTOM PROMPT OUTPUT ===");
    console.log(result.output);
    return result;
  }

  // ───────────────────────────────────────────────────────
  // Structure check
  // ───────────────────────────────────────────────────────
  function checkStructure(output) {
    const markers = ["title", "alt text", "long description", "text content"];
    let found = 0;
    const lower = output.toLowerCase();
    for (let i = 0; i < markers.length; i++) {
      if (lower.indexOf(markers[i]) !== -1) found++;
    }
    const hasHeadings =
      /##\s*\d/m.test(output) ||
      /##\s*(title|alt|long|text)/im.test(output) ||
      /^#\s+(title|alt|long|text)/im.test(output);

    return {
      markersFound: found + "/4",
      hasHeadings: hasHeadings,
      followsStructure: found >= 3 || hasHeadings,
    };
  }

  // ───────────────────────────────────────────────────────
  // Memory profiling
  // ───────────────────────────────────────────────────────
  function profileMemory() {
    logInfo("=== Memory Profile ===");
    if (performance.memory) {
      logInfo(
        "  JS heap: " +
          Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) +
          " MB / " +
          Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) +
          " MB",
      );
    } else {
      logInfo(
        "  performance.memory not available (Chrome with --enable-precise-memory-info)",
      );
    }
    if (navigator.gpu) {
      navigator.gpu
        .requestAdapter()
        .then(function (adapter) {
          if (adapter && adapter.info) {
            logInfo("  GPU: " + (adapter.info.description || "unknown"));
            logInfo("  GPU vendor: " + (adapter.info.vendor || "unknown"));
          }
        })
        .catch(function () {});
    }
  }

  // ───────────────────────────────────────────────────────
  // Run tests with a specific version
  // Returns: { version, results } or null if model failed to load
  // ───────────────────────────────────────────────────────
  async function runTestsWithVersion(versionKey) {
    logInfo("");
    logInfo("╔══════════════════════════════════════════════════════╗");
    logInfo("║  TESTING WITH: " + versionKey.toUpperCase().padEnd(38) + "║");
    logInfo("╚══════════════════════════════════════════════════════╝");

    // Load model
    const loaded = await loadModel(versionKey, "safe");
    if (!loaded) {
      logError("Model failed to load with " + versionKey + ".");
      return null;
    }

    profileMemory();

    // Read image (must re-read because spikeModule may have changed)
    const img = await getPreviewImage();
    if (!img) {
      logError("No image available.");
      return null;
    }

    const results = {
      version: versionUsed,
      versionKey: versionKey,
      tests: {},
    };

    // ─── Test 1: Bare description ───
    logInfo("=== TEST 1: Bare Description (Baseline) ===");
    try {
      const result = await runInference(
        "Describe this image in detail for accessibility purposes.",
        img,
        "Test 1 (bare)",
        512,
      );
      results.tests.bare = result;
      console.log("=== BARE DESCRIPTION (" + versionKey + ") ===");
      console.log(result.output);
    } catch (err) {
      logError("Test 1 failed:", err.message);
      results.tests.bare = { error: err.message };

      // If this is an ONNX operator error, no point running more tests
      if (
        err.message.includes("Unsupported type proto") ||
        err.message.includes("OrtRun")
      ) {
        logWarn(
          "ONNX Runtime error — this version lacks required operator support.",
        );
        logWarn("Skipping remaining tests for " + versionKey + ".");
        results.onnxError = true;
        return results;
      }
    }

    // ─── Test 2: Structured output ───
    logInfo("=== TEST 2: Structured Output (Key Test) ===");
    try {
      const prompt2 =
        "Describe this image for accessibility using these sections:\n\n" +
        "## 1. Title\n" +
        "A brief descriptive title under 10 words.\n\n" +
        "## 2. Alt Text\n" +
        "One or two sentences: what the image shows, then its educational significance.\n\n" +
        "## 3. Long Description\n" +
        "Detailed description of the visual content and its educational purpose.\n\n" +
        "## 4. Text Content\n" +
        'List all visible text exactly as it appears, or write "No text content."';
      const result = await runInference(
        prompt2,
        img,
        "Test 2 (structured)",
        768,
      );
      results.tests.structured = result;
      console.log("=== STRUCTURED OUTPUT (" + versionKey + ") ===");
      console.log(result.output);
    } catch (err) {
      logError("Test 2 failed:", err.message);
      results.tests.structured = { error: err.message };
    }

    // ─── Test 3: Structured + context ───
    logInfo("=== TEST 3: Structured Output with Context ===");
    try {
      const prompt3 =
        "Describe this image for accessibility using these sections:\n\n" +
        "## 1. Title\n" +
        "A brief descriptive title under 10 words.\n\n" +
        "## 2. Alt Text\n" +
        "One or two sentences: what the image shows, then its educational significance.\n\n" +
        "## 3. Long Description\n" +
        "Detailed description of the visual content and its educational purpose.\n\n" +
        "## 4. Text Content\n" +
        'List all visible text exactly as it appears, or write "No text content."\n\n' +
        "Subject: Engineering. Topic: Thermofluids.\n" +
        "Learning objective: Understand the First Law of Thermodynamics applied to closed systems.";
      const result = await runInference(
        prompt3,
        img,
        "Test 3 (with context)",
        768,
      );
      results.tests.withContext = result;
      console.log("=== STRUCTURED WITH CONTEXT (" + versionKey + ") ===");
      console.log(result.output);
    } catch (err) {
      logError("Test 3 failed:", err.message);
      results.tests.withContext = { error: err.message };
    }

    // ─── Test 4: OCR focus ───
    logInfo("=== TEST 4: OCR Focus ===");
    try {
      const prompt4 =
        "Read and transcribe ALL visible text in this image. " +
        "Preserve the layout and structure as closely as possible. " +
        "Include labels, headings, captions, annotations, and any other text.";
      const result = await runInference(
        prompt4,
        img,
        "Test 4 (OCR focus)",
        768,
      );
      results.tests.ocr = result;
      console.log("=== OCR FOCUS (" + versionKey + ") ===");
      console.log(result.output);
    } catch (err) {
      logError("Test 4 failed:", err.message);
      results.tests.ocr = { error: err.message };
    }

    return results;
  }

  // ───────────────────────────────────────────────────────
  // Print summary for one version's results
  // ───────────────────────────────────────────────────────
  function printVersionSummary(results) {
    if (!results) return;

    logInfo("── " + results.versionKey + " (v" + results.version + ") ──");

    if (results.onnxError) {
      logError("  ONNX Runtime operator error — inference not supported.");
      return;
    }

    const tests = results.tests;

    if (tests.bare && !tests.bare.error) {
      logInfo(
        "  Test 1 (bare):       " +
          tests.bare.timeMs +
          "ms, " +
          tests.bare.chars +
          " chars, " +
          tests.bare.tokensPerSecond +
          " tok/s",
      );
    } else {
      logWarn(
        "  Test 1 (bare):       FAILED" +
          (tests.bare && tests.bare.error ? " — " + tests.bare.error : ""),
      );
    }

    if (tests.structured && !tests.structured.error) {
      const struct = checkStructure(tests.structured.output);
      logInfo(
        "  Test 2 (structured): " +
          tests.structured.timeMs +
          "ms, " +
          tests.structured.chars +
          " chars, " +
          tests.structured.tokensPerSecond +
          " tok/s",
      );
      logInfo(
        "    Follows structure? " +
          (struct.followsStructure ? "YES" : "NO") +
          " (markers: " +
          struct.markersFound +
          ", headings: " +
          struct.hasHeadings +
          ")",
      );
    } else {
      logWarn("  Test 2 (structured): FAILED");
    }

    if (tests.withContext && !tests.withContext.error) {
      const struct = checkStructure(tests.withContext.output);
      logInfo(
        "  Test 3 (context):    " +
          tests.withContext.timeMs +
          "ms, " +
          tests.withContext.chars +
          " chars, " +
          tests.withContext.tokensPerSecond +
          " tok/s",
      );
      logInfo(
        "    Follows structure? " +
          (struct.followsStructure ? "YES" : "NO") +
          " (markers: " +
          struct.markersFound +
          ", headings: " +
          struct.hasHeadings +
          ")",
      );
    } else {
      logWarn("  Test 3 (context):    FAILED");
    }

    if (tests.ocr && !tests.ocr.error) {
      logInfo(
        "  Test 4 (OCR):        " +
          tests.ocr.timeMs +
          "ms, " +
          tests.ocr.chars +
          " chars, " +
          tests.ocr.tokensPerSecond +
          " tok/s",
      );
    } else {
      logWarn("  Test 4 (OCR):        FAILED");
    }
  }

  // ───────────────────────────────────────────────────────
  // run() — main entry point with version cascading
  // ───────────────────────────────────────────────────────
  async function run(forceVersion) {
    logInfo("╔══════════════════════════════════════════════════════╗");
    logInfo("║  SPIKE: Phi-3.5-Vision-Instruct Browser Viability   ║");
    logInfo("║  Model: 4.2B params | onnx-community ONNX           ║");
    logInfo("║  Strategy: cascade @latest → v3.8.1                 ║");
    logInfo("╚══════════════════════════════════════════════════════╝");

    // Check for image first (before any slow model loading)
    const previewImg = document.querySelector("#imgdesc-preview img");
    if (!previewImg || !previewImg.src) {
      logError(
        "No image in preview. Upload an image in Image Describer first, then retry.",
      );
      return;
    }

    // Determine version order
    let versionOrder;
    if (forceVersion) {
      versionOrder = [forceVersion];
      logInfo("Forcing version: " + forceVersion);
    } else {
      versionOrder = ["latest", "v3"];
      logInfo("Will try versions in order: " + versionOrder.join(" → "));
    }

    const allResults = {};
    let firstSuccess = null;

    for (let i = 0; i < versionOrder.length; i++) {
      const vKey = versionOrder[i];

      const results = await runTestsWithVersion(vKey);

      allResults[vKey] = results;

      // Check if inference actually worked (not just model loading)
      if (results && !results.onnxError) {
        const hasAnyOutput = Object.values(results.tests).some(function (t) {
          return t && !t.error && t.output;
        });
        if (hasAnyOutput && !firstSuccess) {
          firstSuccess = vKey;
        }
      }

      // If ONNX error, try next version
      if (results && results.onnxError) {
        logWarn(vKey + " failed with ONNX error. Trying next version...");
        await cleanup();
        continue;
      }

      // If inference succeeded, no need to try more versions
      if (firstSuccess) {
        logInfo(vKey + " produced output — skipping remaining versions.");
        break;
      }

      // Clean up before next attempt
      await cleanup();
    }

    // ─── Final Summary ───
    logInfo("");
    logInfo("╔══════════════════════════════════════════════════════╗");
    logInfo("║      PHI-3.5-VISION SPIKE SUMMARY                   ║");
    logInfo("╚══════════════════════════════════════════════════════╝");
    logInfo("Model: " + MODEL_ID);
    logInfo("Quantisation: " + JSON.stringify(DTYPE_CONFIGS.safe));
    logInfo("");

    for (const vKey of Object.keys(allResults)) {
      printVersionSummary(allResults[vKey]);
    }

    logInfo("");
    if (firstSuccess) {
      logInfo("VERDICT: Inference succeeded with " + firstSuccess);
    } else {
      logError("VERDICT: Inference FAILED with all tested versions.");
      logError(
        "Phi-3.5-vision is NOT viable for browser-based inference with the current ONNX exports.",
      );
    }

    logInfo("");
    logInfo("── For comparison (from previous spikes): ──");
    logInfo("FastVLM 0.5B:  ~350 MB download, ~2–5s inference");
    logInfo("Qwen3.5 0.8B:  ~1 GB download, ~5–15s inference");
    logInfo("Phi-3.5 4.2B:  ~700 MB+ download, see results above");
    logInfo("════════════════════════════════════════════════════════");

    profileMemory();
  }

  // ───────────────────────────────────────────────────────
  // cleanup()
  // ───────────────────────────────────────────────────────
  async function cleanup() {
    if (spikeModel) {
      try {
        if (typeof spikeModel.dispose === "function") {
          await spikeModel.dispose();
        }
        logInfo("Model disposed.");
      } catch (err) {
        logWarn("Error disposing model:", err.message);
      }
      spikeModel = null;
    }

    if (spikeProcessor) {
      spikeProcessor = null;
      logInfo("Processor reference cleared.");
    }

    spikeModule = null;
    versionUsed = null;
    dtypeUsed = null;
    logInfo("Cleanup complete.");
  }

  // ───────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────
  window.Phi35Spike = {
    run: run,
    checkClass: checkClass,
    loadModel: loadModel,
    describe: describe,
    cleanup: cleanup,
    profileMemory: profileMemory,
  };

  logInfo("Phi-3.5-vision spike v2 loaded.");
  logInfo("Commands:");
  logInfo("  Phi35Spike.run()          — cascade: @latest then v3.8.1");
  logInfo('  Phi35Spike.run("latest")  — @latest only');
  logInfo('  Phi35Spike.run("v3")      — v3.8.1 only');
  logInfo('  Phi35Spike.run("pinned")  — v4.0.0-next.9 only');
  logInfo("  Phi35Spike.cleanup()      — free GPU memory");
})();
