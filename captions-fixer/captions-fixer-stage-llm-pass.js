/**
 * CAPTIONS FIXER — THE CUE-LEVEL PASS (Stage 11).
 *
 * The second correction pass, and the second thing in this tool that spends.
 * Where the recurring stage asks "which terms did the recogniser get wrong
 * every time?" and answers with find-and-replace pairs, this one reads each
 * caption IN CONTEXT and asks for the captions that should change — the errors
 * that happen once, that a pair cannot express, and that only the surrounding
 * sentences reveal.
 *
 *   run(cueList, context) => { changeSet, halted? }
 *       One send PER CHUNK, sequential, the whole corrected transcript covered
 *       in order. Every proposal arrives `proposed`, never `accepted`.
 *
 * IT RUNS ON THE APPLIED CUE LIST, AFTER THE PAIRS, NEVER ON THE UPLOAD.
 * The caller hands it `applyChangeSet(cueList, changeSet).cueList` for whatever
 * the person has ticked. Two reasons, both settled before this file existed:
 * the research brief puts discover-and-replace first because it removes most
 * STEM errors at no hallucination risk, so this pass should never see them;
 * and a cue-level entry's `original` must be the text `applyChangeSet` will
 * actually find, or every entry on a cue a pair also touched is a conflict by
 * construction.
 *
 * THE PROMPT IS A NEW PROMPT, NOT A CHANGE TO THE SHIPPED ONE
 * -----------------------------------------------------------
 * `CaptionsFixerStageRecurring.SYSTEM_PROMPT` hashes to `926b198f522bf859…`
 * and nothing in this file may move it. The blocks below are written from that
 * prompt's blocks, reusing their wording wherever the rule is the same — be
 * conservative, never touch a number, never touch a speaker label, never turn
 * spoken mathematics into notation — because a rule that holds for both passes
 * should reach the model in the same words. What differs is the task and the
 * shape, and those are stated fresh.
 *
 * THE GLOSSARY BLOCK IS COMPOSED EXACTLY AS THE RECURRING STAGE COMPOSES IT,
 * from that stage's own `GLOSSARY_PREFIX` read at call time and the same
 * `"; "` join, so a term a person left in the Known terms field reaches both
 * passes in identical words. Read rather than copied: a second literal here
 * would drift the first time either was edited.
 *
 * IT DOES NOT END WITH `JSON_ONLY_INSTRUCTION`, for the reason the recurring
 * stage's header gives — `CaptionsFixerLLM.complete` appends that block itself,
 * and carrying it here would send it twice.
 *
 * THE PROMPT HAS NO MEASURED ROUND YET, AND THAT IS WHY NOTHING IT PROPOSES IS
 * TICKED. Round cf-6 is its own dispatch and needs a GO. Until it is run, every
 * entry this stage produces arrives `proposed`, a person reads each one, and
 * `applyChangeSet` applies `accepted` only — so an unmeasured prompt cannot
 * change a single caption on its own. That is the same bargain Release 1 made
 * before cf-3, said plainly rather than left to be discovered.
 *
 * PERSIST BEFORE YOU PARSE, ELEVEN TIMES RATHER THAN ONCE
 * -------------------------------------------------------
 * A discovery pass sends twice and writes two fields. This one sends once per
 * chunk — ELEVEN times on the 657-cue fixture — so "anything paid for is on
 * disk the instant it arrives" has to survive a reply arriving eleven times.
 *
 * `passRaw` therefore holds the WHOLE ARRAY SO FAR, one record per chunk,
 * rewritten after every reply and before anything here parses it. Each write is
 * a strict superset of the one before it, so no write can lose an earlier one.
 * A plain per-chunk write would leave chunk 11's reply sitting where chunk 1's
 * was, and ten paid-for replies would be gone.
 *
 * THE SUPERSET IS THIS FILE'S GUARANTEE AND NOWHERE ELSE'S. `persist` is a
 * read-modify-write of the named fields: hand it a shorter array and it writes
 * a shorter array without complaint. `_records` below is append-only and every
 * write passes `_records.slice()`, which is what makes the property true; the
 * pass section proves it with a persist spy reading lengths 1, 2, 3, each a
 * prefix of the next and each written before the next chunk is sent.
 *
 * `passEntries` IS WRITTEN BY THE ORCHESTRATOR, THROUGH A RE-KEYED PERSIST.
 * `settleStage` writes the guarded entries to `changeSet`, which belongs to the
 * recurring stage and must be byte-identical after a pass run. So the caller
 * hands this stage a `persist` that maps `changeSet` to `passEntries` and
 * passes every other name through — exactly the `SECOND_SEND_FIELD_MAP`
 * arrangement Stage 15 built for the second discovery send, reused rather than
 * re-invented. This file never applies that map itself and never needs to know
 * it exists.
 *
 * WHAT THIS STAGE DROPS BEFORE THE GUARDS, AND WHY IT IS NOT A SEVENTH GUARD
 * --------------------------------------------------------------------------
 * `entriesFromReply` drops an item that changes nothing, that changes the
 * number of line breaks in the caption, or whose `text` is not a non-empty
 * string. The first and third are the adapter's leftovers; the SECOND is the
 * interesting one, and it lives here rather than in `captions-fixer-guards.js`
 * on purpose: a guard is `(entry) => null | "<name>"` and never reads the cue
 * list, and a seventh entry on `DEFAULT_GUARDS` would change what the recurring
 * path holds today. A line-break count is a property of the entry alone —
 * `original` against `proposed` — so it could become a guard the day a fixture
 * with multi-line cues exists to prove it on. Until then it is a stage rule,
 * counted in `passRaw` with everything else this stage throws away.
 *
 * NOTHING IS DISCARDED SILENTLY. Every drop is counted, by reason, in the
 * chunk's own `passRaw` record: `{ unchanged, lineBreaks, unreadable, duplicate }`,
 * beside the adapter's own `discarded` for items the schema refused.
 *
 * THE TAG RULE IS A STAGE RULE *AS WELL AS* A GUARD, AND THE DUPLICATION IS
 * THE DECISION RATHER THAN AN OVERSIGHT. `tagsPreserved` is on
 * `DEFAULT_GUARDS`, so the orchestrator already holds a tag-damaging proposal
 * from either pass — but a HOLD and a DROP are not the same thing here. A held
 * CUE-LEVEL entry renders in the changes table with no guard name in any cell
 * and an enabled tick box, so a person can accept it without anything on
 * screen saying a check refused it; only a recurring PAIR carries the plain
 * reason on its label. A counted drop is a figure the run record keeps.
 * So the guard stays as the backstop for both passes and for any future stage,
 * and this stage drops as well, counting it `dropped.tags`.
 *
 * IT READS THE TAG LOGIC OFF `window.CaptionsFixerGuards` AT CALL TIME, never
 * captured at load, for the reason every other sibling here is: a lexical grab
 * is not a seam, and a rule nobody can patch is a rule nobody can prove. It
 * owns no tag pattern of its own — one shipped notion of a tag, in the module
 * that already had it.
 *
 * WITH THAT MODULE ABSENT THE PROPOSAL IS DROPPED, NOT KEPT, and the choice is
 * the conservative one: we cannot tell a damaged tag from an intact one
 * without it, and keeping what cannot be checked is the reading that fails
 * silently. The counter makes the refusal loud instead. Note this is a refusal
 * on an impossible page rather than a live branch — the orchestrator's own
 * `guardEntries` call would already have thrown on the same absence.
 *
 * THIS STAGE GUARANTEES AT MOST ONE ENTRY PER CUE, AND THAT IS A CONTRACT THE
 * UI RELIES ON RATHER THAN AN INTERNAL TIDINESS.
 * -----------------------------------------------------------------------
 * `entriesFromReply` keeps the first surviving item for a cue and counts every
 * later one `duplicate`. Nothing upstream did this: the adapter drops an item
 * missing a key, carrying the wrong type, or naming an id outside `knownIds`,
 * and TWO WELL-FORMED ITEMS NAMING THE SAME KNOWN ID PASS ALL THREE. Measured
 * before the drop existed — a reply carrying two items for id 20 returned two
 * entries, both on cue 20, nothing dropped.
 *
 * WHAT RELIES ON IT: a pass row's tick box is named for its caption, so two
 * entries on one cue are two boxes a screen-reader user cannot tell apart —
 * the Stage 11 listen's defect 2, arriving from a second direction. Stage 11b
 * makes a PASS name and a RECURRING name differ; only this drop makes two PASS
 * names differ, and no naming rule could, because the two entries would be
 * about the same caption from the same source.
 *
 * A PER-CHUNK DROP IS A PER-RUN GUARANTEE BECAUSE THE CHUNKS PARTITION THE
 * PRIMARIES, and that is measured rather than assumed: 657 cues give 11 chunks
 * carrying 657 distinct primary ids and NO id in two chunks, with a seeded
 * overlap proving the check could see one. `knownIdsFor` tells the adapter
 * about a chunk's primaries alone, so a proposal on a context cue cannot reach
 * another chunk's primaries either.
 *
 * THE RECURRING STAGE NEEDS NO SUCH DROP, and this was measured too rather
 * than reasoned from: `expand` loops cues outside and pairs inside, pushing
 * ONCE per cue with the reasons joined, so two approved pairs landing in one
 * caption give one entry carrying both reasons. There is no older collision
 * here to inherit.
 *
 * EVERY INTERNAL CALL TO A SIBLING GOES THROUGH `api`, AND THE FIRST DRAFT OF
 * THIS FILE GOT THAT WRONG IN TEN PLACES. `run` and `estimatePass` reach
 * `chunksFor`, `chunkOptionsFor`, `buildUserPrompt`, `buildSystemPrompt` and
 * `persistQuietly` through the exported object, never through the lexical
 * binding, because the export is the seam a row inverts. A suite patching
 * `CaptionsFixerStageLlmPass.chunkOptionsFor` and finding `run` unaffected
 * would have a row that CANNOT FAIL under the inversion it names — green on
 * any build, which is worse than no row at all.
 *
 * This is the recurring stage's own lesson, recorded in its `run` at the
 * `api.discover` call: a probe stubbed the export, drove the UI, and the send
 * went out anyway while nothing in the suite reddened. The comment warning
 * about it was read while this file was being written and the defect was
 * written in regardless, which is worth knowing about the warning as much as
 * about the code.
 *
 * TIMINGS ARE NEVER READ. This stage sees `id` and `text` and nothing else.
 *
 * Pure data. No DOM, no voice, no announcement, no live region, no storage of
 * its own — every write goes through the `persist` the orchestrator hands it.
 *
 * A PLAIN script publishing window.CaptionsFixerStageLlmPass. It resolves
 * `window.CaptionsFixerLLM`, `window.CaptionsFixerChunker` and
 * `window.CaptionsFixerStageRecurring` at CALL time, never at load, for the
 * load-order reason recorded in captions-fixer-llm.js's own header.
 *
 * @module CaptionsFixerStageLlmPass
 * @since 16 September 2026
 */
