/**
 * OpenRouter Embed API - PDF format module
 *
 * Registers window.EmbedDocumentFormats.pdf for openrouter-embed-documents.js.
 * Reads the text of each page with pdf.js, and reports two advisory signals:
 * whether the PDF looks like it contains maths, and whether it looks like a
 * scan. Neither signal ever blocks anything.
 *
 * Privacy: document content is never logged (sizes and counts only), and the
 * PDF's /Info dictionary and XMP metadata are never read into the text.
 *
 * Parcel P1a: adopted nowhere.
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
      console.error(`[EmbedDocPdf ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedDocPdf WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedDocPdf INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedDocPdf DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const DOC_TYPE = "pdf";
  const ERROR_UNREADABLE = "unreadable";

  // Same cdnjs URLs as tools.html:90. No new third-party host.
  const PDFJS_URL =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  const PDFJS_WORKER_URL =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  // Maths detection (REGISTER 3(a), measured on real LaTeX PDFs, 22 October 2026).
  // CMR is NOT a maths font: every LaTeX document sets its ordinary text in it.
  // SymbolMT must not match.
  const MATHS_SHARE_THRESHOLD = 0.01;
  const MATHS_FONT_PATTERN = /^(CMMI|CMSY|CMEX|CMBSY|CMMIB|MSBM|MSAM)\d*$/i;
  const MATHS_FONT_LOOSE_PATTERN = /math/i;
  const SUBSET_PREFIX_PATTERN = /^[A-Z]{6}\+/;
  const SHARE_SIGNAL = "share";

  const MATHS_RANGES = Object.freeze([
    Object.freeze([0x2200, 0x22ff]),
    Object.freeze([0x27c0, 0x27ef]),
    Object.freeze([0x2980, 0x2aff]),
    Object.freeze([0x1d400, 0x1d7ff]),
  ]);

  // Scan detection: text drawn in rendering mode 3 is invisible (an OCR layer).
  const TEXT_RENDER_MODE_INVISIBLE = 3;
  const SCAN_PAGE_FRACTION = 0.5;

  const PAGE_HEADER_PREFIX = "--- Page ";
  const PAGE_HEADER_SUFFIX = " ---";

  // Page pictures (parcel P4). Only a PDF flagged as a scan or as maths gets them; every PDF
  // gets a small first-page preview for Chat's attachment card (shown, never sent).
  const PAGE_PICTURE_SIDE_PX = 1568;
  const PREVIEW_HEIGHT_PX = 400;
  const PAGE_PROFILE = "page";
  const PREVIEW_PROFILE = "preview";
  const RENDER_TYPE = "image/png";
  const RENDER_BACKGROUND = "#ffffff";

  // ============================================================================
  // HELPERS
  // ============================================================================

  function fail(code) {
    const error = new Error(code);
    error.code = code;
    error.docType = DOC_TYPE;
    return error;
  }

  function isMathsCodePoint(codePoint) {
    return MATHS_RANGES.some(([low, high]) => codePoint >= low && codePoint <= high);
  }

  function isMathsFont(family) {
    return MATHS_FONT_PATTERN.test(family) || MATHS_FONT_LOOSE_PATTERN.test(family);
  }

  /** The font family name, or "" when pdf.js has not resolved the font object. */
  function fontFamily(page, fontId) {
    try {
      if (!page.commonObjs.has(fontId)) return "";
      const font = page.commonObjs.get(fontId);
      return String((font && font.name) || "").replace(SUBSET_PREFIX_PATTERN, "");
    } catch (error) {
      return "";
    }
  }

  /**
   * Counts show-text operators drawn while the text rendering mode is 3.
   * The mode is graphics state, so it is saved and restored with a stack.
   */
  function countInvisibleShows(operatorList, OPS) {
    const { fnArray, argsArray } = operatorList;
    const stack = [];
    let mode = 0;
    let invisible = 0;

    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i];
      if (fn === OPS.save) {
        stack.push(mode);
      } else if (fn === OPS.restore) {
        if (stack.length) mode = stack.pop();
      } else if (fn === OPS.setTextRenderingMode) {
        const args = argsArray[i];
        mode = Array.isArray(args) ? args[0] : args;
      } else if (fn === OPS.showText || fn === OPS.showSpacedText) {
        if (mode === TEXT_RENDER_MODE_INVISIBLE) invisible++;
      }
    }
    return invisible;
  }

  /**
   * Draws one page on a white canvas and returns it as a PNG blob, or null on any failure.
   * scaleFor receives the page's size at scale 1 and returns the render scale. The canvas is
   * released straight away, so memory holds one page at a time.
   */
  async function renderPageBlob(pdf, number, scaleFor) {
    let page;
    try {
      page = await pdf.getPage(number);
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: scaleFor(natural) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const context = canvas.getContext("2d");
      context.fillStyle = RENDER_BACKGROUND;
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, RENDER_TYPE));
      canvas.width = 0;
      canvas.height = 0;
      return blob;
    } catch (error) {
      return null;
    } finally {
      if (page) page.cleanup();
    }
  }

  /** The first page as a small picture for Chat's card, or null. Never sent to a model. */
  async function renderPreview(pdf, ctx) {
    const blob = await renderPageBlob(pdf, 1, (natural) => PREVIEW_HEIGHT_PX / natural.height);
    return blob ? ctx.convertPicture(blob, PREVIEW_PROFILE) : null;
  }

  /**
   * Renders the first caps.MAX_IMAGES pages (never a page that cannot be sent) and hands them,
   * in order, to the shared picture step as page pictures.
   */
  async function renderPagePictures(pdf, pagesRead, ctx) {
    const items = [];
    const rendered = Math.min(pagesRead, ctx.caps.MAX_IMAGES);
    for (let number = 1; number <= rendered; number++) {
      const blob = await renderPageBlob(pdf, number, (natural) => PAGE_PICTURE_SIDE_PX / Math.max(natural.width, natural.height));
      items.push({ blob, drawn: null, alt: "" });
    }
    return ctx.pictureStep(items, { profile: PAGE_PROFILE });
  }

  async function ensurePdfjs(ctx) {
    if (!window.pdfjsLib) {
      try {
        await ctx.loadScript(PDFJS_URL);
      } catch (error) {
        throw fail(ERROR_UNREADABLE);
      }
    }
    if (!window.pdfjsLib) throw fail(ERROR_UNREADABLE);

    // tools.html never sets workerSrc, and each consumer sets its own.
    const options = window.pdfjsLib.GlobalWorkerOptions;
    if (!options.workerSrc) options.workerSrc = PDFJS_WORKER_URL;
    return window.pdfjsLib;
  }

  // ============================================================================
  // FORMAT MODULE
  // ============================================================================

  async function read(file, ctx) {
    const pdfjs = await ensurePdfjs(ctx);
    const OPS = pdfjs.OPS;

    let pdf;
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
    } catch (error) {
      // Encrypted and broken files both land here. Never log error.message.
      ctx.log("PDF could not be opened", { bytes: file.size });
      throw fail(ERROR_UNREADABLE);
    }

    try {
      const pagesTotal = pdf.numPages;
      const pagesRead = Math.min(pagesTotal, ctx.caps.MAX_PDF_PAGES);

      const pageTexts = [];
      const mathsFonts = new Set();
      let mathsFontChars = 0;
      let mathsChars = 0;
      let allChars = 0;
      let emptyPages = 0;
      let invisibleTextPages = 0;
      let scanLikePages = 0;

      for (let number = 1; number <= pagesRead; number++) {
        const page = await pdf.getPage(number);
        const content = await page.getTextContent();
        // getOperatorList() must finish before commonObjs can name the fonts.
        const operatorList = await page.getOperatorList();

        let pageText = "";
        for (const item of content.items) {
          if (typeof item.str !== "string") continue;
          pageText += item.str;
          if (item.hasEOL) pageText += "\n";

          const family = item.str ? fontFamily(page, item.fontName) : "";
          const inMathsFont = family !== "" && isMathsFont(family);
          for (const character of item.str) {
            allChars++;
            if (isMathsCodePoint(character.codePointAt(0))) mathsChars++;
            if (inMathsFont) mathsFontChars++;
          }
          if (inMathsFont) mathsFonts.add(family);
        }

        const isEmpty = !/\S/.test(pageText);
        const invisibleShows = countInvisibleShows(operatorList, OPS);
        if (isEmpty) emptyPages++;
        if (invisibleShows > 0) invisibleTextPages++;
        if (isEmpty || invisibleShows > 0) scanLikePages++;

        pageTexts.push(`${PAGE_HEADER_PREFIX}${number}${PAGE_HEADER_SUFFIX}\n${pageText}`);
        page.cleanup();
      }

      const share = allChars > 0 ? mathsChars / allChars : 0;
      const signals = [...mathsFonts];
      if (share >= MATHS_SHARE_THRESHOLD) signals.push(SHARE_SIGNAL);
      const detected = mathsFontChars > 0 || share >= MATHS_SHARE_THRESHOLD;

      const text = pageTexts.join("\n");
      const pageLimitNote =
        pagesRead < pagesTotal
          ? `\n[Document cut short: the first ${pagesRead} of ${pagesTotal} pages are included.]`
          : "";

      const scanLikely = pagesRead > 0 && scanLikePages >= pagesRead * SCAN_PAGE_FRACTION;

      // P4: a scan or a maths PDF can be sent as page pictures, because its words may not
      // survive text extraction. A prose PDF gets none.
      let images = [];
      let pictureSummary = null;
      let pictureNote = "";
      if (scanLikely || detected) {
        const step = await renderPagePictures(pdf, pagesRead, ctx);
        images = step.images;
        pictureSummary = step.summary;
        if (pagesTotal > ctx.caps.MAX_IMAGES) {
          pictureNote = `\n[Page pictures: the first ${ctx.caps.MAX_IMAGES} of ${pagesTotal} pages can be sent.]`;
        }
      }
      const preview = pagesRead > 0 ? await renderPreview(pdf, ctx) : null;

      ctx.log("PDF read", {
        pages: pagesRead,
        pagesTotal,
        emptyPages,
        invisibleTextPages,
        mathsDetected: detected,
        pagePictures: images.length,
        hasPreview: preview !== null,
      });

      const result = {
        text: text + pageLimitNote + pictureNote,
        images,
        meta: {
          pages: pagesRead,
          pagesTotal,
          emptyPages,
          maths: { detected, score: share, signals },
          scan: {
            likely: scanLikely,
            emptyPages,
            invisibleTextPages,
            pages: pagesRead,
          },
        },
      };
      if (preview) result.meta.preview = preview;
      if (pictureSummary) result.pictureSummary = pictureSummary;
      return result;
    } catch (error) {
      if (error && error.code) throw error;
      ctx.log("PDF page read failed", { bytes: file.size });
      throw fail(ERROR_UNREADABLE);
    } finally {
      try {
        await pdf.destroy();
      } catch (error) {
        /* releasing memory is best-effort */
      }
    }
  }

  window.EmbedDocumentFormats = window.EmbedDocumentFormats || {};
  window.EmbedDocumentFormats[DOC_TYPE] = { read };

  logInfo("PDF format module loaded");
})();
