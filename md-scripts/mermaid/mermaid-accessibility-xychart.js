/**
 * Mermaid Accessibility - XY Chart Module
 *
 * Generates accessible descriptions for `xychart-beta` diagrams from the shared
 * parse adapter's XY chart surface (mermaid-parse-adapter.js), never from the
 * SVG. The fifteenth generator; before it existed an XY chart received the
 * core's honest "no description available" fallback.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-xychart-gold-targets-2026-08-23.md — rules XC1 to XC23 and six
 * byte-exact approved targets, pinned by thirty-three harness fixtures. A mismatch
 * between this module's output and a target is a STOP that goes back to the
 * design seat; it is never a reason to edit a target or a fixture.
 *
 * WHY THIS MODULE READS AN ADAPTER SURFACE THAT READS THE SOURCE. Mermaid's
 * xychart db delivers no data at all — every one of its nineteen members is a
 * function and none returns the chart's numbers, its series names or its axis
 * declarations (docs/mermaid-xychart-grounding-2026-08-22.md). Only `title`,
 * `accTitle` and `accDescr` come from the db. The adapter's surface therefore
 * reads the author's own source for everything else, inside the same queue
 * slot, and only after Mermaid has judged the source valid.
 *
 * THE STATISTICS ARE CHART.JS'S, DELIBERATELY. This engine and
 * md-scripts/charts/chart-accessibility.js are siblings, and one reader meeting
 * both should hear one voice, so the thresholds, the trend vocabulary and the
 * number formatter are that engine's, measured and quoted in
 * docs/mermaid-xychart-chartjs-conventions-2026-08-22.md. Its measured defects
 * are fixed here rather than inherited: see FIXED CHART.JS DEFECTS below.
 */
