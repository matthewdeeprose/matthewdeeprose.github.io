/**
 * @file captions-fixer-guards.js
 * @description The guards — pure functions that judge ONE change-set entry at
 * a time and hold back any proposal that changes something a conservative
 * corrector must never change. Every stage's output passes through
 * `runGuards`; nothing else decides what is held back.
 *
 * THE SHAPE THEY READ AND WRITE (unchanged from the master plan)
 * -------------------------------------------------------------
 *   { cueId, original, proposed, source, reason, confidence, status, rejectedBy }
 *
 * A guard is `(entry) => null | "<guard name>"`. `runGuards(entry, guards)`
 * returns a NEW entry: a copy of the input when every guard returns null;
 * otherwise a copy with `status: "rejected"` and `rejectedBy: "guard:<name>"`
 * for the FIRST guard that fails. `reason` is left exactly as the stage wrote
 * it — a guard explains why it held, never why the stage proposed.
 *
 * GUARDS NEVER READ THE CUE LIST. A check that needs a neighbouring cue is a
 * stage, not a guard. The one guard that needs outside knowledge —
 * `cueIdKnown` — takes it through a CLOSURE built by `makeCueIdKnown(cueIds)`,
 * so the orchestrator binds it once per file and the guard itself still takes
 * one argument like every other.
 *
 * A GUARD THAT CANNOT DECIDE PASSES. Null or undefined text on either side is
 * the calling stage's bug, not a proposal to hold: the guards return null and
 * `hasReadableText` is exported so a caller (or a suite) can refuse such an
 * entry outright. Holding it would disguise a stage defect as a cautious
 * corrector.
 *
 * WHY TWO NUMBER GUARDS AND NOT ONE
 * ---------------------------------
 * Numbers are immutable IN EITHER FORM. The corrector never turns "twenty
 * five" into 25 or 25 into "twenty five"; the house-style stage (Release 3)
 * does that deterministically with its own check. So `digitsUnchanged`
 * compares the multiset of digit tokens and `numberWordsUnchanged` compares
 * the multiset of number words, and a proposal that moves a value from one
 * form to the other fails whichever of the two is named first.
 *
 * "one" is on the number-word list even where it is a pronoun ("the one I
 * mean"), so a reworded sentence that drops it is held. An occasional
 * over-hold is the intended trade: a held entry is one a person can still
 * accept from the review table, and a wrongly-applied number is not.
 *
 * A DIGIT TOKEN CARRIES ITS SUFFIX, AND THAT IS A DELIBERATE READING.
 * The Stage 3 dispatch defines the token as a maximal digit run that may hold
 * "," or "." BETWEEN digits, so that `91,000` and `0.05` are single tokens;
 * its verification table separately requires `1990s -> 1990` to be HELD. Those
 * two do not agree — under digits alone both sides read {1990} and the
 * proposal passes. The token here therefore also takes any letters immediately
 * FOLLOWING the digits, so `1990s`, `21st`, `3D` and `5km` are single tokens
 * and dropping the suffix is a change of number form like any other. Letters
 * immediately BEFORE are deliberately not taken, so `COP28` reads {28} and an
 * ordinary spelling fix around a number is not held. Reported to Matthew at
 * the Stage 3 checkpoint rather than resolved silently.
 *
 * TAGS ARE STRUCTURE, AND A TAG'S POSITION IS MEASURED BY THE CHARACTER
 * FACING IT — NEVER BY AN OFFSET.
 * `tagsPreserved` splits each side at its tag tokens and compares two things
 * and nothing else: the ordered list of tokens, byte for byte, and for every
 * token the single character of text FACING it on each side — the last
 * character before it and the first character after it, with "no character at
 * all" (the tag sits at the very start or end of the caption) counting as a
 * value of its own. A caption with no tags has no tokens and no facing
 * characters, so nothing is compared and it passes whatever the fix.
 *
 * An offset cannot be used, and that is a measurement rather than a
 * preference: an approved recurring pair that shortens a phrase earlier in the
 * caption moves every later tag's offset without touching the tags at all, so
 * an offset rule would hold the ordinary correction this tool exists to make.
 * The character a tag abuts does not move with it.
 *
 * A SECOND CLAUSE, ADDED 21 September 2026: WHEN THE WORDS ARE UNTOUCHED,
 * NOTHING JUSTIFIES A TAG HAVING MOVED. Two facing characters can COINCIDE
 * across a move, and then the first clause alone passes real damage —
 * `the <i>big</i> bag now` to `the big <i>bag</i> now` has the same two
 * tokens, and `<i>` faces a space and a "b" on both sides while `</i>` faces a
 * "g" and a space on both. Measured against the shipped guard before the
 * clause was written, and it passed. So: if the two captions are identical
 * once every tag token is removed, they must be identical outright, and
 * anything else is held. A proposal that fixes nothing has no correction to
 * protect, so there is no cost to holding it.
 *
 * ONE CASE REMAINS THAT THIS RULE PASSES WRONGLY, AND IT IS PINNED RATHER THAN
 * ENGINEERED AWAY: a coinciding move COMBINED with a word fix elsewhere in the
 * same caption. The second clause cannot see it, because the words differ; the
 * first cannot, because the facing characters coincide. Closing it needs an
 * alignment between the two texts, and every cheaper anchor has already been
 * measured to fail — an offset moves under an ordinary fix, and so does a word
 * index, on the fixture's own cue 45 where `dell brook` to `Delbrück` changes
 * both. Pinned as a suite row carrying the word TODAY.
 *
 * IT HOLDS WHEN IT CANNOT DECIDE, AND ONE CASE IS GENUINELY UNDECIDABLE. A fix
 * landing on the very character that faces a tag — `teh<i>x</i>` to
 * `the<i>x</i>` — is indistinguishable at that character from a tag that has
 * moved onto other words, which is case (v) and must be held. Both are held.
 * A held entry is one a person can still accept; a silently moved tag is not.
 *
 * THE TOKEN SHAPE IS THE SHIPPED ONE AND THE SUITE'S IS DELIBERATELY SEPARATE.
 * `captions-fixer-tests-cues.js` keeps its own pattern as an independent
 * counter — a suite reading this pattern could not detect a wrong pattern —
 * and a row asserts the two select the same fourteen tagged cues over the
 * multi-line fixture.
 *
 * SYMBOLS ARE A ONE-WAY DOOR. `noSymbolsIntroduced` fails on any forbidden
 * character the proposal carries and the original does not. A symbol already
 * in the original may stay — that is what makes it a door and not a ban, and
 * it is why a cue that already holds an inline `<i>` tag is not held for its
 * own angle brackets.
 *
 * IT SPEAKS TO NOTHING, TOUCHES NO DOM AND DEPENDS ON NO OTHER MODULE. Two
 * constants mirror values that also live in captions-fixer-cues.js — the
 * rejected status and the `Speaker N: ` label form — rather than being read
 * off it at call time, so this module stays a dependency of nothing. The suite
 * proves the mirrors have not drifted, against the cue module's own exported
 * STATUS and against labels written by the real `toSrt()`.
 *
 * `DEFAULT_GUARDS` is read THROUGH the exported object by `runGuards`, not
 * through the closure, so a suite can disable one guard by patching one
 * property and the product follows — an unpatchable seam is an unprovable one.
 * `makeCueIdKnown` is reached the same way by any caller building the list.
 *
 * @module CaptionsFixerGuards
 * @since 7 September 2026
 */
