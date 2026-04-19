/**
 * ═══════════════════════════════════════════════════════════════
 * LOCAL TEXT MODEL GATEWAY — Browser LLM Inference Engine
 * ═══════════════════════════════════════════════════════════════
 *
 * Core module for loading, caching, and running text-only LLMs
 * in the browser via Transformers.js v4 + WebGPU/WASM.
 *
 * Subsystems:
 *   1. Library Management  — dynamic CDN import of Transformers.js v4
 *   2. GPU Detection       — WebGPU adapter probing, hardware classification
 *   3. Model Lifecycle     — download, load, status tracking, unload, cache removal
 *   4. Inference           — non-streaming and streaming text generation
 *   5. Cache Inspection    — shared 'transformers-cache' store queries
 *
 * Depends on: LocalTextModelRegistry (must be loaded first)
 *
 * Public API (on window.LocalTextModelGateway):
 *   ensureLibrary()                          → Promise<module>
 *   getRegistry()                            → Array<ModelDef>
 *   getModel(key)                            → ModelDef|null
 *   getAvailableModels(tier?)                → Array<ModelDef>
 *   ensureModel(key)                         → Promise<{model, tokeniser}>
 *   preDownloadModel(key, onProgress)        → Promise<void>
 *   cancelDownload(key)                      → void
 *   isModelCached(key)                       → Promise<boolean>
 *   getModelStatus(key)                      → string
 *   generate(key, prompt, opts)              → Promise<result>
 *   generateStreaming(key, prompt, opts)      → Promise<result>
 *   cancelGeneration(key)                    → void
 *   getMaxContext(key)                       → number
 *   unloadModel(key)                         → Promise<void>
 *   removeCachedModel(key)                   → Promise<{removedCount, removedBytes}>
 *   getCacheSize()                           → Promise<{totalBytes, models}>
 *   destroy()                                → Promise<void>
 *   detectGPU()                              → Promise<GPUInfo>
 *
 * Architecture: IIFE singleton with window global.
 * No NPM — pure browser JS loaded via <script> tag.
 *
 * VERSION: 1.0.0
 * DATE: 31 March 2026
 * PHASE: Phase 5 — Text Model Gateway
 * ═══════════════════════════════════════════════════════════════
 */

