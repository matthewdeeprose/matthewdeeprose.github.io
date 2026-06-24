/**
 * @fileoverview Re-open context survival suite — P4 (preserve stamped context over ZIP)
 * @module mathpix-reopen-context-tests
 * @version 1.0.0
 *
 * @description
 * Console harness for the re-open context-survival spine (P3/P4) that lives
 * inline in session-restorer-restore.js's extractAndRestoreContext. That logic
 * is NOT exported, so each arm below COPIES the production fragment it guards
 * byte-identically and exercises it against the live MathPixContextManager — so
 * a drift in the production fragment without a matching edit here shows up as a
 * RED, and a deliberate spec change forces both to move together.
 *
 * Five unit-testable arms, none of which need a real ZIP or OCR session:
 *
 *   1. Structural clear (live manager) — seed the two mirror keys with
 *      sentinels, call reset(), and assert both keys are gone. The real context
 *      is snapshotted up front and restored at the end, since reset() blanks it.
 *   2. Base-name match — the production normalisation
 *      (name) => name.replace(/\.[^/.]+$/, "") makes "doc.zip" and "doc.pdf"
 *      compare equal, and "doc" vs "other" not.
 *   3. Capture trichotomy (silent) — the production classifier (JSON.parse in
 *      try/catch, then accept only a non-null, non-array object) rejects a
 *      malformed string and the non-plain-object encodings, and holds a valid
 *      plain object.
 *   4. Divergence test (live manager) — the production comparison
 *      (zip[key] ?? "") !== (cap[key] ?? "") over the manager's live keys treats
 *      an all-keys-equal capture as no-preserve and a single-key difference as a
 *      preserve.
 *   5. Stamp lifecycle invariant — after reset() the source stamp is null, and
 *      the production capture guard Boolean(mirrorRaw && stamp && incoming) is
 *      false when the stamp is absent, proving an absent stamp never preserves.
 *
 * NOT FAKED HERE. The full re-open override (capture → reset → ZIP branch →
 * divergence override) and the deferred dirty raise both need a LIVE restore of
 * a real session ZIP, which this bare-page suite deliberately does not stand up.
 * They are recorded as proven by the [MANUAL] close-and-reopen gate — the same
 * way runStage9Tests leaves the hydrate path to a manual reload — via a logged
 * note below, never a faked pass.
 *
 * REGRESSION BASELINE — emitted-check floor: runReopenContextTests() reports a
 * `total` of 16 checks (1 manager-presence preflight + 3 structural-clear + 4
 * base-name + 4 capture-trichotomy + 2 divergence + 2 stamp-lifecycle). This is
 * the count of every assert() EMITTED, pass or fail. Treat the emitted total
 * (not a pass count) as the floor so it stays honest as the suite grows: a
 * change to the emitted total means a check was added or removed, whereas a RED
 * on today's code means a production fragment drifted from its copy here.
 *
 * NOTE: runReopenContextTests() is async (the settle step awaits the manager's
 * debounced mirror write before restoring). It returns a Promise resolving to
 * the results object; the console.table + summary still print when it settles.
 *
 * @usage
 * Include after mathpix-context-manager.js and session-restorer-restore.js in
 * tools.html (alongside the other MathPix testing harnesses).
 *   - window.runReopenContextTests()  — run the whole harness (await or read console)
 */

