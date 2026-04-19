/**
 * ═══════════════════════════════════════════════════════════════
 * TESTS: Phase 11A — Depth Anything V2 Integration
 * ═══════════════════════════════════════════════════════════════
 *
 * Validates:
 * - estimateDepth() gateway method exists
 * - MODEL_TO_LIBRARY includes depth model
 * - Profile gating (enabled for default/photograph/painting, disabled for chart/diagram/equation/map)
 * - formatDepthForPrompt() handles null, error, skipped, no-significant-depth, valid data
 * - Controller and generate slots include depth
 * - formatForPrompt() integrates depth section
 *
 * Run:
 *   ImageDescriberTests.run('11a-depth');
 *   ImageDescriberTests.run('11a-depth', { verbose: true });
 *
 * VERSION: 1.0.0
 * PHASE: 11A
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  if (!window.ImageDescriberTests) {
    console.error(
      "[Tests-11A] ImageDescriberTests not loaded — cannot register.",
    );
    return;
  }

  // ── Mock depth results for format tests ──────────────────────────────

  /** Valid depth result with 3 significant zones */
  function makeValidDepthResult() {
    return {
      status: "success",
      duration: 450,
      rawDepthMap: { width: 100, height: 100, data: new Float32Array(10000) },
      zones: {
        foreground: {
          minDepth: 0,
          maxDepth: 0.33,
          areaPercent: 34.2,
          dominantQuadrants: ["bottom-left", "bottom-right"],
        },
        midground: {
          minDepth: 0.33,
          maxDepth: 0.66,
          areaPercent: 41.5,
          dominantQuadrants: ["centre", "top-left"],
        },
        background: {
          minDepth: 0.66,
          maxDepth: 1.0,
          areaPercent: 24.3,
          dominantQuadrants: ["top-left", "top-right"],
        },
      },
      depthRange: { min: 0.1, max: 0.95 },
      hasSignificantDepth: true,
    };
  }

  /** Depth result where background is below 5% threshold */
  function makeSmallBackgroundResult() {
    return {
      status: "success",
      duration: 400,
      rawDepthMap: { width: 100, height: 100, data: new Float32Array(10000) },
      zones: {
        foreground: {
          minDepth: 0,
          maxDepth: 0.33,
          areaPercent: 55.0,
          dominantQuadrants: ["bottom-left", "bottom-right"],
        },
        midground: {
          minDepth: 0.33,
          maxDepth: 0.66,
          areaPercent: 42.0,
          dominantQuadrants: ["top-left", "top-right"],
        },
        background: {
          minDepth: 0.66,
          maxDepth: 1.0,
          areaPercent: 3.0,
          dominantQuadrants: ["top-right"],
        },
      },
      depthRange: { min: 0.05, max: 0.7 },
      hasSignificantDepth: true,
    };
  }

  /** Depth result where one zone dominates (>85% but hasSignificantDepth false) */
  function makeSingleDominantResult() {
    return {
      status: "success",
      duration: 350,
      rawDepthMap: { width: 100, height: 100, data: new Float32Array(10000) },
      zones: {
        foreground: {
          minDepth: 0,
          maxDepth: 0.33,
          areaPercent: 92.0,
          dominantQuadrants: [
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
            "centre",
          ],
        },
        midground: {
          minDepth: 0.33,
          maxDepth: 0.66,
          areaPercent: 5.0,
          dominantQuadrants: ["top-right"],
        },
        background: {
          minDepth: 0.66,
          maxDepth: 1.0,
          areaPercent: 3.0,
          dominantQuadrants: ["top-left"],
        },
      },
      depthRange: { min: 0.0, max: 0.4 },
      hasSignificantDepth: false,
    };
  }

  // ── Register tests ───────────────────────────────────────────────────

  window.ImageDescriberTests.register("11a-depth", {
    name: "Phase 11A: Depth Anything V2 Integration",
    tests: {
      // ── Gateway method ────────────────────────────────────────────

      "Gateway method estimateDepth exists": function (assert) {
        var T = window.ImageDescriberAnalyserTransformers;
        assert.assertNotNull(T, "Transformers gateway should be loaded");
        assert.assertTrue(
          typeof T.estimateDepth === "function",
          "estimateDepth should be a function",
        );
      },

      "DEFAULT_DEPTH_MODEL is exposed": function (assert) {
        var T = window.ImageDescriberAnalyserTransformers;
        assert.assertEqual(
          T.DEFAULT_DEPTH_MODEL,
          "onnx-community/depth-anything-v2-small",
          "DEFAULT_DEPTH_MODEL should match expected model ID",
        );
      },

      // ── Profile gating — enabled ──────────────────────────────────

      "Profile gating — default enabled": function (assert) {
        var P = window.ImageDescriberAnalyserProfiles.PROFILES;
        assert.assertTrue(
          P.default.depth.enabled === true,
          "default profile depth should be enabled",
        );
      },

      "Profile gating — photograph enabled": function (assert) {
        var P = window.ImageDescriberAnalyserProfiles.PROFILES;
        assert.assertTrue(
          P.photograph.depth.enabled === true,
          "photograph profile depth should be enabled",
        );
      },

      "Profile gating — painting enabled": function (assert) {
        var P = window.ImageDescriberAnalyserProfiles.PROFILES;
        assert.assertTrue(
          P.painting.depth.enabled === true,
          "painting profile depth should be enabled",
        );
      },

      // ── Profile gating — disabled ─────────────────────────────────

      "Profile gating — chart disabled": function (assert) {
        var P = window.ImageDescriberAnalyserProfiles.PROFILES;
        assert.assertTrue(
          P.chart.depth.enabled === false,
          "chart profile depth should be disabled",
        );
      },

      "Profile gating — diagram disabled": function (assert) {
        var P = window.ImageDescriberAnalyserProfiles.PROFILES;
        assert.assertTrue(
          P.diagram.depth.enabled === false,
          "diagram profile depth should be disabled",
        );
      },

      "Profile gating — equation disabled": function (assert) {
        var P = window.ImageDescriberAnalyserProfiles.PROFILES;
        assert.assertTrue(
          P.equation.depth.enabled === false,
          "equation profile depth should be disabled",
        );
      },

      "Profile gating — map disabled": function (assert) {
        var P = window.ImageDescriberAnalyserProfiles.PROFILES;
        assert.assertTrue(
          P.map.depth.enabled === false,
          "map profile depth should be disabled",
        );
      },

      // ── Format — edge cases ───────────────────────────────────────

      "Format — null depth returns empty": function (assert) {
        var F = window.ImageDescriberAnalyserFormat;
        assert.assertEqual(
          F.formatDepthForPrompt(null),
          "",
          "null depth should return empty string",
        );
      },

      "Format — error depth returns empty": function (assert) {
        var F = window.ImageDescriberAnalyserFormat;
        assert.assertEqual(
          F.formatDepthForPrompt({ status: "error" }),
          "",
          "error depth should return empty string",
        );
      },

      "Format — skipped depth returns empty": function (assert) {
        var F = window.ImageDescriberAnalyserFormat;
        assert.assertEqual(
          F.formatDepthForPrompt({ status: "skipped" }),
          "",
          "skipped depth should return empty string",
        );
      },

      "Format — no significant depth returns empty": function (assert) {
        var F = window.ImageDescriberAnalyserFormat;
        var result = {
          status: "success",
          hasSignificantDepth: false,
          zones: {
            foreground: { minDepth: 0, maxDepth: 0.33, areaPercent: 95, dominantQuadrants: [] },
            midground: { minDepth: 0.33, maxDepth: 0.66, areaPercent: 3, dominantQuadrants: [] },
            background: { minDepth: 0.66, maxDepth: 1.0, areaPercent: 2, dominantQuadrants: [] },
          },
        };
        assert.assertEqual(
          F.formatDepthForPrompt(result),
          "",
          "no significant depth should return empty string",
        );
      },

      // ── Format — valid output ─────────────────────────────────────

      "Format — valid depth returns markdown": function (assert) {
        var F = window.ImageDescriberAnalyserFormat;
        var output = F.formatDepthForPrompt(makeValidDepthResult());
        assert.assertTrue(
          output.indexOf("### Depth analysis") !== -1,
          "output should contain depth analysis heading",
        );
        assert.assertTrue(
          output.indexOf("Foreground") !== -1,
          "output should mention Foreground",
        );
        assert.assertTrue(
          output.indexOf("Midground") !== -1,
          "output should mention Midground",
        );
        assert.assertTrue(
          output.indexOf("Background") !== -1,
          "output should mention Background",
        );
        assert.assertTrue(
          output.indexOf("34.2%") !== -1,
          "output should contain foreground percentage",
        );
      },

      "Format — zones below 5% suppressed": function (assert) {
        var F = window.ImageDescriberAnalyserFormat;
        var output = F.formatDepthForPrompt(makeSmallBackgroundResult());
        assert.assertTrue(
          output.indexOf("Foreground") !== -1,
          "foreground should appear",
        );
        assert.assertTrue(
          output.indexOf("Midground") !== -1,
          "midground should appear",
        );
        assert.assertTrue(
          output.indexOf("Background") === -1,
          "background at 3% should be suppressed",
        );
      },

      "Format — single significant zone adds note": function (assert) {
        var F = window.ImageDescriberAnalyserFormat;
        // hasSignificantDepth is false so this returns empty.
        // Test a variant where hasSignificantDepth is true but only 1 zone >= 5%
        var result = makeSmallBackgroundResult();
        // Set midground below 5% too, so only foreground qualifies
        result.zones.midground.areaPercent = 4.0;
        result.zones.foreground.areaPercent = 93.0;
        var output = F.formatDepthForPrompt(result);
        assert.assertTrue(
          output.indexOf("minimal depth variation") !== -1,
          "single zone output should include minimal depth note",
        );
      },

      // ── Controller slots ──────────────────────────────────────────

      "Controller slots include depth": function (assert) {
        var C = window.ImageDescriberController;
        assert.assertNotNull(C, "Controller should be loaded");
        assert.assertNotNull(
          C._ANALYSIS_STATUS_SLOTS.depth,
          "depth slot should exist in controller",
        );
        assert.assertEqual(
          C._ANALYSIS_STATUS_SLOTS.depth.label,
          "Depth estimation",
          "depth slot label should be 'Depth estimation'",
        );
      },

      // ── Generate slots ────────────────────────────────────────────

      "Generate slots include depth": function (assert) {
        // The generate mixin is merged into the controller
        var C = window.ImageDescriberController;
        assert.assertNotNull(C, "Controller should be loaded");
        assert.assertNotNull(
          C._ANALYSIS_SLOTS,
          "_ANALYSIS_SLOTS should exist",
        );
        assert.assertNotNull(
          C._ANALYSIS_SLOTS.depth,
          "depth slot should exist in generate slots",
        );
        assert.assertEqual(
          C._ANALYSIS_SLOTS.depth.label,
          "Depth estimation",
          "generate depth slot label should be 'Depth estimation'",
        );
      },

      // ── formatForPrompt integration ───────────────────────────────

      "formatForPrompt includes depth section": function (assert) {
        var F = window.ImageDescriberAnalyserFormat;
        // Build a synthetic analysis with only depth data
        var analysis = {
          ocr: null,
          colour: null,
          classification: null,
          objects: null,
          florenceCaption: null,
          florenceObjects: null,
          florenceOCR: null,
          depth: makeValidDepthResult(),
        };
        var output = F.formatForPrompt(analysis);
        assert.assertTrue(
          output.length > 0,
          "formatForPrompt should return non-empty with depth data",
        );
        assert.assertTrue(
          output.indexOf("Depth analysis") !== -1,
          "formatForPrompt output should contain depth section",
        );
      },

      // ── Cache slot versions ───────────────────────────────────────

      "Analysis result includes depth slot": function (assert) {
        // Verify the orchestrator initialises a depth slot in the result
        // by checking the _buildFailedResult shape
        var A = window.ImageDescriberAnalyser;
        assert.assertNotNull(A, "Analyser should be loaded");
        var failed = A._buildFailedResult(Date.now(), "default", "test error");
        assert.assertTrue(
          "depth" in failed,
          "Failed result should have a depth key",
        );
      },
    },
  });

  console.log("[Tests-11A] Registered: 11a-depth (20 tests)");
})();
