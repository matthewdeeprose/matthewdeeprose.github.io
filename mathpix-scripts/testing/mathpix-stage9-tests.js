/**
 * @fileoverview Stage 9 test runner — verifies the localStorage context mirror
 *   and the resume "Download Updated ZIP" context-edit affordance. Covers the
 *   manager's debounced write (updateField / setContext), the reset clear and
 *   the Q2/Q5 reset-cancels-pending-write race, the Q4 context-edited event
 *   (dispatched on updateField only, inert detail), and the restorer's
 *   download-button / status arms with their clear-on-save and clear-on-boundary
 *   boundaries plus the undo exclusion.
 * @module MathPixStage9Tests
 * @requires MathPixContextManager, MathPixSessionRestorer
 * @version 1.0.0
 *
 * Bare-page runnable: the manager and event rows drive window.MathPixContextManager
 * directly; the restorer rows construct a throwaway `new MathPixSessionRestorer({})`
 * against real container/status nodes and tear them down in a finally. The restorer
 * rows (9–13, 15) skip gracefully — counted — when no restorer constructor is
 * present, per the Stage 4/5 skip convention.
 *
 * NOT covered by suite rows (deliberately): the hydrate-on-load round-trip, the
 * stateWrittenSinceLoad latch, and the load-classification trichotomy. These run
 * only at page init through the PRIVATE hydrateFromStorage (no public API — the
 * manager export stays byte-identical), so a post-init console call cannot drive
 * them. Their permanent gate record is this parcel's reload-gate (fresh seeded
 * reloads) plus the P2/P3 console gates.
 *
 * Usage: `window.runStage9Tests()` from the console. Returns
 *   { passed, failed, skipped, results }.
 *
 * @see mathpix-scripts/docs/alt-text/stage-9-planning-decisions.md — Q2, Q3, Q4, Q5
 * @see mathpix-scripts/docs/alt-text/stage-9-implementation-plan-final.md — Parcel 6
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

  // ==========================================================================
  // CONSTANTS / HELPERS
  // ==========================================================================

  /** Mirror key — byte-identical to the manager's MIRROR_STORAGE_KEY. */
  const MIRROR_KEY = "mathpix-context-current";

  /** The throwaway storage key the restorer's save boundary writes (no session
   *  key → fallback). Recorded and restored by the suite. */
  const RESUME_FALLBACK_KEY = "mathpix-resume-session-fallback";

  /** The manager debounce is 1000 ms; 1200 ms clears it with margin. */
  const PAST_DEBOUNCE_MS = 1200;

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

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

  /**
   * Run `fn` with a temporary mathpix:context-edited listener attached to
   * document; the listener counts firings and captures the latest detail. The
   * listener is always removed in a finally so the inert row (14) sees none.
   * `fn` receives (count, detail) accessor thunks.
   */
  async function withContextEditedListener(fn) {
    let fired = 0;
    let lastDetail = "UNSET";
    const handler = (event) => {
      fired++;
      lastDetail = event.detail;
    };
    document.addEventListener("mathpix:context-edited", handler);
    try {
      return await fn(
        () => fired,
        () => lastDetail,
      );
    } finally {
      document.removeEventListener("mathpix:context-edited", handler);
    }
  }

  // ==========================================================================
  // RUNNER
  // ==========================================================================

  async function runStage9Tests() {
    const r = makeAccumulator();
    const M = window.MathPixContextManager;

    if (!M || typeof M.updateField !== "function") {
      logError(
        "Stage 9 prerequisite missing: MathPixContextManager not available — aborting.",
      );
      console.log("Results: 0 passed, 0 failed, 0 skipped");
      return { passed: 0, failed: 0, skipped: 0, results: [] };
    }

    // Gate hygiene: record everything we touch and restore it in the finally.
    const priorContextRaw = localStorage.getItem(MIRROR_KEY);
    const priorResumeFallback = localStorage.getItem(RESUME_FALLBACK_KEY);
    const snapshot = M.getContext();

    try {
      // ── Manager mirror (bare-page) ──────────────────────────────────────
      await r.check("1: write-on-edit — updateField persists after debounce", async () => {
        M.reset();
        M.updateField("subjectArea", "Algebra");
        await wait(PAST_DEBOUNCE_MS);
        const raw = localStorage.getItem(MIRROR_KEY);
        assert(raw !== null, "mirror key not written");
        assert(
          JSON.parse(raw).subjectArea === "Algebra",
          "subjectArea not Algebra in mirror",
        );
      });

      await r.check("2: write-on-setContext — setContext persists after debounce", async () => {
        M.reset();
        M.setContext({ specificTopic: "Vectors" });
        await wait(PAST_DEBOUNCE_MS);
        const raw = localStorage.getItem(MIRROR_KEY);
        assert(raw !== null, "mirror key not written");
        assert(
          JSON.parse(raw).specificTopic === "Vectors",
          "specificTopic not Vectors in mirror",
        );
      });

      await r.check("3: clear-on-reset — reset removes the mirror key immediately", async () => {
        M.setContext({ subjectArea: "X" });
        await wait(PAST_DEBOUNCE_MS); // ensure the key exists first
        assert(localStorage.getItem(MIRROR_KEY) !== null, "precondition: key absent");
        M.reset();
        assert(
          localStorage.getItem(MIRROR_KEY) === null,
          "mirror key survived reset",
        );
      });

      await r.check(
        "4: reset-cancels-pending-write (Q2/Q5) — no resurrection after reset",
        async () => {
          M.reset();
          M.updateField("subjectArea", "Y"); // schedules a debounced write
          M.reset(); // must cancel the pending write AND clear the key
          await wait(PAST_DEBOUNCE_MS);
          assert(
            localStorage.getItem(MIRROR_KEY) === null,
            "pending write resurrected the key after reset",
          );
        },
      );

      // ── Manager event (bare-page) ───────────────────────────────────────
      await r.check("5: updateField-dispatches-once", () =>
        withContextEditedListener((count) => {
          const before = count();
          M.updateField("subjectArea", "edit");
          assert(
            count() === before + 1,
            `expected exactly one event, got ${count() - before}`,
          );
        }),
      );

      await r.check("6: setContext-fires-no-event", () =>
        withContextEditedListener((count) => {
          const before = count();
          M.setContext({ specificTopic: "no-event" });
          assert(count() === before, "setContext dispatched a context-edited event");
        }),
      );

      await r.check("7: reset-fires-no-event", () =>
        withContextEditedListener((count) => {
          const before = count();
          M.reset();
          assert(count() === before, "reset dispatched a context-edited event");
        }),
      );

      await r.check("8: event-detail-null", () =>
        withContextEditedListener((count, detail) => {
          M.updateField("subjectArea", "detail-check");
          assert(
            detail() === null,
            `expected null detail, got ${JSON.stringify(detail())}`,
          );
        }),
      );

      // ── Restorer button / status / boundaries ───────────────────────────
      const RestorerCtor = window.MathPixSessionRestorer;
      if (typeof RestorerCtor !== "function") {
        r.skip("9: context-edit-shows-button-no-MMD-change (Q4 HARDEN)", "no restorer on bare page");
        r.skip("10: context-edit-status-modified", "no restorer on bare page");
        r.skip("11: clear-on-save", "no restorer on bare page");
        r.skip("12: clear-on-boundary", "no restorer on bare page");
        r.skip("13: undo-does-NOT-clear (exclusion)", "no restorer on bare page");
      } else {
        let host = null;
        let restorer = null;
        try {
          host = document.createElement("div");
          host.id = "stage9-test-host";
          const newSessionBtn = document.createElement("button");
          newSessionBtn.id = "stage9-test-new-session";
          newSessionBtn.type = "button";
          host.appendChild(newSessionBtn);
          const statusNode = document.createElement("span");
          statusNode.id = "stage9-test-status";
          host.appendChild(statusNode);
          document.body.appendChild(host);

          restorer = new RestorerCtor({}); // stub controller
          restorer.elements = {
            sessionStatus: statusNode,
            newSessionBtn,
            workingArea: host,
            uploadSection: document.createElement("div"),
          };
          // currentMMD === originalMMD isolates the context arm: the MMD arm
          // contributes nothing, so any button/status is context-driven only.
          restorer.restoredSession = {
            currentMMD: "SAME",
            originalMMD: "SAME",
            baselineMMD: "SAME",
          };

          await r.check(
            "9: context-edit-shows-button-no-MMD-change (Q4 HARDEN)",
            () => {
              assert(restorer.hasContextEdits === false, "hasContextEdits not false initially");
              assert(
                restorer.restoredSession.currentMMD ===
                  restorer.restoredSession.originalMMD,
                "precondition: MMD arm must be inert (current === original)",
              );
              restorer.hasContextEdits = true;
              restorer.updateDownloadButtonVisibility();
              const btn = document.getElementById("resume-download-updated-btn");
              assert(btn, "download button not present");
              assert(btn.hidden === false, "download button is hidden despite context edit");
            },
          );

          await r.check("10: context-edit-status-modified", () => {
            restorer.updateSessionStatus("modified");
            assert(
              statusNode.textContent === "Modified",
              `status reads "${statusNode.textContent}", expected "Modified"`,
            );
          });

          await r.check("11: clear-on-save", () => {
            restorer.hasContextEdits = true;
            restorer.saveContentToStorage("SAME");
            assert(restorer.hasContextEdits === false, "save did not clear hasContextEdits");
            restorer.updateDownloadButtonVisibility();
            const btn = document.getElementById("resume-download-updated-btn");
            assert(!btn || btn.hidden === true, "button still shown after save cleared edits");
          });

          await r.check("12: clear-on-boundary", () => {
            restorer.hasContextEdits = true;
            restorer.resetToUploadState();
            assert(
              restorer.hasContextEdits === false,
              "resetToUploadState did not clear hasContextEdits",
            );
          });

          await r.check("13: undo-does-NOT-clear (exclusion)", () => {
            restorer.hasContextEdits = true;
            restorer.undoEdit(); // empty stack → "Nothing to undo", no clear
            assert(
              restorer.hasContextEdits === true,
              "undoEdit cleared hasContextEdits (it must not)",
            );
          });
        } finally {
          // Neutralise any document listener bound to this throwaway instance:
          // after the resume-mode gate (Parcel 7), such a listener is inert only
          // while its instance's restoredSession is falsy. Clear it BEFORE DOM
          // teardown so no later row inherits an active-session listener.
          if (restorer) restorer.restoredSession = null;
          const strayBtn = document.getElementById("resume-download-updated-btn");
          if (strayBtn) strayBtn.remove();
          if (host && host.parentNode) host.parentNode.removeChild(host);
        }
      }

      // ── Resume-mode gate + Task-1 (live page) ───────────────────────────
      // Row 14 proves the Parcel 7 fix: the live singleton restorer's
      // document-level mathpix:context-edited listener stands down when no
      // session is active (restoredSession null), so an upload-mode context edit
      // does NOT surface the resume download button. This asserts against the
      // FULLY-INITIALISED page (the steady state that exposed the original bug),
      // not a pre-init page. Skips only if a real resume session is somehow live.
      const liveRestorer =
        typeof window.getMathPixSessionRestorer === "function"
          ? window.getMathPixSessionRestorer()
          : null;
      const ROW14 =
        "14: upload-mode-no-button — context-edited inert without an active session";
      if (liveRestorer && liveRestorer.restoredSession) {
        r.skip(ROW14, "a real resume session is active on this page");
      } else {
        await r.check(ROW14, () => {
          const statusEl =
            liveRestorer && liveRestorer.elements
              ? liveRestorer.elements.sessionStatus ||
                liveRestorer.elements.mmdSessionStatus
              : null;
          const statusBefore = statusEl ? statusEl.textContent : null;
          const btnBefore = !!document.getElementById("resume-download-updated-btn");
          let threw = false;
          try {
            document.dispatchEvent(new CustomEvent("mathpix:context-edited"));
          } catch {
            threw = true;
          }
          assert(!threw, "context-edited dispatch threw");
          const btnAfter = !!document.getElementById("resume-download-updated-btn");
          assert(btnAfter === btnBefore, "the dispatch created/removed a download button");
          assert(!btnAfter, "a download button surfaced without an active session");
          if (liveRestorer) {
            assert(
              liveRestorer.hasContextEdits === false,
              "live restorer hasContextEdits flipped true without an active session",
            );
          }
          if (statusEl) {
            assert(
              statusEl.textContent === statusBefore,
              "live restorer status was set to modified by the inert dispatch",
            );
          }
        });
      }

      if (typeof window.MathPixSessionRestorer !== "function") {
        r.skip("15: alt-text-path-intact (Task 1)", "no restorer on bare page");
      } else {
        await r.check("15: alt-text-path-intact (Task 1)", () => {
          const proto = window.MathPixSessionRestorer.prototype;
          for (const name of [
            "handleMmdInput",
            "scheduleAutoSave",
            "saveContentToStorage",
          ]) {
            assert(
              typeof proto[name] === "function",
              `Stage 5 persistence method "${name}" missing — alt-text path not intact`,
            );
          }
        });
      }
    } finally {
      // Restore the throwaway resume key first.
      if (priorResumeFallback === null) {
        localStorage.removeItem(RESUME_FALLBACK_KEY);
      } else {
        localStorage.setItem(RESUME_FALLBACK_KEY, priorResumeFallback);
      }
      // Restore the manager's in-memory context, then let its scheduled mirror
      // write fire so no stray timer survives, then pin the mirror key back to
      // its exact prior raw value.
      M.setContext(snapshot);
      await wait(PAST_DEBOUNCE_MS);
      if (priorContextRaw === null) {
        localStorage.removeItem(MIRROR_KEY);
      } else {
        localStorage.setItem(MIRROR_KEY, priorContextRaw);
      }
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

  window.runStage9Tests = runStage9Tests;
  logInfo("Stage 9 test runner registered: window.runStage9Tests()");
})();
