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
   * a whole number below 2^53, which is exact already.
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

  /** A segment's name as the chart author wrote it, a label term over one author run. */
  function segmentLabel(segment) {
    const { term, author } = modelCore();
    return term("label", [author(String(segment.name))]);
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
        // The author's name, as written. Every section spells a category the
        // same way.
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

    // This section makes no skewed or balanced judgement: the percentages
    // above carry the facts, and the average is the one figure they do not
    // state.
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

      // One space sits between the words. Keep it a plain string: a template
      // literal here would carry its line break and indentation into the text.
      runs.push(
        text(" The bottom "),
        term("count", [text(countWord(bottomHalf.length))]),
        text(" segments collectively represent "),
        term("percentage", [text(bottomHalfPercentage)]),
        text(" of the total.")
      );
    }

    return section([paragraph(runs)], {
      role: PIE_ROLES.PATTERNS,
      heading: [text("Distribution Pattern")],
    });
  }

  logInfo("Pie builder initialised successfully");

  const api = {
    buildPieModel,
  };

  root.ChartDescribePie = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
