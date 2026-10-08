// ─── MathPixDocxHeadings ─────────────────────────────────────────────────────
// window.MathPixDocxHeadings — gives the headings in a Convert API docx real
// Word heading styles (Heading1 to Heading6), so the Navigation pane and a
// screen reader see the document's structure. The API writes headings as
// bold, large direct formatting on Normal paragraphs, with no w:pStyle.
//
// Grounding: HW-0 (.claude/measurements/hw-0-headings-word/HW-0-record.md).
// Heading-shaped paragraphs are bold in every non-empty run with w:sz 56, 42,
// 33, 28, 23 or 19 (levels 1 to 6); the MMD heading sequence aligns with them in order,
// level and text. The regex set and text normalisation below are HW-0's, so
// its committed alignment stays the reference.
//
// HW-1b wires it into the post-await block of the Resume-mode conversion
// (session-restorer-convert.js, _runApiConvertFormats). Fail safe throughout: any
// mismatch or error returns null, or resolves the ORIGINAL blob unchanged.
//
// XML is edited with string operations only. A DOM serialiser can rewrite
// namespace declarations and self-closing tags; HW-0 proved the round trip on
// untouched bytes, so only the inserted w:pStyle and w:style text changes.
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
      console.error("[DocxHeadings]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[DocxHeadings]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[DocxHeadings]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[DocxHeadings]", message, ...args);
  }

  // =========================================================================
  // Constants
  // =========================================================================

  const DOCX_MIME =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  /** MMD heading rules, as HW-0's probe. "^# " cannot match "## x". */
  const HEADING_RULES = Object.freeze([
    { level: 1, re: /^# (.*)$/ },
    { level: 1, re: /^\\title\{(.*)\}\s*$/ },
    { level: 2, re: /^## (.*)$/ },
    { level: 2, re: /^\\section\*?\{(.*)\}\s*$/ },
    { level: 3, re: /^### (.*)$/ },
    // HW-1c: the star is optional. Measured: the numbered \subsection{} and
    // \subsubsection{} both arrive as headings ("1.1. ..."), sized as starred.
    { level: 3, re: /^\\subsection\*?\{(.*)\}\s*$/ },
    { level: 4, re: /^#### (.*)$/ },
    { level: 4, re: /^\\subsubsection\*?\{(.*)\}\s*$/ },
    { level: 5, re: /^##### (.*)$/ },
    { level: 6, re: /^###### (.*)$/ },
    // \paragraph{} and \subparagraph{} are NOT here: measured, the API writes
    // them as literal plain text, not as headings.
  ]);

  /**
   * Docx half-point size to heading level, every level MEASURED on a real
   * Convert docx (HW-0 for 56, 42, 33; HW-1c for 28, 23, 19, from a synthetic
   * document carrying every heading form,
   * .claude/measurements/hw-1c-word-checkpoint/levels.mmd). Markdown has six
   * heading levels, so this covers all of them. HW-0 had read a size-28
   * paragraph as a bold non-heading; it was "#### Text in the image".
   */
  const SIZE_TO_LEVEL = Object.freeze({ 56: 1, 42: 2, 33: 3, 28: 4, 23: 5, 19: 6 });

  /** Heading level to Word outline level (0-based). */
  const LEVEL_TO_OUTLINE = Object.freeze({ 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 });

  /** Every level the map can style, in order. */
  const HEADING_LEVELS = Object.freeze([1, 2, 3, 4, 5, 6]);

  // Every w:p in document order: self-closing, or open tag to close tag.
  // "<w:p[ >]" excludes w:pPr and w:pStyle. Paragraphs do not nest here
  // (no text boxes in the Convert output, measured at HW-0).
  const PARAGRAPH_RE = /<w:p\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  const RUN_RE = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
  const TEXT_RE = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  const BOLD_RE = /<w:b(?:\s+w:val="(?:true|1|on)")?\s*\/>/;
  const SIZE_RE = /<w:sz\s+w:val="(\d+)"\s*\/>/g;
  const PPR_FIRST_RE = /^(<w:p(?:\s[^>]*)?>)(<w:pPr\/>|<w:pPr(?:\s[^>]*)?>)/;
  const PSTYLE_RE = /<w:pStyle\s+w:val="([^"]*)"\s*\/>/;

  // =========================================================================
  // Text helpers
  // =========================================================================

  /** HW-0's comparison form: lower case, maths stripped, punctuation to space. */
  function normaliseText(s) {
    return String(s)
      .toLowerCase()
      .replace(/\$[^$]*\$/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  /** A \section{} number arrives in the docx as literal text: drop it there only. */
  function stripLeadingNumber(s) {
    return String(s).replace(/^\s*\d+(?:\.\d+)*\.?\s+/, "");
  }

  function decodeXmlText(s) {
    return s
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  // =========================================================================
  // headingSequence
  // =========================================================================

  /**
   * Read the heading sequence from MMD, skipping fenced and verbatim blocks.
   * @param {string} mmd
   * @returns {Array<{line:number, level:number, text:string}>}
   */
  function headingSequence(mmd) {
    const out = [];
    if (typeof mmd !== "string") return out;

    let inFence = false;
    let inVerbatim = false;

    mmd.split("\n").forEach((raw, i) => {
      const line = raw.replace(/\r$/, "");

      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return;
      }
      if (/^\s*\\begin\{verbatim\}/.test(line)) {
        inVerbatim = true;
        return;
      }
      if (/^\s*\\end\{verbatim\}/.test(line)) {
        inVerbatim = false;
        return;
      }
      if (inFence || inVerbatim) return;

      for (const rule of HEADING_RULES) {
        const m = line.match(rule.re);
        if (!m) continue;
        const text = m[1]
          .replace(/\s+#+\s*$/, "")
          .replace(/\s+/g, " ")
          .trim();
        out.push({ line: i + 1, level: rule.level, text });
        return;
      }
    });

    return out;
  }

  // =========================================================================
  // Paragraph analysis
  // =========================================================================

  /**
   * Describe one paragraph: its heading level when heading-shaped, else null.
   * Only direct w:r runs count for text and bold; maths runs are m:r.
   */
  function analyseParagraph(xml) {
    const runs = xml.match(RUN_RE) || [];
    const nonEmpty = [];
    let text = "";

    for (const run of runs) {
      let runText = "";
      TEXT_RE.lastIndex = 0;
      let t;
      while ((t = TEXT_RE.exec(run))) runText += t[1];
      runText = decodeXmlText(runText);
      text += runText;
      if (runText.trim() !== "") nonEmpty.push(run);
    }

    // Sizes are read outside the paragraph properties (the paragraph mark).
    const body = xml.replace(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/, "");
    const levels = new Set();
    let sizeCount = 0;
    let outOfSet = false;
    SIZE_RE.lastIndex = 0;
    let s;
    while ((s = SIZE_RE.exec(body))) {
      sizeCount++;
      const level = SIZE_TO_LEVEL[s[1]];
      if (level === undefined) outOfSet = true;
      else levels.add(level);
    }

    const allBold =
      nonEmpty.length > 0 &&
      nonEmpty.every((run) => {
        const tagsOnly = run.replace(TEXT_RE, "");
        return BOLD_RE.test(tagsOnly);
      });

    const level =
      allBold && sizeCount > 0 && !outOfSet && levels.size === 1
        ? [...levels][0]
        : null;

    return { level, text };
  }

  /**
   * Give one paragraph the w:pStyle, as the FIRST child of w:pPr.
   * @returns {{xml:string, changed:boolean}|null} null when it cannot be done safely
   */
  function styleParagraph(xml, styleId) {
    const wanted = `<w:pStyle w:val="${styleId}"/>`;
    const head = xml.match(PPR_FIRST_RE);

    if (head) {
      const [whole, pOpen, pPrOpen] = head;
      if (pPrOpen === "<w:pPr/>") {
        return {
          xml: `${pOpen}<w:pPr>${wanted}</w:pPr>${xml.slice(whole.length)}`,
          changed: true,
        };
      }
      const rest = xml.slice(whole.length);
      const existing = rest.match(PSTYLE_RE);
      const pPrClose = rest.indexOf("</w:pPr>");
      if (existing && existing.index < pPrClose) {
        if (existing[1] === styleId) return { xml, changed: false };
        logWarn(`paragraph already styled "${existing[1]}", wanted ${styleId}`);
        return null;
      }
      return { xml: `${pOpen}${pPrOpen}${wanted}${rest}`, changed: true };
    }

    // No w:pPr as the first child. One elsewhere would be malformed.
    if (/<w:pPr[\s/>]/.test(xml)) {
      logWarn("paragraph has w:pPr that is not its first child");
      return null;
    }
    const pOpen = xml.match(/^<w:p(?:\s[^>]*)?>/);
    if (!pOpen) return null;
    return {
      xml: `${pOpen[0]}<w:pPr>${wanted}</w:pPr>${xml.slice(pOpen[0].length)}`,
      changed: true,
    };
  }

  /** Append Heading1 to Heading6 before </w:styles>, skipping ids present. */
  function addHeadingStyles(stylesXml) {
    let additions = "";
    for (const level of HEADING_LEVELS) {
      const id = `Heading${level}`;
      if (stylesXml.includes(`w:styleId="${id}"`)) continue;
      additions +=
        `<w:style w:type="paragraph" w:styleId="${id}">` +
        `<w:name w:val="heading ${level}"/>` +
        `<w:basedOn w:val="Normal"/>` +
        `<w:next w:val="Normal"/>` +
        `<w:qFormat/>` +
        `<w:pPr><w:outlineLvl w:val="${LEVEL_TO_OUTLINE[level]}"/></w:pPr>` +
        `</w:style>`;
    }
    if (!additions) return stylesXml;
    const at = stylesXml.lastIndexOf("</w:styles>");
    return stylesXml.slice(0, at) + additions + stylesXml.slice(at);
  }

  // =========================================================================
  // mapHeadings
  // =========================================================================

  /**
   * Walk heading-shaped paragraphs against the MMD sequence and, only on a
   * full match, style each one. Never throws.
   * @param {string} documentXml - word/document.xml
   * @param {string} stylesXml - word/styles.xml
   * @param {Array<{level:number, text:string}>} sequence - from headingSequence
   * @returns {{documentXml:string, stylesXml:string, mapped:number}|null}
   */
  function mapHeadings(documentXml, stylesXml, sequence) {
    try {
      if (
        typeof documentXml !== "string" ||
        typeof stylesXml !== "string" ||
        !Array.isArray(sequence) ||
        sequence.length === 0
      ) {
        logWarn("mapHeadings: missing input or empty sequence");
        return null;
      }
      if (!/<w:body[\s>]/.test(documentXml) || !documentXml.includes("</w:body>")) {
        logWarn("mapHeadings: document.xml has no w:body");
        return null;
      }
      if (!stylesXml.includes("</w:styles>")) {
        logWarn("mapHeadings: styles.xml has no closing w:styles");
        return null;
      }

      // Heading-shaped paragraphs, in document order, with their offsets.
      const candidates = [];
      PARAGRAPH_RE.lastIndex = 0;
      let m;
      while ((m = PARAGRAPH_RE.exec(documentXml))) {
        const info = analyseParagraph(m[0]);
        if (info.level !== null) {
          candidates.push({ start: m.index, xml: m[0], ...info });
        }
      }

      // Pair them one to one with the sequence; any disagreement is a refusal.
      for (let k = 0; k < sequence.length; k++) {
        const entry = sequence[k];
        const para = candidates[k];
        if (!para) {
          logWarn(
            `mapHeadings: heading-shaped paragraphs ran out at position ${k + 1}`,
            { mmd: entry && entry.text, docx: null },
          );
          return null;
        }
        const mmdText = normaliseText(entry && entry.text);
        const docxText = normaliseText(stripLeadingNumber(para.text));
        if (!entry || entry.level !== para.level || mmdText !== docxText) {
          logWarn(`mapHeadings: no match at position ${k + 1}`, {
            mmd: entry && entry.text,
            mmdLevel: entry && entry.level,
            docx: para.text,
            docxLevel: para.level,
          });
          return null;
        }
      }
      if (candidates.length > sequence.length) {
        logWarn(
          `mapHeadings: sequence exhausted with ${candidates.length - sequence.length} heading-shaped paragraph(s) left`,
          { mmd: null, docx: candidates[sequence.length].text },
        );
        return null;
      }

      // Full match: rebuild document.xml with each paragraph styled.
      let out = "";
      let cursor = 0;
      let mapped = 0;
      for (const para of candidates) {
        const styled = styleParagraph(para.xml, `Heading${para.level}`);
        if (!styled) return null;
        out += documentXml.slice(cursor, para.start) + styled.xml;
        cursor = para.start + para.xml.length;
        mapped++;
      }
      out += documentXml.slice(cursor);

      logInfo(`mapHeadings: ${mapped} heading(s) mapped`);
      return {
        documentXml: out,
        stylesXml: addHeadingStyles(stylesXml),
        mapped,
      };
    } catch (err) {
      logWarn("mapHeadings: failed, original kept", err);
      return null;
    }
  }

  // =========================================================================
  // restyleDocxHeadings
  // =========================================================================

  /**
   * Restyle a Convert API docx. Resolves the ORIGINAL blob object whenever the
   * map does not align or anything fails; never rejects.
   * @param {Blob} blob - the docx from the Convert API
   * @param {string} mmd - the MMD the conversion was sent
   * @returns {Promise<{blob:Blob, mapped:number, applied:boolean, expected:number}>}
   *   expected: how many headings the MMD carries, so a caller can tell "no
   *   map was needed" (0) from "a map was needed and failed" (applied false)
   */
  async function restyleDocxHeadings(blob, mmd) {
    const expected = headingSequence(mmd).length;
    const unchanged = { blob, mapped: 0, applied: false, expected };
    try {
      if (typeof window.JSZip !== "function") {
        logWarn("restyleDocxHeadings: JSZip not loaded, original kept");
        return unchanged;
      }

      const zip = await window.JSZip.loadAsync(blob);
      const docEntry = zip.file("word/document.xml");
      const stylesEntry = zip.file("word/styles.xml");
      if (!docEntry || !stylesEntry) {
        logWarn("restyleDocxHeadings: document.xml or styles.xml missing");
        return unchanged;
      }

      const documentXml = await docEntry.async("string");
      const stylesXml = await stylesEntry.async("string");
      const result = mapHeadings(documentXml, stylesXml, headingSequence(mmd));
      if (!result) return unchanged;

      // Only the two XML entries are rewritten; every other entry keeps its
      // original compressed data.
      zip.file("word/document.xml", result.documentXml, { compression: "DEFLATE" });
      zip.file("word/styles.xml", result.stylesXml, { compression: "DEFLATE" });
      const newBlob = await zip.generateAsync({ type: "blob", mimeType: DOCX_MIME });

      logDebug(`restyleDocxHeadings: ${result.mapped} heading(s) styled`);
      return { blob: newBlob, mapped: result.mapped, applied: true, expected };
    } catch (err) {
      logError("restyleDocxHeadings: failed, original kept", err);
      return unchanged;
    }
  }

  window.MathPixDocxHeadings = Object.freeze({
    headingSequence,
    mapHeadings,
    restyleDocxHeadings,
  });
})();
