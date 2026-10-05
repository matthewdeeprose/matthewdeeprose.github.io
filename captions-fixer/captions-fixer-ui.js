/**
 * CAPTIONS FIXER — THE CONTROLLER (Stage 8, iteration 3; amended at Stages 8b,
 * 8c and 15). The first line read "amended at Stage 8b" until Stage 15 and had
 * been wrong since 8c, which amended this file without amending the sentence
 * that says what has amended it.
 *
 * EVERY DOM WRITE AND EVERY SPOKEN LINE IN THIS TOOL IS HERE. The seven
 * modules below it — cues, chunker, guards, adapter, store, the recurring
 * stage, the orchestrator — are pure: no DOM, no voice, no live region. This
 * file is the only place that knows a person exists.
 *
 *   CaptionsFixerUI.init()     bind, resolve the embed, restore nothing
 *   CaptionsFixerUI.cleanup()  cancel a run and release a waiting approval
 *
 * =========================================================================
 * THE FOUR SPOKEN LINES, AND WHY THERE ARE FOUR
 * =========================================================================
 *
 * One line per event, every one through `notify*()` from
 * js/universal-notifications.js, resolved on `window` at CALL time and never
 * cached. Both toast systems announce through the shared announcer, so a
 * `notify*()` IS the announcement — there is no `announce()` call anywhere in
 * this file, and adding one beside a `notify*()` would speak the message twice
 * (AGENTS.md § Announcements names that the single commonest defect).
 *
 *   file parsed        notifySuccess   "657 captions loaded from lecture.srt"
 *   pairs found        notifySuccess   "Found 26 possible corrections…"
 *   changes ready      notifySuccess   "182 changes ready, in the table that…"
 *   file downloaded    notifySuccess   "Corrected captions downloaded: 182…"
 *   run cancelled      notifyWarning   "Run cancelled"
 *   run failed         notifyError     "Run failed: <reason>"
 *   captions copied    notifySuccess   "Corrected captions copied…"
 *
 * A SUCCESSFUL DROP-RUN-APPROVE-DOWNLOAD JOURNEY SPEAKS EXACTLY FOUR: parsed,
 * pairs found, changes ready, downloaded. The cancel and failure lines are
 * alternatives to the second, and copy is an alternative to the fourth.
 *
 * APPLY SPEAKS ONCE PER PRESS, AND SINCE STAGE 8c IT CAN BE PRESSED AGAIN.
 * A journey still speaks FOUR lines, because a journey presses Apply once. A
 * person who ticks a different set and presses Apply again gets exactly one
 * more line — the same event, happening a second time, so the one-line-per-
 * event rule is satisfied rather than bent. When nothing is ticked the line is
 * NOTHING_TICKED_TEXT instead, and the table is emptied to match it: a spoken
 * line saying the table is empty beside a table that is not would be worse
 * than silence.
 *
 * THE "CHANGES READY" LINE IS AN ADDITION TO THE DISPATCH AND IS FLAGGED AS
 * ONE. The Stage 8 dispatch lists four EVENTS (parsed, run finished,
 * cancelled/failed, downloaded), of which a successful journey fires three —
 * and then asks for a journey that speaks four. The gap is the Apply gesture:
 * ticking pairs and pressing Apply builds a whole table of new content, and
 * without a line a screen-reader user is told nothing at all about it while a
 * sighted user watches it appear. One line for one gesture is the rule, so the
 * gesture gets one. It is inside the at-most-two-polite-lines-per-run pin
 * (announcement-placement-contract.md rule C1): the run's two lines are the
 * discovery outcome and the expansion outcome, and there is no start line.
 * THE LISTEN OF 8 SEPTEMBER 2026 SETTLED IT: four lines, each exactly once,
 * and the line stays. Its wording changed at Stage 8b to Matthew's own.
 *
 * STAGE 15 ADDS NO SPOKEN LINE, AND THE COUNT IS STILL FOUR. The one-reply
 * group is a second `<details>` beside the held group, found by a person who
 * goes looking, exactly as the held group is; the "pairs found" line counts the
 * ONE MERGED LIST, so it already covers every pair in all three containers and
 * saying the split out loud would be a fifth line nobody asked for. The
 * glossary field speaks nothing either — it is read at Run, not announced.
 *
 * STAGE 10 ADDS UP TO ONE SPOKEN LINE PER CONTEXT UPLOAD, OUTSIDE THE FOUR,
 * because choosing a slide deck or module text is its own event and not a
 * step in the drop-run-approve-download journey — a journey that never
 * touches this input still speaks exactly four. One line per upload, never
 * two: terms found, `notifySuccess`, `composeContextLine` (captions-fixer-
 * context.js); nothing found, `notifyInfo`, `composeContextEmptyLine`; the
 * file could not be read, `notifyError`, `composeContextErrorLine`. All
 * three live beside `composeContextLine` in the context module, not here,
 * because decision 8 places that composer there and these are its siblings.
 *
 * =========================================================================
 * FOCUS IS MOVED IN THIS FILE, AND MOVING IT IS NOT ANNOUNCING
 * =========================================================================
 *
 * Stage 8b adds one focus sequence, in `setRunning`, and it is a REPAIR:
 * without it, pressing Find corrections disables the very control the person
 * is standing on, and NVDA says "unavailable". Focus lands only on a button
 * that is visible and enabled at the moment it lands, and only when the
 * control being taken away is the one that currently holds focus — so nobody
 * who is somewhere else in the page is dragged here.
 *
 * None of that is an announcement and none of it goes near `notify*()`. A
 * focus move DOES make a reader speak the control's own name, which is why
 * focus never lands on a heading or a region in this tool: the four spoken
 * lines stay four.
 *
 * PROGRESS IS VISUAL ONLY. #captions-fixer-progress carries no role and no
 * aria-live, and nothing here gives it one. A run writes into it several times
 * and none of that is heard, which is the whole reason it exists as a separate
 * element from the spoken lines.
 *
 * THIS TOOL CREATES NO LIVE REGION, EVER. The one element in its markup
 * carrying an aria-live attribute is the embed sink, which carries
 * `aria-live="off"` — the silencer, not a region. A live region created
 * milliseconds before its content is not registered in time and does not
 * speak, measured three separate ways in this codebase; announcing through the
 * long-lived shared announcer is the only arrangement that works.
 *
 * =========================================================================
 * WHAT IT DOES NOT DO
 * =========================================================================
 *
 * It never calls `discover` or `expand` directly — the orchestrator owns the
 * run, guards every entry and writes after every stage, and reaching past it
 * would be a second path with none of that. It never writes cue text either:
 * `applyChangeSet` in captions-fixer-cues.js is the only writer, and it
 * refuses an entry whose `original` has drifted.
 *
 * A PLAIN script publishing window.CaptionsFixerUI. Every sibling module and
 * every global is resolved at CALL time, never at load: openrouter-embed-core.js
 * is a type="module" tag and therefore runs after every classic script, so a
 * load-time capture of window.OpenRouterEmbed reads undefined.
 *
 * @module CaptionsFixerUI
 * @since 7 September 2026
 */
