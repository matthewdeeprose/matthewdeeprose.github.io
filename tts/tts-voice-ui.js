/**
 * tts-voice-ui.js — Phase 6: Voice Selection UI
 *
 * Manages the Voice Settings panel in Set Up: engine radio buttons,
 * Web Speech / neural voice dropdowns, rate slider, preview button,
 * and Supertonic download-nudge state. The "Voice Settings" link in
 * Image Describer navigates the user to this panel in Set Up.
 *
 * Reads/writes settings exclusively through TTSController (never
 * touches localStorage directly). Listens to tts:engineChanged and
 * model:stateChange for external updates.
 *
 * IIFE — exposes window.TTSVoiceUI
 */
window.TTSVoiceUI = (function () {
  'use strict';

  // ── Logging configuration ──────────────────────────────────────
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }
  function logError(msg) { var a = [].slice.call(arguments, 1); if (shouldLog(LOG_LEVELS.ERROR)) console.error.apply(console, [msg].concat(a)); }
  function logWarn(msg)  { var a = [].slice.call(arguments, 1); if (shouldLog(LOG_LEVELS.WARN))  console.warn.apply(console, [msg].concat(a));  }
  function logInfo(msg)  { var a = [].slice.call(arguments, 1); if (shouldLog(LOG_LEVELS.INFO))  console.log.apply(console, [msg].concat(a));   }
  function logDebug(msg) { var a = [].slice.call(arguments, 1); if (shouldLog(LOG_LEVELS.DEBUG)) console.log.apply(console, [msg].concat(a));   }

  // ── Preview text ───────────────────────────────────────────────
  var PREVIEW_TEXT = 'This is a preview of the selected voice.';

  // ── DOM cache ──────────────────────────────────────────────────
  var els = {};

  function cacheElements() {
    els.panel             = document.getElementById('tts-voice-settings');
    els.engineWebspeech   = document.getElementById('tts-engine-webspeech');
    els.engineSupertonic  = document.getElementById('tts-engine-supertonic');
    els.supertonicNote    = document.getElementById('tts-supertonic-note');
    els.downloadNudge     = document.getElementById('tts-download-nudge');
    els.downloadLink      = document.getElementById('tts-download-link');
    els.webspeechOptions  = document.getElementById('tts-webspeech-options');
    els.neuralOptions     = document.getElementById('tts-neural-options');
    els.voiceSelect       = document.getElementById('tts-voice-select');
    els.privacyNotice     = document.getElementById('tts-privacy-notice');
    els.neuralVoiceSelect = document.getElementById('tts-neural-voice-select');
    els.rateSlider        = document.getElementById('tts-rate-slider');
    els.rateValue         = document.getElementById('tts-rate-value');
    els.previewBtn        = document.getElementById('tts-preview-btn');
    els.verbosityToggle   = document.getElementById('tts-verbosity-toggle');
  }

  // ── Helpers ────────────────────────────────────────────────────

  /** Show/hide the engine-specific option panels. */
  function showEngineOptions(engine) {
    if (!els.webspeechOptions || !els.neuralOptions) return;
    var isWebspeech = (engine === 'webspeech');
    els.webspeechOptions.hidden = !isWebspeech;
    els.neuralOptions.hidden    = isWebspeech;
  }

  /** Format rate value to one decimal place with × suffix. */
  function formatRate(val) {
    return parseFloat(val).toFixed(1);
  }

  // ── Supertonic availability ────────────────────────────────────

  function getSupertonicState() {
    if (typeof window.TTSNeuralGateway === 'undefined') return 'unavailable';
    try {
      return window.TTSNeuralGateway.getModelState('supertonic') || 'not-downloaded';
    } catch (e) {
      logWarn('[TTSVoiceUI] Could not read supertonic state', e);
      return 'not-downloaded';
    }
  }

  function updateSupertonicAvailability() {
    if (typeof window.TTSNeuralGateway === 'undefined') {
      // Gateway not loaded — hide the supertonic option entirely
      if (els.engineSupertonic) {
        els.engineSupertonic.closest('.tts-radio-label').hidden = true;
      }
      if (els.downloadNudge) els.downloadNudge.hidden = true;
      return;
    }

    var state = getSupertonicState();
    logDebug('[TTSVoiceUI] Supertonic state:', state);

    var canUse = (state === 'cached' || state === 'loaded');
    if (els.engineSupertonic) {
      els.engineSupertonic.disabled = !canUse;
    }

    // Update the note text beside the radio
    if (els.supertonicNote) {
      switch (state) {
        case 'loaded':
          els.supertonicNote.textContent = '(loaded)';
          break;
        case 'cached':
          els.supertonicNote.textContent = '(cached, 263 MB)';
          break;
        case 'downloading':
          els.supertonicNote.textContent = '(downloading…)';
          break;
        default:
          els.supertonicNote.textContent = '(requires download)';
      }
    }

    // Download nudge: show when supertonic is selected but not available
    var currentEngine = window.TTSController.getEngine();
    if (els.downloadNudge) {
      els.downloadNudge.hidden = canUse || (currentEngine !== 'supertonic' && state === 'not-downloaded');
      // Always show nudge if supertonic radio is selected and model not available
      if (currentEngine === 'supertonic' && !canUse) {
        els.downloadNudge.hidden = false;
      }
    }
  }

  // ── Web Speech voice dropdown ──────────────────────────────────

  function populateVoiceDropdown(voices) {
    if (!els.voiceSelect) return;

    var localVoices  = [];
    var cloudVoices  = [];

    voices.forEach(function (v) {
      if (window.TTSController.isLocalVoice(v)) {
        localVoices.push(v);
      } else {
        cloudVoices.push(v);
      }
    });

    // Clear existing options
    els.voiceSelect.innerHTML = '';

    if (voices.length === 0) {
      var opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No voices available';
      els.voiceSelect.appendChild(opt);
      return;
    }

    function addGroup(label, list) {
      if (list.length === 0) return;
      var group = document.createElement('optgroup');
      group.label = label;
      list.forEach(function (v) {
        var opt = document.createElement('option');
        opt.value = v.voiceURI;
        opt.textContent = v.name + ' (' + v.lang + ')';
        group.appendChild(opt);
      });
      els.voiceSelect.appendChild(group);
    }

    addGroup('On-device', localVoices);
    addGroup('Cloud', cloudVoices);

    // Pre-select the current voice
    var selected = window.TTSController.getSelectedVoice();
    if (selected) {
      els.voiceSelect.value = selected.voiceURI;
    }

    updatePrivacyNotice();
  }

  function updatePrivacyNotice() {
    if (!els.privacyNotice || !els.voiceSelect) return;
    var voices = window.TTSController.getVoicesSync();
    var selectedURI = els.voiceSelect.value;
    var voice = null;
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].voiceURI === selectedURI) {
        voice = voices[i];
        break;
      }
    }
    if (voice && !window.TTSController.isLocalVoice(voice)) {
      els.privacyNotice.hidden = false;
    } else {
      els.privacyNotice.hidden = true;
    }
  }

  // ── Event handlers ─────────────────────────────────────────────

  function onEngineChange(e) {
    var engine = e.target.value;
    logInfo('[TTSVoiceUI] Engine changed to:', engine);
    window.TTSController.setEngine(engine);
    showEngineOptions(engine);
    updateSupertonicAvailability();
  }

  function onVoiceChange() {
    if (!els.voiceSelect) return;
    var uri = els.voiceSelect.value;
    logDebug('[TTSVoiceUI] Voice changed to:', uri);
    window.TTSController.setVoice(uri);
    updatePrivacyNotice();
  }

  function onNeuralVoiceChange() {
    if (!els.neuralVoiceSelect) return;
    var id = els.neuralVoiceSelect.value;
    logDebug('[TTSVoiceUI] Neural voice changed to:', id);
    window.TTSController.setNeuralVoice(id);
  }

  function onRateInput() {
    if (!els.rateSlider || !els.rateValue) return;
    var val = parseFloat(els.rateSlider.value);
    els.rateValue.textContent = formatRate(val);
    window.TTSController.setRate(val);
  }

  function onPreviewClick() {
    logDebug('[TTSVoiceUI] Preview clicked');
    // Stop any current speech first
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    window.TTSController.speak(PREVIEW_TEXT);
  }

  function onVerbosityChange() {
    if (!els.verbosityToggle) return;
    var value = els.verbosityToggle.checked ? 'on' : 'off';
    if (window.TTSSemantic && typeof window.TTSSemantic.setVerbosity === 'function') {
      window.TTSSemantic.setVerbosity(value);
    }
    logInfo('[TTSVoiceUI] Verbosity set to:', value);
  }

  function onExternalEngineChange(data) {
    // Fired by TTSController when engine changes programmatically.
    // Payload arrives directly from EmbedEventEmitter (not wrapped in .detail).
    var engine = data && data.engine;
    if (!engine) return;
    logDebug('[TTSVoiceUI] External engine change:', engine);
    if (engine === 'webspeech' && els.engineWebspeech) {
      els.engineWebspeech.checked = true;
    } else if (engine === 'supertonic' && els.engineSupertonic) {
      els.engineSupertonic.checked = true;
    }
    showEngineOptions(engine);
    updateSupertonicAvailability();
  }

  function onModelStateChange(data) {
    var detail = data || {};
    if (detail.category !== 'tts') return;
    logDebug('[TTSVoiceUI] Model state change:', detail.newState);
    updateSupertonicAvailability();
  }

  // ── Bind / unbind ──────────────────────────────────────────────

  /** Handle "Voice Settings" link click — switch to Set Up, then scroll. */
  function onSettingsLinkClick(e) {
    var target = document.getElementById('tts-voice-settings');
    if (!target) return; // let the anchor work natively as fallback

    e.preventDefault();

    // Switch to Set Up mode if not already showing
    if (typeof window.showSetUp === 'function') {
      window.showSetUp();
    }

    // Scroll to the voice settings panel after mode switch paints
    requestAnimationFrame(function () {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Move focus to the first interactive element in the panel
      var firstInput = target.querySelector('input, select, button');
      if (firstInput) firstInput.focus({ preventScroll: true });
    });
  }

  function bindEvents() {
    if (els.engineWebspeech)   els.engineWebspeech.addEventListener('change', onEngineChange);
    if (els.engineSupertonic)  els.engineSupertonic.addEventListener('change', onEngineChange);
    if (els.voiceSelect)       els.voiceSelect.addEventListener('change', onVoiceChange);
    if (els.neuralVoiceSelect) els.neuralVoiceSelect.addEventListener('change', onNeuralVoiceChange);
    if (els.rateSlider)        els.rateSlider.addEventListener('input', onRateInput);
    if (els.previewBtn)        els.previewBtn.addEventListener('click', onPreviewClick);
    if (els.verbosityToggle)   els.verbosityToggle.addEventListener('change', onVerbosityChange);

    // "Voice Settings" link(s) — may appear in Image Describer or future tools
    var settingsLinks = document.querySelectorAll('.tts-settings-link');
    for (var i = 0; i < settingsLinks.length; i++) {
      settingsLinks[i].addEventListener('click', onSettingsLinkClick);
    }

    // Subscribe via EmbedEventEmitter (where these events are actually fired),
    // not as DOM CustomEvents on document.
    if (window.EmbedEventEmitter && typeof window.EmbedEventEmitter.on === 'function') {
      window.EmbedEventEmitter.on('tts:engineChanged', onExternalEngineChange);
      window.EmbedEventEmitter.on('model:stateChange', onModelStateChange);
      logDebug('[TTSVoiceUI] Subscribed to EmbedEventEmitter events');
    } else {
      logWarn('[TTSVoiceUI] EmbedEventEmitter not available — live updates disabled');
    }
  }

  // ── Restore state from controller ──────────────────────────────

  function restoreState() {
    // Engine radio
    var engine = window.TTSController.getEngine();
    if (engine === 'supertonic' && els.engineSupertonic) {
      els.engineSupertonic.checked = true;
    } else if (els.engineWebspeech) {
      els.engineWebspeech.checked = true;
    }
    showEngineOptions(engine);

    // Neural voice dropdown
    if (els.neuralVoiceSelect) {
      els.neuralVoiceSelect.value = window.TTSController.getNeuralVoice();
    }

    // Rate slider
    var rate = window.TTSController.getRate();
    if (els.rateSlider)  els.rateSlider.value      = rate;
    if (els.rateValue)   els.rateValue.textContent  = formatRate(rate);

    // Supertonic availability
    updateSupertonicAvailability();

    // Verbosity toggle
    if (els.verbosityToggle && window.TTSSemantic &&
        typeof window.TTSSemantic.getVerbosity === 'function') {
      els.verbosityToggle.checked = (window.TTSSemantic.getVerbosity() === 'on');
    }

    // Web Speech voices (async — may not be ready immediately)
    window.TTSController.getVoices().then(function (voices) {
      populateVoiceDropdown(voices);
    }).catch(function (err) {
      logWarn('[TTSVoiceUI] Failed to load voices:', err);
    });
  }

  // ── Public: refresh ────────────────────────────────────────────

  function refresh() {
    restoreState();
    logInfo('[TTSVoiceUI] Panel refreshed');
  }

  // ── Initialisation ─────────────────────────────────────────────

  function init() {
    // Graceful degradation: hide panel if controller unavailable
    if (typeof window.TTSController === 'undefined') {
      var panel = document.getElementById('tts-voice-settings');
      if (panel) panel.hidden = true;
      logWarn('[TTSVoiceUI] TTSController not available — panel hidden');
      return;
    }

    cacheElements();

    if (!els.panel) {
      logWarn('[TTSVoiceUI] Voice settings panel not found in DOM');
      return;
    }

    bindEvents();
    restoreState();

    logInfo('[TTSVoiceUI] Initialised');
  }

  // Run on DOMContentLoaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Public API ─────────────────────────────────────────────────
  return {
    refresh: refresh
  };
})();