const XychartModule = (function () {
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

  // Current logging level (can be modified at runtime if needed)
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  /**
   * Check if logging should occur for the given level
   * @param {number} level - The log level to check
   * @returns {boolean} Whether logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log an error message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logError(context, message) {
    if (!shouldLog(LOG_LEVELS.ERROR)) return;

    if (typeof message === "object") {
      console.error(`[XY Chart][ERROR][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.error(`[XY Chart][ERROR][${context}] ${message}`);
    }
  }

  /**
   * Log a warning message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logWarn(context, message) {
    if (!shouldLog(LOG_LEVELS.WARN)) return;

    if (typeof message === "object") {
      console.warn(`[XY Chart][WARN][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.warn(`[XY Chart][WARN][${context}] ${message}`);
    }
  }

  /**
   * Log an info message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logInfo(context, message) {
    if (!shouldLog(LOG_LEVELS.INFO)) return;

    if (typeof message === "object") {
      console.log(`[XY Chart][INFO][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[XY Chart][INFO][${context}] ${message}`);
    }
  }

  /**
   * Log a debug message
   * @param {string} context - The context for the log
   * @param {any} message - The message to log
   */
  function logDebug(context, message) {
    if (!shouldLog(LOG_LEVELS.DEBUG)) return;

    if (typeof message === "object") {
      console.log(`[XY Chart][DEBUG][${context}]`);
      console.dir(message, { depth: null });
    } else {
      console.log(`[XY Chart][DEBUG][${context}] ${message}`);
    }
  }

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("Module Check", "Core module not loaded!");
    return;
  }

  // ---------------------------------------------------------------------
  // The shared prose layer, resolved AT CALL TIME and never cached
  // ---------------------------------------------------------------------
  //
  // Every other diagram module writes `const Common =
  // window.MermaidAccessibilityCommon;` at module scope, and that is safe only
  // while common.js is guaranteed to have run first. It is not a property of
  // this module that it loads late — `mermaid-accessibility-utils.js` is loaded
  // BEFORE common.js in tools.html, so the ordering is already not uniform
  // across the mermaid block. A module-scope const captures `undefined`
  // permanently if it ever loses that race, and the symptom is a TypeError deep
  // inside a tier rather than anything that names the load order. Resolving off
  // `window` at call time costs one property read per call and cannot go stale.

  /**
   * The shared prose layer (narrationNumber, formatList, capitalize,
   * escapeHtml), resolved at call time.
   * @returns {Object} MermaidAccessibilityCommon
   */
  function common() {
    return window.MermaidAccessibilityCommon;
  }

  /**
   * Escape one string of AUTHOR TEXT for an HTML sink.
   *
   * Knowledge base § 14.2 rules 2, 3 and 4: the caller escapes, exactly once,
   * at the point the field enters the HTML; generator furniture — the tags,
   * the quotation marks around a label, the commas and the "and" — is never
   * escaped; transforms run before the escape; list items are escaped before a
   * join, never after it. The PLAIN short tier is raw and calls none of this.
   *
   * @param {string} text - Author text
   * @returns {string} The escaped string
   */
  function escapeText(text) {
    return common().escapeHtml(text);
  }

  /**
   * Narration count: words for zero to nine, digits from 10 (rule XC10).
   * @param {number} value - The count
   * @returns {string} The count as it is spoken
   */
  function countWord(value) {
    return common().narrationNumber(value);
  }

  // ---------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------

  const SERIES_KINDS = Object.freeze({ BAR: "bar", LINE: "line" });
  const AXIS_KINDS = Object.freeze({ BAND: "band", RANGE: "range" });
  const ORIENTATIONS = Object.freeze({
    VERTICAL: "vertical",
    HORIZONTAL: "horizontal",
  });

  // The trend vocabulary is Chart.js's six strings at its own 70% threshold
  // (conventions § 5b), quoted rather than reworded so the two engines cannot
  // drift apart.
  const TRENDS = Object.freeze({
    UP: "consistently increasing",
    DOWN: "consistently decreasing",
    STABLE: "stable",
    UP_NOISY: "generally increasing with fluctuations",
    DOWN_NOISY: "generally decreasing with fluctuations",
    NONE: "fluctuating with no clear trend",
    UNKNOWN: "unknown",
  });

  // FIXED CHART.JS DEFECT (rule XC5). Chart.js writes `shows a ${trend} trend`
  // for every member of the vocabulary above, which produces "shows a generally
  // decreasing with fluctuations trend" and "shows a fluctuating with no clear
  // trend trend". The clause is reordered here instead, per trend, which is why
  // this is a table rather than one template.
  const TREND_CLAUSE = Object.freeze({
    [TRENDS.UP]: "shows a consistently increasing trend",
    [TRENDS.DOWN]: "shows a consistently decreasing trend",
    [TRENDS.STABLE]: "shows a stable trend",
    [TRENDS.UP_NOISY]: "shows a generally increasing trend, with fluctuations",
    [TRENDS.DOWN_NOISY]:
      "shows a generally decreasing trend, with fluctuations",
    [TRENDS.NONE]: "fluctuates with no clear trend",
  });

  // Chart.js's rankingWords, extended past "ninth" with a suffix rule, because
  // rule XC6 locates every point on a numeric-range axis by an ordinal the
  // generator owns and a ten-point chart is the smallest gold exemplar of that
  // kind.
  const RANKING_WORDS = Object.freeze([
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

  // Rule XC5's statistics tier fires from five values (OQ3, ruled 23 August
  // 2026), matching Chart.js's minDataPointsForAdvanced.
  const STATISTICS_MIN_POINTS = 5;

  // Rule XC18: from this many tied positions the list collapses to a count,
  // because "at the first, third, fifth and eighth points" is a list a listener
  // cannot hold. UNWITNESSED — no fixture in the corpus has four tied extremes.
  const TIED_POSITION_COLLAPSE_AT = 4;

  // Chart.js's inner guard for the cyclic and start-to-end sentences.
  const LINE_ADVANCED_MIN_POINTS = 4;

  // Chart.js's own thresholds, quoted (conventions §§ 5b, 5c, 5d, 5e, 5f).
  const TREND_DOMINANCE = 0.7;
  const HIGH_POINT_RATIO = 1.5;
  const LOW_POINT_RATIO = 0.5;
  const SKEW_TOLERANCE = 0.2;
  const OVERALL_CHANGE_MIN_PERCENT = 50;

  // Rule XC11's fallbacks, used when the author declared no axis title and the
  // XC12 detector found no shape every label fits.
  const FALLBACK_NOUN = Object.freeze({
    singular: "Category",
    plural: "categories",
  });
  const RANGE_POINT_NOUN = "Point";
  const FALLBACK_VALUE_HEADER = "Value";

  // The two nouns a LABEL-LESS x position can take, keyed by the kind
  // `pointReferencePart` returns. They are deliberately different words:
  // "point" is rule XC6's, for a numeric-range axis that declares no positions
  // at all, and "position" is rule XC20's, for an index past the end of a band
  // axis's declared labels. Collapsing them would put one idiom on two
  // different things — which is the defect XC20 exists to remove, not a
  // tidiness to restore.
  const POSITION_NOUN = Object.freeze({
    ordinal: Object.freeze({ singular: "Point", plural: "points" }),
    position: Object.freeze({ singular: "Position", plural: "positions" }),
  });

  // Rule XC20's cell text for a position a series has no value for. It is words
  // rather than an empty cell because contract clause D6 forbids the silence:
  // a reader meeting `<td></td>` cannot tell whether the author recorded a
  // zero, recorded nothing, or the description dropped it.
  const NO_VALUE_TEXT = "no value";

  // The two grammatical contexts a position reference is rendered into (rule
  // XC21). A reference with nothing to disambiguate renders identically in
  // both, which is the invariant that keeps every unique-label chart untouched.
  const REFERENCE_STYLE = Object.freeze({
    STANDALONE: "standalone",
    PARENTHETICAL: "parenthetical",
  });

  // The two description tiers, so a formatter can differ between them without a
  // bare boolean at the call site (rule XC23).
  const TIERS = Object.freeze({ SHORT: "short", DETAILED: "detailed" });

  // Rule XC23(b). An AUTHOR value with more decimal places than this is spoken
  // rounded, and only in the short tier — the SVG aria-label and the visible
  // figcaption, where a screen reader announces every digit in turn. The
  // detailed tier and the table keep the author's value verbatim, so rule XC8
  // is untouched where the reader can actually read the number.
  const SHORT_TIER_MAX_DECIMALS = 4;
  const SHORT_TIER_ROUNDING = 2;

  // The noun a COUNT OF VALUES takes, so rule XC20's mismatch sentence reads
  // "one value" rather than "one values". Routed through `countedNoun` so the
  // agreement decision stays at the one choke point XP6 established.
  const VALUE_NOUN = Object.freeze({ singular: "Value", plural: "values" });

  // ---------------------------------------------------------------------
  // Rule XC12 — label-type detection
  // ---------------------------------------------------------------------
  //
  // The first six shapes are Chart.js's own detector; the rest were minted for
  // this arc on 23 August 2026. EXACT PATTERNS ONLY, and the noun improves only
  // when EVERY label fits one shape — a single non-match falls the whole axis
  // back to Category/categories, because a half-right noun is worse than a
  // neutral one. An author x-axis title always wins and this detector is not
  // consulted at all in that case (XC12), so the guess can only ever rename a
  // noun the generator itself owns.
  //
  // Order matters and is fixed: a split year such as "2020-21" must not be
  // taken for a date, and "May" must not be taken for a day.

  const DAY_NAMES = Object.freeze([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    "mon",
    "tue",
    "tues",
    "wed",
    "thu",
    "thur",
    "thurs",
    "fri",
    "sat",
    "sun",
  ]);

  const MONTH_NAMES = Object.freeze([
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
    "jan",
    "feb",
    "mar",
    "apr",
    "jun",
    "jul",
    "aug",
    "sep",
    "sept",
    "oct",
    "nov",
    "dec",
  ]);

  const MONTH_ALTERNATION =
    "(?:january|february|march|april|may|june|july|august|september|october|" +
    "november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)";

  const LABEL_SHAPES = Object.freeze([
    {
      singular: "Day",
      plural: "days",
      test: (label) => DAY_NAMES.indexOf(label.toLowerCase()) !== -1,
    },
    {
      singular: "Month",
      plural: "months",
      test: (label) => {
        const lower = label.toLowerCase();
        if (MONTH_NAMES.indexOf(lower) !== -1) return true;
        // Month plus year: "Jan 2024", "January 24", "Jan-24", "Jan/2024".
        return new RegExp(
          `^${MONTH_ALTERNATION}[\\s\\-/]\\d{2}(?:\\d{2})?$`
        ).test(lower);
      },
    },
    {
      singular: "Quarter",
      plural: "quarters",
      test: (label) =>
        /^q[1-4]$/.test(label.toLowerCase()) ||
        /^q[1-4][\s\-/]?\d{2}(?:\d{2})?$/.test(label.toLowerCase()) ||
        /^\d{4}[\s\-/]?q[1-4]$/.test(label.toLowerCase()),
    },
    {
      singular: "Week",
      plural: "weeks",
      test: (label) => /^week\s+\d+$/.test(label.toLowerCase()),
    },
    {
      singular: "Semester",
      plural: "semesters",
      test: (label) => /^semester\s+\d+$/.test(label.toLowerCase()),
    },
    {
      singular: "Term",
      plural: "terms",
      test: (label) => /^term\s+\d+$/.test(label.toLowerCase()),
    },
    {
      singular: "Time",
      plural: "times",
      test: (label) =>
        /^\d{1,2}:\d{2}(?::\d{2})?(?:\s?(?:am|pm))?$/.test(
          label.toLowerCase()
        ) || /^\d{1,2}\s?(?:am|pm)$/.test(label.toLowerCase()),
    },
    {
      singular: "Date",
      plural: "dates",
      test: (label) => {
        const lower = label.toLowerCase();
        if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) return true;
        if (/^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2}(?:\d{2})?$/.test(lower))
          return true;
        return new RegExp(
          `^\\d{1,2}\\s${MONTH_ALTERNATION}(?:\\s\\d{2}(?:\\d{2})?)?$`
        ).test(lower);
      },
    },
    {
      singular: "Year",
      plural: "years",
      test: (label) => {
        const lower = label.toLowerCase();
        // Plain, split (2020-21, 2020/21, 2020-2021) and financial years.
        if (/^\d{4}$/.test(lower)) return true;
        if (/^\d{4}[-/]\d{2}(?:\d{2})?$/.test(lower)) return true;
        if (/^fy\s?\d{2}(?:\d{2})?(?:[-/]\d{2}(?:\d{2})?)?$/.test(lower))
          return true;
        return false;
      },
    },
  ]);

  /**
   * The noun a band axis's labels earn, under rule XC12.
   *
   * @param {Array<string>} categories - The author's labels, verbatim
   * @returns {Object} `{ singular, plural, detected }`
   */
  function detectLabelNoun(categories) {
    if (!Array.isArray(categories) || categories.length === 0) {
      return {
        singular: FALLBACK_NOUN.singular,
        plural: FALLBACK_NOUN.plural,
        detected: false,
      };
    }

    for (const shape of LABEL_SHAPES) {
      const everyLabelFits = categories.every(
        (label) => typeof label === "string" && shape.test(label.trim())
      );
      if (everyLabelFits) {
        logDebug("detectLabelNoun", `All labels fit shape ${shape.singular}`);
        return {
          singular: shape.singular,
          plural: shape.plural,
          detected: true,
        };
      }
    }

    return {
      singular: FALLBACK_NOUN.singular,
      plural: FALLBACK_NOUN.plural,
      detected: false,
    };
  }

  // ---------------------------------------------------------------------
  // Numbers (rule XC10)
  // ---------------------------------------------------------------------

  /**
   * An AUTHOR value, spoken verbatim as digits (rules XC4 and XC10). The
   * author's own number is never rescaled or rounded — only DERIVED values
   * take the magnitude rule below.
   * @param {number} value - A value read from the source
   * @returns {string} The value as digits
   */
  function formatAuthorValue(value) {
    return String(value);
  }

  /**
   * An author value as the given TIER speaks it — rule XC23(b).
   *
   * The DETAILED tier and the table are unchanged and verbatim, so rule XC8
   * holds wherever the reader can actually read the number. The SHORT tier is
   * the SVG `aria-label` and the visible figcaption, and a screen reader
   * announces it digit by digit: `Values range from 2.7857142857 to 4.8` spends
   * eleven spoken digits on one endpoint, which is a caption that has stopped
   * being a caption (probe sweep XP26, and quality contract clause S2's
   * rationale that more than one number turns a caption into a data dump).
   *
   * "about" is not decoration. A rounded value stated bare would be a DIFFERENT
   * number presented as the author's; the word is what makes the rounding
   * honest, and it is why this is a readability ruling rather than a silent
   * reformat.
   *
   * SEAM, stated rather than guarded: a value in exponent notation (`1e-7`)
   * carries no "." in its string form and is returned verbatim. No such value
   * has been driven, here or in the probe sweep.
   *
   * @param {string} tier - A TIERS member
   * @param {number} value - A value read from the source
   * @returns {string} The value as that tier speaks it
   */
  function formatAuthorValueForTier(tier, value) {
    if (tier !== TIERS.SHORT) return formatAuthorValue(value);
    const text = String(value);
    const point = text.indexOf(".");
    if (point === -1) return text;
    if (text.length - point - 1 <= SHORT_TIER_MAX_DECIMALS) return text;
    return `about ${value.toFixed(SHORT_TIER_ROUNDING)}`;
  }

  /**
   * A DERIVED value — mean, standard deviation, median — under Chart.js's
   * `formatValue` magnitude rule (conventions § 4f): two decimals below 10,
   * one from 10 to 99, none from 100, and integers verbatim. No thousands
   * separator anywhere.
   * @param {number} value - A computed statistic
   * @returns {string} The value as it is spoken
   */
  function formatDerivedValue(value) {
    if (!Number.isFinite(value)) return String(value);
    if (Number.isInteger(value)) return String(value);
    const magnitude = Math.abs(value);
    const banded =
      magnitude >= 100
        ? value.toFixed(0)
        : magnitude >= 10
          ? value.toFixed(1)
          : value.toFixed(2);
    return dropTrailingZeros(banded);
  }

  /**
   * RULE XC23(a). A banded value sheds trailing zeros: `7.2`, not `7.20`.
   *
   * The band decides how much precision is CARRIED; it should not decide how
   * much is SPOKEN. A screen reader announces "7.20" as "seven point two zero",
   * and that final zero is an artefact of the below-ten band's two-decimal
   * width rather than a digit the data has — the mean of 5, 9, 4, 11 and 7 is
   * seven point two exactly (probe sweep XP25).
   *
   * `8.36` is untouched, and integers never reach here — `formatDerivedValue`
   * returns them before banding.
   *
   * DELIBERATELY NOT APPLIED to the overall-change percentage, which carries
   * its own fixed one-decimal format inherited from Chart.js and is pinned by
   * `xychart-tied-extremes/twin-peaks` at `300.0%`. XC10's "derived values"
   * clause is about the magnitude BANDS, and that sentence is not banded.
   *
   * SEAM, stated rather than guarded: a mean of 0.004 bands to "0.00" and
   * therefore now reads "0". That follows the rule as written and is no less
   * accurate than "0.00" was; it is recorded in the FS4 report, not fixed here.
   *
   * @param {string} banded - A toFixed result
   * @returns {string} The same value with no trailing decimal zeros
   */
  function dropTrailingZeros(banded) {
    if (banded.indexOf(".") === -1) return banded;
    return banded.replace(/0+$/, "").replace(/\.$/, "");
  }

  /**
   * A 1-based position as an ordinal: Chart.js's ranking words to "ninth",
   * digits with a suffix from ten.
   * @param {number} position - 1-based position
   * @returns {string} e.g. "sixth", "10th"
   */
  function ordinalWord(position) {
    if (position >= 1 && position <= RANKING_WORDS.length) {
      return RANKING_WORDS[position - 1];
    }
    const lastTwo = position % 100;
    if (lastTwo >= 11 && lastTwo <= 13) return `${position}th`;
    const lastOne = position % 10;
    if (lastOne === 1) return `${position}st`;
    if (lastOne === 2) return `${position}nd`;
    if (lastOne === 3) return `${position}rd`;
    return `${position}th`;
  }

  // ---------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------

  /**
   * Mean, extremes, POPULATION standard deviation (divide by n, matching
   * Chart.js) and the median of the SORTED values.
   *
   * THE MEDIAN IS TAKEN FROM THE SORTED VALUES, and the comment is here
   * because taking it from the source-order middle pair is the mistake that
   * actually happened: gold exemplar 6's target read 159 (the mean of the
   * unsorted middle pair, 141 and 176) where the sorted median is 164, and the
   * row's own skew call was consistent only at 164. Amended 23 August 2026.
   *
   * @param {Array<number>} values - The series values in source order
   * @returns {Object} The statistics
   */
  function computeStatistics(values) {
    const count = values.length;
    const total = values.reduce((sum, value) => sum + value, 0);
    const mean = count > 0 ? total / count : 0;

    let maxIndex = 0;
    let minIndex = 0;
    for (let i = 1; i < count; i += 1) {
      if (values[i] > values[maxIndex]) maxIndex = i;
      if (values[i] < values[minIndex]) minIndex = i;
    }

    // EVERY position holding each extreme, in source order (rule XC18). This is
    // the choke point: before it, an extreme was one index, and every renderer
    // that named a position asserted a unique one — so a chart with two equal
    // maxima told the reader about one of them under a singular verb while a
    // cyclic sentence two lines below counted two peaks (probe sweep XP11).
    // `maxIndex`/`minIndex` are kept and are always these arrays' first entry,
    // so a unique extreme renders byte-identically to before.
    const maxIndices = [];
    const minIndices = [];
    for (let i = 0; i < count; i += 1) {
      if (values[i] === values[maxIndex]) maxIndices.push(i);
      if (values[i] === values[minIndex]) minIndices.push(i);
    }

    const variance =
      count > 0
        ? values.reduce(
            (sum, value) => sum + (value - mean) * (value - mean),
            0
          ) / count
        : 0;

    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(count / 2);
    const median =
      count === 0
        ? 0
        : count % 2 === 1
          ? sorted[middle]
          : (sorted[middle - 1] + sorted[middle]) / 2;

    return {
      count: count,
      mean: mean,
      max: values[maxIndex],
      min: values[minIndex],
      maxIndex: maxIndex,
      minIndex: minIndex,
      maxIndices: maxIndices,
      minIndices: minIndices,
      standardDeviation: Math.sqrt(variance),
      median: median,
    };
  }

  /**
   * True when every value in the series is the same one — rule XC17's
   * predicate, and it covers a single value as the degenerate case of no
   * variance rather than as a separate shape.
   *
   * THE `count >= 1` HALF IS DEFENSIVE, AND ITS PATH IS UNREACHABLE IN THIS
   * BUILD — measured, not assumed. On an empty series `values[0]` is
   * `undefined` at both ends, so `max === min` would be true and an unguarded
   * test would emit "All zero values are undefined". Driving `line []` on 24
   * August 2026 produced NO description at all: the chart never reaches this
   * function, because generation throws upstream and the core's honest
   * generation-failed fallback takes over. The guard therefore protects against
   * a shape nothing currently delivers, which is a reason to keep it and not a
   * reason to claim it fires.
   *
   * @param {Object} stats - Statistics from computeStatistics
   * @returns {boolean} True when the series has no variance at all
   */
  function isDegenerateSeries(stats) {
    return stats.count >= 1 && stats.max === stats.min;
  }

  /**
   * Chart.js's `analyzeTrend`, quoted (conventions § 5b): more than 70% of
   * steps in one direction gives "consistently"; otherwise the sign of
   * last minus first decides.
   * @param {Array<number>} values - The series values in source order
   * @returns {string} One of the TRENDS vocabulary
   */
  function analyseTrend(values) {
    if (values.length < 2) return TRENDS.UNKNOWN;

    let positive = 0;
    let negative = 0;
    let unchanged = 0;
    for (let i = 1; i < values.length; i += 1) {
      const difference = values[i] - values[i - 1];
      if (difference > 0) positive += 1;
      else if (difference < 0) negative += 1;
      else unchanged += 1;
    }

    const steps = values.length - 1;
    if (positive > TREND_DOMINANCE * steps) return TRENDS.UP;
    if (negative > TREND_DOMINANCE * steps) return TRENDS.DOWN;
    if (unchanged > TREND_DOMINANCE * steps) return TRENDS.STABLE;

    const overall = values[values.length - 1] - values[0];
    if (overall > 0) return TRENDS.UP_NOISY;
    if (overall < 0) return TRENDS.DOWN_NOISY;
    return TRENDS.NONE;
  }

  /**
   * Interior local maxima and minima — a point strictly greater (or smaller)
   * than both neighbours. The first and last points are never counted, having
   * only one neighbour each.
   * @param {Array<number>} values - The series values in source order
   * @returns {Object} `{ peaks, troughs }`
   */
  function countPeaksAndTroughs(values) {
    let peaks = 0;
    let troughs = 0;
    for (let i = 1; i < values.length - 1; i += 1) {
      if (values[i] > values[i - 1] && values[i] > values[i + 1]) peaks += 1;
      if (values[i] < values[i - 1] && values[i] < values[i + 1]) troughs += 1;
    }
    return { peaks: peaks, troughs: troughs };
  }

  /**
   * Rule XC6's unimodal predicate, stated exactly: strictly one INTERIOR
   * maximum, rising before it and falling after it. A plateau anywhere breaks
   * it, and so does a peak at either end.
   * @param {Array<number>} values - The series values in source order
   * @returns {boolean} True when the series is unimodal
   */
  function isUnimodal(values) {
    if (values.length < 3) return false;

    let peakIndex = 0;
    for (let i = 1; i < values.length; i += 1) {
      if (values[i] > values[peakIndex]) peakIndex = i;
    }
    if (peakIndex === 0 || peakIndex === values.length - 1) return false;

    for (let i = 0; i < peakIndex; i += 1) {
      if (values[i] >= values[i + 1]) return false;
    }
    for (let i = peakIndex; i < values.length - 1; i += 1) {
      if (values[i] <= values[i + 1]) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------
  // Reading the chart
  // ---------------------------------------------------------------------

  /**
   * The chart's own type word, from the kinds of series present (rule XC1).
   * @param {Array<Object>} series - The adapter's series
   * @returns {string} "bar", "line" or "combined"
   */
  function chartTypeWord(series) {
    const hasBar = series.some((one) => one.kind === SERIES_KINDS.BAR);
    const hasLine = series.some((one) => one.kind === SERIES_KINDS.LINE);
    if (hasBar && hasLine) return "combined";
    return hasLine ? SERIES_KINDS.LINE : SERIES_KINDS.BAR;
  }

  /**
   * How a series is referred to in running prose, lower case, ready to be
   * capitalised at a sentence start.
   *
   * An author's series name is spoken verbatim and quoted (rules XC4, XC8).
   * Unnamed series take the generator's own noun, and are disambiguated by
   * ordinal ONLY where more than one series of that kind exists — otherwise
   * two unnamed line series would both be "the line series" and a reader could
   * not tell which sentence was about which.
   *
   * The BEHAVIOUR here is unchanged by the identity ruling of 24 August 2026;
   * what changed is that the position and the sibling count now come from
   * `seriesIdentity`, so the table headers cannot disagree with this sentence
   * about which series is the second one. The kind is left to the composition
   * clause, which introduces every series before any insight names one.
   *
   * @param {Object} series - One adapter series
   * @param {Array<Object>} allSeries - Every series on the chart
   * @param {boolean} asHtml - True when the result enters an HTML sink
   * @returns {string} e.g. `the line series`, `the "Forecast" series`
   */
  function seriesLabel(series, allSeries, asHtml) {
    const identity = seriesIdentity(series, allSeries);

    if (identity.name) {
      const name = asHtml ? escapeText(identity.name) : identity.name;
      return `the "${name}" series`;
    }
    if (!identity.isAmongSeveral) {
      return `the ${identity.kind} series`;
    }
    return `the ${ordinalWord(identity.position)} ${identity.kind} series`;
  }

  /**
   * A series' IDENTITY — the single shared answer to "which series is this?",
   * read by the composition clause, the insight labels and the table column
   * headers alike (identity ruling, 24 August 2026).
   *
   * IT IS ONE FUNCTION BY DESIGN, and the design is a repair. Before it,
   * `seriesLabel` disambiguated two same-kind series by ordinal and
   * `buildTable`'s header path did not consult a position at all, so one
   * description called a series "the second bar series" in prose and headed its
   * column "Bar series" — the same header its sibling got. Two computations of
   * one fact disagreed inside one description; probe sweep XP4 measured it.
   *
   * THE THREE RENDERINGS TAKE THEIR ORDINAL DECISION FROM TWO DIFFERENT
   * PREDICATES OVER THIS ONE OBJECT, which is ruled rather than accidental:
   *
   *   composition clause  needsIntroductoryOrdinal  (several AND not the first)
   *   insight label       isAmongSeveral            (several, first included)
   *   column header       isAmongSeveral            (several, first included)
   *
   * The composition clause omits position 1's ordinal because position 1 IS the
   * visible first that "a second bar series" counts from — and the count
   * includes NAMED series, so a chart whose first bar is named still reads
   * "a bar series named X, a second bar series" rather than opening at two with
   * no first anywhere (probe sweep XP5).
   *
   * @param {Object} series - One adapter series
   * @param {Array<Object>} allSeries - Every series on the chart, source order
   * @returns {Object} `{ kind, name, position, kindCount, isAmongSeveral,
   *   needsIntroductoryOrdinal }`
   */
  function seriesIdentity(series, allSeries) {
    const sameKind = allSeries.filter((one) => one.kind === series.kind);
    const index = sameKind.indexOf(series);
    return {
      kind: series.kind,
      name: series.name || null,
      position: index + 1,
      kindCount: sameKind.length,
      isAmongSeveral: sameKind.length > 1,
      needsIntroductoryOrdinal: sameKind.length > 1 && index > 0,
    };
  }

  // The one ordinal in RANKING_WORDS whose spoken form opens on a vowel sound.
  const VOWEL_SOUND_ORDINAL_WORDS = Object.freeze(["eighth"]);

  /**
   * The indefinite article an ordinal takes, so the composition clause cannot
   * emit "a eighth bar series" — wrong English, and a contract clause C9
   * (article-before-vowel) failure.
   *
   * The digit forms need the same care and the test is on the WHOLE digit
   * prefix rather than its first character: "an 8th", "an 80th" and "an 800th"
   * all open "eight…", and "an 11th" and "an 18th" open "eleventh" and
   * "eighteenth" — but "a 110th" opens "one hundred…", so a leading-digit test
   * would get that one wrong.
   *
   * UNMEASURED BEYOND "third". No chart with eight or more series of one kind
   * has been driven, here or in the probe sweep, so this is derived from
   * English rather than from a capture.
   *
   * @param {string} ordinal - An ordinalWord result
   * @returns {string} "a" or "an"
   */
  function ordinalArticle(ordinal) {
    if (VOWEL_SOUND_ORDINAL_WORDS.indexOf(ordinal) !== -1) return "an";
    const digits = /^(\d+)(?:st|nd|rd|th)$/.exec(ordinal);
    if (!digits) return "a";
    const number = digits[1];
    if (number === "11" || number === "18") return "an";
    return number.charAt(0) === "8" ? "an" : "a";
  }

  /**
   * How a series is INTRODUCED, in the detailed tier's series sentence.
   *
   * RULE XC15: a name never replaces the kind, it joins it. Before this the
   * clause read `a series named "X"`, so on a fully-named combined chart
   * nothing in the whole detailed description said which series was drawn as
   * bars — the composition clause said "a series named", every insight said
   * `the "X" series`, and the table columns were headed with the names. A
   * sighted reader had the shapes; this reader had neither the shapes nor the
   * words for them (probe sweep XP1, work register item 49).
   *
   * @param {Object} series - One adapter series
   * @param {Array<Object>} allSeries - Every series on the chart
   * @returns {string} e.g. `a bar series named "Actual intake"`,
   *   `a second bar series`
   */
  function seriesCompositionPhrase(series, allSeries) {
    const identity = seriesIdentity(series, allSeries);

    let phrase;
    if (identity.needsIntroductoryOrdinal) {
      const ordinal = ordinalWord(identity.position);
      phrase = `${ordinalArticle(ordinal)} ${ordinal} ${identity.kind} series`;
    } else {
      phrase = `a ${identity.kind} series`;
    }

    if (identity.name) phrase += ` named "${escapeText(identity.name)}"`;
    return phrase;
  }

  /**
   * A series' TABLE COLUMN HEADER (rule XC11, identity ruling).
   *
   * A named series uses its name verbatim; an unnamed one among several of its
   * kind is NUMBERED, so two columns of one kind can never carry the same
   * header. The number is a digit here and a word in the prose deliberately:
   * a header cell is scanned, not read as a sentence.
   *
   * @param {Object} series - One adapter series
   * @param {Array<Object>} allSeries - Every series on the chart
   * @returns {string} Escaped, ready for a `<th scope="col">`
   */
  function seriesColumnHeader(series, allSeries) {
    const identity = seriesIdentity(series, allSeries);
    if (identity.name) return escapeText(identity.name);

    const base = `${capitalise(identity.kind)} series`;
    return identity.isAmongSeveral ? `${base} ${identity.position}` : base;
  }

  /**
   * How one x position is referred to: the author's own label, quoted, on a
   * band axis; a generator-owned ordinal on a numeric-range axis (rule XC6,
   * which forbids inventing an x position).
   *
   * @param {Object} chart - The adapter's chart
   * @param {number} index - 0-based point index
   * @param {boolean} asHtml - True when the result enters an HTML sink
   * @returns {string} e.g. `"Friday"`, `the sixth point`
   */
  function pointReference(chart, index, asHtml) {
    return referenceText(
      pointReferencePart(chart, index, asHtml),
      REFERENCE_STYLE.STANDALONE
    );
  }

  /**
   * The same reference, shaped for a context that is ALREADY inside brackets —
   * `Highest value: 170 ("Autumn", the third position).`
   *
   * Rule XC21 needs two shapes, not one, because the module addresses a
   * position in two grammatical contexts. Nesting a bracket inside a bracket
   * is unreadable aloud, so the parenthetical context takes a comma and the
   * standalone context takes the brackets.
   *
   * @param {Object} chart - The adapter's chart
   * @param {number} index - 0-based point index
   * @param {boolean} asHtml - True when the result enters an HTML sink
   * @returns {string} e.g. `"Autumn", the third position`
   */
  function pointReferenceInParens(chart, index, asHtml) {
    return referenceText(
      pointReferencePart(chart, index, asHtml),
      REFERENCE_STYLE.PARENTHETICAL
    );
  }

  /**
   * Render one reference part in a given grammatical context.
   *
   * A part with NO disambiguator renders identically in both styles, which is
   * why every chart of unique labels is byte-unchanged and the 117 pre-existing
   * fixtures are the guard on that.
   *
   * @param {Object} part - A pointReferencePart result
   * @param {string} style - A REFERENCE_STYLE member
   * @returns {string} The reference
   */
  function referenceText(part, style) {
    if (part.kind !== "label") {
      return `the ${part.text} ${POSITION_NOUN[part.kind].singular.toLowerCase()}`;
    }
    if (!part.disambiguator) return part.text;
    return style === REFERENCE_STYLE.PARENTHETICAL
      ? `${part.text}, ${part.disambiguator}`
      : `${part.text} (${part.disambiguator})`;
  }

  /**
   * True when the label at this index appears more than once on the axis, so a
   * reader given the label alone could not tell which position is meant.
   *
   * Compared on the AUTHOR'S OWN text, before escaping, so two labels that
   * differ only in characters an HTML sink would encode are still two labels.
   *
   * @param {Object} chart - The adapter's chart
   * @param {number} index - 0-based point index
   * @returns {boolean} Whether this label is ambiguous
   */
  function isDuplicatedLabel(chart, index) {
    const categories = declaredCategories(chart);
    const label = categories[index];
    if (typeof label !== "string") return false;
    let seen = 0;
    for (const one of categories) {
      if (one === label) seen += 1;
      if (seen > 1) return true;
    }
    return false;
  }

  /**
   * How one x position is named, BEFORE it is wrapped into a sentence — the one
   * shared answer read by `pointReference` and by `pointReferences` alike.
   *
   * It exists so a tied extreme cannot be addressed by a second, independent
   * idea of what an x position is called. The XC18 list form has to join bare
   * ordinals ("the second and fourth points"), which the full reference cannot
   * supply without being taken apart again — and taking a formatted string
   * apart is how two computations of one fact start to disagree (rule XC16's
   * lesson, arriving at a different pair of renderers).
   *
   * @param {Object} chart - The adapter's chart
   * @param {number} index - 0-based point index
   * @param {boolean} asHtml - True when the result enters an HTML sink
   * @returns {Object} `{ kind: "label"|"ordinal", text }`
   */
  function pointReferencePart(chart, index, asHtml) {
    const label = declaredCategories(chart)[index];
    if (typeof label === "string") {
      return {
        kind: "label",
        text: `"${asHtml ? escapeText(label) : label}"`,
        // RULE XC21. A label the author used more than once does not identify a
        // position, so the position joins it as furniture. This is NOT a defect
        // in the label — XC4 requires the author's text verbatim — it is a gap
        // in the ruled vocabulary: XC6 gives the generator an ordinal where
        // there is no label, and until now there was no equivalent where the
        // label is ambiguous. A reader was told the maximum was at "Autumn" on
        // a chart carrying two of them, and could not use the answer (XP20).
        disambiguator: isDuplicatedLabel(chart, index)
          ? `the ${ordinalWord(index + 1)} ${POSITION_NOUN.position.singular.toLowerCase()}`
          : null,
      };
    }
    // RULE XC20. An index PAST the declared labels on a band axis is a
    // POSITION, not one of XC6's points. The two nouns are kept apart on
    // purpose: "point" is rule XC6's word for a location on a numeric-range
    // axis, where there are no labels by construction, and letting it also mean
    // "a value the author wrote past the end of their own label list" put two
    // idioms for two different things into one insight list — `Highest value in
    // the bar series: 110 (the fourth point).` sat two items below `The line
    // series peaks at 100 ("Mon").` with nothing to tell a reader they were the
    // same kind of address (probe sweep XP16).
    const kind = hasDeclaredCategories(chart) ? "position" : "ordinal";
    return { kind: kind, text: ordinalWord(index + 1) };
  }

  /**
   * How a SET of x positions is referred to (rule XC18) — every position
   * holding a tied extreme, in source order.
   *
   * A SET OF ONE IS BYTE-IDENTICAL TO `pointReference`, deliberately: the 105
   * fixtures in the corpus are the guard on that, and every one of them has
   * unique extremes.
   *
   * Labels join as they are quoted (`"Feb" and "May"`); ordinals hoist their
   * article and noun so the list is not "the second point and the fourth point"
   * (`the second and fourth points`). From TIED_POSITION_COLLAPSE_AT positions
   * the list collapses to a count, because a spoken list of four positions is
   * one nobody can hold. A band axis whose overflow indices carry no label can
   * yield a MIXED set; that falls back to joining whole references, and is
   * unreachable in this corpus — it belongs to the label/series-length mismatch
   * cluster (probe sweep XP15-XP17), which is not this session's ground.
   *
   * @param {Object} chart - The adapter's chart
   * @param {Array<number>} indices - 0-based point indices, source order
   * @param {boolean} asHtml - True when the result enters an HTML sink
   * @returns {string} e.g. `"Feb" and "May"`, `the second and fourth points`
   */
  function pointReferences(chart, indices, asHtml, style) {
    if (indices.length === 1) {
      return referenceText(
        pointReferencePart(chart, indices[0], asHtml),
        style
      );
    }
    if (indices.length >= TIED_POSITION_COLLAPSE_AT) {
      return `${countWord(indices.length)} points`;
    }

    const parts = indices.map((i) => pointReferencePart(chart, i, asHtml));
    if (parts.every((part) => part.kind === "label")) {
      // A TIED extreme spanning two instances of ONE duplicated label is the
      // case this most matters for: without XC21 it read `"Autumn" and
      // "Autumn"`. Each member takes the STANDALONE shape whatever the
      // surrounding context, because a list already carries commas and a second
      // comma per item would be unparseable aloud.
      return common().formatList(
        parts.map((part) => referenceText(part, REFERENCE_STYLE.STANDALONE))
      );
    }
    // A label-less set hoists its article and noun, and takes rule XC20's noun
    // where the chart declares labels and rule XC6's where it does not.
    const kind = parts[0].kind;
    if (parts.every((part) => part.kind === kind)) {
      return `the ${common().formatList(parts.map((part) => part.text))} ${POSITION_NOUN[kind].plural}`;
    }
    return common().formatList(
      indices.map((i) => pointReference(chart, i, asHtml))
    );
  }

  /**
   * The noun a COUNT takes, singular at one (probe sweep XP6, contract clause
   * C8). Every count-plus-noun clause in this module reads this, so the
   * agreement decision is taken once.
   *
   * The singular is lower-cased because the XC12 nouns are stored capitalised
   * for their table-header use. THIS DOES NOT TOUCH XC4 OR XC8: every noun
   * reaching here is the generator's own — an author x-axis title never
   * becomes one, it wins outright and sends the detector back to
   * Category/categories (rule XC12).
   *
   * @param {Object} noun - An axisNoun result, `{ singular, plural }`
   * @param {number} count - How many positions are being counted
   * @returns {string} The noun as it is spoken after the count
   */
  function countedNoun(noun, count) {
    return count === 1 ? noun.singular.toLowerCase() : noun.plural;
  }

  /**
   * The author's DECLARED category labels, or an empty array where the chart
   * declares none. Rule XC20's scope test in one place.
   *
   * MEASURED 24 August 2026: a source with no `x-axis` line at all is delivered
   * by the adapter as a RANGE axis with null bounds — never as a band axis with
   * an empty `categories` array. So on this build "band axis" and "declares
   * categories" coincide, and the length test below is defensive rather than a
   * branch anything currently reaches. It is kept because the coincidence is a
   * property of the adapter and not of this module.
   *
   * @param {Object} chart - The adapter's chart
   * @returns {Array<string>} The declared labels, verbatim
   */
  function declaredCategories(chart) {
    return chart.xAxis && chart.xAxis.kind === AXIS_KINDS.BAND
      ? chart.xAxis.categories || []
      : [];
  }

  /**
   * True when rule XC20 governs this chart: a band axis with declared labels.
   * @param {Object} chart - The adapter's chart
   * @returns {boolean} Whether the declared chart wins
   */
  function hasDeclaredCategories(chart) {
    return declaredCategories(chart).length > 0;
  }

  /**
   * How many x positions the chart HAS — rule XC20: **the declared count**.
   *
   * IT USED TO BE `Math.max(labels, longest series)`, AND THAT ONE `Math.max`
   * WAS FIVE FINDINGS. A chart declaring three days and carrying a five-value
   * series claimed "five shared days" — a count no series had and the author
   * never wrote — and every downstream computation inherited it: the count
   * clauses, the table's row span, the ordinals that leaked onto a band axis,
   * and the denominator of every statistic (probe sweep XP15 to XP19, all one
   * cause). The author's declaration is the chart; a series that disagrees with
   * it is a mismatch to be DECLARED, not a reason to redefine the chart.
   *
   * A range axis is unchanged: it declares no positions, so the values are all
   * there is to count.
   *
   * NOTE THE TABLE DOES NOT USE THIS. Data is never dropped, so the table spans
   * every position that has a label OR a value — see `tableRowCount`.
   *
   * @param {Object} chart - The adapter's chart
   * @returns {number} The point count
   */
  function pointCount(chart) {
    if (hasDeclaredCategories(chart)) return declaredCategories(chart).length;
    return chart.series.reduce(
      (longest, one) => Math.max(longest, one.values.length),
      0
    );
  }

  /**
   * How many rows the data table spans: every position carrying a label or a
   * value. Rule XC20 keeps the declared chart as the chart, but a value the
   * author wrote is never silently discarded — an overflow row is addressed as
   * a position and kept.
   * @param {Object} chart - The adapter's chart
   * @returns {number} The row count
   */
  function tableRowCount(chart) {
    const longestSeries = chart.series.reduce(
      (longest, one) => Math.max(longest, one.values.length),
      0
    );
    return Math.max(declaredCategories(chart).length, longestSeries);
  }

  /**
   * The series whose length disagrees with the declared count, in source order,
   * each with the direction of its disagreement. Empty on any chart rule XC20
   * does not govern, and empty on a chart that matches its declaration — which
   * is the invariant that keeps every existing fixture byte-identical.
   *
   * @param {Object} chart - The adapter's chart
   * @returns {Array<Object>} `{ series, values, declared, overflow }`
   */
  function mismatchedSeries(chart) {
    if (!hasDeclaredCategories(chart)) return [];
    const declared = declaredCategories(chart).length;
    return chart.series
      .filter((one) => one.values.length !== declared)
      .map((one) => ({
        series: one,
        values: one.values.length,
        declared: declared,
        overflow: one.values.length > declared,
      }));
  }

  /**
   * The noun a band axis's positions take in prose. An author x-axis title
   * always wins (rule XC12), and where it exists the detector is not consulted
   * at all — the title names the axis and the generator's own neutral noun
   * counts the positions.
   * @param {Object} chart - The adapter's chart
   * @returns {Object} `{ singular, plural, detected }`
   */
  function axisNoun(chart) {
    if (!chart.xAxis || chart.xAxis.kind !== AXIS_KINDS.BAND) {
      return {
        singular: RANGE_POINT_NOUN,
        plural: "points",
        detected: false,
      };
    }
    if (chart.xAxis.title) {
      return {
        singular: FALLBACK_NOUN.singular,
        plural: FALLBACK_NOUN.plural,
        detected: false,
      };
    }
    return detectLabelNoun(chart.xAxis.categories || []);
  }

  /**
   * True when the axis carries both declared bounds. Rule XC2: a description
   * speaks the source's DECLARATIONS, never the renderer's computed ticks,
   * which were measured to diverge from them.
   * @param {Object|null} axis - An adapter axis
   * @returns {boolean} Whether bounds may be spoken
   */
  function hasBounds(axis) {
    return (
      !!axis && typeof axis.min === "number" && typeof axis.max === "number"
    );
  }

  // ---------------------------------------------------------------------
  // The takeaway (rule XC5)
  // ---------------------------------------------------------------------

  /**
   * The chart's primary takeaway: one sentence, the short tier's second and
   * the detailed tier's first, bolded, insight.
   *
   * FIXED CHART.JS DEFECTS, all three ruled as rule XC5:
   *   - the bar chart's trend branch is NOT carried, because it pairs the
   *     words "increased by" with a MIN-TO-MAX range rather than a
   *     first-to-last change; trend-flavoured sentences fire on line series
   *     only, and never on a numeric-range x-axis;
   *   - the above-average sentence is reworded so it is not verbless;
   *   - on a numeric-range x-axis every label-bearing template is unavailable
   *     by construction (there are no labels), so the label-free range form
   *     carries the takeaway.
   *
   * @param {Object} chart - The adapter's chart
   * @param {boolean} asHtml - True when the result enters an HTML sink
   * @returns {string} One sentence, ending in a full stop
   */
  function buildTakeaway(chart, asHtml, tier) {
    const series = chart.series;
    const isRangeAxis = !chart.xAxis || chart.xAxis.kind === AXIS_KINDS.RANGE;

    // The only cross-series derived fact in the engine: on a multi-series
    // chart the takeaway compares series MEANS and says nothing else.
    if (series.length > 1) {
      // RULE XC20 — THE COMPARISON IS SUPPRESSED WHEN THE LENGTHS DIFFER, and
      // the mismatch becomes the takeaway itself. A mean over two values set
      // against a mean over five is not a like-for-like comparison, and the
      // sentence it produced signalled nothing: "The line series shows the
      // highest overall values." was the bolded first insight AND the short
      // tier's second sentence on a chart where that series had no value at all
      // for three of the five positions (probe sweep XP19).
      //
      // Note the test is lengths differing FROM EACH OTHER, not from the
      // declaration: series that agree with each other are comparable, and the
      // construction paragraph's mismatch sentence supplies the denominator.
      const lengths = series.map((one) => one.values.length);
      if (new Set(lengths).size > 1) {
        // RULE XC23(c). The SHORT tier takes the fixed sentence and drops the
        // enumeration, because the enumeration has no length bound: it grows
        // with the series count AND with the length of the author's series
        // names, and a three-series chart measured a 353-character short
        // against contract clause C1's 250-character cap — on the SVG
        // aria-label and the visible figcaption (FS3 § 7.4).
        //
        // SHORT-ONLY, and that is the LESSER change of the two available. The
        // detailed tier keeps the enumeration, which costs nothing a reader
        // notices — the construction paragraph's XC20 mismatch sentences carry
        // the same per-series counts either way, and restating a subordinate
        // fact in the takeaway is ruled working-as-designed (probe sweep XP22).
        // It also keeps the detailed fragment of every existing witness
        // byte-identical, so the supersession it forces on
        // `xychart-mismatch/overflow-values` reaches two keys and no needle.
        if (tier === TIERS.SHORT) {
          return "The chart's series have different numbers of values.";
        }
        const clauses = series.map(
          (one) =>
            `${seriesLabel(one, series, asHtml)} has ${countWord(one.values.length)}`
        );
        return `The chart's series have different numbers of values: ${common().formatList(clauses)}.`;
      }

      let highest = series[0];
      let highestMean = computeStatistics(series[0].values).mean;
      for (const one of series.slice(1)) {
        const mean = computeStatistics(one.values).mean;
        if (mean > highestMean) {
          highestMean = mean;
          highest = one;
        }
      }
      return `${capitalise(seriesLabel(highest, series, asHtml))} shows the highest overall values.`;
    }

    const only = series[0];
    const stats = computeStatistics(only.values);
    const rangeSentence = `Values range from ${formatAuthorValueForTier(tier, stats.min)} to ${formatAuthorValueForTier(tier, stats.max)} with an average of ${formatDerivedValue(stats.mean)}.`;

    // RULE XC17, AND IT COMES FIRST. A series with no variance cannot be
    // described by a range, a trend or a ratio: the range collapses ("Values
    // range from 42 to 42"), the trend at one value is the UNKNOWN SENTINEL
    // reaching the reader as the word "unknown" in the aria-label, and both
    // ratios are exactly 1. Every one of those is a defect the sweep measured
    // (XP8, XP9), and all three have the same cure — state the fact once.
    if (isDegenerateSeries(stats)) return degenerateTakeaway(chart, stats, asHtml, tier);

    if (isRangeAxis) return rangeSentence;
    if (!Number.isFinite(stats.mean) || stats.mean === 0) return rangeSentence;

    const maxRatio = stats.max / stats.mean;
    const minRatio = stats.min / stats.mean;

    if (only.kind === SERIES_KINDS.LINE) {
      const trend = analyseTrend(only.values);
      if (trend === TRENDS.UP || trend === TRENDS.DOWN) {
        return `${capitalise(seriesLabel(only, series, asHtml))} shows a ${trend} trend, ranging from ${formatAuthorValueForTier(tier, stats.min)} to ${formatAuthorValueForTier(tier, stats.max)}.`;
      }
      if (maxRatio > HIGH_POINT_RATIO) {
        return `${capitalise(seriesLabel(only, series, asHtml))} peaks significantly at ${formatAuthorValueForTier(tier, stats.max)} during ${pointReferences(chart, stats.maxIndices, asHtml, REFERENCE_STYLE.STANDALONE)}.`;
      }
      // `is ${trend}` CANNOT RECEIVE THE UNKNOWN SENTINEL. analyseTrend returns
      // UNKNOWN only below two values, and a series of nought or one value never
      // reaches this line — one value is degenerate and returned above, and an
      // empty one is caught by the zero-mean guard. The reachability of every
      // trend-speaking site is enumerated in docs/mermaid-xychart-fs2-2026-08-24.md.
      return `${capitalise(seriesLabel(only, series, asHtml))} is ${trend}, with values between ${formatAuthorValueForTier(tier, stats.min)} and ${formatAuthorValueForTier(tier, stats.max)}.`;
    }

    if (maxRatio > HIGH_POINT_RATIO) {
      return `The highest value, ${formatAuthorValueForTier(tier, stats.max)} at ${pointReferences(chart, stats.maxIndices, asHtml, REFERENCE_STYLE.STANDALONE)}, is ${Math.round((maxRatio - 1) * 100)}% above the average.`;
    }
    // RULE XC19 — the sign guard, and it is deliberately NOT mirrored above.
    // "N% below the average" is a claim about a PROPORTION of the average, so a
    // reader takes 100% as its ceiling; the figure passes it precisely when the
    // minimum and the mean have opposite signs, which is how a chart of budget
    // variances came to say "136% below the average" (probe sweep XP12). The
    // above-average form has no such ceiling — 300% above the average is four
    // times the average and means exactly what it says — so widening this guard
    // to both branches would suppress a sentence that is doing its job.
    if (minRatio < LOW_POINT_RATIO && stats.min >= 0) {
      return `The lowest value, ${formatAuthorValueForTier(tier, stats.min)} at ${pointReferences(chart, stats.minIndices, asHtml, REFERENCE_STYLE.STANDALONE)}, is ${Math.round((1 - minRatio) * 100)}% below the average.`;
    }
    return rangeSentence;
  }

  /**
   * Rule XC17's takeaway for a series with no variance.
   *
   * One value earns a sentence naming it; more than one earns a count. Neither
   * form pretends to a range, a trend or a ratio, because a degenerate series
   * has none of the three and every template that assumed otherwise misfired.
   *
   * THE POSITION CLAUSE IS BAND-AXIS ONLY. On a numeric-range axis the position
   * would be a generator-owned ordinal, and "the first point" on a chart with
   * exactly one point tells a reader nothing they do not already have from the
   * word "single" — rule XC6 forbids inventing an x position, and this is the
   * case where the ordinal it does allow carries no information.
   *
   * SCOPE: single-series charts. `buildTakeaway` returns the cross-series
   * comparison before reaching here on a chart with more than one series, so a
   * degenerate series ALONGSIDE others still speaks through the ordinary
   * insight sentences. Whether it should is un-ruled and unwitnessed; it is
   * recorded in the FS2 report rather than decided here.
   *
   * @param {Object} chart - The adapter's chart
   * @param {Object} stats - Statistics from computeStatistics
   * @param {boolean} asHtml - True when the result enters an HTML sink
   * @returns {string} One sentence, ending in a full stop
   */
  function degenerateTakeaway(chart, stats, asHtml, tier) {
    const value = formatAuthorValueForTier(tier, stats.max);
    if (stats.count === 1) {
      const isBandAxis = !!chart.xAxis && chart.xAxis.kind === AXIS_KINDS.BAND;
      // The comma before "at" is part of the ruled exact text, not a stylistic
      // choice: the position is an appositive on the value, and the first
      // capture of this sentence omitted it and was corrected against the rule.
      const where = isBandAxis
        ? `, at ${pointReference(chart, stats.maxIndex, asHtml)}`
        : "";
      return `The chart has a single value, ${value}${where}.`;
    }
    // XC17 ADDENDUM (a), 24 August 2026. English says "Both", not "All two".
    // Raised by FS2 § 7.3, which measured `All two values are 42.` on a
    // two-point flat series, declined to invent a carve-out beyond its own
    // dispatch, and referred it here. Three and up keep the "All N" form, which
    // the four FS2 degenerate fixtures guard.
    if (stats.count === 2) return `Both values are ${value}.`;
    return `All ${countWord(stats.count)} values are ${value}.`;
  }

  /**
   * XC17 ADDENDUM (b), 24 August 2026 — a degenerate series ALONGSIDE others.
   *
   * Its whole insight block becomes ONE sentence: the extremes go, and on a
   * line series the trend line goes with them. That is the one place this
   * differs from XC17's single-series form, which KEEPS the trend — on a
   * one-series chart the trend sentence is the description's only remaining
   * shape, where here the chart's other series still carry the narrative.
   *
   * FS2 § 7.4 registered this as un-ruled and left the extremes standing,
   * because dropping them would have left the series with no insight at all.
   * The sentence is what makes dropping them safe. The defect it replaces was
   * worse than that section predicted: on a TIED degenerate series rule XC18
   * fires as well, so `xychart-degenerate/multi-series` read `peaks at 300, at
   * "2023", "2024", and "2025"` immediately above `reaches its lowest point at
   * 300, at "2023", "2024", and "2025"` — the same three positions named as
   * both extremes, in full.
   *
   * Series identity is XC15/XC16's, so a named series reads
   * `Every value in the "Forecast" series is 300.`
   *
   * @param {Object} chart - The adapter's chart
   * @param {Object} series - The degenerate series
   * @param {Object} stats - Statistics from computeStatistics
   * @returns {string} One `<li>` fragment
   */
  function degenerateSeriesInsight(chart, series, stats) {
    const label = seriesLabel(series, chart.series, true);
    // VERBATIM, not tier-aware: this is a DETAILED-tier insight and never
    // reaches the short tier, so rule XC23(b)'s rounding must not touch it.
    const value = formatAuthorValue(stats.max);
    if (stats.count === 1) {
      return `<li>${capitalise(label)} has a single value, ${value}.</li>`;
    }
    return `<li>Every value in ${label} is ${value}.</li>`;
  }

  /**
   * Capitalise the first character, leaving the rest alone. Author text inside
   * the string is never re-cased (rule XC4, a deliberate divergence from
   * Chart.js's aggressive lowercasing).
   * @param {string} text - The sentence opening
   * @returns {string} The capitalised sentence opening
   */
  function capitalise(text) {
    return common().capitalize(text);
  }

  // ---------------------------------------------------------------------
  // The short tier (rule XC1)
  // ---------------------------------------------------------------------

  /**
   * Build the short tier's opening sentence.
   * @param {Object} chart - The adapter's chart
   * @param {boolean} asHtml - True when the result enters an HTML sink
   * @returns {string} One sentence, ending in a full stop
   */
  function buildShortOpening(chart, asHtml) {
    const typeWord = chartTypeWord(chart.series);
    const noun = axisNoun(chart);
    const count = pointCount(chart);

    let sentence = `A ${typeWord} chart`;
    if (chart.title) {
      sentence += ` titled "${asHtml ? escapeText(chart.title) : chart.title}"`;
    }
    if (chart.yAxis && chart.yAxis.title) {
      sentence += ` showing "${asHtml ? escapeText(chart.yAxis.title) : chart.yAxis.title}"`;
    }
    if (typeWord === "combined") {
      sentence += ` with ${buildComposition(chart.series)}`;
    }

    if (chart.xAxis && chart.xAxis.kind === AXIS_KINDS.BAND) {
      const shared = typeWord === "combined" ? "shared " : "";
      const preposition = typeWord === SERIES_KINDS.LINE ? "over" : "for";
      // A combined chart's series clause already reads as a list, so its
      // positions are joined with "over" whatever the preposition would be.
      const joiner = typeWord === "combined" ? "over" : preposition;
      sentence += ` ${joiner} ${countWord(count)} ${shared}${countedNoun(noun, count)}`;
    } else if (chart.xAxis && chart.xAxis.title) {
      sentence += ` across "${asHtml ? escapeText(chart.xAxis.title) : chart.xAxis.title}"`;
      if (hasBounds(chart.xAxis)) {
        sentence += ` from ${formatAuthorValue(chart.xAxis.min)} to ${formatAuthorValue(chart.xAxis.max)}`;
      }
    } else if (hasBounds(chart.xAxis)) {
      sentence += ` across an x-axis running from ${formatAuthorValue(chart.xAxis.min)} to ${formatAuthorValue(chart.xAxis.max)}`;
    }

    return `${sentence}.`;
  }

  /**
   * The composition clause for a combined chart: "one bar series and one line
   * series" (rule XC1). "Series" has no separate plural, so the count word
   * carries the number.
   *
   * THIS IS THE SHORT TIER'S CLAUSE AND IT DELIBERATELY CARRIES NO SERIES
   * NAMES. It counts by kind, where the detailed tier's series sentence
   * introduces each series individually through `seriesCompositionPhrase`.
   * Ruled no-change on 24 August 2026 (probe sweep XP2): the short tier is a
   * caption, and naming five series in one would stop it being one. Do not
   * "align" the two.
   *
   * @param {Array<Object>} series - The adapter's series
   * @returns {string} The clause, with no leading or trailing punctuation
   */
  function buildComposition(series) {
    const parts = [];
    for (const kind of [SERIES_KINDS.BAR, SERIES_KINDS.LINE]) {
      const many = series.filter((one) => one.kind === kind).length;
      if (many > 0) parts.push(`${countWord(many)} ${kind} series`);
    }
    return common().formatList(parts);
  }

  // ---------------------------------------------------------------------
  // The detailed tier (rules XC3, XC11)
  // ---------------------------------------------------------------------

  /**
   * The Chart Construction paragraphs.
   * @param {Object} chart - The adapter's chart
   * @returns {Array<string>} HTML fragments, one per line
   */
  function buildConstruction(chart) {
    const typeWord = chartTypeWord(chart.series);
    const noun = axisNoun(chart);
    const count = pointCount(chart);

    // RULE XC22. The `is drawn` fallback is RETIRED. A chart being *drawn* is
    // not news, and standing alone it was the weakest sentence the module could
    // produce, in the most prominent position in the detailed tier (probe sweep
    // XP23). Where there is no y-descriptor the opener has nothing to predicate
    // and merges with the series sentence instead, which turns two thin
    // sentences into one that says something.
    const hasYDescriptor = !!(chart.yAxis && chart.yAxis.title);

    let opening = `This ${typeWord} chart`;
    if (chart.title) opening += ` titled "${escapeText(chart.title)}"`;
    if (hasYDescriptor) {
      opening += ` shows "${escapeText(chart.yAxis.title)}"`;
    }

    // THE ONLY BRANCH THAT SPEAKS A POSITION COUNT is the band one. That is the
    // predicate rule XC22's of-N-values clause turns on, below.
    const openerSpeaksCount =
      !!chart.xAxis && chart.xAxis.kind === AXIS_KINDS.BAND;
    if (openerSpeaksCount) {
      const shared = typeWord === "combined" ? "shared " : "";
      const preposition = typeWord === SERIES_KINDS.LINE ? "over" : "for";
      opening += ` ${preposition} ${countWord(count)} ${shared}${countedNoun(noun, count)}`;
    } else if (chart.xAxis && chart.xAxis.title) {
      opening += ` across "${escapeText(chart.xAxis.title)}"`;
    }

    // RULE XC22's of-N-values clause, and the predicate is stated exactly
    // because a wider one would move a FROZEN GOLD TARGET. It attaches only on
    // the merged (y-descriptor-less) sentence, and only where the opener speaks
    // no position count of its own — otherwise "for five days … of five values"
    // says the same number twice.
    //
    // ON A MULTI-SERIES CHART IT ATTACHES PER SERIES, never to the chart. There
    // is no single N on such a chart, which is exactly probe sweep XP19's
    // lesson: a chart-level count would state a denominator that is false for
    // every series but one. Note this never collides with rule XC20's mismatch
    // sentences, which fire only on a DECLARED BAND AXIS — precisely the case
    // where this clause does not fire. The two are complementary by
    // construction, and neither ever speaks over the other.
    const wantsValueCounts = !hasYDescriptor && !openerSpeaksCount;
    const valuesOf = (series) =>
      ` of ${countWord(series.values.length)} ${countedNoun(VALUE_NOUN, series.values.length)}`;

    let seriesClause = `${countWord(chart.series.length)} data series`;
    if (chart.series.length > 1) {
      seriesClause += `: ${common().formatList(
        chart.series.map(
          (one) =>
            seriesCompositionPhrase(one, chart.series) +
            (wantsValueCounts ? valuesOf(one) : "")
        )
      )}`;
    } else if (wantsValueCounts) {
      seriesClause += valuesOf(chart.series[0]);
    }

    const sentences = hasYDescriptor
      ? [`${opening}.`, `The chart has ${seriesClause}.`]
      : [`${opening} has ${seriesClause}.`];

    // RULE XC20 — THE MISMATCH IS DECLARED. This is contract clause D6, which
    // is the one row in this cluster the quality contract already forbade
    // rather than merely left un-ruled: "content the generator could not parse
    // is declared, never silently omitted", because silence is
    // indistinguishable from absence. Before this, a chart declaring five days
    // and carrying three values said "for five days" and "an average of 31" in
    // one description, and a reader multiplying the two got a total two thirds
    // larger than the chart's own (probe sweep XP18, and 14b's arithmetic).
    //
    // ORDERING NOTE. Rule XC13 fixes the horizontal sentence "immediately after
    // the series sentence" and is witnessed on that position, so these follow
    // it rather than displacing it. No chart combines the two, so nothing in
    // the corpus decides it; this preserves the ruled, witnessed position.
    const mismatchSentences = mismatchedSeries(chart).map((m) => {
      // "against" for an overflow, "for" for a shortfall — the two directions
      // read differently and the design's own two exemplars differ in exactly
      // this word. See the FS3 report's contradictions section.
      const joiner = m.overflow ? "against" : "for";
      return (
        `${capitalise(seriesLabel(m.series, chart.series, true))} has ` +
        `${countWord(m.values)} ${countedNoun(VALUE_NOUN, m.values)} ${joiner} ` +
        `${countWord(m.declared)} declared ${countedNoun(noun, m.declared)}.`
      );
    });

    // Orientation is not decoration: `xychart-beta horizontal` renames every
    // axis group and removes the bottom-axis group entirely (grounding § 6.4),
    // so a description that ignored it would let a reader picture the wrong
    // axis carrying the categories. NOTE FOR THE DESIGN SEAT: no rule XC1-XC12
    // covers orientation and no gold exemplar is horizontal, so this sentence
    // fires on none of the six targets and is un-ruled generator prose.
    if (chart.orientation === ORIENTATIONS.HORIZONTAL) {
      sentences.push(
        "The chart is drawn horizontally, so the x-axis runs along the side of the chart and the y-axis runs across it."
      );
    }

    sentences.push(...mismatchSentences);

    const paragraphs = [`<p>${sentences.join(" ")}</p>`];

    const axisParagraph = buildAxisSentence(chart);
    if (axisParagraph) paragraphs.push(`<p>${axisParagraph}</p>`);

    return paragraphs;
  }

  /**
   * The axis sentence (rule XC2). Declared bounds are spoken; rendered ticks
   * never are.
   * @param {Object} chart - The adapter's chart
   * @returns {string|null} The sentence, or null when there is nothing to say
   */
  function buildAxisSentence(chart) {
    const noun = axisNoun(chart);
    const count = pointCount(chart);

    let xClause = null;
    if (chart.xAxis && chart.xAxis.kind === AXIS_KINDS.BAND) {
      xClause = chart.xAxis.title
        ? `The x-axis, "${escapeText(chart.xAxis.title)}", lists ${countWord(count)} ${countedNoun(noun, count)}`
        // NOT a count-plus-noun site, and deliberately left plural: it names
        // what KIND of thing the axis carries, and takes no count at all. The
        // XP6 census examined it and changed nothing here.
        : `${capitalise(noun.plural)} are plotted on the x-axis`;
    } else if (chart.xAxis && hasBounds(chart.xAxis)) {
      xClause = chart.xAxis.title
        ? `The x-axis, "${escapeText(chart.xAxis.title)}", runs from ${formatAuthorValue(chart.xAxis.min)} to ${formatAuthorValue(chart.xAxis.max)}`
        : `The x-axis runs from ${formatAuthorValue(chart.xAxis.min)} to ${formatAuthorValue(chart.xAxis.max)}`;
    } else if (chart.xAxis && chart.xAxis.title) {
      xClause = `The x-axis is titled "${escapeText(chart.xAxis.title)}"`;
    }

    let yClause = null;
    if (chart.yAxis) {
      if (chart.yAxis.title && hasBounds(chart.yAxis)) {
        yClause = `the y-axis, "${escapeText(chart.yAxis.title)}", runs from ${formatAuthorValue(chart.yAxis.min)} to ${formatAuthorValue(chart.yAxis.max)}`;
      } else if (hasBounds(chart.yAxis)) {
        yClause = `the y-axis runs from ${formatAuthorValue(chart.yAxis.min)} to ${formatAuthorValue(chart.yAxis.max)}`;
      } else if (chart.yAxis.title) {
        yClause = `the y-axis is titled "${escapeText(chart.yAxis.title)}"`;
      }
    }

    if (xClause && yClause) return `${xClause}, and ${yClause}.`;
    if (xClause) return `${xClause}.`;
    if (yClause) return `${capitalise(yClause)}.`;
    return null;
  }

  /**
   * The Key Insights list items, takeaway first and bolded (rule XC3).
   *
   * SINGLE-SERIES CHARTS EARN THE FULL STATISTICS TIER; MULTI-SERIES CHARTS DO
   * NOT. Gold exemplar 3 is the witness: a two-series chart whose bar series
   * has six values gets highest and lowest only — no average, no standard
   * deviation, no median, no distribution sentence — and whose line series
   * gets trend, peak and lowest with neither the cyclic nor the start-to-end
   * sentence, though its 65% rise would otherwise fire the latter. Statistics
   * about one series among several invite a comparison the chart does not
   * support.
   *
   * @param {Object} chart - The adapter's chart
   * @returns {Array<string>} `<li>` fragments
   */
  function buildInsights(chart) {
    const items = [`<li><strong>${buildTakeaway(chart, true, TIERS.DETAILED)}</strong></li>`];
    const isRangeAxis = !chart.xAxis || chart.xAxis.kind === AXIS_KINDS.RANGE;

    if (chart.series.length === 1) {
      const only = chart.series[0];
      if (only.kind === SERIES_KINDS.LINE) {
        items.push(...buildLineInsights(chart, only, isRangeAxis, true));
      } else {
        items.push(...buildBarInsights(chart, only, true));
      }
      return items;
    }

    // ORDER ON A MULTI-SERIES CHART: every line series first, then every bar
    // series. Read off gold exemplar 3, the arc's only multi-series target,
    // whose line insights precede its bar insights although the bar series
    // comes first in the source. THAT SINGLE WITNESS CANNOT DISTINGUISH THIS
    // RULE FROM "highest mean first" — the line series' mean is 275.0 against
    // the bar series' 274.8333, so both orderings produce the target. Recorded
    // as an inference for the design seat rather than presented as settled.
    for (const one of chart.series) {
      if (one.kind !== SERIES_KINDS.LINE) continue;
      items.push(...buildLineInsights(chart, one, isRangeAxis, false));
    }
    for (const one of chart.series) {
      if (one.kind !== SERIES_KINDS.BAR) continue;
      items.push(...buildBarInsights(chart, one, false));
    }
    return items;
  }

  /**
   * A bar series' insights.
   * @param {Object} chart - The adapter's chart
   * @param {Object} series - The bar series
   * @param {boolean} isOnlySeries - True when this is the chart's only series
   * @returns {Array<string>} `<li>` fragments
   */
  function buildBarInsights(chart, series, isOnlySeries) {
    const stats = computeStatistics(series.values);
    const items = [];

    // XC17 ADDENDUM (b). A degenerate series among others is one sentence.
    if (!isOnlySeries && isDegenerateSeries(stats)) {
      return [degenerateSeriesInsight(chart, series, stats)];
    }

    if (isOnlySeries) {
      // RULE XC17. On a degenerate series the extremes pair is a contradiction
      // read aloud — "Highest value: 12 ("Mon"). Lowest value: 12 ("Mon")." —
      // and the takeaway has already stated the fact once. The STATISTICS TIER
      // BELOW IS UNTOUCHED: "Standard deviation: 0." is the honest form of the
      // same fact and is the strongest thing the list can say about it.
      if (!isDegenerateSeries(stats)) {
        items.push(
          `<li>Highest value: ${formatAuthorValue(stats.max)} (${pointReferences(chart, stats.maxIndices, true, REFERENCE_STYLE.PARENTHETICAL)}).</li>`
        );
        items.push(
          `<li>Lowest value: ${formatAuthorValue(stats.min)} (${pointReferences(chart, stats.minIndices, true, REFERENCE_STYLE.PARENTHETICAL)}).</li>`
        );
      }
      items.push(`<li>Average value: ${formatDerivedValue(stats.mean)}.</li>`);

      if (stats.count >= STATISTICS_MIN_POINTS) {
        items.push(
          `<li>Standard deviation: ${formatDerivedValue(stats.standardDeviation)}.</li>`
        );
        items.push(
          `<li>Median value: ${formatDerivedValue(stats.median)}.</li>`
        );
        items.push(`<li>${buildDistributionSentence(stats)}</li>`);
      }
      return items;
    }

    const label = seriesLabel(series, chart.series, true);
    items.push(
      `<li>Highest value in ${label}: ${formatAuthorValue(stats.max)} (${pointReferences(chart, stats.maxIndices, true, REFERENCE_STYLE.PARENTHETICAL)}).</li>`
    );
    items.push(
      `<li>Lowest value in ${label}: ${formatAuthorValue(stats.min)} (${pointReferences(chart, stats.minIndices, true, REFERENCE_STYLE.PARENTHETICAL)}).</li>`
    );
    return items;
  }

  /**
   * The distribution sentence, from Chart.js's skew test (conventions § 5d).
   *
   * Chart.js's own five-way branch puts two trend-flavoured sentences ahead of
   * the three skew ones; rule XC5 fires trend-flavoured sentences on LINE
   * series only, so the bar chart reaches the skew test directly. Gold
   * exemplar 6 is the witness: its bar values are consistently increasing and
   * its target still speaks the symmetric distribution.
   *
   * @param {Object} stats - Statistics from computeStatistics
   * @returns {string} One sentence
   */
  function buildDistributionSentence(stats) {
    const tolerance = stats.standardDeviation * SKEW_TOLERANCE;
    if (stats.mean > stats.median + tolerance) {
      return "Distribution is positively skewed (right-tailed).";
    }
    if (stats.mean < stats.median - tolerance) {
      return "Distribution is negatively skewed (left-tailed).";
    }
    return "Distribution is approximately symmetric.";
  }

  /**
   * A line series' insights.
   *
   * RULE XC6, THE TREND GATE: on a numeric-range x-axis no trend, cyclic or
   * start-to-end sentence fires at all, because the x-axis is a continuous
   * quantity rather than an ordered sequence of occasions and "over time"
   * language would be a claim the chart does not make. A unimodal series earns
   * one sentence of its own instead.
   *
   * @param {Object} chart - The adapter's chart
   * @param {Object} series - The line series
   * @param {boolean} isRangeAxis - True when the x-axis is a numeric range
   * @param {boolean} isOnlySeries - True when this is the chart's only series
   * @returns {Array<string>} `<li>` fragments
   */
  function buildLineInsights(chart, series, isRangeAxis, isOnlySeries) {
    const stats = computeStatistics(series.values);
    const label = seriesLabel(series, chart.series, true);
    const items = [];

    // XC17 ADDENDUM (b). A degenerate series among others is one sentence, and
    // on a line series that sentence replaces the TREND line as well as the
    // extremes — the one place the multi-series form differs from XC17's
    // single-series form, which keeps the trend.
    if (!isOnlySeries && isDegenerateSeries(stats)) {
      return [degenerateSeriesInsight(chart, series, stats)];
    }

    if (!isRangeAxis) {
      const trend = analyseTrend(series.values);
      const clause = TREND_CLAUSE[trend];
      if (clause) items.push(`<li>${capitalise(label)} ${clause}.</li>`);
    }

    // RULE XC17, the line side of the extremes drop. The trend insight above
    // SURVIVES — "shows a stable trend" is true of a flat series and is the one
    // thing worth saying about it — and only the pair asserting a unique high
    // and a unique low goes.
    if (!(isOnlySeries && isDegenerateSeries(stats))) {
      // RULE XC18. A tie takes a different SHAPE, not just a longer reference:
      // a parenthetical carrying "and" after a bare number reads as though it
      // qualified the number, so the tied form promotes the positions into the
      // sentence.
      const peakTied = stats.maxIndices.length > 1;
      const lowTied = stats.minIndices.length > 1;
      // THE STYLE FOLLOWS THE SHAPE, and the two are chosen together: the tied
      // form promotes the positions into the sentence (standalone), the untied
      // form keeps them in brackets (parenthetical). Computing one reference
      // for both branches would put a comma form inside brackets on a
      // duplicated label — rule XC21's exact failure.
      const peakAt = pointReferences(
        chart,
        stats.maxIndices,
        true,
        peakTied ? REFERENCE_STYLE.STANDALONE : REFERENCE_STYLE.PARENTHETICAL
      );
      const lowAt = pointReferences(
        chart,
        stats.minIndices,
        true,
        lowTied ? REFERENCE_STYLE.STANDALONE : REFERENCE_STYLE.PARENTHETICAL
      );
      items.push(
        peakTied
          ? `<li>${capitalise(label)} peaks at ${formatAuthorValue(stats.max)}, at ${peakAt}.</li>`
          : `<li>${capitalise(label)} peaks at ${formatAuthorValue(stats.max)} (${peakAt}).</li>`
      );
      items.push(
        lowTied
          ? `<li>${capitalise(label)} reaches its lowest point at ${formatAuthorValue(stats.min)}, at ${lowAt}.</li>`
          : `<li>${capitalise(label)} reaches its lowest point at ${formatAuthorValue(stats.min)} (${lowAt}).</li>`
      );
    }

    if (isRangeAxis) {
      if (isUnimodal(series.values)) {
        items.push(
          "<li>Values rise to a single peak and fall away after it.</li>"
        );
      }
      return items;
    }

    if (!isOnlySeries) return items;
    if (stats.count <= LINE_ADVANCED_MIN_POINTS) return items;

    const shape = countPeaksAndTroughs(series.values);
    if (shape.peaks > 1 && shape.troughs > 1) {
      items.push(
        `<li>The data shows a cyclic pattern with ${countWord(shape.peaks)} peaks and ${countWord(shape.troughs)} troughs.</li>`
      );
    }

    const first = series.values[0];
    const last = series.values[series.values.length - 1];
    if (first !== 0) {
      const percentChange = ((last - first) / Math.abs(first)) * 100;
      if (Math.abs(percentChange) > OVERALL_CHANGE_MIN_PERCENT) {
        items.push(
          `<li>Overall ${percentChange > 0 ? "increase" : "decrease"} of ${Math.abs(percentChange).toFixed(1)}% from start to end.</li>`
        );
      }
    }

    return items;
  }

  /**
   * The data table (rule XC11).
   *
   * Column headers use the author's axis titles where declared, else the XC12
   * noun, else Category/Value; a numeric-range x-axis gives "Point". Every row
   * label is a `<th scope="row">`, which the Chart.js table does not have — an
   * improvement, not an inheritance.
   *
   * @param {Object} chart - The adapter's chart
   * @returns {Array<string>} HTML fragments, one per line
   */
  function buildTable(chart) {
    const noun = axisNoun(chart);
    const isBandAxis = !!chart.xAxis && chart.xAxis.kind === AXIS_KINDS.BAND;
    const categories = isBandAxis ? chart.xAxis.categories || [] : [];
    // RULE XC20: the DECLARED count is the chart's, but a value the author
    // wrote is never dropped — so the table spans every position carrying a
    // label or a value, which is `tableRowCount` and not `pointCount`.
    const rows = tableRowCount(chart);

    // A NUMERIC-RANGE X-AXIS ALWAYS GIVES "Point", even where the author
    // titled it (rule XC11's parenthetical, and gold exemplar 4 is the
    // witness: its axis is titled "Mark awarded" and its column header is
    // "Point"). The column holds generator-owned ordinals, not the author's
    // quantity, so the author's title would mislabel it — that title is spoken
    // in the axis sentence and the short tier instead.
    const xHeader = isBandAxis
      ? chart.xAxis.title
        ? escapeText(chart.xAxis.title)
        : noun.singular
      : RANGE_POINT_NOUN;

    const valueHeaders =
      chart.series.length === 1
        ? [
            chart.series[0].name
              ? escapeText(chart.series[0].name)
              : chart.yAxis && chart.yAxis.title
                ? escapeText(chart.yAxis.title)
                : FALLBACK_VALUE_HEADER,
          ]
        : chart.series.map((one) => seriesColumnHeader(one, chart.series));

    const parts = ["<table>"];
    parts.push(
      chart.title
        ? `<caption>Data table for: ${escapeText(chart.title)}</caption>`
        : "<caption>Data table</caption>"
    );
    parts.push(
      `<thead><tr><th scope="col">${xHeader}</th>${valueHeaders
        .map((header) => `<th scope="col">${header}</th>`)
        .join("")}</tr></thead>`
    );
    parts.push("<tbody>");

    // RULE XC20's row header for an overflow position: `Position 4`, never the
    // bare digit it used to be. A reader moving down the row-header column
    // heard three weekdays and then two numbers, with nothing saying they were
    // the same kind of thing (probe sweep XP17). The digit form survives only
    // where the chart declares no labels at all, which is a numeric-range axis
    // and rule XC6's ground.
    const overflowHeader = hasDeclaredCategories(chart)
      ? (i) => `${POSITION_NOUN.position.singular} ${i + 1}`
      : (i) => String(i + 1);

    for (let i = 0; i < rows; i += 1) {
      // RULE XC21's table half, and it is a STRUCTURAL accessibility fault
      // rather than a prose one. A `scope="row"` header is the mechanism by
      // which a screen reader names a cell's row on entry, so two rows headed
      // `Autumn` leave a reader hearing "Autumn, 150" and later "Autumn, 170"
      // with nothing to tell the rows apart and no way to cross-reference the
      // prose above (probe sweep XP21). EVERY instance of a duplicated label is
      // numbered — not just the second — because numbering only the repeats
      // would leave the first looking like the only one.
      const rowLabel = isBandAxis
        ? typeof categories[i] === "string"
          ? isDuplicatedLabel(chart, i)
            ? `${escapeText(categories[i])} (${POSITION_NOUN.position.singular.toLowerCase()} ${i + 1})`
            : escapeText(categories[i])
          : overflowHeader(i)
        : String(i + 1);
      const cells = chart.series
        .map((one) => {
          const value = one.values[i];
          // RULE XC20 / contract clause D6: a position a series has no value
          // for says so. An empty cell cannot be told from a recorded zero.
          return `<td>${value === undefined ? NO_VALUE_TEXT : formatAuthorValue(value)}</td>`;
        })
        .join("");
      parts.push(`<tr><th scope="row">${rowLabel}</th>${cells}</tr>`);
    }

    parts.push("</tbody>");
    parts.push("</table>");
    return parts;
  }

  // ---------------------------------------------------------------------
  // The registered tiers
  // ---------------------------------------------------------------------

  /**
   * Fetch and verify the chart, or throw.
   *
   * A parse rejection is deliberately NOT caught — the core's catch turns it
   * into the honest generation-failed fallback. That covers the adapter's own
   * reader errors, including the pre-scan that refuses an `accDescr { … }`
   * block before it can hang Mermaid's parser. A failed adapter self-check
   * throws for the same reason: never narrate an unverified chart.
   *
   * `isXychartHealthy()` reads `null` until the lazy self-check settles, which
   * is why the guard tests for `false` rather than falsiness — a `!healthy`
   * test would refuse every first call on a page.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} The adapter's normalised chart
   */
  async function readChart(code) {
    const chart = await window.MermaidParseAdapter.parseXychart(code);
    if (window.MermaidParseAdapter.isXychartHealthy() === false) {
      throw new Error(
        "Parse adapter failed its XY chart self-check; refusing to narrate an unverified chart"
      );
    }
    if (!chart.series || chart.series.length === 0) {
      throw new Error("XY chart carries no data series; refusing to narrate it");
    }
    return chart;
  }

  /**
   * Generate a short description for an XY chart.
   *
   * The PLAIN form is the tier of record and is never escaped (knowledge base
   * § 14.2 rule 5): it reaches a `textContent` sink and the SVG's `aria-label`,
   * where an entity would be announced literally. The HTML form is the same
   * sentence escaped exactly once, with no spans and no classes of its own.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to `{ html, text }`
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("generateShortDescription", "Generating short description");

    const chart = await readChart(code);
    const text = `${buildShortOpening(chart, false)} ${buildTakeaway(chart, false, TIERS.SHORT)}`;
    logDebug("Final Short Description", text);

    return {
      html: escapeText(text),
      text: text,
    };
  }

  /**
   * Wrapper for the short description generator to maintain backwards compatibility
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the plain text description
   */
  async function shortDescriptionWrapper(svgElement, code) {
    const descriptions = await generateShortDescription(svgElement, code);

    // Return text version for backwards compatibility
    return descriptions.text;
  }

  /**
   * Generate a detailed description for an XY chart.
   *
   * Three headed sections in a fixed order (rule XC3): Chart Construction, Key
   * Insights with the takeaway first and bolded, and the Data Table. Chart.js's
   * dead Statistical Summary section and its duplicate label list are not
   * carried.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("generateDetailedDescription", "Generating XY chart description");

    const chart = await readChart(code);

    const parts = [];
    parts.push("<h4>Chart Construction</h4>");
    parts.push(...buildConstruction(chart));
    parts.push("<h4>Key Insights</h4>");
    parts.push("<ul>");
    parts.push(...buildInsights(chart));
    parts.push("</ul>");
    parts.push("<h4>Data Table</h4>");
    parts.push(...buildTable(chart));

    // Newline-joined so text-content extraction stays readable: without them,
    // list and row boundaries concatenate with no space.
    return parts.join("\n");
  }

  // Register with the core module. `generateShort` returns plain text because
  // the core assigns its result straight to descriptions.short, which reaches
  // the figcaption and the SVG aria-label.
  //
  // generateShortHTML is the ASYNC shape, and it has to be: this module awaits
  // the parse adapter, so `generateShortDescription(...).html` on the returned
  // promise would be `undefined` and the tier would register, be called, and
  // yield nothing silently (knowledge base § 3, register item 13). Flowchart is
  // the precedent this follows.
  window.MermaidAccessibility.registerDescriptionGenerator("xychart", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
  });

  // Public API to allow runtime configuration of logging levels
  const publicAPI = {
    // Allow external configuration of logging level
    setLogLevel: function (level) {
      if (typeof level === "number" && level >= 0 && level <= 3) {
        currentLogLevel = level;
        logInfo("setLogLevel", `Logging level changed to ${level}`);
      } else {
        logWarn("setLogLevel", `Invalid log level: ${level}`);
      }
    },

    getLogLevel: function () {
      return currentLogLevel;
    },

    // Expose log level constants for external use
    LOG_LEVELS: LOG_LEVELS,
  };

  logInfo(
    "XY Chart Module",
    "XY chart module loaded and registered on the parse adapter's XY chart surface"
  );

  return publicAPI;
})();

// Export statements (outside the IIFE as required)
if (typeof module !== "undefined" && module.exports) {
  module.exports = XychartModule;
} else {
  window.XychartModule = XychartModule;
}
