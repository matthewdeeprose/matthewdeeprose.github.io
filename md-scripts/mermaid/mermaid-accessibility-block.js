/**
 * Mermaid Accessibility - Block Diagram Module
 *
 * Generates accessible descriptions for `block-beta` diagrams from the shared
 * parse adapter's BLOCK surface (mermaid-parse-adapter.js), never from the SVG
 * and never from the diagram source. The sixteenth description generator and
 * the tenth adapter-consuming one.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-block-gold-targets-2026-09-05.md - rules B1 to B12 and rulings
 * R1 to R6 (VERSION 1, FROZEN 13 September 2026, approved by Matthew from the
 * review page the same day) - and six byte-exact approved targets. A mismatch
 * between this module's output and a target is a STOP that goes back to the
 * design seat; it is never a reason to edit a target or a fixture. Register
 * item 80.
 *
 * WHY THE SURFACE IS DB-ONLY, AND WHY THIS FILE HOLDS NO REGEX. Ruling R1: the
 * census measured every fact the canvas draws arriving in the db, and measured
 * `decodeAuthorText` matching the canvas byte for byte on author-typed
 * character references where `decodePlaceholders` disagrees. The adapter
 * applies that decode to every author-text field it delivers - block labels and
 * edge labels, each measured separately rather than one inherited from the
 * other - so THIS MODULE NEVER DECODES; it only escapes, once, at the HTML
 * sink.
 *
 * THERE IS NO TITLE CLAUSE, ON EITHER TIER, AND NO AUTHOR OVERRIDE ROUTE
 * (rules B2's neighbour B10, ruling R2). The block db carries no
 * `getDiagramTitle`, `getAccTitle` or `getAccDescription` at all; `accTitle`
 * and `accDescr` are HARD PARSE ERRORS on this grammar, a body `title`
 * statement lexes as three phantom blocks, and a frontmatter `title:` reaches
 * neither the db, nor Mermaid's shared store, nor the canvas. So there is no
 * untitled clause to drop and no fallback title to invent - a narrated one
 * would be a fabrication under B11. The core's X3 override path cannot fire on
 * this type either; register item 81 carries the fallback-wording defect that
 * follows from it.
 *
 * ONE GRID FUNCTION, AND IT IS THE CHOKE POINT FOR EVERY POSITION FACT.
 * `layoutGrid` is called from exactly one place, `layoutTree`, and its output
 * feeds the short tier's row count R, the Blocks list's rows, and B8's spatial
 * relations. There is deliberately no second computation of a position
 * anywhere in this file: the flowchart arc shipped two computations of one
 * fact and they disagreed, and R6's relations are derived from the very grid
 * the Blocks list narrates precisely so that the two lists cannot contradict
 * each other.
 */
