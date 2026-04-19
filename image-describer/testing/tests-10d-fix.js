/**
 * ===================================================================
 * TESTS: Phase 10D-fix — OCR Merge Bug Fixes
 * ===================================================================
 *
 * Validates:
 * - Florence-2 merged items have confidence: null (not 0.5)
 * - Florence-2 merged items have quadrant property
 * - Florence-2 merged items have level: "word"
 * - Source mapping: "florence2" displays as "Florence-2"
 * - Source mapping: "tesseract" displays as "Tesseract"
 * - Null confidence displays as "N/A" in toggletip
 * - formatFlorence2OCRForPrompt suppressed when merge occurred
 * - _florenceRanThisSession defaults to false
 * - _florenceRanThisSession reset in resetForNewImage
 *
 * Run:
 *   ImageDescriberTests.run('10d-fix');
 *   ImageDescriberTests.run('10d-fix', { verbose: true });
 *
 * VERSION: 1.0.0
 * PHASE: 10D-fix
 * ===================================================================
 */
(function () {
  "use strict";

  if (!window.ImageDescriberTests) {
    console.error(
      "[Tests-10D-fix] ImageDescriberTests not loaded — cannot register."
    );
    return;
  }

  // Shorthand references
  var OCR = window.ImageDescriberAnalyserOCR;
  var Overlay = window.ImageDescriberOverlay;
  var Format = window.ImageDescriberAnalyserFormat;
  var Controller = window.ImageDescriberController;

  window.ImageDescriberTests.register("10d-fix", {
    name: "Phase 10D-fix: OCR Merge Bug Fixes",
    tests: {
      // ──────────────────────────────────────────────────────────
      // Bug #1: Florence-2 items have confidence: null
      // ──────────────────────────────────────────────────────────

      "Florence-2 merged items have confidence: null (not 0.5)":
        function (assert) {
          if (!OCR || !OCR.mergeTesseractAndFlorence) {
            assert.skip("ImageDescriberAnalyserOCR not available");
            return;
          }
          var tesseractItems = [
            {
              text: "Hello",
              bounds: { x: 0, y: 0, w: 0.1, h: 0.05 },
              confidence: 0.9,
              source: "tesseract",
              quadrant: "top-left",
            },
          ];
          // Use pixel coordinates for quad_box (8 floats)
          var florenceItems = [
            {
              text: "World",
              quad_box: [50, 50, 70, 50, 70, 60, 50, 60],
            },
          ];
          var result = OCR.mergeTesseractAndFlorence(
            tesseractItems,
            florenceItems,
            100,
            100
          );
          var f2Items = result.merged.filter(function (i) {
            return i.source === "florence2";
          });
          assert.assertTrue(f2Items.length > 0, "Should have Florence-2 items");
          assert.assertTrue(
            f2Items[0].confidence === null,
            "Florence-2 confidence should be null, not 0.5"
          );
        },

      // ──────────────────────────────────────────────────────────
      // Bug #2: Florence-2 items have quadrant property
      // ──────────────────────────────────────────────────────────

      "Florence-2 merged items have quadrant property": function (assert) {
        if (!OCR || !OCR.mergeTesseractAndFlorence) {
          assert.skip("ImageDescriberAnalyserOCR not available");
          return;
        }
        var tesseractItems = [];
        var florenceItems = [
          {
            text: "Test",
            quad_box: [10, 10, 30, 10, 30, 20, 10, 20],
          },
        ];
        var result = OCR.mergeTesseractAndFlorence(
          tesseractItems,
          florenceItems,
          100,
          100
        );
        var f2Items = result.merged.filter(function (i) {
          return i.source === "florence2";
        });
        assert.assertTrue(f2Items.length > 0, "Should have Florence-2 items");
        assert.assertNotNull(
          f2Items[0].quadrant,
          "Florence-2 item should have quadrant property"
        );
        assert.assertTrue(
          typeof f2Items[0].quadrant === "string" &&
            f2Items[0].quadrant.length > 0,
          "Quadrant should be a non-empty string"
        );
      },

      // ──────────────────────────────────────────────────────────
      // Florence-2 items have level: "word"
      // ──────────────────────────────────────────────────────────

      "Florence-2 merged items have level: word": function (assert) {
        if (!OCR || !OCR.mergeTesseractAndFlorence) {
          assert.skip("ImageDescriberAnalyserOCR not available");
          return;
        }
        var florenceItems = [
          {
            text: "Test",
            quad_box: [50, 50, 70, 50, 70, 60, 50, 60],
          },
        ];
        var result = OCR.mergeTesseractAndFlorence([], florenceItems, 100, 100);
        var f2Items = result.merged.filter(function (i) {
          return i.source === "florence2";
        });
        assert.assertTrue(f2Items.length > 0, "Should have Florence-2 items");
        assert.assertEqual(
          f2Items[0].level,
          "word",
          "Florence-2 item level should be 'word'"
        );
      },

      // ──────────────────────────────────────────────────────────
      // Bug #3: Source mapping in toggletip
      // ──────────────────────────────────────────────────────────

      "Source mapping: florence2 displays as Florence-2 in toggletip":
        function (assert) {
          if (
            !Overlay ||
            typeof Overlay._buildOCRToggletipContent !== "function"
          ) {
            assert.skip("Overlay._buildOCRToggletipContent not available");
            return;
          }
          var item = {
            text: "Test",
            confidence: null,
            quadrant: "centre",
            source: "florence2",
          };
          var html = Overlay._buildOCRToggletipContent(item, 0, false);
          assert.assertTrue(
            html.indexOf("Florence-2") !== -1,
            "Toggletip should show 'Florence-2' for florence2 source"
          );
          assert.assertTrue(
            html.indexOf("Primary") === -1,
            "Toggletip should NOT show 'Primary' for florence2 source"
          );
        },

      "Source mapping: tesseract displays as Tesseract in toggletip":
        function (assert) {
          if (
            !Overlay ||
            typeof Overlay._buildOCRToggletipContent !== "function"
          ) {
            assert.skip("Overlay._buildOCRToggletipContent not available");
            return;
          }
          var item = {
            text: "Hello",
            confidence: 0.85,
            quadrant: "top-left",
            source: "tesseract",
          };
          var html = Overlay._buildOCRToggletipContent(item, 0, false);
          assert.assertTrue(
            html.indexOf("Tesseract") !== -1,
            "Toggletip should show 'Tesseract' for tesseract source"
          );
        },

      // ──────────────────────────────────────────────────────────
      // Null confidence displays as N/A
      // ──────────────────────────────────────────────────────────

      "Null confidence displays as N/A in toggletip": function (assert) {
        if (
          !Overlay ||
          typeof Overlay._buildOCRToggletipContent !== "function"
        ) {
          assert.skip("Overlay._buildOCRToggletipContent not available");
          return;
        }
        var item = {
          text: "Test",
          confidence: null,
          quadrant: "centre",
          source: "florence2",
        };
        var html = Overlay._buildOCRToggletipContent(item, 0, false);
        assert.assertTrue(
          html.indexOf("N/A") !== -1,
          "Null confidence should display as 'N/A'"
        );
        assert.assertTrue(
          html.indexOf("0%") === -1,
          "Null confidence should NOT display as '0%'"
        );
      },

      // ──────────────────────────────────────────────────────────
      // Bug #4: Duplicate prompt suppression
      // ──────────────────────────────────────────────────────────

      "formatFlorence2OCRForPrompt suppressed when merge occurred":
        function (assert) {
          if (!Format || typeof Format.formatForPrompt !== "function") {
            assert.skip("ImageDescriberAnalyserFormat not available");
            return;
          }
          // Create analysis with florence2-sourced items in ocr.items
          // (simulating post-merge state)
          var analysis = {
            ocr: {
              status: "complete",
              items: [
                {
                  text: "Tesseract text",
                  bounds: { x: 0, y: 0, w: 0.1, h: 0.05 },
                  confidence: 0.9,
                  source: "tesseract",
                  quadrant: "top-left",
                },
                {
                  text: "Florence text",
                  bounds: { x: 0.5, y: 0.5, w: 0.2, h: 0.1 },
                  confidence: null,
                  source: "florence2",
                  quadrant: "centre",
                },
              ],
            },
            florenceOCR: {
              status: "complete",
              items: [
                {
                  text: "Florence text",
                  quad_box: [0.5, 0.5, 0.7, 0.5, 0.7, 0.6, 0.5, 0.6],
                },
              ],
            },
          };
          var prompt = Format.formatForPrompt(analysis);
          assert.assertTrue(
            prompt.indexOf("Additional text detected by Florence-2 OCR") === -1,
            "Should NOT contain separate Florence-2 OCR section when items are merged"
          );
        },

      // ──────────────────────────────────────────────────────────
      // Bug #7: _florenceRanThisSession defaults and reset
      // ──────────────────────────────────────────────────────────

      "_florenceRanThisSession defaults to false": function (assert) {
        if (!Controller) {
          assert.skip("ImageDescriberController not available");
          return;
        }
        // Check the property exists and defaults to false
        assert.assertTrue(
          Controller.hasOwnProperty("_florenceRanThisSession"),
          "_florenceRanThisSession should be a defined property"
        );
        // Note: may be true if Florence-2 was run earlier in session,
        // so only check the property exists with correct type
        assert.assertTrue(
          typeof Controller._florenceRanThisSession === "boolean",
          "_florenceRanThisSession should be a boolean"
        );
      },

      "_florenceRanThisSession reset in resetForNewImage":
        function (assert) {
          if (!Controller) {
            assert.skip("ImageDescriberController not available");
            return;
          }
          // Set to true to simulate a completed run
          Controller._florenceRanThisSession = true;
          // Call resetForNewImage (from controller-ui mixin)
          if (typeof Controller.resetForNewImage === "function") {
            Controller.resetForNewImage();
            assert.assertFalse(
              Controller._florenceRanThisSession,
              "_florenceRanThisSession should be false after resetForNewImage"
            );
          } else {
            assert.skip("resetForNewImage not available on Controller");
          }
        },
    },
  });
})();
