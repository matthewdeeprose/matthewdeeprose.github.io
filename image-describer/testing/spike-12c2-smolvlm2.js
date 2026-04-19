/**
 * Phase 12C-2: SmolVLM2 Validation Spike
 *
 * Throwaway test — validates SmolVLM2 works in Transformers.js v4
 * before committing to integration.
 *
 * Prerequisites:
 *   - SmolVLM2 models will be downloaded on first run (~229MB for q4)
 *   - Ensure stable internet connection for first download
 *   - Close other tabs to free memory
 *
 * Usage:
 *   SmolVLM2Spike.run()           // Run with uploaded preview image
 *   SmolVLM2Spike.run(dataUrl)    // Run with a specific image data URL
 *   SmolVLM2Spike.run(null, { model: "256m" })  // Use 256M fallback
 *   SmolVLM2Spike.run(null, { viaGateway: true }) // Load v4 via gateway
 */
window.SmolVLM2Spike = (function () {
  "use strict";

  // ───────────────────────────────────────────────────────
  // Constants
  // ───────────────────────────────────────────────────────
  const CDN_V4 =
    "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.9";

  const MODELS = {
    "500m": {
      id: "HuggingFaceTB/SmolVLM2-500M-Video-Instruct",
      label: "SmolVLM2 500M (primary)",
    },
    "256m": {
      id: "HuggingFaceTB/SmolVLM-256M-Instruct",
      label: "SmolVLM v1 256M (fallback)",
    },
  };

  const DTYPE_CONFIG = {
    embed_tokens: "fp32",
    vision_encoder: "q4",
    decoder_model_merged: "q4",
  };

  const TEST_PROMPT =
    "Describe this image in detail for accessibility purposes. Include the main subject, layout, colours, and any text visible in the image.";

  // ───────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────
  const hr = () => "═".repeat(60);
  const dash = () => "─".repeat(40);

  function log(msg) {
    console.log("[SmolVLM2Spike]", msg);
  }

  function logSection(title) {
    console.log("\n" + hr());
    console.log("  " + title);
    console.log(hr());
  }

  /**
   * Get the uploaded preview image, or use a provided data URL.
   * @param {string|null} dataUrl - Optional image data URL
   * @returns {string} Image source URL/data URL
   */
  function getImageSource(dataUrl) {
    if (dataUrl) return dataUrl;

    // Try to find the uploaded preview image
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
   * Create a simple test image on canvas if no image is available.
   * @returns {string} Data URL of the test image
   */
  function createTestImage() {
    log("Creating synthetic test image (no uploaded image found)");
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, 320, 240);

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
   * Load v4 module — either directly from CDN or via the gateway.
   * @param {boolean} viaGateway - If true, use the gateway's ensureV4Library()
   * @returns {Promise<object>} The Transformers.js v4 module
   */
  async function loadV4Module(viaGateway) {
    if (viaGateway) {
      log("Loading v4 via gateway (ensureV4Library)…");
      if (typeof window.ImageDescriberAnalyserTransformers === "undefined") {
        throw new Error(
          "Gateway not available — ImageDescriberAnalyserTransformers is undefined. " +
            "Make sure Image Describer is loaded."
        );
      }
      return await window.ImageDescriberAnalyserTransformers.ensureV4Library();
    }

    log("Loading v4 directly from CDN: " + CDN_V4);
    return await import(CDN_V4);
  }

  /**
   * Discover which auto-model classes are available.
   * @param {object} mod - The Transformers.js module
   * @returns {string[]} Available AutoModel class names
   */
  function discoverAutoModels(mod) {
    const autoModels = Object.keys(mod).filter(function (k) {
      return k.startsWith("AutoModel");
    });
    log("Available auto-model classes: " + autoModels.join(", "));
    return autoModels;
  }

  // ───────────────────────────────────────────────────────
  // Main spike
  // ───────────────────────────────────────────────────────

  /**
   * Run the SmolVLM2 validation spike.
   * @param {string|null} [imageDataUrl] - Optional image to use
   * @param {object} [options]
   * @param {string} [options.model] - "500m" (default) or "256m"
   * @param {boolean} [options.viaGateway] - Load v4 via gateway (default false)
   * @param {number} [options.maxTokens] - Max new tokens (default 256)
   */
  async function run(imageDataUrl, options) {
    const opts = options || {};
    const modelKey = opts.model || "500m";
    const viaGateway = opts.viaGateway || false;
    const maxTokens = opts.maxTokens || 256;
    const modelInfo = MODELS[modelKey];

    if (!modelInfo) {
      console.error(
        "[SmolVLM2Spike] Unknown model key: " +
          modelKey +
          ". Use '500m' or '256m'."
      );
      return;
    }

    logSection("SmolVLM2 Validation Spike — Phase 12C-2");
    log("Model: " + modelInfo.label + " (" + modelInfo.id + ")");
    log("Quantisation: q4 (embed_tokens fp32)");
    log("Max tokens: " + maxTokens);
    log("Load method: " + (viaGateway ? "gateway" : "direct CDN"));

    const timings = {};
    let v4 = null;
    let processor = null;
    let model = null;

    // ── Step 1: Get image ──────────────────────────────────
    const imgSrc = getImageSource(imageDataUrl) || createTestImage();
    const isSynthetic = !getImageSource(imageDataUrl);
    log(
      "Image source: " +
        (isSynthetic ? "synthetic test image" : imgSrc.substring(0, 80) + "…")
    );

    // ── Step 2: Load v4 module ─────────────────────────────
    logSection("Step 1 — Load Transformers.js v4");
    const t0 = performance.now();

    try {
      v4 = await loadV4Module(viaGateway);
      timings.libraryLoad = performance.now() - t0;
      log("v4 module loaded in " + timings.libraryLoad.toFixed(0) + " ms");
    } catch (err) {
      console.error("[SmolVLM2Spike] Failed to load v4 module:", err);
      return;
    }

    // Discover available classes
    const autoModels = discoverAutoModels(v4);

    // Check for RawImage
    if (typeof v4.RawImage !== "function") {
      console.error("[SmolVLM2Spike] RawImage not found in v4 module.");
      return;
    }

    // ── Step 2b: Diagnose available architecture classes ───
    // The Auto classes delegate to a named class from config.json.
    // SmolVLM2 needs SmolVLM2ForConditionalGeneration (or similar).
    // Let's check what's actually in the module.
    const smolClasses = Object.keys(v4).filter(function (k) {
      return /smol|vlm/i.test(k);
    });
    log("SmolVLM/VLM-related classes: " + (smolClasses.length ? smolClasses.join(", ") : "NONE FOUND"));

    // Also check for Idefics (SmolVLM2 may be based on Idefics3 architecture)
    const ideficsClasses = Object.keys(v4).filter(function (k) {
      return /idefics/i.test(k);
    });
    log("Idefics-related classes: " + (ideficsClasses.length ? ideficsClasses.join(", ") : "NONE FOUND"));

    // Check for all *ForConditionalGeneration and *ForVision2Seq classes
    const generationClasses = Object.keys(v4).filter(function (k) {
      return /ForConditionalGeneration|ForVision2Seq|ForImageTextToText/i.test(k) && !k.startsWith("Auto");
    });
    log("All generation/vision model classes: " + generationClasses.join(", "));

    // Determine which model class to use — try multiple approaches
    let ModelClass = null;
    let modelClassName = "";

    // Priority 1: Direct named class for SmolVLM2
    if (typeof v4.SmolVLM2ForConditionalGeneration === "function") {
      ModelClass = v4.SmolVLM2ForConditionalGeneration;
      modelClassName = "SmolVLM2ForConditionalGeneration";
    } else if (typeof v4.SmolVLMForConditionalGeneration === "function") {
      ModelClass = v4.SmolVLMForConditionalGeneration;
      modelClassName = "SmolVLMForConditionalGeneration";
    }
    // Priority 2: Auto classes (these delegate to the named class internally)
    else if (typeof v4.AutoModelForImageTextToText === "function") {
      ModelClass = v4.AutoModelForImageTextToText;
      modelClassName = "AutoModelForImageTextToText";
    } else if (typeof v4.AutoModelForVision2Seq === "function") {
      ModelClass = v4.AutoModelForVision2Seq;
      modelClassName = "AutoModelForVision2Seq";
    } else {
      console.error(
        "[SmolVLM2Spike] No suitable model class found.",
        "Available auto-models:", autoModels,
        "SmolVLM classes:", smolClasses
      );
      return;
    }
    log("Using model class: " + modelClassName);

    // Check for AutoProcessor
    if (typeof v4.AutoProcessor !== "function") {
      console.error("[SmolVLM2Spike] AutoProcessor not found in v4 module.");
      return;
    }

    // ── Step 3: Load model + processor ─────────────────────
    logSection("Step 2 — Load model and processor");
    log(
      "This will download ~229MB on first run. Subsequent runs use browser cache."
    );

    // First, fetch config.json to see what architecture the model expects
    const configUrl = "https://huggingface.co/" + modelInfo.id + "/resolve/main/config.json";
    try {
      log("Fetching config.json to check model architecture…");
      const resp = await fetch(configUrl);
      if (resp.ok) {
        const config = await resp.json();
        const archList = config.architectures || [];
        const modelType = config.model_type || "unknown";
        log("config.json model_type: " + modelType);
        log("config.json architectures: " + archList.join(", "));

        // Check if the required architecture class exists in v4
        archList.forEach(function (arch) {
          const exists = typeof v4[arch] === "function";
          log("  " + arch + " in v4 module: " + (exists ? "YES" : "NO — this is why from_pretrained fails"));
          if (!exists) {
            // Try to find close matches
            const close = Object.keys(v4).filter(function (k) {
              return k.toLowerCase().includes(modelType.toLowerCase().replace(/-/g, ""));
            });
            if (close.length) {
              log("  Close matches for model_type '" + modelType + "': " + close.join(", "));
            }
          }
        });

        // If architecture not found, try using a direct named class or skip to fallback
        if (archList.length && typeof v4[archList[0]] !== "function") {
          log("");
          log("WARNING: The model requires " + archList[0] + " but it is not in this Transformers.js build.");
          log("This means v4.0.0-next.9 does not yet support SmolVLM2 architecture.");
          log("");
          log("Possible actions:");
          log("  1. Try the 256M v1 model: SmolVLM2Spike.run(null, { model: '256m' })");
          log("  2. Check if a newer v4 prerelease has SmolVLM2 support");
          log("  3. Check Transformers.js GitHub for SmolVLM2 PRs/issues");

          // Still attempt to load — the error message may be more informative
          log("");
          log("Attempting load anyway to capture the exact error…");
        }
      }
    } catch (cfgErr) {
      log("Could not fetch config.json: " + cfgErr.message + " — proceeding anyway");
    }

    const t1 = performance.now();

    // Try each model class in sequence until one works
    const classesToTry = [];

    // If we picked a direct named class, try it first
    if (!modelClassName.startsWith("Auto")) {
      classesToTry.push({ cls: ModelClass, name: modelClassName });
    }
    // Then try auto classes
    if (typeof v4.AutoModelForImageTextToText === "function") {
      classesToTry.push({ cls: v4.AutoModelForImageTextToText, name: "AutoModelForImageTextToText" });
    }
    if (typeof v4.AutoModelForVision2Seq === "function") {
      classesToTry.push({ cls: v4.AutoModelForVision2Seq, name: "AutoModelForVision2Seq" });
    }
    // Deduplicate
    const seen = new Set();
    const uniqueClasses = classesToTry.filter(function (item) {
      if (seen.has(item.name)) return false;
      seen.add(item.name);
      return true;
    });

    let loadError = null;
    for (let i = 0; i < uniqueClasses.length; i++) {
      const attempt = uniqueClasses[i];
      log("Attempt " + (i + 1) + "/" + uniqueClasses.length + ": " + attempt.name + ".from_pretrained('" + modelInfo.id + "')");

      try {
        // Load processor + model
        const processorPromise = v4.AutoProcessor.from_pretrained(modelInfo.id);
        const modelPromise = attempt.cls.from_pretrained(modelInfo.id, {
          dtype: DTYPE_CONFIG,
          progress_callback: function (progress) {
            if (progress && progress.progress !== undefined) {
              const pct = progress.progress.toFixed(1);
              const file = progress.file || "";
              const rounded = Math.round(progress.progress / 25) * 25;
              if (
                Math.abs(progress.progress - rounded) < 1 ||
                progress.progress > 99
              ) {
                log("  Download: " + pct + "% — " + file);
              }
            }
          },
        });

        const results = await Promise.all([processorPromise, modelPromise]);
        processor = results[0];
        model = results[1];
        modelClassName = attempt.name;
        loadError = null;

        timings.modelLoad = performance.now() - t1;
        log("Model + processor loaded in " + timings.modelLoad.toFixed(0) + " ms (via " + attempt.name + ")");
        break; // success
      } catch (err) {
        loadError = err;
        log("  FAILED with " + attempt.name + ": " + err.message);
      }
    }

    if (loadError) {
      console.error("[SmolVLM2Spike] All model class attempts failed.");
      console.error("Last error:", loadError);
      console.error("Full stack:", loadError.stack || loadError);
      logSection("DIAGNOSIS");
      log("SmolVLM2 architecture is not supported in Transformers.js v4.0.0-next.9.");
      log("The model's config.json specifies an architecture class that this build doesn't include.");
      log("");
      log("Next steps:");
      log("  1. Try the 256M v1 model: SmolVLM2Spike.run(null, { model: '256m' })");
      log("  2. Check https://github.com/huggingface/transformers.js for newer prereleases");
      log("  3. Search for SmolVLM2 support in Transformers.js issues/PRs");
      return;
    }

    // ── Step 4: Read image ─────────────────────────────────
    logSection("Step 3 — Read image");
    let image;
    try {
      image = await v4.RawImage.read(imgSrc);
      log(
        "Image loaded: " +
          image.width +
          " × " +
          image.height +
          " (" +
          image.channels +
          " channels)"
      );
    } catch (err) {
      console.error("[SmolVLM2Spike] Failed to read image:", err);
      return;
    }

    // ── Step 5: Run inference ──────────────────────────────
    logSection("Step 4 — Run inference");

    // Build chat messages
    const messages = [
      {
        role: "user",
        content: [
          { type: "image" },
          { type: "text", text: TEST_PROMPT },
        ],
      },
    ];

    let decoded = "";
    const t2 = performance.now();

    try {
      // Try to apply chat template
      let textInput;

      // Check if processor has apply_chat_template
      if (typeof processor.apply_chat_template === "function") {
        log("Using processor.apply_chat_template");
        textInput = processor.apply_chat_template(messages, {
          tokenize: false,
          add_generation_prompt: true,
        });
      } else if (processor.tokenizer && typeof processor.tokenizer.apply_chat_template === "function") {
        log("Using processor.tokenizer.apply_chat_template");
        textInput = processor.tokenizer.apply_chat_template(messages, {
          tokenize: false,
          add_generation_prompt: true,
        });
      } else if (v4.AutoTokenizer) {
        // Load tokenizer separately
        log("Loading separate tokenizer via AutoTokenizer…");
        const tokenizer = await v4.AutoTokenizer.from_pretrained(modelInfo.id);
        textInput = tokenizer.apply_chat_template(messages, {
          tokenize: false,
          add_generation_prompt: true,
        });
      } else {
        // Fallback: build a simple prompt
        log("WARNING: No chat template method found. Using raw prompt fallback.");
        textInput = "User: " + TEST_PROMPT + "\nAssistant:";
      }

      log("Text input (first 200 chars): " + String(textInput).substring(0, 200));

      // Process inputs (text + image)
      log("Processing inputs…");
      let inputs;
      try {
        // SmolVLM2 expects image as array in processor call
        inputs = await processor(textInput, [image]);
      } catch (procErr) {
        log("Processor call with [image] array failed: " + procErr.message);
        log("Trying processor(textInput, image) without array…");
        try {
          inputs = await processor(textInput, image);
        } catch (procErr2) {
          log("Processor call with single image also failed: " + procErr2.message);
          log("Trying processor({ text: textInput, images: [image] })…");
          inputs = await processor({ text: textInput, images: [image] });
        }
      }

      log("Inputs prepared. Keys: " + Object.keys(inputs));

      // Generate
      log("Generating (max " + maxTokens + " tokens)…");
      const output = await model.generate({
        ...inputs,
        max_new_tokens: maxTokens,
        do_sample: false,
      });

      timings.inference = performance.now() - t2;

      // Decode output
      log("Decoding output…");
      if (typeof processor.batch_decode === "function") {
        decoded = processor.batch_decode(output, {
          skip_special_tokens: true,
        });
      } else if (processor.tokenizer && typeof processor.tokenizer.batch_decode === "function") {
        decoded = processor.tokenizer.batch_decode(output, {
          skip_special_tokens: true,
        });
      } else if (v4.AutoTokenizer) {
        const tokenizer = await v4.AutoTokenizer.from_pretrained(modelInfo.id);
        decoded = tokenizer.batch_decode(output, {
          skip_special_tokens: true,
        });
      } else {
        decoded = "[Could not decode — no batch_decode method found]";
      }

      // decoded may be an array
      if (Array.isArray(decoded)) {
        decoded = decoded.join("\n");
      }
    } catch (err) {
      timings.inference = performance.now() - t2;
      console.error("[SmolVLM2Spike] Inference failed:", err);
      console.error("Full error:", err.stack || err);

      // Still print partial results
      logSection("RESULTS (PARTIAL — inference failed)");
      log("Library load: " + timings.libraryLoad.toFixed(0) + " ms");
      log("Model load: " + timings.modelLoad.toFixed(0) + " ms");
      log("Inference failed after: " + timings.inference.toFixed(0) + " ms");
      log("Error: " + err.message);
      return;
    }

    // ── Step 6: Report ─────────────────────────────────────
    logSection("RESULTS — SmolVLM2 Spike");

    console.log("  Model:           " + modelInfo.id);
    console.log("  Model class:     " + modelClassName);
    console.log("  Quantisation:    q4 (embed_tokens fp32)");
    console.log("  Load method:     " + (viaGateway ? "gateway" : "direct CDN"));
    console.log("  Image:           " + (isSynthetic ? "synthetic" : "uploaded"));
    console.log("");
    console.log("  Library load:    " + timings.libraryLoad.toFixed(0) + " ms");
    console.log("  Model load:      " + timings.modelLoad.toFixed(0) + " ms");
    console.log("  Inference:       " + timings.inference.toFixed(0) + " ms");
    console.log("  Total:           " + (timings.libraryLoad + timings.modelLoad + timings.inference).toFixed(0) + " ms");
    console.log("");
    console.log("  Generated description:");
    console.log("  " + dash());
    // Split long output for readability
    const lines = decoded.match(/.{1,70}/g) || [decoded];
    lines.forEach(function (line) {
      console.log("  " + line);
    });
    console.log("  " + dash());
    console.log("");
    console.log("  Quality checklist (assess manually):");
    console.log("  [ ] Mentions main subject?");
    console.log("  [ ] Mentions colours?");
    console.log("  [ ] Mentions layout/spatial info?");
    console.log("  [ ] Mentions text if present?");
    console.log("  [ ] Hallucinations?");
    console.log("  [ ] Garbage output (fake_token_around_image loops)?");
    console.log("");

    // Check for known garbage output pattern
    if (
      decoded.includes("fake_token_around_image") ||
      decoded.includes("<image>".repeat(3))
    ) {
      console.warn(
        "[SmolVLM2Spike] WARNING: Detected garbage output pattern. " +
          "This is a known ONNX weights issue — try the 256M fallback:\n" +
          "  SmolVLM2Spike.run(null, { model: '256m' })"
      );
    }

    // Return results object for programmatic use
    return {
      model: modelInfo.id,
      modelClass: modelClassName,
      timings: timings,
      output: decoded,
      isSynthetic: isSynthetic,
      isGarbage:
        decoded.includes("fake_token_around_image") ||
        decoded.includes("<image>".repeat(3)),
    };
  }

  // ───────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────
  return {
    run: run,
    MODELS: MODELS,
  };
})();
