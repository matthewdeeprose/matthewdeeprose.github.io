/**
 * Phase 12-prep: Transformers.js v4 Compatibility Tests
 *
 * Purpose: Establish a passing baseline on Transformers.js v3.8.1.
 *          When the CDN URL is swapped to v4, failures pinpoint breakages.
 *
 * Run:
 *   ImageDescriberTests.run('v4-compat', { verbose: true });
 *
 * Groups:
 *   1. Gateway module existence (no library load)
 *   2. Library load and class verification (CDN fetch)
 *   3. Model Manager registry consistency
 *   4. Real model pipeline tests (skip if not cached)
 *   5. Cleanup and destroy verification
 */
(function () {
  "use strict";

  if (!window.ImageDescriberTests) {
    console.error(
      "[Tests-12-prep] ImageDescriberTests not loaded — cannot register."
    );
    return;
  }

  // ── Helpers ──────────────────────────────────────────────────

  /**
   * Create a small synthetic test image (10x10 solid colour).
   * Returns a data URL suitable for pipeline input.
   */
  function createTestImage() {
    var canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#336699";
    ctx.fillRect(0, 0, 10, 10);
    return canvas.toDataURL("image/png");
  }

  /**
   * Check whether a model is cached (or already loaded) via Model Manager.
   * Returns true if safe to run pipeline tests, false otherwise.
   */
  function isModelCached(modelKey) {
    if (!window.ImageDescriberModelManager) return false;
    var state = window.ImageDescriberModelManager.getModelState(modelKey);
    return state === "cached" || state === "loaded";
  }

  // ── Registration ─────────────────────────────────────────────

  window.ImageDescriberTests.register("v4-compat", {
    name: "Phase 12-prep: Transformers.js v4 Compatibility",
    tests: {
      // ── Group 1: Gateway module existence ───────────────────

      "Gateway module is loaded": function (assert) {
        assert.assertNotNull(
          window.ImageDescriberAnalyserTransformers,
          "ImageDescriberAnalyserTransformers should exist on window"
        );
      },

      "Gateway exposes ensureLibrary method": function (assert) {
        var T = window.ImageDescriberAnalyserTransformers;
        assert.assertTrue(
          typeof T.ensureLibrary === "function",
          "ensureLibrary should be a function"
        );
      },

      "Gateway exposes classifyImage method": function (assert) {
        var T = window.ImageDescriberAnalyserTransformers;
        assert.assertTrue(
          typeof T.classifyImage === "function",
          "classifyImage should be a function"
        );
      },

      "Gateway exposes ensureFlorence method": function (assert) {
        var T = window.ImageDescriberAnalyserTransformers;
        assert.assertTrue(
          typeof T.ensureFlorence === "function",
          "ensureFlorence should be a function"
        );
      },

      "Gateway exposes estimateDepth method": function (assert) {
        var T = window.ImageDescriberAnalyserTransformers;
        assert.assertTrue(
          typeof T.estimateDepth === "function",
          "estimateDepth should be a function"
        );
      },

      "Gateway exposes destroy method": function (assert) {
        var T = window.ImageDescriberAnalyserTransformers;
        assert.assertTrue(
          typeof T.destroy === "function",
          "destroy should be a function"
        );
      },

      "Gateway exposes FLORENCE_MODEL_ID constant": function (assert) {
        var T = window.ImageDescriberAnalyserTransformers;
        assert.assertEqual(
          T.FLORENCE_MODEL_ID,
          "onnx-community/Florence-2-base-ft",
          "FLORENCE_MODEL_ID should match expected value"
        );
      },

      "Gateway exposes DEFAULT_DEPTH_MODEL constant": function (assert) {
        var T = window.ImageDescriberAnalyserTransformers;
        assert.assertEqual(
          T.DEFAULT_DEPTH_MODEL,
          "onnx-community/depth-anything-v2-small",
          "DEFAULT_DEPTH_MODEL should match expected value"
        );
      },

      // ── Group 2: Library load and class verification ────────

      "ensureLibrary() loads successfully": async function (assert) {
        var T = window.ImageDescriberAnalyserTransformers;
        var module = await T.ensureLibrary();
        assert.assertNotNull(
          module,
          "ensureLibrary() should return a non-null module object"
        );
      },

      "Library module has pipeline function": async function (assert) {
        var T = window.ImageDescriberAnalyserTransformers;
        var module = await T.ensureLibrary();
        assert.assertTrue(
          typeof module.pipeline === "function",
          "module.pipeline should be a function"
        );
      },

      "Library module has RawImage class": async function (assert) {
        var T = window.ImageDescriberAnalyserTransformers;
        var module = await T.ensureLibrary();
        assert.assertTrue(
          typeof module.RawImage === "function",
          "module.RawImage should be a function (class)"
        );
      },

      "Library module has Florence2ForConditionalGeneration class":
        async function (assert) {
          var T = window.ImageDescriberAnalyserTransformers;
          var module = await T.ensureLibrary();
          assert.assertTrue(
            typeof module.Florence2ForConditionalGeneration === "function",
            "module.Florence2ForConditionalGeneration should be a function — HIGH RISK for v4"
          );
        },

      "Library module has AutoProcessor class": async function (assert) {
        var T = window.ImageDescriberAnalyserTransformers;
        var module = await T.ensureLibrary();
        assert.assertTrue(
          typeof module.AutoProcessor === "function",
          "module.AutoProcessor should be a function"
        );
      },

      "Library module has AutoTokenizer class": async function (assert) {
        var T = window.ImageDescriberAnalyserTransformers;
        var module = await T.ensureLibrary();
        assert.assertTrue(
          typeof module.AutoTokenizer === "function",
          "module.AutoTokenizer should be a function — HIGHEST RISK for v4 (tokeniser extracted)"
        );
      },

      "isAvailable() returns true after successful load": async function (
        assert
      ) {
        // ensureLibrary() was called by prior tests; module should be cached
        var T = window.ImageDescriberAnalyserTransformers;
        await T.ensureLibrary();
        assert.assertTrue(
          T.isAvailable() === true,
          "isAvailable() should return true after library load"
        );
      },

      // ── Group 3: Model Manager registry consistency ─────────

      "Model Manager registry has CLIP entry": function (assert) {
        var MM = window.ImageDescriberModelManager;
        assert.assertNotNull(MM, "ImageDescriberModelManager should exist");

        var registry = MM.getRegisteredModels();
        assert.assertNotNull(
          registry,
          "getRegisteredModels() should return an array"
        );

        var clip = registry.find(function (m) {
          return m.key === "clip";
        });
        assert.assertNotNull(clip, "Registry should contain a 'clip' entry");
        assert.assertEqual(
          clip.modelId,
          "Xenova/clip-vit-base-patch32",
          "CLIP modelId should match"
        );
        assert.assertEqual(
          clip.task,
          "zero-shot-image-classification",
          "CLIP task should match"
        );
      },

      "Model Manager registry has Florence-2 entry": function (assert) {
        var MM = window.ImageDescriberModelManager;
        var T = window.ImageDescriberAnalyserTransformers;
        var registry = MM.getRegisteredModels();

        var florence = registry.find(function (m) {
          return m.key === "florence2";
        });
        assert.assertNotNull(
          florence,
          "Registry should contain a 'florence2' entry"
        );
        assert.assertEqual(
          florence.modelId,
          T.FLORENCE_MODEL_ID,
          "Florence-2 modelId should match gateway constant"
        );
        assert.assertContains(
          florence.components,
          "Florence2ForConditionalGeneration",
          "Components should include Florence2ForConditionalGeneration"
        );
        assert.assertContains(
          florence.components,
          "AutoProcessor",
          "Components should include AutoProcessor"
        );
        assert.assertContains(
          florence.components,
          "AutoTokenizer",
          "Components should include AutoTokenizer"
        );
      },

      "Model Manager registry has Depth entry": function (assert) {
        var MM = window.ImageDescriberModelManager;
        var T = window.ImageDescriberAnalyserTransformers;
        var registry = MM.getRegisteredModels();

        var depth = registry.find(function (m) {
          return m.key === "depth";
        });
        assert.assertNotNull(
          depth,
          "Registry should contain a 'depth' entry"
        );
        assert.assertEqual(
          depth.modelId,
          T.DEFAULT_DEPTH_MODEL,
          "Depth modelId should match gateway constant"
        );
      },

      "Cache store name 'transformers-cache' can be opened": async function (
        assert
      ) {
        var cache = await caches.open("transformers-cache");
        assert.assertNotNull(
          cache,
          "caches.open('transformers-cache') should return a Cache object"
        );
      },

      // ── Group 4: Real model pipeline tests ──────────────────

      "CLIP pipeline loads and classifies (requires cached model)":
        async function (assert) {
          if (!isModelCached("clip")) {
            assert.skip(
              "CLIP model not cached — download via Model Manager, then re-run"
            );
          }

          var T = window.ImageDescriberAnalyserTransformers;
          var testImage = createTestImage();

          try {
            var result = await T.classifyImage(testImage, [
              "photograph",
              "diagram",
            ]);

            assert.assertEqual(
              result.status,
              "success",
              "CLIP result status should be 'success'"
            );
            assert.assertTrue(
              typeof result.topLabel === "string",
              "topLabel should be a string"
            );
            assert.assertTrue(
              typeof result.topConfidence === "number",
              "topConfidence should be a number"
            );
            assert.assertTrue(
              result.topConfidence >= 0 && result.topConfidence <= 1,
              "topConfidence should be between 0 and 1"
            );
            assert.assertTrue(
              Array.isArray(result.labels),
              "labels should be an array"
            );
            assert.assertEqual(
              result.labels.length,
              2,
              "labels array should have 2 entries (one per input label)"
            );
            assert.assertTrue(
              typeof result.labels[0].label === "string",
              "Each label entry should have a string 'label'"
            );
            assert.assertTrue(
              typeof result.labels[0].score === "number",
              "Each label entry should have a numeric 'score'"
            );
          } catch (err) {
            assert.assertTrue(
              false,
              "CLIP classification threw an error: " + err.message
            );
          }
        },

      "Depth pipeline loads and estimates (requires cached model)":
        async function (assert) {
          if (!isModelCached("depth")) {
            assert.skip(
              "Depth model not cached — download via Model Manager, then re-run"
            );
          }

          var T = window.ImageDescriberAnalyserTransformers;
          var testImage = createTestImage();

          try {
            var result = await T.estimateDepth(testImage);

            assert.assertEqual(
              result.status,
              "success",
              "Depth result status should be 'success'"
            );
            assert.assertNotNull(
              result.zones,
              "Depth result should have zones"
            );
            assert.assertTrue(
              typeof result.zones.foreground === "object",
              "zones.foreground should be an object"
            );
            assert.assertTrue(
              typeof result.zones.midground === "object",
              "zones.midground should be an object"
            );
            assert.assertTrue(
              typeof result.zones.background === "object",
              "zones.background should be an object"
            );
            assert.assertTrue(
              typeof result.zones.foreground.areaPercent === "number",
              "foreground.areaPercent should be a number"
            );
            assert.assertTrue(
              typeof result.zones.midground.areaPercent === "number",
              "midground.areaPercent should be a number"
            );
            assert.assertTrue(
              typeof result.zones.background.areaPercent === "number",
              "background.areaPercent should be a number"
            );
          } catch (err) {
            assert.assertTrue(
              false,
              "Depth estimation threw an error: " + err.message
            );
          }
        },

      "Florence-2 loads all three components (requires cached model)":
        async function (assert) {
          if (!isModelCached("florence2")) {
            assert.skip(
              "Florence-2 model not cached — download via Model Manager, then re-run"
            );
          }

          var T = window.ImageDescriberAnalyserTransformers;

          try {
            var components = await T.ensureFlorence();

            assert.assertNotNull(
              components,
              "ensureFlorence() should return an object"
            );
            assert.assertNotNull(
              components.model,
              "Florence-2 should have a model component"
            );
            assert.assertNotNull(
              components.processor,
              "Florence-2 should have a processor component"
            );
            assert.assertNotNull(
              components.tokenizer,
              "Florence-2 should have a tokenizer component"
            );
          } catch (err) {
            assert.assertTrue(
              false,
              "Florence-2 loading threw an error: " + err.message
            );
          }
        },

      "Florence-2 caption produces text (requires cached model)":
        async function (assert) {
          if (!isModelCached("florence2")) {
            assert.skip(
              "Florence-2 model not cached — download via Model Manager, then re-run"
            );
          }

          var T = window.ImageDescriberAnalyserTransformers;
          var testImage = createTestImage();

          try {
            var result = await T.generateCaption(testImage);

            assert.assertEqual(
              result.status,
              "complete",
              "Caption result status should be 'complete'"
            );
            assert.assertTrue(
              typeof result.text === "string" && result.text.length > 0,
              "Caption text should be a non-empty string"
            );
            assert.assertTrue(
              typeof result.duration === "number",
              "Caption duration should be a number"
            );
          } catch (err) {
            assert.assertTrue(
              false,
              "Florence-2 caption threw an error: " + err.message
            );
          }
        },

      // ── Group 5: Cleanup and destroy verification ───────────

      "destroy() resets gateway state": async function (assert) {
        var T = window.ImageDescriberAnalyserTransformers;

        // Ensure library is loaded before destroying
        await T.ensureLibrary();
        assert.assertTrue(
          T.isAvailable() === true,
          "Library should be available before destroy"
        );

        // Destroy
        await T.destroy();

        assert.assertFalse(
          T.isAvailable(),
          "isAvailable() should return false after destroy()"
        );
        assert.assertEqual(
          T.getFlorenceStatus(),
          "not-loaded",
          "getFlorenceStatus() should return 'not-loaded' after destroy()"
        );
      },
    },
  });

  console.log("[Tests-12-prep] Registered: v4-compat (24 tests)");
})();
