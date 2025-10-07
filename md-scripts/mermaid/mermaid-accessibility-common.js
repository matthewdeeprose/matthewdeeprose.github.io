/**
 * Mermaid Accessibility Common Utilities
 * Shared functions for all diagram accessibility modules
 */
window.MermaidAccessibilityCommon = (function () {
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

  /**
   * Set the current logging level
   * @param {number} level - The logging level (0-3)
   */
  function setLogLevel(level) {
    if (level >= LOG_LEVELS.ERROR && level <= LOG_LEVELS.DEBUG) {
      currentLogLevel = level;
    }
  }

  /**
   * Check if logging should occur based on current level
   * @param {number} level - The level to check
   * @returns {boolean} True if logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log an error message
   * @param {string} message - The error message
   * @param {...any} args - Additional arguments
   */
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(
        `[Mermaid Accessibility Common] ERROR: ${message}`,
        ...args
      );
    }
  }

  /**
   * Log a warning message
   * @param {string} message - The warning message
   * @param {...any} args - Additional arguments
   */
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Mermaid Accessibility Common] WARN: ${message}`, ...args);
    }
  }

  /**
   * Log an info message
   * @param {string} message - The info message
   * @param {...any} args - Additional arguments
   */
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Mermaid Accessibility Common] INFO: ${message}`, ...args);
    }
  }

  /**
   * Log a debug message
   * @param {string} message - The debug message
   * @param {...any} args - Additional arguments
   */
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Mermaid Accessibility Common] DEBUG: ${message}`, ...args);
    }
  }

  // Aliases for existing utilities
  const Utils = window.MermaidAccessibilityUtils || {};

  /**
   * Format a list of items with proper grammar (Oxford comma)
   * @param {Array} items - Array of item strings
   * @returns {string} Formatted list
   */
  function formatList(items) {
    logDebug("Formatting list with items:", items);

    if (!items || items.length === 0) {
      logDebug("Empty or null items array provided");
      return "";
    }

    if (items.length === 1) {
      logDebug("Single item list");
      return items[0];
    }

    if (items.length === 2) {
      logDebug("Two item list");
      return `${items[0]} and ${items[1]}`;
    }

    // For 3 or more items, use Oxford comma
    logDebug("Multiple item list, using Oxford comma");
    const lastItem = items[items.length - 1];
    const otherItems = items.slice(0, -1);
    return `${otherItems.join(", ")}, and ${lastItem}`;
  }

  /**
   * Clean node text to remove Mermaid formatting characters
   * @param {string} text - The node text with formatting
   * @returns {string} Cleaned text
   */
  function cleanNodeText(text) {
    logDebug("Cleaning node text:", text);

    if (!text) {
      logDebug("Empty or null text provided");
      return "";
    }

    // Remove Mermaid formatting characters for different node types
    const cleanedText = text
      .replace(/^\[\[|\]\]$/g, "") // Remove [[ and ]] (subprocess)
      .replace(/^\[\/?|\/?\]$/g, "") // Remove [, /, and ] (process and I/O nodes)
      .replace(/^\(\[|\]\)$/g, "") // Remove ([ and ]) (start/end nodes)
      .replace(/^\(\(|\)\)$/g, "") // Remove (( and )) (circle)
      .replace(/^\)\)|\(\($/g, "") // Remove )) and (( (bang)
      .replace(/^\)\($/g, "") // Remove )( (cloud)
      .replace(/^\(|\)$/g, "") // Remove ( and ) (rounded square)
      .replace(/^\{\{|\}\}$/g, "") // Remove {{ and }} (hexagon)
      .replace(/^\{|\}$/g, "") // Remove { and } (decision nodes)
      .replace(/^"`|`"$/g, "") // Remove "` and `" (markdown strings)
      // Process markdown formatting if present
      .replace(/\*\*(.*?)\*\*/g, "$1") // Remove ** for bold formatting
      .replace(/\*(.*?)\*/g, "$1") // Remove * for italic formatting
      // Remove class styling syntax
      .replace(/:::\s*[\w\s]+/g, "")
      .replace(/:::$/g, ""); // Remove ::: class styling

    logDebug("Cleaned text result:", cleanedText);
    return cleanedText;
  }

  /**
   * Create a standard section structure for descriptions
   * @param {string} type - The section type (e.g., 'overview', 'insights')
   * @param {string} diagramType - The diagram type (e.g., 'flowchart', 'gantt')
   * @param {string} title - The section heading
   * @param {string} content - The section content (HTML)
   * @param {Object} options - Additional options (e.g., ARIA roles)
   * @returns {string} HTML section element
   */
  function createSection(type, diagramType, title, content, options = {}) {
    logDebug(`Creating section: ${type} for ${diagramType} diagram`);

    const role = options.role || "";
    const roleAttr = role ? ` role="${role}"` : "";

    const sectionHtml = `<section class="mermaid-section ${diagramType}-${type}"${roleAttr}>
        <h4 class="mermaid-section-heading" id="${diagramType}-${type}-heading">${title}</h4>
        ${content}
      </section>`;

    logDebug("Section created successfully");
    return sectionHtml;
  }

  /**
   * Format a count with the appropriate singular/plural form of a noun
   * @param {number} count - The count
   * @param {string} singular - Singular form of the noun
   * @param {string} plural - Plural form of the noun (defaults to singular + 's')
   * @returns {string} Formatted count with noun
   */
  function formatCountNoun(count, singular, plural = null) {
    logDebug(
      `Formatting count: ${count} with singular: ${singular}, plural: ${plural}`
    );

    // Handle undefined, null or NaN cases
    if (count === undefined || count === null || isNaN(count)) {
      logWarn("Invalid count provided, defaulting to 0");
      return `0 ${plural || singular + "s"}`;
    }

    // Generate plural form if not provided
    if (!plural) {
      logDebug("Generating plural form automatically");
      // Handle special English plural forms
      if (
        singular.endsWith("y") &&
        !singular.endsWith("ay") &&
        !singular.endsWith("ey") &&
        !singular.endsWith("oy") &&
        !singular.endsWith("uy")
      ) {
        plural = singular.slice(0, -1) + "ies";
      } else if (
        singular.endsWith("s") ||
        singular.endsWith("x") ||
        singular.endsWith("z") ||
        singular.endsWith("ch") ||
        singular.endsWith("sh")
      ) {
        plural = singular + "es";
      } else {
        plural = singular + "s";
      }
    }

    // Format the count for better readability
    const formattedCount = count.toLocaleString("en-GB");

    // Choose appropriate form based on count
    const result = `${formattedCount} ${count === 1 ? singular : plural}`;
    logDebug("Formatted count result:", result);
    return result;
  }

  /**
   * Generate a standard overview section for any diagram
   * @param {string} diagramType - The diagram type (e.g., 'flowchart', 'gantt')
   * @param {string} title - The diagram title
   * @param {Object} stats - Statistics about the diagram
   * @returns {string} HTML section element
   */
  function createOverviewSection(diagramType, title, stats) {
    logDebug(`Creating overview section for ${diagramType} diagram`);

    let content = `<p>This ${diagramType} diagram`;

    if (title) {
      content += ` titled "<span class="diagram-title">${title}</span>"`;
      logDebug("Added title to overview");
    }

    // Add statistics if available with fixed singular/plural handling
    if (stats) {
      logDebug("Adding statistics to overview:", stats);

      if (stats.elementCount) {
        content += ` contains <span class="diagram-count">${stats.elementCount}</span>`;
        content += ` ${
          stats.elementCount === 1
            ? stats.elementName?.replace(/s$/, "") || "element"
            : stats.elementName || "elements"
        }`;
      }

      if (stats.groupCount) {
        content += ` organised into <span class="diagram-count">${stats.groupCount}</span>`;
        content += ` ${
          stats.groupCount === 1
            ? stats.groupName?.replace(/s$/, "") || "group"
            : stats.groupName || "groups"
        }`;
      }
    }

    content += `.`;

    return createSection(
      "overview",
      diagramType,
      `${capitalize(diagramType)} Overview`,
      content
    );
  }

  /**
   * Create a data list section for details
   * @param {string} diagramType - The diagram type
   * @param {string} title - The section title
   * @param {Array} items - Array of items to list
   * @param {Function} itemFormatter - Function to format each item as HTML
   * @returns {string} HTML section
   */
  function createDataListSection(diagramType, title, items, itemFormatter) {
    logDebug(
      `Creating data list section for ${diagramType} with ${
        items?.length || 0
      } items`
    );

    let content = `<ul class="${diagramType}-list">`;

    items.forEach((item, index) => {
      logDebug(`Formatting item ${index + 1}`);
      content += `<li class="${diagramType}-item">
          ${itemFormatter(item, index)}
        </li>`;
    });

    content += `</ul>`;

    return createSection("data", diagramType, title, content);
  }

  /**
   * Create a standard insights section
   * @param {string} diagramType - The diagram type
   * @param {Array} insights - Array of insight text/objects
   * @returns {string} HTML section
   */
  function createInsightsSection(diagramType, insights) {
    logDebug(`Creating insights section for ${diagramType}`);

    if (!insights || insights.length === 0) {
      logDebug("No insights provided, skipping section");
      return "";
    }

    let content = `<ul class="${diagramType}-insights-list">`;

    insights.forEach((insight) => {
      const insightText = typeof insight === "string" ? insight : insight.text;
      const insightClass =
        typeof insight === "string" ? "" : ` ${insight.class || ""}`;

      content += `<li class="${diagramType}-insight${insightClass}">${insightText}</li>`;
    });

    content += `</ul>`;

    logDebug(`Created insights section with ${insights.length} insights`);
    return createSection("insights", diagramType, "Key Insights", content);
  }

  /**
   * Generate a diagram description using a standard template
   * @param {string} diagramType - The diagram type
   * @param {Object} options - Configuration options
   * @returns {string} Complete HTML description
   */
  function generateStandardDescription(diagramType, options) {
    logInfo(`Generating standard description for ${diagramType} diagram`);

    const { title, stats, sections, insights, visualNotes } = options;

    let description = `<div class="${diagramType}-description">`;

    // 1. Overview section
    description += createOverviewSection(diagramType, title, stats);

    // 2. Custom sections
    if (sections && sections.length > 0) {
      logDebug(`Adding ${sections.length} custom sections`);
      sections.forEach((section) => {
        description += section;
      });
    }

    // 3. Insights section if provided
    if (insights && insights.length > 0) {
      description += createInsightsSection(diagramType, insights);
    }

    // 4. Visual notes section if provided
    if (visualNotes) {
      logDebug("Adding visual notes section");
      description += createSection(
        "visual-notes",
        diagramType,
        "Visual Representation",
        `<p>${visualNotes}</p>`
      );
    }

    description += `</div>`;

    logInfo("Standard description generated successfully");
    return description;
  }

  /**
   * Parse diagram title from code or SVG
   * @param {string} code - The mermaid code
   * @param {HTMLElement} svgElement - The SVG element
   * @param {string} diagramType - The diagram type
   * @returns {string} The diagram title
   */
  function parseDiagramTitle(code, svgElement, diagramType) {
    logDebug(`Parsing diagram title for ${diagramType}`);

    // First try to extract from code
    const titleMatch = code.match(/title\s+([^\n]+)/i);
    if (titleMatch) {
      logDebug("Title found in code:", titleMatch[1].trim());
      return titleMatch[1].trim();
    }

    // Then try to extract from SVG
    const title = Utils.extractTitleFromSVG
      ? Utils.extractTitleFromSVG(svgElement)
      : null;

    if (title) {
      logDebug("Title found in SVG:", title);
      return title;
    }

    // Default titles by diagram type
    const defaultTitles = {
      flowchart: "Flowchart",
      pieChart: "Pie Chart",
      gantt: "Gantt Chart",
      sequenceDiagram: "Sequence Diagram",
      classDiagram: "Class Diagram",
      stateDiagram: "State Diagram",
      entityRelationshipDiagram: "Entity Relationship Diagram",
      userJourney: "User Journey",
      mindmap: "Mind Map",
      timeline: "Timeline",
      gitGraph: "Git Graph",
    };

    const defaultTitle = defaultTitles[diagramType] || "Diagram";
    logDebug("Using default title:", defaultTitle);
    return defaultTitle;
  }

  /**
   * Count diagram elements
   * @param {HTMLElement} svgElement - The SVG element
   * @param {string} code - The diagram code
   * @param {Object} options - Counting options
   * @returns {Object} Count statistics
   */
  function countDiagramElements(svgElement, code, options) {
    logDebug("Counting diagram elements with options:", options);

    const { elementSelector, codePattern, defaultCount } = options;

    // First try to count from the SVG
    if (svgElement && elementSelector) {
      logDebug("Attempting to count from SVG using selector:", elementSelector);
      const elements = svgElement.querySelectorAll(elementSelector);
      if (elements.length > 0) {
        logDebug(`Found ${elements.length} elements in SVG`);
        return elements.length;
      }
    }

    // Then try to count from the code
    if (code && codePattern) {
      logDebug("Attempting to count from code using pattern");
      const matches = code.match(codePattern);
      if (matches) {
        logDebug(`Found ${matches.length} elements in code`);
        return matches.length;
      }
    }

    // Return default count if provided
    logDebug(`Using default count: ${defaultCount || 0}`);
    return defaultCount || 0;
  }

  /**
   * Simple string capitalisation
   * @param {string} str - The string to capitalise
   * @returns {string} Capitalised string
   */
  function capitalize(str) {
    if (!str) {
      logDebug("Empty string provided for capitalisation");
      return "";
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Handle errors gracefully with fallback descriptions
   * @param {Error} error - The error object
   * @param {string} diagramType - The diagram type
   * @returns {string} Fallback description
   */
  function handleParsingError(error, diagramType) {
    logError(`Error parsing ${diagramType}:`, error);

    return `<div class="mermaid-error">
        <p>This appears to be a ${diagramType} diagram, but it could not be fully parsed for accessibility.</p>
        <p>Consider adding a custom description using the <code>accDescr</code> directive in your Mermaid code.</p>
      </div>`;
  }

  /**
   * Convert a technical term to plain language
   * @param {string} term - The technical term
   * @returns {string} Plain language equivalent
   */
  function plainLanguageTerms(term) {
    logDebug("Converting technical term:", term);

    const terms = {
      TB: "top to bottom",
      BT: "bottom to top",
      LR: "left to right",
      RL: "right to left",
      sync: "synchronous",
      async: "asynchronous",
      init: "initialisation",
      func: "function",
      var: "variable",
      param: "parameter",
      arg: "argument",
      prop: "property",
      attr: "attribute",
      elem: "element",
      obj: "object",
      arr: "array",
      bool: "boolean",
      str: "string",
      num: "number",
      int: "integer",
      float: "floating-point number",
      const: "constant",
      ref: "reference",
    };

    const result = terms[term] || term;
    logDebug("Converted term result:", result);
    return result;
  }

  // Log successful module initialisation
  logInfo("Common utilities module initialised successfully");

  // Public API
  return {
    formatList,
    cleanNodeText,
    createSection,
    createOverviewSection,
    createDataListSection,
    createInsightsSection,
    generateStandardDescription,
    parseDiagramTitle,
    countDiagramElements,
    capitalize,
    handleParsingError,
    plainLanguageTerms,
    formatCountNoun,
    // Expose logging functions for use by other modules
    setLogLevel,
    logError,
    logWarn,
    logInfo,
    logDebug,
    LOG_LEVELS,
  };
})();
