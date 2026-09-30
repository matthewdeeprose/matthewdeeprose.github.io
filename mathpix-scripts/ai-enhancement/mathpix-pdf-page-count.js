/**
 * mathpix-pdf-page-count.js — THE REAL PAGE COUNT, READ OUT OF THE PDF.
 *
 * Parcel PC-1, 17 September 2026.
 *
 * WHY THIS EXISTS. The cost figure a person is shown for a Context AI run was
 * built on `fileAnalysis.estimatedPages`, which is a SIZE HEURISTIC
 * (`js/file-handler/file-handler-core.js` estimatePageSize) reading nothing
 * whatever from inside the PDF. Measured at OC-1 B5 against all six corpus
 * fixtures, it is wrong about every one of them and always upward, by between
 * 2.1x and 27.3x — 164 reported for a 6-page document. OC-2b then measured the
 * real charge at the wire at exactly 0.002000 US dollars per REAL page, so the
 * provider bills real pages while the application quoted a guess.
 *
 * TWO METHODS, BECAUSE ONE IS A HYPOTHESIS. This is a faithful browser port of
 * the proved instrument at `.claude/measurements/oc-2-ocr-pilot/oc2-pagecount.mjs`
 * and deliberately NOT a third counter:
 *
 *   METHOD A — count `/Type /Page` objects across the raw bytes AND across every
 *   inflatable stream. Object streams hide page objects, so a raw-bytes-only
 *   count under-reports.
 *
 *   METHOD B — read the ROOT `/Type /Pages` node's own `/Count`, cross-checked
 *   against the sum of the non-root nodes' counts.
 *
 * A WINDOW IS NOT A DICTIONARY. The instrument's first form of method B read
 * `/Count` from a plus-or-minus 400-character WINDOW around each `/Type /Pages`
 * token and returned 6 where the truth was 11, because that PDF packs the root
 * and both children into one object stream a few hundred bytes apart, so every
 * window's first `/Count` was a child's. This port reads `/Count` between the
 * token and the `>>` closing its OWN dictionary, and identifies the root as the
 * node carrying no `/Parent`. The disagreement between the two methods is the
 * only reason that bug was ever found, which is why a disagreement here WARNS
 * and returns no figure rather than silently preferring one.
 *
 * NO FALLBACK TO THE HEURISTIC. When this module cannot produce a count it
 * returns `pages: null` with a reason. A caller must show no figure rather than
 * a wrong one: a wrong number a person acts on is worse than an absent one.
 *
 * No library, no build step — `DecompressionStream` is platform JavaScript.
 * IIFE + window global, matching the rest of the MathPix lane.
 */
