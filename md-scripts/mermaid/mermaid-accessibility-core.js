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
   *
   * Async since the stage 1 flowchart-rewrite work: generator calls are
   * awaited, so a generator may return either a plain value (all ten
   * current registrations — an await on a plain value is a no-op) or a
   * Promise (the adapter-backed generators from stage 2 onwards). A
   * rejecting promise lands in the same catch as a synchronous throw and
   * routes to the generation-failed fallback.
   *
   * @param {HTMLElement} svgElement - The SVG element of the diagram
   * @param {string} code - The original mermaid code
   * @param {string} diagramType - The type of diagram
   * @returns {Promise<Object>} Promise resolving to an object containing short and long descriptions
   */
  async function getDiagramDescriptions(svgElement, code, diagramType) {
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
          descriptions.short = await generator.generateShort(
            svgElement,
            code,
            diagramType
          );
        }

        // Generate short HTML description if available
        if (typeof generator.generateShortHTML === "function") {
          descriptions.shortHTML = await generator.generateShortHTML(
            svgElement,
            code,
            diagramType
          );
        }

        // Generate detailed description
        if (typeof generator.generateDetailed === "function") {
          descriptions.detailed = await generator.generateDetailed(
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

    // Use custom title if provided.
    //
    // Deliberately NOT escaped. Every sink this value reaches is a text sink —
    // the figcaption's textContent branch, the panel's short-description
    // textContent branches, and the SVG aria-label, which is an attribute and
    // is never parsed as HTML. Escaping here would double-encode all of them,
    // putting literal "&lt;" into a caption and into what a screen reader
    // announces. See docs/mermaid-xss-census-2026-08-13.md § 2a.
    // The flag beside it RECORDS THAT IT IS AUTHOR TEXT, for the same reason
    // the description's flag below does: descriptions.short is polymorphic —
    // it carries either a module's generated plain tier or the raw author
    // string assigned here — and no sink downstream can tell the two apart
    // from the string alone. The figcaption and the panel's short description
    // both choose a generated HTML tier over it by default, so without the
    // flag the author's own title loses on both surfaces. Provenance travels
    // explicitly, set at the one site that knows it, and each sink acts on the
    // flag rather than on a guess. Register item 30.
    if (customDescriptions.title) {
      descriptions.short = customDescriptions.title;
      descriptions.shortIsAuthorText = true;
    }

    // Use custom description if provided, and RECORD THAT IT IS AUTHOR TEXT.
    //
    // This field is polymorphic: it carries either a module's generated HTML,
    // which the modules have already escaped at their own interpolation sites,
    // or the raw author string assigned here. Both land on the same innerHTML
    // sink in DOMUtils.createDescriptionContainer, and the sink cannot tell
    // them apart from the string alone — inferring provenance from its shape
    // is exactly what let author markup through. So provenance travels
    // explicitly, set at the one site that knows it, and the sink escapes on
    // the flag rather than on a guess. Register item 31.
    if (customDescriptions.description) {
      descriptions.detailed = customDescriptions.description;
      descriptions.detailedIsAuthorText = true;
    }

    // HONEST FALLBACK.
    //
    // Reached when no generator produced output: either the diagram type has no
    // module, or a generator threw and the catch above left the field null.
    //
    // The previous behaviour capitalised the type key and appended " diagram",
    // yielding strings like "ClassDiagram diagram", and reached for a template
    // that could leak an unsubstituted placeholder ("Flowchart showing {title}.")
    // straight into a screen reader. Both told the reader something false about
    // a diagram nobody had actually described. Saying plainly that no
    // description exists is more use than a confident wrong one.
    //
    // Author-supplied accTitle / accDescr are applied ABOVE this point, so an
    // author's own description still wins.
    // Two different silences, two different messages. "We do not support this
    // diagram type" and "we support it but generation failed" are not the same
    // statement, and telling a reader the first when the second is true is the
    // same class of error this fallback exists to remove.
    const generatorExists = !!descriptionGenerators[diagramType];

    if (!descriptions.short) {
      descriptions.short = generatorExists
        ? buildGenerationFailedShort(diagramType)
        : buildUnsupportedShort(diagramType);
    }

    if (!descriptions.detailed) {
      descriptions.detailed = generatorExists
        ? buildGenerationFailedDetailed(diagramType)
        : buildUnsupportedDetailed(diagramType);
    }

    return descriptions;
  }

  /**
   * Plain-English noun phrases, article included, for diagram types that have no
   * description generator. The article travels with the phrase so that "an
   * entity relationship diagram" cannot come out as "a entity relationship
   * diagram" — the leading word is not derivable from the key.
   *
   * Keys cover both the `unsupported:<mermaidType>` form produced by Mermaid's
   * own detector and the legacy keys the keyword-scan fallback still returns.
   */
  const UNSUPPORTED_HUMAN_NAMES = Object.freeze({
    "unsupported:requirement": "a requirement diagram",
    "unsupported:c4": "a C4 architecture diagram",
    "unsupported:xychart": "an XY chart",
    "unsupported:block": "a block diagram",
    "unsupported:packet": "a packet diagram",
    "unsupported:kanban": "a Kanban board",
    "unsupported:radar": "a radar chart",
    "unsupported:info": "a Mermaid information panel",
    // Legacy keys from the keyword-scan fallback path.
    classDiagram: "a class diagram",
    entityRelationshipDiagram: "an entity relationship diagram",
    gitGraph: "a Git graph",
    sankey: "a Sankey diagram",
    // Types that DO have a generator. Reached only when that generator failed,
    // so the message can still name the diagram accurately.
    flowchart: "a flowchart",
    sequenceDiagram: "a sequence diagram",
    stateDiagram: "a state diagram",
    "stateDiagram-v2": "a state diagram",
    userJourney: "a user journey diagram",
    gantt: "a Gantt chart",
    pieChart: "a pie chart",
    quadrantChart: "a quadrant chart",
    mindmap: "a mindmap",
    timeline: "a timeline",
    "architecture-beta": "an architecture diagram",
  });

  /** Last-resort phrase when the type is genuinely unknown to us. */
  const UNKNOWN_DIAGRAM_PHRASE = "a diagram";

  /**
   * Resolve a diagram type key to its plain-English noun phrase.
   * @param {string} diagramType
   * @returns {string} e.g. "a class diagram"
   */
  function describeDiagramTypeInWords(diagramType) {
    return UNSUPPORTED_HUMAN_NAMES[diagramType] || UNKNOWN_DIAGRAM_PHRASE;
  }

  /**
   * Short description for a type we cannot describe. Plain text, no markup.
   * @param {string} diagramType
   * @returns {string}
   */
  function buildUnsupportedShort(diagramType) {
    const phrase = describeDiagramTypeInWords(diagramType);
    const sentence = phrase.charAt(0).toUpperCase() + phrase.slice(1);
    return `${sentence}. No generated description is available for this diagram type.`;
  }

  /**
   * Detailed description for a type we cannot describe.
   *
   * Deliberately makes NO claim about the diagram's content — not the number of
   * nodes, not the shapes, nothing. It states the limitation and points the
   * author at the directives that let them fix it themselves.
   *
   * @param {string} diagramType
   * @returns {string} HTML fragment
   */
  function buildUnsupportedDetailed(diagramType) {
    const phrase = describeDiagramTypeInWords(diagramType);
    return (
      `<section class="mermaid-section unsupported-diagram">` +
      `<h4 class="mermaid-details-heading">Description not available</h4>` +
      `<p>This is ${phrase}. Automatic description does not support this diagram type yet, ` +
      `so no account of its contents can be given here.</p>` +
      `<p>The author of this diagram can supply their own description in the diagram source ` +
      `using the <code>accTitle</code> and <code>accDescr</code> directives, which replace ` +
      `this message.</p>` +
      `</section>`
    );
  }

  /**
   * Short description for a SUPPORTED type whose generator produced nothing.
   *
   * Distinct from the unsupported message on purpose: this diagram type IS
   * described elsewhere in the application, so claiming otherwise would send the
   * reader looking for a limitation that does not exist. The error itself is
   * already logged above.
   *
   * @param {string} diagramType
   * @returns {string}
   */
  function buildGenerationFailedShort(diagramType) {
    const phrase = describeDiagramTypeInWords(diagramType);
    const sentence = phrase.charAt(0).toUpperCase() + phrase.slice(1);
    return `${sentence}. A description could not be generated for this diagram.`;
  }

  /**
   * Detailed description for a SUPPORTED type whose generator produced nothing.
   * Makes no claim about the diagram's content.
   *
   * @param {string} diagramType
   * @returns {string} HTML fragment
   */
  function buildGenerationFailedDetailed(diagramType) {
    const phrase = describeDiagramTypeInWords(diagramType);
    return (
      `<section class="mermaid-section unsupported-diagram">` +
      `<h4 class="mermaid-details-heading">Description not available</h4>` +
      `<p>This is ${phrase}. A description could not be generated for it on this occasion, ` +
      `so no account of its contents can be given here.</p>` +
      `<p>The author of this diagram can supply their own description in the diagram source ` +
      `using the <code>accTitle</code> and <code>accDescr</code> directives, which replace ` +
      `this message.</p>` +
      `</section>`
    );
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
      // Register item 25 diagnostic. The measurement session found that
      // MermaidControls.addControlsToContainer synchronously wipes the SVG -
      // its theme setup ends in applyTheme, whose first act is
      // `mermaidDiv.textContent = newCode`, the SVG returning only when that
      // function's own asynchronous re-render resolves. During the window this
      // node is the same node, still connected, with non-empty innerHTML, so
      // every conventional staleness check reads healthy. The one token that
      // separates that window from any other cause of a miss is the
      // `%%{init:` directive applyTheme prefixes to the source, which nothing
      // else on the page writes. Both readings are taken synchronously at the
      // instant of the miss; the text itself is deliberately never logged.
      // See docs/mermaid-item25-firstlook-2026-08-12.md.
      const directivePresent = mermaidDiv.textContent
        .trim()
        .startsWith("%%{init");
      logInfo(
        `[Mermaid Accessibility] No SVG found initially for diagram ${diagramId}, starting retry sequence (directivePresent: ${directivePresent}, innerHTML length: ${mermaidDiv.innerHTML.length})`
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
    const descriptions = await getDiagramDescriptions(
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

      // Use HTML version if available.
      // The tier text is used verbatim on both branches: each module owns its
      // own number style (via Common.narrationNumber), and overview totals are
      // always digits. Rewriting numbers here made the figcaption disagree with
      // the SVG aria-label, which is fed the same tier untransformed (item 27).
      //
      // An author's own accTitle ALWAYS takes the text branch, whatever the
      // module generated. Two reasons, and the second is why the flag is read
      // here rather than the strings compared: an author title changes
      // descriptions.short, which GUARANTEES it differs from shortHTML, so the
      // author's own text was what forced the generated branch to be taken and
      // then discarded — the defect. And the author's string must reach only
      // text and attribute sinks, so that it needs no escaping and cannot be
      // double-encoded into what a reader sees. Register item 30.
      if (
        descriptions.shortHTML &&
        descriptions.shortHTML !== descriptions.short &&
        descriptions.shortIsAuthorText !== true
      ) {
        figcaption.innerHTML = descriptions.shortHTML;
      } else {
        figcaption.textContent = descriptions.short;
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
      // The provenance flag cannot ride on descriptions.detailed — that is a
      // string — so it is passed alongside it. Absent means generator output.
      const descriptionToggleButton =
        Utils.DOMUtils.createDescriptionToggleButton(
          container,
          svgElement,
          diagramCode,
          diagramId,
          descriptions.detailed,
          descriptions.short,
          descriptions.detailedIsAuthorText === true,
          descriptions.shortIsAuthorText === true
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
