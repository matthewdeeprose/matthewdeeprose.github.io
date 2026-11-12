/**
 * @fileoverview MathPix page markers: one shared module for the printed page numbers
 * @module MathPixPageMarkers
 * @version 1.0.0 (M-10ao, half 1: inert until something writes markers)
 *
 * @description
 * Page numbers are page furniture. Code, never the AI, writes `<!-- page: N -->` into
 * the working MMD, one per printed page, at the END OF THE LINE ABOVE the page's first
 * line (M-10an: 31 of 31 survived the production correction in place). A page that
 * starts at line 1, or whose host line is a picture line, takes an OWN-LINE marker
 * directly before the target instead. This module holds every pure function that
 * finds, writes, reads, removes or uses those markers. It publishes
 * `window.MathPixPageMarkers` and touches no DOM except the string handed to `swap`.
 *
 * THE MARKER LITERAL IS FROZEN (M-10ao addendum): appended form is one space then
 * `<!-- page: N -->` (N decimal digits only) at the very end of the host line, before
 * any CR; own-line form is a line that is exactly `<!-- page: N -->`. Readers pin it
 * by literal through MARKER_PREFIX, MARKER_SUFFIX and MARKER_RE (applied per line).
 *
 * Page starts are found on the ORIGINAL OCR text (where lines.json order equals text
 * order) and carried onto the working text by text, never by line number. Lifted from
 * the measurement lane: `derivePageStarts` is M-10af step 1 plus step 2;
 * `resolvePageStarts`, `makeKey`, `resolveAnchors` and `placePageFurniture` are
 * M-10ak's key v2 and rule v2.
 *
 * @see .claude/measurements/mai-10ak-placement-rule/page-furniture-postpass.mjs
 * @see .claude/measurements/mai-10an-eol-markers/report.md
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

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
      console.error(`[MathPixPageMarkers] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[MathPixPageMarkers] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[MathPixPageMarkers] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[MathPixPageMarkers] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const MARKER_PREFIX = "<!-- page: ";
  const MARKER_SUFFIX = " -->";
  /** Applied per line, to the line without its trailing CR. Group 1 is the page number. */
  const MARKER_RE = /(?:^| )<!-- page: (\d+) -->$/;

  /** A line that is exactly an own-line marker. */
  const OWN_LINE_PATTERN = /^<!-- page: (\d+) -->$/;

  /** The first line of the appendix: a marker is never written at or after it. */
  const APPENDIX_START = "<!-- img-desc:";

  /**
   * A host that is a picture line or a figure's frame never takes an appended marker:
   * the picture itself, either end of a figure or figure* environment, and its caption
   * (M-10ar: the caption writer skips a figure whose last line hosts a marker). The
   * caption command must end at the command name, so `\captionof` is not matched.
   */
  const OWN_LINE_HOST_PATTERN =
    /^\s*(?:!\[|\\includegraphics|\\(?:begin|end)\{figure\*?\}|\\caption(?![A-Za-z]))/;

  /** The printed-page-number read the sequence rule accepts (M-10af step 2). */
  const CLEAN_PAGE_PATTERN = /^\d{2,3}$/;

  /** Look-alike letters a page-number read can contain (M-10af step 2). */
  const CHARMAP = Object.freeze({
    D: "0",
    O: "0",
    o: "0",
    l: "1",
    I: "1",
    S: "5",
    B: "8",
  });

  /** The sequence rule accepts a jump of at most this many pages and reports the gap. */
  const MAX_SEQUENCE_GAP = 3;

  /** Picture coordinates may differ by this many pixels between lines.json and the URL. */
  const COORD_TOLERANCE = 2;

  /** Matcher prefix length (M-10af step 1) and the shortest probe it will use. */
  const MATCH_PROBE_LENGTH = 18;
  const MATCH_MIN_PROBE = 4;

  /** The `source` stamped on a start derived from MathPix page_info. */
  const SOURCE_PAGE_INFO = "mathpix-page-info";
  /** The `source` stamped by the render copy when the caller gave no metadata. */
  const SOURCE_PAGE_MARKER = "page-marker";

  const PLACEHOLDER_PATTERN = /PFMARK(\d+)PF/g;
  const placeholder = (page) => `PFMARK${page}PF`;

  const PLACEMENT_RULES = Object.freeze({
    MID_LINE: "0-mid-line",
    OWN_PARAGRAPH: "1-own-paragraph",
    END_OF_PREVIOUS_LINE: "2-end-of-previous-line",
    PICTURE_RUN_OWN_LINE: "3-picture-run-own-line",
    BLOCK_OWN_PARAGRAPH: "4-block-own-paragraph",
    AFTER_MARKER: "5-after-marker",
    GLUE_START: "6-glue-start",
  });

  const PICTURE_START = /^!\[/;
  const OWN_BLOCK =
    /^(\\(sub){0,2}section\*?\{|#{1,6}\s|```|~~~|\\begin\{)/;
  const LIST_MARKER =
    /^(\s*(?:[-*+]|\d+[.)])\s+|\s*>\s?|\|\s*|\s*\\item(?:\[[^\]]*\])?\s+)/;

  // ============================================================================
  // SMALL HELPERS
  // ============================================================================

  const markerText = (page) => `${MARKER_PREFIX}${page}${MARKER_SUFFIX}`;
  const toLf = (text) => String(text ?? "").replace(/\r\n/g, "\n");
  /** A line without its trailing CR, and that CR (or ""). */
  const splitCR = (line) =>
    line.endsWith("\r") ? [line.slice(0, -1), "\r"] : [line, ""];
  const escapeAttr = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  /** Text normalised for matching (M-10af step 1; also key v2's `normLine`). */
  const normLine = (s) =>
    String(s ?? "")
      .replace(/\\[a-zA-Z]+|[\s\\${}^_()*#!\[\]|&~.,;:'"`-]/g, "")
      .toLowerCase();

  // ============================================================================
  // READ, STRIP, KEEP
  // ============================================================================

  /**
   * Every marker in a text, one per line at most (the frozen literal ends its line).
   *
   * `startLine` is the 1-based line the page starts on in the UNMARKED text (own-line
   * marker lines are not counted), which is where the render copy puts the page.
   * `kind` is "own-line", "comment-only" (a blank host: the line is a space and the
   * marker) or "appended".
   *
   * @param {string} mmd
   * @returns {Array<{page:number, line:number, startLine:number, kind:string}>}
   */
  function readMarkers(mmd) {
    const found = [];
    let ownLinesSoFar = 0;
    String(mmd ?? "")
      .split("\n")
      .forEach((raw, index) => {
        const [text] = splitCR(raw);
        const m = MARKER_RE.exec(text);
        if (!m) return;
        const own = OWN_LINE_PATTERN.test(text);
        const kind = own
          ? "own-line"
          : text.trim() === markerText(m[1])
            ? "comment-only"
            : "appended";
        if (own) ownLinesSoFar += 1;
        found.push({
          page: Number(m[1]),
          line: index + 1,
          startLine: index + 2 - ownLinesSoFar,
          kind,
        });
      });
    return found;
  }

  /**
   * Remove every page marker, leaving the text byte-identical to the unmarked text:
   * an own-line marker line goes whole, any other marker goes with its one space.
   *
   * @param {string} text
   * @returns {string}
   */
  function stripMarkers(text) {
    if (typeof text !== "string" || text === "") return typeof text === "string" ? text : "";
    const out = [];
    text.split("\n").forEach((raw) => {
      const [bare, cr] = splitCR(raw);
      if (OWN_LINE_PATTERN.test(bare)) return;
      out.push(bare.replace(MARKER_RE, "") + cr);
    });
    return out.join("\n");
  }

  /**
   * Drop every marker in the reply whose number the input did not carry, and collapse
   * duplicates (the first stays). The AI never writes page furniture (M-10an: one reply
   * wrote `<!-- page: 102 -->` the input never had).
   *
   * @param {string} inputMMD
   * @param {string} replyMMD
   * @returns {{ text:string, removedUnknown:number[], collapsedDuplicates:number[],
   *   lost:number[], keptCount:number, totalCount:number }}
   */
  function keepKnownMarkers(inputMMD, replyMMD) {
    const known = new Set(readMarkers(inputMMD).map((m) => m.page));
    const reply = typeof replyMMD === "string" ? replyMMD : "";
    const removedUnknown = [];
    const collapsedDuplicates = [];
    const seen = new Set();
    const out = [];

    reply.split("\n").forEach((raw) => {
      const [bare, cr] = splitCR(raw);
      const m = MARKER_RE.exec(bare);
      if (!m) { out.push(raw); return; }
      const page = Number(m[1]);
      const drop = !known.has(page) ? removedUnknown : seen.has(page) ? collapsedDuplicates : null;
      if (drop) {
        drop.push(page);
        // An own-line marker goes with its line; an appended one goes with its space.
        if (!OWN_LINE_PATTERN.test(bare)) out.push(bare.replace(MARKER_RE, "") + cr);
        return;
      }
      seen.add(page);
      out.push(raw);
    });

    const lost = [...known].filter((page) => !seen.has(page));
    return {
      text: out.join("\n"),
      removedUnknown,
      collapsedDuplicates,
      lost,
      keptCount: seen.size,
      totalCount: known.size,
    };
  }

  // ============================================================================
  // KEY v2 (M-10ak)
  // ============================================================================

  const MIN_KEY = 4;
  const BASE_KEY = 18;
  const isPageBreak = (s) => /^\\pagebreak\s*$/.test(s.trim());
  const stripPictures = (s) => String(s ?? "").replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  const lineKey = (s) => normLine(stripPictures(s));

  function neighbourKey(lines, i, step) {
    for (let j = i + step; j >= 0 && j < lines.length; j += step) {
      const s = lines[j];
      if (s.trim() === "" || isPageBreak(s) || PICTURE_START.test(s)) continue;
      return lineKey(s).slice(0, BASE_KEY);
    }
    return "";
  }

  function picturePosition(lines, i) {
    if (!PICTURE_START.test(lines[i])) return 0;
    let n = 0;
    for (let j = i; j >= 0; j--) {
      const s = lines[j];
      if (PICTURE_START.test(s)) { n++; continue; }
      if (s.trim() === "" || isPageBreak(s)) continue;
      break;
    }
    return n;
  }

  /**
   * A text key for line `lineNo` (1-based) of `lines`: its normalised text, extended
   * past 18 characters until no OTHER line contains it, with the keys of the nearest
   * text lines above and below and, for a repeated line, its occurrence. A picture
   * line has no text of its own: its key is its position in its run of pictures.
   */
  function makeKey(lines, lineNo) {
    const i = lineNo - 1;
    const line = lines[i];
    const before = neighbourKey(lines, i, -1);
    const after = neighbourKey(lines, i, +1);
    const pictures = picturePosition(lines, i);
    if (pictures > 0) return { key: null, before, after, pictures };
    const full = lineKey(line);
    if (full.length < MIN_KEY) return { key: null, before, after, pictures: 0 };
    const others = lines.map((s, j) => (j === i ? null : lineKey(s)));
    let len = Math.min(BASE_KEY, full.length);
    while (len < full.length && others.some((o) => o !== null && o.includes(full.slice(0, len)))) len++;
    const key = full.slice(0, len);
    const all = lines.map((s, j) => (lineKey(s).includes(key) ? j : -1)).filter((j) => j >= 0);
    return { key, before, after, pictures: 0, occurrence: all.indexOf(i) + 1, of: all.length };
  }

  /**
   * Resolve key anchors against `lines`, in page order (each search starts after the
   * previous page's line). One line holds the key: "unique". Several: the first whose
   * neighbour matches ("resolved-by-context"), else the same occurrence when the count
   * is unchanged ("resolved-by-occurrence"), else NO line: "ambiguous". A wrong place
   * is worse than none.
   */
  function resolveAnchors(lines, pages) {
    const norm = lines.map(lineKey);
    let from = 0;
    return pages.map((p) => {
      const a = p.anchor || {};
      if (a.key == null && !(a.pictures > 0)) return { page: p.page, line: null, candidates: 0, status: "no key" };
      const fail = (status, candidates = 0) => ({ page: p.page, line: null, candidates, status });
      const ok = (i, candidates, status) => { from = i + 1; return { page: p.page, line: i + 1, candidates, status }; };
      const ctx = (i) => (a.before && neighbourKey(lines, i, -1) === a.before ? 1 : a.after && neighbourKey(lines, i, +1) === a.after ? 2 : 0);
      if (a.key == null) {
        const hits = [];
        for (let i = from; i < lines.length; i++) if (picturePosition(lines, i) === a.pictures && ctx(i)) hits.push(i);
        return hits.length === 0 ? fail("not found") : ok(hits[0], hits.length, hits.length === 1 ? "unique" : "resolved-by-context");
      }
      const all = [];
      for (let i = 0; i < lines.length; i++) if (norm[i].includes(a.key)) all.push(i);
      const hits = all.filter((i) => i >= from);
      if (hits.length === 0) return fail("not found");
      if (hits.length === 1) return ok(hits[0], 1, "unique");
      const byBefore = a.before ? hits.filter((i) => neighbourKey(lines, i, -1) === a.before) : [];
      if (byBefore.length) return ok(byBefore[0], hits.length, "resolved-by-context");
      const byAfter = a.after ? hits.filter((i) => neighbourKey(lines, i, +1) === a.after) : [];
      if (byAfter.length) return ok(byAfter[0], hits.length, "resolved-by-context");
      if (a.of && all.length === a.of && all[a.occurrence - 1] >= from) return ok(all[a.occurrence - 1], hits.length, "resolved-by-occurrence");
      return fail("ambiguous", hits.length);
    });
  }

  // ============================================================================
  // DERIVE (M-10af step 1 + step 2) AND RESOLVE (key v2)
  // ============================================================================

  /**
   * The consecutive-sequence rule (M-10af step 2). Input: the page_info reads in
   * lines.json order. Output: one `{ value, flag }` per read and the numbers it
   * reports as missing (no slot).
   */
  function sequenceRule(readList) {
    const out = [];
    const missing = [];
    const clean = (t) => {
      const s = String(t).replace(/[()\s]/g, "");
      return CLEAN_PAGE_PATTERN.test(s) ? Number(s) : null;
    };
    const firstIdx = readList.findIndex((t) => clean(t) != null);
    if (firstIdx < 0) {
      return { out: readList.map(() => ({ value: null, flag: "none" })), missing };
    }
    for (let k = 0; k < readList.length; k++) {
      if (k < firstIdx) {
        out.push({ value: clean(readList[firstIdx]) - (firstIdx - k), flag: "backfilled" });
        continue;
      }
      if (k === firstIdx) {
        out.push({ value: clean(readList[k]), flag: "anchor" });
        continue;
      }
      const prev = out[k - 1].value;
      const c = clean(readList[k]);
      if (c === prev + 1) out.push({ value: c, flag: "ok" });
      else if (c != null && c > prev + 1 && c <= prev + MAX_SEQUENCE_GAP) {
        for (let m = prev + 1; m < c; m++) missing.push({ value: m, afterSlot: k - 1 });
        out.push({ value: c, flag: "ok-after-gap" });
      } else if (c != null) out.push({ value: prev + 1, flag: "assumed" });
      else {
        const s = String(readList[k]).replace(/[()\s]/g, "");
        const want = String(prev + 1);
        const mapped = s.replace(/./g, (ch) => CHARMAP[ch] ?? ch);
        if (want.startsWith(s) || mapped === want) out.push({ value: prev + 1, flag: "repaired" });
        else out.push({ value: prev + 1, flag: "assumed" });
      }
    }
    return { out, missing };
  }

  /** True when lines.json holds at least one page_info line. */
  function hasPageInfo(linesData) {
    return !!(
      linesData &&
      Array.isArray(linesData.pages) &&
      linesData.pages.some((pg) => (pg.lines || []).some((ln) => ln.type === "page_info"))
    );
  }

  /**
   * Where each printed page starts in the ORIGINAL OCR text (the ZIP's results/*.mmd,
   * where lines.json order equals text order: M-10aj).
   *
   * For every page_info line, the page starts at the next content line
   * (`conversion_output`) in lines.json order, matched forward-only to an MMD line: a
   * picture by the top_left_x / top_left_y pair in its `![](…)` URL, a text line by a
   * normalised 18-character prefix. The printed number is repaired by the sequence
   * rule. A number it cannot place or repair is returned as unplaced, never guessed.
   *
   * @param {Object} linesData - parsed lines.json (`{ pages:[{ lines:[…] }] }`)
   * @param {string} originalMMD - the unedited OCR text
   * @returns {{ starts:Array<{page:number,label:string,source:string,confidence:?number,
   *   originalLine:number}>, unplaced:Array<{page:?number, reason:string}> }}
   */
  function derivePageStarts(linesData, originalMMD) {
    const unplaced = [];
    if (!linesData || !Array.isArray(linesData.pages) || typeof originalMMD !== "string") {
      return { starts: [], unplaced: [{ page: null, reason: "no lines data" }] };
    }
    const mmdLines = toLf(originalMMD).split("\n");
    const mmdNorm = mmdLines.map(normLine);
    const imgRe = /top_left_y=(\d+)&top_left_x=(\d+)/;
    const imgAt = mmdLines.map((s) => {
      const m = imgRe.exec(s);
      return m ? { y: Number(m[1]), x: Number(m[2]) } : null;
    });

    const flat = [];
    linesData.pages.forEach((pg) => (pg.lines || []).forEach((ln) => flat.push({ ln })));

    // Forward-only matching of every content line to an MMD line.
    let cursor = 0;
    const matched = new Map();
    flat.forEach((f, fi) => {
      const ln = f.ln;
      if (!ln.conversion_output) return;
      if ((ln.type === "diagram" || ln.type === "chart") && ln.region) {
        for (let j = cursor; j < mmdLines.length; j++) {
          const im = imgAt[j];
          if (
            im &&
            Math.abs(im.y - ln.region.top_left_y) <= COORD_TOLERANCE &&
            Math.abs(im.x - ln.region.top_left_x) <= COORD_TOLERANCE
          ) {
            matched.set(fi, j + 1);
            cursor = j + 1;
            return;
          }
        }
      }
      const disp = ln.text_display || ln.text || "";
      const first =
        String(disp)
          .split("\n")
          .map((s) => s.trim())
          .find((s) => normLine(s).length >= MATCH_MIN_PROBE) || disp;
      const probe = normLine(first).slice(0, MATCH_PROBE_LENGTH);
      if (probe.length < MATCH_MIN_PROBE) return;
      for (let j = cursor; j < mmdLines.length; j++) {
        if (mmdNorm[j].includes(probe)) {
          matched.set(fi, j + 1);
          cursor = j;
          return;
        }
      }
    });

    // The page_info slots that carry a digit; 'final' and 'voltage' are words, skipped.
    const slots = [];
    flat.forEach((f, fi) => {
      if (f.ln.type !== "page_info" || !/\d/.test(String(f.ln.text ?? ""))) return;
      let next = null;
      for (let k = fi + 1; k < flat.length; k++) {
        if (flat[k].ln.conversion_output) { next = k; break; }
      }
      slots.push({ read: String(f.ln.text), confidence: f.ln.confidence, next });
    });

    const rule = sequenceRule(slots.map((s) => s.read));
    const starts = [];
    slots.forEach((slot, k) => {
      const { value } = rule.out[k];
      if (value == null) { unplaced.push({ page: null, reason: `unreadable "${slot.read}"` }); return; }
      if (slot.next == null) { unplaced.push({ page: value, reason: "end of document: no content after it" }); return; }
      const originalLine = matched.get(slot.next);
      if (!originalLine) { unplaced.push({ page: value, reason: "next content line not found in the text" }); return; }
      starts.push({
        page: value,
        label: String(value),
        source: SOURCE_PAGE_INFO,
        confidence: typeof slot.confidence === "number" ? slot.confidence : null,
        originalLine,
      });
    });
    rule.missing.forEach((m) =>
      unplaced.push({ page: m.value, reason: "no page_info slot (number in a gap)" }),
    );
    logDebug("derivePageStarts", { starts: starts.length, unplaced: unplaced.length });
    return { starts, unplaced };
  }

  /**
   * Carry page starts from the original text onto the working text by TEXT: the key
   * is taken from the original line (key v2) and looked up in the working text, in
   * page order. It declines rather than guesses.
   *
   * @param {Array} starts - from derivePageStarts
   * @param {string} originalMMD
   * @param {string} workingMMD
   * @returns {Array<Object>} each start plus `workingLine` (1-based) or `declineReason`
   */
  function resolvePageStarts(starts, originalMMD, workingMMD) {
    const origLines = toLf(originalMMD).split("\n");
    const workLines = toLf(workingMMD).split("\n");
    const anchored = (starts || []).map((s) => ({
      page: s.page,
      anchor: makeKey(origLines, s.originalLine),
    }));
    const resolved = resolveAnchors(workLines, anchored);
    return (starts || []).map((s, i) => {
      const r = resolved[i];
      return r.line != null
        ? { ...s, workingLine: r.line, status: r.status }
        : { ...s, workingLine: null, declineReason: r.status };
    });
  }

  // ============================================================================
  // INSERT
  // ============================================================================

  /**
   * Write markers into the working MMD. `resolved` is the output of resolvePageStarts.
   *
   * Per page, and counted, nothing is written when: the target line is at or after the
   * first `<!-- img-desc:` line (the appendix); the target was not found; the host or
   * the target already carries a page marker. A marker is never appended to a picture
   * line: where the host is one, or the target is line 1, the marker goes on its own
   * line directly before the target. A blank host becomes a comment-only line. Line
   * endings are kept (the marker goes before a CR). Bottom-up, so line numbers hold.
   *
   * @param {string} workingMMD
   * @param {Array} resolved
   * @returns {{ text:string, inserted:Array<{page:number,line:number,kind:string}>,
   *   declined:Array<{page:?number, reason:string}> }}
   */
  function insertMarkers(workingMMD, resolved) {
    const lines = String(workingMMD ?? "").split("\n");
    const appendixAt = lines.findIndex((l) => l.includes(APPENDIX_START));
    const inserted = [];
    const declined = [];
    const work = [];
    const carries = (i) => MARKER_RE.test(splitCR(lines[i])[0]);

    (resolved || []).forEach((p) => {
      const page = p && p.page;
      if (!p || p.workingLine == null) {
        declined.push({ page, reason: (p && p.declineReason) || "target not found" });
        return;
      }
      const i = p.workingLine - 1;
      if (!Number.isInteger(i) || i < 0 || i >= lines.length) {
        declined.push({ page, reason: "target not found" });
        return;
      }
      if (appendixAt >= 0 && i >= appendixAt) {
        declined.push({ page, reason: "target is in the appendix" });
        return;
      }
      if (carries(i) || (i > 0 && carries(i - 1))) {
        declined.push({ page, reason: "host or target already carries a page marker" });
        return;
      }
      if (work.some((w) => w.i === i)) {
        declined.push({ page, reason: "another page already starts on this target" });
        return;
      }
      work.push({ page, i });
    });

    work.sort((a, b) => b.i - a.i);
    work.forEach(({ page, i }) => {
      const [target, cr] = splitCR(lines[i]);
      const host = i > 0 ? splitCR(lines[i - 1]) : null;
      if (host === null || OWN_LINE_HOST_PATTERN.test(host[0])) {
        lines.splice(i, 0, markerText(page) + cr);
        inserted.push({ page, line: i + 1, kind: "own-line" });
        return;
      }
      lines[i - 1] = `${host[0]} ${markerText(page)}${host[1]}`;
      inserted.push({
        page,
        line: i + 1,
        kind: host[0].trim() === "" ? "comment-only" : "appended",
      });
    });
    inserted.sort((a, b) => a.line - b.line);
    return { text: lines.join("\n"), inserted, declined };
  }

  /**
   * The ONE entry for the ledger. Idempotent: a working text that already holds any
   * page marker comes back unchanged with `skipped: "already marked"`; lines.json with
   * no page_info gives `skipped: "no page_info"`. Logs once per call, at INFO.
   *
   * @param {{ workingMMD:string, originalMMD:string, linesData:Object }} args
   * @returns {{ text:string, inserted:Array, declined:Array<{page:?number,reason:string}>,
   *   skipped:?string }}
   */
  function ensurePageMarkers({ workingMMD, originalMMD, linesData } = {}) {
    const working = typeof workingMMD === "string" ? workingMMD : "";
    const unchanged = (skipped) => {
      logInfo("ensurePageMarkers skipped", { skipped });
      return { text: working, inserted: [], declined: [], skipped };
    };
    if (readMarkers(working).length > 0) return unchanged("already marked");
    if (!hasPageInfo(linesData)) return unchanged("no page_info");

    const derived = derivePageStarts(linesData, originalMMD);
    const resolved = resolvePageStarts(derived.starts, originalMMD, working);
    const written = insertMarkers(working, resolved);
    const declined = [...derived.unplaced, ...written.declined];
    logInfo("ensurePageMarkers", {
      inserted: written.inserted.length,
      declined: declined.length,
    });
    return { text: written.text, inserted: written.inserted, declined, skipped: null };
  }

  // ============================================================================
  // PLACE AND SWAP (M-10ak rule v2)
  // ============================================================================

  /** The contract's element (design-page-furniture.md § 1): five attributes, no children. */
  function elementFor(p) {
    const conf =
      p.confidence == null || Number.isNaN(Number(p.confidence))
        ? ""
        : ` data-page-confidence="${Number(p.confidence).toFixed(2)}"`;
    return `<span data-page-furniture="page-number" data-page="${escapeAttr(p.page)}" data-page-label="${escapeAttr(p.label)}" data-page-source="${escapeAttr(p.source)}"${conf}></span>`;
  }

  /**
   * M-10ar: an anchor on a blank line moves forward to the next non-blank line, so the
   * rule is chosen for the content the page starts with (a blank line after an own-line
   * marker is what the first Save of a picture writes). It stays where it is when it
   * carries an explicit offset, when only blank lines follow, or when the next
   * non-blank line is the appendix. `line` is 1-based; the result is too.
   */
  function skipBlankLines(lines, line, offset) {
    if (offset != null || lines[line - 1].trim() !== "") return line;
    for (let j = line; j < lines.length; j++) {
      if (lines[j].trim() === "") continue;
      return lines[j].includes(APPENDIX_START) ? line : j + 1;
    }
    return line;
  }

  /**
   * Build the render copy: the markers come out, and a placeholder token goes at each
   * page start by RULE V2 (cases 0 to 6, tried in order; see M-10ak). `swap(html)`
   * then turns each placeholder in the RENDERED html into the contract's element.
   *
   * Anchors come from `readMarkers(mmd)` (the page starts on the line after the
   * marker, counted in the unmarked text). `pages` is optional metadata,
   * `[{ page, label, source, confidence, anchor }]`: a page that carries its own
   * `anchor` ({ line } / { line, offset } / a text key) uses it instead.
   *
   * @param {string} mmd - a marked MMD
   * @param {Array} [pages]
   * @returns {{ text:string, placements:Array, unplaced:Array, swap:Function }}
   */
  function placePageFurniture(mmd, pages) {
    const marked = toLf(mmd);
    if (new RegExp(PLACEHOLDER_PATTERN.source).test(marked)) {
      throw new Error("the MMD already contains a PFMARK<n>PF string; a placeholder would be ambiguous");
    }
    const meta = new Map((pages || []).map((p) => [String(p.page), p]));
    const list = [];
    const seen = new Set();
    readMarkers(marked).forEach((m) => {
      seen.add(String(m.page));
      const given = meta.get(String(m.page)) || {};
      list.push({
        page: m.page,
        label: given.label ?? String(m.page),
        source: given.source ?? SOURCE_PAGE_MARKER,
        confidence: given.confidence ?? null,
        anchor: given.anchor ?? { line: m.startLine },
      });
    });
    (pages || []).forEach((p) => {
      if (seen.has(String(p.page))) return;
      list.push({
        page: p.page,
        label: p.label ?? String(p.page),
        source: p.source ?? SOURCE_PAGE_MARKER,
        confidence: p.confidence ?? null,
        anchor: p.anchor ?? null,
      });
    });

    const lines = stripMarkers(marked).split("\n");
    const unplaced = [];
    const work = [];
    const keyed = list.filter((p) => p.anchor && (p.anchor.key != null || p.anchor.pictures > 0));
    const resolved = new Map(resolveAnchors(lines, keyed).map((r) => [r.page, r]));
    list.forEach((p) => {
      const a = p.anchor;
      if (!a) { unplaced.push({ page: p.page, reason: "no anchor" }); return; }
      let line = a.line ?? null;
      if (line == null && (a.key != null || a.pictures > 0)) {
        const r = resolved.get(p.page);
        line = r ? r.line : null;
      }
      if (line == null) { unplaced.push({ page: p.page, reason: "anchor not found" }); return; }
      if (line < 1 || line > lines.length) { unplaced.push({ page: p.page, reason: "line out of range" }); return; }
      work.push({ p, line: skipBlankLines(lines, line, a.offset ?? null), offset: a.offset ?? null });
    });
    work.sort((x, y) => y.line - x.line);

    const out = lines.slice();
    const placements = [];
    work.forEach(({ p, line, offset }) => {
      const i = line - 1;
      const tok = placeholder(p.page);
      const T = lines[i];
      const P = i > 0 ? lines[i - 1] : "";
      let rule;
      if (offset != null) { out[i] = out[i].slice(0, offset) + tok + out[i].slice(offset); rule = PLACEMENT_RULES.MID_LINE; }
      else if (i === 0 || P.trim() === "") { out.splice(i, 0, tok, ""); rule = PLACEMENT_RULES.OWN_PARAGRAPH; }
      else if (PICTURE_START.test(T) && !PICTURE_START.test(P)) { out[i - 1] = out[i - 1] + tok; rule = PLACEMENT_RULES.END_OF_PREVIOUS_LINE; }
      else if (PICTURE_START.test(T)) { out.splice(i, 0, tok); rule = PLACEMENT_RULES.PICTURE_RUN_OWN_LINE; }
      else if (OWN_BLOCK.test(T)) { out.splice(i, 0, "", tok, ""); rule = PLACEMENT_RULES.BLOCK_OWN_PARAGRAPH; }
      else if (LIST_MARKER.test(T)) { const m = LIST_MARKER.exec(T)[0]; out[i] = m + tok + T.slice(m.length); rule = PLACEMENT_RULES.AFTER_MARKER; }
      else { out[i] = tok + out[i]; rule = PLACEMENT_RULES.GLUE_START; }
      placements.push({ page: p.page, line, rule });
    });
    placements.sort((x, y) => x.line - y.line);

    const byPage = new Map(list.map((p) => [String(p.page), p]));
    const swap = (html) => {
      let swapped = 0;
      const left = [];
      const el = (n) => {
        const p = byPage.get(String(n));
        if (!p) return null;
        swapped++;
        return elementFor(p);
      };
      const ownLine = new Set(
        placements.filter((x) => x.rule === PLACEMENT_RULES.PICTURE_RUN_OWN_LINE).map((x) => String(x.page)),
      );
      // A token on a line of its own between two picture lines renders as "PFMARK<n>PF<br>": the break goes with it.
      let s = String(html).replace(/PFMARK(\d+)PF<br\s*\/?>\s*/g, (m, n) => (ownLine.has(n) ? (el(n) ?? m) : m));
      // An own-paragraph token renders as "<p>PFMARK<n>PF</p>" plus a newline; the element replaces all of it.
      s = s.replace(/<p>\s*PFMARK(\d+)PF\s*<\/p>\n?/g, (m, n) => el(n) ?? m);
      s = s.replace(/PFMARK(\d+)PF/g, (m, n) => el(n) ?? m);
      for (const m of s.matchAll(/PFMARK\d+PF/g)) left.push(m[0]);
      return { html: s, swapped, left };
    };
    return { text: out.join("\n"), placements, unplaced, swap };
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  window.MathPixPageMarkers = Object.freeze({
    MARKER_PREFIX,
    MARKER_SUFFIX,
    MARKER_RE,
    PLACEMENT_RULES,
    derivePageStarts,
    resolvePageStarts,
    insertMarkers,
    ensurePageMarkers,
    readMarkers,
    stripMarkers,
    keepKnownMarkers,
    placePageFurniture,
    makeKey,
    resolveAnchors,
    elementFor,
  });

  logInfo("MathPixPageMarkers ready");
})();
