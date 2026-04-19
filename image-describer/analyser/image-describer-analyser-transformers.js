/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER ANALYSER — TRANSFORMERS.JS GATEWAY (Phase 14A)
 * ═══════════════════════════════════════════════════════════════
 *
 * Manages Transformers.js library loading, pipeline caching,
 * and provides CLIP zero-shot image classification.
 *
 * The library is loaded dynamically via import() from jsdelivr
 * CDN. The reference stays in a closure — never on window.
 * Pipelines are cached by task:model key for reuse.
 *
 * CDN domains required:
 *   - cdn.jsdelivr.net    (Transformers.js library)
 *   - huggingface.co      (model weights)
 *
 * Public API:
 *   ensureLibrary()                  → Promise<module>
 *   isAvailable()                    → boolean
 *   destroy()                        → Promise<void>
 *   loadPipeline(task, modelId, opts) → Promise<pipeline>
 *   getPipelineStatus(task, modelId) → string
 *   classifyImage(imageSource, labels) → Promise<ClassificationResult>
 *   ensureFlorence(options)          → Promise<{model, processor, tokenizer}>
 *   getFlorenceStatus()              → string
 *   generateCaption(imageSource, task) → Promise<CaptionResult>
 *   detectObjects(imageSource)       → Promise<DetectionResult>
 *   extractOCR(imageSource)          → Promise<OCRResult>
 *   ensureFastVLM(options)           → Promise<{model, processor}>
 *   getFastVLMStatus()               → string
 *   generateLocalDescription(imageSource, options) → Promise<DescriptionResult>
 *   ensureQwen(options)              → Promise<{model, processor}>
 *   getQwenStatus()                  → string
 *   generateQwenDescription(imageSource, options) → Promise<DescriptionResult>
 *
 * VERSION: 6.1.0
 * DATE: 27 March 2026
 * PHASE: Phase 14A (Qwen3.5-0.8B gateway integration)
 * ═══════════════════════════════════════════════════════════════
 */

