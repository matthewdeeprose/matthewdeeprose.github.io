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

  var STATES = { IDLE: 'idle', LOADING: 'loading', SPEAKING: 'speaking', PAUSED: 'paused' };
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
    saveAudioFormatLabel: null
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

    // Update main button label.
    //
    // SC 2.5.3: the label span is the ONLY name source — no aria-label. Both of
    // these buttons carry a visible label that this module swaps through several
    // states, and a name written alongside it drifted out of step in two ways:
    // the wording differed in the states it did update ("Save as MP3 (requires
    // natural voice)" named "Save as MP3 — requires natural voice engine"), and
    // the progress states below (Generating…, Encoding MP3 45%…) change the
    // visible text and never touched the name at all, leaving it stale. No
    // static or per-state aria-label can satisfy 2.5.3 across those states, so
    // the content names the button and the two cannot diverge.
    if (els.saveAudioLabel) {
      els.saveAudioLabel.textContent = 'Save as ' + label;
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
      case STATES.LOADING:
        // No aria-label in any state below: the visible label span names the
        // button, so the two stay in step by construction. See refreshFormatToggle().
        els.label.textContent = 'Preparing…';
        if (icon) icon.setAttribute('data-icon', 'hourglass');
        els.button.disabled = true;
        announce('Preparing description');
        logDebug('State → loading');
        break;

      case STATES.SPEAKING:
        els.label.textContent = 'Stop';
        if (icon) icon.setAttribute('data-icon', 'close');
        els.button.disabled = false;
        showEngineBadge();
        announce('Reading description aloud');
        logDebug('State → speaking');
        break;

      case STATES.PAUSED:
        els.label.textContent = 'Resume';
        if (icon) icon.setAttribute('data-icon', 'message');
        els.button.disabled = false;
        logDebug('State → paused');
        break;

      case STATES.IDLE:
      default:
        els.label.textContent = 'Read Aloud';
        if (icon) icon.setAttribute('data-icon', 'message');
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
   *
   * Synchronous text extraction — used by refreshButtonEnabled and
   * refreshSaveAudioEnabled for enabled-state checks (called on every
   * MutationObserver tick, so running SRE here would be wasteful). The
   * Clearspeak payload (with maths rewritten via SRE) is built only on actual
   * Speak/Save click via getPreparedOutputResult().
   *
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
  // CLEARSPEAK REWRITER (Stages 1 + 2 — delegated to TTSRewriters in Stage 3)
  // ==========================================================================

  /**
   * Clone the Image Describer output and replace each math element with a
   * synthetic <mjx-container> carrying SRE-generated Clearspeak as its
   * aria-label. The lineariser then produces consistent natural-language
   * speech regardless of which renderer (MathJax fallback or MMD CDN)
   * populated the output.
   *
   * Stage 3 moved the orchestration into window.TTSRewriters.preparePanelForTts
   * so Local Chat (third consumer) doesn't duplicate the same ~30 LOC. The
   * silent-degradation contract is unchanged: SRE failure leaves formulas
   * with their existing aria-labels; table-rewriter failure leaves the
   * original <table> for TTSSemantic.lineariseTable to handle.
   */
  function prepareImgdescOutputForTts(outputEl) {
    if (window.TTSRewriters && typeof window.TTSRewriters.preparePanelForTts === 'function') {
      return window.TTSRewriters.preparePanelForTts(outputEl);
    }
    // Defensive fallback: if the shared helper is missing (load order
    // broken, file failed to fetch), return the clone unchanged so the
    // lineariser still has something to walk. Mirrors the Stage 1 / Stage 2
    // graceful-degradation posture.
    logWarn('TTSRewriters.preparePanelForTts not available — returning unmodified clone');
    return Promise.resolve(outputEl ? outputEl.cloneNode(true) : null);
  }

  /**
   * Async counterpart to getOutputResult — runs the SRE rewriter pipeline
   * before linearising, so maths is spoken in Clearspeak rather than the
   * MathJax-default MathSpeak. Returns a {text, sections} payload suitable
   * for TTSController.speak(), or null on empty/missing output.
   *
   * On SRE failure, prepareImgdescOutputForTts resolves with the clone
   * unchanged (formulas keep their existing aria-labels), so this function
   * never throws — degradation is silent and audio remains intelligible.
   */
  function getPreparedOutputResult() {
    var output = els.output || document.getElementById('imgdesc-output');
    if (!output) return Promise.resolve(null);

    return prepareImgdescOutputForTts(output).then(function (target) {
      if (!target) return null;
      if (window.TTSSemantic && typeof window.TTSSemantic.linearise === 'function') {
        var result = window.TTSSemantic.linearise(target, {
          verbosity: window.TTSSemantic.getVerbosity(),
          // Belt-and-braces: any source-format tags missed by the math
          // selectors above (e.g. unwrapped formulas) are skipped here.
          skipSelectors: 'mathml, asciimath, latex'
        });
        if (result && result.text) return result;
      }
      var plain = (target.innerText || target.textContent || '').trim();
      return plain ? { text: plain, sections: null } : null;
    });
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
    // State machine owns the disabled flag while LOADING / SPEAKING / PAUSED.
    // Without this guard, a MutationObserver tick during the SRE prepare wait
    // (or mid-playback) could re-enable a "Preparing…" button or disable a
    // "Stop" button, both of which look wrong. Only refresh in IDLE.
    if (currentState !== STATES.IDLE) return;

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
    } else if (!modelReady) {
      els.saveAudioLabel.textContent = 'Save as ' + format + ' (model loading\u2026)';
    } else {
      refreshFormatToggle();
    }

    logDebug('Save audio refresh', {
      hasText: hasText, isNeural: isNeural, modelReady: modelReady,
      isGenerating: isGenerating, disabled: els.saveAudioButton.disabled
    });
  }

  /**
   * The audio-export progress bar is ONE page-level element declared in
   * tools.html (#audio-export-progress), outside every tool <article> and
   * outside any live region. See the comment on that markup for why.
   *
   * It used to be this button's own label plus a local bar inside
   * #imgdesc-output-section. That label IS the button's accessible name —
   * there is no aria-label — so every counter tick renamed the control: 23
   * name changes for one export, measured 18 August 2026. Nothing here
   * announces; the export's start and end sentences remain the only spoken
   * output.
   *
   * LOCAL COPY, not a shared import. chat/chat-messages.js and
   * local-chat/local-chat-messages.js each declare these same helpers
   * privately inside their own IIFE and expose neither, so there is nothing to
   * call. The three copies must stay behaviourally identical; extracting a
   * shared module is the obvious follow-up and is not this change.
   */
  var EXPORT_PROGRESS_IDS = Object.freeze({
    wrapper: 'audio-export-progress',
    bar: 'audio-export-progress-bar',
    fill: 'audio-export-progress-fill',
    text: 'audio-export-progress-text'
  });

  /**
   * Write one progress step. chunk/totalChunks of 0 clears the surface.
   * @param {number} chunk - 1-based chunk index just started
   * @param {number} totalChunks - total chunks in this export
   */
  function setExportProgress(chunk, totalChunks) {
    var bar = document.getElementById(EXPORT_PROGRESS_IDS.bar);
    var fill = document.getElementById(EXPORT_PROGRESS_IDS.fill);
    var text = document.getElementById(EXPORT_PROGRESS_IDS.text);
    var percent = totalChunks > 0 ? Math.round((chunk / totalChunks) * 100) : 0;

    if (bar) bar.setAttribute('aria-valuenow', String(percent));
    if (fill) fill.style.width = percent + '%';
    if (text) {
      // The surface no longer sits on the control, so it names what it is
      // doing rather than relying on the button for context.
      text.textContent =
        totalChunks > 0 ? 'Saving audio, ' + chunk + ' of ' + totalChunks : '';
    }
  }

  /**
   * Reveal the shared surface at export start.
   */
  function showExportProgress() {
    var wrapper = document.getElementById(EXPORT_PROGRESS_IDS.wrapper);
    if (!wrapper) return;
    setExportProgress(0, 0);
    wrapper.hidden = false;
  }

  /**
   * Update the shared surface from a tts:exportProgress event.
   *
   * The emitter is SHARED with both chat tools, so this guards on OWNERSHIP as
   * well as payload shape: `exporting` is this tool's equivalent of the chat
   * tools' activeExportingBtn filter. The older unguarded version reacted to
   * every tool's export, wrote Image Describer's DOM while Image Describer was
   * display:none, and left a stale accessible name on the button that nothing
   * restored.
   *
   * The button label is deliberately NOT touched — it is the accessible name.
   *
   * @param {number} chunk - 1-based index of chunk just generated
   * @param {number} totalChunks - total number of chunks to generate
   */
  function updateExportProgress(chunk, totalChunks) {
    if (!exporting || !totalChunks) return;
    setExportProgress(chunk, totalChunks);
  }

  /**
   * Hide the shared surface and reset it. Called from the export's finally.
   *
   * There is deliberately no tts:exportEncodeProgress companion, matching both
   * chat tools. encodeMp3's eleven emits share ONE macrotask, so no
   * intermediate encoding state was ever observable to anyone, sighted or
   * otherwise. tts/tts-controller.js still emits the event; nothing consumes it.
   */
  function hideExportProgress() {
    var wrapper = document.getElementById(EXPORT_PROGRESS_IDS.wrapper);
    if (!wrapper) return;
    wrapper.hidden = true;
    setExportProgress(0, 0);
  }

  function handleSaveAudioClick() {
    // Re-entry guard. Until 18 August 2026 re-entry was refused by the disabled
    // attribute, which cost the user their focus for the whole export. The
    // button now stays enabled, so a second click has to be refused here. There
    // is only one Save button in this tool, so a click during its own export is
    // always the same control: a silent no-op, with nothing to tell the user.
    if (exporting) return;

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

    // Cheap synchronous text-presence check up-front. The actual payload sent
    // to the controller is the Clearspeak-rewritten one from
    // getPreparedOutputResult() below \u2014 see Stage 1 of semantic-tts-plan.md.
    var preflight = getOutputResult();
    if (!preflight || !preflight.text) {
      logWarn('No text to export');
      return;
    }

    // Lock the UI immediately. NEITHER control is disabled: disabling a focused
    // control moves focus to <body>, and nothing restored it, so the user was
    // left on the document body for the whole export — measured 18 August 2026
    // by NVDA listen and reproduced by drive. Both stay enabled, keep their
    // names, and carry aria-busy instead. Same fix as both chat tools at
    // 95f2c0c.
    //
    // Re-entry is refused by the `exporting` guard at the top of this handler,
    // and for the format toggle by the identical check in
    // handleFormatToggleClick, so a mid-export format change still cannot
    // relabel the running button.
    //
    // refreshSaveAudioEnabled early-returns while `exporting`, so the resting
    // predicate cannot disable either control mid-export either; the finally
    // clears the flag before calling it, which restores the resting state.
    //
    // The LABEL is deliberately left alone: it is the button's accessible name,
    // so writing progress into it renamed the control on every tick. Progress
    // goes to the shared page-level surface instead.
    exporting = true;
    els.saveAudioButton.setAttribute('aria-busy', 'true');
    if (els.saveAudioFormatButton) {
      els.saveAudioFormatButton.setAttribute('aria-busy', 'true');
    }
    var icon = els.saveAudioButton.querySelector('[data-icon]');
    if (icon) {
      icon.setAttribute('data-icon', 'hourglass');
      if (typeof window.refreshIcons === 'function') window.refreshIcons(els.saveAudioButton);
    }
    showExportProgress();
    announce('Generating ' + format.toUpperCase() + ' audio file\u2026');

    getPreparedOutputResult()
      .then(function (result) {
        if (!result || !result.text) {
          throw new Error('No text to export after rewriter pipeline');
        }
        return exportFn.call(window.TTSController, result);
      })
      .then(function () {
        // One voice per event: the shared notification path announces in its
        // own right, so the file-local announce() is the fallback for pages
        // where the notification module is absent.
        if (typeof window.notifySuccess === 'function') {
          window.notifySuccess('Audio file saved.');
        } else {
          announce('Audio file saved.');
        }
      })
      .catch(function (err) {
        logError(format.toUpperCase() + ' export failed', err);
        // One voice per event; announce() is the fallback. See the note on the
        // save path above.
        if (typeof window.notifyWarning === 'function') {
          window.notifyWarning('Audio export failed: ' + (err && err.message ? err.message : 'unknown error'));
        } else {
          announce('Audio export failed: ' + (err && err.message ? err.message : 'unknown error'));
        }
      })
      .then(function () {
        // Always restore button state (finally equivalent). Clearing
        // `exporting` first is load-bearing: refreshSaveAudioEnabled below
        // early-returns while it is set, and that call is what restores the
        // resting disabled state for both controls.
        exporting = false;
        els.saveAudioButton.removeAttribute('aria-busy');
        if (els.saveAudioFormatButton) {
          els.saveAudioFormatButton.removeAttribute('aria-busy');
        }
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
        // Skip the LOADING frame entirely on cache-hit clicks — SRE is
        // already initialised so the prepare-pipeline resolves synchronously
        // from the user's perspective. Asymmetric vs MathPix Processed
        // Output (which always shows LOADING briefly); see Stage 1 lessons
        // learned in semantic-tts-plan.md.
        var sreCached = !!(
          window.TTSSreLoader &&
          typeof window.TTSSreLoader.isLoaded === 'function' &&
          window.TTSSreLoader.isLoaded()
        );
        if (!sreCached) {
          setButtonState(STATES.LOADING);
        }

        var output = els.output || document.getElementById('imgdesc-output');
        getPreparedOutputResult()
          .then(function (result) {
            // If the user has switched modes / cleared the output during the
            // await, bail. The MutationObserver will refresh button state.
            if (!output || !document.contains(output)) {
              if (currentState === STATES.LOADING) setButtonState(STATES.IDLE);
              return;
            }
            if (!result || !result.text) {
              logWarn('No text to read');
              if (currentState === STATES.LOADING) setButtonState(STATES.IDLE);
              return;
            }
            logInfo('Starting speech, text length:', result.text.length);
            // tts:start will transition us to SPEAKING via the existing
            // event listener; that re-enables the button so the user can
            // click "Stop".
            window.TTSController.speak(result);
          })
          .catch(function (err) {
            // prepareImgdescOutputForTts swallows SRE failures internally,
            // so reaching here means linearise itself threw — degrade to
            // IDLE rather than leaving the button stuck on LOADING.
            logError('Prepare-output pipeline failed', err);
            if (currentState === STATES.LOADING) setButtonState(STATES.IDLE);
          });
        break;

      case STATES.SPEAKING:
        logInfo('Stopping speech');
        window.TTSController.stop();
        break;

      case STATES.PAUSED:
        logInfo('Resuming speech');
        window.TTSController.resume();
        break;

      case STATES.LOADING:
        // Re-entrancy guard — a click during LOADING is a no-op. The button
        // is already disabled in this state; this branch is defensive
        // against state desync (e.g. external code calling handleClick).
        logDebug('Click during LOADING ignored');
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

    // Export progress — drives the SHARED page-level surface. Filtered on
    // ownership inside updateExportProgress; the emitter serves all three tools.
    window.EmbedEventEmitter.on('tts:exportProgress', function (data) {
      if (!data || typeof data.chunk !== 'number' || typeof data.totalChunks !== 'number') return;
      updateExportProgress(data.chunk, data.totalChunks);
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
