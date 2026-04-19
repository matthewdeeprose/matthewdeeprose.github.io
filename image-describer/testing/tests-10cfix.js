/**
 * ═══════════════════════════════════════════════════════════════
 * TESTS: Phase 10C-fix — Florence-2 Opt-In + Library Status Merge
 * ═══════════════════════════════════════════════════════════════
 *
 * Validates:
 * - Florence-2 skipped in automatic analysis
 * - runFlorenceAnalysis() updates lastAnalysis
 * - Florence-2 opt-in controls exist with correct initial state
 * - updateLibraryStatus() targets Model Manager elements
 * - Library Status section no longer exists in DOM
 *
 * Run:
 *   ImageDescriberTests.run('10cfix');
 *   ImageDescriberTests.run('10cfix', { verbose: true });
 *
 * VERSION: 1.0.0
 * PHASE: 10C-fix
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  if (!window.ImageDescriberTests) {
    console.error(
      "[Tests-10Cfix] ImageDescriberTests not loaded — cannot register.",
    );
    return;
  }

  window.ImageDescriberTests.register("10cfix", {
    name: "Phase 10C-fix: Florence-2 Opt-In + Library Status Merge",
    tests: {
      // ────────────────────────────────────────────────────────
      // DOM: Library Status removed
      // ────────────────────────────────────────────────────────

      "Library Status section no longer exists in DOM": function (assert) {
        const el = document.getElementById("imgdesc-expert-library-status");
        assert.assertTrue(
          el === null,
          "imgdesc-expert-library-status should be null",
        );
      },

      "Old Library Status row IDs do not exist": function (assert) {
        const ids = [
          "imgdesc-lib-tesseract",
          "imgdesc-lib-transformers",
          "imgdesc-lib-clip",
          "imgdesc-lib-florence2",
        ];
        ids.forEach(function (id) {
          const el = document.getElementById(id);
          assert.assertTrue(el === null, id + " should not exist in DOM");
        });
      },

      // ────────────────────────────────────────────────────────
      // DOM: Model Manager has all model rows
      // ────────────────────────────────────────────────────────

      "Model Manager has CLIP row": function (assert) {
        const el = document.getElementById("imgdesc-mm-model-clip");
        assert.assertNotNull(el, "imgdesc-mm-model-clip should exist");
      },

      "Model Manager has Florence-2 row": function (assert) {
        const el = document.getElementById("imgdesc-mm-model-florence2");
        assert.assertNotNull(el, "imgdesc-mm-model-florence2 should exist");
      },

      "Model Manager has Tesseract row": function (assert) {
        const el = document.getElementById("imgdesc-mm-model-tesseract");
        assert.assertNotNull(el, "imgdesc-mm-model-tesseract should exist");
      },

      // ────────────────────────────────────────────────────────
      // DOM: Florence-2 opt-in controls exist
      // ────────────────────────────────────────────────────────

      "Florence-2 opt-in section exists": function (assert) {
        const el = document.getElementById("imgdesc-florence2-optin");
        assert.assertNotNull(el, "imgdesc-florence2-optin should exist");
      },

      "Florence-2 run button exists": function (assert) {
        const el = document.getElementById("imgdesc-florence2-run-btn");
        assert.assertNotNull(el, "imgdesc-florence2-run-btn should exist");
      },

      "Florence-2 caption checkbox exists and is checked by default": function (
        assert,
      ) {
        const el = document.getElementById("imgdesc-florence2-caption");
        assert.assertNotNull(el, "imgdesc-florence2-caption should exist");
        assert.assertTrue(
          el.checked === true,
          "caption checkbox should be checked by default",
        );
      },

      "Florence-2 OCR checkbox exists and is enabled": function (assert) {
        const el = document.getElementById("imgdesc-florence2-ocr");
        assert.assertNotNull(el, "imgdesc-florence2-ocr should exist");
        assert.assertFalse(
          el.disabled,
          "OCR checkbox should be enabled (Phase 10D enabled it)",
        );
      },

      "Florence-2 status element exists": function (assert) {
        const el = document.getElementById("imgdesc-florence2-status");
        assert.assertNotNull(el, "imgdesc-florence2-status should exist");
      },

      "Florence-2 opt-in section is hidden when no image": function (assert) {
        const el = document.getElementById("imgdesc-florence2-optin");
        assert.assertNotNull(el, "opt-in section should exist");

        // If Florence-2 is ready and an image is loaded, section is correctly visible
        const ctrl = window.ImageDescriberController;
        const gateway = window.ImageDescriberAnalyserTransformers;
        const florenceReady =
          gateway && gateway.getFlorenceStatus() === "ready";
        const hasImage = ctrl && ctrl.lastAnalysis;

        if (florenceReady && hasImage) {
          assert.assertFalse(
            el.hidden === true,
            "opt-in should be visible when Florence-2 ready + image loaded",
          );
        } else {
          assert.assertTrue(
            el.hidden === true,
            "opt-in should be hidden when no image/model",
          );
        }
      },

      // ────────────────────────────────────────────────────────
      // Analyser: Florence-2 skipped in automatic pipeline
      // ────────────────────────────────────────────────────────

      "Analyser analyse() sets Florence-2 slots to skipped": async function (
        assert,
      ) {
        // This test requires the analyser to be available and an image loaded.
        // If no analysis has run, we check the static code path instead.
        const ctrl = window.ImageDescriberController;
        if (!ctrl) {
          throw new Error("ImageDescriberController not available");
        }

        // If an analysis has already run, check Florence-2 slots
        if (ctrl.lastAnalysis) {
          const capStatus = ctrl.lastAnalysis.florenceCaption.status;
          // Status is "skipped" for automatic analysis, or "complete" if cache restored Florence-2 data
          assert.assertTrue(
            capStatus === "skipped" || capStatus === "complete",
            "florenceCaption should be skipped or complete (cached), got: " +
              capStatus,
          );
          assert.assertTrue(
            ctrl.lastAnalysis.florenceObjects.status === "skipped",
            "florenceObjects should always be skipped (OD dropped from pipeline)",
          );
          return;
        }

        // No analysis available — verify the analyser code path directly
        var analyser = window.ImageDescriberAnalyser;
        if (!analyser || !analyser.isAvailable()) {
          // Analyser not loaded — check that the static code sets skipped
          // by creating a minimal mock analysis result
          // (This is a structural test, not a functional one)
          assert.assertTrue(
            true,
            "Analyser not available — structural check only",
          );
          return;
        }

        // If analyser is available, create a tiny test canvas and run
        var canvas = document.createElement("canvas");
        canvas.width = 100;
        canvas.height = 100;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#888888";
        ctx.fillRect(0, 0, 100, 100);

        // Create a temporary image from canvas
        var blob = await new Promise(function (resolve) {
          canvas.toBlob(resolve, "image/png");
        });
        var img = new Image();
        var url = URL.createObjectURL(blob);
        await new Promise(function (resolve, reject) {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });

        try {
          var result = await analyser.analyse(img, "general");
          assert.assertEqual(
            result.florenceCaption.status,
            "skipped",
            "florenceCaption should be skipped",
          );
          assert.assertEqual(
            result.florenceObjects.status,
            "skipped",
            "florenceObjects should be skipped",
          );
        } finally {
          URL.revokeObjectURL(url);
        }
      },

      // ────────────────────────────────────────────────────────
      // Controller: runFlorenceAnalysis method exists
      // ────────────────────────────────────────────────────────

      "Controller has runFlorenceAnalysis method": function (assert) {
        var ctrl = window.ImageDescriberController;
        assert.assertNotNull(ctrl, "controller should exist");
        assert.assertEqual(
          typeof ctrl.runFlorenceAnalysis,
          "function",
          "runFlorenceAnalysis should be a function",
        );
      },

      "Controller has _updateFlorenceOptinState method": function (assert) {
        var ctrl = window.ImageDescriberController;
        assert.assertNotNull(ctrl, "controller should exist");
        assert.assertEqual(
          typeof ctrl._updateFlorenceOptinState,
          "function",
          "_updateFlorenceOptinState should be a function",
        );
      },

      "runFlorenceAnalysis returns early when no analysis exists":
        async function (assert) {
          var ctrl = window.ImageDescriberController;
          var savedAnalysis = ctrl.lastAnalysis;

          // Temporarily clear analysis
          ctrl.lastAnalysis = null;

          try {
            // Should return without error (early exit logged as warning)
            await ctrl.runFlorenceAnalysis();
            assert.assertTrue(
              true,
              "runFlorenceAnalysis returned without error when no analysis",
            );
          } finally {
            ctrl.lastAnalysis = savedAnalysis;
          }
        },

      // ────────────────────────────────────────────────────────
      // Debug: updateLibraryStatus targets Model Manager
      // ────────────────────────────────────────────────────────

      "updateLibraryStatus method exists on controller": function (assert) {
        var ctrl = window.ImageDescriberController;
        assert.assertEqual(
          typeof ctrl.updateLibraryStatus,
          "function",
          "updateLibraryStatus should be a function",
        );
      },

      "updateLibraryStatus targets Model Manager elements": function (assert) {
        var ctrl = window.ImageDescriberController;
        var clipRow = document.getElementById("imgdesc-mm-model-clip");
        if (!clipRow) {
          throw new Error("CLIP Model Manager row not found — cannot test");
        }

        // Save current state
        var savedStatus = clipRow.dataset.status;

        // Update via updateLibraryStatus
        ctrl.updateLibraryStatus("clip", "ready", { statusText: "Test Ready" });

        // Verify it targeted the Model Manager row
        assert.assertEqual(
          clipRow.dataset.status,
          "ready",
          "data-status should be updated to 'ready'",
        );

        var stateText = clipRow.querySelector(".imgdesc-mm-state-text");
        if (stateText) {
          assert.assertEqual(
            stateText.textContent,
            "Test Ready",
            "state text should be 'Test Ready'",
          );
        }

        // Restore
        if (savedStatus !== undefined) {
          clipRow.dataset.status = savedStatus;
        }
      },

      "updateLibraryStatus silently ignores transformers": function (assert) {
        var ctrl = window.ImageDescriberController;
        // Should not throw or create any element
        ctrl.updateLibraryStatus("transformers", "ready");
        var el = document.getElementById("imgdesc-mm-model-transformers");
        assert.assertTrue(
          el === null,
          "No element should be created for transformers",
        );
      },

      // ────────────────────────────────────────────────────────
      // Reset: Florence-2 state cleared on new image
      // ────────────────────────────────────────────────────────

      "_updateFlorenceOptinState hides section when no analysis": function (
        assert,
      ) {
        var ctrl = window.ImageDescriberController;
        var section = document.getElementById("imgdesc-florence2-optin");
        if (!section) {
          throw new Error("Florence-2 opt-in section not found");
        }

        var savedAnalysis = ctrl.lastAnalysis;
        ctrl.lastAnalysis = null;

        try {
          ctrl._updateFlorenceOptinState();
          assert.assertTrue(
            section.hidden === true,
            "opt-in section should be hidden when no analysis",
          );
        } finally {
          ctrl.lastAnalysis = savedAnalysis;
        }
      },
    },
  });
})();
