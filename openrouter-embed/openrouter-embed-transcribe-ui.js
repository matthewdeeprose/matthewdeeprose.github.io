/**
 * @file openrouter-embed-transcribe-ui.js
 * @description The Transcribe tool's controller: wires the inert markup that
 * item 35 unit 6 shipped to the client module openrouter-embed-transcribe.js.
 *
 * NAMING. This is the UI-side sibling of a logic module in the same folder,
 * which openrouter-embed/ already does twice — provider-switcher.js with
 * provider-switcher-ui.js, and local-text-model-manager.js with
 * local-text-model-manager-ui.js. Both pairs put the DOM wiring in a `-ui`
 * file beside the module it drives, so that is the convention followed here.
 *
 * WHAT THIS FILE OWNS
 * -------------------
 * Every voice, every DOM write, and every piece of in-flight state for the
 * Transcribe tool. The module beneath it speaks to nothing at all, by design
 * (read its header), so the whole "what does the user hear" decision lives
 * here and in exactly one place.
 *
 * IT NEVER CALLS announce(). Every spoken line goes through notify*(), which
 * announces through window.accessibilityHelpers inside _announceToast. Adding
 * an announce() beside any notify*() here would speak the event TWICE — the
 * single commonest defect AGENTS.md records, and the thing register row 39
 * part (b) exists to listen for. There is no announcer call in this file and
 * there must never be one.
 *
 * IT GAINED FOUR VOICES AT REGISTER ITEM 46 UNIT 8, and every one of them obeys
 * the paragraph above — see THE FOUR SPOKEN GESTURES below, which is the one
 * place they are composed and the one place they reach the outside world. The
 * silence they replaced was overturned by EAR, at the sitting of 13 September
 * 2026, and the half of that decision which is UNCHANGED is the load-bearing
 * one: no aria-live and no live role is added anywhere in this chain, and the
 * transcript is not a live region and must not become one.
 *
 * THE MODULE IS RESOLVED AT CALL TIME, NEVER AT LOAD. Same discipline the
 * module itself applies to the Entra token, for the same reason: a module-scope
 * capture freezes whatever happened to exist during parsing. Resolving inside
 * each handler also lets a test harness stub the module after load, which is
 * how this file's failure treatments are proved without spending anything.
 *
 * @module OpenRouterEmbedTranscribeUI
 * @since 1 September 2026
 */
