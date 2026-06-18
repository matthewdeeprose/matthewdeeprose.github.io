/**
 * @fileoverview Stage 6 test runner — verifies the reconcile-on-open
 *   wiring added in Stage 6 Phase 2 (MMD → Manager bidirectional sync)
 *   plus the post-Stage-6 Finding-5 retirement (Phase 3 of the doc-tidy
 *   interlude).
 * @module MathPixStage6Tests
 * @requires MathPixImageRegistry, MathPixImageManagerUI, MathPixAltTextIntegrator, MathPixSessionRestorer
 * @version 1.1.0 (post-Stage-6 doc-tidy interlude Phase 3)
 *
 * Per stage-6-planning-decisions.md Q5: reconcile fires once per
 * user-initiated open(), inside the existing requestAnimationFrame
 * block, BEFORE this.refresh(). It MUST NOT appear in refresh() —
 * Group A's regression guard locks that hard rule.
 *
 * Group A — unit tests against a stub manager that stands in for the
 *   live UI. Exercises _reconcileOnOpen and _cleanupRemovedEntries
 *   directly with synthetic fixtures: no-change, add-only, remove-only,
 *   mixed, memory-hygiene before/after, and the hard-rule regression
 *   guard (refresh-does-not-reconcile).
 *
 * Group B — emulation tests for the three Finding 8 reverse-sync conflict
 *   scenarios. Each test invokes _reconcileOnOpen and asserts the
 *   observed behaviour as a regression guard (per Q4 deferred-policy).
 *
 * Group C (post-Stage-6 Finding-5 retirement, added 2026-05-25) — equivalence
 *   + improvement tests for the new restorer-side helpers
 *   _translateBlobUrlsToCdnForMMD and _cleanupBuildFromMMDRemoved
 *   (in session-restorer-images.js) that replaced the hand-rolled
 *   markdown-only ghost-purge loops in proto.loadZIPContents and
 *   proto.applyRecoveredSession. C1/C2 cover equivalence + F-D memory-
 *   hygiene gains (Cache API + imageBlobUrlMap cleanup). C3 and C4 cover
 *   two locked-as-improvement gains: new-images-detected (old loops had
 *   no add path) and \includegraphics preservation (old loops were
 *   markdown-only).
 *
 * Usage: `window.runStage6Tests()` from the console. Returns
 *   { passed, failed, skipped, results }.
 *
 * @see mathpix-scripts/docs/alt-text/stage-6-planning-decisions.md — Q2, Q3, Q5
 * @see mathpix-scripts/docs/alt-text/pre-stage-7-prompt-01-doctidy-and-gaps.md — Phase 3
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }
  function logError(msg, ...args) {
    if (shouldLog(0)) console.error(`[Stage6Tests] ${msg}`, ...args);
  }
  function logWarn(msg, ...args) {
    if (shouldLog(1)) console.warn(`[Stage6Tests] ${msg}`, ...args);
  }
  function logInfo(msg, ...args) {
    if (shouldLog(2)) console.log(`[Stage6Tests] ${msg}`, ...args);
  }
  function logDebug(msg, ...args) {
    if (shouldLog(3)) console.log(`[Stage6Tests] ${msg}`, ...args);
  }

  // ============================================================================
  // RESULTS ACCUMULATOR
  // ============================================================================

  function makeResults() {
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const results = [];

    function assert(label, condition, detail) {
      if (condition) {
        passed++;
        results.push({ label, passed: true, error: null });
        console.log(`  ✓ ${label}`);
        return true;
      }
      failed++;
      const errMsg = detail || null;
      results.push({ label, passed: false, error: errMsg });
      console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
      return false;
    }

    function skip(count) {
      skipped += count;
    }

    return {
      get passed() {
        return passed;
      },
      get failed() {
        return failed;
      },
      get skipped() {
        return skipped;
      },
      results,
      assert,
      skip,
    };
  }

  // ============================================================================
  // STUB MANAGER & STUB RESTORER
  // ============================================================================

  /**
   * Resolve the MathPixImageManagerUI class from window. The IIFE at the
   * bottom of mathpix-image-manager-ui.js exposes a namespace object
   * `{ MathPixImageManagerUI, getInstance }` — so the class is at
   * `window.MathPixImageManagerUI.MathPixImageManagerUI`. Defensive
   * fallback handles direct-exposure.
   *
   * @returns {Function|null}
   */
  function resolveManagerClass() {
    const ns = window.MathPixImageManagerUI;
    if (!ns) return null;
    if (typeof ns === "function") return ns;
    if (typeof ns.MathPixImageManagerUI === "function") {
      return ns.MathPixImageManagerUI;
    }
    return null;
  }

  /**
   * Resolve the MathPixImageRegistry class. The IIFE exposes the class
   * directly on window.MathPixImageRegistry.
   *
   * @returns {Function|null}
   */
  function resolveRegistryClass() {
    const Cls = window.MathPixImageRegistry;
    return typeof Cls === "function" ? Cls : null;
  }

  /**
   * Build a stub restorer mimicking the surface _reconcileOnOpen and
   * _cleanupRemovedEntries actually read from `this.restorer`:
   *
   *   - restoredSession.currentMMD     (string)
   *   - imageRegistry                  (real MathPixImageRegistry instance)
   *   - imageBlobUrlMap                (Map<string,string>)
   *   - imageFilenameMap               ({ [id]: { filename } })
   *   - _removeCachedImage(id, name)   (async, records calls)
   *
   * The cache-removal hook is a stub that records its calls in
   * `removedCacheKeys`, so memory-hygiene assertions can verify which
   * IDs were cleaned up without touching the real Cache API.
   *
   * @param {string} currentMMD - Initial MMD content
   * @returns {Object} Stub restorer
   */
  function makeStubRestorer(currentMMD) {
    const RegCls = resolveRegistryClass();
    if (!RegCls) return null;
    const registry = new RegCls();
    const stub = {
      restoredSession: { currentMMD: currentMMD || "" },
      imageRegistry: registry,
      imageBlobUrlMap: new Map(),
      imageFilenameMap: {},
      // Recorded for assertions.
      removedCacheKeys: [],
      revokedBlobUrls: [],
    };
    stub._removeCachedImage = async function (id, filename) {
      stub.removedCacheKeys.push({ id, filename });
    };
    // Stub the restorer helper that Phase D invokes — record calls so a
    // test can verify the helper fired. Real implementation iterates
    // entries and syncs mmdReference to blob-URL form.
    stub.syncRegistryReferencesToBlobUrls = function () {
      stub.syncBlobUrlsCalls = (stub.syncBlobUrlsCalls || 0) + 1;
    };
    return stub;
  }

  /**
   * Build a stub manager instance with .restorer wired to the supplied
   * stub. Uses Object.create to avoid the constructor's restorer
   * validation (which logErrors on null).
   *
   * @param {Object} restorer - Stub restorer
   * @returns {Object|null} Stub manager with prototype methods
   */
  function makeStubManager(restorer) {
    const Cls = resolveManagerClass();
    if (!Cls) return null;
    const stub = Object.create(Cls.prototype);
    stub.restorer = restorer;
    return stub;
  }

  /**
   * Replace window.URL.revokeObjectURL with a recording stub for the
   * duration of `fn`. Restores the original after the callback.
   *
   * @param {Function} fn - Callback (may be async)
   * @param {string[]} sink - Array to push revoked URLs into
   * @returns {Promise<*>} Whatever fn returns
   */
  async function withRevokeRecorder(fn, sink) {
    const original = window.URL.revokeObjectURL.bind(window.URL);
    window.URL.revokeObjectURL = function (url) {
      sink.push(url);
      // Don't actually revoke — the test fixtures might use fake blob:
      // URLs that aren't real object URLs.
    };
    try {
      return await fn();
    } finally {
      window.URL.revokeObjectURL = original;
    }
  }

  // ============================================================================
  // FIXTURES
  // ============================================================================

  /**
   * Synthesise a populated registry + matching blob-URL map for testing.
   * The MMD references CDN URLs; the imageBlobUrlMap translates them to
   * `blob:` URLs (mimicking what session-restorer-images.js sets up
   * during restore).
   *
   * @param {string[]} cdnUrls - CDN URLs to seed
   * @returns {{mmd: string, blobMap: Map<string,string>}}
   */
  function seedFixture(cdnUrls) {
    const mmd = cdnUrls
      .map((u, i) => `![image ${i + 1}](${u})`)
      .join("\n\n");
    const blobMap = new Map();
    cdnUrls.forEach((cdn) => {
      blobMap.set(cdn, `blob:fake/${encodeURIComponent(cdn)}`);
    });
    return { mmd, blobMap };
  }

  // ============================================================================
  // GROUP A: RECONCILE-ON-OPEN + CLEANUP UNIT TESTS
  // ============================================================================

  async function runGroupA(r) {
    console.log("\n--- Group A: _reconcileOnOpen + _cleanupRemovedEntries ---");

    const RegCls = resolveRegistryClass();
    const MgrCls = resolveManagerClass();
    r.assert(
      "A0a: MathPixImageRegistry exposed on window",
      typeof RegCls === "function",
    );
    r.assert(
      "A0b: MathPixImageManagerUI class resolvable",
      typeof MgrCls === "function",
    );
    r.assert(
      "A0c: window.MathPixAltTextIntegrator.reconcileMMDIntoRegistry available",
      typeof window.MathPixAltTextIntegrator?.reconcileMMDIntoRegistry ===
        "function",
    );
    if (!RegCls || !MgrCls) return;

    // -------------------------------------------------------------------
    // Case A1: no-change open is a no-op (matched, no add, no remove).
    // -------------------------------------------------------------------
    {
      console.log("\n  -- Case A1: no-change open --");
      const cdn = "https://cdn.mathpix.com/a1-keep.png";
      const { mmd, blobMap } = seedFixture([cdn]);
      const restorer = makeStubRestorer(mmd);
      restorer.imageBlobUrlMap = blobMap;
      // Prime registry to current MMD state.
      restorer.imageRegistry.buildFromMMD(mmd);
      const beforeCount = restorer.imageRegistry.getCount();
      const beforeMapSize = restorer.imageBlobUrlMap.size;
      const mgr = makeStubManager(restorer);

      await mgr._reconcileOnOpen();

      r.assert(
        "A1a: registry count unchanged after no-change reconcile",
        restorer.imageRegistry.getCount() === beforeCount,
      );
      r.assert(
        "A1b: imageBlobUrlMap size unchanged",
        restorer.imageBlobUrlMap.size === beforeMapSize,
      );
      r.assert(
        "A1c: no Cache API removals recorded",
        restorer.removedCacheKeys.length === 0,
      );
    }

    // -------------------------------------------------------------------
    // Case A2: add-only — new image in MMD appears in registry.
    // -------------------------------------------------------------------
    {
      console.log("\n  -- Case A2: add-only --");
      const cdnA = "https://cdn.mathpix.com/a2-keep.png";
      const cdnB = "https://cdn.mathpix.com/a2-new.png";
      const seedMmd = `![keep](${cdnA})`;
      const expandedMmd = `![keep](${cdnA})\n\n![new](${cdnB})`;

      const restorer = makeStubRestorer(seedMmd);
      restorer.imageBlobUrlMap.set(cdnA, `blob:fake/${encodeURIComponent(cdnA)}`);
      restorer.imageRegistry.buildFromMMD(seedMmd);
      const beforeCount = restorer.imageRegistry.getCount();
      restorer.restoredSession.currentMMD = expandedMmd;
      const mgr = makeStubManager(restorer);

      await mgr._reconcileOnOpen();

      r.assert(
        "A2a: registry count rose by 1",
        restorer.imageRegistry.getCount() === beforeCount + 1,
        `before=${beforeCount} after=${restorer.imageRegistry.getCount()}`,
      );
      r.assert(
        "A2b: no Cache API removals recorded (add-only)",
        restorer.removedCacheKeys.length === 0,
      );
    }

    // -------------------------------------------------------------------
    // Case A3: remove-only — image hand-removed from MMD goes away.
    // Memory hygiene: blob URL revoked, map entry deleted, Cache API hit.
    // -------------------------------------------------------------------
    {
      console.log("\n  -- Case A3: remove-only + memory hygiene --");
      const cdnA = "https://cdn.mathpix.com/a3-keep.png";
      const cdnB = "https://cdn.mathpix.com/a3-gone.png";
      const seedMmd = `![keep](${cdnA})\n\n![gone](${cdnB})`;
      const trimmedMmd = `![keep](${cdnA})`;

      const restorer = makeStubRestorer(seedMmd);
      restorer.imageBlobUrlMap.set(cdnA, `blob:fake/${encodeURIComponent(cdnA)}`);
      restorer.imageBlobUrlMap.set(cdnB, `blob:fake/${encodeURIComponent(cdnB)}`);
      restorer.imageRegistry.buildFromMMD(seedMmd);
      const removedEntry = restorer.imageRegistry
        .getAllImages()
        .find((e) => e.originalUrl === cdnB);
      restorer.imageFilenameMap[removedEntry.id] = { filename: "gone.png" };
      const beforeCount = restorer.imageRegistry.getCount();
      const beforeMapSize = restorer.imageBlobUrlMap.size;
      restorer.restoredSession.currentMMD = trimmedMmd;

      const mgr = makeStubManager(restorer);
      const revoked = [];
      await withRevokeRecorder(() => mgr._reconcileOnOpen(), revoked);

      r.assert(
        "A3a: registry count dropped by 1",
        restorer.imageRegistry.getCount() === beforeCount - 1,
        `before=${beforeCount} after=${restorer.imageRegistry.getCount()}`,
      );
      r.assert(
        "A3b: imageBlobUrlMap entry for removed CDN URL deleted",
        !restorer.imageBlobUrlMap.has(cdnB),
      );
      r.assert(
        "A3c: imageBlobUrlMap size dropped by 1",
        restorer.imageBlobUrlMap.size === beforeMapSize - 1,
        `before=${beforeMapSize} after=${restorer.imageBlobUrlMap.size}`,
      );
      r.assert(
        "A3d: blob URL was revoked",
        revoked.length === 1 &&
          revoked[0] === `blob:fake/${encodeURIComponent(cdnB)}`,
        `revoked=${JSON.stringify(revoked)}`,
      );
      r.assert(
        "A3e: Cache API removal called for removed entry",
        restorer.removedCacheKeys.length === 1 &&
          restorer.removedCacheKeys[0].id === removedEntry.id,
      );
      r.assert(
        "A3f: Cache API removal received filename from imageFilenameMap",
        restorer.removedCacheKeys[0].filename === "gone.png",
      );
      r.assert(
        "A3g: kept entry's map entry preserved",
        restorer.imageBlobUrlMap.has(cdnA),
      );
    }

    // -------------------------------------------------------------------
    // Case A4: mixed add + remove + keep — all three pathways together.
    // -------------------------------------------------------------------
    {
      console.log("\n  -- Case A4: mixed add/remove/keep --");
      const cdnA = "https://cdn.mathpix.com/a4-keep.png";
      const cdnB = "https://cdn.mathpix.com/a4-gone.png";
      const cdnC = "https://cdn.mathpix.com/a4-new.png";
      const seedMmd = `![keep](${cdnA})\n\n![gone](${cdnB})`;
      const mutatedMmd = `![keep](${cdnA})\n\n![new](${cdnC})`;

      const restorer = makeStubRestorer(seedMmd);
      restorer.imageBlobUrlMap.set(cdnA, `blob:fake/${encodeURIComponent(cdnA)}`);
      restorer.imageBlobUrlMap.set(cdnB, `blob:fake/${encodeURIComponent(cdnB)}`);
      restorer.imageRegistry.buildFromMMD(seedMmd);
      const keepId = restorer.imageRegistry
        .getAllImages()
        .find((e) => e.originalUrl === cdnA).id;
      // Set decorative — Stage 3.A Q5 locks decorative as UI-only, so
      // parseAltText explicitly does not touch it. A surviving decorative
      // flag therefore proves the match path fired in buildFromMMD AND
      // that the subsequent reverse-sync left it alone (rather than
      // remove+re-add, which would have reset decorative to false).
      // Using decorative — rather than altText or title — avoids the
      // legitimate MMD-wins overwrite from parseAltText / parseCaptions.
      restorer.imageRegistry.updateDecorative(keepId, true);
      restorer.restoredSession.currentMMD = mutatedMmd;

      const mgr = makeStubManager(restorer);
      const revoked = [];
      await withRevokeRecorder(() => mgr._reconcileOnOpen(), revoked);

      r.assert(
        "A4a: registry count unchanged (1 removed + 1 added)",
        restorer.imageRegistry.getCount() === 2,
        `got ${restorer.imageRegistry.getCount()}`,
      );
      r.assert(
        "A4b: kept entry's ID survived reconcile (matched, not remove+re-add)",
        restorer.imageRegistry.hasImage(keepId),
      );
      r.assert(
        "A4c: kept entry's decorative flag preserved across full reconcile (Stage 3.A Q5: UI-only field)",
        restorer.imageRegistry.getImage(keepId)?.decorative === true,
        `got ${restorer.imageRegistry.getImage(keepId)?.decorative}`,
      );
      r.assert(
        "A4d: only the removed entry's blob URL was revoked",
        revoked.length === 1 &&
          revoked[0] === `blob:fake/${encodeURIComponent(cdnB)}`,
      );
      r.assert(
        "A4e: only 1 Cache API removal (for the removed entry)",
        restorer.removedCacheKeys.length === 1,
      );
    }

    // -------------------------------------------------------------------
    // Case A5: hard-rule regression — refresh() does NOT trigger reconcile.
    // We stub buildFromMMD with a call-counting wrapper, invoke refresh(),
    // and assert the wrapper was NOT invoked. Mirrors Q5's "reconcile
    // never appears in refresh() or any other internal re-render path".
    // -------------------------------------------------------------------
    {
      console.log("\n  -- Case A5: refresh() does NOT reconcile (Q5 guard) --");
      const cdn = "https://cdn.mathpix.com/a5-x.png";
      const { mmd, blobMap } = seedFixture([cdn]);
      const restorer = makeStubRestorer(mmd);
      restorer.imageBlobUrlMap = blobMap;
      restorer.imageRegistry.buildFromMMD(mmd);

      // Patch buildFromMMD on the live registry instance with a counter.
      const originalBuild =
        restorer.imageRegistry.buildFromMMD.bind(restorer.imageRegistry);
      let buildCalls = 0;
      restorer.imageRegistry.buildFromMMD = function (...args) {
        buildCalls++;
        return originalBuild(...args);
      };

      // Build a stub manager that refresh() can run on without a live DOM.
      // refresh() inspects this.currentModal and the DOM to decide where to
      // render. We stub currentModal to a no-op and rely on refresh()'s
      // own defensive guards (it checks getElementById return values).
      const mgr = makeStubManager(restorer);
      mgr.currentModal = { isOpen: () => false }; // signal "no modal open"

      // Invoke refresh() — must not call buildFromMMD.
      try {
        mgr.refresh();
      } catch (err) {
        // refresh() may bail out early via the no-modal guard; that's the
        // expected path. The assertion is about buildCalls regardless.
      }

      r.assert(
        "A5a: refresh() did NOT invoke registry.buildFromMMD (Q5 hard rule)",
        buildCalls === 0,
        `got ${buildCalls} call(s)`,
      );

      // Restore the original for hygiene.
      restorer.imageRegistry.buildFromMMD = originalBuild;
    }

    // -------------------------------------------------------------------
    // Case A6: defensive — empty MMD short-circuits.
    // -------------------------------------------------------------------
    {
      console.log("\n  -- Case A6: empty MMD short-circuits --");
      const restorer = makeStubRestorer("");
      const mgr = makeStubManager(restorer);
      let threw = false;
      try {
        await mgr._reconcileOnOpen();
      } catch (e) {
        threw = true;
      }
      r.assert("A6a: empty-MMD reconcile did not throw", threw === false);
      r.assert(
        "A6b: empty-MMD reconcile recorded zero cleanup",
        restorer.removedCacheKeys.length === 0,
      );
    }

    // -------------------------------------------------------------------
    // Case A7: defensive — missing restorer attributes don't throw.
    // -------------------------------------------------------------------
    {
      console.log("\n  -- Case A7: missing restorer attributes --");
      // Manager with no restorer at all.
      const mgrA = makeStubManager(null);
      let threwA = false;
      try {
        await mgrA._reconcileOnOpen();
      } catch (e) {
        threwA = true;
      }
      r.assert("A7a: null restorer did not throw", threwA === false);

      // Manager with restorer but no registry.
      const restorer = {
        restoredSession: { currentMMD: "![x](https://cdn.mathpix.com/a7.png)" },
        imageRegistry: null,
      };
      const mgrB = makeStubManager(restorer);
      let threwB = false;
      try {
        await mgrB._reconcileOnOpen();
      } catch (e) {
        threwB = true;
      }
      r.assert(
        "A7b: missing imageRegistry did not throw",
        threwB === false,
      );
    }

    // -------------------------------------------------------------------
    // Case A8: restored-session no-change. Registry holds CDN-URL entries
    // (as fromJSON() would produce), live MMD holds blob URLs (as the
    // session-restorer's loadZIPContents would produce), and the blob-URL
    // map bridges them. Phase A's blob→CDN translation must align the
    // MMD's IDs with the registry's so no entries get removed.
    //
    // Regression guard: without Phase 2b's translation, every entry would
    // be marked for removal and every blob URL revoked — the bug Phase 2
    // shipped with.
    // -------------------------------------------------------------------
    {
      console.log(
        "\n  -- Case A8: restored-session no-change (Phase 2b regression guard) --",
      );
      const cdn1 = "https://cdn.mathpix.com/a8-img-1.png";
      const cdn2 = "https://cdn.mathpix.com/a8-img-2.png";
      const blob1 = `blob:fake/${encodeURIComponent(cdn1)}`;
      const blob2 = `blob:fake/${encodeURIComponent(cdn2)}`;
      // Mimic the post-restore split: registry built from CDN-form MMD,
      // then live MMD swapped to blob-form (what loadZIPContents does).
      const cdnMmd = `![one](${cdn1})\n\n![two](${cdn2})`;
      const liveMmd = `![one](${blob1})\n\n![two](${blob2})`;

      const restorer = makeStubRestorer(liveMmd);
      restorer.imageBlobUrlMap.set(cdn1, blob1);
      restorer.imageBlobUrlMap.set(cdn2, blob2);
      restorer.imageRegistry.buildFromMMD(cdnMmd); // CDN-form IDs
      const beforeCount = restorer.imageRegistry.getCount();
      const beforeMapSize = restorer.imageBlobUrlMap.size;
      const mgr = makeStubManager(restorer);

      const revoked = [];
      await withRevokeRecorder(() => mgr._reconcileOnOpen(), revoked);

      r.assert(
        "A8a: registry count unchanged (Phase 2b translation matched IDs)",
        restorer.imageRegistry.getCount() === beforeCount,
        `before=${beforeCount} after=${restorer.imageRegistry.getCount()}`,
      );
      r.assert(
        "A8b: NO blob URLs revoked (the Phase 2 bug guard)",
        revoked.length === 0,
        `revoked=${JSON.stringify(revoked)}`,
      );
      r.assert(
        "A8c: imageBlobUrlMap untouched",
        restorer.imageBlobUrlMap.size === beforeMapSize,
      );
      r.assert(
        "A8d: zero Cache API removals",
        restorer.removedCacheKeys.length === 0,
      );
      r.assert(
        "A8e: Phase D (syncRegistryReferencesToBlobUrls) fired",
        restorer.syncBlobUrlsCalls === 1,
        `got ${restorer.syncBlobUrlsCalls} call(s)`,
      );
    }

    // -------------------------------------------------------------------
    // Case A9: restored-session add — user hand-types a new image
    // reference into the MMD (with a URL the imageBlobUrlMap doesn't
    // know about). After translation, the existing entry still matches
    // (via its CDN URL); the new entry is detected and added.
    // -------------------------------------------------------------------
    {
      console.log("\n  -- Case A9: restored-session add --");
      const cdn1 = "https://cdn.mathpix.com/a9-existing.png";
      const blob1 = `blob:fake/${encodeURIComponent(cdn1)}`;
      const userUrl = "https://example.com/a9-user-added.png";
      const cdnMmd = `![existing](${cdn1})`;
      const liveMmd = `![existing](${blob1})\n\n![new](${userUrl})`;

      const restorer = makeStubRestorer(liveMmd);
      restorer.imageBlobUrlMap.set(cdn1, blob1);
      restorer.imageRegistry.buildFromMMD(cdnMmd);
      const beforeCount = restorer.imageRegistry.getCount();
      const mgr = makeStubManager(restorer);

      const revoked = [];
      await withRevokeRecorder(() => mgr._reconcileOnOpen(), revoked);

      r.assert(
        "A9a: registry count rose by 1 (added the user URL)",
        restorer.imageRegistry.getCount() === beforeCount + 1,
      );
      r.assert(
        "A9b: existing entry preserved (no blob revoked)",
        revoked.length === 0,
      );
      r.assert(
        "A9c: zero Cache API removals (add-only)",
        restorer.removedCacheKeys.length === 0,
      );
    }

    // -------------------------------------------------------------------
    // Case A10: restored-session remove — user hand-removes one image
    // reference from the MMD. After translation, the still-present entry
    // matches and stays; the absent one is removed and its blob URL
    // (resolved via imageBlobUrlMap on the CDN entry's originalUrl)
    // gets revoked.
    // -------------------------------------------------------------------
    {
      console.log("\n  -- Case A10: restored-session remove --");
      const cdn1 = "https://cdn.mathpix.com/a10-keep.png";
      const cdn2 = "https://cdn.mathpix.com/a10-gone.png";
      const blob1 = `blob:fake/${encodeURIComponent(cdn1)}`;
      const blob2 = `blob:fake/${encodeURIComponent(cdn2)}`;
      const cdnMmd = `![keep](${cdn1})\n\n![gone](${cdn2})`;
      const liveMmd = `![keep](${blob1})`; // user removed cdn2's reference

      const restorer = makeStubRestorer(liveMmd);
      restorer.imageBlobUrlMap.set(cdn1, blob1);
      restorer.imageBlobUrlMap.set(cdn2, blob2);
      restorer.imageRegistry.buildFromMMD(cdnMmd);
      const goneEntry = restorer.imageRegistry
        .getAllImages()
        .find((e) => e.originalUrl === cdn2);
      restorer.imageFilenameMap[goneEntry.id] = { filename: "gone.png" };
      const beforeCount = restorer.imageRegistry.getCount();
      const beforeMapSize = restorer.imageBlobUrlMap.size;
      const mgr = makeStubManager(restorer);

      const revoked = [];
      await withRevokeRecorder(() => mgr._reconcileOnOpen(), revoked);

      r.assert(
        "A10a: registry count dropped by 1",
        restorer.imageRegistry.getCount() === beforeCount - 1,
      );
      r.assert(
        "A10b: only the removed entry's blob URL revoked",
        revoked.length === 1 && revoked[0] === blob2,
        `revoked=${JSON.stringify(revoked)}`,
      );
      r.assert(
        "A10c: imageBlobUrlMap entry for removed CDN URL deleted",
        !restorer.imageBlobUrlMap.has(cdn2),
      );
      r.assert(
        "A10d: imageBlobUrlMap size dropped by 1",
        restorer.imageBlobUrlMap.size === beforeMapSize - 1,
      );
      r.assert(
        "A10e: kept entry's map entry preserved",
        restorer.imageBlobUrlMap.has(cdn1),
      );
      r.assert(
        "A10f: Cache API removal called once with the gone entry's filename",
        restorer.removedCacheKeys.length === 1 &&
          restorer.removedCacheKeys[0].id === goneEntry.id &&
          restorer.removedCacheKeys[0].filename === "gone.png",
      );
    }
  }

  // ============================================================================
  // GROUP B: Q4 EMULATION TESTS — Finding 8 reverse-sync conflict scenarios
  // (Stage 6 Phase 3, 2026-05-24)
  // ============================================================================
  //
  // Per Stage 6 Q4 (deferred-to-implementation policy), each scenario:
  //   1. Sets up registry + MMD pre-state matching the conflict.
  //   2. Invokes _reconcileOnOpen (the full manager-open path:
  //      buildFromMMD set-diff + cleanup + Phase D resync + Phase E
  //      reverse-sync via reconcileMMDIntoRegistry).
  //   3. Reads the post-state of the affected entry and ASSERTS the
  //      observed behaviour as a regression guard.
  //
  // The three scenarios come from Finding 8 in stage-6-planning-decisions.md:
  //   B1. MMD non-empty alt + registry decorative:true
  //   B2. MMD empty alt + registry non-empty altText (decorative:false)
  //   B3. MMD missing caption + registry non-empty title
  //
  // Predicted outcomes from the planning audit (Finding 8):
  //   B1 → contradictory state survives: decorative:true AND altText set
  //        from MMD. parseAltText writes alt unconditionally and never
  //        reads decorative (Stage 3.A Q5 lock).
  //   B2 → registry wins. parseAltText defensive-skips empty MMD alt
  //        (lines 410-414).
  //   B3 → MMD wins, title cleared. parseCaptions does NOT defensive-skip
  //        (asymmetry noted in Finding 8).
  //
  // Each test's primary assertion is the post-reconcile field value. If
  // any of these diverges from the prediction, that surfaces as a test
  // failure and triggers escalation per the Phase 3 protocol.
  //
  // Per Q4 escalation triggers, NONE of the following fired during
  // implementation: (1) no scenario required cross-parser changes,
  // (2) no outcome contradicted Stage 3.A Q5 (decorative-UI-only),
  // (3) no outcome suggested Q2's preserve/refresh bucketing was wrong.

  async function runGroupB(r) {
    console.log(
      "\n--- Group B: Q4 emulation tests (Finding 8 reverse-sync scenarios) ---",
    );

    const MgrCls = resolveManagerClass();
    if (typeof MgrCls !== "function") return;

    // -------------------------------------------------------------------
    // Scenario 1 (B1): MMD non-empty alt + registry decorative:true.
    //
    // Observation: parseAltText writes the MMD alt unconditionally and
    // does not read entry.decorative (Stage 3.A Q5 lock). The registry
    // ends in a contradictory but legitimate state — both flags are set;
    // the manager UI is responsible for surfacing the conflict to the
    // user. The "legacy conflict banner" in the edit-alt-text view
    // (Stage 5 Chunk 3b) is the UI hook for this case.
    //
    // Outcome: ACCEPTABLE. Lock the observed behaviour as a regression
    // guard. The manager UI surfaces the conflict; no parser change
    // needed.
    // -------------------------------------------------------------------
    {
      console.log(
        "\n  -- Scenario 1 (B1): MMD non-empty alt + registry decorative:true --",
      );
      const cdn = "https://cdn.mathpix.com/b1-decorative.png";
      const mmd = `![non-empty alt from MMD](${cdn})`;

      const restorer = makeStubRestorer(mmd);
      restorer.imageRegistry.buildFromMMD(mmd);
      const id = restorer.imageRegistry.getAllImages()[0].id;
      restorer.imageRegistry.updateDecorative(id, true);

      const beforeDecorative = restorer.imageRegistry.getImage(id).decorative;
      const beforeAlt = restorer.imageRegistry.getImage(id).altText;
      r.assert(
        "B1-pre: registry starts with decorative:true",
        beforeDecorative === true,
      );
      r.assert(
        "B1-pre: registry starts with altText from MMD ('non-empty alt from MMD')",
        beforeAlt === "non-empty alt from MMD",
      );

      const mgr = makeStubManager(restorer);
      await mgr._reconcileOnOpen();

      const after = restorer.imageRegistry.getImage(id);
      r.assert(
        "B1.1: decorative flag PRESERVED across reconcile (Stage 3.A Q5: parseAltText doesn't read decorative)",
        after.decorative === true,
        `got ${after.decorative}`,
      );
      r.assert(
        "B1.2: altText set from MMD (parseAltText wrote unconditionally)",
        after.altText === "non-empty alt from MMD",
        `got "${after.altText}"`,
      );
      r.assert(
        "B1.3: contradictory state confirmed (decorative AND altText both populated; UI must surface conflict via edit-view legacy banner)",
        after.decorative === true && after.altText.length > 0,
      );
    }

    // -------------------------------------------------------------------
    // Scenario 2 (B2): MMD empty alt + registry non-empty altText
    //                  (decorative: false).
    //
    // Observation: parseAltText defensive-skips when the MMD alt is
    // empty (lines 410-414 of mathpix-alt-text-integrator.js). The
    // registry's user-set altText is preserved.
    //
    // Outcome: ACCEPTABLE. The defensive-skip is the documented Q5 lock
    // from Stage 3.A — empty-in-MMD should not destroy a user's stored
    // alt text. Lock the behaviour as a regression guard.
    //
    // The trade-off Q4 explicitly raised — "what if the user
    // INTENTIONALLY cleared alt by hand-editing MMD?" — is not resolved
    // here. The defensive-skip means hand-clearing alt via MMD edit
    // does NOT propagate to the registry. Users who want to clear alt
    // must do so via the manager UI. Documented as a known limitation;
    // not a Q4 escalation trigger.
    // -------------------------------------------------------------------
    {
      console.log(
        "\n  -- Scenario 2 (B2): MMD empty alt + registry non-empty altText --",
      );
      const cdn = "https://cdn.mathpix.com/b2-emptymmd.png";
      // Seed MMD has alt; we'll mutate after to mimic a user hand-edit
      // that emptied the alt while leaving the image reference in place.
      const seedMmd = `![user typed this earlier](${cdn})`;
      const emptiedMmd = `![](${cdn})`;

      const restorer = makeStubRestorer(seedMmd);
      restorer.imageRegistry.buildFromMMD(seedMmd);
      const id = restorer.imageRegistry.getAllImages()[0].id;
      // Simulate the user setting non-empty altText via the manager.
      restorer.imageRegistry.updateAltText(id, "USER_STORED_ALT", "user");
      r.assert(
        "B2-pre: registry has user-stored altText",
        restorer.imageRegistry.getImage(id).altText === "USER_STORED_ALT",
      );
      r.assert(
        "B2-pre: registry decorative is false",
        restorer.imageRegistry.getImage(id).decorative === false,
      );

      // Now the user hand-edits the MMD to empty the alt.
      restorer.restoredSession.currentMMD = emptiedMmd;

      const mgr = makeStubManager(restorer);
      await mgr._reconcileOnOpen();

      const after = restorer.imageRegistry.getImage(id);
      r.assert(
        "B2.1: registry altText PRESERVED ('USER_STORED_ALT' survives — parseAltText defensive-skips empty MMD alt)",
        after.altText === "USER_STORED_ALT",
        `got "${after.altText}"`,
      );
      r.assert(
        "B2.2: registry altTextSource still 'user' (no overwrite)",
        after.altTextSource === "user",
        `got "${after.altTextSource}"`,
      );
      r.assert(
        "B2.3: known limitation — hand-clearing alt via MMD edit does NOT propagate to registry",
        after.altText.length > 0,
      );
    }

    // -------------------------------------------------------------------
    // Scenario 3 (B3): MMD missing caption + registry non-empty title.
    //
    // Observation: parseCaptions does NOT defensive-skip when no
    // caption block exists in the MMD for an entry. It calls
    // updateTitle(id, "", source), clearing the registry's title.
    //
    // Outcome: ACCEPTABLE (locked as regression guard). The asymmetry
    // with parseAltText / parseAppendix has no documented rationale
    // in Stage 1 or 3 planning docs (Finding 8), but the behaviour is
    // internally consistent: captions live structurally in a
    // \begin{figure}\caption{...}\end{figure} wrapper, so absence of
    // the wrapper IS a positive signal that there should be no caption.
    // Alt text and appendix do not have a structural wrapper signal —
    // absence is ambiguous.
    //
    // This is a different judgement call than B2 (where empty-MMD also
    // means absence-of-signal but registry wins). Documented in this
    // test's assertions as the locked-current-behaviour; a future
    // change to parseCaptions defensiveness would fail B3.1 and force
    // re-planning.
    //
    // NOT a Q4 escalation trigger: the outcome doesn't require
    // cross-parser changes, doesn't contradict Q5's decorative-UI-only
    // lock, and doesn't suggest Q2's preserve/refresh bucketing is
    // wrong.
    // -------------------------------------------------------------------
    {
      console.log(
        "\n  -- Scenario 3 (B3): MMD missing caption + registry non-empty title --",
      );
      const cdn = "https://cdn.mathpix.com/b3-titlewipe.png";
      // Bare markdown image with no \begin{figure}\caption{...} wrapper.
      const mmd = `![alt](${cdn})`;

      const restorer = makeStubRestorer(mmd);
      restorer.imageRegistry.buildFromMMD(mmd);
      const id = restorer.imageRegistry.getAllImages()[0].id;
      // Simulate user setting a title via the manager (Stage 5
      // caption-input writes through to registry.title).
      restorer.imageRegistry.updateTitle(id, "USER_STORED_TITLE", "user");
      r.assert(
        "B3-pre: registry has user-stored title",
        restorer.imageRegistry.getImage(id).title === "USER_STORED_TITLE",
      );

      const mgr = makeStubManager(restorer);
      await mgr._reconcileOnOpen();

      const after = restorer.imageRegistry.getImage(id);
      r.assert(
        "B3.1: registry title CLEARED to '' (parseCaptions does NOT defensive-skip on missing caption block — MMD wins)",
        after.title === "",
        `got "${after.title}"`,
      );
      r.assert(
        "B3.2: asymmetry with B2 confirmed (alt preserves, title clears)",
        after.title === "" && after.altText === "alt",
      );
      r.assert(
        "B3.3: known limitation — hand-saved title gets clobbered if no figure wrapper present in MMD; users must add a \\begin{figure}\\caption{}\\end{figure} wrapper to make the title survive an MMD-edit round-trip",
        true,
      );
    }
  }

  // ============================================================================
  // GROUP C: GHOST-PURGE RETIREMENT EQUIVALENCE + IMPROVEMENT TESTS
  // (Post-Stage-6 doc-tidy interlude Phase 3 — Finding 5 retirement, 2026-05-25)
  // ============================================================================
  //
  // The new restorer-side helpers _translateBlobUrlsToCdnForMMD and
  // _cleanupBuildFromMMDRemoved (in session-restorer-images.js) replace the
  // hand-rolled markdown-only ghost-purge loops that used to live in
  // proto.loadZIPContents and proto.applyRecoveredSession.
  //
  // Group C exercises both helpers in concert against fixtures matching the
  // restore-time shape (registry seeded from a CDN-form image-registry.json,
  // live MMD in blob form, imageBlobUrlMap populated). The four cases:
  //
  //   C1 — orphan-removal equivalence + F-D memory-hygiene assertions
  //   C2 — no-orphan no-op preservation
  //   C3 — IMPROVEMENT: new-images-in-MMD-not-in-registry detected and added
  //   C4 — IMPROVEMENT: \includegraphics-referenced entries preserved
  //
  // Cases C3 and C4 lock behavioural gains over the old loops, NOT equivalence.
  // The old loops had no add path (C3) and used markdown-only regex (C4).
  //
  // Each test exercises the call-site sequence end-to-end:
  //   A. _translateBlobUrlsToCdnForMMD(workingMMD)
  //   B. imageRegistry.buildFromMMD(cdnMMD)
  //   C. _cleanupBuildFromMMDRemoved(setDiff.removed)
  //   D. (real loadZIPContents/applyRecoveredSession then call
  //       syncRegistryReferencesToBlobUrls — Group C does not exercise Phase D
  //       because the test focus is the registry/cache/blobMap state after
  //       cleanup; the restorer's blob-form sync helper has its own coverage
  //       in the session-restorer test suites.)

  function resolveRestorerClass() {
    const Cls = window.MathPixSessionRestorer;
    return typeof Cls === "function" ? Cls : null;
  }

  /**
   * Build a stub session-restorer with the prototype methods (so the new
   * _translateBlobUrlsToCdnForMMD and _cleanupBuildFromMMDRemoved helpers
   * are available) plus instance-level collaborators set to test fixtures.
   * Overrides _removeCachedImage on the instance so test assertions can
   * observe Cache API calls without touching the real Cache API.
   *
   * @returns {Object|null} Stub restorer with prototype methods + fixture state
   */
  function makeStubSessionRestorer() {
    const Cls = resolveRestorerClass();
    if (!Cls) return null;
    const RegCls = resolveRegistryClass();
    if (!RegCls) return null;

    const stub = Object.create(Cls.prototype);
    stub.imageRegistry = new RegCls();
    stub.imageBlobUrlMap = new Map();
    stub.imageFilenameMap = {};
    stub.removedCacheKeys = [];
    // Override the prototype's _removeCachedImage with a recording stub.
    stub._removeCachedImage = async function (id, filename) {
      stub.removedCacheKeys.push({ id, filename });
    };
    return stub;
  }

  async function runGroupC(r) {
    console.log(
      "\n--- Group C: Ghost-purge retirement (Finding 5) ---",
    );

    const RegCls = resolveRegistryClass();
    const RestCls = resolveRestorerClass();
    r.assert(
      "C0a: MathPixSessionRestorer exposed on window",
      typeof RestCls === "function",
    );
    r.assert(
      "C0b: MathPixSessionRestorer.prototype carries _translateBlobUrlsToCdnForMMD",
      RestCls && typeof RestCls.prototype._translateBlobUrlsToCdnForMMD === "function",
    );
    r.assert(
      "C0c: MathPixSessionRestorer.prototype carries _cleanupBuildFromMMDRemoved",
      RestCls && typeof RestCls.prototype._cleanupBuildFromMMDRemoved === "function",
    );
    if (!RegCls || !RestCls) return;

    // -------------------------------------------------------------------
    // Case C1: orphan-removal equivalence + F-D memory-hygiene gains.
    //
    // Fixture mirrors the restore-time shape that the old loops handled
    // correctly: 2 OCR images in the registry (CDN form), 1 of them
    // referenced in the live blob-form MMD; the other is a "ghost"
    // (e.g. a user-added image from a previous session that the original
    // ZIP does not reference). New path must remove the ghost, preserve
    // the referenced one, AND perform the full Q3 four-step cleanup
    // (revoke blob URL, trim imageBlobUrlMap, call Cache API removal) —
    // the F-D improvement-tag the old loops did not deliver.
    // -------------------------------------------------------------------
    {
      console.log("\n  -- Case C1: orphan-removal equivalence + F-D hygiene --");
      const cdnKeep = "https://cdn.mathpix.com/c1-keep.png";
      const cdnGhost = "https://cdn.mathpix.com/c1-ghost.png";
      const blobKeep = `blob:fake/${encodeURIComponent(cdnKeep)}`;
      const blobGhost = `blob:fake/${encodeURIComponent(cdnGhost)}`;

      const restorer = makeStubSessionRestorer();
      restorer.imageBlobUrlMap.set(cdnKeep, blobKeep);
      restorer.imageBlobUrlMap.set(cdnGhost, blobGhost);
      // Seed registry as if from image-registry.json (CDN form).
      restorer.imageRegistry.buildFromMMD(
        `![keep](${cdnKeep})\n\n![ghost](${cdnGhost})`,
      );
      const ghostEntry = restorer.imageRegistry
        .getAllImages()
        .find((e) => e.originalUrl === cdnGhost);
      restorer.imageFilenameMap[ghostEntry.id] = { filename: "ghost.png" };

      // Live MMD references only the keep entry (in blob form, post-restore).
      const liveMMD = `![keep](${blobKeep})`;
      const beforeCount = restorer.imageRegistry.getCount();
      const beforeMapSize = restorer.imageBlobUrlMap.size;

      const revoked = [];
      await withRevokeRecorder(async () => {
        const cdnMMD = restorer._translateBlobUrlsToCdnForMMD(liveMMD);
        const setDiff = restorer.imageRegistry.buildFromMMD(cdnMMD);
        await restorer._cleanupBuildFromMMDRemoved(setDiff.removed);
        r.assert(
          "C1a: setDiff.removed length 1 (ghost detected)",
          setDiff.removed.length === 1 && setDiff.removed[0].id === ghostEntry.id,
        );
        r.assert(
          "C1b: setDiff.added length 0 (no new images)",
          setDiff.added.length === 0,
        );
      }, revoked);

      r.assert(
        "C1c: registry count dropped by 1 (equivalence with old loop)",
        restorer.imageRegistry.getCount() === beforeCount - 1,
      );
      r.assert(
        "C1d: keep entry preserved",
        restorer.imageRegistry.getAllImages()[0].originalUrl === cdnKeep,
      );
      r.assert(
        "C1e: F-D improvement — ghost blob URL revoked (old loop did NOT do this)",
        revoked.length === 1 && revoked[0] === blobGhost,
        `revoked=${JSON.stringify(revoked)}`,
      );
      r.assert(
        "C1f: F-D improvement — imageBlobUrlMap trimmed (old loop did NOT do this)",
        restorer.imageBlobUrlMap.size === beforeMapSize - 1 &&
          !restorer.imageBlobUrlMap.has(cdnGhost),
      );
      r.assert(
        "C1g: F-D improvement — Cache API removal called for ghost (old loop did NOT do this)",
        restorer.removedCacheKeys.length === 1 &&
          restorer.removedCacheKeys[0].id === ghostEntry.id &&
          restorer.removedCacheKeys[0].filename === "ghost.png",
      );
      r.assert(
        "C1h: keep entry's blobMap entry preserved",
        restorer.imageBlobUrlMap.has(cdnKeep),
      );
    }

    // -------------------------------------------------------------------
    // Case C2: no-orphan no-op preservation.
    //
    // Fixture: registry and live MMD agree on the image set. New path
    // must be a no-op — count unchanged, no revocations, no map changes,
    // no Cache API calls. Equivalence with old loop (which also did
    // nothing in this case).
    // -------------------------------------------------------------------
    {
      console.log("\n  -- Case C2: no-orphan no-op preservation --");
      const cdn = "https://cdn.mathpix.com/c2-only.png";
      const blob = `blob:fake/${encodeURIComponent(cdn)}`;

      const restorer = makeStubSessionRestorer();
      restorer.imageBlobUrlMap.set(cdn, blob);
      restorer.imageRegistry.buildFromMMD(`![only](${cdn})`);

      const liveMMD = `![only](${blob})`;
      const beforeCount = restorer.imageRegistry.getCount();
      const beforeMapSize = restorer.imageBlobUrlMap.size;

      const revoked = [];
      await withRevokeRecorder(async () => {
        const cdnMMD = restorer._translateBlobUrlsToCdnForMMD(liveMMD);
        const setDiff = restorer.imageRegistry.buildFromMMD(cdnMMD);
        await restorer._cleanupBuildFromMMDRemoved(setDiff.removed);
        r.assert(
          "C2a: setDiff.added length 0",
          setDiff.added.length === 0,
        );
        r.assert(
          "C2b: setDiff.removed length 0",
          setDiff.removed.length === 0,
        );
      }, revoked);

      r.assert(
        "C2c: registry count unchanged",
        restorer.imageRegistry.getCount() === beforeCount,
      );
      r.assert(
        "C2d: F-D hygiene — no blob URLs revoked",
        revoked.length === 0,
      );
      r.assert(
        "C2e: F-D hygiene — imageBlobUrlMap size unchanged",
        restorer.imageBlobUrlMap.size === beforeMapSize,
      );
      r.assert(
        "C2f: F-D hygiene — no Cache API removals",
        restorer.removedCacheKeys.length === 0,
      );
    }

    // -------------------------------------------------------------------
    // Case C3: IMPROVEMENT — new-images-in-MMD-not-in-registry detected.
    //
    // Fixture: live MMD references a CDN image that isn't in the registry
    // (e.g. user hand-typed it into the MMD). Old loops had no add path
    // and would silently ignore the new reference. New path detects it
    // via buildFromMMD and adds it. Locked as improvement-over-old.
    // -------------------------------------------------------------------
    {
      console.log("\n  -- Case C3: IMPROVEMENT — new image added --");
      const cdnExisting = "https://cdn.mathpix.com/c3-existing.png";
      const cdnNew = "https://cdn.mathpix.com/c3-new.png";
      const blobExisting = `blob:fake/${encodeURIComponent(cdnExisting)}`;

      const restorer = makeStubSessionRestorer();
      restorer.imageBlobUrlMap.set(cdnExisting, blobExisting);
      restorer.imageRegistry.buildFromMMD(`![existing](${cdnExisting})`);

      // Live MMD has both — existing in blob form, new still in CDN form
      // (user hand-typed it directly).
      const liveMMD = `![existing](${blobExisting})\n\n![new](${cdnNew})`;
      const beforeCount = restorer.imageRegistry.getCount();

      const revoked = [];
      await withRevokeRecorder(async () => {
        const cdnMMD = restorer._translateBlobUrlsToCdnForMMD(liveMMD);
        const setDiff = restorer.imageRegistry.buildFromMMD(cdnMMD);
        await restorer._cleanupBuildFromMMDRemoved(setDiff.removed);
        r.assert(
          "C3a: IMPROVEMENT — setDiff.added includes the new image (old loop had no add path)",
          setDiff.added.length === 1,
        );
        r.assert(
          "C3b: setDiff.removed empty (existing preserved)",
          setDiff.removed.length === 0,
        );
      }, revoked);

      r.assert(
        "C3c: registry count rose by 1 (new image added — IMPROVEMENT)",
        restorer.imageRegistry.getCount() === beforeCount + 1,
      );
      const newEntry = restorer.imageRegistry
        .getAllImages()
        .find((e) => e.originalUrl === cdnNew);
      r.assert(
        "C3d: new entry's originalUrl is the CDN form (translation result)",
        !!newEntry && newEntry.originalUrl === cdnNew,
      );
      r.assert(
        "C3e: no revocations (add-only)",
        revoked.length === 0,
      );
    }

    // -------------------------------------------------------------------
    // Case C4: IMPROVEMENT — \includegraphics-referenced entries preserved.
    //
    // Fixture: registry contains an entry that the MMD references via
    // \includegraphics{url} (Stage 1's figure-env shape). Old loops used
    // markdown-only regex /!\[[^\]]*\]\(([^)]+)\)/g, so they would miss
    // the includegraphics reference and wrongly purge the entry. New path
    // detects via buildFromMMD's includegraphics branch and preserves it.
    // Locked as improvement-over-old.
    // -------------------------------------------------------------------
    {
      console.log("\n  -- Case C4: IMPROVEMENT — \\includegraphics preservation --");
      const cdnFigure = "https://cdn.mathpix.com/c4-figure.png";
      const blobFigure = `blob:fake/${encodeURIComponent(cdnFigure)}`;

      const restorer = makeStubSessionRestorer();
      restorer.imageBlobUrlMap.set(cdnFigure, blobFigure);
      // Seed registry with a CDN-form includegraphics reference.
      restorer.imageRegistry.buildFromMMD(
        `\\begin{figure}\\includegraphics{${cdnFigure}}\\caption{Caption}\\end{figure}`,
      );
      const beforeCount = restorer.imageRegistry.getCount();
      r.assert(
        "C4-pre: registry seeded with 1 includegraphics entry",
        beforeCount === 1,
      );
      const entry = restorer.imageRegistry.getAllImages()[0];
      r.assert(
        "C4-pre: entry has syntax === 'includegraphics'",
        entry.syntax === "includegraphics",
      );

      // Live MMD references the same image in blob form via includegraphics.
      const liveMMD = `\\begin{figure}\\includegraphics{${blobFigure}}\\caption{Caption}\\end{figure}`;

      const revoked = [];
      await withRevokeRecorder(async () => {
        const cdnMMD = restorer._translateBlobUrlsToCdnForMMD(liveMMD);
        const setDiff = restorer.imageRegistry.buildFromMMD(cdnMMD);
        await restorer._cleanupBuildFromMMDRemoved(setDiff.removed);
        r.assert(
          "C4a: IMPROVEMENT — setDiff.removed empty for \\includegraphics reference (old markdown-only loop would have purged this)",
          setDiff.removed.length === 0,
        );
        r.assert(
          "C4b: setDiff.added empty (existing preserved)",
          setDiff.added.length === 0,
        );
      }, revoked);

      r.assert(
        "C4c: registry count preserved (IMPROVEMENT vs old markdown-only loop)",
        restorer.imageRegistry.getCount() === beforeCount,
      );
      r.assert(
        "C4d: no revocations (no purge happened)",
        revoked.length === 0,
      );
      r.assert(
        "C4e: imageBlobUrlMap entry preserved",
        restorer.imageBlobUrlMap.has(cdnFigure),
      );
    }
  }

  // ============================================================================
  // TOP-LEVEL RUNNER
  // ============================================================================

  async function runStage6Tests() {
    console.log("=== Stage 6 Tests ===");
    const r = makeResults();

    await runGroupA(r);
    await runGroupB(r);
    await runGroupC(r);

    console.log("\n--- Stage 6 results ---");
    console.log(
      `Results: ${r.passed} passed, ${r.failed} failed, ${r.skipped} skipped`,
    );

    return {
      passed: r.passed,
      failed: r.failed,
      skipped: r.skipped,
      results: r.results,
    };
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.runStage6Tests = runStage6Tests;

  logInfo("Stage 6 test runner registered: window.runStage6Tests()");
})();
