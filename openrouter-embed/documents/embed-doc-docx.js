/**
 * OpenRouter Embed API - Word (.docx) format module
 *
 * Registers window.EmbedDocumentFormats.docx for openrouter-embed-documents.js.
 * Reads a Word file with mammoth.js, after two repairs mammoth cannot make for
 * itself: equations (which mammoth drops silently) are rewritten in place as
 * "[Equation: ...]" runs, and charts (which mammoth drops completely) as
 * "[Chart: ...]" runs built from the chart's CACHED values.
 *
 * Privacy: document content is never logged (counts only), mammoth's HTML never
 * enters a page DOM (it is returned as text for the model), and a chart's
 * external link target is never read, logged or printed. No relationship marked
 * TargetMode="External" is followed, and c:externalData is never touched.
 *
 * Vendored libraries (byte for byte, copied 23 October 2026):
 *   openrouter-embed/vendor/mammoth-1.13.0.browser.min.js
 *     version 1.13.0
 *     from    %LOCALAPPDATA%\claude-a11y-sr\node_modules\mammoth\mammoth.browser.min.js
 *     SHA-256 92914a3708cfdf1e62cb553d1856a7fedab21da83d8ee82845de2f897b368cab
 *   openrouter-embed/vendor/LICENSE-mammoth.txt
 *     from    %LOCALAPPDATA%\claude-a11y-sr\node_modules\mammoth\LICENSE
 *     SHA-256 6663bbd049205d38a496ccacb412a151980b444627d38de218b3b809aef330f1
 * JSZip is not vendored: window.JSZip is used when present, otherwise the same
 * URL tools.html already loads.
 *
 * Parcel P2-docx: adopted nowhere until someone attaches a Word file.
 *
 * @version 1.0.0 (P2-docx)
 * @date 23 October 2026
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
      console.error(`[EmbedDocDocx ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedDocDocx WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedDocDocx INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedDocDocx DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const DOC_TYPE = "docx";
  const ERROR_UNREADABLE = "unreadable";
  const ERROR_TOO_LARGE = "too-large";

  // Recorded at load: document.currentScript is null once the script has run.
  const SCRIPT_SRC = (function () {
    const current = document.currentScript;
    if (current && current.src) return current.src;
    logWarn("document.currentScript unavailable; falling back to the page base");
    return new URL("openrouter-embed/documents/embed-doc-docx.js", document.baseURI)
      .href;
  })();

  const MAMMOTH_PATH = "../vendor/mammoth-1.13.0.browser.min.js";
  // The URL tools.html already loads (no new host).
  const JSZIP_URL = "https://matthewdeeprose.github.io/scripts/jszip.min.js";

  const DOCUMENT_PART = "word/document.xml";
  const DOCUMENT_RELS_PART = "word/_rels/document.xml.rels";
  const WORD_FOLDER = "word/";

  const NS = Object.freeze({
    W: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    M: "http://schemas.openxmlformats.org/officeDocument/2006/math",
    C: "http://schemas.openxmlformats.org/drawingml/2006/chart",
    A: "http://schemas.openxmlformats.org/drawingml/2006/main",
    WP: "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    R: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    PKG_RELS: "http://schemas.openxmlformats.org/package/2006/relationships",
    XML: "http://www.w3.org/XML/1998/namespace",
  });

  const EXTERNAL_MODE = "external";
  const MATHS_SIGNAL = "omml";
  const IMAGE_MARKER_PREFIX = "[Image ";
  const IMAGE_ALT_PATTERN = /<img\b[^>]*\balt="\[Image (\d+)\]"[^>]*>/g;
  const EMU_PER_PX = 9525;
  const PICTURE_TOKEN_PREFIX = "DA-IMG";
  const NONCE_WORDS = 2;

  // ============================================================================
  // HELPERS
  // ============================================================================

  function fail(code) {
    const error = new Error(code);
    error.code = code;
    error.docType = DOC_TYPE;
    return error;
  }

  async function ensureLibraries(ctx) {
    if (!window.JSZip) {
      try {
        await ctx.loadScript(JSZIP_URL);
      } catch (error) {
        throw fail(ERROR_UNREADABLE);
      }
    }
    if (!window.mammoth) {
      try {
        await ctx.loadScript(new URL(MAMMOTH_PATH, SCRIPT_SRC).href);
      } catch (error) {
        throw fail(ERROR_UNREADABLE);
      }
    }
    if (!window.JSZip || !window.mammoth) throw fail(ERROR_UNREADABLE);
  }

  /**
   * Adds up the uncompressed sizes the zip directory declares, WITHOUT inflating
   * anything (JSZip keeps each size on the entry's internal _data). A size that is
   * not a finite number cannot be trusted, so it is treated as unreadable.
   */
  function declaredUncompressedBytes(zip) {
    let total = 0;
    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue;
      const size = entry._data && entry._data.uncompressedSize;
      if (!Number.isFinite(size) || size < 0) throw fail(ERROR_UNREADABLE);
      total += size;
    }
    return total;
  }

  function parseXml(text) {
    const parsed = new DOMParser().parseFromString(text, "application/xml");
    if (parsed.getElementsByTagName("parsererror").length) {
      throw fail(ERROR_UNREADABLE);
    }
    return parsed;
  }

  function childrenNamed(parent, namespace, localName) {
    return Array.from(parent.childNodes).filter(
      (node) =>
        node.nodeType === 1 &&
        node.namespaceURI === namespace &&
        node.localName === localName,
    );
  }

  function textOf(elements) {
    return elements.map((element) => element.textContent).join("");
  }

  /** A plain Word run holding one text string, for mammoth to read as ordinary text. */
  function makeTextRun(doc, text) {
    const run = doc.createElementNS(NS.W, "w:r");
    const textElement = doc.createElementNS(NS.W, "w:t");
    textElement.setAttributeNS(NS.XML, "xml:space", "preserve");
    textElement.textContent = text;
    run.appendChild(textElement);
    return run;
  }

  // ============================================================================
  // EQUATIONS (mammoth drops m:oMathPara and m:oMath silently)
  // ============================================================================

  function isInsideEquation(element) {
    for (let node = element.parentNode; node; node = node.parentNode) {
      if (
        node.nodeType === 1 &&
        node.namespaceURI === NS.M &&
        (node.localName === "oMathPara" || node.localName === "oMath")
      ) {
        return true;
      }
    }
    return false;
  }

  /** Replaces each outermost equation with a text run. Returns how many were rewritten. */
  function rewriteEquations(doc) {
    const candidates = Array.from(doc.getElementsByTagNameNS(NS.M, "*")).filter(
      (element) =>
        (element.localName === "oMathPara" || element.localName === "oMath") &&
        !isInsideEquation(element),
    );

    let rewritten = 0;
    for (const equation of candidates) {
      const text = textOf(Array.from(equation.getElementsByTagNameNS(NS.M, "t")));
      // An equation with no text has nothing to say, and is not guessed at.
      if (text !== "") {
        equation.parentNode.replaceChild(
          makeTextRun(doc, `[Equation: ${text}]`),
          equation,
        );
        rewritten++;
      } else {
        equation.parentNode.removeChild(equation);
      }
    }
    return rewritten;
  }

  // ============================================================================
  // CHARTS (mammoth drops chart parts completely)
  // ============================================================================

  /** Relationship id -> chart part path, for INTERNAL relationships only. */
  async function readChartTargets(zip) {
    const targets = new Map();
    const relsFile = zip.file(DOCUMENT_RELS_PART);
    if (!relsFile) return targets;

    const rels = parseXml(await relsFile.async("string"));
    for (const rel of Array.from(rels.getElementsByTagNameNS(NS.PKG_RELS, "Relationship"))) {
      // An external relationship is never followed, read or kept.
      const mode = (rel.getAttribute("TargetMode") || "").toLowerCase();
      if (mode === EXTERNAL_MODE) continue;

      const id = rel.getAttribute("Id");
      const target = rel.getAttribute("Target") || "";
      if (!id || !/charts\/[^/]+\.xml$/i.test(target)) continue;

      const path = target.startsWith("/")
        ? target.slice(1)
        : WORD_FOLDER + target.replace(/^\.\//, "");
      targets.set(id, path);
    }
    return targets;
  }

  /** index -> cached value, for the points of one c:cat or c:val element. */
  function cachedPoints(container) {
    const points = new Map();
    if (!container) return points;
    for (const point of Array.from(container.getElementsByTagNameNS(NS.C, "pt"))) {
      const value = childrenNamed(point, NS.C, "v")[0];
      const index = Number(point.getAttribute("idx"));
      if (value && Number.isFinite(index)) points.set(index, value.textContent);
    }
    return points;
  }

  function chartTitle(chart) {
    const title = childrenNamed(chart, NS.C, "title")[0];
    if (!title) return "";
    const runs = Array.from(title.getElementsByTagNameNS(NS.A, "t"));
    if (runs.length) return textOf(runs).trim();
    return textOf(Array.from(title.getElementsByTagNameNS(NS.C, "v"))).trim();
  }

  function seriesText(series) {
    const nameContainer = childrenNamed(series, NS.C, "tx")[0];
    const name = nameContainer
      ? textOf(Array.from(nameContainer.getElementsByTagNameNS(NS.C, "v"))).trim()
      : "";
    const categories = cachedPoints(childrenNamed(series, NS.C, "cat")[0]);
    const values = cachedPoints(childrenNamed(series, NS.C, "val")[0]);

    const points = [];
    for (const index of Array.from(values.keys()).sort((a, b) => a - b)) {
      const label = categories.has(index) ? categories.get(index).trim() : "";
      points.push(`${label} ${values.get(index)}`.trim());
    }
    // A missing piece is left out, never guessed.
    if (name && points.length) return `${name}: ${points.join("; ")}`;
    if (points.length) return points.join("; ");
    return name;
  }

  /** The "[Chart: ...]" text for one chart part, built from its cached values only. */
  async function chartMarker(zip, chartPath) {
    const file = chartPath ? zip.file(chartPath) : null;
    if (!file) return "[Chart]";

    const chartDoc = parseXml(await file.async("string"));
    const chart = chartDoc.getElementsByTagNameNS(NS.C, "chart")[0];
    if (!chart) return "[Chart]";

    const parts = [];
    const title = chartTitle(chart);
    if (title) parts.push(title);
    for (const series of Array.from(chart.getElementsByTagNameNS(NS.C, "ser"))) {
      const text = seriesText(series);
      if (text) parts.push(text);
    }

    const linkNote = "";
    return parts.length ? `[Chart: ${parts.join(". ")}${linkNote}]` : "[Chart]";
  }

  /** Replaces each w:drawing that holds a chart with a text run. Returns how many. */
  async function rewriteCharts(doc, zip) {
    const drawings = Array.from(doc.getElementsByTagNameNS(NS.W, "drawing")).filter(
      (drawing) => drawing.getElementsByTagNameNS(NS.C, "chart").length > 0,
    );
    if (!drawings.length) return 0;

    const targets = await readChartTargets(zip);
    for (const drawing of drawings) {
      const reference = drawing.getElementsByTagNameNS(NS.C, "chart")[0];
      const relationshipId = reference.getAttributeNS(NS.R, "id");
      const marker = await chartMarker(zip, targets.get(relationshipId));

      const run = drawing.parentNode;
      const textElement = doc.createElementNS(NS.W, "w:t");
      textElement.setAttributeNS(NS.XML, "xml:space", "preserve");
      textElement.textContent = marker;
      run.replaceChild(textElement, drawing);
    }
    return drawings.length;
  }

  // ============================================================================
  // PICTURES (alt text and drawn size, which mammoth does not hand over whole)
  // ============================================================================

  function isBlank(value) {
    return value === null || value === undefined || /^\s*$/.test(value);
  }

  /** A fresh token stem per read, so a token cannot be guessed or forged by the document. */
  function randomHex() {
    return Array.from(window.crypto.getRandomValues(new Uint32Array(NONCE_WORDS)), (word) =>
      word.toString(16),
    ).join("");
  }

  /** The drawn size in pixels from a wp:extent (EMU), or null when it is missing or not positive. */
  function drawnSizeOf(extent) {
    if (!extent) return null;
    const w = Number(extent.getAttribute("cx")) / EMU_PER_PX;
    const h = Number(extent.getAttribute("cy")) / EMU_PER_PX;
    return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? { w, h } : null;
  }

  /**
   * Records each picture drawing's alt text (descr, else title: the rule mammoth itself applies) and its
   * drawn size from the sibling wp:extent, then sets descr to a unique token. mammoth passes descr to
   * convertImage as image.altText, so convertImage finds the right entry again by that token and never by
   * position. Returns Map token -> { alt, drawn }.
   */
  function tokenisePictures(doc) {
    const nonce = randomHex();
    const entries = new Map();
    const containers = [
      ...doc.getElementsByTagNameNS(NS.WP, "inline"),
      ...doc.getElementsByTagNameNS(NS.WP, "anchor"),
    ];
    for (const container of containers) {
      if (container.getElementsByTagNameNS(NS.A, "blip").length === 0) continue;
      const docPr = childrenNamed(container, NS.WP, "docPr")[0];
      if (!docPr) continue;

      const descr = docPr.getAttribute("descr");
      const alt = isBlank(descr) ? docPr.getAttribute("title") : descr;
      const token = `${PICTURE_TOKEN_PREFIX}-${nonce}-${entries.size + 1}`;
      entries.set(token, {
        alt: alt || "",
        drawn: drawnSizeOf(childrenNamed(container, NS.WP, "extent")[0]),
      });
      docPr.setAttribute("descr", token);
    }
    return entries;
  }

  // ============================================================================
  // FORMAT MODULE
  // ============================================================================

  async function read(file, ctx) {
    await ensureLibraries(ctx);

    let zip;
    try {
      zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    } catch (error) {
      // Encrypted and broken files both land here. Never log error.message.
      ctx.log("Word file could not be opened", { bytes: file.size });
      throw fail(ERROR_UNREADABLE);
    }

    // The size cap comes first: nothing is inflated until the declared total passes.
    const declared = declaredUncompressedBytes(zip);
    if (declared > ctx.caps.MAX_ZIP_UNCOMPRESSED_BYTES) {
      ctx.log("Word file refused as too large", { bytes: file.size, declared });
      throw fail(ERROR_TOO_LARGE);
    }

    const documentFile = zip.file(DOCUMENT_PART);
    if (!documentFile) {
      ctx.log("Word file has no document part", { bytes: file.size });
      throw fail(ERROR_UNREADABLE);
    }

    try {
      const doc = parseXml(await documentFile.async("string"));
      const equations = rewriteEquations(doc);
      const charts = await rewriteCharts(doc, zip);
      const pictureEntries = tokenisePictures(doc);
      zip.file(DOCUMENT_PART, new XMLSerializer().serializeToString(doc));
      const repaired = await zip.generateAsync({ type: "arraybuffer" });

      // Each picture becomes a numbered marker; its bytes, drawn size and alt text are collected.
      const items = [];
      const convertImage = window.mammoth.images.imgElement((image) => {
        // The number is taken now, in document order, not when the bytes arrive.
        const number = items.length + 1;
        items.push(null);
        return image.read().then((bytes) => {
          const known = pictureEntries.get(image.altText);
          items[number - 1] = {
            blob: new Blob([bytes], { type: image.contentType }),
            drawn: known ? known.drawn : null,
            alt: known ? known.alt : "",
            matched: Boolean(known),
          };
          return { src: "", alt: `${IMAGE_MARKER_PREFIX}${number}]` };
        });
      });
      const converted = await window.mammoth.convertToHtml(
        { arrayBuffer: repaired },
        { convertImage },
      );

      // The core decides what happens to each picture; the marker text is written here.
      const step = await ctx.pictureStep(items);
      const html = converted.value.replace(IMAGE_ALT_PATTERN, (match, number) => {
        const index = Number(number) - 1;
        return step.decisions[index]
          ? ctx.pictureMarker(step.decisions[index], items[index].alt)
          : match;
      });
      // A picture whose token was not found has no known alt text or drawn size: counted, never guessed.
      const unmatched = items.filter((item) => !item.matched).length;

      ctx.log("Word file read", {
        bytes: file.size,
        declared,
        chars: html.length,
        equations,
        charts,
        pictures: items.length,
        unmatched,
      });

      return {
        text: html,
        images: step.images,
        pictureSummary: step.summary,
        meta: {
          maths: {
            detected: equations > 0,
            score: equations,
            signals: equations > 0 ? [MATHS_SIGNAL] : [],
          },
          charts,
          pictures: items.length,
          pictureUnmatched: unmatched,
        },
      };
    } catch (error) {
      if (error && error.code) throw error;
      ctx.log("Word file could not be read", { bytes: file.size });
      throw fail(ERROR_UNREADABLE);
    }
  }

  window.EmbedDocumentFormats = window.EmbedDocumentFormats || {};
  window.EmbedDocumentFormats[DOC_TYPE] = { read };

  logInfo("Word format module loaded");
})();
