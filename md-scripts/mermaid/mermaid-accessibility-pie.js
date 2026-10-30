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
   * The shared chart-description builders (vendor/chart-describe/src/charts.js),
   * resolved at call time and never cached, so load order cannot leave a stale
   * capture. If charts.js is missing, the first call throws and the core's
   * generator-failed fallback speaks, rather than wrong text being returned.
   * @returns {Object} ChartDescribeCharts
   */
  function chartsCore() {
    return window.ChartDescribeCharts;
  }

  const NO_TITLE = "";

  /** The author's title, or NO_TITLE. Code first, then the drawn title. */
  function extractTitle(code, svgElement) {
    const titleMatch = code.match(/pie\s+title\s+([^\n]+)/i);
    if (titleMatch) return titleMatch[1].trim();
    return svgElement.querySelector(".pieTitleText")?.textContent.trim() || NO_TITLE;
  }

  /**
   * Generate a short description for a pie chart
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {object} An object with HTML and plain text versions of the description
   */
  function generateShortDescription(svgElement, code) {
    logDebug("Generating short description for pie chart");

    // Extract title from code or SVG
    const title = extractTitle(code, svgElement);

    logDebug("Chart title extracted: " + title);

    // Parse segments to enable insights
    const segments = parseSegments(code, svgElement);

    return chartsCore().buildPieShort(title, segments);
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
    const title = extractTitle(code, svgElement);

    logDebug("Processing chart titled: " + title);

    // Get segments from parsing function
    let segments = parseSegments(code, svgElement);

    return chartsCore().buildPieDetailed(title, segments);
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
