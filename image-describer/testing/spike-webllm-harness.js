/**
 * WebLLM Spike Harness — Core
 *
 * Standalone, console-driven test tool for evaluating whether WebLLM
 * (MLC-AI) can run models that exceed the ONNX + Transformers.js ceiling.
 *
 * Load via <script> in tools.html or paste into browser console.
 *
 * Usage:
 *   await WebLLMSpike.evaluate('Llama-3.2-3B-Instruct-q4f16_1-MLC');
 *   WebLLMSpike.printSummary();
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

  function logError(msg, ...args) { if (shouldLog(LOG_LEVELS.ERROR)) console.error('[WebLLMSpike]', msg, ...args); }
  function logWarn(msg, ...args)  { if (shouldLog(LOG_LEVELS.WARN))  console.warn('[WebLLMSpike]', msg, ...args); }
  function logInfo(msg, ...args)  { if (shouldLog(LOG_LEVELS.INFO))  console.log('[WebLLMSpike]', msg, ...args); }
  function logDebug(msg, ...args) { if (shouldLog(LOG_LEVELS.DEBUG)) console.log('[WebLLMSpike]', msg, ...args); }

  // ═══════════════════════════════════════════════════════════════════
  // Constants
  // ═══════════════════════════════════════════════════════════════════

  const CDN_URLS = [
    'https://esm.run/@mlc-ai/web-llm@0.2.82',
    'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.82/+esm'
  ];

  const KNOWN_MODELS = {
    'Llama-3.2-3B-Instruct-q4f16_1-MLC':  { params: '3B',   vramMB: 2264, priority: 'S', note: 'Primary target — fills 2-3B gap that ONNX cannot' },
    'Llama-3.2-1B-Instruct-q4f16_1-MLC':  { params: '1B',   vramMB: 879,  priority: 'S', note: 'Baseline — compare with ONNX Llama-3.2-1B (44.1 tok/s on RTX 4070)' },
    'Qwen2.5-1.5B-Instruct-q4f16_1-MLC':  { params: '1.5B', vramMB: 1500, priority: 'A', note: 'Qwen2 fails in ONNX (bad_alloc) — does WebLLM bypass this?' },
    'SmolLM2-360M-Instruct-q4f16_1-MLC':  { params: '360M', vramMB: 400,  priority: 'A', note: 'Tiny model, fast sanity check' },
    'Phi-3.5-mini-instruct-q4f16_1-MLC':  { params: '3.8B', vramMB: 2300, priority: 'B', note: 'Compile-hangs in ONNX — WebLLM uses pre-compiled shaders' },
  };

  const DEFAULT_BATCH = [
    'SmolLM2-360M-Instruct-q4f16_1-MLC',
    'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    'Phi-3.5-mini-instruct-q4f16_1-MLC',
  ];

  // Copied exactly from ONNX harness for cross-engine comparison
  const INSTRUCTION_TESTS = [
    {
      name: 'summarise',
      prompt: 'Summarise the following in exactly 2 sentences: The Industrial Revolution, which began in Britain in the late 18th century, transformed economies from agrarian to industrial. New manufacturing processes, including the development of steam power and iron production, led to unprecedented urbanisation. Factories replaced cottage industries, drawing workers from rural areas to cities. This period saw significant social changes, including the rise of a new middle class and the formation of trade unions to protect workers\' rights.',
      check: function (output) {
        const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 10);
        return sentences.length >= 1 && sentences.length <= 4;
      },
      passDescription: '1-4 sentences, on-topic'
    },
    {
      name: 'list',
      prompt: 'List exactly 5 benefits of regular exercise. Number each one.',
      check: function (output) {
        const numbers = output.match(/[1-5][.)]/g);
        return numbers !== null && numbers.length >= 3;
      },
      passDescription: 'At least 3 numbered items'
    },
    {
      name: 'json',
      prompt: 'Write a JSON object with keys "name", "age", "city" for a fictional person. Output ONLY the JSON, nothing else.',
      check: function (output) {
        try {
          const match = output.match(/\{[^}]+\}/);
          if (!match) return false;
          const parsed = JSON.parse(match[0]);
          return 'name' in parsed && 'age' in parsed && 'city' in parsed;
        } catch (e) { return false; }
      },
      passDescription: 'Valid JSON with name, age, city keys'
    },
    {
      name: 'reasoning',
      prompt: 'If a shirt costs £20 and is discounted by 15%, what is the sale price? Show your working.',
      check: function (output) { return output.includes('17') || output.includes('£17'); },
      passDescription: 'Contains "17" (correct answer £17)'
    }
  ];

  const BENCHMARK_PROMPT = 'You are a helpful assistant. Please write a clear, informative paragraph of about 100 words explaining how photosynthesis works in plants. Include the key inputs (water, carbon dioxide, sunlight) and outputs (glucose, oxygen). Keep the language accessible for a university student.';

  const CONTEXT_FILLER_PARAGRAPH = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non prosequuntur, sunt in culpa qui officia deserunt mollit anim id est laborum. ';

  // ═══════════════════════════════════════════════════════════════════
  // Closure state
  // ═══════════════════════════════════════════════════════════════════

  let webllmModule = null;
  let engine = null;
  let results = null;
  let gpuAdapterInfo = null;

  // ═══════════════════════════════════════════════════════════════════
  // Utility helpers
  // ═══════════════════════════════════════════════════════════════════

  function now() { return performance.now(); }
  function elapsed(start) { return Math.round(performance.now() - start); }

  function makeStepResult(status, duration, notes, extras) {
    const result = { status, duration, notes: notes || '' };
    if (extras) Object.assign(result, extras);
    return result;
  }

  const STEP_ORDER = [
    'webgpuCheck', 'libraryLoad', 'modelLoad', 'basicInference',
    'instructionTests', 'streamingTest', 'speedBenchmark',
    'contextTest', 'gpuInfo', 'cleanup'
  ];

  function computeOverallStatus(steps) {
    const critical = ['webgpuCheck', 'libraryLoad', 'modelLoad'];
    if (critical.some(n => steps[n] && steps[n].status === 'fail')) return 'fail';
    if (STEP_ORDER.every(n => !steps[n] || steps[n].status === 'pass' || steps[n].status === 'skip')) return 'pass';
    return 'partial';
  }

  function computeSummary(res) {
    const status = res.overallStatus.toUpperCase();
    const loadTime = res.steps.modelLoad?.loadTimeMs
      ? (res.steps.modelLoad.loadTimeMs / 1000).toFixed(1) + 's' : 'N/A';
    const speed = res.steps.speedBenchmark?.tokensPerSecond
      ? res.steps.speedBenchmark.tokensPerSecond.toFixed(1) + ' tok/s' : 'N/A';
    return status + ' | Load: ' + loadTime + ' | Speed: ' + speed;
  }

  function markRemainingSkipped(steps, failedStep) {
    const idx = STEP_ORDER.indexOf(failedStep);
    for (let i = idx + 1; i < STEP_ORDER.length; i++) {
      if (!steps[STEP_ORDER[i]]) {
        steps[STEP_ORDER[i]] = makeStepResult('skip', 0, 'Skipped due to ' + failedStep + ' failure');
      }
    }
  }

  function getHeapMB() {
    return performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 1: WebGPU Check
  // ═══════════════════════════════════════════════════════════════════

  async function stepWebgpuCheck() {
    logInfo('--- Step 1/10: webgpuCheck ---');
    const start = now();
    try {
      if (!navigator.gpu) return makeStepResult('fail', elapsed(start), 'WebGPU not available');
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return makeStepResult('fail', elapsed(start), 'No WebGPU adapter found');

      const info = adapter.info || {};
      gpuAdapterInfo = {
        vendor: info.vendor || '', architecture: info.architecture || '',
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
  // Step 2: Library Load
  // ═══════════════════════════════════════════════════════════════════

  async function stepLibraryLoad() {
    logInfo('--- Step 2/10: libraryLoad ---');
    const start = now();
    if (webllmModule) {
      logInfo('WebLLM already loaded — reusing cached module');
      return makeStepResult('pass', elapsed(start), 'Cached');
    }
    for (let i = 0; i < CDN_URLS.length; i++) {
      try {
        logDebug('Trying CDN: ' + CDN_URLS[i]);
        webllmModule = await import(CDN_URLS[i]);
        logInfo('RESULT: PASS — Loaded from CDN ' + (i + 1) + ' (' + elapsed(start) + 'ms)');
        return makeStepResult('pass', elapsed(start), 'CDN ' + (i + 1));
      } catch (e) { logWarn('CDN ' + (i + 1) + ' failed: ' + e.message); }
    }
    logError('RESULT: FAIL — All CDN URLs failed');
    return makeStepResult('fail', elapsed(start), 'All CDN URLs failed');
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 3: Model Load
  // ═══════════════════════════════════════════════════════════════════

  async function stepModelLoad(modelId) {
    logInfo('--- Step 3/10: modelLoad ---');
    const start = now();
    let lastProgress = '';
    let downloadDetected = false;
    try {
      engine = await webllmModule.CreateMLCEngine(modelId, {
        initProgressCallback: (progress) => {
          const text = progress.text || '';
          if (text !== lastProgress) {
            lastProgress = text;
            if (text.toLowerCase().includes('download')) downloadDetected = true;
            logDebug('  ' + text + (progress.progress != null ? ' (' + (progress.progress * 100).toFixed(0) + '%)' : ''));
          }
        }
      });
      const loadTimeMs = elapsed(start);
      const cacheNote = downloadDetected ? 'fresh download' : 'cache hit';
      logInfo('RESULT: PASS — Loaded in ' + (loadTimeMs / 1000).toFixed(1) + 's (' + cacheNote + ')');
      return makeStepResult('pass', loadTimeMs, cacheNote, { loadTimeMs, downloadDetected });
    } catch (e) {
      logError('RESULT: FAIL — ' + e.message);
      return makeStepResult('fail', elapsed(start), e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 4: Basic Inference
  // ═══════════════════════════════════════════════════════════════════

  async function stepBasicInference() {
    logInfo('--- Step 4/10: basicInference ---');
    const start = now();
    try {
      await engine.resetChat();
      const reply = await engine.chat.completions.create({
        messages: [{ role: 'user', content: 'What is the capital of France?' }],
        temperature: 0, max_tokens: 128
      });
      const text = reply.choices[0].message.content || '';
      const pass = text.toLowerCase().includes('paris');
      logInfo('Output (' + text.length + ' chars): ' + text.substring(0, 120));
      logInfo('RESULT: ' + (pass ? 'PASS' : 'FAIL') + ' — ' + (pass ? 'Contains "Paris"' : 'Missing "Paris"'));
      return makeStepResult(pass ? 'pass' : 'fail', elapsed(start), text.substring(0, 100), { output: text, usage: reply.usage });
    } catch (e) {
      logError('RESULT: FAIL — ' + e.message);
      return makeStepResult('fail', elapsed(start), e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 5: Instruction Tests
  // ═══════════════════════════════════════════════════════════════════

  async function stepInstructionTests() {
    logInfo('--- Step 5/10: instructionTests ---');
    const start = now();
    let passCount = 0;
    const testResults = [];
    for (const test of INSTRUCTION_TESTS) {
      try {
        await engine.resetChat();
        const reply = await engine.chat.completions.create({
          messages: [{ role: 'user', content: test.prompt }],
          temperature: 0, max_tokens: 512
        });
        const output = reply.choices[0].message.content || '';
        const pass = test.check(output);
        if (pass) passCount++;
        testResults.push({ name: test.name, pass, output: output.substring(0, 80) });
        logInfo('  ' + test.name + ': ' + (pass ? 'PASS' : 'FAIL') + ' (' + test.passDescription + ')');
        logDebug('    Output: ' + output.substring(0, 100));
      } catch (e) {
        testResults.push({ name: test.name, pass: false, error: e.message });
        logError('  ' + test.name + ': ERROR — ' + e.message);
      }
    }
    const score = passCount + '/' + INSTRUCTION_TESTS.length;
    const status = passCount === INSTRUCTION_TESTS.length ? 'pass' : passCount > 0 ? 'partial' : 'fail';
    logInfo('RESULT: ' + status.toUpperCase() + ' — ' + score);
    return makeStepResult(status, elapsed(start), score, { passCount, testResults });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 6: Streaming Test
  // ═══════════════════════════════════════════════════════════════════

  async function stepStreamingTest() {
    logInfo('--- Step 6/10: streamingTest ---');
    const start = now();
    try {
      await engine.resetChat();
      const stream = await engine.chat.completions.create({
        messages: [{ role: 'user', content: 'Explain gravity in 3 sentences.' }],
        temperature: 0, max_tokens: 256,
        stream: true, stream_options: { include_usage: true }
      });
      let chunkCount = 0, fullText = '', firstTokenTime = null, usage = null;
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta && !firstTokenTime) firstTokenTime = now();
        fullText += delta;
        chunkCount++;
        if (chunk.usage) usage = chunk.usage;
      }
      const ttft = firstTokenTime ? Math.round(firstTokenTime - start) : null;
      const pass = chunkCount >= 10;
      logInfo('Chunks: ' + chunkCount + ' | TTFT: ' + (ttft || 'N/A') + 'ms | Length: ' + fullText.length);
      logInfo('RESULT: ' + (pass ? 'PASS' : 'FAIL') + ' — ' + chunkCount + ' chunks');
      return makeStepResult(pass ? 'pass' : 'fail', elapsed(start),
        chunkCount + ' chunks, TTFT ' + (ttft || 'N/A') + 'ms',
        { chunkCount, ttft, usage, outputLength: fullText.length });
    } catch (e) {
      logError('RESULT: FAIL — ' + e.message);
      return makeStepResult('fail', elapsed(start), e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 7: Speed Benchmark
  // ═══════════════════════════════════════════════════════════════════

  async function stepSpeedBenchmark() {
    logInfo('--- Step 7/10: speedBenchmark ---');
    const start = now();
    const runs = [];
    try {
      for (let i = 0; i < 3; i++) {
        await engine.resetChat();
        const runStart = now();
        const reply = await engine.chat.completions.create({
          messages: [{ role: 'user', content: BENCHMARK_PROMPT }],
          temperature: 0, max_tokens: 256
        });
        const wallSec = (now() - runStart) / 1000;
        const tokens = reply.usage ? reply.usage.completion_tokens : 0;
        const tokPerSec = tokens > 0 ? Math.round((tokens / wallSec) * 10) / 10 : 0;
        runs.push({ tokPerSec, tokens, wallSec: Math.round(wallSec * 10) / 10 });
        logDebug('  Run ' + (i + 1) + ': ' + tokPerSec + ' tok/s (' + tokens + ' tokens in ' + runs[i].wallSec + 's)');
      }
      const sorted = runs.map(r => r.tokPerSec).sort((a, b) => a - b);
      const median = sorted[1];
      logInfo('RESULT: PASS — Median ' + median + ' tok/s (runs: ' + sorted.join(', ') + ')');
      return makeStepResult('pass', elapsed(start), median + ' tok/s median', { tokensPerSecond: median, runs });
    } catch (e) {
      logError('RESULT: FAIL — ' + e.message);
      return makeStepResult('fail', elapsed(start), e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 8: Context Test (~4096 tokens)
  // ═══════════════════════════════════════════════════════════════════

  async function stepContextTest() {
    logInfo('--- Step 8/10: contextTest ---');
    const start = now();
    try {
      // ~4096 tokens: paragraph is ~452 chars, ~113 tokens. 36 repeats ≈ ~4068 tokens
      const filler = CONTEXT_FILLER_PARAGRAPH.repeat(36);
      const prompt = 'Read the following text, then answer the question at the end.\n\n' +
        filler + '\n\nQuestion: What colour is the sky on a clear day? Answer in one word.';
      await engine.resetChat();
      const reply = await engine.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0, max_tokens: 64
      });
      const text = reply.choices[0].message.content || '';
      const promptTokens = reply.usage ? reply.usage.prompt_tokens : 0;
      const pass = text.length > 0;
      logInfo('Prompt tokens: ' + promptTokens + ' | Output: ' + text.substring(0, 60));
      logInfo('RESULT: ' + (pass ? 'PASS' : 'FAIL'));
      return makeStepResult(pass ? 'pass' : 'fail', elapsed(start),
        promptTokens + ' prompt tokens', { promptTokens, output: text.substring(0, 100) });
    } catch (e) {
      logError('RESULT: FAIL — ' + e.message);
      return makeStepResult('fail', elapsed(start), e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 9: GPU Info (from engine)
  // ═══════════════════════════════════════════════════════════════════

  async function stepGpuInfo() {
    logInfo('--- Step 9/10: gpuInfo ---');
    const start = now();
    try {
      const vendor = engine.getGPUVendor ? engine.getGPUVendor() : 'N/A';
      const maxBuffer = engine.getMaxStorageBufferBindingSize ? engine.getMaxStorageBufferBindingSize() : 'N/A';
      logInfo('GPU Vendor (engine): ' + vendor + ' | Max buffer: ' + maxBuffer);
      logInfo('RESULT: PASS');
      return makeStepResult('pass', elapsed(start), 'vendor: ' + vendor, { vendor, maxBuffer });
    } catch (e) {
      logWarn('RESULT: PARTIAL — ' + e.message);
      return makeStepResult('partial', elapsed(start), e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Step 10: Cleanup — test whether unload() frees GPU memory
  // ═══════════════════════════════════════════════════════════════════

  async function stepCleanup() {
    logInfo('--- Step 10/10: cleanup ---');
    const start = now();
    const heapBefore = getHeapMB();
    try {
      if (engine) { await engine.unload(); engine = null; }
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief GC window
      const heapAfter = getHeapMB();
      const heapNote = (heapBefore != null && heapAfter != null)
        ? 'Heap: ' + heapBefore + 'MB -> ' + heapAfter + 'MB (delta: ' + (heapAfter - heapBefore) + 'MB)'
        : 'performance.memory not available';
      logInfo(heapNote);
      logInfo('NOTE: Check browser Task Manager (Shift+Esc) for GPU process memory to verify VRAM release');
      logInfo('RESULT: PASS — engine.unload() completed');
      return makeStepResult('pass', elapsed(start), heapNote, { heapBeforeMB: heapBefore, heapAfterMB: heapAfter });
    } catch (e) {
      engine = null;
      logError('RESULT: FAIL — ' + e.message);
      return makeStepResult('fail', elapsed(start), e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Main evaluation orchestrator
  // ═══════════════════════════════════════════════════════════════════

  async function evaluate(modelId) {
    if (!modelId || typeof modelId !== 'string') {
      logError('evaluate() requires a model ID string, e.g. "Llama-3.2-3B-Instruct-q4f16_1-MLC"');
      return null;
    }

    const modelInfo = KNOWN_MODELS[modelId];
    logInfo('╔══════════════════════════════════════════════════════════╗');
    logInfo('║  WEBLLM SPIKE EVALUATION                                ║');
    logInfo('║  Model: ' + modelId);
    if (modelInfo) logInfo('║  Params: ' + modelInfo.params + ' | VRAM est: ~' + modelInfo.vramMB + 'MB');
    logInfo('╚══════════════════════════════════════════════════════════╝');

    results = {
      modelId, timestamp: new Date().toISOString(),
      steps: { webgpuCheck: null, libraryLoad: null, modelLoad: null, basicInference: null,
        instructionTests: null, streamingTest: null, speedBenchmark: null,
        contextTest: null, gpuInfo: null, cleanup: null },
      overallStatus: '', summary: ''
    };

    // Step 1: WebGPU — critical
    results.steps.webgpuCheck = await stepWebgpuCheck();
    if (results.steps.webgpuCheck.status === 'fail') {
      logError('Critical: no WebGPU. Skipping remaining steps.');
      markRemainingSkipped(results.steps, 'webgpuCheck');
      finaliseResults(); return results;
    }

    // Step 2: Library — critical
    results.steps.libraryLoad = await stepLibraryLoad();
    if (results.steps.libraryLoad.status === 'fail') {
      logError('Critical: library load failed. Skipping remaining steps.');
      markRemainingSkipped(results.steps, 'libraryLoad');
      finaliseResults(); return results;
    }

    // Step 3: Model — critical
    results.steps.modelLoad = await stepModelLoad(modelId);
    if (results.steps.modelLoad.status === 'fail') {
      logError('Critical: model load failed. Skipping remaining steps.');
      markRemainingSkipped(results.steps, 'modelLoad');
      finaliseResults(); return results;
    }

    // Steps 4-10: non-critical
    results.steps.basicInference = await stepBasicInference();
    results.steps.instructionTests = await stepInstructionTests();
    results.steps.streamingTest = await stepStreamingTest();
    results.steps.speedBenchmark = await stepSpeedBenchmark();
    results.steps.contextTest = await stepContextTest();
    results.steps.gpuInfo = await stepGpuInfo();
    results.steps.cleanup = await stepCleanup();

    finaliseResults();
    return results;
  }

  function finaliseResults() {
    results.overallStatus = computeOverallStatus(results.steps);
    results.summary = computeSummary(results);
    logInfo('');
    logInfo('════════════════════════════════════════════════════════════');
    logInfo('  EVALUATION COMPLETE: ' + results.summary);
    logInfo('════════════════════════════════════════════════════════════');
    logInfo('');
    logInfo('Call WebLLMSpike.printSummary() for detailed results table.');
  }

  // ═══════════════════════════════════════════════════════════════════
  // Results display
  // ═══════════════════════════════════════════════════════════════════

  function printSummary() {
    if (!results) { logWarn('No results available. Run evaluate() first.'); return; }

    const modelInfo = KNOWN_MODELS[results.modelId] || {};
    console.log('%c' +
      '╔══════════════════════════════════════════════════════════╗\n' +
      '║  WEBLLM SPIKE RESULTS                                    ║\n' +
      '║  Model: ' + results.modelId.padEnd(47) + '║\n' +
      '║  Params: ' + (modelInfo.params || '?').padEnd(46) + '║\n' +
      '╚══════════════════════════════════════════════════════════╝',
      'color: #2196F3; font-weight: bold; font-size: 11px;'
    );
    const tableData = {};
    STEP_ORDER.forEach(name => {
      const step = results.steps[name];
      if (step) tableData[name] = {
        Status: step.status.toUpperCase(), 'Duration (ms)': step.duration,
        Notes: (step.notes || '').substring(0, 60),
      };
    });
    console.table(tableData);
    console.log('%cOverall: ' + results.summary,
      'color: ' + (results.overallStatus === 'pass' ? '#4CAF50' :
        results.overallStatus === 'partial' ? '#FF9800' : '#F44336') +
      '; font-weight: bold; font-size: 12px;'
    );
    if (gpuAdapterInfo) {
      console.log('%cGPU: ' + (gpuAdapterInfo.description || gpuAdapterInfo.vendor + ' ' + gpuAdapterInfo.architecture).trim(),
        'color: #9E9E9E; font-size: 10px;');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Model listing
  // ═══════════════════════════════════════════════════════════════════

  function listKnownModels() {
    const tableData = {};
    for (const id in KNOWN_MODELS) {
      const m = KNOWN_MODELS[id];
      tableData[id] = { Params: m.params, 'VRAM (MB)': m.vramMB, Priority: m.priority, Note: m.note };
    }
    console.table(tableData);
    logInfo('Use: await WebLLMSpike.evaluate("Llama-3.2-3B-Instruct-q4f16_1-MLC")');
    return KNOWN_MODELS;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Batch evaluation
  // ═══════════════════════════════════════════════════════════════════

  let batchResults = null;

  async function batchEvaluate(options) {
    const config = Object.assign({
      models: DEFAULT_BATCH,
      skipOnFail: true,
      cooldownMs: 3000,
      startFrom: 1,
    }, options || {});

    const modelList = config.models;
    const totalModels = modelList.length;
    const startIndex = Math.max(0, Math.min(config.startFrom - 1, totalModels - 1));
    const batchStartTime = now();

    // Pre-flight: ensure WebGPU + library are available
    if (!gpuAdapterInfo) await stepWebgpuCheck();
    if (!webllmModule) await stepLibraryLoad();

    const gpuDesc = gpuAdapterInfo
      ? (gpuAdapterInfo.description || gpuAdapterInfo.vendor + ' ' + gpuAdapterInfo.architecture).trim()
      : 'Unknown';

    logInfo('');
    logInfo('╔══════════════════════════════════════════════════════════╗');
    logInfo('║  WEBLLM BATCH EVALUATION                                ║');
    logInfo('║  Models: ' + totalModels + (startIndex > 0 ? ' (starting from ' + config.startFrom + ')' : ''));
    logInfo('║  GPU: ' + gpuDesc.substring(0, 48));
    logInfo('╚══════════════════════════════════════════════════════════╝');
    logInfo('');

    batchResults = {
      batchId: 'webllm-' + new Date().toISOString(),
      engine: 'webllm',
      engineVersion: '0.2.82',
      machine: {
        gpu: gpuDesc,
        gpuVendor: gpuAdapterInfo ? gpuAdapterInfo.vendor : '',
        maxBufferSize: gpuAdapterInfo ? gpuAdapterInfo.maxBufferSize : null,
        shaderF16: gpuAdapterInfo ? gpuAdapterInfo.shaderF16 : false,
        browser: navigator.userAgent.match(/Chrome\/(\d+)/)?.[0] || navigator.userAgent.substring(0, 50),
        timestamp: new Date().toISOString(),
      },
      totalElapsedMs: 0,
      results: [],
    };

    // Log skipped models when using startFrom
    for (let s = 0; s < startIndex; s++) {
      const skippedId = modelList[s];
      const skippedInfo = KNOWN_MODELS[skippedId];
      logInfo('[Batch] Model ' + (s + 1) + '/' + totalModels + ': ' + skippedId + ' — SKIPPED (startFrom: ' + config.startFrom + ')');
      batchResults.results.push({
        modelId: skippedId, sizeNote: skippedInfo ? skippedInfo.params : '?',
        status: 'skipped', overallStatus: 'skipped', tokensPerSecond: 0,
        loadTimeSec: 0, contextTestPassed: false, instructionScore: '--',
        streamingWorks: false, error: 'Skipped (startFrom: ' + config.startFrom + ')', elapsedMs: 0,
      });
    }

    for (let i = startIndex; i < totalModels; i++) {
      const modelId = modelList[i];
      const modelNum = i + 1;
      const modelInfo = KNOWN_MODELS[modelId] || {};
      const sizeNote = modelInfo.params || '?';

      logInfo('');
      logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logInfo('[Batch] Model ' + modelNum + '/' + totalModels + ': ' + modelId + ' (' + sizeNote + ')');
      logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const modelStartTime = now();
      const modelResult = {
        modelId, sizeNote, status: 'fail', tokensPerSecond: 0, loadTimeSec: 0,
        contextTestPassed: false, instructionScore: '0/4', streamingWorks: false,
        overallStatus: 'fail', error: null, elapsedMs: 0,
      };

      try {
        const evalResult = await evaluate(modelId);
        if (evalResult) {
          modelResult.status = evalResult.overallStatus || 'fail';
          modelResult.overallStatus = evalResult.overallStatus || 'fail';
          if (evalResult.steps.speedBenchmark?.tokensPerSecond) {
            modelResult.tokensPerSecond = Math.round(evalResult.steps.speedBenchmark.tokensPerSecond * 10) / 10;
          }
          if (evalResult.steps.modelLoad?.loadTimeMs) {
            modelResult.loadTimeSec = Math.round(evalResult.steps.modelLoad.loadTimeMs / 100) / 10;
          }
          if (evalResult.steps.contextTest) {
            modelResult.contextTestPassed = evalResult.steps.contextTest.status === 'pass';
          }
          if (evalResult.steps.instructionTests?.passCount !== undefined) {
            modelResult.instructionScore = evalResult.steps.instructionTests.passCount + '/4';
          }
          if (evalResult.steps.streamingTest) {
            modelResult.streamingWorks = evalResult.steps.streamingTest.status === 'pass';
          }
        }
      } catch (err) {
        modelResult.error = err.message || String(err);
        logError('[Batch] Model ' + modelNum + '/' + totalModels + ': EXCEPTION — ' + modelResult.error);
      }

      modelResult.elapsedMs = Math.round(now() - modelStartTime);
      logInfo('[Batch] Model ' + modelNum + '/' + totalModels + ': ' + modelId +
        ' — ' + modelResult.status.toUpperCase() +
        ' (' + (modelResult.elapsedMs / 1000).toFixed(1) + 's' +
        (modelResult.tokensPerSecond ? ', ' + modelResult.tokensPerSecond + ' tok/s' : '') + ')');

      batchResults.results.push(modelResult);

      // Safety net: ensure engine is unloaded
      if (engine) {
        logWarn('[Batch] Engine still loaded after evaluate — forcing cleanup');
        try { await engine.unload(); engine = null; } catch (e) { /* ignore */ }
      }

      // Cooldown between models (skip after last)
      if (i < totalModels - 1) {
        logDebug('[Batch] Cooldown ' + config.cooldownMs + 'ms for GPU memory release...');
        await new Promise(resolve => setTimeout(resolve, config.cooldownMs));
      }
    }

    batchResults.totalElapsedMs = Math.round(now() - batchStartTime);
    printBatchSummary();
    return batchResults;
  }

  function printBatchSummary() {
    if (!batchResults || !batchResults.results.length) { logWarn('No batch results available.'); return; }

    logInfo('');
    logInfo('╔══════════════════════════════════════════════════════════╗');
    logInfo('║  BATCH EVALUATION COMPLETE                               ║');
    logInfo('║  GPU: ' + (batchResults.machine.gpu || 'Unknown').substring(0, 48));
    logInfo('║  Total time: ' + (batchResults.totalElapsedMs / 1000 / 60).toFixed(1) + ' minutes');
    logInfo('╚══════════════════════════════════════════════════════════╝');
    logInfo('');

    const tableData = {};
    batchResults.results.forEach(r => {
      tableData[r.modelId] = {
        Status: r.status.toUpperCase(), 'tok/s': r.tokensPerSecond || '--',
        Size: r.sizeNote || '?', 'Load (s)': r.loadTimeSec || '--',
        'Ctx 4096': r.contextTestPassed ? 'PASS' : 'FAIL',
        Instruct: r.instructionScore, Stream: r.streamingWorks ? 'YES' : 'NO',
        Error: r.error ? r.error.substring(0, 30) : '',
      };
    });
    console.table(tableData);

    const passed = batchResults.results.filter(r => r.status === 'pass').length;
    const partial = batchResults.results.filter(r => r.status === 'partial').length;
    const failed = batchResults.results.filter(r => r.status === 'fail').length;
    logInfo('Results: ' + passed + ' passed, ' + partial + ' partial, ' + failed + ' failed');
    logInfo('');
    logInfo('Call WebLLMSpike.exportBatchJSON() to get the full results as copy-paste JSON.');
  }

  function exportBatchJSON() {
    if (!batchResults) { logWarn('No batch results available. Run batchEvaluate() first.'); return null; }
    const json = JSON.stringify(batchResults, null, 2);
    logInfo('Batch results JSON (' + json.length + ' chars):');
    console.log(json);
    return json;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════

  window.WebLLMSpike = {
    // Core
    evaluate,
    printSummary,

    // Batch
    batchEvaluate,
    printBatchSummary,
    exportBatchJSON,

    // Utilities
    listKnownModels,
    getResults: function () { return results; },
    getBatchResults: function () { return batchResults; },
    getDefaultBatch: function () { return DEFAULT_BATCH.slice(); },
  };

  logInfo('WebLLM Spike Harness v1.0.0 loaded. Call WebLLMSpike.listKnownModels() to begin.');

})();
