/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CHAT ATTACH — Unified Chat attachments (typed: image + PDF)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Owns the ONE in-memory selected attachment for the Unified Chat tool:
 * the picked File plus its base64 bytes, held only until the turn is sent (chat-
 * core.js clears it after pushing the turn). The session NEVER stores the bytes —
 * persistence (chat-persistence.js) serialises the byte-free reference from
 * buildReference() instead.
 *
 * Drives window.ChatState ONLY (announcements, element-id prefix). It never
 * touches any window.LocalChat* global. Loads AFTER chat/chat.js so
 * window.ChatState, window.Chat and the element-id prefix exist.
 *
 * Public API (window.ChatAttach):
 *   hasAttachment()            → boolean
 *   getAttachmentPart()        → image: { type:"image_url", image_url:{ url:"data:…" } }
 *                                pdf:   { type:"file", file:{ filename, file_data:"data:…" } } | null
 *                              document: { type:"document", doc, includeImages }  (a text/Office file, or a
 *                              readable PDF on a model that cannot read PDFs — decided at CALL time;
 *                              includeImages is true only while the "Include pictures" box is showing AND ticked)
 *   buildReference()           → { kind:"image"|"pdf", filename, mimeType, size } | null  (byte-free)
 *                              or { kind:"document", docType, filename, mimeType, size, chars }
 *   refreshAdvice()            → void   (chat.js calls it on a model change: the free-model sentence)
 *   clearAttachment()          → void   (also resets the file input + preview)
 *   modelAcceptsImages(id)     → boolean (generic vision-capability gate — see below)
 *   modelAcceptsPDF(id)        → boolean (pdf token AND an "azure-openai/" OR "azure-responses/" id — see below)
 *   init()                     → void   (idempotent; wires the file input, drop target + paste)
 *
 * modelAcceptsImages is the SINGLE image-capability gate shared with the wire:
 * it resolves the unified entry via window.Chat.getModelEntry, then tests it for a
 * vision token through the selector's own checker
 * (window.EmbedModelSelector._modelHasCapabilities(entry, ["vision"])). There is
 * NO per-model and NO per-surface special-case — local models return false purely
 * through the absence of the token (they map to capabilities ["text"]), and every
 * vision-tokened model on every surface (OpenRouter, azure-openai, azure-responses
 * Codex/pro) returns true. See chat/attachments-checkpoint1-grounding-note.md.
 *
 * Architecture: IIFE with a window global. No NPM — loaded via a <script> tag.
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.ChatAttach = (function () {
  "use strict";

  // ── Logging (own sink; British spelling) ──────────────────────────────────
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[ChatAttach]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[ChatAttach]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[ChatAttach]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[ChatAttach]", message, ...args);
  }

  // ── State ──────────────────────────────────────────────────────────────────
  // The one selected attachment, or null. Shape:
  //   { file:File, base64:string, filename:string, mimeType:string, size:number,
  //     kind:"image"|"pdf" }
  let attachment = null;
  let _fileUtils = null; // lazily-constructed EmbedFileUtils instance
  let _wired = false; // idempotency guard for the input change listener
  let _dropWired = false; // idempotency guard for the drag-and-drop wiring
  let _dropCleanup = null; // teardown handle for the drop listeners (or null)
  let _pasteWired = false; // idempotency guard for the clipboard-paste wiring
  let _pasteCleanup = null; // teardown handle from bindClipboardPaste (or null)
  let _clickWired = false; // idempotency guard for the whole-box click-to-pick
  let _clickCleanup = null; // teardown handle for the box click listener (or null)
  let _mathPixWired = false; // idempotency guard for the Open MathPix button
  let _readToken = 0; // bumped per selection: a later file wins, an earlier result is dropped
  let _freeShown = false; // whether the free-model sentence is currently showing
  let _reading = false; // true while a document read is in flight
  let _boxWired = false; // idempotency guard for the pictures box's change listener
  let _stripFor = null; // the attachment the strip's items were built for (a different one rebuilds them)
  let _bodyObserver = null; // one ResizeObserver on the box body, refits the card on a width change only
  let _fitBodyWidth = 0; // the body width the card was last fitted at

  // ── Spoken and visible wording ──────────────────────────────────────────────
  // One announce() call per attach builds ONE string from these; the advice
  // paragraph shows the same sentences 2 and 3 without a second announcement.
  const KIND_LABELS = Object.freeze({
    pdf: "PDF",
    text: "Text file",
    document: "Document",
    docx: "Word document",
    xlsx: "Excel workbook",
    pptx: "PowerPoint presentation",
  });
  const ADVICE = Object.freeze({
    mathsPdf:
      "It looks like it contains maths. For a more accurate reading, convert it with the MathPix tool and attach the .mmd file it gives you.",
    mathsWord:
      "It looks like it contains maths. For a more accurate reading, save it as a PDF, convert that with the MathPix tool, and attach the .mmd file it gives you.",
    scan: "This looks like a scan. MathPix can read handwriting and maths.",
    free: "Free models may keep what you send.",
  });
  // The sentence in the attach line that names the pictures (spoken only while the
  // "Include pictures" box is showing). {n} is the number that would be sent and {total}
  // the pages in the PDF. The page variants (parcel P4) are for a PDF sent as page pictures.
  const PICTURES_SENTENCE = Object.freeze({
    one: "It has 1 picture. To send it, tick Include pictures.",
    many: "It has {n} pictures. To send them, tick Include pictures.",
    pageOne: "It has 1 page that can be sent as a picture. To send it, tick Include page pictures.",
    pageMany: "It has {n} pages that can be sent as pictures. To send them, tick Include page pictures.",
    pageCapped:
      "It has {total} pages. The first {n} can be sent as pictures. To send them, tick Include page pictures.",
  });
  // The visible label of the "Include pictures" box: "Include <count> <kind>", where the count is
  // what can be sent (parcel P7). The word "found" now lives only in the "How we read this file" rows.
  const PICTURES_LABEL = Object.freeze({
    pictures: Object.freeze({ one: "picture", many: "pictures" }),
    pages: Object.freeze({ one: "page picture", many: "page pictures" }),
  });
  // The strip of pictures that would be sent (parcel P7). Thumbnails are a canvas downscale made
  // once per attachment on the first tick, about 2.5 times the size they are shown at, held in
  // memory only and dropped with the attachment. The captions use the same words as the labels
  // the reader puts before each picture on the wire ("Page n:" / "Image n:").
  const THUMB_MAX_PX = 160;
  const THUMB_MIME = "image/jpeg";
  const THUMB_QUALITY = 0.75;
  const THUMB_BACKGROUND = "#ffffff"; // a transparent picture is flattened onto white, as a page is
  const PICTURE_KIND_PAGE = "page"; // the reader's kind for a PDF page picture
  const STRIP_CAPTIONS = Object.freeze({ page: "Page", image: "Image" });
  // The attachment card fills its row (parcel P7). The card's width follows the picture's own
  // shape at the height of the details column, up to half the box; the column and height are set
  // as custom properties on the box body (chat.css reads them).
  const WIDE_BOX_QUERY = "(min-width: 600px)";
  const CARD_MAX_SHARE = 0.5;
  const CARD_MIN_PX = 64;
  const CARD_DEFAULT_SHARE = 0.3;
  const CARD_FIT_MAX_PASSES = 5;
  const CARD_FIT_EPSILON_PX = 0.5;
  const TEXT_PAGE_ASPECT = 1 / 1.414; // matches .chat-attachment-textpage in chat.css
  const CARD_WIDTH_VAR = "--chat-card-w";
  const CARD_HEIGHT_VAR = "--chat-card-h";
  const DIMENSIONS_WORDS = Object.freeze({ times: " × ", unit: " px" });
  // The count shown beside the type in the attachment card: which reader meta field, and its words.
  // `label` is the small heading over the count on a wide box (parcel P4c).
  const COUNT_UNITS = Object.freeze({
    pdf: Object.freeze({ key: "pagesTotal", one: "page", many: "pages", label: "Pages" }),
    pptx: Object.freeze({ key: "slides", one: "slide", many: "slides", label: "Slides" }),
    xlsx: Object.freeze({ key: "sheets", one: "sheet", many: "sheets", label: "Sheets" }),
  });
  // The headings over the type and size facts (parcel P4c).
  const FACT_LABELS = Object.freeze({ type: "Type", size: "Size", dimensions: "Dimensions" });
  // "How we read this file" (parcel P4c): the disclosure's heading and the words of its rows.
  // Every value is built from a field the reader returns; a field it does not return gives no row.
  const MORE_WORDS = Object.freeze({
    summary: "How we read this file",
    textRead: "Text read",
    allOfIt: ", all of it",
    pagesRead: "Pages read",
    scan: "Looks like a scan",
    maths: "Maths",
    pagePictures: "Page pictures",
    pictures: "Pictures",
    charts: "Charts",
    slides: "Slides",
    hiddenSlides: "Hidden slides",
    sheets: "Sheets",
    hiddenSheets: "Hidden sheets",
    cutSheets: "Sheets cut short",
    yes: "Yes",
    no: "No",
    detected: "Detected",
    notDetected: "Not detected",
    noneFound: "None found",
  });
  // The en-GB thousands separator, as the reader's own cut-short notes use.
  const NUMBER_LOCALE = "en-GB";
  // The attachment card (parcel P4): a text file's "page" holds this many characters of the text.
  const TEXT_PAGE_CHARS = 600;
  // Enough raw text to yield TEXT_PAGE_CHARS of plain text even when markup takes a share.
  const TEXT_PAGE_SOURCE_CHARS = 4000;
  const OFFICE_NAMES = Object.freeze({
    docx: "Word",
    xlsx: "Excel",
    pptx: "PowerPoint",
  });
  const LEGACY_OFFICE_MESSAGE =
    "Save it as a .docx, .xlsx or .pptx file first, then attach it.";
  // {verb} is "Attach" for the picker and drop, "Paste" for the clipboard.
  const TYPE_REJECTED_MESSAGE =
    "That file type is not supported. {verb} an image (JPEG, PNG or WebP), a PDF, a text, Markdown or LaTeX file, or a Word, Excel or PowerPoint file.";
  const MATHPIX_RADIO_ID = "MathPix";
  const PASTE_ACCEPTED_TYPES = Object.freeze([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  // Human-readable file size for the attachment chip (bytes → KB or MB).
  function formatFileSize(bytes) {
    if (typeof bytes !== "number" || bytes <= 0) return "";
    const kb = bytes / 1024;
    if (kb < 1024) return Math.round(kb) + " KB";
    return (kb / 1024).toFixed(1) + " MB";
  }

  function state() {
    return window.ChatState || null;
  }

  function announce(text) {
    const s = state();
    if (s && typeof s.announceToScreenReader === "function") {
      s.announceToScreenReader(text);
    }
  }

  function elId(suffix) {
    const s = state();
    return s && typeof s.elId === "function" ? s.elId(suffix) : "chat-" + suffix;
  }

  function inputEl() {
    return document.getElementById(elId("attach-input"));
  }

  function previewEl() {
    return document.getElementById(elId("attachment-preview"));
  }

  function cardHostEl() {
    return document.getElementById(elId("attachment-card-host"));
  }

  function moreHostEl() {
    return document.getElementById(elId("attachment-more"));
  }

  function dropzoneEl() {
    return document.getElementById(elId("attach-dropzone"));
  }

  function fileUtils() {
    if (!_fileUtils && typeof window.EmbedFileUtils === "function") {
      _fileUtils = new window.EmbedFileUtils();
    }
    return _fileUtils;
  }

  // Ask chat.js to re-evaluate the blocked-attachment notice + send gate (Stage 6).
  // Guarded — a load-order gap or a chat.js without the hook is a silent no-op.
  // SILENT: it never announces. It returns the blocked sentence ("" when nothing
  // is blocked) so the attach path can fold it into its one spoken line.
  function refreshBlockedNotice() {
    if (window.Chat && typeof window.Chat.updateAttachmentNotice === "function") {
      return window.Chat.updateAttachmentNotice() || "";
    }
    return "";
  }

  function adviceEl() {
    return document.getElementById(elId("attachment-advice"));
  }

  function openMathPixEl() {
    return document.getElementById(elId("open-mathpix"));
  }

  function reader() {
    return window.EmbedDocumentReader || null;
  }

  // True while `token` is still the latest selection (a later file wins).
  function isCurrent(token) {
    return token === _readToken;
  }

  function setBusy(isBusy) {
    const zone = dropzoneEl();
    if (!zone) return;
    if (isBusy) zone.setAttribute("aria-busy", "true");
    else zone.removeAttribute("aria-busy");
  }

  // Free-model test for the CURRENT model. A local model runs in the browser and
  // sends nothing anywhere, so the "may keep what you send" warning would be
  // false for it: only a hosted free model qualifies.
  function currentModelIsFree() {
    const Chat = window.Chat;
    const s = state();
    if (!s || !Chat) return false;
    if (typeof Chat.getModelEntry !== "function") return false;
    if (typeof Chat._isFreeModel !== "function") return false;
    const entry = Chat.getModelEntry(s.currentModel);
    if (!entry || entry.providerId === "local") return false;
    return Chat._isFreeModel(entry) === true;
  }

  function kindLabel(held) {
    if (held.kind === "image") return "Image";
    if (held.kind === "pdf") return KIND_LABELS.pdf;
    return KIND_LABELS[held.doc && held.doc.docType] || KIND_LABELS.document;
  }

  // Sentence 2: maths wins over scan; neither → "". Reads the reader's own meta.
  function adviceSentence(held) {
    const doc = held && held.doc;
    const meta = doc && doc.meta;
    if (!meta) return "";
    if (meta.maths && meta.maths.detected) {
      return doc.docType === "pdf" ? ADVICE.mathsPdf : ADVICE.mathsWord;
    }
    if (doc.docType === "pdf" && meta.scan && meta.scan.likely) {
      return ADVICE.scan;
    }
    return "";
  }

  // Sentence 3: only for a held document (an image has no extracted text).
  function freeSentence(held) {
    return held && held.doc && currentModelIsFree() ? ADVICE.free : "";
  }

  // The visible copy of sentences 2 and 3. A plain paragraph with no live role,
  // so writing it is silent; the ONE spoken line is announced by the caller.
  function renderAdvice() {
    const el = adviceEl();
    const btn = openMathPixEl();
    const s2 = adviceSentence(attachment);
    const s3 = freeSentence(attachment);
    const text = [s2, s3].filter(Boolean).join(" ");
    if (el) {
      if (el.textContent !== text) el.textContent = text;
      el.hidden = !text;
    }
    if (btn) btn.hidden = !s2;
    _freeShown = !!s3;
  }

  // Visible "Reading <name>…" status while a file is read. Nothing is announced.
  function renderReading(name) {
    const el = adviceEl();
    const btn = openMathPixEl();
    if (el) {
      el.textContent = "Reading " + name + "…";
      el.hidden = false;
    }
    if (btn) btn.hidden = true;
  }

  // Called by chat.js on a model change. Refreshes the free-model sentence
  // visibly, and announces it ONLY when it newly appears — never the attach line.
  // It also shows or hides the "Include pictures" box for the new model, silently.
  function refreshAdvice() {
    if (_reading) return;
    const wasFree = _freeShown;
    renderAdvice();
    renderPictures();
    fitCard(); // the free-model sentence or the pictures column may have changed the details column
    if (_freeShown && !wasFree) announce(ADVICE.free);
  }

  // ── "Include pictures" box (parcel P3b) ─────────────────────────────────────
  function picturesWrapEl() {
    return document.getElementById(elId("attach-pictures-wrap"));
  }

  function picturesBoxEl() {
    return document.getElementById(elId("attach-pictures"));
  }

  function picturesCountEl() {
    return document.getElementById(elId("attach-pictures-count"));
  }

  function picturesKindEl() {
    return document.getElementById(elId("attach-pictures-kind"));
  }

  function picturesNoteEl() {
    return document.getElementById(elId("attach-pictures-note"));
  }

  function picturesStripEl() {
    return document.getElementById(elId("attach-pictures-strip"));
  }

  // A PDF sends its PAGES as pictures; Word and PowerPoint send the pictures inside them.
  function picturesArePages() {
    return !!(attachment && attachment.doc && attachment.doc.docType === "pdf");
  }

  // Pages in the PDF beyond the ones that can be sent (the reader renders at most CAPS.MAX_IMAGES).
  function pagesOverCap() {
    const meta = attachment && attachment.doc && attachment.doc.meta;
    const summary = meta && meta.pictureSummary;
    return !!summary && Number(meta.pagesTotal) > Number(summary.found);
  }

  // The pictures that WOULD be sent from the held document: the reader's own count
  // of kept pictures (a scan or maths PDF counts its page pictures). An image, a prose
  // PDF and a text file carry no summary and read 0.
  function keptPictureCount() {
    const summary =
      attachment && attachment.doc && attachment.doc.meta && attachment.doc.meta.pictureSummary;
    const kept = summary ? Number(summary.kept) : 0;
    return Number.isFinite(kept) && kept > 0 ? kept : 0;
  }

  // Offered only for a held document with pictures to send, on a model that can
  // read images. Decided at CALL time, like isSentAsDocument().
  function picturesOffered() {
    if (!isSentAsDocument() || keptPictureCount() === 0) return false;
    const s = state();
    return modelAcceptsImages(s ? s.currentModel : null);
  }

  // The choice that travels with the turn: true only while the box is showing AND
  // ticked at this moment, so a model that cannot read images never gets pictures.
  function picturesIncluded() {
    const box = picturesBoxEl();
    return picturesOffered() && !!box && box.checked === true;
  }

  // Shows or hides the box and writes its count. SILENT: the block has no live
  // region and nothing is announced; the one attach line names the pictures.
  function renderPictures() {
    const offered = picturesOffered();
    const kept = offered ? keptPictureCount() : 0;
    const words = PICTURES_LABEL[offered && picturesArePages() ? "pages" : "pictures"];
    for (const [el, text] of [
      [picturesCountEl(), String(kept)],
      [picturesKindEl(), kept === 1 ? words.one : words.many],
    ]) {
      if (el && el.textContent !== text) el.textContent = text;
    }
    const wrap = picturesWrapEl();
    if (wrap) wrap.hidden = !offered;
    renderStrip();
  }

  // ── The strip of pictures that would be sent (parcel P7) ─────────────────────
  // Decorative: the host is aria-hidden, each picture has an empty alt, nothing in it is
  // focusable, and the box's label is its text equivalent. SILENT: no live region, no announce().

  // The held pictures the reader would send: those with a data URL, in order, each with the number
  // and kind the wire labels it with ("Page n:" / "Image n:", openrouter-embed-documents.js toParts).
  function sendablePictures() {
    const images = attachment && attachment.doc && attachment.doc.images;
    if (!Array.isArray(images)) return [];
    const pictures = [];
    images.forEach(function (image, index) {
      if (!(image && image.dataUrl)) return;
      pictures.push({
        dataUrl: image.dataUrl,
        number: Number.isFinite(image.number) ? image.number : index + 1,
        kind: image.kind === PICTURE_KIND_PAGE ? PICTURE_KIND_PAGE : "image",
      });
    });
    return pictures;
  }

  // A small copy of one picture, made on a canvas and flattened onto white. Resolves null on any
  // failure, so one bad picture leaves a caption with no thumbnail rather than breaking the strip.
  function makeThumbnail(dataUrl) {
    return new Promise(function (resolve) {
      const source = new Image();
      source.onload = function () {
        const longest = Math.max(source.naturalWidth, source.naturalHeight);
        if (!(longest > 0)) return resolve(null);
        const scale = Math.min(1, THUMB_MAX_PX / longest);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) return resolve(null);
        context.fillStyle = THUMB_BACKGROUND;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        try {
          resolve(canvas.toDataURL(THUMB_MIME, THUMB_QUALITY));
        } catch (e) {
          logWarn("thumbnail could not be encoded");
          resolve(null);
        }
      };
      source.onerror = function () {
        resolve(null);
      };
      source.src = dataUrl;
    });
  }

  // Builds the items for the held attachment (captions at once, thumbnails one after another as
  // they are made). Held on the DOM only: nothing here is stored or sent.
  function buildStripItems(strip) {
    strip.textContent = "";
    const held = attachment;
    _stripFor = held;
    const pending = [];
    sendablePictures().forEach(function (picture) {
      const item = document.createElement("div");
      item.className = "chat-attach-pictures-item";
      const thumb = document.createElement("img");
      thumb.className = "chat-attach-pictures-thumb";
      thumb.alt = ""; // decorative: the box's label says what is being sent
      item.appendChild(thumb);
      const caption = document.createElement("span");
      caption.className = "chat-attach-pictures-caption";
      caption.textContent = STRIP_CAPTIONS[picture.kind] + " " + picture.number;
      item.appendChild(caption);
      strip.appendChild(item);
      pending.push({ thumb: thumb, dataUrl: picture.dataUrl });
    });
    (async function () {
      for (const entry of pending) {
        const small = await makeThumbnail(entry.dataUrl);
        if (_stripFor !== held) return; // removed or replaced meanwhile
        if (small) entry.thumb.src = small;
      }
    })();
  }

  // The strip and its note show only while the box is showing AND ticked. Items persist (hidden)
  // across an untick, and are dropped when the held attachment changes or goes.
  function renderStrip() {
    const strip = picturesStripEl();
    const note = picturesNoteEl();
    if (!strip || !note) return;
    if (_stripFor && _stripFor !== attachment) {
      strip.textContent = "";
      _stripFor = null;
    }
    const show = picturesIncluded();
    note.hidden = !show;
    if (show && _stripFor !== attachment) buildStripItems(strip);
    strip.hidden = !show;
  }

  // Pictures cost tokens, so every new attach and every removal starts unticked.
  function resetPicturesChoice() {
    const box = picturesBoxEl();
    if (box) box.checked = false;
  }

  // The attach-line sentence naming the pictures; "" unless the box is showing.
  function picturesSentence() {
    if (!picturesOffered()) return "";
    const kept = keptPictureCount();
    if (picturesArePages()) {
      if (pagesOverCap()) {
        return PICTURES_SENTENCE.pageCapped
          .replace("{total}", String(attachment.doc.meta.pagesTotal))
          .replace("{n}", String(kept));
      }
      return kept === 1
        ? PICTURES_SENTENCE.pageOne
        : PICTURES_SENTENCE.pageMany.replace("{n}", String(kept));
    }
    return kept === 1
      ? PICTURES_SENTENCE.one
      : PICTURES_SENTENCE.many.replace("{n}", String(kept));
  }

  function openMathPix() {
    const radio = document.getElementById(MATHPIX_RADIO_ID);
    if (!radio) {
      logWarn("openMathPix: the MathPix mode radio was not found");
      return;
    }
    radio.click(); // the existing mode switcher sets MathPix's own tab state
    radio.focus();
  }

  // ── Public: capability gate (shared with the wire) ──────────────────────────
  function modelAcceptsImages(modelId) {
    if (!modelId) return false;
    const Chat = window.Chat;
    const selector = window.EmbedModelSelector;
    if (!Chat || typeof Chat.getModelEntry !== "function") {
      logWarn("modelAcceptsImages: window.Chat.getModelEntry unavailable");
      return false;
    }
    if (!selector || typeof selector._modelHasCapabilities !== "function") {
      logWarn("modelAcceptsImages: EmbedModelSelector._modelHasCapabilities unavailable");
      return false;
    }
    const entry = Chat.getModelEntry(modelId);
    if (!entry) return false;
    return selector._modelHasCapabilities(entry, ["vision"]);
  }

  // The PDF-capability gate. Unlike the generic vision gate, it reads TWO facts:
  // the entry carries a `pdf` capability token AND its id begins "azure-openai/"
  // OR "azure-responses/". The gate now admits BOTH Azure surfaces — the chat
  // surface and the Responses surface (its input_file remap is live and proven).
  // The token still excludes OpenRouter (no pdf token) and local (no token);
  // gpt-4o stays out despite its azure-openai/ prefix because Stage 1 removed its
  // token (transmits but reads blind). Same window.Chat / selector availability
  // guarding and null/missing handling as modelAcceptsImages.
  function modelAcceptsPDF(modelId) {
    if (!modelId) return false;
    const Chat = window.Chat;
    const selector = window.EmbedModelSelector;
    if (!Chat || typeof Chat.getModelEntry !== "function") {
      logWarn("modelAcceptsPDF: window.Chat.getModelEntry unavailable");
      return false;
    }
    if (!selector || typeof selector._modelHasCapabilities !== "function") {
      logWarn("modelAcceptsPDF: EmbedModelSelector._modelHasCapabilities unavailable");
      return false;
    }
    const entry = Chat.getModelEntry(modelId);
    if (!entry) return false;
    return (
      selector._modelHasCapabilities(entry, ["pdf"]) &&
      (modelId.startsWith("azure-openai/") ||
        modelId.startsWith("azure-responses/"))
    );
  }

  // ── Public: attachment accessors ────────────────────────────────────────────
  function hasAttachment() {
    return attachment !== null;
  }

  // A readable PDF is sent as extracted text unless the current model reads PDFs
  // itself. Decided at CALL time from ChatState.currentModel, so a model change
  // between attach and send changes the shape without any re-read.
  function isSentAsDocument() {
    if (!attachment) return false;
    if (attachment.kind === "document") return true;
    if (attachment.kind !== "pdf" || !attachment.doc) return false;
    const s = state();
    return !modelAcceptsPDF(s ? s.currentModel : null);
  }

  function getAttachmentPart() {
    if (!attachment) return null;
    if (isSentAsDocument()) {
      return { type: "document", doc: attachment.doc, includeImages: picturesIncluded() };
    }
    if (attachment.kind === "pdf") {
      // Same shape preparePDFContent builds — produced inline (no call into it).
      return {
        type: "file",
        file: {
          filename: attachment.filename,
          file_data:
            "data:" + attachment.mimeType + ";base64," + attachment.base64,
        },
      };
    }
    return {
      type: "image_url",
      image_url: {
        url: "data:" + attachment.mimeType + ";base64," + attachment.base64,
      },
    };
  }

  function buildReference() {
    if (!attachment) return null;
    // Byte-free either way: filename / type / size only, kind echoed from the
    // held attachment. Persistence and the restore chip read this — NEVER the
    // base64 and never the document text (chars is a count only).
    if (isSentAsDocument()) {
      return {
        kind: "document",
        docType: attachment.doc.docType,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
        chars: attachment.doc.text.length,
      };
    }
    return {
      kind: attachment.kind === "pdf" ? "pdf" : "image",
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
    };
  }

  function clearAttachment() {
    const had = attachment !== null;
    const clearedKind = attachment ? attachment.kind : null;
    attachment = null;
    renderPreview();
    renderAdvice(); // hides the advice line and Open MathPix
    resetPicturesChoice();
    renderPictures(); // hides the "Include pictures" box
    const input = inputEl();
    if (input) input.value = ""; // so re-picking the SAME file still fires change
    if (had) {
      announce(
        clearedKind === "pdf"
          ? "PDF attachment removed."
          : clearedKind === "document"
            ? "Document removed."
            : "Image attachment removed."
      );
    }
    refreshBlockedNotice(); // removing an attachment clears any blocked-model gate
    logDebug("Attachment cleared", { had });
  }

  // ── Selection flow ──────────────────────────────────────────────────────────
  function resetInput() {
    const input = inputEl();
    if (input) input.value = "";
  }

  function notify(level, message, options) {
    const fn = window[level];
    if (typeof fn === "function") fn(message, options);
    else logWarn("notification unavailable: " + level);
  }

  // Wording for a document the reader refused. Filenames only, never content.
  function readFailureMessage(error, name, route) {
    const code = error && error.code;
    if (code === "unsupported-format" && OFFICE_NAMES[route]) {
      // The module exists but failed to load: this is a fault, not "coming soon".
      return (
        OFFICE_NAMES[route] +
        " files cannot be read right now. Try again, or save it as a PDF and attach that."
      );
    }
    if (code === "too-large") return name + " is too large to attach.";
    return (
      "Could not read " +
      name +
      ". Check that it is not damaged or password-protected, then try again."
    );
  }

  function displayNameFor(file, fallbackName) {
    return file.name && file.name.trim() ? file.name : fallbackName;
  }

  // Text, Markdown, LaTeX and Office files: read through the reader, hold the
  // result as a document. One announce() on success; a failure is one
  // notifyError and nothing is held.
  async function setDocumentFromFile(file, route) {
    const token = ++_readToken;
    const displayName = displayNameFor(file, "Pasted document");
    _reading = true;
    setBusy(true);
    renderReading(displayName);

    let doc;
    try {
      doc = await reader().read(file);
    } catch (e) {
      if (!isCurrent(token)) return;
      logWarn("Document read failed", e && e.code);
      _reading = false;
      setBusy(false);
      renderAdvice();
      resetInput();
      notify("notifyError", readFailureMessage(e, displayName, route));
      return;
    }
    if (!isCurrent(token)) return; // a later file won

    attachment = {
      file: file,
      base64: null,
      doc: doc,
      filename: displayName,
      mimeType: file.type || "text/plain",
      size: file.size,
      kind: "document",
    };
    _reading = false;
    setBusy(false);
    renderPreview();
    renderAdvice();
    resetPicturesChoice();
    renderPictures();
    announceAttached(refreshBlockedNotice());
    logInfo("Document attached", { size: file.size, docType: doc.docType });
  }

  // The ONE spoken line for an attach: sentence 1, then the same sentences 2 and
  // 3 the advice paragraph shows, then the blocked-model sentence when the
  // current model cannot read this attachment. One call, one utterance. The
  // pictures sentence (only while the "Include pictures" box is showing) sits
  // after the advice sentence and before the free-model sentence.
  function announceAttached(blockedSentence) {
    const parts = [
      kindLabel(attachment) + " attached: " + attachment.filename + ".",
      adviceSentence(attachment),
      picturesSentence(),
      freeSentence(attachment),
      blockedSentence,
    ];
    announce(parts.filter(Boolean).join(" "));
  }

  async function setFromFile(file) {
    const route = reader() ? reader().detect(file) : null;
    if (route && typeof route === "object") {
      notify("notifyError", LEGACY_OFFICE_MESSAGE);
      resetInput();
      return;
    }
    if (route === "text" || OFFICE_NAMES[route]) {
      return setDocumentFromFile(file, route);
    }

    const utils = fileUtils();
    if (!utils) {
      logError("EmbedFileUtils unavailable — cannot build the attachment");
      // The toast is the voice and stays on screen: no announce() beside it.
      notify(
        "notifyError",
        "Could not attach the image: the file utility is unavailable."
      );
      return;
    }

    // Type gate (throws on unsupported type / non-File). EmbedFileUtils is
    // already PDF-aware — the returned { isImage, isPDF } tells us the kind, so
    // there is no separate validator and no size branch here (both below are
    // kind-correct already).
    let kind;
    try {
      const { isImage, isPDF } = utils.validateFileType(file);
      kind = isPDF ? "pdf" : "image";
      logDebug("Attachment type accepted", { isImage, isPDF, kind });
    } catch (e) {
      logWarn("Rejected attachment (type)", e && e.message);
      notify("notifyError", TYPE_REJECTED_MESSAGE.replace("{verb}", "Attach"));
      const input = inputEl();
      if (input) input.value = "";
      return;
    }

    // Size gate (throws over the image limit — keeps the 10MB hint honest).
    try {
      utils.validateFileSize(file);
    } catch (e) {
      logWarn("Rejected attachment (size)", e && e.message);
      notify("notifyError", (e && e.message) || "That image is too large.");
      const input = inputEl();
      if (input) input.value = "";
      return;
    }

    // A clipboard-pasted file can arrive with a blank or generic name; fall back
    // to a readable label (by kind) so the preview text and the spoken cue never
    // read oddly (e.g. an empty filename or "Image attached: ."). A blank name on
    // a PDF is unlikely, but "Pasted document" keeps it honest. Input- and drop-
    // picked files always carry a name, so this is a no-op for those paths.
    const fallbackName = kind === "pdf" ? "Pasted document" : "Pasted image";
    const displayName = displayNameFor(file, fallbackName);

    // Both gates passed: this is the latest selection. A PDF also shows the
    // visible reading status; an image is quick enough not to need it.
    const token = ++_readToken;
    if (kind === "pdf") {
      _reading = true;
      setBusy(true);
      renderReading(displayName);
    }

    // Bytes. Compression is left to the embed default at send time.
    let base64;
    try {
      base64 = await utils.fileToBase64(file);
    } catch (e) {
      if (!isCurrent(token)) return;
      logError("fileToBase64 failed", e && e.message);
      _reading = false;
      setBusy(false);
      renderAdvice();
      notify(
        "notifyError",
        "Could not read the image. Try again or choose another file."
      );
      resetInput();
      return;
    }

    // A PDF is ALSO read for its text, so a model that cannot read PDFs can still
    // be sent the words. If the reader refuses, the raw PDF is held exactly as
    // before (doc: null) and one persistent warning says so.
    let doc = null;
    let readFailed = false;
    if (kind === "pdf" && reader()) {
      try {
        doc = await reader().read(file);
      } catch (e) {
        readFailed = true;
        logWarn("PDF text read failed", e && e.code);
      }
    }
    if (!isCurrent(token)) return; // a later file won

    _reading = false;
    setBusy(false);
    attachment = {
      file: file,
      base64: base64,
      doc: doc,
      filename: displayName,
      mimeType: file.type,
      size: file.size,
      kind: kind,
    };
    renderPreview();
    renderAdvice();
    resetPicturesChoice();
    renderPictures(); // shows the box for a scan or maths PDF (page pictures); hides a previous document's box otherwise
    // Attaching to an incapable model shows the gate now. Asked for silently and
    // BEFORE speaking, so the blocked sentence rides in the one line below.
    const blockedSentence = refreshBlockedNotice();
    if (readFailed) {
      // The warning toast is the voice for this event: no announce() beside it,
      // so the blocked sentence (if any) is appended to the toast text.
      notify(
        "notifyWarning",
        "Could not read the text of " +
          displayName +
          ". It can still be sent to a model that reads PDFs." +
          (blockedSentence ? " " + blockedSentence : ""),
        { duration: 0 }
      );
    } else {
      announceAttached(blockedSentence);
    }
    logInfo("Attachment set", { filename: file.name, size: file.size, type: file.type, kind: kind });
  }

  // ── Pre-send preview chip (in #chat-attachment-preview) ─────────────────────
  function renderPreview() {
    const host = previewEl();
    if (!host) return;
    const cardHost = cardHostEl();
    host.textContent = ""; // clear every host; each stays hidden until something is placed in it
    if (cardHost) {
      cardHost.textContent = "";
      cardHost.hidden = true;
    }
    const moreHost = moreHostEl();
    if (moreHost) {
      moreHost.textContent = "";
      moreHost.hidden = true;
    }
    if (!attachment) {
      fitCard(); // clears the card's size
      return;
    }

    const chip = document.createElement("div");
    chip.className = "chat-attachment-chip";

    // The card is decorative, so it sits beside the "Selected attachment" region in
    // its own host rather than inside it; the region keeps the name, type, size and Remove.
    const card = buildPreviewCard();
    if (cardHost) {
      cardHost.appendChild(card);
      cardHost.hidden = false;
    } else {
      chip.appendChild(card);
    }

    // Beside the card: the name with Remove straight after it (one row on a wide box, and
    // the page order is the visual order), then the facts. Layout and colour live in
    // chat.css and the theme sheets, so nothing here is styled inline.
    const details = document.createElement("div");
    details.className = "chat-attachment-details";
    chip.appendChild(details);

    const head = document.createElement("div");
    head.className = "chat-attachment-head";
    details.appendChild(head);

    const name = document.createElement("span");
    name.className = "chat-attachment-filename";
    name.textContent = attachment.filename; // textContent — never innerHTML (safe)
    head.appendChild(name);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "chat-attachment-remove"; // 44px target (SC 2.5.8) is set in chat.css
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("data-icon", "close");
    remove.appendChild(icon);
    remove.appendChild(
      document.createTextNode(
        attachment.kind === "pdf"
          ? "Remove PDF"
          : attachment.kind === "document"
            ? "Remove document"
            : "Remove image"
      )
    );
    remove.addEventListener("click", function () {
      clearAttachment();
      const input = inputEl();
      if (input && typeof input.focus === "function") input.focus();
    });
    head.appendChild(remove);

    details.appendChild(buildFacts(attachment));

    host.appendChild(chip);
    renderMore(moreHost);

    // Dynamically-inserted data-icon spans are not auto-populated — do it now.
    if (window.IconLibrary && typeof window.IconLibrary.populateIcons === "function") {
      window.IconLibrary.populateIcons(chip);
      if (cardHost) window.IconLibrary.populateIcons(cardHost); // the card's document icon lives outside the chip
    } else if (typeof window.refreshIcons === "function") {
      window.refreshIcons(chip);
      if (cardHost) window.refreshIcons(cardHost);
    }

    observeBody();
    fitCard(); // a picture card refits again when its picture has loaded
  }

  // The count beside the type: "15 pages", "8 slides", "3 sheets", with the heading it
  // sits under. The count is the reader's own; Word and a text file have none (null).
  function countFact(held) {
    const unit = held.doc && COUNT_UNITS[held.doc.docType];
    if (!unit) return null;
    const count = Number(held.doc.meta && held.doc.meta[unit.key]);
    if (!Number.isFinite(count) || count <= 0) return null;
    return { label: unit.label, text: count + " " + (count === 1 ? unit.one : unit.many) };
  }

  // One heading-and-value pair in a definition list. A value that is empty gives no pair,
  // so a missing field is left out rather than shown as 0 or "No".
  function addFact(list, label, value, valueClass) {
    if (!value) return;
    const row = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = label;
    const def = document.createElement("dd");
    if (valueClass) def.className = valueClass;
    def.textContent = value;
    row.appendChild(term);
    row.appendChild(def);
    list.appendChild(row);
  }

  // The facts under the name: type, the count where the reader has one, and size. A wide
  // box shows a heading over each value; a narrow one joins the values on one line.
  function buildFacts(held) {
    const list = document.createElement("dl");
    list.className = "chat-attachment-facts";
    addFact(list, FACT_LABELS.type, kindLabel(held), "chat-attachment-type");
    const count = countFact(held);
    if (count) addFact(list, count.label, count.text, "chat-attachment-count");
    addFact(list, FACT_LABELS.size, formatFileSize(held.size), "chat-attachment-size");
    return list;
  }

  // An image's Dimensions, from the card picture's own natural size once it has loaded (parcel P7).
  // Never shown as 0, and only for an image: a document's pages have no single size. The facts list
  // carries no live role, so the late addition is silent.
  function addDimensionsFact(held, picture) {
    if (held.kind !== "image") return;
    const width = picture.naturalWidth;
    const height = picture.naturalHeight;
    if (!(width > 0 && height > 0)) return;
    const host = previewEl();
    const list = host && host.querySelector(".chat-attachment-facts");
    if (!list || list.querySelector(".chat-attachment-dimensions")) return;
    addFact(
      list,
      FACT_LABELS.dimensions,
      formatNumber(width) + DIMENSIONS_WORDS.times + formatNumber(height) + DIMENSIONS_WORDS.unit,
      "chat-attachment-dimensions"
    );
  }

  // ── "How we read this file" (parcel P4c) ────────────────────────────────────
  function formatNumber(value) {
    return Number(value).toLocaleString(NUMBER_LOCALE);
  }

  function countWords(value, one, many) {
    return formatNumber(value) + " " + (Number(value) === 1 ? one : many);
  }

  // The text the model is sent. The cut-short case is the reader's own `truncated`; "all of
  // it" is also withheld when a PDF was read only to its page limit or an Excel file has
  // sheets cut short, because the characters then stop short of the file.
  function textReadValue(doc) {
    if (typeof doc.text !== "string") return "";
    const meta = doc.meta || {};
    const cut = meta.truncated;
    if (cut && Number.isFinite(cut.kept) && Number.isFinite(cut.total)) {
      return "the first " + formatNumber(cut.kept) + " of " + formatNumber(cut.total) + " characters";
    }
    const characters = countWords(doc.text.length, "character", "characters");
    const pagesCut = Number(meta.pages) < Number(meta.pagesTotal);
    const sheetsCut = Number(meta.cutSheets) > 0;
    return pagesCut || sheetsCut ? characters : characters + MORE_WORDS.allOfIt;
  }

  // Pictures found in a Word or PowerPoint file, from the reader's own picture summary.
  function picturesValue(meta) {
    const summary = meta.pictureSummary;
    if (!summary || !Number.isFinite(summary.found) || !Number.isFinite(summary.kept)) return "";
    if (summary.found === 0) return MORE_WORDS.noneFound;
    const skipped = Number(meta.skippedPictures);
    const value = formatNumber(summary.found) + " found, " + formatNumber(summary.kept) + " can be sent";
    return skipped > 0 ? value + ", " + formatNumber(skipped) + " skipped" : value;
  }

  // The page pictures of a scan or maths PDF.
  function pagePicturesValue(meta) {
    const summary = meta.pictureSummary;
    if (!summary || !Number.isFinite(summary.kept)) return "";
    const sendable = summary.kept === 0 ? "None" : formatNumber(summary.kept);
    const value = sendable + " can be sent";
    const skipped = Number(meta.skippedPictures);
    return skipped > 0 ? value + ", " + formatNumber(skipped) + " skipped" : value;
  }

  // Maths in a PDF is a yes or no. In Word and PowerPoint the reader's score is the number
  // of equations it found. A PDF's score is a share of characters, which is not plain, so it
  // is left out.
  function mathsValue(doc) {
    const maths = doc.meta && doc.meta.maths;
    if (!maths || typeof maths.detected !== "boolean") return "";
    if (doc.docType === "pdf") return maths.detected ? MORE_WORDS.detected : MORE_WORDS.notDetected;
    if (!maths.detected) return MORE_WORDS.noneFound;
    return Number.isFinite(maths.score)
      ? countWords(maths.score, "equation", "equations")
      : MORE_WORDS.detected;
  }

  // A plain whole-number field, or "" when the reader did not return one.
  function numberValue(value) {
    return Number.isFinite(value) ? formatNumber(value) : "";
  }

  // A count that is only worth a row when it is above 0.
  function positiveValue(value) {
    return Number.isFinite(value) && value > 0 ? formatNumber(value) : "";
  }

  // The rows of the disclosure, as [heading, value] pairs, for one held document.
  function readingRows(doc) {
    const meta = doc.meta || {};
    const rows = [];
    const add = (label, value) => {
      if (value) rows.push([label, value]);
    };
    add(MORE_WORDS.textRead, textReadValue(doc));

    if (doc.docType === "pdf") {
      const pagesKnown = Number.isFinite(meta.pages) && Number.isFinite(meta.pagesTotal);
      add(MORE_WORDS.pagesRead, pagesKnown ? formatNumber(meta.pages) + " of " + formatNumber(meta.pagesTotal) : "");
      const scan = meta.scan;
      add(MORE_WORDS.scan, scan && typeof scan.likely === "boolean" ? (scan.likely ? MORE_WORDS.yes : MORE_WORDS.no) : "");
      add(MORE_WORDS.maths, mathsValue(doc));
      add(MORE_WORDS.pagePictures, pagePicturesValue(meta));
    } else if (doc.docType === "docx") {
      add(MORE_WORDS.pictures, picturesValue(meta));
      add(
        MORE_WORDS.charts,
        Number.isFinite(meta.charts)
          ? meta.charts > 0
            ? countWords(meta.charts, "chart", "charts")
            : MORE_WORDS.noneFound
          : ""
      );
      add(MORE_WORDS.maths, mathsValue(doc));
    } else if (doc.docType === "pptx") {
      add(MORE_WORDS.slides, numberValue(meta.slides));
      add(MORE_WORDS.hiddenSlides, positiveValue(meta.hiddenCount));
      add(MORE_WORDS.pictures, picturesValue(meta));
      add(MORE_WORDS.maths, mathsValue(doc));
    } else if (doc.docType === "xlsx") {
      add(MORE_WORDS.sheets, numberValue(meta.sheets));
      add(MORE_WORDS.hiddenSheets, positiveValue(meta.hiddenCount));
      add(MORE_WORDS.cutSheets, positiveValue(meta.cutSheets));
    }
    return rows;
  }

  // Fills the (still hidden) host with a CLOSED disclosure for a held document. An image,
  // and a PDF the reader could not read, hold no `doc`, so the host stays hidden. Nothing
  // here is a live region: opening it is silent apart from the browser's own expanded state.
  function renderMore(host) {
    if (!host || !attachment || !attachment.doc) return;
    const rows = readingRows(attachment.doc);
    if (!rows.length) return;

    const disclosure = document.createElement("details");
    disclosure.className = "chat-attachment-more-details";
    const summary = document.createElement("summary");
    summary.textContent = MORE_WORDS.summary;
    disclosure.appendChild(summary);

    const list = document.createElement("dl");
    list.className = "chat-attachment-read";
    rows.forEach((row) => addFact(list, row[0], row[1], "chat-attachment-read-value"));
    disclosure.appendChild(list);

    host.appendChild(disclosure);
    host.hidden = false;
  }

  // The first characters of a document as plain text. DOMParser builds an inert
  // document, so no script or resource in the text runs or loads.
  function firstLinesOf(text) {
    const source = String(text).slice(0, TEXT_PAGE_SOURCE_CHARS);
    const plain = new DOMParser().parseFromString(source, "text/html").body.textContent || "";
    return Array.from(plain.trim()).slice(0, TEXT_PAGE_CHARS).join("");
  }

  // The card that lets a person recognise the file they chose. An image shows
  // itself, a PDF shows its first page, and a Word, PowerPoint, Excel or text file
  // shows a small "page" holding the first lines of its text. Every picture here is
  // decorative: the file name beside the card names the file.
  function buildPreviewCard() {
    const card = document.createElement("div");
    card.className = "chat-attachment-card";

    let previewSrc = null;
    if (attachment.kind === "image") {
      previewSrc = "data:" + attachment.mimeType + ";base64," + attachment.base64;
    } else if (attachment.kind === "pdf") {
      const firstPage = attachment.doc && attachment.doc.meta && attachment.doc.meta.preview;
      if (firstPage && firstPage.dataUrl) previewSrc = firstPage.dataUrl;
    }

    if (previewSrc) {
      const thumb = document.createElement("img");
      thumb.className = "chat-attachment-thumb";
      // Once the picture has loaded its own shape is known: an image's Dimensions join the facts and
      // the card is fitted to its row at that shape (parcel P7).
      const held = attachment;
      thumb.addEventListener("load", function () {
        if (held !== attachment) return; // removed or replaced before it loaded
        addDimensionsFact(held, thumb);
        fitCard();
      });
      thumb.src = previewSrc;
      thumb.alt = ""; // decorative — the filename is shown as visible text beside it
      card.appendChild(thumb);
      return card;
    }

    if (attachment.kind === "document" && attachment.doc) {
      const page = document.createElement("div");
      page.className = "chat-attachment-textpage";
      // Hidden from a screen reader because the file name already names the file.
      // It holds no focusable child, so this does not hide a control (Rule 4).
      page.setAttribute("aria-hidden", "true");
      page.textContent = firstLinesOf(attachment.doc.text);
      card.appendChild(page);
      return card;
    }

    // A PDF the reader could not preview: a decorative document icon.
    const docIcon = document.createElement("span");
    docIcon.className = "chat-attachment-doc-icon";
    docIcon.setAttribute("aria-hidden", "true"); // decorative — filename names it
    docIcon.setAttribute("data-icon", attachment.kind === "pdf" ? "pdf" : "fileText");
    card.appendChild(docIcon);
    return card;
  }

  // ── The card fills its row (parcel P7) ───────────────────────────────────────
  // From 600px the card is as tall as the details column at rest (its disclosure closed) and as
  // wide as the picture's own shape makes it at that height, up to half the box. CSS cannot size
  // a box from a sibling's height, so this measures the column and sets two custom properties on
  // the box body, which chat.css reads. It runs on attach, Remove, replace, a model change, the
  // card picture loading and a change in the body's WIDTH; never on a tick or a disclosure toggle,
  // so those cannot resize the card. The observer below reacts to width only, so the card's own
  // size (which moves the body's height, not its width) cannot start a loop.
  function bodyEl() {
    const zone = dropzoneEl();
    return zone ? zone.querySelector(".chat-attach-body") : null;
  }

  function mainEl() {
    const body = bodyEl();
    return body ? body.querySelector(".chat-attach-main") : null;
  }

  function clearCardVars(body) {
    body.style.removeProperty(CARD_WIDTH_VAR);
    body.style.removeProperty(CARD_HEIGHT_VAR);
    _fitBodyWidth = 0;
  }

  // The card picture's width over its height; null until a picture has loaded. A text page and a
  // document icon use the A4 shape the text page is drawn at.
  function cardAspect(host) {
    const picture = host.querySelector("img.chat-attachment-thumb");
    if (!picture) return TEXT_PAGE_ASPECT;
    return picture.complete && picture.naturalWidth > 0 && picture.naturalHeight > 0
      ? picture.naturalWidth / picture.naturalHeight
      : null;
  }

  function fitCard() {
    const body = bodyEl();
    const host = cardHostEl();
    const main = mainEl();
    if (!body || !host || !main) return;
    if (!attachment || host.hidden || !window.matchMedia(WIDE_BOX_QUERY).matches) {
      clearCardVars(body);
      return;
    }
    const aspect = cardAspect(host);
    const bodyWidth = body.clientWidth;
    if (!aspect || !(bodyWidth > 0)) return; // not loaded, or not laid out (the tool is hidden)
    _fitBodyWidth = bodyWidth;

    // The resting height is with every disclosure closed; an open one is put back afterwards.
    const reopen = Array.from(main.querySelectorAll("details[open]"));
    reopen.forEach(function (details) {
      details.open = false;
    });

    // The picture sits inside the card's border, so the shape applies to the box inside it.
    const card = host.querySelector(".chat-attachment-card");
    const cardStyle = card ? window.getComputedStyle(card) : null;
    const chrome = cardStyle ? (parseFloat(cardStyle.borderLeftWidth) || 0) + (parseFloat(cardStyle.borderRightWidth) || 0) : 0;
    const maxWidth = bodyWidth * CARD_MAX_SHARE;
    const previous = parseFloat(body.style.getPropertyValue(CARD_WIDTH_VAR));
    let width = Number.isFinite(previous) ? previous : bodyWidth * CARD_DEFAULT_SHARE;
    let height = 0;
    for (let pass = 0; pass < CARD_FIT_MAX_PASSES; pass++) {
      body.style.setProperty(CARD_WIDTH_VAR, width + "px");
      height = main.getBoundingClientRect().height;
      const next = Math.min(maxWidth, Math.max(CARD_MIN_PX, (height - chrome) * aspect + chrome));
      if (Math.abs(next - width) < CARD_FIT_EPSILON_PX) break;
      width = next;
    }
    // The details column is measured at the width the card ends on.
    body.style.setProperty(CARD_WIDTH_VAR, width + "px");
    height = main.getBoundingClientRect().height;
    body.style.setProperty(CARD_HEIGHT_VAR, height + "px");

    reopen.forEach(function (details) {
      details.open = true;
    });
  }

  // One observer for the page's lifetime. It refits on a change of the body's width and ignores
  // every other resize, which is what keeps it from looping on its own writes.
  function observeBody() {
    if (_bodyObserver || typeof window.ResizeObserver !== "function") return;
    const body = bodyEl();
    if (!body) return;
    _bodyObserver = new window.ResizeObserver(function () {
      if (Math.abs(body.clientWidth - _fitBodyWidth) > CARD_FIT_EPSILON_PX) fitCard();
    });
    _bodyObserver.observe(body);
  }

  // ── Wiring ──────────────────────────────────────────────────────────────────
  // Drag-and-drop is an ENHANCEMENT over the native file input, never a
  // replacement: the label-wrapped input stays the primary keyboard-operable
  // control. The drop path terminates in the SAME setFromFile() the input's
  // change listener uses, so type/size validation, renderPreview(), the "Image
  // attached." announcement and the blocked-notice refresh are all inherited —
  // nothing is duplicated here.
  function wireDrop() {
    if (_dropWired) return; // the drop target is bound once
    const zone = dropzoneEl();
    if (!zone) {
      logDebug("wireDrop: drop target not found yet");
      return;
    }
    const DRAG_CLASS = "drag-over"; // the Stage 2 shape-change state class

    const onDragOver = function (e) {
      e.preventDefault(); // required so the browser will fire "drop"
      e.stopPropagation();
      zone.classList.add(DRAG_CLASS);
    };
    const onDragLeave = function (e) {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove(DRAG_CLASS);
    };
    const onDrop = function (e) {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove(DRAG_CLASS);
      // First file only. setFromFile owns validation and all user feedback.
      const file =
        e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) setFromFile(file);
    };

    zone.addEventListener("dragover", onDragOver);
    zone.addEventListener("dragleave", onDragLeave);
    zone.addEventListener("drop", onDrop);

    // Teardown handle (symmetry with the Stage 4 paste cleanup): removes the
    // listeners and clears any lingering drag-over state so re-wiring is clean.
    _dropCleanup = function () {
      zone.removeEventListener("dragover", onDragOver);
      zone.removeEventListener("dragleave", onDragLeave);
      zone.removeEventListener("drop", onDrop);
      zone.classList.remove(DRAG_CLASS);
      _dropWired = false;
      _dropCleanup = null;
      logDebug("drop wiring torn down");
    };

    _dropWired = true;
    logInfo("wireDrop complete (dragover/dragleave/drop on #" + zone.id + ")");
  }

  // Clipboard paste is a second ENHANCEMENT over the file input, delegated to the
  // shared EmbedFileUtils.bindClipboardPaste helper. Scoped to #chat-app with
  // preventInInputs:true, so a normal text paste in the composer textarea is NEVER
  // hijacked — an image only attaches when focus is within the Chat tool but not
  // in a text field. onPaste terminates in the SAME setFromFile() the input and
  // drop use (size re-validated there); the helper type-filters before onPaste,
  // so a wrong-type paste is reported via onError instead.
  function wirePaste() {
    if (_pasteWired) return; // bound once
    const utils = fileUtils();
    if (!utils || typeof utils.bindClipboardPaste !== "function") {
      logDebug("wirePaste: EmbedFileUtils.bindClipboardPaste unavailable");
      return;
    }
    if (!document.querySelector("#chat-app")) {
      logDebug("wirePaste: #chat-app not found yet");
      return;
    }
    try {
      _pasteCleanup = utils.bindClipboardPaste({
        containerSelector: "#chat-app",
        acceptedTypes: PASTE_ACCEPTED_TYPES.slice(),
        preventInInputs: true,
        onPaste: function (file) {
          setFromFile(file); // SAME entry as the input + drop paths
        },
        onError: function (err) {
          // The helper filters wrong types before setFromFile sees them, so it
          // owns this rejection cue; mirror setFromFile's type-rejection wording.
          logWarn("Rejected paste (type)", err && err.message);
          notify("notifyError", TYPE_REJECTED_MESSAGE.replace("{verb}", "Paste"));
        },
      });
      _pasteWired = true;
      logInfo("wirePaste complete (clipboard paste bound to #chat-app)");
    } catch (e) {
      logError("wirePaste failed", e && e.message);
    }
  }

  // Whole-box click-to-pick: clicking anywhere in the drop target opens the file
  // picker, so the click area matches the visible dashed box rather than just the
  // label text. Pointer-only — it adds NO role/tabindex/keydown, so the native
  // label stays the sole keyboard control (keyboard users Tab to the input and
  // press Space/Enter). Clicks on the label itself are ignored (the label already
  // opens the picker natively — this avoids a double-open), as are clicks on any
  // interactive child such as the preview's Remove button.
  function wireClickToPick() {
    if (_clickWired) return; // bound once
    const zone = dropzoneEl();
    if (!zone) {
      logDebug("wireClickToPick: drop target not found yet");
      return;
    }
    const onClick = function (e) {
      if (
        e.target.closest("label, button, a, input, select, textarea")
      ) {
        return; // native/interactive target owns this click
      }
      const input = inputEl();
      if (input) input.click();
    };
    zone.addEventListener("click", onClick);
    _clickCleanup = function () {
      zone.removeEventListener("click", onClick);
      _clickWired = false;
      _clickCleanup = null;
    };
    _clickWired = true;
    logInfo("wireClickToPick complete (box click opens the picker)");
  }

  function init() {
    // File input (the primary keyboard-operable control) — bound once.
    if (!_wired) {
      const input = inputEl();
      if (input) {
        input.addEventListener("change", function () {
          const file = input.files && input.files[0];
          if (file) setFromFile(file);
        });
        _wired = true;
        logInfo("init complete (file input wired)");
      } else {
        logDebug("init: file input not found yet");
      }
    }
    // Drag-and-drop enhancement — bound once, independently of the input.
    wireDrop();
    // Clipboard-paste enhancement — bound once, independently of the input.
    wirePaste();
    // Whole-box click-to-pick enhancement — bound once, independently.
    wireClickToPick();
    // Open MathPix button — bound once, independently.
    wireOpenMathPix();
    // The pictures box's tick shows or hides the strip and its note — bound once, silent.
    wirePicturesBox();
  }

  function wirePicturesBox() {
    if (_boxWired) return;
    const box = picturesBoxEl();
    if (!box) return;
    box.addEventListener("change", renderStrip);
    _boxWired = true;
  }

  function wireOpenMathPix() {
    if (_mathPixWired) return;
    const btn = openMathPixEl();
    if (!btn) return;
    btn.addEventListener("click", openMathPix);
    _mathPixWired = true;
  }

  // Self-initialise once the DOM is ready (the input is static markup in tools.html).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    hasAttachment: hasAttachment,
    getAttachmentPart: getAttachmentPart,
    buildReference: buildReference,
    clearAttachment: clearAttachment,
    modelAcceptsImages: modelAcceptsImages,
    modelAcceptsPDF: modelAcceptsPDF,
    refreshAdvice: refreshAdvice,
    init: init,
    // Inspection / teardown handles (never production entry points).
    _setFromFile: setFromFile,
    _wireDrop: wireDrop,
    _teardownDrop: function () {
      return _dropCleanup ? _dropCleanup() : undefined;
    },
    _wirePaste: wirePaste,
    _teardownPaste: function () {
      if (_pasteCleanup) {
        _pasteCleanup();
        _pasteCleanup = null;
        _pasteWired = false;
      }
    },
    _wireClickToPick: wireClickToPick,
    _teardownClickToPick: function () {
      return _clickCleanup ? _clickCleanup() : undefined;
    },
  };
})();
