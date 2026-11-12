// ─── MathPixDocxAltText ──────────────────────────────────────────────────────
// window.MathPixDocxAltText — after the Convert API returns a Word file or its
// HTML, sets every picture's alt text from the image registry (UT-7, UT-D2
// option 1, 22 October 2026).
//
// Why: UT-6 proved no stored encoding of a lone square bracket survives the
// MathPix converter. The entity and a backslash reach the Word descr and the
// converter HTML alt literally, and a raw bracket in the includegraphics alt is
// deleted. The stored form stays as UT-3 made it; this pass overwrites what the
// converter wrote with the registry value, exactly.
//
// All or nothing. The pictures in the file are paired with the expected alts in
// order, and every pair is confirmed by comparing both alts after a
// normalisation that removes brackets, the entity, backslashes and whitespace.
// If every pair confirms the file is rewritten; otherwise nothing changes and
// the outcome says so. Never throws; any error is a mismatch, file unchanged.
//
// Expected alts come from the MMD the converter was sent (body pictures and the
// AP-D1 appendix copies, in that MMD's own order), each resolved to its registry
// entry. A picture whose MMD alt is a raw <smiles> string is a KEEP slot:
// counted in order, never changed and never confirmed.
//
// XML and HTML are edited with string operations only (as the heading map).
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  // Logging configuration
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
      console.error("[DocxAlt]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[DocxAlt]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[DocxAlt]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[DocxAlt]", message, ...args);
  }

  // =========================================================================
  // Constants
  // =========================================================================

  const DOCX_MIME =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  /** Outcome reasons, so a caller or a row can tell a mismatch from a no-op. */
  const REASON = Object.freeze({
    NOTHING_OWED: "nothing-owed",
    APPLIED: "applied",
    COUNT_MISMATCH: "count-mismatch",
    PAIR_MISMATCH: "pair-mismatch",
    UNRESOLVED: "unresolved-picture",
    SHAPE_MISMATCH: "shape-mismatch",
    UNAVAILABLE: "unavailable",
    ERROR: "error",
  });

  /** Marks an expected slot that is counted but never changed or confirmed. */
  const KEEP = Object.freeze({ keep: true });

  // A drawing is only a picture when it carries a pic:pic.
  const DRAWING_RE = /<w:drawing>[\s\S]*?<\/w:drawing>/g;
  const DOC_PR_RE = /<wp:docPr\b[^>]*?\/?>/;
  const C_NV_PR_RE = /<pic:cNvPr\b[^>]*?\/?>/;
  const IMG_TAG_RE = /<img\b[^>]*>/gi;

  // Word's "Mark as decorative" (DW-2): an extension inside wp:docPr. The uri and
  // namespace are those Word, LibreOffice and the Open XML SDK write; the spec
  // text itself ([MS-ODRAWXML]) was not reachable when this was written.
  const DECORATIVE_URI = "{C183D7F6-B498-43B3-948B-1728B52AA6E4}";
  const DECORATIVE_NS = "http://schemas.microsoft.com/office/drawing/2017/decorative";
  const DRAWINGML_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const DECORATIVE_EXT =
    `<a:ext uri="${DECORATIVE_URI}"><adec:decorative xmlns:adec="${DECORATIVE_NS}" val="1"/></a:ext>`;
  const DOC_PR_BLOCK_RE = /<wp:docPr\b([^>]*?)(\/>|>([\s\S]*?)<\/wp:docPr>)/;

  // MMD image lines (a bare line, as the serialiser's own parsers require).
  const MD_IMAGE_RE = /^!\[((?:[^\]]|\](?!\())*)\]\(([^)]+)\)$/;
  const INCLUDEGRAPHICS_RE = /^\\includegraphics\b.*\{([^}]+)\}$/;

  // A picture anywhere in a line (WCX, 6 November 2026). Measured on smp.zip:
  // "\item[] ![alt](url)" is a picture in the converted docx, so a picture
  // inside a list item or a table cell must be counted, or every later pair is
  // out by one and the pass refuses. WCX-2 measured the rest on one converted
  // probe (.claude/measurements/wcx-2-shapes-probe/): an inline
  // \includegraphics and a raw <img> are pictures too, in Word and in HTML.
  const MD_IMAGE_INLINE_RE = /!\[((?:[^\]]|\](?!\())*)\]\(([^)]+)\)/g;
  // Options may hold one level of braces (alt={...}); deeper nesting does not
  // match, the picture is not counted, and the pass refuses on the count.
  const GFX_INLINE_RE = /\\includegraphics\b(?:\s*\[(?:[^[\]{}]|\{[^{}]*\})*\])?\s*\{([^}]+)\}/g;
  const IMG_SRC_RE = /<img\b[^>]*?\ssrc\s*=\s*(["'])(.*?)\1[^>]*>/gi;
  const IMG_ALT_RE = /\salt\s*=\s*(["'])(.*?)\1/i;
  const CODE_SPAN_RE = /`+[^`]*`+/g;

  // WCX-2: a second identity check on every Word pair, the picture's shape.
  // Measured on the probe: each docx wp:extent width over height equalled the
  // CDN URL's width over height to four decimals. Relative tolerance allowed.
  const SHAPE_TOLERANCE = 0.01;
  const EXTENT_RE = /<wp:extent\s+cx="(\d+)"\s+cy="(\d+)"/;
  const URL_WIDTH_RE = /[?&]width=(\d+(?:\.\d+)?)(?:&|$)/;
  const URL_HEIGHT_RE = /[?&]height=(\d+(?:\.\d+)?)(?:&|$)/;

  // Blocks the converter prints as text, so their image lines are not pictures.
  const FENCE_RE = /^\s*(```|~~~)/;
  const VERBATIM_OPEN_RE = /^\s*\\begin\{verbatim\}/;
  const VERBATIM_CLOSE_RE = /^\s*\\end\{verbatim\}/;

  // =========================================================================
  // Text helpers
  // =========================================================================

  /** Decode the five XML/HTML entities the converters write into attributes. */
  function decodeEntities(s) {
    return String(s)
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
  }

  function encodeAttribute(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Comparison form for confirming a pair: square brackets, the closing-bracket
   * entity (single or doubled ampersand), backslashes and whitespace removed.
   * @param {string} s
   * @returns {string}
   */
  function normaliseAlt(s) {
    return String(s)
      .replace(/&(?:amp;)*#93;/g, "")
      .replace(/[[\]\\\s]/g, "");
  }

  // =========================================================================
  // expectedAltsFromMMD
  // =========================================================================

  /**
   * Every picture one MMD line carries, in line order. A bare image line gives
   * exactly what it always gave; any other line gives each markdown image,
   * \includegraphics and raw <img> in it, outside inline code, in line order.
   * Pure.
   * @param {string} line
   * @returns {Array<{url:string, rawAlt:string}>}
   */
  function imagesOfLine(line) {
    const trimmed = line.trim();
    const md = MD_IMAGE_RE.exec(trimmed);
    if (md) return [{ url: md[2], rawAlt: md[1] }];
    const gfx = INCLUDEGRAPHICS_RE.exec(trimmed);
    const outsideCode = trimmed.replace(CODE_SPAN_RE, " ");
    const inlineGfx = [...outsideCode.matchAll(GFX_INLINE_RE)];
    // A bare \includegraphics line keeps its old reading, unless it holds two.
    if (gfx && inlineGfx.length <= 1) return [{ url: gfx[1], rawAlt: trimmed }];
    if (!/!\[|\\includegraphics|<img\b/i.test(outsideCode)) return [];

    const found = [];
    for (const m of outsideCode.matchAll(MD_IMAGE_INLINE_RE)) {
      found.push({ at: m.index, url: m[2], rawAlt: m[1] });
    }
    for (const m of inlineGfx) {
      found.push({ at: m.index, url: m[1], rawAlt: m[0] });
    }
    for (const m of outsideCode.matchAll(IMG_SRC_RE)) {
      const alt = IMG_ALT_RE.exec(m[0]);
      found.push({ at: m.index, url: decodeEntities(m[2]), rawAlt: alt ? alt[2] : "" });
    }
    return found
      .sort((a, b) => a.at - b.at)
      .map(({ url, rawAlt }) => ({ url, rawAlt }));
  }

  /**
   * An entry's width over height: the CDN URL's crop size, else the
   * registry's dimensions, else null (no check for that picture). Pure.
   * @param {Object|null} entry
   * @returns {number|null}
   */
  function shapeOfEntry(entry) {
    if (!entry) return null;
    const url = String(entry.originalUrl || "");
    const w = URL_WIDTH_RE.exec(url);
    const h = URL_HEIGHT_RE.exec(url);
    if (w && h && +w[1] > 0 && +h[1] > 0) return +w[1] / +h[1];
    const d = entry.dimensions;
    if (d && +d.width > 0 && +d.height > 0) return +d.width / +d.height;
    return null;
  }

  /**
   * The line indexes the converter renders as text (fenced and verbatim
   * blocks, their markers included), as headingSequence skips them. Pure.
   * @param {string[]} lines
   * @returns {Set<number>}
   */
  function textBlockLines(lines) {
    const out = new Set();
    let inFence = false;
    let inVerbatim = false;
    lines.forEach((raw, i) => {
      const line = raw.replace(/\r$/, "");
      if (!inVerbatim && FENCE_RE.test(line)) {
        inFence = !inFence;
        out.add(i);
        return;
      }
      if (!inFence && VERBATIM_OPEN_RE.test(line)) inVerbatim = true;
      if (inFence || inVerbatim) out.add(i);
      if (inVerbatim && VERBATIM_CLOSE_RE.test(line)) inVerbatim = false;
    });
    return out;
  }

  /**
   * The alt each picture in the converted file must carry, in the order the
   * MMD presents its pictures (body, then any appendix copies). Pure.
   *
   * @param {string} mmd - the conversion copy of the MMD, before image embedding
   * @param {Object} registry - needs getAllImages()
   * @param {Map<string,string>} [imageBlobUrlMap]
   * @returns {{alts: Array<string|Object>, decorative: boolean[], shapes: Array<number|null>, unresolved: number}|null}
   *   null when the serialiser, registry or MMD is unavailable. A KEEP slot is
   *   the frozen KEEP object; an image line no registry entry owns counts as
   *   unresolved. `decorative` runs parallel to `alts`: true only for a slot
   *   whose registry entry is marked decorative (DW-2). `shapes` runs parallel
   *   too: the entry's width over height, or null when it is not known (WCX-2).
   */
  function expectedAltsFromMMD(mmd, registry, imageBlobUrlMap = null) {
    try {
      const serialiser = window.MathPixAltTextMMDSerialiser;
      if (
        typeof mmd !== "string" ||
        !registry ||
        typeof registry.getAllImages !== "function" ||
        !serialiser ||
        typeof serialiser.findImage !== "function"
      ) {
        return null;
      }

      const lines = mmd.split("\n");
      const skipped = textBlockLines(lines);

      // URL to registry entry. The locator the writers use goes first; then the
      // entry's own URL and its blob form fill any gap, because a restored
      // entry can still carry its original markdown reference after the writers
      // wrapped the picture in a figure, and the locator misses that (UT-7).
      // The locator names a LINE, so its URL is taken only when that line holds
      // exactly one picture; on a line with two it could be either one.
      const urlToEntry = new Map();
      const entries = registry.getAllImages();
      for (const entry of entries) {
        const loc = serialiser.findImage(mmd, entry, imageBlobUrlMap);
        if (!loc.found) continue;
        const onLine = imagesOfLine(lines[loc.lineIndex]);
        if (onLine.length === 1) urlToEntry.set(onLine[0].url, entry);
      }
      for (const entry of entries) {
        const blobUrl =
          imageBlobUrlMap && typeof imageBlobUrlMap.get === "function"
            ? imageBlobUrlMap.get(entry.originalUrl)
            : null;
        for (const url of [entry.originalUrl, blobUrl]) {
          if (url && !urlToEntry.has(url)) urlToEntry.set(url, entry);
        }
      }

      const alts = [];
      const decorative = [];
      const shapes = [];
      let unresolved = 0;
      lines.forEach((line, i) => {
        if (skipped.has(i)) return;
        for (const parsed of imagesOfLine(line)) {
          const entry = urlToEntry.get(parsed.url) || null;
          // A KEEP slot's alt is never checked, so its shape is the only check.
          shapes.push(shapeOfEntry(entry));
          if (/<smiles/i.test(parsed.rawAlt)) {
            alts.push(KEEP);
            decorative.push(false);
            continue;
          }
          if (!entry) {
            unresolved++;
            alts.push(null);
            decorative.push(false);
            continue;
          }
          const isDecorative = entry.decorative === true;
          alts.push(isDecorative ? "" : String(entry.altText || ""));
          decorative.push(isDecorative);
        }
      });
      return { alts, decorative, shapes, unresolved };
    } catch (err) {
      logError("expectedAltsFromMMD: failed", err);
      return null;
    }
  }

  // =========================================================================
  // Pairing and confirming (shared by Word and HTML)
  // =========================================================================

  /**
   * Confirm every pair. Returns a reason when anything fails, else null.
   * @param {Array<string|null|Object>} expected
   * @param {string[]} found - the alts the converter wrote, decoded, in order
   */
  function confirmPairs(expected, found) {
    if (expected.length !== found.length) {
      logWarn(
        `confirmPairs: the MMD gives ${expected.length} picture(s) but the file has ${found.length}`,
      );
      return REASON.COUNT_MISMATCH;
    }
    for (let i = 0; i < expected.length; i++) {
      const want = expected[i];
      if (want === KEEP) continue;
      if (want === null) {
        logWarn(`confirmPairs: picture ${i + 1} of ${expected.length} has no registry entry`);
        return REASON.UNRESOLVED;
      }
      if (normaliseAlt(want) !== normaliseAlt(found[i])) {
        logWarn(
          `confirmPairs: picture ${i + 1} of ${expected.length} differs: registry "${String(want).slice(0, 80)}", file "${String(found[i]).slice(0, 80)}"`,
        );
        return REASON.PAIR_MISMATCH;
      }
    }
    return null;
  }

  /**
   * Confirm each Word picture's shape against its registry image (WCX-2). A
   * slot with no known shape, or a drawing with no wp:extent, is not checked.
   * Call only after confirmPairs, so the two lists are the same length.
   * @param {Array<number|null>|null} shapes
   * @param {Array<{text:string}>} drawings
   * @returns {string|null} a reason, or null
   */
  function confirmShapes(shapes, drawings) {
    if (!Array.isArray(shapes)) return null;
    for (let i = 0; i < drawings.length; i++) {
      const want = shapes[i];
      if (typeof want !== "number" || !(want > 0)) continue;
      const ext = EXTENT_RE.exec(drawings[i].text);
      if (!ext || !(+ext[2] > 0)) continue;
      const got = +ext[1] / +ext[2];
      if (Math.abs(got / want - 1) > SHAPE_TOLERANCE) {
        logWarn(
          `confirmShapes: picture ${i + 1} of ${drawings.length} has width over height ${got.toFixed(4)} in the file but ${want.toFixed(4)} in the registry`,
        );
        return REASON.SHAPE_MISMATCH;
      }
    }
    return null;
  }

  function outcome(blob, fields) {
    return {
      blob,
      applied: false,
      changed: 0,
      pictures: 0,
      expected: 0,
      failed: false,
      reason: REASON.NOTHING_OWED,
      ...fields,
    };
  }

  // =========================================================================
  // Word
  // =========================================================================

  function readAttr(tag, name) {
    const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
    return m ? m[1] : null;
  }

  /** Set (or add) one attribute on one opening tag, leaving the rest as is. */
  function withAttr(tag, name, value) {
    const encoded = encodeAttribute(value);
    const existing = new RegExp(`(\\s${name}=")[^"]*(")`);
    if (existing.test(tag)) return tag.replace(existing, `$1${encoded}$2`);
    return tag.replace(/(\/?>)$/, ` ${name}="${encoded}"$1`);
  }

  /**
   * Add Word's decorative mark to one picture drawing's wp:docPr. Keeps any
   * other extension already there, never adds it twice, and declares the a:
   * prefix on the list only when the document root does not. Pure.
   * @param {string} drawing - one w:drawing element
   * @param {boolean} rootDeclaresA
   * @returns {string}
   */
  function addDecorativeMark(drawing, rootDeclaresA) {
    return drawing.replace(DOC_PR_BLOCK_RE, (whole, attrs, tail, inner) => {
      if (whole.includes(DECORATIVE_URI)) return whole;
      if (typeof inner === "string" && /<\/a:extLst>/.test(inner)) {
        return whole.replace(/<\/a:extLst>/, `${DECORATIVE_EXT}</a:extLst>`);
      }
      const ns = rootDeclaresA ? "" : ` xmlns:a="${DRAWINGML_NS}"`;
      const list = `<a:extLst${ns}>${DECORATIVE_EXT}</a:extLst>`;
      const open = `<wp:docPr${attrs}>`;
      return `${open}${typeof inner === "string" ? inner : ""}${list}</wp:docPr>`;
    });
  }

  /**
   * Set descr on every picture drawing, in body order. Pure.
   * @param {string} documentXml
   * @param {Array<string|null|Object>} expected
   * @param {boolean[]|null} [decorative] - parallel to expected; true adds
   *   Word's decorative mark to that picture only (DW-2)
   * @param {Array<number|null>|null} [shapes] - parallel to expected; each
   *   known width over height must match the drawing's wp:extent (WCX-2)
   * @returns {{documentXml:string, changed:number, pictures:number, reason:string|null}}
   *   reason is null on success; documentXml is the INPUT on any reason.
   */
  function setDocumentXmlAlts(documentXml, expected, decorative = null, shapes = null) {
    const drawings = [];
    for (const m of documentXml.matchAll(DRAWING_RE)) {
      if (m[0].includes("<pic:pic")) {
        drawings.push({ start: m.index, text: m[0] });
      }
    }

    const found = drawings.map((d) => {
      const docPr = DOC_PR_RE.exec(d.text);
      return decodeEntities((docPr && readAttr(docPr[0], "descr")) || "");
    });
    const reason = confirmPairs(expected, found) || confirmShapes(shapes, drawings);
    if (reason) {
      return { documentXml, changed: 0, pictures: drawings.length, reason };
    }

    const rootTag = /<w:document\b[^>]*>/.exec(documentXml);
    const rootDeclaresA = !!rootTag && /\sxmlns:a="/.test(rootTag[0]);
    let changed = 0;
    let out = "";
    let cursor = 0;
    drawings.forEach((d, i) => {
      const want = expected[i];
      out += documentXml.slice(cursor, d.start);
      cursor = d.start + d.text.length;
      if (want === KEEP) {
        out += d.text;
        return;
      }
      let text = d.text;
      const update = (re) => {
        text = text.replace(re, (tag) => {
          const next = withAttr(tag, "descr", want);
          // A title the converter set is the same text, so it follows.
          return readAttr(next, "title") === null
            ? next
            : withAttr(next, "title", want);
        });
      };
      update(DOC_PR_RE);
      update(C_NV_PR_RE);
      if (Array.isArray(decorative) && decorative[i] === true) {
        text = addDecorativeMark(text, rootDeclaresA);
      }
      if (text !== d.text) changed++;
      out += text;
    });
    out += documentXml.slice(cursor);
    return { documentXml: out, changed, pictures: drawings.length, reason: null };
  }

  /**
   * Set every picture's alt text in a Convert API docx from the registry.
   * Resolves the INPUT blob object whenever nothing changed or anything fails;
   * never rejects.
   * @param {Blob} blob - the docx after the heading pass
   * @param {Array<string|null|Object>|null} expected - from expectedAltsFromMMD
   * @param {boolean[]|null} [decorative] - from expectedAltsFromMMD; marks those pictures decorative
   * @param {Array<number|null>|null} [shapes] - from expectedAltsFromMMD; the shape check (WCX-2)
   * @returns {Promise<{blob:Blob, applied:boolean, changed:number, pictures:number, expected:number, failed:boolean, reason:string}>}
   */
  async function setDocxAltText(blob, expected, decorative = null, shapes = null) {
    if (!Array.isArray(expected) || expected.length === 0) {
      return outcome(blob, { reason: REASON.NOTHING_OWED });
    }
    const base = { expected: expected.length };
    try {
      if (typeof window.JSZip !== "function") {
        logWarn("setDocxAltText: JSZip not loaded, original kept");
        return outcome(blob, { ...base, failed: true, reason: REASON.UNAVAILABLE });
      }
      const zip = await window.JSZip.loadAsync(blob);
      const docEntry = zip.file("word/document.xml");
      if (!docEntry) {
        return outcome(blob, { ...base, failed: true, reason: REASON.UNAVAILABLE });
      }

      const result = setDocumentXmlAlts(
        await docEntry.async("string"),
        expected,
        decorative,
        shapes,
      );
      if (result.reason) {
        logWarn(`setDocxAltText: ${result.reason}, original kept`);
        return outcome(blob, {
          ...base,
          pictures: result.pictures,
          failed: true,
          reason: result.reason,
        });
      }
      if (result.changed === 0) {
        return outcome(blob, {
          ...base,
          applied: true,
          pictures: result.pictures,
          reason: REASON.APPLIED,
        });
      }

      zip.file("word/document.xml", result.documentXml, { compression: "DEFLATE" });
      const newBlob = await zip.generateAsync({ type: "blob", mimeType: DOCX_MIME });
      logInfo(`setDocxAltText: ${result.changed} picture(s) set`);
      return outcome(newBlob, {
        ...base,
        applied: true,
        changed: result.changed,
        pictures: result.pictures,
        reason: REASON.APPLIED,
      });
    } catch (err) {
      logError("setDocxAltText: failed, original kept", err);
      return outcome(blob, { ...base, failed: true, reason: REASON.ERROR });
    }
  }

  // =========================================================================
  // Converter HTML
  // =========================================================================

  /**
   * Set alt on every img, in document order. Pure; same rule as the Word pass.
   * @param {string} html
   * @param {Array<string|null|Object>} expected
   * @returns {{html:string, changed:number, pictures:number, reason:string|null}}
   */
  function setHtmlAlts(html, expected) {
    const tags = [...html.matchAll(IMG_TAG_RE)];
    const found = tags.map((m) => decodeEntities(readAttr(m[0], "alt") || ""));
    const reason = confirmPairs(expected, found);
    if (reason) return { html, changed: 0, pictures: tags.length, reason };

    let changed = 0;
    let i = 0;
    const out = html.replace(IMG_TAG_RE, (tag) => {
      const want = expected[i++];
      if (want === KEEP) return tag;
      const next = withAttr(tag, "alt", want);
      if (next !== tag) changed++;
      return next;
    });
    return { html: out, changed, pictures: tags.length, reason: null };
  }

  /**
   * Set every img alt in the converter's HTML from the registry. Resolves the
   * INPUT blob object whenever nothing changed or anything fails; never rejects.
   * @param {Blob} blob - the html from the Convert API
   * @param {Array<string|null|Object>|null} expected
   * @returns {Promise<{blob:Blob, applied:boolean, changed:number, pictures:number, expected:number, failed:boolean, reason:string}>}
   */
  async function setHtmlAltText(blob, expected) {
    if (!Array.isArray(expected) || expected.length === 0) {
      return outcome(blob, { reason: REASON.NOTHING_OWED });
    }
    const base = { expected: expected.length };
    try {
      const result = setHtmlAlts(await blob.text(), expected);
      if (result.reason) {
        logWarn(`setHtmlAltText: ${result.reason}, original kept`);
        return outcome(blob, {
          ...base,
          pictures: result.pictures,
          failed: true,
          reason: result.reason,
        });
      }
      if (result.changed === 0) {
        return outcome(blob, {
          ...base,
          applied: true,
          pictures: result.pictures,
          reason: REASON.APPLIED,
        });
      }
      logDebug(`setHtmlAltText: ${result.changed} picture(s) set`);
      return outcome(new Blob([result.html], { type: blob.type }), {
        ...base,
        applied: true,
        changed: result.changed,
        pictures: result.pictures,
        reason: REASON.APPLIED,
      });
    } catch (err) {
      logError("setHtmlAltText: failed, original kept", err);
      return outcome(blob, { ...base, failed: true, reason: REASON.ERROR });
    }
  }

  window.MathPixDocxAltText = Object.freeze({
    KEEP,
    REASON,
    normaliseAlt,
    expectedAltsFromMMD,
    setDocumentXmlAlts,
    setDocxAltText,
    setHtmlAlts,
    setHtmlAltText,
  });
})();
