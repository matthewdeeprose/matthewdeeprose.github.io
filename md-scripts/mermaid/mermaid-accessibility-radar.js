/**
 * Mermaid Accessibility - Radar Chart Module
 *
 * Generates accessible descriptions for `radar-beta` charts from the shared
 * parse adapter's RADAR surface (mermaid-parse-adapter.js), never from the SVG
 * and never from the diagram source. The nineteenth description generator and
 * the thirteenth adapter-consuming one.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-radar-gold-targets-2026-09-23.md - rules RD1 to RD14, rulings
 * RR1 to RR30 and Matthew's decisions MQ1 to MQ6 (VERSION 3, FROZEN
 * 29 September 2026, amended on the item 93 sweep's evidence) - and six
 * byte-exact approved targets plus five RULED EDGES. A mismatch between this module's output and a target is a STOP that
 * goes back to the design seat; it is never a reason to edit a target or a
 * fixture. Register item 93.
 *
 * WHY THE WORDS CARRY EVERY NUMBER. The picture draws no value and no scale
 * number as text anywhere (census Q3): the title, the axis labels and the
 * legend are the only strings a sighted reader gets, and every value is
 * carried by geometry alone. So the words give every value, the scale the
 * geometry is drawn against, and the threshold-free arithmetic a sighted
 * reader takes from the shape (RR9) - an average per series and a pairwise
 * comparison - and nothing that would need a threshold the picture does not
 * draw (RD13).
 *
 * THIS FILE HOLDS NO REGEX, NO db READ AND NO DOM READ. Every author string
 * arrives already decoded by the surface's `decodePlaceholders` (RS3), so THIS
 * MODULE NEVER DECODES; it only escapes, once, at the HTML sink (RD11).
 *
 * ONE BUILDER PER FACT, which is the rule the c4 arc's finding F4 paid for.
 * `buildShortText` is the only place the short sentence is built, and the HTML
 * short is `escapeHtml` of it; `buildScaleSentence` is the only place the scale
 * is put into words; `extremesSentence` the only place highest and lowest are
 * found; `roundedMean` the only place an average is taken; `buildPairSentence`
 * the only place two series are compared; `buildSeriesItem` the only place a
 * series becomes a list item; `buildDataTable` the only place the table is
 * written. `measure` decides once which series are drawn and which are
 * compared, and every section reads that decision from there.
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

  // How close twice a mean must sit to an odd whole number to count as a half
  // (RR25): far below any difference two authored decimals can make, far above
  // the error one binary sum leaves.
  const HALF_TOLERANCE = 1e-9;

  // Where the renderer draws a value it clamps (RD4): above the maximum at the
  // maximum's radius (RR23), below the minimum at radius zero (RR20).
  const SCALE_MAXIMUM_PLACE = "the scale's maximum";
  const CENTRE_PLACE = "the centre";

  // The most pairs the Comparison lists before its closing item (RR30).
  const MAX_LISTED_PAIRS = 6;

  // The generator-owned names for an empty or whitespace-only label (RR24).
  const UNLABELLED_AXIS = "unlabelled axis";
  const UNLABELLED_SERIES = "unlabelled series";

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
  // `undefined` permanently if this file ever loses the load race. One
  // property read per call cannot go stale. (Kanban, c4 and block precedent.)

  /**
   * The shared prose layer (narrationNumber, capitalize, escapeHtml).
   * @returns {Object} MermaidAccessibilityCommon
   */
  function common() {
    return window.MermaidAccessibilityCommon;
  }

  /**
   * Escape one string of AUTHOR TEXT for an HTML sink - rule RD11.
   *
   * The caller escapes, exactly once, at the point the field enters the HTML:
   * the title, an axis label, a series label. Generator furniture - the tags,
   * the quotation marks round a label, the commas, the "and", the disclosure
   * in brackets - is never escaped. The PLAIN short tier is never escaped at
   * all (RD1). ITEMS ARE ESCAPED BEFORE THEY ARE JOINED, never after.
   *
   * @param {string} text - Author text
   * @returns {string} The escaped string
   */
  function escapeText(text) {
    return common().escapeHtml(text);
  }

  /**
   * A count in RD12's number form: words to nine, digits from 10.
   *
   * THE SHARED `narrationNumber` IS GUARDED HERE, not reimplemented: it indexes
   * its word array for any value from 0 to 9 inclusive, so a non-integer
   * would come back `undefined`. Every count this file narrates is now a
   * whole number (RR22 narrates the ring count the renderer draws, not a
   * fractional ticks), and the guard stays so that anything that is not a
   * whole number from 0 to 9 takes `String()` and never reaches the array.
   *
   * @param {number} value - The count
   * @returns {string} The narration form
   */
  function countWord(value) {
    if (Number.isInteger(value) && value >= 0 && value <= 9) {
      return common().narrationNumber(value);
    }
    return String(value);
  }

  /**
   * A count as a noun phrase, with NOUN AGREEMENT - RD1, RD5, RD8 and RD12.
   *
   * THE ONE BUILDER FOR EVERY COUNTED NOUN, so "axis"/"axes", "value"/"values"
   * and "ring"/"rings" agree the same way everywhere (RR2 on OR-3: "one
   * values" fails clause C8). Zero reads "no", which is RD1's own spelling.
   * "series" is its own plural and is passed as both forms.
   *
   * @param {number} count - The count
   * @param {string} singular - e.g. "axis"
   * @param {string} plural - e.g. "axes"
   * @returns {string} e.g. "no axes", "one axis", "three axes", "10 axes"
   */
  function countPhrase(count, singular, plural) {
    if (count === 0) return `no ${plural}`;
    return `${countWord(count)} ${count === 1 ? singular : plural}`;
  }

  /** A count of axes - RD1 and RD8. */
  function axesPhrase(count) {
    return countPhrase(count, "axis", "axes");
  }

  /** A count of series - RD1. "series" is its own plural. */
  function seriesPhrase(count) {
    return countPhrase(count, "series", "series");
  }

  /** A count of values - RD8. */
  function valuesPhrase(count) {
    return countPhrase(count, "value", "values");
  }

  /**
   * Join a list of already-escaped items - NO SERIAL COMMA.
   *
   * The targets join "Pace", "Workload" and "Support" with no comma before
   * the "and" (E2), so `Common.formatList`, which writes an Oxford comma from
   * three items up, is deliberately not used. One join serves the axes
   * sentence, the highest/lowest ties and every pair-sentence list.
   *
   * @param {string[]} items - The parts, each already escaped
   * @returns {string} The joined list
   */
  function joinNoSerial(items) {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  }

  /**
   * A number as the words give it - RD12: the db's number, verbatim.
   *
   * `String()` of the delivered number and nothing else: 2.5 stays 2.5, and
   * nothing is rounded or re-formatted. The only rounded figure in this file
   * is the average, and it is rounded by `roundedMean` before it gets here.
   *
   * @param {number} value - A delivered number
   * @returns {string} Its digits
   */
  function numberText(value) {
    return String(value);
  }

  /**
   * Quote and escape one author label - RD3, RD7, RD8 and RD14.
   *
   * The quotation marks are generator furniture and stay raw; only the label
   * is escaped. Author names are never inflected.
   *
   * @param {string} label - An axis or series label
   * @returns {string} e.g. "Attack" with its quotation marks
   */
  function quotedLabel(label) {
    return `"${escapeText(label)}"`;
  }

  /**
   * Is a label empty or whitespace only? - RD8, ruling RR24.
   *
   * Mermaid keeps `""` rather than falling back to the id (`label ?? name`),
   * so such a label reaches the canvas as an empty string and is drawn as
   * nothing (sweep F7). There is then no author text to quote.
   *
   * @param {string} label - An axis or series label
   * @returns {boolean} True when the label carries no visible text
   */
  function isUnlabelled(label) {
    return label.trim() === "";
  }

  /**
   * An author label as the PROSE names it - quoted and escaped, or, for an
   * empty or whitespace-only label, the generator-owned phrase "unlabelled
   * axis N" / "unlabelled series N", N the declaration position in digits,
   * with NO quotes because there is no author text to mark (RR24).
   *
   * @param {string} label - The label
   * @param {string} noun - UNLABELLED_AXIS or UNLABELLED_SERIES
   * @param {number} position - The declaration position, from one
   * @returns {string} The name, ready for the HTML fragment
   */
  function proseName(label, noun, position) {
    return isUnlabelled(label) ? `${noun} ${position}` : quotedLabel(label);
  }

  /**
   * An author label as a TABLE HEADER names it - unquoted and escaped, or the
   * same generator phrase, so no header cell is ever empty (RR24).
   *
   * @param {string} label - The label
   * @param {string} noun - UNLABELLED_AXIS or UNLABELLED_SERIES
   * @param {number} position - The declaration position, from one
   * @returns {string} The cell text, ready for the HTML fragment
   */
  function cellName(label, noun, position) {
    // A header cell is an opening position (RR34), so the phrase takes its capital.
    return capitaliseOpening(label, isUnlabelled(label) ? `${noun} ${position}` : escapeText(label));
  }

  /** An axis in prose, by its declaration index (from zero). */
  function axisName(axis, index) {
    return proseName(axis.label, UNLABELLED_AXIS, index + 1);
  }

  /** A series in prose; its position is its place among EVERY series. */
  function seriesName(facts, curve) {
    return proseName(curve.label, UNLABELLED_SERIES, facts.curves.indexOf(curve) + 1);
  }

  /**
   * The generator's own phrase where it OPENS - ruling RR34, its reach ruled
   * by the seat on 29 September 2026. THE ONLY PLACE THE PHRASE IS
   * CAPITALISED. It opens a list item (a series item on either arm, a nested
   * axis item), a sentence (the pair sentence's subject, "Unlabelled series 1
   * is higher than ...") and every table header cell; it stays lower case
   * only mid-sentence ("on unlabelled axis 2", "than unlabelled series 2").
   * An author label is returned exactly as given: author text is never
   * re-cased.
   *
   * @param {string} label - The author label the name was built from
   * @param {string} name - The name, from `proseName` or `cellName`
   * @returns {string} The name, ready to open a position
   */
  function capitaliseOpening(label, name) {
    if (!isUnlabelled(label)) return name;
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  /** A series name where it opens a sentence or a list item (RR34). */
  function openingSeriesName(facts, curve) {
    return capitaliseOpening(curve.label, seriesName(facts, curve));
  }

  /** An axis name where it opens a nested list item (RR34). */
  function openingAxisName(axis, index) {
    return capitaliseOpening(axis.label, axisName(axis, index));
  }

  // ---------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------

  /**
   * Throw unless a delivered field is a string.
   * @param {*} value - The field
   * @param {string} what - Its description, for the message
   * @returns {string} The field, unchanged
   * @throws {Error} When the field is not a string
   */
  function requireString(value, what) {
    if (typeof value !== "string") {
      throw new Error(
        `Radar delivery carries ${what} of type ${typeof value}; this generator ` +
          "narrates only the string the surface promises. Refusing to narrate a " +
          "chart it does not understand."
      );
    }
    return value;
  }

  /**
   * Throw unless a delivered field is a finite number.
   * @param {*} value - The field
   * @param {string} what - Its description, for the message
   * @returns {number} The field, unchanged
   * @throws {Error} When the field is not a finite number
   */
  function requireNumber(value, what) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(
        `Radar delivery carries ${what} that is not a finite number; refusing ` +
          "to narrate a chart it does not understand."
      );
    }
    return value;
  }

  // ---------------------------------------------------------------------
  // Measurement - every decision taken once
  // ---------------------------------------------------------------------

  /**
   * Is the scale without a range? - RD4's "no range" predicate, RR15.
   *
   * MEASURED at item 93 session 4 on the three sources RD4 names, at strict,
   * each against a control: all values zero with no max, all values equal to
   * a non-zero min with no max, and an author max equal to min (with values
   * at and above it). On every one the delivered `scaleMax` equals `min`, the
   * curve path's every coordinate is NaN, and the legend still names the
   * series; on every control, where `scaleMax` exceeds `min`, the curve draws.
   * So the predicate is exactly `scaleMax === min`: the renderer divides by
   * the range, and a zero range draws nothing.
   *
   * An INVERTED pair (`scaleMax` below `min`, census G35, EDGE 5) is NOT this
   * case: every vertex is drawn at the outer ring there, not a NaN path. See
   * `isInverted`.
   *
   * @param {Object} options - The delivered options
   * @returns {boolean} True when nothing can be plotted
   */
  function hasNoRange(options) {
    return options.scaleMax !== null && options.scaleMax === options.min;
  }

  /**
   * Is the scale inverted? - RD4 and EDGE 5, ruling RR19.
   *
   * ISOLATED BY THE SWEEP in Mermaid 11.6.0's renderer: a value is clamped as
   * min(max(v, min), max) and scaled by (clamped - min) / (max - min). With
   * min above max the clamp always gives max, so the ratio is one and EVERY
   * vertex of every series lands at the scale's maximum, whatever its value.
   * It holds on BOTH branches: an author max below min (EDGE 5), and an author
   * min above the data's own maximum (sweep p05c). The picture then compares
   * nothing, so the chart carries no Comparison section.
   *
   * @param {Object} options - The delivered options
   * @returns {boolean} True when min is above the scale's maximum
   */
  function isInverted(options) {
    return options.scaleMax !== null && options.scaleMax < options.min;
  }

  /**
   * Is a DERIVED maximum set by a series the picture does not plot? - RD4,
   * ruling RR29 on the sweep's F12.
   *
   * The surface derives `scaleMax` over the values of every delivered series,
   * drawn or not (RS6a, matching the renderer), so the maximum can sit in a
   * series RD8 says is not plotted. True exactly when no DRAWN value reaches
   * it, which includes a chart with no drawn series at all.
   *
   * @param {Object} options - The delivered options
   * @param {Object[]} drawnSeries - The series the picture draws
   * @returns {boolean} True when the data maximum comes from an unplotted series
   */
  function maxIsUnplotted(options, drawnSeries) {
    if (options.scaleMaxSource !== "data" || options.scaleMax === null) return false;
    return !drawnSeries.some((curve) => curve.values.includes(options.scaleMax));
  }

  /**
   * Is a legend drawn on this chart? - RD5, with RR16.
   *
   * MEASURED at item 93 session 4 on EDGE 1: with axes and no series Mermaid
   * draws NO legend group at all - the chart's group carries twelve children
   * against fourteen on the one-series control, the difference being the
   * curve path and the legend group - so "a legend names the series" would be
   * a claim about something not in the picture. `showLegend` is the author's
   * switch; the series count is the other half of whether anything is drawn.
   *
   * @param {Object} options - The delivered options
   * @param {number} seriesCount - The number of delivered series
   * @returns {boolean} True when the picture carries a legend
   */
  function legendIsDrawn(options, seriesCount) {
    return options.showLegend === true && seriesCount > 0;
  }

  /**
   * Read the delivery into the facts every tier is built from.
   *
   * IT VALIDATES FIRST. A delivery whose `diagramType` is not `radar`, or that
   * lacks an array or carries a field of the wrong type, throws rather than
   * narrating part of a chart; the core's catch reaches the honest
   * generation-failed message.
   *
   * THREE SERIES SETS ARE DECIDED HERE AND NOWHERE ELSE. `drawn` is the
   * surface's own RS7a answer (value count equals axis count). `tabled` is
   * every drawn series: RD9's table carries a column for each, EDGE 3's
   * no-range chart included. `compared` is every drawn series on a chart that
   * HAS a range and is not inverted: RR11 rules that a no-range chart plots
   * nothing, so it carries no average and no Comparison section, and RR19
   * that an inverted one draws every series identically, so it carries no
   * Comparison either (its averages stay: the numbers are in the code).
   *
   * @param {Object} diagram - The adapter's radar delivery
   * @returns {Object} The facts
   * @throws {Error} On a delivery this module does not understand
   */
  function measure(diagram) {
    if (!diagram || diagram.diagramType !== "radar") {
      throw new Error(
        `Radar generator received a delivery of type ${JSON.stringify(
          diagram && diagram.diagramType
        )}; refusing to narrate it as a radar chart.`
      );
    }
    if (!Array.isArray(diagram.axes) || !Array.isArray(diagram.curves)) {
      throw new Error(
        "Radar delivery carries no axes or no curves array; refusing to narrate a chart it cannot read."
      );
    }
    const options = diagram.options;
    if (!options || typeof options !== "object") {
      throw new Error(
        "Radar delivery carries no options object; refusing to narrate a chart it cannot read."
      );
    }

    // Validate every narrated field once, here, rather than at each sink.
    diagram.axes.forEach((axis, index) => {
      requireString(axis && axis.label, `an axis label at position ${index}`);
    });
    diagram.curves.forEach((curve, index) => {
      requireString(curve && curve.label, `a series label at position ${index}`);
      if (!Array.isArray(curve.values)) {
        throw new Error(
          `Radar series at position ${index} carries no values array; refusing to narrate it.`
        );
      }
      curve.values.forEach((value) => requireNumber(value, `a value in series ${index}`));
      if (typeof curve.drawn !== "boolean") {
        throw new Error(
          `Radar series at position ${index} carries no boolean drawn; refusing to narrate it.`
        );
      }
    });
    requireNumber(options.min, "a min");
    if (options.scaleMax !== null) requireNumber(options.scaleMax, "a scaleMax");
    requireNumber(options.ticks, "a ticks value");

    const title =
      typeof diagram.title === "string" && diagram.title.trim() !== ""
        ? diagram.title
        : null;
    const noRange = hasNoRange(options);
    const inverted = isInverted(options);
    const drawnSeries = diagram.curves.filter((curve) => curve.drawn);

    return {
      title: title,
      axes: diagram.axes,
      curves: diagram.curves,
      options: options,
      N: diagram.axes.length,
      K: diagram.curves.length,
      noRange: noRange,
      inverted: inverted,
      maxUnplotted: maxIsUnplotted(options, drawnSeries),
      legend: legendIsDrawn(options, diagram.curves.length),
      tabled: drawnSeries,
      compared: noRange || inverted ? [] : drawnSeries,
    };
  }

  // ---------------------------------------------------------------------
  // The short tier - rule RD1
  // ---------------------------------------------------------------------

  /**
   * The short description - rule RD1. THE ONLY BUILDER OF THE SHORT SENTENCE.
   *
   * VERBATIM: the title is not escaped here, because this tier reaches a
   * `textContent` sink and the SVG's `aria-label`, where an entity would be
   * announced literally. `buildShortHtml` is `escapeHtml` of this string and
   * never a second composition, so the two tiers cannot disagree.
   *
   * @param {Object} facts - From `measure`
   * @returns {string} The short sentence
   */
  function buildShortText(facts) {
    const titled = facts.title === null ? "" : ` titled "${facts.title}"`;
    return `A radar chart${titled} with ${axesPhrase(facts.N)} and ${seriesPhrase(
      facts.K
    )}.`;
  }

  /**
   * The HTML short tier - DERIVED from the plain one and never composed.
   * @param {Object} facts - From `measure`
   * @returns {string} The escaped short sentence
   */
  function buildShortHtml(facts) {
    return escapeText(buildShortText(facts));
  }

  // ---------------------------------------------------------------------
  // The Overview - rules RD2 to RD5
  // ---------------------------------------------------------------------

  /**
   * Overview paragraph one - RD2: the title, the series and the axes.
   * @param {Object} facts - From `measure`
   * @returns {string} The sentence
   */
  function buildOpeningSentence(facts) {
    const titled = facts.title === null ? "" : ` titled ${quotedLabel(facts.title)}`;
    return `This radar chart${titled} plots ${seriesPhrase(facts.K)} across ${axesPhrase(
      facts.N
    )}.`;
  }

  /**
   * Overview paragraph two - RD3: every axis, in declaration order.
   *
   * "clockwise from the top" is a fact of the picture, measured (RR1): the
   * first declared axis is at the top and the order runs clockwise at 360/N
   * degrees. EDGE 2's no-axis chart reads "There are no axes."
   *
   * @param {Object} facts - From `measure`
   * @returns {string} The sentence
   */
  function buildAxesSentence(facts) {
    const labels = facts.axes.map((axis, index) => axisName(axis, index));
    if (facts.N === 0) return "There are no axes.";
    if (facts.N === 1) return `The one axis is at the top and is ${labels[0]}.`;
    return `The axes, clockwise from the top, are ${joinNoSerial(labels)}.`;
  }

  /**
   * The values the picture clamps to one end of the scale - RD4, MQ4, RR20.
   *
   * Only DRAWN series count, because only a drawn series has a vertex to be
   * "drawn at the scale's maximum" or "drawn at the centre"; a series the
   * picture omits (RD8) clips nothing.
   *
   * @param {Object} facts - From `measure`
   * @param {Function} isOutside - True for a value the renderer clamps
   * @returns {number} How many drawn values it clamps
   */
  function countClamped(facts, isOutside) {
    let clamped = 0;
    facts.tabled.forEach((curve) => {
      curve.values.forEach((value) => {
        if (isOutside(value)) clamped += 1;
      });
    });
    return clamped;
  }

  /**
   * One clamped-value sentence - RD4: "One value is above 50 and is drawn at
   * the scale's maximum." / "Three values are below 50 and are drawn at the
   * centre." The count is in words to nine, capitalised.
   *
   * @param {number} count - How many values are clamped, at least one
   * @param {string} side - "above" or "below"
   * @param {number} bound - The scale end they pass
   * @param {string} place - Where the picture draws them
   * @returns {string} The sentence
   */
  function clampedSentence(count, side, bound, place) {
    const subject =
      count === 1 ? "One value is" : `${common().capitalize(valuesPhrase(count))} are`;
    const verb = count === 1 ? "is" : "are";
    return `${subject} ${side} ${numberText(bound)} and ${verb} drawn at ${place}.`;
  }

  /**
   * Overview paragraph three - RD4, the scale. THE ONLY BUILDER OF IT.
   *
   * Five branches, in this order:
   *   - `scaleMax` null (no series delivered, EDGE 1): the sentence is
   *     OMITTED (RR5), and this returns null.
   *   - no range (`scaleMax === min`, RR15): nothing is plotted, and the
   *     sentence says so (RR3). The data form keeps "set by the highest
   *     value"; an author max equal to min drops that clause, because the
   *     author set it, and adds no clipped count, because nothing is drawn at
   *     any ring.
   *   - an INVERTED scale, min above max on either branch (EDGE 5, RR19):
   *     the range, then "so every value is drawn at the scale's maximum",
   *     and no clamped-value sentence.
   *   - otherwise the range - "set by the highest value" on the data branch
   *     (MQ1), with ", which is in a series that is not plotted" when no
   *     plotted value reaches it (RR29) - then one sentence for the values
   *     above the maximum (MQ4,
   *     RR23) and one for the values below the minimum (RR20), each only
   *     when it counts at least one drawn value, above before below.
   *
   * @param {Object} facts - From `measure`
   * @returns {string|null} The paragraph's text, or null when omitted
   */
  function buildScaleSentence(facts) {
    const options = facts.options;
    if (options.scaleMax === null) return null;

    const range = `The scale runs from ${numberText(options.min)} to ${numberText(
      options.scaleMax
    )}`;
    const fromData = options.scaleMaxSource === "data";

    if (facts.noRange) {
      return fromData
        ? `${range}, set by the highest value, so no series is plotted.`
        : `${range}, so no series is plotted.`;
    }

    // RR19: every value is drawn at the maximum, and no clamped count follows.
    if (facts.inverted) {
      return fromData
        ? `${range}, set by the highest value, so every value is drawn at ${SCALE_MAXIMUM_PLACE}.`
        : `${range}, so every value is drawn at ${SCALE_MAXIMUM_PLACE}.`;
    }

    // The data branch names where its maximum came from only when that is
    // not the picture (RR29): the renderer derives it over EVERY series, so an
    // unplotted one can set the scale the plotted ones are drawn against.
    let opening = `${range}.`;
    if (fromData) {
      opening = facts.maxUnplotted
        ? `${range}, set by the highest value, which is in a series that is not plotted.`
        : `${range}, set by the highest value.`;
    }
    const sentences = [opening];

    // Clamped values are narrated only on a real range, above before below.
    // "at the scale's maximum", never "at the outer ring" (RR23): at ticks 0
    // there is no ring, and at a fractional ticks the outermost ring lies
    // beyond the maximum. Above-maximum is zero on the data branch by
    // construction, the maximum being the highest value; below-minimum can
    // occur on either branch, because the renderer clamps to `min` whichever
    // set the maximum (RR20).
    const above = countClamped(facts, (value) => value > options.scaleMax);
    if (above > 0) {
      sentences.push(clampedSentence(above, "above", options.scaleMax, SCALE_MAXIMUM_PLACE));
    }
    const below = countClamped(facts, (value) => value < options.min);
    if (below > 0) {
      sentences.push(clampedSentence(below, "below", options.min, CENTRE_PLACE));
    }
    return sentences.join(" ");
  }

  /**
   * Overview paragraph four - RD5, the grid and the legend.
   *
   * THE RING COUNT IS WHAT THE RENDERER DRAWS (RR22): its graticule loop runs
   * `for (a = 0; a < ticks; a++)`, so a fractional ticks draws the CEILING -
   * measured 2 rings at 1.5, 1 at 0.5 and 3 at 2.5, in both grid modes - and
   * ticks 0 draws none, which reads "no rings" with no shape word.
   *
   * @param {Object} facts - From `measure`
   * @returns {string} The sentence
   */
  function buildGridSentence(facts) {
    const options = facts.options;
    const shape = options.graticule === "polygon" ? "polygonal" : "circular";
    const ringCount = Math.ceil(options.ticks);
    const rings =
      ringCount === 0 ? "no rings" : countPhrase(ringCount, `${shape} ring`, `${shape} rings`);
    const legend = facts.legend ? "a legend names the series" : "there is no legend";
    return `The grid has ${rings}, and ${legend}.`;
  }

  // ---------------------------------------------------------------------
  // The Series list - rules RD7, RD8 and RD10
  // ---------------------------------------------------------------------

  /**
   * The mean of a series, rounded - RD7, RR14. THE ONLY AVERAGE IN THIS FILE.
   *
   * HALVES ROUND AWAY FROM ZERO, which `Math.round` alone does not do: it
   * rounds a half towards positive infinity, so -2.5 gives -2. Rounding the
   * magnitude and restoring the sign gives -3, and 2.5 still gives 3. A
   * result of -0 is returned as 0, so `String()` of it reads "0".
   *
   * A HALF IS FOUND ON TWICE THE MEAN, WITHIN A TOLERANCE, never by equality
   * (RR25 on the sweep's F1). Binary floating point sums 0.1, 4.1 and 3.3 to
   * 7.499999999999999, so the mean 2.5 arrives as 2.4999999999999996 and a
   * plain round gives 2. Twice the mean lands within HALF_TOLERANCE of an odd
   * whole number exactly when the decimal mean is a half; the exact halves
   * (2 and 3, 1.5 and 3.5) take the same branch and still give 3.
   *
   * @param {number[]} values - A series' values
   * @returns {number} The rounded mean
   */
  function roundedMean(values) {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const magnitude = Math.abs(mean);
    const twice = magnitude * 2;
    const nearestTwice = Math.round(twice);
    const isHalf =
      Math.abs(twice - nearestTwice) < HALF_TOLERANCE && nearestTwice % 2 === 1;
    const roundedMagnitude = isHalf ? (nearestTwice + 1) / 2 : Math.round(magnitude);
    const rounded = Math.sign(mean) * roundedMagnitude;
    return rounded === 0 ? 0 : rounded;
  }

  /**
   * The highest/lowest sentence of a series - RD7. THE ONLY PLACE EXTREMES
   * ARE FOUND.
   *
   * A tie lists every tied axis, in axis order, joined as the axes sentence
   * joins; an axis label shared by two axes is named once per axis carrying
   * it (RR13, EDGE 4). Every value equal reads "The same value on every
   * axis." The one-axis form has no sentence at all and never reaches here.
   *
   * @param {Object[]} axes - The delivered axes
   * @param {number[]} values - The series' values, in axis order
   * @returns {string} The sentence
   */
  function extremesSentence(axes, values) {
    const highest = Math.max(...values);
    const lowest = Math.min(...values);
    if (highest === lowest) return "The same value on every axis.";

    const on = (target) =>
      joinNoSerial(
        axes
          .map((axis, index) => (values[index] === target ? axisName(axis, index) : null))
          .filter((name) => name !== null)
      );
    return `Highest on ${on(highest)}, lowest on ${on(lowest)}.`;
  }

  /**
   * The nested per-axis list of a drawn series - RD7 form B.
   * @param {Object[]} axes - The delivered axes
   * @param {number[]} values - The series' values, in axis order
   * @returns {string[]} The lines, `<ul>` to `</ul>`
   */
  function axisValueLines(axes, values) {
    const lines = ["<ul>"];
    axes.forEach((axis, index) => {
      lines.push(`<li>${openingAxisName(axis, index)}: ${numberText(values[index])}</li>`);
    });
    lines.push("</ul>");
    return lines;
  }

  /**
   * One series as list-item lines - RD7, RD8 and RD10. THE ONLY BUILDER OF A
   * SERIES ITEM.
   *
   * DRAWN (RD7, form B): the summary line - the label, RD10's disclosure when
   * there is no legend, ", averaging M" when the chart has a range, then the
   * highest/lowest sentence - then one nested item per axis. RD7's one-axis
   * form is WITHDRAWN (RR21): a series on one axis is not drawn (RS7b), so it
   * takes the arm below.
   *
   * NOT DRAWN (RD8): the reason, the legend clause or its no-legend
   * replacement, and the values bare in the order written. The reason is the
   * value count against the axis count on a count mismatch, and "only one
   * axis" when the counts agree on a single-axis chart (RR21). RD8's no-legend
   * replacement already says the series is named in the code and not in the
   * picture, so RD10's bracketed disclosure is not repeated on this arm.
   *
   * @param {Object} facts - From `measure`
   * @param {Object} curve - A delivered series
   * @returns {string[]} The lines, `<li>` to `</li>`
   */
  function buildSeriesItem(facts, curve) {
    // The label opens the item on both arms (RR34).
    const label = openingSeriesName(facts, curve);

    if (!curve.drawn) {
      const legendClause = facts.legend
        ? "though the legend names it"
        : "and it is named in the code, not in the picture";
      const leadIn =
        curve.values.length === 1
          ? "Its one value, in the order written:"
          : "Its values, in the order written:";
      // A single-axis chart whose counts agree is undrawn for its one axis,
      // not for a mismatch; every other undrawn series is a count mismatch.
      const reason =
        curve.values.length === facts.N
          ? "only one axis"
          : `${valuesPhrase(curve.values.length)} for ${axesPhrase(facts.N)}`;
      const lines = [
        `<li>${label}: ${reason}, so it is not plotted, ${legendClause}. ${leadIn}`,
        "<ul>",
      ];
      curve.values.forEach((value) => lines.push(`<li>${numberText(value)}</li>`));
      lines.push("</ul>", "</li>");
      return lines;
    }

    const disclosure = facts.legend ? "" : " (named in the code, not in the picture)";
    const averaging = facts.noRange ? "" : `, averaging ${numberText(roundedMean(curve.values))}`;
    const summary = `${label}${disclosure}${averaging}. ${extremesSentence(facts.axes, curve.values)}`;
    return [`<li>${summary}`, ...axisValueLines(facts.axes, curve.values), "</li>"];
  }

  // ---------------------------------------------------------------------
  // The Comparison - rule RD14
  // ---------------------------------------------------------------------

  /**
   * One pair of plotted series - RD14. THE ONLY PLACE TWO SERIES ARE COMPARED.
   *
   * The earlier series is always the subject. Every axis is named once, in
   * axis order, in exactly one of three lists; a label shared by two axes is
   * named once per axis carrying it (RR13). The forms, with RR12's two:
   *   - every axis in one list: "on every axis", or "are equal on every axis";
   *   - otherwise the higher list, then ", and lower on", then ", and equal
   *     on", each present only when it is non-empty, the sentence opening on
   *     "is higher than" or, with no higher list, "is lower than".
   *
   * @param {Object} facts - From `measure`
   * @param {Object} first - The earlier series
   * @param {Object} second - The later series
   * @returns {string} The sentence
   */
  function buildPairSentence(facts, first, second) {
    const higher = [];
    const lower = [];
    const equal = [];
    facts.axes.forEach((axis, index) => {
      const a = first.values[index];
      const b = second.values[index];
      const name = axisName(axis, index);
      if (a > b) higher.push(name);
      else if (a < b) lower.push(name);
      else equal.push(name);
    });

    // The subject opens every form of the sentence below (RR34).
    const subject = openingSeriesName(facts, first);
    const other = seriesName(facts, second);
    const total = facts.axes.length;

    if (higher.length === total) return `${subject} is higher than ${other} on every axis.`;
    if (lower.length === total) return `${subject} is lower than ${other} on every axis.`;
    if (equal.length === total) return `${subject} and ${other} are equal on every axis.`;

    const parts = [];
    if (higher.length > 0) {
      parts.push(`${subject} is higher than ${other} on ${joinNoSerial(higher)}`);
      if (lower.length > 0) parts.push(`and lower on ${joinNoSerial(lower)}`);
    } else {
      parts.push(`${subject} is lower than ${other} on ${joinNoSerial(lower)}`);
    }
    if (equal.length > 0) parts.push(`and equal on ${joinNoSerial(equal)}`);
    return `${parts.join(", ")}.`;
  }

  /**
   * The Comparison section's list items - RD14, pairs in declaration order.
   *
   * CAPPED AT SIX PAIRS (RR30 on OR-8): the list grows as K(K-1)/2 and each
   * sentence names every axis, so ten series gave 45 pairs and 7,086
   * characters (sweep p08b). Six is the four-series count, the largest any
   * exemplar reaches; above it the first six are kept in pair order and one
   * closing item says how many were left out. The next pair count above six
   * is ten, so the remainder is always at least four and always plural.
   *
   * @param {Object} facts - From `measure`
   * @returns {string[]} One `<li>` line per listed pair, then any closing item
   */
  function comparisonLines(facts) {
    const lines = [];
    const series = facts.compared;
    for (let i = 0; i < series.length; i += 1) {
      for (let j = i + 1; j < series.length; j += 1) {
        lines.push(`<li>${buildPairSentence(facts, series[i], series[j])}</li>`);
      }
    }
    if (lines.length <= MAX_LISTED_PAIRS) return lines;

    const remaining = lines.length - MAX_LISTED_PAIRS;
    return [
      ...lines.slice(0, MAX_LISTED_PAIRS),
      `<li>The remaining ${countWord(remaining)} pairs are not listed; the data table has every value.</li>`,
    ];
  }

  // ---------------------------------------------------------------------
  // The Data Table - rule RD9
  // ---------------------------------------------------------------------

  /**
   * The data table - RD9. THE ONLY BUILDER OF IT.
   *
   * One column per DRAWN series (a series the picture omits has no column),
   * one row per axis. Labels are unquoted and escaped once at entry.
   *
   * @param {Object} facts - From `measure`
   * @returns {string[]} The lines, `<table>` to `</table>`
   */
  function buildDataTable(facts) {
    const caption =
      facts.title === null
        ? "Data table for this radar chart"
        : `Data table for: ${escapeText(facts.title)}`;
    const headerCells = facts.tabled
      .map(
        (curve) =>
          `<th scope="col">${cellName(
            curve.label,
            UNLABELLED_SERIES,
            facts.curves.indexOf(curve) + 1
          )}</th>`
      )
      .join("");
    const lines = [
      "<table>",
      `<caption>${caption}</caption>`,
      `<thead><tr><th scope="col">Axis</th>${headerCells}</tr></thead>`,
      "<tbody>",
    ];
    facts.axes.forEach((axis, index) => {
      const cells = facts.tabled
        .map((curve) => `<td>${numberText(curve.values[index])}</td>`)
        .join("");
      lines.push(
        `<tr><th scope="row">${cellName(axis.label, UNLABELLED_AXIS, index + 1)}</th>${cells}</tr>`
      );
    });
    lines.push("</tbody>", "</table>");
    return lines;
  }

  // ---------------------------------------------------------------------
  // The registered tiers
  // ---------------------------------------------------------------------

  /**
   * Fetch and verify the diagram, or throw.
   *
   * A parse rejection is deliberately NOT caught - the core's catch turns it
   * into the honest generation-failed fallback. A failed adapter self-check
   * throws for the same reason.
   *
   * THE GUARD RUNS AFTER THE PARSE and tests for `false`, not falsiness:
   * `parseRadar` is what STARTS the lazy self-check, so `isRadarHealthy()`
   * reads `null` before the first call settles, and a guard placed before the
   * parse, or testing `!healthy`, could never refuse on the first call of a
   * page. (Kanban, block, sequence and c4 precedent.)
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} The adapter's normalised radar delivery
   */
  async function readRadar(code) {
    const diagram = await window.MermaidParseAdapter.parseRadar(code);
    if (window.MermaidParseAdapter.isRadarHealthy() === false) {
      logWarn("[Mermaid Accessibility] Radar self-check failed; refusing to narrate");
      throw new Error(
        "Parse adapter failed its radar self-check; refusing to narrate an unverified diagram"
      );
    }
    logDebug(
      `[Mermaid Accessibility] Radar delivery: ${diagram.diagramType}, ${
        (diagram.axes || []).length
      } axis(es), ${(diagram.curves || []).length} series`
    );
    return diagram;
  }

  /**
   * Generate a short description for a radar chart - rule RD1.
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to `{ html, text }`
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating radar short description");

    const facts = measure(await readRadar(code));
    const text = buildShortText(facts);
    logDebug(`[Mermaid Accessibility] Radar short: ${text}`);

    return { html: buildShortHtml(facts), text: text };
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
   * Generate a detailed description for a radar chart - rule RD6's structure.
   *
   * `<h4>Overview</h4>` with RD2 to RD5, each its own paragraph (the scale
   * paragraph omitted when RD4 omits it); `<h4>Series</h4>` with one ordered
   * item per series in declaration order, or "No series is plotted." when
   * there are none; `<h4>Comparison</h4>` only when two or more series are
   * PLOTTED; `<h4>Data Table</h4>` only when at least one series is drawn.
   *
   * NOTHING IS DE-DUPLICATED (RR6, RR13): a repeated axis or series label is
   * narrated once per position, as the picture draws it.
   *
   * Newline-joined so text-content extraction stays readable.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating radar detailed description");

    const facts = measure(await readRadar(code));

    const parts = [
      "<h4>Overview</h4>",
      `<p>${buildOpeningSentence(facts)}</p>`,
      `<p>${buildAxesSentence(facts)}</p>`,
    ];
    const scale = buildScaleSentence(facts);
    if (scale !== null) parts.push(`<p>${scale}</p>`);
    parts.push(`<p>${buildGridSentence(facts)}</p>`);

    parts.push("<h4>Series</h4>");
    if (facts.K === 0) {
      parts.push("<p>No series is plotted.</p>");
    } else {
      parts.push("<ol>");
      facts.curves.forEach((curve) => parts.push(...buildSeriesItem(facts, curve)));
      parts.push("</ol>");
    }

    if (facts.compared.length >= 2) {
      parts.push("<h4>Comparison</h4>", "<ul>", ...comparisonLines(facts), "</ul>");
    }

    if (facts.tabled.length > 0) {
      parts.push("<h4>Data Table</h4>", ...buildDataTable(facts));
    }

    return parts.join("\n");
  }

  // Register with the core module. `generateShort` returns plain text because
  // the core assigns its result straight to descriptions.short, which reaches
  // the figcaption and the SVG aria-label.
  //
  // THE KEY IS "radar", AND THE DETECTOR ROW THAT ROUTES TO IT LANDS IN THE
  // SAME CHANGE AS THIS FILE'S SCRIPT TAG, with the bare `radar` row in the
  // core's UNSUPPORTED_HUMAN_NAMES (register item 89). A generator registered
  // without its MERMAID_TYPE_TO_KEY row registers and is never called.
  //
  // generateShortHTML is the ASYNC shape, and it has to be: this module awaits
  // the parse adapter (register item 13).
  window.MermaidAccessibility.registerDescriptionGenerator("radar", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
  });

  logInfo(
    "[Mermaid Accessibility] Radar chart module loaded and registered on the parse adapter's radar surface"
  );
})();
