/**
 * ═══════════════════════════════════════════════════════════════
 * TESTS: Phase 11C — Cache Recall Flow
 * ═══════════════════════════════════════════════════════════════
 *
 * Validates:
 * - buildSlotVersions accepts "success" status (depth)
 * - stripForCache nulls rawDepthMap.data but preserves zones
 * - stripForCache preserves non-depth data
 * - incrementAccessCount updates record
 * - Cache miss triggers full analysis (existing behaviour)
 * - Cache hit with matching profile restores analysis
 * - Cache hit with profile mismatch runs fresh analysis
 * - Depth button disabled on cache recall
 * - Depth legend data still available on recall
 * - User edits restored on recall
 * - Fresh analysis saved to cache
 *
 * Run:
 *   ImageDescriberTests.run('11c-cache-recall');
 *   ImageDescriberTests.run('11c-cache-recall', { verbose: true });
 *
 * VERSION: 1.0.0
 * PHASE: 11C
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  if (!window.ImageDescriberTests) {
    console.error(
      "[Tests-11C] ImageDescriberTests not loaded — cannot register.",
    );
    return;
  }

  var cache = window.ImageDescriberCache;

  // ── Helpers ────────────────────────────────────────────────────────

  /** Unique hash prefix to avoid collisions with other test runs */
  function testHash(suffix) {
    return "test_11c_" + Date.now() + "_" + suffix;
  }

  /** Build a mock analysis with all slots populated, including depth */
  function makeMockAnalysis(profile) {
    var size = 100; // 10×10
    var data = new Float32Array(size);
    for (var i = 0; i < size; i++) {
      data[i] = 0.1 + (0.85 * i) / (size - 1);
    }
    return {
      schemaVersion: 1,
      profile: profile || "photograph",
      startedAt: Date.now() - 5000,
      completedAt: Date.now(),
      totalDuration: 5000,
      ocr: {
        status: "complete",
        items: [
          { text: "Sample text", confidence: 0.92, bbox: { x0: 10, y0: 20, x1: 100, y1: 40 } },
        ],
        suppressedItems: [],
      },
      colour: {
        status: "complete",
        regions: [
          { name: "top-left", dominantColour: "#336699", palette: ["#336699", "#FFFFFF"] },
        ],
        palette: [
          { hex: "#336699", name: "blue", percentage: 60 },
          { hex: "#FFFFFF", name: "white", percentage: 40 },
        ],
      },
      classification: {
        profile: profile || "photograph",
        confidence: 0.85,
        source: "heuristic",
      },
      depth: {
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
        invertDepth: false,
      },
      crossRef: { ocrColourPairs: [], producedAt: Date.now() },
    };
  }

  /** Build mock user edits */
  function makeMockUserEdits() {
    return {
      corrections: { 0: { originalText: "Sampl text", correctedText: "Sample text" } },
      additions: [{ text: "Added label", x: 50, y: 60, width: 30, height: 10 }],
      objectRemovals: [],
      lastEditTime: Date.now(),
      editCount: 2,
    };
  }

  /** Clean up test records after each async test */
  async function cleanup(hash) {
    try {
      await cache.delete(hash);
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  // ── Register tests ────────────────────────────────────────────────

  window.ImageDescriberTests.register("11c-cache-recall", {
    name: "Phase 11C: Cache Recall Flow",
    tests: {
      // ── 1. buildSlotVersions accepts "success" ───────────────────

      'buildSlotVersions accepts "success" status': function (assert) {
        var analysis = {
          schemaVersion: 1,
          profile: "photograph",
          depth: { status: "success", duration: 400 },
          ocr: { status: "complete" },
        };

        var versions = cache.buildSlotVersions(analysis);

        assert.assertNotNull(
          versions.depth,
          "buildSlotVersions should include depth with status 'success'",
        );
        assert.assertNotNull(
          versions.ocr,
          "buildSlotVersions should also include ocr with status 'complete'",
        );
        assert.assertEqual(
          versions.depth.version,
          1,
          "Depth slot version should match schemaVersion",
        );
      },

      // ── 2. stripForCache nulls rawDepthMap.data ──────────────────

      "stripForCache nulls rawDepthMap.data": function (assert) {
        var analysis = makeMockAnalysis("photograph");
        assert.assertNotNull(
          analysis.depth.rawDepthMap.data,
          "Original should have rawDepthMap.data",
        );

        var stripped = cache.stripForCache(analysis);

        // rawDepthMap.data should be null
        assert.assertEqual(
          stripped.depth.rawDepthMap.data,
          null,
          "Stripped rawDepthMap.data should be null",
        );

        // Width/height preserved
        assert.assertEqual(
          stripped.depth.rawDepthMap.width,
          10,
          "rawDepthMap.width should be preserved",
        );
        assert.assertEqual(
          stripped.depth.rawDepthMap.height,
          10,
          "rawDepthMap.height should be preserved",
        );

        // Zones preserved
        assert.assertNotNull(
          stripped.depth.zones,
          "Zones should be preserved after stripping",
        );
        assert.assertEqual(
          stripped.depth.zones.foreground.areaPercent,
          34.2,
          "Zone areaPercent should be preserved",
        );

        // depthRange, hasSignificantDepth, invertDepth preserved
        assert.assertNotNull(
          stripped.depth.depthRange,
          "depthRange should be preserved",
        );
        assert.assertEqual(
          stripped.depth.hasSignificantDepth,
          true,
          "hasSignificantDepth should be preserved",
        );
        assert.assertEqual(
          stripped.depth.invertDepth,
          false,
          "invertDepth should be preserved",
        );

        // Original unchanged (deep clone)
        assert.assertNotNull(
          analysis.depth.rawDepthMap.data,
          "Original rawDepthMap.data should be unchanged (deep clone)",
        );
      },

      // ── 3. stripForCache preserves non-depth data ────────────────

      "stripForCache preserves non-depth data": function (assert) {
        var analysis = makeMockAnalysis("photograph");
        var stripped = cache.stripForCache(analysis);

        // OCR
        assert.assertEqual(
          stripped.ocr.status,
          "complete",
          "OCR status should be preserved",
        );
        assert.assertEqual(
          stripped.ocr.items.length,
          1,
          "OCR items should be preserved",
        );
        assert.assertEqual(
          stripped.ocr.items[0].text,
          "Sample text",
          "OCR item text should be preserved",
        );

        // Colour
        assert.assertEqual(
          stripped.colour.status,
          "complete",
          "Colour status should be preserved",
        );
        assert.assertTrue(
          stripped.colour.regions.length > 0,
          "Colour regions should be preserved",
        );

        // Classification
        assert.assertEqual(
          stripped.classification.profile,
          "photograph",
          "Classification profile should be preserved",
        );

        // Profile and schema
        assert.assertEqual(
          stripped.profile,
          "photograph",
          "Top-level profile should be preserved",
        );
        assert.assertEqual(
          stripped.schemaVersion,
          1,
          "schemaVersion should be preserved",
        );
      },

      // ── 4. incrementAccessCount updates record ───────────────────

      "incrementAccessCount updates record": async function (assert) {
        var hash = testHash("access_count");
        try {
          // Save a record
          var analysis = { schemaVersion: 1, profile: "default" };
          await cache.save(hash, analysis);

          // Verify initial accessCount
          var loaded = await cache.load(hash);
          assert.assertEqual(
            loaded.accessCount,
            1,
            "Initial accessCount should be 1",
          );

          // Increment
          await cache.incrementAccessCount(hash);

          // Reload and check
          var reloaded = await cache.load(hash);
          assert.assertEqual(
            reloaded.accessCount,
            2,
            "accessCount should be 2 after increment",
          );
          assert.assertTrue(
            reloaded.lastAccessedAt >= loaded.lastAccessedAt,
            "lastAccessedAt should be updated",
          );
        } finally {
          await cleanup(hash);
        }
      },

      // ── 5. Cache miss triggers full analysis ─────────────────────

      "Cache miss returns null": async function (assert) {
        var fakeHash = "nonexistent_" + Date.now();
        var result = await cache.load(fakeHash);
        assert.assertEqual(
          result,
          null,
          "Cache miss should return null",
        );
      },

      // ── 6. Cache hit with matching profile restores analysis ─────

      "Cache hit with matching profile restores analysis": async function (assert) {
        var hash = testHash("profile_match");
        try {
          var analysis = makeMockAnalysis("photograph");
          var stripped = cache.stripForCache(analysis);
          await cache.save(hash, stripped);

          // Load back
          var loaded = await cache.load(hash);
          assert.assertNotNull(loaded, "Should load cached record");
          assert.assertNotNull(loaded.analysis, "Record should have analysis");
          assert.assertEqual(
            loaded.analysis.profile,
            "photograph",
            "Cached profile should be 'photograph'",
          );

          // Simulate what the controller does: check profile match
          var selectedProfile = "photograph";
          var cachedProfile = loaded.analysis.profile;
          assert.assertEqual(
            cachedProfile,
            selectedProfile,
            "Cached profile should match selected profile",
          );

          // Verify analysis data is restorable
          assert.assertEqual(
            loaded.analysis.ocr.status,
            "complete",
            "OCR should be restorable",
          );
          assert.assertEqual(
            loaded.analysis.depth.status,
            "success",
            "Depth should be restorable",
          );
          assert.assertEqual(
            loaded.analysis.depth.rawDepthMap.data,
            null,
            "rawDepthMap.data should be null in cached version",
          );
          assert.assertNotNull(
            loaded.analysis.depth.zones,
            "Depth zones should be available",
          );
        } finally {
          await cleanup(hash);
        }
      },

      // ── 7. Cache hit with profile mismatch ───────────────────────

      "Cache hit with profile mismatch detected": async function (assert) {
        var hash = testHash("profile_mismatch");
        try {
          var analysis = makeMockAnalysis("photograph");
          var stripped = cache.stripForCache(analysis);
          await cache.save(hash, stripped);

          var loaded = await cache.load(hash);
          assert.assertNotNull(loaded, "Should load cached record");

          // Simulate profile mismatch check
          var selectedProfile = "diagram";
          var cachedProfile = loaded.analysis.profile;
          assert.assertTrue(
            cachedProfile !== selectedProfile,
            "Cached profile 'photograph' should not match selected 'diagram'",
          );
        } finally {
          await cleanup(hash);
        }
      },

      // ── 8. Depth button disabled on cache recall ─────────────────

      "Depth button disabled when rawDepthMap.data is null": function (assert) {
        var O = window.ImageDescriberOverlay;
        if (!O) {
          assert.skip("ImageDescriberOverlay not available");
          return;
        }

        var btn = document.querySelector(
          '.imgdesc-overlay-toggle[data-layer="depth"]',
        );
        if (!btn) {
          assert.skip("Depth toggle button not in DOM");
          return;
        }

        // Save current state
        var prev = O._analysisRef;

        // Simulate cache-recalled analysis (zones present, rawDepthMap.data null)
        O._analysisRef = {
          depth: {
            status: "success",
            rawDepthMap: { width: 10, height: 10, data: null },
            zones: {
              foreground: { areaPercent: 34.2, dominantQuadrants: ["bottom-left"] },
              midground: { areaPercent: 41.5, dominantQuadrants: ["centre"] },
              background: { areaPercent: 24.3, dominantQuadrants: ["top-right"] },
            },
            depthRange: { min: 0.1, max: 0.95 },
            hasSignificantDepth: true,
          },
        };

        O._updateToolbarState();

        assert.assertTrue(
          btn.disabled,
          "Depth button should be disabled when rawDepthMap.data is null",
        );

        // Restore
        O._analysisRef = prev;
        O._updateToolbarState();
      },

      // ── 9. Depth legend data still available on recall ───────────

      "Depth legend data available when rawDepthMap.data is null": function (assert) {
        // Test that formatDepthForPrompt works with cached depth (no rawDepthMap.data)
        var Format = window.ImageDescriberAnalyserFormat;
        if (!Format || typeof Format.formatDepthForPrompt !== "function") {
          assert.skip("ImageDescriberAnalyserFormat.formatDepthForPrompt not available");
          return;
        }

        var depthWithNullData = {
          status: "success",
          rawDepthMap: { width: 10, height: 10, data: null },
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
          invertDepth: false,
        };

        var promptText = Format.formatDepthForPrompt(depthWithNullData);
        assert.assertTrue(
          promptText.length > 0,
          "formatDepthForPrompt should return content with cached depth data",
        );
        assert.assertTrue(
          promptText.indexOf("foreground") !== -1 ||
            promptText.indexOf("Foreground") !== -1 ||
            promptText.indexOf("34.2") !== -1,
          "Prompt text should contain zone information",
        );
      },

      // ── 10. User edits restored on recall ────────────────────────

      "User edits restored from cache": async function (assert) {
        var hash = testHash("user_edits");
        try {
          // Save analysis with user edits
          var analysis = makeMockAnalysis("photograph");
          var stripped = cache.stripForCache(analysis);
          await cache.save(hash, stripped);

          // Save user edits separately
          var edits = makeMockUserEdits();
          await cache.saveUserEdits(hash, edits);

          // Load back
          var loaded = await cache.load(hash);
          assert.assertNotNull(loaded.userEdits, "User edits should be present");
          assert.assertEqual(
            loaded.userEdits.editCount,
            2,
            "editCount should be 2",
          );
          assert.assertNotNull(
            loaded.userEdits.corrections,
            "Corrections should be present",
          );
          assert.assertEqual(
            loaded.userEdits.additions.length,
            1,
            "Should have 1 addition",
          );
          assert.assertEqual(
            loaded.userEdits.additions[0].text,
            "Added label",
            "Addition text should match",
          );
        } finally {
          await cleanup(hash);
        }
      },

      // ── 11. Fresh analysis saved to cache ────────────────────────

      "Fresh analysis round-trip via stripForCache + save + load": async function (assert) {
        var hash = testHash("round_trip");
        try {
          var analysis = makeMockAnalysis("chart");
          var stripped = cache.stripForCache(analysis);

          await cache.save(hash, stripped);
          var loaded = await cache.load(hash);

          assert.assertNotNull(loaded, "Should load saved record");
          assert.assertEqual(
            loaded.analysis.profile,
            "chart",
            "Profile should be 'chart'",
          );
          assert.assertEqual(
            loaded.analysis.ocr.status,
            "complete",
            "OCR should be preserved",
          );
          assert.assertEqual(
            loaded.analysis.depth.rawDepthMap.data,
            null,
            "rawDepthMap.data should be null after strip+save",
          );
          assert.assertNotNull(
            loaded.analysis.depth.zones,
            "Depth zones should be preserved after strip+save",
          );
          assert.assertEqual(
            loaded.accessCount,
            1,
            "Fresh save should have accessCount 1",
          );
        } finally {
          await cleanup(hash);
        }
      },
    },
  });

  console.log("[Tests-11C] Phase 11C cache recall flow tests registered.");
})();
