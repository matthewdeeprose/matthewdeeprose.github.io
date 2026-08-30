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
    const timeRange = calculateTimeRange(timelineData);
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
    const lines = cleanCode
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
        const eventText = eventMatch[2].trim();

        if (timePeriod) {
          // This is a new time period
          const eventObj = {
            time: timePeriod,
            events: [eventText],
          };

          if (currentSection) {
            currentSection.events.push(eventObj);
          } else {
            result.events.push(eventObj);
          }
        } else if (currentSection && currentSection.events.length > 0) {
          // This is a continuation of the previous time period in a section
          currentSection.events[currentSection.events.length - 1].events.push(
            eventText
          );
        } else if (result.events.length > 0) {
          // This is a continuation of the previous time period without sections
          result.events[result.events.length - 1].events.push(eventText);
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
    const timeRange = calculateTimeRange(timelineData);
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
            description += `<li class="timeline-event">${Common.escapeHtml(event)}</li>`;
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
          description += `<li class="timeline-event">${Common.escapeHtml(event)}</li>`;
        });

        description += `</ul>
          </li>`;
      });

      description += `</ul>`;
    }

    description += `</section>`;

    // Add the closing insight. Whether it may claim CHRONOLOGY depends on the
    // period labels: Mermaid accepts any string there, so a timeline of
    // "Phase one" and "Phase two" has an order but no time order. An empty
    // set satisfies `every` vacuously and keeps the original wording, which
    // preserves the no-periods fallbacks below exactly as they were.
    const periods = collectTimePeriods(timelineData);
    const everyPeriodIsDateLike = periods.every((period) =>
      isDateLikePeriod(period.time)
    );

    if (everyPeriodIsDateLike) {
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
      description += `<section class="timeline-section timeline-insights">
        <h4 class="timeline-section-heading">Period Sequence</h4>
        <p>The timeline presents ${
          periods.length
        } periods in the order listed, from ${Common.escapeHtml(
        timeRange?.start || "the beginning"
      )} to ${Common.escapeHtml(timeRange?.end || "the end")}.</p>
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
