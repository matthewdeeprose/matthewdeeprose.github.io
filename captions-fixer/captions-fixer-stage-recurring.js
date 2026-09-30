/**
 * CAPTIONS FIXER — THE RECURRING STAGE (Stage 6).
 *
 * The one stage Release 1 ships, and the only one that spends. Two steps,
 * because a person approves between them:
 *
 *   discover(cueList, context) => { pairs, raw, model, usage, usageRaw, discarded }
 *       ONE send, the whole transcript, no ids and no timestamps, asking for
 *       the terms the recogniser probably got wrong EVERY time the speaker
 *       said them.
 *   expand(cueList, approvedPairs) => changeSet
 *       PURE. Whole-word, case-preserving replacement of the pairs a person
 *       approved; one entry per affected cue.
 *
 * `run(cueList, context)` ties the two together for the orchestrator: discover,
 * persist, hand the pairs to `context.onPairs`, expand what comes back. Absent
 * an `onPairs`, it stops with `halted: "awaiting-approval"` and the pairs on
 * disk — a person has to see them, and a stage that guessed would be applying
 * unreviewed model output to somebody's lecture.
 *
 * PERSIST BEFORE YOU PARSE, AND WHAT THAT CAN AND CANNOT MEAN HERE
 * ---------------------------------------------------------------
 * The rule is that anything paid for reaches disk the instant it arrives, so a
 * parse failure cannot lose a send. `discover` honours it in both directions:
 *
 *   - On success it calls `context.persist({ pairsRaw })` with the reply text
 *     BEFORE it validates a single pair, and `context.persist({ pairs })` only
 *     afterwards. Two calls, in that order, and the suite proves the order with
 *     a sequence counter rather than trusting this comment.
 *   - On a PARSE REJECTION it persists the raw too, out of the `catch`, before
 *     rethrowing. `CaptionsFixerLLM.complete` attaches `raw` to its parse error
 *     for exactly this, and that path is the one where losing the bytes would
 *     actually cost money.
 *
 * WHAT IT CANNOT DO, said plainly rather than glossed: the adapter's own
 * `JSON.parse` happens INSIDE `complete`, so nothing here can get in front of
 * it without reaching into Stage 4's file, which is out of this stage's scope.
 * The dispatch asked for a persist "before JSON.parse"; what is delivered is a
 * persist before anything THIS module parses, plus a persist on the failure
 * path that carries the same bytes. The guarantee the rule exists for — no
 * paid-for reply is lost — holds either way; the ordering claim is narrower
 * than the dispatch's wording and is stated here so nobody reads more into it.
 *
 * THE PROMPT IS THE PRODUCT
 * -------------------------
 * `SYSTEM_PROMPT` is a frozen string built from six blocks in a fixed order —
 * role, task, the conservative instruction, the number rule, the speaker-label
 * rule, the glossary block — followed by the shape block. `buildSystemPrompt`
 * takes a glossary so Release 2 drops its terms in without a prompt change; the
 * block is present and says "none supplied" in Release 1 rather than being
 * absent, so the prefix a model caches does not change shape when it arrives.
 *
 * BLOCK 2 WAS CHANGED AT STAGE 7c AND THE CHANGE WAS WITHDRAWN ON MEASUREMENT.
 * The block below is the Stage 7b text, byte for byte, and `SYSTEM_PROMPT`
 * hashes to cf-2's own digest. Round cf-3 is why; see BLOCK_TASK, and do not
 * re-add the withdrawn sentence without reading that round first.
 *
 * IT DOES NOT END WITH `JSON_ONLY_INSTRUCTION`, AND THAT IS DELIBERATE.
 * `CaptionsFixerLLM.complete` appends that block itself (its `systemPrompt`
 * parameter is documented "prompt WITHOUT the JSON instruction"), so carrying
 * it here would send it twice. The suite proves both halves: this string does
 * NOT contain it, and the prompt the adapter actually sends DOES end with it.
 *
 * EXPAND IS DETERMINISTIC AND DULL ON PURPOSE
 * -------------------------------------------
 * Word boundaries treat apostrophes and hyphens as INSIDE a word, so `oiler`
 * matches neither `boiler` nor `oiler-type`. Matching is case-insensitive and
 * the case of the match decides the replacement:
 *
 *   ALL CAPS    -> the replacement upper-cased
 *   Capitalised -> the replacement with its first letter upper-cased
 *   all lower   -> the replacement AS GIVEN
 *   mixed       -> the replacement AS GIVEN
 *
 * The lower-case row is the one worth reading twice. `{ from: "oiler", to:
 * "Euler" }` on a lower-case `oiler` yields `Euler`, not `euler`, because `to`
 * is a proper noun and lower-casing it would introduce a second error while
 * fixing the first. The rule is therefore "never remove case the replacement
 * carries, only add case the match demands", which is what the dispatch's own
 * verification 5 asks for.
 *
 * Pure data. No DOM, no voice, no announcement, no live region, no storage of
 * its own — every write goes through the `persist` the orchestrator hands it.
 *
 * A PLAIN script publishing window.CaptionsFixerStageRecurring. It resolves
 * `window.CaptionsFixerLLM` at CALL time, never at load, for the load-order
 * reason recorded in captions-fixer-llm.js's own header.
 *
 * @module CaptionsFixerStageRecurring
 * @since 7 September 2026
 */
