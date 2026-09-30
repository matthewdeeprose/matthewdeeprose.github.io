/**
 * @file captions-fixer-context.js
 * @description Stage 10: turns a slide deck (.pptx/.pdf) or a module text
 * (.txt/.md) into candidate glossary TERMS for the Known terms field. The
 * deck supplies vocabulary and never prose — nothing from it reaches the
 * model except the lines the person leaves in that field, through the one
 * reader `discoveryOptions()` (captions-fixer-ui.js) already builds.
 *
 * ONE DOCUMENT SHAPE FOR ALL THREE READERS
 * -----------------------------------------
 *   { kind: "pptx" | "pdf" | "text", sourceName,
 *     units: [{ n, title, body: [string], notes: string, altTexts: [string],
 *               math: [string], tableCells: [string] }] }
 * A PPTX unit is a slide, in PRESENTATION ORDER (the `p:sldIdLst`, never the
 * file's slideN.xml number), and carries one field beyond this shared shape:
 * `sourceFileNumber`, the digit in the slide's own `slideN.xml` part name —
 * present ONLY on a pptx unit, so a test can prove list order and file-name
 * order are two different readings without re-deriving the file name itself.
 * A PDF unit is a page with `body` only; every other field is empty, because
 * notes are lost and equations are flattened on that path. A text unit is
 * the whole file as one unit, one `body` entry per non-empty line. THIS IS A
 * STAGE 10 SHAPE, not one of the two frozen shapes in captions-fixer-cues.js,
 * and it does not change them.
 *
 * IT SPEAKS TO NOTHING AND TOUCHES NO DOM. Pure functions over strings,
 * ArrayBuffers and the shape above.
 *
 * DEPENDENCIES ARE RESOLVED AT CALL TIME, NEVER AT LOAD. `window.JSZip` and
 * `window.pdfjsLib` are read inside `readPptx`/`readPdf`, never captured at
 * module-parse time, and each REPORTS itself unavailable (a thrown Error
 * with a `.reason` field) rather than throwing an opaque
 * "x is not a function".
 *
 * TWO DESIGN CORRECTIONS TO THE ORIGINAL DISPATCH, MADE 15 SEPTEMBER 2026
 * AFTER READING THE REAL FIXTURE DECK IN ITERATION 0, AND SETTLED BY
 * MATTHEW BEFORE THIS FILE WAS WRITTEN — full record in the Stage 10 As
 * built; only the "why" that a future reader of THIS file needs is kept
 * here:
 *
 * 1. MATH IS NFKC-NORMALISED AT READ TIME. The equation's identifiers
 *    arrive from PowerPoint as Mathematical Alphanumeric Symbols (astral
 *    plane, e.g. U+1D703 MATHEMATICAL ITALIC SMALL THETA), not the standard
 *    Greek/Latin blocks — measured on the real fixture. `String.prototype
 *    .normalize("NFKC")` decomposes them to plain θ (U+03B8) etc., which is
 *    what `harvestTerms` is written against. Greek-letter detection below
 *    is therefore a NAMED CONSTANT RANGE on the plain Greek block
 *    (`GREEK_LETTER_PATTERN`), not `\p{Script=Greek}` — not because the
 *    Script property fails on the normalised letters (it does not: it
 *    correctly reports them as Greek), but because `\p{Script=Greek}` also
 *    matches the much wider Greek Extended block and Coptic-adjacent
 *    marks, which is broader than "the letters this deck's equations use"
 *    and is not something a reader of this file can audit at a glance. A
 *    named range is deliberately narrower and self-documenting.
 * 2. THE HARVESTER NEVER TRUSTS `.length` FOR A CODE-POINT COUNT.
 *    `"𝑥".length === 2` in JS (a surrogate pair) while `[..."𝑥"].length
 *    === 1` — so a "single Latin letter" check written as
 *    `token.length === 1` would wrongly KEEP an unnormalised astral letter
 *    that reaches this module by some other route than `readPptx` (a test
 *    feeding `harvestTerms` a raw math string directly, say). Every length
 *    check in the harvest rules below iterates code points
 *    (`[...token].length`), defensively, regardless of what `readPptx`
 *    already normalised upstream.
 *
 * A THIRD CORRECTION, TO DECISION 5'S SENTENCE-START RULE: it was wrong for
 * HEADINGS. The exclusion below applies to PROSE fields only — `body`,
 * `notes` and `altTexts`. In `title` and `tableCells` every capitalised
 * token is kept, because a heading or a cell has no sentence to be "the
 * start of" in the sense the rule meant. A trailing possessive `'s` (or the
 * curly `'s`) is stripped from every kept term ("Euler's" -> "Euler"),
 * uniformly, in every field. CONFIRMED BY MATTHEW 15 SEPTEMBER 2026: the
 * title "The equation" therefore yields "The" as an expected, accepted term
 * (the SAME rule that correctly yields "Results" and "Stability" from their
 * own titles), even though the identical word from the BODY sentence "The
 * Runge-Kutta scheme is stable here" is correctly excluded by the prose
 * rule. Both readings are real and both are proved — see the test section's
 * CTX5 rows.
 *
 * A FOURTH POINT, FOUND WHILE BUILDING THIS FILE AND CONFIRMED BY MATTHEW 15
 * SEPTEMBER 2026: the fixture's Stability slide carries one paragraph
 * containing a Shift+Enter line break ("First line" / "Second line"), and
 * the answer key wants BOTH "First" and "Second" absent. Decision 5's
 * literal sentence-start definition ("the first token of a paragraph... or
 * the token after '.', '!' or '?'") only excludes "First" — the paragraph's
 * own first token — and would KEEP "Second" as an ordinary mid-sentence
 * capitalised word. Rule (a) now reads: sentence start is the first token of
 * a paragraph, cell, note line, alt text, OR THE TOKEN AFTER A NEWLINE, ".",
 * "!" OR "?" — an embedded newline resets sentence-start the same as the
 * field's own start. `tokensFromProse` below implements this by splitting on
 * "\n" before running the sentence-start pass on each line.
 *
 * A PATCHABLE SEAM, THE SAME PATTERN captions-fixer-stage-recurring.js
 * ALREADY ESTABLISHED FOR `applyCaseOf` / `wholeWordPattern` /
 * `takesPossessive` / `agree`. Six internal decision points that a test
 * section needs to invert — `readSlideIdOrder`, `readMathStrings`,
 * `walkTextWithBreaks`, `ensurePdfWorker`, `tokensFromProse` and
 * `tokensFromHeading` — are called through `api.xxx(...)` rather than their
 * bare lexical names, and are exposed on the returned object for exactly
 * that reason and no other: a caller has no business replacing how a slide
 * deck is walked, and the ONLY reason these six are reachable from outside
 * is so a test can patch one, prove the patch landed, and prove ONLY the
 * rows named for it redden. Every real code path still reaches them through
 * `api`, so a test's patch is not a parallel implementation nobody exercises
 * — it changes what `readPptx`/`readPdf`/`harvestTerms` actually do.
 *
 * @module CaptionsFixerContext
 * @since 15 September 2026
 */