(function () {
  "use strict";

  // Logging configuration (inside module scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Current logging level
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  // Helper functions for logging level checks
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  // Logging helper methods
  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(message);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(message);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(message);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(message);
    }
  }

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("[Mermaid Accessibility] Core module not loaded!");
    return;
  }

  // ---------------------------------------------------------------------
  // The shared prose layer, resolved AT CALL TIME and never cached
  // ---------------------------------------------------------------------
  //
  // A module-scope `const Common = window.MermaidAccessibilityCommon` captures
  // `undefined` permanently if this file ever loses the load race, and the
  // symptom is a TypeError deep inside a tier rather than anything naming the
  // load order. One property read per call cannot go stale. (Sequence, gantt,
  // XY chart and quadrant precedent.)

  /**
   * The shared prose layer (narrationNumber, escapeHtml).
   * @returns {Object} MermaidAccessibilityCommon
   */
  function common() {
    return window.MermaidAccessibilityCommon;
  }

  /**
   * Escape one string of AUTHOR TEXT for an HTML sink.
   *
   * Knowledge base section 14.2 and rule B12: the caller escapes, exactly once,
   * at the point the field enters the HTML; generator furniture - the tags, the
   * quotation marks around a label, the commas, the "and" - is never escaped.
   * The PLAIN short tier is raw author text and calls none of this.
   *
   * @param {string} text - Author text
   * @returns {string} The escaped string
   */
  function escapeText(text) {
    return common().escapeHtml(text);
  }

  /**
   * Narration count: words for zero to nine, digits from 10 (ruling R5).
   *
   * REUSED FROM `MermaidAccessibilityCommon`, not reimplemented:
   * `narrationNumber` already carries exactly R5's convention, which is the one
   * gantt G4 and the sequence document use. There is deliberately no second
   * number-to-word route in this file.
   *
   * @param {number} value - The count
   * @returns {string} The count as it is spoken
   */
  function countWord(value) {
    return common().narrationNumber(value);
  }

  /**
   * A count and its noun: "six blocks", "one block".
   * @param {number} value - The count
   * @param {string} singular - The singular noun
   * @param {string} plural - The plural noun
   * @returns {string} The counted noun
   */
  function countedNoun(value, singular, plural) {
    return `${countWord(value)} ${value === 1 ? singular : plural}`;
  }

  // ---------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------

  // Rule B5's row ordinals, as words. There is no ordinal helper in
  // `MermaidAccessibilityCommon` - checked, not assumed - so this is local.
  // WORDS TO NINE, DIGITS FROM TEN, ruled at R8 on 13 September 2026, which is
  // R5's count convention reaching the one number B5 had stated only by
  // example. This comment previously read "UNRULED ABOVE NINE" and reported
  // the digit form as an unruled edge; the edge is now closed and the
  // behaviour is unchanged.
  const ROW_ORDINAL_WORDS = Object.freeze([
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
  ]);

  // THE B6 SHAPE TABLE, keyed on the db's OWN delivered shape string and never
  // on the author's spelling (ruling R3). The nouns are this document's own:
  // flowchart R25 supplies none to borrow, giving three shapes a
  // generator-owned colon prefix and ruling every other shape unnarrated.
  //
  // `square` is ABSENT DELIBERATELY - it is the default and takes no qualifier,
  // so a lookup miss and "the default shape" are the same answer here.
  // `block_arrow` is absent because B6 gives it an arrow clause rather than a
  // shape noun; `composite` is absent because B7 owns it; `space` is absent
  // because B5 owns it and a space is a cell rather than a block (B2). Putting
  // any of the three here would give one block two competing sentences.
  //
  // The mapping is NOT injective, on purpose: lean_right and lean_left share a
  // noun, and trapezoid and inv_trapezoid share a noun, because the pairs
  // differ only in which way the slope leans.
  const SHAPE_NOUNS = Object.freeze({
    round: "a rounded block",
    stadium: "a pill-shaped block",
    subroutine: "a subroutine block",
    cylinder: "a cylinder",
    circle: "a circle",
    doublecircle: "a double circle",
    rect_left_inv_arrow: "an asymmetric block",
    diamond: "a diamond",
    hexagon: "a hexagon",
    lean_right: "a slanted block",
    lean_left: "a slanted block",
    trapezoid: "a trapezium",
    inv_trapezoid: "a trapezium",
  });

  // Rule B6's block-arrow clause. A single delivered token maps to a phrase;
  // `x` reads "left and right" and `y` reads "up and down".
  //
  // THE TWO-TOKEN JOIN IS A LIVE BRANCH, ruled at R17 on 14 September 2026,
  // AND THIS COMMENT SAID THE OPPOSITE. It read: "Measured 5 September 2026:
  // `(x)` delivers `["x"]` and `(y)` delivers `["y"]` - ONE token each - so the
  // two-token join B6 also states is reached by no spelling tried, and is an
  // EDGE GAP in the gold rather than a live branch." That measurement was
  // correct; the generalisation from two spellings to every spelling was not.
  // The comma-separated form `(right, down)` PARSES and delivers
  // `["right","down"]` - measured 14 September 2026, hostile sweep P12 - so
  // R12's own re-open trigger has fired and R17 rules the join stands.
  //
  // WHAT THE CANVAS DRAWS FOR TWO TOKENS IS A TRIANGLE WITH NO HEAD, against a
  // one-headed shaft for `(right)` and a two-headed one for `(x)`. The module
  // is faithful to the DELIVERY and the delivery to the db; the divergence is
  // upstream and is register item 83. Nothing here should be read as a
  // mechanism for it - it is NOT ISOLATED.
  const DIRECTION_PHRASES = Object.freeze({
    right: "right",
    left: "left",
    up: "up",
    down: "down",
    x: "left and right",
    y: "up and down",
  });

  // Rule B8's end-head decorations, keyed on the delivered `arrowTypeEnd`
  // string, on sequence S7's pattern. `arrow_point` - which `-->`, `---`,
  // `<-->` and a labelled link all deliver - takes no decoration and is absent
  // here. Only `--o` and `--x` draw differently and only those two are
  // distinguished in the db.
  const END_DECORATIONS = Object.freeze({
    arrow_circle: ", marked with a circle",
    arrow_cross: ", marked with a cross",
  });

  // RULE B1's N-ZERO SENTENCES, ruled at R10 on 13 September 2026, CONFIRMED
  // AND GIVEN THEIR TRIGGER at R15 on 14 September 2026.
  //
  // THE TRIGGER IS ZERO NON-SPACE BLOCKS - N as B2 counts it - and NOT an
  // empty cell list. That is what makes the three authorable spellings read
  // alike: a lone `columns` declaration, a lone `classDef`, and a lone `space`
  // (R18). All three were measured authorable on 14 September 2026, hostile
  // sweep P02; only the bare `block-beta` header is a parse error.
  //
  // NO GRID CLAUSE, because a diagram with nothing in it should not report a
  // layout - the canvas draws zero text nodes, zero foreignObjects and zero
  // node groups. NO ARROWS CLAUSE EITHER, and that is NOT a branch below:
  // every edge this grammar accepts names two block ids, so a diagram with no
  // blocks has no edge to count, and an `M arrows` branch here would be dead
  // code for a case that cannot reach it.
  //
  // The two strings are stated once each and never assembled from the grid
  // path, so no future change to `gridClause` can leak a row count into them.
  const NO_BLOCKS_SHORT = "A block diagram with no blocks.";
  const NO_BLOCKS_OVERVIEW = "This block diagram shows no blocks.";

  // The db's own shape string for a space cell and for a group, named once so
  // no test in this file spells either inline.
  const SHAPE_SPACE = "space";
  const SHAPE_COMPOSITE = "composite";
  const SHAPE_BLOCK_ARROW = "block_arrow";

  // ---------------------------------------------------------------------
  // Labels and names (rules B9, B12)
  // ---------------------------------------------------------------------

  /**
   * A block's narrated name (rule B9).
   *
   * Labels are verbatim, never inflected, never re-cased. A block with no label
   * narrates the id, because that is what the canvas draws; ids are otherwise
   * never narrated. THE LIVE CASE IS A COMPOSITE: the db delivers the empty
   * string for a group's label - not the id, not absent - measured across four
   * sources at the surface, and gold exemplar E4 pins the result ("server").
   *
   * THIS IS THE ABSENT-LABEL ARM ONLY. A label that is present and TRIMS to
   * empty is a different case with a different sentence (R14 LIFTED); it is
   * intercepted by `namePhrase` before reaching here, so nothing below has to
   * know about it.
   *
   * @param {Object} block - A delivered block
   * @returns {string} The name to narrate
   */
  function nameOf(block) {
    if (typeof block.label === "string" && block.label.length > 0) {
      return block.label;
    }
    return typeof block.id === "string" ? block.id : "";
  }

  /**
   * Is this block's label PRESENT and yet TRIMS TO EMPTY (rule B9, R14 LIFTED)?
   *
   * The two conditions are both load-bearing and the second alone would be
   * wrong: an ABSENT label and a WHITESPACE label are different cases with
   * different sentences, because the canvas treats them differently. Measured
   * 14 September 2026, hostile sweep P03 and P14 - for `a[" "]` the canvas
   * draws one U+0020 in a box of ordinary size and NO ID ANYWHERE, so the
   * reader sees a blank box; for a bare `a` with no label at all the canvas
   * DRAWS THE ID. So `""` must fall through to `nameOf`'s id fallback and
   * `" "` must not.
   *
   * @param {Object} block - A delivered block
   * @returns {boolean} True only for a present, all-whitespace label
   */
  function labelTrimsToEmpty(block) {
    return (
      typeof block.label === "string" &&
      block.label.length > 0 &&
      block.label.trim() === ""
    );
  }

  /**
   * THE ONE PLACE A BLOCK'S NAME BECOMES A PHRASE (rules B9, B12, R14 LIFTED).
   *
   * Ordinary blocks read as the quoted, escaped name. A block whose label
   * TRIMS TO EMPTY reads as an UNLABELLED BLOCK naming its id in the
   * generator's own quotes:
   *
   *     Unlabelled block "b".                       as a cell
   *     "A" points to unlabelled block "b", ...     inside an arrow sentence
   *
   * The id is NOT narrated bare and quoted here, which is what the absent-label
   * arm does: a bare `"b"` would tell a reader the author wrote `b`, and the
   * author wrote a space. The qualifier is generator-owned, which is the
   * ledger's entry-9 device, and it is why the two arms are distinguishable by
   * ear at all.
   *
   * CAPITALISATION IS BY POSITION, not by caller taste: the phrase opens a
   * sentence in a cell `<li>` and in the START half of an arrow sentence, and
   * sits mid-sentence as an arrow's TARGET. R14 LIFTED gives one example of
   * each form and this is the rule that makes both true without ever opening a
   * sentence in lower case.
   *
   * @param {Object} block - A delivered block, never a space
   * @param {boolean} sentenceInitial - Does this phrase open its sentence?
   * @returns {string} The phrase, escaped, ready for the HTML sink
   */
  function namePhrase(block, sentenceInitial) {
    if (labelTrimsToEmpty(block)) {
      const opener = sentenceInitial ? "Unlabelled block" : "unlabelled block";
      const id = typeof block.id === "string" ? block.id : "";
      return `${opener} ${quoted(id)}`;
    }
    return quoted(nameOf(block));
  }

  /**
   * A name, quoted and escaped for the HTML sink (rules B9, B12).
   * @param {string} name - The name
   * @returns {string} The quoted, escaped name
   */
  function quoted(name) {
    return `"${escapeText(name)}"`;
  }

  // ---------------------------------------------------------------------
  // THE ONE GRID FUNCTION (rule B3)
  // ---------------------------------------------------------------------

  /**
   * A block's declared span in columns, defaulting to one.
   *
   * A SPACE CELL IS ONE COLUMN. The surface delivers that, since 13 September
   * 2026 - it used to map the db's `width` onto this name, which gave every
   * cell of a `space:2` a span of two and broke the grid (surface
   * contradiction C1, as amended; ruling R7).
   *
   * @param {Object} block - A delivered block
   * @returns {number} The span, at least one
   */
  function spanOf(block) {
    return typeof block.widthInColumns === "number" && block.widthInColumns >= 1
      ? block.widthInColumns
      : 1;
  }

  /**
   * LAY ONE GRID OUT - the choke point for every position fact in this file.
   *
   * Rule B3 as ruled at R19 on 15 September 2026, exactly: TWO COUNTERS over
   * one grid's cells in delivered order. SPACES ARE CELLS HERE (rule B2) and
   * are laid out like any other cell - they are excluded from the block COUNT,
   * not from the layout.
   *
   * The SPILL counter starts at zero and advances by each cell's span WITHOUT
   * EVER RESETTING, and the row is `floor(spill / C) + 1` read BEFORE the
   * cell's own span is added. The COLUMN CURSOR gives the column, `cursor + 1`,
   * and advances by the span; it RESETS TO ZERO whenever the row changes, which
   * is what makes a cell that overflows its row force the next cell to column
   * one. When the grid declares no columns there is no row arithmetic to do and
   * only the cursor runs, so every cell is on row one.
   *
   * A CELL IS NEVER MOVED TO AVOID THE ROW END. It is drawn overflowing the
   * grid and the canvas widens to let it, which is the half of R16 that
   * survived into R19 and was never in dispute.
   *
   * THIS REPLACED AN UNRULED GUARD THAT WAS WRONG, and the measurement is worth
   * carrying because the corpus could not have caught it. The previous code
   * wrapped a cell whose span exceeded the columns REMAINING, guarded on the
   * cell not already starting a row. Against the canvas that is wrong on 7 of
   * the 25 cells the rows record measures, 5 of them on the ROW - and wrong on
   * sources where no cell exceeds the whole grid, so the gap was never only the
   * over-wide case F2 named. The sweep's cells-spill account, which was the
   * obvious repair, gets every row right and misses 4 columns, every one of
   * them the cell immediately after an overflow; the cursor reset above is
   * exactly what those four need. Row and column for 25 cells across 8 sources
   * and 9 grids, each rendered twice with the readings compared, with Mermaid's
   * own post-layout `size` agreeing on 25 of 25 through a different surface:
   * docs/mermaid-item-80-rows-2026-09-15.md.
   *
   * THE FLIP SET OVER THE 215-FIXTURE CORPUS WAS ZERO, which is not reassurance
   * - it is the finding that every wrap in the corpus lands exactly on a row
   * boundary, the one case all three accounts agree about. The three
   * `block-rows/` fixtures added with R19 are what hold this function from now
   * on; before them nothing in the gate reached it.
   *
   * @param {Array<Object>} children - The cells of one grid, in declaration order
   * @param {number|null} columns - The grid's OWN declared column count, or null
   * @returns {Array<Object>} One `{ block, row, column, width }` per cell
   */
  function layoutGrid(children, columns) {
    const declared =
      typeof columns === "number" && columns >= 1 ? columns : null;
    const placements = [];
    let spill = 0;
    let cursor = 0;
    let lastRow = 0;

    (Array.isArray(children) ? children : []).forEach((block) => {
      const width = spanOf(block);
      const row = declared === null ? 1 : Math.floor(spill / declared) + 1;

      if (row !== lastRow) cursor = 0;

      placements.push({
        block: block,
        row: row,
        column: cursor + 1,
        width: width,
      });

      cursor += width;
      spill += width;
      lastRow = row;
    });

    return placements;
  }

  /**
   * Lay out the whole diagram, ONCE, and record every block's position as it
   * goes.
   *
   * The returned placement tree is what the Blocks list renders; the
   * `positions` map it fills is what B8's relations read. Both come from the
   * same `layoutGrid` call, so the two lists cannot disagree about where a
   * block is.
   *
   * THE GRID KEY IS A FRESH OBJECT PER GRID, NOT A STRING. An author may
   * legally name a block "root", and a string sentinel would make a group's
   * grid compare equal to the root grid and manufacture a relation across two
   * incommensurable numberings (ruling R6, and the same choice the derivation
   * instrument made).
   *
   * @param {Array<Object>} children - The cells of one grid, in declaration order
   * @param {number|null} columns - The grid's own declared column count, or null
   * @param {Object} positions - Accumulator: block id to `{ grid, row, column }`
   * @returns {Array<Object>} Placements, each group carrying its own `children`
   */
  function layoutTree(children, columns, positions) {
    const grid = {};
    const placements = layoutGrid(children, columns);

    placements.forEach((placement) => {
      const block = placement.block;
      if (block.shape !== SHAPE_SPACE && typeof block.id === "string") {
        positions[block.id] = {
          grid: grid,
          row: placement.row,
          column: placement.column,
        };
      }
      if (isGroup(block)) {
        placement.children = layoutTree(block.children, block.columns, positions);
      }
    });

    return placements;
  }

  /**
   * Is this delivered block a group (rule B7)?
   *
   * Tested on the db's own shape string AND on the delivered children, because
   * the two answer slightly different questions and B7 has an empty-group form:
   * a composite with no children is still a group.
   *
   * @param {Object} block - A delivered block
   * @returns {boolean} True for a composite
   */
  function isGroup(block) {
    return block.shape === SHAPE_COMPOSITE;
  }

  // ---------------------------------------------------------------------
  // Counts (rules B1, B2, and R6's per-block count)
  // ---------------------------------------------------------------------

  /**
   * N - every block at every depth that is NOT a space (rule B2).
   *
   * A group counts as a block and so do its members. Spaces count as cells for
   * row derivation (B3) and never as blocks.
   *
   * @param {Array<Object>} blocks - The delivered block tree
   * @returns {number} N
   */
  function countBlocks(blocks) {
    let total = 0;
    (Array.isArray(blocks) ? blocks : []).forEach((block) => {
      if (block.shape !== SHAPE_SPACE) {
        total += 1;
      }
      if (Array.isArray(block.children) && block.children.length > 0) {
        total += countBlocks(block.children);
      }
    });
    return total;
  }

  /**
   * The per-block arrow count B6's last qualifier reads (ruling R6).
   *
   * N is the count of delivered edges touching the block at EITHER end, and an
   * edge whose start and end are the same block counts ONE rather than two.
   *
   * A GROUP'S COUNT IS THE EDGES TOUCHING THE GROUP'S OWN ID, never its
   * members'. That falls out of counting ids rather than being a special case:
   * an edge into a group is drawn at the group's own border, which is what the
   * sighted reader is shown, and rolling the members' edges up would narrate a
   * count the canvas does not draw (B11).
   *
   * @param {Array<Object>} edges - The delivered edges
   * @returns {Object} Block id to count; an absent id means zero
   */
  function arrowCounts(edges) {
    const counts = {};
    const bump = (id) => {
      if (typeof id !== "string") return;
      counts[id] = (counts[id] || 0) + 1;
    };

    (Array.isArray(edges) ? edges : []).forEach((edge) => {
      if (edge.start === edge.end) {
        bump(edge.start);
        return;
      }
      bump(edge.start);
      bump(edge.end);
    });

    return counts;
  }

  // ---------------------------------------------------------------------
  // Cell sentences (rules B5, B6, B7)
  // ---------------------------------------------------------------------

  /**
   * Rule B6's block-arrow clause - the directions a drawn arrow points.
   *
   * A single delivered token maps through DIRECTION_PHRASES; two or more join
   * with "and" in DELIVERED order, which B6 states and which the
   * comma-separated spelling `(right, down)` REACHES - ruled at R17 on 14
   * September 2026, after the hostile sweep fired R12's re-open trigger. The
   * join is a live branch with a fixture, not a retained-unreachable one.
   *
   * An EMPTY directions array yields "" and the qualifier is dropped rather
   * than rendered as a clause with nothing after "pointing". Unruled in the
   * gold and reported as an unruled edge; the warning is what makes it visible.
   *
   * @param {Array<string>} directions - The delivered directions
   * @returns {string} The phrase, or ""
   */
  function directionPhrase(directions) {
    const tokens = Array.isArray(directions) ? directions : [];
    const phrases = tokens.map((token) => {
      if (Object.prototype.hasOwnProperty.call(DIRECTION_PHRASES, token)) {
        return DIRECTION_PHRASES[token];
      }
      logWarn(
        `[Mermaid Accessibility] Block arrow carries an unmapped direction: ${token}`
      );
      return null;
    });
    const usable = phrases.filter((phrase) => phrase !== null);
    if (usable.length === 0) return "";
    return usable.join(" and ");
  }

  /**
   * Rule B6's qualifiers for one cell, in the rule's own order, each present
   * only when it fires: SHAPE, BLOCK ARROW, SPAN, ARROWS.
   *
   * The ARROWS qualifier is LAST (ruling R6) and is ABSENT WHEN THE COUNT IS
   * ZERO. That absence is the ruling rather than an optimisation: ", with no
   * arrows" would put a clause on seven of gold exemplar E6's ten blocks to
   * report nothing.
   *
   * @param {Object} block - A delivered block
   * @param {number} arrows - The block's arrow count
   * @returns {string} The qualifiers, joined, or ""
   */
  function cellQualifiers(block, arrows) {
    const parts = [];

    const noun = SHAPE_NOUNS[block.shape];
    if (noun) {
      parts.push(`, shown as ${noun}`);
    }

    if (block.shape === SHAPE_BLOCK_ARROW) {
      const phrase = directionPhrase(block.directions);
      if (phrase) {
        parts.push(`, shown as an arrow pointing ${phrase}`);
      }
    }

    const width = spanOf(block);
    if (width >= 2) {
      parts.push(`, spanning ${countWord(width)} columns`);
    }

    if (arrows > 0) {
      parts.push(`, with ${countedNoun(arrows, "arrow", "arrows")}`);
    }

    return parts.join("");
  }

  /**
   * Rule B7's qualifiers for a GROUP: span, then arrows, and no shape noun.
   *
   * A composite's delivered shape is `composite`, which the B6 table
   * deliberately omits, and a group is never a block arrow - so reusing
   * `cellQualifiers` would be correct today and would silently acquire a shape
   * sentence the day the table grew a `composite` row. The order R6 fixed is
   * stated here in its own function for that reason.
   *
   * @param {Object} block - A delivered composite
   * @param {number} arrows - The group's own arrow count
   * @returns {string} The qualifiers, joined, or ""
   */
  function groupQualifiers(block, arrows) {
    const parts = [];

    const width = spanOf(block);
    if (width >= 2) {
      parts.push(`, spanning ${countWord(width)} columns`);
    }

    if (arrows > 0) {
      parts.push(`, with ${countedNoun(arrows, "arrow", "arrows")}`);
    }

    return parts.join("");
  }

  /**
   * Rule B5's empty-space sentence, for a RUN of consecutive space cells
   * rather than for one cell (ruling R7, 13 September 2026).
   *
   * ONE GAP ON THE CANVAS IS ONE SENTENCE. A run of spaces draws a single gap,
   * and `space:K` and K written spaces draw the same gap, so both narrate the
   * same way. Before R7 this took one cell and produced one sentence each, so
   * a `space:2` said "An empty space spanning two columns." twice — and said
   * it about a gap the surface was also sizing wrongly.
   *
   * K IS THE COLUMN TOTAL, SUMMED OVER THE RUN'S PLACEMENTS rather than taken
   * from the cell count, so this sentence and the grid can never disagree:
   * both go through the same `spanOf`.
   *
   * A SPACE BLOCK'S OWN LABEL IS NEVER SPOKEN. The db gives it its generated
   * parent id, which is machine text and non-deterministic between parses
   * (census Q3), so the sentence is generator furniture throughout.
   *
   * @param {number} columns - The columns the whole run occupies
   * @returns {string} The sentence, ending in a full stop
   */
  function spaceRunSentence(columns) {
    return columns >= 2
      ? `An empty space spanning ${countWord(columns)} columns.`
      : "An empty space.";
  }

  // ---------------------------------------------------------------------
  // The Blocks list (rules B4, B5, B7)
  // ---------------------------------------------------------------------

  /**
   * A row ordinal as rule B5 speaks it: "one", "two", "three".
   * @param {number} value - The 1-based row number
   * @returns {string} The ordinal word, or the digits from ten
   */
  function rowOrdinal(value) {
    return value >= 0 && value <= 9 ? ROW_ORDINAL_WORDS[value] : String(value);
  }

  /**
   * Render one cell into its `<li>` lines (rules B5, B6, B7).
   *
   * A group opens its `<li>`, appends its nested `<ol>` ON THE SAME LINE, and
   * closes with `</ol></li>` - the markup gold exemplar E4 pins.
   *
   * SPACES DO NOT REACH HERE. `renderRows` coalesces each run of them into one
   * sentence before calling this (ruling R7), so there is deliberately no
   * space branch: a run is not a cell, and a per-cell function cannot see one.
   *
   * @param {Object} placement - One placement from `layoutTree`, never a space
   * @param {Object} counts - Block id to arrow count
   * @returns {Array<string>} The lines
   */
  function renderCell(placement, counts) {
    const block = placement.block;
    const arrows = counts[block.id] || 0;

    if (isGroup(block)) {
      const opener = `${namePhrase(block, true)}${groupQualifiers(block, arrows)}`;
      const children = placement.children || [];
      if (children.length === 0) {
        return [`<li>${opener}, an empty group.</li>`];
      }
      return [`<li>${opener}, a group containing:<ol>`]
        .concat(renderRows(children, counts))
        .concat(["</ol></li>"]);
    }

    // The name phrase OPENS the cell sentence, so it takes the capitalised
    // form of R14 LIFTED's unlabelled-block reading; the B6 qualifiers follow
    // it in the usual order, which is what makes
    // `Unlabelled block "b", with one arrow.` fall out rather than being a
    // second sentence shape to maintain.
    return [
      `<li>${namePhrase(block, true)}${cellQualifiers(block, arrows)}.</li>`,
    ];
  }

  /**
   * Render one grid's placements as rule B5's rows.
   *
   * Rows are numbered from one INSIDE each grid (rule B7), which falls out of
   * `layoutTree` numbering each grid independently.
   *
   * THIS IS WHERE RUNS OF SPACES ARE COALESCED (ruling R7). A run is broken by
   * any non-space cell and by a row boundary, so two spaces either side of a
   * block are two sentences, and a run spilling from one row into the next is
   * narrated once per row - which is what the canvas draws, since a row break
   * ends the gap.
   *
   * AND THIS IS WHERE EMPTY ROWS ARE NARRATED (ruling R19, 15 September 2026).
   * A cell that overflows far enough skips whole rows - at `columns 1` with
   * `a:3` the canvas draws five rows and rows two and three receive no cell at
   * all - so any gap between the last row emitted and this placement's row is
   * filled with `<li>Row ORDINAL: empty.</li>`, in sequence, with no nested
   * `<ul>` because there is nothing to put in one. THE ROWS ARE NOT DROPPED:
   * B1's R counts them, `measure` reads R off the same placements, and a list
   * jumping from Row one to Row four would disagree with both the count and
   * the canvas. An empty row is NOT an empty space and takes no B5 space
   * sentence - a space is an authored cell the canvas draws a gap for.
   *
   * NO LEADING OR TRAILING GAP IS POSSIBLE and neither is guarded for: the
   * first cell has a spill of zero so it always lands on row one, and R is the
   * highest row any cell reaches, so nothing follows the last.
   *
   * @param {Array<Object>} placements - One grid's placements, in order
   * @param {Object} counts - Block id to arrow count
   * @returns {Array<string>} The lines between `<ol>` and `</ol>`
   */
  function renderRows(placements, counts) {
    const lines = [];
    let current = null;
    let index = 0;

    while (index < placements.length) {
      const placement = placements[index];

      if (placement.row !== current) {
        if (current !== null) {
          lines.push("</ul></li>");
          for (let skipped = current + 1; skipped < placement.row; skipped++) {
            lines.push(`<li>Row ${rowOrdinal(skipped)}: empty.</li>`);
          }
        }
        current = placement.row;
        lines.push(`<li>Row ${rowOrdinal(placement.row)}:<ul>`);
      }

      if (placement.block.shape === SHAPE_SPACE) {
        let cells = 0;
        let columns = 0;
        while (
          index + cells < placements.length &&
          placements[index + cells].row === current &&
          placements[index + cells].block.shape === SHAPE_SPACE
        ) {
          columns += placements[index + cells].width;
          cells += 1;
        }
        lines.push(`<li>${spaceRunSentence(columns)}</li>`);
        index += cells;
        continue;
      }

      renderCell(placement, counts).forEach((line) => lines.push(line));
      index += 1;
    }

    if (current !== null) {
      lines.push("</ul></li>");
    }

    return lines;
  }

  // ---------------------------------------------------------------------
  // The Arrows list (rule B8, ruling R6)
  // ---------------------------------------------------------------------

  /**
   * B8's SPATIAL RELATION, derived from the grid positions B3 assigns - never
   * from the source, never from rendered pixels (ruling R6).
   *
   * IT IS NARRATED ONLY WHEN BOTH ENDPOINTS ARE CELLS OF THE SAME GRID. Where
   * one endpoint is inside a group and the other is outside it, or the two are
   * in different groups, the positions are numbered in different grids and a
   * row or column difference between them would be arithmetic on
   * incommensurable numbers; the sentence is then the bare form. That case is a
   * documented EDGE GAP no exemplar reaches.
   *
   * A block's COLUMN is the column its cell STARTS in; a span does not move it.
   *
   * @param {Object|undefined} from - The start's position
   * @param {Object|undefined} to - The target's position
   * @returns {string} The relation clause, or ""
   */
  function spatialRelation(from, to) {
    if (!from || !to) return "";
    if (from.grid !== to.grid) return "";

    const rows = to.row - from.row;
    const sameColumn = from.column === to.column;

    if (rows === 0) {
      if (to.column > from.column) return ", to its right";
      if (to.column < from.column) return ", to its left";
      return "";
    }

    const distance = Math.abs(rows);
    const vertical = rows > 0 ? "below" : "above";

    if (sameColumn) {
      if (distance === 1) {
        return rows > 0 ? ", directly below" : ", directly above";
      }
      return `, ${countWord(distance)} rows ${vertical}, in the same column`;
    }

    const lateral = to.column > from.column ? "to the right" : "to the left";

    if (distance === 1) {
      return `, in the row ${vertical}, ${lateral}`;
    }
    return `, ${countWord(distance)} rows ${vertical}, ${lateral}`;
  }

  /**
   * One edge's sentence (rule B8).
   *
   * SENTENCE ORDER IS FIXED ONCE BY B8 and is not assembled in two ways:
   * NAME, RELATION, DECORATION, LABEL, full stop.
   *
   * THERE IS ONE REACHABLE HEAD FORM (ruling R4). Every link this grammar
   * accepts delivers `arrowTypeStart` of `arrow_open` and draws one head at the
   * end - measured on all six spellings, and the canvas agrees, `---` and
   * `<-->` rendering byte-identically to `-->` with a null marker-start. So
   * every link reads "points to", and B8's start-head-only, both-heads and
   * no-head forms are retained in the gold as unreachable rather than
   * implemented here as dead branches.
   *
   * A SELF-EDGE reads `"A" points to itself.` with NO relation, because there
   * is no second position to relate to.
   *
   * THE TWO ENDS TAKE DIFFERENT CAPITALISATION and the difference is
   * positional rather than stylistic (R14 LIFTED): the START opens the
   * sentence and the TARGET does not, so an unlabelled block reads
   * `Unlabelled block "b" points to "A"` at one end and
   * `"A" points to unlabelled block "b"` at the other. An ordinary quoted
   * label is unaffected either way, which is why this distinction was
   * invisible before R14 was lifted.
   *
   * @param {Object} edge - A delivered edge
   * @param {Function} phraseFor - Block id to narrated name phrase, given a
   *   sentence-initial flag
   * @param {Object} positions - Block id to `{ grid, row, column }`
   * @returns {string} The `<li>` line
   */
  function renderEdge(edge, phraseFor, positions) {
    const from = phraseFor(edge.start, true);
    const core =
      edge.start === edge.end
        ? `${from} points to itself`
        : `${from} points to ${phraseFor(edge.end, false)}`;

    const relation =
      edge.start === edge.end
        ? ""
        : spatialRelation(positions[edge.start], positions[edge.end]);

    const decoration = END_DECORATIONS[edge.arrowTypeEnd] || "";

    const raw = typeof edge.label === "string" ? edge.label : "";
    const label = raw.trim() === "" ? "" : `, labelled ${quoted(raw)}`;

    return `<li>${core}${relation}${decoration}${label}.</li>`;
  }

  /**
   * A lookup from block id to the name PHRASE rule B9 narrates.
   *
   * IT INDEXES THE BLOCK, NOT THE FINISHED STRING. Before R14 was lifted a
   * block's name was one string whatever the sentence it landed in, so the map
   * could hold the answer; the unlabelled-block form is capitalised by
   * position, so the answer is not known until the call site says where the
   * phrase sits. Indexing the block keeps `namePhrase` the ONE place that
   * decides, which is what stops the Blocks list and the Arrows list drifting
   * apart on the same block.
   *
   * @param {Array<Object>} blocks - The delivered block tree
   * @returns {Function} Block id and a sentence-initial flag, to a phrase
   */
  function makeNameLookup(blocks) {
    const byId = {};
    const walk = (list) => {
      (Array.isArray(list) ? list : []).forEach((block) => {
        if (typeof block.id === "string") {
          byId[block.id] = block;
        }
        walk(block.children);
      });
    };
    walk(blocks);

    return function phraseFor(id, sentenceInitial) {
      if (Object.prototype.hasOwnProperty.call(byId, id)) {
        return namePhrase(byId[id], sentenceInitial);
      }
      // The db composes an edge from the author's own ids, so an edge naming a
      // block that is not delivered is not expected. Falling back to the id
      // keeps the sentence honest rather than printing "undefined"; the warning
      // is what makes it visible.
      logWarn(
        `[Mermaid Accessibility] Block edge names an undelivered block: ${id}`
      );
      return quoted(typeof id === "string" ? id : "");
    };
  }

  // ---------------------------------------------------------------------
  // The Overview sentences and the short tier (rules B1, B12)
  // ---------------------------------------------------------------------

  /**
   * The grid clause both tiers share: "in two rows across three columns".
   *
   * Rule B1's forms: when the root declares no columns R is one and the columns
   * clause is dropped; when columns are declared and R is one it reads "in one
   * row across C columns".
   *
   * @param {number} rows - R
   * @param {number|null} columns - C, or null when the root declared none
   * @returns {string} The clause
   */
  function gridClause(rows, columns) {
    const rowsPart = `in ${countedNoun(rows, "row", "rows")}`;
    if (columns === null) return rowsPart;
    return `${rowsPart} across ${countedNoun(columns, "column", "columns")}`;
  }

  /**
   * Rule B1's counts and grid, measured once and shared by both tiers.
   * @param {Object} diagram - The adapter's normalised block delivery
   * @returns {Object} `{ blocks, rows, columns, arrows, placements, positions }`
   */
  function measure(diagram) {
    const blocks = Array.isArray(diagram.blocks) ? diagram.blocks : [];
    const edges = Array.isArray(diagram.edges) ? diagram.edges : [];
    const columns =
      typeof diagram.rootColumns === "number" && diagram.rootColumns >= 1
        ? diagram.rootColumns
        : null;

    const positions = {};
    const placements = layoutTree(blocks, columns, positions);

    // R comes from the ROOT only (rule B2), and is read off the one layout
    // rather than recomputed.
    //
    // IT COUNTS EMPTY ROWS, ruling R19, and the max is what makes that true
    // without a second branch: under R19 a cell that overflows skips whole
    // rows, and the highest row any cell reaches already includes the ones
    // nothing landed on. `renderRows` narrates the same gaps from the same
    // placements, so the count and the list cannot disagree - at `columns 1`
    // with `a:3 b c` both say five.
    //
    // THE FLOOR AT ONE IS NOW UNREACHABLE BY ANY SENTENCE, and this comment
    // previously said otherwise. It read: "A diagram with no cells at all has
    // no row; B1 states an N-one form and no N-zero form, so this floors at
    // one and the case is reported as an unruled edge." That was accurate
    // about the module's history and STALE about the rule from 13 September
    // 2026, when R10 closed the edge - which is exactly how the module came to
    // narrate `in one row across two columns` over an empty canvas (hostile
    // sweep, finding F1). Since R15 the N-zero tiers return before any grid
    // clause is built, so the floor survives only as the identity for a reduce
    // over an empty array and narrates nothing.
    const rows = placements.reduce(
      (highest, placement) => Math.max(highest, placement.row),
      1
    );

    return {
      blocks: countBlocks(blocks),
      rows: rows,
      columns: columns,
      arrows: edges.length,
      placements: placements,
      positions: positions,
    };
  }

  /**
   * The detailed tier's opening sentence (rule B1).
   *
   * NO TITLE CLAUSE EVER, on either tier (ruling R2). There is nothing to drop
   * and nothing to fall back to - see the file header.
   *
   * @param {Object} facts - From `measure`
   * @returns {string} The sentence
   */
  function buildOverviewSentence(facts) {
    // RULE B1's N-ZERO FORM (R15, and R18 for the all-spaces spelling). The
    // return is BEFORE the grid clause rather than a variant of it, because
    // the ruling drops the layout outright: there is no row to report.
    if (facts.blocks === 0) return NO_BLOCKS_OVERVIEW;

    const arrows =
      facts.arrows === 0
        ? ""
        : `, connected by ${countedNoun(facts.arrows, "arrow", "arrows")}`;
    return `This block diagram shows ${countedNoun(
      facts.blocks,
      "block",
      "blocks"
    )} ${gridClause(facts.rows, facts.columns)}${arrows}.`;
  }

  /**
   * THE ONE SHORT STRING, built once, plain and unescaped (rules B1, B12).
   *
   * The HTML short tier is this string escaped exactly once, and nothing else,
   * so the two tiers cannot disagree about what the diagram says. There is no
   * length-discipline branch: the short carries a block count, a grid and an
   * arrow count, all of them counts of delivered fields, so nothing could be
   * dropped without dropping a fact. The six approved targets run from 45 to 82
   * characters against contract clause C1's 250-character cap.
   *
   * @param {Object} diagram - The adapter's normalised block delivery
   * @returns {string} The plain short tier
   */
  function buildShortText(diagram) {
    const facts = measure(diagram);

    // RULE B1's N-ZERO FORM (R15, and R18 for the all-spaces spelling), the
    // short tier's half. It is stated here rather than shared with the
    // overview through a helper for the same reason B12 builds the short once:
    // the two tiers open with different words and always have, so a shared
    // builder would have to carry the difference anyway.
    if (facts.blocks === 0) return NO_BLOCKS_SHORT;

    const arrows =
      facts.arrows === 0
        ? ""
        : `, and ${countedNoun(facts.arrows, "arrow", "arrows")}`;
    return `A block diagram with ${countedNoun(
      facts.blocks,
      "block",
      "blocks"
    )} ${gridClause(facts.rows, facts.columns)}${arrows}.`;
  }

  // ---------------------------------------------------------------------
  // The registered tiers
  // ---------------------------------------------------------------------

  /**
   * Fetch and verify the diagram, or throw.
   *
   * A parse rejection is deliberately NOT caught - the core's catch turns it
   * into the honest generation-failed fallback. A failed adapter self-check
   * throws for the same reason: never narrate an unverified diagram.
   *
   * `isBlockHealthy()` reads `null` until the lazy self-check settles, which is
   * why the guard tests for `false` rather than falsiness - a `!healthy` test
   * would refuse every first call on a page.
   *
   * THE GUARD RUNS AFTER THE PARSE, WHICH IS THE SEQUENCE MODULE'S ORDER AND
   * NOT THE OTHER WAY ROUND. `parseBlock` is what STARTS the lazy self-check,
   * and the self-check takes its own queue slot ahead of this call's, so a
   * guard placed before the parse reads `null` on the first call of every page
   * and can never refuse - it would be a guard that is off the path it
   * protects on exactly the call where an unhealthy surface matters most.
   * Measured on this page: `isBlockHealthy()` read `null` immediately before a
   * first `parseBlock`. The order is recorded because the dispatch's own
   * wording reads the other way.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} The adapter's normalised block delivery
   */
  async function readBlock(code) {
    const diagram = await window.MermaidParseAdapter.parseBlock(code);
    if (window.MermaidParseAdapter.isBlockHealthy() === false) {
      logWarn(
        "[Mermaid Accessibility] Block self-check failed; refusing to narrate"
      );
      throw new Error(
        "Parse adapter failed its block self-check; refusing to narrate an unverified diagram"
      );
    }
    logDebug(
      `[Mermaid Accessibility] Block delivery: ${
        (diagram.blocks || []).length
      } root cells, rootColumns ${diagram.rootColumns}, ${
        (diagram.edges || []).length
      } edges`
    );
    return diagram;
  }

  /**
   * Generate a short description for a block diagram.
   *
   * The PLAIN form is the tier of record and is never escaped: it reaches a
   * `textContent` sink and the SVG's `aria-label`, where an entity would be
   * announced literally. The HTML form is the same sentence escaped exactly
   * once (rule B12).
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to `{ html, text }`
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating block short description");

    const diagram = await readBlock(code);
    const text = buildShortText(diagram);
    logDebug(`[Mermaid Accessibility] Block short: ${text}`);

    return { html: escapeText(text), text: text };
  }

  /**
   * Wrapper for the short description generator, returning the plain tier.
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the plain text description
   */
  async function shortDescriptionWrapper(svgElement, code) {
    const descriptions = await generateShortDescription(svgElement, code);
    return descriptions.text;
  }

  /**
   * Generate a detailed description for a block diagram.
   *
   * Two or three headed sections in a fixed order (rule B4): Overview, Blocks,
   * and Arrows. Gantt G3's rule that a heading introducing no content is
   * omitted entirely is inherited: a diagram with no edges has no Arrows
   * section at all. No `<section>` wrapper, no Key Insights, no data table.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating block detailed description");

    const diagram = await readBlock(code);
    const facts = measure(diagram);
    const counts = arrowCounts(diagram.edges);
    const phraseFor = makeNameLookup(diagram.blocks);

    const parts = [];
    const pushSection = (heading, lines) => {
      if (!lines || lines.length === 0) return;
      parts.push(`<h4>${heading}</h4>`);
      parts.push(...lines);
    };
    const wrapList = (tag, inner) =>
      inner.length === 0 ? [] : [`<${tag}>`].concat(inner).concat([`</${tag}>`]);

    pushSection("Overview", [`<p>${buildOverviewSentence(facts)}</p>`]);

    // RULE B1's N-ZERO FORM: an Overview and NOTHING ELSE (R15, R18). This is
    // gantt G3's omit-the-empty-section rule, which `wrapList` already applies
    // to Arrows, reaching Blocks for the one case that can empty it.
    //
    // THE GUARD IS ON N AND NOT ON THE ROW LIST BEING EMPTY, and that is R18:
    // a diagram whose cells are ALL SPACES has N zero and a NON-EMPTY row
    // list, because a space is a cell (B2) and `renderRows` narrates its run.
    // A guard on the row list would let that spelling keep a Blocks section
    // reading `An empty space.` under an Overview saying there are no blocks -
    // which is the contradiction the sweep reported at F7. The seat ruled
    // towards R10 rather than towards B5, against the sweep's own
    // recommendation, and this is where that ruling lands.
    //
    // THE ARROWS SECTION NEEDS NO SUCH GUARD: every edge names two block ids,
    // so N zero implies no edges, and `wrapList` drops the empty list already.
    // Stating that rather than writing the branch keeps a dead path out.
    const blocksList =
      facts.blocks === 0 ? [] : renderRows(facts.placements, counts);
    pushSection("Blocks", wrapList("ol", blocksList));
    pushSection(
      "Arrows",
      wrapList(
        "ol",
        (Array.isArray(diagram.edges) ? diagram.edges : []).map((edge) =>
          renderEdge(edge, phraseFor, facts.positions)
        )
      )
    );

    // Newline-joined so text-content extraction stays readable: without them,
    // list and heading boundaries concatenate with no space.
    return parts.join("\n");
  }

  // Register with the core module. `generateShort` returns plain text because
  // the core assigns its result straight to descriptions.short, which reaches
  // the figcaption and the SVG aria-label.
  //
  // THE KEY IS "block", WHICH IS THE PROJECT KEY MERMAID'S OWN "block" MAPS TO
  // - AND THE MAP ENTRY THAT WOULD PERFORM THAT MAPPING DOES NOT EXIST TODAY.
  // Read out of mermaid-diagram-detection.js on 13 September 2026:
  // MERMAID_TYPE_TO_KEY carries no `block` row, so `detectDiagramType` returns
  // the unsupported form `unsupported:block` for a block-beta source - which is
  // exactly what fixture canary-block/columns pins and what the core's
  // UNSUPPORTED_HUMAN_NAMES answers. The core resolves a generator by that
  // string (`descriptionGenerators[diagramType]`), so until the detector gains
  // its one-line entry this registration is REACHED BY NOTHING. That entry is
  // the same one the xychart arc added at 814f0d4 for its own type, and it was
  // outside this session's scope; the rebuild record carries the measurement
  // and the halt.
  //
  // generateShortHTML is the ASYNC shape, and it has to be: this module awaits
  // the parse adapter, so `generateShortDescription(...).html` on the returned
  // promise would be `undefined` and the tier would register, be called, and
  // yield nothing silently (register item 13).
  window.MermaidAccessibility.registerDescriptionGenerator("block", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
  });

  logInfo(
    "[Mermaid Accessibility] Block diagram module loaded and registered on the parse adapter's block surface"
  );
})();
