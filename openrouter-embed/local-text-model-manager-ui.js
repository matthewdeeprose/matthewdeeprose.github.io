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
    // Until the first full refresh has run, state changes are INITIALISATION, not
    // news. The cards ship "Checking…" and settle to their real state on load; with
    // aria-live on the status wrapper that spoke a bare "Not downloaded" or "Cached"
    // once per card — thirteen utterances before the user reached the page, none of
    // them naming which model they described. The markup is no longer a live region;
    // announceState() below is the channel, and it stays quiet until this flips.
    var hasSettledInitialStates = false;

    function refreshAll() {
        if (!window.LocalTextModelManager) return;

        var models = window.LocalTextModelManager.getRegisteredModels();
        for (var i = 0; i < models.length; i++) {
            updateModelUI(models[i].key, models[i].state);
        }
        refreshGPUStatus();
        hasSettledInitialStates = true;
    }

    /**
     * Announce a model's new state, naming the model.
     *
     * The status wrapper used to be aria-live, which announced the label alone —
     * "Cached", with no way to tell which of a dozen models it referred to. Routing
     * through the shared announcer costs nothing and lets the message say what it
     * is actually about.
     *
     * @param {string} modelKey
     * @param {string} label human-readable state label
     */
    function announceState(modelKey, label) {
        if (!hasSettledInitialStates) return;
        var announcer = window.accessibilityHelpers;
        if (!announcer || typeof announcer.announce !== "function") return;

        var displayName = modelKey;
        if (window.LocalTextModelManager) {
            var models = window.LocalTextModelManager.getRegisteredModels();
            for (var i = 0; i < models.length; i++) {
                if (models[i].key === modelKey) {
                    displayName = models[i].displayName || modelKey;
                    break;
                }
            }
        }
        announcer.announce(displayName + ": " + label);
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
            if (typeof window.refreshIcons === "function") window.refreshIcons(cached.icon);
        }

        // Update state text, only when it actually changes. Same reason as
        // setListHTML() below: the card's status wrapper is a live region, so
        // rewriting it with the label it already holds announces a second time.
        if (cached.stateText) {
            var label = STATE_LABELS[state] || state;
            if (cached.stateText.textContent !== label) {
                cached.stateText.textContent = label;
                announceState(modelKey, label);
            }
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

        // SC 2.4.6 / 2.4.4: every card renders the same words — "Download",
        // "Load", "Remove", "Unload", "Retry", "Cancel" — so out of context a
        // screen-reader or voice-input user cannot tell which model a button acts
        // on. Curried here rather than threaded through all eight call sites
        // below, so no state can be left with a missing or stale suffix.
        //
        // Guarded the same defensive way as the window.getIcon lookup in
        // makeButton: a missing registry degrades to the current behaviour
        // (no suffix) rather than throwing. Note the nesting — there is no
        // top-level `name` on a local-text model def.
        var modelName = "";
        try {
            var registry = window.LocalTextModelRegistry;
            var modelDef = registry && typeof registry.getModel === "function"
                ? registry.getModel(modelKey)
                : null;
            modelName = (modelDef && modelDef.userInfo && modelDef.userInfo.displayName) || "";
        } catch (err) {
            logWarn("Could not resolve display name for " + modelKey, err.message || err);
        }
        function actionButton(label, iconName, onclickStr) {
            return makeButton(label, iconName, onclickStr, modelName);
        }

        var buttons = [];

        switch (state) {
            case "not-downloaded":
                buttons.push(actionButton("Download", "download", "localTMDownload('" + modelKey + "')"));
                break;
            case "downloading":
                buttons.push(actionButton("Cancel", "close", "localTMCancelDownload('" + modelKey + "')"));
                break;
            case "cached":
                buttons.push(actionButton("Load", "upload", "localTMLoad('" + modelKey + "')"));
                buttons.push(actionButton("Remove", "trash", "localTMRemove('" + modelKey + "')"));
                break;
            case "loading":
                // No actions while loading
                break;
            case "loaded":
                buttons.push(actionButton("Unload", "close", "localTMUnload('" + modelKey + "')"));
                break;
            case "download-error":
                buttons.push(actionButton("Retry", "refresh", "localTMDownload('" + modelKey + "')"));
                break;
            case "load-error":
                buttons.push(actionButton("Retry", "refresh", "localTMLoad('" + modelKey + "')"));
                buttons.push(actionButton("Remove", "trash", "localTMRemove('" + modelKey + "')"));
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
    function makeButton(label, iconName, onclickStr, modelName) {
        var iconHtml = "";
        if (typeof window.getIcon === "function") {
            iconHtml = '<span aria-hidden="true">' + window.getIcon(iconName) + "</span> ";
        } else {
            iconHtml = '<span aria-hidden="true" data-icon="' + iconName + '"></span> ';
        }
        // Name the object the button acts on, without changing anything visible.
        //
        // The standing rule is never to put a name-extending visually-hidden span
        // inside a control whose content is rebuilt at runtime, because the next
        // innerHTML write destroys it. That rule is about spans added to STATIC
        // markup. This is the safe case: the span is emitted BY the template that
        // does the rebuilding (cached.actions.innerHTML = buttons.join("")), so
        // every re-render recreates it in whatever the new state is.
        // The separator is a NON-BREAKING space and must stay one — an ordinary
        // space is collapsed by CSS because .visually-hidden is position:absolute.
        // Full measurement in image-describer-model-manager-ui.js.
        var suffixHtml = modelName
            ? '<span class="visually-hidden">\u00A0— ' + modelName + "</span>"
            : "";
        return (
            '<button class="imgdesc-mm-action-btn" onclick="' +
            onclickStr + '">' + iconHtml + label + suffixHtml + "</button>"
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
            // Write-if-changed. #setup-tm-gpu-status is role="status" aria-live, so an
            // unconditional assignment announces even when the markup is identical.
            // Measured 2 August 2026: this exact string was written TWELVE times on one
            // page load, and a human heard it repeated through NVDA.
            setListHTML('<p class="setup-tm-gpu-empty">No models loaded in GPU memory</p>');
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
                // Same SC 2.4.6 suffix as makeButton(), applied by hand because this
                // GPU list builds its button inline rather than going through it.
                // Emitted by the template that rebuilds the list, so it survives.
                '<button class="imgdesc-mm-action-btn" onclick="localTMUnload(\'' + model.key + '\')">' +
                iconHtml + 'Unload' +
                '<span class="visually-hidden">\u00A0— ' + model.displayName + '</span>' +
                '</button>' +
                '</div>';
        }

        setListHTML(html);
    }

    /**
     * Assign the GPU list markup only when it differs from what is already there.
     *
     * The container is a live region, so an identical re-assignment is a mutation
     * the reader announces again — never useful, because the text has not changed.
     * refreshGPUStatus() runs once per model state event, so at load that is a dozen
     * identical writes.
     *
     * @param {string} html
     */
    function setListHTML(html) {
        if (!gpuEls.list || gpuEls.list.innerHTML === html) return;
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