window.ImageDescriberAnalyserTransformers = (function () {
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

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[AnalyserTransformers]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AnalyserTransformers]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AnalyserTransformers]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AnalyserTransformers]", message, ...args);
  }

  // ───────────────────────────────────────────────────────
  // Constants
  // ───────────────────────────────────────────────────────
  const CDN_V3 =
    "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
  const CDN_V4 =
    "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.9";
  const DEFAULT_CLIP_MODEL = "Xenova/clip-vit-base-patch32";

  // Florence-2 constants
  const FLORENCE_MODEL_ID = "onnx-community/Florence-2-base-ft";

  // FastVLM constants
  const FASTVLM_MODEL_ID = "onnx-community/FastVLM-0.5B-ONNX";

  // Qwen3.5 constants (Phase 14A)
  const QWEN35_MODEL_ID = "onnx-community/Qwen3.5-0.8B-ONNX";
  const QWEN35_CLASS_NAME = "Qwen3_5ForConditionalGeneration";

  // LFM2-VL constants (Phase 15A)
  const LFM2VL_MODEL_ID = "onnx-community/LFM2-VL-450M-ONNX";

  const FLORENCE_TASKS = {
    CAPTION: "<CAPTION>",
    DETAILED_CAPTION: "<DETAILED_CAPTION>",
    MORE_DETAILED_CAPTION: "<MORE_DETAILED_CAPTION>",
    OBJECT_DETECTION: "<OD>",
    OCR_WITH_REGION: "<OCR_WITH_REGION>",
  };

  /**
   * Maps raw Transformers.js model IDs to the friendly library IDs used by the
   * controller's library-status UI elements (e.g. imgdesc-lib-clip).
   * Keeps loadPipeline() generic — add entries here for future models.
   */
  const MODEL_TO_LIBRARY = {
    "Xenova/clip-vit-base-patch32": "clip",
    "onnx-community/Florence-2-base-ft": "florence2",
    "onnx-community/depth-anything-v2-small": "depth",
  };

  const DEFAULT_DEPTH_MODEL = "onnx-community/depth-anything-v2-small";

  // ───────────────────────────────────────────────────────
  // Closure state — never exposed on window
  // ───────────────────────────────────────────────────────

  /** @type {object|null} Transformers.js v3 module — used for CLIP, Depth (automatic pipeline) */
  let v3Module = null;

  /** @type {boolean} Whether v3 library loaded successfully */
  let v3Available = false;

  /** @type {object|null} Transformers.js v4 module — used for Florence-2, SmolVLM2 (opt-in) */
  let v4Module = null;

  /** @type {boolean} Whether v4 library loaded successfully */
  let v4Available = false;

  /** @type {Map<string, object>} Cached pipelines keyed by "task:modelId" */
  const pipelineCache = new Map();

  /** @type {Map<string, string>} Pipeline status keyed by "task:modelId" */
  const pipelineStatusMap = new Map();

  // Florence-2 state — encoder-decoder model needs separate loading path
  /** @type {object|null} Florence2ForConditionalGeneration instance */
  let florenceModel = null;
  /** @type {object|null} AutoProcessor instance for Florence-2 */
  let florenceProcessor = null;
  /** @type {object|null} AutoTokenizer instance for Florence-2 */
  let florenceTokenizer = null;
  /** @type {string} Florence-2 loading state */
  let florenceStatus = "not-loaded"; // "not-loaded"|"loading"|"ready"|"error"

  // FastVLM state — two-component model (no separate tokenizer needed)
  /** @type {object|null} AutoModelForImageTextToText instance for FastVLM */
  let fastvlmModel = null;
  /** @type {object|null} AutoProcessor instance for FastVLM */
  let fastvlmProcessor = null;
  /** @type {string} FastVLM loading state */
  let fastvlmStatus = "not-loaded"; // "not-loaded"|"loading"|"ready"|"error"

  // Qwen3.5 state (Phase 14A)
  /** @type {object|null} Qwen3_5ForConditionalGeneration instance */
  let qwen35Model = null;
  /** @type {object|null} AutoProcessor instance for Qwen3.5 */
  let qwen35Processor = null;
  /** @type {string} Qwen3.5 loading state */
  let qwen35Status = "not-loaded"; // "not-loaded"|"loading"|"ready"|"error"

  // LFM2-VL state (Phase 15A)
  /** @type {object|null} AutoModelForImageTextToText instance for LFM2-VL */
  let lfm2vlModel = null;
  /** @type {object|null} AutoProcessor instance for LFM2-VL */
  let lfm2vlProcessor = null;
  /** @type {string} LFM2-VL loading state */
  let lfm2vlStatus = "not-loaded"; // "not-loaded"|"loading"|"ready"|"error"

  // ───────────────────────────────────────────────────────
  // Internal helpers
  // ───────────────────────────────────────────────────────

  /**
   * Build cache key for a pipeline.
   * @param {string} task
   * @param {string} modelId
   * @returns {string}
   */
  function pipelineKey(task, modelId) {
    return task + ":" + modelId;
  }

  /**
   * Emit a library:status event if EmbedEventEmitter is available.
   * Matches the pattern used by the OCR module (Phase 4B).
   * @param {string} library  — identifier, e.g. "transformers" or "clip-vit-b32"
   * @param {string} status   — "loading" | "ready" | "error"
   * @param {object} [extra]  — additional data to merge into the event
   */
  function emitStatus(library, status, extra) {
    if (window.EmbedEventEmitter) {
      const data = Object.assign({ library: library, status: status }, extra);
      window.EmbedEventEmitter.emit("library:status", data);
      logDebug("Emitted library:status —", library, status);
    }
  }

  // ───────────────────────────────────────────────────────
  // Library management
  // ───────────────────────────────────────────────────────

  /**
   * Dynamically imports Transformers.js from the CDN.
   * The module reference is kept in closure scope only.
   * Subsequent calls return the cached module immediately.
   *
   * @returns {Promise<object>} The Transformers.js module
   * @throws {Error} If CDN is unreachable or import fails
   */
  async function ensureLibrary() {
    if (v3Module) {
      logDebug("v3 library already loaded — returning cached module");
      return v3Module;
    }

    logInfo("Loading Transformers.js v3 from CDN…");
    emitStatus("transformers", "loading");

    try {
      v3Module = await import(CDN_V3);
      v3Available = true;

      logInfo("Transformers.js v3 loaded successfully");
      emitStatus("transformers", "ready");

      return v3Module;
    } catch (err) {
      v3Available = false;
      v3Module = null;

      logError("Failed to load Transformers.js v3:", err.message || err);
      emitStatus("transformers", "error", {
        message: err.message || "CDN unreachable",
      });

      throw err;
    }
  }

  /**
   * Dynamically imports Transformers.js v4 from the CDN.
   * Used for Florence-2 and SmolVLM2 (opt-in features only).
   * Lazy-loaded — not imported until the user requests an opt-in feature.
   *
   * @returns {Promise<object>} The Transformers.js v4 module
   * @throws {Error} If CDN is unreachable or import fails
   */
  async function ensureV4Library() {
    if (v4Module) {
      logDebug("v4 library already loaded — returning cached module");
      return v4Module;
    }

    logInfo("Loading Transformers.js v4 from CDN (for Florence-2 / SmolVLM2)…");
    emitStatus("transformers-v4", "loading");

    try {
      v4Module = await import(CDN_V4);
      v4Available = true;

      logInfo("Transformers.js v4 loaded successfully");
      emitStatus("transformers-v4", "ready");

      // Wire ResilientFetch for chunked downloads of large HF model files
      if (window.ResilientFetch) {
        v4Module.env.fetch = window.ResilientFetch.create();
        logInfo("ResilientFetch wired into Transformers.js v4 env.fetch");
      } else {
        logWarn("ResilientFetch not available — large model downloads may fail on unstable connections");
      }

      return v4Module;
    } catch (err) {
      v4Available = false;
      v4Module = null;

      logError("Failed to load Transformers.js v4:", err.message || err);
      emitStatus("transformers-v4", "error", {
        message: err.message || "CDN unreachable",
      });

      throw err;
    }
  }

  /**
   * Whether the Transformers.js library has been loaded successfully.
   * @returns {boolean}
   */
  function isAvailable() {
    return v3Available;
  }

  /**
   * Disposes all cached pipelines and releases the library reference.
   * After calling destroy(), isAvailable() returns false and
   * ensureLibrary() must be called again to reload.
   */
  async function destroy() {
    logInfo("Destroying gateway — releasing pipelines and library references");

    // Dispose each cached pipeline (v3) if it has a dispose method
    for (const [key, pipeline] of pipelineCache) {
      try {
        if (pipeline && typeof pipeline.dispose === "function") {
          await pipeline.dispose();
          logDebug("Disposed pipeline:", key);
        }
      } catch (err) {
        logWarn("Error disposing pipeline " + key + ":", err.message || err);
      }
    }

    pipelineCache.clear();
    pipelineStatusMap.clear();

    // Dispose Florence-2 model (v4) if loaded
    try {
      if (florenceModel && typeof florenceModel.dispose === "function") {
        await florenceModel.dispose();
        logDebug("Disposed Florence-2 model");
      }
    } catch (err) {
      logWarn("Error disposing Florence-2 model:", err.message || err);
    }
    florenceModel = null;
    florenceProcessor = null;
    florenceTokenizer = null;
    florenceStatus = "not-loaded";

    // Dispose FastVLM model (v4) if loaded
    try {
      if (fastvlmModel && typeof fastvlmModel.dispose === "function") {
        await fastvlmModel.dispose();
        logDebug("Disposed FastVLM model");
      }
    } catch (err) {
      logWarn("Error disposing FastVLM model:", err.message || err);
    }
    fastvlmModel = null;
    fastvlmProcessor = null;
    fastvlmStatus = "not-loaded";

    // Dispose Qwen3.5 model (v4) if loaded
    try {
      if (qwen35Model && typeof qwen35Model.dispose === "function") {
        await qwen35Model.dispose();
        logDebug("Disposed Qwen3.5 model");
      }
    } catch (err) {
      logWarn("Error disposing Qwen3.5 model:", err.message || err);
    }
    qwen35Model = null;
    qwen35Processor = null;
    qwen35Status = "not-loaded";

    // Dispose LFM2-VL model (v4) if loaded
    try {
      if (lfm2vlModel && typeof lfm2vlModel.dispose === "function") {
        await lfm2vlModel.dispose();
        logDebug("Disposed LFM2-VL model");
      }
    } catch (err) {
      logWarn("Error disposing LFM2-VL model:", err.message || err);
    }
    lfm2vlModel = null;
    lfm2vlProcessor = null;
    lfm2vlStatus = "not-loaded";

    // Release both module references
    v3Module = null;
    v3Available = false;
    v4Module = null;
    v4Available = false;

    logInfo("Gateway destroyed");
    emitStatus("transformers", "not-loaded");
    emitStatus("transformers-v4", "not-loaded");
    emitStatus("florence2", "not-loaded");
    emitStatus("fastvlm", "not-loaded");
    emitStatus("qwen35", "not-loaded");
    emitStatus("lfm2vl", "not-loaded");
  }

  // ───────────────────────────────────────────────────────
  // Pipeline management
  // ───────────────────────────────────────────────────────

  /**
   * Loads (or returns cached) a Transformers.js pipeline.
   *
   * @param {string} task    — pipeline task, e.g. "zero-shot-image-classification"
   * @param {string} modelId — model identifier, e.g. "Xenova/clip-vit-base-patch32"
   * @param {object} [pipelineOptions] — extra options forwarded to pipeline(),
   *   e.g. { dtype: "fp32" }. Omit to use Transformers.js defaults.
   * @returns {Promise<object>} The pipeline instance
   */
  async function loadPipeline(task, modelId, pipelineOptions) {
    const key = pipelineKey(task, modelId);

    // Return cached pipeline if available
    if (pipelineCache.has(key)) {
      logDebug("Returning cached pipeline:", key);
      return pipelineCache.get(key);
    }

    // Ensure v3 library is loaded first
    if (!v3Available) {
      await ensureLibrary();
    }

    logInfo(
      "Loading pipeline:",
      task,
      "with model:",
      modelId,
      pipelineOptions
        ? "(options: " + JSON.stringify(pipelineOptions) + ")"
        : "",
    );
    pipelineStatusMap.set(key, "loading");
    // Use a friendly library ID so the controller can find the right
    // status element (e.g. imgdesc-lib-clip rather than the raw model path).
    const libraryId = MODEL_TO_LIBRARY[modelId] || modelId;
    emitStatus(libraryId, "loading");

    try {
      const pipe = pipelineOptions
        ? await v3Module.pipeline(task, modelId, pipelineOptions)
        : await v3Module.pipeline(task, modelId);

      pipelineCache.set(key, pipe);
      pipelineStatusMap.set(key, "ready");

      logInfo("Pipeline ready:", key);
      emitStatus(libraryId, "ready");

      return pipe;
    } catch (err) {
      pipelineStatusMap.set(key, "error");

      logError("Failed to load pipeline " + key + ":", err.message || err);
      emitStatus(libraryId, "error", {
        message: err.message || "Pipeline load failed",
      });

      throw err;
    }
  }

  /**
   * Returns the current status of a pipeline.
   *
   * @param {string} task
   * @param {string} modelId
   * @returns {string} "not-loaded" | "loading" | "ready" | "error"
   */
  function getPipelineStatus(task, modelId) {
    const key = pipelineKey(task, modelId);
    return pipelineStatusMap.get(key) || "not-loaded";
  }

  // ───────────────────────────────────────────────────────
  // CLIP classification
  // ───────────────────────────────────────────────────────

  /**
   * Classifies an image against a set of candidate labels using
   * CLIP zero-shot image classification.
   *
   * @param {HTMLImageElement|HTMLCanvasElement|string} imageSource
   *   — an <img> element, a <canvas>, or an image URL
   * @param {string[]} labels
   *   — candidate labels to classify against
   * @returns {Promise<object>} Classification result:
   *   {
   *     topLabel: string,
   *     topConfidence: number,
   *     suggestedProfile: string,   // placeholder — "unknown" until 5B-2
   *     labels: [{ label, score }],
   *     status: string,
   *     duration: number
   *   }
   */
  async function classifyImage(imageSource, labels) {
    const t0 = performance.now();

    // Validate inputs
    if (!imageSource) {
      logError("classifyImage called without image source");
      return makeErrorResult("No image source provided", t0);
    }
    if (!Array.isArray(labels) || labels.length === 0) {
      logError("classifyImage called without labels");
      return makeErrorResult("No labels provided", t0);
    }

    // Check library availability
    if (!v3Available) {
      logWarn(
        "Library not available — attempting to load before classification",
      );
      try {
        await ensureLibrary();
      } catch (err) {
        return makeErrorResult(
          "Transformers.js library unavailable: " + (err.message || err),
          t0,
        );
      }
    }

    logInfo("Classifying image against", labels.length, "labels");

    try {
      // Load or retrieve cached CLIP pipeline
      const classifier = await loadPipeline(
        "zero-shot-image-classification",
        DEFAULT_CLIP_MODEL,
      );

      // Determine image input for the pipeline
      const imageInput = resolveImageInput(imageSource);

      // Run classification
      const output = await classifier(imageInput, labels);

      // Transformers.js returns array of { label, score } sorted by score descending
      const sortedLabels = Array.isArray(output)
        ? output
            .map(function (item) {
              return { label: item.label, score: item.score };
            })
            .sort(function (a, b) {
              return b.score - a.score;
            })
        : [];

      const duration = performance.now() - t0;
      const topItem = sortedLabels[0] || { label: "unknown", score: 0 };

      logInfo(
        "Classification complete in " +
          duration.toFixed(0) +
          "ms — top: " +
          topItem.label +
          " (" +
          (topItem.score * 100).toFixed(1) +
          "%)",
      );

      return {
        topLabel: topItem.label,
        topConfidence: topItem.score,
        suggestedProfile: "unknown", // Placeholder — label-to-profile mapping added in Phase 5B-2
        labels: sortedLabels,
        status: "success",
        duration: duration,
      };
    } catch (err) {
      logError("Classification failed:", err.message || err);
      return makeErrorResult(
        "Classification failed: " + (err.message || err),
        t0,
      );
    }
  }

  /**
   * Resolves the image source into a format suitable for the pipeline.
   * Transformers.js needs a fetchable URL or data URI. Blob URLs may
   * be revoked by the time classification runs, so HTMLImageElement
   * and HTMLCanvasElement are always converted to a data URL via canvas.
   *
   * @param {HTMLImageElement|HTMLCanvasElement|string} source
   * @returns {string} Image URL or data URL
   */
  function resolveImageInput(source) {
    if (typeof source === "string") {
      // Already a URL or data URI
      return source;
    }
    if (source instanceof HTMLCanvasElement) {
      logDebug("Converting canvas to data URL for pipeline input");
      return source.toDataURL("image/png");
    }
    if (source instanceof HTMLImageElement) {
      // Convert via canvas — the img.src may be a revoked blob URL,
      // but the element still holds the decoded pixel data
      logDebug("Converting <img> to data URL via canvas for pipeline input");
      const canvas = document.createElement("canvas");
      canvas.width = source.naturalWidth || source.width;
      canvas.height = source.naturalHeight || source.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(source, 0, 0);
      return canvas.toDataURL("image/png");
    }
    // Fallback — try to use as-is and let the pipeline handle it
    logWarn("Unrecognised image source type — passing through to pipeline");
    return source;
  }

  /**
   * Creates a standardised error result object.
   * @param {string} message
   * @param {number} t0 — performance.now() timestamp at start
   * @returns {object}
   */
  function makeErrorResult(message, t0) {
    return {
      topLabel: null,
      topConfidence: 0,
      suggestedProfile: null,
      labels: [],
      status: "error",
      duration: performance.now() - t0,
      error: message,
    };
  }

  // ───────────────────────────────────────────────────────
  // Florence-2 model management
  // ───────────────────────────────────────────────────────

  /**
   * Loads (or returns cached) the Florence-2 encoder-decoder model.
   * Florence-2 does NOT use the pipeline() API — it requires loading
   * three components separately: model, processor, and tokenizer.
   *
   * @param {object} [options] — optional overrides
   * @param {string} [options.dtype="fp32"] — data type for the model
   * @param {function} [options.progressCallback] — called during download
   * @returns {Promise<{model: object, processor: object, tokenizer: object}>}
   */
  async function ensureFlorence(options) {
    // Return cached components if already loaded
    if (florenceModel && florenceProcessor && florenceTokenizer) {
      logDebug("Florence-2 already loaded — returning cached components");
      return {
        model: florenceModel,
        processor: florenceProcessor,
        tokenizer: florenceTokenizer,
      };
    }

    // Ensure Transformers.js v4 is loaded (Florence-2 uses v4 for better performance)
    if (!v4Available) {
      await ensureV4Library();
    }

    var dtype = (options && options.dtype) || "fp32";
    var progressCallback = options && options.progressCallback;

    logInfo("Loading Florence-2 model, processor, and tokenizer…");
    florenceStatus = "loading";
    emitStatus("florence2", "loading");

    // Bridge ResilientFetch chunk progress into progressCallback
    // so the Model Manager progress bar advances during large downloads.
    var bridgeListener = null;
    if (progressCallback && window.ResilientFetch && typeof window.ResilientFetch.onProgress === "function") {
      bridgeListener = function (event) {
        if (event.url && event.url.indexOf(FLORENCE_MODEL_ID) !== -1) {
          logDebug("Florence progress bridge:", event.filename,
            Math.round((event.loaded / event.total) * 100) + "%");
          progressCallback({
            file: event.filename,
            status: "progress",
            loaded: event.loaded,
            total: event.total,
          });
        }
      };
      window.ResilientFetch.onProgress(bridgeListener);
      logDebug("Florence progress bridge registered");
    }

    try {
      // Verify required classes exist in Transformers.js v4 module
      if (
        typeof v4Module.Florence2ForConditionalGeneration !==
        "function"
      ) {
        throw new Error(
          "Florence2ForConditionalGeneration not found in Transformers.js v4 module",
        );
      }
      if (typeof v4Module.AutoProcessor !== "function") {
        throw new Error("AutoProcessor not found in Transformers.js v4");
      }
      if (typeof v4Module.AutoTokenizer !== "function") {
        throw new Error("AutoTokenizer not found in Transformers.js v4");
      }

      // Load all three components in parallel
      var modelOptions = { dtype: dtype };
      if (progressCallback) {
        modelOptions.progress_callback = progressCallback;
      }

      var results = await Promise.all([
        v4Module.Florence2ForConditionalGeneration.from_pretrained(
          FLORENCE_MODEL_ID,
          modelOptions,
        ),
        v4Module.AutoProcessor.from_pretrained(FLORENCE_MODEL_ID),
        v4Module.AutoTokenizer.from_pretrained(FLORENCE_MODEL_ID),
      ]);

      florenceModel = results[0];
      florenceProcessor = results[1];
      florenceTokenizer = results[2];
      florenceStatus = "ready";

      logInfo("Florence-2 loaded successfully");
      emitStatus("florence2", "ready");

      return {
        model: florenceModel,
        processor: florenceProcessor,
        tokenizer: florenceTokenizer,
      };
    } catch (err) {
      florenceStatus = "error";
      florenceModel = null;
      florenceProcessor = null;
      florenceTokenizer = null;

      logError("Failed to load Florence-2:", err.message || err);
      emitStatus("florence2", "error", {
        message: err.message || "Florence-2 load failed",
      });

      throw err;
    } finally {
      if (bridgeListener && window.ResilientFetch && typeof window.ResilientFetch.offProgress === "function") {
        window.ResilientFetch.offProgress(bridgeListener);
        logDebug("Florence progress bridge unregistered");
      }
    }
  }

  /**
   * Returns the current Florence-2 loading state.
   * @returns {string} "not-loaded"|"loading"|"ready"|"error"
   */
  function getFlorenceStatus() {
    return florenceStatus;
  }

  /**
   * Internal: runs a single Florence-2 inference task.
   * Shared by generateCaption, detectObjects, and extractOCR.
   *
   * @param {HTMLImageElement|HTMLCanvasElement|string} imageSource
   * @param {string} taskToken — e.g. "<OD>", "<DETAILED_CAPTION>"
   * @returns {Promise<object>} Raw post-processed output from Florence-2
   */
  async function runFlorenceTask(imageSource, taskToken) {
    // Ensure model is loaded
    var components = await ensureFlorence();

    // Resolve image to data URL, then to RawImage
    var imageUrl = resolveImageInput(imageSource);
    var rawImage = await v4Module.RawImage.read(imageUrl);

    logInfo("Running Florence-2 task:", taskToken);

    // Build inputs
    var prompts = components.processor.construct_prompts(taskToken);
    var visionInputs = await components.processor(rawImage);
    var textInputs = components.tokenizer(prompts);

    // Generate
    var generatedIds = await components.model.generate(
      Object.assign({}, textInputs, visionInputs, {
        max_new_tokens: 256,
        num_beams: 1,
        do_sample: false,
      }),
    );

    // Decode
    var generatedText = components.tokenizer.batch_decode(generatedIds, {
      skip_special_tokens: false,
    })[0];

    // Post-process to structured output
    var postProcessed = components.processor.post_process_generation(
      generatedText,
      taskToken,
      rawImage.size,
    );

    return postProcessed;
  }

  /**
   * Creates a standardised Florence-2 error result object.
   * Returns an error result (not thrown) per Phase 10A spec.
   * @param {string} message
   * @param {number} t0
   * @returns {object}
   */
  function makeFlorenceErrorResult(message, t0) {
    return {
      status: "error",
      duration: performance.now() - t0,
      error: message,
    };
  }

  // ───────────────────────────────────────────────────────
  // Florence-2 gateway methods
  // ───────────────────────────────────────────────────────

  /**
   * Generates a caption for an image using Florence-2.
   *
   * @param {HTMLImageElement|HTMLCanvasElement|string} imageSource
   * @param {string} [task="<MORE_DETAILED_CAPTION>"] — caption task token:
   *   "<CAPTION>" | "<DETAILED_CAPTION>" | "<MORE_DETAILED_CAPTION>"
   * @returns {Promise<object>} Result:
   *   { text: string, task: string, status: "complete", duration: number }
   *   or { status: "error", duration: number, error: string }
   */
  async function generateCaption(imageSource, task) {
    var t0 = performance.now();
    var taskToken = task || FLORENCE_TASKS.MORE_DETAILED_CAPTION;

    // Validate task token
    var validCaptionTasks = [
      FLORENCE_TASKS.CAPTION,
      FLORENCE_TASKS.DETAILED_CAPTION,
      FLORENCE_TASKS.MORE_DETAILED_CAPTION,
    ];
    if (validCaptionTasks.indexOf(taskToken) === -1) {
      logError("generateCaption: invalid task token:", taskToken);
      return makeFlorenceErrorResult(
        "Invalid caption task: " +
          taskToken +
          ". Use <CAPTION>, <DETAILED_CAPTION>, or <MORE_DETAILED_CAPTION>.",
        t0,
      );
    }

    if (!imageSource) {
      return makeFlorenceErrorResult("No image source provided", t0);
    }

    try {
      var output = await runFlorenceTask(imageSource, taskToken);

      // Caption output format: { '<TASK>': 'caption text' }
      var captionText = (output && output[taskToken]) || "";
      var duration = performance.now() - t0;

      logInfo(
        "Caption complete in " +
          duration.toFixed(0) +
          "ms (" +
          captionText.length +
          " chars)",
      );

      return {
        text: captionText,
        task: taskToken,
        status: "complete",
        duration: duration,
      };
    } catch (err) {
      logError("generateCaption failed:", err.message || err);
      return makeFlorenceErrorResult(
        "Caption generation failed: " + (err.message || err),
        t0,
      );
    }
  }

  /**
   * Detects objects in an image using Florence-2.
   *
   * @param {HTMLImageElement|HTMLCanvasElement|string} imageSource
   * @returns {Promise<object>} Result:
   *   { items: [{ label: string, bounds: {x1,y1,x2,y2}, confidence: null }],
   *     status: "complete", duration: number }
   *   or { status: "error", duration: number, error: string }
   */
  async function detectObjects(imageSource) {
    var t0 = performance.now();

    if (!imageSource) {
      return makeFlorenceErrorResult("No image source provided", t0);
    }

    try {
      var output = await runFlorenceTask(
        imageSource,
        FLORENCE_TASKS.OBJECT_DETECTION,
      );

      // OD output format: { '<OD>': { bboxes: [[x1,y1,x2,y2], ...], labels: [...] } }
      var odData = (output && output[FLORENCE_TASKS.OBJECT_DETECTION]) || {};
      var bboxes = odData.bboxes || [];
      var labels = odData.labels || [];

      // Normalise into items array
      var items = [];
      for (var i = 0; i < bboxes.length; i++) {
        var bbox = bboxes[i];
        items.push({
          label: labels[i] || "unknown",
          bounds: {
            x1: bbox[0],
            y1: bbox[1],
            x2: bbox[2],
            y2: bbox[3],
          },
          // Florence-2 OD does not provide per-object confidence scores
          confidence: null,
        });
      }

      var duration = performance.now() - t0;

      logInfo(
        "Object detection complete in " +
          duration.toFixed(0) +
          "ms — " +
          items.length +
          " objects found",
      );

      return {
        items: items,
        status: "complete",
        duration: duration,
      };
    } catch (err) {
      logError("detectObjects failed:", err.message || err);
      return makeFlorenceErrorResult(
        "Object detection failed: " + (err.message || err),
        t0,
      );
    }
  }

  /**
   * Extracts text regions with positional data using Florence-2 OCR.
   *
   * @param {HTMLImageElement|HTMLCanvasElement|string} imageSource
   * @returns {Promise<object>} Result:
   *   { items: [{ text: string, quadBox: [x1,y1,x2,y2,x3,y3,x4,y4] }],
   *     status: "complete", duration: number }
   *   or { status: "error", duration: number, error: string }
   */
  async function extractOCR(imageSource) {
    var t0 = performance.now();

    if (!imageSource) {
      return makeFlorenceErrorResult("No image source provided", t0);
    }

    try {
      var output = await runFlorenceTask(
        imageSource,
        FLORENCE_TASKS.OCR_WITH_REGION,
      );

      // OCR output format: { '<OCR_WITH_REGION>': { quad_boxes: [[8 coords], ...], labels: [...] } }
      var ocrData = (output && output[FLORENCE_TASKS.OCR_WITH_REGION]) || {};
      var quadBoxes = ocrData.quad_boxes || [];
      var labels = ocrData.labels || [];

      // Normalise into items array
      var items = [];
      for (var i = 0; i < quadBoxes.length; i++) {
        items.push({
          text: labels[i] || "",
          quadBox: quadBoxes[i], // [x1,y1,x2,y2,x3,y3,x4,y4] — 4 corners
        });
      }

      var duration = performance.now() - t0;

      logInfo(
        "OCR extraction complete in " +
          duration.toFixed(0) +
          "ms — " +
          items.length +
          " text regions found",
      );

      return {
        items: items,
        status: "complete",
        duration: duration,
      };
    } catch (err) {
      logError("extractOCR failed:", err.message || err);
      return makeFlorenceErrorResult(
        "OCR extraction failed: " + (err.message || err),
        t0,
      );
    }
  }

  // ───────────────────────────────────────────────────────
  // FastVLM model management (Phase 13A)
  // ───────────────────────────────────────────────────────

  /**
   * Loads (or returns cached) the FastVLM 0.5B model.
   * FastVLM uses two components: model and processor (no separate tokenizer).
   * Uses WebGPU with quantised weights for fast inference.
   *
   * @param {object} [options] — optional overrides
   * @param {function} [options.progressCallback] — called during download
   * @returns {Promise<{model: object, processor: object}>}
   */
  async function ensureFastVLM(options) {
    // Return cached components if already loaded
    if (fastvlmModel && fastvlmProcessor) {
      logDebug("FastVLM already loaded — returning cached components");
      return {
        model: fastvlmModel,
        processor: fastvlmProcessor,
      };
    }

    // Ensure Transformers.js v4 is loaded
    if (!v4Available) {
      await ensureV4Library();
    }

    var progressCallback = options && options.progressCallback;

    logInfo("Loading FastVLM model and processor…");
    fastvlmStatus = "loading";
    emitStatus("fastvlm", "loading");

    // Bridge ResilientFetch chunk progress into progressCallback
    // so the Model Manager progress bar advances during large downloads.
    var bridgeListener = null;
    if (progressCallback && window.ResilientFetch && typeof window.ResilientFetch.onProgress === "function") {
      bridgeListener = function (event) {
        if (event.url && event.url.indexOf(FASTVLM_MODEL_ID) !== -1) {
          logDebug("FastVLM progress bridge:", event.filename,
            Math.round((event.loaded / event.total) * 100) + "%");
          progressCallback({
            file: event.filename,
            status: "progress",
            loaded: event.loaded,
            total: event.total,
          });
        }
      };
      window.ResilientFetch.onProgress(bridgeListener);
      logDebug("FastVLM progress bridge registered");
    }

    try {
      // Verify required classes exist in Transformers.js v4 module
      if (typeof v4Module.AutoModelForImageTextToText !== "function") {
        throw new Error(
          "AutoModelForImageTextToText not found in Transformers.js v4 module",
        );
      }
      if (typeof v4Module.AutoProcessor !== "function") {
        throw new Error("AutoProcessor not found in Transformers.js v4");
      }

      // Load both components in parallel
      var modelOptions = {
        dtype: {
          embed_tokens: "fp16",
          vision_encoder: "q4",
          decoder_model_merged: "q4",
        },
        device: "webgpu",
      };
      if (progressCallback) {
        modelOptions.progress_callback = progressCallback;
      }

      var results = await Promise.all([
        v4Module.AutoModelForImageTextToText.from_pretrained(
          FASTVLM_MODEL_ID,
          modelOptions,
        ),
        v4Module.AutoProcessor.from_pretrained(FASTVLM_MODEL_ID),
      ]);

      fastvlmModel = results[0];
      fastvlmProcessor = results[1];
      fastvlmStatus = "ready";

      logInfo("FastVLM loaded successfully");
      emitStatus("fastvlm", "ready");

      return {
        model: fastvlmModel,
        processor: fastvlmProcessor,
      };
    } catch (err) {
      fastvlmStatus = "error";
      fastvlmModel = null;
      fastvlmProcessor = null;

      logError("Failed to load FastVLM:", err.message || err);
      emitStatus("fastvlm", "error", {
        message: err.message || "FastVLM load failed",
      });

      throw err;
    } finally {
      if (bridgeListener && window.ResilientFetch && typeof window.ResilientFetch.offProgress === "function") {
        window.ResilientFetch.offProgress(bridgeListener);
        logDebug("FastVLM progress bridge unregistered");
      }
    }
  }

  /**
   * Returns the current FastVLM loading state.
   * @returns {string} "not-loaded"|"loading"|"ready"|"error"
   */
  function getFastVLMStatus() {
    return fastvlmStatus;
  }

  /**
   * Generates an image description using FastVLM 0.5B locally.
   * Uses WebGPU for fast inference (~6s after model load).
   *
   * @param {HTMLImageElement|HTMLCanvasElement|string} imageSource
   *   — an <img> element, a <canvas>, or an image URL / data URI
   * @param {object} [options]
   * @param {string} [options.prompt="Describe this image in detail for accessibility purposes."]
   *   — custom prompt text
   * @param {number} [options.maxTokens=512] — max new tokens to generate
   * @param {function} [options.onChunk] — callback for streaming tokens (optional)
   * @param {function} [options.progressCallback] — forwarded to ensureFastVLM
   * @returns {Promise<object>} Result:
   *   { text: string, status: "success", duration: number, model: string }
   */
  async function generateLocalDescription(imageSource, options) {
    var opts = options || {};
    var promptText =
      opts.prompt ||
      "Describe this image in detail for accessibility purposes.";
    var maxTokens = opts.maxTokens || 512;
    var t0 = performance.now();

    if (!imageSource) {
      logError("generateLocalDescription called without image source");
      return {
        text: "",
        status: "error",
        duration: performance.now() - t0,
        model: FASTVLM_MODEL_ID,
        error: "No image source provided",
      };
    }

    try {
      // 1. Ensure model is loaded
      var components = await ensureFastVLM(opts);

      // 2. Read image — resolve to data URL then to RawImage
      var imageUrl = resolveImageInput(imageSource);
      var image = await v4Module.RawImage.read(imageUrl);

      // 3. Build chat messages — FastVLM format
      //    IMPORTANT: content is a SINGLE STRING with <image> token, NOT an array
      var messages = [
        {
          role: "user",
          content: "<image>" + promptText,
        },
      ];

      // 4. Apply chat template
      var prompt = components.processor.apply_chat_template(messages, {
        add_generation_prompt: true,
      });

      // 5. Process inputs — image FIRST, then prompt (FastVLM-specific order)
      var inputs = await components.processor(image, prompt, {
        add_special_tokens: false,
      });

      // 6. Generate
      var generateOptions = Object.assign({}, inputs, {
        max_new_tokens: maxTokens,
        do_sample: false,
      });

      // If streaming callback provided, add TextStreamer
      if (opts.onChunk && typeof v4Module.TextStreamer === "function") {
        generateOptions.streamer = new v4Module.TextStreamer(
          components.processor.tokenizer,
          {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: opts.onChunk,
          },
        );
      }

      var outputs = await components.model.generate(generateOptions);

      // 7. Decode — slice off prompt tokens
      var decoded = components.processor.batch_decode(
        outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
        { skip_special_tokens: true },
      );

      var description = (decoded[0] || "").trim();
      var duration = performance.now() - t0;

      logInfo(
        "FastVLM description generated in " +
          duration.toFixed(0) +
          "ms (" +
          description.length +
          " chars)",
      );

      return {
        text: description,
        status: "success",
        duration: duration,
        model: FASTVLM_MODEL_ID,
      };
    } catch (err) {
      logError("generateLocalDescription failed:", err.message || err);
      return {
        text: "",
        status: "error",
        duration: performance.now() - t0,
        model: FASTVLM_MODEL_ID,
        error: "Local description failed: " + (err.message || err),
      };
    }
  }

  // ───────────────────────────────────────────────────────
  // Qwen3.5-0.8B model management (Phase 14A)
  // ───────────────────────────────────────────────────────

  /**
   * Loads (or returns cached) the Qwen3.5-0.8B model.
   * Qwen3.5 uses two components: model and processor (no separate tokeniser).
   * Uses WebGPU with quantised weights for inference.
   *
   * Key difference from FastVLM: uses the named class
   * Qwen3_5ForConditionalGeneration rather than AutoModelForImageTextToText,
   * and embed_tokens uses q4 (not fp16).
   *
   * @param {object} [options] — optional overrides
   * @param {function} [options.progressCallback] — called during download
   * @returns {Promise<{model: object, processor: object}>}
   */
  async function ensureQwen(options) {
    // Return cached components if already loaded
    if (qwen35Model && qwen35Processor) {
      logDebug("Qwen3.5 already loaded — returning cached components");
      return {
        model: qwen35Model,
        processor: qwen35Processor,
      };
    }

    // Ensure Transformers.js v4 is loaded
    if (!v4Available) {
      await ensureV4Library();
    }

    var progressCallback = options && options.progressCallback;

    logInfo("Loading Qwen3.5 model and processor…");
    qwen35Status = "loading";
    emitStatus("qwen35", "loading");

    // Bridge ResilientFetch chunk progress into progressCallback
    // so the Model Manager progress bar advances during large downloads.
    var bridgeListener = null;
    if (progressCallback && window.ResilientFetch && typeof window.ResilientFetch.onProgress === "function") {
      bridgeListener = function (event) {
        if (event.url && event.url.indexOf(QWEN35_MODEL_ID) !== -1) {
          logDebug("Qwen3.5 progress bridge:", event.filename,
            Math.round((event.loaded / event.total) * 100) + "%");
          progressCallback({
            file: event.filename,
            status: "progress",
            loaded: event.loaded,
            total: event.total,
          });
        }
      };
      window.ResilientFetch.onProgress(bridgeListener);
      logDebug("Qwen3.5 progress bridge registered");
    }

    try {
      // Verify required classes exist in Transformers.js v4 module
      if (typeof v4Module[QWEN35_CLASS_NAME] !== "function") {
        throw new Error(
          QWEN35_CLASS_NAME + " not found in Transformers.js v4 module",
        );
      }
      if (typeof v4Module.AutoProcessor !== "function") {
        throw new Error("AutoProcessor not found in Transformers.js v4");
      }

      // Load both components in parallel
      var modelOptions = {
        dtype: {
          embed_tokens: "q4",
          vision_encoder: "fp16",
          decoder_model_merged: "q4",
        },
        device: "webgpu",
      };
      if (progressCallback) {
        modelOptions.progress_callback = progressCallback;
      }

      var results = await Promise.all([
        v4Module[QWEN35_CLASS_NAME].from_pretrained(
          QWEN35_MODEL_ID,
          modelOptions,
        ),
        v4Module.AutoProcessor.from_pretrained(QWEN35_MODEL_ID),
      ]);

      qwen35Model = results[0];
      qwen35Processor = results[1];
      qwen35Status = "ready";

      logInfo("Qwen3.5 loaded successfully");
      emitStatus("qwen35", "ready");

      return {
        model: qwen35Model,
        processor: qwen35Processor,
      };
    } catch (err) {
      qwen35Status = "error";
      qwen35Model = null;
      qwen35Processor = null;

      logError("Failed to load Qwen3.5:", err.message || err);
      emitStatus("qwen35", "error", {
        message: err.message || "Qwen3.5 load failed",
      });

      throw err;
    } finally {
      if (bridgeListener && window.ResilientFetch && typeof window.ResilientFetch.offProgress === "function") {
        window.ResilientFetch.offProgress(bridgeListener);
        logDebug("Qwen3.5 progress bridge unregistered");
      }
    }
  }

  /**
   * Returns the current Qwen3.5 loading state.
   * @returns {string} "not-loaded"|"loading"|"ready"|"error"
   */
  function getQwenStatus() {
    return qwen35Status;
  }

  /**
   * Generates an image description using Qwen3.5-0.8B locally.
   * Uses WebGPU for inference (~45–66s after model load).
   *
   * Key differences from FastVLM generateLocalDescription():
   *   - Conversation array message format (not single string with <image> token)
   *   - Processor call: text FIRST, then image (opposite of FastVLM)
   *   - Image resized to 448×448 before processing
   *   - Tokeniser accessed via processor.tokenizer (not processor.batch_decode)
   *   - Default prompt: structured 4-part accessibility instruction
   *
   * @param {HTMLImageElement|HTMLCanvasElement|string} imageSource
   *   — an <img> element, a <canvas>, or an image URL / data URI
   * @param {object} [options]
   * @param {string} [options.prompt] — custom prompt text (defaults to structured 4-part instruction)
   * @param {number} [options.maxTokens=512] — max new tokens to generate
   * @param {function} [options.onChunk] — callback for streaming tokens (optional)
   * @param {function} [options.progressCallback] — forwarded to ensureQwen
   * @returns {Promise<object>} Result:
   *   { text: string, status: "success"|"error", duration: number, model: string }
   */
  async function generateQwenDescription(imageSource, options) {
    var opts = options || {};
    var defaultPrompt =
      "Describe this image for accessibility using these sections:\n\n" +
      "## 1. Title\nA brief descriptive title under 10 words.\n\n" +
      "## 2. Alt Text\nOne or two sentences: what the image shows, then its educational significance.\n\n" +
      "## 3. Long Description\nDetailed description of the visual content and its educational purpose.\n\n" +
      "## 4. Text Content\n" +
      'List every word, number, and label visible in the image. If none, write "No text content."';
    var promptText = opts.prompt || defaultPrompt;
    var maxTokens = opts.maxTokens || 512;
    var t0 = performance.now();

    if (!imageSource) {
      logError("generateQwenDescription called without image source");
      return {
        text: "",
        status: "error",
        duration: performance.now() - t0,
        model: QWEN35_MODEL_ID,
        error: "No image source provided",
      };
    }

    try {
      // 1. Ensure model is loaded
      var components = await ensureQwen(opts);

      // 2. Read image — resolve to data URL, then to RawImage, then resize to 448×448
      var imageUrl = resolveImageInput(imageSource);
      var image = await v4Module.RawImage.read(imageUrl);
      image = await image.resize(448, 448);

      // 3. Build chat messages — Qwen conversation array format
      var messages = [
        {
          role: "user",
          content: [
            { type: "image" },
            { type: "text", text: promptText },
          ],
        },
      ];

      // 4. Apply chat template — text FIRST
      var text = components.processor.apply_chat_template(messages, {
        add_generation_prompt: true,
      });

      // 5. Process inputs — text first, then image (opposite of FastVLM)
      var inputs = await components.processor(text, image);

      // 6. Generate
      var generateOptions = Object.assign({}, inputs, {
        max_new_tokens: maxTokens,
        do_sample: false,
      });

      // If streaming callback provided, add TextStreamer
      if (opts.onChunk && typeof v4Module.TextStreamer === "function") {
        generateOptions.streamer = new v4Module.TextStreamer(
          components.processor.tokenizer,
          {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: opts.onChunk,
          },
        );
      }

      var outputs = await components.model.generate(generateOptions);

      // 7. Decode — slice off prompt tokens
      var decoded = components.processor.tokenizer.batch_decode(
        outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
        { skip_special_tokens: true },
      );

      var description = (decoded[0] || "").trim();
      var duration = performance.now() - t0;

      logInfo(
        "Qwen3.5 description generated in " +
          duration.toFixed(0) +
          "ms (" +
          description.length +
          " chars)",
      );

      return {
        text: description,
        status: "success",
        duration: duration,
        model: QWEN35_MODEL_ID,
      };
    } catch (err) {
      logError("generateQwenDescription failed:", err.message || err);
      return {
        text: "",
        status: "error",
        duration: performance.now() - t0,
        model: QWEN35_MODEL_ID,
        error: "Qwen3.5 description failed: " + (err.message || err),
      };
    }
  }

  // ───────────────────────────────────────────────────────
  // Depth estimation (Phase 11A)
  // ───────────────────────────────────────────────────────

  /**
   * Quadrant names for depth zone spatial analysis.
   * @type {string[]}
   */
  const DEPTH_QUADRANT_NAMES = [
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
    "centre",
  ];

  /**
   * Estimates depth zones in an image using Depth Anything V2 Small.
   * Returns foreground/midground/background zone breakdown with
   * area percentages and dominant quadrant positions.
   *
   * Convention: 0 = closest (foreground), 1 = farthest (background).
   *
   * @param {HTMLImageElement|HTMLCanvasElement|string} imageSource
   * @returns {Promise<object>} Depth estimation result
   */
  async function estimateDepth(imageSource) {
    var t0 = performance.now();

    if (!imageSource) {
      logError("estimateDepth called without image source");
      return makeDepthErrorResult("No image source provided", t0);
    }

    // Check library availability
    if (!v3Available) {
      logWarn(
        "Library not available — attempting to load before depth estimation",
      );
      try {
        await ensureLibrary();
      } catch (err) {
        return makeDepthErrorResult(
          "Transformers.js library unavailable: " + (err.message || err),
          t0,
        );
      }
    }

    logInfo("Running depth estimation with Depth Anything V2 Small");

    try {
      // Load or retrieve cached depth pipeline
      var depthPipeline = await loadPipeline(
        "depth-estimation",
        DEFAULT_DEPTH_MODEL,
      );

      // Resolve image input to a URL/data URI
      var imageInput = resolveImageInput(imageSource);

      // Run depth estimation
      var pipelineResult = await depthPipeline(imageInput);

      // Extract depth data — check result.depth first, then result.predicted_depth
      var depthData = null;
      var depthWidth = 0;
      var depthHeight = 0;

      if (pipelineResult && pipelineResult.depth) {
        // RawImage with .data, .width, .height
        depthData = pipelineResult.depth.data;
        depthWidth = pipelineResult.depth.width;
        depthHeight = pipelineResult.depth.height;
      } else if (pipelineResult && pipelineResult.predicted_depth) {
        depthData = pipelineResult.predicted_depth.data;
        depthWidth = pipelineResult.predicted_depth.width;
        depthHeight = pipelineResult.predicted_depth.height;
      }

      if (!depthData || depthData.length === 0) {
        return makeDepthErrorResult("No depth data returned from pipeline", t0);
      }

      // Handle both [height, width] tensor and flattened array
      var totalPixels = depthWidth * depthHeight;
      if (depthData.length !== totalPixels && depthData.length > 0) {
        // Try to infer dimensions from array length if width*height doesn't match
        logWarn(
          "Depth data length (" +
            depthData.length +
            ") differs from " +
            depthWidth +
            "×" +
            depthHeight +
            " (" +
            totalPixels +
            "). Using data length.",
        );
        totalPixels = depthData.length;
      }

      // Find min and max for normalisation
      var rawMin = Infinity;
      var rawMax = -Infinity;
      for (var i = 0; i < depthData.length; i++) {
        var val = depthData[i];
        if (val < rawMin) rawMin = val;
        if (val > rawMax) rawMax = val;
      }

      var range = rawMax - rawMin;
      if (range === 0) {
        // Flat image — no depth variation
        var duration = performance.now() - t0;
        logInfo(
          "Depth estimation complete in " +
            duration.toFixed(0) +
            "ms — flat image (no depth variation)",
        );
        return {
          status: "success",
          duration: duration,
          rawDepthMap: {
            width: depthWidth,
            height: depthHeight,
            data: depthData,
          },
          zones: {
            foreground: {
              minDepth: 0,
              maxDepth: 0.33,
              areaPercent: 100,
              dominantQuadrants: DEPTH_QUADRANT_NAMES.slice(),
            },
            midground: {
              minDepth: 0.33,
              maxDepth: 0.66,
              areaPercent: 0,
              dominantQuadrants: [],
            },
            background: {
              minDepth: 0.66,
              maxDepth: 1.0,
              areaPercent: 0,
              dominantQuadrants: [],
            },
          },
          depthRange: { min: rawMin, max: rawMax },
          hasSignificantDepth: false,
        };
      }

      // Depth Anything V2 convention: lower values = closer.
      // Some models output the opposite — detect and invert if needed.
      // Heuristic: if pixels near image bottom (typically foreground in photos)
      // have higher raw values than top pixels, the model uses inverted convention.
      // We keep: 0 = closest, 1 = farthest.
      var bottomRowStart = (depthHeight - 1) * depthWidth;
      var bottomSum = 0;
      var topSum = 0;
      var sampleCount = Math.min(depthWidth, 50);
      var step = Math.max(1, Math.floor(depthWidth / sampleCount));
      for (var s = 0; s < depthWidth; s += step) {
        bottomSum += depthData[bottomRowStart + s];
        topSum += depthData[s];
      }
      var invertDepth = bottomSum / sampleCount > topSum / sampleCount;

      // Normalise to 0–1 and count zone pixels + quadrant distribution
      var zoneCounts = { foreground: 0, midground: 0, background: 0 };
      // Quadrant pixel counts per zone: { foreground: { 'top-left': n, ... }, ... }
      var zoneQuadrantCounts = {
        foreground: {},
        midground: {},
        background: {},
      };
      DEPTH_QUADRANT_NAMES.forEach(function (q) {
        zoneQuadrantCounts.foreground[q] = 0;
        zoneQuadrantCounts.midground[q] = 0;
        zoneQuadrantCounts.background[q] = 0;
      });

      // Quadrant boundaries
      var halfW = depthWidth / 2;
      var halfH = depthHeight / 2;
      var centreX0 = depthWidth / 3;
      var centreX1 = (depthWidth * 2) / 3;
      var centreY0 = depthHeight / 3;
      var centreY1 = (depthHeight * 2) / 3;

      for (var pi = 0; pi < depthData.length; pi++) {
        var normalised = (depthData[pi] - rawMin) / range;
        if (invertDepth) normalised = 1.0 - normalised;

        // Determine zone
        var zone;
        if (normalised < 0.33) {
          zone = "foreground";
        } else if (normalised < 0.66) {
          zone = "midground";
        } else {
          zone = "background";
        }
        zoneCounts[zone]++;

        // Determine quadrant for this pixel
        var px = pi % depthWidth;
        var py = Math.floor(pi / depthWidth);

        // Check centre first (overlaps with corner quadrants)
        if (
          px >= centreX0 &&
          px < centreX1 &&
          py >= centreY0 &&
          py < centreY1
        ) {
          zoneQuadrantCounts[zone]["centre"]++;
        }
        // Also count corner quadrant (a pixel can be in centre AND a corner)
        if (py < halfH) {
          if (px < halfW) {
            zoneQuadrantCounts[zone]["top-left"]++;
          } else {
            zoneQuadrantCounts[zone]["top-right"]++;
          }
        } else {
          if (px < halfW) {
            zoneQuadrantCounts[zone]["bottom-left"]++;
          } else {
            zoneQuadrantCounts[zone]["bottom-right"]++;
          }
        }
      }

      // Build zone results
      var effectiveTotal = depthData.length || 1;
      var zones = {};
      var zoneNames = ["foreground", "midground", "background"];
      var zoneBounds = [
        { minDepth: 0, maxDepth: 0.33 },
        { minDepth: 0.33, maxDepth: 0.66 },
        { minDepth: 0.66, maxDepth: 1.0 },
      ];

      var maxZonePercent = 0;

      for (var zi = 0; zi < zoneNames.length; zi++) {
        var zName = zoneNames[zi];
        var areaPct = parseFloat(
          ((zoneCounts[zName] / effectiveTotal) * 100).toFixed(1),
        );
        if (areaPct > maxZonePercent) maxZonePercent = areaPct;

        // Find dominant quadrants (>20% of this zone's pixels)
        var dominant = [];
        var zoneTotal = zoneCounts[zName] || 1;
        DEPTH_QUADRANT_NAMES.forEach(function (q) {
          if (zoneQuadrantCounts[zName][q] / zoneTotal > 0.2) {
            dominant.push(q);
          }
        });

        zones[zName] = {
          minDepth: zoneBounds[zi].minDepth,
          maxDepth: zoneBounds[zi].maxDepth,
          areaPercent: areaPct,
          dominantQuadrants: dominant,
        };
      }

      var hasSignificantDepth = maxZonePercent <= 85;

      var duration = performance.now() - t0;
      logInfo(
        "Depth estimation complete in " +
          duration.toFixed(0) +
          "ms — fg:" +
          zones.foreground.areaPercent +
          "% mg:" +
          zones.midground.areaPercent +
          "% bg:" +
          zones.background.areaPercent +
          "% significant:" +
          hasSignificantDepth,
      );

      return {
        status: "success",
        duration: duration,
        rawDepthMap: {
          width: depthWidth,
          height: depthHeight,
          data: depthData,
        },
        zones: zones,
        depthRange: { min: rawMin, max: rawMax },
        hasSignificantDepth: hasSignificantDepth,
        invertDepth: invertDepth,
      };
    } catch (err) {
      logError("Depth estimation failed:", err.message || err);
      return makeDepthErrorResult(
        "Depth estimation failed: " + (err.message || err),
        t0,
      );
    }
  }

  /**
   * Creates a standardised depth error result object.
   * @param {string} message
   * @param {number} t0 — performance.now() timestamp at start
   * @returns {object}
   */
  function makeDepthErrorResult(message, t0) {
    return {
      status: "error",
      duration: performance.now() - t0,
      error: message,
      zones: null,
      rawDepthMap: null,
      depthRange: null,
      hasSignificantDepth: false,
    };
  }

  // ───────────────────────────────────────────────────────
  // LFM2-VL (Phase 15A)
  // ───────────────────────────────────────────────────────

  /**
   * Load and cache the LFM2-VL 450M model and processor.
   * Uses AutoModelForImageTextToText (same class as FastVLM).
   * @param {object} [options]
   * @param {function} [options.progressCallback] — Transformers.js progress events
   * @returns {Promise<{model: object, processor: object}>}
   */
  async function ensureLfm2Vl(options) {
    // Return cached components if already loaded
    if (lfm2vlModel && lfm2vlProcessor) {
      logDebug("LFM2-VL already loaded — returning cached components");
      return {
        model: lfm2vlModel,
        processor: lfm2vlProcessor,
      };
    }

    // Ensure Transformers.js v4 is loaded
    if (!v4Available) {
      await ensureV4Library();
    }

    var progressCallback = options && options.progressCallback;

    logInfo("Loading LFM2-VL model and processor…");
    lfm2vlStatus = "loading";
    emitStatus("lfm2vl", "loading");

    // Bridge ResilientFetch chunk progress into progressCallback
    // so the Model Manager progress bar advances during large downloads.
    var bridgeListener = null;
    if (progressCallback && window.ResilientFetch && typeof window.ResilientFetch.onProgress === "function") {
      bridgeListener = function (event) {
        if (event.url && event.url.indexOf("LFM2-VL") !== -1) {
          logDebug("LFM2-VL progress bridge:", event.filename,
            Math.round((event.loaded / event.total) * 100) + "%");
          progressCallback({
            file: event.filename,
            status: "progress",
            loaded: event.loaded,
            total: event.total,
          });
        }
      };
      window.ResilientFetch.onProgress(bridgeListener);
      logDebug("LFM2-VL progress bridge registered");
    }

    try {
      // Verify required classes exist in Transformers.js v4 module
      if (typeof v4Module.AutoModelForImageTextToText !== "function") {
        throw new Error(
          "AutoModelForImageTextToText not found in Transformers.js v4 module",
        );
      }
      if (typeof v4Module.AutoProcessor !== "function") {
        throw new Error("AutoProcessor not found in Transformers.js v4");
      }

      // Load both components in parallel
      // NOTE: LFM2-VL uses a flat dtype config (NOT per-component like FastVLM)
      var modelOptions = {
        dtype: "q4",
        device: "webgpu",
      };
      if (progressCallback) {
        modelOptions.progress_callback = progressCallback;
      }

      var results = await Promise.all([
        v4Module.AutoModelForImageTextToText.from_pretrained(
          LFM2VL_MODEL_ID,
          modelOptions,
        ),
        v4Module.AutoProcessor.from_pretrained(LFM2VL_MODEL_ID),
      ]);

      lfm2vlModel = results[0];
      lfm2vlProcessor = results[1];
      lfm2vlStatus = "ready";

      logInfo("LFM2-VL loaded successfully");
      emitStatus("lfm2vl", "ready");

      return {
        model: lfm2vlModel,
        processor: lfm2vlProcessor,
      };
    } catch (err) {
      lfm2vlStatus = "error";
      lfm2vlModel = null;
      lfm2vlProcessor = null;

      logError("Failed to load LFM2-VL:", err.message || err);
      emitStatus("lfm2vl", "error", {
        message: err.message || "LFM2-VL load failed",
      });

      throw err;
    } finally {
      if (bridgeListener && window.ResilientFetch && typeof window.ResilientFetch.offProgress === "function") {
        window.ResilientFetch.offProgress(bridgeListener);
        logDebug("LFM2-VL progress bridge unregistered");
      }
    }
  }

  /**
   * Returns the current LFM2-VL loading state.
   * @returns {string} "not-loaded"|"loading"|"ready"|"error"
   */
  function getLfm2VlStatus() {
    return lfm2vlStatus;
  }

  /**
   * Generate an image description using LFM2-VL 450M.
   * Uses the same message format and processor calling convention as FastVLM:
   * single-string "<image>" prompt, image-first processor call, batch_decode.
   *
   * @param {HTMLImageElement|string} imageSource — preview <img> or data URL
   * @param {object} [options]
   * @param {string} [options.prompt] — override the default instruction
   * @param {number} [options.maxTokens=512]
   * @param {function} [options.onChunk] — streaming callback (per token)
   * @returns {Promise<{text: string, status: string, duration: number, model: string}>}
   */
  async function generateLfm2VlDescription(imageSource, options) {
    var opts = options || {};
    var promptText =
      opts.prompt ||
      "Describe this image in detail for accessibility purposes.";
    var maxTokens = opts.maxTokens || 512;
    var t0 = performance.now();

    if (!imageSource) {
      logError("generateLfm2VlDescription called without image source");
      return {
        text: "",
        status: "error",
        duration: performance.now() - t0,
        model: LFM2VL_MODEL_ID,
        error: "No image source provided",
      };
    }

    try {
      // 1. Ensure model is loaded
      var components = await ensureLfm2Vl(opts);

      // 2. Read image — resolve to data URL then to RawImage
      var imageUrl = resolveImageInput(imageSource);
      var image = await v4Module.RawImage.read(imageUrl);

      // 3. Build chat messages — FastVLM-style format
      // IMPORTANT: content is a SINGLE STRING with <image> token, NOT an array
      var messages = [
        {
          role: "user",
          content: "<image>" + promptText,
        },
      ];

      // 4. Apply chat template
      var prompt = components.processor.apply_chat_template(messages, {
        add_generation_prompt: true,
      });

      // 5. Process inputs — image FIRST, then prompt (same as FastVLM)
      var inputs = await components.processor(image, prompt, {
        add_special_tokens: false,
      });

      // 6. Generate
      var generateOptions = Object.assign({}, inputs, {
        max_new_tokens: maxTokens,
        do_sample: false,
      });

      // If streaming callback provided, add TextStreamer
      if (opts.onChunk && typeof v4Module.TextStreamer === "function") {
        generateOptions.streamer = new v4Module.TextStreamer(
          components.processor.tokenizer,
          {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: opts.onChunk,
          },
        );
      }

      var outputs = await components.model.generate(generateOptions);

      // 7. Decode — slice off prompt tokens
      var decoded = components.processor.batch_decode(
        outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
        { skip_special_tokens: true },
      );

      var description = (decoded[0] || "").trim();
      var duration = performance.now() - t0;

      logInfo(
        "LFM2-VL description generated in " +
          duration.toFixed(0) +
          "ms (" +
          description.length +
          " chars)",
      );

      return {
        text: description,
        status: "success",
        duration: duration,
        model: LFM2VL_MODEL_ID,
      };
    } catch (err) {
      logError("generateLfm2VlDescription failed:", err.message || err);
      return {
        text: "",
        status: "error",
        duration: performance.now() - t0,
        model: LFM2VL_MODEL_ID,
        error: "Local description failed: " + (err.message || err),
      };
    }
  }

  // ───────────────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────────────

  logDebug("Module loaded (gateway only — library not yet imported)");

  return {
    // Library management
    ensureLibrary: ensureLibrary,
    ensureV4Library: ensureV4Library,
    isAvailable: isAvailable,
    destroy: destroy,

    // Pipeline management (CLIP etc.)
    loadPipeline: loadPipeline,
    getPipelineStatus: getPipelineStatus,

    // CLIP classification
    classifyImage: classifyImage,

    // Florence-2 (Phase 10A)
    ensureFlorence: ensureFlorence,
    getFlorenceStatus: getFlorenceStatus,
    generateCaption: generateCaption,
    detectObjects: detectObjects,
    extractOCR: extractOCR,

    // Depth estimation (Phase 11A)
    estimateDepth: estimateDepth,

    // FastVLM (Phase 13A)
    ensureFastVLM: ensureFastVLM,
    getFastVLMStatus: getFastVLMStatus,
    generateLocalDescription: generateLocalDescription,

    // Qwen3.5 (Phase 14A)
    ensureQwen: ensureQwen,
    getQwenStatus: getQwenStatus,
    generateQwenDescription: generateQwenDescription,

    // LFM2-VL (Phase 15A)
    ensureLfm2Vl: ensureLfm2Vl,
    getLfm2VlStatus: getLfm2VlStatus,
    generateLfm2VlDescription: generateLfm2VlDescription,

    // Constants (exposed for tests and consumers)
    FLORENCE_MODEL_ID: FLORENCE_MODEL_ID,
    FLORENCE_TASKS: FLORENCE_TASKS,
    DEFAULT_DEPTH_MODEL: DEFAULT_DEPTH_MODEL,
    FASTVLM_MODEL_ID: FASTVLM_MODEL_ID,
    QWEN35_MODEL_ID: QWEN35_MODEL_ID,
    LFM2VL_MODEL_ID: LFM2VL_MODEL_ID,
  };
})();
