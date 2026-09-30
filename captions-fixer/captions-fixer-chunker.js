/**
 * @file captions-fixer-chunker.js
 * @description The chunker — one pure function that cuts a cue list into
 * model-sized chunks at sentence ends, with a little context either side, so
 * that Release 2's cue-level pass and Release 4's slide sync consume the same
 * shape. No DOM, no embed, no timestamps in the output.
 *
 * THE CHUNK SHAPE (fixed from Stage 2 on)
 * ---------------------------------------
 *   { index:      0,
 *     cueIds:     [1, 2, …, 58],   the PRIMARY cues this chunk is responsible for
 *     contextIds: [59, 60],        cues carried for context only; never proposed on
 *     cues:       [{ id, text }],  in FILE ORDER: leading context, then the
 *                                  primaries, then trailing context — ids
 *                                  ascending throughout. cueIds and contextIds
 *                                  say which is which. `text` is byte-identical
 *                                  to the source cue's text: label, "\n" and all
 *     slideIds:   [] }             always empty until Release 4
 *
 * `cues` is structure, not a string. The stage that sends it decides how to
 * serialise it; this module never flattens, trims or touches `text`.
 *
 * THE RULES
 * ---------
 * Every cue is a primary EXACTLY ONCE: the chunks partition the id list in
 * file order. Context cues are copies — the last `overlap` primaries of the
 * chunk before appear as leading context, the first `overlap` primaries of the
 * chunk after as trailing context — so a cue is context at most twice, once
 * each side, whatever `overlap` is.
 *
 * A chunk is cut at the LAST sentence-final cue inside its window of `maxCues`
 * cues; if the window holds none, at `maxCues`. A cue is sentence-final when
 * its text, trimmed, ends in ".", "!" or "?", optionally followed by ONE
 * closing quote or bracket. "Dr." is sentence-final by that rule on purpose:
 * an occasional early cut costs less than carrying an abbreviation list. The
 * precedent is `splitIntoChunks` in tts/tts-controller.js (~:502), which
 * splits prose on [.!?] followed by whitespace; the rule here is written
 * LOCALLY rather than imported, because that file is a TTS controller with
 * its own state and this module must stay a dependency of nothing.
 *
 * `isSentenceFinal` is EXPORTED, and `chunk` reads it through the exported
 * object rather than the closure, so a suite can invert the rule by patching
 * one property and the product follows — an unpatchable seam is an unprovable
 * one.
 *
 * THE CUE LIST IS READ-ONLY. New arrays, new cue objects; the input is never
 * mutated and none of its objects is returned.
 *
 * @module CaptionsFixerChunker
 * @since 6 September 2026
 */
