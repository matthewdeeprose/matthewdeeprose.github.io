/**
 * Phase 12C-3: VLM Comparison Spike
 *
 * Compares three vision-language models for local image description
 * generation via Transformers.js v4 in the browser:
 *   1. FastVLM 0.5B (Apple) — primary candidate
 *   2. Moondream2 1.7B — backup candidate
 *   3. Qwen2-VL 2B — monitor candidate
 *
 * Prerequisites:
 *   - Models will be downloaded on first run (hundreds of MB each)
 *   - Ensure stable internet connection for first download
 *   - Close other tabs to free memory
 *   - May need page refresh between models if memory is tight
 *
 * Usage:
 *   VLMComparisonSpike.run("fastvlm")     // Run FastVLM only (recommended first)
 *   VLMComparisonSpike.run("moondream")    // Run Moondream2 only
 *   VLMComparisonSpike.run("qwen2vl")     // Run Qwen2-VL only (warning: large)
 *   VLMComparisonSpike.runAll()            // Run all three, print comparison
 *   VLMComparisonSpike.compare(results)    // Re-print comparison from saved results
 */
window.VLMComparisonSpike = (function () {
  "use strict";

  // ───────────────────────────────────────────────────────
  // Logging configuration
  // ───────────────────────────────────────────────────────
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.ERROR)) console.error.apply(console, ["[VLMSpike]", message].concat(args));
  }

  function logWarn(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.WARN)) console.warn.apply(console, ["[VLMSpike]", message].concat(args));
  }

  function logInfo(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.INFO)) console.log.apply(console, ["[VLMSpike]", message].concat(args));
  }

  function logDebug(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log.apply(console, ["[VLMSpike]", message].concat(args));
  }

  // ───────────────────────────────────────────────────────
  // Constants
  // ───────────────────────────────────────────────────────
  const CDN_V4 =
    "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.9";

  const MODELS = {
    fastvlm: {
      id: "onnx-community/FastVLM-0.5B-ONNX",
      label: "FastVLM 0.5B (Apple)",
      params: "0.5B",
      dtype: {
        embed_tokens: "fp16",
        vision_encoder: "q4",
        decoder_model_merged: "q4",
      },
      // Uses AutoModelForImageTextToText (generic Auto class)
      modelClass: "AutoModelForImageTextToText",
      needsTokenizer: false,
    },
    moondream: {
      id: "Xenova/moondream2",
      label: "Moondream2 1.7B",
      params: "1.7B",
      dtype: {
        embed_tokens: "fp16",
        vision_encoder: "fp16",
        decoder_model_merged: "q4",
      },
      // Uses specific named class — Moondream1ForConditionalGeneration (note: "1" not "2")
      modelClass: "Moondream1ForConditionalGeneration",
      needsTokenizer: true,
    },
    qwen2vl: {
      id: "onnx-community/Qwen2-VL-2B-Instruct",
      label: "Qwen2-VL 2B",
      params: "2B",
      dtype: "q4",
      // Uses specific named class
      modelClass: "Qwen2VLForConditionalGeneration",
      needsTokenizer: false,
    },
  };

  const TEST_PROMPT =
    "Describe this image in detail for accessibility purposes. Include the main subject, layout, colours, and any text visible in the image.";

  // ───────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────
  const hr = () => "\u2550".repeat(70);
  const dash = () => "\u2500".repeat(40);

  function log(msg) {
    console.log("[VLMSpike]", msg);
  }

  function logSection(title) {
    console.log("\n" + hr());
    console.log("  " + title);
    console.log(hr());
  }

  /**
   * Get the uploaded preview image data URL if available.
   * @returns {string|null}
   */
  function getUploadedImage() {
    const container = document.getElementById("imgdesc-preview");
    const img = container
      ? container.querySelector("img.imgdesc-preview-image") ||
        container.querySelector("img")
      : null;

    if (img && img.src && img.src !== "") {
      log("Using uploaded preview image");
      return img.src;
    }
    return null;
  }

  /**
   * Create a simple synthetic test image on canvas.
   * @param {number} [width=320]
   * @param {number} [height=240]
   * @returns {string} Data URL of the test image
   */
  function createTestImage(width, height) {
    width = width || 320;
    height = height || 240;
    log("Creating synthetic test image (" + width + "\u00D7" + height + ")");

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, width, height);

    // Red rectangle
    ctx.fillStyle = "#cc3333";
    ctx.fillRect(40, 40, 100, 80);

    // Blue circle
    ctx.fillStyle = "#3366cc";
    ctx.beginPath();
    ctx.arc(220, 100, 50, 0, Math.PI * 2);
    ctx.fill();

    // Text
    ctx.fillStyle = "#333333";
    ctx.font = "16px sans-serif";
    ctx.fillText("Test Image", 110, 200);

    return canvas.toDataURL("image/png");
  }

  /**
   * Load the Transformers.js v4 module.
   * Uses gateway if available, otherwise direct CDN import.
   * @returns {Promise<object>} The v4 module
   */
  let cachedV4 = null;
  async function loadV4Module() {
    if (cachedV4) {
      log("Using cached v4 module");
      return cachedV4;
    }

    if (
      typeof window.ImageDescriberAnalyserTransformers !== "undefined" &&
      typeof window.ImageDescriberAnalyserTransformers.ensureV4Library === "function"
    ) {
      log("Loading v4 via gateway (ensureV4Library)\u2026");
      cachedV4 = await window.ImageDescriberAnalyserTransformers.ensureV4Library();
    } else {
      log("Loading v4 directly from CDN: " + CDN_V4);
      cachedV4 = await import(CDN_V4);
    }

    return cachedV4;
  }

  /**
   * Format a number with commas for display.
   * @param {number} n
   * @returns {string}
   */
  function formatNum(n) {
    if (n == null) return "\u2014";
    return Math.round(n).toLocaleString();
  }

  /**
   * Pad a string to a given width.
   * @param {string} str
   * @param {number} width
   * @returns {string}
   */
  function pad(str, width) {
    str = String(str);
    while (str.length < width) str += " ";
    return str;
  }

  // ───────────────────────────────────────────────────────
  // Per-model inference runners
  // ───────────────────────────────────────────────────────

  /**
   * Run FastVLM inference.
   * @param {object} v4 - Transformers.js v4 module
   * @param {object} modelDef - Model definition from MODELS
   * @param {string} imgSrc - Image data URL
   * @param {boolean} isSynthetic
   * @returns {Promise<object>} Result object
   */
  async function runFastVLM(v4, modelDef, imgSrc, isSynthetic) {
    const timings = {};

    // Diagnostic: check AutoModelForImageTextToText exists
    if (typeof v4.AutoModelForImageTextToText !== "function") {
      return {
        model: "fastvlm",
        modelId: modelDef.id,
        label: modelDef.label,
        params: modelDef.params,
        timings: { libraryLoad: 0, modelLoad: 0, inference: 0, total: 0 },
        output: "",
        outputLength: 0,
        success: false,
        error: "Architecture class AutoModelForImageTextToText not found in v4",
        isSynthetic: isSynthetic,
      };
    }

    if (typeof v4.AutoProcessor !== "function") {
      return {
        model: "fastvlm", modelId: modelDef.id, label: modelDef.label,
        params: modelDef.params,
        timings: { libraryLoad: 0, modelLoad: 0, inference: 0, total: 0 },
        output: "", outputLength: 0, success: false,
        error: "AutoProcessor not found in v4", isSynthetic: isSynthetic,
      };
    }

    // Load model + processor
    log("Loading FastVLM processor and model\u2026");
    const t1 = performance.now();

    const processor = await v4.AutoProcessor.from_pretrained(modelDef.id);
    const model = await v4.AutoModelForImageTextToText.from_pretrained(
      modelDef.id,
      {
        dtype: modelDef.dtype,
        device: "webgpu",
        progress_callback: function (progress) {
          if (progress && progress.progress !== undefined) {
            const rounded = Math.round(progress.progress / 25) * 25;
            if (Math.abs(progress.progress - rounded) < 1 || progress.progress > 99) {
              log("  Download: " + progress.progress.toFixed(1) + "% \u2014 " + (progress.file || ""));
            }
          }
        },
      }
    );

    timings.modelLoad = performance.now() - t1;
    log("FastVLM loaded in " + formatNum(timings.modelLoad) + " ms");

    // Prepare prompt — FastVLM uses string content with <image> token
    const messages = [
      {
        role: "user",
        content: "<image>" + TEST_PROMPT,
      },
    ];
    const prompt = processor.apply_chat_template(messages, {
      add_generation_prompt: true,
    });
    logDebug("Prompt (first 200 chars): " + String(prompt).substring(0, 200));

    // Read image
    const image = await v4.RawImage.read(imgSrc);
    log("Image loaded: " + image.width + " \u00D7 " + image.height);

    // Process inputs — FastVLM: image first, then prompt
    const inputs = await processor(image, prompt, { add_special_tokens: false });
    log("Inputs prepared. Keys: " + Object.keys(inputs));

    // Inference
    log("Generating (256 max new tokens)\u2026");
    const t2 = performance.now();

    const outputs = await model.generate({
      ...inputs,
      max_new_tokens: 256,
      do_sample: false,
    });

    timings.inference = performance.now() - t2;
    log("Inference completed in " + formatNum(timings.inference) + " ms");

    // Decode — slice to skip prompt tokens
    const decoded = processor.batch_decode(
      outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
      { skip_special_tokens: true }
    );
    const outputText = Array.isArray(decoded) ? decoded[0] : String(decoded);

    // Cleanup
    try { model.dispose && model.dispose(); } catch (e) { /* ignore */ }

    timings.total = timings.modelLoad + timings.inference;

    return {
      model: "fastvlm",
      modelId: modelDef.id,
      label: modelDef.label,
      params: modelDef.params,
      timings: {
        libraryLoad: 0, // set by caller
        modelLoad: timings.modelLoad,
        inference: timings.inference,
        total: timings.total,
      },
      output: outputText.trim(),
      outputLength: outputText.trim().length,
      success: true,
      error: null,
      isSynthetic: isSynthetic,
    };
  }

  /**
   * Run Moondream2 inference.
   * @param {object} v4 - Transformers.js v4 module
   * @param {object} modelDef - Model definition from MODELS
   * @param {string} imgSrc - Image data URL
   * @param {boolean} isSynthetic
   * @returns {Promise<object>} Result object
   */
  async function runMoondream(v4, modelDef, imgSrc, isSynthetic) {
    const timings = {};

    // Diagnostic: check Moondream1ForConditionalGeneration exists
    if (typeof v4.Moondream1ForConditionalGeneration !== "function") {
      return {
        model: "moondream", modelId: modelDef.id, label: modelDef.label,
        params: modelDef.params,
        timings: { libraryLoad: 0, modelLoad: 0, inference: 0, total: 0 },
        output: "", outputLength: 0, success: false,
        error: "Architecture class Moondream1ForConditionalGeneration not found in v4",
        isSynthetic: isSynthetic,
      };
    }

    if (typeof v4.AutoProcessor !== "function" || typeof v4.AutoTokenizer !== "function") {
      return {
        model: "moondream", modelId: modelDef.id, label: modelDef.label,
        params: modelDef.params,
        timings: { libraryLoad: 0, modelLoad: 0, inference: 0, total: 0 },
        output: "", outputLength: 0, success: false,
        error: "AutoProcessor or AutoTokenizer not found in v4",
        isSynthetic: isSynthetic,
      };
    }

    // Load processor, tokenizer, and model
    log("Loading Moondream2 processor, tokenizer, and model\u2026");
    const t1 = performance.now();

    const processorPromise = v4.AutoProcessor.from_pretrained(modelDef.id);
    const tokenizerPromise = v4.AutoTokenizer.from_pretrained(modelDef.id);
    const modelPromise = v4.Moondream1ForConditionalGeneration.from_pretrained(
      modelDef.id,
      {
        dtype: modelDef.dtype,
        device: "webgpu",
        progress_callback: function (progress) {
          if (progress && progress.progress !== undefined) {
            const rounded = Math.round(progress.progress / 25) * 25;
            if (Math.abs(progress.progress - rounded) < 1 || progress.progress > 99) {
              log("  Download: " + progress.progress.toFixed(1) + "% \u2014 " + (progress.file || ""));
            }
          }
        },
      }
    );

    const results = await Promise.all([processorPromise, tokenizerPromise, modelPromise]);
    const processor = results[0];
    const tokenizer = results[1];
    const model = results[2];

    timings.modelLoad = performance.now() - t1;
    log("Moondream2 loaded in " + formatNum(timings.modelLoad) + " ms");

    // Prepare text inputs — Moondream format
    const text = "<image>\n\nQuestion: " + TEST_PROMPT + "\n\nAnswer:";
    const text_inputs = tokenizer(text);
    logDebug("Text input: " + text.substring(0, 200));

    // Read and process image
    const image = await v4.RawImage.read(imgSrc);
    log("Image loaded: " + image.width + " \u00D7 " + image.height);
    const vision_inputs = await processor(image);
    log("Vision inputs prepared. Keys: " + Object.keys(vision_inputs));

    // Inference
    log("Generating (256 max new tokens)\u2026");
    const t2 = performance.now();

    const output = await model.generate({
      ...text_inputs,
      ...vision_inputs,
      do_sample: false,
      max_new_tokens: 256,
    });

    timings.inference = performance.now() - t2;
    log("Inference completed in " + formatNum(timings.inference) + " ms");

    // Decode — output includes prompt, need to extract answer
    const decoded = tokenizer.batch_decode(output, { skip_special_tokens: true });
    let outputText = Array.isArray(decoded) ? decoded[0] : String(decoded);

    // Strip prompt prefix from output (Moondream includes it)
    const answerMarker = "Answer:";
    const answerIdx = outputText.lastIndexOf(answerMarker);
    if (answerIdx !== -1) {
      outputText = outputText.substring(answerIdx + answerMarker.length);
    }

    // Cleanup
    try { model.dispose && model.dispose(); } catch (e) { /* ignore */ }

    timings.total = timings.modelLoad + timings.inference;

    return {
      model: "moondream",
      modelId: modelDef.id,
      label: modelDef.label,
      params: modelDef.params,
      timings: {
        libraryLoad: 0,
        modelLoad: timings.modelLoad,
        inference: timings.inference,
        total: timings.total,
      },
      output: outputText.trim(),
      outputLength: outputText.trim().length,
      success: true,
      error: null,
      isSynthetic: isSynthetic,
    };
  }

  /**
   * Run Qwen2-VL inference.
   * @param {object} v4 - Transformers.js v4 module
   * @param {object} modelDef - Model definition from MODELS
   * @param {string} imgSrc - Image data URL
   * @param {boolean} isSynthetic
   * @returns {Promise<object>} Result object
   */
  async function runQwen2VL(v4, modelDef, imgSrc, isSynthetic) {
    const timings = {};

    // Diagnostic: check Qwen2VLForConditionalGeneration exists
    if (typeof v4.Qwen2VLForConditionalGeneration !== "function") {
      return {
        model: "qwen2vl", modelId: modelDef.id, label: modelDef.label,
        params: modelDef.params,
        timings: { libraryLoad: 0, modelLoad: 0, inference: 0, total: 0 },
        output: "", outputLength: 0, success: false,
        error: "Architecture class Qwen2VLForConditionalGeneration not found in v4",
        isSynthetic: isSynthetic,
      };
    }

    if (typeof v4.AutoProcessor !== "function") {
      return {
        model: "qwen2vl", modelId: modelDef.id, label: modelDef.label,
        params: modelDef.params,
        timings: { libraryLoad: 0, modelLoad: 0, inference: 0, total: 0 },
        output: "", outputLength: 0, success: false,
        error: "AutoProcessor not found in v4", isSynthetic: isSynthetic,
      };
    }

    // Load processor and model
    log("Loading Qwen2-VL processor and model\u2026");
    const t1 = performance.now();

    const processorPromise = v4.AutoProcessor.from_pretrained(modelDef.id);
    const modelPromise = v4.Qwen2VLForConditionalGeneration.from_pretrained(
      modelDef.id,
      {
        dtype: modelDef.dtype,
        device: "webgpu",
        progress_callback: function (progress) {
          if (progress && progress.progress !== undefined) {
            const rounded = Math.round(progress.progress / 25) * 25;
            if (Math.abs(progress.progress - rounded) < 1 || progress.progress > 99) {
              log("  Download: " + progress.progress.toFixed(1) + "% \u2014 " + (progress.file || ""));
            }
          }
        },
      }
    );

    const results = await Promise.all([processorPromise, modelPromise]);
    const processor = results[0];
    const model = results[1];

    timings.modelLoad = performance.now() - t1;
    log("Qwen2-VL loaded in " + formatNum(timings.modelLoad) + " ms");

    // Read image and resize to 448x448 as per Qwen2-VL docs
    let image = await v4.RawImage.read(imgSrc);
    log("Image loaded: " + image.width + " \u00D7 " + image.height);
    image = await image.resize(448, 448);
    log("Image resized to 448 \u00D7 448");

    // Prepare prompt — Qwen2-VL uses conversation with array content objects
    const conversation = [
      {
        role: "user",
        content: [
          { type: "image" },
          { type: "text", text: TEST_PROMPT },
        ],
      },
    ];
    const text = processor.apply_chat_template(conversation, {
      add_generation_prompt: true,
    });
    logDebug("Prompt (first 200 chars): " + String(text).substring(0, 200));

    // Process inputs — Qwen2-VL: text first, then image
    const inputs = await processor(text, image);
    log("Inputs prepared. Keys: " + Object.keys(inputs));

    // Inference
    log("Generating (256 max new tokens)\u2026");
    const t2 = performance.now();

    const outputs = await model.generate({
      ...inputs,
      max_new_tokens: 256,
      do_sample: false,
    });

    timings.inference = performance.now() - t2;
    log("Inference completed in " + formatNum(timings.inference) + " ms");

    // Decode — slice to skip prompt tokens (same pattern as FastVLM)
    const decoded = processor.batch_decode(
      outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
      { skip_special_tokens: true }
    );
    const outputText = Array.isArray(decoded) ? decoded[0] : String(decoded);

    // Cleanup
    try { model.dispose && model.dispose(); } catch (e) { /* ignore */ }

    timings.total = timings.modelLoad + timings.inference;

    return {
      model: "qwen2vl",
      modelId: modelDef.id,
      label: modelDef.label,
      params: modelDef.params,
      timings: {
        libraryLoad: 0,
        modelLoad: timings.modelLoad,
        inference: timings.inference,
        total: timings.total,
      },
      output: outputText.trim(),
      outputLength: outputText.trim().length,
      success: true,
      error: null,
      isSynthetic: isSynthetic,
    };
  }

  // ───────────────────────────────────────────────────────
  // Runner dispatch
  // ───────────────────────────────────────────────────────

  const RUNNERS = {
    fastvlm: runFastVLM,
    moondream: runMoondream,
    qwen2vl: runQwen2VL,
  };

  // ───────────────────────────────────────────────────────
  // Comparison table
  // ───────────────────────────────────────────────────────

  /**
   * Print a formatted comparison table from an array of result objects.
   * @param {object[]} results - Array of result objects from run()
   */
  function compare(results) {
    if (!results || !results.length) {
      logWarn("No results to compare.");
      return;
    }

    logSection("VLM Comparison Results \u2014 Phase 12C-3");

    // Build table
    const colWidth = 16;
    const labelWidth = 22;

    // Header
    let header = "  " + pad("Metric", labelWidth) + "\u2502";
    results.forEach(function (r) {
      header += " " + pad(r.label.substring(0, colWidth - 1), colWidth) + "\u2502";
    });
    console.log(header);
    console.log("  " + "\u2500".repeat(labelWidth) + "\u253C" +
      results.map(function () { return "\u2500".repeat(colWidth + 1); }).join("\u253C") + "\u2524");

    // Rows
    const rows = [
      {
        label: "Status",
        fn: function (r) { return r.success ? "\u2705 Pass" : "\u274C Fail"; },
      },
      {
        label: "Parameters",
        fn: function (r) { return r.params; },
      },
      {
        label: "Error",
        fn: function (r) { return r.error ? r.error.substring(0, colWidth - 1) : "\u2014"; },
      },
      {
        label: "Model load (ms)",
        fn: function (r) { return r.success ? formatNum(r.timings.modelLoad) : "\u2014"; },
      },
      {
        label: "Inference (ms)",
        fn: function (r) { return r.success ? formatNum(r.timings.inference) : "\u2014"; },
      },
      {
        label: "Total (ms)",
        fn: function (r) {
          return r.success
            ? formatNum(r.timings.libraryLoad + r.timings.modelLoad + r.timings.inference)
            : "\u2014";
        },
      },
      {
        label: "Output length",
        fn: function (r) { return r.success ? r.outputLength + " chars" : "\u2014"; },
      },
    ];

    rows.forEach(function (row) {
      let line = "  " + pad(row.label, labelWidth) + "\u2502";
      results.forEach(function (r) {
        line += " " + pad(row.fn(r), colWidth) + "\u2502";
      });
      console.log(line);
    });

    console.log("  " + "\u2500".repeat(labelWidth) + "\u2534" +
      results.map(function () { return "\u2500".repeat(colWidth + 1); }).join("\u2534") + "\u2518");

    // Print each model's full output
    console.log("");
    results.forEach(function (r) {
      logSection(r.label + " \u2014 Output");
      if (!r.success) {
        console.log("  FAILED: " + r.error);
      } else if (!r.output) {
        console.log("  (empty output)");
      } else {
        const lines = r.output.match(/.{1,70}/g) || [r.output];
        lines.forEach(function (line) {
          console.log("  " + line);
        });
      }
      console.log("");
    });

    // Quality checklist
    console.log("Quality checklist (assess manually):");
    console.log("  [ ] Identifies main subjects?");
    console.log("  [ ] Mentions colours correctly?");
    console.log("  [ ] Mentions spatial layout?");
    console.log("  [ ] Detects/transcribes text?");
    console.log("  [ ] Coherent prose (not repetitive)?");
    console.log("  [ ] No hallucinations?");
    console.log("  [ ] Clean output (no prompt leakage)?");
    console.log("");

    // Viability assessment
    console.log("Viability thresholds:");
    console.log("  Total time < 60s (ideally < 30s)");
    console.log("  Output quality: subjects, colours, text");
    console.log("  No garbage or severe hallucinations");
    console.log("");
  }

  // ───────────────────────────────────────────────────────
  // Main run function
  // ───────────────────────────────────────────────────────

  /**
   * Run a single model spike.
   * @param {string} modelKey - "fastvlm", "moondream", or "qwen2vl"
   * @returns {Promise<object>} Result object
   */
  async function run(modelKey) {
    const modelDef = MODELS[modelKey];
    if (!modelDef) {
      logError("Unknown model key: " + modelKey + ". Use 'fastvlm', 'moondream', or 'qwen2vl'.");
      return null;
    }

    const runner = RUNNERS[modelKey];
    if (!runner) {
      logError("No runner for model key: " + modelKey);
      return null;
    }

    logSection("VLM Comparison Spike \u2014 Phase 12C-3");
    log("Model: " + modelDef.label + " (" + modelDef.id + ")");
    log("Parameters: " + modelDef.params);
    log("Required class: " + modelDef.modelClass);

    // Step 1: Get image
    const uploadedSrc = getUploadedImage();
    const isSynthetic = !uploadedSrc;
    const imgSrc = uploadedSrc || createTestImage();
    log("Image source: " + (isSynthetic ? "synthetic test image" : "uploaded preview"));

    // Step 2: Load v4 module
    logSection("Step 1 \u2014 Load Transformers.js v4");
    const t0 = performance.now();
    let v4;

    try {
      v4 = await loadV4Module();
    } catch (err) {
      logError("Failed to load v4 module:", err);
      return {
        model: modelKey, modelId: modelDef.id, label: modelDef.label,
        params: modelDef.params,
        timings: { libraryLoad: 0, modelLoad: 0, inference: 0, total: 0 },
        output: "", outputLength: 0, success: false,
        error: "Failed to load v4 module: " + err.message, isSynthetic: isSynthetic,
      };
    }

    const libraryLoadTime = performance.now() - t0;
    log("v4 module loaded in " + formatNum(libraryLoadTime) + " ms");

    // Diagnostic: check required class exists
    logSection("Step 2 \u2014 Diagnostic check");
    const requiredClass = modelDef.modelClass;
    const classExists = typeof v4[requiredClass] === "function";
    log("Required class " + requiredClass + ": " + (classExists ? "FOUND" : "NOT FOUND"));

    if (!classExists) {
      // List available related classes for diagnostics
      const relatedClasses = Object.keys(v4).filter(function (k) {
        return /ForConditionalGeneration|ForVision2Seq|ForImageTextToText/i.test(k);
      });
      log("Available vision/generation classes: " + (relatedClasses.length ? relatedClasses.join(", ") : "none"));
    }

    // Step 3: Run model-specific inference
    logSection("Step 3 \u2014 Load and run " + modelDef.label);
    let result;

    try {
      result = await runner(v4, modelDef, imgSrc, isSynthetic);
      result.timings.libraryLoad = libraryLoadTime;
      result.timings.total = libraryLoadTime + result.timings.modelLoad + result.timings.inference;
    } catch (err) {
      logError("Model run failed:", err);
      result = {
        model: modelKey, modelId: modelDef.id, label: modelDef.label,
        params: modelDef.params,
        timings: { libraryLoad: libraryLoadTime, modelLoad: 0, inference: 0, total: libraryLoadTime },
        output: "", outputLength: 0, success: false,
        error: err.message, isSynthetic: isSynthetic,
      };
    }

    // Print single-model results
    logSection("Results \u2014 " + modelDef.label);
    console.log("  Status:          " + (result.success ? "\u2705 Pass" : "\u274C Fail"));
    if (result.error) {
      console.log("  Error:           " + result.error);
    }
    console.log("  Library load:    " + formatNum(result.timings.libraryLoad) + " ms");
    console.log("  Model load:      " + formatNum(result.timings.modelLoad) + " ms");
    console.log("  Inference:       " + formatNum(result.timings.inference) + " ms");
    console.log("  Total:           " + formatNum(result.timings.total) + " ms");
    console.log("  Output length:   " + result.outputLength + " chars");
    console.log("  Image:           " + (result.isSynthetic ? "synthetic" : "uploaded"));

    if (result.success && result.output) {
      console.log("");
      console.log("  Generated description:");
      console.log("  " + dash());
      const lines = result.output.match(/.{1,70}/g) || [result.output];
      lines.forEach(function (line) {
        console.log("  " + line);
      });
      console.log("  " + dash());
    }

    console.log("");
    log("Note: set model/processor/tokenizer to null. Browser may need refresh before next model if memory is tight.");

    return result;
  }

  /**
   * Run all three models sequentially and print comparison table.
   * Order: FastVLM (smallest) \u2192 Moondream \u2192 Qwen2-VL (largest)
   * @returns {Promise<object[]>} Array of result objects
   */
  async function runAll() {
    logSection("VLM Comparison Suite \u2014 Phase 12C-3");
    log("Running all three models sequentially:");
    log("  1. FastVLM 0.5B (smallest, most likely to succeed)");
    log("  2. Moondream2 1.7B");
    log("  3. Qwen2-VL 2B (largest, may be slow)");
    log("");
    log("NOTE: Browser may need refresh between models if memory is tight.");
    log("      Running smallest first to maximise chance of success.");
    console.log("");

    const modelKeys = ["fastvlm", "moondream", "qwen2vl"];
    const allResults = [];

    for (let i = 0; i < modelKeys.length; i++) {
      const key = modelKeys[i];
      log("");
      logSection("Model " + (i + 1) + " of " + modelKeys.length + ": " + MODELS[key].label);

      const result = await run(key);
      allResults.push(result);

      // Brief pause between models
      if (i < modelKeys.length - 1) {
        log("Proceeding to next model in 2 seconds\u2026");
        await new Promise(function (resolve) { setTimeout(resolve, 2000); });
      }
    }

    // Print comparison table
    console.log("");
    compare(allResults);

    return allResults;
  }

  // ───────────────────────────────────────────────────────
  // Pre-flight check
  // ───────────────────────────────────────────────────────

  /**
   * Quick pre-flight check — loads the v4 module and checks whether each
   * model's required architecture class exists. No model downloads, no
   * inference, no image processing. Takes a few seconds at most.
   *
   * @returns {Promise<object>} { libraryLoaded, models: { fastvlm, moondream, qwen2vl } }
   */
  async function check() {
    logSection("VLM Pre-flight Check \u2014 Phase 12C-3");
    log("Loading Transformers.js v4 module (no model downloads)\u2026");

    let v4;
    const t0 = performance.now();

    try {
      v4 = await loadV4Module();
    } catch (err) {
      logError("Failed to load v4 module:", err);
      console.log("");
      console.log("  \u274C v4 module failed to load: " + err.message);
      console.log("  Cannot proceed with any model.");
      return { libraryLoaded: false, models: {} };
    }

    const loadTime = performance.now() - t0;
    log("v4 module loaded in " + formatNum(loadTime) + " ms");
    console.log("");

    // Check each model's required class
    const modelKeys = ["fastvlm", "moondream", "qwen2vl"];
    const checkResults = {};

    modelKeys.forEach(function (key) {
      const modelDef = MODELS[key];
      const requiredClass = modelDef.modelClass;
      const exists = typeof v4[requiredClass] === "function";

      checkResults[key] = {
        label: modelDef.label,
        requiredClass: requiredClass,
        classFound: exists,
      };

      // Additional dependency checks
      const deps = ["AutoProcessor"];
      if (modelDef.needsTokenizer) deps.push("AutoTokenizer");

      const missingDeps = deps.filter(function (dep) {
        return typeof v4[dep] !== "function";
      });

      checkResults[key].dependencies = deps;
      checkResults[key].missingDeps = missingDeps;
      checkResults[key].ready = exists && missingDeps.length === 0;
    });

    // Print results
    const labelWidth = 22;
    console.log("  " + pad("Model", labelWidth) + "\u2502 Class              \u2502 Status");
    console.log("  " + "\u2500".repeat(labelWidth) + "\u253C" + "\u2500".repeat(20) + "\u253C" + "\u2500".repeat(20));

    modelKeys.forEach(function (key) {
      const r = checkResults[key];
      const status = r.ready
        ? "\u2705 Ready to test"
        : r.classFound
          ? "\u26A0\uFE0F Missing deps: " + r.missingDeps.join(", ")
          : "\u274C Class not found";

      console.log(
        "  " + pad(r.label, labelWidth) + "\u2502 " +
        pad(r.requiredClass, 19) + "\u2502 " + status
      );
    });

    console.log("");

    // Also check for RawImage (needed by all models)
    const hasRawImage = typeof v4.RawImage === "function";
    console.log("  RawImage:        " + (hasRawImage ? "\u2705 Available" : "\u274C Not found"));

    // Check for WebGPU support
    const hasWebGPU = typeof navigator !== "undefined" && !!navigator.gpu;
    console.log("  WebGPU:          " + (hasWebGPU ? "\u2705 Available" : "\u26A0\uFE0F Not available (will use WASM fallback)"));

    // Check for uploaded image
    const hasImage = !!getUploadedImage();
    console.log("  Uploaded image:  " + (hasImage ? "\u2705 Found" : "\u2139\uFE0F None (will use synthetic test image)"));

    console.log("");

    // Summary
    const readyCount = modelKeys.filter(function (k) { return checkResults[k].ready; }).length;
    if (readyCount === 0) {
      log("No models are ready. The v4 build may not support these architectures yet.");
    } else if (readyCount === modelKeys.length) {
      log("All " + readyCount + " models ready. Run VLMComparisonSpike.runAll() to test all, or .run(\"fastvlm\") to start with the smallest.");
    } else {
      log(readyCount + " of " + modelKeys.length + " models ready.");
      const readyKeys = modelKeys.filter(function (k) { return checkResults[k].ready; });
      log("Ready: " + readyKeys.map(function (k) { return MODELS[k].label; }).join(", "));
      log("Run VLMComparisonSpike.run(\"" + readyKeys[0] + "\") to test the first ready model.");
    }

    return { libraryLoaded: true, loadTime: loadTime, models: checkResults };
  }

  // ───────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────
  return {
    check: check,
    run: run,
    runAll: runAll,
    compare: compare,
    MODELS: MODELS,
  };
})();
