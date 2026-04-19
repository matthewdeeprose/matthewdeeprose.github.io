// Phase 9C — Model Manager Tests
// Registers with the Phase 9A test runner.
// Run: ImageDescriberTests.run('model-manager', { verbose: true })

(function () {
    'use strict';

    if (typeof window.ImageDescriberTests === 'undefined') {
        console.warn('[tests-model-manager] Test runner not loaded — skipping registration.');
        return;
    }

    window.ImageDescriberTests.register('model-manager', {
        name: 'Model Manager (Phase 9C)',
        tests: {

            // ── Registry ────────────────────────────────────────────────

            'getRegisteredModels() returns an array with expected models': function (assert) {
                var models = window.ImageDescriberModelManager.getRegisteredModels();

                assert.assertTrue(Array.isArray(models), 'Should return an array');
                assert.assertTrue(models.length >= 4, 'Should have at least 4 models (CLIP, Florence-2, Depth, Tesseract)');

                var keys = models.map(function (m) { return m.key; });
                assert.assertContains(keys, 'clip', 'Should include CLIP');
                assert.assertContains(keys, 'florence2', 'Should include Florence-2');
                assert.assertContains(keys, 'depth', 'Should include Depth Anything');
                assert.assertContains(keys, 'tesseract', 'Should include Tesseract');
            },

            'Each registered model has required fields': function (assert) {
                var models = window.ImageDescriberModelManager.getRegisteredModels();
                var requiredFields = ['key', 'name', 'role', 'sizeMB', 'enabled', 'status', 'state'];

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

            'SmolVLM2 entry exists in registry but is marked as future/disabled': function (assert) {
                var models = window.ImageDescriberModelManager.getRegisteredModels();
                var smolvlm = null;

                for (var i = 0; i < models.length; i++) {
                    if (models[i].key === 'smolvlm2') {
                        smolvlm = models[i];
                        break;
                    }
                }

                assert.assertNotNull(smolvlm, 'SmolVLM2 should exist in registry');
                assert.assertEqual(smolvlm.status, 'future', 'SmolVLM2 status should be "future"');
                assert.assertFalse(smolvlm.enabled, 'SmolVLM2 should be disabled');
            },

            // ── Model State ─────────────────────────────────────────────

            'getModelState("clip") returns a valid state string': function (assert) {
                var state = window.ImageDescriberModelManager.getModelState('clip');
                var validStates = [
                    'not-downloaded', 'downloading', 'cached',
                    'loading', 'loaded', 'download-error', 'load-error'
                ];

                assert.assertContains(
                    validStates, state,
                    'CLIP state should be one of the valid lifecycle states, got "' + state + '"'
                );
            },

            'getModelState for unknown key returns "unknown"': function (assert) {
                var state = window.ImageDescriberModelManager.getModelState('nonexistent_model_xyz');
                assert.assertEqual(state, 'unknown', 'Unknown model key should return "unknown"');
            },

            'getModelState("clip") reflects gateway pipeline status when loaded': function (assert) {
                // If the gateway has CLIP loaded (from a prior classification),
                // the model manager should report 'loaded'
                var gateway = window.ImageDescriberAnalyserTransformers;
                if (gateway && gateway.getPipelineStatus('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32') === 'ready') {
                    var state = window.ImageDescriberModelManager.getModelState('clip');
                    assert.assertEqual(state, 'loaded', 'CLIP should report "loaded" when gateway pipeline is ready');
                } else {
                    // CLIP not loaded — state depends on cache; just check it is valid
                    var clipState = window.ImageDescriberModelManager.getModelState('clip');
                    assert.assertTrue(
                        typeof clipState === 'string' && clipState.length > 0,
                        'CLIP state should be a non-empty string'
                    );
                }
            },

            // ── Storage Status ──────────────────────────────────────────

            'getStorageStatus() returns quota info with quotaMB and usedMB as numbers': async function (assert) {
                var status = await window.ImageDescriberModelManager.getStorageStatus();

                assert.assertNotNull(status, 'Should return a status object');
                assert.assertEqual(typeof status.quotaMB, 'number', 'quotaMB should be a number');
                assert.assertEqual(typeof status.usedMB, 'number', 'usedMB should be a number');
                assert.assertEqual(typeof status.availableMB, 'number', 'availableMB should be a number');
                assert.assertEqual(typeof status.persistent, 'boolean', 'persistent should be a boolean');
                assert.assertTrue(status.quotaMB >= 0, 'quotaMB should be non-negative');
                assert.assertTrue(status.usedMB >= 0, 'usedMB should be non-negative');
            },

            // ── Cache Inspection ────────────────────────────────────────

            'getCachedModels() returns a Map': async function (assert) {
                var cached = await window.ImageDescriberModelManager.getCachedModels();
                assert.assertTrue(cached instanceof Map, 'Should return a Map');
            },

            'getCacheSize() returns a non-negative number': async function (assert) {
                var size = await window.ImageDescriberModelManager.getCacheSize();
                assert.assertEqual(typeof size, 'number', 'Should return a number');
                assert.assertTrue(size >= 0, 'Cache size should be non-negative');
            },

            // ── Analysis Cache Integration ──────────────────────────────

            'getAnalysisCacheStats() returns imageCount and totalBytes': async function (assert) {
                var stats = await window.ImageDescriberModelManager.getAnalysisCacheStats();

                assert.assertNotNull(stats, 'Should return a stats object');
                assert.assertEqual(typeof stats.imageCount, 'number', 'imageCount should be a number');
                assert.assertEqual(typeof stats.totalBytes, 'number', 'totalBytes should be a number');
                assert.assertTrue(stats.imageCount >= 0, 'imageCount should be non-negative');
                assert.assertTrue(stats.totalBytes >= 0, 'totalBytes should be non-negative');
            }
        }
    });
})();
