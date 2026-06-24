/**
 * @fileoverview Ally Statement Preview - Word (.docx) export
 * @module AllyStatementPreviewDocx
 * @version 1.0.0
 *
 * @description
 * Generates a genuine Microsoft Word document (.docx) from a rendered
 * Accessibility Statement Preview fragment, with REAL Word heading styles.
 *
 * Why this exists: bare HTML <h3>/<h4> tags pasted into Word appear in the
 * navigation outline but keep paragraph style "Normal" - they do not become
 * Word's built-in Heading styles. Producing a real .docx (via the dolanmiu
 * "docx" library) is the only reliable way to get genuine Heading 1/2 styles
 * that also survive in Google Docs and LibreOffice.
 *
 * The library is lazy-loaded from a CDN on first use, so the ~600KB bundle is
 * not loaded for every visit to tools.html.
 *
 * Public API:
 *   ALLY_STATEMENT_PREVIEW_DOCX.isAvailable()          -> boolean
 *   ALLY_STATEMENT_PREVIEW_DOCX.ensureLibraryLoaded()  -> Promise<void>
 *   ALLY_STATEMENT_PREVIEW_DOCX.download(node, meta)    -> Promise<boolean>
 */

const ALLY_STATEMENT_PREVIEW_DOCX = (function () {
  "use strict";

  // ========================================================================
  // Logging Configuration (IIFE-scoped)
  // ========================================================================

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
      console.error("[AllyStatementPreviewDocx] " + message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[AllyStatementPreviewDocx] " + message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[AllyStatementPreviewDocx] " + message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[AllyStatementPreviewDocx] " + message, ...args);
  }

  // ========================================================================
  // Configuration
  // ========================================================================

  // dolanmiu/docx 8.5.0 - UMD bundle exposes the global `docx`.
  const DOCX_CDN_URL =
    "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js";
  const LOAD_TIMEOUT_MS = 20000;

  let loadPromise = null;

  // ------------------------------------------------------------------
  // Document styling (University of Southampton brand)
  // ------------------------------------------------------------------
  // Colours are hex without '#'. Sizes are in half-points (22 = 11pt).
  // These override Word's built-in Normal/Title/Heading styles inside the
  // generated file - they do NOT come from the user's Normal template, which
  // Word only applies to new blank documents, never to an existing .docx.
  const FONT = "Aptos";
  const HEADING_COLOUR = "002E3B"; // brand dark teal
  const TEXT_COLOUR = "231F20"; // brand near-black

  // Override Word's BUILT-IN styles via `default` (not `paragraphStyles`,
  // which only adds custom styles and leaves the stock Heading colours intact).
  const DOCUMENT_STYLES = {
    default: {
      document: {
        run: { font: FONT, size: 22, color: TEXT_COLOUR },
        paragraph: { spacing: { line: 276, after: 120 } },
      },
      title: {
        run: { font: FONT, size: 36, bold: true, color: HEADING_COLOUR },
        paragraph: { spacing: { after: 240 } },
      },
      heading1: {
        run: { font: FONT, size: 32, bold: true, color: HEADING_COLOUR },
        paragraph: { spacing: { before: 240, after: 120 } },
      },
      heading2: {
        run: { font: FONT, size: 26, bold: true, color: HEADING_COLOUR },
        paragraph: { spacing: { before: 200, after: 120 } },
      },
    },
  };

  // ========================================================================
  // Library Loading
  // ========================================================================

  /**
   * Whether the docx library is already present.
   * @returns {boolean}
   */
  function isAvailable() {
    return typeof window.docx !== "undefined";
  }

  /**
   * Lazily injects the docx CDN script once and resolves when ready.
   * The promise is cached so concurrent/repeat calls share one load.
   * @returns {Promise<void>}
   */
  function ensureLibraryLoaded() {
    if (isAvailable()) {
      return Promise.resolve();
    }

    if (loadPromise) {
      return loadPromise;
    }

    loadPromise = new Promise(function (resolve, reject) {
      let settled = false;

      const timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        loadPromise = null;
        reject(new Error("Timed out loading the Word export library"));
      }, LOAD_TIMEOUT_MS);

      const script = document.createElement("script");
      script.src = DOCX_CDN_URL;
      script.async = true;
      script.setAttribute("data-ally-docx", "");

      script.onload = function () {
        if (settled) return;
        clearTimeout(timer);
        if (isAvailable()) {
          settled = true;
          logInfo("docx library loaded");
          resolve();
        } else {
          settled = true;
          loadPromise = null;
          reject(new Error("docx global not found after load"));
        }
      };

      script.onerror = function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        loadPromise = null;
        reject(new Error("Failed to load the Word export library"));
      };

      document.head.appendChild(script);
      logDebug("Injected docx CDN script:", DOCX_CDN_URL);
    });

    return loadPromise;
  }

  // ========================================================================
  // DOM -> docx Conversion
  // ========================================================================

  /**
   * Whether an element is decorative/structural noise to omit from the doc.
   * @param {Element} el
   * @returns {boolean}
   */
  function shouldSkip(el) {
    return (
      el.getAttribute("aria-hidden") === "true" ||
      el.hasAttribute("data-icon") ||
      el.tagName.toLowerCase() === "svg"
    );
  }

  /**
   * Collects inline runs (TextRun / ExternalHyperlink) from an element's
   * inline content. Block children (ul/ol) are NOT descended - the list
   * branch handles those separately.
   * @param {Element} el - Block element (heading, paragraph, or li label)
   * @returns {Array} Array of docx run objects
   */
  function inlineRuns(el) {
    const runs = [];
    pushInline(el, runs, {});
    if (runs.length === 0) {
      // docx requires at least something; emit an empty run
      runs.push(new window.docx.TextRun(""));
    }
    return runs;
  }

  /**
   * Recursively appends inline runs for a node's children.
   * @param {Node} node - Parent node to walk
   * @param {Array} runs - Accumulator
   * @param {Object} fmt - Inherited formatting {bold, italics}
   */
  function pushInline(node, runs, fmt) {
    node.childNodes.forEach(function (child) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = (child.textContent || "").replace(/\s+/g, " ");
        if (text.trim()) {
          runs.push(
            new window.docx.TextRun({
              text: text,
              bold: fmt.bold,
              italics: fmt.italics,
            }),
          );
        }
        return;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) return;
      if (shouldSkip(child)) return;

      const tag = child.tagName.toLowerCase();

      // Block-level children are handled by the list/paragraph branches
      if (tag === "ul" || tag === "ol") return;

      if (tag === "a") {
        const href = child.getAttribute("href");
        const text = (child.textContent || "").replace(/\s+/g, " ").trim();
        if (href && href.trim()) {
          runs.push(
            new window.docx.ExternalHyperlink({
              link: href.trim(),
              children: [
                new window.docx.TextRun({ text: text, style: "Hyperlink" }),
              ],
            }),
          );
        } else if (text) {
          runs.push(
            new window.docx.TextRun({
              text: text,
              bold: fmt.bold,
              italics: fmt.italics,
            }),
          );
        }
        return;
      }

      if (tag === "strong" || tag === "b") {
        pushInline(child, runs, Object.assign({}, fmt, { bold: true }));
        return;
      }

      if (tag === "em" || tag === "i") {
        pushInline(child, runs, Object.assign({}, fmt, { italics: true }));
        return;
      }

      // span and any other inline wrapper: descend, keep formatting
      pushInline(child, runs, fmt);
    });
  }

  /**
   * Builds bullet paragraphs for a list element (and nested lists).
   * @param {Element} listEl - ul or ol element
   * @param {number} depth - Bullet nesting level (0-based)
   * @param {Array} out - Accumulator of docx.Paragraph
   */
  function collectList(listEl, depth, out) {
    listEl.childNodes.forEach(function (child) {
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      if (child.tagName.toLowerCase() !== "li") return;

      out.push(
        new window.docx.Paragraph({
          bullet: { level: depth },
          children: inlineRuns(child),
        }),
      );

      // Nested lists live inside the <li>
      child.childNodes.forEach(function (grand) {
        if (
          grand.nodeType === Node.ELEMENT_NODE &&
          (grand.tagName.toLowerCase() === "ul" ||
            grand.tagName.toLowerCase() === "ol")
        ) {
          collectList(grand, depth + 1, out);
        }
      });
    });
  }

  /**
   * Walks a fragment node, appending docx.Paragraph objects to `out`.
   * h3 -> Heading 1, h4 -> Heading 2, p -> normal, ul/ol -> bullets.
   * @param {Node} node - Node to walk
   * @param {Array} out - Accumulator of docx.Paragraph
   */
  function collectParagraphs(node, out) {
    node.childNodes.forEach(function (child) {
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      if (shouldSkip(child)) return;

      const tag = child.tagName.toLowerCase();

      if (tag === "h3") {
        out.push(
          new window.docx.Paragraph({
            heading: window.docx.HeadingLevel.HEADING_1,
            children: inlineRuns(child),
          }),
        );
        return;
      }

      if (tag === "h4") {
        out.push(
          new window.docx.Paragraph({
            heading: window.docx.HeadingLevel.HEADING_2,
            children: inlineRuns(child),
          }),
        );
        return;
      }

      if (tag === "h1" || tag === "h2" || tag === "h5" || tag === "h6") {
        // Fallback for any other heading level - treat as Heading 2
        out.push(
          new window.docx.Paragraph({
            heading: window.docx.HeadingLevel.HEADING_2,
            children: inlineRuns(child),
          }),
        );
        return;
      }

      if (tag === "p") {
        out.push(new window.docx.Paragraph({ children: inlineRuns(child) }));
        return;
      }

      if (tag === "ul" || tag === "ol") {
        collectList(child, 0, out);
        return;
      }

      // Block container (section, div, etc.): descend
      collectParagraphs(child, out);
    });
  }

  // ========================================================================
  // Download
  // ========================================================================

  /**
   * Produces a safe filename from metadata.
   * @param {Object} meta - {courseCode, courseName}
   * @returns {string} Filename ending in .docx
   */
  function buildFilename(meta) {
    const base =
      (meta && (meta.courseCode || meta.courseName)) || "course";
    const safe = String(base)
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return "Accessibility-statement-" + (safe || "course") + ".docx";
  }

  /**
   * Triggers a browser download of a Blob.
   * @param {Blob} blob
   * @param {string} filename
   */
  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /**
   * Generates and downloads a .docx from a rendered statement fragment.
   * @param {Node} fragmentNode - The cloned/sanitised statement fragment
   * @param {Object} [meta] - {courseName, courseCode} for title + filename
   * @returns {Promise<boolean>} Resolves true on success
   */
  async function download(fragmentNode, meta) {
    if (!fragmentNode) {
      throw new Error("No content to export");
    }

    await ensureLibraryLoaded();

    const docx = window.docx;
    meta = meta || {};

    const paragraphs = [];

    if (meta.courseName) {
      paragraphs.push(
        new docx.Paragraph({
          heading: docx.HeadingLevel.TITLE,
          text: "Accessibility statement: " + meta.courseName,
        }),
      );
    }

    collectParagraphs(fragmentNode, paragraphs);

    if (paragraphs.length === 0) {
      throw new Error("Nothing to export");
    }

    logDebug("Building docx with " + paragraphs.length + " paragraphs");

    const doc = new docx.Document({
      styles: DOCUMENT_STYLES,
      sections: [{ children: paragraphs }],
    });

    const blob = await docx.Packer.toBlob(doc);
    triggerDownload(blob, buildFilename(meta));

    logInfo("Word document generated and download triggered");
    return true;
  }

  // ========================================================================
  // Public API
  // ========================================================================

  return {
    isAvailable: isAvailable,
    ensureLibraryLoaded: ensureLibraryLoaded,
    download: download,
  };
})();

