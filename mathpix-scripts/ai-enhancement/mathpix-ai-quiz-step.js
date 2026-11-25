/**
 * @fileoverview MathPix AI tab - the "Practice quiz" step's own logic
 * @module MathPixAIQuizStep
 * @version 1.0.0
 * @since QZ-15 (24 November 2026)
 *
 * The AI tab ("Do it all") runs this as its fourth step, last and not ticked by
 * default. Everything that is specific to the quiz lives here: whether it may
 * run, what it costs, how it is started and how it is stopped. mathpix-ai-tab.js
 * keeps only the hooks (one per step-keyed table). If this file is absent the
 * tab has three steps, exactly as before.
 *
 * It reads the Quiz tab's form as it stands (MathPixQuizTab.readOptions) and
 * calls the writer's own generate once. It never calls the Quiz tab's write(),
 * so the Quiz tab's own "started" and "written" toasts are not fired; the AI
 * tab's one spoken line per step end is the only voice for this event. It
 * creates no live region, announces nothing and raises no toast.
 *
 * ONE WRITER, TWO DOORS: the writer keeps one write in flight, so the Quiz tab's
 * write and this step must never both be writing. setLocked(true) (called by the
 * AI tab for the length of a run) makes the Quiz tab's write, edit and delete
 * unavailable; reason() makes this step unavailable while the Quiz tab writes.
 *
 * EVERY COLLABORATOR IS READ AT CALL TIME and never captured: this file loads
 * before the Quiz tab's.
 *
 * @requires window.MathPixQuizWriter, window.MathPixQuizStore, window.MathPixQuizTab
 * @accessibility No live region, no announcement, no toast.
 */
