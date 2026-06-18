/**
 * @fileoverview Item 2 — getMMDForStorage unresolvable-blob warning gate tests
 * @module mathpix-item2-warn-gate-tests
 *
 * @description
 * Regression guard for the Item 2 fix: getMMDForStorage's Step 2 fallback used
 * to emit `getMMDForStorage: unresolvable blob URL` at WARN level for EVERY blob
 * it could not reverse — including the working-as-designed case where a swap
 * revoked a pre-swap blob and overwrote its map mapping, leaving that OLD blob
 * stranded in older snapshots (undo/redo, baseline/original on the version-switch
 * path). That blob is legitimately unreversible and is correctly emitted as its
 * CDN URL; the warning was noise, not a failure (the durable copy is the ZIP).
 *
 * The fix gates the warning on the LIVE document — this.restoredSession.currentMMD
 * (NOT the mmdContent/storageSafe being processed):
 *   - stranded blob NOT present in a valid-string currentMMD → stale snapshot
 *     artifact (case a) → downgrade to logDebug (no WARN).
 *   - blob present in currentMMD, OR currentMMD missing/non-string → keep WARN
 *     (case b / case c), so genuine corruption and unverifiable states are never
 *     silenced (fail-toward-warn).
 *
 * The distinguisher was chosen empirically: the mmdReference/user-replaced signal
 * was refuted (it misattributes after a re-swap); currentMMD-membership held
 * across single- and double-swap traces and is re-swap-proof by construction.
 *
 * Tests call the REAL getMMDForStorage on a synthetic restorer context and spy
 * console.warn for the unresolvable message. They operate on
 * window.MathPixSessionRestorer.prototype, so they need no active mode and no
 * initialised controller. No localStorage is written.
 *
 * @usage
 *   window.runItem2WarnGateTests()  →  {passed, failed, tests}
 */

(function () {
  "use strict";

  // ── Logging (module pattern, IIFE-scoped) ─────────────────────────────────
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[Item2 Tests] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[Item2 Tests] ${message}`, ...args);
  }

  // ── Test harness ──────────────────────────────────────────────────────────
  function createResults() {
    return { passed: 0, failed: 0, tests: [] };
  }
  function record(results, name, condition) {
    const passed = !!condition;
    results.tests.push({ name, passed });
    if (passed) {
      results.passed++;
      console.log(`✅ ${name}`);
    } else {
      results.failed++;
      console.log(`❌ ${name}`);
    }
  }

  const STALE_BLOB = "blob:http://localhost:8080/STALE-1111-2222-3333";
  const LIVE_BLOB = "blob:http://localhost:8080/LIVE-4444-5555-6666";
  const SNAPSHOT_WITH_STALE = `# Doc\n\n![](${STALE_BLOB})\n\nbody text\n`;

  /**
   * Synthetic restorer context with no reversible mappings, so STALE_BLOB always
   * reaches the Step 2 fallback: empty imageBlobUrlMap (Step 1 no-op) and an
   * empty registry (no originalUrl match). Only restoredSession.currentMMD varies
   * per case — that is the signal the gate reads.
   */
  function makeCtx(proto, currentMMD) {
    return {
      restoredSession: { currentMMD },
      imageBlobUrlMap: new Map(),
      imageRegistry: { getAllImages: () => [] },
      imageFilenameMap: {},
      getMMDForStorage: proto.getMMDForStorage,
    };
  }

  /**
   * Run getMMDForStorage on the stale-blob snapshot with the given currentMMD,
   * counting only the "unresolvable blob URL" warnings (Step 1's unrelated
   * "skipping undefined blobUrl" warning, if any, is ignored).
   */
  function runCase(proto, currentMMD) {
    const realWarn = console.warn;
    let unresolvableWarns = 0;
    console.warn = (...args) => {
      if (
        typeof args[0] === "string" &&
        args[0].includes("unresolvable blob URL")
      ) {
        unresolvableWarns++;
      }
    };
    let output;
    try {
      output = proto.getMMDForStorage.call(makeCtx(proto, currentMMD), SNAPSHOT_WITH_STALE);
    } finally {
      console.warn = realWarn;
    }
    return { unresolvableWarns, output };
  }

  // ── The suite ─────────────────────────────────────────────────────────────
  window.runItem2WarnGateTests = function () {
    console.log("🧪 Item 2 getMMDForStorage warn-gate tests…\n");
    const results = createResults();

    const proto =
      window.MathPixSessionRestorer && window.MathPixSessionRestorer.prototype;
    record(results, "MathPixSessionRestorer.prototype available", !!proto);
    if (!proto || typeof proto.getMMDForStorage !== "function") {
      record(results, "getMMDForStorage is a function", false);
      printSummary(results);
      return results;
    }

    // Limb (a) — stale snapshot blob, absent from a valid-string currentMMD →
    // expected case (a): downgraded, NO unresolvable warning.
    const a = runCase(proto, `# Doc\n\n![](${LIVE_BLOB})\n`);
    record(
      results,
      "(a) stale blob absent from live currentMMD → NO unresolvable warn",
      a.unresolvableWarns === 0,
    );

    // Limb (b) — blob present in the live currentMMD but unreversible →
    // genuine case (b): warning retained.
    const b = runCase(proto, SNAPSHOT_WITH_STALE);
    record(
      results,
      "(b) blob live in currentMMD but unreversible → WARN retained",
      b.unresolvableWarns >= 1,
    );

    // Limb (c) — currentMMD unavailable (null / undefined / non-string) →
    // fail-toward-warn: warning retained, never silenced when staleness is
    // unverifiable.
    const cNull = runCase(proto, null);
    const cUndef = runCase(proto, undefined);
    const cNonString = runCase(proto, 12345);
    record(
      results,
      "(c) currentMMD null → WARN retained (fail-loud)",
      cNull.unresolvableWarns >= 1,
    );
    record(
      results,
      "(c) currentMMD undefined → WARN retained (fail-loud)",
      cUndef.unresolvableWarns >= 1,
    );
    record(
      results,
      "(c) currentMMD non-string → WARN retained (fail-loud)",
      cNonString.unresolvableWarns >= 1,
    );

    // Behaviour invariant — the gate changes LOGGING ONLY. In every case the
    // unreversible blob is still returned unchanged (CDN-reversal/placeholder
    // behaviour is untouched), so the stale blob survives in the output.
    record(
      results,
      "behaviour unchanged: stale blob still present in output (case a)",
      typeof a.output === "string" && a.output.includes(STALE_BLOB),
    );
    record(
      results,
      "behaviour unchanged: stale blob still present in output (case b)",
      typeof b.output === "string" && b.output.includes(STALE_BLOB),
    );

    printSummary(results);
    return results;
  };

  function printSummary(results) {
    const total = results.passed + results.failed;
    const status = results.failed === 0 ? "✅ PASSED" : "❌ FAILED";
    console.log(
      `\n📊 Item 2 warn-gate tests: ${results.passed}/${total} passed ${status}`,
    );
  }

  logInfo("Item 2 warn-gate test suite loaded (window.runItem2WarnGateTests)");
})();
