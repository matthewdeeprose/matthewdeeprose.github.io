// Phase 6 — Local Text Gateway & Registry Tests
// Registers with the Phase 9A test runner.
// Run structural (instant):    await LocalTextGatewayTests.runStructural()
// Run integration (GPU):       await LocalTextGatewayTests.runIntegration()
// Run everything:              await LocalTextGatewayTests.runAll()

(function () {
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
        if (shouldLog(LOG_LEVELS.ERROR)) console.error.apply(console, ['[LocalTextTests]', message].concat(args));
    }
    function logWarn(message) {
        var args = Array.prototype.slice.call(arguments, 1);
        if (shouldLog(LOG_LEVELS.WARN)) console.warn.apply(console, ['[LocalTextTests]', message].concat(args));
    }
    function logInfo(message) {
        var args = Array.prototype.slice.call(arguments, 1);
        if (shouldLog(LOG_LEVELS.INFO)) console.log.apply(console, ['[LocalTextTests]', message].concat(args));
    }
    function logDebug(message) {
        var args = Array.prototype.slice.call(arguments, 1);
        if (shouldLog(LOG_LEVELS.DEBUG)) console.log.apply(console, ['[LocalTextTests]', message].concat(args));
    }

    // ── Guard: test runner must be loaded ───────────────────────────────
    if (typeof window.ImageDescriberTests === 'undefined') {
        logWarn('Test runner not loaded — skipping registration.');
        return;
    }

    // ── Convenience references ─────────────────────────────────────────
    const registry = window.LocalTextModelRegistry;
    const gateway = window.LocalTextModelGateway;

    // ========================================================================
    // GROUP A: STRUCTURAL TESTS (instant, no model downloads)
    // ========================================================================

    // ── A1: Registry Tests ─────────────────────────────────────────────
    window.ImageDescriberTests.register('local-text-registry', {
        name: 'Local Text Registry (Phase 6)',
        tests: {

            'getAll() returns exactly 3 models': function (assert) {
                assert.assertNotNull(registry, 'Registry should be loaded on window');
                var models = registry.getAll();
                assert.assertTrue(Array.isArray(models), 'Should return an array');
                assert.assertEqual(models.length, 3, 'Should have exactly 3 models');
            },

            'All models have required technical fields': function (assert) {
                var models = registry.getAll();
                var requiredFields = ['key', 'localModelId', 'hfModelId', 'className', 'quantisation', 'contextLimit', 'enabled'];

                for (var i = 0; i < models.length; i++) {
                    var model = models[i];
                    for (var j = 0; j < requiredFields.length; j++) {
                        var field = requiredFields[j];
                        assert.assertTrue(
                            model[field] !== undefined,
                            'Model "' + model.key + '" should have field "' + field + '"'
                        );
                    }
                }
            },

            'All models have userInfo with required fields': function (assert) {
                var models = registry.getAll();
                var requiredUserFields = [
                    'displayName', 'provider', 'parameterCount', 'licence',
                    'downloadSizeMB', 'summary', 'strengths', 'weaknesses', 'bestFor', 'benchmarks'
                ];

                for (var i = 0; i < models.length; i++) {
                    var model = models[i];
                    assert.assertNotNull(model.userInfo, 'Model "' + model.key + '" should have userInfo');
                    for (var j = 0; j < requiredUserFields.length; j++) {
                        var field = requiredUserFields[j];
                        assert.assertTrue(
                            model.userInfo[field] !== undefined,
                            'Model "' + model.key + '" userInfo should have field "' + field + '"'
                        );
                    }
                }
            },

            'All benchmarks have entries for all 5 hardware classes': function (assert) {
                var models = registry.getAll();
                var hardwareClasses = ['vega-10-igpu', 'gtx-1650-super', 'radeon-780m-igpu', 'rtx-4060', 'rtx-4070'];

                for (var i = 0; i < models.length; i++) {
                    var model = models[i];
                    var benchmarks = model.userInfo.benchmarks;
                    assert.assertNotNull(benchmarks, 'Model "' + model.key + '" should have benchmarks');

                    for (var h = 0; h < hardwareClasses.length; h++) {
                        var hw = hardwareClasses[h];
                        assert.assertNotNull(
                            benchmarks[hw],
                            'Model "' + model.key + '" should have benchmark for "' + hw + '"'
                        );
                    }
                }
            },

            'Each benchmark entry has tokPerSec, contextSafe, loadTimeSec': function (assert) {
                var models = registry.getAll();
                var hardwareClasses = ['vega-10-igpu', 'gtx-1650-super', 'radeon-780m-igpu', 'rtx-4060', 'rtx-4070'];
                var requiredBenchmarkFields = ['tokPerSec', 'contextSafe', 'loadTimeSec'];

                for (var i = 0; i < models.length; i++) {
                    var model = models[i];
                    for (var h = 0; h < hardwareClasses.length; h++) {
                        var entry = model.userInfo.benchmarks[hardwareClasses[h]];
                        for (var f = 0; f < requiredBenchmarkFields.length; f++) {
                            assert.assertTrue(
                                entry[requiredBenchmarkFields[f]] !== undefined,
                                model.key + '/' + hardwareClasses[h] + ' should have "' + requiredBenchmarkFields[f] + '"'
                            );
                        }
                    }
                }
            },

            'Model keys are unique': function (assert) {
                var models = registry.getAll();
                var keys = models.map(function (m) { return m.key; });
                var uniqueKeys = [];
                for (var i = 0; i < keys.length; i++) {
                    assert.assertFalse(
                        uniqueKeys.indexOf(keys[i]) >= 0,
                        'Duplicate key found: "' + keys[i] + '"'
                    );
                    uniqueKeys.push(keys[i]);
                }
            },

            'getModel() returns correct entries for each key': function (assert) {
                var expectedKeys = ['lfm2-350m', 'lfm2-1.2b', 'phi-3.5-mini'];
                for (var i = 0; i < expectedKeys.length; i++) {
                    var model = registry.getModel(expectedKeys[i]);
                    assert.assertNotNull(model, 'getModel("' + expectedKeys[i] + '") should return a model');
                    assert.assertEqual(model.key, expectedKeys[i], 'Returned model key should match');
                }
            },

            'getModel() returns null for unknown key': function (assert) {
                var result = registry.getModel('nonexistent-model-xyz');
                assert.assertEqual(result, null, 'Should return null for unknown key');
            },

            'getModelByLocalId() returns correct entries': function (assert) {
                var expectedIds = ['local/lfm2-350m', 'local/lfm2-1.2b', 'local/phi-3.5-mini'];
                for (var i = 0; i < expectedIds.length; i++) {
                    var model = registry.getModelByLocalId(expectedIds[i]);
                    assert.assertNotNull(model, 'getModelByLocalId("' + expectedIds[i] + '") should return a model');
                    assert.assertEqual(model.localModelId, expectedIds[i], 'Returned localModelId should match');
                }
            },

            'getEnabled() returns only enabled models': function (assert) {
                var enabled = registry.getEnabled();
                assert.assertTrue(Array.isArray(enabled), 'Should return an array');
                for (var i = 0; i < enabled.length; i++) {
                    assert.assertTrue(enabled[i].enabled, 'Model "' + enabled[i].key + '" should be enabled');
                }
            },

            'getModelsForTier() filters correctly': function (assert) {
                var igpu = registry.getModelsForTier('default-igpu');
                assert.assertTrue(igpu.length >= 1, 'Should have at least 1 default-igpu model');
                for (var i = 0; i < igpu.length; i++) {
                    assert.assertEqual(igpu[i].tier, 'default-igpu', 'All results should have tier "default-igpu"');
                }

                var quality = registry.getModelsForTier('quality');
                assert.assertTrue(quality.length >= 1, 'Should have at least 1 quality model');
            },

            'All localModelId values start with "local/"': function (assert) {
                var models = registry.getAll();
                for (var i = 0; i < models.length; i++) {
                    assert.assertTrue(
                        models[i].localModelId.indexOf('local/') === 0,
                        'Model "' + models[i].key + '" localModelId should start with "local/"'
                    );
                }
            },

            'Phi-3.5-mini has quantisation "q4f16"': function (assert) {
                var phi = registry.getModel('phi-3.5-mini');
                assert.assertNotNull(phi, 'Phi-3.5-mini should exist');
                assert.assertEqual(phi.quantisation, 'q4f16', 'Phi-3.5-mini quantisation should be "q4f16"');
            },

            'Phi-3.5-mini has kvCacheDims with required fields': function (assert) {
                var phi = registry.getModel('phi-3.5-mini');
                assert.assertNotNull(phi.kvCacheDims, 'Phi-3.5-mini should have kvCacheDims');
                var kv = phi.kvCacheDims;
                assert.assertEqual(typeof kv.numLayers, 'number', 'numLayers should be a number');
                assert.assertEqual(typeof kv.numKVHeads, 'number', 'numKVHeads should be a number');
                assert.assertEqual(typeof kv.headDim, 'number', 'headDim should be a number');
                assert.assertEqual(typeof kv.bytesPerValue, 'number', 'bytesPerValue should be a number');
            },

            'LFM2-1.2B has contextLimitIGPU set': function (assert) {
                var lfm2 = registry.getModel('lfm2-1.2b');
                assert.assertNotNull(lfm2, 'LFM2-1.2B should exist');
                assert.assertTrue(
                    typeof lfm2.contextLimitIGPU === 'number' && lfm2.contextLimitIGPU > 0,
                    'LFM2-1.2B should have a positive contextLimitIGPU'
                );
            },

            'LFM2-1.2B has useExternalDataFormat true': function (assert) {
                var lfm2 = registry.getModel('lfm2-1.2b');
                assert.assertTrue(lfm2.useExternalDataFormat === true, 'LFM2-1.2B should have useExternalDataFormat: true');
            },

        }
    });

    // ── A2: Gateway Structure Tests ────────────────────────────────────
    window.ImageDescriberTests.register('local-text-gateway-structure', {
        name: 'Local Text Gateway Structure (Phase 6)',
        tests: {

            'LocalTextModelGateway exists on window': function (assert) {
                assert.assertNotNull(window.LocalTextModelGateway, 'Gateway should be loaded on window');
            },

            'All public API methods exist and are functions': function (assert) {
                var expectedMethods = [
                    'ensureLibrary', 'getRegistry', 'getModel', 'getAvailableModels',
                    'ensureModel', 'preDownloadModel', 'cancelDownload', 'isModelCached',
                    'getModelStatus', 'generate', 'generateStreaming', 'cancelGeneration',
                    'getMaxContext', 'unloadModel', 'removeCachedModel', 'getCacheSize',
                    'destroy', 'detectGPU'
                ];

                for (var i = 0; i < expectedMethods.length; i++) {
                    var method = expectedMethods[i];
                    assert.assertEqual(
                        typeof gateway[method], 'function',
                        'gateway.' + method + ' should be a function'
                    );
                }
            },

            'getRegistry() returns array of length 3': function (assert) {
                var models = gateway.getRegistry();
                assert.assertTrue(Array.isArray(models), 'Should return an array');
                assert.assertEqual(models.length, 3, 'Should have 3 models');
            },

            'getModel("lfm2-350m") returns an object (not null)': function (assert) {
                var model = gateway.getModel('lfm2-350m');
                assert.assertNotNull(model, 'Should return a model object for lfm2-350m');
            },

            'getModel("nonexistent") returns null': function (assert) {
                var result = gateway.getModel('nonexistent');
                assert.assertEqual(result, null, 'Should return null for unknown key');
            },

            'getModelStatus("lfm2-350m") returns a string': function (assert) {
                var status = gateway.getModelStatus('lfm2-350m');
                assert.assertEqual(typeof status, 'string', 'Status should be a string');
                assert.assertTrue(status.length > 0, 'Status should be non-empty');
            },

            'getMaxContext("lfm2-350m") returns 4096': function (assert) {
                var ctx = gateway.getMaxContext('lfm2-350m');
                assert.assertEqual(ctx, 4096, 'LFM2-350M context limit should be 4096');
            },

            'getMaxContext("lfm2-1.2b") returns a number > 0': function (assert) {
                var ctx = gateway.getMaxContext('lfm2-1.2b');
                assert.assertEqual(typeof ctx, 'number', 'Should return a number');
                assert.assertTrue(ctx > 0, 'Context should be > 0');
                assert.assertTrue(ctx <= 4096, 'Context should be <= 4096');
            },

            'getMaxContext("phi-3.5-mini") returns a number > 0 and <= 4096': function (assert) {
                var ctx = gateway.getMaxContext('phi-3.5-mini');
                assert.assertEqual(typeof ctx, 'number', 'Should return a number');
                assert.assertTrue(ctx > 0, 'Context should be > 0');
                assert.assertTrue(ctx <= 4096, 'Context should be <= 4096');
            },

            'getAvailableModels() returns enabled models': function (assert) {
                var models = gateway.getAvailableModels();
                assert.assertTrue(Array.isArray(models), 'Should return an array');
                assert.assertTrue(models.length > 0, 'Should have at least 1 model');
                for (var i = 0; i < models.length; i++) {
                    assert.assertTrue(models[i].enabled, 'Model "' + models[i].key + '" should be enabled');
                }
            },

        }
    });

    // ── A3: GPU Detection Tests ────────────────────────────────────────
    window.ImageDescriberTests.register('local-text-gpu-detection', {
        name: 'Local Text GPU Detection (Phase 6)',
        tests: {

            'detectGPU() returns an object with required properties': async function (assert) {
                var gpuInfo = await gateway.detectGPU();
                assert.assertNotNull(gpuInfo, 'Should return a GPU info object');
                assert.assertTrue(gpuInfo.type !== undefined, 'Should have "type" property');
                assert.assertTrue(gpuInfo.isDiscrete !== undefined, 'Should have "isDiscrete" property');
                assert.assertTrue(gpuInfo.maxBufferSize !== undefined, 'Should have "maxBufferSize" property');
            },

            'GPU type is "discrete", "integrated", or "none"': async function (assert) {
                var gpuInfo = await gateway.detectGPU();
                var validTypes = ['discrete', 'integrated', 'none'];
                assert.assertContains(validTypes, gpuInfo.type, 'Type should be one of: ' + validTypes.join(', '));
            },

            'maxBufferSize is a number >= 0': async function (assert) {
                var gpuInfo = await gateway.detectGPU();
                assert.assertEqual(typeof gpuInfo.maxBufferSize, 'number', 'maxBufferSize should be a number');
                assert.assertTrue(gpuInfo.maxBufferSize >= 0, 'maxBufferSize should be >= 0');
            },

        }
    });

    // ========================================================================
    // GROUP B: INTEGRATION TESTS (require model download + GPU inference)
    // ========================================================================

    // ── B1: Model Lifecycle Tests ──────────────────────────────────────
    window.ImageDescriberTests.register('local-text-lifecycle', {
        name: 'Local Text Lifecycle (Phase 6 — Integration)',
        tests: {

            'isModelCached("lfm2-350m") returns a boolean': async function (assert) {
                var cached = await gateway.isModelCached('lfm2-350m');
                assert.assertEqual(typeof cached, 'boolean', 'Should return a boolean');
            },

            'ensureModel("lfm2-350m") resolves without error': async function (assert) {
                var instance = await gateway.ensureModel('lfm2-350m');
                assert.assertNotNull(instance, 'Should return a model instance');
                assert.assertNotNull(instance.model, 'Instance should have a model');
                assert.assertNotNull(instance.tokeniser, 'Instance should have a tokeniser');
            },

            'After ensureModel, status is "loaded"': async function (assert) {
                // Ensure model is loaded (may already be from previous test)
                await gateway.ensureModel('lfm2-350m');
                var status = gateway.getModelStatus('lfm2-350m');
                assert.assertEqual(status, 'loaded', 'Status should be "loaded" after ensureModel');
            },

            'Calling ensureModel a second time returns same instance (no re-download)': async function (assert) {
                var instance1 = await gateway.ensureModel('lfm2-350m');
                var instance2 = await gateway.ensureModel('lfm2-350m');
                assert.assertTrue(instance1.model === instance2.model, 'Should return the same model instance');
                assert.assertTrue(instance1.tokeniser === instance2.tokeniser, 'Should return the same tokeniser instance');
            },

            'unloadModel changes status to "cached"': async function (assert) {
                await gateway.ensureModel('lfm2-350m');
                await gateway.unloadModel('lfm2-350m');
                var status = gateway.getModelStatus('lfm2-350m');
                assert.assertEqual(status, 'cached', 'Status should be "cached" after unload');
            },

            'After unload, isModelCached returns true': async function (assert) {
                var cached = await gateway.isModelCached('lfm2-350m');
                assert.assertTrue(cached, 'Model should still be cached after unload');
            },

            'ensureModel for unknown key throws/rejects': async function (assert) {
                var errorCaught = false;
                try {
                    await gateway.ensureModel('totally-fake-model-xyz');
                } catch (e) {
                    errorCaught = true;
                }
                assert.assertTrue(errorCaught, 'ensureModel with unknown key should throw');
            },

            'Load, unload, then reload from cache works': async function (assert) {
                // Ensure loaded
                await gateway.ensureModel('lfm2-350m');
                // Unload
                await gateway.unloadModel('lfm2-350m');
                assert.assertEqual(gateway.getModelStatus('lfm2-350m'), 'cached', 'Should be cached after unload');
                // Reload from cache
                var instance = await gateway.ensureModel('lfm2-350m');
                assert.assertNotNull(instance, 'Should reload successfully from cache');
                assert.assertEqual(gateway.getModelStatus('lfm2-350m'), 'loaded', 'Should be loaded after reload');
            },

        }
    });

    // ── B2: Inference Tests ────────────────────────────────────────────
    window.ImageDescriberTests.register('local-text-inference', {
        name: 'Local Text Inference (Phase 6 — Integration)',
        tests: {

            'generate() returns result with correct shape': async function (assert) {
                var result = await gateway.generate('lfm2-350m', 'What is the capital of France?', { maxTokens: 64 });
                assert.assertNotNull(result, 'Should return a result object');
                var requiredFields = ['status', 'text', 'tokenCount', 'duration', 'tokensPerSecond', 'model', 'error'];
                for (var i = 0; i < requiredFields.length; i++) {
                    assert.assertTrue(
                        result[requiredFields[i]] !== undefined,
                        'Result should have field "' + requiredFields[i] + '"'
                    );
                }
            },

            'generate() status is "success"': async function (assert) {
                var result = await gateway.generate('lfm2-350m', 'What is 2+2?', { maxTokens: 32 });
                assert.assertEqual(result.status, 'success', 'Status should be "success"');
            },

            'generate() text contains "Paris" for capital-of-France prompt': async function (assert) {
                var result = await gateway.generate('lfm2-350m', 'What is the capital of France? Answer in one word.', { maxTokens: 32, temperature: 0 });
                assert.assertEqual(result.status, 'success', 'Generation should succeed');
                assert.assertContains(result.text, 'Paris', 'Response should contain "Paris"');
            },

            'generate() tokenCount > 0': async function (assert) {
                var result = await gateway.generate('lfm2-350m', 'Say hello.', { maxTokens: 32 });
                assert.assertTrue(result.tokenCount > 0, 'Token count should be > 0');
            },

            'generate() tokensPerSecond > 0': async function (assert) {
                var result = await gateway.generate('lfm2-350m', 'Say hello.', { maxTokens: 32 });
                assert.assertTrue(result.tokensPerSecond > 0, 'Tokens per second should be > 0');
            },

            'generate() with invalid model key returns error status': async function (assert) {
                var result = await gateway.generate('fake-model-xyz', 'hello', { maxTokens: 8 });
                assert.assertEqual(result.status, 'error', 'Should return error status for invalid model');
            },

            'generate() respects maxTokens (output <= maxTokens)': async function (assert) {
                var maxTokens = 16;
                var result = await gateway.generate('lfm2-350m', 'Tell me a long story about dragons.', { maxTokens: maxTokens });
                assert.assertEqual(result.status, 'success', 'Generation should succeed');
                assert.assertTrue(
                    result.tokenCount <= maxTokens,
                    'Token count (' + result.tokenCount + ') should be <= maxTokens (' + maxTokens + ')'
                );
            },

            'generate() with unloaded model auto-loads from cache': async function (assert) {
                // Unload first if loaded
                await gateway.unloadModel('lfm2-350m');
                assert.assertEqual(gateway.getModelStatus('lfm2-350m'), 'cached', 'Model should be cached');

                // generate() should auto-load
                var result = await gateway.generate('lfm2-350m', 'Hello', { maxTokens: 8 });
                assert.assertEqual(result.status, 'success', 'Should auto-load and generate successfully');
                assert.assertEqual(gateway.getModelStatus('lfm2-350m'), 'loaded', 'Model should be loaded after auto-load');
            },

        }
    });

    // ── B3: Streaming Tests ────────────────────────────────────────────
    window.ImageDescriberTests.register('local-text-streaming', {
        name: 'Local Text Streaming (Phase 6 — Integration)',
        tests: {

            'generateStreaming() calls onToken callback': async function (assert) {
                var callCount = 0;
                await gateway.generateStreaming('lfm2-350m', 'Say hello world.', {
                    maxTokens: 32,
                    onToken: function () { callCount++; }
                });
                assert.assertTrue(callCount > 0, 'onToken should be called at least once');
            },

            'onToken receives objects with text, index, elapsed': async function (assert) {
                var firstToken = null;
                await gateway.generateStreaming('lfm2-350m', 'Say hello.', {
                    maxTokens: 16,
                    onToken: function (token) {
                        if (!firstToken) firstToken = token;
                    }
                });
                assert.assertNotNull(firstToken, 'Should have received at least one token');
                assert.assertTrue(firstToken.text !== undefined, 'Token should have "text" property');
                assert.assertTrue(firstToken.index !== undefined, 'Token should have "index" property');
                assert.assertTrue(firstToken.elapsed !== undefined, 'Token should have "elapsed" property');
            },

            'onToken is called multiple times (not just once)': async function (assert) {
                var callCount = 0;
                await gateway.generateStreaming('lfm2-350m', 'Tell me a short fact about the Sun.', {
                    maxTokens: 64,
                    onToken: function () { callCount++; }
                });
                assert.assertTrue(callCount > 1, 'onToken should be called multiple times, got ' + callCount);
            },

            'Final result has correct shape (same as generate)': async function (assert) {
                var result = await gateway.generateStreaming('lfm2-350m', 'Hello', { maxTokens: 16 });
                var requiredFields = ['status', 'text', 'tokenCount', 'duration', 'tokensPerSecond', 'model', 'error'];
                for (var i = 0; i < requiredFields.length; i++) {
                    assert.assertTrue(
                        result[requiredFields[i]] !== undefined,
                        'Result should have field "' + requiredFields[i] + '"'
                    );
                }
                assert.assertEqual(result.status, 'success', 'Status should be "success"');
            },

            'Final result text matches accumulated streamed tokens': async function (assert) {
                var accumulated = '';
                var result = await gateway.generateStreaming('lfm2-350m', 'Say the word "test".', {
                    maxTokens: 16,
                    onToken: function (token) { accumulated += token.text; }
                });
                assert.assertEqual(
                    result.text, accumulated,
                    'Final text should match accumulated streamed tokens'
                );
            },

        }
    });

    // ── B4: Cache Tests ────────────────────────────────────────────────
    window.ImageDescriberTests.register('local-text-cache', {
        name: 'Local Text Cache (Phase 6 — Integration)',
        tests: {

            'getCacheSize() returns { totalBytes, models } shape': async function (assert) {
                var cacheInfo = await gateway.getCacheSize();
                assert.assertNotNull(cacheInfo, 'Should return a cache info object');
                assert.assertTrue(cacheInfo.totalBytes !== undefined, 'Should have totalBytes');
                assert.assertTrue(cacheInfo.models !== undefined, 'Should have models');
            },

            'totalBytes is a number >= 0': async function (assert) {
                var cacheInfo = await gateway.getCacheSize();
                assert.assertEqual(typeof cacheInfo.totalBytes, 'number', 'totalBytes should be a number');
                assert.assertTrue(cacheInfo.totalBytes >= 0, 'totalBytes should be >= 0');
            },

            'models is a Map': async function (assert) {
                var cacheInfo = await gateway.getCacheSize();
                assert.assertTrue(cacheInfo.models instanceof Map, 'models should be a Map');
            },

            'After ensuring a model, its key appears in the cache models map': async function (assert) {
                // Ensure model is loaded (downloads if not cached)
                await gateway.ensureModel('lfm2-350m');
                var cacheInfo = await gateway.getCacheSize();
                assert.assertTrue(
                    cacheInfo.models.has('lfm2-350m'),
                    'Cache models map should contain "lfm2-350m" after ensureModel'
                );
                assert.assertTrue(
                    cacheInfo.models.get('lfm2-350m') > 0,
                    'Cached size for lfm2-350m should be > 0'
                );
            },

        }
    });

    // ========================================================================
    // CONVENIENCE WRAPPER — LocalTextGatewayTests
    // ========================================================================

    /**
     * Convenience wrapper providing grouped test execution.
     * Delegates to ImageDescriberTests.run() for each module.
     */
    const LocalTextGatewayTests = {

        /** Run all structural tests (instant, no model downloads) */
        runStructural: async function () {
            console.log('%c══════════════════════════════════════════════════════', 'color: #1565c0; font-weight: bold');
            console.log('%c Local Text Gateway — Structural Tests (Group A)', 'color: #1565c0; font-weight: bold; font-size: 1.1em');
            console.log('%c══════════════════════════════════════════════════════', 'color: #1565c0; font-weight: bold');

            var totalPassed = 0;
            var totalFailed = 0;
            var start = performance.now();

            var r1 = await window.ImageDescriberTests.run('local-text-registry', { verbose: true });
            totalPassed += r1.passed; totalFailed += r1.failed;

            var r2 = await window.ImageDescriberTests.run('local-text-gateway-structure', { verbose: true });
            totalPassed += r2.passed; totalFailed += r2.failed;

            var r3 = await window.ImageDescriberTests.run('local-text-gpu-detection', { verbose: true });
            totalPassed += r3.passed; totalFailed += r3.failed;

            var duration = performance.now() - start;
            var allPassed = totalFailed === 0;
            var style = allPassed ? 'color: #2e7d32; font-weight: bold' : 'color: #c62828; font-weight: bold';
            var icon = allPassed ? 'ALL PASSED' : 'FAILURES DETECTED';

            console.log('%c══════════════════════════════════════════════════════', 'color: #1565c0; font-weight: bold');
            console.log('%c ' + icon + ' %c — ' + totalPassed + ' passed, ' + totalFailed + ' failed (' + duration.toFixed(0) + ' ms)', style, '');
            console.log('%c══════════════════════════════════════════════════════', 'color: #1565c0; font-weight: bold');

            return { passed: totalPassed, failed: totalFailed, duration: duration };
        },

        /** Run all integration tests (require model download + GPU inference) */
        runIntegration: async function () {
            console.log('%c══════════════════════════════════════════════════════', 'color: #1565c0; font-weight: bold');
            console.log('%c Local Text Gateway — Integration Tests (Group B)', 'color: #1565c0; font-weight: bold; font-size: 1.1em');
            console.log('%c══════════════════════════════════════════════════════', 'color: #1565c0; font-weight: bold');

            var totalPassed = 0;
            var totalFailed = 0;
            var start = performance.now();

            try {
                var r1 = await window.ImageDescriberTests.run('local-text-lifecycle', { verbose: true });
                totalPassed += r1.passed; totalFailed += r1.failed;

                var r2 = await window.ImageDescriberTests.run('local-text-inference', { verbose: true });
                totalPassed += r2.passed; totalFailed += r2.failed;

                var r3 = await window.ImageDescriberTests.run('local-text-streaming', { verbose: true });
                totalPassed += r3.passed; totalFailed += r3.failed;

                var r4 = await window.ImageDescriberTests.run('local-text-cache', { verbose: true });
                totalPassed += r4.passed; totalFailed += r4.failed;
            } finally {
                // Cleanup: unload model even if tests fail
                try {
                    await gateway.unloadModel('lfm2-350m');
                    logInfo('Cleanup: unloaded lfm2-350m after integration tests');
                } catch (cleanupErr) {
                    logWarn('Cleanup warning:', cleanupErr.message || cleanupErr);
                }
            }

            var duration = performance.now() - start;
            var allPassed = totalFailed === 0;
            var style = allPassed ? 'color: #2e7d32; font-weight: bold' : 'color: #c62828; font-weight: bold';
            var icon = allPassed ? 'ALL PASSED' : 'FAILURES DETECTED';

            console.log('%c══════════════════════════════════════════════════════', 'color: #1565c0; font-weight: bold');
            console.log('%c ' + icon + ' %c — ' + totalPassed + ' passed, ' + totalFailed + ' failed (' + duration.toFixed(0) + ' ms)', style, '');
            console.log('%c══════════════════════════════════════════════════════', 'color: #1565c0; font-weight: bold');

            return { passed: totalPassed, failed: totalFailed, duration: duration };
        },

        /** Run everything — structural first, then integration */
        runAll: async function () {
            console.log('%c══════════════════════════════════════════════════════', 'color: #1565c0; font-weight: bold; font-size: 1.2em');
            console.log('%c Local Text Gateway — Full Test Suite', 'color: #1565c0; font-weight: bold; font-size: 1.2em');
            console.log('%c══════════════════════════════════════════════════════', 'color: #1565c0; font-weight: bold; font-size: 1.2em');

            var start = performance.now();
            var structural = await LocalTextGatewayTests.runStructural();
            var integration = await LocalTextGatewayTests.runIntegration();

            var totalPassed = structural.passed + integration.passed;
            var totalFailed = structural.failed + integration.failed;
            var duration = performance.now() - start;

            var allPassed = totalFailed === 0;
            var style = allPassed ? 'color: #2e7d32; font-weight: bold; font-size: 1.1em' : 'color: #c62828; font-weight: bold; font-size: 1.1em';
            var icon = allPassed ? 'ALL PASSED' : 'FAILURES DETECTED';

            console.log('%c══════════════════════════════════════════════════════', 'color: #1565c0; font-weight: bold; font-size: 1.2em');
            console.log('%c FINAL: ' + icon + ' %c — ' + totalPassed + ' passed, ' + totalFailed + ' failed (' + duration.toFixed(0) + ' ms)', style, '');
            console.log('%c══════════════════════════════════════════════════════', 'color: #1565c0; font-weight: bold; font-size: 1.2em');

            return { passed: totalPassed, failed: totalFailed, duration: duration };
        },

        // ── Per-category convenience methods ───────────────────────────
        runRegistry: function () { return window.ImageDescriberTests.run('local-text-registry', { verbose: true }); },
        runGatewayStructure: function () { return window.ImageDescriberTests.run('local-text-gateway-structure', { verbose: true }); },
        runGPUDetection: function () { return window.ImageDescriberTests.run('local-text-gpu-detection', { verbose: true }); },
        runLifecycle: function () { return window.ImageDescriberTests.run('local-text-lifecycle', { verbose: true }); },
        runInference: function () { return window.ImageDescriberTests.run('local-text-inference', { verbose: true }); },
        runStreaming: function () { return window.ImageDescriberTests.run('local-text-streaming', { verbose: true }); },
        runCache: function () { return window.ImageDescriberTests.run('local-text-cache', { verbose: true }); },
    };

    window.LocalTextGatewayTests = LocalTextGatewayTests;

    logInfo('Local Text Gateway tests registered — 7 modules across Group A (structural) and Group B (integration)');

})();