(function () {
  "use strict";

  // ==========================================================================
  // LOGGING
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
  function logError(...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[AIQuizStep]", ...args);
  }
  function logWarn(...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[AIQuizStep]", ...args);
  }
  function logInfo(...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[AIQuizStep]", ...args);
  }
  function logDebug(...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[AIQuizStep]", ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  const VERSION = "1.0.0";

  /** The step, in the shape of the AI tab's own STEPS entries. `purpose` is the registry's purpose key. */
  const STEP = Object.freeze({
    key: "quiz",
    label: "Practice quiz",
    short: "Practice quiz",
    purpose: "practice-quiz",
  });

  /** The reasons the step cannot run, and the sentences its outcomes use. */
  const WORDS = Object.freeze({
    HAS_QUIZ: "This session already has a practice quiz. Delete it on the Quiz tab to write a new one.",
    NO_TEXT: "There is no text to write a quiz from.",
    NOT_READY: "The quiz tools have not finished loading.",
    TAB_WRITING: "The Quiz tab is writing a quiz. Wait for it to finish.",
    REFUSED: "The quiz was not written. The reasons are on the Quiz tab.",
    STOPPED: "the quiz was not written.",
    STAND_IN: "no quiz was written.",
    /** What the Quiz tab says while the AI tab is running its steps. */
    TAB_LOCKED: "The AI tab is running its steps. Wait for it to finish, or cancel it on the AI tab.",
  });

  /** The Quiz tab says its own state changed with these events. */
  const EVENTS = Object.freeze({
    QUIZ_CHANGED: "mathpix:quiz-changed",
    QUIZ_WRITING: "mathpix:quiz-writing",
  });

  // ==========================================================================
  // STATE
  // ==========================================================================

  /** A test seam: the transport the next write sends through, or null for the writer's own. */
  let transportSeam = null;
  let promptsAsked = false;

  // ==========================================================================
  // COLLABORATORS (call time)
  // ==========================================================================

  const writer = () => window.MathPixQuizWriter || null;
  const store = () => window.MathPixQuizStore || null;
  const quizTab = () => window.MathPixQuizTab || null;

  /** Ask the AI tab to look again (a prompt file landing changes whether the step can run). */
  function askRefresh() {
    const tab = window.MathPixAITab;
    if (tab && typeof tab.refresh === "function") tab.refresh();
  }

  // ==========================================================================
  // THE REQUEST, THE COST, THE REASON
  // ==========================================================================

  /** The writer's own request for the Quiz tab's form as it stands, or null when a collaborator is missing. */
  function request() {
    const w = writer();
    const t = quizTab();
    if (!w || !t || typeof t.readOptions !== "function") return null;
    return w.buildRequest(t.readOptions());
  }

  /** { low, high } in US dollars from the writer's estimate, or null when no price is known. */
  function range() {
    const built = request();
    const est = built && built.ok ? built.estimate : null;
    return est && typeof est.lowUsd === "number" && typeof est.highUsd === "number"
      ? { low: est.lowUsd, high: est.highUsd }
      : null;
  }

  /**
   * Why the step cannot run, or null when it can. The AI tab asks for the
   * provider key before this, and asks for the PDF-based reasons of the other
   * steps not at all: the writer reads only the working text.
   */
  function reason() {
    const w = writer();
    const s = store();
    const t = quizTab();
    if (!w || !s || !t) return WORDS.NOT_READY;

    // The prompt file is fetched once; the first answer is "not loaded", so ask for a look when it lands.
    if (!promptsAsked && typeof w.loadPrompts === "function") {
      promptsAsked = true;
      Promise.resolve(w.loadPrompts()).then(askRefresh);
    }
    if (s.count() > 0) return WORDS.HAS_QUIZ;
    if (typeof t.isWriting === "function" && t.isWriting()) return WORDS.TAB_WRITING;

    const built = request();
    if (built && !built.ok) {
      const first = built.errors && built.errors[0] ? built.errors[0].message : WORDS.NOT_READY;
      return /no document content/i.test(first) ? WORDS.NO_TEXT : `${first}.`;
    }
    return null;
  }

  // ==========================================================================
  // THE TWO DOORS
  // ==========================================================================

  /** The AI tab is running its steps (true) or has finished (false): the Quiz tab's write, edit and delete follow. */
  function setLocked(on) {
    const t = quizTab();
    if (t && typeof t.setExternalLock === "function") t.setExternalLock(on ? WORDS.TAB_LOCKED : null);
  }

  // ==========================================================================
  // RUN AND STOP
  // ==========================================================================

  /**
   * Write the quiz once. Resolves { ok: true, count } when it was written and kept;
   * { ok: false, cancelled: true, line } when the person stopped it; otherwise
   * { ok: false, refused: true, line } with the writer's reasons put on the Quiz
   * tab's refusal list. Nothing is spoken, toasted or written to a region here.
   */
  async function run() {
    const w = writer();
    const t = quizTab();
    if (!w || !t) return { ok: false, line: null };

    if (typeof t.clearRefusal === "function") t.clearRefusal();
    const deps = typeof transportSeam === "function" ? { transport: transportSeam } : {};
    const result = await w.generate(t.readOptions(), deps);

    if (result && result.stopped) return { ok: false, cancelled: true, line: WORDS.STOPPED };
    if (result && result.ok) return { ok: true, count: result.quiz.questions.length };

    if (typeof t.showRefusal === "function") t.showRefusal(result && result.errors ? result.errors : []);
    return { ok: false, refused: true, line: WORDS.REFUSED };
  }

  /** Stop the write in flight. True when there was one to stop. */
  function cancel() {
    const w = writer();
    return Boolean(w && typeof w.cancel === "function" && w.cancel("User cancelled") === true);
  }

  /** Test seam: the transport the next write sends through, or null for the writer's own. */
  function setTransport(fn) {
    transportSeam = typeof fn === "function" ? fn : null;
  }

  window.MathPixAIQuizStep = Object.freeze({
    VERSION,
    STEP,
    WORDS,
    EVENTS,
    request,
    range,
    reason,
    setLocked,
    run,
    cancel,
    setTransport,
  });

  logInfo("Quiz step ready");
})();
