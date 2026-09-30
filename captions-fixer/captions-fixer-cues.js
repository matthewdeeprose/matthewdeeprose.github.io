/**
 * @file captions-fixer-cues.js
 * @description The cue list — the one module every Captions Fixer stage
 * consumes. Parses an .srt or .vtt into a cue list and a file meta object,
 * serialises them back BYTE-IDENTICALLY, converts a Transcribe result into the
 * same cue list through one adapter, and applies an accepted change set through
 * the one function that is ever allowed to write cue text.
 *
 * THE TWO SHAPES, AND THEY DO NOT CHANGE
 * --------------------------------------
 *   cue list   [{ id, start, end, text }]
 *              `id` is the file's own index line as an integer; `start` and
 *              `end` are integer milliseconds and READ-ONLY from the moment
 *              they are parsed — nothing after the parser writes them; `text`
 *              holds multi-line cues with "\n" between lines whatever the file
 *              used, and keeps inline tags (<i>, <b>, {\an8}) verbatim.
 *   meta       { format, bom, lineEnding, trailingNewlines, header, separator,
 *                timestampSeparator, sourceName }
 *              beside the list, never inside it. Every field is something a
 *              parser would otherwise normalise away, recorded so `serialise`
 *              can replay it:
 *                format             "srt" | "vtt", decided from CONTENT, never
 *                                   from the file name (Panopto files can
 *                                   arrive as .txt)
 *                bom                a leading U+FEFF was present
 *                lineEnding         "\n" or "\r\n" — the file must use one
 *                                   throughout; a mix is refused, not guessed
 *                trailingNewlines   how many line endings ended the file, 0 or
 *                                   more; a trailing blank line is ordinary
 *                                   and is recorded here, never refused
 *                header             everything before the first cue block,
 *                                   verbatim with "\n" normalised — the VTT
 *                                   "WEBVTT" line, any header lines and the
 *                                   blank line that closes them; "" for SRT
 *                separator          blank lines between cue blocks BEYOND the
 *                                   one both formats require, one "\n" per
 *                                   extra line: "" for a standard file, "\n"
 *                                   for a double blank line. Must be uniform
 *                                   across the file
 *                timestampSeparator "," (SRT) or "." (VTT), as the file has it,
 *                                   uniform across the file
 *                sourceName         the upload's name, or ""
 *
 * WHAT THIS MODULE REFUSES, ON PURPOSE. Byte-identity means recording what
 * would otherwise be normalised, and a construct that cannot be recorded in
 * the meta above cannot be reproduced — so `parse` THROWS on it rather than
 * quietly emitting a file that differs from the upload: a cue with no index
 * line, an index that is not a plain integer, a duplicate index, mixed line
 * endings, a non-uniform blank-line run, a timing line carrying anything after
 * the end timestamp (VTT cue settings), and a timestamp not of the form
 * HH:MM:SS[,.]mmm (VTT without hours included). The error names the construct
 * and carries a five-line excerpt, which is what the dispatch asks a halt
 * report to contain.
 *
 * IT SPEAKS TO NOTHING AND TOUCHES NO DOM. Pure functions over strings and
 * arrays, so Transcribe's future "fix and format" path can call the same code.
 *
 * THE SPEAKER LABEL IS RESOLVED THROUGH `OpenRouterEmbedTranscribe.speakerLabelFor`,
 * never by a copy of the rule. `toSrt()` prefixes `Speaker N: ` into cue text
 * whenever more than one speaker was found; the adapter here reaches the SAME
 * resolver so the two cannot drift — a copy would be the fourth copy that
 * resolver exists to prevent. It is resolved at CALL time, never at load, for
 * the reason openrouter-embed-transcribe.js gives in its own header.
 *
 * @module CaptionsFixerCues
 * @since 6 September 2026
 */
