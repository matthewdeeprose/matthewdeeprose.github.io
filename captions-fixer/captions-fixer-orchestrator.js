/**
 * CAPTIONS FIXER — THE ORCHESTRATOR (Stage 6).
 *
 * Runs the stages in order, guards everything they propose, writes after every
 * one of them, tallies, and stops cleanly on a cap, a cancel or a person who
 * has not approved yet.
 *
 *   run({ cueList, meta, sha256, context, stages, signal })
 *     => { changeSet, tally, halted, stages }
 *
 * A stage is `{ name, fn, estimate? }`:
 *   fn(cueList, stageContext) => Array | { changeSet, halted? }
 *   estimate(cueList, stageContext) => { costUsd } | number   (optional)
 *
 * WHAT WAS TAKEN FROM alt-text-batch-runner.js
 * --------------------------------------------
 * Its `run` loop (~:334 in mathpix-scripts/ai-alt-text/) is the shape here, and
 * four things were taken deliberately:
 *
 *   1. THE CANCEL READ AT THE TOP OF THE ITERATION AND NOWHERE ELSE. The stage
 *      already in flight finishes and is written; every stage from there on is
 *      untouched. Its comment says "and nowhere else" and that is the part
 *      worth copying — a cancel read in two places is a race with itself.
 *   2. CONTINUE ON ERROR. One stage that throws is one failed stage, never the
 *      end of the run: the remaining stages have done nothing wrong, and the
 *      throwing stage may already have persisted something paid for.
 *   3. A COUNT RATHER THAN ARITHMETIC. It reports `remaining` from the loop
 *      instead of deriving it from two lengths at the end, so a cancel and a
 *      completed run are distinguished by the loop. `tally.remaining` here is
 *      the same idea for the same reason.
 *   4. A PER-ITEM RESULT ARRAY beside the counts, so a caller can see WHICH
 *      one failed rather than only how many did.
 *
 * NOT taken: its `create({ orchestrator })` factory and its cancel FLAG. This
 * one is a plain function taking an `AbortSignal`, because the adapter already
 * speaks `AbortSignal` and a second cancellation vocabulary in the same tool is
 * a second thing to keep true. Its outcome line is not taken either: composing
 * a spoken line is Stage 8's job, and this module says nothing at all.
 *
 * A CAP IS A STOP, NEVER A THROW
 * ------------------------------
 * `context.spendCapUsd` (default DEFAULT_SPEND_CAP_USD) is checked BEFORE each
 * stage, from that stage's own `estimate`. A stage that would cross it does not
 * run; `halted` names it, the promise RESOLVES, and everything already
 * persisted is returned. A throw here would travel past the code that writes
 * down what the money was spent on, which is the whole reason the rule exists.
 * A stage with no `estimate` costs nothing and is never capped.
 *
 * THE ORDER IS CAP, STAGE, GUARDS, PERSIST — AND IT IS PATCHABLE
 * -------------------------------------------------------------
 * The tail of each iteration is `settleStage`, exported and reached through the
 * exported object, so an inversion can swap the guards and the persist without
 * replacing the loop and taking its cancel read, its cap check and its error
 * handling with it. An inversion has to break the ONE behaviour its rows are
 * named after.
 *
 * IT NEVER APPLIES ANYTHING. `applyChangeSet` in captions-fixer-cues.js is the
 * only writer of cue text; this module produces the change set and counts the
 * entries whose `original` has already drifted from the cue they name.
 *
 * Pure logic. No DOM, no voice, no announcement, no live region.
 *
 * A PLAIN script publishing window.CaptionsFixerOrchestrator. Every sibling
 * module is resolved at CALL time, never at load.
 *
 * @module CaptionsFixerOrchestrator
 * @since 7 September 2026
 */
