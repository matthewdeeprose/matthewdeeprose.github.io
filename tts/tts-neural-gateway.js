/**
 * TTS Neural Gateway — Phase 2a: Supertonic TTS via Transformers.js
 *
 * ONNX model loading, audio generation, and model lifecycle management
 * for neural TTS engines. Phase 2a supports Supertonic v1 only.
 * Shares Transformers.js v4 with the existing local text model stack.
 * Uses the same Cache API store (transformers-cache) for persistence.
 *
 * Exposes: window.TTSNeuralGateway
 *
 * Events (via EmbedEventEmitter):
 *   model:stateChange  { modelKey, newState, engine: 'onnx', category: 'tts' }
 *
 * @author Matthew Deeprose
 */
const TTSNeuralGateway = (function () {
  'use strict';

  // ── Logging configuration ──────────────────────────────────────────

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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error.apply(console, ['[TTSNeuralGateway]', message].concat(args));
  }
  function logWarn(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.WARN)) console.warn.apply(console, ['[TTSNeuralGateway]', message].concat(args));
  }
  function logInfo(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.INFO)) console.log.apply(console, ['[TTSNeuralGateway]', message].concat(args));
  }
  function logDebug(message) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log.apply(console, ['[TTSNeuralGateway]', message].concat(args));
  }

  // ── Constants ──────────────────────────────────────────────────────

  var CDN_VERSIONS = {
    'next.9': 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.9',
    'next.10': 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.10',
    latest: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@next'
  };
  var CDN_DEFAULT = 'next.9';
  var CACHE_NAME = 'transformers-cache';

  var STATES = {
    NOT_DOWNLOADED: 'not-downloaded',
    DOWNLOADING: 'downloading',
    CACHED: 'cached',
    LOADING: 'loading',
    LOADED: 'loaded',
    ERROR: 'error'
  };

  // ── Model registry ─────────────────────────────────────────────────

  var MODEL_REGISTRY = [{
    key: 'supertonic',
    name: 'Supertonic TTS',
    hfModelId: 'onnx-community/Supertonic-TTS-ONNX',
    sizeMB: 263,
    voices: ['F1', 'F2', 'M1', 'M2'],
    sampleRate: 44100,
    speakerEmbeddingsUrl: 'https://huggingface.co/onnx-community/Supertonic-TTS-ONNX/resolve/main/voices/{voice}.bin'
  }];

  // ── Closure state ──────────────────────────────────────────────────

  var _v4Module = null;       // Transformers.js v4 module
  var _pipeline = null;       // Loaded pipeline callable
  var _loadedEngine = null;   // Currently loaded engine key
  var _usedWebGPU = false;    // Whether WebGPU was used
  var _modelStates = {};      // Per-model lifecycle state
  var _audioContext = null;    // Web Audio API context
  var _currentSource = null;  // Currently playing AudioBufferSourceNode
  var _voiceCache = {};       // voice key → Float32Array (speaker embeddings)
  var _voiceFetching = {};    // voice key → Promise (single-flight guard)

  MODEL_REGISTRY.forEach(function (model) {
    _modelStates[model.key] = STATES.NOT_DOWNLOADED;
  });

  // ── Event emitter helper ───────────────────────────────────────────

  function emit(eventName, payload) {
    if (window.EmbedEventEmitter && typeof window.EmbedEventEmitter.emit === 'function') {
      window.EmbedEventEmitter.emit(eventName, payload);
      logDebug('Emitted event: ' + eventName, payload);
    }
  }

  // ── State management ───────────────────────────────────────────────

  function setModelState(modelKey, newState) {
    var previous = _modelStates[modelKey];
    _modelStates[modelKey] = newState;
    logDebug('Model state: ' + modelKey + ' ' + previous + ' \u2192 ' + newState);
    emit('model:stateChange', {
      modelKey: modelKey, newState: newState, previousState: previous,
      engine: 'onnx', category: 'tts'
    });
  }

  function findModel(engineKey) {
    for (var i = 0; i < MODEL_REGISTRY.length; i++) {
      if (MODEL_REGISTRY[i].key === engineKey) return MODEL_REGISTRY[i];
    }
    return null;
  }

  // ── Library loading ────────────────────────────────────────────────

  /** Load Transformers.js v4 — reuse from LocalTextModelGateway or CDN import. */
  async function ensureLibrary() {
    if (_v4Module) return _v4Module;

    // Try reusing from the text LLM gateway
    if (window.LocalTextModelGateway &&
        typeof window.LocalTextModelGateway.ensureLibrary === 'function') {
      try {
        _v4Module = await window.LocalTextModelGateway.ensureLibrary();
        if (_v4Module) {
          logInfo('Reusing Transformers.js v4 from LocalTextModelGateway');
          return _v4Module;
        }
      } catch (e) {
        logWarn('Could not reuse library from gateway, importing directly');
      }
    }

    // Direct CDN import with fallbacks
    var versionKey = CDN_DEFAULT;
    try {
      _v4Module = await import(CDN_VERSIONS[versionKey]);
      logInfo('Loaded Transformers.js v4 from CDN: ' + versionKey);
      return _v4Module;
    } catch (e) {
      logDebug('CDN "' + versionKey + '" failed: ' + e.message);
    }

    for (var key in CDN_VERSIONS) {
      if (key === versionKey) continue;
      try {
        _v4Module = await import(CDN_VERSIONS[key]);
        logInfo('Loaded Transformers.js v4 from fallback: ' + key);
        return _v4Module;
      } catch (e) {
        logDebug('Fallback "' + key + '" failed: ' + e.message);
      }
    }

    throw new Error('Could not load Transformers.js from any CDN');
  }

  // ── Cache detection ────────────────────────────────────────────────

  /** Check whether model files exist in the Cache API store. */
  async function isModelCached(engineKey) {
    var model = findModel(engineKey);
    if (!model) {
      logWarn('Unknown engine key: ' + engineKey);
      return false;
    }
    try {
      var cache = await caches.open(CACHE_NAME);
      var keys = await cache.keys();
      var modelSlug = model.hfModelId.replace('/', '%2F');
      return keys.some(function (req) {
        var url = req.url || '';
        return url.includes(model.hfModelId) || url.includes(modelSlug);
      });
    } catch (e) {
      logDebug('Cache check failed: ' + e.message);
      return false;
    }
  }

  // ── Model loading ──────────────────────────────────────────────────

  /**
   * Load a TTS model into memory via pipeline('text-to-speech').
   * Attempts WebGPU first, falls back to WASM.
   */
  async function loadModel(engineKey) {
    var model = findModel(engineKey);
    if (!model) throw new Error('Unknown TTS engine: ' + engineKey);

    if (_loadedEngine === engineKey && _pipeline) {
      logInfo(model.name + ' is already loaded');
      return;
    }

    if (_loadedEngine) await unloadModel();

    setModelState(engineKey, STATES.LOADING);

    try {
      var mod = await ensureLibrary();

      // Try WebGPU first
      logInfo('Loading ' + model.name + ' via pipeline (WebGPU)...');
      try {
        _pipeline = await mod.pipeline('text-to-speech', model.hfModelId, { device: 'webgpu' });
        _usedWebGPU = true;
        logInfo(model.name + ' loaded with WebGPU acceleration');
      } catch (webgpuError) {
        logWarn('WebGPU failed (' + webgpuError.message + '), trying WASM...');
        _pipeline = await mod.pipeline('text-to-speech', model.hfModelId);
        _usedWebGPU = false;
        logInfo(model.name + ' loaded with WASM fallback');
      }

      _loadedEngine = engineKey;
      setModelState(engineKey, STATES.LOADED);
    } catch (e) {
      _pipeline = null;
      _loadedEngine = null;
      setModelState(engineKey, STATES.ERROR);
      logError('Failed to load ' + model.name + ': ' + e.message);
      throw e;
    }
  }

  /**
   * Download a model to the Cache API without loading it into memory.
   * Useful for "Set Up" cards to pre-download models.
   */
  async function preDownloadModel(engineKey) {
    var model = findModel(engineKey);
    if (!model) throw new Error('Unknown TTS engine: ' + engineKey);

    var cached = await isModelCached(engineKey);
    if (cached) {
      logInfo(model.name + ' is already cached');
      setModelState(engineKey, STATES.CACHED);
      return;
    }

    setModelState(engineKey, STATES.DOWNLOADING);

    try {
      var mod = await ensureLibrary();
      var tempPipeline = await mod.pipeline('text-to-speech', model.hfModelId);
      if (tempPipeline && typeof tempPipeline.dispose === 'function') {
        await tempPipeline.dispose();
      }
      setModelState(engineKey, STATES.CACHED);
      logInfo(model.name + ' pre-downloaded and cached');
    } catch (e) {
      setModelState(engineKey, STATES.ERROR);
      logError('Pre-download failed for ' + model.name + ': ' + e.message);
      throw e;
    }
  }

  // ── Audio generation ───────────────────────────────────────────────

  function buildEmbeddingsUrl(model, voice) {
    var safeVoice = voice || (model.voices.length > 0 ? model.voices[0] : 'F1');
    return model.speakerEmbeddingsUrl.replace('{voice}', safeVoice);
  }

  /**
   * Fetch speaker embeddings for a voice, returning cached data on repeat calls.
   * Single-flight: concurrent callers for the same voice share one fetch.
   * Progressive: if fetch fails, falls back to passing the URL string so the
   * pipeline can attempt its own fetch (original behaviour, no worse than before).
   *
   * @param {object} model - Registry entry
   * @param {string} voice - Voice key (e.g. 'M2')
   * @returns {Promise<Float32Array|string>} Cached embeddings or URL fallback
   */
  function getVoiceEmbeddings(model, voice) {
    var key = voice || (model.voices.length > 0 ? model.voices[0] : 'F1');

    // Already cached — instant return
    if (_voiceCache[key]) {
      logDebug('Speaker embeddings cache hit: ' + key);
      return Promise.resolve(_voiceCache[key]);
    }

    // Already fetching — join the in-flight request
    if (_voiceFetching[key]) {
      logDebug('Speaker embeddings fetch in progress, joining: ' + key);
      return _voiceFetching[key];
    }

    var url = buildEmbeddingsUrl(model, key);
    logInfo('Fetching speaker embeddings: ' + key + ' from ' + url);

    _voiceFetching[key] = fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.arrayBuffer();
      })
      .then(function (buffer) {
        var embeddings = new Float32Array(buffer);
        _voiceCache[key] = embeddings;
        logInfo('Cached speaker embeddings: ' + key +
          ' (' + (buffer.byteLength / 1024).toFixed(1) + ' KB)');
        return embeddings;
      })
      .catch(function (err) {
        logWarn('Embeddings fetch failed for ' + key +
          ', falling back to URL: ' + err.message);
        return url; // graceful degradation — pipeline fetches it the old way
      })
      .then(function (result) {
        delete _voiceFetching[key];
        return result;
      });

    return _voiceFetching[key];
  }

  /**
   * Generate audio from text using the loaded neural TTS model.
   * @param {string} text - Text to synthesise
   * @param {object} [options] - { voice: 'F1'|'F2'|'M1'|'M2' }
   * @returns {Promise<{samples: Float32Array, sampleRate: number}>}
   */
  async function generate(text, options) {
    if (!_pipeline || !_loadedEngine) {
      throw new Error('No TTS model loaded \u2014 call loadModel() first');
    }
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('Text must be a non-empty string');
    }

    var model = findModel(_loadedEngine);
    options = options || {};
    var voice = options.voice || model.voices[0];

    logInfo('Generating speech: "' + text.substring(0, 60) +
      (text.length > 60 ? '...' : '') + '" [voice: ' + voice + ']');

    var pipelineOpts = {};
    if (model.speakerEmbeddingsUrl) {
      pipelineOpts.speaker_embeddings = await getVoiceEmbeddings(model, voice);
      logDebug('Speaker embeddings ready for voice: ' + voice);
    }

    var startTime = performance.now();
    var output = await _pipeline(text.trim(), pipelineOpts);
    var genTimeMs = Math.round(performance.now() - startTime);

    // Extract samples — handle various output shapes
    var samples = output.audio || output.data;
    if (samples && samples.data) samples = samples.data;
    if (!(samples instanceof Float32Array)) samples = new Float32Array(samples);

    var sampleRate = output.sampling_rate || model.sampleRate;
    var audioDuration = samples.length / sampleRate;
    var rtf = audioDuration / (genTimeMs / 1000);

    logInfo('Generated ' + audioDuration.toFixed(2) + 's audio in ' +
      (genTimeMs / 1000).toFixed(2) + 's (RTF: ' + rtf.toFixed(1) + 'x)');

    return { samples: samples, sampleRate: sampleRate };
  }

  // ── Audio playback ─────────────────────────────────────────────────

  /** Play audio samples via the Web Audio API. */
  function playAudio(samples, sampleRate) {
    if (!samples || !samples.length) {
      logWarn('No audio samples to play');
      return;
    }

    stopAudio();

    if (!_audioContext) {
      _audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_audioContext.state === 'suspended') _audioContext.resume();

    var buffer = _audioContext.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);

    _currentSource = _audioContext.createBufferSource();
    _currentSource.buffer = buffer;
    _currentSource.connect(_audioContext.destination);
    _currentSource.onended = function () {
      _currentSource = null;
      logDebug('Audio playback ended');
    };
    _currentSource.start(0);
    logDebug('Audio playback started (' + (samples.length / sampleRate).toFixed(2) + 's)');
  }

  /** Stop any currently playing audio. */
  function stopAudio() {
    if (_currentSource) {
      try { _currentSource.stop(); } catch (e) { /* already ended */ }
      _currentSource = null;
    }
  }

  // ── Model unloading ────────────────────────────────────────────────

  /** Unload the currently loaded model and free memory. */
  async function unloadModel() {
    if (!_loadedEngine) {
      logDebug('No model loaded \u2014 nothing to unload');
      return;
    }

    var engineKey = _loadedEngine;
    logInfo('Unloading ' + engineKey + '...');
    stopAudio();

    if (_pipeline && typeof _pipeline.dispose === 'function') {
      try { await _pipeline.dispose(); } catch (e) {
        logWarn('Pipeline dispose error: ' + e.message);
      }
    }

    _pipeline = null;
    _loadedEngine = null;
    _usedWebGPU = false;
    _voiceCache = {};
    _voiceFetching = {};
    setModelState(engineKey, STATES.CACHED);
    logInfo(engineKey + ' unloaded');
  }

  // ── Public getters ─────────────────────────────────────────────────

  function getLoadedEngine() { return _loadedEngine; }

  function getModelState(engineKey) {
    return _modelStates[engineKey] || STATES.NOT_DOWNLOADED;
  }

  function getRegisteredModels() {
    return MODEL_REGISTRY.map(function (model) {
      return {
        key: model.key, name: model.name, hfModelId: model.hfModelId,
        sizeMB: model.sizeMB, voices: model.voices.slice(),
        sampleRate: model.sampleRate,
        state: _modelStates[model.key] || STATES.NOT_DOWNLOADED,
        isLoaded: _loadedEngine === model.key
      };
    });
  }

  // ── Initialisation — check cache state on load ─────────────────────

  (async function initCacheStates() {
    for (var i = 0; i < MODEL_REGISTRY.length; i++) {
      var model = MODEL_REGISTRY[i];
      try {
        var cached = await isModelCached(model.key);
        if (cached && _modelStates[model.key] === STATES.NOT_DOWNLOADED) {
          _modelStates[model.key] = STATES.CACHED;
          logDebug(model.key + ' found in cache');
        }
      } catch (e) {
        logDebug('Cache check failed for ' + model.key + ': ' + e.message);
      }
    }
    logInfo('TTSNeuralGateway initialised \u2014 ' + MODEL_REGISTRY.length + ' model(s) registered');
  })();

  // ── Public API ─────────────────────────────────────────────────────

  return {
    loadModel: loadModel,
    unloadModel: unloadModel,
    preDownloadModel: preDownloadModel,
    generate: generate,
    playAudio: playAudio,
    stopAudio: stopAudio,
    getLoadedEngine: getLoadedEngine,
    getModelState: getModelState,
    getRegisteredModels: getRegisteredModels,
    isModelCached: isModelCached
  };

})();

window.TTSNeuralGateway = TTSNeuralGateway;
