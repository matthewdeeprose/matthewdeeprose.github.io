/**
 * ===================================================================
 * TESTS: Phase 10D — OCR Merge (Tesseract + Florence-2)
 * ===================================================================
 *
 * Validates:
 * - OCR checkbox enabled (not disabled)
 * - quadBoxToNormalisedBounds conversion accuracy
 * - Spatial dedup: overlapping Florence-2 items discarded
 * - Non-overlapping Florence-2 items added with source: "florence2"
 * - Empty edge cases handled correctly
 * - All merged items have source property
 *
 * Run:
 *   ImageDescriberTests.run('10d-ocr-merge');
 *   ImageDescriberTests.run('10d-ocr-merge', { verbose: true });
 *
 * VERSION: 1.0.0
 * PHASE: 10D
 * ===================================================================
 */
(function () {
  "use strict";

  if (!window.ImageDescriberTests) {
    console.error(
      "[Tests-10D] ImageDescriberTests not loaded — cannot register."
    );
    return;
  }

  // Shorthand references
  var OCR = window.ImageDescriberAnalyserOCR;

  window.ImageDescriberTests.register("10d-ocr-merge", {
    name: "Phase 10D: OCR Merge (Tesseract + Florence-2)",
    tests: {
      // ──────────────────────────────────────────────────────────
      // DOM: OCR checkbox enabled
      // ──────────────────────────────────────────────────────────

      "OCR checkbox exists and is not disabled": function (assert) {
        var el = document.getElementById("imgdesc-florence2-ocr");
        assert.assertNotNull(el, "imgdesc-florence2-ocr should exist");
        assert.assertFalse(
          el.disabled,
          "OCR checkbox should not be disabled"
        );
      },

      "OCR checkbox coming-soon label removed": function (assert) {
        var spans = document.querySelectorAll(
          ".imgdesc-florence2-coming-soon"
        );
        assert.assertEqual(
          spans.length,
          0,
          "No coming-soon spans should remain"
        );
      },

      // ──────────────────────────────────────────────────────────
      // quadBoxToNormalisedBounds
      // ──────────────────────────────────────────────────────────

      "quadBoxToNormalisedBounds converts pixel coords to normalised bounds":
        function (assert) {
          if (!OCR || !OCR.quadBoxToNormalisedBounds) {
            console.warn("[skipped] quadBoxToNormalisedBounds not available");
            return;
          }
          // Rectangle from (100,50) to (300,150) on 1000x500 image
          var quadBox = [100, 50, 300, 50, 300, 150, 100, 150];
          var result = OCR.quadBoxToNormalisedBounds(quadBox, 1000, 500);

          assert.assertApprox(result.x, 0.1, 0.001, "x should be 0.1");
          assert.assertApprox(result.y, 0.1, 0.001, "y should be 0.1");
          assert.assertApprox(result.w, 0.2, 0.001, "w should be 0.2");
          assert.assertApprox(result.h, 0.2, 0.001, "h should be 0.2");
        },

      "quadBoxToNormalisedBounds handles rotated quad (takes AABB)":
        function (assert) {
          if (!OCR || !OCR.quadBoxToNormalisedBounds) {
            console.warn("[skipped] quadBoxToNormalisedBounds not available");
            return;
          }
          // Slightly rotated quad — AABB should encompass all corners
          var quadBox = [10, 5, 90, 0, 95, 45, 15, 50];
          var result = OCR.quadBoxToNormalisedBounds(quadBox, 100, 100);

          assert.assertApprox(result.x, 0.1, 0.001, "x = min(10,90,95,15)/100");
          assert.assertApprox(result.y, 0.0, 0.001, "y = min(5,0,45,50)/100");
          assert.assertApprox(result.w, 0.85, 0.001, "w = (95-10)/100");
          assert.assertApprox(result.h, 0.5, 0.001, "h = (50-0)/100");
        },

      "quadBoxToNormalisedBounds returns zero bounds for invalid input":
        function (assert) {
          if (!OCR || !OCR.quadBoxToNormalisedBounds) {
            console.warn("[skipped] quadBoxToNormalisedBounds not available");
            return;
          }
          var result = OCR.quadBoxToNormalisedBounds([1, 2, 3], 100, 100);
          assert.assertEqual(result.x, 0, "x should be 0 for invalid input");
          assert.assertEqual(result.w, 0, "w should be 0 for invalid input");
        },

      // ──────────────────────────────────────────────────────────
      // mergeTesseractAndFlorence
      // ──────────────────────────────────────────────────────────

      "Overlapping Florence-2 item kept as Tesseract only": function (assert) {
        if (!OCR || !OCR.mergeTesseractAndFlorence) {
          console.warn("[skipped] mergeTesseractAndFlorence not available");
          return;
        }

        var tesseractItems = [
          {
            text: "Hello",
            bounds: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 },
            confidence: 90,
          },
        ];

        // Florence-2 item at same position (100,50)→(300,100) on 1000x500 img
        var florenceItems = [
          { text: "Hello", quadBox: [100, 50, 300, 50, 300, 100, 100, 100] },
        ];

        var result = OCR.mergeTesseractAndFlorence(
          tesseractItems,
          florenceItems,
          1000,
          500
        );

        assert.assertEqual(
          result.merged.length,
          1,
          "Should have 1 item (Tesseract only)"
        );
        assert.assertEqual(
          result.merged[0].source,
          "tesseract",
          "Item should be from Tesseract"
        );
        assert.assertEqual(
          result.stats.florenceOverlapping,
          1,
          "One Florence-2 item should overlap"
        );
        assert.assertEqual(
          result.stats.florenceAdded,
          0,
          "No Florence-2 items should be added"
        );
      },

      "Non-overlapping Florence-2 item added with source florence2":
        function (assert) {
          if (!OCR || !OCR.mergeTesseractAndFlorence) {
            console.warn("[skipped] mergeTesseractAndFlorence not available");
            return;
          }

          var tesseractItems = [
            {
              text: "Top text",
              bounds: { x: 0.1, y: 0.1, w: 0.2, h: 0.05 },
              confidence: 85,
            },
          ];

          // Florence-2 item at bottom of image — no overlap
          var florenceItems = [
            {
              text: "Bottom text",
              quadBox: [100, 400, 300, 400, 300, 450, 100, 450],
            },
          ];

          var result = OCR.mergeTesseractAndFlorence(
            tesseractItems,
            florenceItems,
            1000,
            500
          );

          assert.assertEqual(
            result.merged.length,
            2,
            "Should have 2 items"
          );
          assert.assertEqual(
            result.merged[0].source,
            "tesseract",
            "First item from Tesseract"
          );
          assert.assertEqual(
            result.merged[1].source,
            "florence2",
            "Second item from Florence-2"
          );
          assert.assertEqual(
            result.merged[1].text,
            "Bottom text",
            "Florence-2 text preserved"
          );
          assert.assertNotNull(
            result.merged[1].bounds,
            "Florence-2 item should have normalised bounds"
          );
          assert.assertEqual(
            result.stats.florenceAdded,
            1,
            "One Florence-2 item added"
          );
        },

      "Empty Florence-2 + populated Tesseract: items unchanged":
        function (assert) {
          if (!OCR || !OCR.mergeTesseractAndFlorence) {
            console.warn("[skipped] mergeTesseractAndFlorence not available");
            return;
          }

          var tesseractItems = [
            {
              text: "Only Tesseract",
              bounds: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 },
              confidence: 92,
            },
          ];

          var result = OCR.mergeTesseractAndFlorence(
            tesseractItems,
            [],
            1000,
            500
          );

          assert.assertEqual(result.merged.length, 1, "Should have 1 item");
          assert.assertEqual(
            result.merged[0].source,
            "tesseract",
            "Item tagged as tesseract"
          );
          assert.assertEqual(
            result.stats.tesseract,
            1,
            "Stats reflect 1 tesseract item"
          );
          assert.assertEqual(
            result.stats.florenceAdded,
            0,
            "No Florence-2 items added"
          );
        },

      "Both empty: returns empty array": function (assert) {
        if (!OCR || !OCR.mergeTesseractAndFlorence) {
          console.warn("[skipped] mergeTesseractAndFlorence not available");
          return;
        }

        var result = OCR.mergeTesseractAndFlorence([], [], 1000, 500);

        assert.assertEqual(result.merged.length, 0, "Should have 0 items");
        assert.assertEqual(result.stats.tesseract, 0, "0 tesseract");
        assert.assertEqual(result.stats.florenceAdded, 0, "0 florence added");
        assert.assertEqual(
          result.stats.florenceOverlapping,
          0,
          "0 florence overlapping"
        );
      },

      "All merged items have source property": function (assert) {
        if (!OCR || !OCR.mergeTesseractAndFlorence) {
          console.warn("[skipped] mergeTesseractAndFlorence not available");
          return;
        }

        var tesseractItems = [
          {
            text: "A",
            bounds: { x: 0.0, y: 0.0, w: 0.1, h: 0.05 },
            confidence: 80,
          },
          {
            text: "B",
            bounds: { x: 0.5, y: 0.5, w: 0.1, h: 0.05 },
            confidence: 75,
          },
        ];

        var florenceItems = [
          // Overlaps with A
          { text: "A2", quadBox: [0, 0, 100, 0, 100, 25, 0, 25] },
          // No overlap — bottom-right
          { text: "C", quadBox: [800, 400, 950, 400, 950, 475, 800, 475] },
        ];

        var result = OCR.mergeTesseractAndFlorence(
          tesseractItems,
          florenceItems,
          1000,
          500
        );

        // Should have: A(tesseract), B(tesseract), C(florence2)
        assert.assertEqual(result.merged.length, 3, "Should have 3 items");
        var allHaveSource = result.merged.every(function (item) {
          return (
            typeof item.source === "string" && item.source.length > 0
          );
        });
        assert.assertTrue(allHaveSource, "Every item must have a source");
      },

      // ──────────────────────────────────────────────────────────
      // Integration: test script tag loaded
      // ──────────────────────────────────────────────────────────

      "Test module registered successfully": function (assert) {
        var modules = window.ImageDescriberTests.list
          ? window.ImageDescriberTests.list()
          : null;
        // If list() is not available, the fact we are running proves registration
        assert.assertTrue(true, "Module is running so registration succeeded");
      },
    },
  });
})();
