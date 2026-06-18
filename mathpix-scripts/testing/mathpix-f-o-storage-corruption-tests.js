/**
 * @fileoverview F-O — Silent localStorage corruption regression tests
 * @module mathpix-f-o-storage-corruption-tests
 *
 * @description
 * Regression guard for the F-O bug family: an un-awaited async getMMDForAPI
 * (made async in F-M Phase 4) assigned into a session object that is then
 * JSON.stringify'd to localStorage serialised to an empty object {} —
 * silently corrupting the stored `original`/`baseline` fields (no throw,
 * because a Promise is truthy and {} serialises cleanly).
 *
 * The load-bearing tests call the REAL writers (saveContentToStorage,
 * startPersistenceSession) on a synthetic restorer context, read the resulting
 * localStorage entry back, and assert that every stored MMD field is a string
 * and none is an empty object. These would have failed against the pre-fix code.
 *
 * Self-heal tests confirm the read-time guard (_coerceStoredMMDField) treats a
 * corrupt {} as absent so the existing `|| fallback` chains rescue it — healing
 * sessions already corrupted on disk from before the encoder fix.
 *
 * All tests operate on window.MathPixSessionRestorer.prototype with synthetic
 * contexts, so they need no active mode and no initialised controller.
 *
 * @usage
 *   window.runFOStorageTests()  →  Promise<{passed, failed, tests}>
 *
 * Test localStorage keys are namespaced "mathpix-resume-session-FO-TEST-*" and
 * removed in a finally block; no user data is written or deleted.
 */

