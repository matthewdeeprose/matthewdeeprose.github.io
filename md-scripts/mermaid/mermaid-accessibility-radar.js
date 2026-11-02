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

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("[Mermaid Accessibility] Core module not loaded!");
    return;
  }

  /**
   * The shared chart-description builders (vendor/chart-describe/src/charts.js),
   * resolved at call time and never cached, so load order cannot leave a stale
   * capture. If charts.js is missing, the first call throws and the core's
   * generator-failed fallback speaks, rather than wrong text being returned.
   * The wording lives there; this module reads the delivery (`measure`) and
   * hands the facts over.
   * @returns {Object} ChartDescribeCharts
   */
  function chartsCore() {
    return window.ChartDescribeCharts;
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
    const descriptions = chartsCore().buildRadarShort(facts);
    logDebug(`[Mermaid Accessibility] Radar short: ${descriptions.text}`);

    return descriptions;
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

    return chartsCore().buildRadarDetailed(facts);
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
