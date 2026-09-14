/**
 * @file openrouter-embed-transcribe-state.js
 * @description The mutable transcript state for register item 45 of
 * openrouter-embed/docs/foundry-f2-pending-doc-updates.md — transcript
 * correction. Register items 46, 47 and 48 read from it.
 *
 * WHAT THIS MODULE OWNS
 * ---------------------
 * One transcript, held so it can be changed after it was rendered. Adopting a
 * `transcribe` result, handing back a result-shaped view of the current text,
 * changing one phrase's text, reverting it, naming and re-attributing speakers,
 * and serialising the lot. Nothing else.
 *
 * SINCE REGISTER ITEM 46 UNIT 7a IT ALSO OWNS WHICH SLOT EACH LINE IS IN, and
 * that is a widening of the sentence above rather than a new module: the phrase
 * array was already state, and `speaker` has joined `text` as a field a person can
 * change. Two arrival records — `sourceText` and `sourceSpeaker` — are what make
 * both changes reversible and both markers honest. See RE-ATTRIBUTION below.
 *
 * WHY IT EXISTS AT ALL. Today the phrase array is RENDER INPUT: produced by
 * `normaliseSpeechResponse`, read by two pure formatters, never written to.
 * Item 45 makes it STATE — something that changes after the render, that
 * several consumers must see the current version of, and that a later feature
 * can change again. Without one owner for it, the renderer, both formatters,
 * the speaker map (item 46) and the suggestion list (item 47) would each end up
 * holding their own copy of a result, and a correction would reach some of them
 * and not others.
 *
 * WHAT IT DELIBERATELY DOES NOT OWN — READ BEFORE EXTENDING
 * --------------------------------------------------------
 * IT SPEAKS TO NOTHING, and it writes no DOM. No live regions, no
 * announcements, no notifications, no focus changes, no element lookups. This
 * is the same boundary openrouter-embed-transcribe.js draws and for the same
 * reason: a caller decides what the user hears, and AGENTS.md § Announcements
 * is emphatic that a toast already announces through the shared announcer, so a
 * caller pairing a notify*() with an announce() for one event speaks it twice.
 * Keeping every voice out of this module makes that the caller's single
 * decision rather than a shared one.
 *
 * IT KNOWS NOTHING ABOUT DISPLAY OPTIONS. Whether timestamps or speaker labels
 * are shown is a screen decision owned by openrouter-embed-transcribe-ui.js
 * (register item 54's standing constraint is that the screen's timestamp
 * setting never reaches the clipboard or either download). A display flag
 * stored here would be a second place that decision lives.
 *
 * THERE ARE NO SUBSCRIBERS AND NO CHANGE EVENTS, DELIBERATELY. A caller changes
 * the state and then calls the render. A listener list would put the ordering
 * inside this module, where a later feature could not see it, and would make a
 * single correction capable of triggering an unbounded number of re-renders.
 *
 * @module OpenRouterEmbedTranscribeState
 * @since 8 September 2026
 */
