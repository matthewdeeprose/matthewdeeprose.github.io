/**
 * Mermaid Diagram Controls
 * Adds export buttons to mermaid diagrams rendered by markdown-it
 * - Copy code to clipboard
 * - Export as PNG
 * - Export as SVG
 * - Resize width and height with aspect ratio locking
 */
window.MermaidControls = (function () {
  // ===============================================
  // LOGGING CONFIGURATION
  // ===============================================

  // Logging levels
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  // Default logging level (warnings and errors only)
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.ERROR;

  // Override flags
  const ENABLE_ALL_LOGGING = false; // Set to true to enable all logging regardless of level
  const DISABLE_ALL_LOGGING = false; // Set to true to disable all logging completely

  // Current logging level (can be changed at runtime)
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  // Logging helper functions
  const Logger = {
    /**
     * Check if logging should occur for the given level
     * @param {number} level - The log level to check
     * @returns {boolean} Whether logging should occur
     */
    shouldLog: function (level) {
      if (DISABLE_ALL_LOGGING) return false;
      if (ENABLE_ALL_LOGGING) return true;
      return level <= currentLogLevel;
    },

    /**
     * Set the current logging level
     * @param {number} level - The new logging level
     */
    setLevel: function (level) {
      if (level >= LOG_LEVELS.ERROR && level <= LOG_LEVELS.DEBUG) {
        currentLogLevel = level;
        this.info(
          "Logging level changed to: " + Object.keys(LOG_LEVELS)[level]
        );
      }
    },

    /**
     * Get the current logging level
     * @returns {number} The current logging level
     */
    getLevel: function () {
      return currentLogLevel;
    },

    /**
     * Log an error message
     * @param {string} message - The message to log
     * @param {...*} args - Additional arguments
     */
    error: function (message, ...args) {
      if (this.shouldLog(LOG_LEVELS.ERROR)) {
        console.error(`[Mermaid Controls] ERROR: ${message}`, ...args);
      }
    },

    /**
     * Log a warning message
     * @param {string} message - The message to log
     * @param {...*} args - Additional arguments
     */
    warn: function (message, ...args) {
      if (this.shouldLog(LOG_LEVELS.WARN)) {
        console.warn(`[Mermaid Controls] WARN: ${message}`, ...args);
      }
    },

    /**
     * Log an informational message
     * @param {string} message - The message to log
     * @param {...*} args - Additional arguments
     */
    info: function (message, ...args) {
      if (this.shouldLog(LOG_LEVELS.INFO)) {
        console.log(`[Mermaid Controls] INFO: ${message}`, ...args);
      }
    },

    /**
     * Log a debug message
     * @param {string} message - The message to log
     * @param {...*} args - Additional arguments
     */
    debug: function (message, ...args) {
      if (this.shouldLog(LOG_LEVELS.DEBUG)) {
        console.log(`[Mermaid Controls] DEBUG: ${message}`, ...args);
      }
    },
  };

  // ===============================================
  // ENHANCED NODE COUNTING WITH COMPREHENSIVE SELECTORS
  // ===============================================

  /**
   * Enhanced node counting for different diagram types
   * Based on proven selectors from mermaid-accessibility modules
   * @param {HTMLElement} svgElement - The SVG element to analyze
   * @param {string} type - The diagram type
   * @returns {number} The number of nodes/elements found
   */
  function countDiagramNodes(svgElement, type) {
    if (!svgElement) return 0;

    Logger.debug(`Counting nodes for ${type} diagram`);

    // Comprehensive selector sets for each diagram type
    const selectorSets = {
      sequence: [
        ".actor",
        ".participant",
        ".participant-box",
        ".actor-box",
        'g[class*="actor"]',
        'g[class*="participant"]',
        'rect[class*="actor"]',
        'rect[class*="participant"]',
      ],
      "sequence-auto": [
        ".actor",
        ".participant",
        ".participant-box",
        ".actor-box",
        'g[class*="actor"]',
        'g[class*="participant"]',
        'rect[class*="actor"]',
        'rect[class*="participant"]',
      ],
      gantt: [
        ".task",
        ".taskText",
        ".task-line",
        'g[class*="task"]',
        'rect[class*="task"]',
        '[class*="gantt"] rect',
      ],
      pie: [
        ".slice",
        'path[class*="slice"]',
        ".pieSlice",
        'g[class*="slice"]',
        ".arc",
        'path[class*="arc"]',
      ],
      class: [
        ".classBox",
        ".class",
        'g[class*="class"]',
        ".node .label",
        'rect[class*="class"]',
        ".classLabel",
      ],
      er: [
        ".entity",
        ".entityBox",
        'g[class*="entity"]',
        ".er-entity",
        'rect[class*="entity"]',
        ".entityLabel",
      ],
      state: [
        ".state",
        ".stateBox",
        'g[class*="state"]',
        ".statediagram-state",
        'rect[class*="state"]',
        ".stateLabel",
      ],
      graph: [
        ".node",
        "g.node",
        'g[class*="node"]',
        ".nodeLabel",
        'rect[class*="node"]',
        'circle[class*="node"]',
        'g[id*="flowchart"]',
        'g[id*="node"]',
        ".flowchart-node",
        ".graph-node",
      ],
      flowchart: [
        ".node",
        "g.node",
        'g[class*="node"]',
        ".nodeLabel",
        'rect[class*="node"]',
        'circle[class*="node"]',
        'g[id*="flowchart"]',
        'g[id*="node"]',
        ".flowchart-node",
        ".graph-node",
      ],
      "flowchart-auto": [
        ".node",
        "g.node",
        'g[class*="node"]',
        ".nodeLabel",
        'rect[class*="node"]',
        'circle[class*="node"]',
        'g[id*="flowchart"]',
        'g[id*="node"]',
        ".flowchart-node",
        ".graph-node",
      ],
      mindmap: [
        ".mindmap-node",
        ".mm-node",
        'g[class*="mindmap"]',
        'circle[class*="node"]',
        ".node-circle",
      ],
      timeline: [
        ".timeline-node",
        ".timeline-event",
        'g[class*="timeline"]',
        ".event",
        'rect[class*="event"]',
      ],
      gitgraph: [
        ".commit",
        ".git-commit",
        'circle[class*="commit"]',
        'g[class*="commit"]',
        ".branch",
      ],
      journey: [
        ".journey-section",
        ".journey-task",
        'g[class*="journey"]',
        ".section",
        'rect[class*="section"]',
      ],
      requirement: [
        ".requirement",
        ".req",
        'g[class*="requirement"]',
        'rect[class*="req"]',
        ".requirement-box",
      ],
      quadrant: [
        ".quadrant-point",
        ".quad-point",
        'circle[class*="point"]',
        'g[class*="quadrant"]',
        ".point",
      ],
      xychart: [
        ".chart-point",
        ".data-point",
        'circle[class*="point"]',
        'rect[class*="bar"]',
        ".chart-bar",
      ],
    };

    // Get selectors for this diagram type, with fallback to flowchart selectors
    const selectors = selectorSets[type] || selectorSets["flowchart"];

    let maxCount = 0;
    let usedSelector = "none";

    // Try each selector and use the one that finds the most elements
    for (const selector of selectors) {
      try {
        const elements = svgElement.querySelectorAll(selector);
        const count = elements.length;

        if (count > maxCount) {
          maxCount = count;
          usedSelector = selector;
        }

        // Log each attempt for debugging
        if (count > 0) {
          Logger.debug(`Selector "${selector}" found ${count} elements`);
        }
      } catch (e) {
        // Ignore invalid selectors
        Logger.debug(`Invalid selector: ${selector}`);
      }
    }

    // If still no nodes found, try some very generic selectors
    if (maxCount === 0) {
      const genericSelectors = [
        "g[id]", // Any group with an ID (very common in Mermaid)
        "rect[class]", // Any rectangle with a class
        "circle[class]", // Any circle with a class
        "text[class]", // Any text with a class
        "path[class]", // Any path with a class
      ];

      for (const selector of genericSelectors) {
        try {
          const count = svgElement.querySelectorAll(selector).length;
          if (count > maxCount && count < 50) {
            // Reasonable upper limit to avoid text/styling elements
            maxCount = count;
            usedSelector = `${selector} (generic)`;
          }
        } catch (e) {
          // Ignore errors
        }
      }
    }

    Logger.debug(
      `Final count for ${type}: ${maxCount} using selector "${usedSelector}"`
    );
    return maxCount;
  }

  // ===============================================
  // SVG STRUCTURE DEBUGGING FUNCTION
  // ===============================================

  /**
   * Get the main mermaid diagram SVG (not button icons or other SVGs)
   * @param {HTMLElement} container - The mermaid container
   * @returns {HTMLElement|null} The main diagram SVG element
   */
  function getMainDiagramSVG(container) {
    if (!container) return null;

    // Method 1: Look for SVG inside .mermaid div (most reliable)
    const mermaidDiv = container.querySelector(".mermaid");
    if (mermaidDiv) {
      const svgInMermaidDiv = mermaidDiv.querySelector("svg");
      if (svgInMermaidDiv) {
        return svgInMermaidDiv;
      }
    }

    // Method 2: Look for SVG with mermaid-specific attributes
    const mermaidSvgs = container.querySelectorAll(
      'svg[aria-roledescription*="flowchart"], svg[class*="flowchart"], svg[id*="mermaid-diagram"]'
    );
    if (mermaidSvgs.length > 0) {
      return mermaidSvgs[0]; // Return the first one found
    }

    // Method 3: Look for SVG that's not inside control buttons
    const allSvgs = container.querySelectorAll("svg");
    for (const svg of allSvgs) {
      // Skip SVGs that are inside control buttons
      if (
        svg.closest(".mermaid-control-button") ||
        svg.closest(".mermaid-view-button") ||
        svg.closest("button")
      ) {
        continue;
      }

      // Check if this SVG has substantial content (likely the diagram)
      const totalElements = svg.querySelectorAll("*").length;
      if (totalElements > 20) {
        // Button icons typically have < 10 elements
        return svg;
      }
    }

    return null;
  }

  /**
   * Debug SVG structure to understand what elements are available
   * @param {HTMLElement} svgElement - The SVG element to analyze
   * @returns {Object} Detailed breakdown of SVG contents
   */
  function debugSVGStructure(svgElement) {
    if (!svgElement) return { error: "No SVG element provided" };

    const analysis = {
      totalElements: svgElement.querySelectorAll("*").length,
      groups: svgElement.querySelectorAll("g").length,
      rects: svgElement.querySelectorAll("rect").length,
      circles: svgElement.querySelectorAll("circle").length,
      paths: svgElement.querySelectorAll("path").length,
      texts: svgElement.querySelectorAll("text").length,

      // Sample class names (first 10)
      classNames: [],

      // Sample IDs (first 10)
      ids: [],

      // Specific mermaid selectors
      mermaidSelectors: {},
    };

    // Collect class names
    const elementsWithClasses = svgElement.querySelectorAll("[class]");
    const classSet = new Set();
    elementsWithClasses.forEach((el) => {
      el.className.baseVal?.split(" ").forEach((cls) => {
        if (cls.trim()) classSet.add(cls.trim());
      });
    });
    analysis.classNames = Array.from(classSet).slice(0, 15);

    // Collect IDs
    const elementsWithIds = svgElement.querySelectorAll("[id]");
    elementsWithIds.forEach((el) => {
      if (el.id && analysis.ids.length < 15) {
        analysis.ids.push(el.id);
      }
    });

    // Test specific mermaid selectors
    const testSelectors = [
      ".node",
      "g.node",
      ".nodeLabel",
      ".actor",
      ".participant",
      ".task",
      ".slice",
      ".entity",
      ".state",
      'g[id*="flowchart"]',
      'g[id*="node"]',
      'g[class*="node"]',
      'rect[class*="node"]',
    ];

    testSelectors.forEach((selector) => {
      try {
        const count = svgElement.querySelectorAll(selector).length;
        if (count > 0) {
          analysis.mermaidSelectors[selector] = count;
        }
      } catch (e) {
        // Ignore invalid selectors
      }
    });

    return analysis;
  }

  // ===============================================
  // MAIN CONFIGURATION
  // ===============================================

  // Configuration
  const config = {
    buttonClasses: "mermaid-control-button",
    copyText: "Copy Code",
    successText: "Copied",
    failText: "Failed to copy",
    svgText: "Save as SVG",
    pngText: "Save as PNG",
    successDuration: 2000, // Time in ms to show success message
    ariaLiveRegionId: "sr-announcer",
    controlsContainerClass: "mermaid-controls",
    defaultWidth: 70, // Default width percentage (70%)
    defaultHeight: 100, // Default height percentage (100%)
    minWidth: 30, // Minimum width percentage
    maxWidth: 100, // Maximum width percentage
    minHeight: 50, // Minimum height percentage
    maxHeight: 300, // Maximum height percentage
    // Add these new properties
    lockAspectRatioDefault: false, // Default for aspect ratio locking
    aspectRatioLockText: "Lock aspect ratio", // Text for aspect ratio checkbox
    resetSizeText: "Reset size", // Text for reset size button
    // Orientation control properties
    orientationLabelText: "Orientation:", // Text for orientation label
    orientationOptions: [
      { value: "TB", text: "Top to Bottom" },
      { value: "BT", text: "Bottom to Top" },
      { value: "LR", text: "Left to Right" },
      { value: "RL", text: "Right to Left" },
    ],
    defaultOrientation: "TB", // Default orientation
    // Auto-fit button properties
    autoFitButtonText: "Auto-fit", // Text for auto-fit button
    autoFitButtonClass: "mermaid-auto-fit-button", // Class for auto-fit button
    autoFitOnLoadDefault: false, // Default for auto-fit on load preference
    // Control order configuration - edit these numbers to change the order (lower numbers appear first)
    // To change the order of controls, simply change the numbers below.
    // For example, to make the reset button appear first, change its value to 1 and adjust others accordingly.
    // You can also use negative numbers or decimal numbers (like 1.5) for more fine-grained control.
    //
    // The "row" property determines which row the control appears in (1 for first row, 2 for second row, etc.)
    // Controls with the same row number will appear on the same line, ordered by their "order" value.
    // Update the configuration section to include all control types
    // Replace the existing controlOrder with this expanded version:

    controlOrder: {
      // Row 1
      orientation: { order: 1, row: 1, visible: true },
      widthSlider: { order: 2, row: 1, visible: false },
      aspectRatio: { order: 4, row: 1, visible: false },
      fitOptions: { order: 5, row: 1, visible: false },

      // Row 2
      presetSizes: { order: 1, row: 2, visible: false },
      zoomControls: { order: 1, row: 2, visible: false },
      resetButton: { order: 2, row: 2, visible: false },
      autoFitButton: { order: 3, row: 2, visible: false },
      autoFitOnLoad: { order: 4, row: 2, visible: false },

      // Row 3 (former advanced controls)
      fitOptions: { order: 1, row: 3, visible: false },

      // Row 4 (more former advanced controls)
      contentAwareButton: { order: 1, row: 4, visible: false },
      responsiveButton: { order: 2, row: 4, visible: false },
      responsiveMode: { order: 3, row: 4, visible: false },

      // Row 5 (more former advanced controls)
      paddingControl: { order: 1, row: 5, visible: false },
      scaleToContainer: { order: 2, row: 5, visible: false },
      autoCrop: { order: 3, row: 5, visible: false },
      heightSlider: { order: 4, row: 5, visible: false },
    },
  };

  /**
   * Generate or retrieve a unique identifier for a diagram container
   * @param {HTMLElement} container - The mermaid container
   * @param {number|string} fallbackIndex - Fallback index if no ID exists
   * @returns {string} Unique identifier for logging
   */
  function getDiagramIdentifier(container, fallbackIndex = "unknown") {
    if (!container) return `diagram-${fallbackIndex}`;

    // Try to get existing ID
    if (container.id) {
      return container.id;
    }

    // Try to get data-diagram-id
    if (container.dataset.diagramId) {
      return container.dataset.diagramId;
    }

    // Try to get from data-diagram-code (first few chars for identification)
    const diagramCode = container.getAttribute("data-diagram-code");
    if (diagramCode) {
      const decoded = decodeURIComponent(diagramCode);
      const firstLine = decoded.split("\n")[0].trim();
      if (firstLine) {
        // Create a readable identifier from the first line
        const identifier = firstLine
          .replace(/[^a-zA-Z0-9]/g, "-")
          .substring(0, 20);
        return `diagram-${identifier}-${fallbackIndex}`;
      }
    }

    // Try to find diagram type from mermaid div content
    const mermaidDiv = container.querySelector(".mermaid");
    if (mermaidDiv) {
      const content = mermaidDiv.textContent.trim();
      const firstWord = content.split(/\s+/)[0];
      if (
        firstWord &&
        [
          "graph",
          "flowchart",
          "sequenceDiagram",
          "classDiagram",
          "gantt",
          "pie",
          "gitgraph",
        ].includes(firstWord)
      ) {
        return `${firstWord}-${fallbackIndex}`;
      }
    }

    // Generate unique ID and store it
    const uniqueId = `diagram-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}`;
    container.dataset.diagramId = uniqueId;

    return uniqueId;
  }

  /**
   * Get diagram summary for logging
   * @param {HTMLElement} container - The mermaid container
   * @returns {object} Diagram summary information
   */
  function getDiagramSummary(container) {
    if (!container) return { type: "unknown", nodes: 0, hasControls: false };

    const mermaidDiv = container.querySelector(".mermaid");
    const hasControls = !!container.querySelector(
      "." + config.controlsContainerClass
    );
    const svgElement = getMainDiagramSVG(container);

    let type = "unknown";
    let nodes = 0;

    // Try multiple sources for diagram content
    let diagramContent = null;

    // 1. First try data-diagram-code attribute (most reliable)
    const dataCode = container.getAttribute("data-diagram-code");
    if (dataCode) {
      try {
        diagramContent = decodeURIComponent(dataCode);
      } catch (e) {
        Logger.debug("Failed to decode data-diagram-code:", e);
      }
    }

    // 2. If no data attribute, try mermaid div content
    if (!diagramContent && mermaidDiv) {
      // Check if mermaidDiv has original text content
      diagramContent = mermaidDiv.textContent.trim();

      // If the div only contains SVG (rendered content), try to get original from title or data attributes
      if (!diagramContent || diagramContent.length < 10) {
        const titleAttr = mermaidDiv.getAttribute("title");
        if (titleAttr) {
          diagramContent = titleAttr;
        }
      }
    }

    // Extract diagram type from content
    if (diagramContent && diagramContent.length > 0) {
      const lines = diagramContent.split("\n");
      let firstMeaningfulLine = "";

      // Find the first non-empty, non-comment line
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("%%") && !trimmed.startsWith("#")) {
          firstMeaningfulLine = trimmed;
          break;
        }
      }

      Logger.debug(
        `Analyzing diagram content. First line: "${firstMeaningfulLine}"`
      );

      // Enhanced diagram type detection
      if (firstMeaningfulLine) {
        const lowerLine = firstMeaningfulLine.toLowerCase();

        // Direct matches
        if (lowerLine.startsWith("graph ") || lowerLine.startsWith("graph\t")) {
          type = "graph";
        } else if (
          lowerLine.startsWith("flowchart ") ||
          lowerLine.startsWith("flowchart\t")
        ) {
          type = "flowchart";
        } else if (
          lowerLine.startsWith("sequencediagram") ||
          lowerLine === "sequencediagram"
        ) {
          type = "sequence";
        } else if (
          lowerLine.startsWith("classdiagram") ||
          lowerLine === "classdiagram"
        ) {
          type = "class";
        } else if (lowerLine.startsWith("gantt") || lowerLine === "gantt") {
          type = "gantt";
        } else if (lowerLine.startsWith("pie ") || lowerLine === "pie") {
          type = "pie";
        } else if (
          lowerLine.startsWith("gitgraph") ||
          lowerLine === "gitgraph"
        ) {
          type = "gitgraph";
        } else if (
          lowerLine.startsWith("erdiagram") ||
          lowerLine === "erdiagram"
        ) {
          type = "er";
        } else if (lowerLine.startsWith("journey") || lowerLine === "journey") {
          type = "journey";
        } else if (
          lowerLine.startsWith("statediagram") ||
          lowerLine.startsWith("statediagram-v2")
        ) {
          type = "state";
        } else if (lowerLine.startsWith("requirement")) {
          type = "requirement";
        } else if (lowerLine.startsWith("mindmap")) {
          type = "mindmap";
        } else if (lowerLine.startsWith("timeline")) {
          type = "timeline";
        } else if (lowerLine.startsWith("quadrantchart")) {
          type = "quadrant";
        } else if (lowerLine.startsWith("xychart")) {
          type = "xychart";
        } else if (lowerLine.includes("-->") || lowerLine.includes("---")) {
          // Likely a flowchart without explicit declaration
          type = "flowchart-auto";
        } else if (
          lowerLine.includes("participant") ||
          lowerLine.includes("actor")
        ) {
          // Likely a sequence diagram without explicit declaration
          type = "sequence-auto";
        }
      }
    }

    // Enhanced node counting for different diagram types
    if (svgElement) {
      try {
        // Log SVG info for debugging
        const totalElements = svgElement.querySelectorAll("*").length;
        Logger.debug(
          `Found SVG with ${totalElements} elements for ${type} diagram`
        );

        // Use the specific selectors we know work for flowcharts
        if (
          type === "flowchart" ||
          type === "flowchart-auto" ||
          type === "graph"
        ) {
          const nodeSelectors = [".node", "g.node", ".nodeLabel"];
          let maxCount = 0;
          let usedSelector = "none";

          for (const selector of nodeSelectors) {
            try {
              const count = svgElement.querySelectorAll(selector).length;
              if (count > maxCount) {
                maxCount = count;
                usedSelector = selector;
              }
              Logger.debug(`Selector "${selector}": ${count} elements`);
            } catch (e) {
              Logger.debug(`Invalid selector: ${selector}`);
            }
          }

          nodes = maxCount;
          Logger.debug(
            `Final node count for ${type}: ${nodes} using "${usedSelector}"`
          );
        } else {
          // For other diagram types, use the enhanced counting function
          nodes = countDiagramNodes(svgElement, type);
        }
      } catch (error) {
        Logger.debug("Error in enhanced node counting:", error);
        nodes = 0;
      }
    }

    return { type, nodes, hasControls };
  }

  // Utility functions
  const Utils = {
    /**
     * Safely get a value from localStorage with fallback
     * @param {string} key - The localStorage key
     * @param {*} defaultValue - Default value if key doesn't exist or localStorage is unavailable
     * @returns {*} The value or defaultValue
     */
    getSavedPreference: function (key, defaultValue) {
      try {
        const value = localStorage.getItem(key);
        return value !== null ? value : defaultValue;
      } catch (e) {
        Logger.warn(`LocalStorage error: ${e.message}`);
        return defaultValue;
      }
    },

    /**
     * Safely save a value to localStorage
     * @param {string} key - The localStorage key
     * @param {*} value - Value to store
     * @returns {boolean} Success status
     */
    savePreference: function (key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (e) {
        Logger.warn(`LocalStorage error: ${e.message}`);
        return false;
      }
    },

    /**
     * Find mermaid containers without controls
     * @param {HTMLElement} rootNode - Node to search within
     * @returns {Array} Array of containers without controls
     */
    findContainersWithoutControls: function (rootNode) {
      const allContainers = rootNode.querySelectorAll(".mermaid-container");
      return Array.from(allContainers).filter(
        (container) =>
          !container.querySelector("." + config.controlsContainerClass)
      );
    },

    /**
     * Calculate aspect ratio of an element
     * @param {HTMLElement} element - Element to calculate ratio for
     * @returns {number} Width/height ratio
     */
    calculateAspectRatio: function (element) {
      if (!element) return 1;
      const rect = element.getBoundingClientRect();
      return rect.width / rect.height;
    },
  };

  /**
   * Enhanced logging for diagram operations
   */
  const DiagramLogger = {
    /**
     * Log diagram initialisation
     * @param {HTMLElement} container - The diagram container
     * @param {string} operation - The operation being performed
     */
    logDiagramOperation: function (container, operation) {
      const id = getDiagramIdentifier(container);
      const summary = getDiagramSummary(container);

      Logger.info(
        `${operation} - ${id} (${summary.type}, ${summary.nodes} nodes, controls: ${summary.hasControls})`
      );
    },

    /**
     * Log diagram detection with throttling to prevent spam
     * @param {HTMLElement[]} containers - Array of containers found
     * @param {string} context - Context of detection
     */
    logDiagramDetection: function (containers, context = "") {
      if (!containers || containers.length === 0) return;

      // Throttle detection logging per context
      const throttleKey = `detection-${context}`;
      const now = Date.now();

      if (!this._detectionThrottle) this._detectionThrottle = {};

      // Only log if it's been more than 1 second since last log for this context
      if (
        this._detectionThrottle[throttleKey] &&
        now - this._detectionThrottle[throttleKey] < 1000
      ) {
        return;
      }

      this._detectionThrottle[throttleKey] = now;

      // Create summary of detected diagrams
      const summaries = containers.map((container) => {
        const id = getDiagramIdentifier(container);
        const summary = getDiagramSummary(container);
        return `${id} (${summary.type})`;
      });

      const contextStr = context ? ` [${context}]` : "";
      Logger.info(
        `Detected ${
          containers.length
        } diagram(s)${contextStr}: ${summaries.join(", ")}`
      );
    },

    /**
     * Log control creation with specific details
     * @param {HTMLElement} container - The diagram container
     * @param {string} controlType - Type of control being created
     */
    logControlCreation: function (container, controlType = "standard") {
      const id = getDiagramIdentifier(container);
      const summary = getDiagramSummary(container);

      Logger.debug(
        `Creating ${controlType} controls for ${id} (${summary.type}, ${summary.nodes} nodes)`
      );
    },

    /**
     * Log diagram size changes
     * @param {HTMLElement} container - The diagram container
     * @param {object} sizeInfo - Size information
     */
    logSizeChange: function (container, sizeInfo) {
      const id = getDiagramIdentifier(container);

      // Throttle size change logging per diagram
      const throttleKey = `size-${id}`;
      const now = Date.now();

      if (!this._sizeThrottle) this._sizeThrottle = {};

      // Only log size changes every 500ms per diagram
      if (
        this._sizeThrottle[throttleKey] &&
        now - this._sizeThrottle[throttleKey] < 500
      ) {
        return;
      }

      this._sizeThrottle[throttleKey] = now;

      Logger.debug(`Size change for ${id}: ${JSON.stringify(sizeInfo)}`);
    },
  };

  /**
   * Initialize controls on all Mermaid diagrams
   * @param {HTMLElement} container - Container element (defaults to document)
   */
  function init(container = document) {
    if (!container) {
      Logger.warn("No container provided");
      return;
    }

    // Find all Mermaid diagrams
    const mermaidContainers = container.querySelectorAll(".mermaid-container");
    if (mermaidContainers.length === 0) return;

    Logger.info(`Adding controls to ${mermaidContainers.length} diagrams`);

    // Add controls to each diagram
    mermaidContainers.forEach((container, index) => {
      addControlsToContainer(container, index);
    });
  }

  /**
   * Add control buttons to a Mermaid container
   * @param {HTMLElement} container - The Mermaid container element
   * @param {number} index - Index for unique IDs
   */
  function addControlsToContainer(container, index) {
    // Skip if already processed
    if (container.querySelector(`.${config.controlsContainerClass}`)) {
      Logger.debug(
        `Skipping ${getDiagramIdentifier(container)} - controls already exist`
      );
      return;
    }

    // Log control creation
    DiagramLogger.logControlCreation(container);

    // Find the Mermaid div inside the container
    const mermaidDiv = container.querySelector(".mermaid");
    if (!mermaidDiv) {
      Logger.warn(
        `No mermaid div found in container ${getDiagramIdentifier(container)}`
      );
      return;
    }

    // Get the Mermaid code (original source)
    const originalCode =
      decodeURIComponent(container.getAttribute("data-diagram-code") || "") ||
      mermaidDiv.textContent.trim();

    // Find the rendered SVG
    const svgElement = container.querySelector("svg");
    if (!svgElement) {
      Logger.debug(
        `SVG not rendered yet for ${getDiagramIdentifier(
          container
        )}, waiting...`
      );

      // If SVG isn't rendered yet, wait for it
      const observer = new MutationObserver((mutations, obs) => {
        const svg = container.querySelector("svg");
        if (svg) {
          obs.disconnect();
          Logger.debug(
            `SVG rendered for ${getDiagramIdentifier(
              container
            )}, creating controls`
          );
          createControlButtons(container, originalCode, index);
        }
      });

      observer.observe(container, { childList: true, subtree: true });
      return;
    }

    createControlButtons(container, originalCode, index);
  }

  /**
   * Create control buttons for a Mermaid diagram
   * @param {HTMLElement} container - The Mermaid container element
   * @param {string} code - The original Mermaid code
   * @param {number} index - Index for unique IDs
   */
  function createControlButtons(container, code, index) {
    Logger.debug(`Creating control buttons for diagram ${index}`);

    // Create controls container
    const controlsContainer = document.createElement("div");
    controlsContainer.className = config.controlsContainerClass;
    controlsContainer.setAttribute("role", "toolbar");
    controlsContainer.setAttribute("aria-label", "Diagram export options");

    // Create sliders container for organised rows
    const slidersContainer = document.createElement("div");
    slidersContainer.className = "sliders-container";

    // ==============================================
    // 1. CREATE ALL CONTROL ELEMENTS
    // ==============================================

    // ----- Width slider group -----
    const widthSliderGroup = document.createElement("div");
    widthSliderGroup.className = "mermaid-width-slider-group";
    const widthSliderLabel = document.createElement("label");
    widthSliderLabel.textContent = "Width:";
    widthSliderLabel.className = "mermaid-slider-label";
    widthSliderLabel.setAttribute("for", `mermaid-width-slider-${index}`);
    const widthSlider = document.createElement("input");
    widthSlider.type = "range";
    widthSlider.id = `mermaid-width-slider-${index}`;
    widthSlider.className = "mermaid-size-slider";
    widthSlider.min = config.minWidth;
    widthSlider.max = config.maxWidth;
    const savedWidth = Utils.getSavedPreference(
      "mermaid-diagram-width",
      config.defaultWidth
    );
    widthSlider.value = savedWidth;
    widthSliderGroup.appendChild(widthSliderLabel);
    widthSliderGroup.appendChild(widthSlider);

    // ----- Height slider group -----
    const heightSliderGroup = document.createElement("div");
    heightSliderGroup.className = "mermaid-height-slider-group";
    const heightSliderLabel = document.createElement("label");
    heightSliderLabel.textContent = "Height:";
    heightSliderLabel.className = "mermaid-slider-label";
    heightSliderLabel.setAttribute("for", `mermaid-height-slider-${index}`);
    const heightSlider = document.createElement("input");
    heightSlider.type = "range";
    heightSlider.id = `mermaid-height-slider-${index}`;
    heightSlider.className = "mermaid-size-slider";
    heightSlider.min = config.minHeight;
    heightSlider.max = config.maxHeight;
    const savedHeight = Utils.getSavedPreference(
      "mermaid-diagram-height",
      config.defaultHeight
    );
    heightSlider.value = savedHeight;
    heightSliderGroup.appendChild(heightSliderLabel);
    heightSliderGroup.appendChild(heightSlider);

    // ----- Aspect ratio lock -----
    const aspectRatioContainer = document.createElement("div");
    aspectRatioContainer.className = "aspect-ratio-container";
    const aspectRatioCheckbox = document.createElement("input");
    aspectRatioCheckbox.type = "checkbox";
    aspectRatioCheckbox.id = `aspect-ratio-lock-${index}`;
    aspectRatioCheckbox.className = "aspect-ratio-checkbox";
    const lockAspectRatio = Utils.getSavedPreference(
      "mermaid-lock-aspect-ratio",
      config.lockAspectRatioDefault
    );
    aspectRatioCheckbox.checked =
      lockAspectRatio === "true" || lockAspectRatio === true;
    const aspectRatioLabel = document.createElement("label");
    aspectRatioLabel.htmlFor = `aspect-ratio-lock-${index}`;
    aspectRatioLabel.className = "aspect-ratio-label";
    aspectRatioLabel.textContent = config.aspectRatioLockText;
    aspectRatioContainer.appendChild(aspectRatioCheckbox);
    aspectRatioContainer.appendChild(aspectRatioLabel);

    // ----- Orientation control group -----
    const orientationGroup = document.createElement("div");
    orientationGroup.className = "mermaid-orientation-group";
    const orientationLabel = document.createElement("label");
    orientationLabel.textContent = config.orientationLabelText;
    orientationLabel.className = "mermaid-orientation-label";
    orientationLabel.setAttribute("for", `mermaid-orientation-${index}`);
    const orientationSelect = document.createElement("select");
    orientationSelect.id = `mermaid-orientation-${index}`;
    orientationSelect.className = "mermaid-orientation-select";
    orientationSelect.setAttribute("aria-label", "Change diagram orientation");
    config.orientationOptions.forEach((orientation) => {
      const option = document.createElement("option");
      option.value = orientation.value;
      option.textContent = orientation.text;
      orientationSelect.appendChild(option);
    });

    // Check if the diagram supports orientation changes
    const supportsOrientationChanges = supportsOrientation(code);

    // Set the current orientation
    const currentOrientation = detectOrientation(code);
    orientationSelect.value = currentOrientation || config.defaultOrientation;

    // Option 1: Hide the orientation controls if not supported
    // Uncomment this line to completely hide orientation controls for unsupported diagrams
    if (!supportsOrientationChanges) {
      orientationGroup.style.display = "none";
    }

    // Option 2: Disable the orientation controls if not supported
    // Uncomment this line to keep orientation controls visible but disabled
    // if (!supportsOrientationChanges) {
    //   orientationSelect.disabled = true;
    //   orientationSelect.title = "This diagram type doesn't support orientation changes";
    // }

    orientationGroup.appendChild(orientationLabel);
    orientationGroup.appendChild(orientationSelect);
    // ----- Reset button -----
    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = config.buttonClasses;
    resetButton.setAttribute("aria-label", "Reset diagram to default size");
    resetButton.textContent = config.resetSizeText;

    // ----- Auto-fit button -----
    const autoFitButton = document.createElement("button");
    autoFitButton.className =
      config.buttonClasses + " " + config.autoFitButtonClass;
    autoFitButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
  <path d="M9 3v18"></path>
  <path d="M15 3v18"></path>
  <path d="M3 9h18"></path>
  <path d="M3 15h18"></path>
</svg> ${config.autoFitButtonText}`;
    autoFitButton.setAttribute("aria-label", "Auto-fit diagram to content");
    autoFitButton.setAttribute("type", "button");

    // ----- Auto-fit on load checkbox -----
    const autoFitOnLoadLabel = document.createElement("label");
    autoFitOnLoadLabel.className = "mermaid-auto-fit-on-load-label";
    autoFitOnLoadLabel.setAttribute("for", `mermaid-auto-fit-on-load-${index}`);
    const autoFitOnLoadCheckbox = document.createElement("input");
    autoFitOnLoadCheckbox.type = "checkbox";
    autoFitOnLoadCheckbox.id = `mermaid-auto-fit-on-load-${index}`;
    autoFitOnLoadCheckbox.className = "mermaid-auto-fit-on-load-checkbox";
    const savedAutoFitOnLoad = Utils.getSavedPreference(
      "mermaid-auto-fit-on-load",
      config.autoFitOnLoadDefault
    );
    autoFitOnLoadCheckbox.checked =
      savedAutoFitOnLoad === "true" || savedAutoFitOnLoad === true;
    autoFitOnLoadLabel.appendChild(autoFitOnLoadCheckbox);
    autoFitOnLoadLabel.appendChild(
      document.createTextNode(" Auto-fit on load")
    );

    // ----- Zoom controls group -----
    const zoomControlsGroup = document.createElement("div");
    zoomControlsGroup.className = "mermaid-zoom-controls-group";
    // Create zoom out button
    const zoomOutButton = document.createElement("button");
    zoomOutButton.className = config.buttonClasses;
    zoomOutButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <circle cx="11" cy="11" r="8"></circle>
  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  <line x1="8" y1="11" x2="14" y2="11"></line>
</svg>`;
    zoomOutButton.setAttribute("aria-label", "Zoom out");
    zoomOutButton.setAttribute("type", "button");
    zoomOutButton.setAttribute("title", "Zoom out (decrease size by 10%)");
    // Create zoom in button
    const zoomInButton = document.createElement("button");
    zoomInButton.className = config.buttonClasses;
    zoomInButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <circle cx="11" cy="11" r="8"></circle>
  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  <line x1="11" y1="8" x2="11" y2="14"></line>
  <line x1="8" y1="11" x2="14" y2="11"></line>
</svg>`;
    zoomInButton.setAttribute("aria-label", "Zoom in");
    zoomInButton.setAttribute("type", "button");
    zoomInButton.setAttribute("title", "Zoom in (increase size by 10%)");
    // Add zoom buttons to group
    zoomControlsGroup.appendChild(zoomOutButton);
    zoomControlsGroup.appendChild(zoomInButton);
    // ----- Fit options group -----
    const fitOptionsGroup = document.createElement("div");
    fitOptionsGroup.className = "mermaid-fit-options-group";
    // Create fit to width button
    const fitWidthButton = document.createElement("button");
    fitWidthButton.className = config.buttonClasses;
    fitWidthButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <polyline points="7 8 3 12 7 16"></polyline>
  <polyline points="17 8 21 12 17 16"></polyline>
  <line x1="3" y1="12" x2="21" y2="12"></line>
</svg> Width`;
    fitWidthButton.setAttribute("aria-label", "Fit to width");
    fitWidthButton.setAttribute("type", "button");
    fitWidthButton.setAttribute("title", "Fit diagram to container width");
    // Create fit to height button
    const fitHeightButton = document.createElement("button");
    fitHeightButton.className = config.buttonClasses;
    fitHeightButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <polyline points="8 7 12 3 16 7"></polyline>
  <polyline points="8 17 12 21 16 17"></polyline>
  <line x1="12" y1="3" x2="12" y2="21"></line>
</svg> Height`;
    fitHeightButton.setAttribute("aria-label", "Fit to height");
    fitHeightButton.setAttribute("type", "button");
    fitHeightButton.setAttribute("title", "Fit diagram to container height");
    // Add fit buttons to group
    fitOptionsGroup.appendChild(fitWidthButton);
    fitOptionsGroup.appendChild(fitHeightButton);

    // ----- Preset sizes group -----
    const presetSizesGroup = document.createElement("div");
    presetSizesGroup.className = "mermaid-preset-sizes-group";
    // Create preset size buttons
    const presetSizes = [
      { name: "Small", width: 50, height: 70, label: "Small size" },
      { name: "Medium", width: 70, height: 100, label: "Medium size" },
      { name: "Large", width: 90, height: 130, label: "Large size" },
    ];
    presetSizes.forEach((preset) => {
      const presetButton = document.createElement("button");
      presetButton.className = config.buttonClasses;
      presetButton.textContent = preset.name;
      presetButton.setAttribute("aria-label", preset.label);
      presetButton.setAttribute("type", "button");
      // presetButton.setAttribute("title", `Apply ${preset.label.toLowerCase()}`);
      presetSizesGroup.appendChild(presetButton);
    });

    // ----- Content-aware button -----
    const contentAwareButton = document.createElement("button");
    contentAwareButton.className = config.buttonClasses;
    contentAwareButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M2 12h6"></path>
  <path d="M22 12h-6"></path>
  <path d="M12 2v6"></path>
  <path d="M12 22v-6"></path>
  <path d="M4.93 4.93l4.24 4.24"></path>
  <path d="M14.83 14.83l4.24 4.24"></path>
  <path d="M14.83 9.17l4.24-4.24"></path>
  <path d="M4.93 19.07l4.24-4.24"></path>
</svg> Smart Fit`;
    contentAwareButton.setAttribute(
      "aria-label",
      "Apply content-aware scaling"
    );
    contentAwareButton.setAttribute("type", "button");
    contentAwareButton.setAttribute(
      "title",
      "Intelligently scale diagram based on content analysis"
    );
    // ----- Responsive button -----
    const responsiveButton = document.createElement("button");
    responsiveButton.className = config.buttonClasses;
    responsiveButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
  <line x1="8" y1="21" x2="16" y2="21"></line>
  <line x1="12" y1="17" x2="12" y2="21"></line>
</svg> Responsive`;
    responsiveButton.setAttribute("aria-label", "Apply responsive scaling");
    responsiveButton.setAttribute("type", "button");
    responsiveButton.setAttribute(
      "title",
      "Scale diagram based on screen size"
    );

    // ----- Responsive mode toggle -----
    const responsiveModeLabel = document.createElement("label");
    responsiveModeLabel.className = "mermaid-responsive-mode-label";
    responsiveModeLabel.setAttribute("for", `mermaid-responsive-mode-${index}`);
    const responsiveModeCheckbox = document.createElement("input");
    responsiveModeCheckbox.type = "checkbox";
    responsiveModeCheckbox.id = `mermaid-responsive-mode-${index}`;
    responsiveModeCheckbox.className = "mermaid-responsive-mode-checkbox";
    const savedResponsiveMode = Utils.getSavedPreference(
      "mermaid-responsive-enabled",
      false
    );
    responsiveModeCheckbox.checked =
      savedResponsiveMode === "true" || savedResponsiveMode === true;
    responsiveModeLabel.appendChild(responsiveModeCheckbox);
    responsiveModeLabel.appendChild(
      document.createTextNode(" Auto-responsive")
    );

    // ----- Padding control group -----
    const paddingControlGroup = document.createElement("div");
    paddingControlGroup.className = "mermaid-padding-control-group";
    const paddingLabel = document.createElement("label");
    paddingLabel.textContent = "Padding:";
    paddingLabel.className = "mermaid-padding-label";
    paddingLabel.setAttribute("for", `mermaid-padding-slider-${index}`);
    const paddingSlider = document.createElement("input");
    paddingSlider.type = "range";
    paddingSlider.id = `mermaid-padding-slider-${index}`;
    paddingSlider.className = "mermaid-size-slider";
    paddingSlider.min = 0;
    paddingSlider.max = 50;
    paddingSlider.setAttribute("aria-label", "Diagram padding");
    const savedPadding = Utils.getSavedPreference(
      "mermaid-diagram-padding",
      10
    );
    paddingSlider.value = savedPadding;
    paddingControlGroup.appendChild(paddingLabel);
    paddingControlGroup.appendChild(paddingSlider);

    // ----- Scale to container button -----
    const scaleToContainerButton = document.createElement("button");
    scaleToContainerButton.className = config.buttonClasses;
    scaleToContainerButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <polyline points="15 3 21 3 21 9"></polyline>
  <polyline points="9 21 3 21 3 15"></polyline>
  <line x1="21" y1="3" x2="14" y2="10"></line>
  <line x1="3" y1="21" x2="10" y2="14"></line>
</svg> Fit Container`;
    scaleToContainerButton.setAttribute("aria-label", "Scale to fit container");
    scaleToContainerButton.setAttribute("type", "button");
    scaleToContainerButton.setAttribute(
      "title",
      "Scale diagram to fit perfectly within its container"
    );

    // ----- Auto-crop button -----
    const autoCropButton = document.createElement("button");
    autoCropButton.className = config.buttonClasses;
    autoCropButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M6 6h12v12H6z"></path>
  <path d="M16 16v4h4"></path>
  <path d="M8 8V4H4"></path>
  <path d="M16 8V4h4"></path>
  <path d="M8 16v4H4"></path>
</svg> Auto-Crop`;
    autoCropButton.setAttribute(
      "aria-label",
      "Auto-crop diagram to remove excess space"
    );
    autoCropButton.setAttribute("type", "button");
    autoCropButton.setAttribute(
      "title",
      "Automatically crop the diagram to remove excess space"
    );
    // Create standard buttons (Copy/SVG/PNG)
    const copyButton = document.createElement("button");
    copyButton.className = config.buttonClasses;
    copyButton.innerHTML = `${getCopyButtonIcon()} ${config.copyText}`;
    copyButton.setAttribute("aria-label", "Copy diagram code to clipboard");
    copyButton.setAttribute("type", "button");
    copyButton.setAttribute("data-diagram-index", index);

    // Create SVG export button
    const svgButton = document.createElement("button");
    svgButton.className = config.buttonClasses;
    svgButton.innerHTML = `${getSvgButtonIcon()} ${config.svgText}`;
    svgButton.setAttribute("aria-label", "Download diagram as SVG");
    svgButton.setAttribute("type", "button");
    svgButton.setAttribute("data-diagram-index", index);

    // Create PNG export button
    const pngButton = document.createElement("button");
    pngButton.className = config.buttonClasses;
    pngButton.innerHTML = `${getPngButtonIcon()} ${config.pngText}`;
    pngButton.setAttribute("aria-label", "Download diagram as PNG");
    pngButton.setAttribute("type", "button");
    pngButton.setAttribute("data-diagram-index", index);

    // ==============================================
    // 2. ORGANISE CONTROLS USING CONFIGURATION
    // ==============================================

    // Map control elements to their configuration keys
    const controlElements = {
      widthSlider: {
        element: widthSliderGroup,
        config: config.controlOrder.widthSlider,
      },
      heightSlider: {
        element: heightSliderGroup,
        config: config.controlOrder.heightSlider,
      },
      aspectRatio: {
        element: aspectRatioContainer,
        config: config.controlOrder.aspectRatio,
      },
      orientation: {
        element: orientationGroup,
        config: config.controlOrder.orientation,
      },
      resetButton: {
        element: resetButton,
        config: config.controlOrder.resetButton,
      },
      autoFitButton: {
        element: autoFitButton,
        config: config.controlOrder.autoFitButton,
      },
      autoFitOnLoad: {
        element: autoFitOnLoadLabel,
        config: config.controlOrder.autoFitOnLoad,
      },
      zoomControls: {
        element: zoomControlsGroup,
        config: config.controlOrder.zoomControls,
      },
      fitOptions: {
        element: fitOptionsGroup,
        config: config.controlOrder.fitOptions,
      },
      presetSizes: {
        element: presetSizesGroup,
        config: config.controlOrder.presetSizes,
      },
      contentAwareButton: {
        element: contentAwareButton,
        config: config.controlOrder.contentAwareButton,
      },
      responsiveButton: {
        element: responsiveButton,
        config: config.controlOrder.responsiveButton,
      },
      responsiveMode: {
        element: responsiveModeLabel,
        config: config.controlOrder.responsiveMode,
      },
      paddingControl: {
        element: paddingControlGroup,
        config: config.controlOrder.paddingControl,
      },
      scaleToContainer: {
        element: scaleToContainerButton,
        config: config.controlOrder.scaleToContainer,
      },
      autoCrop: {
        element: autoCropButton,
        config: config.controlOrder.autoCrop,
      },
    };

    // Group elements by row
    const rowGroups = {};

    // Process each control element
    Object.entries(controlElements).forEach(([key, control]) => {
      // Skip if control is not visible
      if (control.config && control.config.visible === false) {
        return;
      }

      // Get row number, default to 1 if not specified
      const rowNumber = control.config ? control.config.row || 1 : 1;

      // Initialise row group if it doesn't exist
      if (!rowGroups[rowNumber]) {
        rowGroups[rowNumber] = [];
      }

      // Add element to row group with its order
      rowGroups[rowNumber].push({
        element: control.element,
        order: control.config ? control.config.order || 999 : 999,
      });
    });

    // Sort rows by row number (ascending)
    const sortedRows = Object.keys(rowGroups).sort(
      (a, b) => parseInt(a) - parseInt(b)
    );

    // For each row, create a row container and add the elements in order
    sortedRows.forEach((rowNumber) => {
      // Skip empty rows
      if (rowGroups[rowNumber].length === 0) {
        return;
      }

      // Create a row container
      const rowContainer = document.createElement("div");
      rowContainer.className = "mermaid-controls-row";
      rowContainer.style.display = "flex";
      rowContainer.style.flexWrap = "wrap";
      // rowContainer.style.marginBottom = "10px";

      // Sort elements in this row by their order value
      const rowElements = rowGroups[rowNumber].sort(
        (a, b) => a.order - b.order
      );

      // Add the elements to the row container
      rowElements.forEach((item) => {
        rowContainer.appendChild(item.element);
      });

      // Add the row container to the sliders container
      slidersContainer.appendChild(rowContainer);
    });
    // ==============================================
    // 3. EVENT LISTENERS FOR CONTROLS
    // ==============================================

    // Copy button event listener
    copyButton.addEventListener("click", function () {
      copyCodeToClipboard(code, copyButton);
    });

    // SVG button event listener
    svgButton.addEventListener("click", function () {
      exportAsSvg(container, index);
    });

    // PNG button event listener
    pngButton.addEventListener("click", function () {
      exportAsPng(container, index);
    });

    // Width slider event listener
    widthSlider.addEventListener("input", function () {
      const width = this.value;
      const height = heightSlider.value;
      const isLocked = aspectRatioCheckbox.checked;

      // Find the SVG element in the container, accounting for possible nesting
      let svgElement = container.querySelector("svg");

      // If we found an SVG element, apply the size changes
      if (svgElement) {
        // Ensure we're not in fullscreen mode
        if (!container.classList.contains("fullscreen-mode")) {
          applyDiagramSize(svgElement, width, height, isLocked);

          // If aspect ratio is locked, update height slider to match
          if (isLocked) {
            const ratio =
              parseFloat(svgElement.getAttribute("data-aspect-ratio")) || 1;
            const newHeightPercentage =
              (width / ratio / config.defaultHeight) * 100;
            const newHeight = Math.min(
              Math.max(newHeightPercentage, config.minHeight),
              config.maxHeight
            );

            // Update height slider with visual feedback
            heightSlider.value = newHeight;

            // Add a temporary highlight effect to show the linked slider movement
            heightSlider.classList.add("slider-adjusting");
            setTimeout(() => {
              heightSlider.classList.remove("slider-adjusting");
            }, 500);

            // Announce both changes to screen readers
            announceToScreenReader(
              `Diagram width set to ${width}%. Height automatically adjusted to ${Math.round(
                newHeight
              )}% to maintain aspect ratio.`
            );
          } else {
            // Announce only width change to screen readers
            announceToScreenReader(`Diagram width set to ${width}%`);
          }
        } else {
          // In fullscreen mode, delegate to pan-zoom functionality
          Logger.debug(
            "In fullscreen mode, width adjustment delegated to pan-zoom"
          );
        }
      } else {
        Logger.warn("Could not find SVG element to resize");
      }

      // Save preference regardless of whether we could apply it
      Utils.savePreference("mermaid-diagram-width", width);
    });

    // Height slider event listener
    heightSlider.addEventListener("input", function () {
      const width = widthSlider.value;
      const height = this.value;
      const isLocked = aspectRatioCheckbox.checked;

      const svgElement = container.querySelector("svg");
      if (svgElement) {
        applyDiagramSize(svgElement, width, height, isLocked);

        // If aspect ratio is locked, update width slider to match
        if (isLocked) {
          const ratio =
            parseFloat(svgElement.getAttribute("data-aspect-ratio")) || 1;
          const newWidthPercentage =
            ((height * ratio) / config.defaultWidth) * 100;
          const newWidth = Math.min(
            Math.max(newWidthPercentage, config.minWidth),
            config.maxWidth
          );
          // Update width slider with visual feedback
          widthSlider.value = newWidth;

          // Add a temporary highlight effect to show the linked slider movement
          widthSlider.classList.add("slider-adjusting");
          setTimeout(() => {
            widthSlider.classList.remove("slider-adjusting");
          }, 500);

          // Announce both changes to screen readers
          announceToScreenReader(
            `Diagram height set to ${height}%. Width automatically adjusted to ${Math.round(
              newWidth
            )}% to maintain aspect ratio.`
          );
        } else {
          // Announce only height change to screen readers
          announceToScreenReader(`Diagram height set to ${height}%`);
        }
      } else {
        // Announce only height change to screen readers
        announceToScreenReader(`Diagram height set to ${height}%`);
      }

      // Save preference
      Utils.savePreference("mermaid-diagram-height", height);
    });

    // Aspect ratio checkbox event listener
    aspectRatioCheckbox.addEventListener("change", function () {
      const isLocked = this.checked;
      Utils.savePreference("mermaid-lock-aspect-ratio", isLocked);

      // Add or remove visual indicators for linked sliders
      if (isLocked) {
        // Get current SVG element
        const svgElement = container.querySelector("svg");
        if (svgElement) {
          // Calculate and store the current aspect ratio
          const ratio = Utils.calculateAspectRatio(svgElement);
          svgElement.setAttribute("data-aspect-ratio", ratio);

          // Apply size with aspect ratio maintained
          applyDiagramSize(
            svgElement,
            widthSlider.value,
            heightSlider.value,
            true,
            ratio
          );
        }

        // Add visual indicators for linked sliders
        slidersContainer.classList.add("sliders-linked");
        widthSlider.classList.add("slider-linked");
        heightSlider.classList.add("slider-linked");
        widthSliderGroup.classList.add("slider-group-linked");
        heightSliderGroup.classList.add("slider-group-linked");

        // Update ARIA attributes to indicate linked state
        widthSlider.setAttribute(
          "aria-description",
          "Width slider linked to height slider"
        );
        heightSlider.setAttribute(
          "aria-description",
          "Height slider linked to width slider"
        );

        // Announce to screen readers with more detailed information
        announceToScreenReader(
          "Aspect ratio locked. Width and height sliders are now linked to maintain proportions."
        );
      } else {
        // Remove visual indicators for linked sliders
        slidersContainer.classList.remove("sliders-linked");
        widthSlider.classList.remove("slider-linked");
        heightSlider.classList.remove("slider-linked");
        widthSliderGroup.classList.remove("slider-group-linked");
        heightSliderGroup.classList.remove("slider-group-linked");

        // Update ARIA attributes to indicate independent state
        widthSlider.setAttribute("aria-description", "Width slider");
        heightSlider.setAttribute("aria-description", "Height slider");

        // Announce to screen readers with more detailed information
        announceToScreenReader(
          "Aspect ratio unlocked. Width and height sliders now work independently."
        );
      }
    });
    // Orientation select event listener - only add if supported
    if (supportsOrientationChanges) {
      orientationSelect.addEventListener("change", function () {
        const newOrientation = this.value;
        const diagramCode =
          decodeURIComponent(container.getAttribute("data-diagram-code")) ||
          code;
        const updatedCode = updateOrientation(diagramCode, newOrientation);

        Logger.info(`Changing diagram orientation to ${newOrientation}`);

        // Store updated code
        container.setAttribute(
          "data-diagram-code",
          encodeURIComponent(updatedCode)
        );

        // Re-render the diagram
        const mermaidDiv = container.querySelector(".mermaid");
        if (mermaidDiv) {
          const mermaidId = mermaidDiv.id;
          mermaidDiv.textContent = updatedCode;

          window.mermaid
            .render(mermaidId + "-svg", updatedCode)
            .then((result) => {
              const element = document.getElementById(mermaidId);
              if (element) {
                element.innerHTML = result.svg;
                const svgElement = element.querySelector("svg");
                if (svgElement) {
                  // Apply existing width and height to newly rendered diagram
                  applyDiagramSize(
                    svgElement,
                    widthSlider.value,
                    heightSlider.value,
                    aspectRatioCheckbox.checked
                  );
                }
              }
            })
            .catch((error) => {
              Logger.error("Failed to re-render diagram:", error);
              announceToScreenReader("Failed to update diagram orientation");
            });
        }
      });
    }

    // Reset button event listener
    resetButton.addEventListener("click", function () {
      Logger.debug("Resetting diagram size to defaults");

      // Reset sliders to default values
      widthSlider.value = config.defaultWidth;
      heightSlider.value = config.defaultHeight;

      // Get SVG element
      const svgElement = container.querySelector("svg");
      if (svgElement) {
        // Apply default size
        applyDiagramSize(
          svgElement,
          config.defaultWidth,
          config.defaultHeight,
          aspectRatioCheckbox.checked
        );
      }

      // Save preferences
      Utils.savePreference("mermaid-diagram-width", config.defaultWidth);
      Utils.savePreference("mermaid-diagram-height", config.defaultHeight);

      // Announce to screen readers
      announceToScreenReader("Size reset to default");
    });

    // Auto-fit button event listener
    autoFitButton.addEventListener("click", function () {
      const svgElement = container.querySelector("svg");
      if (svgElement) {
        Logger.info("Applying auto-fit to diagram");
        const scale = autoFitDiagram(svgElement, container);
        if (scale) {
          announceToScreenReader("Diagram auto-fitted to content");

          // Update slider values to reflect the new size
          const newWidth = scale;
          if (widthSlider) widthSlider.value = newWidth;
        } else {
          announceToScreenReader("Failed to auto-fit diagram");
        }
      } else {
        Logger.warn("No diagram found to auto-fit");
        announceToScreenReader("No diagram found to auto-fit");
      }
    });
    // Auto-fit on load checkbox event listener
    autoFitOnLoadCheckbox.addEventListener("change", function () {
      Utils.savePreference("mermaid-auto-fit-on-load", this.checked);
      Logger.info(`Auto-fit on load ${this.checked ? "enabled" : "disabled"}`);
      announceToScreenReader(
        this.checked ? "Auto-fit on load enabled" : "Auto-fit on load disabled"
      );
    });

    // Zoom controls event listeners
    zoomOutButton.addEventListener("click", function () {
      const svgElement = container.querySelector("svg");
      if (svgElement) {
        const currentWidth = parseInt(widthSlider.value);
        const newWidth = Math.max(currentWidth - 10, config.minWidth);

        Logger.debug(`Zooming out from ${currentWidth}% to ${newWidth}%`);

        // Apply zoom
        applyZoom(
          svgElement,
          newWidth,
          heightSlider.value,
          aspectRatioCheckbox.checked
        );

        // Update slider value
        widthSlider.value = newWidth;

        // Save preference
        Utils.savePreference("mermaid-diagram-width", newWidth);

        // Announce to screen readers
        announceToScreenReader(`Zoomed out to ${newWidth}%`);
      }
    });

    zoomInButton.addEventListener("click", function () {
      const svgElement = container.querySelector("svg");
      if (svgElement) {
        const currentWidth = parseInt(widthSlider.value);
        const newWidth = Math.min(currentWidth + 10, config.maxWidth);

        Logger.debug(`Zooming in from ${currentWidth}% to ${newWidth}%`);

        // Apply zoom
        applyZoom(
          svgElement,
          newWidth,
          heightSlider.value,
          aspectRatioCheckbox.checked
        );

        // Update slider value
        widthSlider.value = newWidth;

        // Save preference
        Utils.savePreference("mermaid-diagram-width", newWidth);

        // Announce to screen readers
        announceToScreenReader(`Zoomed in to ${newWidth}%`);
      }
    });

    // Fit options event listeners
    fitWidthButton.addEventListener("click", function () {
      const svgElement = container.querySelector("svg");
      if (svgElement) {
        Logger.info("Fitting diagram to width");

        // Fit to width (100%)
        const newWidth = 100;

        // Apply fit
        applyDiagramSize(
          svgElement,
          newWidth,
          heightSlider.value,
          aspectRatioCheckbox.checked
        );

        // Update slider value
        widthSlider.value = newWidth;

        // Save preference
        Utils.savePreference("mermaid-diagram-width", newWidth);

        // Announce to screen readers
        announceToScreenReader("Diagram fitted to width");
      }
    });
    fitHeightButton.addEventListener("click", function () {
      const svgElement = container.querySelector("svg");
      if (svgElement) {
        try {
          Logger.info("Fitting diagram to height");

          // Get container height
          const containerHeight = container.clientHeight;
          const svgHeight = svgElement.getBoundingClientRect().height;

          // Calculate height percentage to fit container
          const heightRatio = (containerHeight / svgHeight) * 100;
          const newHeight = Math.min(
            Math.max(heightRatio, config.minHeight),
            config.maxHeight
          );

          // Apply fit
          applyDiagramSize(
            svgElement,
            widthSlider.value,
            newHeight,
            aspectRatioCheckbox.checked
          );

          // Update slider value
          heightSlider.value = newHeight;

          // Save preference
          Utils.savePreference("mermaid-diagram-height", newHeight);

          // Announce to screen readers
          announceToScreenReader("Diagram fitted to height");
        } catch (error) {
          Logger.error("Error fitting to height:", error);
        }
      }
    });

    // Preset size buttons event listeners
    // Preset size buttons event listeners - update this section
    presetSizesGroup
      .querySelectorAll("button")
      .forEach((button, buttonIndex) => {
        button.addEventListener("click", function () {
          // Don't apply in fullscreen mode
          if (container.classList.contains("fullscreen-mode")) {
            Logger.debug("In fullscreen mode, size presets not applied");
            return;
          }

          const svgElement = container.querySelector("svg");
          if (svgElement) {
            const preset = presetSizes[buttonIndex];

            Logger.info(`Applying preset size: ${preset.name}`);

            // Apply preset size
            applyDiagramSize(
              svgElement,
              preset.width,
              preset.height,
              aspectRatioCheckbox.checked
            );

            // Update slider values
            widthSlider.value = preset.width;
            heightSlider.value = preset.height;

            // Save preferences
            Utils.savePreference("mermaid-diagram-width", preset.width);
            Utils.savePreference("mermaid-diagram-height", preset.height);

            // Announce to screen readers
            announceToScreenReader(`Applied ${preset.label}`);
          } else {
            Logger.warn("Could not find SVG element to apply preset size");
          }
        });
      });

    // Content-aware button event listener
    contentAwareButton.addEventListener("click", function () {
      const svgElement = container.querySelector("svg");
      if (svgElement) {
        Logger.info("Applying content-aware auto-fit");
        contentAwareAutoFit(svgElement, container);
      }
    });
    // Responsive button event listener
    responsiveButton.addEventListener("click", function () {
      const svgElement = container.querySelector("svg");
      if (svgElement) {
        Logger.info("Applying responsive scaling");
        const result = applyResponsiveScaling(svgElement);
        if (result) {
          // Save preferences
          Utils.savePreference("mermaid-diagram-width", result.width);
          Utils.savePreference("mermaid-diagram-height", result.height);
        }
      }
    });

    // Responsive mode checkbox event listener
    responsiveModeCheckbox.addEventListener("change", function () {
      Utils.savePreference("mermaid-responsive-enabled", this.checked);

      Logger.info(`Responsive mode ${this.checked ? "enabled" : "disabled"}`);

      // If enabled, apply responsive scaling immediately
      if (this.checked) {
        const svgElement = container.querySelector("svg");
        if (svgElement) {
          applyResponsiveScaling(svgElement);
        }
      }

      announceToScreenReader(
        this.checked ? "Responsive mode enabled" : "Responsive mode disabled"
      );
    });

    // Padding slider event listener
    paddingSlider.addEventListener("input", function () {
      const padding = this.value;
      const svgElement = container.querySelector("svg");
      if (svgElement) {
        Logger.debug(`Setting diagram padding to ${padding}px`);

        // Apply padding
        applyDiagramPadding(svgElement, padding);

        // Save preference
        Utils.savePreference("mermaid-diagram-padding", padding);

        // Announce to screen readers
        announceToScreenReader(`Diagram padding set to ${padding}px`);
      }
    });

    // Scale to container button event listener
    scaleToContainerButton.addEventListener("click", function () {
      const svgElement = container.querySelector("svg");
      if (svgElement) {
        Logger.info("Scaling diagram to fit container");
        scaleToContainer(svgElement, container);
      }
    });

    // Auto-crop button event listener
    autoCropButton.addEventListener("click", function () {
      const svgElement = container.querySelector("svg");
      if (!svgElement) return;

      if (container.classList.contains("auto-cropped")) {
        Logger.info("Resetting auto-crop");
        // Reset the cropping
        resetAutoCrop(svgElement, container);
        // Update button text
        autoCropButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M6 6h12v12H6z"></path>
      <path d="M16 16v4h4"></path>
      <path d="M8 8V4H4"></path>
      <path d="M16 8V4h4"></path>
      <path d="M8 16v4H4"></path>
    </svg> Auto-Crop`;
      } else {
        Logger.info("Applying auto-crop");
        // Apply auto-cropping
        autoCropContainer(svgElement, container);
        // Update button text
        autoCropButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M6 6h12v12H6z"></path>
      <path d="M4 14h4v4"></path>
      <path d="M4 10h4V6"></path>
      <path d="M16 10h4V6"></path>
      <path d="M16 14h4v4"></path>
    </svg> Reset Crop`;
      }
    });
    // ==============================================
    // 4. ADD CONTROLS TO CONTAINER AND APPLY INITIAL SETTINGS
    // ==============================================

    // Add the containers in the right order
    controlsContainer.appendChild(slidersContainer);
    controlsContainer.appendChild(copyButton);
    controlsContainer.appendChild(svgButton);
    controlsContainer.appendChild(pngButton);

    // Add controls to the container
    container.appendChild(controlsContainer);

    // Apply initial width and height to the SVG container
    const svgElement = container.querySelector("svg");
    if (svgElement) {
      applyDiagramSize(
        svgElement,
        savedWidth,
        savedHeight,
        aspectRatioCheckbox.checked
      );
    }

    // Add theme selector if MermaidThemes is available
    if (
      window.MermaidThemes &&
      typeof window.MermaidThemes.addThemeSelector === "function"
    ) {
      window.MermaidThemes.addThemeSelector(container, index);
    }

    // Auto-fit on initial render if enabled in preferences
    const autoFitOnLoad = Utils.getSavedPreference(
      "mermaid-auto-fit-on-load",
      config.autoFitOnLoadDefault
    );
    if (autoFitOnLoad === "true" || autoFitOnLoad === true) {
      const svgElement = container.querySelector("svg");
      if (svgElement) {
        // Use a small delay to ensure the SVG is fully rendered
        setTimeout(() => {
          autoFitDiagram(svgElement, container);
          Logger.info("Auto-fit applied on load");
        }, 100);
      }
    }

    Logger.debug(`Successfully created controls for diagram ${index}`);
  }

  /**
   * Auto-fit diagram based on complexity
   * @param {HTMLElement} svgElement - The SVG element to resize
   * @param {HTMLElement} container - The container element
   * @returns {number|null} The applied scale percentage or null if failed
   */
  function autoFitDiagram(svgElement, container) {
    if (!svgElement) {
      Logger.error("Cannot auto-fit: SVG element not found");
      return null;
    }

    try {
      // Get the natural size of the SVG content
      const viewBox = svgElement.getAttribute("viewBox");
      if (!viewBox) {
        Logger.warn("Cannot auto-fit: SVG has no viewBox");
        return null;
      }

      // Calculate appropriate scaling based on diagram complexity
      const diagramComplexity = estimateDiagramComplexity(svgElement);
      let scale;

      if (diagramComplexity === "simple") {
        // For simple diagrams, use 60-70% of container width
        scale = 65;
      } else if (diagramComplexity === "medium") {
        // For medium complexity, use 75-85% of container width
        scale = 80;
      } else {
        // For complex diagrams, use 90-100% of container width
        scale = 95;
      }

      // Apply the calculated scale
      applyDiagramSize(svgElement, scale, null, false);

      // Save preference
      Utils.savePreference("mermaid-diagram-width", scale);

      // Log the auto-fit action for debugging
      Logger.info(
        `Auto-fit applied: ${diagramComplexity} diagram scaled to ${scale}%`
      );

      return scale;
    } catch (error) {
      Logger.error("Error in auto-fit:", error);
      return null;
    }
  }

  /**
   * Estimate diagram complexity based on nodes and edges
   * @param {HTMLElement} svgElement - The SVG element to analyse
   * @returns {string} Complexity level: "simple", "medium", or "complex"
   */
  function estimateDiagramComplexity(svgElement) {
    try {
      // Count nodes and edges to estimate complexity
      const nodes = svgElement.querySelectorAll(".node").length;
      const edges = svgElement.querySelectorAll(".edgePath").length;
      const labels = svgElement.querySelectorAll("text").length;

      // Calculate total elements
      const totalElements = nodes + edges + labels;

      Logger.debug(
        `Diagram complexity analysis: ${nodes} nodes, ${edges} edges, ${labels} labels, ${totalElements} total elements`
      );

      if (totalElements < 10) {
        return "simple";
      } else if (totalElements < 30) {
        return "medium";
      } else {
        return "complex";
      }
    } catch (error) {
      Logger.error("Error estimating complexity:", error);
      // Default to medium complexity if there's an error
      return "medium";
    }
  }

  /**
   * Apply width and height settings to a mermaid diagram SVG
   * @param {HTMLElement} svgElement - The SVG element to resize
   * @param {number} widthPercent - Width percentage (30-100)
   * @param {number} heightPercent - Height percentage (50-300)
   * @param {boolean} maintainAspectRatio - Whether to maintain aspect ratio
   * @param {number} aspectRatio - Aspect ratio to maintain (width/height)
   */
  /**
   * Apply width and height settings to a mermaid diagram SVG
   * Enhanced with diagram-specific logging and improved identification
   * @param {HTMLElement} svgElement - The SVG element to resize
   * @param {number} widthPercent - Width percentage (30-100)
   * @param {number} heightPercent - Height percentage (50-300)
   * @param {boolean} maintainAspectRatio - Whether to maintain aspect ratio
   * @param {number} aspectRatio - Aspect ratio to maintain (width/height)
   */
  function applyDiagramSize(
    svgElement,
    widthPercent,
    heightPercent = null,
    maintainAspectRatio = false,
    aspectRatio = null
  ) {
    if (!svgElement) {
      Logger.warn("Cannot apply diagram size: SVG element not provided");
      return;
    }

    // Check if this is a main diagram SVG or a button icon SVG
    // Main diagram SVGs are direct children of the mermaid div
    const isMainSvg =
      svgElement.parentElement &&
      (svgElement.parentElement.classList.contains("mermaid") ||
        svgElement.parentElement.id.startsWith("mermaid-diagram-"));

    if (!isMainSvg && svgElement.closest(".mermaid-control-button")) {
      // Only log this once per page load to reduce noise
      if (!window._buttonSkipLogged) {
        Logger.debug("Skipping resizing of button icon SVGs");
        window._buttonSkipLogged = true;
      }
      return;
    }

    // Get container and diagram identifier for enhanced logging
    const container = svgElement.closest(".mermaid-container");
    const diagramId = container ? getDiagramIdentifier(container) : "unknown";

    // Log size change with throttling to prevent spam
    if (container && typeof DiagramLogger !== "undefined") {
      DiagramLogger.logSizeChange(container, {
        width: `${widthPercent}%`,
        height: heightPercent ? `${heightPercent}%` : "auto",
        aspectRatio: maintainAspectRatio,
        operation: "applyDiagramSize",
      });
    }

    try {
      // Store original dimensions if not already stored
      if (!svgElement.hasAttribute("data-original-width")) {
        const rect = svgElement.getBoundingClientRect();

        // Only store if we have valid dimensions
        if (rect.width > 0 && rect.height > 0) {
          svgElement.setAttribute("data-original-width", rect.width);
          svgElement.setAttribute("data-original-height", rect.height);

          // Store aspect ratio if not provided
          if (!aspectRatio) {
            aspectRatio = rect.width / rect.height;
          }
          svgElement.setAttribute("data-aspect-ratio", aspectRatio);

          Logger.debug(
            `Stored original dimensions for ${diagramId}: ${rect.width}×${
              rect.height
            } (ratio: ${aspectRatio.toFixed(2)})`
          );
        } else {
          Logger.warn(
            `Invalid dimensions for ${diagramId}: ${rect.width}×${rect.height}`
          );
          return;
        }
      }

      // Get stored dimensions and aspect ratio
      const originalWidth = parseFloat(
        svgElement.getAttribute("data-original-width")
      );
      const originalHeight = parseFloat(
        svgElement.getAttribute("data-original-height")
      );

      // Use provided aspect ratio or stored one or calculate from original dimensions
      aspectRatio =
        aspectRatio ||
        parseFloat(svgElement.getAttribute("data-aspect-ratio")) ||
        (originalWidth && originalHeight ? originalWidth / originalHeight : 1);

      // Validate input parameters
      if (isNaN(widthPercent) || widthPercent < 0 || widthPercent > 200) {
        Logger.warn(
          `Invalid width percentage for ${diagramId}: ${widthPercent}%. Using default.`
        );
        widthPercent = config.defaultWidth;
      }

      if (
        heightPercent !== null &&
        (isNaN(heightPercent) || heightPercent < 0 || heightPercent > 500)
      ) {
        Logger.warn(
          `Invalid height percentage for ${diagramId}: ${heightPercent}%. Using auto.`
        );
        heightPercent = null;
      }

      // Apply width styling
      svgElement.style.width = `${widthPercent}%`;
      svgElement.style.maxWidth = `${widthPercent}%`;

      // Handle height based on parameters
      if (heightPercent !== null) {
        if (maintainAspectRatio && aspectRatio) {
          // Calculate height based on width to maintain aspect ratio
          const containerWidth = container
            ? container.clientWidth
            : originalWidth;
          const targetWidth = (containerWidth * widthPercent) / 100;
          const targetHeight = targetWidth / aspectRatio;

          // Set calculated height
          svgElement.style.height = `${targetHeight}px`;

          Logger.debug(
            `Applied aspect-ratio-locked size to ${diagramId}: ${widthPercent}% width, ${targetHeight.toFixed(
              0
            )}px height (ratio: ${aspectRatio.toFixed(2)})`
          );
        } else {
          // Use specified height percentage
          const baseHeight = originalHeight || 300; // fallback height
          const targetHeight = (baseHeight * heightPercent) / 100;
          svgElement.style.height = `${targetHeight}px`;

          Logger.debug(
            `Applied independent size to ${diagramId}: ${widthPercent}% width, ${heightPercent}% height (${targetHeight.toFixed(
              0
            )}px)`
          );
        }
      } else {
        // Default to auto height if no height specified
        svgElement.style.height = "auto";

        Logger.debug(
          `Applied auto-height size to ${diagramId}: ${widthPercent}% width, auto height`
        );
      }

      // Remove any conflicting styling that might cause layout issues
      svgElement.style.minHeight = "0";
      svgElement.style.maxHeight = maintainAspectRatio ? "none" : "";

      // Ensure proper SVG rendering
      if (svgElement.hasAttribute("viewBox")) {
        // Keep the viewBox but ensure it's correctly sized
        svgElement.style.overflow = "visible";

        // Preserve viewBox aspect ratio if maintaining aspect ratio
        if (maintainAspectRatio) {
          svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
        }
      }

      // Centre the diagram horizontally
      svgElement.style.display = "block";
      svgElement.style.margin = "0 auto";

      // Clear any transform that might interfere with sizing
      if (
        svgElement.style.transform &&
        !svgElement.style.transform.includes("scale")
      ) {
        svgElement.style.transform = "";
      }

      // Ensure container doesn't constrain the SVG unnecessarily
      if (container) {
        container.style.overflow = "visible";
      }

      // Fire a custom event for other components that might need to know about size changes
      if (container) {
        const sizeChangeEvent = new CustomEvent("mermaidSizeChanged", {
          detail: {
            diagramId: diagramId,
            width: `${widthPercent}%`,
            height: heightPercent ? `${heightPercent}%` : "auto",
            aspectRatio: maintainAspectRatio,
            svgElement: svgElement,
          },
        });
        container.dispatchEvent(sizeChangeEvent);
      }

      // Success logging (throttled)
      const logKey = `size-success-${diagramId}`;
      if (!window._sizeSuccessLogged) window._sizeSuccessLogged = {};

      const now = Date.now();
      if (
        !window._sizeSuccessLogged[logKey] ||
        now - window._sizeSuccessLogged[logKey] > 2000
      ) {
        // ✅ FIXED: Proper height percentage formatting
        const heightDisplay =
          heightPercent !== null ? `${heightPercent}%` : "auto";

        Logger.info(
          `Successfully resized ${diagramId}: ${widthPercent}% × ${heightDisplay}${
            maintainAspectRatio ? " (aspect locked)" : ""
          }`
        );
        window._sizeSuccessLogged[logKey] = now;
      }
    } catch (error) {
      Logger.error(`Error applying diagram size to ${diagramId}:`, error);

      // Attempt to apply basic fallback styling
      try {
        svgElement.style.width = `${config.defaultWidth}%`;
        svgElement.style.height = "auto";
        Logger.info(`Applied fallback sizing to ${diagramId}`);
      } catch (fallbackError) {
        Logger.error(
          `Failed to apply fallback sizing to ${diagramId}:`,
          fallbackError
        );
      }
    }
  }

  /**
   * Helper function to get diagram identifier (add this if not already present)
   * This should be added alongside the applyDiagramSize function
   */
  function getDiagramIdentifier(container, fallbackIndex = "unknown") {
    if (!container) return `diagram-${fallbackIndex}`;

    // Try to get existing ID
    if (container.id) {
      return container.id;
    }

    // Try to get data-diagram-id
    if (container.dataset.diagramId) {
      return container.dataset.diagramId;
    }

    // Try to get from data-diagram-code (first few chars for identification)
    const diagramCode = container.getAttribute("data-diagram-code");
    if (diagramCode) {
      try {
        const decoded = decodeURIComponent(diagramCode);
        const firstLine = decoded.split("\n")[0].trim();
        if (firstLine) {
          // Create a readable identifier from the first line
          const identifier = firstLine
            .replace(/[^a-zA-Z0-9]/g, "-")
            .substring(0, 20);
          return `diagram-${identifier}-${fallbackIndex}`;
        }
      } catch (e) {
        // Ignore decode errors
      }
    }

    // Try to find diagram type from mermaid div content
    const mermaidDiv = container.querySelector(".mermaid");
    if (mermaidDiv) {
      const content = mermaidDiv.textContent.trim();
      const firstWord = content.split(/\s+/)[0];
      if (
        firstWord &&
        [
          "graph",
          "flowchart",
          "sequenceDiagram",
          "classDiagram",
          "gantt",
          "pie",
          "gitgraph",
        ].includes(firstWord)
      ) {
        return `${firstWord}-${fallbackIndex}`;
      }
    }

    // Generate unique ID and store it
    const uniqueId = `diagram-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}`;
    container.dataset.diagramId = uniqueId;

    return uniqueId;
  }

  /**
   * Initialise controls using Intersection Observer for performance
   * @param {HTMLElement} container - Container to observe (defaults to document)
   */
  function initWithLazyLoading(container = document) {
    if (!container) {
      Logger.warn("No container provided for lazy loading");
      return;
    }

    Logger.info("Initialising with lazy loading");

    // Find all Mermaid containers without controls
    const mermaidContainers = Utils.findContainersWithoutControls(container);

    if (mermaidContainers.length === 0) {
      Logger.debug("No mermaid containers found requiring controls");
      return;
    }

    // Log detection with diagram-specific information
    DiagramLogger.logDiagramDetection(mermaidContainers, "lazy-loading");

    // Create Intersection Observer
    const observer = new MutationObserver(function (mutations) {
      let newContainersFound = [];

      // Process mutations to find new diagrams
      mutations.forEach(function (mutation) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) {
              // Element node
              // Check if this is a mermaid container or contains one
              if (
                node.classList &&
                node.classList.contains("mermaid-container") &&
                !node.querySelector("." + config.controlsContainerClass)
              ) {
                newContainersFound.push(node);
              } else {
                // Check for mermaid containers inside this node
                const containersWithoutControls =
                  window.MermaidControls.utils.findContainersWithoutControls(
                    node
                  );
                newContainersFound.push(...containersWithoutControls);
              }
            }
          });
        }
      });

      // Only initialise if new diagrams without controls were found
      if (newContainersFound.length > 0) {
        // Remove duplicates
        const uniqueContainers = [...new Set(newContainersFound)];

        DiagramLogger.logDiagramDetection(
          uniqueContainers,
          "mutation-observer"
        );
        window.MermaidControls.initWithLazyLoading(document);
      }
    });
  }
  /**
   * Copy Mermaid code to clipboard
   * @param {string} code - The Mermaid code to copy
   * @param {HTMLElement} button - The button that was clicked
   */
  function copyCodeToClipboard(code, button) {
    if (!code) return;

    Logger.debug("Attempting to copy code to clipboard");

    // Try to focus the document first to help with Clipboard API permissions
    try {
      if (document.hasFocus && !document.hasFocus()) {
        window.focus();
      }
    } catch (e) {
      // Ignore focus errors
    }

    // Use Clipboard API if available
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(code)
        .then(() => {
          updateButtonStatus(button, true);
        })
        .catch((error) => {
          Logger.warn(
            "Clipboard API failed, using fallback method:",
            error.name
          );
          fallbackCopyToClipboard(code, button);
        });
    } else {
      fallbackCopyToClipboard(code, button);
    }
  }

  /**
   * Fallback method for copying to clipboard
   * @param {string} text - Text to copy
   * @param {HTMLElement} button - The button that was clicked
   */
  function fallbackCopyToClipboard(text, button) {
    try {
      Logger.debug("Using fallback clipboard method");

      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-999999px";
      textarea.style.top = "-999999px";

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);

      updateButtonStatus(button, successful);
    } catch (error) {
      Logger.error("Error in fallback copy method:", error);
      updateButtonStatus(button, false);
    }
  }

  /**
   * Export diagram as SVG - calls the new export utilities
   * @param {HTMLElement} container - The Mermaid container element
   * @param {number} index - Index for unique filename
   */
  function exportAsSvg(container, index) {
    if (
      window.MermaidExportUtils &&
      typeof window.MermaidExportUtils.exportAsSvg === "function"
    ) {
      Logger.info(`Exporting diagram ${index} as SVG`);
      window.MermaidExportUtils.exportAsSvg(container, index);
    } else {
      Logger.error("Export utilities not available");
      announceToScreenReader(
        "Export utilities not available. Make sure mermaid-export-utils.js is loaded."
      );
    }
  }

  /**
   * Export diagram as PNG - calls the new export utilities
   * @param {HTMLElement} container - The Mermaid container element
   * @param {number} index - Index for unique filename
   */
  function exportAsPng(container, index) {
    if (
      window.MermaidExportUtils &&
      typeof window.MermaidExportUtils.exportAsPng === "function"
    ) {
      Logger.info(`Exporting diagram ${index} as PNG`);
      window.MermaidExportUtils.exportAsPng(container, index);
    } else {
      Logger.error("Export utilities not available");
      announceToScreenReader(
        "Export utilities not available. Make sure mermaid-export-utils.js is loaded."
      );
    }
  }

  /**
   * Update button status after action
   * @param {HTMLElement} button - The button element
   * @param {boolean} success - Whether the action was successful
   */
  function updateButtonStatus(button, success) {
    const originalContent = button.innerHTML;

    if (success) {
      button.innerHTML = `${getCopyButtonIcon()} ${config.successText}`;
      announceToScreenReader("Code copied to clipboard");
    } else {
      button.innerHTML = `${getCopyButtonIcon()} ${config.failText}`;
      announceToScreenReader("Failed to copy code");
    }

    // Reset button after a delay
    setTimeout(() => {
      button.innerHTML = originalContent;
    }, config.successDuration);
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
   * Get SVG icon for copy button
   * @returns {string} SVG icon HTML
   */
  function getCopyButtonIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>`;
  }

  /**
   * Get SVG icon for SVG button
   * @returns {string} SVG icon HTML
   */
  function getSvgButtonIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
      <path d="M2 17l10 5 10-5"></path>
      <path d="M2 12l10 5 10-5"></path>
    </svg>`;
  }

  /**
   * Get SVG icon for PNG button
   * @returns {string} SVG icon HTML
   */
  function getPngButtonIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>`;
  }

  /**
   * Detect the current orientation from Mermaid code
   * @param {string} code - The Mermaid diagram code
   * @returns {string|null} The detected orientation or null if not found
   */
  function detectOrientation(code) {
    // Check if code contains graph/flowchart with orientation
    const graphMatch = code.match(/graph\s+(TB|BT|LR|RL)/i);
    const flowchartMatch = code.match(/flowchart\s+(TB|BT|LR|RL)/i);

    // Add debug logging
    Logger.debug("Detecting orientation:", {
      codePreview: code.substring(0, 50) + "...",
      graphMatch: graphMatch ? graphMatch[1] : null,
      flowchartMatch: flowchartMatch ? flowchartMatch[1] : null,
    });

    if (graphMatch) return graphMatch[1].toUpperCase();
    if (flowchartMatch) return flowchartMatch[1].toUpperCase();

    return null;
  }

  /**
   * Update the orientation in Mermaid code
   * @param {string} code - The original Mermaid code
   * @param {string} newOrientation - The new orientation (TB, BT, LR, RL)
   * @returns {string} The updated Mermaid code
   */
  function updateOrientation(code, newOrientation) {
    // Check if this is a graph/flowchart
    const isGraph = code.match(/^\s*graph\s+/im);
    const isFlowchart = code.match(/^\s*flowchart\s+/im);

    if (isGraph) {
      // Replace existing orientation in graph
      return code.replace(
        /^\s*graph\s+(TB|BT|LR|RL)/im,
        `graph ${newOrientation}`
      );
    } else if (isFlowchart) {
      // Replace existing orientation in flowchart
      return code.replace(
        /^\s*flowchart\s+(TB|BT|LR|RL)/im,
        `flowchart ${newOrientation}`
      );
    } else if (code.trim().startsWith("graph") || code.trim() === "") {
      // If no orientation specified or empty, add it
      return `graph ${newOrientation}\n${code}`;
    } else if (code.trim().startsWith("flowchart") || code.trim() === "") {
      // If no orientation specified or empty, add it
      return `flowchart ${newOrientation}\n${code}`;
    }

    // For other diagram types that don't support orientation, return unchanged
    return code;
  }

  /**
   * Check if diagram type supports orientation changes
   * @param {string} code - The Mermaid diagram code
   * @returns {boolean} True if orientation changes are supported
   */
  function supportsOrientation(code) {
    if (!code) return false;

    // Clean up code to remove whitespace and normalise
    const cleanCode = code.trim();

    // Check if this is a graph or flowchart (which support orientation)
    // Look for graph/flowchart at the beginning of the string with any orientation (TB|BT|LR|RL)
    const graphRegex = /^(?:graph|flowchart)\s+(TB|BT|LR|RL)/i;
    const isGraphOrFlowchart = graphRegex.test(cleanCode);

    // Add debug logging to help diagnose issues
    Logger.debug("Checking if diagram supports orientation:", {
      codePreview: cleanCode.substring(0, 50) + "...", // Show first 50 chars for privacy
      isGraphOrFlowchart: isGraphOrFlowchart,
      match: cleanCode.match(graphRegex),
    });

    return isGraphOrFlowchart;
  }
  /**
   * Apply zoom to diagram with smooth transition
   * @param {HTMLElement} svgElement - The SVG element to resize
   * @param {number} widthPercent - Width percentage
   * @param {number} heightPercent - Height percentage
   * @param {boolean} maintainAspectRatio - Whether to maintain aspect ratio
   */
  function applyZoom(
    svgElement,
    widthPercent,
    heightPercent,
    maintainAspectRatio
  ) {
    if (!svgElement) return;

    // Apply zoom with smooth transition
    svgElement.style.transition = "width 0.2s, height 0.2s";

    // Apply size with aspect ratio if needed
    applyDiagramSize(
      svgElement,
      widthPercent,
      heightPercent,
      maintainAspectRatio
    );

    // Remove transition after zoom
    setTimeout(() => {
      svgElement.style.transition = "";
    }, 200);
  }

  /**
   * Enhanced auto-fit with content-aware scaling
   * @param {HTMLElement} svgElement - The SVG element to resize
   * @param {HTMLElement} container - The container element
   */
  function contentAwareAutoFit(svgElement, container) {
    if (!svgElement) {
      Logger.error("Cannot apply content-aware scaling: SVG element not found");
      return;
    }

    try {
      // Get the natural size of the SVG content
      const viewBox = svgElement.getAttribute("viewBox");
      if (!viewBox) {
        Logger.warn("Cannot apply content-aware scaling: SVG has no viewBox");
        return;
      }

      // Analyse diagram content
      const textElements = svgElement.querySelectorAll("text");
      const nodes = svgElement.querySelectorAll(".node");
      const edges = svgElement.querySelectorAll(".edgePath");

      // Calculate text density (average text length)
      let totalTextLength = 0;
      textElements.forEach((text) => {
        totalTextLength += text.textContent.length;
      });
      const avgTextLength =
        textElements.length > 0 ? totalTextLength / textElements.length : 0;

      // Calculate node density
      const nodeCount = nodes.length;

      // Calculate edge complexity
      const edgeCount = edges.length;
      const edgeDensity = nodeCount > 0 ? edgeCount / nodeCount : 0;

      // Calculate aspect ratio
      const [, , vbWidth, vbHeight] = viewBox.split(" ").map(Number);
      const aspectRatio = vbWidth / vbHeight;

      // Log analysis for debugging
      Logger.debug(`Content analysis:`, {
        nodes: nodeCount,
        edges: edgeCount,
        avgTextLength,
        edgeDensity,
        aspectRatio,
      });

      // Determine optimal scale based on content analysis
      let widthScale, heightScale;

      // Adjust width based on text length and node count
      if (avgTextLength > 20) {
        // Diagrams with long text need more width
        widthScale = 90;
      } else if (nodeCount > 20) {
        // Diagrams with many nodes need more space
        widthScale = 95;
      } else if (edgeDensity > 2) {
        // Diagrams with complex edge relationships need more space
        widthScale = 90;
      } else {
        // Simple diagrams can be smaller
        widthScale = 70;
      }

      // Adjust height based on aspect ratio and node count
      if (aspectRatio < 1) {
        // Tall diagrams need more height
        heightScale = 150;
      } else if (nodeCount > 15) {
        // Diagrams with many nodes need more height
        heightScale = 120;
      } else {
        // Simple diagrams can use default height
        heightScale = 100;
      }

      // Apply the calculated scales
      applyDiagramSize(svgElement, widthScale, heightScale, false);

      // Update slider values
      const widthSlider = container.querySelector(
        `input[id^="mermaid-width-slider"]`
      );
      const heightSlider = container.querySelector(
        `input[id^="mermaid-height-slider"]`
      );
      if (widthSlider) widthSlider.value = widthScale;
      if (heightSlider) heightSlider.value = heightScale;

      // Save preferences
      Utils.savePreference("mermaid-diagram-width", widthScale);
      Utils.savePreference("mermaid-diagram-height", heightScale);

      // Log the content-aware scaling for debugging
      Logger.info(`Content-aware scaling applied:`, {
        widthScale,
        heightScale,
      });

      // Announce to screen readers
      announceToScreenReader("Applied content-aware scaling");

      return { widthScale, heightScale };
    } catch (error) {
      Logger.error("Error in content-aware scaling:", error);
      return null;
    }
  }

  /**
   * Apply responsive scaling based on viewport size
   * @param {HTMLElement} svgElement - The SVG element to resize
   */
  function applyResponsiveScaling(svgElement) {
    if (!svgElement) {
      Logger.error("Cannot apply responsive scaling: SVG element not found");
      return;
    }

    try {
      // Define breakpoints and scales
      const breakpoints = [
        { width: 480, scale: { width: 100, height: 80 } }, // Mobile
        { width: 768, scale: { width: 90, height: 100 } }, // Tablet
        { width: 1024, scale: { width: 80, height: 100 } }, // Small desktop
        { width: 1440, scale: { width: 70, height: 100 } }, // Large desktop
      ];

      // Get viewport width
      const viewportWidth = window.innerWidth;

      // Find appropriate breakpoint
      let scale;
      for (let i = 0; i < breakpoints.length; i++) {
        if (viewportWidth <= breakpoints[i].width) {
          scale = breakpoints[i].scale;
          break;
        }
      }

      // If no breakpoint matched, use the largest one
      if (!scale) {
        scale = breakpoints[breakpoints.length - 1].scale;
      }

      // Apply the responsive scale
      applyDiagramSize(svgElement, scale.width, scale.height, false);

      // Update slider values
      const container = svgElement.closest(".mermaid-container");
      if (container) {
        const widthSlider = container.querySelector(
          `input[id^="mermaid-width-slider"]`
        );
        const heightSlider = container.querySelector(
          `input[id^="mermaid-height-slider"]`
        );
        if (widthSlider) widthSlider.value = scale.width;
        if (heightSlider) heightSlider.value = scale.height;
      }

      // Only log once per container to reduce noise
      const containerId = container ? container.id : "unknown";
      if (!window._responsiveScalingLogged) {
        window._responsiveScalingLogged = {};
      }

      if (!window._responsiveScalingLogged[containerId]) {
        Logger.info(
          `Responsive scaling applied for viewport width ${viewportWidth}px:`,
          scale
        );
        window._responsiveScalingLogged[containerId] = true;

        // Reset the log tracking after a short delay
        setTimeout(() => {
          if (window._responsiveScalingLogged) {
            delete window._responsiveScalingLogged[containerId];
          }
        }, 1000);
      }

      return scale;
    } catch (error) {
      Logger.error("Error in responsive scaling:", error);
      return null;
    }
  }

  /**
   * Apply padding to diagram
   * @param {HTMLElement} svgElement - The SVG element to add padding to
   * @param {number} padding - Padding in pixels
   */
  function applyDiagramPadding(svgElement, padding) {
    if (!svgElement) {
      Logger.error("Cannot apply padding: SVG element not found");
      return;
    }

    try {
      // Apply padding to SVG
      svgElement.style.padding = `${padding}px`;

      // Adjust viewBox if needed
      const viewBox = svgElement.getAttribute("viewBox");
      if (viewBox) {
        const [x, y, width, height] = viewBox.split(" ").map(Number);

        // Store original viewBox if not already stored
        if (!svgElement.hasAttribute("data-original-viewbox")) {
          svgElement.setAttribute("data-original-viewbox", viewBox);
        }

        // Calculate padding as percentage of width/height
        const paddingX = (padding / svgElement.clientWidth) * width;
        const paddingY = (padding / svgElement.clientHeight) * height;

        // Apply new viewBox with padding
        svgElement.setAttribute(
          "viewBox",
          `${x - paddingX} ${y - paddingY} ${width + paddingX * 2} ${
            height + paddingY * 2
          }`
        );
      }

      // Log the padding application for debugging
      Logger.debug(`Applied padding: ${padding}px`);
    } catch (error) {
      Logger.error("Error applying padding:", error);
    }
  }

  /**
   * Scale diagram to fit container
   * @param {HTMLElement} svgElement - The SVG element to resize
   * @param {HTMLElement} container - The container element
   */
  function scaleToContainer(svgElement, container) {
    if (!svgElement || !container) {
      Logger.error("Cannot scale to container: Missing elements");
      return;
    }

    try {
      // Get container dimensions
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Get SVG dimensions
      const svgRect = svgElement.getBoundingClientRect();
      const svgWidth = svgRect.width;
      const svgHeight = svgRect.height;

      // Calculate scale factors
      const widthScale = (containerWidth / svgWidth) * 100;
      const heightScale = (containerHeight / svgHeight) * 100;

      // Use the smaller scale to ensure the diagram fits completely
      const scale = Math.min(widthScale, heightScale) * 0.95; // 95% to add a small margin

      // Apply the scale
      applyDiagramSize(svgElement, scale, null, true);

      // Update slider values
      const widthSlider = container.querySelector(
        `input[id^="mermaid-width-slider"]`
      );
      if (widthSlider) widthSlider.value = scale;

      // Save preference
      Utils.savePreference("mermaid-diagram-width", scale);

      // Log the container scaling for debugging
      Logger.info(`Scaled to container: ${scale}%`);

      // Announce to screen readers
      announceToScreenReader(
        `Scaled diagram to fit container at ${Math.round(scale)}%`
      );

      return scale;
    } catch (error) {
      Logger.error("Error scaling to container:", error);
      return null;
    }
  }

  /**
   * Auto-crop diagram container by adjusting margins and padding
   * @param {HTMLElement} svgElement - The SVG element to analyse
   * @param {HTMLElement} container - The container to adjust
   */
  function autoCropContainer(svgElement, container) {
    if (!svgElement || !container) {
      Logger.error("Cannot auto-crop: Missing elements");
      return;
    }

    try {
      // Find the actual content bounds within the SVG
      const elements = svgElement.querySelectorAll(
        'g[class^="node"], g[class^="cluster"], path'
      );

      if (elements.length === 0) {
        Logger.warn("No elements found for auto-cropping");
        return;
      }

      // Initialise bounds with the first element
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      // Calculate the actual bounds of all content elements
      elements.forEach((element) => {
        const bbox = element.getBBox();
        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.width);
        maxY = Math.max(maxY, bbox.y + bbox.height);
      });

      // Add a small margin (10px) around the content
      const margin = 10;

      // Calculate the content dimensions with margin
      const contentWidth = maxX - minX + margin * 2;
      const contentHeight = maxY - minY + margin * 2;

      // Set the SVG viewBox to focus on the content area
      svgElement.setAttribute(
        "viewBox",
        `${minX - margin} ${minY - margin} ${contentWidth} ${contentHeight}`
      );

      // Store original values to enable resetting
      if (!svgElement.hasAttribute("data-original-viewbox")) {
        const originalViewBox = svgElement.getAttribute("viewBox");
        svgElement.setAttribute("data-original-viewbox", originalViewBox);
      }

      // Adjust the container height to match the content
      const containerWidth = container.clientWidth;
      const aspectRatio = contentWidth / contentHeight;
      const newHeight = containerWidth / aspectRatio;

      // Set a minimum height to avoid too small containers
      const minHeight = 100;
      container.style.height = `${Math.max(newHeight, minHeight)}px`;
      container.style.minHeight = `${minHeight}px`;

      // Add a class to indicate cropping is applied
      container.classList.add("auto-cropped");

      // Log the auto-crop operation
      Logger.info(
        `Auto-cropped container: ${Math.round(contentWidth)}×${Math.round(
          contentHeight
        )}`
      );

      // Announce to screen readers
      announceToScreenReader("Diagram auto-cropped to remove excess space");

      return {
        width: contentWidth,
        height: contentHeight,
      };
    } catch (error) {
      Logger.error("Error auto-cropping container:", error);
      return null;
    }
  }

  /**
   * Reset auto-cropping to original view
   * @param {HTMLElement} svgElement - The SVG element to reset
   * @param {HTMLElement} container - The container to adjust
   */
  function resetAutoCrop(svgElement, container) {
    if (!svgElement || !container) {
      Logger.error("Cannot reset auto-crop: Missing elements");
      return;
    }

    try {
      // Check if original viewBox exists
      const originalViewBox = svgElement.getAttribute("data-original-viewbox");
      if (originalViewBox) {
        // Restore original viewBox
        svgElement.setAttribute("viewBox", originalViewBox);
      }

      // Remove height constraint from container
      container.style.height = "";
      container.style.minHeight = "";

      // Remove auto-cropped class
      container.classList.remove("auto-cropped");

      // Announce to screen readers
      announceToScreenReader("Auto-crop has been reset");

      Logger.info("Auto-crop reset");
    } catch (error) {
      Logger.error("Error resetting auto-crop:", error);
    }
  }

  /**
   * Add these debugging functions to the public API
   */
  const DebugUtils = {
    /**
     * List all current diagrams with their identifiers and status
     */
    listDiagrams: function () {
      const containers = document.querySelectorAll(".mermaid-container");
      console.group("📊 Current Mermaid Diagrams");

      containers.forEach((container, index) => {
        const id = getDiagramIdentifier(container, index);
        const summary = getDiagramSummary(container);
        const svgElement = container.querySelector("svg");

        console.log(`${index + 1}. ${id}`, {
          type: summary.type,
          nodes: summary.nodes,
          hasControls: summary.hasControls,
          hasSvg: !!svgElement,
          element: container,
        });
      });

      console.groupEnd();
    },

    /**
     * Enable verbose logging for debugging
     */
    enableVerboseLogging: function () {
      Logger.setLevel(LOG_LEVELS.DEBUG);
      Logger.info("Verbose logging enabled");
    },

    /**
     * Disable verbose logging
     */
    disableVerboseLogging: function () {
      Logger.setLevel(LOG_LEVELS.INFO);
      Logger.info("Verbose logging disabled");
    },
  };

  // Public API
  return {
    init: init,
    initWithLazyLoading: initWithLazyLoading,
    addControlsToContainer: addControlsToContainer,
    announceToScreenReader: announceToScreenReader,
    applyDiagramSize: applyDiagramSize,
    autoFitDiagram: autoFitDiagram,
    estimateDiagramComplexity: estimateDiagramComplexity,
    detectOrientation: detectOrientation,
    updateOrientation: updateOrientation,
    supportsOrientation: supportsOrientation,
    applyZoom: applyZoom,
    contentAwareAutoFit: contentAwareAutoFit,
    applyResponsiveScaling: applyResponsiveScaling,
    applyDiagramPadding: applyDiagramPadding,
    scaleToContainer: scaleToContainer,
    autoCropContainer: autoCropContainer,
    resetAutoCrop: resetAutoCrop,
    // Enhanced utilities
    getDiagramIdentifier: getDiagramIdentifier,
    getDiagramSummary: getDiagramSummary,
    DiagramLogger: DiagramLogger,
    DebugUtils: DebugUtils,
    utils: Utils,
    // Expose logging functionality
    Logger: Logger,
    LOG_LEVELS: LOG_LEVELS,
    setLogLevel: function (level) {
      Logger.setLevel(level);
    },
    getLogLevel: function () {
      return Logger.getLevel();
    },
  };
})();

