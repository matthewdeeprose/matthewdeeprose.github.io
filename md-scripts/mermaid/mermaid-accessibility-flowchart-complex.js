/**
 * Mermaid Accessibility - Complex Flowchart Module
 * Provides basic accessibility for complex flowcharts with subgraphs
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

  // Override current level if flags are set
  if (ENABLE_ALL_LOGGING) {
    currentLogLevel = LOG_LEVELS.DEBUG;
  } else if (DISABLE_ALL_LOGGING) {
    currentLogLevel = -1; // Below ERROR level
  }

  /**
   * Check if logging should occur for the given level
   * @param {number} level - The log level to check
   * @returns {boolean} Whether logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log an error message
   * @param {string} message - The message to log
   */
  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(message);
    }
  }

  /**
   * Log a warning message
   * @param {string} message - The message to log
   */
  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(message);
    }
  }

  /**
   * Log an info message
   * @param {string} message - The message to log
   */
  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(message);
    }
  }

  /**
   * Log a debug message
   * @param {string} message - The message to log
   */
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

  // Utility function aliases
  const Utils = window.MermaidAccessibilityUtils;

  /**
   * Generate a short description for a complex flowchart
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {string} A short description
   */
  function generateShortDescription(svgElement, code) {
    // Extract title if available
    let title = Utils.extractTitleFromSVG(svgElement) || "flowchart";

    // Count subgraphs
    const subgraphMatches = code.match(/subgraph\s+([^\n]+)/g) || [];
    const subgraphCount = subgraphMatches.length;

    // Generate a basic description acknowledging the complexity
    let description = `A complex flowchart${
      title ? ` titled "${title}"` : ""
    } containing ${subgraphCount} subgraphs. This diagram includes nested process groups, making it too complex to automatically describe in detail.`;

    return description;
  }

  /**
   * Generate a detailed description for a complex flowchart with subgraphs
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @returns {string} A detailed HTML description
   */
  function generateDetailedDescription(svgElement, code) {
    logDebug(
      "[Mermaid Accessibility] Generating complex flowchart description"
    );

    // Count the subgraphs
    const subgraphMatches = code.match(/subgraph\s+([^\n]+)/g) || [];
    const subgraphCount = subgraphMatches.length;

    // Extract any subgraph titles if present
    const subgraphTitles = [];
    if (subgraphMatches.length > 0) {
      subgraphMatches.forEach((match) => {
        // Extract the title part after "subgraph" and before any possible formatting
        const titleMatch = match.match(
          /subgraph\s+([^\[\n]+)(?:\s*\[([^\]]+)\])?/
        );
        if (titleMatch && titleMatch[1]) {
          // Use formatted title in square brackets if available, otherwise use the ID
          const title = titleMatch[2]
            ? titleMatch[2].trim()
            : titleMatch[1].trim();
          subgraphTitles.push(title);
        }
      });
    }

    // Extract the title if available
    const title = Utils.extractTitleFromSVG(svgElement) || "flowchart";

    // Build a helpful but limited description
    let description = `
    <div class="flowchart-complex-description">
      <p>This is a complex flowchart${
        title ? ` titled "${title}"` : ""
      } containing ${subgraphCount} process groups or subgraphs.</p>
      
      <p>Complex flowcharts with nested groups are difficult to automatically describe in detail. For better accessibility, consider:</p>
      
      <ul>
        <li>Adding a custom description using the <code>accDescr</code> directive in your Mermaid code</li>
        <li>Splitting the diagram into simpler connected diagrams</li>
        <li>Providing a text alternative that describes the workflow</li>
      </ul>`;

    // Add information about the subgraphs if available
    if (subgraphTitles.length > 0) {
      description += `
      <p>The diagram contains the following process groups:</p>
      <ul>`;

      subgraphTitles.forEach((title) => {
        description += `
        <li>${title}</li>`;
      });

      description += `
      </ul>`;
    }

    description += `
    </div>`;

    return description;
  }

  // Register with the core module
  window.MermaidAccessibility.registerDescriptionGenerator("flowchartComplex", {
    generateShort: generateShortDescription,
    generateDetailed: generateDetailedDescription,
  });

  logInfo(
    "[Mermaid Accessibility] Complex flowchart module loaded and registered"
  );
})();
