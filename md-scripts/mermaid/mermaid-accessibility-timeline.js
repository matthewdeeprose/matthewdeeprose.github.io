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

    // Build the short description - HTML version
    let htmlDescription = `A timeline diagram`;

    if (title && title !== "Timeline") {
      htmlDescription += ` titled "<span class="diagram-title">${title}</span>"`;
    }

    if (timeRange) {
      htmlDescription += ` spanning from <span class="timeline-start">${timeRange.start}</span> to <span class="timeline-end">${timeRange.end}</span>`;
    }

    if (sectionCount > 0) {
      htmlDescription += ` organised into <span class="timeline-sections">${sectionCount}</span> sections`;
    }

    htmlDescription += ` with <span class="timeline-events">${eventCount}</span> events.`;

    // Plain text version for screen readers
    let plainTextDescription = `A timeline diagram`;

    if (title && title !== "Timeline") {
      plainTextDescription += ` titled "${title}"`;
    }

    if (timeRange) {
      plainTextDescription += ` spanning from ${timeRange.start} to ${timeRange.end}`;
    }

    if (sectionCount > 0) {
      plainTextDescription += ` organised into ${sectionCount} sections`;
    }

    plainTextDescription += ` with ${eventCount} events.`;

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
   * Calculate the time range of the timeline
   * @param {Object} timelineData - Parsed timeline data
   * @returns {Object|null} Object with start and end times, or null if cannot determine
   */
  function calculateTimeRange(timelineData) {
    let allEvents = [];

    // Collect all time periods
    if (timelineData.sections && timelineData.sections.length > 0) {
      timelineData.sections.forEach((section) => {
        allEvents = allEvents.concat(section.events);
      });
    } else {
      allEvents = timelineData.events;
    }

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
      description += ` titled "<span class="diagram-title">${title}</span>"`;
    }

    if (timeRange) {
      description += ` spanning from <span class="timeline-start">${timeRange.start}</span> to <span class="timeline-end">${timeRange.end}</span>`;
    }

    if (sectionCount > 0) {
      description += ` organised into <span class="timeline-sections">${sectionCount}</span> sections`;
    }

    description += ` with <span class="timeline-events">${eventCount}</span> total events.</p>
      </section>`;

    // Add structure section
    description += `<section class="timeline-section timeline-structure">
        <h4 class="timeline-section-heading">Timeline Structure</h4>`;

    if (sectionCount > 0) {
      description += `<p>The timeline is divided into the following sections:</p>
        <ul class="timeline-sections-list">`;

      timelineData.sections.forEach((section) => {
        const sectionEventCount = section.events.reduce(
          (total, timePeriod) => total + timePeriod.events.length,
          0
        );

        description += `<li class="timeline-section-item">
            <span class="timeline-section-name">${section.name}</span> 
            (with ${sectionEventCount} events)
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
            <h5 class="timeline-section-name">${section.name}</h5>
            <ul class="timeline-events-list">`;

        section.events.forEach((timePeriod) => {
          description += `<li class="timeline-time-period">
              <span class="timeline-time">${timePeriod.time}</span>:
              <ul class="timeline-period-events">`;

          timePeriod.events.forEach((event) => {
            description += `<li class="timeline-event">${event}</li>`;
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
            <span class="timeline-time">${timePeriod.time}</span>:
            <ul class="timeline-period-events">`;

        timePeriod.events.forEach((event) => {
          description += `<li class="timeline-event">${event}</li>`;
        });

        description += `</ul>
          </li>`;
      });

      description += `</ul>`;
    }

    description += `</section>`;

    // Add chronological progression insight
    description += `<section class="timeline-section timeline-insights">
        <h4 class="timeline-section-heading">Chronological Progression</h4>
        <p>The timeline progresses chronologically from ${
          timeRange?.start || "the beginning"
        } to ${timeRange?.end || "the end"}, 
        displaying how events develop over time.</p>
      </section>`;

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
