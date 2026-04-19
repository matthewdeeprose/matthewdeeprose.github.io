/**
 * TTS Controller — Phase 3: Controller Integration with Neural Gateway
 *
 * Unified TTS API providing play/pause/stop/replay with voice and rate
 * controls. Routes to Web Speech API or the Supertonic Neural TTS Gateway
 * based on the selected engine. Auto-falls back to Web Speech if the
 * neural engine is unavailable or fails.
 *
 * Exposes: window.TTSController
 *
 * Events (via EmbedEventEmitter):
 *   tts:start         { engine, text }
 *   tts:end           { engine }
 *   tts:error         { engine, error }
 *   tts:pause         { engine }
 *   tts:resume        { engine }
 *   tts:engineChanged { engine }
 *
 * localStorage keys:
 *   tts-engine        (default 'webspeech')
 *   tts-voice         (voiceURI string — Web Speech)
 *   tts-rate          (0.5–2.0, default 1.0)
 *   tts-pitch         (0.5–2.0, default 1.0)
 *   tts-neural-voice  (default 'F1' — neural voice ID)
 *
 * @author Matthew Deeprose
 */
const TTSController = (function () {
  'use strict';

  // ==========================================================================
  // LOGGING CONFIGURATION
  // ==========================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.ERROR)) console.error.apply(console, ['[TTSController]', message].concat(args));
  }

  function logWarn(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.WARN)) console.warn.apply(console, ['[TTSController]', message].concat(args));
  }

  function logInfo(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.INFO)) console.log.apply(console, ['[TTSController]', message].concat(args));
  }

  function logDebug(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log.apply(console, ['[TTSController]', message].concat(args));
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  var STORAGE_KEYS = {
    ENGINE: 'tts-engine',
    VOICE: 'tts-voice',
    RATE: 'tts-rate',
    PITCH: 'tts-pitch',
    NEURAL_VOICE: 'tts-neural-voice',
    NUDGE_DISMISSED: 'tts-nudge-dismissed'
  };

  // Maximum character length per Web Speech utterance before chunking.
  // Chrome silently truncates utterances that take longer than ~15 seconds.
  var CHUNK_MAX_LENGTH = 500;

  // Maximum character length per neural (Supertonic) generate() call.
  // Supertonic degrades on long inputs — shorter chunks produce clearer audio.
  var NEURAL_CHUNK_MAX_LENGTH = 300;

  // Silence gap (seconds) inserted between neural chunks in WAV export.
  var NEURAL_CHUNK_GAP_SEC = 0.3;

  var DEFAULTS = {
    ENGINE: 'webspeech',
    RATE: 1.0,
    PITCH: 1.0,
    NEURAL_VOICE: 'F1'
  };

  var STATUS = {
    IDLE: 'idle',
    SPEAKING: 'speaking',
    PAUSED: 'paused'
  };

  // ==========================================================================
  // STATE
  // ==========================================================================

  /** @type {'idle'|'speaking'|'paused'} */
  var _status = STATUS.IDLE;

  /** @type {SpeechSynthesisVoice|null} */
  var _selectedVoice = null;

  /** @type {number} */
  var _rate = DEFAULTS.RATE;

  /** @type {number} */
  var _pitch = DEFAULTS.PITCH;

  /** @type {string} */
  var _engine = DEFAULTS.ENGINE;

  /** @type {SpeechSynthesisVoice[]} */
  var _cachedVoices = [];

  /** @type {boolean} */
  var _voicesLoaded = false;

  /** @type {SpeechSynthesisUtterance|null} */
  var _currentUtterance = null;

  /** @type {string} Text being spoken (for pause-resume workaround) */
  var _currentText = '';

  /** @type {boolean} Whether the Android pause→cancel workaround is needed */
  var _isAndroid = /android/i.test(navigator.userAgent);

  /** @type {string} Neural voice ID ('F1', 'F2', 'M1', 'M2') */
  var _neuralVoice = DEFAULTS.NEURAL_VOICE;

  /** @type {AudioContext|null} Controller's own AudioContext for neural playback */
  var _neuralAudioContext = null;

  /** @type {AudioBufferSourceNode|null} Currently playing neural audio source */
  var _neuralAudioSource = null;

  /** @type {boolean} True while neural generate() is in flight or audio is playing */
  var _neuralBusy = false;

  /** @type {string[]} Remaining chunks to speak after the current utterance (Web Speech chunking) */
  var _chunkQueue = [];

  /** @type {object|null} Options captured for the active chunked utterance */
  var _chunkOptions = null;

  /** @type {number} Number of Web Speech speak() calls this session (for nudge tracking) */
  var _webSpeechUseCount = 0;

  /** @type {boolean} Whether the "download natural voice" nudge has been dismissed (persisted) */
  var _nudgeDismissed = false;

  /** @type {boolean} Whether the nudge has already been shown this session */
  var _nudgeShown = false;

  // ==========================================================================
  // EVENT EMITTER HELPERS
  // ==========================================================================

  /**
   * Emit an event via EmbedEventEmitter if available.
   * @param {string} eventName
   * @param {object} payload
   */
  function emit(eventName, payload) {
    if (window.EmbedEventEmitter && typeof window.EmbedEventEmitter.emit === 'function') {
      window.EmbedEventEmitter.emit(eventName, payload);
      logDebug('Emitted event: ' + eventName, payload);
    } else {
      logDebug('EmbedEventEmitter not available; skipping event: ' + eventName);
    }
  }

  // ==========================================================================
  // LOCALSTORAGE HELPERS
  // ==========================================================================

  function loadSetting(key, fallback) {
    try {
      var val = localStorage.getItem(key);
      return val !== null ? val : fallback;
    } catch (e) {
      logWarn('Failed to read localStorage key: ' + key, e);
      return fallback;
    }
  }

  function saveSetting(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch (e) {
      logWarn('Failed to write localStorage key: ' + key, e);
    }
  }

  // ==========================================================================
  // VOICE MANAGEMENT
  // ==========================================================================

  /**
   * Load voices from the browser. Handles the Chrome race condition where
   * voices are not available synchronously — listens for the voiceschanged
   * event and resolves when voices are populated.
   *
   * @returns {Promise<SpeechSynthesisVoice[]>}
   */
  function ensureVoices() {
    return new Promise(function (resolve) {
      if (!isAvailable()) {
        logWarn('Speech synthesis not available');
        resolve([]);
        return;
      }

      var voices = speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        _cachedVoices = voices;
        _voicesLoaded = true;
        logDebug('Voices loaded synchronously: ' + voices.length);
        resolve(voices);
        return;
      }

      // Chrome race condition — voices load asynchronously
      logDebug('Voices not yet available; waiting for voiceschanged event');

      var timeout;
      function onVoicesChanged() {
        clearTimeout(timeout);
        speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        var loadedVoices = speechSynthesis.getVoices();
        _cachedVoices = loadedVoices;
        _voicesLoaded = true;
        logDebug('Voices loaded via voiceschanged: ' + loadedVoices.length);
        resolve(loadedVoices);
      }

      speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

      // Safety timeout — if voiceschanged never fires (rare), resolve with
      // whatever is available after 2 seconds
      timeout = setTimeout(function () {
        speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        var fallbackVoices = speechSynthesis.getVoices();
        _cachedVoices = fallbackVoices;
        _voicesLoaded = true;
        logWarn('voiceschanged timeout — resolved with ' + fallbackVoices.length + ' voices');
        resolve(fallbackVoices);
      }, 2000);
    });
  }

  /**
   * Sort voices: local first, then neural/premium highlighted, then
   * alphabetical within each group.
   *
   * @param {SpeechSynthesisVoice[]} voices
   * @returns {SpeechSynthesisVoice[]}
   */
  function sortVoices(voices) {
    return voices.slice().sort(function (a, b) {
      // Local voices first
      if (a.localService && !b.localService) return -1;
      if (!a.localService && b.localService) return 1;

      // English voices before others
      var aEn = a.lang.startsWith('en');
      var bEn = b.lang.startsWith('en');
      if (aEn && !bEn) return -1;
      if (!aEn && bEn) return 1;

      // Alphabetical by name within groups
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Find a voice by its voiceURI string.
   * @param {string} voiceURI
   * @returns {SpeechSynthesisVoice|null}
   */
  function findVoiceByURI(voiceURI) {
    if (!voiceURI) return null;
    for (var i = 0; i < _cachedVoices.length; i++) {
      if (_cachedVoices[i].voiceURI === voiceURI) {
        return _cachedVoices[i];
      }
    }
    return null;
  }

  /**
   * Restore the saved voice from localStorage. If the saved voice is no
   * longer available (e.g. different browser), falls back to the first
   * available local English voice.
   */
  function restoreSavedVoice() {
    var savedURI = loadSetting(STORAGE_KEYS.VOICE, null);
    if (savedURI) {
      var voice = findVoiceByURI(savedURI);
      if (voice) {
        _selectedVoice = voice;
        logDebug('Restored saved voice: ' + voice.name);
        return;
      }
      logDebug('Saved voice not found: ' + savedURI);
    }

    // Fallback: first local English voice, or first local voice, or first voice
    var sorted = sortVoices(_cachedVoices);
    if (sorted.length > 0) {
      _selectedVoice = sorted[0];
      logDebug('Using default voice: ' + _selectedVoice.name);
    }
  }

  // ==========================================================================
  // INITIALISATION
  // ==========================================================================

  /**
   * Restore persisted settings from localStorage.
   */
  function restoreSettings() {
    _engine = loadSetting(STORAGE_KEYS.ENGINE, DEFAULTS.ENGINE);

    var savedRate = parseFloat(loadSetting(STORAGE_KEYS.RATE, DEFAULTS.RATE));
    if (!isNaN(savedRate) && savedRate >= 0.5 && savedRate <= 2.0) {
      _rate = savedRate;
    }

    var savedPitch = parseFloat(loadSetting(STORAGE_KEYS.PITCH, DEFAULTS.PITCH));
    if (!isNaN(savedPitch) && savedPitch >= 0.5 && savedPitch <= 2.0) {
      _pitch = savedPitch;
    }

    var savedNeuralVoice = loadSetting(STORAGE_KEYS.NEURAL_VOICE, DEFAULTS.NEURAL_VOICE);
    if (['F1', 'F2', 'M1', 'M2'].indexOf(savedNeuralVoice) !== -1) {
      _neuralVoice = savedNeuralVoice;
    }

    _nudgeDismissed = loadSetting(STORAGE_KEYS.NUDGE_DISMISSED, null) === 'true';

    logDebug('Settings restored — engine: ' + _engine + ', rate: ' + _rate +
      ', pitch: ' + _pitch + ', neuralVoice: ' + _neuralVoice +
      ', nudgeDismissed: ' + _nudgeDismissed);
  }

  /**
   * Initialise the controller. Safe to call multiple times.
   */
  function init() {
    restoreSettings();

    if (isAvailable()) {
      ensureVoices().then(function () {
        restoreSavedVoice();
        logInfo('TTSController initialised — ' + _cachedVoices.length + ' voices available');
      });
    } else {
      logWarn('Web Speech API not available in this browser');
    }
  }

  // ==========================================================================
  // STATUS MANAGEMENT
  // ==========================================================================

  function setStatus(newStatus) {
    var previous = _status;
    _status = newStatus;
    logDebug('Status: ' + previous + ' → ' + newStatus);
  }

  // ==========================================================================
  // NEURAL ENGINE HELPERS
  // ==========================================================================

  /**
   * Check whether the currently selected engine is a neural engine that
   * is loaded and ready to generate audio.
   * @returns {boolean}
   */
  function _isNeuralEngineActive() {
    return _engine !== 'webspeech' &&
           window.TTSNeuralGateway &&
           typeof window.TTSNeuralGateway.getLoadedEngine === 'function' &&
           window.TTSNeuralGateway.getLoadedEngine() === _engine;
  }

  /**
   * Play audio samples via the controller's own Web Audio API context.
   * Gives the controller full ownership of playback state (start, end, stop).
   *
   * @param {Float32Array} samples
   * @param {number} sampleRate
   * @param {function} onEnded - Callback when playback finishes naturally
   */
  function _playNeuralAudio(samples, sampleRate, onEnded) {
    _stopNeuralAudio();

    if (!_neuralAudioContext) {
      _neuralAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_neuralAudioContext.state === 'suspended') _neuralAudioContext.resume();

    var buffer = _neuralAudioContext.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);

    _neuralAudioSource = _neuralAudioContext.createBufferSource();
    _neuralAudioSource.buffer = buffer;
    _neuralAudioSource.connect(_neuralAudioContext.destination);
    _neuralAudioSource.onended = function () {
      _neuralAudioSource = null;
      if (typeof onEnded === 'function') onEnded();
    };
    _neuralAudioSource.start(0);
    logDebug('Neural audio playback started (' + (samples.length / sampleRate).toFixed(2) + 's)');
  }

  /**
   * Stop any currently playing neural audio.
   */
  function _stopNeuralAudio() {
    if (_neuralAudioSource) {
      try { _neuralAudioSource.stop(); } catch (e) { /* already ended */ }
      _neuralAudioSource = null;
    }
  }

  // ==========================================================================
  // CORE PLAYBACK — WEB SPEECH API
  // ==========================================================================

  /**
   * Speak text using the Web Speech API.
   *
   * @param {string} text - Text to speak
   * @param {object} [options] - Optional overrides
   * @param {string} [options.voiceURI] - Voice to use (overrides setVoice)
   * @param {number} [options.rate] - Speech rate (overrides setRate)
   * @param {number} [options.pitch] - Pitch (overrides setPitch)
   * @returns {boolean} true if speech started successfully
   */
  function speak(textOrResult, options) {
    var text, sections;

    // Accept either a plain string or a { text, sections } result object
    if (textOrResult && typeof textOrResult === 'object' && typeof textOrResult.text === 'string') {
      text = textOrResult.text;
      sections = textOrResult.sections || null;
    } else if (typeof textOrResult === 'string') {
      text = textOrResult;
      sections = null;
    } else {
      logWarn('Cannot speak — empty or invalid text');
      emit('tts:error', { engine: _engine, error: 'Empty or invalid text' });
      return false;
    }

    if (!text || !text.trim()) {
      logWarn('Cannot speak — empty or invalid text');
      emit('tts:error', { engine: _engine, error: 'Empty or invalid text' });
      return false;
    }

    // Stop any current speech before starting new
    if (_status !== STATUS.IDLE) {
      stopInternal();
    }

    // Route to neural engine if active
    if (_engine !== 'webspeech' && window.TTSNeuralGateway) {
      if (_isNeuralEngineActive()) {
        _speakNeural(text.trim(), options, sections);
        return true;
      }
      // Neural engine selected but not loaded — auto-fallback
      logWarn('Engine "' + _engine + '" selected but not loaded — falling back to Web Speech');
    }

    return _speakWebSpeech(text.trim(), options, sections);
  }

  /**
   * Split long text into sentence-bounded chunks under a max length.
   * Used to work around Chrome's ~15-second utterance cutoff (Web Speech)
   * and Supertonic's quality degradation on long inputs (neural).
   *
   * @param {string} text
   * @param {number} [maxLength] — optional override, defaults to CHUNK_MAX_LENGTH
   * @returns {string[]}
   */
  function splitIntoChunks(text, maxLength) {
    maxLength = maxLength || CHUNK_MAX_LENGTH;
    if (!text || text.length <= maxLength) {
      return [text];
    }

    // Primary split: sentence boundaries (., !, ?) followed by whitespace.
    var sentences;
    try {
      sentences = text.split(/(?<=[.!?])\s+/);
    } catch (e) {
      // Lookbehind not supported — reconstruct by keeping delimiters.
      sentences = [];
      var parts = text.split(/([.!?])\s+/);
      var accum = '';
      for (var k = 0; k < parts.length; k++) {
        accum += parts[k];
        if (/^[.!?]$/.test(parts[k]) && k + 1 < parts.length) {
          sentences.push(accum);
          accum = '';
        }
      }
      if (accum) sentences.push(accum);
    }

    var chunks = [];
    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i];
      if (!s) continue;
      if (s.length <= maxLength) {
        chunks.push(s);
        continue;
      }
      // Secondary split: comma, semicolon, or em-dash boundaries.
      var subPieces;
      try {
        subPieces = s.split(/(?<=[,;—])\s+/);
      } catch (e2) {
        subPieces = s.split(/[,;—]\s+/);
      }
      for (var j = 0; j < subPieces.length; j++) {
        var piece = subPieces[j];
        if (!piece) continue;
        // Tertiary split: nearest space at/before maxLength.
        while (piece.length > maxLength) {
          var cut = piece.lastIndexOf(' ', maxLength);
          if (cut <= 0) cut = maxLength;
          var head = piece.substring(0, cut).trim();
          if (head) chunks.push(head);
          piece = piece.substring(cut).trim();
        }
        if (piece) chunks.push(piece);
      }
    }

    return chunks.filter(function (c) { return c && c.length > 0; });
  }

  /**
   * Split semantic sections into chunks that respect section boundaries.
   * Short sections are merged together up to maxLength. Oversized sections
   * fall back to splitIntoChunks() for sentence/comma/space splitting.
   * Returns string[] — identical output format to splitIntoChunks().
   *
   * @param {Array<{type: string, text: string}>} sections — from TTSSemantic.linearise()
   * @param {number} [maxLength] — optional override, defaults to CHUNK_MAX_LENGTH
   * @returns {string[]}
   */
  function splitIntoSemanticChunks(sections, maxLength) {
    maxLength = maxLength || CHUNK_MAX_LENGTH;

    if (!sections || !sections.length) {
      return [];
    }

    var chunks = [];
    var currentChunk = '';

    for (var i = 0; i < sections.length; i++) {
      var sectionText = (sections[i].text || '').trim();
      if (!sectionText) continue;

      if (sectionText.length <= maxLength) {
        // Section fits within a single chunk
        if (currentChunk && (currentChunk.length + 1 + sectionText.length) <= maxLength) {
          // Append to current chunk
          currentChunk += ' ' + sectionText;
        } else {
          // Current chunk is full — push it, start new chunk with this section
          if (currentChunk) chunks.push(currentChunk);
          currentChunk = sectionText;
        }
      } else {
        // Section is too long — push current chunk, then sub-split this section
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = '';
        var subChunks = splitIntoChunks(sectionText, maxLength);
        // Add all sub-chunks except the last as standalone chunks
        for (var j = 0; j < subChunks.length - 1; j++) {
          chunks.push(subChunks[j]);
        }
        // Last sub-chunk becomes the start of the next currentChunk
        // (so it can potentially merge with the next short section)
        if (subChunks.length > 0) {
          currentChunk = subChunks[subChunks.length - 1];
        }
      }
    }

    if (currentChunk) chunks.push(currentChunk);

    logDebug('Semantic chunking: ' + sections.length + ' sections → ' + chunks.length + ' chunks (maxLength: ' + maxLength + ')');
    return chunks;
  }

  /**
   * Concatenate multiple Float32Arrays into a single Float32Array.
   * @param {Float32Array[]} arrays
   * @returns {Float32Array}
   */
  function concatFloat32Arrays(arrays) {
    var totalLength = 0;
    for (var i = 0; i < arrays.length; i++) totalLength += arrays[i].length;
    var result = new Float32Array(totalLength);
    var offset = 0;
    for (var j = 0; j < arrays.length; j++) {
      result.set(arrays[j], offset);
      offset += arrays[j].length;
    }
    return result;
  }

  /**
   * Create a Float32Array of silence for the given duration.
   * @param {number} sampleRate
   * @param {number} durationSec
   * @returns {Float32Array}
   */
  function createSilenceGap(sampleRate, durationSec) {
    return new Float32Array(Math.round(sampleRate * durationSec));
  }

  /**
   * Speak text via the Web Speech API backend.
   * Long text is split into sentence-bounded chunks and queued to work
   * around Chrome's ~15-second utterance cutoff.
   *
   * @param {string} trimmedText
   * @param {object} [options]
   * @returns {boolean}
   */
  function _speakWebSpeech(trimmedText, options, sections) {
    if (!isAvailable()) {
      logError('Cannot speak — Web Speech API not available');
      emit('tts:error', { engine: 'webspeech', error: 'Web Speech API not available' });
      return false;
    }

    options = options || {};

    var chunks;
    if (sections && sections.length > 0) {
      chunks = splitIntoSemanticChunks(sections, CHUNK_MAX_LENGTH);
    } else {
      chunks = splitIntoChunks(trimmedText);
    }
    if (chunks.length === 0) {
      logWarn('Chunking returned no content');
      return false;
    }

    _chunkQueue = chunks.slice(1);
    _chunkOptions = options;

    logInfo('Speaking (webspeech, ' + chunks.length + ' chunk' +
      (chunks.length === 1 ? '' : 's') + '): "' +
      trimmedText.substring(0, 60) + (trimmedText.length > 60 ? '...' : '') + '"');

    // Nudge bookkeeping — once per speak() call (not per chunk).
    if (!_nudgeDismissed && !_nudgeShown) {
      _webSpeechUseCount++;
      if (_webSpeechUseCount >= 3) {
        _showDownloadNudge();
      }
    }

    _speakChunk(chunks[0], true, chunks.length === 1);
    return true;
  }

  /**
   * Speak a single Web Speech chunk. Wires onend to continue the queue.
   *
   * @param {string} chunkText
   * @param {boolean} isFirst — whether to emit tts:start
   * @param {boolean} isLast — whether to emit tts:end on completion
   */
  function _speakChunk(chunkText, isFirst, isLast) {
    var options = _chunkOptions || {};

    var utterance = new SpeechSynthesisUtterance(chunkText);

    // Voice selection — option override > saved selection > default
    var voice = null;
    if (options.voiceURI) {
      voice = findVoiceByURI(options.voiceURI);
    }
    if (!voice) {
      voice = _selectedVoice;
    }
    if (voice) {
      utterance.voice = voice;
    }

    utterance.rate = (typeof options.rate === 'number') ? clampRate(options.rate) : _rate;
    utterance.pitch = (typeof options.pitch === 'number') ? clampPitch(options.pitch) : _pitch;

    _currentUtterance = utterance;
    _currentText = chunkText;

    utterance.onstart = function () {
      setStatus(STATUS.SPEAKING);
      if (isFirst) {
        emit('tts:start', { engine: 'webspeech', text: chunkText });
      }
      logDebug('Chunk started' + (isFirst ? ' (first)' : '') + (isLast ? ' (last)' : ''));
    };

    utterance.onend = function () {
      // Continue the queue if more chunks remain.
      if (_chunkQueue.length > 0) {
        var next = _chunkQueue.shift();
        var nextIsLast = _chunkQueue.length === 0;
        _speakChunk(next, false, nextIsLast);
        return;
      }
      setStatus(STATUS.IDLE);
      _currentUtterance = null;
      _currentText = '';
      _chunkOptions = null;
      emit('tts:end', { engine: 'webspeech' });
      logDebug('Speech ended');
    };

    utterance.onerror = function (event) {
      // 'canceled' / 'interrupted' are expected when stop() is called — not a real error
      if (event.error === 'canceled' || event.error === 'interrupted') {
        logDebug('Speech cancelled (expected — ' + event.error + ')');
        return;
      }
      setStatus(STATUS.IDLE);
      _currentUtterance = null;
      _currentText = '';
      _chunkQueue = [];
      _chunkOptions = null;
      logError('Speech error: ' + event.error);
      emit('tts:error', { engine: 'webspeech', error: event.error });
    };

    utterance.onpause = function () {
      setStatus(STATUS.PAUSED);
      emit('tts:pause', { engine: 'webspeech' });
      logDebug('Speech paused');
    };

    utterance.onresume = function () {
      setStatus(STATUS.SPEAKING);
      emit('tts:resume', { engine: 'webspeech' });
      logDebug('Speech resumed');
    };

    speechSynthesis.speak(utterance);
  }

  /**
   * Speak text via the neural TTS gateway. Generates audio, then plays
   * it through the controller's own AudioContext for full state control.
   * Falls back to Web Speech on any error.
   *
   * @param {string} trimmedText
   * @param {object} [options]
   */
  function _speakNeural(trimmedText, options, sections) {
    options = options || {};
    var neuralVoice = options.neuralVoice || _neuralVoice;

    var chunks;
    if (sections && sections.length > 0) {
      chunks = splitIntoSemanticChunks(sections, NEURAL_CHUNK_MAX_LENGTH);
    } else {
      chunks = splitIntoChunks(trimmedText, NEURAL_CHUNK_MAX_LENGTH);
    }
    if (chunks.length === 0) {
      logWarn('Neural chunking returned no content');
      return;
    }

    _neuralBusy = true;
    setStatus(STATUS.SPEAKING);
    emit('tts:start', { engine: _engine, text: trimmedText });
    logInfo('Speaking (neural/' + _engine + ', ' + chunks.length + ' chunk' +
      (chunks.length === 1 ? '' : 's') + '): "' + trimmedText.substring(0, 60) +
      (trimmedText.length > 60 ? '...' : '') + '" [voice: ' + neuralVoice + ']');

    _speakNeuralChunked(chunks, 0, neuralVoice, options);
  }

  /**
   * Recursively generate and play neural chunks in sequence. Preserves
   * _neuralBusy across chunks so getStatus() never briefly reports idle.
   * Checks _neuralBusy before each step — a stop() call clears it and
   * aborts the sequence cleanly.
   *
   * @param {string[]} chunks
   * @param {number} chunkIndex
   * @param {string} neuralVoice
   * @param {object} options
   */
  function _speakNeuralChunked(chunks, chunkIndex, neuralVoice, options) {
    // Cancelled mid-sequence
    if (!_neuralBusy) {
      logDebug('Chunked neural playback cancelled at chunk ' + chunkIndex);
      return;
    }

    // All chunks finished
    if (chunkIndex >= chunks.length) {
      _neuralBusy = false;
      setStatus(STATUS.IDLE);
      emit('tts:end', { engine: _engine });
      logDebug('Neural speech ended (all ' + chunks.length + ' chunks)');
      return;
    }

    logDebug('Generating neural chunk ' + (chunkIndex + 1) + '/' + chunks.length);

    window.TTSNeuralGateway.generate(chunks[chunkIndex], { voice: neuralVoice })
      .then(function (result) {
        if (!_neuralBusy) {
          logDebug('Generation completed but playback was stopped — discarding audio');
          return;
        }
        _playNeuralAudio(result.samples, result.sampleRate, function () {
          _speakNeuralChunked(chunks, chunkIndex + 1, neuralVoice, options);
        });
      })
      .catch(function (error) {
        _neuralBusy = false;
        logError('Neural generation failed on chunk ' + (chunkIndex + 1) + '/' +
          chunks.length + ': ' + error.message);
        emit('tts:error', { engine: _engine, error: error.message });
        setStatus(STATUS.IDLE);

        if (typeof window.notifyWarning === 'function') {
          window.notifyWarning(
            'Natural voice unavailable — using browser voice instead.',
            { duration: 5000 }
          );
        }

        // Fall back to Web Speech for the remaining (unspoken) text.
        var remaining = chunks.slice(chunkIndex).join(' ');
        logWarn('Falling back to Web Speech for remaining ' +
          (chunks.length - chunkIndex) + ' chunk(s)');
        _speakWebSpeech(remaining, options);
      });
  }

  /**
   * Stop current speech. Internal helper that does not emit tts:end
   * (the utterance's own onend handler does that).
   */
  function stopInternal() {
    _neuralBusy = false;
    _stopNeuralAudio();
    // Clear any pending chunk queue so onend doesn't continue speaking.
    _chunkQueue = [];
    _chunkOptions = null;
    if (isAvailable()) {
      speechSynthesis.cancel();
    }
    setStatus(STATUS.IDLE);
    _currentUtterance = null;
    _currentText = '';
  }

  /**
   * Stop current speech.
   */
  function stop() {
    if (_status === STATUS.IDLE) {
      logDebug('Already idle — nothing to stop');
      return;
    }
    logDebug('Stopping speech');
    stopInternal();
    emit('tts:end', { engine: _engine });
  }

  /**
   * Pause current speech.
   *
   * Neural engines do not support pause — stops playback entirely.
   *
   * On Android, SpeechSynthesis.pause() is broken — it silences audio but
   * the utterance keeps "playing" internally. The workaround is to cancel
   * and re-speak from the beginning on resume. We track this state and
   * handle it in resume().
   */
  function pause() {
    if (_status !== STATUS.SPEAKING) {
      logDebug('Cannot pause — not currently speaking');
      return;
    }

    if (_isNeuralEngineActive()) {
      // Neural engines don't support pause — stop instead
      logDebug('Neural engine does not support pause — stopping playback');
      stop();
      return;
    }

    if (_isAndroid) {
      // Android workaround: cancel and mark as paused
      // resume() will re-speak from the start (best we can do)
      speechSynthesis.cancel();
      setStatus(STATUS.PAUSED);
      emit('tts:pause', { engine: 'webspeech' });
      logDebug('Paused (Android workaround — cancelled internally)');
    } else {
      speechSynthesis.pause();
      // Status update happens in utterance.onpause callback
      logDebug('Pause requested');
    }
  }

  /**
   * Resume paused speech.
   */
  function resume() {
    if (_status !== STATUS.PAUSED) {
      logDebug('Cannot resume — not currently paused');
      return;
    }

    if (_isNeuralEngineActive()) {
      // Neural engines don't support resume
      logDebug('Neural engine does not support resume — no-op');
      return;
    }

    if (_isAndroid && _currentText) {
      // Android workaround: re-speak the full text
      logDebug('Resuming (Android workaround — re-speaking from start)');
      speak(_currentText);
    } else {
      speechSynthesis.resume();
      // Status update happens in utterance.onresume callback
      logDebug('Resume requested');
    }
  }

  // ==========================================================================
  // PUBLIC GETTERS
  // ==========================================================================

  /**
   * Check whether the Web Speech API is available.
   * @returns {boolean}
   */
  function isAvailable() {
    return typeof window !== 'undefined' &&
           'speechSynthesis' in window &&
           typeof SpeechSynthesisUtterance !== 'undefined';
  }

  /**
   * Get current playback status.
   * @returns {'idle'|'speaking'|'paused'}
   */
  function getStatus() {
    // Cross-check with the actual playback state to catch edge cases
    if (_status === STATUS.SPEAKING) {
      if (_neuralBusy) {
        // Neural generation or playback in progress — status is correct
      } else if (_chunkQueue.length > 0) {
        // Chunked Web Speech — remain 'speaking' between chunks
      } else if (isAvailable() && !speechSynthesis.speaking && !speechSynthesis.pending) {
        setStatus(STATUS.IDLE);
      }
    }
    return _status;
  }

  /**
   * Get available voices, sorted with local voices first and English
   * voices prioritised.
   *
   * @returns {Promise<SpeechSynthesisVoice[]>}
   */
  function getVoices() {
    if (_voicesLoaded && _cachedVoices.length > 0) {
      return Promise.resolve(sortVoices(_cachedVoices));
    }
    return ensureVoices().then(function (voices) {
      return sortVoices(voices);
    });
  }

  /**
   * Get available voices synchronously. Returns the cached voice list.
   * May be empty if voices have not finished loading yet.
   *
   * @returns {SpeechSynthesisVoice[]}
   */
  function getVoicesSync() {
    return sortVoices(_cachedVoices);
  }

  /**
   * Get the currently selected voice.
   * @returns {SpeechSynthesisVoice|null}
   */
  function getSelectedVoice() {
    return _selectedVoice;
  }

  /**
   * Get the current engine identifier.
   * @returns {string}
   */
  function getEngine() {
    return _engine;
  }

  /**
   * Get the current speech rate.
   * @returns {number}
   */
  function getRate() {
    return _rate;
  }

  /**
   * Get the current pitch.
   * @returns {number}
   */
  function getPitch() {
    return _pitch;
  }

  // ==========================================================================
  // PUBLIC SETTERS
  // ==========================================================================

  /**
   * Clamp rate to valid range.
   * @param {number} rate
   * @returns {number}
   */
  function clampRate(rate) {
    return Math.max(0.5, Math.min(2.0, rate));
  }

  /**
   * Clamp pitch to valid range.
   * @param {number} pitch
   * @returns {number}
   */
  function clampPitch(pitch) {
    return Math.max(0.5, Math.min(2.0, pitch));
  }

  /**
   * Set the active voice by voiceURI string. Persists to localStorage.
   *
   * @param {string} voiceURI - The voiceURI of the desired voice
   * @returns {boolean} true if the voice was found and set
   */
  function setVoice(voiceURI) {
    var voice = findVoiceByURI(voiceURI);
    if (!voice) {
      logWarn('Voice not found: ' + voiceURI);
      return false;
    }
    _selectedVoice = voice;
    saveSetting(STORAGE_KEYS.VOICE, voiceURI);
    logInfo('Voice set: ' + voice.name + ' (' + voice.lang + ')');
    return true;
  }

  /**
   * Set the speech rate. Persists to localStorage.
   *
   * @param {number} rate - 0.5 to 2.0
   */
  function setRate(rate) {
    _rate = clampRate(rate);
    saveSetting(STORAGE_KEYS.RATE, _rate);
    logInfo('Rate set: ' + _rate);
  }

  /**
   * Set the speech pitch. Persists to localStorage.
   *
   * @param {number} pitch - 0.5 to 2.0
   */
  function setPitch(pitch) {
    _pitch = clampPitch(pitch);
    saveSetting(STORAGE_KEYS.PITCH, _pitch);
    logInfo('Pitch set: ' + _pitch);
  }

  /**
   * Set the active engine. Persists to localStorage.
   *
   * @param {string} engineKey - Engine identifier
   */
  function setEngine(engineKey) {
    _engine = engineKey;
    saveSetting(STORAGE_KEYS.ENGINE, engineKey);
    emit('tts:engineChanged', { engine: engineKey });
    logInfo('Engine set: ' + engineKey);
  }

  /**
   * Set the neural voice ID. Persists to localStorage.
   * Valid values: 'F1', 'F2', 'M1', 'M2'.
   *
   * @param {string} voiceId
   * @returns {boolean} true if the voice was valid and set
   */
  function setNeuralVoice(voiceId) {
    if (['F1', 'F2', 'M1', 'M2'].indexOf(voiceId) === -1) {
      logWarn('Invalid neural voice ID: ' + voiceId + ' — expected F1, F2, M1, or M2');
      return false;
    }
    _neuralVoice = voiceId;
    saveSetting(STORAGE_KEYS.NEURAL_VOICE, voiceId);
    logInfo('Neural voice set: ' + voiceId);
    return true;
  }

  /**
   * Get the current neural voice ID.
   * @returns {string}
   */
  function getNeuralVoice() {
    return _neuralVoice;
  }

  /**
   * Get an array of engine keys that are currently usable.
   * 'webspeech' is included if speechSynthesis is available.
   * Neural engines are included only if loaded (not just cached).
   *
   * @returns {string[]}
   */
  function getAvailableEngines() {
    var engines = [];
    if (isAvailable()) {
      engines.push('webspeech');
    }
    if (window.TTSNeuralGateway &&
        typeof window.TTSNeuralGateway.getLoadedEngine === 'function' &&
        window.TTSNeuralGateway.getLoadedEngine() === 'supertonic') {
      engines.push('supertonic');
    }
    return engines;
  }

  // ==========================================================================
  // VOICE INSPECTION HELPERS
  // ==========================================================================

  /**
   * Check whether a voice is local (on-device) or cloud-based.
   * Cloud voices send text to external servers (Google, Microsoft, etc.)
   * for processing — a privacy consideration.
   *
   * @param {SpeechSynthesisVoice} voice
   * @returns {boolean} true if the voice processes speech locally
   */
  function isLocalVoice(voice) {
    if (!voice || typeof voice.localService === 'undefined') {
      return false;
    }
    return voice.localService === true;
  }

  /**
   * Get a summary of available voices for debugging.
   * @returns {object} { total, local, cloud, languages }
   */
  function getVoiceSummary() {
    var local = 0;
    var cloud = 0;
    var langs = {};

    for (var i = 0; i < _cachedVoices.length; i++) {
      if (_cachedVoices[i].localService) {
        local++;
      } else {
        cloud++;
      }
      var lang = _cachedVoices[i].lang.split('-')[0];
      langs[lang] = (langs[lang] || 0) + 1;
    }

    return {
      total: _cachedVoices.length,
      local: local,
      cloud: cloud,
      languages: langs
    };
  }

  // ==========================================================================
  // PRELOAD & NUDGE (Phase 9 — Polish & Production Hardening)
  // ==========================================================================

  /**
   * Preload the neural TTS model into GPU memory if it is cached but not
   * yet loaded. Non-blocking, failure-tolerant. Silently skips if the
   * neural engine isn't selected, the gateway is missing, the model isn't
   * cached, or a GPU safety check fails.
   */
  function preloadIfNeeded() {
    if (_engine === 'webspeech') return;
    if (!window.TTSNeuralGateway) return;
    if (typeof window.TTSNeuralGateway.getModelState !== 'function') return;

    var state = window.TTSNeuralGateway.getModelState('supertonic');
    if (state !== 'cached') {
      logDebug('Preload skipped — model state: ' + state);
      return;
    }

    // GPU safety check — avoid coexistence OOM on low-VRAM GPUs.
    if (window.LocalGPUMonitor && typeof window.LocalGPUMonitor.checkBeforeLoad === 'function') {
      try {
        var check = window.LocalGPUMonitor.checkBeforeLoad();
        if (check && check.safe === false) {
          logDebug('Skipping TTS preload — GPU safety check failed: ' +
            (check.warning || 'unknown reason'));
          return;
        }
      } catch (e) {
        logDebug('GPU safety check threw — proceeding with preload: ' + e.message);
      }
    }

    logInfo('Preloading neural TTS model (cached → loaded)');
    try {
      var result = window.TTSNeuralGateway.loadModel('supertonic');
      if (result && typeof result.catch === 'function') {
        result.catch(function (err) {
          logWarn('Preload failed (non-critical): ' + (err && err.message ? err.message : err));
        });
      }
    } catch (e) {
      logWarn('Preload threw synchronously (non-critical): ' + e.message);
    }
  }

  /**
   * Show a one-time, dismissible info notification suggesting the neural
   * voice download. Never shown if the model is already downloaded,
   * already dismissed, or if the neural gateway is unavailable.
   */
  function _showDownloadNudge() {
    if (_nudgeShown || _nudgeDismissed) return;
    if (!window.TTSNeuralGateway) return;
    if (typeof window.TTSNeuralGateway.getModelState !== 'function') return;

    var state = window.TTSNeuralGateway.getModelState('supertonic');
    if (state !== 'not-downloaded') {
      logDebug('Nudge skipped — model state: ' + state);
      return;
    }

    _nudgeShown = true;

    if (typeof window.notifyInfo === 'function') {
      window.notifyInfo(
        'A natural-sounding voice is available. Download it in Set Up (263 MB, one-time).',
        { duration: 8000 }
      );
      logInfo('Download nudge shown');
    }
  }

  /**
   * Permanently dismiss the download nudge. Persists to localStorage.
   */
  function dismissNudge() {
    _nudgeDismissed = true;
    _nudgeShown = true;
    saveSetting(STORAGE_KEYS.NUDGE_DISMISSED, 'true');
    logInfo('Download nudge dismissed');
  }

  // ==========================================================================
  // WAV EXPORT (Phase 10 — Audio Export)
  // ==========================================================================

  /**
   * Encode Float32Array PCM samples as a 16-bit mono WAV file.
   * Writes a standard 44-byte RIFF/WAV header followed by int16 sample data.
   *
   * @param {Float32Array} samples — mono PCM samples in [-1, 1] range
   * @param {number} sampleRate — e.g. 44100
   * @returns {Blob} WAV file blob with type audio/wav
   */
  function encodeWav(samples, sampleRate) {
    var numChannels = 1;
    var bitsPerSample = 16;
    var bytesPerSample = bitsPerSample / 8;
    var dataLength = samples.length * bytesPerSample;
    var headerLength = 44;
    var totalLength = headerLength + dataLength;

    var buffer = new ArrayBuffer(totalLength);
    var view = new DataView(buffer);

    // Helper to write ASCII strings
    function writeString(offset, str) {
      for (var i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, totalLength - 8, true);   // file size minus RIFF header
    writeString(8, 'WAVE');

    // fmt sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);                // sub-chunk size (PCM = 16)
    view.setUint16(20, 1, true);                 // audio format (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
    view.setUint16(32, numChannels * bytesPerSample, true);             // block align
    view.setUint16(34, bitsPerSample, true);

    // data sub-chunk
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    // Convert float32 samples to int16 and write
    var offset = headerLength;
    for (var i = 0; i < samples.length; i++) {
      // Clamp to [-1, 1] then scale to int16 range
      var s = Math.max(-1, Math.min(1, samples[i]));
      var int16 = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, int16, true);
      offset += 2;
    }

    logDebug('WAV encoded: ' + samples.length + ' samples, ' +
      sampleRate + ' Hz, ' + (totalLength / 1024).toFixed(1) + ' KB');

    return new Blob([buffer], { type: 'audio/wav' });
  }

  // --------------------------------------------------------------------------
  // MP3 ENCODER LAZY LOADER (Phase 11)
  // --------------------------------------------------------------------------
  // Original lamejs@1.2.1 — the unminified lame.all.js avoids the documented
  // MPEGMode bug in the minified build. The @breezystack fork was tried but
  // 404s on jsdelivr. Loaded lazily on first exportMp3() call.
  // The script attaches a global `lamejs` constructor.
  var LAMEJS_CDN_URL = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.all.js';
  var _lameJsLoadPromise = null;

  function _loadLameJs() {
    if (typeof window.lamejs !== 'undefined') {
      return Promise.resolve(window.lamejs);
    }
    if (_lameJsLoadPromise) return _lameJsLoadPromise;

    _lameJsLoadPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = LAMEJS_CDN_URL;
      script.async = true;
      script.onload = function () {
        if (typeof window.lamejs === 'undefined') {
          _lameJsLoadPromise = null;
          reject(new Error('MP3 encoder loaded but global lamejs is missing.'));
          return;
        }
        logInfo('lamejs loaded from CDN');
        resolve(window.lamejs);
      };
      script.onerror = function () {
        _lameJsLoadPromise = null;
        reject(new Error('MP3 encoder could not be loaded. Use WAV export instead.'));
      };
      document.head.appendChild(script);
    });

    return _lameJsLoadPromise;
  }

  /**
   * Encode Float32Array PCM samples as a 128 kbps CBR mono MP3 file.
   * Requires lamejs to already be loaded (call _loadLameJs() first).
   * Emits tts:exportEncodeProgress events at ~10% intervals.
   *
   * @param {Float32Array} samples — mono PCM samples in [-1, 1] range
   * @param {number} sampleRate — e.g. 44100
   * @returns {Blob} MP3 file blob with type audio/mpeg
   */
  function encodeMp3(samples, sampleRate) {
    var lame = window.lamejs;
    if (!lame) throw new Error('lamejs is not loaded.');

    var channels = 1;
    var bitrate = 128;
    var encoder = new lame.Mp3Encoder(channels, sampleRate, bitrate);

    // Convert float32 → int16
    var int16 = new Int16Array(samples.length);
    for (var i = 0; i < samples.length; i++) {
      var s = Math.max(-1, Math.min(1, samples[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    var blockSize = 1152; // standard MP3 frame size
    var mp3Data = [];
    var totalBlocks = Math.ceil(int16.length / blockSize);
    var lastReportedPercent = -10;

    for (var b = 0; b < totalBlocks; b++) {
      var start = b * blockSize;
      var chunk = int16.subarray(start, start + blockSize);
      var mp3buf = encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) mp3Data.push(mp3buf);

      var percent = Math.floor(((b + 1) / totalBlocks) * 100);
      if (percent - lastReportedPercent >= 10) {
        emit('tts:exportEncodeProgress', { percent: percent });
        lastReportedPercent = percent;
      }
    }

    var tail = encoder.flush();
    if (tail.length > 0) mp3Data.push(tail);

    if (lastReportedPercent < 100) {
      emit('tts:exportEncodeProgress', { percent: 100 });
    }

    // Concatenate all MP3 chunks
    var totalLength = 0;
    for (var j = 0; j < mp3Data.length; j++) totalLength += mp3Data[j].length;
    var output = new Uint8Array(totalLength);
    var offset = 0;
    for (var k = 0; k < mp3Data.length; k++) {
      output.set(mp3Data[k], offset);
      offset += mp3Data[k].length;
    }

    logDebug('MP3 encoded: ' + samples.length + ' samples, ' +
      sampleRate + ' Hz, ' + (output.length / 1024).toFixed(1) + ' KB');

    return new Blob([output], { type: 'audio/mpeg' });
  }

  // --------------------------------------------------------------------------
  // SHARED EXPORT HELPERS
  // --------------------------------------------------------------------------

  function _buildAudioFilename(extension) {
    var now = new Date();
    var timestamp = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + 'T' +
      String(now.getHours()).padStart(2, '0') + '-' +
      String(now.getMinutes()).padStart(2, '0');
    return 'alt-text-audio-' + timestamp + '.' + extension;
  }

  function _triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  /**
   * Validate that neural export is possible. Returns null if OK,
   * otherwise an Error describing the problem.
   */
  function _validateNeuralExport(format) {
    if (_engine === 'webspeech') {
      return new Error(format.toUpperCase() + ' export requires a neural voice engine. Switch to Supertonic in Voice Settings.');
    }
    if (!window.TTSNeuralGateway) {
      return new Error('Neural TTS gateway is not loaded.');
    }
    if (typeof window.TTSNeuralGateway.getModelState === 'function') {
      var modelState = window.TTSNeuralGateway.getModelState('supertonic');
      if (modelState === 'not-downloaded') {
        return new Error('Supertonic model is not downloaded. Download it in Set Up first.');
      }
    }
    return null;
  }

  /**
   * Generate all chunks for the given text sequentially and return the
   * combined Float32 samples plus sample rate. Emits tts:exportProgress
   * events per chunk. Shared by exportWav() and exportMp3().
   *
   * @param {string} trimmedText
   * @param {string} neuralVoice
   * @returns {Promise<{samples: Float32Array, sampleRate: number, totalChunks: number}>}
   */
  function _generateChunkedAudio(trimmedText, neuralVoice, sections) {
    var chunks;
    if (sections && sections.length > 0) {
      chunks = splitIntoSemanticChunks(sections, NEURAL_CHUNK_MAX_LENGTH);
    } else {
      chunks = splitIntoChunks(trimmedText, NEURAL_CHUNK_MAX_LENGTH);
    }
    var totalChunks = chunks.length;

    var results = [];
    var index = 0;
    function next() {
      if (index >= chunks.length) return Promise.resolve(results);
      emit('tts:exportProgress', { chunk: index + 1, totalChunks: totalChunks });
      logDebug('Generating chunk ' + (index + 1) + '/' + totalChunks);
      return window.TTSNeuralGateway.generate(chunks[index], { voice: neuralVoice })
        .then(function (result) {
          results.push(result);
          index++;
          return next();
        });
    }

    return next().then(function (chunkResults) {
      if (!chunkResults.length) throw new Error('No audio generated.');
      var sampleRate = chunkResults[0].sampleRate;

      // Interleave chunk samples with silence gaps (not after the last chunk).
      var pieces = [];
      for (var i = 0; i < chunkResults.length; i++) {
        pieces.push(chunkResults[i].samples);
        if (i < chunkResults.length - 1) {
          pieces.push(createSilenceGap(sampleRate, NEURAL_CHUNK_GAP_SEC));
        }
      }

      return {
        samples: concatFloat32Arrays(pieces),
        sampleRate: sampleRate,
        totalChunks: totalChunks
      };
    });
  }

  /**
   * Generate speech via the neural TTS engine and export as a WAV file
   * download. Does NOT play the audio — export only.
   *
   * @param {string} text — text to synthesise
   * @param {object} [options]
   * @param {string} [options.neuralVoice] — voice ID override (default: stored preference)
   * @returns {Promise<boolean>} resolves true when download is triggered
   */
  function exportWav(textOrResult, options) {
    options = options || {};
    var text, sections;

    if (textOrResult && typeof textOrResult === 'object' && typeof textOrResult.text === 'string') {
      text = textOrResult.text;
      sections = textOrResult.sections || null;
    } else {
      text = textOrResult;
      sections = null;
    }

    var validationError = _validateNeuralExport('wav');
    if (validationError) return Promise.reject(validationError);

    var trimmedText = (text || '').trim();
    if (!trimmedText) {
      return Promise.reject(new Error('No text provided for WAV export.'));
    }

    var neuralVoice = options.neuralVoice || _neuralVoice;
    var chunks = (sections && sections.length > 0)
      ? splitIntoSemanticChunks(sections, NEURAL_CHUNK_MAX_LENGTH)
      : splitIntoChunks(trimmedText, NEURAL_CHUNK_MAX_LENGTH);
    logInfo('WAV export starting, text length: ' + trimmedText.length +
      ', chunks: ' + chunks.length + ', voice: ' + neuralVoice);
    emit('tts:exportStart', {
      text: trimmedText, voice: neuralVoice, totalChunks: chunks.length, format: 'wav'
    });

    return _generateChunkedAudio(trimmedText, neuralVoice, sections)
      .then(function (audio) {
        var blob = encodeWav(audio.samples, audio.sampleRate);
        var filename = _buildAudioFilename('wav');
        _triggerDownload(blob, filename);

        var durationSec = (audio.samples.length / audio.sampleRate).toFixed(1);
        var sizeKB = (blob.size / 1024).toFixed(0);
        logInfo('WAV export complete: ' + filename + ' (' + durationSec + 's, ' + sizeKB + ' KB)');
        emit('tts:exportEnd', {
          filename: filename, size: blob.size, duration: parseFloat(durationSec), format: 'wav'
        });

        return true;
      })
      .catch(function (error) {
        logError('WAV export failed: ' + error.message);
        emit('tts:exportError', { error: error.message, format: 'wav' });
        throw error;
      });
  }

  /**
   * Generate speech via the neural TTS engine and export as a 128 kbps CBR
   * mono MP3 file download. Does NOT play the audio — export only.
   *
   * @param {string} text — text to synthesise
   * @param {object} [options]
   * @param {string} [options.neuralVoice] — voice ID override (default: stored preference)
   * @returns {Promise<boolean>} resolves true when download is triggered
   */
  function exportMp3(textOrResult, options) {
    options = options || {};
    var text, sections;

    if (textOrResult && typeof textOrResult === 'object' && typeof textOrResult.text === 'string') {
      text = textOrResult.text;
      sections = textOrResult.sections || null;
    } else {
      text = textOrResult;
      sections = null;
    }

    var validationError = _validateNeuralExport('mp3');
    if (validationError) return Promise.reject(validationError);

    var trimmedText = (text || '').trim();
    if (!trimmedText) {
      return Promise.reject(new Error('No text provided for MP3 export.'));
    }

    var neuralVoice = options.neuralVoice || _neuralVoice;
    var chunks = (sections && sections.length > 0)
      ? splitIntoSemanticChunks(sections, NEURAL_CHUNK_MAX_LENGTH)
      : splitIntoChunks(trimmedText, NEURAL_CHUNK_MAX_LENGTH);
    logInfo('MP3 export starting, text length: ' + trimmedText.length +
      ', chunks: ' + chunks.length + ', voice: ' + neuralVoice);
    emit('tts:exportStart', {
      text: trimmedText, voice: neuralVoice, totalChunks: chunks.length, format: 'mp3'
    });

    // Load encoder first (lazy, cached) — fail fast if CDN is blocked,
    // before spending time generating audio that we can't encode.
    return _loadLameJs()
      .then(function () {
        return _generateChunkedAudio(trimmedText, neuralVoice, sections);
      })
      .then(function (audio) {
        var blob = encodeMp3(audio.samples, audio.sampleRate);
        var filename = _buildAudioFilename('mp3');
        _triggerDownload(blob, filename);

        var durationSec = (audio.samples.length / audio.sampleRate).toFixed(1);
        var sizeKB = (blob.size / 1024).toFixed(0);
        logInfo('MP3 export complete: ' + filename + ' (' + durationSec + 's, ' + sizeKB + ' KB)');
        emit('tts:exportEnd', {
          filename: filename, size: blob.size, duration: parseFloat(durationSec), format: 'mp3'
        });

        return true;
      })
      .catch(function (error) {
        logError('MP3 export failed: ' + error.message);
        emit('tts:exportError', { error: error.message, format: 'mp3' });
        throw error;
      });
  }

  // ==========================================================================
  // INITIALISE ON LOAD
  // ==========================================================================

  init();

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  return {
    // Playback
    speak: speak,
    stop: stop,
    pause: pause,
    resume: resume,

    // Status
    getStatus: getStatus,
    isAvailable: isAvailable,
    getAvailableEngines: getAvailableEngines,

    // Voice management (Web Speech)
    getVoices: getVoices,
    getVoicesSync: getVoicesSync,
    getSelectedVoice: getSelectedVoice,
    setVoice: setVoice,
    isLocalVoice: isLocalVoice,
    getVoiceSummary: getVoiceSummary,

    // Voice management (Neural)
    getNeuralVoice: getNeuralVoice,
    setNeuralVoice: setNeuralVoice,

    // Settings
    getEngine: getEngine,
    setEngine: setEngine,
    getRate: getRate,
    setRate: setRate,
    getPitch: getPitch,
    setPitch: setPitch,

    // Phase 9 — Polish & Production Hardening
    preloadIfNeeded: preloadIfNeeded,
    dismissNudge: dismissNudge,

    // Phase S3 — Semantic chunking
    splitIntoSemanticChunks: splitIntoSemanticChunks,

    // Phase 10 — WAV Audio Export
    exportWav: exportWav,

    // Phase 11 — MP3 Audio Export
    exportMp3: exportMp3,

    // Re-initialise (e.g. after page visibility change)
    init: init
  };

})();

// Expose globally
window.TTSController = TTSController;
