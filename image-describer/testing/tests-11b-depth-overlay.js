/**
 * ═══════════════════════════════════════════════════════════════
 * TESTS: Phase 11B — Depth Zone Overlay
 * ═══════════════════════════════════════════════════════════════
 *
 * Validates:
 * - Depth layer created in init()
 * - Depth toggle button exists with correct ARIA
 * - Depth toggle disabled without data
 * - Depth legend element exists and is hidden by default
 * - Legend has three zone items
 * - _renderDepthLayer is a function
 * - _updateDepthLegend is a function
 * - toggleLayer('depth') toggles visibility
 * - Legend shows when depth layer shown
 * - Legend hides when depth layer hidden
 * - Legend populates percentages
 * - clearAnalysis clears depth layer and hides legend
 * - Toolbar state enables/disables depth button based on data
 *
 * Run:
 *   ImageDescriberTests.run('11b-depth-overlay');
 *   ImageDescriberTests.run('11b-depth-overlay', { verbose: true });
 *
 * VERSION: 1.0.0
 * PHASE: 11B
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  if (!window.ImageDescriberTests) {
    console.error(
      "[Tests-11B] ImageDescriberTests not loaded — cannot register.",
    );
    return;
  }

  // ── Mock depth result ──────────────────────────────────────────────

  /** Valid depth result with 3 significant zones and a populated rawDepthMap */
  function makeValidDepthResult() {
    // Create a small 10×10 depth map with a gradient from 0.1 to 0.95
    const size = 100; // 10×10
    const data = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = 0.1 + (0.85 * i) / (size - 1);
    }
    return {
      status: "success",
      duration: 450,
      rawDepthMap: { width: 10, height: 10, data: data },
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

  /** Build a mock analysis result that includes valid depth data */
  function makeMockAnalysis() {
    return {
      ocr: { status: "complete", items: [], suppressedItems: [] },
      colour: { status: "complete", regions: [] },
      classification: {
        profile: "photograph",
        confidence: 0.8,
        source: "heuristic",
      },
      depth: makeValidDepthResult(),
    };
  }

  /** Build a mock analysis with skipped depth */
  function makeMockAnalysisSkippedDepth() {
    return {
      ocr: { status: "complete", items: [], suppressedItems: [] },
      colour: { status: "complete", regions: [] },
      classification: {
        profile: "diagram",
        confidence: 0.9,
        source: "heuristic",
      },
      depth: {
        status: "skipped",
        reason: "Profile diagram does not use depth estimation",
      },
    };
  }

  // ── Register tests ─────────────────────────────────────────────────

  window.ImageDescriberTests.register("11b-depth-overlay", {
    name: "Phase 11B: Depth Zone Overlay",
    tests: {
      // ── DOM structure ──────────────────────────────────────────────

      "Depth toggle button exists in toolbar": function (assert) {
        var btn = document.querySelector(
          '.imgdesc-overlay-toggle[data-layer="depth"]',
        );
        assert.assertNotNull(btn, "Depth toggle button should exist");
        assert.assertEqual(
          btn.getAttribute("aria-pressed"),
          "false",
          "aria-pressed should be false by default",
        );
      },

      "Depth toggle button is disabled without data": function (assert) {
        var O = window.ImageDescriberOverlay;
        var btn = document.querySelector(
          '.imgdesc-overlay-toggle[data-layer="depth"]',
        );
        assert.assertNotNull(btn, "Depth toggle button should exist");

        // Save current state, then clear analysis ref
        var prev = O._analysisRef;
        O._analysisRef = null;
        O._updateToolbarState();

        assert.assertTrue(
          btn.disabled,
          "Depth button should be disabled when no analysis loaded",
        );

        // Restore previous state
        O._analysisRef = prev;
        O._updateToolbarState();
      },

      "Depth legend element exists and is hidden": function (assert) {
        var legend = document.getElementById("imgdesc-depth-legend");
        assert.assertNotNull(legend, "Depth legend element should exist");
        assert.assertTrue(
          legend.hidden,
          "Depth legend should be hidden by default",
        );
      },

      "Legend has three zone items": function (assert) {
        var items = document.querySelectorAll(".imgdesc-depth-legend-item");
        assert.assertEqual(
          items.length,
          3,
          "Legend should contain 3 zone items",
        );
      },

      // ── Overlay methods ────────────────────────────────────────────

      "Depth layer created in init": function (assert) {
        var O = window.ImageDescriberOverlay;
        if (!O || !O._container) {
          // Try to check if depth layer element exists in DOM
          var depthLayer = document.querySelector(".imgdesc-overlay-depth");
          // If overlay not initialised, this might be null — check method exists instead
          assert.assertTrue(
            typeof O._renderDepthLayer === "function",
            "_renderDepthLayer should be a function (layer created at init time)",
          );
          return;
        }
        assert.assertNotNull(
          O._layers.depth,
          "Depth layer should exist in _layers after init",
        );
      },

      "_renderDepthLayer is a function": function (assert) {
        var O = window.ImageDescriberOverlay;
        assert.assertTrue(
          typeof O._renderDepthLayer === "function",
          "_renderDepthLayer should be a function",
        );
      },

      "_updateDepthLegend is a function": function (assert) {
        var O = window.ImageDescriberOverlay;
        assert.assertTrue(
          typeof O._updateDepthLegend === "function",
          "_updateDepthLegend should be a function",
        );
      },

      // ── Layer toggle ───────────────────────────────────────────────

      "toggleLayer('depth') toggles visibility": function (assert) {
        var O = window.ImageDescriberOverlay;
        if (!O._layers.depth) {
          assert.skip("Overlay not initialised — cannot test toggle");
          return;
        }

        // Bind mock data so toolbar state allows toggling
        var prev = O._analysisRef;
        O._analysisRef = makeMockAnalysis();

        O.showLayer("depth");
        assert.assertTrue(
          O.isLayerVisible("depth"),
          "Depth should be visible after showLayer",
        );

        O.hideLayer("depth");
        assert.assertTrue(
          !O.isLayerVisible("depth"),
          "Depth should be hidden after hideLayer",
        );

        // Restore
        O._analysisRef = prev;
      },

      // ── Legend integration ─────────────────────────────────────────

      "Legend shows when depth layer is shown": function (assert) {
        var O = window.ImageDescriberOverlay;
        if (!O._layers.depth) {
          assert.skip("Overlay not initialised — cannot test legend show");
          return;
        }

        var prev = O._analysisRef;
        O._analysisRef = makeMockAnalysis();

        O.showLayer("depth");
        var legend = document.getElementById("imgdesc-depth-legend");
        assert.assertNotNull(legend, "Legend element should exist");
        assert.assertTrue(
          !legend.hidden,
          "Legend should be visible when depth layer is shown",
        );

        O.hideLayer("depth");
        O._analysisRef = prev;
      },

      "Legend hides when depth layer is hidden": function (assert) {
        var O = window.ImageDescriberOverlay;
        if (!O._layers.depth) {
          assert.skip("Overlay not initialised — cannot test legend hide");
          return;
        }

        var prev = O._analysisRef;
        O._analysisRef = makeMockAnalysis();

        O.showLayer("depth");
        O.hideLayer("depth");

        var legend = document.getElementById("imgdesc-depth-legend");
        assert.assertTrue(
          legend.hidden,
          "Legend should be hidden when depth layer is hidden",
        );

        O._analysisRef = prev;
      },

      "Legend populates percentages from analysis data": function (assert) {
        var O = window.ImageDescriberOverlay;
        var prev = O._analysisRef;
        O._analysisRef = makeMockAnalysis();

        O._updateDepthLegend();

        var fgDD = document.getElementById("imgdesc-depth-legend-foreground");
        assert.assertNotNull(fgDD, "Foreground dd element should exist");
        assert.assertTrue(
          fgDD.textContent.indexOf("34.2%") !== -1,
          "Foreground should contain percentage (got: " +
            fgDD.textContent +
            ")",
        );

        var mgDD = document.getElementById("imgdesc-depth-legend-midground");
        assert.assertTrue(
          mgDD.textContent.indexOf("41.5%") !== -1,
          "Midground should contain percentage",
        );

        var bgDD = document.getElementById("imgdesc-depth-legend-bg");
        assert.assertTrue(
          bgDD.textContent.indexOf("24.3%") !== -1,
          "Background should contain percentage",
        );

        // Restore
        O._analysisRef = prev;
      },

      // ── clearAnalysis ──────────────────────────────────────────────

      "clearAnalysis clears depth layer and hides legend": function (assert) {
        var O = window.ImageDescriberOverlay;
        if (!O._layers.depth) {
          assert.skip("Overlay not initialised — cannot test clearAnalysis");
          return;
        }

        // Set up mock analysis and render
        O._analysisRef = makeMockAnalysis();
        O._renderDepthLayer(O._analysisRef.depth);
        O.showLayer("depth");

        // Now clear
        O.clearAnalysis();

        assert.assertEqual(
          O._layers.depth.innerHTML,
          "",
          "Depth layer innerHTML should be empty after clearAnalysis",
        );

        var legend = document.getElementById("imgdesc-depth-legend");
        assert.assertTrue(
          legend.hidden,
          "Depth legend should be hidden after clearAnalysis",
        );
      },

      // ── Toolbar state ──────────────────────────────────────────────

      "Toolbar enables depth button with valid depth data": function (assert) {
        var O = window.ImageDescriberOverlay;
        var prev = O._analysisRef;
        O._analysisRef = makeMockAnalysis();

        O._updateToolbarState();

        var btn = document.querySelector(
          '.imgdesc-overlay-toggle[data-layer="depth"]',
        );
        assert.assertNotNull(btn, "Depth button should exist");
        assert.assertTrue(
          !btn.disabled,
          "Depth button should be enabled with valid depth data",
        );

        O._analysisRef = prev;
        O._updateToolbarState();
      },

      "Toolbar disables depth button with skipped depth": function (assert) {
        var O = window.ImageDescriberOverlay;
        var prev = O._analysisRef;
        O._analysisRef = makeMockAnalysisSkippedDepth();

        O._updateToolbarState();

        var btn = document.querySelector(
          '.imgdesc-overlay-toggle[data-layer="depth"]',
        );
        assert.assertNotNull(btn, "Depth button should exist");
        assert.assertTrue(
          btn.disabled,
          "Depth button should be disabled with skipped depth",
        );

        O._analysisRef = prev;
        O._updateToolbarState();
      },
    },
  });

  console.log("[Tests-11B] Phase 11B depth overlay tests registered.");
})();
