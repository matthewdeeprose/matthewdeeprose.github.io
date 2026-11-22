/**
 * @fileoverview MathPix Quiz Store - the open session's practice quiz, and its Convert option
 * @module MathPixQuizStore
 * @version 1.0.0
 * @since QZ-3 (22 November 2026)
 *
 * Holds at most one practice quiz, in the format MathPixQuizFormat defines, for
 * the session that is open in Resume mode. It shows or hides the "Include the
 * practice quiz" tick box under the Convert formats, and tells the SCORM and
 * standalone HTML export whether to add the quiz. It calls no model and reads
 * no key. Nothing in QZ-3 writes a quiz except the console (`set`); the AI
 * writer and the check-and-edit window come later.
 *
 * THE QUIZ BELONGS TO THE OPEN SESSION. The binding is the identity of the
 * restorer's `restoredSession` object: it is built at exactly one site
 * (`session-restorer-restore.js`, `this.restoredSession = { ... }` inside
 * restoreSession) and set to null by cleanup (`session-restorer-file-registration.js`,
 * reached from New Session), by the session delete (`session-restorer-confidence.js`)
 * and at construction (`session-restorer-core.js`). A quiz set against one
 * session object is dropped the first time the store is read once that object
 * has been replaced or nulled, and the option hides. No file outside this lane
 * is edited to do it.
 *
 * Load order: after mathpix-quiz-format.js, before session-restorer-scorm-export.js.
 *
 * @requires window.MathPixQuizFormat - checkQuizRules (mathpix-quiz-format.js)
 *
 * @accessibility No live region and no announcement: the option appearing is
 * not an event the person caused (AGENTS.md § Announcements). The option is
 * a native checkbox with a <label> and an aria-describedby description, in the
 * HTML, `hidden` until a quiz is held.
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

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
      console.error(`[QuizStore] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[QuizStore] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[QuizStore] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[QuizStore] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  /** Fired on document whenever the held quiz appears, changes or goes. */
  const CHANGE_EVENT = "mathpix:quiz-changed";

  /** The option's elements in tools.html (outside name="resume-convert-format" on purpose). */
  const OPTION_IDS = Object.freeze({
    wrapper: "resume-quiz-option",
    checkbox: "resume-include-quiz",
    count: "resume-include-quiz-count",
  });

  const MESSAGES = Object.freeze({
    noFormat: "The quiz format checker has not loaded, so no quiz can be held",
    noSession: "Open a session first: the practice quiz belongs to the open session",
    notCopyable: "The quiz could not be copied",
  });

  // ============================================================================
  // STATE
  // ============================================================================

  /** { quiz, session, count } or null. `quiz` is a private copy. */
  let held = null;

  /** The open session object, or null. Replaceable by a test (setSessionSource). */
  function defaultSessionSource() {
    if (typeof window.getMathPixSessionRestorer !== "function") return null;
    const restorer = window.getMathPixSessionRestorer();
    return (restorer && restorer.restoredSession) || null;
  }

  let sessionSource = defaultSessionSource;

  function currentSession() {
    try {
      return sessionSource() || null;
    } catch (e) {
      logWarn("Could not read the open session", e);
      return null;
    }
  }

  const copyOf = (quiz) => JSON.parse(JSON.stringify(quiz));
  const byId = (id) => document.getElementById(id);

  function emitChange() {
    document.dispatchEvent(
      new CustomEvent(CHANGE_EVENT, { detail: { count: held ? held.count : 0 } }),
    );
  }

  /** Drop a quiz whose session has gone. Returns true when one was dropped. */
  function dropIfStale() {
    if (!held || held.session === currentSession()) return false;
    logInfo("The session changed, so the practice quiz was cleared");
    held = null;
    emitChange();
    syncOption(); // whichever read noticed it, the option hides at once
    return true;
  }

  function quizNoun(n) {
    return n === 1 ? "1 question" : `${n} questions`;
  }

  // ============================================================================
  // THE OPTION
  // ============================================================================

  /**
   * Show the option with the count when a quiz is held, hide it otherwise.
   * Ticked when it appears (ruling: ticked when shown); a person's untick is
   * kept for as long as the option stays shown.
   */
  function render() {
    if (dropIfStale()) return; // dropIfStale has already hidden the option
    syncOption();
  }

  /** The DOM half of render: reflect `held` in the option, without re-reading the session. */
  function syncOption() {
    const wrapper = byId(OPTION_IDS.wrapper);
    const checkbox = byId(OPTION_IDS.checkbox);
    const countEl = byId(OPTION_IDS.count);
    if (!wrapper || !checkbox || !countEl) return;

    if (!held) {
      wrapper.hidden = true;
      return;
    }

    countEl.textContent = quizNoun(held.count);
    if (wrapper.hidden) {
      checkbox.checked = true;
      wrapper.hidden = false;
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Hold a quiz for the open session. Refuses anything checkQuizRules refuses
   * and returns its errors, so the caller can say why.
   * @param {*} quiz
   * @returns {{ ok: boolean, errors: object[], warnings: object[], count: number }}
   */
  function set(quiz) {
    const format = window.MathPixQuizFormat;
    if (!format || typeof format.checkQuizRules !== "function") {
      return { ok: false, errors: [{ questionId: null, field: "", message: MESSAGES.noFormat }], warnings: [], count: 0 };
    }

    const verdict = format.checkQuizRules(quiz);
    if (!verdict.ok) {
      logWarn("Quiz refused", verdict.errors);
      return { ok: false, errors: verdict.errors, warnings: verdict.warnings, count: held ? held.count : 0 };
    }

    const session = currentSession();
    if (!session) {
      return { ok: false, errors: [{ questionId: null, field: "", message: MESSAGES.noSession }], warnings: verdict.warnings, count: 0 };
    }

    let copy;
    try {
      copy = copyOf(quiz);
    } catch (e) {
      logError("Quiz copy failed", e);
      return { ok: false, errors: [{ questionId: null, field: "", message: MESSAGES.notCopyable }], warnings: verdict.warnings, count: 0 };
    }

    held = { quiz: copy, session, count: copy.questions.length };
    emitChange();
    render();
    logInfo(`Practice quiz held: ${quizNoun(held.count)}`);
    return { ok: true, errors: [], warnings: verdict.warnings, count: held.count };
  }

  /** A copy of the open session's quiz, or null. */
  function get() {
    dropIfStale();
    return held ? copyOf(held.quiz) : null;
  }

  /** Drop the quiz (if any) and hide the option. */
  function clear() {
    const had = !!held;
    held = null;
    if (had) emitChange();
    render();
  }

  /** Number of questions held for the open session (0 when none). */
  function count() {
    dropIfStale();
    return held ? held.count : 0;
  }

  /**
   * The quiz the export should add, or null: only when a quiz is held for the
   * open session AND the option is shown AND ticked.
   */
  function quizForExport() {
    const quiz = get();
    if (!quiz) return null;
    const wrapper = byId(OPTION_IDS.wrapper);
    const checkbox = byId(OPTION_IDS.checkbox);
    if (!wrapper || !checkbox || wrapper.hidden || !checkbox.checked) return null;
    return quiz;
  }

  /** Test hook: supply the open session (a function), or null for the real one. */
  function setSessionSource(fn) {
    sessionSource = typeof fn === "function" ? fn : defaultSessionSource;
    render();
  }

  // ============================================================================
  // WIRING
  // ============================================================================

  // A replaced session is noticed on the next read; a focus move anywhere also
  // re-checks, so a stale option does not wait for the export to hide it. The
  // check is one comparison and runs only while a quiz is held.
  document.addEventListener("focusin", () => {
    if (held) render();
  });

  function init() {
    render();
    logDebug("Quiz store ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.MathPixQuizStore = Object.freeze({
    CHANGE_EVENT,
    OPTION_IDS,
    set,
    get,
    clear,
    count,
    quizForExport,
    setSessionSource,
  });
})();