const CaptionsFixerUI = (function () {
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[CaptionsFixerUI]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[CaptionsFixerUI]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[CaptionsFixerUI]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[CaptionsFixerUI]", message, ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  /**
   * Every element this controller addresses, by the key it is known by here.
   * `init` returns FALSE when any one of them is absent, which is what makes a
   * missing or renamed id a refusal to open the tool rather than a tool whose
   * controls silently do nothing.
   */
  const ELEMENT_IDS = Object.freeze({
    article: "captions-fixer-app",
    dropZone: "captions-fixer-drop-zone",
    fileInput: "captions-fixer-file-input",
    fileName: "captions-fixer-file-name",
    // Stage 10, decision 7. The second input, mirroring dropZone/fileInput/
    // fileName above; the label's own text and formats spans are not
    // addressed here, matching the captions input's own pattern.
    contextDropZone: "captions-fixer-context-drop-zone",
    contextInput: "captions-fixer-context-input",
    contextName: "captions-fixer-context-name",
    cost: "captions-fixer-cost",
    run: "captions-fixer-run",
    cancel: "captions-fixer-cancel",
    progress: "captions-fixer-progress",
    pairsSection: "captions-fixer-pairs-section",
    pairs: "captions-fixer-pairs",
    held: "captions-fixer-held",
    heldSummary: "captions-fixer-held-summary",
    heldList: "captions-fixer-held-list",
    // Stage 15, decision 8 and decision 9. The one-reply group's INTRO is
    // deliberately absent: this table is every element the controller
    // ADDRESSES, and the intro is static text nothing here rewrites. The hint
    // beside the glossary field is absent for the same reason.
    uncertain: "captions-fixer-uncertain",
    uncertainSummary: "captions-fixer-uncertain-summary",
    uncertainList: "captions-fixer-uncertain-list",
    glossary: "captions-fixer-glossary",
    apply: "captions-fixer-apply",
    // Stage 11, decision 9. The cue-level pass's own cost line and button,
    // authored at iteration 4 and inert until this file addressed them. They
    // sit OUTSIDE captions-fixer-pairs-section on purpose — see the markup's
    // own comment, and `passEnabled` below for what actually enables them.
    passCost: "captions-fixer-pass-cost",
    passRun: "captions-fixer-pass-run",
    changesSection: "captions-fixer-changes-section",
    // Stage 16, iteration 8c: where focus lands after a check (option 1).
    changesHeading: "captions-fixer-changes-heading",
    changesCaption: "captions-fixer-changes-caption",
    changesBody: "captions-fixer-changes-body",
    download: "captions-fixer-download",
    copy: "captions-fixer-copy",
    sink: "captions-fixer-embed-sink",
  });

  /** The sink the article authors. Must match ELEMENT_IDS.sink. */
  const SINK_ID = ELEMENT_IDS.sink;

  /** What the file input accepts, checked again here so a drop is validated too. */
  const ACCEPTED_EXTENSIONS = Object.freeze([".srt", ".vtt", ".txt"]);

  /** What the Stage 10 context input accepts, checked again for the same reason. */
  const CONTEXT_ACCEPTED_EXTENSIONS = Object.freeze([".pptx", ".pdf", ".txt", ".md"]);

  /** Added to the drop zone while a drag is over it. Declared in the tool's CSS. */
  const DRAG_ACTIVE_CLASS = "captions-fixer-drag-active";

  /** The site-wide visually-hidden class, read out of main.css:2073. */
  const VISUALLY_HIDDEN_CLASS = "visually-hidden";

  /** The tier `estimate()` reports that puts Run behind a confirmation. */
  const COST_TIER_RED = "red";

  /**
   * Decimal places on the estimated cost. THREE, not two: a discovery send on
   * an hour of lecture estimates near USD 0.02, and two places would round a
   * real difference between models to the same figure.
   */
  const COST_DECIMAL_PLACES = 3;

  /**
   * Each pass's name as a cost sentence says it — dm, decision 3 as amended
   * at iteration 4. KEYED BY THE ADAPTER'S OWN PASS NAMES
   * (CaptionsFixerLLM.PASSES: 'recurring', 'pass'), so the sentence and the
   * model resolver cannot disagree about which pass a figure is for.
   */
  const COST_PASS_WORDS = Object.freeze({
    recurring: "recurring pass",
    pass: "cue-level pass",
  });

  /**
   * The second sentence of both cost lines. One copy, because two lines a few
   * centimetres apart must make the same promise about the same uncertainty.
   */
  const COST_NOT_MEASURED =
    "This is an estimate — the provider does not report what a run actually used, so the real figure is not measured.";

  /**
   * The suffix the Foundry registry's factory puts on every display name
   * (js/foundry-model-definitions.js, `${displayName} (Foundry)`), and the
   * label ProviderSwitcher gives that provider (openrouter-embed/
   * provider-switcher.js). Read by `sentenceModelName` only — dm, decision 3
   * as amended at iteration 5.
   */
  const FOUNDRY_NAME_SUFFIX = " (Foundry)";
  const FOUNDRY_PROVIDER_LABEL = "Microsoft Foundry";

  /** The window event ProviderSwitcher dispatches on every switch. */
  const PROVIDER_CHANGED_EVENT = "provider:changed";

  /**
   * How long to wait after `safeConfirm` resolves before the first `notify*()`
   * of the run can fire.
   *
   * `window.safeConfirm` RESOLVES BEFORE ITS MODAL IS GONE — a contract fault
   * in js/universal-modal.js, recorded in AGENTS.md § Announcements and still
   * unrepaired. `close()` only sets a `closing` attribute; `finishClose` does
   * the real teardown 200ms later under `prefers-reduced-motion: no-preference`.
   * For that window `UniversalNotifications.show()` still reroutes into the
   * closing dialogue, where the message is wiped rather than heard.
   *
   * 350ms, the same value setup-tool.js's MODAL_CLOSE_ANNOUNCE_DELAY_MS uses
   * against the same 200ms teardown. IT IS COPIED FROM A WORKING WORKAROUND,
   * NOT MEASURED HERE, and it is only reached on the red-tier path — a run
   * whose estimate did not trip the confirmation never waits. When the
   * universal-modal contract is repaired (resolve AFTER finishClose), this
   * constant and its one caller go with setup-tool's.
   */
  const MODAL_CLOSE_SETTLE_MS = 350;

  /** Appended to the uploaded file's stem for the download. */
  const DOWNLOAD_SUFFIX = "-corrected";

  /** Download MIME types, by the format the meta records. */
  const MIME_BY_FORMAT = Object.freeze({
    srt: "application/x-subrip",
    vtt: "text/vtt",
  });

  /** The fallback when the meta names a format MIME_BY_FORMAT does not. */
  const MIME_FALLBACK = "text/plain";

  /**
   * The change-set statuses this file reads and writes.
   *
   * PROPOSED JOINED AT STAGE 11, decision 8, and it is the whole mechanism for
   * "a pass entry arrives unticked". `captions-fixer-cues.js:122` has carried
   * it since Stage 1 and `applyChangeSet` applies `accepted` only, so a
   * proposed entry is inert in every apply until a person ticks it — no new
   * field, no lock on the tick boxes, and nothing in the download path to
   * change. `renderChanges` already ticks on `status === ACCEPTED`, so a
   * proposed row renders unticked by construction rather than by a branch.
   */
  const STATUS = Object.freeze({
    PROPOSED: "proposed",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
    // pl, work item 5. A mirror of `CaptionsFixerCues.STATUS.CHECK`: a caption
    // the plausibility score flagged and nothing proposed a change to. It has
    // no replacement text, no Keep box, and only a person's Edit makes it an
    // accepted change.
    CHECK: "check",
  });

  /**
   * The sentence a check row's Now cell carries INSTEAD OF A REPLACEMENT — pl,
   * work item 5. Matthew's starting wording, refined at the listen. The Was
   * cell carries the caption as it stands, and nothing here says how likely
   * the caption is to be wrong: a 1-to-5 score means nothing to the person.
   */
  const CHECK_NOW_TEXT = "This caption may not read right. Listen to the recording and edit it if needed.";

  /**
   * What the pass line says in place of "Tick the ones you agree with." when
   * the pass proposed nothing to tick and left only captions to check — the
   * ordinary close would be false, and "Nothing was added to the table" worse.
   */
  const CHECK_ONLY_CLOSE = "Listen to the recording and edit the captions to check.";

  /** What this file writes into `rejectedBy` when a person unticks a row. */
  const REJECTED_BY_PERSON = "person";

  /**
   * Which half of a diff a cell renders.
   *
   * THE VISUALLY-HIDDEN "deleted "/"inserted " PREFIXES THAT USED TO SIT BESIDE
   * THIS CONSTANT ARE GONE — Stage 8b, decision 7. They were added on the
   * assumption that NVDA does not announce `del` and `ins`. IT DOES: Matthew
   * heard "deleted" THREE TIMES before a single deleted word on 8 September
   * 2026, which is the reader's own announcement, the hidden span, and the
   * reader's closing announcement all landing on one word. The elements stay
   * and carry the meaning; nothing here writes text a person cannot see.
   */
  const DIFF_SIDE = Object.freeze({ WAS: "was", NOW: "now" });

  /**
   * THE VISIBLE BRACKETS AROUND A CHANGED RUN — the review table's decision 6.
   *
   * `del` and `ins` carry the meaning for a reader that announces the elements
   * and for anyone who can see the strikethrough. Neither of those reaches a
   * person reading a printed copy, a person whose reader is set not to announce
   * the elements, or anyone for whom a thin strikethrough is hard to see. The
   * brackets are PLAIN TEXT NODES rather than `::before`/`::after` content, so
   * they sit in the cell's own `textContent` and every reader gets them.
   *
   * Read through the exported object at render time so an inversion can empty
   * them without touching how a cell is built — the seam `PAIRS_START_TICKED`
   * already establishes in this file.
   */
  const DIFF_BRACKET_OPEN = "[";
  const DIFF_BRACKET_CLOSE = "]";

  /**
   * WHETHER A PAIR ARRIVES TICKED. False, and read through the exported object
   * at render time so an inversion can move it — Stage 8b, decision 1.
   *
   * On the clean synthetic fixture a real send proposed 23 corrections, of
   * which about seven were plausible recognition errors and the rest rewrites
   * of text that was already correct; one reversed the meaning of what was
   * said. A list of that composition must be opt-in. Ticked-by-default turns
   * "I read them all and agreed" and "I pressed Apply" into the same gesture.
   */
  const PAIRS_START_TICKED = false;

  /**
   * The checks, in the words a person can act on rather than the guard's own
   * identifier. Keyed by CaptionsFixerGuards.GUARD_NAMES, and every one of the
   * seven is present — a missing key would put a raw camel-case name in front
   * of somebody, so `plainGuardName` falls back to a neutral sentence instead.
   *
   * THE SEVENTH WORDING IS NOT THE ONE ITS DISPATCH TYPED, and the reason is
   * the surrounding six rather than a preference. Decision 3 of the tag and
   * break integrity dispatch asked for "it changes the caption's formatting
   * tags"; every entry here is a noun phrase naming what went wrong, read
   * inside `composePairTail` as ". held: numbers changed" or ". held: symbols
   * added", and a clause with its own pronoun subject does not sit in that
   * list. The dispatch's own instruction was to match the six if the grammar
   * disagreed, so `tagsPreserved` reads "formatting tags changed", which is
   * the shape of "speaker label changed" exactly.
   */
  const GUARD_PLAIN_NAMES = Object.freeze({
    cueIdKnown: "caption not found",
    speakerLabelUnchanged: "speaker label changed",
    digitsUnchanged: "numbers changed",
    numberWordsUnchanged: "number words changed",
    noSymbolsIntroduced: "symbols added",
    lengthWithinBound: "much longer than the caption",
    tagsPreserved: "formatting tags changed",
  });

  /** What `plainGuardName` says when it does not recognise the guard. */
  const GUARD_PLAIN_FALLBACK = "a check held it back";

  /** The label endings decision 2 and decision 3 name, quoted from the dispatch. */
  const PAIR_NOT_FOUND_TEXT = "not found in the file";
  const HELD_LABEL_PREFIX = "held: ";

  /** The held group's summary, before its count is appended. */
  const HELD_SUMMARY_BASE = "Held back by the checks";

  /**
   * The one-reply group's summary, after its MEASURED count — Stage 15,
   * decision 8. A tail rather than a template because this count opens the
   * sentence ("3 corrections only one of the two runs proposed") where the held
   * group's closes it ("Held back by the checks (3)"). The two groups read
   * differently on purpose: the held one names a rule that fired, this one
   * names how many replies agreed.
   */
  const UNCERTAIN_SUMMARY_TAIL = " only one of the two runs proposed";

  /**
   * What `isOneReply` compares against when the recurring stage is not on the
   * page — Stage 15, decision 8.
   *
   * IT IS A FALLBACK AND NOT THE SOURCE. The value is normally read off that
   * module's own frozen `AGREEMENT` enum at call time, so the UI cannot drift
   * from the file that writes the field. This literal is reached only where
   * `init` has already refused to open the tool, and exists so a stray render
   * in a suite cannot throw. A row pins it equal to the export, because a
   * second copy of a string is exactly the thing that comes apart quietly.
   */
  const AGREEMENT_ONE_FALLBACK = "one";

  /**
   * How a send count is SPELLED in the cost sentences — Stage 15, decision 7.
   *
   * The number itself always comes from the estimate object (`estimate.sends`),
   * never from a literal here, so the sentence and the figure cannot describe
   * different numbers of sends. This table decides spelling only, and anything
   * it does not carry falls back to the digit rather than to a wrong word.
   */
  const SENDS_IN_WORDS = Object.freeze({ 1: "one", 2: "two", 3: "three", 4: "four" });

  /**
   * THE APPLIED SUFFIX — Stage 8c, decision 2.
   *
   * Matthew pressed Apply on 9 September 2026 and the pair list said nothing:
   * the ticked boxes stayed ticked, the button stayed live, and the only sign
   * anything had happened was a table further down the page. A sighted person
   * sees the table appear; a screen-reader user Tabbing back through the list
   * hears the same label they heard before.
   *
   * It is written INSIDE the `<label>`, in its own span, so a reader voices it
   * with the checkbox rather than as loose text somewhere near it. Nothing here
   * is a live region and nothing here is spoken at the moment it is written —
   * the suffix is found by the person who goes looking, which is what the
   * gesture "Tab back to the list" is.
   */
  const PAIR_APPLIED_PREFIX = "applied: ";

  /** The applied span's class, which is also how `updateAppliedLabels` finds it. */
  const PAIR_APPLIED_CLASS = "captions-fixer-pair-applied";

  /**
   * What Apply says when nothing at all is ticked — Stage 8c, decision 3,
   * quoted from the dispatch.
   *
   * IT IS NOW REACHED ONLY WHEN THE TABLE IS GENUINELY EMPTY — Stage 11b,
   * decision 1. It used to fire on the ticked count alone, which is how it
   * came to say "the table is empty" beside a table holding the pass's rows;
   * heard on the page at the Stage 11 listen, S7.
   */
  const NOTHING_TICKED_TEXT = "No corrections ticked; the table is empty.";

  /**
   * The `source` a cue-level pass entry carries — Stage 11b, decision 2.
   *
   * A COPY, PINNED BY A ROW RATHER THAN READ AT CALL TIME, AND THE REASON IS
   * THE RESTORE PATH. `CaptionsFixerStageLlmPass.SOURCE` is the original, and
   * reading it live would be the usual rule here — but `passChangeSet` is
   * restored from the store on a page where that module may never be asked for
   * anything, and a row whose provenance depends on a module being present is
   * a row that loses its name when it is not. The suite pins the two together,
   * so a change to either side reddens rather than drifting.
   */
  const PASS_SOURCE = "llm-pass";

  /**
   * What a PASS row's tick box is called — Stage 11b, decision 2.
   *
   * "Keep the suggested change to caption 20", where a recurring row keeps
   * "Keep the change to caption 20" UNCHANGED. Both halves matter: at the
   * Stage 11 listen NVDA read rows 2 and 73 with the identical name, because
   * the label was built from the caption number alone and both sets can land
   * on one caption. One word tells them apart, and it also says at the row
   * where the decision is taken which set proposed it — the listen's finding
   * 1, closed by the same word.
   *
   * THE RECURRING NAME IS NOT TOUCHED, which is what keeps every existing row
   * green: a pass-free journey renders exactly the names it always did. The
   * handover's longer fallback, "…, suggested by the caption-by-caption
   * check", is deliberately NOT built — decision 2 says to reach for it only
   * if one word proves too little, and that is a listen's finding to make.
   */
  const KEEP_LABEL_PREFIX = "Keep the change to caption ";
  const KEEP_LABEL_PASS_PREFIX = "Keep the suggested change to caption ";

  /**
   * STAGE 16, DECISION 8 — what a held row's tick box adds to its own name.
   *
   * A SUFFIX RATHER THAN A PREFIX, so the caption number is still the second
   * thing a person hears and every row in the column starts the same way. The
   * row is not disabled and the box is not ticked: a person keeps the right to
   * overrule a check, and the name is what tells them there is something to
   * overrule.
   */
  const KEEP_LABEL_HELD_SUFFIX = ", held by a check";

  /**
   * STAGE 16, DECISION 8 AND DECISION C — the Reason cell for a held row.
   *
   * `Held: <plain words>. <the model's own reason>`. The plain words come from
   * `plainGuardName`, which has existed since Stage 8b with one caller; this is
   * the second, and it is the one a person reads. The model's reason is kept
   * rather than replaced, because the two say different things: the check says
   * why it was held, the model says why it was proposed.
   */
  const HELD_REASON_PREFIX = "Held: ";
  const SENTENCE_STOP = ".";
  const HELD_REASON_JOIN = SENTENCE_STOP + " ";

  /**
   * STAGE 16, DECISION 7 — the Start column's format.
   *
   * `formatTimestamp` always appends `<sep>mmm` and decision 7 asks for
   * `hh:mm:ss` alone, so the column SLICES the last four characters off the
   * formatted string — the separator and three digits. Sliced from the END
   * rather than truncated at eight, because the helper does not clamp hours:
   * a three-digit hour would make a fixed length wrong and a negative slice
   * right. The alternative, an option on the helper, would change a function
   * four other call sites depend on for one column's benefit.
   *
   * THE SEPARATOR IS "." AND IT IS INVISIBLE IN THE OUTPUT, which is the point
   * of naming it here: the slice removes it, so the choice can never show on
   * screen and a reader would otherwise have no way to know one was made.
   */
  const START_SEPARATOR = ".";
  const START_MS_SUFFIX_LENGTH = 4;

  /**
   * STAGE 16, DECISION 1 — THE EDIT BUTTON.
   *
   * The visible word is "Edit" and the accessible name is "Edit the change to
   * caption N", or "Edit the suggested change to caption N" for a pass row. The
   * tail is a VISUALLY-HIDDEN span rather than an `aria-label`, which is this
   * file's own precedent for the Keep boxes: an `aria-label` cannot be copied
   * or selected, may not translate, and replaces the visible text rather than
   * extending it. SC 2.5.3 is satisfied by construction — the accessible name
   * begins with the visible word.
   *
   * THE TWO TAILS ARE THE STAGE 11 LISTEN'S FINDING 1 REACHING A SECOND
   * CONTROL, and the dispatch's literal wording is widened for that reason. It
   * asks for "Edit the change to caption N" for every row. Caption 51 is in
   * BOTH change sets on this stage's own fixture, so one caption carries two
   * rows — and a single tail would have given their two Edit buttons the
   * IDENTICAL accessible name, which is exactly the defect the Keep label was
   * repaired for at Stage 11b decision 2. One word tells them apart, and it is
   * the same word.
   */
  const EDIT_BUTTON_TEXT = "Edit";
  const EDIT_LABEL_TAIL = " the change to caption ";
  const EDIT_LABEL_PASS_TAIL = " the suggested change to caption ";
  /**
   * A CHECK ROW'S EDIT TAIL — pl, work item 5b. "Edit caption N, a caption to
   * check." There is no change on a check row, so the pass pattern ("the
   * suggested change") and its first wording ("the check change") both read
   * oddly; this names the caption and says why the row is there. A check row
   * has no Keep box, so this is the only name it carries; once a person edits
   * it the entry is an accepted pass entry and takes the pass tail above like
   * any edited row.
   */
  const EDIT_LABEL_CHECK_TAIL = " caption ";
  const EDIT_LABEL_CHECK_SUFFIX = ", a caption to check.";
  /**
   * The Keep cell's text on a check row — pl, work item 5b. The cell holds no
   * control, and an empty cell would have the stacked narrow layout print the
   * "Keep" data-label over nothing.
   */
  const KEEP_CELL_CHECK_TEXT = "Nothing to keep.";
  /**
   * What the hidden tail BEGINS WITH in the markup — a NON-BREAKING SPACE,
   * U+00A0 — iteration 8b, owed finding 1 of the 23 September 2026 listen.
   *
   * Matthew heard "Editthe suggested change to caption 3" four times (NVDA
   * 2026.1, Chrome 152). The two tails above open with an ordinary space, and
   * in the button that space sits at the start of the visually-hidden span,
   * which is `position: absolute` (main.css:2112) — the start of a box, where
   * a collapsible space is dropped from the rendered text. A browser that
   * builds the accessible name from the rendered text then loses it. That is
   * the likely mechanism and it was not isolated: the headless build this
   * lane drives (chromium-1223) computed the name WITH the space before this
   * change, so the tree reading here cannot reproduce the listen. What the
   * change does is remove the dependency: U+00A0 is not collapsible under any
   * whitespace rule, so the name carries a space whichever text it is built
   * from. The tails keep their ordinary space — `editLabelText` and its rows
   * read it — and the swap happens at the one place the markup is built.
   *
   * Read through `api` at call time so an inversion can put the ordinary
   * space back, which is the previous implementation restored.
   */
  const EDIT_TAIL_LEAD = " ";
  /** The ordinary space(s) a tail opens with, replaced by EDIT_TAIL_LEAD in the markup. */
  const EDIT_TAIL_LEADING_SPACES = /^ +/;

  /**
   * The icon, from the shared library, resolved AT CALL TIME.
   *
   * `icon-library.js` is at tools.html:26652 and this file is at :22452, so the
   * library loads 4,200 lines LATER — the same load-order trap as the modal
   * below, and the reason `window.getIcon` is never captured at module scope. A
   * missing library leaves an empty decorative span and the visible word still
   * names the button.
   *
   * `data-icon` is set as well as the markup: a row created here is NOT reached
   * by the library's own auto-populator, which runs once at DOMContentLoaded,
   * so the markup is written now — and the attribute keeps a later
   * `populateIcons()` idempotent rather than blank.
   */
  const EDIT_ICON_NAME = "pencil";

  /** One id per row, so `returnFocusTo` can be declared as a bare id string. */
  const EDIT_BUTTON_ID_PREFIX = "captions-fixer-edit-";

  /**
   * STAGE 16, DECISION 1 — THE DIALOG.
   *
   * `action: "save"` and NEVER "confirm": "confirm" is reserved by the footer,
   * which resolves the value of the `prompt` template's own `#<modalId>-input`
   * instead of the button and would hijack the result (universal-modal.js
   * :937-941, read at iteration 0).
   */
  const EDIT_ACTION_SAVE = "save";
  const EDIT_ACTION_CANCEL = "cancel";
  const EDIT_SAVE_TEXT = "Save";
  const EDIT_CANCEL_TEXT = "Cancel";
  const EDIT_SAVE_TYPE = "primary";
  const EDIT_CANCEL_TYPE = "secondary";
  const EDIT_TITLE_PREFIX = "Edit caption ";

  /**
   * The dialog's own words. Was first, then the field, because the dispatch
   * asks for the old reading ABOVE the box a person types in — they are
   * comparing, and the thing being compared against has to be there first.
   */
  const EDIT_WAS_LABEL = "The caption as it is now";
  const EDIT_FIELD_LABEL = "The caption as it will read";
  const EDIT_HINT_TEXT =
    "A caption cannot be left empty. Your line breaks are kept exactly as you type them.";
  const EDIT_TEXTAREA_ID = "captions-fixer-edit-text";
  const EDIT_HINT_ID = "captions-fixer-edit-hint";
  /**
   * The Was paragraph's id — iteration 8b, owed finding 5 of the 23 September
   * 2026 listen. With the keyboard alone a person editing a caption never
   * heard the caption as it is now: the Was paragraph is on no Tab stop, and
   * the text box read only its last line. The paragraph now carries this id
   * and the textarea is described by it FIRST, then by the hint, through
   * `editDescribedBy` — so the old caption is read on arrival, before the
   * empty rule. Nothing else about the dialog moves.
   */
  const EDIT_WAS_ID = "captions-fixer-edit-was";
  /** The separator between the ids in an `aria-describedby` list. */
  const DESCRIBED_BY_SEPARATOR = " ";

  /**
   * `white-space` for the Was paragraph, set INLINE and that is a declared
   * departure rather than an oversight.
   *
   * The declaration belongs in captions-fixer.css beside the one iteration 1
   * added for the two table cells, and this iteration ships one file. Without
   * it the dialog's Was paragraph collapses a caption's own line break to a
   * space while the table cell beside it renders two lines and the textarea
   * below it holds two lines — three surfaces disagreeing about one caption.
   * It is not colour, so no theme is touched; it is one property, on one
   * paragraph, and it moves to the stylesheet the next time that file is open.
   */
  const EDIT_PRESERVE_BREAKS = "pre-line";

  /** Rows for the textarea: the caption's own lines, one spare, never under two. */
  const EDIT_TEXTAREA_MIN_ROWS = 2;
  const EDIT_TEXTAREA_EXTRA_ROWS = 1;

  /**
   * STAGE 16, DECISION E — THE HUNK LIST'S OWN WORDS AND ITS ONE THRESHOLD.
   *
   * A HUNK IS A MAXIMAL RUN OF ADJACENT CHANGED TOKENS in
   * `Diff.diffWords(original, proposed)`. An insertion, a deletion and a
   * substitution are each ONE hunk — a substitution emits two adjacent tokens,
   * removed then added, and they belong to the same change rather than to two.
   *
   * THE HINT SAYS WHAT A TOGGLE COSTS, BEFORE IT COSTS IT. Rebuilding the
   * textarea throws away anything typed into it by hand, and a person who has
   * just lost a sentence they wrote is owed the warning in advance rather than
   * an apology afterwards. This is the same reasoning as the empty-text hint
   * above it, which iteration 5 put up front for want of any way to refuse a
   * Save once the footer has been pressed.
   */
  const HUNK_LEGEND_TEXT = "Keep these changes";
  const HUNK_HINT_TEXT =
    "Every box starts ticked. Untick one to leave that phrase as it was. Changing a box rewrites the box below, so anything you have typed there by hand is lost.";
  const HUNK_HINT_ID = "captions-fixer-edit-hunks-hint";
  const HUNK_BOX_ID_PREFIX = "captions-fixer-edit-hunk-";

  /**
   * The three label shapes, one per kind of hunk. A substitution names both
   * sides; an insertion and a deletion have only one side to name, and
   * `Keep '' to 'big'` would be a name with a hole in it.
   *
   * THE WORDS ARE TRIMMED FOR THE LABEL AND NEVER FOR THE REBUILD. `diffWords`
   * carries the space with a pure insertion — `"the cat sat"` to
   * `"the big cat sat"` emits `"big "` — so an untrimmed label reads
   * `Keep adding 'big '`, where the quote mark sits a space away from the word
   * it is quoting. The raw value with its whitespace is what
   * `rebuildFromHunks` emits, so nothing is lost: the trim reaches the name a
   * person hears and stops there. Same decision, for the same reason, as the
   * bracket hugging the word in `appendBracketedRun`.
   */
  const HUNK_LABEL_CHANGE_PREFIX = "Keep '";
  const HUNK_LABEL_CHANGE_MIDDLE = "' to '";
  const HUNK_LABEL_ADD_PREFIX = "Keep adding '";
  const HUNK_LABEL_REMOVE_PREFIX = "Keep removing '";
  const HUNK_LABEL_SUFFIX = "'";

  /**
   * THE LIST APPEARS AT TWO HUNKS AND NOT AT ONE — the dispatch's own
   * threshold. One hunk means the whole proposal is that one change, so a box
   * offering to keep it duplicates the Keep box already in the row and the
   * Cancel button already in the dialog.
   */
  const HUNK_LIST_MINIMUM = 2;

  /**
   * STAGE 16, DECISION D — HOW AN EDITED ENTRY IS MARKED.
   *
   * `source` carries it, as iteration 0 settled: `"llm-pass-edited"` and
   * `"recurring-edited"`. `status` stays `accepted` and `rejectedBy` stays
   * `null`, which is what keeps the Transcribe seam out of this stage — that
   * lane reads those two fields and neither gains a value.
   *
   * THE SUFFIX IS APPENDED RATHER THAN MAPPED, so a SECOND edit of the same row
   * cannot produce `"llm-pass-edited-edited"`, and so a source this file has
   * never heard of still ends up honestly marked rather than silently renamed.
   */
  const EDITED_SOURCE_SUFFIX = "-edited";
  const KEEP_LABEL_EDITED_SUFFIX = ", edited by you";

  /**
   * What became of a Save press. Read by the one caller that speaks, so the
   * decision of WHETHER to speak is separate from the decision of WHAT changed
   * — and `applyEdit` itself stays free of the announcer.
   */
  const EDIT_OUTCOME = Object.freeze({
    SAVED: "saved",
    UNCHANGED: "unchanged",
    REFUSED: "refused",
    DISMISSED: "dismissed",
  });

  /** Spoken only where the modal itself is unreachable. */
  const EDIT_NO_MODAL_TEXT = "The edit dialog could not be opened. Reload the page.";

  /**
   * The change table's column names, in column order, written onto every cell
   * as `data-label`. main.css's `.allyTable` rule prints them in front of each
   * value once the rows stack, which is what keeps Was and Now paired when the
   * table linearises. Must stay in step with the `<th>` order in tools.html;
   * the suite asserts the two are equal rather than trusting this comment.
   */
  const COLUMN_LABELS = Object.freeze([
    "Caption",
    "Start",
    "Was",
    "Now",
    "Reason",
    "Keep",
    "Edit",
  ]);

  /** Progress sentences. Visual only — none of these is ever spoken. */
  const PROGRESS = Object.freeze({
    IDLE: "",
    DISCOVERING: "Looking for words that were misheard more than once. This is one request and usually takes under a minute.",
    AWAITING: "Tick the corrections you agree with, then choose Apply ticked corrections.",
    EXPANDING: "Working out which captions change…",
    // Stage 11, decision 9. The line before the first chunk reports, so the
    // progress area is never blank between the press and the first callback.
    // Every line after it is composed per chunk by `composePassProgressLine`.
    CHECKING: "Checking the remaining captions…",
    CANCELLED: "Cancelled. Nothing was changed.",
  });

  // ==========================================================================
  // STATE
  // ==========================================================================

  /** @type {object|null} the resolved elements, or null before init */
  let elements = null;
  /** Listeners are bound once per page, not once per tool switch. */
  let bound = false;

  /** The parsed upload. Null until a file is read. */
  let cueList = null;
  let meta = null;
  let sourceName = "";
  let sha256 = "";

  /** The discovered pairs, and the change set the orchestrator settled. */
  let pairs = [];
  let changeSet = [];

  /**
   * The cue-level pass's OWN change set — Stage 11, decision 8.
   *
   * SEPARATE FROM `changeSet`, NOT APPENDED TO IT, and the reason is
   * `rebuildFromTicked`: a second Apply rebuilds the recurring set from the
   * ticked pairs and nothing else, so a pass entry living in that array would
   * be silently destroyed by a gesture that has nothing to do with it. Kept
   * apart, `rebuildFromTicked` can stay exactly the function it was and the
   * pass entries survive every re-tick.
   *
   * The two are joined only where a person sees them — the table renders the
   * recurring set then this one — and where the file is built, which applies
   * them in that same order in two steps.
   *
   * @type {Array<object>}
   */
  let passChangeSet = [];

  /**
   * WHETHER A DISCOVERY RUN HAS SETTLED — Stage 11, decision 9, and this
   * boolean IS the enabling rule rather than a cache of one.
   *
   * IT IS NOT `elements.pairsSection.hidden`, AND THAT IS A CORRECTION TO THE
   * DISPATCH rather than a preference. Decision 9 glosses the enabling moment
   * as "(the moment the pairs section is shown)" while its own main clause
   * says "whether or not pairs were found". Those cannot both hold:
   * `renderPairs` sets `pairsSection.hidden = list.length === 0`, so that
   * section stays hidden when discovery finds no recurring pairs — which is
   * exactly the transcript a cue-level pass is most useful for, a clean one
   * where every remaining error is a one-off. Reading the enabling state off a
   * DOM property that means something else is how a control ends up
   * unreachable on its own best case.
   *
   * SET WHERE `handleRun` SETTLES, and nowhere else. A cancelled run and a
   * failed run have not settled and do not set it. CLEARED by `resetForTests`
   * and by `loadText`, because a newly loaded file has had no run of its own —
   * leaving it true would offer to check captions against corrections that
   * belong to a different file.
   *
   * A RESUMED SESSION DOES NOT SET IT, and that is reported rather than
   * decided: `loadText` restores a change set from a run that did settle, on a
   * previous visit, so an argument exists for enabling there too. It is beyond
   * the rule as stated and no row covers it, so the rule is implemented as
   * written and the gap is in the iteration report.
   */
  let discoverySettled = false;

  /**
   * Which control started the run in flight — Stage 11, so `setRunning` can
   * give focus back to the button the person actually pressed.
   *
   * Decision 5's sequence returns focus to Run when Cancel had it. With two
   * buttons that would take a person who pressed "Check the remaining
   * captions" and drop them on "Find corrections", which is a relocation of
   * somebody's own focus rather than a repair of focus this file destroyed.
   *
   * @type {HTMLElement|null}
   */
  let runOrigin = null;

  /** The in-flight run. */
  let running = false;
  /** @type {AbortController|null} */
  let controller = null;
  /** The approval promise's resolver, held while a person reads the pair list. */
  let pendingApproval = null;

  /**
   * Which pairs the LAST Apply took, as indexes into `pairs` — Stage 8c.
   *
   * REMEMBERED, NOT DERIVED, and the alternative was tried on paper first. A
   * pair could be called applied when every caption it changes appears in the
   * change set, which needs no state at all — but two pairs touching the same
   * captions would then make an untaken pair read as applied, which is a false
   * statement about somebody's own decision. This is exact.
   *
   * IT IS NOT PERSISTED, so a resumed session shows the table it left and no
   * applied suffixes. The store record carries the change set, not who asked
   * for it, and adding a field to that record is outside this stage. Recorded
   * here rather than left for somebody to find.
   *
   * @type {Array<number>}
   */
  let appliedPairIndexes = [];

  // ==========================================================================
  // SMALL HELPERS
  // ==========================================================================

  /**
   * `n` with a noun that agrees with it. British spelling throughout the app,
   * so no irregular plural list is needed for the words used here.
   * @param {number} count
   * @param {string} noun
   * @returns {string}
   */
  function pluralise(count, noun) {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
  }

  /**
   * Resolve a notification function at CALL time.
   *
   * Never cached, and this is not caution: js/universal-notifications.js
   * publishes these on `window`, and a module-scope capture taken at load would
   * read whatever was there when this file ran. It also means a suite can wrap
   * `window.notifySuccess` and count what this tool says, which is how the
   * spoken-line count is measured.
   *
   * @param {string} name "notifySuccess" | "notifyWarning" | "notifyError"
   * @param {string} message
   */
  function speak(name, message) {
    const notify = window[name];
    if (typeof notify !== "function") {
      logWarn(`${name} is not available; "${message}" was not spoken`);
      return;
    }
    notify(message);
  }

  /** Write the visual-only progress line. Never spoken. @param {string} text */
  function setProgress(text) {
    if (elements && elements.progress) elements.progress.textContent = text;
  }

  /**
   * Remove every child of an element. `textContent = ""` would do it, but
   * `replaceChildren()` says what it means and does not go through the text
   * setter, whose identical-value case is a real childList mutation.
   * @param {Element} element
   */
  function empty(element) {
    if (element) element.replaceChildren();
  }

  /**
   * The plain-English name of the check that held an entry back.
   *
   * `rejectedBy` is `"guard:" + the guard's own name`; the prefix is read off
   * the guards module rather than spelled again here, so a change there cannot
   * leave this silently splitting on the wrong string.
   *
   * @param {string} rejectedBy
   * @returns {string}
   */
  /**
   * The store field the pass's entries are written under — Stage 11.
   *
   * READ OFF THE PASS MODULE, not spelled again here, for the same reason
   * `plainGuardName` reads the guards' own prefix: two copies of a field name
   * is two places for a rename to half-land, and the half that stays behind
   * writes a record nothing reads. The fallback exists only so a page where
   * the module failed to load still writes the recurring set rather than
   * throwing on the way to the store.
   *
   * @returns {string}
   */
  function passEntriesField() {
    const pass = window.CaptionsFixerStageLlmPass;
    return pass && pass.FIELD_PASS_ENTRIES ? pass.FIELD_PASS_ENTRIES : "passEntries";
  }

  /**
   * The record field this file writes when a discovery run settles — Stage 11,
   * iteration 7a. A literal here rather than read off the store, because the
   * store exports `RECORD_FIELDS` as a list and not a name per field, and a
   * lookup by index would be a second thing to keep true. The store refuses an
   * unknown name outright, so a drift reddens a row rather than writing
   * nothing quietly.
   */
  const FIELD_SETTLED_AT = "discoverySettledAt";

  /**
   * DID THE DISCOVERY RUN BEHIND THIS RECORD SETTLE? — Stage 11, iterations 5b
   * and 7b.
   *
   * The resume half of decision 9's enabling rule. `discoverySettled` tracks a
   * run in THIS visit, which is right for a visit and wrong for a reload: a
   * person who reopens their file gets their rows back and would otherwise
   * have to pay for discovery a second time to get the pass button back. This
   * reads the record instead.
   *
   * THE FIELD IS `discoverySettledAt`, WRITTEN BY THIS FILE AND BY NOTHING
   * ELSE, at the one point where `handleRun` settles. Iteration 5b tested a
   * NON-EMPTY `changeSet` instead, and that test was sound but narrow — the
   * reasoning is kept in `captions-fixer-store.js` beside the field, because
   * it is the argument for the field existing at all. In short: every other
   * name on the record is also written by a run that did NOT settle, and
   * `changeSet` in particular is written as `[]` by a cancel, because
   * `handleCancel` settles the approval rather than throwing and the stage
   * RETURNS, so `settleStage` still runs.
   *
   * WHAT 5b's TEST LEFT OUT, AND WHY THAT MATTERED: a run that settled having
   * found NO recurring pairs also leaves `changeSet: []`, so it was
   * indistinguishable from a cancel and did not get its button back. That is
   * the CLEAN TRANSCRIPT — the cue-level pass's best case, and the case
   * decision 9's own correction was written about. The marker closes it.
   *
   * `null` IS A REAL VALUE HERE and means "no settled run", which is what
   * Reset and a fresh load write. It is not the same as the field being
   * absent, and the store keeps the two apart.
   *
   * Exported so a row can bind it by inversion with no store and no run.
   *
   * @param {object|null} record
   * @returns {boolean}
   */
  function settledFromRecord(record) {
    if (!record) return false;
    return typeof record[FIELD_SETTLED_AT] === "string" && record[FIELD_SETTLED_AT].length > 0;
  }

  function plainGuardName(rejectedBy) {
    const guards = window.CaptionsFixerGuards;
    const prefix = guards && guards.REJECTED_BY_PREFIX ? guards.REJECTED_BY_PREFIX : "guard:";
    const raw = String(rejectedBy || "");
    const name = raw.indexOf(prefix) === 0 ? raw.slice(prefix.length) : raw;
    return GUARD_PLAIN_NAMES[name] || GUARD_PLAIN_FALLBACK;
  }

  /**
   * Does this filename look like something the parser will take?
   * Checked here as well as on the input's `accept`, because `accept` is a
   * picker hint and a DROPPED file has never been past it.
   * @param {string} name
   * @returns {boolean}
   */
  function hasAcceptedExtension(name) {
    const lower = String(name || "").toLowerCase();
    return ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
  }

  /**
   * The Stage 10 context input's own version of the check above.
   * @param {string} name
   * @returns {boolean}
   */
  function hasAcceptedContextExtension(name) {
    const lower = String(name || "").toLowerCase();
    return CONTEXT_ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
  }

  // ==========================================================================
  // SENTENCE COMPOSERS — pure, exported, and they read no state
  // ==========================================================================
  //
  // Every one is a pure function of its arguments and NONE of them reads
  // `this` or module state. That is deliberate and was learnt at parcel EA-5 in
  // the enhancer lane: a composer written as a prototype method reddened
  // fifteen existing rows the moment a drive called it against a plain-object
  // receiver. They are exported so an inversion can patch the ONE seam every
  // call site goes through — an unpatchable seam is an unprovable one.

  /**
   * @param {number} count captions parsed
   * @param {string} name the uploaded file's name
   * @param {boolean} restored whether a stored record came back with it
   * @returns {string}
   */
  function composeUploadLine(count, name, restored) {
    const base = `${pluralise(count, "caption")} loaded from ${name}`;
    return restored ? `${base}, and your earlier work restored.` : `${base}.`;
  }

  /** @param {number} count pairs the model proposed @returns {string} */
  function composePairsLine(count) {
    if (count === 0) return "No corrections found.";
    return `Found ${pluralise(count, "possible correction")}, ready to review.`;
  }

  /**
   * @param {number} count change-set entries
   * @returns {string}
   */
  function composeAppliedLine(count) {
    if (count === 0) return "No captions change with the corrections you ticked.";
    // MATTHEW'S WORDING, Stage 8b decision 4. It read "in the changes table
    // below" until then; "the table that follows" says the same thing without
    // asking a screen-reader user to reason about what "below" means.
    return `${pluralise(count, "change")} ready, in the table that follows.`;
  }

  /**
   * Everything an APPLIED pair's label carries after its tail — Stage 8c,
   * decision 2. An unapplied pair carries the empty string, which is why this
   * is never called with a count for a pair nobody took.
   *
   * @param {number} count rows this pair put in the table
   * @returns {string}
   */
  function composeAppliedSuffix(count) {
    return `. ${PAIR_APPLIED_PREFIX}${pluralise(count, "change")}`;
  }

  /**
   * What Apply says when nothing is ticked and the table is NOT empty —
   * Stage 11b, decision 1, quoted from the dispatch.
   *
   *     No corrections ticked. 2 suggested changes from the caption-by-caption
   *     check are still in the table.
   *
   * The verb agrees with the count, because a sentence a person hears reads
   * badly as "1 suggested change are still in the table" in a way the same
   * sentence on screen survives.
   *
   * @param {number} passCount entries the cue-level pass contributes
   * @returns {string}
   */
  function composeNothingTickedWithPassLine(passCount) {
    const verb = passCount === 1 ? "is" : "are";
    return `No corrections ticked. ${pluralise(passCount, "suggested change")} from the caption-by-caption check ${verb} still in the table.`;
  }

  /**
   * What Apply says when nothing is ticked, the table is NOT empty, and NONE
   * of it came from the cue-level pass.
   *
   * UNREACHABLE ON A CORRECT BUILD, AND WRITTEN ANYWAY — this is the
   * fail-closed branch, and an INVERSION is what found it rather than review.
   * Nothing ticked means `rebuildFromTicked` returns an empty recurring set, so
   * a non-empty table with nothing ticked is the pass's rows and only ever the
   * pass's rows. Under the `ui-reapply` inversion — where a second Apply
   * rebuilds nothing — that stops being true, and the sentence above it
   * announced "0 suggested changes from the caption-by-caption check" beside a
   * table holding 74 RECURRING rows. It blamed the pass for rows the pass had
   * not proposed, which is the Stage 11 defect wearing new clothes: a sentence
   * describing a table it has not looked at.
   *
   * @param {number} count entries the table still holds
   * @returns {string}
   */
  function composeNothingTickedWithRowsLine(count) {
    const verb = count === 1 ? "is" : "are";
    return `No corrections ticked. ${pluralise(count, "change")} ${verb} still in the table.`;
  }

  /**
   * What Apply says — Stage 8c, decision 3; third argument Stage 11b,
   * decision 1.
   *
   * TICKED COUNT, NOT CHANGE COUNT, decides which sentence. The two zeros mean
   * different things and a person can act on only one of them: nothing ticked
   * is something they can put right by ticking something, where nothing
   * changing is a fact about the file. Collapsing them into one sentence is how
   * the old zero branch came to say "the corrections you ticked" to somebody
   * who had ticked nothing.
   *
   * AND THE TICKED COUNT ALONE IS NOT ENOUGH, WHICH IS THE STAGE 11 DEFECT.
   * The empty-table sentence fired whenever nothing was ticked, including on a
   * page where the cue-level pass had filled the table with proposals nobody
   * had touched — so a person heard "the table is empty" with two rows on
   * screen. The zero branch now asks a second question, "empty of WHAT", and
   * the table is both sets.
   *
   * WITH NO PASS ENTRIES EVERY SENTENCE IS BYTE-IDENTICAL TO TODAY'S, and that
   * is load-bearing rather than tidy — the same bargain `composeChangesCaption`
   * makes in its own words a few hundred lines above. `otherCount` defaults to
   * zero, so `changeCount + otherCount` is `changeCount`, the zero branch is
   * the ticked-count branch it always was, and every existing row asserting
   * this sentence reads a journey with no pass in it. A row that DID move
   * would be reporting a real change in what a person is told.
   *
   * @param {number} changeCount entries the table now holds, BOTH sets
   * @param {number} tickedCount pairs ticked at this Apply
   * @param {number} [otherCount] how many of `changeCount` the OTHER set gave
   * @returns {string}
   */
  function composeApplyOutcomeLine(changeCount, tickedCount, otherCount) {
    const fromPass = typeof otherCount === "number" ? otherCount : 0;
    if (tickedCount === 0) {
      if (changeCount === 0) return NOTHING_TICKED_TEXT;
      // WHICH SET IS STILL THERE, not merely whether anything is. Naming the
      // pass for rows it did not propose is as wrong as calling a full table
      // empty, and one line of guard is what keeps the sentence honest about
      // both.
      if (fromPass > 0) return composeNothingTickedWithPassLine(fromPass);
      return composeNothingTickedWithRowsLine(changeCount);
    }
    return composeAppliedLine(changeCount);
  }

  /**
   * Everything in a pair's label after the measured count.
   *
   * Pure, and the two endings are the ones Stage 8b names verbatim: a pair the
   * file does not contain ends "not found in the file", and a pair every one of
   * whose captions a check held back ends "held: <the check, in plain words>".
   * THE TWO ARE MUTUALLY EXCLUSIVE BY CONSTRUCTION and not merely by
   * convention — a pair with no occurrences produces no entries, so there is
   * nothing for a check to hold.
   *
   * @param {string} reason the model's own reason, or empty
   * @param {number} occurrences the MEASURED count
   * @param {string|null} heldBy the plain name of the check, when all held
   * @returns {string}
   */
  function composePairTail(reason, occurrences, heldBy) {
    const tail = [];
    if (reason) tail.push(String(reason));
    if (occurrences === 0) tail.push(PAIR_NOT_FOUND_TEXT);
    else if (heldBy) tail.push(`${HELD_LABEL_PREFIX}${heldBy}`);
    return tail.length === 0 ? "" : `. ${tail.join(". ")}`;
  }

  /**
   * The held group's summary, carrying its own count.
   * @param {number} count pairs in the group
   * @returns {string}
   */
  function composeHeldSummary(count) {
    return `${HELD_SUMMARY_BASE} (${count})`;
  }

  /**
   * The one-reply group's summary, carrying its own MEASURED count — Stage 15,
   * decision 8.
   *
   * The count is the number of pairs this render put in the group, counted as
   * the rows were placed, never the length of anything the model reported.
   *
   * @param {number} count pairs in the group
   * @returns {string}
   */
  function composeUncertainSummary(count) {
    return `${pluralise(count, "correction")}${UNCERTAIN_SUMMARY_TAIL}`;
  }

  /**
   * "for two runs" — the clause both cost sentences carry since Stage 15,
   * decision 7.
   *
   * IT IS BUILT FROM THE ESTIMATE'S OWN `sends`, which is why it is a function
   * and not a constant. `CaptionsFixerLLM.estimate` returns `costUsd` and
   * `tier` describing the WHOLE pass and `sends` saying how many sends that
   * pass is, so a figure and a clause built from the same object cannot
   * disagree. A literal "two" here would be a second copy of a number that
   * lives in the recurring stage as SENDS_PER_PASS, and the day that constant
   * moved the sentence would quietly start lying about the money.
   *
   * An estimate carrying no `sends` is treated as one send, which is what
   * `estimate` itself does with a missing value.
   *
   * @param {number|undefined} sends
   * @returns {string}
   */
  function composeSendsClause(sends) {
    const count = typeof sends === "number" && isFinite(sends) && sends >= 1 ? Math.floor(sends) : 1;
    const word = SENDS_IN_WORDS[count] || String(count);
    return `for ${word} ${count === 1 ? "run" : "runs"}`;
  }

  /** @returns {string} */
  function composeCancelLine() {
    return "Run cancelled.";
  }

  /**
   * @param {Error|string} error
   * @returns {string}
   */
  function composeFailureLine(error) {
    const reason = error && error.message ? error.message : String(error || "unknown reason");
    return `Run failed: ${reason}`;
  }

  /** @param {number} applied @returns {string} */
  function composeDownloadLine(applied) {
    return `Corrected captions downloaded: ${pluralise(applied, "change")} applied.`;
  }

  /** @param {number} applied @returns {string} */
  function composeCopyLine(applied) {
    return `Corrected captions copied: ${pluralise(applied, "change")} applied.`;
  }

  /**
   * The cost line.
   *
   * THE FIGURE IS AN ESTIMATE AND THE SENTENCE SAYS SO, because on the
   * OpenRouter path there is no provider usage object at all: the transport at
   * js/openrouter-client/openrouter-client-stream.js builds a `usage` object
   * inside `finalResponseData` that reports
   * `prompt_tokens: 0` and `completion_tokens: characters / 4` under its own
   * comment calling it a rough estimation. No cost figure this tool can show is
   * a measurement, so none of them is presented as one.
   *
   * THE CURRENCY IS USD, as the model registry gives it. The `tier` beside it
   * comes from the embed's own `shouldWarnAboutCost`, whose thresholds are
   * labelled GBP — so the tier is the app's consistent behaviour rather than a
   * currency-correct judgement, and it is used only to decide whether to ask,
   * never shown as a number.
   *
   * IT SAYS HOW MANY RUNS THE FIGURE COVERS — Stage 15, decision 7. Since this
   * stage a pass asks the same model the same question twice and compares the
   * replies, so the estimate is for two sends. A person reading a doubled
   * figure with no explanation would reasonably think the price had gone up.
   *
   * @param {object|null} estimate `{ model, costUsd, tier, sends }` or null
   * @param {string} providerLabel a person-readable provider name
   * @returns {string}
   */
  function composeCostLine(estimate, providerLabel) {
    if (!estimate || typeof estimate.costUsd !== "number") {
      return "The cost of this run could not be estimated, because no model is available. Check your provider in Set Up.";
    }
    return api.composeEstimateSentence("recurring", estimate, composeSendsClause(estimate.sends), providerLabel);
  }

  /**
   * THE ONE SENTENCE BOTH COST LINES ARE BUILT FROM — dm, decision 3 as
   * amended at iteration 4:
   *
   *     Estimated cost of the recurring pass: about USD 0.021 for two runs on
   *     GPT-5.4 Mini via OpenRouter. This is an estimate — …
   *
   * IT NAMES THE PASS because since dm the two passes default to different
   * models on OpenRouter, and two figures a few centimetres apart with no
   * word saying which pass each is for would read as one price quoted twice.
   *
   * THE RUNS CLAUSE IS PASSED IN, NOT WORKED OUT HERE, because the two passes
   * count differently: the recurring estimate's `sends` is the whole pass
   * (two), while the cue-level estimate's `sends` is its CHUNK count, so its
   * clause comes from the pass stage's own SENDS_PER_CHUNK instead.
   *
   * THE MODEL IS NAMED BY `sentenceModelName` — dm iteration 5 — so on
   * Microsoft Foundry it reads "GPT-5.4 Mini via Microsoft Foundry" rather
   * than "GPT-5.4 Mini (Foundry) via Microsoft Foundry".
   *
   * Reached as `api.composeEstimateSentence` so a suite inversion can patch it.
   *
   * @param {string} passName a key of COST_PASS_WORDS
   * @param {object} estimate `{ model, costUsd }`
   * @param {string} runsClause from `composeSendsClause`
   * @param {string} providerLabel a person-readable provider name
   * @returns {string}
   */
  function composeEstimateSentence(passName, estimate, runsClause, providerLabel) {
    // pl, work item 6: only the cue-level line can carry the caption check, so
    // the recurring line reads its figure as it always did.
    const isPass = passName === "pass";
    const figure = isPass ? api.costFigures(estimate).main : estimate.costUsd.toFixed(COST_DECIMAL_PLACES);
    const clause = isPass ? api.composeCheckClause(estimate, providerLabel) : "";
    const model = api.sentenceModelName(estimate.model, providerLabel);
    return `Estimated cost of the ${COST_PASS_WORDS[passName]}: about USD ${figure} ${runsClause} on ${model} via ${providerLabel}${clause}. ${COST_NOT_MEASURED}`;
  }

  /**
   * THE THREE FIGURES A COST SENTENCE CAN PRINT, as strings — pl, work item 6.
   *
   * `estimate.costUsd` is the pass TOTAL since the stage added the caption
   * check to `estimatePass` (ruling 8), so a sentence saying "about USD <total>
   * … plus about USD <check>" would count the check twice. `main` is therefore
   * the cue-level part. All three are worked out in whole thousandths and
   * printed from those, so the figures ADD UP AS PRINTED: 0.0996 less 0.0504
   * is 0.0492 raw, which would read 0.049 beside a printed 0.050 and 0.100.
   *
   * `check` is null unless the estimate has check sends AND a known check
   * cost; then `main` is the total and the sentence is the one it always was.
   * Reached as `api.costFigures` so a suite inversion can patch it.
   *
   * @param {object} estimate `{ costUsd, plausibilitySends?, checkCostUsd? }`
   * @returns {{total: string, main: string, check: string|null}}
   */
  function costFigures(estimate) {
    const total = estimate.costUsd.toFixed(COST_DECIMAL_PLACES);
    const hasCheck =
      estimate.plausibilitySends > 0 && typeof estimate.checkCostUsd === "number" && Number.isFinite(estimate.checkCostUsd);
    if (!hasCheck) return { total: total, main: total, check: null };
    const scale = Math.pow(10, COST_DECIMAL_PLACES);
    const totalUnits = Math.round(estimate.costUsd * scale);
    const checkUnits = Math.round(estimate.checkCostUsd * scale);
    const print = (units) => (units / scale).toFixed(COST_DECIMAL_PLACES);
    return {
      total: print(totalUnits),
      main: print(Math.max(totalUnits - checkUnits, 0)),
      check: print(checkUnits),
    };
  }

  /**
   * The clause the cue-level cost line and its confirmation gain when the
   * caption check will run: ", plus about USD 0.015 for the caption check on
   * GPT-6 Sol" — pl, work item 6. Empty when there is no check to price (the
   * pass is unavailable, as on OpenRouter, or its cost is not known), so the
   * sentence is then byte-identical to the one before the check. The model is
   * named as the other cost sentences name theirs.
   *
   * @param {object} estimate
   * @param {string} providerLabel a person-readable provider name
   * @returns {string}
   */
  function composeCheckClause(estimate, providerLabel) {
    const figures = api.costFigures(estimate);
    if (figures.check === null || !estimate.checkModel) return "";
    return `, plus about USD ${figures.check} for the caption check on ${api.sentenceModelName(estimate.checkModel, providerLabel)}`;
  }

  /**
   * The model's name as the registry gives it to a person ("Claude Fable
   * 5.1"), or the id where the registry has no name for it — dm, decision 3
   * as amended at iteration 4. `silent` is true so an unknown id is the id,
   * not a warning nobody can act on. The registry's name is used as it is:
   * a Foundry entry's carries " (Foundry)", which this does not strip —
   * `sentenceModelName` does, and only where a sentence names Foundry.
   *
   * @param {string} modelId
   * @returns {string}
   */
  function modelDisplayName(modelId) {
    const registry = window.modelRegistry;
    if (!modelId || !registry || typeof registry.getModel !== "function") return String(modelId);
    try {
      const model = registry.getModel(modelId, true);
      const name = model && typeof model.name === "string" ? model.name.trim() : "";
      return name || modelId;
    } catch (error) {
      logWarn(`getModel('${modelId}') failed; the cost line names the id`, error);
      return modelId;
    }
  }

  /**
   * The model's name as a cost sentence says it, beside "via <provider>" —
   * dm, decision 3 as amended at iteration 5.
   *
   * A CHOICE, NOT A CORRECTION: the trailing " (Foundry)" is dropped from the
   * registry's name WHEN THE SENTENCE NAMES MICROSOFT FOUNDRY AS THE PROVIDER,
   * because "GPT-5.4 Mini (Foundry) via Microsoft Foundry" says Foundry twice
   * and Matthew's listen of 28 September 2026 heard it do so. The registry's
   * name is right where it stands alone (a model picker, say), which is why
   * the suffix is dropped here and not in `modelDisplayName`.
   *
   * KEYED ON THE PROVIDER LABEL THE SENTENCE IS ABOUT TO SAY, not on the
   * model id: the repetition is between two words the sentence speaks, so a
   * name carrying the suffix under any other provider label keeps it — that
   * would be a mismatch worth seeing, not one to tidy away.
   *
   * Used by both cost lines and both confirmations, so the four sentences
   * name a model one way. Reached as `api.sentenceModelName` so a suite
   * inversion can put the suffix back.
   *
   * @param {string} modelId
   * @param {string} providerLabel a person-readable provider name
   * @returns {string}
   */
  function sentenceModelName(modelId, providerLabel) {
    const name = String(api.modelDisplayName(modelId));
    if (providerLabel !== FOUNDRY_PROVIDER_LABEL || !name.endsWith(FOUNDRY_NAME_SUFFIX)) return name;
    return name.slice(0, name.length - FOUNDRY_NAME_SUFFIX.length);
  }

  /**
   * "for one run" on the cue-level line: the pass stage's own sends per
   * chunk, read rather than copied, so the clause and the stage cannot
   * disagree. Absent, `composeSendsClause` reads it as one, as `estimate`
   * itself does with a missing value.
   *
   * @returns {number|undefined}
   */
  function passSendsPerRun() {
    const pass = window.CaptionsFixerStageLlmPass;
    return pass ? pass.SENDS_PER_CHUNK : undefined;
  }

  /**
   * The sentence the red-tier confirmation asks.
   *
   * IT CARRIES THE SAME "for two runs" CLAUSE AS THE COST LINE — Stage 15. The
   * dispatch names only `composeCostLine`, and this is a deliberate extension
   * of it rather than an oversight: this is the sentence a person actually
   * answers before money is spent, and a confirmation that quotes the same
   * doubled figure while saying less about it than the line above it would be
   * the one place the explanation is missing.
   *
   * IT NAMES THE MODEL AS THE LINE DOES — dm, decision 3 as amended at
   * iteration 5. It named the id ("openai/gpt-5.4-mini") beside a line
   * saying "GPT-5.4 Mini" until then.
   *
   * @param {object} estimate
   * @param {string} providerLabel
   * @returns {string}
   */
  function composeCostConfirmation(estimate, providerLabel) {
    const figure = estimate.costUsd.toFixed(COST_DECIMAL_PLACES);
    const runs = composeSendsClause(estimate.sends);
    const model = api.sentenceModelName(estimate.model, providerLabel);
    return `This run is estimated at about USD ${figure} ${runs} on ${model} via ${providerLabel}, which is above the level this app asks about. The figure is an estimate, not a measurement. Do you want to run it?`;
  }

  /**
   * The table caption, which carries the conflict count when there is one.
   *
   * A conflict is an accepted entry whose `original` no longer matches the cue
   * it names, so `applyChangeSet` will refuse it. Refusing silently and
   * downloading a file with fewer changes than the table shows is the failure
   * this sentence exists to prevent.
   *
   * IT CARRIES THE PASS COUNT IN ITS EXISTING SENTENCE — Stage 11, decision
   * 10, which asks for that rather than a second caption or a sixth column,
   * and says to halt and report if one plain sentence cannot hold it. It can,
   * so there is no halt.
   *
   *     12 captions would change, 9 proposed by the caption-by-caption check;
   *     5 ticked to keep.
   *
   * THE CLAUSE SAYS WHERE THE ROWS CAME FROM AND NOT WHETHER THEY ARE TICKED,
   * AND THE FIRST WORDING GOT THAT WRONG. It read "9 of them proposed by the
   * caption-by-caption check and not yet ticked", which is true for exactly as
   * long as nobody ticks one — and a drive on 16 September 2026 put that
   * sentence on screen beside a ticked pass row. Provenance does not change; a
   * tick state does, and the `kept` count in the same sentence already reports
   * it. A caption that restates a mutable fact is a caption that will
   * eventually lie about it.
   *
   * WITH NO PASS ENTRIES THE SENTENCE IS BYTE-IDENTICAL TO THE ONE THIS TOOL
   * HAS ALWAYS SHOWN. That is deliberate and it is load-bearing: every
   * existing row asserting this caption reads a journey with no pass in it, so
   * none of them moves, and a row that DID move would be reporting a real
   * change in what a person is told rather than a cosmetic one.
   *
   * PL, WORK ITEM 5: a fifth argument, the number of rows that are captions to
   * check, adds ONE sentence — "Of these, M are captions to check." — and only
   * when M is above zero, so with none the sentence is byte-identical to the
   * one above. It sits after the ticked count and BEFORE the conflict sentence.
   * `proposed` no longer counts the check rows: they propose nothing. The
   * changes HEADING carries no count and is untouched.
   *
   * @param {number} total entries in the table, both sets
   * @param {number} kept entries still ticked
   * @param {number} conflicts entries `applyChangeSet` would refuse
   * @param {number} [proposed] how many of `total` came from the cue-level pass
   * @param {number} [check] how many of `total` are captions to check
   * @returns {string}
   */
  function composeChangesCaption(total, kept, conflicts, proposed, check) {
    const fromPass = typeof proposed === "number" ? proposed : 0;
    const toCheck = typeof check === "number" && check > 0 ? check : 0;
    const head = fromPass > 0
      ? `${pluralise(total, "caption")} would change, ${fromPass} proposed by the caption-by-caption check;`
      : `${pluralise(total, "caption")} would change;`;
    const ticked = `${head} ${kept} ticked to keep.`;
    const base = toCheck > 0
      ? `${ticked} ${toCheck === 1 ? "Of these, 1 is a caption to check." : `Of these, ${toCheck} are captions to check.`}`
      : ticked;
    if (conflicts === 0) return base;
    return `${base} ${pluralise(conflicts, "change")} cannot be applied because the caption has changed since it was proposed.`;
  }

  /**
   * The cue-level pass's cost line — Stage 11, decision 9.
   *
   * THE SIGNATURE TAKES THE CAPTION COUNT, WHICH THE DISPATCH'S DOES NOT, and
   * that is a correction rather than an addition. Decision 9 names
   * `composePassCostLine(estimate, chunkCount, providerLabel)` and gives the
   * sentence "About $0.06 to check 657 captions in 11 chunks on OpenRouter" —
   * but 657 is neither on the estimate nor derivable from a chunk count, so
   * the named signature cannot produce the named sentence. The count is passed
   * in.
   *
   * THE TAIL IS THIS TOOL'S OWN, not the dispatch's shorter "The estimate is
   * indicative." Two cost lines a few centimetres apart making different
   * promises about the same uncertainty would teach a person that one of them
   * means something stronger. It does not.
   *
   * SINCE dm ITERATION 4 IT IS THE RECURRING LINE'S SHAPE, naming the pass
   * and the model: "Estimated cost of the cue-level pass: about USD <figure>
   * for one run on Claude Fable 5.1 via OpenRouter." The caption and request
   * counts it carried until then are NOT in the new sentence, which is the
   * wording decision 3 prescribes; the confirmation below still carries both.
   * The two count parameters stay, so no caller changes shape.
   *
   * @param {object|null} estimate the pass stage's estimate, or null
   * @param {number} captionCount how many captions would be checked
   * @param {number} chunkCount how many requests that is
   * @param {string} providerLabel a person-readable provider name
   * @returns {string}
   */
  function composePassCostLine(estimate, captionCount, chunkCount, providerLabel) {
    if (!estimate || typeof estimate.costUsd !== "number") {
      return "The cost of checking the remaining captions could not be estimated, because no model is available. Check your provider in Set Up.";
    }
    return api.composeEstimateSentence("pass", estimate, composeSendsClause(passSendsPerRun()), providerLabel);
  }

  /**
   * The sentence the pass's red-tier confirmation asks. The same extension of
   * the cost line that `composeCostConfirmation` is of `composeCostLine`, and
   * for the same reason: this is the sentence a person answers before money is
   * spent, so it must not say less than the line above it — which is why,
   * since dm iteration 4, it names the model as the line now does.
   *
   * @param {object} estimate
   * @param {number} captionCount
   * @param {number} chunkCount
   * @param {string} providerLabel
   * @returns {string}
   */
  function composePassCostConfirmation(estimate, captionCount, chunkCount, providerLabel) {
    // pl, work item 6: with a caption check the headline is the cue-level part,
    // the clause prices the check, and the total — the figure the red tier was
    // judged on — is said last, so the person answers on the whole.
    const figures = api.costFigures(estimate);
    const figure = figures.main;
    const clause = api.composeCheckClause(estimate, providerLabel);
    const inAll = clause ? `, about USD ${figures.total} in all` : "";
    const model = api.sentenceModelName(estimate.model, providerLabel);
    return `Checking ${pluralise(captionCount, "caption")} is estimated at about USD ${figure} in ${pluralise(chunkCount, "request")} on ${model} via ${providerLabel}${clause}${inAll}, which is above the level this app asks about. The figure is an estimate, not a measurement. Do you want to run it?`;
  }

  /**
   * The visual-only progress line, one per chunk — Stage 11, decision 9.
   * NEVER SPOKEN: `setProgress` writes a region with no live role, and the
   * pass says one thing out loud, at the end.
   *
   * @param {number} chunk the 1-based chunk just started
   * @param {number} total how many there are
   * @returns {string}
   */
  function composePassProgressLine(chunk, total) {
    return `Checking captions, request ${chunk} of ${total}.`;
  }

  /**
   * The clause saying how many requests came back unreadable — Stage 16,
   * decision G. Empty when none did.
   *
   * ITS OWN EXPORTED FUNCTION, reached through `api` from `composePassLine`, so
   * an inversion can remove this one clause and move nothing else in the line.
   *
   * The verb is a modal ("could not be read"), so the sentence agrees whether
   * one request failed or several; only the request count is pluralised.
   *
   * ITERATION 8: WHEN EVERY REQUEST FAILED, "some captions were not checked"
   * was false — none were. That case gets its own clause. The line's opening,
   * "Checked the captions in N requests", is left as it is for now.
   *
   * @param {number} failed requests whose reply could not be read
   * @param {number} chunks how many requests were made
   * @returns {string}
   */
  function composeUnreadClause(failed, chunks) {
    if (!(typeof failed === "number" && failed > 0)) return "";
    if (failed === chunks) {
      return `, none of the ${pluralise(chunks, "request")} could be read, so no captions were checked`;
    }
    return `, ${failed} of ${pluralise(chunks, "request")} could not be read, so some captions were not checked`;
  }

  /**
   * The ONE spoken line the pass says, at the end — Stage 11, decision 9.
   *
   * `held` is the entries a guard refused, which the pass stage settles
   * through the orchestrator exactly as the recurring stage does. Naming them
   * matters: a person who was told nine changes were proposed, and counts
   * nine rows, has no way to know two more were considered and stopped.
   *
   * STAGE 16, ITERATION 7 — decision 5 and decision G. Two more arguments, in
   * this order in the sentence: after the held tail, how many requests could
   * not be read (a partial pass must not sound like a whole one); after the
   * close, how many captions the table now lists, read off the same count the
   * visible table caption is built from. Both are optional and default to
   * saying nothing, so a caller passing three arguments gets the Stage 11 line.
   * Still ONE line for one event, spoken once, through no live region.
   *
   * @param {number} proposed entries in the table from this pass
   * @param {number} held entries a check refused
   * @param {number} chunks how many requests were made
   * @param {number} [failed] requests whose reply could not be read
   * @param {number} [tableTotal] rows the table lists, both sets
   * @param {number} [check] captions to check, which propose nothing and are
   *   NOT in `proposed`. PL, WORK ITEM 5: named once, between the proposals
   *   and the held tail, in this same one line — no second announcement. With
   *   none the line is byte-identical to the one above.
   * @returns {string}
   */
  function composePassLine(proposed, held, chunks, failed, tableTotal, check) {
    const toCheck = typeof check === "number" && check > 0 ? check : 0;
    const base = `Checked the captions in ${pluralise(chunks, "request")}: ${pluralise(proposed, "change")} proposed`;
    const checkTail = toCheck > 0 ? `, ${pluralise(toCheck, "caption")} to check` : "";
    const tail = `${checkTail}${held > 0 ? `, ${held} held by a check` : ""}`;
    const unread = api.composeUnreadClause(failed, chunks);
    // "Nothing was added to the table" is only true when there are no check rows
    // either, and "Tick the ones you agree with" only when there is something
    // to tick.
    let close = "Tick the ones you agree with.";
    if (proposed === 0) close = toCheck > 0 ? CHECK_ONLY_CLOSE : "Nothing was added to the table.";
    const listed = typeof tableTotal === "number" && tableTotal > 0
      ? ` The table now lists ${pluralise(tableTotal, "caption")}.`
      : "";
    return `${base}${tail}${unread}. ${close}${listed}`;
  }

  // ==========================================================================
  // THE DIFF CELL — pure, exported, no state
  // ==========================================================================

  /**
   * One changed run: an opening bracket, the `del` or `ins`, a closing bracket,
   * all three as siblings, so no bracket is ever inside the element and the
   * element's own text stays exactly the run the diff produced.
   *
   * WHERE THE BRACKET SITS WHEN THE RUN CARRIES WHITESPACE, and why it is not a
   * detail. `diffWords` keeps whitespace with the UNCHANGED runs for a
   * substitution — `"oiler"` → `"Euler"` are bare words — but a pure insertion
   * or deletion takes the space with it: `"the cat sat"` → `"the big cat sat"`
   * emits one added run whose value is `"big "`, trailing space included,
   * measured against the pinned `diff@8.0.3` bytes.
   *
   * THE BRACKET HUGS THE WORD. Leading and trailing whitespace is emitted as a
   * plain text node OUTSIDE the bracket, so that run reads `the [big] cat sat`
   * rather than `the [big ]cat sat`. The alternative puts a space against a
   * bracket, which reads as a gap in the marking rather than as a marked word,
   * and makes two rows that ought to be identical differ by where the diff
   * happened to put a space. Nothing is lost either way: every character of the
   * run is still in the cell, in its original order.
   *
   * A run that is NOTHING BUT whitespace gets its element and no brackets,
   * because there is no word to put them round and a bare `[ ]` says nothing.
   *
   * @param {DocumentFragment} fragment
   * @param {string} tagName "del" or "ins"
   * @param {string} value the run's whole value, whitespace included
   */
  function appendBracketedRun(fragment, tagName, value) {
    const leadingMatch = /^\s+/.exec(value);
    const leading = leadingMatch ? leadingMatch[0] : "";
    const rest = value.slice(leading.length);
    const trailingMatch = /\s+$/.exec(rest);
    const trailing = trailingMatch ? trailingMatch[0] : "";
    const core = rest.slice(0, rest.length - trailing.length);

    const element = document.createElement(tagName);
    if (core === "") {
      element.appendChild(document.createTextNode(value));
      fragment.appendChild(element);
      return;
    }

    element.appendChild(document.createTextNode(core));
    if (leading !== "") fragment.appendChild(document.createTextNode(leading));
    fragment.appendChild(document.createTextNode(api.DIFF_BRACKET_OPEN));
    fragment.appendChild(element);
    fragment.appendChild(document.createTextNode(api.DIFF_BRACKET_CLOSE));
    if (trailing !== "") fragment.appendChild(document.createTextNode(trailing));
  }

  /**
   * One cell of the Was/Now pair, as a fragment.
   *
   * `Diff.diffWords` gives a list of `{ value, added, removed }`. The WAS side
   * takes the unchanged and the removed runs; the NOW side takes the unchanged
   * and the added ones. So the two cells are two readings of ONE diff and
   * cannot disagree about what changed.
   *
   * NEITHER `del` NOR `ins` CARRIES ANY HIDDEN TEXT — Stage 8b, decision 7,
   * and it REVERSES what this comment used to say. The premise was that NVDA
   * does not announce either tag by default, so a visually-hidden "deleted "
   * was inserted at the start of every run. THE PREMISE WAS WRONG. Matthew
   * heard "deleted" THREE TIMES before a single deleted word on 8 September
   * 2026 — the reader announcing the element, then reading the hidden span,
   * then announcing the element's end.
   *
   * So the elements do the work and nothing is written for a reader that a
   * sighted person cannot also see. There is still deliberately no colour
   * distinction: colour alone would be an SC 1.4.1 failure, and the tool's
   * stylesheet declares no hue at all.
   *
   * Built from real nodes rather than an HTML string, so there is no escaping
   * step to get wrong on caption text nobody in this project wrote.
   *
   * EVERY CHANGED RUN ALSO CARRIES VISIBLE BRACKETS, as text nodes either side
   * of the element — the review table's decision 6. See `appendBracketedRun`
   * for where a bracket sits when the run carries whitespace, and why.
   *
   * @param {string} original
   * @param {string} proposed
   * @param {string} side DIFF_SIDE.WAS or DIFF_SIDE.NOW
   * @returns {DocumentFragment}
   */
  function diffCell(original, proposed, side) {
    const fragment = document.createDocumentFragment();
    const diff = window.Diff;

    // A CHECK ROW HAS NO REPLACEMENT, and without this branch the Now cell
    // would print the word "null" (or the diff library would throw on it). The
    // Was cell is the caption as it stands; the Now cell is the sentence that
    // says why there is nothing to compare it with. pl, work item 5.
    if (typeof proposed !== "string") {
      fragment.appendChild(document.createTextNode(side === DIFF_SIDE.WAS ? original : CHECK_NOW_TEXT));
      return fragment;
    }

    if (!diff || typeof diff.diffWords !== "function") {
      // Degrade to the plain text rather than to nothing: a person still sees
      // both readings, they simply lose the word-level marking.
      logWarn("window.Diff is unavailable; the Was/Now cells fall back to plain text");
      fragment.appendChild(
        document.createTextNode(side === DIFF_SIDE.WAS ? original : proposed),
      );
      return fragment;
    }

    diff.diffWords(original, proposed).forEach((part) => {
      if (side === DIFF_SIDE.WAS && part.added) return;
      if (side === DIFF_SIDE.NOW && part.removed) return;

      if (side === DIFF_SIDE.WAS && part.removed) {
        appendBracketedRun(fragment, "del", part.value);
        return;
      }
      if (side === DIFF_SIDE.NOW && part.added) {
        appendBracketedRun(fragment, "ins", part.value);
        return;
      }
      fragment.appendChild(document.createTextNode(part.value));
    });

    return fragment;
  }

  // ==========================================================================
  // RENDERING
  // ==========================================================================

  /**
   * How many captions ONE pair would actually change.
   *
   * A one-line wrapper over `expand`, and it exists to be a SEAM. The number
   * beside each pair in the list is the single place the model's own opinion
   * could leak into something a person reads as fact, and rounds cf-1 and cf-2
   * both measured `openai/gpt-5.4-mini` and `openai/gpt-5.4` reporting one-off
   * corruptions as recurring. Routing the count through one exported function
   * means an inversion can replace it with `pair.count` and redden exactly the
   * rows that claim the number is measured — which is not possible if the call
   * is buried inside the renderer.
   *
   * @param {Array<object>} list the cue list
   * @param {object} pair one `{ from, to }`
   * @returns {number} captions this pair alone would change
   */
  function measurePairOccurrences(list, pair) {
    const recurring = window.CaptionsFixerStageRecurring;
    if (!recurring || typeof recurring.expand !== "function") {
      logWarn("the recurring stage is unavailable; pair counts cannot be measured");
      return 0;
    }
    return recurring.expand(list, [pair]).length;
  }

  /**
   * How many rows an APPLIED pair put in the table — Stage 8c, decision 2.
   *
   * A THIRD SEAM OVER `expand`, beside `measurePairOccurrences` and
   * `assessPair`, and it is deliberate for the reason `assessPair` already
   * records: each one is bound by an inversion that must move its own reading
   * and nothing else. Folding this into `measurePairOccurrences` would make the
   * `ui-count` inversion rewrite the applied suffix as well as the "found in"
   * count, and neither row would then prove what it names.
   *
   * IT IS ALSO THE HONEST NUMBER. Apply rebuilds the table from exactly the
   * ticked pairs, so a ticked pair's rows in the table ARE the captions it
   * changes — including the ones a check held, which stay in the table as
   * unticked rows rather than disappearing. The suite carries a row reading
   * both out and asserting they agree, so the equality is measured rather than
   * assumed here.
   *
   * @param {object} pair one `{ from, to }`
   * @returns {number}
   */
  function countAppliedRows(pair) {
    const recurring = window.CaptionsFixerStageRecurring;
    if (!recurring || typeof recurring.expand !== "function" || !cueList) {
      logWarn("the recurring stage is unavailable; the applied count cannot be measured");
      return 0;
    }
    return recurring.expand(cueList, [pair]).length;
  }

  /**
   * Run the CHECKS on one pair, before it is ever offered — Stage 8b decision 3.
   *
   * Until this stage the guards ran after Apply, so a person read 23
   * corrections, ticked them, waited, and then found that six of the resulting
   * captions had been held back by a check the tool could have run before
   * asking. The whole assessment is free: `expand`, `runGuardsOnSet` and
   * `makeCueIdKnown` are pure and send nothing.
   *
   * A SECOND SEAM BESIDE `measurePairOccurrences`, ON PURPOSE. That one is
   * bound by the inversion that proves the number beside a pair is measured
   * rather than the model's; this one is bound by the inversion that proves the
   * held group is populated by the checks. Folding them together would make
   * either inversion move both readings, and neither would then prove what it
   * names. The cost is one extra `expand` per pair, on a pure function.
   *
   * THE CUE-ID GUARD IS PREPENDED, exactly as the orchestrator does it:
   * DEFAULT_GUARDS omits it because it cannot be built without a cue list.
   *
   * @param {Array<object>} list the cue list
   * @param {object} pair one `{ from, to }`
   * @returns {{ entries: number, held: number, allHeld: boolean, heldBy: string|null }}
   */
  function assessPair(list, pair) {
    const recurring = window.CaptionsFixerStageRecurring;
    const guards = window.CaptionsFixerGuards;
    const none = { entries: 0, held: 0, allHeld: false, heldBy: null };
    if (!recurring || typeof recurring.expand !== "function" || !guards) {
      logWarn("the checks cannot run before the list; no pair will be held back");
      return none;
    }

    const entries = recurring.expand(list, [pair]);
    if (entries.length === 0) return none;

    const cueIdKnown = guards.makeCueIdKnown(list.map((cue) => cue.id));
    const checked = guards.runGuardsOnSet(entries, [cueIdKnown].concat(guards.DEFAULT_GUARDS));
    const held = checked.filter((entry) => entry.status === STATUS.REJECTED);
    const allHeld = held.length > 0 && held.length === entries.length;
    return {
      entries: entries.length,
      held: held.length,
      allHeld: allHeld,
      // The FIRST holding check names the group's label. `runGuards` returns on
      // the first guard that holds, so an entry carries exactly one, and where
      // several entries are held by different checks the first is the one
      // reported — a label naming one real check beats a list of all of them.
      heldBy: allHeld ? api.plainGuardName(held[0].rejectedBy) : null,
    };
  }

  /**
   * Did only ONE of the two runs propose this pair? — Stage 15, decision 8.
   *
   * `run` returns one merged list in which every pair carries `agreement`, so
   * this is a read of a field rather than a judgement: the sorting was done by
   * `api.agree` in the recurring stage, where a row can bind it by inversion
   * without a send.
   *
   * THE VALUE COMES FROM THE STAGE'S OWN FROZEN ENUM, at call time. Copying
   * `"one"` into this file would be a second spelling of a string two modules
   * have to agree on, and nothing would announce the day they stopped agreeing.
   * AGREEMENT_ONE_FALLBACK is reached only where that module is absent — a
   * state `init` already refuses to open the tool in — so it exists to stop a
   * stray render throwing, not to answer the question.
   *
   * A SEAM, exported on purpose: the inversion that proves HELD WINS over the
   * one-reply group patches this one function and moves the routing decision
   * without touching the checks, exactly as `assessPair` and
   * `measurePairOccurrences` are kept apart so neither inversion moves both.
   *
   * @param {object} pair one pair from the merged list
   * @returns {boolean}
   */
  function isOneReply(pair) {
    const recurring = window.CaptionsFixerStageRecurring;
    const one =
      recurring && recurring.AGREEMENT ? recurring.AGREEMENT.ONE : AGREEMENT_ONE_FALLBACK;
    return Boolean(pair) && pair.agreement === one;
  }

  /**
   * The pair list: one native checkbox and label per proposed pair.
   *
   * THE COUNT IN EACH LABEL IS MEASURED, NEVER THE MODEL'S. `expand` is run on
   * that one pair against the real cue list and the entries are counted. Rounds
   * cf-1 and cf-2 both measured `openai/gpt-5.4-mini` and `openai/gpt-5.4`
   * reporting one-off corruptions as recurring, so the model's own `count` is a
   * hint that is never shown to anybody as fact.
   *
   * @param {Array<object>} list the pairs, as `discover` returned them
   */
  function renderPairs(list) {
    const fieldset = elements.pairs;
    const legend = fieldset.querySelector("legend");
    empty(fieldset);
    if (legend) fieldset.appendChild(legend);
    empty(elements.heldList);
    empty(elements.uncertainList);

    let heldCount = 0;
    let uncertainCount = 0;

    list.forEach((pair, index) => {
      // The measured count, on this pair alone. Through `api` so the one seam
      // is patchable — see measurePairOccurrences.
      const occurrences = api.measurePairOccurrences(cueList, pair);
      // The checks, before the pair is offered. A separate seam — see assessPair.
      const assessment = api.assessPair(cueList, pair);
      const notFound = occurrences === 0;
      const allHeld = Boolean(assessment.allHeld);

      const row = document.createElement("div");
      row.className = "captions-fixer-pair";

      const id = `captions-fixer-pair-${index}`;
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = id;
      // NOTHING ARRIVES TICKED — decision 1. Read through `api` so the
      // inversion that proves it can move the default at its one seam.
      input.checked = api.PAIRS_START_TICKED;
      input.dataset.pairIndex = String(index);
      // A PAIR THE FILE DOES NOT CONTAIN IS DISABLED — decision 2. It stays on
      // screen, because what the model claimed is worth seeing; it simply
      // cannot be chosen. Four such pairs arrived TICKED on 8 September 2026.
      input.disabled = notFound;

      const label = document.createElement("label");
      label.setAttribute("for", id);
      label.appendChild(document.createTextNode(`${pair.from} → ${pair.to}, found in `));
      const count = document.createElement("span");
      count.className = "captions-fixer-pair-count";
      count.textContent = pluralise(occurrences, "caption");
      label.appendChild(count);
      label.appendChild(
        document.createTextNode(api.composePairTail(pair.reason, occurrences, assessment.heldBy)),
      );
      // THE APPLIED SUFFIX'S OWN NODE — Stage 8c, decision 2. Created empty and
      // written by `updateAppliedLabels`, so a re-apply changes one text node
      // rather than rebuilding the list. Rebuilding it would be worse than
      // silent: `renderPairs` starts every checkbox at PAIRS_START_TICKED, so a
      // re-render would untick everything the person had just ticked.
      const applied = document.createElement("span");
      applied.className = PAIR_APPLIED_CLASS;
      applied.dataset.pairIndex = String(index);
      label.appendChild(applied);

      row.appendChild(input);
      row.appendChild(label);

      // WHERE THE ROW GOES — three containers now, and THE ORDER OF THESE TESTS
      // IS THE DECISION rather than a detail of how it is written.
      //
      // A pair EVERY one of whose captions a check held goes into the native
      // <details> group — Stage 8b, decision 3. A pair only SOME of whose
      // captions are held is listed as normal; its held captions show in the
      // change table, unticked and with the reason, as they already did.
      //
      // HELD WINS OVER THE ONE-REPLY GROUP — Stage 15, decision 8, and that is
      // what putting this test first means. A pair can be both: only one of the
      // two runs proposed it AND every caption it touches was held back. It
      // goes to the held group, because "a check held this back, and here is
      // which check" tells a person something they can act on, where "one run
      // proposed this" only says how confident to be about a correction they
      // cannot take anyway.
      //
      // NOTHING IS DISCARDED ON EITHER BRANCH. Every pair in the merged list
      // reaches exactly one of the three containers.
      //
      // `index` is the pair's position in the ONE merged list `run` returns, so
      // `data-pair-index` stays unique across all three containers and
      // `tickedPairIndexes` goes on reading the whole section unchanged.
      if (allHeld) {
        heldCount += 1;
        elements.heldList.appendChild(row);
      } else if (api.isOneReply(pair)) {
        uncertainCount += 1;
        elements.uncertainList.appendChild(row);
      } else {
        fieldset.appendChild(row);
      }
    });

    elements.heldSummary.textContent = api.composeHeldSummary(heldCount);
    elements.held.hidden = heldCount === 0;
    // A group revealed by one run must not stay open into the next.
    if (heldCount === 0) elements.held.open = false;

    // The same three lines for the one-reply group, deliberately in the same
    // shape: a measured count in the summary, hidden at zero, and closed again
    // when a later run has nothing for it — Stage 15, decision 8.
    elements.uncertainSummary.textContent = api.composeUncertainSummary(uncertainCount);
    elements.uncertain.hidden = uncertainCount === 0;
    if (uncertainCount === 0) elements.uncertain.open = false;

    elements.pairsSection.hidden = list.length === 0;
    // A freshly rendered list carries no applied state. Called rather than
    // assumed, so the suffix has ONE writer.
    updateAppliedLabels();
    logInfo(
      `rendered ${list.length} pair(s), ${heldCount} held back by a check, ${uncertainCount} proposed by one run only`,
    );
  }

  /**
   * Write the applied suffix into every pair label — Stage 8c, decision 2.
   *
   * The only writer of that span. A pair the last Apply took carries
   * "applied: N changes"; every other pair carries the empty string, so
   * unticking a pair and applying again REMOVES the suffix rather than leaving
   * a stale one behind.
   */
  function updateAppliedLabels() {
    if (!elements) return;
    const taken = new Set(appliedPairIndexes);
    Array.from(elements.pairsSection.querySelectorAll(`.${PAIR_APPLIED_CLASS}`)).forEach((span) => {
      const index = Number(span.dataset.pairIndex);
      const pair = pairs[index];
      span.textContent =
        pair && taken.has(index) ? api.composeAppliedSuffix(api.countAppliedRows(pair)) : "";
    });
  }

  /**
   * The change table: one row per caption the ticked pairs would alter.
   *
   * The Keep checkbox is addressed by ROW INDEX rather than by cue id, and
   * carries its own visually-hidden `<label>`. A bare checkbox in a table cell
   * has no accessible name — a column header is not one — and indexing by
   * position stays correct if a later stage ever proposes two entries for one
   * caption.
   */
  /**
   * The two change sets as one list, recurring first — Stage 11, decision 8.
   *
   * ORDER IS THE CONTRACT, not a rendering detail. `handleKeepChange` resolves
   * a row index back to an entry through `entryAt`, which splits on
   * `changeSet.length`, and the file is built by applying the two sets in this
   * same order. One function is read by all three, so a change to the order is
   * one edit rather than three that have to agree.
   *
   * @returns {Array<object>}
   */
  function allEntries() {
    return changeSet.concat(passChangeSet);
  }

  /**
   * The entry a table row index names, across both sets.
   * @param {number} index
   * @returns {object|undefined}
   */
  function entryAt(index) {
    if (!Number.isInteger(index) || index < 0) return undefined;
    if (index < changeSet.length) return changeSet[index];
    return passChangeSet[index - changeSet.length];
  }

  /**
   * Is this entry the cue-level pass's? — Stage 16, iteration 4.
   *
   * ONE READER FOR ONE TEST. The equality against `PASS_SOURCE` was written in
   * one place before this stage; the sorted view and the post-pass focus move
   * both need the same question answered, and three copies of it is how a
   * later change reaches two of them. Iteration 5 widens this to a PREFIX test
   * — `source` gains `"llm-pass-edited"` and `"recurring-edited"` — and this
   * function is then the single line that moves.
   *
   * A PREFIX TEST SINCE ITERATION 5, and the widening is the whole of why this
   * function was consolidated at iteration 4. `source` now also carries
   * `"llm-pass-edited"`, and an exact equality would drop that value into the
   * ELSE branch silently — so an edited pass row would be named "Keep the
   * change to caption 9", the RECURRING wording, losing exactly the distinction
   * Stage 11b decision 2 was written to keep. Three readers ask this question
   * (the sorted view, the Keep label and the post-pass focus move) and this is
   * the one line that moved.
   *
   * IT IS STILL EXACT ABOUT WHAT IT ACCEPTS. `"recurring-edited"` does not
   * begin with `"llm-pass"`, so the other edited value is unaffected, and no
   * stage in this tree emits any other source.
   *
   * @param {object} entry
   * @returns {boolean}
   */
  function isPassEntry(entry) {
    return (
      Boolean(entry) &&
      typeof entry.source === "string" &&
      entry.source.indexOf(PASS_SOURCE) === 0
    );
  }

  /**
   * Is this entry a "Check this caption" row — pl, work item 5.
   *
   * Read off `status` alone, which is what a check entry IS: `proposed` is null,
   * the source (`llm-pass-check`) already satisfies `isPassEntry`'s prefix test,
   * and the moment a person's Edit makes it accepted it stops being one. Two
   * readers ask (the Keep cell and the Edit button's name), both through `api`.
   *
   * @param {object} entry
   * @returns {boolean}
   */
  function isCheckEntry(entry) {
    return Boolean(entry) && entry.status === STATUS.CHECK;
  }

  /**
   * The text an edit of this entry STARTS from, and the text a Save is
   * compared with to decide nothing changed.
   *
   * The proposal where there is one; the caption's own text where there is not
   * (a check row has `proposed: null`). Saving the caption back unchanged is
   * therefore "nothing changed" and leaves a check row a check row — the
   * person listened and decided it needed no edit, which is not a change.
   *
   * @param {object} entry
   * @returns {string}
   */
  function editStartText(entry) {
    return typeof entry.proposed === "string" ? entry.proposed : entry.original;
  }

  /**
   * The guards' own `rejectedBy` prefix, resolved AT CALL TIME.
   *
   * The same arrangement `plainGuardName` already uses, and for the same
   * reason: the guards module is a separate script and a module-scope capture
   * would freeze whatever `window` held when this file ran. The literal is the
   * fallback and never the first answer.
   *
   * @returns {string}
   */
  function guardPrefix() {
    const guards = window.CaptionsFixerGuards;
    return guards && guards.REJECTED_BY_PREFIX ? guards.REJECTED_BY_PREFIX : "guard:";
  }

  /**
   * Was this entry held back by a CHECK, as opposed to unticked by a person?
   *
   * The two are the same field with different values — `"guard:<name>"` against
   * `"person"` — and telling them apart is the whole of decision 8: a person
   * who unticked a row does not need to be told a check held it, and a row a
   * check held is the one they have to be told about.
   *
   * @param {object} entry
   * @returns {boolean}
   */
  function isHeldByGuard(entry) {
    if (!entry || typeof entry.rejectedBy !== "string") return false;
    return entry.rejectedBy.indexOf(guardPrefix()) === 0;
  }

  /**
   * THE TABLE'S ROW ORDER — Stage 16, decision 3 and decision A.
   *
   * By caption number ascending, recurring before pass where two entries land
   * on one caption. Returns `{ entry, index }` pairs in which **`index` is the
   * entry's position in the UNSORTED concatenation** `allEntries()` returns.
   *
   * THAT IS THE WHOLE DESIGN, AND IT IS WHY NOTHING DOWNSTREAM MOVES.
   * `dataset.entryIndex` goes on carrying the unsorted index, so `entryAt`
   * still splits on `changeSet.length`, `handleKeepChange` still resolves the
   * right entry, `keepKey` never sees an index at all and `applyChangeSet`
   * resolves by `cueId`. What changes is document order and only document
   * order.
   *
   * THE TIE IS RESOLVED EXPLICITLY RATHER THAN LEFT TO STABILITY. Array sort
   * is stable in every engine this ships to, and leaning on that would still
   * be leaning on `allEntries()` putting the recurring set first — a second
   * fact, in another function, that nothing would fail if it changed. The
   * comparator states the rule instead.
   *
   * A NON-NUMERIC `cueId` SORTS LAST rather than producing a NaN comparator,
   * which would leave the order unspecified and the fault invisible. No stage
   * emits one today; the clause is there so a future one cannot scramble the
   * table silently.
   *
   * @param {Array<object>} entries
   * @returns {Array<{ entry: object, index: number }>}
   */
  function sortedEntryView(entries) {
    const numeric = (entry) => {
      const value = Number(entry && entry.cueId);
      return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
    };
    return (entries || [])
      .map((entry, index) => ({ entry: entry, index: index }))
      .sort((left, right) => {
        const byCue = numeric(left.entry) - numeric(right.entry);
        if (byCue !== 0) return byCue;
        // THROUGH THE EXPORTED OBJECT, like every other seam this file reads
        // at render time. Iteration 5 found the reason the hard way: the
        // `ui-name-no-provenance` inversion already records that "the two
        // prefixes are lexical constants inside the module, so patching the
        // exported copies would change nothing and the rows would be green on
        // any build", and `isPassEntry` was exactly that — exported at
        // iteration 4 and read lexically by all three of its callers, so a
        // patch to `api.isPassEntry` moved NOTHING and the rows it was meant
        // to bind passed on every build. All three callers now go through
        // `api`, so the export is a seam rather than a copy.
        const byKind = (api.isPassEntry(left.entry) ? 1 : 0) - (api.isPassEntry(right.entry) ? 1 : 0);
        if (byKind !== 0) return byKind;
        return left.index - right.index;
      });
  }

  /**
   * The Start cell's text for a cue — Stage 16, decision 7. READ, NEVER WRITE.
   *
   * `window.CaptionsFixerCues` is resolved AT CALL TIME, never captured at
   * module scope: the cues module loads before this one today, but a capture
   * would be a load-order assumption with a silent failure, which is the trap
   * AGENTS.md names for `window.a11y`. A missing module or a missing formatter
   * yields the empty string rather than throwing, so the whole table cannot be
   * lost to one absent cue.
   *
   * @param {object|undefined} cue
   * @returns {string} `hh:mm:ss`, or "" when there is nothing to format
   */
  function startCellText(cue) {
    const cues = window.CaptionsFixerCues;
    if (!cue || !cues || typeof cues.formatTimestamp !== "function") return "";
    return cues.formatTimestamp(cue.start, START_SEPARATOR).slice(0, -START_MS_SUFFIX_LENGTH);
  }

  /**
   * The Reason cell's text — Stage 16, decision 8 and decision C.
   *
   * A held row reads `Held: <plain words>. <the model's reason>`; every other
   * row reads exactly what it read before, including a row a PERSON unticked.
   * Nothing is disabled anywhere: `handleKeepChange` is untouched, so ticking a
   * held row still accepts it and still clears `rejectedBy`.
   *
   * @param {object} entry
   * @returns {string}
   */
  function composeReasonCell(entry) {
    const reason = (entry && entry.reason) || "";
    if (!isHeldByGuard(entry)) return reason;
    const plain = HELD_REASON_PREFIX + plainGuardName(entry.rejectedBy);
    return reason ? plain + HELD_REASON_JOIN + reason : plain + SENTENCE_STOP;
  }

  /**
   * A Keep box's visually-hidden name — Stage 11b decision 2, Stage 16
   * decision 8.
   *
   * Read off the ENTRY's own source and its own `rejectedBy`, never off the
   * row's position: the table is now ordered by caption number, so a name
   * depending on position would have been wrong the day this stage landed.
   *
   * @param {object} entry
   * @returns {string}
   */
  function keepLabelText(entry) {
    const base = (api.isPassEntry(entry) ? KEEP_LABEL_PASS_PREFIX : KEEP_LABEL_PREFIX) + entry.cueId;
    // THE TWO SUFFIXES ARE MUTUALLY EXCLUSIVE BY CONSTRUCTION, not by care: an
    // edited entry is `accepted` with `rejectedBy` null, and a held one is
    // `rejected` with `"guard:<name>"`, so no entry can be both. Written as two
    // independent clauses anyway, because a build that ever produced both
    // should say both rather than hide one.
    if (api.isHeldByGuard(entry)) return base + KEEP_LABEL_HELD_SUFFIX;
    return api.isEditedEntry(entry) ? base + KEEP_LABEL_EDITED_SUFFIX : base;
  }

  // ==========================================================================
  // EDITING A PROPOSAL — Stage 16, decision 1 and decision D
  // ==========================================================================

  /**
   * Has a person retyped this entry? Read off `source` alone.
   * @param {object} entry
   * @returns {boolean}
   */
  function isEditedEntry(entry) {
    if (!entry || typeof entry.source !== "string") return false;
    return entry.source.slice(-EDITED_SOURCE_SUFFIX.length) === EDITED_SOURCE_SUFFIX;
  }

  /**
   * The `source` an edited entry carries — pure, and idempotent on purpose.
   * @param {string} source
   * @returns {string}
   */
  function editedSource(source) {
    const base = typeof source === "string" ? source : "";
    if (base.slice(-EDITED_SOURCE_SUFFIX.length) === EDITED_SOURCE_SUFFIX) return base;
    return base + EDITED_SOURCE_SUFFIX;
  }

  /**
   * The part of the Edit button's name that is NOT the visible word.
   *
   * Split from the full name so the visible "Edit" is a real text node a person
   * can see and a reader reads in place, rather than a second copy of a string
   * held somewhere else. `editLabelText` below is the whole name, for a row to
   * assert against; this is the seam an inversion moves.
   *
   * @param {object} entry
   * @returns {string}
   */
  function editLabelTail(entry) {
    // A CHECK ROW FIRST: its source is a pass source too, so the pass tail
    // would otherwise name it "the suggested change", which it is not.
    if (api.isCheckEntry(entry)) return EDIT_LABEL_CHECK_TAIL + entry.cueId + EDIT_LABEL_CHECK_SUFFIX;
    return (api.isPassEntry(entry) ? EDIT_LABEL_PASS_TAIL : EDIT_LABEL_TAIL) + entry.cueId;
  }

  /**
   * The Edit button's whole accessible name, as a reader would flatten it.
   * @param {object} entry
   * @returns {string}
   */
  function editLabelText(entry) {
    return EDIT_BUTTON_TEXT + api.editLabelTail(entry);
  }

  /** The dialog's title. @param {number} cueId @returns {string} */
  function composeEditTitle(cueId) {
    return EDIT_TITLE_PREFIX + cueId;
  }

  /**
   * THE ONE LINE A SUCCESSFUL SAVE SPEAKS — pure, exported, no state.
   * @param {number} cueId
   * @returns {string}
   */
  function composeEditedLine(cueId) {
    return `Caption ${cueId} will now read as you typed it.`;
  }

  /**
   * The line a REFUSED save speaks, and the reason it exists at all.
   *
   * The dispatch asks for the refusal to appear in "the modal's own status line"
   * with "the dialog stays open". MEASURED AT ITERATION 5 AND NOT POSSIBLE
   * THROUGH THE PUBLIC API: every footer button closes unconditionally
   * (universal-modal.js :935-943 calls `this.close` on click with no hook),
   * `onBeforeClose` belongs to the LEGACY `Modal` class and is reached only from
   * `Modal.prototype.close` (:1808), and the manager exposes no `close`, so a
   * Save control built in the dialog's own content could validate but could
   * never then close. `UniversalModal.showStatus` addresses the CURRENT modal
   * and is therefore gone by the time this runs.
   *
   * So the refusal is a spoken line instead, and the constraint is stated UP
   * FRONT in the hint the textarea is described by rather than only after the
   * event. Nothing is written: `proposed`, `status`, `rejectedBy` and `source`
   * are all untouched, which is the half that matters.
   *
   * @param {number} cueId
   * @returns {string}
   */
  function composeEditRefusedLine(cueId) {
    return `Caption ${cueId} was left as it was. A caption cannot be empty.`;
  }

  /**
   * May this text be saved? Whitespace-only is refused; nothing is trimmed.
   *
   * TRIMS NOTHING, as the dispatch requires — the text a person typed is the
   * text that is stored, leading and trailing spaces included, because a
   * caption's spacing is theirs to decide. The check is only whether anything
   * at all was typed.
   *
   * @param {string} text
   * @returns {boolean}
   */
  function isSavableEditText(text) {
    return typeof text === "string" && text.trim().length > 0;
  }

  /** How tall the textarea starts. @param {string} text @returns {number} */
  function editTextareaRows(text) {
    const lines = String(text === undefined || text === null ? "" : text).split("\n").length;
    return Math.max(EDIT_TEXTAREA_MIN_ROWS, lines + EDIT_TEXTAREA_EXTRA_ROWS);
  }

  /** This row's Edit button id. @param {number} index @returns {string} */
  function editButtonId(index) {
    return EDIT_BUTTON_ID_PREFIX + index;
  }

  /**
   * The diff token list for one entry, or an empty list where `Diff` is absent.
   *
   * `window.Diff` IS RESOLVED HERE AND NEVER CAPTURED, exactly as `diffCell`
   * resolves it — the library is a CDN global loaded from tools.html:21972 and
   * a module-scope capture would be `undefined`. An empty list is the honest
   * answer when it is missing: no tokens means no hunks means no fieldset, so
   * the dialog degrades to free editing rather than to a list of nothing.
   *
   * @param {string} original
   * @param {string} proposed
   * @returns {Array<object>} `{ count, added, removed, value }` per run
   */
  function diffPartsFor(original, proposed) {
    const diff = window.Diff;
    if (!diff || typeof diff.diffWords !== "function") {
      logWarn("window.Diff is unavailable; the edit dialog lists no changes");
      return [];
    }
    return diff.diffWords(original, proposed);
  }

  /**
   * THE HUNK BOUNDARIES — a maximal run of adjacent changed tokens.
   *
   * Measured against the pinned `diff@8.0.3` bytes (sha256 `83f6d018…`) at
   * iteration 0: every token carries all four keys, `added` and `removed` are
   * real booleans rather than `undefined`, and a substitution is emitted as two
   * ADJACENT tokens, removed first then added. So "adjacent and changed" is the
   * whole rule, and a substitution falls out of it as one hunk without being
   * special-cased.
   *
   * `start` and `end` are indices into `parts`, half-open, so
   * `rebuildFromHunks` can walk the token list and the hunk list together in
   * one pass rather than searching one from the other.
   *
   * @param {Array<object>} parts
   * @returns {Array<{start:number,end:number,removed:string,added:string}>}
   */
  function hunksOf(parts) {
    const list = [];
    const tokens = parts || [];
    let i = 0;
    while (i < tokens.length) {
      if (!tokens[i].added && !tokens[i].removed) {
        i += 1;
        continue;
      }
      const start = i;
      let removed = "";
      let added = "";
      while (i < tokens.length && (tokens[i].added || tokens[i].removed)) {
        if (tokens[i].removed) removed += tokens[i].value;
        else added += tokens[i].value;
        i += 1;
      }
      list.push({ start: start, end: i, removed: removed, added: added });
    }
    return list;
  }

  /**
   * One hunk's tick-box name, in the person's own words rather than the diff's.
   *
   * @param {{removed:string,added:string}} hunk
   * @returns {string}
   */
  function composeHunkLabel(hunk) {
    const removed = String(hunk.removed || "").trim();
    const added = String(hunk.added || "").trim();
    if (removed === "") return HUNK_LABEL_ADD_PREFIX + added + HUNK_LABEL_SUFFIX;
    if (added === "") return HUNK_LABEL_REMOVE_PREFIX + removed + HUNK_LABEL_SUFFIX;
    return (
      HUNK_LABEL_CHANGE_PREFIX + removed + HUNK_LABEL_CHANGE_MIDDLE + added + HUNK_LABEL_SUFFIX
    );
  }

  /**
   * THE REBUILD RULE, AND IT IS THE WHOLE OF DECISION E.
   *
   * Walk the tokens: emit every unchanged token's value; at each hunk emit that
   * hunk's `added` value when its box is ticked and its `removed` value when it
   * is not. All ticked is therefore the Now side and all unticked is the Was
   * side, with any mixture in between.
   *
   * IT REBUILDS THE NOW SIDE AND NEVER CLAIMS TO REBUILD THE WAS SIDE.
   * Iteration 0 measured the Now-side reconstruction byte-exact in 8 of 8 cases
   * and the Was-side reconstruction WRONG in 2 of 8 — `"a  b"` comes back with
   * its double space collapsed, and a tag case moves a space across the tag. So
   * `diffWords` is not lossless on the removed side, and an all-unticked
   * rebuild is a RECONSTRUCTION of the original rather than the original. That
   * is why `canRebuildHunks` below exists and why it compares against
   * `entry.original` rather than trusting this function.
   *
   * @param {Array<object>} parts
   * @param {Array<boolean>} kept one flag per hunk, in hunk order
   * @returns {string}
   */
  function rebuildFromHunks(parts, kept) {
    const tokens = parts || [];
    const hunks = api.hunksOf(tokens);
    const flags = kept || [];
    let out = "";
    let h = 0;
    let i = 0;
    while (i < tokens.length) {
      if (h < hunks.length && hunks[h].start === i) {
        out += flags[h] ? hunks[h].added : hunks[h].removed;
        i = hunks[h].end;
        h += 1;
        continue;
      }
      out += tokens[i].value;
      i += 1;
    }
    return out;
  }

  /**
   * MAY THIS ROW HAVE A HUNK LIST AT ALL — decision E's escape hatch, applied
   * PER ROW rather than once for the whole feature.
   *
   * The dispatch's hatch reads "if it cannot rebuild a partial text without
   * ambiguity, list hunks read-only and keep free editing". The three hand
   * cases decision E names all rebuild byte-exactly, so the feature ships; but
   * iteration 0's two known-bad cases are real captions a real transcript can
   * hold — this stage's own fixture carries a tagged caption — and on such a
   * row an unticked box would silently hand a person text that is NOT what the
   * caption said. So the two ends are checked against the truth the entry
   * already carries before a single box is drawn: all ticked must equal
   * `proposed`, all unticked must equal `original`, both byte for byte. A row
   * failing either gets no fieldset and keeps free editing, which is exactly
   * what the hatch asks for and is the safe direction to fail in.
   *
   * @param {Array<object>} parts
   * @param {string} original
   * @param {string} proposed
   * @returns {boolean}
   */
  function canRebuildHunks(parts, original, proposed) {
    const hunks = api.hunksOf(parts);
    if (hunks.length < HUNK_LIST_MINIMUM) return false;
    const allTicked = api.rebuildFromHunks(
      parts,
      hunks.map(() => true),
    );
    if (allTicked !== proposed) return false;
    const allUnticked = api.rebuildFromHunks(
      parts,
      hunks.map(() => false),
    );
    return allUnticked === original;
  }

  /**
   * THE HUNK LIST AS A `<fieldset>`, ONE NATIVE CHECKBOX PER HUNK, ALL TICKED.
   *
   * Native `<input type="checkbox">` and a real `<label for>`, which is the
   * first of the Five Rules of ARIA and needs no `role` and no `aria-*` to be
   * announced with its state. The `<legend>` names the group, so a reader
   * entering the third box hears what the group is as well as what the box is.
   *
   * THE HINT IS TIED TO THE FIELDSET RATHER THAN TO EACH BOX. Repeating "so
   * anything you have typed there by hand is lost" on every box would make a
   * five-hunk row say it five times, and the sentence is about the group.
   *
   * NOTHING HERE SPEAKS AND NOTHING HERE IS A LIVE REGION. A toggle rewrites
   * the textarea, which is a control the person is looking at and whose value
   * a reader re-reads when they reach it; an announcement per tick would be a
   * second voice for one gesture, and AGENTS.md § Announcements' first question
   * — does something already speak for this event — answers itself here,
   * because the checkbox announces its own state.
   *
   * @param {Array<object>} parts the diff token list
   * @param {Array<object>} hunks from `hunksOf`, already known rebuildable
   * @param {HTMLTextAreaElement} textarea the field a toggle rewrites
   * @returns {HTMLFieldSetElement}
   */
  function buildHunkFieldset(parts, hunks, textarea) {
    const fieldset = document.createElement("fieldset");

    const legend = document.createElement("legend");
    legend.textContent = HUNK_LEGEND_TEXT;
    fieldset.appendChild(legend);

    const hint = document.createElement("p");
    hint.id = HUNK_HINT_ID;
    hint.textContent = HUNK_HINT_TEXT;
    fieldset.appendChild(hint);
    fieldset.setAttribute("aria-describedby", HUNK_HINT_ID);

    const boxes = [];
    hunks.forEach((hunk, position) => {
      const wrapper = document.createElement("div");

      const box = document.createElement("input");
      box.type = "checkbox";
      box.id = HUNK_BOX_ID_PREFIX + position;
      box.checked = true;
      boxes.push(box);

      const label = document.createElement("label");
      label.setAttribute("for", box.id);
      label.textContent = api.composeHunkLabel(hunk);

      wrapper.appendChild(box);
      wrapper.appendChild(label);
      fieldset.appendChild(wrapper);
    });

    // ONE DELEGATED LISTENER, on the fieldset, rather than one per box — the
    // same arrangement the table's own Keep boxes use, and for the same reason:
    // the rebuild reads EVERY box's state, so a per-box listener would each
    // have to do the identical whole-list read anyway.
    fieldset.addEventListener("change", () => {
      textarea.value = api.rebuildFromHunks(
        parts,
        boxes.map((box) => box.checked),
      );
    });

    return fieldset;
  }

  /**
   * THE DIALOG'S CONTENT, BUILT AS REAL NODES AND FRESH EVERY TIME.
   *
   * An `HTMLElement` rather than an HTML string, which `createBody` accepts
   * (universal-modal.js :906), so a caption nobody in this tree wrote never
   * passes through an escaping step — the same reasoning `diffCell` already
   * gives. Fresh every time is what makes `onBeforeFocusRestore` unnecessary:
   * nothing that lives in the table travels into the dialog, so the opener is
   * still connected when `returnFocusTo` is resolved at close.
   *
   * NO `<form>`, as the dispatch requires, and no live region anywhere.
   *
   * THE TEXTAREA IS BUILT BEFORE THE FIELDSET AND APPENDED AFTER IT, which is
   * why the two are not created in reading order. The fieldset's toggle rewrites
   * the textarea, so it has to hold a reference to it; building the node first
   * and appending it in its own place is a plainer arrangement than a closure
   * reaching forward to a binding that does not exist yet.
   *
   * @param {object} entry
   * @returns {{ root: HTMLElement, textarea: HTMLTextAreaElement }}
   */
  /**
   * The textarea's `aria-describedby`, in the order a reader speaks it: the
   * Was paragraph FIRST, then the hint — iteration 8b, owed finding 5.
   *
   * A function rather than a literal so it is a seam: an inversion returning
   * the hint's id alone is the previous implementation restored.
   *
   * @returns {string}
   */
  function editDescribedBy() {
    return EDIT_WAS_ID + DESCRIBED_BY_SEPARATOR + EDIT_HINT_ID;
  }

  function buildEditDialogContent(entry) {
    const root = document.createElement("div");

    // WHAT THE DIALOGUE STARTS FROM, through `api`: the proposal, or for a
    // check row (no proposal) the caption's own text — pl, work item 5.
    const start = api.editStartText(entry);

    const textarea = document.createElement("textarea");
    textarea.id = EDIT_TEXTAREA_ID;
    // THE WAS PARAGRAPH FIRST, THEN THE HINT — see EDIT_WAS_ID. Both ids are
    // resolved by the reader at the moment the textarea takes focus, and both
    // elements are in the dialog by then: the paragraph is appended a few
    // lines below, before the dialog is shown.
    textarea.setAttribute("aria-describedby", api.editDescribedBy());
    textarea.rows = api.editTextareaRows(start);
    // `value`, never `textContent`: the two differ the moment a person types,
    // and only one of them is what the footer's Save will read back.
    textarea.value = start;

    const wasLabel = document.createElement("p");
    wasLabel.textContent = EDIT_WAS_LABEL;
    root.appendChild(wasLabel);

    const was = document.createElement("p");
    was.id = EDIT_WAS_ID;
    was.textContent = entry.original;
    was.style.whiteSpace = EDIT_PRESERVE_BREAKS;
    root.appendChild(was);

    // THE HUNK LIST, WHERE THE ROW EARNS ONE. `canRebuildHunks` holds both the
    // two-hunk threshold and the per-row rebuild check, so a row that cannot be
    // rebuilt byte-exactly simply does not get a fieldset and the dialog below
    // is the free-editing dialog iteration 5 shipped, unchanged.
    const parts = api.diffPartsFor(entry.original, start);
    const hunks = api.canRebuildHunks(parts, entry.original, start)
      ? api.hunksOf(parts)
      : [];
    if (hunks.length > 0) {
      root.appendChild(api.buildHunkFieldset(parts, hunks, textarea));
    }

    const label = document.createElement("label");
    label.setAttribute("for", EDIT_TEXTAREA_ID);
    label.textContent = EDIT_FIELD_LABEL;
    root.appendChild(label);

    const hint = document.createElement("p");
    hint.id = EDIT_HINT_ID;
    hint.textContent = EDIT_HINT_TEXT;
    root.appendChild(hint);

    root.appendChild(textarea);

    return { root: root, textarea: textarea };
  }

  /**
   * One row's Edit button.
   *
   * @param {object} entry
   * @param {number} index the entry's index in the UNSORTED concatenation
   * @returns {HTMLButtonElement}
   */
  function buildEditButton(entry, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.id = api.editButtonId(index);
    // The delegated listener reads this, exactly as the Keep box's own
    // `entryIndex` is read — so the table can be rebuilt without leaving a
    // listener per removed row behind.
    button.dataset.editIndex = String(index);

    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.dataset.icon = EDIT_ICON_NAME;
    const markup = typeof window.getIcon === "function" ? window.getIcon(EDIT_ICON_NAME) : "";
    if (markup) icon.innerHTML = markup;
    button.appendChild(icon);

    // ONE SPACE, LEADING ONLY. The hidden tail begins with a space of its own
    // — so a trailing space here as well put TWO between the visible word and
    // the rest. Read off the live table by the rt-3 drive rather than guessed:
    // it printed " Edit  the suggested change to caption 3".
    //
    // THE COMMENT THAT STOOD HERE UNTIL ITERATION 8b SAID THE TAIL'S OWN
    // LEADING SPACE WAS ENOUGH, "or a reader would flatten the name to
    // 'Editthe change to caption 3'". A reader did exactly that, four times,
    // with the space in place — see EDIT_TAIL_LEAD for why an ordinary space
    // at the start of an absolutely positioned box is not enough and a
    // non-breaking one is.
    button.appendChild(document.createTextNode(` ${EDIT_BUTTON_TEXT}`));

    const tail = document.createElement("span");
    tail.className = VISUALLY_HIDDEN_CLASS;
    tail.textContent = api.EDIT_TAIL_LEAD + api.editLabelTail(entry).replace(EDIT_TAIL_LEADING_SPACES, "");
    button.appendChild(tail);

    return button;
  }

  /**
   * SAVE, APPLIED TO THE ENTRY — and it speaks nothing, on purpose.
   *
   * Returns what happened so its one caller decides whether to speak. That
   * split is what lets a row assert the four outcomes without a notification
   * counter, and it keeps the announcer out of the function that writes.
   *
   * `original` NEVER CHANGES, which is decision F: `applyChangeSet` compares
   * `entry.original !== cue.text` (captions-fixer-cues.js:670), so an edited
   * entry conflicts on exactly the condition an unedited one does. NO TIMING IS
   * READ OR WRITTEN HERE — the four fields below are the whole of what moves.
   *
   * @param {number} index
   * @param {*} result what the dialog resolved with
   * @param {string} text the textarea's value, read before the dialog was gone
   * @returns {string} an EDIT_OUTCOME
   */
  function applyEdit(index, result, text) {
    // EXACT EQUALITY AGAINST "save", never truthiness. Escape resolves the
    // TRUTHY string "escape" and a backdrop click resolves "background"
    // (universal-modal.js :468, :1140) — the CL-1/DC-1 finding this repository
    // has already paid for twice, where three of five dismissals answered YES.
    if (result !== EDIT_ACTION_SAVE) return EDIT_OUTCOME.DISMISSED;
    const entry = api.entryAt(index);
    if (!entry) return EDIT_OUTCOME.DISMISSED;
    if (!api.isSavableEditText(text)) return EDIT_OUTCOME.REFUSED;
    // Against what the dialogue STARTED from, not against `proposed`: a check
    // row has no proposal, and its caption saved back unchanged is no change.
    if (text === api.editStartText(entry)) return EDIT_OUTCOME.UNCHANGED;

    entry.proposed = text;
    entry.status = STATUS.ACCEPTED;
    entry.rejectedBy = null;
    entry.source = api.editedSource(entry.source);

    // The whole table, because Was, Now, the Keep box's state and its name all
    // move together and rebuilding one cell would leave the other three saying
    // something that is no longer true.
    renderChanges();
    // The applied set decides what a further pass would cost, exactly as a tick
    // does — `handleKeepChange` goes through the same seam for the same reason.
    api.refreshPassControls();
    persistChangeSet();
    return EDIT_OUTCOME.SAVED;
  }

  /**
   * What the dialog's result means for the person: focus, then at most one line.
   *
   * WHY THE SETTLE IS HERE AND WHAT IT IS NOT FOR. `show()` resolves from the
   * LAST line of `finishClose` (universal-modal.js:1526), after the dialog is
   * detached and after `cleanupModalInert` — so unlike `safeConfirm` this
   * promise does NOT resolve into a live top layer, and the swallowed-region
   * half of MODAL_CLOSE_SETTLE_MS's reason does not apply. What does apply is
   * the other half: focus was restored a few lines earlier in that same
   * synchronous body, and AGENTS.md § Announcements records polite writes
   * landing within ~10ms of a focus change being dropped. The constant is
   * reused rather than copied, because a second number for the same wait is how
   * the two drift.
   *
   * @param {number} index
   * @param {*} result
   * @param {string} text
   * @returns {Promise<string>} the EDIT_OUTCOME, for a drive to read
   */
  async function handleEditResult(index, result, text) {
    const entry = api.entryAt(index);
    const cueId = entry ? entry.cueId : null;
    const outcome = api.applyEdit(index, result, text);

    // A SAVE REBUILT THE TABLE, so the button the modal restored focus to has
    // just been replaced. Focus is put back on the NEW button for the same
    // entry — same id, resolved after the render — rather than left on the body
    // where `removeChild` would have stranded it. Cancel and Escape rebuild
    // nothing, so tier 1 has already landed and there is nothing to do.
    if (outcome === EDIT_OUTCOME.SAVED) {
      api.moveFocus(document.getElementById(api.editButtonId(index)));
    }
    if (outcome === EDIT_OUTCOME.DISMISSED || outcome === EDIT_OUTCOME.UNCHANGED) {
      return outcome;
    }

    await new Promise((resolve) => window.setTimeout(resolve, MODAL_CLOSE_SETTLE_MS));
    if (outcome === EDIT_OUTCOME.SAVED) {
      speak("notifySuccess", api.composeEditedLine(cueId));
    } else {
      speak("notifyWarning", api.composeEditRefusedLine(cueId));
    }
    return outcome;
  }

  /**
   * Open the dialog for one row — Stage 16, decision 1.
   *
   * `window.UniversalModal` IS RESOLVED HERE AND NEVER CAPTURED AT MODULE
   * SCOPE: js/universal-modal.js is at tools.html:26329 and this file at
   * :22414, so the modal loads 3,915 lines later and a module-scope capture
   * would hold `undefined` and the button would do nothing, silently. The same
   * arrangement this file already uses for `window.safeConfirm`.
   *
   * `returnFocusTo` IS DECLARED, as a BARE ID STRING. It is opt-in per modal
   * (:701) and the manager's fallback `originalFocus` is one field for the whole
   * stack; a string is resolved at CLOSE time (:1228-1240), so it survives the
   * table being rebuilt while the dialog was open.
   *
   * @param {number} index
   * @returns {Promise<string>|null}
   */
  function openEditDialog(index) {
    const entry = api.entryAt(index);
    if (!entry) return null;

    const modal = window.UniversalModal;
    if (!modal || typeof modal.show !== "function") {
      speak("notifyError", EDIT_NO_MODAL_TEXT);
      return null;
    }

    const built = api.buildEditDialogContent(entry);
    return modal
      .show({
        title: api.composeEditTitle(entry.cueId),
        content: built.root,
        buttons: [
          { text: EDIT_SAVE_TEXT, type: EDIT_SAVE_TYPE, action: EDIT_ACTION_SAVE },
          { text: EDIT_CANCEL_TEXT, type: EDIT_CANCEL_TYPE, action: EDIT_ACTION_CANCEL },
        ],
        returnFocusTo: api.editButtonId(index),
      })
      // READ OFF THE NODE THIS CALL BUILT, not off the document: by the time
      // this runs the dialog has been removed, so `getElementById` would find
      // nothing and an empty string would read as a refusal.
      .then((result) => api.handleEditResult(index, result, built.textarea.value));
  }

  function renderChanges() {
    const body = elements.changesBody;
    empty(body);

    // THE CUE LOOKUP, BUILT ONCE PER RENDER rather than searched per row: the
    // table can hold a row per caption and a linear search per row would make
    // the render quadratic on a real transcript. `cueList` is this file's own
    // parsed list and is READ here and nowhere written — decision 7's "the
    // column reads `start`, never writes it" is a property of this line.
    const cueById = new Map();
    (cueList || []).forEach((cue) => cueById.set(cue.id, cue));

    // ORDERED BY CAPTION NUMBER — Stage 16, decision 3, through the one seam
    // decision A names. `item.index` is the entry's position in the UNSORTED
    // concatenation, so every reader downstream of `dataset.entryIndex` is
    // untouched; what moved is document order alone.
    api.sortedEntryView(api.allEntries()).forEach((item) => {
      const entry = item.entry;
      const index = item.index;
      const id = `captions-fixer-keep-${index}`;
      const row = document.createElement("tr");
      // Every cell carries its column's name. main.css's `.allyTable` rule
      // prints it in front of the value once the rows stack, which is what
      // keeps Was paired with Now when the table linearises — see the article
      // comment in tools.html. Written in ONE place, from COLUMN_LABELS, so a
      // column added here without a label is a missing label rather than a
      // wrong one.
      const withLabel = (cell, column) => {
        cell.dataset.label = COLUMN_LABELS[column];
        return cell;
      };

      const cueCell = withLabel(document.createElement("td"), 0);
      cueCell.textContent = String(entry.cueId);
      row.appendChild(cueCell);

      // STAGE 16, DECISION 7. The cue's start time, hh:mm:ss, READ-ONLY.
      // Resolved by `cueId` against this file's own parsed cue list and
      // formatted through the cues module's exported helper — never a copy of
      // it, and never written back. A caption with no cue in the list (nothing
      // produces one today) leaves the cell empty rather than guessing.
      const startCell = withLabel(document.createElement("td"), 1);
      startCell.textContent = api.startCellText(cueById.get(entry.cueId));
      row.appendChild(startCell);

      const wasCell = withLabel(document.createElement("td"), 2);
      wasCell.className = "captions-fixer-cell-was";
      wasCell.appendChild(api.diffCell(entry.original, entry.proposed, DIFF_SIDE.WAS));
      row.appendChild(wasCell);

      const nowCell = withLabel(document.createElement("td"), 3);
      nowCell.className = "captions-fixer-cell-now";
      nowCell.appendChild(api.diffCell(entry.original, entry.proposed, DIFF_SIDE.NOW));
      row.appendChild(nowCell);

      // STAGE 16, DECISION 8. A row a CHECK held says so, in plain words, in
      // front of the model's own reason. A row a PERSON unticked says neither
      // — it is their decision and they do not need it read back to them.
      const reasonCell = withLabel(document.createElement("td"), 4);
      reasonCell.textContent = api.composeReasonCell(entry);
      row.appendChild(reasonCell);

      const keepCell = withLabel(document.createElement("td"), 5);
      // A CHECK ROW HAS NOTHING TO KEEP — pl, work item 5. It proposes no
      // replacement, so there is no change to accept and no box: the cell stays
      // so the seven columns still line up, carrying the words "Nothing to
      // keep." (work item 5b) so the narrow layout never prints the column
      // label over an empty value, and the Edit button beside it is the row's
      // only control. Through `api`, so an inversion can reach it.
      if (api.isCheckEntry(entry)) {
        keepCell.textContent = KEEP_CELL_CHECK_TEXT;
      } else {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.id = id;
        input.checked = entry.status === STATUS.ACCEPTED;
        input.dataset.entryIndex = String(index);
        const label = document.createElement("label");
        label.className = VISUALLY_HIDDEN_CLASS;
        label.setAttribute("for", id);
        // STAGE 11b, DECISION 2 AND STAGE 16, DECISION 8. Read off the ENTRY's
        // own source and its own `rejectedBy`, never off the row's position —
        // and as of this iteration the table IS ordered by caption number, so
        // the day the Stage 11b comment anticipated is this one. The held suffix
        // is added by the same function, because both halves of the name are
        // properties of the entry and splitting them across two places is how
        // one of them gets missed.
        label.textContent = api.keepLabelText(entry);
        keepCell.appendChild(input);
        keepCell.appendChild(label);
      }
      row.appendChild(keepCell);

      // STAGE 16, DECISION 1. The per-row Edit button, filled at iteration 5.
      // Nothing here is disabled: a held row and a person-unticked row are both
      // editable, because editing is how a person overrules either.
      const editCell = withLabel(document.createElement("td"), 6);
      editCell.appendChild(api.buildEditButton(entry, index));
      row.appendChild(editCell);

      body.appendChild(row);
    });

    updateChangesCaption();
    elements.changesSection.hidden = api.allEntries().length === 0;
  }

  /**
   * Empty both result surfaces and hide them.
   *
   * The fieldset keeps its `<legend>`: emptying it wholesale would remove the
   * group's accessible name, and a fieldset whose legend has gone is a group a
   * screen reader can no longer identify.
   */
  function clearResults() {
    const legend = elements.pairs.querySelector("legend");
    empty(elements.pairs);
    if (legend) elements.pairs.appendChild(legend);
    empty(elements.heldList);
    elements.heldSummary.textContent = api.composeHeldSummary(0);
    elements.held.hidden = true;
    elements.held.open = false;
    empty(elements.uncertainList);
    elements.uncertainSummary.textContent = api.composeUncertainSummary(0);
    elements.uncertain.hidden = true;
    elements.uncertain.open = false;
    empty(elements.changesBody);
    elements.pairsSection.hidden = true;
    elements.changesSection.hidden = true;
  }

  /**
   * Build a change set from the ticked pairs, WITHOUT sending — Stage 8c,
   * decision 1.
   *
   * TWO PURE CALLS, IN THE ORCHESTRATOR'S OWN ORDER: `expand`, then the guards
   * with `cueIdKnown` prepended. It is not a shortcut past the orchestrator and
   * it does not reach the model: the orchestrator owns a RUN, which means a
   * send, a spend cap and a write per stage, and a second Apply has none of
   * those to own — calling `run` again would re-send for a decision the person
   * has already paid for once.
   *
   * THE SUITE PROVES THE TWO AGREE rather than this comment claiming they do:
   * a re-apply on the same ticked set must produce the orchestrator's own
   * change set entry for entry. If the orchestrator's arrangement changes, that
   * row is what reddens.
   *
   * @param {Array<object>} approved the pairs the person ticked
   * @returns {Array<object>} a fresh, guarded change set
   */
  function rebuildFromTicked(approved) {
    const recurring = window.CaptionsFixerStageRecurring;
    const guards = window.CaptionsFixerGuards;
    if (!recurring || typeof recurring.expand !== "function" || !guards || !cueList) {
      logWarn("the correction modules are unavailable; Apply cannot rebuild the table");
      return [];
    }
    const entries = recurring.expand(cueList, approved);
    const cueIdKnown = guards.makeCueIdKnown(cueList.map((cue) => cue.id));
    return guards.runGuardsOnSet(entries, [cueIdKnown].concat(guards.DEFAULT_GUARDS));
  }

  /**
   * One row's identity across a rebuild: the same change, to the same caption.
   *
   * `JSON.stringify` OF THE THREE, not a joined string, because caption text is
   * arbitrary and any separator character can appear inside it. A joined key
   * would let two different rows agree by accident, and the failure would be a
   * person's rejection landing on a caption they never rejected.
   *
   * @param {object} entry
   * @returns {string}
   */
  function keepKey(entry) {
    return JSON.stringify([entry.cueId, entry.original, entry.proposed]);
  }

  /**
   * Carry a person's own Keep decisions across a rebuild — Stage 8c, decision 1.
   *
   * ONLY A PERSON'S. A guard's rejection is re-derived by the guards on the
   * fresh set every time, so copying one across would be a second opinion
   * competing with the first.
   *
   * MATCHED ON CAPTION AND ON BOTH TEXTS, which is what "the row still exists"
   * means. The dispatch says caption and pair; a change-set entry names no
   * pair, and the standing rule is that a stage needing another field reports
   * rather than adding one. Caption plus was-and-now is derivable from the
   * shape as it stands and is the stricter reading: where two pairs both touch
   * one caption, dropping one of them changes what that row PROPOSES, and a
   * person who rejected "was X, now Y" has not rejected "was X, now Z".
   *
   * @param {Array<object>} next the rebuilt set, mutated in place
   * @param {Array<object>} previous the set the table held before
   * @returns {Array<object>} `next`
   */
  function preserveKeepChoices(next, previous) {
    const rejected = new Set();
    (previous || []).forEach((entry) => {
      if (entry && entry.rejectedBy === REJECTED_BY_PERSON) rejected.add(keepKey(entry));
    });
    if (rejected.size === 0) return next;
    next.forEach((entry) => {
      if (!rejected.has(keepKey(entry))) return;
      entry.status = STATUS.REJECTED;
      entry.rejectedBy = REJECTED_BY_PERSON;
    });
    return next;
  }

  /**
   * Write the change set back, where there is a key to write it under.
   * Storage is a convenience: a failure costs resume and nothing else.
   */
  function persistChangeSet() {
    if (!sha256) return;
    const patch = { changeSet: changeSet };
    // The pass's entries go under their own name, never merged into
    // `changeSet` — Stage 11, decision 6. The recurring stage's record must be
    // byte-identical before and after a pass run, and writing a combined array
    // under the recurring name is exactly the way that stops being true.
    if (passChangeSet.length > 0) patch[api.passEntriesField()] = passChangeSet;
    window.CaptionsFixerStore.persist(sha256, patch).catch((error) => {
      logWarn("the change set could not be written back", error);
    });
  }

  /**
   * THE TWO SETS APPLIED IN TWO STEPS, RECURRING FIRST — Stage 11, decision 8.
   *
   * The pass reads the list the recurring corrections have already been
   * applied to, so a pass entry's `original` is the text that list holds. Feed
   * the pass set the RAW cue list and every entry on a caption a pair also
   * touched is a conflict by construction, which would report a fault in the
   * model where the fault is in the order of two calls here.
   *
   * A CONFLICT IS STILL SKIPPED AND REPORTED, NEVER FORCED. Where a person
   * re-ticks the pairs after a pass has run, a pass entry whose `original` has
   * moved is refused by `applyChangeSet` exactly as it always was, and the
   * count reaches the caption. That is the standing rule, not a lock on the
   * tick boxes.
   *
   * @returns {{ cueList: Array<object>, applied: number, conflicts: Array<object> }|null}
   */
  function applyBothSets() {
    const cues = window.CaptionsFixerCues;
    if (!cues || !cueList) return null;
    const first = cues.applyChangeSet(cueList, changeSet);
    if (passChangeSet.length === 0) {
      return { cueList: first.cueList, applied: first.applied, conflicts: first.conflicts };
    }
    const second = cues.applyChangeSet(first.cueList, passChangeSet);
    return {
      cueList: second.cueList,
      applied: first.applied + second.applied,
      conflicts: first.conflicts.concat(second.conflicts),
    };
  }

  /** Recompute the caption from both change sets. */
  function updateChangesCaption() {
    const entries = api.allEntries();
    const kept = entries.filter((entry) => entry.status === STATUS.ACCEPTED).length;
    const applied = api.applyBothSets();
    // THE CHECK COUNT IS THE ORCHESTRATOR'S, read off its own `check` field and
    // not recounted here (pl, work item 5): a second count in this file would
    // be a second opinion about the same array. Taken over the pass set as it
    // stands NOW, so an edit that turns a check row into an accepted change
    // moves it. The proposal count excludes those rows, which propose nothing.
    const orchestrator = window.CaptionsFixerOrchestrator;
    if (!orchestrator || typeof orchestrator.countChangeSet !== "function") {
      logWarn("the orchestrator's tally is unavailable; the caption names no captions to check");
    }
    const checkCount = orchestrator && typeof orchestrator.countChangeSet === "function"
      ? orchestrator.countChangeSet(passChangeSet, new Map()).check
      : 0;
    elements.changesCaption.textContent = api.composeChangesCaption(
      entries.length,
      kept,
      applied ? applied.conflicts.length : 0,
      passChangeSet.length - (typeof checkCount === "number" ? checkCount : 0),
      checkCount,
    );
  }

  /** The provider's person-readable name, or its raw id. @returns {string} */
  function providerLabel() {
    const switcher = window.ProviderSwitcher;
    if (!switcher || typeof switcher.getActive !== "function") return "your provider";
    const active = switcher.getActive();
    if (typeof switcher.getKnown === "function") {
      const known = switcher.getKnown().find((entry) => entry && entry.id === active);
      if (known && known.label) return known.label;
    }
    return active || "your provider";
  }

  /**
   * The terms in the glossary field, parsed by the recurring stage's own pure
   * helper — Stage 15, decision 9.
   *
   * PARSED THERE AND NOT HERE. `parseGlossary` is the exported function a suite
   * row binds directly and an inversion can patch; a second splitter in this
   * file would be a second answer to "what counts as a term", and the estimate
   * and the send would be free to disagree with each other about it.
   *
   * @returns {Array<string>}
   */
  function glossaryTerms() {
    const recurring = window.CaptionsFixerStageRecurring;
    if (!recurring || typeof recurring.parseGlossary !== "function") {
      logWarn("parseGlossary is unavailable; the glossary field is being ignored");
      return [];
    }
    return recurring.parseGlossary(elements.glossary.value);
  }

  /**
   * The options BOTH the estimate and the send are built from — Stage 15,
   * decision 9.
   *
   * ONE READER, ON PURPOSE. The cost line and the run context are built from
   * this same function, so the price a person is shown describes the prompt the
   * tool actually sends. Two readings of the field would be two chances to
   * differ.
   *
   * AN EMPTY FIELD PUTS NO `glossary` KEY ON THE OBJECT AT ALL — not `[]`, and
   * not `undefined` under the key. `discover` branches on
   * `Array.isArray(ctx.glossary)`, so an empty array would take the
   * `buildSystemPrompt` branch.
   *
   * THE REASON IS THE RECORD, NOT THE PROMPT, and the dispatch's stated reason
   * was corrected in Stage 15 rather than repeated: it said an empty array
   * would move the prompt because the no-glossary branch passes SYSTEM_PROMPT
   * "by identity". It would not. A prompt is a STRING, `===` on strings
   * compares characters and not object identity, and `buildSystemPrompt([])`
   * produces exactly the characters SYSTEM_PROMPT holds — measured, and pinned
   * by a row. What an empty array WOULD change is what gets written down: a
   * non-empty glossary is persisted with the run, and an empty one has nothing
   * to say and should leave no trace saying it.
   *
   * @returns {object} `{}` or `{ glossary: [...] }`
   */
  function discoveryOptions() {
    const terms = glossaryTerms();
    return terms.length > 0 ? { glossary: terms } : {};
  }

  /** What one discovery PASS would cost — two sends since Stage 15. @returns {object|null} */
  function estimateRun() {
    const recurring = window.CaptionsFixerStageRecurring;
    if (!recurring || typeof recurring.estimateDiscover !== "function") return null;
    try {
      // Through `api` so an inversion patching the one glossary reader moves
      // the estimate and the send together, which is the property that keeps
      // the cost line honest about what Run will do.
      return recurring.estimateDiscover(cueList, api.discoveryOptions());
    } catch (error) {
      logWarn("estimateDiscover threw; the cost line will say so", error);
      return null;
    }
  }

  /** Write the cost line and enable or disable Run accordingly. */
  function renderCost() {
    const estimate = estimateRun();
    elements.cost.textContent = api.composeCostLine(estimate, providerLabel());
    elements.run.disabled = !estimate;
  }

  /**
   * THE LIST THE PASS WOULD BE SENT — Stage 11, decision 2.
   *
   * The applied list, not the upload. Two recorded reasons: the research
   * brief's *Do now* item 2 puts discover-and-replace first because it removes
   * most STEM errors at no hallucination risk, so the pass should never be
   * shown them; and a cue-level entry's `original` has to be the text
   * `applyChangeSet` will actually find, or every entry on a caption a pair
   * also touched is a conflict the moment it is created.
   *
   * ONLY THE RECURRING SET IS APPLIED HERE, never `passChangeSet`. A second
   * pass must see what the pairs did, not what a previous pass proposed — a
   * proposal is not a correction until somebody ticks it, and feeding the
   * model its own unaccepted output is how a tool argues with itself.
   *
   * @returns {Array<object>|null}
   */
  function passInputCueList() {
    const cues = window.CaptionsFixerCues;
    if (!cues || !cueList) return null;
    return cues.applyChangeSet(cueList, changeSet).cueList;
  }

  /**
   * What the caption check's sends alone would cost over the applied list, and
   * the model they go to — pl, work item 6. Summed from the stage's own
   * `plausibilityEstimateFor` over the chunks `estimatePass` itself builds
   * (same chunker, same cue-level model for chunk sizing), so it is the stage's
   * figure and not the UI's. Null where the pass is unavailable, or any chunk's
   * cost is unknown, so the sentence then says nothing about a check.
   * Reached as `api.plausibilityCostFor` so a suite inversion can patch it.
   *
   * @param {Array<object>} applied the list the pass would send
   * @param {object} options the same options `estimatePass` is given
   * @returns {{costUsd: number, model: string}|null}
   */
  function plausibilityCostFor(applied, options) {
    const pass = window.CaptionsFixerStageLlmPass;
    const llm = window.CaptionsFixerLLM;
    if (!pass || !llm || typeof pass.plausibilityEstimateFor !== "function") return null;
    const model = pass.resolvePlausibilityModelId();
    if (!model) return null;
    const cueModel = llm.resolveModel({ model: options && options.model, pass: llm.PASSES.PASS });
    const chunks = pass.chunksFor(applied, cueModel);
    let costUsd = 0;
    for (const chunk of chunks) {
      const one = pass.plausibilityEstimateFor(chunk);
      if (!one || one.unavailable || typeof one.costUsd !== "number") return null;
      costUsd += one.costUsd;
    }
    return chunks.length > 0 ? { costUsd: costUsd, model: model } : null;
  }

  /** What one cue-level pass would cost, over the applied list. @returns {object|null} */
  function estimatePassRun() {
    const pass = window.CaptionsFixerStageLlmPass;
    if (!pass || typeof pass.estimatePass !== "function") return null;
    const applied = api.passInputCueList();
    if (!applied) return null;
    try {
      // The SAME glossary reading the discovery estimate and the discovery
      // send are built from, through the one seam — so a term in the field
      // reaches both passes' prices by construction rather than by two readers
      // agreeing.
      const options = api.discoveryOptions();
      const estimate = pass.estimatePass(applied, options);
      if (!estimate || !(estimate.plausibilitySends > 0)) return estimate;
      // The pass total includes the caption check (stage `pl`, ruling 8); the
      // sentence prices the check apart, so its share is read off the stage.
      const check = api.plausibilityCostFor(applied, options);
      return check ? Object.assign({}, estimate, { checkCostUsd: check.costUsd, checkModel: check.model }) : estimate;
    } catch (error) {
      logWarn("estimatePass threw; the pass cost line will say so", error);
      return null;
    }
  }

  /**
   * Write the pass's cost line and set its button's enabled state — Stage 11,
   * decision 9.
   *
   * ONE FUNCTION FOR BOTH, called from every place either input moves: the
   * file load, the moment a discovery run settles, a re-Apply, and a tick.
   * Two functions called from four sites each is four chances for a cost line
   * to describe a send the button would not make.
   *
   * THE BUTTON NEEDS THREE THINGS AND SAYS SO SEPARATELY FROM THE LINE. It is
   * enabled only where a discovery run has settled, a cue list exists, and an
   * estimate could be made — a button offering to spend money on a price the
   * tool could not work out is the arrangement `renderCost` already refuses
   * for Run. The line is written whatever the button does, because the reason
   * a person cannot press it is the useful part.
   */
  function refreshPassControls() {
    if (!elements) return;
    const estimate = api.estimatePassRun();
    const applied = api.passInputCueList();
    const captionCount = applied ? applied.length : 0;
    const chunkCount = estimate && typeof estimate.chunks === "number" ? estimate.chunks : 0;
    elements.passCost.textContent = discoverySettled
      ? api.composePassCostLine(estimate, captionCount, chunkCount, providerLabel())
      : "";
    elements.passRun.disabled = !discoverySettled || !cueList || !estimate || running;
  }

  /**
   * THE PROVIDER WAS CHANGED SOMEWHERE ELSE — dm, decision 3 as amended at
   * iteration 5. Both cost lines name a model and a provider, and both were
   * priced for the provider active when they were written, so a switch made
   * in Set Up (or in another tab) left them describing a send Run would no
   * longer make. This re-estimates both, through the same two routes a file
   * load uses: `renderCost` and `refreshPassControls`.
   *
   * IT SAYS NOTHING. A visual update only, and deliberately: the person
   * changed the provider elsewhere and is not on this tool, so a line spoken
   * here would arrive in the middle of whatever they are doing there. No
   * `notify*()` call and no live region; the lines carry no live role.
   *
   * With no file loaded there is nothing to estimate, and the recurring line
   * would say no model was available, which is the wrong reason — the same
   * guard the glossary listener uses. During a run the lines are rewritten
   * but Run stays disabled, because `renderCost` enables it on any estimate
   * and a run is already in flight; `refreshPassControls` already reads
   * `running` for the pass button.
   *
   * Reached from the listener in `init` as `api.handleProviderChanged`, so a
   * suite inversion can replace it.
   */
  function handleProviderChanged() {
    if (!elements || !cueList) return;
    renderCost();
    api.refreshPassControls();
    if (running) elements.run.disabled = true;
    logDebug("provider:changed — both cost lines re-estimated");
  }

  // ==========================================================================
  // THE FILE
  // ==========================================================================

  /**
   * Read, parse, hash, look up and render one upload.
   *
   * Split from the drop and change handlers so the suite can drive it with a
   * string and a name, needing no File and no DataTransfer.
   *
   * ORDER MATTERS AT ONE POINT ONLY: the record is SAVED before anything can
   * run, because `CaptionsFixerStore.persist` is a read-modify-write that
   * NEVER creates — a stage persisting a paid-for reply against a key with no
   * record gets a rejection, and the bytes it paid for are lost.
   *
   * @param {string} text the file's contents
   * @param {string} name the file's name
   * @returns {Promise<boolean>} whether the upload was accepted
   */
  async function loadText(text, name) {
    const cues = window.CaptionsFixerCues;
    const store = window.CaptionsFixerStore;
    if (!cues) {
      speak("notifyError", "The captions module did not load. Reload the page.");
      return false;
    }

    let parsed;
    try {
      parsed = cues.parse(text, { sourceName: name });
    } catch (error) {
      // The parser REFUSES a construct it cannot round-trip and names it, with
      // an excerpt, rather than normalising it. That message is the useful part
      // and is passed through unchanged.
      logError("parse refused the upload", error);
      speak("notifyError", `That file could not be read: ${error.message}`);
      return false;
    }

    cueList = parsed.cueList;
    meta = parsed.meta;
    sourceName = name;
    pairs = [];
    changeSet = [];
    // Stage 11: a newly loaded file has had no run of its own, so the pass
    // button goes back to disabled and the previous file's proposals go with
    // the previous file.
    passChangeSet = [];
    discoverySettled = false;

    elements.fileName.textContent = name;
    clearResults();
    setProgress(PROGRESS.IDLE);

    let restored = false;
    if (store && store.isAvailable()) {
      try {
        sha256 = await store.sha256(text);
        await store.open();
        const record = await store.load(sha256);
        if (record) {
          pairs = Array.isArray(record.pairs) ? record.pairs : [];
          changeSet = Array.isArray(record.changeSet) ? record.changeSet : [];
          // Stage 11: the pass's entries come back with the recurring set.
          // Not restoring them would lose a person's own ticks on rows the
          // tool told them were saved, while the rows beside them survived —
          // a silent, asymmetric loss.
          //
          // THIS COMMENT CARRIED A SECOND SENTENCE UNTIL ITERATION 5b, and it
          // is quoted because it is now false rather than merely stale: "The
          // pass BUTTON is still disabled, because `discoverySettled` tracks a
          // run in THIS visit; the rows are a record, and the record is not a
          // run." The button is no longer still disabled — see the
          // `discoverySettled` line below and `settledFromRecord`. The reason
          // given was sound and the conclusion was too strong: a record is not
          // a run, but a record only a settled run could have written is
          // evidence that one happened.
          const restoredPass = record[api.passEntriesField()];
          passChangeSet = Array.isArray(restoredPass) ? restoredPass : [];
          restored = pairs.length > 0 || changeSet.length > 0 || passChangeSet.length > 0;
          // ITERATION 5b. The pass button comes back with the rows, so a
          // reload does not cost a second discovery. Only a record a settled
          // run wrote enables it — `settledFromRecord` carries the reading
          // that establishes which records those are.
          discoverySettled = api.settledFromRecord(record);
        } else {
          await store.save({
            sha256: sha256,
            sourceName: name,
            meta: meta,
            cueList: cueList,
            changeSet: [],
            pairs: [],
          });
        }
      } catch (error) {
        // Storage is a convenience here, not the deliverable. A person can
        // still run and download; only resume is lost, and the log says so.
        logWarn("the store could not be reached; resume is unavailable", error);
        sha256 = "";
      }
    } else {
      logWarn("IndexedDB is unavailable; nothing will be remembered between reloads");
      sha256 = "";
    }

    if (restored) {
      if (pairs.length > 0) renderPairs(pairs);
      if (api.allEntries().length > 0) renderChanges();
      setProgress(pairs.length > 0 && changeSet.length === 0 ? PROGRESS.AWAITING : PROGRESS.IDLE);
    }

    renderCost();
    api.refreshPassControls();

    // ONE line for this event.
    speak("notifySuccess", api.composeUploadLine(cueList.length, name, restored));
    logInfo(`loaded ${cueList.length} cues from ${name}, restored=${restored}`);
    return true;
  }

  /** @param {File} file */
  async function handleFile(file) {
    if (!file) return;
    if (!hasAcceptedExtension(file.name)) {
      speak(
        "notifyError",
        `${file.name} is not a captions file. Choose an SRT or VTT file, or a text file holding one.`,
      );
      return;
    }
    const text = await file.text();
    await loadText(text, file.name);
  }

  // ==========================================================================
  // THE CONTEXT FILE — Stage 10, decisions 6 to 8. A slide deck or module
  // text, read once, harvested for candidate terms, and never held in state
  // or persisted: the only trace is what the person leaves in the glossary
  // field, which is recorded under the existing `glossary` field at Run
  // exactly as Stage 15 does. See captions-fixer-context.js's header for
  // the reader and harvester this calls through.
  // ==========================================================================

  /**
   * @param {File} file
   */
  async function handleContextFile(file) {
    if (!file) return;
    if (!hasAcceptedContextExtension(file.name)) {
      speak(
        "notifyError",
        `${file.name} is not a slide deck or module text file. Choose a PPTX, PDF, TXT or MD file.`,
      );
      return;
    }

    const context = window.CaptionsFixerContext;
    if (!context) {
      speak("notifyError", "The context module did not load. Reload the page.");
      return;
    }

    elements.contextName.textContent = file.name;

    const lower = file.name.toLowerCase();
    // Named contextDoc, not `document` — this function never touches the DOM
    // directly, but shadowing the global for no reason is its own hazard.
    let contextDoc;
    try {
      if (lower.endsWith(".pptx")) {
        contextDoc = await context.readPptx(await file.arrayBuffer(), file.name);
      } else if (lower.endsWith(".pdf")) {
        contextDoc = await context.readPdf(await file.arrayBuffer(), file.name);
      } else {
        contextDoc = context.readText(await file.text(), file.name);
      }
    } catch (error) {
      // The reader throws a structured "dependency unavailable" error, or
      // whatever pdf.js/JSZip themselves throw on a file that is not what
      // its extension claims. Either way, the message is the useful part —
      // the same treatment loadText gives the captions parser's refusal.
      logError("the context reader refused the upload", error);
      speak("notifyError", context.composeContextErrorLine(file.name, error.message));
      return;
    }

    // Decision 5's harvest rule, decision 8's first two cases. CORRECTED
    // after iteration 4: composeContextLine's count is the number of lines
    // ADDED to the field, so "yields none" has to be checked AFTER the
    // merge, against added count, not before it against the raw harvest —
    // a deck whose terms are all already present adds nothing and must
    // speak the empty line, not a success line reading zero.
    const harvested = context.harvestTerms(contextDoc);

    // An EMPTY field splits to [""] on "\n", one blank line rather than zero
    // — checked for and avoided, so an empty Known terms field does not
    // gain a leading blank line the person never typed.
    const existingLines = elements.glossary.value.length > 0
      ? elements.glossary.value.split("\n")
      : [];
    const merged = context.mergeTerms(existingLines, harvested);
    const addedCount = merged.length - existingLines.length;

    if (addedCount === 0) {
      speak("notifyInfo", context.composeContextEmptyLine(file.name));
      return;
    }

    elements.glossary.value = merged.join("\n");
    // A programmatic value set fires no `input` event — decision 6 — so the
    // listener at the top of `init` will not run. `renderCost` reads
    // `cueList`, so this only runs once a captions file is loaded, the same
    // guard that listener uses.
    if (cueList) renderCost();
    speak("notifySuccess", context.composeContextLine(addedCount, file.name));
  }

  // ==========================================================================
  // THE RUN
  // ==========================================================================

  /**
   * `context.onPairs`. The orchestrator's recurring stage calls this with what
   * the model proposed and waits on what comes back.
   *
   * The line fires HERE rather than where `run` resolves, because this is the
   * moment the run's discovery finished and there is something to review; `run`
   * does not resolve until a person has pressed Apply, which may be minutes
   * later.
   *
   * @param {Array<object>} found
   * @returns {Promise<Array<object>>} the pairs the person ticked
   */
  function onPairs(found) {
    pairs = Array.isArray(found) ? found : [];
    renderPairs(pairs);
    setProgress(pairs.length > 0 ? PROGRESS.AWAITING : PROGRESS.IDLE);
    speak("notifySuccess", api.composePairsLine(pairs.length));

    if (pairs.length === 0) return Promise.resolve([]);

    return new Promise((resolve) => {
      pendingApproval = { resolve };
    });
  }

  /**
   * The pairs whose checkbox is ticked.
   *
   * QUERIED FROM THE WHOLE SECTION, not the fieldset. Since Stage 8b a pair
   * every one of whose captions a check held sits in the `<details>` group
   * beside the fieldset rather than inside it, and it is still tickable — a
   * person who disagrees with a check may take it. A query scoped to the
   * fieldset would silently drop those, which is a person's decision being
   * discarded rather than refused.
   *
   * @returns {Array<object>}
   */
  function tickedPairs() {
    return tickedPairIndexes()
      .map((index) => pairs[index])
      .filter(Boolean);
  }

  /**
   * The same query, as indexes — Stage 8c needs them to say WHICH pairs were
   * applied, and `pairs` holds no identity of its own.
   *
   * ONE QUERY, TWO READINGS, so the two can never disagree about what was
   * ticked. A disabled checkbox cannot be ticked, so the disabled pair is
   * excluded here by the browser rather than by a filter that could be wrong.
   *
   * @returns {Array<number>}
   */
  function tickedPairIndexes() {
    return Array.from(
      elements.pairsSection.querySelectorAll("input[type=checkbox][data-pair-index]"),
    )
      .filter((input) => input.checked)
      .map((input) => Number(input.dataset.pairIndex))
      .filter((index) => Boolean(pairs[index]));
  }

  /** Release a waiting approval with `approved`. @param {Array<object>} approved */
  function settleApproval(approved) {
    if (!pendingApproval) return;
    const { resolve } = pendingApproval;
    pendingApproval = null;
    resolve(approved);
  }

  /**
   * Move focus, through one seam.
   *
   * Exported so the focus sequence has a single patchable point — an inversion
   * that makes this a no-op reddens exactly the rows that claim focus moved,
   * and nothing else. It also refuses to focus something a person cannot act
   * on, which is the whole fault decision 5 exists to fix.
   *
   * @param {HTMLElement} element
   * @returns {boolean} whether focus actually moved there
   */
  function moveFocus(element) {
    if (!element || element.disabled || element.hidden) return false;
    element.focus();
    return document.activeElement === element;
  }

  /**
   * Run `callback` on the next animation frame — iteration 8b.
   *
   * This file had no deferred-focus pattern to match: its only deferrals are
   * the `MODAL_CLOSE_SETTLE_MS` timeouts, which wait for a modal's teardown and
   * are the wrong tool for "after the reader has seen this paint".
   * `requestAnimationFrame` is the shortest wait that is after a paint.
   *
   * Exported as a seam: an inversion that runs the callback synchronously is
   * the previous implementation restored, and reddens exactly the rows that
   * claim focus is NOT yet in the table when the run-end line is spoken.
   *
   * @param {Function} callback
   * @returns {number} the frame request id
   */
  function afterNextFrame(callback) {
    return window.requestAnimationFrame(() => callback());
  }

  /**
   * Move focus to the "Changes to your captions" heading — iteration 8c,
   * Matthew's option 1 for where a check leaves focus.
   *
   * A heading is not focusable, so it is given `tabindex="-1"` here the first
   * time and only if it carries none: programmatically focusable, never a Tab
   * stop, and no markup change. Grounded before it was written: the heading in
   * tools.html carries no tabindex. Through `moveFocus`, so a heading inside a
   * hidden section is refused and the result says whether focus moved.
   *
   * Exported as a seam, read through `api` by the post-check move.
   *
   * @returns {boolean} whether focus is now on the heading
   */
  function focusChangesHeading() {
    const heading = elements.changesHeading;
    if (!heading) return false;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    return moveFocus(heading);
  }

  /**
   * Enable or disable the run controls together, IN AN ORDER THAT NEVER LEAVES
   * FOCUS ON A DISABLED OR HIDDEN CONTROL — Stage 8b, decision 5.
   *
   * NVDA said "unavailable" on 8 September 2026 because Find corrections was
   * disabled while it still held the focus of the person who had just pressed
   * it. A disabled control keeps focus in Chrome only until the next Tab, and
   * what a reader announces in the meantime is its new state — so the last
   * thing heard after pressing Run was the word "unavailable".
   *
   * STARTING: reveal Cancel, move focus to it, THEN disable Run. Cancel is
   * visible and enabled at the moment it receives focus, and Run is disabled
   * only once it no longer holds any.
   *
   * STOPPING: re-enable Run, move focus back to it, THEN hide Cancel. Hiding a
   * focused element drops focus to the body just as surely as disabling it, so
   * the order is the mirror image rather than the reverse.
   *
   * FOCUS IS ONLY MOVED IF THE CONTROL BEING TAKEN AWAY IS THE ONE THAT HAS IT.
   * A run started from the suite, or from a `safeConfirm` the person answered,
   * must not have focus snatched from wherever the person actually is. That
   * makes the focus move a REPAIR of the focus this stage would otherwise
   * destroy, never a relocation of somebody's own.
   *
   * @param {boolean} isRunning
   */
  function setRunning(isRunning) {
    running = isRunning;
    elements.fileInput.disabled = isRunning;
    // THE GLOSSARY IS FROZEN FOR THE LENGTH OF THE RUN — Stage 15, beside the
    // file input and for the same reason. The cost a person was shown, and
    // confirmed at the red tier, was estimated from this field as it read at
    // that moment; `handleRun` reads it once more AFTER this call to build the
    // send. A field still editable in between would let the two come apart, so
    // the terms that were priced are the terms that go out.
    //
    // IT IS NOT FOCUS-MANAGED, the same treatment the file input already gets,
    // and the reason is that it cannot be the control that has focus here: a
    // run starts from Run, so the thing about to be disabled while holding
    // focus is Run, which is what decision 5's sequence below exists for. If a
    // way is ever added to start a run from inside this field, that stops being
    // true and this needs the same sequence.
    elements.glossary.disabled = isRunning;
    // Stage 10, decision 7: disabled while running alongside the captions
    // input and the glossary, for the same reason as the glossary above — a
    // deck dropped mid-run could add terms to a field whose contents have
    // already been priced and sent.
    elements.contextInput.disabled = isRunning;

    if (isRunning) {
      // STAGE 11: EITHER BUTTON CAN BE THE ONE HOLDING FOCUS. The sequence is
      // decision 5's, unchanged — reveal Cancel, move focus to it, THEN
      // disable — and it now covers both controls, because "Check the
      // remaining captions" is disabled by this call exactly as Run is and
      // would announce "unavailable" in a person's ear for exactly the same
      // reason.
      const startedHere =
        document.activeElement === elements.run || document.activeElement === elements.passRun;
      elements.cancel.hidden = false;
      if (startedHere) api.moveFocus(elements.cancel);
      elements.run.disabled = true;
      elements.passRun.disabled = true;
      return;
    }

    const cancelHadFocus = document.activeElement === elements.cancel;
    elements.run.disabled = false;
    // Through the same seam every other enable goes through, so the pass
    // button's three conditions are stated once. It must run BEFORE the focus
    // move below, or `moveFocus` refuses a control this call is about to
    // enable and focus lands on the body instead.
    api.refreshPassControls();
    // BACK TO THE BUTTON THE PERSON PRESSED, not always to Run. `runOrigin` is
    // set by whichever handler started this; falling back to Run keeps the
    // Stage 8b behaviour for a run started from anywhere else.
    if (cancelHadFocus) api.moveFocus(runOrigin || elements.run);
    elements.cancel.hidden = true;
  }

  async function handleRun() {
    if (running || !cueList) return;

    const recurring = window.CaptionsFixerStageRecurring;
    const orchestrator = window.CaptionsFixerOrchestrator;
    const llm = window.CaptionsFixerLLM;
    if (!recurring || !orchestrator || !llm) {
      speak("notifyError", "The correction modules did not load. Reload the page.");
      return;
    }

    // THE COST CHECK, BEFORE ANY SEND. The tier is indicative — see
    // composeCostLine — so it decides whether to ask, never what to say.
    const estimate = estimateRun();
    if (estimate && estimate.tier === COST_TIER_RED) {
      const confirmed = await window.safeConfirm(
        api.composeCostConfirmation(estimate, providerLabel()),
        "Confirm the estimated cost",
      );
      if (!confirmed) {
        // Deliberately silent. The person declined; saying so would report
        // their own decision back to them as news.
        logInfo("the run was declined at the cost confirmation");
        return;
      }
      // See MODAL_CLOSE_SETTLE_MS: safeConfirm resolves ~200ms before its modal
      // is actually gone, and a notify*() inside that window is rerouted into
      // the closing dialogue and wiped.
      await new Promise((resolve) => window.setTimeout(resolve, MODAL_CLOSE_SETTLE_MS));
    }

    if (!llm.init({ sinkId: SINK_ID })) {
      speak(
        "notifyError",
        "No model could be reached. Check your provider and API key in Set Up.",
      );
      return;
    }

    runOrigin = elements.run;
    setRunning(true);
    setProgress(PROGRESS.DISCOVERING);
    // A new run's pair list is a new list, so nothing in it has been applied.
    appliedPairIndexes = [];
    controller = new AbortController();

    const stage = {
      name: recurring.STAGE_NAME,
      fn: recurring.run,
      estimate: recurring.estimateDiscover,
    };

    // THE GLOSSARY, READ ONCE — Stage 15, decision 9. After `setRunning(true)`
    // disabled the field, so nothing can edit it between the reading that goes
    // out and the reading that was priced. The same object feeds the context
    // and the record below, so what was sent and what was written down are the
    // same terms by construction rather than by two calls agreeing.
    const discovery = api.discoveryOptions();

    // A NON-EMPTY GLOSSARY IS RECORDED WITH THE RUN — decision 9, through the
    // store field that already exists. Deliberately not awaited: the person
    // pressed Run, and a storage fault must not delay or take down the thing
    // they pressed for. A failure is logged, which is the same bargain
    // `persistQuietly` makes in the recurring stage for the paid-for bytes.
    //
    // An EMPTY field writes nothing at all rather than writing an empty list —
    // there is no glossary to record, and a record saying so is a record of
    // nothing.
    if (sha256 && discovery.glossary) {
      try {
        window.CaptionsFixerStore.persist(sha256, { glossary: discovery.glossary }).catch(
          (error) => logWarn("the glossary was not recorded", error),
        );
      } catch (error) {
        logWarn("the glossary was not recorded", error);
      }
    }

    let result = null;
    let failure = null;
    try {
      result = await orchestrator.run({
        cueList: cueList,
        meta: meta,
        sha256: sha256,
        // `Object.assign` rather than a `glossary:` line, because decision 9 is
        // about the KEY and not its value: an empty field must leave the
        // context with no `glossary` property at all, and `discovery` is `{}`
        // in that case. Writing `glossary: terms` here would put the key on
        // every context and make the empty case a value question.
        context: Object.assign(
          {
            onPairs: onPairs,
            // The store's own persist where there is a key, and nothing where
            // there is not — the orchestrator's resolvePersist then REFUSES
            // rather than pretending writes are landing.
            persist: sha256
              ? (patch) => window.CaptionsFixerStore.persist(sha256, patch)
              : undefined,
          },
          discovery,
        ),
        stages: [stage],
        signal: controller.signal,
      });
    } catch (error) {
      failure = error;
    }

    const wasCancelled = controller.signal.aborted;
    setRunning(false);
    controller = null;
    settleApproval([]);

    if (wasCancelled) {
      setProgress(PROGRESS.CANCELLED);
      speak("notifyWarning", api.composeCancelLine());
      logInfo("the run was cancelled");
      return;
    }

    if (failure) {
      setProgress(PROGRESS.IDLE);
      speak("notifyError", api.composeFailureLine(failure));
      logError("the run threw", failure);
      return;
    }

    // A stage that threw is recorded rather than rethrown, so the failure is
    // read off the record and not off a catch that never fires.
    const failed = (result.stages || []).find((record) => record.error);
    if (failed) {
      setProgress(PROGRESS.IDLE);
      speak("notifyError", api.composeFailureLine(failed.error));
      logError(`stage "${failed.name}" failed`, failed.error);
      return;
    }

    changeSet = result.changeSet || [];
    // STAGE 11, DECISION 9: THIS IS THE ENABLING MOMENT, and it is here rather
    // than in `renderPairs` for the reason `discoverySettled`'s own comment
    // gives — a run that found no recurring pairs has settled just as surely
    // as one that found nine, and it is the clean transcript that most needs a
    // cue-level pass. A cancelled or failed run returned above and never
    // reaches this line.
    discoverySettled = true;
    // ITERATION 7b. THE SAME MOMENT, WRITTEN DOWN, so a reload can reach the
    // conclusion this line reaches. It is here and in no other file: the
    // orchestrator's `settleStage` is reached by a cancel as well, so a marker
    // written there would say "settled" about a run the person stopped.
    //
    // Fire and forget, like `persistChangeSet`: a marker that failed to write
    // costs a person one Find press on their next visit, and blocking the
    // settle on a store write would cost them the run they just paid for.
    if (sha256) {
      window.CaptionsFixerStore.persist(sha256, {
        [FIELD_SETTLED_AT]: new Date().toISOString(),
      }).catch((error) => {
        logWarn("the settle marker could not be written; a reload will need a fresh run", error);
      });
    }
    renderChanges();
    updateAppliedLabels();
    api.refreshPassControls();
    setProgress(PROGRESS.IDLE);
    // A run that found NO pairs never reached an Apply at all, so it reports
    // what the run produced rather than what nobody ticked — the nothing-ticked
    // sentence would be a true statement about the wrong question.
    // A THIRD SYMPTOM OF THE SAME DEFECT, FOUND BY READING THE CALLERS RATHER
    // THAN BY EAR, AND REPAIRED HERE RATHER THAN LEFT. Decision 1 names
    // `reapply`; this call has the identical mismatch and is reachable by an
    // ordinary journey — nothing clears `passChangeSet` when Find is pressed a
    // second time, so a settle can land with the pass's rows in the table and
    // speak a count that leaves them out. Only a file load and Reset clear it.
    // The repair is the same one argument, and with no pass entries both
    // sentences are byte-identical to today's.
    const settledTotal = api.allEntries().length;
    speak(
      "notifySuccess",
      pairs.length === 0
        ? api.composeAppliedLine(settledTotal)
        : api.composeApplyOutcomeLine(settledTotal, appliedPairIndexes.length, passChangeSet.length),
    );
    logInfo(`the run settled with ${changeSet.length} entries, halted ${result.halted || "no"}`);
  }

  function handleCancel() {
    if (!running || !controller) return;
    setProgress(PROGRESS.CANCELLED);
    // The signal first, so the recurring stage's post-approval check sees it;
    // then the adapter, which rejects anything already in flight; then the
    // approval, which releases a `run` waiting on a person who has changed
    // their mind. Reversing the first two would let the stage read an
    // un-aborted signal and expand an empty approval as a normal result.
    controller.abort();
    const llm = window.CaptionsFixerLLM;
    if (llm && typeof llm.cancel === "function") llm.cancel("Cancelled by the person using the tool");
    settleApproval([]);
    logInfo("cancel requested");
  }

  /**
   * Apply the ticked corrections — Stage 8c, decision 1.
   *
   * IDEMPOTENT SINCE THIS STAGE, AND THE OLD GUARD IS QUOTED HERE BECAUSE IT
   * WAS THE DEFECT. It read, in full:
   *
   *     if (!pendingApproval) return;
   *
   * so the button worked exactly once per run and every later press was a
   * silent no-op. Matthew pressed it a second time on 9 September 2026 and
   * nothing at all happened — no line, no change on screen, the ticked boxes
   * still ticked and the button still live. A control that answers the first
   * press and ignores the second is worse than a disabled one, which at least
   * says so.
   *
   * TWO ROUTES, ONE RESULT. The first press of a run settles the approval the
   * orchestrator is waiting on, and the orchestrator builds the change set.
   * Every later press rebuilds it here, from the same two pure functions, with
   * no send. Both end with the table rebuilt from exactly what is ticked, the
   * applied labels rewritten, and one spoken line.
   */
  function handleApply() {
    if (!cueList || pairs.length === 0) return;
    // A run that is still discovering has nothing to apply, and letting a press
    // through would rebuild a table the run is about to replace.
    if (running && !pendingApproval) return;

    const approved = tickedPairs();
    appliedPairIndexes = tickedPairIndexes();

    if (pendingApproval) {
      setProgress(PROGRESS.EXPANDING);
      settleApproval(approved);
      return;
    }

    reapply(approved);
  }

  /**
   * A second and later Apply: rebuild, keep what the person decided, say so.
   * @param {Array<object>} approved
   */
  function reapply(approved) {
    const previous = changeSet;
    changeSet = api.preserveKeepChoices(api.rebuildFromTicked(approved), previous);
    renderChanges();
    updateAppliedLabels();
    // STAGE 11b, DECISION 1: BOTH COUNTS, BECAUSE THE TABLE HOLDS BOTH SETS.
    // `changeSet.length` is the RECURRING set alone where the table renders
    // `allEntries()`, and the second symptom of the Stage 11 defect is exactly
    // that gap: a second Apply with a correction still ticked spoke "71 changes
    // ready" while the caption directly above the table said "73 captions would
    // change". The spoken line and the visible caption disagreed with each
    // other, on the same screen, at the same moment.
    const total = api.allEntries().length;
    // Nothing ticked leaves the person where they started, so the instruction
    // comes back with the empty table — and ONLY with an empty table. With the
    // pass's rows still in it there is something to do, so the tool is idle
    // rather than awaiting.
    setProgress(total === 0 ? PROGRESS.AWAITING : PROGRESS.IDLE);
    speak("notifySuccess", api.composeApplyOutcomeLine(total, approved.length, passChangeSet.length));
    // `rebuildFromTicked` rebuilt the RECURRING set only and left
    // `passChangeSet` alone — decision 8 — but it changed the applied list the
    // pass would be sent, so the price moves even though the pass rows did not.
    api.refreshPassControls();
    persistChangeSet();
    logInfo(`re-applied ${approved.length} pair(s) into ${changeSet.length} entr(ies)`);
  }

  // ==========================================================================
  // THE CUE-LEVEL PASS — Stage 11
  // ==========================================================================

  /**
   * The context the pass stage runs with, with its `persist` RE-KEYED.
   *
   * `settleStage` writes the guarded entries under `changeSet`, and that field
   * belongs to the RECURRING stage's record — decision 6. Left alone, a pass
   * run would land on top of the recurring stage's own change set and destroy
   * it. The map is the same arrangement, in the same shape, as
   * `SECOND_SEND_FIELD_MAP` in `captions-fixer-stage-recurring.js`: a name the
   * map carries is renamed, and **a name it does not carry passes through
   * unchanged** rather than being dropped, so `passRaw` — which the stage
   * writes itself, under its own name — reaches disk untouched.
   *
   * WRAPPING THE RESOLVED `persist` IS DELIBERATE, and copied from there for
   * the same reason: where there is no key there is no function to wrap, this
   * returns the context as it was, and the orchestrator's `resolvePersist`
   * refuses exactly as it does today rather than this file inventing a second
   * way for a missing persist to behave.
   *
   * @param {object} ctx
   * @returns {object}
   */
  function passContext(ctx) {
    const persist = ctx.persist;
    if (typeof persist !== "function") return ctx;
    const map = { changeSet: api.passEntriesField() };
    return Object.assign({}, ctx, {
      persist: function persistForPass(patch) {
        const rekeyed = {};
        Object.keys(patch).forEach((name) => {
          rekeyed[map[name] || name] = patch[name];
        });
        return persist(rekeyed);
      },
    });
  }

  /**
   * Run the cue-level pass over the applied captions — Stage 11, decisions 2,
   * 7 and 9.
   *
   * IT IS A SECOND BUTTON, NOT A SECOND HALF OF RUN. Folding it into `handleRun`
   * would send eleven more requests on a press whose cost line says two, and
   * would double what the model harness measures, since that calls
   * `stage.discover` directly and must keep measuring one send.
   *
   * THE SHAPE IS `handleRun`'S, STEP FOR STEP — cost check, red-tier confirm,
   * the modal settle, `init`, `setRunning`, a controller, the orchestrator,
   * then the same four outcomes in the same order. Copied rather than shared
   * because the two differ at every line that matters (which list, which
   * stage, which persist, which sentence), and a parameterised merge of them
   * would hide exactly those differences behind a flag.
   *
   * EVERY ENTRY ARRIVES `proposed` AND THEREFORE UNTICKED. The stage sets that
   * status; nothing here changes it, and `applyChangeSet` ignores it until a
   * person ticks the box.
   */
  async function handlePassRun() {
    if (running || !cueList || !discoverySettled) return;

    const pass = window.CaptionsFixerStageLlmPass;
    const orchestrator = window.CaptionsFixerOrchestrator;
    const llm = window.CaptionsFixerLLM;
    if (!pass || !orchestrator || !llm) {
      speak("notifyError", "The correction modules did not load. Reload the page.");
      return;
    }

    // THE LIST IS TAKEN ONCE, HERE, and the same array is priced, sent and
    // used to count captions. Reading it twice would let the price and the
    // send describe different lists if a tick landed in between.
    const applied = api.passInputCueList();
    if (!applied) return;

    const estimate = api.estimatePassRun();
    if (estimate && estimate.tier === COST_TIER_RED) {
      const confirmed = await window.safeConfirm(
        api.composePassCostConfirmation(estimate, applied.length, estimate.chunks, providerLabel()),
        "Confirm the estimated cost",
      );
      if (!confirmed) {
        // Deliberately silent, as `handleRun` is: the person declined, and
        // reporting their own decision back to them is not news.
        logInfo("the pass was declined at the cost confirmation");
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, MODAL_CLOSE_SETTLE_MS));
    }

    if (!llm.init({ sinkId: SINK_ID })) {
      speak(
        "notifyError",
        "No model could be reached. Check your provider and API key in Set Up.",
      );
      return;
    }

    runOrigin = elements.passRun;
    setRunning(true);
    setProgress(PROGRESS.CHECKING);
    controller = new AbortController();

    const stage = {
      name: pass.STAGE_NAME,
      fn: pass.run,
      estimate: pass.estimatePass,
    };

    // The same one glossary reading the discovery send is built from, so a
    // term the person left in the field reaches both passes the same way.
    const discovery = api.discoveryOptions();

    let result = null;
    let failure = null;
    try {
      result = await orchestrator.run({
        // THE APPLIED LIST, not `cueList`. This is also what the guards'
        // `cueIdKnown` is built from inside the orchestrator, so a proposal on
        // a caption that is not in the list the model was shown is refused.
        cueList: applied,
        meta: meta,
        sha256: sha256,
        context: api.passContext(
          Object.assign(
            {
              // VISUAL PROGRESS ONLY, one line per request — decision 9. This
              // writes a region carrying no live role, so it is not spoken;
              // the pass says one thing out loud, at the end.
              onChunk: (chunk, total) => setProgress(api.composePassProgressLine(chunk, total)),
              persist: sha256
                ? (patch) => window.CaptionsFixerStore.persist(sha256, patch)
                : undefined,
              // THE RECURRING SET, so the stage can tell a caption that
              // already has an entry from one that has none and leaves it a
              // check row only when no entry of any status exists (ruling 9).
              // A copy: the stage reads it and must never be able to change
              // the set this file holds. pl, work item 5.
              recurringEntries: changeSet.slice(),
            },
            discovery,
          ),
        ),
        stages: [stage],
        signal: controller.signal,
      });
    } catch (error) {
      failure = error;
    }

    const wasCancelled = controller.signal.aborted;
    setRunning(false);
    controller = null;

    if (wasCancelled) {
      setProgress(PROGRESS.CANCELLED);
      speak("notifyWarning", api.composeCancelLine());
      logInfo("the pass was cancelled");
      return;
    }

    if (failure) {
      setProgress(PROGRESS.IDLE);
      speak("notifyError", api.composeFailureLine(failure));
      logError("the pass threw", failure);
      return;
    }

    const failed = (result.stages || []).find((record) => record.error);
    if (failed) {
      setProgress(PROGRESS.IDLE);
      speak("notifyError", api.composeFailureLine(failed.error));
      logError(`stage "${failed.name}" failed`, failed.error);
      return;
    }

    passChangeSet = result.changeSet || [];
    // HELD ENTRIES ARE READ OFF THE ORCHESTRATOR'S OWN TALLY, not recounted
    // here. `countChangeSet` already classifies every entry by `rejectedBy`
    // against the guards' own prefix; a second count in this file would be a
    // second opinion about the same array, free to disagree with the one the
    // table was built from. `tally` covers this run's change set alone, since
    // `run` starts each call with nothing accumulated.
    //
    // A GUARD-REJECTED ENTRY IS STILL IN THE ARRAY and still renders, exactly
    // as it does for the recurring stage — held means a check refused it, not
    // that it was hidden. So the count of PROPOSALS is the array less the held
    // ones, and the two numbers in the spoken line add up to the rows on
    // screen, which is the only way a person can reconcile them.
    const held = result.tally && typeof result.tally.rejectedByGuard === "number"
      ? result.tally.rejectedByGuard
      : 0;
    // THE CHECK ROWS PROPOSE NOTHING, so they leave the proposal figure and
    // are named once beside it. Read off the same tally as `held`, never
    // recounted: the orchestrator already classifies every entry by status.
    // pl, work item 5.
    const check = result.tally && typeof result.tally.check === "number" ? result.tally.check : 0;
    const proposed = Math.max(passChangeSet.length - held - check, 0);
    // The chunk count is the estimate's, over the same list through the same
    // `chunksFor`. Nothing the orchestrator returns carries it, and inventing
    // a second chunker call here could report a figure the run did not make.
    const chunks = estimate && typeof estimate.chunks === "number" ? estimate.chunks : 0;
    // STAGE 16, ITERATION 7 — the requests whose reply could not be read, off
    // the orchestrator's run result, which carries the stage's own count. Not
    // recounted off `passRaw`'s records: that would be a second opinion about
    // the same run, free to disagree with the one the stage made. SPOKEN, NEVER
    // STORED — `persistChangeSet` below writes the entries and nothing else.
    const failedRequests = typeof result.failedChunks === "number" ? result.failedChunks : 0;

    renderChanges();
    api.refreshPassControls();
    persistChangeSet();
    setProgress(PROGRESS.IDLE);
    // The table's size is read AFTER `renderChanges`, off the one count the
    // visible caption is built from (`updateChangesCaption` reads the same
    // `allEntries().length`), so the spoken line and the caption cannot differ.
    const tableTotal = api.allEntries().length;
    speak("notifySuccess", api.composePassLine(proposed, held, chunks, failedRequests, tableTotal, check));

    // STAGE 16, ITERATION 8c — FOCUS GOES TO THE "Changes to your captions"
    // HEADING, NOT INTO THE TABLE: Matthew's option 1, after the listen of 23
    // September 2026 at 16:15 still heard the table announced with its
    // PREVIOUS caption with the move one frame later (step 1 of sheet 2). The
    // heading is announced on its own, and the table, with whatever caption it
    // then carries, is read when the person moves into it. Still on the next
    // frame, still after the one line, still only when the check proposed
    // something; with nothing proposed focus stays on the button pressed.
    //
    // The history below is kept because it explains `afterNextFrame` and the
    // rows that read it; the first-pass-row selector it describes is gone.
    //
    // WAS: FOCUS TO THE FIRST PASS ROW'S TICK BOX WHEN THERE IS ONE — decision 9,
    // through the same `moveFocus` seam every other focus move in this file
    // uses, which refuses a control a person cannot act on and reports whether
    // it moved. With no proposals there is nothing to move to and focus stays
    // where `setRunning(false)` left it, on the button that was pressed.
    //
    // STAGE 16, ITERATION 4 — THIS LINE WAS A DOCUMENT-ORDER ASSUMPTION AND
    // THE SORTED VIEW BROKE IT. It selected `data-entry-index` equal to
    // `changeSet.length`, which is the FIRST entry of the pass set in the
    // unsorted concatenation. That element is still the right entry and is no
    // longer the first pass row on screen: under decision 3 the table is
    // ordered by caption number, so the pass entry with the lowest caption
    // number comes first wherever it sits in the array. Decision A listed
    // every reader of the index seam and this was the only one it broke,
    // because it reads POSITION and not identity.
    //
    // It now asks the same function the table was built from, so the two
    // cannot disagree. WHERE IT LANDS WHEN TWO ROWS SHARE A CAPTION NUMBER:
    // the recurring row sorts first, so focus goes to the SECOND of the pair —
    // the pass row — which is the one this run produced and the one decision 9
    // is about.
    //
    // ITERATION 8b — ONE FRAME LATER, owed finding 2 of the 23 September 2026
    // listen. NVDA announced the table with its PREVIOUS caption ("3 captions
    // would change; 3 ticked to keep.") straight after the line saying the
    // table now lists 8. The caption is written above, in `renderChanges`,
    // BEFORE the line and before this move — measured 6ms before focus entered
    // the table, in the same synchronous run — so the page is right and the
    // reader's copy of it was not. One possible cause, not tested: focus
    // arriving in the same instant as the rewrite, before the reader has
    // caught up. Deferring the move to the next animation frame is the cheap
    // test the handover named, and the listen is what settles it. The line
    // above is still spoken exactly once and before the move, so nothing about
    // the announcement changes; only when focus lands.
    if (passChangeSet.length > 0) {
      api.afterNextFrame(() => api.focusChangesHeading());
    }

    logInfo(
      `the pass settled with ${passChangeSet.length} entr(ies), halted ${result.halted || "no"}`,
    );
  }

  /**
   * A Keep checkbox changed. The entry is marked and the change set is written
   * back, so a reload finds the decision.
   * @param {HTMLInputElement} input
   */
  function handleKeepChange(input) {
    const index = Number(input.dataset.entryIndex);
    // ACROSS BOTH SETS — Stage 11, decision 8. A row index past the recurring
    // set names a pass entry, and ticking one makes it `accepted` exactly as
    // ticking a recurring row does: that is what turns a proposal into
    // something `applyChangeSet` will apply, and unticking it afterwards makes
    // it `rejected` by "person", the same as everywhere else in this file.
    const entry = api.entryAt(index);
    if (!entry) return;
    entry.status = input.checked ? STATUS.ACCEPTED : STATUS.REJECTED;
    entry.rejectedBy = input.checked ? null : REJECTED_BY_PERSON;
    // ITERATION 8b — THE NAME FOLLOWS THE STATE. A held row's box was named
    // "…, held by a check" until the table was next rebuilt, so a person who
    // had just overruled the check heard a box that said it was held and was
    // ticked. The suffix is read off the entry, and the entry has just moved.
    api.refreshKeepLabel(input, entry);
    updateChangesCaption();
    // The applied list is what the pass would be sent, so a tick changes what
    // the next pass would cost.
    api.refreshPassControls();

    // No spoken line. The checkbox conveys its own state, which is exactly the
    // arrangement the Transcribe display-options controls settled on and a
    // listen judged sufficient.
    persistChangeSet();
  }

  /**
   * Rewrite one Keep box's name from its entry, after the entry moved —
   * iteration 8b, the smaller point in the 23 September 2026 listen handover.
   *
   * WHAT THE NAME BECOMES, GROUNDED ON WHAT `rejectedBy` HOLDS. Ticking a
   * held row clears `rejectedBy` to null, so the held suffix goes. Unticking
   * it again writes `"person"` — `handleKeepChange` above is the only writer
   * and it never writes a guard value — so the row is now one a PERSON
   * unticked, and `keepLabelText` gives it neither suffix. The held suffix is
   * therefore NOT restored on an untick, and cannot be: the entry is no longer
   * held by a check, and the name says what the entry is. The dispatch's
   * "restored if unticked again while rejectedBy is still a guard value"
   * names a state this file never produces.
   *
   * THE REASON CELL IS NOT TOUCHED. It still opens "Held: …" after a tick,
   * which records why the check held the row; the dispatch scopes this fix to
   * the Keep label, and the cell is reported rather than changed.
   *
   * Exported as a seam: an inversion making it a no-op is the previous
   * implementation restored.
   *
   * @param {HTMLInputElement} input the box that changed
   * @param {object} entry its entry, already moved
   * @returns {boolean} whether a label was found to write
   */
  function refreshKeepLabel(input, entry) {
    const label = input && input.id ? document.querySelector(`label[for="${input.id}"]`) : null;
    if (!label) return false;
    const text = api.keepLabelText(entry);
    // Write if changed — a label is not a live region, but the same rule
    // costs nothing here and keeps every rewrite in this file deliberate.
    if (label.textContent !== text) label.textContent = text;
    return true;
  }

  // ==========================================================================
  // EXPORT
  // ==========================================================================

  /**
   * The corrected file, and how many entries actually reached it.
   * @returns {{ text: string, applied: number, conflicts: number, filename: string }|null}
   */
  function buildCorrected() {
    const cues = window.CaptionsFixerCues;
    if (!cues || !cueList || !meta) return null;
    // Stage 11, decision 8: both sets, recurring first, through the one seam
    // the caption's conflict count also reads — so what a person is told and
    // what they download cannot disagree about which changes landed.
    const applied = api.applyBothSets();
    if (!applied) return null;
    const stem = sourceName.replace(/\.[^.]+$/, "").trim() || "captions";
    // THE EXTENSION FOLLOWS THE META, NOT THE DISPATCH'S LITERAL ".srt".
    // `serialise` writes the format the file arrived in, so naming a VTT file
    // .srt would hand somebody a correctly-formed file under a wrong name.
    const format = (meta.format || "srt").toLowerCase();
    return {
      text: cues.serialise(applied.cueList, meta),
      applied: applied.applied,
      conflicts: applied.conflicts.length,
      filename: `${stem}${DOWNLOAD_SUFFIX}.${format}`,
    };
  }

  /**
   * Blob plus a programmatic anchor, the shape at
   * openrouter-embed-transcribe-ui.js:780.
   * @param {string} content
   * @param {string} filename
   * @param {string} mimeType
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
    logInfo(`download started: ${filename}`);
  }

  function handleDownload() {
    const built = buildCorrected();
    if (!built) return;
    const format = (meta.format || "").toLowerCase();
    downloadText(built.text, built.filename, MIME_BY_FORMAT[format] || MIME_FALLBACK);
    // ONE line, and it carries something the browser's own download UI does
    // NOT: how many corrections reached the file. Transcribe's downloads are
    // deliberately silent for the opposite reason — their line would have
    // reported only what the browser already reports.
    speak("notifySuccess", api.composeDownloadLine(built.applied));
  }

  async function handleCopy() {
    const built = buildCorrected();
    if (!built) return;
    try {
      await navigator.clipboard.writeText(built.text);
      speak("notifySuccess", api.composeCopyLine(built.applied));
      logInfo("corrected captions copied to the clipboard");
    } catch (error) {
      logError("copy failed", error);
      speak("notifyError", "The corrected captions could not be copied to the clipboard.");
    }
  }

  // ==========================================================================
  // DRAG AND DROP
  // ==========================================================================

  /**
   * Bound to a LABEL, which is the drop zone. The shape follows
   * setupDragAndDrop in md-scripts/charts/graph-builder-core.js:717, without
   * its dependency-injected dom helper.
   *
   * CORRECTED AT STAGE 10: `handler` is now a parameter rather than the
   * hard-coded `handleFile`, because decision 7 asks for "drag and drop
   * through the same `bindDragAndDrop`" for the context input, which must
   * reach `handleContextFile` and not the captions handler. The
   * document-level preventDefault trio moved OUT to `init`'s one-time block
   * below, because this function is now called twice per page (once per
   * zone) and the trio only needs registering once for the life of the page
   * — registering it per zone was harmless (every listener does the same
   * preventDefault) but pointless, and worth fixing while this function was
   * already being touched.
   *
   * @param {Element} zone
   * @param {(file: File|null) => void} handler
   */
  function bindDragAndDrop(zone, handler) {
    zone.addEventListener("dragenter", (event) => {
      event.preventDefault();
      event.stopPropagation();
      zone.classList.add(DRAG_ACTIVE_CLASS);
    });
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      zone.classList.add(DRAG_ACTIVE_CLASS);
    });
    zone.addEventListener("dragleave", (event) => {
      event.preventDefault();
      event.stopPropagation();
      // Only when the pointer has actually left the zone, not when it crosses
      // between the label's own children.
      if (!zone.contains(event.relatedTarget)) zone.classList.remove(DRAG_ACTIVE_CLASS);
    });
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      zone.classList.remove(DRAG_ACTIVE_CLASS);
      const file = event.dataTransfer && event.dataTransfer.files
        ? event.dataTransfer.files[0]
        : null;
      handler(file);
    });
  }

  // ==========================================================================
  // INIT AND CLEANUP
  // ==========================================================================

  /** Resolve every id in ELEMENT_IDS. @returns {object|null} */
  function resolveElements() {
    const found = {};
    const missing = [];
    Object.keys(ELEMENT_IDS).forEach((key) => {
      const element = document.getElementById(ELEMENT_IDS[key]);
      if (!element) missing.push(ELEMENT_IDS[key]);
      found[key] = element;
    });
    if (missing.length > 0) {
      logError(`the article is missing ${missing.length} element(s): ${missing.join(", ")}`);
      return null;
    }
    return found;
  }

  /**
   * Bind the tool. Called by TOOL_CONFIG["Captions Fixer"].init on every switch
   * to this tool, and idempotent: listeners are bound once per page.
   *
   * RETURNS FALSE on a wiring fault — a missing element or a missing pipeline
   * module — because a tool that opens with dead controls while telling the
   * person it opened correctly is worse than one that refuses.
   *
   * IT DOES NOT RETURN FALSE when the model adapter cannot bind. That is a
   * configuration state, not a wiring fault: a person with no API key can still
   * open the tool, load a file and read what it says, and Run reports the
   * reason when they press it. Refusing to open would hide the explanation.
   *
   * @returns {boolean}
   */
  function init() {
    const required = [
      "CaptionsFixerCues",
      "CaptionsFixerGuards",
      "CaptionsFixerLLM",
      "CaptionsFixerStore",
      "CaptionsFixerStageRecurring",
      // Stage 11. A pipeline module like the five above, so a page missing it
      // refuses to open rather than opening with a button that cannot work —
      // the same bargain the rest of this list makes.
      "CaptionsFixerStageLlmPass",
      "CaptionsFixerOrchestrator",
    ];
    const absent = required.filter((name) => !window[name]);
    if (absent.length > 0) {
      logError(`these modules did not load: ${absent.join(", ")}`);
      return false;
    }

    elements = resolveElements();
    if (!elements) return false;

    if (!bound) {
      // Registered once for the life of the page, ahead of both zones below —
      // stops the browser navigating away to a file dropped anywhere else on
      // the page, which would lose whatever the person had typed. Moved here
      // at Stage 10 when bindDragAndDrop started being called twice; see its
      // own comment.
      ["dragenter", "dragover", "drop"].forEach((type) => {
        document.addEventListener(type, (event) => event.preventDefault());
      });

      elements.fileInput.addEventListener("change", (event) => {
        const input = event.target;
        handleFile(input && input.files ? input.files[0] : null);
      });
      bindDragAndDrop(elements.dropZone, handleFile);
      // STAGE 10, DECISION 7. The second input copies the first: same change
      // listener shape, same bindDragAndDrop, its own handler.
      elements.contextInput.addEventListener("change", (event) => {
        const input = event.target;
        handleContextFile(input && input.files ? input.files[0] : null);
      });
      bindDragAndDrop(elements.contextDropZone, handleContextFile);
      // THE COST LINE FOLLOWS THE GLOSSARY — Stage 15. The estimate reads the
      // field, so a cost written before a person typed into it describes a
      // different send from the one Run would make. Through `renderCost`, the
      // same path the file load uses, so there is ONE estimate route rather
      // than a second one that could drift from it.
      //
      // NOT DEBOUNCED, deliberately and on instruction: this file has no
      // debounce helper and this stage does not add one. `renderCost` runs
      // `estimateDiscover`, which is a character count over the cue list plus
      // one registry lookup, and sends nothing.
      elements.glossary.addEventListener("input", () => {
        // Before a file is loaded there is nothing to estimate, and the line
        // would say no model was available — a WRONG REASON, not merely an
        // early one. The cost line belongs to a loaded file.
        if (!cueList) return;
        renderCost();
      });
      // dm ITERATION 5: the embed announces a provider switch on `window` as
      // `provider:changed` (openrouter-embed/provider-switcher.js). Registered
      // once, like everything in this block, and through `api` so an
      // inversion can replace the handler.
      window.addEventListener(PROVIDER_CHANGED_EVENT, () => api.handleProviderChanged());
      elements.run.addEventListener("click", handleRun);
      // Stage 11, decision 9. The existing Cancel cancels this too, through
      // the same `controller` — there is one run in flight at a time and one
      // control that stops it.
      elements.passRun.addEventListener("click", handlePassRun);
      elements.cancel.addEventListener("click", handleCancel);
      elements.apply.addEventListener("click", handleApply);
      elements.download.addEventListener("click", handleDownload);
      elements.copy.addEventListener("click", handleCopy);
      // ONE delegated listener for every Keep checkbox, so re-rendering the
      // table does not leave a listener per removed row behind.
      elements.changesBody.addEventListener("change", (event) => {
        const input = event.target;
        if (input && input.dataset && input.dataset.entryIndex !== undefined) {
          handleKeepChange(input);
        }
      });
      // ONE delegated listener for every Edit button, the same arrangement as
      // the Keep boxes above and for the same reason — the table is rebuilt on
      // every Apply, every pass and every Save. `closest` is what makes it
      // correct rather than nearly correct: the press can land on the icon's
      // own <svg>, which is not the button.
      elements.changesBody.addEventListener("click", (event) => {
        const target = event.target;
        const button =
          target && typeof target.closest === "function"
            ? target.closest("button[data-edit-index]")
            : null;
        if (button) api.openEditDialog(Number(button.dataset.editIndex));
      });
      bound = true;
    }

    logInfo("initialised");
    return true;
  }

  /**
   * Called when the person leaves the tool. Cancels a run and releases anything
   * waiting on them, so a `run` promise cannot outlive the tool it belongs to.
   */
  function cleanup() {
    if (running) handleCancel();
    settleApproval([]);
    logDebug("cleaned up");
  }

  /**
   * A read-only view of the controller's state, for the suite.
   * @returns {object}
   */
  function getState() {
    return {
      hasFile: Boolean(cueList),
      cueCount: cueList ? cueList.length : 0,
      sourceName: sourceName,
      sha256: sha256,
      pairs: pairs.slice(),
      changeSet: changeSet.slice(),
      // Stage 11: reported SEPARATELY, never merged, because the separation is
      // the property the rows are about — a `getState` handing back one joined
      // array could not tell a row whether `rebuildFromTicked` had eaten the
      // pass entries.
      passChangeSet: passChangeSet.slice(),
      discoverySettled: discoverySettled,
      running: running,
      awaitingApproval: Boolean(pendingApproval),
    };
  }

  /**
   * Put the controller back to its just-loaded state. FOR THE SUITE, and for
   * nothing else — the tool itself never resets, because a person who switches
   * away and back expects to find their work.
   */
  function resetForTests() {
    cleanup();
    cueList = null;
    meta = null;
    sourceName = "";
    sha256 = "";
    pairs = [];
    changeSet = [];
    // Stage 11, decision 8: Reset clears BOTH sets, and with them the state
    // that enables the pass button — a reset tool has had no run.
    passChangeSet = [];
    discoverySettled = false;
    runOrigin = null;
    appliedPairIndexes = [];
    if (!elements) return;
    elements.fileName.textContent = "No file chosen";
    elements.cost.textContent = "";
    elements.passCost.textContent = "";
    // The glossary is a person's input like the file, so it goes with it — a
    // row's terms left in the field would reach the NEXT row's estimate. The
    // re-enable is not belt-and-braces: a row that drives a run and asserts on
    // it leaves the field disabled behind it.
    elements.glossary.value = "";
    elements.glossary.disabled = false;
    // Stage 10, decision 7: cleared in the same reset path that clears the
    // glossary, for the same reason — a row's dropped deck must not reach
    // the next row.
    elements.contextName.textContent = "No file chosen";
    elements.contextInput.value = "";
    elements.contextInput.disabled = false;
    setProgress(PROGRESS.IDLE);
    // Through clearResults, so a surface added to the tool is cleared here by
    // construction rather than by somebody remembering to add a line.
    clearResults();
    elements.run.disabled = true;
    elements.passRun.disabled = true;
    elements.cancel.hidden = true;
  }

  logInfo("Captions Fixer UI loaded");

  const api = {
    init: init,
    cleanup: cleanup,
    // the file path, reachable without a File object
    loadText: loadText,
    handleFile: handleFile,
    handleContextFile: handleContextFile,
    // the gestures, so a drive can exercise one without synthesising an event
    handleRun: handleRun,
    handlePassRun: handlePassRun,
    handleCancel: handleCancel,
    handleApply: handleApply,
    handleDownload: handleDownload,
    handleCopy: handleCopy,
    // pure, exported so an inversion can patch the one seam every call goes
    // through, and so a row can assert a sentence without driving a journey
    composeUploadLine: composeUploadLine,
    composePairsLine: composePairsLine,
    composeAppliedLine: composeAppliedLine,
    composeAppliedSuffix: composeAppliedSuffix,
    composeApplyOutcomeLine: composeApplyOutcomeLine,
    composeNothingTickedWithPassLine: composeNothingTickedWithPassLine,
    composeNothingTickedWithRowsLine: composeNothingTickedWithRowsLine,
    PASS_SOURCE: PASS_SOURCE,
    KEEP_LABEL_PREFIX: KEEP_LABEL_PREFIX,
    KEEP_LABEL_PASS_PREFIX: KEEP_LABEL_PASS_PREFIX,
    KEEP_LABEL_HELD_SUFFIX: KEEP_LABEL_HELD_SUFFIX,
    HELD_REASON_PREFIX: HELD_REASON_PREFIX,
    HELD_REASON_JOIN: HELD_REASON_JOIN,
    START_SEPARATOR: START_SEPARATOR,
    START_MS_SUFFIX_LENGTH: START_MS_SUFFIX_LENGTH,
    EDIT_BUTTON_TEXT: EDIT_BUTTON_TEXT,
    EDIT_LABEL_TAIL: EDIT_LABEL_TAIL,
    EDIT_LABEL_PASS_TAIL: EDIT_LABEL_PASS_TAIL,
    EDIT_ICON_NAME: EDIT_ICON_NAME,
    EDIT_BUTTON_ID_PREFIX: EDIT_BUTTON_ID_PREFIX,
    EDIT_ACTION_SAVE: EDIT_ACTION_SAVE,
    EDIT_ACTION_CANCEL: EDIT_ACTION_CANCEL,
    EDIT_SAVE_TEXT: EDIT_SAVE_TEXT,
    EDIT_CANCEL_TEXT: EDIT_CANCEL_TEXT,
    EDIT_TITLE_PREFIX: EDIT_TITLE_PREFIX,
    EDIT_WAS_LABEL: EDIT_WAS_LABEL,
    EDIT_FIELD_LABEL: EDIT_FIELD_LABEL,
    EDIT_HINT_TEXT: EDIT_HINT_TEXT,
    EDIT_TEXTAREA_ID: EDIT_TEXTAREA_ID,
    EDIT_HINT_ID: EDIT_HINT_ID,
    EDIT_WAS_ID: EDIT_WAS_ID,
    // READ AT CALL TIME by `buildEditButton`, on the DIFF_BRACKET_OPEN
    // precedent: an inversion sets it back to an ordinary space.
    EDIT_TAIL_LEAD: EDIT_TAIL_LEAD,
    EDIT_PRESERVE_BREAKS: EDIT_PRESERVE_BREAKS,
    EDIT_TEXTAREA_MIN_ROWS: EDIT_TEXTAREA_MIN_ROWS,
    EDITED_SOURCE_SUFFIX: EDITED_SOURCE_SUFFIX,
    KEEP_LABEL_EDITED_SUFFIX: KEEP_LABEL_EDITED_SUFFIX,
    EDIT_OUTCOME: EDIT_OUTCOME,
    EDIT_NO_MODAL_TEXT: EDIT_NO_MODAL_TEXT,
    composeCancelLine: composeCancelLine,
    composeFailureLine: composeFailureLine,
    composeDownloadLine: composeDownloadLine,
    composeCopyLine: composeCopyLine,
    composeCostLine: composeCostLine,
    composeCostConfirmation: composeCostConfirmation,
    // dm, iteration 4 — the one sentence both cost lines are built from, and
    // the model's name as the registry gives it. Both are reached through
    // `api`, so a suite inversion patching either one reaches every caller.
    composeEstimateSentence: composeEstimateSentence,
    costFigures: costFigures,
    composeCheckClause: composeCheckClause,
    plausibilityCostFor: plausibilityCostFor,
    modelDisplayName: modelDisplayName,
    COST_PASS_WORDS: COST_PASS_WORDS,
    // dm, iteration 5 — the model's name beside "via <provider>", and the
    // provider:changed handler. Through `api` for the same reason.
    sentenceModelName: sentenceModelName,
    handleProviderChanged: handleProviderChanged,
    composeChangesCaption: composeChangesCaption,
    // Stage 11's sentences, exported for the same reason as the ones above: a
    // row can assert a sentence without driving a journey, and an inversion
    // can move the one seam every call goes through.
    composePassCostLine: composePassCostLine,
    composePassCostConfirmation: composePassCostConfirmation,
    composePassProgressLine: composePassProgressLine,
    composePassLine: composePassLine,
    composeUnreadClause: composeUnreadClause,
    composePairTail: composePairTail,
    composeHeldSummary: composeHeldSummary,
    composeUncertainSummary: composeUncertainSummary,
    composeSendsClause: composeSendsClause,
    plainGuardName: plainGuardName,
    diffCell: diffCell,
    measurePairOccurrences: measurePairOccurrences,
    countAppliedRows: countAppliedRows,
    assessPair: assessPair,
    // Stage 15's two seams, kept apart for the same reason as the two above:
    // `isOneReply` moves the ROUTING decision without touching the checks, and
    // `discoveryOptions` moves the one glossary reading that both the estimate
    // and the send are built from.
    isOneReply: isOneReply,
    discoveryOptions: discoveryOptions,
    glossaryTerms: glossaryTerms,
    // Stage 8c's two seams. Each is patchable on its own so the inversion that
    // names it moves one decision — rebuilding, or keeping — and not the other.
    rebuildFromTicked: rebuildFromTicked,
    preserveKeepChoices: preserveKeepChoices,
    moveFocus: moveFocus,
    afterNextFrame: afterNextFrame,
    focusChangesHeading: focusChangesHeading,
    refreshKeepLabel: refreshKeepLabel,
    buildCorrected: buildCorrected,
    // Stage 11's four seams, each patchable on its own so an inversion moves
    // ONE decision: which list the pass is sent, how the two sets are joined,
    // which entry a row index names, and how the two are applied.
    passInputCueList: passInputCueList,
    allEntries: allEntries,
    entryAt: entryAt,
    // Stage 16's four seams, each its own function so an inversion moves ONE
    // decision: the row order, the Start cell's text, the Reason cell's text
    // and the Keep box's name. `isPassEntry` is exported with them because the
    // focus move asks it directly and a row has to be able to see what it
    // asked.
    sortedEntryView: sortedEntryView,
    isPassEntry: isPassEntry,
    // pl, work item 5. Each its own seam, read through `api`: whether a row is
    // a check row, and what an edit of any row starts from.
    isCheckEntry: isCheckEntry,
    editStartText: editStartText,
    CHECK_NOW_TEXT: CHECK_NOW_TEXT,
    EDIT_LABEL_CHECK_TAIL: EDIT_LABEL_CHECK_TAIL,
    isHeldByGuard: isHeldByGuard,
    startCellText: startCellText,
    composeReasonCell: composeReasonCell,
    keepLabelText: keepLabelText,
    // Stage 16, iteration 5. Each is its own seam so an inversion moves ONE
    // decision: the button's name, the mark an edit leaves, the sentence a save
    // speaks, and whether empty text may be saved at all.
    isEditedEntry: isEditedEntry,
    editedSource: editedSource,
    editLabelTail: editLabelTail,
    editLabelText: editLabelText,
    composeEditTitle: composeEditTitle,
    composeEditedLine: composeEditedLine,
    composeEditRefusedLine: composeEditRefusedLine,
    isSavableEditText: isSavableEditText,
    editTextareaRows: editTextareaRows,
    editButtonId: editButtonId,
    // Stage 16, iteration 6, decision E. Each is its own seam so an inversion
    // moves ONE decision: where a hunk begins and ends, what its box is called,
    // how the text is rebuilt, and whether this row may have a list at all.
    // THEY ARE READ THROUGH `api.` AT EVERY CALL SITE, including from each
    // other — iteration 5 recorded `isPassEntry` being exported while its three
    // callers read the module's own lexical binding, so the inversion patched a
    // copy, moved nothing, and left three rows green on a build carrying the
    // defect they were named for.
    diffPartsFor: diffPartsFor,
    hunksOf: hunksOf,
    composeHunkLabel: composeHunkLabel,
    rebuildFromHunks: rebuildFromHunks,
    canRebuildHunks: canRebuildHunks,
    buildHunkFieldset: buildHunkFieldset,
    buildEditDialogContent: buildEditDialogContent,
    editDescribedBy: editDescribedBy,
    buildEditButton: buildEditButton,
    applyEdit: applyEdit,
    handleEditResult: handleEditResult,
    openEditDialog: openEditDialog,
    applyBothSets: applyBothSets,
    passContext: passContext,
    passEntriesField: passEntriesField,
    settledFromRecord: settledFromRecord,
    estimatePassRun: estimatePassRun,
    refreshPassControls: refreshPassControls,
    // for the suite
    getState: getState,
    resetForTests: resetForTests,
    // constants
    ELEMENT_IDS: ELEMENT_IDS,
    SINK_ID: SINK_ID,
    ACCEPTED_EXTENSIONS: ACCEPTED_EXTENSIONS,
    CONTEXT_ACCEPTED_EXTENSIONS: CONTEXT_ACCEPTED_EXTENSIONS,
    DRAG_ACTIVE_CLASS: DRAG_ACTIVE_CLASS,
    VISUALLY_HIDDEN_CLASS: VISUALLY_HIDDEN_CLASS,
    COST_TIER_RED: COST_TIER_RED,
    COST_DECIMAL_PLACES: COST_DECIMAL_PLACES,
    MODAL_CLOSE_SETTLE_MS: MODAL_CLOSE_SETTLE_MS,
    DOWNLOAD_SUFFIX: DOWNLOAD_SUFFIX,
    MIME_BY_FORMAT: MIME_BY_FORMAT,
    STATUS: STATUS,
    REJECTED_BY_PERSON: REJECTED_BY_PERSON,
    DIFF_SIDE: DIFF_SIDE,
    DIFF_BRACKET_OPEN: DIFF_BRACKET_OPEN,
    DIFF_BRACKET_CLOSE: DIFF_BRACKET_CLOSE,
    HUNK_LEGEND_TEXT: HUNK_LEGEND_TEXT,
    HUNK_HINT_TEXT: HUNK_HINT_TEXT,
    HUNK_HINT_ID: HUNK_HINT_ID,
    HUNK_BOX_ID_PREFIX: HUNK_BOX_ID_PREFIX,
    HUNK_LIST_MINIMUM: HUNK_LIST_MINIMUM,
    PAIRS_START_TICKED: PAIRS_START_TICKED,
    GUARD_PLAIN_NAMES: GUARD_PLAIN_NAMES,
    GUARD_PLAIN_FALLBACK: GUARD_PLAIN_FALLBACK,
    PAIR_NOT_FOUND_TEXT: PAIR_NOT_FOUND_TEXT,
    PAIR_APPLIED_PREFIX: PAIR_APPLIED_PREFIX,
    PAIR_APPLIED_CLASS: PAIR_APPLIED_CLASS,
    NOTHING_TICKED_TEXT: NOTHING_TICKED_TEXT,
    HELD_LABEL_PREFIX: HELD_LABEL_PREFIX,
    HELD_SUMMARY_BASE: HELD_SUMMARY_BASE,
    UNCERTAIN_SUMMARY_TAIL: UNCERTAIN_SUMMARY_TAIL,
    AGREEMENT_ONE_FALLBACK: AGREEMENT_ONE_FALLBACK,
    SENDS_IN_WORDS: SENDS_IN_WORDS,
    COLUMN_LABELS: COLUMN_LABELS,
    PROGRESS: PROGRESS,
  };
  return api;
})();

// The const above is a top-level BINDING, not a window property, so the alias
// below is what makes window.CaptionsFixerUI resolve at all — the same
// arrangement, for the same reason, as captions-fixer-orchestrator.js:448.
window.CaptionsFixerUI = CaptionsFixerUI;