const CaptionsFixerStageLlmPass = (function () {
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[CaptionsFixerStageLlmPass]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[CaptionsFixerStageLlmPass]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[CaptionsFixerStageLlmPass]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[CaptionsFixerStageLlmPass]", message, ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  /** The stage's name, as it appears in a tally and in a halt reason. */
  const STAGE_NAME = "llm-pass";

  /** The `source` every entry this stage produces carries. */
  const SOURCE = "llm-pass";

  /** The `status` every entry starts at: nobody has approved anything yet. */
  const STATUS_PROPOSED = "proposed";

  /**
   * The `confidence` a pass entry carries.
   *
   * NULL, AND THAT IS A READING RATHER THAN A PLACEHOLDER. The recurring stage
   * writes 1 because a person approved the pair and the replacement is a
   * deterministic substitution, so there is no residual uncertainty left for
   * the field to express. Here there is nothing but uncertainty: the model
   * proposes, nobody has measured how often it is right — cf-6 is owed — and
   * the model's own `reason` is prose, not a score. A number here would be an
   * invented one, and a person reading the table would take it for a
   * measurement. `null` says "not known", which is the truth.
   */
  const PASS_CONFIDENCE = null;

  /**
   * STAGE `pl`, WORK ITEM 4 (2 October 2026): the CHECK ENTRY this stage makes
   * for a caption the plausibility pass scored at or below the bar and that
   * received no entry of any kind. It proposes nothing: `proposed` is null, so
   * no check entry can change a caption on its own, and `applyChangeSet`
   * applies `accepted` only. The source carries the `llm-pass` prefix on
   * purpose, so the UI's prefix test reads a check row as a pass row.
   *
   * `STATUS_CHECK` mirrors `CaptionsFixerCues.STATUS.CHECK`, the way
   * `STATUS_PROPOSED` mirrors its sibling: one literal here, read by no other
   * file, and a suite row compares it with the cue module's.
   */
  const SOURCE_CHECK = "llm-pass-check";
  const STATUS_CHECK = "check";

  /** One short sentence on one line, and never the score. */
  const CHECK_REASON = "Check this caption.";

  /** The key, inside a chunk's `passRaw` record, the plausibility reading lives under. */
  const FIELD_PLAUSIBILITY = "plausibility";

  /**
   * The `refusal` values a plausibility reading carries that are NOT one of the
   * adapter parser's six names: the send itself failed, or the prompt could not
   * be built from the shipped one and nothing was sent.
   */
  const PLAUSIBILITY_SEND_FAILED = "send-failed";
  const PLAUSIBILITY_NOT_SENT = "not-sent";

  /** One plausibility send per chunk, the figure `estimatePass` multiplies by. */
  const PLAUSIBILITY_SENDS_PER_CHUNK = 1;

  /** Every field a change-set entry carries, and nothing else. The frozen shape. */
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
  const HALTED = Object.freeze({ CANCELLED: "cancelled" });

  /**
   * The record field this stage writes DIRECTLY. Added to the store's
   * RECORD_FIELDS at 641186b, which is what `persist` enforces against; writing
   * it before that commit would have been refused by name.
   */
  const FIELD_PASS_RAW = "passRaw";

  /**
   * The record field the stage's entries reach THROUGH THE ORCHESTRATOR, and
   * this stage never writes it. Named here because it is this stage's field and
   * a reader looking for where the entries land should find the answer in this
   * file; the re-key that puts them there is the caller's, and the header says
   * why.
   */
  const FIELD_PASS_ENTRIES = "passEntries";

  /**
   * The id prefix that means a model runs on the person's own machine, and
   * therefore reads a shorter context. Matched with `indexOf(…) === 0` on the
   * id `resolveModel` returns, never on what the caller asked for: a caller
   * naming no model at all still resolves to something, and it is that
   * something whose context window decides the chunk size.
   */
  const LOCAL_MODEL_PREFIX = "local/";

  /** The `[` and `] ` that wrap a cue id on its own line in the user prompt. */
  const CUE_LINE_PREFIX = "[";
  const CUE_LINE_SUFFIX = "] ";

  /** One cue per line. */
  const CUE_LINE_SEPARATOR = "\n";

  /** Between the blocks of the system prompt, and between the lead-in and the cues. */
  const BLOCK_SEPARATOR = "\n\n";

  /** The line break whose count a proposal may not change. */
  const LINE_BREAK = "\n";

  /** How many sends ONE CHUNK makes. One; the pass makes one per chunk. */
  const SENDS_PER_CHUNK = 1;

  /** The reasons this stage drops an item, before the guards ever see it. */
  const DROP_REASONS = Object.freeze({
    UNCHANGED: "unchanged",
    LINE_BREAKS: "lineBreaks",
    UNREADABLE: "unreadable",
    DUPLICATE: "duplicate",
    CUE_PREFIX: "cuePrefix",
    SPEAKER_LABEL: "speakerLabel",
    TAGS: "tags",
  });

  /**
   * The reasons this stage REPAIRS an item rather than dropping it. One today.
   * A repair is counted in its own tally beside `dropped`, never inside it: a
   * repaired proposal is KEPT, and folding it into a drop count would make
   * "how many did this chunk throw away" answer a question nobody asked.
   */
  const REPAIR_REASONS = Object.freeze({
    SPEAKER_LABEL: "speakerLabel",
  });

  /**
   * A proposal that opens with the cue's own number in brackets — the shape
   * `openai/gpt-5.4-mini` produced on 9 of cf-6's 308 fixture entries and 106
   * of 420 Panopto ones. The user prompt writes each cue as `[id] text`, and a
   * model that echoes the line back keeps the wrapper; applying one inserts the
   * literal characters `[366] ` into a caption a viewer reads.
   *
   * NARROWED ON PURPOSE, and the narrowing is in `entriesFromReply` rather than
   * here: the rule fires only where the ORIGINAL does not carry the same shape.
   * A caption that genuinely opens `[12] ` has a corrected form that opens
   * `[12] ` too, and the blunt rule would drop the correction rather than the
   * corruption. cf-6's control is that 0 of 308 originals carry one, so on
   * every case this rule was built for the two forms behave identically.
   */
  const CUE_PREFIX_PATTERN = /^\[\d+\]/;

  /**
   * MIRRORS `CaptionsFixerGuards.SPEAKER_LABEL_PATTERN`, composed from the same
   * three pieces in the same order. Held locally so this synchronous parse
   * function keeps its three call-time dependencies and gains no fourth; the
   * suite asserts `.source` is byte-identical to the guards' own, so a drift is
   * a red row rather than a silent divergence. That is the arrangement
   * `captions-fixer-guards.js` already uses for `STATUS_REJECTED`.
   */
  const SPEAKER_LABEL_PREFIX = "Speaker ";
  const SPEAKER_LABEL_SUFFIX = ": ";
  const SPEAKER_NUMBER_SOURCE = "\\d+";
  const SPEAKER_LABEL_PATTERN = new RegExp(
    `^${SPEAKER_LABEL_PREFIX}${SPEAKER_NUMBER_SOURCE}${SPEAKER_LABEL_SUFFIX}`,
  );

  /**
   * MIRRORS `CaptionsFixerLLM.ERRORS.PARSE`. One of the two error reasons this
   * stage treats as survivable. Mirrored rather than read at module load because
   * the adapter is resolved at call time everywhere else in this file; the suite
   * asserts the two are equal.
   */
  const ERROR_REASON_PARSE = "parse";

  /**
   * MIRRORS `CaptionsFixerLLM.ERRORS.TRUNCATED`, for the same reason and with the
   * same mirror row. A reply the provider cut off at its token limit (parcel
   * H-22) is the second survivable reason; H-22b put it back after H-22 made it
   * end the pass.
   */
  const ERROR_REASON_TRUNCATED = "truncated";

  /** The reasons that skip one chunk, count it, and carry on. Every other reason ends the pass. */
  const SURVIVABLE_ERROR_REASONS = Object.freeze([ERROR_REASON_PARSE, ERROR_REASON_TRUNCATED]);

  // ==========================================================================
  // THE PROMPT
  // ==========================================================================

  /**
   * 1. Who the model is, and what it is looking at. It says CORRECTED on
   *    purpose: by the time this pass runs a person has already approved and
   *    applied the recurring pairs, and a model told it is reading raw
   *    recogniser output will re-propose what has just been fixed.
   */
  const BLOCK_ROLE =
    "You are a captioning editor for UK university lecture recordings. " +
    "Below is part of an automatic speech recogniser's transcript of one lecture, one caption per line, in the order the words were spoken. " +
    "Recurring recognition errors have already been corrected and approved by a person.";

  /**
   * 2. The task. Changed captions ONLY, which is the whole economy of this pass
   *    — the research brief's *Two design points* measured it as an order of
   *    magnitude fewer output tokens than returning the transcript, and it
   *    makes "nothing was dropped" a trivial check rather than a diff.
   */
  const BLOCK_TASK =
    "Report only the captions that should change. " +
    "Change a caption only where the words as written are plainly not what was said, and the surrounding captions make clear what was said instead. " +
    "Give the whole corrected caption, not a fragment and not a description of the change. " +
    "Leave a caption alone if you are unsure, and report nothing at all if nothing should change.";

  /**
   * 3. The conservative instruction. The first four sentences are the recurring
   *    stage's BLOCK_CONSERVATIVE pointed at captions rather than at terms; the
   *    mathematics sentence is its rule verbatim in substance, because a pass
   *    reading each line is if anything MORE tempted to tidy notation.
   */
  const BLOCK_CONSERVATIVE =
    "Be conservative. Correct only clear recognition errors: homophones, misheard technical terms and misheard proper nouns. " +
    "What you propose must sound like the caption that is written. " +
    "Never rephrase, never reword, never reorder, never summarise, and never add or remove meaning. " +
    "Never change punctuation alone, and never change a caption only to improve its style or grammar. " +
    "Never convert spoken mathematics into symbols, notation or LaTeX: if a caption looks like garbled mathematics, leave it alone. " +
    "Never propose a change that only swaps British and American spelling: colour and color sound the same and neither is a recognition error.";

  /** 4. Numbers are immutable, in either form. The guards enforce it as well. */
  const BLOCK_NUMBERS =
    "Never change a number, in digits or in words. " +
    "Leave 0.05, 91,000, twenty five and 25 exactly as they are written, even where the caption looks wrong.";

  /** 5. Speaker labels are immutable, byte for byte. The guards enforce it too. */
  const BLOCK_SPEAKER_LABELS =
    "Never change a speaker label. " +
    'A caption beginning "Speaker 1: ", "Speaker 2: " and so on keeps that label unchanged at the start of the caption you give back.';

  /**
   * 6. Line breaks. A caption may carry more than one line, and the break is
   *    positional information the file format carries; a model that silently
   *    joins two lines has changed the caption's shape without changing a word.
   *    This stage drops such a proposal whatever the prompt says — the rule is
   *    here so the model does not waste a proposal on one.
   */
  const BLOCK_LINE_BREAKS =
    "Keep the line breaks a caption already has. " +
    "A caption written on two lines comes back on two lines, broken in the same place.";

  /**
   * 7. The shape. It sits AFTER the blocks and BEFORE the adapter's own
   *    JSON_ONLY_INSTRUCTION, which `complete` appends; see the file header.
   */
  const BLOCK_SHAPE =
    "Reply with a JSON array at the top level, and nothing else. " +
    'Each element is an object with exactly these keys: "id", the number in square brackets at the start of the caption you are changing; ' +
    '"text", the whole corrected caption; "reason", one short line saying what was misheard. ' +
    "Reply with an empty array if no caption should change.";

  /**
   * The wording that names which ids this chunk may propose on. The rest of the
   * lines are there so the model can read across a boundary and must not be
   * proposed on; `applySchema` enforces that with `knownIds`, and this sentence
   * is what stops the model wasting proposals discovering it.
   *
   * @param {string|number} first
   * @param {string|number} last
   * @returns {string}
   */
  function buildRangeLine(first, last) {
    return (
      `You may change captions ${first} to ${last} only. ` +
      "The other captions are here so you can read across the join; never report one of those."
    );
  }

  /**
   * The glossary block when none has been supplied. Its own wording rather than
   * the recurring stage's, because the block is present and empty in both
   * prompts for the same prompt-caching reason and the two prompts are
   * deliberately different strings.
   */
  const GLOSSARY_NONE = "Known terms for this module: none supplied.";

  /** The join between glossary terms, the same one the recurring stage uses. */
  const GLOSSARY_TERM_SEPARATOR = "; ";

  /**
   * Build the system prompt. The seven blocks are always present and always in
   * this order; only the glossary block's contents move.
   *
   * THE GLOSSARY LINE IS COMPOSED FROM THE RECURRING STAGE'S OWN PREFIX, read
   * at call time through `window`, so a person's term reaches both passes in
   * identical words. Where that stage is not on the page the block falls back
   * to "none supplied" and says so in the log: a prompt that silently dropped
   * a glossary would be a worse outcome than one that reports it.
   *
   * @param {Array<string>} [glossary=[]] terms, spelled as they should appear
   * @returns {string}
   */
  function buildSystemPrompt(glossary) {
    const terms = Array.isArray(glossary)
      ? glossary.filter((term) => typeof term === "string" && term.trim())
      : [];
    let glossaryBlock = GLOSSARY_NONE;
    if (terms.length > 0) {
      const recurring = window.CaptionsFixerStageRecurring;
      const prefix = recurring && typeof recurring.GLOSSARY_PREFIX === "string" ? recurring.GLOSSARY_PREFIX : null;
      if (prefix) {
        glossaryBlock = `${prefix}${terms.join(GLOSSARY_TERM_SEPARATOR)}.`;
      } else {
        logWarn(
          "buildSystemPrompt: CaptionsFixerStageRecurring is not on the page, so the known terms were not composed into the prompt",
        );
      }
    }
    return [
      BLOCK_ROLE,
      BLOCK_TASK,
      BLOCK_CONSERVATIVE,
      BLOCK_NUMBERS,
      BLOCK_SPEAKER_LABELS,
      BLOCK_LINE_BREAKS,
      glossaryBlock,
      BLOCK_SHAPE,
    ].join(BLOCK_SEPARATOR);
  }

  /**
   * The shape `CaptionsFixerLLM.applySchema` filters the reply against.
   *
   * `idKey` IS LOAD-BEARING AND ITS ABSENCE WOULD BE SILENT. The adapter runs
   * its `knownIds` filter only where the schema names an `idKey`; without it,
   * `knownIds` is accepted, ignored, and a proposal on a context cue sails
   * through into the next chunk's primaries. The pass section's canary reads
   * the argument the adapter received AND asserts the context proposal was
   * dropped, so neither half can pass alone.
   *
   * `id` CARRIES NO TYPE ON PURPOSE. `sameId` compares through `String()` on
   * both sides, so a model answering `3` where the prompt wrote `[3]` matches;
   * declaring `id: "number"` here would drop a reply that is correct in every
   * way but its JSON type.
   */
  const REPLY_SCHEMA = Object.freeze({
    type: "array",
    items: Object.freeze({
      requiredKeys: Object.freeze(["id", "text", "reason"]),
      types: Object.freeze({ text: "string", reason: "string" }),
      idKey: "id",
    }),
  });

  // ==========================================================================
  // CHUNKS
  // ==========================================================================

  /**
   * The chunker options one model wants.
   *
   * The chunker is NOT edited by this stage: `CLOUD_MAX_CUES` 60,
   * `LOCAL_MAX_CUES` 20 and `OVERLAP_CUES` 2 were reserved for this pass by the
   * masterplan's own decision row, and 657 cues at the cloud settings is 11
   * chunks — the figure the Stage 2 ledger row already records.
   *
   * @param {string|null} modelId the id `resolveModel` returned
   * @returns {object|null} `{ maxCues, overlap }`, or null with no chunker
   */
  function chunkOptionsFor(modelId) {
    const chunker = window.CaptionsFixerChunker;
    if (!chunker) {
      logWarn("chunkOptionsFor: CaptionsFixerChunker is not on the page");
      return null;
    }
    const isLocal = typeof modelId === "string" && modelId.indexOf(LOCAL_MODEL_PREFIX) === 0;
    return {
      maxCues: isLocal ? chunker.LOCAL_MAX_CUES : chunker.CLOUD_MAX_CUES,
      overlap: chunker.OVERLAP_CUES,
    };
  }

  /**
   * The chunks one run would send, or an empty array where the chunker is
   * absent. Shared by `run` and `estimatePass`, so the two cannot disagree
   * about how many sends a press will make.
   *
   * @param {Array<object>} cueList
   * @param {string|null} modelId
   * @returns {Array<object>}
   */
  function chunksFor(cueList, modelId) {
    const chunker = window.CaptionsFixerChunker;
    const options = api.chunkOptionsFor(modelId);
    if (!chunker || !options) return [];
    return chunker.chunk(cueList, options);
  }

  /**
   * The ids ONE CHUNK may be proposed on: its primaries, never its context.
   *
   * A one-line function rather than a `chunk.cueIds` read at the call site, and
   * the reason is that a claim needs somewhere to fail. "The adapter is told
   * about the primaries only" is the whole mechanism stopping a proposal on a
   * context cue reaching the next chunk's primaries, and inverting it by
   * rewriting `chunk.cueIds` would change the chunk's own identity — so rows
   * about the chunk's shape, its prompt's range line and its record would all
   * move too, and the inversion would redden six rows while naming one. A
   * broader inversion is not a stricter one. Patching this instead moves the
   * knownIds argument and nothing else.
   *
   * @param {object} chunk
   * @returns {Array<string|number>}
   */
  function knownIdsFor(chunk) {
    return chunk && Array.isArray(chunk.cueIds) ? chunk.cueIds : [];
  }

  /**
   * The id one send would use, or null. Through the adapter, so a caller
   * naming no model resolves the same way a send would.
   *
   * @param {object} opts `{ model }`
   * @returns {string|null}
   */
  function resolveModelId(opts) {
    const llm = window.CaptionsFixerLLM;
    if (!llm || typeof llm.resolveModel !== "function") return null;
    return llm.resolveModel({ model: opts && opts.model, pass: llm.PASSES.PASS });
  }

  // ==========================================================================
  // THE USER PROMPT
  // ==========================================================================

  /**
   * One chunk as the model sees it: a sentence naming the id range it may
   * change, then one line per cue, `[id] text`, primaries AND context in file
   * order.
   *
   * IDS ARE SENT, unlike a discovery send, and that is the difference between
   * the two passes rather than an inconsistency. A discovery send counts
   * recurrences across a whole lecture and has nothing to say about any one
   * cue, so ids would only invite per-cue edits it cannot accept. This pass IS
   * per-cue, so an id is the only way a proposal can name what it changes.
   *
   * `text` GOES OUT BYTE-IDENTICAL. Newlines inside a caption, inline tags,
   * speaker labels — all of it, unaltered. The chunker does not touch cue text
   * and neither does this; a prompt that tidied captions on the way out would
   * be asking the model about a transcript that does not exist.
   *
   * @param {object} chunk a chunk from `CaptionsFixerChunker.chunk`
   * @returns {string}
   */
  function buildUserPrompt(chunk) {
    if (!chunk || !Array.isArray(chunk.cues)) {
      throw new TypeError("buildUserPrompt() needs a chunk carrying a cues array.");
    }
    const ids = Array.isArray(chunk.cueIds) ? chunk.cueIds : [];
    const first = ids.length > 0 ? ids[0] : "";
    const last = ids.length > 0 ? ids[ids.length - 1] : "";
    const lines = chunk.cues.map((cue) => {
      const text = cue && typeof cue.text === "string" ? cue.text : "";
      return `${CUE_LINE_PREFIX}${cue && cue.id}${CUE_LINE_SUFFIX}${text}`;
    });
    return [buildRangeLine(first, last), lines.join(CUE_LINE_SEPARATOR)].join(BLOCK_SEPARATOR);
  }

  // ==========================================================================
  // THE REPLY
  // ==========================================================================

  /**
   * How many line breaks a string carries. Its own function, and exported,
   * because the rule it serves is the one candidate here for promotion to a
   * seventh guard and a row should be able to bind it without a send.
   *
   * @param {string} text
   * @returns {number}
   */
  function countLineBreaks(text) {
    return typeof text === "string" ? text.split(LINE_BREAK).length - 1 : 0;
  }

  /**
   * Does this proposal change anything? The same test `pairChangesSomething`
   * applies to a pair, applied to a caption: case-insensitive, so a model
   * returning the caption with its capitalisation altered and nothing else is
   * proposing a change nobody asked for.
   *
   * @param {string} original
   * @param {string} proposed
   * @returns {boolean}
   */
  function proposalChangesSomething(original, proposed) {
    return String(original).toLowerCase() !== String(proposed).toLowerCase();
  }

  /**
   * The leading `Speaker N: ` label, or "" when there is none. MIRRORS
   * `labelOf` in `captions-fixer-guards.js`, over the mirrored pattern above.
   * Exported so the suite has a seam to invert: the `pass-speaker-label`
   * inversion makes this always return "", so every label compares equal.
   *
   * @param {string} text
   * @returns {string}
   */
  function labelOf(text) {
    if (typeof text !== "string") return "";
    const match = SPEAKER_LABEL_PATTERN.exec(text);
    return match ? match[0] : "";
  }

  /**
   * Is this rejection one the pass can survive and carry on from?
   *
   * ONLY A PARSE FAILURE OR A CUT-OFF REPLY (H-22b; the name predates the second
   * and is kept because the suite inverts this function by identity). A cancel,
   * a send failure, a bad request and a missing model all still end the pass,
   * because none of them says anything about the NEXT chunk: a cancel is a
   * person's instruction, and a send failure is the provider. A reply that
   * arrived and could not be used is the one case where the chunks after it are
   * as likely to succeed as the chunks before it did — and cf-6 measured what
   * ending the pass costs there, 78 paid-for proposals across five runs. The
   * skip stays VISIBLE: the chunk's record keeps its reason, `failedChunks`
   * counts it and the end-of-run WARN names it.
   *
   * AN EXPORTED PREDICATE RATHER THAN A LEXICAL TEST INSIDE `run`, so the suite
   * has a narrow seam to invert. A test written inline would be a dead seam,
   * green on any build, which is this file's own recorded lesson about five
   * such seams.
   *
   * @param {*} error
   * @returns {boolean}
   */
  function isParseFailure(error) {
    return Boolean(error) && SURVIVABLE_ERROR_REASONS.includes(error.reason);
  }

  /**
   * Turn one chunk's parsed reply into change-set entries, dropping — and
   * COUNTING — what this stage refuses before the guards ever see it.
   *
   * The adapter has already dropped items missing a key, carrying the wrong
   * type, or naming an id outside `knownIds`. SEVEN tests are left, none of
   * which a schema can express. (This read "Three" while listing six, from
   * Stage 11c onwards; the list below was kept current and the count above it
   * was not. Corrected here rather than left to disagree with its own list.)
   *
   *   unreadable   `text` is not a non-empty string
   *   unchanged    it proposes the caption it was given
   *   lineBreaks   it changes how many lines the caption has
   *   cuePrefix    it opens with the cue's own number in brackets
   *   speakerLabel it moves the cue's speaker label rather than dropping it
   *   tags         it strips, moves, adds or alters an inline tag, read
   *                through `CaptionsFixerGuards.tagsPreserved`
   *   duplicate    this cue already has an entry from an earlier item
   *
   * AND ONE IT REPAIRS RATHER THAN DROPS, which is the only place in this file
   * that rewrites a model's words:
   *
   *   speakerLabel the cue HAS a label, the proposal has none — the cue's own
   *                label is restored to the front and the proposal is KEPT,
   *                counted `repaired.speakerLabel`
   *
   * THE REPAIR ARM EXISTS BECAUSE THE DROP ARM WAS PAYING FOR NOTHING. Measured
   * over cf-6's 308 in-tree proposals before this was written: 35 of them are a
   * cue-labelled caption whose proposal dropped the label, and every one is
   * REJECTED by `speakerLabelUnchanged` today. On `anthropic/claude-sonnet-5`
   * that is 34 of 52 — two thirds of everything it proposed, thrown away for a
   * formatting slip while the word fix inside it was sound. The label is
   * recoverable from the cue exactly, with no judgement call and nothing
   * invented: the only label this arm can write is one the cue already carries.
   *
   * AND IT RUNS HERE, BEFORE THE GUARDS, WHICH IS THE POINT. A repaired
   * proposal reaches `speakerLabelUnchanged` carrying the cue's own label,
   * holds, and arrives in the review table as a normal `proposed` row with no
   * guard name against it. Put the repair anywhere downstream and the same
   * entry arrives `rejected`, which is the outcome it exists to stop.
   *
   * THE FOURTH IS TESTED LAST, AND THAT ORDERING IS THE DECISION. A cue is
   * "taken" by the first item that SURVIVES the other three, so an item that
   * proposes nothing does not spend its cue's one place and send a real
   * proposal after it to the bin. Tested first it would also RECLASSIFY drops
   * the other three already count — a second unchanged item would read
   * `duplicate` rather than `unchanged` — and no existing count may move.
   *
   * `original` IS READ FROM THE CUE LIST, NEVER FROM THE REPLY. It has to be
   * the text `applyChangeSet` will find, and the only place that lives is the
   * list this pass ran on. An item naming an id the cue list does not carry is
   * counted `unreadable` rather than trusted — the adapter's filter makes that
   * unreachable in ordinary use, and a fail-closed read costs nothing.
   *
   * @param {object} chunk
   * @param {Array<object>} cueList the list this pass ran on
   * ONE MALFORMED CASE IS DROPPED RATHER THAN REPAIRED, and it is a decision
   * rather than an oversight. The pattern requires the `": "` suffix, so a
   * proposal opening `Speaker 1:hello` reads as carrying NO label. Repairing it
   * blindly would write `Speaker 1: Speaker 1:hello` into the review table — a
   * doubled label arriving as a normal row, which is worse than either a drop
   * or the defect. So the repair fires only where the proposal has no label AND
   * does not begin with the bare prefix; anything else opening `"Speaker "` is
   * dropped. Measured 0 of 308 in cf-6, so this guards a case the corpus has
   * never produced — which is exactly when it is cheapest to get right.
   *
   * A REPAIR CAN COLLAPSE TO A NO-OP, AND THAT IS THE ONE PLACE AN EXISTING
   * COUNT MOVES. A proposal that drops the label and changes nothing else
   * becomes, once repaired, the cue's own text. `proposalChangesSomething` is
   * therefore re-tested after a repair and the collapse counted `unchanged` —
   * so an entry today's build would emit becomes a counted drop. 1 of 308 in
   * cf-6. Stated rather than hidden, because every other rule in this function
   * is ordered specifically so that no existing count moves.
   *
   * @param {Array<object>} data the adapter's filtered items
   * @returns {{ entries: Array<object>, dropped: object, repaired: object }}
   */
  function entriesFromReply(chunk, cueList, data) {
    const items = Array.isArray(data) ? data : [];
    const list = Array.isArray(cueList) ? cueList : [];
    // KEYED BY `String(id)`, NOT BY `id`. A model answering `"3"` where the
    // prompt wrote `[3]` is matched by the adapter's own `sameId`, which
    // compares through `String()` on both sides; a Map keyed on the raw id
    // would miss it here and count a proposal the adapter accepted as
    // unreadable. One map rather than a `find` per item, so a 60-cue chunk
    // costs one pass over the list instead of sixty.
    const cueByStringId = new Map(list.map((cue) => [String(cue && cue.id), cue]));
    const entries = [];
    const dropped = api.emptyDropped();
    const repaired = api.emptyRepaired();
    // Which cues already hold an entry from an earlier item in THIS reply.
    // Keyed by `String(id)` for the reason `cueByStringId` is: the id that
    // reaches the entry is the cue list's own, but the reply's may be a string
    // where the list carries a number, and the two must collide here.
    const taken = new Set();

    items.forEach((item) => {
      const proposed = item && item.text;
      if (typeof proposed !== "string" || proposed.length === 0) {
        dropped[DROP_REASONS.UNREADABLE] += 1;
        return;
      }
      const cue = cueByStringId.get(String(item.id));
      const original = cue ? cue.text : undefined;
      if (typeof original !== "string") {
        dropped[DROP_REASONS.UNREADABLE] += 1;
        return;
      }
      if (!api.proposalChangesSomething(original, proposed)) {
        dropped[DROP_REASONS.UNCHANGED] += 1;
        return;
      }
      if (api.countLineBreaks(original) !== api.countLineBreaks(proposed)) {
        dropped[DROP_REASONS.LINE_BREAKS] += 1;
        return;
      }
      // THE CUE PREFIX, NARROWED: only where the original does not carry one.
      // Tested before the label rules because a prefixed proposal has its label
      // DISPLACED rather than removed — measured, all 9 of cf-6's prefixed
      // proposals also read as label-dropped — so whichever of the two is
      // tested first claims them, and the prefix is the truthful reason.
      if (CUE_PREFIX_PATTERN.test(proposed) && !CUE_PREFIX_PATTERN.test(original)) {
        dropped[DROP_REASONS.CUE_PREFIX] += 1;
        return;
      }
      const originalLabel = api.labelOf(original);
      const proposedLabel = api.labelOf(proposed);
      let text = proposed;
      if (originalLabel !== proposedLabel) {
        if (proposedLabel !== "" || proposed.indexOf(SPEAKER_LABEL_PREFIX) === 0 || originalLabel === "") {
          // (b) THE DROP ARM. A label that differs from the cue's, one where
          // the cue has none, or the malformed `Speaker 1:hello` shape the
          // repair must not touch.
          dropped[DROP_REASONS.SPEAKER_LABEL] += 1;
          return;
        }
        // (a) THE REPAIR ARM. The cue's own label, verbatim, trailing space and
        // all, followed by the model's words.
        text = originalLabel + proposed;
        // The repair can make the proposal the caption it was given; see the
        // header. Re-tested here and nowhere else.
        if (!api.proposalChangesSomething(original, text)) {
          dropped[DROP_REASONS.UNCHANGED] += 1;
          return;
        }
        // COUNTED AFTER THE NO-OP TEST, NOT BEFORE IT. `repaired` is a count of
        // repairs that reached the table; a repair that collapses is counted
        // `unchanged` and nowhere else, or the tally would report a repair a
        // reader can find no entry for.
        repaired[REPAIR_REASONS.SPEAKER_LABEL] += 1;
      }
      // TAG DAMAGE, JUDGED ON `text` AND THEREFORE AFTER THE LABEL REPAIR.
      // The repair puts the cue's own label back on the front, which moves
      // what the FIRST tag faces on its left; judging `proposed` here instead
      // would drop a proposal the repair has already made whole. It sits after
      // `cuePrefix` for the same reason — a prefixed proposal has its label
      // displaced, and the prefix is the truthful reason for it.
      //
      // It sits BEFORE `duplicate` with the other content rules, so a
      // tag-damaged item does not spend its cue's one place and send a sound
      // proposal after it to the bin. That is the ordering decision the
      // `duplicate` rule's own paragraph above sets out, applied again.
      //
      // Read off `window.CaptionsFixerGuards` at CALL TIME and reached as a
      // property of it, never through a local copy, so a suite patching the
      // export reaches this line. See the file header for why an absent module
      // drops rather than keeps.
      const guards = window.CaptionsFixerGuards;
      const canReadTags = !!guards && typeof guards.tagsPreserved === "function";
      if (!canReadTags || guards.tagsPreserved({ original: original, proposed: text }) !== null) {
        dropped[DROP_REASONS.TAGS] += 1;
        return;
      }
      const key = String(cue.id);
      if (taken.has(key)) {
        dropped[DROP_REASONS.DUPLICATE] += 1;
        return;
      }
      taken.add(key);
      entries.push({
        cueId: cue.id,
        original: original,
        // `text`, not `proposed`: the repair arm above may have put the cue's
        // own label back on the front of it.
        proposed: text,
        source: SOURCE,
        reason: typeof item.reason === "string" ? item.reason : "",
        confidence: PASS_CONFIDENCE,
        status: STATUS_PROPOSED,
        rejectedBy: null,
      });
    });

    return { entries: entries, dropped: dropped, repaired: repaired };
  }

  // ==========================================================================
  // ESTIMATE
  // ==========================================================================

  /**
   * What a WHOLE PASS would cost, summed over its chunks, through the adapter's
   * own estimator. Exported so the orchestrator can check a spend cap BEFORE
   * this stage runs rather than after it has already sent eleven times.
   *
   * IT MUST BRANCH ON `glossary` EXACTLY AS `run` DOES, or the estimate
   * describes a different prompt from the one that goes out. The branch is
   * copied deliberately rather than shared, the same deliberate copy
   * `estimateDiscover` makes and for the same reason: that one reads a context
   * and this reads an options object, so if either changes the other must
   * change with it and this comment is the reason to look.
   *
   * THE TIER IS RECOMPUTED FROM THE TOTAL, NOT SUMMED, BECAUSE A TIER IS NOT
   * ADDITIVE. Eleven chunks each costing a green amount can total a red one,
   * and taking the worst per-chunk tier would report green on exactly the run
   * that needs a confirmation. The threshold function is the embed's, reached
   * through the adapter's own `getEmbed` so this file carries no copy of a
   * figure that lives somewhere else; where it cannot be reached the tier is
   * the adapter's own "unknown" and the caller treats that as it always has.
   *
   * @param {Array<object>} cueList the APPLIED list a run would send
   * @param {object} [options] `{ model, glossary }`
   * @returns {object|null} the adapter's estimate shape, or null where absent
   */
  function estimatePass(cueList, options) {
    const llm = window.CaptionsFixerLLM;
    if (!llm || typeof llm.estimate !== "function") {
      logWarn("estimatePass: CaptionsFixerLLM is not on the page");
      return null;
    }
    const opts = options || {};
    const modelId = resolveModelId(opts);
    const chunks = api.chunksFor(cueList, modelId);
    if (chunks.length === 0) {
      logWarn("estimatePass: no chunks — the chunker is absent or the cue list is empty");
      return null;
    }
    const systemPrompt = Array.isArray(opts.glossary) ? api.buildSystemPrompt(opts.glossary) : api.buildSystemPrompt();

    let inputTokens = 0;
    let costUsd = 0;
    let costKnown = true;
    let outputTokensAssumed = 0;
    chunks.forEach((chunk) => {
      const one = llm.estimate({
        systemPrompt: systemPrompt,
        userPrompt: api.buildUserPrompt(chunk),
        model: opts.model,
        pass: llm.PASSES.PASS,
        sends: SENDS_PER_CHUNK,
      });
      if (!one) return;
      inputTokens += one.inputTokens || 0;
      outputTokensAssumed += one.outputTokensAssumed || 0;
      if (typeof one.costUsd === "number") costUsd += one.costUsd;
      else costKnown = false;
    });

    // THE PLAUSIBILITY SEND, ONE PER CHUNK, FROM `estimate` FOR THE THIRD PASS
    // ON THE SAME CHUNKS (stage `pl`, ruling 8). It is part of the pass's price
    // so the tier, the spend cap and the red-tier confirmation all see it. A
    // pass the adapter reports `unavailable` adds nothing at all: its shape
    // carries `sends: 0`, but it also carries input tokens, so reading the
    // flag is what keeps those out of the total.
    let plausibilitySends = 0;
    chunks.forEach((chunk) => {
      const one = api.plausibilityEstimateFor(chunk);
      if (!one || one.unavailable) return;
      plausibilitySends += PLAUSIBILITY_SENDS_PER_CHUNK;
      inputTokens += one.inputTokens || 0;
      outputTokensAssumed += one.outputTokensAssumed || 0;
      if (typeof one.costUsd === "number") costUsd += one.costUsd;
      else costKnown = false;
    });

    return {
      model: modelId,
      inputTokens: inputTokens,
      outputTokensAssumed: outputTokensAssumed,
      sends: chunks.length + plausibilitySends,
      plausibilitySends: plausibilitySends,
      chunks: chunks.length,
      costUsd: costKnown ? costUsd : null,
      tier: costKnown ? tierOf(costUsd) : unknownTier(),
    };
  }

  /**
   * One chunk's plausibility estimate, through the adapter's own `estimate`
   * for the third pass, or null where none can be made. The pass and the
   * prompts are read off the adapter at CALL time. With no model override: the
   * pass is measured on one model only, so the cue-level model choice never
   * reaches it.
   *
   * A NAMED SEAM, so a suite can switch the whole addition off and redden
   * exactly the rows that name it.
   *
   * @param {object} chunk
   * @returns {object|null} the adapter's estimate shape, possibly `unavailable`
   */
  function plausibilityEstimateFor(chunk) {
    const llm = window.CaptionsFixerLLM;
    const pass = llm && llm.PASSES ? llm.PASSES.PLAUSIBILITY : undefined;
    if (!pass || typeof llm.estimate !== "function" || typeof llm.buildPlausibilityUserPrompt !== "function") return null;
    const ids = api.knownIdsFor(chunk);
    const userPrompt = llm.buildPlausibilityUserPrompt(api.buildUserPrompt(chunk), ids[0], ids[ids.length - 1]);
    if (userPrompt === null) return null;
    return llm.estimate({
      systemPrompt: llm.PROMPT_PLAUSIBILITY,
      userPrompt: userPrompt,
      pass: pass,
      sends: PLAUSIBILITY_SENDS_PER_CHUNK,
    });
  }

  /**
   * The model the plausibility pass would use, or null where it does not run.
   * Resolved with the PASS ALONE, never the caller's `model`: `resolveModel`
   * lets an explicit model win outright, so passing the cue-level override
   * here would send the plausibility prompt to a model nobody measured it on.
   * `PASS_UNAVAILABLE` (a null preference, or gpt-6-sol not eligible) reads as
   * null, which is "send nothing", and so does an adapter without the pass.
   *
   * @returns {string|null}
   */
  function resolvePlausibilityModelId() {
    const llm = window.CaptionsFixerLLM;
    const pass = llm && llm.PASSES ? llm.PASSES.PLAUSIBILITY : undefined;
    if (!pass || typeof llm.resolveModel !== "function") return null;
    const id = llm.resolveModel({ pass: pass });
    return id && id !== llm.PASS_UNAVAILABLE ? id : null;
  }

  /** The adapter's own "unknown" tier, read rather than copied. */
  function unknownTier() {
    const llm = window.CaptionsFixerLLM;
    return (llm && llm.UNKNOWN_TIER) || "unknown";
  }

  /**
   * The warning tier a total cost falls in, from the embed's own threshold
   * function. See `estimatePass` for why this is not summed.
   *
   * @param {number} costUsd
   * @returns {string}
   */
  function tierOf(costUsd) {
    const llm = window.CaptionsFixerLLM;
    const embed = llm && typeof llm.getEmbed === "function" ? llm.getEmbed() : null;
    const utils = embed && embed.fileUtils;
    if (!utils || typeof utils.shouldWarnAboutCost !== "function") {
      logWarn("tierOf: the embed's fileUtils is unavailable; reporting an unknown tier");
      return unknownTier();
    }
    return utils.shouldWarnAboutCost(costUsd);
  }

  // ==========================================================================
  // RUN
  // ==========================================================================

  /**
   * Persist a patch through the context, without letting a storage failure lose
   * the send. A rejection here is logged and swallowed on purpose: the caller
   * is holding the reply in memory and returning it, so a failed write must not
   * turn a successful, paid-for send into a thrown error with nothing to show.
   *
   * Copied from the recurring stage rather than shared, because sharing it
   * would mean this stage depending on that one at call time for a five-line
   * helper; the comment above is the whole contract and it is stated in both
   * files on purpose.
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
   * The cue-level pass: one send per chunk, in order, every reply on disk
   * before it is read.
   *
   * THE CANCEL IS READ AT THE TOP OF EACH CHUNK ITERATION AND NOWHERE ELSE,
   * which is the orchestrator's own rule applied one level down. A cancel
   * returns the entries from the chunks already completed, with
   * `halted: "cancelled"` — the chunks that were paid for are kept, persisted
   * and shown, exactly as a cancel between the two discovery sends keeps reply
   * one's pairs.
   *
   * A CHUNK WHOSE REPLY CANNOT BE PARSED IS RECORDED AND THE PASS CARRIES ON.
   * ANYTHING ELSE STILL ENDS IT AND RETHROWS.
   *
   * THIS OVERTURNS THE RULE THAT STOOD HERE UNTIL 20 SEPTEMBER 2026, and the
   * argument it overturns is worth keeping so nobody re-derives it. The comment
   * read: *"A SEND THAT THROWS ENDS THE PASS AND RETHROWS. … Degrading to a
   * partial pass without saying so would present a transcript checked to chunk
   * 4 as one checked to chunk 11."* The reasoning is sound and the remedy was
   * the wrong one. Round cf-6 measured its price: **78 paid-for proposals
   * across five runs**, every one of them already on disk under `passRaw`,
   * every run reported as zero entries. The pass threw away ten good chunks to
   * avoid overstating what the eleventh covered.
   *
   * WHAT IS CLOSED AND WHAT IS NOT, said plainly. What is closed is the loss of
   * the paid-for entries. What is NOT closed is the honesty problem the old
   * comment names: the surface still does not tell the person a pass was
   * partial. `failedChunks` on the return value and a WARN in the log are how
   * this file says so; saying it on screen or in the spoken line is a wording
   * change with a listen attached, and it is recorded as owed rather than
   * quietly counted as done.
   *
   * ONLY `isParseFailure` CONTINUES. A cancel carries `reason: "cancelled"` and
   * still ends the pass, so the cancel path above is untouched.
   *
   * @param {Array<object>} cueList the APPLIED list, after the recurring pairs
   * @param {object} [context] `{ persist, signal, model, glossary, recurringEntries }`;
   *   `recurringEntries` is the recurring set the caption check leaves alone
   * @returns {Promise<{ changeSet: Array<object>, halted: string|null, failedChunks: number }>}
   */
  async function run(cueList, context) {
    if (!Array.isArray(cueList)) {
      throw new TypeError("run() needs a cue list array.");
    }
    const ctx = context || {};
    const llm = window.CaptionsFixerLLM;
    if (!llm || typeof llm.complete !== "function") {
      throw new Error("run(): window.CaptionsFixerLLM is not on the page.");
    }

    const modelId = resolveModelId(ctx);
    const chunks = api.chunksFor(cueList, modelId);
    if (chunks.length === 0) {
      logWarn("run: no chunks to send");
      return { changeSet: [], halted: null, failedChunks: 0 };
    }

    const systemPrompt = Array.isArray(ctx.glossary) ? api.buildSystemPrompt(ctx.glossary) : api.buildSystemPrompt();

    // THE PLAUSIBILITY PASS, resolved once for the run: null where it does not
    // run (OpenRouter, or gpt-6-sol not eligible on Foundry), and then nothing
    // below sends, records or warns about it. `recurringEntries` is the
    // recurring set a caller hands over; absent, it is empty. A caption with an
    // entry there gets no check row, the same as one with a proposal here.
    const plausibilityModel = api.resolvePlausibilityModelId();
    const recurringEntries = Array.isArray(ctx.recurringEntries) ? ctx.recurringEntries : [];

    // APPEND-ONLY, AND EVERY WRITE IS A COPY OF IT. This is the array that
    // makes each `passRaw` write a strict superset of the one before it; see
    // the file header for why that property lives here and not in the store.
    const records = [];
    let entries = [];
    let failedChunks = 0;

    for (let index = 0; index < chunks.length; index += 1) {
      // THE CANCEL READ, at the top of the iteration and nowhere else.
      if (ctx.signal && ctx.signal.aborted) {
        logInfo(`run: cancelled before chunk ${index + 1} of ${chunks.length}; ${entries.length} entr(y/ies) kept`);
        return { changeSet: entries, halted: HALTED.CANCELLED, failedChunks: failedChunks };
      }

      const chunk = chunks[index];
      const cueIds = Array.isArray(chunk.cueIds) ? chunk.cueIds : [];

      if (typeof ctx.onChunk === "function") ctx.onChunk(index + 1, chunks.length);

      let reply;
      try {
        reply = await llm.complete({
          systemPrompt: systemPrompt,
          userPrompt: api.buildUserPrompt(chunk),
          // THROUGH `api` LIKE EVERY OTHER SIBLING, AND A CONSTANT IS NOT
          // EXEMPT. The lexical read here was the last survivor of the
          // api-routing sweep, which looked for CALLS and therefore could not
          // see a constant — so the row asserting the schema names `idKey`
          // could not fail under the inversion named for it.
          schema: api.REPLY_SCHEMA,
          knownIds: api.knownIdsFor(chunk),
          model: ctx.model,
          pass: llm.PASSES.PASS,
          signal: ctx.signal,
        });
      } catch (error) {
        // THE PATH WHERE LOSING THE BYTES WOULD ACTUALLY COST MONEY. `complete`
        // attaches the raw reply to a parse rejection; write it before the
        // rejection travels any further, so a reply nobody could parse is still
        // on disk to look at — and write it as part of the whole array, so the
        // ten chunks before it survive the failure too.
        //
        // THE RECORD IS WRITTEN WHETHER OR NOT THE ERROR CARRIES BYTES. cf-6
        // measured that EIGHT OF TEN would-be raw strings did not exist, so an
        // empty `raw` is a real state rather than a gap — and a chunk that
        // failed with nothing to show for it still has to appear in `passRaw`,
        // or the array silently stops being one record per chunk and every
        // index after it names the wrong send.
        const raw = error && typeof error.raw === "string" ? error.raw : "";
        const failure = {
          reason: error && error.reason ? error.reason : "",
          message: error && error.message ? error.message : "",
        };
        records.push(chunkRecord(index, cueIds, raw, null, modelId, 0, emptyDropped(), emptyRepaired(), failure, error));
        await api.persistQuietly(ctx, { [FIELD_PASS_RAW]: records.slice() });
        if (!api.isParseFailure(error)) throw error;
        failedChunks += 1;
        logWarn(
          `run: chunk ${index + 1} of ${chunks.length} was skipped, reason ${failure.reason} (${failure.message}); ` +
            `its reply is under ${FIELD_PASS_RAW} and the pass continues`,
        );
        continue;
      }

      // BEFORE anything here reads a single proposal. The whole array, so this
      // write cannot lose the ones before it.
      const record = chunkRecord(index, cueIds, reply.raw, reply.usageRaw, reply.model, reply.discarded, emptyDropped(), emptyRepaired(), null, reply);
      records.push(record);
      await api.persistQuietly(ctx, { [FIELD_PASS_RAW]: records.slice() });

      const parsed = api.entriesFromReply(chunk, cueList, reply.data);
      // The drop counts belong to the record that is already on disk, so they
      // are written into it and the array persisted again. The reply's own
      // bytes reached disk before this line and are not at risk either way.
      record.dropped = parsed.dropped;
      record.repaired = parsed.repaired;
      await api.persistQuietly(ctx, { [FIELD_PASS_RAW]: records.slice() });

      // THE CAPTION CHECK. One extra send for this chunk, after the cue-level
      // reply is parsed and on disk; its reading lives in the record, and a
      // check entry is made only for a low score on a caption with no entry
      // of any status in this chunk's parsed entries or the recurring set.
      // A chunk that could not be scored says so once and yields none, and the
      // cue-level entries are untouched whatever happens here.
      let checkEntries = [];
      if (plausibilityModel) {
        const reading = await api.scoreChunk(chunk, record, records, ctx);
        if (reading.scores === null) {
          logWarn(
            `run: chunk ${index + 1} of ${chunks.length} could not be scored for plausibility (${reading.refusal}); ` +
              `it yields no check rows, and its cue-level entries are unaffected`,
          );
        }
        checkEntries = api.checkEntriesFor(chunk, cueList, reading.scores, parsed.entries.concat(recurringEntries));
      }

      entries = entries.concat(parsed.entries, checkEntries);
      logDebug(
        `run: chunk ${index + 1} of ${chunks.length} gave ${parsed.entries.length} entr(y/ies), ` +
          `${reply.discarded} discarded by the schema, ` +
          `${parsed.dropped.unchanged} unchanged, ${parsed.dropped.lineBreaks} line-break, ${parsed.dropped.unreadable} unreadable, ` +
          `${parsed.dropped.duplicate} duplicate, ${parsed.dropped.cuePrefix} cue-prefix, ${parsed.dropped.speakerLabel} speaker-label, ` +
          `${parsed.dropped.tags} tag-damaging; ` +
          `${parsed.repaired.speakerLabel} speaker-label repaired`,
      );
    }

    if (failedChunks > 0) {
      // A PARTIAL PASS MUST NOT BE SILENT. This is the only place today that
      // says so; the surface does not yet, and that is recorded as owed.
      logWarn(
        `run: ${failedChunks} of ${chunks.length} chunk(s) were skipped because the reply could not be used (unparseable or cut off at its limit) — ` +
          `this transcript has NOT been checked end to end`,
      );
    }
    logInfo(`run: ${entries.length} caption change(s) proposed across ${chunks.length} chunk(s)`);
    return { changeSet: entries, halted: null, failedChunks: failedChunks };
  }

  /**
   * A fresh, all-zero drop tally. `entriesFromReply` builds its own from this
   * rather than repeating the literal, so a seventh reason cannot reach one
   * site and miss the other — which is how a failed chunk's record and a clean
   * chunk's record would otherwise come to carry different keys.
   */
  function emptyDropped() {
    return {
      [DROP_REASONS.UNCHANGED]: 0,
      [DROP_REASONS.LINE_BREAKS]: 0,
      [DROP_REASONS.UNREADABLE]: 0,
      [DROP_REASONS.DUPLICATE]: 0,
      [DROP_REASONS.CUE_PREFIX]: 0,
      [DROP_REASONS.SPEAKER_LABEL]: 0,
      [DROP_REASONS.TAGS]: 0,
    };
  }

  /** A fresh, all-zero repair tally, for the same reason. */
  function emptyRepaired() {
    return {
      [REPAIR_REASONS.SPEAKER_LABEL]: 0,
    };
  }

  /**
   * One chunk's `passRaw` record. `cueIds` is the FIRST AND LAST primary id
   * rather than the whole list: the record exists so a person can find the
   * reply that covers a caption, and sixty ids per chunk would make eleven
   * records unreadable for no gain.
   *
   * @param {number} index
   * @param {Array<string|number>} cueIds
   * @param {string} raw
   * @param {object|null} usageRaw
   * @param {string|null} model
   * `error` IS `null` ON EVERY CLEAN CHUNK RATHER THAN ABSENT, so a reader
   * scanning `passRaw` for a failure never has to tell "this chunk succeeded"
   * apart from "this record predates the field".
   *
   * @param {number} discarded
   * @param {object} dropped
   * @param {object} repaired
   * @param {{reason: string, message: string}|null} [error]
   * @param {{maxOutputTokens?: number, reasoningEffort?: string|null}|null} [sentFrom]
   *   whatever `complete` handed back for this chunk, or the error it threw;
   *   only the two fields are read. Stage `cr`.
   * @returns {object}
   */
  function chunkRecord(index, cueIds, raw, usageRaw, model, discarded, dropped, repaired, error, sentFrom) {
    const source = sentFrom && typeof sentFrom === "object" ? sentFrom : {};
    return {
      index: index,
      cueIds: cueIds.length > 0 ? [cueIds[0], cueIds[cueIds.length - 1]] : [],
      raw: raw,
      // Carried through UNTOUCHED from the adapter: the token counts are paid
      // for, so they travel with the reply rather than being re-derived.
      usageRaw: usageRaw !== undefined ? usageRaw : null,
      model: model,
      discarded: typeof discarded === "number" ? discarded : 0,
      dropped: dropped,
      repaired: repaired,
      error: error || null,
      // WHAT WAS SENT, read off what `complete` returned (or off the two throw
      // routes that carry it: TRUNCATED, PARSE and, since stage `sp`, SEND) and
      // never off a constant.
      // `null` AND `null` where it did not return the pair: a cancel and the
      // argument checks throw before the adapter has read the
      // instance, so there is nothing to copy, and the record says so rather
      // than the stage guessing. Nothing WARNs for it. The names say "sent" so
      // nobody reads them as the model's declared limit.
      sentMaxOutputTokens: typeof source.maxOutputTokens === "number" ? source.maxOutputTokens : null,
      sentReasoningEffort: typeof source.reasoningEffort === "string" ? source.reasoningEffort : null,
    };
  }

  // ==========================================================================
  // THE CAPTION CHECK — stage `pl`, work item 4
  // ==========================================================================

  /**
   * Can the pass carry on after this plausibility failure? ALWAYS, and the
   * function exists so the claim has somewhere to fail. A plausibility send
   * that throws — a provider error, a reply `complete` could not parse, a
   * cancel — must never cost the chunk's cue-level entries, which were paid
   * for and are already in hand; a cancel is read at the top of the next
   * chunk's iteration as it always was. Exported and reached through `api`,
   * the shape of `isParseFailure`, so a suite can make it false.
   *
   * @param {*} _error
   * @returns {boolean}
   */
  function isSurvivablePlausibilityFailure(_error) {
    return true;
  }

  /**
   * One chunk's plausibility send: the request, the reply on disk, then the
   * parse, the reading kept in the chunk's own `passRaw` record under
   * `plausibility` as `{ raw, scores | null, refusal | null }`.
   *
   * THE REPLY IS WRITTEN BEFORE IT IS PARSED, as the cue-level reply is: the
   * reading goes on the record with its raw and no result, the whole array is
   * persisted, and only then does the parser run. A send that fails is
   * recorded the same way, raw empty (or the adapter's raw where the reply
   * arrived and could not be read) and the refusal named, and then survived.
   *
   * THE REPLY IS READ FROM `complete`'S RAW, never from its `data`: the schema
   * is the object one, the parser is the adapter's, and an array schema would
   * have read the reply as an empty list.
   *
   * @param {object} chunk
   * @param {object} record the chunk's record, already in `records`
   * @param {Array<object>} records the append-only array every write copies
   * @param {object} context `{ persist, signal }`
   * @returns {Promise<{ raw: string, scores: object|null, refusal: string|null, sentMaxOutputTokens: number|null, sentReasoningEffort: string|null }>}
   */
  async function scoreChunk(chunk, record, records, context) {
    const llm = window.CaptionsFixerLLM;
    const ids = api.knownIdsFor(chunk);
    // Stage `sp`: the pair this send was made with, `null` and `null` until a reply or a
    // rejection carries it (and for the not-sent refusal, which makes no send).
    const reading = { raw: "", scores: null, refusal: null, sentMaxOutputTokens: null, sentReasoningEffort: null };
    record[FIELD_PLAUSIBILITY] = reading;
    const readSentPair = (source) => {
      if (!source || typeof source !== "object") return;
      if (typeof source.maxOutputTokens === "number") reading.sentMaxOutputTokens = source.maxOutputTokens;
      if (typeof source.reasoningEffort === "string") reading.sentReasoningEffort = source.reasoningEffort;
    };

    const userPrompt = llm.buildPlausibilityUserPrompt(api.buildUserPrompt(chunk), ids[0], ids[ids.length - 1]);
    if (userPrompt === null) {
      reading.refusal = PLAUSIBILITY_NOT_SENT;
      await api.persistQuietly(context, { [FIELD_PASS_RAW]: records.slice() });
      return reading;
    }

    let reply;
    try {
      reply = await llm.complete({
        systemPrompt: llm.PROMPT_PLAUSIBILITY,
        userPrompt: userPrompt,
        schema: llm.PLAUSIBILITY_SCHEMA,
        knownIds: ids,
        pass: llm.PASSES.PLAUSIBILITY,
        signal: context.signal,
      });
    } catch (error) {
      reading.raw = error && typeof error.raw === "string" ? error.raw : "";
      readSentPair(error);
      reading.refusal = PLAUSIBILITY_SEND_FAILED;
      await api.persistQuietly(context, { [FIELD_PASS_RAW]: records.slice() });
      if (!api.isSurvivablePlausibilityFailure(error)) throw error;
      return reading;
    }

    reading.raw = typeof reply.raw === "string" ? reply.raw : "";
    readSentPair(reply);
    await api.persistQuietly(context, { [FIELD_PASS_RAW]: records.slice() });

    const outcome = llm.plausibilityScoresFromReply(reading.raw, ids);
    reading.scores = outcome.ok ? outcome.scores : null;
    reading.refusal = outcome.ok ? null : outcome.reason;
    await api.persistQuietly(context, { [FIELD_PASS_RAW]: records.slice() });
    return reading;
  }

  /**
   * The check entries for one chunk: a caption scored at or below the bar that
   * has NO entry of any status for its cue id in `existingEntries` (this
   * chunk's parsed entries after the drop rules, and the recurring set). A
   * caption whose proposal a drop rule removed has no entry, so it is flagged;
   * one that holds a proposal or a recurring row is never also a check row.
   *
   * `scores` null (an unscored chunk) gives none. The bar is read off the
   * adapter at call time. `original` is the cue list's text, the same source
   * a proposal's is.
   *
   * @param {object} chunk
   * @param {Array<object>} cueList the list this pass ran on
   * @param {object|null} scores cue id (as a string) to integer score, or null
   * @param {Array<object>} existingEntries entries that already speak for a cue
   * @returns {Array<object>}
   */
  function checkEntriesFor(chunk, cueList, scores, existingEntries) {
    const llm = window.CaptionsFixerLLM;
    const bar = llm && typeof llm.PLAUSIBILITY_BAR === "number" ? llm.PLAUSIBILITY_BAR : null;
    if (bar === null || !scores) return [];
    const cueByStringId = new Map((Array.isArray(cueList) ? cueList : []).map((cue) => [String(cue && cue.id), cue]));
    const taken = new Set((Array.isArray(existingEntries) ? existingEntries : []).map((entry) => String(entry && entry.cueId)));
    const checks = [];
    api.knownIdsFor(chunk).forEach((id) => {
      const score = scores[String(id)];
      if (typeof score !== "number" || score > bar) return;
      if (taken.has(String(id))) return;
      const cue = cueByStringId.get(String(id));
      if (!cue || typeof cue.text !== "string") return;
      checks.push({
        cueId: cue.id,
        original: cue.text,
        proposed: null,
        source: SOURCE_CHECK,
        reason: CHECK_REASON,
        confidence: null,
        status: STATUS_CHECK,
        rejectedBy: null,
      });
    });
    return checks;
  }

  logInfo("Captions Fixer cue-level pass loaded");

  const api = {
    // the stage, as the orchestrator runs it
    run: run,
    estimatePass: estimatePass,
    // the prompt, exported so a row can read it and a person can review it
    buildSystemPrompt: buildSystemPrompt,
    buildUserPrompt: buildUserPrompt,
    buildRangeLine: buildRangeLine,
    // pure helpers, exported so the suite can bind them by inversion
    entriesFromReply: entriesFromReply,
    persistQuietly: persistQuietly,
    chunkOptionsFor: chunkOptionsFor,
    chunksFor: chunksFor,
    knownIdsFor: knownIdsFor,
    countLineBreaks: countLineBreaks,
    proposalChangesSomething: proposalChangesSomething,
    labelOf: labelOf,
    isParseFailure: isParseFailure,
    emptyDropped: emptyDropped,
    emptyRepaired: emptyRepaired,
    chunkRecord: chunkRecord,
    // the caption check (stage `pl`), exported so a suite can bind each seam
    scoreChunk: scoreChunk,
    checkEntriesFor: checkEntriesFor,
    plausibilityEstimateFor: plausibilityEstimateFor,
    resolvePlausibilityModelId: resolvePlausibilityModelId,
    isSurvivablePlausibilityFailure: isSurvivablePlausibilityFailure,
    // constants
    STAGE_NAME: STAGE_NAME,
    SOURCE: SOURCE,
    SOURCE_CHECK: SOURCE_CHECK,
    STATUS_CHECK: STATUS_CHECK,
    CHECK_REASON: CHECK_REASON,
    FIELD_PLAUSIBILITY: FIELD_PLAUSIBILITY,
    PLAUSIBILITY_SEND_FAILED: PLAUSIBILITY_SEND_FAILED,
    PLAUSIBILITY_NOT_SENT: PLAUSIBILITY_NOT_SENT,
    PLAUSIBILITY_SENDS_PER_CHUNK: PLAUSIBILITY_SENDS_PER_CHUNK,
    STATUS_PROPOSED: STATUS_PROPOSED,
    PASS_CONFIDENCE: PASS_CONFIDENCE,
    CHANGE_SET_FIELDS: CHANGE_SET_FIELDS,
    HALTED: HALTED,
    FIELD_PASS_RAW: FIELD_PASS_RAW,
    FIELD_PASS_ENTRIES: FIELD_PASS_ENTRIES,
    REPLY_SCHEMA: REPLY_SCHEMA,
    LOCAL_MODEL_PREFIX: LOCAL_MODEL_PREFIX,
    CUE_LINE_PREFIX: CUE_LINE_PREFIX,
    CUE_LINE_SUFFIX: CUE_LINE_SUFFIX,
    CUE_LINE_SEPARATOR: CUE_LINE_SEPARATOR,
    SENDS_PER_CHUNK: SENDS_PER_CHUNK,
    DROP_REASONS: DROP_REASONS,
    REPAIR_REASONS: REPAIR_REASONS,
    CUE_PREFIX_PATTERN: CUE_PREFIX_PATTERN,
    SPEAKER_LABEL_PATTERN: SPEAKER_LABEL_PATTERN,
    ERROR_REASON_PARSE: ERROR_REASON_PARSE,
    ERROR_REASON_TRUNCATED: ERROR_REASON_TRUNCATED,
    SURVIVABLE_ERROR_REASONS: SURVIVABLE_ERROR_REASONS,
    BLOCK_ROLE: BLOCK_ROLE,
    BLOCK_TASK: BLOCK_TASK,
    BLOCK_CONSERVATIVE: BLOCK_CONSERVATIVE,
    BLOCK_NUMBERS: BLOCK_NUMBERS,
    BLOCK_SPEAKER_LABELS: BLOCK_SPEAKER_LABELS,
    BLOCK_LINE_BREAKS: BLOCK_LINE_BREAKS,
    BLOCK_SHAPE: BLOCK_SHAPE,
    GLOSSARY_NONE: GLOSSARY_NONE,
    GLOSSARY_TERM_SEPARATOR: GLOSSARY_TERM_SEPARATOR,
  };
  return api;
})();

// The const above is a top-level BINDING, not a window property, so the alias
// below is what makes window.CaptionsFixerStageLlmPass resolve at all — the
// same arrangement, for the same reason, as captions-fixer-llm.js:1062.
window.CaptionsFixerStageLlmPass = CaptionsFixerStageLlmPass;
