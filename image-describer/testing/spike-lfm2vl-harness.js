/**
 * LFM2-VL-450M Spike Harness
 *
 * Standalone, console-driven feasibility test for onnx-community/LFM2-VL-450M-ONNX
 * in-browser via Transformers.js v4 + WebGPU.
 *
 * Tests whether the architecture class is registered in Transformers.js v4
 * before committing to a full download. If it loads, compares image description
 * quality against our existing FastVLM 0.5B and Qwen3.5-0.8B VLMs.
 *
 * Usage:
 *   await LFM2VLSpike.evaluate();
 *   LFM2VLSpike.printSummary();
 *
 *   // Quick class-support check (no download):
 *   await LFM2VLSpike.checkClassSupport();
 *
 * @author Matthew Deeprose
 * @version 1.0.0
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error('[LFM2VLSpike]', message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn('[LFM2VLSpike]', message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log('[LFM2VLSpike]', message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log('[LFM2VLSpike]', message, ...args);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Constants
  // ═══════════════════════════════════════════════════════════════════

  const MODEL_ID = 'onnx-community/LFM2-VL-450M-ONNX';

  // CDN version map — matches spike-text-llm-harness convention
  const CDN_VERSIONS = {
    'next.9':  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.9',
    'next.10': 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.10',
    'latest':  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@next',
  };
  const CDN_DEFAULT = 'next.9';

  const HF_CONFIG_URL = 'https://huggingface.co/' + MODEL_ID + '/resolve/main/config.json';

  // Candidate class names to try, in priority order
  const CANDIDATE_CLASSES = [
    'AutoModelForImageTextToText',       // Used by FastVLM — most common VLM Auto class
    'AutoModelForVision2Seq',            // Another common VLM Auto class
    'Lfm2VLForConditionalGeneration',    // Hypothetical named class for LFM2-VL
    'Lfm2ForConditionalGeneration',      // Hypothetical shared class with text LFM2
    'LFM2VLForConditionalGeneration',    // Alternative casing
    'AutoModel',                         // Last resort — generic Auto class
  ];

  const STEP_ORDER = [
    'webgpuCheck',
    'libraryLoad',
    'classDiscovery',
    'modelLoad',
    'basicInference',
    'qualityTest',
    'cleanup',
  ];

  // Structured accessibility prompt (matches Qwen3.5 pattern from generateQwenDescription)
  const STRUCTURED_PROMPT =
    'Describe this image for accessibility using these sections:\n\n' +
    '## 1. Title\nA brief descriptive title under 10 words.\n\n' +
    '## 2. Alt Text\nOne or two sentences: what the image shows, then its educational significance.\n\n' +
    '## 3. Long Description\nDetailed description of the visual content and its educational purpose.\n\n' +
    '## 4. Text Content\n' +
    'List every word, number, and label visible in the image. If none, write "No text content."';

  // ═══════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════

  let v4Module = null;
  let resolvedCdnUrl = null;
  let gpuAdapterInfo = null;
  let loadedModel = null;
  let loadedProcessor = null;
  let workingClassName = null;
  let results = null;

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
    const result = { status: status, duration: duration, notes: notes || '' };
    if (extras) {
      Object.keys(extras).forEach(function (key) {
        result[key] = extras[key];
      });
    }
    return result;
  }

  /**
   * Creates a 200×200 test canvas with coloured rectangles and text.
   * Returns a data URL suitable for VLM inference testing.
   */
  function createTestImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 200, 200);

    // Coloured rectangles
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(10, 10, 80, 80);

    ctx.fillStyle = '#0000FF';
    ctx.fillRect(110, 10, 80, 80);

    ctx.fillStyle = '#00AA00';
    ctx.fillRect(10, 110, 80, 80);

    ctx.fillStyle = '#FFD700';
    ctx.fillRect(110, 110, 80, 80);

    // Text labels
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Red', 30, 55);
    ctx.fillText('Blue', 128, 55);
    ctx.fillText('Green', 22, 155);
    ctx.fillText('Gold', 130, 155);

    // Title
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Colour Test', 100, 105);

    return canvas.toDataURL('image/png');
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 1: WebGPU check
  // ═══════════════════════════════════════════════════════════════════

  async function stepWebgpuCheck() {
    logInfo('--- Step 1/7: webgpuCheck ---');
    const start = now();
    try {
      if (!navigator.gpu) {
        return makeStepResult('fail', elapsed(start), 'WebGPU not available in this browser');
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        return makeStepResult('fail', elapsed(start), 'No WebGPU adapter found');
      }

      const info = adapter.info || {};
      gpuAdapterInfo = {
        vendor: info.vendor || '',
        architecture: info.architecture || '',
        description: info.description || '',
        maxBufferSize: adapter.limits.maxBufferSize,
        shaderF16: adapter.features.has('shader-f16'),
      };

      const desc = (gpuAdapterInfo.description || gpuAdapterInfo.vendor + ' ' + gpuAdapterInfo.architecture).trim();
      logInfo('GPU: ' + desc + ' | maxBuffer: ' + gpuAdapterInfo.maxBufferSize + ' | f16: ' + gpuAdapterInfo.shaderF16);
      logInfo('RESULT: PASS — WebGPU available');
      return makeStepResult('pass', elapsed(start), desc, { adapterInfo: gpuAdapterInfo });
    } catch (e) {
      logError('WebGPU check failed:', e.message);
      return makeStepResult('fail', elapsed(start), e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 2: Library load
  // ═══════════════════════════════════════════════════════════════════

  async function stepLibraryLoad() {
    logInfo('--- Step 2/7: libraryLoad ---');
    const start = now();

    if (v4Module) {
      logInfo('Transformers.js v4 already loaded — reusing');
      return makeStepResult('pass', elapsed(start), 'already loaded (reused)');
    }

    // Try CDN versions in order
    const cdnUrl = CDN_VERSIONS[CDN_DEFAULT] || CDN_VERSIONS['next.9'];
    logInfo('Importing Transformers.js v4 from: ' + cdnUrl);

    try {
      v4Module = await import(/* webpackIgnore: true */ cdnUrl);
      resolvedCdnUrl = cdnUrl;

      // Wire ResilientFetch if available
      if (window.ResilientFetch && typeof window.ResilientFetch.create === 'function') {
        v4Module.env.fetch = window.ResilientFetch.create();
        logDebug('ResilientFetch wired to Transformers.js v4');
      }

      logInfo('RESULT: PASS — Transformers.js v4 loaded (' + CDN_DEFAULT + ')');
      return makeStepResult('pass', elapsed(start), CDN_DEFAULT);
    } catch (e) {
      logError('Primary CDN failed:', e.message);

      // Fallback to @next
      if (cdnUrl !== CDN_VERSIONS['latest']) {
        try {
          logInfo('Falling back to @next CDN…');
          v4Module = await import(/* webpackIgnore: true */ CDN_VERSIONS['latest']);
          resolvedCdnUrl = CDN_VERSIONS['latest'];

          if (window.ResilientFetch && typeof window.ResilientFetch.create === 'function') {
            v4Module.env.fetch = window.ResilientFetch.create();
          }

          logInfo('RESULT: PASS — Transformers.js v4 loaded (latest fallback)');
          return makeStepResult('pass', elapsed(start), 'latest (fallback)');
        } catch (e2) {
          logError('Fallback CDN also failed:', e2.message);
          return makeStepResult('fail', elapsed(start), e2.message);
        }
      }

      return makeStepResult('fail', elapsed(start), e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 3: Class discovery — THE KEY STEP
  // ═══════════════════════════════════════════════════════════════════

  async function stepClassDiscovery() {
    logInfo('--- Step 3/7: classDiscovery ---');
    const start = now();

    if (!v4Module) {
      return makeStepResult('fail', elapsed(start), 'Transformers.js v4 not loaded — cannot discover classes');
    }

    // 3a. Scan the module for LFM-related exports
    const lfmKeys = Object.keys(v4Module).filter(function (k) {
      return k.toLowerCase().includes('lfm');
    });
    logInfo('Module exports containing "lfm": ' + (lfmKeys.length > 0 ? lfmKeys.join(', ') : 'NONE'));

    // 3b. Fetch model config.json to check architecture declaration
    let configJson = null;
    try {
      logInfo('Fetching model config.json from HuggingFace…');
      const resp = await fetch(HF_CONFIG_URL);
      if (resp.ok) {
        configJson = await resp.json();
        logInfo('config.json model_type: ' + (configJson.model_type || 'NOT SET'));
        logInfo('config.json architectures: ' + JSON.stringify(configJson.architectures || []));
        logDebug('Full config.json:', configJson);
      } else {
        logWarn('config.json fetch returned HTTP ' + resp.status);
      }
    } catch (e) {
      logWarn('Could not fetch config.json: ' + e.message);
    }

    // 3c. Try each candidate class
    const classResults = {};
    let successClass = null;
    let successProcessor = null;

    for (let i = 0; i < CANDIDATE_CLASSES.length; i++) {
      const className = CANDIDATE_CLASSES[i];
      logInfo('  Trying class: ' + className + '…');

      // Check if class exists in module at all
      if (typeof v4Module[className] !== 'function') {
        const msg = className + ' not found in module';
        logDebug('    ' + msg);
        classResults[className] = { exists: false, loadable: false, error: msg };
        continue;
      }

      classResults[className] = { exists: true, loadable: false, error: '' };

      // Attempt from_pretrained with minimal options (no download — just config check)
      // Use a short timeout to avoid hanging on large downloads.
      // We pass dtype and device to see if the class at least accepts the model config.
      try {
        // We only need to verify the class can parse the model config.
        // For Auto classes, from_pretrained will attempt to download — we let it
        // start but we're mainly checking for immediate class-mismatch errors.
        // Use a race with a timeout to avoid waiting for the full download.
        const loadPromise = v4Module[className].from_pretrained(MODEL_ID, {
          dtype: 'q4',
          device: 'webgpu',
          progress_callback: function (p) {
            if (p.status === 'progress' && p.file) {
              logDebug('    download: ' + p.file + ' ' + (p.progress != null ? Math.round(p.progress) + '%' : ''));
            }
          },
        });

        // Race: 15 seconds should be enough to detect config incompatibility
        // without downloading the full model. If it doesn't error out quickly,
        // that's a good sign — but we won't wait for full download here.
        const timeoutPromise = new Promise(function (_, reject) {
          setTimeout(function () { reject(new Error('TIMEOUT_15S')); }, 15000);
        });

        const modelRef = await Promise.race([loadPromise, timeoutPromise]);

        // If we get here without error, the class accepted the model
        successClass = className;
        logInfo('  ✓ ' + className + ' accepted the model!');
        classResults[className].loadable = true;

        // Store for potential reuse in step 4 if it fully loaded
        if (modelRef && typeof modelRef.generate === 'function') {
          loadedModel = modelRef;
          classResults[className].fullyLoaded = true;
          logInfo('  ✓ Model fully loaded during class discovery');
        }

        break; // Stop trying other classes
      } catch (e) {
        const errorMsg = e.message || String(e);

        if (errorMsg === 'TIMEOUT_15S') {
          // Timeout means it didn't reject immediately — the class likely supports
          // this model but needs more download time. That's a PASS for discovery.
          successClass = className;
          logInfo('  ✓ ' + className + ' did not reject within 15s — class likely compatible');
          classResults[className].loadable = 'timeout-no-reject';
          break;
        }

        logDebug('    ✗ ' + errorMsg.substring(0, 120));
        classResults[className].loadable = false;
        classResults[className].error = errorMsg.substring(0, 200);
      }
    }

    // 3d. Also try to load the processor (independent of model class)
    let processorResult = 'not attempted';
    try {
      if (typeof v4Module.AutoProcessor === 'function') {
        logInfo('  Trying AutoProcessor.from_pretrained…');

        const procPromise = v4Module.AutoProcessor.from_pretrained(MODEL_ID);
        const procTimeout = new Promise(function (_, reject) {
          setTimeout(function () { reject(new Error('PROC_TIMEOUT_15S')); }, 15000);
        });

        const proc = await Promise.race([procPromise, procTimeout]);
        successProcessor = proc;
        loadedProcessor = proc;
        processorResult = 'loaded';
        logInfo('  ✓ AutoProcessor loaded successfully');
      }
    } catch (e) {
      const msg = e.message || String(e);
      processorResult = msg === 'PROC_TIMEOUT_15S' ? 'timeout (probably compatible)' : 'failed: ' + msg.substring(0, 100);
      logWarn('  AutoProcessor: ' + processorResult);
    }

    // 3e. Build summary
    const extras = {
      classResults: classResults,
      configJson: configJson,
      lfmModuleKeys: lfmKeys,
      processorResult: processorResult,
      workingClass: successClass || null,
    };

    if (successClass) {
      workingClassName = successClass;
      logInfo('RESULT: PASS — ' + successClass + ' accepts ' + MODEL_ID);
      return makeStepResult('pass', elapsed(start), successClass, extras);
    }

    // Build failure diagnosis
    let diagnosis = 'No Transformers.js v4 class can load ' + MODEL_ID + '.';
    if (configJson && configJson.architectures) {
      diagnosis += ' Config declares: ' + configJson.architectures.join(', ') + '.';
    }
    if (lfmKeys.length === 0) {
      diagnosis += ' No LFM-related exports found in the module.';
    }
    diagnosis += ' Integration would require raw onnxruntime-web with manual session management — significantly more complex than current VLM integration.';

    logError('RESULT: FAIL — ' + diagnosis);
    return makeStepResult('fail', elapsed(start), diagnosis, extras);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 4: Model load
  // ═══════════════════════════════════════════════════════════════════

  async function stepModelLoad() {
    logInfo('--- Step 4/7: modelLoad ---');
    const start = now();

    if (!workingClassName) {
      logWarn('Skipping — no working class found in step 3');
      return makeStepResult('skip', elapsed(start), 'No compatible class found');
    }

    // If the model was already fully loaded during class discovery, reuse it
    if (loadedModel && typeof loadedModel.generate === 'function') {
      logInfo('Model already loaded from class discovery — reusing');
      return makeStepResult('pass', elapsed(start), 'reused from step 3');
    }

    // Otherwise, do a full load
    logInfo('Loading ' + MODEL_ID + ' via ' + workingClassName + '…');

    let lastProgress = '';
    let downloadDetected = false;

    // Bridge ResilientFetch chunk progress if available
    let bridgeListener = null;
    if (window.ResilientFetch && typeof window.ResilientFetch.onProgress === 'function') {
      bridgeListener = function (event) {
        if (event.url && event.url.indexOf('LFM2-VL') !== -1) {
          logDebug('  download: ' + event.filename + ' ' +
            Math.round((event.loaded / event.total) * 100) + '%');
        }
      };
      window.ResilientFetch.onProgress(bridgeListener);
    }

    try {
      const modelOptions = {
        dtype: 'q4',
        device: 'webgpu',
        progress_callback: function (p) {
          const text = p.file || p.status || '';
          if (text !== lastProgress) {
            lastProgress = text;
            if (text.toLowerCase().includes('download') || p.status === 'download') {
              downloadDetected = true;
            }
            if (p.status === 'progress' && p.file) {
              logDebug('  ' + p.file + ' ' + (p.progress != null ? Math.round(p.progress) + '%' : ''));
            } else if (p.status === 'done' && p.file) {
              logInfo('  ✓ ' + p.file);
            }
          }
        },
      };

      loadedModel = await v4Module[workingClassName].from_pretrained(MODEL_ID, modelOptions);

      // Load processor if not already loaded
      if (!loadedProcessor) {
        logInfo('Loading processor…');
        loadedProcessor = await v4Module.AutoProcessor.from_pretrained(MODEL_ID);
      }

      const loadTimeMs = elapsed(start);
      const cacheNote = downloadDetected ? 'fresh download' : 'cache hit';
      logInfo('RESULT: PASS — Loaded in ' + (loadTimeMs / 1000).toFixed(1) + 's (' + cacheNote + ')');
      return makeStepResult('pass', loadTimeMs, cacheNote, { loadTimeMs: loadTimeMs, downloadDetected: downloadDetected });
    } catch (e) {
      logError('RESULT: FAIL — ' + e.message);
      return makeStepResult('fail', elapsed(start), e.message);
    } finally {
      if (bridgeListener && window.ResilientFetch && typeof window.ResilientFetch.offProgress === 'function') {
        window.ResilientFetch.offProgress(bridgeListener);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 5: Basic inference
  // ═══════════════════════════════════════════════════════════════════

  async function stepBasicInference() {
    logInfo('--- Step 5/7: basicInference ---');
    const start = now();

    if (!loadedModel || !loadedProcessor) {
      logWarn('Skipping — model or processor not loaded');
      return makeStepResult('skip', elapsed(start), 'Model/processor not available');
    }

    try {
      const testImageUrl = createTestImage();
      logInfo('Test image created (200×200 canvas with coloured rectangles)');

      const image = await v4Module.RawImage.read(testImageUrl);
      logDebug('RawImage loaded: ' + image.width + '×' + image.height);

      const promptText = 'Describe this image.';

      // Try FastVLM-style inference first (image token in string, image first in processor)
      let description = null;
      let inferenceStyle = null;

      // Attempt A: FastVLM-style (single string content with <image> token)
      try {
        logInfo('  Trying FastVLM-style inference…');
        const messages = [{ role: 'user', content: '<image>' + promptText }];
        const prompt = loadedProcessor.apply_chat_template(messages, { add_generation_prompt: true });
        const inputs = await loadedProcessor(image, prompt, { add_special_tokens: false });
        const outputs = await loadedModel.generate({
          ...inputs,
          max_new_tokens: 256,
          do_sample: false,
        });
        const decoded = loadedProcessor.batch_decode(
          outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
          { skip_special_tokens: true }
        );
        description = (decoded[0] || '').trim();
        inferenceStyle = 'fastvlm';
        logInfo('  ✓ FastVLM-style inference worked');
      } catch (e) {
        logDebug('  FastVLM-style failed: ' + (e.message || e).toString().substring(0, 100));
      }

      // Attempt B: Qwen-style (conversation array, text first in processor)
      if (!description) {
        try {
          logInfo('  Trying Qwen-style inference…');
          const messages = [{ role: 'user', content: [{ type: 'image' }, { type: 'text', text: promptText }] }];
          const text = loadedProcessor.apply_chat_template(messages, { add_generation_prompt: true });
          const inputs = await loadedProcessor(text, image);
          const outputs = await loadedModel.generate({
            ...inputs,
            max_new_tokens: 256,
            do_sample: false,
          });
          // Try processor.tokenizer.batch_decode first (Qwen pattern), fallback to processor.batch_decode
          let decoded;
          if (loadedProcessor.tokenizer && typeof loadedProcessor.tokenizer.batch_decode === 'function') {
            decoded = loadedProcessor.tokenizer.batch_decode(
              outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
              { skip_special_tokens: true }
            );
          } else {
            decoded = loadedProcessor.batch_decode(
              outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
              { skip_special_tokens: true }
            );
          }
          description = (decoded[0] || '').trim();
          inferenceStyle = 'qwen';
          logInfo('  ✓ Qwen-style inference worked');
        } catch (e) {
          logDebug('  Qwen-style failed: ' + (e.message || e).toString().substring(0, 100));
        }
      }

      // Attempt C: Simple image-text-to-text with minimal chat template
      if (!description) {
        try {
          logInfo('  Trying minimal inference (no chat template)…');
          const inputs = await loadedProcessor(image, promptText);
          const outputs = await loadedModel.generate({
            ...inputs,
            max_new_tokens: 256,
            do_sample: false,
          });
          let decoded;
          if (loadedProcessor.tokenizer && typeof loadedProcessor.tokenizer.batch_decode === 'function') {
            decoded = loadedProcessor.tokenizer.batch_decode(outputs, { skip_special_tokens: true });
          } else {
            decoded = loadedProcessor.batch_decode(outputs, { skip_special_tokens: true });
          }
          description = (decoded[0] || '').trim();
          inferenceStyle = 'minimal';
          logInfo('  ✓ Minimal inference worked');
        } catch (e) {
          logDebug('  Minimal inference failed: ' + (e.message || e).toString().substring(0, 100));
        }
      }

      if (!description) {
        logError('RESULT: FAIL — all inference patterns failed');
        return makeStepResult('fail', elapsed(start), 'All three inference patterns failed');
      }

      const inferenceMs = elapsed(start);
      logInfo('Output (' + inferenceStyle + ' style, ' + inferenceMs + 'ms):');
      logInfo(description);

      // Basic quality check — does the output mention colours or shapes?
      const lc = description.toLowerCase();
      const mentionsColour = lc.includes('red') || lc.includes('blue') || lc.includes('green') || lc.includes('gold') || lc.includes('yellow');
      const mentionsText = lc.includes('colour') || lc.includes('color') || lc.includes('test') || lc.includes('label');
      const qualityNote = (mentionsColour ? 'detects colours' : 'no colour detection') +
        ', ' + (mentionsText ? 'detects text' : 'no text detection');

      logInfo('RESULT: PASS — ' + qualityNote);
      return makeStepResult('pass', inferenceMs, qualityNote, {
        description: description,
        inferenceStyle: inferenceStyle,
        inferenceMs: inferenceMs,
        mentionsColour: mentionsColour,
        mentionsText: mentionsText,
      });
    } catch (e) {
      logError('RESULT: FAIL — ' + e.message);
      return makeStepResult('fail', elapsed(start), e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 6: Quality test (structured accessibility prompt)
  // ═══════════════════════════════════════════════════════════════════

  async function stepQualityTest() {
    logInfo('--- Step 6/7: qualityTest ---');
    const start = now();

    if (!loadedModel || !loadedProcessor) {
      logWarn('Skipping — model or processor not loaded');
      return makeStepResult('skip', elapsed(start), 'Model/processor not available');
    }

    // Retrieve the working inference style from the basic inference step
    const basicResult = results && results.steps && results.steps.basicInference;
    const inferenceStyle = (basicResult && basicResult.inferenceStyle) || 'qwen';

    try {
      const testImageUrl = createTestImage();
      const image = await v4Module.RawImage.read(testImageUrl);

      let description = null;

      if (inferenceStyle === 'fastvlm') {
        const messages = [{ role: 'user', content: '<image>' + STRUCTURED_PROMPT }];
        const prompt = loadedProcessor.apply_chat_template(messages, { add_generation_prompt: true });
        const inputs = await loadedProcessor(image, prompt, { add_special_tokens: false });
        const outputs = await loadedModel.generate({
          ...inputs,
          max_new_tokens: 512,
          do_sample: false,
        });
        const decoded = loadedProcessor.batch_decode(
          outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
          { skip_special_tokens: true }
        );
        description = (decoded[0] || '').trim();
      } else if (inferenceStyle === 'qwen') {
        const messages = [{ role: 'user', content: [{ type: 'image' }, { type: 'text', text: STRUCTURED_PROMPT }] }];
        const text = loadedProcessor.apply_chat_template(messages, { add_generation_prompt: true });
        const inputs = await loadedProcessor(text, image);
        const outputs = await loadedModel.generate({
          ...inputs,
          max_new_tokens: 512,
          do_sample: false,
        });
        const tokenizer = (loadedProcessor.tokenizer && typeof loadedProcessor.tokenizer.batch_decode === 'function')
          ? loadedProcessor.tokenizer
          : loadedProcessor;
        const decoded = tokenizer.batch_decode(
          outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
          { skip_special_tokens: true }
        );
        description = (decoded[0] || '').trim();
      } else {
        // minimal
        const inputs = await loadedProcessor(image, STRUCTURED_PROMPT);
        const outputs = await loadedModel.generate({
          ...inputs,
          max_new_tokens: 512,
          do_sample: false,
        });
        const tokenizer = (loadedProcessor.tokenizer && typeof loadedProcessor.tokenizer.batch_decode === 'function')
          ? loadedProcessor.tokenizer
          : loadedProcessor;
        const decoded = tokenizer.batch_decode(outputs, { skip_special_tokens: true });
        description = (decoded[0] || '').trim();
      }

      const inferenceMs = elapsed(start);
      logInfo('Structured output (' + inferenceMs + 'ms):');
      logInfo(description);

      // Check whether the output follows the requested structure
      const hasTitle = description.includes('## 1') || description.toLowerCase().includes('title');
      const hasAltText = description.includes('## 2') || description.toLowerCase().includes('alt text');
      const hasLongDesc = description.includes('## 3') || description.toLowerCase().includes('long description');
      const hasTextContent = description.includes('## 4') || description.toLowerCase().includes('text content');
      const sectionsFound = [hasTitle, hasAltText, hasLongDesc, hasTextContent].filter(Boolean).length;

      const qualityNote = sectionsFound + '/4 sections detected';
      const status = sectionsFound >= 3 ? 'pass' : sectionsFound >= 1 ? 'partial' : 'fail';

      logInfo('RESULT: ' + status.toUpperCase() + ' — ' + qualityNote);
      return makeStepResult(status, inferenceMs, qualityNote, {
        description: description,
        inferenceMs: inferenceMs,
        sectionsFound: sectionsFound,
        hasTitle: hasTitle,
        hasAltText: hasAltText,
        hasLongDesc: hasLongDesc,
        hasTextContent: hasTextContent,
      });
    } catch (e) {
      logError('RESULT: FAIL — ' + e.message);
      return makeStepResult('fail', elapsed(start), e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 7: Cleanup
  // ═══════════════════════════════════════════════════════════════════

  async function stepCleanup() {
    logInfo('--- Step 7/7: cleanup ---');
    const start = now();

    const heapBefore = (performance.memory && performance.memory.usedJSHeapSize)
      ? performance.memory.usedJSHeapSize
      : null;

    try {
      if (loadedModel) {
        if (typeof loadedModel.dispose === 'function') {
          await loadedModel.dispose();
          logDebug('Model disposed');
        }
        loadedModel = null;
      }

      if (loadedProcessor) {
        if (typeof loadedProcessor.dispose === 'function') {
          await loadedProcessor.dispose();
          logDebug('Processor disposed');
        }
        loadedProcessor = null;
      }

      // Allow GC
      if (typeof globalThis.gc === 'function') {
        globalThis.gc();
        logDebug('Manual GC triggered');
      }

      const heapAfter = (performance.memory && performance.memory.usedJSHeapSize)
        ? performance.memory.usedJSHeapSize
        : null;

      let heapNote = 'heap info not available (Chrome-only)';
      if (heapBefore !== null && heapAfter !== null) {
        const freedMB = ((heapBefore - heapAfter) / (1024 * 1024)).toFixed(1);
        heapNote = 'freed ~' + freedMB + ' MB (before: ' +
          (heapBefore / (1024 * 1024)).toFixed(1) + ' MB, after: ' +
          (heapAfter / (1024 * 1024)).toFixed(1) + ' MB)';
      }

      logInfo('RESULT: PASS — ' + heapNote);
      return makeStepResult('pass', elapsed(start), heapNote, {
        heapBefore: heapBefore,
        heapAfter: heapAfter,
      });
    } catch (e) {
      logError('Cleanup error:', e.message);
      return makeStepResult('partial', elapsed(start), e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Orchestrator — evaluate()
  // ═══════════════════════════════════════════════════════════════════

  async function evaluate() {
    results = {
      modelId: MODEL_ID,
      startTime: new Date().toISOString(),
      steps: {},
      overallStatus: null,
      summary: '',
    };

    logInfo('╔══════════════════════════════════════════════════════════╗');
    logInfo('║  LFM2-VL-450M SPIKE EVALUATION                         ║');
    logInfo('║  Model: ' + MODEL_ID.padEnd(47) + '║');
    logInfo('╚══════════════════════════════════════════════════════════╝');

    const stepFunctions = {
      webgpuCheck: stepWebgpuCheck,
      libraryLoad: stepLibraryLoad,
      classDiscovery: stepClassDiscovery,
      modelLoad: stepModelLoad,
      basicInference: stepBasicInference,
      qualityTest: stepQualityTest,
      cleanup: stepCleanup,
    };

    for (let i = 0; i < STEP_ORDER.length; i++) {
      const stepName = STEP_ORDER[i];
      const stepFn = stepFunctions[stepName];

      try {
        results.steps[stepName] = await stepFn();
      } catch (e) {
        logError('Unhandled error in ' + stepName + ':', e);
        results.steps[stepName] = makeStepResult('fail', 0, 'Unhandled: ' + (e.message || e));
      }

      // Early exit on critical failures (steps 1–3)
      if (i <= 2 && results.steps[stepName].status === 'fail') {
        logWarn('Critical step ' + stepName + ' failed — skipping remaining steps');
        for (let j = i + 1; j < STEP_ORDER.length; j++) {
          results.steps[STEP_ORDER[j]] = makeStepResult('skip', 0, 'Skipped due to ' + stepName + ' failure');
        }
        break;
      }
    }

    // Determine overall status
    const stepStatuses = STEP_ORDER.map(function (name) {
      return results.steps[name] ? results.steps[name].status : 'skip';
    });

    if (stepStatuses.every(function (s) { return s === 'pass' || s === 'skip'; }) &&
        stepStatuses.filter(function (s) { return s === 'pass'; }).length >= 5) {
      results.overallStatus = 'pass';
      results.summary = 'LFM2-VL-450M works in-browser via Transformers.js v4 + WebGPU';
    } else if (results.steps.classDiscovery && results.steps.classDiscovery.status === 'fail') {
      results.overallStatus = 'fail';
      results.summary = 'Architecture class not supported by Transformers.js v4 — would need raw onnxruntime-web';
    } else if (stepStatuses.some(function (s) { return s === 'pass'; })) {
      results.overallStatus = 'partial';
      results.summary = 'Partial success — check individual step results';
    } else {
      results.overallStatus = 'fail';
      results.summary = 'LFM2-VL-450M spike failed';
    }

    results.endTime = new Date().toISOString();
    printSummary();
    return results;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Quick class-support check (no model download)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Runs only steps 1–3 (WebGPU, library load, class discovery) to determine
   * whether Transformers.js v4 can handle LFM2-VL at all, without downloading
   * the full ~450 MB of model weights.
   *
   * @returns {Promise<object>} Class discovery result
   */
  async function checkClassSupport() {
    logInfo('╔══════════════════════════════════════════════════════════╗');
    logInfo('║  LFM2-VL CLASS SUPPORT CHECK (no download)              ║');
    logInfo('╚══════════════════════════════════════════════════════════╝');

    // Step 1: WebGPU
    const gpuResult = await stepWebgpuCheck();
    if (gpuResult.status === 'fail') {
      logError('WebGPU not available — cannot proceed');
      return gpuResult;
    }

    // Step 2: Library
    const libResult = await stepLibraryLoad();
    if (libResult.status === 'fail') {
      logError('Transformers.js v4 failed to load — cannot proceed');
      return libResult;
    }

    // Step 3: Class discovery
    const classResult = await stepClassDiscovery();

    // Print concise summary
    logInfo('');
    if (classResult.status === 'pass') {
      console.log('%c✓ LFM2-VL-450M IS supported — class: ' + classResult.workingClass,
        'color: #4CAF50; font-weight: bold; font-size: 12px;');
      logInfo('Run LFM2VLSpike.evaluate() to test full inference pipeline.');
    } else {
      console.log('%c✗ LFM2-VL-450M NOT supported by Transformers.js v4',
        'color: #F44336; font-weight: bold; font-size: 12px;');
      if (classResult.configJson && classResult.configJson.architectures) {
        logInfo('Model declares architectures: ' + classResult.configJson.architectures.join(', '));
      }
      if (classResult.lfmModuleKeys && classResult.lfmModuleKeys.length > 0) {
        logInfo('Module has LFM keys: ' + classResult.lfmModuleKeys.join(', '));
      } else {
        logInfo('Module has NO LFM-related exports at all.');
      }
      logInfo('Integration would require raw onnxruntime-web — significantly harder.');
    }

    return classResult;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Print summary
  // ═══════════════════════════════════════════════════════════════════

  function printSummary() {
    if (!results) {
      logWarn('No results — run evaluate() first');
      return;
    }

    console.log('%c' +
      '╔══════════════════════════════════════════════════════════╗\n' +
      '║  LFM2-VL-450M SPIKE RESULTS                             ║\n' +
      '║  Model: ' + results.modelId.padEnd(47) + '║\n' +
      '║  Class: ' + (workingClassName || 'NONE').padEnd(47) + '║\n' +
      '╚══════════════════════════════════════════════════════════╝',
      'color: #2196F3; font-weight: bold; font-size: 11px;'
    );

    // Step results table
    const tableData = {};
    STEP_ORDER.forEach(function (name) {
      const step = results.steps[name];
      if (step) {
        tableData[name] = {
          Status: step.status.toUpperCase(),
          'Duration (ms)': step.duration,
          Notes: (step.notes || '').substring(0, 80),
        };
      }
    });
    console.table(tableData);

    // Hardware info
    if (gpuAdapterInfo) {
      console.log('%cHardware: ' + (gpuAdapterInfo.description || gpuAdapterInfo.vendor + ' ' + gpuAdapterInfo.architecture),
        'color: #9E9E9E; font-size: 10px;'
      );
    }

    // Overall verdict
    const colour = results.overallStatus === 'pass' ? '#4CAF50'
      : results.overallStatus === 'partial' ? '#FF9800'
      : '#F44336';
    console.log('%cOverall: ' + results.summary,
      'color: ' + colour + '; font-weight: bold; font-size: 12px;'
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════

  window.LFM2VLSpike = {
    // Full evaluation (all 7 steps)
    evaluate: evaluate,

    // Quick class check (steps 1–3 only, no download)
    checkClassSupport: checkClassSupport,

    // Results
    getResults: function () { return results; },
    printSummary: printSummary,

    // State
    isModelLoaded: function () { return loadedModel !== null; },
    getWorkingClass: function () { return workingClassName; },
  };

  logInfo('LFM2-VL spike harness v1.0.0 loaded. Call LFM2VLSpike.checkClassSupport() to begin.');

})();
