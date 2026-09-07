/**
 * Mermaid Accessibility - Quadrant Chart Module
 *
 * Generates accessible descriptions for `quadrantChart` diagrams from the
 * shared parse adapter's quadrant surface (mermaid-parse-adapter.js), never
 * from the SVG and never from the diagram source. The eighth
 * adapter-consuming generator.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-quadrant-gold-targets-2026-09-01.md — rules Q1 to Q14, rulings
 * R1 to R9, and six byte-exact approved targets. A mismatch between this
 * module's output and a target is a STOP that goes back to the design seat; it
 * is never a reason to edit a target or a fixture.
 *
 * WHY THE REWRITE. The module this replaces read the diagram source with its
 * own hand-written regexes, in 319 lines, and three of its defects were
 * factual rather than stylistic:
 *
 *   - Its point regex could not match Mermaid's own `Name:::class:` syntax, so
 *     every styled point was DROPPED IN SILENCE. A three-point chart narrated
 *     "1 data point" and said nothing about the two it had lost. Gold exemplar
 *     E4 exists to pin the repair.
 *   - It fabricated a title. An untitled chart was narrated as an empty quoted
 *     string or as the generic "Quadrant Chart"; rule Q1 forbids both, and an
 *     untitled chart now simply drops the title clause.
 *   - It classified a point within 0.02 of the centre line as "on the
 *     boundary", so a point at 0.49 was not said to be in the left half. Rule
 *     Q4 and ruling R4 replace that band with a strict comparison against 0.5,
 *     with an explicit boundary class for a coordinate that IS exactly 0.5.
 *
 * Two whole mechanisms are deleted rather than repaired, on the grounding
 * session's measurements (docs/mermaid-item-69-quadrant-grounding-2026-09-01.md
 * part B1):
 *
 *   - THE SVG FALLBACK. It was reachable on every production call, and inert:
 *     all five of its selectors matched zero elements in Mermaid 11.6.0's
 *     quadrant SVG, and its point branch read `width="100%"` and a missing
 *     `height`, so every recovered point would have kept a hard-coded centre
 *     position. Dead code that would ACTIVATE on an upstream change is worse
 *     than either working code or absent code — item 67's state-diagram defect
 *     is the same hazard in its live form.
 *   - `const Utils = window.MermaidAccessibilityUtils`. Measured at zero uses.
 *
 * THE SOURCE IS READ BEHIND THE ADAPTER'S QUEUE, NOT HERE. Mermaid's quadrant
 * db is a shared singleton whose contents a concurrent parse replaces WHOLE —
 * not merely the three shared scalars — so a read outside the adapter's queue
 * slot can return another chart's points while looking live. This module holds
 * no regex of its own for that reason.
 */