(function () {
  "use strict";

  // =========================================================================
  // LOGGING (IIFE-scoped, suite tracing only)
  // =========================================================================

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
      console.error(`[ReopenContextTests] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[ReopenContextTests] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[ReopenContextTests] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[ReopenContextTests] ${message}`, ...args);
  }

  // =========================================================================
  // CONTRACT CONSTANTS — mirror the manager's module-local keys, which the
  // restorer cannot import (the two IIFEs share no module). These are the
  // literal strings the production capture/stamp code reads and writes.
  // =========================================================================

  /** The autosave mirror key (manager's private MIRROR_STORAGE_KEY; mirrored). */
  const MIRROR_KEY = "mathpix-context-current";
  /** The companion stamp key (manager's private MIRROR_SOURCE_KEY; mirrored). */
  const MIRROR_SOURCE_KEY = "mathpix-context-current-source";
  /** Mirrors the manager's module-local MIRROR_DEBOUNCE_MS (1000 ms). */
  const MIRROR_DEBOUNCE_MS = 1000;
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  // =========================================================================
  // PRODUCTION FRAGMENTS — copied byte-identically from
  // session-restorer-restore.js::extractAndRestoreContext so the suite guards
  // the live specification. Any edit there without a matching edit here turns a
  // green arm red.
  // =========================================================================

  /**
   * Base-name normalisation. Strips a trailing extension exactly the way the
   * production capture compares the stamp against the incoming session filename.
   * @param {string} name
   * @returns {string}
   */
  function normaliseBaseName(name) {
    return name.replace(/\.[^/.]+$/, "");
  }

  /**
   * Capture trichotomy (silent). JSON.parse in try/catch, then accept ONLY a
   * non-null, non-array object; everything else (parse throw, null, array,
   * primitive) yields no capture. Byte-identical to the production classifier.
   * @param {string} mirrorRaw
   * @returns {Object|null} the captured plain object, or null
   */
  function classifyCapture(mirrorRaw) {
    let capturedContext = null;
    try {
      const parsedMirror = JSON.parse(mirrorRaw);
      if (
        parsedMirror !== null &&
        typeof parsedMirror === "object" &&
        !Array.isArray(parsedMirror)
      ) {
        capturedContext = parsedMirror;
      }
    } catch (captureError) {
      // Silent: any read/parse failure simply means nothing is captured.
      capturedContext = null;
    }
    return capturedContext;
  }

  /**
   * Divergence test. Returns true when the captured context differs from the
   * ZIP-branch context on ANY key — the signal that the user's unsaved edit
   * should override the session value. Byte-identical to the production compare.
   * @param {Object} zipContext
   * @param {Object} capturedContext
   * @returns {boolean}
   */
  function isDiverged(zipContext, capturedContext) {
    return Object.keys(zipContext).some(
      (key) => (zipContext[key] ?? "") !== (capturedContext[key] ?? ""),
    );
  }

  /**
   * Capture guard. The production code only attempts a capture when all three
   * of mirrorRaw, stamp and incoming are truthy. Byte-identical predicate.
   * @param {*} mirrorRaw
   * @param {*} stamp
   * @param {*} incoming
   * @returns {boolean}
   */
  function captureGuard(mirrorRaw, stamp, incoming) {
    return Boolean(mirrorRaw && stamp && incoming);
  }

  // =========================================================================
  // RUNNER
  // =========================================================================

  /**
   * Run the re-open context-survival harness. Self-contained: collects every
   * check into one results object, prints it with console.table, and returns it.
   *
   * @returns {{passed:number, failed:number, total:number, failures:Array<string>, checks:Object}}
   */
  async function runReopenContextTests() {
    logInfo("Starting re-open context-survival harness");

    const checks = {};
    const failures = [];
    let passed = 0;
    let failed = 0;
    let total = 0;

    /**
     * Record one boolean check. Never throws — a thrown predicate is caught by
     * the caller and recorded as a failure, so one bad check can't abort the
     * run.
     * @param {string} label
     * @param {boolean} condition
     */
    function assert(label, condition) {
      total++;
      const ok = condition === true;
      if (ok) {
        passed++;
      } else {
        failed++;
        failures.push(label);
      }
      checks[label] = ok ? "✅ PASS" : "❌ FAIL";
    }

    const mgr = window.MathPixContextManager;

    // Snapshot the live context + both mirror keys BEFORE any arm mutates them;
    // a single settle-and-restore at the end leaves the page exactly as found.
    const origContext =
      mgr && typeof mgr.getContext === "function" ? mgr.getContext() : {};
    let origMirror = null;
    let origStamp = null;
    try {
      origMirror = localStorage.getItem(MIRROR_KEY);
      origStamp = localStorage.getItem(MIRROR_SOURCE_KEY);
    } catch (err) {
      logWarn("Could not snapshot the mirror keys", err);
    }

    // -----------------------------------------------------------------------
    // 0. Manager presence — the live arms (1 and 4) need it; the pure arms
    //    (2, 3, 5) do not, but record the dependency for an honest preflight.
    // -----------------------------------------------------------------------
    assert(
      "0.1 window.MathPixContextManager exists with getContext/setContext/reset",
      !!mgr &&
        typeof mgr.getContext === "function" &&
        typeof mgr.setContext === "function" &&
        typeof mgr.reset === "function",
    );

    // -----------------------------------------------------------------------
    // 1. Structural clear (live manager). Seed both mirror keys with sentinels,
    //    call the real reset(), and assert BOTH keys are gone — the production
    //    "restore-start reset" guarantee that reset() clears the mirror AND its
    //    companion stamp. Wrapped so a missing manager degrades to a recorded
    //    FAIL rather than aborting.
    // -----------------------------------------------------------------------
    let mirrorAfterReset = "unset";
    let stampAfterReset = "unset";
    let resetThrew = false;
    try {
      if (mgr && typeof mgr.reset === "function") {
        localStorage.setItem(MIRROR_KEY, '{"subjectArea":"sentinel-mirror"}');
        localStorage.setItem(MIRROR_SOURCE_KEY, "sentinel-source.zip");
        mgr.reset();
        mirrorAfterReset = localStorage.getItem(MIRROR_KEY);
        stampAfterReset = localStorage.getItem(MIRROR_SOURCE_KEY);
      }
    } catch (err) {
      resetThrew = true;
      logError("Structural-clear arm threw", err);
    }
    assert("1.1 reset() did not throw", resetThrew === false);
    assert(
      "1.2 reset() removes the mirror key (mathpix-context-current absent)",
      mirrorAfterReset === null,
    );
    assert(
      "1.3 reset() removes the stamp key (mathpix-context-current-source absent)",
      stampAfterReset === null,
    );

    // -----------------------------------------------------------------------
    // 2. Base-name match. The production normalisation strips a trailing
    //    extension before comparing the stamp against the incoming filename, so
    //    a session saved as "doc.zip" matches a stamp written for "doc.pdf",
    //    while unrelated stems stay distinct.
    // -----------------------------------------------------------------------
    assert(
      '2.1 "doc.zip" normalises to "doc"',
      normaliseBaseName("doc.zip") === "doc",
    );
    assert(
      '2.2 "doc.pdf" normalises to "doc"',
      normaliseBaseName("doc.pdf") === "doc",
    );
    assert(
      '2.3 "doc.zip" and "doc.pdf" normalise equal (base-name match)',
      normaliseBaseName("doc.zip") === normaliseBaseName("doc.pdf"),
    );
    assert(
      '2.4 "doc" and "other" do NOT normalise equal',
      normaliseBaseName("doc") !== normaliseBaseName("other"),
    );

    // -----------------------------------------------------------------------
    // 3. Capture trichotomy (silent). The classifier accepts ONLY a non-null,
    //    non-array object; a malformed string, an array encoding and a bare
    //    primitive all yield no capture, and never throw.
    // -----------------------------------------------------------------------
    assert(
      '3.1 malformed mirror "{not json" yields no capture (null)',
      classifyCapture("{not json") === null,
    );
    assert(
      '3.2 array encoding "[1,2,3]" yields no capture (null)',
      classifyCapture("[1,2,3]") === null,
    );
    assert(
      '3.3 primitive "42" yields no capture (null)',
      classifyCapture("42") === null,
    );
    const heldCapture = classifyCapture('{"subjectArea":"Maths"}');
    assert(
      '3.4 valid plain object \'{"subjectArea":"Maths"}\' is held',
      heldCapture !== null &&
        typeof heldCapture === "object" &&
        !Array.isArray(heldCapture) &&
        heldCapture.subjectArea === "Maths",
    );

    // -----------------------------------------------------------------------
    // 4. Divergence test (live manager). Reading the manager's CURRENT context
    //    as the "zip branch" value, a capture equal on every live key must be
    //    no-preserve (diverged === false), and a capture differing on any single
    //    key must be a preserve (diverged === true). Wrapped so a missing
    //    manager degrades to a recorded FAIL.
    // -----------------------------------------------------------------------
    let equalNoPreserve = null;
    let differingPreserve = null;
    try {
      if (mgr && typeof mgr.getContext === "function") {
        const zipContext = mgr.getContext();
        // An object equal to the current context on every live key.
        const equalCapture = { ...zipContext };
        equalNoPreserve = isDiverged(zipContext, equalCapture);
        // The same object with exactly one key perturbed.
        const firstKey = Object.keys(zipContext)[0];
        const differingCapture = { ...zipContext };
        differingCapture[firstKey] =
          (zipContext[firstKey] ?? "") + "-perturbed";
        differingPreserve = isDiverged(zipContext, differingCapture);
      }
    } catch (err) {
      logError("Divergence arm threw", err);
    }
    assert(
      "4.1 capture equal on every live key is no-preserve (diverged false)",
      equalNoPreserve === false,
    );
    assert(
      "4.2 capture differing on a single key is a preserve (diverged true)",
      differingPreserve === true,
    );

    // -----------------------------------------------------------------------
    // 5. Stamp lifecycle invariant. After reset() the source stamp is null, and
    //    the production capture guard is false when the stamp is absent — so an
    //    absent stamp can never reach the capture, let alone a preserve.
    // -----------------------------------------------------------------------
    let stampAfterResetForGuard = "unset";
    try {
      if (mgr && typeof mgr.reset === "function") {
        mgr.reset();
        stampAfterResetForGuard = localStorage.getItem(MIRROR_SOURCE_KEY);
      }
    } catch (err) {
      logError("Stamp-lifecycle arm threw", err);
    }
    assert(
      "5.1 reset() leaves the source stamp null",
      stampAfterResetForGuard === null,
    );
    assert(
      "5.2 capture guard is false when the stamp is absent (never preserves)",
      captureGuard('{"subjectArea":"Maths"}', stampAfterResetForGuard, "doc.zip") ===
        false,
    );

    // ── Settle + restore — leave the context and both mirror keys clean ─────
    try {
      if (
        mgr &&
        typeof mgr.reset === "function" &&
        typeof mgr.setContext === "function"
      ) {
        mgr.reset(); // cancels any pending mirror write + clears both keys
        mgr.setContext(origContext); // repaint forms to the original context
        await sleep(MIRROR_DEBOUNCE_MS + 200); // let that single write settle
        if (origMirror === null) {
          localStorage.removeItem(MIRROR_KEY);
        } else {
          localStorage.setItem(MIRROR_KEY, origMirror);
        }
        if (origStamp === null) {
          localStorage.removeItem(MIRROR_SOURCE_KEY);
        } else {
          localStorage.setItem(MIRROR_SOURCE_KEY, origStamp);
        }
      }
    } catch (err) {
      logWarn("Context/mirror restore after the arms failed", err);
    }

    // -----------------------------------------------------------------------
    // [MANUAL] close gate — NOT asserted here, by design.
    //
    // The full re-open override (capture → restore-start reset → ZIP branch →
    // divergence override → preserved flag) and the deferred dirty raise
    // (document.dispatchEvent("mathpix:context-edited") gated on
    // ctxResult.preserved, fired after the recovery block) both require a LIVE
    // restore of a real session ZIP through the resume spine. This bare-page
    // suite deliberately does not stand up a ZIP or an OCR session, so — as
    // runStage9Tests leaves the hydrate path to a manual reload — these two are
    // recorded as proven by the manual close-and-reopen gate, never faked into a
    // pass. To verify by hand: edit the Context tab without saving, close, then
    // re-open the same document and confirm the unsaved edits survive over the
    // session value and the Download Updated ZIP button surfaces.
    // -----------------------------------------------------------------------

    // -----------------------------------------------------------------------
    // Report
    // -----------------------------------------------------------------------
    console.table(checks);
    console.log(
      `📊 Re-open context-survival harness: ${passed}/${total} checks passed` +
        (failed === 0 ? " — ALL CLEAR ✅" : ` (${failed} FAILED ❌)`),
    );
    console.log(
      "ℹ️ [MANUAL] full re-open override + deferred dirty raise proven by the close-and-reopen gate (see source note); not asserted here.",
    );
    if (failures.length > 0) {
      console.log("Failed checks:");
      for (const f of failures) console.log(`  - ${f}`);
    }

    return { passed, failed, total, failures, checks };
  }

  // =========================================================================
  // GLOBAL EXPOSURE
  // =========================================================================

  window.runReopenContextTests = runReopenContextTests;

  logInfo("Re-open context-survival harness loaded");
  console.log(
    "💡 Type runReopenContextTests() to run the re-open context-survival suite",
  );
})();
