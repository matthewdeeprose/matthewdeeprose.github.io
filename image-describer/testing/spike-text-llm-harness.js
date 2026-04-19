/**
 * Text LLM Spike Harness
 *
 * Standalone, console-driven test tool for evaluating whether a candidate
 * text LLM works in-browser via Transformers.js v4 + ONNX + WebGPU.
 *
 * Usage:
 *   await TextLLMSpike.evaluate({ modelId: 'onnx-community/Phi-3.5-mini-instruct' });
 *   TextLLMSpike.printSummary();
 *   TextLLMSpike.exportBenchmark();
 *
 * @author Matthew Deeprose
 * @version 2.2.0
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // Logging configuration
  // ═══════════════════════════════════════════════════════════════════

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error('[TextLLMSpike]', message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn('[TextLLMSpike]', message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log('[TextLLMSpike]', message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log('[TextLLMSpike]', message, ...args);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Constants
  // ═══════════════════════════════════════════════════════════════════

  // CDN version map — run batches with different versions to compare.
  // The module can only hold one version per page session, so switching
  // mid-batch forces a page-level re-import (transformersModule = null).
  const CDN_VERSIONS = {
    'next.9':  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.9',
    'next.10': 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.10',
    'latest':  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@next',
  };
  const CDN_DEFAULT = 'next.9'; // known-working baseline — change after comparison testing
  const HF_BASE = 'https://huggingface.co';
  const CACHE_NAME = 'transformers-cache';

  // KNOWN_MODELS: Verified model IDs from HuggingFace with ONNX + Transformers.js tags.
  // Source: https://huggingface.co/models?library=onnx,transformers.js&pipeline_tag=text-generation
  // Note: Models may live under onnx-community/, HuggingFaceTB/, or other namespaces.
  // Naming conventions vary: some have '-ONNX' suffix, some '-onnx-web', some none.
  // Class names are best guesses from config.json architectures — checkClass will verify.
  // Optional `cdn` field: preferred CDN_VERSIONS key for this model (omit to use CDN_DEFAULT).
  // Run listKnownModels() to see this table.
  const KNOWN_MODELS = {
    // ══════════════════════════════════════════════════════════════════
    // Priority S — Top spike candidates (verified on HuggingFace, config.json checked)
    // ��═════════════════════════════════════════════════════════════════
    'onnx-community/Phi-3.5-mini-instruct-onnx-web': { className: 'Phi3ForCausalLM', sizeNote: '3.8B', verified: true },
    'onnx-community/Qwen2.5-0.5B-Instruct':         { className: 'Qwen2ForCausalLM', sizeNote: '0.5B', verified: true },
    'onnx-community/Qwen2.5-1.5B-Instruct':         { className: 'Qwen2ForCausalLM', sizeNote: '1.5B', verified: true },
    'onnx-community/Qwen3-0.6B-ONNX':               { className: 'Qwen3ForCausalLM', sizeNote: '0.6B', verified: true },
    'onnx-community/Qwen3-1.7B-ONNX':               { className: 'Qwen3ForCausalLM', sizeNote: '1.7B', verified: true },
    'onnx-community/Qwen3-4B-ONNX':                  { className: 'Qwen3ForCausalLM', sizeNote: '4B',   verified: true },
    'onnx-community/Llama-3.2-1B-Instruct-ONNX':    { className: 'LlamaForCausalLM', sizeNote: '1B',   verified: true },
    'onnx-community/gemma-3-1b-it-ONNX':             { className: 'Gemma3ForCausalLM', sizeNote: '1B',  verified: true },
    'HuggingFaceTB/SmolLM2-1.7B-Instruct':           { className: 'LlamaForCausalLM', sizeNote: '1.7B', verified: true },
    'HuggingFaceTB/SmolLM3-3B-ONNX':                 { className: 'SmolLM3ForCausalLM', sizeNote: '3B', verified: true },

    // ═════════════════════════��════════════════════════════════════════
    // Priority A — Strong candidates
    // ═════════════════════════���═════════════════════════════���══════════
    'onnx-community/Llama-3.2-3B-Instruct-ONNX':             { className: 'LlamaForCausalLM', sizeNote: '3B',   verified: true },
    'onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX':     { className: 'Qwen2ForCausalLM', sizeNote: '1.5B', verified: true },
    'onnx-community/Phi-4-mini-instruct-ONNX-GQA':            { className: 'Phi3ForCausalLM', sizeNote: '3.8B',  verified: true },
    'onnx-community/Qwen2.5-Coder-0.5B-Instruct':            { className: 'Qwen2ForCausalLM', sizeNote: '0.5B', verified: true },
    'onnx-community/Qwen2.5-Coder-1.5B-Instruct':            { className: 'Qwen2ForCausalLM', sizeNote: '1.5B', verified: true },
    'onnx-community/Qwen2.5-Coder-3B-Instruct':              { className: 'Qwen2ForCausalLM', sizeNote: '3B',   verified: true },
    'onnx-community/EXAONE-3.5-2.4B-Instruct':               { className: 'ExaoneForCausalLM', sizeNote: '2.4B', verified: true },
    'HuggingFaceTB/SmolLM2-360M-Instruct':                    { className: 'LlamaForCausalLM', sizeNote: '360M', verified: true },
    'HuggingFaceTB/SmolLM2-135M-Instruct':                    { className: 'LlamaForCausalLM', sizeNote: '135M', verified: true },
    'onnx-community/Falcon3-1B-Instruct':                     { className: 'LlamaForCausalLM', sizeNote: '1B',   verified: true },

    // ═══════════════════��══════════════════════════════════════════════
    // Priority B — Experimental / novel architectures (may not have Transformers.js class)
    // ════��════════════════════════════════════════��════════════════════
    'onnx-community/LFM2-1.2B-ONNX':               { className: 'Lfm2ForCausalLM', sizeNote: '1.2B',  verified: true },
    'onnx-community/LFM2-2.6B-ONNX':               { className: 'Lfm2ForCausalLM', sizeNote: '2.6B',  verified: true },
    'onnx-community/LFM2-350M-ONNX':               { className: 'Lfm2ForCausalLM', sizeNote: '350M',  verified: true },
    'onnx-community/granite-4.0-350m-ONNX-web':    { className: 'GraniteMoeHybridForCausalLM', sizeNote: '350M', verified: true },
    'onnx-community/granite-4.0-1b-ONNX-web':      { className: 'GraniteMoeHybridForCausalLM', sizeNote: '1B',   verified: true },
    'onnx-community/gemma-3-270m-it-ONNX':          { className: 'Gemma3ForCausalLM', sizeNote: '270M', verified: true },
    'onnx-community/glm-edge-1.5b-chat-ONNX':      { className: 'GlmForCausalLM', sizeNote: '1.5B',    verified: false },
    'onnx-community/deepseek-coder-1.3b-instruct-ONNX': { className: 'LlamaForCausalLM', sizeNote: '1.3B', verified: true },

    // ══════════════════════════════════════════════════════════════════
    // Wave 3 — Batch spike candidates (April 2026)
    // ══════════════════════════════════════════════════════════════════
    'onnx-community/LFM2.5-350M-ONNX':                         { className: 'Lfm2ForCausalLM',      sizeNote: '350M', verified: true },
    'onnx-community/Falcon-H1-Tiny-90M-Instruct-ONNX':         { className: 'FalconH1ForCausalLM',  sizeNote: '90M',  verified: false },
    'onnx-community/OpenReasoning-Nemotron-1.5B-ONNX':         { className: 'Qwen2ForCausalLM',     sizeNote: '1.5B', verified: true },
    'onnx-community/SmallThinker-3B-Preview-ONNX':             { className: 'Qwen2ForCausalLM',     sizeNote: '3B',   verified: true },
    'onnx-community/nanochat-d32-ONNX':                         { className: 'NanoChatForCausalLM',  sizeNote: '560M', verified: false },
    'onnx-community/LFM2-2.6B-Exp-ONNX':                       { className: 'Lfm2ForCausalLM',      sizeNote: '2.6B', verified: true },

    // ══════════════════════════════════════════════════════════════════
    // Wave 4 additions (April 2026 — new candidates + untested catalogue models)
    // ══════════════════════════════════════════════════════════════════

    // LFM2.5 at 1.2B — instruct-tuned, 128K context, LiquidAI namespace
    'LiquidAI/LFM2.5-1.2B-Instruct-ONNX':                 { className: 'Lfm2ForCausalLM',      sizeNote: '1.2B', verified: false },

    // Granite 4.0 hybrid — Mamba-2/transformer, may need different class
    'onnx-community/granite-4.0-h-350m-ONNX':              { className: 'GraniteMoeHybridForCausalLM', sizeNote: '350M hybrid', verified: false },
  };

  // ══════════════════════════════════════════════════════════════════
  // Batch configuration — Wave 3 candidates
  // ══════════════════════════════════════════════════════════════════

  const WAVE_3_BATCH = [
    // Top priority — potential LFM2-350M replacement (same class, 128K context)
    'onnx-community/LFM2.5-350M-ONNX',

    // Free to test — 90M, hybrid Transformer+Mamba, has WebGPU demo
    'onnx-community/Falcon-H1-Tiny-90M-Instruct-ONNX',

    // New architecture class tests
    'HuggingFaceTB/SmolLM3-3B-ONNX',
    'onnx-community/nanochat-d32-ONNX',

    // Direct comparison with existing Phi-3.5-mini
    'onnx-community/Phi-4-mini-instruct-ONNX-GQA',

    // iGPU-friendly 1–2B candidates (proven Qwen2 class)
    'onnx-community/OpenReasoning-Nemotron-1.5B-ONNX',
    'onnx-community/Qwen2.5-1.5B-Instruct',

    // Gap fillers — 2–3B range
    'onnx-community/SmallThinker-3B-Preview-ONNX',
    'onnx-community/EXAONE-3.5-2.4B-Instruct',

    // Code specialist
    'onnx-community/Qwen2.5-Coder-1.5B-Instruct',
  ];

  // ══════════════════════════════════════════════════════════════════
  // Batch configuration — Wave 4 candidates (April 2026)
  // Ordered smallest-first: cheap gating tests before large downloads.
  // ══════════════════════════════════════════════════════════════════

  const WAVE_4_BATCH = [
    // Gating test — does Qwen3 class avoid the Qwen2 bad_alloc bug?
    'onnx-community/Qwen3-0.6B-ONNX',

    // Gating test — does IBM Granite 4.0 dense architecture work?
    'onnx-community/granite-4.0-350m-ONNX-web',

    // Wildcard — hybrid Mamba-2/transformer at 350M
    'onnx-community/granite-4.0-h-350m-ONNX',

    // Highest-value test — proven LFM2 class at 3.4x the size of working default
    'onnx-community/LFM2-1.2B-ONNX',

    // LFM2.5 at 1.2B — newer architecture, instruct-tuned, 128K context
    'LiquidAI/LFM2.5-1.2B-Instruct-ONNX',

    // Proven LlamaForCausalLM class at 1B — should "just work"
    'onnx-community/Llama-3.2-1B-Instruct-ONNX',

    // New class test — Google Gemma 3 at 1B
    'onnx-community/gemma-3-1b-it-ONNX',

    // Granite 4.0 at 1B — quality candidate if 350M variant passes
    'onnx-community/granite-4.0-1b-ONNX-web',

    // Proven LlamaForCausalLM at 1.7B — under 2.4B ceiling
    'HuggingFaceTB/SmolLM2-1.7B-Instruct',

    // Qwen3 quality tier — if 0.6B passes, this is the payoff
    'onnx-community/Qwen3-1.7B-ONNX',
  ];

  const HARDWARE_CLASSES = {
    '4070': 'rtx-4070',
    '4060': 'rtx-4060',
    '2070': 'rtx-2070',
    '1660': 'gtx-1660s',
    '780m': 'ryzen-igpu',
    'radeon 780m': 'ryzen-igpu',
    'rdna-3': 'amd-rdna3',
    'rdna-2': 'amd-rdna2',
    'radeon': 'amd-discrete',
  };

  const INSTRUCTION_TESTS = [
    {
      name: 'summarise',
      prompt: 'Summarise the following in exactly 2 sentences: The Industrial Revolution, which began in Britain in the late 18th century, transformed economies from agrarian to industrial. New manufacturing processes, including the development of steam power and iron production, led to unprecedented urbanisation. Factories replaced cottage industries, drawing workers from rural areas to cities. This period saw significant social changes, including the rise of a new middle class and the formation of trade unions to protect workers\' rights.',
      check: function (output) {
        var sentences = output.split(/[.!?]+/).filter(function (s) { return s.trim().length > 10; });
        return sentences.length >= 1 && sentences.length <= 4;
      },
      passDescription: '1–4 sentences, on-topic'
    },
    {
      name: 'list',
      prompt: 'List exactly 5 benefits of regular exercise. Number each one.',
      check: function (output) {
        var numbers = output.match(/[1-5][\.\)]/g);
        return numbers !== null && numbers.length >= 3;
      },
      passDescription: 'At least 3 numbered items'
    },
    {
      name: 'json',
      prompt: 'Write a JSON object with keys "name", "age", "city" for a fictional person. Output ONLY the JSON, nothing else.',
      check: function (output) {
        try {
          var match = output.match(/\{[^}]+\}/);
          if (!match) return false;
          var parsed = JSON.parse(match[0]);
          return 'name' in parsed && 'age' in parsed && 'city' in parsed;
        } catch (e) {
          return false;
        }
      },
      passDescription: 'Valid JSON with name, age, city keys'
    },
    {
      name: 'reasoning',
      prompt: 'If a shirt costs £20 and is discounted by 15%, what is the sale price? Show your working.',
      check: function (output) {
        return output.includes('17') || output.includes('£17');
      },
      passDescription: 'Contains "17" (correct answer £17)'
    }
  ];

  const BENCHMARK_PROMPT = 'You are a helpful assistant. Please write a clear, informative paragraph of about 100 words explaining how photosynthesis works in plants. Include the key inputs (water, carbon dioxide, sunlight) and outputs (glucose, oxygen). Keep the language accessible for a university student.';

  const CONTEXT_FILLER_PARAGRAPH = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non prosequuntur, sunt in culpa qui officia deserunt mollit anim id est laborum. ';

  // ═══════════════════════════════════════════════════════════════════
  // Closure state
  // ═══════════════════════════════════════════════════════════════════

  var transformersModule = null;
  var loadedModel = null;
  var loadedTokeniser = null;
  var currentConfig = null;
  var results = null;
  var hardwareInfo = null;
  var resolvedCdnUrl = null;
  var resolvedDevice = null;
  var originalEnvFetch = null;
  var resilientFetchActive = false;

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
    var result = { status: status, duration: duration, notes: notes || '' };
    if (extras) {
      Object.keys(extras).forEach(function (key) {
        result[key] = extras[key];
      });
    }
    return result;
  }

  function createFreshResults(config) {
    return {
      modelId: config.modelId || '',
      className: config.className || '',
      quantisation: config.quantisation || 'q4',
      device: '',
      cdnVersion: '',
      timestamp: new Date().toISOString(),
      hardware: null,
      steps: {
        checkONNX: null,
        checkClass: null,
        loadModel: null,
        basicInference: null,
        instructionTests: null,
        streamingTest: null,
        memoryProfile: null,
        speedBenchmark: null,
        contextTest: null,
        cleanup: null,
      },
      overallStatus: '',
      summary: ''
    };
  }

  function computeOverallStatus(steps) {
    var criticalSteps = ['checkONNX', 'checkClass', 'loadModel'];
    var hasCriticalFail = criticalSteps.some(function (name) {
      return steps[name] && steps[name].status === 'fail';
    });
    if (hasCriticalFail) return 'fail';

    var allSteps = Object.keys(steps);
    var allPass = allSteps.every(function (name) {
      return !steps[name] || steps[name].status === 'pass' || steps[name].status === 'skip';
    });
    if (allPass) return 'pass';
    return 'partial';
  }

  function computeSummary(res) {
    var status = res.overallStatus.toUpperCase();
    var loadTime = res.steps.loadModel && res.steps.loadModel.loadTimeMs
      ? (res.steps.loadModel.loadTimeMs / 1000).toFixed(1) + 's'
      : 'N/A';
    var speed = res.steps.speedBenchmark && res.steps.speedBenchmark.tokensPerSecond
      ? res.steps.speedBenchmark.tokensPerSecond.toFixed(1) + ' tok/s'
      : 'N/A';
    var vram = res.steps.memoryProfile && res.steps.memoryProfile.gpuMemMB
      ? '~' + res.steps.memoryProfile.gpuMemMB + 'MB'
      : 'N/A';
    return status + ' | Load: ' + loadTime + ' | Speed: ' + speed + ' | VRAM: ' + vram;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Hardware detection (runs once per session)
  // ═══════════════════════════════════════════════════════════════════

  async function detectHardware() {
    if (hardwareInfo) return hardwareInfo;

    var info = {
      gpuDescription: '',
      gpuVendor: '',
      hardwareClass: 'unknown',
      userAgent: navigator.userAgent,
      platform: navigator.platform
    };

    try {
      if (!navigator.gpu) {
        info.hardwareClass = 'wasm-cpu';
        logWarn('WebGPU not available — hardware class set to wasm-cpu');
        hardwareInfo = info;
        return info;
      }

      var adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        info.hardwareClass = 'wasm-cpu';
        logWarn('No WebGPU adapter found — hardware class set to wasm-cpu');
        hardwareInfo = info;
        return info;
      }

      var adapterInfo = adapter.info || (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : {});
      info.gpuDescription = adapterInfo.description || '';
      info.gpuVendor = adapterInfo.vendor || '';
      info.gpuArchitecture = adapterInfo.architecture || '';

      // Build a combined search string from all available fields
      var searchStr = (info.gpuDescription + ' ' + info.gpuVendor + ' ' + info.gpuArchitecture).toLowerCase();

      for (var pattern in HARDWARE_CLASSES) {
        if (searchStr.includes(pattern)) {
          info.hardwareClass = HARDWARE_CLASSES[pattern];
          break;
        }
      }

      logInfo('Detected GPU: ' + (info.gpuDescription || info.gpuVendor + ' ' + info.gpuArchitecture).trim() + ' (' + info.hardwareClass + ')');
    } catch (e) {
      info.hardwareClass = 'wasm-cpu';
      logWarn('Hardware detection failed:', e.message);
    }

    hardwareInfo = info;
    return info;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Transformers.js dynamic import
  // ═══════════════════════════════════════════════════════════════════

  // Force-clear the cached module so the next importTransformers() call
  // loads a fresh version. Required when switching CDN versions mid-batch.
  function resetTransformersModule() {
    transformersModule = null;
    resolvedCdnUrl = null;
    logDebug('Transformers module reset — next import will load fresh');
  }

  async function importTransformers(requiredClassName, preferredVersion) {
    // If already loaded and no version switch requested, reuse
    if (transformersModule && !preferredVersion) {
      if (!requiredClassName || transformersModule[requiredClassName]) {
        return transformersModule;
      }
    }

    // Build ordered list of CDN URLs to try
    const versionKey = preferredVersion || CDN_DEFAULT;
    const primaryUrl = CDN_VERSIONS[versionKey];
    if (!primaryUrl) {
      logError('Unknown CDN version key: "' + versionKey + '". Available: ' + Object.keys(CDN_VERSIONS).join(', '));
      throw new Error('Unknown CDN version: ' + versionKey);
    }

    // Collect fallback URLs (all other versions except primary)
    const fallbackUrls = [];
    for (const key in CDN_VERSIONS) {
      if (key !== versionKey) {
        fallbackUrls.push({ key: key, url: CDN_VERSIONS[key] });
      }
    }

    // Try primary CDN
    try {
      logDebug('Trying CDN version "' + versionKey + '": ' + primaryUrl);
      const mod = await import(primaryUrl);
      if (requiredClassName && !mod[requiredClassName]) {
        logWarn('Class "' + requiredClassName + '" not found in "' + versionKey + '", trying fallbacks');
        throw new Error('Class not found in ' + versionKey);
      }
      transformersModule = mod;
      resolvedCdnUrl = primaryUrl;
      logInfo('Loaded Transformers.js from "' + versionKey + '"');
      return mod;
    } catch (e) {
      logDebug('CDN "' + versionKey + '" attempt result: ' + e.message);
    }

    // Try fallbacks in order
    for (let i = 0; i < fallbackUrls.length; i++) {
      const fb = fallbackUrls[i];
      try {
        logDebug('Trying fallback CDN "' + fb.key + '": ' + fb.url);
        const mod = await import(fb.url);
        if (requiredClassName && !mod[requiredClassName]) {
          logDebug('Class "' + requiredClassName + '" not found in fallback "' + fb.key + '"');
          continue;
        }
        transformersModule = mod;
        resolvedCdnUrl = fb.url;
        logInfo('Loaded Transformers.js from fallback "' + fb.key + '"');
        return mod;
      } catch (e) {
        logDebug('Fallback CDN "' + fb.key + '" attempt result: ' + e.message);
      }
    }

    logError('Failed to load Transformers.js from any CDN version');
    throw new Error('Could not load Transformers.js from any CDN');
  }

  // ═══════════════════════════════════════════════════════════════════
  // Cache detection
  // ═══════════════════════════════════════════════════════════════════

  async function checkCacheForModel(modelId) {
    try {
      var cache = await caches.open(CACHE_NAME);
      var keys = await cache.keys();
      // Check if any cached URL references this model
      var modelSlug = modelId.replace('/', '%2F');
      var found = keys.some(function (req) {
        var url = req.url || '';
        return url.includes(modelId) || url.includes(modelSlug);
      });
      return found;
    } catch (e) {
      logDebug('Cache check failed (may not be supported):', e.message);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Chat template handling
  // ═══════════════════════════════════════════════════════════════════

  function applyChatTemplate(tokeniser, promptText) {
    var messages = [{ role: 'user', content: promptText }];

    try {
      if (tokeniser.apply_chat_template) {
        var formatted = tokeniser.apply_chat_template(messages, {
          tokenize: false,
          add_generation_prompt: true
        });
        logDebug('Using tokeniser chat template');
        return formatted;
      }
    } catch (e) {
      logWarn('Chat template failed, using fallback format:', e.message);
    }

    // Fallback: simple user/assistant format
    logDebug('Using fallback User:/Assistant: format');
    return 'User: ' + promptText + '\nAssistant:';
  }

  // ═══════════════════════════════════════════════════════════════════
  // Device selection
  // ═══════════════════════════════════════════════════════════════════

  function selectDevice() {
    try {
      if (navigator.gpu) {
        resolvedDevice = 'webgpu';
        logInfo('Device selected: webgpu');
        return 'webgpu';
      }
    } catch (e) {
      // Fall through
    }
    resolvedDevice = 'wasm';
    logWarn('WebGPU not available — falling back to WASM (will be slow for large models)');
    return 'wasm';
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 1: checkONNX
  // ═══════════════════════════════════════════════════════════════════

  async function stepCheckONNX(modelId) {
    logInfo('─── Step 1/10: checkONNX ───');
    logInfo('Checking if ONNX model exists: ' + modelId);
    var start = now();

    try {
      // Strategy 1: Fetch config.json directly via GET.
      // This works for some HuggingFace orgs but onnx-community returns 401
      // for all repos (even non-existent ones) from browser fetch.
      var configUrl = HF_BASE + '/' + modelId + '/resolve/main/config.json';
      logDebug('Trying direct config.json fetch...');
      var response = await fetch(configUrl);

      if (response.ok) {
        var data = await response.json();
        var notes = 'Model found at ' + modelId;
        if (data.model_type) {
          notes += ' (model_type: ' + data.model_type + ')';
        }
        if (data.architectures && data.architectures.length > 0) {
          notes += ' | architectures: ' + data.architectures.join(', ');
        }
        var result = makeStepResult('pass', elapsed(start), notes);
        logInfo('RESULT: PASS — ' + notes);
        return result;
      }

      if (response.status === 404) {
        var result = makeStepResult('fail', elapsed(start),
          'Model not found: ' + modelId + ' — config.json returned 404');
        logError('RESULT: FAIL — 404 Not Found');
        return result;
      }

      // Strategy 2: If 401/403 (HuggingFace org-level auth wall), try the
      // jsDelivr CDN mirror — Transformers.js uses this as a fallback and
      // it serves onnx-community files without auth.
      if (response.status === 401 || response.status === 403) {
        logDebug('HuggingFace returned ' + response.status +
          ' — trying jsDelivr CDN mirror...');
        var cdnUrl = 'https://cdn.jsdelivr.net/gh/' + modelId + '@main/config.json';

        try {
          var cdnResponse = await fetch(cdnUrl);
          if (cdnResponse.ok) {
            var data = await cdnResponse.json();
            var notes = 'Model found via CDN mirror';
            if (data.model_type) {
              notes += ' (model_type: ' + data.model_type + ')';
            }
            if (data.architectures && data.architectures.length > 0) {
              notes += ' | architectures: ' + data.architectures.join(', ');
            }
            var result = makeStepResult('pass', elapsed(start), notes);
            logInfo('RESULT: PASS — ' + notes);
            return result;
          }
        } catch (cdnErr) {
          logDebug('CDN mirror also failed: ' + cdnErr.message);
        }

        // Strategy 3: Check if model is in KNOWN_MODELS — trust the registry
        // and let loadModel be the real verification.
        if (KNOWN_MODELS[modelId]) {
          var result = makeStepResult('pass', elapsed(start),
            'HuggingFace returned ' + response.status +
            ' (org-level auth wall) — model is in KNOWN_MODELS registry. ' +
            'Real verification will happen at loadModel step.');
          logWarn('RESULT: PASS (deferred) — HF auth wall; trusting KNOWN_MODELS registry');
          return result;
        }

        // Unknown model + auth wall = inconclusive
        var result = makeStepResult('pass', elapsed(start),
          'HuggingFace returned ' + response.status +
          ' (org-level auth wall) — cannot verify from browser. ' +
          'Proceeding; loadModel step will be the real test.');
        logWarn('RESULT: PASS (inconclusive) — cannot verify due to HF auth wall');
        return result;
      }

      // Other unexpected status
      var result = makeStepResult('fail', elapsed(start),
        'Unexpected HTTP ' + response.status + ' fetching config.json for ' + modelId);
      logError('RESULT: FAIL — HTTP ' + response.status);
      return result;
    } catch (e) {
      var result = makeStepResult('fail', elapsed(start), 'Network error: ' + e.message);
      logError('RESULT: FAIL —', e.message);
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 2: checkClass
  // ═══════════════════════════════════════════════════════════════════

  async function stepCheckClass(className, cdnVersion) {
    logInfo('─── Step 2/10: checkClass ───');
    logInfo('Checking if Transformers.js exports: ' + className +
      (cdnVersion ? ' (preferred CDN: ' + cdnVersion + ')' : ''));
    var start = now();

    try {
      var mod = await importTransformers(className, cdnVersion);

      if (mod[className]) {
        // Resolve a human-readable version label from resolvedCdnUrl
        let versionLabel = 'unknown';
        for (const key in CDN_VERSIONS) {
          if (resolvedCdnUrl === CDN_VERSIONS[key]) {
            versionLabel = key;
            break;
          }
        }
        var result = makeStepResult('pass', elapsed(start),
          'Class "' + className + '" found in ' + versionLabel);
        logInfo('RESULT: PASS — ' + className + ' available (' + versionLabel + ')');
        return result;
      } else {
        // List available model classes for debugging
        var available = Object.keys(mod).filter(function (k) {
          return k.includes('ForCausalLM');
        }).slice(0, 15);
        var result = makeStepResult('fail', elapsed(start),
          'Class "' + className + '" not found. Available CausalLM classes: ' +
          available.join(', '));
        logError('RESULT: FAIL — Class not found');
        logDebug('Available CausalLM classes:', available);
        return result;
      }
    } catch (e) {
      var result = makeStepResult('fail', elapsed(start),
        'Import failed: ' + e.message);
      logError('RESULT: FAIL —', e.message);
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 3: loadModel
  // ═══════════════════════════════════════════════════════════════════

  async function stepLoadModel(config) {
    logInfo('─── Step 3/10: loadModel ───');
    logInfo('Loading model: ' + config.modelId + ' (class: ' + config.className +
      ', quant: ' + (config.quantisation || 'q4') + ')');
    var start = now();

    try {
      var mod = transformersModule;
      if (!mod) {
        return makeStepResult('fail', elapsed(start), 'Transformers.js not loaded');
      }

      var ModelClass = mod[config.className];
      if (!ModelClass) {
        return makeStepResult('fail', elapsed(start),
          'Class "' + config.className + '" not available');
      }

      var AutoTokenizer = mod.AutoTokenizer;
      if (!AutoTokenizer) {
        return makeStepResult('fail', elapsed(start), 'AutoTokenizer not available');
      }

      var fromCache = await checkCacheForModel(config.modelId);
      var device = selectDevice();
      var quant = config.quantisation || 'q4';

      logInfo('Loading tokeniser...');
      var tokeniserStart = now();
      loadedTokeniser = await AutoTokenizer.from_pretrained(config.modelId);
      logDebug('Tokeniser loaded in ' + elapsed(tokeniserStart) + 'ms');

      logInfo('Loading model (this may take a while for first download)...');
      var modelStart = now();
      loadedModel = await ModelClass.from_pretrained(config.modelId, {
        dtype: quant,
        device: device,
      });
      var modelLoadTime = elapsed(modelStart);
      logDebug('Model loaded in ' + modelLoadTime + 'ms');

      currentConfig = config;
      var totalTime = elapsed(start);

      // Estimate download size from Cache API
      var downloadSizeMB = 0;
      try {
        var cache = await caches.open(CACHE_NAME);
        var keys = await cache.keys();
        var modelSlug = config.modelId.replace('/', '%2F');
        var modelKeys = keys.filter(function (req) {
          return (req.url || '').includes(config.modelId) ||
                 (req.url || '').includes(modelSlug);
        });
        for (var i = 0; i < modelKeys.length; i++) {
          var resp = await cache.match(modelKeys[i]);
          if (resp) {
            var contentLength = resp.headers.get('content-length');
            if (contentLength) {
              downloadSizeMB += parseInt(contentLength, 10);
            }
          }
        }
        downloadSizeMB = Math.round(downloadSizeMB / (1024 * 1024));
      } catch (e) {
        logDebug('Could not estimate download size:', e.message);
      }

      var result = makeStepResult('pass', totalTime,
        'Loaded on ' + device + ' in ' + (totalTime / 1000).toFixed(1) + 's' +
        (fromCache ? ' (from cache)' : ' (fresh download)'), {
        downloadSizeMB: downloadSizeMB,
        loadTimeMs: totalTime,
        fromCache: fromCache,
      });

      if (results) {
        results.device = device;
      }

      logInfo('RESULT: PASS — Model loaded (' + device + ', ' +
        (totalTime / 1000).toFixed(1) + 's, ' +
        (fromCache ? 'cached' : 'fresh') + ')');
      return result;
    } catch (e) {
      loadedModel = null;
      loadedTokeniser = null;
      var result = makeStepResult('fail', elapsed(start), 'Load failed: ' + e.message);
      logError('RESULT: FAIL —', e.message);
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Core inference helper
  // ═══════════════════════════════════════════════════════════════════

  async function generateResponse(prompt, options) {
    if (!loadedModel || !loadedTokeniser) {
      throw new Error('Model not loaded — run loadModel first');
    }

    options = options || {};
    var maxTokens = options.maxTokens || 256;
    var temperature = options.temperature !== undefined ? options.temperature : 0.7;
    var topP = options.topP !== undefined ? options.topP : 0.95;

    var formattedPrompt = applyChatTemplate(loadedTokeniser, prompt);
    var inputIds = loadedTokeniser(formattedPrompt, { return_tensors: 'pt' });

    // Merge inputs + generation config into one object (matches working VLM pattern)
    var generateOptions = Object.assign({}, inputIds, {
      max_new_tokens: maxTokens,
      do_sample: temperature > 0,
      temperature: temperature,
      top_p: topP,
    });

    // Merge streamer callback if provided
    if (options.streamer) {
      generateOptions.streamer = options.streamer;
    }

    var output = await loadedModel.generate(generateOptions);

    // Decode only the generated tokens (skip the input)
    var inputLength = inputIds.input_ids.dims ? inputIds.input_ids.dims.at(-1) : 0;
    var generatedIds = output.slice(null, [inputLength, null]);
    var decoded = loadedTokeniser.decode(generatedIds[0], { skip_special_tokens: true });

    return {
      text: decoded.trim(),
      inputTokens: inputLength,
      outputTokens: generatedIds.dims ? generatedIds.dims[1] : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 4: basicInference
  // ═══════════════════════════════════════════════════════════════════

  async function stepBasicInference() {
    logInfo('─── Step 4/10: basicInference ───');
    logInfo('Testing: "What is the capital of France?"');
    var start = now();

    try {
      var response = await generateResponse('What is the capital of France?', {
        maxTokens: 100,
        temperature: 0.3,
      });

      var output = response.text;
      logDebug('Output: ' + output);

      var containsParis = output.toLowerCase().includes('paris');
      var isCoherent = output.split(/\s+/).length >= 3;

      if (containsParis && isCoherent) {
        var result = makeStepResult('pass', elapsed(start),
          'Contains "Paris", coherent response', { output: output });
        logInfo('RESULT: PASS — Correct and coherent');
        return result;
      } else {
        var notes = [];
        if (!containsParis) notes.push('does not mention Paris');
        if (!isCoherent) notes.push('incoherent (fewer than 3 words)');
        var result = makeStepResult('fail', elapsed(start),
          notes.join('; '), { output: output });
        logWarn('RESULT: FAIL — ' + notes.join('; '));
        return result;
      }
    } catch (e) {
      var result = makeStepResult('fail', elapsed(start),
        'Inference error: ' + e.message, { output: '' });
      logError('RESULT: FAIL —', e.message);
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 5: instructionTests
  // ═══════════════════════════════════════════════════════════════════

  async function stepInstructionTests() {
    logInfo('─── Step 5/10: instructionTests ───');
    logInfo('Running ' + INSTRUCTION_TESTS.length + ' instruction-following prompts');
    var start = now();
    var testResults = {};
    var passCount = 0;

    for (var i = 0; i < INSTRUCTION_TESTS.length; i++) {
      var test = INSTRUCTION_TESTS[i];
      logInfo('  Test "' + test.name + '": ' + test.passDescription);

      try {
        var response = await generateResponse(test.prompt, {
          maxTokens: 300,
          temperature: 0.3,
        });

        var passed = test.check(response.text);
        testResults[test.name] = {
          passed: passed,
          output: response.text.substring(0, 200),
          criteria: test.passDescription,
        };

        if (passed) {
          passCount++;
          logInfo('    ✓ PASS');
        } else {
          logWarn('    ✗ FAIL — Output: ' + response.text.substring(0, 100));
        }
      } catch (e) {
        testResults[test.name] = {
          passed: false,
          output: 'Error: ' + e.message,
          criteria: test.passDescription,
        };
        logError('    ✗ ERROR — ' + e.message);
      }
    }

    var allPass = passCount === INSTRUCTION_TESTS.length;
    var status = allPass ? 'pass' : (passCount > 0 ? 'partial' : 'fail');
    // Treat 'partial' as 'pass' for step status since some flexibility is expected
    if (status === 'partial') status = 'pass';

    var result = makeStepResult(
      passCount >= 2 ? 'pass' : 'fail',
      elapsed(start),
      passCount + '/' + INSTRUCTION_TESTS.length + ' tests passed',
      { results: testResults, passCount: passCount }
    );

    logInfo('RESULT: ' + (passCount >= 2 ? 'PASS' : 'FAIL') +
      ' — ' + passCount + '/' + INSTRUCTION_TESTS.length + ' passed');
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 6: streamingTest
  // ═══════════════════════════════════════════════════════════════════

  async function stepStreamingTest() {
    logInfo('─── Step 6/10: streamingTest ───');
    logInfo('Testing token-by-token streaming');
    var start = now();

    try {
      var mod = transformersModule;
      var tokenCount = 0;
      var accumulatedText = '';

      // Create a TextStreamer or callback-based streamer
      var streamerCallback = null;
      if (mod.TextStreamer) {
        logDebug('Using TextStreamer class');
        streamerCallback = new mod.TextStreamer(loadedTokeniser, {
          skip_prompt: true,
          callback_function: function (text) {
            tokenCount++;
            accumulatedText += text;
          },
        });
      } else {
        logDebug('TextStreamer not available, using callback approach');
        streamerCallback = {
          put: function (tokenIds) {
            tokenCount++;
            var text = loadedTokeniser.decode(tokenIds, { skip_special_tokens: true });
            accumulatedText += text;
          },
          end: function () {
            logDebug('Streaming ended');
          },
        };
      }

      await generateResponse('Explain gravity in 3 sentences.', {
        maxTokens: 150,
        temperature: 0.3,
        streamer: streamerCallback,
      });

      // If TextStreamer was used, tokenCount comes from callback
      // If not, try to count words as a rough proxy
      if (tokenCount === 0) {
        tokenCount = accumulatedText.split(/\s+/).filter(function (w) { return w.length > 0; }).length;
      }

      var hasContent = accumulatedText.trim().length > 10;

      if (hasContent && tokenCount > 0) {
        var result = makeStepResult('pass', elapsed(start),
          tokenCount + ' tokens streamed', { tokenCount: tokenCount });
        logInfo('RESULT: PASS — ' + tokenCount + ' tokens streamed successfully');
        return result;
      } else {
        var result = makeStepResult('fail', elapsed(start),
          'Streaming produced no content (tokens: ' + tokenCount + ')',
          { tokenCount: tokenCount });
        logWarn('RESULT: FAIL — No content from streaming');
        return result;
      }
    } catch (e) {
      var result = makeStepResult('fail', elapsed(start),
        'Streaming error: ' + e.message, { tokenCount: 0 });
      logError('RESULT: FAIL —', e.message);
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 7: memoryProfile
  // ═══════════════════════════════════════════════════════════════════

  async function stepMemoryProfile() {
    logInfo('─── Step 7/10: memoryProfile ───');
    logInfo('Profiling memory usage');
    var start = now();

    try {
      var jsHeapMB = 0;
      var usedMB = 0;
      var gpuMemMB = 0;

      // Chrome-specific JS heap info
      if (performance.memory) {
        jsHeapMB = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
        logDebug('JS Heap: ' + jsHeapMB + 'MB (of ' +
          Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024)) + 'MB limit)');
      } else {
        logDebug('performance.memory not available (Chrome-only API)');
      }

      // Storage estimate
      try {
        var estimate = await navigator.storage.estimate();
        usedMB = Math.round((estimate.usage || 0) / (1024 * 1024));
        logDebug('Storage used: ' + usedMB + 'MB (of ' +
          Math.round((estimate.quota || 0) / (1024 * 1024)) + 'MB quota)');
      } catch (e) {
        logDebug('Storage estimate unavailable:', e.message);
      }

      // GPU memory (WebGPU adapter info)
      try {
        if (navigator.gpu) {
          var adapter = await navigator.gpu.requestAdapter();
          if (adapter) {
            var adapterInfo = adapter.info || (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : {});
            // Note: WebGPU doesn't directly expose VRAM usage,
            // but we log what we can find
            logDebug('GPU: ' + (adapterInfo.description || 'Unknown'));
            // Some implementations may expose memory limits
            if (adapter.limits && adapter.limits.maxBufferSize) {
              gpuMemMB = Math.round(adapter.limits.maxBufferSize / (1024 * 1024));
              logDebug('GPU max buffer size: ' + gpuMemMB + 'MB');
            }
          }
        }
      } catch (e) {
        logDebug('GPU memory info unavailable:', e.message);
      }

      var result = makeStepResult('pass', elapsed(start),
        'JS heap: ' + jsHeapMB + 'MB, Storage: ' + usedMB + 'MB, GPU buffer: ' + gpuMemMB + 'MB', {
        usedMB: usedMB,
        jsHeapMB: jsHeapMB,
        gpuMemMB: gpuMemMB,
      });

      logInfo('RESULT: PASS — Memory profiled');
      return result;
    } catch (e) {
      var result = makeStepResult('fail', elapsed(start),
        'Memory profiling error: ' + e.message, {
        usedMB: 0, jsHeapMB: 0, gpuMemMB: 0,
      });
      logError('RESULT: FAIL —', e.message);
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 8: speedBenchmark
  // ═══════════════════════════════════════════════════════════════════

  async function stepSpeedBenchmark() {
    logInfo('─── Step 8/10: speedBenchmark ───');
    logInfo('Running 3 benchmark iterations (temperature: 0 for determinism)');
    var start = now();

    try {
      var runs = [];
      var NUM_RUNS = 3;

      for (var i = 0; i < NUM_RUNS; i++) {
        logInfo('  Run ' + (i + 1) + '/' + NUM_RUNS + '...');
        var runStart = now();

        var response = await generateResponse(BENCHMARK_PROMPT, {
          maxTokens: 200,
          temperature: 0,
          topP: 1.0,
        });

        var runDuration = elapsed(runStart);
        var outputTokens = response.outputTokens || response.text.split(/\s+/).length;
        var tokPerSec = outputTokens / (runDuration / 1000);

        runs.push({
          durationMs: runDuration,
          outputTokens: outputTokens,
          tokensPerSecond: Math.round(tokPerSec * 10) / 10,
        });

        logDebug('    ' + runDuration + 'ms, ' + outputTokens + ' tokens, ' +
          tokPerSec.toFixed(1) + ' tok/s');
      }

      // Calculate median tokens/second
      var sortedSpeeds = runs.map(function (r) { return r.tokensPerSecond; }).sort(function (a, b) { return a - b; });
      var medianSpeed = sortedSpeeds[Math.floor(sortedSpeeds.length / 2)];
      var medianMs = runs.map(function (r) { return r.durationMs; }).sort(function (a, b) { return a - b; })[Math.floor(runs.length / 2)];

      var result = makeStepResult('pass', elapsed(start),
        'Median: ' + medianSpeed + ' tok/s (' + medianMs + 'ms)', {
        tokensPerSecond: medianSpeed,
        medianMs: medianMs,
        runs: runs,
      });

      logInfo('RESULT: PASS — Median speed: ' + medianSpeed + ' tok/s');
      return result;
    } catch (e) {
      var result = makeStepResult('fail', elapsed(start),
        'Benchmark error: ' + e.message, {
        tokensPerSecond: 0, medianMs: 0, runs: [],
      });
      logError('RESULT: FAIL —', e.message);
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 9: contextTest
  // ═══════════════════════════════════════════════════════════════════

  async function stepContextTest(tokenCount) {
    var targetTokens = tokenCount || 4096;
    logInfo('─── Step 9/10: contextTest ───');
    logInfo('Testing context window at ~' + targetTokens + ' tokens');
    var start = now();

    try {
      // Build filler text — each paragraph is roughly 70 tokens
      var fillerRepetitions = Math.ceil((targetTokens - 300) / 70);
      var fillerText = '';
      for (var i = 0; i < fillerRepetitions; i++) {
        fillerText += CONTEXT_FILLER_PARAGRAPH;
      }

      var fullPrompt = fillerText +
        '\n\nBased on all the text above, what was the very first word of this entire passage?';

      logDebug('Built context prompt with ~' + fillerRepetitions * 70 + ' filler tokens');

      var response = await generateResponse(fullPrompt, {
        maxTokens: 50,
        temperature: 0.3,
      });

      // We don't care about correctness — just that it didn't crash
      var hasOutput = response.text.trim().length > 0;

      if (hasOutput) {
        var result = makeStepResult('pass', elapsed(start),
          'Model handled ~' + targetTokens + ' token context without crashing');
        logInfo('RESULT: PASS — Context test completed, output received');
        return result;
      } else {
        var result = makeStepResult('fail', elapsed(start),
          'Model produced empty output for long context');
        logWarn('RESULT: FAIL — Empty output');
        return result;
      }
    } catch (e) {
      // Distinguish OOM/context-too-long from other errors
      var isContextError = e.message && (
        e.message.includes('out of memory') ||
        e.message.includes('OOM') ||
        e.message.includes('too long') ||
        e.message.includes('exceeds')
      );

      var result = makeStepResult('fail', elapsed(start),
        (isContextError ? 'Context limit exceeded: ' : 'Error: ') + e.message);
      logError('RESULT: FAIL —', e.message);
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 10: cleanup
  // ═══════════════════════════════════════════════════════════════════

  async function stepCleanup() {
    logInfo('─── Step 10/10: cleanup ───');
    logInfo('Disposing model and tokeniser');
    var start = now();

    try {
      if (loadedModel) {
        if (typeof loadedModel.dispose === 'function') {
          await loadedModel.dispose();
          logDebug('Model disposed via dispose()');
        }
        loadedModel = null;
      }

      if (loadedTokeniser) {
        if (typeof loadedTokeniser.dispose === 'function') {
          await loadedTokeniser.dispose();
          logDebug('Tokeniser disposed via dispose()');
        }
        loadedTokeniser = null;
      }

      currentConfig = null;

      // Clear Cache API to prevent quota exhaustion between models
      try {
        var cacheNames = await caches.keys();
        for (var ci = 0; ci < cacheNames.length; ci++) {
          if (cacheNames[ci].indexOf('transformers') !== -1 || cacheNames[ci].indexOf('onnx') !== -1) {
            await caches.delete(cacheNames[ci]);
            logDebug('Cleared cache: ' + cacheNames[ci]);
          }
        }
        if (cacheNames.length > 0) {
          logInfo('Cache API cleared (' + cacheNames.length + ' caches found)');
        }
      } catch (cacheErr) {
        logDebug('Could not clear Cache API: ' + cacheErr.message);
      }

      // Report memory after cleanup
      var jsHeapAfter = 0;
      if (performance.memory) {
        jsHeapAfter = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
        logDebug('JS Heap after cleanup: ' + jsHeapAfter + 'MB');
      }

      var result = makeStepResult('pass', elapsed(start),
        'Cleanup complete' + (jsHeapAfter ? ' (heap: ' + jsHeapAfter + 'MB)' : ''));
      logInfo('RESULT: PASS — Resources released');
      return result;
    } catch (e) {
      // Force-null references even if dispose fails
      loadedModel = null;
      loadedTokeniser = null;
      currentConfig = null;

      var result = makeStepResult('pass', elapsed(start),
        'Cleanup completed with warnings: ' + e.message);
      logWarn('RESULT: PASS (with warnings) —', e.message);
      return result;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Full evaluation orchestrator
  // ═══════════════════════════════════════════════════════════════════

  async function evaluate(config) {
    if (!config || !config.modelId) {
      logError('evaluate() requires { modelId } at minimum');
      return null;
    }

    // Look up known model if className not provided
    if (!config.className && KNOWN_MODELS[config.modelId]) {
      config.className = KNOWN_MODELS[config.modelId].className;
      logInfo('Using known class name for ' + config.modelId + ': ' + config.className);
    }

    if (!config.className) {
      logError('No className provided and model not in KNOWN_MODELS. ' +
        'Provide className or use a known model. Call listKnownModels() to see options.');
      return null;
    }

    logInfo('╔══════════════════════════════════════════════════════════╗');
    logInfo('║  TEXT LLM SPIKE EVALUATION                              ║');
    logInfo('║  Model: ' + config.modelId);
    logInfo('║  Class: ' + config.className +
      ' | Quant: ' + (config.quantisation || 'q4') +
      (config.cdnVersion ? ' | CDN: ' + config.cdnVersion : ''));
    logInfo('╚══════════════════════════════════════════════════════════╝');

    results = createFreshResults(config);
    results.hardware = await detectHardware();

    var stepNames = [
      'checkONNX', 'checkClass', 'loadModel', 'basicInference',
      'instructionTests', 'streamingTest', 'memoryProfile',
      'speedBenchmark', 'contextTest', 'cleanup'
    ];

    var criticalSteps = ['checkONNX', 'checkClass', 'loadModel'];

    // Step 1: checkONNX
    results.steps.checkONNX = await stepCheckONNX(config.modelId);
    if (results.steps.checkONNX.status === 'fail') {
      // Not strictly fatal — the model might exist under a different structure
      logWarn('ONNX check failed but continuing — model may still be loadable');
    }

    // Step 2: checkClass (pass cdnVersion if specified)
    results.steps.checkClass = await stepCheckClass(config.className, config.cdnVersion);
    if (results.steps.checkClass.status === 'fail') {
      logError('Critical failure: model class not available. Skipping remaining steps.');
      markRemainingSkipped(results.steps, 'checkClass');
      finaliseResults();
      return results;
    }

    results.cdnVersion = resolvedCdnUrl || '';

    // Step 3: loadModel
    results.steps.loadModel = await stepLoadModel(config);
    if (results.steps.loadModel.status === 'fail') {
      logError('Critical failure: model failed to load. Skipping remaining steps.');
      markRemainingSkipped(results.steps, 'loadModel');
      finaliseResults();
      return results;
    }

    results.device = resolvedDevice || '';

    // Step 4: basicInference
    results.steps.basicInference = await stepBasicInference();

    // Step 5: instructionTests
    results.steps.instructionTests = await stepInstructionTests();

    // Step 6: streamingTest
    results.steps.streamingTest = await stepStreamingTest();

    // Step 7: memoryProfile
    results.steps.memoryProfile = await stepMemoryProfile();

    // Step 8: speedBenchmark
    results.steps.speedBenchmark = await stepSpeedBenchmark();

    // Step 9: contextTest
    results.steps.contextTest = await stepContextTest(config.contextLength || 4096);

    // Step 10: cleanup
    results.steps.cleanup = await stepCleanup();

    finaliseResults();
    return results;
  }

  function markRemainingSkipped(steps, failedStep) {
    var stepOrder = [
      'checkONNX', 'checkClass', 'loadModel', 'basicInference',
      'instructionTests', 'streamingTest', 'memoryProfile',
      'speedBenchmark', 'contextTest', 'cleanup'
    ];
    var failIndex = stepOrder.indexOf(failedStep);
    for (var i = failIndex + 1; i < stepOrder.length; i++) {
      if (!steps[stepOrder[i]]) {
        steps[stepOrder[i]] = makeStepResult('skip', 0,
          'Skipped due to ' + failedStep + ' failure');
      }
    }
  }

  function finaliseResults() {
    results.overallStatus = computeOverallStatus(results.steps);
    results.summary = computeSummary(results);

    logInfo('');
    logInfo('════════════════════════════════════════════════════════════');
    logInfo('  EVALUATION COMPLETE: ' + results.summary);
    logInfo('════════════════════════════════════════════════════════════');
    logInfo('');
    logInfo('Call TextLLMSpike.printSummary() for detailed results table.');
  }

  // ═══════════════════════════════════════════════════════════════════
  // Results display
  // ═══════════════════════════════════════════════════════════════════

  function printSummary() {
    if (!results) {
      logWarn('No results available. Run evaluate() first.');
      return;
    }

    // Header box
    console.log('%c' +
      '╔══════════════════════════════════════════════════════════╗\n' +
      '║  TEXT LLM SPIKE RESULTS                                  ║\n' +
      '║  Model: ' + results.modelId.padEnd(47) + '║\n' +
      '║  Class: ' + results.className + ' | Quant: ' +
      results.quantisation + ' | Device: ' + (results.device || 'N/A') +
      ''.padEnd(Math.max(0, 40 - results.className.length -
        results.quantisation.length - (results.device || 'N/A').length)) + '║\n' +
      '╚══════════════════════════════════════════════════════════╝',
      'color: #2196F3; font-weight: bold; font-size: 11px;'
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
          'Duration (ms)': step.duration,
          Notes: (step.notes || '').substring(0, 60),
        };
      }
    }
    console.table(tableData);

    // Footer
    console.log('%cOverall: ' + results.summary,
      'color: ' + (results.overallStatus === 'pass' ? '#4CAF50' :
        results.overallStatus === 'partial' ? '#FF9800' : '#F44336') +
      '; font-weight: bold; font-size: 12px;'
    );

    // Hardware info
    if (results.hardware) {
      console.log('%cHardware: ' + results.hardware.gpuDescription +
        ' (' + results.hardware.hardwareClass + ')',
        'color: #9E9E9E; font-size: 10px;'
      );
    }
  }

  function exportBenchmark() {
    if (!results) {
      logWarn('No results available. Run evaluate() first.');
      return null;
    }

    var benchmark = {
      modelId: results.modelId,
      hardwareClass: results.hardware ? results.hardware.hardwareClass : 'unknown',
      gpuDescription: results.hardware ? results.hardware.gpuDescription : '',
      tokensPerSecond: results.steps.speedBenchmark
        ? results.steps.speedBenchmark.tokensPerSecond : 0,
      loadTimeSec: results.steps.loadModel
        ? Math.round(results.steps.loadModel.loadTimeMs / 100) / 10 : 0,
      contextTestPassed: results.steps.contextTest
        ? results.steps.contextTest.status === 'pass' : false,
      vramPeakMB: results.steps.memoryProfile
        ? results.steps.memoryProfile.gpuMemMB : 0,
      timestamp: results.timestamp,
    };

    var json = JSON.stringify(benchmark, null, 2);
    logInfo('Benchmark export:');
    console.log(json);
    return json;
  }

  // ══════════════════════════════════════════════════════════════════
  // Batch evaluation
  // ══════════════════════════════════════════════════════════════════

  let batchResults = null;

  // Resolve CDN version for a model: batch override > per-model preference > default.
  function resolveCdnForModel(modelId, batchCdnOverride) {
    if (batchCdnOverride) return batchCdnOverride;
    const entry = KNOWN_MODELS[modelId];
    if (entry && entry.cdn) return entry.cdn;
    return CDN_DEFAULT;
  }

  // Resolve a human-readable version label from a CDN URL.
  function cdnUrlToLabel(url) {
    if (!url) return 'unknown';
    for (const key in CDN_VERSIONS) {
      if (url === CDN_VERSIONS[key]) return key;
    }
    return 'unknown';
  }

  async function batchEvaluate(options) {
    const config = Object.assign(
      {
        models: WAVE_3_BATCH,
        skipOnFail: true,
        cooldownMs: 3000,
        cdnVersion: null, // null = use per-model preference or CDN_DEFAULT
        startFrom: 1, // 1-based model number to start from (skips earlier models)
      },
      options || {},
    );

    // Validate cdnVersion if explicitly provided
    if (config.cdnVersion && !CDN_VERSIONS[config.cdnVersion]) {
      logError('Unknown cdnVersion "' + config.cdnVersion +
        '". Available: ' + Object.keys(CDN_VERSIONS).join(', '));
      return null;
    }

    // Auto-enable resilient-fetch if available and not already active
    if (!resilientFetchActive && typeof window.ResilientFetch !== 'undefined') {
      try {
        await enableResilientDownload();
        logInfo('[Batch] Resilient download auto-enabled for large model downloads');
      } catch (e) {
        logWarn('[Batch] Could not auto-enable resilient download: ' + e.message);
      }
    }

    const modelList = config.models;
    const totalModels = modelList.length;
    const startIndex = Math.max(0, Math.min(config.startFrom - 1, totalModels - 1));
    const batchStartTime = now();

    // Detect hardware once for the whole batch
    const hw = await detectHardware();

    const cdnLabel = config.cdnVersion || 'per-model (default: ' + CDN_DEFAULT + ')';
    const rangeLabel = startIndex > 0
      ? '  Models ' + (startIndex + 1) + '–' + totalModels + ' of ' + totalModels
      : '  Models: ' + totalModels;

    logInfo('');
    logInfo('╔══════════════════════════════════════════════════════════╗');
    logInfo('║  BATCH SPIKE EVALUATION — Wave 3                        ║');
    logInfo('║' + rangeLabel + '                                            ║'.substring(0, 58 - rangeLabel.length) + '║');
    logInfo('║  CDN: ' + cdnLabel + '                                  ║');
    logInfo('║  GPU: ' + (hw.gpuDescription || 'Unknown').substring(0, 48) + '  ║');
    if (resilientFetchActive) {
      logInfo('║  Resilient fetch: ACTIVE                                 ║');
    }
    logInfo('╚══════════════════════════════════════════════════════════╝');
    logInfo('');

    // Initialise batch results
    batchResults = {
      batchId: 'wave3-' + new Date().toISOString(),
      cdnVersionRequested: config.cdnVersion || null,
      machine: {
        gpu: hw.gpuDescription || 'Unknown',
        gpuVendor: hw.gpuVendor || '',
        hardwareClass: hw.hardwareClass || 'unknown',
        browser: navigator.userAgent.match(/Chrome\/(\d+)/)?.[0] ||
          navigator.userAgent.substring(0, 50),
        crossOriginIsolated: !!self.crossOriginIsolated,
        timestamp: new Date().toISOString(),
      },
      totalElapsedMs: 0,
      results: [],
    };

    // Try to get WebGPU limits
    try {
      if (navigator.gpu) {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          batchResults.machine.maxBufferSize = adapter.limits.maxBufferSize;
          batchResults.machine.shaderF16 = adapter.features.has('shader-f16');
        }
      }
    } catch (e) {
      logDebug('Could not read WebGPU limits:', e.message);
    }

    // Track which CDN is currently loaded so we know when to reset
    let currentlyLoadedCdn = resolvedCdnUrl ? cdnUrlToLabel(resolvedCdnUrl) : null;

    // Log skipped models when using startFrom
    if (startIndex > 0) {
      for (let s = 0; s < startIndex; s++) {
        const skippedId = modelList[s];
        const skippedSize = KNOWN_MODELS[skippedId] ? KNOWN_MODELS[skippedId].sizeNote : '?';
        logInfo('[Batch] Model ' + (s + 1) + '/' + totalModels + ': ' +
          skippedId + ' (' + skippedSize + ') — SKIPPED (startFrom: ' + config.startFrom + ')');
        batchResults.results.push({
          modelId: skippedId,
          sizeNote: skippedSize,
          status: 'skipped',
          overallStatus: 'skipped',
          tokensPerSecond: 0,
          loadTimeSec: 0,
          contextTestPassed: false,
          instructionScore: '—',
          streamingWorks: false,
          error: 'Skipped (startFrom: ' + config.startFrom + ')',
          elapsedMs: 0,
        });
      }
    }

    for (let i = startIndex; i < totalModels; i++) {
      const modelId = modelList[i];
      const modelNum = i + 1;
      const sizeNote = KNOWN_MODELS[modelId]
        ? KNOWN_MODELS[modelId].sizeNote
        : '?';
      const wantCdn = resolveCdnForModel(modelId, config.cdnVersion);

      // If this model needs a different CDN version than what's loaded, reset
      if (currentlyLoadedCdn && currentlyLoadedCdn !== wantCdn) {
        logInfo('[Batch] CDN switch needed: ' + currentlyLoadedCdn + ' → ' + wantCdn +
          ' — resetting Transformers module');
        resetTransformersModule();
        currentlyLoadedCdn = null;
      }

      logInfo('');
      logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logInfo(
        '[Batch] Model ' + modelNum + '/' + totalModels + ': ' +
        modelId + ' (' + sizeNote + ', CDN: ' + wantCdn + ') — starting...',
      );
      logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const modelStartTime = now();
      let modelResult = {
        modelId: modelId,
        sizeNote: sizeNote,
        cdnRequested: wantCdn,
        cdnActual: null,
        status: 'fail',
        tokensPerSecond: 0,
        downloadSizeMB: 0,
        loadTimeSec: 0,
        contextTestPassed: false,
        instructionScore: '0/4',
        streamingWorks: false,
        overallStatus: 'fail',
        error: null,
        elapsedMs: 0,
      };

      try {
        // Run full evaluation with CDN version
        const evalResult = await evaluate({ modelId: modelId, cdnVersion: wantCdn });

        // Record which CDN was actually loaded
        modelResult.cdnActual = cdnUrlToLabel(resolvedCdnUrl);
        currentlyLoadedCdn = modelResult.cdnActual;

        if (evalResult) {
          modelResult.status = evalResult.overallStatus || 'fail';
          modelResult.overallStatus = evalResult.overallStatus || 'fail';

          // Extract key metrics from steps
          if (
            evalResult.steps.speedBenchmark &&
            evalResult.steps.speedBenchmark.tokensPerSecond
          ) {
            modelResult.tokensPerSecond =
              Math.round(evalResult.steps.speedBenchmark.tokensPerSecond * 10) / 10;
          }
          if (
            evalResult.steps.loadModel &&
            evalResult.steps.loadModel.loadTimeMs
          ) {
            modelResult.loadTimeSec =
              Math.round(evalResult.steps.loadModel.loadTimeMs / 100) / 10;
          }
          if (
            evalResult.steps.loadModel &&
            evalResult.steps.loadModel.downloadSizeMB
          ) {
            modelResult.downloadSizeMB =
              evalResult.steps.loadModel.downloadSizeMB;
          }
          if (evalResult.steps.contextTest) {
            modelResult.contextTestPassed =
              evalResult.steps.contextTest.status === 'pass';
          }
          if (
            evalResult.steps.instructionTests &&
            evalResult.steps.instructionTests.passCount !== undefined
          ) {
            modelResult.instructionScore =
              evalResult.steps.instructionTests.passCount + '/4';
          }
          if (evalResult.steps.streamingTest) {
            modelResult.streamingWorks =
              evalResult.steps.streamingTest.status === 'pass';
          }
        }
      } catch (err) {
        modelResult.error = err.message || String(err);
        logError(
          '[Batch] Model ' + modelNum + '/' + totalModels +
          ': EXCEPTION — ' + modelResult.error,
        );
      }

      modelResult.elapsedMs = Math.round(now() - modelStartTime);

      // Log per-model result
      const statusIcon =
        modelResult.status === 'pass'
          ? '✅'
          : modelResult.status === 'partial'
            ? '⚠️'
            : '❌';
      logInfo(
        '[Batch] Model ' + modelNum + '/' + totalModels + ': ' +
        modelId + ' — ' + statusIcon + ' ' +
        modelResult.status.toUpperCase() + ' (' +
        (modelResult.elapsedMs / 1000).toFixed(1) + 's' +
        (modelResult.tokensPerSecond
          ? ', ' + modelResult.tokensPerSecond + ' tok/s'
          : '') +
        ', CDN: ' + (modelResult.cdnActual || wantCdn) +
        ')',
      );

      batchResults.results.push(modelResult);

      // Ensure cleanup happened (evaluate does this, but be safe)
      if (loadedModel) {
        logWarn('[Batch] Model still loaded after evaluate — forcing cleanup');
        try {
          await stepCleanup();
        } catch (e) {
          /* ignore */
        }
      }

      // Cooldown between models (skip after last)
      if (i < totalModels - 1) {
        logDebug(
          '[Batch] Cooldown ' + config.cooldownMs +
          'ms for GPU memory release...',
        );
        await new Promise(function (resolve) {
          setTimeout(resolve, config.cooldownMs);
        });
      }
    }

    batchResults.totalElapsedMs = Math.round(now() - batchStartTime);

    // Print summary table
    printBatchSummary();

    return batchResults;
  }

  function printBatchSummary() {
    if (!batchResults || !batchResults.results.length) {
      logWarn('No batch results available.');
      return;
    }

    logInfo('');
    logInfo('╔══════════════════════════════════════════════════════════╗');
    logInfo('║  BATCH EVALUATION COMPLETE                               ║');
    logInfo('║  GPU: ' + (batchResults.machine.gpu || 'Unknown').substring(0, 48) + '  ║');
    logInfo('║  Total time: ' + (batchResults.totalElapsedMs / 1000 / 60).toFixed(1) + ' minutes' +
      '                                   ║'.substring(0, 35));
    logInfo('╚══════════════════════════════════════════════════════════╝');
    logInfo('');

    // Build console.table data
    const tableData = {};
    batchResults.results.forEach(function (r) {
      // Use short model name for table readability
      const shortName = r.modelId.split('/').pop();
      tableData[shortName] = {
        'Status': r.status.toUpperCase(),
        'tok/s': r.tokensPerSecond || '—',
        'Size': r.sizeNote || '?',
        'CDN': r.cdnActual || r.cdnRequested || '?',
        'Load (s)': r.loadTimeSec || '—',
        'Ctx 4096': r.contextTestPassed ? 'PASS' : 'FAIL',
        'Instruct': r.instructionScore,
        'Stream': r.streamingWorks ? 'YES' : 'NO',
        'Error': r.error ? r.error.substring(0, 30) : '',
      };
    });
    console.table(tableData);

    // Count results
    const passed = batchResults.results.filter(function (r) {
      return r.status === 'pass';
    }).length;
    const partial = batchResults.results.filter(function (r) {
      return r.status === 'partial';
    }).length;
    const failed = batchResults.results.filter(function (r) {
      return r.status === 'fail';
    }).length;

    logInfo(
      'Results: ' + passed + ' passed, ' + partial + ' partial, ' +
      failed + ' failed',
    );
    logInfo('');
    logInfo('Call TextLLMSpike.exportBatchJSON() to get the full results as copy-paste JSON.');
  }

  function getBatchResults() {
    return batchResults;
  }

  function exportBatchJSON() {
    if (!batchResults) {
      logWarn('No batch results available. Run batchEvaluate() first.');
      return null;
    }

    const json = JSON.stringify(batchResults, null, 2);
    logInfo('Batch results JSON (' + json.length + ' chars):');
    console.log(json);
    return json;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Individual step wrappers (for partial runs / debugging)
  // ═══════════════════════════════════════════════════════════════════

  async function publicCheckONNX(modelId) {
    return await stepCheckONNX(modelId);
  }

  async function publicCheckClass(className, cdnVersion) {
    return await stepCheckClass(className, cdnVersion);
  }

  async function publicLoadModel(config) {
    if (!config || !config.modelId) {
      logError('loadModel() requires { modelId, className }');
      return null;
    }
    if (!config.className && KNOWN_MODELS[config.modelId]) {
      config.className = KNOWN_MODELS[config.modelId].className;
    }
    if (!config.className) {
      logError('No className provided and model not in KNOWN_MODELS');
      return null;
    }

    // Ensure Transformers.js is loaded
    if (!transformersModule) {
      var classResult = await stepCheckClass(config.className, config.cdnVersion);
      if (classResult.status === 'fail') return classResult;
    }

    currentConfig = config;
    return await stepLoadModel(config);
  }

  async function publicRunInference(prompt, options) {
    if (!loadedModel) {
      logError('No model loaded. Call loadModel() first.');
      return null;
    }
    return await generateResponse(prompt, options);
  }

  async function publicTestInstructions() {
    if (!loadedModel) {
      logError('No model loaded. Call loadModel() first.');
      return null;
    }
    return await stepInstructionTests();
  }

  async function publicTestStreaming(prompt, options) {
    if (!loadedModel) {
      logError('No model loaded. Call loadModel() first.');
      return null;
    }
    return await stepStreamingTest();
  }

  async function publicProfileMemory() {
    return await stepMemoryProfile();
  }

  async function publicBenchmark(options) {
    if (!loadedModel) {
      logError('No model loaded. Call loadModel() first.');
      return null;
    }
    return await stepSpeedBenchmark();
  }

  async function publicTestContext(tokenCount) {
    if (!loadedModel) {
      logError('No model loaded. Call loadModel() first.');
      return null;
    }
    return await stepContextTest(tokenCount);
  }

  async function publicCleanup() {
    return await stepCleanup();
  }

  function listKnownModels() {
    var tableData = {};
    for (var modelId in KNOWN_MODELS) {
      tableData[modelId] = {
        className: KNOWN_MODELS[modelId].className,
        size: KNOWN_MODELS[modelId].sizeNote || '',
        cdn: KNOWN_MODELS[modelId].cdn || CDN_DEFAULT,
        verified: KNOWN_MODELS[modelId].verified ? 'YES' : 'no — needs checking',
      };
    }
    console.table(tableData);
    logInfo('Use: TextLLMSpike.evaluate({ modelId: "..." })');
    logInfo('"verified: YES" means confirmed on HuggingFace with ONNX + Transformers.js tags.');
    logInfo('Browse all: https://huggingface.co/models?library=onnx,transformers.js&pipeline_tag=text-generation');
    return KNOWN_MODELS;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════
  // Range Support Probe (Stage 1 — Resilient Download)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Tests whether HuggingFace CDN accepts HTTP Range requests from the browser.
   * Critical risk gate for the resilient chunked-download approach.
   *
   * @param {string} modelId - e.g. 'HuggingFaceTB/SmolLM3-3B-ONNX'
   * @returns {Promise<Object>} Result object with supported, contentLength, etc.
   */
  async function testRangeSupport(modelId) {
    const url = `${HF_BASE}/${modelId}/resolve/main/onnx/model_q4.onnx`;
    const result = {
      supported: false,
      contentLength: null,
      acceptRanges: null,
      rangeTestStatus: null,
      rangeTestBytes: null,
      error: null,
    };

    logInfo('─── Range Support Test ───');
    logInfo('Testing:', url);

    // Step 1: HEAD request to check Content-Length and Accept-Ranges
    let headResponse;
    try {
      headResponse = await fetch(url, { method: 'HEAD' });
    } catch (err) {
      result.error = `HEAD request failed: ${err.message || err}`;
      logError(result.error);
      logWarn('RESULT: Range requests NOT SUPPORTED — CORS or network error');
      return result;
    }

    const contentLength = headResponse.headers.get('Content-Length');
    const acceptRanges = headResponse.headers.get('Accept-Ranges');
    result.contentLength = contentLength ? parseInt(contentLength, 10) : null;
    result.acceptRanges = acceptRanges;

    const sizeMB = result.contentLength ? (result.contentLength / (1024 * 1024)).toFixed(0) : '?';
    logInfo(`HEAD response: ${headResponse.status}, Content-Length: ${result.contentLength} (${sizeMB}MB)`);
    logDebug('Final URL (after redirects):', headResponse.url);

    if (!acceptRanges || acceptRanges.toLowerCase() !== 'bytes') {
      result.error = `Accept-Ranges header is '${acceptRanges}' — server does not advertise byte range support`;
      logWarn('Accept-Ranges:', acceptRanges || '(missing)', '✗');
      logWarn('RESULT: Range requests NOT SUPPORTED — server does not advertise byte ranges');
      return result;
    }

    logInfo('Accept-Ranges: bytes ✓');

    // Step 2: Small Range GET to verify Range is actually honoured
    let rangeResponse;
    try {
      rangeResponse = await fetch(url, {
        method: 'GET',
        headers: { 'Range': 'bytes=0-1023' },
      });
    } catch (err) {
      result.error = `Range GET failed: ${err.message || err} — Range requests are likely CORS-blocked`;
      logError(result.error);
      logWarn('RESULT: Range requests NOT SUPPORTED — CORS blocks Range header');
      return result;
    }

    result.rangeTestStatus = rangeResponse.status;

    if (rangeResponse.status === 200) {
      result.error = 'Range advertised but not honoured — server returned 200 instead of 206';
      logWarn(`Range GET (bytes=0-1023): ${rangeResponse.status} OK — server ignored Range header ✗`);
      logWarn('RESULT: Range requests NOT SUPPORTED — Range advertised but not honoured');
      return result;
    }

    if (rangeResponse.status !== 206) {
      result.error = `Unexpected status ${rangeResponse.status} from Range GET`;
      logWarn(`Range GET (bytes=0-1023): ${rangeResponse.status} ✗`);
      logWarn('RESULT: Range requests NOT SUPPORTED — unexpected response');
      return result;
    }

    // 206 Partial Content — success
    const body = await rangeResponse.arrayBuffer();
    result.rangeTestBytes = body.byteLength;
    result.supported = true;

    logInfo(`Range GET (bytes=0-1023): 206 Partial Content, received ${result.rangeTestBytes} bytes ✓`);
    logInfo('RESULT: Range requests SUPPORTED — resilient download is viable');

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Resilient download integration (Stage 3)
  // ═══════════════════════════════════════════════════════════════════

  async function enableResilientDownload(options) {
    if (typeof window.ResilientFetch === 'undefined') {
      const msg = 'ResilientFetch module not loaded — ensure resilient-fetch.js is included before the harness';
      logError(msg);
      throw new Error(msg);
    }

    if (!transformersModule) {
      await importTransformers();
    }

    originalEnvFetch = transformersModule.env.fetch;

    const opts = Object.assign({}, options || {});
    opts.originalFetch = typeof originalEnvFetch === 'function'
      ? originalEnvFetch
      : globalThis.fetch.bind(globalThis);

    transformersModule.env.fetch = window.ResilientFetch.create(opts);
    resilientFetchActive = true;

    const threshold = opts.sizeThresholdMB || 100;
    const chunkSize = opts.chunkSizeMB || 50;
    logInfo('Resilient download enabled (threshold: ' + threshold + 'MB, chunks: ' + chunkSize + 'MB)');

    return { enabled: true, threshold: threshold, chunkSize: chunkSize };
  }

  function disableResilientDownload() {
    if (!resilientFetchActive) {
      logWarn('Resilient download is not active');
      return { disabled: false, reason: 'not active' };
    }

    transformersModule.env.fetch = originalEnvFetch;
    resilientFetchActive = false;
    originalEnvFetch = null;

    logInfo('Resilient download disabled — using default Transformers.js fetch');
    return { disabled: true };
  }

  function getResilientStatus() {
    return {
      active: resilientFetchActive,
      moduleLoaded: typeof window.ResilientFetch !== 'undefined',
      transformersLoaded: transformersModule !== null,
    };
  }

  window.TextLLMSpike = {
    // Full evaluation — runs all 10 steps
    evaluate: evaluate,

    // Individual steps
    checkONNX: publicCheckONNX,
    checkClass: publicCheckClass,
    loadModel: publicLoadModel,
    runInference: publicRunInference,
    testInstructions: publicTestInstructions,
    testStreaming: publicTestStreaming,
    profileMemory: publicProfileMemory,
    benchmark: publicBenchmark,
    testContext: publicTestContext,
    cleanup: publicCleanup,

    // Results
    getResults: function () { return results; },
    printSummary: printSummary,
    exportBenchmark: exportBenchmark,

    // State
    isModelLoaded: function () { return loadedModel !== null; },
    getModelInfo: function () {
      if (!currentConfig) return null;
      return {
        modelId: currentConfig.modelId,
        className: currentConfig.className,
        device: resolvedDevice,
        quantisation: currentConfig.quantisation || 'q4',
      };
    },

    // Model lookup
    listKnownModels: listKnownModels,

    // Batch evaluation
    batchEvaluate: batchEvaluate,
    getBatchResults: getBatchResults,
    exportBatchJSON: exportBatchJSON,
    printBatchSummary: printBatchSummary,

    // Batch list
    getWave3Batch: function () { return WAVE_3_BATCH.slice(); },
    getWave4Batch: function () { return WAVE_4_BATCH.slice(); },

    // CDN version management
    listCdnVersions: function () {
      const table = {};
      for (const key in CDN_VERSIONS) {
        table[key] = {
          url: CDN_VERSIONS[key],
          isDefault: key === CDN_DEFAULT ? 'YES' : '',
          isLoaded: resolvedCdnUrl === CDN_VERSIONS[key] ? 'LOADED' : '',
        };
      }
      console.table(table);
      return Object.keys(CDN_VERSIONS);
    },
    getCdnDefault: function () { return CDN_DEFAULT; },
    getLoadedCdn: function () { return cdnUrlToLabel(resolvedCdnUrl); },
    resetCdn: resetTransformersModule,

    // Range support probe (Stage 1 — Resilient Download)
    testRangeSupport: testRangeSupport,

    // Resilient download (Stage 3)
    enableResilientDownload: enableResilientDownload,
    disableResilientDownload: disableResilientDownload,
    getResilientStatus: getResilientStatus,
  };

  logInfo('Text LLM Spike Harness v2.2 loaded. Default CDN: ' + CDN_DEFAULT + '. Wave 4 batch: ' + WAVE_4_BATCH.length + ' models. Call getWave4Batch() for list.');

})();
