/**
 * Mermaid Accessibility - Gantt Chart Module
 *
 * Generates accessible descriptions for `gantt` diagrams from the shared parse
 * adapter's gantt surface (mermaid-parse-adapter.js), never from the SVG and
 * never from the diagram source. The seventh adapter-consuming generator.
 *
 * THE VOICE IS FROZEN. Every sentence below implements
 * docs/mermaid-gantt-gold-targets-2026-08-29.md — rules G1 to G17 and six
 * byte-exact approved targets. A mismatch between this module's output and a
 * target is a STOP that goes back to the design seat; it is never a reason to
 * edit a target or a fixture.
 *
 * AMENDED 30 August 2026, enacting the design seat's rulings on the hostile
 * probe sweep (docs/mermaid-gantt-probe-sweep-2026-08-30.md): G17 minted for
 * null-dated tasks (F2), G8 rewritten to speak the author's own exclusions and
 * claim nothing about scheduling (F5, F6), G16's insight no longer names a
 * cause (F4), milestone durations forced to 0 days (F3), unresolved
 * dependencies signalled rather than dropped (F1b), and a flagged milestone's
 * Status cell composed rather than truncated (F10).
 *
 * WHY THE REWRITE. The module this replaces read the diagram source with three
 * hand-written regexes and re-derived every date itself, including roughly 280
 * lines of exclusion arithmetic. Its task-line regex captured three metadata
 * fields, so a four-field line — `Research :done, r1, 2026-01-05, 5d` — put the
 * status flag in the id slot, the id in the timing slot and a malformed string
 * into the date parser, and the whole chart lost its dates silently. Mermaid
 * itself already resolves ids, flags, `after` chains and `excludes`; the
 * adapter surface delivers that resolution, and this module narrates it.
 *
 * DATES ARE READ WITH getFullYear/getMonth/getDate, NEVER toISOString. Mermaid
 * builds its Dates at LOCAL midnight, so under BST a delivered
 * `2026-03-31T23:00:00.000Z` is 1 April 2026 and toISOString would narrate the
 * previous day. Measured on the gold exemplars, 29 August 2026.
 *
 * END DATES FOLLOW CONVENTION C (gold method notes). The surface's `endDate` is
 * EXCLUSIVE — start plus duration — and Mermaid pushes it past excluded days,
 * so the narrated end is the last non-excluded day strictly before it. A
 * milestone contributes its own date instead.
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
  // load order. One property read per call cannot go stale. (XY chart
  // precedent.)

  /**
   * The shared prose layer (narrationNumber, formatList, escapeHtml).
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
   * around a name, the commas and the "and" — is never escaped; transforms run
   * before the escape; list items are escaped before a join, never after. The
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
   * Narration count: words for zero to nine, digits from 10 (rule G4). The one
   * number-to-word route in this module — there is deliberately no second
   * computation of it.
   * @param {number} value - The count
   * @returns {string} The count as it is spoken
   */
  function countWord(value) {
    return common().narrationNumber(value);
  }

  /**
   * A task's position among the tasks sharing its name, as a word (rules G5 and
   * G11, amended 30 August 2026). "first", "second" … "ninth", then "10th".
   *
   * This is the module's own vocabulary and not a second number-to-word route:
   * countWord speaks CARDINALS and cannot produce an ordinal, so there is
   * nothing here to keep in step with it.
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

  // ---------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------

  const MONTH_NAMES = Object.freeze([
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]);

  const DAY_NAMES = Object.freeze([
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]);

  // Rule G7's flag vocabulary, in prose and in the table. Exact strings; the
  // table forms are capitalised and the prose forms are not, so they are two
  // frozen tables rather than one with a transform applied at the call site.
  const FLAG_KEYS = Object.freeze(["done", "active", "crit"]);
  const FLAG_PROSE = Object.freeze({
    done: "complete",
    active: "in progress",
    crit: "on the critical path",
  });
  const FLAG_TABLE = Object.freeze({
    done: "Complete",
    active: "In progress",
    crit: "On the critical path",
  });
  const STATUS_NONE = "None";
  const STATUS_MILESTONE = "Milestone";

  // Rule G17 (minted 30 August 2026, sweep finding F2). What a table cell reads
  // for a task whose dates Mermaid could not resolve — a self-dependency, a
  // dependency cycle, or an `after` naming nothing. The surface delivers
  // startDate and endDate as null in those cases, honestly; before G17 the
  // module dereferenced them and generateDetailed threw, losing the entire
  // detailed tier while the short tier carried on as though nothing was wrong.
  const NOT_RESOLVED = "Not resolved";
  const NO_DATES_PHRASE = "has no resolvable dates";

  // Rule G11: a milestone's Duration is 0 days whatever the author declared in
  // the end slot (sweep finding F3, where `:milestone, m1, 2026-01-05, 5d`
  // printed "5 days" in a row whose Start and End were the same single day).
  const MILESTONE_DURATION_TEXT = "0 days";

  // Rule G5's enactment note of 30 August 2026 (sweep findings F1 and F1b). A
  // dependency that resolves to no task in the chart is SIGNALLED, never
  // dropped: the id itself is parser text and is never narrated, so the reader
  // is told that a predecessor exists and could not be found.
  const UNRESOLVED_PREDECESSOR = Object.freeze({
    singular: "a task not found in the chart",
    plural: "tasks not found in the chart",
  });

  // Rule G11's caption for a chart that declares no title.
  const UNTITLED_CAPTION = "Data table for this Gantt chart";

  // Rules G1/G2 as amended 30 August 2026 (sweep finding F8). The short's own
  // budget, and deliberately the SAME number the harness's contract clause C1
  // uses: two numbers that must agree is one number that will eventually not.
  // The module owns the discipline rather than the gate, because a short only
  // the gate objects to is still a short a reader has to listen to.
  const SHORT_MAX_CHARS = 250;

  // Rules G5/G11 as amended 30 August 2026 (sweep finding F9). The words a
  // duplicate name is addressed by. They are GENERATOR-OWNED — the author's
  // name is never altered, only qualified — and they follow rule G4's boundary:
  // words to ninth, digits from 10th.
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

  // Mermaid's `excludes weekends` keyword, and the `weekend` directive's only
  // non-default value. `weekend friday` moves the excluded pair to Friday and
  // Saturday; every other delivered value (including the default "sunday",
  // measured 29 August 2026) means Saturday and Sunday.
  const EXCLUDE_WEEKENDS = "weekends";
  const WEEKEND_FRIDAY = "friday";

  // A duration declaration is the author's own digits plus one of Mermaid's
  // units. Anchored at both ends: an unanchored test would match a number
  // inside some other end-slot form, such as `until b2`.
  const DURATION_DECLARATION = /^(\d+(?:\.\d+)?)\s*(ms|[smhdw])?$/i;

  // The noun each unit takes, and how many days one of it is worth. The days
  // figure is used only to rank tasks by length and to detect rule G16's
  // stretch; the NOUN is what reaches the reader.
  const DURATION_UNITS = Object.freeze({
    ms: { noun: "millisecond", days: 1 / 86400000 },
    s: { noun: "second", days: 1 / 86400 },
    m: { noun: "minute", days: 1 / 1440 },
    h: { noun: "hour", days: 1 / 24 },
    d: { noun: "day", days: 1 },
    w: { noun: "week", days: 7 },
  });
  const DEFAULT_DURATION_UNIT = "d";

  // The walk-back in `narratedEndDate` steps one day at a time over excluded
  // days. A chart excluding a whole year would otherwise spin; the bound is a
  // guard against a malformed excludes list, not a supported case.
  const MAX_EXCLUDED_WALK_BACK_DAYS = 366;

  const MS_PER_DAY = 86400000;

  // ---------------------------------------------------------------------
  // Dates — local components only
  // ---------------------------------------------------------------------

  /**
   * A Date's LOCAL calendar day, as a plain triple. Every date decision in this
   * module goes through this; nothing calls toISOString.
   * @param {Date} date - The date
   * @returns {Object} { year, month, day }
   */
  function localParts(date) {
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
    };
  }

  /**
   * A date offset by whole days, rebuilt from LOCAL components so a daylight
   * saving boundary inside the offset cannot shift the calendar day.
   * @param {Date} date - The starting date
   * @param {number} days - Days to add; may be negative
   * @returns {Date} The offset date, at local midnight
   */
  function addDays(date, days) {
    const p = localParts(date);
    return new Date(p.year, p.month, p.day + days);
  }

  /**
   * Two dates' calendar days compared, ignoring the time of day.
   * @param {Date} a - First date
   * @param {Date} b - Second date
   * @returns {number} Negative if a is earlier, 0 if the same day, positive if later
   */
  function compareDays(a, b) {
    const pa = localParts(a);
    const pb = localParts(b);
    return (
      Date.UTC(pa.year, pa.month, pa.day) - Date.UTC(pb.year, pb.month, pb.day)
    );
  }

  /**
   * The INCLUSIVE count of calendar days from one date to another (rule G15).
   * Computed through Date.UTC on the local components so no daylight saving
   * transition inside the span can cost or add an hour and round wrongly.
   * @param {Date} from - The first day, counted
   * @param {Date} to - The last day, counted
   * @returns {number} The number of calendar days
   */
  function inclusiveDayCount(from, to) {
    return Math.round(compareDays(to, from) / MS_PER_DAY) + 1;
  }

  /**
   * A date in British narration form: 2 March 2026 (rule G4).
   * @param {Date} date - The date
   * @returns {string} The formatted date
   */
  function formatBritishDate(date) {
    const p = localParts(date);
    return `${p.day} ${MONTH_NAMES[p.month]} ${p.year}`;
  }

  /**
   * A date rendered in the author's own declared `dateFormat`, so an `excludes`
   * entry naming a specific day can be compared against it.
   *
   * Supports the day, month and year tokens; anything else in the pattern is
   * left alone. Mermaid's excludes list holds the author's own strings, so an
   * exact comparison against the author's own format is the only test that can
   * match without guessing at their intent.
   *
   * @param {Date} date - The date
   * @param {string} pattern - The chart's dateFormat
   * @returns {string} The date in that format
   */
  function formatByPattern(date, pattern) {
    const p = localParts(date);
    const pad = (n) => String(n).padStart(2, "0");
    return String(pattern || "YYYY-MM-DD")
      .replace(/YYYY/g, String(p.year))
      .replace(/YY/g, pad(p.year % 100))
      .replace(/MM/g, pad(p.month + 1))
      .replace(/DD/g, pad(p.day))
      .replace(/\bM\b/g, String(p.month + 1))
      .replace(/\bD\b/g, String(p.day));
  }

  // ---------------------------------------------------------------------
  // Exclusions
  // ---------------------------------------------------------------------

  /**
   * Which two weekdays this chart's `excludes weekends` removes, and what they
   * are called.
   *
   * Mermaid's `weekend` directive accepts `friday` or `saturday`; every chart
   * measured on 29 August 2026 that declares neither delivers `"sunday"`, and
   * its excluded days are Saturday and Sunday. So Friday is the one value that
   * moves the pair, and everything else takes the default.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @returns {Object} { days: number[], names: string[] }
   */
  function weekendDefinition(chart) {
    const weekday = String(chart.weekday || "").toLowerCase();
    if (weekday === WEEKEND_FRIDAY) {
      return { days: [5, 6], names: [DAY_NAMES[5], DAY_NAMES[6]] };
    }
    return { days: [6, 0], names: [DAY_NAMES[6], DAY_NAMES[0]] };
  }

  /**
   * Whether Mermaid would refuse to schedule work on this day.
   *
   * `includes` wins over `excludes`, matching Mermaid's own precedence. This is
   * consulted ONLY to walk back from a delivered exclusive end date; no date in
   * this module is ever re-derived from a duration.
   *
   * @param {Date} date - The day to test
   * @param {Object} chart - The adapter's normalised chart
   * @returns {boolean} True when the day is excluded
   */
  function isExcludedDay(date, chart) {
    const formatted = formatByPattern(date, chart.dateFormat);
    const includes = Array.isArray(chart.includes) ? chart.includes : [];
    if (includes.indexOf(formatted) !== -1) return false;

    const excludes = Array.isArray(chart.excludes) ? chart.excludes : [];
    if (excludes.length === 0) return false;

    if (excludes.indexOf(EXCLUDE_WEEKENDS) !== -1) {
      const weekend = weekendDefinition(chart);
      if (weekend.days.indexOf(date.getDay()) !== -1) return true;
    }

    const dayName = DAY_NAMES[date.getDay()].toLowerCase();
    if (excludes.some((e) => String(e).toLowerCase() === dayName)) return true;

    return excludes.indexOf(formatted) !== -1;
  }

  /**
   * Whether the chart excludes weekends at all.
   * @param {Object} chart - The adapter's normalised chart
   * @returns {boolean} True when `excludes weekends` was declared
   */
  function excludesWeekends(chart) {
    const excludes = Array.isArray(chart.excludes) ? chart.excludes : [];
    return excludes.indexOf(EXCLUDE_WEEKENDS) !== -1;
  }

  /**
   * Whether the chart declares ANY exclusion.
   *
   * Rule G16's guard as amended 30 August 2026. It used to be
   * `excludesWeekends`, which was coherent only while the insight named the
   * weekend as the cause; now that the sentence says "excluded days" without
   * naming a kind, gating it on one kind would silently withhold the insight
   * from a chart stretched by an excluded DATE — which is the very chart sweep
   * finding F4 was measured on.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @returns {boolean} True when any exclusion was declared
   */
  function hasExclusions(chart) {
    return Array.isArray(chart.excludes) && chart.excludes.length > 0;
  }

  /**
   * Parse a date written in the author's own declared `dateFormat`.
   *
   * The inverse of `formatByPattern`, and it exists for one reason: rule G8 as
   * amended now SPEAKS the dates a chart excludes, and an excludes entry is
   * written in the author's format, which is not necessarily ISO. Rendering
   * `07/01/2026` as "7 January 2026" needs the pattern to say which field is
   * which.
   *
   * Returns null when the text does not match the pattern, which is not an
   * error: `excludes` also carries `weekends` and weekday names, and an author
   * may write anything at all there.
   *
   * @param {string} text - One excludes entry
   * @param {string} pattern - The chart's dateFormat
   * @returns {Date|null} A local-midnight Date, or null
   */
  function parseByPattern(text, pattern) {
    const source = String(pattern || "YYYY-MM-DD");
    const order = [];
    let regex = "";
    for (let i = 0; i < source.length; ) {
      const token = ["YYYY", "MM", "DD", "YY", "M", "D"].find(
        (t) => source.startsWith(t, i)
      );
      if (token) {
        order.push(token[0] === "Y" ? "y" : token[0] === "M" ? "m" : "d");
        regex += token.length === 1 ? "(\\d{1,2})" : `(\\d{${token.length}})`;
        i += token.length;
      } else {
        regex += source[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        i += 1;
      }
    }

    const match = new RegExp(`^${regex}$`).exec(String(text).trim());
    if (!match) return null;

    const parts = { y: null, m: null, d: null };
    order.forEach((key, i) => {
      parts[key] = Number(match[i + 1]);
    });
    if (parts.y === null || parts.m === null || parts.d === null) return null;
    if (parts.y < 100) parts.y += 2000;

    // Built from LOCAL components, like every other date in this module.
    const date = new Date(parts.y, parts.m - 1, parts.d);
    return date.getMonth() === parts.m - 1 && date.getDate() === parts.d
      ? date
      : null;
  }

  /**
   * Rule G8's construction sentence, AMENDED 30 August 2026 (sweep findings F5
   * and F6), detailed tier only.
   *
   * It used to read "Weekends are excluded, so no task is scheduled on a
   * Saturday or Sunday." Both halves were wrong. The second clause is
   * FALSIFIABLE — Mermaid honours an explicit start date on an excluded day, so
   * a chart could assert it and then narrate a task running from a Saturday two
   * sentences later (F5). And the sentence named only weekends, so a chart
   * excluding a specific date or a weekday said nothing about them at all (F6).
   *
   * The sentence now reports the author's own declarations and claims nothing
   * about what is scheduled. Weekends first, then weekday names as capitalised
   * generator-owned plurals, then dates in British form, source order within
   * each kind.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @param {Function} esc - The escape transform for this sink
   * @returns {string} The sentence, or "" when nothing is excluded
   */
  function buildExcludesSentence(chart, esc) {
    if (!hasExclusions(chart)) return "";

    const weekends = [];
    const weekdays = [];
    const dates = [];

    for (const entry of chart.excludes) {
      const text = String(entry).trim();
      if (text.toLowerCase() === EXCLUDE_WEEKENDS) {
        if (weekends.length === 0) weekends.push(EXCLUDE_WEEKENDS);
        continue;
      }

      const dayIndex = DAY_NAMES.findIndex(
        (d) => d.toLowerCase() === text.toLowerCase()
      );
      if (dayIndex !== -1) {
        // The PLURAL is the generator's own word, attached to a day name the
        // generator owns — author text is never inflected (register item 26).
        weekdays.push(`${DAY_NAMES[dayIndex]}s`);
        continue;
      }

      const parsed = parseByPattern(text, chart.dateFormat);
      // A token that is neither a weekend, a weekday nor a parseable date is
      // the author's own string and is escaped as author text.
      dates.push(parsed ? formatBritishDate(parsed) : esc(text));
    }

    const items = [...weekends, ...weekdays, ...dates];
    if (items.length === 0) return "";

    // Not `formatList`: that helper writes an Oxford comma and this sentence
    // takes none.
    const joined =
      items.length === 1
        ? items[0]
        : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

    return `The chart excludes ${joined}.`;
  }

  // ---------------------------------------------------------------------
  // The narrated view of one task
  // ---------------------------------------------------------------------

  /**
   * The end date a description names, per CONVENTION C.
   *
   * A milestone is a point, so it contributes its own date. Every other task
   * contributes the last day that is not excluded and is strictly before the
   * delivered exclusive `endDate` — Mermaid pushes that end past excluded days,
   * so `endDate - 1` alone lands on a Sunday for a task that really finished on
   * the Friday (measured on gold exemplar 4, whose Proofreading is delivered
   * ending Monday 15 June and is narrated ending Friday 12 June).
   *
   * @param {Object} task - One delivered task
   * @param {Object} chart - The adapter's normalised chart
   * @returns {Date|null} The narrated end date
   */
  function narratedEndDate(task, chart) {
    if (!task.startDate || !task.endDate) return null;
    if (task.isMilestone) return task.startDate;

    let candidate = addDays(task.endDate, -1);
    let steps = 0;
    while (
      isExcludedDay(candidate, chart) &&
      compareDays(candidate, task.startDate) > 0 &&
      steps < MAX_EXCLUDED_WALK_BACK_DAYS
    ) {
      candidate = addDays(candidate, -1);
      steps += 1;
    }

    // A task cannot be narrated as ending before it starts. Reachable only on a
    // zero-length non-milestone task, which Mermaid delivers with equal start
    // and end.
    return compareDays(candidate, task.startDate) < 0
      ? task.startDate
      : candidate;
  }

  /**
   * The author's DECLARED duration, kept in their own digits with noun
   * agreement (rule G4) — `1 day`, `5 days`, `0 days`.
   *
   * When the end slot carries something other than a duration (an `until`
   * clause, or an explicit end date) there is no declared duration to keep. The
   * gold document covers no such chart, so the fallback is STATED rather than
   * inferred: the narrated span's own inclusive calendar-day count, spoken
   * through countWord and named as calendar days so a reader can tell a derived
   * figure from a declared one.
   *
   * @param {Object} task - One delivered task
   * @param {Date|null} start - The task's start date
   * @param {Date|null} end - The task's narrated end date
   * @returns {Object} { text, tableText, days, declared } — `text` is the prose
   *   form and `tableText` the Duration column's, which differ only for a
   *   derived span (rule G4 as amended 30 August 2026)
   */
  function taskDuration(task, start, end) {
    // RULE G11, ENACTED 30 August 2026 (sweep finding F3). A milestone's
    // Duration is 0 days whatever the author wrote in the end slot. G11 always
    // said so; the module read `endDeclaration` without consulting
    // `isMilestone`, so `:milestone, m1, 2026-01-05, 5d` produced a row stating
    // a five-day duration beside a Start and an End one day apart.
    if (task.isMilestone) {
      return {
        text: MILESTONE_DURATION_TEXT,
        tableText: MILESTONE_DURATION_TEXT,
        days: 0,
        declared: true,
      };
    }

    const match = DURATION_DECLARATION.exec(
      String(task.endDeclaration || "").trim()
    );

    if (match) {
      const value = Number(match[1]);
      const unitKey = (match[2] || DEFAULT_DURATION_UNIT).toLowerCase();
      const unit = DURATION_UNITS[unitKey] || DURATION_UNITS.d;
      const noun = value === 1 ? unit.noun : `${unit.noun}s`;
      return {
        text: `${match[1]} ${noun}`,
        tableText: `${match[1]} ${noun}`,
        days: value * unit.days,
        declared: true,
      };
    }

    if (start && end) {
      const days = inclusiveDayCount(start, end);
      const noun = days === 1 ? "day" : "days";
      // RULES G4/G11 AS AMENDED 30 August 2026 (sweep finding F11). The two
      // forms are the same span said two ways, and the split is deliberate:
      // PROSE keeps rule G4's spoken count, because a sentence is read aloud,
      // while the DURATION COLUMN is scanned vertically and a reader comparing
      // "5 days" against "one calendar day" is comparing two number styles
      // before they can compare two lengths. One derivation, two renderings —
      // never two computations, which could disagree.
      return {
        text: `${countWord(days)} calendar ${noun}`,
        tableText: `${days} calendar ${noun}`,
        days: days,
        declared: false,
      };
    }

    return { text: "", tableText: "", days: 0, declared: false };
  }

  /**
   * The narrated view of every task, in delivery order.
   *
   * Every derived value a sentence or a table row needs is computed once, here,
   * so no two surfaces can disagree about a date, a duration or a flag.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @returns {Array<Object>} The narrated tasks
   */
  function narrateTasks(chart) {
    // RULES G5/G11 AS AMENDED 30 August 2026 (sweep finding F9). Two tasks may
    // legitimately share a name, and G5 narrates a predecessor BY NAME because
    // an id is parser text — so on such a chart "starting after \"Review\"" names
    // two different tasks and identifies neither. The position among the tasks
    // sharing a name is computed ONCE here, so the sentence and the table row
    // header cannot address the same task differently.
    const nameCounts = new Map();
    for (const task of chart.tasks || []) {
      nameCounts.set(task.name, (nameCounts.get(task.name) || 0) + 1);
    }
    const positions = new Map();

    return (chart.tasks || []).map((task) => {
      const shared = (nameCounts.get(task.name) || 0) > 1;
      const position = (positions.get(task.name) || 0) + 1;
      positions.set(task.name, position);
      const start = task.startDate || null;
      const end = narratedEndDate(task, chart);
      const duration = taskDuration(task, start, end);
      return {
        source: task,
        name: task.name,
        section: task.section || "",
        isMilestone: task.isMilestone === true,
        // Null on a unique name, which is the overwhelming case: a qualifier
        // on a name nothing else shares would be noise, so every consumer of
        // this field asks whether it is set rather than what it says.
        nameOrdinal: shared ? ordinalWord(position) : null,
        start: start,
        end: end,
        // RULE G17 (30 August 2026, sweep finding F2). ONE flag, computed once,
        // read by every surface that could otherwise dereference a null date.
        // `narratedEndDate` already returns null when either delivered date is
        // null, so this is true only when BOTH resolved.
        resolved: !!(start && end),
        duration: duration,
        // The inclusive calendar days the task really occupies, which rule G16
        // compares against the declared duration.
        calendarDays: start && end ? inclusiveDayCount(start, end) : 0,
        flags: FLAG_KEYS.filter(
          (key) =>
            (key === "done" && task.isDone) ||
            (key === "active" && task.isActive) ||
            (key === "crit" && task.isCritical)
        ),
      };
    });
  }

  /**
   * The predecessors a task declares, resolved to the NARRATED tasks.
   *
   * Rule G5: narrated only when declared, and only from the surface's resolved
   * `dependsOn`, which comes from the `after` clause. It returns the narrated
   * tasks rather than bare names (amended 30 August 2026, sweep finding F9), so
   * the caller can reach `nameOrdinal` and address a shared name; an id naming
   * no task in this chart is counted, never quoted at the reader.
   *
   * @param {Object} source - One delivered task
   * @param {Array<Object>} tasks - Every narrated task in the chart
   * @returns {Object} { found, unresolved } — the tasks, in declaration order
   */
  function predecessorNames(source, tasks) {
    const ids = Array.isArray(source.dependsOn) ? source.dependsOn : [];
    if (ids.length === 0) return { found: [], unresolved: 0 };

    // LAST DEFINITION WINS, and that is load-bearing rather than incidental:
    // Mermaid resolves a duplicate id to the LATER task, so this map has to as
    // well or the sentence would name a different task from the one the chart
    // draws. The sweep recorded the agreement as CG6 and noted it was unguarded;
    // fixtures/gantt-hostile/duplicate-ids now pins it from this side.
    const byId = new Map();
    for (const candidate of tasks) {
      if (candidate.source && candidate.source.id) {
        byId.set(candidate.source.id, candidate);
      }
    }

    const found = [];
    let unresolved = 0;
    for (const id of ids) {
      const task = byId.get(id);
      if (task) found.push(task);
      else unresolved += 1;
    }
    return { found: found, unresolved: unresolved };
  }

  // ---------------------------------------------------------------------
  // Counts and shared clauses
  // ---------------------------------------------------------------------

  /**
   * A count and its noun, agreeing: "one task", "two tasks".
   * @param {number} count - The count
   * @param {string} singular - The singular noun
   * @param {string} plural - The plural noun
   * @returns {string} The counted noun
   */
  function countedNoun(count, singular, plural) {
    return `${countWord(count)} ${count === 1 ? singular : plural}`;
  }

  /**
   * The chart's flag totals, which the short's status sentence (rule G2) and
   * the Key Insights summary both read.
   * @param {Array<Object>} tasks - The narrated tasks
   * @returns {Object} { done, active, crit }
   */
  function flagCounts(tasks) {
    const counts = {};
    for (const key of FLAG_KEYS) {
      counts[key] = tasks.filter((t) => t.flags.indexOf(key) !== -1).length;
    }
    return counts;
  }

  /**
   * The status sentence of rule G2 — "One task is complete, one is in progress
   * and one is on the critical path."
   *
   * The FIRST clause present carries the noun and every later clause drops it,
   * which is why the clauses are built in order rather than assembled from a
   * table. The join is deliberately NOT `formatList`: that helper writes an
   * Oxford comma and this sentence takes none.
   *
   * @param {Object} counts - The output of flagCounts
   * @param {Array<string>} keys - Which flags to include, in order
   * @returns {string} The sentence, or "" when no clause applies
   */
  function buildStatusSentence(counts, keys) {
    const clauses = [];
    for (const key of keys) {
      const n = counts[key];
      if (n === 0) continue;
      const verb = n === 1 ? "is" : "are";
      const subject =
        clauses.length === 0 ? countedNoun(n, "task", "tasks") : countWord(n);
      clauses.push(`${subject} ${verb} ${FLAG_PROSE[key]}`);
    }
    if (clauses.length === 0) return "";

    const joined =
      clauses.length === 1
        ? clauses[0]
        : `${clauses.slice(0, -1).join(", ")} and ${clauses[clauses.length - 1]}`;

    return `${joined.charAt(0).toUpperCase()}${joined.slice(1)}.`;
  }

  /**
   * The project span the description narrates: the earliest delivered start and
   * the latest NARRATED end.
   * @param {Array<Object>} tasks - The narrated tasks
   * @returns {Object|null} { start, end }, or null when no task carries dates
   */
  function projectSpan(tasks) {
    let start = null;
    let end = null;
    for (const task of tasks) {
      // RULE G17: a task with no resolvable dates contributes to no span. The
      // old test read `task.start` alone, so a task with a start and a null end
      // would have moved the project START while contributing no end.
      if (!task.resolved) continue;
      if (task.start && (start === null || compareDays(task.start, start) < 0)) {
        start = task.start;
      }
      if (task.end && (end === null || compareDays(task.end, end) > 0)) {
        end = task.end;
      }
    }
    return start && end ? { start: start, end: end } : null;
  }

  /**
   * The longest tasks, by declared duration in days. Milestones are excluded: a
   * point has no length, and rule G14's takeaway is about work.
   * @param {Array<Object>} tasks - The narrated tasks
   * @returns {Array<Object>} Every task tied at the maximum, in order
   */
  function longestTasks(tasks) {
    // RULE G17: an unresolved task is excluded even when it DECLARED a
    // duration — the circular pair of sweep finding F2 declares `3d` and `2d`
    // and resolves to no dates at all, so without this gate it would win the
    // takeaway.
    const candidates = tasks.filter(
      (t) => t.resolved && !t.isMilestone && t.duration.text
    );
    if (candidates.length === 0) return [];

    let max = candidates[0].duration.days;
    for (const task of candidates) {
      if (task.duration.days > max) max = task.duration.days;
    }
    return candidates.filter((t) => t.duration.days === max);
  }

  // ---------------------------------------------------------------------
  // The overview (rules G1, G6, G8 as amended 30 August 2026)
  // ---------------------------------------------------------------------

  /**
   * The opening sentence, shared by both tiers.
   *
   * The two tiers differ only in their lead and their verb — "A Gantt chart …
   * with" against "This Gantt chart … shows" — so one builder writes both and
   * the counts, the milestone qualifier and the span cannot drift between them.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @param {Array<Object>} tasks - The narrated tasks
   * @param {Function} esc - The escape transform for this sink
   * @param {boolean} detailed - True for the detailed tier's wording
   * @returns {string} The sentence
   */
  function buildOverviewSentence(chart, tasks, esc, detailed) {
    const milestoneCount = tasks.filter((t) => t.isMilestone).length;
    const sectionCount = Array.isArray(chart.sections)
      ? chart.sections.length
      : 0;
    const span = projectSpan(tasks);

    let sentence = detailed ? "This Gantt chart" : "A Gantt chart";
    if (chart.title) sentence += ` titled "${esc(chart.title)}"`;
    sentence += detailed ? " shows " : " with ";
    sentence += countedNoun(tasks.length, "task", "tasks");

    if (sectionCount > 0) {
      sentence += ` in ${countedNoun(sectionCount, "section", "sections")}`;
    }

    if (milestoneCount > 0) {
      sentence += `, ${countWord(milestoneCount)} of them ${
        milestoneCount === 1 ? "a milestone" : "milestones"
      }`;
    }

    if (span) {
      // RULES G1/G4 AS AMENDED 30 August 2026 (sweep finding F13). G4 already
      // gave the TASK sentence a same-day form and the module used it; the
      // opening had none, so a one-day chart announced itself as "running from
      // 5 January 2026 to 5 January 2026" one line above "runs on 5 January
      // 2026". Same date twice is not a span, and reading it as one costs the
      // listener a re-parse to discover nothing was said.
      sentence +=
        compareDays(span.start, span.end) === 0
          ? `, on ${formatBritishDate(span.start)}`
          : `, running from ${formatBritishDate(
              span.start
            )} to ${formatBritishDate(span.end)}`;
    }

    return `${sentence}.`;
  }

  /**
   * Rule G8's exclusion sentence, detailed tier only. The short never mentions
   * it — the dates it quotes already reflect it.
   * @param {Object} chart - The adapter's normalised chart
   * @returns {string} The sentence, or "" when no weekend is excluded
   */
  // ---------------------------------------------------------------------
  // The Schedule section (rules G4, G5, G6, G7)
  // ---------------------------------------------------------------------

  /**
   * The predecessor phrase for one task, resolved names and unfound ones.
   *
   * Rule G5, with the enactment note of 30 August 2026 (sweep finding F1b). An
   * `after` target naming no task in the chart used to be dropped in silence,
   * so a task whose start Mermaid had quietly defaulted to today was narrated
   * with no dependency clause at all and no hint that anything had failed. The
   * id is never narrated — it is parser text — but its ABSENCE now is.
   *
   * @param {Object} source - The delivered task
   * @param {Array<Object>} tasks - Every narrated task in the chart
   * @param {Function} esc - The escape transform for this sink
   * @returns {string} The phrase, or "" when nothing was declared
   */
  function predecessorClause(source, tasks, esc) {
    const { found, unresolved } = predecessorNames(source, tasks);
    if (found.length === 0 && unresolved === 0) return "";

    // RULE G5 AS AMENDED 30 August 2026 (sweep finding F9). The qualifier is
    // generator furniture and sits OUTSIDE the quotation marks, so the author's
    // name is quoted exactly as written and the addressing is visibly ours.
    const quoted = found.map((t) =>
      t.nameOrdinal
        ? `the ${t.nameOrdinal} "${esc(t.name)}"`
        : `"${esc(t.name)}"`
    );
    const missing =
      unresolved === 0
        ? ""
        : unresolved === 1
          ? UNRESOLVED_PREDECESSOR.singular
          : UNRESOLVED_PREDECESSOR.plural;

    if (quoted.length === 0) return missing;
    const resolved = common().formatList(quoted);
    return missing ? `${resolved} and ${missing}` : resolved;
  }

  /**
   * One task's sentence.
   *
   * Clause order is fixed: what it does and when, then how long, then what it
   * waits for, then its status — so the status reads as the final conjunct.
   *
   * @param {Object} task - One narrated task
   * @param {Array<Object>} tasks - Every narrated task in the chart
   * @param {Function} esc - The escape transform for this sink
   * @returns {string} The sentence
   */
  function buildTaskSentence(task, tasks, esc) {
    const name = `"${esc(task.name)}"`;

    // RULE G17 FIRST, before the milestone branch, because a milestone whose
    // dependency cannot resolve has no date either. This is the branch whose
    // ABSENCE threw: `sameDay` correctly evaluated false on a null start and
    // execution fell straight through into `formatBritishDate(task.start)`.
    if (!task.resolved) return `${name} ${NO_DATES_PHRASE}.`;

    const list = predecessorClause(task.source, tasks, esc);

    if (task.isMilestone) {
      let milestone = `${name} is a milestone on ${formatBritishDate(task.end)}`;
      if (list) milestone += `, following ${list}`;
      return `${milestone}.`;
    }

    const sameDay =
      task.start && task.end && compareDays(task.start, task.end) === 0;

    let sentence = sameDay
      ? `${name} runs on ${formatBritishDate(task.start)}`
      : `${name} runs from ${formatBritishDate(
          task.start
        )} to ${formatBritishDate(task.end)}`;

    if (task.duration.text) sentence += `, lasting ${task.duration.text}`;
    if (list) sentence += `, starting after ${list}`;

    if (task.flags.length > 0) {
      const phrases = task.flags.map((key) => FLAG_PROSE[key]);
      sentence += `, and is ${common().formatList(phrases)}`;
    }

    return `${sentence}.`;
  }

  /**
   * The sections a chart's tasks are grouped under, in the order the author
   * declared them.
   *
   * A section a task names but the chart's own section list omits is appended
   * in first-appearance order rather than dropped — the alternative is a task
   * that never reaches the Schedule at all.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @param {Array<Object>} tasks - The narrated tasks
   * @returns {Array<string>} The section names
   */
  function orderedSections(chart, tasks) {
    const ordered = [];
    const seen = new Set();

    for (const name of Array.isArray(chart.sections) ? chart.sections : []) {
      if (name && !seen.has(name)) {
        seen.add(name);
        ordered.push(name);
      }
    }
    for (const task of tasks) {
      if (task.section && !seen.has(task.section)) {
        seen.add(task.section);
        ordered.push(task.section);
      }
    }
    return ordered;
  }

  /**
   * The Schedule section's body (rule G3): one `<ul>` for a sectionless chart,
   * and an introducing `<p>` plus a `<ul>` per section otherwise. It passes the
   * whole narrated set down to each sentence, because a predecessor clause has
   * to reach tasks outside its own section.
   * @param {Object} chart - The adapter's normalised chart
   * @param {Array<Object>} tasks - The narrated tasks
   * @returns {Array<string>} The lines
   */
  function buildSchedule(chart, tasks) {
    const esc = escapeText;
    const sections = orderedSections(chart, tasks);
    const lines = [];

    if (sections.length === 0) {
      lines.push("<ul>");
      for (const task of tasks) {
        lines.push(`<li>${buildTaskSentence(task, tasks, esc)}</li>`);
      }
      lines.push("</ul>");
      return lines;
    }

    for (const section of sections) {
      const members = tasks.filter((t) => t.section === section);
      if (members.length === 0) continue;

      lines.push(`<p>In the "${esc(section)}" section:</p>`);
      lines.push("<ul>");
      for (const task of members) {
        lines.push(`<li>${buildTaskSentence(task, tasks, esc)}</li>`);
      }
      lines.push("</ul>");
    }
    return lines;
  }

  // ---------------------------------------------------------------------
  // Key Insights (rules G14, G15, G16)
  // ---------------------------------------------------------------------

  /**
   * Rule G14's takeaway, bolded and first.
   *
   * A critical-path task is the takeaway when one exists, and when that task is
   * also the longest the two claims merge into one sentence rather than being
   * said twice. Otherwise the longest task is the takeaway, and every task tied
   * at the maximum is named.
   *
   * @param {Array<Object>} tasks - The narrated tasks
   * @param {Function} esc - The escape transform for this sink
   * @returns {string} The sentence, or "" when no task can carry it
   */
  function buildTakeaway(tasks, esc) {
    // RULE G14 AS AMENDED 30 August 2026 (sweep finding F7). `longestTasks`
    // excludes milestones — correctly, a point has no length — so a chart of
    // nothing but milestones returned "" and the section lost its bolded lead
    // entirely. The whole-chart fact is the takeaway on such a chart, and it is
    // tested FIRST because it describes every task rather than one of them.
    //
    // A ONE-TASK MILESTONE CHART IS DELIBERATELY EXCLUDED and keeps today's
    // behaviour. "All one tasks are milestones" is ungrammatical and would fail
    // contract clause C8's word branch; the ruling gives no singular form, and
    // minting one here would be inventing a rule rather than enacting one. The
    // per-milestone sentence still names it. Recorded as a gap, not a decision.
    if (tasks.length > 1 && tasks.every((t) => t.isMilestone)) {
      return `All ${countWord(tasks.length)} tasks are milestones.`;
    }

    const longest = longestTasks(tasks);
    const critical = tasks.filter((t) => t.flags.indexOf("crit") !== -1);

    if (critical.length > 0) {
      const task = critical[0];
      const name = `"${esc(task.name)}"`;
      if (longest.indexOf(task) !== -1) {
        return `${name}, the longest task at ${task.duration.text}, is on the critical path.`;
      }
      // RULE G14 AS AMENDED 30 August 2026 (sweep confirmed-good CG11). The
      // merged form carries the duration and this one dropped it, so the
      // takeaway told a reader LESS about a chart whose critical task is not
      // its longest — the case where the length is the more interesting fact.
      // The duration is the prose form per rule G4 as amended, so a derived
      // span still reads "one calendar day" here and "1 calendar day" in the
      // table. A task with no parseable duration keeps the bare sentence.
      return task.duration.text
        ? `${name}, lasting ${task.duration.text}, is on the critical path.`
        : `${name} is on the critical path.`;
    }

    if (longest.length === 0) return "";

    if (longest.length === 1) {
      return `The longest task is "${esc(longest[0].name)}", lasting ${
        longest[0].duration.text
      }.`;
    }

    const names = longest.map((t) => `"${esc(t.name)}"`);
    return `The longest tasks are ${common().formatList(names)}, each lasting ${
      longest[0].duration.text
    }.`;
  }

  /**
   * Rule G16's exclusion insight: one sentence per chart, on the first task the
   * exclusion actually stretched past its declared duration.
   * @param {Array<Object>} tasks - The narrated tasks
   * @param {Object} chart - The adapter's normalised chart
   * @param {Function} esc - The escape transform for this sink
   * @returns {string} The sentence, or "" when nothing was stretched
   */
  function buildExclusionInsight(tasks, chart, esc) {
    if (!hasExclusions(chart)) return "";

    const stretched = tasks.find(
      (t) =>
        t.resolved &&
        !t.isMilestone &&
        t.duration.declared &&
        t.calendarDays > t.duration.days
    );
    if (!stretched) return "";

    const noun = stretched.calendarDays === 1 ? "day" : "days";
    return `"${esc(stretched.name)}" spans ${countWord(
      stretched.calendarDays
    )} calendar ${noun} because excluded days fall within it.`;
  }

  /**
   * The Key Insights section's paragraphs, in rule G14's order: the takeaway,
   * the milestone sentences, the status summary, the exclusion insight, and
   * rule G15's span sentence, each only when it applies.
   *
   * THE STATUS SUMMARY OMITS THE CRITICAL PATH. When a critical task exists it
   * IS the takeaway, which has already said so; repeating it in the summary is
   * the doubling gold exemplar 2 is authored against.
   *
   * @param {Object} chart - The adapter's normalised chart
   * @param {Array<Object>} tasks - The narrated tasks
   * @returns {Array<string>} The lines
   */
  function buildInsights(chart, tasks) {
    const esc = escapeText;
    const lines = [];

    const takeaway = buildTakeaway(tasks, esc);
    if (takeaway) lines.push(`<p><strong>${takeaway}</strong></p>`);

    for (const task of tasks) {
      if (!task.isMilestone) continue;
      lines.push(
        `<p>"${esc(task.name)}" is a milestone on ${formatBritishDate(
          task.end
        )}.</p>`
      );
    }

    const status = buildStatusSentence(flagCounts(tasks), ["done", "active"]);
    if (status) lines.push(`<p>${status}</p>`);

    const exclusion = buildExclusionInsight(tasks, chart, esc);
    if (exclusion) lines.push(`<p>${exclusion}</p>`);

    const span = projectSpan(tasks);
    if (span) {
      const days = inclusiveDayCount(span.start, span.end);
      lines.push(
        `<p>The schedule spans ${countWord(days)} calendar ${
          days === 1 ? "day" : "days"
        }.</p>`
      );
    }

    return lines;
  }

  // ---------------------------------------------------------------------
  // The data table (rule G11)
  // ---------------------------------------------------------------------

  /**
   * A task's Status cell. A milestone is a milestone whatever else it carries;
   * a task with no flag reads None rather than an empty cell, so a reader can
   * tell "no status" from a dropped value.
   * @param {Object} task - One narrated task
   * @returns {string} The cell text
   */
  function statusCell(task) {
    // ENACTED 30 August 2026 (sweep finding F10). A milestone used to return
    // "Milestone" and DISCARD its flags, so a chart whose short reported "three
    // are on the critical path" showed only two such rows and a reader
    // cross-checking the two could not reconcile them. Milestone leads, then
    // the flags in done/active/crit order.
    const flags = task.flags.map((key) => FLAG_TABLE[key]);
    if (task.isMilestone) return [STATUS_MILESTONE, ...flags].join(", ");
    if (flags.length === 0) return STATUS_NONE;
    return flags.join(", ");
  }

  /**
   * The data table. The Section column appears only on a sectioned chart and
   * the Status column only when some task carries a flag or is a milestone, so
   * no chart is given a column of nothing.
   * @param {Object} chart - The adapter's normalised chart
   * @param {Array<Object>} tasks - The narrated tasks
   * @returns {Array<string>} The lines
   */
  function buildTable(chart, tasks) {
    const esc = escapeText;
    const hasSections = orderedSections(chart, tasks).length > 0;
    const hasStatus = tasks.some((t) => t.isMilestone || t.flags.length > 0);

    const caption = chart.title
      ? `Data table for: ${esc(chart.title)}`
      : UNTITLED_CAPTION;

    const headers = ["Task"];
    if (hasSections) headers.push("Section");
    headers.push("Start", "End", "Duration");
    if (hasStatus) headers.push("Status");

    const lines = [];
    lines.push("<table>");
    lines.push(`<caption>${caption}</caption>`);
    lines.push("<thead>");
    lines.push(
      `<tr>${headers.map((h) => `<th scope="col">${h}</th>`).join("")}</tr>`
    );
    lines.push("</thead>");
    lines.push("<tbody>");

    for (const task of tasks) {
      const cells = [];
      if (hasSections) cells.push(esc(task.section));
      // RULE G17: an unresolved row keeps its Task header and says so in every
      // other cell, rather than showing three empty cells a reader cannot tell
      // from a dropped value.
      cells.push(task.resolved ? formatBritishDate(task.start) : NOT_RESOLVED);
      cells.push(task.resolved ? formatBritishDate(task.end) : NOT_RESOLVED);
      cells.push(task.resolved ? task.duration.tableText : NOT_RESOLVED);
      if (hasStatus) cells.push(statusCell(task));

      // RULE G11 AS AMENDED 30 August 2026 (sweep finding F9). Two rows whose
      // `<th scope="row">` is the identical string is a row-header uniqueness
      // problem in its own right, quite apart from the prose: a screen-reader
      // user moving through the table hears the same header twice and cannot
      // tell which row they are in. The suffix is generator-owned and therefore
      // sits OUTSIDE the escaped name, and it matches the words the predecessor
      // clause uses, so the two surfaces address a task the same way.
      const header = task.nameOrdinal
        ? `${esc(task.name)} (${task.nameOrdinal})`
        : esc(task.name);

      lines.push(
        `<tr><th scope="row">${header}</th>${cells
          .map((c) => `<td>${c}</td>`)
          .join("")}</tr>`
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
   * `isGanttHealthy()` reads `null` until the lazy self-check settles, which is
   * why the guard tests for `false` rather than falsiness — a `!healthy` test
   * would refuse every first call on a page.
   *
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} The adapter's normalised chart
   */
  async function readChart(code) {
    const chart = await window.MermaidParseAdapter.parseGantt(code);
    if (window.MermaidParseAdapter.isGanttHealthy() === false) {
      logWarn(
        "[Mermaid Accessibility] Gantt self-check failed; refusing to narrate"
      );
      throw new Error(
        "Parse adapter failed its Gantt self-check; refusing to narrate an unverified chart"
      );
    }
    if (!chart.tasks || chart.tasks.length === 0) {
      throw new Error("Gantt chart carries no tasks; refusing to narrate it");
    }
    return chart;
  }

  /**
   * Generate a short description for a Gantt chart.
   *
   * The PLAIN form is the tier of record and is never escaped: it reaches a
   * `textContent` sink and the SVG's `aria-label`, where an entity would be
   * announced literally. The HTML form is the same sentence escaped exactly
   * once, with no spans and no classes of its own.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<Object>} Resolves to `{ html, text }`
   */
  async function generateShortDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating Gantt short description");

    const chart = await readChart(code);
    const tasks = narrateTasks(chart);

    const overview = buildOverviewSentence(chart, tasks, rawText, false);
    const status = buildStatusSentence(flagCounts(tasks), FLAG_KEYS);

    // RULES G1/G2 AS AMENDED 30 August 2026 (sweep finding F8). The two rules
    // compose ADDITIVELY and neither had any length discipline, so a chart with
    // enough sections, milestones and flags could push the short past the
    // corpus cap on generator prose alone — measured at 274 characters, of
    // which only 76 were the author's title.
    //
    // THE STATUS SENTENCE IS WHAT GOES, and never the opening: the opening
    // carries the author's title, the counts and the span, and rule G12's
    // sibling principle in the XY chart set forbids cutting author text. The
    // status information is not lost, only moved — the detailed tier's Key
    // Insights carries its own status summary, and the critical path is the
    // takeaway there.
    //
    // A FIRST SENTENCE ALREADY OVER THE CAP STANDS. There is nothing left to
    // drop that is not the author's own words, and the per-fixture
    // `shortMaxChars` override is the accommodation the harness provides for
    // exactly that case (gold exemplar 5 of the XY chart set is the precedent).
    let text = status ? `${overview} ${status}` : overview;
    if (status && text.length > SHORT_MAX_CHARS) text = overview;
    logDebug(`[Mermaid Accessibility] Gantt short: ${text}`);

    return {
      html: escapeText(text),
      text: text,
    };
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
   * Generate a detailed description for a Gantt chart.
   *
   * Four headed sections in a fixed order (rule G3): Chart Construction,
   * Schedule, Key Insights with the takeaway first and bolded, and the Data
   * Table. The old module's unconditional dependency sentence and its Potential
   * Schedule Risks section do not survive — rule G12 admits only what the
   * surface delivered.
   *
   * @param {HTMLElement} svgElement - Unused; kept for interface stability
   * @param {string} code - The original mermaid code
   * @returns {Promise<string>} Resolves to the detailed HTML fragment
   */
  async function generateDetailedDescription(svgElement, code) {
    logInfo("[Mermaid Accessibility] Generating Gantt detailed description");

    const chart = await readChart(code);
    const tasks = narrateTasks(chart);

    const construction = [
      buildOverviewSentence(chart, tasks, escapeText, true),
      buildExcludesSentence(chart, escapeText),
    ]
      .filter((sentence) => sentence)
      .join(" ");

    // RULE G3 AS AMENDED 30 August 2026 (fix A § 5.2). A heading that would
    // introduce no content is omitted entirely. It fires today only on Key
    // Insights, for a chart with no takeaway, no milestone, no flag and no span
    // — the circular pair of finding F2, whose section was a heading with
    // nothing under it. A heading is a promise that something follows, and a
    // reader who navigates to one and finds the next heading has been sent
    // somewhere for nothing. The rule is written generally rather than as a Key
    // Insights special case, so a future section that can empty is covered by
    // construction rather than by whoever remembers.
    const parts = [];
    const pushSection = (heading, lines) => {
      if (!lines || lines.length === 0) return;
      parts.push(`<h4>${heading}</h4>`);
      parts.push(...lines);
    };

    pushSection("Chart Construction", construction ? [`<p>${construction}</p>`] : []);
    pushSection("Schedule", buildSchedule(chart, tasks));
    pushSection("Key Insights", buildInsights(chart, tasks));
    pushSection("Data Table", buildTable(chart, tasks));

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
  // yield nothing silently (register item 13). Flowchart and XY chart are the
  // precedent this follows.
  window.MermaidAccessibility.registerDescriptionGenerator("gantt", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    generateShortHTML: async function (svgElement, code) {
      const descriptions = await generateShortDescription(svgElement, code);
      return descriptions.html;
    },
  });

  logInfo(
    "[Mermaid Accessibility] Gantt chart module loaded and registered on the parse adapter's gantt surface"
  );
})();
