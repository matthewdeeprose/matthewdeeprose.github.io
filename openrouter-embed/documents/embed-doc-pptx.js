/**
 * OpenRouter Embed API - PowerPoint format module
 *
 * Registers window.EmbedDocumentFormats.pptx for openrouter-embed-documents.js.
 * Reads a .pptx (a zip of XML parts) with JSZip, which tools.html already loads:
 *   - slides in presentation order (p:sldIdLst), never file numbering;
 *   - hidden slides included and labelled "(hidden)";
 *   - speaker notes (the notes body placeholder only);
 *   - equations (OMML) as [Equation: ...], read from mc:Choice, never mc:Fallback;
 *   - pictures counted, marked [Image n] and handed to ctx.pictureStep.
 * Comments and document properties are never opened.
 *
 * Privacy: slide text is never logged (counts and booleans only through ctx.log),
 * and parsed XML stays in a detached DOMParser document, never in the page DOM.
 *
 * Parcel P2-pptx: adopted nowhere until someone attaches a PowerPoint file.
 *
 * @version 1.0.0 (P2-pptx)
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
      console.error(`[EmbedDocPptx ERROR] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[EmbedDocPptx WARN] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[EmbedDocPptx INFO] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[EmbedDocPptx DEBUG] ${message}`, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  const DOC_TYPE = "pptx";
  const ERROR_UNREADABLE = "unreadable";
  const ERROR_TOO_LARGE = "too-large";

  // The URL tools.html already loads (no new host).
  const JSZIP_URL = "https://matthewdeeprose.github.io/scripts/jszip.min.js";

  const NS = Object.freeze({
    A: "http://schemas.openxmlformats.org/drawingml/2006/main",
    P: "http://schemas.openxmlformats.org/presentationml/2006/main",
    R: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    M: "http://schemas.openxmlformats.org/officeDocument/2006/math",
    MC: "http://schemas.openxmlformats.org/markup-compatibility/2006",
    A14: "http://schemas.microsoft.com/office/drawing/2010/main",
    REL: "http://schemas.openxmlformats.org/package/2006/relationships",
  });

  const PRESENTATION_PART = "ppt/presentation.xml";
  const NOTES_REL_SUFFIX = "/notesSlide";
  const NOTES_PLACEHOLDER_TYPE = "body";
  const HIDDEN_VALUES = Object.freeze(["0", "false"]);

  const SLIDE_HEADER_PREFIX = "Slide ";
  const HIDDEN_SUFFIX = " (hidden)";
  const NOTES_LABEL = "Notes:";
  const SIGNAL_OMML = "omml";

  const EMU_PER_PX = 9525;
  const PICTURE_PLACEHOLDER_PREFIX = "DA-PIC";
  const PLACEHOLDER_EDGE = "\u0001";
  const NONCE_WORDS = 2;

  const PICTURE_MIME_TYPES = Object.freeze({
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    tif: "image/tiff",
    tiff: "image/tiff",
    webp: "image/webp",
    svg: "image/svg+xml",
    emf: "image/x-emf",
    wmf: "image/x-wmf",
  });
  const DEFAULT_PICTURE_MIME = "application/octet-stream";

  // ============================================================================
  // HELPERS
  // ============================================================================

  function fail(code) {
    const error = new Error(code);
    error.code = code;
    error.docType = DOC_TYPE;
    return error;
  }

  async function ensureJsZip(ctx) {
    if (!window.JSZip) {
      try {
        await ctx.loadScript(JSZIP_URL);
      } catch (error) {
        throw fail(ERROR_UNREADABLE);
      }
    }
    if (!window.JSZip) throw fail(ERROR_UNREADABLE);
    return window.JSZip;
  }

  function isElement(node, namespace, localName) {
    return (
      !!node &&
      node.nodeType === 1 &&
      node.namespaceURI === namespace &&
      node.localName === localName
    );
  }

  function childElements(node) {
    return Array.from(node.childNodes).filter((child) => child.nodeType === 1);
  }

  /**
   * The branches of mc:AlternateContent that may be read: the first mc:Choice
   * only. mc:Fallback is never read (its text is not read, its picture not
   * counted), so an equation is not met twice.
   */
  function readableBranches(node) {
    return childElements(node).filter((child) => isElement(child, NS.MC, "Choice")).slice(0, 1);
  }

  /** Parses XML into a detached document. A parse error is "unreadable". */
  function parseXml(text) {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) {
      throw fail(ERROR_UNREADABLE);
    }
    return doc;
  }

  function directoryOf(partPath) {
    return partPath.slice(0, partPath.lastIndexOf("/") + 1);
  }

  function relsPathFor(partPath) {
    const slash = partPath.lastIndexOf("/");
    return `${partPath.slice(0, slash + 1)}_rels/${partPath.slice(slash + 1)}.rels`;
  }

  /** A relationship target resolved to a zip entry name. */
  function resolvePartPath(baseDirectory, target) {
    const raw = target.startsWith("/") ? target.slice(1) : `${baseDirectory}${target}`;
    const segments = [];
    for (const segment of raw.split("/")) {
      if (segment === "" || segment === ".") continue;
      if (segment === "..") segments.pop();
      else segments.push(segment);
    }
    return segments.join("/");
  }

  function pictureMimeFor(path) {
    const dot = path.lastIndexOf(".");
    const extension = dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";
    return PICTURE_MIME_TYPES[extension] || DEFAULT_PICTURE_MIME;
  }

  function isBlank(value) {
    return value === null || value === undefined || /^\s*$/.test(value);
  }

  function firstChildNamed(node, namespace, localName) {
    return node ? childElements(node).find((child) => isElement(child, namespace, localName)) : undefined;
  }

  /** A fresh placeholder stem per read, so the document text cannot contain one by accident or design. */
  function randomHex() {
    return Array.from(window.crypto.getRandomValues(new Uint32Array(NONCE_WORDS)), (word) =>
      word.toString(16),
    ).join("");
  }

  /**
   * The drawn size (p:spPr/a:xfrm/a:ext, EMU to pixels) and alt text (p:nvPicPr/p:cNvPr descr, else
   * title) of the p:pic that holds this a:blip. A blip anywhere else (a shape fill, a background) has
   * neither. Matched by the element that holds the blip, never by position.
   */
  function pictureDetails(blip) {
    const picture = blip.parentNode && blip.parentNode.parentNode;
    if (!isElement(picture, NS.P, "pic")) return { drawn: null, alt: "" };

    const shapeProperties = firstChildNamed(picture, NS.P, "spPr");
    const extent = firstChildNamed(firstChildNamed(shapeProperties, NS.A, "xfrm"), NS.A, "ext");
    const w = extent ? Number(extent.getAttribute("cx")) / EMU_PER_PX : NaN;
    const h = extent ? Number(extent.getAttribute("cy")) / EMU_PER_PX : NaN;
    const drawn = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? { w, h } : null;

    const properties = firstChildNamed(firstChildNamed(picture, NS.P, "nvPicPr"), NS.P, "cNvPr");
    const descr = properties ? properties.getAttribute("descr") : null;
    const alt = isBlank(descr) ? (properties ? properties.getAttribute("title") : null) : descr;
    return { drawn, alt: alt || "" };
  }

  function isHidden(slideRoot) {
    const show = slideRoot.getAttribute("show");
    return show !== null && HIDDEN_VALUES.includes(show.trim().toLowerCase());
  }

  // ============================================================================
  // ZIP ACCESS (size cap and counted inflation)
  // ============================================================================

  /**
   * Declared uncompressed size of an entry, from the zip's own directory (read
   * before any entry is inflated). JSZip keeps it on the private _data object;
   * null when that is not available on this build.
   */
  function declaredSize(entry) {
    const data = entry && entry._data;
    return data && Number.isFinite(data.uncompressedSize) ? data.uncompressedSize : null;
  }

  function checkDeclaredSizes(zip, ctx) {
    let total = 0;
    let unknown = 0;
    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue;
      const size = declaredSize(entry);
      if (size === null) unknown++;
      else total += size;
    }
    ctx.log("PowerPoint zip sizes", { declaredBytes: total, entriesWithoutSize: unknown });
    if (total > ctx.caps.MAX_ZIP_UNCOMPRESSED_BYTES) throw fail(ERROR_TOO_LARGE);
  }

  /**
   * Inflates entries and counts the bytes actually produced, so a zip whose
   * directory understates its sizes still stops at the cap.
   */
  function createReader(zip, ctx) {
    let inflated = 0;
    const decoder = new TextDecoder("utf-8");

    async function bytes(path) {
      const entry = zip.file(path);
      if (!entry) return null;
      const data = await entry.async("uint8array");
      inflated += data.byteLength;
      if (inflated > ctx.caps.MAX_ZIP_UNCOMPRESSED_BYTES) throw fail(ERROR_TOO_LARGE);
      return data;
    }

    async function xml(path) {
      const data = await bytes(path);
      return data === null ? null : parseXml(decoder.decode(data));
    }

    const has = (path) => !!zip.file(path);

    return { bytes, xml, has };
  }

  async function readRelationships(reader, partPath) {
    const doc = await reader.xml(relsPathFor(partPath));
    const map = new Map();
    if (!doc) return map;
    const baseDirectory = directoryOf(partPath);
    for (const rel of doc.getElementsByTagNameNS(NS.REL, "Relationship")) {
      if (rel.getAttribute("TargetMode") === "External") continue;
      const target = rel.getAttribute("Target");
      if (!target) continue;
      map.set(rel.getAttribute("Id"), {
        type: rel.getAttribute("Type") || "",
        path: resolvePartPath(baseDirectory, target),
      });
    }
    return map;
  }

  // ============================================================================
  // SLIDE ORDER
  // ============================================================================

  /** Slide part paths in presentation order (p:sldIdLst), not file numbering. */
  async function orderedSlidePaths(reader) {
    const presentation = await reader.xml(PRESENTATION_PART);
    if (!presentation) throw fail(ERROR_UNREADABLE);
    const rels = await readRelationships(reader, PRESENTATION_PART);

    const list = presentation.getElementsByTagNameNS(NS.P, "sldIdLst")[0];
    if (!list) throw fail(ERROR_UNREADABLE);

    const ordered = [];
    for (const slideId of childElements(list)) {
      const rel = rels.get(slideId.getAttributeNS(NS.R, "id"));
      if (!rel) throw fail(ERROR_UNREADABLE);
      ordered.push(rel.path);
    }
    return ordered;
  }

  // ============================================================================
  // TEXT, EQUATIONS AND PICTURES
  // ============================================================================

  function equationText(mathNode) {
    return Array.from(mathNode.getElementsByTagNameNS(NS.M, "t"))
      .map((run) => run.textContent)
      .join("");
  }

  /** One [Equation: ...] per oMathPara, or per oMath that is not inside one. */
  function equationsIn(a14Node) {
    return childElements(a14Node)
      .filter((child) => isElement(child, NS.M, "oMathPara") || isElement(child, NS.M, "oMath"))
      .map((child) => `[Equation: ${equationText(child)}]`);
  }

  /** The text of one a:p as a single line, equations in place. */
  function paragraphText(paragraph, state) {
    let line = "";

    function addFrom(parent) {
      for (const child of childElements(parent)) {
        if (isElement(child, NS.A, "r") || isElement(child, NS.A, "fld")) {
          for (const run of childElements(child)) {
            if (isElement(run, NS.A, "t")) line += run.textContent;
          }
        } else if (isElement(child, NS.A, "br")) {
          line += " ";
        } else if (isElement(child, NS.A14, "m")) {
          for (const equation of equationsIn(child)) {
            state.equations++;
            line += equation;
          }
        } else if (isElement(child, NS.MC, "AlternateContent")) {
          readableBranches(child).forEach(addFrom);
        }
      }
    }

    addFrom(paragraph);
    return line.trim();
  }

  /**
   * Walks a slide (or notes) element in document order, appending one line per
   * paragraph and one [Image n] line per picture found outside mc:Fallback.
   */
  function walkContent(parent, state, lines) {
    for (const node of childElements(parent)) {
      if (isElement(node, NS.A, "p")) {
        const line = paragraphText(node, state);
        if (line !== "") lines.push(line);
      } else if (isElement(node, NS.MC, "AlternateContent")) {
        readableBranches(node).forEach((branch) => walkContent(branch, state, lines));
      } else if (isElement(node, NS.A, "blip")) {
        const picturePath = state.resolvePicture(node.getAttributeNS(NS.R, "embed"));
        if (picturePath) {
          const details = pictureDetails(node);
          state.pictures.push({ path: picturePath, drawn: details.drawn, alt: details.alt });
          // The real marker needs the core's decision, which comes after every slide is read.
          lines.push(state.placeholder(state.pictures.length));
        }
      } else {
        walkContent(node, state, lines);
      }
    }
  }

  /** The lines of the speaker-notes body placeholder, and nothing else on that slide. */
  function notesLines(notesRoot, state) {
    const lines = [];
    for (const shape of notesRoot.getElementsByTagNameNS(NS.P, "sp")) {
      const placeholder = shape.getElementsByTagNameNS(NS.P, "ph")[0];
      if (!placeholder || placeholder.getAttribute("type") !== NOTES_PLACEHOLDER_TYPE) continue;
      walkContent(shape, state, lines);
    }
    return lines;
  }

  async function readSlide(reader, slidePath, number, state) {
    const slide = await reader.xml(slidePath);
    if (!slide) throw fail(ERROR_UNREADABLE);

    const hidden = isHidden(slide.documentElement);
    const rels = await readRelationships(reader, slidePath);
    state.resolvePicture = (relId) => {
      const rel = relId ? rels.get(relId) : null;
      return rel && reader.has(rel.path) ? rel.path : null;
    };

    const label = hidden ? HIDDEN_SUFFIX : "";
    const lines = [`${SLIDE_HEADER_PREFIX}${number}${label}`];
    walkContent(slide.documentElement, state, lines);

    // Notes are text only: pictures on a notes page are not counted.
    const notesRel = Array.from(rels.values()).find((rel) => rel.type.endsWith(NOTES_REL_SUFFIX));
    if (notesRel) {
      const notes = await reader.xml(notesRel.path);
      if (notes) {
        state.resolvePicture = () => null;
        const noteLines = notesLines(notes.documentElement, state);
        if (noteLines.length > 0) lines.push(NOTES_LABEL, ...noteLines);
      }
    }
    return { text: lines.join("\n"), hidden };
  }

  // ============================================================================
  // FORMAT MODULE
  // ============================================================================

  async function read(file, ctx) {
    const JSZip = await ensureJsZip(ctx);

    let zip;
    try {
      zip = await JSZip.loadAsync(await file.arrayBuffer());
    } catch (error) {
      // Broken and non-zip files both land here. Never log error.message.
      ctx.log("PowerPoint could not be opened", { bytes: file.size });
      throw fail(ERROR_UNREADABLE);
    }

    try {
      checkDeclaredSizes(zip, ctx);

      const reader = createReader(zip, ctx);

      const nonce = randomHex();
      const placeholderOf = (number) =>
        `${PLACEHOLDER_EDGE}${PICTURE_PLACEHOLDER_PREFIX}-${nonce}-${number}${PLACEHOLDER_EDGE}`;
      const state = {
        equations: 0,
        pictures: [],
        resolvePicture: () => null,
        placeholder: placeholderOf,
      };
      const slidePaths = await orderedSlidePaths(reader);

      const slideTexts = [];
      let hiddenCount = 0;
      for (let index = 0; index < slidePaths.length; index++) {
        const slide = await readSlide(reader, slidePaths[index], index + 1, state);
        if (slide.hidden) hiddenCount++;
        slideTexts.push(slide.text);
      }

      // Pictures are collected, then ctx.pictureStep decides. A media file cited twice is inflated once.
      const mediaBytes = new Map();
      const items = [];
      for (const picture of state.pictures) {
        if (!mediaBytes.has(picture.path)) mediaBytes.set(picture.path, await reader.bytes(picture.path));
        items.push({
          blob: new Blob([mediaBytes.get(picture.path)], { type: pictureMimeFor(picture.path) }),
          drawn: picture.drawn,
          alt: picture.alt,
        });
      }
      const step = await ctx.pictureStep(items);

      // Each placeholder becomes the marker the core's decision calls for.
      const placeholderPattern = new RegExp(
        `${PLACEHOLDER_EDGE}${PICTURE_PLACEHOLDER_PREFIX}-${nonce}-(\\d+)${PLACEHOLDER_EDGE}`,
        "g",
      );
      const text = slideTexts.join("\n\n").replace(placeholderPattern, (match, number) => {
        const index = Number(number) - 1;
        return step.decisions[index] ? ctx.pictureMarker(step.decisions[index], items[index].alt) : match;
      });

      const equations = state.equations;
      ctx.log("PowerPoint read", {
        slides: slidePaths.length,
        hiddenCount,
        pictures: items.length,
        equations,
      });

      return {
        text,
        images: step.images,
        pictureSummary: step.summary,
        meta: {
          slides: slidePaths.length,
          hiddenCount,
          pictures: items.length,
          maths: {
            detected: equations > 0,
            score: equations,
            signals: equations > 0 ? [SIGNAL_OMML] : [],
          },
        },
      };
    } catch (error) {
      if (error && error.code) throw error;
      ctx.log("PowerPoint read failed", { bytes: file.size });
      throw fail(ERROR_UNREADABLE);
    }
  }

  window.EmbedDocumentFormats = window.EmbedDocumentFormats || {};
  window.EmbedDocumentFormats[DOC_TYPE] = { read };

  logInfo("PowerPoint format module loaded");
})();
