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
 * changing one phrase's text, reverting it, and serialising the lot. Nothing
 * else.
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
    BAD_RESULT: "bad-result",
    NOT_LOADED: "not-loaded",
  });

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
   *         speaker, offsetMs, durationMs, confidence,  // never written after load
   *         text,        // current — the person's, once edited
   *         sourceText,  // as transcribed — never written after load
   *       }
   *     ],
   *     speakerNames: {},   // register item 46 fills it
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
   * `speakerNames` AND `suggestions` ARE DECLARED HERE AND WRITTEN BY NOTHING
   * IN THIS UNIT. They are declared so that register items 46 and 47 add a
   * value to an existing shape rather than adding a shape — a serialised object
   * written today deserialises unchanged once either of them is built, and
   * neither item has to decide where its data lives while it is also deciding
   * what its data is. `speakerNames` is a map keyed by speaker number precisely
   * so item 46's rename touches ONE entry rather than every row that speaker
   * appears on. No function in this file reads or writes either one, and none
   * should be added here until the item that needs it is being built.
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
      return {
        // Carried through untouched. None of these is written after load;
        // re-attribution (register item 46) will change `speaker`, and that is
        // that item's decision to make, not a capability opened here.
        speaker: phrase ? phrase.speaker : null,
        offsetMs: phrase ? phrase.offsetMs : 0,
        durationMs: phrase ? phrase.durationMs : 0,
        confidence: phrase ? phrase.confidence : null,
        text: text,
        sourceText: text,
      };
    });

    state = {
      phrases: phrases,
      // Declared, never written by this unit — see the shape note above.
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

  /**
   * A plain, JSON-safe object holding everything this module knows.
   *
   * THE PERSISTENCE SEAM, AND NOTHING CALLS IT YET. It exists now because the
   * shape it writes is decided by this unit whether or not this unit decides it
   * deliberately: register items 46 and 47 add values to `speakerNames` and
   * `suggestions`, both of which are already in the object, so neither has to
   * invent a container or migrate an object written before it existed.
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
      phrases: state.phrases.map((phrase) => ({
        speaker: phrase.speaker,
        offsetMs: phrase.offsetMs,
        durationMs: phrase.durationMs,
        confidence: phrase.confidence,
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
        return {
          speaker: phrase ? phrase.speaker : null,
          offsetMs: phrase ? phrase.offsetMs : 0,
          durationMs: phrase ? phrase.durationMs : 0,
          confidence: phrase ? phrase.confidence : null,
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
