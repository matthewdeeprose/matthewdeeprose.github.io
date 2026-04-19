// Phase 10A + 10B — Florence-2 Gateway Method Tests + Format Function Tests
// Registers with the Phase 9A test runner.
// Run: ImageDescriberTests.run('florence2', { verbose: true })
//
// Phase 10A tests: gateway constants, error paths, live inference (skip-if-not-ready)
// Phase 10B tests: formatFlorence2CaptionForPrompt, formatFlorence2ObjectsForPrompt,
//                  formatFlorence2OCRForPrompt, orchestrator slot presence
//
// NOTE: Live inference tests require Florence-2 to be downloaded (~200 MB)
// and an image uploaded. These are marked as skip-if-not-ready.

(function () {
    'use strict';

    if (typeof window.ImageDescriberTests === 'undefined') {
        console.warn('[tests-florence2] Test runner not loaded — skipping registration.');
        return;
    }

    var gateway = window.ImageDescriberAnalyserTransformers;

    window.ImageDescriberTests.register('florence2', {
        name: 'Florence-2 Gateway Methods (Phase 10A)',
        tests: {

            // ── Constants exposed ────────────────────────────────────

            'FLORENCE_MODEL_ID is exposed and correct': function (assert) {
                assert.assertNotNull(gateway.FLORENCE_MODEL_ID, 'FLORENCE_MODEL_ID should be exposed');
                assert.assertEqual(
                    gateway.FLORENCE_MODEL_ID,
                    'onnx-community/Florence-2-base-ft',
                    'Model ID should match spike-confirmed value'
                );
            },

            'FLORENCE_TASKS contains all expected task tokens': function (assert) {
                var tasks = gateway.FLORENCE_TASKS;
                assert.assertNotNull(tasks, 'FLORENCE_TASKS should be exposed');
                assert.assertEqual(tasks.CAPTION, '<CAPTION>', 'CAPTION task');
                assert.assertEqual(tasks.DETAILED_CAPTION, '<DETAILED_CAPTION>', 'DETAILED_CAPTION task');
                assert.assertEqual(tasks.MORE_DETAILED_CAPTION, '<MORE_DETAILED_CAPTION>', 'MORE_DETAILED_CAPTION task');
                assert.assertEqual(tasks.OBJECT_DETECTION, '<OD>', 'OBJECT_DETECTION task');
                assert.assertEqual(tasks.OCR_WITH_REGION, '<OCR_WITH_REGION>', 'OCR_WITH_REGION task');
            },

            // ── getFlorenceStatus ────────────────────────────────────

            'getFlorenceStatus returns a valid state string': function (assert) {
                var status = gateway.getFlorenceStatus();
                var validStates = ['not-loaded', 'loading', 'ready', 'error'];
                assert.assertTrue(
                    validStates.indexOf(status) !== -1,
                    'Status "' + status + '" should be one of: ' + validStates.join(', ')
                );
            },

            // ── generateCaption error paths ──────────────────────────

            'generateCaption returns error result (not throw) when no image': async function (assert) {
                var result = await gateway.generateCaption(null);
                assert.assertEqual(result.status, 'error', 'Status should be error');
                assert.assertNotNull(result.error, 'Error message should be present');
                assert.assertTrue(result.duration >= 0, 'Duration should be non-negative');
            },

            'generateCaption returns error for invalid task token': async function (assert) {
                // Create a minimal test image (1×1 white pixel)
                var canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                var ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, 1, 1);

                var result = await gateway.generateCaption(canvas, '<INVALID_TASK>');
                assert.assertEqual(result.status, 'error', 'Status should be error for invalid task');
                assert.assertContains(result.error, 'Invalid caption task', 'Error should mention invalid task');
            },

            // ── detectObjects error paths ────────────────────────────

            'detectObjects returns error result (not throw) when no image': async function (assert) {
                var result = await gateway.detectObjects(null);
                assert.assertEqual(result.status, 'error', 'Status should be error');
                assert.assertNotNull(result.error, 'Error message should be present');
                assert.assertTrue(result.duration >= 0, 'Duration should be non-negative');
            },

            // ── extractOCR error paths ───────────────────────────────

            'extractOCR returns error result (not throw) when no image': async function (assert) {
                var result = await gateway.extractOCR(null);
                assert.assertEqual(result.status, 'error', 'Status should be error');
                assert.assertNotNull(result.error, 'Error message should be present');
                assert.assertTrue(result.duration >= 0, 'Duration should be non-negative');
            },

            // ── Live inference tests (require model + image) ─────────
            // These tests actually run Florence-2. They skip if the model
            // is not loaded or no image is available.

            'generateCaption returns object with text and status complete': async function (assert) {
                if (gateway.getFlorenceStatus() !== 'ready') {
                    console.warn('[skipped] ' + 'Florence-2 not loaded — run ensureFlorence() first');
                    return;
                }
                var img = _getPreviewImage();
                if (!img) {
                    console.warn('[skipped] ' + 'No image uploaded — upload an image first');
                    return;
                }

                var result = await gateway.generateCaption(img);
                assert.assertEqual(result.status, 'complete', 'Status should be complete');
                assert.assertNotNull(result.text, 'Caption text should be present');
                assert.assertTrue(typeof result.text === 'string', 'Caption should be a string');
                assert.assertTrue(result.text.length > 0, 'Caption should not be empty');
                assert.assertEqual(result.task, '<MORE_DETAILED_CAPTION>', 'Default task should be MORE_DETAILED_CAPTION');
                assert.assertTrue(result.duration > 0, 'Duration should be positive');
            },

            'generateCaption accepts alternate task token': async function (assert) {
                if (gateway.getFlorenceStatus() !== 'ready') {
                    console.warn('[skipped] ' + 'Florence-2 not loaded');
                    return;
                }
                var img = _getPreviewImage();
                if (!img) {
                    console.warn('[skipped] ' + 'No image uploaded');
                    return;
                }

                var result = await gateway.generateCaption(img, '<DETAILED_CAPTION>');
                assert.assertEqual(result.status, 'complete', 'Status should be complete');
                assert.assertEqual(result.task, '<DETAILED_CAPTION>', 'Task should match requested');
                assert.assertTrue(result.text.length > 0, 'Caption should not be empty');
            },

            'detectObjects returns items array with label and bounds': async function (assert) {
                if (gateway.getFlorenceStatus() !== 'ready') {
                    console.warn('[skipped] ' + 'Florence-2 not loaded');
                    return;
                }
                var img = _getPreviewImage();
                if (!img) {
                    console.warn('[skipped] ' + 'No image uploaded');
                    return;
                }

                var result = await gateway.detectObjects(img);
                assert.assertEqual(result.status, 'complete', 'Status should be complete');
                assert.assertTrue(Array.isArray(result.items), 'Items should be an array');
                assert.assertTrue(result.duration > 0, 'Duration should be positive');

                // If objects were found, verify item structure
                if (result.items.length > 0) {
                    var item = result.items[0];
                    assert.assertNotNull(item.label, 'Item should have a label');
                    assert.assertTrue(typeof item.label === 'string', 'Label should be a string');
                    assert.assertNotNull(item.bounds, 'Item should have bounds');
                    assert.assertTrue(typeof item.bounds.x1 === 'number', 'bounds.x1 should be a number');
                    assert.assertTrue(typeof item.bounds.y1 === 'number', 'bounds.y1 should be a number');
                    assert.assertTrue(typeof item.bounds.x2 === 'number', 'bounds.x2 should be a number');
                    assert.assertTrue(typeof item.bounds.y2 === 'number', 'bounds.y2 should be a number');
                    // confidence is null for Florence-2 OD (no per-object scores)
                    assert.assertEqual(item.confidence, null, 'Confidence should be null for Florence-2');
                }
            },

            'extractOCR returns items array with text and quadBox': async function (assert) {
                if (gateway.getFlorenceStatus() !== 'ready') {
                    console.warn('[skipped] ' + 'Florence-2 not loaded');
                    return;
                }
                var img = _getPreviewImage();
                if (!img) {
                    console.warn('[skipped] ' + 'No image uploaded');
                    return;
                }

                var result = await gateway.extractOCR(img);
                assert.assertEqual(result.status, 'complete', 'Status should be complete');
                assert.assertTrue(Array.isArray(result.items), 'Items should be an array');
                assert.assertTrue(result.duration > 0, 'Duration should be positive');

                // If OCR regions were found, verify item structure
                if (result.items.length > 0) {
                    var item = result.items[0];
                    assert.assertNotNull(item.text, 'Item should have text');
                    assert.assertTrue(typeof item.text === 'string', 'Text should be a string');
                    assert.assertNotNull(item.quadBox, 'Item should have quadBox');
                    assert.assertTrue(Array.isArray(item.quadBox), 'quadBox should be an array');
                    assert.assertEqual(item.quadBox.length, 8, 'quadBox should have 8 coordinates (4 corners)');
                }
            },

            'Duration is recorded in each result': async function (assert) {
                // Test with error paths (no model needed) — duration should still be recorded
                var captionResult = await gateway.generateCaption(null);
                assert.assertTrue(typeof captionResult.duration === 'number', 'Caption error should have duration');

                var odResult = await gateway.detectObjects(null);
                assert.assertTrue(typeof odResult.duration === 'number', 'OD error should have duration');

                var ocrResult = await gateway.extractOCR(null);
                assert.assertTrue(typeof ocrResult.duration === 'number', 'OCR error should have duration');
            },

            // ── Phase 10B: Format function tests ─────────────────────
            // These are pure unit tests — no model or image required.

            'formatFlorence2CaptionForPrompt returns headed text for complete result': function (assert) {
                var fmt = window.ImageDescriberAnalyserFormat;
                var result = fmt.formatFlorence2CaptionForPrompt({
                    status: 'complete',
                    text: 'A castle surrounded by trees and people in red uniforms.',
                    task: '<MORE_DETAILED_CAPTION>',
                    duration: 35000,
                });
                assert.assertTrue(result.length > 0, 'Should return non-empty string');
                assert.assertContains(result, 'Florence-2', 'Should mention Florence-2 in heading');
                assert.assertContains(result, 'castle', 'Should include caption text');
            },

            'formatFlorence2CaptionForPrompt returns empty for skipped status': function (assert) {
                var fmt = window.ImageDescriberAnalyserFormat;
                assert.assertEqual(
                    fmt.formatFlorence2CaptionForPrompt({ status: 'skipped' }),
                    '',
                    'Skipped status should return empty string'
                );
            },

            'formatFlorence2CaptionForPrompt returns empty for error status': function (assert) {
                var fmt = window.ImageDescriberAnalyserFormat;
                assert.assertEqual(
                    fmt.formatFlorence2CaptionForPrompt({ status: 'error', error: 'timeout' }),
                    '',
                    'Error status should return empty string'
                );
            },

            'formatFlorence2CaptionForPrompt returns empty for null input': function (assert) {
                var fmt = window.ImageDescriberAnalyserFormat;
                assert.assertEqual(
                    fmt.formatFlorence2CaptionForPrompt(null),
                    '',
                    'Null input should return empty string'
                );
            },

            'formatFlorence2ObjectsForPrompt returns headed list for complete result': function (assert) {
                var fmt = window.ImageDescriberAnalyserFormat;
                var result = fmt.formatFlorence2ObjectsForPrompt({
                    status: 'complete',
                    items: [
                        { label: 'cannon', bounds: { x1: 100, y1: 400, x2: 300, y2: 500 } },
                        { label: 'person', bounds: { x1: 10, y1: 10, x2: 100, y2: 200 } },
                    ],
                    duration: 34000,
                }, 800, 600);
                assert.assertTrue(result.length > 0, 'Should return non-empty string');
                assert.assertContains(result, 'Florence-2', 'Should mention Florence-2 in heading');
                assert.assertContains(result, 'cannon', 'Should list cannon');
                assert.assertContains(result, 'person', 'Should list person');
            },

            'formatFlorence2ObjectsForPrompt includes position from bounds + dimensions': function (assert) {
                var fmt = window.ImageDescriberAnalyserFormat;
                // Object centred at pixel (700,500) in a 800×600 image
                // cx = 700/800 = 0.875 → right; cy = 500/600 = 0.833 → bottom
                var result = fmt.formatFlorence2ObjectsForPrompt({
                    status: 'complete',
                    items: [{ label: 'wheel', bounds: { x1: 600, y1: 400, x2: 800, y2: 600 } }],
                    duration: 34000,
                }, 800, 600);
                assert.assertContains(result, 'bottom-right', 'Should describe bottom-right position');
            },

            'formatFlorence2ObjectsForPrompt works without image dimensions': function (assert) {
                var fmt = window.ImageDescriberAnalyserFormat;
                var result = fmt.formatFlorence2ObjectsForPrompt({
                    status: 'complete',
                    items: [{ label: 'tree', bounds: { x1: 0, y1: 0, x2: 100, y2: 100 } }],
                    duration: 34000,
                });
                // Should still produce output, just without position
                assert.assertTrue(result.length > 0, 'Should return non-empty string without dimensions');
                assert.assertContains(result, 'tree', 'Should still list the object');
            },

            'formatFlorence2ObjectsForPrompt returns empty for empty items': function (assert) {
                var fmt = window.ImageDescriberAnalyserFormat;
                assert.assertEqual(
                    fmt.formatFlorence2ObjectsForPrompt({ status: 'complete', items: [], duration: 0 }, 800, 600),
                    '',
                    'Empty items array should return empty string'
                );
            },

            'formatFlorence2ObjectsForPrompt returns empty for skipped status': function (assert) {
                var fmt = window.ImageDescriberAnalyserFormat;
                assert.assertEqual(
                    fmt.formatFlorence2ObjectsForPrompt({ status: 'skipped' }),
                    '',
                    'Skipped status should return empty string'
                );
            },

            'formatFlorence2OCRForPrompt returns headed list for complete result': function (assert) {
                var fmt = window.ImageDescriberAnalyserFormat;
                var result = fmt.formatFlorence2OCRForPrompt({
                    status: 'complete',
                    items: [
                        { text: 'Hello', quadBox: [0, 0, 100, 0, 100, 50, 0, 50] },
                        { text: 'World', quadBox: [0, 60, 100, 60, 100, 110, 0, 110] },
                    ],
                    duration: 33000,
                });
                assert.assertTrue(result.length > 0, 'Should return non-empty string');
                assert.assertContains(result, 'Florence-2', 'Should mention Florence-2 in heading');
                assert.assertContains(result, 'Hello', 'Should include text item');
            },

            'formatFlorence2OCRForPrompt returns empty for all-blank text': function (assert) {
                var fmt = window.ImageDescriberAnalyserFormat;
                assert.assertEqual(
                    fmt.formatFlorence2OCRForPrompt({
                        status: 'complete',
                        items: [{ text: '   ', quadBox: [] }],
                        duration: 0,
                    }),
                    '',
                    'All-blank text items should return empty string'
                );
            },

            'formatFlorence2OCRForPrompt returns empty for null input': function (assert) {
                var fmt = window.ImageDescriberAnalyserFormat;
                assert.assertEqual(
                    fmt.formatFlorence2OCRForPrompt(null),
                    '',
                    'Null input should return empty string'
                );
            },

            // ── Phase 10B: Orchestrator slot presence ─────────────────
            // Checks that lastAnalysis has the new slots (requires prior image upload).

            'lastAnalysis has florenceCaption and florenceObjects slots': function (assert) {
                var analyser = window.ImageDescriberAnalyser;
                if (!analyser.lastAnalysis) {
                    console.warn('[skipped] ' + 'No analysis yet — upload an image first');
                    return;
                }
                assert.assertTrue(
                    'florenceCaption' in analyser.lastAnalysis,
                    'lastAnalysis should have florenceCaption slot'
                );
                assert.assertTrue(
                    'florenceObjects' in analyser.lastAnalysis,
                    'lastAnalysis should have florenceObjects slot'
                );
            },

            'florenceCaption slot has valid status when Florence-2 not loaded': function (assert) {
                var analyser = window.ImageDescriberAnalyser;
                if (!analyser.lastAnalysis) {
                    console.warn('[skipped] ' + 'No analysis yet — upload an image first');
                    return;
                }
                var slot = analyser.lastAnalysis.florenceCaption;
                if (!slot) {
                    console.warn('[skipped] ' + 'florenceCaption slot is null — Florence-2 may be ready or not yet run');
                    return;
                }
                var validStatuses = ['complete', 'error', 'skipped'];
                assert.assertTrue(
                    validStatuses.indexOf(slot.status) !== -1,
                    'florenceCaption.status "' + slot.status + '" should be one of: ' + validStatuses.join(', ')
                );
            },
        },
    });

    // ── Helper: get the preview image from Image Describer ────────────
    function _getPreviewImage() {
        var container = document.getElementById('imgdesc-preview');
        if (!container) return null;
        var img = container.querySelector('img.imgdesc-preview-image') ||
                  container.querySelector('img');
        if (!img || !img.src || img.src === '') return null;
        return img;
    }

})();