(function () {
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
  // load order. One property read per call cannot go stale. (XY chart and
  // gantt precedent; the module this replaces used the cached-alias form.)

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
   * Knowledge base § 14.2: the caller escapes, exactly once, at the point the
   * field enters the HTML; generator furniture — the tags, the quotation marks
   * around a label, the commas, the "and", the brackets around a position — is
   * never escaped; list items are escaped before a join, never after. The
   * PLAIN short tier is raw author text and calls none of this.
   *
   * @param {string} text - Author text
   * @returns {string} The escaped string
   */
  function escapeText(text) {
    return common().escapeHtml(text);
  }

  /**
   * The identity transform, for the PLAIN tier. Passed where an HTML sink
   * would pass `escapeText`, so one builder serves both tiers and neither can
   * drift from the other.
   * @param {string} text - Author text
   * @returns {string} The same text
   */
  function rawText(text) {
    return String(text);
  }

  /**
   * Narration count: words for zero to nine, digits from 10 (rule Q10). The
   * one number-to-word route in this module — there is deliberately no second
   * computation of it.
   * @param {number} value - The count
   * @returns {string} The count as it is spoken
   */
  function countWord(value) {
    return common().narrationNumber(value);
  }

  /**
   * A count and its noun: "three points", "one point".
   * @param {number} value - The count
   * @param {string} singular - The singular noun
   * @param {string} plural - The plural noun
   * @returns {string} The counted noun
   */
  function countedNoun(value, singular, plural) {
    return `${countWord(value)} ${value === 1 ? singular : plural}`;
  }

  /**
   * A point's position among the points sharing its name, as a word (rule Q15,
   * new 1 September 2026, VERSION 2, ruling R14). "first", "second" … "ninth",
   * then "10th".
   *
   * COPIED FROM GANTT, NOT IMPORTED. `mermaid-accessibility-gantt.js` grew the
   * identical function for rules G5/G11 on 30 August 2026, and no module in
   * this engine imports another — each registers itself against the shared
   * core and owns its own vocabulary. The copy is deliberate and the wording is
   * identical on purpose, so a reader who has heard one diagram type address a
   * duplicate hears the next one address it the same way.
   *
   * This is NOT a second number-to-word route to keep in step with
   * `countWord`: that speaks CARDINALS and cannot produce an ordinal, so the
   * two have nothing to disagree about.
   *
   * @param {number} position - The 1-based position
   * @returns {string} The ordinal
   */
  function ordinalWord(position) {
    if (position >= 1 && position <= ORDINAL_WORDS.length) {
      return ORDINAL_WORDS[position - 1];
    }
    const lastTwo = position % 100;
    const lastOne = position % 10;
    const suffix =
      lastTwo >= 11 && lastTwo <= 13
        ? "th"
        : lastOne === 1
          ? "st"
          : lastOne === 2
            ? "nd"
            : lastOne === 3
              ? "rd"
              : "th";
    return `${position}${suffix}`;
  }

  /**
   * A word with its first letter capitalised, for a sentence-initial count.
   *
   * NEVER applied to a whole composed reference: a labelled quadrant's
   * reference opens with a quotation mark, and capitalising through it would
   * either do nothing or alter author text. Sentence-initial capitalisation of
   * a reference is decided by `quadrantRef`'s own `sentenceStart` argument.
   *
   * @param {string} word - The word
   * @returns {string} The word, capitalised
   */
  function capitaliseWord(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  /**
   * Join a list with commas and a final "and", and NO OXFORD COMMA (rules Q5,
   * Q6, Q7, Q8): `"A", "B" and "C"`.
   *
   * MEASURED, NOT ASSUMED, 1 September 2026. `MermaidAccessibilityCommon`'s
   * own `formatList` was read before this was written: on three or more items
   * it returns `${others.join(", ")}, and ${last}` — an Oxford comma — which
   * every quadrant target contradicts. Gantt reached the same conclusion twice
   * and built the join locally in both places; this is the third such site.
   * The shared helper is not changed, because two of its callers in this file's
   * siblings depend on the Oxford form.
   *
   * @param {Array<string>} items - The already-rendered items
   * @returns {string} The joined list
   */
  function joinNames(items) {
    if (!items || items.length === 0) return "";
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  }

  /**
   * Join clauses that each contain their own "and", with a comma before the
   * final conjunction so the reader can hear where one ends and the next
   * begins: `A, and B`.
   *
   * The boundary sentence of rule Q6 is the only user, and gold exemplar E4 is
   * its only witness — `"Offline sync" on the line between "Ship" (top left)
   * and "Bet" (top right), and "Plugin API" at the centre …`. It is a separate
   * helper from `joinNames` precisely so the difference is deliberate rather
   * than a second spelling of the same rule.
   *
   * @param {Array<string>} items - The already-rendered clauses
   * @returns {string} The joined list
   */
  function joinClauses(items) {
    if (!items || items.length === 0) return "";
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
  }

  // ---------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------

  /**
   * Rule Q4's position table, and the ONLY place Mermaid's own quadrant
   * numbering is mentioned.
   *
   * Mermaid numbers anticlockwise from the top right: quadrant-1 top right,
   * quadrant-2 top left, quadrant-3 bottom left, quadrant-4 bottom right. The
   * adapter delivers `quadrants` in that order, so `index` is the offset into
   * it. This array's OWN order is READING ORDER (ruling R1) — top left, top
   * right, bottom left, bottom right — so every list in this module is built
   * by iterating it and cannot fall out of reading order by accident.
   *
   * Positions are never hyphenated (Q4).
   */
  const QUADRANT_POSITIONS = Object.freeze([
    Object.freeze({ index: 1, lower: "top left", capital: "Top left" }),
    Object.freeze({ index: 0, lower: "top right", capital: "Top right" }),
    Object.freeze({ index: 2, lower: "bottom left", capital: "Bottom left" }),
    Object.freeze({ index: 3, lower: "bottom right", capital: "Bottom right" }),
  ]);

  // Rule Q15's vocabulary (new 1 September 2026, VERSION 2, ruling R14): the
  // words a duplicate point name is addressed by. They are GENERATOR-OWNED —
  // the author's name is never altered, only qualified — and they follow rule
  // Q10's own boundary: words to ninth, digits from 10th. Copied from gantt's
  // ORDINAL_WORDS, which serves G5/G11 for exactly the same reason.
  const ORDINAL_WORDS = Object.freeze([
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
  ]);

  // Rule Q4's boundary value. A coordinate EXACTLY equal to this belongs to no
  // quadrant. The comparison is strict and needs no epsilon: the adapter reads
  // the author's own decimal string from the source and parses a Number beside
  // it, so 0.5 arrives as 0.5 and never as the result of an inverted layout.
  const BOUNDARY_VALUE = 0.5;

  // Rule Q4's two boundary narrations, and rule Q9's table cell for the second.
  const CENTRE_PHRASE = "at the centre, where all four quadrants meet";
  const CENTRE_CELL = "Centre (all four)";

  // Rule Q9's caption for a chart that declares no title.
  const UNTITLED_CAPTION = "Data table for this quadrant chart";

  // Rule Q2's length discipline, adopted from gantt's G2 and deliberately the
  // SAME number the harness's contract clause C1 uses: two numbers that must
  // agree is one number that will eventually not. The module owns the
  // discipline rather than the gate, because a short only the gate objects to
  // is still a short a reader has to listen to. Gold exemplar E6 witnesses the
  // drop; a bite that removes this moves E6's short from 227 to 267.
  const SHORT_MAX_CHARS = 250;

  // ---------------------------------------------------------------------
  // References to a quadrant (rules Q4, Q5, Q9)
  // ---------------------------------------------------------------------

  /**
   * How a quadrant is referred to in RUNNING PROSE.
   *
   * A labelled quadrant is `"LABEL" (position)`; an unlabelled one is `the
   * POSITION quadrant`. The word "Unlabelled" is never emitted anywhere (Q5).
   *
   * `sentenceStart` capitalises only the article of the unlabelled form. A
   * labelled reference opens with a quotation mark and is identical in both
   * positions, which is why this is a parameter rather than a caller-side
   * transform over the finished string.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @param {Object} position - An entry of QUADRANT_POSITIONS
   * @param {Function} esc - escapeText or rawText
   * @param {boolean} sentenceStart - Whether the reference opens a sentence
   * @returns {string} The reference
   */
  function quadrantRef(chart, position, esc, sentenceStart) {
    const label = chart.quadrants[position.index];
    if (label) return `"${esc(label)}" (${position.lower})`;
    return `${sentenceStart ? "The" : "the"} ${position.lower} quadrant`;
  }

  /**
   * How a quadrant is referred to in a TABLE CELL (rule Q9): author text
   * unquoted, and an unlabelled quadrant as the capitalised position.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @param {Object} position - An entry of QUADRANT_POSITIONS
   * @param {Function} esc - escapeText or rawText
   * @returns {string} The cell reference
   */
  function quadrantCell(chart, position, esc) {
    const label = chart.quadrants[position.index];
    return label ? `${esc(label)} (${position.lower})` : position.capital;
  }

  /**
   * How a quadrant is referred to in the SHORT's distribution sentence (rule
   * Q2), where a labelled quadrant carries NO position: `Three of the six fall
   * in "Do first".`
   *
   * @param {Object} chart - The adapter's normalised chart
   * @param {Object} position - An entry of QUADRANT_POSITIONS
   * @param {Function} esc - escapeText or rawText
   * @returns {string} The short-tier reference
   */
  function quadrantShortRef(chart, position, esc) {
    const label = chart.quadrants[position.index];
    return label ? `"${esc(label)}"` : `the ${position.lower} quadrant`;
  }

  // ---------------------------------------------------------------------
  // The narrated view of the chart
  // ---------------------------------------------------------------------

  /**
   * Which quadrant a point falls in, or that it sits on a boundary (rule Q4,
   * ruling R4).
   *
   * `x > 0.5` is right, `x < 0.5` is left; `y > 0.5` is top, `y < 0.5` is
   * bottom. A coordinate EXACTLY 0.5 makes the point a boundary point: it
   * belongs to no quadrant, it is still counted in N, and it is excluded from
   * every quadrant's count.
   *
   * The two quadrants a line separates are returned in READING ORDER, which
   * falls out of iterating QUADRANT_POSITIONS rather than being sorted
   * afterwards.
   *
   * @param {Object} point - A point from the adapter's `points`
   * @returns {Object} { boundary, centre, position, between }
   */
  function classifyPoint(point) {
    const x = point.xValue;
    const y = point.yValue;
    const onX = x === BOUNDARY_VALUE;
    const onY = y === BOUNDARY_VALUE;

    if (onX && onY) {
      return { boundary: true, centre: true, position: null, between: [] };
    }

    // A boundary point lies on the line between two quadrants: the two that
    // share the half it is NOT on the line of.
    if (onX || onY) {
      const between = QUADRANT_POSITIONS.filter((p) => {
        const isTop = p.lower.startsWith("top");
        const isLeft = p.lower.endsWith("left");
        // On the vertical centre line the point is between the two quadrants
        // sharing its half of the y-axis; on the horizontal one, between the
        // two sharing its half of the x-axis.
        return onX
          ? isTop === y > BOUNDARY_VALUE
          : isLeft === x < BOUNDARY_VALUE;
      });
      return { boundary: true, centre: false, position: null, between };
    }

    const wantTop = y > BOUNDARY_VALUE;
    const wantLeft = x < BOUNDARY_VALUE;
    const position = QUADRANT_POSITIONS.find(
      (p) =>
        p.lower.startsWith("top") === wantTop &&
        p.lower.endsWith("left") === wantLeft
    );
    return { boundary: false, centre: false, position, between: [] };
  }

  /**
   * The chart as the description speaks about it: every point classified once,
   * and the per-quadrant occupancy derived from that single classification.
   *
   * Computed ONCE per tier and passed down, so the short and the detailed
   * cannot disagree about which quadrant a point is in.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @returns {Object} { points, boundary, occupancy, max, leaders, empties }
   */
  function narrateChart(chart) {
    // RULE Q15 (new 1 September 2026, VERSION 2, ruling R14, sweep finding F5,
    // probe P16). Two points may legitimately share a name, and narrated bare
    // they are indistinguishable: the Quadrants list says one quadrant holds
    // "Review" and another holds "Review", and the table carries two rows
    // whose `<th scope="row">` is the identical string.
    //
    // The position among the points sharing a name is computed ONCE, here, so
    // the list, the boundary clause and the row header cannot address the same
    // point differently.
    const nameCounts = new Map();
    for (const point of chart.points) {
      nameCounts.set(point.name, (nameCounts.get(point.name) || 0) + 1);
    }
    const seen = new Map();

    const points = chart.points.map((point) => {
      const shared = (nameCounts.get(point.name) || 0) > 1;
      const position = (seen.get(point.name) || 0) + 1;
      seen.set(point.name, position);
      return {
        point,
        // Null on a unique name, which is the overwhelming case: a qualifier
        // on a name nothing else shares is noise, so every consumer asks
        // whether this is set rather than what it says.
        nameOrdinal: shared ? ordinalWord(position) : null,
        ...classifyPoint(point),
      };
    });

    const boundary = points.filter((p) => p.boundary);

    // Occupancy in READING ORDER, so every list built from it is already
    // ordered and no caller has to remember to sort.
    const occupancy = QUADRANT_POSITIONS.map((position) => ({
      position,
      members: points.filter((p) => p.position === position),
    }));

    const counts = occupancy.map((q) => q.members.length);
    const max = counts.length ? Math.max(...counts) : 0;
    const leaders = occupancy.filter((q) => q.members.length === max && max > 0);
    const empties = occupancy.filter((q) => q.members.length === 0);

    return { points, boundary, occupancy, max, leaders, empties };
  }

  // ---------------------------------------------------------------------
  // Axes (rule Q1, ruling R6)
  // ---------------------------------------------------------------------

  /**
   * One axis's two ends and its single label, in the vocabulary of whichever
   * axis it is. The adapter delivers `xAxis` as `{ left, right, label }` and
   * `yAxis` as `{ bottom, top, label }`; this is the one place that difference
   * is resolved, so nothing downstream has to know which axis it is holding.
   *
   * `label` is the R6 SINGLE-LABEL FORM and is the field tested first: the
   * surface fills it only when the author wrote `x-axis Effort` with no arrow,
   * and leaves both ends empty in that case. A dangling `x-axis Low -->` fills
   * `left` and leaves `right` empty, which is a DIFFERENT declaration; reading
   * one as the other is the reading R6 rejects as fabricating a polarity.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @param {string} which - "x" or "y"
   * @returns {Object} The axis in a common vocabulary
   */
  function axisView(chart, which) {
    const axis = which === "x" ? chart.xAxis : chart.yAxis;
    return {
      which,
      label: axis.label,
      low: which === "x" ? axis.left : axis.bottom,
      high: which === "x" ? axis.right : axis.top,
      lowWord: which === "x" ? "on the left" : "at the bottom",
      highWord: which === "x" ? "on the right" : "at the top",
    };
  }

  /**
   * The SHORT tier's phrase for one axis (rule Q1): `"Low cost" to "High
   * cost"`, or `"Effort" on the x-axis` for the single-label form.
   *
   * `carriesAxisName` says whether the phrase already identifies which axis it
   * describes. It matters only when the chart declares ONE axis: with both
   * declared the reader has the "against" to separate them, and with one the
   * two-ended form would otherwise not say which axis it is.
   *
   * BOTH THE ONE-AXIS AND THE HALF-DECLARED FORMS ARE NOW RULED — VERSION 2 of
   * the gold, 1 September 2026, ruling R15, sweep findings F6 and F7, probes
   * P02, P03 and P04. This comment previously flagged them UNEXEMPLIFIED and
   * referred the reader to the session record; the sweep reached both and R15
   * ratified the wording unchanged, so the flag is withdrawn rather than left
   * to age into a claim that the rules are silent when they are not.
   *
   * `x-axis Low -->` parses (measured) and the surface delivers one end and
   * nothing else; the phrase is built from the end it has, and NO POLARITY is
   * invented for the end it does not have (R6's principle, at a case R6 did
   * not name).
   *
   * @param {Object} view - The output of axisView
   * @param {Function} esc - escapeText or rawText
   * @returns {Object|null} { text, carriesAxisName } or null when undeclared
   */
  function axisShortPhrase(view, esc) {
    if (view.label) {
      return {
        text: `"${esc(view.label)}" on the ${view.which}-axis`,
        carriesAxisName: true,
      };
    }
    if (view.low && view.high) {
      return {
        text: `"${esc(view.low)}" to "${esc(view.high)}"`,
        carriesAxisName: false,
      };
    }
    if (view.low) {
      return {
        text: `"${esc(view.low)}" ${view.lowWord} of the ${view.which}-axis`,
        carriesAxisName: true,
      };
    }
    if (view.high) {
      return {
        text: `"${esc(view.high)}" ${view.highWord} of the ${view.which}-axis`,
        carriesAxisName: true,
      };
    }
    return null;
  }

  /**
   * The DETAILED tier's clause for one axis (rule Q1): `The x-axis runs from
   * "Low cost" on the left to "High cost" on the right`, or `The x-axis is
   * labelled "Effort"`. An undeclared axis returns null and is omitted from
   * the sentence entirely.
   *
   * `sentenceStart` decides the article's case. The two clauses are joined
   * with ", and", so only the FIRST one present opens the sentence — and which
   * one that is depends on what the author declared, not on a fixed order:
   * a chart declaring only its y-axis opens with `The y-axis …`.
   *
   * THE HALF-DECLARED FORM IS RULED (VERSION 2, ruling R15, sweep finding F7):
   * `the x-axis is labelled "Low" on the left only`. It reads deliberately
   * close to R6's single-label form, `the x-axis is labelled "Effort"`, and
   * THE TRAILING PLACEMENT PHRASE IS THE WHOLE DISCRIMINATOR — without it the
   * two forms would be identical strings for two different author
   * declarations, which is the confusion R6 exists to prevent. Do not shorten
   * it; the "only" is load-bearing, not emphasis.
   *
   * @param {Object} view - The output of axisView
   * @param {Function} esc - escapeText or rawText
   * @param {boolean} sentenceStart - Whether the clause opens the sentence
   * @returns {string|null} The clause, without its full stop
   */
  function axisDetailedClause(view, esc, sentenceStart) {
    const axis = `${sentenceStart ? "The" : "the"} ${view.which}-axis`;
    if (view.label) return `${axis} is labelled "${esc(view.label)}"`;
    if (view.low && view.high) {
      return (
        `${axis} runs from "${esc(view.low)}" ${view.lowWord} ` +
        `to "${esc(view.high)}" ${view.highWord}`
      );
    }
    if (view.low) {
      return `${axis} is labelled "${esc(view.low)}" ${view.lowWord} only`;
    }
    if (view.high) {
      return `${axis} is labelled "${esc(view.high)}" ${view.highWord} only`;
    }
    return null;
  }

  /**
   * The DATA TABLE's column heading for one axis (rule Q9): `X (Low cost to
   * High cost)`, `X (Effort)`, or a bare `X`.
   *
   * A HALF-DECLARED AXIS TAKES `X (Low)` — the one end it has, with no
   * placement phrase, because a column heading is a label and not a sentence.
   * Ruled 1 September 2026 (VERSION 2, R15, sweep finding F7, probe P04); the
   * behaviour is unchanged and is now owned by a rule.
   *
   * @param {Object} view - The output of axisView
   * @param {Function} esc - escapeText or rawText
   * @returns {string} The heading text
   */
  function axisColumnHeading(view, esc) {
    const letter = view.which.toUpperCase();
    if (view.label) return `${letter} (${esc(view.label)})`;
    if (view.low && view.high) {
      return `${letter} (${esc(view.low)} to ${esc(view.high)})`;
    }
    if (view.low) return `${letter} (${esc(view.low)})`;
    if (view.high) return `${letter} (${esc(view.high)})`;
    return letter;
  }

  // ---------------------------------------------------------------------
  // Sentences
  // ---------------------------------------------------------------------

  /**
   * Rule Q1's opening, in either tier.
   *
   * The short reads `A quadrant chart titled "TITLE" with N points, plotting
   * X against Y.`; the detailed reads `This quadrant chart titled "TITLE"
   * plots N points on two axes.` followed by its own axis sentence.
   *
   * NO FALLBACK TITLE EVER. An untitled chart drops the clause; the empty
   * quoted title and the generic "Quadrant Chart" of the module this replaces
   * are both gone.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @param {Function} esc - escapeText or rawText
   * @param {boolean} detailed - Whether to build the detailed form
   * @returns {string} The sentence
   */
  function buildOpeningSentence(chart, esc, detailed) {
    const titleClause = chart.title ? ` titled "${esc(chart.title)}"` : "";
    const points = countedNoun(chart.points.length, "point", "points");

    if (detailed) {
      return `This quadrant chart${titleClause} plots ${points} on two axes.`;
    }

    const x = axisShortPhrase(axisView(chart, "x"), esc);
    const y = axisShortPhrase(axisView(chart, "y"), esc);

    // Both axes: the "against" separates them and neither needs naming. One
    // axis: the phrase must say which, so a two-ended form gains the axis
    // name. Neither: the whole plotting clause is dropped (Q1).
    let plotting = "";
    if (x && y) {
      plotting = `, plotting ${x.text} against ${y.text}`;
    } else if (x || y) {
      const only = x || y;
      const named = only.carriesAxisName
        ? only.text
        : `${only.text} on the ${only === x ? "x" : "y"}-axis`;
      plotting = `, plotting ${named}`;
    }

    return `A quadrant chart${titleClause} with ${points}${plotting}.`;
  }

  /**
   * The sentence rules Q2 and Q7 form 1 share when ONE quadrant holds EVERY
   * point — VERSION 2 of the gold, 1 September 2026, ruling R10, sweep
   * finding F1.
   *
   * The ratio form states a number against itself when the maximum equals N:
   * "Five of the five fall in …" makes a listener hold both numbers only to
   * discover they are the same one. This says it once.
   *
   * At N = 2 the word is "Both": "All two points" is not English. That is the
   * only count the wording turns on — three and above take "All", and
   * countWord's own digits-from-ten boundary handles the rest.
   *
   * ONE FUNCTION SERVES BOTH RULES because they differ only in the reference
   * passed in — Q2's short omits the position, Q7's takeaway carries it — and
   * two copies of one sentence is how the two tiers come to disagree.
   *
   * @param {number} total - N, the chart's whole point count
   * @param {string} where - The already-rendered quadrant reference
   * @returns {string} The sentence
   */
  function allPointsSentence(total, where) {
    const subject =
      total === 2 ? "Both points" : `All ${countWord(total)} points`;
    return `${subject} fall in ${where}.`;
  }

  /**
   * Rule Q2's distribution sentence for the SHORT tier.
   *
   * It fires only when ONE quadrant holds strictly more points than every
   * other AND that count is at least two (ruling R8): on a two-point chart
   * "the largest quadrant" would be naming a coin toss. Ties, a maximum of
   * one, and single-point charts add no sentence.
   *
   * AMENDED 1 September 2026 (VERSION 2, ruling R10). The FIRING CONDITION is
   * untouched; only the wording branches, on whether the maximum equals N.
   * That can happen only when no point sits on a boundary, since a boundary
   * point raises N without occupying any quadrant (Q4) — so a chart carrying
   * boundary points keeps the ratio form, correctly.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @param {Object} narrated - The output of narrateChart
   * @param {Function} esc - escapeText or rawText
   * @returns {string} The sentence, or "" when it does not fire
   */
  function buildDistributionSentence(chart, narrated, esc) {
    if (narrated.max < 2 || narrated.leaders.length !== 1) return "";
    const leader = narrated.leaders[0];
    const where = quadrantShortRef(chart, leader.position, esc);

    if (narrated.max === chart.points.length) {
      return allPointsSentence(chart.points.length, where);
    }

    const share = capitaliseWord(countWord(narrated.max));
    const total = countWord(chart.points.length);
    return `${share} of the ${total} fall in ${where}.`;
  }

  /**
   * Rule Q1's axis sentence for the DETAILED tier, and rule Q5's quadrant
   * label sentence, which follows it in the same paragraph.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @param {Function} esc - escapeText or rawText
   * @returns {string} The axis sentence
   */
  function buildAxisSentence(chart, esc) {
    const views = ["x", "y"].map((which) => axisView(chart, which));
    const declared = views.filter(
      (view) => view.label || view.low || view.high
    );

    if (declared.length === 0) return "The chart declares no axis labels.";

    const clauses = declared.map((view, i) =>
      axisDetailedClause(view, esc, i === 0)
    );
    const sentence = `${clauses.join(", and ")}.`;

    if (declared.length === views.length) return sentence;

    // ONE AXIS DECLARED, THE OTHER NOT (VERSION 2, ruling R15, sweep finding
    // F6, probes P02 and P03). The undeclared axis gets its OWN SENTENCE
    // rather than a clause joined with ", and": joined, the two would read as
    // though the author had declared them together.
    //
    // This is NOT the no-axis case. `The chart declares no axis labels.`
    // above is the sentence for NEITHER axis declared and is unchanged; the
    // two are different claims and a reader hearing one must not be able to
    // mistake it for the other.
    const undeclared = views.find((view) => !declared.includes(view));
    return `${sentence} The ${undeclared.which}-axis is not labelled.`;
  }

  /**
   * Rule Q5's quadrant label sentence.
   *
   * Four labels take no colon — `The four quadrants are labelled "A" (top
   * left), …` — and a partial set takes one: `Two quadrants are labelled:
   * "Invest" (top right) and "Retire" (bottom left).` The two forms are
   * written out rather than composed from a shared template, because the
   * difference is a deliberate reading of the gold and not a parameter.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @param {Function} esc - escapeText or rawText
   * @returns {string} The sentence
   */
  function buildQuadrantLabelSentence(chart, esc) {
    const labelled = QUADRANT_POSITIONS.filter(
      (position) => chart.quadrants[position.index]
    );

    if (labelled.length === 0) return "The quadrants are not labelled.";

    const items = labelled.map(
      (position) =>
        `"${esc(chart.quadrants[position.index])}" (${position.lower})`
    );

    if (labelled.length === QUADRANT_POSITIONS.length) {
      return `The ${countWord(labelled.length)} quadrants are labelled ${joinNames(items)}.`;
    }

    const count = capitaliseWord(countWord(labelled.length));
    const noun = labelled.length === 1 ? "quadrant is" : "quadrants are";
    return `${count} ${noun} labelled: ${joinNames(items)}.`;
  }

  /**
   * How a point is named in RUNNING PROSE (rules Q10 and Q15): `"Review"`, or
   * `the first "Review"` when another point shares the name.
   *
   * THE ORDINAL SITS OUTSIDE THE QUOTATION MARKS. That is what keeps Q15
   * clear of Q10 and of ledger entry 9 (item 26, 12 August 2026 — a name
   * written by a diagram author is never inflected by the generator): the
   * name is quoted exactly as the author wrote it, and the addressing is
   * visibly the generator's. Qualifying is not inflecting.
   *
   * @param {Object} entry - One entry of narrateChart's `points`
   * @param {Function} esc - escapeText or rawText
   * @returns {string} The quoted, optionally qualified name
   */
  function pointRef(entry, esc) {
    const quoted = `"${esc(entry.point.name)}"`;
    return entry.nameOrdinal ? `the ${entry.nameOrdinal} ${quoted}` : quoted;
  }

  /**
   * How a point is named in its TABLE ROW HEADER (rules Q9 and Q15):
   * `Review`, or `Review (first)` when another point shares the name.
   *
   * Two rows whose `<th scope="row">` is the identical string is a row-header
   * uniqueness problem in its own right, quite apart from the prose: a
   * screen-reader user moving through the table hears the same header twice
   * and cannot tell which row they are in. The suffix is generator-owned and
   * therefore sits OUTSIDE the escaped name, and it uses the same words the
   * prose does, so the two surfaces address a point the same way.
   *
   * @param {Object} entry - One entry of narrateChart's `points`
   * @param {Function} esc - escapeText or rawText
   * @returns {string} The row header
   */
  function pointHeader(entry, esc) {
    const name = esc(entry.point.name);
    return entry.nameOrdinal ? `${name} (${entry.nameOrdinal})` : name;
  }

  /**
   * Rule Q6's boundary phrase for one point: where on the boundary it sits.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @param {Object} entry - One entry of narrateChart's `points`
   * @param {Function} esc - escapeText or rawText
   * @returns {string} The phrase
   */
  function boundaryPhrase(chart, entry, esc) {
    if (entry.centre) return CENTRE_PHRASE;
    const refs = entry.between.map((position) =>
      quadrantRef(chart, position, esc, false)
    );
    return `on the line between ${refs[0]} and ${refs[1]}`;
  }

  // ---------------------------------------------------------------------
  // Detailed sections
  // ---------------------------------------------------------------------

  /**
   * Rule Q6's Quadrants section: one `<ul>` with exactly four `<li>` in
   * reading order, including empty quadrants (ruling R7), plus a fifth `<li>`
   * when any point sits on a boundary.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @param {Object} narrated - The output of narrateChart
   * @returns {Array<string>} The lines
   */
  function buildQuadrantsSection(chart, narrated) {
    const lines = ["<ul>"];

    for (const quadrant of narrated.occupancy) {
      const ref = quadrantRef(chart, quadrant.position, escapeText, true);
      if (quadrant.members.length === 0) {
        lines.push(`<li>${ref} holds no points.</li>`);
        continue;
      }
      // Point names in SOURCE order — `narrated.points` preserves the
      // adapter's own order, which is the order the author wrote them. That
      // order is also what rule Q15's ordinal counts, so a duplicate name is
      // qualified the same way here and in the table.
      const names = quadrant.members.map((entry) =>
        pointRef(entry, escapeText)
      );
      const held = countedNoun(quadrant.members.length, "point", "points");
      lines.push(`<li>${ref} holds ${held}: ${joinNames(names)}.</li>`);
    }

    if (narrated.boundary.length > 0) {
      const held = countedNoun(narrated.boundary.length, "point", "points");
      const verb = narrated.boundary.length === 1 ? "sits" : "sit";
      const clauses = narrated.boundary.map(
        (entry) =>
          `${pointRef(entry, escapeText)} ` +
          `${boundaryPhrase(chart, entry, escapeText)}`
      );
      lines.push(
        `<li>${capitaliseWord(held)} ${verb} on a boundary rather than in a ` +
          `quadrant: ${joinClauses(clauses)}.</li>`
      );
    }

    lines.push("</ul>");
    return lines;
  }

  /**
   * Rule Q7's takeaway — the first paragraph of Key Insights, bolded — in
   * exactly one of four forms.
   *
   * Boundary points never contribute to any count here; "of the six" is N, the
   * chart's whole point count, which DOES include them.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @param {Object} narrated - The output of narrateChart
   * @returns {string} The sentence
   */
  function buildTakeaway(chart, narrated) {
    const total = chart.points.length;

    if (total === 1) {
      const entry = narrated.points[0];
      // Routed through pointRef for uniformity, though a chart with one point
      // can have no duplicate to qualify: the ordinal is null here by
      // construction, and using the same helper means there is one place a
      // point's prose name is decided rather than two that could drift.
      const name = pointRef(entry, escapeText);
      if (entry.boundary) {
        // FORM 4's TWO BOUNDARY VARIANTS (VERSION 2, ruling R13, sweep finding
        // F4, probe P10). Both take Q6's own boundary vocabulary rather than a
        // sentence of their own, so a reader who has just heard the Quadrants
        // section's boundary item hears the same geometric fact described the
        // same way one paragraph later. `boundaryPhrase` is that vocabulary,
        // and it is the single source of both.
        //
        // The warning that stood here is GONE: a branch the rules now own logs
        // nothing. The wording it flagged is the wording R13 ruled, unchanged.
        return (
          `The chart has a single point, ${name}, ` +
          `${boundaryPhrase(chart, entry, escapeText)}.`
        );
      }
      const where = quadrantRef(chart, entry.position, escapeText, false);
      return `The chart has a single point, ${name}, in ${where}.`;
    }

    // FORM 5, NEW (VERSION 2, ruling R11, sweep finding F2, probe P09) — the
    // SWEEP'S ONLY MODULE-LOCUS FINDING, and it was a module consequence of a
    // rule that had no form for the case, which is why the repair is a rule.
    //
    // A maximum of zero means no quadrant holds any point, which happens if
    // and only if every point sits on a boundary: any point inside a quadrant
    // would put that quadrant's count at one or more. So the sentence is true
    // by construction rather than by a second scan of the points.
    //
    // Form 3 covered this before and said "No quadrant holds more than one
    // point." — literally true and materially misleading, with Q8's very next
    // sentence then saying all four are empty. The reader was told the shape
    // twice and correctly neither time.
    //
    // Reachable only at N of two or more: a single boundary point is form 4's
    // business above, and `readChart` refuses a chart with no points at all.
    if (narrated.max === 0) {
      return "Every point sits on a boundary rather than in a quadrant.";
    }

    if (narrated.max < 2) {
      return "No quadrant holds more than one point.";
    }

    // FORM 1's max-equals-N wording (VERSION 2, ruling R10, sweep finding F1).
    // Decided BEFORE `refs` is built, because this sentence opens with "All"
    // or "Both" and its reference is therefore mid-sentence — where the
    // ratio form's reference opens the sentence and takes the capital.
    //
    // A tie is impossible here and the test does not check for one: counts sum
    // to at most N, so if one quadrant holds all N no other can hold any.
    if (narrated.max === total) {
      const where = quadrantRef(
        chart,
        narrated.leaders[0].position,
        escapeText,
        false
      );
      return allPointsSentence(total, where);
    }

    const refs = narrated.leaders.map((quadrant, i) =>
      quadrantRef(chart, quadrant.position, escapeText, i === 0)
    );

    if (narrated.leaders.length === 1) {
      return (
        `${refs[0]} holds the most points, ` +
        `${countWord(narrated.max)} of the ${countWord(total)}.`
      );
    }

    return (
      `${joinNames(refs)} hold the most points, ${countWord(narrated.max)} each.`
    );
  }

  /**
   * Rule Q8's empties sentence — the second paragraph of Key Insights, always
   * present.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @param {Object} narrated - The output of narrateChart
   * @returns {string} The sentence
   */
  function buildEmptiesSentence(chart, narrated) {
    const empties = narrated.empties;

    if (empties.length === 0) return "Every quadrant holds at least one point.";

    if (empties.length === 1) {
      return `${quadrantRef(chart, empties[0].position, escapeText, true)} holds no points.`;
    }

    // THE FOUR-EMPTY FORM (VERSION 2, ruling R12, sweep finding F3, probes
    // P09 and P10). The general list below would name all four quadrants a
    // second time, immediately after the Quadrants section has just said in
    // four consecutive list items that each holds none — the longest sentence
    // in the description at the point where it carries the least.
    //
    // The wording is the one the gold's own EDGE GAP note predicted before the
    // case had been reached; the sweep reached it and R12 adopted the
    // prediction unchanged. The warning that stood here is GONE: a branch the
    // rules now own logs nothing.
    if (empties.length === QUADRANT_POSITIONS.length) {
      return "All four quadrants hold no points.";
    }

    const refs = empties.map((quadrant) =>
      quadrantRef(chart, quadrant.position, escapeText, false)
    );
    return (
      `${capitaliseWord(countWord(empties.length))} quadrants hold no ` +
      `points: ${joinNames(refs)}.`
    );
  }

  /**
   * Rule Q7 and Q8 together: the Key Insights section.
   * @param {Object} chart - The adapter's normalised chart
   * @param {Object} narrated - The output of narrateChart
   * @returns {Array<string>} The lines
   */
  function buildInsights(chart, narrated) {
    return [
      `<p><strong>${buildTakeaway(chart, narrated)}</strong></p>`,
      `<p>${buildEmptiesSentence(chart, narrated)}</p>`,
    ];
  }

  /**
   * Rule Q9's data table: rows in SOURCE order, coordinates as the author's
   * own strings verbatim (ruling R3 — the old module's `toFixed(2)` reformatted
   * 0.9 as 0.90, inventing precision), author text unquoted in every cell.
   *
   * The table carries no ids. The module this replaces threaded a `diagramId`
   * through, and the core passed it the diagram TYPE, so every quadrant chart
   * on a page produced the same ids; dropping them closes that by
   * construction rather than by generating better ones.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @param {Object} narrated - The output of narrateChart
   * @returns {Array<string>} The lines
   */
  function buildTable(chart, narrated) {
    const caption = chart.title
      ? `Data table for: ${escapeText(chart.title)}`
      : UNTITLED_CAPTION;

    const lines = [
      "<table>",
      `<caption>${caption}</caption>`,
      "<thead>",
      `<tr><th scope="col">Point</th>` +
        `<th scope="col">${axisColumnHeading(axisView(chart, "x"), escapeText)}</th>` +
        `<th scope="col">${axisColumnHeading(axisView(chart, "y"), escapeText)}</th>` +
        `<th scope="col">Quadrant</th></tr>`,
      "</thead>",
      "<tbody>",
    ];

    for (const entry of narrated.points) {
      let cell;
      if (entry.centre) {
        cell = CENTRE_CELL;
      } else if (entry.boundary) {
        const refs = entry.between.map((position) =>
          quadrantCell(chart, position, escapeText)
        );
        cell = `Between ${refs[0]} and ${refs[1]}`;
      } else {
        cell = quadrantCell(chart, entry.position, escapeText);
      }
      lines.push(
        `<tr><th scope="row">${pointHeader(entry, escapeText)}</th>` +
          `<td>${escapeText(entry.point.x)}</td>` +
          `<td>${escapeText(entry.point.y)}</td>` +
          `<td>${cell}</td></tr>`
      );
    }

    lines.push("</tbody>");
    lines.push("</table>");
    return lines;
  }

  // ---------------------------------------------------------------------
  // The registered tiers
  // ---------------------------------------------------------------------

  /**
   * Fetch and verify the chart, or throw.
   *
   * A parse rejection is deliberately NOT caught — the core's catch turns it
   * into the honest generation-failed fallback. A failed adapter self-check
   * throws for the same reason: never narrate an unverified chart.
   *
   * `isQuadrantHealthy()` reads `null` until the lazy self-check settles, which
   * is why the guard tests for `false` rather than falsiness — a `!healthy`
   * test would refuse every first call on a page.
   *
   * A CHART WITH NO POINTS THROWS. It is valid Mermaid (measured), and every
   * one of rules Q1, Q2, Q6, Q7 and Q8 is written in terms of points, so
   * narrating one means inventing five rules the design seat has not ruled.
   * Flagged for the sweep session; until it rules, the honest fallback is
   * better than fabricated prose.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} The adapter's normalised chart
   */
  async function readChart(code) {
    const chart = await window.MermaidParseAdapter.parseQuadrant(code);
    if (window.MermaidParseAdapter.isQuadrantHealthy() === false) {
      logWarn(
        "[Mermaid Accessibility] Quadrant self-check failed; refusing to narrate"
      );
      throw new Error(
        "Parse adapter failed its quadrant self-check; refusing to narrate an unverified chart"
      );
    }
    if (!chart.points || chart.points.length === 0) {
      throw new Error(
        "Quadrant chart carries no points; refusing to narrate it"
      );
    }
    return chart;
  }

  /**
   * Generate a short description for a quadrant chart.
   *
   * The PLAIN form is the tier of record and is never escaped: it reaches a
   * `textContent` sink and the SVG's `aria-label`, where an entity would be
   * announced literally. The HTML form is the same sentence escaped exactly
   * once, with no spans and no classes of its own — the module this replaces
   * wrapped every field in a `<span class="diagram-title">` and friends, which
   * the shell-level presentation pass owns.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to `{ html, text }`
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating quadrant short description");

    const chart = await readChart(code);
    const narrated = narrateChart(chart);

    const opening = buildOpeningSentence(chart, rawText, false);
    const distribution = buildDistributionSentence(chart, narrated, rawText);

    // RULE Q2's LENGTH DISCIPLINE, MEASURED ONCE, ON THE COMPOSED STRING,
    // BEFORE EITHER TIER EXISTS.
    //
    // The distribution sentence is what goes, and never the opening: the
    // opening carries the author's title, the count and the axes, and author
    // text is never cut (XC8). A first sentence already over the cap STANDS —
    // with no distribution sentence the composed string IS the opening, so
    // narrowing to it is a no-op — and the harness's per-fixture
    // `shortMaxChars` override with its mandatory note is the accommodation
    // for exactly that case.
    //
    // THE DEFECT THIS SHAPE EXISTS TO PREVENT, found 1 September 2026 by the
    // collateral reddening of a bite aimed at a different fixture. The previous
    // shape narrowed `text` to the opening and then, for the HTML tier, tested
    // `text.length` a second time — by which point the value was the
    // ALREADY-NARROWED one, so the second test could never fire. Gold exemplar
    // 6 emitted a 227-character plain short beside a 267-character HTML one:
    // the two tiers disagreed about what the chart said. The comment beside it
    // claimed the decision was taken on the plain length "for both tiers",
    // which was true of the VARIABLE and false of the VALUE — the worst kind of
    // comment, naming the right principle over code that does not implement it.
    //
    // ONE STRING REACHES BOTH TIERS, so they cannot drift. `text` is the single
    // surviving short, and the HTML tier is that string escaped exactly once.
    // The escape covers the quotation marks this module puts around author text
    // as well as the author text itself; those are furniture, and escaping them
    // is harmless because the figcaption sink is `innerHTML`
    // (mermaid-accessibility-core.js, where `figcaption.innerHTML =
    // descriptions.shortHTML`), which decodes `&quot;` back to `"` on render.
    // It also puts quadrant on the same footing as gantt and xychart, whose
    // HTML short tiers are likewise the plain tier escaped whole.
    const composed = distribution ? `${opening} ${distribution}` : opening;
    const text = composed.length > SHORT_MAX_CHARS ? opening : composed;
    logDebug(`[Mermaid Accessibility] Quadrant short: ${text}`);

    return { html: escapeText(text), text };
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
   * Generate a detailed description for a quadrant chart.
   *
   * Four headed sections in a fixed order (rule Q3): Chart Construction,
   * Quadrants, Key Insights, Data Table. The old module's "What is a Quadrant
   * Chart?" explainer, its "How the axes work" `<h5>`, its framework section
   * and its `<section>`/`role="region"` wrappers do not survive — the
   * shell-level presentation pass owns section treatment.
   *
   * Gantt G3's rule that a heading introducing no content is omitted entirely
   * is inherited. No section reaches it today: Quadrants always carries four
   * items (R7), Key Insights always carries a takeaway and an empties
   * sentence, and a chart with no points never gets this far.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating quadrant detailed description");

    const chart = await readChart(code);
    const narrated = narrateChart(chart);

    const construction = [
      buildOpeningSentence(chart, escapeText, true),
      buildAxisSentence(chart, escapeText),
      buildQuadrantLabelSentence(chart, escapeText),
    ]
      .filter((sentence) => sentence)
      .join(" ");

    const parts = [];
    const pushSection = (heading, lines) => {
      if (!lines || lines.length === 0) return;
      parts.push(`<h4>${heading}</h4>`);
      parts.push(...lines);
    };

    pushSection(
      "Chart Construction",
      construction ? [`<p>${construction}</p>`] : []
    );
    pushSection("Quadrants", buildQuadrantsSection(chart, narrated));
    pushSection("Key Insights", buildInsights(chart, narrated));
    pushSection("Data Table", buildTable(chart, narrated));

    // Newline-joined so text-content extraction stays readable: without them,
    // list and row boundaries concatenate with no space.
    return parts.join("\n");
  }

  // Register with the core module. `generateShort` returns plain text because
  // the core assigns its result straight to descriptions.short, which reaches
  // the figcaption and the SVG aria-label.
  //
  // The key is "quadrantChart", which is what mermaid-diagram-detection.js
  // returns for this type (its type map and its detector agree).
  //
  // generateShortHTML is the ASYNC shape, and it has to be: this module awaits
  // the parse adapter, so `generateShortDescription(...).html` on the returned
  // promise would be `undefined` and the tier would register, be called, and
  // yield nothing silently (register item 13). The module this replaces used
  // exactly that synchronous shape.
  window.MermaidAccessibility.registerDescriptionGenerator("quadrantChart", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
  });

  logInfo(
    "[Mermaid Accessibility] Quadrant chart module loaded and registered on the parse adapter's quadrant surface"
  );
})();