const CaptionsFixerContext = (function () {
  // ==========================================================================
  // LOGGING CONFIGURATION
  // ==========================================================================
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
      console.error(`[CaptionsFixerContext] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[CaptionsFixerContext] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[CaptionsFixerContext] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[CaptionsFixerContext] ${message}`, ...args);
  }

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  // OOXML namespace URIs. Elements are matched by namespace URI and local
  // name (getElementsByTagNameNS), never by prefix — a prefix is only a
  // convention of the file that wrote it.
  const NS_PRESENTATION = "http://schemas.openxmlformats.org/presentationml/2006/main";
  const NS_DRAWING = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const NS_RELATIONSHIPS_ATTR = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const NS_MATH = "http://schemas.openxmlformats.org/officeDocument/2006/math";
  const NS_MARKUP_COMPAT = "http://schemas.openxmlformats.org/markup-compatibility/2006";
  const NS_PACKAGE_RELATIONSHIPS = "http://schemas.openxmlformats.org/package/2006/relationships";

  const PPT_ROOT = "ppt/";
  const NOTES_RELATIONSHIP_TYPE_SUFFIX = "/notesSlide";
  const RELATIONSHIP_ID_ATTR = "Id";
  const RELATIONSHIP_TYPE_ATTR = "Type";
  const RELATIONSHIP_TARGET_ATTR = "Target";

  const PDF_JS_CDN_BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js";
  const SLIDE_FILE_NUMBER_PATTERN = /slide(\d+)\.xml$/;

  /** How many letters an ALL-CAPS token must have to count as an acronym. */
  const ACRONYM_MIN = 2;
  const ACRONYM_MAX = 6;

  /** Named range, not \p{Script=Greek} — see the file header for why. */
  const GREEK_LETTER_PATTERN = /^[Α-Ωα-ω]+$/u;

  const ACRONYM_PATTERN = /^[A-Z]+$/;
  // An uppercase letter AFTER the first character ("NaCl", "pH") — NOT
  // "any capital plus any lowercase", which is true of almost every
  // ordinary capitalised word ("The", "Newton") and would defeat the
  // sentence-start exclusion outright.
  const INTERNAL_UPPERCASE_PATTERN = /[A-Z]/;
  const HAS_LETTER_PATTERN = /[A-Za-z]/;
  const HAS_DIGIT_PATTERN = /\d/;
  const CAPITAL_START_PATTERN = /^[A-Z]/;
  const TRAILING_POSSESSIVE_PATTERN = /['’]s$/u;
  const SENTENCE_END_PATTERN = /[.!?]/;
  const SURROUNDING_PUNCTUATION_PATTERN_START = /^[^\p{L}\p{N}]+/u;
  const SURROUNDING_PUNCTUATION_PATTERN_END = /[^\p{L}\p{N}]+$/u;
  const TRAILING_PUNCTUATION_RUN_PATTERN = /[^\p{L}\p{N}]+$/u;
  const WHITESPACE_SPLIT_PATTERN = /\s+/u;

  /** A pre-registered call: noise beyond this is expected, not tuned away. */
  const MAX_GLOSSARY_TERMS = 150;

  const DOCUMENT_KIND = Object.freeze({ PPTX: "pptx", PDF: "pdf", TEXT: "text" });

  // ==========================================================================
  // DEPENDENCY RESOLUTION — at call time, never at load
  // ==========================================================================

  function unavailableError(dependencyName, sourceName) {
    const error = new Error(
      `${dependencyName} is not available; cannot read "${sourceName}".`,
    );
    error.reason = "dependency-unavailable";
    error.dependency = dependencyName;
    return error;
  }

  function resolveJSZip() {
    const jsZip = window.JSZip;
    if (!jsZip || typeof jsZip.loadAsync !== "function") return null;
    return jsZip;
  }

  function resolvePdfJs() {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib || typeof pdfjsLib.getDocument !== "function") return null;
    return pdfjsLib;
  }

  // ==========================================================================
  // XML HELPERS
  // ==========================================================================

  /**
   * @param {string} xmlText
   * @returns {Document}
   */
  function parseXml(xmlText) {
    return new DOMParser().parseFromString(xmlText, "application/xml");
  }

  /**
   * @param {Node} node
   * @param {string} ns
   * @param {string} localName
   * @returns {boolean}
   */
  function hasAncestorNS(node, ns, localName) {
    let current = node.parentNode;
    while (current) {
      if (current.namespaceURI === ns && current.localName === localName) {
        return true;
      }
      current = current.parentNode;
    }
    return false;
  }

  /** Never mc:Fallback content — see the file header and decision 3. */
  function isInsideFallback(node) {
    return hasAncestorNS(node, NS_MARKUP_COMPAT, "Fallback");
  }

  /**
   * Concatenates every a:t reached while walking a subtree in document
   * order, treating a:br as a newline. a:fld is not special-cased: the
   * generic recursion descends into it and finds its own a:t, which is
   * exactly "a:fld treated like a run".
   * @param {Element} root
   * @returns {string}
   */
  function walkTextWithBreaks(root) {
    let text = "";
    function visit(node) {
      if (node.nodeType !== 1) return;
      if (node.namespaceURI === NS_DRAWING && node.localName === "t") {
        text += node.textContent;
        return;
      }
      if (node.namespaceURI === NS_DRAWING && node.localName === "br") {
        text += "\n";
        return;
      }
      Array.from(node.childNodes).forEach(visit);
    }
    visit(root);
    return text;
  }

  /**
   * Resolves a relationship Target against the directory the .rels file's
   * own part lives in ("../notesSlides/notesSlide1.xml" against
   * "ppt/slides/" resolves to "ppt/notesSlides/notesSlide1.xml").
   * @param {string} baseDir - no trailing slash
   * @param {string} target
   * @returns {string}
   */
  function resolveRelativePath(baseDir, target) {
    const segments = `${baseDir}/${target}`.split("/");
    const resolved = [];
    segments.forEach((segment) => {
      if (segment === "" || segment === ".") return;
      if (segment === "..") {
        resolved.pop();
        return;
      }
      resolved.push(segment);
    });
    return resolved.join("/");
  }

  /**
   * @param {Document} relsDoc
   * @returns {Map<string, string>} relationship Id -> Target
   */
  function mapRelationshipTargets(relsDoc) {
    const map = new Map();
    Array.from(
      relsDoc.getElementsByTagNameNS(NS_PACKAGE_RELATIONSHIPS, "Relationship"),
    ).forEach((relationship) => {
      const id = relationship.getAttribute(RELATIONSHIP_ID_ATTR);
      const target = relationship.getAttribute(RELATIONSHIP_TARGET_ATTR);
      if (id && target) map.set(id, target);
    });
    return map;
  }

  /**
   * @param {Document} relsDoc
   * @returns {Array<{ type: string, target: string }>}
   */
  function listRelationships(relsDoc) {
    return Array.from(
      relsDoc.getElementsByTagNameNS(NS_PACKAGE_RELATIONSHIPS, "Relationship"),
    ).map((relationship) => ({
      type: relationship.getAttribute(RELATIONSHIP_TYPE_ATTR) || "",
      target: relationship.getAttribute(RELATIONSHIP_TARGET_ATTR) || "",
    }));
  }

  /**
   * The digit in a slide part's own file name ("ppt/slides/slide2.xml" -> 2).
   * Used only to prove list order and file-name order are different
   * readings; readPptx's own ordering never consults this.
   * @param {string} slidePath
   * @returns {number|null}
   */
  function slideFileNumber(slidePath) {
    const match = SLIDE_FILE_NUMBER_PATTERN.exec(slidePath);
    return match ? Number(match[1]) : null;
  }

  function dirname(path) {
    const index = path.lastIndexOf("/");
    return index === -1 ? "" : path.slice(0, index);
  }
  function basename(path) {
    const index = path.lastIndexOf("/");
    return index === -1 ? path : path.slice(index + 1);
  }

  async function readZipEntryText(zip, path) {
    const entry = zip.file(path);
    if (!entry) {
      throw new Error(`This deck has no "${path}" part — cannot read it.`);
    }
    return entry.async("string");
  }

  async function readZipEntryTextOptional(zip, path) {
    const entry = zip.file(path);
    if (!entry) return null;
    return entry.async("string");
  }

  // ==========================================================================
  // PPTX — slide order, text, notes, alt text, tables, equations
  // ==========================================================================

  /**
   * Presentation order: ppt/presentation.xml's p:sldIdLst, each r:id
   * resolved through ppt/_rels/presentation.xml.rels. NEVER the number in
   * the file name — pptx-extraction-research.md § 1.
   * @param {Document} presentationDoc
   * @returns {string[]} r:id values, in presentation order
   */
  function readSlideIdOrder(presentationDoc) {
    const sldIdList = Array.from(
      presentationDoc.getElementsByTagNameNS(NS_PRESENTATION, "sldId"),
    );
    return sldIdList
      .map((sldId) => sldId.getAttributeNS(NS_RELATIONSHIPS_ATTR, "id"))
      .filter((rId) => Boolean(rId));
  }

  /**
   * The p:sp whose p:ph is type="title" or type="ctrTitle", never inside
   * mc:Fallback.
   * @param {Element} slideRoot
   * @returns {Element|null}
   */
  function findTitleShape(slideRoot) {
    const shapes = Array.from(
      slideRoot.getElementsByTagNameNS(NS_PRESENTATION, "sp"),
    );
    for (const shape of shapes) {
      if (isInsideFallback(shape)) continue;
      const ph = shape.getElementsByTagNameNS(NS_PRESENTATION, "ph")[0];
      if (!ph) continue;
      const type = ph.getAttribute("type");
      if (type === "title" || type === "ctrTitle") return shape;
    }
    return null;
  }

  /**
   * The p:sp whose p:ph is type="body" — the notes text placeholder. A
   * notes slide also carries a "sldImg" placeholder (a thumbnail, no text)
   * and a "sldNum" placeholder (a slide-number field) that must NOT leak
   * into the notes string — measured on the real fixture, whose notes
   * document carries all three.
   * @param {Element} notesRoot
   * @returns {Element|null}
   */
  function findNotesBodyShape(notesRoot) {
    const shapes = Array.from(
      notesRoot.getElementsByTagNameNS(NS_PRESENTATION, "sp"),
    );
    for (const shape of shapes) {
      const ph = shape.getElementsByTagNameNS(NS_PRESENTATION, "ph")[0];
      if (ph && ph.getAttribute("type") === "body") return shape;
    }
    return null;
  }

  /**
   * Every a:p inside a shape's own subtree, walked with breaks honoured,
   * empty paragraphs dropped.
   * @param {Element} shape
   * @returns {string[]}
   */
  function shapeParagraphs(shape) {
    return Array.from(shape.getElementsByTagNameNS(NS_DRAWING, "p"))
      .map((paragraph) => api.walkTextWithBreaks(paragraph))
      .filter((text) => text.length > 0);
  }

  /**
   * @param {Element} slideRoot
   * @returns {string[]} descr attributes, in document order, never inside
   * mc:Fallback
   */
  function readAltTexts(slideRoot) {
    return Array.from(
      slideRoot.getElementsByTagNameNS(NS_PRESENTATION, "cNvPr"),
    )
      .filter((cNvPr) => !isInsideFallback(cNvPr))
      .map((cNvPr) => cNvPr.getAttribute("descr"))
      .filter((descr) => Boolean(descr));
  }

  /**
   * a:tc text, one string per cell, row-major in document order, never
   * inside mc:Fallback.
   * @param {Element} slideRoot
   * @returns {string[]}
   */
  function readTableCells(slideRoot) {
    return Array.from(slideRoot.getElementsByTagNameNS(NS_DRAWING, "tc"))
      .filter((tc) => !isInsideFallback(tc))
      .map((tc) => api.walkTextWithBreaks(tc))
      .filter((text) => text.length > 0);
  }

  /**
   * Every m:t inside each m:oMath, concatenated per equation and
   * NFKC-normalised so the harvester works on plain θ, μ, σ, sin, x rather
   * than the Mathematical Alphanumeric Symbols PowerPoint writes — see the
   * file header. mc:Choice only; mc:Fallback carries a rendered image with
   * no m:oMath and is skipped by construction (it has none to find).
   * @param {Element} slideRoot
   * @returns {string[]}
   */
  function readMathStrings(slideRoot) {
    return Array.from(
      slideRoot.getElementsByTagNameNS(NS_MATH, "oMath"),
    )
      .filter((oMath) => !isInsideFallback(oMath))
      .map((oMath) => {
        const raw = Array.from(
          oMath.getElementsByTagNameNS(NS_MATH, "t"),
        )
          .map((t) => t.textContent)
          .join("");
        return raw.normalize("NFKC");
      })
      .filter((text) => text.length > 0);
  }

  /**
   * @param {number} n - 1-based presentation position
   * @param {Element} slideRoot
   * @param {string} notes
   * @param {number|null} sourceFileNumber - the digit in this slide's own
   * slideN.xml part name, kept ONLY so a test can compare it against `n`
   * @returns {object} a unit in the shared document shape
   */
  function buildPptxUnit(n, slideRoot, notes, sourceFileNumber) {
    const titleShape = findTitleShape(slideRoot);
    const title = titleShape ? shapeParagraphs(titleShape).join(" ") : "";

    const bodyShapes = Array.from(
      slideRoot.getElementsByTagNameNS(NS_PRESENTATION, "sp"),
    ).filter((shape) => shape !== titleShape && !isInsideFallback(shape));
    const body = bodyShapes.flatMap((shape) => shapeParagraphs(shape));

    return {
      n,
      title,
      body,
      notes,
      altTexts: readAltTexts(slideRoot),
      math: api.readMathStrings(slideRoot),
      tableCells: readTableCells(slideRoot),
      sourceFileNumber,
    };
  }

  /**
   * Reads the notes text for one slide via the slide's OWN _rels, by a
   * relationship whose type ends "/notesSlide" — never a guessed
   * notesSlideN.xml name.
   * @param {object} zip
   * @param {string} slidePath - e.g. "ppt/slides/slide4.xml"
   * @returns {Promise<string>}
   */
  async function readNotesForSlide(zip, slidePath) {
    const slideRelsPath = `${dirname(slidePath)}/_rels/${basename(slidePath)}.rels`;
    const relsXml = await readZipEntryTextOptional(zip, slideRelsPath);
    if (!relsXml) return "";
    const relationships = listRelationships(parseXml(relsXml));
    const notesRelationship = relationships.find((relationship) =>
      relationship.type.endsWith(NOTES_RELATIONSHIP_TYPE_SUFFIX),
    );
    if (!notesRelationship) return "";

    const notesPath = resolveRelativePath(dirname(slidePath), notesRelationship.target);
    const notesXml = await readZipEntryTextOptional(zip, notesPath);
    if (!notesXml) return "";

    const notesRoot = parseXml(notesXml).documentElement;
    const bodyShape = findNotesBodyShape(notesRoot);
    if (!bodyShape) return "";
    return shapeParagraphs(bodyShape).join(" ");
  }

  /**
   * Reads a .pptx into the shared document shape. Slide order is the
   * presentation's own list, never the file name — pptx-extraction-research.md
   * § 1.
   * @param {ArrayBuffer} arrayBuffer
   * @param {string} [sourceName=""]
   * @returns {Promise<object>}
   */
  async function readPptx(arrayBuffer, sourceName = "") {
    const jsZip = resolveJSZip();
    if (!jsZip) throw unavailableError("JSZip", sourceName);

    const zip = await jsZip.loadAsync(arrayBuffer);

    const presentationXml = await readZipEntryText(zip, `${PPT_ROOT}presentation.xml`);
    const presentationRelsXml = await readZipEntryText(
      zip,
      `${PPT_ROOT}_rels/presentation.xml.rels`,
    );
    const presentationDoc = parseXml(presentationXml);
    const rIdToTarget = mapRelationshipTargets(parseXml(presentationRelsXml));

    const orderedRIds = api.readSlideIdOrder(presentationDoc);
    const slidePaths = orderedRIds
      .map((rId) => rIdToTarget.get(rId))
      .filter((target) => Boolean(target))
      .map((target) => `${PPT_ROOT}${target}`);

    const units = [];
    for (let index = 0; index < slidePaths.length; index += 1) {
      const slidePath = slidePaths[index];
      const slideXml = await readZipEntryText(zip, slidePath);
      const slideRoot = parseXml(slideXml).documentElement;
      const notes = await readNotesForSlide(zip, slidePath);
      units.push(buildPptxUnit(index + 1, slideRoot, notes, slideFileNumber(slidePath)));
    }

    logDebug(`Read ${units.length} slides from "${sourceName}"`);
    return { kind: DOCUMENT_KIND.PPTX, sourceName: String(sourceName || ""), units };
  }

  // ==========================================================================
  // PDF — body only; notes are lost and equations are flattened
  // ==========================================================================

  function ensurePdfWorker(pdfjsLib) {
    const current = pdfjsLib.GlobalWorkerOptions.workerSrc;
    if (current) return; // already configured by this lane or another; leave it
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDF_JS_CDN_BASE}/${pdfjsLib.version}/pdf.worker.min.js`;
  }

  /**
   * One body entry per visual line, hasEOL honoured as the line break;
   * items on the same line joined with a single space.
   * @param {Array<{ str: string, hasEOL: boolean }>} items
   * @returns {string[]}
   */
  function pdfPageBody(items) {
    const lines = [];
    let buffer = "";
    items.forEach((item) => {
      buffer += item.str;
      if (item.hasEOL) {
        lines.push(buffer.trim());
        buffer = "";
      } else {
        buffer += " ";
      }
    });
    if (buffer.trim().length > 0) lines.push(buffer.trim());
    return lines.filter((line) => line.length > 0);
  }

  /**
   * Reads a .pdf into the shared document shape. Every page is a unit with
   * `body` only — `title`, `notes`, `altTexts`, `math` and `tableCells` are
   * always empty on this path, on purpose: notes are not in the PDF and an
   * equation's rendered text cannot be told apart from prose reliably, so
   * this reader does not pretend otherwise by putting anything in `math`.
   *
   * `arrayBuffer` IS CONSUMED. pdf.js transfers it to its worker, which
   * DETACHES it — a second call passed the SAME ArrayBuffer instance throws
   * "Cannot perform Construct on a detached ArrayBuffer". A caller reading
   * the same file twice (or probing before the real read, as this module's
   * own test section does) must slice a fresh copy per call.
   * @param {ArrayBuffer} arrayBuffer
   * @param {string} [sourceName=""]
   * @returns {Promise<object>}
   */
  async function readPdf(arrayBuffer, sourceName = "") {
    const pdfjsLib = resolvePdfJs();
    if (!pdfjsLib) throw unavailableError("pdfjsLib", sourceName);

    api.ensurePdfWorker(pdfjsLib);

    const document = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const units = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      units.push({
        n: pageNumber,
        title: "",
        body: pdfPageBody(content.items),
        notes: "",
        altTexts: [],
        math: [],
        tableCells: [],
      });
    }

    logDebug(`Read ${units.length} pages from "${sourceName}"`);
    return { kind: DOCUMENT_KIND.PDF, sourceName: String(sourceName || ""), units };
  }

  // ==========================================================================
  // TEXT — the whole file as one unit, one body entry per non-empty line
  // ==========================================================================

  /**
   * @param {string} text
   * @param {string} [sourceName=""]
   * @returns {object}
   */
  function readText(text, sourceName = "") {
    const body = String(text)
      .split(/\r\n|\r|\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return {
      kind: DOCUMENT_KIND.TEXT,
      sourceName: String(sourceName || ""),
      units: [{ n: 1, title: "", body, notes: "", altTexts: [], math: [], tableCells: [] }],
    };
  }

  // ==========================================================================
  // HARVEST — deterministic, pre-registered; the person is the filter
  // ==========================================================================

  /** @param {string} term @returns {string} */
  function stripTrailingPossessive(term) {
    return term.replace(TRAILING_POSSESSIVE_PATTERN, "");
  }

  /** @param {string} token - already stripped of surrounding punctuation */
  function isAcronym(token) {
    const length = [...token].length;
    return length >= ACRONYM_MIN && length <= ACRONYM_MAX && ACRONYM_PATTERN.test(token);
  }

  /**
   * "Mixes cases or letters and digits internally" — an uppercase letter
   * somewhere after the token's first character ("NaCl", "pH"), or a
   * letter and a digit both present ("H2O"). Deliberately NOT "contains
   * both a capital and a lowercase letter": that is true of almost every
   * ordinary capitalised word and would swallow the sentence-start
   * exclusion whole — measured on this fixture's own "An", which reaches
   * this check precisely because it is excluded by rule (a).
   * @param {string} token - already stripped of surrounding punctuation
   */
  function isMixedCaseOrDigit(token) {
    const internalUpper = token.length > 1 && INTERNAL_UPPERCASE_PATTERN.test(token.slice(1));
    const letterAndDigit = HAS_LETTER_PATTERN.test(token) && HAS_DIGIT_PATTERN.test(token);
    return internalUpper || letterAndDigit;
  }

  /**
   * Strips leading/trailing non-letter/non-digit characters, preserving an
   * internal hyphen or apostrophe ("Runge-Kutta", "Euler's" before the
   * possessive strip below).
   * @param {string} rawToken
   * @returns {string}
   */
  function coreOf(rawToken) {
    return rawToken
      .replace(SURROUNDING_PUNCTUATION_PATTERN_START, "")
      .replace(SURROUNDING_PUNCTUATION_PATTERN_END, "");
  }

  /**
   * Does this raw token's own trailing punctuation run end a sentence? Used
   * to decide whether the NEXT token is a sentence start.
   * @param {string} rawToken
   * @returns {boolean}
   */
  function endsSentence(rawToken) {
    const run = (rawToken.match(TRAILING_PUNCTUATION_RUN_PATTERN) || [""])[0];
    return SENTENCE_END_PATTERN.test(run);
  }

  /**
   * One capitalised-run-joining, sentence-start-aware pass over a single
   * prose string (one paragraph, one notes string, one alt text). An
   * embedded newline resets the sentence-start state, the same as the
   * string's own start — see the file header's fourth point.
   * @param {string} text
   * @returns {string[]} kept terms, before the possessive strip
   */
  function tokensFromProseField(text) {
    const kept = [];
    let sentenceStart = true;
    let runStart = null; // index into `words` where a capitalised run began
    const words = text.split(WHITESPACE_SPLIT_PATTERN).filter((w) => w.length > 0);
    const cores = words.map(coreOf);

    function flushRun(fromIndex, toIndexExclusive) {
      if (fromIndex === null) return;
      kept.push(cores.slice(fromIndex, toIndexExclusive).join(" "));
    }

    words.forEach((rawWord, index) => {
      const core = cores[index];
      if (core.length === 0) {
        // Punctuation-only token (e.g. a lone "/"): does not clear a
        // pending sentence-start, and can still end a sentence itself.
        if (endsSentence(rawWord)) sentenceStart = true;
        flushRun(runStart, index);
        runStart = null;
        return;
      }

      const isCapital = CAPITAL_START_PATTERN.test(core);
      const acronym = isAcronym(core);
      const mixed = isMixedCaseOrDigit(core);

      const keepAsCapitalRun = isCapital && !sentenceStart;
      if (keepAsCapitalRun) {
        if (runStart === null) runStart = index;
      } else {
        flushRun(runStart, index);
        runStart = null;
        if (acronym || mixed) kept.push(core);
      }

      sentenceStart = endsSentence(rawWord);
      // A newline inside the raw token stream cannot happen (whitespace
      // split already consumed it), so a line break instead resets via the
      // ORIGINAL text's newline positions — handled by the caller splitting
      // on "\n" before calling this function. See tokensFromProse below.
    });
    flushRun(runStart, words.length);

    return kept;
  }

  /**
   * Splits a prose field on embedded newlines first (each line gets its own
   * sentence-start), then delegates to tokensFromProseField per line.
   * @param {string} text
   * @returns {string[]}
   */
  function tokensFromProse(text) {
    if (!text) return [];
    return text
      .split("\n")
      .flatMap((line) => tokensFromProseField(line));
  }

  /**
   * Heading fields (title, table cells): every capitalised token is kept,
   * no sentence-start exclusion — a heading has no sentence.
   * @param {string} text
   * @returns {string[]}
   */
  function tokensFromHeading(text) {
    if (!text) return [];
    const kept = [];
    let runStart = null;
    const words = text.split(WHITESPACE_SPLIT_PATTERN).filter((w) => w.length > 0);
    const cores = words.map(coreOf);

    function flushRun(fromIndex, toIndexExclusive) {
      if (fromIndex === null) return;
      kept.push(cores.slice(fromIndex, toIndexExclusive).join(" "));
    }

    words.forEach((rawWord, index) => {
      const core = cores[index];
      if (core.length === 0) {
        flushRun(runStart, index);
        runStart = null;
        return;
      }
      const isCapital = CAPITAL_START_PATTERN.test(core);
      if (isCapital) {
        if (runStart === null) runStart = index;
        return;
      }
      flushRun(runStart, index);
      runStart = null;
      if (isAcronym(core) || isMixedCaseOrDigit(core)) kept.push(core);
    });
    flushRun(runStart, words.length);

    return kept;
  }

  /**
   * From a math string: letter runs of two or more code points, and any
   * single Greek letter, are identifiers; a single non-Greek letter is
   * dropped. Code-point aware throughout — never `.length` — see the file
   * header's second point.
   * @param {string} mathText - already NFKC-normalised by readPptx, but
   * this function does not assume that: it is defensive on its own input.
   * @returns {string[]}
   */
  function tokensFromMath(mathText) {
    if (!mathText) return [];
    const kept = [];
    const letterRuns = mathText.normalize("NFKC").match(/\p{L}+/gu) || [];
    letterRuns.forEach((run) => {
      const codePoints = [...run];
      if (codePoints.length >= 2) {
        kept.push(run);
        return;
      }
      if (GREEK_LETTER_PATTERN.test(run)) kept.push(run);
    });
    return kept;
  }

  /**
   * Harvests candidate terms from a document produced by readPptx/readPdf/
   * readText. Deterministic, pre-registered, and the person is the filter —
   * see decision 5 and the file header's design corrections.
   * @param {object} document - { kind, sourceName, units }
   * @returns {string[]} at most MAX_GLOSSARY_TERMS terms, ranked by
   * occurrence count then first appearance
   */
  function harvestTerms(document) {
    if (!document || !Array.isArray(document.units)) return [];

    const entries = new Map(); // lowercase key -> { term, count, firstIndex }
    let globalIndex = 0;

    function record(rawTerm) {
      const term = stripTrailingPossessive(rawTerm);
      if (!term) return;
      const key = term.toLowerCase();
      if (!entries.has(key)) {
        entries.set(key, { term, count: 0, firstIndex: globalIndex });
      }
      entries.get(key).count += 1;
      globalIndex += 1;
    }

    document.units.forEach((unit) => {
      api.tokensFromHeading(unit.title).forEach(record);
      (unit.body || []).forEach((paragraph) => api.tokensFromProse(paragraph).forEach(record));
      api.tokensFromProse(unit.notes).forEach(record);
      (unit.altTexts || []).forEach((altText) => api.tokensFromProse(altText).forEach(record));
      (unit.tableCells || []).forEach((cell) => api.tokensFromHeading(cell).forEach(record));
      (unit.math || []).forEach((mathText) => tokensFromMath(mathText).forEach(record));
    });

    return Array.from(entries.values())
      .sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex)
      .slice(0, MAX_GLOSSARY_TERMS)
      .map((entry) => entry.term);
  }

  // ==========================================================================
  // MERGE — append, never replace what the person typed
  // ==========================================================================

  /**
   * Keeps `existingLines` first and in order, appends each harvested term
   * not already present (case-insensitively), one per line. The caller
   * joins the result with "\n" to write it into the field.
   * @param {string[]} existingLines
   * @param {string[]} harvested
   * @returns {string[]}
   */
  function mergeTerms(existingLines, harvested) {
    const existing = Array.isArray(existingLines) ? existingLines : [];
    const seen = new Set(
      existing
        .map((line) => String(line).trim().toLowerCase())
        .filter((line) => line.length > 0),
    );
    const appended = [];
    (Array.isArray(harvested) ? harvested : []).forEach((term) => {
      const key = String(term).trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      appended.push(term);
    });
    return existing.concat(appended);
  }

  // ==========================================================================
  // ANNOUNCEMENT COMPOSER — one line, through notify*(), no new live region
  // ==========================================================================

  /**
   * @param {number} count
   * @param {string} sourceName
   * @returns {string}
   */
  function composeContextLine(count, sourceName) {
    const n = Number(count) || 0;
    const noun = n === 1 ? "term" : "terms";
    return `${n} ${noun} from ${sourceName} added to Known terms. Check them before you run.`;
  }

  /**
   * Decision 8's second case: "a deck that yields none". CORRECTED after
   * iteration 4: the count in composeContextLine is the number of lines
   * ADDED to the field, not the number harvested, so "yields none" has to
   * be true of both a document with no candidate terms AND a document whose
   * terms are all already present — either way, nothing is added, and this
   * is the line that speaks, not a success line reading zero. Worded to be
   * true of both cases rather than naming which one happened. Not itself
   * named by decision 8; added as its composer's sibling, on the same
   * pure/exported convention captions-fixer-ui.js documents for
   * composeUploadLine and friends.
   * @param {string} sourceName
   * @returns {string}
   */
  function composeContextEmptyLine(sourceName) {
    return `No new terms from ${sourceName} to add to Known terms.`;
  }

  /**
   * Decision 8's third case: "a file the reader cannot open: one
   * notifyError naming the file". `message` is the reader's own thrown
   * message, passed through unchanged — the same treatment the captions
   * parser's refusal gets in captions-fixer-ui.js's loadText.
   * @param {string} sourceName
   * @param {string} message
   * @returns {string}
   */
  function composeContextErrorLine(sourceName, message) {
    return `${sourceName} could not be read: ${message}`;
  }

  logInfo("Captions Fixer context module loaded");

  // `api` is what every internal seam call above reaches through
  // (`api.readSlideIdOrder(...)`, `api.tokensFromProse(...)`, etc.) rather
  // than the bare lexical function name, and it is also what gets returned
  // — the same object, so a test replacing `CaptionsFixerContext.foo` really
  // does change what readPptx/readPdf/harvestTerms do. See the file header.
  const api = {
    readPptx: readPptx,
    readPdf: readPdf,
    readText: readText,
    harvestTerms: harvestTerms,
    mergeTerms: mergeTerms,
    composeContextLine: composeContextLine,
    composeContextEmptyLine: composeContextEmptyLine,
    composeContextErrorLine: composeContextErrorLine,
    DOCUMENT_KIND: DOCUMENT_KIND,
    MAX_GLOSSARY_TERMS: MAX_GLOSSARY_TERMS,
    ACRONYM_MIN: ACRONYM_MIN,
    ACRONYM_MAX: ACRONYM_MAX,
    // Test-only seams — six internal decision points a verification's
    // inversion needs to patch. No real caller should reach for these.
    readSlideIdOrder: readSlideIdOrder,
    readMathStrings: readMathStrings,
    walkTextWithBreaks: walkTextWithBreaks,
    ensurePdfWorker: ensurePdfWorker,
    tokensFromProse: tokensFromProse,
    tokensFromHeading: tokensFromHeading,
  };
  return api;
})();

// The const above is a top-level BINDING, not a window property, so the
// alias below is what makes window.CaptionsFixerContext resolve at all —
// the same arrangement, for the same reason, as captions-fixer-cues.js.
window.CaptionsFixerContext = CaptionsFixerContext;
