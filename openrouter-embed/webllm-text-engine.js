/**
 * WEBLLM TEXT ENGINE -- Browser LLM Inference via MLC-AI WebLLM
 *
 * Engine module for loading and running text LLMs in the browser via
 * pre-compiled MLC-AI GPU shaders. Produces identical result shapes
 * to LocalTextModelGateway for transparent engine dispatch.
 *
 * Public API: ensureLibrary, loadModel, isModelLoaded, getLoadedModelId,
 * generate, generateStreaming, cancelGeneration, unloadModel,
 * isModelCached, removeCachedModel, getCacheStoreNames, clearAllCache,
 * getCacheSize, destroy
 *
 * Architecture: IIFE with window.WebLLMTextEngine global.
 * VERSION: 1.0.0 | DATE: 7 April 2026 | PHASE: DE-2
 */
window.WebLLMTextEngine = (function () {
  "use strict";

  // ── Logging ──────────────────────────────────────────────────────
  var LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  var DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  var ENABLE_ALL_LOGGING = false;
  var DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }
  function logError() {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error.apply(console, ["[WebLLMTextEngine]"].concat(Array.prototype.slice.call(arguments)));
  }
  function logWarn() {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn.apply(console, ["[WebLLMTextEngine]"].concat(Array.prototype.slice.call(arguments)));
  }
  function logInfo() {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log.apply(console, ["[WebLLMTextEngine]"].concat(Array.prototype.slice.call(arguments)));
  }
  function logDebug() {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log.apply(console, ["[WebLLMTextEngine]"].concat(Array.prototype.slice.call(arguments)));
  }

  // ── Constants ────────────────────────────────────────────────────
  var CDN_PRIMARY = "https://esm.run/@mlc-ai/web-llm@0.2.82";
  var CDN_FALLBACK = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.82/+esm";
  var CACHE_STORE_NAMES = ["webllm/model", "webllm/config", "webllm/wasm"];

  // ── Closure state ────────────────────────────────────────────────
  var webllmModule = null;
  var engine = null;
  var loadedModelId = null;
  var cancelRequested = false;

  // ── 1. Library Management ────────────────────────────────────────

  /** Dynamically imports WebLLM from CDN. Caches module in closure. */
  async function ensureLibrary() {
    if (webllmModule) {
      logDebug("Library already loaded -- returning cached module");
      return webllmModule;
    }
    logInfo("Loading WebLLM from CDN...");
    try {
      webllmModule = await import(CDN_PRIMARY);
      logInfo("WebLLM loaded successfully (esm.run)");
      return webllmModule;
    } catch (primaryErr) {
      logWarn("Primary CDN failed, trying fallback...", primaryErr.message || primaryErr);
      try {
        webllmModule = await import(CDN_FALLBACK);
        logInfo("WebLLM loaded successfully (jsdelivr fallback)");
        return webllmModule;
      } catch (fallbackErr) {
        webllmModule = null;
        logError("Failed to load WebLLM from both CDN sources:", fallbackErr.message || fallbackErr);
        throw new Error("Could not load WebLLM library. Check your internet connection and try again.");
      }
    }
  }

  // ── 2. Model Lifecycle ───────────────────────────────────────────

  /**
   * Loads a WebLLM model. Only one model at a time -- unloads previous if different.
   * @param {string} mlcModelId -- e.g. 'Llama-3.2-1B-Instruct-q4f16_1-MLC'
   * @param {Function} [onProgress] -- receives { progress, text }
   */
  async function loadModel(mlcModelId, onProgress) {
    if (!mlcModelId || typeof mlcModelId !== "string") {
      throw new Error("loadModel() requires a valid MLC model ID string.");
    }
    if (engine && loadedModelId && loadedModelId !== mlcModelId) {
      logInfo("Unloading current model before loading new one:", loadedModelId);
      await unloadModel();
    }
    if (engine && loadedModelId === mlcModelId) {
      logDebug("Model already loaded:", mlcModelId);
      return;
    }
    var mod = await ensureLibrary();
    logInfo("Loading model:", mlcModelId);
    var progressCallback = typeof onProgress === "function"
      ? function (progress) {
          onProgress({
            progress: progress.progress != null ? progress.progress : 0,
            text: progress.text || "",
          });
        }
      : undefined;
    try {
      engine = await mod.CreateMLCEngine(mlcModelId, {
        initProgressCallback: progressCallback,
      });
      loadedModelId = mlcModelId;
      logInfo("Model loaded successfully:", mlcModelId);
    } catch (err) {
      engine = null;
      loadedModelId = null;
      logError("Model loading failed:", err.message || err);
      throw new Error("Failed to load WebLLM model " + mlcModelId + ": " + (err.message || "Unknown error"));
    }
  }

  function isModelLoaded() {
    return engine !== null && loadedModelId !== null;
  }

  function getLoadedModelId() {
    return loadedModelId;
  }

  /** Unloads the current model and releases GPU resources. */
  async function unloadModel() {
    if (engine) {
      try {
        await engine.unload();
        logInfo("Model unloaded:", loadedModelId);
      } catch (err) {
        logWarn("Error during engine.unload():", err.message || err);
      }
    }
    engine = null;
    loadedModelId = null;
    cancelRequested = false;
  }

  // ── 3. Inference helpers ─────────────────────────────────────────

  /** Resolves localModelId for result objects via registry lookup. */
  function resolveLocalModelId(mlcId) {
    if (window.LocalTextModelRegistry) {
      var entry = window.LocalTextModelRegistry.getModelByMlcId(mlcId);
      if (entry) return entry.localModelId;
    }
    return "local/webllm-" + mlcId;
  }

  /** Builds an error result object matching the ONNX gateway shape. */
  function makeErrorResult(modelId, errorMsg) {
    return {
      status: "error", text: "", tokenCount: 0,
      duration: 0, tokensPerSecond: 0, model: modelId,
      error: errorMsg,
    };
  }

  // ── 4. Non-streaming generation ──────────────────────────────────

  /**
   * Non-streaming generation. Resets chat before each request.
   * @param {Array} messages -- OpenAI-format messages
   * @param {Object} [opts] -- { maxTokens, temperature, topP }
   * @returns {Promise<Object>} Result matching ONNX gateway shape
   */
  async function generate(messages, opts) {
    var options = opts || {};
    var maxTokens = options.maxTokens || 512;
    var temperature = options.temperature !== undefined ? options.temperature : 0.7;
    var topP = options.topP !== undefined ? options.topP : 0.95;
    var modelId = resolveLocalModelId(loadedModelId);

    if (!engine) return makeErrorResult(modelId, "No model loaded. Call loadModel() first.");

    try {
      await engine.resetChat();
      var startTime = performance.now();
      var reply = await engine.chat.completions.create({
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens,
        top_p: topP,
      });
      var duration = performance.now() - startTime;
      var text = reply.choices[0].message.content || "";
      var tokenCount = reply.usage && reply.usage.completion_tokens ? reply.usage.completion_tokens : 0;
      var tokensPerSecond = duration > 0 ? tokenCount / (duration / 1000) : 0;

      logInfo("Generated", tokenCount, "tokens in", (duration / 1000).toFixed(1) + "s",
        "(" + tokensPerSecond.toFixed(1), "tok/s)");

      return {
        status: "success", text: text, tokenCount: tokenCount,
        duration: Math.round(duration),
        tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
        model: modelId, error: null,
      };
    } catch (err) {
      logError("Generation failed:", err.message || err);
      return makeErrorResult(modelId, err.message || "Generation failed");
    }
  }

  // ── 5. Streaming generation ──────────────────────────────────────

  /**
   * Streaming generation with per-token callbacks. Resets chat before each request.
   * @param {Array} messages -- OpenAI-format messages
   * @param {Object} [opts] -- { maxTokens, temperature, topP, onToken }
   *   onToken receives { text, index, elapsed }
   * @returns {Promise<Object>} Result matching ONNX gateway shape
   */
  async function generateStreaming(messages, opts) {
    var options = opts || {};
    var maxTokens = options.maxTokens || 512;
    var temperature = options.temperature !== undefined ? options.temperature : 0.7;
    var topP = options.topP !== undefined ? options.topP : 0.95;
    var onToken = options.onToken || null;
    var modelId = resolveLocalModelId(loadedModelId);

    if (!engine) return makeErrorResult(modelId, "No model loaded. Call loadModel() first.");

    cancelRequested = false;

    try {
      await engine.resetChat();
      var startTime = performance.now();
      var stream = await engine.chat.completions.create({
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens,
        top_p: topP,
        stream: true,
        stream_options: { include_usage: true },
      });

      var tokenIndex = 0;
      var fullText = "";
      var usage = null;

      for await (var chunk of stream) {
        if (cancelRequested) {
          logInfo("Generation cancelled by user");
          break;
        }
        var delta = chunk.choices[0] && chunk.choices[0].delta
          ? chunk.choices[0].delta.content || "" : "";
        if (delta) {
          fullText += delta;
          if (onToken) {
            onToken({ text: delta, index: tokenIndex, elapsed: performance.now() - startTime });
          }
          tokenIndex++;
        }
        if (chunk.usage) usage = chunk.usage;
      }

      var duration = performance.now() - startTime;
      var tokenCount = usage && usage.completion_tokens ? usage.completion_tokens : tokenIndex;
      var tokensPerSecond = duration > 0 ? tokenCount / (duration / 1000) : 0;

      logInfo("Streamed", tokenCount, "tokens in", (duration / 1000).toFixed(1) + "s",
        "(" + tokensPerSecond.toFixed(1), "tok/s)");

      return {
        status: cancelRequested ? "cancelled" : "success",
        text: fullText, tokenCount: tokenCount,
        duration: Math.round(duration),
        tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
        model: modelId, error: null,
      };
    } catch (err) {
      logError("Streaming generation failed:", err.message || err);
      return makeErrorResult(modelId, err.message || "Streaming generation failed");
    } finally {
      cancelRequested = false;
    }
  }

  // ── 6. Cancellation ──────────────────────────────────────────────

  /**
   * Cancels in-progress generation.
   * Uses engine.interruptGenerate() if available, otherwise cancelRequested flag.
   */
  function cancelGeneration() {
    if (!engine) {
      logDebug("No engine active -- nothing to cancel");
      return;
    }
    if (typeof engine.interruptGenerate === "function") {
      engine.interruptGenerate();
      logInfo("Generation interrupted via engine.interruptGenerate()");
    } else {
      cancelRequested = true;
      logInfo("Generation cancel requested via flag (stream loop will check)");
    }
  }

  // ── 7. Cache Management ──────────────────────────────────────────

  function getCacheStoreNames() {
    return CACHE_STORE_NAMES.slice();
  }

  /** Checks whether a model's files exist in the WebLLM cache. */
  async function isModelCached(mlcModelId) {
    if (!mlcModelId) return false;
    try {
      var cache = await caches.open(CACHE_STORE_NAMES[0]);
      var keys = await cache.keys();
      return keys.some(function (req) { return req.url.indexOf(mlcModelId) !== -1; });
    } catch (err) {
      logWarn("Cache inspection failed:", err.message || err);
      return false;
    }
  }

  /** Removes cached entries for a specific model from all WebLLM stores. */
  async function removeCachedModel(mlcModelId) {
    if (!mlcModelId) return { removedCount: 0, removedBytes: 0 };
    var removedCount = 0;
    var removedBytes = 0;

    for (var i = 0; i < CACHE_STORE_NAMES.length; i++) {
      try {
        var cache = await caches.open(CACHE_STORE_NAMES[i]);
        var keys = await cache.keys();
        for (var j = 0; j < keys.length; j++) {
          if (keys[j].url.indexOf(mlcModelId) !== -1) {
            try {
              var response = await cache.match(keys[j]);
              if (response) {
                var cl = response.headers.get("content-length");
                if (cl) removedBytes += parseInt(cl, 10);
              }
            } catch (e) { /* size estimation failed */ }
            await cache.delete(keys[j]);
            removedCount++;
          }
        }
      } catch (storeErr) {
        logWarn("Error accessing cache store", CACHE_STORE_NAMES[i], ":", storeErr.message || storeErr);
      }
    }
    logInfo("Removed", removedCount, "cached entries for", mlcModelId,
      "(" + Math.round(removedBytes / (1024 * 1024)) + "MB)");
    return { removedCount: removedCount, removedBytes: removedBytes };
  }

  /** Deletes all three WebLLM cache stores entirely. */
  async function clearAllCache() {
    for (var i = 0; i < CACHE_STORE_NAMES.length; i++) {
      try {
        await caches.delete(CACHE_STORE_NAMES[i]);
        logDebug("Deleted cache store:", CACHE_STORE_NAMES[i]);
      } catch (err) {
        logWarn("Failed to delete cache store", CACHE_STORE_NAMES[i], ":", err.message || err);
      }
    }
    logInfo("All WebLLM cache stores cleared");
  }

  /** Returns total cache usage across all WebLLM cache stores. */
  async function getCacheSize() {
    var result = { totalBytes: 0, models: {} };
    for (var i = 0; i < CACHE_STORE_NAMES.length; i++) {
      try {
        var hasStore = await caches.has(CACHE_STORE_NAMES[i]);
        if (!hasStore) continue;
        var cache = await caches.open(CACHE_STORE_NAMES[i]);
        var keys = await cache.keys();
        for (var j = 0; j < keys.length; j++) {
          try {
            var response = await cache.match(keys[j]);
            if (response) {
              var cl = response.headers.get("content-length");
              if (cl) {
                var bytes = parseInt(cl, 10);
                result.totalBytes += bytes;
                var modelMatch = keys[j].url.match(/([A-Za-z0-9._-]+-(?:q[0-9]f[0-9]+_[0-9]+-)?MLC)/);
                if (modelMatch) {
                  var mn = modelMatch[1];
                  result.models[mn] = (result.models[mn] || 0) + bytes;
                }
              }
            }
          } catch (e) { /* skip unreadable entries */ }
        }
      } catch (storeErr) {
        logDebug("Could not read cache store", CACHE_STORE_NAMES[i], ":", storeErr.message || storeErr);
      }
    }
    logDebug("WebLLM cache size:", Math.round(result.totalBytes / (1024 * 1024)) + "MB");
    return result;
  }

  // ── 8. Cleanup ───────────────────────────────────────────────────

  /** Full cleanup: unload model + clear module reference. Does NOT clear cache. */
  async function destroy() {
    await unloadModel();
    webllmModule = null;
    logInfo("WebLLMTextEngine destroyed");
  }

  // ── Init ─────────────────────────────────────────────────────────
  logInfo("WebLLM Text Engine initialised");

  // ── Public API ───────────────────────────────────────────────────
  return {
    ensureLibrary: ensureLibrary,
    loadModel: loadModel,
    isModelLoaded: isModelLoaded,
    getLoadedModelId: getLoadedModelId,
    generate: generate,
    generateStreaming: generateStreaming,
    cancelGeneration: cancelGeneration,
    unloadModel: unloadModel,
    isModelCached: isModelCached,
    removeCachedModel: removeCachedModel,
    getCacheStoreNames: getCacheStoreNames,
    clearAllCache: clearAllCache,
    getCacheSize: getCacheSize,
    destroy: destroy,
  };
})();
