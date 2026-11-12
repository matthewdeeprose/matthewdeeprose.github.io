/**
 * @fileoverview MathPixDocumentTree (BR-2) - one shared, read-only document tree.
 *
 * Reads the current session MMD (or one passed in), strips the long-description appendix with the restorer's
 * own strip, renders it OFF-SCREEN through the page's mathpix-markdown-it with the preview's own
 * RENDER_OPTIONS (which keep a hidden <latex> and <mathml> beside every equation), and walks the result into a
 * plain JSON-safe tree. A braille export and a later PreTeXt export both read this tree.
 *
 * READ-ONLY. The render is parsed with DOMParser, so nothing is inserted into the page, no image loads, and the
 * editor, the live preview and the four stores are never touched. It does not call the preview's
 * _preprocessForPreview (which writes the preview's own figure-alt map); it uses the preview's pure
 * _stripFigureAltOptions and the same one-line captionsetup removal.
 *
 * Node types (and no others in this version):
 *   block:  heading (level, rank), paragraph, list, table, figure, code, blockquote, unknown
 *   inline: text, math, link, sub, sup (BR-3b: sub and sup are kept, not flattened)
 * A figure keeps its four registry strings (caption, alt, longDescription, textInImage) and, beside each, an inline list
 * parsed with the same maths handling as body text (captionInlines, altInlines, longDescriptionInlines, textInImageInlines).
 * Content the walker does not recognise is kept as an `unknown` block, never dropped.
 *
 * @module MathPixDocumentTree
 * @version 1.0.0 (BR-2)
 */

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[DocumentTree]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[DocumentTree]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[DocumentTree]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[DocumentTree]", message, ...args);
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================

  /** Block node types. */
  const NODE_TYPES = Object.freeze({
    HEADING: "heading",
    PARAGRAPH: "paragraph",
    LIST: "list",
    TABLE: "table",
    FIGURE: "figure",
    CODE: "code",
    BLOCKQUOTE: "blockquote",
    UNKNOWN: "unknown",
  });

  /** Inline node types. */
  const INLINE_TYPES = Object.freeze({ TEXT: "text", MATH: "math", LINK: "link", SUB: "sub", SUP: "sup" });

  const EMPHASIS = Object.freeze({ STRONG: "strong", EM: "em" });

  const SOURCE = Object.freeze({ SESSION: "session", ARGUMENT: "argument" });

  const REGISTRY_STATUS_MISSING = "missing";
  const LINE_BREAK_TEXT = "\n";
  const MATH_WRAPPER_SELECTOR = "span.math-inline, span.math-block";
  const MATH_BLOCK_CLASS = "math-block";
  const WARNING_URL_CHARS = 80;
  const CAPTIONSETUP_PATTERN = /\\captionsetup\{[^}]*\}\n?/g;

  const HEADING_TAGS = Object.freeze(["h1", "h2", "h3", "h4", "h5", "h6"]);
  const CONTAINER_TAGS = Object.freeze(["div", "section", "article", "main", "header", "footer"]);
  const STRONG_TAGS = Object.freeze(["strong", "b"]);
  const EM_TAGS = Object.freeze(["em", "i"]);
  /** Inline elements whose text is kept as plain text (the element itself is flattened). */
  const INLINE_TAGS = Object.freeze([
    "span", "u", "mark", "sub", "sup", "code", "kbd", "small", "abbr", "cite", "q", "s", "del", "ins",
    "tt", "font", "bdi", "bdo", "wbr", "label", "time", "var", "samp", "dfn", "data",
  ]);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const tagOf = (el) => el.tagName.toLowerCase();

  /** Collapse runs of whitespace, as HTML rendering would. */
  const collapse = (text) => text.replace(/\s+/g, " ");

  function textInline(text, emphasis) {
    return { type: INLINE_TYPES.TEXT, text, emphasis: emphasis.slice() };
  }

  /** Merge neighbouring text inlines with the same emphasis and trim the ends of a run. */
  function tidyInlines(inlines) {
    const merged = [];
    for (const node of inlines) {
      const last = merged[merged.length - 1];
      const sameEmphasis = last && node.type === INLINE_TYPES.TEXT && last.type === INLINE_TYPES.TEXT &&
        last.emphasis.join() === node.emphasis.join();
      if (sameEmphasis && node.text !== LINE_BREAK_TEXT && last.text !== LINE_BREAK_TEXT) {
        last.text += node.text;
      } else {
        merged.push(node);
      }
    }
    if (merged.length && merged[0].type === INLINE_TYPES.TEXT) merged[0].text = merged[0].text.replace(/^\s+/, "");
    const end = merged[merged.length - 1];
    if (end && end.type === INLINE_TYPES.TEXT) end.text = end.text.replace(/\s+$/, "");
    return merged.filter((n) => n.type !== INLINE_TYPES.TEXT || n.text !== "");
  }

  /** True when a run holds something a reader would perceive (not only whitespace). */
  function hasContent(inlines) {
    return inlines.some((n) => n.type !== INLINE_TYPES.TEXT || n.text.trim() !== "");
  }

  // ============================================================================
  // INLINES
  // ============================================================================

  function mathInline(wrapper) {
    const latexEl = wrapper.querySelector("latex");
    // The first <math> that is not the library's assistive copy inside an mjx container.
    const mathEl = [...wrapper.querySelectorAll("math")].find((m) => !m.closest("mjx-assistive-mml"));
    return {
      type: INLINE_TYPES.MATH,
      latex: latexEl ? latexEl.textContent.trim() : "",
      mathml: mathEl ? mathEl.outerHTML : "",
      display: wrapper.classList.contains(MATH_BLOCK_CLASS),
    };
  }

  /** Inline nodes for one child of a run: a text node or an inline element. `ctx.flattened` collects flattened tags. */
  function inlinesOfChild(child, emphasis, ctx) {
    if (child.nodeType === Node.TEXT_NODE) return [textInline(collapse(child.nodeValue), emphasis)];
    if (child.nodeType !== Node.ELEMENT_NODE) return [];
    const tag = tagOf(child);
    if (child.matches(MATH_WRAPPER_SELECTOR)) return [mathInline(child)];
    if (tag === "br") return [textInline(LINE_BREAK_TEXT, emphasis)];
    if (tag === "a") {
      return [{ type: INLINE_TYPES.LINK, href: child.getAttribute("href") || "", inlines: tidyInlines(inlinesOf(child, emphasis, ctx)) }];
    }
    if (tag === "sub" || tag === "sup") {
      return [{ type: tag === "sub" ? INLINE_TYPES.SUB : INLINE_TYPES.SUP, inlines: tidyInlines(inlinesOf(child, emphasis, ctx)) }];
    }
    if (STRONG_TAGS.includes(tag)) {
      return inlinesOf(child, emphasis.includes(EMPHASIS.STRONG) ? emphasis : [...emphasis, EMPHASIS.STRONG], ctx);
    }
    if (EM_TAGS.includes(tag)) {
      return inlinesOf(child, emphasis.includes(EMPHASIS.EM) ? emphasis : [...emphasis, EMPHASIS.EM], ctx);
    }
    // Anything else inside a run (sub, sup, code, an unexpected element): keep its text, say so once.
    if (tag !== "span") ctx.flattened.add(tag);
    return inlinesOf(child, emphasis, ctx);
  }

  /** Inline nodes for the children of `parent`. */
  function inlinesOf(parent, emphasis, ctx) {
    const out = [];
    for (const child of parent.childNodes) out.push(...inlinesOfChild(child, emphasis, ctx));
    return out;
  }

  // ============================================================================
  // BLOCKS
  // ============================================================================

  /**
   * True when the session holds no image file for the entry: the registry says "missing", or it holds neither a blob
   * nor a data URI (a "cdn-linked" entry the ZIP carried no file for). Measured on kinetic-mathpix.zip (BR-2): both
   * entries are "cdn-linked" with no bytes, so the status alone would report them as present.
   */
  function fileIsMissing(entry) {
    if (entry.status === REGISTRY_STATUS_MISSING) return true;
    return !entry.blob && !entry.dataUri;
  }

  /**
   * One registry text field (an MMD string) as a flat inline list, with the same maths handling as body text.
   * The string goes through the same render and walk as the body; paragraphs are joined by a line-break text inline,
   * and a block that is not a paragraph or heading contributes its inlines too (lists, quotes), never silently dropped.
   * An empty string gives an empty list; a render failure gives an empty list and a warning.
   */
  function parseFieldInlines(text, ctx) {
    if (typeof text !== "string" || text.trim() === "") return [];
    let blocks;
    try {
      const html = window.markdownToHTML(text.replace(CAPTIONSETUP_PATTERN, ""), JSON.parse(JSON.stringify(ctx.renderOptions)));
      const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");
      window.MathPixMMDPreview.promoteParagraphs(doc.body);
      blocks = walkChildren(doc.body, ctx);
    } catch (e) {
      ctx.warnings.push("a figure text field could not be read as inline content");
      logDebug("field parse failed", String((e && e.message) || e).slice(0, 200));
      return [];
    }
    const out = [];
    const take = (list) => {
      for (const b of list) {
        if (b.inlines) {
          if (out.length) out.push(textInline(LINE_BREAK_TEXT, []));
          out.push(...b.inlines);
        } else if (b.type === NODE_TYPES.LIST) {
          b.items.forEach(take);
        } else if (b.type === NODE_TYPES.BLOCKQUOTE) {
          take(b.blocks);
        } else if (b.type === NODE_TYPES.UNKNOWN && b.text) {
          if (out.length) out.push(textInline(LINE_BREAK_TEXT, []));
          out.push(textInline(b.text, []));
        }
      }
    };
    take(blocks);
    return out;
  }

  function figureNode(img, ctx) {
    const src = img.getAttribute("src") || "";
    const entry = ctx.index.get(src) || null;
    if (!entry) {
      ctx.warnings.push(`figure with no registry match: ${src.substring(0, WARNING_URL_CHARS)}`);
      return {
        type: NODE_TYPES.FIGURE, id: null, url: src, caption: null, alt: null, longDescription: null, textInImage: null,
        captionInlines: [], altInlines: [], longDescriptionInlines: [], textInImageInlines: [], decorative: null, fileMissing: null,
      };
    }
    const caption = typeof entry.title === "string" ? entry.title : "";
    const alt = typeof entry.altText === "string" ? entry.altText : "";
    const longDescription = typeof entry.longDescription === "string" ? entry.longDescription : "";
    const textInImage = typeof entry.textInImage === "string" ? entry.textInImage : "";
    return {
      type: NODE_TYPES.FIGURE,
      id: entry.id,
      url: entry.originalUrl || src,
      caption,
      alt,
      longDescription,
      textInImage,
      captionInlines: parseFieldInlines(caption, ctx),
      altInlines: parseFieldInlines(alt, ctx),
      longDescriptionInlines: parseFieldInlines(longDescription, ctx),
      textInImageInlines: parseFieldInlines(textInImage, ctx),
      decorative: entry.decorative === true,
      fileMissing: fileIsMissing(entry),
    };
  }

  function tableNode(table, ctx) {
    const rows = [];
    let headerRows = 0;
    let stillHeader = true;
    for (const tr of table.querySelectorAll("tr")) {
      const cells = [...tr.children].filter((c) => ["td", "th"].includes(tagOf(c)));
      rows.push(cells.map((c) => tidyInlines(inlinesOf(c, [], ctx))));
      const inThead = !!tr.closest("thead");
      const allTh = cells.length > 0 && cells.every((c) => tagOf(c) === "th");
      if (stillHeader && (inThead || allTh)) headerRows += 1;
      else stillHeader = false;
    }
    return { type: NODE_TYPES.TABLE, rows, headerRows };
  }

  function listNode(list, ctx) {
    const items = [...list.children].filter((c) => tagOf(c) === "li").map((li) => walkChildren(li, ctx));
    return { type: NODE_TYPES.LIST, ordered: tagOf(list) === "ol", items };
  }

  /** Walk the children of `parent` into blocks. Inline runs between blocks become paragraphs. */
  function walkChildren(parent, ctx) {
    const blocks = [];
    let run = [];
    const flush = () => {
      const inlines = tidyInlines(run);
      run = [];
      if (hasContent(inlines)) blocks.push({ type: NODE_TYPES.PARAGRAPH, inlines });
    };

    for (const child of parent.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        run.push(textInline(collapse(child.nodeValue), []));
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = tagOf(child);

      if (child.matches(MATH_WRAPPER_SELECTOR) || tag === "br" || tag === "a" || STRONG_TAGS.includes(tag) || EM_TAGS.includes(tag) || INLINE_TAGS.includes(tag)) {
        run.push(...inlinesOfChild(child, [], ctx));
        continue;
      }

      flush();
      if (tag === "img") {
        blocks.push(figureNode(child, ctx));
      } else if (HEADING_TAGS.includes(tag)) {
        blocks.push({ type: NODE_TYPES.HEADING, level: Number(tag[1]), inlines: tidyInlines(inlinesOf(child, [], ctx)) });
      } else if (tag === "p" || tag === "figure" || CONTAINER_TAGS.includes(tag)) {
        blocks.push(...walkChildren(child, ctx));
      } else if (tag === "figcaption") {
        const inlines = tidyInlines(inlinesOf(child, [], ctx));
        if (hasContent(inlines)) blocks.push({ type: NODE_TYPES.PARAGRAPH, inlines });
      } else if (tag === "ul" || tag === "ol") {
        blocks.push(listNode(child, ctx));
      } else if (tag === "table") {
        blocks.push(tableNode(child, ctx));
      } else if (tag === "pre") {
        blocks.push({ type: NODE_TYPES.CODE, text: child.textContent });
      } else if (tag === "blockquote") {
        blocks.push({ type: NODE_TYPES.BLOCKQUOTE, blocks: walkChildren(child, ctx) });
      } else {
        // Kept, never dropped: the tag and its text.
        blocks.push({ type: NODE_TYPES.UNKNOWN, tag, text: collapse(child.textContent).trim() });
      }
    }
    flush();
    return blocks;
  }

  // ============================================================================
  // INPUT: the MMD, the strip, the registry index, the render
  // ============================================================================

  function getRestorer() {
    return typeof window.getMathPixSessionRestorer === "function" ? window.getMathPixSessionRestorer() : null;
  }

  function getPreview() {
    if (typeof window.getMathPixMMDPreview === "function") return window.getMathPixMMDPreview();
    return null;
  }

  /** Registry entries from an array, a registry-like object, or (when omitted) the session's own registry. */
  function entriesFrom(registry, restorer) {
    if (Array.isArray(registry)) return registry;
    if (registry && typeof registry.getAllImages === "function") return registry.getAllImages();
    return restorer?.imageRegistry?.getAllImages?.() || [];
  }

  /**
   * src -> registry entry, matched by the FULL URL. Two key families, because the working MMD can carry either:
   * the entry's CDN URL (its identity) and the blob URL the session restorer made for it.
   */
  function buildIndex(entries, restorer) {
    const index = new Map();
    for (const entry of entries) {
      if (typeof entry.originalUrl === "string" && entry.originalUrl) index.set(entry.originalUrl, entry);
    }
    const blobMap = restorer?.imageBlobUrlMap;
    if (blobMap && typeof blobMap[Symbol.iterator] === "function") {
      for (const [cdnUrl, blobUrl] of blobMap) {
        const entry = entries.find((e) => e.originalUrl === cdnUrl);
        if (blobUrl && entry) index.set(blobUrl, entry);
      }
    }
    return index;
  }

  /** Strip the long-description appendix with the restorer's own strip. Never copies its logic. */
  function stripAppendix(mmd, restorer, warnings) {
    if (typeof restorer?._stripLongDescriptionAppendix === "function") {
      return restorer._stripLongDescriptionAppendix(mmd).mmd;
    }
    warnings.push("appendix strip unavailable: the session restorer was not found, so the appendix is left in place");
    return mmd;
  }

  function countTypes(blocks, counts) {
    for (const b of blocks) {
      counts[b.type] = (counts[b.type] || 0) + 1;
      if (b.type === NODE_TYPES.LIST) b.items.forEach((item) => countTypes(item, counts));
      if (b.type === NODE_TYPES.BLOCKQUOTE) countTypes(b.blocks, counts);
    }
    return counts;
  }

  /** Every heading in the tree, in order, including those inside lists and quotes. */
  function collectHeadings(blocks, out) {
    for (const b of blocks) {
      if (b.type === NODE_TYPES.HEADING) out.push(b);
      if (b.type === NODE_TYPES.LIST) b.items.forEach((item) => collectHeadings(item, out));
      if (b.type === NODE_TYPES.BLOCKQUOTE) collectHeadings(b.blocks, out);
    }
    return out;
  }

  /**
   * Give each heading a rank: its position among the DISTINCT heading levels present, 1 for the highest (smallest
   * level number). A document that uses only h3 and h5 has ranks 1 and 2. The level is kept beside it.
   */
  function assignHeadingRanks(blocks) {
    const headings = collectHeadings(blocks, []);
    const levels = [...new Set(headings.map((h) => h.level))].sort((a, b) => a - b);
    for (const h of headings) h.rank = levels.indexOf(h.level) + 1;
  }

  function countMath(blocks) {
    let total = 0;
    const inInlines = (inlines) => inlines.forEach((n) => {
      if (n.type === INLINE_TYPES.MATH) total += 1;
      if (n.inlines) inInlines(n.inlines);
    });
    const inBlocks = (list) => list.forEach((b) => {
      if (b.inlines) inInlines(b.inlines);
      if (b.type === NODE_TYPES.LIST) b.items.forEach(inBlocks);
      if (b.type === NODE_TYPES.BLOCKQUOTE) inBlocks(b.blocks);
      if (b.type === NODE_TYPES.TABLE) b.rows.forEach((row) => row.forEach(inInlines));
    });
    inBlocks(blocks);
    return total;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Build the document tree.
   * @param {object} [options]
   * @param {string} [options.mmd] - MMD to read; omitted = the current session MMD (restorer.getCurrentMMDContent)
   * @param {Array|object} [options.registry] - registry entries, or an object with getAllImages(); omitted = the session registry
   * @returns {Promise<{blocks: object[], warnings: string[], meta: object}>}
   */
  async function build({ mmd, registry } = {}) {
    const t0 = performance.now();
    const restorer = getRestorer();
    const warnings = [];
    const source = typeof mmd === "string" ? SOURCE.ARGUMENT : SOURCE.SESSION;
    const rawMmd = typeof mmd === "string" ? mmd : restorer?.getCurrentMMDContent?.();
    if (typeof rawMmd !== "string" || rawMmd === "") {
      throw new Error("MathPixDocumentTree.build: there is no MMD to read.");
    }

    const preview = getPreview();
    if (!preview) throw new Error("MathPixDocumentTree.build: the MMD preview is not available.");
    // build() never loads the library: loading it makes the live preview re-render, which is a write.
    if (typeof window.markdownToHTML !== "function") {
      throw new Error("MathPixDocumentTree.build: the markdown renderer has not loaded. Call ensureReady() first.");
    }

    const stripped = stripAppendix(rawMmd, restorer, warnings);
    const prepared = preview._stripFigureAltOptions(stripped).replace(CAPTIONSETUP_PATTERN, "");
    // A copy of the options, so the library can never write back into the preview's config.
    const options = JSON.parse(JSON.stringify(preview.config.RENDER_OPTIONS));
    const html = window.markdownToHTML(prepared, options);

    // DOMParser: an inert document, so no image loads and nothing is inserted into the page.
    const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");
    window.MathPixMMDPreview.promoteParagraphs(doc.body);

    const ctx = {
      index: buildIndex(entriesFrom(registry, restorer), restorer), warnings, flattened: new Set(), renderOptions: options,
    };
    const blocks = walkChildren(doc.body, ctx);
    ctx.flattened.forEach((tag) => warnings.push(`inline element ${tag} was flattened to its text`));
    assignHeadingRanks(blocks);

    const blockCounts = countTypes(blocks, {});
    const tree = {
      blocks,
      warnings,
      meta: {
        source,
        blockCounts,
        mathCount: countMath(blocks),
        figureCount: blockCounts[NODE_TYPES.FIGURE] || 0,
        builtMs: Math.round(performance.now() - t0),
      },
    };
    logDebug("Document tree built", tree.meta);
    return tree;
  }

  /**
   * Load the markdown renderer if it is not loaded yet. Separate from build() on purpose: the library loads lazily,
   * and its load makes the live preview re-render, so it is the one step here that is not read-only.
   * @returns {Promise<boolean>} true when window.markdownToHTML is available
   */
  async function ensureReady() {
    const preview = getPreview();
    if (!preview) return false;
    if (!preview.isReady()) await preview.loadLibrary();
    return typeof window.markdownToHTML === "function";
  }

  window.MathPixDocumentTree = Object.freeze({ build, ensureReady, NODE_TYPES, INLINE_TYPES });
  logInfo("MathPixDocumentTree registered");
})();
