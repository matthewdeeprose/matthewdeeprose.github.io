/**
 * @fileoverview MathPix alt-text batch runner — the sequential loop, the cancel
 *   flag, the tally and the outcome-line composition for a Describe All run.
 * @module MathPixAltTextBatchRunner
 * @version 1.0.0 (parcel BG-P1)
 * @since Phase 4 item 3, batch generation in the image manager
 *
 * @description
 * The runner owns the LOOP and nothing else. It drives a supplied target list
 * through a configured orchestrator instance one image at a time, keeps the
 * tally, and composes the single outcome line. It does not own the dialog, and
 * it makes NO DOM CALLS anywhere in this file — plan decision A4.
 *
 * WHY NO DOM. It matches how the per-field path is already built: the
 * orchestrator owns the run and the manager owns the view. It is also what
 * makes the suite possible — a runner with no DOM dependency is driven by floor
 * rows against a stubbed orchestrator, with no page, no registry and no
 * session. Visual progress reaches the dialog through the caller's own
 * `onProgress` callback, which this module invokes and never inspects.
 *
 * SEQUENTIAL, ONE IN FLIGHT, NO MID-FLIGHT ABORT (A5). One in-flight run is the
 * state the whole surrounding design already assumes — `_editAltGenerating` is
 * a single boolean and `_activeRunImageId` a single id, so concurrency would
 * need both redesigned before any batch behaviour could be trusted. There is no
 * mid-flight abort for the same reason the per-field path has none: the
 * orchestrator's write is the LAST step of a run, so interrupting between
 * adapter and write is the one moment that can spend a call and record nothing.
 *
 * CANCEL STOPS AFTER THE IN-FLIGHT IMAGE (A7). `cancel()` sets a flag the loop
 * reads at the TOP of the next iteration. The image already running finishes
 * and is written. Every target the loop never reached lands in `remaining`.
 *
 * THE TAXONOMY IS FIXED AND ITS ZERO CLAUSES ARE NEVER OMITTED (A8). The
 * outcome line carries generated, then failed, then remaining, in that order,
 * always — a line that drops its zero clauses says something different each
 * run, so a listener has to work out which reading they got before they can act
 * on it. Note this DELIBERATELY DIFFERS from the per-field sentence in
 * `alt-text-orchestrator.js`, where an omitted clause is meaningful because it
 * reports on a fixed set of four named fields; here the counts are the whole
 * message and an absent one is indistinguishable from a zero one.
 *
 * COUNTS ARE SPOKEN AS WORDS ZERO TO NINE, DIGITS FROM 10 (A9), and the
 * substitution is applied to the COMPOSED LINE ONLY. The tally the runner
 * returns stays numeric, so the suite asserts on numbers rather than on prose.
 *
 * UNCOVERED-ONLY TARGETING (A6). `selectTargets` treats an image as a target
 * when it has no alt text and is not decorative. Nothing else is targeted in
 * the first build, which is the case where no existing content can be
 * destroyed, so it needs no overwrite-permission model at all. Per-image
 * selection and an existing-description policy are named later enhancements.
 *
 * @see mathpix-scripts/docs/alt-text/batch-generation-plan.md — decisions A4 to A9
 * @see mathpix-scripts/ai-alt-text/alt-text-orchestrator.js — the run contract
 *   this loop consumes, and the CORE_COUNT_WORDS precedent A9 follows
 */

