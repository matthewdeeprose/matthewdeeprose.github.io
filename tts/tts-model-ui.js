/**
 * ===================================================================
 * TTS MODEL UI — Phase 4 (C6)
 * ===================================================================
 *
 * Binds TTS model card HTML (in tools.html) to the
 * TTSNeuralGateway backend (tts-neural-gateway.js).
 *
 * Responsibilities:
 *   - Refresh TTS model state display in Set Up tool
 *   - Render action buttons per model state
 *   - Listen for model:stateChange events (category === 'tts')
 *   - Expose global onclick handlers for inline buttons
 *   - Cache removal via transformers-cache Cache API
 *
 * Architecture: IIFE with window globals for onclick handlers.
 * No NPM — pure browser JS loaded via <script> tag.
 *
 * VERSION: 1.0.0
 * DATE: 12 April 2026
 * PHASE: Phase 4 — Set Up Model Cards (C6)
 * ===================================================================
 */

/* global TTSNeuralGateway, LocalGPUMonitor, EmbedEventEmitter, getIcon, safeConfirm */

(function () {
    "use strict";

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
            console.error.apply(console, ["[TTSModelUI] " + message].concat(args));
        }
    }

    function logWarn(message) {
        if (shouldLog(LOG_LEVELS.WARN)) {
            var args = Array.prototype.slice.call(arguments, 1);
            console.warn.apply(console, ["[TTSModelUI] " + message].concat(args));
        }
    }

    function logInfo(message) {
        if (shouldLog(LOG_LEVELS.INFO)) {
            var args = Array.prototype.slice.call(arguments, 1);
            console.log.apply(console, ["[TTSModelUI] " + message].concat(args));
        }
    }

    function logDebug(message) {
        if (shouldLog(LOG_LEVELS.DEBUG)) {
            var args = Array.prototype.slice.call(arguments, 1);
            console.log.apply(console, ["[TTSModelUI] " + message].concat(args));
        }
    }

    // ========================================================================
    // CONSTANTS
    // ========================================================================

    var CACHE_NAME = "transformers-cache";
    var CARD_ID_PREFIX = "setup-tts-model-";

    // ========================================================================
    // CACHED DOM ELEMENTS
    // ========================================================================

    /** @type {Object<string, {card: HTMLElement, icon: HTMLElement, stateText: HTMLElement, actions: HTMLElement, progress: HTMLElement, progressFill: HTMLElement, progressBar: HTMLElement, progressText: HTMLElement, progressDetail: HTMLElement}>} */
    var cardEls = {};

    /**
     * Cache DOM elements for all TTS model cards.
     */
    function cacheElements() {
        if (!window.TTSNeuralGateway) return;

        var models = window.TTSNeuralGateway.getRegisteredModels();
        for (var i = 0; i < models.length; i++) {
            var key = models[i].key;
            var card = document.getElementById(CARD_ID_PREFIX + key);
            if (!card) continue;

            cardEls[key] = {
                card: card,
                icon: card.querySelector(".imgdesc-mm-status-icon"),
                stateText: card.querySelector(".imgdesc-mm-state-text"),
                actions: card.querySelector(".imgdesc-mm-model-actions"),
                progress: card.querySelector(".imgdesc-mm-progress"),
                progressFill: card.querySelector(".imgdesc-mm-progress-bar-fill"),
                progressBar: card.querySelector(".imgdesc-mm-progress-bar"),
                progressText: card.querySelector(".imgdesc-mm-progress-text"),
                progressDetail: card.querySelector(".imgdesc-mm-progress-detail")
            };
        }

        logDebug("Cached elements for " + Object.keys(cardEls).length + " TTS model cards");
    }

    // ========================================================================
    // STATE -> DISPLAY MAPPING
    // ========================================================================

    var STATE_LABELS = {
        "not-downloaded": "Not downloaded",
        "downloading": "Downloading\u2026",
        "cached": "Downloaded \u2014 ready to load",
        "loading": "Loading\u2026",
        "loaded": "Loaded and ready",
        "error": "Error"
    };

    var STATE_ICONS = {
        "not-downloaded": "download",
        "downloading": "hourglass",
        "cached": "disk",
        "loading": "hourglass",
        "loaded": "checkCircle",
        "error": "error"
    };

    // ========================================================================
    // MODEL STATE DISPLAY
    // ========================================================================

    /**
     * Refresh all TTS model cards with current state.
     */
    function refreshAll() {
        if (!window.TTSNeuralGateway) return;

        var models = window.TTSNeuralGateway.getRegisteredModels();
        for (var i = 0; i < models.length; i++) {
            updateModelUI(models[i].key, models[i].state);
        }
    }

    /**
     * Update a single TTS model card's UI.
     * @param {string} modelKey
     * @param {string} state
     */
    function updateModelUI(modelKey, state) {
        var cached = cardEls[modelKey];
        if (!cached || !cached.card) return;

        // Update data attribute (drives CSS styling)
        cached.card.setAttribute("data-state", state);

        // Update status icon
        if (cached.icon) {
            var iconName = STATE_ICONS[state] || "download";
            cached.icon.setAttribute("data-icon", iconName);
            if (typeof window.getIcon === "function") {
                cached.icon.innerHTML = window.getIcon(iconName);
            }
        }

        // Update state text
        if (cached.stateText) {
            cached.stateText.textContent = STATE_LABELS[state] || state;
        }

        // Update action buttons
        renderActionButtons(cached, modelKey, state);

        // Show/hide progress bar
        if (cached.progress) {
            cached.progress.hidden = state !== "downloading";
        }
    }

    // ========================================================================
    // ACTION BUTTONS
    // ========================================================================

    /**
     * Render appropriate action buttons based on model state.
     * @param {object} cached - Cached DOM elements for the card
     * @param {string} modelKey
     * @param {string} state
     */
    function renderActionButtons(cached, modelKey, state) {
        if (!cached.actions) return;

        var buttons = [];

        switch (state) {
            case "not-downloaded":
                buttons.push(makeButton("Set Up", "download", "ttsMMDownload('" + modelKey + "')"));
                break;
            case "downloading":
                // No cancel — gateway does not support cancellation
                break;
            case "cached":
                buttons.push(makeButton("Load", "upload", "ttsMMLoad('" + modelKey + "')"));
                buttons.push(makeButton("Remove", "trash", "ttsMMRemove('" + modelKey + "')"));
                break;
            case "loading":
                // No actions while loading
                break;
            case "loaded":
                buttons.push(makeButton("Unload", "close", "ttsMMUnload('" + modelKey + "')"));
                break;
            case "error":
                buttons.push(makeButton("Retry", "refresh", "ttsMMDownload('" + modelKey + "')"));
                break;
        }

        cached.actions.innerHTML = buttons.join("");
    }

    /**
     * Create a button HTML string.
     * @param {string} label
     * @param {string} iconName
     * @param {string} onclickStr
     * @returns {string}
     */
    function makeButton(label, iconName, onclickStr) {
        var iconHtml = "";
        if (typeof window.getIcon === "function") {
            iconHtml = '<span aria-hidden="true">' + window.getIcon(iconName) + "</span> ";
        } else {
            iconHtml = '<span aria-hidden="true" data-icon="' + iconName + '"></span> ';
        }
        return (
            '<button class="imgdesc-mm-action-btn" onclick="' +
            onclickStr + '">' + iconHtml + label + "</button>"
        );
    }

    // ========================================================================
    // CACHE REMOVAL
    // ========================================================================

    /**
     * Remove a TTS model's cached files from the Cache API.
     * Matches entries by the model's HuggingFace model ID.
     * @param {string} modelKey
     * @returns {Promise<boolean>} true if entries were removed
     */
    async function removeCachedFiles(modelKey) {
        if (!window.TTSNeuralGateway) return false;

        var models = window.TTSNeuralGateway.getRegisteredModels();
        var hfModelId = null;
        for (var i = 0; i < models.length; i++) {
            if (models[i].key === modelKey) {
                hfModelId = models[i].hfModelId;
                break;
            }
        }

        if (!hfModelId) {
            logWarn("Cannot find HF model ID for key: " + modelKey);
            return false;
        }

        try {
            var cache = await caches.open(CACHE_NAME);
            var keys = await cache.keys();
            var modelSlug = hfModelId.replace("/", "%2F");
            var removed = 0;

            for (var k = 0; k < keys.length; k++) {
                var url = keys[k].url || "";
                if (url.includes(hfModelId) || url.includes(modelSlug)) {
                    await cache.delete(keys[k]);
                    removed++;
                }
            }

            logInfo("Removed " + removed + " cache entries for " + modelKey);
            return removed > 0;
        } catch (e) {
            logError("Cache removal failed for " + modelKey + ": " + e.message);
            return false;
        }
    }

    // ========================================================================
    // GLOBAL ONCLICK HANDLERS
    // ========================================================================

    window.ttsMMDownload = async function (key) {
        if (!window.TTSNeuralGateway) return;
        try {
            await window.TTSNeuralGateway.preDownloadModel(key);
        } catch (err) {
            logError('Download failed for "' + key + '":', err.message || err);
        }
    };

    window.ttsMMLoad = async function (key) {
        if (!window.TTSNeuralGateway) return;
        try {
            // GPU safety check
            if (window.LocalGPUMonitor && typeof window.LocalGPUMonitor.checkBeforeLoadAsync === "function") {
                var result = await window.LocalGPUMonitor.checkBeforeLoadAsync(key);
                if (!result.safe) {
                    var confirmFn = typeof window.safeConfirm === "function" ? window.safeConfirm : confirm;
                    var confirmed = await confirmFn(result.warning);
                    if (!confirmed) return;
                }
            }
            await window.TTSNeuralGateway.loadModel(key);
        } catch (err) {
            logError('Load failed for "' + key + '":', err.message || err);
        }
    };

    window.ttsMMUnload = async function (key) {
        if (!window.TTSNeuralGateway) return;
        try {
            await window.TTSNeuralGateway.unloadModel();
        } catch (err) {
            logError('Unload failed for "' + key + '":', err.message || err);
        }
    };

    window.ttsMMRemove = async function (key) {
        if (!window.TTSNeuralGateway) return;
        try {
            // Confirm removal
            var displayName = "Supertonic TTS";
            var models = window.TTSNeuralGateway.getRegisteredModels();
            for (var i = 0; i < models.length; i++) {
                if (models[i].key === key) {
                    displayName = models[i].name;
                    break;
                }
            }

            var confirmFn = typeof window.safeConfirm === "function" ? window.safeConfirm : confirm;
            var confirmed = await confirmFn("Remove " + displayName + " from cache?");
            if (!confirmed) return;

            // Unload first if currently loaded
            var state = window.TTSNeuralGateway.getModelState(key);
            if (state === "loaded") {
                await window.TTSNeuralGateway.unloadModel();
            }

            // Remove from Cache API
            await removeCachedFiles(key);

            // Update UI to not-downloaded
            updateModelUI(key, "not-downloaded");
        } catch (err) {
            logError('Remove failed for "' + key + '":', err.message || err);
        }
    };

    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================

    /**
     * Subscribe to model:stateChange events (TTS models only).
     */
    function listenForStateChanges() {
        if (window.EmbedEventEmitter) {
            window.EmbedEventEmitter.on("model:stateChange", function (data) {
                if (!data || data.category !== "tts") return;
                logDebug("State change:", data.modelKey, data.newState);
                updateModelUI(data.modelKey, data.newState);
            });
        }
    }

    // ========================================================================
    // GRACEFUL DEGRADATION
    // ========================================================================

    /**
     * If TTSNeuralGateway is not available, show "Not available" on all TTS cards.
     */
    function showNotAvailable() {
        var cards = document.querySelectorAll('[id^="' + CARD_ID_PREFIX + '"]');
        for (var i = 0; i < cards.length; i++) {
            var stateText = cards[i].querySelector(".imgdesc-mm-state-text");
            if (stateText) stateText.textContent = "Not available";

            var icon = cards[i].querySelector(".imgdesc-mm-status-icon");
            if (icon) {
                icon.setAttribute("data-icon", "error");
                if (typeof window.getIcon === "function") {
                    icon.innerHTML = window.getIcon("error");
                }
            }

            var actions = cards[i].querySelector(".imgdesc-mm-model-actions");
            if (actions) actions.innerHTML = "";
        }
    }

    // ========================================================================
    // INITIALISATION
    // ========================================================================

    function init() {
        if (!window.TTSNeuralGateway) {
            logWarn("TTSNeuralGateway not available — TTS model cards disabled");
            showNotAvailable();
            return;
        }

        cacheElements();

        if (Object.keys(cardEls).length === 0) {
            logDebug("No TTS model card elements found — skipping initialisation");
            return;
        }

        // Set initial card states
        var models = window.TTSNeuralGateway.getRegisteredModels();
        for (var i = 0; i < models.length; i++) {
            updateModelUI(models[i].key, models[i].state);
        }

        listenForStateChanges();

        logInfo("Initialised with " + Object.keys(cardEls).length + " TTS model cards");
    }

    // Auto-initialise
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    window.TTSModelUI = {
        refreshAll: refreshAll,
        updateModelUI: updateModelUI
    };

})();
