/**
 * ===================================================================
 * TEXT MODEL MANAGER UI — Phase DE-4b
 * ===================================================================
 *
 * Binds text model card HTML (in tools.html) to the
 * LocalTextModelManager backend (local-text-model-manager.js).
 *
 * Responsibilities:
 *   - Refresh model state display in Set Up tool
 *   - Render action buttons per model state
 *   - Update download progress bars with throttling
 *   - GPU memory status section with live updates
 *   - Listen for model:stateChange events to live-update
 *   - Expose global onclick handlers for inline buttons
 *
 * Architecture: IIFE with window globals for onclick handlers.
 * No NPM — pure browser JS loaded via <script> tag.
 *
 * VERSION: 1.0.0
 * DATE: 7 April 2026
 * PHASE: DE-4b — Text Model Manager UI
 * ===================================================================
 */

/* global LocalTextModelManager, LocalGPUMonitor, EmbedEventEmitter, getIcon, safeConfirm */

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
            console.error.apply(console, ["[TextModelManagerUI] " + message].concat(args));
        }
    }

    function logWarn(message) {
        if (shouldLog(LOG_LEVELS.WARN)) {
            var args = Array.prototype.slice.call(arguments, 1);
            console.warn.apply(console, ["[TextModelManagerUI] " + message].concat(args));
        }
    }

    function logInfo(message) {
        if (shouldLog(LOG_LEVELS.INFO)) {
            var args = Array.prototype.slice.call(arguments, 1);
            console.log.apply(console, ["[TextModelManagerUI] " + message].concat(args));
        }
    }

    function logDebug(message) {
        if (shouldLog(LOG_LEVELS.DEBUG)) {
            var args = Array.prototype.slice.call(arguments, 1);
            console.log.apply(console, ["[TextModelManagerUI] " + message].concat(args));
        }
    }

    // ========================================================================
    // CACHED DOM ELEMENTS
    // ========================================================================

    /** @type {Object<string, {card: HTMLElement, icon: HTMLElement, stateText: HTMLElement, actions: HTMLElement, progress: HTMLElement, progressFill: HTMLElement, progressText: HTMLElement, progressDetail: HTMLElement}>} */
    var cardEls = {};

    /** GPU status elements */
    var gpuEls = {
        container: null,
        list: null
    };

    /**
     * Cache DOM elements for all text model cards and GPU status.
     */
    function cacheElements() {
        if (!window.LocalTextModelManager) return;

        var models = window.LocalTextModelManager.getRegisteredModels();
        for (var i = 0; i < models.length; i++) {
            var key = models[i].key;
            var card = document.getElementById("setup-tm-model-" + key);
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

        gpuEls.container = document.getElementById("setup-tm-gpu-status");
        gpuEls.list = document.getElementById("setup-tm-gpu-list");

        logDebug("Cached elements for " + Object.keys(cardEls).length + " text model cards");
    }

    // ========================================================================
    // STATE -> DISPLAY MAPPING
    // ========================================================================

    var STATE_LABELS = {
        "not-downloaded": "Not downloaded",
        "downloading": "Downloading\u2026",
        "cached": "Cached",
        "loading": "Loading\u2026",
        "loaded": "Loaded",
        "download-error": "Download failed",
        "load-error": "Load failed"
    };

    var STATE_ICONS = {
        "not-downloaded": "download",
        "downloading": "hourglass",
        "cached": "disk",
        "loading": "hourglass",
        "loaded": "checkCircle",
        "download-error": "error",
        "load-error": "error"
    };

    // ========================================================================
    // MODEL STATE DISPLAY
    // ========================================================================

    /**
     * Refresh all text model cards with current state.
     */
    function refreshAll() {
        if (!window.LocalTextModelManager) return;

        var models = window.LocalTextModelManager.getRegisteredModels();
        for (var i = 0; i < models.length; i++) {
            updateModelUI(models[i].key, models[i].state);
        }
        refreshGPUStatus();
    }

    /**
     * Update a single text model card's UI.
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
                buttons.push(makeButton("Download", "download", "localTMDownload('" + modelKey + "')"));
                break;
            case "downloading":
                buttons.push(makeButton("Cancel", "close", "localTMCancelDownload('" + modelKey + "')"));
                break;
            case "cached":
                buttons.push(makeButton("Load", "upload", "localTMLoad('" + modelKey + "')"));
                buttons.push(makeButton("Remove", "trash", "localTMRemove('" + modelKey + "')"));
                break;
            case "loading":
                // No actions while loading
                break;
            case "loaded":
                buttons.push(makeButton("Unload", "close", "localTMUnload('" + modelKey + "')"));
                break;
            case "download-error":
                buttons.push(makeButton("Retry", "refresh", "localTMDownload('" + modelKey + "')"));
                break;
            case "load-error":
                buttons.push(makeButton("Retry", "refresh", "localTMLoad('" + modelKey + "')"));
                buttons.push(makeButton("Remove", "trash", "localTMRemove('" + modelKey + "')"));
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
    // DOWNLOAD PROGRESS
    // ========================================================================

    /** Per-model download tracking state */
    var downloadTracking = {};

    /** UI throttle interval in milliseconds */
    var UI_THROTTLE_MS = 200;

    /** Detail text update interval */
    var DETAIL_THROTTLE_MS = 500;

    /**
     * Format bytes into a human-readable string.
     * @param {number} bytes
     * @returns {string}
     */
    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    /**
     * Format seconds into a readable ETA string.
     * @param {number} seconds
     * @returns {string}
     */
    function formatETA(seconds) {
        if (!isFinite(seconds) || seconds < 0) return "";
        if (seconds < 60) return "~" + Math.ceil(seconds) + "s remaining";
        var mins = Math.floor(seconds / 60);
        var secs = Math.ceil(seconds % 60);
        return "~" + mins + "m " + secs + "s remaining";
    }

    /**
     * Update the progress bar for a downloading text model.
     * Handles both ONNX multi-file and WebLLM single-stream progress.
     * @param {string} modelKey
     * @param {object} progress - { progress: number, text: string } or ONNX-style { file, loaded, total, status }
     */
    function updateDownloadProgress(modelKey, progress) {
        var cached = cardEls[modelKey];
        if (!cached) return;

        // Show progress container
        if (cached.progress) cached.progress.hidden = false;

        // Ensure tracking object exists
        var track = downloadTracking[modelKey];
        if (!track) {
            track = {
                startTime: Date.now(),
                lastUIUpdate: 0,
                lastDetailUpdate: 0,
                lastSpeedTime: Date.now(),
                lastSpeedLoaded: 0,
                smoothedSpeed: 0,
                files: {}
            };
            downloadTracking[modelKey] = track;
        }

        if (!progress) return;

        // Normalise progress format — WebLLM sends { progress, text }
        // ONNX sends { file, loaded, total, status }
        var pct = 0;
        var loadedBytes = 0;
        var totalBytes = 0;
        var detailText = "";

        if (typeof progress.progress === "number" && !progress.file) {
            // WebLLM format — simple percentage
            pct = Math.floor(progress.progress);
            detailText = progress.text || "";
        } else {
            // ONNX multi-file format
            var fileKey = progress.file || progress.name || "unknown";

            if (progress.status === "initiate") {
                if (!track.files[fileKey]) {
                    track.files[fileKey] = { loaded: 0, total: 0, done: false };
                }
                return;
            }

            if (progress.status === "done" && track.files[fileKey]) {
                track.files[fileKey].loaded = track.files[fileKey].total;
                track.files[fileKey].done = true;
            }

            if (progress.total > 0) {
                if (!track.files[fileKey]) {
                    track.files[fileKey] = { loaded: 0, total: progress.total, done: false };
                }
                track.files[fileKey].loaded = progress.loaded;
                track.files[fileKey].total = progress.total;
            }

            // Aggregate across large files only (skip tiny config files)
            var MIN_FILE_SIZE = 1024 * 1024;
            var aggKeys = Object.keys(track.files);
            for (var ai = 0; ai < aggKeys.length; ai++) {
                var f = track.files[aggKeys[ai]];
                if (f.total < MIN_FILE_SIZE) continue;
                totalBytes += f.total;
                loadedBytes += f.loaded;
            }

            pct = totalBytes > 0 ? Math.floor((loadedBytes / totalBytes) * 100) : 0;
        }

        // Throttle UI updates
        var now = Date.now();
        if (now - track.lastUIUpdate < UI_THROTTLE_MS) return;
        track.lastUIUpdate = now;

        // Update progress bar
        if (cached.progressFill) cached.progressFill.style.width = pct + "%";
        if (cached.progressBar) cached.progressBar.setAttribute("aria-valuenow", String(pct));
        if (cached.progressText) cached.progressText.textContent = pct + "%";

        // Calculate smoothed speed (for ONNX multi-file downloads)
        if (totalBytes > 0) {
            var speedTimeDelta = (now - track.lastSpeedTime) / 1000;
            if (speedTimeDelta >= 0.5) {
                var speedBytesDelta = loadedBytes - track.lastSpeedLoaded;
                var instantSpeed = speedBytesDelta / speedTimeDelta / (1024 * 1024);
                if (instantSpeed >= 0) {
                    track.smoothedSpeed = track.smoothedSpeed > 0
                        ? track.smoothedSpeed * 0.7 + instantSpeed * 0.3
                        : instantSpeed;
                }
                track.lastSpeedLoaded = loadedBytes;
                track.lastSpeedTime = now;
            }
        }

        // Detail text (throttled separately)
        if (now - track.lastDetailUpdate >= DETAIL_THROTTLE_MS || track.lastDetailUpdate === 0) {
            track.lastDetailUpdate = now;

            var html = "";
            if (detailText) {
                // WebLLM — use its own status text
                html = "<dt>Status</dt><dd>" + detailText + "</dd>";
            } else if (totalBytes > 0) {
                // ONNX — show downloaded / total + speed
                html = "<dt>Downloaded</dt><dd>" + formatBytes(loadedBytes) + " / " + formatBytes(totalBytes) + "</dd>";
                if (track.smoothedSpeed > 0.01) {
                    html += "<dt>Speed</dt><dd>" + track.smoothedSpeed.toFixed(1) + " MB/s</dd>";
                    var remainingBytes = totalBytes - loadedBytes;
                    var etaSeconds = remainingBytes / (track.smoothedSpeed * 1024 * 1024);
                    var etaStr = formatETA(etaSeconds);
                    if (etaStr) {
                        html += "<dt>Remaining</dt><dd>" + etaStr + "</dd>";
                    }
                }
            }

            if (cached.progressDetail) cached.progressDetail.innerHTML = html;
        }
    }

    /**
     * Mark a download as complete.
     * @param {string} modelKey
     */
    function completeDownloadProgress(modelKey) {
        var cached = cardEls[modelKey];
        if (!cached) return;

        if (cached.progressFill) cached.progressFill.style.width = "100%";
        if (cached.progressBar) cached.progressBar.setAttribute("aria-valuenow", "100");
        if (cached.progressText) cached.progressText.textContent = "Complete";
        if (cached.progressDetail) {
            cached.progressDetail.innerHTML = "<dt>Status</dt><dd>Download complete</dd>";
        }

        delete downloadTracking[modelKey];
    }

    // ========================================================================
    // GPU STATUS SECTION
    // ========================================================================

    /**
     * Refresh the GPU memory status section with currently loaded text models.
     */
    function refreshGPUStatus() {
        if (!gpuEls.list) return;

        var loaded = [];
        if (window.LocalGPUMonitor) {
            var allLoaded = window.LocalGPUMonitor.getLoadedModels();
            // Filter to text models only
            for (var i = 0; i < allLoaded.length; i++) {
                if (allLoaded[i].category === "text") {
                    loaded.push(allLoaded[i]);
                }
            }
        }

        if (loaded.length === 0) {
            gpuEls.list.innerHTML = '<p class="setup-tm-gpu-empty">No models loaded in GPU memory</p>';
            return;
        }

        var html = "";
        for (var j = 0; j < loaded.length; j++) {
            var model = loaded[j];
            var engineLabel = (model.engine === "webllm") ? "WebLLM" : "ONNX";
            var iconHtml = "";
            if (typeof window.getIcon === "function") {
                iconHtml = '<span aria-hidden="true">' + window.getIcon("close") + "</span> ";
            } else {
                iconHtml = '<span aria-hidden="true" data-icon="close"></span> ';
            }
            html += '<div class="setup-tm-gpu-item">' +
                '<span class="setup-tm-gpu-model-name">' + model.displayName + '</span>' +
                '<span class="setup-tm-engine-badge" aria-hidden="true">' + engineLabel + '</span>' +
                '<span class="setup-tm-gpu-size">' + model.estimatedMB + ' MB</span>' +
                '<button class="imgdesc-mm-action-btn" onclick="localTMUnload(\'' + model.key + '\')">' +
                iconHtml + 'Unload</button>' +
                '</div>';
        }

        gpuEls.list.innerHTML = html;
    }

    // ========================================================================
    // GLOBAL ONCLICK HANDLERS
    // ========================================================================

    window.localTMDownload = async function (key) {
        if (!window.LocalTextModelManager) return;
        try {
            await window.LocalTextModelManager.preDownloadModel(key, function (progress) {
                updateDownloadProgress(key, progress);
            });
            completeDownloadProgress(key);
        } catch (err) {
            logError('Download failed for "' + key + '":', err.message || err);
        }
    };

    window.localTMCancelDownload = function (key) {
        if (!window.LocalTextModelManager) return;
        window.LocalTextModelManager.cancelDownload(key);
        delete downloadTracking[key];
    };

    window.localTMLoad = async function (key) {
        if (!window.LocalTextModelManager) return;
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
            await window.LocalTextModelManager.loadModel(key);
        } catch (err) {
            logError('Load failed for "' + key + '":', err.message || err);
        }
    };

    window.localTMUnload = async function (key) {
        if (!window.LocalTextModelManager) return;
        try {
            await window.LocalTextModelManager.unloadModel(key);
        } catch (err) {
            logError('Unload failed for "' + key + '":', err.message || err);
        }
    };

    window.localTMRemove = async function (key) {
        if (!window.LocalTextModelManager) return;
        try {
            // Get display name for confirmation
            var displayName = key;
            if (window.LocalTextModelRegistry) {
                var modelDef = window.LocalTextModelRegistry.getModel(key);
                if (modelDef && modelDef.userInfo) {
                    displayName = modelDef.userInfo.displayName;
                }
            }
            var confirmFn = typeof window.safeConfirm === "function" ? window.safeConfirm : confirm;
            var confirmed = await confirmFn("Remove " + displayName + " from cache?");
            if (!confirmed) return;

            await window.LocalTextModelManager.removeCachedModel(key);
        } catch (err) {
            logError('Remove failed for "' + key + '":', err.message || err);
        }
    };

    window.localTMClearAllText = async function () {
        if (!window.LocalTextModelManager) return;
        try {
            var confirmFn = typeof window.safeConfirm === "function" ? window.safeConfirm : confirm;
            var confirmed = await confirmFn("Remove all cached text models? This cannot be undone.");
            if (!confirmed) return;

            await window.LocalTextModelManager.clearAllTextModelCache();
        } catch (err) {
            logError("Clear all text model cache failed:", err.message || err);
        }
    };

    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================

    /**
     * Subscribe to model:stateChange events (text models only).
     */
    function listenForStateChanges() {
        if (window.EmbedEventEmitter) {
            window.EmbedEventEmitter.on("model:stateChange", function (data) {
                if (!data || data.category !== "text") return;
                logDebug("State change:", data.modelKey, data.newState);
                updateModelUI(data.modelKey, data.newState);
                refreshGPUStatus();
            });
        }
    }

    /**
     * Subscribe to GPU monitor updates.
     */
    function listenForGPUUpdates() {
        if (window.LocalGPUMonitor && typeof window.LocalGPUMonitor.onUpdate === "function") {
            window.LocalGPUMonitor.onUpdate(function () {
                refreshGPUStatus();
            });
        }
    }

    // ========================================================================
    // INITIALISATION
    // ========================================================================

    function init() {
        cacheElements();

        if (Object.keys(cardEls).length === 0) {
            logDebug("No text model card elements found — skipping initialisation");
            return;
        }

        // Set initial card states
        if (window.LocalTextModelManager) {
            var models = window.LocalTextModelManager.getRegisteredModels();
            for (var i = 0; i < models.length; i++) {
                updateModelUI(models[i].key, models[i].state);
            }
        }

        listenForStateChanges();
        listenForGPUUpdates();
        refreshGPUStatus();

        logInfo("Initialised with " + Object.keys(cardEls).length + " text model cards");
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

    window.LocalTextModelManagerUI = {
        refreshAll: refreshAll,
        updateModelUI: updateModelUI
    };

})();