const MathPixAltTextBatchRunner = (function () {
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
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[AltTextBatchRunner] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AltTextBatchRunner] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AltTextBatchRunner] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AltTextBatchRunner] ${message}`, ...args);
  }

  // ============================================================================
  // TAXONOMY CONSTANTS (A8, A9)
  // ============================================================================

  /**
   * Counts spoken as WORDS below ten, digits from 10 (A9).
   *
   * A9 states this as a decision rather than a citation, on the grounds that
   * nothing read at BG-P0 established an existing house rule. A precedent DOES
   * exist and it agrees: `CORE_COUNT_WORDS` in `alt-text-orchestrator.js`
   * (~:185) describes itself as "per house style for numbers under ten". That
   * list stops at four because the write stage reports on exactly four keys; a
   * batch has no such ceiling, so this list runs zero to nine and the digit form
   * takes over above it. Indexed BY the count, so index zero is "Zero" — unlike
   * the orchestrator's, which is indexed by count minus one because a per-field
   * clause is never emitted for a count of zero and this one always is.
   */
  const BATCH_COUNT_WORDS = Object.freeze([
    "Zero",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
  ]);

  /**
   * Clause templates, in the ONE order A8 fixes. Tokens are substituted in a
   * single pass with a function replacer — see fillTemplate for why chaining
   * sequential replaces is wrong.
   */
  const CLAUSE_GENERATED_SINGULAR = "One description generated.";
  const CLAUSE_GENERATED_PLURAL = "{count} descriptions generated.";
  const CLAUSE_FAILED = "{count} failed.";
  const CLAUSE_REMAINING = "{count} remaining.";

  /** Substitution token and the single pattern that matches it. */
  const COUNT_TOKEN = "{count}";
  const TOKEN_PATTERN = /\{count\}/g;

  /** Clause-to-clause joiner. */
  const CLAUSE_SEPARATOR = " ";

  /** Progress phases reported to the caller's own visual surface (A10). */
  const PHASE = Object.freeze({
    STARTING: "starting",
    SETTLED: "settled",
  });

  /** Per-image outcomes recorded in the results array. */
  const OUTCOME = Object.freeze({
    GENERATED: "generated",
    FAILED: "failed",
  });

  /** The orchestrator's own success status, mirrored so a run can be branched. */
  const ORCHESTRATOR_SUCCESS = "success";

  // ============================================================================
  // PURE HELPERS — no state, no DOM, no window reads
  // ============================================================================

  /**
   * Substitute the count token in ONE pass with a function replacer.
   *
   * Never chained sequential replaces: chaining is order-dependent, so a value
   * substituted by an earlier pass is rescanned by a later one. A function
   * replacer also stops String.replace treating `$&` or `$1` inside a
   * substituted value as a substitution pattern of its own. The value here is a
   * count and carries neither hazard today, but the pattern is what makes that a
   * property of the code rather than of the current values.
   *
   * @param {string} template
   * @param {Object<string,string>} valuesByToken
   * @returns {string}
   */
  function fillTemplate(template, valuesByToken) {
    return template.replace(TOKEN_PATTERN, (token) => {
      const value = valuesByToken[token];
      if (value === undefined) {
        logWarn(
          `fillTemplate(): no value supplied for token "${token}" — leaving it in place`,
        );
        return token;
      }
      return value;
    });
  }

  /**
   * The count as a word for zero to nine, as a digit from 10 (A9).
   *
   * Never throws. A non-finite or negative input falls back to the digit form
   * with a WARN, on the same principle the orchestrator's countWord states: this
   * string is spoken, and a line that reads slightly wrong is a far better
   * outcome than an exception inside the one announcement a person gets.
   *
   * @param {number} count
   * @returns {string}
   */
  function countWord(count) {
    if (typeof count !== "number" || !Number.isFinite(count) || count < 0) {
      logWarn(
        `countWord(): "${count}" is not a usable count — falling back to the digit form`,
      );
      return String(count);
    }

    const word = BATCH_COUNT_WORDS[count];
    return word === undefined ? String(count) : word;
  }

  /**
   * Compose the outcome line from a numeric tally (A8, A9).
   *
   * ALL THREE CLAUSES, ALWAYS, IN THIS ORDER, including when a count is zero.
   * The word substitution happens here and nowhere else, so the tally itself
   * stays numeric for a caller or a suite row to assert on.
   *
   * @param {Object} tally
   * @param {number} tally.generated
   * @param {number} tally.failed
   * @param {number} tally.remaining
   * @returns {string} the composed line
   */
  function composeOutcomeLine(tally) {
    const t = tally || {};
    const generated = t.generated;
    const failed = t.failed;
    const remaining = t.remaining;

    const generatedClause =
      generated === 1
        ? CLAUSE_GENERATED_SINGULAR
        : fillTemplate(CLAUSE_GENERATED_PLURAL, {
            [COUNT_TOKEN]: countWord(generated),
          });

    const failedClause = fillTemplate(CLAUSE_FAILED, {
      [COUNT_TOKEN]: countWord(failed),
    });

    const remainingClause = fillTemplate(CLAUSE_REMAINING, {
      [COUNT_TOKEN]: countWord(remaining),
    });

    return [generatedClause, failedClause, remainingClause].join(
      CLAUSE_SEPARATOR,
    );
  }

  /**
   * Uncovered-only target selection (A6) — an image is a target when it has no
   * alt text and is not decorative.
   *
   * Whitespace-only alt text counts as no alt text: it is not a description a
   * person could act on, and treating it as covered would leave the image
   * silently unreachable by the only path that fills it.
   *
   * @param {Array<Object>} entries - registry entries, as `getAllImages()` returns
   * @returns {Array<Object>} the subset that is a target, order preserved
   */
  function selectTargets(entries) {
    if (!Array.isArray(entries)) {
      logWarn("selectTargets(): entries is not an array — returning none");
      return [];
    }

    return entries.filter((entry) => {
      if (!entry || typeof entry !== "object") return false;
      if (entry.decorative) return false;

      const alt = entry.altText;
      return typeof alt !== "string" || alt.trim() === "";
    });
  }

  // ============================================================================
  // THE RUNNER
  // ============================================================================

  /**
   * Create a batch runner over a configured orchestrator instance (A4).
   *
   * @param {Object} options
   * @param {Object} options.orchestrator - a created orchestrator, i.e. an object
   *   carrying `run(runOptions)`. Supplied rather than resolved here, so the
   *   runner takes no load-order dependency and can be driven with no page.
   * @returns {Object} `{ run, cancel, isRunning, isCancelled }`
   */
  function create({ orchestrator } = {}) {
    if (!orchestrator || typeof orchestrator.run !== "function") {
      logWarn(
        "create(): orchestrator is missing or carries no run() — every image will be recorded as failed",
      );
    }

    let cancelled = false;
    let running = false;

    /**
     * Request cancellation. Read at the TOP of the next iteration, so the image
     * already in flight finishes and is written (A5, A7). Idempotent, and safe
     * to call when nothing is running.
     */
    function cancel() {
      if (!running) {
        logDebug("cancel(): nothing is running — flag set anyway, harmlessly");
      }
      cancelled = true;
      logInfo("cancellation requested — the in-flight image will finish");
    }

    /** @returns {boolean} true while a batch loop is in flight. */
    function isRunning() {
      return running;
    }

    /** @returns {boolean} true once cancel() has been called for this batch. */
    function isCancelled() {
      return cancelled;
    }

    /**
     * Drive the supplied target list, sequentially, one image in flight.
     *
     * @param {Object} runOptions
     * @param {Array<Object>} runOptions.targets - the images to describe. Each
     *   needs at least `{ id, image }`; a `model` is forwarded when present.
     *   SUPPLIED, never derived here — use `selectTargets` to build it (A6).
     * @param {Function} [runOptions.onProgress] - called with
     *   `{ phase, index, total, id, outcome }` before and after each image. It is
     *   the caller's visual surface and is VISUAL-ONLY (A10): nothing this
     *   callback does may speak. A throwing callback never stops the loop.
     * @returns {Promise<Object>} `{ generated, failed, remaining, cancelled,
     *   line, results }` — the three counts numeric, `line` the composed
     *   outcome line, `results` one entry per attempted image.
     */
    async function run({ targets, onProgress } = {}) {
      const list = Array.isArray(targets) ? targets : [];
      if (!Array.isArray(targets)) {
        logWarn("run(): targets is not an array — treating it as empty");
      }

      cancelled = false;
      running = true;

      let generated = 0;
      let failed = 0;
      const results = [];

      // Reported as a count rather than derived at the end, so a cancel and a
      // completed run are distinguished by the loop rather than by arithmetic
      // over two lengths that could both be right for the wrong reason.
      let remaining = 0;

      // A callback belongs to the caller, so a throw inside it is the caller's
      // defect and must never take the batch down with it.
      const report = (payload) => {
        if (typeof onProgress !== "function") return;
        try {
          onProgress(payload);
        } catch (progressErr) {
          logWarn("onProgress() threw — the loop continues", progressErr);
        }
      };

      try {
        for (let index = 0; index < list.length; index++) {
          // THE CANCEL READ, at the top of the iteration and nowhere else. Every
          // target from here on is untouched and is reported as remaining.
          if (cancelled) {
            remaining = list.length - index;
            logInfo(
              `cancelled after ${index} of ${list.length} — ${remaining} untouched`,
            );
            break;
          }

          const target = list[index] || {};
          report({
            phase: PHASE.STARTING,
            index,
            total: list.length,
            id: target.id,
          });

          let outcome = OUTCOME.FAILED;
          let error = null;

          try {
            const result = await orchestrator.run({
              image: target.image,
              id: target.id,
              model: target.model,
            });

            if (result && result.status === ORCHESTRATOR_SUCCESS) {
              outcome = OUTCOME.GENERATED;
            } else {
              error = (result && result.error) || null;
              logWarn(`image ${target.id} did not generate`, error);
            }
          } catch (runErr) {
            // CONTINUE ON ERROR. One image that throws is one failure, never the
            // end of the batch — the remaining targets have done nothing wrong.
            error = runErr;
            logError(`orchestrator threw for image ${target.id}`, runErr);
          }

          if (outcome === OUTCOME.GENERATED) {
            generated++;
          } else {
            failed++;
          }

          results.push({ id: target.id, outcome, error });
          report({
            phase: PHASE.SETTLED,
            index,
            total: list.length,
            id: target.id,
            outcome,
          });
        }
      } finally {
        running = false;
      }

      const tally = { generated, failed, remaining };
      const line = composeOutcomeLine(tally);

      logInfo(`batch settled: ${line}`);

      return {
        generated,
        failed,
        remaining,
        cancelled,
        line,
        results,
      };
    }

    return { run, cancel, isRunning, isCancelled };
  }

  logInfo("MathPixAltTextBatchRunner ready (loop, tally and taxonomy only)");

  return {
    create,
    // Exposed so the dialog can count and preview targets before confirming, and
    // so the whole taxonomy can be gated with no page and no orchestrator.
    selectTargets,
    composeOutcomeLine,
    countWord,
    // Exposed so a row can assert against the constants literally rather than
    // against a second copy of them.
    BATCH_COUNT_WORDS,
    CLAUSE_GENERATED_SINGULAR,
    CLAUSE_GENERATED_PLURAL,
    CLAUSE_FAILED,
    CLAUSE_REMAINING,
    CLAUSE_SEPARATOR,
    PHASE,
    OUTCOME,
  };
})();

// Attach at definition time only (guarded so the module also loads cleanly in
// node with no `window`, proving purity — the same arrangement as the parser
// and the prompt builder).
if (typeof window !== "undefined") {
  window.MathPixAltTextBatchRunner = MathPixAltTextBatchRunner;
}
