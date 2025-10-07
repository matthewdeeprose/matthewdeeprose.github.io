/**
 * Mermaid Accessibility - Pie Chart Module
 * Generates accessible descriptions for pie charts
 */
const MermaidAccessibilityPieChart = (function () {
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

  let currentLogLevel = DEFAULT_LOG_LEVEL;

  // Helper functions for logging
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error("[Mermaid Accessibility - Pie Chart] " + message);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn("[Mermaid Accessibility - Pie Chart] " + message);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log("[Mermaid Accessibility - Pie Chart] " + message);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log("[Mermaid Accessibility - Pie Chart] DEBUG: " + message);
    }
  }

  // Ensure the core module exists
  if (!window.MermaidAccessibility) {
    logError("Core module not loaded!");
    return;
  }

  // Utility function aliases
  const Utils = window.MermaidAccessibilityUtils;

  /**
   * Generate a short description for a pie chart
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {object} An object with HTML and plain text versions of the description
   */
  function generateShortDescription(svgElement, code) {
    logDebug("Generating short description for pie chart");

    // Extract title from code or SVG
    const titleMatch = code.match(/pie\s+title\s+([^\n]+)/i);
    const title = titleMatch
      ? titleMatch[1].trim()
      : svgElement.querySelector(".pieTitleText")?.textContent.trim() ||
        "Pie Chart";

    logDebug("Chart title extracted: " + title);

    // Parse segments to enable insights
    const segments = parseSegments(code, svgElement);

    // Sort segments by value (descending)
    segments.sort((a, b) => b.value - a.value);

    logDebug("Processed " + segments.length + " segments");

    // Basic description - HTML version
    let htmlDescription = `A pie chart titled "<span class="diagram-title">${title}</span>" showing the distribution of ${
      segments.length || "multiple"
    } categories.`;

    // Plain text version for screen readers and textContent scenarios
    let plainTextDescription = `A pie chart titled "${title}" showing the distribution of ${
      segments.length || "multiple"
    } categories.`;

    // Add enhanced information about largest segment if available
    if (segments.length > 0) {
      const largestSegment = segments[0];
      const total = segments.reduce((sum, segment) => sum + segment.value, 0);
      const percentage = ((largestSegment.value / total) * 100).toFixed(1);

      logDebug(
        "Largest segment: " + largestSegment.name + " at " + percentage + "%"
      );

      // Add proportion context
      let proportion = "";
      if (percentage > 50) {
        proportion = "over half";
      } else if (percentage > 33) {
        proportion = "over a third";
      } else if (percentage > 25) {
        proportion = "over a quarter";
      }

      // HTML version
      htmlDescription += ` <span class="diagram-segment">${
        largestSegment.name
      }</span> is the largest segment at <span class="diagram-percentage">${percentage}%</span>${
        proportion
          ? `, representing <span class="diagram-proportion">${proportion}</span> of the total`
          : ""
      }.`;

      // Plain text version
      plainTextDescription += ` ${
        largestSegment.name
      } is the largest segment at ${percentage}%${
        proportion ? `, representing ${proportion} of the total` : ""
      }.`;
    }

    logDebug("Short description generated successfully");

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

    // Return text version for backwards compatibility with existing code
    return descriptions.text;
  }

  /**
   * Parse segments from mermaid code or SVG
   * @param {string} code - The mermaid diagram code
   * @param {HTMLElement} svgElement - The SVG element
   * @returns {Array} Array of segment objects
   */
  function parseSegments(code, svgElement) {
    logDebug("Parsing segments from code and SVG");

    // Parse from mermaid code first (more reliable)
    const pieSegmentPattern = /"([^"]+)"\s*:\s*(\d+\.?\d*)/g;
    let segments = [];
    let match;

    while ((match = pieSegmentPattern.exec(code)) !== null) {
      segments.push({
        name: match[1],
        value: parseFloat(match[2]),
      });
    }

    logDebug("Parsed " + segments.length + " segments from code");

    // Fallback to SVG extraction if code parsing fails
    if (segments.length === 0 && svgElement) {
      logDebug("Code parsing failed, attempting SVG extraction");

      segments = Array.from(svgElement.querySelectorAll(".pieCircle")).map(
        (segment) => {
          const labelEl = svgElement.querySelector(
            `.pieTitleText[fill="${segment.getAttribute("fill")}"]`
          );

          return {
            name: labelEl ? labelEl.textContent.trim() : "",
            value: parseFloat(segment.getAttribute("data-value") || "0"),
          };
        }
      );

      logDebug("Extracted " + segments.length + " segments from SVG");
    }

    if (segments.length === 0) {
      logWarn("No segments found in either code or SVG");
    }

    return segments;
  }

  /**
   * Generate a detailed description for a pie chart
   * @param {HTMLElement} svgElement - The SVG element
   * @param {string} code - The original mermaid code
   * @returns {string} HTML description with structured, accessible information
   */
  function generateDetailedDescription(svgElement, code) {
    logInfo("Generating detailed pie chart description");

    // Extract title from code or SVG
    const titleMatch = code.match(/pie\s+title\s+([^\n]+)/i);
    const title = titleMatch
      ? titleMatch[1].trim()
      : svgElement.querySelector(".pieTitleText")?.textContent.trim() ||
        "Pie Chart";

    logDebug("Processing chart titled: " + title);

    // Get segments from parsing function
    let segments = parseSegments(code, svgElement);

    // Sort segments from highest to lowest value
    segments.sort((a, b) => b.value - a.value);

    // Calculate total for percentage calculation
    const total = segments.reduce((sum, segment) => sum + segment.value, 0);

    logDebug("Total value across all segments: " + total);

    // Create structured description
    let description = "";

    // 1. Chart Construction Section
    description += `<section class="mermaid-section chart-construction">
          <h4 class="mermaid-details-heading">Chart Construction</h4>
          <p>This pie chart titled "<span class="diagram-title">${title}</span>" shows the distribution of categories.</p>`;

    if (segments.length > 0) {
      description += `<p>The chart shows <span class="diagram-count">${segments.length}</span> categories:</p><ul class="diagram-segment-list">`;
      segments.forEach((segment) => {
        description += `<li><span class="diagram-segment">${segment.name.toLowerCase()}</span></li>`;
      });
      description += `</ul>`;
    } else {
      logWarn("No segments available for detailed description");
      description += `<p>The chart is divided into segments in a circular layout, with each segment's size representing its proportion of the whole.</p>`;
    }

    description += `</section>`;

    // 2. Key Insights Section
    description += `<section class="mermaid-section chart-insights">
          <h4 class="mermaid-details-heading">Key Insights</h4><ul class="diagram-insights-list">`;

    // Add largest segment insight
    if (segments.length > 0) {
      const largestSegment = segments[0];
      const largestPercentage = ((largestSegment.value / total) * 100).toFixed(
        1
      );

      logDebug(
        "Largest segment analysis: " +
          largestSegment.name +
          " (" +
          largestPercentage +
          "%)"
      );

      // Add proportion context
      let proportion = "";
      if (largestPercentage > 50) {
        proportion = "over half";
      } else if (largestPercentage > 33) {
        proportion = "over a third";
      } else if (largestPercentage > 25) {
        proportion = "over a quarter";
      }

      description += `<li class="diagram-insight diagram-insight-primary"><strong><span class="diagram-segment">${
        largestSegment.name
      }</span> is the largest segment at <span class="diagram-percentage">${largestPercentage}%</span>${
        proportion
          ? `, representing <span class="diagram-proportion">${proportion}</span> of the total`
          : ""
      }.</strong></li>`;
    }

    // Add total
    description += `<li class="diagram-insight diagram-insight-total">Total: <span class="diagram-value">${total.toFixed(
      1
    )}</span></li>`;

    // Add largest and smallest segments
    if (segments.length > 0) {
      const largestSegment = segments[0];
      const smallestSegment = segments[segments.length - 1];

      const largestPercentage = ((largestSegment.value / total) * 100).toFixed(
        1
      );
      description += `<li class="diagram-insight diagram-insight-largest">Largest segment: <span class="diagram-segment">${
        largestSegment.name
      }</span> (<span class="diagram-value">${largestSegment.value.toFixed(
        1
      )}</span>, <span class="diagram-percentage">${largestPercentage}%</span>)</li>`;

      const smallestPercentage = (
        (smallestSegment.value / total) *
        100
      ).toFixed(1);
      description += `<li class="diagram-insight diagram-insight-smallest">Smallest segment: <span class="diagram-segment">${
        smallestSegment.name
      }</span> (<span class="diagram-value">${smallestSegment.value.toFixed(
        1
      )}</span>, <span class="diagram-percentage">${smallestPercentage}%</span>)</li>`;
    }

    description += `</ul></section>`;

    // 3. Complete Data Points Section
    description += `<section class="mermaid-section chart-data">
          <h4 class="mermaid-details-heading">Complete Data Points</h4>
          <ul class="diagram-data-list">`;

    // Add all segments with values and percentages
    segments.forEach((segment) => {
      const percentage = ((segment.value / total) * 100).toFixed(1);
      description += `<li class="diagram-data-item"><span class="diagram-segment">${
        segment.name
      }</span>: <span class="diagram-value">${segment.value.toFixed(
        1
      )}</span> (<span class="diagram-percentage">${percentage}%</span>)</li>`;
    });

    description += `</ul></section>`;

    // Add data pattern section if we have enough segments to identify patterns
    if (segments.length >= 3) {
      logDebug(
        "Generating pattern analysis for " + segments.length + " segments"
      );
      description += generatePatternSection(segments, total);
    }

    logInfo("Detailed pie chart description generated successfully");
    return description;
  }

  /**
   * Generate a section describing patterns in the pie chart data
   * @param {Array} segments - Array of segment objects
   * @param {number} total - Total value of all segments
   * @returns {string} HTML for pattern section
   */
  function generatePatternSection(segments, total) {
    logDebug("Analysing distribution patterns");

    // Calculate distribution characteristics
    const averageValue = total / segments.length;
    const avgPercentage = (100 / segments.length).toFixed(1);

    // Check if distribution is fairly even or heavily skewed
    const topSegmentValue = segments[0].value;
    const topSegmentPercentage = ((topSegmentValue / total) * 100).toFixed(1);

    // Calculate if top segment is significantly larger than average
    const isSkewed = topSegmentValue > averageValue * 1.5;

    logDebug(
      "Distribution analysis - Average: " +
        avgPercentage +
        "%, Top segment: " +
        topSegmentPercentage +
        "%, Skewed: " +
        isSkewed
    );

    // Create pattern section
    let patternSection = `<section class="mermaid-section chart-patterns">
      <h4 class="mermaid-details-heading">Distribution Pattern</h4>
      <p>`;

    if (isSkewed) {
      patternSection += `This chart shows a <span class="diagram-pattern diagram-pattern-skewed">skewed distribution</span> where <span class="diagram-segment">${segments[0].name}</span> 
        at <span class="diagram-percentage">${topSegmentPercentage}%</span> is significantly larger than the average segment size 
        of <span class="diagram-percentage">${avgPercentage}%</span>.`;
    } else {
      patternSection += `This chart shows a <span class="diagram-pattern diagram-pattern-balanced">relatively balanced distribution</span> 
        with an average segment size of <span class="diagram-percentage">${avgPercentage}%</span>.`;
    }

    // Add group information if there are more than 4 segments
    if (segments.length > 4) {
      // Calculate the combined percentage of the smallest segments (bottom half)
      const bottomHalfIndex = Math.floor(segments.length / 2);
      const bottomHalf = segments.slice(bottomHalfIndex);
      const bottomHalfTotal = bottomHalf.reduce(
        (sum, segment) => sum + segment.value,
        0
      );
      const bottomHalfPercentage = ((bottomHalfTotal / total) * 100).toFixed(1);

      logDebug(
        "Bottom " +
          bottomHalf.length +
          " segments represent " +
          bottomHalfPercentage +
          "% of total"
      );

      patternSection += ` The bottom <span class="diagram-count">${bottomHalf.length}</span> segments 
        collectively represent <span class="diagram-percentage">${bottomHalfPercentage}%</span> of the total.`;
    }

    patternSection += `</p></section>`;

    return patternSection;
  }

  /**
   * Wrapper for the detailed description generator
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {string} The HTML description
   */
  function detailedDescriptionWrapper(svgElement, code) {
    return generateDetailedDescription(svgElement, code);
  }

  // Register with the core module
  if (
    window.MermaidAccessibility &&
    window.MermaidAccessibility.registerDescriptionGenerator
  ) {
    window.MermaidAccessibility.registerDescriptionGenerator("pieChart", {
      generateShort: shortDescriptionWrapper,
      generateDetailed: detailedDescriptionWrapper,
      // Add a new property for HTML-formatted short description
      generateShortHTML: function (svgElement, code) {
        return generateShortDescription(svgElement, code).html;
      },
    });

    logInfo(
      "Pie chart module successfully registered with enhanced HTML support"
    );
  } else {
    logError(
      "Failed to register pie chart module - core module registration function not available"
    );
  }

  // Public API for configuration
  return {
    setLogLevel: function (level) {
      if (typeof level === "number" && level >= 0 && level <= 3) {
        currentLogLevel = level;
        logInfo("Log level set to " + level);
      } else {
        logWarn("Invalid log level: " + level);
      }
    },
    getLogLevel: function () {
      return currentLogLevel;
    },
    LOG_LEVELS: LOG_LEVELS,
  };
})();

// Export logic (kept outside the IIFE to avoid reference errors)
if (typeof module !== "undefined" && module.exports) {
  module.exports = MermaidAccessibilityPieChart;
} else {
  window.MermaidAccessibilityPieChart = MermaidAccessibilityPieChart;
}
