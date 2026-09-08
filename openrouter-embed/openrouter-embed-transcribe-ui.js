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
   * bar itself, and the speaker-label caveat. The last two are the per-control
   * wrappers inside #transcribe-display-options (item 54): the reveal helper
   * writes `hidden` on each, and tolerates either being missing, because a
   * transcript still renders and downloads with no display options at all.
   * NEITHER CHECKBOX IS HERE, and none of these joins REQUIRED_IDS: the two
   * checkboxes are looked up at wiring time in init(), where a missing one is
   * logged and the tool carries on with that control's default.
   */
  const STRUCTURAL_IDS = Object.freeze([
    "transcribe-results-heading",
    "transcribe-progress-indicator",
    "transcribe-note",
    "transcribe-speaker-option",
    "transcribe-timestamps-option",
  ]);

  // ==========================================================================
  // SPOKEN AND WRITTEN TEXT
  // ==========================================================================

  const PROGRESS_TEXT = "Transcribing audio…";
  const START_SENTENCE = "Transcribing audio. This may take a minute.";
  const COPIED_SENTENCE = "Transcript copied to clipboard.";
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
   * this order and no other: <time>, a " " text node, the speaker <span>, a
   * " " text node, the text <span>. The first pair is present only when
   * `timestamps` is true; the second pair only when `speakerLabel` is a
   * number. So a row reads, in the accessibility tree and on screen alike:
   *
   *   [0:16] Speaker 1: phrase      both on
   *   Speaker 1: phrase             timestamps off
   *   [0:16] phrase                 no label wanted for this row
   *   phrase                        neither
   *
   * The omitted pair is NOT in the DOM — no class, no display rule — so the
   * accessibility tree carries neither the element nor the space that
   * followed it. That is the mechanism register item 54 chose, measured as
   * the `8e646912e2c10d537562a1fb` tree with the first InlineTextBox reading
   * "Speaker 1:"; a display rule leaves a different tree and was rejected.
   *
   * BOTH decisions arrive here already taken. `speakerLabel` is the shared
   * resolver's verdict and `timestamps` is hoisted once by renderTranscript;
   * this function reads neither module variable, so there is exactly one
   * place per decision that can be wrong.
   *
   * @param {object} phrase - a normalised phrase
   * @param {number} index - its position, for the stable id
   * @param {number|null} speakerLabel - the resolver's verdict, already taken
   * @param {{timestamps: boolean}} options - display decisions, already taken
   * @returns {HTMLLIElement}
   */
  function buildRow(phrase, index, speakerLabel, { timestamps }) {
    const row = document.createElement("li");
    row.id = ROW_ID_STEM + index;
    row.className = CLASS_ROW;

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
    if (speakerLabel !== null && typeof speakerLabel === "number") {
      const speaker = document.createElement("span");
      speaker.className = CLASS_SPEAKER;
      speaker.appendChild(document.createTextNode(`Speaker ${speakerLabel}:`));
      row.appendChild(speaker);
      row.appendChild(document.createTextNode(" "));
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
        buildRow(phrase, index, speakerLabel, { timestamps }),
      );
    });
    list.appendChild(fragment);

    host.replaceChildren(list);
    logInfo(`rendered ${phrases.length} phrase rows (mode: ${mode})`);
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

  async function handleCopy() {
    const api = moduleOrNull();
    const transcript = currentResult();
    if (!transcript || !api) return;

    try {
      await navigator.clipboard.writeText(api.toPlainText(transcript));
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
      api.toPlainText(transcript),
      downloadName(".txt"),
      "text/plain;charset=utf-8",
    );
  }

  function handleDownloadSrt() {
    const api = moduleOrNull();
    const transcript = currentResult();
    if (!transcript || !api) return;
    downloadText(
      api.toSrt(transcript),
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
   * EARLY, so handlePostSwitchFocus never runs and focus is not moved to the
   * tool's heading. A false here therefore costs the user the focus move as well
   * as producing an error, which is why the structural ids below do NOT return
   * one — a missing caveat paragraph must not cost somebody their place on the
   * page. The Image Describer entry in TOOL_CONFIG is not the model to copy on
   * this point: its catch logs and then returns true regardless, so its failure
   * path can never be reached.
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

    // Resting state: nothing to copy or download yet, and no transcript for the
    // display options to act on.
    setResultActionsEnabled(false);
    setDisplayOptionsVisible({
      hasTranscript: false,
      labelsAreInformative: false,
    });
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