const CaptionsFixerOrchestrator = (function () {
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
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[CaptionsFixerOrchestrator]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[CaptionsFixerOrchestrator]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[CaptionsFixerOrchestrator]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[CaptionsFixerOrchestrator]", message, ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  /**
   * The default ceiling on one run, in US dollars, matching the currency the
   * model registry reports costs in. Stage 8 shows the figure to a person
   * before the first send and may lower it; nothing raises it silently.
   */
  const DEFAULT_SPEND_CAP_USD = 0.5;

  /** The halt reasons `run` can hand back. `halted` is null on a clean run. */
  const ERRORS = Object.freeze({
    CANCELLED: "cancelled",
    AWAITING_APPROVAL: "awaiting-approval",
    /** Prefixed to the stage's name, so a halt says WHICH stage was refused. */
    SPEND_CAP_PREFIX: "spend-cap:",
  });

  /** The outcome recorded against each stage the loop reached. */
  const OUTCOME = Object.freeze({
    RAN: "ran",
    FAILED: "failed",
    REFUSED: "refused",
    SKIPPED: "skipped",
  });

  /**
   * The change-set statuses this module counts. Mirrored from the cue module.
   * CHECK is the plausibility pass's "check this caption" entry: it carries no
   * replacement text, so it is tallied apart and is never a proposal.
   */
  const STATUS = Object.freeze({
    PROPOSED: "proposed",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
    CHECK: "check",
  });

  /** What a guard writes into `rejectedBy`, and what a person writes. */
  const GUARD_PREFIX = "guard:";
  const REJECTED_BY_PERSON = "person";

  /** The record field the accumulated change set is written under. */
  const FIELD_CHANGE_SET = "changeSet";

  /** A cost of zero: a pure stage, and one a cap can never refuse. */
  const NO_COST = 0;

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * The persist a stage is handed. A caller's own is preferred — the suite
   * supplies a spy, and Stage 8 will supply one that also repaints — and only
   * where there is none is one built over the store.
   *
   * A built one REFUSES rather than inventing a silent no-op when there is no
   * key to write under: a stage told its writes are landing when they are not
   * is the exact failure the persist rule exists to prevent.
   *
   * @param {object} context
   * @param {string} sha256
   * @returns {Function} persist(patch) => Promise
   */
  function resolvePersist(context, sha256) {
    if (context && typeof context.persist === "function") return context.persist;

    const store = window.CaptionsFixerStore;
    if (!store || typeof store.persist !== "function" || typeof sha256 !== "string" || !sha256) {
      logWarn("run(): no persist() on the context and no store key; stage writes will reject");
      return function persistUnavailable() {
        return Promise.reject(new Error("No persist(): the run carries neither a persist() nor a sha256."));
      };
    }
    return function persistToStore(patch) {
      return store.persist(sha256, patch);
    };
  }

  /**
   * What a stage says it would cost, normalised to a number.
   * @param {object} stage
   * @param {Array<object>} cueList
   * @param {object} stageContext
   * @returns {number} US dollars, 0 where the stage does not say
   */
  function costOfStage(stage, cueList, stageContext) {
    if (!stage || typeof stage.estimate !== "function") return NO_COST;
    let reported;
    try {
      reported = stage.estimate(cueList, stageContext);
    } catch (error) {
      // An estimator that throws must not stop the run, and must not be read as
      // free either: an unknown cost is treated as zero and SAID SO, because a
      // silent zero here is a cap that quietly stops capping.
      logWarn(`estimate() threw for stage "${stage.name}"; treating the cost as unknown`, error);
      return NO_COST;
    }
    if (typeof reported === "number" && isFinite(reported)) return reported;
    if (reported && typeof reported.costUsd === "number" && isFinite(reported.costUsd)) return reported.costUsd;
    logDebug(`estimate() for stage "${stage.name}" reported no usable cost`);
    return NO_COST;
  }

  /**
   * How many of a stage's requests came back unreadable, as a COUNT. The
   * cue-level pass reports a number; a list is counted rather than carried, so
   * nothing downstream ever holds per-chunk detail it would be tempted to keep.
   * Anything else — absent, negative, not a number — is 0.
   * @param {*} returned
   * @returns {number}
   */
  function failedChunksOf(returned) {
    const reported = returned && returned.failedChunks;
    if (Array.isArray(reported)) return reported.length;
    if (typeof reported === "number" && isFinite(reported) && reported > 0) return Math.floor(reported);
    return 0;
  }

  /**
   * A stage's return value, normalised. An array is a change set with no halt;
   * an object may carry both, and the cue-level pass also says how many of its
   * requests could not be read.
   *
   * STAGE 16, ITERATION 7 — `failedChunks` IS CARRIED, not discarded. It is
   * SPOKEN at the end of a pass and never stored: nothing here persists it, and
   * the store refuses any field outside RECORD_FIELDS in any case.
   *
   * @param {*} returned
   * @returns {{ changeSet: Array<object>, halted: string|null, failedChunks: number }}
   */
  function normaliseStageResult(returned) {
    if (Array.isArray(returned)) return { changeSet: returned, halted: null, failedChunks: 0 };
    const failedChunks = failedChunksOf(returned);
    if (returned && Array.isArray(returned.changeSet)) {
      return { changeSet: returned.changeSet, halted: returned.halted || null, failedChunks: failedChunks };
    }
    return { changeSet: [], halted: (returned && returned.halted) || null, failedChunks: failedChunks };
  }

  /**
   * Run the guards over one stage's entries.
   *
   * `cueIdKnown` is built per run from the cue list and PREPENDED, because it
   * cannot exist without one and is therefore absent from DEFAULT_GUARDS. Both
   * the guard module and its default list are resolved at call time, so a
   * suite patching either reaches this.
   *
   * @param {Array<object>} entries
   * @param {Array<string|number>} cueIds
   * @returns {Array<object>}
   */
  function guardEntries(entries, cueIds) {
    const guards = window.CaptionsFixerGuards;
    if (!guards || typeof guards.runGuardsOnSet !== "function") {
      logError("guardEntries(): CaptionsFixerGuards is not on the page; entries pass UNGUARDED");
      return entries;
    }
    const list = [guards.makeCueIdKnown(cueIds)].concat(guards.DEFAULT_GUARDS);
    return guards.runGuardsOnSet(entries, list);
  }

  /**
   * The tail of one iteration: guard, then accumulate, then write.
   *
   * Exported and reached through the exported object so an inversion can swap
   * those two without replacing the loop. The order is the point: an entry is
   * never written to disk before a guard has had it.
   *
   * @param {object} options
   * @returns {Promise<Array<object>>} the accumulated change set
   */
  async function settleStage({ entries, cueIds, accumulated, persist }) {
    const guarded = api.guardEntries(entries, cueIds);
    const changeSet = accumulated.concat(guarded);
    await persist({ [FIELD_CHANGE_SET]: changeSet });
    return changeSet;
  }

  /**
   * Count the change set into the shape a caller reports from.
   *
   * `conflicts` is counted here rather than by applying anything: an accepted
   * entry whose `original` no longer matches the cue it names is one
   * `applyChangeSet` would refuse, and a caller wants to know that before it
   * offers a person a download.
   *
   * @param {Array<object>} changeSet
   * @param {Map} textById
   * @returns {object}
   */
  function countChangeSet(changeSet, textById) {
    const tally = {
      proposed: 0,
      accepted: 0,
      rejectedByGuard: 0,
      rejectedByPerson: 0,
      conflicts: 0,
      check: 0,
    };
    changeSet.forEach((entry) => {
      if (!entry) return;
      if (entry.status === STATUS.PROPOSED) tally.proposed += 1;
      // A check entry is counted here and nowhere else: not a proposal, and
      // the guards leave it alone, so it is never a rejection either.
      if (entry.status === STATUS.CHECK) tally.check += 1;
      if (entry.status === STATUS.ACCEPTED) {
        tally.accepted += 1;
        if (textById.has(entry.cueId) && textById.get(entry.cueId) !== entry.original) {
          tally.conflicts += 1;
        }
      }
      if (entry.status === STATUS.REJECTED) {
        const by = typeof entry.rejectedBy === "string" ? entry.rejectedBy : "";
        if (by.indexOf(GUARD_PREFIX) === 0) tally.rejectedByGuard += 1;
        else if (by === REJECTED_BY_PERSON) tally.rejectedByPerson += 1;
      }
    });
    return tally;
  }

  // ==========================================================================
  // RUN
  // ==========================================================================

  /**
   * Run the stages.
   *
   * @param {object} options
   * @param {Array<object>} options.cueList
   * @param {object} [options.meta] the file meta, passed to stages untouched
   * @param {string} [options.sha256] the store key, when the context has no persist
   * @param {object} [options.context] `{ persist, onPairs, spendCapUsd, model, glossary }`
   * @param {Array<object>} options.stages `[{ name, fn, estimate? }]`
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<{ changeSet: Array<object>, tally: object, halted: string|null, stages: Array<object>, failedChunks: number }>}
   */
  async function run({ cueList, meta, sha256, context, stages, signal } = {}) {
    if (!Array.isArray(cueList)) {
      throw new TypeError("run() needs a cue list array.");
    }
    const list = Array.isArray(stages) ? stages : [];
    if (!Array.isArray(stages)) {
      logWarn("run(): stages is not an array — treating it as empty");
    }

    const callerContext = context || {};
    const persist = resolvePersist(callerContext, sha256);
    const cap =
      typeof callerContext.spendCapUsd === "number" && isFinite(callerContext.spendCapUsd)
        ? callerContext.spendCapUsd
        : DEFAULT_SPEND_CAP_USD;

    const cueIds = cueList.map((cue) => cue && cue.id);
    const textById = new Map(cueList.map((cue) => [cue && cue.id, cue && cue.text]));

    // Handed to every stage. The caller's own keys travel untouched, so
    // `onPairs`, `model` and `glossary` reach the stage that wants them; the
    // three below are the orchestrator's and overwrite anything of that name.
    const stageContext = Object.assign({}, callerContext, {
      persist: persist,
      signal: signal,
      meta: meta,
    });

    let changeSet = [];
    let halted = null;
    let spentUsd = 0;
    let stagesRun = 0;
    let stagesFailed = 0;
    let remaining = 0;
    let failedChunks = 0;
    const records = [];

    for (let index = 0; index < list.length; index += 1) {
      const stage = list[index] || {};
      const name = stage.name || `stage ${index}`;

      // THE CANCEL READ, at the top of the iteration and nowhere else.
      if (signal && signal.aborted) {
        halted = ERRORS.CANCELLED;
        remaining = list.length - index;
        logInfo(`cancelled before "${name}" — ${remaining} stage(s) untouched`);
        break;
      }

      // THE CAP CHECK, before the stage and therefore before any send it makes.
      const cost = costOfStage(stage, cueList, stageContext);
      if (cost > NO_COST && spentUsd + cost > cap) {
        halted = ERRORS.SPEND_CAP_PREFIX + name;
        remaining = list.length - index;
        records.push({ name: name, outcome: OUTCOME.REFUSED, costUsd: cost, error: null });
        logWarn(
          `"${name}" would cost about ${cost} USD against a cap of ${cap} with ${spentUsd} spent; it was not run`,
        );
        break;
      }

      if (typeof stage.fn !== "function") {
        stagesFailed += 1;
        records.push({ name: name, outcome: OUTCOME.FAILED, costUsd: NO_COST, error: new Error("the stage carries no fn()") });
        logWarn(`"${name}" carries no fn() — recorded as failed, the run continues`);
        continue;
      }

      let entries = [];
      let stageHalt = null;
      try {
        // THROUGH `api`, so an inversion patching the exported function reaches
        // the loop — a lexical call here would be a dead seam.
        const settled = api.normaliseStageResult(await stage.fn(cueList, stageContext));
        entries = settled.changeSet;
        stageHalt = settled.halted;
        failedChunks += settled.failedChunks;
        spentUsd += cost;
        stagesRun += 1;
        records.push({ name: name, outcome: OUTCOME.RAN, costUsd: cost, error: null });
      } catch (error) {
        // CONTINUE ON ERROR. A stage that threw may already have persisted
        // something paid for, and the stages after it have done nothing wrong.
        spentUsd += cost;
        stagesFailed += 1;
        records.push({ name: name, outcome: OUTCOME.FAILED, costUsd: cost, error: error });
        logError(`"${name}" threw; the run continues`, error);
        continue;
      }

      changeSet = await api.settleStage({
        entries: entries,
        cueIds: cueIds,
        accumulated: changeSet,
        persist: persist,
      });

      if (stageHalt) {
        halted = stageHalt;
        remaining = list.length - index - 1;
        logInfo(`"${name}" halted the run: ${stageHalt}`);
        break;
      }
    }

    const tally = Object.assign(countChangeSet(changeSet, textById), {
      stagesRun: stagesRun,
      stagesFailed: stagesFailed,
      remaining: remaining,
      cost: spentUsd,
      capUsd: cap,
    });

    logInfo(
      `settled: ${changeSet.length} entr${changeSet.length === 1 ? "y" : "ies"}, ${stagesRun} stage(s) run, halted ${halted || "no"}`,
    );
    // `failedChunks` rides on the RETURN VALUE alone — not on `tally`, and never
    // through `persist` — because the UI speaks it once and nothing keeps it.
    return { changeSet: changeSet, tally: tally, halted: halted, stages: records, failedChunks: failedChunks };
  }

  logInfo("Captions Fixer orchestrator loaded");

  const api = {
    run: run,
    // exported so an inversion can reach the one behaviour its rows name
    settleStage: settleStage,
    guardEntries: guardEntries,
    // pure helpers, exported for proof-reading and for the suite
    costOfStage: costOfStage,
    normaliseStageResult: normaliseStageResult,
    countChangeSet: countChangeSet,
    resolvePersist: resolvePersist,
    // constants
    DEFAULT_SPEND_CAP_USD: DEFAULT_SPEND_CAP_USD,
    ERRORS: ERRORS,
    OUTCOME: OUTCOME,
    STATUS: STATUS,
    GUARD_PREFIX: GUARD_PREFIX,
    REJECTED_BY_PERSON: REJECTED_BY_PERSON,
    FIELD_CHANGE_SET: FIELD_CHANGE_SET,
  };
  return api;
})();

// The const above is a top-level BINDING, not a window property, so the alias
// below is what makes window.CaptionsFixerOrchestrator resolve at all — the
// same arrangement, for the same reason, as captions-fixer-store.js:468.
window.CaptionsFixerOrchestrator = CaptionsFixerOrchestrator;
