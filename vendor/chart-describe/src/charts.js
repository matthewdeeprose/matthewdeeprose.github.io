/**
 * Chart description builders
 * The sentence-building half of the XY chart describer, lifted out of
 * md-scripts/mermaid/mermaid-accessibility-xychart.js so that the Mermaid
 * describer and the Chart.js describer can speak with one voice.
 *
 * This is a MOVE, not a rewrite. Every builder below is the xychart module's
 * own, byte for byte, and every Mermaid description is unchanged: the harness
 * (.claude/mermaid-harness/run.mjs and gold-compare.mjs) and the xychart byte
 * snapshot in .claude/measurements/cd-2a-xychart-lift/ are the bar. Do not
 * change a sentence here without that bar and the Mermaid description owner.
 *
 * Reads window.ChartDescribeText (vendor/chart-describe/src/text.js) at CALL
 * TIME, never at load, so load order cannot leave a stale capture. Load text.js
 * first, then this file, then any describer that calls it.
 *
 * The chart it describes is the Mermaid parse adapter's normalised XY chart
 * shape: { title, xAxis, yAxis, series: [{ kind, name, values }] }.
 */
(function (root) {
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

  // Current logging level - can be modified at runtime
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Chart Describe Charts] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Chart Describe Charts] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Chart Describe Charts] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Chart Describe Charts] DEBUG: ${message}`, ...args);
    }
  }

  // ---------------------------------------------------------------------
  // The shared text helpers, resolved AT CALL TIME and never cached
  // ---------------------------------------------------------------------
  //
  // A module-scope capture of window.ChartDescribeText would read undefined
  // permanently if this file ever ran before text.js. Resolving at call time
  // costs one property read and cannot go stale. If text.js is missing, the
  // first call throws a TypeError rather than returning wrong text.

  /**
   * The shared text helpers (formatList, capitalize, narrationNumber,
   * escapeHtml), resolved at call time.
   * @returns {Object} ChartDescribeText
   */
  function textCore() {
    return root.ChartDescribeText;
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
    return textCore().escapeHtml(text);
  }

  /**
   * Narration count: words for zero to nine, digits from 10 (rule XC10).
   * @param {number} value - The count
   * @returns {string} The count as it is spoken
   */
  function countWord(value) {
    return textCore().narrationNumber(value);
  }

  /**
   * Capitalise the first character, leaving the rest alone. Author text inside
   * the string is never re-cased (rule XC4, a deliberate divergence from
   * Chart.js's aggressive lowercasing).
   * @param {string} text - The sentence opening
   * @returns {string} The capitalised sentence opening
   */
  function capitalise(text) {
    return textCore().capitalize(text);
  }

  // ---------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------

  const SERIES_KINDS = Object.freeze({ BAR: "bar", LINE: "line" });
  const AXIS_KINDS = Object.freeze({ BAND: "band", RANGE: "range" });
  // Caller options for the short opening and Construction (rule XC25). ON
  // unless a caller whose picture does not draw a series name says otherwise.
  const DEFAULT_DESCRIBE_OPTIONS = Object.freeze({ drawsSeriesName: true });
  // Closes XC24's span on the merged (y-descriptor-less) sentence, ruling D7c.
  const MERGED_SPAN_CLOSE = ",";
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
   * @returns {Array<Object>} Runs for a column header cell: the author's name
   *   as an author run (raw, escaped once by the renderer), else the
   *   generator's own words as a text run
   */
  function seriesColumnHeader(series, allSeries) {
    const { text, author } = modelCore();
    const identity = seriesIdentity(series, allSeries);
    if (identity.name) return [author(identity.name)];

    const base = `${capitalise(identity.kind)} series`;
    return [text(identity.isAmongSeveral ? `${base} ${identity.position}` : base)];
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
      return textCore().formatList(
        parts.map((part) => referenceText(part, REFERENCE_STYLE.STANDALONE))
      );
    }
    // A label-less set hoists its article and noun, and takes rule XC20's noun
    // where the chart declares labels and rule XC6's where it does not.
    const kind = parts[0].kind;
    if (parts.every((part) => part.kind === kind)) {
      return `the ${textCore().formatList(parts.map((part) => part.text))} ${POSITION_NOUN[kind].plural}`;
    }
    return textCore().formatList(
      indices.map((i) => pointReference(chart, i, asHtml))
    );
  }

  // ---------------------------------------------------------------------
  // The same four answers as runs (CD-5b-4b)
  // ---------------------------------------------------------------------
  //
  // The string helpers above stay until the construction sentence stops
  // calling them (CD-5b-4c). These return runs instead of escaped strings, so
  // an author's text enters the model as an author run and is escaped once, by
  // the renderer, and the describer's own words are text runs. They decide
  // exactly what their string twins decide.

  /**
   * `seriesLabel` as runs: the author's series name is an author run between
   * describer text runs.
   *
   * @param {Object} series - One adapter series
   * @param {Array<Object>} allSeries - Every series on the chart
   * @returns {Array<Object>} Runs; the first is always a text run
   */
  function seriesLabelRuns(series, allSeries) {
    const { text, author } = modelCore();
    const identity = seriesIdentity(series, allSeries);

    if (identity.name) {
      return [text('the "'), author(identity.name), text('" series')];
    }
    if (!identity.isAmongSeveral) {
      return [text(`the ${identity.kind} series`)];
    }
    return [text(`the ${ordinalWord(identity.position)} ${identity.kind} series`)];
  }

  /**
   * `pointReferencePart` as runs: a band label is the author's text inside
   * describer quotes, an ordinal or position word is describer text.
   *
   * @param {Object} chart - The adapter's chart
   * @param {number} index - 0-based point index
   * @returns {Object} `{ kind, runs, disambiguator }` for a label, `{ kind,
   *   runs }` for an ordinal or position word
   */
  function pointReferencePartRuns(chart, index) {
    const { text, author } = modelCore();
    const label = declaredCategories(chart)[index];
    if (typeof label === "string") {
      return {
        kind: "label",
        runs: [text('"'), author(label), text('"')],
        // RULE XC21, as pointReferencePart states it.
        disambiguator: isDuplicatedLabel(chart, index)
          ? `the ${ordinalWord(index + 1)} ${POSITION_NOUN.position.singular.toLowerCase()}`
          : null,
      };
    }
    // RULE XC20, as pointReferencePart states it.
    const kind = hasDeclaredCategories(chart) ? "position" : "ordinal";
    return { kind: kind, runs: [text(ordinalWord(index + 1))] };
  }

  /**
   * `referenceText` as runs.
   *
   * @param {Object} part - A pointReferencePartRuns result
   * @param {string} style - A REFERENCE_STYLE member
   * @returns {Array<Object>} Runs
   */
  function referenceRuns(part, style) {
    const { text } = modelCore();
    if (part.kind !== "label") {
      return [
        text("the "),
        ...part.runs,
        text(` ${POSITION_NOUN[part.kind].singular.toLowerCase()}`),
      ];
    }
    if (!part.disambiguator) return part.runs;
    return style === REFERENCE_STYLE.PARENTHETICAL
      ? [...part.runs, text(`, ${part.disambiguator}`)]
      : [...part.runs, text(` (${part.disambiguator})`)];
  }

  /**
   * `pointReferences` as runs. Lists join through `joinRuns`, which reproduces
   * `formatList`.
   *
   * @param {Object} chart - The adapter's chart
   * @param {Array<number>} indices - 0-based point indices, source order
   * @param {string} style - A REFERENCE_STYLE member
   * @returns {Array<Object>} Runs
   */
  function pointReferencesRuns(chart, indices, style) {
    const { text } = modelCore();
    if (indices.length === 1) {
      return referenceRuns(pointReferencePartRuns(chart, indices[0]), style);
    }
    if (indices.length >= TIED_POSITION_COLLAPSE_AT) {
      return [text(`${countWord(indices.length)} points`)];
    }

    const parts = indices.map((i) => pointReferencePartRuns(chart, i));
    if (parts.every((part) => part.kind === "label")) {
      return joinRuns(
        parts.map((part) => referenceRuns(part, REFERENCE_STYLE.STANDALONE))
      );
    }
    const kind = parts[0].kind;
    if (parts.every((part) => part.kind === kind)) {
      return [
        text("the "),
        ...joinRuns(parts.map((part) => part.runs)),
        text(` ${POSITION_NOUN[kind].plural}`),
      ];
    }
    return joinRuns(
      parts.map((part) => referenceRuns(part, REFERENCE_STYLE.STANDALONE))
    );
  }

  /**
   * `capitalise` over a run list. Every label and reference this is called on
   * opens with describer text ("the ..."), so only that run's first character
   * changes; anything else is a defect and throws rather than guessing.
   *
   * @param {Array<Object>} runs - Runs whose first is a text run
   * @returns {Array<Object>} The same runs with the first character raised
   */
  function capitaliseRuns(runs) {
    const { text } = modelCore();
    const [first, ...rest] = runs;
    if (!first || first.type !== text("").type) {
      throw new Error("capitaliseRuns: the first run is not describer text");
    }
    return [text(capitalise(first.value)), ...rest];
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
   * Returned as runs (CD-5b-4b): an author's series name or category label is
   * an author run, escaped once by whatever renders it, and everything else is
   * describer text. `tier` stays because it changes words (rule XC23(b)'s
   * rounding, XC23(c)'s fixed short sentence), not escaping.
   *
   * @param {Object} chart - The adapter's chart
   * @param {string} tier - A TIERS member
   * @returns {Array<Object>} Runs for one sentence, ending in a full stop
   */
  function buildTakeawayRuns(chart, tier) {
    const { text } = modelCore();
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
          return [text("The chart's series have different numbers of values.")];
        }
        const clauses = series.map((one) => [
          ...seriesLabelRuns(one, series),
          text(` has ${countWord(one.values.length)}`),
        ]);
        return [
          text("The chart's series have different numbers of values: "),
          ...joinRuns(clauses),
          text("."),
        ];
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
      return [
        ...capitaliseRuns(seriesLabelRuns(highest, series)),
        text(" shows the highest overall values."),
      ];
    }

    const only = series[0];
    const stats = computeStatistics(only.values);
    const rangeSentence = [
      text(
        `Values range from ${formatAuthorValueForTier(tier, stats.min)} to ${formatAuthorValueForTier(tier, stats.max)} with an average of ${formatDerivedValue(stats.mean)}.`
      ),
    ];

    // RULE XC17, AND IT COMES FIRST. A series with no variance cannot be
    // described by a range, a trend or a ratio: the range collapses ("Values
    // range from 42 to 42"), the trend at one value is the UNKNOWN SENTINEL
    // reaching the reader as the word "unknown" in the aria-label, and both
    // ratios are exactly 1. Every one of those is a defect the sweep measured
    // (XP8, XP9), and all three have the same cure — state the fact once.
    if (isDegenerateSeries(stats)) return degenerateTakeaway(chart, stats, tier);

    if (isRangeAxis) return rangeSentence;
    if (!Number.isFinite(stats.mean) || stats.mean === 0) return rangeSentence;

    const maxRatio = stats.max / stats.mean;
    const minRatio = stats.min / stats.mean;

    if (only.kind === SERIES_KINDS.LINE) {
      const trend = analyseTrend(only.values);
      if (trend === TRENDS.UP || trend === TRENDS.DOWN) {
        return [
          ...capitaliseRuns(seriesLabelRuns(only, series)),
          text(
            ` shows a ${trend} trend, ranging from ${formatAuthorValueForTier(tier, stats.min)} to ${formatAuthorValueForTier(tier, stats.max)}.`
          ),
        ];
      }
      if (maxRatio > HIGH_POINT_RATIO) {
        return [
          ...capitaliseRuns(seriesLabelRuns(only, series)),
          text(` peaks significantly at ${formatAuthorValueForTier(tier, stats.max)} during `),
          ...pointReferencesRuns(chart, stats.maxIndices, REFERENCE_STYLE.STANDALONE),
          text("."),
        ];
      }
      // `is ${trend}` CANNOT RECEIVE THE UNKNOWN SENTINEL. analyseTrend returns
      // UNKNOWN only below two values, and a series of nought or one value never
      // reaches this line — one value is degenerate and returned above, and an
      // empty one is caught by the zero-mean guard. The reachability of every
      // trend-speaking site is enumerated in docs/mermaid-xychart-fs2-2026-08-24.md.
      return [
        ...capitaliseRuns(seriesLabelRuns(only, series)),
        text(
          ` is ${trend}, with values between ${formatAuthorValueForTier(tier, stats.min)} and ${formatAuthorValueForTier(tier, stats.max)}.`
        ),
      ];
    }

    if (maxRatio > HIGH_POINT_RATIO) {
      return [
        text(`The highest value, ${formatAuthorValueForTier(tier, stats.max)} at `),
        ...pointReferencesRuns(chart, stats.maxIndices, REFERENCE_STYLE.STANDALONE),
        text(`, is ${Math.round((maxRatio - 1) * 100)}% above the average.`),
      ];
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
      return [
        text(`The lowest value, ${formatAuthorValueForTier(tier, stats.min)} at `),
        ...pointReferencesRuns(chart, stats.minIndices, REFERENCE_STYLE.STANDALONE),
        text(`, is ${Math.round((1 - minRatio) * 100)}% below the average.`),
      ];
    }
    return rangeSentence;
  }

  /**
   * The takeaway as the public name has always returned it: a half-step
   * wrapper over `buildTakeawayRuns` (CD-5b-4b). The plain form is the runs
   * flattened, never escaped (contract clause C1); the HTML form is the runs
   * rendered as one detailed-tier paragraph with the paragraph tags removed.
   * The two assemblers still call this with `asHtml` false.
   *
   * @param {Object} chart - The adapter's chart
   * @param {boolean} asHtml - True when the result enters an HTML sink
   * @param {string} tier - A TIERS member
   * @returns {string} One sentence, ending in a full stop
   */
  function buildTakeaway(chart, asHtml, tier) {
    const { description, section, paragraph, flatten } = modelCore();
    const runs = buildTakeawayRuns(chart, tier);
    if (!asHtml) return flatten(runs);

    const html = renderCore().renderHtml(
      description([], [section([paragraph(runs)])]),
      renderCore().PROFILES.lines
    ).detailed;
    if (!html.startsWith("<p>") || !html.endsWith("</p>")) {
      throw new Error("buildTakeaway: the renderer did not write one paragraph");
    }
    return html.slice("<p>".length, -"</p>".length);
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
   * @param {string} tier - A TIERS member
   * @returns {Array<Object>} Runs for one sentence, ending in a full stop
   */
  function degenerateTakeaway(chart, stats, tier) {
    const { text } = modelCore();
    const value = formatAuthorValueForTier(tier, stats.max);
    if (stats.count === 1) {
      const isBandAxis = !!chart.xAxis && chart.xAxis.kind === AXIS_KINDS.BAND;
      // The comma before "at" is part of the ruled exact text, not a stylistic
      // choice: the position is an appositive on the value, and the first
      // capture of this sentence omitted it and was corrected against the rule.
      const where = isBandAxis
        ? [
            text(", at "),
            ...referenceRuns(
              pointReferencePartRuns(chart, stats.maxIndex),
              REFERENCE_STYLE.STANDALONE
            ),
          ]
        : [];
      return [text(`The chart has a single value, ${value}`), ...where, text(".")];
    }
    // XC17 ADDENDUM (a), 24 August 2026. English says "Both", not "All two".
    // Raised by FS2 § 7.3, which measured `All two values are 42.` on a
    // two-point flat series, declined to invent a carve-out beyond its own
    // dispatch, and referred it here. Three and up keep the "All N" form, which
    // the four FS2 degenerate fixtures guard.
    if (stats.count === 2) return [text(`Both values are ${value}.`)];
    return [text(`All ${countWord(stats.count)} values are ${value}.`)];
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
   * @returns {Object} One list item (model item)
   */
  function degenerateSeriesInsight(chart, series, stats) {
    const { text, item } = modelCore();
    const label = seriesLabelRuns(series, chart.series);
    // VERBATIM, not tier-aware: this is a DETAILED-tier insight and never
    // reaches the short tier, so rule XC23(b)'s rounding must not touch it.
    const value = formatAuthorValue(stats.max);
    if (stats.count === 1) {
      return item([...capitaliseRuns(label), text(` has a single value, ${value}.`)]);
    }
    return item([text("Every value in "), ...label, text(` is ${value}.`)]);
  }


  // ---------------------------------------------------------------------
  // The short tier (rule XC1)
  // ---------------------------------------------------------------------

  /**
   * What the picture shows in the value axis's place (rule XC25), or null.
   *
   * Where the y-axis has no title AND the chart has exactly one series AND that
   * series is named AND the picture draws the name, the name stands in for the
   * y-descriptor in the short opening and in Construction. The y-axis sentence
   * still describes the axis as untitled: nothing calls the axis by this name.
   *
   * The caller states whether the picture draws the name
   * (`options.drawsSeriesName`, ON unless told otherwise) because the words
   * must not put in a caption text the picture does not show. Mermaid 11.17.2
   * draws it as a legend entry, measured 30 October 2026.
   *
   * @param {Object} chart - The adapter's chart
   * @param {Object} [options] - `{ drawsSeriesName: boolean }`, default ON
   * @returns {string|null} The series name, or null where nothing stands in
   */
  function drawnSeriesName(chart, options) {
    const settings = { ...DEFAULT_DESCRIBE_OPTIONS, ...(options || {}) };
    if (!settings.drawsSeriesName) return null;
    if (chart.yAxis && chart.yAxis.title) return null;
    if (!chart.series || chart.series.length !== 1) return null;
    return chart.series[0].name || null;
  }

  /**
   * The span clause of a declared band axis (rule XC24): `, from "FIRST" to
   * "LAST"` — the first and last DECLARED labels, verbatim and quoted, escaped
   * once here at the HTML sink. One category reads `, "LABEL"` (the caller's
   * count phrase has already said "one <noun>"). A label repeated on the axis
   * takes XC21's standalone shape, because `pointReference` already does.
   * Detailed tier only. A range axis, and a chart with no x-axis, declare no
   * categories and so yield an empty clause.
   *
   * @param {Object} chart - The adapter's chart
   * @returns {string} The clause with its leading comma, or ""
   */
  function constructionSpan(chart) {
    const declared = declaredCategories(chart).length;
    if (declared === 0) return "";
    const first = pointReference(chart, 0, true);
    if (declared === 1) return `, ${first}`;
    return `, from ${first} to ${pointReference(chart, declared - 1, true)}`;
  }

  /**
   * Build the short tier's opening sentence.
   * @param {Object} chart - The adapter's chart
   * @param {boolean} asHtml - True when the result enters an HTML sink
   * @param {Object} [options] - `{ drawsSeriesName: boolean }`; see
   *   `drawnSeriesName` (rule XC25). A trailing options object, not a field on
   *   the chart: the chart is the adapter's model of the diagram, and whether
   *   the picture draws a name belongs to the caller that rendered it.
   * @returns {string} One sentence, ending in a full stop
   */
  function buildShortOpening(chart, asHtml, options) {
    const typeWord = chartTypeWord(chart.series);
    const noun = axisNoun(chart);
    const count = pointCount(chart);
    const standIn = drawnSeriesName(chart, options);

    let sentence = `A ${typeWord} chart`;
    if (chart.title) {
      sentence += ` titled "${asHtml ? escapeText(chart.title) : chart.title}"`;
    }
    if (chart.yAxis && chart.yAxis.title) {
      sentence += ` showing "${asHtml ? escapeText(chart.yAxis.title) : chart.yAxis.title}"`;
    } else if (standIn !== null) {
      sentence += ` showing "${asHtml ? escapeText(standIn) : standIn}"`;
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
    return textCore().formatList(parts);
  }

  // ---------------------------------------------------------------------
  // The detailed tier (rules XC3, XC11)
  // ---------------------------------------------------------------------

  /**
   * The Chart Construction paragraphs.
   * @param {Object} chart - The adapter's chart
   * @param {Object} [options] - `{ drawsSeriesName: boolean }`; see
   *   `drawnSeriesName` (rule XC25)
   * @returns {Array<string>} HTML fragments, one per line
   */
  function buildConstruction(chart, options) {
    const typeWord = chartTypeWord(chart.series);
    const noun = axisNoun(chart);
    const count = pointCount(chart);
    const standIn = drawnSeriesName(chart, options);

    // RULE XC22. The `is drawn` fallback is RETIRED. A chart being *drawn* is
    // not news, and standing alone it was the weakest sentence the module could
    // produce, in the most prominent position in the detailed tier (probe sweep
    // XP23). Where there is no y-descriptor the opener has nothing to predicate
    // and merges with the series sentence instead, which turns two thin
    // sentences into one that says something.
    //
    // RULE XC25: a series name the picture draws stands in for the y-title, so
    // it counts as a y-descriptor here and the sentence does not merge.
    const hasYDescriptor =
      !!(chart.yAxis && chart.yAxis.title) || standIn !== null;

    let opening = `This ${typeWord} chart`;
    if (chart.title) opening += ` titled "${escapeText(chart.title)}"`;
    if (hasYDescriptor) {
      opening += ` shows "${escapeText(standIn !== null ? standIn : chart.yAxis.title)}"`;
    }

    // THE ONLY BRANCH THAT SPEAKS A POSITION COUNT is the band one. That is the
    // predicate rule XC22's of-N-values clause turns on, below.
    const openerSpeaksCount =
      !!chart.xAxis && chart.xAxis.kind === AXIS_KINDS.BAND;
    let spanClause = "";
    if (openerSpeaksCount) {
      const shared = typeWord === "combined" ? "shared " : "";
      const preposition = typeWord === SERIES_KINDS.LINE ? "over" : "for";
      opening += ` ${preposition} ${countWord(count)} ${shared}${countedNoun(noun, count)}`;
      // RULE XC24: the opening names the span of the declared axis. On the
      // merged (y-descriptor-less) sentence it sits before "has" and is closed
      // by a comma (ruling D7c), so the sentence still reads as one.
      spanClause = constructionSpan(chart);
      opening += spanClause;
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
      seriesClause += `: ${textCore().formatList(
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
      : [
          `${opening}${spanClause ? MERGED_SPAN_CLOSE : ""} has ${seriesClause}.`,
        ];

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
   * @returns {Object} One list block (model list), never empty
   */
  function buildInsightsModel(chart) {
    const { list, item, strong } = modelCore();
    const items = [item([strong(buildTakeawayRuns(chart, TIERS.DETAILED))])];
    const isRangeAxis = !chart.xAxis || chart.xAxis.kind === AXIS_KINDS.RANGE;

    if (chart.series.length === 1) {
      const only = chart.series[0];
      if (only.kind === SERIES_KINDS.LINE) {
        items.push(...buildLineInsights(chart, only, isRangeAxis, true));
      } else {
        items.push(...buildBarInsights(chart, only, true));
      }
      return list(items);
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
    return list(items);
  }

  /**
   * The Key Insights as the public name has always returned them: a half-step
   * wrapper over `buildInsightsModel` (CD-5b-4b). Both assemblers write the
   * `<ul>` and `</ul>` lines themselves and spread this array, so the list is
   * rendered under `PROFILES.lines`, split on the newline, and the renderer's
   * own first and last lines are checked and dropped.
   *
   * @param {Object} chart - The adapter's chart
   * @returns {Array<string>} `<li>` fragments, one per line
   */
  function buildInsights(chart) {
    const { description, section } = modelCore();
    const html = renderCore().renderHtml(
      description([], [section([buildInsightsModel(chart)])]),
      renderCore().PROFILES.lines
    ).detailed;
    const lines = html.split("\n");
    if (lines[0] !== "<ul>" || lines[lines.length - 1] !== "</ul>") {
      throw new Error("buildInsights: the renderer did not write one list");
    }
    return lines.slice(1, -1);
  }

  /**
   * A bar series' insights.
   * @param {Object} chart - The adapter's chart
   * @param {Object} series - The bar series
   * @param {boolean} isOnlySeries - True when this is the chart's only series
   * @returns {Array<Object>} List items (model items)
   */
  function buildBarInsights(chart, series, isOnlySeries) {
    const { text, item } = modelCore();
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
          item([
            text(`Highest value: ${formatAuthorValue(stats.max)} (`),
            ...pointReferencesRuns(chart, stats.maxIndices, REFERENCE_STYLE.PARENTHETICAL),
            text(")."),
          ])
        );
        items.push(
          item([
            text(`Lowest value: ${formatAuthorValue(stats.min)} (`),
            ...pointReferencesRuns(chart, stats.minIndices, REFERENCE_STYLE.PARENTHETICAL),
            text(")."),
          ])
        );
      }
      items.push(item([text(`Average value: ${formatDerivedValue(stats.mean)}.`)]));

      if (stats.count >= STATISTICS_MIN_POINTS) {
        items.push(
          item([text(`Standard deviation: ${formatDerivedValue(stats.standardDeviation)}.`)])
        );
        items.push(item([text(`Median value: ${formatDerivedValue(stats.median)}.`)]));
        items.push(item([text(buildDistributionSentence(stats))]));
      }
      return items;
    }

    const label = seriesLabelRuns(series, chart.series);
    items.push(
      item([
        text("Highest value in "),
        ...label,
        text(`: ${formatAuthorValue(stats.max)} (`),
        ...pointReferencesRuns(chart, stats.maxIndices, REFERENCE_STYLE.PARENTHETICAL),
        text(")."),
      ])
    );
    items.push(
      item([
        text("Lowest value in "),
        ...label,
        text(`: ${formatAuthorValue(stats.min)} (`),
        ...pointReferencesRuns(chart, stats.minIndices, REFERENCE_STYLE.PARENTHETICAL),
        text(")."),
      ])
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
   * @returns {Array<Object>} List items (model items)
   */
  function buildLineInsights(chart, series, isRangeAxis, isOnlySeries) {
    const { text, item } = modelCore();
    const stats = computeStatistics(series.values);
    const label = seriesLabelRuns(series, chart.series);
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
      if (clause) items.push(item([...capitaliseRuns(label), text(` ${clause}.`)]));
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
      const peakAt = pointReferencesRuns(
        chart,
        stats.maxIndices,
        peakTied ? REFERENCE_STYLE.STANDALONE : REFERENCE_STYLE.PARENTHETICAL
      );
      const lowAt = pointReferencesRuns(
        chart,
        stats.minIndices,
        lowTied ? REFERENCE_STYLE.STANDALONE : REFERENCE_STYLE.PARENTHETICAL
      );
      items.push(
        item([
          ...capitaliseRuns(label),
          text(` peaks at ${formatAuthorValue(stats.max)}${peakTied ? ", at " : " ("}`),
          ...peakAt,
          text(peakTied ? "." : ")."),
        ])
      );
      items.push(
        item([
          ...capitaliseRuns(label),
          text(` reaches its lowest point at ${formatAuthorValue(stats.min)}${lowTied ? ", at " : " ("}`),
          ...lowAt,
          text(lowTied ? "." : ")."),
        ])
      );
    }

    if (isRangeAxis) {
      if (isUnimodal(series.values)) {
        items.push(item([text("Values rise to a single peak and fall away after it.")]));
      }
      return items;
    }

    if (!isOnlySeries) return items;
    if (stats.count <= LINE_ADVANCED_MIN_POINTS) return items;

    const shape = countPeaksAndTroughs(series.values);
    if (shape.peaks > 1 && shape.troughs > 1) {
      items.push(
        item([
          text(
            `The data shows a cyclic pattern with ${countWord(shape.peaks)} peaks and ${countWord(shape.troughs)} troughs.`
          ),
        ])
      );
    }

    const first = series.values[0];
    const last = series.values[series.values.length - 1];
    if (first !== 0) {
      const percentChange = ((last - first) / Math.abs(first)) * 100;
      if (Math.abs(percentChange) > OVERALL_CHANGE_MIN_PERCENT) {
        items.push(
          item([
            text(
              `Overall ${percentChange > 0 ? "increase" : "decrease"} of ${Math.abs(percentChange).toFixed(1)}% from start to end.`
            ),
          ])
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
   * Built as ONE model table node, so every decision lives here and the
   * renderer writes the markup. `buildTable` below is the half-step wrapper.
   *
   * @param {Object} chart - The adapter's chart
   * @returns {Object} A table block (model table). Its columns are the corner
   *   cell then one per series, and every row has a row header, so each row
   *   holds `columns.length - 1` cells.
   */
  function buildTableModel(chart) {
    const { text, author, table } = modelCore();
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
        ? [author(chart.xAxis.title)]
        : [text(noun.singular)]
      : [text(RANGE_POINT_NOUN)];

    const valueHeaders =
      chart.series.length === 1
        ? [
            chart.series[0].name
              ? [author(chart.series[0].name)]
              : chart.yAxis && chart.yAxis.title
                ? [author(chart.yAxis.title)]
                : [text(FALLBACK_VALUE_HEADER)],
          ]
        : chart.series.map((one) => seriesColumnHeader(one, chart.series));

    const caption = chart.title
      ? [text("Data table for: "), author(chart.title)]
      : [text("Data table")];

    // RULE XC20's row header for an overflow position: `Position 4`, never the
    // bare digit it used to be. A reader moving down the row-header column
    // heard three weekdays and then two numbers, with nothing saying they were
    // the same kind of thing (probe sweep XP17). The digit form survives only
    // where the chart declares no labels at all, which is a numeric-range axis
    // and rule XC6's ground.
    const overflowHeader = hasDeclaredCategories(chart)
      ? (i) => `${POSITION_NOUN.position.singular} ${i + 1}`
      : (i) => String(i + 1);

    const tableRows = [];
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
            ? [
                author(categories[i]),
                text(` (${POSITION_NOUN.position.singular.toLowerCase()} ${i + 1})`),
              ]
            : [author(categories[i])]
          : [text(overflowHeader(i))]
        : [text(String(i + 1))];
      const cells = chart.series.map((one) => {
        const value = one.values[i];
        // RULE XC20 / contract clause D6: a position a series has no value
        // for says so. An empty cell cannot be told from a recorded zero.
        // A cell value is the describer's own formatting, never escaped
        // (formatAuthorValue is String(value) and the old code left it raw).
        return [text(value === undefined ? NO_VALUE_TEXT : formatAuthorValue(value))];
      });
      tableRows.push({ header: rowLabel, cells });
    }

    return table({ caption, columns: [xHeader, ...valueHeaders], rows: tableRows });
  }

  /**
   * The data table as HTML lines: the half-step wrapper over `buildTableModel`
   * that the two assemblers (the Mermaid module and `chartjs.js`) still call.
   * They spread the array and join it on a newline, so it is the table node
   * rendered under `PROFILES.lines` and split on that newline.
   *
   * @param {Object} chart - The adapter's chart
   * @returns {Array<string>} HTML fragments, one per line
   */
  function buildTable(chart) {
    const { description, section } = modelCore();
    const model = description([], [section([buildTableModel(chart)])]);
    return renderCore().renderHtml(model, renderCore().PROFILES.lines).detailed.split("\n");
  }

  // ---------------------------------------------------------------------
  // Pie chart builders
  // ---------------------------------------------------------------------
  //
  // Lifted out of md-scripts/mermaid/mermaid-accessibility-pie.js (CD-2b),
  // bodies byte for byte, so the Mermaid describer and the Chart.js pie,
  // doughnut and polar-area describers can speak with one voice. The only
  // differences from the source are that Common.escapeHtml and Common.formatList
  // now read ChartDescribeText through textCore(), and that countWord is the
  // one declared near the top of this file (the same narrationNumber call the
  // pie module's own countWord made). The harness and the pie byte snapshot in
  // .claude/measurements/cd-2b-pie-lift/ are the bar.
  //
  // The chart they describe is a list of { name, value } segments.

  /**
   * Render a segment value or total at the precision the author wrote it
   *
   * An integer renders bare, so a count of 142 is not read out as "142.0";
   * a value the author wrote with decimals renders exactly as the number
   * holds it. This is the single choke point for VALUE rendering, so a site
   * added later cannot reintroduce a fixed precision on its own.
   *
   * PERCENTAGES do not come through here. They are computed rather than
   * authored, and one decimal place is the right precision for them, so they
   * keep their own toFixed(1).
   *
   * @param {number} value - The segment value or total
   * @returns {string} The value as text, with no imposed precision
   */
  function formatValue(value) {
    return String(value);
  }

  // A share this close to a simple fraction IS that fraction: the sum of
  // authored decimals carries floating-point noise (1/3 of 0.3 is not 0.1).
  const FRACTION_TOLERANCE = 1e-9;
  const SIGNIFICANT_DIGITS = 12;
  // A share that prints as 0.0% but is above zero reads as this instead.
  const BELOW_ONE_TENTH = "less than 0.1%";

  /** The noun for a count: "category" for one, "categories" otherwise. */
  function categoryNoun(count) {
    return count === 1 ? "category" : "categories";
  }

  /**
   * A total with float noise removed: twelve significant digits, unless it is
   * a whole number below 2^53 (the treemap sum rule), which is exact already.
   */
  function cleanTotal(total) {
    if (Number.isInteger(total) && Math.abs(total) < Number.MAX_SAFE_INTEGER) {
      return total;
    }
    return Number(total.toPrecision(SIGNIFICANT_DIGITS));
  }

  /**
   * A percentage as narration: one decimal place, except that a non-zero share
   * which would print as 0.0% reads "less than 0.1%".
   */
  function formatPercentage(value, total) {
    const share = (value / total) * 100;
    const text = share.toFixed(1);
    return value > 0 && text === "0.0" ? BELOW_ONE_TENTH : text + "%";
  }

  /**
   * The phrase for the largest share, tested on the UNROUNDED fraction.
   * "exactly" when within tolerance of the fraction, "over" only above it.
   */
  function proportionPhrase(value, total) {
    const fraction = value / total;
    const near = (target) => Math.abs(fraction - target) <= FRACTION_TOLERANCE;
    if (near(1 / 2)) return "exactly half";
    if (fraction > 1 / 2) return "over half";
    if (near(1 / 3)) return "exactly a third";
    if (fraction > 1 / 3) return "over a third";
    if (near(1 / 4)) return "exactly a quarter";
    if (fraction > 1 / 4) return "over a quarter";
    return "";
  }

  /**
   * The ties at the top and bottom of a descending-sorted list, and whether
   * every slice is equal. A single slice is neither tied nor "all equal".
   */
  function readTies(segments) {
    const first = segments[0].value;
    const last = segments[segments.length - 1].value;
    const largest = segments.filter((segment) => segment.value === first);
    const smallest = segments.filter((segment) => segment.value === last);
    return {
      largest,
      smallest,
      allEqual: segments.length > 1 && largest.length === segments.length,
    };
  }

  /** "All four segments are equal" (two slices read "Both"). */
  function allEqualLead(count) {
    return count === 2
      ? "Both segments are equal"
      : `All ${countWord(count)} segments are equal`;
  }

  // The pie describer's two models resolve at call time, the textCore() way:
  // a module-scope capture would read undefined if a later load order ran
  // this file before model.js or render.js.
  function modelCore() {
    return root.ChartDescribeModel;
  }

  function renderCore() {
    return root.ChartDescribeRender;
  }

  // The kinds of section and list entry the pie model names. LEGACY_PIE_PROFILE
  // below maps each to its class names.
  const PIE_ROLES = Object.freeze({
    CONSTRUCTION: "construction",
    INSIGHTS: "insights",
    DATA: "data",
    PATTERNS: "patterns",
    CATEGORIES: "categories",
    PRIMARY: "primary",
    TOTAL: "total",
    LARGEST: "largest",
    SMALLEST: "smallest",
  });

  const PIE_TERM_CLASS = Object.freeze({
    label: "diagram-segment",
    percentage: "diagram-percentage",
    proportion: "diagram-proportion",
    value: "diagram-value",
    count: "diagram-count",
    title: "diagram-title",
  });

  /**
   * TEMPORARY. The pie describer's presentation, kept here so the pie wrappers
   * (buildPieShort, buildPieDetailed) can render a model to the HTML they have
   * always returned. A frozen copy of CD-5a's "sections" profile, less its two
   * parse-back helpers (sectionRoleFromClass, parseTermClass), which nothing
   * here uses. The class names belong to the Mermaid pie module: this copy is
   * DELETED at CD-5b parcel 6, after parcel 5-pie moves the profile into
   * mermaid-accessibility-pie.js.
   */
  const LEGACY_PIE_PROFILE = Object.freeze({
    name: "sections",
    layout: "sections",
    shortEscape: "author",
    sectionClass: (role) => `mermaid-section chart-${role}`,
    headingClass: "mermaid-details-heading",
    // The whitespace the old template literals left after <section ...> and
    // after the heading, keyed by section role.
    sectionLayout: Object.freeze({
      default: Object.freeze({ indent: 10, afterHeading: true }),
      [PIE_ROLES.INSIGHTS]: Object.freeze({ indent: 10, afterHeading: false }),
      [PIE_ROLES.PATTERNS]: Object.freeze({ indent: 6, afterHeading: true }),
    }),
    listClass: Object.freeze({
      [PIE_ROLES.CATEGORIES]: "diagram-segment-list",
      [PIE_ROLES.INSIGHTS]: "diagram-insights-list",
      [PIE_ROLES.DATA]: "diagram-data-list",
    }),
    itemClass: Object.freeze({
      [PIE_ROLES.PRIMARY]: "diagram-insight diagram-insight-primary",
      [PIE_ROLES.TOTAL]: "diagram-insight diagram-insight-total",
      [PIE_ROLES.LARGEST]: "diagram-insight diagram-insight-largest",
      [PIE_ROLES.SMALLEST]: "diagram-insight diagram-insight-smallest",
      [PIE_ROLES.DATA]: "diagram-data-item",
    }),
    termClass: (role, variant) =>
      role === "pattern"
        ? `diagram-pattern diagram-pattern-${variant}`
        : PIE_TERM_CLASS[role],
  });

  /** A segment's name as the chart author wrote it, a label term over one author run. */
  function segmentLabel(segment) {
    const { term, author } = modelCore();
    return term("label", [author(String(segment.name))]);
  }

  /**
   * The run-level counterpart of textCore().formatList: each entry is a list
   * of runs, and the separators are describer text between them. Zero entries
   * give no runs, one gives itself, two are joined by " and ", three or more
   * by commas with an Oxford comma. Joining runs rather than HTML strings
   * leaves the author text to the renderer's single escape.
   * @param {Array<Array>} entries
   * @returns {Array} The joined runs
   */
  function joinRuns(entries) {
    const { text } = modelCore();
    if (entries.length === 0) return [];
    if (entries.length === 1) return entries[0];
    if (entries.length === 2) return [...entries[0], text(" and "), ...entries[1]];

    const runs = [];
    entries.slice(0, -1).forEach((entry, index) => {
      if (index > 0) runs.push(text(", "));
      runs.push(...entry);
    });
    runs.push(text(", and "), ...entries[entries.length - 1]);
    return runs;
  }

  /**
   * One Key Insights entry for the largest or the smallest group. A group of
   * one reads "Largest segment: X (v, p)"; a tie reads "Largest segments: X and
   * Y (v each, p each)".
   * @returns {Object} A list entry (model item)
   */
  function extremeItem(kind, label, group, total) {
    const { text, term, item } = modelCore();
    const tied = group.length > 1;
    const each = tied ? [text(" each")] : [];

    return item(
      [
        text(`${label} segment${tied ? "s" : ""}: `),
        ...joinRuns(group.map((segment) => [segmentLabel(segment)])),
        text(" ("),
        term("value", [text(formatValue(group[0].value))]),
        ...each,
        text(", "),
        term("percentage", [text(formatPercentage(group[0].value, total))]),
        ...each,
        text(")"),
      ],
      { role: kind }
    );
  }

  const ZERO_SENTENCE =
    "Every value is zero, so no segment is larger than another.";

  /**
   * The sentence that names the largest segment(s), as runs. This is the one
   * place the short description and the Key Insights read from, so they
   * cannot drift apart.
   * @returns {Array} The runs of the sentence
   */
  function largestSentence(segments, total) {
    const { text, term } = modelCore();
    if (total === 0) return [text(ZERO_SENTENCE)];

    const ties = readTies(segments);
    const largest = segments[0];
    const percentage = term("percentage", [
      text(formatPercentage(largest.value, total)),
    ]);

    if (ties.allEqual) {
      return [
        text(`${allEqualLead(segments.length)}, at `),
        percentage,
        text(" each."),
      ];
    }

    if (ties.largest.length > 1) {
      return [
        ...joinRuns(ties.largest.map((segment) => [segmentLabel(segment)])),
        text(" are the joint largest segments, at "),
        percentage,
        text(" each."),
      ];
    }

    const proportion = proportionPhrase(largest.value, total);
    return [
      segmentLabel(largest),
      text(" is the largest segment at "),
      percentage,
      ...(proportion
        ? [
            text(", representing "),
            term("proportion", [text(proportion)]),
            text(" of the total"),
          ]
        : []),
      text("."),
    ];
  }

  /**
   * The pie chart's description as a model: the short sentence as runs and
   * four sections (construction, insights, data, patterns). Author text
   * (the title and the segment names) enters only as author runs, raw; the
   * renderer escapes it once. Sorts `segments` in place, highest value first.
   * @param {string} title - The chart title, or an empty string
   * @param {Array<{name: string, value: number}>} segments - The segments
   * @returns {Object} A DescriptionModel (see model.js)
   */
  function buildPieModel(title, segments) {
    const { text, author, term, strong, paragraph, list, item, section } =
      modelCore();

    // Sort segments by value (descending)
    segments.sort((a, b) => b.value - a.value);

    logDebug("Processed " + segments.length + " segments");

    const total = segments.reduce((sum, segment) => sum + segment.value, 0);

    logDebug("Total value across all segments: " + total);

    const titleRuns = title
      ? [text(' titled "'), term("title", [author(String(title))]), text('"')]
      : [];

    // 1. The short description. An untitled chart has no "titled" clause.
    const count = segments.length
      ? `${countWord(segments.length)} ${categoryNoun(segments.length)}`
      : "multiple categories";
    const short = [
      text("A pie chart"),
      ...titleRuns,
      text(` showing the distribution of ${count}.`),
    ];
    if (segments.length > 0) {
      short.push(text(" "), ...largestSentence(segments, total));
    }

    // 2. Chart Construction
    const constructionBlocks = [
      paragraph([
        text("This pie chart"),
        ...titleRuns,
        text(" shows the distribution of categories."),
      ]),
    ];
    if (segments.length > 0) {
      constructionBlocks.push(
        paragraph([
          text("The chart shows "),
          term("count", [text(countWord(segments.length))]),
          text(` ${categoryNoun(segments.length)}:`),
        ]),
        // The author's name, as written. This list used to lower-case it while
        // Key Insights and Complete Data Points did not, so one description
        // spelled the same category two ways.
        list(
          segments.map((segment) => item([segmentLabel(segment)])),
          { role: PIE_ROLES.CATEGORIES }
        )
      );
    } else {
      constructionBlocks.push(
        paragraph([
          text(
            "The chart is divided into segments in a circular layout, with each segment's size representing its proportion of the whole."
          ),
        ])
      );
    }

    // 3. Key Insights
    const insightItems = [];
    if (segments.length > 0) {
      insightItems.push(
        item([strong(largestSentence(segments, total))], {
          role: PIE_ROLES.PRIMARY,
        })
      );
    }

    // The total, with float noise removed
    insightItems.push(
      item(
        [
          text("Total: "),
          term("value", [text(formatValue(cleanTotal(total)))]),
        ],
        { role: PIE_ROLES.TOTAL }
      )
    );

    // Largest and smallest segments. When every value is zero there are no
    // percentages to narrate; when every slice is equal the primary insight
    // has said so, and a largest and a smallest line would contradict it.
    if (segments.length > 0 && total > 0) {
      const ties = readTies(segments);
      if (!ties.allEqual) {
        insightItems.push(
          extremeItem(PIE_ROLES.LARGEST, "Largest", ties.largest, total),
          extremeItem(PIE_ROLES.SMALLEST, "Smallest", ties.smallest, total)
        );
      }
    }

    // 4. Complete Data Points: every segment with its value, and its
    // percentage unless every value is zero (there is no share to state).
    const dataItems = segments.map((segment) =>
      item(
        [
          segmentLabel(segment),
          text(": "),
          term("value", [text(formatValue(segment.value))]),
          ...(total > 0
            ? [
                text(" ("),
                term("percentage", [
                  text(formatPercentage(segment.value, total)),
                ]),
                text(")"),
              ]
            : []),
        ],
        { role: PIE_ROLES.DATA }
      )
    );

    const sections = [
      section(constructionBlocks, {
        role: PIE_ROLES.CONSTRUCTION,
        heading: [text("Chart Construction")],
      }),
      section([list(insightItems, { role: PIE_ROLES.INSIGHTS })], {
        role: PIE_ROLES.INSIGHTS,
        heading: [text("Key Insights")],
      }),
      section([list(dataItems, { role: PIE_ROLES.DATA })], {
        role: PIE_ROLES.DATA,
        heading: [text("Complete Data Points")],
      }),
    ];

    // The pattern section needs enough segments to identify patterns, and a
    // total to state them against
    if (segments.length >= 3 && total > 0) {
      logDebug(
        "Generating pattern analysis for " + segments.length + " segments"
      );
      sections.push(generatePatternSection(segments, total));
    }

    return modelCore().description(short, sections);
  }

  /**
   * The short description of a pie chart, in both tiers.
   * @param {string} title - The chart title, or an empty string
   * @param {Array<{name: string, value: number}>} segments - The segments
   *   (sorted in place, highest value first)
   * @returns {{html: string, text: string}} The HTML and plain-text descriptions
   */
  function buildPieShort(title, segments) {
    const model = buildPieModel(title, segments);

    logDebug("Short description generated successfully");

    // The PLAIN tier is the flattened runs: raw author text, never escaped. It
    // feeds the SVG aria-label and the textContent fallback, neither of which
    // parses HTML, so entities there would be read out literally. The HTML
    // tier is escaped once, by the renderer.
    return {
      html: renderCore().renderHtml(model, LEGACY_PIE_PROFILE).shortHTML,
      text: modelCore().flatten(model.short),
    };
  }

  /**
   * The detailed description of a pie chart.
   * @param {string} title - The chart title, or an empty string
   * @param {Array<{name: string, value: number}>} segments - The segments
   *   (sorted in place, highest value first)
   * @returns {string} HTML description with structured, accessible information
   */
  function buildPieDetailed(title, segments) {
    const model = buildPieModel(title, segments);

    if (segments.length === 0) {
      logWarn("No segments available for detailed description");
    }

    logInfo("Detailed pie chart description generated successfully");
    return renderCore().renderHtml(model, LEGACY_PIE_PROFILE).detailed;
  }

  /**
   * The section that describes patterns in the pie chart data
   * @param {Array} segments - Array of segment objects
   * @param {number} total - Total value of all segments
   * @returns {Object} The patterns section (model section)
   */
  function generatePatternSection(segments, total) {
    const { text, term, paragraph, section } = modelCore();

    logDebug("Analysing distribution patterns");

    // Calculate distribution characteristics
    const avgPercentage = (100 / segments.length).toFixed(1);

    logDebug("Distribution analysis - Average: " + avgPercentage + "%");

    // The skewed/balanced judgement (and its 1.5 times threshold) is gone: the
    // percentages above carry the facts, and the average is the one figure
    // they do not state.
    const runs = [
      text("The average segment size is "),
      term("percentage", [text(`${avgPercentage}%`)]),
      text("."),
    ];

    // Add group information if there are more than 4 segments
    if (segments.length > 4) {
      // Calculate the combined percentage of the smallest segments (bottom half)
      const bottomHalfIndex = Math.floor(segments.length / 2);
      const bottomHalf = segments.slice(bottomHalfIndex);
      const bottomHalfTotal = bottomHalf.reduce(
        (sum, segment) => sum + segment.value,
        0
      );
      const bottomHalfPercentage = formatPercentage(bottomHalfTotal, total);

      logDebug(
        "Bottom " +
          bottomHalf.length +
          " segments represent " +
          bottomHalfPercentage +
          "% of total"
      );

      // The line break and eight spaces inside this sentence are the old
      // template literal's own whitespace, kept byte for byte (CD-5a owner
      // question Q2 is still open). HTML collapses it when read.
      runs.push(
        text(" The bottom "),
        term("count", [text(countWord(bottomHalf.length))]),
        text(" segments\n        collectively represent "),
        term("percentage", [text(bottomHalfPercentage)]),
        text(" of the total.")
      );
    }

    return section([paragraph(runs)], {
      role: PIE_ROLES.PATTERNS,
      heading: [text("Distribution Pattern")],
    });
  }

  // ---------------------------------------------------------------------
  // Radar builders (CD-2c)
  // ---------------------------------------------------------------------
  //
  // Lifted byte for byte from md-scripts/mermaid/mermaid-accessibility-radar.js,
  // which keeps `measure` (the step that turns the parse adapter's delivery into
  // facts) and its helpers. Two changes only: the shared prose layer is now
  // textCore(), and the guarded count word is `radarCountWord`, because the one
  // above (xychart and pie) does not guard a non-integer. Merging them waits on
  // register item 137.
  //
  // CD-5b-3: every builder below returns runs, items or blocks of the
  // DescriptionModel (model.js), never HTML. Author text enters only as
  // `author` runs, raw, and the renderer escapes it once. buildRadarShort and
  // buildRadarDetailed render buildRadarModel through PROFILES.lines.

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
  function radarCountWord(value) {
    if (Number.isInteger(value) && value >= 0 && value <= 9) {
      return textCore().narrationNumber(value);
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
    return `${radarCountWord(count)} ${count === 1 ? singular : plural}`;
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
   * Join lists of runs - NO SERIAL COMMA.
   *
   * The targets join "Pace", "Workload" and "Support" with no comma before
   * the "and" (E2), so the shared `formatList` (and `joinRuns`, its run-level
   * form in the pie section), which write an Oxford comma from three items
   * up, are deliberately not used. One join serves the axes sentence, the
   * highest/lowest ties and every pair-sentence list. It joins runs rather
   * than strings, so author text reaches the renderer's single escape raw.
   *
   * @param {Array<Array>} entries - One list of runs per item
   * @returns {Array} The joined runs
   */
  function joinRunsNoSerial(entries) {
    const { text } = modelCore();
    if (entries.length === 0) return [];
    if (entries.length === 1) return entries[0];

    const runs = [];
    entries.slice(0, -1).forEach((entry, index) => {
      if (index > 0) runs.push(text(", "));
      runs.push(...entry);
    });
    runs.push(text(" and "), ...entries[entries.length - 1]);
    return runs;
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
   * Quote one author label - RD3, RD7, RD8 and RD14.
   *
   * The quotation marks are generator furniture (describer text); only the
   * label is an author run. Author names are never inflected.
   *
   * @param {string} label - An axis or series label
   * @returns {Array} e.g. "Attack" with its quotation marks, as runs
   */
  function quotedLabel(label) {
    const { text, author } = modelCore();
    return [text('"'), author(String(label)), text('"')];
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
   * @returns {Array} The name, as runs
   */
  function proseName(label, noun, position) {
    const { text } = modelCore();
    return isUnlabelled(label) ? [text(`${noun} ${position}`)] : quotedLabel(label);
  }

  /**
   * An author label as a TABLE HEADER names it - unquoted and escaped, or the
   * same generator phrase, so no header cell is ever empty (RR24).
   *
   * @param {string} label - The label
   * @param {string} noun - UNLABELLED_AXIS or UNLABELLED_SERIES
   * @param {number} position - The declaration position, from one
   * @returns {Array} The cell content, as runs
   */
  function cellName(label, noun, position) {
    const { text, author } = modelCore();
    // A header cell is an opening position (RR34), so the phrase takes its capital.
    return isUnlabelled(label)
      ? [text(capitalisePhrase(`${noun} ${position}`))]
      : [author(String(label))];
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
   * @param {Array} name - The name as runs, from `proseName`
   * @returns {Array} The name as runs, ready to open a position
   */
  function capitaliseOpening(label, name) {
    const { text } = modelCore();
    if (!isUnlabelled(label)) return name;
    // An unlabelled name is one describer text run, the generator's own phrase.
    return [text(capitalisePhrase(name[0].value))];
  }

  /** A generator phrase with its first letter capitalised. */
  function capitalisePhrase(phrase) {
    return phrase.charAt(0).toUpperCase() + phrase.slice(1);
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
  // The short tier - rule RD1
  // ---------------------------------------------------------------------

  /**
   * The short description - rule RD1. THE ONLY BUILDER OF THE SHORT SENTENCE.
   *
   * Runs, with the title an author run. The plain tier is `flatten` of these
   * runs, raw, because that tier reaches a `textContent` sink and the SVG's
   * `aria-label`, where an entity would be announced literally; the HTML tier
   * is the same runs under PROFILES.lines, which escapes the whole sentence
   * (furniture quotes included). One composition serves both tiers, so they
   * cannot disagree.
   *
   * @param {Object} facts - From `measure`
   * @returns {Array} The short sentence, as runs
   */
  function buildShortRuns(facts) {
    const { text, author } = modelCore();
    const titled =
      facts.title === null
        ? []
        : [text(' titled "'), author(String(facts.title)), text('"')];
    return [
      text("A radar chart"),
      ...titled,
      text(` with ${axesPhrase(facts.N)} and ${seriesPhrase(facts.K)}.`),
    ];
  }

  // ---------------------------------------------------------------------
  // The Overview - rules RD2 to RD5
  // ---------------------------------------------------------------------

  /**
   * Overview paragraph one - RD2: the title, the series and the axes.
   * @param {Object} facts - From `measure`
   * @returns {Array} The sentence, as runs
   */
  function buildOpeningSentence(facts) {
    const { text } = modelCore();
    const titled = facts.title === null ? [] : [text(" titled "), ...quotedLabel(facts.title)];
    return [
      text("This radar chart"),
      ...titled,
      text(` plots ${seriesPhrase(facts.K)} across ${axesPhrase(facts.N)}.`),
    ];
  }

  /**
   * Overview paragraph two - RD3: every axis, in declaration order.
   *
   * "clockwise from the top" is a fact of the picture, measured (RR1): the
   * first declared axis is at the top and the order runs clockwise at 360/N
   * degrees. EDGE 2's no-axis chart reads "There are no axes."
   *
   * @param {Object} facts - From `measure`
   * @returns {Array} The sentence, as runs
   */
  function buildAxesSentence(facts) {
    const { text } = modelCore();
    const labels = facts.axes.map((axis, index) => axisName(axis, index));
    if (facts.N === 0) return [text("There are no axes.")];
    if (facts.N === 1) {
      return [text("The one axis is at the top and is "), ...labels[0], text(".")];
    }
    return [
      text("The axes, clockwise from the top, are "),
      ...joinRunsNoSerial(labels),
      text("."),
    ];
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
      count === 1 ? "One value is" : `${textCore().capitalize(valuesPhrase(count))} are`;
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
   * @returns {Array} The sentence, as runs
   */
  function extremesSentence(axes, values) {
    const { text } = modelCore();
    const highest = Math.max(...values);
    const lowest = Math.min(...values);
    if (highest === lowest) return [text("The same value on every axis.")];

    const on = (target) =>
      joinRunsNoSerial(
        axes
          .map((axis, index) => (values[index] === target ? axisName(axis, index) : null))
          .filter((name) => name !== null)
      );
    return [text("Highest on "), ...on(highest), text(", lowest on "), ...on(lowest), text(".")];
  }

  /**
   * The nested per-axis list of a drawn series - RD7 form B.
   * @param {Object[]} axes - The delivered axes
   * @param {number[]} values - The series' values, in axis order
   * @returns {Object} A list block (model list)
   */
  function axisValueList(axes, values) {
    const { text, list, item } = modelCore();
    return list(
      axes.map((axis, index) =>
        item([...openingAxisName(axis, index), text(`: ${numberText(values[index])}`)])
      )
    );
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
   * @returns {Object} A list entry (model item), its nested list as a child
   */
  function buildSeriesItem(facts, curve) {
    const { text, list, item } = modelCore();

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
      return item(
        [
          ...label,
          text(`: ${reason}, so it is not plotted, ${legendClause}. ${leadIn}`),
        ],
        {
          children: [
            list(curve.values.map((value) => item([text(numberText(value))]))),
          ],
        }
      );
    }

    const disclosure = facts.legend ? "" : " (named in the code, not in the picture)";
    const averaging = facts.noRange ? "" : `, averaging ${numberText(roundedMean(curve.values))}`;
    return item(
      [
        ...label,
        text(`${disclosure}${averaging}. `),
        ...extremesSentence(facts.axes, curve.values),
      ],
      { children: [axisValueList(facts.axes, curve.values)] }
    );
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
   * @returns {Array} The sentence, as runs
   */
  function buildPairSentence(facts, first, second) {
    const { text } = modelCore();
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

    if (higher.length === total) {
      return [...subject, text(" is higher than "), ...other, text(" on every axis.")];
    }
    if (lower.length === total) {
      return [...subject, text(" is lower than "), ...other, text(" on every axis.")];
    }
    if (equal.length === total) {
      return [...subject, text(" and "), ...other, text(" are equal on every axis.")];
    }

    // Each part is a list of runs; the parts are joined by a comma.
    const parts = [];
    if (higher.length > 0) {
      parts.push([
        ...subject,
        text(" is higher than "),
        ...other,
        text(" on "),
        ...joinRunsNoSerial(higher),
      ]);
      if (lower.length > 0) parts.push([text("and lower on "), ...joinRunsNoSerial(lower)]);
    } else {
      parts.push([
        ...subject,
        text(" is lower than "),
        ...other,
        text(" on "),
        ...joinRunsNoSerial(lower),
      ]);
    }
    if (equal.length > 0) parts.push([text("and equal on "), ...joinRunsNoSerial(equal)]);

    const runs = [];
    parts.forEach((part, index) => {
      if (index > 0) runs.push(text(", "));
      runs.push(...part);
    });
    runs.push(text("."));
    return runs;
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
   * @returns {Object[]} One list entry (model item) per listed pair, then any closing item
   */
  function comparisonItems(facts) {
    const { text, item } = modelCore();
    const items = [];
    const series = facts.compared;
    for (let i = 0; i < series.length; i += 1) {
      for (let j = i + 1; j < series.length; j += 1) {
        items.push(item(buildPairSentence(facts, series[i], series[j])));
      }
    }
    if (items.length <= MAX_LISTED_PAIRS) return items;

    const remaining = items.length - MAX_LISTED_PAIRS;
    return [
      ...items.slice(0, MAX_LISTED_PAIRS),
      item([
        text(
          `The remaining ${radarCountWord(remaining)} pairs are not listed; the data table has every value.`
        ),
      ]),
    ];
  }

  // ---------------------------------------------------------------------
  // The Data Table - rule RD9
  // ---------------------------------------------------------------------

  /**
   * The data table - RD9. THE ONLY BUILDER OF IT.
   *
   * One column per DRAWN series (a series the picture omits has no column),
   * one row per axis. Labels are unquoted author runs.
   *
   * @param {Object} facts - From `measure`
   * @returns {Object} A table block (model table). Its columns are the corner
   *   cell then one per drawn series, and every row has a row header, so each
   *   row holds `columns.length - 1` cells.
   */
  function buildDataTable(facts) {
    const { text, author, table } = modelCore();
    const caption =
      facts.title === null
        ? [text("Data table for this radar chart")]
        : [text("Data table for: "), author(String(facts.title))];

    return table({
      caption,
      columns: [
        [text("Axis")],
        ...facts.tabled.map((curve) =>
          cellName(curve.label, UNLABELLED_SERIES, facts.curves.indexOf(curve) + 1)
        ),
      ],
      rows: facts.axes.map((axis, index) => ({
        header: cellName(axis.label, UNLABELLED_AXIS, index + 1),
        cells: facts.tabled.map((curve) => [text(numberText(curve.values[index]))]),
      })),
    });
  }

  /**
   * The radar chart's description as a model: the short sentence as runs and
   * the Overview, Series, Comparison (two or more compared series) and Data
   * Table (at least one tabled series) sections. Author text (the title, the
   * axis and series labels) enters only as author runs, raw; the renderer
   * escapes it once.
   *
   * @param {Object} facts - The radar module's measured facts
   * @returns {Object} A DescriptionModel (see model.js)
   */
  function buildRadarModel(facts) {
    const { text, paragraph, list, section, description } = modelCore();

    const overview = [
      paragraph(buildOpeningSentence(facts)),
      paragraph(buildAxesSentence(facts)),
    ];
    const scale = buildScaleSentence(facts);
    if (scale !== null) overview.push(paragraph([text(scale)]));
    overview.push(paragraph([text(buildGridSentence(facts))]));

    const sections = [
      section(overview, { heading: [text("Overview")] }),
      section(
        [
          facts.K === 0
            ? paragraph([text("No series is plotted.")])
            : list(
                facts.curves.map((curve) => buildSeriesItem(facts, curve)),
                { ordered: true }
              ),
        ],
        { heading: [text("Series")] }
      ),
    ];

    if (facts.compared.length >= 2) {
      sections.push(
        section([list(comparisonItems(facts))], { heading: [text("Comparison")] })
      );
    }

    if (facts.tabled.length > 0) {
      sections.push(section([buildDataTable(facts)], { heading: [text("Data Table")] }));
    }

    return description(buildShortRuns(facts), sections);
  }

  /**
   * The radar short tier, both forms: the plain sentence and its HTML escape.
   * @param {Object} facts - The radar module's measured facts
   * @returns {{html: string, text: string}} The short description
   */
  function buildRadarShort(facts) {
    const model = buildRadarModel(facts);

    // The PLAIN tier is the flattened runs: raw author text, never escaped
    // (it feeds the SVG aria-label and the textContent fallback). The HTML tier
    // is escaped once, by the renderer, over the whole sentence.
    return {
      html: renderCore().renderHtml(model, renderCore().PROFILES.lines).shortHTML,
      text: modelCore().flatten(model.short),
    };
  }

  /**
   * The radar detailed tier: the Overview, Series, Comparison and Data Table
   * sections, newline-joined by the `lines` profile.
   * @param {Object} facts - The radar module's measured facts
   * @returns {string} The detailed HTML fragment
   */
  function buildRadarDetailed(facts) {
    const model = buildRadarModel(facts);
    return renderCore().renderHtml(model, renderCore().PROFILES.lines).detailed;
  }

  logInfo("Chart builders initialised successfully");

  // What the describers call. The xychart describer reaches buildShortOpening to
  // buildTable; the pie describer buildPieShort and buildPieDetailed (thin
  // wrappers over buildPieModel, which returns a DescriptionModel); the radar
  // describer buildRadarShort and buildRadarDetailed (thin wrappers over
  // buildRadarModel, which returns a DescriptionModel). The other builders are
  // reached only through these, and stay private until another describer needs
  // them.
  const api = {
    TIERS,
    escapeText,
    buildShortOpening,
    buildTakeaway,
    buildConstruction,
    buildInsights,
    buildTable,
    buildPieModel,
    buildPieShort,
    buildPieDetailed,
    buildRadarModel,
    buildRadarShort,
    buildRadarDetailed,
  };

  root.ChartDescribeCharts = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
