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

  // F22, Matthew's ruling of 28 September 2026 (register item 94): a
  // diagram's smallest text is never drawn below this size. A diagram whose
  // text would be is drawn wider instead, and its box scrolls sideways.
  const MIN_DIAGRAM_TEXT_PX = 10;

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
    lockAspectRatioDefault: false, // Default for the stored aspect-ratio lock
    // Orientation control properties
    orientationLabelText: "Orientation:", // Text for orientation label
    orientationOptions: [
      { value: "TB", text: "Top to Bottom" },
      { value: "BT", text: "Bottom to Top" },
      { value: "LR", text: "Left to Right" },
      { value: "RL", text: "Right to Left" },
    ],
    defaultOrientation: "TB", // Default orientation
    autoFitOnLoadDefault: false, // Default for the stored auto-fit-on-load preference
    // Control order: "row" is the toolbar row, "order" the position within
    // it, and "visible: false" leaves a control out. The orientation group is
    // the only control built here now (parcel 2, F5); the row machinery stays
    // because mermaid-theme.js appends its theme picker as a second row of
    // the same .sliders-container.
    controlOrder: {
      orientation: { order: 1, row: 1, visible: true },
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
    // Attach the view controls (width, full screen) first, above the early
    // return: every render site calls this on the live, connected figure
    // after its render resolves, including the bridge's markup copy, which
    // arrives already carrying its toolbars. Resolved off window at call time
    // because mermaid-view-controls.js loads after this file; attach is
    // idempotent on the node.
    const viewControls = window.MermaidViewControls;
    if (viewControls && typeof viewControls.attach === "function") {
      viewControls.attach(container);
    }

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
    // The orientation group and the three export buttons. A further fifteen
    // controls (size sliders, presets, zoom, fit, auto-fit, responsive,
    // padding, crop) were built here with listeners and never shown; they
    // were deleted in parcel 2 (F5). The stored preferences they wrote are
    // still honoured below, in reapplyAfterRender and by the resize listener.

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
      orientation: {
        element: orientationGroup,
        config: config.controlOrder.orientation,
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

                // A fresh SVG has landed. Encoding and size are re-applied
                // through the one named after-render step, so this site does
                // not carry its own copy of the list — see reapplyAfterRender
                // above.
                //
                // This handler is bound only when supportsOrientation() is
                // true, which admits graph and flowchart and nothing else, so
                // an XYCHART CAN NEVER REACH THIS SITE. An earlier comment
                // here warned that an orientation change silently drops every
                // pattern and dash; measured 26 August 2026, that gesture does
                // not exist. The helper call serves the types that can
                // actually flip, and names the invariant for all of them.
                reapplyAfterRender(container, element, { index: index });
              }
            })
            .catch((error) => {
              Logger.error("Failed to re-render diagram:", error);
              announceToScreenReader("Failed to update diagram orientation");
            });
        }
      });
    }

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

    // Apply the stored width and height to the first-paint SVG. The hidden
    // size controls that used to read these three preferences were deleted
    // in parcel 2 (F5); the keys, defaults and boolean test are theirs,
    // unchanged, so a browser that stored a size is sized exactly as before.
    // (applyTheme's re-render replaces this SVG, and reapplyAfterRender puts
    // the same values on the replacement.)
    const savedWidth = Utils.getSavedPreference(
      "mermaid-diagram-width",
      config.defaultWidth
    );
    const savedHeight = Utils.getSavedPreference(
      "mermaid-diagram-height",
      config.defaultHeight
    );
    const lockAspectRatio = Utils.getSavedPreference(
      "mermaid-lock-aspect-ratio",
      config.lockAspectRatioDefault
    );
    const svgElement = container.querySelector("svg");
    if (svgElement) {
      applyDiagramSize(
        svgElement,
        savedWidth,
        savedHeight,
        lockAspectRatio === "true" || lockAspectRatio === true
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
  /**
   * Re-apply everything we know about a diagram after a fresh SVG has landed.
   *
   * THE NAMED AFTER-RENDER INVARIANT. Every render replaces the SVG
   * wholesale, so anything written onto the previous SVG is gone. Before this
   * helper existed, four render sites re-applied overlapping subsets by three
   * different routes — an internal call, an external call, and an incidental
   * side effect of adding a theme selector — and nothing named the invariant,
   * so nothing could check it. Register item 56 was opened against a coverage
   * gap that did not exist, precisely because the routes were not legible.
   *
   * The payload is SERIES ENCODING, SIZE and the ACCESSIBILITY WIRING.
   * Rebuilding the controls and INITIALISING the accessibility features stay
   * with their callers, because those two are not "re-apply what we knew" —
   * they are per-site lifecycle decisions, and the retry path in particular
   * removes and rebuilds them on purpose.
   *
   * THE THIRD MEMBER REVISITS AN EARLIER RULING, deliberately and on evidence.
   * When this helper was written the payload was encoding and size only, and
   * the accessibility wiring was left with the callers on the reasoning above.
   * Register item 61 then measured what that costs: a theme change replaced
   * the SVG and the diagram's accessible name went with it, on every render
   * path, in every mode. The distinction that survives is between INITIALISING
   * the accessibility features — running a generator, building the figure,
   * figcaption and toggle button, which is still a caller's lifecycle
   * decision — and RE-APPLYING the two attributes we already hold, which is
   * exactly what this helper is for. Only the second is done here.
   *
   * IT MUST NEVER CALL applyTheme. One of its consumers is applyTheme's own
   * .then, so a helper that re-entered applyTheme would loop the render.
   *
   * Cross-module handles are resolved off `window` at CALL time and guarded
   * with `typeof`, never captured in a module-scope const — the load order
   * does not guarantee MermaidThemes exists when this file is evaluated.
   *
   * @param {HTMLElement} container - The .mermaid-container element
   * @param {HTMLElement} mermaidDiv - The .mermaid div whose innerHTML was just replaced
   * @param {Object} [options] - Options
   * @param {string|number} [options.index] - The diagram index, for logging only
   * @returns {Object} What was applied, for probes and callers that want to
   *   assert — `{ encoding, size, a11y }`. The first two record that the call
   *   was made; `a11y` is read back off the SVG and records that the write
   *   LANDED, so the three are not equally strong and must not be read as if
   *   they were. See item 58's note in docs/mermaid-outstanding.md.
   */
  function reapplyAfterRender(container, mermaidDiv, options) {
    const opts = options || {};
    const applied = { encoding: false, size: false, a11y: false };

    if (!mermaidDiv) {
      Logger.warn("reapplyAfterRender: no mermaid div provided");
      return applied;
    }

    // 1. Non-colour series encoding — patterns and dashes for xychart.
    // A no-op for every other diagram type. Resolved off window at call
    // time; MermaidThemes may legitimately be absent.
    if (
      window.MermaidThemes &&
      typeof window.MermaidThemes.applySeriesEncoding === "function"
    ) {
      window.MermaidThemes.applySeriesEncoding(mermaidDiv);
      applied.encoding = true;
    }

    // 2. Size, from the stored preferences. This is the step that sets the
    // size on the SVG a user finally sees: applyTheme's re-render replaces
    // the first-paint SVG and then calls this helper (measured, parcel 2 step
    // 0). Hidden size sliders once took precedence here; they were never
    // shown and were deleted in parcel 2 (F5), so a browser that stored a
    // size still gets it and one that did not gets the defaults.
    const svgElement = mermaidDiv.querySelector("svg");
    if (svgElement) {
      const width = Utils.getSavedPreference(
        "mermaid-diagram-width",
        config.defaultWidth
      );
      const height = Utils.getSavedPreference(
        "mermaid-diagram-height",
        config.defaultHeight
      );
      const savedLock = Utils.getSavedPreference(
        "mermaid-lock-aspect-ratio",
        config.lockAspectRatioDefault
      );
      const locked = savedLock === "true" || savedLock === true;

      applyDiagramSize(svgElement, width, height, locked);
      applied.size = true;
    }

    // 3. Accessibility wiring — the diagram's accessible name, and the tie to
    // its caption. Both are written onto the SVG by initAccessibilityFeatures
    // and both die with it on every re-render; the container outlives the SVG
    // and holds each value already, so this is a restore, not a regeneration.
    //
    // The name is used VERBATIM. It is the plain short tier — an author's own
    // accTitle where there is one — and aria-label is an attribute sink, so
    // escaping it would put entities into what a screen reader speaks.
    //
    // Absent dataset entries mean the accessibility features have not
    // initialised on this container yet, which is the ordinary case on a first
    // render. Nothing is written then, so a placeholder label set by the
    // render site itself is left alone rather than overwritten with nothing.
    const accessibleName = container
      ? container.dataset.svgAccessibleName
      : undefined;

    if (svgElement && accessibleName) {
      svgElement.setAttribute("aria-label", accessibleName);

      const figcaptionId = container.dataset.figcaptionId;
      if (figcaptionId) {
        svgElement.setAttribute("aria-describedby", figcaptionId);
      }

      // Read the attribute back rather than reporting success from having
      // called the setter — item 58's note, which caught a size block that
      // logged success on a path where nothing was written. Unlike its two
      // siblings above, this flag is VERIFIED rather than optimistic.
      applied.a11y =
        svgElement.getAttribute("aria-label") === accessibleName &&
        (!figcaptionId ||
          svgElement.getAttribute("aria-describedby") === figcaptionId);

      if (!applied.a11y) {
        Logger.debug(
          `reapplyAfterRender: accessibility wiring did not take on diagram ${
            opts.index !== undefined ? opts.index : "(unindexed)"
          }`
        );
      }
    }

    Logger.debug(
      `reapplyAfterRender: diagram ${
        opts.index !== undefined ? opts.index : "(unindexed)"
      } — encoding ${applied.encoding ? "applied" : "unavailable"}, size ${
        applied.size ? "applied" : "no SVG"
      }, accessibility wiring ${
        applied.a11y ? "re-applied" : "not stored yet"
      }`
    );

    return applied;
  }

  // ===============================================
  // NATURAL SIZE AND THE TEXT FLOOR (parcel 9d, F22)
  // ===============================================

  /**
   * True when a size argument is the caller's default rather than a stored
   * preference. Every caller reads the key through getSavedPreference with the
   * default as its fallback, so the two arrive looking alike; the key's
   * absence is what tells them apart. Decided here, not at each call, because
   * two of the four callers (markdown-editor.js, mermaid-accessibility-core.js)
   * pass the default as a literal.
   * @param {string} key - The localStorage key the caller read
   * @param {*} value - The value the caller passed
   * @param {number} defaultValue - The default for that key
   * @returns {boolean}
   */
  function isUnstoredDefault(key, value, defaultValue) {
    return (
      Utils.getSavedPreference(key, null) === null &&
      Number(value) === defaultValue
    );
  }

  /**
   * A diagram's natural width: one viewBox unit to one CSS pixel.
   * @param {SVGSVGElement} svgElement
   * @returns {number|null} Null for an SVG with no usable viewBox
   */
  function getNaturalWidth(svgElement) {
    const viewBox = svgElement.viewBox && svgElement.viewBox.baseVal;
    return viewBox && viewBox.width > 0 ? viewBox.width : null;
  }

  /**
   * The diagram's smallest rendered text, in the SVG root's user units: each
   * item's computed font-size times its on-screen scale (parcel 9c's method
   * A; an HTML label takes its foreignObject's scale), divided by the root's
   * own scale, so the answer does not depend on how wide the SVG is drawn now.
   * @param {SVGSVGElement} svgElement - Attached and laid out
   * @returns {number|null} Null when nothing measurable is rendered
   */
  function getSmallestTextUserUnits(svgElement) {
    const rootMatrix = svgElement.getScreenCTM();
    const rootScale = rootMatrix ? Math.hypot(rootMatrix.a, rootMatrix.b) : 0;
    if (!rootScale) return null;

    const hasOwnText = (el) =>
      Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim()
      );
    let smallest = null;
    const measure = (el, scaleSource) => {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const matrix = scaleSource.getScreenCTM();
      if (!matrix) return;
      const px = parseFloat(style.fontSize) * Math.hypot(matrix.a, matrix.b);
      if (px > 0 && (smallest === null || px < smallest)) smallest = px;
    };

    svgElement.querySelectorAll("text").forEach((text) => {
      if (!text.textContent.trim()) return;
      const tspans = Array.from(text.querySelectorAll("tspan")).filter(
        hasOwnText
      );
      const units = hasOwnText(text)
        ? [text, ...tspans]
        : tspans.length
        ? tspans
        : [text];
      units.forEach((unit) => measure(unit, unit));
    });
    svgElement.querySelectorAll("foreignObject").forEach((foreignObject) => {
      foreignObject.querySelectorAll("*").forEach((el) => {
        if (hasOwnText(el)) measure(el, foreignObject);
      });
    });

    return smallest === null ? null : smallest / rootScale;
  }

  /**
   * The width at which the diagram's smallest text is drawn at
   * MIN_DIAGRAM_TEXT_PX, rounded up so rounding cannot land it below.
   * @param {SVGSVGElement} svgElement
   * @param {number|null} naturalWidth
   * @returns {number|null}
   */
  function getFloorWidth(svgElement, naturalWidth) {
    if (!naturalWidth) return null;
    const smallest = getSmallestTextUserUnits(svgElement);
    return smallest
      ? Math.ceil((naturalWidth * MIN_DIAGRAM_TEXT_PX) / smallest)
      : null;
  }

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

      // F22 (parcel 9d). With no stored width the diagram is drawn at its
      // natural width, shrunk to its box when wider; a stored width keeps its
      // percentage exactly as before. Either way it is never drawn narrower
      // than the width that gives its smallest text MIN_DIAGRAM_TEXT_PX.
      // min-width beats max-width, so such a diagram overflows its .mermaid
      // box, which scrolls (mermaid-controls.css). The floor is written
      // whenever it can be measured, not only when it bites today: the box
      // changes with Expand Width, the window and the export's column, and a
      // min-width below the drawn width is inert.
      const naturalWidth = getNaturalWidth(svgElement);
      const drawNatural =
        naturalWidth !== null &&
        isUnstoredDefault(
          "mermaid-diagram-width",
          widthPercent,
          config.defaultWidth
        );
      if (drawNatural) {
        svgElement.style.width = `${naturalWidth}px`;
        svgElement.style.maxWidth = "100%";
      } else {
        svgElement.style.width = `${widthPercent}%`;
        svgElement.style.maxWidth = `${widthPercent}%`;
      }
      const floorWidth = getFloorWidth(svgElement, naturalWidth);
      if (floorWidth !== null) {
        svgElement.style.minWidth = `${floorWidth}px`;
      } else {
        svgElement.style.removeProperty("min-width");
      }

      // With no stored height the height follows the width. A pixel height
      // written here is released on the page by mermaid-controls.css
      // (height: auto !important), but the export carries no such rule, so
      // it held diagrams at their natural height there (parcel 9c).
      if (
        heightPercent !== null &&
        isUnstoredDefault(
          "mermaid-diagram-height",
          heightPercent,
          config.defaultHeight
        )
      ) {
        heightPercent = null;
      }

      // Handle height based on parameters
      if (heightPercent !== null) {
        if (maintainAspectRatio && aspectRatio) {
          // Calculate height based on width to maintain aspect ratio
          const containerWidth = container
            ? container.clientWidth
            : originalWidth;
          const targetWidth = drawNatural
            ? Math.min(naturalWidth, containerWidth)
            : (containerWidth * widthPercent) / 100;
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
            width: drawNatural ? `${naturalWidth}px` : `${widthPercent}%`,
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
          `Successfully resized ${diagramId}: ${drawNatural ? `${naturalWidth}px (natural)` : `${widthPercent}%`} × ${heightDisplay}${
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
    addControlsToContainer: addControlsToContainer,
    announceToScreenReader: announceToScreenReader,
    applyDiagramSize: applyDiagramSize,
    reapplyAfterRender: reapplyAfterRender,
    autoFitDiagram: autoFitDiagram,
    estimateDiagramComplexity: estimateDiagramComplexity,
    detectOrientation: detectOrientation,
    updateOrientation: updateOrientation,
    supportsOrientation: supportsOrientation,
    applyResponsiveScaling: applyResponsiveScaling,
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
