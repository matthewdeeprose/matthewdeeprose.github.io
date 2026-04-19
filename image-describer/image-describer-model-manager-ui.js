/**
 * ═══════════════════════════════════════════════════════════════
 * IMAGE DESCRIBER MODEL MANAGER UI — Phase 9D
 * ═══════════════════════════════════════════════════════════════
 *
 * Binds the Model Manager panel HTML (in tools.html) to the
 * ImageDescriberModelManager backend (image-describer-model-manager.js).
 *
 * Responsibilities:
 *   - Refresh model state display on panel open
 *   - Render action buttons per model state
 *   - Update storage bar and analysis cache stats
 *   - Listen for model:stateChange events to live-update
 *   - Expose global onclick handlers for inline buttons
 *
 * Architecture: IIFE with window globals for onclick handlers.
 * No NPM — pure browser JS loaded via <script> tag.
 *
 * VERSION: 1.0.0
 * DATE: 22 March 2026
 * PHASE: 9D — Model Manager UI
 * ═══════════════════════════════════════════════════════════════
 */

/* global ImageDescriberModelManager, EmbedEventEmitter, getIcon */

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
      console.error.apply(
        console,
        ["[ModelManagerUI] " + message].concat(args),
      );
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.warn.apply(console, ["[ModelManagerUI] " + message].concat(args));
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.log.apply(console, ["[ModelManagerUI] " + message].concat(args));
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      var args = Array.prototype.slice.call(arguments, 1);
      console.log.apply(console, ["[ModelManagerUI] " + message].concat(args));
    }
  }

  // ========================================================================
  // CACHED DOM ELEMENTS
  // ========================================================================

  var els = {};
  var setupEls = {};

  function cacheElements() {
    // Image Describer elements (original)
    els.panel = document.getElementById("imgdesc-model-manager-panel");
    els.storageLabel = document.getElementById("imgdesc-mm-storage-label");
    els.storageBar = document.getElementById("imgdesc-mm-storage-bar");
    els.storageBarFill = document.getElementById("imgdesc-mm-storage-bar-fill");
    els.persistentBadge = document.getElementById(
      "imgdesc-mm-persistent-badge",
    );
    els.persistBtn = document.getElementById("imgdesc-mm-persist-btn");
    els.cacheStats = document.getElementById("imgdesc-mm-cache-stats");
    els.cacheClearBtn = document.getElementById("imgdesc-mm-cache-clear-btn");

    // Set Up elements (Phase SU-4a — dual UI)
    setupEls.panel = document.getElementById("setup-model-manager-panel");
    setupEls.storageLabel = document.getElementById("setup-mm-storage-label");
    setupEls.storageBar = document.getElementById("setup-mm-storage-bar");
    setupEls.storageBarFill = document.getElementById("setup-mm-storage-bar-fill");
    setupEls.persistentBadge = document.getElementById(
      "setup-mm-persistent-badge",
    );
    setupEls.persistBtn = document.getElementById("setup-mm-persist-btn");
    setupEls.cacheStats = document.getElementById("setup-mm-cache-stats");
    setupEls.cacheClearBtn = document.getElementById("setup-mm-cache-clear-btn");
  }

  /**
   * Return model item elements from both locations for a given key.
   * @param {string} modelKey
   * @returns {HTMLElement[]}
   */
  function getModelElements(modelKey) {
    return [
      document.getElementById("imgdesc-mm-model-" + modelKey),
      document.getElementById("setup-mm-model-" + modelKey),
    ].filter(Boolean);
  }

  // ========================================================================
  // STATE → DISPLAY MAPPING
  // ========================================================================

  var STATE_LABELS = {
    "not-downloaded": "Not downloaded",
    downloading: "Downloading…",
    cached: "Cached",
    loading: "Loading…",
    loaded: "Loaded",
    "download-error": "Download failed",
    "load-error": "Load failed",
  };

  var STATE_ICONS = {
    "not-downloaded": "download",
    downloading: "hourglass",
    cached: "disk",
    loading: "hourglass",
    loaded: "checkCircle",
    "download-error": "error",
    "load-error": "error",
  };

  // ========================================================================
  // STORAGE DISPLAY
  // ========================================================================

  async function refreshStorage() {
    if (!window.ImageDescriberModelManager) return;

    try {
      var status = await window.ImageDescriberModelManager.getStorageStatus();
      var allSets = [els, setupEls];

      for (var si = 0; si < allSets.length; si++) {
        var s = allSets[si];

        // Update label
        if (s.storageLabel) {
          if (status.quotaMB > 0) {
            s.storageLabel.textContent =
              "Storage: " +
              status.usedMB +
              " MB used / " +
              status.availableMB +
              " MB available";
          } else {
            s.storageLabel.textContent = "Storage: quota unavailable";
          }
        }

        // Update bar
        if (s.storageBar && s.storageBarFill && status.quotaMB > 0) {
          var pct = Math.min(
            100,
            Math.round((status.usedMB / status.quotaMB) * 100),
          );
          s.storageBarFill.style.width = pct + "%";
          s.storageBar.setAttribute("aria-valuenow", String(pct));
        }

        // Persistent badge
        if (s.persistentBadge) {
          s.persistentBadge.hidden = !status.persistent;
        }

        // Show persist button only if not already persistent
        if (s.persistBtn) {
          s.persistBtn.hidden = status.persistent;
        }
      }
    } catch (err) {
      logError("Failed to refresh storage:", err.message || err);
      if (els.storageLabel) {
        els.storageLabel.textContent = "Storage: unable to check";
      }
      if (setupEls.storageLabel) {
        setupEls.storageLabel.textContent = "Storage: unable to check";
      }
    }
  }

  // ========================================================================
  // MODEL STATE DISPLAY
  // ========================================================================

  /**
   * Refresh all model item elements with current state.
   */
  function refreshAllModels() {
    if (!window.ImageDescriberModelManager) return;

    var models = window.ImageDescriberModelManager.getRegisteredModels();
    for (var i = 0; i < models.length; i++) {
      updateModelUI(models[i].key, models[i].state);
    }
  }

  /**
   * Update a single model item's UI.
   * @param {string} modelKey
   * @param {string} state
   */
  function updateModelUI(modelKey, state) {
    var items = getModelElements(modelKey);
    for (var idx = 0; idx < items.length; idx++) {
      var item = items[idx];

      // Update data attribute (drives CSS styling)
      item.setAttribute("data-state", state);

      // Update status icon
      var statusIcon = item.querySelector(".imgdesc-mm-status-icon");
      if (statusIcon) {
        var iconName = STATE_ICONS[state] || "download";
        statusIcon.setAttribute("data-icon", iconName);
        // Re-populate icon if icon library is available
        if (typeof window.getIcon === "function") {
          statusIcon.innerHTML = window.getIcon(iconName);
        }
      }

      // Update state text
      var stateText = item.querySelector(".imgdesc-mm-state-text");
      if (stateText) {
        stateText.textContent = STATE_LABELS[state] || state;
      }

      // Update action buttons
      renderActionButtons(item, modelKey, state);

      // Show/hide progress bar
      var progressContainer = item.querySelector(".imgdesc-mm-progress");
      if (progressContainer) {
        progressContainer.hidden = state !== "downloading";
      }
    }
  }

  /**
   * Render appropriate action buttons based on model state.
   * @param {HTMLElement} item - The model item element
   * @param {string} modelKey
   * @param {string} state
   */
  function renderActionButtons(item, modelKey, state) {
    var actionsEl = item.querySelector(".imgdesc-mm-model-actions");
    if (!actionsEl) return;

    // Future models — no buttons
    var model = findModelInRegistry(modelKey);
    if (model && model.status === "future") {
      actionsEl.innerHTML = "";
      return;
    }

    var buttons = [];

    switch (state) {
      case "not-downloaded":
        buttons.push(
          makeButton(
            "Download",
            "download",
            "imgdescMMDownload('" + modelKey + "')",
          ),
        );
        break;

      case "downloading":
        buttons.push(
          makeButton(
            "Cancel",
            "close",
            "imgdescMMCancelDownload('" + modelKey + "')",
          ),
        );
        break;

      case "cached":
        buttons.push(
          makeButton("Load", "upload", "imgdescMMLoad('" + modelKey + "')"),
        );
        buttons.push(
          makeButton("Remove", "trash", "imgdescMMRemove('" + modelKey + "')"),
        );
        break;

      case "loading":
        // No actions while loading
        break;

      case "loaded":
        buttons.push(
          makeButton("Unload", "close", "imgdescMMUnload('" + modelKey + "')"),
        );
        break;

      case "download-error":
        buttons.push(
          makeButton(
            "Retry",
            "refresh",
            "imgdescMMDownload('" + modelKey + "')",
          ),
        );
        break;

      case "load-error":
        buttons.push(
          makeButton("Retry", "refresh", "imgdescMMLoad('" + modelKey + "')"),
        );
        buttons.push(
          makeButton("Remove", "trash", "imgdescMMRemove('" + modelKey + "')"),
        );
        break;
    }

    actionsEl.innerHTML = buttons.join("");
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
      iconHtml =
        '<span aria-hidden="true">' + window.getIcon(iconName) + "</span> ";
    } else {
      iconHtml =
        '<span aria-hidden="true" data-icon="' + iconName + '"></span> ';
    }
    return (
      '<button class="imgdesc-mm-action-btn" onclick="' +
      onclickStr +
      '">' +
      iconHtml +
      label +
      "</button>"
    );
  }

  /**
   * Find a model entry from the registry.
   * @param {string} modelKey
   * @returns {object|null}
   */
  function findModelInRegistry(modelKey) {
    if (!window.ImageDescriberModelManager) return null;
    var models = window.ImageDescriberModelManager.getRegisteredModels();
    for (var i = 0; i < models.length; i++) {
      if (models[i].key === modelKey) return models[i];
    }
    return null;
  }

  // ========================================================================
  // ANALYSIS CACHE DISPLAY
  // ========================================================================

  async function refreshCacheStats() {
    if (!window.ImageDescriberModelManager) return;

    try {
      var stats =
        await window.ImageDescriberModelManager.getAnalysisCacheStats();
      var allSets = [els, setupEls];

      for (var si = 0; si < allSets.length; si++) {
        var s = allSets[si];
        if (s.cacheStats) {
          if (stats.imageCount === 0) {
            s.cacheStats.textContent = "No cached analyses";
          } else {
            var sizeMB = (stats.totalBytes / (1024 * 1024)).toFixed(1);
            s.cacheStats.textContent =
              stats.imageCount +
              " image" +
              (stats.imageCount !== 1 ? "s" : "") +
              " cached (" +
              sizeMB +
              " MB)";
          }
        }
        if (s.cacheClearBtn) {
          s.cacheClearBtn.disabled = stats.imageCount === 0;
        }
      }
    } catch (err) {
      logError("Failed to refresh cache stats:", err.message || err);
      if (els.cacheStats) {
        els.cacheStats.textContent = "Unable to read cache";
      }
      if (setupEls.cacheStats) {
        setupEls.cacheStats.textContent = "Unable to read cache";
      }
    }
  }

  // ========================================================================
  // GLOBAL ONCLICK HANDLERS
  // ========================================================================

  window.imgdescMMDownload = async function (modelKey) {
    if (!window.ImageDescriberModelManager) return;
    try {
      await window.ImageDescriberModelManager.preDownloadModel(
        modelKey,
        function (progress) {
          updateDownloadProgress(modelKey, progress);
        },
      );
      completeDownloadProgress(modelKey);
      refreshStorage();
    } catch (err) {
      logError('Download failed for "' + modelKey + '":', err.message || err);
    }
  };

  window.imgdescMMCancelDownload = function (modelKey) {
    if (!window.ImageDescriberModelManager) return;
    window.ImageDescriberModelManager.cancelDownload(modelKey);
  };

  window.imgdescMMLoad = async function (modelKey) {
    if (!window.ImageDescriberModelManager) return;
    try {
      await window.ImageDescriberModelManager.loadModel(modelKey);
    } catch (err) {
      logError('Load failed for "' + modelKey + '":', err.message || err);
    }
  };

  window.imgdescMMUnload = async function (modelKey) {
    if (!window.ImageDescriberModelManager) return;
    try {
      await window.ImageDescriberModelManager.unloadModel(modelKey);
    } catch (err) {
      logError('Unload failed for "' + modelKey + '":', err.message || err);
    }
  };

  window.imgdescMMRemove = async function (modelKey) {
    if (!window.ImageDescriberModelManager) return;
    try {
      await window.ImageDescriberModelManager.removeCachedModel(modelKey);
      refreshStorage();
    } catch (err) {
      logError('Remove failed for "' + modelKey + '":', err.message || err);
    }
  };

  window.imgdescMMRequestPersist = async function () {
    if (!window.ImageDescriberModelManager) return;
    try {
      var granted =
        await window.ImageDescriberModelManager.requestPersistentStorage();
      if (granted) {
        logInfo("Persistent storage granted");
        notifySuccess("Persistent storage granted — cached models are protected from browser eviction.");
      } else {
        logWarn("Persistent storage denied");
        notifyWarning("Persistent storage was denied by the browser. Cached models may be evicted under disk pressure.");
      }
      refreshStorage();
    } catch (err) {
      logError("Persist request failed:", err.message || err);
      notifyError("Persistent storage request failed: " + (err.message || err));
    }
  };

  window.imgdescMMClearCache = async function () {
    if (!window.ImageDescriberModelManager) return;
    var allClearBtns = [els.cacheClearBtn, setupEls.cacheClearBtn].filter(Boolean);
    for (var bi = 0; bi < allClearBtns.length; bi++) {
      allClearBtns[bi].disabled = true;
      allClearBtns[bi].textContent = "Clearing…";
    }
    try {
      await window.ImageDescriberModelManager.clearAnalysisCache();
      refreshCacheStats();
    } catch (err) {
      logError("Clear cache failed:", err.message || err);
    }
    // Restore button text via icon library
    var iconHtml = "";
    if (typeof window.getIcon === "function") {
      iconHtml =
        '<span aria-hidden="true">' + window.getIcon("trash") + "</span> ";
    } else {
      iconHtml = '<span aria-hidden="true" data-icon="trash"></span> ';
    }
    for (var ri = 0; ri < allClearBtns.length; ri++) {
      allClearBtns[ri].innerHTML = iconHtml + "Clear Cache";
    }
  };

  // Phase 11E: Expose cache stats refresh so other modules can trigger it
  // after cache save/delete operations without opening the panel
  window.imgdescMMRefreshCacheStats = refreshCacheStats;

  // ========================================================================
  // DOWNLOAD PROGRESS
  // ========================================================================

  /**
   * Per-model download tracking state.
   * Keys are modelKey strings, values are aggregate tracking objects
   * that track progress across all files being downloaded for that model.
   */
  var downloadTracking = {};

  /** UI throttle interval in milliseconds — prevents flickering on bar/percentage */
  var UI_THROTTLE_MS = 200;

  /** Detail text (file, speed, ETA) update interval — kept short since
   *  ResilientFetch chunk events provide smooth, infrequent progress data */
  var DETAIL_THROTTLE_MS = 500;

  /**
   * Format bytes into a human-readable string (e.g. "134 MB").
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
   * Extract a short file name from a path (e.g. "onnx/decoder_model_merged.onnx" → "decoder_model_merged.onnx").
   * @param {string} filePath
   * @returns {string}
   */
  function shortFileName(filePath) {
    if (!filePath) return "";
    var parts = filePath.split("/");
    return parts[parts.length - 1];
  }

  /**
   * Update the progress bar for a downloading model.
   *
   * Aggregates progress across all files (Florence-2 downloads multiple ONNX
   * files in parallel — vision_encoder, decoder, embeddings, etc.).  Tracks
   * each file by its path, sums loaded/total across all known files, and
   * enforces monotonic percentage so the bar never goes backwards.
   *
   * UI updates are throttled to UI_THROTTLE_MS to prevent flickering.
   *
   * @param {string} modelKey
   * @param {object} progress - { file, loaded, total, status, name }
   */
  function updateDownloadProgress(modelKey, progress) {
    var items = getModelElements(modelKey);
    if (items.length === 0) return;

    // Show progress containers in all locations
    for (var pi = 0; pi < items.length; pi++) {
      var pc = items[pi].querySelector(".imgdesc-mm-progress");
      if (pc) pc.hidden = false;
    }

    // Use first item for primary progress tracking
    var item = items[0];
    var container = item.querySelector(".imgdesc-mm-progress");
    if (!container) return;

    var bar = container.querySelector(".imgdesc-mm-progress-bar");
    var fill = container.querySelector(".imgdesc-mm-progress-bar-fill");
    var text = container.querySelector(".imgdesc-mm-progress-text");
    var detail = container.querySelector(".imgdesc-mm-progress-detail");

    // Ensure aggregate tracking object exists
    var track = downloadTracking[modelKey];
    if (!track) {
      track = {
        startTime: Date.now(),
        files: {}, // { [fileKey]: { loaded, total, done } }
        lastUIUpdate: 0, // Timestamp of last bar/pct DOM update
        lastDetailUpdate: 0, // Timestamp of last detail dl update
        lastSpeedTime: Date.now(),
        lastSpeedLoaded: 0,
        smoothedSpeed: 0, // MB/s (smoothed)
        currentFile: "", // Most recently active file name
      };
      downloadTracking[modelKey] = track;
    }

    if (!progress) return;

    var fileKey = progress.file || progress.name || "unknown";

    // ── Handle "initiate" — register a new file ──
    if (progress.status === "initiate") {
      if (!track.files[fileKey]) {
        track.files[fileKey] = { loaded: 0, total: 0, done: false };
      }
      track.currentFile = shortFileName(fileKey);
      return;
    }

    // ── Handle "done" — mark individual file complete ──
    // NOTE: completion of the entire download is handled by
    // completeDownloadProgress(), called when preDownloadModel() resolves.
    // We do NOT try to detect "all files done" here — that races with
    // initiate events and causes false 100% on tiny config files.
    if (progress.status === "done") {
      if (track.files[fileKey]) {
        track.files[fileKey].loaded = track.files[fileKey].total;
        track.files[fileKey].done = true;
      }
      // Fall through to recalculate aggregate
    }

    // ── Handle "progress" — update per-file tracking ──
    if (progress.total > 0) {
      if (!track.files[fileKey]) {
        track.files[fileKey] = {
          loaded: 0,
          total: progress.total,
          done: false,
        };
      }
      track.files[fileKey].loaded = progress.loaded;
      track.files[fileKey].total = progress.total;
      track.currentFile = shortFileName(fileKey);
    }

    // ── Calculate aggregate progress across large files only ──
    // Tiny config/json files (<1 MB) are excluded — they complete
    // instantly and would spike the percentage to 100% before real
    // download files have even registered.
    var MIN_FILE_SIZE = 1024 * 1024; // 1 MB
    var totalBytes = 0;
    var loadedBytes = 0;
    var filesDone = 0;
    var filesTotal = 0;
    var aggFileKeys = Object.keys(track.files);
    for (var ai = 0; ai < aggFileKeys.length; ai++) {
      var f = track.files[aggFileKeys[ai]];
      if (f.total < MIN_FILE_SIZE) continue; // skip tiny files
      totalBytes += f.total;
      loadedBytes += f.loaded;
      filesTotal++;
      if (f.done) filesDone++;
    }

    // floor so it only reaches 100 when truly all bytes received
    var pct = totalBytes > 0 ? Math.floor((loadedBytes / totalBytes) * 100) : 0;

    // ── Throttle bar/percentage UI updates ──
    var now = Date.now();
    if (now - track.lastUIUpdate < UI_THROTTLE_MS) {
      return;
    }
    track.lastUIUpdate = now;

    // ── Update progress bar (all locations) ──
    for (var ui = 0; ui < items.length; ui++) {
      var uiContainer = items[ui].querySelector(".imgdesc-mm-progress");
      if (!uiContainer) continue;
      var uiFill = uiContainer.querySelector(".imgdesc-mm-progress-bar-fill");
      var uiBar = uiContainer.querySelector(".imgdesc-mm-progress-bar");
      var uiText = uiContainer.querySelector(".imgdesc-mm-progress-text");
      if (uiFill) uiFill.style.width = pct + "%";
      if (uiBar) uiBar.setAttribute("aria-valuenow", String(pct));
      if (uiText) uiText.textContent = pct + "%";
    }

    // ── Calculate smoothed speed (internal — every 0.5s) ──
    var speedTimeDelta = (now - track.lastSpeedTime) / 1000;
    if (speedTimeDelta >= 0.5) {
      var speedBytesDelta = loadedBytes - track.lastSpeedLoaded;
      var instantSpeed = speedBytesDelta / speedTimeDelta / (1024 * 1024);
      if (instantSpeed >= 0) {
        track.smoothedSpeed =
          track.smoothedSpeed > 0
            ? track.smoothedSpeed * 0.7 + instantSpeed * 0.3
            : instantSpeed;
      }
      track.lastSpeedLoaded = loadedBytes;
      track.lastSpeedTime = now;
    }

    // ── Build detail dl (throttled separately — every DETAIL_THROTTLE_MS) ──
    if (
      now - track.lastDetailUpdate >= DETAIL_THROTTLE_MS ||
        track.lastDetailUpdate === 0
    ) {
      track.lastDetailUpdate = now;

      var html = "";
      if (filesTotal > 0) {
        html +=
          "<dt>Files</dt><dd>" +
          filesDone +
          " of " +
          filesTotal +
          " complete</dd>";
      }
      html +=
        "<dt>Downloaded</dt><dd>" +
        formatBytes(loadedBytes) +
        " / " +
        formatBytes(totalBytes) +
        "</dd>";
      if (track.smoothedSpeed > 0.01) {
        html +=
          "<dt>Speed</dt><dd>" + track.smoothedSpeed.toFixed(1) + " MB/s</dd>";
        var remainingBytes = totalBytes - loadedBytes;
        var etaSeconds = remainingBytes / (track.smoothedSpeed * 1024 * 1024);
        var etaStr = formatETA(etaSeconds);
        if (etaStr) {
          html += "<dt>Remaining</dt><dd>" + etaStr + "</dd>";
        }
      }
      // Update detail in all locations
      for (var di = 0; di < items.length; di++) {
        var dDetail = items[di].querySelector(".imgdesc-mm-progress-detail");
        if (dDetail) dDetail.innerHTML = html;
      }
    }
  }

  /**
   * Mark a download as complete — called when preDownloadModel() resolves.
   * This is the authoritative "done" signal (not the per-file done events).
   * @param {string} modelKey
   */
  function completeDownloadProgress(modelKey) {
    var items = getModelElements(modelKey);
    if (items.length === 0) return;

    var track = downloadTracking[modelKey];
    var fileCount = track ? Object.keys(track.files).length : 0;

    for (var ci = 0; ci < items.length; ci++) {
      var container = items[ci].querySelector(".imgdesc-mm-progress");
      if (!container) continue;

      var bar = container.querySelector(".imgdesc-mm-progress-bar");
      var fill = container.querySelector(".imgdesc-mm-progress-bar-fill");
      var text = container.querySelector(".imgdesc-mm-progress-text");
      var detail = container.querySelector(".imgdesc-mm-progress-detail");

      if (fill) fill.style.width = "100%";
      if (bar) bar.setAttribute("aria-valuenow", "100");
      if (text) text.textContent = "Complete";

      if (detail && fileCount > 0) {
        detail.innerHTML =
          "<dt>Status</dt><dd>" +
          fileCount +
          " file" +
          (fileCount !== 1 ? "s" : "") +
          " downloaded</dd>";
      } else if (detail) {
        detail.innerHTML = "<dt>Status</dt><dd>Download complete</dd>";
      }
    }

    delete downloadTracking[modelKey];
  }

  // ========================================================================
  // EVENT LISTENER FOR STATE CHANGES
  // ========================================================================

  function listenForStateChanges() {
    if (window.EmbedEventEmitter) {
      window.EmbedEventEmitter.on("model:stateChange", function (data) {
        logDebug("State change event:", data.modelKey, data.newState);
        updateModelUI(data.modelKey, data.newState);
      });
    }
  }

  // ========================================================================
  // PANEL OPEN HANDLER
  // ========================================================================

  /**
   * When the <details> panel is opened, refresh all data.
   */
  function onPanelToggle() {
    if (els.panel && els.panel.open) {
      logDebug("Panel opened — refreshing");
      refreshAllModels();
      refreshStorage();
      refreshCacheStats();
    }
  }

  // ========================================================================
  // TEXT MODEL CARDS (Phase 9)
  // ========================================================================

  /**
   * Hardware class labels for benchmark table rows.
   */
  var HW_LABELS = {
    "vega-10-igpu": "Vega 10 iGPU (2 GB)",
    "gtx-1650-super": "GTX 1650 SUPER (4 GB)",
    "radeon-780m-igpu": "Radeon 780M iGPU (shared)",
    "rtx-4060": "RTX 4060 (8 GB)",
    "rtx-4070": "RTX 4070 (12 GB)",
  };

  /**
   * Returns a speed rating span with aria-label.
   * @param {number} tokPerSec — tokens per second
   * @returns {string} HTML string
   */
  function getSpeedRating(tokPerSec) {
    var text, dots, cls;
    if (tokPerSec >= 30) {
      text = "Fast";
      dots = "\u25CF\u25CF\u25CF";
      cls = "setup-speed-fast";
    } else if (tokPerSec >= 10) {
      text = "Moderate";
      dots = "\u25CF\u25CF\u25CB";
      cls = "setup-speed-moderate";
    } else if (tokPerSec >= 5) {
      text = "Slow";
      dots = "\u25CF\u25CB\u25CB";
      cls = "setup-speed-slow";
    } else {
      text = "Very slow";
      dots = "\u25CB\u25CB\u25CB";
      cls = "setup-speed-very-slow";
    }
    return (
      '<span class="setup-speed-rating ' +
      cls +
      '" aria-label="' +
      text +
      ": " +
      tokPerSec +
      ' tokens per second">' +
      dots +
      "</span>"
    );
  }

  /**
   * Populates the expandable model cards for text models.
   * Reads from LocalTextModelRegistry.userInfo for each enabled model.
   */
  function populateTextModelCards() {
    var registry = window.LocalTextModelRegistry;
    if (!registry) {
      logDebug("LocalTextModelRegistry not available — skipping card population");
      return;
    }

    var models = registry.getEnabled();
    for (var i = 0; i < models.length; i++) {
      var model = models[i];
      var info = model.userInfo;
      if (!info) continue;

      var key = model.key;

      // Summary
      var summaryEl = document.getElementById("setup-card-summary-" + key);
      if (summaryEl) {
        summaryEl.textContent = info.summary || "";
      }

      // Strengths (as <ul>)
      var strengthsEl = document.getElementById("setup-card-strengths-" + key);
      if (strengthsEl && info.strengths) {
        var ul = document.createElement("ul");
        for (var s = 0; s < info.strengths.length; s++) {
          var li = document.createElement("li");
          li.textContent = info.strengths[s];
          ul.appendChild(li);
        }
        strengthsEl.innerHTML = "";
        strengthsEl.appendChild(ul);
      }

      // Weaknesses (as <ul>)
      var weaknessesEl = document.getElementById("setup-card-weaknesses-" + key);
      if (weaknessesEl && info.weaknesses) {
        var ul2 = document.createElement("ul");
        for (var w = 0; w < info.weaknesses.length; w++) {
          var li2 = document.createElement("li");
          li2.textContent = info.weaknesses[w];
          ul2.appendChild(li2);
        }
        weaknessesEl.innerHTML = "";
        weaknessesEl.appendChild(ul2);
      }

      // Best for
      var bestForEl = document.getElementById("setup-card-bestfor-" + key);
      if (bestForEl) {
        bestForEl.textContent = info.bestFor || "";
      }

      // Benchmark table rows
      var tbody = document.getElementById("setup-card-benchmarks-" + key);
      if (tbody && info.benchmarks) {
        tbody.innerHTML = "";
        var hwKeys = Object.keys(HW_LABELS);
        for (var h = 0; h < hwKeys.length; h++) {
          var hwKey = hwKeys[h];
          var benchmark = info.benchmarks[hwKey];
          if (!benchmark) continue;

          var row = document.createElement("tr");
          row.setAttribute("data-hw", hwKey);
          row.innerHTML =
            '<td data-label="Hardware">' +
            HW_LABELS[hwKey] +
            "</td>" +
            '<td data-label="Speed">' +
            benchmark.tokPerSec +
            " tok/s</td>" +
            '<td data-label="Context safe">' +
            (benchmark.contextSafe ? "Yes" : "Limited") +
            "</td>" +
            '<td data-label="Rating">' +
            getSpeedRating(benchmark.tokPerSec) +
            "</td>";
          tbody.appendChild(row);
        }
      }
    }

    logDebug("Text model cards populated");
  }

  /**
   * Detects the user's GPU via LocalTextModelGateway and highlights the
   * matching benchmark row in each text model card.
   */
  async function detectAndHighlightGPU() {
    var gateway = window.LocalTextModelGateway;
    if (!gateway || typeof gateway.detectGPU !== "function") {
      logDebug("LocalTextModelGateway.detectGPU not available — skipping GPU detection");
      return;
    }

    try {
      var gpuInfo = await gateway.detectGPU();
      if (!gpuInfo) {
        logDebug("GPU detection returned no result");
        return;
      }
      if (gpuInfo.type === "none") {
        logDebug("No WebGPU — skipping GPU highlight");
        return;
      }

      var desc = gpuInfo.description || "";
      var bufferGB = gpuInfo.maxBufferSize / (1024 * 1024 * 1024);

      // Map GPU description to hardware class key (adapter.info often empty)
      var hwKey = null;
      if (desc) {
        if (desc.indexOf("RTX 4070") !== -1) {
          hwKey = "rtx-4070";
        } else if (desc.indexOf("RTX 4060") !== -1) {
          hwKey = "rtx-4060";
        } else if (desc.indexOf("GTX 1650") !== -1 || desc.indexOf("GTX 1660") !== -1) {
          hwKey = "gtx-1650-super";
        } else if (desc.indexOf("Radeon 780M") !== -1 || desc.indexOf("Radeon 760M") !== -1) {
          hwKey = "radeon-780m-igpu";
        } else if (desc.indexOf("Vega") !== -1) {
          hwKey = "vega-10-igpu";
        }
      }

      // Fallback: match by buffer size when description is empty
      // maxBufferSize is typically 25% of VRAM, so 2GB buffer ≈ 8GB card
      if (!hwKey && gpuInfo.maxBufferSize > 0) {
        if (gpuInfo.isDiscrete) {
          if (bufferGB >= 2.5) {
            hwKey = "rtx-4070";      // 12 GB class (buffer ≥ 2.5 GB)
          } else if (bufferGB >= 1.5) {
            hwKey = "rtx-4060";      // 8 GB class (buffer ≈ 2 GB)
          } else {
            hwKey = "gtx-1650-super"; // 4 GB class (buffer ≈ 1 GB)
          }
        } else {
          if (bufferGB >= 1) {
            hwKey = "radeon-780m-igpu"; // Larger shared memory iGPU
          } else {
            hwKey = "vega-10-igpu";     // Small iGPU (≤ 2 GB)
          }
        }
        logDebug("GPU matched by buffer size: " + bufferGB.toFixed(1) + " GB → " + hwKey);
      }

      // Build a display label for the user
      var gpuLabel = desc || (gpuInfo.isDiscrete ? "Discrete GPU" : "Integrated GPU");
      if (!desc) {
        logDebug("GPU description empty — using type: " + gpuInfo.type + ", buffer: " + bufferGB.toFixed(1) + " GB");
      }

      // Highlight matching rows and show estimate paragraphs
      var registry = window.LocalTextModelRegistry;
      if (!registry) return;

      var models = registry.getEnabled();
      for (var i = 0; i < models.length; i++) {
        var model = models[i];
        var key = model.key;
        var tbody = document.getElementById("setup-card-benchmarks-" + key);
        var estimateEl = document.getElementById("setup-card-estimate-" + key);

        if (hwKey && tbody) {
          // Find and highlight the matching row
          var rows = tbody.querySelectorAll("tr[data-hw]");
          for (var r = 0; r < rows.length; r++) {
            if (rows[r].getAttribute("data-hw") === hwKey) {
              rows[r].classList.add("setup-benchmark-highlight");
            }
          }
        }

        // Show personalised estimate
        if (estimateEl) {
          if (hwKey && model.userInfo && model.userInfo.benchmarks && model.userInfo.benchmarks[hwKey]) {
            var bm = model.userInfo.benchmarks[hwKey];
            estimateEl.textContent =
              "Your GPU (" +
              gpuLabel +
              "): estimated " +
              bm.tokPerSec +
              " tok/s" +
              (bm.contextSafe ? ", full context supported" : ", limited context") +
              ".";
            estimateEl.hidden = false;
          } else {
            estimateEl.textContent =
              "GPU detected: " + gpuLabel + ". No benchmark data available for this GPU — expand the table to compare hardware.";
            estimateEl.hidden = false;
          }
        }
      }

      logDebug("GPU detection complete: " + gpuLabel + " → " + (hwKey || "no match"));
    } catch (err) {
      logWarn("GPU detection failed:", err.message || err);
    }
  }

  // ========================================================================
  // PUBLIC REFRESH (Phase SU-4a — callable from Set Up init)
  // ========================================================================

  /**
   * Refresh all model states, storage, and cache stats in both locations.
   * Safe to call at any time — caches elements if not already cached.
   */
  function refreshAll() {
    // Ensure elements are cached (handles first call before init)
    if (!els.panel && !setupEls.panel) {
      cacheElements();
    }
    refreshAllModels();
    refreshStorage();
    refreshCacheStats();

    // Phase 9: populate text model cards and detect GPU
    if (window.LocalTextModelRegistry) {
      populateTextModelCards();
      detectAndHighlightGPU();
    }

    logDebug("refreshAll complete");
  }

  // ========================================================================
  // INITIALISATION
  // ========================================================================

  function init() {
    cacheElements();

    if (!els.panel && !setupEls.panel) {
      logWarn("No Model Manager panel found in DOM — skipping init");
      return;
    }

    // Listen for Image Describer panel open/close
    if (els.panel) {
      els.panel.addEventListener("toggle", onPanelToggle);
    }

    // Listen for model state change events
    listenForStateChanges();

    logDebug("UI initialised");
  }

  // Run init when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ========================================================================
  // PUBLIC API (Phase SU-4a)
  // ========================================================================

  window.ImageDescriberModelManagerUI = {
    refreshAll: refreshAll,
  };
})();