const CaptionsFixerStageRecurring = (function () {
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[CaptionsFixerStageRecurring]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[CaptionsFixerStageRecurring]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[CaptionsFixerStageRecurring]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[CaptionsFixerStageRecurring]", message, ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  /** The stage's name, as it appears in a tally and in a halt reason. */
  const STAGE_NAME = "recurring";

  /** The `source` every entry this stage produces carries. */
  const SOURCE = "recurring";

  /** The `status` every expanded entry starts at: a person already approved it. */
  const STATUS_ACCEPTED = "accepted";

  /**
   * The `confidence` an expanded entry carries. A person approved the pair and
   * the replacement is a deterministic whole-word substitution, so there is no
   * residual uncertainty for this field to express; 1 records that rather than
   * leaving a field of the agreed shape empty.
   */
  const RECURRING_CONFIDENCE = 1;

  /** Every field a change-set entry carries, and nothing else. */
  const CHANGE_SET_FIELDS = Object.freeze([
    "cueId",
    "original",
    "proposed",
    "source",
    "reason",
    "confidence",
    "status",
    "rejectedBy",
  ]);

  /** Halt reasons this stage can hand back to the orchestrator. */
  const HALTED = Object.freeze({
    AWAITING_APPROVAL: "awaiting-approval",
    CANCELLED: "cancelled",
  });

  /** The record fields this stage writes, both already defined by the store. */
  const FIELD_PAIRS_RAW = "pairsRaw";
  const FIELD_PAIRS = "pairs";

  /**
   * The second send's two fields and the sort's own. All three were added to
   * the store's RECORD_FIELDS at e926ee5, which is what `persist` enforces
   * against; writing one before that commit would have been refused by name.
   */
  const FIELD_PAIRS_RAW_2 = "pairsRaw2";
  const FIELD_PAIRS_2 = "pairs2";
  const FIELD_AGREEMENT = "agreement";

  /**
   * How many discovery sends ONE PASS makes.
   *
   * TWO, and the reason is measured rather than chosen: recall between sends of
   * an identical configuration runs 11 to 15 of 15 (cf-4 and cf-5 read
   * together, n = 6). A correction appearing in only one reply is therefore
   * sometimes a real fix, so a filter that dropped it would lose corruptions
   * the model DID find — which is why the one-reply group exists rather than a
   * discard, and why nothing here is thrown away silently.
   */
  const SENDS_PER_PASS = 2;

  /** Which group a sorted pair fell into. Carried on the pair as `agreement`. */
  const AGREEMENT = Object.freeze({ BOTH: "both", ONE: "one" });

  /**
   * The re-key applied to the SECOND send's `persist`, and the whole reason the
   * second send needs a context of its own.
   *
   * `discover` writes `pairsRaw` before it reads a pair and `pairs` after. Run
   * twice against one context, the second send would land on top of the first
   * and the first reply's bytes — already paid for — would be gone. Mapping the
   * two names is what keeps both on disk, and it is done by wrapping the
   * resolved `persist` out here rather than by changing `discover`, which stays
   * a function that makes ONE send and knows nothing about passes.
   */
  const SECOND_SEND_FIELD_MAP = Object.freeze({
    [FIELD_PAIRS_RAW]: FIELD_PAIRS_RAW_2,
    [FIELD_PAIRS]: FIELD_PAIRS_2,
  });

  /**
   * Joins `from` and `to` into one agreement key. A NUL, because it cannot
   * occur in caption text: joining on nothing would let {from: "ab", to: "c"}
   * and {from: "a", to: "bc"} collide, and the two are different corrections.
   */
  const AGREEMENT_KEY_SEPARATOR = "\u0000";

  /** Splits a glossary textarea into lines. Both endings, and a lone CR. */
  const GLOSSARY_LINE_SEPARATOR = /\r\n|\r|\n/;

  /** Separator between cue texts in the user prompt: one line per cue. */
  const CUE_SEPARATOR = "\n";

  /** Separator between the prompt's blocks. */
  const BLOCK_SEPARATOR = "\n\n";

  /**
   * Separator between the pair sentences in one entry's `reason`, when a cue
   * carries more than one approved pair. A newline, because the Transcribe
   * lane splits `reason` on U+000A to show one block per sentence (register
   * item 47 § 2). Safe because a pair holding a line break is refused in both
   * `discover` and `expand` (`pairHoldsLineBreak`), so this is the only newline
   * a `reason` can carry. The first separator here that is EXPORTED, because a
   * second lane depends on it.
   */
  const REASON_SEPARATOR = "\n";

  /**
   * Either line-ending character, anywhere in a string. Both forms, and a lone
   * CR: a pair arrives from a model reply rather than from the parser, so
   * nothing upstream has normalised its endings.
   */
  const LINE_BREAK_CHARACTERS = /[\r\n]/;

  /**
   * The characters that count as INSIDE a word for the whole-word test.
   * Apostrophes and hyphens are deliberately in the class: `oiler-type` and
   * `Bayes'` are single words, so a pair naming `oiler` or `Bayes` must not
   * reach into either. Both apostrophe forms are listed, because a transcript
   * carries whichever one the recogniser emitted.
   */
  const WORD_CHARACTER_CLASS = "[\\p{L}\\p{N}'’\\-]";

  /** Either apostrophe form, as a character class for the possessive rule. */
  const APOSTROPHE_CLASS = "['’]";

  /**
   * Test for an upper-case letter anywhere in `from`. See POSSESSIVE_NAMES_ONLY.
   * Unicode-aware, so a capital outside ASCII counts.
   */
  const HAS_UPPER_CASE = /\p{Lu}/u;

  /**
   * THE POSSESSIVE BOUNDARY IS APPLIED ONLY TO A `from` THAT CARRIES A CAPITAL,
   * AND THE RESTRICTION IS A DEVIATION FROM STAGE 8b's DECISION 10, TAKEN ON A
   * MEASUREMENT.
   *
   * Decision 10 asks that the boundary after `from` be satisfied by an
   * apostrophe followed by `s`, so `Mary Robertson` finds `Mary Robertson's`.
   * Written without a restriction that rule also reaches CONTRACTIONS, because
   * English spells "X is" and "X has" with the same `'s` as the possessive —
   * and the tool's own fixture is full of them.
   *
   * Measured on captions-fixer/testing/fixtures/capture-2026-09-04.srt,
   * 8 September 2026, before the rule was written:
   *
   *   there's / There's   28 occurrences in 27 cues
   *   it's / It's        115 occurrences
   *   that's / That's     49 occurrences
   *
   * `there → their` is a pair BOTH test suites use, so the unrestricted rule
   * would have rewritten "there's" to "their's" — not a word — in 27 cues of
   * the fixture, and moved the pinned EXPECTED_THERE_CAPTIONS of 71 for a
   * wrong reason. That is precisely the over-correction Stage 8b exists to
   * reduce, manufactured by the stage meant to reduce it.
   *
   * A capital is what separates the two cases without a dictionary. The `'s`
   * ambiguity lives in FUNCTION WORDS — there, it, that, what, who, he, let,
   * here — which a recogniser writes in lower case except at the start of a
   * sentence; a possessive a whole-word replacement can safely reach belongs to
   * a NAME, and the listen's own example is a personal name. So the rule fires
   * for `Mary Robertson`, `Robertson` and `Bayes`, and never for `there`.
   *
   * WHAT IT COSTS, stated rather than left to be discovered: the possessive of
   * a lower-case common noun — "the boiler's temperature" for a pair naming
   * `boiler` — does not get the boundary and is left alone. That is a
   * CONSERVATIVE MISS, which is the side this tool errs on by design, and not
   * the harm the unrestricted rule causes.
   */
  const POSSESSIVE_NAMES_ONLY = true;

  /** Characters a regular expression treats specially, escaped in `from`. */
  const REGEXP_SPECIALS = /[.*+?^${}()|[\]\\]/g;

  // ==========================================================================
  // THE PROMPT
  // ==========================================================================

  /**
   * 1. Who the model is. Named first because everything after it is read in
   *    this role, and a prefix that never changes is what prompt caching sees.
   */
  const BLOCK_ROLE =
    "You are a captioning editor for UK university lecture recordings. " +
    "Below is an automatic speech recogniser's transcript of one lecture, one cue per line, in the order the words were spoken.";

  /**
   * 2. The task, stated as discovery of misrecognised TERMS rather than of edits.
   *
   * THE RECURRENCE RULE WAS REMOVED AT STAGE 7b, ON MEASUREMENT, NOT PREFERENCE.
   * Until then the block ended: "Report a pair only when the same mistake
   * happens more than once, or when the surrounding sentence makes it
   * unmistakable." Round cf-1 (7 September 2026) measured both candidate models
   * ignoring it — `openai/gpt-5.4-mini` reported 9 of 10 injected ONE-OFF
   * corruptions as recurring and `openai/gpt-5.4` reported 5 of 10 — so the
   * sentence bought no conservatism and cost recall on real errors.
   *
   * STAGE 7c PROPOSED TWO FURTHER CHANGES TO THIS BLOCK, MEASURED THEM, AND
   * WITHDREW BOTH. The block below is the Stage 7b text, byte for byte. What was
   * tried, and why it is not here, because the reasoning was good and the result
   * was not:
   *
   *   (a) The opening sentence read "List the terms the recogniser probably got
   *       wrong EVERY TIME the speaker said them", which is a recurrence
   *       requirement of exactly the kind cf-1 measured neither model obeying,
   *       left standing because 7b was reading the end of the block rather than
   *       the start. 7c removed the phrase as a unit.
   *   (b) The block gained a closing sentence: "Do not propose rewording,
   *       reordering, adding or removing words, or adding a number or a symbol,
   *       unless the written words are a clear mishearing of what was said."
   *       Matthew's two listens (8 and 9 September 2026) had run this prompt
   *       against the CLEAN synthetic fixture and got 23 then 19 proposals, most
   *       of them rewrites of text that was already correct.
   *
   * ROUND cf-3 (10 September 2026) MEASURED THE PAIR AND THEY WENT THE WRONG
   * WAY. Same model, same provider, same fixture, minutes apart, one variable:
   * the changed prompt proposed **20** pairs on the CLEAN transcript where this
   * one proposed **4**, and recall on the corrupted transcript did not move
   * (14 of 15 either way). Two of the twenty contradicted themselves in their
   * own `reason` field — one proposing a change while writing "there is no clear
   * error; left unchanged", another while writing "No British/American spelling
   * issue should be reported" — and one proposed replacing a correctly spelled
   * proper noun with a misspelling. Withdrawn on Matthew's ruling the same day.
   *
   * IT IS n = 1 PER CELL AND THAT IS SAID PLAINLY, because it is the reason to
   * re-measure rather than to re-add: the same prompt scored 15 of 15 at cf-2 and
   * 14 of 15 at cf-3 on identical input, so this instrument wobbles. The clean
   * figures, both proposal lists verbatim, both prompt digests and both prompt
   * files are in .claude/measurements/cf-3-clean-transcript/. READ THAT ROUND
   * BEFORE PROPOSING EITHER SENTENCE AGAIN.
   *
   * The `count` key stays in the reply shape below, because a model's own
   * figure is a useful hint about how confident it is. It is NEVER shown to a
   * person as fact and nothing downstream may treat it as one: THE COUNT A
   * PERSON SEES IS MEASURED BY `expand`, which does the replacement and can
   * therefore say how many cues it actually touched.
   *
   * THE cf-1 SENTENCE AND BOTH WITHDRAWN 7c SENTENCES ARE QUOTED ABOVE, SO ALL
   * THREE ARE STILL IN THIS FILE'S SOURCE while none of the three is in the
   * prompt. Any check that a rule is present or absent must read `SYSTEM_PROMPT`
   * — the built string — and never a grep over this file, which a rationale
   * comment satisfies. That is the comment-answering-for-the-code trap in
   * AGENTS.md § Diagnosis Discipline, and it is live here three times over by
   * construction. Note the direction it now runs in: a grep for the withdrawn
   * no-rewriting sentence FINDS it, in this comment, and would read as a
   * withdrawal that never happened.
   */
  const BLOCK_TASK =
    "List the terms the recogniser probably got wrong every time the speaker said them: " +
    "technical terms, proper nouns, module vocabulary and names it has heard as a similar-sounding everyday word. " +
    "Report each one as a pair — the text as written, and what the speaker almost certainly said — " +
    "with how many times you saw it and one short line saying why. " +
    "Report every clear recognition error you are confident of, whether it happens once or many times.";

  /**
   * 3. The conservative instruction, from caption-correction-resource.md § 6
   *    ("Conservative instruction", near :62), reworded for discovery rather
   *    than for correction. The last sentence is § "STEM subjects and spoken
   *    mathematics" rule 1, which is the same instruction pointed at notation.
   */
  const BLOCK_CONSERVATIVE =
    "Be conservative. Propose only clear recognition errors: homophones, misheard technical terms and misheard proper nouns. " +
    "What you propose must sound like the text that is written. " +
    "Never rephrase, never summarise, and never add or remove meaning. " +
    "If you are unsure, leave it out. " +
    "Never convert spoken mathematics into symbols or LaTeX: if a passage looks like garbled mathematics, leave it alone. " +
    "Never propose a change that only swaps British and American spelling: colour and color sound the same and neither is a recognition error.";

  /** 4. Numbers are immutable, in either form. The guards enforce it as well. */
  const BLOCK_NUMBERS =
    "Never propose a change to a number, in digits or in words. " +
    "Leave 0.05, 91,000, twenty five and 25 exactly as they are written, even where the transcript looks wrong.";

  /** 5. Speaker labels are immutable, byte for byte. The guards enforce it too. */
  const BLOCK_SPEAKER_LABELS =
    "Never propose a change to a speaker label. " +
    'A line beginning "Speaker 1: ", "Speaker 2: " and so on carries that label unchanged.';

  /** The glossary block's wording when no glossary has been supplied. */
  const GLOSSARY_NONE = "Known terms for this module: none supplied.";

  /** The glossary block's opening when one has. */
  const GLOSSARY_PREFIX = "Known terms for this module, spelled as they should appear: ";

  /**
   * 7. The shape. It sits AFTER the six blocks and BEFORE the adapter's own
   *    JSON_ONLY_INSTRUCTION, which `complete` appends; see the file header for
   *    why this string must not carry that block itself.
   */
  const BLOCK_SHAPE =
    "Reply with a JSON array at the top level, and nothing else. " +
    'Each element is an object with exactly these keys: "from", the text as written; ' +
    '"to", what the speaker said; "count", a number, how many times you saw it; ' +
    '"reason", one short line. ' +
    "Reply with an empty array if you find nothing worth reporting.";

  /**
   * A glossary textarea's text as a term list: split on line breaks, trimmed,
   * empties dropped, ORDER AND CASE KEPT.
   *
   * Case is kept because the whole point of a known term is its spelling — a
   * glossary that lower-cased "Euler" would be telling the model the opposite
   * of what the person typed. Order is kept so the prompt reads the way they
   * wrote it.
   *
   * AN EMPTY FIELD RETURNS AN EMPTY ARRAY, AND THE CALLER MUST NOT PUT THAT ON
   * THE CONTEXT. `discover` branches on `Array.isArray(ctx.glossary)`, so
   * `glossary: []` takes the buildSystemPrompt path and produces a prompt that
   * is equal to SYSTEM_PROMPT in content but is NOT SYSTEM_PROMPT by identity.
   * Passing no key at all is what keeps the shipped prompt byte-identical and
   * its hash unmoved, which is the condition on an opt-in field shipping
   * without counting as a prompt change.
   *
   * @param {string} text
   * @returns {Array<string>}
   */
  function parseGlossary(text) {
    if (typeof text !== "string") return [];
    return text
      .split(GLOSSARY_LINE_SEPARATOR)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  /**
   * Build the system prompt. The six blocks are always present and always in
   * this order; only the glossary block's contents move.
   *
   * @param {Array<string>} [glossary=[]] terms, spelled as they should appear
   * @returns {string}
   */
  function buildSystemPrompt(glossary) {
    const terms = Array.isArray(glossary) ? glossary.filter((term) => typeof term === "string" && term.trim()) : [];
    const glossaryBlock = terms.length === 0 ? GLOSSARY_NONE : `${GLOSSARY_PREFIX}${terms.join("; ")}.`;
    return [
      BLOCK_ROLE,
      BLOCK_TASK,
      BLOCK_CONSERVATIVE,
      BLOCK_NUMBERS,
      BLOCK_SPEAKER_LABELS,
      glossaryBlock,
      BLOCK_SHAPE,
    ].join(BLOCK_SEPARATOR);
  }

  /** The Release 1 system prompt: the six blocks, with an empty glossary. */
  const SYSTEM_PROMPT = buildSystemPrompt();

  /**
   * The shape `CaptionsFixerLLM.applySchema` filters the reply against. No
   * `idKey`: a discovery send names no cues, so there is no id list to check
   * against and the adapter skips that filter (its own `applySchema` doc says
   * so explicitly). An item missing any of the four keys, or carrying one of
   * the wrong type, is dropped and counted by the adapter.
   */
  const PAIRS_SCHEMA = Object.freeze({
    type: "array",
    items: Object.freeze({
      requiredKeys: Object.freeze(["from", "to", "count", "reason"]),
      types: Object.freeze({ from: "string", to: "string", count: "number", reason: "string" }),
    }),
  });

  /**
   * The transcript as the model sees it: cue text, one line per cue, in file
   * order. NO cue ids and NO timestamps — a discovery send counts recurrences
   * across a whole lecture and has nothing to say about any one cue, so sending
   * ids would only invite the model to propose per-cue edits this stage cannot
   * accept. Speaker labels stay, because the prompt tells the model to leave
   * them alone and removing them would change what it is reading.
   *
   * @param {Array<object>} cueList
   * @returns {string}
   */
  function buildUserPrompt(cueList) {
    if (!Array.isArray(cueList)) {
      throw new TypeError("buildUserPrompt() needs a cue list array.");
    }
    return cueList.map((cue) => (cue && typeof cue.text === "string" ? cue.text : "")).join(CUE_SEPARATOR);
  }

  /**
   * What a WHOLE PASS would cost, through the adapter's own estimator.
   * Exported so the orchestrator can check a spend cap BEFORE this stage runs
   * rather than after it has already sent.
   *
   * A PASS, NOT A SEND, SINCE STAGE 15 — it passes `sends: SENDS_PER_PASS`, so
   * the figure and the tier both describe the two sends `run` makes. The
   * orchestrator's cap reads `costUsd` and the UI gates a confirmation on
   * `tier`, and both would be wrong by half if this reported one send.
   *
   * IT MUST BRANCH ON `glossary` EXACTLY AS `discover` DOES, or the estimate
   * describes a different prompt from the one that goes out. The branch is
   * copied deliberately rather than shared, because `discover` reads it off a
   * context and this reads it off an options object; if either changes, the
   * other has to change with it and this comment is the reason to look.
   *
   * @param {Array<object>} cueList
   * @param {object} [options] `{ model, glossary }`
   * @returns {object|null} the adapter's estimate, or null where it is absent
   */
  function estimateDiscover(cueList, options) {
    const llm = window.CaptionsFixerLLM;
    if (!llm || typeof llm.estimate !== "function") {
      logWarn("estimateDiscover: CaptionsFixerLLM is not on the page");
      return null;
    }
    const opts = options || {};
    return llm.estimate({
      systemPrompt: Array.isArray(opts.glossary) ? buildSystemPrompt(opts.glossary) : SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(cueList),
      model: opts.model,
      pass: llm.PASSES.RECURRING,
      sends: SENDS_PER_PASS,
    });
  }

  // ==========================================================================
  // DISCOVER
  // ==========================================================================

  /**
   * Is this a pair a person could act on? The adapter's schema has already
   * dropped anything missing a key or carrying the wrong type, so the one test
   * left is the one the schema cannot express: a pair that changes nothing.
   *
   * @param {object} pair
   * @returns {boolean}
   */
  function pairChangesSomething(pair) {
    return String(pair.from).toLowerCase() !== String(pair.to).toLowerCase();
  }

  /**
   * Does either half of this pair hold a line break?
   *
   * WHY A PAIR LIKE THAT HAS TO BE REFUSED. A caption's line break is part of
   * the file, and this stage's whole contract is that it changes words and
   * nothing else. A `from` holding a break matches ACROSS the break and the
   * replacement carries whatever the `to` carries in its place — so a pair
   * proposing a space glues two lines into one, with nothing counting the loss:
   * the entry is written `accepted`, `rejectedBy` null, carrying the eight
   * change-set fields and no line-break field of any kind. Measured over the
   * multi-line fixture at the fixture stage: one entry, on the cue where the
   * error straddles the break, one break before and none after. A `to` holding
   * a break is the same damage from the other side — it INSERTS a line into a
   * caption whose timing was written for the lines it had.
   *
   * Refusing it costs a miss, which is the safe side: the straddling cue keeps
   * its error and its break, and a person can still fix it by hand.
   *
   * ONE PREDICATE, TWO CALLERS, AND BOTH REACH IT THROUGH `api`. `discover`
   * drops such a pair into the `dropped` count it already keeps; `expand`
   * refuses it with no count, because `expand` has nowhere to put one and this
   * stage does not invent a record field for it — `RECORD_FIELDS` is untouched.
   * `expand` needs its own refusal rather than trusting `discover`'s: the Apply
   * rebuild in `captions-fixer-ui.js` hands `expand` the approved pairs read
   * back off the table, which never pass through `discover` in that journey.
   *
   * @param {object} pair
   * @returns {boolean}
   */
  function pairHoldsLineBreak(pair) {
    if (!pair) return false;
    return LINE_BREAK_CHARACTERS.test(String(pair.from)) || LINE_BREAK_CHARACTERS.test(String(pair.to));
  }

  /**
   * Persist a patch through the context, without letting a storage failure lose
   * the send. A rejection here is logged and swallowed on purpose: the caller
   * is holding the reply in memory and returning it, so a failed write must not
   * turn a successful, paid-for send into a thrown error with nothing to show.
   *
   * @param {object} context
   * @param {object} patch
   * @returns {Promise<void>}
   */
  async function persistQuietly(context, patch) {
    if (!context || typeof context.persist !== "function") {
      logWarn(`persist: the context carries no persist(); ${Object.keys(patch).join(", ")} not written`);
      return;
    }
    try {
      await context.persist(patch);
    } catch (error) {
      logError(`persist(${Object.keys(patch).join(", ")}) failed: ${error && error.message}`, error);
    }
  }

  /**
   * One discovery send.
   *
   * @param {Array<object>} cueList
   * @param {object} [context] `{ persist, signal, model, glossary }`
   * @returns {Promise<{ pairs: Array<object>, raw: string, model: string, usage: object|null, usageRaw: object|null, discarded: number, dropped: number }>}
   */
  async function discover(cueList, context) {
    if (!Array.isArray(cueList)) {
      throw new TypeError("discover() needs a cue list array.");
    }
    const ctx = context || {};
    const llm = window.CaptionsFixerLLM;
    if (!llm || typeof llm.complete !== "function") {
      throw new Error("discover(): window.CaptionsFixerLLM is not on the page.");
    }

    const systemPrompt = Array.isArray(ctx.glossary) ? buildSystemPrompt(ctx.glossary) : SYSTEM_PROMPT;
    const userPrompt = buildUserPrompt(cueList);

    let reply;
    try {
      reply = await llm.complete({
        systemPrompt: systemPrompt,
        userPrompt: userPrompt,
        schema: PAIRS_SCHEMA,
        model: ctx.model,
        pass: llm.PASSES.RECURRING,
        signal: ctx.signal,
      });
    } catch (error) {
      // THE PATH WHERE LOSING THE BYTES WOULD ACTUALLY COST MONEY. `complete`
      // attaches the raw reply to a parse rejection; write it before the
      // rejection travels any further, so a reply nobody could parse is still
      // on disk to look at.
      if (error && typeof error.raw === "string" && error.raw) {
        await persistQuietly(ctx, { [FIELD_PAIRS_RAW]: error.raw });
      }
      throw error;
    }

    // BEFORE anything here reads a single pair.
    await persistQuietly(ctx, { [FIELD_PAIRS_RAW]: reply.raw });

    const candidates = Array.isArray(reply.data) ? reply.data : [];
    // TWO REFUSALS, ONE COUNT. `dropped` stays a single number and stays the
    // difference between what arrived and what survived, so no figure moves and
    // no record field is added. The two WARNs are kept apart on purpose: the
    // older one names the unchanged case and would be a false sentence about a
    // pair refused for a line break, so it is given the count that is still
    // true of it rather than reworded.
    //
    // Through `api`, so the seam a row inverts is the one both callers use.
    const withoutBreaks = candidates.filter((pair) => !api.pairHoldsLineBreak(pair));
    const refusedForBreak = candidates.length - withoutBreaks.length;
    const pairs = withoutBreaks.filter(pairChangesSomething);
    const dropped = candidates.length - pairs.length;
    if (refusedForBreak > 0) {
      logWarn(`discover: ${refusedForBreak} pair(s) refused for holding a line break in from or to`);
    }
    if (dropped - refusedForBreak > 0) {
      logWarn(`discover: ${dropped - refusedForBreak} pair(s) dropped for proposing the text they matched`);
    }

    await persistQuietly(ctx, { [FIELD_PAIRS]: pairs });

    logInfo(`discover: ${pairs.length} pair(s) from ${reply.model}, ${reply.discarded} discarded, ${dropped} dropped`);
    return {
      pairs: pairs,
      raw: reply.raw,
      model: reply.model,
      usage: reply.usage,
      // Carried through UNTOUCHED from the adapter, added at Stage 7b. The
      // token counts are paid for, so they travel with the reply rather than
      // being re-derived by whoever wants them; the harness writes this to the
      // store beside `pairsRaw`. Nothing in this stage reads it or judges it.
      usageRaw: reply.usageRaw !== undefined ? reply.usageRaw : null,
      discarded: reply.discarded,
      dropped: dropped,
    };
  }

  // ==========================================================================
  // AGREE
  // ==========================================================================

  /**
   * The key two pairs must share to count as the same correction: `from` and
   * `to` TOGETHER, trimmed and lower-cased.
   *
   * BOTH HALVES, AND THAT IS THE WHOLE DESIGN. The same `from` with a different
   * `to` in each reply is TWO pairs in the one-reply group, not one agreed
   * pair — cf-4 measured three sends all wanting to change "more economically
   * resilient countries" with no two agreeing on what to, and that disagreement
   * is exactly what the group exists to show a person. Keying on `from` alone
   * would collapse those three into one and present a replacement only one
   * reply ever proposed as if both had.
   *
   * @param {object} pair
   * @returns {string}
   */
  function agreementKey(pair) {
    const from = pair && pair.from !== undefined && pair.from !== null ? String(pair.from) : "";
    const to = pair && pair.to !== undefined && pair.to !== null ? String(pair.to) : "";
    return `${from.trim().toLowerCase()}${AGREEMENT_KEY_SEPARATOR}${to.trim().toLowerCase()}`;
  }

  /**
   * Sort two replies' pairs into those BOTH proposed and those only ONE did.
   *
   * Pure, and exported, so a row can bind it by inversion without a send.
   *
   * NOTHING IS DISCARDED. Every pair from either reply comes back in one list
   * or the other, which is what makes this a filter on PRESENTATION rather than
   * on content: the agreed pairs go in the main list and the rest into a
   * collapsed group a person can still open and tick.
   *
   * `reason` and `count` come from the first reply that proposed the pair, so
   * an agreed pair carries reply one's wording. The alternative — merging the
   * two reasons — would manufacture a sentence no model wrote.
   *
   * IT DOES NOT DE-DUPLICATE WITHIN A REPLY. If one reply proposes the same
   * correction twice, both copies survive, for the same reason the groups do:
   * this function's job is to sort, and silently dropping a pair would be the
   * one behaviour the whole arrangement exists to avoid. Duplicates are the
   * adapter's schema's business, not this function's.
   *
   * @param {Array<object>} pairsA reply one's pairs
   * @param {Array<object>} pairsB reply two's pairs
   * @returns {{ both: Array<object>, one: Array<object> }}
   */
  function agree(pairsA, pairsB) {
    const listA = Array.isArray(pairsA) ? pairsA : [];
    const listB = Array.isArray(pairsB) ? pairsB : [];
    const keysA = new Set(listA.map(agreementKey));
    const keysB = new Set(listB.map(agreementKey));
    const both = [];
    const one = [];

    listA.forEach((pair) => {
      const agreed = keysB.has(agreementKey(pair));
      const sorted = Object.assign({}, pair, {
        agreement: agreed ? AGREEMENT.BOTH : AGREEMENT.ONE,
      });
      if (agreed) both.push(sorted);
      else one.push(sorted);
    });

    listB.forEach((pair) => {
      // Reply one's copy of an agreed pair is already in `both`, carrying reply
      // one's `reason` and `count`. Adding reply two's would show the person
      // the same correction twice.
      if (keysA.has(agreementKey(pair))) return;
      one.push(Object.assign({}, pair, { agreement: AGREEMENT.ONE }));
    });

    return { both: both, one: one };
  }

  /**
   * The context the SECOND send runs with: everything the first had, and a
   * `persist` that writes the two reply fields under their second-send names.
   *
   * Wrapping the RESOLVED `persist` is deliberate. The orchestrator's
   * `resolvePersist` refuses when there is no key, and where it did so there is
   * no function here to wrap — this returns the context untouched, and
   * `persistQuietly` logs and swallows exactly as it does today rather than
   * this introducing a second way for a missing persist to behave.
   *
   * @param {object} ctx
   * @returns {object}
   */
  function secondSendContext(ctx) {
    const persist = ctx.persist;
    if (typeof persist !== "function") return ctx;
    return Object.assign({}, ctx, {
      persist: function persistForSecondSend(patch) {
        const rekeyed = {};
        // A name the map does not carry passes through UNCHANGED rather than
        // being dropped: dropping it would lose a write this stage did not
        // anticipate, which is the failure mode the map exists to prevent.
        Object.keys(patch).forEach((name) => {
          rekeyed[SECOND_SEND_FIELD_MAP[name] || name] = patch[name];
        });
        return persist(rekeyed);
      },
    });
  }

  // ==========================================================================
  // EXPAND
  // ==========================================================================

  /**
   * Escape a literal string for use inside a regular expression.
   * @param {string} text
   * @returns {string}
   */
  function escapeForRegExp(text) {
    return String(text).replace(REGEXP_SPECIALS, "\\$&");
  }

  /**
   * Does the possessive boundary apply to this `from`? See POSSESSIVE_NAMES_ONLY.
   * @param {string} from
   * @returns {boolean}
   */
  function takesPossessive(from) {
    if (!POSSESSIVE_NAMES_ONLY) return true;
    return HAS_UPPER_CASE.test(String(from));
  }

  /**
   * A whole-word, case-insensitive matcher for one `from`.
   *
   * The boundaries are lookarounds over WORD_CHARACTER_CLASS rather than `\b`,
   * because `\b` treats an apostrophe and a hyphen as boundaries — so `\boiler\b`
   * matches inside `oiler-type`, which is a different word and not the one the
   * person approved.
   *
   * THE TRAILING BOUNDARY HAS A SECOND WAY TO BE SATISFIED, added at Stage 8b:
   * a possessive `'s` that ends the word. So `Mary Robertson` matches inside
   * `Mary Robertson's` and replaces only the name, leaving the `'s` where it
   * was. It still does NOT match `Robertsons`, because the alternative requires
   * an apostrophe, and it still does not match inside `bayes'theorem`, because
   * the `'` there is followed by `t` rather than by `s`.
   *
   * The alternative is a LOOKAHEAD, so the `'s` is never consumed and never
   * replaced — `applyCaseOf` sees only the name, and the possessive survives
   * whatever the replacement is.
   *
   * ORDER MATTERS INSIDE THE ALTERNATION only for readability; the two branches
   * are mutually exclusive, because `'` is itself a word character here, so the
   * plain not-a-word-character branch can never be true where the possessive
   * branch is.
   *
   * @param {string} from
   * @returns {RegExp}
   */
  function wholeWordPattern(from) {
    const notAWordCharacter = `(?!${WORD_CHARACTER_CLASS})`;
    const possessive = `(?=${APOSTROPHE_CLASS}s${notAWordCharacter})`;
    // Through the exported object, so an inversion can withdraw the possessive
    // branch at its one seam rather than at a copy of it.
    const trailing = api.takesPossessive(from)
      ? `(?:${possessive}|${notAWordCharacter})`
      : notAWordCharacter;
    return new RegExp(
      `(?<!${WORD_CHARACTER_CLASS})${escapeForRegExp(from)}${trailing}`,
      "giu",
    );
  }

  /**
   * The replacement text for one match, given the case of the match.
   *
   * Case is only ever ADDED, never removed: a lower-case match takes the
   * replacement exactly as the pair gives it, so `oiler` becomes `Euler` rather
   * than `euler`. See the file header for why.
   *
   * @param {string} matched the text as it appeared in the cue
   * @param {string} replacement the pair's `to`, as given
   * @returns {string}
   */
  function applyCaseOf(matched, replacement) {
    const hasLetters = matched.toLowerCase() !== matched.toUpperCase();
    if (hasLetters && matched === matched.toUpperCase()) return replacement.toUpperCase();
    if (matched === matched.toLowerCase()) return replacement;
    const rest = matched.slice(1);
    const isCapitalised = matched[0] === matched[0].toUpperCase() && rest === rest.toLowerCase();
    if (isCapitalised) return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    return replacement;
  }

  /**
   * A person-readable reason naming the pair and what it did to this cue.
   * @param {object} pair
   * @param {number} occurrences
   * @returns {string}
   */
  function reasonFor(pair, occurrences) {
    const times = occurrences === 1 ? "once" : `${occurrences} times`;
    return `Approved recurring pair: "${pair.from}" to "${pair.to}", ${times} in this cue.`;
  }

  /**
   * Join one cue's pair sentences into its entry's `reason`.
   * @param {Array<string>} reasons one sentence per pair that fired in the cue
   * @returns {string}
   */
  function joinReasons(reasons) {
    return reasons.join(REASON_SEPARATOR);
  }

  /**
   * Apply the approved pairs to a change set.
   *
   * PURE: `cueList` is not written to, and neither is any pair. Every entry is
   * a new object carrying the eight change-set fields and nothing else.
   *
   * @param {Array<object>} cueList
   * @param {Array<object>} approvedPairs `[{ from, to, count, reason }]`
   * @returns {Array<object>} the change set, one entry per affected cue
   */
  function expand(cueList, approvedPairs) {
    if (!Array.isArray(cueList)) {
      throw new TypeError("expand() needs a cue list array.");
    }
    if (!Array.isArray(approvedPairs)) {
      throw new TypeError("expand() needs an array of approved pairs.");
    }

    const usable = [];
    approvedPairs.forEach((pair) => {
      if (!pair || typeof pair.from !== "string" || typeof pair.to !== "string" || !pair.from) {
        logWarn("expand: a pair without a usable from/to was ignored");
        return;
      }
      // BEFORE the pattern is built, and through `api` so the inversion reaches
      // this branch rather than a copy of it. No count: `expand` keeps none and
      // this stage does not add one. The halves are quoted through
      // `JSON.stringify` so the break shows in the log as an escape rather than
      // splitting the line it is being reported on.
      if (api.pairHoldsLineBreak(pair)) {
        logWarn(
          `expand: the pair ${JSON.stringify(pair.from)} to ${JSON.stringify(pair.to)} holds a line break and was refused`,
        );
        return;
      }
      if (!pairChangesSomething(pair)) {
        logWarn(`expand: the pair "${pair.from}" to "${pair.to}" changes nothing and was ignored`);
        return;
      }
      // Through the exported object, so an inversion patching the boundary
      // rule or the case rule reaches the loop below rather than a copy of it.
      usable.push({ pair: pair, pattern: api.wholeWordPattern(pair.from) });
    });

    const changeSet = [];
    cueList.forEach((cue) => {
      if (!cue || typeof cue.text !== "string") return;

      let text = cue.text;
      const reasons = [];

      usable.forEach(({ pair, pattern }) => {
        let occurrences = 0;
        // A fresh regex per cue: a /g pattern carries lastIndex between calls,
        // and a shared one would skip matches in every cue after the first.
        const perCue = new RegExp(pattern.source, pattern.flags);
        const next = text.replace(perCue, (matched) => {
          occurrences += 1;
          return api.applyCaseOf(matched, pair.to);
        });
        if (occurrences > 0) {
          text = next;
          reasons.push(reasonFor(pair, occurrences));
        }
      });

      if (reasons.length === 0) return;
      changeSet.push({
        cueId: cue.id,
        original: cue.text,
        proposed: text,
        source: SOURCE,
        // Through `api`, so the suite's reason-join inversion reaches this line.
        reason: api.joinReasons(reasons),
        confidence: RECURRING_CONFIDENCE,
        status: STATUS_ACCEPTED,
        rejectedBy: null,
      });
    });

    logInfo(`expand: ${changeSet.length} entr${changeSet.length === 1 ? "y" : "ies"} from ${usable.length} pair(s)`);
    return changeSet;
  }

  // ==========================================================================
  // THE STAGE, AS THE ORCHESTRATOR RUNS IT
  // ==========================================================================

  /**
   * Discover, hand the pairs to a person, expand what comes back.
   *
   * This is the stage function the orchestrator calls. It returns the
   * orchestrator's stage shape — `{ changeSet, halted }` — rather than a bare
   * array, because two of its three outcomes are halts a person has to resolve.
   *
   * @param {Array<object>} cueList
   * @param {object} context `{ persist, signal, onPairs, model, glossary }`
   * @returns {Promise<{ changeSet: Array<object>, halted: string|null, pairs: Array<object> }>}
   */
  async function run(cueList, context) {
    const ctx = context || {};
    // THROUGH `api`, NEVER THE LEXICAL `discover`, AND THIS IS NOT TIDINESS.
    //
    // The export is the single door into a send. The harness calls
    // `api.discover` explicitly, so a caller stubbing
    // `CaptionsFixerStageRecurring.discover` intercepted the harness — and,
    // while this line read `discover(...)`, did NOT intercept the journey a
    // person takes through the UI, which arrives here through the
    // orchestrator. Found at Stage 7e from a real stack trace: a probe stubbed
    // the export, drove `CaptionsFixerUI.handleRun()`, and the send went out
    // anyway. An armed tripwire refused it, so it cost nothing; nothing in the
    // suite reddened, which is the part worth preventing.
    //
    // It also matters for what comes next, AND THE SENTENCE THAT STOOD HERE
    // UNTIL STAGE 15 WAS WRONG. It read: "The agreement filter wraps the
    // export; wrapping it while this line bypassed it would double the
    // harness's sends and leave the shipped journey sending once — every row
    // green and nothing working." The second half is exactly right and is why
    // this line reads `api.discover`. The first half is not: the filter is
    // built HERE, at this call site, and is not a wrapper around the export at
    // all. Wrapping the export from outside would have doubled the HARNESS's
    // sends too, and the harness calls `stage.discover` directly precisely so
    // it can measure ONE. This call site is the one place both the person's
    // journey and nothing else passes through, which is what makes it the
    // right home for a filter the harness must not inherit.
    //
    // This is the module's own convention, applied to the one call site that
    // missed it: `api.takesPossessive`, `api.wholeWordPattern` and
    // `api.applyCaseOf` are all reached the same way, for the same reason.
    const first = await api.discover(cueList, ctx);

    // BETWEEN THE SENDS. Reply one's bytes are already on disk under
    // `pairsRaw`, so a cancel here costs nothing that was paid for, and the
    // person gets reply one's pairs exactly as a cancel after a single discover
    // gave them before this stage.
    if (ctx.signal && ctx.signal.aborted) {
      logInfo("run: cancelled between the sends; reply one's pairs are persisted");
      return { changeSet: [], halted: HALTED.CANCELLED, pairs: first.pairs };
    }

    // THE SECOND SEND RETHROWS IF IT FAILS, and does not degrade to one reply.
    // Reply one is on disk either way, so nothing paid for is lost and a retry
    // is one press. Degrading would mean labelling reply one's pairs, and
    // neither label would be true: `both` would claim an agreement that was
    // never measured, and `one` would push every correction into the collapsed
    // group on the strength of a network failure.
    const second = await api.discover(cueList, secondSendContext(ctx));

    // THROUGH `api`, for the same reason as `discover` above: it is the seam a
    // row inverts to prove the sort is doing the work its rows name.
    const sorted = api.agree(first.pairs, second.pairs);
    const pairs = sorted.both.concat(sorted.one);

    // The sort's own result, written before the cancel check below, so a person
    // who cancels while the list is rendering still leaves the record complete.
    await persistQuietly(ctx, { [FIELD_AGREEMENT]: sorted });
    logInfo(
      `run: ${sorted.both.length} pair(s) both replies proposed, ${sorted.one.length} from one reply only`,
    );

    if (ctx.signal && ctx.signal.aborted) {
      logInfo("run: cancelled after the second send; both replies are persisted");
      return { changeSet: [], halted: HALTED.CANCELLED, pairs: pairs };
    }

    if (typeof ctx.onPairs !== "function") {
      // NOT an error. The pairs are on disk and a person has not seen them; a
      // stage that expanded them anyway would be applying unreviewed model
      // output to somebody's lecture.
      logInfo(`run: ${pairs.length} pair(s) await approval`);
      return { changeSet: [], halted: HALTED.AWAITING_APPROVAL, pairs: pairs };
    }

    const approved = await ctx.onPairs(pairs);

    if (ctx.signal && ctx.signal.aborted) {
      logInfo("run: cancelled during approval");
      return { changeSet: [], halted: HALTED.CANCELLED, pairs: pairs };
    }

    return {
      changeSet: expand(cueList, Array.isArray(approved) ? approved : []),
      halted: null,
      pairs: pairs,
    };
  }

  logInfo("Captions Fixer recurring stage loaded");

  const api = {
    // the two steps
    discover: discover,
    expand: expand,
    // the sort, exported so a row can bind it by inversion without a send
    agree: agree,
    agreementKey: agreementKey,
    parseGlossary: parseGlossary,
    // the stage, as the orchestrator runs it
    run: run,
    // the prompt, exported so a row can read it and a person can review it
    buildSystemPrompt: buildSystemPrompt,
    buildUserPrompt: buildUserPrompt,
    estimateDiscover: estimateDiscover,
    // pure helpers, exported so the suite can bind them by inversion
    applyCaseOf: applyCaseOf,
    wholeWordPattern: wholeWordPattern,
    takesPossessive: takesPossessive,
    pairChangesSomething: pairChangesSomething,
    pairHoldsLineBreak: pairHoldsLineBreak,
    joinReasons: joinReasons,
    // constants
    POSSESSIVE_NAMES_ONLY: POSSESSIVE_NAMES_ONLY,
    REASON_SEPARATOR: REASON_SEPARATOR,
    SYSTEM_PROMPT: SYSTEM_PROMPT,
    PAIRS_SCHEMA: PAIRS_SCHEMA,
    STAGE_NAME: STAGE_NAME,
    SOURCE: SOURCE,
    STATUS_ACCEPTED: STATUS_ACCEPTED,
    RECURRING_CONFIDENCE: RECURRING_CONFIDENCE,
    CHANGE_SET_FIELDS: CHANGE_SET_FIELDS,
    HALTED: HALTED,
    FIELD_PAIRS_RAW: FIELD_PAIRS_RAW,
    FIELD_PAIRS: FIELD_PAIRS,
    FIELD_PAIRS_RAW_2: FIELD_PAIRS_RAW_2,
    FIELD_PAIRS_2: FIELD_PAIRS_2,
    FIELD_AGREEMENT: FIELD_AGREEMENT,
    SENDS_PER_PASS: SENDS_PER_PASS,
    AGREEMENT: AGREEMENT,
    BLOCK_ROLE: BLOCK_ROLE,
    BLOCK_TASK: BLOCK_TASK,
    BLOCK_CONSERVATIVE: BLOCK_CONSERVATIVE,
    BLOCK_NUMBERS: BLOCK_NUMBERS,
    BLOCK_SPEAKER_LABELS: BLOCK_SPEAKER_LABELS,
    BLOCK_SHAPE: BLOCK_SHAPE,
    GLOSSARY_NONE: GLOSSARY_NONE,
    GLOSSARY_PREFIX: GLOSSARY_PREFIX,
  };
  return api;
})();

// The const above is a top-level BINDING, not a window property, so the alias
// below is what makes window.CaptionsFixerStageRecurring resolve at all — the
// same arrangement, for the same reason, as captions-fixer-llm.js:1062.
window.CaptionsFixerStageRecurring = CaptionsFixerStageRecurring;