const OpenRouterEmbedTranscribeState = (function () {
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
      console.error(`[EmbedTranscribeState] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedTranscribeState] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedTranscribeState] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedTranscribeState] ${message}`, ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  /**
   * Refusal codes, carried on the thrown Error as `err.code`.
   *
   * A frozen const object rather than bare strings, per AGENTS.md § Language &
   * Code Conventions: a caller comparing against `ERRORS.BAD_INDEX` cannot
   * misspell the literal, and a test asserting on one is asserting on the same
   * value the module throws rather than on a string typed twice.
   */
  const ERRORS = Object.freeze({
    BAD_INDEX: "bad-index",
    BAD_TEXT: "bad-text",
    BAD_SPEAKER: "bad-speaker",
    BAD_NAME: "bad-name",
    BAD_RESULT: "bad-result",
    NOT_LOADED: "not-loaded",
    // A SEPARATE CODE FROM BAD_SPEAKER, AND THE DISTINCTION IS THE POINT.
    // "there is no such slot" and "that slot still has lines in it" call for
    // different remedies — the first is a caller bug, the second is something a
    // person can fix by moving the lines — so a caller must be able to tell them
    // apart without parsing a message. Added at register item 46 unit 7a for
    // `removeSpeaker`, which is the only thrower of it.
    SPEAKER_IN_USE: "speaker-in-use",
  });

  /**
   * The control-character ranges a speaker name may not contain, as numeric
   * code points: C0 is U+0000 to U+001F, then DEL at U+007F and C1 up to
   * U+009F. `setSpeakerName` refuses a name containing any of them.
   *
   * NUMBERS RATHER THAN A REGEX, AND THAT IS NOT A STYLE CHOICE. This block
   * first shipped as a regex literal, and the unicode escapes in it were
   * converted into REAL CONTROL BYTES on their way into this file — a NUL, a
   * DEL and two others. Git then classified the whole module as binary, which
   * makes every future diff of it unreviewable, and the resulting character
   * class was STILL SEMANTICALLY CORRECT, so nothing about the code looked
   * wrong. The mechanism of the conversion was not isolated and is not
   * guessed at here.
   *
   * AGENTS.md § Diagnosis Discipline: an escape sequence that passed through
   * anything on its way into a file must be proved to have arrived. The
   * cheapest way to prove it is to use no escape at all, which is what these
   * three integers are for.
   */
  const CONTROL_C0_MAX = 0x1f;
  const CONTROL_C1_MIN = 0x7f;
  const CONTROL_C1_MAX = 0x9f;

  /**
   * Whether a string contains any control character.
   *
   * A CHARACTER-CODE SCAN RATHER THAN A REGEX TEST, for the reason the range
   * constants above give. It reads every code unit rather than stopping at the
   * first non-control one, because a control character in the MIDDLE of a name
   * is the dangerous case — an interior line break splits an SRT cue.
   *
   * @param {string} value
   * @returns {boolean}
   */
  function hasControlCharacter(value) {
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code <= CONTROL_C0_MAX) return true;
      if (code >= CONTROL_C1_MIN && code <= CONTROL_C1_MAX) return true;
    }
    return false;
  }

  /**
   * The separator `normaliseSpeechResponse` joins combined text with, and the
   * one js/testing/transcribe-fixture-loader.js joins phrase text with. Named
   * because the composition below has to match both, and a bare " " at the join
   * site says nothing about which decision it is honouring.
   */
  const COMBINED_TEXT_SEPARATOR = " ";

  /**
   * Bumped only when the serialised shape changes in a way a previously-written
   * object could not be read as. Nothing writes a serialised object anywhere
   * yet, so nothing depends on this value today — it exists so that the day
   * something does, the field is already there to key a migration on.
   */
  const SERIALISED_VERSION = 1;

  // ==========================================================================
  // MODULE STATE
  // ==========================================================================

  /**
   * The one transcript, or null when nothing has been loaded.
   *
   * SHAPE, and the two declared-but-unwritten keys are the point of writing it
   * out here:
   *
   *   {
   *     phrases: [
   *       {
   *         offsetMs, durationMs, confidence,  // never written after load
   *         speaker,        // current — the slot the line is in, once moved
   *         sourceSpeaker,  // as transcribed — never written after load
   *         text,           // current — the person's, once edited
   *         sourceText,     // as transcribed — never written after load
   *       }
   *     ],
   *     speakerNames: {},   // item 46 unit 3 fills it; "" is a real entry
   *     suggestions: [],    // register item 47 fills it
   *     meta: { fileName, backend, durationMs },
   *     raw,                // the service's own payload, untouched
   *     serviceCombinedText, // `result.text` as it arrived — never written after load
   *   }
   *
   * `serviceCombinedText` IS NOT A DERIVED VALUE AND CANNOT BE REGENERATED.
   * `normaliseSpeechResponse` composes `result.text` from Azure's
   * `combinedPhrases` array, which is a SECOND array in the reply and is not
   * the one held in `phrases` — so joining the phrase text gives a different
   * string, and on a result with NO phrases it gives the empty one. It is
   * stored here because `snapshot` needs it for exactly that case; see the
   * snapshot JSDoc for which branch reads it.
   *
   * `speakerNames` IS NOW WRITTEN — by `setSpeakerName`, and read by
   * `speakerNames()`, both added at register item 46 unit 3 (12 September 2026).
   * It is ALSO written by `addSpeaker` and `removeSpeaker`, added at unit 7a, so
   * `setSpeakerName` is the only writer of a NAME and no longer the only writer of
   * the map. `suggestions` IS STILL DECLARED AND WRITTEN BY NOTHING, awaiting
   * item 47.
   *
   * `sourceSpeaker` IS THE SECOND ARRIVAL RECORD AND IT MIRRORS `sourceText`
   * EXACTLY, added at register item 46 unit 7a (13 September 2026). It is the
   * slot the service put the line in, written once at load and never again, and
   * it is what makes `isReassigned` derivable rather than stored — so a line
   * moved BACK to where the service put it stops reading as moved, with no
   * bookkeeping to get wrong. Design section 5: "Each line also remembers the
   * speaker it arrived with, exactly as it already remembers the words it arrived
   * with. That is what makes undo possible and what makes the marker honest."
   *
   * WITHDRAWN, QUOTED IN PLACE per register items 51 and 56, because it was true
   * when written and this unit is what made it false. The SHAPE block above then
   * listed `speaker` among the keys "never written after load", and the load site
   * carried the matching sentence:
   *
   *   "re-attribution (register item 46) will change `speaker`, and that is that
   *    item's decision to make, not a capability opened here."
   *
   * That was a CONDITION and it is now discharged rather than broken: item 46 is
   * the item, unit 7a is where the decision was made, and `setSpeaker` is the
   * sanctioned front door it opens. `speaker` is now a CURRENT value and
   * `sourceSpeaker` is the one that is never written after load.
   *
   * WITHDRAWN, QUOTED IN PLACE per register items 51 and 56, because it was true
   * when written and this unit is what made it false:
   *
   *   "`speakerNames` AND `suggestions` ARE DECLARED HERE AND WRITTEN BY NOTHING
   *    IN THIS UNIT. … No function in this file reads or writes either one, and
   *    none should be added here until the item that needs it is being built."
   *
   * The arrangement it describes did exactly what it was for, and that is worth
   * keeping rather than deleting: both keys were declared so that items 46 and
   * 47 add a VALUE to an existing shape rather than adding a shape — so a
   * serialised object written before this unit deserialises unchanged after it,
   * and this unit had only to decide what its data was, never where it lived.
   * `speakerNames` is a map keyed by speaker number precisely so a rename
   * touches ONE entry rather than every row that speaker appears on, which is
   * what `setSpeakerName` now does.
   *
   * THE CLOSING INSTRUCTION IS DISCHARGED, NOT BROKEN. "None should be added
   * here until the item that needs it is being built" was a condition, and item
   * 46 is that item. It still holds for `suggestions`.
   *
   * AN ENTRY MAY BE THE EMPTY STRING. A slot created by `addSpeaker` carries an
   * empty name, and clearing a name writes the empty string back, so the map
   * records which slots EXIST as well as which are NAMED. `setSpeakerName` never
   * deletes a key; `removeSpeaker` is the only deleter, and both were built
   * knowing the other existed.
   *
   * SO EVERY READ OF THIS MAP MUST USE `hasOwnProperty` AND NEVER TRUTHINESS.
   * `""` is a present entry and is falsy, so `if (speakerNames[n])` answers
   * "unnamed" and "does not exist" identically — which is correct for DISPLAY,
   * where `speakerDisplayName` prints `Speaker N` for both on purpose, and wrong
   * for EXISTENCE, which is what `setSpeaker` and `removeSpeaker` ask.
   */
  let state = null;

  // ==========================================================================
  // REFUSALS
  // ==========================================================================

  /**
   * Compose a refusal. Throwing rather than returning a sentinel, because every
   * refusal here means the caller asked for something that does not exist, and
   * a silently-ignored write is the failure mode this module is least able to
   * make visible later.
   *
   * @param {string} code - one of ERRORS
   * @param {string} message
   * @returns {Error}
   */
  function refusal(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
  }

  /**
   * Guard the methods that read or write a loaded transcript.
   *
   * DELIBERATELY NOT APPLIED TO EVERY EXPORT, and the split is stated rather
   * than left to be discovered: `isLoaded`, `count`, `reset`, `load` and
   * `deserialise` answer questions that are meaningful with nothing loaded, and
   * making them throw would force every caller to ask `isLoaded()` first before
   * it could ask anything at all. `count()` returns 0, which is the honest
   * answer to "how many phrases are there" when there are none.
   *
   * @throws {Error} code ERRORS.NOT_LOADED
   */
  function assertLoaded() {
    if (state === null) {
      throw refusal(
        ERRORS.NOT_LOADED,
        "No transcript has been loaded. Call load(result) first.",
      );
    }
  }

  /**
   * Resolve an index, or refuse it.
   *
   * `Number.isInteger` rather than a range test alone: `setText(0.5, "a")` and
   * `setText("0", "a")` are both caller mistakes, and both would otherwise
   * either silently miss or silently coerce.
   *
   * @param {number} index
   * @returns {number}
   * @throws {Error} code ERRORS.BAD_INDEX
   */
  function assertIndex(index) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= state.phrases.length
    ) {
      throw refusal(
        ERRORS.BAD_INDEX,
        `Phrase index ${String(index)} is not in 0..${state.phrases.length - 1}.`,
      );
    }
    return index;
  }

  // ==========================================================================
  // COMBINED TEXT
  // ==========================================================================

  /**
   * The combined transcript, composed from the CURRENT phrase text.
   *
   * WHAT HEAD DOES, AND WHY THIS IS NOT THE SAME COMPOSITION.
   * `normaliseSpeechResponse` builds `result.text` from Azure's own
   * `combinedPhrases` array, NOT from `phrases` — read it in
   * openrouter-embed-transcribe.js at `normaliseSpeechResponse`. That is a
   * source this module does not hold in `phrases` and cannot regenerate from
   * them: two different arrays in the service's reply, joined the same way.
   * So on a REAL Azure result an unedited snapshot's `text` is NOT guaranteed
   * byte-identical to the original — it is guaranteed only where the two
   * sources agree.
   *
   * NOTHING IS LOST BY THAT. The original arrives untouched in `raw`, which is
   * carried through this module unchanged, so `raw.combinedPhrases` still holds
   * exactly what the service said. A caller that needs the service's own
   * combined text reads it there rather than from a second copy kept here.
   *
   * ON THE FIXTURE THE TWO ARE IDENTICAL BY CONSTRUCTION.
   * js/testing/transcribe-fixture-loader.js has no `combinedPhrases` to work
   * from and composes `text` as exactly this join over the phrases, so the
   * fixture round-trips byte-for-byte. That is a property of the fixture, not
   * evidence about the service.
   *
   * WHICH SHIPPED CONSUMERS READ `result.text`, AND WHY THIS FUNCTION IS NOT
   * ALLOWED TO ANSWER FOR THEM. It is read in exactly two places, both of them
   * the no-phrases fallback: `toPlainText` returns it when
   * `phrases.length === 0`, and the renderer in
   * openrouter-embed-transcribe-ui.js writes it into a `<p>` under the same
   * condition. A state object WITH phrases reaches neither branch, so for a
   * populated transcript this join is regenerated because it is part of the
   * result shape and a stale one would be a lie, not because anything
   * downstream is reading it.
   *
   * A state object with NO phrases reaches BOTH branches, and this function
   * returns `""` for it — which would send those two consumers down the empty
   * path where a real result sends them down the populated one. That case is
   * therefore NOT answered here: `snapshot` returns the stored
   * `serviceCombinedText` instead, and this function is never called for it.
   *
   * @param {Array} phrases
   * @returns {string}
   */
  function composeCombinedText(phrases) {
    return phrases
      .map((phrase) => phrase.text)
      .filter(Boolean)
      .join(COMBINED_TEXT_SEPARATOR)
      .trim();
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Adopt a `transcribe` result. Replaces anything already held.
   *
   * EVERY PHRASE IS COPIED INTO A FRESH OBJECT rather than referenced. The
   * result belongs to whoever produced it and may be rendered elsewhere; a
   * correction that reached back into it would change a value under a consumer
   * that never asked to be written to.
   *
   * `sourceText` IS SET HERE AND NEVER AGAIN. It is what the service
   * transcribed, and it is what `revert` restores, so a second write to it
   * would quietly redefine "as transcribed" as "as last corrected".
   *
   * `sourceSpeaker` IS THE SAME CONTRACT FOR THE SLOT, added at register item 46
   * unit 7a. It is what `isReassigned` compares against. Note the ASYMMETRY with
   * `sourceText`, which is deliberate and is recorded at `revert`: there is a
   * `revert` for the text and there is NO `revertSpeaker`, so `sourceSpeaker` is
   * read by the derived tests and restored by nothing.
   *
   * @param {object} result - the normalised shape, `{ text, phrases, durationMs, raw, backend }`
   * @param {object} [options]
   * @param {string|null} [options.fileName=null] - the audio file's name. It is
   *   NOT on the result — the UI holds it separately — so it is passed in here
   *   rather than dug out of anywhere.
   * @returns {number} the phrase count
   * @throws {Error} code ERRORS.BAD_RESULT
   */
  function load(result, { fileName = null } = {}) {
    if (!result || typeof result !== "object" || !Array.isArray(result.phrases)) {
      throw refusal(
        ERRORS.BAD_RESULT,
        "A transcript result must be an object with a phrases array.",
      );
    }

    const phrases = result.phrases.map((phrase) => {
      const text = phrase && phrase.text !== undefined ? phrase.text : "";
      // READ ONCE INTO A LOCAL, THEN WRITTEN TWICE. Reading `phrase.speaker`
      // twice would be two reads of a caller's object with our own code in
      // between, so `speaker` and `sourceSpeaker` could in principle disagree at
      // load — which is the one moment they are guaranteed to be equal, and the
      // moment `isReassigned` depends on them being equal. `sourceText` takes the
      // same treatment above and for the same reason.
      const speaker = phrase ? phrase.speaker : null;
      return {
        // Carried through untouched, and none of these is written after load.
        //
        // WITHDRAWN 13 September 2026 AT REGISTER ITEM 46 UNIT 7a, quoted in the
        // MODULE STATE shape note above rather than here, because that is where a
        // reader meets the claim. `speaker` was in this list and is not any more:
        // `setSpeaker` writes it, and `sourceSpeaker` is the key that now carries
        // the never-written-after-load guarantee.
        offsetMs: phrase ? phrase.offsetMs : 0,
        durationMs: phrase ? phrase.durationMs : 0,
        confidence: phrase ? phrase.confidence : null,
        speaker: speaker,
        // AS TRANSCRIBED, SET HERE AND NEVER AGAIN — the same contract
        // `sourceText` has one line below, for the same reason: it is what
        // `isReassigned` compares against, so a second write to it would quietly
        // redefine "as transcribed" as "as last moved" and the marker would go
        // silent on a line that had been moved.
        sourceSpeaker: speaker,
        text: text,
        sourceText: text,
      };
    });

    state = {
      phrases: phrases,
      // Loading REPLACES the names map rather than carrying one over: a name
      // belongs to the transcript it was given for, and a new result is a
      // different recording whose speaker numbers mean something else. Written
      // by `setSpeakerName`; `suggestions` is still written by nothing, awaiting
      // register item 47.
      speakerNames: {},
      suggestions: [],
      meta: {
        fileName: fileName,
        backend: result.backend !== undefined ? result.backend : null,
        durationMs: Number(result.durationMs) || 0,
      },
      // The service's own payload, held so nothing normalising away is lost.
      // AN EDIT NEVER UPDATES IT: it is a record of what arrived, and rewriting
      // it to match a correction would destroy the only copy of what was
      // actually transcribed.
      raw: result.raw !== undefined ? result.raw : null,
      // The combined text AS THE SERVICE SENT IT, stored verbatim and never
      // written again. NOT a derived value: `normaliseSpeechResponse` composes
      // it from `combinedPhrases`, a different array from `phrases`, so no
      // join over the phrases held here can reproduce it. `snapshot` reads it
      // only on the no-phrases branch — see its JSDoc.
      //
      // A typeof test rather than an `!== undefined` one, because a non-string
      // `text` is not the service's combined text and `""` is the honest
      // reading of it. Coercing would put "undefined" or "[object Object]"
      // into a field two consumers render straight to the screen.
      serviceCombinedText: typeof result.text === "string" ? result.text : "",
    };

    logInfo(`loaded ${phrases.length} phrases (backend ${state.meta.backend})`);
    return phrases.length;
  }

  /**
   * A result-shaped view of the current state.
   *
   * RESULT-SHAPED ON PURPOSE — `{ text, phrases, durationMs, raw, backend }`,
   * the exact shape `normaliseSpeechResponse` produces — so the renderer,
   * `toPlainText` and `toSrt` all take it unchanged. Any other shape would mean
   * a second rendering path, which is the divergence item 43's single-resolver
   * decision exists to prevent.
   *
   * The phrases carry `sourceText` as well as `text`. That is an ADDITION to
   * the result shape and not a change to it: every field the formatters read is
   * present and current, and an extra key is invisible to them.
   *
   * `text` HAS TWO SOURCES, AND WHICH ONE IS USED DEPENDS ON THE PHRASE COUNT.
   * The limitation note on `composeCombinedText` above still stands and is what
   * makes this necessary — read it first.
   *
   *   phrases.length  >  0  the regenerated join over the CURRENT phrase text,
   *                         so a correction is visible in the snapshot. On a
   *                         real Azure result this is not byte-identical to
   *                         what the service sent, because the two are composed
   *                         from different arrays; the service's own version is
   *                         still in `raw.combinedPhrases` for anyone who wants
   *                         it.
   *   phrases.length === 0  the stored `serviceCombinedText`, VERBATIM.
   *
   * WHY THE EMPTY CASE CANNOT USE THE JOIN. Joining an empty array gives `""`,
   * and `""` is not a neutral value here — it is the value that flips the two
   * shipped no-phrases fallbacks. `toPlainText` returns `result.text || ""`
   * when `phrases.length === 0`, and the renderer in
   * openrouter-embed-transcribe-ui.js writes the same field into a `<p>` under
   * the same condition. A snapshot of a zero-phrase result would therefore send
   * both of them down the empty path where the original result sends them down
   * the populated one — the transcript would render blank. There is nothing to
   * regenerate from in that state, so the only honest answer is the one that
   * arrived.
   *
   * NO POPULATED STATE CHANGES BEHAVIOUR. The branch is reachable only at a
   * phrase count of zero, which is a state no correction can produce: nothing
   * in this module adds or removes phrases.
   *
   * @returns {{text: string, phrases: Array, durationMs: number, raw: object, backend: string}}
   * @throws {Error} code ERRORS.NOT_LOADED
   */
  function snapshot() {
    assertLoaded();
    return {
      text:
        state.phrases.length > 0
          ? composeCombinedText(state.phrases)
          : state.serviceCombinedText,
      phrases: state.phrases,
      durationMs: state.meta.durationMs,
      raw: state.raw,
      backend: state.meta.backend,
    };
  }

  /**
   * One phrase, or null.
   *
   * NULL ON A MISS, NEVER UNDEFINED. `undefined` is what a plain array index
   * returns for a hole and for an out-of-range read alike, so a caller that
   * gets it cannot tell "no such phrase" from "the state is not what I think it
   * is". `null` is a value this module chose to return.
   *
   * @param {number} index
   * @returns {object|null}
   * @throws {Error} code ERRORS.NOT_LOADED
   */
  function phraseAt(index) {
    assertLoaded();
    if (!Number.isInteger(index) || index < 0 || index >= state.phrases.length) {
      return null;
    }
    return state.phrases[index];
  }

  /**
   * How many phrases are held. 0 when nothing is loaded, which is the honest
   * answer rather than a refusal — see assertLoaded.
   * @returns {number}
   */
  function count() {
    return state === null ? 0 : state.phrases.length;
  }

  /**
   * Correct one phrase's text. THE ONLY WRITER OF PHRASE TEXT.
   *
   * IT TRIMS NOTHING. A person's correction is theirs, and a trailing space
   * they typed is not this module's to remove — quietly normalising input is
   * how an edit comes to differ from what the person believes they saved.
   *
   * @param {number} index
   * @param {string} text
   * @returns {{changed: boolean, previous: string}} `changed` is false when the
   *   new text equals the old, so a caller can skip a re-render it does not
   *   need. This is AGENTS.md's "write if changed" answered at the state rather
   *   than at the DOM.
   *
   *   `setSpeaker` RETURNS A DIFFERENT SHAPE — `{changed: number, indices: []}` —
   *   AND THE DIVERGENCE IS DELIBERATE, noted here as well as there so neither is
   *   later made "consistent" with the other. This function writes ONE row and a
   *   caller wants to know what it replaced; that one is a BULK writer and a
   *   caller wants to know WHICH rows to repaint, so a boolean would lose the set
   *   and a `previous` would be a parallel array nobody reads.
   * @throws {Error} code ERRORS.NOT_LOADED, ERRORS.BAD_INDEX or ERRORS.BAD_TEXT
   */
  function setText(index, text) {
    assertLoaded();
    // The index is checked BEFORE the text, so a call that is wrong in both
    // ways always reports the same code. A refusal whose reason depends on
    // check order is a refusal a caller cannot write a test against.
    assertIndex(index);
    if (typeof text !== "string") {
      throw refusal(
        ERRORS.BAD_TEXT,
        `Phrase text must be a string; got ${typeof text}.`,
      );
    }

    const phrase = state.phrases[index];
    const previous = phrase.text;
    const changed = previous !== text;
    if (changed) {
      phrase.text = text;
      logDebug(`phrase ${index} corrected`);
    }
    return { changed: changed, previous: previous };
  }

  /**
   * Put a phrase back to what the service transcribed.
   *
   * IT RESTORES TEXT ONLY, AND REGISTER ITEM 46 UNIT 7a DELIBERATELY GAVE IT NO
   * SPEAKER SIBLING — recorded as a decision so it is not later read as an
   * oversight and "completed". Design section 5 lists `revertSpeaker` among the
   * seven additions; 7a built six of them and this is the one it did not.
   *
   * THE REASON IS THAT THE GESTURE ALREADY EXISTS. Moving a line back to the
   * speaker the machine gave it is `setSpeaker([index], sourceSpeaker)` — a
   * gesture a person already has, through the same picker they used to move it in
   * the first place — and `isReassigned` then reads false again by comparison,
   * with nothing to undo. A second undo with DIFFERENT semantics on the same row
   * is how a destructive surprise gets in: `revert` throws away typed words, and a
   * control sitting beside it that silently also moved the line would be the one
   * nobody expected.
   *
   * SO THIS FUNCTION IS UNCHANGED BY 7a, WHICH IS WHY THE ASYMMETRY IS WORTH
   * NAMING HERE. `sourceText` has a restorer and `sourceSpeaker` does not; both
   * are read by a derived test. A reader meeting only `load` would expect two
   * restorers.
   *
   * @param {number} index
   * @returns {{changed: boolean, previous: string}}
   * @throws {Error} code ERRORS.NOT_LOADED or ERRORS.BAD_INDEX
   */
  function revert(index) {
    assertLoaded();
    assertIndex(index);

    const phrase = state.phrases[index];
    const previous = phrase.text;
    const changed = previous !== phrase.sourceText;
    if (changed) {
      phrase.text = phrase.sourceText;
      logDebug(`phrase ${index} reverted`);
    }
    return { changed: changed, previous: previous };
  }

  /**
   * Whether a phrase differs from what was transcribed.
   *
   * A DERIVED ANSWER, NEVER A STORED FLAG. A boolean set alongside the write
   * is a second copy of the same fact, and the two would disagree the first
   * time anybody edited a phrase back to its original wording by hand — which
   * is exactly the case where "edited" should read false.
   *
   * IT ANSWERS ABOUT TEXT ONLY, AND SINCE REGISTER ITEM 46 UNIT 7a THAT IS A
   * DISTINCTION RATHER THAN THE WHOLE STORY. `isReassigned` is its sibling for the
   * SLOT, built on the same comparison against an arrival record. A row can be
   * both, either or neither, and a caller asking "has this line changed" must ask
   * both — design section 3 fixes the order the two markers are spoken in, and 7b
   * owns it.
   *
   * @param {number} index
   * @returns {boolean}
   * @throws {Error} code ERRORS.NOT_LOADED or ERRORS.BAD_INDEX
   */
  function isEdited(index) {
    assertLoaded();
    assertIndex(index);
    const phrase = state.phrases[index];
    return phrase.text !== phrase.sourceText;
  }

  /**
   * How many phrases differ from what was transcribed.
   * @returns {number}
   * @throws {Error} code ERRORS.NOT_LOADED
   */
  function editedCount() {
    assertLoaded();
    return state.phrases.filter((phrase) => phrase.text !== phrase.sourceText)
      .length;
  }

  // ==========================================================================
  // RE-ATTRIBUTION — register item 46 unit 7a
  // ==========================================================================
  //
  // FOUR WRITERS AND TWO DERIVED READERS, AND NOT ONE OF THEM TOUCHES THE DOM.
  // The controls, the repaint and the moved marker are unit 7b; nothing calls any
  // of this after 7a, so SETTING A SPEAKER CHANGES NO PIXEL AND NO DOWNLOADED
  // BYTE. That is this unit's own check rather than a caveat about it.
  //
  // LINES ARE NEVER ADDED OR REMOVED, and that guarantee is load-bearing rather
  // than incidental. `snapshot`'s zero-phrase branch is unreachable precisely
  // because nothing in this module splices the list, and `composeCombinedText`
  // says so at length; a reassignment changes a FIELD on a line that already
  // exists, so neither claim is weakened here.

  /**
   * Whether `speaker` names a slot that EXISTS.
   *
   * A slot exists when some phrase carries its number, OR when the names map
   * holds an entry for it — the two halves of the question design section 1 says
   * the map answers. `addSpeaker` writing `""` is what makes the second half
   * necessary: a created slot exists before any line has moved into it, and that
   * is exactly the state the merged-voices repair passes through.
   *
   * `hasOwnProperty` AND NEVER TRUTHINESS. `""` is a present entry and is falsy,
   * so `state.speakerNames[speaker]` reads the same for "exists, unnamed" as for
   * "does not exist" — and getting that wrong would make `setSpeaker` refuse the
   * one target `addSpeaker` was built to create. Object keys are strings either
   * way, so a numeric `speaker` matches a `"5"` key without converting anything.
   *
   * @param {number} speaker
   * @returns {boolean}
   */
  function speakerSlotExists(speaker) {
    if (Object.prototype.hasOwnProperty.call(state.speakerNames, speaker)) {
      return true;
    }
    return state.phrases.some((phrase) => phrase.speaker === speaker);
  }

  /**
   * Refuse a speaker that is not a whole number 0 or greater.
   *
   * Split out because three functions here ask it and `setSpeakerName` already
   * asked it inline. `Number.isInteger` rather than a range test alone, for
   * `assertIndex`'s reason: `"5"` and `5.5` are both caller mistakes and both
   * would otherwise silently coerce or silently miss.
   *
   * NO 1-BASED ASSUMPTION IS EMBEDDED, and `addSpeaker` is why. Azure's labels
   * have always arrived 1-based, but `addSpeaker` picks the next unused slot from
   * what the transcript holds, so a module refusing 0 would be encoding a
   * service's habit as a rule.
   *
   * @param {number} speaker
   * @throws {Error} code ERRORS.BAD_SPEAKER
   */
  function assertSpeakerNumber(speaker) {
    if (!Number.isInteger(speaker) || speaker < 0) {
      throw refusal(
        ERRORS.BAD_SPEAKER,
        `Speaker must be a whole number 0 or greater; got ${String(speaker)}.`,
      );
    }
  }

  /**
   * Move lines to an existing speaker slot. THE ONLY WRITER OF `speaker`.
   *
   * ONE BULK WRITER RATHER THAN A SINGLE-LINE ONE, because the gesture is a bulk
   * gesture: a person ticks rows and presses Apply. A per-line writer would make
   * the controller loop, and a loop is where a half-applied write comes from.
   *
   * IT IS ATOMIC, IN TWO PASSES — CHECK ALL, THEN WRITE ALL. This is the sharpest
   * decision in the function and it is worth stating why. A bulk move that
   * half-applied on a bad index in the middle would be the worst outcome
   * available: the caller sees a refusal, the transcript is already half changed,
   * and NOTHING RECORDS WHICH HALF. The refusal itself cannot reveal it — a thrown
   * error carries no account of the writes that preceded it — so the only place
   * the atomicity can live is here.
   *
   * VALIDATION ORDER IS INDICES THEN SPEAKER, mirroring `setText`'s stated rule
   * that the first parameter is checked first, so a call wrong in both ways always
   * reports the same code and a caller can write a test against it.
   *
   * AN EMPTY ARRAY IS A NO-OP AND NOT A REFUSAL. The controller should not have to
   * guard a pressed button with nothing ticked. THE CONCESSION IS EXACTLY AS WIDE
   * AS ITS REASON AND NO WIDER: the SPEAKER is still validated on an empty call,
   * because a caller naming a slot that does not exist has made a mistake whether
   * or not any rows were selected, and swallowing it would hide a controller bug
   * behind a gesture that looks like it did nothing on purpose.
   *
   * A TARGET MUST BE AN EXISTING SLOT, so assignment can never create a speaker by
   * accident — design section 5. This is where `addSpeaker`'s empty-name entry
   * earns its keep: it is what makes a created slot a valid target before any line
   * has moved into it.
   *
   * @param {number[]} indices - the phrase indices to move. May be empty.
   * @param {number} speaker - an EXISTING slot number.
   * @returns {{changed: number, indices: number[]}} `changed` is how many lines
   *   actually moved, and `indices` are which — the rows whose speaker differed,
   *   in the order given, with duplicates and already-there rows absent.
   *
   *   THE SHAPE DIVERGES FROM `setText`'s `{changed, previous}` ON PURPOSE, and
   *   the divergence is noted at BOTH functions so neither is later made
   *   "consistent" with the other. Unit 7b's `patchRows` needs the SET of rows to
   *   repaint, not a count, and it needs one row further than that — see the
   *   ON_CHANGE note below. A bulk `previous` would be a parallel array nobody
   *   reads.
   *
   *   THE RETURNED SET IS NOT THE SET TO REPAINT. Unit 7b must repaint each moved
   *   row AND THE ONE AFTER IT, because `ON_CHANGE` label suppression reads the
   *   previous row's speaker through `previousSpeakerAt`, so moving row 12 can
   *   change whether row 13 prints a label at all. Recorded here because this is
   *   where a caller gets the set from and where the wrong assumption would be
   *   made.
   * @throws {Error} code ERRORS.NOT_LOADED, ERRORS.BAD_INDEX or ERRORS.BAD_SPEAKER
   */
  function setSpeaker(indices, speaker) {
    assertLoaded();

    if (!Array.isArray(indices)) {
      throw refusal(
        ERRORS.BAD_INDEX,
        `Phrase indices must be an array; got ${typeof indices}.`,
      );
    }

    // PASS ONE — CHECK EVERYTHING. Nothing below this block writes, and nothing
    // above it does either.
    //
    // THE OFFENDING INDEX IS NAMED IN THE MESSAGE, not merely its range. A caller
    // holding forty indices cannot find the bad one otherwise, and `assertIndex`'s
    // message reports the value it was given, so it is reused rather than
    // reworded — one refusal text for one condition, wherever it is raised.
    indices.forEach((index) => assertIndex(index));

    assertSpeakerNumber(speaker);
    if (!speakerSlotExists(speaker)) {
      throw refusal(
        ERRORS.BAD_SPEAKER,
        `Speaker ${String(speaker)} is not a slot that exists. ` +
          `Call addSpeaker() first to open one.`,
      );
    }

    // PASS TWO — WRITE. Every index is known good and the target is known to
    // exist, so nothing here can throw and leave the transcript half moved.
    const moved = [];
    indices.forEach((index) => {
      const phrase = state.phrases[index];
      if (phrase.speaker === speaker) return;
      phrase.speaker = speaker;
      moved.push(index);
    });

    // ONCE PER GESTURE, NOT ONCE PER PHRASE — the rule `setSpeakerName` states for
    // a rename, and it matters more here: a person can tick 657 rows.
    if (moved.length > 0) {
      logDebug(`${moved.length} phrase(s) moved to speaker ${speaker}`);
    }
    return { changed: moved.length, indices: moved };
  }

  /**
   * Open the next unused speaker slot and return its number.
   *
   * IT WRITES AN EMPTY NAME, which is what makes the slot EXIST before any line
   * carries it — the state design section 1 requires and the one `setSpeaker`
   * tests for. Without the write there would be nothing to distinguish a created
   * slot from a number nobody has used, and `setSpeaker` would refuse the target
   * it was just given.
   *
   * NEXT UNUSED IS ONE ABOVE THE HIGHEST IN USE, COUNTING BOTH SOURCES — the
   * phrases and the names map. Counting only the phrases would return the same
   * number twice in a row, because the first call's slot carries no lines.
   *
   * WITH NOTHING IN USE AT ALL IT RETURNS 1, AND THAT IS A DISPLAY CONVENTION
   * RATHER THAN A CLAIM ABOUT THE SERVICE. `Speaker 1` reads better than
   * `Speaker 0`; nothing here asserts that Azure never emits 0, and
   * `assertSpeakerNumber` accepts 0 deliberately for that reason. The two are
   * consistent: this function never MINTS 0, and every function here ACCEPTS one.
   *
   * @returns {number} the new slot number
   * @throws {Error} code ERRORS.NOT_LOADED
   */
  function addSpeaker() {
    assertLoaded();

    let highest = null;
    state.phrases.forEach((phrase) => {
      // A phrase's speaker may be null — `load` defaults it that way for a
      // malformed phrase, and a non-diarised result carries no speaker at all.
      // Neither is a slot number, so neither may raise the ceiling.
      if (!Number.isInteger(phrase.speaker)) return;
      if (highest === null || phrase.speaker > highest) highest = phrase.speaker;
    });
    Object.keys(state.speakerNames).forEach((key) => {
      // Object keys are strings, so this is where they come back to numbers. A
      // key that is not a whole number is not a slot and is skipped rather than
      // coerced — `Number("")` is 0 and `Number("1.5")` is 1.5, and either would
      // corrupt the ceiling silently.
      const asNumber = Number(key);
      if (!Number.isInteger(asNumber) || asNumber < 0) return;
      if (highest === null || asNumber > highest) highest = asNumber;
    });

    const created = highest === null ? 1 : highest + 1;
    state.speakerNames[created] = "";
    logDebug(`speaker slot ${created} created`);
    return created;
  }

  /**
   * Remove a speaker slot. THE ONLY DELETER OF A NAMES-MAP KEY.
   *
   * It exists because `setSpeakerName` deliberately does not delete: clearing a
   * name writes `""` and keeps the key, so that clearing a created slot's name
   * cannot delete the slot and strand the lines sitting in it. That decision is
   * recorded at `setSpeakerName` and in design section 2; this is its other half.
   *
   * TWO REFUSALS, AND THE SEPARATE CODE IS THE WHOLE POINT OF `SPEAKER_IN_USE`.
   * "No such slot" is a caller bug; "still has lines" is something a person can
   * fix by moving them. A caller must be able to tell those apart without reading
   * a message.
   *
   * A DIVERGENCE FROM THE DESIGN, IMPLEMENTED AS THE DISPATCH SPECIFIES AND
   * FLAGGED RATHER THAN CHOSEN SILENTLY. Design section 1 says "A slot you
   * created, that has no name and no lines, can be removed … A slot the machine
   * found is never removable", and section 5 says it refuses "when the slot has
   * lines or the machine created it" — THREE tests. Unit 7a's dispatch specifies
   * TWO: exists, and empty. The difference is real and reaches a real gesture: if
   * the machine SPLIT one person across slots 1 and 3 and the person moves all of
   * slot 3's lines into slot 1, the two-test rule lets them retire the empty slot
   * and the three-test rule leaves the picker offering `Speaker 3` forever.
   *
   * THE TWO-TEST RULE IS BUILT, FOR TWO REASONS AND NEITHER IS THAT THE DESIGN IS
   * WRONG. The dispatch is the later document and is the build instruction; and
   * the third test would forbid the split-voice repair above, which is a decision
   * for the desk rather than for this function. `sourceSpeaker` makes the
   * machine-origin test derivable — a machine-found slot is one some phrase's
   * `sourceSpeaker` names — so adding it later costs one predicate and needs no
   * new data. FLAGGED IN THIS UNIT'S REPORT for the desk to settle; nothing here
   * should be read as having settled it.
   *
   * @param {number} speaker
   * @returns {{changed: boolean, previous: string}} the same shape
   *   `setSpeakerName` returns. `changed` is always true on success and `previous`
   *   is the name the removed slot carried — which may be `""`, the ordinary case
   *   for a slot `addSpeaker` created and nobody named.
   *
   *   `changed` CANNOT BE FALSE HERE, and that is a property of the refusals
   *   rather than a wasted field. A slot with no names key and no lines does not
   *   exist, so it refuses; a slot with lines refuses; so anything reaching the
   *   delete HAS a key. The field is present so a caller can treat this return
   *   like `setSpeakerName`'s without a special case.
   * @throws {Error} code ERRORS.NOT_LOADED, ERRORS.BAD_SPEAKER or
   *   ERRORS.SPEAKER_IN_USE
   */
  function removeSpeaker(speaker) {
    assertLoaded();
    assertSpeakerNumber(speaker);

    if (!speakerSlotExists(speaker)) {
      throw refusal(
        ERRORS.BAD_SPEAKER,
        `Speaker ${String(speaker)} is not a slot that exists.`,
      );
    }

    // THE IN-USE TEST READS THE CURRENT `speaker`, NEVER `sourceSpeaker`. The
    // question is where the lines are NOW — a line the service put in this slot
    // and a person has since moved out is not stranded by removing it.
    const linesInSlot = state.phrases.filter(
      (phrase) => phrase.speaker === speaker,
    ).length;
    if (linesInSlot > 0) {
      throw refusal(
        ERRORS.SPEAKER_IN_USE,
        `Speaker ${String(speaker)} still has ${linesInSlot} line(s) in it. ` +
          `Move them to another speaker first.`,
      );
    }

    const previous =
      typeof state.speakerNames[speaker] === "string"
        ? state.speakerNames[speaker]
        : "";
    delete state.speakerNames[speaker];
    logDebug(`speaker slot ${speaker} removed`);
    return { changed: true, previous: previous };
  }

  /**
   * Whether a phrase is in a different slot from the one it arrived in.
   *
   * A DERIVED ANSWER, NEVER A STORED FLAG, for `isEdited`'s reason exactly: a
   * boolean set alongside the write is a second copy of the same fact, and the two
   * would disagree the first time anybody moved a line BACK to where the service
   * put it — which is precisely the case where "moved" should read false. Design
   * section 5 calls that "what makes the marker honest", and it is why the module
   * remembers an arrival rather than keeping a change log.
   *
   * GUARD ORDER AND REFUSAL CODES MIRROR `isEdited` EXACTLY — `assertLoaded` then
   * `assertIndex` — so the two tests a row asks about behave identically.
   *
   * @param {number} index
   * @returns {boolean}
   * @throws {Error} code ERRORS.NOT_LOADED or ERRORS.BAD_INDEX
   */
  function isReassigned(index) {
    assertLoaded();
    assertIndex(index);
    const phrase = state.phrases[index];
    return phrase.speaker !== phrase.sourceSpeaker;
  }

  /**
   * How many phrases are in a different slot from the one they arrived in.
   * Mirrors `editedCount`.
   * @returns {number}
   * @throws {Error} code ERRORS.NOT_LOADED
   */
  function reassignedCount() {
    assertLoaded();
    return state.phrases.filter(
      (phrase) => phrase.speaker !== phrase.sourceSpeaker,
    ).length;
  }

  /**
   * A copy of the names map, keyed by speaker number.
   *
   * A COPY, NEVER THE LIVE OBJECT, for the reason `serialise` already gives: a
   * caller holding a reference into live state sees it change under them after
   * they thought they had read it. The map is a flat number-to-string object, so
   * one level of copying is the whole of it.
   *
   * THE READER WITHOUT WHICH THE CONTROLLER HAS NO ROUTE TO THE MAP. Revision 1
   * of the design specified six writers and nothing that read, so the
   * controller was to fill a map it could not inspect. Register item 46's
   * design section 5 records the omission and this is the repair.
   *
   * AN ENTRY MAY BE THE EMPTY STRING, AND THAT IS A STATE RATHER THAN A GAP.
   * A slot created by `addSpeaker` carries an empty name, and clearing a name
   * writes the empty string back, so the map answers two questions at once —
   * which slots exist, and which of those are named. A caller must not read a
   * present-but-empty entry as an absent one; `speakerDisplayName` in
   * openrouter-embed-transcribe.js already treats both as unnamed and prints
   * `Speaker N` for each, which is what makes the two indistinguishable on
   * screen while staying distinguishable here.
   *
   * @returns {object} a copy of the names map, keyed by speaker number
   * @throws {Error} code ERRORS.NOT_LOADED
   */
  function speakerNames() {
    assertLoaded();
    return Object.assign({}, state.speakerNames);
  }

  /**
   * Name a speaker slot, or clear the name back to the number. THE ONLY WRITER
   * OF THE NAMES MAP.
   *
   * IT TRIMS, AND `setText` DOES NOT — A DELIBERATE DIVERGENCE, NOTED HERE AND
   * IN THE DESIGN SO NEITHER IS LATER MADE "CONSISTENT" WITH THE OTHER. A
   * phrase correction is the person's own words and a trailing space they typed
   * is not ours to remove. A name is not somebody's words: it is a label
   * printed beside a colon in two file formats, and `Amira :` is a defect
   * rather than an authorial choice.
   *
   * CLEARING WRITES THE EMPTY STRING AND NEVER REMOVES THE KEY. A name that
   * trims to nothing is the clear — there is no separate operation and no
   * refusal for it. Removing the key would delete a slot `addSpeaker` created
   * and strand any line sitting in it, because the map records which slots
   * exist as well as which are named. `removeSpeaker` is the only deleter.
   *
   * TRIMMING DOES NOT MAKE THE CONTROL-CHARACTER REFUSAL REDUNDANT, and the
   * order matters: `trim()` touches the ENDS only, so `"Ami\nra"` survives it
   * intact — and an interior newline is precisely the dangerous one. A speaker
   * name is the first string a person authors that reaches the SRT file, where
   * a newline splits a cue, and 0 of the 657 committed fixture phrases contain
   * one, so nothing upstream has ever had to guard it.
   *
   * A REFUSED NAME WRITES NOTHING. The guard runs before the assignment, so a
   * caller that catches the refusal is looking at the map it had before —
   * nothing in a thrown error could reveal a write that had already happened.
   *
   * `-->` WAS CONSIDERED AND IS DELIBERATELY NOT REFUSED, recorded so it is not
   * re-litigated as an oversight. A lenient parser could misread a text line
   * containing it as a timing line, but the caption lane's `TIMESTAMP_PATTERN`
   * is anchored on two or more leading digits and would not match, and refusing
   * ordinary punctuation inside a person's name is a worse failure than the
   * risk it avoids.
   *
   * NO LENGTH CAP, stated as a decision rather than left as an absence. A cap
   * is a policy nobody has asked for, and it would silently truncate somebody's
   * name.
   *
   * @param {number} speaker - the slot number. `Number.isInteger` and `>= 0`,
   *   rather than a range test alone, for `assertIndex`'s reason:
   *   `setSpeakerName("5", "Amira")` and `setSpeakerName(5.5, "Amira")` are both
   *   caller mistakes and both would otherwise silently coerce or silently miss.
   *   NO 1-BASED ASSUMPTION IS EMBEDDED. Azure's labels have always arrived
   *   1-based and every measured fixture phrase carries 1 or above, but
   *   `addSpeaker` picks the next unused slot from what the transcript holds, so
   *   a module refusing 0 would be encoding a service's habit as a rule.
   * @param {string} name - trimmed before use; a name that trims to nothing is
   *   the clear.
   * @returns {{changed: boolean, previous: string}} the same shape `setText`
   *   returns, so a caller can skip a repaint it does not need — AGENTS.md's
   *   "write if changed" answered at the state rather than at the DOM.
   *   `previous` is `""` where there was no entry, so the return alone cannot
   *   tell a clear from a no-op; that is deliberate, because nothing needs to.
   * @throws {Error} code ERRORS.NOT_LOADED, ERRORS.BAD_SPEAKER or ERRORS.BAD_NAME
   */
  function setSpeakerName(speaker, name) {
    assertLoaded();
    // The speaker is checked BEFORE the name, mirroring setText's stated rule:
    // a call that is wrong in both ways always reports the same code, because a
    // refusal whose reason depends on check order is one a caller cannot write
    // a test against.
    if (!Number.isInteger(speaker) || speaker < 0) {
      throw refusal(
        ERRORS.BAD_SPEAKER,
        `Speaker must be a whole number 0 or greater; got ${String(speaker)}.`,
      );
    }
    if (typeof name !== "string") {
      throw refusal(
        ERRORS.BAD_NAME,
        `A speaker name must be a string; got ${typeof name}.`,
      );
    }

    const trimmed = name.trim();
    // An empty result is the CLEAR, not a refusal — so the control-character
    // test is skipped for it. There is nothing left in it to test.
    if (trimmed !== "" && hasControlCharacter(trimmed)) {
      throw refusal(
        ERRORS.BAD_NAME,
        "A speaker name may not contain a control character.",
      );
    }

    const previous =
      typeof state.speakerNames[speaker] === "string"
        ? state.speakerNames[speaker]
        : "";
    const changed = previous !== trimmed;
    if (changed) {
      state.speakerNames[speaker] = trimmed;
      // Once per rename, not once per phrase — unlike speakerDisplayName, which
      // has no logging for exactly that reason.
      logDebug(`speaker ${speaker} named ${trimmed === "" ? "(cleared)" : trimmed}`);
    }
    return { changed: changed, previous: previous };
  }

  /**
   * A plain, JSON-safe object holding everything this module knows.
   *
   * THE PERSISTENCE SEAM, AND NOTHING CALLS IT YET. It exists now because the
   * shape it writes was decided by item 45 whether or not that unit decided it
   * deliberately: register items 46 and 47 add values to `speakerNames` and
   * `suggestions`, both of which were already in the object, so neither had to
   * invent a container or migrate an object written before it existed. ITEM 46
   * HAS NOW CASHED THAT IN — `speakerNames` is written, and this function needed
   * no change at all to carry it.
   *
   * AND UNIT 7a IS WHERE THAT LUCK RAN OUT, WHICH IS THE PART WORTH READING.
   * `sourceSpeaker` is a new key on the PHRASE, and this function copies phrase
   * keys EXPLICITLY BY NAME rather than spreading — so a key added to the live
   * shape does NOT reach a stored object unless somebody adds it here too. Design
   * section 5 caught that as a correction before the unit was built, and its
   * account of the consequence is exact: a stored object written without
   * `sourceSpeaker` restores with it `undefined`, a derived `isReassigned`
   * compares `speaker` against `undefined`, and EVERY LINE IN THE TRANSCRIPT
   * READS AS MOVED. The honest-marker guarantee inverted on a whole document.
   *
   * SO TWO EDITS WERE NEEDED, NOT ONE: the key added here, and the fallback added
   * at `deserialise`. Either alone is insufficient — this one without that one
   * writes a key nothing defends against being absent, and that one without this
   * one defends a key nothing ever writes.
   *
   * NO DATA WAS AT RISK when this landed, because nothing writes a serialised
   * object anywhere yet: saving is register item 75 and stays deferred. THE
   * `deserialise` FALLBACK WAS STILL BUILT NOW rather than left to that item, and
   * unit 7a's console sheet exercises it deliberately by deleting the key from a
   * serialised object — because a defect that is unreachable today and catastrophic
   * the day it is reached is exactly the kind that ships.
   *
   * `SERIALISED_VERSION` IS DELIBERATELY NOT BUMPED, for the reason the
   * `serviceCombinedText` note below already gives and which applies unchanged: an
   * ADDED field is not a shape a previously-written object could not be read as,
   * and the `deserialise` fallback is what makes that true rather than merely
   * hoped.
   *
   * IT IS NOT SANITISED, AND `deserialise` IS NOT EITHER — A DECISION, NOT AN
   * OMISSION. A stored names map is accepted wholesale, so a restored file could
   * in principle carry an untrimmed or control-character name that
   * `setSpeakerName` would have refused. Nothing writes a serialised object
   * anywhere yet, so the branch is unreachable, and building an untested
   * sanitiser into a path nothing exercises is the wrong trade. Its home is
   * REGISTER ITEM 75, where persistence gets a real stored shape to migrate.
   *
   * It returns a DEEP COPY of the phrases, so a caller cannot hold a reference
   * into live state and see it change under them after they serialised it.
   *
   * @returns {object}
   * @throws {Error} code ERRORS.NOT_LOADED
   */
  function serialise() {
    assertLoaded();
    return {
      version: SERIALISED_VERSION,
      // SEVEN NAMED KEYS SINCE REGISTER ITEM 46 UNIT 7a, NOT SIX. Named
      // explicitly rather than spread, which is the decision that makes this list
      // a thing somebody has to remember to extend — see the JSDoc above, which
      // records the defect that omitting `sourceSpeaker` here would have caused.
      phrases: state.phrases.map((phrase) => ({
        offsetMs: phrase.offsetMs,
        durationMs: phrase.durationMs,
        confidence: phrase.confidence,
        speaker: phrase.speaker,
        sourceSpeaker: phrase.sourceSpeaker,
        text: phrase.text,
        sourceText: phrase.sourceText,
      })),
      speakerNames: Object.assign({}, state.speakerNames),
      suggestions: state.suggestions.slice(),
      meta: {
        fileName: state.meta.fileName,
        backend: state.meta.backend,
        durationMs: state.meta.durationMs,
      },
      raw: state.raw,
      // Carried because it cannot be rebuilt from anything else in this object
      // — see the load-site comment. Without it a round trip over a ZERO-PHRASE
      // state would come back with an empty `text`, which is the exact defect
      // the snapshot branch exists to prevent, reintroduced through the
      // persistence seam.
      //
      // SERIALISED_VERSION IS DELIBERATELY NOT BUMPED. Its rule is a shape
      // change a previously-written object could not be read as; this is an
      // added field, an object lacking it still deserialises, and — as that
      // constant's own note records — nothing has ever written a serialised
      // object anywhere, so there is no earlier shape in existence to migrate.
      serviceCombinedText: state.serviceCombinedText,
    };
  }

  /**
   * The inverse of serialise. Replaces anything already held. Nothing calls it
   * yet, for the reason serialise gives.
   *
   * IT DOES NOT RE-DERIVE `sourceText` FROM `text`, and that is the whole point
   * of the round trip. A restore that set `sourceText = text` would silently
   * adopt every correction as if the service had transcribed it, so `revert`
   * would afterwards do nothing and the person could no longer see what they
   * had changed. Where a stored phrase carries no `sourceText` — a shape this
   * module has never written — `text` is the only honest fallback, and that
   * case is the one to grow a version migration for rather than to widen here.
   *
   * THE SAME HOLDS FOR `sourceSpeaker`, added at register item 46 unit 7a, and
   * NOTE THE TWO FALLBACKS ARE NOT THE SAME KIND OF THING even though they are the
   * same line of code. `sourceText`'s fallback covers a shape this module has
   * never written. `sourceSpeaker`'s covers a shape this module DID write — every
   * serialised object produced before unit 7a — so it is a real migration rather
   * than a defensive default, and it is the one thing standing between a restored
   * file and a transcript where every line reads as moved.
   *
   * @param {object} stored - as produced by serialise
   * @returns {number} the phrase count
   * @throws {Error} code ERRORS.BAD_RESULT
   */
  function deserialise(stored) {
    if (!stored || typeof stored !== "object" || !Array.isArray(stored.phrases)) {
      throw refusal(
        ERRORS.BAD_RESULT,
        "A serialised transcript must be an object with a phrases array.",
      );
    }

    const meta = stored.meta && typeof stored.meta === "object" ? stored.meta : {};

    state = {
      phrases: stored.phrases.map((phrase) => {
        const text = phrase && phrase.text !== undefined ? phrase.text : "";
        const speaker = phrase ? phrase.speaker : null;
        return {
          offsetMs: phrase ? phrase.offsetMs : 0,
          durationMs: phrase ? phrase.durationMs : 0,
          confidence: phrase ? phrase.confidence : null,
          speaker: speaker,
          // THE FALLBACK THAT STOPS A WHOLE TRANSCRIPT READING AS MOVED. Added at
          // register item 46 unit 7a, and it is the treatment `sourceText` has one
          // line below, for a reason of exactly the same shape: a stored object
          // written before this key existed must restore as UNMOVED, not as
          // moved-from-undefined. Design section 5 measured the consequence of
          // omitting it — `isReassigned` compares against `undefined`, every line
          // reads as moved, and the honest-marker guarantee is inverted on the
          // whole document.
          //
          // `!== undefined` RATHER THAN A TRUTHINESS TEST, because 0 and null are
          // both legitimate stored speakers: `load` defaults a malformed phrase's
          // speaker to null, and `assertSpeakerNumber` accepts 0 on purpose.
          sourceSpeaker:
            phrase && phrase.sourceSpeaker !== undefined
              ? phrase.sourceSpeaker
              : speaker,
          text: text,
          sourceText:
            phrase && phrase.sourceText !== undefined ? phrase.sourceText : text,
        };
      }),
      speakerNames:
        stored.speakerNames && typeof stored.speakerNames === "object"
          ? Object.assign({}, stored.speakerNames)
          : {},
      suggestions: Array.isArray(stored.suggestions)
        ? stored.suggestions.slice()
        : [],
      meta: {
        fileName: meta.fileName !== undefined ? meta.fileName : null,
        backend: meta.backend !== undefined ? meta.backend : null,
        durationMs: Number(meta.durationMs) || 0,
      },
      raw: stored.raw !== undefined ? stored.raw : null,
      // Same typeof test as the load site, for the same reason. An object
      // written before this field existed restores as `""`, which for a
      // populated state costs nothing — `snapshot` regenerates that branch —
      // and for a zero-phrase state is the only honest answer available, since
      // there is nothing left to recover the text from.
      serviceCombinedText:
        typeof stored.serviceCombinedText === "string"
          ? stored.serviceCombinedText
          : "",
    };

    logInfo(`deserialised ${state.phrases.length} phrases`);
    return state.phrases.length;
  }

  /**
   * Back to holding nothing.
   * @returns {void}
   */
  function reset() {
    state = null;
    logDebug("reset");
  }

  /**
   * Whether a transcript is held.
   * @returns {boolean}
   */
  function isLoaded() {
    return state !== null;
  }

  logInfo("Transcribe state module loaded");

  return {
    load: load,
    snapshot: snapshot,
    phraseAt: phraseAt,
    count: count,
    setText: setText,
    revert: revert,
    isEdited: isEdited,
    editedCount: editedCount,
    speakerNames: speakerNames,
    setSpeakerName: setSpeakerName,
    // RE-ATTRIBUTION — register item 46 unit 7a. Five entries, and the two
    // internal helpers (`speakerSlotExists`, `assertSpeakerNumber`) are
    // deliberately NOT exported: they are this module's own reading of what a slot
    // is, and a caller answering that question for itself is how two answers come
    // to exist. Ask `speakerNames()` and look.
    setSpeaker: setSpeaker,
    addSpeaker: addSpeaker,
    removeSpeaker: removeSpeaker,
    isReassigned: isReassigned,
    reassignedCount: reassignedCount,
    serialise: serialise,
    deserialise: deserialise,
    reset: reset,
    isLoaded: isLoaded,
    ERRORS: ERRORS,
  };
})();

// The const above is a top-level BINDING, not a window property, so this alias
// is what makes window.OpenRouterEmbedTranscribeState resolve at all. Without
// it the bare identifier would still work while every
// window.OpenRouterEmbedTranscribeState reference read undefined — the trap
// AGENTS.md § Announcements records for ALLY_UI_MANAGER, UniversalModal and
// UniversalNotifications, all three of which are top-level const declarations,
// so a console probe or a driven harness reaching them through window silently
// instruments nothing. openrouter-embed-transcribe.js carries the same alias
// for the same reason.
window.OpenRouterEmbedTranscribeState = OpenRouterEmbedTranscribeState;
