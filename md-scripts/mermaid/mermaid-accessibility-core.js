// Enhanced mermaid-accessibility-core.js with retry logic and error recovery

window.MermaidAccessibility = (function () {
  "use strict";

  // Logging configuration
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
  let enableAllLogging = ENABLE_ALL_LOGGING;
  let disableAllLogging = DISABLE_ALL_LOGGING;

  function shouldLog(level) {
    if (disableAllLogging) return false;
    if (enableAllLogging) return true;
    return level <= currentLogLevel;
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

  // Logging control methods
  function setLogLevel(level) {
    if (typeof level === "string") {
      const levelNames = ["ERROR", "WARN", "INFO", "DEBUG"];
      const levelIndex = levelNames.indexOf(level.toUpperCase());
      level = levelIndex !== -1 ? levelIndex : DEFAULT_LOG_LEVEL;
    }
    currentLogLevel = level;
    const levelNames = ["ERROR", "WARN", "INFO", "DEBUG"];
    logInfo(
      `[Mermaid Accessibility] Log level set to: ${
        levelNames[level] || "UNKNOWN"
      }`
    );
  }

  function getLogLevelName(level) {
    const names = ["ERROR", "WARN", "INFO", "DEBUG"];
    return names[level] || "UNKNOWN";
  }

  function enableAllLog() {
    enableAllLogging = true;
    disableAllLogging = false;
    logInfo("[Mermaid Accessibility] All logging enabled");
  }

  function disableAllLog() {
    disableAllLogging = true;
    enableAllLogging = false;
    console.log("[Mermaid Accessibility] All logging disabled");
  }

  function resetLogging() {
    currentLogLevel = DEFAULT_LOG_LEVEL;
    enableAllLogging = ENABLE_ALL_LOGGING;
    disableAllLogging = DISABLE_ALL_LOGGING;
    logInfo("[Mermaid Accessibility] Logging reset to default configuration");
  }

  // Aliases for brevity
  const Utils = window.MermaidAccessibilityUtils;

  // Configuration options (ENHANCED with retry settings)
  const config = {
    buttonClasses: "mermaid-control-button",
    showDescriptionText: "Show Description",
    hideDescriptionText: "Hide Description",
    ariaLiveRegionId: "mermaid-sr-announcer",
    descriptionClass: "mermaid-description",
    detailsClass: "mermaid-details",
    captionsVisibleByDefault: true,
    // Maximum number of actors to list in sequence diagram descriptions
    maxActors: 5,
    // NEW: Retry and error recovery settings
    enableRetryButtons: true, // Global flag for retry buttons
    enableSyntaxFix: true, // Enable automatic syntax fix attempts
    retryButtonMode: "single", // "single" or "full" or "both" - configurable retry mode
    retrySchedule: [100, 300, 1000, 3000], // Exponential backoff schedule in ms
    maxRetryAttempts: 4,
    retryTimeout: 10000, // Maximum time to wait for SVG (10 seconds)
    // Description templates
    descriptionTemplates: {
      flowchart: "Flowchart showing {title}.",
      sequenceDiagram: "Sequence diagram showing interaction between {actors}.",
      classDiagram: "Class diagram showing relationships between classes.",
      stateDiagram: "State diagram showing possible states and transitions.",
      entityRelationshipDiagram:
        "Entity relationship diagram showing database structure.",
      userJourney:
        "User journey showing steps a user takes to accomplish a task.",
      gantt: "Gantt chart showing project timeline and tasks.",
      pieChart: "Pie chart showing distribution of {title}.",
      mindmap: "Mind map showing hierarchical relationships for {title}.",
      timeline: "Timeline showing events in chronological order.",
      gitGraph: "Git graph showing commit history and branching strategy.",
      sankey:
        "Sankey diagram showing flow between nodes, with width representing quantity.",
      quadrantChart:
        "Quadrant chart showing items plotted across two dimensions.",
    },
  };

  // Store for retry attempts and timers
  const retryStore = new Map();

  // Description generators storage
  const descriptionGenerators = {};

  /**
   * Register a description generator for a specific diagram type
   * @param {string} diagramType - The type of diagram
   * @param {Object} generator - Object with generateShort and generateDetailed methods
   */
  function registerDescriptionGenerator(diagramType, generator) {
    if (!diagramType || !generator) {
      logError("[Mermaid Accessibility] Invalid registration attempt");
      return;
    }

    // Validate that the generator has the required methods
    if (
      typeof generator.generateShort !== "function" ||
      typeof generator.generateDetailed !== "function"
    ) {
      logError(
        `[Mermaid Accessibility] Invalid generator for ${diagramType}. Missing required methods.`
      );
      return;
    }

    // Store the generator
    descriptionGenerators[diagramType] = generator;
    logInfo(
      `[Mermaid Accessibility] Registered description generator for ${diagramType}`
    );
  }

  /**
   * Analyze error to determine if it's a syntax error or rendering issue
   * @param {Error} error - The error object
   * @returns {Object} Analysis of the error type
   */
  function analyzeError(error) {
    const errorMessage = error.message.toLowerCase();

    // Check for common syntax errors
    const syntaxErrorPatterns = [
      /parse error/i,
      /expecting.*got/i,
      /unexpected.*token/i,
      /invalid.*syntax/i,
      /colon/i,
      /semi/i,
      /newline/i,
    ];

    const isSyntaxError = syntaxErrorPatterns.some((pattern) =>
      pattern.test(errorMessage)
    );

    return {
      isSyntaxError,
      isRenderingIssue: !isSyntaxError,
      originalMessage: error.message,
      userFriendlyMessage: isSyntaxError
        ? "Invalid Mermaid syntax detected"
        : "Diagram rendering failed",
    };
  }

  /**
   * Attempt to fix common Mermaid syntax issues
   * @param {string} diagramCode - The original mermaid code
   * @returns {string} Potentially fixed mermaid code
   */
  function attemptSyntaxFix(diagramCode) {
    let fixedCode = diagramCode;

    // Fix 1: Remove colons after arrows (common LLM mistake)
    // A[Start] --> B[Define objective]: Description
    // becomes: A[Start] --> B[Define objective]
    fixedCode = fixedCode.replace(/(\s*-->\s*[^:\n]+):\s*[^\n]*/g, "$1");

    // Fix 2: Remove other colon-based descriptions
    fixedCode = fixedCode.replace(/(\]\s*):\s*[^\n]*/g, "$1");

    // Fix 3: Ensure proper line endings
    fixedCode = fixedCode.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    return fixedCode;
  }

  /**
   * Initialize all control systems for a mermaid container
   * @param {HTMLElement} container - The diagram container
   * @param {string} diagramId - Unique identifier for the diagram
   */
  function initializeAllControls(container, diagramId) {
    logInfo(
      `[Mermaid Accessibility] Initializing all controls for diagram ${diagramId}`
    );

    // Extract index from diagram ID for compatibility
    const index = diagramId.split("-").pop() || "0";

    // 1. Initialize Mermaid Controls (theme, copy, save buttons)
    if (
      window.MermaidControls &&
      typeof window.MermaidControls.addControlsToContainer === "function"
    ) {
      try {
        window.MermaidControls.addControlsToContainer(container, index);
        logInfo(
          `[Mermaid Accessibility] Mermaid controls added for diagram ${diagramId}`
        );
      } catch (error) {
        logError(
          `[Mermaid Accessibility] Error adding mermaid controls for diagram ${diagramId}:`,
          error
        );
      }
    }

    // 2. Initialize View Controls (expand width, fullscreen)
    if (
      window.MermaidViewControls &&
      typeof window.MermaidViewControls.init === "function"
    ) {
      try {
        // Remove view-controls-added class to allow re-initialization
        container.classList.remove("view-controls-added");
        window.MermaidViewControls.init(container);
        logInfo(
          `[Mermaid Accessibility] View controls added for diagram ${diagramId}`
        );
      } catch (error) {
        logError(
          `[Mermaid Accessibility] Error adding view controls for diagram ${diagramId}:`,
          error
        );
      }
    }

    // 3. Initialize Pan & Zoom Controls
    if (
      window.MermaidPanZoom &&
      typeof window.MermaidPanZoom.activateForContainer === "function"
    ) {
      try {
        window.MermaidPanZoom.activateForContainer(container);
        logInfo(
          `[Mermaid Accessibility] Pan & zoom controls added for diagram ${diagramId}`
        );
      } catch (error) {
        logError(
          `[Mermaid Accessibility] Error adding pan & zoom controls for diagram ${diagramId}:`,
          error
        );
      }
    }

    // 4. Apply saved diagram size preferences if available
    if (
      window.MermaidControls &&
      typeof window.MermaidControls.utils === "object"
    ) {
      try {
        const svgElement = container.querySelector("svg");
        if (svgElement) {
          const savedWidth = window.MermaidControls.utils.getSavedPreference(
            "mermaid-diagram-width",
            70
          );
          const savedHeight = window.MermaidControls.utils.getSavedPreference(
            "mermaid-diagram-height",
            100
          );
          const lockAspectRatio =
            window.MermaidControls.utils.getSavedPreference(
              "mermaid-lock-aspect-ratio",
              false
            );

          if (typeof window.MermaidControls.applyDiagramSize === "function") {
            window.MermaidControls.applyDiagramSize(
              svgElement,
              savedWidth,
              savedHeight,
              lockAspectRatio === "true" || lockAspectRatio === true
            );
            logInfo(
              `[Mermaid Accessibility] Applied saved size preferences for diagram ${diagramId}`
            );
          }
        }
      } catch (error) {
        logError(
          `[Mermaid Accessibility] Error applying saved preferences for diagram ${diagramId}:`,
          error
        );
      }
    }
  }

  /**
   * Enhanced retry logic for SVG detection with exponential backoff
   * @param {HTMLElement} container - The diagram container
   * @param {HTMLElement} mermaidDiv - The mermaid div element
   * @param {string} diagramId - Unique identifier for the diagram
   * @param {string} diagramCode - The original mermaid code
   * @returns {Promise<HTMLElement|null>} Promise that resolves to SVG element or null
   */
  async function waitForSVGWithRetry(
    container,
    mermaidDiv,
    diagramId,
    diagramCode
  ) {
    const retryKey = `${diagramId}-retry`;

    // Check if we're already retrying this diagram
    if (retryStore.has(retryKey)) {
      logInfo(
        `[Mermaid Accessibility] Already retrying diagram ${diagramId}, skipping duplicate attempt`
      );
      return null;
    }

    // Store retry state
    retryStore.set(retryKey, {
      attempts: 0,
      startTime: Date.now(),
      container,
      mermaidDiv,
      diagramCode,
    });

    const startTime = Date.now();
    let attempts = 0;

    for (const delay of config.retrySchedule) {
      // Check if we've exceeded timeout
      if (Date.now() - startTime > config.retryTimeout) {
        logWarn(
          `[Mermaid Accessibility] Timeout reached for diagram ${diagramId} after ${
            Date.now() - startTime
          }ms`
        );
        break;
      }

      // Wait for the specified delay
      await new Promise((resolve) => setTimeout(resolve, delay));

      attempts++;
      const retryState = retryStore.get(retryKey);
      if (retryState) {
        retryState.attempts = attempts;
      }

      logInfo(
        `[Mermaid Accessibility] Retry attempt ${attempts} for diagram ${diagramId} after ${delay}ms delay`
      );

      // Check for SVG element
      const svgElement = mermaidDiv.querySelector("svg");
      if (svgElement) {
        const dimensions = {
          width: svgElement.width?.baseVal?.value || "unknown",
          height: svgElement.height?.baseVal?.value || "unknown",
        };

        logInfo(
          `[Mermaid Accessibility] SVG found on attempt ${attempts} for diagram ${diagramId} with dimensions: ${dimensions.width} x ${dimensions.height}`
        );

        // Clean up retry state
        retryStore.delete(retryKey);
        return svgElement;
      }

      logInfo(
        `[Mermaid Accessibility] Attempt ${attempts} failed for diagram ${diagramId}, SVG not yet available`
      );
    }

    // All retries failed
    logWarn(
      `[Mermaid Accessibility] All ${attempts} retry attempts failed for diagram ${diagramId}`
    );

    // Clean up retry state
    retryStore.delete(retryKey);
    return null;
  }

  /**
   * Create retry button for failed diagrams
   * @param {HTMLElement} container - The diagram container
   * @param {string} diagramId - Unique identifier for the diagram
   * @param {string} diagramCode - The original mermaid code
   * @param {string} mode - "single" or "full" retry mode
   * @returns {HTMLElement} The retry button element
   */
  function createRetryButton(
    container,
    diagramId,
    diagramCode,
    mode = "single"
  ) {
    const button = document.createElement("button");
    button.id = `mermaid-retry-${diagramId}`;
    button.className = "mermaid-retry-button";

    if (mode === "full") {
      button.textContent = "Re-render entire content";
      button.setAttribute(
        "aria-label",
        "Re-render all content using markdown editor pipeline"
      );
    } else {
      button.textContent = "Retry diagram";
      button.setAttribute("aria-label", `Retry rendering diagram ${diagramId}`);
    }

    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = mode === "full" ? "Re-rendering..." : "Retrying...";

      try {
        if (mode === "full") {
          await retryFullContentRender(container, diagramId);
        } else {
          await retrySingleDiagram(container, diagramId, diagramCode);
        }
      } catch (error) {
        logError(
          `[Mermaid Accessibility] Retry failed for diagram ${diagramId}:`,
          error
        );
        button.textContent = "Retry failed";
        button.setAttribute(
          "aria-label",
          `Retry failed for diagram ${diagramId}`
        );
      }
    });

    return button;
  }

  /**
   * Create fix syntax button for diagrams with syntax errors
   * @param {HTMLElement} container - The diagram container
   * @param {string} diagramId - Unique identifier for the diagram
   * @param {string} diagramCode - The original mermaid code
   * @returns {HTMLElement} The fix syntax button element
   */
  function createFixSyntaxButton(container, diagramId, diagramCode) {
    const button = document.createElement("button");
    button.id = `mermaid-fix-syntax-${diagramId}`;
    button.className = "mermaid-fix-syntax-button";
    button.textContent = "Try syntax fix";
    button.setAttribute(
      "aria-label",
      `Attempt to fix syntax errors in diagram ${diagramId}`
    );
    button.style.marginRight = "0.5em";

    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Fixing syntax...";

      try {
        const fixedCode = attemptSyntaxFix(diagramCode);

        // Show what was changed
        if (fixedCode !== diagramCode) {
          logInfo(
            `[Mermaid Accessibility] Attempting syntax fix for diagram ${diagramId}`
          );
          logInfo(
            `[Mermaid Accessibility] Original code length: ${diagramCode.length}, Fixed code length: ${fixedCode.length}`
          );

          // Update the container's data attribute with fixed code
          container.setAttribute(
            "data-diagram-code",
            encodeURIComponent(fixedCode)
          );

          // Try to render with fixed code
          await retrySingleDiagram(container, diagramId, fixedCode);
        } else {
          // No changes made
          button.textContent = "No fixes available";
          button.setAttribute(
            "aria-label",
            `No automatic fixes available for diagram ${diagramId}`
          );
          logWarn(
            `[Mermaid Accessibility] No syntax fixes could be applied to diagram ${diagramId}`
          );
        }
      } catch (error) {
        logError(
          `[Mermaid Accessibility] Syntax fix failed for diagram ${diagramId}:`,
          error
        );
        button.textContent = "Fix failed";
        button.setAttribute(
          "aria-label",
          `Syntax fix failed for diagram ${diagramId}`
        );
      }
    });

    return button;
  }

  /**
   * Retry rendering a single diagram
   * @param {HTMLElement} container - The diagram container
   * @param {string} diagramId - Unique identifier for the diagram
   * @param {string} diagramCode - The original mermaid code
   */
  async function retrySingleDiagram(container, diagramId, diagramCode) {
    logInfo(`[Mermaid Accessibility] Retrying single diagram ${diagramId}`);

    const mermaidDiv = container.querySelector(".mermaid");
    if (!mermaidDiv) {
      logError(
        `[Mermaid Accessibility] No mermaid div found for retry of diagram ${diagramId}`
      );
      return;
    }

    // Clear previous SVG content
    mermaidDiv.innerHTML = "";

    // Reset accessibility initialization flag
    container.removeAttribute("data-accessibility-initialized");
    container.removeAttribute("data-mermaid-error");

    // Remove view controls to allow fresh initialization
    container.classList.remove("view-controls-added");
    const existingViewControls = container.querySelector(
      ".mermaid-view-controls"
    );
    if (existingViewControls) {
      existingViewControls.remove();
    }

    // Remove existing mermaid controls to allow fresh initialization
    const existingMermaidControls =
      container.querySelector(".mermaid-controls");
    if (existingMermaidControls) {
      existingMermaidControls.remove();
    }

    try {
      // Re-render the mermaid diagram
      if (window.mermaid && typeof window.mermaid.render === "function") {
        const result = await window.mermaid.render(
          `${diagramId}-retry-svg`,
          diagramCode
        );
        mermaidDiv.innerHTML = result.svg;

        // Initialize all control systems first
        initializeAllControls(container, diagramId);

        // Then initialize accessibility features
        await initAccessibilityFeatures(container, diagramId);

        logInfo(
          `[Mermaid Accessibility] Successfully retried diagram ${diagramId}`
        );
      } else {
        throw new Error("Mermaid library not available");
      }
    } catch (error) {
      logError(
        `[Mermaid Accessibility] Failed to retry diagram ${diagramId}:`,
        error
      );
      showErrorFallback(
        container,
        diagramId,
        diagramCode,
        error.message,
        error
      );
    }
  }

  /**
   * Retry rendering entire content using markdown editor pipeline
   * @param {HTMLElement} container - The diagram container
   * @param {string} diagramId - Unique identifier for the diagram
   */
  async function retryFullContentRender(container, diagramId) {
    logInfo(
      `[Mermaid Accessibility] Attempting full content re-render for diagram ${diagramId}`
    );

    // Check if MarkdownEditor is available
    if (
      typeof window.MarkdownEditor === "undefined" ||
      typeof window.MarkdownEditor.processContent !== "function"
    ) {
      logError(
        `[Mermaid Accessibility] MarkdownEditor not available for full content retry`
      );
      return;
    }

    try {
      // Find the main content container
      const contentContainer =
        document.getElementById("results") ||
        document.querySelector(".content-container") ||
        document.querySelector("main");

      if (!contentContainer) {
        logError(
          `[Mermaid Accessibility] No content container found for full re-render`
        );
        return;
      }

      // Get all mermaid code from the page
      const allMermaidContainers =
        document.querySelectorAll(".mermaid-container");
      const mermaidCodes = Array.from(allMermaidContainers)
        .map((container) => {
          const code = container.getAttribute("data-diagram-code");
          return code ? decodeURIComponent(code) : "";
        })
        .filter((code) => code.length > 0);

      if (mermaidCodes.length === 0) {
        logWarn(
          `[Mermaid Accessibility] No mermaid codes found for full re-render`
        );
        return;
      }

      // Reconstruct markdown content with mermaid blocks
      const reconstructedContent = mermaidCodes
        .map((code) => `\`\`\`mermaid\n${code}\n\`\`\``)
        .join("\n\n");

      // Process through MarkdownEditor pipeline
      const processedContent = await window.MarkdownEditor.processContent(
        reconstructedContent
      );

      // Replace content
      contentContainer.innerHTML = processedContent;

      logInfo(
        `[Mermaid Accessibility] Successfully completed full content re-render`
      );
    } catch (error) {
      logError(`[Mermaid Accessibility] Full content re-render failed:`, error);
    }
  }

  /**
   * Show error fallback with raw mermaid code and retry options
   * @param {HTMLElement} container - The diagram container
   * @param {string} diagramId - Unique identifier for the diagram
   * @param {string} diagramCode - The original mermaid code
   * @param {string} errorMessage - Error message to display
   * @param {Error} originalError - The original error object for analysis
   */
  function showErrorFallback(
    container,
    diagramId,
    diagramCode,
    errorMessage = "Diagram couldn't display properly",
    originalError = null
  ) {
    logInfo(
      `[Mermaid Accessibility] Showing error fallback for diagram ${diagramId}`
    );

    const mermaidDiv = container.querySelector(".mermaid");
    if (!mermaidDiv) return;

    // Analyze the error type
    const errorAnalysis = originalError
      ? analyzeError(originalError)
      : {
          isSyntaxError: false,
          isRenderingIssue: true,
          userFriendlyMessage: errorMessage,
        };

    // Create error container
    const errorContainer = document.createElement("div");
    errorContainer.className = "mermaid-error-fallback";
    errorContainer.setAttribute("role", "alert");
    errorContainer.setAttribute("aria-live", "polite");

    // Error message with more specific information
    const errorPara = document.createElement("p");
    errorPara.className = "mermaid-error-message";

    if (errorAnalysis.isSyntaxError) {
      errorPara.innerHTML = `<strong>${errorAnalysis.userFriendlyMessage}</strong>: The Mermaid code contains syntax errors. Showing code below with fix options.`;
    } else {
      errorPara.textContent = `${errorAnalysis.userFriendlyMessage}, showing code instead`;
    }

    // Technical error details (collapsible)
    let technicalDetails = null;
    if (originalError && originalError.message) {
      technicalDetails = document.createElement("details");
      technicalDetails.className = "mermaid-error-details";

      const summary = document.createElement("summary");
      summary.textContent = "Technical Error Details";
      summary.style.cursor = "pointer";
      summary.style.marginBottom = "0.5em";

      const errorDetails = document.createElement("pre");
      errorDetails.className = "mermaid-error-technical";
      errorDetails.style.fontSize = "0.9em";
      errorDetails.style.color = "#666";
      errorDetails.style.background = "#f5f5f5";
      errorDetails.style.padding = "0.5em";
      errorDetails.style.borderRadius = "3px";
      errorDetails.textContent = originalError.message;

      technicalDetails.appendChild(summary);
      technicalDetails.appendChild(errorDetails);
    }

    // Code display
    const codeBlock = document.createElement("pre");
    codeBlock.className = "mermaid-fallback-code";
    const codeElement = document.createElement("code");
    codeElement.textContent = diagramCode;
    codeBlock.appendChild(codeElement);

    // Retry buttons container
    const retryContainer = document.createElement("div");
    retryContainer.className = "mermaid-retry-container";

    if (config.enableRetryButtons) {
      if (errorAnalysis.isSyntaxError && config.enableSyntaxFix) {
        // For syntax errors, offer syntax fix option
        const fixSyntaxButton = createFixSyntaxButton(
          container,
          diagramId,
          diagramCode
        );
        retryContainer.appendChild(fixSyntaxButton);
      }

      // Standard retry button
      const singleRetryButton = createRetryButton(
        container,
        diagramId,
        diagramCode,
        "single"
      );
      retryContainer.appendChild(singleRetryButton);

      // Full content retry button (if enabled)
      if (
        config.retryButtonMode === "full" ||
        config.retryButtonMode === "both"
      ) {
        const fullRetryButton = createRetryButton(
          container,
          diagramId,
          diagramCode,
          "full"
        );
        retryContainer.appendChild(fullRetryButton);
      }
    }

    // Assemble error fallback
    errorContainer.appendChild(errorPara);
    if (technicalDetails) {
      errorContainer.appendChild(technicalDetails);
    }
    errorContainer.appendChild(codeBlock);
    if (retryContainer.children.length > 0) {
      errorContainer.appendChild(retryContainer);
    }

    // Replace mermaid div content
    mermaidDiv.innerHTML = "";
    mermaidDiv.appendChild(errorContainer);

    // Mark as having error fallback
    container.setAttribute("data-mermaid-error", "true");
    container.setAttribute("data-accessibility-initialized", "error");
  }

  /**
   * Log detailed information about a diagram container for debugging
   * @param {HTMLElement} container - The diagram container
   */
  function logDiagramInfo(container) {
    if (!shouldLog(LOG_LEVELS.DEBUG)) return;

    const mermaidDiv = container.querySelector(".mermaid");
    if (!mermaidDiv) {
      logDebug("[Mermaid Accessibility] No mermaid div found for logging");
      return;
    }

    // Get the diagram code from the data attribute
    const encodedCode = container.getAttribute("data-diagram-code") || "{}";
    let diagramCode;
    try {
      diagramCode = encodedCode ? decodeURIComponent(encodedCode) : "";
    } catch (e) {
      logError("[Mermaid Accessibility] Error decoding diagram code:", e);
      diagramCode = encodedCode || "";
    }

    // Log mermaid div text content
    logDebug("[Mermaid Accessibility] Mermaid div text content:");
    logDebug(mermaidDiv.textContent);

    // Log data-diagram-code attribute
    logDebug("[Mermaid Accessibility] data-diagram-code attribute:");
    logDebug(diagramCode);

    // Log SVG content if available
    const svgElement = mermaidDiv.querySelector("svg");
    if (svgElement) {
      logDebug(
        "[Mermaid Accessibility] SVG element found with dimensions:",
        svgElement.width?.baseVal?.value || "unknown",
        "x",
        svgElement.height?.baseVal?.value || "unknown"
      );
    } else {
      logDebug("[Mermaid Accessibility] No SVG element found");
    }
  }

  /**
   * Get descriptions for a diagram
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @param {string} diagramType - The type of diagram
   * @returns {Object} Object containing short and long descriptions
   */
  function getDiagramDescriptions(svgElement, code, diagramType) {
    // Check if custom descriptions are provided in the directive
    const customDescriptions = Utils
      ? Utils.parseAccessibilityDirectives(code)
      : { title: null, description: null };

    // Create result object with both short and detailed descriptions
    const descriptions = {
      short: null,
      shortHTML: null,
      detailed: null,
    };

    // If we have a registered generator for this diagram type, use it
    if (descriptionGenerators[diagramType]) {
      try {
        const generator = descriptionGenerators[diagramType];

        // Generate short description
        if (typeof generator.generateShort === "function") {
          descriptions.short = generator.generateShort(
            svgElement,
            code,
            diagramType
          );
        }

        // Generate short HTML description if available
        if (typeof generator.generateShortHTML === "function") {
          descriptions.shortHTML = generator.generateShortHTML(
            svgElement,
            code,
            diagramType
          );
        }

        // Generate detailed description
        if (typeof generator.generateDetailed === "function") {
          descriptions.detailed = generator.generateDetailed(
            svgElement,
            code,
            diagramType
          );
        }
      } catch (error) {
        logError(
          `[Mermaid Accessibility] Error in custom generator for ${diagramType}:`,
          error
        );
      }
    }

    // Use custom title if provided
    if (customDescriptions.title) {
      descriptions.short = customDescriptions.title;
    }

    // Use custom description if provided
    if (customDescriptions.description) {
      descriptions.detailed = customDescriptions.description;
    }

    // Fallback to default short description
    if (!descriptions.short) {
      descriptions.short = `${
        diagramType.charAt(0).toUpperCase() + diagramType.slice(1)
      } diagram`;
    }

    // Fallback to default detailed description if still null
    if (!descriptions.detailed) {
      const template =
        config.descriptionTemplates[diagramType] ||
        `${diagramType} diagram showing relationships and flow.`;
      descriptions.detailed = template;
    }

    return descriptions;
  }

  /**
   * Generate a short description for a diagram (fallback method)
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @param {string} diagramType - The type of diagram
   * @returns {string} A short description
   */
  function generateShortDescription(svgElement, code, diagramType) {
    // If we have a registered generator for this diagram type, use it
    if (
      descriptionGenerators[diagramType] &&
      typeof descriptionGenerators[diagramType].generateShort === "function"
    ) {
      return descriptionGenerators[diagramType].generateShort(
        svgElement,
        code,
        diagramType
      );
    }

    // Extract title from SVG or use default
    let title =
      Utils && typeof Utils.extractTitleFromSVG === "function"
        ? Utils.extractTitleFromSVG(svgElement)
        : `${
            diagramType.charAt(0).toUpperCase() + diagramType.slice(1)
          } Diagram`;

    // Use template based on diagram type
    let template =
      config.descriptionTemplates[diagramType] || `${diagramType} diagram`;

    // Basic fallback implementation for actors in sequence diagrams
    let actors = "";
    if (diagramType === "sequenceDiagram") {
      const actorElements = svgElement.querySelectorAll(".actor");
      if (actorElements.length > 0) {
        const actorNames = Array.from(actorElements)
          .slice(0, config.maxActors || 5)
          .map((el) => el.textContent.trim());

        actors = actorNames.join(", ");

        if (actorElements.length > (config.maxActors || 5)) {
          actors += ", and others";
        }
      }
    }

    // Replace placeholders with actual content
    return template.replace("{title}", title).replace("{actors}", actors);
  }

  /**
   * Generate a detailed description for a diagram (fallback method)
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @param {string} diagramType - The type of diagram
   * @returns {string} A detailed HTML description
   */
  function generateDetailedDescription(svgElement, code, diagramType) {
    // If we have a registered generator for this diagram type, use it
    if (
      descriptionGenerators[diagramType] &&
      typeof descriptionGenerators[diagramType].generateDetailed === "function"
    ) {
      return descriptionGenerators[diagramType].generateDetailed(
        svgElement,
        code,
        diagramType
      );
    }

    // Fallback to simple description
    return `<p>This is a ${diagramType} diagram.</p><p>For more specific details, please add an "accDescr" directive to your Mermaid code.</p>`;
  }

  /**
   * Add appropriate diagram-specific classes to the description container
   * @param {HTMLElement} container - The description container
   * @param {string} diagramType - The type of diagram
   */
  function addDiagramSpecificClasses(container, diagramType) {
    if (!container || !diagramType) return;

    // Add diagram-specific class
    container.classList.add(`${diagramType.toLowerCase()}-description`);
  }

  /**
   * Initialize accessibility features for a diagram container (ENHANCED VERSION)
   * @param {HTMLElement} container - The diagram container
   * @param {string|number} diagramId - Unique identifier for the diagram
   */
  async function initAccessibilityFeatures(container, diagramId) {
    if (!container) {
      logWarn("[Mermaid Accessibility] No container provided");
      return;
    }

    // Skip if already processed (but allow error state to be reprocessed)
    const initState = container.getAttribute("data-accessibility-initialized");
    if (initState === "true") {
      return;
    }

    logInfo(
      `[Mermaid Accessibility] Initialising features for diagram ${diagramId}`
    );

    // Log detailed information about the diagram
    logDiagramInfo(container);

    // Get the diagram element
    const mermaidDiv = container.querySelector(".mermaid");
    if (!mermaidDiv) {
      logWarn("[Mermaid Accessibility] No mermaid div found in container");
      return;
    }

    // Get the diagram code from the data attribute
    const encodedCode = container.getAttribute("data-diagram-code") || "{}";
    let diagramCode;
    try {
      diagramCode = encodedCode ? decodeURIComponent(encodedCode) : "";
    } catch (e) {
      logError("[Mermaid Accessibility] Error decoding diagram code:", e);
      diagramCode = encodedCode || "";
    }

    // ENHANCED: Check for SVG element with retry logic
    let svgElement = mermaidDiv.querySelector("svg");

    if (!svgElement) {
      logInfo(
        `[Mermaid Accessibility] No SVG found initially for diagram ${diagramId}, starting retry sequence`
      );

      // Try to wait for SVG with retry logic
      svgElement = await waitForSVGWithRetry(
        container,
        mermaidDiv,
        diagramId,
        diagramCode
      );

      if (!svgElement) {
        logWarn(
          `[Mermaid Accessibility] SVG not found after retries for diagram ${diagramId}, showing error fallback`
        );
        showErrorFallback(
          container,
          diagramId,
          diagramCode,
          "Diagram failed to render after multiple attempts"
        );
        return;
      }
    }

    // Log SVG success
    const dimensions = {
      width: svgElement.width?.baseVal?.value || "unknown",
      height: svgElement.height?.baseVal?.value || "unknown",
    };
    logInfo(
      `[Mermaid Accessibility] SVG found for diagram ${diagramId} with dimensions: ${dimensions.width} x ${dimensions.height}`
    );

    // Get diagram type using the detection module
    let diagramType = "flowchart"; // Default fallback

    if (
      window.MermaidDiagramDetection &&
      typeof window.MermaidDiagramDetection.detectDiagramType === "function"
    ) {
      diagramType =
        window.MermaidDiagramDetection.detectDiagramType(diagramCode);
    } else {
      logWarn(
        "[Mermaid Accessibility] Diagram detection module not loaded, using default type"
      );
    }

    // Find the controls container (created by mermaid-controls.js)
    const controlsContainer = container.querySelector(".mermaid-controls");
    if (!controlsContainer) {
      logWarn("[Mermaid Accessibility] No controls container found");
      return;
    }

    // Add CSS styles for descriptions if not already added
    if (Utils && typeof Utils.addDescriptionStyles === "function") {
      Utils.addDescriptionStyles();
    }

    // Get descriptions (either custom or generated)
    const descriptions = getDiagramDescriptions(
      svgElement,
      diagramCode,
      diagramType
    );

    // Create a figure element to wrap the container
    const figureElement = document.createElement("figure");
    figureElement.className = "mermaid-figure";

    // Check if container is already wrapped in a figure (to avoid double wrapping)
    if (
      container.parentElement &&
      container.parentElement.tagName !== "FIGURE"
    ) {
      // Get the parent element of the container
      const parent = container.parentElement;

      // Replace the container with the figure element
      parent.replaceChild(figureElement, container);

      // First create the figcaption
      const figcaption = document.createElement("figcaption");
      figcaption.className = "mermaid-figcaption";

      // Use HTML version if available
      if (
        descriptions.shortHTML &&
        descriptions.shortHTML !== descriptions.short
      ) {
        // Ensure numbers are properly formatted
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = descriptions.shortHTML;

        // Format text nodes within the HTML
        const walker = document.createTreeWalker(
          tempDiv,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (node.textContent.trim()) {
            node.textContent =
              Utils && typeof Utils.formatNumbersInText === "function"
                ? Utils.formatNumbersInText(node.textContent)
                : node.textContent;
          }
        }

        figcaption.innerHTML = tempDiv.innerHTML;
      } else {
        figcaption.textContent =
          Utils && typeof Utils.formatNumbersInText === "function"
            ? Utils.formatNumbersInText(descriptions.short)
            : descriptions.short;
      }

      // Add sr-only class if captions should be hidden by default
      if (!config.captionsVisibleByDefault) {
        figcaption.classList.add("sr-only");
      }

      // Store the figcaption ID in the container's dataset
      container.dataset.figcaptionId = `mermaid-caption-${diagramId}`;
      figcaption.id = `mermaid-caption-${diagramId}`;

      // Associate the diagram with its caption using aria-describedby
      svgElement.setAttribute(
        "aria-describedby",
        `mermaid-caption-${diagramId}`
      );

      // Add the figcaption first, then the container
      figureElement.appendChild(figcaption);
      figureElement.appendChild(container);
    }

    // Add description toggle button
    if (
      Utils &&
      typeof Utils.DOMUtils === "object" &&
      typeof Utils.DOMUtils.createDescriptionToggleButton === "function"
    ) {
      const descriptionToggleButton =
        Utils.DOMUtils.createDescriptionToggleButton(
          container,
          svgElement,
          diagramCode,
          diagramId,
          descriptions.detailed,
          descriptions.short
        );
      controlsContainer.appendChild(descriptionToggleButton);
    }

    // Apply short description to diagram for screen readers
    svgElement.setAttribute("aria-label", descriptions.short);

    // Mark as initialised
    container.setAttribute("data-accessibility-initialized", "true");

    // Initialize sortable tables for quadrant charts
    if (
      diagramType === "quadrantChart" &&
      typeof window.initSortableTables === "function"
    ) {
      logDebug(
        `[Mermaid Accessibility] Initialising sortable table for diagram ${diagramId}`
      );

      // Wait for DOM update before initialising sortable tables
      setTimeout(() => {
        const descContainer = document.getElementById(
          `mermaid-description-${diagramId}`
        );
        if (descContainer) {
          window.initSortableTables(descContainer);
        }
      }, 50);
    }

    // Apply ARIA attributes to the table if that function exists
    if (
      diagramType === "quadrantChart" &&
      typeof window.addTableARIA === "function"
    ) {
      logDebug(
        `[Mermaid Accessibility] Applying ARIA attributes to table for diagram ${diagramId}`
      );

      // Wait for DOM update before applying ARIA
      setTimeout(() => {
        window.addTableARIA();
      }, 75);
    }

    logInfo(
      `[Mermaid Accessibility] Successfully initialised diagram ${diagramId}`
    );
  }

  /**
   * Initialize accessibility features for all diagrams
   * @param {HTMLElement} container - Container element (defaults to document)
   */
  function init(container = document) {
    if (!container) {
      logWarn("[Mermaid Accessibility] No container provided");
      return;
    }

    // Find all mermaid containers
    const mermaidContainers = container.querySelectorAll(".mermaid-container");
    if (mermaidContainers.length === 0) {
      logInfo("[Mermaid Accessibility] No mermaid containers found");
      return;
    }

    logInfo(
      `[Mermaid Accessibility] Adding features to ${mermaidContainers.length} diagrams`
    );

    // Add features to each diagram
    mermaidContainers.forEach((container, index) => {
      // Get diagram ID from container or generate one
      const diagramId = container.id || `mermaid-${index}`;

      // Initialize accessibility features for this container
      initAccessibilityFeatures(container, diagramId);
    });
  }

  /**
   * Initialize accessibility features using Intersection Observer for performance
   * @param {HTMLElement} container - Container to observe (defaults to document)
   */
  function initWithLazyLoading(container = document) {
    if (!container) {
      logWarn("[Mermaid Accessibility] No container provided");
      return;
    }

    logInfo("[Mermaid Accessibility] Initialising with lazy loading");

    // Find all mermaid containers without accessibility features
    const mermaidContainers =
      Utils && typeof Utils.findContainersWithoutFeatures === "function"
        ? Utils.findContainersWithoutFeatures(container)
        : Array.from(
            container.querySelectorAll(
              ".mermaid-container:not([data-accessibility-initialized='true'])"
            )
          );

    if (mermaidContainers.length === 0) {
      logInfo(
        "[Mermaid Accessibility] No mermaid containers found for lazy loading"
      );
      return;
    }

    logDebug(
      `[Mermaid Accessibility] Found ${mermaidContainers.length} diagrams to observe`
    );

    // Create Intersection Observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const container = entry.target;
            const diagramId =
              container.id ||
              `mermaid-${Math.random().toString(36).substring(2, 10)}`;

            // Add accessibility features if not already initialised
            if (
              container.getAttribute("data-accessibility-initialized") !==
              "true"
            ) {
              logDebug(
                `[Mermaid Accessibility] Initialising features for visible diagram ${diagramId}`
              );
              initAccessibilityFeatures(container, diagramId);
            }

            // Stop observing this container once initialised
            observer.unobserve(container);
          }
        });
      },
      {
        threshold: 0.1, // Trigger when at least 10% of the element is visible
        rootMargin: "100px", // Add 100px margin to load slightly before visible
      }
    );

    // Start observing each container
    mermaidContainers.forEach((container) => {
      observer.observe(container);
    });
  }

  /**
   * Set up mutation observer to detect new diagrams
   */
  function setupMutationObserver() {
    logInfo(
      "[Mermaid Accessibility] Setting up mutation observer for dynamic diagrams"
    );

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
                node.getAttribute("data-accessibility-initialized") !== "true"
              ) {
                logDebug(
                  "[Mermaid Accessibility] Found new mermaid container node"
                );
                newDiagramsFound = true;
              } else {
                // Check for mermaid containers inside this node
                const containersWithoutFeatures = Array.from(
                  node.querySelectorAll
                    ? node.querySelectorAll(
                        ".mermaid-container:not([data-accessibility-initialized='true'])"
                      )
                    : []
                );
                if (containersWithoutFeatures.length > 0) {
                  logDebug(
                    `[Mermaid Accessibility] Found ${containersWithoutFeatures.length} new mermaid containers inside node`
                  );
                  newDiagramsFound = true;
                }
              }
            }
          });
        }
      });

      // Only initialise if new diagrams without features were found
      if (newDiagramsFound) {
        logInfo(
          "[Mermaid Accessibility] New diagrams detected, initialising accessibility features"
        );
        initWithLazyLoading(document);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return observer;
  }

  // Testing and debugging functions
  function testMermaidRetryLogic() {
    logInfo("[Mermaid Accessibility] Testing retry logic");

    // Create a test container with mermaid code but no SVG
    const testContainer = document.createElement("div");
    testContainer.className = "mermaid-container";
    testContainer.setAttribute(
      "data-diagram-code",
      encodeURIComponent(`
      flowchart TD
        A[Test] --> B[Retry Logic]
        B --> C[Should Work]
    `)
    );

    // Generate unique ID
    const testId = `test-retry-${Date.now()}`;
    testContainer.id = testId;

    const mermaidDiv = document.createElement("div");
    mermaidDiv.className = "mermaid";
    testContainer.appendChild(mermaidDiv);

    // Create a basic controls container for testing
    const controlsDiv = document.createElement("div");
    controlsDiv.className = "mermaid-controls";
    testContainer.appendChild(controlsDiv);

    document.body.appendChild(testContainer);

    // Test the retry logic - this will trigger the error fallback since there's no SVG
    initAccessibilityFeatures(testContainer, testId);

    logInfo(
      "[Mermaid Accessibility] Test container created. Check the page for error fallback with retry buttons."
    );

    return testContainer;
  }

  function testMarkdownEditorCompatibility() {
    logInfo("[Mermaid Accessibility] Testing Markdown Editor compatibility");

    // Check if MarkdownEditor exists and works
    if (typeof window.MarkdownEditor !== "undefined") {
      logInfo("[Mermaid Accessibility] MarkdownEditor is available");
      return true;
    } else {
      logWarn("[Mermaid Accessibility] MarkdownEditor is not available");
      return false;
    }
  }

  function forceMermaidFailure() {
    logInfo("[Mermaid Accessibility] Forcing mermaid failure for testing");

    // Temporarily disable mermaid rendering
    const originalMermaid = window.mermaid;
    window.mermaid = undefined;

    // Restore after 5 seconds
    setTimeout(() => {
      window.mermaid = originalMermaid;
      logInfo("[Mermaid Accessibility] Mermaid restored after test failure");
    }, 5000);
  }

  function testSyntaxFixing() {
    logInfo("[Mermaid Accessibility] Testing syntax fix functionality");

    // Create a test container with intentionally broken mermaid syntax
    const testContainer = document.createElement("div");
    testContainer.className = "mermaid-container";

    // Example of broken syntax (colons after arrows)
    const brokenCode = `flowchart TD
    A[Start] --> B[Process]: This breaks the syntax
    B --> C[End]: This also breaks it`;

    testContainer.setAttribute(
      "data-diagram-code",
      encodeURIComponent(brokenCode)
    );

    const testId = `test-syntax-fix-${Date.now()}`;
    testContainer.id = testId;

    const mermaidDiv = document.createElement("div");
    mermaidDiv.className = "mermaid";
    mermaidDiv.textContent = brokenCode; // Put broken code in div to simulate failed rendering
    testContainer.appendChild(mermaidDiv);

    // Create a basic controls container for testing
    const controlsDiv = document.createElement("div");
    controlsDiv.className = "mermaid-controls";
    testContainer.appendChild(controlsDiv);

    document.body.appendChild(testContainer);

    // Simulate a syntax error
    const fakeError = new Error(
      "Parse error on line 2: Expecting 'SEMI', 'NEWLINE', 'SPACE', 'EOF', got 'COLON'"
    );
    showErrorFallback(
      testContainer,
      testId,
      brokenCode,
      fakeError.message,
      fakeError
    );

    logInfo(
      "[Mermaid Accessibility] Test container with syntax error created. Check for 'Try syntax fix' button."
    );

    return testContainer;
  }

  // Expose testing functions to window
  window.testMermaidRetryLogic = testMermaidRetryLogic;
  window.testMarkdownEditorCompatibility = testMarkdownEditorCompatibility;
  window.forceMermaidFailure = forceMermaidFailure;
  window.testSyntaxFixing = testSyntaxFixing;

  // Initialize when DOM is fully loaded
  document.addEventListener("DOMContentLoaded", function () {
    logInfo(
      "[Mermaid Accessibility] DOM content loaded, initialising accessibility features"
    );

    // Initialize for existing diagrams
    if (typeof window.MermaidAccessibility !== "undefined") {
      logInfo(
        "[Mermaid Accessibility] Found MermaidAccessibility module, initialising"
      );

      // Use lazy loading initialisation for better performance
      initWithLazyLoading();

      // Set up mutation observer for dynamically added diagrams
      setupMutationObserver();
    } else {
      logWarn(
        "[Mermaid Accessibility] MermaidAccessibility not found. Make sure mermaid-accessibility.js is loaded."
      );
    }
  });

  // Inform that the module is loaded
  logInfo("[Mermaid Accessibility] Core module loaded");

  // Public API
  return {
    init: init,
    initWithLazyLoading: initWithLazyLoading,
    initAccessibilityFeatures: initAccessibilityFeatures,
    initializeAllControls: initializeAllControls,
    registerDescriptionGenerator: registerDescriptionGenerator,
    getDiagramDescriptions: getDiagramDescriptions,
    generateShortDescription: generateShortDescription,
    generateDetailedDescription: generateDetailedDescription,
    descriptionGenerators: descriptionGenerators,
    config: config,
    retryStore: retryStore,

    // Testing functions
    testMermaidRetryLogic: testMermaidRetryLogic,
    testMarkdownEditorCompatibility: testMarkdownEditorCompatibility,
    forceMermaidFailure: forceMermaidFailure,
    testSyntaxFixing: testSyntaxFixing,

    // Logging control methods
    setLogLevel: setLogLevel,
    enableAllLog: enableAllLog,
    disableAllLog: disableAllLog,
    resetLogging: resetLogging,
    LOG_LEVELS: LOG_LEVELS,
    getCurrentLogLevel: () => currentLogLevel,
    getLogLevelName: getLogLevelName,
  };
})();
