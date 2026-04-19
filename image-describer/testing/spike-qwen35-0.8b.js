/**
 * ===================================================================
 * SPIKE: Qwen3.5-0.8B Browser Viability Test
 * ===================================================================
 *
 * Standalone spike — does NOT modify any production code.
 * Tests whether Qwen3.5-0.8B can run in the browser via Transformers.js
 * and follow structured output instructions.
 *
 * Run from console:
 *   QwenSpike.run()           — full test sequence
 *   QwenSpike.checkClass()    — class existence check only
 *   QwenSpike.loadModel()     — load model (downloads ~1GB first time)
 *   QwenSpike.describe(prompt) — run inference with custom prompt
 *   QwenSpike.cleanup()       — dispose model, free memory
 *
 * Requires an image to be uploaded in Image Describer first.
 * Uses the preview <img> element as the image source.
 *
 * DATE: 27 March 2026
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
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.ERROR)) console.error.apply(console, ["[QwenSpike]", message].concat(args));
  }

  function logWarn(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.WARN)) console.warn.apply(console, ["[QwenSpike]", message].concat(args));
  }

  function logInfo(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.INFO)) console.log.apply(console, ["[QwenSpike]", message].concat(args));
  }

  function logDebug(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log.apply(console, ["[QwenSpike]", message].concat(args));
  }

  // ───────────────────────────────────────────────────────
  // Constants
  // ───────────────────────────────────────────────────────
  const CDN_V4_CURRENT = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.9";
  const CDN_V4_LATEST = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest";
  const MODEL_ID = "onnx-community/Qwen3.5-0.8B-ONNX";
  const TARGET_CLASS = "Qwen3_5ForConditionalGeneration";

  // ───────────────────────────────────────────────────────
  // Spike state
  // ───────────────────────────────────────────────────────
  let spikeModule = null;   // Transformers.js module reference
  let spikeModel = null;    // Loaded model
  let spikeProcessor = null; // Loaded processor
  let versionUsed = null;   // Which CDN version worked

  // ───────────────────────────────────────────────────────
  // Step 1 & 2: Check class existence
  // ───────────────────────────────────────────────────────
  async function checkClass() {
    logInfo("=== STEP 1: Check class existence in current v4 module ===");

    // 1a. Check if the gateway already loaded a v4 module
    let foundInCurrent = false;
    try {
      if (window.ImageDescriberAnalyserTransformers) {
        const gateway = window.ImageDescriberAnalyserTransformers;
        // The gateway may store a reference to the loaded module
        if (gateway._transformersModule) {
          const mod = gateway._transformersModule;
          foundInCurrent = typeof mod[TARGET_CLASS] === "function";
          logInfo(TARGET_CLASS + " in gateway v4 module: " + (foundInCurrent ? "YES" : "NO"));
        } else {
          logInfo("Gateway exists but no _transformersModule reference found.");
        }
      } else {
        logInfo("No gateway loaded (ImageDescriberAnalyserTransformers not found).");
      }
    } catch (err) {
      logWarn("Error checking gateway module:", err.message);
    }

    // 1b. Try importing from the current pinned v4 CDN
    if (!foundInCurrent) {
      logInfo("Trying direct import from pinned v4: " + CDN_V4_CURRENT);
      try {
        const mod = await import(CDN_V4_CURRENT);
        foundInCurrent = typeof mod[TARGET_CLASS] === "function";
        logInfo(TARGET_CLASS + " in v4.0.0-next.9: " + (foundInCurrent ? "YES" : "NO"));
        if (foundInCurrent) {
          spikeModule = mod;
          versionUsed = "4.0.0-next.9";
        }
      } catch (err) {
        logWarn("Failed to import from pinned v4:", err.message);
      }
    }

    // 1c. If not found in current, try @latest
    if (!foundInCurrent) {
      logInfo("Not found in pinned v4. Trying @latest: " + CDN_V4_LATEST);
      try {
        const mod = await import(CDN_V4_LATEST);
        const foundInLatest = typeof mod[TARGET_CLASS] === "function";
        // Try to determine version
        const detectedVersion = mod.env && mod.env.version ? mod.env.version : "@latest";
        logInfo(TARGET_CLASS + " in v" + detectedVersion + ": " + (foundInLatest ? "YES" : "NO"));
        if (foundInLatest) {
          spikeModule = mod;
          versionUsed = detectedVersion;
          logInfo("Using @latest (v" + detectedVersion + ") — class found.");
        } else {
          logError(TARGET_CLASS + " not found in ANY v4 version. Qwen3.5-0.8B cannot be tested with current Transformers.js.");
        }
      } catch (err) {
        logError("Failed to import from @latest:", err.message);
      }
    }

    // Step 2: Quick check for v3 (only if already loaded)
    logInfo("=== STEP 2: Check v3 module (if already loaded) ===");
    try {
      // v3 would be loaded by gateway as a separate module — check window globals
      if (window.Transformers && typeof window.Transformers[TARGET_CLASS] === "function") {
        logInfo(TARGET_CLASS + " in v3 (window.Transformers): YES");
      } else {
        logInfo(TARGET_CLASS + " in v3: Not checked (v3 not loaded as global). Almost certainly absent — Qwen3.5 postdates v3.");
      }
    } catch (err) {
      logDebug("v3 check skipped:", err.message);
    }

    // Summary
    logInfo("────────────────────────────────────────");
    if (spikeModule) {
      logInfo("RESULT: " + TARGET_CLASS + " FOUND in v" + versionUsed);
      logInfo("Model loading is possible. Run QwenSpike.loadModel() or QwenSpike.run().");
    } else {
      logError("RESULT: " + TARGET_CLASS + " NOT FOUND in any available version.");
      logError("Qwen3.5-0.8B is not viable with current Transformers.js setup.");
      logError("A CDN upgrade would be needed to test further.");
    }
    logInfo("────────────────────────────────────────");

    return !!spikeModule;
  }

  // ───────────────────────────────────────────────────────
  // Step 3: Load model and processor
  // ───────────────────────────────────────────────────────
  async function loadModel() {
    if (!spikeModule) {
      logInfo("No module loaded yet. Running checkClass() first...");
      const available = await checkClass();
      if (!available) {
        logError("Cannot load model — class not found.");
        return null;
      }
    }

    if (spikeModel && spikeProcessor) {
      logInfo("Model and processor already loaded.");
      return { model: spikeModel, processor: spikeProcessor };
    }

    // Check WebGPU availability
    if (!navigator.gpu) {
      logError("WebGPU is NOT available in this browser. Qwen3.5 requires WebGPU.");
      logError("Try Chrome 113+ or Edge 113+ with WebGPU enabled.");
      return null;
    }
    logInfo("WebGPU: available.");

    // Load model
    logInfo("=== STEP 3: Loading Qwen3.5-0.8B model (~1GB first download) ===");
    try {
      console.time("[QwenSpike] Model load");
      spikeModel = await spikeModule[TARGET_CLASS].from_pretrained(MODEL_ID, {
        dtype: {
          embed_tokens: "q4",
          vision_encoder: "fp16",
          decoder_model_merged: "q4",
        },
        device: "webgpu",
        progress_callback: function (progress) {
          if (progress.status === "downloading") {
            var pct = progress.progress ? Math.round(progress.progress) + "%" : "...";
            logDebug("  Downloading: " + (progress.file || "unknown") + " " + pct);
          } else if (progress.status === "ready") {
            logInfo("  File ready: " + (progress.file || ""));
          }
        },
      });
      console.timeEnd("[QwenSpike] Model load");
    } catch (err) {
      console.timeEnd("[QwenSpike] Model load");
      logError("Model loading failed:", err.message);
      logError("Full error:", err);
      spikeModel = null;
      return null;
    }

    // Load processor
    try {
      console.time("[QwenSpike] Processor load");
      spikeProcessor = await spikeModule.AutoProcessor.from_pretrained(MODEL_ID);
      console.timeEnd("[QwenSpike] Processor load");
    } catch (err) {
      console.timeEnd("[QwenSpike] Processor load");
      logError("Processor loading failed:", err.message);
      logError("Full error:", err);
      spikeProcessor = null;
      return null;
    }

    logInfo("Model and processor loaded successfully.");
    return { model: spikeModel, processor: spikeProcessor };
  }

  // ───────────────────────────────────────────────────────
  // Step 4: Get image from Image Describer preview
  // ───────────────────────────────────────────────────────
  async function getPreviewImage() {
    var previewImg = document.querySelector("#imgdesc-preview img");
    if (!previewImg) {
      logError("No image in preview. Upload an image in Image Describer first.");
      return null;
    }

    if (!previewImg.src) {
      logError("Preview image has no src attribute.");
      return null;
    }

    logInfo("Reading image from preview...");
    try {
      // Convert <img> to data URL via canvas — blob URLs are revoked
      // after preview loads (lesson #15: pass elements, not blob URLs)
      var canvas = document.createElement("canvas");
      canvas.width = previewImg.naturalWidth || previewImg.width;
      canvas.height = previewImg.naturalHeight || previewImg.height;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(previewImg, 0, 0);
      var dataUrl = canvas.toDataURL("image/png");
      logDebug("Converted preview to data URL (" + canvas.width + "x" + canvas.height + ")");

      var image = await spikeModule.RawImage.read(dataUrl);
      logDebug("RawImage created: " + image.width + "x" + image.height);
      var resized = await image.resize(448, 448);
      logInfo("Image resized to 448x448 (required by Qwen3.5).");
      return resized;
    } catch (err) {
      logError("Failed to read/resize image:", err.message);
      return null;
    }
  }

  // ───────────────────────────────────────────────────────
  // Inference helper
  // ───────────────────────────────────────────────────────
  async function runInference(prompt, image, label) {
    var conversation = [
      {
        role: "user",
        content: [
          { type: "image" },
          { type: "text", text: prompt },
        ],
      },
    ];

    logDebug("Building input for: " + label);
    var text = spikeProcessor.apply_chat_template(conversation, {
      add_generation_prompt: true,
    });
    var inputs = await spikeProcessor(text, image);

    logInfo("Running inference: " + label + "...");
    var startTime = performance.now();
    var outputs = await spikeModel.generate({
      ...inputs,
      max_new_tokens: 512,
    });
    var elapsed = Math.round(performance.now() - startTime);

    // Decode output — skip the input tokens
    var inputLength = inputs.input_ids.dims.at(-1);
    var outputSlice = outputs.slice(null, [inputLength, null]);
    var decoded = spikeProcessor.tokenizer.batch_decode(outputSlice, {
      skip_special_tokens: true,
    });

    var result = decoded[0] || "";
    logInfo(label + " completed in " + elapsed + "ms (" + result.length + " chars)");

    return {
      output: result,
      timeMs: elapsed,
      chars: result.length,
    };
  }

  // ───────────────────────────────────────────────────────
  // describe() — public method for custom prompts
  // ───────────────────────────────────────────────────────
  async function describe(prompt) {
    if (!spikeModel || !spikeProcessor) {
      logError("Model not loaded. Run QwenSpike.loadModel() first.");
      return null;
    }

    var image = await getPreviewImage();
    if (!image) return null;

    var result = await runInference(prompt, image, "Custom prompt");
    console.log("=== CUSTOM PROMPT OUTPUT ===");
    console.log(result.output);
    return result;
  }

  // ───────────────────────────────────────────────────────
  // Structured output check
  // ───────────────────────────────────────────────────────
  function checkStructure(output) {
    // Check for section headings or keywords indicating structure
    var markers = ["title", "alt text", "long description", "text content"];
    var found = 0;
    var lower = output.toLowerCase();
    for (var i = 0; i < markers.length; i++) {
      if (lower.indexOf(markers[i]) !== -1) {
        found++;
      }
    }
    // Also check for markdown heading markers
    var hasHeadings = /##\s*\d/m.test(output) || /##\s*(title|alt|long|text)/im.test(output);
    return {
      markersFound: found + "/4",
      hasHeadings: hasHeadings,
      followsStructure: found >= 3 || hasHeadings,
    };
  }

  // ───────────────────────────────────────────────────────
  // run() — full test sequence
  // ───────────────────────────────────────────────────────
  async function run() {
    logInfo("╔══════════════════════════════════════════════════╗");
    logInfo("║   SPIKE: Qwen3.5-0.8B Browser Viability Test    ║");
    logInfo("╚══════════════════════════════════════════════════╝");

    // Step 1–2: Check class existence
    var available = await checkClass();
    if (!available) {
      logError("Spike complete — class not found. Cannot proceed.");
      return;
    }

    // Step 3: Load model
    var loaded = await loadModel();
    if (!loaded) {
      logError("Spike complete — model failed to load. Cannot proceed.");
      return;
    }
    var loadTime = "see console.time output above";

    // Step 4: Get image
    var image = await getPreviewImage();
    if (!image) {
      logError("Spike complete — no image available. Upload one and retry.");
      return;
    }

    // Step 5: Test 1 — Bare description (baseline)
    logInfo("=== STEP 5: Test 1 — Bare Description (Baseline) ===");
    var result1 = null;
    try {
      var prompt1 = "Describe this image in detail for accessibility purposes.";
      result1 = await runInference(prompt1, image, "Test 1 (bare)");
      console.log("=== BARE DESCRIPTION ===");
      console.log(result1.output);
    } catch (err) {
      logError("Test 1 failed:", err.message);
      logError("Full error:", err);
    }

    // Step 6: Test 2 — Structured output (the key test)
    logInfo("=== STEP 6: Test 2 — Structured Output (Key Test) ===");
    var result2 = null;
    try {
      var prompt2 =
        "Describe this image for accessibility using these sections:\n\n" +
        "## 1. Title\n" +
        "A brief descriptive title under 10 words.\n\n" +
        "## 2. Alt Text\n" +
        "One or two sentences: what the image shows, then its educational significance.\n\n" +
        "## 3. Long Description\n" +
        "Detailed description of the visual content and its educational purpose.\n\n" +
        "## 4. Text Content\n" +
        'List all visible text exactly as it appears, or write "No text content."';
      result2 = await runInference(prompt2, image, "Test 2 (structured)");
      console.log("=== STRUCTURED OUTPUT ===");
      console.log(result2.output);
    } catch (err) {
      logError("Test 2 failed:", err.message);
      logError("Full error:", err);
    }

    // Step 7: Test 3 — Structured output with context
    logInfo("=== STEP 7: Test 3 — Structured Output with Context ===");
    var result3 = null;
    try {
      var prompt3 =
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
      result3 = await runInference(prompt3, image, "Test 3 (with context)");
      console.log("=== STRUCTURED OUTPUT WITH CONTEXT ===");
      console.log(result3.output);
    } catch (err) {
      logError("Test 3 failed:", err.message);
      logError("Full error:", err);
    }

    // Step 8: Summary
    logInfo("");
    logInfo("╔══════════════════════════════════════════════════╗");
    logInfo("║        QWEN3.5-0.8B SPIKE SUMMARY               ║");
    logInfo("╚══════════════════════════════════════════════════╝");
    logInfo("Library version:       " + versionUsed);
    logInfo("Model:                 " + MODEL_ID);

    if (result1) {
      logInfo("Test 1 (bare):         " + result1.timeMs + "ms, " + result1.chars + " chars");
    } else {
      logWarn("Test 1 (bare):         FAILED");
    }

    if (result2) {
      var struct2 = checkStructure(result2.output);
      logInfo("Test 2 (structured):   " + result2.timeMs + "ms, " + result2.chars + " chars");
      logInfo("  Follows structure?   " + (struct2.followsStructure ? "YES" : "NO") +
        " (markers: " + struct2.markersFound + ", headings: " + struct2.hasHeadings + ")");
    } else {
      logWarn("Test 2 (structured):   FAILED");
    }

    if (result3) {
      var struct3 = checkStructure(result3.output);
      logInfo("Test 3 (with context): " + result3.timeMs + "ms, " + result3.chars + " chars");
      logInfo("  Follows structure?   " + (struct3.followsStructure ? "YES" : "NO") +
        " (markers: " + struct3.markersFound + ", headings: " + struct3.hasHeadings + ")");
    } else {
      logWarn("Test 3 (with context): FAILED");
    }

    logInfo("════════════════════════════════════════════════════");
  }

  // ───────────────────────────────────────────────────────
  // cleanup() — dispose model and free memory
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
    logInfo("Cleanup complete. Memory should be freed by GC.");
  }

  // ───────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────
  window.QwenSpike = {
    run: run,
    checkClass: checkClass,
    loadModel: loadModel,
    describe: describe,
    cleanup: cleanup,
  };

  logInfo("Qwen3.5-0.8B spike loaded. Run QwenSpike.run() to start.");
})();
