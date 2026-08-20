/**
 * @file alt-text-parser.js
 * @module MathPixAltTextParser
 * @description
 * Phase 2 Stage 2, Parcel 3.1 — the pure four-field parse stage (S2F-D5).
 *
 * A pure function from raw generation text to a four-field description object:
 *
 *   parse(rawText) → { title, alt, long, text }
 *
 * It splits the conforming four-section markdown the generation prompt asks the
 * model to emit (see `buildQwenPrompt` in image-describer-controller-generate.js):
 *
 *   ## 1. Title            → title
 *   ## 2. Alt Text         → alt
 *   ## 3. Long Description  → long
 *   ## 4. Text Content     → text   (visible words in the image, or "No text content.")
 *
 * ── Naming trap ────────────────────────────────────────────────────────────
 * The OUTPUT field `text` is the text-in-image content (section 4). The INPUT
 * is deliberately named `rawText` to keep the two apart.
 *
 * ── Reimplementation, not a port (S2F-D5) ──────────────────────────────────
 * The only extractor that exists today is Image Describer's
 * `extractAndApplyAltText` (image-describer-controller-ui.js): it pulls the alt
 * text ALONE and is DOM-coupled — it walks rendered `<h1>..<h6>` nodes with
 * `querySelectorAll`, matches a heading whose lower-cased text includes
 * "alt text", and accumulates sibling `textContent` until the next heading /
 * `<hr>`. This parser inherits its header-matching lessons (case-insensitive
 * match; the `## N.` numbering may or may not be present) but NOT its DOM
 * coupling: it works on raw markdown text, splitting on `## ` headers rather
 * than DOM `<h2>` nodes, and returns all four fields rather than alt alone.
 *
 * ── Non-conforming policy (S2F-D5 / confidence-pass F8) ─────────────────────
 * A free-form result with no four-part structure maps to the LONG description
 * rather than failing, so a model that emits prose still yields a usable
 * description. This keys off the text's SHAPE alone (no headers found) — the
 * parser receives the generation text only, never the whole result object, so
 * it cannot read `source`/`status`/`model`. That independence (S2F-D3) means
 * adding a local source later cannot silently change parse behaviour.
 *
 * The exact non-conforming mapping is settled against real local-model output
 * in the local phase (S2F-Q3); this parcel implements only the settled rule —
 * prose-with-no-headers → long. Nothing cleverer.
 *
 * ── Section boundaries (PARSE-F1) ──────────────────────────────────────────
 * A recognised header NAME is necessary but not sufficient to start a new
 * section. See `sectionBoundaryField` for the two further conditions — the
 * level rule and the re-open guard — and the reasoning behind each. They are
 * documented there and only there, so the two cannot drift.
 *
 * ── Literal bodies (write-stage owner, please note) ─────────────────────────
 * Section bodies are returned as-is (trimmed only). The parser does NOT
 * interpret the Text Content sentinel "No text content." as an empty string —
 * that normalisation is a downstream WRITE-stage policy (the write stage owns
 * whether a literal sentinel counts as "no content" for provenance/overwrite),
 * not the parser's job. The parser passes it through literally.
 *
 * Pure: no DOM, no network, no globals reached at runtime, no `this`. Runs in
 * node with no `window`/`document`. Attaches to `window` at definition time
 * only (guarded), matching the ai-alt-text siblings.
 *
 * ── Back-port note ─────────────────────────────────────────────────────────
 * This parser is a promotion candidate for `openrouter-embed` (a generic
 * four-section reader other AI tools could reuse). It is kept in the
 * orchestrator this stage — recorded here, NOT promoted now.
 *
 * @see image-describer/image-describer-controller-generate.js (buildQwenPrompt — the conforming shape)
 * @see image-describer/image-describer-controller-ui.js (extractAndApplyAltText — the DOM-coupled extractor it replaces)
 * @see mathpix-scripts/ai-alt-text/alt-text-generation-contract.js (2.1 sibling — IIFE-global shape)
 * @see mathpix-scripts/docs/alt-text/phase-2-stage-2-feature-replan-planning-decisions.md (S2F-D5, F8, S2F-Q3)
 */

