/**
 * ═══════════════════════════════════════════════════════════════
 * LOCAL TEXT MODEL REGISTRY — Pluggable Model Definitions
 * ═══════════════════════════════════════════════════════════════
 *
 * Pure data module containing model definitions for text-only
 * LLMs that run in-browser via Transformers.js v4 + WebGPU.
 *
 * Each entry includes technical fields (used by the gateway)
 * and user-facing metadata (used by the Model Manager UI).
 *
 * Adding a new model requires only a new entry in the MODELS
 * array — no other code changes needed.
 *
 * Public API (on window.LocalTextModelRegistry):
 *   getAll()                    → Array<ModelDef>
 *   getEnabled()                → Array<ModelDef>
 *   getModel(key)               → ModelDef|null
 *   getModelByLocalId(localId)  → ModelDef|null
 *   getDefaultModel(gpuInfo)    → ModelDef
 *   getModelsForTier(tier)      → Array<ModelDef>
 *   getModelsByEngine(engine)   → Array<ModelDef>
 *   getModelByMlcId(mlcId)      → ModelDef|null
 *
 * Architecture: IIFE with window global.
 * No NPM — pure browser JS loaded via <script> tag.
 *
 * VERSION: 1.4.0
 * DATE: 8 April 2026
 * PHASE: Phase DE-8 — Model Lineup Update
 * ═══════════════════════════════════════════════════════════════
 */