const OpenRouterEmbedTranscribeUI = (function () {
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
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error("[TranscribeUI]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[TranscribeUI]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[TranscribeUI]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[TranscribeUI]", message, ...args);
  }

  // ==========================================================================
  // ELEMENT IDS
  // ==========================================================================

  /**
   * The ids this file addresses. A missing one is a GENUINE failure: the tool
   * cannot do its job without any of them, so init() returns false and
   * switchToTool announces an error.
   */
  const REQUIRED_IDS = Object.freeze([
    "transcribe-file-input",
    "transcribe-file-name",
    "transcribe-locale",
    "transcribe-max-speakers",
    "transcribe-run",
    "transcribe-results",
    "transcribe-transcript",
    "transcribe-copy",
    "transcribe-download-txt",
    "transcribe-download-srt",
    "transcribe-progress",
    "transcribe-progress-text",
  ]);

  /**
   * Ids whose absence is a markup regression worth logging but does NOT stop
   * the tool working, so it must not reach the user as a spoken error.
   * Returning false here would announce a failure for something that changes
   * nothing the person is trying to do.
   *
   * The first three are what the tool's own build unit 6 shipped and this file
   * never writes to — the results heading the section is labelled by, the progress
   * bar itself, and the speaker-label caveat. The next two are the per-control
   * wrappers inside #transcribe-display-options (item 54): the reveal helper
   * writes `hidden` on each, and tolerates either being missing, because a
   * transcript still renders and downloads with no display options at all.
   * NEITHER DISPLAY-OPTIONS CHECKBOX IS HERE, and none of these joins
   * REQUIRED_IDS: the three checkboxes are looked up at wiring time in init(),
   * where a missing one is logged and the tool carries on with that control's
   * default.
   *
   * THE NEXT FOUR ARE THE SPEAKER-NAMING BLOCK (item 46 unit 4b), and they are
   * HERE RATHER THAN IN REQUIRED_IDS for the reason the doc comment on init()
   * gives: a false return costs the person the post-switch focus move as well
   * as producing a spoken error, and a missing naming control must not cost
   * somebody their place on the page. A transcript still renders, copies and
   * downloads with no way to name a speaker.
   *
   * THE LAST THREE ARE THE SELECTION BLOCK (item 46 unit 6), here for exactly
   * the same reason and grouped the same way: the wrapper, because its reveal
   * helper writes `hidden` on it and must tolerate its absence, and the count
   * and the clear button beside it, because like the naming controls they are
   * useless singly — a count with no way to clear it, or a clear button with
   * no count to answer it, is half a gesture. A transcript still renders,
   * copies and downloads with no way to select a line at all, and the row
   * checkboxes themselves are unaffected by any of the three being missing.
   *
   * THE SELECTION BLOCK IS NOW SEVEN, NOT THREE (item 46 unit 7b), and the
   * paragraph below is left standing rather than edited because it records
   * unit 6's own reasoning for the shape and that reasoning is unchanged. The
   * four added are the move hint, the move picker, the Move button and the Add
   * speaker button, and they are here for the reason every id in this list is:
   * a missing one must not make init() return false, because a false costs the
   * person the post-switch focus move as well as producing a spoken error. A
   * transcript still renders, copies and downloads with no way to move a line.
   *
   * THE HINT IS IN THE LIST THOUGH NOTHING LOOKS IT UP — and that is the one
   * entry worth justifying, because every other id here is either written to or
   * read from. It is the target of the select's aria-describedby, so its
   * absence is a control that has silently lost its description; nothing in the
   * running tool would notice, and one log line naming it is the only way
   * anybody would.
   *
   * IT IS FOUR, NOT THREE — the block's WRAPPER is one of them. That follows
   * the two display-options wrappers immediately above it, which are in this
   * list for the same reason: the reveal helper writes `hidden` on the wrapper
   * and must tolerate its absence. The three controls are then listed beside it
   * rather than being left to the checkbox treatment, because unlike a checkbox
   * they are useless singly — a picker with no field, or a field with no Apply,
   * is a control nobody can complete a gesture with, so one log line naming
   * whichever is missing is more use than three separate ones.
   */
  const STRUCTURAL_IDS = Object.freeze([
    "transcribe-results-heading",
    "transcribe-progress-indicator",
    "transcribe-note",
    "transcribe-speaker-option",
    "transcribe-timestamps-option",
    "transcribe-speaker-names",
    "transcribe-speaker-picker",
    "transcribe-speaker-name",
    "transcribe-speaker-apply",
    "transcribe-speaker-apply-detail",
    "transcribe-selection",
    "transcribe-selection-count",
    "transcribe-selection-clear",
    "transcribe-selection-move-hint",
    "transcribe-selection-target",
    "transcribe-selection-move",
    "transcribe-selection-add-speaker",
  ]);

  // ==========================================================================
  // SPOKEN AND WRITTEN TEXT
  // ==========================================================================

  const PROGRESS_TEXT = "Transcribing audio…";
  const START_SENTENCE = "Transcribing audio. This may take a minute.";
  const COPIED_SENTENCE = "Transcript copied to clipboard.";

  // ==========================================================================
  // THE FOUR SPOKEN GESTURES (register item 46 unit 8)
  // ==========================================================================
  //
  // THE SILENCE WAS OVERTURNED BY EAR, AND NOTHING ELSE COULD HAVE DONE IT.
  // Register item 46 was built silent by design across eight units, every one
  // of them recording that silence and naming listen row 47 part (c) as the
  // thing that would decide it. The owner sat with it on 13 September 2026,
  // heard the silence at every gesture, and ruled that all four announce.
  // Every automated layer this project owns measures whether an announcement
  // that EXISTS reaches a reader correctly; not one of them can ask whether an
  // announcement that does not exist is MISSED.
  //
  // THE SCOPE IS FOUR GESTURES AND NOTHING ELSE. Register item 45's text
  // correction still announces nothing on commit, items 47 and 48 are still
  // unheard, and the three display checkboxes, the selection tick boxes and
  // Clear selection are all still silent. Listen row 47 part (c) NARROWS to
  // items 45, 47 and 48; it does not close.
  //
  // THEY GO THROUGH notify*() AND NEVER THROUGH A REGION IN THE TRANSCRIPT.
  // That half of the original decision is UNCHANGED and is load-bearing: no
  // aria-live and no live role is added anywhere in this chain, and register
  // items 43 and 45 stay do-not-reopen. See this file's header for why an
  // announce() call beside a notify*() would speak the event twice.
  //
  // A NO-OP SAYS NOTHING, AND THAT IS PART OF THE RULING RATHER THAN AN
  // IMPLEMENTATION DETAIL. An announcement for a gesture that changed nothing
  // teaches a person to stop listening to announcements, which would cost more
  // than the silence just withdrawn. Every call site below sits AFTER its
  // handler's existing `changed` guard for that reason, never before it.
  //
  // REGISTER ITEM 62 REACHES THESE AND IS RECORDED RATHER THAN DEFEATED. The
  // shared announcer suppresses an IDENTICAL string on the same channel inside
  // 5,000 ms. The sentences vary by slot, name and count, so sequences of
  // different gestures are unaffected — but TWO IDENTICAL SPEAKER CHANGES
  // INSIDE FIVE SECONDS produce one byte-identical sentence and the second is
  // dropped. A counter or a nonce would defeat the suppressor, and the
  // suppressor exists to stop exactly the chatter a person re-attributing a
  // run of lines would otherwise get. Recorded against listen row 50.
  //
  // NOTHING BELOW HAS BEEN HEARD. Listen row 50 carries all four.

  /**
   * A name was applied: the slot is now called that name.
   *
   * THE SUBJECT IS THE SLOT'S PREVIOUS DISPLAY NAME, NOT ITS NUMBER. A slot
   * that had no name reads "Speaker 1 is now called Amira."; a slot already
   * called Clive reads "Clive is now called Amira." Both are true and both
   * name the thing the person was looking at a moment ago, which is what a
   * confirmation has to do.
   *
   * @param {string} previousDisplay - the slot as it read BEFORE the write
   * @param {string} name - the trimmed name now stored
   * @returns {string}
   */
  function nameAppliedSentence(previousDisplay, name) {
    return `${previousDisplay} is now called ${name}.`;
  }

  /**
   * A name was cleared: the slot has gone back to its number.
   *
   * "again" IS DOING REAL WORK AND IS NOT DECORATION. It is what says the
   * slot has RETURNED to something rather than been renamed to a new thing —
   * without it, "Amira is now Speaker 1." reads as if the person had typed
   * "Speaker 1" into the box. Every slot read as its number before it was
   * ever named, so the word is true of every clear this can report.
   *
   * @param {string} previousDisplay - the name the slot carried
   * @param {string} numberDisplay - the slot as it reads unnamed
   * @returns {string}
   */
  function nameClearedSentence(previousDisplay, numberDisplay) {
    return `${previousDisplay} is now ${numberDisplay} again.`;
  }

  /**
   * Lines changed speaker: how many, from which speaker to which.
   *
   * THE "from" CLAUSE IS DROPPED WHEN IT CANNOT BE STATED, AND THAT IS THE
   * WHOLE REASON THIS TAKES A LIST RATHER THAN A SLOT. A selection may span
   * several source speakers — the design's section 8 answer 3 settles that it
   * works and moves them all — so there is not always one speaker to name.
   * Naming the first of several would be a confident false sentence, which is
   * worse than a shorter true one.
   *
   * @param {number} changed - rows whose speaker actually moved
   * @param {string[]} sourceDisplays - the distinct source display names
   * @param {string} targetDisplay - the slot they moved to
   * @returns {string}
   */
  function speakerChangedSentence(changed, sourceDisplays, targetDisplay) {
    const lines = pluralise(changed, "line");
    return sourceDisplays.length === 1
      ? `${lines} changed from ${sourceDisplays[0]} to ${targetDisplay}.`
      : `${lines} changed to ${targetDisplay}.`;
  }

  /**
   * A speaker slot was opened.
   *
   * IT REPORTS THE SLOT AND NOT THE SELECTION, deliberately. The handler also
   * selects the new slot as the change target, and its own notes call that
   * "the whole of the mitigation" precisely because the picker SHOWS it — a
   * visible control describing its own state needs no sentence, and adding one
   * here would be saying twice what a person can already see once.
   *
   * @param {string} display - the new slot as it reads, e.g. `Speaker 5`
   * @returns {string}
   */
  function speakerAddedSentence(display) {
    return `${display} added.`;
  }

  /**
   * Speak one sentence, politely, through the shared notification system.
   *
   * ONE COMPUTED STRING, ONE OUTPUT, and one place the four gestures reach
   * the outside world. AGENTS.md § Announcements asks for exactly that, and a
   * single wrapper is what makes "is there an announce() beside a notify*()"
   * answerable by reading four call sites rather than by reading the file.
   *
   * notifySuccess AND NOT notifyInfo: all four sentences report a completed
   * change the person asked for. Both are polite — `_announceToast` sends
   * everything but `error` politely — so the choice is about what the toast
   * LOOKS like and not about what a reader hears.
   *
   * IT IS GUARDED THE WAY THIS FILE'S OTHER notify*() CALLS ARE. The globals
   * are published by a plain script and this file is not guaranteed to load
   * after it; an unguarded call would throw inside a gesture handler and
   * abandon the repaint that follows it.
   *
   * @param {string} sentence
   */
  function speak(sentence) {
    if (window.notifySuccess) window.notifySuccess(sentence);
    else logWarn(`nothing to announce through; the sentence was: ${sentence}`);
  }
  const NO_FILE_TEXT = "No file chosen";

  /**
   * Plain-language failure text keyed by NUMERIC HTTP status, following
   * chat/chat-core.js:75-79 in both shape and discipline. The numeric-key trap
   * that file records applies here identically: a property access coerces its
   * key to a string, so "401" would match this map exactly as a real 401 does —
   * which is why every read below tests `typeof status === "number"` FIRST.
   *
   * 401 is the module's own SIGNED_OUT_MESSAGE, quoted rather than imported so
   * the two cannot silently diverge into different sentences for one event; the
   * module throws it before any network, and this map covers a 401 that comes
   * back from the Worker instead.
   *
   * 403 DELIBERATELY OFFERS NO NEXT STEP, copied verbatim from Chat along with
   * its reasoning: a 403 means the account signed in and is not permitted, so
   * suggesting another sign-in sends somebody round a loop that cannot succeed.
   * Do not "improve" this by adding a remedy it does not have.
   */
  const ERROR_TEXT_BY_STATUS = Object.freeze({
    401: "Your sign-in has expired. Sign in again to continue, then start the transcription.",
    403: "Your account is not permitted to use this service.",
    413: "That file is too large for this service.",
    503: "The service could not check your sign-in just now. Please try again shortly.",
  });

  const TOO_LARGE_SENTENCE = ERROR_TEXT_BY_STATUS[413];

  const GENERIC_FAILURE_SENTENCE =
    "The transcription could not be completed. Please try again.";

  /**
   * A SIZE-SHAPED failure that did not arrive as 413.
   *
   * STATE OF EVIDENCE, HONESTLY: this pattern is UNMEASURED. No over-limit send
   * has ever been made through this Worker, so nothing here is grounded the way
   * MEASURED_MAX_BYTES is — that constant is a measured FLOOR (43,679,539 bytes
   * succeeded) and the true ceiling has never been found. A file between the
   * two could fail with a status nobody has seen.
   *
   * THE TEST THAT WOULD SETTLE IT: send a file above the ceiling and read the
   * status and body back. Until somebody does, this stays a guess and is
   * labelled one.
   *
   * The guess is safe to hold because a MISS costs specificity and never
   * correctness — an unmatched failure falls through to GENERIC_FAILURE_SENTENCE
   * and the user is still told the run failed. It is applied ONLY to a body that
   * carries no recognised status, so it can never override a real 403 or 401.
   */
  const SIZE_SHAPED_BODY = /too large|payload|request entity|exceeds the maximum/i;

  // ==========================================================================
  // MODULE-SCOPE STATE
  // ==========================================================================

  // Wire-once guard, following chat/chat-core.js's `wired`. init() runs on every
  // switch into the tool, and the controls are static, so without this a second
  // visit stacks a second listener on every button and doubles every action.
  let wired = false;

  // Re-entry guard for the send itself. NOT the disabled flag: see the comment
  // at handleRun for why the button stays enabled.
  let running = false;

  // The in-flight request's AbortController, so cleanup() can cancel a send when
  // the user leaves the tool. Null whenever nothing is in flight.
  let inFlight = null;

  // THE LAST SUCCESSFUL RESULT IS NOT HELD HERE ANY MORE. It lives in
  // openrouter-embed-transcribe-state.js, and this file reads it back through
  // currentResult() below. The superseded module-scope `let` that used to sit
  // here was a private copy — its name is deliberately not written anywhere in
  // this file, so a marker gate asserting the old identifier is gone cannot be
  // satisfied by this very paragraph (AGENTS.md § Testing: a rationale comment
  // quoting what it removed answers a zero needle in the code's place).
  // Register item 45 turns the phrase array from render input into state
  // that several consumers must see the CURRENT version of, and a private copy
  // is exactly the divergence that makes a correction invisible to the surface
  // that did not make it. Two copies of one transcript cannot be kept in step
  // by discipline, so there is only one.
  //
  // NOTHING ELSE MOVED WITH IT. `lastFileName` below stays a module-scope
  // `let`, even though the state module has a `meta.fileName` slot that would
  // take it: moving it is churn this unit does not need, and the slot is filled
  // by whichever unit first has a reason to read it back.

  // The chosen file's name, for deriving download filenames.
  let lastFileName = "";

  // Whether the speaker label is printed on every row, or only where the
  // speaker changes. IN-MEMORY FOR THE SESSION AND RESET ON LOAD, per register
  // item 43: it is a module-scope `let` and NOT localStorage or
  // sessionStorage, deliberately. Persistence is a later, explicit decision,
  // and storing it now would decide it by accident. The initial value matches
  // the checkbox's `checked` default in the markup, so the two agree before
  // anybody touches either.
  let showSpeakerOnEveryLine = true;

  // Whether each row carries its leading <time> element, or omits it. IN-MEMORY
  // FOR THE SESSION AND RESET ON LOAD, per register item 54, on exactly the
  // terms `showSpeakerOnEveryLine` records above: a module-scope `let`, never
  // localStorage or sessionStorage, and the initial value matches the
  // checkbox's `checked` default in the markup. It governs the SCREEN only —
  // nothing hands it to `toPlainText` or `toSrt`, so the clipboard and both
  // downloads cannot see it, which is item 54's standing constraint.
  let showTimestamps = true;

  // Whether each row's phrase text is an editable control, or a plain text
  // span. IN-MEMORY FOR THE SESSION AND RESET ON LOAD, on exactly the terms
  // `showSpeakerOnEveryLine` and `showTimestamps` record above: a module-scope
  // `let`, never localStorage or sessionStorage, and the initial value matches
  // the checkbox's `checked` default in the markup — which for THIS box is
  // UNTICKED, unlike the two above it, because unticked is the transcript
  // listen rows 40 and 42 heard.
  //
  // It governs the SCREEN only. The corrections it lets a person make live in
  // the state module and reach `toPlainText` and `toSrt` from there, so the
  // mode itself never touches a formatter — which is register item 54's
  // standing constraint, unchanged.
  let editMode = false;

  /**
   * The rows a person has ticked, as a Set of 0-based row indices.
   *
   * IT LIVES HERE AND NOT IN THE STATE MODULE, AND THAT IS A DECISION RATHER
   * THAN A CONVENIENCE. Selection is not part of the transcript: it is not in
   * `serialise`'s output, nothing derives from it, and a reload losing it is
   * the CORRECT behaviour rather than a defect. The state module's whole
   * discipline is that it holds one kind of thing — the words, the speakers and
   * what they arrived as — so widening it with view state would put a second
   * kind in, and the boundary is easier to keep than to recover.
   *
   * THE DESIGN'S OWN SENTENCE ABOUT THE STATE MODULE DOES NOT COVER THIS, and
   * the note is here because a later reader will otherwise think it does.
   * Section 5 settles that register items 46, 47 and 48 all write back to the
   * one state module; that is a statement about the DATA — names, speakers,
   * corrections — and a tick box is not data. Unit 7's reassign reads this Set
   * from this file, which is the only consumer there will be.
   *
   * IN-MEMORY FOR THE SESSION, on the same terms as the three display
   * variables above: a module-scope binding, never localStorage or
   * sessionStorage. It is cleared at THREE places, and each has its reason
   * written at its own site rather than here: when edit mode goes off
   * (handleEditModeChange), when the transcript is discarded
   * (handleFileChange), and when a new transcript arrives (handleRun).
   *
   * THE THIRD ARRIVED LATE, AND THE GAP IS THE GENERAL LESSON (repair unit R2,
   * on a finding unit 7b raised and did not fix). VIEW STATE KEYED BY ROW INDEX
   * OUTLIVES THE DOCUMENT IT INDEXES. Two of the three clear sites were built
   * with the Set at unit 6 and the third was not, because "the transcript is
   * replaced" and "the file is changed" look like one event and are two — Run
   * can be pressed again on the same file. An index is valid against any
   * transcript long enough, so the survivors selected the wrong lines rather
   * than failing, and unit 7b's Move gesture turned that from a wrong highlight
   * into a wrong write. Register item 90.
   */
  const selectedRows = new Set();

  // ==========================================================================
  // SMALL HELPERS
  // ==========================================================================

  function el(id) {
    return document.getElementById(id);
  }

  /**
   * Write text only when it differs.
   *
   * AGENTS.md's "write if changed" rule. None of the targets here is a live
   * region, so a same-string rewrite is silent today — but the rule is about not
   * depending on that: whether an identical rewrite is announced is not
   * decidable from the DOM, and a target can gain a role later without anyone
   * revisiting the writer. Note also that an identical-value textContent
   * assignment is a REAL mutation that arrives as childList, so it is visible to
   * any observer watching this subtree.
   */
  function setText(element, value) {
    if (!element) return;
    if (element.textContent === value) return;
    element.textContent = value;
  }

  function pluralise(count, singular) {
    return count === 1 ? `1 ${singular}` : `${count} ${singular}s`;
  }

  /**
   * Resolve the client module at call time. Never cached at module scope — see
   * the file header.
   */
  function moduleOrNull() {
    return window.OpenRouterEmbedTranscribe || null;
  }

  /**
   * The transcript state module, resolved at call time for the same reason
   * moduleOrNull() resolves the client module at call time — read the file
   * header. A module-scope capture would freeze whatever existed during
   * parsing, and would stop a harness stubbing the module after load.
   */
  function stateOrNull() {
    return window.OpenRouterEmbedTranscribeState || null;
  }

  /**
   * Whether a transcript is held at all.
   *
   * THIS IS NOT `currentResult() !== null`, deliberately. `snapshot()` builds a
   * result-shaped view over every phrase, so asking it a yes/no question means
   * paying for 657 rows to test the answer for null. Both checkbox handlers ask
   * exactly that question on a keystroke, so they ask it here instead.
   *
   * @returns {boolean}
   */
  function haveTranscript() {
    const state = stateOrNull();
    return Boolean(state && state.isLoaded());
  }

  /**
   * The current transcript, in the shape the renderer and both formatters
   * already take — `{ text, phrases, durationMs, raw, backend }`. Null when
   * nothing is held, which is the question every export call site used to ask
   * of the private copy.
   *
   * READ IT AT THE POINT OF USE, never once into a variable that outlives the
   * handler: a snapshot is a view of the state at the moment it was taken, and
   * holding one is how a private copy grows back.
   *
   * @returns {object|null}
   */
  function currentResult() {
    const state = stateOrNull();
    if (!state || !state.isLoaded()) return null;
    return state.snapshot();
  }

  /**
   * How many distinct speakers the result actually names. Derived from the
   * phrases rather than from the requested maximum, because the requested
   * maximum is a ceiling the service need not reach — and unit 2 measured
   * exactly that: five people speaking produced four labels, two voices merged.
   * Reporting the requested figure would report a number nobody measured.
   */
  function speakerCount(result) {
    if (!result || !Array.isArray(result.phrases)) return 0;
    const seen = new Set();
    result.phrases.forEach((phrase) => {
      if (phrase && phrase.speaker !== null && phrase.speaker !== undefined) {
        seen.add(phrase.speaker);
      }
    });
    return seen.size;
  }

  /**
   * Choose the one sentence a failure is reported with.
   *
   * ONE TREATMENT PER FAILURE. Exactly one branch is reachable for any error,
   * and every branch returns a string — so a caller cannot accidentally report
   * a failure twice, or report one with nothing.
   *
   * @param {Error} error
   * @returns {string}
   */
  function failureSentence(error) {
    const status = error && error.status;

    if (typeof status === "number" && ERROR_TEXT_BY_STATUS[status]) {
      return ERROR_TEXT_BY_STATUS[status];
    }

    // Only reached when the status is unrecognised, so this can never displace
    // a real 401 or 403. See SIZE_SHAPED_BODY for why it is a labelled guess.
    const body = error && typeof error.body === "string" ? error.body : "";
    if (body && SIZE_SHAPED_BODY.test(body)) {
      return TOO_LARGE_SENTENCE;
    }

    // The module's own pre-network refusals — an unsupported type, an empty
    // file, one over the measured floor — arrive as a plain Error carrying a
    // sentence already written for a person to read. Prefer it to the generic.
    if (error && typeof error.message === "string" && error.message) {
      const message = error.message;
      // A raw HTTP body is not worth saying: it can run to a full JSON error
      // document. The module composes those as "Transcription request failed:
      // HTTP <n> — <body>", so that prefix is the discriminator.
      if (!message.startsWith("Transcription request failed:")) {
        return message;
      }
    }

    return GENERIC_FAILURE_SENTENCE;
  }

  // ==========================================================================
  // PROGRESS SURFACE
  // ==========================================================================

  /**
   * The progress surface MUST NOT SPEAK. It is an indeterminate progressbar with
   * an accessible name and no live role and no live ancestor, and register row
   * 39 makes a single utterance from it a failure of that row rather than a
   * cosmetic issue. Nothing here adds a role, a liveness or an atomicity — it
   * toggles `hidden` and writes a text span, and that is the whole contract.
   */
  function showProgress() {
    const progress = el("transcribe-progress");
    const text = el("transcribe-progress-text");
    setText(text, PROGRESS_TEXT);
    if (progress) progress.hidden = false;
  }

  function hideProgress() {
    const progress = el("transcribe-progress");
    if (progress) progress.hidden = true;
    setText(el("transcribe-progress-text"), "");
  }

  // ==========================================================================
  // RESULT ACTIONS — enabled only once there is something to act on
  // ==========================================================================

  /**
   * Copy and the two Downloads are disabled until a transcript exists.
   *
   * WHY DISABLE RATHER THAN GUARD-AND-COMPLAIN: a button that looks available
   * and does nothing is the worst of the options, and a guard that answers with
   * a spoken refusal invents three sentences nobody has listened for. Disabling
   * removes them from the tab order, which is the honest signal that there is
   * nothing to copy yet, and it adds no speech at all.
   *
   * These are not focused controls at the moment they are disabled — the tool
   * has just been entered, or a new file has just been chosen through the file
   * input — so the "disabling a focused control moves focus to body" hazard that
   * chat/chat-messages.js records does not arise here. It WOULD arise if this
   * were ever called while one of them held focus; do not move the call.
   */
  function setResultActionsEnabled(enabled) {
    ["transcribe-copy", "transcribe-download-txt", "transcribe-download-srt"]
      .map(el)
      .forEach((button) => {
        if (button) button.disabled = !enabled;
      });
  }

  // ==========================================================================
  // THE TRANSCRIPT RENDERER
  // ==========================================================================

  /**
   * Class names and the row-id stem. Hoisted because the renderer, the reset
   * path and any later feature all need the same strings, and a typo in one
   * copy produces markup that looks right and styles wrong.
   *
   * The row id is STABLE and derived from the phrase index, so register items
   * 45 to 47 have an anchor to attach an edit control to, to scroll to, and to
   * name in a diff. It is deliberately not random.
   */
  const ROW_ID_STEM = "transcribe-phrase-";
  const CLASS_LIST = "transcribe-list";
  const CLASS_ROW = "transcribe-row";
  const CLASS_TIME = "transcribe-time";
  const CLASS_SPEAKER = "transcribe-speaker";
  const CLASS_TEXT = "transcribe-text";

  /**
   * The edit surface's own strings (register item 45 unit 7).
   *
   * THE EDIT CONTROL'S ID IS DERIVED FROM THE ROW INDEX, in the same style and
   * for the same reason as ROW_ID_STEM: a patched row has to place focus on an
   * element it can NAME, and a name derived from the index is one both the
   * patch and any later harness can compute without holding a reference. The
   * ids stay 0-BASED, matching the row ids — `#transcribe-phrase-0` and
   * `#transcribe-edit-0` are the same first row.
   *
   * THE LABEL TEXT IS 1-BASED, and the mismatch with the id is deliberate. An
   * id is for code and a label is for a person, and a person counting rows down
   * a transcript starts at one. So the first row's control is `#transcribe-edit-0`
   * and is named "Edit phrase 1". Listen row 47 (a) asks the owner to record
   * what the reader announces the control AS, verbatim, so the choice has to be
   * visible here rather than buried in a template.
   *
   * THAT IS THE UNCORRECTED NAME ONLY. A corrected row's control is named
   * "Edit phrase 1, corrected" — see EDIT_LABEL_CORRECTED_SUFFIX immediately
   * below, which is where the state joins the name and why.
   *
   * CLASS_VISUALLY_HIDDEN IS THE APP-WIDE CLASS from main.css (~:2073), not a
   * new one. Both the control's label and the corrected marker use it, so the
   * text is available to a reader and absent from the screen, with no CSS added
   * by this unit at all.
   */
  const EDIT_ID_STEM = "transcribe-edit-";
  const CLASS_EDIT = "transcribe-edit";
  const CLASS_CORRECTED = "transcribe-corrected";
  const CLASS_VISUALLY_HIDDEN = "visually-hidden";
  const EDIT_LABEL_PREFIX = "Edit phrase ";

  /**
   * The corrected state, ON THE CONTROL'S OWN NAME (register item 45 unit 8).
   *
   * WHY IT IS NOT ENOUGH TO HAVE THE MARKER SPAN. Measured 9 September 2026:
   * with edit mode on, a corrected row's control was INDISTINGUISHABLE from an
   * uncorrected one to a reader moving BY CONTROL. The marker is a sibling of
   * the textbox, outside it, so a person tabbing from control to control — the
   * way anybody actually works through a form of 657 fields — never meets it.
   * The reading was exactly "Edit phrase 1", description empty,
   * `labelledby` undefined, for a row the state module called corrected.
   *
   * IT GOES IN THE `<label for>` TEXT, NOT IN `aria-label` AND NOT IN
   * `aria-describedby`. AGENTS.md's first rule of ARIA is native HTML first,
   * and the label already exists and already names the control, so appending to
   * it costs no attribute at all. `aria-label` would REPLACE a name a real
   * label supplies, which is the arrangement AGENTS.md warns about; a
   * description is not a name, and readers differ on whether and when they
   * speak one — a state a person must know is not something to put behind a
   * reader preference.
   *
   * SO A CORRECTED CONTROL IS NAMED "Edit phrase 1, corrected". The comma is
   * doing real work: it is what stops "Edit phrase 1 corrected" reading as an
   * instruction to correct phrase 1. Listen row 47 (a) and (d) are what judge
   * the wording, and this unit re-arms both.
   *
   * ONE MARKER PER ROW PER MODE. In edit mode the label carries it and the
   * marker span is NOT rendered; in read-only mode there is no label, so the
   * marker span renders exactly as it did before this unit. Rendering both in
   * edit mode would say "corrected" twice on one row, 657 times over.
   */
  const EDIT_LABEL_CORRECTED_SUFFIX = ", corrected";

  /**
   * The selection control's own strings (register item 46 unit 6).
   *
   * THE IDS AND THE LABEL FOLLOW THE EDIT CONTROL EXACTLY, because the design's
   * section 3 settles that a row's controls "all take their name from one
   * place, composed once": `Select phrase 12`, `Edit phrase 12`, and
   * `Play phrase 12` later. So the id stem is 0-BASED and matches the row id
   * and the edit id — `#transcribe-phrase-0`, `#transcribe-select-0` and
   * `#transcribe-edit-0` are the same first row — while the LABEL TEXT is
   * 1-BASED, for the reason EDIT_ID_STEM records above: an id is for code and a
   * label is for a person, and a person counting rows down a transcript starts
   * at one.
   *
   * NEITHER STEM IS A PREFIX OF THE OTHER, which is what lets one id reader
   * serve both — see rowIndexFrom. It is worth saying out loud, because a stem
   * like `transcribe-edit-select-` would have made `editIndexOf` claim this
   * control's rows silently.
   *
   * THE LABEL DOES NOT CARRY `, corrected`, AND IT DOES NOT NAME THE SPEAKER.
   * The edit control's own name already carries the corrected state, and the
   * rule EDIT_LABEL_CORRECTED_SUFFIX states is ONE MARKER PER ROW PER MODE — a
   * second copy on the checkbox would say "corrected" twice on one row, 657
   * times over, which is the defect that rule exists to prevent.
   *
   * NAMING THE SPEAKER WAS CONSIDERED AND LEFT OUT, and both alternatives are
   * recorded here because listen row 49 part (b) reads for exactly this
   * wording. `Select phrase 12, Speaker 1` would tell a person WHOSE line they
   * are about to select, which matters most in the gesture unit 7 adds —
   * moving lines to another speaker. Against it: 657 labels each repeating a
   * name the row's own speaker span already carries, heard immediately after
   * it, and a label that grows when a speaker is renamed. The shorter name is
   * shipped and the sitting decides; if the owner wants the speaker in it, this
   * is the one place it is composed.
   *
   * THE TAB BURDEN DOUBLES, FROM 657 STOPS TO 1,314, AND THAT IS THE AGREED
   * DESIGN RATHER THAN AN OVERSIGHT. The design's section 3 settles selection
   * by tick box in edit mode, and this unit builds it as agreed. It is also a
   * real cost and it belongs at the sitting, so LISTEN ROW 49 PART (b) NOW
   * READS FOR THE TAB BURDEN AS WELL AS FOR THE WORDING — a person working
   * through a transcript control by control meets twice as many, and the design
   * anticipates a THIRD per row later (`Play phrase 12`), which would make it
   * 1,971.
   *
   * THE FALLBACK, IF THE SITTING REJECTS IT, IS A SEPARATE SELECT MODE —
   * exclusive with edit mode, so either mode keeps the row at ONE control and
   * the page at 657 stops. IT IS NOT BUILT AND THIS CODE DOES NOT HEDGE TOWARD
   * IT. It is written down so the sitting has a named alternative to compare
   * against rather than only a complaint, and so that whoever builds it knows
   * the exclusivity is the point: two modes each adding a control would be the
   * same 1,314 by another route.
   */
  const SELECT_ID_STEM = "transcribe-select-";
  const CLASS_SELECT = "transcribe-select";
  const SELECT_LABEL_PREFIX = "Select phrase ";

  /**
   * The selected-line count's wording, and why zero is a separate string.
   *
   * `pluralise` would give "0 lines selected", which is correct English and
   * reads like a form that has gone wrong. "No lines selected" is the sentence
   * a person would use. The other two come from `pluralise`, so "1 line
   * selected" and "3 lines selected" cannot drift from the rest of this file's
   * counting.
   *
   * IT IS NEVER ANNOUNCED. The count is written with `setText` into a <p> that
   * carries no `aria-live` and no role and has no live ancestor — see
   * updateSelectionCount, and tools.html's own comment on the block. A number
   * that changes as a person ticks boxes is exactly what tempts a live region,
   * and it still must not become one. THE COUNT IS STILL SILENT AT UNIT 8:
   * ticking a box announces nothing, and only the four gestures that CHANGE
   * something do — see THE FOUR SPOKEN GESTURES, of which this is not one. (The
   * withdrawn clause read "listen row 47 part (c) decides whether register
   * items 45 to 48 speak at all"; it was heard on 13 September 2026 and decided
   * it for item 46's four gestures alone.) A reader already gets each
   * checkbox's state from the browser.
   */
  const SELECTION_NONE_TEXT = "No lines selected";
  const SELECTION_SUFFIX = " selected";

  /**
   * The corrected marker's text. Read on arrival at the row and NEVER announced
   * at the moment the row becomes corrected — the transcript has no live region
   * and gains none here (register items 43 and 45, both do-not-reopen).
   *
   * IT IS THE READ-ONLY MODE'S MARKER, AS OF UNIT 8. In edit mode the control's
   * own accessible name carries the state instead — see
   * EDIT_LABEL_CORRECTED_SUFFIX for why a sibling span cannot serve a person
   * moving by control, and buildRow for the one-marker-per-row-per-mode rule.
   * Everything below still describes this marker; none of it describes the
   * label.
   *
   * POSITION IS A DECISION OPEN TO THE SITTING, and it is stated as one rather
   * than settled here. It renders AFTER the speaker span and BEFORE the phrase
   * text, so it orients a reader before the words arrive. The alternative —
   * after the text, confirming once the words have been heard — is a different
   * reading, and listen row 47 (d) asks the owner to record which order they
   * heard and which they wanted. On a 657-row transcript the wrong choice is
   * heard 657 times, so nobody should treat this line as settled by the build.
   *
   * A MEASURED SIDE EFFECT, RECORDED BECAUSE IT IS A QUESTION FOR THE SITTING
   * AND NOT A THING TO ENGINEER AGAINST BLIND. `.visually-hidden` positions the
   * marker ABSOLUTELY, so it leaves the inline flow — and Chrome then drops the
   * single-space text nodes either side of it from the accessibility tree
   * entirely. Measured 8 September 2026 by verbose-tree dump: an UNCORRECTED
   * row exposes `StaticText "Speaker 1:"`, `StaticText " "`, `StaticText
   * "<phrase>"`, while a corrected one exposes `StaticText "Speaker 1:"`,
   * `StaticText "Corrected."`, `StaticText "<phrase>"` with NO space node at
   * all. Whether a reader runs those three together or pauses between them is
   * decided by the reader, not by the tree — which is precisely the kind of
   * thing this repo refuses to predict from markup. Listen row 47 (d) is where
   * it is answered. Uncorrected rows are unaffected, which is why the tree
   * gate's baseline is unmoved by this unit.
   */
  const CORRECTED_MARKER_TEXT = "Corrected.";

  /**
   * The MOVED marker, in both of its forms (register item 46 unit 7b).
   *
   * A LINE MOVED TO A DIFFERENT SPEAKER SAYS SO THE SAME WAY A CORRECTED LINE
   * DOES, which is the design's section 3 in one sentence. Everything the two
   * constants above record about the corrected marker applies here unchanged,
   * so none of it is repeated: the mechanism is the same, the rule is the same,
   * and only the word differs.
   *
   * ONE MARKER PER ROW PER MODE, exactly as EDIT_LABEL_CORRECTED_SUFFIX states
   * it. In read-only mode the span renders and the label does not exist; in
   * edit mode the control's own accessible name carries it and the span is NOT
   * rendered. Listen row 49 part (c) reads for precisely this — whether the
   * moved marker is heard ONCE rather than twice — so a row rendering both
   * would fail that part by construction.
   *
   * THE SELECTION CHECKBOX'S LABEL CARRIES NEITHER MARKER. SELECT_LABEL_PREFIX
   * already records why for `corrected`, and the reasoning is identical here: a
   * second label carrying the same fact is the doubling the rule forbids, and
   * the checkbox is a pure selector.
   *
   * ORDER ON A ROW THAT IS BOTH IS FIXED RATHER THAN INCIDENTAL, and it is
   * `corrected` first in both modes. In read-only mode the Corrected. span is
   * appended before this one; in edit mode the label reads
   * "Edit phrase 12, corrected, moved". The design's section 3 says the order
   * is fixed and does not say which way round; it is settled here, on the
   * ground that the corrected marker shipped first and a person who has heard
   * it should not find it moving about. Listen row 49 can overturn it.
   *
   * "Moved." WAS THE WORD AND IS REJECTED — LISTEN ROW 49 PART (c),
   * 13 SEPTEMBER 2026. The withdrawn paragraph is quoted below rather than
   * deleted, because it records a reasoning that was tried and found wrong, and
   * a later reader preferring the shorter word should be able to see that it
   * was already preferred once.
   *
   *   "\"Moved.\" RATHER THAN \"Reassigned.\", WHICH THE DESIGN'S SECTION 3
   *    NAMES. … Two plain words are available and the shorter one is the word
   *    the visible controls use — the button says \"Move selected lines\" and
   *    the hint says \"move them\" — so a reader hears the same verb on the row
   *    as on the control that put it there. It is heard up to 657 times, which
   *    is the argument for the shorter word and also the argument for letting
   *    the sitting overturn it."
   *
   * THE SITTING OVERTURNED IT, AND THE REASON IS A FACT ABOUT THE TOOL RATHER
   * THAN A PREFERENCE ABOUT ENGLISH. "Moved" reads as moving a line's POSITION
   * IN THE SEQUENCE — earlier or later in the transcript — which this tool
   * cannot do and will not do. A person hearing it has no way to tell which
   * kind of move is meant, and the wrong reading is the one suggesting the
   * transcript's ORDER has been edited. The withdrawn paragraph's own argument
   * held in reverse: the visible controls changed too, so the row and the
   * control that put it there still say the same thing.
   *
   * IT NAMES WHERE THE LINE CAME FROM AND NOT WHERE IT WENT. `<previous>` is
   * the display name of `sourceSpeaker`, so a named source slot reads "Speaker
   * changed from Amira." and an unnamed one "Speaker changed from Speaker 2."
   * The owner offered the fuller "from Speaker X to Speaker Y" and it was not
   * taken: THE "to" HALF IS THE LABEL THE ROW ALREADY CARRIES whenever a label
   * prints, so including it would be the doubling the one-marker-per-row-per-
   * mode rule above exists to prevent. The sitting's own note on the old marker
   * was that it said the line is not where the transcription put it WITHOUT
   * SAYING WHERE IT CAME FROM; naming the source is what answers that.
   *
   * LISTEN ROW 50 PART (d) CAN OVERTURN THIS TOO, and the fuller form is a
   * one-line change. Nothing here has been heard.
   *
   * THE MARKER IS DERIVED, SO A ROUND TRIP CLEARS IT WITH NO BOOKKEEPING. It
   * comes from `phrase.speaker !== phrase.sourceSpeaker`, so moving a line back
   * to the slot it arrived in makes the comparison false again and the marker
   * simply stops rendering. That is the state module's "what makes the marker
   * honest", reaching the screen.
   */
  const REASSIGNED_MARKER_PREFIX = "Speaker changed from ";
  const REASSIGNED_MARKER_SUFFIX = ".";
  const CLASS_REASSIGNED = "transcribe-reassigned";
  const EDIT_LABEL_REASSIGNED_PREFIX = ", speaker changed from ";

  /**
   * The moved marker's text, composed ONCE for both modes.
   *
   * ONE COMPOSER, TWO CALLERS, FOR `speakerLabelText`'S REASON EXACTLY. The
   * read-only span and the edit control's label suffix must carry the same
   * words, and composing each inline would leave two builders of one string
   * that could diverge in a way nobody notices until a reader hears it. The
   * two differ only in their surrounding punctuation, which is each surface's
   * own, so each passes it in.
   *
   * IT RESOLVES `speakerDisplayName` AT CALL TIME AND DOES NOT GUARD A MISSING
   * MODULE, matching `speakerLabelText` directly above. Its only caller is
   * `buildRow`, whose own two callers — `renderTranscript`, `patchRow` — both
   * log and return on a missing module, so this is unreachable with the module
   * absent. Any later caller must guard `moduleOrNull()` itself.
   *
   * A PHRASE WITH NO `sourceSpeaker` CANNOT REACH HERE, because the reassigned
   * verdict is `speaker !== sourceSpeaker` asked of the state module, and a
   * phrase whose two are both absent compares equal. Nothing is guarded for it
   * for that reason, which is the same reasoning `buildRow` gives for composing
   * the speaker label only INSIDE its `typeof` branch.
   *
   * @param {number} sourceSpeaker - the slot the transcription put the line in
   * @param {Object<string, string>} names - the names map, read once by the
   *   caller
   * @param {string} prefix - REASSIGNED_MARKER_PREFIX or the edit-label one
   * @param {string} suffix - the surface's own punctuation, or ""
   * @returns {string} e.g. `Speaker changed from Amira.`
   */
  function reassignedMarkerText(sourceSpeaker, names, prefix, suffix) {
    const api = moduleOrNull();
    return (
      prefix +
      api.speakerDisplayName({ speaker: sourceSpeaker, names }) +
      suffix
    );
  }

  /**
   * Milliseconds to an ISO 8601 duration, e.g. 63000 gives "PT1M3S".
   *
   * This is what `datetime` on a <time> element requires for a DURATION: an
   * offset into a recording is not a date, and writing a clock string like
   * "1:03" into `datetime` would be invalid. The VISIBLE text stays the clock
   * string the module already produces, so what a person reads is unchanged and
   * only the machine-readable half is added.
   *
   * @param {number} ms
   * @returns {string}
   */
  function toIsoDuration(ms) {
    const totalSeconds = Math.floor(Math.max(0, Number(ms) || 0) / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    let out = "PT";
    if (hours > 0) out += `${hours}H`;
    if (minutes > 0) out += `${minutes}M`;
    // Always emit seconds, so a zero offset is "PT0S" rather than the invalid
    // bare "PT".
    out += `${seconds}S`;
    return out;
  }

  /**
   * The same clock string `toPlainText` prints, so the screen and the
   * downloaded text agree on how an offset reads.
   *
   * Duplicated here rather than exported from the module because it is four
   * lines of arithmetic with no rule in it — unlike the speaker-label decision,
   * which IS a rule and is therefore centralised. Copying a rule is the defect
   * `speakerLabelFor` exists to prevent; copying a formatter is not the same
   * thing, and exporting every helper would widen that module's surface for no
   * gain.
   *
   * @param {number} ms
   * @returns {string}
   */
  function toClockText(ms) {
    const totalSeconds = Math.floor(Math.max(0, Number(ms) || 0) / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    const pad = (value) => String(value).padStart(2, "0");
    return hours > 0
      ? `${hours}:${pad(minutes)}:${pad(seconds)}`
      : `${minutes}:${pad(seconds)}`;
  }

  /**
   * Empty the transcript container.
   *
   * `replaceChildren()` rather than `innerHTML = ""`: it removes the nodes
   * without going through the HTML parser at all, which is the same reason the
   * renderer below builds with createElement.
   */
  function clearTranscript() {
    const host = el("transcribe-transcript");
    if (host) host.replaceChildren();
  }

  /**
   * THE DOM SURFACE'S OWN PUNCTUATION, and the reason it is a named constant
   * rather than a colon typed into a template literal.
   *
   * `speakerDisplayName` returns `Amira` or `Speaker 5` and NEVER punctuation —
   * its own notes say so in terms, because the three consumers punctuate
   * differently: a colon in plain text, a colon and a space in SRT, and this,
   * a colon inside a separate element on the page. So each surface owns its
   * own, and this is the page's. Unit 5 gives both formatters theirs; a shared
   * one would be a rule about three surfaces that only one of them obeys.
   */
  const SPEAKER_LABEL_SUFFIX = ":";

  /**
   * The Apply button's accessible-name tail, in two pieces.
   *
   * NAMED CONSTANTS BECAUSE THE FIRST ONE IS A SINGLE SPACE AND A SPACE
   * TYPED INTO A TEMPLATE LITERAL IS INVISIBLE TO REVIEW. It is the only
   * thing standing between "Apply name" and "Amira", and losing it welds
   * them into "Apply nameAmira" — a defect that reads perfectly in the
   * source and only in a reader. See updateApplyButtonName for why the
   * space lives here rather than in the markup.
   */
  const APPLY_DETAIL_SEPARATOR = " ";
  const APPLY_DETAIL_JOINER = " as ";

  /**
   * The speaker label AS IT IS PRINTED ON THE PAGE — the shared display stem
   * plus this surface's punctuation, composed in one place.
   *
   * IT IS A FUNCTION RATHER THAN AN INLINE CALL IN buildRow BECAUSE UNIT 4b
   * NEEDS A SECOND CALLER. The design's section 4 settles a two-tier repaint:
   * a rename walks the phrases and writes this string into the speaker span
   * that already exists, WITHOUT rebuilding the row, precisely so a reader's
   * position in a 657-row list survives — which is what listen row 47 (b)
   * reads for. That path and this one must produce the same bytes. Composing
   * inline would leave two builders of one string, and they would diverge
   * silently: the repainted row and the rendered row differing in a way nobody
   * notices until a reader hears it. It is the same hazard buildRow's own
   * notes give for being the ONLY row builder, one level down.
   *
   * THE MODULE IS RESOLVED AT CALL TIME, never captured — see the file header.
   *
   * IT DOES NOT GUARD A MISSING MODULE, AND THAT IS DELIBERATE RATHER THAN AN
   * OMISSION. Both callers already refuse on one — renderTranscript logs and
   * returns, patchRow logs and returns — so this is unreachable with the module
   * absent. The only fallback that would not throw is a locally composed
   * `Speaker N:`, which is the second copy of the wording this function exists
   * to prevent. ANY LATER CALLER MUST GUARD `moduleOrNull()` ITSELF, and unit
   * 4b's rename path is the next one.
   *
   * @param {number} speakerLabel - the resolver's verdict, already taken
   * @param {Object<string, string>} names - the names map, keyed by speaker
   *   number. Object keys are strings either way, so `{ 5: "Amira" }` and
   *   `{ "5": "Amira" }` are the same map.
   * @returns {string} `Amira:`, or `Speaker 5:` where the slot has no name
   */
  function speakerLabelText(speakerLabel, names) {
    const api = moduleOrNull();
    return (
      api.speakerDisplayName({ speaker: speakerLabel, names }) +
      SPEAKER_LABEL_SUFFIX
    );
  }

  // `phraseIsReassigned` WAS HERE AND IS GONE (repair unit R2). Unit 7b built a
  // local copy of the state module's own comparison — `speaker !== sourceSpeaker`
  // — on the dispatch's instruction, said in terms that the performance ground
  // for it was weak, and flagged it for the desk rather than choosing silently.
  // THE DESK RULED FOR THE PRINCIPLE: the module owns its derivations and the
  // controller asks, so all three callers now use `state.isReassigned(index)`,
  // matching `state.isEdited(index)` exactly.
  //
  // THE FUNCTION IS DELETED RATHER THAN REDUCED TO A DELEGATE, because its
  // stated purpose was to be the one place the COPY lived, and with the copy
  // gone there is nothing for it to confine. A delegate taking the index would
  // also have to resolve the state module itself, which would put the
  // null-state tolerance rule in a second place and diverge from how `edited`
  // is read at two of the three sites. `isEdited` has no helper; this is what
  // "matching it exactly" costs and means.

  /**
   * Build one row.
   *
   * TEXT NODES ONLY — every string a person or a service produced reaches the
   * DOM through `document.createTextNode` or `textContent`, never innerHTML.
   * A transcript is somebody's SPEECH, and a phrase containing angle brackets
   * must stay a phrase containing angle brackets rather than becoming elements.
   * Escaping by construction is the point: there is no escape helper to forget
   * to call, because there is no parse step to escape for.
   *
   * ROW ORDER, AND THE FOUR SHAPES A ROW CAN TAKE. The parts are appended in
   * this order and no other: the selection checkbox and its <label>, a " "
   * text node, <time>, a " " text node, the speaker <span>, a " " text node,
   * the Corrected. marker and a " " text node, the Moved. marker and a " "
   * text node, the text <span>. The first pair is present only when `edit` is
   * true; the second only when `timestamps` is true; the third only when
   * `speakerLabel` is a number; the two markers only in READ-ONLY mode and
   * only when their own verdict is true. So a row reads, in the accessibility
   * tree and on screen alike:
   *
   * THIS SENTENCE HAS MOVED FOR THE FOURTH TIME IN NINE UNITS — item 45 unit 7
   * added the edit control, item 46 unit 6 added the checkbox pair, repair unit
   * R1 reversed that pair's internal order, and item 46 unit 7b adds the Moved.
   * marker. It is worth saying because a comment rewritten that often is one a
   * reader should check against the code rather than trust, and because the
   * four shapes below have NEVER enumerated the markers: they are the
   * read-only shapes with no marker on any row, and they are correct only for
   * a row that is neither corrected nor moved. The markers are described in
   * their own branches and under REASSIGNED_MARKER_PREFIX, not here.
   *
   *   [0:16] Speaker 1: phrase      both on
   *   Speaker 1: phrase             timestamps off
   *   [0:16] phrase                 no label wanted for this row
   *   phrase                        neither
   *
   * THE SELECTION CHECKBOX IS THE FIFTH PART AND IT COMES FIRST (register item
   * 46 unit 6). A control that acts on the WHOLE ROW belongs before the row's
   * content — which is what every list, table and mailbox a person has used
   * does — so a reader meets the choice before the words it applies to rather
   * than after them. The four shapes above are the read-only shapes and are
   * unchanged; in edit mode each of them additionally leads with the checkbox
   * and closes with the text box instead of the text span.
   *
   * THE PAIR'S INTERNAL ORDER WAS REVERSED AT REPAIR UNIT R1, and the withdrawn
   * text is quoted here rather than overwritten, per register items 51 and 56.
   * The sentence above read "the selection <label> and its checkbox" and the
   * branch below built them that way. Unit I2's driven audit — the first audit
   * this programme has ever taken with a transcript actually on the page —
   * reported 657 IBM `input_label_after` violations in EVERY `edit=on` state,
   * one per selection checkbox: "Label text is located before its associated
   * checkbox or radio button element". The rule applies to checkboxes and
   * radios and NOT to text inputs, which is why the 657 EDIT controls below,
   * whose <label for> also precedes them, never fired it and are untouched.
   *
   * The CHECKBOX now precedes its LABEL and the pair still leads the row. The
   * id stays `transcribe-select-N` 0-based, the label text stays "Select phrase
   * N" 1-based, the label stays visually hidden, and the accessible name is
   * unchanged — <label for> associates by id, never by position.
   *
   * The omitted pair is NOT in the DOM — no class, no display rule — so the
   * accessibility tree carries neither the element nor the space that
   * followed it. That is the mechanism register item 54 chose, measured as
   * the `8e646912e2c10d537562a1fb` tree with the first InlineTextBox reading
   * "Speaker 1:"; a display rule leaves a different tree and was rejected.
   *
   * EVERY decision arrives here already taken. `speakerLabel` is the shared
   * resolver's verdict, `timestamps` and `edit` are hoisted once by
   * renderTranscript, `edited` is the state module's own derived answer, and
   * `names` is the state module's map read once per render; this function
   * reads no module variable, so there is exactly one place per decision that
   * can be wrong.
   *
   * `names` IS A DECISION IN THE SAME SENSE AS THE OTHERS, and it is hoisted
   * for a second reason on top of that one: `speakerNames()` returns a FRESH
   * COPY of the map on every call, so reading it per row would allocate 657
   * objects per render. Both callers read it once and hand it down.
   *
   * IT IS THE ONLY ROW BUILDER, AND THAT MUST STAY TRUE. A committed edit
   * patches one row by calling this function again for that phrase and
   * replacing the node — see patchRow. Writing a second, smaller builder for
   * the patch path is how the patched row and the rendered row come to differ
   * in a way nobody notices until a reader hears it.
   *
   * `selected` IS A DECISION IN THE SAME SENSE AS THE OTHERS, AND IT ARRIVES AS
   * A BOOLEAN RATHER THAN AS THE SET — which is a deliberate divergence from
   * `names`, so it is written down. `names` has to be the map because the
   * lookup happens inside `speakerLabelText`, and it is hoisted because
   * `speakerNames()` allocates a fresh copy per call. Neither applies here:
   * `selectedRows.has(index)` is O(1) and allocates nothing, so both callers
   * hoist the Set once outside their loop and hand down its answer for the row.
   * That keeps this function free of the one thing it must not do, which is
   * decide anything.
   *
   * `reassigned` IS THE SEVENTH DECISION AND IT ARRIVES AS A BOOLEAN TOO
   * (register item 46 unit 7b), AND SINCE REPAIR UNIT R2 ITS CALLERS COMPUTE IT
   * THE SAME WAY THEY COMPUTE `edited`:
   *
   *   `edited`      every caller asks the state module: `state.isEdited(index)`
   *   `reassigned`  every caller asks the state module: `state.isReassigned(index)`
   *
   * THE ASYMMETRY THAT USED TO BE HERE IS THE PART WORTH KEEPING A RECORD OF.
   * Unit 7b built `reassigned` as a LOCAL COPY of the state module's comparison
   * — `speaker !== sourceSpeaker`, in a helper named `phraseIsReassigned` — on
   * its dispatch's instruction, whose ground was that `isReassigned` runs
   * `assertLoaded` and `assertIndex` 657 times per render. That unit said in
   * terms that the ground was weak, because `isEdited` already does exactly
   * that on every render and nothing has complained, and it FLAGGED the
   * divergence for the desk instead of settling it.
   *
   * THE DESK RULED FOR THE PRINCIPLE renderTranscript's own comment states:
   * "The corrected verdict is asked of the STATE MODULE per row rather than
   * derived here ... copying a rule is the defect `speakerLabelFor` exists to
   * prevent." The module owns its derivations; this file asks. So the helper is
   * deleted and the three callers name the module directly.
   *
   * WHAT THE RULING COST, STATED BECAUSE 7b PRICED IT AT ONE LINE AND IT WAS
   * MORE. The helper took the PHRASE, so retiring it moved its three callers as
   * well as the helper, and renderTranscript needed the null-state ternary
   * `edited` already carries — a detail a phrase-based comparison never had to
   * have, because it resolved no module. The estimate was made in good faith
   * from the right observation (the copy was confined to one function) and was
   * wrong about the blast radius, which is worth knowing next time a divergence
   * is left standing on the strength of being cheap to undo.
   *
   * @param {object} phrase - a normalised phrase
   * @param {number} index - its position, for the stable id
   * @param {number|null} speakerLabel - the resolver's verdict, already taken
   * @param {{timestamps: boolean, edit: boolean, edited: boolean,
   *   names?: Object<string, string>, selected?: boolean,
   *   reassigned?: boolean}} options - display decisions, the corrected
   *   verdict, the names map, the selected verdict and the moved verdict, all
   *   already taken. `names` defaults to an empty map and `selected` and
   *   `reassigned` to false, so a caller that omits any of them produces
   *   exactly the output this function produced before the unit that added it.
   * @returns {HTMLLIElement}
   */
  function buildRow(
    phrase,
    index,
    speakerLabel,
    { timestamps, edit, edited, names = {}, selected = false, reassigned = false },
  ) {
    const row = document.createElement("li");
    row.id = ROW_ID_STEM + index;
    row.className = CLASS_ROW;

    // THE SELECTION CHECKBOX, IN EDIT MODE ONLY, AND FIRST IN THE ROW. See the
    // doc comment's row order for why it leads rather than follows. In
    // read-only mode no checkbox exists — not a disabled one and not a hidden
    // one — because a person reading a transcript is not selecting anything,
    // which is the owner's own decision recorded in the design's section 3.
    //
    // THE " " TEXT NODE CLOSES THE PAIR AND MATCHES <time> AND THE SPEAKER
    // SPAN, and it is needed for the same reason theirs are: the checkbox is
    // VISIBLE, so with no separator it butts against the timecode on screen.
    // The label contributes no separator of its own because `.visually-hidden`
    // positions it absolutely and it leaves the inline flow entirely — the
    // measured side effect recorded under CORRECTED_MARKER_TEXT — which is also
    // why moving it to the far side of the box changes nothing on screen.
    //
    // THE INPUT PRECEDES ITS LABEL, WHICH IS THE OPPOSITE OF WHAT THIS COMMENT
    // SAID UNTIL REPAIR UNIT R1. The withdrawn text read: "THE LABEL PRECEDES
    // THE INPUT, matching the edit control below rather than tools.html's own
    // checkboxes, which put a VISIBLE label after the box. Association is by
    // `for`/`id` and works either way; what matters is that this function has
    // one convention rather than two." Quoted in place per register items 51
    // and 56, because it is a comment a measurement has contradicted.
    //
    // Its reasoning was sound and its conclusion was wrong. Association does
    // work either way, and one convention IS better than two — but the one it
    // picked is a WCAG failure for this control type, and tools.html's three
    // display-option checkboxes were the ones already right. IBM's
    // `input_label_after` applies to checkboxes and radios only: a label before
    // a text input is ordinary, a label before a checkbox is not, so the edit
    // control below keeps label-first and this one does not. That is TWO
    // conventions, deliberately, decided by the control type rather than by
    // this function's own tidiness. Unit I2's driven audit measured 657 of
    // these, one per row, in every edit state.
    //
    // THE CONTROL IS NAMED BY A REAL <label for>, NOT BY aria-label, for the
    // reason the edit control's own note gives: AGENTS.md's first rule of ARIA
    // is native HTML first, and the label happens to be visually hidden rather
    // than absent.
    //
    // NOTHING IS ANNOUNCED WHEN IT IS TICKED. The box conveys its own state
    // through the browser, which is native feedback and not an announcement
    // this file makes; the count elsewhere is silent text. No live region is
    // added here or anywhere in this chain. Listen row 49 part (b) judges both
    // the wording and the tab burden — see SELECT_LABEL_PREFIX.
    if (edit) {
      const selectId = SELECT_ID_STEM + index;

      // `type` before anything else, for the reason the edit control's own
      // comment gives: a control's type governs how its value and its checked
      // state are handled, so it is set first.
      const box = document.createElement("input");
      box.setAttribute("type", "checkbox");
      box.id = selectId;
      box.className = CLASS_SELECT;
      // The tick is restored from the decision handed in, never assumed false.
      // A re-render that dropped it would silently discard a selection — see
      // renderTranscript and patchRow, where the two callers read it.
      box.checked = selected;
      row.appendChild(box);

      const selectLabel = document.createElement("label");
      selectLabel.className = CLASS_VISUALLY_HIDDEN;
      selectLabel.setAttribute("for", selectId);
      selectLabel.appendChild(
        document.createTextNode(`${SELECT_LABEL_PREFIX}${index + 1}`),
      );
      row.appendChild(selectLabel);

      row.appendChild(document.createTextNode(" "));
    }

    // <time> carries the machine-readable offset in `datetime` and the reading
    // clock as its text. It is built ONLY when timestamps are shown, together
    // with the " " text node after it: with the box unchecked neither exists,
    // so the row begins with the speaker span or the phrase text (item 54).
    //
    // CORRECTED: this comment previously read "It has NO implicit ARIA role —
    // it computes as generic". That is FALSE. Unit 43.4's own CDP reading, on
    // a rendered 658-row transcript, measured role "time" and ignored false —
    // its OWN node in the accessibility tree, unlike the two spans beside it,
    // which come back ignored as "uninteresting". The wrong text was written
    // from expectation before the drive and not corrected after it.
    //
    // It matters because it points a reader away from the live question: a
    // timecode that is its own node, leading every row, is exactly what
    // owed-listen row 40 (a) asks a person to judge — orientation or
    // obstruction. The old wording would have ruled that out before anybody
    // listened. Row 40 judged it orientation; the checkbox that removes it is
    // item 54's answer, and row 42 (a) and (b) hear both states.
    if (timestamps) {
      const time = document.createElement("time");
      time.className = CLASS_TIME;
      time.setAttribute("datetime", toIsoDuration(phrase.offsetMs));
      time.appendChild(
        document.createTextNode(`[${toClockText(phrase.offsetMs)}]`),
      );
      row.appendChild(time);
      row.appendChild(document.createTextNode(" "));
    }

    // The speaker span exists only when the shared resolver says a label is
    // wanted. `speakerLabel` is already its verdict — this function does not
    // re-decide, because re-deciding here would be the fourth copy of the rule.
    //
    // The `typeof` test is the UNDEFINED GUARD, and it lives here rather than
    // in the resolver on purpose. A phrase whose `speaker` key is absent makes
    // both formatters emit "Speaker undefined:", which is HEAD's behaviour and
    // must not change — the downloaded .txt and .srt are byte-identical to what
    // they have always been, and gate B4 proves it across seven fixtures. That
    // defect is registered separately. It must not reach the SCREEN, though, so
    // the shape is refused at this boundary, where refusing it costs nothing.
    // `normaliseSpeechResponse` cannot produce it today; the OpenRouter second
    // backend named at register item 35 (i) fills the same { text, phrases }
    // contract and could.
    //
    // THE NAME IS COMPOSED INSIDE THIS BRANCH AND NEVER BEFORE IT, which is a
    // requirement rather than a tidiness (item 46 unit 4a). The `typeof` test
    // above IS the undefined guard, and `speakerDisplayName` deliberately falls
    // through to "Speaker undefined" for a phrase with no `speaker` key — its
    // own notes call that a requirement, because both formatters emit exactly
    // that today and unit 5 routes them through the same function, so guarding
    // it there would move a downloaded byte. Composing ahead of this branch
    // would therefore put "Speaker undefined:" on the SCREEN and undo the guard
    // silently, with nothing in the markup to show what had happened.
    if (speakerLabel !== null && typeof speakerLabel === "number") {
      const speaker = document.createElement("span");
      speaker.className = CLASS_SPEAKER;
      speaker.appendChild(
        document.createTextNode(speakerLabelText(speakerLabel, names)),
      );
      row.appendChild(speaker);
      row.appendChild(document.createTextNode(" "));
    }

    // THE CORRECTED MARKER, IN READ-ONLY MODE ONLY — CHANGED AT UNIT 8, and the
    // change is a narrowing rather than a removal. It used to render in BOTH
    // modes. In edit mode the control's own accessible name now carries the
    // state (see EDIT_LABEL_CORRECTED_SUFFIX), because a person moving by
    // control never reaches a sibling span; rendering both would say
    // "corrected" twice on one row. So the rule is ONE MARKER PER ROW PER MODE,
    // and this is the read-only half of it.
    //
    // LISTEN ROW 47 (e) IS UNAFFECTED AND WAS THE REASON FOR THE OLD SHAPE. It
    // unticks the box with a correction on screen and expects the marker still
    // there — which is the read-only state, exactly what this branch builds.
    // The withdrawn text read "IN BOTH MODES … a marker gated on edit mode
    // would fail that part by construction"; the second half of that sentence
    // is still true and is why the gating is on `!edit` rather than on `edit`.
    //
    // It is visually-hidden text, so it costs the screen nothing and a reader
    // hears it on arrival. It is never announced when a row BECOMES corrected —
    // see CORRECTED_MARKER_TEXT. THAT SILENCE STANDS AT UNIT 8: listen row 47
    // part (c) was heard on 13 September 2026 and narrowed to register items 45,
    // 47 and 48 rather than closing, and THIS MARKER IS ITEM 45's. Only item
    // 46's four gestures gained a voice.
    if (edited && !edit) {
      const marker = document.createElement("span");
      marker.className = `${CLASS_CORRECTED} ${CLASS_VISUALLY_HIDDEN}`;
      marker.appendChild(document.createTextNode(CORRECTED_MARKER_TEXT));
      row.appendChild(marker);
      row.appendChild(document.createTextNode(" "));
    }

    // THE MOVED MARKER, IN READ-ONLY MODE ONLY (register item 46 unit 7b) —
    // the same shape, the same gating and the same reasons as the corrected
    // marker immediately above, so none of them is restated. See
    // REASSIGNED_MARKER_PREFIX for the word, the one-marker-per-row-per-mode rule
    // and why the order on a row that is both is corrected-then-moved.
    //
    // IT FOLLOWS THE CORRECTED MARKER AND PRECEDES THE TEXT. Both markers sit
    // after the speaker span and before the words, so a reader is oriented
    // before the phrase arrives rather than after it. CORRECTED_MARKER_TEXT
    // records that the position is a decision open to the sitting and not one
    // the build settles; that stands for this marker too, and listen row 49
    // part (c) is where both are heard.
    if (reassigned && !edit) {
      const marker = document.createElement("span");
      marker.className = `${CLASS_REASSIGNED} ${CLASS_VISUALLY_HIDDEN}`;
      // THE SOURCE SLOT IS READ OFF THE PHRASE, NOT OFF THE VERDICT. The
      // verdict is a boolean the state module supplies; the WORDS need the slot
      // the transcription put the line in, which only the phrase carries.
      marker.appendChild(
        document.createTextNode(
          reassignedMarkerText(
            phrase.sourceSpeaker,
            names,
            REASSIGNED_MARKER_PREFIX,
            REASSIGNED_MARKER_SUFFIX,
          ),
        ),
      );
      row.appendChild(marker);
      row.appendChild(document.createTextNode(" "));
    }

    // THE PHRASE, AS EITHER A SPAN OR A SINGLE-LINE TEXT INPUT — the one and
    // only difference edit mode makes to a row. There are no per-row buttons:
    // no pencil, no save, no revert affordance, because 657 rows times any
    // number of buttons is a different document to browse, which is the
    // substance of listen row 47 (a).
    //
    // IT WAS A <textarea> UNTIL UNIT 8, AND THE MEASUREMENT THAT CHANGED IT.
    // md-scripts/css/markdown-editor.css:241 is a BARE `textarea` element
    // selector setting `min-height: 200px`, and it is loaded on this page, so
    // every control inherited it: 657 controls made the transcript 146,871px
    // tall against a document scrollHeight of 148,480. That rule also sets
    // `font-family: inherit` and NOT `font-size`, so each control rendered at
    // the UA's 13.3333px textarea default rather than at the transcript's size.
    // Neither was a decision anybody took for this surface.
    //
    // A SINGLE LINE IS RIGHT ON THE DATA, NOT ONLY ON THE STYLING. Measured on
    // the committed 657-phrase fixture: ZERO phrases contain a carriage return
    // or a newline, the longest is 514 characters and the mean is 85. A phrase
    // is one utterance between two timecodes, so a multi-line control was
    // offering a shape the content cannot take — and a `<textarea>` also
    // accepts an Enter that a transcript row has no use for, which is what
    // frees Enter to mean COMMIT below.
    //
    // FIXING IT IN CSS WAS THE OTHER OPTION AND WAS REJECTED HERE. This unit is
    // one file and adds no CSS; more to the point, overriding a bare element
    // selector from a foreign stylesheet is a specificity argument that a later
    // reader has to re-derive, where choosing an element that rule does not
    // match is simply out of its way. How the input should LOOK is still a
    // later decision and is deliberately not made here by an inline style.
    //
    // THE TIME AND SPEAKER PARTS ABOVE ARE UNTOUCHED BY THE MODE. Neither is
    // editable and neither may become unreachable because the thing beside it
    // became a control — listen row 47 (a) reads exactly that.
    //
    // THE CONTROL IS NAMED BY A REAL <label for>, NOT BY aria-label. AGENTS.md's
    // first rule of ARIA is to use native HTML first, and the label happens to
    // be visually hidden rather than absent — the association is the ordinary
    // one, and a reader gets a name from semantic HTML.
    //
    // THE VALUE GOES THROUGH `.value`, never innerHTML, for the same reason
    // every other string here goes through a text node: a transcript is
    // somebody's SPEECH, and a phrase containing angle brackets must stay a
    // phrase containing angle brackets. `.value` on an input is a string
    // property with no parse step at all, so there is nothing to escape.
    if (edit) {
      const editId = EDIT_ID_STEM + index;

      // The label text is the whole of the control's accessible name, and the
      // corrected state is part of it (see EDIT_LABEL_CORRECTED_SUFFIX). It is
      // composed here because this is the only place that knows both the index
      // and the verdict, and both arrive already decided.
      // THE MOVED STATE JOINS IT AT ITEM 46 UNIT 7b, on exactly the terms the
      // corrected state already has: the label is the whole of the control's
      // accessible name, and both states are part of it. A row that is both
      // reads "Edit phrase 12, corrected, speaker changed from Speaker 2" —
      // the order fixed, and fixed here, because this is the only place both
      // verdicts are in hand. See REASSIGNED_MARKER_PREFIX for why corrected
      // comes first. (The withdrawn line read "Edit phrase 12, corrected,
      // moved"; the wording changed at unit 8 and the ORDER did not.)
      //
      // THE COMMAS ARE DOING THE SAME WORK THE FIRST ONE DOES. They are what
      // stops the name reading as an instruction, and they are what gives a
      // reader something to pause on between three facts about one control.
      const label = document.createElement("label");
      label.className = CLASS_VISUALLY_HIDDEN;
      label.setAttribute("for", editId);
      label.appendChild(
        document.createTextNode(
          `${EDIT_LABEL_PREFIX}${index + 1}` +
            (edited ? EDIT_LABEL_CORRECTED_SUFFIX : "") +
            (reassigned
              ? reassignedMarkerText(
                  phrase.sourceSpeaker,
                  names,
                  EDIT_LABEL_REASSIGNED_PREFIX,
                  "",
                )
              : ""),
        ),
      );
      row.appendChild(label);

      // `type` is set BEFORE the value, which is not stylistic. An input's type
      // governs how a value is parsed and stored, so setting the value first
      // and the type afterwards is the ordering that can lose it.
      const field = document.createElement("input");
      field.setAttribute("type", "text");
      field.id = editId;
      field.className = `${CLASS_TEXT} ${CLASS_EDIT}`;
      field.value = phrase.text;
      row.appendChild(field);

      return row;
    }

    const text = document.createElement("span");
    text.className = CLASS_TEXT;
    text.textContent = phrase.text;
    row.appendChild(text);

    return row;
  }

  /**
   * Render a whole result into #transcribe-transcript as an ordered list.
   *
   * NO LIVE REGION AND NO LIVENESS BY ANY ROUTE, checked per element rather
   * than assumed. The host stays a <div> (generic). The list is <ol> (list) and
   * each row <li> (listitem); <time> and <span> are generic. None of those
   * names supplies liveness, and nothing here sets a role, aria-live,
   * aria-atomic or aria-busy. An <ol> is chosen over a bare stack of divs
   * because it lets a reader hear how many phrases there are and move through
   * them one at a time — which is the substance of owed-listen row 40 (a).
   *
   * THE LIST IS BUILT DETACHED AND ATTACHED ONCE. Appending each row to a live
   * <ol> would touch the document 658 times for the largest transcript ever
   * measured; building into a fragment touches it once.
   *
   * WHAT REPLACES setText's WRITE-IF-CHANGED GUARD: nothing does, and that is
   * acceptable here for a stated reason rather than by omission. That guard
   * exists because an identical-value textContent write is a REAL mutation
   * arriving as childList, so it would be visible to any observer and audible
   * if the target ever gained a role. Here the whole subtree is replaced
   * wholesale, so a "did it change" comparison would mean diffing an entire
   * rendered list against a result — more expensive than the render it guards,
   * and it would still not make the write silent. What makes it safe is the
   * other half of that rule: this subtree is NOT a live region and has no live
   * ancestor, verified by accessibility-tree reading rather than from the
   * markup. If a role is ever added anywhere in this chain, this decision has
   * to be revisited, and that is what this paragraph exists to tell whoever
   * adds it.
   *
   * @param {object} result - a normalised result
   */
  function renderTranscript(result) {
    const host = el("transcribe-transcript");
    if (!host) {
      logError("cannot render — #transcribe-transcript is missing");
      return;
    }

    const api = moduleOrNull();
    if (!api) {
      logError("cannot render — the transcribe module is missing");
      return;
    }

    const phrases = result && Array.isArray(result.phrases) ? result.phrases : [];

    // No phrase breakdown: fall back to the combined text, as toPlainText does,
    // so the two surfaces agree on what an unstructured result looks like.
    if (phrases.length === 0) {
      host.replaceChildren();
      const fallback = document.createElement("p");
      fallback.className = CLASS_TEXT;
      fallback.textContent = (result && result.text) || "";
      host.appendChild(fallback);
      logInfo("rendered a combined-text transcript with no phrase breakdown");
      return;
    }

    // Hoisted ONCE for the whole result, never per phrase — the same discipline
    // the two formatters follow, reaching the same exported function so the
    // screen and the downloads cannot disagree about whether labels are
    // informative.
    const labelsAreInformative = api.distinctSpeakerCount(result) > 1;
    const mode = showSpeakerOnEveryLine
      ? api.SPEAKER_LABEL_MODE.EVERY_LINE
      : api.SPEAKER_LABEL_MODE.ON_CHANGE;
    // Read the timestamps state ONCE here and hand it down, for the same reason
    // the label decision is hoisted: buildRow takes decisions, it does not make
    // them, and a per-row read of a module variable would be a second place
    // for the rule to live. This is the only line in the render path that
    // reads `showTimestamps`.
    const timestamps = showTimestamps;
    // Hoisted for the same reason, and it is the only line in the render path
    // that reads `editMode`.
    const edit = editMode;
    // The corrected verdict is asked of the STATE MODULE per row rather than
    // derived here from `phrase.text !== phrase.sourceText`. That comparison is
    // the state module's own rule (`isEdited`, "a derived answer, never a
    // stored flag"), and copying a rule is the defect `speakerLabelFor` exists
    // to prevent. `state` is resolved once outside the loop, never per row.
    const state = stateOrNull();
    // The names map, hoisted for the same reason as everything above it AND for
    // one of its own: `speakerNames()` returns a FRESH COPY on every call, so a
    // per-row read would allocate 657 objects per render for a map that cannot
    // change mid-render.
    //
    // THE isLoaded() GUARD IS REQUIRED, NOT DEFENSIVE. `speakerNames()` throws
    // ERRORS.NOT_LOADED, and this function already tolerates a null state one
    // line above — it renders with `edited: false` rather than refusing. That
    // tolerance has to survive, so the empty map is the same answer in the same
    // shape: no names, every slot printing its number, which is byte-for-byte
    // what this renderer produced before item 46 unit 4a.
    const names = state && state.isLoaded() ? state.speakerNames() : {};
    // The selection, hoisted ONCE for the same reason as everything above it.
    // It is the Set itself rather than a copy, because nothing in the loop
    // writes to it and `has` allocates nothing; what `buildRow` receives is the
    // per-row boolean, never the Set — see its doc comment for why that
    // diverges from `names`.
    //
    // RESTORING THE TICKS ON A RE-RENDER IS REQUIRED, NOT A NICETY. Every one
    // of the three display handlers calls this function, so without this line
    // a person who ticked twelve lines and then toggled "Show timestamps"
    // would have the selection silently discarded — and with the count
    // rewritten from an emptied Set there would be nothing on screen to say it
    // had happened. That is the worse failure: not a wrong count, but a correct
    // count for a state the person did not ask for.
    const selection = selectedRows;

    const list = document.createElement("ol");
    list.className = CLASS_LIST;

    // role="list" IS REDUNDANT HERE IN CHROME, AND IS NOT THERE FOR CHROME.
    // AGENTS.md's first rule of ARIA is to use native HTML first, so a
    // redundant role on an <ol> reads as noise a later reader will delete. It
    // is deliberate, and this comment is what stops that deletion.
    //
    // transcribe.css styles this list `list-style: none`, and WebKit is known
    // to drop the implicit list/listitem semantics from a list styled that
    // way. Chrome WAS measured with that rule in force, on a rendered 658-row
    // transcript, and keeps them — list 1, listitem 658, unchanged by adding
    // this attribute. SAFARI AND iOS HAVE NOT BEEN MEASURED, here or anywhere
    // in this repo, and nothing about this line should be read as covering
    // them.
    //
    // So this is an UNMEASURED PRECAUTION against a behaviour measured
    // elsewhere, NOT a repair of anything observed in this project. Saying so
    // matters: a future reader who takes it for a verified fix will not think
    // to measure WebKit, which is the only place it can earn its keep.
    //
    // Owed-listen row 40 (a) asks whether a reader announces the list and its
    // length on entry. A platform-dependent loss of list semantics would sit
    // inside exactly that clause, which is why the precaution is taken before
    // the sitting rather than after it.
    list.setAttribute("role", "list");

    const fragment = document.createDocumentFragment();
    phrases.forEach((phrase, index) => {
      const speakerLabel = api.speakerLabelFor({
        speaker: phrase.speaker,
        previousSpeaker: api.previousSpeakerAt(phrases, index),
        labelsAreInformative,
        mode,
      });
      fragment.appendChild(
        buildRow(phrase, index, speakerLabel, {
          timestamps,
          edit,
          edited: state ? state.isEdited(index) : false,
          names,
          selected: selection.has(index),
          // ASKED OF THE STATE MODULE, EXACTLY AS `edited` IS (repair unit R2).
          // Unit 7b read this off the phrase instead and flagged the divergence
          // from the line six above; the desk ruled for the principle that
          // comment states, so the two now match in shape as well as in intent.
          //
          // THE NULL-STATE TERNARY IS REQUIRED AND IS NOT DECORATION. This
          // function tolerates a missing state module and renders with
          // `edited: false`; a bare `state.isReassigned(index)` would throw on
          // that path and take the whole render with it. The cost of asking the
          // module rather than the phrase is precisely this: the answer is no
          // longer available when the module is absent, and `false` is the same
          // answer `edited` gives there.
          reassigned: state ? state.isReassigned(index) : false,
        }),
      );
    });
    list.appendChild(fragment);

    host.replaceChildren(list);
    logInfo(
      `rendered ${phrases.length} phrase rows (mode: ${mode}, edit: ${edit})`,
    );
  }

  /**
   * Rebuild ONE row in place, after its phrase text changed.
   *
   * A PATCH, NOT A RENDER. The rest of the list keeps its node identity, so a
   * reader's position in the transcript is not disturbed and the list does not
   * re-announce its length — which is exactly what listen row 47 (b) reads for.
   * Calling renderTranscript here would be correct and would fail that part.
   *
   * IT GOES THROUGH buildRow. Every decision the renderer takes is retaken here
   * from the same sources — the shared speaker resolver with the same hoisted
   * `labelsAreInformative`, the same two display flags, the state module's own
   * corrected verdict, its names map and the selected verdict — so a patched
   * row is byte-for-byte the row a full render would have produced.
   *
   * THE NAMES MAP WAS ADDED TO THAT LIST AT ITEM 46 UNIT 4a, and the sentence
   * above previously ended at "corrected verdict". It is recorded rather than
   * quietly widened because the list is the whole claim this function makes: a
   * decision the renderer takes and this function does not is exactly how a
   * patched row comes to differ from a rendered one, and the list is where a
   * reader checks that it has not happened.
   *
   * THE SELECTED VERDICT JOINED IT AT ITEM 46 UNIT 6, on exactly those terms,
   * and the sentence above now reads "its names map and the selected verdict".
   * It is the sixth decision and the list is six long.
   *
   * THE MOVED VERDICT JOINED IT AT ITEM 46 UNIT 7b, AND THE LIST IS SEVEN
   * LONG. The paragraph above now stops being literally true about the
   * sentence it quotes, which is why it is left standing rather than edited:
   * each of these paragraphs records one unit's addition, and rewriting an
   * earlier one to mention a later addition would destroy the record of which
   * unit added what. The seven are the speaker resolver's verdict, the two
   * display flags, the corrected verdict, the names map, the selected verdict
   * and the moved verdict.
   *
   * THE SEVENTH IS NOW RETAKEN FROM THE SAME SOURCE AS THE FOURTH, AND THE
   * QUALIFICATION THAT SAT HERE IS GONE (repair unit R2). Both `edited` and
   * `reassigned` are asked of the state module, so this function's claim is
   * unqualified: every one of the seven decisions is retaken from the source
   * renderTranscript takes it from.
   *
   * IT WAS NEVER A THREAT TO THE BYTE-FOR-BYTE CLAIM, and that is worth keeping
   * rather than deleting with the qualification. While `reassigned` was read
   * off the phrase, renderTranscript read it off the phrase too — what makes a
   * patched row match a rendered one is that both callers AGREE, not which
   * source they agree on. The ruling improves where the rule lives; it did not
   * repair a mismatch, because there was not one.
   *
   * FOCUS IS PLACED EXPLICITLY, AND THE GUARD ON IT IS MEASURED RATHER THAN
   * REASONED. The node the control lived on has been removed, so focus would
   * otherwise be left on <body> — and Chrome resets the sequential focus
   * navigation start point when the focused element is removed, so the person's
   * next Tab restarts at the top of the whole page rather than at the next row.
   * That is the harm this placement prevents.
   *
   * BUT AN UNCONDITIONAL PLACEMENT UNDOES THE GESTURE THAT COMMITTED THE EDIT,
   * because a blur `change` fires as part of LOSING focus. Measured 8 September
   * 2026 on the textarea this row then carried, headless chromium-1223, typing
   * into row 0 and pressing Tab: `document.activeElement` inside the change
   * handler is **BODY** — not the old control, and not yet the Tab's
   * destination. A synchronous "was focus here or nowhere" test therefore reads
   * TRUE on an ordinary Tab, and an early build of this function duly dragged
   * focus back to row 0 from the row the person had just moved to. The premise
   * that focus is lost is right; the synchronous reading cannot tell a loss
   * from a handover in progress.
   *
   * UNIT 8 REPLACED THE textarea WITH AN `<input type="text">` AND RE-MEASURED
   * RATHER THAN ASSUMING THE READING CARRIED OVER — the element changed, and
   * this whole guard rests on one observation about that element's event
   * timing. Re-measured 9 September 2026 on the input, same machine, same
   * headless build, same gesture: `document.activeElement` inside the change
   * handler is **BODY** again, and the Tab still lands on the next row's
   * control and stays there.
   *
   * SO THE DECISION IS DEFERRED ONE FRAME, and taken only if nothing else has
   * claimed focus by then. Three cases, and each is named in the code below:
   * the control still held focus (a commit that did not move it — place focus
   * at once, nothing is competing); focus is adrift on <body> (undecided —
   * ask again next frame); or something else already has it (leave it alone).
   *
   * THE ENTER COMMIT TAKES THE FIRST CASE. Enter is handled on `keydown`, while
   * the control still has focus, so `heldFocus` is true and focus is placed at
   * once on the rebuilt row's control — the person stays on the row they
   * corrected. That is not a second focus rule; it is this one, reached by a
   * gesture that does not move focus.
   *
   * NOTHING IS ANNOUNCED BY THE REPAINT ITSELF. No toast, no announcer call,
   * no live region, no liveness added anywhere in this chain — and that is
   * UNCHANGED at unit 8. What gained a voice is the GESTURE, at its own
   * handler, once per gesture; a repaint is not an event a person performed and
   * has nothing of its own to say. Listen row 47 part (c) was heard on
   * 13 September 2026; see THE FOUR SPOKEN GESTURES for what it decided and how
   * far it reached.
   *
   * @param {number} index - the row to rebuild
   */
  function patchRow(index) {
    const api = moduleOrNull();
    const state = stateOrNull();
    const old = el(ROW_ID_STEM + index);
    if (!api || !state || !old) {
      logWarn(`cannot patch row ${index} — the row, module or state is missing`);
      return;
    }

    const result = currentResult();
    const phrases = result && Array.isArray(result.phrases) ? result.phrases : [];
    const phrase = phrases[index];
    if (!phrase) {
      logWarn(`cannot patch row ${index} — no such phrase`);
      return;
    }

    const speakerLabel = api.speakerLabelFor({
      speaker: phrase.speaker,
      previousSpeaker: api.previousSpeakerAt(phrases, index),
      labelsAreInformative: api.distinctSpeakerCount(result) > 1,
      mode: showSpeakerOnEveryLine
        ? api.SPEAKER_LABEL_MODE.EVERY_LINE
        : api.SPEAKER_LABEL_MODE.ON_CHANGE,
    });

    // Read BEFORE the replacement: afterwards the old node is detached and the
    // comparison can no longer be made.
    const active = document.activeElement;
    const heldFocus = old.contains(active);
    const focusIsAdrift = active === null || active === document.body;

    // The names map, read here for the same reason renderTranscript reads it:
    // buildRow takes decisions and does not make them. THIS LINE IS THE ONE
    // MOST EASILY LEFT OUT, and leaving it out has a visible defect rather than
    // a silent one — a committed text correction on a NAMED row would rebuild
    // that row reading `Speaker N:` while every other row in the same slot kept
    // its name, so one row in 657 would disagree with the rest. `state` is
    // resolved and the guard above returned on a missing one; `isLoaded()` is
    // still asked because `speakerNames()` throws ERRORS.NOT_LOADED.
    const names = state.isLoaded() ? state.speakerNames() : {};

    // THE SELECTION, AND THIS LINE HAS THE SAME STANDING AS THE ONE ABOVE IT:
    // IT IS THE ONE MOST EASILY LEFT OUT AND ITS OMISSION IS VISIBLE, NOT
    // SILENT. Committing a text correction on a TICKED row would rebuild that
    // row unticked while every other selected row stayed ticked — so one row
    // in 657 would drop out of the selection at the exact moment the person
    // was working on it, and the count would disagree with the boxes. Nothing
    // in the gesture would say so. Check 6 of this unit's sheet reads for it,
    // through the shipped Enter commit rather than by calling this function.
    const selected = selectedRows.has(index);

    // THE MOVED VERDICT, AND IT IS THE SEVENTH DECISION — the list this
    // function's doc comment keeps is now seven long. It is ASKED OF THE STATE
    // MODULE, the same way `edited` is on the line below; repair unit R2
    // settled that, and the `state` here is non-null because this function's
    // own guard returned on a missing one, so no ternary is needed.
    //
    // ITS OMISSION WOULD BE VISIBLE RATHER THAN SILENT, like the two lines
    // above it: committing a text correction on a MOVED row would rebuild that
    // row without its Moved. marker while every other moved row kept one, so
    // one row in 657 would stop saying it had been moved at the exact moment
    // the person was working on it.
    const reassigned = state.isReassigned(index);

    old.replaceWith(
      buildRow(phrase, index, speakerLabel, {
        timestamps: showTimestamps,
        edit: editMode,
        edited: state.isEdited(index),
        names,
        selected,
        reassigned,
      }),
    );

    if (heldFocus) {
      placeFocusOnRow(index);
      return;
    }

    if (focusIsAdrift) {
      // Undecided. See the doc comment: a Tab out of the row reads exactly like
      // a loss at this instant, and only the next frame can tell them apart.
      requestAnimationFrame(() => {
        const settled = document.activeElement;
        if (settled === null || settled === document.body) {
          placeFocusOnRow(index);
          return;
        }
        logDebug(
          `patched row ${index}; focus had already moved to ${settled.id || settled.tagName}`,
        );
      });
      return;
    }

    logDebug(`patched row ${index}; focus left where the person moved it`);
  }

  /**
   * Rebuild SEVERAL rows in place, after a reassignment moved them
   * (register item 46 unit 7b).
   *
   * A PLURAL SIBLING OF patchRow, NOT A LOOP OVER IT, AND THAT IS THE WHOLE
   * REASON THIS FUNCTION EXISTS. patchRow recomputes
   * `api.distinctSpeakerCount(result)` inside its own body, once per call — a
   * full scan of every phrase in the transcript. Looping it over a move of 100
   * rows would be 100 full scans, quadratic on exactly the transcripts that
   * most need not to be. Design section 4 names this as the trap it was written
   * around, the state module's `setSpeaker` carries the same warning at the
   * point a caller gets the index set, and this is the third place it is said
   * because it is the place that would pay for it.
   *
   * SO EVERY DECISION IS HOISTED ONCE FOR THE WHOLE BATCH — the module, the
   * state, the result, `labelsAreInformative`, the label mode, both display
   * flags, the names map and the selection — and the loop does nothing but
   * build a row and swap a node. That is the same hoisting renderTranscript
   * does, over a subset of rows instead of all of them.
   *
   * IT GOES THROUGH buildRow, LIKE EVERY OTHER ROW IN THIS FILE. buildRow's own
   * notes require it: writing a second, smaller builder for a batch path is how
   * a patched row and a rendered row come to differ in a way nobody notices
   * until a reader hears it. Check 7 of this unit's console sheet reads a
   * patched row against a rendered one byte for byte, and it is the check that
   * would catch a divergence here.
   *
   * THE CALLER PASSES THE SET TO REPAINT, NOT THE SET THAT CHANGED, AND THE TWO
   * ARE DIFFERENT. `setSpeaker` returns the rows whose speaker actually moved;
   * under ON_CHANGE suppression a row's label decision reads its PREDECESSOR
   * through `previousSpeakerAt`, so moving row 12 can change whether row 13
   * prints a label at all. The caller widens the set by one per moved row; this
   * function does not widen it, because it has no way to know which of its
   * indices were moved and which were added as neighbours, and a function that
   * widened a widened set would reach further on every call.
   *
   * OUT-OF-RANGE AND MISSING ROWS ARE SKIPPED, NOT REFUSED. A neighbour index
   * one past the last row is the ordinary product of the widening above, and
   * the caller bounds it; a row whose node is absent is a render that has not
   * happened. Neither is a fault worth stopping a batch for, and both are
   * counted so the log line can report them.
   *
   * NO FOCUS PLACEMENT, AND IT IS NOT AN OMISSION. patchRow places focus
   * because the gesture that reaches it — a commit on blur or on Enter — starts
   * INSIDE the row being replaced. This function is reached from a button
   * OUTSIDE the list, so no row it replaces can hold focus, and the person
   * stays on the button they pressed. That is asserted in the console sheet
   * rather than defended with code for a case the gesture cannot produce.
   *
   * NOTHING IS ANNOUNCED. No toast, no announcer call, no live region, no
   * liveness added anywhere in this chain. Listen row 49 is what decides
   * whether that silence stays.
   *
   * @param {number[]} indices - the rows to rebuild, already widened by the
   *   caller. Duplicates and out-of-range values are tolerated.
   * @returns {{rebuilt: number, missing: number, outOfRange: number}}
   */
  function patchRows(indices) {
    const api = moduleOrNull();
    const state = stateOrNull();
    if (!api || !state) {
      logWarn("cannot patch rows — the module or state is missing");
      return { rebuilt: 0, missing: 0, outOfRange: 0 };
    }

    const result = currentResult();
    const phrases = result && Array.isArray(result.phrases) ? result.phrases : [];

    // HOISTED ONCE FOR THE WHOLE BATCH. Every line here is a decision patchRow
    // would retake per row; the expensive one is distinctSpeakerCount, and the
    // rest are hoisted beside it so no reader has to work out which is which.
    const labelsAreInformative = api.distinctSpeakerCount(result) > 1;
    const mode = showSpeakerOnEveryLine
      ? api.SPEAKER_LABEL_MODE.EVERY_LINE
      : api.SPEAKER_LABEL_MODE.ON_CHANGE;
    const timestamps = showTimestamps;
    const edit = editMode;
    const names = state.isLoaded() ? state.speakerNames() : {};
    const selection = selectedRows;

    let rebuilt = 0;
    let missing = 0;
    let outOfRange = 0;

    indices.forEach((index) => {
      const phrase = phrases[index];
      if (!phrase) {
        outOfRange += 1;
        return;
      }
      const old = el(ROW_ID_STEM + index);
      if (!old) {
        missing += 1;
        return;
      }
      const speakerLabel = api.speakerLabelFor({
        speaker: phrase.speaker,
        previousSpeaker: api.previousSpeakerAt(phrases, index),
        labelsAreInformative,
        mode,
      });
      old.replaceWith(
        buildRow(phrase, index, speakerLabel, {
          timestamps,
          edit,
          edited: state.isEdited(index),
          names,
          selected: selection.has(index),
          // Asked of the state module, matching the `edited` line above it
          // (repair unit R2). `state` is non-null — this function's own guard
          // returned on a missing one and `state.isLoaded()` is read above.
          reassigned: state.isReassigned(index),
        }),
      );
      rebuilt += 1;
    });

    logDebug(
      `patched ${rebuilt} row(s); ${missing} had no node, ${outOfRange} were out of range`,
    );
    return { rebuilt: rebuilt, missing: missing, outOfRange: outOfRange };
  }

  /**
   * Put focus on a row's edit control, by the id derived from its index.
   *
   * BY ID, NOT BY A HELD REFERENCE. patchRow replaced the node, so a reference
   * taken before the patch points at a detached element that can be focused and
   * will do nothing. Deriving the id is what makes the placement survive the
   * replacement, and it is the reason the ids are stable in the first place.
   *
   * IT IS THE EDIT CONTROL, AND SINCE ITEM 46 UNIT 6 THAT IS A CHOICE BETWEEN
   * TWO. A row in edit mode now carries a selection checkbox as well, and the
   * checkbox comes FIRST in the row — so a placement written as "the first
   * control in the patched row" would land there and move a person out of the
   * box they had just typed in, into a control that does something else
   * entirely. EDIT_ID_STEM is named explicitly for that reason, and check 8 of
   * unit 6's sheet reads for it.
   */
  function placeFocusOnRow(index) {
    const control = el(EDIT_ID_STEM + index);
    if (!control) {
      logWarn(`row ${index} was patched but its edit control is missing`);
      return;
    }
    control.focus();
    logDebug(`row ${index}: focus placed on ${control.id}`);
  }

  /**
   * Show or hide the display-options block and each control inside it, and
   * keep both checkboxes in step with the module's own state.
   *
   * THREE `hidden` ATTRIBUTES, THREE PREDICATES, decided here and nowhere else
   * (register item 54, decided 5 September 2026):
   *
   *   - the WRAPPER shows whenever a transcript is on screen. A display option
   *     over nothing is withheld, which is what the reset and resting call
   *     sites pass `hasTranscript: false` for.
   *   - the SPEAKER control shows ONLY where speaker labels are informative —
   *     the same `distinctSpeakerCount > 1` predicate the renderer and both
   *     formatters use, moved from the wrapper to the control's own <div> so
   *     the wrapper can reveal for every transcript. A checkbox offering to
   *     hide labels that are already suppressed would do nothing, and offering
   *     it would be worse than omitting it — so it is withheld entirely rather
   *     than shown disabled. Owed-listen row 40 (d) heard that; row 42 (e)
   *     hears it again beside the timestamps control.
   *   - the TIMESTAMPS control is never hidden once the wrapper is shown: every
   *     row of every transcript carries a <time>, so the choice is always live.
   *
   * SILENT. Revealing or hiding a control is not an event that speaks: the
   * wrapper is not a live region, nothing here announces, and each checkbox
   * conveys its own state when a person reaches it.
   *
   * @param {object} options
   * @param {boolean} options.hasTranscript - is a transcript on screen
   * @param {boolean} options.labelsAreInformative - distinctSpeakerCount > 1
   */
  function setDisplayOptionsVisible({ hasTranscript, labelsAreInformative }) {
    const wrapper = el("transcribe-display-options");
    const speakerOption = el("transcribe-speaker-option");
    const timestampsOption = el("transcribe-timestamps-option");
    const speakerBox = el("transcribe-show-every-speaker");
    const timestampsBox = el("transcribe-show-timestamps");
    if (!wrapper) return;

    wrapper.hidden = !hasTranscript;
    if (speakerOption) speakerOption.hidden = !labelsAreInformative;
    if (timestampsOption) timestampsOption.hidden = false;
    if (speakerBox) speakerBox.checked = showSpeakerOnEveryLine;
    if (timestampsBox) timestampsBox.checked = showTimestamps;
    // The edit checkbox is kept in step the same way, but its WRAPPER is not
    // touched: `#transcribe-edit-option` carries no `hidden` in the markup and
    // this function does not give it one, so it shows whenever the group shows.
    // The mode is always live — every transcript has phrases to correct.
    const editBox = el("transcribe-edit-transcript");
    if (editBox) editBox.checked = editMode;
  }

  // ==========================================================================
  // THE SELECTION BLOCK (register item 46 unit 6)
  // ==========================================================================

  /**
   * Reveal or hide the selection block.
   *
   * A FOURTH FUNCTION BESIDE THE OTHER THREE, NEVER A PREDICATE INSIDE ANY OF
   * THEM. `setDisplayOptionsVisible` carries a documented three-predicate
   * contract belonging to register item 54, and `setSpeakerNamingVisible` has
   * its own single predicate; this block's is neither. The reasoning is the one
   * unit 4b gave for not folding naming in: a function whose contract is
   * written down is one a later reader can check, and a fourth predicate would
   * widen a contract rather than add one.
   *
   * THE PREDICATE IS `hasTranscript && editMode`. Selection exists in edit mode
   * only — the owner's decision, recorded in the design's section 3, that a
   * person reading a transcript is not selecting anything. A count and a clear
   * button over rows that carry no checkboxes would be two controls that
   * provably cannot do anything, which is the same objection register item 54
   * raised against showing a display option disabled rather than withholding
   * it.
   *
   * `hasTranscript` IS A PARAMETER AND `editMode` IS READ FROM THE MODULE, and
   * the asymmetry is deliberate. `hasTranscript` and `labelsAreInformative` are
   * derived from the RESULT, which only the caller holds, so they have to
   * arrive. `editMode` is this file's own single source of truth for the mode
   * and is always current — the render path reads it directly for the same
   * reason (`const edit = editMode`), and `setDisplayOptionsVisible` reads it
   * directly to keep its own checkbox in step. Passing it would create a second
   * place it could be wrong.
   *
   * SILENT. Revealing or hiding a block is not an event that speaks: it is not
   * a live region, nothing here announces, and each control conveys its own
   * name and state when a person reaches it. Listen row 49 judges that.
   *
   * IT REFRESHES THE COUNT ON REVEAL rather than trusting the markup's zero
   * sentence. The block can be revealed with a selection already standing —
   * turn edit mode off and on and the Set is cleared, but unit 7 will have
   * other routes in — so the count is written from the Set every time the
   * block appears. `setText` is write-if-changed, so a reveal that changes
   * nothing writes nothing.
   *
   * @param {object} options
   * @param {boolean} options.hasTranscript - is a transcript on screen
   */
  function setSelectionVisible({ hasTranscript }) {
    const block = el("transcribe-selection");
    if (!block) return;

    const show = Boolean(hasTranscript && editMode);
    block.hidden = !show;
    if (show) {
      updateSelectionCount();
      // THE MOVE PICKER IS FILLED ON REVEAL, ON EXACTLY THE TERMS THE NAMING
      // BLOCK'S PICKER IS (item 46 unit 7b). The options are data-driven, the
      // markup ships none, and this is the one path every reveal goes through —
      // the resting state, the reset, the post-run reveal and the edit-mode
      // toggle all reach it, so filling it here is what makes all four correct
      // without four call sites remembering to.
      populateMoveTargetPicker();
      return;
    }

    // IT EMPTIES ON HIDE, for setSpeakerNamingVisible's reason exactly: the
    // options belong to the transcript that has just been discarded, and
    // leaving them would offer slots from another recording on the next reveal.
    const picker = el("transcribe-selection-target");
    if (picker) picker.replaceChildren();
  }

  /**
   * Write the selected-line count into its own element.
   *
   * SILENT TEXT, AND THAT IS THE WHOLE POINT OF THIS FUNCTION EXISTING RATHER
   * THAN THE CALLERS WRITING IT. There is one place the sentence is composed
   * and one place it is written, so there is one place to check that no
   * announcement happens: no toast, no announcer call, no live region, and the
   * target is a <p> carrying no `aria-live` and no role with no live ancestor.
   * IT IS STILL SILENT AT UNIT 8, AND THE DECISION IS NOW AN ANSWER RATHER
   * THAN A PENDING QUESTION. The withdrawn sentence read "Listen row 47 part
   * (c) decides whether register items 45 to 48 speak at all, and until it is
   * heard this chain is silent by decision rather than by omission." It was
   * heard on 13 September 2026, and it gave a voice to the four gestures that
   * CHANGE something — of which ticking a box is not one. So the silence here
   * is now held deliberately against a ruling that could have taken it away.
   *
   * WRITE-IF-CHANGED, through `setText`. An identical-value `textContent`
   * assignment is a REAL mutation arriving as `childList`, so it would be
   * visible to any observer and audible the day this element ever gained a
   * role — AGENTS.md § Announcements, and the same reasoning `setText` was
   * written for.
   */
  function updateSelectionCount() {
    const count = el("transcribe-selection-count");
    if (!count) return;
    const size = selectedRows.size;
    setText(
      count,
      size === 0
        ? SELECTION_NONE_TEXT
        : `${pluralise(size, "line")}${SELECTION_SUFFIX}`,
    );
  }

  /**
   * Record or forget one row's tick, from a `change` on its checkbox.
   *
   * NO ROW IS REBUILT. The box the person just moved already shows its own
   * state, and rebuilding the row would replace the node they are standing on
   * — the position cost `patchRow`'s notes exist to protect against. Only the
   * Set and the count move.
   *
   * NOTHING IS ANNOUNCED. The checkbox conveys its own state through the
   * browser, which is native feedback and not an announcement this file makes.
   *
   * @param {number} index - the row, 0-based
   * @param {boolean} ticked - the box's new state, read from the control
   */
  function toggleSelection(index, ticked) {
    if (ticked) selectedRows.add(index);
    else selectedRows.delete(index);
    updateSelectionCount();
    logDebug(`row ${index}: selected = ${ticked} (${selectedRows.size} in all)`);
  }

  /**
   * Empty the selection, from the Clear selection button.
   *
   * IT UNTICKS THE VISIBLE BOXES AND REBUILDS NO ROW. `checked = false` on the
   * inputs that already exist is the same discipline the rename repaint
   * follows, and for the same reason: nothing a person could be inside is
   * removed, so nobody's position in a 657-row list moves and the list does not
   * re-announce its length. A `renderTranscript` here would be correct and
   * would fail listen row 47 part (b).
   *
   * THE ASSIGNMENT FIRES NO `change`, which is what makes the order safe. The
   * Set is emptied first and the boxes follow; a `change` per box would reach
   * `toggleSelection` 657 times and write the count 657 times, and it does not
   * happen. It also means the delegated listener cannot undo what this does.
   *
   * ONLY THE VISIBLE BOXES NEED TOUCHING, and the selector says so: with edit
   * mode off there are no checkboxes at all, the block is hidden, and the Set
   * is already empty — so this button is unreachable in that state rather than
   * merely inert in it.
   *
   * FOCUS STAYS ON THE BUTTON. Nothing is removed from the document, so there
   * is no lost-focus problem to solve, and moving focus after a button press
   * the person aimed at that button would be taking the page away from them.
   *
   * WRITE-IF-CHANGED AT THE GESTURE, not only at the text. An empty selection
   * cleared again is no change at all, so it does not walk 657 controls.
   *
   * NOTHING IS ANNOUNCED. No toast, no announcer call, no live region. The
   * count is silent text and the boxes convey their own state. Listen row 49
   * judges whether that is sufficient feedback for a gesture whose whole
   * visible effect is remote from the control — the same question the design's
   * section 7 raises about a rename.
   */
  function handleClearSelection() {
    if (selectedRows.size === 0) {
      logDebug("clear selection — nothing was selected");
      return;
    }

    const cleared = selectedRows.size;
    selectedRows.clear();

    const host = el("transcribe-transcript");
    if (host) {
      host
        .querySelectorAll(`input.${CLASS_SELECT}:checked`)
        .forEach((box) => {
          box.checked = false;
        });
    }

    updateSelectionCount();
    logDebug(`clear selection — ${cleared} row(s) unticked, none rebuilt`);
  }

  // ==========================================================================
  // REASSIGNMENT — THE MOVE PICKER AND THE TWO GESTURES (item 46 unit 7b)
  // ==========================================================================

  /**
   * The speaker slots the MOVE PICKER offers: the union of the slots the
   * phrases carry and the keys in the names map.
   *
   * A WIDER SET THAN speakerSlotsIn, AND THE DIFFERENCE IS THE WHOLE REASON
   * addSpeaker WRITES AN EMPTY-NAME ENTRY. A slot just created carries no
   * lines, so a picker reading only the phrases would not offer the one thing
   * the person had just made — and `setSpeaker` refuses a slot that does not
   * exist, so the two would be exactly out of step. The names map is what
   * records that a slot EXISTS as well as which slots are NAMED, and this is
   * the function that reads it for existence.
   *
   * IT IS DELIBERATELY NOT MERGED WITH speakerSlotsIn, WHICH THE NAMING PICKER
   * USES. That one offers slots to RENAME and takes the phrases' set; this one
   * offers slots to MOVE INTO and takes the union. Merging them would make the
   * naming picker offer an empty slot, which is a control whose Apply would
   * succeed and change nothing visible — the same objection register item 54
   * raises against offering a control that provably cannot do anything. The
   * divergence is written down at both functions so neither is later made
   * "consistent" with the other.
   *
   * THE SAME INTEGER TEST AS speakerSlotsIn, for the same reason: it is the set
   * `setSpeaker` accepts, so no option can be offered whose Move is refused.
   * Object keys are strings, so the map's half converts and re-tests rather
   * than coercing — `Number("")` is 0 and `Number("1.5")` is 1.5, and either
   * would put a slot in this list that `setSpeaker` would then reject.
   *
   * IT WILL OFFER AN EMPTIED SLOT, and that is the recorded consequence of unit
   * 7b exposing no Remove control — design section 5, with a listen attached.
   * `removeSpeaker` exists and is reachable from the console; nothing on the
   * page calls it.
   *
   * @param {object|null} result
   * @param {Object<string, string>} names
   * @returns {number[]} ascending
   */
  function moveTargetSlotsIn(result, names) {
    const phrases = result && Array.isArray(result.phrases) ? result.phrases : [];
    const seen = new Set();
    phrases.forEach((phrase) => {
      if (!phrase) return;
      if (Number.isInteger(phrase.speaker) && phrase.speaker >= 0) {
        seen.add(phrase.speaker);
      }
    });
    Object.keys(names || {}).forEach((key) => {
      const slot = Number(key);
      if (!Number.isInteger(slot) || slot < 0) return;
      seen.add(slot);
    });
    return Array.from(seen).sort((a, b) => a - b);
  }

  /**
   * Fill the move picker.
   *
   * THE SAME COMPOSITION RULE AS THE NAMING PICKER, AND FOR THE SAME REASONS —
   * read populateSpeakerPicker rather than having them restated here. In
   * summary: the option text is built FROM THE NAMES MAP DIRECTLY and never by
   * asking `speakerDisplayName` which branch it took, because that function's
   * fallback and a real name are indistinguishable in its return by design, so
   * inferring the branch would break silently the day somebody names a speaker
   * "Speaker 3". The number stays visible even though a named line prints the
   * name alone. `createElement` and `textContent`, never innerHTML.
   *
   * ONLY THE SLOT SET DIFFERS — see moveTargetSlotsIn.
   *
   * THE CURRENT SELECTION SURVIVES A REPOPULATE where its slot still exists,
   * which matters more here than in the naming picker: this control is
   * repopulated after every move and after every add, and a person who had
   * chosen a target must not find it changed under them between two moves.
   *
   * @returns {number} how many options it now holds
   */
  function populateMoveTargetPicker() {
    const picker = el("transcribe-selection-target");
    if (!picker) return 0;

    const api = moduleOrNull();
    if (!api) {
      logError("cannot populate the move picker — the transcribe module is missing");
      return 0;
    }

    const state = stateOrNull();
    const names = state && state.isLoaded() ? state.speakerNames() : {};
    const slots = moveTargetSlotsIn(currentResult(), names);
    const previous = picker.value;

    const options = slots.map((slot) => {
      const option = document.createElement("option");
      option.value = String(slot);
      const name = names[slot];
      option.textContent =
        typeof name === "string" && name !== ""
          ? `${name} (${api.SPEAKER_NAME_PREFIX}${slot})`
          : `${api.SPEAKER_NAME_PREFIX}${slot}`;
      return option;
    });

    picker.replaceChildren(...options);

    const kept = options.some((option) => option.value === previous);
    picker.value = kept ? previous : options.length > 0 ? options[0].value : "";
    logDebug(`move picker populated with ${options.length} slots`);
    return options.length;
  }

  /**
   * Repopulate BOTH pickers. One call site's worth of sequencing, in one place.
   *
   * THE TWO ARE ALWAYS REFRESHED TOGETHER, after a name is applied, after a
   * speaker is added and after a move — because all three change what at least
   * one of them should offer, and the pair going out of step is a defect a
   * person meets as a picker that has forgotten a speaker. Naming's own apply
   * path predates this function and calls populateSpeakerPicker directly; it is
   * left alone, because a rename cannot change either picker's slot SET and the
   * move picker's option TEXT is refreshed on every reveal.
   *
   * CORRECTION TO THAT LAST CLAUSE, AND IT IS WHY THIS FUNCTION IS CALLED FROM
   * applySpeakerName AFTER ALL: a rename DOES change the move picker's option
   * text, the block can be open while the rename happens (edit mode and a
   * multi-speaker transcript satisfy both predicates at once), and a reveal
   * will not come to refresh it. So naming calls this too.
   */
  function repopulateSpeakerPickers() {
    populateSpeakerPicker();
    populateMoveTargetPicker();
  }

  /**
   * Move every selected line to the speaker in the move picker.
   *
   * THE ONLY MOVE PATH, reached by the button and by nothing else. There is no
   * Enter gesture here and no keyboard shortcut: Enter belongs to a text field,
   * and this gesture has none — the picker is a <select>, where Enter and the
   * arrow keys already mean what the browser says they mean. Adding a second
   * path would be two places for the write, the repaint and the repopulate to
   * diverge, which is the objection applySpeakerName and commitControl both
   * record.
   *
   * THE SELECTION IS KEPT, NOT CLEARED, AND IT IS A DECISION WITH A NAMED
   * ALTERNATIVE. Moving the lines back is the only undo this feature has —
   * design section 5 settles that `revertSpeaker` is not built precisely
   * because `setSpeaker` to the arrival slot already is one — and keeping the
   * ticks makes that undo ONE gesture rather than forty. Clearing would punish
   * the most likely mistake, which is moving the right lines to the wrong
   * speaker. THE ALTERNATIVE IS TO CLEAR, on the ground that a selection
   * surviving its own gesture can read as a trap: a person who moves and then
   * moves again without looking moves the same lines twice. Clear selection
   * exists for when they are done. LISTEN ROW 49 IS WHERE THIS IS DECIDED, and
   * it is recorded here as two options rather than one preference so the
   * sitting has something to compare against.
   *
   * A REFUSAL SAYS NOTHING BUT A LOG LINE, exactly as applySpeakerName's does:
   * no toast, no announcer call, no live region — the CODE and not the
   * sentence, because the codes are kebab-case and stable while a message can
   * be reworded. Every refusal reachable from this control is a controller bug
   * rather than something a person did: `bad-index` cannot arise because the
   * indices come from the Set the checkboxes fill, and `bad-speaker` cannot
   * arise because the options come from `moveTargetSlotsIn`, which takes
   * exactly the set `setSpeaker` accepts. If a later unit makes one reachable,
   * the remedy is decided THEN and with a listen, not guessed here.
   *
   * AN EMPTY SELECTION RETURNS EARLY, AND THAT IS NOT A GUARD FOR CORRECTNESS.
   * `setSpeaker` treats an empty array as a no-op and refuses nothing — its own
   * notes say the controller should not have to guard a pressed button with
   * nothing ticked. The early return is to avoid a pointless repopulate and a
   * log line claiming a move happened.
   */
  function handleMoveSelection() {
    const state = stateOrNull();
    if (!state || !state.isLoaded()) {
      logWarn("lines were moved with no transcript loaded");
      return;
    }

    // speakerLabelText does NOT guard a missing module, and every repaint path
    // below reaches it. applySpeakerName carries the same guard for the same
    // reason, and it sits BEFORE the write so a missing module cannot leave the
    // state moved and the screen unpainted.
    const api = moduleOrNull();
    if (!api) {
      logError("cannot move lines — the transcribe module is missing");
      return;
    }

    if (selectedRows.size === 0) {
      logDebug("move — nothing was selected");
      return;
    }

    const picker = el("transcribe-selection-target");
    if (!picker) {
      logWarn("the move picker is missing — nothing to move to");
      return;
    }

    // Tested as a string first, for fillNameFieldFromPicker's reason:
    // Number("") is 0, which is a slot a transcript could genuinely hold.
    if (picker.value === "") {
      logWarn("no target speaker is selected — nothing to move to");
      return;
    }
    const target = Number(picker.value);
    if (!Number.isInteger(target)) {
      logWarn(`the move picker holds an unreadable value: ${picker.value}`);
      return;
    }

    // ASCENDING, SO THE NEIGHBOUR WIDENING BELOW IS ORDERLY. The Set's
    // iteration order is insertion order — the order the person ticked the
    // boxes — which would make the repaint set arrive shuffled. Nothing depends
    // on it being sorted, and a log line or a debugger session does.
    const indices = Array.from(selectedRows).sort((a, b) => a - b);

    // READ BEFORE THE WRITE. This is the flip branch's whole mechanism: whether
    // speaker labels are informative is a property of the result, and moving
    // lines is one of the two things that can change it. Reading it afterwards
    // would compare the new state against itself.
    const informativeBefore = api.distinctSpeakerCount(currentResult()) > 1;

    // THE SOURCE SLOT OF EVERY SELECTED ROW, ALSO READ BEFORE THE WRITE, AND
    // FOR A SHARPER REASON THAN THE LINE ABOVE (register item 46 unit 8). The
    // announcement names where the lines came FROM, and after `setSpeaker` runs
    // that information is simply gone — the phrase's `speaker` is the target
    // and nothing holds the old value. `sourceSpeaker` is NOT the answer: it is
    // where the TRANSCRIPTION put the line, so a line moved twice would be
    // reported against its original slot rather than the one it just left.
    //
    // KEYED BY INDEX so the set can be narrowed to the rows that ACTUALLY
    // moved once `setSpeaker` says which they were. `outcome.indices` is a
    // subset of what was ticked, and announcing over the ticked set would name
    // a speaker nothing moved away from.
    const beforeByIndex = new Map();
    const phrasesBefore = currentResult();
    indices.forEach((index) => {
      const phrase =
        phrasesBefore && Array.isArray(phrasesBefore.phrases)
          ? phrasesBefore.phrases[index]
          : null;
      if (phrase) beforeByIndex.set(index, phrase.speaker);
    });

    let outcome;
    try {
      outcome = state.setSpeaker(indices, target);
    } catch (error) {
      logError(
        `moving ${indices.length} line(s) to speaker ${target} was refused: ${
          error && error.code ? error.code : "unknown"
        }`,
        error,
      );
      return;
    }

    if (outcome.changed === 0) {
      logDebug(`move — all ${indices.length} selected line(s) were already there`);
      return;
    }

    const informativeAfter = api.distinctSpeakerCount(currentResult()) > 1;

    // THE SENTENCE IS COMPOSED ONCE, HERE, AND SPOKEN ONCE PER BRANCH BELOW.
    // Both branches end in a `return`, so composing above them is what keeps
    // one gesture to one utterance without either branch remembering to. The
    // names map is read AFTER the write because a rename is not what happened:
    // the map is unchanged, and reading it here rather than above keeps one
    // read rather than two.
    //
    // IT IS COMPOSED BEFORE THE REPAINT AND SPOKEN AFTER IT, in each branch.
    // Composing first means a repaint that throws cannot leave a half-built
    // sentence; speaking last means nothing is announced for a repaint that did
    // not happen.
    const namesNow = state.speakerNames();
    const sourceDisplays = Array.from(
      new Set(
        outcome.indices
          .map((index) => beforeByIndex.get(index))
          .filter((slot) => Number.isInteger(slot))
          .map((slot) => api.speakerDisplayName({ speaker: slot, names: namesNow })),
      ),
    );
    const changeSentence = speakerChangedSentence(
      outcome.changed,
      sourceDisplays,
      api.speakerDisplayName({ speaker: target, names: namesNow }),
    );

    if (informativeBefore !== informativeAfter) {
      // THE FLIP BRANCH. Every row's label decision has changed at once, not
      // just the moved ones, so a targeted repaint cannot serve it — design
      // section 4 names this as the case that "has to work", because it is the
      // merged-voices repair the whole feature exists for. The cost is a full
      // rebuild and with it a reader's position in the list, which is exactly
      // the trade listen row 47 (b) reads for; there is no cheaper correct
      // answer, because the alternative is 657 targeted repaints.
      //
      // THE THREE REVEALS ARE REFRESHED AFTER THE RENDER, NOT BEFORE, matching
      // the post-run order in handleRun: a reveal reads the state the rows are
      // in, and doing it once the rows exist keeps the two describing the same
      // thing. Without the refresh the speaker checkbox stays hidden while the
      // labels it governs are live on screen, and the naming block stays hidden
      // on a transcript that now has two speakers to name — a control that has
      // gone missing rather than one that has not arrived yet.
      renderTranscript(currentResult());
      setDisplayOptionsVisible({
        hasTranscript: true,
        labelsAreInformative: informativeAfter,
      });
      setSpeakerNamingVisible({
        hasTranscript: true,
        labelsAreInformative: informativeAfter,
      });
      setSelectionVisible({ hasTranscript: true });
      speak(changeSentence);
      logInfo(
        `moved ${outcome.changed} line(s) to speaker ${target}; labels became ` +
          `${informativeAfter ? "informative" : "uninformative"}, so the list was rebuilt`,
      );
      return;
    }

    // THE TARGETED BRANCH. The set to repaint is each moved row AND THE ONE
    // AFTER IT — `setSpeaker` returns the rows that CHANGED, which is not the
    // same set, because ON_CHANGE suppression reads the previous row through
    // `previousSpeakerAt` and a row whose own speaker did not move can still
    // gain or lose its label. Bounded at the last index so a neighbour past the
    // end is never asked for, deduped so a moved row adjacent to another moved
    // row is not rebuilt twice, and sorted so the batch is orderly.
    const result = currentResult();
    const lastIndex =
      (result && Array.isArray(result.phrases) ? result.phrases.length : 0) - 1;
    const toRepaint = new Set();
    outcome.indices.forEach((index) => {
      toRepaint.add(index);
      if (index + 1 <= lastIndex) toRepaint.add(index + 1);
    });
    const affected = Array.from(toRepaint).sort((a, b) => a - b);

    const painted = patchRows(affected);
    // BOTH PICKERS, because a move can empty a slot and can fill one that was
    // empty, and the option TEXT of neither changes but the naming picker's
    // SLOT SET does — it reads the phrases, so a slot no line carries any more
    // drops out of it while staying in the move picker's union.
    repopulateSpeakerPickers();

    speak(changeSentence);
    logInfo(
      `moved ${outcome.changed} line(s) to speaker ${target}; ` +
        `${painted.rebuilt} row(s) repainted (${affected.length} affected, ` +
        `${outcome.changed} moved), selection kept`,
    );
  }

  /**
   * Open a new speaker slot and select it as the move target.
   *
   * THE WEAKEST-FEEDBACK GESTURE IN THIS FEATURE, AND SAYING SO IS THE POINT OF
   * THIS PARAGRAPH. Nothing on the page changes except one picker's contents
   * and its selection: no row moves, no label appears, no count changes, and
   * nothing is announced. Design section 7 records that a RENAME is already
   * weaker than the row editor because its effect is remote from the control;
   * this is weaker again, because its effect is not visible anywhere until a
   * second gesture uses it. LISTEN ROW 49 SHOULD JUDGE IT ON ITS OWN rather
   * than inside a move, for that reason.
   *
   * SELECTING THE NEW SLOT IS THE WHOLE OF THE MITIGATION, and it needs no
   * sound. The obvious next gesture is to move lines into the slot just made,
   * so the picker is left ready for it — and the picker visibly shows what
   * happened, which is the same "the control describes the state it governs"
   * answer fillNameFieldFromPicker gives for naming.
   *
   * IT DOES NOT REVEAL THE NAMING BLOCK, AND THAT IS CORRECT RATHER THAN A
   * GAP. `addSpeaker` alone does not flip `labelsAreInformative`: the new slot
   * carries no lines, so `distinctSpeakerCount` is unmoved. The block appears
   * when lines are MOVED into the slot, through handleMoveSelection's flip
   * branch — which is the placement answer that discharges unit 4b's open
   * comment, recorded in design section 5.
   *
   * IT ANNOUNCES AS OF UNIT 8, AND THE WITHDRAWN TEXT IS QUOTED RATHER THAN
   * DELETED: "NOTHING IS ANNOUNCED. No toast, no announcer call, no live
   * region. Listen row 47 part (c) decides whether register items 45 to 48
   * speak at all." Part (c) was heard on 13 September 2026 and decided it for
   * this gesture. THE PARAGRAPH ABOVE ABOUT WEAKEST FEEDBACK IS THE REASON THE
   * RULING REACHED HERE at all — a gesture whose effect is not visible anywhere
   * until a second gesture uses it is the one silence served worst.
   *
   * IT STILL DOES NOT ANNOUNCE THE SELECTION, and its own paragraph above says
   * why: the picker SHOWS the new slot is selected, and a visible control
   * describing its own state needs no sentence. See speakerAddedSentence.
   */
  function handleAddSpeaker() {
    const state = stateOrNull();
    if (!state || !state.isLoaded()) {
      logWarn("a speaker was added with no transcript loaded");
      return;
    }

    // A MODULE GUARD THIS HANDLER DID NOT NEED UNTIL UNIT 8, ADDED WITH THE
    // THING THAT NEEDS IT. `speakerDisplayName` lives on the module, and the
    // sentence below is the first line in this handler to want it. It sits
    // BEFORE the write, matching handleMoveSelection and applySpeakerName
    // exactly, so a missing module cannot leave a slot created and unreported —
    // which is the failure a guard placed after the write would produce.
    const api = moduleOrNull();
    if (!api) {
      logError("cannot add a speaker — the transcribe module is missing");
      return;
    }

    let created;
    try {
      created = state.addSpeaker();
    } catch (error) {
      logError(
        `adding a speaker was refused: ${
          error && error.code ? error.code : "unknown"
        }`,
        error,
      );
      return;
    }

    repopulateSpeakerPickers();

    // SELECTED AFTER THE REPOPULATE, never before it: the option does not exist
    // until the repopulate has run, and assigning `value` to a string no option
    // carries leaves a <select> on its first option with no error at all.
    const picker = el("transcribe-selection-target");
    if (picker) {
      picker.value = String(created);
      if (picker.value !== String(created)) {
        logWarn(
          `speaker ${created} was created but the move picker would not select it`,
        );
      }
    }

    // AFTER THE PICKER WORK, NOT BEFORE IT. The sentence reports a slot that
    // exists and is selected, so it is spoken once both are true — and if the
    // picker refuses the value, the warning above is logged and the sentence
    // still correctly reports the slot, which did get created.
    //
    // THE NAMES MAP IS READ FOR ONE SLOT THAT IS CERTAIN TO BE UNNAMED —
    // `addSpeaker` stores "" for it — so this could have been composed from the
    // number alone. It goes through `speakerDisplayName` anyway, because that
    // function is the one place the stem is composed and a local `Speaker ${n}`
    // here would be the second copy of the wording `speakerLabelText` exists to
    // prevent, one layer up.
    speak(
      speakerAddedSentence(
        api.speakerDisplayName({ speaker: created, names: state.speakerNames() }),
      ),
    );

    logInfo(`speaker ${created} created and selected as the move target`);
  }

  // ==========================================================================
  // THE SPEAKER NAMING CONTROLS (register item 46 unit 4b)
  // ==========================================================================

  /**
   * Reveal or hide the speaker-naming block.
   *
   * A SEPARATE FUNCTION BESIDE setDisplayOptionsVisible, NEVER A FOURTH
   * PREDICATE INSIDE IT. That function carries a documented three-predicate
   * contract belonging to register item 54, and naming is not a display option:
   * it changes both downloaded files at unit 5, which every control in that
   * group is forbidden from doing. tools.html's own comment on this block says
   * the same thing from the markup side, and this is the code half of it.
   *
   * THE PREDICATE IS `hasTranscript && labelsAreInformative` — the same test
   * that governs `#transcribe-speaker-option`, and it is reached by the same
   * reasoning register item 54 gave for hiding that checkbox rather than
   * disabling it. On a ONE-SPEAKER transcript a rename could change nothing:
   * `speakerLabelFor` suppresses the label, no speaker span exists on any row,
   * and neither download would move. Offering a control that provably cannot do
   * anything is worse than omitting it.
   *
   * UNIT 7 MUST REVISIT THIS, AND THE NOTE IS HERE SO IT IS NOT DISCOVERED BY
   * ACCIDENT. `addSpeaker` exists to split a transcript the service heard as
   * one person — the merged-voices failure register item 46 calls the one that
   * corrupts an analysis silently — and that repair STARTS from a one-speaker
   * transcript, which this predicate hides the block on. The change belongs to
   * unit 7, which owns the flip branch; unit 4b must not pre-empt it, because a
   * wider predicate here would reveal a naming control that unit 4b gives
   * nobody a way to act usefully on.
   *
   * DISCHARGED AT UNIT 7b, 13 September 2026: REVISITED AND UNCHANGED. The
   * paragraph above is kept rather than deleted, because it is the record of
   * why the question was open and a deleted question reads as one nobody
   * asked.
   *
   * THE RESOLUTION IS PLACEMENT, NOT PREDICATE. The controls that repair a
   * merged transcript — the move picker, Move selected lines and Add speaker —
   * went into the SELECTION block, whose predicate is `hasTranscript &&
   * editMode` and which therefore appears on a one-speaker transcript. Naming
   * stayed here, on this predicate, where it keeps working in read-only mode as
   * design section 2 requires.
   *
   * SO THE REPAIR REACHES THIS BLOCK BY DOING ITS WORK. Add a speaker, move
   * lines into it, and `distinctSpeakerCount` passes 1 — the flip branch in
   * handleMoveSelection then rebuilds the list and calls this function with
   * `labelsAreInformative: true`, so the block appears at the moment there is
   * something in it to name. A wider predicate would have shown it a gesture
   * earlier, on a transcript where a rename could still change nothing.
   *
   * NOTE WHICH GESTURE FLIPS IT: the MOVE, not the ADD. `addSpeaker` alone
   * leaves the new slot carrying no lines, so the count is unmoved and this
   * block correctly stays hidden. Check 4 of unit 7b's console sheet drives
   * exactly that sequence, because the tree gate cannot reach the state.
   *
   * SILENT. Revealing or hiding a block is not an event that speaks: it is not
   * a live region, nothing here announces, and each control conveys its own
   * name and state when a person reaches it. Listen row 49 judges that.
   *
   * IT EMPTIES THE CONTROLS WHEN IT HIDES. The options belong to the transcript
   * that has just been discarded, and leaving them would offer slots from
   * another recording on the next reveal.
   *
   * @param {object} options
   * @param {boolean} options.hasTranscript - is a transcript on screen
   * @param {boolean} options.labelsAreInformative - distinctSpeakerCount > 1
   */
  function setSpeakerNamingVisible({ hasTranscript, labelsAreInformative }) {
    const block = el("transcribe-speaker-names");
    if (!block) return;

    const show = Boolean(hasTranscript && labelsAreInformative);
    block.hidden = !show;

    if (show) {
      populateSpeakerPicker();
      fillNameFieldFromPicker();
      // LAST, because it reads BOTH of the above (register item 46 unit 8). A
      // revealed block is a block a person is about to use, and its button must
      // describe the state the other two have just put it in rather than the
      // state left by a previous transcript.
      updateApplyButtonName();
      return;
    }

    const picker = el("transcribe-speaker-picker");
    const field = el("transcribe-speaker-name");
    if (picker) picker.replaceChildren();
    if (field) field.value = "";
    // ON HIDE TOO, AND IT IS NOT SYMMETRY FOR ITS OWN SAKE. The block keeps its
    // DOM while hidden, so a tail left behind would still be in the accessible
    // name the next time the block is revealed — naming a slot from a
    // transcript that has been discarded. It is the same reasoning the two
    // lines above carry for the picker's options and the field's value.
    updateApplyButtonName();
  }

  /**
   * The speaker slots a transcript actually holds, ascending.
   *
   * IT IS A STRICTER TEST THAN `distinctSpeakerCount`'s, DELIBERATELY. That
   * function counts anything that is neither null nor undefined, because it is
   * answering "are labels informative". This one is choosing what to OFFER, so
   * it takes exactly the set `setSpeakerName` accepts — `Number.isInteger` and
   * `>= 0`. A slot outside that set would be an option whose Apply is refused,
   * which is the same defect as revealing the block on a one-speaker
   * transcript, one level down. `normaliseSpeechResponse` cannot produce one
   * today and the two tests agree on every measured fixture; the divergence is
   * written down so neither is later made "consistent" with the other.
   *
   * @param {object|null} result
   * @returns {number[]}
   */
  function speakerSlotsIn(result) {
    const phrases = result && Array.isArray(result.phrases) ? result.phrases : [];
    const seen = new Set();
    phrases.forEach((phrase) => {
      if (!phrase) return;
      if (Number.isInteger(phrase.speaker) && phrase.speaker >= 0) {
        seen.add(phrase.speaker);
      }
    });
    return Array.from(seen).sort((a, b) => a - b);
  }

  /**
   * Fill the picker from the transcript's own speaker numbers.
   *
   * THE OPTION TEXT IS COMPOSED FROM THE NAMES MAP DIRECTLY, and never by
   * asking `speakerDisplayName` which branch it took. That function's fallback
   * and a real name are INDISTINGUISHABLE in its return, by design — its own
   * notes say so — so inferring the branch from the output would be a coupling
   * that breaks silently the day somebody names a speaker "Speaker 3". Testing
   * the map is one line and cannot be wrong:
   *
   *   named    `Amira (Speaker 2)`
   *   unnamed  `Speaker 2`
   *
   * THE NUMBER STAYS VISIBLE HERE EVEN THOUGH A NAMED LINE PRINTS THE NAME
   * ALONE, and that is not an inconsistency to tidy away. Design section 8
   * answer 1 governs the TRANSCRIPT and the two downloads, where the name
   * replaces the number outright. The picker is a different surface: the number
   * is the durable handle a person uses to find a slot again, and a list of
   * bare names gives them nothing to match against the rows they have just
   * read. tools.html's unit 1 comment predicted exactly this wording; this is
   * where it is built.
   *
   * `createElement` AND `textContent`, NEVER innerHTML. A speaker name is
   * person-authored text and must stay text, for the reason buildRow gives at
   * length for the phrases themselves.
   *
   * THE CURRENT SELECTION SURVIVES A REPOPULATE where its slot still exists. A
   * rename repopulates to refresh one option's text, and a person who had slot
   * 3 selected must not find themselves on slot 1 afterwards — the picker is
   * the only thing that says which slot the name field is describing.
   */
  function populateSpeakerPicker() {
    const picker = el("transcribe-speaker-picker");
    if (!picker) return;

    const api = moduleOrNull();
    if (!api) {
      logError(
        "cannot populate the speaker picker — the transcribe module is missing",
      );
      return;
    }

    const state = stateOrNull();
    const names = state && state.isLoaded() ? state.speakerNames() : {};
    const slots = speakerSlotsIn(currentResult());
    const previous = picker.value;

    const options = slots.map((slot) => {
      const option = document.createElement("option");
      option.value = String(slot);
      const name = names[slot];
      option.textContent =
        typeof name === "string" && name !== ""
          ? `${name} (${api.SPEAKER_NAME_PREFIX}${slot})`
          : `${api.SPEAKER_NAME_PREFIX}${slot}`;
      return option;
    });

    picker.replaceChildren(...options);

    const kept = options.some((option) => option.value === previous);
    picker.value = kept ? previous : options.length > 0 ? options[0].value : "";
    logDebug(`speaker picker populated with ${options.length} slots`);
  }

  /**
   * Put the selected slot's stored name into the name field.
   *
   * THIS IS THE WHOLE OF THE FEEDBACK DESIGN, and it is why the field is filled
   * rather than cleared. A rename is the first gesture in this tool whose
   * entire visible effect is REMOTE from the control — a text correction
   * changes the box the person is in, a rename changes up to 657 rows
   * elsewhere. THE MITIGATION IS NO LONGER THE ONLY FEEDBACK, and it is still
   * worth having: applying a name now announces (unit 8, see THE FOUR SPOKEN
   * GESTURES), but a sentence is heard once and gone, while the control
   * describing the state it governs can be returned to at any time. The
   * withdrawn clause read: Nothing announces, per listen row 47 (c), so the
   * mitigation has to be visible and silent.
   * Design section 7 records that this is WEAKER than the row editor's
   * feedback, and that listen row 49 carries the question of whether it is
   * enough.
   *
   * AN UNNAMED SLOT EMPTIES THE FIELD. A stale name left in the box would
   * describe a slot other than the one selected, which is the one thing this
   * function exists to prevent.
   */
  function fillNameFieldFromPicker() {
    const picker = el("transcribe-speaker-picker");
    const field = el("transcribe-speaker-name");
    if (!picker || !field) return;

    // An empty picker value is the no-options case, and it is tested as a
    // STRING before any Number() call: Number("") is 0, which is a valid slot,
    // so a numeric test alone would read an empty picker as speaker 0.
    if (picker.value === "") {
      field.value = "";
      return;
    }

    const slot = Number(picker.value);
    if (!Number.isInteger(slot)) {
      logWarn(`the speaker picker holds an unreadable value: ${picker.value}`);
      field.value = "";
      return;
    }

    const state = stateOrNull();
    const names = state && state.isLoaded() ? state.speakerNames() : {};
    const name = names[slot];
    field.value = typeof name === "string" ? name : "";
  }

  /**
   * The picker moved: describe the slot it moved to. See
   * fillNameFieldFromPicker for why this is the feedback design rather than a
   * convenience.
   */
  function handleSpeakerPickerChange() {
    fillNameFieldFromPicker();
    // AFTER THE FIELD, NEVER BEFORE IT (register item 46 unit 8). The button's
    // name is composed from the field's CURRENT value and the picker's current
    // option, so refreshing it first would describe the slot just chosen using
    // the name belonging to the slot just left.
    updateApplyButtonName();
  }

  /**
   * Repaint the speaker label on every row belonging to one slot.
   *
   * THE TARGETED REPAINT, AND THE TRAP DESIGN SECTION 4 WAS WRITTEN AROUND.
   *
   * IT REPLACES NO NODE AND REBUILDS NO ROW. It calls neither buildRow nor
   * patchRow: it walks the phrases ONCE, finds each affected row by its stable
   * id, finds the speaker span already inside it, and writes textContent. So
   * nothing a person could be inside is removed, and NO FOCUS PLACEMENT IS
   * NEEDED AT ALL — focus stays on the Apply button or in the name field,
   * untouched. That is the whole payoff of the design's two-tier decision, and
   * it is what listen row 47 (b) reads for one level up.
   *
   * NEVER LOOP patchRow. It recomputes `distinctSpeakerCount` over the WHOLE
   * result on every call, so a loop over a slot's rows is quadratic on exactly
   * the transcripts that most need not to be — 657 rows times a full rescan
   * each. The single hoisted `speakerLabelText` call below is the contrast: one
   * composition for the whole slot, not one per row.
   *
   * ROWS WITH NO SPEAKER SPAN ARE SKIPPED, AND THAT IS ORDINARY RATHER THAN A
   * FAULT. Under ON_CHANGE only the rows where the speaker changes carry a
   * label — 56 of the fixture's 657 — and a row that prints no label has no
   * label to rename. The `querySelector` miss is an expected outcome here, so
   * it is counted for the log line and never warned about per row.
   *
   * WRITE-IF-CHANGED IS LOAD-BEARING, NOT TIDINESS. An identical-value
   * textContent assignment is a REAL mutation and arrives as `childList`, not
   * `characterData` — visible to any observer, and audible the day this subtree
   * ever gains a live role. AGENTS.md records the measurement; commitControl
   * applies the same rule one layer down at the state.
   *
   * A RENAME NEVER CHANGES WHICH ROWS SHOW A LABEL. Suppression depends on
   * speaker NUMBERS and the label mode, not on names, so the set of rows
   * carrying a span is identical before and after. A row gaining or losing one
   * during a rename is a fault, and this unit's console sheet reads for it.
   *
   * @param {number} slot
   * @param {Object<string, string>} names - read once by the caller
   * @returns {{written: number, skipped: number, matched: number}}
   */
  function repaintSpeakerLabels(slot, names) {
    const result = currentResult();
    const phrases = result && Array.isArray(result.phrases) ? result.phrases : [];

    // Composed ONCE for the whole slot. Every row in it prints the same string.
    const label = speakerLabelText(slot, names);

    let written = 0;
    let skipped = 0;
    let matched = 0;

    phrases.forEach((phrase, index) => {
      if (!phrase || phrase.speaker !== slot) return;
      matched += 1;
      const row = el(ROW_ID_STEM + index);
      if (!row) return;
      const span = row.querySelector(`.${CLASS_SPEAKER}`);
      if (!span) {
        skipped += 1;
        return;
      }
      if (span.textContent === label) return;
      span.textContent = label;
      written += 1;
    });

    return { written: written, skipped: skipped, matched: matched };
  }

  /**
   * Apply the name in the field to the slot in the picker. THE ONLY APPLY PATH.
   *
   * BOTH GESTURES REACH THIS ONE FUNCTION — the Apply button's click and Enter
   * in the name field — mirroring commitControl's one-commit-path discipline,
   * and load-bearing for the same reason: two paths would be two places for the
   * state write, the repaint, the repopulate and the field reset to diverge,
   * and the divergence would show only as one gesture behaving unlike the
   * other. Enter is also otherwise DEAD in a lone text input outside a form, so
   * wiring it is the difference between a keyboard user's name applying and
   * nothing at all happening.
   *
   * BLUR DOES NOT APPLY, and the asymmetry with the row editor is deliberate.
   * That editor commits on blur because its effect is local and visible under
   * the cursor; here an accidental blur would silently repaint up to 657 rows
   * the person cannot see. So the gesture is explicit.
   *
   * ESCAPE DOES NOTHING, ALSO DELIBERATELY. The block's visible hint names
   * choosing, typing and applying and nothing else, and shipping a gesture the
   * hint does not name is how an undiscoverable behaviour gets in. This unit
   * does not change that hint.
   *
   * IT ANNOUNCES AS OF UNIT 8, AND ONE OF TWO SENTENCES. Applying a name says
   * the slot is now called it; clearing one says the slot has gone back to its
   * number. The branch is taken on what was WRITTEN — an empty trimmed name is
   * the clear — and never on what was typed, because a name of nothing but
   * spaces trims to empty and is a clear whatever it looked like in the box.
   * See nameAppliedSentence and nameClearedSentence.
   *
   * A REFUSED NAME STILL SAYS NOTHING, AND THAT IS A DECISION RATHER THAN AN
   * OMISSION. No toast, no announcer call, no live region — only a log line
   * carrying the code. The `bad-name` refusal is NOT REACHABLE FROM THIS
   * CONTROL: an <input type="text"> runs the value-sanitisation algorithm,
   * which strips CR and LF, so a newline cannot be typed, pasted or even
   * assigned into it — this unit's console sheet MEASURES that rather than
   * assuming it. The refusal is a guarantee against a programmatic caller and
   * against a future paste path, not a user-facing error. If a later unit makes
   * it reachable, the remedy is decided THEN and with a listen, not guessed
   * here.
   *
   * NO CHANGE, NO WORK. `setSpeakerName` reports `changed: false` when the
   * trimmed name equals the stored one — AGENTS.md's write-if-changed answered
   * at the state — and an apply that changed nothing must not repaint a row or
   * repopulate a control.
   */
  function applySpeakerName() {
    const state = stateOrNull();
    if (!state || !state.isLoaded()) {
      logWarn("a speaker name was applied with no transcript loaded");
      return;
    }

    // speakerLabelText does NOT guard a missing module — its own notes say so,
    // and name unit 4b's rename path as the caller that must guard it. This is
    // that guard, and it sits BEFORE the write so a missing module cannot leave
    // the state named and the screen unpainted.
    if (!moduleOrNull()) {
      logError("cannot apply a speaker name — the transcribe module is missing");
      return;
    }

    const picker = el("transcribe-speaker-picker");
    const field = el("transcribe-speaker-name");
    if (!picker || !field) {
      logWarn("the speaker naming controls are missing — nothing to apply");
      return;
    }

    // Tested as a string first, for fillNameFieldFromPicker's reason: Number("")
    // is 0, which is a slot a transcript could genuinely hold.
    if (picker.value === "") {
      logWarn("no speaker is selected — nothing to apply");
      return;
    }

    const slot = Number(picker.value);
    if (!Number.isInteger(slot)) {
      logWarn(`the speaker picker holds an unreadable value: ${picker.value}`);
      return;
    }

    let outcome;
    try {
      outcome = state.setSpeakerName(slot, field.value);
    } catch (error) {
      // The CODE, not the sentence: the codes are kebab-case and stable, and a
      // reader comparing against one cannot be broken by a reworded message.
      logError(
        `naming speaker ${slot} was refused: ${
          error && error.code ? error.code : "unknown"
        }`,
        error,
      );
      return;
    }

    if (!outcome.changed) {
      // AND NOTHING IS ANNOUNCED, WHICH IS PART OF THE RULING RATHER THAN A
      // CONSEQUENCE OF THE EARLY RETURN. Applying a name the slot already has
      // changed nothing, so a sentence here would report a change that did not
      // happen — and an announcement for a no-op teaches a person to stop
      // listening to announcements, which costs more than the silence unit 8
      // withdrew. Design section 10.3.
      logDebug(`speaker ${slot} applied unchanged — nothing to repaint`);
      return;
    }

    // Read ONCE and handed down, for the reason renderTranscript gives:
    // speakerNames() returns a fresh copy on every call.
    const names = state.speakerNames();

    // THE SENTENCE IS COMPOSED BEFORE THE REPAINT AND SPOKEN AFTER IT.
    // Composing first means a repaint that throws cannot leave a half-built
    // sentence; speaking last means nothing is announced for a repaint that did
    // not happen.
    //
    // THE SUBJECT IS THE SLOT AS IT READ BEFORE THE WRITE, and `outcome`
    // carries it: `previous` is the stored name, "" for a slot that had none.
    // Composing it from the CURRENT map would name the slot by the name it has
    // only just been given, so every sentence would read "Amira is now called
    // Amira." — which is why this is reconstructed from `previous` rather than
    // read back.
    const api = moduleOrNull();
    const numberDisplay = api.speakerDisplayName({ speaker: slot, names: {} });
    const previousDisplay =
      outcome.previous === "" ? numberDisplay : outcome.previous;
    const applied = names[slot];
    const sentence =
      typeof applied === "string" && applied !== ""
        ? nameAppliedSentence(previousDisplay, applied)
        : nameClearedSentence(previousDisplay, numberDisplay);
    const painted = repaintSpeakerLabels(slot, names);
    // BOTH PICKERS SINCE ITEM 46 UNIT 7b, where this line read
    // `populateSpeakerPicker()`. A rename changes neither picker's slot SET and
    // both pickers' option TEXT, and the move picker can be open at the same
    // time as this one — edit mode and a multi-speaker transcript satisfy both
    // blocks' predicates at once — so a rename applied with both on screen
    // would otherwise leave the move picker naming a speaker by the name they
    // no longer have. See repopulateSpeakerPickers.
    repopulateSpeakerPickers();
    // From the MAP, not from what was typed, so a name that trimmed to nothing
    // leaves the box empty and the box goes on describing the state.
    fillNameFieldFromPicker();
    // AND THE BUTTON FOLLOWS THE BOX. A clear empties the field, so the tail
    // must empty with it or the button would go on offering to apply a name
    // that is no longer anywhere on screen. It is refreshed rather than
    // cleared, because an APPLY leaves the name in the box and the tail is
    // still correct for it.
    updateApplyButtonName();

    speak(sentence);
    logInfo(
      `speaker ${slot} named: ${painted.written} of ${painted.matched} rows repainted, ` +
        `${painted.skipped} carried no label`,
    );
  }

  /**
   * Keep the Apply button's accessible name describing what pressing it will
   * do (register item 46 unit 8).
   *
   * WHY THE BUTTON NEEDS IT. The design's section 7 records that a rename's
   * entire visible effect is REMOTE from the control, and that the filled name
   * field is the whole of the mitigation. The button is the last thing a
   * keyboard user touches before up to 657 rows change, and until this unit its
   * name said nothing about which slot or which name.
   *
   * A VISUALLY-HIDDEN SPAN THE MARKUP SHIPS EMPTY, NOT aria-label. Because the
   * span APPENDS to the visible text rather than replacing it, the accessible
   * name begins with the visible label BY CONSTRUCTION — which is SC 2.5.3
   * Label in Name satisfied by the shape rather than by remembering to repeat
   * the words. AGENTS.md's first rule of ARIA is native HTML first, and this is
   * what that looks like when a name has to change at runtime.
   *
   * EMPTY BOX, EMPTY SPAN. The button is then "Apply name" and nothing else,
   * which is what the sitting asked for: a control with nothing to apply should
   * not describe an application.
   *
   * THE SLOT IS NAMED AS THE PICKER NAMES IT, read off the selected option's
   * own text rather than recomposed. A slot already called Clive therefore
   * reads "Apply name Amira as Clive (Speaker 1)", matching the picker the
   * person just used, and there is no second composer of that string to
   * diverge — the same reasoning speakerLabelText carries.
   *
   * IT CANNOT RE-ANNOUNCE UNDERNEATH THE PERSON, AND THAT IS WHY THE TWO EVENTS
   * ARE THE ONES THEY ARE. `input` on the field and `change` on the picker both
   * fire while focus is in the field or on the picker, NEVER while focus is on
   * the button. So a person arriving at the button gets one name and it holds
   * still. Listen row 50 part (e) reads for exactly that, and nothing here has
   * been heard.
   *
   * WRITE-IF-CHANGED, THROUGH setText. An identical-value textContent
   * assignment is a REAL mutation arriving as `childList`, so it is visible to
   * any observer and would be audible the day this span ever gained a live
   * role — AGENTS.md § Announcements, and the reason setText exists.
   *
   * IT IS SILENT BY ITSELF. The span carries no aria-live and no role, it has
   * no live ancestor, and a control's own name is not an announcement. The four
   * spoken gestures are the ones listed under THE FOUR SPOKEN GESTURES above,
   * and this is not one of them.
   */
  function updateApplyButtonName() {
    const detail = el("transcribe-speaker-apply-detail");
    if (!detail) return;

    const picker = el("transcribe-speaker-picker");
    const field = el("transcribe-speaker-name");
    const typed = field ? field.value.trim() : "";

    // TRIMMED, so a box holding nothing but spaces reads as empty — the same
    // test setSpeakerName applies to decide a clear, so the button cannot
    // promise an application the apply path would treat as a clearance.
    if (typed === "" || !picker || picker.selectedIndex < 0) {
      setText(detail, "");
      return;
    }

    // The LEADING SPACE belongs to this string, not to the markup: the span
    // abuts "Apply name" with no whitespace between them, so that a source
    // reformat cannot separate the two and silently weld the words together.
    setText(
      detail,
      `${APPLY_DETAIL_SEPARATOR}${typed}${APPLY_DETAIL_JOINER}${picker.options[picker.selectedIndex].text}`,
    );
  }

  /**
   * Enter in the name field applies, through the same function the button
   * reaches. See applySpeakerName for why there is only one path.
   *
   * `preventDefault` IS DEFENSIVE, NOT REQUIRED TODAY — the same judgement, and
   * the same checked fact, that handleTranscriptKeydown records: nothing in
   * tools.html wraps this tool in a <form>, so there is no implicit submission
   * to suppress. It is called anyway because a later markup unit that did add
   * one would otherwise turn every Enter into a page reload that silently
   * discards the transcript, and that failure would present as data loss rather
   * than as a form fault.
   *
   * @param {KeyboardEvent} event
   */
  function handleSpeakerNameKeydown(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applySpeakerName();
  }

  /**
   * Re-render the rows from the result already in hand when the checkbox moves.
   *
   * IT DOES NOT RE-TRANSCRIBE and touches no state beyond the display mode:
   * the held transcript is untouched, so Copy and both Downloads keep handing
   * back exactly what they handed back before — the checkbox governs the SCREEN
   * and nothing else.
   *
   * NO TOAST AND NO ANNOUNCEMENT, per register item 43 and AGENTS.md
   * § Announcements question 1. The checkbox conveys its own state and the
   * transcript is not a live region, so a sentence here would be a second voice
   * for one gesture. Owed-listen row 40 (c) judges whether that is sufficient
   * feedback; if it is not, the remedy is decided there and not guessed here.
   */
  function handleShowSpeakerChange() {
    const box = el("transcribe-show-every-speaker");
    showSpeakerOnEveryLine = box ? box.checked : true;
    logDebug(`speaker-label display mode: every line = ${showSpeakerOnEveryLine}`);
    // haveTranscript(), not currentResult(): see its doc comment for why the
    // yes/no question is not asked by building a snapshot and testing it.
    if (!haveTranscript()) return;
    renderTranscript(currentResult());
  }

  /**
   * Re-render the rows from the result already in hand when the timestamps
   * checkbox moves — the same shape as handleShowSpeakerChange, for the same
   * reasons, and register item 54 is where they are recorded.
   *
   * IT DOES NOT RE-TRANSCRIBE and touches no state beyond the display mode:
   * the held transcript is untouched, so Copy and both Downloads keep handing
   * back exactly what they handed back before — the checkbox governs the SCREEN
   * and nothing else. `toPlainText` happens to take a `timestamps` option of its
   * own; nothing here passes it, and that is item 54's standing constraint,
   * not an oversight.
   *
   * SHARPENED at register item 46 unit 5, which is the first thing to pass EITHER
   * formatter an option from this file. The three consumers now pass `names` and
   * still pass neither `speakers` nor `timestamps`, so the constraint is no
   * longer "nothing is passed" but the narrower and more useful "a NAME is
   * content and travels; a DISPLAY MODE is not and does not". The asymmetry this
   * paragraph records is unchanged and still unresolved.
   *
   * NO TOAST AND NO ANNOUNCEMENT, per AGENTS.md § Announcements question 1.
   * The checkbox conveys its own state and the transcript is not a live
   * region, so a sentence here would be a second voice for one gesture. This
   * control removes content from EVERY row, which is a larger change than the
   * speaker control makes; owed-listen row 42 (c) judges whether the checkbox
   * state alone is sufficient feedback for that, and silence is the failure
   * mode it watches for. If it is not sufficient, the remedy is decided there
   * and not guessed here.
   */
  function handleShowTimestampsChange() {
    const box = el("transcribe-show-timestamps");
    showTimestamps = box ? box.checked : true;
    logDebug(`timestamps display: shown = ${showTimestamps}`);
    // haveTranscript(), not currentResult(): see its doc comment.
    if (!haveTranscript()) return;
    renderTranscript(currentResult());
  }

  /**
   * Turn the edit surface on or off — the same shape as the two handlers above,
   * for the same reasons, and register item 45 is where they are recorded.
   *
   * IT DOES NOT RE-TRANSCRIBE and it changes no phrase. Turning the mode off
   * cannot revert a correction: the corrections live in the state module, which
   * this handler never writes to, so what a person typed survives the toggle and
   * survives into Copy and both downloads. Listen row 47 (e) reads exactly that.
   *
   * NO TOAST AND NO ANNOUNCEMENT, per AGENTS.md § Announcements question 1. The
   * checkbox conveys its own state and the transcript is not a live region. This
   * control replaces a control on EVERY row, which is a larger change than
   * either box above it makes; listen row 47 (a) and (e) judge whether the
   * checkbox state alone is sufficient feedback for that.
   *
   * TURNING THE MODE OFF CLEARS THE SELECTION, AND THAT IS REQUIRED RATHER
   * THAN TIDY (item 46 unit 6). A selection surviving into read-only mode is
   * INVISIBLE AND UNREACHABLE: the row checkboxes do not exist, the block
   * carrying the count and the Clear button is hidden, so a person can neither
   * see what is selected nor clear it — and they would meet it again, intact
   * and unexplained, on turning edit mode back on. That is a worse state than
   * losing the selection, which is what the mode change plainly implies.
   *
   * THE CLEAR PRECEDES THE RENDER, so the rows are built from an emptied Set
   * rather than being built and then contradicted. It makes no visible
   * difference in this direction — turning the mode off removes every checkbox
   * anyway — and it is the order that stays correct if a later unit ever
   * renders checkboxes in read-only mode.
   *
   * IT DOES NOT CLEAR ON THE WAY IN. Turning the mode ON finds the Set already
   * empty, because the only routes to a non-empty one are the row checkboxes
   * and the block, both of which exist in edit mode only.
   *
   * THE EARLY RETURN ITS TWO SIBLINGS USE IS GONE, AND THE REASON IS THAT THIS
   * HANDLER NOW HAS TWO THINGS TO DO. `if (!haveTranscript()) return;` would
   * skip the block's reveal on the no-transcript path — where the predicate
   * says the block must be HIDDEN — leaving its visibility to whatever last
   * set it rather than to the function that owns it. The answer is read once
   * into a local and both the render and the reveal are governed by it, so the
   * predicate cannot be bypassed by a return.
   */
  function handleEditModeChange() {
    const box = el("transcribe-edit-transcript");
    editMode = box ? box.checked : false;
    logDebug(`edit mode: on = ${editMode}`);
    if (!editMode && selectedRows.size > 0) {
      logDebug(`edit mode off — discarding ${selectedRows.size} selected row(s)`);
      selectedRows.clear();
    }
    // haveTranscript(), not currentResult(): see its doc comment.
    const hasTranscript = haveTranscript();
    if (hasTranscript) renderTranscript(currentResult());
    // AFTER the render, matching the post-run order in handleRun: the reveal
    // refreshes the count, and doing it once the rows exist keeps the two
    // describing the same state.
    setSelectionVisible({ hasTranscript });
  }

  /**
   * The row index an `<input>` names, for one of this file's id stems, or null.
   *
   * ONE READER OF THE ID, shared by every gesture that can reach a control.
   * `editIndexOf`'s own note said this when there was one stem and three call
   * sites; item 46 unit 6 added a SECOND STEM and a fourth call site, and the
   * answer was to take the stem as an argument rather than to write the
   * function again. Two copies of "is this ours, and which row is it" is two
   * places for the id convention to be got wrong, which is the very defect
   * that note records.
   *
   * IT IS SAFE ONLY BECAUSE NEITHER STEM IS A PREFIX OF THE OTHER —
   * `transcribe-edit-` and `transcribe-select-` — so a `startsWith` test cannot
   * claim the other control's rows. SELECT_ID_STEM's own note says so from the
   * other side, and any third stem must be checked against both.
   *
   * THE WARNING NAMES THE STEM, so an unreadable id says which control it
   * belonged to rather than leaving a reader to guess from the number.
   *
   * @param {EventTarget|null} target
   * @param {string} stem - the id stem to match, e.g. EDIT_ID_STEM
   * @returns {number|null}
   */
  function rowIndexFrom(target, stem) {
    if (!target || target.tagName !== "INPUT") return null;
    if (typeof target.id !== "string" || !target.id.startsWith(stem)) {
      return null;
    }
    const index = Number(target.id.slice(stem.length));
    if (!Number.isInteger(index) || index < 0) {
      logWarn(`a control with the stem "${stem}" has an unreadable id: ${target.id}`);
      return null;
    }
    return index;
  }

  /**
   * The index a row's EDIT control names, or null when the target is not one.
   * Three call sites — the `change` commit, the Enter commit and the Escape
   * abandon.
   *
   * @param {EventTarget|null} target
   * @returns {number|null}
   */
  function editIndexOf(target) {
    return rowIndexFrom(target, EDIT_ID_STEM);
  }

  /**
   * The index a row's SELECTION control names, or null when the target is not
   * one. One call site — the delegated `change` listener (item 46 unit 6).
   *
   * @param {EventTarget|null} target
   * @returns {number|null}
   */
  function selectIndexOf(target) {
    return rowIndexFrom(target, SELECT_ID_STEM);
  }

  /**
   * Commit one correction from a control. THE ONLY COMMIT PATH.
   *
   * BOTH GESTURES REACH THIS ONE FUNCTION — the `change` event (a blur, and the
   * browser's own Enter behaviour on a text input) and the explicit Enter
   * keydown below. Unit 8 added Enter as a deliberate gesture and did NOT give
   * it its own commit: two commit paths would be two places for the state write,
   * the patch and the focus placement to diverge, and the divergence would only
   * show up as one gesture behaving unlike the other.
   *
   * IT IS THE ONLY CALLER OF setText FROM THIS FILE. The state module is the
   * only writer of phrase text and this is the only route into it, so there is
   * one place a correction can enter the transcript.
   *
   * NO CHANGE, NO WORK. `setText` reports `changed: false` when the new text
   * equals the old — AGENTS.md's write-if-changed answered at the state — and a
   * commit that changed nothing must not rebuild a row or move focus. A person
   * who tabs through a control without typing has made no edit, and a person
   * who presses Enter on an untouched row has made none either.
   *
   * @param {HTMLInputElement} control
   * @param {number} index
   */
  function commitControl(control, index) {
    const state = stateOrNull();
    if (!state || !state.isLoaded()) {
      logWarn("an edit was committed with no transcript loaded");
      return;
    }

    // setText refuses a bad index or a non-string with a coded error rather
    // than a silent no-op, so a genuine fault is loud in the log instead of
    // looking like a correction that did not take.
    let outcome;
    try {
      outcome = state.setText(index, control.value);
    } catch (error) {
      logError(`the correction to phrase ${index} was refused`, error);
      return;
    }

    if (!outcome.changed) {
      logDebug(`phrase ${index} committed unchanged — nothing to patch`);
      return;
    }

    patchRow(index);
  }

  /**
   * Commit one correction, from a `change` on a row's edit control.
   *
   * ONE DELEGATED LISTENER ON THE TRANSCRIPT HOST, not one per control. The
   * host is in REQUIRED_IDS and persists across every render, so this is wired
   * once in init() and survives both a full re-render and a single-row patch —
   * whereas 657 per-control listeners would have to be re-attached by every
   * render and re-attached again by every patch, and a patch that forgot would
   * leave one silently dead row.
   *
   * BLUR STILL COMMITS, UNCHANGED BY UNIT 8. Enter and Escape are additions to
   * this handler, never replacements for it: a person who corrects a phrase and
   * tabs away has committed, exactly as they always could.
   *
   * IT NOW SERVES TWO CONTROLS, AND ITEM 46 UNIT 6 DID NOT ADD A SECOND
   * LISTENER. Both are `<input>` elements inside the same host and both fire
   * `change`, so a second delegated listener on the same host for the same
   * event would be two places to decide which control an event came from —
   * and 657 checkboxes bound individually would have to be re-attached by
   * every render and every patch, which is the whole reason this listener is
   * delegated. The selection branch is tested FIRST because it is the cheaper
   * test and because a checkbox can never be an edit control; both use the one
   * id reader — see rowIndexFrom.
   *
   * @param {Event} event
   */
  function handleTranscriptChange(event) {
    const selectIndex = selectIndexOf(event.target);
    if (selectIndex !== null) {
      toggleSelection(selectIndex, Boolean(event.target.checked));
      return;
    }

    const index = editIndexOf(event.target);
    if (index === null) return;
    commitControl(event.target, index);
  }

  /**
   * Enter commits; Escape abandons uncommitted typing (register item 45 unit 8).
   *
   * ONE DELEGATED LISTENER, on the same host and for the same reason as the
   * `change` listener above.
   *
   * ENTER COMMITS THROUGH commitControl, the same function `change` reaches, so
   * the two gestures cannot come to behave differently. It does NOT place focus
   * itself: patchRow already owns that decision, and its measured three-case
   * guard is what makes the placement correct. On Enter the control still holds
   * focus when the patch runs, so patchRow takes its first case and places focus
   * on the rebuilt row's control at once — the person stays where they were.
   *
   * `preventDefault` ON ENTER IS DEFENSIVE, NOT REQUIRED TODAY. Nothing in
   * `tools.html` wraps this tool in a <form> — checked, all six <form> elements
   * on the page are elsewhere — so there is no implicit submission to suppress.
   * It is called anyway because a later markup unit that did add a form would
   * otherwise turn every Enter into a page reload that silently discards the
   * transcript, and that failure would present as data loss rather than as a
   * form fault.
   *
   * ESCAPE RESTORES THE CONTROL'S VALUE FROM THE STATE, AND WRITES NOTHING.
   * What it abandons is typing that has not been committed — the gap between
   * what is in the box and what the state holds. The state is not touched, so
   * an escape can never lose a correction that was already saved.
   *
   * ESCAPE MUST NOT CALL `revert`. `revert` discards a SAVED correction and
   * restores what the service transcribed, which is a destructive action; and
   * Escape is undiscoverable, unconfirmed and unundoable. Wiring the two
   * together would mean a person who pressed Escape to get out of a field lost
   * work they had already committed, with nothing said. Whatever surface
   * `revert` eventually gets, it is a deliberate one that names itself.
   *
   * NOTHING IS ANNOUNCED BY EITHER GESTURE. No toast, no announcer call, no
   * live region, no liveness added anywhere in this chain. Listen row 47 (b)
   * and (c) are what judge that, and unit 8 re-arms both.
   *
   * @param {KeyboardEvent} event
   */
  function handleTranscriptKeydown(event) {
    if (event.key !== "Enter" && event.key !== "Escape") return;

    const index = editIndexOf(event.target);
    if (index === null) return;

    if (event.key === "Enter") {
      event.preventDefault();
      commitControl(event.target, index);
      return;
    }

    event.preventDefault();

    const state = stateOrNull();
    if (!state || !state.isLoaded()) {
      logWarn("escape was pressed in an edit control with no transcript loaded");
      return;
    }

    // phraseAt returns null on a miss rather than undefined, so this test can
    // tell "no such phrase" from "the state is not what I think it is".
    const phrase = state.phraseAt(index);
    if (!phrase) {
      logWarn(`escape on phrase ${index} — the state has no such phrase`);
      return;
    }

    // Write-if-changed, for the reason setText applies it one layer down: a
    // person who pressed Escape without typing has changed nothing, and an
    // assignment that restores the same string is still a real write.
    if (event.target.value === phrase.text) {
      logDebug(`escape on phrase ${index} — nothing uncommitted to abandon`);
      return;
    }

    event.target.value = phrase.text;
    logDebug(`escape on phrase ${index} — uncommitted typing abandoned`);
  }

  /**
   * Derive a download filename from the audio filename, e.g. "AD1.mp3" with
   * ".txt" gives "AD1.txt". Falls back to a fixed stem when no name is known.
   */
  function downloadName(extension) {
    const stem = lastFileName.replace(/\.[^.]+$/, "").trim();
    return (stem || "transcript") + extension;
  }

  /**
   * Blob plus a programmatic anchor, following
   * md-scripts/charts/chart-accessibility-export-utils.js:1128-1146.
   *
   * NO SUCCESS NOTIFICATION. The browser reports a download in its own UI, so a
   * toast would be a second report of one event — and it would be a spoken
   * sentence that register row 39 does not cover.
   */
  function downloadText(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    logInfo(`Download started: ${filename}`);
  }

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  function handleFileChange(event) {
    const input = event && event.target ? event.target : el("transcribe-file-input");
    const file = input && input.files ? input.files[0] : null;
    const nameField = el("transcribe-file-name");

    // Any previous transcript belongs to a different file. Keeping it beside a
    // newly chosen one would let Copy and Download hand back the wrong audio's
    // words with nothing on screen to say so. The transcript now lives in the
    // state module, so discarding it is that module's reset rather than a local
    // assignment — and a missing module is not a reason to skip it, because
    // there is then nothing held to discard.
    const stateForReset = stateOrNull();
    if (stateForReset) stateForReset.reset();
    lastFileName = "";
    setResultActionsEnabled(false);
    // Empty the LIST rather than writing an empty string into the host: there
    // is no text node to blank any more, and replaceChildren removes the rows
    // without going through the HTML parser.
    clearTranscript();
    // The options block belongs to the transcript that has just been discarded.
    // Leaving it on screen would offer a display choice over nothing.
    setDisplayOptionsVisible({
      hasTranscript: false,
      labelsAreInformative: false,
    });
    // The naming block goes with it, for the same reason and one more of its
    // own: its options are SLOT NUMBERS FROM THE DISCARDED TRANSCRIPT, so
    // leaving them would offer another recording's speakers. Its own helper,
    // never a fourth predicate inside the one above — see
    // setSpeakerNamingVisible.
    setSpeakerNamingVisible({
      hasTranscript: false,
      labelsAreInformative: false,
    });
    // THE SELECTION GOES WITH IT, AND THE SET IS EMPTIED BEFORE THE BLOCK IS
    // HIDDEN (item 46 unit 6). Its members are ROW INDICES INTO THE DISCARDED
    // TRANSCRIPT, so carrying them forward would point at another recording's
    // lines — the same objection as the naming block's slot numbers, and worse,
    // because an index is valid against any transcript long enough and so would
    // silently select the wrong lines rather than failing. Clearing first is
    // what makes the reveal's own count refresh correct if it ever runs before
    // the next transcript exists.
    selectedRows.clear();
    setSelectionVisible({ hasTranscript: false });

    if (!file) {
      setText(nameField, NO_FILE_TEXT);
      return;
    }

    const api = moduleOrNull();
    if (!api) {
      logError("the transcribe module is missing — cannot validate the file");
      setText(nameField, NO_FILE_TEXT);
      if (window.notifyError) window.notifyError(GENERIC_FAILURE_SENTENCE);
      return;
    }

    const validation = api.validateFile(file);
    if (!validation.ok) {
      // Clear the input so the refused file cannot be sent by pressing
      // Transcribe afterwards, and so choosing the same file again re-fires
      // change rather than being swallowed as "no change".
      if (input) input.value = "";
      setText(nameField, NO_FILE_TEXT);
      logWarn(`file refused: ${validation.reason}`);
      if (window.notifyError) window.notifyError(validation.reason);
      return;
    }

    lastFileName = file.name;
    const megabytes = (file.size / (1024 * 1024)).toFixed(1);
    setText(nameField, `${file.name} (${megabytes} MB)`);
    logInfo(`file accepted: ${file.name}, ${file.size} bytes`);
  }

  async function handleRun() {
    // Re-entry is refused by this flag rather than by disabling the button.
    // THE BUTTON STAYS ENABLED AND KEEPS FOCUS ON PURPOSE: disabling a focused
    // control moves focus to <body>, which would strand a screen-reader user at
    // the top of the document for the length of a run that has been measured at
    // 55 seconds. chat/chat-messages.js:1254-1259 reaches the same conclusion
    // for the same reason.
    if (running) {
      logWarn("a transcription is already running — ignoring the second press");
      return;
    }

    const api = moduleOrNull();
    if (!api) {
      logError("the transcribe module is missing — cannot start");
      if (window.notifyError) window.notifyError(GENERIC_FAILURE_SENTENCE);
      return;
    }

    const input = el("transcribe-file-input");
    const file = input && input.files ? input.files[0] : null;
    const results = el("transcribe-results");

    running = true;
    inFlight = new AbortController();
    if (results) results.setAttribute("aria-busy", "true");
    showProgress();

    // ONE voice for the start of the run. notifyInfo announces through the
    // shared announcer already, so nothing else is said here.
    if (window.notifyInfo) window.notifyInfo(START_SENTENCE);

    try {
      const locale = el("transcribe-locale")?.value || "en-GB";
      const maxSpeakers = Number(el("transcribe-max-speakers")?.value) || 4;

      const result = await api.transcribe(file, {
        locale,
        maxSpeakers,
        signal: inFlight.signal,
      });

      // HAND THE RESULT TO THE STATE MODULE AND RENDER FROM WHAT IT HOLDS, not
      // from the result in hand. Rendering the result directly would put the
      // first paint on a different source from every later one, so a defect in
      // the state module's copy would not surface until somebody moved a
      // checkbox — which is a delay, not a saving.
      //
      // A REFUSED LOAD MUST NOT BECOME A REPORTED FAILURE. `load` throws
      // BAD_RESULT on a shape without a phrases array; `normaliseSpeechResponse`
      // cannot produce one, but `transcribe` is stubbable and the fixture
      // loader stubs it. Letting that throw run would send a rendered
      // transcript down the catch below and speak a failure sentence for a run
      // that succeeded, so it is caught here and the screen keeps HEAD's
      // behaviour. Copy and the Downloads then have nothing to work from, which
      // the logged line names.
      const state = stateOrNull();
      if (state) {
        try {
          state.load(result);
        } catch (loadError) {
          logError("the transcript could not be held as state:", loadError);
        }
      } else {
        logError(
          "window.OpenRouterEmbedTranscribeState is missing — the transcript cannot be held",
        );
      }
      const held = currentResult() || result;

      // THE SELECTION IS EMPTIED BEFORE THE RENDER, AND BOTH HALVES OF THAT
      // SENTENCE ARE LOAD-BEARING (repair unit R2, on unit 7b's finding).
      //
      // WHY IT IS EMPTIED. The Set holds ROW INDICES, and a fresh run replaces
      // every row those indices refer to. So a tick that survives does not mean
      // "this line" — it means "whatever is twelfth now", in a recording the
      // person has not looked at. An index is valid against any transcript long
      // enough, so it selects the WRONG lines rather than failing, which is the
      // same objection handleFileChange records for the discarded-transcript
      // case and worse here: unit 7b gave the selection a Move gesture, so a
      // stale tick can now reassign lines nobody chose.
      //
      // WHY BEFORE THE RENDER. renderTranscript restores the ticks FROM the Set
      // — deliberately, so a display-option toggle does not discard a person's
      // selection — so clearing afterwards would leave ticked boxes on screen
      // backed by an empty Set, which is worse than what it replaced. This is
      // the order handleEditModeChange and handleFileChange already document.
      //
      // THE COUNT IS REFRESHED HERE RATHER THAN LEFT TO THE REVEAL. The reveal
      // below does refresh it, but only on its `show` branch, so a run with
      // edit mode off would leave a stale sentence in the hidden block. Doing
      // it here makes the pair correct without depending on which branch the
      // reveal takes. `setText` is write-if-changed, so the reveal's own
      // refresh then writes nothing.
      //
      // NOTHING IS ANNOUNCED. The count is silent text — see
      // updateSelectionCount — and this run already has its one voice in the
      // success toast below.
      selectedRows.clear();
      updateSelectionCount();

      // DOM nodes and text nodes, never innerHTML — the same reason the
      // superseded textContent write had, arriving at a renderer instead. A
      // transcript is somebody's speech and is not markup; writing it as HTML
      // would let a spoken phrase that happens to contain angle brackets become
      // elements on the page. renderTranscript builds every string with
      // createTextNode or textContent, so there is no parse step to escape for.
      renderTranscript(held);
      setDisplayOptionsVisible({
        hasTranscript: true,
        labelsAreInformative: api.distinctSpeakerCount(held) > 1,
      });
      // AFTER renderTranscript, not before it. The reveal populates the picker
      // from the held transcript, and it is the same `distinctSpeakerCount`
      // answer the line above uses — asked once of the same result, so the two
      // blocks cannot disagree about whether labels are informative.
      setSpeakerNamingVisible({
        hasTranscript: true,
        labelsAreInformative: api.distinctSpeakerCount(held) > 1,
      });
      // AFTER renderTranscript, for the same reason the line above it is: the
      // reveal refreshes the count from the Set, and the rows have to exist
      // for the two to describe the same state. Its predicate needs no
      // `labelsAreInformative` — selection is governed by edit mode alone, and
      // the edit checkbox ships unticked, so a fresh transcript arrives with
      // the block hidden. See setSelectionVisible.
      setSelectionVisible({ hasTranscript: true });
      setResultActionsEnabled(true);

      const phrases = held.phrases ? held.phrases.length : 0;
      const speakers = speakerCount(held);
      if (window.notifySuccess) {
        window.notifySuccess(
          `Transcript ready, ${pluralise(phrases, "phrase")}, ${pluralise(
            speakers,
            "speaker",
          )}.`,
        );
      }
      logInfo(`transcript rendered: ${phrases} phrases, ${speakers} speakers`);
    } catch (error) {
      // An abort is the user leaving the tool, which they did on purpose. It is
      // not a failure and must not be reported as one — a toast here would speak
      // an error about an action the person had already moved on from.
      if (error && error.name === "AbortError") {
        logInfo("transcription aborted — the tool was left mid-run");
        return;
      }
      const sentence = failureSentence(error);
      logError("transcription failed:", error);
      // ONE voice for the failure, and no success sentence — the success path
      // is inside the try above and cannot also have run. The typed state (the
      // chosen file, both selects) is deliberately left untouched, so a retry
      // after signing in needs no re-entry.
      if (window.notifyError) window.notifyError(sentence);
    } finally {
      // Both paths, always: aria-busy removed, progress hidden, guards cleared.
      if (results) results.removeAttribute("aria-busy");
      hideProgress();
      running = false;
      inFlight = null;
    }
  }

  /**
   * The names map, resolved AT THE POINT OF USE and never held in a variable
   * that outlives the handler. `speakerNames()` returns a fresh copy on every
   * call and throws ERRORS.NOT_LOADED when nothing is held, so the isLoaded()
   * guard is required rather than defensive — the same shape the renderer uses.
   *
   * A NAME IS CONTENT, NOT A DISPLAY OPTION. That is why all three consumers
   * below pass it and none of them passes `speakers` or `timestamps`: those two
   * govern the SCREEN only, which is register item 54's standing constraint,
   * and the clipboard and both downloads must agree byte for byte.
   *
   * @returns {Object<string, string>}
   */
  function currentSpeakerNames() {
    const state = stateOrNull();
    return state && state.isLoaded() ? state.speakerNames() : {};
  }

  async function handleCopy() {
    const api = moduleOrNull();
    const transcript = currentResult();
    if (!transcript || !api) return;

    try {
      await navigator.clipboard.writeText(
        api.toPlainText(transcript, { names: currentSpeakerNames() }),
      );
      if (window.notifySuccess) window.notifySuccess(COPIED_SENTENCE);
      logInfo("transcript copied to clipboard");
    } catch (error) {
      logError("copy failed:", error);
      if (window.notifyError)
        window.notifyError("The transcript could not be copied to the clipboard.");
    }
  }

  function handleDownloadTxt() {
    const api = moduleOrNull();
    const transcript = currentResult();
    if (!transcript || !api) return;
    downloadText(
      api.toPlainText(transcript, { names: currentSpeakerNames() }),
      downloadName(".txt"),
      "text/plain;charset=utf-8",
    );
  }

  function handleDownloadSrt() {
    const api = moduleOrNull();
    const transcript = currentResult();
    if (!transcript || !api) return;
    downloadText(
      api.toSrt(transcript, { names: currentSpeakerNames() }),
      downloadName(".srt"),
      "application/x-subrip;charset=utf-8",
    );
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Verify the tool can work, then wire it once.
   *
   * RETURNS false ON A GENUINE FAILURE, and that is load-bearing rather than
   * tidy: switchToTool treats false as failure, announces an error AND RETURNS
   * EARLY, so handlePostSwitchFocus never runs and FOCUS IS NOT RETURNED TO THE
   * TRIGGERING RADIO. A false here therefore costs the user the focus move as
   * well as producing an error, which is why the structural ids below do NOT
   * return one — a missing caveat paragraph must not cost somebody their place
   * on the page. The Image Describer entry in TOOL_CONFIG is not the model to
   * copy on this point: its catch logs and then returns true regardless, so its
   * failure path can never be reached.
   *
   * CORRECTED at register item 46 unit 5. The withdrawn clause read:
   *
   *   "so handlePostSwitchFocus never runs and focus is not moved to the
   *    tool's heading"
   *
   * WHICH BRANCH THIS COSTS, read at HEAD rather than inferred.
   * `TOOL_SWITCH_SETTINGS.focusBehaviour` is `"radio"` (tools.html ~:23851),
   * and `handlePostSwitchFocus` (~:24372) takes the heading branch only when
   * that setting reads `"heading"`. Under `"radio"` it focuses the TRIGGERING
   * RADIO instead, behind a 250ms `setTimeout` whose own comment says it is
   * there to override any focus an init grabs. So the heading branch is DEAD on
   * every shipped load and the sentence above named the one thing that does not
   * happen.
   *
   * BOTH BRANCHES ARE REAL AND ONLY ONE IS LIVE, which is why the withdrawn
   * wording is quoted rather than deleted. `focusBehaviour` is assignable at
   * runtime (~:24585), so a reader who flips it to `"heading"` makes the old
   * sentence true again — it was never wrong about the code, only about which
   * arm of it runs. Correcting it silently would have left that reader believing
   * the heading path had been removed.
   *
   * @returns {boolean} false when the tool cannot function
   */
  function init() {
    if (!moduleOrNull()) {
      logError(
        "window.OpenRouterEmbedTranscribe is missing — openrouter-embed-transcribe.js must load before this file",
      );
      return false;
    }

    // The same treatment as the client module above, and for the same reason:
    // without it the tool cannot hold a transcript at all, so Copy, both
    // Downloads and every re-render have nothing to read. That is a GENUINE
    // failure in the sense the doc comment above draws — unlike the structural
    // ids below, which cost nobody anything they were trying to do.
    if (!stateOrNull()) {
      logError(
        "window.OpenRouterEmbedTranscribeState is missing — openrouter-embed-transcribe-state.js must load before this file",
      );
      return false;
    }

    const missing = REQUIRED_IDS.filter((id) => !el(id));
    if (missing.length > 0) {
      logError(`required elements are missing: ${missing.join(", ")}`);
      return false;
    }

    const missingStructural = STRUCTURAL_IDS.filter((id) => !el(id));
    if (missingStructural.length > 0) {
      // Logged, never spoken. See the doc comment above.
      logWarn(
        `markup elements are missing but the tool still works: ${missingStructural.join(", ")}`,
      );
    }

    if (wired) {
      logDebug("already wired — init is idempotent");
      return true;
    }

    el("transcribe-file-input").addEventListener("change", handleFileChange);
    el("transcribe-run").addEventListener("click", handleRun);
    el("transcribe-copy").addEventListener("click", handleCopy);
    el("transcribe-download-txt").addEventListener("click", handleDownloadTxt);
    el("transcribe-download-srt").addEventListener("click", handleDownloadSrt);

    // The two display-options checkboxes are OPTIONAL to wire, unlike
    // everything above. Neither is in REQUIRED_IDS because the tool
    // transcribes, copies and downloads perfectly well without them — an
    // absence is a markup regression worth a log line, never a spoken error,
    // which is the same judgement STRUCTURAL_IDS records for the results
    // heading and the progress bar.
    const showEverySpeaker = el("transcribe-show-every-speaker");
    if (showEverySpeaker) {
      showEverySpeaker.addEventListener("change", handleShowSpeakerChange);
      // Adopt the markup's own default rather than asserting one, so the
      // checkbox and the module cannot start out disagreeing.
      showSpeakerOnEveryLine = showEverySpeaker.checked;
    } else {
      logWarn(
        "the speaker-label checkbox is missing — the transcript still renders, with labels on every line",
      );
    }

    const showTimestampsBox = el("transcribe-show-timestamps");
    if (showTimestampsBox) {
      showTimestampsBox.addEventListener("change", handleShowTimestampsChange);
      // The same adoption, for the same reason.
      showTimestamps = showTimestampsBox.checked;
    } else {
      logWarn(
        "the timestamps checkbox is missing — the transcript still renders, with a timestamp on every row",
      );
    }

    const editBox = el("transcribe-edit-transcript");
    if (editBox) {
      editBox.addEventListener("change", handleEditModeChange);
      // The same adoption, for the same reason — and this box ships UNTICKED,
      // so adopting it is what keeps the module's default false without this
      // file asserting a value the markup could contradict.
      editMode = editBox.checked;
    } else {
      logWarn(
        "the edit checkbox is missing — the transcript still renders, read-only",
      );
    }

    // THE THREE SPEAKER-NAMING CONTROLS (item 46 unit 4b), wired one by one and
    // each tolerating its own absence, exactly as the three checkboxes above
    // are. None is in REQUIRED_IDS — see STRUCTURAL_IDS for why a missing one
    // must not make init() return false.
    //
    // THEY ARE NOT REMOVED IN cleanup(), matching every other listener in this
    // file: the markup persists across a tool switch, init() is idempotent
    // through `wired`, and removing them would mean re-adding them on every
    // return for no gain. cleanup()'s own doc comment states that contract.
    const speakerPicker = el("transcribe-speaker-picker");
    if (speakerPicker) {
      speakerPicker.addEventListener("change", handleSpeakerPickerChange);
    } else {
      logWarn(
        "the speaker picker is missing — the transcript still renders, with no way to name a speaker",
      );
    }

    const speakerNameField = el("transcribe-speaker-name");
    if (speakerNameField) {
      // Enter only FOR APPLYING. There is no `change` listener and no blur
      // commit here, and that is the deliberate asymmetry with the row editor —
      // see applySpeakerName.
      speakerNameField.addEventListener("keydown", handleSpeakerNameKeydown);
      // `input` IS NOT A SECOND COMMIT PATH AND DOES NOT APPLY ANYTHING. It
      // updates the Apply button's accessible NAME as the person types, so the
      // control describes what pressing it will do (register item 46 unit 8).
      // `input` rather than `keyup`, so a paste, a drag-drop and an
      // autocomplete all reach it — every one of which changes the value
      // without a key ever going up.
      speakerNameField.addEventListener("input", updateApplyButtonName);
    } else {
      logWarn(
        "the speaker name field is missing — the transcript still renders, with no way to name a speaker",
      );
    }

    const speakerApply = el("transcribe-speaker-apply");
    if (speakerApply) {
      speakerApply.addEventListener("click", applySpeakerName);
    } else {
      logWarn(
        "the Apply name button is missing — the transcript still renders, with no way to name a speaker",
      );
    }

    // THE CLEAR SELECTION BUTTON (item 46 unit 6), wired on exactly the terms
    // the three naming controls above are: tolerating its own absence, not in
    // REQUIRED_IDS, and not removed in cleanup(). It is the ONLY listener this
    // unit adds outside the transcript host — the 657 checkboxes are served by
    // the delegated `change` listener below, which already existed.
    //
    // The count element needs no listener at all: it is written, never read
    // from, and never interacted with.
    const selectionClear = el("transcribe-selection-clear");
    if (selectionClear) {
      selectionClear.addEventListener("click", handleClearSelection);
    } else {
      logWarn(
        "the Clear selection button is missing — rows can still be selected, with no way to clear them at once",
      );
    }

    // THE TWO REASSIGNMENT BUTTONS (item 46 unit 7b), wired on exactly the
    // terms every optional control above is: tolerating its own absence, not in
    // REQUIRED_IDS, and not removed in cleanup().
    //
    // THE MOVE PICKER TAKES NO LISTENER AT ALL, and the asymmetry with the
    // NAMING picker is deliberate rather than an omission. That one has a
    // `change` listener because moving it must refill the name field beside
    // it — the control describing the state it governs, which is the whole of
    // naming's feedback design. This picker governs nothing but its own value:
    // it is read at the moment Move is pressed and at no other time, so there
    // is nothing for a `change` to keep in step. Adding one would be a handler
    // whose body could only be empty.
    const selectionMove = el("transcribe-selection-move");
    if (selectionMove) {
      selectionMove.addEventListener("click", handleMoveSelection);
    } else {
      logWarn(
        "the Move selected lines button is missing — rows can still be selected, with no way to move them",
      );
    }

    const addSpeaker = el("transcribe-selection-add-speaker");
    if (addSpeaker) {
      addSpeaker.addEventListener("click", handleAddSpeaker);
    } else {
      logWarn(
        "the Add speaker button is missing — lines can still be moved between the speakers the service found",
      );
    }

    // TWO delegated listeners for every ROW control there will ever be — since
    // item 46 unit 6 that is the edit boxes AND the selection checkboxes, 1,314
    // controls on the committed fixture. The host persists across renders and
    // patches; the controls do not. See handleTranscriptChange for why neither
    // is wired per control and why unit 6 did not add a third listener.
    //
    // `change` is the blur commit and the selection toggle; `keydown` is Enter
    // and Escape. They are separate listeners rather than one because they
    // answer different questions, and both edit gestures reach the SAME commit
    // function — see commitControl.
    el("transcribe-transcript").addEventListener(
      "change",
      handleTranscriptChange,
    );
    el("transcribe-transcript").addEventListener(
      "keydown",
      handleTranscriptKeydown,
    );

    // Resting state: nothing to copy or download yet, and no transcript for the
    // display options or the naming block to act on.
    setResultActionsEnabled(false);
    setDisplayOptionsVisible({
      hasTranscript: false,
      labelsAreInformative: false,
    });
    setSpeakerNamingVisible({
      hasTranscript: false,
      labelsAreInformative: false,
    });
    // The selection block joins the resting state on the same terms. No Set to
    // clear — this runs once per session, before anything can have selected a
    // row — so the call is the reveal alone, which hides the block.
    setSelectionVisible({ hasTranscript: false });
    hideProgress();

    wired = true;
    logInfo("Transcribe tool wired");
    return true;
  }

  /**
   * Abort an in-flight request when the user leaves the tool.
   *
   * The listeners are NOT removed: the markup persists across a switch, init()
   * is idempotent through `wired`, and removing them would mean re-adding them
   * on every return for no gain. What must not persist is a request nobody is
   * waiting for any more — the module passes this signal straight to fetch, so
   * the abort reaches the network rather than merely being ignored on arrival.
   *
   * SILENT BY DESIGN: cleanup is reached while the tool is being left, and
   * switchToTool is about to announce the destination. A voice here would
   * collide with that.
   */
  function cleanup() {
    if (inFlight) {
      logInfo("aborting an in-flight transcription — leaving the tool");
      inFlight.abort();
      inFlight = null;
    }
    // The aria-busy and progress teardown belong to handleRun's finally, which
    // the abort causes to run. Duplicating it here would race with it.
    running = false;
  }

  return {
    init: init,
    cleanup: cleanup,
  };
})();

// tools.html's inline TOOL_CONFIG must reach init and cleanup, and an inline
// script cannot see this file's top-level const binding — a top-level const is
// a global BINDING, not a window property. This alias is therefore required,
// not optional. AGENTS.md records the general trap: window.a11y and friends are
// referenced across this codebase and never assigned, leaving ten dead call
// sites that logged and looked correct.
window.OpenRouterEmbedTranscribeUI = OpenRouterEmbedTranscribeUI;
