/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER MODEL MANAGER — Model Lifecycle Management
 * ═══════════════════════════════════════════════════════════════
 *
 * Backend logic for tracking model states, inspecting Cache API,
 * managing downloads, and coordinating with the Transformers.js
 * gateway. Provides the data layer for the Model Manager UI
 * (Phase 9D).
 *
 * Model lifecycle states:
 *   not-downloaded → downloading → cached → loading → loaded
 *                       │                              │
 *                       ▼                              ▼
 *                  download-error                 load-error
 *
 * Public API:
 *   getRegisteredModels()                → array of model definitions
 *   getModelState(modelKey)              → state string
 *   getStorageStatus()                   → Promise<{ quotaMB, usedMB, availableMB, persistent }>
 *   requestPersistentStorage()           → Promise<boolean>
 *   preDownloadModel(modelKey, onProgress) → Promise<void>
 *   cancelDownload(modelKey)             → void
 *   removeCachedModel(modelKey)          → Promise<{ removedCount, removedBytes }>
 *   loadModel(modelKey)                  → Promise<void>
 *   unloadModel(modelKey)               → Promise<void>
 *   getCachedModels()                    → Promise<Map>
 *   getCacheSize()                       → Promise<number>
 *   getAnalysisCacheStats()              → Promise<{ imageCount, totalBytes }>
 *   clearAnalysisCache()                 → Promise<void>
 *
 * Architecture: IIFE with window.ImageDescriberModelManager global.
 * No NPM — pure browser JS loaded via <script> tag.
 *
 * VERSION: 1.2.0
 * DATE: 27 March 2026
 * PHASE: 9C — Model Manager Module
 *         Phase 13B — FastVLM registry entry, download/load/status support
 *         Phase 14B — Qwen3.5-0.8B registry entry, download/load/status support
 * ═══════════════════════════════════════════════════════════════
 */

