/**
 * @fileoverview Stage 2 renderer-behaviour probe for the image-manager
 *   alt-text long-description appendix feature.
 * @module Stage2RendererProbe
 * @version 1.0.0
 *
 * @description
 * Read-only probe that asks the live mathpix-markdown-it renderer (loaded
 * from CDN, exposed at window.markdownToHTML) three questions whose answers
 * inform the Stage 2 appendix design:
 *
 *   1. Do HTML comments survive rendering as invisible comment nodes?
 *      (Relevant if we want to embed registry-id markers in the appendix.)
 *
 *   2. Does markdown footnote syntax produce navigable footnote markup
 *      and a back-link? (Relevant as an alternative to a heading-based
 *      appendix.)
 *
 *   3. Are headings given auto-generated id attributes? (Relevant for
 *      heading-list navigation by screen-reader users.)
 *
 * This file performs NO production code changes and writes nothing back to
 * any registry. It only renders three small MMD inputs through the existing
 * renderer and reports what it finds. Run from the browser console after
 * switching to the Mathpix tab so the renderer is loaded.
 *
 * @see mathpix-scripts/docs/alt-text/image-manager-alt-text-stage2-renderer-investigation.md
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
  function logError(msg, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[Stage2RendererProbe] ${msg}`, ...args);
  }
  function logWarn(msg, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[Stage2RendererProbe] ${msg}`, ...args);
  }
  function logInfo(msg, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[Stage2RendererProbe] ${msg}`, ...args);
  }
  function logDebug(msg, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[Stage2RendererProbe] ${msg}`, ...args);
  }

  // ============================================================================
  // RENDERER METADATA (sourced from read pass — see investigation report)
  // ============================================================================

  const RENDERER_INFO = {
    name: "mathpix-markdown-it",
    version: "2.0.6",
    cdnUrl:
      "https://cdn.jsdelivr.net/npm/mathpix-markdown-it@2.0.6/es5/bundle.js",
    api: "window.markdownToHTML(mmd, options)",
    async: false,
    globalName: "window.markdownToHTML",
  };

  // ============================================================================
  // RENDER OPTIONS
  // ============================================================================

  /**
   * Build the render options object. Mirrors the project's production
   * RENDER_OPTIONS (MATHPIX_CONFIG.MMD_PREVIEW.RENDER_OPTIONS) when the config
   * is loaded; falls back to a literal copy otherwise so the probe can run
   * outside the MathPix tab if the renderer happens to be present.
   *
   * @returns {Object} Render options object passed to window.markdownToHTML
   */
  function getRenderOptions() {
    try {
      if (
        typeof MATHPIX_CONFIG !== "undefined" &&
        MATHPIX_CONFIG &&
        MATHPIX_CONFIG.MMD_PREVIEW &&
        MATHPIX_CONFIG.MMD_PREVIEW.RENDER_OPTIONS
      ) {
        logDebug("Using MATHPIX_CONFIG.MMD_PREVIEW.RENDER_OPTIONS");
        return MATHPIX_CONFIG.MMD_PREVIEW.RENDER_OPTIONS;
      }
    } catch (e) {
      // fall through
    }
    logDebug("Falling back to literal RENDER_OPTIONS copy");
    return {
      htmlTags: true,
      mmdExtensions: { smiles: true },
      accessibility: { assistiveMml: true },
      outMath: {
        include_asciimath: true,
        include_latex: true,
        include_mathml: true,
        include_svg: true,
        include_table_html: true,
        include_error: true,
      },
    };
  }

  // ============================================================================
  // PROBE INPUTS
  // ============================================================================

  const PROBE_1_MMD =
    "Some content here.\n\n" +
    "<!-- img-desc-abc123 -->\n\n" +
    "## Long description for image abc123\n\n" +
    "A description goes here.";

  const PROBE_2_MMD =
    "Some text with a marker[^abc].\n\n" +
    "[^abc]: This is the long description for image abc, written as a " +
    "footnote so it appears at the end of the rendered document.";

  const PROBE_3_MMD =
    "Some intro content.\n\n" +
    "## Long descriptions\n\n" +
    "### Description for image abc123\n\n" +
    "A description goes here as a paragraph under a heading.";

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Parse an HTML string into a throwaway container element so we can walk it
   * with the DOM API. Uses a detached <div> rather than DOMParser so any
   * partial / fragment HTML returned by the renderer parses without wrapping.
   *
   * @param {string} html - HTML string to parse
   * @returns {HTMLDivElement} Detached div containing the parsed nodes
   */
  function parseHTMLFragment(html) {
    const container = document.createElement("div");
    container.innerHTML = html || "";
    return container;
  }

  /**
   * Walk a DOM subtree and collect every comment node's text.
   *
   * @param {Node} root - DOM root to walk
   * @returns {string[]} Array of comment-node text contents (data property)
   */
  function collectCommentTexts(root) {
    const found = [];
    if (!root || typeof document.createTreeWalker !== "function") return found;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT, null);
    let node = walker.nextNode();
    while (node) {
      found.push(node.data);
      node = walker.nextNode();
    }
    return found;
  }

  // ============================================================================
  // PROBES
  // ============================================================================

  /**
   * Probe 1 — HTML comment survival.
   *
   * Question: does an HTML comment in the source MMD survive rendering as
   * an invisible comment node in the output, or does it get escaped into
   * visible text (or stripped entirely)?
   *
   * @param {Function} render - Bound renderer function
   * @returns {Object} Probe result with name, mmd, html, findings
   */
  function probeCommentSurvival(render) {
    let html = "";
    let error = null;
    try {
      html = render(PROBE_1_MMD);
    } catch (e) {
      error = e && e.message ? e.message : String(e);
      logError("Probe 1 render failed:", error);
    }

    const container = parseHTMLFragment(html);
    const commentTexts = collectCommentTexts(container);
    const markerInComments = commentTexts.some((t) =>
      t.includes("img-desc-abc123"),
    );

    // Visible text content (no comments, no tags) — looking for the literal
    // marker string. If it appears here, the comment was escaped/inlined
    // rather than preserved as a comment node.
    const visibleText = container.textContent || "";
    const markerInVisibleText = visibleText.includes("img-desc-abc123");

    // Also report whether the raw HTML string literally contains the
    // <!-- ... --> marker, since some pipelines preserve comments verbatim
    // even when our DOM parser elides them.
    const markerInRawHTML = (html || "").indexOf("img-desc-abc123") !== -1;
    const rawHasCommentSyntax =
      (html || "").indexOf("<!--") !== -1 && (html || "").indexOf("-->") !== -1;

    return {
      name: "Probe 1 — HTML comment survival",
      mmd: PROBE_1_MMD,
      html,
      findings: {
        renderError: error,
        commentNodeCount: commentTexts.length,
        commentTexts,
        markerInCommentNode: markerInComments,
        markerInVisibleText,
        markerInRawHTML,
        rawHasCommentSyntax,
        interpretation: error
          ? "Render failed — see renderError."
          : markerInComments
            ? "Comment preserved as invisible comment node — usable as parser marker."
            : markerInVisibleText
              ? "Comment text leaked into visible content — NOT safe as invisible marker."
              : rawHasCommentSyntax && markerInRawHTML
                ? "Comment present in raw HTML string but did not parse as a DOM comment node — review."
                : "Comment removed entirely — cannot be used as a marker.",
      },
    };
  }

  /**
   * Probe 2 — Markdown footnote.
   *
   * Question: does the renderer support standard markdown footnote syntax,
   * and if so, what does the resulting markup look like?
   *
   * @param {Function} render - Bound renderer function
   * @returns {Object} Probe result with name, mmd, html, findings
   */
  function probeFootnotes(render) {
    let html = "";
    let error = null;
    try {
      html = render(PROBE_2_MMD);
    } catch (e) {
      error = e && e.message ? e.message : String(e);
      logError("Probe 2 render failed:", error);
    }

    const container = parseHTMLFragment(html);

    // Common patterns: rendered footnotes typically wrap in <section
    // class="footnotes">, <aside class="footnote">, <ol class="footnotes">,
    // or expose a class containing "footnote". The marker is usually an
    // <a href="#..."> inside a <sup>, and the back-link uses a class like
    // "footnote-backref" or a href fragment ending in ":back".
    const footnoteContainer = container.querySelector(
      'section.footnotes, aside.footnotes, ol.footnotes, .footnotes',
    );
    const footnoteRefSup = container.querySelector("sup");
    const footnoteRefAnchor = container.querySelector(
      'sup a[href^="#"], a.footnote-ref, a[href^="#fn"]',
    );
    const backlink = container.querySelector(
      'a.footnote-backref, a[href*="fnref"], a[href$=":back"]',
    );

    // If the marker text "[^abc]" appears literally in visible output, the
    // footnote syntax was not interpreted at all.
    const literalUnparsed =
      (container.textContent || "").indexOf("[^abc]") !== -1;

    const markerHref =
      footnoteRefAnchor && footnoteRefAnchor.getAttribute
        ? footnoteRefAnchor.getAttribute("href")
        : null;
    const backlinkHref =
      backlink && backlink.getAttribute ? backlink.getAttribute("href") : null;

    return {
      name: "Probe 2 — Markdown footnote",
      mmd: PROBE_2_MMD,
      html,
      findings: {
        renderError: error,
        literalSyntaxLeaked: literalUnparsed,
        footnoteContainerFound: !!footnoteContainer,
        footnoteContainerTag: footnoteContainer
          ? footnoteContainer.tagName.toLowerCase()
          : null,
        footnoteContainerClass: footnoteContainer
          ? footnoteContainer.className || null
          : null,
        markerInSup: !!footnoteRefSup,
        markerIsAnchor: !!footnoteRefAnchor,
        markerHref,
        backlinkPresent: !!backlink,
        backlinkHref,
        interpretation: error
          ? "Render failed — see renderError."
          : literalUnparsed
            ? "Footnote syntax NOT parsed — appeared as literal text. Footnotes likely disabled in this build."
            : footnoteContainer && footnoteRefAnchor
              ? "Footnotes work — marker is an anchor, container present. Viable Stage 2 candidate."
              : footnoteRefAnchor
                ? "Marker became an anchor but no recognised footnote container found — partial support."
                : "No footnote markup detected.",
      },
    };
  }

  /**
   * Probe 3 — Heading auto-anchoring.
   *
   * Question: does the renderer add id attributes to headings automatically?
   * This determines whether sighted users can navigate to a heading-based
   * appendix via the document outline / browser anchor links.
   *
   * @param {Function} render - Bound renderer function
   * @returns {Object} Probe result with name, mmd, html, findings
   */
  function probeHeadingAnchors(render) {
    let html = "";
    let error = null;
    try {
      html = render(PROBE_3_MMD);
    } catch (e) {
      error = e && e.message ? e.message : String(e);
      logError("Probe 3 render failed:", error);
    }

    const container = parseHTMLFragment(html);
    const h2 = container.querySelector("h2");
    const h3 = container.querySelector("h3");

    const h2Id = h2 ? h2.getAttribute("id") : null;
    const h3Id = h3 ? h3.getAttribute("id") : null;

    // Sometimes anchoring is done by an inserted child <a id="..."> rather
    // than an id on the heading itself. Capture that too.
    const h2InnerAnchorId =
      h2 && h2.querySelector("a[id]") ? h2.querySelector("a[id]").id : null;
    const h3InnerAnchorId =
      h3 && h3.querySelector("a[id]") ? h3.querySelector("a[id]").id : null;

    const anyAnchoring = !!(h2Id || h3Id || h2InnerAnchorId || h3InnerAnchorId);

    return {
      name: "Probe 3 — Heading auto-anchoring",
      mmd: PROBE_3_MMD,
      html,
      findings: {
        renderError: error,
        h2Present: !!h2,
        h2Id,
        h2InnerAnchorId,
        h3Present: !!h3,
        h3Id,
        h3InnerAnchorId,
        interpretation: error
          ? "Render failed — see renderError."
          : anyAnchoring
            ? "Headings receive auto-generated anchors — outline navigation by id is possible."
            : "Headings have NO auto-generated ids — outline navigation by id is not available out of the box.",
      },
    };
  }

  // ============================================================================
  // PUBLIC RUNNER
  // ============================================================================

  /**
   * Run all three probes and return a structured report.
   *
   * @returns {Object} Structured probe report. If the renderer is not loaded,
   *   returns { error: string } instead of throwing.
   */
  function testStage2RendererProbe() {
    logInfo("Stage 2 renderer probe starting");

    if (typeof window.markdownToHTML !== "function") {
      const msg =
        "Renderer not available — switch to the Mathpix tab and re-run";
      logWarn(msg);
      return { error: msg };
    }

    const options = getRenderOptions();
    logDebug("Render options:", options);

    // Bind the renderer once so each probe can call it with a single arg.
    const render = function (mmd) {
      return window.markdownToHTML(mmd, options);
    };

    const probes = [
      probeCommentSurvival(render),
      probeFootnotes(render),
      probeHeadingAnchors(render),
    ];

    const summary = {
      commentsSurviveInvisibly: !!(
        probes[0].findings &&
        probes[0].findings.markerInCommentNode &&
        !probes[0].findings.markerInVisibleText
      ),
      footnotesWork: !!(
        probes[1].findings &&
        probes[1].findings.footnoteContainerFound &&
        probes[1].findings.markerIsAnchor &&
        !probes[1].findings.literalSyntaxLeaked
      ),
      headingsAutoAnchored: !!(
        probes[2].findings &&
        (probes[2].findings.h2Id ||
          probes[2].findings.h3Id ||
          probes[2].findings.h2InnerAnchorId ||
          probes[2].findings.h3InnerAnchorId)
      ),
    };

    const result = {
      renderer: {
        name: RENDERER_INFO.name,
        version: RENDERER_INFO.version,
        api: RENDERER_INFO.api,
        async: RENDERER_INFO.async,
      },
      probes,
      summary,
    };

    logInfo("Stage 2 renderer probe complete", summary);
    return result;
  }

  // ============================================================================
  // GLOBAL EXPOSURE
  // ============================================================================

  window.testStage2RendererProbe = testStage2RendererProbe;
  logDebug("window.testStage2RendererProbe registered");
})();
