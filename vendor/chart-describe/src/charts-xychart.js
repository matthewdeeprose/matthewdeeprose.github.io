/**
 * Chart description builders: the XY chart family.
 *
 * This file exports buildXychartModel and keeps everything that function
 * needs. It describes bar charts and line charts, including charts that mix
 * both. It exports itself as window.ChartDescribeXychart. In Node it also sets
 * module.exports.
 *
 * A description has a short sentence and up to three sections: Chart
 * Construction, Key Insights and Data Table.
 *
 * The file reads the helpers in charts-shared.js when a function runs, never
 * when the file loads. It needs text.js, model.js and charts-shared.js to load
 * before it. charts.js is the front door that callers use.
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
      console.error(`[Chart Describe Xychart] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Chart Describe Xychart] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Chart Describe Xychart] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Chart Describe Xychart] DEBUG: ${message}`, ...args);
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

  // ---------------------------------------------------------------------
  // The shared helpers, resolved AT CALL TIME and never cached
  // ---------------------------------------------------------------------
  //
  // A module-scope capture would read undefined permanently if this file ran
  // before charts-shared.js. Resolving at call time costs one property read and cannot
  // go stale, so load order between the chart-describe files cannot matter.

  /**
   * ChartDescribeChartsShared: from the global when present, otherwise (Node only) from
   * ./charts-shared.js. Throws if neither exists, so a missing file fails loudly rather
   * than returning wrong text.
   * @returns {Object} ChartDescribeChartsShared
   */
  function shared() {
    if (root.ChartDescribeChartsShared) return root.ChartDescribeChartsShared;
    if (typeof require === "function") return require("./charts-shared.js");
    throw new Error("ChartDescribeChartsShared is not loaded");
  }

  /** The shared `countWord` (charts-shared.js), resolved at call time. */
  function countWord(value) {
    return shared().countWord(value);
  }

  /** The shared `capitalise` (charts-shared.js), resolved at call time. */
  function capitalise(text) {
    return shared().capitalise(text);
  }

  /** The shared `modelCore` (charts-shared.js), resolved at call time. */
  function modelCore() {
    return shared().modelCore();
  }

  /** The shared `joinRuns` (charts-shared.js), resolved at call time. */
  function joinRuns(entries) {
    return shared().joinRuns(entries);
  }

  // ---------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------

  const SERIES_KINDS = Object.freeze({ BAR: "bar", LINE: "line" });
  const AXIS_KINDS = Object.freeze({ BAND: "band", RANGE: "range" });
  // Caller options for the short opening and the Chart Construction section.
  // The picture may draw a series name, for example in a legend. The option is
  // ON unless a caller whose picture does not draw a series name says
  // otherwise.
  const DEFAULT_DESCRIBE_OPTIONS = Object.freeze({ drawsSeriesName: true });
  // The comma that closes the span clause (", from "A" to "B"") when the
  // sentence has no y-axis descriptor and so merges into one sentence.
  const MERGED_SPAN_CLOSE = ",";
  const ORIENTATIONS = Object.freeze({
    VERTICAL: "vertical",
    HORIZONTAL: "horizontal",
  });

  // The trend vocabulary is Chart.js's six strings at its own 70% threshold.
  // This file quotes them rather than rewording them, so the wording matches
  // Chart.js.
  const TRENDS = Object.freeze({
    UP: "consistently increasing",
    DOWN: "consistently decreasing",
    STABLE: "stable",
    UP_NOISY: "generally increasing with fluctuations",
    DOWN_NOISY: "generally decreasing with fluctuations",
    UP_STEPPED: "generally increasing",
    DOWN_STEPPED: "generally decreasing",
    NONE: "fluctuating with no clear trend",
    LEVEL_RISE: "mostly level, apart from a large rise",
    LEVEL_FALL: "mostly level, apart from a large fall",
    LEVEL_SPIKE: "mostly level, apart from a large spike",
    LEVEL_DIP: "mostly level, apart from a large dip",
    LEVEL_RAISED: "mostly level, apart from a raised stretch",
    LEVEL_RAISED_MANY: "mostly level, apart from raised stretches",
    LEVEL_LOWERED: "mostly level, apart from a lowered stretch",
    LEVEL_LOWERED_MANY: "mostly level, apart from lowered stretches",
    LEVEL_RAISED_POINTS: "mostly level, apart from raised points",
    LEVEL_LOWERED_POINTS: "mostly level, apart from lowered points",
    LEVEL_APART: "mostly level, apart from raised and lowered stretches",
    LEVEL_APART_POINTS: "mostly level, apart from raised and lowered points",
    LEVEL_APART_RAISED_POINTS: "mostly level, apart from raised points and lowered stretches",
    LEVEL_APART_LOWERED_POINTS: "mostly level, apart from raised stretches and lowered points",
    // The two mixed forms with the count agreeing on the side that has exactly one: a raised POINT, a lowered STRETCH.
    LEVEL_APART_ONE_POINT_ONE_STRETCH: "mostly level, apart from a raised point and a lowered stretch",
    LEVEL_APART_ONE_POINT_STRETCHES: "mostly level, apart from a raised point and lowered stretches",
    LEVEL_APART_POINTS_ONE_STRETCH: "mostly level, apart from raised points and a lowered stretch",
    LEVEL_APART_ONE_STRETCH_ONE_POINT: "mostly level, apart from a raised stretch and a lowered point",
    LEVEL_APART_ONE_STRETCH_POINTS: "mostly level, apart from a raised stretch and lowered points",
    LEVEL_APART_STRETCHES_ONE_POINT: "mostly level, apart from raised stretches and a lowered point",
    RISES: "rising",
    FALLS: "falling",
    UNKNOWN: "unknown",
  });

  // This table AVOIDS A CHART.JS DEFECT. Chart.js writes `shows a ${trend} trend`
  // for every member of the vocabulary above, which produces "shows a generally
  // decreasing with fluctuations trend" and "shows a fluctuating with no clear
  // trend trend". This code reorders the clause for each trend instead, which
  // is why it is a table and not one template. A series that turns once uses
  // TURN_CLAUSE instead of the three noisy or unclear entries below.
  const TREND_CLAUSE = Object.freeze({
    [TRENDS.UP]: "shows a consistently increasing trend",
    [TRENDS.DOWN]: "shows a consistently decreasing trend",
    [TRENDS.STABLE]: "shows a stable trend",
    [TRENDS.UP_NOISY]: "shows a generally increasing trend, with fluctuations",
    [TRENDS.DOWN_NOISY]:
      "shows a generally decreasing trend, with fluctuations",
    [TRENDS.UP_STEPPED]: "shows a generally increasing trend",
    [TRENDS.DOWN_STEPPED]: "shows a generally decreasing trend",
    [TRENDS.NONE]: "fluctuates with no clear trend",
    [TRENDS.LEVEL_RISE]: "is mostly level, apart from a large rise",
    [TRENDS.LEVEL_FALL]: "is mostly level, apart from a large fall",
    [TRENDS.LEVEL_SPIKE]: "is mostly level, apart from a large spike",
    [TRENDS.LEVEL_DIP]: "is mostly level, apart from a large dip",
    [TRENDS.LEVEL_RAISED]: "is mostly level, apart from a raised stretch",
    [TRENDS.LEVEL_RAISED_MANY]: "is mostly level, apart from raised stretches",
    [TRENDS.LEVEL_LOWERED]: "is mostly level, apart from a lowered stretch",
    [TRENDS.LEVEL_LOWERED_MANY]: "is mostly level, apart from lowered stretches",
    [TRENDS.LEVEL_RAISED_POINTS]: "is mostly level, apart from raised points",
    [TRENDS.LEVEL_LOWERED_POINTS]: "is mostly level, apart from lowered points",
    [TRENDS.LEVEL_APART]: "is mostly level, apart from raised and lowered stretches",
    [TRENDS.LEVEL_APART_POINTS]: "is mostly level, apart from raised and lowered points",
    [TRENDS.LEVEL_APART_RAISED_POINTS]: "is mostly level, apart from raised points and lowered stretches",
    [TRENDS.LEVEL_APART_LOWERED_POINTS]: "is mostly level, apart from raised stretches and lowered points",
    [TRENDS.LEVEL_APART_ONE_POINT_ONE_STRETCH]: "is mostly level, apart from a raised point and a lowered stretch",
    [TRENDS.LEVEL_APART_ONE_POINT_STRETCHES]: "is mostly level, apart from a raised point and lowered stretches",
    [TRENDS.LEVEL_APART_POINTS_ONE_STRETCH]: "is mostly level, apart from raised points and a lowered stretch",
    [TRENDS.LEVEL_APART_ONE_STRETCH_ONE_POINT]: "is mostly level, apart from a raised stretch and a lowered point",
    [TRENDS.LEVEL_APART_ONE_STRETCH_POINTS]: "is mostly level, apart from a raised stretch and lowered points",
    [TRENDS.LEVEL_APART_STRETCHES_ONE_POINT]: "is mostly level, apart from raised stretches and a lowered point",
    [TRENDS.RISES]: "rises",
    [TRENDS.FALLS]: "falls",
  });

  // Chart.js's rankingWords, extended past "ninth" with a suffix rule. On a
  // numeric-range axis the describer never invents an x position. It locates
  // each point by an ordinal that the describer owns ("the third point"), and
  // a chart of ten points needs an ordinal past "ninth".
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

  // The statistics tier of the takeaway starts at five values. This matches
  // Chart.js's minDataPointsForAdvanced.
  const STATISTICS_MIN_POINTS = 5;

  // From this many tied positions, the list collapses to a count. A list such
  // as "at the first, third, fifth and eighth points" is more than a listener
  // can hold in mind. This threshold is a judgement about listening, not a
  // measured value.
  const TIED_POSITION_COLLAPSE_AT = 4;
  // Every mention of a value the code holds and the picture does not draw carries this note, word for word.
  const UNDRAWN_NOTE = "written in the code, not drawn in the picture";
  // Past this many undrawn values the sentence gives a count and not the values.
  const UNDRAWN_LIST_MAX = 3;

  // Chart.js's inner guard for the cyclic and start-to-end sentences.
  const LINE_ADVANCED_MIN_POINTS = 4;

  // Chart.js's own thresholds, quoted.
  const TREND_DOMINANCE = 0.7;
  const HIGH_POINT_RATIO = 1.5;
  const LOW_POINT_RATIO = 0.5;
  const SKEW_TOLERANCE = 0.2;
  const OVERALL_CHANGE_MIN_PERCENT = 50;
  // With a negative value in the series, the average must be at least this share of the largest absolute value
  // before a value is called a percentage above it (the signs cancel, and the average stops meaning "typical").
  const MIXED_SIGN_MEAN_MIN_SHARE = 0.25;
  // A start smaller than this share of the series' largest absolute value is "near zero".
  const NEAR_ZERO_START_SHARE = 0.01;

  // The fallback words for a band axis. The describer uses them when the author
  // declared no axis title and the label-type detector below found no shape
  // that every label fits.
  const FALLBACK_NOUN = Object.freeze({
    singular: "Category",
    plural: "categories",
  });
  const RANGE_POINT_NOUN = "Point";
  const FALLBACK_VALUE_HEADER = "Value";

  // The two nouns a LABEL-LESS x position can take, keyed by the kind
  // `pointReferencePartRuns` returns. They are deliberately different words.
  // "Point" is for a numeric-range axis that declares no positions at all.
  // "Position" is for an index past the end of a band axis's declared labels.
  // Do not merge them. Merging would use one word for two different things,
  // and that confusion is the defect that "position" exists to prevent.
  const POSITION_NOUN = Object.freeze({
    ordinal: Object.freeze({ singular: "Point", plural: "points" }),
    position: Object.freeze({ singular: "Position", plural: "positions" }),
  });

  // The cell text for a position that a series has no value for. It is words
  // and not an empty cell, because silence is a fault: a reader who meets
  // `<td></td>` cannot tell whether the author recorded a zero, recorded
  // nothing, or the description dropped the value.
  const NO_VALUE_TEXT = "no value";

  // The two grammatical contexts that a position reference is rendered into.
  // A reference with nothing to disambiguate renders identically in both, so a
  // chart whose labels are unique reads the same in either.
  const REFERENCE_STYLE = Object.freeze({
    STANDALONE: "standalone",
    PARENTHETICAL: "parenthetical",
  });

  // The two description tiers. A formatter can differ between them without a
  // bare boolean at the call site.
  const TIERS = Object.freeze({ SHORT: "short", DETAILED: "detailed" });

  // An AUTHOR value with more decimal places than this is spoken rounded, and
  // only in the short tier. The short tier is the SVG aria-label and the
  // visible figcaption, where a screen reader announces every digit in turn.
  // The detailed tier and the table keep the author's value verbatim, so the
  // author's number stays exact wherever the reader can actually read it.
  const SHORT_TIER_MAX_DECIMALS = 4;
  const SHORT_TIER_ROUNDING = 2;
  // A rounded value under this keeps two significant figures instead of two decimals: two decimals leave it one figure or none, so
  // 0.0050001 would read "about 0.01", twice its size.
  const SHORT_TIER_TWO_FIGURES_BELOW = 0.1;
  const SHORT_TIER_SMALL_FIGURES = 2;

  // The most decimals that a rounded value may be given back to keep it true
  // (an average inside the range, a range whose two ends differ).
  const MAX_RESTORED_DECIMALS = 15;
  // The most decimals any double can be written with: 5e-324, the smallest, is 324 places, and its 17 figures reach 340. A rounded end
  // beside a typed end is written to as many decimals as it needs, so a typed end below 1e-15 is never matched on a coarser end.
  const MAX_DOUBLE_DECIMALS = 340;
  // A double carries 17 significant figures.
  const MAX_SIGNIFICANT_FIGURES = 17;
  // A derived whole number is spoken to this many significant figures (a double's last two are rounding noise).
  const SPOKEN_SIGNIFICANT_FIGURES = 15;
  // ...from here up, where JavaScript itself stops writing digits and numberDigits pads the double's 17 figures with zeros.
  const PADDED_DIGITS_FROM = 1e21;
  // A mean that bands to 0 but is not 0 is spoken to this many significant figures.
  const SMALL_MEAN_FIGURES = 2;
  // How the takeaway's range sentence opens. The detailed "Average value:" bullet follows that sentence's average where the sentence is printed.
  const RANGE_SENTENCE_OPENING = "Values range from ";
  // Beside two typed ends, an average spoken more than this share of the range away from the mean is written to the ends' decimals. A
  // twentieth is also the furthest the ends' own decimals can leave it in a range ten last-place units wide (0.095 to 0.105).
  const MEAN_MISPLACED_BEYOND = 1 / 20;
  // Below the smallest normal double a double keeps fewer than 53 bits, so a figure typed back through Number() is a different value.
  const SMALLEST_NORMAL_DOUBLE = 2.2250738585072014e-308;
  // Below this a double (spacing 4.9e-324) is under 200 steps from zero, so it has fewer than three reliable figures and a mean cannot be read from it.
  const DOUBLE_TOO_COARSE_BELOW = 1e-322;

  // A series whose values are all finite is added exactly (exactSeriesSum), so its mean and its comparisons carry no float noise and no
  // bound is needed. Only a series holding a value that is not finite (outside the stated input) is left to the compensated sum, and a
  // typed decimal is stored to within half a unit in the last place of its own size, so a mean of n of them is wrong by at most about
  // this x the largest absolute value. That bound is all floatNoiseBound still carries.
  const FLOAT_ERROR_PER_VALUE = Number.EPSILON;
  // A mean is divided with this many bits of quotient, so one rounding to a double is the only rounding (see exactMean).
  const MEAN_QUOTIENT_BITS = 64n;
  // A double is scaled back by a power of two in steps no larger than this, because 2 ** 1024 is already Infinity.
  const MEAN_SCALE_STEP_BITS = 1000;
  // How a value is written by String(): optional sign, digits, optional decimals, optional exponent (1e-7, 1.5e+300).
  const WRITTEN_NUMBER = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/;
  const DECIMAL_BASE = 10n;
  // Half a step, in units of the place after the one a value is written to.
  const HALF_STEP_UNITS = 5n;
  // A remainder of at least half the divisor rounds away from zero: twice the remainder reaches the divisor.
  const ROUND_AWAY_FACTOR = 2n;
  // A ratio becomes a percentage by this factor.
  const PERCENT_FACTOR = 100n;

  /**
   * The sum of a list of numbers, with Neumaier's compensation: the low part that each addition
   * drops is kept and added back at the end, so a small value beside a huge one is not lost
   * (1e16 + 1 + 1 gives 10000000000000002, not 1e16). A sum that is not finite is returned exactly
   * as a plain sum gives it, so an overflow is still seen as one.
   * @param {number[]} values - The numbers to add
   * @returns {number} The sum
   */
  function compensatedSum(values) {
    let sum = 0;
    let compensation = 0;
    for (const value of values) {
      const next = sum + value;
      // The low-order part that this addition rounded away, from whichever operand is larger.
      compensation +=
        Math.abs(sum) >= Math.abs(value) ? sum - next + value : value - next + sum;
      sum = next;
    }
    return Number.isFinite(sum) ? sum + compensation : sum;
  }

  /**
   * The most that the mean of these values can be wrong by, from float error alone. Used only for a series with a value that is not
   * finite (outside the stated input), which exactSeriesSum cannot add; every other series is exact and needs no bound.
   * @param {Array<number>} values - The values that were averaged
   * @returns {number} The bound
   */
  function floatNoiseBound(values) {
    const largest = values.reduce((most, value) => Math.max(most, Math.abs(value)), 0);
    return FLOAT_ERROR_PER_VALUE * largest;
  }

  /**
   * The exact sum of a series of finite numbers, from the digits each is written with, as a big integer count of units of 10 ** -places.
   * A whole number is added as the exact double it is (BigInt(value), so 2 ** 100 is its true 31 digits); a decimal is added as the digits
   * String() writes for it (0.1 is one unit at one place, never the double's 55-digit expansion), which is how the person who typed it
   * wrote it. Every value is scaled to the finest place any of them uses and the sum is taken as a BigInt, so a decimal beside a huge
   * whole number is not lost (1e16 + 0.5 is exactly 10000000000000000.5). A value written in exponent form (1e-7, 1.5e+300) is parsed
   * by its mantissa and exponent, and never falls back. A series holding NaN or an infinity has no digits to add and gives null: it keeps
   * the compensated sum and the noise bound, as before.
   * @param {Array<number>} values - The numbers to add
   * @returns {{units: bigint, places: number}|null} The exact sum, or null
   */
  function exactSeriesSum(values) {
    if (!values.every(Number.isFinite)) return null;
    const terms = values.map((value) => {
      if (Number.isInteger(value)) return { units: BigInt(value), exponent: 0 };
      const written = WRITTEN_NUMBER.exec(String(value));
      if (written === null) throw new Error(`xychart: cannot read the digits of ${String(value)}`);
      const [, sign, whole, fraction = "", exponent = "0"] = written;
      const units = BigInt(whole + fraction);
      return { units: sign === "-" ? -units : units, exponent: Number(exponent) - fraction.length };
    });
    const finest = terms.reduce((least, term) => Math.min(least, term.exponent), 0);
    let total = 0n;
    for (const term of terms) total += term.units * DECIMAL_BASE ** BigInt(term.exponent - finest);
    return { units: total, places: -finest };
  }

  /**
   * Whether two finite values lie closer together than one unit of a decimal place, from the digits they are written with (never the
   * doubles' difference, which puts 0.00175 - 0.00165 a hair under 0.0001).
   * @param {number} low - The lower value
   * @param {number} high - The higher value
   * @param {number} place - The decimal place (3 is thousandths)
   * @returns {boolean} True when high - low is under 10 ** -place
   */
  function narrowerThanPlace(low, high, place) {
    const width = exactSeriesSum([high, -low]);
    return width.units * DECIMAL_BASE ** BigInt(place) < DECIMAL_BASE ** BigInt(width.places);
  }

  /**
   * Whether the sum of one series over its count is higher than (1), equal to (0) or lower than (-1) another's. Cross-multiplied as big
   * integers (unitsA x countB x 10 ** placesB against unitsB x countA x 10 ** placesA), never divided, so it has no cap on digits.
   * @param {{units: bigint, places: number}} one - The exact sum of the first series
   * @param {number} oneCount - How many values it has
   * @param {{units: bigint, places: number}} other - The exact sum of the second
   * @param {number} otherCount - How many values it has
   * @returns {number} 1, 0 or -1
   */
  function compareExactMeans(one, oneCount, other, otherCount) {
    const mine = one.units * BigInt(otherCount) * DECIMAL_BASE ** BigInt(other.places);
    const theirs = other.units * BigInt(oneCount) * DECIMAL_BASE ** BigInt(one.places);
    return mine > theirs ? 1 : mine < theirs ? -1 : 0;
  }

  /**
   * The mean of a series as a double: the exact sum divided by the count and rounded ONCE (to nearest, ties to even), so the mean is
   * the nearest double to the true one. The quotient is taken with 64 bits and a sticky low bit, so the one rounding is Number(bigint)'s
   * own; the power-of-two scale back is exact (in steps, so a very small mean does not meet 2 ** 1024). A mean in the subnormal range
   * (below about 2.2e-308) is rounded a second time by that scale, which no chart here reaches.
   * @param {{units: bigint, places: number}} sum - The exact sum
   * @param {number} count - How many values
   * @returns {number} The mean
   */
  function exactMean(sum, count) {
    if (sum.units === 0n) return 0;
    const negative = sum.units < 0n;
    const top = negative ? -sum.units : sum.units;
    const divisor = BigInt(count) * DECIMAL_BASE ** BigInt(sum.places);
    const have = BigInt(top.toString(2).length) - BigInt(divisor.toString(2).length);
    const shift = have < MEAN_QUOTIENT_BITS ? MEAN_QUOTIENT_BITS - have : 0n;
    const scaled = top << shift;
    const sticky = scaled % divisor === 0n ? 0n : 1n;
    let mean = Number((scaled / divisor) | sticky);
    for (let left = Number(shift); left > 0; left -= MEAN_SCALE_STEP_BITS) {
      mean /= 2 ** Math.min(left, MEAN_SCALE_STEP_BITS);
    }
    return negative ? -mean : mean;
  }

  /**
   * An exact value (a sum over a count) written to a number of decimals and rounded HALF AWAY FROM ZERO from its exact digits, never from
   * a double: 0.075 and 1.005 are stored a hair under the tie and 0.545 a hair over it, so a double rounds the first two down and the third
   * up, where the person who wrote the digits sees one tie. A remainder of half the divisor or more goes away from zero, so 0.545 is 0.55,
   * -0.545 is -0.55 and 0.075 is 0.08. The sign of a negative value is kept when it rounds to zero (as toFixed keeps it).
   * @param {{sum: {units: bigint, places: number}, count: number}} exact - The exact sum and how many values it covers
   * @param {number} decimals - Decimal places
   * @returns {string} The value in digits
   */
  function exactToFixed(exact, decimals) {
    const negative = exact.sum.units < 0n;
    const top = negative ? -exact.sum.units : exact.sum.units;
    const divisor = BigInt(exact.count) * DECIMAL_BASE ** BigInt(exact.sum.places);
    const scaled = top * DECIMAL_BASE ** BigInt(decimals);
    let quotient = scaled / divisor;
    if ((scaled % divisor) * ROUND_AWAY_FACTOR >= divisor) quotient += 1n;
    const digits = quotient.toString().padStart(decimals + 1, "0");
    const written = decimals === 0 ? digits : `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
    return negative ? `-${written}` : written;
  }

  /**
   * An exact value written to a number of significant figures, rounded half away from zero from its exact digits (exactToFixed says why).
   * @param {{sum: {units: bigint, places: number}, count: number}} exact - The exact sum and how many values it covers
   * @param {number} figures - Significant figures
   * @returns {string} The value in digits
   */
  function exactToPrecision(exact, figures) {
    const negative = exact.sum.units < 0n;
    const top = negative ? -exact.sum.units : exact.sum.units;
    if (top === 0n) return "0";
    const divisor = BigInt(exact.count) * DECIMAL_BASE ** BigInt(exact.sum.places);
    // The power of ten the value sits above: 10 ** place <= value < 10 ** (place + 1). The digit counts put it within one of the answer.
    const atLeast = (power) => (power >= 0 ? top >= divisor * DECIMAL_BASE ** BigInt(power) : top * DECIMAL_BASE ** BigInt(-power) >= divisor);
    let place = top.toString().length - divisor.toString().length;
    if (!atLeast(place)) place -= 1;
    const decimals = figures - 1 - place;
    if (decimals >= 0) return exactToFixed(exact, decimals);
    // Fewer figures than the whole part holds: round to a multiple of a power of ten and pad with zeros.
    const step = divisor * DECIMAL_BASE ** BigInt(-decimals);
    let quotient = top / step;
    if ((top % step) * ROUND_AWAY_FACTOR >= step) quotient += 1n;
    return `${negative ? "-" : ""}${quotient}${"0".repeat(-decimals)}`;
  }

  /**
   * How far the highest or lowest value lies from the average, as a percentage of the average, rounded HALF AWAY FROM ZERO from the exact
   * digits to a whole number. `Math.round` on the double ratio reads [1.9, -0.3] as 137% where the exact figure is 137.5, which rounds to 138.
   * @param {Object} stats - Statistics from computeStatistics (a positive exact sum is needed)
   * @param {number} value - The highest value (above the average) or the lowest (below it)
   * @param {boolean} above - True for "above the average", false for "below"
   * @returns {string|null} The whole percentage in digits, or null where the series has no exact digits (the double is used then)
   */
  function exactPercentFromAverage(stats, value, above) {
    const mean = meanExactOf(stats);
    const typed = typedExactOf(value);
    if (mean === null || typed === null || mean.sum.units <= 0n) return null;
    // mean = S / (count * 10 ** sumPlaces) and value = V / 10 ** valuePlaces, so (value - mean) / mean is (V * count * 10 ** sumPlaces
    // - S * 10 ** valuePlaces) / (S * 10 ** valuePlaces).
    const average = mean.sum.units * DECIMAL_BASE ** BigInt(typed.sum.places);
    const scaledValue = typed.sum.units * BigInt(mean.count) * DECIMAL_BASE ** BigInt(mean.sum.places);
    const gap = above ? scaledValue - average : average - scaledValue;
    return exactToFixed({ sum: { units: gap * PERCENT_FACTOR, places: 0 }, count: average }, 0);
  }

  /**
   * The size of the change from the first value to the last, as a percentage of the first, to one decimal and with no sign, rounded HALF
   * AWAY FROM ZERO from the exact digits (`toFixed(1)` on the double reads some exact ties down).
   * @param {number} first - The first value (not zero)
   * @param {number} last - The last value
   * @returns {string|null} The percentage in digits, or null where either value is not finite
   */
  function exactPercentChange(first, last) {
    const start = typedExactOf(first);
    const end = typedExactOf(last);
    if (start === null || end === null) return null;
    const places = Math.max(start.sum.places, end.sum.places);
    const startUnits = start.sum.units * DECIMAL_BASE ** BigInt(places - start.sum.places);
    const endUnits = end.sum.units * DECIMAL_BASE ** BigInt(places - end.sum.places);
    const change = endUnits - startUnits;
    const size = (change < 0n ? -change : change) * PERCENT_FACTOR;
    return exactToFixed({ sum: { units: size, places: 0 }, count: startUnits < 0n ? -startUnits : startUnits }, 1);
  }

  // A bare four-digit label is called a year only inside this span. A run such
  // as 1000, 2000, 3000 is a set of bins, and the neutral noun is the true one.
  const YEAR_LABEL_MIN = 1800;
  const YEAR_LABEL_MAX = 2200;

  // The days and months that a dotted, slashed or hyphenated date can hold.
  const DATE_DAY_MAX = 31;
  const DATE_MONTH_MAX = 12;

  // The noun that a COUNT OF VALUES takes, so that the mismatch sentence reads
  // "one value" and not "one values". It goes through `countedNoun`, so the
  // choice of singular or plural stays in one place.
  const VALUE_NOUN = Object.freeze({ singular: "Value", plural: "values" });

  // ---------------------------------------------------------------------
  // Label-type detection
  // ---------------------------------------------------------------------
  //
  // The first six shapes come from Chart.js's own detector. The rest belong to
  // this code. The detector uses EXACT PATTERNS ONLY, and it improves the
  // noun only when EVERY label fits one shape. A single label that does not
  // match sends the whole axis back to Category and categories, because a
  // noun that is half right is worse than a neutral one. An author's x-axis
  // title always wins, and this detector is not consulted at all in that case.
  // So the guess can only ever rename a noun that the describer itself owns.
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

  /**
   * A split year: two years in a row, such as 2020-21, 2020/21 or 2020-2021.
   * The second year must follow the first, so 2024-01 (a month) is not one.
   * @param {string} lower - A label, lower-cased
   * @returns {boolean} True when the label is a split year
   */
  function isSplitYear(lower) {
    const found = /^(\d{4})[-/](\d{2}(?:\d{2})?)$/.exec(lower);
    if (!found) return false;
    const first = Number(found[1]);
    const second = Number(found[2]);
    const next = found[2].length === 2 ? (first + 1) % 100 : first + 1;
    return second === next;
  }

  /**
   * A numeric date such as 3/4/24, 03-04-2024 or 3.4.2024. The day and the
   * month must be possible. A dotted date needs a four-digit year, because
   * 1.2.10 is as likely to be a version number as a date.
   * @param {string} lower - A label, lower-cased
   * @returns {boolean} True when the label reads as a numeric date
   */
  function isNumericDate(lower) {
    const found = /^(\d{1,2})([/\-.])(\d{1,2})([/\-.])(\d{2}(?:\d{2})?)$/.exec(
      lower
    );
    if (!found) return false;
    const first = Number(found[1]);
    const second = Number(found[3]);
    if (first < 1 || second < 1) return false;
    if (first > DATE_DAY_MAX || second > DATE_DAY_MAX) return false;
    if (Math.min(first, second) > DATE_MONTH_MAX) return false;
    const dotted = found[2] === "." || found[4] === ".";
    return !dotted || found[5].length === 4;
  }

  // A time of day: hours 0 to 23 (1 to 12 beside am or pm), minutes and seconds 0 to 59.
  function isClockTime(lower) {
    const found = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s?(am|pm))?$/.exec(lower);
    if (found) {
      const hour = Number(found[1]);
      const hourOk = found[4] ? hour >= 1 && hour <= 12 : hour <= 23;
      return hourOk && Number(found[2]) <= 59 && (found[3] === undefined || Number(found[3]) <= 59);
    }
    const bare = /^(\d{1,2})\s?(?:am|pm)$/.exec(lower);
    return !!bare && Number(bare[1]) >= 1 && Number(bare[1]) <= 12;
  }

  // An ISO date: a month from 1 to DATE_MONTH_MAX and a day from 1 to DATE_DAY_MAX.
  function isIsoDate(lower) {
    const found = /^\d{4}-(\d{2})-(\d{2})$/.exec(lower);
    if (!found) return false;
    const month = Number(found[1]);
    const day = Number(found[2]);
    return month >= 1 && month <= DATE_MONTH_MAX && day >= 1 && day <= DATE_DAY_MAX;
  }

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
      test: (label) => isClockTime(label.toLowerCase()),
    },
    {
      singular: "Date",
      plural: "dates",
      test: (label) => {
        const lower = label.toLowerCase();
        if (isIsoDate(lower)) return true;
        if (isNumericDate(lower)) return true;
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
        if (/^\d{4}$/.test(lower)) {
          const year = Number(lower);
          return year >= YEAR_LABEL_MIN && year <= YEAR_LABEL_MAX;
        }
        if (isSplitYear(lower)) return true;
        if (/^fy\s?\d{2}(?:\d{2})?(?:[-/]\d{2}(?:\d{2})?)?$/.test(lower))
          return true;
        return false;
      },
    },
  ]);

  /**
   * The noun that a band axis's labels earn from label-type detection.
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
  // Numbers
  // ---------------------------------------------------------------------

  /**
   * An AUTHOR value, spoken verbatim as digits. The author's own number is
   * never rescaled or rounded. Only DERIVED values take the magnitude rule
   * below.
   * @param {number} value - A value read from the source
   * @returns {string} The value as digits
   */
  function formatAuthorValue(value) {
    return numberDigits(value);
  }

  /**
   * A number in digits: exponent form is written out, because a screen reader says "2e-7" as letters and symbols.
   * The same digit form as the radar family's `numberText`, nothing rounded.
   * @param {number} value - A number
   * @returns {string} Its digits
   */
  function numberDigits(value) {
    const written = String(value);
    // JavaScript switches to exponent form at 1e21 and above, and at 1e-7 and below.
    const parts = /^(-?)(\d+)(?:\.(\d+))?e([+-]\d+)$/.exec(written);
    if (!parts) return written;
    const [, sign, whole, fraction = "", exponent] = parts;
    const digits = whole + fraction;
    const point = whole.length + Number(exponent);
    if (point <= 0) return `${sign}0.${"0".repeat(-point)}${digits}`;
    if (point >= digits.length) return sign + digits + "0".repeat(point - digits.length);
    return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
  }

  /**
   * An author value as the given TIER speaks it.
   *
   * The DETAILED tier and the table are unchanged and verbatim, so the
   * author's number stays exact wherever the reader can actually read it. The
   * SHORT tier is the SVG `aria-label` and the visible figcaption, and a screen
   * reader announces it digit by digit. `Values range from 2.7857142857 to 4.8`
   * spends eleven spoken digits on one endpoint. A caption like that has
   * stopped being a caption and become a data dump.
   *
   * The word "about" is not decoration. A rounded value stated bare would be a
   * DIFFERENT number presented as the author's. The word makes the rounding
   * honest, which is why this is a choice for readability and not a silent
   * reformat.
   *
   * KNOWN LIMIT: a value in exponent notation (`1e-7`) has no
   * "." in its string form, so the function returns it verbatim.
   *
   * @param {string} tier - A TIERS member
   * @param {number} value - A value read from the source
   * @returns {string} The value as that tier speaks it
   */
  function formatAuthorValueForTier(tier, value) {
    if (tier !== TIERS.SHORT) return formatAuthorValue(value);
    const text = numberDigits(value);
    const point = text.indexOf(".");
    if (point === -1) return text;
    if (text.length - point - 1 <= SHORT_TIER_MAX_DECIMALS) return text;
    // A value under 0.1 keeps two significant figures instead of two decimals (0.0050001 is "about 0.005", not "about 0.01"), and so
    // never rounds to zero (0.00001 is "0.00001", not "about 0.00"). Where those figures ARE the typed digits (0.00001 typed to five
    // decimals) nothing was rounded, so there is no "about"; a longer typed value (0.0000123456) is still "about 0.000012".
    if (value !== 0 && Math.abs(value) < SHORT_TIER_TWO_FIGURES_BELOW) {
      const twoFigures = numberDigits(Number(figuresOf(value, SHORT_TIER_SMALL_FIGURES, typedExactOf(value))));
      return Number(twoFigures) === value ? twoFigures : `about ${twoFigures}`;
    }
    // The trailing zeros go ("about 4", not "about 4.00"), as they do from the widened ends, so one rounded end reads one way.
    return `about ${dropTrailingZeros(fixedDigitsOf(value, SHORT_TIER_ROUNDING, typedExactOf(value)))}`;
  }

  /**
   * Whether two values lie exactly half a step apart at a number of decimals, from the digits they are written with. One of them is then
   * half a step from a figure, and rounding it half away from zero prints a step twice as wide as the data ("0.34 to about 0.340001"
   * for 0.34 and 0.3400005), so such an end is printed as typed.
   * @param {number} low - The lower value
   * @param {number} high - The higher value
   * @param {number} decimals - The decimal places the ends would be written to
   * @returns {boolean} True when high - low is exactly 5 units of the place after `decimals`
   */
  function isHalfStepWide(low, high, decimals) {
    const width = exactSeriesSum([high, -low]);
    return width !== null && width.places === decimals + 1 && width.units === HALF_STEP_UNITS;
  }

  /**
   * One end of a range printed as typed beside the other rounded must not read as a wider, narrower or upside-down range than the data
   * holds ("0.0832 to about 0.083" for 0.0832 and 0.08349). The rounded end is written to at least as many decimals as the typed end
   * carries, and to enough decimals that it lies on the far side of the typed end ("0.0832 to about 0.0835"). Ranges where both ends
   * are typed, or both rounded, are returned as they are.
   * @param {number} min - The lowest value
   * @param {number} max - The highest value
   * @param {Object} ends - `{ min, max }`, both as text
   * @returns {Object} `{ min, max }`, both as text
   */
  function matchTypedEndFigures(min, max, ends) {
    const maxIsRounded = ends.max.startsWith("about ");
    if (ends.min.startsWith("about ") === maxIsRounded) return ends;
    const typedText = maxIsRounded ? ends.min : ends.max;
    const typedValue = maxIsRounded ? min : max;
    const roundedValue = maxIsRounded ? max : min;
    if (Math.abs(roundedValue) >= PADDED_DIGITS_FROM) return ends;
    const decimalsOf = (written) => (written.replace(/^about /, "").split(".")[1] || "").length;
    const first = Math.min(Math.max(decimalsOf(typedText), decimalsOf(maxIsRounded ? ends.max : ends.min)), MAX_DOUBLE_DECIMALS);
    for (let decimals = first; decimals <= MAX_DOUBLE_DECIMALS; decimals += 1) {
      const written = fixedDigitsOf(roundedValue, decimals, typedExactOf(roundedValue));
      const farSide = maxIsRounded ? Number(written) > typedValue : Number(written) < typedValue;
      if (!farSide) continue;
      const spoken = dropTrailingZeros(written);
      const rounded = Number(spoken) === roundedValue ? spoken : isHalfStepWide(Math.min(min, max), Math.max(min, max), decimals) ? numberDigits(roundedValue) : `about ${spoken}`;
      return maxIsRounded ? { min: ends.min, max: rounded } : { min: rounded, max: ends.max };
    }
    return ends;
  }

  /**
   * Whether the range two printed figures show is at most half as wide as the range of the data they stand for, from the digits each is
   * written with. Two ends rounded to different steps (0.095 and 0.1 either side of 0.1, where the step goes from 0.001 to 0.01) each
   * move inward, so a pair about one step wide can print at half its width ("about 0.095 to about 0.1" for 0.09468 to 0.10479).
   * @param {number} shownLow - The lower printed figure
   * @param {number} shownHigh - The higher printed figure
   * @param {number} low - The lowest value
   * @param {number} high - The highest value
   * @returns {boolean} True when the printed width is at most half the data's
   */
  function isAtMostHalfAsWide(shownLow, shownHigh, low, high) {
    const shown = exactSeriesSum([shownHigh, -shownLow]);
    const data = exactSeriesSum([high, -low]);
    if (shown === null || data === null) return false;
    return 2n * shown.units * DECIMAL_BASE ** BigInt(data.places) <= data.units * DECIMAL_BASE ** BigInt(shown.places);
  }

  /**
   * The decimals a short-tier end under 0.1 keeps for its two significant figures (0.0095 is four), and two for an end from 0.1 up.
   * @param {number} value - A value read from the source
   * @returns {number} The decimal places of the end's own step
   */
  function ownStepPlace(value) {
    if (value === 0 || Math.abs(value) >= SHORT_TIER_TWO_FIGURES_BELOW) return SHORT_TIER_ROUNDING;
    return (figuresOf(value, SHORT_TIER_SMALL_FIGURES, typedExactOf(value)).split(".")[1] || "").length;
  }

  /**
   * The two ends of a range as a tier speaks them, and then checked against the data: two rounded ends that print a range at most half as
   * wide as the data are written again, at the finer of their two steps. The two steps differ across a power of ten under 0.1 (0.001 below
   * 0.1 and 0.01 above it, 0.0001 below 0.01 and 0.001 above it), and each end rounds inward: 0.09468 to 0.10479 read "about 0.095 to about
   * 0.1", 0.005 for 0.0101, and 0.009468846 to 0.010478846 read "about 0.0095 to about 0.01". Half is where the widening leaves any pair
   * written at one step: a pair a whole step apart or more prints at more than half, so this check never asks for more than that gives.
   * @param {string} tier - A TIERS member
   * @param {number} min - The lowest value
   * @param {number} max - The highest value
   * @returns {Object} `{ min, max }`, both as text
   */
  function formatRangeEndsForTier(tier, min, max) {
    const ends = formatRangeEndsFirstPass(tier, min, max);
    if (tier !== TIERS.SHORT || min === max || !ends.min.startsWith("about ") || !ends.max.startsWith("about ")) return ends;
    const figure = (text) => Number(text.replace(/^about /, ""));
    if (!isAtMostHalfAsWide(figure(ends.min), figure(ends.max), min, max)) return ends;
    return widenRangeEnds(min, max, Math.max(ownStepPlace(min), ownStepPlace(max), SHORT_TIER_ROUNDING + 1));
  }

  /**
   * The two ends of a range as a tier speaks them. In the short tier two
   * different values never come out as the same text: where rounding would
   * make them equal, decimals are added until they differ.
   * @param {string} tier - A TIERS member
   * @param {number} min - The lowest value
   * @param {number} max - The highest value
   * @returns {Object} `{ min, max }`, both as text
   */
  function formatRangeEndsFirstPass(tier, min, max) {
    const ends = {
      min: formatAuthorValueForTier(tier, min),
      max: formatAuthorValueForTier(tier, max),
    };
    // Two ends are also "the same" when one is rounded to a figure that equals the other (1 and about 1.00).
    const figure = (text) => Number(text.replace(/^about /, ""));
    // An end rounded to fewer decimals than the other end is written with must not read as the other end's neighbour: where it would
    // round to that end's own figure ("about 1.00" beside 1.005, for 1.0049999), the ends are written to enough decimals to differ.
    const decimalsOf = (text) => Math.min((text.replace(/^about /, "").split(".")[1] || "").length, MAX_RESTORED_DECIMALS);
    const roundsToOther = (value, own, other) =>
      own.startsWith("about ") && decimalsOf(other) > SHORT_TIER_ROUNDING && Number(fixedDigitsOf(value, decimalsOf(other), typedExactOf(value))) === figure(other);
    // Two rounded ends that lie closer together than one rounding step ("about 1.00 to about 1.01" for 1.0049999 to 1.0050001) read as
    // a range of a whole step: they are written to enough decimals to show how narrow it is.
    // An end is rounded to the step when its figure is the value's own two-decimal rounding (read from the value, since the text may
    // have lost its trailing zeros).
    const roundedToStep = (value, text) =>
      text.startsWith("about ") && figure(text) === Number(fixedDigitsOf(value, SHORT_TIER_ROUNDING, typedExactOf(value)));
    const narrowerThanStep = roundedToStep(min, ends.min) && roundedToStep(max, ends.max) && max - min < 10 ** -SHORT_TIER_ROUNDING;
    // An end under 0.1 is rounded to two significant figures, so its step is one unit of its last figure's place (0.001 for 0.060306).
    // Two such ends that lie closer together than the coarser of their steps ("about 0.06 to about 0.061" for 0.060306 to 0.060533)
    // read as a range of a whole step in the same way, and are written to enough decimals to show how narrow it is. The width is taken
    // from the typed digits, so a pair exactly one step wide (0.00165 to 0.00175) is not narrower than its step.
    const figuresPlace = (value, text) =>
      text.startsWith("about ") && Math.abs(value) < SHORT_TIER_TWO_FIGURES_BELOW
        ? (figuresOf(value, SHORT_TIER_SMALL_FIGURES, typedExactOf(value)).split(".")[1] || "").length
        : null;
    const minPlace = figuresPlace(min, ends.min);
    const maxPlace = figuresPlace(max, ends.max);
    const narrowerThanFigures = minPlace !== null && maxPlace !== null && narrowerThanPlace(min, max, Math.min(minPlace, maxPlace));
    // A two-figure end under 0.1 beside a two-decimal end from 0.1 up has a different step on each side of 0.1, so neither test above sees
    // it: 0.09659823 to 0.1040567267 read "about 0.097 to about 0.1", under half the width of the data. Two such ends closer together
    // than the two-decimal step are written to enough decimals to show how narrow the range is.
    const underTwoFigureLimit = (value) => Math.abs(value) < SHORT_TIER_TWO_FIGURES_BELOW;
    const narrowerAcrossBands =
      ends.min.startsWith("about ") &&
      ends.max.startsWith("about ") &&
      underTwoFigureLimit(min) !== underTwoFigureLimit(max) &&
      narrowerThanPlace(min, max, SHORT_TIER_ROUNDING);
    if (
      tier !== TIERS.SHORT ||
      min === max ||
      (ends.min !== ends.max &&
        !narrowerThanStep &&
        !narrowerThanFigures &&
        !narrowerAcrossBands &&
        figure(ends.min) !== figure(ends.max) &&
        !roundsToOther(min, ends.min, ends.max) &&
        !roundsToOther(max, ends.max, ends.min))
    ) {
      return matchTypedEndFigures(min, max, ends);
    }
    return widenRangeEnds(min, max, SHORT_TIER_ROUNDING + 1);
  }

  /**
   * The two ends of a range written to the fewest decimals, from a first count, at which they differ and are not a whole unit of that
   * level apart or closer.
   * @param {number} min - The lowest value
   * @param {number} max - The highest value
   * @param {number} firstDecimals - The decimal places to try first
   * @returns {Object} `{ min, max }`, both as text
   */
  function widenRangeEnds(min, max, firstDecimals) {
    for (let decimals = firstDecimals; decimals <= MAX_RESTORED_DECIMALS; decimals += 1) {
      const lowText = dropTrailingZeros(fixedDigitsOf(min, decimals, typedExactOf(min)));
      const highText = dropTrailingZeros(fixedDigitsOf(max, decimals, typedExactOf(max)));
      if (lowText !== highText) {
        // An end the text reproduces exactly is the typed value, so it is not "about": that holds whether or not the two ends read alike
        // before they were widened ("0.123456789012345" and "0.123456789012346" both round to the same 14 decimals).
        const spoken = (value, written) => (Number(written) === value ? written : isHalfStepWide(min, max, decimals) ? numberDigits(value) : `about ${written}`);
        const low = spoken(min, lowText);
        const high = spoken(max, highText);
        // Two "about" ends that lie closer together than one unit of THIS level read as a range one unit wide ("about 1 to about 1.001"
        // for 1.00049 and 1.00051): go on to the next level, as the two-decimal step does above.
        const narrowerThanLevel = low.startsWith("about ") && high.startsWith("about ") && max - min < 10 ** -decimals;
        if (!narrowerThanLevel) return matchTypedEndFigures(min, max, { min: low, max: high });
      }
    }
    return { min: numberDigits(min), max: numberDigits(max) };
  }

  /**
   * A DERIVED value (mean, standard deviation or median) under Chart.js's
   * `formatValue` magnitude rule: two decimals below 10, one from 10 to 99,
   * none from 100, and integers verbatim. No thousands separator anywhere.
   * @param {number} value - A computed statistic
   * @param {Object|null} exact - The exact sum and count the value is the mean of, or null: its digits are rounded from these (half away
   *   from zero), and the magnitude band is still chosen from the double
   * @returns {string} The value as it is spoken
   */
  function formatDerivedValue(value, exact = null) {
    if (!Number.isFinite(value)) return String(value);
    // A whole-number statistic is spoken to 15 significant figures: the 16th and 17th of a double are rounding noise, and
    // writing them out pads a number such as 3e22 as 29999999999999996000000.
    if (Number.isInteger(value)) {
      return numberDigits(Math.abs(value) >= PADDED_DIGITS_FROM ? Number(value.toPrecision(SPOKEN_SIGNIFICANT_FIGURES)) : value);
    }
    const magnitude = Math.abs(value);
    const decimals = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2;
    const banded = fixedDigitsOf(value, decimals, exact);
    const spoken = dropTrailingZeros(banded);
    return spoken === "-0" ? "0" : spoken;
  }

  /**
   * `toFixed`, except that from 1e21 (where it would switch to exponent form) the number is written out in digits.
   * @param {number} value - A number
   * @param {number} decimals - Decimal places
   * @returns {string} The number in digits
   */
  function fixedDigits(value, decimals, exact = null) {
    return Math.abs(value) >= PADDED_DIGITS_FROM ? numberDigits(value) : fixedDigitsOf(value, decimals, exact);
  }

  /**
   * A value to a number of decimals: from its exact digits when it has them (half away from zero), else `toFixed`.
   * @param {number} value - A number below 1e21
   * @param {number} decimals - Decimal places
   * @param {Object|null} exact - The exact sum and count the value is the mean of, or null
   * @returns {string} The value in digits
   */
  function fixedDigitsOf(value, decimals, exact) {
    return exact !== null && Math.abs(value) < PADDED_DIGITS_FROM ? exactToFixed(exact, decimals) : value.toFixed(decimals);
  }

  /**
   * A value to a number of significant figures: from its exact digits when it has them (half away from zero), else `toPrecision`.
   * @param {number} value - A number
   * @param {number} figures - Significant figures
   * @param {Object|null} exact - The exact sum and count the value is the mean of, or null
   * @returns {string} The value in digits
   */
  function figuresOf(value, figures, exact) {
    return exact !== null && Math.abs(value) < PADDED_DIGITS_FROM ? exactToPrecision(exact, figures) : value.toPrecision(figures);
  }

  /**
   * A mean to a number of significant figures as it is spoken: the figures written back as a number (so a trailing zero goes), except
   * for a mean below the smallest normal double, which is spoken from its exact digits. There the written figures do not survive
   * `Number()` (2.5e-324 parses to 5e-324, twice the mean), so the text is used as it is.
   * @param {number} value - The mean as a double
   * @param {number} figures - Significant figures
   * @param {Object|null} exact - The exact sum and count the mean was taken from, or null
   * @returns {string} The value in digits
   */
  function figuresSpoken(value, figures, exact) {
    const written = figuresOf(value, figures, exact);
    if (exact !== null && Math.abs(value) < SMALLEST_NORMAL_DOUBLE) return dropTrailingZeros(written);
    return numberDigits(Number(written));
  }

  /**
   * The exact sum and count behind a series' mean, or null where the series was not added exactly.
   * @param {Object} stats - Statistics from computeStatistics
   * @returns {Object|null} `{ sum, count }` or null
   */
  function meanExactOf(stats) {
    return stats.exactSum === null ? null : { sum: stats.exactSum, count: stats.count };
  }

  /**
   * The exact digits of one typed value, or null for a value that is not finite.
   * @param {number} value - A value read from the source
   * @returns {Object|null} `{ sum, count }` or null
   */
  function typedExactOf(value) {
    const sum = exactSeriesSum([value]);
    return sum === null ? null : { sum, count: 1 };
  }

  /**
   * A banded value sheds its trailing zeros: `7.2`, not `7.20`.
   *
   * The band decides how much precision the code CARRIES. It should not decide
   * how much the reader HEARS. A screen reader announces "7.20" as "seven point
   * two zero". That final zero comes from the two-decimal width of the
   * below-ten band. It is not a digit that the data has. The mean of 5, 9, 4,
   * 11 and 7 is exactly seven point two.
   *
   * `8.36` is untouched. Integers never reach this function, because
   * `formatDerivedValue` returns them before banding.
   *
   * THIS IS DELIBERATELY NOT APPLIED to the overall-change percentage. That
   * percentage keeps its own fixed one-decimal format, which comes from
   * Chart.js. A chart with two equal peaks reads `300.0%`, and a golden pins it. The
   * magnitude bands apply to derived values, and that sentence is not banded.
   *
   * KNOWN LIMIT: a mean of 0.004 bands to "0.00", and so reads "0". That
   * follows the rule as written, and it is no less accurate than "0.00".
   *
   * @param {string} banded - A toFixed result
   * @returns {string} The same value with no trailing decimal zeros
   */
  function dropTrailingZeros(banded) {
    if (banded.indexOf(".") === -1) return banded;
    return banded.replace(/0+$/, "").replace(/\.$/, "");
  }

  /**
   * The decimal places a printed range end is written with ("about 0.095" has 3, "12" has 0).
   * @param {string} written - A printed end, with or without "about "
   * @returns {number} The decimal places
   */
  function printedDecimals(written) {
    const match = /\.(\d+)$/.exec(written.replace(/^about /, ""));
    return match === null ? 0 : match[1].length;
  }

  /**
   * Whether the magnitude rule's average sits at a different place in a typed range than the mean does. The average is heard as a place
   * between the two printed ends ("from 0.095 to 0.105 with an average of 0.1" is heard as the middle, and the mean, 0.0975, is a quarter
   * of the way along). It is misplaced when the spoken figure is more than a twentieth of the range from the mean.
   * @param {Object} stats - Statistics from computeStatistics
   * @returns {boolean} True when the average as the magnitude rule speaks it is more than MEAN_MISPLACED_BEYOND of the range from the mean
   */
  function isMeanMisplaced(stats) {
    const width = stats.max - stats.min;
    if (!Number.isFinite(stats.mean) || !Number.isFinite(width) || width <= 0) return false;
    const spoken = Number(formatMean(stats.mean, stats.min, stats.max, meanExactOf(stats)));
    return Math.abs(spoken - stats.mean) > width * MEAN_MISPLACED_BEYOND;
  }

  /**
   * The fewest decimals the spoken average may be written to beside a printed range. An end printed "about" is a figure rounded to
   * its own decimals, so the average beside it is written to at least those decimals: it then reads at the place the rounded range lets
   * a reader put it. Two ends typed in full keep the magnitude rule, except where that rule misplaces the average (isMeanMisplaced): there
   * the average is written to at least the decimals of the more precise typed end. Both tiers use this one test.
   * @param {Object} ends - `{ min, max }` as the sentence prints them
   * @param {Object} stats - Statistics from computeStatistics
   * @returns {number} The decimals of the more precise printed end where the floor applies, else 0
   */
  function meanFloorDecimals(ends, stats) {
    const endDecimals = Math.max(printedDecimals(ends.min), printedDecimals(ends.max));
    if (ends.min.startsWith("about ") || ends.max.startsWith("about ")) return endDecimals;
    return isMeanMisplaced(stats) ? endDecimals : 0;
  }

  /**
   * An average with fewer decimals than the printed ends that sits far from the mean (more than MEAN_MISPLACED_BEYOND of the printed range)
   * is spoken as the detailed tier speaks it: the mean at the decimals of the two typed ends. That happens only where the search for a figure
   * inside the printed range ran out of decimals.
   * @param {string} spoken - The average as spokenAverage chose it
   * @param {Object} ends - `{ min, max }` as the tier prints them
   * @param {Object} stats - Statistics from computeStatistics
   * @returns {string} The average as it is spoken
   */
  function averageNearMean(spoken, ends, stats) {
    const figure = (written) => Number(written.replace(/^about /, ""));
    // An average that is the mean rounded to the decimals of the printed ends (trailing zeros dropped) is the ruled form: the ends' own decimals are all the range offers.
    const endDecimals = Math.max(printedDecimals(ends.min), printedDecimals(ends.max));
    if (!Number.isFinite(stats.mean) || spoken === atLeastDecimals(spoken, stats.mean, endDecimals, meanExactOf(stats))) return spoken;
    if (printedDecimals(spoken) >= endDecimals) return spoken;
    const width = figure(ends.max) - figure(ends.min);
    if (!Number.isFinite(stats.mean) || !Number.isFinite(width) || width <= 0) return spoken;
    if (Math.abs(Number(spoken) - stats.mean) <= width * MEAN_MISPLACED_BEYOND) return spoken;
    const typedDecimals = Math.max(printedDecimals(formatAuthorValue(stats.min)), printedDecimals(formatAuthorValue(stats.max)));
    return formatMean(stats.mean, stats.min, stats.max, meanExactOf(stats), typedDecimals);
  }

  /**
   * The average of a single series as a tier speaks it beside that tier's printed range. The takeaway's range sentence and the detailed
   * tier's "Average value:" bullet both take their figure from here, so the two never disagree.
   * @param {Object} stats - Statistics from computeStatistics
   * @param {Object} ends - `{ min, max }` as the tier prints them
   * @returns {string} The average as it is spoken
   */
  function spokenAverage(stats, ends) {
    const meanBounds = printedMeanBounds(ends, stats);
    const spoken = formatMean(stats.mean, meanBounds.min, meanBounds.max, meanExactOf(stats), meanFloorDecimals(ends, stats));
    return averageNearMean(spoken, ends, stats);
  }

  /**
   * An average written to at least a number of decimals: the magnitude rule's text where that already has them, else the mean at that many
   * decimals (rounded half away from zero from its exact digits, trailing zeros dropped). A whole-number mean and a mean that is not
   * finite keep the magnitude rule's text.
   * @param {string} banded - The mean as formatDerivedValue speaks it
   * @param {number} mean - The mean of the values
   * @param {number} floorDecimals - The fewest decimals the average may be written to
   * @param {Object|null} exact - The exact sum and count the mean was taken from, or null
   * @returns {string} The mean as text
   */
  function atLeastDecimals(banded, mean, floorDecimals, exact) {
    if (floorDecimals <= 0 || !Number.isFinite(mean) || Number.isInteger(mean) || Math.abs(mean) >= PADDED_DIGITS_FROM) return banded;
    const bandDecimals = Math.abs(mean) >= 100 ? 0 : Math.abs(mean) >= 10 ? 1 : 2;
    if (floorDecimals <= bandDecimals) return banded;
    const written = dropTrailingZeros(fixedDigitsOf(mean, floorDecimals, exact));
    return written === "-0" ? "0" : written;
  }

  /**
   * An average as it is spoken, kept inside the range of the values it
   * averages. The magnitude rule can round a mean past an end of the range
   * (the mean of 100.6 and 100.8 is 100.7, and the rule says 101). Where it
   * does, decimals are added until the spoken figure lies inside the range.
   * Every other average is spoken as `formatDerivedValue` says it.
   * @param {number} mean - The mean of the values
   * @param {number} min - The lowest value
   * @param {number} max - The highest value
   * @param {Object|null} exact - The exact sum and count the mean was taken from, or null (a value that is not finite): the figures are
   *   rounded from these, half away from zero, and the double is kept for every comparison
   * @returns {string} The mean as it is spoken
   */
  function formatMean(mean, min, max, exact = null, floorDecimals = 0) {
    // "At least" the floor: an average that already carries that many decimals (a small mean is spoken to two figures) is left as it is.
    if (floorDecimals > 0) {
      const withoutFloor = formatMean(mean, min, max, exact);
      if (printedDecimals(withoutFloor) >= floorDecimals) return withoutFloor;
    }
    const bandedByMagnitude = formatDerivedValue(mean, exact);
    // The average is written to at least the decimals of the printed range ends, rounded half away from zero from the exact mean.
    const banded = atLeastDecimals(bandedByMagnitude, mean, floorDecimals, exact);
    if (!Number.isFinite(mean) || !Number.isFinite(min) || !Number.isFinite(max)) {
      return banded;
    }
    // The average of values that are all the same is that value, whatever the banded text would say.
    if (min === max) return numberDigits(min);
    // A mean below the smallest normal double is a double of one figure or none, so the range tests below (and the double itself) cannot hold it:
    // [5e-324, 0, 0] has the mean 1.67e-324, which is the double 0, and [5e-324, 1e-323] has 7.5e-324, which is the double 1e-323. It is spoken from
    // its exact digits, to two figures.
    if (exact !== null && exact.sum.units !== 0n && Math.abs(mean) < DOUBLE_TOO_COARSE_BELOW) return dropTrailingZeros(figuresOf(mean, SMALL_MEAN_FIGURES, exact));
    const strictlyInside = mean > min && mean < max;
    const inside = (text) => {
      const spoken = Number(text);
      if (strictlyInside && (spoken === min || spoken === max)) return false;
      return spoken >= min && spoken <= max;
    };
    if (inside(banded)) {
      // A mean that is not zero is never spoken as 0 (the range holds 0, so the search below would stop at it): add decimals until a figure shows.
      if (mean !== 0 && Number(banded) === 0) {
        const small = figuresSpoken(mean, SMALL_MEAN_FIGURES, exact);
        return inside(small) ? small : banded;
      }
      return banded;
    }
    for (let decimals = Math.min(floorDecimals, MAX_RESTORED_DECIMALS); decimals <= MAX_RESTORED_DECIMALS; decimals += 1) {
      const restored = dropTrailingZeros(fixedDigits(mean, decimals, exact));
      if (inside(restored)) return restored;
    }
    // No figure up to 15 decimals is strictly inside (a range narrower than 1e-15, or a mean needing more digits): use the fewest
    // significant figures that are, written as the range ends are.
    let atAnEnd = null;
    for (let decimals = 0; decimals <= MAX_RESTORED_DECIMALS; decimals += 1) {
      const restored = dropTrailingZeros(fixedDigits(mean, decimals, exact));
      if (Number(restored) >= min && Number(restored) <= max) atAnEnd = restored;
    }
    // Only when the mean really is between the ends: an all-equal series (mean = both ends, off by float noise) keeps its banded text.
    for (let figures = 1; strictlyInside && figures <= MAX_SIGNIFICANT_FIGURES; figures += 1) {
      const spoken = figuresSpoken(mean, figures, exact);
      if (inside(spoken)) return spoken;
    }
    // The mean equals an end in doubles and no shorter figure fits between the ends: speak it in full rather than a rounded figure outside the range.
    // (An all-equal series keeps its banded text, as the comment above says.)
    return atAnEnd !== null ? atAnEnd : min === max ? banded : numberDigits(mean);
  }

  /**
   * The bounds an average is spoken strictly inside beside a printed range. An end printed "about" is a rounded figure, and an average
   * spoken as that same figure sounds like the top or bottom of the range ("from 0.0994 to about 0.0995 with an average of 0.0995", for
   * a mean of 0.09945), so beside such an end the average is given the figures that put it inside the printed range. A mean that is not
   * between the printed ends keeps the data's own ends as its bounds.
   * @param {Object} ends - `{ min, max }` as the short tier prints them
   * @param {Object} stats - Statistics from computeStatistics
   * @returns {{min: number, max: number}} The bounds for formatMean
   */
  function printedMeanBounds(ends, stats) {
    const figure = (written) => Number(written.replace(/^about /, ""));
    const min = ends.min.startsWith("about ") ? figure(ends.min) : stats.min;
    const max = ends.max.startsWith("about ") ? figure(ends.max) : stats.max;
    return stats.mean > min && stats.mean < max ? { min, max } : { min: stats.min, max: stats.max };
  }

  /**
   * The two printed ends of a range, with an end that is printed "about" given as typed where the spoken average is still that same figure.
   * That is the mean at its own precision (0.0017 for 0.00165 and 0.00175), which no further figure can move off the end.
   * @param {Object} ends - `{ min, max }` as the short tier prints them
   * @param {Object} stats - Statistics from computeStatistics
   * @param {string} meanText - The average as it is spoken
   * @returns {Object} `{ min, max }`, both as text
   */
  function endsClearOfMean(ends, stats, meanText) {
    const figure = (written) => Number(written.replace(/^about /, ""));
    const typedWhereMean = (end, value) => (end.startsWith("about ") && figure(end) === Number(meanText) ? formatAuthorValue(value) : end);
    const cleared = { min: typedWhereMean(ends.min, stats.min), max: typedWhereMean(ends.max, stats.max) };
    return cleared.min === ends.min && cleared.max === ends.max ? ends : matchTypedEndFigures(stats.min, stats.max, cleared);
  }

  /**
   * The two printed ends of a range with an end that is printed "about" given as typed where the mean lies past that end's figure
   * ("about 0.01" for 0.01046, with a mean of 0.0101133): the average beside it is then spoken inside the range the sentence prints.
   * @param {Object} ends - `{ min, max }` as the short tier prints them
   * @param {Object} stats - Statistics from computeStatistics
   * @returns {Object} `{ min, max }`, both as text
   */
  function endsHoldingMean(ends, stats) {
    const figure = (written) => Number(written.replace(/^about /, ""));
    const typedWherePassed = (end, value, passed) => (end.startsWith("about ") && passed(figure(end)) ? formatAuthorValue(value) : end);
    const typed = { min: typedWherePassed(ends.min, stats.min, (at) => stats.mean < at), max: typedWherePassed(ends.max, stats.max, (at) => stats.mean > at) };
    return typed.min === ends.min && typed.max === ends.max ? ends : matchTypedEndFigures(stats.min, stats.max, typed);
  }

  /**
   * A standard deviation as it is spoken. Data that varies never has a spread spoken as zero: decimals are added
   * until a non-zero figure appears. A series with no variance is zero, whatever float noise the mean carries.
   * @param {Object} stats - Statistics from computeStatistics
   * @returns {string} The spread as it is spoken
   */
  function formatSpread(stats) {
    const spread = stats.standardDeviation;
    if (stats.max === stats.min) return "0";
    const banded = formatDerivedValue(spread);
    if (!(spread > 0) || Number(banded) !== 0) return banded;
    for (let decimals = 0; decimals <= MAX_RESTORED_DECIMALS; decimals += 1) {
      const restored = dropTrailingZeros(spread.toFixed(decimals));
      if (Number(restored) !== 0) return restored;
    }
    // Varies, but by less than the smallest figure the search can print: say so rather than speak zero.
    return `less than ${(10 ** -MAX_RESTORED_DECIMALS).toFixed(MAX_RESTORED_DECIMALS)}`;
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
   * THE MEDIAN IS TAKEN FROM THE SORTED VALUES. The middle pair in source
   * order gives the wrong answer: an unsorted middle pair of 141 and 176 has
   * the mean 159, where the sorted median is 164.
   *
   * @param {Array<number>} values - The series values in source order
   * @returns {Object} The statistics
   */
  function computeStatistics(values) {
    const count = values.length;
    if (count === 0) throw new Error("xychart: a series has no values");
    const largest = values.reduce((most, value) => Math.max(most, Math.abs(value)), 0);
    // A series of finite values is added exactly, from the digits each is written with; only one holding NaN or an infinity (outside the
    // stated input) keeps the compensated sum and the float-noise bound.
    const exactSum = exactSeriesSum(values);
    let mean;
    if (exactSum !== null) {
      mean = exactMean(exactSum, count);
    } else {
      const rawMean = compensatedSum(values) / count;
      mean = Math.abs(rawMean) <= floatNoiseBound(values) ? 0 : rawMean;
    }

    let maxIndex = 0;
    let minIndex = 0;
    for (let i = 1; i < count; i += 1) {
      if (values[i] > values[maxIndex]) maxIndex = i;
      if (values[i] < values[minIndex]) minIndex = i;
    }

    // EVERY position that holds each extreme, in source order. This is the one
    // place that finds them. A sentence that names a position must not claim
    // that the position is unique when two maxima are equal. `maxIndex` and
    // `minIndex` hold the first entry of each array, so a chart with a unique
    // extreme has one index for it.
    const maxIndices = [];
    const minIndices = [];
    for (let i = 0; i < count; i += 1) {
      if (values[i] === values[maxIndex]) maxIndices.push(i);
      if (values[i] === values[minIndex]) minIndices.push(i);
    }

    // The spread is worked out on values divided by the largest, so squaring can neither overflow (1e155 squared) nor underflow (1e-200
    // squared), then scaled back.
    const scaledMean = largest > 0 ? mean / largest : 0;
    const scaledVariance =
      largest > 0
        ? compensatedSum(values.map((value) => (value / largest - scaledMean) ** 2)) / count
        : 0;

    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(count / 2);
    // The median is one typed value or the mean of the two in the middle, so it has exact digits whenever the series does.
    const medianExact =
      exactSum === null
        ? null
        : count % 2 === 1
          ? { sum: exactSeriesSum([sorted[middle]]), count: 1 }
          : { sum: exactSeriesSum([sorted[middle - 1], sorted[middle]]), count: 2 };
    // The mean of the middle pair is taken as a double sum over two, except where that sum overflows (1.7e308 twice is Infinity): then
    // it comes from the exact pair, or from the halves where the series has no exact digits. Every finite sum keeps the double path.
    const middlePairSum = count > 0 && count % 2 === 0 ? sorted[middle - 1] + sorted[middle] : 0;
    const evenMedian = () =>
      Number.isFinite(middlePairSum)
        ? middlePairSum / 2
        : medianExact !== null
          ? exactMean(medianExact.sum, 2)
          : sorted[middle - 1] / 2 + sorted[middle] / 2;
    const median = count === 0 ? 0 : count % 2 === 1 ? sorted[middle] : evenMedian();

    return {
      count: count,
      mean: mean,
      exactSum: exactSum,
      max: values[maxIndex],
      min: values[minIndex],
      maxIndex: maxIndex,
      minIndex: minIndex,
      maxIndices: maxIndices,
      minIndices: minIndices,
      standardDeviation: largest * Math.sqrt(scaledVariance),
      median: median,
      medianExact: medianExact,
    };
  }

  /**
   * True when every value in the series is the same one. A series of a single
   * value counts as this degenerate case of no variance, not as a separate
   * shape.
   *
   * THE `count >= 1` HALF IS DEFENSIVE, AND NO CALLER REACHES IT. On an empty
   * series `values[0]` is `undefined` at both ends, so `max === min` would be
   * true, and an unguarded test would write "All zero values are undefined".
   * An empty series never reaches this function, because generation throws
   * earlier and the caller's own fallback for a failed description takes
   * over. So the guard protects against a shape that nothing delivers. That
   * is a reason to keep it, and not a reason to claim that it ever runs.
   *
   * @param {Object} stats - Statistics from computeStatistics
   * @returns {boolean} True when the series has no variance at all
   */
  function isDegenerateSeries(stats) {
    return stats.count >= 1 && stats.max === stats.min;
  }

  // A mostly flat series is "stable" only if its net change is at most this share of its range.
  const STABLE_NET_RANGE_SHARE = 0.5;
  // Fewer steps than this cannot be called a consistent trend.
  const TREND_MIN_STEPS = 3;
  // A mostly flat series whose range is more than this share of its largest absolute value has a spike or a dip, not a wobble.
  const LEVEL_SPIKE_MIN_SHARE = 0.5;
  // ...and its highest (or lowest) value sticks out of BOTH end values by more than this share of the range.
  const LEVEL_SPIKE_STICK_OUT = 0.75;
  // "Consistently" also needs the end points to sit near the extremes: within this share of the range of the high (or low) at the end,
  // and of the low (or high) at the start.
  const CONSISTENT_END_SHARE = 0.25;
  // A spike or a dip is held by this share of the points or fewer, in ONE stretch. A plateau or two spikes is not "a large spike".
  const LEVEL_SPIKE_MAX_POINT_SHARE = 0.25;
  // "Consistently" is not said when the single biggest step against the direction is more than this share of the range: a climb of
  // 100 that gives back 70 in one step is not consistent.
  const CONSISTENT_STEP_AGAINST_SHARE = 0.25;
  // A mostly level series whose points off its level are more than this share of all its points is not "mostly level": a wide
  // square wave is 43% off its level and a plateau holds 33%.
  const LEVEL_APART_MAX_POINT_SHARE = 0.4;
  // A point counts as raised or lowered when it is further than this share of the range from the series' level.
  const LEVEL_APART_MIN_SHARE = 0.25;

  /**
   * The value that most points hold (the first of those, where several tie): the level of a mostly level series.
   * @param {Array<number>} values - The series values in source order
   * @returns {number} The level
   */
  function levelOf(values) {
    const counts = new Map();
    for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
    let level = values[0];
    let most = 0;
    for (const [value, count] of counts) {
      if (count > most) {
        most = count;
        level = value;
      }
    }
    return level;
  }

  /**
   * How many separate stretches of points the test holds for.
   * @param {Array<number>} values - The series values in source order
   * @param {Function} onFarSide - Takes a value, true when it counts
   * @returns {number} The number of unbroken stretches
   */
  function countStretches(values, onFarSide) {
    let stretches = 0;
    let previous = false;
    for (const value of values) {
      const current = onFarSide(value);
      if (current && !previous) stretches += 1;
      previous = current;
    }
    return stretches;
  }

  /**
   * The words for a mostly level series with a large range where no single spike or dip fits. More than
   * LEVEL_APART_MAX_POINT_SHARE of the points off the level is not "mostly level" (no clear trend); points that stand apart both
   * ways say so; otherwise the side with fewer points is the one that stands apart, and several one-point stretches are points.
   * @param {Array<number>} values - The series values in source order
   * @param {number} high - The highest value
   * @param {number} low - The lowest value
   * @returns {string} A TRENDS member
   */
  function levelFallbackTrend(values, high, low) {
    const level = levelOf(values);
    if (values.filter((value) => value !== level).length > LEVEL_APART_MAX_POINT_SHARE * values.length) return TRENDS.NONE;
    const margin = LEVEL_APART_MIN_SHARE * (high - low);
    const farAbove = (value) => value - level > margin;
    const farBelow = (value) => level - value > margin;
    if (values.some(farAbove) && values.some(farBelow)) {
      // A side whose departures are all single points says points; a side with a run says stretches. Two sides of points read
      // "raised and lowered points"; one side of points beside a run names each side.
      const raisedPoints = values.filter(farAbove).length === countStretches(values, farAbove);
      const loweredPoints = values.filter(farBelow).length === countStretches(values, farBelow);
      if (raisedPoints && loweredPoints) return TRENDS.LEVEL_APART_POINTS;
      // Points on one side, a run on the other: the singular is used on a side that has exactly one ("a raised point and a lowered
      // stretch"), the plural otherwise, so the wording counts what the series holds.
      if (raisedPoints) {
        const onePoint = values.filter(farAbove).length === 1;
        const oneStretch = countStretches(values, farBelow) === 1;
        if (onePoint && oneStretch) return TRENDS.LEVEL_APART_ONE_POINT_ONE_STRETCH;
        if (onePoint) return TRENDS.LEVEL_APART_ONE_POINT_STRETCHES;
        if (oneStretch) return TRENDS.LEVEL_APART_POINTS_ONE_STRETCH;
        return TRENDS.LEVEL_APART_RAISED_POINTS;
      }
      if (loweredPoints) {
        const onePoint = values.filter(farBelow).length === 1;
        const oneStretch = countStretches(values, farAbove) === 1;
        if (onePoint && oneStretch) return TRENDS.LEVEL_APART_ONE_STRETCH_ONE_POINT;
        if (onePoint) return TRENDS.LEVEL_APART_STRETCHES_ONE_POINT;
        if (oneStretch) return TRENDS.LEVEL_APART_ONE_STRETCH_POINTS;
        return TRENDS.LEVEL_APART_LOWERED_POINTS;
      }
      return TRENDS.LEVEL_APART;
    }

    const midpoint = (high + low) / 2;
    const above = (value) => value > midpoint;
    const below = (value) => value < midpoint;
    const raised = values.filter(above).length <= values.filter(below).length;
    const farSide = raised ? above : below;
    const stretches = countStretches(values, farSide);
    if (stretches === 1) return raised ? TRENDS.LEVEL_RAISED : TRENDS.LEVEL_LOWERED;
    // Every stretch one point long: a run of values it is not.
    const oneEach = values.filter(farSide).length === stretches;
    if (oneEach) return raised ? TRENDS.LEVEL_RAISED_POINTS : TRENDS.LEVEL_LOWERED_POINTS;
    return raised ? TRENDS.LEVEL_RAISED_MANY : TRENDS.LEVEL_LOWERED_MANY;
  }

  /**
   * True when the points for which `onFarSide` holds are few and form one unbroken stretch.
   * @param {Array<number>} values - The series values in source order
   * @param {Function} onFarSide - Takes a value, true when it is on the far side of the series' midpoint
   * @returns {boolean} Whether they are one short stretch
   */
  function isOneShortStretch(values, onFarSide) {
    let far = 0;
    let stretches = 0;
    let previous = false;
    for (const value of values) {
      const current = onFarSide(value);
      if (current) {
        far += 1;
        if (!previous) stretches += 1;
      }
      previous = current;
    }
    return far > 0 && stretches === 1 && far <= LEVEL_SPIKE_MAX_POINT_SHARE * values.length;
  }
  // A generally-increasing or decreasing trend needs a fitted line that agrees with the end points and rises
  // (or falls) by at least this share of the range across the whole series.
  const FITTED_RISE_MIN_SHARE = 0.1;

  /**
   * The least-squares line through the points, as the rise across the whole series divided by the range.
   * @param {Array<number>} values - The series values in source order
   * @returns {number} Signed share of the range, 0 when the range is 0
   */
  function fittedRiseShare(values) {
    const count = values.length;
    const middle = (count - 1) / 2;
    const meanValue = values.reduce((sum, value) => sum + value, 0) / count;
    let covariance = 0;
    let spread = 0;
    for (let i = 0; i < count; i += 1) {
      covariance += (i - middle) * (values[i] - meanValue);
      spread += (i - middle) * (i - middle);
    }
    const range = Math.max(...values) - Math.min(...values);
    if (!(range > 0) || !(spread > 0)) return 0;
    return ((covariance / spread) * (count - 1)) / range;
  }

  /**
   * Chart.js's `analyzeTrend`, quoted, with three additions. More than 70% of
   * steps in one direction gives "consistently". Otherwise the sign of the last
   * value minus the first decides, but only when a fitted line agrees with it.
   * One or two steps read as a plain rise or fall, and a mostly flat series
   * that ends far from its start is level apart from one large change.
   * @param {Array<number>} values - The series values in source order
   * @returns {string} One of the TRENDS vocabulary
   */
  function analyseTrend(values) {
    if (values.length < 2) return TRENDS.UNKNOWN;

    let positive = 0;
    let negative = 0;
    let unchanged = 0;
    let biggestRise = 0;
    let biggestFall = 0;
    for (let i = 1; i < values.length; i += 1) {
      const difference = values[i] - values[i - 1];
      if (difference > 0) {
        positive += 1;
        biggestRise = Math.max(biggestRise, difference);
      } else if (difference < 0) {
        negative += 1;
        biggestFall = Math.max(biggestFall, -difference);
      } else unchanged += 1;
    }

    // "Consistently" is only said when the series also ends on the side that
    // most of its steps point to. Nine small falls and one huge rise end higher,
    // so they are not a consistent fall.
    const overall = values[values.length - 1] - values[0];
    const steps = values.length - 1;
    // One or two steps are a rise or a fall, not a consistent trend.
    if (steps < TREND_MIN_STEPS) {
      if (positive === steps && overall > 0) return TRENDS.RISES;
      if (negative === steps && overall < 0) return TRENDS.FALLS;
    }
    const high = Math.max(...values);
    const low = Math.min(...values);
    const reach = CONSISTENT_END_SHARE * (high - low);
    const first = values[0];
    const last = values[values.length - 1];
    const stepLimit = CONSISTENT_STEP_AGAINST_SHARE * (high - low);
    if (positive > TREND_DOMINANCE * steps && overall > 0 && high - last <= reach && first - low <= reach && biggestFall <= stepLimit) return TRENDS.UP;
    if (negative > TREND_DOMINANCE * steps && overall < 0 && last - low <= reach && high - first <= reach && biggestRise <= stepLimit) return TRENDS.DOWN;
    if (unchanged > TREND_DOMINANCE * steps) {
      // Mostly flat steps, but the series ends far from where it began, so it is not "stable".
      const range = Math.max(...values) - Math.min(...values);
      if (range > 0 && Math.abs(overall) > STABLE_NET_RANGE_SHARE * range) {
        return overall > 0 ? TRENDS.LEVEL_RISE : TRENDS.LEVEL_FALL;
      }
      const scale = Math.max(...values.map((value) => Math.abs(value)));
      if (range > LEVEL_SPIKE_MIN_SHARE * scale) {
        const ends = [values[0], values[values.length - 1]];
        const midpoint = (high + low) / 2;
        if (Math.max(...values) - Math.max(...ends) > LEVEL_SPIKE_STICK_OUT * range && isOneShortStretch(values, (value) => value > midpoint)) return TRENDS.LEVEL_SPIKE;
        if (Math.min(...ends) - Math.min(...values) > LEVEL_SPIKE_STICK_OUT * range && isOneShortStretch(values, (value) => value < midpoint)) return TRENDS.LEVEL_DIP;
        // A large range that no spike or dip explains is not "stable".
        return levelFallbackTrend(values, high, low);
      }
      return TRENDS.STABLE;
    }

    // A direction needs the fitted line to agree with the end points and to move by a real share of the range.
    if (overall !== 0) {
      const fitted = fittedRiseShare(values);
      if (Math.sign(fitted) !== Math.sign(overall) || Math.abs(fitted) < FITTED_RISE_MIN_SHARE) return TRENDS.NONE;
    }

    if (overall > 0) return negative === 0 ? TRENDS.UP_STEPPED : TRENDS.UP_NOISY;
    if (overall < 0) return positive === 0 ? TRENDS.DOWN_STEPPED : TRENDS.DOWN_NOISY;
    return TRENDS.NONE;
  }

  /**
   * Interior local maxima and minima: a point strictly greater (or smaller)
   * than both neighbours. The first and last points are never counted, having
   * only one neighbour each. A run of equal values counts as one point.
   * @param {Array<number>} allValues - The series values in source order
   * @returns {Object} `{ peaks, troughs }`
   */
  function countPeaksAndTroughs(allValues) {
    // A run of equal values is one point: a flat top is one peak, not none.
    const values = allValues.filter(
      (value, i) => i === 0 || value !== allValues[i - 1]
    );
    let peaks = 0;
    let troughs = 0;
    for (let i = 1; i < values.length - 1; i += 1) {
      if (values[i] > values[i - 1] && values[i] > values[i + 1]) peaks += 1;
      if (values[i] < values[i - 1] && values[i] < values[i + 1]) troughs += 1;
    }
    return { peaks: peaks, troughs: troughs };
  }

  /**
   * The words that say the highest value sits on an end point, which the peak count leaves out (an end point has one neighbour).
   * Without them "peaks at 100 during L4, L7 and L13" is followed by "two peaks".
   * @param {Array<number>} values - The series values in source order
   * @returns {string} "" or ", and it starts at its highest value" and so on
   */
  function highestAtEndsClause(values) {
    const highest = Math.max(...values);
    const parts = [];
    if (values[0] === highest) parts.push("starts");
    if (values[values.length - 1] === highest) parts.push("ends");
    return parts.length ? `, and it ${parts.join(" and ")} at its highest value` : "";
  }

  // How far a step may go against its leg and still count as one rise or one
  // fall, as a share of the gap between the highest and the lowest value.
  const TURN_TOLERANCE = 0.1;

  // The two shapes of a series that turns once.
  const TURN_SHAPES = Object.freeze({
    PEAK: "peak",
    LOW: "low",
  });

  // The words for a series that turns once. The trend bullet leaves out the
  // label, because the next bullet already names the highest or lowest point.
  // The short sentence of a one-series chart names it, because nothing else
  // does.
  const TURN_CLAUSE = Object.freeze({
    [TURN_SHAPES.PEAK]: Object.freeze({
      plain: " rises, then falls",
      labelledBefore: " rises to a peak at ",
      labelledAfter: ", then falls",
    }),
    [TURN_SHAPES.LOW]: Object.freeze({
      plain: " falls, then rises",
      labelledBefore: " falls to a low at ",
      labelledAfter: ", then rises",
    }),
  });

  /**
   * Whether a series turns once. It must reach its highest value (or its
   * lowest) somewhere inside the series, and a flat top is allowed. Each leg
   * must be longer than the tolerance. Inside a leg, a step against the leg's
   * direction may not be longer than the tolerance. A series with two humps,
   * or a turn at either end, is not a single turn.
   * @param {Array<number>} values - The series values in source order
   * @returns {string|null} A TURN_SHAPES value, or null
   */
  function turnShape(values) {
    const count = values.length;
    if (count < 3) return null;
    const range = Math.max(...values) - Math.min(...values);
    if (!(range > 0)) return null;
    const tolerance = TURN_TOLERANCE * range;

    // Tests for a peak. A low is the same test on the negated values.
    const turnsOnce = (sign) => {
      const signed = values.map((value) => value * sign);
      const top = Math.max(...signed);
      const first = signed.indexOf(top);
      const last = signed.lastIndexOf(top);
      if (first === 0 || last === count - 1) return false;
      for (let i = first; i <= last; i += 1) {
        if (signed[i] !== top) return false;
      }
      if (top - signed[0] <= tolerance) return false;
      if (top - signed[count - 1] <= tolerance) return false;
      for (let i = 1; i <= first; i += 1) {
        const stepBack = signed[i - 1] - signed[i];
        if (stepBack > tolerance) return false;
      }
      for (let i = last + 1; i < count; i += 1) {
        const stepBack = signed[i] - signed[i - 1];
        if (stepBack > tolerance) return false;
      }
      return true;
    };

    if (turnsOnce(1)) return TURN_SHAPES.PEAK;
    if (turnsOnce(-1)) return TURN_SHAPES.LOW;
    return null;
  }

  /**
   * The runs that say a series turns once, or null when it does not.
   * @param {Object} chart - The adapter's chart
   * @param {Array<number>} values - The series values in source order
   * @param {boolean} withLabel - True to name the highest or lowest point
   * @returns {Array<Object>|null} Runs that start with a space
   */
  function turnClauseRuns(chart, values, withLabel) {
    const { text } = modelCore();
    const shape = turnShape(values);
    if (!shape) return null;
    const clause = TURN_CLAUSE[shape];
    if (!withLabel) return [text(clause.plain)];
    const stats = computeStatistics(values);
    const indices =
      shape === TURN_SHAPES.PEAK ? stats.maxIndices : stats.minIndices;
    const at = pointReferencesRuns(chart, indices, REFERENCE_STYLE.STANDALONE);
    return [text(clause.labelledBefore), ...at, text(clause.labelledAfter)];
  }

  // The trend classes whose wording a single turn replaces. "Consistently" and
  // "stable" make a claim about most steps, and they stay as they are.
  function turnReplacesTrend(trend) {
    return (
      trend === TRENDS.UP_NOISY ||
      trend === TRENDS.DOWN_NOISY ||
      trend === TRENDS.NONE
    );
  }

  /**
   * The unimodal test, stated exactly: strictly one INTERIOR maximum, with the
   * values rising before it and falling after it. A plateau anywhere breaks it,
   * and so does a peak at either end.
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
   * The chart's own type word, from the kinds of series present.
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
   * A series' IDENTITY: the single shared answer to "which series is this?".
   * The composition clause, the insight labels and the table column headers all
   * read it.
   *
   * IT IS ONE FUNCTION BY DESIGN. Two computations of one fact could disagree
   * inside one description: a series called "the second bar series" in the
   * prose, but headed "Bar series" in its column, the same header as its
   * sibling.
   *
   * THE THREE RENDERINGS TAKE THEIR ORDINAL DECISION FROM TWO DIFFERENT
   * PREDICATES OVER THIS ONE OBJECT. This is deliberate:
   *
   *   composition clause  needsIntroductoryOrdinal  (several AND not the first)
   *   insight label       isAmongSeveral            (several, first included)
   *   column header       isAmongSeveral            (several, first included)
   *
   * The composition clause omits position 1's ordinal because position 1 IS the
   * visible first that "a second bar series" counts from. The count includes
   * NAMED series, so a chart whose first bar is named still reads "a bar
   * series named X, a second bar series". It never opens at two with no first
   * anywhere.
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
      unlabelled: series.unlabelled === true,
      overallPosition: allSeries.indexOf(series) + 1,
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
   * write "a eighth bar series", which is wrong English. The article must
   * match the vowel sound that follows it.
   *
   * The digit forms need the same care and the test is on the WHOLE digit
   * prefix rather than its first character: "an 8th", "an 80th" and "an 800th"
   * all open "eight…", and "an 11th" and "an 18th" open "eleventh" and
   * "eighteenth". But "a 110th" opens "one hundred...", so a leading-digit test
   * would get that one wrong.
   *
   * The vowel rule comes from the rules of English and not from a captured
   * description.
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
   * A series' TABLE COLUMN HEADER.
   *
   * A named series uses its name verbatim. An unnamed series among several of
   * its kind is NUMBERED, so two columns of one kind can never carry the same
   * header. The number is a digit here and a word in the prose on purpose: a
   * header cell is scanned, not read as a sentence.
   *
   * @param {Object} series - One adapter series
   * @param {Array<Object>} allSeries - Every series on the chart
   * @returns {Array<Object>} Runs for a column header cell: the author's name
   *   as an author run (raw, escaped once by the renderer), else the
   *   describer's own words as a text run
   */
  function seriesColumnHeader(series, allSeries) {
    const { text, author } = modelCore();
    const identity = seriesIdentity(series, allSeries);
    if (identity.name) {
      const sameName = allSeries.filter((one) => seriesNameKey(one) === seriesNameKey(series));
      if (sameName.length > 1) return [author(identity.name), text(` (series ${sameName.indexOf(series) + 1})`)];
      return [author(identity.name)];
    }

    const base = `${capitalise(identity.kind)} series`;
    return [text(identity.isAmongSeveral ? `${base} ${identity.position}` : base)];
  }

  // Characters that draw as nothing: white space, Unicode format characters (zero-width space, joiner and the like), the combining
  // grapheme joiner, the Hangul fillers, the braille blank U+2800 and the variation selectors. One class serves every name and every
  // label, so nothing is blank in one place and visible in another.
  const INVISIBLE_CHARS = String.raw`\s\p{Cf}\p{Default_Ignorable_Code_Point}\u2800\u001D\u007F`;
  // Characters in the invisible set that Chromium nonetheless draws as ink: U+180F (Mongolian free variation
  // selector four) and the 37 that leave a mark when drawn alone (the Arabic and Syriac number signs, the Ogham space mark, the
  // interlinear annotation anchors, the Kaithi number signs, the Egyptian and shorthand format controls). They are excluded where the
  // class is used, so a name made of one is a name. The 28 members that only advance the line stay in the set.
  const DRAWN_MARKS = String.raw`[\u180F\u{600}-\u{605}\u{6DD}\u{70F}\u{890}-\u{891}\u{8E2}\u{1680}\u{FFF9}-\u{FFFB}\u{110BD}\u{110CD}\u{13430}-\u{1343F}\u{1BCA0}-\u{1BCA3}]`;
  const INVISIBLE_ONE = `(?:(?!${DRAWN_MARKS})[${INVISIBLE_CHARS}])`;

  // A label is blank when it holds only invisible characters.
  const BLANK_LABEL = new RegExp(`^${INVISIBLE_ONE}*$`, "u");
  // A series name compared by the repeat key (see repeatKey): what looks and sounds the same is one name.
  function seriesNameKey(series) {
    return typeof series.name === "string" ? repeatKey(series.name) : "";
  }

  // Two invisible characters that change what a name draws, so the repeat key keeps them where they do: a zero-width joiner between two
  // pictographs (a family of three is not three people side by side) and the tag characters after a pictograph (the flags of England,
  // Scotland and Wales are tags after a black flag). One at the edge of a name, or beside a letter, is junk and is removed.
  const KEY_PICTOGRAPH = String.raw`\p{Extended_Pictographic}`;
  const KEY_TAGS = String.raw`[\u{E0020}-\u{E007F}]`;
  const KEY_KEPT = String.raw`(?:(?<=${KEY_PICTOGRAPH}️?)‍(?=${KEY_PICTOGRAPH})|(?<=${KEY_PICTOGRAPH}${KEY_TAGS}*)${KEY_TAGS})`;
  // The repeat key removes every invisible character, at the ends and inside, before the name is composed (NFC), except white space
  // (a gap a reader sees) and the characters kept above. U+FEFF is white space to JavaScript and draws as nothing, so it goes too.
  const KEY_INVISIBLE = new RegExp(`\\uFEFF|(?!\\s)(?!${KEY_KEPT})${INVISIBLE_ONE}`, "gu");
  // White space the picture does not draw as ink (U+1680, the Ogham space mark, is drawn and so stays a character).
  const KEY_SPACE = String.raw`(?:(?!${DRAWN_MARKS})\s)+`;
  const KEY_SPACE_EDGES = new RegExp(`^${KEY_SPACE}|${KEY_SPACE}$`, "gu");
  const KEY_SPACE_RUN = new RegExp(KEY_SPACE, "gu");

  /**
   * The key two names repeat on, so that names which look and sound the same are a repeat: the invisible characters are removed (bar the
   * kept ones above), the name is composed one way (NFC), white space at its ends is dropped, and every run of white space inside it
   * (no-break, thin, em or ideographic space, tab, line break, two spaces) reads as one space, so "New York" and "New  York" are one
   * name and "New York" and "NewYork" stay two. Case and lookalike letters are kept, so "North" and "NORTH" stay two names.
   * @param {string} name - A segment, axis or series name
   * @returns {string} The key
   */
  function repeatKey(name) {
    return String(name).replace(KEY_INVISIBLE, "").normalize("NFC").replace(KEY_SPACE_EDGES, "").replace(KEY_SPACE_RUN, " ");
  }

  /**
   * True when the label at this index appears more than once on the axis, so a
   * reader given the label alone could not tell which position is meant.
   *
   * Compared on the AUTHOR'S OWN text, before escaping, so two labels that
   * differ only in characters an HTML sink would encode are still two labels.
   * Labels compare on `repeatKey`, as series names do ("Autumn " repeats
   * "Autumn", "New York" with a no-break space repeats "New York"), case is
   * not ignored, and a blank label is never a repeat.
   *
   * @param {Object} chart - The adapter's chart
   * @param {number} index - 0-based point index
   * @returns {boolean} Whether this label is ambiguous
   */
  function isDuplicatedLabel(chart, index) {
    const categories = declaredCategories(chart);
    const label = categories[index];
    if (typeof label !== "string") return false;
    const key = repeatKey(label);
    let seen = 0;
    for (const one of categories) {
      if (typeof one === "string" && !BLANK_LABEL.test(one) && repeatKey(one) === key) seen += 1;
      if (seen > 1) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------
  // How an x position and a series are referred to, as runs
  // ---------------------------------------------------------------------
  //
  // These functions return runs. An author's text enters the model as an
  // author run, and the renderer escapes it once. The describer's own words are
  // text runs.

  /**
   * How a series is referred to in running prose, lower case, ready to be
   * capitalised at a sentence start: the author's series name is an author run
   * between describer text runs.
   *
   * An author's series name is spoken verbatim and in quotes. An unnamed
   * series takes the describer's own noun. It gets an ordinal ONLY where more
   * than one series of that kind exists. Otherwise two unnamed line series
   * would both be "the line series", and a reader could not tell which
   * sentence was about which.
   *
   * The position and the count of siblings come from `seriesIdentity`, so the
   * table headers cannot disagree with this sentence about which series is the
   * second one. The kind is left to the composition clause, which introduces
   * every series before any insight names one.
   *
   * @param {Object} series - One adapter series
   * @param {Array<Object>} allSeries - Every series on the chart
   * @returns {Array<Object>} Runs; the first is always a text run
   */
  function seriesLabelRuns(series, allSeries) {
    const { text, author } = modelCore();
    const identity = seriesIdentity(series, allSeries);

    if (identity.name) {
      // Two series with one name are told apart by their order.
      const sameName = allSeries.filter((one) => seriesNameKey(one) === seriesNameKey(series));
      if (sameName.length > 1 && new Set(sameName.map((one) => one.kind)).size > 1) {
        const ordinal = identity.isAmongSeveral ? `${ordinalWord(identity.position)} ` : "";
        return [text(`the ${ordinal}"`), author(identity.name), text(`" ${series.kind} series`)];
      }
      if (sameName.length > 1) {
        return [text(`the ${ordinalWord(sameName.indexOf(series) + 1)} "`), author(identity.name), text('" series')];
      }
      return [text('the "'), author(identity.name), text('" series')];
    }
    if (!identity.isAmongSeveral) {
      return [text(`the ${identity.kind} series`)];
    }
    return [text(`the ${ordinalWord(identity.position)} ${identity.kind} series`)];
  }

  /**
   * How one x position is named, BEFORE it is wrapped into a sentence: a band
   * label is the author's text inside describer quotes, and an ordinal or
   * position word is describer text. The describer never invents an x
   * position for a numeric-range axis.
   *
   * This function exists so that a tied extreme cannot be named by a second,
   * independent idea of what an x position is called. The list form of a tied
   * extreme has to join bare ordinals ("the second and fourth points"). The
   * full reference cannot supply those without being taken apart again, and
   * taking a formatted string apart is how two computations of one fact start
   * to disagree.
   *
   * @param {Object} chart - The adapter's chart
   * @param {number} index - 0-based point index
   * @returns {Object} `{ kind, runs, disambiguator }` for a label, `{ kind,
   *   runs }` for an ordinal or position word
   */
  function pointReferencePartRuns(chart, index) {
    const { text, author } = modelCore();
    const label = declaredCategories(chart)[index];
    if (typeof label === "string" && BLANK_LABEL.test(label)) {
      // A blank label has no name to speak, so the describer names the position.
      return { kind: "label", runs: [text(`unlabelled category ${index + 1}`)], disambiguator: null };
    }
    if (typeof label === "string") {
      return {
        kind: "label",
        runs: [text('"'), author(label), text('"')],
        // A label that the author used more than once does not identify a
        // position, so the position joins it as describer text. This is NOT a
        // defect in the label, because the author's text must stay verbatim.
        // It fills a gap in the describer's vocabulary. The describer gives an
        // ordinal where there is no label, and a position where the label is
        // ambiguous. Without it, a reader would be told that the maximum was at
        // "Autumn" on a chart that carried two of them, and could not use that
        // answer.
        disambiguator: isDuplicatedLabel(chart, index)
          ? `the ${ordinalWord(index + 1)} ${POSITION_NOUN.position.singular.toLowerCase()}`
          : null,
      };
    }
    // An index PAST the declared labels on a band axis is a POSITION. It is not
    // a "point". The two nouns are kept apart on purpose. "Point" is the word
    // for a location on a numeric-range axis, where there are no labels by
    // construction. If it also meant "a value that the author wrote past the
    // end of their own label list", one insight list would use two idioms for
    // two different things. For example, `Highest value in the bar series: 110
    // (the fourth point).` would sit two items below `The line series peaks at
    // 100 ("Mon").` and nothing would tell a reader that both are the same kind
    // of address.
    const kind = hasDeclaredCategories(chart) ? "position" : "ordinal";
    return { kind: kind, runs: [text(ordinalWord(index + 1))] };
  }

  /**
   * Render one reference part in a given grammatical context. A duplicated
   * label needs two shapes and not one, because the module names a position in
   * two grammatical contexts. A bracket inside a bracket is unreadable aloud,
   * so the parenthetical context takes a comma, as in `("Autumn", the third
   * position)`. The standalone context takes the brackets.
   *
   * A part with NO disambiguator renders identically in both styles. That is
   * why a chart whose labels are unique reads the same in either.
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
   * How a SET of x positions is referred to: every position that holds a tied
   * extreme, in source order. Lists join through `joinRuns`, which gives the
   * same result as `formatList`.
   *
   * A SET OF ONE READS EXACTLY LIKE A SINGLE REFERENCE. This is deliberate.
   *
   * Labels join as they are quoted (`"Feb" and "May"`); ordinals hoist their
   * article and noun so the list is not "the second point and the fourth point"
   * (`the second and fourth points`). From TIED_POSITION_COLLAPSE_AT positions
   * the list collapses to a count, because nobody can hold a spoken list of
   * four positions in mind. A band axis whose overflow indices carry no label
   * can give a MIXED set. That case falls back to joining whole references. It
   * belongs to the family of charts where the labels and the series have
   * different lengths.
   * A TIED extreme that spans two instances of ONE duplicated label is the case
   * where the position words matter most. Without them, the list would read
   * `"Autumn" and "Autumn"`. Each member takes the STANDALONE shape whatever
   * the surrounding context, because a list already carries commas, and a
   * second comma for each item would be unparseable aloud.
   *
   * @param {Object} chart - The adapter's chart
   * @param {Array<number>} indices - 0-based point indices, source order
   * @param {string} style - A REFERENCE_STYLE member
   * @returns {Array<Object>} Runs
   */
  function pointReferencesRuns(chart, indices, style) {
    const { text } = modelCore();
    const runs = pointReferencesCore(chart, indices, style);
    if (!indices.some((i) => isUndrawnIndex(chart, i))) return runs;
    // A position past the last label is in the code and not in the picture: say so, in the shape each context takes.
    return [...runs, text(style === REFERENCE_STYLE.PARENTHETICAL ? `, ${UNDRAWN_NOTE}` : ` (${UNDRAWN_NOTE})`)];
  }

  /**
   * True when a value sits past the last declared label: Mermaid draws nothing there.
   * @param {Object} chart - The adapter's chart
   * @param {number} index - 0-based position
   * @returns {boolean} Whether the position is past the labels
   */
  function isUndrawnIndex(chart, index) {
    return hasDeclaredCategories(chart) && index >= declaredCategories(chart).length;
  }

  function pointReferencesCore(chart, indices, style) {
    const { text } = modelCore();
    if (indices.length === 1) {
      return referenceRuns(pointReferencePartRuns(chart, indices[0]), style);
    }
    if (indices.length >= TIED_POSITION_COLLAPSE_AT) {
      // On a labelled axis the collapsed set is categories, not points.
      if (hasDeclaredCategories(chart)) {
        const declared = declaredCategories(chart).length;
        const inside = indices.filter((i) => i < declared).length;
        const past = indices.length - inside;
        const insideText = `${countWord(inside)} of the ${axisNoun(chart).plural}`;
        if (past === 0) return [text(insideText)];
        const pastText = `${countWord(past)} ${past === 1 ? "position" : "positions"} past the labels`;
        return [text(inside === 0 ? pastText : `${insideText} and ${pastText}`)];
      }
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
   * How a series is INTRODUCED, in the detailed tier's series sentence: the
   * describer's introduction of one series, with the author's series name as an
   * author run inside describer quotes.
   *
   * A name never replaces the kind. It joins the kind. A clause that read
   * `a series named "X"` would leave a combined chart, where every series has
   * a name, with nothing in the whole detailed description to say which series
   * is drawn as bars: the insights say `the "X" series` and the table columns
   * are headed with the names. A sighted reader has the shapes. A reader using
   * a screen reader would have neither the shapes nor the words for them.
   *
   * @param {Object} series - One adapter series
   * @param {Array<Object>} allSeries - Every series on the chart
   * @returns {Array<Object>} Runs; the first is always a text run
   */
  function seriesCompositionPhraseRuns(series, allSeries) {
    const { text, author } = modelCore();
    const identity = seriesIdentity(series, allSeries);

    let phrase;
    if (identity.needsIntroductoryOrdinal) {
      const ordinal = ordinalWord(identity.position);
      phrase = `${ordinalArticle(ordinal)} ${ordinal} ${identity.kind} series`;
    } else {
      phrase = `a ${identity.kind} series`;
    }

    if (!identity.name) return [text(phrase)];
    return [text(`${phrase} named "`), author(identity.name), text('"')];
  }

  /**
   * The noun that a COUNT takes, singular at one. Every clause in this module
   * that pairs a count with a noun calls this function, so the choice of
   * singular or plural is made in one place.
   *
   * The singular is lower-cased because the label-type nouns are stored with a
   * capital letter for their use as table headers. THIS DOES NOT TOUCH AUTHOR
   * TEXT. Every noun that reaches this function is the describer's own. An
   * author's x-axis title never becomes one. A title that does not name the
   * detected label type sends the detector back to Category and categories.
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
   * declares none. This is the one place that decides whether a chart has
   * declared labels.
   *
   * A source with no `x-axis` line at all reaches this code as a RANGE axis
   * with null bounds. It never arrives as a band axis with an empty
   * `categories` array. So "band axis" and "declares categories" mean the same
   * thing, and the length test below is defensive. No caller reaches that
   * branch. It stays because the match is a property of the adapter and not of
   * this module.
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
   * True when the declared labels govern this chart: a band axis with declared
   * labels.
   * @param {Object} chart - The adapter's chart
   * @returns {boolean} Whether the declared chart wins
   */
  function hasDeclaredCategories(chart) {
    return declaredCategories(chart).length > 0;
  }

  /**
   * How many x positions the chart HAS. The answer is **the declared count**.
   *
   * IT IS NOT `Math.max(labels, longest series)`. A chart that declared three
   * days and carried a series of five values would claim "five shared days".
   * No series has that count, and the author never wrote it. Every later
   * computation would inherit the wrong count: the count clauses, the number
   * of rows in the table, the ordinals that would leak onto a band axis, and
   * the denominator of every statistic. The author's declaration is the chart.
   * A series that disagrees with it is a mismatch that the description must
   * DECLARE. It is not a reason to redefine the chart.
   *
   * A range axis declares no positions, so the values are all there is to
   * count.
   *
   * NOTE THE TABLE DOES NOT USE THIS. Data is never dropped, so the table spans
   * every position that has a label OR a value. See `tableRowCount`.
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
   * value. The declared labels still define the chart, but a value that the
   * author wrote is never silently discarded. An overflow row is named as a
   * position and kept.
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
   * each with the direction of its disagreement. The list is empty on a chart
   * with no declared labels, and empty on a chart that matches its
   * declaration.
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
   * always wins, so the title is never changed. The describer's own neutral
   * noun counts the positions, with one exception: when the title contains a
   * word that starts with the detected noun ("Month", "Monthly figures",
   * "Academic year"), the title and the labels agree, and the detected noun
   * counts them ("six months"). A title that names something else, such as
   * "Team member" over April, May and June, keeps the neutral noun.
   *
   * The pattern is built from the describer's own noun and never from author
   * text.
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
    const found = detectLabelNoun(chart.xAxis.categories || []);
    const title = chart.xAxis.title;
    const titleNamesLabels =
      found.detected &&
      new RegExp("\\b" + found.singular.toLowerCase(), "i").test(title || "");
    if (title && !titleNamesLabels) {
      return {
        singular: FALLBACK_NOUN.singular,
        plural: FALLBACK_NOUN.plural,
        detected: false,
      };
    }
    return found;
  }

  /**
   * True when the axis carries both declared bounds. A description speaks the
   * source's DECLARATIONS and never the renderer's computed ticks, because the
   * ticks can differ from the declarations.
   * @param {Object|null} axis - An adapter axis
   * @returns {boolean} Whether bounds may be spoken
   */
  function hasBounds(axis) {
    return (
      !!axis && typeof axis.min === "number" && typeof axis.max === "number"
    );
  }

  // ---------------------------------------------------------------------
  // The takeaway
  // ---------------------------------------------------------------------

  /**
   * The chart's primary takeaway: one sentence, the short tier's second and
   * the detailed tier's first, bolded, insight.
   *
   * THIS FUNCTION AVOIDS THREE CHART.JS DEFECTS:
   *   - It does NOT carry the bar chart's trend branch, because that branch
   *     pairs the words "increased by" with a MIN-TO-MAX range and not with a
   *     first-to-last change. Sentences about a trend appear on line series
   *     only, and never on a numeric-range x-axis.
   *   - It rewords the above-average sentence so that the sentence has a verb.
   *   - On a numeric-range x-axis, every template that needs a label is
   *     unavailable by construction, because there are no labels. So the
   *     range form, which needs no label, carries the takeaway.
   *
   * The function returns runs. An author's series name or category label is an
   * author run, escaped once by whatever renders it, and everything else is
   * describer text. `tier` stays as a parameter because it changes words (the
   * rounding, and the fixed short sentence for series of different lengths),
   * not escaping.
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
      // THE COMPARISON IS SUPPRESSED WHEN THE LENGTHS DIFFER, and the mismatch
      // becomes the takeaway itself. A mean over two values set against a mean
      // over five is not a like-for-like comparison, and the sentence it
      // would produce tells the reader nothing. "The line series shows the
      // highest overall values." would be both the bold first insight AND the
      // second sentence of the short tier, on a chart where that series has no
      // value at all for three of the five positions.
      //
      // Note that the test is whether the lengths differ FROM EACH OTHER, not
      // whether they differ from the declaration. Series that agree with each
      // other are comparable, and the mismatch sentence in the construction
      // paragraph supplies the denominator.
      const lengths = series.map((one) => valueCount(one));
      if (new Set(lengths).size > 1) {
        // The SHORT tier takes the fixed sentence and drops the list of series,
        // because that list has no length limit. It grows with the number of
        // series AND with the length of the author's series names. A chart of
        // three series can give a short description of 353 characters, against
        // a cap of 250 characters for a short description. The short
        // description is the SVG aria-label and the visible figcaption.
        //
        // This applies to the SHORT tier only. The detailed tier keeps the
        // list. That costs the reader nothing they would notice, because the
        // mismatch sentences in the construction paragraph carry the same
        // per-series counts either way. Repeating a subordinate fact in the
        // takeaway is accepted.
        if (tier === TIERS.SHORT) {
          return [text("The chart's series have different numbers of values.")];
        }
        const clauses = series.map((one) => [
          ...seriesLabelRuns(one, series),
          text(` has ${countWord(valueCount(one))}`),
        ]);
        return [
          text("The chart's series have different numbers of values: "),
          ...joinRuns(clauses),
          text("."),
        ];
      }

      // Means count as equal when they differ by no more than a relative gap of 1e-14, so that sums which differ
      // only by floating-point noise are equal and means that differ at the thirteenth figure are not.
      // Two series of finite values are compared exactly (sumA x countB against sumB x countA, as big integers), never as two doubles.
      const allStats = series.map((one) => computeStatistics(one.values));
      const means = allStats.map((one) => one.mean);
      const bounds = series.map((one) => floatNoiseBound(one.values));
      const bothExact = (i, j) => allStats[i].exactSum !== null && allStats[j].exactSum !== null;
      const compareExact = (i, j) =>
        compareExactMeans(allStats[i].exactSum, allStats[i].count, allStats[j].exactSum, allStats[j].count);
      const isHigher = (i, j) => {
        if (!bothExact(i, j)) return means[i] > means[j];
        return compareExact(i, j) > 0;
      };
      let highestAt = 0;
      for (let i = 1; i < series.length; i += 1) {
        if (isHigher(i, highestAt)) highestAt = i;
      }
      const sameMean = (i) => {
        if (bothExact(i, highestAt)) return compareExact(i, highestAt) === 0;
        return Math.abs(means[i] - means[highestAt]) <= bounds[i] + bounds[highestAt];
      };
      const leaders = series.filter((one, i) => sameMean(i));
      // A mean that is not a number (outside the stated input) names the first series, as before.
      if (leaders.length === 0) leaders.push(series[0]);
      if (leaders.length === series.length) {
        return [text("The series have the same average.")];
      }
      if (leaders.length > 1) {
        return [
          ...capitaliseRuns(
            joinRuns(leaders.map((one) => seriesLabelRuns(one, series)))
          ),
          text(" show the highest overall values."),
        ];
      }
      return [
        ...capitaliseRuns(seriesLabelRuns(leaders[0], series)),
        text(" shows the highest overall values."),
      ];
    }

    const only = series[0];
    const stats = computeStatistics(only.values);
    const ends = formatRangeEndsForTier(tier, stats.min, stats.max);
    const meanEnds = endsHoldingMean(ends, stats);
    const meanText = spokenAverage(stats, meanEnds);
    // Only the sentence that speaks the average takes the cleared ends: a line chart's "ranging from" has no average beside it.
    const averageEnds = endsClearOfMean(meanEnds, stats, meanText);
    const rangeSentence = [text(`${RANGE_SENTENCE_OPENING}${averageEnds.min} to ${averageEnds.max} with an average of ${meanText}.`)];

    // THE TEST FOR NO VARIANCE COMES FIRST. A series with no variance cannot be
    // described by a range, a trend or a ratio. The range collapses ("Values
    // range from 42 to 42"). The trend at one value is the UNKNOWN SENTINEL,
    // which would reach the reader as the word "unknown" in the aria-label.
    // Both ratios are exactly 1. Each of these reads as a defect, and all
    // three have the same cure: state the fact once.
    if (isDegenerateSeries(stats)) return degenerateTakeaway(chart, stats, tier);

    if (isRangeAxis) return rangeSentence;
    if (!Number.isFinite(stats.mean) || stats.mean === 0) return rangeSentence;

    const maxRatio = highPointRatio(stats);
    const minRatio = stats.min / stats.mean;

    if (only.kind === SERIES_KINDS.LINE) {
      const trend = analyseTrend(only.values);
      if (
        trend === TRENDS.UP ||
        trend === TRENDS.DOWN ||
        trend === TRENDS.RISES ||
        trend === TRENDS.FALLS
      ) {
        return [
          ...capitaliseRuns(seriesLabelRuns(only, series)),
          text(
            ` ${TREND_CLAUSE[trend]}, ranging from ${ends.min} to ${ends.max}.`
          ),
        ];
      }
      if (maxRatio > HIGH_POINT_RATIO) {
        return [
          ...capitaliseRuns(seriesLabelRuns(only, series)),
          text(` peaks at ${formatAuthorValueForTier(tier, stats.max)} during `),
          ...pointReferencesRuns(chart, stats.maxIndices, REFERENCE_STYLE.STANDALONE),
          text(", well above its average."),
        ];
      }
      const turnRuns = turnReplacesTrend(trend)
        ? turnClauseRuns(chart, only.values, true)
        : null;
      if (turnRuns) {
        return [
          ...capitaliseRuns(seriesLabelRuns(only, series)),
          ...turnRuns,
          text(", with values between " + ends.min + " and " + ends.max + "."),
        ];
      }
      // `is ${trend}` CANNOT RECEIVE THE UNKNOWN SENTINEL. analyseTrend returns
      // UNKNOWN only below two values, and a series of nought or one value never
      // reaches this line. One value is degenerate and returned above, and an
      // empty series is caught by the zero-mean guard.
      // The unclear trend is a verb in TREND_CLAUSE ("fluctuates with no clear trend"), so it takes no "is":
      // one form of the phrase, as in the zigzag sentence.
      const trendPhrase = trend === TRENDS.NONE ? TREND_CLAUSE[trend] : `is ${trend}`;
      return [
        ...capitaliseRuns(seriesLabelRuns(only, series)),
        text(
          ` ${trendPhrase}, with values between ${ends.min} and ${ends.max}.`
        ),
      ];
    }

    if (maxRatio > HIGH_POINT_RATIO) {
      return [
        text(`The highest value, ${formatAuthorValueForTier(tier, stats.max)} at `),
        ...pointReferencesRuns(chart, stats.maxIndices, REFERENCE_STYLE.STANDALONE),
        text(`, is ${exactPercentFromAverage(stats, stats.max, true) ?? Math.round((maxRatio - 1) * 100)}% above the average.`),
      ];
    }
    // This is the sign guard, and it is deliberately NOT mirrored above.
    // "N% below the average" is a claim about a PROPORTION of the average, so a
    // reader takes 100% as its ceiling. The figure passes 100% exactly when the
    // minimum and the mean have opposite signs. So a chart of budget variances
    // could say "136% below the average". The above-average form
    // has no such ceiling. "300% above the average" is four times the average,
    // and it means exactly what it says. So widening this guard to both
    // branches would suppress a sentence that is doing its job.
    if (minRatio < LOW_POINT_RATIO && stats.min >= 0) {
      const below = Number(exactPercentFromAverage(stats, stats.min, false) ?? Math.round((1 - minRatio) * 100));
      return [
        text(`The lowest value, ${formatAuthorValueForTier(tier, stats.min)} at `),
        ...pointReferencesRuns(chart, stats.minIndices, REFERENCE_STYLE.STANDALONE),
        text(`, is ${stats.min > 0 && below >= 100 ? "more than 99" : below}% below the average.`),
      ];
    }
    return rangeSentence;
  }

  /**
   * The ratio of the highest value to the average, which the takeaway compares with HIGH_POINT_RATIO.
   * @param {Object} stats - Statistics from computeStatistics
   * @returns {number} The ratio
   */
  function highPointRatio(stats) {
    const largest = Math.max(Math.abs(stats.max), Math.abs(stats.min));
    if (stats.min < 0 && stats.mean < MIXED_SIGN_MEAN_MIN_SHARE * largest) return 0;
    return stats.max / stats.mean;
  }

  /**
   * The takeaway for a series with no variance.
   *
   * One value earns a sentence that names it. More than one value earns a
   * count. Neither form pretends to a range, a trend or a ratio, because a
   * degenerate series has none of the three, and every template that assumed
   * otherwise gave a wrong sentence.
   *
   * THE POSITION CLAUSE IS FOR A BAND AXIS ONLY. On a numeric-range axis the
   * position would be an ordinal that the describer owns, and "the first point"
   * on a chart with exactly one point tells a reader nothing that the word
   * "single" does not already say. The describer never invents an x position,
   * and this is the case where the ordinal that it does allow carries no
   * information.
   *
   * SCOPE: charts with one series. `buildTakeawayRuns` returns the comparison
   * across series before it reaches here on a chart with more than one series.
   * So a degenerate series ALONGSIDE others still speaks through the ordinary
   * insight sentences. Whether it should is an open question, and this
   * function does not decide it.
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
      // The comma before "at" is part of the exact text and not a stylistic
      // choice. The position is an appositive on the value.
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
    // English says "Both", not "All two". A flat series of two points would read
    // `All two values are 42.` Three values and up keep the "All N" form.
    if (stats.count === 2) return [text(`Both values are ${value}.`)];
    return [text(`All ${countWord(stats.count)} values are ${value}.`)];
  }

  /**
   * The insight for a degenerate series ALONGSIDE others.
   *
   * The whole insight block becomes ONE sentence. The extremes go, and on a
   * line series the trend line goes with them. This differs from the form for
   * a single-series chart, which KEEPS the trend. On a chart with one series,
   * the trend sentence is the only shape left in the description. Here, the
   * chart's other series still carry the story.
   *
   * This sentence is what makes dropping the extremes safe: without it the
   * series would have no insight at all. Keeping the extremes would also go
   * wrong. On a TIED degenerate series, the tied-position rule fires too, and
   * a multi-series chart would read `peaks at 300, at "2023", "2024", and
   * "2025"` immediately above `reaches its lowest point at 300, at "2023",
   * "2024", and "2025"`. That names the same three positions as both
   * extremes, in full.
   *
   * The series identity comes from `seriesIdentity`, so a named series reads
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
    // reaches the short tier, so the short tier's rounding must not touch it.
    const value = formatAuthorValue(stats.max);
    if (stats.count === 1) {
      return item([...capitaliseRuns(label), text(` has a single value, ${value}.`)]);
    }
    return item([text("Every value in "), ...label, text(` is ${value}.`)]);
  }


  // ---------------------------------------------------------------------
  // The short tier
  // ---------------------------------------------------------------------

  /**
   * What the picture shows in the value axis's place, or null.
   *
   * Where the y-axis has no title AND the chart has exactly one series AND that
   * series is named AND the picture draws the name, the name stands in for the
   * y-descriptor in the short opening and in Construction. The y-axis sentence
   * still describes the axis as untitled: nothing calls the axis by this name.
   *
   * The caller states whether the picture draws the name
   * (`options.drawsSeriesName`, ON unless told otherwise) because the words
   * must not put in a caption text the picture does not show. Mermaid 11.17.2
   * draws it as a legend entry.
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
   * The span clause of a declared band axis: `, from "FIRST" to "LAST"`. These
   * are the first and last DECLARED labels, verbatim and quoted, as author runs
   * inside describer quotes, so the renderer escapes them once. One category
   * reads `, "LABEL"` (the caller's count phrase has already said "one
   * <noun>"). A label that repeats on the axis takes the standalone shape of
   * a position reference. This clause is for the detailed tier only. A range
   * axis, and a chart with no x-axis, declare no categories, and so they give
   * no runs.
   *
   * @param {Object} chart - The adapter's chart
   * @returns {Array<Object>} Runs with the leading comma, or none
   */
  function constructionSpanRuns(chart) {
    const { text } = modelCore();
    const declared = declaredCategories(chart).length;
    if (declared === 0) return [];
    const first = referenceRuns(
      pointReferencePartRuns(chart, 0),
      REFERENCE_STYLE.STANDALONE
    );
    if (declared === 1) return [text(", "), ...first];
    const last = referenceRuns(
      pointReferencePartRuns(chart, declared - 1),
      REFERENCE_STYLE.STANDALONE
    );
    return [text(", from "), ...first, text(" to "), ...last];
  }

  /**
   * The short tier's opening sentence as runs. The title, the y-axis title, the
   * series name that stands in for a missing y-axis title, and the x-axis title
   * are author runs inside describer quotes. Everything else is describer text.
   *
   * @param {Object} chart - The adapter's chart
   * @param {Object} [options] - `{ drawsSeriesName: boolean }`; see
   *   `drawnSeriesName`. This is a trailing options object and not a field on
   *   the chart. The chart is the adapter's model of the diagram, and whether
   *   the picture draws a name belongs to the caller that rendered the picture.
   * @returns {Array<Object>} Runs for one sentence, ending in a full stop
   */
  function buildShortOpeningRuns(chart, options) {
    const { text, author } = modelCore();
    const typeWord = chartTypeWord(chart.series);
    const noun = axisNoun(chart);
    const count = pointCount(chart);
    const standIn = drawnSeriesName(chart, options);

    const runs = [text(`A ${typeWord} chart`)];
    if (chart.title) {
      runs.push(text(' titled "'), author(chart.title), text('"'));
    }
    if (chart.yAxis && chart.yAxis.title) {
      runs.push(text(' showing "'), author(chart.yAxis.title), text('"'));
    } else if (standIn !== null) {
      runs.push(text(' showing "'), author(standIn), text('"'));
    }
    if (typeWord === "combined") {
      runs.push(text(` with ${buildComposition(chart.series)}`));
    }

    if (chart.xAxis && chart.xAxis.kind === AXIS_KINDS.BAND) {
      const shared = typeWord === "combined" ? "shared " : "";
      const preposition = typeWord === SERIES_KINDS.LINE ? "over" : "for";
      // A combined chart's series clause already reads as a list, so its
      // positions are joined with "over" whatever the preposition would be.
      const joiner = typeWord === "combined" ? "over" : preposition;
      runs.push(text(` ${joiner} ${countWord(count)} ${shared}${countedNoun(noun, count)}`));
    } else if (chart.xAxis && chart.xAxis.title) {
      runs.push(text(' across "'), author(chart.xAxis.title), text('"'));
      if (hasBounds(chart.xAxis)) {
        runs.push(text(` from ${formatAuthorValue(chart.xAxis.min)} to ${formatAuthorValue(chart.xAxis.max)}`));
      }
    } else if (hasBounds(chart.xAxis)) {
      runs.push(text(` across an x-axis running from ${formatAuthorValue(chart.xAxis.min)} to ${formatAuthorValue(chart.xAxis.max)}`));
    }

    runs.push(text("."));
    return runs;
  }

  /**
   * The composition clause for a combined chart: "one bar series and one line
   * series". "Series" has no separate plural, so the count word carries the
   * number.
   *
   * THIS IS THE SHORT TIER'S CLAUSE, AND IT DELIBERATELY CARRIES NO SERIES
   * NAMES. It counts by kind. The detailed tier's series sentence introduces
   * each series one by one through `seriesCompositionPhraseRuns`. The two are
   * different on purpose: the short tier is a caption, and naming five series
   * in one would stop it being a caption. Do not "align" the two.
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
  // The detailed tier
  // ---------------------------------------------------------------------

  /**
   * The Chart Construction paragraphs as model blocks: one
   * paragraph of sentences joined by a describer space, then the axis
   * paragraph when there is one. Author text (the title, the y-descriptor, the
   * x-axis title, the category labels, the series names) enters only as author
   * runs, raw; the renderer escapes it once.
   * @param {Object} chart - The adapter's chart
   * @param {Object} [options] - `{ drawsSeriesName: boolean }`; see
   *   `drawnSeriesName`
   * @returns {Array<Object>} One or two model paragraphs
   */
  function buildConstructionBlocks(chart, options) {
    const { text, author, paragraph } = modelCore();
    const typeWord = chartTypeWord(chart.series);
    const noun = axisNoun(chart);
    const count = pointCount(chart);
    const standIn = drawnSeriesName(chart, options);

    // There is no `is drawn` fallback. The news that a chart is *drawn*
    // tells the reader nothing, and on its own it would be the weakest sentence
    // that this module could write, in the most prominent position in the
    // detailed tier. Where there is no y-descriptor, the opening sentence has nothing to
    // say about the chart. So it merges with the series sentence, which turns
    // two thin sentences into one that says something.
    //
    // A series name that the picture draws stands in for the y-title. So it
    // counts as a y-descriptor here, and the sentence does not merge.
    const hasYDescriptor =
      !!(chart.yAxis && chart.yAxis.title) || standIn !== null;

    const opening = [text(`This ${typeWord} chart`)];
    if (chart.title) {
      opening.push(text(' titled "'), author(chart.title), text('"'));
    }
    if (hasYDescriptor) {
      opening.push(
        text(' shows "'),
        author(standIn !== null ? standIn : chart.yAxis.title),
        text('"')
      );
    }

    // THE ONLY BRANCH THAT SPEAKS A POSITION COUNT is the band one. The
    // "of N values" clause below depends on this test.
    const openerSpeaksCount =
      !!chart.xAxis && chart.xAxis.kind === AXIS_KINDS.BAND;
    let spanClause = [];
    if (openerSpeaksCount) {
      const shared = typeWord === "combined" ? "shared " : "";
      const preposition = typeWord === SERIES_KINDS.LINE ? "over" : "for";
      opening.push(text(` ${preposition} ${countWord(count)} ${shared}${countedNoun(noun, count)}`));
      // The opening names the span of the declared axis. On the merged sentence
      // (the one with no y-descriptor), the span sits before "has" and a comma
      // closes it, so the sentence still reads as one.
      spanClause = constructionSpanRuns(chart);
      opening.push(...spanClause);
    } else if (chart.xAxis && chart.xAxis.title) {
      opening.push(text(' across "'), author(chart.xAxis.title), text('"'));
    }

    // The "of N values" clause. The test is stated exactly, because a wider test
    // would attach the clause where it is not wanted. The clause
    // attaches only on the merged sentence (the one with no y-descriptor), and
    // only where the opening sentence speaks no position count of its own.
    // Otherwise "for five days ... of five values" would say the same number
    // twice.
    //
    // ON A MULTI-SERIES CHART IT ATTACHES TO EACH SERIES, never to the chart.
    // There is no single N on such a chart. A count for the whole chart would
    // state a denominator that is false for every series but one. Note that
    // this clause never collides with the mismatch sentences below. Those fire
    // only on a DECLARED BAND AXIS, which is exactly the case where this clause
    // does not fire. The two complement each other by construction, and neither
    // ever speaks over the other.
    const wantsValueCounts = !hasYDescriptor && !openerSpeaksCount;
    const valuesOf = (series) =>
      text(` of ${countWord(series.values.length)} ${countedNoun(VALUE_NOUN, series.values.length)}`);

    const seriesClause = [text(`${countWord(chart.series.length)} data series`)];
    if (chart.series.length > 1) {
      seriesClause.push(
        text(": "),
        ...joinRuns(
          chart.series.map((one) => [
            ...seriesCompositionPhraseRuns(one, chart.series),
            ...(wantsValueCounts ? [valuesOf(one)] : []),
          ])
        )
      );
    } else if (wantsValueCounts) {
      seriesClause.push(valuesOf(chart.series[0]));
    }

    const sentences = hasYDescriptor
      ? [
          [...opening, text(".")],
          [text("The chart has "), ...seriesClause, text(".")],
        ]
      : [
          [
            ...opening,
            ...(spanClause.length > 0 ? [text(MERGED_SPAN_CLOSE)] : []),
            text(" has "),
            ...seriesClause,
            text("."),
          ],
        ];

    // THE MISMATCH IS DECLARED. The describer states any content that it could
    // not match. It never leaves that content out silently, because silence
    // looks the same as absence. Without this, a chart that declared five days
    // and carried three values would say "for five days" and "an average of
    // 31" in one description. A reader who multiplied the two would get a total
    // that is two thirds larger than the chart's own.
    //
    // ORDERING NOTE. The sentence about a horizontal chart comes
    // immediately after the series sentence. The mismatch sentences follow it
    // and do not displace it. Nothing decides this order for certain: it is a
    // choice.
    const mismatchSentences = mismatchedSeries(chart).map((m) => {
      // "against" for an overflow, "for" for a shortfall. The two directions
      // read differently.
      const joiner = m.overflow ? "against" : "for";
      return [
        ...capitaliseRuns(seriesLabelRuns(m.series, chart.series)),
        text(
          ` has ${countWord(m.values)} ${countedNoun(VALUE_NOUN, m.values)} ${joiner} ` +
            `${countWord(m.declared)} declared ${countedNoun(noun, m.declared)}.`
        ),
      ];
    });

    // Orientation is not decoration. Mermaid's `xychart-beta horizontal` renames
    // every axis group and removes the bottom-axis group entirely. A
    // description that ignored this would let a reader picture the wrong axis
    // carrying the categories. NOTE: this sentence is the describer's own
    // prose, not a quotation from Chart.js.
    if (chart.orientation === ORIENTATIONS.HORIZONTAL) {
      sentences.push([
        text(
          "The chart is drawn horizontally, so the x-axis runs along the side of the chart and the y-axis runs across it."
        ),
      ]);
    }

    sentences.push(...mismatchSentences);

    // The sentences are joined by one describer space.
    const paragraphs = [paragraph(joinSentenceRuns(sentences))];

    const axisRuns = buildAxisSentenceRuns(chart);
    if (axisRuns !== null) paragraphs.push(paragraph(axisRuns));

    return paragraphs;
  }

  /**
   * Sentences (each a list of runs) joined by a single describer space.
   * @param {Array<Array<Object>>} sentences
   * @returns {Array<Object>} The joined runs
   */
  function joinSentenceRuns(sentences) {
    const { text } = modelCore();
    const runs = [];
    sentences.forEach((sentence, index) => {
      if (index > 0) runs.push(text(" "));
      runs.push(...sentence);
    });
    return runs;
  }

  /**
   * The axis sentence as runs. The describer speaks declared bounds and never
   * rendered ticks. The axis titles are author runs inside describer quotes.
   * @param {Object} chart - The adapter's chart
   * @returns {Array<Object>|null} Runs for the sentence, or null when there is
   *   nothing to say
   */
  function buildAxisSentenceRuns(chart) {
    const { text, author } = modelCore();
    const noun = axisNoun(chart);
    const count = pointCount(chart);

    let xClause = null;
    if (chart.xAxis && chart.xAxis.kind === AXIS_KINDS.BAND) {
      xClause = chart.xAxis.title
        ? [
            text('The x-axis, "'),
            author(chart.xAxis.title),
            text(`", lists ${countWord(count)} ${countedNoun(noun, count)}`),
          ]
        // This is NOT a place that pairs a count with a noun, and it is
        // deliberately left plural. It names what KIND of thing the axis
        // carries, and it takes no count at all.
        : [text(`${capitalise(noun.plural)} are plotted on the x-axis`)];
    } else if (chart.xAxis && hasBounds(chart.xAxis)) {
      const bounds = `runs from ${formatAuthorValue(chart.xAxis.min)} to ${formatAuthorValue(chart.xAxis.max)}`;
      xClause = chart.xAxis.title
        ? [text('The x-axis, "'), author(chart.xAxis.title), text(`", ${bounds}`)]
        : [text(`The x-axis ${bounds}`)];
    } else if (chart.xAxis && chart.xAxis.title) {
      xClause = [text('The x-axis is titled "'), author(chart.xAxis.title), text('"')];
    }

    let yClause = null;
    if (chart.yAxis) {
      if (chart.yAxis.title && hasBounds(chart.yAxis)) {
        yClause = [
          text('the y-axis, "'),
          author(chart.yAxis.title),
          text(`", runs from ${formatAuthorValue(chart.yAxis.min)} to ${formatAuthorValue(chart.yAxis.max)}`),
        ];
      } else if (hasBounds(chart.yAxis)) {
        yClause = [
          text(`the y-axis runs from ${formatAuthorValue(chart.yAxis.min)} to ${formatAuthorValue(chart.yAxis.max)}`),
        ];
      } else if (chart.yAxis.title) {
        yClause = [text('the y-axis is titled "'), author(chart.yAxis.title), text('"')];
      }
    }

    // Say so when a value lies outside the declared y-axis range.
    const low = chart.yAxis ? Math.min(chart.yAxis.min, chart.yAxis.max) : NaN;
    const high = chart.yAxis ? Math.max(chart.yAxis.min, chart.yAxis.max) : NaN;
    const outside =
      yClause && hasBounds(chart.yAxis) &&
      chart.series.some((one) => one.values.some((value) => typeof value === "number" && (value < low || value > high)))
        ? [text(" Some values lie outside the y-axis range.")]
        : [];
    if (xClause && yClause) return [...xClause, text(", and "), ...yClause, text("."), ...outside];
    if (xClause) return [...xClause, text(".")];
    if (yClause) return [...capitaliseRuns(yClause), text("."), ...outside];
    return null;
  }

  /**
   * The Key Insights list items, with the takeaway first and in bold.
   *
   * SINGLE-SERIES CHARTS EARN THE FULL STATISTICS TIER. MULTI-SERIES CHARTS DO
   * NOT. On a chart of two series, a bar series of six values gets highest and
   * lowest only: no average, no standard deviation, no median and no
   * distribution sentence. The line series gets a trend, a peak and a lowest
   * value, but neither the cyclic sentence nor the start-to-end sentence,
   * though a 65% rise would otherwise trigger the latter. Statistics about one series among several
   * invite a comparison that the chart does not support.
   *
   * @param {Object} chart - The adapter's chart
   * @returns {Object} One list block (model list), never empty
   */
  function buildInsightsModel(chart, wholeChart = chart) {
    const { list, item, strong } = modelCore();
    const takeawayRuns = buildTakeawayRuns(chart, TIERS.DETAILED);
    const items = [item([strong(takeawayRuns)]), ...undrawnValueItems(wholeChart)];
    // Only a takeaway that is the range sentence speaks an average beside the range, and the "Average value:" bullet then repeats that figure.
    const printsRangeSentence = takeawayRuns.length > 0 && String(takeawayRuns[0].value).startsWith(RANGE_SENTENCE_OPENING);
    const isRangeAxis = !chart.xAxis || chart.xAxis.kind === AXIS_KINDS.RANGE;

    if (chart.series.length === 1) {
      const only = chart.series[0];
      if (only.kind === SERIES_KINDS.LINE) {
        items.push(...buildLineInsights(chart, only, isRangeAxis, true));
      } else {
        items.push(...buildBarInsights(chart, only, true, { printsRangeSentence }));
      }
      return list(items);
    }

    // ORDER ON A MULTI-SERIES CHART: every line series first, then every bar
    // series, even when the bar series comes first in the source. ONE EXAMPLE
    // CANNOT TELL THIS RULE APART FROM "highest mean first": a chart whose line
    // series has the mean 275.0 and whose bar series has the mean 274.8333
    // gives the same order either way. Treat the rule as an inference, not as
    // settled.
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
   * The end of a "Highest value" or "Lowest value" bullet: where the value is.
   * The positions of a tie sit in the sentence, not inside brackets, as the
   * line series already does, but only when a tied label is itself repeated:
   * that is the one case with brackets inside brackets.
   * @param {Object} chart - The adapter's chart
   * @param {Array<number>} indices - The 0-based points holding the value
   * @returns {Array<Object>} Runs that finish the bullet, full stop included
   */
  function valueAtRuns(chart, indices) {
    const { text } = modelCore();
    if (indices.length > 1 && indices.some((i) => isDuplicatedLabel(chart, i))) {
      return [text(", at "), ...pointReferencesRuns(chart, indices, REFERENCE_STYLE.STANDALONE), text(".")];
    }
    return [text(" ("), ...pointReferencesRuns(chart, indices, REFERENCE_STYLE.PARENTHETICAL), text(").")];
  }

  /**
   * A bar series' insights.
   * @param {Object} chart - The adapter's chart
   * @param {Object} series - The bar series
   * @param {boolean} isOnlySeries - True when this is the chart's only series
   * @param {{printsRangeSentence: boolean}} [takeaway] - Whether the takeaway is the range sentence, whose average the bullet then repeats
   * @returns {Array<Object>} List items (model items)
   */
  function buildBarInsights(chart, series, isOnlySeries, takeaway = { printsRangeSentence: false }) {
    const { text, item } = modelCore();
    const stats = computeStatistics(series.values);
    const items = [];

    // A degenerate series among others is one sentence.
    if (!isOnlySeries && isDegenerateSeries(stats)) {
      return [degenerateSeriesInsight(chart, series, stats)];
    }

    if (isOnlySeries) {
      // On a degenerate series, the pair of extremes would be a contradiction
      // read aloud: "Highest value: 12 ("Mon"). Lowest value: 12 ("Mon")." The
      // takeaway has also already stated the fact once. THE STATISTICS TIER
      // BELOW IS UNTOUCHED. "Standard deviation: 0." is the honest form of the
      // same fact, and it is the strongest thing that the list can say about it.
      if (!isDegenerateSeries(stats)) {
        items.push(
          item([
            text(`Highest value: ${formatAuthorValue(stats.max)}`),
            ...valueAtRuns(chart, stats.maxIndices),
          ])
        );
        items.push(
          item([
            text(`Lowest value: ${formatAuthorValue(stats.min)}`),
            ...valueAtRuns(chart, stats.minIndices),
          ])
        );
      }
      // Where the takeaway is the range sentence, the bullet speaks the same average; elsewhere it is as it was.
      const averageText = takeaway.printsRangeSentence
        ? spokenAverage(stats, formatRangeEndsForTier(TIERS.DETAILED, stats.min, stats.max))
        : formatMean(stats.mean, stats.min, stats.max, meanExactOf(stats));
      items.push(item([text(`Average value: ${averageText}.`)]));

      if (stats.count >= STATISTICS_MIN_POINTS) {
        items.push(
          item([text(`Standard deviation: ${formatSpread(stats)}.`)])
        );
        items.push(item([text(`Median value: ${formatMean(stats.median, stats.min, stats.max, stats.medianExact)}.`)]));
        items.push(item([text(buildDistributionSentence(stats))]));
      }
      return items;
    }

    const label = seriesLabelRuns(series, chart.series);
    items.push(
      item([
        text("Highest value in "),
        ...label,
        text(`: ${formatAuthorValue(stats.max)}`),
        ...valueAtRuns(chart, stats.maxIndices),
      ])
    );
    items.push(
      item([
        text("Lowest value in "),
        ...label,
        text(`: ${formatAuthorValue(stats.min)}`),
        ...valueAtRuns(chart, stats.minIndices),
      ])
    );
    return items;
  }

  /**
   * The distribution sentence, from Chart.js's skew test.
   *
   * Chart.js's own five-way branch puts two sentences about a trend ahead of
   * the three sentences about skew. This code writes sentences about a trend
   * for LINE series only, so a bar chart reaches the skew test directly. So a
   * bar series with consistently increasing values can still read as
   * symmetric.
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
   * THE TREND GATE: on a numeric-range x-axis, no trend, cyclic or
   * start-to-end sentence appears at all. The x-axis is a continuous quantity
   * and not an ordered sequence of occasions, and "over time" language would
   * make a claim that the chart does not make. A unimodal series earns one
   * sentence of its own instead.
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

    // A degenerate series among others is one sentence. On a line series that
    // sentence replaces the TREND line as well as the extremes. This is the one
    // place where the multi-series form differs from the single-series form,
    // which keeps the trend.
    if (!isOnlySeries && isDegenerateSeries(stats)) {
      return [degenerateSeriesInsight(chart, series, stats)];
    }

    if (!isRangeAxis) {
      const trend = analyseTrend(series.values);
      const clause = TREND_CLAUSE[trend];
      const turn = turnReplacesTrend(trend)
        ? turnClauseRuns(chart, series.values, false)
        : null;
      // The takeaway (the first bullet) already says a consistent trend, so it is not repeated.
      const takeawayStatesTrend =
        isOnlySeries &&
        Number.isFinite(stats.mean) &&
        stats.mean !== 0 &&
        !isDegenerateSeries(stats) &&
        (trend === TRENDS.UP || trend === TRENDS.DOWN || trend === TRENDS.RISES || trend === TRENDS.FALLS || !(highPointRatio(stats) > HIGH_POINT_RATIO));
      if (turn && !takeawayStatesTrend) items.push(item([...capitaliseRuns(label), ...turn, text(".")]));
      else if (clause && !turn && !takeawayStatesTrend) items.push(item([...capitaliseRuns(label), text(` ${clause}.`)]));
    }

    // This is the line-chart side of dropping the extremes on a flat series. The
    // trend insight above SURVIVES. "Shows a stable trend" is true of a flat
    // series, and it is the one thing worth saying about it. Only the pair of
    // sentences that claims a unique high and a unique low goes.
    if (!(isOnlySeries && isDegenerateSeries(stats))) {
      // A tie takes a different SHAPE, and a longer reference is not enough. A
      // parenthetical that carries "and" after a bare number reads as though it
      // qualified the number. So the tied form moves the positions into the
      // sentence.
      const peakTied = stats.maxIndices.length > 1;
      const lowTied = stats.minIndices.length > 1;
      // THE STYLE FOLLOWS THE SHAPE, and the code chooses the two together. The
      // tied form moves the positions into the sentence (standalone). The
      // untied form keeps them in brackets (parenthetical). One reference
      // computed for both branches would put the comma form inside brackets on
      // a duplicated label, which is the exact failure that the two styles
      // exist to prevent.
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
    const lineTrend = analyseTrend(series.values);
    const saysConsistent = lineTrend === TRENDS.UP || lineTrend === TRENDS.DOWN;
    if (shape.peaks > 1 && shape.troughs > 1 && !saysConsistent) {
      items.push(
        item([
          text(
            `The data rises and falls repeatedly, with ${countWord(shape.peaks)} peaks and ${countWord(shape.troughs)} troughs${highestAtEndsClause(series.values)}.`
          ),
        ])
      );
    }

    const first = series.values[0];
    const last = series.values[series.values.length - 1];
    if (first !== 0) {
      const percentChange = ((last - first) / Math.abs(first)) * 100;
      if (Math.abs(percentChange) > OVERALL_CHANGE_MIN_PERCENT) {
        // A start that is near zero, or on the other side of zero from the end, makes the percentage a function of the start.
        const scale = Math.max(...series.values.map((value) => Math.abs(value)));
        if (first < 0 || first * last < 0 || Math.abs(first) < NEAR_ZERO_START_SHARE * scale) {
          items.push(item([text(`Overall, the values go from ${formatAuthorValue(first)} at the start to ${formatAuthorValue(last)} at the end.`)]));
          return items;
        }
        items.push(
          item([
            text(
              `Overall ${percentChange > 0 ? "increase" : "decrease"} of ${exactPercentChange(first, last) ?? Math.abs(percentChange).toFixed(1)}% from start to end.`
            ),
          ])
        );
      }
    }

    return items;
  }

  /**
   * The data table.
   *
   * Column headers use the author's axis titles where declared. Otherwise they
   * use the noun from label-type detection, and then Category or Value. A
   * numeric-range x-axis gives "Point". Every row label is a
   * `<th scope="row">`. The Chart.js table does not have this.
   *
   * Built as ONE model table node, so every decision lives here and the
   * renderer writes the markup.
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
    // The DECLARED count is the chart's, but a value that the author wrote is
    // never dropped. So the table spans every position that carries a label or
    // a value. That is `tableRowCount`, not `pointCount`.
    const rows = tableRowCount(chart);

    // A NUMERIC-RANGE X-AXIS ALWAYS GIVES "Point", even where the author titled
    // it. For example, an axis titled "Mark awarded" still gets the column
    // header "Point". The column holds ordinals that
    // the describer owns, not the author's quantity, so the author's title would
    // label it wrongly. The describer speaks that title in the axis sentence
    // and in the short tier instead.
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

    // The row header for an overflow position is `Position 4`, never the bare
    // digit. A reader who moves down the row-header column would hear three
    // weekdays and then two numbers, with nothing to say that they were the
    // same kind of thing. The digit form stays only where the chart
    // declares no labels at all, which means a numeric-range axis.
    const overflowHeader = hasDeclaredCategories(chart)
      ? (i) => `${POSITION_NOUN.position.singular} ${i + 1}`
      : (i) => String(i + 1);

    const tableRows = [];
    for (let i = 0; i < rows; i += 1) {
      // Duplicated labels are a STRUCTURAL accessibility fault in a table, not
      // only a fault in the prose. A `scope="row"` header is how a screen reader
      // names a cell's row on entry. So two rows headed `Autumn` leave a reader
      // hearing "Autumn, 150" and later "Autumn, 170", with nothing to tell the
      // rows apart and no way to match them to the prose above. EVERY instance
      // of a duplicated label gets a number, including the first. If only the
      // repeats were numbered, the first would look like the only one.
      const rowLabel = isBandAxis
        ? typeof categories[i] === "string"
          ? BLANK_LABEL.test(categories[i])
            ? [text(`Unlabelled category ${i + 1}`)]
            : isDuplicatedLabel(chart, i)
            ? [
                author(categories[i]),
                text(` (${POSITION_NOUN.position.singular.toLowerCase()} ${i + 1})`),
              ]
            : [author(categories[i])]
          : [text(overflowHeader(i))]
        : [text(String(i + 1))];
      const cells = chart.series.map((one) => {
        const value = one.values[i];
        // A position that a series has no value for says so. A reader cannot
        // tell an empty cell from a recorded zero.
        // A cell value is the describer's own formatting, never escaped
        // (formatAuthorValue is String(value)).
        if (value === undefined) return [text(NO_VALUE_TEXT)];
        return [text(isUndrawnIndex(chart, i) ? `${formatAuthorValue(value)} (${UNDRAWN_NOTE})` : formatAuthorValue(value))];
      });
      tableRows.push({ header: rowLabel, cells });
    }

    return table({ caption, columns: [xHeader, ...valueHeaders], rows: tableRows });
  }

  /**
   * The chart cut back to what the picture draws: a series with more values than the x-axis has labels keeps the first ones,
   * and remembers how many it held.
   * @param {Object} chart - The adapter's chart
   * @returns {Object} The chart, or a copy with the undrawn values left off
   */
  function drawnOnly(chart) {
    if (!hasDeclaredCategories(chart)) return chart;
    const declared = declaredCategories(chart).length;
    if (!chart.series.some((one) => one.values.length > declared)) return chart;
    return {
      ...chart,
      series: chart.series.map((one) =>
        one.values.length > declared ? { ...one, values: one.values.slice(0, declared), totalValues: one.values.length } : one
      ),
    };
  }

  /**
   * How many values a series holds in the code, drawn or not.
   * @param {Object} series - One adapter series
   * @returns {number} The count
   */
  function valueCount(series) {
    return series.totalValues === undefined ? series.values.length : series.totalValues;
  }
  /**
   * One insight per series that holds values past the last label: it names them, with the disclosure.
   * @param {Object} chart - The adapter's chart, whole
   * @returns {Array<Object>} List items
   */
  function undrawnValueItems(chart) {
    if (!hasDeclaredCategories(chart)) return [];
    const { text, item } = modelCore();
    const declared = declaredCategories(chart).length;
    return chart.series
      .filter((one) => one.values.length > declared)
      .map((one) => {
        const past = one.values.slice(declared);
        const count = countWord(past.length);
        const named =
          past.length <= UNDRAWN_LIST_MAX
            ? `${count} ${past.length === 1 ? "value" : "values"} past the last label: ${past.map(formatAuthorValue).join(", ").replace(/, ([^,]*)$/, " and $1")}`
            : `${count} values past the last label`;
        const label = seriesLabelRuns(one, chart.series);
        return item([...capitaliseRuns(label), text(` also holds ${named} (${UNDRAWN_NOTE}).`)]);
      });
  }

  /**
   * The chart with every blank title and series name taken out, so that no sentence quotes an empty name. A blank
   * title or axis title reads as no title. A blank series name is marked, and is spoken as "unlabelled series N".
   * @param {Object} chart - The adapter's chart
   * @returns {Object} A copy with blank text removed
   */
  function withoutBlankText(chart) {
    const clean = (value) => (typeof value === "string" && BLANK_LABEL.test(value) ? null : value);
    return {
      ...chart,
      title: clean(chart.title),
      xAxis: chart.xAxis ? { ...chart.xAxis, title: clean(chart.xAxis.title) } : chart.xAxis,
      yAxis: chart.yAxis ? { ...chart.yAxis, title: clean(chart.yAxis.title) } : chart.yAxis,
      series: (chart.series || []).map((one) =>
        typeof one.name === "string" && BLANK_LABEL.test(one.name) ? { ...one, name: null, unlabelled: true } : one
      ),
    };
  }

  /**
   * The xychart's description as a model. The short sentence is runs: the
   * opening, a describer space, and the SHORT takeaway. The three headed
   * sections come in a fixed order: Chart Construction, Key Insights and Data
   * Table. Author text enters only as author runs, raw, and the renderer
   * escapes it once.
   *
   * @param {Object} chart - The adapter's chart
   * @param {Object} [options] - `{ drawsSeriesName: boolean }`; see
   *   `drawnSeriesName`
   * @returns {Object} A DescriptionModel (see model.js)
   */
  function buildXychartModel(givenChart, options) {
    const { text, section, description } = modelCore();
    const chart = withoutBlankText(givenChart);
    // The figures (range, average, trend, highest and lowest) cover the drawn values only.
    const figures = drawnOnly(chart);

    // The short tier says so when the picture leaves values out, because its figures cover the drawn ones only.
    const undrawnTotal = figures.series.reduce((sum, one) => sum + valueCount(one) - one.values.length, 0);
    const undrawnShort =
      undrawnTotal === 1
        ? [text(" One further value is written in the code and not drawn.")]
        : undrawnTotal > 1
          ? [text(` ${capitalise(countWord(undrawnTotal))} further values are written in the code and not drawn.`)]
          : [];
    const shortRuns = [
      ...buildShortOpeningRuns(chart, options),
      ...undrawnShort,
      text(" "),
      ...buildTakeawayRuns(figures, TIERS.SHORT),
    ];

    const sections = [
      section(buildConstructionBlocks(chart, options), {
        heading: [text("Chart Construction")],
      }),
      section([buildInsightsModel(figures, chart)], { heading: [text("Key Insights")] }),
      section([buildTableModel(chart)], { heading: [text("Data Table")] }),
    ];

    return description(shortRuns, sections);
  }

  logInfo("Xychart builder initialised successfully");

  const api = {
    buildXychartModel,
  };

  root.ChartDescribeXychart = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