window.LocalTextModelRegistryClass = (function () {
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
      console.error("[TextModelRegistry]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[TextModelRegistry]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[TextModelRegistry]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[TextModelRegistry]", message, ...args);
  }

  // ========================================================================
  // MODEL DEFINITIONS
  // ========================================================================

  /**
   * All registered text models.
   * Each entry contains technical fields for the gateway and
   * user-facing metadata for the Model Manager UI.
   *
   * Tier values:
   *   'default-igpu'    — recommended for integrated GPUs / unknown hardware (ONNX)
   *   'default-dgpu'    — recommended for discrete GPUs (4GB+) (ONNX)
   *   'quality'          — highest quality ONNX, requires 8GB+ discrete GPU
   *   'webllm-balanced'  — WebLLM balanced speed/quality, works on all GPUs
   *   'webllm-quality'   — WebLLM highest quality, works on all GPUs (4GB+)
   */
  const MODELS = [
    // ── LFM2-350M — Universal default ──────────────────────
    {
      key: "lfm2-350m",
      engine: "onnx",
      localModelId: "local/lfm2-350m",
      hfModelId: "onnx-community/LFM2-350M-ONNX",
      className: "Lfm2ForCausalLM",
      quantisation: "q4",
      contextLimit: 4096,
      useExternalDataFormat: true,
      enabled: true,
      tier: "default-igpu",
      parameterCountNum: 350000000,
      viable: true,
      viableNotes:
        "Universal compatibility \u2014 fastest model on all tested hardware including 2GB iGPUs.",

      userInfo: {
        displayName: "LFM2 350M",
        provider: "Liquid AI",
        parameterCount: "350M",
        licence: "Apache 2.0",
        downloadSizeMB: 284,
        summary:
          "Tiny but capable. The fastest model on every GPU tested \u2014 runs well even on integrated graphics. The only model that handles long context (4096 tokens) on all hardware.",
        strengths: [
          "Fastest inference speed on all hardware (16\u201377 tok/s)",
          "Full 4096-token context on every GPU, including 2GB iGPUs",
          "Small download (284MB) \u2014 quick first-run experience",
          "Clean, concise output with no thinking overhead",
        ],
        weaknesses: [
          "Limited output quality due to 350M parameter count",
          "May struggle with complex reasoning or nuanced instructions",
          "Shorter, less detailed responses than larger models",
        ],
        bestFor:
          "Quick answers, simple tasks, low-end hardware, first-time users",
        benchmarks: {
          "vega-10-igpu": {
            tokPerSec: 16.3,
            contextSafe: true,
            loadTimeSec: 2.3,
          },
          "gtx-1650-super": {
            tokPerSec: 71.0,
            contextSafe: true,
            loadTimeSec: 1.5,
          },
          "radeon-780m-igpu": {
            tokPerSec: 44.4,
            contextSafe: true,
            loadTimeSec: 8.9,
          },
          "rtx-4060": { tokPerSec: 32.7, contextSafe: true, loadTimeSec: 2.2 },
          "rtx-4070": { tokPerSec: 77.0, contextSafe: true, loadTimeSec: 1.5 },
        },
      },
    },

    // ── LFM2.5-1.2B Instruct — Discrete GPU default ───────
    {
      key: "lfm2.5-1.2b",
      engine: "onnx",
      localModelId: "local/lfm2.5-1.2b",
      hfModelId: "LiquidAI/LFM2.5-1.2B-Instruct-ONNX",
      className: "Lfm2ForCausalLM",
      quantisation: "q4",
      contextLimit: 4096,
      useExternalDataFormat: true,
      enabled: true,
      tier: "default-dgpu",
      parameterCountNum: 1200000000,
      viable: true,
      viableNotes:
        "Full compatibility on discrete GPUs. 4/4 instruct, context 4096 PASS, 128K context window. Fails on iGPU (bad_alloc on inference).",

      userInfo: {
        displayName: "LFM2.5 1.2B Instruct",
        provider: "Liquid AI",
        parameterCount: "1.2B",
        licence: "Apache 2.0",
        downloadSizeMB: 836,
        summary:
          "The recommended model for discrete GPUs. Instruct-tuned with 128K context window. Fastest ONNX model above 350M on every discrete GPU tested \u2014 up to 99 tok/s on RTX 4060.",
        strengths: [
          "Fastest 1B+ model on discrete GPUs (39\u201399 tok/s)",
          "Full 4096-token context on all discrete GPUs (4GB+)",
          "Instruct-tuned \u2014 better instruction following than base LFM2-1.2B",
          "128K context window (model supports it; hardware limits practical context)",
        ],
        weaknesses: [
          "Does not work on integrated GPUs (bad_alloc on inference)",
          "Larger download (836MB vs 284MB for LFM2-350M)",
          "Limited output quality compared to 3B+ models",
        ],
        bestFor:
          "General use on desktop PCs with a dedicated graphics card",
        benchmarks: {
          "gtx-1650-super": {
            tokPerSec: 39.1,
            contextSafe: true,
            loadTimeSec: 17.7,
          },
          "radeon-780m-igpu": {
            tokPerSec: 0,
            contextSafe: false,
            loadTimeSec: 20.0,
          },
          "rtx-4060": { tokPerSec: 98.8, contextSafe: true, loadTimeSec: 62.0 },
          "rtx-4070": { tokPerSec: 62.7, contextSafe: true, loadTimeSec: 63.3 },
        },
      },
    },

    // ── Phi-3.5-mini — Quality tier ────────────────────────
    {
      key: "phi-3.5-mini",
      engine: "onnx",
      localModelId: "local/phi-3.5-mini",
      hfModelId: "onnx-community/Phi-3.5-mini-instruct-onnx-web",
      className: "Phi3ForCausalLM",
      quantisation: "q4f16",
      contextLimit: 0,
      useExternalDataFormat: true,
      enabled: true,
      tier: "quality",
      parameterCountNum: 3800000000,
      viable: true,
      viableNotes:
        "Works on all tested hardware but slow on iGPUs (<5 tok/s on Vega 10). Limited context (~1024\u20132048 tokens). Whitelisted in gateway safety guards despite 3.8B size.",
      architectureNotes:
        "Phi3ForCausalLM confirmed working. Note: Phi-4-mini uses the same class but compile-hangs at 3.8B \u2014 the whitelisting in the gateway is specific to phi-3.5-mini by key, not by class.",

      kvCacheDims: {
        numLayers: 32,
        numKVHeads: 8,
        headDim: 96,
        bytesPerValue: 2,
      },

      userInfo: {
        displayName: "Phi 3.5 Mini",
        provider: "Microsoft",
        parameterCount: "3.8B",
        licence: "MIT",
        downloadSizeMB: 2300,
        summary:
          "The highest-quality local model available. Produces detailed, nuanced responses comparable to small cloud models. Large download and shorter context window \u2014 best for users who prioritise output quality over speed.",
        strengths: [
          "Best output quality of any local model (3.8B parameters)",
          "Detailed, verbose responses with strong reasoning",
          "4/4 instruction following \u2014 handles complex formatting requests",
          "MIT licence \u2014 no usage restrictions",
        ],
        weaknesses: [
          "Large download (2.3GB) \u2014 slow first-run experience",
          "Limited context window (~1024\u20132048 tokens depending on GPU)",
          "Too slow for interactive use on integrated GPUs (<5 tok/s on Vega 10)",
          "Requires 8GB+ discrete GPU for acceptable speed",
        ],
        bestFor:
          "Users who want the best possible output quality and have a modern discrete GPU",
        benchmarks: {
          "vega-10-igpu": {
            tokPerSec: 2.0,
            contextSafe: false,
            loadTimeSec: 168.6,
          },
          "gtx-1650-super": {
            tokPerSec: 21.8,
            contextSafe: false,
            loadTimeSec: 51.3,
          },
          "radeon-780m-igpu": {
            tokPerSec: 16.7,
            contextSafe: false,
            loadTimeSec: 30.9,
          },
          "rtx-4060": { tokPerSec: 24.6, contextSafe: false, loadTimeSec: 8.5 },
          "rtx-4070": {
            tokPerSec: 51.7,
            contextSafe: false,
            loadTimeSec: 167.9,
          },
        },
      },
    },

    // ── Llama 3.2 1B — WebLLM balanced tier ────────────────
    {
      key: "llama-3.2-1b",
      engine: "webllm",
      localModelId: "local/llama-3.2-1b",
      mlcModelId: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
      parameterCountNum: 1000000000,
      contextLimit: 4096,
      enabled: true,
      tier: "webllm-balanced",
      viable: true,
      viableNotes:
        "Works on all tested hardware including 2GB iGPUs and 4GB dGPUs where ONNX 1B+ models fail. 4/4 instruct, context 4096 PASS on every machine.",

      userInfo: {
        displayName: "Llama 3.2 1B",
        provider: "Meta",
        parameterCount: "1B",
        licence: "Llama 3.2 Community",
        downloadSizeMB: 879,
        summary:
          "The best balance of speed and quality via WebLLM. Runs on integrated GPUs where no ONNX 1B+ model works \u2014 perfect instruct following and full 4096-token context on every tested machine.",
        strengths: [
          "4/4 instruction following on all hardware \u2014 better than ONNX equivalents",
          "Full 4096-token context on every GPU, including 2GB iGPUs",
          "Runs on 4GB dGPUs where ONNX 1B+ models crash",
          "Good speed range (18.9\u201358.5 tok/s depending on GPU)",
        ],
        weaknesses: [
          "Requires WebLLM engine (pre-compiled MLC shaders, not ONNX)",
          "~20\u201326% slower than ONNX for equivalent model sizes",
          "Larger download than ONNX LFM2-350M (879MB vs 284MB)",
          "Load times 16\u201345s on first download; 6s from cache",
        ],
        bestFor:
          "Quality-focused use on any hardware, especially integrated GPUs and 4GB cards where ONNX 1B+ models fail",
        benchmarks: {
          "rtx-4060": {
            tokPerSec: 58.5,
            contextSafe: true,
            loadTimeSec: 45.4,
          },
          "rtx-4070": {
            tokPerSec: 32.5,
            contextSafe: true,
            loadTimeSec: 44.8,
          },
          "gtx-1650-super": {
            tokPerSec: 25.0,
            contextSafe: true,
            loadTimeSec: 16.3,
          },
          "radeon-780m-igpu": {
            tokPerSec: 18.9,
            contextSafe: true,
            loadTimeSec: 18.3,
          },
        },
      },
    },

    // ── Qwen 2.5 1.5B — WebLLM mid tier ─────────────────────
    {
      key: "qwen2.5-1.5b",
      engine: "webllm",
      localModelId: "local/qwen2.5-1.5b",
      mlcModelId: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
      parameterCountNum: 1500000000,
      contextLimit: 4096,
      enabled: true,
      tier: "webllm-mid",
      viable: true,
      viableNotes:
        "FULL PASS on all 4 tested machines. Bypasses ONNX Qwen2 bad_alloc bug completely. 4/4 instruct, context 4096 PASS everywhere.",

      userInfo: {
        displayName: "Qwen 2.5 1.5B",
        provider: "Alibaba",
        parameterCount: "1.5B",
        licence: "Apache 2.0",
        downloadSizeMB: 1500,
        summary:
          "A 1.5B instruct model via WebLLM that works on every tested GPU including integrated graphics. Bypasses the ONNX Qwen2 bug that crashes on all machines. Good balance of speed and quality between the 1B and 3B tiers.",
        strengths: [
          "4/4 instruction following on all hardware",
          "Full 4096-token context on every GPU, including iGPUs",
          "Bypasses ONNX Qwen2 bad_alloc bug completely",
          "50% more parameters than Llama 1B for better output quality",
        ],
        weaknesses: [
          "Requires WebLLM engine (pre-compiled MLC shaders, not ONNX)",
          "Slower than Llama 3.2 1B on most hardware (17\u201334 tok/s vs 19\u201359 tok/s)",
          "Larger download than Llama 1B (~1.5GB vs 879MB)",
        ],
        bestFor:
          "Users who want better quality than 1B without the 1.7GB download of the 3B model",
        benchmarks: {
          "rtx-4060": {
            tokPerSec: 33.7,
            contextSafe: true,
            loadTimeSec: 68.4,
          },
          "rtx-4070": {
            tokPerSec: 17.6,
            contextSafe: true,
            loadTimeSec: 54.1,
          },
          "gtx-1650-super": {
            tokPerSec: 15.7,
            contextSafe: true,
            loadTimeSec: 17.6,
          },
          "radeon-780m-igpu": {
            tokPerSec: 10.9,
            contextSafe: true,
            loadTimeSec: 21.4,
          },
        },
      },
    },

    // ── Llama 3.2 3B — WebLLM quality tier ─────────────────
    {
      key: "llama-3.2-3b",
      engine: "webllm",
      localModelId: "local/llama-3.2-3b",
      mlcModelId: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
      parameterCountNum: 3000000000,
      contextLimit: 4096,
      enabled: true,
      tier: "webllm-quality",
      viable: true,
      viableNotes:
        "Breaks the ONNX 2.4B compile-hang ceiling. Runs on all tested hardware including 4GB dGPUs and iGPUs. 4/4 instruct, context 4096 PASS on every machine.",

      userInfo: {
        displayName: "Llama 3.2 3B",
        provider: "Meta",
        parameterCount: "3B",
        licence: "Llama 3.2 Community",
        downloadSizeMB: 1724,
        summary:
          "The highest-quality model with full context support. Breaks through the ONNX 2.4B compile-hang ceiling \u2014 3B parameters with perfect instruct following and 4096-token context on every tested machine, including 4GB dGPUs and integrated GPUs.",
        strengths: [
          "4/4 instruction following with detailed, nuanced responses",
          "Full 4096-token context on every GPU \u2014 no context limitations",
          "Runs on 4GB dGPUs and iGPUs where all ONNX 2.4B+ models fail",
          "Surpasses every ONNX model in output quality",
        ],
        weaknesses: [
          "Requires WebLLM engine (pre-compiled MLC shaders, not ONNX)",
          "Slower on 4GB GPUs (8.7 tok/s on GTX 1650S may feel sluggish)",
          "Large download (1.72GB) \u2014 slow first-run experience",
          "Load times 32\u2013147s on first download; faster from cache",
        ],
        bestFor:
          "Users who prioritise output quality and have a discrete GPU (4GB+) or modern iGPU",
        benchmarks: {
          "rtx-4060": {
            tokPerSec: 32.3,
            contextSafe: true,
            loadTimeSec: 147.3,
          },
          "rtx-4070": {
            tokPerSec: 18.5,
            contextSafe: true,
            loadTimeSec: 110.3,
          },
          "gtx-1650-super": {
            tokPerSec: 8.7,
            contextSafe: true,
            loadTimeSec: 32.5,
          },
          "radeon-780m-igpu": {
            tokPerSec: 10.8,
            contextSafe: true,
            loadTimeSec: 34.2,
          },
        },
      },
    },
  ];

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Returns all registered models (including disabled ones).
   * @returns {Array<Object>} All model definitions
   */
  function getAll() {
    return MODELS.slice();
  }

  /**
   * Returns only enabled models.
   * @returns {Array<Object>} Enabled model definitions
   */
  function getEnabled() {
    return MODELS.filter(function (m) {
      return m.enabled;
    });
  }

  /**
   * Look up a model by its short key (e.g. 'lfm2-350m').
   * @param {string} key — Model key
   * @returns {Object|null} Model definition or null if not found
   */
  function getModel(key) {
    if (!key) return null;
    const found = MODELS.find(function (m) {
      return m.key === key;
    });
    return found || null;
  }

  /**
   * Look up a model by its local/ prefixed ID (e.g. 'local/lfm2-350m').
   * @param {string} localModelId — Full local model ID
   * @returns {Object|null} Model definition or null if not found
   */
  function getModelByLocalId(localModelId) {
    if (!localModelId) return null;
    const found = MODELS.find(function (m) {
      return m.localModelId === localModelId;
    });
    return found || null;
  }

  /**
   * Returns the recommended default model based on GPU detection results.
   *
   * Logic:
   *   - Discrete GPU detected → LFM2.5-1.2B Instruct (faster on dGPUs)
   *   - Integrated GPU or unknown → LFM2-350M (universal compatibility)
   *
   * @param {Object} [gpuInfo] — Result from gateway's detectGPU()
   * @param {boolean} [gpuInfo.isDiscrete] — Whether a discrete GPU was detected
   * @returns {Object} Recommended model definition
   */
  function getDefaultModel(gpuInfo) {
    if (gpuInfo && gpuInfo.isDiscrete) {
      const dgpuModel = getModel("lfm2.5-1.2b");
      if (dgpuModel && dgpuModel.enabled) {
        logDebug("Discrete GPU detected — recommending LFM2.5-1.2B Instruct");
        return dgpuModel;
      }
    }

    const igpuModel = getModel("lfm2-350m");
    if (igpuModel && igpuModel.enabled) {
      logDebug("iGPU or unknown hardware — recommending LFM2-350M");
      return igpuModel;
    }

    // Fallback: return the first enabled model
    logWarn(
      "Neither default model is enabled — falling back to first available",
    );
    const fallback = getEnabled();
    return fallback.length > 0 ? fallback[0] : MODELS[0];
  }

  /**
   * Returns all models matching a given tier string.
   * @param {string} tier — Tier identifier (e.g. 'default-igpu', 'default-dgpu', 'quality')
   * @returns {Array<Object>} Matching model definitions
   */
  function getModelsForTier(tier) {
    if (!tier) return [];
    return MODELS.filter(function (m) {
      return m.tier === tier;
    });
  }

  /**
   * Returns all models matching a given engine string.
   * @param {string} engine — Engine identifier (e.g. 'onnx', 'webllm')
   * @returns {Array<Object>} Matching model definitions
   */
  function getModelsByEngine(engine) {
    if (!engine) return [];
    return MODELS.filter(function (m) {
      return m.engine === engine;
    });
  }

  /**
   * Reverse lookup from MLC model ID (used by WebLLM engine module).
   * @param {string} mlcId — MLC model ID (e.g. 'Llama-3.2-1B-Instruct-q4f16_1-MLC')
   * @returns {Object|null} Model definition or null if not found
   */
  function getModelByMlcId(mlcId) {
    if (!mlcId) return null;
    var found = MODELS.find(function (m) {
      return m.mlcModelId === mlcId;
    });
    return found || null;
  }

  // ========================================================================
  // INITIALISATION
  // ========================================================================

  logInfo(
    "Local Text Model Registry initialised —",
    MODELS.length,
    "models registered",
  );

  // ========================================================================
  // RETURN PUBLIC API
  // ========================================================================

  return {
    getAll: getAll,
    getEnabled: getEnabled,
    getModel: getModel,
    getModelByLocalId: getModelByLocalId,
    getDefaultModel: getDefaultModel,
    getModelsForTier: getModelsForTier,
    getModelsByEngine: getModelsByEngine,
    getModelByMlcId: getModelByMlcId,
  };
})();

// Expose singleton on window
window.LocalTextModelRegistry = window.LocalTextModelRegistryClass;
