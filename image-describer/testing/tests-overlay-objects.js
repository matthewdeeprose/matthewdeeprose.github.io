// Phase 10C — Florence-2 Overlay + Review Tests
// Registers with the Phase 9A test runner.
// Run: ImageDescriberTests.run('overlay-objects', { verbose: true })
//
// Tests cover:
//   1. pixelBoundsToNormalised coordinate conversion
//   2. Objects layer creation in init()
//   3. Objects rendering from synthetic analysis data
//   4. Toolbar state (Objects button enabled/disabled)
//   5. Layer toggle independence
//   6. Object review: select, remove, confirm/restore
//   7. getCorrectedAnalysis filters removed objects
//   8. Toggletip creation for object boxes
//   9. Edge cases: empty items, missing bounds, missing image dimensions

(function () {
    'use strict';

    if (typeof window.ImageDescriberTests === 'undefined') {
        console.warn('[tests-overlay-objects] Test runner not loaded — skipping registration.');
        return;
    }

    var overlay = window.ImageDescriberOverlay;

    // ── Synthetic data factories ──────────────────────────────────────

    /**
     * Build a minimal analysis result containing Florence-2 objects.
     * @param {Array} [items] - Override object items
     * @returns {Object}
     */
    function makeSyntheticAnalysis(items) {
        return {
            ocr: {
                status: 'complete',
                items: [
                    {
                        text: 'Hello',
                        bounds: { x: 0.1, y: 0.1, w: 0.2, h: 0.05 },
                        confidence: 0.95,
                        quadrant: 'top-left',
                        source: 'primary',
                        level: 'word',
                    },
                ],
                suppressedItems: [],
                labelCount: 1,
            },
            colour: { status: 'complete', regions: [] },
            classification: { profile: 'photograph', confidence: 0.8, source: 'heuristic' },
            florenceObjects: {
                status: 'complete',
                items: items || [
                    { label: 'person', bounds: { x1: 50, y1: 20, x2: 200, y2: 400 }, confidence: null },
                    { label: 'tree', bounds: { x1: 300, y1: 100, x2: 500, y2: 450 }, confidence: null },
                    { label: 'car', bounds: { x1: 600, y1: 300, x2: 780, y2: 500 }, confidence: null },
                ],
                duration: 1200,
            },
        };
    }

    /**
     * Create a synthetic preview container with a fake image element
     * that reports known naturalWidth/naturalHeight.
     * @param {number} [natW=800]
     * @param {number} [natH=600]
     * @returns {{ container: HTMLElement, cleanup: Function }}
     */
    function createFakePreview(natW, natH) {
        natW = natW || 800;
        natH = natH || 600;

        var wrapper = document.createElement('div');
        wrapper.id = 'imgdesc-preview-test-' + Date.now();
        wrapper.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:400px;height:300px;';

        var img = document.createElement('img');
        // Use a 1×1 data URI; override naturalWidth/Height via defineProperty
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        Object.defineProperty(img, 'naturalWidth', { value: natW, configurable: true });
        Object.defineProperty(img, 'naturalHeight', { value: natH, configurable: true });

        wrapper.appendChild(img);
        document.body.appendChild(wrapper);

        return {
            container: wrapper,
            cleanup: function () {
                // Destroy overlay first to avoid orphaned elements
                if (overlay._container) overlay.destroy();
                if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
            },
        };
    }

    // ── Register tests ────────────────────────────────────────────────

    window.ImageDescriberTests.register('overlay-objects', {
        name: 'Florence-2 Overlay + Review (Phase 10C)',
        tests: {

            // ══════════════════════════════════════════════════════════
            // 1. Coordinate conversion
            // ══════════════════════════════════════════════════════════

            'pixelBoundsToNormalised converts pixel coords to 0–1 range': function (assert) {
                var fn = overlay._pixelBoundsToNormalised;
                assert.assertNotNull(fn, '_pixelBoundsToNormalised should be exposed');

                var result = fn({ x1: 100, y1: 150, x2: 300, y2: 450 }, 800, 600);
                assert.assertApprox(result.x, 0.125, 0.001, 'x = 100/800');
                assert.assertApprox(result.y, 0.25, 0.001, 'y = 150/600');
                assert.assertApprox(result.w, 0.25, 0.001, 'w = (300-100)/800');
                assert.assertApprox(result.h, 0.5, 0.001, 'h = (450-150)/600');
            },

            'pixelBoundsToNormalised returns zeros for zero dimensions': function (assert) {
                var fn = overlay._pixelBoundsToNormalised;
                var result = fn({ x1: 100, y1: 100, x2: 200, y2: 200 }, 0, 0);
                assert.assertEqual(result.x, 0, 'x should be 0 when naturalWidth is 0');
                assert.assertEqual(result.y, 0, 'y should be 0 when naturalHeight is 0');
                assert.assertEqual(result.w, 0, 'w should be 0');
                assert.assertEqual(result.h, 0, 'h should be 0');
            },

            'pixelBoundsToNormalised handles full-image bounds': function (assert) {
                var fn = overlay._pixelBoundsToNormalised;
                var result = fn({ x1: 0, y1: 0, x2: 800, y2: 600 }, 800, 600);
                assert.assertApprox(result.x, 0, 0.001, 'x should be 0');
                assert.assertApprox(result.y, 0, 0.001, 'y should be 0');
                assert.assertApprox(result.w, 1, 0.001, 'w should be 1');
                assert.assertApprox(result.h, 1, 0.001, 'h should be 1');
            },

            // ══════════════════════════════════════════════════════════
            // 2. Objects layer creation
            // ══════════════════════════════════════════════════════════

            'init creates objects layer alongside OCR and colour layers': function (assert) {
                var preview = createFakePreview();
                try {
                    overlay.init(preview.container);
                    assert.assertNotNull(overlay._layers.objects, 'objects layer should exist');
                    assert.assertEqual(
                        overlay._layers.objects.getAttribute('data-layer'),
                        'objects',
                        'data-layer should be "objects"'
                    );
                    assert.assertEqual(
                        overlay._layers.objects.getAttribute('role'),
                        'group',
                        'role should be "group"'
                    );
                    assert.assertEqual(
                        overlay._layers.objects.getAttribute('aria-label'),
                        'Detected objects',
                        'aria-label should describe layer purpose'
                    );
                    assert.assertTrue(overlay._layers.objects.hidden, 'objects layer should start hidden');
                } finally {
                    preview.cleanup();
                }
            },

            // ══════════════════════════════════════════════════════════
            // 3. Objects rendering
            // ══════════════════════════════════════════════════════════

            'setAnalysis renders object boxes into objects layer': function (assert) {
                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    overlay.setAnalysis(makeSyntheticAnalysis());

                    var boxes = overlay._layers.objects.querySelectorAll('.imgdesc-overlay-box-object');
                    assert.assertEqual(boxes.length, 3, 'Should render 3 object boxes');
                } finally {
                    preview.cleanup();
                }
            },

            'object boxes have correct CSS positioning from pixel bounds': function (assert) {
                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    overlay.setAnalysis(makeSyntheticAnalysis([
                        { label: 'test-obj', bounds: { x1: 200, y1: 150, x2: 600, y2: 450 }, confidence: null },
                    ]));

                    var box = overlay._layers.objects.querySelector('.imgdesc-overlay-box-object');
                    assert.assertNotNull(box, 'Box should exist');

                    // Expected: x=200/800=25%, y=150/600=25%, w=400/800=50%, h=300/600=50%
                    // Browser normalises "25.00%" to "25%" when reading back, so use parseFloat + assertApprox
                    assert.assertApprox(parseFloat(box.style.left), 25, 0.1, 'left should be ~25%');
                    assert.assertApprox(parseFloat(box.style.top), 25, 0.1, 'top should be ~25%');
                    assert.assertApprox(parseFloat(box.style.width), 50, 0.1, 'width should be ~50%');
                    assert.assertApprox(parseFloat(box.style.height), 50, 0.1, 'height should be ~50%');
                } finally {
                    preview.cleanup();
                }
            },

            'object boxes have data-type="object" attribute': function (assert) {
                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    overlay.setAnalysis(makeSyntheticAnalysis());

                    var box = overlay._layers.objects.querySelector('.imgdesc-overlay-box-object');
                    assert.assertEqual(box.getAttribute('data-type'), 'object', 'data-type should be "object"');
                } finally {
                    preview.cleanup();
                }
            },

            'object boxes have accessible label with object name': function (assert) {
                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    overlay.setAnalysis(makeSyntheticAnalysis([
                        { label: 'bicycle', bounds: { x1: 10, y1: 10, x2: 100, y2: 100 }, confidence: null },
                    ]));

                    var box = overlay._layers.objects.querySelector('.imgdesc-overlay-box-object');
                    var label = box.getAttribute('aria-label');
                    assert.assertContains(label, 'bicycle', 'aria-label should contain object name');
                    assert.assertContains(label, 'Object 1', 'aria-label should contain numbered prefix');
                } finally {
                    preview.cleanup();
                }
            },

            'object box label tag shows the object name': function (assert) {
                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    overlay.setAnalysis(makeSyntheticAnalysis([
                        { label: 'lamp', bounds: { x1: 0, y1: 0, x2: 50, y2: 50 }, confidence: null },
                    ]));

                    var labelEl = overlay._layers.objects.querySelector('.imgdesc-overlay-box-label');
                    assert.assertNotNull(labelEl, 'Label element should exist');
                    assert.assertEqual(labelEl.textContent, 'lamp', 'Label text should be object name');
                } finally {
                    preview.cleanup();
                }
            },

            'objects with no bounds are skipped': function (assert) {
                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    overlay.setAnalysis(makeSyntheticAnalysis([
                        { label: 'no-bounds', bounds: null, confidence: null },
                        { label: 'has-bounds', bounds: { x1: 0, y1: 0, x2: 100, y2: 100 }, confidence: null },
                    ]));

                    var boxes = overlay._layers.objects.querySelectorAll('.imgdesc-overlay-box-object');
                    assert.assertEqual(boxes.length, 1, 'Only the item with bounds should render');
                } finally {
                    preview.cleanup();
                }
            },

            'empty florenceObjects items renders no boxes': function (assert) {
                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    overlay.setAnalysis(makeSyntheticAnalysis([]));

                    var boxes = overlay._layers.objects.querySelectorAll('.imgdesc-overlay-box-object');
                    assert.assertEqual(boxes.length, 0, 'No boxes for empty items');
                } finally {
                    preview.cleanup();
                }
            },

            // ══════════════════════════════════════════════════════════
            // 4. Toolbar state
            // ══════════════════════════════════════════════════════════

            'Objects toolbar button enabled when florenceObjects data exists': function (assert) {
                var btn = document.querySelector('.imgdesc-overlay-toggle[data-layer="objects"]');
                if (!btn) {
                    console.warn('[skipped] Objects toolbar button not in DOM');
                    return;
                }

                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    overlay.setAnalysis(makeSyntheticAnalysis());
                    assert.assertFalse(btn.disabled, 'Button should be enabled with object data');
                } finally {
                    preview.cleanup();
                }
            },

            'Objects toolbar button disabled when no florenceObjects': function (assert) {
                var btn = document.querySelector('.imgdesc-overlay-toggle[data-layer="objects"]');
                if (!btn) {
                    console.warn('[skipped] Objects toolbar button not in DOM');
                    return;
                }

                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    var analysis = makeSyntheticAnalysis();
                    delete analysis.florenceObjects;
                    overlay.setAnalysis(analysis);
                    assert.assertTrue(btn.disabled, 'Button should be disabled without object data');
                } finally {
                    preview.cleanup();
                }
            },

            'Objects toolbar button has onclick handler': function (assert) {
                var btn = document.querySelector('.imgdesc-overlay-toggle[data-layer="objects"]');
                if (!btn) {
                    console.warn('[skipped] Objects toolbar button not in DOM');
                    return;
                }
                var onclick = btn.getAttribute('onclick') || '';
                assert.assertContains(
                    onclick,
                    "toggleLayer('objects')",
                    'onclick should call toggleLayer with "objects"'
                );
            },

            // ══════════════════════════════════════════════════════════
            // 5. Layer toggle independence
            // ══════════════════════════════════════════════════════════

            'objects layer toggles independently from OCR layer': function (assert) {
                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    overlay.setAnalysis(makeSyntheticAnalysis());

                    // OCR is auto-shown by _renderFromAnalysis; objects starts hidden
                    assert.assertTrue(overlay.isLayerVisible('ocr'), 'OCR should be visible after render');
                    assert.assertFalse(overlay.isLayerVisible('objects'), 'Objects should start hidden');

                    // Show objects
                    overlay.showLayer('objects');
                    assert.assertTrue(overlay.isLayerVisible('objects'), 'Objects should now be visible');
                    assert.assertTrue(overlay.isLayerVisible('ocr'), 'OCR should still be visible');

                    // Hide OCR — objects should remain
                    overlay.hideLayer('ocr');
                    assert.assertFalse(overlay.isLayerVisible('ocr'), 'OCR should be hidden');
                    assert.assertTrue(overlay.isLayerVisible('objects'), 'Objects should still be visible');

                    // Toggle objects off
                    overlay.toggleLayer('objects');
                    assert.assertFalse(overlay.isLayerVisible('objects'), 'Objects should be toggled off');
                } finally {
                    preview.cleanup();
                }
            },

            // ══════════════════════════════════════════════════════════
            // 6. clearAnalysis cleans up objects layer
            // ══════════════════════════════════════════════════════════

            'clearAnalysis empties objects layer': function (assert) {
                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    overlay.setAnalysis(makeSyntheticAnalysis());

                    var boxesBefore = overlay._layers.objects.querySelectorAll('.imgdesc-overlay-box-object');
                    assert.assertTrue(boxesBefore.length > 0, 'Should have boxes before clear');

                    overlay.clearAnalysis();

                    var boxesAfter = overlay._layers.objects.querySelectorAll('.imgdesc-overlay-box-object');
                    assert.assertEqual(boxesAfter.length, 0, 'Objects layer should be empty after clear');
                } finally {
                    preview.cleanup();
                }
            },

            // ══════════════════════════════════════════════════════════
            // 7. Object review: select, remove, confirm
            // ══════════════════════════════════════════════════════════

            'selectObjectItem highlights box and populates panel': function (assert) {
                if (typeof overlay.selectObjectItem !== 'function') {
                    console.warn('[skipped] selectObjectItem not available — review module may not be loaded');
                    return;
                }

                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    overlay.setAnalysis(makeSyntheticAnalysis());

                    // Reset any leftover state from previous tests
                    overlay._userEdits = null;

                    // Enter review mode (required for selection)
                    overlay.enterReviewMode();

                    overlay.selectObjectItem(0);

                    var box = overlay._layers.objects.querySelector('[data-index="0"]');
                    assert.assertTrue(
                        box.classList.contains('imgdesc-selected'),
                        'Box should have imgdesc-selected class'
                    );

                    overlay.exitReviewMode();
                } finally {
                    preview.cleanup();
                }
            },

            'removeObjectItem marks box as removed': function (assert) {
                if (typeof overlay.removeObjectItem !== 'function') {
                    console.warn('[skipped] removeObjectItem not available');
                    return;
                }

                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    overlay.setAnalysis(makeSyntheticAnalysis());

                    // Reset any leftover state from previous tests
                    overlay._userEdits = null;

                    overlay.enterReviewMode();
                    overlay.selectObjectItem(1);
                    overlay.removeObjectItem(1);

                    var box = overlay._layers.objects.querySelector('[data-index="1"]');
                    assert.assertEqual(
                        box.getAttribute('data-status'),
                        'removed',
                        'Box should have data-status="removed"'
                    );

                    overlay.exitReviewMode();
                } finally {
                    preview.cleanup();
                }
            },

            'confirmObjectItem restores a previously removed object': function (assert) {
                if (typeof overlay.confirmObjectItem !== 'function') {
                    console.warn('[skipped] confirmObjectItem not available');
                    return;
                }

                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    overlay.setAnalysis(makeSyntheticAnalysis());

                    // Reset any leftover state from previous tests
                    overlay._userEdits = null;

                    overlay.enterReviewMode();

                    // Remove then confirm
                    overlay.selectObjectItem(2);
                    overlay.removeObjectItem(2);

                    var box = overlay._layers.objects.querySelector('[data-index="2"]');
                    assert.assertEqual(box.getAttribute('data-status'), 'removed', 'Should be removed first');

                    overlay.selectObjectItem(2);
                    overlay.confirmObjectItem(2);

                    assert.assertFalse(
                        box.hasAttribute('data-status'),
                        'data-status should be removed after confirm'
                    );

                    overlay.exitReviewMode();
                } finally {
                    preview.cleanup();
                }
            },

            // ══════════════════════════════════════════════════════════
            // 8. getCorrectedAnalysis filters removed objects
            // ══════════════════════════════════════════════════════════

            'getCorrectedAnalysis excludes removed objects from florenceObjects.items': function (assert) {
                if (typeof overlay.getCorrectedAnalysis !== 'function') {
                    console.warn('[skipped] getCorrectedAnalysis not available');
                    return;
                }

                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    overlay.setAnalysis(makeSyntheticAnalysis());

                    // Reset any leftover state from previous tests
                    overlay._userEdits = null;

                    overlay.enterReviewMode();

                    // Remove the second object (index 1, "tree")
                    overlay.selectObjectItem(1);
                    overlay.removeObjectItem(1);

                    var corrected = overlay.getCorrectedAnalysis();
                    assert.assertEqual(
                        corrected.florenceObjects.items.length,
                        2,
                        'Should have 2 items after removing 1 of 3'
                    );

                    // Verify the removed item ("tree") is gone
                    var labels = corrected.florenceObjects.items.map(function (item) {
                        return item.label;
                    });
                    assert.assertFalse(
                        labels.indexOf('tree') !== -1,
                        '"tree" should not be in corrected items'
                    );
                    assert.assertTrue(
                        labels.indexOf('person') !== -1,
                        '"person" should still be in corrected items'
                    );
                    assert.assertTrue(
                        labels.indexOf('car') !== -1,
                        '"car" should still be in corrected items'
                    );

                    overlay.exitReviewMode();
                } finally {
                    preview.cleanup();
                }
            },

            'getCorrectedAnalysis with no object removals returns all items': function (assert) {
                if (typeof overlay.getCorrectedAnalysis !== 'function') {
                    console.warn('[skipped] getCorrectedAnalysis not available');
                    return;
                }

                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    overlay.setAnalysis(makeSyntheticAnalysis());

                    // Reset any leftover state from previous tests
                    overlay._userEdits = null;

                    overlay.enterReviewMode();

                    // No removals — just get corrected analysis
                    var corrected = overlay.getCorrectedAnalysis();
                    assert.assertEqual(
                        corrected.florenceObjects.items.length,
                        3,
                        'All 3 items should be present when nothing removed'
                    );

                    overlay.exitReviewMode();
                } finally {
                    preview.cleanup();
                }
            },

            'removing all objects produces empty items array': function (assert) {
                if (typeof overlay.removeObjectItem !== 'function' ||
                    typeof overlay.getCorrectedAnalysis !== 'function') {
                    console.warn('[skipped] Required review methods not available');
                    return;
                }

                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    overlay.setAnalysis(makeSyntheticAnalysis());

                    // Reset any leftover state from previous tests
                    overlay._userEdits = null;

                    overlay.enterReviewMode();

                    overlay.selectObjectItem(0);
                    overlay.removeObjectItem(0);
                    overlay.selectObjectItem(1);
                    overlay.removeObjectItem(1);
                    overlay.selectObjectItem(2);
                    overlay.removeObjectItem(2);

                    var corrected = overlay.getCorrectedAnalysis();
                    assert.assertEqual(
                        corrected.florenceObjects.items.length,
                        0,
                        'All items should be filtered out'
                    );

                    overlay.exitReviewMode();
                } finally {
                    preview.cleanup();
                }
            },

            // ══════════════════════════════════════════════════════════
            // 9. hasCorrections includes object removals
            // ══════════════════════════════════════════════════════════

            'hasCorrections returns true after removing an object': function (assert) {
                if (typeof overlay.hasCorrections !== 'function') {
                    console.warn('[skipped] hasCorrections not available');
                    return;
                }

                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);
                    overlay.setAnalysis(makeSyntheticAnalysis());

                    // Reset any leftover state from previous tests
                    overlay._userEdits = null;

                    overlay.enterReviewMode();

                    assert.assertFalse(overlay.hasCorrections(), 'No corrections initially');

                    overlay.selectObjectItem(0);
                    overlay.removeObjectItem(0);

                    assert.assertTrue(overlay.hasCorrections(), 'Should have corrections after removal');

                    overlay.exitReviewMode();
                } finally {
                    preview.cleanup();
                }
            },

            // ══════════════════════════════════════════════════════════
            // 10. Re-render preserves objects layer
            // ══════════════════════════════════════════════════════════

            'calling setAnalysis again re-renders object boxes': function (assert) {
                var preview = createFakePreview(800, 600);
                try {
                    overlay.init(preview.container);

                    // First render: 3 objects
                    overlay.setAnalysis(makeSyntheticAnalysis());
                    var boxes1 = overlay._layers.objects.querySelectorAll('.imgdesc-overlay-box-object');
                    assert.assertEqual(boxes1.length, 3, 'First render: 3 boxes');

                    // Second render: 1 object
                    overlay.setAnalysis(makeSyntheticAnalysis([
                        { label: 'only-one', bounds: { x1: 0, y1: 0, x2: 100, y2: 100 }, confidence: null },
                    ]));
                    var boxes2 = overlay._layers.objects.querySelectorAll('.imgdesc-overlay-box-object');
                    assert.assertEqual(boxes2.length, 1, 'Second render: 1 box');
                } finally {
                    preview.cleanup();
                }
            },
        },
    });

})();