const MathPixAltTextParser = (function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Logging (per CLAUDE.md § Logging Standards — IIFE pattern)
  // ---------------------------------------------------------------------------

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
      console.error(`[AltTextParser] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AltTextParser] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AltTextParser] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AltTextParser] ${message}`, ...args);
  }

  // ---------------------------------------------------------------------------
  // Section vocabulary — the four conforming section names, in emitted order.
  // Each `field` is the output key; `name` is the normalised header name we
  // match against (case-insensitive, full-name, not substring).
  // ---------------------------------------------------------------------------

  const SECTIONS = [
    { field: "title", name: "title" },
    { field: "alt", name: "alt text" },
    { field: "long", name: "long description" },
    { field: "text", name: "text content" },
  ];

  /** Lookup from normalised header name → output field. */
  const NAME_TO_FIELD = SECTIONS.reduce((map, s) => {
    map[s.name] = s.field;
    return map;
  }, Object.create(null));

  /**
   * Matches a single markdown header LINE and captures its name.
   *
   *   ^\s*        leading whitespace tolerated
   *   #{1,6}\s*   one-to-six hashes, optional space (## or ##2. both allowed)
   *   (?:\d+\.?\s*)?  optional "N." numbering prefix (the `1.` in `## 1. Title`),
   *                   number-tolerant so `## Alt Text` matches too
   *   (.+?)       the header name (captured, lazily)
   *   [:.\s]*     optional trailing punctuation / whitespace
   *   $           end of line
   *
   * Applied per-line (see splitSections), so `.` never needs to cross newlines.
   */
  const HEADER_LINE = /^\s*#{1,6}\s*(?:\d+\.?\s*)?(.+?)[:.\s]*$/;

  /**
   * Captures the run of leading hashes on a header line, so its LEVEL can be
   * read as the run's length.
   *
   * `#+` rather than a repeat of HEADER_LINE's own bound: the bound is
   * HEADER_LINE's business, and this pattern is only ever applied to a line
   * HEADER_LINE has already matched, so the run it sees is one to six.
   */
  const HEADER_LEVEL = /^\s*(#+)/;

  /**
   * The always-returned four-field shape, every key an empty string.
   * A fresh object each call (never a shared mutable default).
   * @returns {{title: string, alt: string, long: string, text: string}}
   */
  function emptyResult() {
    return { title: "", alt: "", long: "", text: "" };
  }

  /**
   * Normalise a captured header name for full-name comparison: lower-cased and
   * inner-whitespace-collapsed, so `Alt Text`, `alt text`, and `alt   text`
   * all compare equal. Full-name equality (not substring) is what stops
   * `Text Content` matching `Alt Text` — both contain the word "Text".
   * @param {string} raw
   * @returns {string}
   */
  function normaliseName(raw) {
    return raw.trim().replace(/\s+/g, " ").toLowerCase();
  }

  /**
   * If `line` is a markdown header whose name is one of the four known section
   * names, return that section's output field; otherwise return null (a header
   * we don't recognise, or a non-header line).
   * @param {string} line
   * @returns {string|null} output field ("title" | "alt" | "long" | "text") or null
   */
  function fieldForHeaderLine(line) {
    const match = HEADER_LINE.exec(line);
    if (!match) return null;
    const name = normaliseName(match[1]);
    // Object.create(null) map → own-property lookup is safe without hasOwnProperty.
    const field = NAME_TO_FIELD[name];
    return field || null;
  }

  /**
   * The heading LEVEL of a line — the number of leading hashes. Only ever
   * called on a line HEADER_LINE has already matched, so the answer is 1-6.
   * @param {string} line
   * @returns {number} 1-6, or 0 for a line carrying no hashes at all
   */
  function headerLevel(line) {
    const match = HEADER_LEVEL.exec(line);
    return match ? match[1].length : 0;
  }

  /**
   * Has this field already collected a line with something on it? Blank lines
   * do not count: a body is joined and TRIMMED on the way out, so a bucket
   * holding only blank lines yields `""` and is not yet populated.
   * @param {string[]|undefined} collected
   * @returns {boolean}
   */
  function hasContent(collected) {
    return (
      Array.isArray(collected) && collected.some((line) => line.trim() !== "")
    );
  }

  /**
   * THE BOUNDARY DECISION. Does this line OPEN a section, and which one?
   *
   * A recognised header name is necessary but no longer sufficient. Two further
   * conditions apply, and each exists to stop a heading INSIDE a section body
   * being mistaken for the start of the next one:
   *
   * 1. LEVEL. The document's section level is taken from the FIRST recognised
   *    header and never revised. The prompt emits `## 1. Title`, but a model
   *    that uses another level uniformly is still correct, so the level is
   *    read from the response rather than assumed. A header DEEPER than that
   *    level is a subheading within the open section and is kept as content —
   *    even when its name is one of the four. A header at the level, or
   *    SHALLOWER than it, is a boundary: that is what a shallower heading
   *    means everywhere else markdown is read, and treating one as content
   *    would swallow a legitimately-named section into its predecessor.
   *
   *    Pinning to the FIRST header, rather than re-establishing on each
   *    shallower one, is deliberate. Re-establishing would make every later
   *    header deeper than the new level, so a single stray shallow heading
   *    would swallow the whole remainder of the response.
   *
   * 2. THE RE-OPEN GUARD. A header naming a field that has already collected
   *    content does not re-open it. Re-opening appended the second run of
   *    content onto the first, so a stray `## Title` inside a description
   *    WOULD arrive glued onto the real title, with the description
   *    truncated ahead of it. That is measured against synthetic responses
   *    (PARSE-G, PARSE-F1); no real generation has been observed doing it.
   *    Suppressed, the line falls through and becomes content of
   *    whichever section is currently open — nothing is dropped, and the stray
   *    heading stays visible in the body where a reader can see it.
   *
   * `state.sectionLevel` starts null and is set here on the first recognised
   * header; `state.bodies` is the same bucket map `parse` accumulates into.
   *
   * @param {string} line
   * @param {{sectionLevel: number|null, bodies: Object<string, string[]>}} state
   * @returns {string|null} the field this line opens, or null if it does not
   */
  function sectionBoundaryField(line, state) {
    const field = fieldForHeaderLine(line);
    if (!field) return null;

    const level = headerLevel(line);

    // The first recognised header sets the level everything else is judged
    // against. It is therefore always a boundary: nothing is deeper than a
    // level that does not exist yet, and no bucket has content yet.
    if (state.sectionLevel === null) {
      state.sectionLevel = level;
    }

    if (level > state.sectionLevel) {
      logDebug("reserved name kept as content — deeper than the section level", {
        field,
        level,
        sectionLevel: state.sectionLevel,
      });
      return null;
    }

    if (hasContent(state.bodies[field])) {
      logWarn(`re-open suppressed for an already-populated field: ${field}`);
      return null;
    }

    return field;
  }

  // ---------------------------------------------------------------------------
  // PARSE — the pure four-field stage (S2F-D5)
  // ---------------------------------------------------------------------------

  /**
   * Parse raw generation text into the four-field description shape.
   *
   * Conforming input (one or more of the four `## ` section headers present):
   * each field's value is the trimmed BODY between its header and the next
   * recognised header (the header line itself never leaks into a value). A
   * section the model omitted is `""`, not an error.
   *
   * Non-conforming input (NO recognised section header — free-form prose or
   * garbage): the whole trimmed text goes to `long`; `title`/`alt`/`text` stay
   * empty. This is the F8 rule.
   *
   * Never throws; always returns all four keys as strings.
   *
   * @param {string} rawText — the generation TEXT ONLY (never the result object).
   * @returns {{title: string, alt: string, long: string, text: string}}
   */
  function parse(rawText) {
    const result = emptyResult();

    // Non-string / nullish / empty / whitespace-only → all four empty.
    if (typeof rawText !== "string" || rawText.trim() === "") {
      return result;
    }

    // Walk line by line, opening a new section each time a recognised header
    // line appears and accumulating body lines into whichever section is open.
    const lines = rawText.split(/\r\n|\r|\n/);
    /** @type {string|null} field currently being accumulated */
    let current = null;
    /** @type {Object<string, string[]>} field → collected body lines */
    const bodies = Object.create(null);
    let sawHeader = false;
    /** Boundary state: the level taken from the first recognised header. */
    const state = { sectionLevel: null, bodies };

    for (const line of lines) {
      const field = sectionBoundaryField(line, state);
      if (field) {
        // A section boundary opens that field. The header line is consumed,
        // not stored. A header that names a field but is NOT a boundary —
        // deeper than the section level, or naming a field that already has
        // content — returns null above and falls through to the body push
        // below, so it is kept verbatim inside whichever section is open.
        sawHeader = true;
        current = field;
        if (!bodies[current]) bodies[current] = [];
        continue;
      }
      // A body line before any header (preamble) is ignored — the conforming
      // format has no content above ## 1. Title. Once a section is open, the
      // line belongs to it verbatim.
      if (current) {
        bodies[current].push(line);
      }
    }

    if (!sawHeader) {
      // Non-conforming: no structure at all → whole text is the long
      // description (F8). title/alt/text stay empty.
      result.long = rawText.trim();
      logDebug(
        "no section headers found — mapping free-form text to long description (F8)",
        { length: result.long.length },
      );
      return result;
    }

    // Conforming (or partially so): trim each collected body into its field.
    // Bodies are returned literally — e.g. a Text Content sentinel
    // "No text content." is passed through, NOT interpreted as empty (that is
    // the downstream write stage's policy, not the parser's).
    for (const section of SECTIONS) {
      const collected = bodies[section.field];
      if (collected) {
        result[section.field] = collected.join("\n").trim();
      }
    }

    return result;
  }

  logInfo("MathPixAltTextParser ready (pure four-field parse)");

  return {
    parse,
    SECTIONS,
  };
})();

// Attach at definition time only (guarded so the module also loads cleanly in
// node with no `window`, proving purity).
if (typeof window !== "undefined") {
  window.MathPixAltTextParser = MathPixAltTextParser;
}
