/**
 * Mermaid Accessibility Utilities
 * Common utility functions used across different accessibility modules
 */
window.MermaidAccessibilityUtils = (function () {
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

  // Current log level (can be changed at runtime)
  let currentLogLevel = DEFAULT_LOG_LEVEL;

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
   * @param {...any} args - Additional arguments
   */
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(message, ...args);
    }
  }

  /**
   * Log a warning message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments
   */
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(message, ...args);
    }
  }

  /**
   * Log an info message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments
   */
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(message, ...args);
    }
  }

  /**
   * Log a debug message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments
   */
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(message, ...args);
    }
  }

  /**
   * Set the current logging level
   * @param {number} level - The new log level
   */
  function setLogLevel(level) {
    if (level >= LOG_LEVELS.ERROR && level <= LOG_LEVELS.DEBUG) {
      currentLogLevel = level;
      logInfo(
        `[Mermaid Accessibility] Log level set to ${
          Object.keys(LOG_LEVELS)[level]
        }`
      );
    }
  }

  // Configuration for utilities
  const config = {
    ariaLiveRegionId: "mermaid-sr-announcer",
  };

  /**
   * Safely get a value from localStorage with fallback
   * @param {string} key - The localStorage key
   * @param {*} defaultValue - Default value if key doesn't exist or localStorage is unavailable
   * @returns {*} The value or defaultValue
   */
  function getSavedPreference(key, defaultValue) {
    try {
      const value = localStorage.getItem(key);
      return value !== null ? value : defaultValue;
    } catch (e) {
      logWarn(`[Mermaid Accessibility] LocalStorage error: ${e.message}`);
      return defaultValue;
    }
  }

  /**
   * Safely save a value to localStorage
   * @param {string} key - The localStorage key
   * @param {*} value - Value to store
   * @returns {boolean} Success status
   */
  function savePreference(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      logWarn(`[Mermaid Accessibility] LocalStorage error: ${e.message}`);
      return false;
    }
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   */
  function announceToScreenReader(message) {
    // Find or create screen reader announcer
    let announcer = document.getElementById(config.ariaLiveRegionId);

    if (!announcer) {
      // Create screen reader announcer element
      announcer = document.createElement("div");
      announcer.id = config.ariaLiveRegionId;
      announcer.className = "sr-only";
      announcer.setAttribute("aria-live", "polite");
      announcer.setAttribute("aria-atomic", "true");
      document.body.appendChild(announcer);

      // Add necessary CSS if not already present
      if (!document.getElementById("sr-styles")) {
        const style = document.createElement("style");
        style.id = "sr-styles";
        style.textContent = `
                    .sr-only {
                        position: absolute;
                        width: 1px;
                        height: 1px;
                        padding: 0;
                        margin: -1px;
                        overflow: hidden;
                        clip: rect(0, 0, 0, 0);
                        white-space: nowrap;
                        border: 0;
                    }
                `;
        document.head.appendChild(style);
      }
    }

    // Set the message to be announced
    announcer.textContent = message;
  }

  /**
   * Add necessary CSS styles for descriptions
   */
  function addDescriptionStyles() {
    // Check if styles are already added
    if (document.getElementById("mermaid-description-styles")) {
      return;
    }

    // Create style element
    const style = document.createElement("style");
    style.id = "mermaid-description-styles";

    // CSS rules with support for both light and dark themes
    style.textContent = `
        `;

    // Add styles to document head
    document.head.appendChild(style);
    logInfo("[Mermaid Accessibility] Added description styles");
  }

  function getDescriptionButtonIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>`;
  }
  /**
   * Find mermaid containers without accessibility features
   * @param {HTMLElement} rootNode - Node to search within
   * @returns {Array} Array of containers without features
   */
  function findContainersWithoutFeatures(rootNode) {
    const allContainers = rootNode.querySelectorAll(".mermaid-container");
    return Array.from(allContainers).filter(
      (container) =>
        container.getAttribute("data-accessibility-initialized") !== "true"
    );
  }

  /**
   * Extract title from SVG if available
   * @param {HTMLElement} svgElement - The SVG element
   * @returns {string|null} Extracted title or null
   */
  function extractTitleFromSVG(svgElement) {
    if (!svgElement) return null;

    // Try to find title element within SVG
    const titleElement = svgElement.querySelector("title");
    if (titleElement && titleElement.textContent.trim()) {
      return titleElement.textContent.trim();
    }

    // Look for a text element that might be a title (typically near the top/center)
    const textElements = Array.from(svgElement.querySelectorAll("text"));
    if (textElements.length > 0) {
      // Sort by y-coordinate to find top elements
      const topTexts = textElements
        .sort((a, b) => {
          const aY = parseFloat(a.getAttribute("y") || 0);
          const bY = parseFloat(b.getAttribute("y") || 0);
          return aY - bY;
        })
        .slice(0, 2); // Get top 2 elements

      // Return the text content of the top element if it exists
      if (topTexts.length > 0 && topTexts[0].textContent.trim()) {
        return topTexts[0].textContent.trim();
      }
    }

    return null;
  }

  /**
   * Parse accessibility directives from mermaid code
   * @param {string} code - The mermaid diagram code
   * @returns {Object} Object containing title and description
   */
  function parseAccessibilityDirectives(code) {
    const result = {
      title: null,
      description: null,
    };

    if (!code) return result;

    // Look for accTitle and accDescr directives
    const titleMatch = code.match(/accTitle\s*:\s*(.*?)(?:\n|$)/);
    const descrMatch = code.match(/accDescr\s*:\s*(.*?)(?:\n|$)/);

    if (titleMatch && titleMatch[1]) {
      result.title = titleMatch[1].trim();
    }

    if (descrMatch && descrMatch[1]) {
      result.description = descrMatch[1].trim();
    }

    // Also check for multi-line descriptions
    if (!result.description) {
      const multiLineMatch = code.match(/accDescr\s*\{([^}]*)\}/s);
      if (multiLineMatch && multiLineMatch[1]) {
        result.description = multiLineMatch[1].trim();
      }
    }

    return result;
  }

  /**
   * Helper function to format text nodes within an HTML element
   * This should be called separately from formatNumbersInText
   * @param {HTMLElement} element - The element containing text nodes to format
   */
  function formatTextNodesInElement(element) {
    if (!element) return;

    // Walk the DOM and format text nodes
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const skipClassPatterns = [
      /diagram-value/, // Skip formatting values like "44.3"
      /diagram-percentage/, // Skip formatting percentages like "44.3%"
      /version/,
      /code/,
      /technical/,
    ];

    const skipTagNames = ["CODE", "PRE", "SCRIPT", "STYLE", "KBD"];

    let node;
    while ((node = walker.nextNode())) {
      // Skip empty text nodes
      if (!node.textContent.trim()) continue;

      // Skip formatting content of code blocks and other technical elements
      const parent = node.parentNode;
      if (skipTagNames.includes(parent.nodeName)) continue;

      // Skip classes we don't want to format
      const parentClass = parent.className || "";
      if (skipClassPatterns.some((pattern) => pattern.test(parentClass)))
        continue;

      // Format the text content
      node.textContent = formatNumbersInText(node.textContent);
    }
  }
  // Date utility functions
  const DateUtils = {
    /**
     * Helper function to parse YYYY-MM-DD dates
     * @param {string} dateStr - Date string in YYYY-MM-DD format
     * @returns {Date|null} Parsed date or null if invalid
     */
    parseDate: function (dateStr) {
      // First try using date-fns if available
      if (
        typeof dateFns !== "undefined" &&
        typeof dateFns.parse === "function"
      ) {
        try {
          return dateFns.parse(dateStr, "yyyy-MM-dd", new Date());
        } catch (e) {
          logWarn(
            "[Mermaid Accessibility] date-fns parse failed, using fallback"
          );
        }
      }

      // Fallback to native implementation
      if (!dateStr || typeof dateStr !== "string") return null;

      // Parse YYYY-MM-DD format
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return null;

      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // JavaScript months are 0-indexed
      const day = parseInt(match[3], 10);

      const date = new Date(year, month, day);

      // Check if the date is valid
      if (isNaN(date.getTime())) return null;

      return date;
    },

    /**
     * Helper function to format dates as YYYY-MM-DD
     * @param {Date} date - Date to format
     * @returns {string|null} Formatted date or null if invalid
     */
    formatDate: function (date) {
      // First try using date-fns if available
      if (
        typeof dateFns !== "undefined" &&
        typeof dateFns.format === "function"
      ) {
        try {
          return dateFns.format(date, "yyyy-MM-dd");
        } catch (e) {
          logWarn(
            "[Mermaid Accessibility] date-fns format failed, using fallback"
          );
        }
      }

      // Fallback to native implementation
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return null;
      }

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    },

    /**
     * Helper function to add days to a date
     * @param {Date} date - Base date
     * @param {number} days - Number of days to add
     * @returns {Date|null} New date or null if invalid
     */
    addDays: function (date, days) {
      // First try using date-fns if available
      if (
        typeof dateFns !== "undefined" &&
        typeof dateFns.addDays === "function"
      ) {
        try {
          return dateFns.addDays(date, days);
        } catch (e) {
          logWarn(
            "[Mermaid Accessibility] date-fns addDays failed, using fallback"
          );
        }
      }

      // Fallback to native implementation
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return null;
      }

      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    },

    /**
     * Helper function to get difference in days between two dates
     * @param {Date} laterDate - Later date
     * @param {Date} earlierDate - Earlier date
     * @returns {number|null} Difference in days or null if invalid
     */
    differenceInDays: function (laterDate, earlierDate) {
      // First try using date-fns if available
      if (
        typeof dateFns !== "undefined" &&
        typeof dateFns.differenceInDays === "function"
      ) {
        try {
          return dateFns.differenceInDays(laterDate, earlierDate);
        } catch (e) {
          logWarn(
            "[Mermaid Accessibility] date-fns differenceInDays failed, using fallback"
          );
        }
      }

      // Fallback to native implementation
      if (
        !laterDate ||
        !earlierDate ||
        !(laterDate instanceof Date) ||
        !(earlierDate instanceof Date) ||
        isNaN(laterDate.getTime()) ||
        isNaN(earlierDate.getTime())
      ) {
        return null;
      }

      // Normalise the dates to remove time portion
      const laterDay = new Date(
        laterDate.getFullYear(),
        laterDate.getMonth(),
        laterDate.getDate()
      );
      const earlierDay = new Date(
        earlierDate.getFullYear(),
        earlierDate.getMonth(),
        earlierDate.getDate()
      );

      // Calculate the difference in milliseconds and convert to days
      const diffInMs = laterDay.getTime() - earlierDay.getTime();
      return Math.round(diffInMs / (1000 * 60 * 60 * 24));
    },
    /**
     * Helper function to format duration in weeks and days (using British English)
     * @param {number} totalDays - Total number of days
     * @returns {string} Formatted duration
     */
    formatDurationInWeeksAndDays: function (totalDays) {
      if (isNaN(totalDays) || totalDays === null || totalDays < 0)
        return "unknown duration";

      const weeks = Math.floor(totalDays / 7);
      const days = totalDays % 7;

      let result = "";

      if (weeks > 0) {
        result += `${weeks} week${weeks !== 1 ? "s" : ""}`;
      }

      if (days > 0) {
        if (result) result += " and ";
        result += `${days} day${days !== 1 ? "s" : ""}`;
      }

      if (!result) {
        result = "0 days"; // In case of 0 days
      }

      return result;
    },

    /**
     * Convert duration string to days
     * @param {string} duration - Duration string (e.g., "5d", "2w", "12h")
     * @returns {number} Number of days
     */
    durationToDays: function (duration) {
      if (!duration) return 0;
      if (duration === "milestone") return 0;

      const match = duration.match(/(\d+)([dwh])/);
      if (!match) return 0;

      const value = parseInt(match[1], 10);
      const unit = match[2];

      switch (unit) {
        case "d":
          return value;
        case "w":
          return value * 7;
        case "h":
          return Math.ceil(value / 24); // Approximate days from hours
        default:
          return 0;
      }
    },

    /**
     * Format duration string to be more readable
     * @param {string} duration - Duration in format like "5d", "2w", etc.
     * @returns {string} Formatted duration string
     */
    formatDuration: function (duration) {
      if (!duration) return "unknown duration";

      // Match the number and unit
      const match = duration.match(/(\d+)([dwh])/);
      if (!match) return duration;

      const value = parseInt(match[1], 10);
      const unit = match[2];

      // Convert to readable format
      switch (unit) {
        case "d":
          return `${value} day${value !== 1 ? "s" : ""}`;
        case "w":
          return `${value} week${value !== 1 ? "s" : ""}`;
        case "h":
          return `${value} hour${value !== 1 ? "s" : ""}`;
        default:
          return duration;
      }
    },
  };

  // DOM utility functions
  const DOMUtils = {
    /**
     * Create the description container for a diagram
     * @param {HTMLElement} svgElement - The SVG element
     * @param {string} diagramCode - The original mermaid code
     * @param {string|number} diagramId - Unique identifier for the diagram
     * @param {string} detailedDescription - The detailed description HTML
     * @param {string} shortDesc - Short description text
     * @returns {HTMLElement} The created description container
     */
    createDescriptionContainer: function (
      svgElement,
      diagramCode,
      diagramId,
      detailedDescription,
      shortDesc
    ) {
      // Reference to the current object/module for self-reference
      const self = this;
      const container = document.createElement("div");
      container.id = `mermaid-description-${diagramId}`;
      container.className = "mermaid-description";
      if (
        window.MermaidDiagramDetection &&
        window.MermaidDiagramDetection.detectDiagramType(diagramCode) ===
          "flowchart"
      ) {
        container.classList.add("flowchart-description");
      }
      container.setAttribute("aria-live", "polite");
      container.style.display = "none"; // Hidden by default
      // Create the short description section
      const shortDescSection = document.createElement("section");
      shortDescSection.className = "short-description-section";

      // Create the short description heading
      const shortDescHeading = document.createElement("h3");
      shortDescHeading.className = "mermaid-short-description-heading";
      shortDescHeading.textContent = "Short Description";
      shortDescSection.appendChild(shortDescHeading);

      // Create the short description paragraph
      const shortDescElem = document.createElement("p");
      shortDescElem.className = "mermaid-short-description";

      // Safety check to avoid the undefined error
      try {
        // Get diagram type
        let diagramType = "flowchart"; // Default
        if (
          window.MermaidDiagramDetection &&
          typeof window.MermaidDiagramDetection.detectDiagramType === "function"
        ) {
          diagramType =
            window.MermaidDiagramDetection.detectDiagramType(diagramCode);
        }

        // Check if we can get an HTML version of the short description
        if (
          window.MermaidAccessibility &&
          window.MermaidAccessibility.descriptionGenerators &&
          window.MermaidAccessibility.descriptionGenerators[diagramType] &&
          typeof window.MermaidAccessibility.descriptionGenerators[diagramType]
            .generateShortHTML === "function"
        ) {
          // Use the HTML version
          logDebug(
            `[Mermaid Accessibility] Using HTML description for ${diagramType}`
          );
          const shortDescHTML =
            window.MermaidAccessibility.descriptionGenerators[
              diagramType
            ].generateShortHTML(svgElement, diagramCode);

          // Ensure numbers are properly formatted in HTML content
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = shortDescHTML;
          // Apply number formatting to text nodes
          const walker = document.createTreeWalker(
            tempDiv,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );

          while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node.textContent.trim()) {
              // Use the parent object's formatNumbersInText function
              node.textContent =
                window.MermaidAccessibilityUtils.formatNumbersInText(
                  node.textContent
                );
            }
          }

          shortDescElem.innerHTML = tempDiv.innerHTML;
        } else {
          // Fallback to text content with proper number formatting
          logDebug(
            `[Mermaid Accessibility] Using plain text description for ${diagramType}`
          );
          shortDescElem.textContent =
            window.MermaidAccessibilityUtils.formatNumbersInText(shortDesc);
        }
      } catch (error) {
        // Error fallback
        logError(
          "[Mermaid Accessibility] Error accessing description generator:",
          error
        );
        shortDescElem.textContent =
          window.MermaidAccessibilityUtils.formatNumbersInText(shortDesc);
      }

      shortDescSection.appendChild(shortDescElem);
      container.appendChild(shortDescSection);

      // Create the detailed description section
      const detailedDescSection = document.createElement("section");
      detailedDescSection.className = "long-description-section";

      // Add detailed description heading
      const detailsHeading = document.createElement("h3");
      detailsHeading.className = "mermaid-details-heading";
      detailsHeading.textContent = "Detailed Description";
      detailedDescSection.appendChild(detailsHeading);

      // Create the detailed description section that will hold the HTML content
      const detailContentElem = document.createElement("div");
      detailContentElem.className = "mermaid-detailed-description";
      // If detailedDescription looks like HTML, use innerHTML, otherwise use textContent
      if (
        detailedDescription.trim().startsWith("<") &&
        (detailedDescription.includes("<ul>") ||
          detailedDescription.includes("<ol>") ||
          detailedDescription.includes("<p>"))
      ) {
        detailContentElem.innerHTML = detailedDescription;
      } else {
        // For plain text descriptions, wrap in paragraph tags and format numbers
        detailContentElem.innerHTML = `<p>${window.MermaidAccessibilityUtils.formatNumbersInText(
          detailedDescription
        )}</p>`;
      }

      detailedDescSection.appendChild(detailContentElem);

      // Add disclaimer to the end of the detailed description
      const disclaimerSection = document.createElement("section");
      disclaimerSection.className = "mermaid-disclaimer";

      const disclaimerParagraph = document.createElement("p");
      disclaimerParagraph.className = "state-disclaimer";
      disclaimerParagraph.textContent = "Description generated automatically.";

      disclaimerSection.appendChild(disclaimerParagraph);
      detailedDescSection.appendChild(disclaimerSection);

      container.appendChild(detailedDescSection);

      // Add export controls if the export module is available
      if (
        window.MermaidAccessibilityExport &&
        typeof this.createExportControls === "function"
      ) {
        try {
          const exportControls = this.createExportControls(container);
          if (exportControls) {
            container.appendChild(exportControls);
          }
        } catch (error) {
          logError(
            "[Mermaid Accessibility] Error adding export controls:",
            error
          );
        }
      }

      return container;
    },

    /**
     * Create a button to toggle description visibility
     * @param {HTMLElement} container - The diagram container
     * @param {HTMLElement} svgElement - The SVG element
     * @param {string} diagramCode - The original mermaid code
     * @param {string|number} diagramId - Unique identifier for the diagram
     * @param {string} detailedDescription - Detailed description HTML
     * @param {string} shortDescription - Short description text
     * @returns {HTMLElement} The created button
     */
    createDescriptionToggleButton: function (
      container,
      svgElement,
      diagramCode,
      diagramId,
      detailedDescription,
      shortDescription
    ) {
      // Button configuration
      const showText = "Show Description";
      const hideText = "Hide Description";

      const descButton = document.createElement("button");
      descButton.className = "mermaid-control-button";
      descButton.innerHTML = `${window.MermaidAccessibilityUtils.getDescriptionButtonIcon()} ${showText}`;
      descButton.setAttribute("aria-label", "Show diagram description");
      descButton.setAttribute("type", "button");
      descButton.setAttribute("data-diagram-id", diagramId);
      descButton.setAttribute("aria-expanded", "false");
      descButton.setAttribute(
        "aria-controls",
        `mermaid-description-${diagramId}`
      );

      // Create description container (initially hidden)
      const descContainer = this.createDescriptionContainer(
        svgElement,
        diagramCode,
        diagramId,
        detailedDescription,
        shortDescription
      );
      // Find the figure element that wraps the container
      let figureElement = container.parentElement;
      if (figureElement && figureElement.tagName === "FIGURE") {
        // Insert the detailed description after the figure
        figureElement.parentNode.insertBefore(
          descContainer,
          figureElement.nextSibling
        );
      } else {
        // Fallback: insert after container if not wrapped in figure yet
        container.parentNode.insertBefore(descContainer, container.nextSibling);
      }

      // Add event listener for description toggle button
      descButton.addEventListener("click", function () {
        const isExpanded = this.getAttribute("aria-expanded") === "true";
        const newState = !isExpanded;

        // Toggle visibility
        this.setAttribute("aria-expanded", newState.toString());
        descContainer.style.display = newState ? "block" : "none";

        // Update button text
        this.innerHTML = `${window.MermaidAccessibilityUtils.getDescriptionButtonIcon()} ${
          newState ? hideText : showText
        }`;

        // Announce to screen readers
        window.MermaidAccessibilityUtils.announceToScreenReader(
          newState ? "Diagram description shown" : "Diagram description hidden"
        );
      });

      return descButton;
    },

    /**
     * Create a button for export controls
     * @param {string} className - Button class name suffix
     * @param {string} text - Button text
     * @param {string} ariaLabel - Button ARIA label
     * @param {string} icon - Button icon SVG
     * @param {Function} onClick - Click handler
     * @returns {HTMLElement} The button element
     */
    createButton: function (className, text, ariaLabel, icon, onClick) {
      const button = document.createElement("button");
      button.className = `mermaid-export-button ${className}`;
      button.setAttribute("aria-label", ariaLabel);
      button.setAttribute("type", "button");
      button.innerHTML = `${icon}<span>${text}</span>`;

      // Add click handler
      button.addEventListener("click", onClick);

      // Add keyboard support
      button.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      });

      return button;
    },

    /**
     * Create export control buttons for a description container
     * @param {HTMLElement} descContainer - The description container element
     * @returns {HTMLElement} The export controls container
     */
    createExportControls: function (descContainer) {
      // Check if export module is loaded
      if (!window.MermaidAccessibilityExport) {
        logWarn(
          "[Mermaid Accessibility] Export module not loaded, skipping export controls"
        );
        return null;
      }

      // Create export controls container
      const exportControls = document.createElement("div");
      exportControls.className = "mermaid-export-controls";
      exportControls.setAttribute("role", "toolbar");
      exportControls.setAttribute("aria-label", "Description export options");
      // Create copy group
      const copyGroup = document.createElement("div");
      copyGroup.className = "mermaid-export-group";

      // Copy group label
      const copyLabel = document.createElement("div");
      copyLabel.className = "mermaid-export-group-label";
      copyLabel.textContent = "Copy to Clipboard";
      copyGroup.appendChild(copyLabel);

      // Copy buttons container
      const copyButtons = document.createElement("div");
      copyButtons.className = "mermaid-export-buttons";

      // Copy as HTML button
      const copyHtmlButton = this.createButton(
        "copy-html",
        "Copy as HTML",
        "Copy description HTML to clipboard",
        this.getCopyHtmlIcon(),
        () => this.handleCopyHtml(descContainer)
      );
      copyButtons.appendChild(copyHtmlButton);

      // Copy as Formatted Text button
      const copyFormattedButton = this.createButton(
        "copy-formatted",
        "Copy formatted text",
        "Copy formatted description for pasting into Word etc",
        this.getCopyFormattedIcon(),
        () => this.handleCopyFormatted(descContainer)
      );
      copyButtons.appendChild(copyFormattedButton);

      // Copy as Text button
      const copyTextButton = this.createButton(
        "copy-text",
        "Copy plain text",
        "Copy description text to clipboard",
        this.getCopyTextIcon(),
        () => this.handleCopyText(descContainer)
      );
      copyButtons.appendChild(copyTextButton);

      copyGroup.appendChild(copyButtons);
      exportControls.appendChild(copyGroup);

      // Create download group
      const downloadGroup = document.createElement("div");
      downloadGroup.className = "mermaid-export-group";

      // Download group label
      const downloadLabel = document.createElement("div");
      downloadLabel.className = "mermaid-export-group-label";
      downloadLabel.textContent = "Download";
      downloadGroup.appendChild(downloadLabel);

      // Download buttons container
      const downloadButtons = document.createElement("div");
      downloadButtons.className = "mermaid-export-buttons";

      // Download as HTML button
      const downloadHtmlButton = this.createButton(
        "download-html",
        "HTML",
        "Download description as HTML file",
        this.getDownloadHtmlIcon(),
        () => this.handleDownloadHtml(descContainer)
      );
      downloadButtons.appendChild(downloadHtmlButton);

      // Download as Text button
      const downloadTextButton = this.createButton(
        "download-text",
        "Text",
        "Download description as text file",
        this.getDownloadTextIcon(),
        () => this.handleDownloadText(descContainer)
      );
      downloadButtons.appendChild(downloadTextButton);

      // Download as Markdown button
      const downloadMarkdownButton = this.createButton(
        "download-markdown",
        "Markdown",
        "Download description as Markdown file",
        this.getDownloadMarkdownIcon(),
        () => this.handleDownloadMarkdown(descContainer)
      );
      downloadButtons.appendChild(downloadMarkdownButton);

      downloadGroup.appendChild(downloadButtons);
      exportControls.appendChild(downloadGroup);
      // Create feedback tooltip (NEW)
      const feedbackTooltip = document.createElement("div");
      feedbackTooltip.className = "mermaid-export-feedback";
      feedbackTooltip.setAttribute("aria-hidden", "true");
      exportControls.appendChild(feedbackTooltip);

      return exportControls;
    },

    /**
     * Show feedback notification using Universal Notifications (Mermaid version)
     * Replacement for Mermaid tooltip-based feedback system
     * @param {HTMLElement} exportControls - Legacy parameter (no longer used but kept for compatibility)
     * @param {string} message - The message to show
     * @param {boolean} isError - Whether it's an error message
     * @returns {string|null} Notification ID for potential dismissal
     */
    showFeedbackTooltip: function (exportControls, message, isError = false) {
      // Determine notification type based on error status
      const notificationType = isError ? "error" : "success";

      // Configure options for consistent behaviour with original tooltip
      const options = {
        duration: 3000, // Match original 3-second duration
        dismissible: true, // Allow manual dismissal
        persistent: false, // Auto-dismiss after duration
      };

      // Special handling for errors - maintain original auto-hide behaviour
      if (isError) {
        // Override default error behaviour to match original auto-hide
        options.duration = 3000;
      }

      // Show notification using UniversalNotifications
      // This automatically handles:
      // - Screen reader announcements (replacing MermaidAccessibilityUtils call)
      // - Proper ARIA attributes
      // - Accessible styling
      // - Cross-browser compatibility
      const notificationId = UniversalNotifications.show(
        message,
        notificationType,
        options
      );

      // Return notification ID in case caller wants to dismiss it manually
      return notificationId;
    },

    /**
     * Handle copy as HTML button click (UPDATED)
     * @param {HTMLElement} descContainer - The description container
     */
    handleCopyHtml: function (descContainer) {
      const exportControls = descContainer.querySelector(
        ".mermaid-export-controls"
      );
      if (!exportControls) return;

      window.MermaidAccessibilityExport.copyHtmlToClipboard(descContainer)
        .then((success) => {
          if (success) {
            this.showFeedbackTooltip(
              exportControls,
              "HTML copied to clipboard"
            );
          } else {
            this.showFeedbackTooltip(
              exportControls,
              "Failed to copy HTML",
              true
            );
          }
        })
        .catch((error) => {
          logError("[Mermaid Accessibility] Error copying HTML:", error);
          this.showFeedbackTooltip(exportControls, "Failed to copy HTML", true);
        });
    },

    /**
     * Handle copy as text button click (UPDATED)
     * @param {HTMLElement} descContainer - The description container
     */
    handleCopyText: function (descContainer) {
      const exportControls = descContainer.querySelector(
        ".mermaid-export-controls"
      );
      if (!exportControls) return;

      window.MermaidAccessibilityExport.copyTextToClipboard(descContainer)
        .then((success) => {
          if (success) {
            this.showFeedbackTooltip(
              exportControls,
              "Text copied to clipboard"
            );
          } else {
            this.showFeedbackTooltip(
              exportControls,
              "Failed to copy text",
              true
            );
          }
        })
        .catch((error) => {
          logError("[Mermaid Accessibility] Error copying text:", error);
          this.showFeedbackTooltip(exportControls, "Failed to copy text", true);
        });
    },
    /**
     * Handle copy as formatted text button click (UPDATED)
     * @param {HTMLElement} descContainer - The description container
     */
    handleCopyFormatted: function (descContainer) {
      const exportControls = descContainer.querySelector(
        ".mermaid-export-controls"
      );
      if (!exportControls) return;

      window.MermaidAccessibilityExport.copyFormattedTextForWord(descContainer)
        .then((success) => {
          if (success) {
            this.showFeedbackTooltip(
              exportControls,
              "Formatted text copied for Word"
            );
          } else {
            this.showFeedbackTooltip(
              exportControls,
              "Failed to copy formatted text",
              true
            );
          }
        })
        .catch((error) => {
          logError(
            "[Mermaid Accessibility] Error copying formatted text:",
            error
          );
          this.showFeedbackTooltip(
            exportControls,
            "Failed to copy formatted text",
            true
          );
        });
    },

    /**
     * Handle download as HTML button click (UPDATED)
     * @param {HTMLElement} descContainer - The description container
     */
    handleDownloadHtml: function (descContainer) {
      const exportControls = descContainer.querySelector(
        ".mermaid-export-controls"
      );
      if (!exportControls) return;

      try {
        // Extract diagram ID from container ID
        const containerIdMatch = descContainer.id.match(
          /mermaid-description-([\w-]+)/
        );
        const diagramId = containerIdMatch ? containerIdMatch[1] : "diagram";

        window.MermaidAccessibilityExport.downloadAsHtml(
          descContainer,
          `mermaid-description-${diagramId}.html`
        );

        this.showFeedbackTooltip(exportControls, "HTML downloaded");
      } catch (error) {
        logError("[Mermaid Accessibility] Error downloading HTML:", error);
        this.showFeedbackTooltip(
          exportControls,
          "Failed to download HTML",
          true
        );
      }
    },

    /**
     * Handle download as text button click (UPDATED)
     * @param {HTMLElement} descContainer - The description container
     */
    handleDownloadText: function (descContainer) {
      const exportControls = descContainer.querySelector(
        ".mermaid-export-controls"
      );
      if (!exportControls) return;

      try {
        // Extract diagram ID from container ID
        const containerIdMatch = descContainer.id.match(
          /mermaid-description-([\w-]+)/
        );
        const diagramId = containerIdMatch ? containerIdMatch[1] : "diagram";

        window.MermaidAccessibilityExport.downloadAsText(
          descContainer,
          `mermaid-description-${diagramId}.txt`
        );

        this.showFeedbackTooltip(exportControls, "Text downloaded");
      } catch (error) {
        logError("[Mermaid Accessibility] Error downloading text:", error);
        this.showFeedbackTooltip(
          exportControls,
          "Failed to download text",
          true
        );
      }
    },
    /**
     * Handle download as Markdown button click (UPDATED)
     * @param {HTMLElement} descContainer - The description container
     */
    handleDownloadMarkdown: function (descContainer) {
      const exportControls = descContainer.querySelector(
        ".mermaid-export-controls"
      );
      if (!exportControls) return;

      try {
        // Extract diagram ID from container ID
        const containerIdMatch = descContainer.id.match(
          /mermaid-description-([\w-]+)/
        );
        const diagramId = containerIdMatch ? containerIdMatch[1] : "diagram";

        window.MermaidAccessibilityExport.downloadAsMarkdown(
          descContainer,
          `mermaid-description-${diagramId}.md`
        );

        this.showFeedbackTooltip(exportControls, "Markdown downloaded");
      } catch (error) {
        logError("[Mermaid Accessibility] Error downloading Markdown:", error);
        this.showFeedbackTooltip(
          exportControls,
          "Failed to download Markdown",
          true
        );
      }
    },

    /**
     * Get copy HTML icon SVG
     * @returns {string} SVG HTML
     */
    getCopyHtmlIcon: function () {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
      </svg>`;
    },

    /**
     * Get copy text icon SVG
     * @returns {string} SVG HTML
     */
    getCopyTextIcon: function () {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>`;
    },

    /**
     * Get copy formatted text icon SVG
     * @returns {string} SVG HTML
     */
    getCopyFormattedIcon: function () {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"></path>
        <rect x="7" y="7" width="6" height="2"></rect>
        <rect x="7" y="13" width="10" height="2"></rect>
        <rect x="7" y="17" width="8" height="2"></rect>
      </svg>`;
    },
    /**
     * Get download HTML icon SVG
     * @returns {string} SVG HTML
     */
    getDownloadHtmlIcon: function () {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <path d="M4 20h16"></path>
        <path d="M12 4v12"></path>
        <path d="m8 12 4 4 4-4"></path>
      </svg>`;
    },

    /**
     * Get download text icon SVG
     * @returns {string} SVG HTML
     */
    getDownloadTextIcon: function () {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </svg>`;
    },

    /**
     * Get download Markdown icon SVG
     * @returns {string} SVG HTML
     */
    getDownloadMarkdownIcon: function () {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <path d="M21 15V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
        <path d="M3 21h18"></path>
      </svg>`;
    },
  };

  /**
   * Format numbers in text according to ONS style guidelines:
   * - Numbers zero to nine as words (unless technical/precise)
   * - Numbers 10 and over as numerals
   * @param {string} text - The text to format
   * @returns {string} Formatted text with proper number styling
   */
  function formatNumbersInText(text) {
    if (!text) return text;

    // Don't process text with HTML tags
    if (text.includes("<") && text.includes(">")) {
      return text;
    }

    // Store replacements to apply later
    let replacements = [];
    const processedStrings = new Set();

    // Helper to add a replacement if not already processed
    const addReplacement = (match, replacement) => {
      if (!processedStrings.has(match)) {
        replacements.push([match, replacement]);
        processedStrings.add(match);
      }
    };

    // Technical context patterns to preserve (never convert to words)
    const technicalPatterns = [
      // Version numbers
      /WCAG \d+\.\d+/g,
      /Web \d+\.\d+/g,
      /HTML\d+/g,
      /CSS\d+/g,

      // Technical measures
      /\d+px/g,
      /\d+em/g,
      /\d+rem/g,
      /\d+%/g,

      // Dates and times
      /\d+:\d+/g,
      /\d+\/\d+\/\d+/g,
      /\d+-\d+-\d+/g,

      // Decimal numbers
      /\d+\.\d+/g,
    ];

    // Find and mark technical patterns to exclude them from conversion
    const placeholders = {};
    let placeholderIndex = 0;

    // Replace technical patterns with placeholders
    for (const pattern of technicalPatterns) {
      let matches;
      while ((matches = pattern.exec(text)) !== null) {
        const match = matches[0];
        const placeholder = `__TECHNICAL_${placeholderIndex++}__`;
        placeholders[placeholder] = match;
        text = text.replace(match, placeholder);
      }
    }

    // Number words for 0-9
    const numberWords = [
      "zero",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
    ];

    // Convert standalone numbers 0-9 to words (including step references)
    // This regex matches digits with proper context awareness
    const singleDigitPattern =
      /(\s|^|[,.;:"'([{])(step\s+)?(\d)(\s|$|[,.;:"')\]}])/gi;

    let match;
    let workingText = text;
    while ((match = singleDigitPattern.exec(workingText)) !== null) {
      const digit = parseInt(match[3], 10);

      // Only convert 0-9 to words
      if (digit >= 0 && digit <= 9) {
        const prefix = match[1];
        const stepText = match[2] || "";
        const suffix = match[4];

        // Add the replacement
        addReplacement(
          match[0],
          `${prefix}${stepText}${numberWords[digit]}${suffix}`
        );
      }
    }

    // Apply all replacements from longest match to shortest to avoid conflicts
    replacements.sort((a, b) => b[0].length - a[0].length);

    let formattedText = workingText;
    for (const [matchText, replacement] of replacements) {
      formattedText = formattedText.split(matchText).join(replacement);
    }

    // Restore technical placeholders
    for (const [placeholder, original] of Object.entries(placeholders)) {
      formattedText = formattedText.split(placeholder).join(original);
    }

    return formattedText;
  }

  // Log module initialisation
  logInfo("[Mermaid Accessibility] Utils module loaded");

  // Public API
  return {
    // Logging functions
    setLogLevel: setLogLevel,
    logError: logError,
    logWarn: logWarn,
    logInfo: logInfo,
    logDebug: logDebug,

    // Existing utility functions
    getSavedPreference: getSavedPreference,
    savePreference: savePreference,
    announceToScreenReader: announceToScreenReader,
    addDescriptionStyles: addDescriptionStyles,
    getDescriptionButtonIcon: getDescriptionButtonIcon,
    findContainersWithoutFeatures: findContainersWithoutFeatures,
    extractTitleFromSVG: extractTitleFromSVG,
    parseAccessibilityDirectives: parseAccessibilityDirectives,
    formatNumbersInText: formatNumbersInText,
    formatTextNodesInElement: formatTextNodesInElement,
    DateUtils: DateUtils,
    DOMUtils: DOMUtils,
  };
})();
