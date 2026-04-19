/**
 * TTS Spike Harness
 *
 * Standalone, console-driven test tool for evaluating text-to-speech engines
 * in the browser. Tests Kokoro TTS, Supertonic TTS, SpeechT5, and the
 * Web Speech API — measuring load time, generation speed, audio quality,
 * voice options, and memory usage.
 *
 * Usage:
 *   await TTSSpike.evaluate({ engine: 'webspeech' });
 *   await TTSSpike.evaluate({ engine: 'kokoro' });
 *   TTSSpike.printSummary();
 *   TTSSpike.exportJSON();
 *   TTSSpike.listEngines();
 *
 * @author Matthew Deeprose
 * @version 1.0.0
 */
(function () {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════
  // Logging configuration
  // ═══════════════════════════════════════════════════════════════════

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[TTSSpike]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[TTSSpike]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[TTSSpike]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[TTSSpike]", message, ...args);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Constants
  // ═══════════════════════════════════════════════════════════════════

  const CDN_VERSIONS = {
    "next.9":
      "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.9",
    "next.10":
      "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.10",
    latest: "https://cdn.jsdelivr.net/npm/@huggingface/transformers@next",
  };
  const CDN_DEFAULT = "next.9";
  const CACHE_NAME = "transformers-cache";

  const KOKORO_JS_CDN = "https://cdn.jsdelivr.net/npm/kokoro-js@latest";

  const KNOWN_ENGINES = {
    kokoro: {
      name: "Kokoro TTS",
      modelId: "onnx-community/Kokoro-82M-ONNX",
      params: "82M",
      sizeMB: 82,
      sampleRate: 24000,
      voices: [
        "af_heart",
        "af_bella",
        "af_sarah",
        "am_adam",
        "am_michael",
        "bf_emma",
        "bf_isabella",
        "bm_george",
        "bm_lewis",
      ],
      architecture: "StyleTTS 2",
      notes:
        "Best quality. WebGPU + WASM. Via Transformers.js v4 or kokoro-js.",
      dtype: "q8",
      device: "webgpu",
    },
    supertonic: {
      name: "Supertonic TTS",
      modelId: "onnx-community/Supertonic-TTS-ONNX",
      params: "66M",
      sizeMB: 263,
      sampleRate: 44100,
      voices: ["F1", "F2", "M1", "M2"],
      architecture: "Flow matching",
      notes:
        'Higher sample rate (44.1kHz). ~263MB download. pipeline("text-to-speech") API.',
      dtype: null,
      device: "webgpu",
      speakerEmbeddingsUrl:
        "https://huggingface.co/onnx-community/Supertonic-TTS-ONNX/resolve/main/voices/{voice}.bin",
    },
    "supertonic-v2": {
      name: "Supertonic TTS v2",
      modelId: "onnx-community/Supertonic-TTS-2-ONNX",
      params: "66M",
      sizeMB: 263,
      sampleRate: 44100,
      voices: ["F1", "F2", "M1", "M2"],
      architecture: "Flow matching",
      notes: "Multilingual (EN/KO/ES/PT/FR). Same size as v1.",
      dtype: null,
      device: "webgpu",
      speakerEmbeddingsUrl:
        "https://huggingface.co/onnx-community/Supertonic-TTS-2-ONNX/resolve/main/voices/{voice}.bin",
    },
    speecht5: {
      name: "SpeechT5",
      modelId: "Xenova/speecht5_tts",
      params: "30M",
      sizeMB: 60,
      sampleRate: 16000,
      voices: ["default"],
      architecture: "SpeechT5",
      notes:
        "Original Transformers.js TTS. 16kHz — sounds dated. Baseline comparison only.",
      dtype: null,
      device: null,
      speakerEmbeddingsUrl:
        "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin",
    },
    webspeech: {
      name: "Web Speech API",
      modelId: null,
      params: "N/A",
      sizeMB: 0,
      sampleRate: null,
      voices: [],
      architecture: "Browser built-in",
      notes:
        "Zero download. Quality varies by OS/browser. Some voices are cloud-based (privacy).",
      dtype: null,
      device: null,
    },
  };

  // ═══════════════════════════════════════════════════════════════════
  // Test sentences
  // ═══════════════════════════════════════════════════════════════════

  var TEST_SHORT =
    "A photograph showing three students working together at a computer.";

  var TEST_ALT_TEXT =
    "A photograph showing three students working together at a computer.";

  var TEST_LONG =
    "Title: University Lecture Hall\n\n" +
    "Alt Text: A colour photograph of a university lecture hall with tiered seating. ";

  // ═══════════════════════════════════════════════════════════════════
  // Hardware detection (matches text LLM harness pattern)
  // ═══════════════════════════════════════════════════════════════════

  const HARDWARE_CLASSES = {
    4070: "rtx-4070",
    4060: "rtx-4060",
    2070: "rtx-2070",
    1660: "gtx-1660s",
    "780m": "ryzen-igpu",
    "radeon 780m": "ryzen-igpu",
    "rdna-3": "amd-rdna3",
    "rdna-2": "amd-rdna2",
    radeon: "amd-discrete",
  };

  // ═══════════════════════════════════════════════════════════════════
  // Closure state
  // ═══════════════════════════════════════════════════════════════════

  var v4Module = null;
  var kokoroJsModule = null;
  var loadedPipeline = null;
  var loadedModel = null;
  var results = null;
  var hardwareInfo = null;
  var resolvedCdnUrl = null;
  var currentEngineKey = null;

  // ═══════════════════════════════════════════════════════════════════
  // Audio playback
  // ═══════════════════════════════════════════════════════════════════

  var audioContext = null;
  var currentSource = null;

  function playAudio(samples, sampleRate, durationLimit) {
    return new Promise(function (resolve) {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      // Stop any currently playing audio
      if (currentSource) {
        try {
          currentSource.stop();
        } catch (e) {
          /* ignore */
        }
      }

      var buffer = audioContext.createBuffer(1, samples.length, sampleRate);
      buffer.copyToChannel(samples, 0);
      currentSource = audioContext.createBufferSource();
      currentSource.buffer = buffer;
      currentSource.connect(audioContext.destination);

      var playDuration = durationLimit || buffer.duration;
      currentSource.onended = function () {
        resolve();
      };
      currentSource.start(0, 0, playDuration);

      // Safety timeout
      setTimeout(resolve, (playDuration + 0.5) * 1000);
    });
  }

  function stopAudio() {
    if (currentSource) {
      try {
        currentSource.stop();
      } catch (e) {
        /* ignore */
      }
      currentSource = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Utility helpers
  // ═══════════════════════════════════════════════════════════════════

  function now() {
    return performance.now();
  }

  function elapsed(start) {
    return Math.round(performance.now() - start);
  }

  function makeStepResult(status, duration, notes, extras) {
    var result = { status: status, duration: duration, notes: notes || "" };
    if (extras) {
      Object.keys(extras).forEach(function (key) {
        result[key] = extras[key];
      });
    }
    return result;
  }

  function createFreshResults(engineKey) {
    var engineInfo = KNOWN_ENGINES[engineKey] || {};
    return {
      engine: engineKey,
      engineInfo: Object.assign({}, engineInfo),
      timestamp: new Date().toISOString(),
      machine: {
        gpu: "",
        browser: navigator.userAgent,
        webgpu: false,
      },
      steps: {
        webgpuCheck: null,
        libraryLoad: null,
        modelLoad: null,
        basicSynthesis: null,
        altTextBenchmark: null,
        voiceTest: null,
        longTextTest: null,
        cleanup: null,
      },
      overallStatus: "",
      summary: "",
    };
  }

  function computeOverallStatus(steps) {
    var criticalSteps = ["libraryLoad", "modelLoad"];
    var hasCriticalFail = criticalSteps.some(function (name) {
      return steps[name] && steps[name].status === "fail";
    });
    if (hasCriticalFail) return "fail";

    var allSteps = Object.keys(steps);
    var allPass = allSteps.every(function (name) {
      return (
        !steps[name] ||
        steps[name].status === "pass" ||
        steps[name].status === "skip"
      );
    });
    if (allPass) return "pass";
    return "partial";
  }

  function computeSummary(res) {
    var status = res.overallStatus.toUpperCase();
    var loadTime =
      res.steps.modelLoad && res.steps.modelLoad.loadTimeMs
        ? (res.steps.modelLoad.loadTimeMs / 1000).toFixed(1) + "s"
        : "N/A";
    var rtf =
      res.steps.altTextBenchmark && res.steps.altTextBenchmark.rtf
        ? res.steps.altTextBenchmark.rtf.toFixed(1) + "x RTF"
        : "N/A";
    var voices =
      res.steps.voiceTest && res.steps.voiceTest.voiceCount
        ? res.steps.voiceTest.voiceCount + " voices"
        : "N/A";
    return status + " | Load: " + loadTime + " | " + rtf + " | " + voices;
  }

  function markRemainingSkipped(steps, failedStep) {
    var stepOrder = [
      "webgpuCheck",
      "libraryLoad",
      "modelLoad",
      "basicSynthesis",
      "altTextBenchmark",
      "voiceTest",
      "longTextTest",
      "cleanup",
    ];
    var failIndex = stepOrder.indexOf(failedStep);
    for (var i = failIndex + 1; i < stepOrder.length; i++) {
      if (!steps[stepOrder[i]]) {
        steps[stepOrder[i]] = makeStepResult(
          "skip",
          0,
          "Skipped due to " + failedStep + " failure",
        );
      }
    }
  }

  function finaliseResults() {
    results.overallStatus = computeOverallStatus(results.steps);
    results.summary = computeSummary(results);

    logInfo("");
    logInfo("════════════════════════════════════════════════════════════");
    logInfo("  EVALUATION COMPLETE: " + results.summary);
    logInfo("════════════════════════════════════════════════════════════");
    logInfo("");
    logInfo("Call TTSSpike.printSummary() for detailed results table.");
  }

  // ═══════════════════════════════════════════════════════════════════
  // Hardware detection (runs once per session)
  // ═══════════════════════════════════════════════════════════════════

  async function detectHardware() {
    if (hardwareInfo) return hardwareInfo;

    var info = {
      gpuDescription: "",
      gpuVendor: "",
      hardwareClass: "unknown",
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      webgpu: false,
      maxBufferSize: 0,
    };

    try {
      if (!navigator.gpu) {
        info.hardwareClass = "wasm-cpu";
        logWarn("WebGPU not available — hardware class set to wasm-cpu");
        hardwareInfo = info;
        return info;
      }

      var adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        info.hardwareClass = "wasm-cpu";
        logWarn("No WebGPU adapter found — hardware class set to wasm-cpu");
        hardwareInfo = info;
        return info;
      }

      info.webgpu = true;
      var adapterInfo =
        adapter.info ||
        (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : {});
      info.gpuDescription = adapterInfo.description || "";
      info.gpuVendor = adapterInfo.vendor || "";
      info.gpuArchitecture = adapterInfo.architecture || "";
      info.maxBufferSize = adapter.limits ? adapter.limits.maxBufferSize : 0;

      var searchStr = (
        info.gpuDescription +
        " " +
        info.gpuVendor +
        " " +
        info.gpuArchitecture
      ).toLowerCase();
      for (var pattern in HARDWARE_CLASSES) {
        if (searchStr.includes(pattern)) {
          info.hardwareClass = HARDWARE_CLASSES[pattern];
          break;
        }
      }

      logInfo(
        "Detected GPU: " +
          (
            info.gpuDescription || info.gpuVendor + " " + info.gpuArchitecture
          ).trim() +
          " (" +
          info.hardwareClass +
          ")" +
          " | maxBufferSize: " +
          (info.maxBufferSize / (1024 * 1024)).toFixed(0) +
          "MB",
      );
    } catch (e) {
      info.hardwareClass = "wasm-cpu";
      logWarn("Hardware detection failed:", e.message);
    }

    hardwareInfo = info;
    return info;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Transformers.js dynamic CDN import
  // ═══════════════════════════════════════════════════════════════════

  async function ensureLibrary() {
    if (v4Module) return v4Module;

    // Try reusing from text LLM gateway
    if (
      window.LocalTextModelGateway &&
      typeof window.LocalTextModelGateway.ensureLibrary === "function"
    ) {
      try {
        v4Module = await window.LocalTextModelGateway.ensureLibrary();
        if (v4Module) {
          logInfo("Reusing Transformers.js v4 from LocalTextModelGateway");
          return v4Module;
        }
      } catch (e) {
        logWarn("Could not reuse library from gateway, importing directly");
      }
    }

    // Direct import with fallbacks
    var versionKey = CDN_DEFAULT;
    var primaryUrl = CDN_VERSIONS[versionKey];

    try {
      logDebug('Trying CDN version "' + versionKey + '": ' + primaryUrl);
      v4Module = await import(primaryUrl);
      resolvedCdnUrl = primaryUrl;
      logInfo("Loaded Transformers.js v4 from CDN: " + versionKey);
      return v4Module;
    } catch (e) {
      logDebug('CDN "' + versionKey + '" failed: ' + e.message);
    }

    // Try fallbacks
    for (var key in CDN_VERSIONS) {
      if (key === versionKey) continue;
      try {
        logDebug('Trying fallback CDN "' + key + '"');
        v4Module = await import(CDN_VERSIONS[key]);
        resolvedCdnUrl = CDN_VERSIONS[key];
        logInfo("Loaded Transformers.js v4 from fallback: " + key);
        return v4Module;
      } catch (e) {
        logDebug('Fallback "' + key + '" failed: ' + e.message);
      }
    }

    throw new Error("Could not load Transformers.js from any CDN");
  }

  // ═══════════════════════════════════════════════════════════════════
  // Cache detection
  // ═══════════════════════════════════════════════════════════════════

  async function checkCacheForModel(modelId) {
    try {
      var cache = await caches.open(CACHE_NAME);
      var keys = await cache.keys();
      var modelSlug = modelId.replace("/", "%2F");
      var found = keys.some(function (req) {
        var url = req.url || "";
        return url.includes(modelId) || url.includes(modelSlug);
      });
      return found;
    } catch (e) {
      logDebug("Cache check failed:", e.message);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Web Speech API helpers
  // ═══════════════════════════════════════════════════════════════════

  function getVoices() {
    return new Promise(function (resolve) {
      var voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve(voices);
        return;
      }
      // Chrome loads voices asynchronously
      speechSynthesis.onvoiceschanged = function () {
        resolve(speechSynthesis.getVoices());
      };
      // Timeout fallback
      setTimeout(function () {
        resolve(speechSynthesis.getVoices());
      }, 2000);
    });
  }

  function speakWebSpeech(text, voice) {
    return new Promise(function (resolve, reject) {
      speechSynthesis.cancel();
      var utterance = new SpeechSynthesisUtterance(text);
      if (voice) utterance.voice = voice;
      var startTime = now();
      utterance.onend = function () {
        resolve({ durationMs: elapsed(startTime) });
      };
      utterance.onerror = function (e) {
        reject(new Error("SpeechSynthesis error: " + (e.error || "unknown")));
      };
      speechSynthesis.speak(utterance);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Neural TTS synthesis helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Attempt to generate audio from a neural TTS engine.
   * Returns { samples: Float32Array, sampleRate: number } or throws.
   */
  /**
   * Resolve speaker embeddings for an engine + voice combination.
   * Returns the embeddings URL string (for pipeline) or null if not needed.
   */
  function getSpeakerEmbeddingsUrl(engineKey, voiceId) {
    var engineInfo = KNOWN_ENGINES[engineKey];
    if (!engineInfo.speakerEmbeddingsUrl) return null;

    var url = engineInfo.speakerEmbeddingsUrl;
    // For Supertonic: URL contains {voice} placeholder
    if (url.includes("{voice}")) {
      var voice = voiceId || (engineInfo.voices.length > 0 ? engineInfo.voices[0] : "F1");
      return url.replace("{voice}", voice);
    }
    // For SpeechT5: single fixed URL
    return url;
  }

  async function synthesiseNeural(text, engineKey, voiceId) {
    var engineInfo = KNOWN_ENGINES[engineKey];

    if (engineKey === "kokoro") {
      return await synthesiseKokoro(text, voiceId);
    }

    // Supertonic, Supertonic v2, SpeechT5 — use pipeline API
    if (loadedPipeline) {
      var pipelineOpts = {};

      // Fetch speaker embeddings if the engine requires them
      var embeddingsUrl = getSpeakerEmbeddingsUrl(engineKey, voiceId);
      if (embeddingsUrl) {
        logInfo("Using speaker embeddings: " + embeddingsUrl);

        if (engineKey === "speecht5") {
          // SpeechT5 needs raw tensor data, not a URL string
          // Fetch the .bin file and pass Float32Array directly
          logInfo("Fetching SpeechT5 speaker embeddings as tensor...");
          var response = await fetch(embeddingsUrl);
          if (!response.ok) {
            throw new Error("Failed to fetch speaker embeddings: " + response.status);
          }
          var buffer = await response.arrayBuffer();
          var embeddingData = new Float32Array(buffer);
          logInfo("Speaker embeddings loaded: " + embeddingData.length + " values (" + (buffer.byteLength / 1024).toFixed(1) + " KB)");
          pipelineOpts.speaker_embeddings = embeddingData;
        } else {
          // Supertonic accepts a URL string directly
          pipelineOpts.speaker_embeddings = embeddingsUrl;
        }
      }

      var output = await loadedPipeline(text, pipelineOpts);
      // pipeline('text-to-speech') returns { audio: Float32Array, sampling_rate: number }
      var samples = output.audio || output.data;
      var sr =
        output.sampling_rate || output.sampleRate || engineInfo.sampleRate;

      // Handle nested typed arrays (some pipelines return a nested structure)
      if (samples && samples.data) {
        samples = samples.data;
      }
      if (!(samples instanceof Float32Array)) {
        samples = new Float32Array(samples);
      }

      return { samples: samples, sampleRate: sr };
    }

    throw new Error("No loaded pipeline or model for engine: " + engineKey);
  }

  /**
   * Kokoro-specific synthesis — tries multiple loading approaches.
   * The exact API is unknown; discovery is a primary goal of this spike.
   */
  async function synthesiseKokoro(text, voiceId) {
    // If loaded via kokoro-js, use its API
    if (kokoroJsModule && loadedModel) {
      var output = await loadedModel.generate(text, {
        voice: voiceId || "af_heart",
      });
      // kokoro-js returns an audio object — shape TBD during spike
      var samples = output.audio || output.data || output;
      if (samples && samples.data) samples = samples.data;
      if (!(samples instanceof Float32Array))
        samples = new Float32Array(samples);
      return { samples: samples, sampleRate: 24000 };
    }

    // If loaded via Transformers.js pipeline
    if (loadedPipeline) {
      var output = await loadedPipeline(text, { voice: voiceId || "af_heart" });
      var samples = output.audio || output.data;
      if (samples && samples.data) samples = samples.data;
      if (!(samples instanceof Float32Array))
        samples = new Float32Array(samples);
      return { samples: samples, sampleRate: output.sampling_rate || 24000 };
    }

    // If loaded via AutoModel.from_pretrained (approach 2 — no kokoroJsModule)
    if (loadedModel) {
      // AutoModel may expose generate() or __call__()
      var output;
      if (typeof loadedModel.generate === "function") {
        output = await loadedModel.generate(text, {
          voice: voiceId || "af_heart",
        });
      } else if (typeof loadedModel.__call__ === "function") {
        output = await loadedModel.__call__(text, {
          voice: voiceId || "af_heart",
        });
      } else {
        // Try calling the model directly as a function (some Transformers.js models)
        output = await loadedModel(text, { voice: voiceId || "af_heart" });
      }
      var samples = output.audio || output.data || output;
      if (samples && samples.data) samples = samples.data;
      if (!(samples instanceof Float32Array))
        samples = new Float32Array(samples);
      return { samples: samples, sampleRate: output.sampling_rate || 24000 };
    }

    throw new Error("Kokoro: no loaded model or pipeline");
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 1: webgpuCheck
  // ═══════════════════════════════════════════════════════════════════

  async function stepWebgpuCheck() {
    logInfo("─── Step 1/8: webgpuCheck ───");
    var start = now();

    try {
      if (!navigator.gpu) {
        var result = makeStepResult(
          "pass",
          elapsed(start),
          "WebGPU not available — WASM fallback will be used",
          { webgpu: false },
        );
        logInfo("RESULT: PASS — WebGPU not available, WASM fallback");
        return result;
      }

      var adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        var result = makeStepResult(
          "pass",
          elapsed(start),
          "WebGPU API present but no adapter — WASM fallback",
          { webgpu: false },
        );
        logInfo("RESULT: PASS — No WebGPU adapter, WASM fallback");
        return result;
      }

      var adapterInfo = adapter.info || {};
      var gpu = adapterInfo.description || adapterInfo.vendor || "unknown GPU";
      var maxBuffer = adapter.limits ? adapter.limits.maxBufferSize : 0;
      var maxBufferMB = (maxBuffer / (1024 * 1024)).toFixed(0);

      var notes =
        "WebGPU available: " + gpu + " | maxBufferSize: " + maxBufferMB + "MB";
      var result = makeStepResult("pass", elapsed(start), notes, {
        webgpu: true,
        gpu: gpu,
        maxBufferSize: maxBuffer,
      });
      logInfo("RESULT: PASS — " + notes);
      return result;
    } catch (e) {
      var result = makeStepResult(
        "pass",
        elapsed(start),
        "WebGPU check error: " + e.message + " — WASM fallback",
        { webgpu: false },
      );
      logWarn("RESULT: PASS (with warning) — " + e.message);
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 2: libraryLoad
  // ═══════════════════════════════════════════════════════════════════

  async function stepLibraryLoad(engineKey) {
    logInfo("─── Step 2/8: libraryLoad ───");
    var start = now();

    // Web Speech API needs no library
    if (engineKey === "webspeech") {
      if (!window.speechSynthesis) {
        var result = makeStepResult(
          "fail",
          elapsed(start),
          "window.speechSynthesis not available in this browser",
        );
        logError("RESULT: FAIL — speechSynthesis not available");
        return result;
      }
      var result = makeStepResult(
        "pass",
        elapsed(start),
        "Web Speech API available (no library needed)",
      );
      logInfo("RESULT: PASS — speechSynthesis available");
      return result;
    }

    // Neural engines need Transformers.js
    try {
      await ensureLibrary();
      var duration = elapsed(start);
      var cdnLabel = resolvedCdnUrl
        ? resolvedCdnUrl.split("@").pop()
        : "unknown";
      var notes = "Transformers.js v4 loaded (" + cdnLabel + ")";
      var result = makeStepResult("pass", duration, notes);
      logInfo("RESULT: PASS — " + notes + " in " + duration + "ms");
      return result;
    } catch (e) {
      var result = makeStepResult(
        "fail",
        elapsed(start),
        "Failed to load Transformers.js: " + e.message,
      );
      logError("RESULT: FAIL — " + e.message);
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 3: modelLoad
  // ═══════════════════════════════════════════════════════════════════

  async function stepModelLoad(engineKey) {
    logInfo("─── Step 3/8: modelLoad ───");
    var engineInfo = KNOWN_ENGINES[engineKey];
    var start = now();

    // ── Web Speech API: enumerate voices ──
    if (engineKey === "webspeech") {
      try {
        var voices = await getVoices();
        var localVoices = voices.filter(function (v) {
          return v.localService;
        });
        var cloudVoices = voices.filter(function (v) {
          return !v.localService;
        });
        var notes =
          voices.length +
          " voices (" +
          localVoices.length +
          " local, " +
          cloudVoices.length +
          " cloud)";

        // Store voice info for later steps
        KNOWN_ENGINES.webspeech.voices = voices.map(function (v) {
          return {
            name: v.name,
            lang: v.lang,
            local: v.localService,
            uri: v.voiceURI,
          };
        });

        var result = makeStepResult("pass", elapsed(start), notes, {
          voiceCount: voices.length,
          localCount: localVoices.length,
          cloudCount: cloudVoices.length,
          loadTimeMs: elapsed(start),
        });
        logInfo("RESULT: PASS — " + notes);
        return result;
      } catch (e) {
        var result = makeStepResult(
          "fail",
          elapsed(start),
          "Voice enumeration failed: " + e.message,
        );
        logError("RESULT: FAIL — " + e.message);
        return result;
      }
    }

    // ── Kokoro: try multiple approaches ──
    if (engineKey === "kokoro") {
      return await stepModelLoadKokoro(start);
    }

    // ── Pipeline-based engines (Supertonic, SpeechT5) ──
    try {
      var cached = await checkCacheForModel(engineInfo.modelId);
      logInfo(
        "Cache status for " +
          engineInfo.modelId +
          ": " +
          (cached ? "CACHED" : "not cached"),
      );

      var pipelineOpts = {};
      if (engineInfo.dtype) pipelineOpts.dtype = engineInfo.dtype;
      if (engineInfo.device) pipelineOpts.device = engineInfo.device;

      logInfo(
        'Loading pipeline("text-to-speech", "' + engineInfo.modelId + '")...',
      );
      loadedPipeline = await v4Module.pipeline(
        "text-to-speech",
        engineInfo.modelId,
        pipelineOpts,
      );

      var loadTimeMs = elapsed(start);
      var notes =
        engineInfo.name +
        " loaded via pipeline in " +
        (loadTimeMs / 1000).toFixed(1) +
        "s" +
        (cached ? " (from cache)" : " (fresh download)");
      var result = makeStepResult("pass", loadTimeMs, notes, {
        loadTimeMs: loadTimeMs,
        fromCache: cached,
        approach: "pipeline",
      });
      logInfo("RESULT: PASS — " + notes);
      return result;
    } catch (e) {
      // For Supertonic, try without device option (WASM fallback)
      if (engineInfo.device) {
        try {
          logWarn(
            'Pipeline with device "' +
              engineInfo.device +
              '" failed, trying WASM fallback...',
          );
          var fallbackOpts = {};
          if (engineInfo.dtype) fallbackOpts.dtype = engineInfo.dtype;
          loadedPipeline = await v4Module.pipeline(
            "text-to-speech",
            engineInfo.modelId,
            fallbackOpts,
          );

          var loadTimeMs = elapsed(start);
          var notes =
            engineInfo.name +
            " loaded via pipeline (WASM fallback) in " +
            (loadTimeMs / 1000).toFixed(1) +
            "s";
          var result = makeStepResult("pass", loadTimeMs, notes, {
            loadTimeMs: loadTimeMs,
            fromCache: false,
            approach: "pipeline-wasm-fallback",
          });
          logInfo("RESULT: PASS — " + notes);
          return result;
        } catch (e2) {
          var result = makeStepResult(
            "fail",
            elapsed(start),
            "Pipeline load failed (both WebGPU and WASM): " + e2.message,
          );
          logError("RESULT: FAIL — " + e2.message);
          return result;
        }
      }

      var result = makeStepResult(
        "fail",
        elapsed(start),
        "Pipeline load failed: " + e.message,
      );
      logError("RESULT: FAIL — " + e.message);
      return result;
    }
  }

  /**
   * Kokoro model loading — tries three approaches in order:
   * 1. pipeline('text-to-speech') via Transformers.js
   * 2. AutoModel.from_pretrained() via Transformers.js
   * 3. kokoro-js CDN import
   */
  async function stepModelLoadKokoro(start) {
    var engineInfo = KNOWN_ENGINES.kokoro;
    var cached = await checkCacheForModel(engineInfo.modelId);
    logInfo(
      "Cache status for " +
        engineInfo.modelId +
        ": " +
        (cached ? "CACHED" : "not cached"),
    );

    // Approach 1: pipeline API
    logInfo(
      'Kokoro approach 1: pipeline("text-to-speech", "' +
        engineInfo.modelId +
        '")...',
    );
    try {
      var pipelineOpts = { device: "webgpu" };
      if (engineInfo.dtype) pipelineOpts.dtype = engineInfo.dtype;
      loadedPipeline = await v4Module.pipeline(
        "text-to-speech",
        engineInfo.modelId,
        pipelineOpts,
      );

      var loadTimeMs = elapsed(start);
      var notes =
        'Kokoro loaded via pipeline("text-to-speech") in ' +
        (loadTimeMs / 1000).toFixed(1) +
        "s" +
        (cached ? " (from cache)" : " (fresh download)");
      logInfo("RESULT: PASS — " + notes);
      return makeStepResult("pass", loadTimeMs, notes, {
        loadTimeMs: loadTimeMs,
        fromCache: cached,
        approach: "pipeline",
      });
    } catch (e) {
      logWarn("Approach 1 failed: " + e.message);
    }

    // Approach 1b: pipeline without WebGPU
    logInfo("Kokoro approach 1b: pipeline without WebGPU...");
    try {
      var opts = {};
      if (engineInfo.dtype) opts.dtype = engineInfo.dtype;
      loadedPipeline = await v4Module.pipeline(
        "text-to-speech",
        engineInfo.modelId,
        opts,
      );

      var loadTimeMs = elapsed(start);
      var notes =
        "Kokoro loaded via pipeline (WASM) in " +
        (loadTimeMs / 1000).toFixed(1) +
        "s";
      logInfo("RESULT: PASS — " + notes);
      return makeStepResult("pass", loadTimeMs, notes, {
        loadTimeMs: loadTimeMs,
        fromCache: cached,
        approach: "pipeline-wasm",
      });
    } catch (e) {
      logWarn("Approach 1b failed: " + e.message);
    }

    // Approach 2 (AutoModel.from_pretrained) skipped — loads weights but
    // StyleTextToSpeech2Model has no .generate(), so synthesis is impossible.

    // Approach 3: kokoro-js CDN (purpose-built for Kokoro, supports .generate())
    logInfo("Kokoro approach 3: importing kokoro-js from CDN...");
    try {
      kokoroJsModule = await import(KOKORO_JS_CDN);
      logInfo(
        "kokoro-js module imported. Available exports: " +
          Object.keys(kokoroJsModule).join(", "),
      );

      // kokoro-js typically exports a KokoroTTS class or similar
      var KokoroClass =
        kokoroJsModule.KokoroTTS ||
        kokoroJsModule.Kokoro ||
        kokoroJsModule.default;

      if (KokoroClass) {
        loadedModel = await KokoroClass.from_pretrained(engineInfo.modelId);

        var loadTimeMs = elapsed(start);
        var notes =
          "Kokoro loaded via kokoro-js CDN in " +
          (loadTimeMs / 1000).toFixed(1) +
          "s";
        logInfo("RESULT: PASS — " + notes);
        return makeStepResult("pass", loadTimeMs, notes, {
          loadTimeMs: loadTimeMs,
          fromCache: cached,
          approach: "kokoro-js",
        });
      } else {
        logWarn(
          "kokoro-js imported but no usable class found. Exports: " +
            Object.keys(kokoroJsModule).join(", "),
        );
      }
    } catch (e) {
      logWarn("Approach 3 failed: " + e.message);
    }

    // All approaches exhausted
    var result = makeStepResult(
      "fail",
      elapsed(start),
      "All 3 Kokoro loading approaches failed. See log for details.",
    );
    logError("RESULT: FAIL — Kokoro could not be loaded via any approach");
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 4: basicSynthesis
  // ═══════════════════════════════════════════════════════════════════

  async function stepBasicSynthesis(engineKey) {
    logInfo("─── Step 4/8: basicSynthesis ───");
    logInfo('Text: "' + TEST_SHORT + '"');
    var start = now();

    try {
      // ── Web Speech API ──
      if (engineKey === "webspeech") {
        var speechResult = await speakWebSpeech(TEST_SHORT);
        var duration = elapsed(start);
        var notes =
          "Web Speech played in " +
          (speechResult.durationMs / 1000).toFixed(1) +
          "s";
        var result = makeStepResult("pass", duration, notes, {
          audioDurationMs: speechResult.durationMs,
        });
        logInfo("RESULT: PASS — " + notes);
        return result;
      }

      // ── Neural engines ──
      var output = await synthesiseNeural(TEST_SHORT, engineKey);
      var genTimeMs = elapsed(start);

      if (!output.samples || output.samples.length === 0) {
        var result = makeStepResult(
          "fail",
          genTimeMs,
          "Synthesis returned empty audio",
        );
        logError("RESULT: FAIL — empty audio");
        return result;
      }

      var audioDuration = output.samples.length / output.sampleRate;
      var rtf = audioDuration / (genTimeMs / 1000);

      logInfo(
        "Generated " +
          output.samples.length +
          " samples (" +
          audioDuration.toFixed(1) +
          "s audio) in " +
          genTimeMs +
          "ms | RTF: " +
          rtf.toFixed(1) +
          "x",
      );
      logInfo("Playing audio...");
      await playAudio(output.samples, output.sampleRate);
      logInfo("Playback complete.");

      var notes =
        audioDuration.toFixed(1) +
        "s audio, RTF " +
        rtf.toFixed(1) +
        "x, " +
        output.samples.length +
        " samples @ " +
        output.sampleRate +
        "Hz";
      var result = makeStepResult("pass", genTimeMs, notes, {
        audioDurationSec: audioDuration,
        rtf: rtf,
        sampleCount: output.samples.length,
        sampleRate: output.sampleRate,
      });
      logInfo("RESULT: PASS — " + notes);
      return result;
    } catch (e) {
      var result = makeStepResult(
        "fail",
        elapsed(start),
        "Basic synthesis failed: " + e.message,
      );
      logError("RESULT: FAIL — " + e.message);
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 5: altTextBenchmark
  // ═══════════════════════════════════════════════════════════════════

  async function stepAltTextBenchmark(engineKey) {
    logInfo("─── Step 5/8: altTextBenchmark ───");
    logInfo('Text: "' + TEST_ALT_TEXT.substring(0, 80) + '..."');
    var start = now();

    try {
      // ── Web Speech API ──
      if (engineKey === "webspeech") {
        var speechResult = await speakWebSpeech(TEST_ALT_TEXT);
        var duration = elapsed(start);
        var notes =
          "Alt text read aloud in " +
          (speechResult.durationMs / 1000).toFixed(1) +
          "s";
        var result = makeStepResult("pass", duration, notes, {
          audioDurationMs: speechResult.durationMs,
        });
        logInfo("RESULT: PASS — " + notes);
        return result;
      }

      // ── Neural engines ──
      var output = await synthesiseNeural(TEST_ALT_TEXT, engineKey);
      var genTimeMs = elapsed(start);

      if (!output.samples || output.samples.length === 0) {
        return makeStepResult(
          "fail",
          genTimeMs,
          "Alt text synthesis returned empty audio",
        );
      }

      var audioDuration = output.samples.length / output.sampleRate;
      var rtf = audioDuration / (genTimeMs / 1000);

      logInfo(
        "Generated " +
          audioDuration.toFixed(1) +
          "s audio in " +
          genTimeMs +
          "ms | RTF: " +
          rtf.toFixed(1) +
          "x",
      );
      logInfo("Playing audio...");
      await playAudio(output.samples, output.sampleRate);
      logInfo("Playback complete.");

      var notes =
        audioDuration.toFixed(1) +
        "s audio in " +
        (genTimeMs / 1000).toFixed(1) +
        "s gen, RTF " +
        rtf.toFixed(1) +
        "x";
      var result = makeStepResult("pass", genTimeMs, notes, {
        audioDurationSec: audioDuration,
        genTimeMs: genTimeMs,
        rtf: rtf,
        sampleCount: output.samples.length,
        sampleRate: output.sampleRate,
        textLength: TEST_ALT_TEXT.length,
        textWords: TEST_ALT_TEXT.split(/\s+/).length,
      });
      logInfo("RESULT: PASS — " + notes);
      return result;
    } catch (e) {
      var result = makeStepResult(
        "fail",
        elapsed(start),
        "Alt text benchmark failed: " + e.message,
      );
      logError("RESULT: FAIL — " + e.message);
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 6: voiceTest
  // ═══════════════════════════════════════════════════════════════════

  async function stepVoiceTest(engineKey) {
    logInfo("─── Step 6/8: voiceTest ───");
    var start = now();

    try {
      // ── Web Speech API ──
      if (engineKey === "webspeech") {
        var voices = await getVoices();
        if (voices.length === 0) {
          return makeStepResult("fail", elapsed(start), "No voices available");
        }

        // Find best local and best cloud voice
        var localVoices = voices.filter(function (v) {
          return v.localService;
        });
        var cloudVoices = voices.filter(function (v) {
          return !v.localService;
        });

        // Prefer English voices
        var enLocal = localVoices.filter(function (v) {
          return v.lang.startsWith("en");
        });
        var enCloud = cloudVoices.filter(function (v) {
          return v.lang.startsWith("en");
        });

        var testVoice1 = enLocal[0] || localVoices[0] || voices[0];
        var testVoice2 =
          enCloud[0] ||
          cloudVoices[0] ||
          (voices.length > 1 ? voices[1] : null);

        logInfo("Testing voice 1 (local): " + testVoice1.name);
        await speakWebSpeech("Now testing: " + testVoice1.name, testVoice1);
        await new Promise(function (r) { setTimeout(r, 400); });
        await speakWebSpeech(TEST_SHORT, testVoice1);

        if (testVoice2 && testVoice2 !== testVoice1) {
          // Brief pause between voices
          await new Promise(function (r) {
            setTimeout(r, 500);
          });
          logInfo("Testing voice 2 (cloud): " + testVoice2.name);
          await speakWebSpeech("Now testing: " + testVoice2.name, testVoice2);
          await new Promise(function (r) { setTimeout(r, 400); });
          await speakWebSpeech(TEST_SHORT, testVoice2);
        }

        var testedNames = [testVoice1.name];
        if (testVoice2 && testVoice2 !== testVoice1)
          testedNames.push(testVoice2.name);

        var notes =
          testedNames.length +
          " voices tested (" +
          testedNames.join(", ") +
          ")";
        var result = makeStepResult("pass", elapsed(start), notes, {
          voiceCount: voices.length,
          testedVoices: testedNames,
        });
        logInfo("RESULT: PASS — " + notes);
        return result;
      }

      // ── Neural engines ──
      var engineInfo = KNOWN_ENGINES[engineKey];
      var voiceList = engineInfo.voices || [];

      if (voiceList.length < 2) {
        var notes =
          "Engine has " +
          voiceList.length +
          " voice(s) — multi-voice test not applicable";
        logInfo(notes);

        // Still try to generate with default voice if available
        if (voiceList.length === 1) {
          try {
            var announceOnly = await synthesiseNeural(
              "Now testing: " + voiceList[0],
              engineKey,
              voiceList[0],
            );
            await playAudio(announceOnly.samples, announceOnly.sampleRate);
            await new Promise(function (r) { setTimeout(r, 400); });
            var output = await synthesiseNeural(
              TEST_SHORT,
              engineKey,
              voiceList[0],
            );
            logInfo(
              'Single voice "' +
                voiceList[0] +
                '" produced ' +
                output.samples.length +
                " samples",
            );
            await playAudio(output.samples, output.sampleRate);
          } catch (e) {
            logWarn("Single voice test failed: " + e.message);
          }
        }

        return makeStepResult("pass", elapsed(start), notes, {
          voiceCount: voiceList.length,
          testedVoices: voiceList.slice(0, 1),
        });
      }

      // Test two voices
      var voice1 = voiceList[0];
      var voice2 = voiceList.length > 3 ? voiceList[3] : voiceList[1]; // Pick a contrasting voice

      logInfo("Testing voice 1: " + voice1);
      var announceVoice1 = await synthesiseNeural("Now testing: " + voice1, engineKey, voice1);
      await playAudio(announceVoice1.samples, announceVoice1.sampleRate);
      await new Promise(function (r) { setTimeout(r, 400); });
      var output1 = await synthesiseNeural(TEST_SHORT, engineKey, voice1);
      logInfo("Voice 1 produced " + output1.samples.length + " samples");
      await playAudio(output1.samples, output1.sampleRate);

      // Brief pause between voices
      await new Promise(function (r) {
        setTimeout(r, 800);
      });

      logInfo("Testing voice 2: " + voice2);
      var announceVoice2 = await synthesiseNeural("Now testing: " + voice2, engineKey, voice2);
      await playAudio(announceVoice2.samples, announceVoice2.sampleRate);
      await new Promise(function (r) { setTimeout(r, 400); });
      var output2 = await synthesiseNeural(TEST_SHORT, engineKey, voice2);
      logInfo("Voice 2 produced " + output2.samples.length + " samples");
      await playAudio(output2.samples, output2.sampleRate);

      var notes = "2 voices tested (" + voice1 + ", " + voice2 + ")";
      var result = makeStepResult("pass", elapsed(start), notes, {
        voiceCount: voiceList.length,
        testedVoices: [voice1, voice2],
        voice1Samples: output1.samples.length,
        voice2Samples: output2.samples.length,
      });
      logInfo("RESULT: PASS — " + notes);
      return result;
    } catch (e) {
      var result = makeStepResult(
        "fail",
        elapsed(start),
        "Voice test failed: " + e.message,
      );
      logError("RESULT: FAIL — " + e.message);
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 7: longTextTest
  // ═══════════════════════════════════════════════════════════════════

  async function stepLongTextTest(engineKey) {
    logInfo("─── Step 7/8: longTextTest ───");
    var wordCount = TEST_LONG.split(/\s+/).length;
    logInfo("Text length: ~" + wordCount + " words");
    var start = now();

    try {
      // ── Web Speech API ──
      if (engineKey === "webspeech") {
        var speechResult = await speakWebSpeech(TEST_LONG);
        var duration = elapsed(start);

        // Check for suspiciously short playback (potential truncation)
        // Rough estimate: ~150 words at ~150 WPM = ~60 seconds minimum
        var expectedMinSeconds = wordCount / 200; // generous lower bound
        var actualSeconds = speechResult.durationMs / 1000;
        var possibleTruncation = actualSeconds < expectedMinSeconds;

        var notes =
          "Long text read in " +
          actualSeconds.toFixed(1) +
          "s (~" +
          wordCount +
          " words)";
        if (possibleTruncation) {
          notes += " — WARNING: suspiciously short, possible truncation";
          logWarn(
            "Possible truncation: expected >" +
              expectedMinSeconds.toFixed(0) +
              "s, got " +
              actualSeconds.toFixed(1) +
              "s",
          );
        }

        var result = makeStepResult(
          possibleTruncation ? "partial" : "pass",
          duration,
          notes,
          {
            audioDurationMs: speechResult.durationMs,
            wordCount: wordCount,
            possibleTruncation: possibleTruncation,
          },
        );
        logInfo("RESULT: " + result.status.toUpperCase() + " — " + notes);
        return result;
      }

      // ── Neural engines ──
      var output = await synthesiseNeural(TEST_LONG, engineKey);
      var genTimeMs = elapsed(start);

      if (!output.samples || output.samples.length === 0) {
        return makeStepResult(
          "fail",
          genTimeMs,
          "Long text synthesis returned empty audio",
        );
      }

      var audioDuration = output.samples.length / output.sampleRate;
      var rtf = audioDuration / (genTimeMs / 1000);

      // Check for truncation — expected at least ~30s of audio for ~150 words
      var expectedMinAudio = (wordCount / 200) * 0.5; // very conservative lower bound
      var possibleTruncation = audioDuration < expectedMinAudio;

      logInfo(
        "Generated " +
          audioDuration.toFixed(1) +
          "s audio in " +
          (genTimeMs / 1000).toFixed(1) +
          "s | RTF: " +
          rtf.toFixed(1) +
          "x",
      );

      // Play only first 5 seconds
      logInfo("Playing first 5 seconds...");
      var clipSamples = output.samples.slice(0, output.sampleRate * 5);
      await playAudio(clipSamples, output.sampleRate, 5);
      logInfo("Playback complete (5s clip).");

      var notes =
        audioDuration.toFixed(1) +
        "s audio from ~" +
        wordCount +
        " words, RTF " +
        rtf.toFixed(1) +
        "x";
      if (possibleTruncation) {
        notes += " — WARNING: possible truncation";
      }

      var result = makeStepResult(
        possibleTruncation ? "partial" : "pass",
        genTimeMs,
        notes,
        {
          audioDurationSec: audioDuration,
          genTimeMs: genTimeMs,
          rtf: rtf,
          wordCount: wordCount,
          possibleTruncation: possibleTruncation,
          sampleCount: output.samples.length,
        },
      );
      logInfo("RESULT: " + result.status.toUpperCase() + " — " + notes);
      return result;
    } catch (e) {
      var result = makeStepResult(
        "fail",
        elapsed(start),
        "Long text test failed: " + e.message,
      );
      logError("RESULT: FAIL — " + e.message);
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 8: cleanup
  // ═══════════════════════════════════════════════════════════════════

  async function stepCleanup(engineKey) {
    logInfo("─── Step 8/8: cleanup ───");
    var start = now();

    try {
      var heapBefore = null;
      var heapAfter = null;

      if (performance.memory) {
        heapBefore = Math.round(
          performance.memory.usedJSHeapSize / (1024 * 1024),
        );
      }

      // ── Web Speech API ──
      if (engineKey === "webspeech") {
        speechSynthesis.cancel();
        stopAudio();

        if (performance.memory) {
          heapAfter = Math.round(
            performance.memory.usedJSHeapSize / (1024 * 1024),
          );
        }

        var notes = "speechSynthesis.cancel() called";
        if (heapBefore !== null && heapAfter !== null) {
          notes += " | Heap: " + heapBefore + "MB → " + heapAfter + "MB";
        }

        var result = makeStepResult("pass", elapsed(start), notes, {
          heapBeforeMB: heapBefore,
          heapAfterMB: heapAfter,
        });
        logInfo("RESULT: PASS — " + notes);
        return result;
      }

      // ── Neural engines ──
      // Dispose model/pipeline
      if (loadedPipeline) {
        try {
          if (typeof loadedPipeline.dispose === "function") {
            await loadedPipeline.dispose();
            logInfo("Pipeline disposed");
          }
        } catch (e) {
          logWarn("Pipeline dispose failed: " + e.message);
        }
        loadedPipeline = null;
      }

      if (loadedModel) {
        try {
          if (typeof loadedModel.dispose === "function") {
            await loadedModel.dispose();
            logInfo("Model disposed");
          }
        } catch (e) {
          logWarn("Model dispose failed: " + e.message);
        }
        loadedModel = null;
      }

      stopAudio();
      kokoroJsModule = null;

      if (performance.memory) {
        heapAfter = Math.round(
          performance.memory.usedJSHeapSize / (1024 * 1024),
        );
      }

      var notes = "Model and pipeline disposed";
      if (heapBefore !== null && heapAfter !== null) {
        notes += " | Heap: " + heapBefore + "MB → " + heapAfter + "MB";
      }

      var result = makeStepResult("pass", elapsed(start), notes, {
        heapBeforeMB: heapBefore,
        heapAfterMB: heapAfter,
      });
      logInfo("RESULT: PASS — " + notes);
      return result;
    } catch (e) {
      var result = makeStepResult(
        "fail",
        elapsed(start),
        "Cleanup failed: " + e.message,
      );
      logError("RESULT: FAIL — " + e.message);
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Evaluate orchestrator
  // ═══════════════════════════════════════════════════════════════════

  async function evaluate(config) {
    if (!config || !config.engine) {
      logError(
        "evaluate() requires { engine } at minimum. Call listEngines() to see options.",
      );
      return null;
    }

    var engineKey = config.engine;
    if (!KNOWN_ENGINES[engineKey]) {
      logError(
        'Unknown engine: "' +
          engineKey +
          '". Known engines: ' +
          Object.keys(KNOWN_ENGINES).join(", "),
      );
      return null;
    }

    var engineInfo = KNOWN_ENGINES[engineKey];
    currentEngineKey = engineKey;

    logInfo("╔══════════════════════════════════════════════════════════╗");
    logInfo("║  TTS SPIKE EVALUATION                                    ║");
    logInfo("║  Engine: " + engineInfo.name);
    if (engineInfo.modelId) {
      logInfo("║  Model: " + engineInfo.modelId);
    }
    logInfo(
      "║  Architecture: " +
        engineInfo.architecture +
        (engineInfo.sizeMB ? " | Size: ~" + engineInfo.sizeMB + "MB" : ""),
    );
    logInfo("╚══════════════════════════════════════════════════════════╝");

    results = createFreshResults(engineKey);

    // Hardware detection
    var hw = await detectHardware();
    results.machine.gpu = hw.gpuDescription || hw.gpuVendor || "";
    results.machine.webgpu = hw.webgpu;

    // Step 1: webgpuCheck
    results.steps.webgpuCheck = await stepWebgpuCheck();

    // Step 2: libraryLoad (critical)
    results.steps.libraryLoad = await stepLibraryLoad(engineKey);
    if (results.steps.libraryLoad.status === "fail") {
      logError(
        "Critical failure: library/API not available. Skipping remaining steps.",
      );
      markRemainingSkipped(results.steps, "libraryLoad");
      finaliseResults();
      return results;
    }

    // Step 3: modelLoad (critical)
    results.steps.modelLoad = await stepModelLoad(engineKey);
    if (results.steps.modelLoad.status === "fail") {
      logError(
        "Critical failure: model failed to load. Skipping remaining steps.",
      );
      markRemainingSkipped(results.steps, "modelLoad");
      finaliseResults();
      return results;
    }

    // Step 4: basicSynthesis
    results.steps.basicSynthesis = await stepBasicSynthesis(engineKey);

    // Step 5: altTextBenchmark
    results.steps.altTextBenchmark = await stepAltTextBenchmark(engineKey);

    // Step 6: voiceTest
    results.steps.voiceTest = await stepVoiceTest(engineKey);

    // Step 7: longTextTest
    results.steps.longTextTest = await stepLongTextTest(engineKey);

    // Step 8: cleanup
    results.steps.cleanup = await stepCleanup(engineKey);

    finaliseResults();
    return results;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Results display
  // ═══════════════════════════════════════════════════════════════════

  function printSummary() {
    if (!results) {
      logWarn("No results available. Run evaluate() first.");
      return;
    }

    var engineInfo = results.engineInfo || {};

    // Header box
    console.log(
      "%c" +
        "╔══════════════════════════════════════════════════════════╗\n" +
        "║  TTS SPIKE RESULTS                                       ║\n" +
        "║  Engine: " +
        (engineInfo.name || results.engine).padEnd(46) +
        "║\n" +
        "║  Model: " +
        (engineInfo.modelId || "N/A").padEnd(47) +
        "║\n" +
        "╚══════════════════════════════════════════════════════════╝",
      "color: #2196F3; font-weight: bold; font-size: 11px;",
    );

    // Build table data
    var tableData = {};
    var stepNames = Object.keys(results.steps);
    for (var i = 0; i < stepNames.length; i++) {
      var name = stepNames[i];
      var step = results.steps[name];
      if (step) {
        tableData[name] = {
          Status: step.status.toUpperCase(),
          "Duration (ms)": step.duration,
          Notes: (step.notes || "").substring(0, 80),
        };
      }
    }
    console.table(tableData);

    // Footer
    console.log(
      "%cOverall: " + results.summary,
      "color: " +
        (results.overallStatus === "pass"
          ? "#4CAF50"
          : results.overallStatus === "partial"
            ? "#FF9800"
            : "#F44336") +
        "; font-weight: bold; font-size: 12px;",
    );

    // Hardware info
    if (results.machine) {
      console.log(
        "%cHardware: " +
          (results.machine.gpu || "unknown") +
          " | WebGPU: " +
          (results.machine.webgpu ? "YES" : "NO"),
        "color: #9E9E9E; font-size: 10px;",
      );
    }
  }

  function exportJSON() {
    if (!results) {
      logWarn("No results available. Run evaluate() first.");
      return null;
    }

    var json = JSON.stringify(results, null, 2);
    logInfo("Results JSON (" + json.length + " chars):");
    console.log(json);
    return json;
  }

  function getResults() {
    return results;
  }

  function listEngines() {
    var tableData = {};
    for (var key in KNOWN_ENGINES) {
      var eng = KNOWN_ENGINES[key];
      tableData[key] = {
        Name: eng.name,
        Params: eng.params,
        "Size (MB)": eng.sizeMB,
        "Sample Rate": eng.sampleRate || "Varies",
        Voices: Array.isArray(eng.voices) ? eng.voices.length : "?",
        Architecture: eng.architecture,
      };
    }
    console.table(tableData);
    logInfo('Use: TTSSpike.evaluate({ engine: "kokoro" })');
    logInfo("Available engines: " + Object.keys(KNOWN_ENGINES).join(", "));
    return KNOWN_ENGINES;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════

  window.TTSSpike = {
    evaluate: evaluate,
    getResults: getResults,
    printSummary: printSummary,
    exportJSON: exportJSON,
    listEngines: listEngines,
    stopAudio: stopAudio,
  };

  logInfo(
    "TTS Spike Harness v1.0 loaded. " +
      Object.keys(KNOWN_ENGINES).length +
      " engines available. Call TTSSpike.listEngines() for details.",
  );
})();