const CaptionsFixerCues = (function () {
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
      console.error(`[CaptionsFixerCues] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[CaptionsFixerCues] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[CaptionsFixerCues] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[CaptionsFixerCues] ${message}`, ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  // U+FEFF, built from its code point on purpose: the literal character is
  // invisible in an editor, and an invisible constant is one nobody can
  // proof-read (a first draft carried the raw byte and read as "").
  const BOM_CODE_POINT = 0xfeff;
  const BOM = String.fromCharCode(BOM_CODE_POINT);
  const ARROW = "-->";
  const ARROW_WITH_SPACES = ` ${ARROW} `;

  const MS_PER_SECOND = 1000;
  const MS_PER_MINUTE = 60 * MS_PER_SECOND;
  const MS_PER_HOUR = 60 * MS_PER_MINUTE;

  const FORMAT = Object.freeze({ SRT: "srt", VTT: "vtt" });
  const LINE_ENDING = Object.freeze({ LF: "\n", CRLF: "\r\n" });
  const TIMESTAMP_SEPARATOR = Object.freeze({ SRT: ",", VTT: "." });

  /** Change-set statuses. Only ACCEPTED is ever written. */
  const STATUS = Object.freeze({
    PROPOSED: "proposed",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
  });

  /** The internal line separator for multi-line cue text and the header. */
  const NORMALISED_LINE_ENDING = LINE_ENDING.LF;

  /** A WebVTT file begins with this signature, optionally followed by text. */
  const VTT_SIGNATURE = "WEBVTT";
  const VTT_SIGNATURE_PATTERN = /^WEBVTT(?:[ \t\n]|$)/;

  /** A plain integer index line. Anything else is refused, not normalised. */
  const INDEX_PATTERN = /^\d+$/;

  /**
   * HH:MM:SS[,.]mmm — hours at least two digits, so 100 hours round-trips
   * through the formatter's padStart(2). The MM:SS.mmm form WebVTT permits is
   * deliberately absent: the formatter cannot reproduce it.
   */
  const TIMESTAMP_PATTERN = /^(\d{2,}):(\d{2}):(\d{2})([,.])(\d{3})$/;

  /** How `toSrt()` composes a label; mirrored, never copied as a rule. */
  const SPEAKER_LABEL_PREFIX = "Speaker ";
  const SPEAKER_LABEL_SUFFIX = ": ";

  /** Lines either side of the offending line in a refusal excerpt. */
  const EXCERPT_CONTEXT_LINES = 2;

  // ==========================================================================
  // ERRORS — a refusal names the construct and shows where it is
  // ==========================================================================

  /**
   * Build the error `parse` throws on a construct it cannot round-trip.
   * @param {string} construct - short name, e.g. "cue with no index line"
   * @param {string[]} lines - the normalised file lines
   * @param {number} lineIndex - zero-based line the construct was met on
   * @returns {Error} with `.construct`, `.lineNumber` (one-based) and `.excerpt`
   */
  function refusal(construct, lines, lineIndex) {
    const from = Math.max(0, lineIndex - EXCERPT_CONTEXT_LINES);
    const to = Math.min(lines.length, lineIndex + EXCERPT_CONTEXT_LINES + 1);
    const excerpt = lines
      .slice(from, to)
      .map((line, offset) => `${from + offset + 1}: ${line}`)
      .join(NORMALISED_LINE_ENDING);
    const error = new Error(
      `Cannot round-trip this file: ${construct} at line ${lineIndex + 1}.`,
    );
    error.construct = construct;
    error.lineNumber = lineIndex + 1;
    error.excerpt = excerpt;
    return error;
  }

  // ==========================================================================
  // TIMESTAMPS
  // ==========================================================================

  /**
   * Milliseconds to HH:MM:SS<sep>mmm.
   *
   * A COPY of `toSrtTimestamp` in openrouter-embed-transcribe.js (~:491), with
   * the separator parameterised so the same function writes VTT. That module
   * does not export its formatter today; this copy is REMOVED when the Release
   * 2 Transcribe hand-off parcel exports the original. Keep the two identical
   * until then.
   *
   * @param {number} ms
   * @param {string} separator - "," or "."
   * @returns {string}
   */
  function formatTimestamp(ms, separator) {
    const total = Math.max(0, Math.floor(Number(ms) || 0));
    const milliseconds = total % MS_PER_SECOND;
    const totalSeconds = Math.floor(total / MS_PER_SECOND);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    const pad = (value, width) => String(value).padStart(width, "0");
    return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}${separator}${pad(
      milliseconds,
      3,
    )}`;
  }

  /**
   * HH:MM:SS[,.]mmm to milliseconds. Returns null unless the token parses AND
   * re-formats to itself — so "00:61:00,000" (61 minutes) is refused rather
   * than silently rewritten as 01:01:00, and byte-identity of every timestamp
   * holds by construction.
   * @param {string} token
   * @returns {{ ms: number, separator: string }|null}
   */
  function parseTimestamp(token) {
    const match = TIMESTAMP_PATTERN.exec(token);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const separator = match[4];
    const milliseconds = Number(match[5]);
    const ms =
      hours * MS_PER_HOUR +
      minutes * MS_PER_MINUTE +
      seconds * MS_PER_SECOND +
      milliseconds;
    if (formatTimestamp(ms, separator) !== token) return null;
    return { ms, separator };
  }

  /**
   * "start --> end", nothing else. Anything after the end timestamp is a VTT
   * cue setting or an SRT coordinate, neither of which the meta can carry.
   * @param {string} line
   * @returns {{ start: number, end: number, separator: string }|null}
   */
  function parseTimingLine(line) {
    const parts = line.split(ARROW_WITH_SPACES);
    if (parts.length !== 2) return null;
    const start = parseTimestamp(parts[0]);
    const end = parseTimestamp(parts[1]);
    if (!start || !end) return null;
    if (start.separator !== end.separator) return null;
    return { start: start.ms, end: end.ms, separator: start.separator };
  }

  // ==========================================================================
  // FORMAT SNIFFING — by content, never by file name
  // ==========================================================================

  /**
   * "vtt" for a WEBVTT header, "srt" for an index line followed by a timing
   * line, null for anything else (prose, JSON, an empty string).
   * @param {string} text
   * @returns {"srt"|"vtt"|null}
   */
  function sniffFormat(text) {
    if (typeof text !== "string") return null;
    const body = text.startsWith(BOM) ? text.slice(BOM.length) : text;
    if (VTT_SIGNATURE_PATTERN.test(body)) return FORMAT.VTT;

    const lines = body.split(/\r\n|\n|\r/);
    for (let index = 0; index + 1 < lines.length; index += 1) {
      if (INDEX_PATTERN.test(lines[index]) && lines[index + 1].includes(ARROW)) {
        return FORMAT.SRT;
      }
    }
    return null;
  }

  // ==========================================================================
  // PARSE
  // ==========================================================================

  /**
   * Decide the file's line ending, refusing a mix or a bare carriage return.
   * @param {string} body - text with the BOM already removed
   * @returns {string} "\n" or "\r\n"
   */
  function detectLineEnding(body) {
    const crlfCount = (body.match(/\r\n/g) || []).length;
    const lfCount = (body.match(/\n/g) || []).length;
    const crCount = (body.match(/\r/g) || []).length;

    if (crCount !== crlfCount) {
      const error = new Error(
        "Cannot round-trip this file: a carriage return without a line feed.",
      );
      error.construct = "carriage return without a line feed";
      throw error;
    }
    if (crlfCount > 0 && lfCount > crlfCount) {
      const error = new Error(
        "Cannot round-trip this file: mixed line endings (both CRLF and LF).",
      );
      error.construct = "mixed line endings";
      throw error;
    }
    return crlfCount > 0 ? LINE_ENDING.CRLF : LINE_ENDING.LF;
  }

  /**
   * Split normalised lines into cue blocks, recording the blank-line run
   * between them. A run that differs from the first one seen is refused.
   * @param {string[]} lines
   * @param {number} firstCueLine - index of the first cue's index line
   * @returns {{ blocks: Array<{ startLine: number, lines: string[] }>, separator: string }}
   */
  function splitBlocks(lines, firstCueLine) {
    const blocks = [];
    let separator = null;
    let current = null;
    let blankRun = 0;

    for (let index = firstCueLine; index < lines.length; index += 1) {
      const line = lines[index];
      if (line === "") {
        if (current) {
          blocks.push(current);
          current = null;
        }
        blankRun += 1;
        continue;
      }
      if (!current) {
        // A blank-line run has just closed (or this is the first block).
        if (blocks.length > 0) {
          const run = NORMALISED_LINE_ENDING.repeat(blankRun - 1);
          if (separator === null) {
            separator = run;
          } else if (run !== separator) {
            throw refusal("non-uniform blank-line run between cues", lines, index);
          }
        }
        blankRun = 0;
        current = { startLine: index, lines: [] };
      }
      current.lines.push(line);
    }
    if (current) blocks.push(current);

    // The file's trailing line endings were counted and stripped before this
    // function runs, so no blank run can follow the last block here.
    return { blocks, separator: separator === null ? "" : separator };
  }

  /**
   * Parse one cue block: index line, timing line, zero or more text lines.
   * @param {{ startLine: number, lines: string[] }} block
   * @param {string[]} lines - the whole file, for excerpts
   * @returns {{ cue: object, separator: string }}
   */
  function parseBlock(block, lines) {
    const [indexLine, timingLine, ...textLines] = block.lines;

    if (!INDEX_PATTERN.test(indexLine)) {
      // A timing line where the index should be is a cue lacking its index;
      // anything else (a NOTE or STYLE block, stray prose) is not a cue at all.
      const construct = indexLine.includes(ARROW)
        ? "cue with no index line"
        : "block that is not a cue (no index line)";
      throw refusal(construct, lines, block.startLine);
    }
    const id = Number(indexLine);
    if (String(id) !== indexLine) {
      throw refusal("index line that is not a plain integer", lines, block.startLine);
    }

    if (timingLine === undefined) {
      throw refusal("index line with no timing line after it", lines, block.startLine);
    }
    const timing = parseTimingLine(timingLine);
    if (!timing) {
      const construct = timingLine.includes(ARROW)
        ? "timing line not of the form HH:MM:SS[,.]mmm --> HH:MM:SS[,.]mmm"
        : "index line with no timing line after it";
      throw refusal(construct, lines, block.startLine + 1);
    }

    return {
      cue: {
        id,
        start: timing.start,
        end: timing.end,
        text: textLines.join(NORMALISED_LINE_ENDING),
      },
      separator: timing.separator,
    };
  }

  /**
   * Parse an .srt or .vtt (or a .txt holding either) into a cue list and meta.
   *
   * @param {string} text - the file's contents, as read
   * @param {{ sourceName?: string }} [options]
   * @returns {{ cueList: Array<{ id: number, start: number, end: number, text: string }>, meta: object }}
   * @throws {Error} on a construct the meta cannot carry — see the file header
   */
  function parse(text, { sourceName = "" } = {}) {
    if (typeof text !== "string") {
      throw new TypeError("parse() needs the file contents as a string.");
    }

    const bom = text.startsWith(BOM);
    const raw = bom ? text.slice(BOM.length) : text;
    const lineEnding = detectLineEnding(raw);

    // From here on every line ending is "\n"; `serialise` puts the file's own back.
    let body = raw.split(lineEnding).join(NORMALISED_LINE_ENDING);

    // Count the line endings that close the file and strip them all, so a
    // trailing blank line is recorded rather than read as a blank run.
    let trailingNewlines = 0;
    while (body.endsWith(NORMALISED_LINE_ENDING)) {
      body = body.slice(0, -NORMALISED_LINE_ENDING.length);
      trailingNewlines += 1;
    }

    const format = sniffFormat(body);
    if (format === null) {
      const error = new Error(
        "This does not look like an SRT or VTT file: no WEBVTT header and no index line followed by a timing line.",
      );
      error.construct = "not a caption file";
      throw error;
    }

    const lines = body.split(NORMALISED_LINE_ENDING);

    // The first cue is the first timing line and the index line above it. A
    // timing line with no index above it is the "cue with no index line"
    // construct, refused here rather than absorbed into the header.
    const firstArrow = lines.findIndex((line) => line.includes(ARROW));
    if (firstArrow === -1) {
      throw refusal("no cue found after the header", lines, Math.max(0, lines.length - 1));
    }
    if (firstArrow === 0 || !INDEX_PATTERN.test(lines[firstArrow - 1])) {
      throw refusal("cue with no index line", lines, firstArrow);
    }
    const firstCueLine = firstArrow - 1;

    // The header is everything before the first cue block, verbatim. It must
    // be closed by a blank line (or be empty), or the boundary is a guess; and
    // an SRT has no header, so anything but blank lines there is not an SRT
    // this parser can reproduce.
    if (firstCueLine > 0 && lines[firstCueLine - 1] !== "") {
      throw refusal("header not closed by a blank line before the first cue", lines, firstCueLine);
    }
    const headerLines = lines.slice(0, firstCueLine);
    if (format === FORMAT.SRT && headerLines.some((line) => line !== "")) {
      throw refusal("content before the first cue of an SRT", lines, headerLines.findIndex((line) => line !== ""));
    }
    const header = headerLines.map((line) => line + NORMALISED_LINE_ENDING).join("");

    const { blocks, separator } = splitBlocks(lines, firstCueLine);

    const cueList = [];
    const seenIds = new Set();
    let timestampSeparator = null;
    blocks.forEach((block) => {
      const parsed = parseBlock(block, lines);
      if (seenIds.has(parsed.cue.id)) {
        throw refusal(`duplicate cue index ${parsed.cue.id}`, lines, block.startLine);
      }
      seenIds.add(parsed.cue.id);
      if (timestampSeparator === null) {
        timestampSeparator = parsed.separator;
      } else if (parsed.separator !== timestampSeparator) {
        throw refusal("mixed timestamp separators (both , and .)", lines, block.startLine + 1);
      }
      cueList.push(parsed.cue);
    });

    const meta = {
      format,
      bom,
      lineEnding,
      trailingNewlines,
      header,
      separator,
      timestampSeparator:
        timestampSeparator === null
          ? format === FORMAT.VTT
            ? TIMESTAMP_SEPARATOR.VTT
            : TIMESTAMP_SEPARATOR.SRT
          : timestampSeparator,
      sourceName: String(sourceName || ""),
    };

    logDebug(`Parsed ${cueList.length} cues (${format}, ${lineEnding === LINE_ENDING.CRLF ? "CRLF" : "LF"}${bom ? ", BOM" : ""})`);
    return { cueList, meta };
  }

  // ==========================================================================
  // SERIALISE
  // ==========================================================================

  /**
   * Write a cue list back out in the shape its meta records. `parse` then
   * `serialise` is byte-identical; that is the whole contract.
   *
   * A cue with empty text is written as index and timing line only — the form
   * a blank-line-delimited file can actually hold. (`toSrt()` writes an empty
   * text line for it, which this parser would read as a longer blank run; no
   * measured fixture has an empty phrase, and it is recorded here rather than
   * papered over.)
   *
   * @param {Array<{ id: number, start: number, end: number, text: string }>} cueList
   * @param {object} meta - as returned by `parse` or `fromTranscribeResult`
   * @returns {string}
   */
  function serialise(cueList, meta) {
    if (!Array.isArray(cueList)) {
      throw new TypeError("serialise() needs a cue list array.");
    }
    if (!meta || typeof meta !== "object") {
      throw new TypeError("serialise() needs the meta object beside the cue list.");
    }
    if (meta.lineEnding !== LINE_ENDING.LF && meta.lineEnding !== LINE_ENDING.CRLF) {
      throw new TypeError('serialise() needs meta.lineEnding to be "\\n" or "\\r\\n".');
    }

    const separator = meta.timestampSeparator;
    const blocks = cueList.map((cue) => {
      const timing = `${formatTimestamp(cue.start, separator)}${ARROW_WITH_SPACES}${formatTimestamp(cue.end, separator)}`;
      const text = cue.text === "" ? "" : `${NORMALISED_LINE_ENDING}${cue.text}`;
      return `${cue.id}${NORMALISED_LINE_ENDING}${timing}${text}`;
    });

    const blankRun = `${NORMALISED_LINE_ENDING}${NORMALISED_LINE_ENDING}${meta.separator || ""}`;
    const trailingCount = Math.max(0, Math.floor(Number(meta.trailingNewlines) || 0));
    const trailing = blocks.length > 0 ? NORMALISED_LINE_ENDING.repeat(trailingCount) : "";
    const normalised = `${meta.header || ""}${blocks.join(blankRun)}${trailing}`;

    const output =
      meta.lineEnding === NORMALISED_LINE_ENDING
        ? normalised
        : normalised.split(NORMALISED_LINE_ENDING).join(meta.lineEnding);

    return `${meta.bom ? BOM : ""}${output}`;
  }

  // ==========================================================================
  // ADAPTER — the one phrase→cue conversion
  // ==========================================================================

  /**
   * Convert a normalised Transcribe result — `{ text, phrases: [{ offsetMs,
   * durationMs, text, speaker, confidence }] }` — into a cue list whose
   * serialisation is byte-equal to `OpenRouterEmbedTranscribe.toSrt(result)`.
   *
   * The speaker label is decided by the SHARED resolver, at every line as
   * `toSrt()` does (SRT is a downloaded artefact and never follows the screen's
   * display mode). The meta reproduces `toSrt()`'s shape: SRT, no BOM, LF, one
   * trailing newline, a single blank line between cues, "," separators.
   *
   * @param {object} result - a normalised Transcribe result
   * @param {{ sourceName?: string }} [options]
   * @returns {{ cueList: Array, meta: object }}
   */
  function fromTranscribeResult(result, { sourceName = "" } = {}) {
    // Resolved at CALL time: a module-scope capture would hold whatever was on
    // window when this file ran, which is the trap the Transcribe header names.
    const transcribe = window.OpenRouterEmbedTranscribe;
    if (
      !transcribe ||
      typeof transcribe.speakerLabelFor !== "function" ||
      typeof transcribe.distinctSpeakerCount !== "function" ||
      typeof transcribe.previousSpeakerAt !== "function"
    ) {
      throw new Error(
        "fromTranscribeResult() needs window.OpenRouterEmbedTranscribe with speakerLabelFor, distinctSpeakerCount and previousSpeakerAt.",
      );
    }
    if (!result || !Array.isArray(result.phrases)) {
      throw new TypeError("fromTranscribeResult() needs a result with a phrases array.");
    }

    // Hoisted once, as both formatters do — see toPlainText's note on why.
    const labelsAreInformative = transcribe.distinctSpeakerCount(result) > 1;

    const cueList = result.phrases.map((phrase, index) => {
      const speaker = transcribe.speakerLabelFor({
        speaker: phrase.speaker,
        previousSpeaker: transcribe.previousSpeakerAt(result.phrases, index),
        labelsAreInformative,
      });
      const label =
        speaker !== null ? `${SPEAKER_LABEL_PREFIX}${speaker}${SPEAKER_LABEL_SUFFIX}` : "";
      // The same clamp `toSrtTimestamp` applies, so a negative or fractional
      // offset lands on the same integer the writer would have printed.
      const start = Math.max(0, Math.floor(Number(phrase.offsetMs) || 0));
      const end = Math.max(
        0,
        Math.floor(Number(phrase.offsetMs + phrase.durationMs) || 0),
      );
      return { id: index + 1, start, end, text: `${label}${phrase.text}` };
    });

    const meta = {
      format: FORMAT.SRT,
      bom: false,
      lineEnding: LINE_ENDING.LF,
      trailingNewlines: 1,
      header: "",
      separator: "",
      timestampSeparator: TIMESTAMP_SEPARATOR.SRT,
      sourceName: String(sourceName || ""),
    };

    logDebug(`Adapted ${cueList.length} phrases into cues`);
    return { cueList, meta };
  }

  // ==========================================================================
  // APPLY — the only writer of cue text
  // ==========================================================================

  /**
   * Apply the accepted entries of a change set to a cue list.
   *
   * PURE: neither the cue list, its cues, the change set nor its entries are
   * mutated; a new list of new cue objects comes back. Only an entry with
   * `status: "accepted"` whose `original` still equals the cue's current text
   * is written. A stale `original` — the cue was edited by an earlier entry, or
   * the person, or the set is from another upload — is a conflict, reported
   * and skipped, never forced. `proposed` and `rejected` entries are ignored
   * silently: they are not conflicts, they are simply not accepted. Timestamps
   * are copied through untouched.
   *
   * @param {Array<{ id: number, start: number, end: number, text: string }>} cueList
   * @param {Array<{ cueId: number, original: string, proposed: string, status: string }>} changeSet
   * @returns {{ cueList: Array, applied: number, conflicts: Array<{ cueId: *, reason: string }> }}
   */
  function applyChangeSet(cueList, changeSet) {
    if (!Array.isArray(cueList)) {
      throw new TypeError("applyChangeSet() needs a cue list array.");
    }
    if (!Array.isArray(changeSet)) {
      throw new TypeError("applyChangeSet() needs a change set array.");
    }

    const next = cueList.map((cue) => ({
      id: cue.id,
      start: cue.start,
      end: cue.end,
      text: cue.text,
    }));
    const indexById = new Map(next.map((cue, index) => [cue.id, index]));

    const conflicts = [];
    let applied = 0;

    changeSet.forEach((entry) => {
      if (!entry || entry.status !== STATUS.ACCEPTED) return;

      const index = indexById.get(entry.cueId);
      if (index === undefined) {
        conflicts.push({ cueId: entry.cueId, reason: "no cue with this id" });
        return;
      }
      if (typeof entry.proposed !== "string") {
        conflicts.push({ cueId: entry.cueId, reason: "proposed text is not a string" });
        return;
      }
      const cue = next[index];
      if (entry.original !== cue.text) {
        conflicts.push({
          cueId: entry.cueId,
          reason: "original no longer matches the cue text",
        });
        return;
      }

      next[index] = { id: cue.id, start: cue.start, end: cue.end, text: entry.proposed };
      applied += 1;
    });

    if (conflicts.length > 0) {
      logWarn(`${conflicts.length} change-set entr${conflicts.length === 1 ? "y" : "ies"} skipped as conflicts`);
    }
    logDebug(`Applied ${applied} of ${changeSet.length} entries`);
    return { cueList: next, applied, conflicts };
  }

  logInfo("Captions Fixer cue module loaded");

  return {
    parse: parse,
    serialise: serialise,
    fromTranscribeResult: fromTranscribeResult,
    applyChangeSet: applyChangeSet,
    sniffFormat: sniffFormat,
    // STAGE 16, DECISION 7 — the review table's Start column. The column reads
    // a cue's `start` and formats it HERE rather than anywhere else: a second
    // formatter would be a second opinion about a timestamp, and the whole
    // programme's byte-identity claim rests on there being exactly one. The
    // function is otherwise unchanged; this line only widens what the module
    // publishes, so nothing that already worked can behave differently.
    formatTimestamp: formatTimestamp,
    BOM: BOM,
    ARROW: ARROW,
    FORMAT: FORMAT,
    LINE_ENDING: LINE_ENDING,
    TIMESTAMP_SEPARATOR: TIMESTAMP_SEPARATOR,
    STATUS: STATUS,
  };
})();

// The const above is a top-level BINDING, not a window property, so the alias
// below is what makes window.CaptionsFixerCues resolve at all — the same
// arrangement, for the same reason, as openrouter-embed-transcribe.js:814.
window.CaptionsFixerCues = CaptionsFixerCues;
