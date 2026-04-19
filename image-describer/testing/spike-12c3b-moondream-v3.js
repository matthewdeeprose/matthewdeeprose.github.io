/**
 * Phase 12C-3b: Moondream2 on Transformers.js v3 — Quick Spike
 *
 * Tests whether Xenova/moondream2 (built for v3) works correctly with the
 * v3 library already loaded by our gateway, after it failed on v4 with:
 * "Number of tokens and features do not match: tokens: 1, features 729"
 *
 * Usage:
 *   MoondreamV3Spike.run()           // use uploaded image or synthetic fallback
 *   MoondreamV3Spike.run(dataUrl)    // use a specific data URL
 *
 * This is a throwaway spike — do NOT integrate into the main codebase.
 */

window.MoondreamV3Spike = (function () {
  // ─── Logging ─────────────────────────────────────────────────────────────────
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error('[MoondreamV3] ' + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn('[MoondreamV3] ' + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log('[MoondreamV3] ' + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log('[MoondreamV3] ' + message, ...args);
  }

  // ─── Constants ───────────────────────────────────────────────────────────────
  const MODEL_ID = 'Xenova/moondream2';
  const V3_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
  const FASTVLM_INFERENCE_MS = 6154; // Phase 12C-3 recorded result
  const PROMPT = 'Describe this image in detail for accessibility purposes. Include the main subject, layout, colours, and any text visible in the image.';
  const MAX_NEW_TOKENS = 256;

  // ─── Timing helpers ──────────────────────────────────────────────────────────
  function now() {
    return performance.now();
  }

  function elapsed(start) {
    return Math.round(performance.now() - start);
  }

  function fmtMs(ms) {
    if (ms === null || ms === undefined) return '?,??? ms';
    if (ms < 1000) return ms + ' ms';
    return (ms / 1000).toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' s';
  }

  // ─── v3 library acquisition ──────────────────────────────────────────────────
  async function getV3Module() {
    const gateway = window.ImageDescriberAnalyserTransformers;

    if (gateway && typeof gateway.ensureLibrary === 'function') {
      logInfo('Using gateway ensureLibrary() to get v3 module');
      const v3 = await gateway.ensureLibrary();
      return { v3, method: 'gateway (ensureLibrary)' };
    }

    logWarn('Gateway not available — falling back to direct CDN import of v3');
    const v3 = await import(/* webpackIgnore: true */ V3_CDN + '/dist/transformers.min.js');
    return { v3, method: 'direct CDN import' };
  }

  // ─── Synthetic test image ─────────────────────────────────────────────────────
  function makeSyntheticCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 320, 240);

    // Red rectangle
    ctx.fillStyle = '#cc2222';
    ctx.fillRect(40, 40, 120, 80);

    // Blue circle
    ctx.fillStyle = '#2244cc';
    ctx.beginPath();
    ctx.arc(230, 100, 50, 0, Math.PI * 2);
    ctx.fill();

    // Text label
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Test Image', 100, 200);

    return canvas;
  }

  function getTestImage(providedDataUrl) {
    if (providedDataUrl) {
      logInfo('Using caller-supplied data URL');
      return { dataUrl: providedDataUrl, isSynthetic: false };
    }

    // Try the preview image already shown in the UI
    const previewImg = document.querySelector('#imgdesc-preview img');
    if (previewImg && previewImg.src && previewImg.src.startsWith('data:')) {
      logInfo('Using uploaded image from #imgdesc-preview img');
      return { dataUrl: previewImg.src, isSynthetic: false };
    }

    logInfo('No image available — generating synthetic canvas (320×240)');
    const canvas = makeSyntheticCanvas();
    return { dataUrl: canvas.toDataURL('image/png'), isSynthetic: true };
  }

  // ─── Output extraction ───────────────────────────────────────────────────────
  function extractAnswer(decoded) {
    // Expected format: "<|endoftext|><image>\n\nQuestion: ...\n\nAnswer: TEXT<|endoftext|>"
    const answerMarker = 'Answer:';
    const eot = '<|endoftext|>';
    const idx = decoded.indexOf(answerMarker);
    if (idx === -1) {
      logWarn('Could not find "Answer:" in decoded output — returning raw text');
      return decoded.replace(new RegExp(eot.replace(/\|/g, '\\|'), 'g'), '').trim();
    }
    let answer = decoded.slice(idx + answerMarker.length);
    // Remove trailing <|endoftext|>
    const eotIdx = answer.lastIndexOf(eot);
    if (eotIdx !== -1) {
      answer = answer.slice(0, eotIdx);
    }
    return answer.trim();
  }

  // ─── Results display ─────────────────────────────────────────────────────────
  function printResults(results, loadMethod) {
    const { success, error, timings, output, outputRaw, isSynthetic } = results;
    const imageLabel = isSynthetic ? 'synthetic (320×240 canvas)' : 'uploaded / provided';

    const bar = '═══════════════════════════════════════════════';
    const thin = '────────────────────────────────────────────────';

    console.log('\n' + bar);
    console.log('  Moondream2 on v3 — Phase 12C-3b');
    console.log(bar);
    console.log('  Model:           ' + MODEL_ID);
    console.log('  Library:         Transformers.js v3.8.1');
    console.log('  Load method:     ' + (loadMethod || 'unknown'));
    console.log('  Device:          webgpu');
    console.log('  Quantisation:    embed_tokens fp16, vision_encoder fp16, decoder q4');
    console.log('  Image:           ' + imageLabel);
    console.log('');

    if (timings) {
      console.log('  Library load:    ' + fmtMs(timings.libraryLoad));
      console.log('  Model load:      ' + fmtMs(timings.modelLoad));
      console.log('  Inference:       ' + fmtMs(timings.inference));
      console.log('  Total:           ' + fmtMs(timings.total));
    }

    console.log('');

    if (!success) {
      console.log('  ❌ FAILED');
      console.log('  Error: ' + error);
      if (outputRaw) {
        console.log('');
        console.log('  Raw decoded output (if any):');
        console.log(thin);
        console.log('  ' + outputRaw);
        console.log(thin);
      }
    } else {
      console.log('  Generated description:');
      console.log(thin);
      if (output) {
        // Word-wrap at ~70 chars for readability
        const words = output.split(' ');
        let line = '  ';
        for (const word of words) {
          if (line.length + word.length > 72) {
            console.log(line);
            line = '  ' + word + ' ';
          } else {
            line += word + ' ';
          }
        }
        if (line.trim()) console.log(line);
      } else {
        console.log('  (no output)');
      }
      console.log(thin);

      console.log('');
      console.log('  Quality checklist (assess manually):');
      console.log('  [ ] Identifies main subjects?');
      console.log('  [ ] Mentions colours correctly?');
      console.log('  [ ] Mentions spatial layout?');
      console.log('  [ ] Detects/transcribes text?');
      console.log('  [ ] Coherent prose (not repetitive)?');
      console.log('  [ ] No hallucinations?');
      console.log('  [ ] Clean output (no prompt leakage)?');
    }

    if (timings && timings.inference !== null && timings.inference !== undefined) {
      console.log('');
      console.log('  Comparison with FastVLM 0.5B (Phase 12C-3):');
      console.log('  FastVLM inference:    ' + fmtMs(FASTVLM_INFERENCE_MS));
      console.log('  Moondream inference:  ' + fmtMs(timings.inference));
      if (timings.inference > 0) {
        const ratio = timings.inference / FASTVLM_INFERENCE_MS;
        if (ratio > 1) {
          console.log('  FastVLM is ' + ratio.toFixed(1) + 'x faster');
        } else {
          console.log('  Moondream is ' + (1 / ratio).toFixed(1) + 'x faster');
        }
      }
    }

    console.log(bar + '\n');
  }

  // ─── Main run function ───────────────────────────────────────────────────────
  async function run(providedDataUrl) {
    logInfo('Starting Moondream2 v3 spike');

    const results = {
      model: MODEL_ID,
      library: 'v3.8.1',
      success: false,
      error: null,
      timings: { libraryLoad: null, modelLoad: null, inference: null, total: null },
      output: null,
      outputRaw: null,
      isSynthetic: false,
    };

    const overallStart = now();
    let loadMethod = 'unknown';

    // Step 1: Get v3 module
    const libStart = now();
    let v3;
    try {
      const result = await getV3Module();
      v3 = result.v3;
      loadMethod = result.method;
      results.timings.libraryLoad = elapsed(libStart);
      logInfo('v3 library acquired in ' + results.timings.libraryLoad + ' ms via ' + loadMethod);
    } catch (err) {
      results.error = 'Failed to acquire v3 library: ' + err.message;
      logError(results.error, err);
      printResults(results, loadMethod);
      return results;
    }

    // Step 2: Pre-flight — check for the architecture class
    const hasClass = typeof v3.Moondream1ForConditionalGeneration === 'function';
    logInfo('Moondream1ForConditionalGeneration in v3: ' + (hasClass ? 'YES ✓' : 'NO ✗'));

    if (!hasClass) {
      results.error = 'Moondream1ForConditionalGeneration not found in v3 module — cannot proceed';
      logError(results.error);
      logDebug('Available classes (sample):', Object.keys(v3).filter(k => k.includes('For') || k.includes('Model')).slice(0, 20));
      printResults(results, loadMethod);
      return results;
    }

    // Step 3: Get test image
    const imageInfo = getTestImage(providedDataUrl);
    results.isSynthetic = imageInfo.isSynthetic;
    logInfo('Image source: ' + (imageInfo.isSynthetic ? 'synthetic' : 'real'));

    // Step 4: Load model components in parallel
    logInfo('Loading processor, tokenizer, and model in parallel...');
    logInfo('(This may take 30–120s on first run — weights download ~900MB total)');

    const modelStart = now();
    let processor, tokenizer, model;

    try {
      const dtypeConfig = {
        embed_tokens: 'fp16',
        vision_encoder: 'fp16',
        decoder_model_merged: 'q4',
      };

      [processor, tokenizer, model] = await Promise.all([
        v3.AutoProcessor.from_pretrained(MODEL_ID),
        v3.AutoTokenizer.from_pretrained(MODEL_ID),
        v3.Moondream1ForConditionalGeneration.from_pretrained(MODEL_ID, {
          dtype: dtypeConfig,
          device: 'webgpu',
        }),
      ]);

      results.timings.modelLoad = elapsed(modelStart);
      logInfo('Model loaded in ' + results.timings.modelLoad + ' ms');
    } catch (err) {
      results.timings.modelLoad = elapsed(modelStart);
      results.error = 'Model load failed: ' + err.message;
      logError('Model load failed after ' + results.timings.modelLoad + ' ms');
      logError('Error:', err.message);
      logError('Stack:', err.stack);
      results.timings.total = elapsed(overallStart);
      printResults(results, loadMethod);
      return results;
    }

    // Step 5: Prepare inputs and run inference
    logInfo('Preparing text inputs...');
    const inferStart = now();

    try {
      // Prepare text inputs — exact format from model card
      const text = `<image>\n\nQuestion: ${PROMPT}\n\nAnswer:`;
      const text_inputs = tokenizer(text);
      logDebug('Text tokenised — input_ids shape:', text_inputs.input_ids?.dims);

      // Prepare vision inputs from data URL
      logInfo('Loading image from data URL...');
      const image = await v3.RawImage.read(imageInfo.dataUrl);
      logDebug('Image loaded — size:', image.width + 'x' + image.height);

      const vision_inputs = await processor(image);
      logDebug('Vision inputs prepared');

      // Generate
      logInfo('Running generate() with max_new_tokens=' + MAX_NEW_TOKENS + '...');
      const output = await model.generate({
        ...text_inputs,
        ...vision_inputs,
        do_sample: false,
        max_new_tokens: MAX_NEW_TOKENS,
      });

      logDebug('generate() complete — output shape:', output?.dims);

      // Decode
      const decoded = tokenizer.batch_decode(output, { skip_special_tokens: false });
      const rawText = Array.isArray(decoded) ? decoded[0] : String(decoded);
      results.outputRaw = rawText;
      logDebug('Raw decoded output:', rawText);

      results.output = extractAnswer(rawText);
      results.timings.inference = elapsed(inferStart);
      results.timings.total = elapsed(overallStart);
      results.success = true;

      logInfo('Inference complete in ' + results.timings.inference + ' ms');
    } catch (err) {
      results.timings.inference = elapsed(inferStart);
      results.timings.total = elapsed(overallStart);
      results.error = err.message;

      // Log the exact error so we can compare with the v4 error
      logError('Inference failed after ' + results.timings.inference + ' ms');
      logError('Exact error message: ' + err.message);
      logError('Stack trace:', err.stack);

      // Flag if it's the same error as v4
      if (err.message && err.message.includes('Number of tokens and features do not match')) {
        logError('⚠ SAME ERROR AS v4 — vision encoder/token merger mismatch on v3 too');
      }
    }

    // Step 6: Print results
    printResults(results, loadMethod);

    return results;
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  logInfo('Spike loaded — call MoondreamV3Spike.run() to start');

  return { run };
})();