const CaptionsFixerChunker = (function () {
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
      console.error(`[CaptionsFixerChunker] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[CaptionsFixerChunker] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[CaptionsFixerChunker] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[CaptionsFixerChunker] ${message}`, ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  /** Window sizes, in primary cues, for the two kinds of model. */
  const CLOUD_MAX_CUES = 60;
  const LOCAL_MAX_CUES = 20;

  /** Context cues carried either side of a chunk. */
  const OVERLAP_CUES = 2;

  /** The smallest window a caller may ask for; below it is a caller bug. */
  const MIN_MAX_CUES = 1;

  /** The smallest overlap; a negative overlap is a caller bug. */
  const MIN_OVERLAP = 0;

  /**
   * Sentence-final: the trimmed text ends in a full stop, exclamation mark or
   * question mark, optionally followed by ONE closer. The closers, so the
   * class can be proof-read:
   *   "  U+0022 quotation mark        '  U+0027 apostrophe
   *   ”  U+201D right double quote     ’  U+2019 right single quote
   *   »  U+00BB right guillemet
   *   )  ]  }  the three closing brackets
   */
  const SENTENCE_FINAL_PATTERN = /[.!?]["'”’»)\]}]?$/;

  // ==========================================================================
  // THE SENTENCE RULE
  // ==========================================================================

  /**
   * Is this cue text the end of a sentence?
   * @param {string} text
   * @returns {boolean} false for anything that is not a string
   */
  function isSentenceFinal(text) {
    if (typeof text !== "string") return false;
    return SENTENCE_FINAL_PATTERN.test(text.trim());
  }

  // ==========================================================================
  // VALIDATION — caller bugs throw; they are not runtime conditions
  // ==========================================================================

  /**
   * @param {*} cueList
   * @param {*} options
   * @returns {{ maxCues: number, overlap: number }}
   */
  function validate(cueList, options) {
    if (!Array.isArray(cueList)) {
      throw new TypeError("chunk() needs a cue list array.");
    }
    if (!options || typeof options !== "object") {
      throw new TypeError("chunk() needs an options object { maxCues, overlap }.");
    }
    const { maxCues, overlap } = options;
    if (!Number.isInteger(maxCues) || maxCues < MIN_MAX_CUES) {
      throw new RangeError(
        `chunk() needs an integer maxCues of at least ${MIN_MAX_CUES}; got ${String(maxCues)}.`,
      );
    }
    if (!Number.isInteger(overlap) || overlap < MIN_OVERLAP) {
      throw new RangeError(
        `chunk() needs an integer overlap of at least ${MIN_OVERLAP}; got ${String(overlap)}.`,
      );
    }
    return { maxCues, overlap };
  }

  // ==========================================================================
  // PARTITION — where each chunk's primaries start and end
  // ==========================================================================

  /**
   * Cut the list into consecutive primary ranges. Each range is [start, end)
   * over LIST POSITIONS (not ids); the ranges tile 0..cueList.length exactly.
   *
   * @param {Array<{ text: string }>} cueList
   * @param {number} maxCues
   * @param {(text: string) => boolean} sentenceFinal - the rule, read through
   *   the exported object so a patch on it reaches this loop
   * @returns {Array<{ start: number, end: number }>}
   */
  function partition(cueList, maxCues, sentenceFinal) {
    const ranges = [];
    const total = cueList.length;
    let start = 0;

    while (start < total) {
      const windowEnd = Math.min(start + maxCues, total);

      // The final window holds everything that is left: nothing to cut.
      if (windowEnd === total) {
        ranges.push({ start, end: total });
        break;
      }

      // Otherwise cut after the LAST sentence-final cue in the window, or at
      // the window's edge when there is none. Either way `end > start`, which
      // is what guarantees the loop terminates.
      let end = windowEnd;
      for (let index = windowEnd - 1; index >= start; index -= 1) {
        if (sentenceFinal(cueList[index].text)) {
          end = index + 1;
          break;
        }
      }
      ranges.push({ start, end });
      start = end;
    }

    return ranges;
  }

  // ==========================================================================
  // CHUNK
  // ==========================================================================

  /**
   * Cut a cue list into chunks.
   *
   * @param {Array<{ id: number, text: string }>} cueList - read-only; the
   *   Stage 1 shape, of which only `id` and `text` are read
   * @param {{ maxCues: number, overlap: number }} options - pick from the
   *   exported constants: `{ maxCues: CLOUD_MAX_CUES, overlap: OVERLAP_CUES }`
   * @returns {Array<{ index: number, cueIds: number[], contextIds: number[], cues: Array<{ id: number, text: string }>, slideIds: never[] }>}
   * @throws {TypeError|RangeError} on a caller bug — see `validate`
   */
  function chunk(cueList, options) {
    const { maxCues, overlap } = validate(cueList, options);
    if (cueList.length === 0) return [];

    // Read the rule through the exported object, not the closure — see the
    // file header. `api` is the object returned at the bottom of this IIFE.
    const ranges = partition(cueList, maxCues, (text) => api.isSentenceFinal(text));

    const copyOf = (cue) => ({ id: cue.id, text: cue.text });
    const idsIn = (from, to) => cueList.slice(from, to).map((cue) => cue.id);

    const chunks = ranges.map((range, index) => {
      const previous = ranges[index - 1];
      const next = ranges[index + 1];

      // Leading context: the last `overlap` primaries of the chunk BEFORE,
      // bounded by that chunk's own start so it never reaches further back.
      const leadFrom = previous ? Math.max(previous.start, range.start - overlap) : range.start;
      // Trailing context: the first `overlap` primaries of the chunk AFTER,
      // bounded by that chunk's own end.
      const trailTo = next ? Math.min(next.end, range.end + overlap) : range.end;

      const primaries = cueList.slice(range.start, range.end);
      const leading = cueList.slice(leadFrom, range.start);
      const trailing = cueList.slice(range.end, trailTo);

      return {
        index,
        cueIds: idsIn(range.start, range.end),
        contextIds: idsIn(leadFrom, range.start).concat(idsIn(range.end, trailTo)),
        // File order: leading context, primaries, trailing context.
        cues: leading.concat(primaries, trailing).map(copyOf),
        slideIds: [],
      };
    });

    logDebug(`${cueList.length} cues into ${chunks.length} chunk(s) at maxCues ${maxCues}, overlap ${overlap}`);
    return chunks;
  }

  logInfo("Captions Fixer chunker loaded");

  const api = {
    chunk: chunk,
    isSentenceFinal: isSentenceFinal,
    CLOUD_MAX_CUES: CLOUD_MAX_CUES,
    LOCAL_MAX_CUES: LOCAL_MAX_CUES,
    OVERLAP_CUES: OVERLAP_CUES,
    MIN_MAX_CUES: MIN_MAX_CUES,
  };
  return api;
})();

// The const above is a top-level BINDING, not a window property, so the alias
// below is what makes window.CaptionsFixerChunker resolve at all — the same
// arrangement, for the same reason, as captions-fixer-cues.js:709.
window.CaptionsFixerChunker = CaptionsFixerChunker;