// Add window resize listener for responsive diagrams
const debounce = (func, delay) => {
  let debounceTimer;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(context, args), delay);
  };
};

window.addEventListener(
  "resize",
  debounce(function () {
    // Check if responsive mode is enabled
    const responsiveEnabled = window.MermaidControls.utils.getSavedPreference(
      "mermaid-responsive-enabled",
      false
    );
    if (responsiveEnabled === "true" || responsiveEnabled === true) {
      // Apply responsive scaling to all diagrams
      document.querySelectorAll(".mermaid-container svg").forEach((svg) => {
        window.MermaidControls.applyResponsiveScaling(svg);
      });
    }
  }, 200)
);

// Initialise when DOM is fully loaded
document.addEventListener("DOMContentLoaded", function () {
  // Initialise for existing diagrams
  if (typeof window.MermaidControls !== "undefined") {
    // Fix for height issue - run once on page load
    document.querySelectorAll(".mermaid-container svg").forEach((svg) => {
      svg.style.height = "auto";
      svg.style.maxHeight = "none";
    });
    // Use lazy loading initialisation for better performance
    window.MermaidControls.initWithLazyLoading();

    // Also observe changes to handle dynamically added diagrams
    const observer = new MutationObserver(function (mutations) {
      let newDiagramsFound = false;

      // Process mutations to find new diagrams
      mutations.forEach(function (mutation) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) {
              // Element node
              // Check if this is a mermaid container or contains one
              if (
                node.classList &&
                node.classList.contains("mermaid-container") &&
                !node.querySelector(
                  "." +
                    window.MermaidControls.utils.getSavedPreference(
                      "controlsContainerClass",
                      "mermaid-controls"
                    )
                )
              ) {
                newDiagramsFound = true;
              } else {
                // Check for mermaid containers inside this node - using cross-browser compatible approach
                const containersWithoutControls =
                  window.MermaidControls.utils.findContainersWithoutControls(
                    node
                  );
                if (containersWithoutControls.length > 0) {
                  newDiagramsFound = true;
                }
              }
            }
          });
        }
      });

      // Only initialise if new diagrams without controls were found
      if (newDiagramsFound) {
        window.MermaidControls.Logger.info(
          "New diagrams detected, initialising controls"
        );
        window.MermaidControls.initWithLazyLoading(document);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Log initialisation
    window.MermaidControls.Logger.info(
      "Mermaid Controls initialised successfully"
    );
  } else {
    console.warn(
      "[Mermaid Controls] MermaidControls not found. Make sure mermaid-controls.js is loaded."
    );
  }
});