window.ImageDescriberModelManager = (function () {
    'use strict';

    // ========================================================================
    // LOGGING CONFIGURATION
    // ========================================================================

    var LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
    var DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
    var ENABLE_ALL_LOGGING = false;
    var DISABLE_ALL_LOGGING = false;

    function shouldLog(level) {
        if (DISABLE_ALL_LOGGING) return false;
        if (ENABLE_ALL_LOGGING) return true;
        return level <= DEFAULT_LOG_LEVEL;
    }

    function logError(message) {
        if (shouldLog(LOG_LEVELS.ERROR)) {
            var args = Array.prototype.slice.call(arguments, 1);
            console.error.apply(console, ['[ModelManager] ' + message].concat(args));
        }
    }

    function logWarn(message) {
        if (shouldLog(LOG_LEVELS.WARN)) {
            var args = Array.prototype.slice.call(arguments, 1);
            console.warn.apply(console, ['[ModelManager] ' + message].concat(args));
        }
    }

    function logInfo(message) {
        if (shouldLog(LOG_LEVELS.INFO)) {
            var args = Array.prototype.slice.call(arguments, 1);
            console.log.apply(console, ['[ModelManager] ' + message].concat(args));
        }
    }

    function logDebug(message) {
        if (shouldLog(LOG_LEVELS.DEBUG)) {
            var args = Array.prototype.slice.call(arguments, 1);
            console.log.apply(console, ['[ModelManager] ' + message].concat(args));
        }
    }

    // ========================================================================
    // MODEL REGISTRY
    // ========================================================================

    /**
     * Known models with IDs, sizes, roles, ONNX paths.
     * Each entry uses a short key (e.g. 'clip') for API calls.
     *
     * Fields:
     *   key        — short identifier used in getModelState() etc.
     *   name       — human-readable display name
     *   modelId    — Hugging Face model identifier
     *   role       — what the model does
     *   sizeMB     — approximate ONNX download size in MB
     *   task       — Transformers.js pipeline task (null if not using pipeline())
     *   enabled    — whether the model is currently usable
     *   status     — 'active' | 'future' (future = placeholder only)
     *   cachePrefix — prefix for Cache API URL matching
     *   components — for multi-component models (Florence-2), array of class names
     */
    var MODEL_REGISTRY = [
        {
            key: 'clip',
            name: 'CLIP ViT-B/32',
            modelId: 'Xenova/clip-vit-base-patch32',
            role: 'Zero-shot image classification',
            sizeMB: 151,
            task: 'zero-shot-image-classification',
            enabled: true,
            status: 'active',
            cachePrefix: 'https://huggingface.co/Xenova/clip-vit-base-patch32/',
            components: null
        },
        {
            key: 'florence2',
            name: 'Florence-2',
            modelId: 'onnx-community/Florence-2-base-ft',
            role: 'Captioning, object detection, OCR',
            sizeMB: 200,
            task: null,
            enabled: true,
            status: 'active',
            cachePrefix: 'https://huggingface.co/onnx-community/Florence-2-base-ft/',
            components: ['Florence2ForConditionalGeneration', 'AutoProcessor', 'AutoTokenizer']
        },
        {
            key: 'depth',
            name: 'Depth Anything V2 Small',
            modelId: 'onnx-community/depth-anything-v2-small',
            role: 'Monocular depth estimation',
            sizeMB: 50,
            task: 'depth-estimation',
            enabled: true,
            status: 'active',
            cachePrefix: 'https://huggingface.co/onnx-community/depth-anything-v2-small/',
            components: null
        },
        {
            key: 'fastvlm',
            name: 'FastVLM 0.5B',
            modelId: 'onnx-community/FastVLM-0.5B-ONNX',
            role: 'Local description generation (no API key needed)',
            sizeMB: 350,
            task: null,
            enabled: true,
            status: 'active',
            cachePrefix: 'https://huggingface.co/onnx-community/FastVLM-0.5B-ONNX/',
            components: ['AutoModelForImageTextToText', 'AutoProcessor']
        },
        {
            key: 'qwen35',
            name: 'Qwen3.5-0.8B',
            modelId: 'onnx-community/Qwen3.5-0.8B-ONNX',
            role: 'Structured local descriptions (accuracy warning applies)',
            sizeMB: 1000,
            task: null,
            enabled: true,
            status: 'active',
            cachePrefix: 'https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX/',
            components: ['Qwen3_5ForConditionalGeneration', 'AutoProcessor']
        },
        {
            key: 'lfm2vl',
            name: 'LFM2-VL 450M',
            modelId: 'onnx-community/LFM2-VL-450M-ONNX',
            role: 'Local description generation — compact VLM, no API key needed',
            sizeMB: 349,
            task: null,
            enabled: true,
            status: 'active',
            cachePrefix: 'https://huggingface.co/onnx-community/LFM2-VL-450M-ONNX/',
            components: ['AutoModelForImageTextToText', 'AutoProcessor']
        },
        // ── Text generation models (Phase 9) ──────────────────────────
        {
            key: 'lfm2-350m',
            name: 'LFM2 350M',
            modelId: 'onnx-community/LFM2-350M-ONNX',
            role: 'Local text generation — fast, works on all hardware, no API key needed',
            sizeMB: 284,
            task: null,
            enabled: true,
            status: 'active',
            type: 'text',
            cachePrefix: 'https://huggingface.co/onnx-community/LFM2-350M-ONNX/',
            components: ['Lfm2ForCausalLM', 'AutoTokenizer']
        },
        {
            key: 'lfm2-1.2b',
            name: 'LFM2 1.2B',
            modelId: 'onnx-community/LFM2-1.2B-ONNX',
            role: 'Local text generation — faster on discrete GPUs, no API key needed',
            sizeMB: 836,
            task: null,
            enabled: true,
            status: 'active',
            type: 'text',
            cachePrefix: 'https://huggingface.co/onnx-community/LFM2-1.2B-ONNX/',
            components: ['Lfm2ForCausalLM', 'AutoTokenizer']
        },
        {
            key: 'phi-3.5-mini',
            name: 'Phi 3.5 Mini',
            modelId: 'onnx-community/Phi-3.5-mini-instruct-onnx-web',
            role: 'Local text generation — highest quality, large download, no API key needed',
            sizeMB: 2300,
            task: null,
            enabled: true,
            status: 'active',
            type: 'text',
            cachePrefix: 'https://huggingface.co/onnx-community/Phi-3.5-mini-instruct-onnx-web/',
            components: ['Phi3ForCausalLM', 'AutoTokenizer']
        }
    ];

    // ========================================================================
    // STATE TRACKING
    // ========================================================================

    /**
     * Runtime state per model key.
     * Values: 'not-downloaded' | 'downloading' | 'cached' | 'loading' | 'loaded' | 'download-error' | 'load-error'
     * @type {Object<string, string>}
     */
    var modelStates = {};

    /** Active download abort controllers, keyed by model key */
    var downloadAbortControllers = {};

    /**
     * Initialise all model states to 'not-downloaded'.
     * Called once at module load.
     */
    function initStates() {
        for (var i = 0; i < MODEL_REGISTRY.length; i++) {
            var entry = MODEL_REGISTRY[i];
            if (entry.status === 'future') {
                modelStates[entry.key] = 'not-downloaded';
            } else {
                modelStates[entry.key] = 'not-downloaded';
            }
        }
    }

    /**
     * Update state for a model and emit an event.
     * @param {string} modelKey
     * @param {string} newState
     */
    function setState(modelKey, newState) {
        var oldState = modelStates[modelKey];
        modelStates[modelKey] = newState;
        logDebug('State: ' + modelKey + ' ' + oldState + ' → ' + newState);
        emitEvent('model:stateChange', {
            modelKey: modelKey,
            oldState: oldState,
            newState: newState
        });
    }

    // ========================================================================
    // EVENT EMISSION
    // ========================================================================

    /**
     * Emit an event via EmbedEventEmitter if available.
     * @param {string} eventName
     * @param {object} data
     */
    function emitEvent(eventName, data) {
        if (window.EmbedEventEmitter) {
            window.EmbedEventEmitter.emit(eventName, data);
        }
    }

    // ========================================================================
    // REGISTRY ACCESS
    // ========================================================================

    /**
     * Returns a copy of all registered models.
     * @returns {Array<object>}
     */
    function getRegisteredModels() {
        return MODEL_REGISTRY.map(function (entry) {
            return Object.assign({}, entry, {
                state: modelStates[entry.key] || 'not-downloaded'
            });
        });
    }

    /**
     * Find a registry entry by key.
     * @param {string} modelKey
     * @returns {object|null}
     */
    function findModel(modelKey) {
        for (var i = 0; i < MODEL_REGISTRY.length; i++) {
            if (MODEL_REGISTRY[i].key === modelKey) {
                return MODEL_REGISTRY[i];
            }
        }
        return null;
    }

    /**
     * Returns the current state of a model.
     * Also checks gateway pipeline status for loaded state.
     * @param {string} modelKey
     * @returns {string}
     */
    function getModelState(modelKey) {
        var model = findModel(modelKey);
        if (!model) {
            logWarn('getModelState: unknown model key "' + modelKey + '"');
            return 'unknown';
        }

        // For text models, check LocalTextModelGateway status
        if (model.type === 'text' && window.LocalTextModelGateway) {
            var textGwStatus = window.LocalTextModelGateway.getModelStatus(modelKey);
            if (textGwStatus === 'ready' || textGwStatus === 'loaded') {
                modelStates[modelKey] = 'loaded';
                return 'loaded';
            }
            if (textGwStatus === 'loading') {
                modelStates[modelKey] = 'loading';
                return 'loading';
            }
        }

        // For pipeline-based models, check if the gateway has them loaded
        if (model.task && window.ImageDescriberAnalyserTransformers) {
            var pipelineStatus = window.ImageDescriberAnalyserTransformers.getPipelineStatus(
                model.task, model.modelId
            );
            if (pipelineStatus === 'ready') {
                modelStates[modelKey] = 'loaded';
                return 'loaded';
            }
            if (pipelineStatus === 'loading') {
                modelStates[modelKey] = 'loading';
                return 'loading';
            }
        }

        // For FastVLM, check gateway status
        if (modelKey === 'fastvlm' && window.ImageDescriberAnalyserTransformers) {
            var gateway = window.ImageDescriberAnalyserTransformers;
            if (typeof gateway.getFastVLMStatus === 'function') {
                var fastvlmStatus = gateway.getFastVLMStatus();
                if (fastvlmStatus === 'ready') {
                    modelStates[modelKey] = 'loaded';
                    return 'loaded';
                }
                if (fastvlmStatus === 'loading') {
                    modelStates[modelKey] = 'loading';
                    return 'loading';
                }
            }
        }

        // For Qwen3.5, check gateway status
        if (modelKey === 'qwen35' && window.ImageDescriberAnalyserTransformers) {
            var qwenGateway = window.ImageDescriberAnalyserTransformers;
            if (typeof qwenGateway.getQwenStatus === 'function') {
                var qwenStatus = qwenGateway.getQwenStatus();
                if (qwenStatus === 'ready') {
                    modelStates[modelKey] = 'loaded';
                    return 'loaded';
                }
                if (qwenStatus === 'loading') {
                    modelStates[modelKey] = 'loading';
                    return 'loading';
                }
            }
        }

        // For LFM2-VL, check gateway status
        if (modelKey === 'lfm2vl' && window.ImageDescriberAnalyserTransformers) {
            var lfm2vlGateway = window.ImageDescriberAnalyserTransformers;
            if (typeof lfm2vlGateway.getLfm2VlStatus === 'function') {
                var lfm2vlStatus = lfm2vlGateway.getLfm2VlStatus();
                if (lfm2vlStatus === 'ready') {
                    modelStates[modelKey] = 'loaded';
                    return 'loaded';
                }
                if (lfm2vlStatus === 'loading') {
                    modelStates[modelKey] = 'loading';
                    return 'loading';
                }
            }
        }

        return modelStates[modelKey] || 'not-downloaded';
    }

    // ========================================================================
    // STORAGE INSPECTION
    // ========================================================================

    /**
     * Returns browser storage quota information.
     * @returns {Promise<{ quotaMB: number, usedMB: number, availableMB: number, persistent: boolean }>}
     */
    async function getStorageStatus() {
        var result = {
            quotaMB: 0,
            usedMB: 0,
            availableMB: 0,
            persistent: false
        };

        try {
            if (navigator.storage && navigator.storage.estimate) {
                var estimate = await navigator.storage.estimate();
                result.quotaMB = Math.round((estimate.quota || 0) / (1024 * 1024));
                result.usedMB = Math.round((estimate.usage || 0) / (1024 * 1024));
                result.availableMB = result.quotaMB - result.usedMB;
            }

            if (navigator.storage && navigator.storage.persisted) {
                result.persistent = await navigator.storage.persisted();
            }
        } catch (err) {
            logError('Failed to get storage status:', err.message || err);
        }

        return result;
    }

    /**
     * Requests persistent storage from the browser.
     * @returns {Promise<boolean>} Whether persistence was granted
     */
    async function requestPersistentStorage() {
        try {
            if (navigator.storage && navigator.storage.persist) {
                var granted = await navigator.storage.persist();
                logInfo('Persistent storage ' + (granted ? 'granted' : 'denied'));
                return granted;
            }
            logWarn('Persistent storage API not available');
            return false;
        } catch (err) {
            logError('Failed to request persistent storage:', err.message || err);
            return false;
        }
    }

    // ========================================================================
    // CACHE API INSPECTION
    // ========================================================================

    /**
     * The cache name used by Transformers.js for ONNX model files.
     * Transformers.js v3.x uses 'transformers-cache' by default.
     */
    var TRANSFORMERS_CACHE_NAME = 'transformers-cache';

    /**
     * Inspects the Cache API to find cached model files.
     * Groups files by model based on URL prefix matching.
     * @returns {Promise<Map<string, { files: number, totalBytes: number }>>}
     */
    async function getCachedModels() {
        var result = new Map();

        try {
            var cache = await caches.open(TRANSFORMERS_CACHE_NAME);
            var requests = await cache.keys();

            for (var i = 0; i < requests.length; i++) {
                var url = requests[i].url;
                var matchedKey = matchUrlToModel(url);
                if (matchedKey) {
                    var entry = result.get(matchedKey) || { files: 0, totalBytes: 0 };
                    entry.files++;
                    // Attempt to get the response size
                    try {
                        var response = await cache.match(requests[i]);
                        if (response) {
                            var blob = await response.clone().blob();
                            entry.totalBytes += blob.size;
                        }
                    } catch (sizeErr) {
                        logDebug('Could not get size for ' + url);
                    }
                    result.set(matchedKey, entry);
                }
            }
        } catch (err) {
            logError('Failed to inspect Cache API:', err.message || err);
        }

        return result;
    }

    /**
     * Match a cached URL to a model key using cachePrefix.
     * @param {string} url
     * @returns {string|null} Model key or null
     */
    function matchUrlToModel(url) {
        for (var i = 0; i < MODEL_REGISTRY.length; i++) {
            var model = MODEL_REGISTRY[i];
            if (model.cachePrefix && url.indexOf(model.cachePrefix) !== -1) {
                return model.key;
            }
        }
        return null;
    }

    /**
     * Returns total bytes across all cached Transformers.js models.
     * @returns {Promise<number>}
     */
    async function getCacheSize() {
        var cachedModels = await getCachedModels();
        var total = 0;
        cachedModels.forEach(function (entry) {
            total += entry.totalBytes;
        });
        return total;
    }

    /**
     * Synchronise model states from Cache API.
     * Models with cached files but not loaded get state 'cached'.
     * @returns {Promise<void>}
     */
    async function syncStatesFromCache() {
        try {
            var cachedModels = await getCachedModels();
            cachedModels.forEach(function (entry, modelKey) {
                var currentState = modelStates[modelKey];
                // Only promote from not-downloaded to cached
                if (currentState === 'not-downloaded' && entry.files > 0) {
                    setState(modelKey, 'cached');
                }
            });
            logDebug('State sync from Cache API complete');
        } catch (err) {
            logWarn('Cache state sync failed — states may be stale:', err.message || err);
        }
    }

    // ========================================================================
    // DOWNLOAD MANAGEMENT
    // ========================================================================

    /**
     * Pre-downloads a model into Cache API without loading into memory.
     * Uses Transformers.js library to trigger the download (which auto-caches).
     *
     * @param {string} modelKey
     * @param {function} [onProgress] — callback({ file, loaded, total, status })
     * @returns {Promise<void>}
     */
    async function preDownloadModel(modelKey, onProgress) {
        var model = findModel(modelKey);
        if (!model) {
            throw new Error('Unknown model key: ' + modelKey);
        }
        if (!model.enabled) {
            throw new Error('Model "' + modelKey + '" is not enabled');
        }
        setState(modelKey, 'downloading');

        try {
            // Text model routing — delegate to LocalTextModelGateway
            if (model.type === 'text') {
                var textGateway = window.LocalTextModelGateway;
                if (!textGateway) {
                    throw new Error('LocalTextModelGateway not available for text model: ' + modelKey);
                }
                await textGateway.preDownloadModel(modelKey, onProgress);
                setState(modelKey, 'cached');
                return;
            }

            var gateway = window.ImageDescriberAnalyserTransformers;
            if (!gateway) {
                throw new Error('Transformers.js gateway not available');
            }

            await gateway.ensureLibrary();

            // For pipeline-based models, use pipeline() which auto-downloads and caches
            if (model.task) {
                await gateway.loadPipeline(model.task, model.modelId);
                // After download+load, unload from memory (we only wanted to cache)
                // The pipeline is now cached by the gateway — leave it loaded
                // (no point unloading just to reload later)
                setState(modelKey, 'loaded');
            } else if (modelKey === 'florence2' && typeof gateway.ensureFlorence === 'function') {
                // Florence-2 uses ensureFlorence() from Phase 10A gateway
                await gateway.ensureFlorence({
                    progressCallback: onProgress || null,
                });
                setState(modelKey, 'loaded');
            } else if (modelKey === 'fastvlm' && typeof gateway.ensureFastVLM === 'function') {
                // FastVLM uses ensureFastVLM() from Phase 13A gateway
                await gateway.ensureFastVLM({
                    progressCallback: onProgress || null,
                });
                setState(modelKey, 'loaded');
            } else if (modelKey === 'qwen35' && typeof gateway.ensureQwen === 'function') {
                // Qwen3.5 uses ensureQwen() from Phase 14A gateway
                await gateway.ensureQwen({
                    progressCallback: onProgress || null,
                });
                setState(modelKey, 'loaded');
            } else if (modelKey === 'lfm2vl' && typeof gateway.ensureLfm2Vl === 'function') {
                // LFM2-VL uses ensureLfm2Vl() from Phase 15A gateway
                await gateway.ensureLfm2Vl({
                    progressCallback: onProgress || null,
                });
                setState(modelKey, 'loaded');
            } else {
                logWarn('Pre-download for "' + modelKey + '" — no download method available');
                setState(modelKey, 'not-downloaded');
            }
        } catch (err) {
            logError('Pre-download failed for "' + modelKey + '":', err.message || err);
            setState(modelKey, 'download-error');
            throw err;
        }
    }

    /**
     * Cancels an in-progress download.
     * @param {string} modelKey
     */
    function cancelDownload(modelKey) {
        var controller = downloadAbortControllers[modelKey];
        if (controller) {
            controller.abort();
            delete downloadAbortControllers[modelKey];
            setState(modelKey, 'not-downloaded');
            logInfo('Download cancelled for "' + modelKey + '"');
        } else {
            logWarn('No active download to cancel for "' + modelKey + '"');
        }
    }

    /**
     * Removes cached model files from Cache API.
     * @param {string} modelKey
     * @returns {Promise<{ removedCount: number, removedBytes: number }>}
     */
    async function removeCachedModel(modelKey) {
        var model = findModel(modelKey);
        if (!model || !model.cachePrefix) {
            logWarn('Cannot remove — no cache prefix for "' + modelKey + '"');
            return { removedCount: 0, removedBytes: 0 };
        }

        // Unload from memory first if loaded
        if (modelStates[modelKey] === 'loaded') {
            await unloadModel(modelKey);
        }

        // Text model routing — delegate to LocalTextModelGateway
        if (model.type === 'text') {
            var textGateway = window.LocalTextModelGateway;
            if (!textGateway) {
                logWarn('LocalTextModelGateway not available — cannot remove text model cache');
                return { removedCount: 0, removedBytes: 0 };
            }
            var result = await textGateway.removeCachedModel(modelKey);
            setState(modelKey, 'not-downloaded');
            logInfo('Removed cached text model "' + modelKey + '"');
            return result;
        }

        var removedCount = 0;
        var removedBytes = 0;

        try {
            var cache = await caches.open(TRANSFORMERS_CACHE_NAME);
            var requests = await cache.keys();

            for (var i = 0; i < requests.length; i++) {
                var url = requests[i].url;
                if (url.indexOf(model.cachePrefix) !== -1) {
                    // Get size before deleting
                    try {
                        var response = await cache.match(requests[i]);
                        if (response) {
                            var blob = await response.clone().blob();
                            removedBytes += blob.size;
                        }
                    } catch (sizeErr) {
                        // Size unknown — still delete
                    }
                    await cache.delete(requests[i]);
                    removedCount++;
                }
            }

            setState(modelKey, 'not-downloaded');
            logInfo('Removed ' + removedCount + ' cached files for "' + modelKey +
                '" (' + Math.round(removedBytes / (1024 * 1024)) + ' MB)');
        } catch (err) {
            logError('Failed to remove cached model "' + modelKey + '":', err.message || err);
        }

        return { removedCount: removedCount, removedBytes: removedBytes };
    }

    // ========================================================================
    // MEMORY MANAGEMENT (LOAD / UNLOAD)
    // ========================================================================

    /**
     * Loads a cached model into memory via the gateway.
     * @param {string} modelKey
     * @returns {Promise<void>}
     */
    async function loadModel(modelKey) {
        var model = findModel(modelKey);
        if (!model) {
            throw new Error('Unknown model key: ' + modelKey);
        }
        if (!model.enabled) {
            throw new Error('Model "' + modelKey + '" is not enabled');
        }

        setState(modelKey, 'loading');

        try {
            // Text model routing — delegate to LocalTextModelGateway
            if (model.type === 'text') {
                var textGateway = window.LocalTextModelGateway;
                if (!textGateway) {
                    throw new Error('LocalTextModelGateway not available for text model: ' + modelKey);
                }
                await textGateway.ensureModel(modelKey);
                setState(modelKey, 'loaded');
                logInfo('Text model "' + modelKey + '" loaded into memory');
                return;
            }

            var gateway = window.ImageDescriberAnalyserTransformers;
            if (!gateway) {
                throw new Error('Transformers.js gateway not available');
            }

            if (model.task) {
                await gateway.loadPipeline(model.task, model.modelId);
                setState(modelKey, 'loaded');
                logInfo('Model "' + modelKey + '" loaded into memory');
            } else if (modelKey === 'florence2' && typeof gateway.ensureFlorence === 'function') {
                await gateway.ensureFlorence();
                setState(modelKey, 'loaded');
                logInfo('Model "' + modelKey + '" loaded into memory');
            } else if (modelKey === 'fastvlm' && typeof gateway.ensureFastVLM === 'function') {
                await gateway.ensureFastVLM();
                setState(modelKey, 'loaded');
                logInfo('Model "' + modelKey + '" loaded into memory');
            } else if (modelKey === 'qwen35' && typeof gateway.ensureQwen === 'function') {
                await gateway.ensureQwen();
                setState(modelKey, 'loaded');
                logInfo('Model "' + modelKey + '" loaded into memory');
            } else if (modelKey === 'lfm2vl' && typeof gateway.ensureLfm2Vl === 'function') {
                await gateway.ensureLfm2Vl();
                setState(modelKey, 'loaded');
                logInfo('Model "' + modelKey + '" loaded into memory');
            } else {
                logWarn('loadModel for "' + modelKey + '" — no load method available');
                setState(modelKey, 'cached');
            }
        } catch (err) {
            logError('Failed to load "' + modelKey + '":', err.message || err);
            setState(modelKey, 'load-error');
            throw err;
        }
    }

    /**
     * Unloads a model from memory (keeps cached files on disk).
     * For CLIP/Depth, this destroys the gateway pipeline.
     * @param {string} modelKey
     * @returns {Promise<void>}
     */
    async function unloadModel(modelKey) {
        var model = findModel(modelKey);
        if (!model) {
            logWarn('unloadModel: unknown model key "' + modelKey + '"');
            return;
        }

        // Text model routing — delegate to LocalTextModelGateway
        if (model.type === 'text') {
            var textGateway = window.LocalTextModelGateway;
            if (!textGateway) {
                logWarn('LocalTextModelGateway not available — cannot unload text model');
                return;
            }
            await textGateway.unloadModel(modelKey);
            setState(modelKey, 'cached');
            logInfo('Text model "' + modelKey + '" unloaded');
            return;
        }

        var gateway = window.ImageDescriberAnalyserTransformers;
        if (!gateway) {
            logWarn('Gateway not available — cannot unload');
            return;
        }

        // Destroy the entire gateway (clears all pipelines)
        // In the future, the gateway could support per-pipeline disposal
        // For now, destroy() is the only option
        await gateway.destroy();

        // Mark all loaded vision models as cached (still on disk, not in memory)
        // Text models are unloaded individually, so skip them here
        for (var i = 0; i < MODEL_REGISTRY.length; i++) {
            var entry = MODEL_REGISTRY[i];
            if (modelStates[entry.key] === 'loaded' && entry.type !== 'text') {
                setState(entry.key, 'cached');
            }
        }

        logInfo('Model "' + modelKey + '" unloaded (gateway destroyed — all pipelines cleared)');
    }

    // ========================================================================
    // ANALYSIS CACHE INTEGRATION (IndexedDB)
    // ========================================================================

    /**
     * Returns statistics about the IndexedDB analysis cache.
     * Delegates to ImageDescriberCache.getStats().
     * @returns {Promise<{ imageCount: number, totalBytes: number }>}
     */
    async function getAnalysisCacheStats() {
        if (!window.ImageDescriberCache) {
            return { imageCount: 0, totalBytes: 0 };
        }
        try {
            var stats = await window.ImageDescriberCache.getStats();
            return {
                imageCount: stats.count || 0,
                totalBytes: stats.totalBytes || 0
            };
        } catch (err) {
            logError('Failed to get analysis cache stats:', err.message || err);
            return { imageCount: 0, totalBytes: 0 };
        }
    }

    /**
     * Clears all IndexedDB analysis cache records.
     * Delegates to ImageDescriberCache.clear().
     * @returns {Promise<void>}
     */
    async function clearAnalysisCache() {
        if (!window.ImageDescriberCache) {
            logWarn('Analysis cache module not available');
            return;
        }
        try {
            await window.ImageDescriberCache.clear();
            logInfo('Analysis cache cleared');
        } catch (err) {
            logError('Failed to clear analysis cache:', err.message || err);
            throw err;
        }
    }

    // ========================================================================
    // INITIALISATION
    // ========================================================================

    initStates();

    // Async state sync — fire and forget
    syncStatesFromCache().catch(function (err) {
        logWarn('Initial cache sync failed:', err.message || err);
    });

    // Listen for gateway pipeline loads so UI stays in sync.
    // When the analyser auto-loads a cached model (e.g. CLIP, Depth),
    // the gateway emits library:status "ready" but the Model Manager
    // state was still "cached". This promotes it to "loaded" and the
    // UI row updates automatically via model:stateChange.
    if (window.EmbedEventEmitter) {
        // Map library IDs to model keys
        var LIBRARY_TO_KEY = {};
        for (var ri = 0; ri < MODEL_REGISTRY.length; ri++) {
            var entry = MODEL_REGISTRY[ri];
            // Pipeline-based models use modelId → library mapping in gateway;
            // the library ID happens to match the model key for clip, depth, florence2
            LIBRARY_TO_KEY[entry.key] = entry.key;
        }
        window.EmbedEventEmitter.on('library:status', function (data) {
            if (!data || !data.library || !data.status) return;
            var modelKey = LIBRARY_TO_KEY[data.library];
            if (!modelKey) return;
            if (data.status === 'ready' && modelStates[modelKey] !== 'loaded') {
                setState(modelKey, 'loaded');
            }
        });
    }

    logDebug('Module loaded');

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    return {
        // Registry access
        getRegisteredModels: getRegisteredModels,
        getModelState: getModelState,

        // Storage inspection
        getStorageStatus: getStorageStatus,
        requestPersistentStorage: requestPersistentStorage,

        // Download management
        preDownloadModel: preDownloadModel,
        cancelDownload: cancelDownload,
        removeCachedModel: removeCachedModel,

        // Memory management
        loadModel: loadModel,
        unloadModel: unloadModel,

        // Cache inspection (Cache API — model files)
        getCachedModels: getCachedModels,
        getCacheSize: getCacheSize,

        // Analysis cache (IndexedDB)
        getAnalysisCacheStats: getAnalysisCacheStats,
        clearAnalysisCache: clearAnalysisCache
    };
})();