(function () {
  "use strict";

  // ==========================================================================
  // LOGGING (house block — British spelling, default WARN)
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
  function logError(...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[PDFPageCount]", ...args);
  }
  function logWarn(...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[PDFPageCount]", ...args);
  }
  function logInfo(...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[PDFPageCount]", ...args);
  }
  function logDebug(...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[PDFPageCount]", ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  /** Chunk size for the byte-to-latin1 conversion; keeps the argument list off
   *  the stack for a multi-megabyte PDF. */
  const LATIN1_CHUNK = 0x8000;

  /** A `/Type /Page` token that is NOT `/Pages` and not a longer word. */
  const PAGE_OBJECT_PATTERN = /\/Type\s*\/Page(?![sA-Za-z])/g;

  /** A page-tree node token. */
  const PAGES_NODE_PATTERN = /\/Type\s*\/Pages\b/g;

  /** `/Count <n>` inside a dictionary slice. */
  const COUNT_PATTERN = /\/Count\s+(\d+)/;

  /** `/Parent <n> <g> R` — present on every node but the root. */
  const PARENT_PATTERN = /\/Parent\s+\d+\s+\d+\s+R/;

  /** An object stream — the only kind that can hide a page object. */
  const OBJSTM_PATTERN = /\/Type\s*\/ObjStm\b/;

  /**
   * Maximum bytes retained from any one inflated stream. An object stream in the
   * corpus is under 32 KiB; this is three orders of magnitude of headroom, and a
   * stream that exceeds it is abandoned rather than held in memory.
   */
  const MAX_INFLATED_BYTES = 32 * 1024 * 1024;

  /**
   * How far back a dictionary's opening `<<` may be from its `/Type /Pages`
   * token before the search gives up. A page-tree node is a short dictionary —
   * the largest in the corpus is a root `/Kids` array of 39 references — so this
   * is generous by two orders of magnitude. Exceeding it yields NO figure, never
   * a truncated slice: a bounded slice is a window, and a window is not a
   * dictionary.
   */
  const MAX_DICT_LOOKBACK = 20000;

  /** Reasons a count can be unavailable. Frozen-const enum, never a bare string. */
  const UNAVAILABLE = Object.freeze({
    NO_BYTES: "no-bytes",
    NOT_A_PDF: "not-a-pdf",
    NO_DECOMPRESSION: "no-decompression-stream",
    METHODS_DISAGREE: "methods-disagree",
    NO_PAGES_FOUND: "no-pages-found",
    THREW: "threw",
  });

  // ==========================================================================
  // BYTES
  // ==========================================================================

  /**
   * Exact ISO-8859-1 decode, one code unit per byte. Built by hand rather than
   * with TextDecoder because the WHATWG "latin1" label is windows-1252, which
   * is a DIFFERENT mapping above 0x7F. Every token matched here is ASCII, so
   * the distinction changes no result — but a byte-for-byte mapping is what the
   * Node instrument this ports uses, and two instruments that agree by accident
   * are worse than two that agree by construction.
   *
   * @param {Uint8Array} bytes
   * @returns {string}
   */
  function toLatin1(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i += LATIN1_CHUNK) {
      out += String.fromCharCode.apply(
        null,
        bytes.subarray(i, Math.min(i + LATIN1_CHUNK, bytes.length))
      );
    }
    return out;
  }

  /**
   * Inflate one zlib stream, ABANDONING it past a byte cap. PDF FlateDecode is
   * zlib-wrapped, so "deflate" is the right format and "deflate-raw" is not.
   *
   * THE CAP IS NOT A TIDINESS MEASURE. Measured at PC-1, `06-gauss-law`'s 57
   * streams inflate to 1,455,741,179 bytes — 1.39 GiB — and `08-capacitors` to
   * 757 MiB, almost all of it image data. Converting that to a string to run a
   * regex over exceeds V8's maximum string length outright, so an uncapped
   * counter does not merely run slowly on a real corpus fixture: it throws.
   *
   * @param {Uint8Array} bytes
   * @param {number} cap — maximum inflated bytes to retain.
   * @returns {Promise<Object>} `{ data, truncated }`; data null when the bytes
   *   are not inflatable at all.
   */
  async function inflate(bytes, cap) {
    try {
      // TRIM THE END-OF-LINE THE PDF SPEC PUTS BEFORE `endstream`.
      // MEASURED AT PC-1, and it is the difference between the two runtimes:
      // Node's `zlib.inflateSync` silently ignores bytes after the end of a
      // zlib stream, and `DecompressionStream` treats them as junk and errors.
      // So the identical slice inflated in Node and failed in Chromium, and the
      // whole-document count came back 0 with every stream "not inflatable" —
      // a reading indistinguishable from a PDF with no page objects in it.
      let end = bytes.length;
      while (end > 0) {
        const b = bytes[end - 1];
        if (b === 0x0a || b === 0x0d || b === 0x20 || b === 0x09) end--;
        else break;
      }
      const reader = new Blob([bytes.subarray(0, end)])
        .stream()
        .pipeThrough(new DecompressionStream("deflate"))
        .getReader();
      const parts = [];
      let total = 0;
      let truncated = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > cap) {
          truncated = true;
          try {
            await reader.cancel();
          } catch (ignored) {
            /* the stream is already finished with; nothing to report */
          }
          break;
        }
        parts.push(value);
      }
      if (truncated) return { data: null, truncated: true };
      const out = new Uint8Array(total);
      let at = 0;
      for (const part of parts) {
        out.set(part, at);
        at += part.length;
      }
      return { data: out, truncated: false };
    } catch (error) {
      // Not a FlateDecode stream, or truncated — the raw-bytes pass has already
      // seen anything readable in it. Never surfaced; a PDF is full of these.
      return { data: null, truncated: false };
    }
  }

  // ==========================================================================
  // THE TWO METHODS
  // ==========================================================================

  /** Method A over one text slice. @param {string} text @returns {number} */
  function countPageObjects(text) {
    const matches = text.match(PAGE_OBJECT_PATTERN);
    return matches ? matches.length : 0;
  }

  /**
   * The WHOLE dictionary enclosing a position, located by balanced `<<` / `>>`
   * matching backwards then forwards.
   *
   * WHY NOT SLICE FORWARD FROM THE TOKEN. The instrument this ports sliced from
   * the `/Type /Pages` token to the next `>>`, which assumes `/Type` is written
   * before `/Count`. PDF dictionary keys have NO required order, and measured at
   * PC-1 on `handwritten-maths-moderate-33` the producer writes
   * `<</Count 9/Kids[...]/Type/Pages>>` — `/Type` LAST. Slicing forward from it
   * therefore hits `>>` immediately and reads `/Count` and `/Parent` as absent
   * on all three nodes of that file, so method B returned null and the counter
   * refused a document it could have counted. The root is `/Count 9` and its two
   * children sum 8 + 1 = 9, agreeing with method A's 9.
   *
   * This fails in the SAFE direction — toward refusing, never toward a wrong
   * figure — which is why it survived unnoticed. Reading the balanced dictionary
   * is the stated method implemented correctly, not a third method.
   *
   * @param {string} text
   * @param {number} at — an index inside the dictionary.
   * @returns {string|null} the dictionary including its delimiters, or null.
   */
  function enclosingDict(text, at) {
    const floor = Math.max(0, at - MAX_DICT_LOOKBACK);
    let depth = 0;
    let start = -1;
    for (let i = at - 1; i >= floor + 1; ) {
      if (text.charCodeAt(i - 1) === 0x3e && text.charCodeAt(i) === 0x3e) {
        depth++;
        i -= 2;
        continue;
      }
      if (text.charCodeAt(i - 1) === 0x3c && text.charCodeAt(i) === 0x3c) {
        if (depth === 0) {
          start = i - 1;
          break;
        }
        depth--;
        i -= 2;
        continue;
      }
      i--;
    }
    if (start < 0) return null;

    let open = 0;
    for (let j = start; j < text.length - 1; ) {
      if (text.charCodeAt(j) === 0x3c && text.charCodeAt(j + 1) === 0x3c) {
        open++;
        j += 2;
        continue;
      }
      if (text.charCodeAt(j) === 0x3e && text.charCodeAt(j + 1) === 0x3e) {
        open--;
        j += 2;
        if (open === 0) return text.slice(start, j);
        continue;
      }
      j++;
    }
    return null;
  }

  /**
   * Method B over one text slice — every `/Type /Pages` node it can see, each
   * with the `/Count` from its OWN dictionary and whether it carries a
   * `/Parent`. The root is the node with no `/Parent`.
   *
   * @param {string} text
   * @param {string} where — "raw" or "objstm", carried for the log only.
   * @param {Array<Object>} out — accumulator.
   */
  function collectPagesNodes(text, where, out) {
    PAGES_NODE_PATTERN.lastIndex = 0;
    let match;
    while ((match = PAGES_NODE_PATTERN.exec(text)) !== null) {
      const dict = enclosingDict(text, match.index);
      if (dict === null) {
        out.push({ where, count: null, hasParent: false, unreadable: true });
        continue;
      }
      const count = dict.match(COUNT_PATTERN);
      out.push({
        where,
        count: count ? parseInt(count[1], 10) : null,
        hasParent: PARENT_PATTERN.test(dict),
      });
    }
  }

  /**
   * Walk every `stream ... endstream` span and hand the OBJECT STREAMS to both
   * methods. A `latin1` index equals a byte index, so the offsets found in the
   * string address the byte array directly and no per-stream copy is needed.
   *
   * WHY ONLY OBJECT STREAMS. A page object can hide inside a `/Type /ObjStm`
   * stream and nowhere else — an image or content stream cannot carry a PDF
   * object definition. **Measured at PC-1 across all six corpus fixtures, the
   * ObjStm-only pass returns page and page-tree counts IDENTICAL to inflating
   * every stream**, while inflating 0.02 MiB against as much as 1,388 MiB. That
   * equivalence is asserted as a row rather than assumed, because the filter is
   * the one place this port departs from brute force.
   *
   * A stream whose own dictionary cannot be read is inflated ANYWAY. Skipping it
   * would fail toward under-counting, and an under-count on method A reads as a
   * disagreement with method B, which is at least loud.
   *
   * @param {string} raw — the whole PDF as latin1.
   * @param {Uint8Array} bytes — the same PDF as bytes; indices coincide.
   * @param {Object} tally — mutated: pageObjects, streams, inflated, skipped,
   *   truncated, nodes.
   */
  async function scanStreams(raw, bytes, tally) {
    let i = 0;
    for (;;) {
      const start = raw.indexOf("stream", i);
      if (start < 0) break;
      i = start + "stream".length;
      let j = i;
      if (raw[j] === "\r") j++;
      if (raw[j] === "\n") j++;
      const end = raw.indexOf("endstream", j);
      if (end < 0) break;
      tally.streams++;

      const dictEnd = raw.lastIndexOf(">>", start);
      const dict =
        dictEnd > 0 && start - dictEnd < MAX_DICT_LOOKBACK
          ? enclosingDict(raw, dictEnd)
          : null;

      if (dict !== null && !OBJSTM_PATTERN.test(dict)) {
        tally.skipped++;
        i = end + "endstream".length;
        continue;
      }

      const inflated = await inflate(bytes.subarray(j, end), MAX_INFLATED_BYTES);
      if (inflated.truncated) tally.truncated++;
      if (inflated.data) {
        tally.inflated++;
        const text = toLatin1(inflated.data);
        tally.pageObjects += countPageObjects(text);
        collectPagesNodes(text, "objstm", tally.nodes);
      }
      i = end + "endstream".length;
    }
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Count the pages in a PDF, by two independent methods, cross-checked.
   *
   * @param {Blob|ArrayBuffer|Uint8Array} source — the PDF the application holds.
   * @returns {Promise<Object>} `{ pages, methodA, methodB, kidsSum, agree,
   *   streams, inflated, reason }`. `pages` is null whenever a single figure
   *   cannot be justified, and `reason` says which case that is. Callers MUST
   *   show no figure on a null rather than falling back to a heuristic.
   */
  async function countPages(source) {
    const result = {
      pages: null,
      methodA: null,
      methodB: null,
      kidsSum: null,
      agree: false,
      streams: 0,
      inflated: 0,
      skipped: 0,
      truncated: 0,
      reason: null,
    };

    try {
      if (typeof DecompressionStream !== "function") {
        result.reason = UNAVAILABLE.NO_DECOMPRESSION;
        logWarn(
          "No DecompressionStream in this browser — a page count cannot be read from the PDF, so no figure will be shown."
        );
        return result;
      }

      let bytes;
      if (source instanceof Uint8Array) {
        bytes = source;
      } else if (source instanceof ArrayBuffer) {
        bytes = new Uint8Array(source);
      } else if (source && typeof source.arrayBuffer === "function") {
        bytes = new Uint8Array(await source.arrayBuffer());
      } else {
        result.reason = UNAVAILABLE.NO_BYTES;
        logWarn("countPages: no readable bytes were supplied.");
        return result;
      }

      if (bytes.length === 0) {
        result.reason = UNAVAILABLE.NO_BYTES;
        return result;
      }

      const raw = toLatin1(bytes);
      if (raw.indexOf("%PDF-") !== 0 && raw.indexOf("%PDF-") < 0) {
        result.reason = UNAVAILABLE.NOT_A_PDF;
        logWarn("countPages: the bytes supplied carry no %PDF- marker.");
        return result;
      }

      const tally = {
        pageObjects: countPageObjects(raw),
        streams: 0,
        inflated: 0,
        skipped: 0,
        truncated: 0,
        nodes: [],
      };
      collectPagesNodes(raw, "raw", tally.nodes);
      await scanStreams(raw, bytes, tally);

      result.streams = tally.streams;
      result.inflated = tally.inflated;
      result.skipped = tally.skipped;
      result.truncated = tally.truncated;
      result.methodA = tally.pageObjects;

      const numbered = tally.nodes.filter((n) => typeof n.count === "number");
      const roots = numbered.filter((n) => !n.hasParent);
      const kids = numbered.filter((n) => n.hasParent);
      result.methodB = roots.length
        ? Math.max.apply(null, roots.map((r) => r.count))
        : null;
      result.kidsSum = kids.length
        ? kids.reduce((a, k) => a + k.count, 0)
        : null;

      // The page tree's own internal arithmetic. A root whose children do not
      // sum to it is a reason to distrust method B, and is reported rather than
      // absorbed.
      if (
        result.kidsSum !== null &&
        result.methodB !== null &&
        result.kidsSum !== result.methodB
      ) {
        logWarn(
          "The PDF page tree does not balance: the non-root nodes sum to " +
            result.kidsSum +
            " against a root /Count of " +
            result.methodB +
            ". Method B is suspect for this document."
        );
      }

      if (result.methodA === 0 && result.methodB === null) {
        result.reason = UNAVAILABLE.NO_PAGES_FOUND;
        logWarn(
          "countPages: neither method found a page in this PDF. No figure will be shown."
        );
        return result;
      }

      if (result.methodA === result.methodB && result.methodA > 0) {
        result.pages = result.methodA;
        result.agree = true;
        logInfo("Real page count read from the PDF: " + result.pages, {
          methodA: result.methodA,
          methodB: result.methodB,
          streams: result.streams,
          inflated: result.inflated,
        });
        return result;
      }

      // THE DISAGREEMENT IS THE FINDING. Refuse a single figure rather than
      // preferring one method — preferring one is exactly how the window bug
      // would have shipped 6 pages for an 11-page document.
      result.reason = UNAVAILABLE.METHODS_DISAGREE;
      logWarn(
        "The two page-counting methods DISAGREE — method A counted " +
          result.methodA +
          " page objects and method B read a root /Count of " +
          result.methodB +
          ". A page count from one method alone is a hypothesis, so no figure will be shown."
      );
      return result;
    } catch (error) {
      result.reason = UNAVAILABLE.THREW;
      logError("countPages threw; no figure will be shown.", error);
      return result;
    }
  }

  window.MathPixPDFPageCount = {
    countPages,
    UNAVAILABLE,
    // Exported so a suite can assert each method separately: a row driving only
    // countPages cannot say WHICH method produced a figure, and the two-method
    // cross-check is the whole point of the module.
    _countPageObjects: countPageObjects,
    _collectPagesNodes: collectPagesNodes,
    _toLatin1: toLatin1,
  };

  logDebug("MathPixPDFPageCount loaded");
})();