const CaptionsFixerGuards = (function () {
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
      console.error(`[CaptionsFixerGuards] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[CaptionsFixerGuards] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[CaptionsFixerGuards] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[CaptionsFixerGuards] ${message}`, ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  /**
   * The guard names, which are also the strings a guard returns when it holds.
   * Frozen so a typo at a call site is a lookup of undefined rather than a
   * silently different name in `rejectedBy`.
   */
  const GUARD_NAMES = Object.freeze({
    CUE_ID_KNOWN: "cueIdKnown",
    SPEAKER_LABEL_UNCHANGED: "speakerLabelUnchanged",
    DIGITS_UNCHANGED: "digitsUnchanged",
    NUMBER_WORDS_UNCHANGED: "numberWordsUnchanged",
    NO_SYMBOLS_INTRODUCED: "noSymbolsIntroduced",
    LENGTH_WITHIN_BOUND: "lengthWithinBound",
    TAGS_PRESERVED: "tagsPreserved",
  });

  /** `rejectedBy` is `"guard:" + the guard's name`; "person" is the other form. */
  const REJECTED_BY_PREFIX = "guard:";

  /**
   * MIRRORS `CaptionsFixerCues.STATUS.REJECTED`. Held here as a local constant
   * so this module depends on nothing; the suite asserts the two are equal, so
   * a drift is a red row rather than a silent divergence.
   */
  const STATUS_REJECTED = "rejected";

  /**
   * MIRRORS how `toSrt()` composes a label in
   * openrouter-embed-transcribe.js (~:588): the prefix, the speaker number,
   * then the suffix, at the very start of the cue text. Neither piece carries
   * a regular-expression metacharacter, so they compose into the pattern
   * directly. The suite asserts this pattern matches labels written by the
   * real writer, so the mirror cannot drift unnoticed.
   */
  const SPEAKER_LABEL_PREFIX = "Speaker ";
  const SPEAKER_LABEL_SUFFIX = ": ";
  const SPEAKER_NUMBER_SOURCE = "\\d+";
  const SPEAKER_LABEL_PATTERN = new RegExp(
    `^${SPEAKER_LABEL_PREFIX}${SPEAKER_NUMBER_SOURCE}${SPEAKER_LABEL_SUFFIX}`,
  );

  /**
   * A digit token: a maximal run of digits, with "," or "." permitted BETWEEN
   * digits, plus any letters immediately following. See the file header for
   * why the trailing letters are in and leading letters are out.
   *   91,000  0.05  1990s  21st  5km  3.14
   */
  const DIGIT_TOKEN_PATTERN = /\d+(?:[.,]\d+)*[A-Za-z]*/g;

  /** Letter runs, for the number-word tokeniser. Hyphens and punctuation split. */
  const LETTER_RUN_PATTERN = /[a-z]+/g;

  /**
   * The number words, lower case. Zero to twenty, then the tens, then the
   * scales, then the three fractions the resource's transcripts actually use.
   * A Set so membership is a lookup; the array is exported for proof-reading.
   */
  const NUMBER_WORD_LIST = Object.freeze([
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
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
    "hundred",
    "thousand",
    "million",
    "billion",
    "half",
    "quarter",
    "third",
  ]);
  const NUMBER_WORDS = new Set(NUMBER_WORD_LIST);

  /**
   * The forbidden characters, in four groups so each can be proof-read. A
   * proposal may keep any of them the original already carries; it may not
   * introduce one.
   *
   *   superscript digits  U+2070, U+00B9, U+00B2, U+00B3, U+2074 to U+2079
   *   subscript digits    U+2080 to U+2089
   *   mathematics         U+221A root, U+2211 n-ary sum, U+222B integral,
   *                       U+03C0 pi, U+2264 <=, U+2265 >=, U+2260 !=,
   *                       U+2192 right arrow
   *   markup and LaTeX    U+005C \, U+005E ^, U+005F _, U+0024 $,
   *                       U+007B {, U+007D }, U+003C <, U+003E >
   */
  const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
  const MATHEMATICAL_SYMBOLS = "√∑∫π≤≥≠→";
  const MARKUP_SYMBOLS = "\\^_${}<>";
  const FORBIDDEN_SYMBOL_LIST = Object.freeze(
    Array.from(
      SUPERSCRIPT_DIGITS + SUBSCRIPT_DIGITS + MATHEMATICAL_SYMBOLS + MARKUP_SYMBOLS,
    ),
  );
  const FORBIDDEN_SYMBOLS = new Set(FORBIDDEN_SYMBOL_LIST);

  /**
   * ONE INLINE TAG: an HTML-style tag, or a `{\…}` position tag. The two
   * shapes the resource's caption files actually carry, and the two the
   * fixture stage's counter reads.
   *
   * Held NON-GLOBAL and exported that way on purpose: a shared global regular
   * expression carries `lastIndex` between calls, so a caller testing one
   * caption would change what the next call sees. `tagsIn` builds its own
   * global copy from this one's `source` per call.
   *
   * The character classes exclude the delimiters — `[^<>]` rather than `[^>]`,
   * `[^{}]` rather than `[^}]` — so a run cannot swallow a following opening
   * delimiter and read two tags as one.
   */
  const TAG_TOKEN_PATTERN = /<\/?[A-Za-z][^<>]*>|\{\\[^{}]*\}/;

  /** How much of the text either side of a tag anchors it. See the header. */
  const FACING_CHARACTER_COUNT = 1;
  /** Between a tag's three parts, and between tags. Neither can occur in text. */
  const TAG_FIELD_SEPARATOR = "\u0000";
  const TAG_MARK_SEPARATOR = "\u0001";

  /**
   * A proposal longer than this multiple of the original is a hallucination
   * check, not a style judgement. A starting value; Stage 7's harness tunes it.
   */
  const MAX_LENGTH_RATIO = 1.5;

  /** An empty proposal against a non-empty original is a deletion, not a fix. */
  const EMPTY_LENGTH = 0;

  // ==========================================================================
  // SHARED READING
  // ==========================================================================

  /**
   * Can the text guards decide on this entry at all?
   *
   * Exported because "cannot decide" is a CALLER bug and deserves a caller's
   * response — a halt, a report — rather than a quiet hold that reads like a
   * cautious corrector.
   *
   * @param {*} entry
   * @returns {boolean} true when both `original` and `proposed` are strings
   */
  function hasReadableText(entry) {
    return (
      !!entry &&
      typeof entry === "object" &&
      typeof entry.original === "string" &&
      typeof entry.proposed === "string"
    );
  }

  /**
   * Every token the pattern finds, sorted, as one comparable string. Sorting
   * makes it a MULTISET comparison: order does not matter, count does.
   * @param {string} text
   * @param {RegExp} pattern - must carry the global flag
   * @param {(token: string) => boolean} [keep] - optional membership filter
   * @returns {string}
   */
  function multisetKey(text, pattern, keep) {
    const found = text.match(pattern) || [];
    const kept = keep ? found.filter(keep) : found;
    return kept.slice().sort().join("\u0000");
  }

  /**
   * Split a caption at its tag tokens into an alternating list — text, tag,
   * text, tag, … text. Always an odd length, and always starts and ends with a
   * text segment, which may be empty. That shape is what lets the caller read
   * a tag's neighbours without any index arithmetic.
   *
   * @param {string} text
   * @returns {Array<string>}
   */
  function tagParts(text) {
    const source = String(text);
    const pattern = new RegExp(TAG_TOKEN_PATTERN.source, "g");
    const parts = [];
    let from = 0;
    let match = pattern.exec(source);

    while (match !== null) {
      parts.push(source.slice(from, match.index));
      parts.push(match[0]);
      from = match.index + match[0].length;
      match = pattern.exec(source);
    }

    parts.push(source.slice(from));
    return parts;
  }

  /**
   * Every inline tag a caption carries, in order. Exported so the cue-level
   * pass stage and the suite read the SHIPPED notion of a tag rather than each
   * keeping its own.
   *
   * @param {string} text
   * @returns {Array<string>} the tag tokens, in document order
   */
  function tagsIn(text) {
    const parts = tagParts(text);
    const tags = [];
    for (let index = 1; index < parts.length; index += 2) {
      tags.push(parts[index]);
    }
    return tags;
  }

  /**
   * The caption with every tag token removed — its words, and nothing else.
   * Built from `tagParts` rather than from a second regular expression, so the
   * shipped notion of a tag cannot drift between this reading and the others.
   *
   * @param {string} text
   * @returns {string}
   */
  function tagStrippedText(text) {
    const parts = tagParts(text);
    const segments = [];
    for (let index = 0; index < parts.length; index += 2) {
      segments.push(parts[index]);
    }
    return segments.join("");
  }

  /**
   * One comparable string holding, for every tag, the character facing it on
   * the left, the tag itself, and the character facing it on the right. "" for
   * a tag at the very start or end of the caption, which is a value and not a
   * missing one. Empty for a caption with no tags, so two untagged captions
   * always compare equal.
   *
   * @param {string} text
   * @returns {string}
   */
  function tagSkeletonKey(text) {
    const parts = tagParts(text);
    const marks = [];

    for (let index = 1; index < parts.length; index += 2) {
      const facingLeft = parts[index - 1].slice(-FACING_CHARACTER_COUNT);
      const facingRight = parts[index + 1].slice(0, FACING_CHARACTER_COUNT);
      marks.push(facingLeft + TAG_FIELD_SEPARATOR + parts[index] + TAG_FIELD_SEPARATOR + facingRight);
    }

    return marks.join(TAG_MARK_SEPARATOR);
  }

  /**
   * The leading `Speaker N: ` label, or "" when there is none.
   * @param {string} text
   * @returns {string}
   */
  function labelOf(text) {
    const match = SPEAKER_LABEL_PATTERN.exec(text);
    return match ? match[0] : "";
  }

  // ==========================================================================
  // THE GUARDS — each takes one entry and returns null or its own name
  // ==========================================================================

  /**
   * Build the cue-id guard for one file. The orchestrator calls this once per
   * upload and prepends the result to `DEFAULT_GUARDS`, which omits it because
   * it cannot be built without a cue list.
   *
   * Membership is by SameValueZero, so the string "2" is not the number 2: a
   * stage that stringifies its ids is a stage with a bug, and this is where it
   * shows up rather than in a silent no-op at apply time.
   *
   * @param {Array<number>|Set<number>} cueIds - the ids the file actually has
   * @returns {(entry: object) => string|null}
   */
  function makeCueIdKnown(cueIds) {
    if (!Array.isArray(cueIds) && !(cueIds instanceof Set)) {
      throw new TypeError("makeCueIdKnown() needs an array or Set of cue ids.");
    }
    const known = new Set(cueIds);
    return function cueIdKnown(entry) {
      if (!entry || typeof entry !== "object") return null;
      return known.has(entry.cueId) ? null : GUARD_NAMES.CUE_ID_KNOWN;
    };
  }

  /**
   * The proposal keeps the original's speaker label exactly, or has none where
   * the original has none. The label is part of the cue TEXT, not metadata.
   * @param {object} entry
   * @returns {string|null}
   */
  function speakerLabelUnchanged(entry) {
    if (!hasReadableText(entry)) return null;
    return labelOf(entry.original) === labelOf(entry.proposed)
      ? null
      : GUARD_NAMES.SPEAKER_LABEL_UNCHANGED;
  }

  /**
   * The multiset of digit tokens is identical on both sides.
   * @param {object} entry
   * @returns {string|null}
   */
  function digitsUnchanged(entry) {
    if (!hasReadableText(entry)) return null;
    const before = multisetKey(entry.original, DIGIT_TOKEN_PATTERN);
    const after = multisetKey(entry.proposed, DIGIT_TOKEN_PATTERN);
    return before === after ? null : GUARD_NAMES.DIGITS_UNCHANGED;
  }

  /**
   * The multiset of number words is identical on both sides, case-insensitive.
   * @param {object} entry
   * @returns {string|null}
   */
  function numberWordsUnchanged(entry) {
    if (!hasReadableText(entry)) return null;
    const keep = (word) => NUMBER_WORDS.has(word);
    const before = multisetKey(entry.original.toLowerCase(), LETTER_RUN_PATTERN, keep);
    const after = multisetKey(entry.proposed.toLowerCase(), LETTER_RUN_PATTERN, keep);
    return before === after ? null : GUARD_NAMES.NUMBER_WORDS_UNCHANGED;
  }

  /**
   * The proposal introduces no forbidden character the original lacks.
   * @param {object} entry
   * @returns {string|null}
   */
  function noSymbolsIntroduced(entry) {
    if (!hasReadableText(entry)) return null;
    const present = new Set(Array.from(entry.original));
    for (const character of entry.proposed) {
      if (FORBIDDEN_SYMBOLS.has(character) && !present.has(character)) {
        return GUARD_NAMES.NO_SYMBOLS_INTRODUCED;
      }
    }
    return null;
  }

  /**
   * The proposal is no more than `MAX_LENGTH_RATIO` times the original, and is
   * not an outright deletion. Lengths are UTF-16 code units, which is what
   * `String.length` gives and is close enough for a hallucination bound.
   * @param {object} entry
   * @returns {string|null}
   */
  function lengthWithinBound(entry) {
    if (!hasReadableText(entry)) return null;
    const originalLength = entry.original.length;
    const proposedLength = entry.proposed.length;
    if (proposedLength === EMPTY_LENGTH && originalLength > EMPTY_LENGTH) {
      return GUARD_NAMES.LENGTH_WITHIN_BOUND;
    }
    return proposedLength > originalLength * MAX_LENGTH_RATIO
      ? GUARD_NAMES.LENGTH_WITHIN_BOUND
      : null;
  }

  /**
   * Every inline tag survives the proposal unchanged and still faces the same
   * characters — and, where the words are untouched, the caption is unchanged
   * outright. See the file header for both clauses, for the one case the rule
   * cannot decide and therefore holds, and for the one it still passes.
   *
   * @param {object} entry
   * @returns {string|null}
   */
  function tagsPreserved(entry) {
    if (!hasReadableText(entry)) return null;

    if (tagSkeletonKey(entry.original) !== tagSkeletonKey(entry.proposed)) {
      return GUARD_NAMES.TAGS_PRESERVED;
    }

    // The words are untouched, so nothing justifies a tag having moved: any
    // difference that survives is the tags and only the tags. This is what
    // catches a move whose facing characters coincide. See the file header.
    const wordsUntouched =
      tagStrippedText(entry.original) === tagStrippedText(entry.proposed);
    return wordsUntouched && entry.original !== entry.proposed
      ? GUARD_NAMES.TAGS_PRESERVED
      : null;
  }

  /**
   * The guards every stage's output runs through, in the order they are tried.
   * `cueIdKnown` is absent on purpose: it cannot be built without a cue list,
   * so the orchestrator prepends `makeCueIdKnown(ids)` per file.
   *
   * `tagsPreserved` is LAST, and the position is deliberate: it can only fire
   * on an entry every other guard has already passed, so adding it changed no
   * existing entry's `rejectedBy`. Note the consequence for reading a hold — a
   * proposal that adds a tag to a caption carrying none is held by
   * `noSymbolsIntroduced` first, because "<" and ">" are forbidden characters,
   * and reaches this guard only where the original already carries them.
   */
  const DEFAULT_GUARDS = Object.freeze([
    speakerLabelUnchanged,
    digitsUnchanged,
    numberWordsUnchanged,
    noSymbolsIntroduced,
    lengthWithinBound,
    tagsPreserved,
  ]);

  // ==========================================================================
  // RUNNING THEM
  // ==========================================================================

  /**
   * Run the guards over one entry and return a NEW entry.
   *
   * PURE: the input entry is never written to, and neither is any guard's view
   * of it — each guard is handed the ORIGINAL object, so a guard that mutated
   * one would be visible in the caller's own entry and caught by the suite's
   * purity rows.
   *
   * The guard list is read through the exported object when the caller does
   * not name one, so patching `CaptionsFixerGuards.DEFAULT_GUARDS` reaches
   * this loop — see the file header.
   *
   * @param {object} entry - one change-set entry
   * @param {Array<Function>} [guards=DEFAULT_GUARDS]
   * @returns {object} a copy; held entries carry `status` and `rejectedBy`
   * @throws {TypeError} when `entry` is not an object
   */
  function runGuards(entry, guards) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TypeError("runGuards() needs a change-set entry object.");
    }
    const list = Array.isArray(guards) ? guards : api.DEFAULT_GUARDS;
    const next = { ...entry };

    for (const guard of list) {
      if (typeof guard !== "function") {
        throw new TypeError("runGuards() needs an array of guard functions.");
      }
      const held = guard(entry);
      if (held) {
        next.status = STATUS_REJECTED;
        next.rejectedBy = REJECTED_BY_PREFIX + held;
        logDebug(`cue ${entry.cueId} held by ${held}`);
        return next;
      }
    }
    return next;
  }

  /**
   * Run the guards over a whole change set.
   * @param {Array<object>} changeSet
   * @param {Array<Function>} [guards=DEFAULT_GUARDS]
   * @returns {Array<object>} a new array of new entries
   * @throws {TypeError} when `changeSet` is not an array
   */
  function runGuardsOnSet(changeSet, guards) {
    if (!Array.isArray(changeSet)) {
      throw new TypeError("runGuardsOnSet() needs a change set array.");
    }
    const next = changeSet.map((entry) => runGuards(entry, guards));
    const held = next.filter((entry) => entry.status === STATUS_REJECTED).length;
    if (held > 0) {
      logDebug(`${held} of ${next.length} entries held by a guard`);
    }
    return next;
  }

  logInfo("Captions Fixer guards loaded");

  const api = {
    // the guards
    makeCueIdKnown: makeCueIdKnown,
    speakerLabelUnchanged: speakerLabelUnchanged,
    digitsUnchanged: digitsUnchanged,
    numberWordsUnchanged: numberWordsUnchanged,
    noSymbolsIntroduced: noSymbolsIntroduced,
    lengthWithinBound: lengthWithinBound,
    tagsPreserved: tagsPreserved,
    // the tag reading, owned here and read by the stages and the suite
    tagsIn: tagsIn,
    // running them
    DEFAULT_GUARDS: DEFAULT_GUARDS,
    runGuards: runGuards,
    runGuardsOnSet: runGuardsOnSet,
    hasReadableText: hasReadableText,
    // constants, exported for proof-reading and for the suite
    GUARD_NAMES: GUARD_NAMES,
    REJECTED_BY_PREFIX: REJECTED_BY_PREFIX,
    STATUS_REJECTED: STATUS_REJECTED,
    SPEAKER_LABEL_PATTERN: SPEAKER_LABEL_PATTERN,
    TAG_TOKEN_PATTERN: TAG_TOKEN_PATTERN,
    NUMBER_WORDS: NUMBER_WORD_LIST,
    FORBIDDEN_SYMBOLS: FORBIDDEN_SYMBOL_LIST,
    MAX_LENGTH_RATIO: MAX_LENGTH_RATIO,
  };
  return api;
})();

// The const above is a top-level BINDING, not a window property, so the alias
// below is what makes window.CaptionsFixerGuards resolve at all — the same
// arrangement, for the same reason, as captions-fixer-chunker.js:271.
window.CaptionsFixerGuards = CaptionsFixerGuards;
