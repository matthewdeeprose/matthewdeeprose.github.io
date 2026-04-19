/**
 * Local Text Model Manager (DE-3)
 * Business logic layer for text model lifecycle management.
 * Routes operations to the correct engine (ONNX or WebLLM) based on registry.
 * @author Matthew Deeprose
 */
window.LocalTextModelManager = (function () {

    // Logging configuration
    var LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
    var DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
    var ENABLE_ALL_LOGGING = false;
    var DISABLE_ALL_LOGGING = false;
    var PREFIX = '[TextModelManager]';

    function shouldLog(level) {
        if (DISABLE_ALL_LOGGING) return false;
        if (ENABLE_ALL_LOGGING) return true;
        return level <= DEFAULT_LOG_LEVEL;
    }
    function logError() { if (shouldLog(LOG_LEVELS.ERROR)) { var a = Array.prototype.slice.call(arguments); a[0] = PREFIX + ' ' + a[0]; console.error.apply(console, a); } }
    function logWarn()  { if (shouldLog(LOG_LEVELS.WARN))  { var a = Array.prototype.slice.call(arguments); a[0] = PREFIX + ' ' + a[0]; console.warn.apply(console, a); } }
    function logInfo()  { if (shouldLog(LOG_LEVELS.INFO))  { var a = Array.prototype.slice.call(arguments); a[0] = PREFIX + ' ' + a[0]; console.log.apply(console, a); } }
    function logDebug() { if (shouldLog(LOG_LEVELS.DEBUG)) { var a = Array.prototype.slice.call(arguments); a[0] = PREFIX + ' ' + a[0]; console.log.apply(console, a); } }

    // Dependencies
    var registry = window.LocalTextModelRegistry;
    var gateway = window.LocalTextModelGateway;
    var webllm = window.WebLLMTextEngine;

    // State
    var modelStates = new Map();
    var loadedModelKey = null;

    // Event emission
    function emitEvent(eventName, data) {
        if (window.EmbedEventEmitter) {
            window.EmbedEventEmitter.emit(eventName, data);
        }
    }

    function setState(key, newState) {
        var oldState = modelStates.get(key) || 'not-downloaded';
        if (oldState === newState) return;
        modelStates.set(key, newState);
        var modelDef = registry ? registry.getModel(key) : null;
        logDebug('State: ' + key + ' ' + oldState + ' → ' + newState);
        emitEvent('model:stateChange', {
            modelKey: key,
            newState: newState,
            engine: modelDef ? modelDef.engine : 'unknown',
            category: 'text'
        });
    }

    // Helpers
    function requireModel(key) {
        if (!registry) throw new Error('LocalTextModelRegistry not available');
        var modelDef = registry.getModel(key);
        if (!modelDef) throw new Error('Model not found in registry: ' + key);
        return modelDef;
    }

    function isWebLLM(modelDef) {
        return modelDef.engine === 'webllm';
    }

    // Registry access
    function getRegisteredModels() {
        if (!registry) return [];
        return registry.getAll().map(function (entry) {
            return Object.assign({}, entry, {
                state: modelStates.get(entry.key) || 'not-downloaded'
            });
        });
    }

    function getModelState(key) {
        return modelStates.get(key) || 'not-downloaded';
    }

    // Pre-download
    async function preDownloadModel(key, onProgress) {
        var modelDef = requireModel(key);
        var currentState = getModelState(key);

        if (currentState === 'downloading') {
            logWarn('Already downloading: ' + key);
            return;
        }
        if (currentState === 'cached' || currentState === 'loaded') {
            logInfo('Already available: ' + key + ' (' + currentState + ')');
            return;
        }

        setState(key, 'downloading');

        try {
            if (isWebLLM(modelDef)) {
                // WebLLM has no download-only API — load then unload
                await webllm.loadModel(modelDef.mlcModelId, onProgress);
                await webllm.unloadModel();
            } else {
                await gateway.preDownloadModel(key, onProgress);
            }
            setState(key, 'cached');
        } catch (error) {
            setState(key, 'download-error');
            logError('Pre-download failed for ' + key + ':', error);
            throw error;
        }
    }

    // Cancel download
    function cancelDownload(key) {
        var modelDef = requireModel(key);
        var currentState = getModelState(key);

        if (currentState !== 'downloading') {
            logWarn('Cannot cancel — not downloading: ' + key);
            return;
        }

        if (!isWebLLM(modelDef)) {
            gateway.cancelDownload(key);
        }
        // WebLLM has no cancel-download API; the load will complete or fail

        setState(key, 'not-downloaded');
    }

    // Load model — unloads any currently loaded text model first
    async function loadModel(key) {
        var modelDef = requireModel(key);

        // Unload any currently loaded text model (may be different engine)
        if (loadedModelKey && loadedModelKey !== key) {
            logInfo('Unloading ' + loadedModelKey + ' before loading ' + key);
            await unloadModel(loadedModelKey);
        }

        setState(key, 'loading');

        try {
            if (isWebLLM(modelDef)) {
                await webllm.loadModel(modelDef.mlcModelId);
            } else {
                await gateway.ensureModel(key);
            }
            loadedModelKey = key;
            setState(key, 'loaded');
        } catch (error) {
            setState(key, 'load-error');
            logError('Load failed for ' + key + ':', error);
            throw error;
        }
    }

    // Unload model
    async function unloadModel(key) {
        var modelDef = requireModel(key);

        try {
            if (isWebLLM(modelDef)) {
                await webllm.unloadModel();
            } else {
                await gateway.unloadModel(key);
            }
        } catch (error) {
            logWarn('Error during unload of ' + key + ':', error);
        }

        if (loadedModelKey === key) {
            loadedModelKey = null;
        }

        // Transition to cached (model files still in cache)
        setState(key, 'cached');
    }

    // Cache management
    async function removeCachedModel(key) {
        var modelDef = requireModel(key);

        // Unload first if currently loaded
        if (loadedModelKey === key) {
            await unloadModel(key);
        }

        var result;
        try {
            if (isWebLLM(modelDef)) {
                result = await webllm.removeCachedModel(modelDef.mlcModelId);
            } else {
                result = await gateway.removeCachedModel(key);
            }
        } catch (error) {
            logError('Failed to remove cached model ' + key + ':', error);
            throw error;
        }

        setState(key, 'not-downloaded');
        return result || { removedCount: 0, removedBytes: 0 };
    }

    async function clearAllTextModelCache() {
        // Unload any loaded model first
        if (loadedModelKey) {
            await unloadModel(loadedModelKey);
        }

        var errors = [];

        try {
            if (gateway && typeof gateway.getCacheSize === 'function') {
                // Remove each ONNX model individually to track state
                var onnxModels = registry.getModelsByEngine('onnx');
                for (var i = 0; i < onnxModels.length; i++) {
                    try {
                        await gateway.removeCachedModel(onnxModels[i].key);
                        setState(onnxModels[i].key, 'not-downloaded');
                    } catch (e) {
                        errors.push(e);
                    }
                }
            }
        } catch (e) {
            errors.push(e);
        }

        try {
            if (webllm && typeof webllm.clearAllCache === 'function') {
                await webllm.clearAllCache();
                var webllmModels = registry.getModelsByEngine('webllm');
                for (var j = 0; j < webllmModels.length; j++) {
                    setState(webllmModels[j].key, 'not-downloaded');
                }
            }
        } catch (e) {
            errors.push(e);
        }

        if (errors.length > 0) {
            logWarn('Some cache clear operations failed:', errors);
        }

        logInfo('All text model caches cleared');
    }

    // Storage inspection — combined status across both engines
    async function getStorageStatus() {
        var totalBytes = 0;
        var modelBreakdown = new Map();

        try {
            if (gateway && typeof gateway.getCacheSize === 'function') {
                var onnxSize = await gateway.getCacheSize();
                totalBytes += onnxSize.totalBytes || 0;
                if (onnxSize.models) {
                    onnxSize.models.forEach(function (bytes, modelId) {
                        modelBreakdown.set(modelId, bytes);
                    });
                }
            }
        } catch (e) {
            logWarn('Failed to get ONNX cache size:', e);
        }

        try {
            if (webllm && typeof webllm.getCacheSize === 'function') {
                var webllmSize = await webllm.getCacheSize();
                totalBytes += webllmSize.totalBytes || 0;
                if (webllmSize.models) {
                    // WebLLM returns models as a plain object, not a Map
                    var modelKeys = Object.keys(webllmSize.models);
                    for (var k = 0; k < modelKeys.length; k++) {
                        modelBreakdown.set(modelKeys[k], webllmSize.models[modelKeys[k]]);
                    }
                }
            }
        } catch (e) {
            logWarn('Failed to get WebLLM cache size:', e);
        }

        return { totalBytes: totalBytes, modelBreakdown: modelBreakdown };
    }

    // GPU status — returns info about the currently loaded text model, or null
    function getGPUStatus() {
        if (!loadedModelKey) return null;

        var modelDef = registry ? registry.getModel(loadedModelKey) : null;
        if (!modelDef) return null;

        return {
            loadedModelKey: loadedModelKey,
            engine: modelDef.engine,
            displayName: modelDef.userInfo ? modelDef.userInfo.displayName : loadedModelKey,
            estimatedMB: modelDef.userInfo ? modelDef.userInfo.downloadSizeMB : 0
        };
    }

    // Persistent storage
    async function requestPersistentStorage() {
        if (navigator.storage && navigator.storage.persist) {
            try {
                var granted = await navigator.storage.persist();
                logInfo('Persistent storage ' + (granted ? 'granted' : 'denied'));
                return granted;
            } catch (error) {
                logWarn('Persistent storage request failed:', error);
                return false;
            }
        }
        logWarn('Persistent storage API not available');
        return false;
    }

    // Initialisation — check cache status for all registered models
    async function initialiseCacheStatus() {
        if (!registry) {
            logWarn('Registry not available — skipping cache status init');
            return;
        }

        var allModels = registry.getAll();
        logDebug('Checking cache status for ' + allModels.length + ' models');

        for (var i = 0; i < allModels.length; i++) {
            var model = allModels[i];
            try {
                var isCached = false;

                if (isWebLLM(model)) {
                    if (webllm && typeof webllm.isModelCached === 'function') {
                        isCached = await webllm.isModelCached(model.mlcModelId);
                    }
                } else {
                    if (gateway && typeof gateway.isModelCached === 'function') {
                        isCached = await gateway.isModelCached(model.key);
                    }
                }

                if (isCached) {
                    setState(model.key, 'cached');
                    logDebug('Found cached: ' + model.key);
                }
            } catch (error) {
                logDebug('Cache check failed for ' + model.key + ':', error);
            }
        }

        logInfo('Cache status initialisation complete');
    }

    // Kick off async initialisation
    initialiseCacheStatus();

    return {
        getRegisteredModels: getRegisteredModels,
        getModelState: getModelState,
        preDownloadModel: preDownloadModel,
        cancelDownload: cancelDownload,
        loadModel: loadModel,
        unloadModel: unloadModel,
        removeCachedModel: removeCachedModel,
        getStorageStatus: getStorageStatus,
        getGPUStatus: getGPUStatus,
        clearAllTextModelCache: clearAllTextModelCache,
        requestPersistentStorage: requestPersistentStorage
    };

})();
