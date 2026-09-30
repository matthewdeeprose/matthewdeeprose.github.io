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
 * IT GAINED FOUR VOICES AT REGISTER ITEM 46 UNIT 8 AND A FIFTH AT UNIT 10, and
 * every one of them obeys the paragraph above — see THE SPOKEN GESTURES below,
 * which is the one place they are composed and the one place they reach the
 * outside world. The silence they replaced was overturned by EAR, at the
 * sittings of 13 and 14 September 2026, and the half of that decision which is
 * UNCHANGED is the load-bearing one: no aria-live and no live role is added
 * anywhere in this chain, and the transcript is not a live region and must not
 * become one.
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
  // THE SPOKEN GESTURES (register item 46 units 8 and 10)
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
  // AND A FIFTH JOINED THEM AT UNIT 10, FROM THE SITTING OF 14 SEPTEMBER 2026.
  // The withdrawn sentence is quoted rather than deleted, per register items 51
  // and 56, because it recorded a scope that was true when written:
  //
  //   "THE SCOPE IS FOUR GESTURES AND NOTHING ELSE. Register item 45's text
  //    correction still announces nothing on commit, items 47 and 48 are still
  //    unheard, and the three display checkboxes, the selection tick boxes and
  //    Clear selection are all still silent."
  //
  // CLEAR SELECTION NOW ANNOUNCES. The sitting heard the four and accepted
  // them, and the owner's observation was that four gestures spoke and the
  // fifth stayed silent for no reason other than that nobody had asked for it.
  // Design section 10. The rest of that sentence STANDS UNCHANGED: item 45's
  // text correction still announces nothing on commit, items 47 and 48 are
  // still unheard, and the three display checkboxes and the selection tick
  // boxes are still silent — a tick box conveys its own state through the
  // browser, which is native feedback and not an announcement this file makes.
  // Listen row 47 part (c) NARROWS to items 45, 47 and 48; it does not close.
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
  // IT REACHES CLEAR SELECTION THE SAME WAY, and the reachable case is the same
  // shape: clearing the same NUMBER of lines twice inside five seconds produces
  // one byte-identical sentence. It takes a re-tick between the two, because a
  // second clear with nothing selected is a no-op and says nothing at all.
  // Recorded against listen row 51, not engineered around, for the reason
  // above.
  //
  // THE FOUR OF UNIT 8 HAVE BEEN HEARD AND ACCEPTED (14 September 2026, listen
  // row 50); THE FIFTH HAS NOT. Listen row 51 carries it, along with the
  // marker's fuller wording below.

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
   * The selection was emptied: how many lines stopped being selected
   * (register item 46 unit 10).
   *
   * THE FIFTH VOICE, AND IT EXISTS BECAUSE FOUR GESTURES SPOKE AND THIS ONE DID
   * NOT. The sitting of 14 September 2026 accepted the four of unit 8 as built
   * and observed that Clear selection had stayed silent for no reason other
   * than that nobody had asked for it. Its own JSDoc had already named the
   * argument for a voice — a gesture whose whole visible effect is remote from
   * the control — and pointed at listen row 49 to judge it. This is that
   * judgement arriving.
   *
   * IT REPORTS THE COUNT AND NOT THE NEW STATE, deliberately. "Nothing is
   * selected" is what the visible count text already says, and a sentence
   * repeating it would be saying twice what a person can read once; the count
   * of what just STOPPED being selected is the part nothing else carries. Same
   * reasoning speakerAddedSentence gives for reporting the slot and not the
   * picker's selection.
   *
   * "unticked" IS THE ROW'S OWN VERB. The controls are tick boxes and the
   * block's visible hint says "Tick the lines you want", so a person hearing
   * this has already met the word. "Deselected" would introduce a second word
   * for one gesture, which is the divergence the one-display-stem rule exists
   * to prevent, arriving through prose.
   *
   * @param {number} cleared - how many rows were ticked before the clear
   * @returns {string}
   */
  function selectionClearedSentence(cleared) {
    return `Selection cleared, ${pluralise(cleared, "line")} unticked.`;
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

  // Whether a row that carries a suggestion shows it. IN-MEMORY FOR THE SESSION,
  // on exactly the terms the three display modes above are, and a RENDER
  // DECISION rather than a reveal — see the review block's own section for why
  // the design's § 6 corrected an earlier draft that had two reveals. The
  // initial value matches the checkbox's markup default, which ships CLEAR: a
  // change set can be loaded with nobody having asked to see it rendered.
  let showSuggestions = false;

  // Whether a rendered suggestion carries its reason. Ships TICKED, matching
  // the markup and the design's stated default — a reason is useful information
  // and withholding it is the exceptional choice, not offering it. The
  // asymmetry with the flag above is deliberate.
  let showReasons = true;

  // Whether a suggestion that CANNOT BE APPLIED renders in the transcript's own
  // order, or is listed in the review block's table instead. Design section
  // 12's D6, register item 47 unit 14.
  //
  // IT SHIPS CLEAR, AND THE DEFAULT IS THE DECISION RATHER THAN AN INHERITED
  // CONVENTION. The sitting overturned this desk's provisional answer, which
  // was conflicts in sequence as rows: a conflict carries NO CONTROLS, so in
  // edit mode Tab passes straight over it and a person tabbing never meets it
  // at all. A row in the table carries a button, and a button is reachable by
  // Tab.
  //
  // IT REPLACES THE TABLE RATHER THAN ADDING TO IT. Ticked, conflicts render in
  // the transcript exactly as they did before this unit AND the table hides;
  // unticked, the table is the only place they appear. Never both, so a person
  // never tracks two orders at once — which is the property the withdrawn
  // one-sequence reasoning was right about, preserved rather than lost.
  //
  // A RENDER DECISION, NOT A REVEAL, exactly as the two flags above are.
  let showConflictsInTranscript = false;

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
   * The speaker column's PLACEHOLDER (register item 46 unit 11).
   *
   * WHAT IT IS FOR. `transcribe.css` makes the row a flex container and gives
   * the speaker span a minimum width, so that a row printing a label and a row
   * not printing one put their phrase text at the same x. A minimum width
   * cannot do that on its own: a suppressed label leaves NO ELEMENT BEHIND, and
   * flex sizes a column from what is in it. This span is the element the width
   * applies to — the whole of design § 11.1's answer to presentation finding 5.
   *
   * IT DOES NOT CARRY CLASS_SPEAKER, AND THAT IS A DEPARTURE FROM THE UNIT'S
   * OWN SPECIFICATION, TAKEN ON A MEASUREMENT. The specification said the
   * placeholder should carry the real span's class "so one CSS rule sizes
   * both". One rule does size both — `transcribe.css` lists the two selectors
   * in a single rule — so the PURPOSE is met. What could not be met is the
   * letter, because `span.transcribe-speaker` is read at FOUR sites in two
   * tracked instruments as "this row prints a speaker label":
   *
   *   .claude/a11y/sr/transcribe-tree-gate.mjs:990   the speakers drive marker
   *   .claude/a11y/sr/transcribe-tree-gate.mjs:1781  the applied-name reading
   *   .claude/a11y/sr/transcribe-audit-probe.mjs:313 the speakers drive marker
   *   .claude/a11y/sr/transcribe-audit-probe.mjs:873 the element census
   *
   * The two drive markers assert the span is ABSENT from a row when labels are
   * suppressed. A placeholder carrying that class is present on exactly those
   * rows, so both instruments would time out driving `speakers=off` and exit as
   * INSTRUMENT ERRORS — on the very states unit 11 exists to measure. The other
   * two would go on running and silently start counting something else.
   * Redefining a selector four instruments already depend on, to save one line
   * of CSS, is not a trade worth taking.
   *
   * THE CLASS ALSO MAKES THE PLACEHOLDER COUNTABLE BY CONSTRUCTION, which is
   * the second reason it exists. Two of unit 11's halt conditions are counts of
   * placeholders — none in a one-speaker transcript, and the whole-tree
   * `StaticText` count unmoved by them — and counting them as "a
   * `.transcribe-speaker` whose text is empty" would be a count taken on a
   * PROXY. A real speaker span can never be empty today, so the proxy happens
   * to be sound; a class is sound whether or not that stays true.
   *
   * IT IS EMPTY AND CARRIES NO ARIA. An empty span contributes no `StaticText`,
   * so a reader is offered nothing at all by it. `aria-hidden` would be ARIA
   * added for a problem that does not exist, which AGENTS.md's first rule of
   * ARIA forbids — and an `aria-hidden` span is the ghost-element arrangement
   * rule 4 warns about if anything ever focusable were put inside it.
   */
  const CLASS_SPEAKER_PLACEHOLDER = "transcribe-speaker-placeholder";

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
   * The read-only row's own number (register item 47 unit 17).
   *
   * WHY IT EXISTS. Listen row 52 session 2a: "Go to phrase 6" in read-only
   * mode landed on "list with 657 items, [1:04] Speaker 1: For this special
   * episode…" and NO NUMBER WAS HEARD ANYWHERE IN THE LANDING. In read-only
   * mode a row is named by nothing; "Select phrase N" and "Edit phrase N" are
   * the only carriers of the number and both exist in edit mode only. The
   * owner chose a visually-hidden number on every row, over a visible one and
   * over leaving the conflicts table as the only place a number appears.
   *
   * 1-BASED, ON THE TERMS SELECT_LABEL_PREFIX RECORDS: the row id stays 0-based
   * and the words a person hears count from one, so "Phrase 6" and "Go to
   * phrase 6" and "Edit phrase 6" all name the same line.
   *
   * READ-ONLY ONLY. In edit mode the row already says "Select phrase N" and
   * "Edit phrase N"; a third copy would be the same fact three times on one
   * row, 657 times over — the defect EDIT_LABEL_CORRECTED_SUFFIX's
   * one-marker-per-row-per-mode rule exists to prevent. The gate is the `edit`
   * decision every caller already hoists, so no new predicate is added.
   *
   * PROVISIONAL UNTIL LISTEN ROW 52 SESSION 2b. It adds a few characters to
   * every row of a say-all, and whether that is tolerable is heard, not
   * reasoned. The CLASS carries no rule in any stylesheet; it exists so a
   * harness row can find the span without depending on its position.
   */
  const PHRASE_NUMBER_PREFIX = "Phrase ";
  const CLASS_PHRASE_NUMBER = "transcribe-phrase-number";

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
   * A MEASURED SIDE EFFECT — SUPERSEDED AT UNIT 11, AND QUOTED IN PLACE per
   * register items 51 and 56. It read:
   *
   *   "A MEASURED SIDE EFFECT, RECORDED BECAUSE IT IS A QUESTION FOR THE
   *    SITTING AND NOT A THING TO ENGINEER AGAINST BLIND. `.visually-hidden`
   *    positions the marker ABSOLUTELY, so it leaves the inline flow — and
   *    Chrome then drops the single-space text nodes either side of it from the
   *    accessibility tree entirely. Measured 8 September 2026 by verbose-tree
   *    dump: an UNCORRECTED row exposes `StaticText "Speaker 1:"`, `StaticText
   *    " "`, `StaticText "<phrase>"`, while a corrected one exposes `StaticText
   *    "Speaker 1:"`, `StaticText "Corrected."`, `StaticText "<phrase>"` with NO
   *    space node at all. Whether a reader runs those three together or pauses
   *    between them is decided by the reader, not by the tree — which is
   *    precisely the kind of thing this repo refuses to predict from markup.
   *    Listen row 47 (d) is where it is answered. Uncorrected rows are
   *    unaffected, which is why the tree gate's baseline is unmoved by this
   *    unit."
   *
   * IT WAS A TRUE MEASUREMENT AND ITS SUBJECT NO LONGER EXISTS. Unit 11 deleted
   * the separators from EVERY row, so there is no space node for the marker to
   * displace and no difference between the two shapes it contrasts: an
   * uncorrected row now exposes `StaticText "Speaker 1:"`, `StaticText
   * "<phrase>"`, and a corrected one exposes those two with `StaticText
   * "Corrected."` between them.
   *
   * THE QUESTION IT RAISED SURVIVES AND HAS GOT BIGGER, which is why this is a
   * supersession rather than a deletion. It used to ask whether a reader hears
   * a corrected row differently from an uncorrected one; it now asks whether a
   * reader hears ANY row's parts run together, because no row has a space node
   * left. That is the sitting's own § 12.6 ruling — the space is a pause, build
   * the layout and listen afterwards — and listen row 51 carries it.
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
   * IT NAMES BOTH HALVES — WHERE THE LINE CAME FROM AND WHERE IT WENT
   * (register item 46 unit 10). It reads "Speaker changed from Speaker 2 to
   * Amira.", both sides through `speakerDisplayName`, so a named slot reads as
   * its name on either side.
   *
   * THE DESK'S OBJECTION IS WITHDRAWN, AND IS QUOTED IN PLACE RATHER THAN
   * DELETED, per register items 51 and 56:
   *
   *   "IT NAMES WHERE THE LINE CAME FROM AND NOT WHERE IT WENT. `<previous>` is
   *    the display name of `sourceSpeaker` … The owner offered the fuller
   *    \"from Speaker X to Speaker Y\" and it was not taken: THE \"to\" HALF IS
   *    THE LABEL THE ROW ALREADY CARRIES whenever a label prints, so including
   *    it would be the doubling the one-marker-per-row-per-mode rule above
   *    exists to prevent."
   *
   * THE SITTING OF 14 SEPTEMBER 2026 OVERRULED IT, AND THE CASE THE DESK HAD
   * MISSED IS THE SUPPRESSED-LABEL STATE. "whenever a label prints" was doing
   * all the work in that argument and was never tested. With "Repeat the
   * speaker on every line" UNTICKED, a changed row that prints no label carries
   * NEITHER half — not the "to" the desk was economising on, and not a "from"
   * that means anything without it. So the shorter form left the reader with
   * nothing at all on exactly the rows where the marker mattered most. The
   * fuller form is unconditional and costs nothing on the rows that do print a
   * label, where the doubling the withdrawn text feared is a confirmation
   * rather than a repetition: the row says who is speaking NOW, and the marker
   * says the transcription disagreed.
   *
   * ONE MARKER PER ROW PER MODE IS UNCHANGED. What grew is the marker's
   * SENTENCE, not the number of markers, and the selection checkbox's label
   * still carries neither. That rule was heard correct at both sittings.
   *
   * THE MARKER IS DERIVED, SO A ROUND TRIP CLEARS IT WITH NO BOOKKEEPING. It
   * comes from `phrase.speaker !== phrase.sourceSpeaker`, so moving a line back
   * to the slot it arrived in makes the comparison false again and the marker
   * simply stops rendering. That is the state module's "what makes the marker
   * honest", reaching the screen.
   */
  const REASSIGNED_MARKER_PREFIX = "Speaker changed from ";
  // THE JOIN BETWEEN THE TWO HALVES, HOISTED BECAUSE BOTH SURFACES SHARE IT AND
  // NEITHER OWNS IT. The prefixes and the suffix differ per surface and are
  // passed in; this one is part of the sentence itself, so it belongs to the
  // composer rather than to either caller.
  const REASSIGNED_MARKER_JOIN = " to ";
  const REASSIGNED_MARKER_SUFFIX = ".";
  const CLASS_REASSIGNED = "transcribe-reassigned";
  const EDIT_LABEL_REASSIGNED_PREFIX = ", speaker changed from ";

  /**
   * The edit control's suggestion suffixes — design § 12's D3, EDIT MODE
   * ONLY. Both are PROVISIONAL WORDING and are heard again at session 2.
   *
   * THE COMMA IS DOING THE SAME WORK EDIT_LABEL_CORRECTED_SUFFIX's DOES, and
   * that constant's own note is the place that reasoning is set out: it is
   * what stops the name reading as an instruction and gives a reader
   * something to pause on between facts about one control.
   *
   * AN ORDINARY SPACE IS CORRECT HERE AND A NO-BREAK SPACE WOULD BE WRONG,
   * which is worth saying in a commit that adds SUGGESTION_SEPARATOR three
   * lines away. This text goes into ONE text node inside ONE <label>, so
   * there is no element boundary for whitespace to be collapsed at — the
   * blockified-span problem that constant exists for cannot arise.
   */
  const EDIT_LABEL_SUGGESTION_SUFFIX = ", suggestion available";
  const EDIT_LABEL_CONFLICT_SUFFIX = ", suggestion cannot be applied";

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
   * the speaker label only INSIDE its `typeof` branch. THE SAME ARGUMENT COVERS
   * `currentSpeaker` and is why it is not guarded either: the two are compared
   * to reach this function at all, so neither can be absent while the other is
   * present.
   *
   * BOTH SIDES GO THROUGH `speakerDisplayName`, WHICH IS THE WHOLE POINT OF
   * TAKING TWO SLOTS RATHER THAN A SLOT AND A STRING. A caller handing in the
   * row's rendered label would be a second route to the same words, and a row
   * that prints no label has no such string to hand in — which is the case the
   * fuller wording exists for.
   *
   * @param {number} sourceSpeaker - the slot the transcription put the line in
   * @param {number} currentSpeaker - the slot the line is in now
   * @param {Object<string, string>} names - the names map, read once by the
   *   caller
   * @param {string} prefix - REASSIGNED_MARKER_PREFIX or the edit-label one
   * @param {string} suffix - the surface's own punctuation, or ""
   * @returns {string} e.g. `Speaker changed from Speaker 2 to Amira.`
   */
  function reassignedMarkerText(
    sourceSpeaker,
    currentSpeaker,
    names,
    prefix,
    suffix,
  ) {
    const api = moduleOrNull();
    return (
      prefix +
      api.speakerDisplayName({ speaker: sourceSpeaker, names }) +
      REASSIGNED_MARKER_JOIN +
      api.speakerDisplayName({ speaker: currentSpeaker, names }) +
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
  //
  // IT IS A NO-BREAK SPACE SINCE UNIT 13, AND AN ORDINARY SPACE HERE WAS
  // MEASURED TO DO NOTHING. The withdrawn declaration is quoted per register
  // items 51 and 56:
  //
  //   const APPLY_DETAIL_SEPARATOR = " ";
  //
  // The comment above is right that the space is the only thing standing
  // between "Apply name" and "Amira", and right that a space typed into a
  // template literal is invisible to review. IT IS WRONG THAT THE SPACE WAS
  // DOING THE WORK. The detail element is `.visually-hidden` and therefore
  // absolutely positioned, so whitespace at its leading edge is collapsed
  // before the rendered text is formed, and the two words welded in exactly
  // the way the comment was written to prevent — "Apply nameAmira as Speaker
  // 1", read off the accessibility tree on 21 September 2026.
  //
  // LISTEN ROW 51 HEARD THIS CONTROL AND HEARD IT CORRECTLY. It reached the
  // button by Tab, which speaks the ACCESSIBLE NAME, and the name was right
  // throughout — accname inserts its own space around a block-level child.
  // The rendered text is a different path, taken by a reader arrowing through
  // the page in browse mode, and nothing had ever exercised it. THIS IS NOT A
  // REGRESSION: the control has behaved this way since it was built, and the
  // row stays closed. See the row's own entry in chat-owed-sr-listen.md.
  //
  // IT IS NOT `SUGGESTION_SEPARATOR`, THOUGH THE CHARACTER IS THE SAME. That
  // constant belongs to the suggestion wrapper and is named for it; this
  // control is in a different block of the page, built by a different
  // function, and sharing one constant between them would be a coupling
  // neither asked for. The reasoning is written out at SUGGESTION_SEPARATOR
  // and is not repeated here.
  const APPLY_DETAIL_SEPARATOR = String.fromCharCode(0x00a0);
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
   * OMISSION. Its one caller is `buildRow`, whose own callers all refuse on a
   * missing module — renderTranscript logs and returns, patchRow logs and
   * returns, patchRows logs and returns — so this is unreachable with the
   * module absent. The only fallback that would not throw is a locally composed
   * `Speaker N:`, which is the second copy of the wording this function exists
   * to prevent. ANY LATER CALLER MUST GUARD `moduleOrNull()` ITSELF.
   *
   * "Both callers" AND "unit 4b's rename path is the next one" WERE TRUE UNTIL
   * UNIT 10 AND ARE WITHDRAWN. The rename path had its own targeted repaint,
   * which called this function directly and was the second caller; unit 10
   * retired that repaint in favour of `patchRows`, so every route to this
   * function now runs through `buildRow` and the guard it needed lives one
   * level up. Quoted rather than deleted, per register items 51 and 56.
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

  /**
   * The suggestion vocabulary's PROPOSED value, MIRRORED, NEVER IMPORTED —
   * matching how openrouter-embed-transcribe-state.js's own SUGGESTION_STATUS
   * is itself mirrored rather than imported from the Captions Fixer lane. This
   * file reads no state-module constant directly (SUGGESTION_STATUS is not on
   * that module's export list), so the one value this file needs to recognise
   * is typed here and kept in step by eye.
   */
  const SUGGESTION_STATUS_PROPOSED = "proposed";
  // THE OTHER TWO, MIRRORED THE SAME WAY AND FOR THE SAME REASON, added at
  // unit 13 because `reviewableCounts` has to recognise all three rather than
  // only the one this file used to care about. Typed here beside the first so
  // the three stay together and a reader checking the vocabulary finds it in
  // one place.
  /**
   * The two forms `rejectedBy` takes, MIRRORED, NEVER IMPORTED, exactly as
   * the status vocabulary above is. Read out of captions-fixer/ at HEAD on
   * 21 September 2026: `captions-fixer-guards.js` composes
   * `REJECTED_BY_PREFIX + guardName` with the prefix "guard:", and
   * `captions-fixer-ui.js` writes `REJECTED_BY_PERSON`, "person", when a
   * person unticks a row in their own changes table.
   *
   * THEY ARE USED FOR REPORTING ONLY, never for the reviewable decision.
   * `isReviewable` tests whether `rejectedBy` is SET, which needs no
   * knowledge of its vocabulary and cannot drift if they add a third form.
   * Only the log line breaks the total down by cause, and a form it does not
   * recognise falls into "decided before this surface saw them" — which is
   * true of any form, so the tally stays correct rather than merely
   * plausible.
   */
  const REJECTED_BY_GUARD_PREFIX = "guard:";
  const REJECTED_BY_PERSON = "person";

  const SUGGESTION_STATUS_ACCEPTED = "accepted";
  const SUGGESTION_STATUS_REJECTED = "rejected";

  const CLASS_SUGGESTION = "transcribe-suggestion";
  // THE TWO HALVES, GROUPED — register item 47 unit 8. Each is ONE element
  // holding its own hidden label plus whatever inline content belongs to it
  // (unchanged text nodes and, per half, a <del> or an <ins>). See
  // buildSuggestionWrapper's own doc comment for why this stopped being a flat
  // list of siblings.
  const CLASS_SUGGESTION_WAS = "transcribe-suggestion-was";
  const CLASS_SUGGESTION_PROPOSED = "transcribe-suggestion-proposed";
  const CLASS_SUGGESTION_REASON = "transcribe-suggestion-reason";

  /**
   * ONE ELEMENT PER PART OF A REASON — register item 47 unit 18, § 4, from
   * listen row 52 session 2a's request that a multi-pair reason stop reading
   * as a wall.
   *
   * THE SPLIT IS A NEWLINE, AND THE SPLIT IS SAFE ONLY BECAUSE THE OTHER LANE
   * SAYS SO. Unit 16 halted this at grounding: `expand()` in
   * captions-fixer-stage-recurring.js joined its pair sentences with a single
   * space, which every sentence also contains many times over, so no split
   * could tell a boundary from a word gap. The Captions Fixer lane has since
   * agreed to change that join to a newline, and a newline cannot occur
   * INSIDE a pair sentence: since their `52661f5` the recurring stage refuses
   * any pair whose `from` or `to` holds a carriage return or a newline, in
   * both `discover` and `expand`. So the newline is a boundary and nothing
   * else, which is what makes it safe to split on.
   *
   * INERT UNTIL THEIR CHANGE LANDS. A reason with no newline yields exactly
   * one part, so today's space-joined fixtures render exactly as before, and
   * the two changes are order-free: theirs can land before or after this one
   * and the page is correct either way. The shipped fixtures are deliberately
   * NOT changed in this unit, so every review figure it reports stays
   * attributable to the styling rather than to new content; a later unit
   * points the fixture at the new shape when their hash arrives.
   *
   * WRITTEN AS A CODE POINT, NEVER AS A LITERAL OR AN ESCAPE, per register
   * item 83 (b): an escape in source is what a shell or an editing tool
   * collapses, and the collapse is invisible.
   *
   * NOT A LIST. `<ul>` inside the wrapper would disarm the tree gate, whose
   * walk stops on entering the fourth `listitem` inside `#transcribe-results`
   * — the three transcript rows are the first three, and phrase 3 is the
   * third, so a nested item in its reason would end every pinned walk part
   * way through that row. The parts are plain spans the stylesheet lays out
   * as blocks, with indentation and NEVER a marker character: Chromium
   * exposes generated content as text, and a bullet would be read aloud on
   * every pair.
   */
  const CLASS_SUGGESTION_REASON_PART = "transcribe-suggestion-reason-part";
  const REASON_PART_SEPARATOR = String.fromCharCode(0x0a);

  /**
   * Split a reason into its newline-separated parts, dropping empty ones.
   *
   * EMPTY PARTS ARE DROPPED, so a trailing newline or a doubled one cannot
   * render an empty block — an element a reader is offered with nothing in
   * it. A reason carrying no newline comes back as a one-element array, and
   * that is the whole of the shipped case today.
   *
   * @param {string} reason
   * @returns {string[]}
   */
  function splitReasonParts(reason) {
    return String(reason)
      .split(REASON_PART_SEPARATOR)
      .filter((part) => part.length > 0);
  }
  /**
   * THE HALF'S LABEL, IN ITS OWN ELEMENT — register item 47 unit 15.
   *
   * IT HAD NO ELEMENT AND NO CLASS UNTIL NOW, AND THE WITHDRAWN REASONING IS
   * QUOTED HERE per register items 51 and 56. `appendHalfLabel` said:
   *
   *   "NO CLASS AND NO WRAPPING SPAN. The label is a bare text node in its
   *    half, so it inherits that half's weight — 400 on the original and 700
   *    on the proposal — which makes the two labels differ in exactly the
   *    direction the halves already differ. A wrapper would add a node to the
   *    accessibility tree for a styling hook nothing needs."
   *
   * THE FIRST SENTENCE OF THAT IS WHY IT HAD TO CHANGE. Inheriting the half's
   * weight is exactly what makes the label INDISTINGUISHABLE from the words
   * beside it: on the proposal both label and text are 700, and the owner
   * read "SuggestedThis is a podcast" off a screenshot as one run of words.
   * The two labels differing from EACH OTHER was never the question; a label
   * differing from its own half's text is.
   *
   * THE TREE COST IS NOT ZERO, AND THIS COMMENT SAID IT WAS. Withdrawn text,
   * quoted per register items 51 and 56:
   *
   *   "THE TREE COST IS ZERO, MEASURED RATHER THAN ARGUED. A `<span>` with no
   *    role and no name contributes no `StaticText` of its own — the text
   *    nodes inside it are what the walk reads, and they existed before. The
   *    pinned tree-gate figures move for the label's CHANGED TEXT (a colon and
   *    a separator), not for the element."
   *
   * THE FIRST HALF IS RIGHT AND THE SECOND IS WRONG. A span with no role and
   * no name does contribute no `StaticText`. But it DOES contribute an ignored
   * node to the verbose tree the gate counts: measured across the eight review
   * states, `none` moves by +6 with reasons on and +4 with them off. So the
   * figures move for the ELEMENTS as well as for the text.
   *
   * IT WAS WRITTEN AS "MEASURED RATHER THAN ARGUED" BEFORE ANYTHING HAD BEEN
   * MEASURED, which is the part worth carrying. The claim was reasoned from
   * how the accessibility tree treats an unnamed span, it was half right, and
   * the phrase asserting it was a reading is what would have stopped the next
   * reader checking. The real figures, their decomposition and the one piece
   * of the arithmetic that does NOT close are in
   * `.claude/a11y/sr/transcribe-tree-gate.mjs`'s unit 15 re-pin block.
   */
  const CLASS_SUGGESTION_LABEL = "transcribe-suggestion-label";

  /**
   * WHICH HALF A LABEL BELONGS TO — register item 47 unit 16, § 3.
   *
   * A DATA ATTRIBUTE, NOT A SECOND CLASS, so the stylesheets can style the
   * two capsules apart while every existing rule and harness row that reads
   * `.transcribe-suggestion-label` keeps reading one class. A conflict's
   * label is SUGGESTED, because the only half a conflict renders is the
   * proposal.
   *
   * IT REACHES NO ACCESSIBILITY TREE. A `data-*` attribute has no role, no
   * name and no state, so it moves nothing a screen reader is offered.
   */
  const DATA_SUGGESTION_HALF = "data-suggestion-half";
  const SUGGESTION_HALF = Object.freeze({
    ORIGINAL: "original",
    SUGGESTED: "suggested",
  });

  // A SEPARATE CLASS FROM CLASS_SUGGESTION_REASON, DELIBERATELY. The reason
  // span carries the entry's own `reason` field; this one carries the
  // composed sentence explaining why a suggestion could not be resolved
  // against the row at all. Conflating the two would make a harness row
  // asserting "the reason is present/absent per the toggle" indistinguishable
  // from one asserting "the conflict sentence is always shown" — two
  // different rules that happen to look alike once rendered.
  const CLASS_SUGGESTION_CONFLICT = "transcribe-suggestion-conflict";

  /**
   * THE SEPARATOR, AND IT MUST BE A NO-BREAK SPACE. U+00A0.
   *
   * AN ORDINARY SPACE DOES NOTHING HERE, MEASURED, and the measurement is why
   * this constant exists at all (amendment 2's ruling 1, after unit 13's
   * halt). `.visually-hidden` sets `position: absolute`, which BLOCKIFIES the
   * span, and whitespace at a block's edge is collapsed before the rendered
   * text is formed. So the leading space that `buildSuggestionControl` had
   * carried since unit 10 was discarded, and a screen reader arrowing onto
   * the control in browse mode read "Acceptsuggestion for phrase 2".
   *
   * FOUR VARIANTS WERE PUT THROUGH THE ACCESSIBILITY TREE, headless
   * chromium-1223, CDP `Accessibility.getFullAXTree`, 21 September 2026. The
   * joined `StaticText` sequence of the button:
   *
   *   leading ordinary space in the hidden span   "Acceptsuggestion for…"
   *   trailing ordinary space on the visible text "Acceptsuggestion for…"
   *   NO separator at all                         "Acceptsuggestion for…"
   *   leading U+00A0 in the hidden span           "Accept suggestion for…"
   *
   * THE FIRST THREE ARE INDISTINGUISHABLE FROM EACH OTHER, which is exactly
   * why the defect read as correct in source for three units: the space was
   * there, and it was doing nothing.
   *
   * THE ACCESSIBLE NAME WAS NEVER THE PROBLEM AND IS NOT WHAT THIS FIXES.
   * `name` computed to "Accept suggestion for phrase 2" throughout, because
   * accname inserts its own space around a block-level child. The rendered
   * text is the path a browse-mode reader takes, and it is the one that
   * welded. The cost of U+00A0 is that the NAME now carries a double space —
   * accepted by the owner, since speech collapses whitespace and it is
   * inaudible, and Label in Name is unaffected because the visible word is
   * still contained in the name.
   *
   * THE APPLY BUTTON IS NOT THE REFERENCE, AND WAS BELIEVED TO BE. It carries
   * the identical defect — " Apply nameAmira as Speaker 1" — and listen row
   * 51 heard it by Tab, which speaks the name, so its rendered text was never
   * exercised by ear. It is fixed in its own commit.
   *
   * BUILT WITH `String.fromCharCode`, NEVER A LITERAL AND NEVER AN ESCAPE. A
   * literal U+00A0 is invisible in every editor and indistinguishable from a
   * space in review, and `\u00A0` inside a string is one careless
   * reformatting away from being read as text. This is the spirit of register
   * item 83 (b), which is about a byte nobody could see.
   *
   * THE RULE AGAINST LITERAL WHITESPACE BETWEEN ELEMENTS STILL STANDS. This
   * lives INSIDE the text of a span, never as a text node between two
   * elements, so it cannot generate an anonymous box.
   */
  const SUGGESTION_SEPARATOR = String.fromCharCode(0x00a0);

  /**
   * The two halves' labels — VISIBLE TEXT since design § 12's D1, each
   * followed by a visually-hidden continuation so a reader hears "Original
   * phrase" and "Suggested phrase" while a sighted reader sees one word.
   *
   * THE VISIBLE WORDS REPLACE "was" AND "suggested", which were hidden
   * entirely. The owner's reasoning, recorded at the sitting: the extra word
   * gives context to someone relying on hearing, and the visible labels are
   * what tell a new sighted reader which half is which.
   *
   * A CONFLICT CARRIES "Suggested" ONLY, because it has no original to show.
   *
   * THE LABEL LIVES IN ITS OWN SPAN SINCE UNIT 15 — see
   * CLASS_SUGGESTION_LABEL for why the "no wrapping span" decision was
   * withdrawn, and `appendHalfLabel` for the shape it builds.
   */
  const SUGGESTION_WAS_TEXT = "Original";
  const SUGGESTION_SUGGESTED_TEXT = "Suggested";
  const SUGGESTION_LABEL_CONTINUATION = "phrase";
  /**
   * THE VISIBLE COLON — register item 47 unit 15.
   *
   * IT REPLACES A SEPARATOR THAT WAS DOING NOTHING VISIBLE. Before this unit
   * the hidden continuation carried a separator, the word "phrase" and a
   * SECOND separator, and that trailing one existed only so a reader would not
   * hear "phraseThis is a podcast". It is inside an absolutely-positioned
   * span, so it painted nothing, and a sighted reader saw "SuggestedThis is a
   * podcast" — the defect this unit exists to close.
   *
   * THE TWO SEPARATORS ARE NAMED IN WORDS HERE AND NOT QUOTED AS CHARACTERS,
   * AND THAT IS NOT FASTIDIOUSNESS. A first draft of this very comment quoted
   * them, and the editing tool wrote two LITERAL U+00A0 characters into the
   * file — the same defect unit 13's scan found seven of, reintroduced by a
   * comment explaining the mechanism that forbids it. Caught by the scan
   * before the commit; recorded so the next comment about a separator is
   * written the same way.
   *
   * A COLON SEPARATES BOTH AUDIENCES WITH ONE CHARACTER. It is visible, so it
   * ends the label on screen; it is in the rendered text, so it ends the label
   * for a reader; and the separator AFTER it does the job the withdrawn
   * trailing one did.
   *
   * NOT `content: ":"`. A generated colon is not in the DOM, is dropped by
   * some user stylesheets, and — the reason that decides it — would be absent
   * from the accessible text this unit is measured by.
   */
  const SUGGESTION_LABEL_COLON = ":";

  /**
   * The conflict sentences, keyed by `suggestionTextFor`'s refusal token.
   *
   * BOTH ARE PROVISIONAL WORDING (design § 5, § 1 conflict case). Listen row
   * 52 part (c) decides them; nothing here should be read as settled.
   */
  const SUGGESTION_CONFLICT_TEXT = Object.freeze({
    // REWRITTEN AT DESIGN § 12's D5. Each sentence now names a cause the
    // person would recognise AND the step still open to them, which is
    // editing the line themselves. The withdrawn wording is quoted here per
    // register items 51 and 56:
    //
    //   "stale-base": "This line has changed since the suggestion was made."
    //   "label-changed": "This suggestion changes the speaker label."
    //
    // The sitting could not act on either. The first states a fact and stops;
    // the second says "the speaker label" when neither half of a conflict
    // shows one, so there was nothing on screen for the words to refer to.
    "stale-base":
      "This suggestion was made for an earlier version of this line, so it cannot be applied. You can still edit the line yourself.",
    // THE TOKEN THIS SENTENCE ANSWERS DID NOT EXIST UNTIL UNIT 13. Before it,
    // a row whose SPEAKER changed and whose words did not also refused
    // `stale-base` — so the sentence above was printed on it, and it was
    // false. See `suggestionTextFor`'s rule 3.
    "speaker-changed":
      "This suggestion was made before this line's speaker was changed, so it cannot be applied. You can still edit the line yourself.",
    // NO "you can still edit" TAIL, DELIBERATELY, and the omission is the
    // sitting's. Editing the line does not answer this one: the suggestion
    // wants to change WHO SPOKE, and that is register item 46's controls
    // rather than this surface's. Offering a remedy that does not remedy is
    // worse than offering none.
    //
    // WHETHER A PERSON CAN REACH THIS SENTENCE AT ALL IS NOW SETTLED, AND THE
    // ANSWER IS NO — see `isReviewable`. The Captions Fixer lane's
    // `speakerLabelUnchanged` guard holds such an entry before the change set
    // leaves them, and D9 excludes a held entry from this surface entirely.
    // The refusal stays underneath as defence in depth, reachable only if
    // somebody upstream cleared `rejectedBy` or an unguarded label shape
    // arrived.
    "label-changed":
      "This suggestion would change who said this line, so it cannot be applied.",
  });

  /**
   * What a conflict says when the token is one this file does not recognise.
   *
   * IT REPLACES A FALLBACK THAT PRINTED THE RAW TOKEN. `buildSuggestionWrapper`
   * used to render `SUGGESTION_CONFLICT_TEXT[reason] || resolution.reason`, so
   * an unrecognised token reached the page as a machine string — "stale-base"
   * on a line of a transcript. That was never reachable while the pure module
   * emitted exactly the two tokens above, which is why it stood; it becomes
   * reachable the moment a token is added, and the two files are committed
   * separately by necessity.
   *
   * SO THIS LANDS BEFORE ANY NEW TOKEN EXISTS, AND IS INERT UNTIL ONE DOES.
   * That ordering is the point (amendment 2, ruling 4): no committed state of
   * this repository renders a raw token or an `undefined` to a person, at any
   * point in the sequence, whatever order the remaining commits land in.
   *
   * THE WORDING IS THE SAFE INTERSECTION OF THE CASES IT MIGHT COVER. It says
   * the suggestion cannot be applied — which is true of every refusal, since a
   * refusal IS that — and offers the step that is always still open, matching
   * the shape design § 12's D5 sets for the sentences it does name. It
   * deliberately does NOT guess at a cause: a wrong cause is worse than none,
   * and a token this file has never heard of is exactly the case where a cause
   * cannot be known.
   */
  const SUGGESTION_CONFLICT_FALLBACK_TEXT =
    "This suggestion cannot be applied. You can still edit the line yourself.";

  /**
   * The sentence for one refusal token — ONE SOURCE, TWO SURFACES (register
   * item 47 unit 14).
   *
   * THE WRAPPER AND THE TABLE MUST NOT WORD THE SAME CONFLICT DIFFERENTLY, and
   * the only way to guarantee it is for neither to know the other exists. Both
   * ask this function, and it is the whole of what either knows about the
   * wording, the unrecognised-token fallback included.
   *
   * IT RETURNS THE BARE SENTENCE AND ADDS NO SEPARATOR, which is the one thing
   * the two callers genuinely differ on. In the wrapper the sentence follows
   * the proposal's last word with no node between them, so
   * `buildSuggestionWrapper` prepends SUGGESTION_SEPARATOR — the sixth
   * run-together, never reported at the sitting and separated anyway. In a
   * table cell the sentence is the cell's only content and has nothing to run
   * into, so a separator there would be an inset nobody asked for.
   *
   * @param {string} reason - `suggestionTextFor`'s refusal token
   * @returns {string}
   */
  function conflictSentenceFor(reason) {
    return SUGGESTION_CONFLICT_TEXT[reason] || SUGGESTION_CONFLICT_FALLBACK_TEXT;
  }

  /**
   * Accept and Dismiss (register item 47 unit 10; design § 7).
   *
   * IDS ARE 0-BASED, MATCHING EVERY OTHER CONTROL ON THE ROW — see
   * EDIT_ID_STEM's own note. `transcribe-accept-13` and `transcribe-edit-13`
   * are the same row's controls.
   *
   * CONFLICT_ID_STEM NAMES THE SENTENCE, NOT THE WRAPPER. A conflict row has
   * no button, so its focus target — for both "Next suggestion" and the
   * unified focus rule Accept/Dismiss share — is the conflict sentence
   * itself, which is why it takes an id and `tabindex="-1"` at all
   * (buildSuggestionWrapper).
   *
   * NEITHER STEM IS A PREFIX OF ANY OTHER STEM IN THIS FILE, matching the
   * safety condition rowIndexFrom's own note states for EDIT_ID_STEM and
   * SELECT_ID_STEM: a startsWith test cannot claim another control's rows.
   */
  const ACCEPT_ID_STEM = "transcribe-accept-";
  const DISMISS_ID_STEM = "transcribe-dismiss-";
  const CONFLICT_ID_STEM = "transcribe-suggestion-conflict-";

  /**
   * The conflicts table's own ids and the stem of its per-row button (design
   * section 12's D6; register item 47 unit 14).
   *
   * `CONFLICT_GOTO_ID_STEM` IS 0-BASED LIKE EVERY OTHER STEM ON THIS SURFACE,
   * while the button's VISIBLE TEXT carries the 1-based phrase number a person
   * reads. `transcribe-conflict-goto-5` and `transcribe-phrase-5` are the same
   * row, and the button on it says "Go to phrase 6".
   *
   * IT IS NOT A PREFIX OF ANY OTHER STEM IN THIS FILE AND NONE IS A PREFIX OF
   * IT — the safety condition `rowIndexFrom`'s own note states, checked against
   * all six: `transcribe-edit-`, `transcribe-select-`, `transcribe-accept-`,
   * `transcribe-dismiss-`, `transcribe-suggestion-conflict-` and
   * `transcribe-phrase-`.
   */
  const CONFLICT_TABLE_ID = "transcribe-review-conflicts";
  const CONFLICT_TABLE_BODY_ID = "transcribe-review-conflicts-body";
  const CONFLICT_OPTION_ID = "transcribe-review-conflict-option";
  const CONFLICT_TOGGLE_ID = "transcribe-review-show-conflicts";
  const CONFLICT_GOTO_ID_STEM = "transcribe-conflict-goto-";

  /**
   * The visible text of a table row's button, composed in the one place that
   * builds it.
   *
   * A BUTTON AND NOT A LINK, which is a semantic decision rather than a styling
   * one. It runs a scripted focus move inside a page that is already open: it
   * navigates to no URL, adds no history entry, and offers nothing a person
   * could open in a new tab. `<a href>` would promise all three.
   *
   * THE WHOLE NAME IS VISIBLE TEXT. "Go to phrase 6" needs no visually-hidden
   * continuation and therefore needs no separator, so the run-together defect
   * SUGGESTION_SEPARATOR exists for cannot arise here — there is only one text
   * node. Label in Name is satisfied by construction rather than by care.
   *
   * @param {number} index - the phrase's 0-based index
   * @returns {string}
   */
  function conflictGotoText(index) {
    return `Go to phrase ${index + 1}`;
  }

  const ACCEPT_VISIBLE_TEXT = "Accept";
  const DISMISS_VISIBLE_TEXT = "Dismiss";

  /**
   * The controls group — the suggestion wrapper's fourth child, holding
   * Accept and Dismiss together (register item 47 unit 10; design § 7,
   * dispatch note on grouping).
   *
   * GROUPED FOR THE SAME REASON THE TWO DIFF HALVES ARE: a grid container
   * turns each contiguous run of text into an anonymous grid item, so two
   * buttons as direct children of `.transcribe-suggestion` would each want
   * their own cell. One element holding both keeps the placement to the one
   * cell the reason span already occupies (`grid-column: 1 / -1` in
   * transcribe.css).
   */
  const CLASS_SUGGESTION_CONTROLS = "transcribe-suggestion-controls";

  /**
   * The row index a suggestion CONTROL's id names, or null when the target
   * is not one — the sibling of `rowIndexFrom` this file already has for
   * `<input>` controls (EDIT_ID_STEM, SELECT_ID_STEM).
   *
   * NOT `rowIndexFrom` ITSELF, AND THAT IS DELIBERATE. That function's own
   * tag test — `target.tagName !== "INPUT"` — is there because both of its
   * stems only ever name an `<input>`; Accept and Dismiss are `<button>`
   * elements and a conflict's focus target is a `<span>`, so reusing that
   * test would refuse every one of them by construction. Everything else
   * about the id-reading contract is identical, which is why this function
   * exists rather than widening `rowIndexFrom`'s tag test for controls that
   * function was never written to name.
   *
   * @param {EventTarget|null} target
   * @param {string} stem - ACCEPT_ID_STEM, DISMISS_ID_STEM or CONFLICT_ID_STEM
   * @returns {number|null}
   */
  function suggestionControlIndexFrom(target, stem) {
    if (!target || typeof target.id !== "string" || !target.id.startsWith(stem)) {
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
   * Build one suggestion control — Accept or Dismiss.
   *
   * THE VISIBLE TEXT STAYS INSIDE THE ACCESSIBLE NAME, THROUGH A
   * VISUALLY-HIDDEN SPAN RATHER THAN `aria-label` — the pattern the Apply
   * button already uses (design § 5). "Accept suggestion for phrase 14" is
   * one accessible name, built from a visible word a sighted person reads and
   * a continuation only a screen reader hears; neither half is `aria-label`,
   * so AGENTS.md's first rule of ARIA (native HTML first) is not in tension
   * with it.
   *
   * `createTextNode` ONLY, matching every other string this file puts on a
   * row: "Accept"/"Dismiss" are this file's own words rather than a phrase or
   * a service's output, but the rule is simpler kept absolute than qualified.
   *
   * @param {string} idStem - ACCEPT_ID_STEM or DISMISS_ID_STEM
   * @param {number} index - the phrase's 0-based index
   * @param {string} visibleText - "Accept" or "Dismiss"
   * @returns {HTMLButtonElement}
   */
  function buildSuggestionControl(idStem, index, visibleText) {
    const button = document.createElement("button");
    button.type = "button";
    button.id = idStem + index;
    button.appendChild(document.createTextNode(visibleText));

    const hidden = document.createElement("span");
    hidden.className = CLASS_VISUALLY_HIDDEN;
    // THE LEADING CHARACTER IS A NO-BREAK SPACE AND NOT A SPACE. It used to
    // be an ordinary space, which was measured to do NOTHING — it is at the
    // leading edge of an absolutely-positioned block and is collapsed before
    // the rendered text is formed, so a browse-mode reader heard
    // "Acceptsuggestion for phrase 2". See SUGGESTION_SEPARATOR for the four
    // variants that were put through the accessibility tree, and for why the
    // accessible NAME was correct throughout and is not what this fixes.
    hidden.appendChild(
      document.createTextNode(
        `${SUGGESTION_SEPARATOR}suggestion for phrase ${index + 1}`,
      ),
    );
    button.appendChild(hidden);

    return button;
  }

  /**
   * The edit control's suggestion suffix, or "" when there is none
   * (design § 12's D3).
   *
   * BOTH WORDINGS ARE PROVISIONAL and are heard again at session 2.
   *
   * THE TWO CASES ARE THE TWO A PERSON CAN ACT ON DIFFERENTLY. An applicable
   * suggestion has an Accept button further along the row; a conflict has
   * none, and the only thing left is to edit the line — which is what this
   * control is. Saying "suggestion available" on a conflict would send a
   * person looking for a button that is not there, which is the cost the
   * stylesheet's own conflict rule is already written to avoid on screen.
   *
   * IT TAKES THE RESOLVED SUGGESTION, NOT THE ENTRY, because "applicable"
   * is a property of the resolution against the phrase's CURRENT text and
   * not of the entry — a line corrected by hand turns an applicable
   * suggestion into a conflict with nothing having touched the change set.
   *
   * @param {object|null} suggestion - `suggestionForRow`'s answer
   * @returns {string}
   */
  function suggestionEditLabelSuffix(suggestion) {
    if (!suggestion) return "";
    return suggestion.resolution.ok
      ? EDIT_LABEL_SUGGESTION_SUFFIX
      : EDIT_LABEL_CONFLICT_SUFFIX;
  }

  /**
   * Put a half's label on it — the visible word, its hidden continuation, and
   * the separators either side of both (design § 12's D1 and D2).
   *
   * ONE FUNCTION FOR THREE CALL SITES, because the three-node shape is easy
   * to get subtly different and the difference is invisible on screen: the
   * applicable branch builds two halves and the conflict branch builds one,
   * and a conflict whose label separated differently from an applicable one
   * would be a defect nobody could see and only a reader could hear.
   *
   * THREE SEPARATORS, EACH DOING A DIFFERENT JOB, and none of them removable:
   *
   *   before the visible word  separates this half from whatever precedes it
   *                            in the rendered text — the previous half's
   *                            last word, with no node in between. This is
   *                            "beyond.suggestedThis" in the sitting's list.
   *   before "phrase"          separates the visible word from its hidden
   *                            continuation — "Acceptsuggestion", one half
   *                            of the same defect.
   *   after "phrase"           separates the label from the half's own words
   *                            — "wasThis" in the sitting's list.
   *
   * UNIT 15 MOVES THE FIRST OUT OF SIGHT AND REPLACES THE THIRD. The three
   * jobs are unchanged and every one is still done; what changed is where the
   * characters doing them live.
   *
   * THE WITHDRAWN SENTENCE IS QUOTED per register items 51 and 56, because it
   * recorded a cost the owner later declined to keep paying:
   *
   *   "THE FIRST IS VISIBLE, one space of inset before each label, and that is
   *    accepted rather than overlooked: both halves carry it, so the columns
   *    stay aligned with each other."
   *
   * The alignment argument was sound and the inset was still wrong — the
   * owner read it off a screenshot as a one-character indent on every part,
   * which is what a stray indent looks like rather than what a deliberate one
   * does. It now lives in a `.visually-hidden` span of its own, containing
   * NOTHING BUT the separator, so the rendered text keeps the break and the
   * page loses the indent.
   *
   * A HIDDEN SPAN CARRYING ONLY U+00A0 IS A NEW CASE AND WAS MEASURED, NOT
   * ASSUMED. Unit 13 proved a no-break space survives at the LEADING EDGE of
   * a hidden span that also carries words; a span whose whole content is that
   * one character is a different question, because an empty or
   * whitespace-only text node is exactly the kind of thing a layout engine
   * declines to box. Measured at unit 15, headless chromium-1223, CDP
   * `Accessibility.getFullAXTree`: the separator arrives as its own
   * `StaticText` and all three boundaries hold. The figures are in the design
   * document's revision 9.
   *
   * THE THIRD SEPARATOR IS NOW THE ONE AFTER THE COLON, and the colon is
   * visible. See SUGGESTION_LABEL_COLON. The hidden continuation therefore no
   * longer ends with a separator: it would be a second break between "phrase"
   * and a colon that already reads as the end of a label.
   *
   * THE VISIBLE WORD, ITS HIDDEN CONTINUATION AND THE COLON ARE ONE SPAN.
   * That is what the stylesheet needs, and it is also what keeps them one
   * thing: a rule that made the label distinct without the colon would leave
   * the colon looking like the first character of the phrase.
   *
   * THE SEPARATOR AFTER THE COLON LEFT THE LABEL AT UNIT 16, and the colon did
   * not. The label became a capsule — a border and padding round the word and
   * its colon — and a separator inside it would have sat inside the border as
   * a blank space before the closing edge, so the capsule's right padding read
   * wider than its left. It is now the only content of a plain span straight
   * AFTER the label: still inside the text of a span, so the rule against a
   * text node between two elements holds, and still visible, because it is
   * now the space between the capsule and the phrase's first word. The joined
   * text a reader is offered is the same characters in the same order.
   *
   * @param {HTMLElement} half - the half element, already classed and empty
   * @param {string} visibleText - SUGGESTION_WAS_TEXT or …SUGGESTED_TEXT
   * @param {string} halfName - a SUGGESTION_HALF value, written to the label's
   *   DATA_SUGGESTION_HALF attribute
   */
  function appendHalfLabel(half, visibleText, halfName) {
    appendHiddenSeparator(half);

    const label = document.createElement("span");
    label.className = CLASS_SUGGESTION_LABEL;
    label.setAttribute(DATA_SUGGESTION_HALF, halfName);
    label.appendChild(document.createTextNode(visibleText));

    const continuation = document.createElement("span");
    continuation.className = CLASS_VISUALLY_HIDDEN;
    continuation.appendChild(
      document.createTextNode(
        SUGGESTION_SEPARATOR + SUGGESTION_LABEL_CONTINUATION,
      ),
    );
    label.appendChild(continuation);

    label.appendChild(document.createTextNode(SUGGESTION_LABEL_COLON));

    half.appendChild(label);

    const afterLabel = document.createElement("span");
    afterLabel.appendChild(document.createTextNode(SUGGESTION_SEPARATOR));
    half.appendChild(afterLabel);
  }

  /**
   * Put a part's leading separator on it, out of sight — register item 47
   * unit 15.
   *
   * ONE FUNCTION FOR ALL FOUR PART BOUNDARIES the sitting heard weld, so they
   * cannot drift into four slightly different spellings of the same thing.
   * `appendHalfLabel` calls it for the original and the proposed halves;
   * `buildSuggestionWrapper` calls it for the reason and for the conflict
   * sentence.
   *
   * IT IS `.visually-hidden`, NOT `aria-hidden` AND NOT A BARE TEXT NODE. A
   * bare text node is what it replaces, and it painted. `aria-hidden` would
   * remove the very thing it exists to contribute.
   *
   * THE CONFLICT SENTENCE WAS THE FOURTH AND WAS LEFT OUT AT UNIT 15. The
   * withdrawn reasoning is quoted here per register items 51 and 56:
   *
   *   "THE CONFLICT SENTENCE DELIBERATELY DOES NOT USE THIS. It carries its
   *    own leading separator as a bare text node, and that is left alone at
   *    unit 15 rather than swept up: the three boundaries this unit was asked
   *    to move are the three the owner saw, and the conflict sentence only
   *    renders when a person ticks 'Show conflicts in the transcript'. It is
   *    the same shape and is reported as such rather than changed in passing."
   *
   * THE DESK OVERTURNED IT, and the reason is worth keeping: listen row 52's
   * session 2a part (m) ticks that very checkbox and reads phrase 6, so the
   * owner meets the indent mid-sitting. "Only behind a checkbox" was a true
   * statement about the DEFAULT state and a poor argument about THIS one — a
   * defect the next sitting is about to walk into is not a defect to report
   * and leave.
   *
   * @param {HTMLElement} part - the element the separator belongs in front of
   */
  function appendHiddenSeparator(part) {
    const separator = document.createElement("span");
    separator.className = CLASS_VISUALLY_HIDDEN;
    separator.appendChild(document.createTextNode(SUGGESTION_SEPARATOR));
    part.appendChild(separator);
  }

  /**
   * Resolve what a row's suggestion wrapper should render, or null when
   * nothing should (register item 47 unit 7).
   *
   * CALLED FROM ALL THREE ROW-BUILD SITES — renderTranscript, patchRow and
   * patchRows — so the eligibility rule and the diff computation live in
   * exactly one place. A rule copied at three call sites is the defect
   * `speakerLabelFor` exists to prevent, in miniature; this function is that
   * one place, matching how `labelsAreInformative` and the other hoisted
   * decisions are each computed once and handed to `buildRow` already taken.
   *
   * IT GOES THROUGH `resolveSuggestionAt`, THE SAME SINGLE-INDEX RESOLVER
   * `reviewResolutions` uses — never a locally recomputed `speakerLabel`.
   * That function's own doc comment names the trap this avoids (register
   * item 47 unit 7): the change
   * set's `original` was built against the Captions Fixer lane's adapter,
   * which inlines a label on EVERY phrase carrying a speaker (EVERY_LINE, no
   * `mode`), not only the rows this file's own ON_CHANGE display prints one
   * for. Passing the DISPLAY-resolved `speakerLabel` — the one `buildRow`
   * itself already receives, computed WITH a `mode` — would hand `null` for
   * every suppressed row and turn a whole transcript's worth of applicable
   * suggestions into silent `stale-base` conflicts. Fixture case 1 in the
   * suggestions-fixture provenance note is the row that would show it.
   *
   * A WRAPPER RENDERS ONLY WHEN ALL OF: suggestions are on, the phrase carries
   * a suggestion, and that suggestion's status is "proposed" — an accepted or
   * dismissed suggestion carries no wrapper (design § 2). Resolution failure
   * (`suggestionTextFor` returning `ok: false`) does NOT suppress the
   * wrapper: a conflict is itself something the wrapper renders, per design
   * § 5's second shape.
   *
   * ASKS THE STATE MODULE DIRECTLY, THE WAY THE CALLERS DO FOR `edited` AND
   * `reassigned` — never `buildRow` itself, which decides nothing. This
   * function lives beside `buildRow` rather than inside it for exactly that
   * reason: it is the caller's job to ask the state module, and this is the
   * one place that job is done for suggestions.
   *
   * @param {object} api - the transcribe module (moduleOrNull()'s answer)
   * @param {object} state - the transcribe state module (stateOrNull()'s
   *   answer), or null
   * @param {Array} phrases - the whole phrase array, for `previousSpeakerAt`
   * @param {number} index - the phrase's 0-based index
   * @param {boolean} labelsAreInformative - hoisted once by the caller,
   *   `api.distinctSpeakerCount(result) > 1`
   * A CONFLICT'S WRAPPER RENDERS HERE ONLY WHEN THE PERSON HAS ASKED FOR IT —
   * design section 12's D6, register item 47 unit 14. By default a suggestion
   * that cannot be applied shows nothing in the transcript and is listed in
   * the review block's table instead. Ticked, the wrapper comes back exactly
   * as it was and the table hides; the two are alternatives and never both.
   *
   * IT RETURNS THE SUGGESTION EITHER WAY, CARRYING `inTranscript`, AND THAT IS
   * A DECISION UNIT 14 HAD TO TAKE BECAUSE D6 DOES NOT COVER IT. Returning
   * null for a conflict is the obvious reading of "it leaves the transcript",
   * and it silently takes D3's edit label with it: the label would stop saying
   * ", suggestion cannot be applied" and an edit-mode row would then say
   * NOTHING WHATEVER about a line the model had a proposal for. D3 exists
   * precisely because Tab moves only between controls in edit mode, and that
   * argument is STRONGER for a conflict than for an applicable suggestion,
   * because a conflict has no Accept button further along the row to arrive at
   * eventually. So the label stays, the wrapper goes, and the design records
   * the decision at revision 8 for the desk to confirm or overturn.
   *
   * THE DECISION IS THE ONE PLACE, AND THE BUILDER MERELY OBEYS IT. This
   * function owns the eligibility rule for all three row-build sites, so
   * `buildSuggestionWrapper` reads `inTranscript` rather than re-deriving it —
   * a second copy of the rule would be the defect `speakerLabelFor` exists to
   * prevent. The builder's conflict branch is otherwise untouched and still
   * renders the shape it always did.
   *
   * @param {boolean} suggestions - the "Show suggestions" decision
   * @param {boolean} conflictsInTranscript - the "Show conflicts in the
   *   transcript" decision, hoisted by the caller beside `suggestions`
   * @returns {null|{entry: object, resolution: object,
   *   diff: (object|undefined), inTranscript: boolean}}
   */
  function suggestionForRow(
    api,
    state,
    phrases,
    index,
    labelsAreInformative,
    suggestions,
    conflictsInTranscript,
  ) {
    if (!suggestions || !api || !state) return null;

    const item = resolveSuggestionAt(api, state, phrases, index, labelsAreInformative);
    if (!item || item.entry.status !== SUGGESTION_STATUS_PROPOSED) return null;

    // D6. A conflict's WRAPPER is the table's business unless the person has
    // asked for it here — but the ROW STILL CARRIES A SUGGESTION, and that is
    // a different fact. Returning null would have taken D3's edit label with
    // it, which is the decision recorded below.
    //
    // COMPUTED AFTER THE STATUS TEST ABOVE, so an accepted or a dismissed
    // entry is still refused for its own reason rather than for this one.
    const inTranscript = item.resolution.ok || conflictsInTranscript;

    const diff = item.resolution.ok
      ? api.diffSpansOrWhole(phrases[index].text, item.resolution.text)
      : undefined;

    return {
      entry: item.entry,
      resolution: item.resolution,
      diff,
      inTranscript,
    };
  }

  /**
   * Append one changed span of a diff to a half as a `<del>` or an `<ins>`,
   * with the span's TRAILING WHITESPACE OUTSIDE the element — register item
   * 47 unit 18, § 1.
   *
   * WHY. `tokenize` in openrouter-embed-transcribe.js gives every word its
   * trailing whitespace, so that the spans reassemble the text losslessly.
   * Until this unit the whole span, whitespace included, went inside the
   * mark, so the strikethrough and the underline each ran one character too
   * far: the owner read "explore " struck through as "explore-the" on every
   * screenshot. The mark now covers the word alone, and the whitespace
   * follows it as a text node of its own, IN THE SAME TEXT ORDER.
   *
   * THE DIFF IS UNTOUCHED, and so is its reassembly contract: the split is
   * made here, at the moment of rendering, on a span whose text is exactly
   * what `diffSpans` produced. Joining the half's text nodes and marks in
   * document order still reproduces the original (was-half) or the proposal
   * (proposed-half) byte for byte, and the harness reads that off the DOM.
   *
   * WHITESPACE INSIDE A MULTI-WORD SPAN STAYS INSIDE. Adjacent removed words
   * are one merged span ("explore the "), and the mark runs across the run of
   * words and the spaces between them; only the run's trailing whitespace is
   * moved out. A span that is NOTHING BUT WHITESPACE — possible only as a
   * leading-whitespace token — renders as a text node with no mark, because
   * an empty `<del>` or `<ins>` would be an element a reader is offered with
   * nothing in it.
   *
   * WHAT A SCREEN READER IS OFFERED IS THE SAME CHARACTERS IN THE SAME ORDER.
   * The tree gate's joined `StaticText` holds; what moves is that one
   * `StaticText` "explore " becomes "explore" and " ", which is why every
   * review state's node count moves at this unit while no hash does.
   *
   * @param {HTMLElement} half - the was-half or the proposed-half
   * @param {"del"|"ins"} tagName
   * @param {string} text - one span's text, trailing whitespace included
   */
  function appendMarkedSpan(half, tagName, text) {
    const trailing = text.match(/\s*$/)[0];
    const word = text.slice(0, text.length - trailing.length);

    if (word.length > 0) {
      const mark = document.createElement(tagName);
      mark.appendChild(document.createTextNode(word));
      half.appendChild(mark);
    }
    if (trailing.length > 0) {
      half.appendChild(document.createTextNode(trailing));
    }
  }

  /**
   * Build the suggestion wrapper for one row, or null when nothing should
   * render (register item 47 unit 7; design § 5).
   *
   * THE LAST CHILD OF THE ROW, IN BOTH MODES. `buildRow` appends whatever
   * this returns after its own edit/read-only branch, so the wrapper is
   * identical whichever control precedes it — see design § 1 "both modes".
   *
   * ACCEPT AND DISMISS LAND AT UNIT 10 (register item 47), TOGETHER WITH
   * THEIR HANDLERS — a rendered button with no handler is worse than no
   * button, which is why unit 7 built the reading half of this surface alone
   * and left the controls out. They render as a FOURTH CHILD, a controls
   * group, and only on the applicable shape below; a conflict wrapper gets
   * no controls, per design § 7.
   *
   * THE CONFLICT SENTENCE TAKES AN ID AND `tabindex="-1"` AT THE SAME UNIT,
   * for a reason that has nothing to do with the controls it does not carry:
   * every wrapper needs a focus target for the unified rule Accept, Dismiss
   * and "Next suggestion" all share (an applicable row's target is its
   * Accept button; a conflict row's is this sentence), and without one a
   * conflict row would have nowhere for that rule to land.
   *
   * THREE OUTCOMES SINCE REGISTER ITEM 47 UNIT 14, the first of which renders
   * nothing at all: a conflict whose wrapper the person has not asked to see
   * in the transcript (design section 12's D6). The other two are unchanged
   * and are decided by `suggestion.resolution.ok`:
   *
   *   - APPLICABLE: "was" (hidden), the diff's removed and same spans as
   *     <del> and plain text, "suggested" (hidden), the diff's added and same
   *     spans as <ins> and plain text, the reason when `reasons` is true and
   *     the entry carries one, then the controls group (Accept, Dismiss).
   *   - A CONFLICT (`ok: false`): no "was" and no <del> — there is no
   *     original to show, because the suggestion's `original` is not this
   *     row's text and showing one would assert a comparison that is not
   *     true. "suggested" (hidden), the raw proposed text, then the conflict
   *     sentence for the refusal token, carrying its own id and
   *     `tabindex="-1"` and no controls.
   *
   * EACH CHANGED SPAN GETS ITS OWN <del> OR <ins>, RATHER THAN ONE ELEMENT
   * WRAPPING THE WHOLE RECONSTRUCTION. A two-location change (case 3 in the
   * fixture provenance note) has unchanged text BETWEEN its two edits; a
   * single <del> spanning the lot would mark that unchanged text as removed
   * too, which is wrong both semantically and for what a reader hears.
   *
   * THE WRAPPER'S OWN CHILDREN ARE GROUPED INTO TWO HALVES, register item 47
   * unit 8, and that is a correction rather than a preference. Unit 7a
   * measured that a flat list of spans, <del>s, <ins>s and bare text nodes as
   * direct children of `.transcribe-suggestion` collapsed the row: an
   * unstyled wrapper is a flex child of `.transcribe-row` whose
   * `flex-basis: auto` took the unwrapped width of a whole sentence, and
   * `.transcribe-text` / `.transcribe-edit` (both `flex: 1 1 0`) received
   * none of the resulting negative free space, so the read-only phrase text
   * force-wrapped one token per line — around 190 boxes for a single
   * sentence — and the edit control collapsed to 10 pixels. Grouping each
   * half into ONE element (`.transcribe-suggestion-was`,
   * `.transcribe-suggestion-proposed`) is what lets the stylesheet put a grid
   * on the wrapper without a flex/grid interaction reaching the row itself;
   * see design § 5's "the halves are grouped" note for the anonymous-box
   * reasoning a flat list would have run into under a grid instead.
   *
   * A CONFLICT WRAPPER KEEPS ITS EXISTING SHAPE: there is no "was" half and
   * no <del>, because there is no original to show and a half built for one
   * would assert a comparison that is not true. It gets the proposed half
   * and the conflict sentence, and nothing else.
   *
   * `createElement`/`createTextNode` ONLY, matching buildRow's own rule for
   * anything holding a phrase's words. NO LITERAL WHITESPACE BETWEEN
   * CHILDREN — `tokenize`'s tokens carry their own trailing whitespace (see
   * openrouter-embed-transcribe.js), so appending each span's own text is
   * what keeps each half free of a whitespace-only text node between two
   * inline elements, matching the row's own convention. This applies both
   * BETWEEN the wrapper's three children and WITHIN each half.
   *
   * @param {null|{entry: object, resolution: object, diff: (object|undefined)}} suggestion
   * @param {boolean} reasons - the "Show the reason for each suggestion"
   *   decision
   * @param {number} index - the phrase's 0-based index, for the conflict
   *   sentence's id and the controls' ids (register item 47 unit 10)
   * @returns {HTMLDivElement|null}
   */
  function buildSuggestionWrapper(suggestion, reasons, index) {
    if (!suggestion) return null;

    // D6, register item 47 unit 14. `suggestionForRow` has already decided
    // whether this row's suggestion belongs in the transcript; this reads the
    // answer and never re-derives it. A conflict the person has not asked to
    // see renders NOTHING here and appears in the review block's table
    // instead, while the row's edit label still mentions it — see
    // `suggestionForRow` for why those two are different facts.
    if (!suggestion.inTranscript) return null;

    const entry = suggestion.entry;
    const resolution = suggestion.resolution;
    const wrapper = document.createElement("div");
    wrapper.className = CLASS_SUGGESTION;

    if (!resolution.ok) {
      const proposedHalf = document.createElement("span");
      proposedHalf.className = CLASS_SUGGESTION_PROPOSED;
      appendHalfLabel(
        proposedHalf,
        SUGGESTION_SUGGESTED_TEXT,
        SUGGESTION_HALF.SUGGESTED,
      );

      proposedHalf.appendChild(document.createTextNode(entry.proposed));
      wrapper.appendChild(proposedHalf);

      const conflict = document.createElement("span");
      conflict.className = CLASS_SUGGESTION_CONFLICT;
      conflict.id = CONFLICT_ID_STEM + index;
      conflict.setAttribute("tabindex", "-1");
      // THE LEADING SEPARATOR is what stops "…guests.This line has changed" —
      // the proposal's last word and this sentence's first abut in the
      // rendered text with no node between them. See SUGGESTION_SEPARATOR.
      //
      // IT MOVED OUT OF SIGHT IN THE UNIT 15 FOLLOW-UP, and that is a RULING
      // rather than a tidy-up. Unit 15 moved the same separator on the two
      // halves and the reason, and left this one alone on the reasoning that
      // the owner had reported three boundaries and this sentence renders only
      // behind a checkbox no screenshot showed. The desk overturned it: listen
      // row 52's session 2a part (m) ticks "Show conflicts in the transcript"
      // and reads phrase 6, so the owner meets this indent MID-SITTING — and a
      // defect the sitting is about to walk into is not a defect to report and
      // leave.
      //
      // MEASURED BEFORE AND AFTER, not assumed from the three siblings. With
      // the separator as a bare text node this sentence's first ink sat 5.63px
      // inside its own content edge, while the three parts unit 15 had already
      // cured all read 0 — the defect and its three cures side by side in one
      // reading.
      //
      // NEVER `|| resolution.reason`, which put a machine token on the
      // page — see SUGGESTION_CONFLICT_FALLBACK_TEXT for the full account.
      //
      // THROUGH `conflictSentenceFor` SINCE UNIT 14, because the conflicts
      // table words the same conflict and the two must not diverge. The
      // separator stays HERE rather than moving into that helper: it exists
      // because this sentence abuts the proposal in the rendered text, and a
      // table cell has nothing for it to abut.
      appendHiddenSeparator(conflict);
      conflict.appendChild(
        document.createTextNode(conflictSentenceFor(resolution.reason)),
      );
      wrapper.appendChild(conflict);

      return wrapper;
    }

    const wasHalf = document.createElement("span");
    wasHalf.className = CLASS_SUGGESTION_WAS;
    appendHalfLabel(wasHalf, SUGGESTION_WAS_TEXT, SUGGESTION_HALF.ORIGINAL);

    suggestion.diff.spans.forEach((span) => {
      if (span.type === "added") return;
      if (span.type === "removed") {
        appendMarkedSpan(wasHalf, "del", span.text);
      } else {
        wasHalf.appendChild(document.createTextNode(span.text));
      }
    });

    wrapper.appendChild(wasHalf);

    const proposedHalf = document.createElement("span");
    proposedHalf.className = CLASS_SUGGESTION_PROPOSED;
    appendHalfLabel(
      proposedHalf,
      SUGGESTION_SUGGESTED_TEXT,
      SUGGESTION_HALF.SUGGESTED,
    );

    suggestion.diff.spans.forEach((span) => {
      if (span.type === "removed") return;
      if (span.type === "added") {
        appendMarkedSpan(proposedHalf, "ins", span.text);
      } else {
        proposedHalf.appendChild(document.createTextNode(span.text));
      }
    });

    wrapper.appendChild(proposedHalf);

    if (reasons && entry.reason) {
      const reason = document.createElement("span");
      reason.className = CLASS_SUGGESTION_REASON;
      // THE LEADING SEPARATOR, for the reason the conflict sentence carries
      // one: this span follows the proposal's last word in the rendered text
      // with no node between them, and the sitting heard the result as
      // "beyond.Approved recurring pair". See SUGGESTION_SEPARATOR.
      //
      // IT MOVED OUT OF SIGHT AT UNIT 15. It used to be the first character of
      // this span's own text node and painted a one-character indent in front
      // of every reason; `appendHiddenSeparator` keeps the break and drops the
      // indent. The reason's words follow it as their own text node.
      appendHiddenSeparator(reason);
      // ONE BLOCK PER NEWLINE-SEPARATED PART — register item 47 unit 18,
      // § 4. See REASON_PART_SEPARATOR for why the split is a newline and
      // why it is inert against today's fixtures.
      //
      // A HIDDEN SEPARATOR BEFORE EVERY PART AFTER THE FIRST — register item
      // 47 unit 19. Consecutive parts are separate StaticText nodes with
      // nothing between them, so a reader was offered "…once in this
      // cue.Approved recurring pair: …" at every boundary: the shape D2b
      // records as heard at the proposal-to-reason boundary. The first part
      // needs none; the leading separator above already stands before it.
      //
      // THE SEPARATOR IS THE PART'S OWN FIRST CHILD, NOT A SIBLING BETWEEN
      // PARTS. It was first built between the blocks, and that silently took
      // away unit 18's 0.25rem gap: transcribe.css spaces the parts with
      // `.transcribe-suggestion-reason-part + .transcribe-suggestion-reason-part`,
      // which matches only ADJACENT parts. Inside the part, out of flow as
      // every visually-hidden span is, it keeps the parts adjacent and offers
      // a reader the same text in the same order.
      splitReasonParts(entry.reason).forEach((part, index) => {
        const block = document.createElement("span");
        block.className = CLASS_SUGGESTION_REASON_PART;
        if (index > 0) appendHiddenSeparator(block);
        block.appendChild(document.createTextNode(part));
        reason.appendChild(block);
      });
      wrapper.appendChild(reason);
    }

    // THE CONTROLS GROUP, THE FOURTH CHILD AND THE LAST — register item 47
    // unit 10. Reached only from this branch: `suggestionForRow` already
    // refuses anything whose status is not "proposed" (see its own doc
    // comment), so a wrapper only ever exists to render controls for a
    // suggestion still awaiting a decision, and this branch is the
    // APPLICABLE half of that — a conflict gets no controls at all.
    const controls = document.createElement("div");
    controls.className = CLASS_SUGGESTION_CONTROLS;
    controls.appendChild(
      buildSuggestionControl(ACCEPT_ID_STEM, index, ACCEPT_VISIBLE_TEXT),
    );
    controls.appendChild(
      buildSuggestionControl(DISMISS_ID_STEM, index, DISMISS_VISIBLE_TEXT),
    );
    wrapper.appendChild(controls);

    return wrapper;
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
   * this order and no other: the selection checkbox and its <label>, <time>,
   * the speaker <span> OR its placeholder, the Corrected. marker, the Moved.
   * marker, the text <span>. The first pair is present only when `edit` is
   * true; <time> only when `timestamps` is true; the speaker span only when
   * `speakerLabel` is a number, its placeholder only when it is not AND
   * `labelsAreInformative` is true; the two markers only in READ-ONLY mode and
   * only when their own verdict is true. So a row reads, in the accessibility
   * tree and on screen alike:
   *
   * THIS SENTENCE HAS MOVED FOR THE FIFTH TIME IN ELEVEN UNITS — item 45 unit 7
   * added the edit control, item 46 unit 6 added the checkbox pair, repair unit
   * R1 reversed that pair's internal order, item 46 unit 7b added the Moved.
   * marker, and item 46 unit 11 REMOVED THE FIVE " " TEXT NODES and added the
   * speaker placeholder. It is worth saying because a comment rewritten that
   * often is one a reader should check against the code rather than trust, and
   * because the four shapes below have NEVER enumerated the markers: they are
   * the read-only shapes with no marker on any row, and they are correct only
   * for a row that is neither corrected nor moved. The markers are described in
   * their own branches and under REASSIGNED_MARKER_PREFIX, not here.
   *
   * THE WITHDRAWN ORDER IS QUOTED IN PLACE, per register items 51 and 56,
   * because unit 11 deleted parts this sentence named rather than reordering
   * them:
   *
   *   "the selection checkbox and its <label>, a " " text node, <time>, a " "
   *    text node, the speaker <span>, a " " text node, the Corrected. marker
   *    and a " " text node, the Moved. marker and a " " text node, the text
   *    <span>."
   *
   * THE FIVE SEPARATORS ARE GONE AND `gap` IN transcribe.css REPLACES THE SPACE
   * THEY DREW. They are deleted rather than left in place because the row is
   * now a flex container, in which a text run of nothing but white space is not
   * rendered and produces no anonymous flex item — so leaving them would be
   * markup claiming to do something it no longer does. The cost is stated in
   * design § 11.1 and was ruled on at the sitting of 14 September 2026 (§ 12.6):
   * 1,314 whitespace nodes leave the accessibility tree, the space between a
   * row's parts is a pause, and the ruling was to build the layout and listen
   * afterwards. Listen row 51 carries the part that judges it.
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
   * `labelsAreInformative` IS THE EIGHTH DECISION (register item 46 unit 11),
   * AND IT IS NOT A SECOND COPY OF `speakerLabel`. The two answer different
   * questions and the placeholder needs both: `speakerLabel` says whether THIS
   * ROW prints a label, and `labelsAreInformative` says whether the TRANSCRIPT
   * has a speaker column at all. A one-speaker transcript prints no label on
   * any row, so there is no column and a placeholder there would be an element
   * with no purpose whatsoever; a multi-speaker transcript with labels
   * suppressed has a column that some rows fill and others must reserve.
   * Deriving it here from `speakerLabel` is impossible — a null tells you
   * nothing about the other 656 rows — which is why it arrives already taken
   * like everything else. All three callers hold it already.
   *
   * @param {object} phrase - a normalised phrase
   * @param {number} index - its position, for the stable id
   * @param {number|null} speakerLabel - the resolver's verdict, already taken
   * @param {{timestamps: boolean, edit: boolean, edited: boolean,
   *   names?: Object<string, string>, selected?: boolean,
   *   reassigned?: boolean, labelsAreInformative?: boolean,
   *   suggestion?: (null|{entry: object, resolution: object, diff: (object|undefined)}),
   *   reasons?: boolean}} options - display decisions, the corrected verdict,
   *   the names map, the selected verdict, the moved verdict, whether this
   *   transcript has a speaker column at all, and — register item 47 unit 7 —
   *   the row's resolved suggestion (or null) and the "Show the reason for
   *   each suggestion" decision, every one of them already taken by the
   *   caller through `suggestionForRow`. `names` defaults to an empty map and
   *   `selected`, `reassigned`, `labelsAreInformative` and `reasons` default
   *   to false and `suggestion` to null, so a caller that omits any of them
   *   produces exactly the output this function produced before the unit that
   *   added it.
   * @returns {HTMLLIElement}
   */
  function buildRow(
    phrase,
    index,
    speakerLabel,
    {
      timestamps,
      edit,
      edited,
      names = {},
      selected = false,
      reassigned = false,
      labelsAreInformative = false,
      suggestion = null,
      reasons = false,
    },
  ) {
    const row = document.createElement("li");
    row.id = ROW_ID_STEM + index;
    row.className = CLASS_ROW;

    // THE PHRASE NUMBER, IN READ-ONLY MODE ONLY, AND FIRST IN THE ROW (register
    // item 47 unit 17). See PHRASE_NUMBER_PREFIX for why it exists and why edit
    // mode has none. It is the read-only counterpart of the selection checkbox
    // below: each mode's row leads with the one thing that carries its number.
    //
    // THE SEPARATOR IS SUGGESTION_SEPARATOR, INSIDE THE SPAN'S OWN TEXT. The
    // row's parts carry no whitespace text node between them, and
    // `.visually-hidden` blockifies the span, so without it the rendered text a
    // browse-mode reader walks joins "Phrase 1" to the timecode as
    // "Phrase 1[0:16]" — the weld unit 13 measured on the Accept button. An
    // ordinary space at a block's edge is collapsed; U+00A0 is not.
    //
    // NO LIVE REGION, NO ROLE, NO ARIA. It is plain visually-hidden text a
    // reader meets on arrival, and it paints nothing: `.visually-hidden` takes
    // it out of the flex flow, so it consumes no `gap` and moves no glyph.
    if (!edit) {
      const number = document.createElement("span");
      number.className = `${CLASS_PHRASE_NUMBER} ${CLASS_VISUALLY_HIDDEN}`;
      number.appendChild(
        document.createTextNode(
          `${PHRASE_NUMBER_PREFIX}${index + 1}${SUGGESTION_SEPARATOR}`,
        ),
      );
      row.appendChild(number);
    }

    // THE SELECTION CHECKBOX, IN EDIT MODE ONLY, AND FIRST IN THE ROW. See the
    // doc comment's row order for why it leads rather than follows. In
    // read-only mode no checkbox exists — not a disabled one and not a hidden
    // one — because a person reading a transcript is not selecting anything,
    // which is the owner's own decision recorded in the design's section 3.
    //
    // THE " " TEXT NODE THAT CLOSED THE PAIR IS GONE AT UNIT 11, AND ITS
    // WITHDRAWN NOTE IS QUOTED IN PLACE per register items 51 and 56:
    //
    //   "THE " " TEXT NODE CLOSES THE PAIR AND MATCHES <time> AND THE SPEAKER
    //    SPAN, and it is needed for the same reason theirs are: the checkbox is
    //    VISIBLE, so with no separator it butts against the timecode on screen."
    //
    // The need it describes is real and is now met by `gap` on the flex row.
    // WHAT SURVIVES UNCHANGED, and is why this paragraph is not deleted whole:
    // the label contributes no separator of its own because `.visually-hidden`
    // positions it ABSOLUTELY and it leaves the flow entirely — the measured
    // side effect recorded under CORRECTED_MARKER_TEXT. That fact got larger
    // at unit 11 rather than smaller: an absolutely-positioned child of a flex
    // container is NOT a flex item, so the label consumes no `gap` either, and
    // moving it to the far side of the box still changes nothing on screen.
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
    }

    // <time> carries the machine-readable offset in `datetime` and the reading
    // clock as its text. It is built ONLY when timestamps are shown: with the
    // box unchecked it does not exist, so the row begins with the speaker span,
    // its placeholder, or the phrase text (item 54). (Withdrawn at unit 11,
    // quoted in place: "together with the " " text node after it: with the box
    // unchecked neither exists". The separator is gone and `gap` draws the
    // space — see the row-order comment.)
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
    //
    // THE PLACEHOLDER IS THE `else` OF THIS EXACT TEST, NOT A SECOND TEST OF
    // ITS OWN (register item 46 unit 11). Written as an `else if` on the same
    // condition, so it is structurally impossible for a row to end up with
    // NEITHER span while the transcript has a speaker column — which is the one
    // way the alignment this unit exists to fix could come back silently, and
    // it would come back on exactly the rows a second test got wrong rather
    // than on all of them. It therefore covers BOTH suppressions: a null
    // verdict from the resolver, and the undefined guard immediately above.
    //
    // ITS OWN CONDITION IS `labelsAreInformative` AND NOTHING ELSE. See the doc
    // comment: a one-speaker transcript has no column to reserve, so it gets no
    // placeholders at all, and that is asserted rather than assumed — unit 11
    // halts if `TranscribeFixture.collapseToOneSpeaker()` produces one.
    if (speakerLabel !== null && typeof speakerLabel === "number") {
      const speaker = document.createElement("span");
      speaker.className = CLASS_SPEAKER;
      speaker.appendChild(
        document.createTextNode(speakerLabelText(speakerLabel, names)),
      );
      row.appendChild(speaker);
    } else if (labelsAreInformative) {
      // EMPTY, AND IT STAYS EMPTY. No text node, no `&nbsp;`, no `aria-hidden`.
      // An empty span contributes no `StaticText`, so the whole-tree count is
      // unmoved by any number of these — which is one of unit 11's halts, and
      // is the only thing that makes a layout-only element honest to add.
      const placeholder = document.createElement("span");
      placeholder.className = CLASS_SPEAKER_PLACEHOLDER;
      row.appendChild(placeholder);
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
      // The separator that followed is gone at unit 11. This marker is
      // `.visually-hidden` and therefore absolutely positioned, so it is NOT a
      // flex item and consumes no `gap` — a corrected row and an uncorrected
      // one put their phrase text at the same x, which is what the old
      // separator's whitespace collapsing happened to deliver too.
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
      // BOTH SLOTS ARE READ OFF THE PHRASE, NOT OFF THE VERDICT. The verdict is
      // a boolean the state module supplies; the WORDS need the slot the
      // transcription put the line in and the slot it is in now, and only the
      // phrase carries either.
      //
      // `phrase.speaker` AND NOT `speakerLabel`, WHICH IS THE DIFFERENCE THE
      // SUPPRESSED-LABEL CASE TURNS ON. `speakerLabel` is the label DECISION —
      // a number when the row prints one and null when it does not — so
      // composing the "to" half from it would give the marker nothing to say on
      // exactly the rows the fuller wording was asked for.
      marker.appendChild(
        document.createTextNode(
          reassignedMarkerText(
            phrase.sourceSpeaker,
            phrase.speaker,
            names,
            REASSIGNED_MARKER_PREFIX,
            REASSIGNED_MARKER_SUFFIX,
          ),
        ),
      );
      row.appendChild(marker);
      // Gone at unit 11, for the reason the corrected marker's own note gives.
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
      // reads "Edit phrase 12, corrected, speaker changed from Speaker 2 to
      // Amira" — the order fixed, and fixed here, because this is the only
      // place both verdicts are in hand. See REASSIGNED_MARKER_PREFIX for why
      // corrected comes first. (Two withdrawn lines, neither deleted: "Edit
      // phrase 12, corrected, moved" until unit 8, and "…, speaker changed from
      // Speaker 2" until unit 10. The wording grew twice and the ORDER has not
      // moved once.)
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
                  phrase.speaker,
                  names,
                  EDIT_LABEL_REASSIGNED_PREFIX,
                  "",
                )
              : "") +
            // THE SUGGESTION SUFFIX, EDIT MODE ONLY — design § 12's D3. It
            // is APPENDED after the existing markers, so a row that is
            // corrected, moved AND carries a suggestion reads its three
            // facts in the order this label has always used and gains a
            // fourth at the end.
            //
            // WHY EDIT MODE ONLY. In read-only mode the wrapper follows the
            // phrase in reading order and a reader meets it unaided. In edit
            // mode Tab moves between CONTROLS, so without this a person
            // meets the suggestion only when they arrive at Accept — by
            // which point they have passed the text it is about.
            //
            // IT IS NOT A FOURTH MARKER BREAKING THE ONE-MARKER-PER-ROW-PER-
            // MODE RULE. That rule is about saying the same fact twice in
            // one mode; nothing else on an edit-mode row mentions the
            // suggestion at all.
            suggestionEditLabelSuffix(suggestion),
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

      // THE SUGGESTION WRAPPER, LAST CHILD, IN BOTH MODES (register item 47
      // unit 7; design § 1 "both modes"). Built once and appended from both
      // branches so the two never diverge — see buildSuggestionWrapper's own
      // doc comment for what it renders and why.
      const editWrapper = buildSuggestionWrapper(suggestion, reasons, index);
      if (editWrapper) row.appendChild(editWrapper);

      return row;
    }

    const text = document.createElement("span");
    text.className = CLASS_TEXT;
    text.textContent = phrase.text;
    row.appendChild(text);

    // THE SUGGESTION WRAPPER, LAST CHILD — the read-only half of the same
    // rule the edit branch above follows.
    const readOnlyWrapper = buildSuggestionWrapper(suggestion, reasons, index);
    if (readOnlyWrapper) row.appendChild(readOnlyWrapper);

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
          // THE SPEAKER COLUMN'S EXISTENCE, hoisted above this loop like every
          // other decision and handed down rather than re-derived. It is NOT
          // recoverable from `speakerLabel`, which answers only for this row —
          // see buildRow's doc comment (register item 46 unit 11).
          labelsAreInformative,
          // THE SUGGESTION AND THE REASON DECISION (register item 47 unit 7).
          // `showSuggestions` and `showReasons` were passed straight through
          // and inert here at unit 6; `buildRow` now reads a RESOLVED
          // suggestion rather than the raw toggle, because eligibility
          // (status === proposed) and the diff computation are the state
          // module's and the transcribe module's own answers, asked once here
          // through `suggestionForRow` rather than inside `buildRow`, which
          // decides nothing — see `suggestionForRow`'s own doc comment. All
          // THREE call sites resolve it the same way, so a patched row and a
          // rendered row are still built from the same options.
          suggestion: suggestionForRow(
            api,
            state,
            phrases,
            index,
            labelsAreInformative,
            showSuggestions,
            showConflictsInTranscript,
          ),
          reasons: showReasons,
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

    // READ ONCE INTO A CONST AT UNIT 11, having previously been computed inline
    // in the call below. `buildRow` needs the same answer for the placeholder
    // decision, and computing `distinctSpeakerCount` twice in one function
    // would be two places for one rule to live — the defect `speakerLabelFor`
    // exists to prevent, in miniature.
    const labelsAreInformative = api.distinctSpeakerCount(result) > 1;

    const speakerLabel = api.speakerLabelFor({
      speaker: phrase.speaker,
      previousSpeaker: api.previousSpeakerAt(phrases, index),
      labelsAreInformative,
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
        // Read into a const above, for the reason stated there (unit 11).
        labelsAreInformative,
        // The resolved suggestion and the reason decision (register item 47
        // unit 7). See `suggestionForRow`'s doc comment and renderTranscript's
        // call for why the resolution happens here rather than inside
        // `buildRow`, and why all three call sites resolve it the same way.
        suggestion: suggestionForRow(
          api,
          state,
          phrases,
          index,
          labelsAreInformative,
          showSuggestions,
          showConflictsInTranscript,
        ),
        reasons: showReasons,
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
   * Rebuild SEVERAL rows in place, after a gesture changed what they say
   * (register item 46 unit 7b; the ONLY repaint path since unit 10).
   *
   * TWO CALLERS, NOT ONE, AND THAT IS THE POINT OF UNIT 10. A reassignment
   * reaches it with the moved rows and their neighbours; a RENAME reaches it
   * with every row that carries the renamed slot as its current speaker or as
   * its source. The rename used to have a targeted writer of its own, which
   * wrote the speaker span's textContent and knew nothing about the moved
   * marker — so a rename left the marker's wording stale on both sides. One
   * repaint path is what makes a patched row and a rendered row the same row by
   * construction rather than by two builders agreeing.
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
   * prints a label at all. The MOVE caller widens the set by one per moved row;
   * this function does not widen it, because it has no way to know which of its
   * indices were moved and which were added as neighbours, and a function that
   * widened a widened set would reach further on every call.
   *
   * THE RENAME CALLER WIDENS BY NOTHING, AND THE ASYMMETRY IS CORRECT. A rename
   * cannot change which rows print a label — suppression depends on speaker
   * NUMBERS and the label mode, never on names — so there is no neighbour whose
   * decision could have moved. Deciding the set is the caller's job for exactly
   * this reason: the two gestures have different affected sets and only the
   * caller knows which gesture happened.
   *
   * OUT-OF-RANGE AND MISSING ROWS ARE SKIPPED, NOT REFUSED. A neighbour index
   * one past the last row is the ordinary product of the widening above, and
   * the caller bounds it; a row whose node is absent is a render that has not
   * happened. Neither is a fault worth stopping a batch for, and both are
   * counted so the log line can report them.
   *
   * NO FOCUS PLACEMENT, AND IT IS NOT AN OMISSION. patchRow places focus
   * because the gesture that reaches it — a commit on blur or on Enter — starts
   * INSIDE the row being replaced. BOTH of this function's gestures start
   * OUTSIDE the list: the move from its own button, and the rename from the
   * Apply button or the name field, which sit in a block above the transcript.
   * So no row it replaces can hold focus, and the person stays where they were.
   * That is asserted in the console sheet rather than defended with code for a
   * case neither gesture can produce.
   *
   * NOTHING IS ANNOUNCED HERE, AND BOTH CALLERS DO ANNOUNCE. The sentence is
   * composed and spoken by the handler, never by the repaint — which is what
   * keeps one gesture to one utterance when a handler has two repaint branches,
   * as the move's does. No toast, no announcer call, no live region and no
   * liveness is added anywhere in this chain.
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
    // THE TWO REVIEW DECISIONS, HOISTED HERE BESIDE THE REST (register item 47
    // unit 6), rather than read per row, for this block's own stated reason:
    // every line here is a decision patchRow would otherwise retake 657 times.
    // `suggestions` is the raw toggle — eligibility still has to be asked of
    // the state module PER ROW through `suggestionForRow` (unit 7), because
    // whether a given phrase carries a proposed suggestion cannot be hoisted.
    const suggestions = showSuggestions;
    const reasons = showReasons;
    // THE THIRD REVIEW DECISION, hoisted here with the other two (register item
    // 47 unit 14). Like `suggestions` it is a raw toggle: whether a given row's
    // suggestion IS a conflict still has to be asked per row, inside
    // `suggestionForRow`, because that depends on the phrase's current text.
    const conflictsInTranscript = showConflictsInTranscript;
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
          // Already hoisted for the whole batch above (unit 11). A patched row
          // and a rendered row must be byte-identical, placeholder included.
          labelsAreInformative,
          // Resolved PER ROW — see the comment above `suggestions` for why the
          // toggle is hoisted but the eligibility check is not. Matches
          // renderTranscript's and patchRow's own calls exactly.
          suggestion: suggestionForRow(
            api,
            state,
            phrases,
            index,
            labelsAreInformative,
            suggestions,
            conflictsInTranscript,
          ),
          reasons: reasons,
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
   * IT KEEPS ITS BUTTON AND ITS VOICE NOW THAT A SPEAKER CHANGE ALSO CLEARS
   * (register item 46 unit 10). The two are not redundant: this is how a person
   * abandons a selection WITHOUT acting on it, and a change is how they abandon
   * one BY acting on it. Only this gesture announces the clear, because only
   * here is the clear the whole of what happened — the change's own sentence is
   * the one output for that gesture.
   *
   * THE TWO CLEAR BY DIFFERENT MECHANISMS, AND BOTH ARE RIGHT WHERE THEY ARE.
   * This one unticks the boxes that already exist and rebuilds nothing, which
   * is what protects a reader's position in a 657-row list. The change gesture
   * rebuilds those rows anyway, so it empties the Set first and lets `buildRow`
   * read it — no second writer, no window where the Set and the boxes disagree.
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
   * IT ANNOUNCES AS OF UNIT 10, AND THE WITHDRAWN PARAGRAPH ASKED FOR IT. That
   * paragraph is quoted rather than deleted, per register items 51 and 56,
   * because it named the right question and the sitting answered it:
   *
   *   "NOTHING IS ANNOUNCED. No toast, no announcer call, no live region. The
   *    count is silent text and the boxes convey their own state. Listen row 49
   *    judges whether that is sufficient feedback for a gesture whose whole
   *    visible effect is remote from the control — the same question the
   *    design's section 7 raises about a rename."
   *
   * THE ANSWER, AT THE SITTING OF 14 SEPTEMBER 2026: it is not. Four gestures
   * spoke and this one stayed silent for no reason other than that nobody had
   * asked for it. See selectionClearedSentence. Everything else in the
   * withdrawn text still holds — no live region is added here, the count stays
   * silent text, and the boxes still convey their own state; what changed is
   * that the GESTURE now has a voice, through the same `notify*()` route the
   * other five use.
   *
   * A NO-OP STILL SAYS NOTHING, AND THE EARLY RETURN BELOW IS WHAT DELIVERS
   * THAT rather than a second guard beside the sentence. Clearing an empty
   * selection changed nothing, so there is nothing to report; the announcement
   * sits after the work for the same reason every other call site in this file
   * sits after its handler's `changed` guard.
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

    // COMPOSED FROM THE COUNT READ BEFORE THE CLEAR, and spoken after the work,
    // matching the other five call sites: composing first means a failure
    // cannot leave a half-built sentence, and speaking last means nothing is
    // announced for work that did not happen.
    speak(selectionClearedSentence(cleared));
    logDebug(`clear selection — ${cleared} row(s) unticked, none rebuilt`);
  }

  // ==========================================================================
  // THE REVIEW BLOCK (register item 47 unit 6)
  // ==========================================================================
  //
  // NOTHING HERE RENDERS A SUGGESTION. `buildRow` is untouched at this unit, no
  // <del> or <ins> reaches the page, and neither Accept nor Dismiss exists yet.
  // What lands is the BLOCK: its reveal, its count sentence, the two render
  // decisions its checkboxes carry, and the "Next suggestion" gesture. Unit 7
  // is where a row begins to show anything, and the two toggles are wired now
  // precisely so that unit adds a BRANCH rather than a pathway.
  //
  // NOTHING HERE ANNOUNCES, AND NOTHING HERE GAINS LIVENESS. The count is
  // silent text, on exactly the terms `updateSelectionCount` records: no toast,
  // no announcer call, no aria-live and no live role, and the target is a <p>
  // with no live ancestor. Revealing the block is not an event that speaks —
  // register item 46 settled that for controls appearing at a flip, and this is
  // the same situation. The gestures that DO speak are item 47 unit 8's, and
  // the sitting decides their wording, not this file.

  // SUGGESTION_STATUS_PROPOSED IS DECLARED ONCE, NEAR `suggestionForRow`
  // (register item 47 unit 7), NOT HERE. This block and that function need
  // the identical mirrored value, so it is hoisted to the one place both can
  // reach it — a second declaration of the same literal is exactly the
  // "kept in step by eye" hazard its own doc comment names.

  /**
   * The sentence the block shows when no change set is loaded.
   *
   * IT MATCHES THE MARKUP BYTE FOR BYTE, and that is the point rather than a
   * coincidence: tools.html ships a true zero-state sentence rather than an
   * empty element, so a block revealed before the first write shows something
   * honest. `setText` is write-if-changed, so writing this over the shipped
   * value writes nothing at all.
   */
  const REVIEW_NONE_TEXT = "No suggestions.";

  /**
   * One to nine as words; ten and above as digits.
   *
   * THE HOUSE RULE FOR PROSE A PERSON READS, and it is why `pluralise` is not
   * reused here: that helper prints "1 line", which is right for a terse count
   * beside a control and wrong inside a sentence. Two helpers, two registers,
   * and neither pretending to be the other.
   */
  const NUMBER_WORDS = Object.freeze([
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
  ]);

  /**
   * @param {number} value - a whole number
   * @returns {string}
   */
  function numberWord(value) {
    return value >= 1 && value <= 9 ? NUMBER_WORDS[value] : String(value);
  }

  /**
   * Compose the count sentence.
   *
   * PURE, AND EXPOSED FOR THAT REASON. It touches no DOM and reads no state, so
   * the harness can assert the wording at one, at two and at 12 without a page,
   * a fixture or a render. Every other function in this block reads the live
   * state, and this is deliberately the one that does not.
   *
   * A ZERO-VALUED CLAUSE IS OMITTED RATHER THAN PRINTED AS ZERO. "12
   * suggestions, three accepted" is what a person wants; "12 suggestions, three
   * accepted, no dismissed, no conflicts" is a form to fill in. A total of zero
   * is the one case that is not a clause at all — it is the zero-state sentence
   * above, because "no suggestions" is the whole of what there is to say.
   *
   * ONLY "suggestion" PLURALISES. The other three clauses carry no noun, so
   * "one accepted" and "three accepted" are both already correct.
   *
   * @param {object} counts
   * @param {number} counts.total - every entry the change set loaded
   * @param {number} counts.accepted
   * @param {number} counts.rejected - shown as "dismissed", the word the
   *   gesture uses; `rejected` is the other lane's status vocabulary and it is
   *   not the word on screen
   * @param {number} counts.conflicts - proposed entries `suggestionTextFor`
   *   refuses against the phrase's CURRENT text
   * @returns {string}
   */
  function reviewCountSentence({ total, accepted, rejected, conflicts }) {
    if (!total) return REVIEW_NONE_TEXT;

    const clauses = [`${numberWord(total)} suggestion${total === 1 ? "" : "s"}`];
    if (accepted) clauses.push(`${numberWord(accepted)} accepted`);
    if (rejected) clauses.push(`${numberWord(rejected)} dismissed`);
    if (conflicts) clauses.push(`${numberWord(conflicts)} cannot be applied`);
    return `${clauses.join(", ")}.`;
  }

  /**
   * Resolve ONE phrase's suggestion against it, with the ADAPTER'S OWN
   * speakerLabel — the single-index sibling of `reviewResolutions` below,
   * extracted at register item 47 unit 7 so a row build asking for its own
   * entry (`suggestionForRow`, beside `buildRow`) and a full sweep asking for
   * all of them share one computation rather than two. See
   * `reviewResolutions`'s doc comment for the full account of why
   * `speakerLabel` MUST be resolved with `mode` absent (EVERY_LINE) and never
   * with the display's ON_CHANGE mode.
   *
   * O(1) IN THE PHRASE COUNT, UNLIKE `suggestionResolutionAt`. That function's
   * own doc comment reserves its full-sweep cost for the harness; a row build
   * called once per row cannot afford it, so this is the cheaper route
   * `reviewResolutions`'s doc comment says rendering should take.
   *
   * @param {object} api - the transcribe module
   * @param {object} state - the transcribe state module, already known loaded
   * @param {Array} phrases - the whole phrase array, for `previousSpeakerAt`
   * @param {number} index - the phrase's 0-based index
   * @param {boolean} labelsAreInformative - hoisted once by the caller
   * @returns {null|{entry: object, resolution: object}}
   */
  /**
   * The cue ids this surface has itself decided on, since the page loaded.
   *
   * IT IS WHAT MAKES D9's RULE ABOUT ARRIVAL RATHER THAN ABOUT STATUS. An
   * entry that arrives `accepted` and an entry accepted HERE are the same
   * three fields afterwards — status `accepted`, `rejectedBy` null — so
   * nothing in the record distinguishes them and the difference has to be
   * remembered by the only party that knows it, which is this file.
   *
   * KEYED BY CUE ID, NOT BY PHRASE INDEX, and that is what makes unit 4's
   * carry-forward survive D9. `loadSuggestions` carries a previous
   * accepted/rejected decision onto a matching entry of a FRESH change set;
   * such an entry arrives decided, with no `rejectedBy`, and is
   * indistinguishable from one a person ticked upstream — except that its cue
   * id is in here, because this surface is where that decision was made.
   * Amendment 1 is explicit that carry-forward is unaffected by D9, and this
   * set is how.
   *
   * IT IS NEVER CLEARED. A cue id decided here stays decided for the life of
   * the page; there is no gesture that un-decides one, and a reload of the
   * same change set is exactly the carry-forward case above.
   */
  const decidedHere = new Set();

  /**
   * Is this entry one this surface may review, count and render?
   *
   * D9, AS WIDENED BY AMENDMENT 1: an entry is reviewable only if it ARRIVED
   * carrying `status: "proposed"` and no `rejectedBy`. Anything else was
   * decided before this surface saw it, and belongs to whoever decided it.
   *
   * THE THREE CASES IT EXCLUDES, all grounded in `captions-fixer/` at HEAD on
   * 21 September 2026 rather than taken from the lane's summary of itself:
   *
   *   a guard held it   `runGuards` writes `status: "rejected"` and
   *                     `rejectedBy: "guard:<name>"` together, so a
   *                     `speakerLabelUnchanged` hold arrives REJECTED — not
   *                     proposed, which is what the lane's "status not
   *                     accepted" left open.
   *   a person unticked `handleKeepChange` writes `rejected` and
   *                     `rejectedBy: "person"`.
   *   a person TICKED   the same function writes `accepted` and clears
   *                     `rejectedBy` to null. This is the case D9 as first
   *                     dispatched did NOT cover, and it is the reason
   *                     amendment 1 exists: such an entry never renders here
   *                     anyway, because only a `proposed` entry gets a
   *                     wrapper — but `suggestionCounts` counted it as
   *                     accepted, so the count sentence reported a decision
   *                     nobody made on this surface and a correction that is
   *                     not in the transcript.
   *
   * NO PATH IN THAT LANE CLEARS `rejectedBy` WITHOUT ALSO MOVING `status` —
   * checked at all three writers, `runGuards`, `handleKeepChange` and
   * `preserveKeepChoices` — so the two fields cannot disagree and this
   * predicate does not have to decide what it would mean if they did.
   *
   * WHY NOT RENDER A HELD ENTRY AND LET THE REFUSAL CATCH IT. This surface
   * writes TEXT only; a speaker is changed through register item 46's
   * controls. So an Accept on a held label change could never do what the
   * button says, and not rendering it honours the other lane's verdict rather
   * than re-deriving it — which the cross-lane seam forbids.
   * `suggestionTextFor`'s `label-changed` refusal stays underneath as defence
   * in depth, reachable only if somebody upstream cleared `rejectedBy` or an
   * unguarded label shape arrived.
   *
   * AND THE LANE'S OWN REPLY IS WRONG ON ONE POINT, recorded as a desk
   * inference from their code rather than as a fault in it: that refusal does
   * NOT cover the ticked case, because an `accepted` entry never renders and
   * so never reaches `suggestionTextFor` at all. The arrival rule is what
   * covers it.
   *
   * @param {object} entry - a change-set entry as the state module holds it
   * @returns {boolean}
   */
  function isReviewable(entry) {
    if (!entry) return false;
    if (decidedHere.has(entry.cueId)) return true;
    return entry.status === SUGGESTION_STATUS_PROPOSED && !entry.rejectedBy;
  }

  function resolveSuggestionAt(api, state, phrases, index, labelsAreInformative) {
    const entry = state.suggestionAt(index);
    if (!entry) return null;
    if (!isReviewable(entry)) return null;

    const phrase = phrases[index];
    const speakerLabel = api.speakerLabelFor({
      speaker: phrase.speaker,
      previousSpeaker: api.previousSpeakerAt(phrases, index),
      labelsAreInformative,
    });

    return {
      entry,
      resolution: api.suggestionTextFor({
        original: entry.original,
        proposed: entry.proposed,
        currentText: phrase.text,
        speakerLabel,
        // ADDED AT UNIT 13 FOR DESIGN § 12's D5. `sourceSpeaker` is the
        // phrase's speaker BEFORE any move, which is the number the adapter
        // would have inlined when the change set was built — so it is what
        // lets `suggestionTextFor` tell "the speaker moved" from "the line
        // changed" and say something true for each. It is read straight off
        // the phrase, never recomputed: the state module owns that
        // derivation, which is the ruling repair unit R2 already settled for
        // `isReassigned`.
        sourceSpeaker: phrase.sourceSpeaker,
      }),
    };
  }

  /**
   * Resolve every loaded suggestion against the phrase it belongs to.
   *
   * THE `speakerLabel` ARGUMENT IS THE ADAPTER'S RESOLUTION AND NEVER THE
   * DISPLAY'S, AND GETTING THAT WRONG WOULD BREAK MOST OF THE TRANSCRIPT
   * SILENTLY. `suggestionTextFor` composes the expected prefix from the number
   * it is handed, and the number it must be handed is the one
   * `fromTranscribeResult` used when it built the change set. That call passes
   * no `mode`, so it takes `SPEAKER_LABEL_MODE.EVERY_LINE` and inlines a label
   * on EVERY phrase carrying a speaker. Our own display uses ON_CHANGE and
   * suppresses the label on a row that does not open a run — so passing the
   * DISPLAY-resolved label would hand `null` for every suppressed row, rule 2
   * could not fire, and each of those rows would refuse `stale-base`. The
   * failure is silent and it reads as a transcript that has drifted. Fixture
   * case 1 is the row that proves this, and the harness asserts it against the
   * inlined file, where a wrong resolution is observable.
   *
   * SO THE `mode` ARGUMENT IS DELIBERATELY ABSENT BELOW, matching
   * `fromTranscribeResult` exactly rather than naming the default; that call
   * omits it too, and the two are meant to be read side by side.
   * `previousSpeaker` is still supplied, because the signature takes it and
   * EVERY_LINE ignores it — passing it costs nothing and keeps the mirror
   * faithful.
   *
   * ONE SNAPSHOT FOR THE WHOLE SWEEP. `currentResult()` builds a view over all
   * 657 phrases, so taking one per entry would pay for the transcript once per
   * suggestion; `labelsAreInformative` is hoisted beside it for the reason
   * `patchRows` hoists its own decisions.
   *
   * @returns {Array<{index: number, entry: object, resolution: object}>} in
   *   phrase order; empty when nothing is loaded
   */
  function reviewResolutions() {
    const api = moduleOrNull();
    const state = stateOrNull();
    if (!api || !state || !state.isLoaded()) return [];

    const result = currentResult();
    const phrases =
      result && Array.isArray(result.phrases) ? result.phrases : [];
    if (phrases.length === 0) return [];

    const labelsAreInformative = api.distinctSpeakerCount(result) > 1;
    const resolved = [];

    // EXTRACTED TO `resolveSuggestionAt` AT REGISTER ITEM 47 UNIT 8, so the
    // adapter-speakerLabel rule this loop's own comment describes lives in
    // one place shared with `suggestionForRow`, rather than two loops each
    // typing it out. The per-index computation is byte-identical to before
    // the extraction.
    phrases.forEach((phrase, index) => {
      const item = resolveSuggestionAt(api, state, phrases, index, labelsAreInformative);
      if (!item) return;
      resolved.push({ index: index, entry: item.entry, resolution: item.resolution });
    });

    return resolved;
  }

  /**
   * One phrase's resolution, or null.
   *
   * A CONVENIENCE OVER `reviewResolutions`, AND IT PAYS FOR A WHOLE SWEEP. That
   * is acceptable because its only caller is the harness, asserting one row;
   * anything counting or rendering takes the array and reads it once.
   *
   * @param {number} index - a 0-based phrase index
   * @returns {{index: number, entry: object, resolution: object}|null}
   */
  function suggestionResolutionAt(index) {
    return reviewResolutions().find((item) => item.index === index) || null;
  }

  /**
   * How many PROPOSED suggestions cannot be applied to the phrase as it stands.
   *
   * IT IS COMPUTED, NEVER STORED, matching how `suggestionCounts`,
   * `editedCount` and `reassignedCount` all work: the answer depends on the
   * phrase's CURRENT text, so correcting a line by hand can turn an applicable
   * suggestion into a stale one with nothing having touched the change set. A
   * stored count would be wrong from that moment and nothing would say so.
   *
   * ACCEPTED AND DISMISSED ENTRIES ARE NOT COUNTED. "Cannot be applied"
   * describes a suggestion still waiting for a decision; one already decided is
   * reported by its own clause and is not a second problem.
   *
   * @param {Array} [resolved] - a sweep already in hand, to avoid a second one
   * @returns {number}
   */
  function reviewConflictCount(resolved) {
    const items = resolved || reviewResolutions();
    return items.filter(
      (item) =>
        item.entry.status === SUGGESTION_STATUS_PROPOSED && !item.resolution.ok,
    ).length;
  }

  /**
   * The rows carrying a suggestion still awaiting a decision, in phrase order.
   *
   * SUPERSEDED IN PART AT REGISTER ITEM 47 UNIT 14, and the withdrawn paragraph
   * is quoted here per register items 51 and 56 rather than deleted:
   *
   *   ~~IT INCLUDES THE ONES THAT CANNOT BE APPLIED, and that is deliberate
   *   rather than an oversight. A conflict is information about that line — the
   *   design's § 11 (c) puts it in the transcript's own order for exactly that
   *   reason — so "Next suggestion" must be able to reach it. A gesture that
   *   silently skipped the rows a person most needs to look at would be worse
   *   than no gesture.~~
   *
   * § 11 (c)'s answer was overturned by the sitting that tested it. Under D6 a
   * conflict is reachable by Tab, from the table's own button, so a focus rule
   * that walks applicable suggestions only no longer walks a person past
   * anything they cannot get to. `focusNextSuggestionWrapper` carries the live
   * rule and the two arms it now has; this function does not.
   *
   * IT IS CALLED BY NOTHING, MEASURED AT UNIT 14 across this file, the harness
   * and `.claude/a11y/sr/`. It is left rather than deleted because it is a
   * plausible seam for a later gesture, and its doc is corrected rather than
   * left standing because a superseded caveat on an uncalled function is the
   * hardest kind to notice.
   *
   * @returns {number[]}
   */
  function proposedRowIndices() {
    return reviewResolutions()
      .filter((item) => item.entry.status === SUGGESTION_STATUS_PROPOSED)
      .map((item) => item.index);
  }

  /**
   * The next row to move to, given where we are.
   *
   * PURE, AND EXPOSED SO THE WRAP CAN BE ASSERTED WITHOUT A PAGE. `indices` is
   * in phrase order; `fromIndex` is where focus is now, or null when it is
   * nowhere in particular.
   *
   * IT WRAPS. Past the last proposed suggestion it returns the first, so the
   * gesture is a no-op only when there are none at all — a state the count
   * sentence has already explained. WHETHER WRAPPING SILENTLY IS RIGHT IS NOT
   * SETTLED HERE: listen row 52 part (g) asks a person to find the third
   * suggestion among 657 rows, and the wrap is one of the things it judges. If
   * a person is lost at the wrap, the remedy is decided there.
   *
   * @param {number[]} indices - rows carrying a proposed suggestion, ascending
   * @param {number|null} fromIndex - the current row, or null
   * @returns {number|null} the row to move to, or null when there is none
   */
  function nextProposedIndexFrom(indices, fromIndex) {
    if (!Array.isArray(indices) || indices.length === 0) return null;
    if (!Number.isInteger(fromIndex)) return indices[0];
    const next = indices.find((index) => index > fromIndex);
    return next === undefined ? indices[0] : next;
  }

  /**
   * The PROPOSED suggestions that cannot be applied, in phrase order — the
   * table's rows (design section 12's D6; register item 47 unit 14).
   *
   * THE SAME PREDICATE `reviewConflictCount` COUNTS, and deliberately the same
   * sweep: the count sentence's "N cannot be applied" clause and the number of
   * rows in this table are two readings of one fact, and a person who sees them
   * disagree has no way to tell which to believe. That is why this returns the
   * ITEMS and `reviewConflictCount` takes their length rather than filtering
   * again.
   *
   * @param {Array} [resolved] - a sweep already in hand, to avoid a second one
   * @returns {Array<{index: number, entry: object, resolution: object}>}
   */
  function reviewConflicts(resolved) {
    const items = resolved || reviewResolutions();
    return items.filter(
      (item) =>
        item.entry.status === SUGGESTION_STATUS_PROPOSED && !item.resolution.ok,
    );
  }

  /**
   * Build one row of the conflicts table.
   *
   * `createElement` AND `createTextNode` ONLY, never innerHTML, matching
   * `buildRow`'s own rule and for its reason: the middle cell holds a phrase
   * somebody's model proposed, and a proposal containing angle brackets must
   * stay a proposal containing angle brackets. There is no escape helper to
   * forget to call because there is no parse step to escape for.
   *
   * THE FIRST CELL IS A `<th scope="row">` AND THE OTHER TWO ARE `<td>`. A row
   * header is what lets a reader moving across the row hear which phrase the
   * cell belongs to without counting columns. It holds the button rather than
   * bare text, because the phrase number and the way to reach that phrase are
   * one thing to a person, not two.
   *
   * THE EXPLANATION COMES FROM `conflictSentenceFor`, the same function the
   * transcript wrapper asks — see that function for why the two surfaces must
   * not word a conflict differently, and why the separator is the wrapper's
   * business and not this one's.
   *
   * NO DIFF AND NO VISUALLY-HIDDEN LABEL IN THE MIDDLE CELL. A conflict has no
   * original to compare against, which is what makes it a conflict; and the
   * column header already says what the cell holds, so the carrier the wrapper
   * needs to tell its two halves apart has nothing to do here.
   *
   * @param {{index: number, entry: object, resolution: object}} item
   * @returns {HTMLTableRowElement}
   */
  function buildConflictTableRow(item) {
    const tr = document.createElement("tr");

    const phraseCell = document.createElement("th");
    phraseCell.setAttribute("scope", "row");
    const goto = document.createElement("button");
    goto.type = "button";
    goto.id = CONFLICT_GOTO_ID_STEM + item.index;
    goto.appendChild(document.createTextNode(conflictGotoText(item.index)));
    phraseCell.appendChild(goto);
    tr.appendChild(phraseCell);

    const proposedCell = document.createElement("td");
    proposedCell.appendChild(document.createTextNode(item.entry.proposed));
    tr.appendChild(proposedCell);

    const whyCell = document.createElement("td");
    whyCell.appendChild(
      document.createTextNode(conflictSentenceFor(item.resolution.reason)),
    );
    tr.appendChild(whyCell);

    return tr;
  }

  /**
   * The signature of what the table currently shows, for the write-if-changed
   * test below.
   *
   * IT IS NOT AN OPTIMISATION, IT IS WHAT MAKES ONE CLAIM TRUE. Rebuilding the
   * tbody destroys every button in it, so a rebuild while focus sits on one
   * would drop that person to `<body>`. Nothing in the shipped page triggers a
   * refresh from inside the table — the buttons move focus OUT before anything
   * else runs, and the checkbox lives outside the table — but "nothing
   * currently does" is an argument, and skipping the rebuild when nothing
   * changed is a guarantee.
   *
   * IT CARRIES EVERY FIELD THE ROWS RENDER, so a change a reader would notice
   * cannot leave the signature still. The separator is a newline because none
   * of the three fields can contain one: `proposed` is a single phrase, the
   * sentences are this file's own, and the index is a number.
   *
   * @param {Array} items - `reviewConflicts`' answer
   * @returns {string}
   */
  function conflictTableSignature(items) {
    return items
      .map(
        (item) =>
          `${item.index}\n${item.entry.proposed}\n${item.resolution.reason}`,
      )
      .join("\n\u0000\n");
  }

  /**
   * Fill the conflicts table and decide whether it and its checkbox are on
   * screen at all (design section 12's D6; register item 47 unit 14).
   *
   * TWO `hidden` ATTRIBUTES, TWO PREDICATES, decided here and nowhere else —
   * `setDisplayOptionsVisible`'s shape, and for its reason:
   *
   *   - the CHECKBOX shows when review is on AND at least one conflict exists.
   *     A control governing an empty table would do nothing, and offering it
   *     would be worse than omitting it, which is the ruling that function
   *     already applies to the speaker option. It is withheld entirely rather
   *     than shown disabled.
   *   - the TABLE shows on the same two conditions AND only while the person
   *     has NOT asked for conflicts in the transcript. D6 says the checkbox
   *     REPLACES the table rather than adding to it, so the two are never both
   *     on screen.
   *
   * IT IS A PREDICATE AND NOT A FOURTH REVEAL. The review block's own reveal is
   * `setReviewVisible`, gated on a change set being loaded; this decides what is
   * offered INSIDE a block that has already been revealed, which is the same
   * distinction the design's section 6 draws between one reveal and two render
   * decisions.
   *
   * SILENT, AND NOTHING HERE GAINS LIVENESS. The table appearing, changing or
   * hiding is not an event that speaks: there is no live region, no live role,
   * no announcer call and no toast. A person meets the table by reaching it,
   * and each control conveys its own name and state on arrival. AGENTS.md's
   * announcement rule question 1, and the rule every other control in this
   * block already follows.
   *
   * THE TBODY IS EMPTIED WHEN THERE IS NOTHING TO SHOW rather than left holding
   * the last set. A hidden table carrying rows from a transcript that has been
   * discarded is a record nobody can see and nobody can trust, and this is the
   * same care `setReviewVisible` takes over the count sentence on its hide
   * branch.
   */
  function refreshConflictTable() {
    const tableWrapper = el(CONFLICT_TABLE_ID);
    const body = el(CONFLICT_TABLE_BODY_ID);
    const option = el(CONFLICT_OPTION_ID);
    if (!tableWrapper || !body || !option) {
      logWarn(
        "the conflicts table is missing from the page — conflicts can still be read in the transcript by ticking Show conflicts in the transcript",
      );
      return;
    }

    const items = showSuggestions ? reviewConflicts() : [];
    const offer = items.length > 0;

    option.hidden = !offer;
    tableWrapper.hidden = !(offer && !showConflictsInTranscript);

    // WRITE-IF-CHANGED, on the terms `conflictTableSignature` records.
    const signature = conflictTableSignature(items);
    if (body.dataset.conflictSignature === signature) return;
    body.dataset.conflictSignature = signature;

    body.replaceChildren(
      ...items.map((item) => buildConflictTableRow(item)),
    );
    logDebug(`conflicts table: ${items.length} row(s) built`);
  }

  /**
   * Move focus to a conflict's own phrase in the transcript — what a table
   * row's button does (design section 12's D6; register item 47 unit 14).
   *
   * THIS WAS THE HARD PART OF THE UNIT AND THE DESIGN SAID SO. In edit mode the
   * row carries an edit control and there is an obvious target; in READ-ONLY
   * mode the row has nothing focusable at all, which is the same gap unit 6
   * wrote into `handleNextSuggestion` in capitals and which a conflict row
   * could previously dodge because it carried its own `tabindex="-1"` sentence.
   * Under D6 it carries no wrapper in the transcript, so that target is gone.
   *
   * THE MECHANISM IS `tabindex="-1"` APPLIED AT THE MOMENT OF FOCUSING, TO THAT
   * ROW ONLY, and it was chosen over the obvious alternative for a measurable
   * reason. Giving EVERY row `tabindex="-1"` in `buildRow` would put an
   * attribute on 657 elements at render time, which is a change to the rendered
   * tree in every pinned tree-gate state; this touches one element, after the
   * walk any instrument takes, so no pinned figure can move for it. It is also
   * self-cleaning: `patchRows` replaces the node on the next repaint and the
   * attribute goes with it, which is harmless because it is needed only for the
   * instant of the move.
   *
   * THE EDIT CONTROL IS TRIED FIRST AND ITS ABSENCE IS THE MODE TEST. An edit
   * control exists only in edit mode, so `el(EDIT_ID_STEM + index)` answers
   * "which mode is this row in" without this function reading `editMode` — one
   * source of truth rather than two that can disagree, which is the reason
   * `setSelectionVisible` reads the module rather than taking a parameter.
   *
   * BY ID, NOT BY A HELD REFERENCE, for `placeFocusOnRow`'s reason: a repaint
   * between the button being built and being pressed would leave a reference
   * pointing at a detached element that can be focused and will do nothing.
   *
   * IT SCROLLS, because `focus()` scrolls by default and that is wanted here —
   * the whole gesture is "take me to that line", and a person moving from a
   * table at the top of the page to phrase 93 needs the page to follow.
   *
   * SILENT. Moving focus is not an announcement; the row announces itself on
   * arrival, which is what a focus move is for.
   *
   * @param {number} index - the phrase's 0-based index
   */
  function placeFocusOnConflictRow(index) {
    const control = el(EDIT_ID_STEM + index);
    if (control) {
      control.focus();
      logDebug(`conflict goto: row ${index}, focus placed on ${control.id}`);
      return;
    }

    const row = el(ROW_ID_STEM + index);
    if (!row) {
      logWarn(`conflict goto: row ${index} is not on the page`);
      return;
    }
    row.setAttribute("tabindex", "-1");
    row.focus();
    logDebug(`conflict goto: row ${index}, focus placed on the row itself`);
  }

  /**
   * A table row's button was pressed — one delegated listener for every row the
   * table will ever have, matching how the transcript's own controls are
   * dispatched.
   *
   * @param {Event} event
   */
  function handleConflictTableClick(event) {
    const index = suggestionControlIndexFrom(
      event.target,
      CONFLICT_GOTO_ID_STEM,
    );
    if (index === null) return;
    placeFocusOnConflictRow(index);
  }

  /**
   * Re-render when "Show conflicts in the transcript" moves — the shape of
   * `handleShowReasonsChange` and `handleShowSuggestionsChange`, for their
   * reasons.
   *
   * IT RE-RENDERS *AND* REFRESHES THE TABLE, which the other two do not both
   * do, because this is the one toggle that moves a conflict between the two
   * surfaces: the transcript gains or loses the wrapper and the table hides or
   * returns, and a refresh of only one of them would show the same conflict
   * twice or not at all.
   *
   * NO TOAST AND NO ANNOUNCEMENT, per AGENTS.md's announcement rule question 1
   * and the rule the two checkboxes beside it already follow.
   */
  function handleShowConflictsChange() {
    const box = el(CONFLICT_TOGGLE_ID);
    showConflictsInTranscript = box ? box.checked : false;
    logDebug(`conflicts in transcript: shown = ${showConflictsInTranscript}`);
    refreshConflictTable();
    if (!haveTranscript()) return;
    renderTranscript(currentResult());
  }

  /**
   * Write the count sentence into its own element.
   *
   * SILENT TEXT, WRITE-IF-CHANGED, for `updateSelectionCount`'s reasons exactly
   * — read that function's note, which is the one place the reasoning is set
   * out and which this block deliberately does not restate at length. One place
   * composes the sentence and one place writes it, so there is one place to
   * check that nothing announces.
   */
  function updateReviewCount() {
    const count = el("transcribe-review-count");
    if (!count) return;

    const state = stateOrNull();
    if (!state || !state.isLoaded()) {
      setText(count, REVIEW_NONE_TEXT);
      // ON THIS BRANCH TOO. A block with no transcript must not be left
      // holding a table of conflicts from one that has been discarded.
      refreshConflictTable();
      return;
    }

    const resolved = reviewResolutions();
    const counts = reviewableCounts(resolved);
    setText(
      count,
      reviewCountSentence({
        total: counts.total,
        accepted: counts.accepted,
        rejected: counts.rejected,
        conflicts: reviewConflictCount(resolved),
      }),
    );

    // THE TABLE REFRESHES WHEREVER THE SENTENCE DOES, FROM THE SAME CALL, and
    // that is the whole reason it is here rather than beside each caller. The
    // sentence's "N cannot be applied" clause and the table's row count are two
    // readings of one fact; a person who sees them disagree cannot tell which
    // to believe. Sharing the call site makes disagreement impossible rather
    // than unlikely.
    refreshConflictTable();
  }

  /**
   * The counts the sentence reports — over the REVIEWABLE set only (D9).
   *
   * IT REPLACES `state.suggestionCounts()` AT THE ONE PLACE THAT COMPOSES THE
   * SENTENCE, and the difference is the whole of amendment 1. That function
   * counts every entry the change set loaded, by status. This one counts only
   * entries that ARRIVED reviewable, so the sentence describes decisions made
   * on THIS surface and nothing else.
   *
   * WHAT THAT FIXES, CONCRETELY. A guard-held entry arrives `rejected` and was
   * counted in the "dismissed" clause; an entry a person ticked in the other
   * lane's own changes table arrives `accepted` and was counted in the
   * "accepted" clause. Neither renders here, so the sentence was reporting
   * corrections a person could not see and decisions they did not take.
   *
   * IT STILL COUNTS A DECISION TAKEN HERE, because `reviewResolutions` keeps
   * an entry whose cue id is in `decidedHere` whatever its status — which is
   * exactly what makes the rule about ARRIVAL rather than about status.
   *
   * `state.suggestionCounts()` IS NOT REMOVED and is still the right answer to
   * a different question: how many entries the change set holds, in each
   * status, whoever decided them. The suggestion-state suite asserts it and
   * should go on doing so.
   *
   * @param {Array} [resolved] - a sweep already in hand, to avoid a second one
   * @returns {{proposed: number, accepted: number, rejected: number, total: number}}
   */
  function reviewableCounts(resolved) {
    const items = resolved || reviewResolutions();
    let proposed = 0;
    let accepted = 0;
    let rejected = 0;
    items.forEach((item) => {
      const status = item.entry.status;
      if (status === SUGGESTION_STATUS_PROPOSED) proposed += 1;
      else if (status === SUGGESTION_STATUS_ACCEPTED) accepted += 1;
      else if (status === SUGGESTION_STATUS_REJECTED) rejected += 1;
    });
    return {
      proposed: proposed,
      accepted: accepted,
      rejected: rejected,
      total: items.length,
    };
  }

  /**
   * Reveal or hide the review block.
   *
   * A FOURTH REVEAL BESIDE THE OTHER THREE, NEVER A PREDICATE INSIDE ANY OF
   * THEM. `setDisplayOptionsVisible` carries register item 54's documented
   * three-predicate contract, `setSpeakerNamingVisible` its own single one and
   * `setSelectionVisible` a third; this block's is none of those. The reasoning
   * is the one unit 4b gave for not folding naming in and unit 6 gave again for
   * selection: a function whose contract is written down is one a later reader
   * can check, and a further predicate would widen a contract rather than add
   * one.
   *
   * THE PREDICATE IS "A CHANGE SET IS LOADED", AND NOTHING ELSE. Not the review
   * toggle — the block CARRIES that toggle, so gating the block on it would put
   * the control out of reach the moment it was used. Not edit mode: a
   * suggestion is something to read as much as something to apply, and the
   * design puts no mode condition on it. Not `labelsAreInformative`: a
   * one-speaker transcript can carry suggestions like any other. And not
   * `hasTranscript` as a separate parameter, because `loadSuggestions` refuses
   * unless a transcript is loaded, so "a change set is loaded" already implies
   * it — a second predicate here could only ever disagree with the state module
   * about a question the state module owns.
   *
   * IT TAKES NO ARGUMENTS, WHICH IS THE ASYMMETRY WORTH NAMING. Its three
   * siblings take `hasTranscript` because that is derived from the RESULT,
   * which only the caller holds. This one asks the state module directly, for
   * `setSelectionVisible`'s reason for reading `editMode` off the module: there
   * is one source of truth, and passing it would create a second place it could
   * be wrong.
   *
   * SILENT. Revealing or hiding a block is not an event that speaks: it is not
   * a live region, nothing here announces, and each control conveys its own
   * name and state when a person reaches it. Item 46 settled this for controls
   * appearing at a flip, and the situation is the same one.
   *
   * IT REFRESHES THE COUNT ON BOTH BRANCHES rather than trusting whatever was
   * last written. On the way in, so the sentence describes the set that has
   * just arrived — the block can be revealed with a change set already
   * standing. On the way out, so a hidden block is not left holding a figure
   * from a transcript that has been discarded. `setText` is write-if-changed,
   * so a refresh that changes nothing writes nothing.
   *
   * NOTHING IS EMPTIED ON HIDE, and that is where it differs from its two
   * picker-owning siblings. Their `<select>` options BELONG TO A DISCARDED
   * TRANSCRIPT, which is a real hazard; this block holds a sentence and three
   * controls, none of which names a row. Rewriting the count to the zero-state
   * sentence is the whole of what hiding has to undo.
   */
  function setReviewVisible() {
    const block = el("transcribe-review");
    if (!block) return;

    const state = stateOrNull();
    const show = Boolean(
      state && state.isLoaded() && state.suggestionCounts().total > 0,
    );
    block.hidden = !show;

    updateReviewCount();

    // The two checkboxes are kept in step with this module's own state, the way
    // setDisplayOptionsVisible keeps its three in step, so a reveal cannot show
    // a control disagreeing with the render decision it governs.
    const suggestionsBox = el("transcribe-review-show-suggestions");
    if (suggestionsBox) suggestionsBox.checked = showSuggestions;
    const reasonsBox = el("transcribe-review-show-reasons");
    if (reasonsBox) reasonsBox.checked = showReasons;
    // THE THIRD, since register item 47 unit 14. Its own wrapper's `hidden` is
    // decided by `refreshConflictTable`, which `updateReviewCount` above has
    // already run; this keeps the control's `checked` in step with the module,
    // exactly as the two lines before it do.
    const conflictsBox = el(CONFLICT_TOGGLE_ID);
    if (conflictsBox) conflictsBox.checked = showConflictsInTranscript;
  }

  /**
   * Re-read the state and bring the whole block up to date.
   *
   * THE ENTRY POINT FOR ANYTHING THAT LOADS A CHANGE SET, and the reason it is
   * public. Nothing in the shipped page loads one yet — that route belongs to
   * the Captions Fixer lane — so today its callers are the fixture loader and
   * the tree gate. It exists so neither has to know which of the functions
   * above to call, and so the gate can reach a revealed block by asking the
   * controller rather than by setting a property on the page.
   */
  function refreshReview() {
    setReviewVisible();
    reportExcludedSuggestions();
  }

  /**
   * Say how many loaded entries this surface is NOT reviewing, and why.
   *
   * D9 REQUIRES IT, "the way `refused` is reported" — and `refused` is
   * reported in a LOG rather than on screen (`loadSuggestions`'s own
   * `logInfo`), so this follows it there. An exclusion is not a fault and
   * nothing on the page should present it as one: it is the other lane's
   * decision being honoured, which is the correct outcome.
   *
   * IT IS BROKEN DOWN BY CAUSE, because the three mean different things to
   * whoever is reading the log. A `guard:` prefix is the Captions Fixer
   * lane's own guards holding an entry; "person" is somebody unticking a row
   * in their changes table; a decided entry with no `rejectedBy` at all is
   * somebody ticking one. Collapsing them to a single number would leave a
   * reader unable to tell a guard sweep from a person's afternoon.
   *
   * SILENT ON THE PAGE AND SILENT TO A READER. No live region, no toast, no
   * announcement — AGENTS.md § Announcements question 1, and the rule every
   * other control in this block already follows.
   */
  function reportExcludedSuggestions() {
    const state = stateOrNull();
    if (!state || !state.isLoaded()) return;

    const total = state.suggestionCounts().total;
    if (total === 0) return;

    let heldByGuard = 0;
    let rejectedByPerson = 0;
    let decidedElsewhere = 0;
    for (let index = 0; index < state.count(); index += 1) {
      const entry = state.suggestionAt(index);
      if (!entry || isReviewable(entry)) continue;
      const by = typeof entry.rejectedBy === "string" ? entry.rejectedBy : "";
      if (by.indexOf(REJECTED_BY_GUARD_PREFIX) === 0) heldByGuard += 1;
      else if (by === REJECTED_BY_PERSON) rejectedByPerson += 1;
      else decidedElsewhere += 1;
    }

    const excluded = heldByGuard + rejectedByPerson + decidedElsewhere;
    if (excluded === 0) {
      logInfo(`all ${total} loaded suggestion(s) are reviewable on this surface`);
      return;
    }
    logInfo(
      `${excluded} of ${total} loaded suggestion(s) are NOT reviewable here — ` +
        `${heldByGuard} held by a guard, ${rejectedByPerson} rejected by a person, ` +
        `${decidedElsewhere} decided before this surface saw them`,
    );
  }

  /**
   * Re-render the rows when "Show suggestions" moves.
   *
   * A RENDER DECISION, NOT A REVEAL, AND THE DISTINCTION IS THE WHOLE POINT.
   * The design's § 6 corrects an earlier draft that had two reveals: there is
   * one reveal, on a change set being loaded, and two decisions passed into the
   * render path exactly as `timestamps` and `edit` already are. So this handler
   * has the shape of `handleShowTimestampsChange` and not the shape of
   * `handleEditModeChange`.
   *
   * IT CHANGES NOTHING VISIBLE AT THIS UNIT, because no row renders a
   * suggestion yet. It is wired anyway so that unit 7 adds a branch inside
   * `buildRow` rather than a pathway through this file, and so the toggle can
   * be measured by the tree gate before there is anything for it to move.
   *
   * NO TOAST AND NO ANNOUNCEMENT, per AGENTS.md § Announcements question 1 and
   * the rule the three display options already follow. The checkbox conveys its
   * own state and the transcript is not a live region. Listen row 52 (f) judges
   * the reason toggle's sufficiency and (g) the block as a whole.
   */
  function handleShowSuggestionsChange() {
    const box = el("transcribe-review-show-suggestions");
    showSuggestions = box ? box.checked : false;
    logDebug(`suggestion display: shown = ${showSuggestions}`);
    // THE TABLE AND ITS CHECKBOX ARE OFFERED ONLY WHILE REVIEW IS ON, so this
    // toggle decides whether either is on screen — register item 47 unit 14.
    // It runs BEFORE the early return, because turning review off with no
    // transcript loaded must still take the table away.
    refreshConflictTable();
    // haveTranscript(), not currentResult(): see its doc comment for why the
    // yes/no question is not asked by building a snapshot and testing it.
    if (!haveTranscript()) return;
    renderTranscript(currentResult());
  }

  /**
   * Re-render the rows when "Show the reason for each suggestion" moves — the
   * same shape as the handler above, for the same reasons.
   *
   * IT SHIPS TICKED, which is the design's stated default: a reason is useful
   * information and withholding it is the exceptional choice. The asymmetry
   * with "Show suggestions", which ships clear, is deliberate and is recorded
   * in tools.html beside the markup.
   */
  function handleShowReasonsChange() {
    const box = el("transcribe-review-show-reasons");
    showReasons = box ? box.checked : true;
    logDebug(`suggestion reasons: shown = ${showReasons}`);
    if (!haveTranscript()) return;
    renderTranscript(currentResult());
  }

  /**
   * The row a suggestion control belongs to, reading focus's ACTUAL current
   * position — register item 47 unit 10.
   *
   * FOUR STEMS, TRIED IN TURN: the edit control (edit mode only), Accept,
   * Dismiss, and a conflict's own sentence. Any one of them can hold focus
   * when "Next suggestion" is pressed, because Accept and Dismiss land at
   * this same unit and a person can be sitting on any of the four when they
   * reach for it. `null` when focus is nowhere any of the four name — on the
   * "Next suggestion" button itself, on some other control entirely, or
   * nowhere in particular — and the sweep below starts at the first
   * suggestion in that case, exactly as it always has.
   *
   * @returns {number|null}
   */
  function focusedSuggestionRowIndex() {
    const target = document.activeElement;
    const edit = editIndexOf(target);
    if (edit !== null) return edit;
    const accept = suggestionControlIndexFrom(target, ACCEPT_ID_STEM);
    if (accept !== null) return accept;
    const dismiss = suggestionControlIndexFrom(target, DISMISS_ID_STEM);
    if (dismiss !== null) return dismiss;
    const conflict = suggestionControlIndexFrom(target, CONFLICT_ID_STEM);
    if (conflict !== null) return conflict;
    // A FIFTH STEM SINCE REGISTER ITEM 47 UNIT 14, AND IT IS THE ROW ITSELF.
    // "Go to phrase" leaves focus on the `<li>` in read-only mode, so without
    // this a person who has just been taken to phrase 93 and then presses
    // "Next suggestion" is sent back to the first suggestion in the transcript
    // rather than on to the next one. The row is not a CONTROL, which is what
    // this function's own heading says it reads; it is where focus really is,
    // which is what the sweep below actually needs.
    return suggestionControlIndexFrom(target, ROW_ID_STEM);
  }

  /**
   * Move focus to the next row carrying a suggestion still awaiting a
   * decision, given where the person is now — THE ONE FOCUS RULE Accept,
   * Dismiss and "Next suggestion" all share (register item 47 unit 10).
   *
   * ONE RULE WITH TWO ARMS SINCE REGISTER ITEM 47 UNIT 14, and which arm is
   * live is the person's own choice rather than a mode:
   *
   *   - WITH THE TABLE SHOWING (the default), it walks APPLICABLE suggestions
   *     in the transcript only. A conflict is not in the transcript to be
   *     walked to, and it is reachable by Tab from the table's own button, so
   *     nothing is skipped past — design section 12's D6.
   *   - WITH "Show conflicts in the transcript" TICKED, the rule is section
   *     7's, unchanged: conflicts are walked like any other proposed row, and
   *     a conflict's target is its own sentence, which is why that sentence
   *     takes `tabindex="-1"` (buildSuggestionWrapper).
   *
   * THE WITHDRAWN PARAGRAPH IS QUOTED HERE per register items 51 and 56,
   * because its reasoning is still correct about the world it described:
   *
   *   ~~CONFLICTS ARE NOT SKIPPED. A rule that jumped only between applicable
   *   rows would walk a person past every line the surface could not fix,
   *   which is the opposite of why a conflict sits in the transcript's own
   *   order at all (design § 11 (c)).~~
   *
   * § 11 (c) was tested by the sitting it was written for and overturned. What
   * makes skipping safe now is not that conflicts matter less but that they
   * have somewhere else to be reached from; under the ticked arm they are in
   * the transcript and the old rule applies to them in full.
   *
   * When nothing remains for the live arm, the target is the count sentence,
   * which took `tabindex="-1"` for exactly this (tools.html's own comment
   * beside it).
   *
   * ONE SWEEP, `reviewResolutions()`, READ ONCE. `proposedRowIndices()` and a
   * second resolution of the landing row would be the same sweep taken
   * twice; this function takes it once and reads both the ordered index list
   * and each row's own `resolution.ok` off the one array.
   *
   * @param {number|null} fromIndex - where focus is now, or null
   */
  function focusNextSuggestionWrapper(fromIndex) {
    const proposed = reviewResolutions().filter(
      (item) =>
        item.entry.status === SUGGESTION_STATUS_PROPOSED &&
        // D6's arm. A conflict is walkable only while it is in the transcript;
        // otherwise there is nothing in the list for this rule to land on, and
        // its own row has no focus target at all.
        (showConflictsInTranscript || item.resolution.ok),
    );

    if (proposed.length === 0) {
      const count = el("transcribe-review-count");
      if (!count) {
        logWarn("cannot move focus to the count sentence — it is missing");
        return;
      }
      count.focus();
      logDebug("suggestion focus: none proposed remain — moved to the count sentence");
      return;
    }

    const indices = proposed.map((item) => item.index);
    const nextIndex = nextProposedIndexFrom(indices, fromIndex);
    const item = proposed.find((entry) => entry.index === nextIndex);
    const targetId = item.resolution.ok
      ? ACCEPT_ID_STEM + nextIndex
      : CONFLICT_ID_STEM + nextIndex;

    const target = el(targetId);
    if (!target) {
      logWarn(`row ${nextIndex}'s suggestion focus target (${targetId}) is missing`);
      return;
    }
    target.focus();
    logDebug(`suggestion focus moved from ${fromIndex} to ${targetId}`);
  }

  /**
   * "Next suggestion": move focus to the next row awaiting a decision, from
   * wherever focus is now.
   *
   * WORKS IN BOTH MODES, SINCE UNIT 10. Accept, Dismiss and a conflict's own
   * sentence all exist in read-only mode as well as edit mode — the
   * limitation the previous version of this comment recorded, that the
   * gesture only worked in edit mode because it targeted the row's edit
   * control, is discharged: `focusNextSuggestionWrapper` targets the row's
   * OWN focus target, not the row.
   *
   * A NO-OP SAYS NOTHING. With no proposed suggestion left, focus still moves
   * — to the count sentence, which has already said why — but nothing is
   * announced for a gesture that moved nothing new; item 46's rule that a
   * no-op is silent, applied here to what this function does NOT do rather
   * than to a return that skips it.
   */
  function handleNextSuggestion() {
    focusNextSuggestionWrapper(focusedSuggestionRowIndex());
  }

  /**
   * The sentence spoken after Accept or Dismiss (register item 47 unit 10;
   * design § 7).
   *
   * PURE, AND EXPOSED FOR THE SAME REASON `reviewCountSentence` is — the
   * harness can assert the wording without a page, a fixture or a render.
   *
   * "N REMAINING" USES `numberWord`, NOT `pluralise` — the house rule for
   * prose a person reads (see `numberWord`'s own doc comment): one to nine as
   * words, ten and up as digits. "NO SUGGESTIONS REMAINING" IS WORDS, NEVER A
   * PRINTED ZERO, for the same reason `reviewCountSentence` omits a
   * zero-valued clause rather than printing one.
   *
   * PROVISIONAL WORDING, matching every other sentence this unit ships —
   * design § 7 says so of its own draft, and listen row 52 part (d) is what
   * decides it.
   *
   * @param {"accepted"|"dismissed"} verb
   * @param {number} phraseNumber - 1-based
   * @param {number} remaining - suggestions still proposed, counted AFTER
   *   this decision
   * @returns {string}
   */
  function suggestionDecisionSentence(verb, phraseNumber, remaining) {
    const remainingClause =
      remaining === 0
        ? "No suggestions remaining."
        : `${numberWord(remaining)} remaining.`;
    return `Suggestion ${verb} for phrase ${phraseNumber}. ${remainingClause}`;
  }

  /**
   * The shared tail of Accept and Dismiss: write the status, repaint the row,
   * update the count, move focus, then announce — in that order, matching
   * design § 7's numbered steps exactly. Focus moves BEFORE the announcement
   * is spoken, and both happen AFTER `patchRows`, because the repaint
   * destroys the button that was pressed (register item 47 unit 10).
   *
   * `setSuggestionStatus` IS THE ONLY WRITER OF `status`, so this is the one
   * place either gesture reaches it. A refusal here — a phrase index that no
   * longer carries an entry, or an index out of range — means the button was
   * never supposed to render; it is logged and nothing downstream runs,
   * matching Accept's own rule for a resolution failure.
   *
   * THE NO-OP RULE FROM ITEM 46 IS ANSWERED BY CONSTRUCTION, NOT BY A GUARD
   * HERE. `setSuggestionStatus` always changes something when it is reached
   * from Accept or Dismiss — the entry's status is "proposed" whenever the
   * button that calls this exists (`suggestionForRow` refuses any other
   * status) — so there is no "nothing happened" branch to gate. Design § 7's
   * own no-op case is about the TEXT, not the status: an accepted suggestion
   * whose `proposed` equals the current text writes no new bytes and still
   * moves the status and still speaks, because the person's gesture changed
   * the RECORD even though it changed no words. That case is handled in
   * `handleAcceptSuggestion`, which calls `setText` before this function ever
   * runs and does not gate on whether it changed anything.
   *
   * @param {number} index - the phrase's 0-based index
   * @param {"accepted"|"dismissed"} verb - the word the announcement uses
   * @param {"accepted"|"rejected"} status - the value written to the entry
   */
  function finishSuggestionDecision(index, verb, status) {
    const state = stateOrNull();
    if (!state || !state.isLoaded()) {
      logWarn(`${verb} on phrase ${index} — no transcript loaded`);
      return;
    }

    // READ BEFORE THE WRITE. `suggestionAt` returns the LIVE entry, so
    // reading the cue id after `setSuggestionStatus` would still work — but
    // the write is what makes the entry indistinguishable from one decided
    // upstream, so the record of "we decided this" is taken first as a matter
    // of ordering rather than of necessity. See `decidedHere`.
    const deciding = state.suggestionAt(index);
    const decidedCueId = deciding ? deciding.cueId : null;

    try {
      state.setSuggestionStatus(index, status);
    } catch (error) {
      logError(`the ${verb} decision on phrase ${index} was refused`, error);
      return;
    }

    // ONLY AFTER THE WRITE SUCCEEDED. A refused write returns above, so a
    // decision this surface did not actually make never reaches the set —
    // which matters because membership makes an entry reviewable for the
    // life of the page.
    if (decidedCueId !== null) decidedHere.add(decidedCueId);

    patchRows([index]);
    updateReviewCount();
    focusNextSuggestionWrapper(index);

    // COUNTED OVER THE REVIEWABLE SET, not `state.suggestionCounts()`, which
    // counts every loaded entry including the ones D9 excludes. Saying "two
    // left" when one of them is an entry a guard held upstream would send a
    // person hunting for a suggestion this surface never shows.
    const remaining = reviewableCounts().proposed;
    speak(suggestionDecisionSentence(verb, index + 1, remaining));
  }

  /**
   * Accept a row's proposed suggestion (register item 47 unit 10; design
   * § 7, steps 1-7).
   *
   * RESOLVES THE TEXT ITSELF, THROUGH THE SAME THREE ARGUMENTS
   * `suggestionForRow` RESOLVES WITH, rather than trusting whatever the
   * wrapper last rendered — the wrapper can be stale by the time a person
   * presses the button (another gesture patched the row in between), so this
   * re-resolves against the CURRENT phrase text rather than reading the DOM.
   *
   * A RESOLUTION FAILURE HERE MEANS THE BUTTON WAS NEVER SUPPOSED TO RENDER.
   * `buildSuggestionWrapper` only ever builds Accept and Dismiss on the
   * `resolution.ok` branch, so reaching this function with a failing
   * resolution is a defect — logged, and nothing is written, matching
   * `commitControl`'s own rule for a refused write.
   *
   * `state.setText` IS CALLED WITHOUT GATING ON `changed` — see
   * `finishSuggestionDecision`'s own note on the no-op case design § 7
   * describes: an accepted suggestion whose resolved text equals the current
   * text writes no new bytes and still moves the status and still speaks.
   *
   * @param {number} index - the phrase's 0-based index
   */
  function handleAcceptSuggestion(index) {
    const api = moduleOrNull();
    const state = stateOrNull();
    if (!api || !state || !state.isLoaded()) {
      logWarn(`accept on phrase ${index} — no transcript loaded`);
      return;
    }

    const result = currentResult();
    const phrases = result && Array.isArray(result.phrases) ? result.phrases : [];
    const phrase = phrases[index];
    const entry = state.suggestionAt(index);
    if (!phrase || !entry) {
      logWarn(`accept on phrase ${index} — no suggestion to accept`);
      return;
    }

    const labelsAreInformative = api.distinctSpeakerCount(result) > 1;
    const speakerLabel = api.speakerLabelFor({
      speaker: phrase.speaker,
      previousSpeaker: api.previousSpeakerAt(phrases, index),
      labelsAreInformative,
    });

    const resolution = api.suggestionTextFor({
      original: entry.original,
      proposed: entry.proposed,
      currentText: phrase.text,
      speakerLabel,
    });

    if (!resolution.ok) {
      logWarn(
        `accept on phrase ${index} — the button should never have rendered; ` +
          `the suggestion no longer resolves (${resolution.reason})`,
      );
      return;
    }

    state.setText(index, resolution.text);
    finishSuggestionDecision(index, "accepted", "accepted");
  }

  /**
   * Dismiss a row's proposed suggestion — steps 3 to 7 of design § 7's Accept
   * list, with no write to the text (register item 47 unit 10).
   *
   * NO RESOLUTION IS TAKEN. Dismissing needs no text and no speaker label —
   * only that a proposed entry exists to dismiss, which
   * `finishSuggestionDecision`'s own `setSuggestionStatus` call refuses
   * loudly if it does not.
   *
   * @param {number} index - the phrase's 0-based index
   */
  function handleDismissSuggestion(index) {
    const state = stateOrNull();
    if (!state || !state.isLoaded()) {
      logWarn(`dismiss on phrase ${index} — no transcript loaded`);
      return;
    }
    if (!state.suggestionAt(index)) {
      logWarn(`dismiss on phrase ${index} — no suggestion to dismiss`);
      return;
    }
    finishSuggestionDecision(index, "dismissed", "rejected");
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
   * THE SELECTION IS CLEARED, AND UNIT 7b's DECISION TO KEEP IT IS WITHDRAWN
   * (register item 46 unit 10, the sitting of 14 September 2026). 7b recorded
   * both readings and took no preference, naming listen row 49 as the place it
   * would be decided; that is what happened. The withdrawn paragraph is quoted
   * in place rather than deleted, per register items 51 and 56:
   *
   *   "THE SELECTION IS KEPT, NOT CLEARED, AND IT IS A DECISION WITH A NAMED
   *    ALTERNATIVE. Moving the lines back is the only undo this feature has —
   *    design section 5 settles that `revertSpeaker` is not built precisely
   *    because `setSpeaker` to the arrival slot already is one — and keeping
   *    the ticks makes that undo ONE gesture rather than forty. Clearing would
   *    punish the most likely mistake, which is moving the right lines to the
   *    wrong speaker. THE ALTERNATIVE IS TO CLEAR, on the ground that a
   *    selection surviving its own gesture can read as a trap: a person who
   *    moves and then moves again without looking moves the same lines twice.
   *    Clear selection exists for when they are done. LISTEN ROW 49 IS WHERE
   *    THIS IS DECIDED, and it is recorded here as two options rather than one
   *    preference so the sitting has something to compare against."
   *
   * THE RULING IS CLEAR, AND THE GROUND IS THAT THE TRAP READING BEATS THE
   * CONVENIENCE ONE. A selection surviving its own gesture is something people
   * may simply not notice — and an unnoticed selection is acted on again. The
   * undo the withdrawn text was protecting is a real cost and is not denied:
   * REVERSING A CHANGE NOW MEANS RE-TICKING.
   *
   * THE COMPENSATION IS ALREADY BUILT AND IS WHY THE COST IS BEARABLE. The
   * notification names BOTH speakers — "4 lines changed from Speaker 1 to
   * Speaker 2" — so a person who wants to reverse it knows what to set the
   * picker back to even with the ticks gone. That sentence was built at unit 8
   * for a different reason and turns out to carry this one.
   *
   * IT IS CLEARED BEFORE EITHER REPAINT BRANCH RUNS, so both paths read an
   * empty selection and rebuild unticked rows from it. There is no second
   * writer walking the checkboxes, and no window in which the Set and the boxes
   * disagree.
   *
   * AND THE CLEAR ITSELF SAYS NOTHING. One gesture, one output: the change's
   * own notification is it. A second toast for a consequence of the first is
   * noise, and the no-op rule this file records exists to stop exactly that.
   * Listen row 51 reads for whether a selection disappearing in silence is
   * discoverable, which is the question this ruling opens.
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
    // below reaches it through buildRow. It sits BEFORE the write so a missing
    // module cannot leave the state moved and the screen unpainted.
    // applySpeakerName carries the same guard in the same position, and since
    // unit 10 for a DIFFERENT reason — its repaint guards for itself and its
    // SENTENCE does not. Two guards, one shape, two grounds; the clause saying
    // "for the same reason" was true until then and is corrected rather than
    // left to mislead.
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

    // THE SELECTION IS EMPTIED HERE, BEFORE EITHER BRANCH, AND THE COUNT
    // FOLLOWS IT (register item 46 unit 10). Both repaint paths read
    // `selectedRows` — the full render through renderTranscript's own hoist,
    // the targeted one through patchRows' — so clearing above them is what
    // makes every rebuilt row come back unticked BY CONSTRUCTION. Clearing
    // after a branch would leave the Set and the boxes disagreeing for the
    // length of the repaint, and would need a second writer to walk 657
    // checkboxes and put them right.
    //
    // `indices` WAS TAKEN BEFORE THIS AND IS STILL THE ROWS THE PERSON TICKED.
    // It is an ordinary array by now, not a view on the Set, so emptying the
    // Set cannot reach back into it — which is what lets the affected set below
    // still know what was selected.
    //
    // NOTHING IS ANNOUNCED FOR THE CLEAR. See this function's own notes: one
    // gesture, one output, and the change's sentence is it.
    selectedRows.clear();
    updateSelectionCount();

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
      // THE FOURTH REVEAL (register item 47 unit 6). This branch is where
      // patchRows falls through to a full render, and it refreshed THREE
      // reveals when unit 6 found it. The review block joins them for the
      // reason the comment above gives for the other three: a reveal reads the
      // state the rows are in, and a block left unrefreshed here would carry a
      // count sentence composed before the labels flipped — and the conflict
      // clause in that sentence DEPENDS on the label decision, because
      // `suggestionTextFor` composes its expected prefix from a resolved
      // speaker number. This is the one call site where skipping it would give
      // a WRONG figure rather than merely a stale visibility.
      setReviewVisible();
      speak(changeSentence);
      logInfo(
        `moved ${outcome.changed} line(s) to speaker ${target}; labels became ` +
          `${informativeAfter ? "informative" : "uninformative"}, so the list was ` +
          `rebuilt; selection cleared`,
      );
      return;
    }

    // THE TARGETED BRANCH. The set to repaint is THREE things unioned, and each
    // is here for a different reason:
    //
    //   1. EACH MOVED ROW — `outcome.indices`, the rows `setSpeaker` reports as
    //      actually changed. Their speaker span and their marker both moved.
    //
    //   2. THE ROW AFTER EACH MOVED ROW. `setSpeaker` returns the rows that
    //      CHANGED, which is not the same set, because ON_CHANGE suppression
    //      reads the previous row through `previousSpeakerAt` — so a row whose
    //      own speaker did not move can still gain or lose its label.
    //
    //   3. EVERY ROW THAT WAS SELECTED (register item 46 unit 10). THIS IS THE
    //      ONE THAT IS EASY TO MISS AND THE CONSOLE SHEET HAS A ROW NAMED FOR
    //      IT. A ticked row that ALREADY carried the target speaker did not
    //      change, so it is not in `outcome.indices` at all — and without this
    //      term it would keep its tick while every row beside it lost one. Tick
    //      six lines where two are already on the target, and four would clear.
    //
    // FOLDING THE OLD SELECTION IN IS WHAT MAKES THE CLEAR CORRECT BY
    // CONSTRUCTION AND AVOIDS A SECOND WRITER. These rows are being rebuilt
    // anyway; `buildRow` reads the now-empty Set for its `selected` argument,
    // so the tick goes simply by the row being built again. The alternative —
    // walking the checkboxes and setting `checked = false` — is the arrangement
    // handleClearSelection uses, and it is right THERE because that gesture
    // rebuilds nothing. Here it would be a second path to the same outcome.
    //
    // Bounded at the last index so a neighbour past the end is never asked for,
    // deduped so adjacent moved rows are not rebuilt twice, and sorted so the
    // batch is orderly.
    const result = currentResult();
    const lastIndex =
      (result && Array.isArray(result.phrases) ? result.phrases.length : 0) - 1;
    const toRepaint = new Set();
    outcome.indices.forEach((index) => {
      toRepaint.add(index);
      if (index + 1 <= lastIndex) toRepaint.add(index + 1);
    });
    indices.forEach((index) => {
      if (index >= 0 && index <= lastIndex) toRepaint.add(index);
    });
    const affected = Array.from(toRepaint).sort((a, b) => a - b);

    const painted = patchRows(affected);
    // BOTH PICKERS, because a move can empty a slot and can fill one that was
    // empty, and the option TEXT of neither changes but the naming picker's
    // SLOT SET does — it reads the phrases, so a slot no line carries any more
    // drops out of it while staying in the move picker's union.
    repopulateSpeakerPickers();

    // A MOVE CAN TURN AN APPLICABLE SUGGESTION INTO A CONFLICT TOO, by the
    // other of `suggestionTextFor`'s two routes — register item 47 unit 14. A
    // moved line keeps its `sourceSpeaker` and gains a new `speaker`, which is
    // exactly the `speaker-changed` case unit 13 built rule 3 for. Placed
    // BEFORE the announcement and after the repaint, matching
    // `finishSuggestionDecision`'s own ordering; it announces nothing itself.
    //
    // A RENAME IS NOT HERE, AND THE ABSENCE IS MEASURED RATHER THAN OVERLOOKED.
    // `resolveSuggestionAt` composes the expected prefix through
    // `speakerLabelFor` with NO `names` argument, so it is always the numbered
    // form — a name can change what the row PRINTS and cannot change what
    // resolves. `applySpeakerName`'s own `patchRows` therefore needs no refresh
    // here, and adding one would suggest a coupling that does not exist.
    updateReviewCount();

    speak(changeSentence);
    logInfo(
      `moved ${outcome.changed} line(s) to speaker ${target}; ` +
        `${painted.rebuilt} row(s) repainted (${affected.length} affected, ` +
        `${outcome.changed} moved), selection cleared`,
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
   *
   * IT REPAINTS THROUGH `patchRows` SINCE UNIT 10, AND THE TARGETED WRITER IS
   * DELETED RATHER THAN LEFT UNUSED. The withdrawn line read
   * `const painted = repaintSpeakerLabels(slot, names);`, and that function's
   * own JSDoc is quoted in full in the design document rather than kept here.
   *
   * IT IS A SIMPLIFICATION AS WELL AS A FIX, WHICH IS WHY THE WRITER GOES
   * RATHER THAN GAINING A SECOND CASE. `patchRows` becomes the ONE repaint path
   * for both gestures that change what a row says, so the marker's wording is
   * composed in one place that both reach — `buildRow` — and a rename can no
   * longer produce a row that differs from a rendered one. Two writers is how
   * the staleness got in: the targeted one knew about the speaker span and
   * nothing else on the row.
   *
   * THE COST IS BOUNDED AND WAS MEASURED BEFORE IT WAS ACCEPTED. A rename now
   * rebuilds that slot's rows rather than writing one string each — 307 rows on
   * slot 1 of the committed fixture. Unit 7b measured 100 rows patched in 4 ms
   * on the same path, so the predicted cost was roughly 12 ms and the measured
   * figure is recorded against listen row 51 rather than against this comment,
   * which would go stale.
   *
   * FOCUS IS SAFE BY CONSTRUCTION AND NOT BY CARE, WHICH IS THE SAME ARGUMENT
   * THAT MADE THE MOVE SAFE. This gesture is reached from the Apply button or
   * from the name field, both OUTSIDE the list, so no row being replaced can
   * hold focus — `patchRows`'s own notes carry the reasoning and its no-focus-
   * placement decision follows from it. The withdrawn repaint claimed a
   * stronger property, that it replaced no node at all; that property is real
   * and was not worth a second builder and a stale marker.
   */
  function applySpeakerName() {
    const state = stateOrNull();
    if (!state || !state.isLoaded()) {
      logWarn("a speaker name was applied with no transcript loaded");
      return;
    }

    // THE GUARD STAYS, AND ITS REASON CHANGED AT UNIT 10. It was here because
    // the old targeted repaint called `speakerLabelText`, which guards nothing;
    // that repaint is gone and `patchRows` guards for itself. What still needs
    // it is the SENTENCE — `api.speakerDisplayName` is called unguarded below
    // to compose the slot's number form — and it still sits BEFORE the write,
    // so a missing module cannot leave the state named and the screen
    // unpainted.
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
    // THE RENAME REPAINT, THROUGH `patchRows` SINCE UNIT 10 — the ONE repaint
    // path, and the line it replaces is quoted in the JSDoc above.
    //
    // THE AFFECTED SET IS BOTH SIDES OF THE MARKER, and that is the defect this
    // replaced. A row whose CURRENT speaker is the renamed slot needs its label
    // and the marker's "to" half; a row whose SOURCE speaker is the renamed
    // slot needs the marker's "from" half and may carry a different speaker
    // entirely — so it is not in the first set at all. The old targeted repaint
    // saw neither: it matched on `phrase.speaker === slot` and wrote only the
    // speaker span's textContent, so a renamed source slot kept its old "from"
    // text for ever and a renamed current slot kept its old "to" text.
    //
    // NO NEIGHBOUR WIDENING, WHICH IS WHERE THIS DIFFERS FROM THE MOVE. A
    // rename never changes which rows show a label — suppression depends on
    // speaker NUMBERS and the label mode, not on names — so no row outside this
    // set can gain or lose one. The move widens by one per moved row precisely
    // because a move DOES change that.
    const result = currentResult();
    const phrasesNow =
      result && Array.isArray(result.phrases) ? result.phrases : [];
    const affected = [];
    phrasesNow.forEach((phrase, index) => {
      if (!phrase) return;
      if (phrase.speaker === slot || phrase.sourceSpeaker === slot) {
        affected.push(index);
      }
    });
    const painted = patchRows(affected);
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
      `speaker ${slot} named: ${painted.rebuilt} of ${affected.length} rows rebuilt, ` +
        `${painted.missing} had no node`,
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
    // A CORRECTION CAN TURN AN APPLICABLE SUGGESTION INTO A CONFLICT, WITH
    // NOTHING HAVING TOUCHED THE CHANGE SET — register item 47 unit 14, and
    // the defect is older than the table. `suggestionTextFor` resolves against
    // the phrase's CURRENT text, so editing a line the model had a suggestion
    // for makes that suggestion stale on the spot. The row was already
    // repainted above and showed the conflict; the COUNT SENTENCE was not, and
    // has been reporting a stale "N cannot be applied" since the sentence
    // shipped. This closes that, and carries the table with it because both go
    // through the one call.
    updateReviewCount();
  }

  /**
   * A THIRD DELEGATED LISTENER ON THE SAME HOST, register item 47 unit 10.
   * Accept and Dismiss are `<button>` elements rendered per proposed
   * suggestion — up to 657 of them, the same scale as the edit and selection
   * controls above — so they are dispatched the same way: one listener on
   * `#transcribe-transcript`, tested per event by the control's own id, never
   * one listener per button.
   *
   * A SEPARATE EVENT FROM `change` AND `keydown`, NOT A THIRD BRANCH INSIDE
   * EITHER. A button fires neither of those for a plain activation — its
   * default action is `click` — so this is a new listener rather than a new
   * branch in a handler built for a different event.
   *
   * `event.target` IS THE BUTTON, NEVER THE HIDDEN CONTINUATION SPAN INSIDE
   * IT. The span is `.visually-hidden` and carries no visual footprint on
   * screen, so neither a mouse click nor a keyboard activation's synthetic
   * click can land on it — a text node is not an Element and cannot be a
   * target either, so `event.target` resolves to the nearest ancestor
   * Element, the `<button>` itself, exactly as `rowIndexFrom`'s own callers
   * assume for the controls they read.
   *
   * REACHING A BUTTON AT ALL DEPENDS ON `handleTranscriptKeydown` NOT
   * SWALLOWING ITS ENTER OR SPACE, MEASURED RATHER THAN ASSUMED. That
   * handler's `editIndexOf(event.target)` check returns null for any target
   * that is not an `<input>` matching EDIT_ID_STEM, so it returns before
   * calling `preventDefault` for a button target — verified live with a
   * throwaway button under the delegated listener, both keys, real trusted
   * input via Playwright's keyboard API rather than a synthetic
   * `dispatchEvent` (which does not exercise a browser's default action for
   * either key on a focused button).
   *
   * @param {Event} event
   */
  function handleTranscriptClick(event) {
    const acceptIndex = suggestionControlIndexFrom(event.target, ACCEPT_ID_STEM);
    if (acceptIndex !== null) {
      handleAcceptSuggestion(acceptIndex);
      return;
    }
    const dismissIndex = suggestionControlIndexFrom(event.target, DISMISS_ID_STEM);
    if (dismissIndex !== null) {
      handleDismissSuggestion(dismissIndex);
    }
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
    // THE REVIEW BLOCK GOES WITH IT, and `state.reset()` above has already
    // emptied the change set, so the predicate is false by the time this runs
    // and the block hides. Its entries are CUE IDS INTO THE DISCARDED
    // TRANSCRIPT — the same objection as the naming block's slot numbers and
    // the selection's row indices, and worse for the same reason an index is:
    // a cue id is valid against any transcript long enough, so a carried change
    // set would propose corrections to lines nobody has looked at.
    setReviewVisible();

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
      // AFTER renderTranscript, for the reason the two lines above it are. A
      // fresh run has no change set — handleFileChange reset the state when the
      // file was chosen — so this hides the block, and it is called rather than
      // assumed for the reason every other reveal here is: the function that
      // owns the block's visibility is the one that should decide it.
      setReviewVisible();
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

    // THE REVIEW BLOCK'S THREE CONTROLS (register item 47 unit 6). Each is
    // wired defensively, the way the display options and the naming block's
    // controls are: the markup ships them, but a missing control must warn
    // rather than throw and take the rest of the wiring with it.
    const reviewSuggestionsBox = el("transcribe-review-show-suggestions");
    if (reviewSuggestionsBox) {
      reviewSuggestionsBox.addEventListener(
        "change",
        handleShowSuggestionsChange,
      );
    } else {
      logWarn(
        "the Show suggestions checkbox is missing — suggestions cannot be shown or hidden",
      );
    }

    const reviewReasonsBox = el("transcribe-review-show-reasons");
    if (reviewReasonsBox) {
      reviewReasonsBox.addEventListener("change", handleShowReasonsChange);
    } else {
      logWarn(
        "the Show reasons checkbox is missing — a suggestion's reason cannot be hidden",
      );
    }

    const reviewConflictsBox = el(CONFLICT_TOGGLE_ID);
    if (reviewConflictsBox) {
      reviewConflictsBox.addEventListener("change", handleShowConflictsChange);
    } else {
      logWarn(
        "the Show conflicts in the transcript checkbox is missing — conflicts can still be read in the table",
      );
    }

    const reviewNext = el("transcribe-review-next");
    if (reviewNext) {
      reviewNext.addEventListener("click", handleNextSuggestion);
    } else {
      logWarn(
        "the Next suggestion button is missing — suggestions can still be reached by reading the transcript",
      );
    }

    // ONE DELEGATED LISTENER FOR EVERY "Go to phrase" BUTTON THE TABLE WILL
    // EVER CARRY (register item 47 unit 14), matching how the transcript's own
    // per-row controls are dispatched. The wrapper persists across every
    // refresh; the buttons inside it do not, so wiring them individually would
    // leak a listener per rebuild and lose one on every hide.
    const conflictTable = el(CONFLICT_TABLE_ID);
    if (conflictTable) {
      conflictTable.addEventListener("click", handleConflictTableClick);
    } else {
      logWarn(
        "the conflicts table is missing — a conflict can still be reached by reading the transcript with Show conflicts in the transcript ticked",
      );
    }

    // THREE delegated listeners for every ROW control there will ever be —
    // since register item 47 unit 10 that is the edit boxes, the selection
    // checkboxes, AND the Accept/Dismiss buttons, up to 1,971 controls on the
    // committed fixture. The host persists across renders and patches; the
    // controls do not. See handleTranscriptChange for why none of the three
    // is wired per control.
    //
    // `change` is the blur commit and the selection toggle; `keydown` is
    // Enter and Escape; `click` is Accept and Dismiss (handleTranscriptClick).
    // Three separate listeners rather than one because they answer different
    // questions about different events — a button fires neither `change` nor
    // a commit-relevant `keydown` for a plain activation — and both edit
    // gestures still reach the SAME commit function; see commitControl.
    el("transcribe-transcript").addEventListener(
      "change",
      handleTranscriptChange,
    );
    el("transcribe-transcript").addEventListener(
      "keydown",
      handleTranscriptKeydown,
    );
    el("transcribe-transcript").addEventListener(
      "click",
      handleTranscriptClick,
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
    // The review block joins the resting state on the same terms. Nothing has
    // loaded a change set — this runs once per session — so the call is the
    // reveal alone, which hides the block and writes the zero-state sentence
    // over the one the markup ships. `setText` is write-if-changed, so that
    // write is a no-op and the two are proved to agree rather than assumed to.
    setReviewVisible();
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
    // THE REVIEW BLOCK'S ENTRY POINT (register item 47 unit 6). Public because
    // loading a change set happens outside this file — the shipped route
    // belongs to the Captions Fixer lane and does not exist yet, so today the
    // callers are the fixture loader and the tree gate. Without it a loader
    // would have to reach into this module's internals or set a property on the
    // page, and the gate's whole contract is that it drives the shipped surface
    // rather than simulating it.
    refreshReview: refreshReview,
    // A TEST SEAM, AND NAMED AS ONE. The three below are exposed so the harness
    // can assert this block's decisions without a page: two of them are pure,
    // and the third reads the live state and is the one place the cross-lane
    // `speakerLabel` resolution happens. Nothing in the shipped page calls any
    // of them from outside this module.
    reviewCountSentence: reviewCountSentence,
    nextProposedIndexFrom: nextProposedIndexFrom,
    suggestionResolutionAt: suggestionResolutionAt,
  };
})();

// tools.html's inline TOOL_CONFIG must reach init and cleanup, and an inline
// script cannot see this file's top-level const binding — a top-level const is
// a global BINDING, not a window property. This alias is therefore required,
// not optional. AGENTS.md records the general trap: window.a11y and friends are
// referenced across this codebase and never assigned, leaving ten dead call
// sites that logged and looked correct.
window.OpenRouterEmbedTranscribeUI = OpenRouterEmbedTranscribeUI;
