/**
 * TTS Read Aloud — Phase 5: Image Describer UI Integration
 *
 * Manages the "Read Aloud" button lifecycle for the Image Describer tool.
 * Extracts plain text from the description output and routes it through
 * TTSController.speak(). Observes the output container via MutationObserver
 * to enable/disable the button automatically.
 *
 * Exposes: window.TTSReadAloud
 *
 * @author Matthew Deeprose
 */
var TTSReadAloud = (function () {
  'use strict';

  // ==========================================================================
  // LOGGING CONFIGURATION
  // ==========================================================================

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
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.ERROR)) console.error.apply(console, ['[TTSReadAloud]', message].concat(args));
  }

  function logWarn(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.WARN)) console.warn.apply(console, ['[TTSReadAloud]', message].concat(args));
  }

  function logInfo(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.INFO)) console.log.apply(console, ['[TTSReadAloud]', message].concat(args));
  }

  function logDebug(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log.apply(console, ['[TTSReadAloud]', message].concat(args));
  }

  // ==========================================================================
  // STATE
  // ==========================================================================

  var STATES = { IDLE: 'idle', SPEAKING: 'speaking', PAUSED: 'paused' };
  var currentState = STATES.IDLE;
  var observer = null;
  var initialised = false;

  // ==========================================================================
  // CACHED DOM ELEMENTS
  // ==========================================================================

  var els = {
    button: null,
    label: null,
    badge: null,
    status: null,
    output: null,
    saveAudioButton: null,
    saveAudioLabel: null,
    saveAudioFormatButton: null,
    saveAudioFormatLabel: null,
    saveAudioProgress: null,
    saveAudioProgressBar: null,
    saveAudioProgressFill: null,
    saveAudioProgressText: null
  };

  /** True while an export is in progress — prevents double-click */
  var exporting = false;

  // ==========================================================================
  // EXPORT FORMAT (Phase 11 — MP3 Export)
  // ==========================================================================

  var EXPORT_FORMAT_KEY = 'tts-export-format';
  var DEFAULT_EXPORT_FORMAT = 'mp3';

  function getExportFormat() {
    try {
      var stored = localStorage.getItem(EXPORT_FORMAT_KEY);
      if (stored === 'wav' || stored === 'mp3') return stored;
    } catch (e) { /* localStorage unavailable */ }
    return DEFAULT_EXPORT_FORMAT;
  }

  function setExportFormat(format) {
    if (format !== 'wav' && format !== 'mp3') return;
    try {
      localStorage.setItem(EXPORT_FORMAT_KEY, format);
    } catch (e) { /* localStorage unavailable */ }
    refreshFormatToggle();
  }

  function refreshFormatToggle() {
    var format = getExportFormat();
    var label = format.toUpperCase();
    var other = format === 'mp3' ? 'WAV' : 'MP3';

    // Update main button label
    if (els.saveAudioLabel) {
      els.saveAudioLabel.textContent = 'Save as ' + label;
    }
    if (els.saveAudioButton) {
      els.saveAudioButton.setAttribute(
        'aria-label',
        'Save description as ' + label + ' audio file'
      );
    }

    // Update dropdown segment
    if (els.saveAudioFormatLabel) {
      els.saveAudioFormatLabel.textContent = label;
    }
    if (els.saveAudioFormatButton) {
      els.saveAudioFormatButton.setAttribute(
        'aria-label',
        'Change audio format. Currently ' + label + '.'
      );
    }
  }

  function handleFormatToggleClick() {
    if (exporting) return;
    var current = getExportFormat();
    var next = current === 'mp3' ? 'wav' : 'mp3';
    setExportFormat(next);
    announce('Audio format set to ' + next.toUpperCase());
    logInfo('Export format changed to ' + next);
  }

  // ==========================================================================
  // STATE MACHINE
  // ==========================================================================

  /**
   * Transition button appearance and aria attributes to match the given state.
   * @param {string} state — one of STATES.IDLE | STATES.SPEAKING | STATES.PAUSED
   */
  function setButtonState(state) {
    currentState = state;
    if (!els.button || !els.label) return;

    var icon = els.button.querySelector('[data-icon]');

    switch (state) {
      case STATES.SPEAKING:
        els.label.textContent = 'Stop';
        if (icon) icon.setAttribute('data-icon', 'close');
        els.button.setAttribute('aria-label', 'Stop reading');
        showEngineBadge();
        announce('Reading description aloud');
        logDebug('State → speaking');
        break;

      case STATES.PAUSED:
        els.label.textContent = 'Resume';
        if (icon) icon.setAttribute('data-icon', 'message');
        els.button.setAttribute('aria-label', 'Resume reading');
        logDebug('State → paused');
        break;

      case STATES.IDLE:
      default:
        els.label.textContent = 'Read Aloud';
        if (icon) icon.setAttribute('data-icon', 'message');
        els.button.setAttribute('aria-label', 'Read description aloud');
        hideEngineBadge();
        if (currentState !== STATES.IDLE) {
          announce('Finished reading');
        }
        // Re-check if button should be enabled/disabled
        refreshButtonEnabled();
        logDebug('State → idle');
        break;
    }

    // Re-render the icon SVG if the icon library is available
    if (icon && typeof window.refreshIcons === 'function') {
      window.refreshIcons(els.button);
    }
  }

  // ==========================================================================
  // ENGINE BADGE
  // ==========================================================================

  function showEngineBadge() {
    if (!els.badge) return;
    var engine = getTTSEngine();
    els.badge.textContent = engine === 'webspeech' ? 'Browser voice' : 'Natural voice';
    els.badge.hidden = false;
  }

  function hideEngineBadge() {
    if (!els.badge) return;
    els.badge.textContent = '';
    els.badge.hidden = true;
  }

  function getTTSEngine() {
    if (window.TTSController && typeof window.TTSController.getEngine === 'function') {
      return window.TTSController.getEngine();
    }
    return 'webspeech';
  }

  // ==========================================================================
  // ARIA LIVE ANNOUNCEMENTS
  // ==========================================================================

  function announce(message) {
    if (!els.status) return;
    // Clear first to ensure repeated identical messages are still announced
    els.status.textContent = '';
    setTimeout(function () {
      els.status.textContent = message;
    }, 50);
  }

  // ==========================================================================
  // TEXT EXTRACTION
  // ==========================================================================

  /**
   * Extract a semantic result object from the Image Describer output container.
   * Returns { text, sections } when TTSSemantic is available, or
   * { text, sections: null } as a fallback (controller uses legacy chunking).
   * @returns {{ text: string, sections: Array|null }|null}
   */
  function getOutputResult() {
    var output = els.output || document.getElementById('imgdesc-output');
    if (!output) return null;

    // Use semantic lineariser if available, with current verbosity preference
    if (window.TTSSemantic && typeof window.TTSSemantic.linearise === 'function') {
      var result = window.TTSSemantic.linearise(output, {
        verbosity: window.TTSSemantic.getVerbosity()
      });
      if (result && result.text) return result;
    }

    // Fallback: plain text (no sections — controller will use legacy chunking)
    var plainText = (output.innerText || output.textContent || '').trim();
    return plainText ? { text: plainText, sections: null } : null;
  }

  // ==========================================================================
  // BUTTON ENABLE / DISABLE
  // ==========================================================================

  /**
   * Check whether the button should be enabled and update accordingly.
   * The button is enabled when: output text exists AND at least one TTS
   * engine is available.
   */
  function refreshButtonEnabled() {
    if (!els.button) return;

    var result = getOutputResult();
    var hasText = !!(result && result.text);
    var ttsAvailable = isTTSAvailable();
    // Don't enable while a description is still streaming in — the user
    // should read the finished output, not a partial sentence.
    var isGenerating = !!(
      window.ImageDescriberController &&
      window.ImageDescriberController.isGenerating
    );

    els.button.disabled = !hasText || !ttsAvailable || isGenerating;
    logDebug('Button enabled refresh', {
      hasText: hasText,
      ttsAvailable: ttsAvailable,
      isGenerating: isGenerating,
      disabled: els.button.disabled
    });
  }

  // ==========================================================================
  // SAVE AS AUDIO — ENABLE / DISABLE / CLICK
  // ==========================================================================

  /**
   * Check whether the Save as Audio button should be enabled and update it.
   * Enabled when: output has text AND engine is neural AND model is loaded or cached.
   */
  function refreshSaveAudioEnabled() {
    if (!els.saveAudioButton || !els.saveAudioLabel) return;
    if (exporting) return; // Don't change state mid-export

    var result = getOutputResult();
    var hasText = !!(result && result.text);
    var isGenerating = !!(
      window.ImageDescriberController &&
      window.ImageDescriberController.isGenerating
    );
    var engine = getTTSEngine();
    var isNeural = engine !== 'webspeech';
    var modelReady = false;

    if (isNeural && window.TTSNeuralGateway &&
        typeof window.TTSNeuralGateway.getModelState === 'function') {
      var state = window.TTSNeuralGateway.getModelState('supertonic');
      modelReady = (state === 'loaded' || state === 'cached');
    }

    var canExport = hasText && !isGenerating && isNeural && modelReady;
    var format = getExportFormat().toUpperCase();
    els.saveAudioButton.disabled = !canExport;
    if (els.saveAudioFormatButton) els.saveAudioFormatButton.disabled = !canExport;

    // Update label to nudge users when on webspeech
    if (!isNeural) {
      els.saveAudioLabel.textContent = 'Save as ' + format + ' (requires natural voice)';
      els.saveAudioButton.setAttribute('aria-label', 'Save as ' + format + ' — requires natural voice engine');
    } else if (!modelReady) {
      els.saveAudioLabel.textContent = 'Save as ' + format + ' (model loading\u2026)';
      els.saveAudioButton.setAttribute('aria-label', 'Save as ' + format + ' — model is loading');
    } else {
      refreshFormatToggle();
    }

    logDebug('Save audio refresh', {
      hasText: hasText, isNeural: isNeural, modelReady: modelReady,
      isGenerating: isGenerating, disabled: els.saveAudioButton.disabled
    });
  }

  /**
   * Handle click on the Save as Audio button.
   */
  /**
   * Show the export progress bar in its initial (indeterminate) state.
   * Called before the first tts:exportProgress event fires.
   */
  function showExportProgress() {
    if (!els.saveAudioProgress) return;
    els.saveAudioProgress.hidden = false;
    if (els.saveAudioProgressFill) {
      els.saveAudioProgressFill.style.width = '0%';
    }
    if (els.saveAudioProgressBar) {
      els.saveAudioProgressBar.setAttribute('aria-valuenow', '0');
    }
    if (els.saveAudioProgressText) {
      els.saveAudioProgressText.textContent = 'Starting\u2026';
    }
  }

  /**
   * Update the export progress bar from a tts:exportProgress event.
   * @param {number} chunk - 1-based index of chunk just generated
   * @param {number} totalChunks - total number of chunks to generate
   */
  function updateExportProgress(chunk, totalChunks) {
    if (!els.saveAudioProgress || !totalChunks) return;
    var percent = Math.round((chunk / totalChunks) * 100);
    if (els.saveAudioProgressFill) {
      els.saveAudioProgressFill.style.width = percent + '%';
    }
    if (els.saveAudioProgressBar) {
      els.saveAudioProgressBar.setAttribute('aria-valuenow', String(percent));
    }
    if (els.saveAudioProgressText) {
      els.saveAudioProgressText.textContent = chunk + ' / ' + totalChunks;
    }
    if (els.saveAudioLabel) {
      els.saveAudioLabel.textContent =
        'Generating ' + chunk + ' of ' + totalChunks + '\u2026';
    }
  }

  /**
   * Update the progress bar during the MP3 encoding phase (after all chunks
   * have been generated). Reuses the same progress element as generation but
   * relabels it so users see the two distinct phases.
   * @param {number} percent — 0–100
   */
  function updateEncodeProgress(percent) {
    if (!els.saveAudioProgress) return;
    var p = Math.max(0, Math.min(100, Math.round(percent)));
    if (els.saveAudioProgressFill) {
      els.saveAudioProgressFill.style.width = p + '%';
    }
    if (els.saveAudioProgressBar) {
      els.saveAudioProgressBar.setAttribute('aria-valuenow', String(p));
    }
    if (els.saveAudioProgressText) {
      els.saveAudioProgressText.textContent = 'Encoding ' + p + '%';
    }
    if (els.saveAudioLabel) {
      els.saveAudioLabel.textContent = 'Encoding MP3 ' + p + '%\u2026';
    }
  }

  /**
   * Hide the export progress bar and reset its state.
   */
  function hideExportProgress() {
    if (!els.saveAudioProgress) return;
    els.saveAudioProgress.hidden = true;
    if (els.saveAudioProgressFill) els.saveAudioProgressFill.style.width = '0%';
    if (els.saveAudioProgressBar) els.saveAudioProgressBar.setAttribute('aria-valuenow', '0');
    if (els.saveAudioProgressText) els.saveAudioProgressText.textContent = '';
  }

  function handleSaveAudioClick() {
    if (!window.TTSController) {
      logWarn('TTSController not available');
      return;
    }

    var format = getExportFormat();
    var exportFn = format === 'mp3'
      ? window.TTSController.exportMp3
      : window.TTSController.exportWav;

    if (typeof exportFn !== 'function') {
      logWarn('TTSController.export' + format.toUpperCase() + ' not available');
      return;
    }

    var result = getOutputResult();
    if (!result || !result.text) {
      logWarn('No text to export');
      return;
    }

    // Prevent double-click
    exporting = true;
    els.saveAudioButton.disabled = true;
    if (els.saveAudioFormatButton) els.saveAudioFormatButton.disabled = true;
    els.saveAudioLabel.textContent = 'Generating\u2026';
    var icon = els.saveAudioButton.querySelector('[data-icon]');
    if (icon) {
      icon.setAttribute('data-icon', 'hourglass');
      if (typeof window.refreshIcons === 'function') window.refreshIcons(els.saveAudioButton);
    }
    showExportProgress();
    announce('Generating ' + format.toUpperCase() + ' audio file\u2026');

    exportFn.call(window.TTSController, result)
      .then(function () {
        announce('Audio file saved');
        if (typeof window.notifySuccess === 'function') {
          window.notifySuccess('Audio file saved successfully.');
        }
      })
      .catch(function (err) {
        logError(format.toUpperCase() + ' export failed', err);
        announce('Audio export failed: ' + (err && err.message ? err.message : 'unknown error'));
        if (typeof window.notifyWarning === 'function') {
          window.notifyWarning('Audio export failed: ' + (err && err.message ? err.message : 'unknown error'));
        }
      })
      .then(function () {
        // Always restore button state (finally equivalent)
        exporting = false;
        if (els.saveAudioFormatButton) els.saveAudioFormatButton.disabled = false;
        hideExportProgress();
        refreshFormatToggle();
        if (icon) {
          icon.setAttribute('data-icon', 'download');
          if (typeof window.refreshIcons === 'function') window.refreshIcons(els.saveAudioButton);
        }
        refreshSaveAudioEnabled();
      });
  }

  /**
   * Check if any TTS engine is available.
   * @returns {boolean}
   */
  function isTTSAvailable() {
    if (!window.TTSController) return false;
    if (typeof window.TTSController.isAvailable === 'function') {
      return window.TTSController.isAvailable();
    }
    return false;
  }

  // ==========================================================================
  // CLICK HANDLER
  // ==========================================================================

  function handleClick() {
    if (!window.TTSController) {
      logWarn('TTSController not available');
      return;
    }

    switch (currentState) {
      case STATES.IDLE:
        var result = getOutputResult();
        if (!result || !result.text) {
          logWarn('No text to read');
          return;
        }
        logInfo('Starting speech, text length:', result.text.length);
        window.TTSController.speak(result);
        break;

      case STATES.SPEAKING:
        logInfo('Stopping speech');
        window.TTSController.stop();
        break;

      case STATES.PAUSED:
        logInfo('Resuming speech');
        window.TTSController.resume();
        break;
    }
  }

  // ==========================================================================
  // EVENT WIRING (TTS events via EmbedEventEmitter)
  // ==========================================================================

  function wireEvents() {
    if (!window.EmbedEventEmitter || typeof window.EmbedEventEmitter.on !== 'function') {
      logWarn('EmbedEventEmitter not available — TTS events will not update button state');
      return;
    }

    window.EmbedEventEmitter.on('tts:start', function () {
      setButtonState(STATES.SPEAKING);
    });

    window.EmbedEventEmitter.on('tts:end', function () {
      setButtonState(STATES.IDLE);
    });

    window.EmbedEventEmitter.on('tts:error', function (data) {
      logError('TTS error received', data);
      setButtonState(STATES.IDLE);
    });

    window.EmbedEventEmitter.on('tts:pause', function () {
      setButtonState(STATES.PAUSED);
    });

    window.EmbedEventEmitter.on('tts:resume', function () {
      setButtonState(STATES.SPEAKING);
    });

    // Save as Audio — react to engine changes and model state changes
    window.EmbedEventEmitter.on('tts:engineChanged', function () {
      logDebug('Engine changed — refreshing save audio state');
      refreshSaveAudioEnabled();
    });

    window.EmbedEventEmitter.on('model:stateChange', function () {
      logDebug('Model state changed — refreshing save audio state');
      refreshSaveAudioEnabled();
    });

    // Export progress — update the inline progress bar during multi-chunk generation
    window.EmbedEventEmitter.on('tts:exportProgress', function (data) {
      if (!data || typeof data.chunk !== 'number' || typeof data.totalChunks !== 'number') return;
      updateExportProgress(data.chunk, data.totalChunks);
    });

    // MP3 encode progress — second phase after chunk generation finishes
    window.EmbedEventEmitter.on('tts:exportEncodeProgress', function (data) {
      if (!data || typeof data.percent !== 'number') return;
      updateEncodeProgress(data.percent);
    });

    logInfo('TTS event listeners wired');
  }

  // ==========================================================================
  // MUTATION OBSERVER — watch imgdesc-output for content changes
  // ==========================================================================

  function startObserver() {
    if (observer) return; // Already watching

    var target = document.getElementById('imgdesc-output');
    if (!target) {
      logDebug('imgdesc-output not found — observer not started');
      return;
    }

    els.output = target;

    observer = new MutationObserver(function () {
      logDebug('imgdesc-output content changed');
      refreshButtonEnabled();
      refreshSaveAudioEnabled();
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true
    });

    logInfo('MutationObserver started on imgdesc-output');
  }

  // ==========================================================================
  // INITIALISATION
  // ==========================================================================

  function init() {
    if (initialised) return;

    // Cache DOM elements
    els.button = document.getElementById('imgdesc-read-aloud');
    els.label = document.getElementById('imgdesc-read-aloud-label');
    els.badge = document.getElementById('imgdesc-read-aloud-engine');
    els.status = document.getElementById('imgdesc-read-aloud-status');
    els.output = document.getElementById('imgdesc-output');

    if (!els.button) {
      logWarn('Read Aloud button not found in DOM — aborting init');
      return;
    }

    // Cache Save as Audio elements
    els.saveAudioButton = document.getElementById('imgdesc-save-audio');
    els.saveAudioLabel = document.getElementById('imgdesc-save-audio-label');
    els.saveAudioFormatButton = document.getElementById('imgdesc-save-audio-format');
    els.saveAudioFormatLabel = document.getElementById('imgdesc-save-audio-format-label');
    els.saveAudioProgress = document.getElementById('imgdesc-save-audio-progress');
    if (els.saveAudioProgress) {
      els.saveAudioProgressBar = els.saveAudioProgress.querySelector('.imgdesc-mm-progress-bar');
      els.saveAudioProgressFill = els.saveAudioProgress.querySelector('.imgdesc-mm-progress-bar-fill');
      els.saveAudioProgressText = els.saveAudioProgress.querySelector('.imgdesc-mm-progress-text');
    }

    // Attach click handlers
    els.button.addEventListener('click', handleClick);
    if (els.saveAudioButton) {
      els.saveAudioButton.addEventListener('click', handleSaveAudioClick);
    }
    if (els.saveAudioFormatButton) {
      els.saveAudioFormatButton.addEventListener('click', handleFormatToggleClick);
      refreshFormatToggle();
    }

    // Wire TTS events
    wireEvents();

    // Start observing output container
    startObserver();

    // Initial state check
    refreshButtonEnabled();
    refreshSaveAudioEnabled();

    // Preload the neural TTS model in the background if applicable.
    // Non-blocking and failure-tolerant — safe to call unconditionally.
    if (window.TTSController && typeof window.TTSController.preloadIfNeeded === 'function') {
      try {
        window.TTSController.preloadIfNeeded();
      } catch (e) {
        logDebug('preloadIfNeeded threw (non-critical): ' + e.message);
      }
    }

    initialised = true;
    logInfo('TTSReadAloud initialised');
  }

  // ==========================================================================
  // AUTO-INIT on DOMContentLoaded (or immediately if already loaded)
  // ==========================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  return {
    /** Manually refresh button enabled state (e.g. after generation completes). */
    refresh: function () {
      refreshButtonEnabled();
      refreshSaveAudioEnabled();
    },

    /** Re-initialise if DOM was rebuilt. */
    init: init,

    /** Get current button state ('idle' | 'speaking' | 'paused'). */
    getState: function () {
      return currentState;
    }
  };
})();