(function () {
  "use strict";

  // ── Logging (module pattern, IIFE-scoped to avoid global collisions) ──────
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
      console.error(`[F-O Tests] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[F-O Tests] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[F-O Tests] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[F-O Tests] ${message}`, ...args);
  }

  // ── Test harness ──────────────────────────────────────────────────────────
  function createResults() {
    return { passed: 0, failed: 0, skipped: 0, tests: [] };
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
  function skip(results, name, reason) {
    results.skipped++;
    results.tests.push({ name, skipped: true, reason });
    console.log(`⏭️ SKIP ${name}${reason ? ` — ${reason}` : ""}`);
  }

  const isEmptyObject = (v) =>
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).length === 0;

  /**
   * Build a synthetic restorer context that the real prototype methods can run
   * against. Stubs only the collaborators the writers touch; uses the REAL
   * getMMDForStorage / _coerceStoredMMDField / sanitiseFilename / dedup so the
   * code under test is exercised genuinely.
   */
  function makeCtx(proto, restoredSession) {
    return {
      restoredSession,
      undoStack: [],
      redoStack: [],
      hasUnsavedChanges: false,
      imageBlobUrlMap: new Map(), // empty → getMMDForStorage passes content through
      imageRegistry: { getAllImages: () => [] },
      imageFilenameMap: {},
      // stubs for side-effecting collaborators
      updateSessionStatus: () => {},
      pushToUndoStack: () => {},
      // real methods under test / used by the writers and readers
      getMMDForStorage: proto.getMMDForStorage,
      getMMDForAPI: proto.getMMDForAPI,
      _translateBlobUrlsToCdnForMMD: proto._translateBlobUrlsToCdnForMMD,
      sanitiseFilename: proto.sanitiseFilename,
      _coerceStoredMMDField: proto._coerceStoredMMDField,
      deduplicateSessions: proto.deduplicateSessions,
    };
  }

  function assertStoredEntryHealthy(results, label, parsed) {
    record(
      results,
      `${label}: original is a string`,
      typeof parsed.original === "string",
    );
    record(
      results,
      `${label}: baseline is a string`,
      typeof parsed.baseline === "string",
    );
    record(
      results,
      `${label}: current is a string`,
      typeof parsed.current === "string",
    );
    record(
      results,
      `${label}: no field serialised to {} (the F-O corruption)`,
      !isEmptyObject(parsed.original) &&
        !isEmptyObject(parsed.baseline) &&
        !isEmptyObject(parsed.current),
    );
  }

  // ── The suite ───────────────────────────────────────────────────────────
  window.runFOStorageTests = async function () {
    console.log("🧪 F-O storage-corruption regression tests…\n");
    const results = createResults();
    const createdKeys = [];

    const proto =
      window.MathPixSessionRestorer && window.MathPixSessionRestorer.prototype;

    record(results, "MathPixSessionRestorer.prototype available", !!proto);
    if (!proto) {
      printSummary(results);
      return results;
    }

    try {
      // ── Group 1: encoders are the right shape (sync, string-returning) ────
      record(
        results,
        "getMMDForStorage exists and is synchronous (not AsyncFunction)",
        typeof proto.getMMDForStorage === "function" &&
          proto.getMMDForStorage.constructor.name !== "AsyncFunction",
      );
      record(
        results,
        "getMMDForAPI is async (the trap these sites must avoid)",
        typeof proto.getMMDForAPI === "function" &&
          proto.getMMDForAPI.constructor.name === "AsyncFunction",
      );

      // ── Group 2: self-heal guard _coerceStoredMMDField ────────────────────
      record(
        results,
        "_coerceStoredMMDField exists",
        typeof proto._coerceStoredMMDField === "function",
      );
      const coerce = proto._coerceStoredMMDField;
      record(results, "coerce('x') === 'x'", coerce("x") === "x");
      record(results, "coerce('') === '' (empty string preserved)", coerce("") === "");
      record(results, "coerce({}) === null (corrupt treated as absent)", coerce({}) === null);
      record(results, "coerce(null) === null", coerce(null) === null);
      record(results, "coerce(undefined) === null", coerce(undefined) === null);
      record(
        results,
        "coerce(Promise) === null (un-awaited getMMDForAPI shape)",
        coerce(Promise.resolve("x")) === null,
      );

      // ── Group 3: truthiness trap is fixed ─────────────────────────────────
      record(
        results,
        "TRAP fixed: (coerce({}) || fallback) === fallback",
        (coerce({}) || "FALLBACK") === "FALLBACK",
      );
      record(
        results,
        "control: bare ({} || fallback) still returns {} (proves the trap is real)",
        ({}) /* truthy */ || "FALLBACK",
      );

      // ── Group 4: computeDiff throws on {} but the guard prevents it (Q5) ──
      // Use the real restorer instance as host — computeDiff delegates to
      // this.findFirstWordChange / this.getUniqueLines for the string path.
      const diffHost = window.getMathPixSessionRestorer?.();
      if (diffHost && typeof diffHost.computeDiff === "function") {
        let threw = false;
        try {
          diffHost.computeDiff("current string", {});
        } catch (e) {
          threw = true;
        }
        record(
          results,
          "Q5: computeDiff(current, {}) throws (so corruption is not silent at diff time)",
          threw === true,
        );
        let guarded = true;
        try {
          // What the consumer sites now do: coerce → fallback before computeDiff
          const safe = coerce({}) || "ORIGINAL CONTENT\nsecond line";
          diffHost.computeDiff("current string\nsecond line", safe);
        } catch (e) {
          guarded = false;
          logWarn("guarded computeDiff threw unexpectedly:", e);
        }
        record(
          results,
          "Q5: guarded computeDiff(current, coerce({})||original) does NOT throw",
          guarded === true,
        );
      } else {
        skip(
          results,
          "Q5: computeDiff throw/guard behaviour",
          "getMathPixSessionRestorer instance unavailable (UI not initialised)",
        );
      }

      // ── Group 5: LOAD-BEARING — real saveContentToStorage (site 3) ────────
      {
        const key = "mathpix-resume-session-FO-TEST-save-1";
        createdKeys.push(key);
        const ctx = makeCtx(proto, {
          storageKey: key,
          sessionKey: "FO-TEST-save-1",
          currentMMD: "PREVIOUS CURRENT",
          baselineMMD: "BASELINE CONTENT",
          originalMMD: "ORIGINAL CONTENT",
          source: { filename: "fo-save-test.zip" },
          aiEnhanced: null,
        });
        proto.saveContentToStorage.call(ctx, "# Edited\n\nNew body text");
        const raw = localStorage.getItem(key);
        record(results, "site 3: saveContentToStorage wrote an entry", !!raw);
        if (raw) {
          const parsed = JSON.parse(raw);
          assertStoredEntryHealthy(results, "site 3", parsed);
          record(
            results,
            "site 3: current reflects the edited content",
            parsed.current === "# Edited\n\nNew body text",
          );
          record(
            results,
            "site 3: baseline reflects baselineMMD (not corrupted)",
            parsed.baseline === "BASELINE CONTENT",
          );
        }
      }

      // ── Group 6: LOAD-BEARING — real startPersistenceSession (site 4) ─────
      {
        const ctx = makeCtx(proto, {
          baselineMMD: "BASELINE 4",
          originalMMD: "ORIGINAL 4",
          currentMMD: "CURRENT 4",
          aiEnhanced: null,
        });
        proto.startPersistenceSession.call(ctx, "fo-persist-test.zip");
        const key = ctx.restoredSession.storageKey;
        if (key) createdKeys.push(key);
        record(
          results,
          "site 4: startPersistenceSession set a storageKey",
          typeof key === "string" && key.startsWith("mathpix-resume-session"),
        );
        const raw = key ? localStorage.getItem(key) : null;
        record(results, "site 4: wrote an entry", !!raw);
        if (raw) {
          const parsed = JSON.parse(raw);
          assertStoredEntryHealthy(results, "site 4", parsed);
          record(
            results,
            "site 4: baseline reflects baselineMMD (not corrupted)",
            parsed.baseline === "BASELINE 4",
          );
        }
      }

      // ── Group 7: save → restore round-trip; baseline survives ─────────────
      {
        const key = "mathpix-resume-session-FO-TEST-roundtrip";
        createdKeys.push(key);
        const writeCtx = makeCtx(proto, {
          storageKey: key,
          sessionKey: "FO-TEST-roundtrip",
          currentMMD: "PREV",
          baselineMMD: "ROUND TRIP BASELINE",
          originalMMD: "ROUND TRIP ORIGINAL",
          source: { filename: "fo-roundtrip-test.zip" },
          aiEnhanced: null,
        });
        proto.saveContentToStorage.call(writeCtx, "ROUND TRIP CURRENT (edited)");

        const readCtx = makeCtx(proto, { originalMMD: "" });
        const found = proto.checkForMatchingSessions.call(
          readCtx,
          "fo-roundtrip-test.zip",
        );
        const match = (found || []).find((s) => s.key === key);
        record(
          results,
          "round-trip: saved session is found by checkForMatchingSessions",
          !!match,
        );
        if (match) {
          record(
            results,
            "round-trip: data.baseline survives as a string",
            typeof match.data.baseline === "string",
          );
          record(
            results,
            "round-trip: data.baseline value preserved",
            match.data.baseline === "ROUND TRIP BASELINE",
          );
          record(
            results,
            "round-trip: data.current value preserved",
            match.data.current === "ROUND TRIP CURRENT (edited)",
          );
        }
      }

      // ── Group 8: negative control — the OLD bug shape is caught by our checker
      {
        // Reproduce pre-fix behaviour: assign an un-awaited Promise, stringify.
        const oldShape = {
          original: proto.getMMDForAPI.call(makeCtx(proto, {}), "x"), // Promise
          baseline: proto.getMMDForAPI.call(makeCtx(proto, {}), "x"), // Promise
          current: "valid string",
        };
        const parsedOld = JSON.parse(JSON.stringify(oldShape));
        record(
          results,
          "negative control: old shape serialises original/baseline to {}",
          isEmptyObject(parsedOld.original) && isEmptyObject(parsedOld.baseline),
        );
        record(
          results,
          "negative control: our healthy-checker FLAGS the old shape (test has teeth)",
          isEmptyObject(parsedOld.original) || isEmptyObject(parsedOld.baseline),
        );
      }

      // ── Group 9: site 5 — _translateBlobUrlsToCdnForMMD output passes the
      // startSession guard, and never emits [user-image:...] placeholders the
      // editor-persistence module cannot resolve.
      {
        // startSession guard (persistence.js:292): rejects non-strings.
        const guardRejects = (c) => !c || typeof c !== "string";

        // OCR blob → CDN reverse; user-added blob is left renderable (not a placeholder).
        const cdnUrl = "https://cdn.mathpix.com/snip/images/ocr1.png";
        const blobUrl = "blob:http://localhost/ocr-1";
        const userBlob = "blob:http://localhost/user-1";
        const ctx = makeCtx(proto, {});
        ctx.imageBlobUrlMap = new Map([[cdnUrl, blobUrl]]);
        ctx.imageRegistry = {
          getAllImages: () => [
            { originalUrl: cdnUrl },
            { originalUrl: userBlob, id: "img-usr-z", source: "user-upload" },
          ],
        };
        const mmd = `a ![](${blobUrl}) b ![](${userBlob}) c`;
        const out = proto._translateBlobUrlsToCdnForMMD.call(ctx, mmd);

        record(
          results,
          "site 5: _translateBlobUrlsToCdnForMMD returns a string startSession accepts",
          typeof out === "string" && guardRejects(out) === false,
        );
        record(
          results,
          "site 5: OCR blob reversed to CDN URL",
          out.includes(cdnUrl) && !out.includes(blobUrl),
        );
        record(
          results,
          "site 5: output contains NO [user-image:...] placeholder (editor persistence has no resolver)",
          !/\[user-image:/.test(out),
        );
        const promise = proto.getMMDForAPI.call(ctx, "editor content");
        record(
          results,
          "site 5: an un-awaited getMMDForAPI Promise would be rejected by the guard",
          guardRejects(promise) === true,
        );
      }
    } catch (error) {
      logError("Unexpected error during F-O tests:", error);
      record(results, `Unexpected error: ${error.message}`, false);
    } finally {
      // Clean up only our namespaced test keys.
      for (const k of createdKeys) {
        try {
          localStorage.removeItem(k);
        } catch (e) {
          logWarn("Could not remove test key:", k);
        }
      }
    }

    printSummary(results);
    return results;
  };

  function printSummary(results) {
    const total = results.passed + results.failed;
    const status = results.failed === 0 ? "✅ PASSED" : "❌ FAILED";
    const skippedNote = results.skipped ? ` (${results.skipped} skipped)` : "";
    console.log(
      `\n📊 F-O storage-corruption tests: ${results.passed}/${total} passed${skippedNote} ${status}`,
    );
  }

  logInfo("F-O storage-corruption test suite loaded (window.runFOStorageTests)");
})();