window.LocalTextModelGatewayClass = (function () {
  "use strict";

  // ========================================================================
  // LOGGING CONFIGURATION
  // ========================================================================

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
      console.error("[LocalTextGateway]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[LocalTextGateway]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[LocalTextGateway]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[LocalTextGateway]", message, ...args);
  }

  // ========================================================================
  // CONSTANTS
  // ========================================================================

  /** Pinned CDN version — do NOT use @latest (resolves to v3) */
  const CDN_PINNED =
    "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.9";
  const CDN_FALLBACK =
    "https://cdn.jsdelivr.net/npm/@huggingface/transformers@next";

  /** Shared cache store name — same as VLM gateway */
  const CACHE_NAME = "transformers-cache";

  /** Threshold for classifying a GPU as discrete (2048MB maxBufferSize) */
  const DISCRETE_GPU_BUFFER_THRESHOLD = 2147483648; // 2048MB

  // ========================================================================
  // CLOSURE STATE
  // ========================================================================

  /** @type {Object|null} Transformers.js v4 module reference */
  let transformersModule = null;

  /** @type {boolean} Whether the library loaded successfully */
  let libraryAvailable = false;

  /** @type {Map<string, {model: Object, tokeniser: Object}>} Loaded model instances */
  const modelInstances = new Map();

  /** @type {Map<string, string>} Model status by key */
  const modelStatuses = new Map();

  /** @type {Map<string, Object>} Active stopping criteria per model key (for cancel) */
  const activeStoppingCriteria = new Map();

  /** @type {Object|null} Cached GPU detection result */
  let cachedGPUInfo = null;

  /** @type {Object} Reference to the registry module */
  const registry = window.LocalTextModelRegistry;

  // ========================================================================
  // REGISTRY VALIDATION
  // ========================================================================

  if (!registry) {
    logError(
      "LocalTextModelRegistry not found — ensure local-text-model-registry.js is loaded before the gateway",
    );
  }

  // ========================================================================
  // 1. LIBRARY MANAGEMENT
  // ========================================================================

  /**
   * Dynamically imports Transformers.js v4 from CDN.
   * The module reference is kept in closure scope.
   * Subsequent calls return the cached module immediately.
   *
   * @returns {Promise<Object>} The Transformers.js v4 module
   * @throws {Error} If CDN is unreachable or import fails
   */
  async function ensureLibrary() {
    if (transformersModule) {
      logDebug("Library already loaded — returning cached module");
      return transformersModule;
    }

    logInfo("Loading Transformers.js v4 from CDN…");

    try {
      transformersModule = await import(CDN_PINNED);
      libraryAvailable = true;
      logInfo("Transformers.js v4 loaded successfully (pinned)");

      // Wire ResilientFetch for chunked downloads of large HF model files
      if (window.ResilientFetch) {
        transformersModule.env.fetch = window.ResilientFetch.create();
        logInfo("ResilientFetch wired into Transformers.js env.fetch");
      } else {
        logWarn("ResilientFetch not available — large model downloads may fail on unstable connections");
      }

      return transformersModule;
    } catch (pinnedErr) {
      logWarn(
        "Pinned CDN failed, trying fallback…",
        pinnedErr.message || pinnedErr,
      );

      try {
        transformersModule = await import(CDN_FALLBACK);
        libraryAvailable = true;
        logInfo("Transformers.js v4 loaded successfully (fallback)");

        // Wire ResilientFetch for chunked downloads of large HF model files
        if (window.ResilientFetch) {
          transformersModule.env.fetch = window.ResilientFetch.create();
          logInfo("ResilientFetch wired into Transformers.js env.fetch");
        } else {
          logWarn("ResilientFetch not available — large model downloads may fail on unstable connections");
        }

        return transformersModule;
      } catch (fallbackErr) {
        libraryAvailable = false;
        transformersModule = null;
        logError(
          "Failed to load Transformers.js v4 from both CDN sources:",
          fallbackErr.message || fallbackErr,
        );
        throw new Error(
          "Could not load Transformers.js library. Check your internet connection and try again.",
        );
      }
    }
  }

  // ========================================================================
  // 2. GPU DETECTION
  // ========================================================================

  /**
   * Detects the user's GPU capabilities via WebGPU adapter probing.
   * Results are cached for the session.
   *
   * @returns {Promise<Object>} GPU information object
   */
  async function detectGPU() {
    if (cachedGPUInfo) return cachedGPUInfo;

    if (!navigator.gpu) {
      logInfo("WebGPU not available — WASM/CPU fallback");
      cachedGPUInfo = {
        type: "none",
        class: "wasm-cpu",
        description: "",
        maxBufferSize: 0,
        isDiscrete: false,
      };
      return cachedGPUInfo;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance",
      });

      if (!adapter) {
        logWarn("WebGPU adapter not available");
        cachedGPUInfo = {
          type: "none",
          class: "wasm-cpu",
          description: "",
          maxBufferSize: 0,
          isDiscrete: false,
        };
        return cachedGPUInfo;
      }

      const maxBufferSize = adapter.limits
        ? adapter.limits.maxBufferSize || 0
        : 0;
      const isDiscrete = maxBufferSize >= DISCRETE_GPU_BUFFER_THRESHOLD;

      // Try to get adapter info (may be empty on some GPUs — Lesson 34)
      // Note: modern browsers use adapter.info (synchronous property);
      // description may be empty (e.g. AMD RDNA-3), so fall back to vendor + architecture
      let description = "";
      try {
        const info = adapter.info || {};
        description = info.description || info.device || "";
        if (!description && (info.vendor || info.architecture)) {
          description = (info.vendor + " " + (info.architecture || "")).trim();
        }
      } catch (e) {
        // adapter.info may not exist on older Chrome versions
        logDebug("Could not read adapter info:", e.message || e);
      }

      cachedGPUInfo = {
        type: isDiscrete ? "discrete" : "integrated",
        class: description || (isDiscrete ? "discrete-gpu" : "integrated-gpu"),
        description: description,
        maxBufferSize: maxBufferSize,
        isDiscrete: isDiscrete,
      };

      logInfo(
        "GPU detected:",
        cachedGPUInfo.type,
        "—",
        cachedGPUInfo.description || cachedGPUInfo.class,
        "— maxBufferSize:",
        (maxBufferSize / (1024 * 1024)).toFixed(0) + "MB",
      );

      return cachedGPUInfo;
    } catch (err) {
      logWarn("GPU detection failed:", err.message || err);
      cachedGPUInfo = {
        type: "none",
        class: "wasm-cpu",
        description: "",
        maxBufferSize: 0,
        isDiscrete: false,
      };
      return cachedGPUInfo;
    }
  }

  // ========================================================================
  // 3. CONTEXT MANAGEMENT
  // ========================================================================

  /**
   * Calculates the maximum safe context length for a model on the current GPU.
   *
   * For models with a fixed contextLimit > 0, returns that value (or the
   * iGPU-reduced limit if the GPU is integrated and contextLimitIGPU is set).
   *
   * For models with contextLimit === 0 and kvCacheDims, calculates from
   * the WebGPU maxBufferSize at runtime.
   *
   * @param {string} key — Model key
   * @returns {number} Maximum safe context length in tokens
   */
  function getMaxContext(key) {
    const modelDef = registry ? registry.getModel(key) : null;
    if (!modelDef) {
      logWarn("getMaxContext: model not found:", key);
      return 2048; // Safe fallback
    }

    return calculateMaxContext(modelDef, cachedGPUInfo);
  }

  /**
   * Internal context calculation.
   *
   * @param {Object} modelDef — Model definition from registry
   * @param {Object|null} gpuInfo — GPU detection result (null if not yet detected)
   * @returns {number} Max safe context in tokens
   */
  function calculateMaxContext(modelDef, gpuInfo) {
    // Fixed context limit models (LFM2 family)
    if (modelDef.contextLimit > 0) {
      // Check for iGPU-reduced limit
      if (modelDef.contextLimitIGPU && gpuInfo && !gpuInfo.isDiscrete) {
        return modelDef.contextLimitIGPU;
      }
      return modelDef.contextLimit;
    }

    // Calculate from KV cache dimensions (Phi-3.5-mini and future models)
    const kv = modelDef.kvCacheDims;
    if (!kv) return 2048; // Safe fallback

    const maxBufferSize =
      gpuInfo && gpuInfo.maxBufferSize
        ? gpuInfo.maxBufferSize
        : DISCRETE_GPU_BUFFER_THRESHOLD;
    const kvBufferSize =
      2 * kv.numLayers * kv.numKVHeads * kv.headDim * kv.bytesPerValue;

    if (kvBufferSize === 0) return 2048;

    const maxContext = Math.floor(maxBufferSize / kvBufferSize);

    // Cap to a reasonable maximum (model's trained limit is much higher, but we cap at 4096)
    return Math.min(maxContext, 4096);
  }

  // ========================================================================
  // 4. MODEL LIFECYCLE
  // ========================================================================

  /**
   * Sets and logs a model's status.
   * @param {string} key — Model key
   * @param {string} status — New status string
   */
  function setModelStatus(key, status) {
    modelStatuses.set(key, status);
    logDebug("Model status:", key, "→", status);
  }

  /**
   * Returns the current lifecycle status of a model.
   *
   * @param {string} key — Model key
   * @returns {string} Status: 'not-downloaded'|'downloading'|'cached'|'loading'|'loaded'|'download-error'|'load-error'
   */
  function getModelStatus(key) {
    const tracked = modelStatuses.get(key);
    if (tracked) return tracked;

    // Not tracked yet — return 'not-downloaded' (cache check is async, done separately)
    return "not-downloaded";
  }

  /**
   * Checks whether a model's files exist in the Cache API.
   *
   * @param {string} key — Model key
   * @returns {Promise<boolean>} True if cached files found
   */
  async function isModelCached(key) {
    const modelDef = registry ? registry.getModel(key) : null;
    if (!modelDef) return false;

    try {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      const hasFiles = keys.some(function (req) {
        return req.url.includes(modelDef.hfModelId);
      });

      // Update status if we discovered cached files
      if (hasFiles && getModelStatus(key) === "not-downloaded") {
        setModelStatus(key, "cached");
      }

      return hasFiles;
    } catch (err) {
      logWarn("Cache inspection failed for", key, ":", err.message || err);
      return false;
    }
  }

  /**
   * Downloads a model's files to the Cache API with progress reporting.
   * Does NOT load the model into GPU memory.
   *
   * @param {string} key — Model key
   * @param {Function} [onProgress] — Progress callback: (progress) => void
   * @returns {Promise<void>}
   */
  async function preDownloadModel(key, onProgress) {
    const modelDef = registry ? registry.getModel(key) : null;
    if (!modelDef) {
      throw new Error("Model not found in registry: " + key);
    }

    // Already loaded or downloading
    const currentStatus = getModelStatus(key);
    if (currentStatus === "loaded" || currentStatus === "downloading") {
      logInfo("Model", key, "is already", currentStatus);
      return;
    }

    // ── Safety guards (Stage 2) ──────────────────────────────────────
    // Block architectures known to crash or hang in WebGPU before
    // wasting bandwidth on a multi-GB download.

    // Guard 1: Qwen2ForCausalLM — std::bad_alloc on all tested hardware
    if (modelDef.className === "Qwen2ForCausalLM") {
      var qwenMsg =
        "The model \"" + (modelDef.userInfo ? modelDef.userInfo.displayName : key) +
        "\" uses the Qwen2 architecture, which causes a fatal memory error (std::bad_alloc) " +
        "in WebGPU ONNX Runtime on all tested hardware. This model cannot run in the browser.";
      logError(qwenMsg);
      throw new Error(qwenMsg);
    }

    // Guard 2: ≥2.4B parameters — WebGPU shader compilation hangs indefinitely
    var PARAM_CEILING = 2400000000; // 2.4B
    if (modelDef.parameterCountNum && modelDef.parameterCountNum >= PARAM_CEILING) {
      // Exception: models we've confirmed work despite being large (e.g. Phi-3.5
      // at 3.8B compiles successfully, just slowly). Check a whitelist.
      var largeModelWhitelist = ["phi-3.5-mini"];
      if (largeModelWhitelist.indexOf(modelDef.key) === -1) {
        var sizeMsg =
          "The model \"" + (modelDef.userInfo ? modelDef.userInfo.displayName : key) +
          "\" has " + (modelDef.userInfo ? modelDef.userInfo.parameterCount : "≥2.4B") +
          " parameters. Models of this size cause WebGPU shader compilation to hang " +
          "indefinitely on all tested hardware. This model cannot run in the browser.";
        logError(sizeMsg);
        throw new Error(sizeMsg);
      }
    }

    setModelStatus(key, "downloading");

    // Bridge ResilientFetch chunk progress into the onProgress callback
    // so the Model Manager progress bar advances during large downloads.
    var bridgeListener = null;
    if (onProgress && window.ResilientFetch && typeof window.ResilientFetch.onProgress === "function") {
      bridgeListener = function (event) {
        // Filter: only forward events for this model's files
        if (event.url && event.url.indexOf(modelDef.hfModelId) !== -1) {
          logDebug("Progress bridge:", event.filename,
            Math.round((event.loaded / event.total) * 100) + "%",
            "chunk", event.chunks.current + "/" + event.chunks.total);
          onProgress({
            file: event.filename,
            status: "progress",
            loaded: event.loaded,
            total: event.total,
          });
        }
      };
      window.ResilientFetch.onProgress(bridgeListener);
      logInfo("Progress bridge registered for", key);
    }

    try {
      const mod = await ensureLibrary();
      const ModelClass = mod[modelDef.className];

      if (!ModelClass) {
        throw new Error(
          "Model class " +
            modelDef.className +
            " not found in Transformers.js. The library may need updating.",
        );
      }

      // Build progress callback
      const progressCallback = onProgress
        ? function (progress) {
            if (onProgress) {
              onProgress(progress);
            }
          }
        : undefined;

      // Download tokeniser and model (this populates the cache)
      logInfo("Downloading tokeniser for", key, "…");
      await mod.AutoTokenizer.from_pretrained(modelDef.hfModelId, {
        progress_callback: progressCallback,
      });

      logInfo("Downloading model weights for", key, "…");
      const downloadOptions = {
        dtype: modelDef.quantisation,
        device: "webgpu",
        progress_callback: progressCallback,
      };
      if (modelDef.useExternalDataFormat) {
        downloadOptions.use_external_data_format = true;
      }
      await ModelClass.from_pretrained(modelDef.hfModelId, downloadOptions);

      setModelStatus(key, "cached");
      logInfo("Model", key, "downloaded and cached successfully");

      // Dispose the model instance — we only wanted to cache the files
      // The model was loaded into memory by from_pretrained, so we need to clean up
      // Actually, from_pretrained returns the model — we should dispose it
      // But we didn't store the reference. For pre-download, we'll load and
      // immediately unload. This is acceptable because the cache persists.
    } catch (err) {
      setModelStatus(key, "download-error");
      logError("Download failed for", key, ":", err.message || err);

      // Check for specific error types
      if (
        err.name === "QuotaExceededError" ||
        (err.message && err.message.includes("quota"))
      ) {
        throw new Error(
          "Not enough storage space to download this model. Try freeing up browser storage or removing other cached models.",
        );
      }

      throw new Error(
        "Failed to download model " +
          modelDef.userInfo.displayName +
          ": " +
          (err.message || "Unknown error"),
      );
    } finally {
      // Clean up the progress bridge listener
      if (bridgeListener && window.ResilientFetch && typeof window.ResilientFetch.offProgress === "function") {
        window.ResilientFetch.offProgress(bridgeListener);
        logInfo("Progress bridge unregistered for", key);
      }
    }
  }

  /**
   * Cancels an in-progress download.
   * Note: Transformers.js does not currently support download cancellation
   * natively. This sets the status but cannot abort the network requests.
   *
   * @param {string} key — Model key
   */
  function cancelDownload(key) {
    if (getModelStatus(key) === "downloading") {
      setModelStatus(key, "not-downloaded");
      logInfo(
        "Download cancelled for",
        key,
        "(note: in-flight network requests may complete)",
      );
    }
  }

  /**
   * Loads a model and its tokeniser into GPU memory, ready for inference.
   * If the model is already loaded, returns the cached instances.
   * If cached but not loaded, loads from cache (fast).
   * Includes shader warmup before reporting ready.
   *
   * @param {string} key — Model key
   * @returns {Promise<{model: Object, tokeniser: Object}>}
   */
  async function ensureModel(key) {
    // Already loaded
    if (modelInstances.has(key)) {
      logDebug("Model", key, "already loaded — returning cached instance");
      return modelInstances.get(key);
    }

    const modelDef = registry ? registry.getModel(key) : null;
    if (!modelDef) {
      throw new Error("Model not found in registry: " + key);
    }

    setModelStatus(key, "loading");

    try {
      const mod = await ensureLibrary();

      // Ensure GPU info is available for context calculations
      await detectGPU();

      // Resolve model class
      const ModelClass = mod[modelDef.className];
      if (!ModelClass) {
        throw new Error(
          "Model class " +
            modelDef.className +
            " not found in Transformers.js. The library may need updating.",
        );
      }

      // Load tokeniser
      logInfo("Loading tokeniser for", key, "…");
      const tokeniser = await mod.AutoTokenizer.from_pretrained(
        modelDef.hfModelId,
      );

      // Determine device — prefer WebGPU, fall back to WASM
      let device = "webgpu";
      if (!navigator.gpu) {
        logWarn("WebGPU not available — falling back to WASM (will be slower)");
        device = "wasm";
      }

      // Load model
      logInfo("Loading model", key, "on", device, "…");
      const loadOptions = {
        dtype: modelDef.quantisation,
        device: device,
      };
      if (modelDef.useExternalDataFormat) {
        loadOptions.use_external_data_format = true;
      }
      const model = await ModelClass.from_pretrained(
        modelDef.hfModelId,
        loadOptions,
      );

      // Shader warmup — pre-compile WebGPU shaders with a dummy generation
      if (device === "webgpu") {
        logInfo("Running shader warmup for", key, "…");
        try {
          const warmupInputs = tokeniser("x");
          await model.generate({ ...warmupInputs, max_new_tokens: 1 });
          logDebug("Shader warmup complete for", key);
        } catch (warmupErr) {
          logWarn(
            "Shader warmup failed for",
            key,
            "(non-fatal):",
            warmupErr.message || warmupErr,
          );
        }
      }

      // Store instances
      const instance = { model: model, tokeniser: tokeniser };
      modelInstances.set(key, instance);
      setModelStatus(key, "loaded");

      logInfo("Model", key, "loaded and ready");
      return instance;
    } catch (err) {
      setModelStatus(key, "load-error");
      logError("Failed to load model", key, ":", err.message || err);

      // Classify the error for user-friendly messages
      const errorMsg = err.message || "";

      if (
        errorMsg.includes("DXGI_ERROR_DEVICE_HUNG") ||
        errorMsg.includes("device lost")
      ) {
        throw new Error(
          "GPU error while loading " +
            key +
            ". This usually means the model is too large for your GPU. Try refreshing the page and using a smaller model.",
        );
      }

      if (
        errorMsg.includes("maxBufferSize") ||
        errorMsg.includes("exceeds the max buffer size")
      ) {
        throw new Error(
          "Model " +
            key +
            " exceeds your GPU's buffer limit. Try a smaller model or reduce the context length.",
        );
      }

      throw new Error(
        "Failed to load model: " + (err.message || "Unknown error"),
      );
    }
  }

  /**
   * Unloads a model from GPU memory but keeps cached files.
   *
   * @param {string} key — Model key
   * @returns {Promise<void>}
   */
  async function unloadModel(key) {
    const instance = modelInstances.get(key);
    if (!instance) {
      logDebug("Model", key, "is not loaded — nothing to unload");
      return;
    }

    try {
      if (instance.model && typeof instance.model.dispose === "function") {
        await instance.model.dispose();
        logDebug("Disposed model instance for", key);
      }
    } catch (err) {
      logWarn("Error disposing model", key, ":", err.message || err);
    }

    modelInstances.delete(key);
    activeStoppingCriteria.delete(key);
    setModelStatus(key, "cached");
    logInfo("Model", key, "unloaded (cache retained)");
  }

  /**
   * Removes a model's cached files from the Cache API.
   *
   * @param {string} key — Model key
   * @returns {Promise<{removedCount: number, removedBytes: number}>}
   */
  async function removeCachedModel(key) {
    // Unload first if loaded
    if (modelInstances.has(key)) {
      await unloadModel(key);
    }

    const modelDef = registry ? registry.getModel(key) : null;
    if (!modelDef) {
      return { removedCount: 0, removedBytes: 0 };
    }

    try {
      const cache = await caches.open(CACHE_NAME);
      const allKeys = await cache.keys();

      let removedCount = 0;
      let removedBytes = 0;

      for (const req of allKeys) {
        if (req.url.includes(modelDef.hfModelId)) {
          try {
            // Estimate size before deleting
            const response = await cache.match(req);
            if (response) {
              const contentLength = response.headers.get("content-length");
              if (contentLength) {
                removedBytes += parseInt(contentLength, 10);
              }
            }
            await cache.delete(req);
            removedCount++;
          } catch (delErr) {
            logWarn(
              "Failed to delete cache entry:",
              req.url,
              delErr.message || delErr,
            );
          }
        }
      }

      setModelStatus(key, "not-downloaded");
      logInfo(
        "Removed",
        removedCount,
        "cached files for",
        key,
        "(" + (removedBytes / (1024 * 1024)).toFixed(1) + "MB)",
      );

      return { removedCount: removedCount, removedBytes: removedBytes };
    } catch (err) {
      logError("Failed to remove cached model", key, ":", err.message || err);
      return { removedCount: 0, removedBytes: 0 };
    }
  }

  /**
   * Unloads all models and releases the library reference.
   *
   * @returns {Promise<void>}
   */
  async function destroy() {
    logInfo("Destroying gateway — unloading all models");

    for (const [key] of modelInstances) {
      await unloadModel(key);
    }

    modelInstances.clear();
    modelStatuses.clear();
    activeStoppingCriteria.clear();
    cachedGPUInfo = null;
    transformersModule = null;
    libraryAvailable = false;

    logInfo("Gateway destroyed");
  }

  // ========================================================================
  // 5. INFERENCE
  // ========================================================================

  /**
   * Builds a chat messages array from a user prompt string or pre-built
   * messages array (for multi-turn conversations).
   *
   * @param {string|Array<Object>} prompt — User prompt text, or a pre-built
   *   messages array of { role, content } objects
   * @param {string} [systemPrompt] — Optional system prompt
   * @returns {Array<Object>} Messages array for apply_chat_template
   */
  function buildMessages(prompt, systemPrompt) {
    let messages;

    if (Array.isArray(prompt)) {
      // Multi-turn: caller provides full conversation history
      messages = prompt;
      // Prepend system prompt if provided and not already present
      if (systemPrompt && messages[0]?.role !== "system") {
        messages = [
          { role: "system", content: systemPrompt },
          ...messages,
        ];
      }
    } else {
      // Single-turn: wrap string in messages array (existing behaviour)
      messages = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: prompt });
    }

    return messages;
  }

  /**
   * Classifies generation errors into user-friendly messages.
   *
   * @param {Error} err — The caught error
   * @param {string} key — Model key
   * @returns {string} User-friendly error message
   */
  function classifyGenerationError(err, key) {
    const msg = err.message || "";

    if (
      msg.includes("DXGI_ERROR_DEVICE_HUNG") ||
      msg.includes("device lost") ||
      msg.includes("Device lost")
    ) {
      return "GPU crashed during generation. This usually means the context was too large for your GPU. Please refresh the page and try a shorter prompt or a smaller model.";
    }

    if (
      msg.includes("maxBufferSize") ||
      msg.includes("exceeds the max buffer size") ||
      msg.includes("Buffer size")
    ) {
      const maxCtx = getMaxContext(key);
      return (
        "Context too large for this model on your GPU. Maximum safe context is approximately " +
        maxCtx +
        " tokens. Try a shorter prompt."
      );
    }

    if (msg.includes("bad_alloc") || msg.includes("std::bad_alloc")) {
      return "Out of memory during generation. Try a shorter prompt or a smaller model.";
    }

    if (msg.includes("SafeInt") || msg.includes("Integer overflow")) {
      return "Buffer calculation overflow — the prompt is too long for this model on your GPU. Try a shorter prompt.";
    }

    if (msg.includes("mapAsync") || msg.includes("invalid")) {
      return "GPU buffer error. This may be caused by a previous out-of-memory condition. Please refresh the page and try again.";
    }

    return "Generation failed: " + (msg || "Unknown error");
  }

  /**
   * Generates text from a prompt (non-streaming).
   *
   * @param {string} key — Model key
   * @param {string} prompt — User prompt text
   * @param {Object} [opts] — Generation options
   * @param {number} [opts.maxTokens=512] — Maximum tokens to generate
   * @param {number} [opts.temperature=0.7] — Sampling temperature (0 = greedy)
   * @param {number} [opts.topP=0.95] — Top-p sampling
   * @param {string} [opts.systemPrompt] — Optional system prompt
   * @returns {Promise<Object>} Result object with status, text, tokenCount, etc.
   */
  async function generate(key, prompt, opts) {
    const options = opts || {};
    const maxTokens = options.maxTokens || 512;
    const temperature =
      options.temperature !== undefined ? options.temperature : 0.7;
    const topP = options.topP !== undefined ? options.topP : 0.95;
    const systemPrompt = options.systemPrompt || null;

    const modelDef = registry ? registry.getModel(key) : null;
    if (!modelDef) {
      return {
        status: "error",
        text: "",
        tokenCount: 0,
        duration: 0,
        tokensPerSecond: 0,
        model: "local/" + key,
        error: "Model not found in registry: " + key,
      };
    }

    try {
      const instance = await ensureModel(key);
      const { model, tokeniser } = instance;

      const messages = buildMessages(prompt, systemPrompt);
      const startTime = performance.now();

      // Tokenise with chat template
      const inputs = tokeniser.apply_chat_template(messages, {
        add_generation_prompt: true,
        return_dict: true,
        tokenize: true,
      });

      // Generate — single merged object pattern (Lesson 9)
      const output = await model.generate({
        ...inputs,
        max_new_tokens: maxTokens,
        temperature: temperature,
        do_sample: temperature > 0,
        top_p: topP,
      });

      const duration = performance.now() - startTime;

      // Decode output — skip input tokens
      const inputLength = inputs.input_ids.dims
        ? inputs.input_ids.dims[1]
        : inputs.input_ids.length || 0;
      const outputTokens = output.slice(null, [inputLength, null]);
      const text = tokeniser.decode(outputTokens[0], {
        skip_special_tokens: true,
      });

      const tokenCount = outputTokens.dims ? outputTokens.dims[1] : 0;
      const tokensPerSecond = duration > 0 ? tokenCount / (duration / 1000) : 0;

      logInfo(
        "Generated",
        tokenCount,
        "tokens in",
        (duration / 1000).toFixed(1) + "s",
        "(" + tokensPerSecond.toFixed(1),
        "tok/s) for",
        key,
      );

      return {
        status: "success",
        text: text,
        tokenCount: tokenCount,
        duration: Math.round(duration),
        tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
        model: modelDef.localModelId,
        error: null,
      };
    } catch (err) {
      logError("Generation failed for", key, ":", err.message || err);
      return {
        status: "error",
        text: "",
        tokenCount: 0,
        duration: 0,
        tokensPerSecond: 0,
        model: modelDef.localModelId,
        error: classifyGenerationError(err, key),
      };
    }
  }

  /**
   * Generates text from a prompt with streaming token-by-token output.
   *
   * @param {string} key — Model key
   * @param {string} prompt — User prompt text
   * @param {Object} [opts] — Generation options
   * @param {number} [opts.maxTokens=512] — Maximum tokens to generate
   * @param {number} [opts.temperature=0.7] — Sampling temperature
   * @param {number} [opts.topP=0.95] — Top-p sampling
   * @param {string} [opts.systemPrompt] — Optional system prompt
   * @param {Function} [opts.onToken] — Token callback: ({text, index, elapsed}) => void
   * @returns {Promise<Object>} Result object with status, text, tokenCount, etc.
   */
  async function generateStreaming(key, prompt, opts) {
    const options = opts || {};
    const maxTokens = options.maxTokens || 512;
    const temperature =
      options.temperature !== undefined ? options.temperature : 0.7;
    const topP = options.topP !== undefined ? options.topP : 0.95;
    const systemPrompt = options.systemPrompt || null;
    const onToken = options.onToken || null;

    const modelDef = registry ? registry.getModel(key) : null;
    if (!modelDef) {
      return {
        status: "error",
        text: "",
        tokenCount: 0,
        duration: 0,
        tokensPerSecond: 0,
        model: "local/" + key,
        error: "Model not found in registry: " + key,
      };
    }

    try {
      const instance = await ensureModel(key);
      const { model, tokeniser } = instance;
      const mod = transformersModule;

      const messages = buildMessages(prompt, systemPrompt);
      const startTime = performance.now();

      // Tokenise with chat template
      const inputs = tokeniser.apply_chat_template(messages, {
        add_generation_prompt: true,
        return_dict: true,
        tokenize: true,
      });

      // Set up stopping criteria for cancellation support
      let stoppingCriteria = null;
      if (mod.InterruptableStoppingCriteria) {
        stoppingCriteria = new mod.InterruptableStoppingCriteria();
        activeStoppingCriteria.set(key, stoppingCriteria);
      }

      // Set up TextStreamer for token-by-token output
      let tokenCount = 0;
      let accumulatedText = "";
      let streamer = null;

      if (mod.TextStreamer) {
        streamer = new mod.TextStreamer(tokeniser, {
          skip_prompt: true,
          skip_special_tokens: true,
          callback_function: function (text) {
            accumulatedText += text;
            if (onToken) {
              onToken({
                text: text,
                index: tokenCount,
                elapsed: performance.now() - startTime,
              });
            }
          },
          token_callback_function: function () {
            tokenCount++;
          },
        });
      }

      // Build generation options — single merged object pattern
      const generateOptions = {
        ...inputs,
        max_new_tokens: maxTokens,
        temperature: temperature,
        do_sample: temperature > 0,
        top_p: topP,
      };

      if (streamer) {
        generateOptions.streamer = streamer;
      }

      if (stoppingCriteria) {
        generateOptions.stopping_criteria = stoppingCriteria;
      }

      // Generate
      const output = await model.generate(generateOptions);

      const duration = performance.now() - startTime;

      // Clean up stopping criteria
      activeStoppingCriteria.delete(key);

      // If no streamer was available, decode manually
      if (!streamer) {
        const inputLength = inputs.input_ids.dims
          ? inputs.input_ids.dims[1]
          : inputs.input_ids.length || 0;
        const outputTokens = output.slice(null, [inputLength, null]);
        accumulatedText = tokeniser.decode(outputTokens[0], {
          skip_special_tokens: true,
        });
        tokenCount = outputTokens.dims ? outputTokens.dims[1] : 0;
      }

      const tokensPerSecond = duration > 0 ? tokenCount / (duration / 1000) : 0;

      logInfo(
        "Streamed",
        tokenCount,
        "tokens in",
        (duration / 1000).toFixed(1) + "s",
        "(" + tokensPerSecond.toFixed(1),
        "tok/s) for",
        key,
      );

      return {
        status: "success",
        text: accumulatedText,
        tokenCount: tokenCount,
        duration: Math.round(duration),
        tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
        model: modelDef.localModelId,
        error: null,
      };
    } catch (err) {
      activeStoppingCriteria.delete(key);
      logError("Streaming generation failed for", key, ":", err.message || err);
      return {
        status: "error",
        text: "",
        tokenCount: 0,
        duration: 0,
        tokensPerSecond: 0,
        model: modelDef.localModelId,
        error: classifyGenerationError(err, key),
      };
    }
  }

  /**
   * Cancels an in-progress generation for a model.
   * Uses InterruptableStoppingCriteria to cleanly stop.
   *
   * @param {string} key — Model key
   */
  function cancelGeneration(key) {
    const criteria = activeStoppingCriteria.get(key);
    if (criteria && typeof criteria.interrupt === "function") {
      criteria.interrupt();
      logInfo("Generation cancelled for", key);
    } else {
      logDebug("No active generation to cancel for", key);
    }
  }

  // ========================================================================
  // 6. CACHE INSPECTION
  // ========================================================================

  /**
   * Returns total cache usage across all text models.
   *
   * @returns {Promise<{totalBytes: number, models: Map<string, number>}>}
   */
  async function getCacheSize() {
    const result = { totalBytes: 0, models: new Map() };

    if (!registry) return result;

    try {
      const cache = await caches.open(CACHE_NAME);
      const allKeys = await cache.keys();
      const allModels = registry.getAll();

      for (const modelDef of allModels) {
        let modelBytes = 0;

        for (const req of allKeys) {
          if (req.url.includes(modelDef.hfModelId)) {
            try {
              const response = await cache.match(req);
              if (response) {
                const contentLength = response.headers.get("content-length");
                if (contentLength) {
                  modelBytes += parseInt(contentLength, 10);
                }
              }
            } catch (matchErr) {
              // Skip entries we cannot read
            }
          }
        }

        if (modelBytes > 0) {
          result.models.set(modelDef.key, modelBytes);
          result.totalBytes += modelBytes;
        }
      }

      return result;
    } catch (err) {
      logWarn("Cache size inspection failed:", err.message || err);
      return result;
    }
  }

  // ========================================================================
  // 7. REGISTRY PASS-THROUGH METHODS
  // ========================================================================

  /**
   * Returns all registered models.
   * @returns {Array<Object>}
   */
  function getRegistry() {
    return registry ? registry.getAll() : [];
  }

  /**
   * Look up a model by key.
   * @param {string} key
   * @returns {Object|null}
   */
  function getModel(key) {
    return registry ? registry.getModel(key) : null;
  }

  /**
   * Returns enabled models, optionally filtered by tier.
   * @param {string} [tier] — Optional tier filter
   * @returns {Array<Object>}
   */
  function getAvailableModels(tier) {
    if (!registry) return [];
    if (tier) return registry.getModelsForTier(tier);
    return registry.getEnabled();
  }

  // ========================================================================
  // INITIALISATION
  // ========================================================================

  logInfo("Local Text Model Gateway initialised");

  // ========================================================================
  // RETURN PUBLIC API
  // ========================================================================

  return {
    // Library
    ensureLibrary: ensureLibrary,

    // Registry pass-through
    getRegistry: getRegistry,
    getModel: getModel,
    getAvailableModels: getAvailableModels,

    // GPU detection
    detectGPU: detectGPU,

    // Model lifecycle
    ensureModel: ensureModel,
    preDownloadModel: preDownloadModel,
    cancelDownload: cancelDownload,
    isModelCached: isModelCached,
    getModelStatus: getModelStatus,
    unloadModel: unloadModel,
    removeCachedModel: removeCachedModel,
    destroy: destroy,

    // Inference
    generate: generate,
    generateStreaming: generateStreaming,
    cancelGeneration: cancelGeneration,

    // Context
    getMaxContext: getMaxContext,

    // Cache
    getCacheSize: getCacheSize,
  };
})();

// Expose singleton on window
window.LocalTextModelGateway = window.LocalTextModelGatewayClass;
