/**
 * Mermaid Accessibility - Timeline Module
 * Generates accessible descriptions for timeline diagrams
 */
(function () {
  // Logging configuration (inside IIFE scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Helper functions for logging
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
  }

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("[Mermaid Accessibility] Core module not loaded!");
    return;
  }

  // Utility function aliases
  const Utils = window.MermaidAccessibilityUtils;
  const Common = window.MermaidAccessibilityCommon;

  /**
   * Generate a short description for a timeline
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {object} An object with HTML and plain text versions of the description
   */
  function generateShortDescription(svgElement, code) {
    // Parse timeline structure
    const timelineData = parseTimeline(code, svgElement);

    // Extract title and calculate time range
    const title = timelineData.title || "Timeline";
    const timeRange = calculateSpanRange(timelineData);
    const eventCount = countEvents(timelineData);
    const sectionCount = timelineData.sections
      ? timelineData.sections.length
      : 0;

    // Diagram-source text is escaped once, here, where it enters an HTML
    // string. The PLAIN tier below deliberately keeps the raw values: it feeds
    // the SVG aria-label and the textContent fallback, neither of which parses
    // HTML, so entities there would be read out literally.
    const safeTitle = Common.escapeHtml(title);

    // Build the short description - HTML version
    let htmlDescription = `A timeline diagram`;

    if (title && title !== "Timeline") {
      htmlDescription += ` titled "<span class="diagram-title">${safeTitle}</span>"`;
    }

    if (timeRange) {
      htmlDescription += ` spanning from <span class="timeline-start">${Common.escapeHtml(
        timeRange.start
      )}</span> to <span class="timeline-end">${Common.escapeHtml(
        timeRange.end
      )}</span>`;
    }

    if (sectionCount > 0) {
      htmlDescription += ` organised into <span class="timeline-sections">${sectionCount}</span> section${
        sectionCount !== 1 ? "s" : ""
      }`;
    }

    htmlDescription += ` with <span class="timeline-events">${eventCount}</span> event${
      eventCount !== 1 ? "s" : ""
    }.`;

    // Plain text version for screen readers
    let plainTextDescription = `A timeline diagram`;

    if (title && title !== "Timeline") {
      plainTextDescription += ` titled "${title}"`;
    }

    if (timeRange) {
      plainTextDescription += ` spanning from ${timeRange.start} to ${timeRange.end}`;
    }

    if (sectionCount > 0) {
      plainTextDescription += ` organised into ${sectionCount} section${
        sectionCount !== 1 ? "s" : ""
      }`;
    }

    plainTextDescription += ` with ${eventCount} event${
      eventCount !== 1 ? "s" : ""
    }.`;

    return {
      html: htmlDescription,
      text: plainTextDescription,
    };
  }

  /**
   * Wrapper for the short description generator to maintain backwards compatibility
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {string} The plain text description for backwards compatibility
   */
  function shortDescriptionWrapper(svgElement, code) {
    const descriptions = generateShortDescription(svgElement, code);
    return descriptions.text;
  }

  // ITEM 82, ENACTMENT 5 (3 October 2026): "a line break the picture draws is
  // read as a space; a <br> the picture prints as characters is read as
  // written." Timeline's canvas breaks on `<br>` ALONE, measured 2 October
  // 2026 (measurement 2 § 3): `<br/>`, `<br />` and `<BR>` are printed as
  // characters, so they stay as typed. The rule is the adapter's and is
  // resolved off window AT CALL TIME, never captured at load. The parse reads
  // raw source bytes, so an escaped `&lt;br&gt;` or `#lt;br#gt;` reaches here
  // as typed and is not matched; what the words then say of it is unchanged.
  // The TITLE and the section names are not read through this: the canvas
  // prints a tag there.
  //
  // ITEM 82, HELD EMPTIES (6 October 2026): "a label that draws nothing (only
  // a break, or only spaces) is read as unlabelled, in each type's own
  // words." An event the rule above empties draws an empty card, and is read
  // as "An empty event" in its own place in the period's event list. The
  // event is still counted. The emptiness test runs on the text AFTER the
  // break rule and alters no bytes. Timeline draws no markup, so an event that
  // is only tags is printed as characters and is never empty here.
  const EMPTY_EVENT = Object.freeze({ empty: true });
  const EMPTY_EVENT_PHRASE = "An empty event";

  // ITEM 82, ENTITY SLICE, ENACTMENT 1 (6 October 2026): "the words read the
  // characters the picture prints, decoded once and escaped once." The event
  // is drawn into SVG <text>: Mermaid's own `#name;` and `#digits;` codes are
  // resolved there, while an author-typed `&lt;` and a bare `<` or `&` are
  // printed as typed. decodeSourcePlaceholders (the adapter's raw-source
  // composition, item 78's) gives exactly that, measured on 15 of 15 forms
  // (docs/mermaid-item-82-entity-measure-2026-10-06.md § 2). It runs LAST, on
  // the raw string after the break rule (this sink draws no markup and no
  // links, so there are no other rules), and the list site escapes once. It is
  // resolved off window AT CALL TIME. The title and the section names are NOT
  // read through it (enactment 3).
  let warnedDecodeMissing = false;

  /**
   * Decode Mermaid's own escapes in event text, as the canvas prints them.
   * @param {Object} adapter - window.MermaidParseAdapter
   * @param {string} text - The event text after the break rule
   * @returns {string} The decoded text, or the text as typed when the decode
   *   is not loaded
   */
  function decodeEventText(adapter, text) {
    if (typeof adapter.decodeSourcePlaceholders !== "function") {
      if (!warnedDecodeMissing) {
        warnedDecodeMissing = true;
        logWarn(
          "[Mermaid Accessibility] Timeline: the shared source decode is not loaded; event text is read as typed"
        );
      }
      return text;
    }
    return adapter.decodeSourcePlaceholders(text);
  }

  /**
   * Read a timeline event's text with typed line breaks as single spaces and
   * Mermaid's escapes decoded as the canvas prints them.
   * @param {string} text - The trimmed event text from the source line
   * @returns {string|Object} The text with `<br>` read as a space, the text
   *   as typed when the rule is not loaded, or EMPTY_EVENT when the event
   *   draws nothing
   */
  function readEventText(text) {
    const adapter = window.MermaidParseAdapter;
    if (!adapter || typeof adapter.replaceTypedLineBreaks !== "function") {
      logWarn(
        "[Mermaid Accessibility] Timeline: the shared line-break rule is not loaded; event text is read as typed"
      );
      return text.trim() === "" ? EMPTY_EVENT : text;
    }
    const read = adapter.replaceTypedLineBreaks(
      text,
      adapter.LINE_BREAK_FORMS.BR_ONLY
    );
    return read.trim() === "" ? EMPTY_EVENT : decodeEventText(adapter, read);
  }

  /**
   * One event as it goes into the period's event list.
   * @param {string|Object} event - Event text, or EMPTY_EVENT
   * @returns {string} HTML for the list item's content
   */
  function eventHtml(event) {
    return event === EMPTY_EVENT ? EMPTY_EVENT_PHRASE : Common.escapeHtml(event);
  }

  // ITEM 189, BUILD 1 (21 November 2026), TL1: "lines Mermaid reads and does
  // not draw are not periods or events." Mermaid's own timeline grammar
  // (11.17.2, read from the shipped chunk) takes a YAML frontmatter block, a
  // comment (a line starting `%` and not `%{`, so every `%%` line), an
  // `accTitle:` or `accDescr:` line and an `accDescr { ... }` block as
  // not-diagram text: none of them reaches the picture. This reader used to
  // match any of them as a period named by the text before its first colon
  // (`%% Note: remember` read as a period "%% Note"). They are dropped, not
  // blanked, and nothing else changes. Called once, from parseTimeline.
  const FRONTMATTER_FENCE = "---";
  // ITEM 189, BUILD 1b, TL1b: "the pre-pass drops exactly the comment forms
  // Mermaid drops, no more." Read from the lexer and probed on Mermaid's own
  // db (11.17.2): a line starting `%` and not `%{`, a line starting `#`, and a
  // line whose first character (not `}`) is followed by `%%` are whole-line
  // comments. A `%%`, `%` or `#` after other text is NOT a comment in an event,
  // a title or a section name (the text stays, comment and all), and `%{` is
  // not a comment. So only the start of the line is tested.
  const COMMENT_OPEN = "%";
  const COMMENT_NOT_BEFORE = "{";
  const COMMENT_HASH = "#";
  const COMMENT_GLUED = /^[^}]%%/;
  const ACC_LINE = /^acc(?:Title|Descr)\s*:/i;
  const ACC_DESCR_BLOCK_OPEN = /^accDescr\s*\{/i;

  /**
   * Whether a trimmed line is a whole-line comment to Mermaid's timeline lexer.
   * @param {string} trimmed - One source line, trimmed
   * @returns {boolean} True for the three whole-line comment forms only
   */
  function isCommentLine(trimmed) {
    if (trimmed.startsWith(COMMENT_HASH)) return true;
    if (trimmed.startsWith(COMMENT_OPEN)) {
      return !trimmed.startsWith(COMMENT_OPEN + COMMENT_NOT_BEFORE);
    }
    return COMMENT_GLUED.test(trimmed);
  }

  /**
   * Drop the lines the timeline grammar reads and the picture does not draw.
   * @param {string} code - The mermaid source with the init directive removed
   * @returns {string} The source without those lines, line breaks as they were
   */
  function dropUndrawnLines(code) {
    const lines = code.split("\n");
    let first = 0;

    // A frontmatter block counts only at the start of the source, and only
    // when its closing fence exists; an unclosed one is left as typed.
    while (first < lines.length && lines[first].trim() === "") first++;
    if (first < lines.length && lines[first].trim() === FRONTMATTER_FENCE) {
      for (let close = first + 1; close < lines.length; close++) {
        if (lines[close].trim() === FRONTMATTER_FENCE) {
          lines.splice(0, close + 1);
          break;
        }
      }
    }

    const kept = [];
    let inDescrBlock = false;

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (inDescrBlock) {
        inDescrBlock = !trimmed.includes("}");
        return;
      }
      if (isCommentLine(trimmed) || ACC_LINE.test(trimmed)) return;
      if (ACC_DESCR_BLOCK_OPEN.test(trimmed)) {
        inDescrBlock = !trimmed.includes("}");
        return;
      }
      kept.push(line);
    });

    return kept.join("\n");
  }

  // ITEM 189, BUILD 1, TL2: "a period line splits into events the way
  // Mermaid splits it." In the shipped grammar an event begins at a colon
  // FOLLOWED BY WHITESPACE and runs to the next such colon or the end of the
  // line; a colon with no whitespace after it stays in the text. So
  // `2020 : One : Two : Three` is one period with three events. The text
  // handed in is everything after the line's FIRST colon, which is always the
  // first event's colon (the period is what precedes it); a colon at the very
  // end of that text begins an empty event, as it always has here.
  const EVENT_SEPARATOR = /:(?=\s|$)/;

  /**
   * Parse timeline structure from mermaid code
   * @param {string} code - The mermaid code
   * @param {HTMLElement} svgElement - The SVG element (fallback)
   * @returns {Object} Parsed timeline structure
   */
  function parseTimeline(code, svgElement) {
    const result = {
      title: null,
      sections: [],
      events: [], // Used if no sections defined
    };

    if (!code) {
      // Try to extract from SVG if code not available
      return parseTimelineFromSvg(svgElement);
    }

    // Clean up the code to remove any theme initialisation
    const cleanCode = code.replace(/%%\{init:[\s\S]*?\}%%/g, "").trim();

    // Split into lines and process each line
    const lines = dropUndrawnLines(cleanCode)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);

    let currentSection = null;
    let isTimelineHeader = true; // Assume initial lines are headers

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip the "timeline" declaration
      if (line.toLowerCase() === "timeline") {
        continue;
      }

      // Check for title
      if (line.toLowerCase().startsWith("title ")) {
        result.title = line.substring(6).trim();
        continue;
      }

      // Check for section
      if (line.toLowerCase().startsWith("section ")) {
        const sectionName = line.substring(8).trim();
        currentSection = {
          name: sectionName,
          events: [],
        };
        result.sections.push(currentSection);
        continue;
      }

      // Process event lines
      // Format: "time : event" or continuation "     : event"
      const eventMatch = line.match(/^([^:]+)?:(.*)$/);
      if (eventMatch) {
        const timePeriod = eventMatch[1] ? eventMatch[1].trim() : null;
        const eventTexts = eventMatch[2]
          .split(EVENT_SEPARATOR)
          .map((text) => readEventText(text.trim()));

        if (timePeriod) {
          // This is a new time period
          const eventObj = {
            time: timePeriod,
            events: eventTexts,
          };

          if (currentSection) {
            currentSection.events.push(eventObj);
          } else {
            result.events.push(eventObj);
          }
        } else if (currentSection && currentSection.events.length > 0) {
          // This is a continuation of the previous time period in a section
          currentSection.events[currentSection.events.length - 1].events.push(
            ...eventTexts
          );
        } else if (result.events.length > 0) {
          // This is a continuation of the previous time period without sections
          result.events[result.events.length - 1].events.push(...eventTexts);
        }

        isTimelineHeader = false; // We've reached the event content
      }
    }

    return result;
  }

  /**
   * Parse timeline from SVG as a fallback method
   * @param {HTMLElement} svgElement - The SVG element
   * @returns {Object} Parsed timeline structure
   */
  function parseTimelineFromSvg(svgElement) {
    const result = {
      title: null,
      sections: [],
      events: [],
    };

    if (!svgElement) return result;

    try {
      // Try to find title text element
      const titleElement = svgElement.querySelector(".timelineTitle");
      if (titleElement) {
        result.title = titleElement.textContent.trim();
      }

      // Find section elements
      const sectionElements = svgElement.querySelectorAll(".timeline-section");

      if (sectionElements.length > 0) {
        // Process sections
        sectionElements.forEach((sectionEl) => {
          const sectionNameEl = sectionEl.querySelector(".section-name");
          const sectionName = sectionNameEl
            ? sectionNameEl.textContent.trim()
            : "Unnamed Section";

          const section = {
            name: sectionName,
            events: [],
          };

          // Find time period groups
          const timeperiodGroups = sectionEl.querySelectorAll(
            ".timeline-time-period"
          );

          timeperiodGroups.forEach((timeGroup) => {
            const timeLabel = timeGroup.querySelector(".time-period-label");
            const timePeriod = timeLabel
              ? timeLabel.textContent.trim()
              : "Unknown Period";

            const eventEls = timeGroup.querySelectorAll(".timeline-event");
            const events = Array.from(eventEls).map((el) =>
              el.textContent.trim()
            );

            section.events.push({
              time: timePeriod,
              events: events,
            });
          });

          result.sections.push(section);
        });
      } else {
        // No sections found, try to process as a flat timeline
        const timeperiodGroups = svgElement.querySelectorAll(
          ".timeline-time-period"
        );

        timeperiodGroups.forEach((timeGroup) => {
          const timeLabel = timeGroup.querySelector(".time-period-label");
          const timePeriod = timeLabel
            ? timeLabel.textContent.trim()
            : "Unknown Period";

          const eventEls = timeGroup.querySelectorAll(".timeline-event");
          const events = Array.from(eventEls).map((el) =>
            el.textContent.trim()
          );

          result.events.push({
            time: timePeriod,
            events: events,
          });
        });
      }

      return result;
    } catch (error) {
      logError(
        "[Mermaid Accessibility] Error parsing timeline from SVG:",
        error
      );
      return result;
    }
  }

  /**
   * The forms a period label may take and still be read as a date. Mermaid
   * accepts any string as a period label, so a label carries chronology only
   * when it says so; "Phase one" does not.
   *
   * The set is deliberately narrow. A label the generator does not recognise
   * is treated as NOT date-like, because the two errors cost different
   * amounts: a wrong chronology claim tells the reader something false, while
   * a wrong sequence claim tells them something weaker and true.
   */
  const DATE_LIKE_PERIOD_PATTERNS = [
    // A 4-digit year 1000-2999, alone or as a range (hyphen or en dash).
    /^[12]\d{3}(\s*[-–]\s*[12]\d{3})?$/,
    // An ISO date, YYYY-MM or YYYY-MM-DD.
    /^[12]\d{3}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/,
    // An English month name or three-letter abbreviation, optionally with a year.
    /^(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(tember)?|oct(ober)?|nov(ember)?|dec(ember)?)(\s+[12]\d{3})?$/i,
  ];

  /**
   * Decide whether one period label reads as a date
   * @param {string} label - The author's period label
   * @returns {boolean} True only when the label matches a recognised date form
   */
  function isDateLikePeriod(label) {
    if (typeof label !== "string") return false;

    const trimmed = label.trim();
    if (!trimmed) return false;

    return DATE_LIKE_PERIOD_PATTERNS.some((pattern) => pattern.test(trimmed));
  }

  // ITEM 189, BUILD 1, TL4: a run of dates reads as chronological only when
  // the labels never go backwards. The sort key is [year, month, day] with 0
  // for a part the label does not give; a year-less month name has year null.
  const MONTH_NUMBERS = Object.freeze({
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  });
  const MONTH_ABBREVIATION_LENGTH = 3;

  /**
   * The sort key for a label that reads as a date
   * @param {string} label - The author's period label
   * @returns {Array|null} [year, month, day], or null when not date-like
   */
  function dateSortKey(label) {
    if (!isDateLikePeriod(label)) return null;

    const trimmed = label.trim();
    const iso = trimmed.match(/^([12]\d{3})-(\d{2})(?:-(\d{2}))?$/);
    if (iso) return [Number(iso[1]), Number(iso[2]), Number(iso[3] || 0)];

    const year = trimmed.match(/^([12]\d{3})/);
    if (year) return [Number(year[1]), 0, 0];

    const month = trimmed.match(/^([a-z]+)(?:\s+([12]\d{3}))?$/i);
    const monthNumber =
      MONTH_NUMBERS[month[1].slice(0, MONTH_ABBREVIATION_LENGTH).toLowerCase()];
    return [month[2] ? Number(month[2]) : null, monthNumber, 0];
  }

  /**
   * Compare two sort keys, stopping at the first part either label leaves out
   * @param {Array} a - Earlier label's key
   * @param {Array} b - Later label's key
   * @returns {number|null} Negative, zero or positive; null when one label
   *   names a year and the other does not, so the two cannot be ordered
   */
  function compareDateKeys(a, b) {
    if ((a[0] === null) !== (b[0] === null)) return null;

    for (let part = 0; part < a.length; part++) {
      const left = a[part] || 0;
      const right = b[part] || 0;
      if (left === 0 || right === 0) return 0;
      if (left !== right) return left - right;
    }
    return 0;
  }

  /**
   * Whether the periods are a run of two or more dates that never go
   * backwards. A pair that cannot be ordered does not count as a run: a wrong
   * chronology claim tells the reader something false.
   * @param {Array} periods - The time-period objects in document order
   * @returns {boolean} True only for a demonstrable forward run
   */
  function readsAsChronology(periods) {
    if (periods.length < 2) return false;

    const keys = periods.map((period) => dateSortKey(period.time));
    if (keys.some((key) => key === null)) return false;

    return keys.every((key, index) => {
      if (index === 0) return true;
      const order = compareDateKeys(keys[index - 1], key);
      return order !== null && order <= 0;
    });
  }

  /**
   * Collect every time period in document order, across sections or without them
   * @param {Object} timelineData - Parsed timeline data
   * @returns {Array} The time-period objects, each carrying a `time` label
   */
  function collectTimePeriods(timelineData) {
    if (timelineData.sections && timelineData.sections.length > 0) {
      let periods = [];
      timelineData.sections.forEach((section) => {
        periods = periods.concat(section.events);
      });
      return periods;
    }

    return timelineData.events || [];
  }

  /**
   * Calculate the time range of the timeline
   * @param {Object} timelineData - Parsed timeline data
   * @returns {Object|null} Object with start and end times, or null if cannot determine
   */
  function calculateTimeRange(timelineData) {
    const allEvents = collectTimePeriods(timelineData);

    if (allEvents.length === 0) return null;

    // Extract first and last time periods
    const firstEvent = allEvents[0];
    const lastEvent = allEvents[allEvents.length - 1];

    if (!firstEvent || !lastEvent) return null;

    return {
      start: firstEvent.time,
      end: lastEvent.time,
    };
  }

  /**
   * The range the "spanning from FIRST to LAST" clause may name. ONE period,
   * date or not, has no span to claim (ITEM 189, BUILD 1b, TL6b: it used to
   * read "from Phase one to Phase one"). Labels that are all dates but do not
   * read as a forward run (they go backwards) have none either; labels that
   * are not all dates keep today's wording, which names the first and last as
   * listed.
   * @param {Object} timelineData - Parsed timeline data
   * @returns {Object|null} Start and end labels, or null for no span clause
   */
  function calculateSpanRange(timelineData) {
    const periods = collectTimePeriods(timelineData);
    if (periods.length === 1) return null;

    const allDates =
      periods.length > 0 &&
      periods.every((period) => isDateLikePeriod(period.time));

    if (allDates && !readsAsChronology(periods)) return null;
    return calculateTimeRange(timelineData);
  }

  /**
   * Count the total number of events in the timeline
   * @param {Object} timelineData - Parsed timeline data
   * @returns {number} Total number of events
   */
  function countEvents(timelineData) {
    let count = 0;

    // Count events in sections
    if (timelineData.sections && timelineData.sections.length > 0) {
      timelineData.sections.forEach((section) => {
        section.events.forEach((timePeriod) => {
          count += timePeriod.events.length;
        });
      });
    } else {
      // Count events without sections
      timelineData.events.forEach((timePeriod) => {
        count += timePeriod.events.length;
      });
    }

    return count;
  }

  /**
   * Generate a detailed description for a timeline
   * @param {HTMLElement} svgElement - The SVG element
   * @param {string} code - The original mermaid code
   * @returns {string} HTML description with structured, accessible information
   */
  function generateDetailedDescription(svgElement, code) {
    logDebug("[Mermaid Accessibility] Generating timeline description");

    // Parse the timeline data
    const timelineData = parseTimeline(code, svgElement);

    // Start building the HTML description
    let description = "";

    // Add title and overview section
    const title = timelineData.title || "Timeline";
    const timeRange = calculateSpanRange(timelineData);
    const eventCount = countEvents(timelineData);
    const sectionCount = timelineData.sections
      ? timelineData.sections.length
      : 0;

    description += `<section class="timeline-section timeline-overview">
        <h4 class="timeline-section-heading">Timeline Overview</h4>
        <p>This is a timeline diagram`;

    if (title && title !== "Timeline") {
      description += ` titled "<span class="diagram-title">${Common.escapeHtml(
        title
      )}</span>"`;
    }

    if (timeRange) {
      description += ` spanning from <span class="timeline-start">${Common.escapeHtml(
        timeRange.start
      )}</span> to <span class="timeline-end">${Common.escapeHtml(
        timeRange.end
      )}</span>`;
    }

    if (sectionCount > 0) {
      description += ` organised into <span class="timeline-sections">${sectionCount}</span> section${
        sectionCount !== 1 ? "s" : ""
      }`;
    }

    description += ` with <span class="timeline-events">${eventCount}</span> total event${
      eventCount !== 1 ? "s" : ""
    }.</p>
      </section>`;

    // Add structure section
    description += `<section class="timeline-section timeline-structure">
        <h4 class="timeline-section-heading">Timeline Structure</h4>`;

    if (sectionCount > 0) {
      description += `<p>The timeline is divided into the following ${
        sectionCount === 1 ? "section" : "sections"
      }:</p>
        <ul class="timeline-sections-list">`;

      timelineData.sections.forEach((section) => {
        const sectionEventCount = section.events.reduce(
          (total, timePeriod) => total + timePeriod.events.length,
          0
        );

        description += `<li class="timeline-section-item">
            <span class="timeline-section-name">${Common.escapeHtml(section.name)}</span> 
            (with ${sectionEventCount} event${
          sectionEventCount !== 1 ? "s" : ""
        })
          </li>`;
      });

      description += `</ul>`;
    } else {
      description += `<p>The timeline is presented as a sequential list of events without sections.</p>`;
    }

    description += `</section>`;

    // Add detailed content section - this is the main timeline content
    description += `<section class="timeline-section timeline-content">
        <h4 class="timeline-section-heading">Timeline Content</h4>`;

    // Generate the timeline content
    if (sectionCount > 0) {
      // Timeline with sections
      timelineData.sections.forEach((section) => {
        description += `<div class="timeline-section-container">
            <h5 class="timeline-section-name">${Common.escapeHtml(section.name)}</h5>
            <ul class="timeline-events-list">`;

        section.events.forEach((timePeriod) => {
          description += `<li class="timeline-time-period">
              <span class="timeline-time">${Common.escapeHtml(timePeriod.time)}</span>:
              <ul class="timeline-period-events">`;

          timePeriod.events.forEach((event) => {
            description += `<li class="timeline-event">${eventHtml(event)}</li>`;
          });

          description += `</ul>
            </li>`;
        });

        description += `</ul>
          </div>`;
      });
    } else {
      // Timeline without sections
      description += `<ul class="timeline-events-list">`;

      timelineData.events.forEach((timePeriod) => {
        description += `<li class="timeline-time-period">
            <span class="timeline-time">${Common.escapeHtml(timePeriod.time)}</span>:
            <ul class="timeline-period-events">`;

        timePeriod.events.forEach((event) => {
          description += `<li class="timeline-event">${eventHtml(event)}</li>`;
        });

        description += `</ul>
          </li>`;
      });

      description += `</ul>`;
    }

    description += `</section>`;

    // Add the closing insight. Whether it may claim CHRONOLOGY depends on the
    // period labels: Mermaid accepts any string there, so a timeline of
    // "Phase one" and "Phase two" has an order but no time order. ITEM 189,
    // BUILD 1: it claims chronology only for a run of two or more dates that
    // never go backwards (TL4); a timeline with no periods has no insight at
    // all (TL5, the empty set used to satisfy the old `every` vacuously); and
    // ONE period, date or not, gets the single-period wording (TL6).
    const periods = collectTimePeriods(timelineData);

    if (periods.length === 0) {
      return description;
    }

    if (readsAsChronology(periods)) {
      description += `<section class="timeline-section timeline-insights">
        <h4 class="timeline-section-heading">Chronological Progression</h4>
        <p>The timeline progresses chronologically from ${Common.escapeHtml(
          timeRange?.start || "the beginning"
        )} to ${Common.escapeHtml(timeRange?.end || "the end")}, 
        displaying how events develop over time.</p>
      </section>`;
    } else if (periods.length === 1) {
      // One period has no sequence to describe, and the plural frame below
      // would read "1 periods". Naming the single label is all there is to say.
      description += `<section class="timeline-section timeline-insights">
        <h4 class="timeline-section-heading">Period Sequence</h4>
        <p>The timeline presents a single period, ${Common.escapeHtml(
          periods[0].time
        )}.</p>
      </section>`;
    } else {
      // Order without chronology. The labels are the author's, escaped once
      // here and unquoted, exactly as the chronological branch treats them.
      // The first and last AS LISTED are named here even for dates that go
      // backwards, where the span clause above is deliberately left out.
      const listedRange = calculateTimeRange(timelineData);
      description += `<section class="timeline-section timeline-insights">
        <h4 class="timeline-section-heading">Period Sequence</h4>
        <p>The timeline presents ${
          periods.length
        } periods in the order listed, from ${Common.escapeHtml(
        listedRange?.start || "the beginning"
      )} to ${Common.escapeHtml(listedRange?.end || "the end")}.</p>
      </section>`;
    }

    return description;
  }

  // Register with the core module
  window.MermaidAccessibility.registerDescriptionGenerator("timeline", {
    generateShort: shortDescriptionWrapper,
    generateDetailed: generateDetailedDescription,
    // Add a new property for HTML-formatted short description
    generateShortHTML: function (svgElement, code) {
      return generateShortDescription(svgElement, code).html;
    },
  });

  logInfo("[Mermaid Accessibility] Timeline module loaded and registered");
})();
