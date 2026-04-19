/**
 * Local GPU Monitor (DE-4a)
 *
 * Tracks which models are currently loaded in GPU memory across both
 * text and VLM systems. Provides inventory, memory estimates, and
 * safety checks before loading additional models.
 *
 * Dependencies:
 *   - EmbedEventEmitter (optional, for event listening)
 *   - LocalTextModelRegistry (for model lookups)
 *   - LocalTextModelGateway (for GPU detection)
 *
 * @author Matthew Deeprose
 */
window.LocalGPUMonitor = (function () {

    // ========================================================================
    // LOGGING CONFIGURATION
    // ========================================================================

    var LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
    var DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
    var ENABLE_ALL_LOGGING = false;
    var DISABLE_ALL_LOGGING = false;
    var PREFIX = '[LocalGPUMonitor]';

    function shouldLog(level) {
        if (DISABLE_ALL_LOGGING) return false;
        if (ENABLE_ALL_LOGGING) return true;
        return level <= DEFAULT_LOG_LEVEL;
    }

    function logError(message) {
        if (shouldLog(LOG_LEVELS.ERROR)) {
            var args = [PREFIX + ' ' + message];
            for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
            console.error.apply(console, args);
        }
    }

    function logWarn(message) {
        if (shouldLog(LOG_LEVELS.WARN)) {
            var args = [PREFIX + ' ' + message];
            for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
            console.warn.apply(console, args);
        }
    }

    function logInfo(message) {
        if (shouldLog(LOG_LEVELS.INFO)) {
            var args = [PREFIX + ' ' + message];
            for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
            console.log.apply(console, args);
        }
    }

    function logDebug(message) {
        if (shouldLog(LOG_LEVELS.DEBUG)) {
            var args = [PREFIX + ' ' + message];
            for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
            console.log.apply(console, args);
        }
    }

    // ========================================================================
    // STATE
    // ========================================================================

    /** @type {Map<string, {key: string, engine: string, category: string, displayName: string, estimatedMB: number}>} */
    var inventory = new Map();

    /** @type {Array<function>} Update callbacks */
    var updateCallbacks = [];

    // ========================================================================
    // HELPERS
    // ========================================================================

    /**
     * Classify a model key as 'text' or 'vision'.
     * Checks the text model registry first; if not found, assumes VLM.
     * @param {string} modelKey
     * @returns {string} 'text' or 'vision'
     */
    function classifyCategory(modelKey) {
        var registry = window.LocalTextModelRegistry;
        if (registry && registry.getModel(modelKey)) {
            return 'text';
        }
        return 'vision';
    }

    /**
     * Look up display name and estimated MB for a model key.
     * @param {string} modelKey
     * @param {string} category
     * @returns {{displayName: string, estimatedMB: number}}
     */
    function getModelInfo(modelKey, category) {
        var displayName = modelKey;
        var estimatedMB = 0;

        if (category === 'text') {
            var registry = window.LocalTextModelRegistry;
            if (registry) {
                var modelDef = registry.getModel(modelKey);
                if (modelDef && modelDef.userInfo) {
                    displayName = modelDef.userInfo.displayName || modelKey;
                    estimatedMB = modelDef.userInfo.downloadSizeMB || 0;
                }
            }
        } else if (category === 'tts') {
            // TTS models — query TTSNeuralGateway registry
            if (window.TTSNeuralGateway) {
                var ttsModels = window.TTSNeuralGateway.getRegisteredModels();
                for (var t = 0; t < ttsModels.length; t++) {
                    if (ttsModels[t].key === modelKey) {
                        displayName = ttsModels[t].name || modelKey;
                        estimatedMB = 80; // ~80 MB GPU memory when loaded via WebGPU
                        break;
                    }
                }
            }
        }
        // VLM models: use defaults — no guaranteed registry access

        return { displayName: displayName, estimatedMB: estimatedMB };
    }

    /**
     * Notify all registered update callbacks.
     */
    function notifyListeners() {
        var models = getLoadedModels();
        for (var i = 0; i < updateCallbacks.length; i++) {
            try {
                updateCallbacks[i](models);
            } catch (error) {
                logError('Update callback error:', error);
            }
        }
    }

    // ========================================================================
    // EVENT HANDLING
    // ========================================================================

    /**
     * Handle model:stateChange events from text and VLM managers.
     * @param {object} data - Event data
     */
    function handleStateChange(data) {
        if (!data || !data.modelKey) return;

        var key = data.modelKey;
        var newState = data.newState;
        var category = data.category || classifyCategory(key);
        var engine = data.engine || 'unknown';

        if (newState === 'loaded') {
            var info = getModelInfo(key, category);
            inventory.set(key, {
                key: key,
                engine: engine,
                category: category,
                displayName: info.displayName,
                estimatedMB: info.estimatedMB
            });
            logDebug('Added to inventory: ' + key + ' (' + category + ')');
            notifyListeners();
        } else if (inventory.has(key)) {
            inventory.delete(key);
            logDebug('Removed from inventory: ' + key);
            notifyListeners();
        }
    }

    // Subscribe to state change events
    if (window.EmbedEventEmitter) {
        window.EmbedEventEmitter.on('model:stateChange', handleStateChange);
        logDebug('Subscribed to model:stateChange events');
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Returns an array of all currently loaded models.
     * @returns {Array<{key: string, engine: string, category: string, displayName: string, estimatedMB: number}>}
     */
    function getLoadedModels() {
        var result = [];
        inventory.forEach(function (entry) {
            result.push(Object.assign({}, entry));
        });
        return result;
    }

    /**
     * Returns total estimated GPU memory usage in MB.
     * @returns {number}
     */
    function getTotalEstimatedMB() {
        var total = 0;
        inventory.forEach(function (entry) {
            total += entry.estimatedMB || 0;
        });
        return total;
    }

    /**
     * Check whether it is safe to load a model given current GPU state.
     * Warns on integrated GPUs when other models are already loaded.
     * @param {string} key - Model key to check
     * @returns {{safe: boolean, warning: string|null, loaded: Array}}
     */
    function checkBeforeLoad(key) {
        var loaded = getLoadedModels();
        var gateway = window.LocalTextModelGateway;

        if (!gateway || typeof gateway.detectGPU !== 'function') {
            return { safe: true, warning: null, loaded: loaded };
        }

        // detectGPU is async but may have a cached result
        // Return a synchronous best-effort check using cached GPU info
        // For async callers, wrap in Promise
        var result = { safe: true, warning: null, loaded: loaded };

        // Use a synchronous wrapper — detectGPU caches after first call
        gateway.detectGPU().then(function (gpuInfo) {
            if (!gpuInfo.isDiscrete && loaded.length > 0) {
                result.safe = false;
                result.warning = 'Integrated GPU detected with ' + loaded.length +
                    ' model(s) already loaded. Loading another model may cause performance issues or out-of-memory errors.';
            }
        }).catch(function () {
            // If GPU detection fails, allow loading
        });

        return result;
    }

    /**
     * Async version of checkBeforeLoad for callers that can await.
     * @param {string} key - Model key to check
     * @returns {Promise<{safe: boolean, warning: string|null, loaded: Array}>}
     */
    async function checkBeforeLoadAsync(key) {
        var loaded = getLoadedModels();
        var gateway = window.LocalTextModelGateway;

        if (!gateway || typeof gateway.detectGPU !== 'function') {
            return { safe: true, warning: null, loaded: loaded };
        }

        try {
            var gpuInfo = await gateway.detectGPU();
            if (!gpuInfo.isDiscrete && loaded.length > 0) {
                return {
                    safe: false,
                    warning: 'Integrated GPU detected with ' + loaded.length +
                        ' model(s) already loaded. Loading another model may cause performance issues or out-of-memory errors.',
                    loaded: loaded
                };
            }
        } catch (error) {
            logWarn('GPU detection failed during load check:', error);
        }

        return { safe: true, warning: null, loaded: loaded };
    }

    /**
     * Register a callback for inventory changes.
     * @param {function} callback - Called with current loaded models array
     * @returns {function} Unsubscribe function
     */
    function onUpdate(callback) {
        if (typeof callback !== 'function') {
            logWarn('onUpdate requires a function callback');
            return function () {};
        }
        updateCallbacks.push(callback);

        return function () {
            var idx = updateCallbacks.indexOf(callback);
            if (idx !== -1) {
                updateCallbacks.splice(idx, 1);
            }
        };
    }

    return {
        getLoadedModels: getLoadedModels,
        getTotalEstimatedMB: getTotalEstimatedMB,
        checkBeforeLoad: checkBeforeLoadAsync,
        onUpdate: onUpdate
    };

})();
