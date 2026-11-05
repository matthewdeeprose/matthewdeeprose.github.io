/**
 * OpenRouter Embed API - Document Reader (core)
 *
 * Turns a PDF, text, Word, Excel or PowerPoint file into text (plus, from P3,
 * pictures) in the browser. Only what it extracts is meant to be sent; the
 * original file never leaves the device. No Chat dependency.
 *
 * Parcel P1a: this file, `documents/embed-doc-pdf.js` and
 * `documents/embed-doc-text.js` are ADOPTED NOWHERE. No page loads them yet.
 *
 * ----------------------------------------------------------------------------
 * FORMAT MODULE CONTRACT (P2 builds against this)
 * ----------------------------------------------------------------------------
 * Every format is registered below in FORMAT_REGISTRY with a module path that
 * is resolved RELATIVE TO THIS SCRIPT'S OWN URL (captured from
 * document.currentScript.src at load), never against the page. A module whose
 * file does not exist yet makes read() reject with
 * { code: "unsupported-format", docType }, so a new format only ever adds files.
 *
 * A module is a plain script that registers itself when it loads:
 *
 *   window.EmbedDocumentFormats = window.EmbedDocumentFormats || {};
 *   window.EmbedDocumentFormats[docType] = {
 *     read(file, ctx) -> Promise<{ text, images: [], meta }>
 *   };
 *
 * ctx provides:
 *   caps                  the frozen CAPS object
 *   loadScript(url)       one cached promise per URL (library loader)
 *   pictureStep(items, options)
 *                         P3a: items is [{ blob, drawn: {w, h} | null, alt }] in
 *                         document order. Resolves { images, decisions, summary }:
 *                         images [{ number, dataUrl, width, height }] (WebP, through
 *                         Image Describer's EmbedFileUtils.compressImage), decisions
 *                         [{ number, outcome, repeatOf, alsoAs }] aligned with items
 *                         (outcome is one of kept, repeat, small, unsupported,
 *                         overCap) and summary { found, kept, repeats, small,
 *                         unsupported, overCap }.
 *                         P4: options.profile is "pictures" (the default: Word and
 *                         PowerPoint pictures, 1200 x 900, quality 0.7) or "page"
 *                         (PDF page pictures, 1568 x 1568, quality 0.7). A page
 *                         picture is never judged small or a repeat, and its image
 *                         carries kind: "page" so toParts labels it "Page n:". With
 *                         no window.EmbedFileUtils the step keeps nothing and
 *                         counts every item as unsupported.
 *   convertPicture(blob, profile)
 *                         P4: the same converter for one picture. profile is
 *                         "pictures", "page" or "preview" (200 px tall). Resolves
 *                         { dataUrl, width, height }, or null on any failure.
 *   pictureMarker(decision, alt)
 *                         the marker text for one picture, e.g. "[Image 2: a cat]".
 *                         The module writes it into its own text; the core never
 *                         sees the document text.
 *   log(message, counts)  sizes and counts only; non-numeric values are dropped
 *
 * A module that handles pictures also returns pictureSummary (the step's summary)
 * at the top level of its result; the core turns it into meta.pictureSummary and
 * meta.skippedPictures (small + unsupported + overCap).
 *
 * A module rejects with an Error carrying { code, docType }. Codes in use:
 * "unreadable" (encrypted or broken), "too-large", "unsupported-format".
 * An error message must never contain document content.
 *
 * The core adds kind, docType, name and the shared meta fields, truncates
 * over-long text, and forces maths.detected = false for text formats.
 *
 * @version 1.0.0 (P1a)
 * @date 22 October 2026
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
      console.error(`[EmbedDocumentReader ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedDocumentReader WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedDocumentReader INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedDocumentReader DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  // Memory protection, not model limits. ASSUMED values chosen by the design
  // seat; P1b's refuseIfTooLong is the real limit against each model's context.
  const CAPS = Object.freeze({
    MAX_TEXT_CHARS: 1000000,
    MAX_PDF_PAGES: 500,
    MAX_TEXT_FILE_BYTES: 20 * 1024 * 1024,
    // Defined now for P2 and P3 to use.
    MAX_ZIP_UNCOMPRESSED_BYTES: 100 * 1024 * 1024,
    MAX_IMAGES: 20,
    MIN_IMAGE_PX: 64,
    MAX_SHEET_ROWS: 5000,
  });

  const SCRIPT_TIMEOUT_MS = 15000;
  const NUMBER_LOCALE = "en-GB";

  // One converter (parcel P4): Image Describer's EmbedFileUtils.compressImage, which always
  // resizes inside the box and re-encodes to WebP. Word and PowerPoint pictures use Image
  // Describer's own box; a PDF page is a full page of small print, so it gets a larger one
  // (ASSUMED: a common vision-model input limit; bytes per page are reported, not tuned here).
  // The preview is the small first-page picture Chat shows, never sent.
  const PICTURE_PROFILES = Object.freeze({
    pictures: Object.freeze({ maxWidth: 1200, maxHeight: 900, quality: 0.7 }),
    page: Object.freeze({ maxWidth: 1568, maxHeight: 1568, quality: 0.7 }),
    preview: Object.freeze({ maxWidth: 600, maxHeight: 400, quality: 0.7 }),
  });
  const PROFILE_NAMES = Object.freeze({ PICTURES: "pictures", PAGE: "page", PREVIEW: "preview" });
  const PICTURE_KIND_PAGE = "page";
  // The offer's thumbnail (parcel P17b): a PNG no taller than this, never sent to a model.
  const THUMBNAIL_HEIGHT_PX = 160;
  const THUMBNAIL_TYPE = "image/png";
  // compressImage reads file.name; the real name of an embedded picture means nothing.
  const PICTURE_FILE_NAME = "picture";
  const HASH_ALGORITHM = "SHA-256";

  const PICTURE_OUTCOMES = Object.freeze({
    KEPT: "kept",
    REPEAT: "repeat",
    SMALL: "small",
    UNSUPPORTED: "unsupported",
    OVER_CAP: "overCap",
  });

  const SKIP_REASONS = Object.freeze({
    [PICTURE_OUTCOMES.SMALL]: "small picture",
    [PICTURE_OUTCOMES.UNSUPPORTED]: "picture format not supported",
    [PICTURE_OUTCOMES.OVER_CAP]: `over the ${CAPS.MAX_IMAGES}-picture limit`,
  });

  const DOC_TYPES = Object.freeze({
    PDF: "pdf",
    TEXT: "text",
    DOCX: "docx",
    XLSX: "xlsx",
    PPTX: "pptx",
  });

  const ERROR_CODES = Object.freeze({
    UNSUPPORTED: "unsupported-format",
    UNREADABLE: "unreadable",
  });

  // Module paths are relative to THIS script's URL (see resolveModuleUrl).
  const FORMAT_REGISTRY = Object.freeze({
    [DOC_TYPES.PDF]: Object.freeze({ path: "documents/embed-doc-pdf.js" }),
    [DOC_TYPES.TEXT]: Object.freeze({ path: "documents/embed-doc-text.js" }),
    [DOC_TYPES.DOCX]: Object.freeze({ path: "documents/embed-doc-docx.js" }),
    [DOC_TYPES.XLSX]: Object.freeze({ path: "documents/embed-doc-xlsx.js" }),
    [DOC_TYPES.PPTX]: Object.freeze({ path: "documents/embed-doc-pptx.js" }),
  });

  const EXTENSION_TYPES = Object.freeze({
    pdf: DOC_TYPES.PDF,
    txt: DOC_TYPES.TEXT,
    md: DOC_TYPES.TEXT,
    tex: DOC_TYPES.TEXT,
    mmd: DOC_TYPES.TEXT,
    docx: DOC_TYPES.DOCX,
    xlsx: DOC_TYPES.XLSX,
    pptx: DOC_TYPES.PPTX,
  });

  const LEGACY_EXTENSIONS = Object.freeze(["doc", "xls", "ppt"]);

  const MIME_TYPES = Object.freeze({
    "application/pdf": DOC_TYPES.PDF,
    "text/plain": DOC_TYPES.TEXT,
    "text/markdown": DOC_TYPES.TEXT,
    "application/x-tex": DOC_TYPES.TEXT,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      DOC_TYPES.DOCX,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      DOC_TYPES.XLSX,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      DOC_TYPES.PPTX,
  });

  const LEGACY_MIME_TYPES = Object.freeze([
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
  ]);

  const LEGACY_REASON = "legacy-office";

  // ============================================================================
  // SCRIPT BASE (for module path resolution)
  // ============================================================================

  // Captured at load. document.currentScript is null once the script has run,
  // so this must be read here and not inside a function called later.
  const SCRIPT_BASE = (function () {
    const current = document.currentScript;
    if (current && current.src) return current.src;
    logWarn("document.currentScript unavailable; falling back to the page base");
    return new URL("openrouter-embed/openrouter-embed-documents.js", document.baseURI)
      .href;
  })();

  // ============================================================================
  // HELPERS
  // ============================================================================

  /** Typed error. The message is the code only: it never carries content. */
  function fail(code, docType, extra) {
    const error = new Error(code);
    error.code = code;
    error.docType = docType;
    if (extra) Object.assign(error, extra);
    return error;
  }

  /** Counts and booleans only: anything else is dropped before it can be logged. */
  function logCounts(message, counts) {
    const safe = {};
    if (counts && typeof counts === "object") {
      for (const key of Object.keys(counts)) {
        const value = counts[key];
        if (typeof value === "number" || typeof value === "boolean") {
          safe[key] = value;
        }
      }
    }
    logDebug(message, safe);
  }

  const scriptPromises = new Map();

  /**
   * Loads a script once. One promise is cached per URL, so a second caller
   * waits for the first load instead of resolving at once (the existing-tag
   * shortcut in pdf-visualiser-renderer.js resolves even while still loading).
   * A failed load is not cached, so a later call can retry.
   * @param {string} url
   * @param {number} [timeout]
   * @returns {Promise<void>}
   */
  function loadScript(url, timeout = SCRIPT_TIMEOUT_MS) {
    if (scriptPromises.has(url)) return scriptPromises.get(url);

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = true;

      const timeoutId = setTimeout(() => {
        reject(new Error("Script load timeout"));
      }, timeout);

      script.onload = () => {
        clearTimeout(timeoutId);
        resolve();
      };

      script.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error("Script load failed"));
      };

      document.head.appendChild(script);
    });

    scriptPromises.set(url, promise);
    promise.catch(() => scriptPromises.delete(url));
    return promise;
  }

  function resolveModuleUrl(docType) {
    const entry = FORMAT_REGISTRY[docType];
    if (!entry) return null;
    return new URL(entry.path, SCRIPT_BASE).href;
  }

  async function loadFormat(docType) {
    window.EmbedDocumentFormats = window.EmbedDocumentFormats || {};
    const formats = window.EmbedDocumentFormats;
    if (formats[docType]) return formats[docType];

    const url = resolveModuleUrl(docType);
    if (!url) throw fail(ERROR_CODES.UNSUPPORTED, docType);

    try {
      await loadScript(url);
    } catch (error) {
      logCounts("Format module not available", { found: false });
      throw fail(ERROR_CODES.UNSUPPORTED, docType);
    }

    const loaded = formats[docType];
    if (!loaded || typeof loaded.read !== "function") {
      throw fail(ERROR_CODES.UNSUPPORTED, docType);
    }
    return loaded;
  }

  function escapeAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function neutraliseWrapper(text) {
    return String(text).replace(/<\/\s*document\s*>/gi, "</ document>");
  }

  function noMaths() {
    return { detected: false, score: 0, signals: [] };
  }

  // ============================================================================
  // PICTURES (P3a)
  // ============================================================================

  /** A picture is small when its larger side is at most CAPS.MIN_IMAGE_PX. */
  function isSmallPicture(width, height) {
    return Math.max(width, height) <= CAPS.MIN_IMAGE_PX;
  }

  /** SHA-256 of the bytes as hex, or null where Web Crypto is unavailable (no repeat is then found). */
  async function hashBlob(blob) {
    if (!(window.crypto && window.crypto.subtle)) return null;
    const digest = await window.crypto.subtle.digest(HASH_ALGORITHM, await blob.arrayBuffer());
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  /** Decoded pixel size { w, h }, or null where the browser cannot decode the bytes. */
  async function decodedSize(blob) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob);
      return { w: bitmap.width, h: bitmap.height };
    } catch (error) {
      return null;
    } finally {
      if (bitmap) bitmap.close();
    }
  }

  function readAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(blob);
    });
  }

  let pictureConverter = null;

  function converterAvailable() {
    return typeof window.EmbedFileUtils === "function";
  }

  /**
   * Re-encodes one picture through Image Describer's converter (EmbedFileUtils.compressImage),
   * inside the named profile's box. Null on any failure or when the converter is missing.
   */
  async function convertPicture(blob, profileName) {
    const profile = PICTURE_PROFILES[profileName];
    if (!profile || !(blob instanceof Blob) || !converterAvailable()) return null;
    try {
      if (!pictureConverter) pictureConverter = new window.EmbedFileUtils();
      const picture = new File([blob], PICTURE_FILE_NAME, { type: blob.type });
      const result = await pictureConverter.compressImage(picture, profile);
      const { width, height } = result.dimensions.compressed;
      return { dataUrl: await readAsDataUrl(result.file), width, height };
    } catch (error) {
      return null;
    }
  }

  /**
   * Shrinks one picture to a small PNG for a thumbnail strip: decoded at THUMBNAIL_HEIGHT_PX tall
   * (P17a-3: shrinking first keeps the renderer's memory flat, where showing the full-size blob
   * does not), drawn to a canvas, encoded, and the bitmap closed. Null on any failure.
   */
  async function shrinkPicture(blob) {
    if (!(blob instanceof Blob) || typeof createImageBitmap !== "function") return null;
    let bitmap = null;
    try {
      bitmap = await createImageBitmap(blob, { resizeHeight: THUMBNAIL_HEIGHT_PX });
      const width = bitmap.width;
      const height = bitmap.height;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(bitmap, 0, 0);
      const png = await new Promise((resolve) => canvas.toBlob(resolve, THUMBNAIL_TYPE));
      canvas.width = 0;
      canvas.height = 0;
      return png ? { blob: png, width, height } : null;
    } catch (error) {
      return null;
    } finally {
      if (bitmap) bitmap.close();
    }
  }

  /**
   * The offer a document carries when read with { offerAll: true } (parcel P17b).
   * @typedef {Object} PictureOffer
   * @property {number[]} numbers The picture (or page) numbers that can be chosen, in document order.
   * @property {number} count numbers.length.
   * @property {(number: number) => Promise<{blob: Blob, width: number, height: number}|null>} thumbnail
   *   A PNG at most 160 px tall for one numbered picture or page. Nothing is cached.
   * @property {(number: number) => Promise<{number: number, dataUrl: string, width: number,
   *   height: number, kind?: string}|null>} encode One picture exactly as a doc.images entry
   *   (same converter, same profile; kind "page" for a PDF page).
   * @property {() => Promise<void>} release Drops every held blob and destroys a PDF. After it,
   *   thumbnail and encode resolve null.
   * Every method resolves null instead of throwing, for a number not on the list too.
   */

  /**
   * Wraps the three behaviours with the offer's guards: only a listed number is served, a released
   * offer serves nothing, and nothing throws.
   */
  function createOffer({ numbers, makeThumbnail, makeEncode, onRelease }) {
    const listed = Array.isArray(numbers) ? numbers.slice() : [];
    const allowed = new Set(listed);
    let released = false;

    const guarded = (make) => async (number) => {
      if (released || !allowed.has(number)) return null;
      try {
        const result = await make(number);
        return released ? null : result || null;
      } catch (error) {
        return null;
      }
    };

    return Object.freeze({
      numbers: Object.freeze(listed),
      count: listed.length,
      thumbnail: guarded(makeThumbnail),
      encode: guarded(makeEncode),
      async release() {
        if (released) return;
        released = true;
        try {
          await onRelease();
        } catch (error) {
          /* releasing memory is best-effort */
        }
      },
    });
  }

  /** The offer for a Word or PowerPoint file, from the picture step run with offerAll. */
  function createPictureOffer(step) {
    const decisions = step && Array.isArray(step.decisions) ? step.decisions : [];
    const held = step && step.held instanceof Map ? step.held : new Map();
    const numbers = decisions
      .filter((d) => d.outcome === PICTURE_OUTCOMES.KEPT || d.outcome === PICTURE_OUTCOMES.OVER_CAP)
      .map((d) => d.number);

    return createOffer({
      numbers,
      makeThumbnail: (number) => shrinkPicture(held.get(number)),
      makeEncode: async (number) => {
        const encoded = await convertPicture(held.get(number), PROFILE_NAMES.PICTURES);
        if (!encoded) return null;
        return { number, dataUrl: encoded.dataUrl, width: encoded.width, height: encoded.height };
      },
      onRelease: () => held.clear(),
    });
  }

  function summariseDecisions(decisions) {
    const count = (outcome) => decisions.filter((d) => d.outcome === outcome).length;
    return {
      found: decisions.length,
      kept: count(PICTURE_OUTCOMES.KEPT),
      repeats: count(PICTURE_OUTCOMES.REPEAT),
      small: count(PICTURE_OUTCOMES.SMALL),
      unsupported: count(PICTURE_OUTCOMES.UNSUPPORTED),
      overCap: count(PICTURE_OUTCOMES.OVER_CAP),
    };
  }

  /**
   * Decides what happens to each picture, in document order: cannot decode (unsupported), small
   * (drawn size, else decoded size), a repeat of an earlier KEPT picture (same bytes; a copy of
   * one that went over the cap or failed to encode is judged on its own), over the cap of sent
   * pictures, else kept and re-encoded. With options.profile "page" (a PDF's pages) a picture is
   * never a repeat, because each page is sent under its own page number. With no converter nothing
   * is kept and every item counts as unsupported.
   * @param {Array<{blob: Blob, drawn: ({w: number, h: number}|null), alt: string}>} items
   * @param {{profile?: string}} [options]
   * @returns {Promise<{images: Array, decisions: Array, summary: Object}>}
   */
  async function runPictureStep(items, options) {
    const list = Array.isArray(items) ? items : [];
    const isPages = !!options && options.profile === PROFILE_NAMES.PAGE;
    // offerAll (P17b): an over-cap picture can still be chosen, so it is treated as offered.
    const offerAll = !!options && options.offerAll === true;
    const profileName = isPages ? PROFILE_NAMES.PAGE : PROFILE_NAMES.PICTURES;
    const decisions = [];
    const images = [];
    const decodedByHash = new Map();
    const firstByHash = new Map();
    let keptCount = 0;

    if (!converterAvailable()) {
      for (let index = 0; index < list.length; index++) {
        decisions.push({ number: index + 1, outcome: PICTURE_OUTCOMES.UNSUPPORTED, repeatOf: null, alsoAs: [] });
      }
      const none = summariseDecisions(decisions);
      logWarn("EmbedFileUtils is unavailable: no pictures were kept", none);
      return { images, decisions, summary: none };
    }

    for (let index = 0; index < list.length; index++) {
      const number = index + 1;
      const item = list[index] || {};
      const decision = { number, outcome: PICTURE_OUTCOMES.UNSUPPORTED, repeatOf: null, alsoAs: [] };
      decisions.push(decision);
      if (!(item.blob instanceof Blob)) continue;

      const hash = isPages ? null : await hashBlob(item.blob);
      let decoded;
      if (hash !== null && decodedByHash.has(hash)) {
        decoded = decodedByHash.get(hash);
      } else {
        decoded = await decodedSize(item.blob);
        if (hash !== null) decodedByHash.set(hash, decoded);
      }
      if (!decoded) continue;

      const size = item.drawn || decoded;
      if (isSmallPicture(size.w, size.h)) {
        decision.outcome = PICTURE_OUTCOMES.SMALL;
        continue;
      }

      const earlier = hash === null ? undefined : firstByHash.get(hash);
      if (earlier !== undefined) {
        decision.outcome = PICTURE_OUTCOMES.REPEAT;
        decision.repeatOf = earlier;
        continue;
      }

      if (keptCount >= CAPS.MAX_IMAGES) {
        decision.outcome = PICTURE_OUTCOMES.OVER_CAP;
        // Offered, so a later copy of it is a repeat of it (without offerAll it is judged on its own).
        if (offerAll && hash !== null) firstByHash.set(hash, number);
        continue;
      }
      const encoded = await convertPicture(item.blob, profileName);
      if (!encoded) continue;

      // A picture is "first seen" only once it is KEPT, so a later copy of one that
      // went over the cap or failed to encode is judged on its own, not called a
      // repeat of a picture that was never sent.
      if (hash !== null) firstByHash.set(hash, number);
      keptCount++;
      decision.outcome = PICTURE_OUTCOMES.KEPT;
      const kept = { number, dataUrl: encoded.dataUrl, width: encoded.width, height: encoded.height };
      if (isPages) kept.kind = PICTURE_KIND_PAGE;
      images.push(kept);
    }

    // A kept picture lists the later pictures that are repeats of it.
    for (const decision of decisions) {
      if (decision.outcome !== PICTURE_OUTCOMES.REPEAT) continue;
      const original = decisions[decision.repeatOf - 1];
      const offered = original.outcome === PICTURE_OUTCOMES.KEPT || (offerAll && original.outcome === PICTURE_OUTCOMES.OVER_CAP);
      if (offered) original.alsoAs.push(decision.number);
    }

    const summary = summariseDecisions(decisions);
    logCounts("Pictures handled", summary);
    const result = { images, decisions, summary };
    // Source blobs of the offered pictures, for thumbnail and encode. A PDF's pages are drawn on
    // demand instead, so nothing is held for them.
    if (offerAll && !isPages) {
      result.held = new Map();
      for (const decision of decisions) {
        const offered = decision.outcome === PICTURE_OUTCOMES.KEPT || decision.outcome === PICTURE_OUTCOMES.OVER_CAP;
        if (offered) result.held.set(decision.number, list[decision.number - 1].blob);
      }
    }
    return result;
  }

  /** Alt text made safe for a marker: no ], no line breaks. (</document> is neutralised by toParts.) */
  function cleanAltText(alt) {
    return String(alt || "").replace(/\]/g, ")").replace(/[^\S ]+/g, " ").trim();
  }

  /** The marker text for one picture (see the contract at the top of this file). */
  function buildPictureMarker(decision, alt, offerAll) {
    const label = `Image ${decision.number}`;
    const text = cleanAltText(alt);
    const named = text === "" ? label : `${label}: ${text}`;

    if (decision.outcome === PICTURE_OUTCOMES.REPEAT) {
      return `[${label}: same picture as Image ${decision.repeatOf}]`;
    }
    // With offerAll an over-cap picture reads as a kept one, since it may be chosen.
    if (decision.outcome === PICTURE_OUTCOMES.KEPT || (offerAll === true && decision.outcome === PICTURE_OUTCOMES.OVER_CAP)) {
      const also = decision.alsoAs.length ? `; also appears as Image ${decision.alsoAs.join(", ")}` : "";
      return `[${named}${also}]`;
    }
    return `[${named}; not included, ${SKIP_REASONS[decision.outcome]}]`;
  }

  /**
   * The `Image n` numbers a message sends: the picture parts toParts is about to label "Image n".
   * Page pictures (a PDF's pages) are not Image markers and do not count. Null when no such part
   * goes, so a message that sends no picture keeps the text byte-for-byte as it was (P17d).
   */
  function sentPictureNumbers(doc) {
    if (!Array.isArray(doc.images)) return null;
    const sent = new Set();
    doc.images.forEach((image, index) => {
      if (!(image && image.dataUrl) || image.kind === PICTURE_KIND_PAGE) return;
      sent.add(Number.isFinite(image.number) ? image.number : index + 1);
    });
    return sent.size > 0 ? sent : null;
  }

  /**
   * Adds "; not sent" to the marker of every OFFERED picture the message does not send (P17d). It
   * reads the markers themselves, so it works on a stored and restored document. A marker is
   * `[Image n` up to the first `]`: alt text is cleaned of `]` and line breaks, so what sits between
   * is the alt text and the "also appears as" list, which are kept as they are. A repeat marker
   * (`: same picture as Image m`) and a skipped one (`; not included, <reason>`) are left alone.
   * Alt text that happens to read exactly like either of those cannot be told apart from the text
   * alone; it is left unmarked, which is what the model got before this parcel.
   */
  const SKIPPED_MARKER_ENDINGS = Object.freeze(Object.values(SKIP_REASONS).map((reason) => `; not included, ${reason}`));
  const PICTURE_MARKER_PATTERN = /\[Image (\d+)([^\]]*)\]/g;
  const REPEAT_MARKER_REST = /^: same picture as Image \d+$/;
  const NOT_SENT_SUFFIX = "; not sent";

  function markUnsentPictures(text, sentNumbers) {
    return String(text).replace(PICTURE_MARKER_PATTERN, (marker, digits, rest) => {
      if (sentNumbers.has(Number(digits))) return marker;
      if (REPEAT_MARKER_REST.test(rest)) return marker;
      if (SKIPPED_MARKER_ENDINGS.some((ending) => rest.endsWith(ending))) return marker;
      return `[Image ${digits}${rest}${NOT_SENT_SUFFIX}]`;
    });
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Classifies a file by extension, with the MIME type as fallback.
   * @param {File|{name?: string, type?: string}} file
   * @returns {string|{unsupported: true, reason: string}|null}
   *   "pdf" | "text" | "docx" | "xlsx" | "pptx", an unsupported marker for the
   *   legacy .doc/.xls/.ppt formats, or null for anything else.
   */
  function detect(file) {
    if (!file) return null;
    const name = String(file.name || "").toLowerCase();
    const dot = name.lastIndexOf(".");
    const extension = dot >= 0 ? name.slice(dot + 1) : "";

    if (Object.prototype.hasOwnProperty.call(EXTENSION_TYPES, extension)) {
      return EXTENSION_TYPES[extension];
    }
    if (LEGACY_EXTENSIONS.includes(extension)) {
      return { unsupported: true, reason: LEGACY_REASON };
    }

    const mime = String(file.type || "").toLowerCase();
    if (Object.prototype.hasOwnProperty.call(MIME_TYPES, mime)) {
      return MIME_TYPES[mime];
    }
    if (LEGACY_MIME_TYPES.includes(mime)) {
      return { unsupported: true, reason: LEGACY_REASON };
    }
    return null;
  }

  /**
   * Reads a file into text.
   * @param {File} file
   * @param {{offerAll?: boolean}} [options] offerAll (parcel P17b, opt-in): the result also carries
   *   `offer` (a PictureOffer), every picture can be chosen and not only the first 20, and an
   *   over-cap picture's marker reads as a kept one. A PDF is then kept open until
   *   offer.release(). Without it every byte of the result is as before.
   * @returns {Promise<{kind: "document", docType: string, name: string,
   *   text: string, images: Array, meta: Object, offer?: PictureOffer}>}
   * @throws {Error} with { code, docType }: "unsupported-format" (also for a
   *   format whose module file does not exist yet), "unreadable" or "too-large".
   */
  async function read(file, options) {
    const docType = detect(file);
    if (docType === null) throw fail(ERROR_CODES.UNSUPPORTED, null);
    if (typeof docType === "object") {
      throw fail(ERROR_CODES.UNSUPPORTED, null, { reason: docType.reason });
    }

    const format = await loadFormat(docType);
    const ctx = {
      caps: CAPS,
      loadScript,
      pictureStep: runPictureStep,
      convertPicture,
      pictureMarker: buildPictureMarker,
      log: (message, counts) => logCounts(message, counts),
    };

    // offerAll (P17b): the picture step and the markers learn the option, and the format module
    // is told (a PDF module keeps its document open and builds its own offer from createOffer).
    const offerAll = !!options && options.offerAll === true;
    let offeredStep = null;
    if (offerAll) {
      ctx.offerAll = true;
      ctx.createOffer = createOffer;
      ctx.pictureStep = async (items, stepOptions) => {
        offeredStep = await runPictureStep(items, Object.assign({}, stepOptions, { offerAll: true }));
        return offeredStep;
      };
      ctx.pictureMarker = (decision, alt) => buildPictureMarker(decision, alt, true);
    }

    let raw;
    try {
      raw = await format.read(file, ctx);
    } catch (error) {
      if (error && error.code) {
        if (!error.docType) error.docType = docType;
        throw error;
      }
      throw fail(ERROR_CODES.UNREADABLE, docType);
    }

    let text = String((raw && raw.text) || "");
    const meta = Object.assign(
      {
        bytes: file.size,
        hiddenCount: 0,
        skippedPictures: 0,
        emptyPages: 0,
        maths: noMaths(),
        truncated: null,
      },
      raw && raw.meta,
    );

    // Text formats always report no maths: an .mmd is MathPix's own output.
    if (docType === DOC_TYPES.TEXT) meta.maths = noMaths();

    // A module that handled pictures reports the step's summary; the core derives the rest.
    const picked = raw && raw.pictureSummary;
    if (picked) {
      meta.pictureSummary = {
        found: picked.found,
        kept: picked.kept,
        repeats: picked.repeats,
        small: picked.small,
        unsupported: picked.unsupported,
        overCap: picked.overCap,
      };
      meta.skippedPictures = picked.small + picked.unsupported + picked.overCap;
    }

    if (text.length > CAPS.MAX_TEXT_CHARS) {
      const total = text.length;
      let kept = CAPS.MAX_TEXT_CHARS;
      // Never end on half of a surrogate pair.
      const last = text.charCodeAt(kept - 1);
      if (last >= 0xd800 && last <= 0xdbff) kept -= 1;
      const keptLabel = CAPS.MAX_TEXT_CHARS.toLocaleString(NUMBER_LOCALE);
      const totalLabel = total.toLocaleString(NUMBER_LOCALE);
      text =
        text.slice(0, kept) +
        `\n[Document cut short: the first ${keptLabel} characters of ${totalLabel} are included.]`;
      meta.truncated = { kept, total };
    }

    logCounts("Document read", {
      bytes: file.size,
      chars: text.length,
      truncated: meta.truncated !== null,
    });

    const doc = {
      kind: "document",
      docType,
      name: String(file.name || ""),
      text,
      images: Array.isArray(raw && raw.images) ? raw.images : [],
      meta,
    };
    if (offerAll) {
      // A PDF module builds its own (it holds the open document); Word and PowerPoint use the
      // step's held blobs; every other format has nothing to offer.
      doc.offer = (raw && raw.offer) || createPictureOffer(offeredStep);
    }
    return doc;
  }

  /**
   * Builds message parts from a document.
   * @param {Object} doc A document returned by read().
   * @param {{includeImages: boolean, vision: boolean}} options Image parts are
   *   returned only when BOTH are true.
   * @returns {Array<{type: string}>} One text part, plus image parts.
   */
  function toParts(doc, options) {
    const { includeImages, vision } = options || {};
    const name = escapeAttribute(doc.name);
    const type = escapeAttribute(doc.docType);
    // P17d: when this message sends pictures, the offered ones it leaves out are marked "not sent".
    const sentNumbers = vision && includeImages ? sentPictureNumbers(doc) : null;
    const body = neutraliseWrapper(sentNumbers ? markUnsentPictures(doc.text, sentNumbers) : doc.text);
    const parts = [
      {
        type: "text",
        text: `<document name="${name}" type="${type}">${body}</document>`,
      },
    ];

    if (vision && includeImages && Array.isArray(doc.images)) {
      doc.images.forEach((image, index) => {
        if (!(image && image.dataUrl)) return;
        // The label lets the model match a picture to its [Image n] marker in the text, or a
        // PDF page picture to the "--- Page n ---" header.
        const number = Number.isFinite(image.number) ? image.number : index + 1;
        const label = image.kind === PICTURE_KIND_PAGE ? "Page" : "Image";
        parts.push({ type: "text", text: `${label} ${number}:` });
        parts.push({ type: "image_url", image_url: { url: image.dataUrl } });
      });
    }
    return parts;
  }

  window.EmbedDocumentFormats = window.EmbedDocumentFormats || {};

  window.EmbedDocumentReader = Object.freeze({
    detect,
    read,
    toParts,
    CAPS,
    formats: Object.freeze(Object.keys(FORMAT_REGISTRY)),
  });

  logInfo("Document reader loaded");
})();
