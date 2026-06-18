/**
 * @fileoverview Stage 8 test runner — verifies document-context persistence
 *   in the session ZIP: the write helper (addContextToArchive), the read
 *   step (extractAndRestoreContext) with its parse-level load trichotomy,
 *   the Q2 snapshot-at-save semantics, and the Q4 lifecycle boundaries.
 * @module MathPixStage8Tests
 * @requires MathPixContextManager, MathPixTotalDownloader, MathPixSessionRestorer, JSZip
 * @version 1.0.0
 *
 * Bare-page runnable: groups A and B drive the prototype methods directly
 * against constructed JSZip archives. Group C's controller-dependent rows
 * (clear-results and staging boundaries) skip gracefully when the MathPix
 * controller is not loaded, per the stage 4/5 convention; their permanent
 * gate record is the Parcel 4/5 evidence in the Stage 8 ledger.
 *
 * Usage: `window.runStage8Tests()` from the console. Returns
 *   { passed, failed, skipped, results }.
 *
 * @see mathpix-scripts/docs/alt-text/stage-8-planning-decisions.md — Q1–Q5
 * @see mathpix-scripts/docs/alt-text/stage-8-implementation-plan.md — §4 Parcel 6
 */

(function () {
  "use strict";

  // ==========================================================================
  // LOGGING CONFIGURATION
  // ==========================================================================

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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error(msg, ...args);
  }
  function logWarn(msg, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn(msg, ...args);
  }
  function logInfo(msg, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log(msg, ...args);
  }
  function logDebug(msg, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log(msg, ...args);
  }

  // Pinned Q5 wording — asserted by exact string equality. ASCII
  // apostrophes and a U+2014 em dash; do not normalise.
  const PINNED_TOAST =
    "This session's document context couldn't be read — please check the Context tab before generating alt text.";

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function makeAccumulator() {
    const results = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    return {
      async check(label, fn) {
        try {
          await fn();
          passed++;
          results.push({ label, outcome: "passed", error: null });
        } catch (err) {
          failed++;
          const errMsg = err && err.message ? err.message : String(err);
          logError(`FAIL — ${label}: ${errMsg}`);
          results.push({ label, outcome: "failed", error: errMsg });
        }
      },
      skip(label, reason) {
        skipped++;
        logInfo(`SKIP — ${label} (${reason})`);
        results.push({ label, outcome: "skipped", error: null });
      },
      get passed() {
        return passed;
      },
      get failed() {
        return failed;
      },
      get skipped() {
        return skipped;
      },
      get results() {
        return results;
      },
    };
  }

  // ==========================================================================
  // SHARED FIXTURES
  // ==========================================================================

  const M = () => window.MathPixContextManager;

  function contextZip(text) {
    const zip = new JSZip();
    zip.file("metadata/context.json", text);
    return zip;
  }

  function runRead(zipOrNull) {
    return window.MathPixSessionRestorer.prototype.extractAndRestoreContext.call(
      { restoredSession: { zip: zipOrNull } },
    );
  }

  function runWrite(zip) {
    window.MathPixTotalDownloader.prototype.addContextToArchive.call(null, zip);
  }

  const isBlank = () => Object.values(M().getContext()).every((v) => v === "");

  function knownValues(keys, tag) {
    const o = {};
    keys.forEach((k, i) => {
      o[k] = `${tag}-${i}`;
    });
    return o;
  }

  // ==========================================================================
  // RUNNER
  // ==========================================================================

  async function runStage8Tests() {
    const r = makeAccumulator();

    let keys = [];
    let prereqsOk = false;
    await r.check(
      "P0: prerequisites present (manager, JSZip, write helper, read method)",
      () => {
        assert(window.MathPixContextManager, "MathPixContextManager missing");
        assert(typeof JSZip !== "undefined", "JSZip missing");
        assert(
          typeof window.MathPixTotalDownloader?.prototype
            ?.addContextToArchive === "function",
          "addContextToArchive missing",
        );
        assert(
          typeof window.MathPixSessionRestorer?.prototype
            ?.extractAndRestoreContext === "function",
          "extractAndRestoreContext missing",
        );
        M().reset();
        keys = Object.keys(M().getContext());
        assert(keys.length === 8, `expected eight schema keys, got ${keys.length}`);
        prereqsOk = true;
      },
    );
    if (!prereqsOk) {
      logError("Stage 8 prerequisites missing — aborting remaining rows");
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

    const snapshot = M().getContext();
    const savedNotify = window.notifyWarning;
    const notifications = [];
    window.notifyWarning = (msg) => {
      notifications.push(msg);
    };
    const noteCount = () => notifications.length;

    try {
      // ── Group A: round-trip and snapshot semantics ──────────────────────
      await r.check(
        "A1: round-trip — write helper then read method on the same zip",
        async () => {
          const known = knownValues(keys, "roundtrip");
          M().setContext(known);
          const zip = new JSZip();
          runWrite(zip);
          M().reset(); // the restore must do the work, not residue
          const res = await runRead(zip);
          assert(res.branch === "valid", `branch ${res.branch}`);
          keys.forEach((k) =>
            assert(M().getContext()[k] === known[k], `key ${k} mismatch`),
          );
        },
      );

      await r.check(
        "A2: save-race — reset immediately after write; archive keeps pre-reset values",
        async () => {
          const known = knownValues(keys, "racer");
          M().setContext(known);
          const zip = new JSZip();
          runWrite(zip);
          M().reset(); // a boundary firing straight after the save click
          const parsed = JSON.parse(
            await zip.file("metadata/context.json").async("text"),
          );
          keys.forEach((k) =>
            assert(parsed[k] === known[k], `key ${k} lost the snapshot`),
          );
        },
      );

      // ── Group B: the load trichotomy ────────────────────────────────────
      await r.check("B1: absent file — silent blank", async () => {
        const before = noteCount();
        M().setContext({ [keys[0]]: "residue-B1" });
        const res = await runRead(new JSZip());
        assert(res.branch === "absent", `branch ${res.branch}`);
        assert(isBlank(), "context not blank");
        assert(noteCount() === before, "notified on absent");
      });

      await r.check("B2: valid file — values applied, silent", async () => {
        const before = noteCount();
        const known = knownValues(keys, "valid");
        const res = await runRead(contextZip(JSON.stringify(known)));
        assert(res.branch === "valid", `branch ${res.branch}`);
        keys.forEach((k) =>
          assert(M().getContext()[k] === known[k], `key ${k} mismatch`),
        );
        assert(noteCount() === before, "notified on valid");
      });

      await r.check(
        "B3: legitimately empty eight-blank file — valid, silent, blank",
        async () => {
          const before = noteCount();
          M().setContext({ [keys[0]]: "residue-B3" });
          const empties = Object.fromEntries(keys.map((k) => [k, ""]));
          const res = await runRead(contextZip(JSON.stringify(empties)));
          assert(res.branch === "valid", `branch ${res.branch}`);
          assert(isBlank(), "context not blank");
          assert(noteCount() === before, "notified on empty-but-valid");
        },
      );

      await r.check(
        "B4: malformed JSON — blank, notification once, exact pinned wording",
        async () => {
          const before = noteCount();
          M().setContext({ [keys[0]]: "residue-B4" });
          const res = await runRead(contextZip("{not json"));
          assert(res.branch === "malformed", `branch ${res.branch}`);
          assert(isBlank(), "context not blank");
          assert(noteCount() === before + 1, "expected exactly one notification");
          assert(
            notifications[notifications.length - 1] === PINNED_TOAST,
            "wording differs from the pinned string",
          );
        },
      );

      await r.check(
        "B5: valid JSON, wrong shape ([]) — malformed, notifies once",
        async () => {
          const before = noteCount();
          const res = await runRead(contextZip("[]"));
          assert(res.branch === "malformed", `branch ${res.branch}`);
          assert(noteCount() === before + 1, "expected exactly one notification");
        },
      );

      await r.check('B6: {"foo":"bar"} — valid, silent, blank', async () => {
        const before = noteCount();
        const res = await runRead(contextZip('{"foo":"bar"}'));
        assert(res.branch === "valid", `branch ${res.branch}`);
        assert(isBlank(), "context not blank");
        assert(noteCount() === before, "notified on no-usable-keys");
      });

      await r.check(
        "B7: residue guard — full residue then absent-file restore — blank",
        async () => {
          M().setContext(knownValues(keys, "residue"));
          const res = await runRead(new JSZip());
          assert(res.branch === "absent", `branch ${res.branch}`);
          assert(isBlank(), "residue survived");
        },
      );

      await r.check(
        "B8: document swap — A's residue, restore B's file — exactly B",
        async () => {
          const a = knownValues(keys, "docA");
          const b = knownValues(keys, "docB");
          M().setContext(a);
          const res = await runRead(contextZip(JSON.stringify(b)));
          assert(res.branch === "valid", `branch ${res.branch}`);
          keys.forEach((k) =>
            assert(M().getContext()[k] === b[k], `key ${k} not B's value`),
          );
        },
      );

      await r.check(
        "B9: manager absent at restore start — skipped, no throw, residue untouched",
        async () => {
          M().setContext({ [keys[0]]: "residue-B9" });
          const saved = window.MathPixContextManager;
          let res;
          try {
            delete window.MathPixContextManager;
            res = await runRead(contextZip("{}"));
          } finally {
            window.MathPixContextManager = saved;
          }
          assert(res.branch === "skipped", `branch ${res.branch}`);
          assert(
            M().getContext()[keys[0]] === "residue-B9",
            "residue was touched despite skip",
          );
        },
      );

      await r.check("B10: missing ZIP handle — graceful blank", async () => {
        M().setContext({ [keys[0]]: "residue-B10" });
        const res = await runRead(null);
        assert(res.branch === "missing-handle", `branch ${res.branch}`);
        assert(isBlank(), "context not blank");
      });

      await r.check(
        'B11: {"__proto__":{"x":1}} — blank, Object.prototype unpolluted',
        async () => {
          const res = await runRead(contextZip('{"__proto__":{"x":1}}'));
          assert(res.branch === "valid", `branch ${res.branch}`);
          assert(isBlank(), "context not blank");
          assert(({}).x === undefined, "Object.prototype was polluted");
        },
      );

      // ── Group C: lifecycle boundaries ───────────────────────────────────
      await r.check("C1: reset double-fire — no throw, blank", () => {
        M().setContext({ [keys[0]]: "residue-C1" });
        M().reset();
        M().reset();
        assert(isBlank(), "context not blank after double reset");
      });

      const controller = window.getMathPixController?.();
      if (!controller || !controller.fileHandler) {
        r.skip(
          "C2: clearAllSessionData boundary — blank, double-fire safe",
          "controller not loaded on bare page",
        );
        r.skip(
          "C3: successful staging via handleUpload — blank",
          "controller not loaded on bare page",
        );
        r.skip(
          "C4: failed validation via handleUpload — returns false, context intact",
          "controller not loaded on bare page",
        );
      } else {
        await r.check(
          "C2: clearAllSessionData boundary — blank, double-fire safe",
          () => {
            M().setContext({ [keys[0]]: "residue-C2" });
            controller.clearAllSessionData();
            controller.clearAllSessionData();
            assert(isBlank(), "context not blank after boundary clear");
          },
        );

        const pngBytes = Uint8Array.from(
          atob(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
          ),
          (c) => c.charCodeAt(0),
        );

        await r.check("C3: successful staging via handleUpload — blank", async () => {
          try {
            M().setContext({ [keys[0]]: "residue-C3" });
            await controller.fileHandler.handleUpload(
              new File([pngBytes], "stage8-tests.png", { type: "image/png" }),
            );
            assert(isBlank(), "context not blank after successful staging");
          } finally {
            try {
              controller.clearAllSessionData();
            } catch (tidyError) {
              logDebug("Post-staging tidy failed (non-fatal)", tidyError);
            }
          }
        });

        await r.check(
          "C4: failed validation via handleUpload — returns false, context intact",
          async () => {
            M().setContext({ [keys[0]]: "residue-C4" });
            const returned = await controller.fileHandler.handleUpload(
              new File(["x"], "x.txt", { type: "text/plain" }),
            );
            assert(returned === false, "invalid file did not return false");
            assert(
              M().getContext()[keys[0]] === "residue-C4",
              "context was reset on failed validation",
            );
          },
        );
      }
    } finally {
      window.notifyWarning = savedNotify;
      M().setContext(snapshot); // end-state restore of the page's real context
    }

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

  window.runStage8Tests = runStage8Tests;
  logInfo("Stage 8 test runner registered: window.runStage8Tests()");
})();
