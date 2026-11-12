/**
 * Chart description builders: the pie family.
 *
 * This file exports buildPieModel and keeps everything that function needs.
 * It serves pie, doughnut and polar-area charts. It exports itself as
 * window.ChartDescribePie. In Node it also sets module.exports.
 *
 * It reads the helpers in charts-shared.js when a function runs, never when
 * the file loads. It needs text.js, model.js and charts-shared.js to load
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
      console.error(`[Chart Describe Pie] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Chart Describe Pie] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Chart Describe Pie] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Chart Describe Pie] DEBUG: ${message}`, ...args);
    }
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

  /** The shared `modelCore` (charts-shared.js), resolved at call time. */
  function modelCore() {
    return shared().modelCore();
  }

  /** The shared `joinRuns` (charts-shared.js), resolved at call time. */
  function joinRuns(entries) {
    return shared().joinRuns(entries);
  }

  // ---------------------------------------------------------------------
  // Pie chart builders
  // ---------------------------------------------------------------------
  //
  // These builders describe pie, doughnut and polar-area charts, so every
  // adapter speaks about them with one voice. escapeHtml and formatList come
  // from ChartDescribeText through textCore(). Change a sentence only on
  // purpose, because the goldens in test/ pin the wording.
  //
  // The chart they describe is a list of { name, value } segments.

  /**
   * Render a segment value or total at the precision the author wrote it
   *
   * An integer renders bare, so a count of 142 is not read out as "142.0";
   * a value the author wrote with decimals renders exactly as the number
   * holds it. This is the single choke point for VALUE rendering, so no call
   * site can impose a fixed precision on its own.
   *
   * PERCENTAGES do not come through here. They are computed rather than
   * authored, and one decimal place is the right precision for them, so they
   * keep their own toFixed(1).
   *
   * @param {number} value - The segment value or total
   * @returns {string} The value as text, with no imposed precision
   */
  function formatValue(value) {
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

  // A share this close to a simple fraction IS that fraction: the sum of
  // authored decimals carries floating-point noise (1/3 of 0.3 is not 0.1).
  const FRACTION_TOLERANCE = 1e-12;
  const SIGNIFICANT_DIGITS = 12;
  // A total with a whole part this long needs more digits to keep its fraction.
  // Float noise from adding values sits beyond the fifteenth digit.
  const LARGE_TOTAL_WHOLE_DIGITS = 12;
  const LARGE_TOTAL_DIGITS = 15;
  // A share that prints as 0.0% but is above zero reads as this instead.
  const BELOW_ONE_TENTH = "less than 0.1%";
  // A share below the whole that prints as 100.0% reads as this instead.
  const ABOVE_99_9 = "more than 99.9%";

  // One emptiness test for every name AND every title (shared across the three files): white space,
  // Unicode format characters, every character Unicode marks Default_Ignorable_Code_Point (combining grapheme
  // joiner, Hangul fillers, Khmer vowel inherents, Mongolian selectors, variation selectors, tag characters),
  // and the Braille blank (which draws as nothing but is not default-ignorable). The C0 and C1 controls and U+180F are NOT in the
  // set: Chromium draws or advances them, so a name made of them is something a sighted reader sees.
  const INVISIBLE_CHARS = "[\\s\\p{Cf}\\p{Default_Ignorable_Code_Point}\\u2800\\u001D\\u007F]";
  // Characters in the invisible set that Chromium nonetheless draws as ink: U+180F (Mongolian free variation
  // selector four) and the 37 that leave a mark when drawn alone (the Arabic and Syriac number signs, the Ogham space mark, the
  // interlinear annotation anchors, the Kaithi number signs, the Egyptian and shorthand format controls). They are excluded where the
  // class is used, so a name made of one is a name. The 28 members that only advance the line stay in the set.
  const DRAWN_MARKS = String.raw`[\u180F\u{600}-\u{605}\u{6DD}\u{70F}\u{890}-\u{891}\u{8E2}\u{1680}\u{FFF9}-\u{FFFB}\u{110BD}\u{110CD}\u{13430}-\u{1343F}\u{1BCA0}-\u{1BCA3}]`;
  const INVISIBLE_ONE = `(?:(?!${DRAWN_MARKS})${INVISIBLE_CHARS})`;
  const BLANK_TEXT = new RegExp(`^${INVISIBLE_ONE}*$`, "u");
  const BLANK_EDGES = new RegExp(`^${INVISIBLE_ONE}+|${INVISIBLE_ONE}+$`, "gu");

  /** The noun for a count: "category" for one, "categories" otherwise. */
  /** True when the author gave a title: not undefined, null, empty or only spaces. A title of 0 counts. */
  function hasTitle(title) {
    return title !== undefined && title !== null && !BLANK_TEXT.test(String(title));
  }

  function categoryNoun(count) {
    return count === 1 ? "category" : "categories";
  }

  /**
   * A total with float noise removed: twelve significant digits, unless it is
   * a whole number, which is written as it is. A total with twelve or
   * more whole digits keeps fifteen, so its fraction survives. A rounding that
   * would overflow (a finite sum near the largest number) keeps the unrounded total.
   */
  function cleanTotal(total, places = 0) {
    // A whole-number total needs no rounding: formatValue prints every digit, and from 2^53 every
    // double is a whole number, so there is no fraction or noise to remove. A total that reaches the
    // next line is below 2^53, so its whole part never prints in exponent form.
    if (Number.isInteger(total)) {
      return total;
    }
    const wholeDigits = String(Math.trunc(Math.abs(total))).length;
    // The finest decimal place any value carries is exact in the sum while the whole part and those places
    // fit in fifteen digits, so the total is written to that place and no noise digit survives.
    if (wholeDigits + places <= LARGE_TOTAL_DIGITS) {
      return Number(total.toFixed(places));
    }
    const digits =
      wholeDigits >= LARGE_TOTAL_WHOLE_DIGITS
        ? LARGE_TOTAL_DIGITS
        : SIGNIFICANT_DIGITS;
    const rounded = Number(total.toPrecision(digits));
    return Number.isFinite(rounded) ? rounded : total;
  }

  // The most digits an exact decimal total may carry. A double holds fifteen digits for certain and a sixteenth in many cases, so
  // a total of sixteen digits or fewer is written exactly; a longer one cannot be held by the sum and keeps the rounding above.
  const EXACT_TOTAL_MAX_DIGITS = 16;

  /**
   * The total as the sum of the values exactly as they are written, so it is never smaller than one of its own parts and
   * carries no float noise. Each value is read from its own text (formatValue) and added as a whole number of its finest place.
   * Returns null when a value is not plain digits (not finite) or the sum needs more than sixteen digits.
   * @param {Array<{value: number}>} segments - The segments
   * @returns {string|null} The total as text, or null
   */
  function exactDecimalTotal(segments) {
    const parts = [];
    let places = 0;
    for (const segment of segments) {
      const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(formatValue(segment.value));
      if (!match) return null;
      const [, sign, whole, fraction = ""] = match;
      parts.push({ sign, whole, fraction });
      places = Math.max(places, fraction.length);
    }
    const sum = parts.reduce((running, { sign, whole, fraction }) => {
      const scaled = BigInt(whole + fraction.padEnd(places, "0"));
      return sign ? running - scaled : running + scaled;
    }, 0n);
    // A pie of whole numbers keeps the whole-number rule (every digit of the nearest double), so only a decimal value comes here.
    if (places === 0) return null;
    const digits = (sum < 0n ? -sum : sum).toString().padStart(places + 1, "0");
    const written = `${digits.slice(0, -places)}.${digits.slice(-places)}`.replace(/\.?0+$/, "");
    // Count the digits that matter: not the leading zeros, not the point.
    if (written.replace(/^0?\.?0*/, "").replace(".", "").length > EXACT_TOTAL_MAX_DIGITS) return null;
    return sum < 0n ? `-${written}` : written;
  }

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

  /** The most decimal places any segment value is written with. */
  function finestDecimalPlaces(segments) {
    return segments.reduce((finest, segment) => {
      const text = formatValue(segment.value);
      const point = text.indexOf(".");
      return point < 0 ? finest : Math.max(finest, text.length - point - 1);
    }, 0);
  }

  /** True when any segment is below zero, so its share of a pie has no meaning. */
  function hasNegativeValue(segments) {
    return segments.some((segment) => segment.value < 0);
  }

  /** True when shares can be stated: no negative value, and a total above zero. */
  function sharesAreStated(segments, total) {
    return total > 0 && !hasNegativeValue(segments);
  }

  // How close twice a scaled share must sit to an odd whole number to count as a half, in steps between neighbouring doubles
  // at that number. A share is one division and a few multiplications from its two sums, so it is off by a few steps at most;
  // an absolute tolerance would take a share that really sits beside a boundary (20.04999999999%) for the boundary.
  const HALF_STEPS = 4;

  /**
   * A number rounded to a count of decimal places, halves away from zero (the radar's helper).
   * @param {number} number - The number to round
   * @param {number} places - Decimal places to keep
   * @returns {number} The rounded number
   */
  function roundHalfAwayFromZero(number, places) {
    const scale = 10 ** places;
    const magnitude = Math.abs(number) * scale;
    const twice = magnitude * 2;
    const nearestTwice = Math.round(twice);
    const isHalf =
      Math.abs(twice - nearestTwice) <= HALF_STEPS * Number.EPSILON * twice && nearestTwice % 2 === 1;
    const roundedMagnitude = isHalf ? (nearestTwice + 1) / 2 : Math.round(magnitude);
    const rounded = (Math.sign(number) * roundedMagnitude) / scale;
    return rounded === 0 ? 0 : rounded;
  }

  /**
   * A value's share of the total, as a percentage to one decimal place, halves away from zero. Two
   * whole numbers that a double holds exactly have an exact share, so it is worked out exactly;
   * any other share uses the tolerance above.
   */
  function roundedShare(value, total) {
    if (value >= 0 && total > 0 && Number.isSafeInteger(value) && Number.isSafeInteger(total)) {
      const whole = BigInt(total);
      return Number((BigInt(value) * 2000n + whole) / (2n * whole)) / 10;
    }
    return roundHalfAwayFromZero((value / total) * 100, 1);
  }

  /**
   * A percentage as narration: one decimal place, except that a non-zero share
   * which would print as 0.0% reads "less than 0.1%".
   */
  function formatPercentage(value, total) {
    // Halves round away from zero, as the radar's averages do: 86.1 of 168 is 51.25% and reads 51.3%.
    const text = roundedShare(value, total).toFixed(1);
    if (value > 0 && text === "0.0") return BELOW_ONE_TENTH;
    return value < total && text === "100.0" ? ABOVE_99_9 : text + "%";
  }

  /**
   * The phrase for the largest share, tested on the UNROUNDED fraction.
   * "exactly" when within tolerance of the fraction, "over" only above it.
   */
  function proportionPhrase(value, total) {
    const fraction = value / total;
    // Two whole numbers that a double holds exactly carry no float noise, so their share is tested exactly.
    const exact = Number.isSafeInteger(value) && Number.isSafeInteger(total);
    const near = (target) =>
      exact
        ? value * Math.round(1 / target) === total
        : Math.abs(fraction - target) <= FRACTION_TOLERANCE;
    // The share as the reader hears it: the one the row prints, rounded the same way (halves away from zero). One that prints as a
    // simple fraction without being it reads "about", so "50.0%" never sits beside "over half", nor "25.0%" beside nothing.
    const printed = roundedShare(value, total).toFixed(1);
    const printsAs = (target) => printed === (target * 100).toFixed(1);
    if (near(1 / 2)) return "exactly half";
    if (printsAs(1 / 2)) return "about half";
    if (fraction > 1 / 2) return "over half";
    if (near(1 / 3)) return "exactly a third";
    if (printsAs(1 / 3)) return "about a third";
    if (fraction > 1 / 3) return "over a third";
    if (near(1 / 4)) return "exactly a quarter";
    if (printsAs(1 / 4)) return "about a quarter";
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
    const tiedWith = (anchor) => (segment) =>
      segment.value === anchor ||
      Math.abs(segment.value - anchor) <=
        FRACTION_TOLERANCE * Math.max(Math.abs(segment.value), Math.abs(anchor));
    const largest = segments.filter(tiedWith(first));
    const allEqual = segments.length > 1 && largest.length === segments.length;
    // The tolerance is not transitive: a middle value can sit within it of both ends while the ends are not
    // tied with each other. The largest group keeps such a value, and the smallest group does not repeat it.
    const smallest = segments
      .filter(tiedWith(last))
      .filter((segment) => allEqual || !largest.includes(segment));
    return {
      largest,
      smallest,
      allEqual,
      largestSame: valuesAreSame(largest),
      smallestSame: valuesAreSame(smallest),
    };
  }

  // Digits a double carries reliably: two values equal at this many significant digits differ by float noise at most.
  const SAME_VALUE_DIGITS = 15;

  /**
   * True when two values are one value, so "each" and "equal" are true of them. Two whole numbers
   * carry no float noise, so they are one value only when they are equal. Any other pair is one
   * value when it is equal to the digits a double carries.
   */
  function sameValue(a, b) {
    if (Number.isInteger(a) && Number.isInteger(b)) return a === b;
    return Number(a.toPrecision(SAME_VALUE_DIGITS)) === Number(b.toPrecision(SAME_VALUE_DIGITS));
  }

  /** True when the segments' values are one value, so "each" and "equal" are true. */
  function valuesAreSame(group) {
    return group.every((segment) => sameValue(segment.value, group[0].value));
  }

  /** "All four segments are equal" (two slices read "Both"); "about equal" when the values differ. */
  function allEqualLead(count, same = true) {
    const equal = same ? "equal" : "about equal";
    return count === 2
      ? `Both segments are ${equal}`
      : `All ${countWord(count)} segments are ${equal}`;
  }

  // The kinds of section and list entry the pie model names. The adapter that
  // renders a pie chart supplies a profile that maps each kind to its own
  // class names.
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

  const UNLABELLED_SEGMENT = "unlabelled segment";

  // A name is blank when it holds only white space and Unicode format characters
  // (zero-width space, zero-width joiner, word joiner, soft hyphen).
  const BLANK_NAME = BLANK_TEXT;
  // White space and format characters at either end of a name do not change how it sounds or looks.
  const NAME_EDGES = BLANK_EDGES;

  // What buildPieModel learned about each segment BEFORE it sorted them:
  // declaration position (over ALL segments), whether the name is blank,
  // whether the name repeats.
  const SEGMENT_NAMES = new WeakMap();

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

  function registerSegmentNames(segments) {
    const counts = new Map();
    segments.forEach((segment) => {
      const name = String(segment.name);
      if (BLANK_NAME.test(name)) return;
      const key = repeatKey(name);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    segments.forEach((segment, index) => {
      const name = String(segment.name);
      const unlabelled = BLANK_NAME.test(name);
      SEGMENT_NAMES.set(segment, {
        position: index + 1,
        unlabelled,
        // A blank name is never "repeated": it already reads "unlabelled segment N".
        repeated: !unlabelled && counts.get(repeatKey(name)) > 1,
      });
    });
  }

  /**
   * A segment's name as the chart author wrote it, a label term over one author
   * run. A blank name is the describer's own phrase, "unlabelled segment N".
   * A name the chart uses more than once carries its declaration position,
   * "North (segment 2)", in every place it appears. Author text is never changed.
   * @param {Object} segment - A segment
   * @param {Object} [options] - { opening: true } where the name opens a
   *   sentence or a list item
   */
  function segmentLabel(segment, options = {}) {
    const { text, term, author } = modelCore();
    const name = String(segment.name);
    const facts = SEGMENT_NAMES.get(segment);
    if (facts && facts.unlabelled) {
      const phrase = `${UNLABELLED_SEGMENT} ${facts.position}`;
      return term("label", [
        text(options.opening ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : phrase),
      ]);
    }
    if (facts && facts.repeated) {
      return term("label", [author(name), text(` (segment ${facts.position})`)]);
    }
    return term("label", [author(name)]);
  }

  /**
   * The percentage runs of a group: one percentage (with " each" for a tie) when every member's
   * share prints the same; otherwise each member's own share, in the order the group lists them,
   * so no share is given that the member's own data row does not print.
   */
  function groupPercentages(group, total, each) {
    const { text, term } = modelCore();
    const shares = group.map((segment) => formatPercentage(segment.value, total));
    if (shares.every((share) => share === shares[0])) {
      return [term("percentage", [text(shares[0])]), ...each];
    }
    return joinRuns(shares.map((share) => [term("percentage", [text(share)])]));
  }

  /**
   * The percentage runs of a tie sentence ("at 6.3% each"): the one share every member's own row prints, or, where the
   * rows differ, the lowest and the highest printed share ("6.2% to 6.3%"), so the sentence never gives a share that
   * no member's row carries. The group is ordered by the share as rounded, which is what each row prints.
   */
  function sharedShareRuns(group, total) {
    const { text, term } = modelCore();
    const shareOf = (segment) => roundedShare(segment.value, total);
    const lowest = group.reduce((one, other) => (shareOf(other) < shareOf(one) ? other : one));
    const highest = group.reduce((one, other) => (shareOf(other) > shareOf(one) ? other : one));
    const low = formatPercentage(lowest.value, total);
    const high = formatPercentage(highest.value, total);
    if (low === high) return [term("percentage", [text(low)])];
    return [term("percentage", [text(low)]), text(" to "), term("percentage", [text(high)])];
  }

  /**
   * One Key Insights entry for the largest or the smallest group. A group of
   * one reads "Largest segment: X (v, p)"; a tie reads "Largest segments: X and
   * Y (v each, p each)".
   * @returns {Object} A list entry (model item)
   */
  function extremeItem(kind, label, group, total, same = true) {
    const { text, term, item } = modelCore();
    const tied = group.length > 1;
    const each = tied ? [text(" each")] : [];
    // A tie whose values differ lists each value, so "each" is never said of values that are not one value. A tie whose values are one
    // value but are written differently (0.30000000000000004 and 0.3) lists each as well, so no member reads a value its own row does not print.
    const written = group.map((segment) => formatValue(segment.value));
    const values = tied && !(same && written.every((one) => one === written[0]))
      ? joinRuns(written.map((one) => [term("value", [text(one)])]))
      : [term("value", [text(written[0])]), ...each];

    return item(
      [
        text(`${label} segment${tied ? "s" : ""}: `),
        ...joinRuns(group.map((segment) => [segmentLabel(segment)])),
        text(" ("),
        ...values,
        text(", "),
        ...groupPercentages(group, total, each),
        text(")"),
      ],
      { role: kind }
    );
  }

  const PIE_TOTAL_OVERFLOW = "The pie values add up to more than a number can hold.";

  // A tie of more names than the cap is cut to the first few and a count, so the short description does
  // not grow with the size of a tie. The Largest segments line in Key Insights still names them all.
  const TIE_NAMES_CAP = 5;
  const TIE_NAMES_KEPT = 5;

  function tiedNames(group) {
    const { text } = modelCore();
    const label = (segment, index) => [segmentLabel(segment, { opening: index === 0 })];
    if (group.length <= TIE_NAMES_CAP) return joinRuns(group.map(label));
    const runs = [];
    group.slice(0, TIE_NAMES_KEPT).forEach((segment, index) => {
      if (index > 0) runs.push(text(", "));
      runs.push(...label(segment, index));
    });
    runs.push(text(` and ${countWord(group.length - TIE_NAMES_KEPT)} more`));
    return runs;
  }

  const ZERO_SENTENCE =
    "Every value is zero, so no segment is larger than another.";

  const NEGATIVE_SENTENCE =
    "Some values are negative, so shares are not given.";

  /**
   * The sentence that names the largest segment(s), as runs. This is the one
   * place the short description and the Key Insights read from, so they
   * cannot drift apart.
   * @returns {Array} The runs of the sentence
   */
  function largestSentence(segments, total) {
    const { text, term } = modelCore();
    if (hasNegativeValue(segments)) return [text(NEGATIVE_SENTENCE)];
    if (total === 0 && segments.length === 1) {
      return [segmentLabel(segments[0], { opening: true }), text(" is the only segment, and its value is zero.")];
    }
    if (total === 0) return [text(ZERO_SENTENCE)];

    const ties = readTies(segments);
    const largest = segments[0];
    const percentage = term("percentage", [
      text(formatPercentage(largest.value, total)),
    ]);

    // One segment is the whole pie, not the largest of several.
    if (segments.length === 1) {
      return [
        segmentLabel(largest, { opening: true }),
        text(" is the only segment, at "),
        percentage,
        text(" of the total."),
      ];
    }

    if (ties.allEqual) {
      return [
        text(`${allEqualLead(segments.length, ties.largestSame)}, at `),
        ...sharedShareRuns(segments, total),
        text(" each."),
      ];
    }

    if (ties.largest.length > 1) {
      return [
        ...tiedNames(ties.largest),
        // Two values that differ are not one value, so they are not "joint": the same "about equal" the all-equal sentence uses.
        text(ties.largestSame ? " are the joint largest segments, at " : " are the largest segments, about equal, at "),
        ...sharedShareRuns(ties.largest, total),
        text(" each."),
      ];
    }

    const proportion = proportionPhrase(largest.value, total);
    return [
      segmentLabel(largest, { opening: true }),
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

    registerSegmentNames(segments);

    // Sort segments by value (descending)
    segments.sort((a, b) => b.value - a.value);

    logDebug("Processed " + segments.length + " segments");

    const total = compensatedSum(segments.map((segment) => segment.value));

    // Finite values whose float sum overflows would give every segment a share of 0%. Refuse, as a thrown
    // error with a stable message, rather than describe a chart wrongly. (NaN and Infinity inputs are not this case.)
    if (!Number.isFinite(total) && segments.every((segment) => Number.isFinite(segment.value))) {
      throw new RangeError(PIE_TOTAL_OVERFLOW);
    }

    logDebug("Total value across all segments: " + total);

    const titleRuns = hasTitle(title)
      ? [text(' titled "'), term("title", [author(String(title))]), text('"')]
      : [];

    // 1. The short description. An untitled chart has no "titled" clause.
    const countClause = segments.length
      ? ` showing the distribution of ${countWord(segments.length)} ${categoryNoun(segments.length)}.`
      : " with no categories.";
    const short = [text("A pie chart"), ...titleRuns, text(countClause)];
    if (segments.length > 0) {
      short.push(text(" "), ...largestSentence(segments, total));
    }

    // 2. Chart Construction
    const constructionBlocks = [
      paragraph([
        text("This pie chart"),
        ...titleRuns,
        text(segments.length ? " shows the distribution of categories." : " has no categories."),
      ]),
    ];
    if (segments.length > 0) {
      constructionBlocks.push(
        paragraph([
          text("The chart shows "),
          term("count", [text(countWord(segments.length))]),
          text(` ${categoryNoun(segments.length)}:`),
        ]),
        // The author's name, as written. Every section spells a category the
        // same way.
        list(
          segments.map((segment) => item([segmentLabel(segment, { opening: true })])),
          { role: PIE_ROLES.CATEGORIES }
        )
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
          term("value", [text(exactDecimalTotal(segments) ?? formatValue(cleanTotal(total, finestDecimalPlaces(segments))))]),
        ],
        { role: PIE_ROLES.TOTAL }
      )
    );

    // Largest and smallest segments. When every value is zero there are no
    // percentages to narrate; when every slice is equal the primary insight
    // has said so, and a largest and a smallest line would contradict it.
    if (segments.length > 0 && sharesAreStated(segments, total)) {
      const ties = readTies(segments);
      if (!ties.allEqual && segments.length > 1) {
        insightItems.push(
          extremeItem(PIE_ROLES.LARGEST, "Largest", ties.largest, total, ties.largestSame),
          extremeItem(PIE_ROLES.SMALLEST, "Smallest", ties.smallest, total, ties.smallestSame)
        );
      }
    }

    // 4. Complete Data Points: every segment with its value, and its
    // percentage unless every value is zero (there is no share to state).
    const statesShares = sharesAreStated(segments, total);
    const dataItems = segments.map((segment) =>
      item(
        [
          segmentLabel(segment, { opening: true }),
          text(": "),
          term("value", [text(formatValue(segment.value))]),
          ...(statesShares
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
      // An empty pie has no data points to list.
      ...(segments.length
        ? [
            section([list(dataItems, { role: PIE_ROLES.DATA })], {
              role: PIE_ROLES.DATA,
              heading: [text("Complete Data Points")],
            }),
          ]
        : []),
    ];

    // The pattern section needs enough segments to identify patterns, and a
    // total to state them against
    if (segments.length >= 3 && statesShares) {
      logDebug(
        "Generating pattern analysis for " + segments.length + " segments"
      );
      const pattern = generatePatternSection(segments, total);
      if (pattern) sections.push(pattern);
    }

    return modelCore().description(short, sections);
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

    // This section makes no skewed or balanced judgement: the percentages
    // above carry the facts, and an average segment size would only restate
    // 100 divided by the count. The section is left out when it has nothing to say.
    const runs = [];

    // Add group information if there are more than 4 segments
    if (segments.length > 4 && !readTies(segments).allEqual) {
      // Calculate the combined percentage of the smallest segments (bottom half)
      const bottomHalfCount = Math.floor(segments.length / 2);
      const bottomHalf = segments.slice(segments.length - bottomHalfCount);
      const bottomHalfTotal = compensatedSum(bottomHalf.map((segment) => segment.value));
      const bottomHalfPercentage = formatPercentage(bottomHalfTotal, total);

      logDebug(
        "Bottom " +
          bottomHalf.length +
          " segments represent " +
          bottomHalfPercentage +
          "% of total"
      );

      // One space sits between the words. Keep it a plain string: a template
      // literal here would carry its line break and indentation into the text.
      runs.push(
        text("The bottom "),
        term("count", [text(countWord(bottomHalf.length))]),
        text(" segments collectively represent "),
        term("percentage", [text(bottomHalfPercentage)]),
        text(" of the total.")
      );
    }

    if (runs.length === 0) return null;

    return section([paragraph(runs)], {
      role: PIE_ROLES.PATTERNS,
      heading: [text("Distribution Pattern")],
    });
  }

  logInfo("Pie builder initialised successfully");

  const api = {
    buildPieModel,
    PIE_TOTAL_OVERFLOW,
  };

  root.ChartDescribePie = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