// ========================================================================
// Console Test Function
// ========================================================================

window.testAllyStatementPreviewDocx = function () {
  console.group("ALLY_STATEMENT_PREVIEW_DOCX Tests");

  let passed = 0;
  let failed = 0;

  function test(name, condition) {
    if (condition) {
      console.log("✓ " + name);
      passed++;
    } else {
      console.error("✗ " + name);
      failed++;
    }
  }

  test(
    "ALLY_STATEMENT_PREVIEW_DOCX exists",
    typeof ALLY_STATEMENT_PREVIEW_DOCX === "object",
  );
  test(
    "has isAvailable method",
    typeof ALLY_STATEMENT_PREVIEW_DOCX.isAvailable === "function",
  );
  test(
    "has ensureLibraryLoaded method",
    typeof ALLY_STATEMENT_PREVIEW_DOCX.ensureLibraryLoaded === "function",
  );
  test(
    "has download method",
    typeof ALLY_STATEMENT_PREVIEW_DOCX.download === "function",
  );
  test(
    "isAvailable returns a boolean",
    typeof ALLY_STATEMENT_PREVIEW_DOCX.isAvailable() === "boolean",
  );

  console.log(
    "%cResults: " + passed + " passed, " + failed + " failed",
    failed === 0 ? "color: green; font-weight: bold" : "color: red; font-weight: bold",
  );
  console.groupEnd();

  return { passed: passed, failed: failed };
};
