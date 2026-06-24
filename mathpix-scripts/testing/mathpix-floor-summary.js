/**
 * @fileoverview Floor summary aggregator — one table across every floor suite
 * @module mathpix-floor-summary
 * @version 1.0.0
 *
 * @description
 * Console aggregator that runs every floor test suite in sequence and prints a
 * single normalised summary table. The floor suites return three incompatible
 * result shapes — some give a `total` and no `skipped`, some give a `skipped`
 * and no `total`, and the harness-style runners give a `total` with no
 * `skipped`. This aggregator never reads `r.total`; it computes the total from
 * `passed + failed + skipped` so all three families agree on one column set.
 *
 * The floor list is an EXPLICIT array of global runner names, in run order. It
 * is never derived from global enumeration, so the `runStage0Tests` alias of
 * `testImageRegistry` is never double-counted. `runReopenContextTests` is kept
 * last on purpose: it resets and restores the context mirror as part of its
 * run, so it must settle after every other suite has read live state.
 *
 * Robustness: a missing runner is recorded as MISSING and skipped; a throwing
 * runner is recorded as ERROR (with its message) and skipped. One bad suite
 * never aborts the sweep.
 *
 * NOTE: runFloorSummary() is async (it awaits each suite, several of which are
 * themselves async). It returns a Promise resolving to the rows array; the
 * console.table + overall summary line print when it settles.
 *
 * Quiet by default. runFloorSummary() with no argument (or { verbose: false })
 * silences console.log/info/debug/warn/table for the duration of the sweep so
 * the per-suite chatter is suppressed and only the final table + summary print.
 * console.error is left untouched so a genuine exception still surfaces. Pass
 * { verbose: true } to silence nothing and see every suite's own output.
 *
 * @usage
 * Include after every floor suite in tools.html (alongside the other MathPix
 * testing harnesses).
 *   - window.runFloorSummary()                 — quiet sweep, table + summary only
 *   - window.runFloorSummary({ verbose: true }) — full per-suite output retained
 */

(function () {
  "use strict";

  // =========================================================================
  // LOGGING (IIFE-scoped, aggregator tracing only)
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
      console.error(`[FloorSummary] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[FloorSummary] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[FloorSummary] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[FloorSummary] ${message}`, ...args);
  }

  // =========================================================================
  // FLOOR LIST — explicit, in run order. Never enumerate globals: that would
  // sweep up the runStage0Tests alias of testImageRegistry and double-count it.
  // runReopenContextTests stays LAST because it resets and restores the context
  // mirror; it must settle after every other suite has read live state.
  // =========================================================================

  const FLOOR_RUNNERS = [
    "runStage1Tests",
    "runStage4Tests",
    "runStage5Tests",
    "testImageRegistry",
    "runStage6Tests",
    "runStage7Tests",
    "runStage8Tests",
    "runStage9Tests",
    "runConvertSizeTests",
    "runContextAITests",
    "runReopenContextTests",
  ];

  // =========================================================================
  // AGGREGATOR
  // =========================================================================

  /**
   * Run every floor suite in sequence and print one normalised summary table.
   *
   * @param {Object} [options]
   * @param {boolean} [options.verbose=false] When false (the default), silences
   *   console.log/info/debug/warn/table for the duration of the sweep so only
   *   the final table and summary print; console.error is left untouched. When
   *   true, silences nothing.
   * @returns {Promise<Array<Object>>} Resolves to the rows array, one row per
   *   floor suite: either { suite, passed, failed, skipped, total } for a suite
   *   that ran, or { suite, status: "MISSING" } / { suite, status: "ERROR",
   *   error } for one that could not.
   */
  async function runFloorSummary({ verbose = false } = {}) {
    logInfo("Starting floor summary sweep");

    const rows = [];

    // Quiet by default: replace the noisy console methods with no-ops for the
    // duration of the sweep, restoring them in the finally so a throw can never
    // leave the console broken. console.error is intentionally left untouched.
    const savedConsole = {
      log: console.log,
      info: console.info,
      debug: console.debug,
      warn: console.warn,
      table: console.table,
    };

    if (!verbose) {
      const noop = function () {};
      console.log = noop;
      console.info = noop;
      console.debug = noop;
      console.warn = noop;
      console.table = noop;
    }

    try {
      for (const name of FLOOR_RUNNERS) {
        if (typeof window[name] !== "function") {
          logWarn(`Suite "${name}" is not a function — recording MISSING`);
          rows.push({ suite: name, status: "MISSING" });
          continue;
        }

        try {
          const r = await window[name]();

          // Normalise identically across all three result shapes: never read
          // r.total — compute it from the parts so every family agrees.
          const passed = r?.passed ?? 0;
          const failed = r?.failed ?? 0;
          const skipped = r?.skipped ?? 0;
          const total = passed + failed + skipped;

          rows.push({ suite: name, passed, failed, skipped, total });
        } catch (err) {
          logError(`Suite "${name}" threw — recording ERROR`, err);
          rows.push({ suite: name, status: "ERROR", error: err?.message });
        }
      }
    } finally {
      // Always restore the console, even if the loop somehow throws.
      console.log = savedConsole.log;
      console.info = savedConsole.info;
      console.debug = savedConsole.debug;
      console.warn = savedConsole.warn;
      console.table = savedConsole.table;
    }

    // -----------------------------------------------------------------------
    // Report — printed after the console is restored, so it shows in both modes.
    // -----------------------------------------------------------------------
    console.table(rows);

    const troubled = rows.filter((row) => row.status || row.failed !== 0);
    if (troubled.length === 0) {
      console.log(
        `📊 Floor summary: all ${rows.length} suites failed: 0 — ALL CLEAR ✅`,
      );
    } else {
      const names = troubled.map((row) => row.suite).join(", ");
      console.log(
        `📊 Floor summary: ${troubled.length} of ${rows.length} suites need attention (failed > 0 or a status): ${names}`,
      );
    }

    return rows;
  }

  // =========================================================================
  // GLOBAL EXPOSURE
  // =========================================================================

  window.runFloorSummary = runFloorSummary;

  logInfo("Floor summary aggregator loaded");
  console.log(
    "💡 Type runFloorSummary() for a quiet one-table floor sweep (or runFloorSummary({ verbose: true }))",
  );
})();
