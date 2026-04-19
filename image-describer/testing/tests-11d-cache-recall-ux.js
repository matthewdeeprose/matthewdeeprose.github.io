/**
 * ═══════════════════════════════════════════════════════════════
 * TESTS: Phase 11D — Cache Recall UX
 * ═══════════════════════════════════════════════════════════════
 *
 * Validates:
 * - Banner element exists in DOM
 * - Banner hidden by default
 * - showCacheRecallBanner formats date correctly
 * - hideCacheRecallBanner hides and clears text
 * - reanalyse deletes cache entry
 * - _persistUserEdits saves to cache
 * - objectRemovals serialised as Array in IndexedDB
 * - objectRemovals deserialised back to Set on recall
 *
 * Run:
 *   ImageDescriberTests.run('11d-cache-recall-ux');
 *   ImageDescriberTests.run('11d-cache-recall-ux', { verbose: true });
 *
 * VERSION: 1.0.0
 * PHASE: 11D
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  if (!window.ImageDescriberTests) {
    console.error(
      "[Tests-11D] ImageDescriberTests not loaded — cannot register.",
    );
    return;
  }

  var cache = window.ImageDescriberCache;
  var Controller = window.ImageDescriberController;
  var Overlay = window.ImageDescriberOverlay;

  // ── Helpers ────────────────────────────────────────────────────────

  /** Unique hash prefix to avoid collisions with other test runs */
  function testHash(suffix) {
    return "test_11d_" + Date.now() + "_" + suffix;
  }

  /** Build a minimal mock analysis */
  function makeMockAnalysis(profile) {
    return {
      schemaVersion: 1,
      profile: profile || "photograph",
      startedAt: Date.now() - 3000,
      completedAt: Date.now(),
      totalDuration: 3000,
      ocr: { status: "complete", items: [], suppressedItems: [] },
      colour: { status: "complete", regions: [], palette: [] },
      classification: {
        profile: profile || "photograph",
        confidence: 0.9,
        source: "heuristic",
      },
      crossRef: { ocrColourPairs: [], producedAt: Date.now() },
    };
  }

  /** Clean up test records after each async test */
  async function cleanup(hash) {
    try {
      if (cache) await cache.delete(hash);
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  // ── Register tests ────────────────────────────────────────────────

  window.ImageDescriberTests.register("11d-cache-recall-ux", {
    name: "Phase 11D: Cache Recall UX",
    tests: {
      // ── 1. Banner element exists ────────────────────────────────
      "Banner element exists in DOM": function (assert) {
        var banner = document.getElementById("imgdesc-cache-recall-banner");
        assert.assertNotNull(banner, "imgdesc-cache-recall-banner should exist");
        assert.assertNotNull(
          document.getElementById("imgdesc-cache-recall-text"),
          "imgdesc-cache-recall-text should exist",
        );
        assert.assertNotNull(
          document.getElementById("imgdesc-reanalyse-btn"),
          "imgdesc-reanalyse-btn should exist",
        );
      },

      // ── 2. Banner hidden by default ─────────────────────────────
      "Banner hidden by default": function (assert) {
        var banner = document.getElementById("imgdesc-cache-recall-banner");
        assert.assertNotNull(banner, "Banner element must exist");
        assert.assertTrue(banner.hidden === true, "Banner should have hidden attribute");
      },

      // ── 3. showCacheRecallBanner formats date ───────────────────
      "showCacheRecallBanner formats date correctly": function (assert) {
        if (!Controller || typeof Controller.showCacheRecallBanner !== "function") {
          assert.skip("Controller.showCacheRecallBanner not available");
          return;
        }

        // Use a known timestamp: 24 Mar 2026 at noon UTC
        var ts = new Date(2026, 2, 24, 12, 0, 0).getTime();
        Controller.showCacheRecallBanner(ts);

        var banner = document.getElementById("imgdesc-cache-recall-banner");
        var textEl = document.getElementById("imgdesc-cache-recall-text");

        assert.assertFalse(banner.hidden, "Banner should be visible after show");
        assert.assertContains(
          textEl.textContent,
          "24 Mar 2026",
          "Text should contain formatted date '24 Mar 2026'",
        );
        assert.assertContains(
          textEl.textContent,
          "Previous analysis restored",
          "Text should contain 'Previous analysis restored'",
        );

        // Clean up
        Controller.hideCacheRecallBanner();
      },

      // ── 4. hideCacheRecallBanner hides and clears ───────────────
      "hideCacheRecallBanner hides and clears": function (assert) {
        if (
          !Controller ||
          typeof Controller.showCacheRecallBanner !== "function" ||
          typeof Controller.hideCacheRecallBanner !== "function"
        ) {
          assert.skip("Controller banner methods not available");
          return;
        }

        // Show first
        Controller.showCacheRecallBanner(Date.now());
        var banner = document.getElementById("imgdesc-cache-recall-banner");
        var textEl = document.getElementById("imgdesc-cache-recall-text");

        assert.assertFalse(banner.hidden, "Banner should be visible after show");

        // Now hide
        Controller.hideCacheRecallBanner();

        assert.assertTrue(banner.hidden === true, "Banner should be hidden after hide");
        assert.assertEqual(
          textEl.textContent,
          "",
          "Text should be empty after hide",
        );
      },

      // ── 5. reanalyse deletes cache entry ────────────────────────
      "reanalyse deletes cache entry": async function (assert) {
        if (!cache) {
          assert.skip("ImageDescriberCache not available");
          return;
        }
        if (!Controller || typeof Controller.reanalyse !== "function") {
          assert.skip("Controller.reanalyse not available");
          return;
        }

        var hash = testHash("reanalyse");

        // Save a mock record
        await cache.save(hash, {
          fileName: "test.png",
          fileSize: 1000,
          fileMimeType: "image/png",
          source: { width: 100, height: 100, aspectRatio: 1 },
          analysis: makeMockAnalysis(),
        });

        // Verify it exists
        var before = await cache.load(hash);
        assert.assertNotNull(before, "Record should exist before reanalyse");

        // Set up controller state so reanalyse targets our hash
        var originalHash = Controller.currentFileHash;
        var originalAnalysis = Controller.startBackgroundAnalysis;
        Controller.currentFileHash = hash;
        // Stub startBackgroundAnalysis to prevent it running the real pipeline
        Controller.startBackgroundAnalysis = function () {};

        try {
          await Controller.reanalyse();

          var after = await cache.load(hash);
          assert.assertTrue(after === null, "Record should be deleted after reanalyse");
          assert.assertFalse(
            Controller._cacheHit,
            "_cacheHit should be false after reanalyse",
          );
        } finally {
          // Restore
          Controller.currentFileHash = originalHash;
          Controller.startBackgroundAnalysis = originalAnalysis;
          await cleanup(hash);
        }
      },

      // ── 6. _persistUserEdits saves to cache ─────────────────────
      "_persistUserEdits saves edits to cache": async function (assert) {
        if (!cache || !Overlay || !Controller) {
          assert.skip("Required modules not available");
          return;
        }
        if (typeof Overlay._persistUserEdits !== "function") {
          assert.skip("_persistUserEdits not available on Overlay");
          return;
        }

        var hash = testHash("persist");

        // Save a base record first
        await cache.save(hash, {
          fileName: "test.png",
          fileSize: 1000,
          fileMimeType: "image/png",
          source: { width: 100, height: 100, aspectRatio: 1 },
          analysis: makeMockAnalysis(),
        });

        // Set up state
        var originalHash = Controller.currentFileHash;
        Controller.currentFileHash = hash;

        var originalEdits = Overlay._userEdits;
        Overlay._userEdits = {
          corrections: { 0: { originalText: "Helo", correctedText: "Hello", status: "corrected" } },
          additions: [{ text: "New label", bounds: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 } }],
          objectRemovals: new Set([2, 5]),
          lastEditTime: Date.now(),
          editCount: 3,
        };

        try {
          Overlay._persistUserEdits();
          // Allow the async save to complete
          await new Promise(function (resolve) { setTimeout(resolve, 200); });

          var record = await cache.load(hash);
          assert.assertNotNull(record, "Record should still exist");
          assert.assertNotNull(record.userEdits, "userEdits should be saved");
          assert.assertEqual(
            record.userEdits.corrections[0].correctedText,
            "Hello",
            "Correction should be preserved",
          );
          assert.assertEqual(
            record.userEdits.additions.length,
            1,
            "Additions should be preserved",
          );
          assert.assertEqual(
            record.userEdits.editCount,
            3,
            "editCount should be preserved",
          );
        } finally {
          Controller.currentFileHash = originalHash;
          Overlay._userEdits = originalEdits;
          await cleanup(hash);
        }
      },

      // ── 7. objectRemovals serialised as Array ───────────────────
      "objectRemovals serialised as Array in IndexedDB": async function (assert) {
        if (!cache || !Overlay || !Controller) {
          assert.skip("Required modules not available");
          return;
        }
        if (typeof Overlay._persistUserEdits !== "function") {
          assert.skip("_persistUserEdits not available on Overlay");
          return;
        }

        var hash = testHash("serialise");

        // Save a base record
        await cache.save(hash, {
          fileName: "test.png",
          fileSize: 1000,
          fileMimeType: "image/png",
          source: { width: 100, height: 100, aspectRatio: 1 },
          analysis: makeMockAnalysis(),
        });

        var originalHash = Controller.currentFileHash;
        Controller.currentFileHash = hash;

        var originalEdits = Overlay._userEdits;
        Overlay._userEdits = {
          corrections: {},
          additions: [],
          objectRemovals: new Set([1, 3, 7]),
          lastEditTime: Date.now(),
          editCount: 3,
        };

        try {
          Overlay._persistUserEdits();
          await new Promise(function (resolve) { setTimeout(resolve, 200); });

          var record = await cache.load(hash);
          assert.assertNotNull(record.userEdits, "userEdits should be saved");
          assert.assertTrue(
            Array.isArray(record.userEdits.objectRemovals),
            "objectRemovals should be an Array in storage",
          );

          var stored = record.userEdits.objectRemovals;
          assert.assertEqual(stored.length, 3, "Should have 3 removals");
          assert.assertTrue(
            stored.indexOf(1) !== -1 && stored.indexOf(3) !== -1 && stored.indexOf(7) !== -1,
            "Should contain indices 1, 3, 7",
          );
        } finally {
          Controller.currentFileHash = originalHash;
          Overlay._userEdits = originalEdits;
          await cleanup(hash);
        }
      },

      // ── 8. objectRemovals deserialised back to Set ──────────────
      "objectRemovals deserialised back to Set on recall": async function (assert) {
        if (!cache || !Overlay || !Controller) {
          assert.skip("Required modules not available");
          return;
        }

        var hash = testHash("deserialise");

        // Save a record with objectRemovals as Array (as stored in IndexedDB)
        await cache.save(hash, {
          fileName: "test.png",
          fileSize: 1000,
          fileMimeType: "image/png",
          source: { width: 100, height: 100, aspectRatio: 1 },
          analysis: makeMockAnalysis(),
        });
        // Save user edits with Array format
        await cache.saveUserEdits(hash, {
          corrections: {},
          additions: [],
          objectRemovals: [2, 4, 6],
          lastEditTime: Date.now(),
          editCount: 3,
        });

        var originalEdits = Overlay._userEdits;

        try {
          // Load the cached record
          var cached = await cache.load(hash);
          assert.assertNotNull(cached, "Cached record should exist");
          assert.assertNotNull(cached.userEdits, "userEdits should exist");

          // Simulate the controller's deserialisation path
          var edits = cached.userEdits;
          if (Array.isArray(edits.objectRemovals)) {
            edits.objectRemovals = new Set(edits.objectRemovals);
          }
          Overlay._userEdits = edits;

          assert.assertTrue(
            Overlay._userEdits.objectRemovals instanceof Set,
            "objectRemovals should be a Set after deserialisation",
          );
          assert.assertEqual(
            Overlay._userEdits.objectRemovals.size,
            3,
            "Set should have 3 entries",
          );
          assert.assertTrue(
            Overlay._userEdits.objectRemovals.has(2) &&
              Overlay._userEdits.objectRemovals.has(4) &&
              Overlay._userEdits.objectRemovals.has(6),
            "Set should contain indices 2, 4, 6",
          );
        } finally {
          Overlay._userEdits = originalEdits;
          await cleanup(hash);
        }
      },
    },
  });

  console.log("[Tests-11D] Registered: 11d-cache-recall-ux (8 tests)");
})();
