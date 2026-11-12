/**
 * Chart description builders: the radar family.
 *
 * This file exports buildRadarModel and keeps everything that function needs.
 * It exports itself as window.ChartDescribeRadar. In Node it also sets
 * module.exports.
 *
 * A radar description has up to four sections: Overview, Series, Comparison
 * and Data Table. The Overview holds the opening sentence, the axes, the
 * scale and the grid. The Series section has one list item for each series.
 * The Comparison section compares each pair of plotted series. The Data Table
 * section gives every value.
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
      console.error(`[Chart Describe Radar] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Chart Describe Radar] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Chart Describe Radar] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Chart Describe Radar] DEBUG: ${message}`, ...args);
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

  /** The shared `modelCore` (charts-shared.js), resolved at call time. */
  function modelCore() {
    return shared().modelCore();
  }

  // ---------------------------------------------------------------------
  // Radar builders
  // ---------------------------------------------------------------------
  //
  // These builders turn the facts of a radar chart into a description. An
  // adapter reads the chart and hands the facts over. The shared prose layer is
  // textCore(). The guarded count word is `radarCountWord`, because the count
  // word used by the xychart and pie builders does not guard against a number
  // that is not whole.
  //
  // Every builder below returns runs, items or blocks of the DescriptionModel
  // (see model.js), never HTML. Author text enters only as `author` runs, raw,
  // and the renderer escapes it once. A caller renders the result of
  // buildRadarModel through PROFILES.lines.

  // How close twice a mean must sit to an odd whole number to count as a half.
  // The tolerance is far below any difference that two decimals typed by an
  // author can make, and far above the error that one binary sum leaves.
  const HALF_TOLERANCE = 1e-9;

  // The message of the error that a radar with a ticks value that is not finite is refused with.
  const RADAR_TICKS_NOT_FINITE = "The radar ticks value is not a finite number.";

  // The message of the error that a series whose finite values add up to more than a number can hold is refused with.
  const RADAR_TOTAL_OVERFLOW = "The radar values add up to more than a number can hold.";

  // How many decimal places past the series' own the average may use while its figure still sits
  // on the highest or lowest value. Past this the average is
  // written with "about".
  const EXTRA_PLACES_ON_EXTREME = 3;

  // Reads the decimal places and the exponent out of a number's shortest
  // round-trip text, for example "0.25" or "1.5e-7".
  const NUMBER_TEXT_PATTERN = /^\d+(?:\.(\d+))?(?:e([+-]\d+))?$/;

  // Where the renderer draws a value that it clamps. A value above the maximum
  // is drawn at the maximum's radius. A value below the minimum is drawn at
  // radius zero.
  const SCALE_MAXIMUM_PLACE = "the scale's maximum";
  const CENTRE_PLACE = "the centre";

  // The most pairs that the Comparison lists before its closing item.
  const MAX_LISTED_PAIRS = 6;

  // The most tied axes the highest and lowest sentence lists by name; a larger tie reads as a count.
  const TIE_AXES_CAP = 5;

  // The names that the describer uses for an empty or whitespace-only label.
  const UNLABELLED_AXIS = "unlabelled axis";
  const UNLABELLED_SERIES = "unlabelled series";

  /**
   * A count in the describer's number form: words to nine, digits from 10.
   *
   * THIS FUNCTION GUARDS THE SHARED `narrationNumber`. It does not
   * reimplement it. `narrationNumber` looks up its word list for any value from
   * 0 to 9, so a number that is not whole would come back `undefined`. Every
   * count that this file narrates is a whole number. For example, the ring
   * count is the number of rings that the renderer actually draws, not a
   * fractional number of ticks. The guard stays anyway, so that anything that
   * is not a whole number from 0 to 9 goes through `String()` and never
   * reaches the word list.
   *
   * @param {number} value - The count
   * @returns {string} The narration form
   */
  function radarCountWord(value) {
    if (Number.isInteger(value) && value >= 0 && value <= 9) {
      return textCore().narrationNumber(value);
    }
    return numberText(value);
  }

  /**
   * A count as a noun phrase, with the noun agreeing with the count.
   *
   * THIS IS THE ONE BUILDER FOR EVERY COUNTED NOUN, so "axis" and "axes",
   * "value" and "values", and "ring" and "rings" agree in the same way
   * everywhere. A wrong agreement, such as "one values", is a defect. Zero
   * reads "no". "Series" is its own plural, so the caller passes it as both
   * forms.
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

  /** A count of axes, as a noun phrase. */
  function axesPhrase(count) {
    return countPhrase(count, "axis", "axes");
  }

  /** A count of series, as a noun phrase. "Series" is its own plural. */
  function seriesPhrase(count) {
    return countPhrase(count, "series", "series");
  }

  /** A count of values, as a noun phrase. */
  function valuesPhrase(count) {
    return countPhrase(count, "value", "values");
  }

  /**
   * Join lists of runs - NO SERIAL COMMA.
   *
   * The radar descriptions join "Pace", "Workload" and "Support" with no comma
   * before the "and". So this file deliberately does not use the shared
   * `formatList`, or `joinRuns` (its run-level form in the pie code), because
   * both write an Oxford comma from three items up. One join serves the axes
   * sentence, the highest and lowest ties, and every pair-sentence list. It
   * joins runs rather than strings, so author text reaches the renderer raw,
   * and the renderer escapes it once.
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
   * A number as the words give it: the delivered number, in digits.
   *
   * `String()` of the delivered number, except that exponent form is written
   * out in digits, because a screen reader says "2e-7" as letters and
   * symbols. 2.5 stays 2.5, and nothing is rounded or re-formatted. The same
   * digit form as the pie's `formatValue`, so the two families read a number
   * alike. The only rounded figure in this file is the average, and it is
   * rounded by `roundedMean` before it gets here.
   *
   * @param {number} value - A delivered number
   * @returns {string} Its digits
   */
  function numberText(value) {
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
   * Quote one author label.
   *
   * The quotation marks are the describer's own text. Only the label is an
   * author run. The describer never changes the form of an author's name.
   *
   * @param {string} label - An axis or series label
   * @returns {Array} e.g. "Attack" with its quotation marks, as runs
   */
  function quotedLabel(label) {
    const { text, author } = modelCore();
    return [text('"'), author(String(label)), text('"')];
  }

  // The characters that draw as nothing: white space, Unicode format characters (such as a
  // zero-width space), every character Unicode itself calls Default_Ignorable_Code_Point (this
  // covers the combining grapheme joiner U+034F, the Hangul fillers U+115F, U+1160, U+3164 and
  // U+FFA0, the variation selectors U+FE00 to U+FE0F and U+E0100 to U+E01EF, the Khmer vowel
  // inherent U+17B4 and U+17B5, the Mongolian selectors U+180B to U+180D and U+180F, and U+2065),
  // and the Braille blank U+2800 (which is not default-ignorable). The C0 and C1 controls and U+180F are NOT in the set:
  // Chromium draws or advances them, and U+180F is excluded by lookahead below. ONE
  // class serves every name and every title, so no name is blank in one place and visible in another.
  const INVISIBLE_CHARS = String.raw`\s\p{Cf}\p{Default_Ignorable_Code_Point}\u2800\u001D\u007F`;
  // Characters in the invisible set that Chromium nonetheless draws as ink: U+180F (Mongolian free variation
  // selector four) and the 37 that leave a mark when drawn alone (the Arabic and Syriac number signs, the Ogham space mark, the
  // interlinear annotation anchors, the Kaithi number signs, the Egyptian and shorthand format controls). They are excluded where the
  // class is used, so a name made of one is a name. The 28 members that only advance the line stay in the set.
  const DRAWN_MARKS = String.raw`[\u180F\u{600}-\u{605}\u{6DD}\u{70F}\u{890}-\u{891}\u{8E2}\u{1680}\u{FFF9}-\u{FFFB}\u{110BD}\u{110CD}\u{13430}-\u{1343F}\u{1BCA0}-\u{1BCA3}]`;
  const INVISIBLE_ONE = `(?:(?!${DRAWN_MARKS})[${INVISIBLE_CHARS}])`;

  /** A label or title with nothing visible in it. */
  const BLANK_LABEL = new RegExp(`^${INVISIBLE_ONE}*$`, "u");

  /**
   * Is a label empty, or made only of characters that draw as nothing?
   *
   * Mermaid keeps `""` rather than falling back to the id (`label ?? name`),
   * so such a label reaches the canvas as an empty string and is drawn as
   * nothing. A label of zero-width characters is drawn as nothing too. There
   * is then no author text to quote.
   *
   * @param {string} label - An axis or series label
   * @returns {boolean} True when the label carries no visible text
   */
  function isUnlabelled(label) {
    return BLANK_LABEL.test(label);
  }

  /**
   * Did the author give a title that can be seen? A title of characters that
   * draw as nothing reads as no title, so the sentence never quotes an empty
   * pair of marks and the table caption never ends on nothing. A title of 0
   * counts.
   *
   * @param {*} title - facts.title
   * @returns {boolean} True when there is a visible title
   */
  function hasTitle(title) {
    return title !== undefined && title !== null && !BLANK_LABEL.test(String(title));
  }

  /**
   * An author label as the PROSE names it. A normal label is quoted and
   * escaped. For an empty or whitespace-only label, the name is the
   * describer's own phrase, "unlabelled axis N" or "unlabelled series N",
   * where N is the declaration position in digits. That phrase has NO quotes,
   * because there is no author text to mark.
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
   * An author label as a TABLE HEADER names it. A normal label is unquoted and
   * escaped. An empty label gets the same describer phrase as in the prose, so
   * no header cell is ever empty.
   *
   * @param {string} label - The label
   * @param {string} noun - UNLABELLED_AXIS or UNLABELLED_SERIES
   * @param {number} position - The declaration position, from one
   * @returns {Array} The cell content, as runs
   */
  function cellName(label, noun, position) {
    const { text, author } = modelCore();
    // A header cell is an opening position, so the phrase takes a capital letter.
    return isUnlabelled(label)
      ? [text(capitalisePhrase(`${noun} ${position}`))]
      : [author(String(label))];
  }

  /** Characters that draw as nothing, at either end of a label. */
  const LABEL_EDGES = new RegExp(`^${INVISIBLE_ONE}+|${INVISIBLE_ONE}+$`, "gu");

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

  // The repeated keys of a list of axes or series, worked out once for each list: a name is looked up in the set, not compared with
  // every other name. The list is a fixed delivery, so its answer is kept for as long as the list lives (and for the same length).
  const REPEATED_KEYS = new WeakMap();

  /**
   * The keys that more than one labelled item carries. An unlabelled item never counts.
   * @param {Object[]} items - The delivered axes, or the delivered series
   * @returns {Set<string>} The repeated keys
   */
  function repeatedKeysOf(items) {
    const kept = REPEATED_KEYS.get(items);
    if (kept && kept.length === items.length) return kept.repeated;
    const counts = new Map();
    for (const one of items) {
      if (isUnlabelled(one.label)) continue;
      const key = repeatKey(one.label);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const repeated = new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
    REPEATED_KEYS.set(items, { length: items.length, repeated });
    return repeated;
  }

  /**
   * True when this axis shares its label with another axis, so a reader given
   * the label alone could not tell which axis is meant. The comparison uses
   * the author's own text, before escaping, through the repeat key. An
   * unlabelled axis never counts: it already carries its position in
   * "unlabelled axis N".
   *
   * @param {Object[]} axes - The delivered axes
   * @param {number} index - The axis, by declaration index (from zero)
   * @returns {boolean} Whether the label is repeated
   */
  function isRepeatedAxisLabel(axes, index) {
    const label = axes[index].label;
    if (isUnlabelled(label)) return false;
    return repeatedKeysOf(axes).has(repeatKey(label));
  }

  /** The position that tells repeated axes apart: " (axis 2)". */
  function axisPositionText(index) {
    return ` (axis ${index + 1})`;
  }

  /** An axis as a TABLE HEADER names it; a repeated label takes its position, as in the prose. */
  function axisHeaderCell(axes, index) {
    const { text } = modelCore();
    const cell = cellName(axes[index].label, UNLABELLED_AXIS, index + 1);
    return isRepeatedAxisLabel(axes, index) ? [...cell, text(axisPositionText(index))] : cell;
  }

  /**
   * An axis in prose, by its declaration index (from zero). A repeated label
   * takes its position, on EVERY axis that shares it, the first included.
   */
  function axisName(axes, index) {
    const { text } = modelCore();
    const name = proseName(axes[index].label, UNLABELLED_AXIS, index + 1);
    return isRepeatedAxisLabel(axes, index) ? [...name, text(axisPositionText(index))] : name;
  }

  /**
   * True when this series shares its label with another series, so a reader
   * given the label alone could not tell which series is meant. Same rule as
   * the axes: the repeat key, the author's own text, an unlabelled series
   * never counts, and EVERY series counts, drawn or not.
   *
   * @param {Object} facts - The radar facts
   * @param {Object} curve - A delivered series
   * @returns {boolean} Whether the label is repeated
   */
  function isRepeatedSeriesLabel(facts, curve) {
    if (isUnlabelled(curve.label)) return false;
    return repeatedKeysOf(facts.curves).has(repeatKey(curve.label));
  }

  /** The position that tells repeated series apart: " (series 2)". */
  function seriesPositionText(facts, curve) {
    return ` (series ${facts.curves.indexOf(curve) + 1})`;
  }

  /**
   * A series in prose; its position is its place among EVERY series. A
   * repeated label takes its position on EVERY series that shares it.
   */
  function seriesName(facts, curve) {
    const { text } = modelCore();
    const name = proseName(curve.label, UNLABELLED_SERIES, facts.curves.indexOf(curve) + 1);
    return isRepeatedSeriesLabel(facts, curve) ? [...name, text(seriesPositionText(facts, curve))] : name;
  }

  /** A series as a TABLE HEADER names it; a repeated label takes its position, as in the prose. */
  function seriesHeaderCell(facts, curve) {
    const { text } = modelCore();
    const cell = cellName(curve.label, UNLABELLED_SERIES, facts.curves.indexOf(curve) + 1);
    return isRepeatedSeriesLabel(facts, curve) ? [...cell, text(seriesPositionText(facts, curve))] : cell;
  }

  /**
   * The describer's own phrase, in the places where it OPENS something. THIS
   * IS THE ONLY PLACE THE PHRASE IS CAPITALISED. The phrase opens a list item
   * (a series item on either arm, or a nested axis item), a sentence (the
   * subject of a pair sentence, "Unlabelled series 1 is higher than ..."), and
   * every table header cell. It stays lower case in the middle of a sentence
   * ("on unlabelled axis 2", "than unlabelled series 2"). An author label is
   * returned exactly as given, because author text is never re-cased.
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

  /** A series name where it opens a sentence or a list item. */
  function openingSeriesName(facts, curve) {
    return capitaliseOpening(curve.label, seriesName(facts, curve));
  }

  /** An axis name where it opens a nested list item. */
  function openingAxisName(axes, index) {
    return capitaliseOpening(axes[index].label, axisName(axes, index));
  }

  // ---------------------------------------------------------------------
  // The short tier
  // ---------------------------------------------------------------------

  /**
   * The short description. THIS IS THE ONLY BUILDER OF THE SHORT SENTENCE.
   *
   * It returns runs, with the title as an author run. The plain tier is
   * `flatten` of these runs, raw, because that tier goes to a `textContent`
   * property and to the SVG's `aria-label`, where a screen reader would read
   * an HTML entity out literally. The HTML tier
   * is the same runs under PROFILES.lines, which escapes the whole sentence
   * (furniture quotes included). One composition serves both tiers, so they
   * cannot disagree.
   *
   * @param {Object} facts - The radar facts
   * @returns {Array} The short sentence, as runs
   */
  function buildShortRuns(facts) {
    const { text, author } = modelCore();
    const titled = !hasTitle(facts.title)
      ? []
      : [text(' titled "'), author(String(facts.title)), text('"')];
    return [
      text("A radar chart"),
      ...titled,
      text(` with ${axesPhrase(facts.N)} and ${seriesPhrase(facts.K)}.`),
    ];
  }

  // ---------------------------------------------------------------------
  // The Overview
  // ---------------------------------------------------------------------

  /**
   * Overview paragraph one: the title, the series and the axes.
   * @param {Object} facts - The radar facts
   * @returns {Array} The sentence, as runs
   */
  function buildOpeningSentence(facts) {
    const { text } = modelCore();
    const titled = !hasTitle(facts.title) ? [] : [text(" titled "), ...quotedLabel(facts.title)];
    return [
      text("This radar chart"),
      ...titled,
      text(` plots ${seriesPhrase(facts.K)} across ${axesPhrase(facts.N)}.`),
    ];
  }

  /**
   * Overview paragraph two: every axis, in declaration order.
   *
   * "Clockwise from the top" is a fact of the picture. The first declared
   * axis is at the top, and the order runs clockwise at 360/N degrees. A chart with no axes reads "There are no
   * axes."
   *
   * @param {Object} facts - The radar facts
   * @returns {Array} The sentence, as runs
   */
  function buildAxesSentence(facts) {
    const { text } = modelCore();
    const labels = facts.axes.map((axis, index) => axisName(facts.axes, index));
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
   * Count the values that the picture clamps to one end of the scale.
   *
   * Only DRAWN series count, because only a drawn series has a vertex to be
   * "drawn at the scale's maximum" or "drawn at the centre". A series that
   * the picture omits clips nothing.
   *
   * @param {Object} facts - The radar facts
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
   * One clamped-value sentence. For example: "One value is above 50 and is
   * drawn at the scale's maximum." or "Three values are below 50 and are drawn
   * at the centre." The count is in words to nine, capitalised.
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
   * Overview paragraph three: the scale. THIS IS THE ONLY BUILDER OF IT.
   *
   * It follows one of four branches, in this order:
   *   - `scaleMax` is null (no series was delivered). The sentence is
   *     OMITTED, and this function returns null.
   *   - There is no range (`scaleMax === min`). Nothing is plotted, and the
   *     sentence says so. The data form keeps "set by the highest value". When
   *     the author sets a maximum equal to the minimum, the sentence drops
   *     that clause, because the author set the maximum. It also adds no
   *     clipped count, because nothing is drawn at any ring.
   *   - The scale is INVERTED: the minimum is above the maximum, on either
   *     branch. The sentence gives the range, then "so every value is drawn
   *     at the scale's maximum", and no clamped-value sentence.
   *   - Otherwise the sentence gives the range. On the data branch it adds
   *     "set by the highest value", and it adds ", which is in a series that
   *     is not plotted" when no plotted value reaches that maximum. Then it
   *     adds one sentence for the values above the maximum and one for the
   *     values below the minimum. Each appears only when it counts at least
   *     one drawn value, with "above" before "below".
   *
   * @param {Object} facts - The radar facts
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

    // On an inverted scale every value is drawn at the maximum, and no clamped
    // count follows.
    if (facts.inverted) {
      return fromData
        ? `${range}, set by the highest value, so every value is drawn at ${SCALE_MAXIMUM_PLACE}.`
        : `${range}, so every value is drawn at ${SCALE_MAXIMUM_PLACE}.`;
    }

    // The data branch names where its maximum came from only when that is
    // not the picture. The renderer derives the maximum over EVERY series, so
    // an unplotted series can set the scale that the plotted ones are drawn
    // against.
    let opening = `${range}.`;
    if (fromData) {
      opening = facts.maxUnplotted
        ? `${range}, set by the highest value, which is in a series that is not plotted.`
        : `${range}, set by the highest value.`;
    }
    const sentences = [opening];

    // Clamped values are narrated only on a real range, above before below.
    // The sentence says "at the scale's maximum", never "at the outer ring".
    // With ticks at 0 there is no ring, and with a fractional ticks value the
    // outermost ring lies beyond the maximum. The above-maximum count is zero
    // on the data branch by construction, because the maximum is the highest
    // value. The below-minimum count can be above zero on either branch,
    // because the renderer clamps to `min` whichever one set the maximum.
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
   * Overview paragraph four: the grid and the legend.
   *
   * THE RING COUNT IS WHAT THE RENDERER DRAWS. Its graticule loop runs
   * `for (a = 0; a < ticks; a++)`, so a fractional ticks value draws the
   * CEILING. So 1.5 draws 2 rings, 0.5 draws 1 ring and 2.5 draws 3 rings, in
   * both grid modes. A ticks value of 0 draws none, which reads "no rings"
   * with no shape word.
   *
   * @param {Object} facts - The radar facts
   * @returns {string} The sentence
   */
  function buildGridSentence(facts) {
    const options = facts.options;
    const shape = options.graticule === "polygon" ? "polygonal" : "circular";
    // A ticks value that is not finite draws no picture the words could state (the loop would never
    // end for Infinity), so refuse it, as the pie refuses a total that overflows.
    if (!Number.isFinite(options.ticks)) throw new RangeError(RADAR_TICKS_NOT_FINITE);
    // A negative ticks value draws no ring (the loop never runs), so it reads "no rings".
    const ringCount = Math.max(0, Math.ceil(options.ticks));
    const rings =
      ringCount === 0 ? "no rings" : countPhrase(ringCount, `${shape} ring`, `${shape} rings`);
    const legend = facts.legend ? "a legend names the series" : "there is no legend";
    return `The grid has ${rings}, and ${legend}.`;
  }

  // ---------------------------------------------------------------------
  // The Series list
  // ---------------------------------------------------------------------

  /**
   * The mean of a series, rounded. THIS IS THE ONLY AVERAGE IN THIS FILE.
   *
   * HALVES ROUND AWAY FROM ZERO, which `Math.round` alone does not do: it
   * rounds a half towards positive infinity, so -2.5 gives -2. Rounding the
   * magnitude and restoring the sign gives -3, and 2.5 still gives 3. A
   * result of -0 is returned as 0, so `String()` of it reads "0".
   *
   * A HALF IS FOUND ON TWICE THE MEAN, WITHIN A TOLERANCE, never by equality
   * Binary floating point sums 0.1, 4.1 and 3.3 to
   * 7.499999999999999, so the mean 2.5 arrives as 2.4999999999999996 and a
   * plain round gives 2. Twice the mean lands within HALF_TOLERANCE of an odd
   * whole number exactly when the decimal mean is a half; the exact halves
   * (2 and 3, 1.5 and 3.5) take the same branch and still give 3.
   *
   * THE AVERAGE NEVER LIES OUTSIDE THE SERIES' OWN VALUES. The mean is rounded
   * to a whole number first. If that falls below the lowest value or above
   * the highest (inclusive), it is rounded to one decimal place, then two, and
   * so on; the first result inside the values is used. Equal values take the
   * same path: the mean equals the value, so the search stops at the value.
   *
   * THE SEARCH GOES BEYOND THE SERIES' OWN LARGEST NUMBER OF DECIMAL PLACES
   * only to keep a figure off the highest or lowest value. At the series' own
   * places the lowest and highest values are exact, and rounding keeps order,
   * so a mean between them rounds to a figure between them. A figure that
   * sits ON the highest or lowest value while the mean is not that value is
   * passed over for one more place, and again, up to EXTRA_PLACES_ON_EXTREME
   * beyond the series' own (a bound of one place would leave 20 or more axes
   * reading as an extreme). If the last place still sits on one, the
   * first figure inside is used and `averagePhrase` writes "about" before it.
   * If floating point ever defeats the search, the figure at that precision is
   * used and a warning is logged.
   *
   * @param {number[]} values - A series' values
   * @returns {number} The rounded mean
   */
  function roundedMean(values) {
    return averageOf(values).figure;
  }

  /**
   * The average of a series as the sentence gives it: `averaging 3`, or `averaging about 1` when the
   * search ran out of places while the figure still sat on the highest or lowest value.
   *
   * @param {number[]} values - A series' values
   * @returns {string} The words after "averaging ", without the full stop
   */
  function averagePhrase(values) {
    const { figure, approximate } = averageOf(values);
    return approximate ? `about ${numberText(figure)}` : numberText(figure);
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

  /**
   * The mean of the values. Finite values can still sum past the largest number, and then the
   * mean would read Infinity, so such a series is refused with a RangeError, as the pie refuses a
   * total that overflows. (Dividing each value first was tried: it gives 1.6499999999999999e308 for
   * 1.7e308 and 1.6e308, a figure no author wrote.) Any finite sum is used as before, so no
   * ordinary mean moves.
   *
   * @param {number[]} values - A series' values
   * @returns {number} The mean
   */
  function meanOf(values) {
    const sum = compensatedSum(values);
    if (!Number.isFinite(sum) && values.every(Number.isFinite)) {
      throw new RangeError(RADAR_TOTAL_OVERFLOW);
    }
    return sum / values.length;
  }

  /**
   * The mean of finite values as an exact fraction, read from each value's shortest round-trip text, so
   * a half is found by arithmetic and never by a tolerance on a binary sum.
   *
   * @param {number[]} values - A series' values
   * @returns {?{sum: bigint, denominator: bigint}} The sum over the denominator (the count times ten to
   *   the power of the finest place), or null when a value is not finite
   */
  function exactMeanOf(values) {
    if (!values.every(Number.isFinite)) return null;
    const parts = values.map((value) => {
      const match = NUMBER_TEXT_PATTERN.exec(String(Math.abs(value)));
      if (!match) return null;
      const [whole, fraction = ""] = String(Math.abs(value)).split("e")[0].split(".");
      const exponent = match[2] ? Number(match[2]) : 0;
      // The digits as a whole number and the places they sit behind the point.
      const digits = BigInt(whole + fraction);
      const places = fraction.length - exponent;
      return { digits: value < 0 ? -digits : digits, places };
    });
    if (parts.some((part) => part === null)) return null;
    const finest = Math.max(0, ...parts.map((part) => part.places));
    const sum = parts.reduce(
      (total, part) => total + part.digits * 10n ** BigInt(finest - part.places),
      0n
    );
    return { sum, denominator: BigInt(values.length) * 10n ** BigInt(finest) };
  }

  /**
   * An exact mean rounded to a count of decimal places, halves away from zero.
   * @param {{sum: bigint, denominator: bigint}} exactMean - From `exactMeanOf`
   * @param {number} places - Decimal places to keep
   * @returns {number} The rounded mean (0 for -0)
   */
  function roundExactMean(exactMean, places) {
    const negative = exactMean.sum < 0n;
    const magnitude = negative ? -exactMean.sum : exactMean.sum;
    const scaled = magnitude * 10n ** BigInt(places);
    // floor((2 * scaled + denominator) / (2 * denominator)): a half goes up on the magnitude.
    const whole = (scaled * 2n + exactMean.denominator) / (exactMean.denominator * 2n);
    const rounded = Number(`${negative ? "-" : ""}${whole}e-${places}`);
    return rounded === 0 ? 0 : rounded;
  }

  /**
   * The search that `roundedMean` documents, with its result and whether it ran out of places.
   *
   * @param {number[]} values - A series' values
   * @returns {{figure: number, approximate: boolean}} The figure, and true when it still sits on
   *   the highest or lowest value after the last place
   */
  function averageOf(values) {
    const mean = meanOf(values);
    const lowest = Math.min(...values);
    const highest = Math.max(...values);
    const lastPlaces = Math.max(...values.map(decimalPlaces));

    // Whole number first; then one decimal place, two, and so on, until the
    // result lies inside the series' own values (inclusive). A result that
    // sits ON the highest or lowest value, when the mean is not that value,
    // is passed over for one more decimal place, and again while it still
    // sits there, up to EXTRA_PLACES_ON_EXTREME beyond the series' own, so the
    // figure does not read as an extreme. A series whose values are all equal
    // has its mean on both extremes, so its first result stands and the extra
    // place is never tried. A place whose scale is not a finite number ends the
    // search (a series of the smallest numbers has 324 places).
    let rounded = 0;
    let firstInside = null;
    const exactMean = exactMeanOf(values);
    for (let places = 0; places <= lastPlaces + EXTRA_PLACES_ON_EXTREME; places += 1) {
      if (!Number.isFinite(10 ** places)) break;
      rounded = exactMean ? roundExactMean(exactMean, places) : roundHalfAwayFromZero(mean, places);
      if (rounded < lowest || rounded > highest) continue;
      if (firstInside === null) firstInside = rounded;
      // The mean of values that differ lies strictly between the lowest and the highest, so a figure
      // ON one of them is never exact, whatever the scale. A tolerance would let such a figure
      // stand when it was close to the mean, and close grows with the mean. An all-equal series never gets here as an extreme.
      const onExtreme = lowest !== highest && (rounded === lowest || rounded === highest);
      if (!onExtreme) return { figure: rounded, approximate: false };
    }
    if (firstInside !== null) return { figure: firstInside, approximate: true };

    // No place could state a figure inside the values: the mean is finer than the largest scale.
    // The mean itself is then the true figure.
    if (mean >= lowest && mean <= highest) return { figure: mean, approximate: false };

    logWarn("The average lies outside the series at its own precision", {
      mean,
      lowest,
      highest,
      places: lastPlaces,
    });
    return { figure: rounded, approximate: false };
  }

  /**
   * The decimal places of a number as an author wrote it, read from its
   * shortest round-trip text: 0.25 has 2, 3 has 0, 1.5e-7 has 8.
   *
   * @param {number} value - A delivered number
   * @returns {number} Its decimal places (0 for a number with none)
   */
  function decimalPlaces(value) {
    const match = NUMBER_TEXT_PATTERN.exec(String(Math.abs(value)));
    if (!match) return 0;
    const fractionDigits = match[1] ? match[1].length : 0;
    const exponent = match[2] ? Number(match[2]) : 0;
    return Math.max(0, fractionDigits - exponent);
  }

  /**
   * A number rounded to a count of decimal places, halves away from zero.
   * The half test is the one described on `roundedMean`, applied to the mean
   * scaled by ten to the power of the places. A result of -0 is returned as 0.
   *
   * @param {number} mean - The number to round
   * @param {number} places - Decimal places to keep (0 for a whole number)
   * @returns {number} The rounded number
   */
  function roundHalfAwayFromZero(mean, places) {
    const scale = 10 ** places;
    const magnitude = Math.abs(mean) * scale;
    const twice = magnitude * 2;
    const nearestTwice = Math.round(twice);
    const isHalf =
      Math.abs(twice - nearestTwice) < HALF_TOLERANCE && nearestTwice % 2 === 1;
    const roundedMagnitude = isHalf ? (nearestTwice + 1) / 2 : Math.round(magnitude);
    const rounded = (Math.sign(mean) * roundedMagnitude) / scale;
    return rounded === 0 ? 0 : rounded;
  }

  /**
   * The highest and lowest sentence of a series. THIS IS THE ONLY PLACE THAT
   * FINDS THE EXTREMES.
   *
   * A tie of up to TIE_AXES_CAP axes lists every tied axis, in axis order, joined in the way that
   * the axes sentence joins them; a larger tie reads as a count, "Highest on 19 axes", with the
   * count in the describer's number form. When two axes share a label, the sentence names
   * the label once for each axis that carries it. When every value is equal,
   * it reads "The same value on every axis." A chart with one axis has no such
   * sentence at all, and never reaches this function.
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

    // A tie of more than TIE_AXES_CAP axes is given as a count ("Highest on 19 axes"); the nested
    // list under the series still names every axis with its value, so nothing is lost.
    const on = (target) => {
      const names = axes
        .map((axis, index) => (values[index] === target ? axisName(axes, index) : null))
        .filter((name) => name !== null);
      return names.length > TIE_AXES_CAP ? [text(axesPhrase(names.length))] : joinRunsNoSerial(names);
    };
    return [text("Highest on "), ...on(highest), text(", lowest on "), ...on(lowest), text(".")];
  }

  /**
   * The nested list of a drawn series, with one item for each axis.
   * @param {Object[]} axes - The delivered axes
   * @param {number[]} values - The series' values, in axis order
   * @returns {Object} A list block (model list)
   */
  function axisValueList(axes, values) {
    const { text, list, item } = modelCore();
    return list(
      axes.map((axis, index) =>
        item([...openingAxisName(axes, index), text(`: ${numberText(values[index])}`)])
      )
    );
  }

  /**
   * One series as list-item lines. THIS IS THE ONLY BUILDER OF A SERIES ITEM.
   *
   * A DRAWN series gets a summary line and then one nested item for each
   * axis. The summary line holds the label, then a disclosure when there is no
   * legend, then ", averaging M" when the chart has a range, then the highest
   * and lowest sentence. There is no one-axis form for a drawn series: the
   * renderer does not draw a series that sits on one axis, so that series
   * takes the arm below.
   *
   * A series that is NOT DRAWN gets the reason, then the legend clause (or its
   * replacement when there is no legend), then the values bare, in the order
   * written. The reason is the value count against the axis count when the
   * counts do not match. It is "only one axis" when the counts agree on a
   * chart that has a single axis. The replacement for the legend clause
   * already says that the code names the series and the picture does not, so
   * this arm does not repeat the bracketed disclosure.
   *
   * @param {Object} facts - The radar facts
   * @param {Object} curve - A delivered series
   * @returns {Object} A list entry (model item), its nested list as a child
   */
  function buildSeriesItem(facts, curve) {
    const { text, list, item } = modelCore();

    // The label opens the item on both arms.
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
          ? facts.N === 0 ? "no axes" : "only one axis"
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
    const averaging = facts.noRange ? "" : `, averaging ${averagePhrase(curve.values)}`;
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
  // The Comparison
  // ---------------------------------------------------------------------

  /**
   * One pair of plotted series. THIS IS THE ONLY PLACE TWO SERIES ARE
   * COMPARED.
   *
   * The earlier series is always the subject. Every axis is named once, in
   * axis order, in exactly one of three lists: higher, lower or equal. When
   * two axes share a label, the sentence names the label once for each axis
   * that carries it. The forms are:
   *   - every axis in one list: "on every axis", or "are equal on every axis";
   *   - otherwise the higher list, then ", and lower on", then ", and equal
   *     on". Each part appears only when its list is not empty. The sentence
   *     opens on "is higher than" or, when there is no higher list, on "is
   *     lower than".
   *
   * @param {Object} facts - The radar facts
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
      const name = axisName(facts.axes, index);
      if (a > b) higher.push(name);
      else if (a < b) lower.push(name);
      else equal.push(name);
    });

    // The subject opens every form of the sentence below.
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
      // With an equal part to follow, "and" belongs to that last part alone.
      if (lower.length > 0) {
        const lead = equal.length > 0 ? "lower on " : "and lower on ";
        parts.push([text(lead), ...joinRunsNoSerial(lower)]);
      }
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
   * The list items of the Comparison section, with the pairs in declaration
   * order.
   *
   * THE LIST IS CAPPED AT SIX PAIRS. It grows as K(K-1)/2, and each sentence
   * names every axis, so ten series give 45 pairs, far too many to read.
   * Six is the pair count of four series. Above six, the function keeps the first six
   * pairs in pair order and adds one closing item that says how many it left
   * out. The next pair count above six is ten, so the number left out is
   * always at least four and always plural.
   *
   * @param {Object} facts - The radar facts
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
  // The Data Table
  // ---------------------------------------------------------------------

  /**
   * The data table. THIS IS THE ONLY BUILDER OF IT.
   *
   * One column per DRAWN series (a series the picture omits has no column),
   * one row per axis. Labels are unquoted author runs.
   *
   * @param {Object} facts - The radar facts
   * @returns {Object} A table block (model table). Its columns are the corner
   *   cell then one per drawn series, and every row has a row header, so each
   *   row holds `columns.length - 1` cells.
   */
  function buildDataTable(facts) {
    const { text, author, table } = modelCore();
    const caption =
      !hasTitle(facts.title)
        ? [text("Data table for this radar chart")]
        : [text("Data table for: "), author(String(facts.title))];

    return table({
      caption,
      columns: [
        [text("Axis")],
        ...facts.tabled.map((curve) => seriesHeaderCell(facts, curve)),
      ],
      rows: facts.axes.map((axis, index) => ({
        header: axisHeaderCell(facts.axes, index),
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
   * @param {Object} facts - The radar facts
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

  logInfo("Radar builder initialised successfully");

  const api = {
    buildRadarModel,
  };

  root.ChartDescribeRadar = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
