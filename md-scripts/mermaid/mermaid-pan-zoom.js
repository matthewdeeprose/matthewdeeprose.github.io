/**
 * Mermaid Pan and Zoom
 * Adds pan and zoom capabilities to mermaid diagrams in fullscreen mode
 */
const MermaidPanZoom = (function () {
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

  // Current logging level (can be modified at runtime)
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  /**
   * Helper function to check if logging should occur for given level
   * @param {number} level - The log level to check
   * @returns {boolean} Whether logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Logging helper functions
   */
  function logError(message, data = null) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Mermaid Pan Zoom ERROR] ${message}`, data || "");
    }
  }

  function logWarn(message, data = null) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Mermaid Pan Zoom WARN] ${message}`, data || "");
    }
  }

  function logInfo(message, data = null) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Mermaid Pan Zoom INFO] ${message}`, data || "");
    }
  }

  function logDebug(message, data = null) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Mermaid Pan Zoom DEBUG] ${message}`, data || "");
    }
  }

  /**
   * Set the current logging level
   * @param {number} level - New logging level
   */
  function setLogLevel(level) {
    if (Object.values(LOG_LEVELS).includes(level)) {
      currentLogLevel = level;
      logInfo(`Logging level set to ${Object.keys(LOG_LEVELS)[level]}`);
    } else {
      logWarn(`Invalid log level: ${level}`);
    }
  }

  logInfo("Script loaded and initialising");
  // Configuration
  const config = {
    // Zoom settings
    zoomInText: "Zoom in",
    zoomOutText: "Zoom out",
    resetViewText: "Reset view",
    zoomStep: 0.1, // 10% zoom per step
    minZoom: 0.1, // Minimum zoom level (10%)
    maxZoom: 5, // Maximum zoom level (500%)

    // Pan settings
    panUpText: "Pan up",
    panDownText: "Pan down",
    panLeftText: "Pan left",
    panRightText: "Pan right",
    panStep: 50, // 50px pan per step

    // CSS classes
    panZoomContainerClass: "mermaid-pan-zoom-container",
    controlPanelClass: "mermaid-pan-zoom-controls",
    zoomableClass: "mermaid-zoomable",

    // Add the new fullscreen mode configuration option here:
    fullscreenMode: "auto", // Options: "auto", "native", "css"

    // Keyboard shortcuts (can be easily modified)
    keyboardShortcuts: {
      zoomIn: ["Equal", "NumpadAdd"], // "=" key and numpad "+" key
      zoomOut: ["Minus", "NumpadSubtract"], // "-" key and numpad "-" key
      panUp: "ArrowDown",
      panDown: "ArrowUp",
      panLeft: "ArrowRight",
      panRight: "ArrowLeft",
      reset: "KeyR", // "r" key
    },

    // Touch settings
    touchEnabled: true,
    wheelZoomEnabled: true,
    dragPanEnabled: true,
  };

  /**
   * Debug helper for logging diagram information
   * @param {string} prefix - Log prefix
   * @param {Object} data - Data to log
   */
  function debugLog(prefix, data = {}) {
    if (!shouldLog(LOG_LEVELS.DEBUG)) return;

    logDebug(`${prefix}:`, data);

    // If this is a diagram code debug, only show the first 100 chars to keep logs clean
    if (data.diagramCode && typeof data.diagramCode === "string") {
      const shortCode =
        data.diagramCode.substring(0, 100) +
        (data.diagramCode.length > 100 ? "..." : "");
      logDebug(`Diagram code sample: ${shortCode}`);
    }
  }

  // State management for each container
  const containerStates = new Map();

  /**
   * Initialize a container for pan and zoom
   * @param {HTMLElement} container - The container element
   * @param {string} containerId - Unique ID for this container
   */
  function initContainer(container, containerId) {
    // Skip if already processed
    if (containerStates.has(containerId)) {
      return;
    }

    logDebug(`Initialising container ${containerId}`);

    // Skip if not in fullscreen mode
    if (!container.classList.contains("fullscreen-mode")) {
      logDebug(
        `Container ${containerId} not in fullscreen mode, skipping initialisation`
      );
      return;
    }

    // Find the diagram element to be zoomed
    const diagramElement = container.querySelector(".mermaid svg");
    if (!diagramElement) {
      logWarn(`No diagram found in container ${containerId}`);
      return;
    }

    // Get the diagram code
    const diagramCode = container.getAttribute("data-diagram-code") || "";

    // Detect diagram type with extensive logging
    const diagramTypes = detectDiagramType(diagramCode, diagramElement);

    debugLog(`Diagram type detection for ${containerId}`, {
      ...diagramTypes,
      diagramDimensions: diagramElement.getBoundingClientRect(),
      diagramCode: diagramCode.substring(0, 100) + "...",
    });

    // Create wrapper for the diagram for zoom and pan operations
    const wrapperDiv = document.createElement("div");
    wrapperDiv.className = config.panZoomContainerClass;

    // Add diagram type classes based on detection
    if (diagramTypes.isWide || diagramTypes.isHorizontalFlow) {
      wrapperDiv.classList.add("mermaid-wide-diagram");
      container.classList.add("fullscreen-wide-diagram");

      // For wide diagrams, ensure the wrapper takes full width
      wrapperDiv.style.width = "100%";
      wrapperDiv.style.maxWidth = "100%";
      wrapperDiv.style.minHeight = "90vh";
      wrapperDiv.style.overflow = "auto";
    }

    wrapperDiv.style.position = "relative";
    wrapperDiv.style.overflow = "hidden";
    wrapperDiv.style.width = "100%";
    if (!wrapperDiv.style.height) {
      wrapperDiv.style.height = "100%"; // Default height if not set above
    }

    // Move the diagram into the wrapper
    diagramElement.parentNode.insertBefore(wrapperDiv, diagramElement);
    wrapperDiv.appendChild(diagramElement);

    // Add zoomable class to the diagram
    diagramElement.classList.add(config.zoomableClass);

    // Initialize state for this container
    containerStates.set(containerId, {
      container,
      diagram: diagramElement,
      wrapper: wrapperDiv,
      scale: 1,
      translateX: 0,
      translateY: 0,
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0,
      // Store initial dimensions for reset
      initialWidth: diagramElement.getBoundingClientRect().width,
      initialHeight: diagramElement.getBoundingClientRect().height,
      // Store diagram type information
      diagramTypes: diagramTypes,
    });

    // Add control panel
    addControlPanel(container, containerId);

    // Add event listeners for keyboard, mouse, and touch interactions
    setupEventListeners(containerId);

    debugLog(`Container ${containerId} initialised`, {
      wrapperDimensions: wrapperDiv.getBoundingClientRect(),
      containerDimensions: container.getBoundingClientRect(),
      diagramDimensions: diagramElement.getBoundingClientRect(),
    });
  }

  /**
   * Clean up duplicate control sets in a container
   * @param {HTMLElement} container - The container element
   * @param {string} containerId - Unique ID for this container
   */
  function cleanupDuplicateControls(container, containerId) {
    // Find all control panels in this container
    const controlPanels = container.querySelectorAll(
      `.${config.controlPanelClass}`
    );

    // If there's more than one, keep only the first one
    if (controlPanels.length > 1) {
      logWarn(
        `Found ${controlPanels.length} control panels in container ${containerId}, removing duplicates`
      );

      // Keep the first panel and remove others
      for (let i = 1; i < controlPanels.length; i++) {
        if (controlPanels[i] && controlPanels[i].parentNode) {
          controlPanels[i].parentNode.removeChild(controlPanels[i]);
        }
      }
    }

    // Also check for duplicate buttons with the same ID
    const buttonIds = new Set();
    const allButtons = container.querySelectorAll(".btn");

    allButtons.forEach((button) => {
      const buttonId = button.id;
      if (buttonId) {
        if (buttonIds.has(buttonId)) {
          // This is a duplicate button, remove it
          logWarn(`Removing duplicate button with ID: ${buttonId}`);
          if (button.parentNode) {
            button.parentNode.removeChild(button);
          }
        } else {
          // First occurrence of this button ID
          buttonIds.add(buttonId);
        }
      }
    });
  }
  /**
   * Detect diagram type and characteristics
   * @param {string} code - The diagram code
   * @param {HTMLElement} element - The diagram SVG element
   * @returns {Object} Object with diagram type properties
   */
  function detectDiagramType(code, element) {
    const rect = element.getBoundingClientRect();
    const aspectRatio = rect.width / rect.height;

    // Detect horizontal flow direction
    const isLR = code.includes("flowchart LR") || code.includes("graph LR");
    const isRL = code.includes("flowchart RL") || code.includes("graph RL");
    const isTimeline = code.includes("timeline");
    const isSequence = code.includes("sequenceDiagram");
    const isHorizontalFlow = isLR || isRL || isTimeline;

    // Check aspect ratio
    const isWideByRatio = aspectRatio > 2.5;
    const isTallByRatio = aspectRatio < 0.5;

    // Combined detection
    const isWide = isHorizontalFlow || isWideByRatio;
    const isTall = isTallByRatio && !isHorizontalFlow;

    return {
      isLR,
      isRL,
      isTimeline,
      isSequence,
      isHorizontalFlow,
      isWideByRatio,
      isTallByRatio,
      aspectRatio,
      isWide,
      isTall,
      width: rect.width,
      height: rect.height,
    };
  }
  /**
   * Add control panel to the container
   * @param {HTMLElement} container - The container element
   * @param {string} containerId - Unique ID for this container
   */
  function addControlPanel(container, containerId) {
    // Create control panel
    const controlPanel = document.createElement("div");
    controlPanel.className = config.controlPanelClass;
    controlPanel.setAttribute("role", "toolbar");
    controlPanel.setAttribute("aria-label", "Diagram pan and zoom controls");

    // Add zoom in button
    const zoomInButton = createButton(
      getZoomInIcon(),
      config.zoomInText,
      `zoom-in-${containerId}`,
      "Zoom in"
    );

    // Add zoom out button
    const zoomOutButton = createButton(
      getZoomOutIcon(),
      config.zoomOutText,
      `zoom-out-${containerId}`,
      "Zoom out"
    );

    // Add reset button
    const resetButton = createButton(
      getResetIcon(),
      config.resetViewText,
      `reset-view-${containerId}`,
      "Reset view"
    );

    // Add pan buttons
    const upButton = createButton(
      getPanUpIcon(),
      config.panUpText,
      `pan-up-${containerId}`,
      "Pan up"
    );

    const downButton = createButton(
      getPanDownIcon(),
      config.panDownText,
      `pan-down-${containerId}`,
      "Pan down"
    );

    const leftButton = createButton(
      getPanLeftIcon(),
      config.panLeftText,
      `pan-left-${containerId}`,
      "Pan left"
    );

    const rightButton = createButton(
      getPanRightIcon(),
      config.panRightText,
      `pan-right-${containerId}`,
      "Pan right"
    );

    // Add buttons to control panel
    controlPanel.appendChild(zoomInButton);
    controlPanel.appendChild(zoomOutButton);
    controlPanel.appendChild(upButton);
    controlPanel.appendChild(downButton);
    controlPanel.appendChild(rightButton);
    controlPanel.appendChild(leftButton);

    controlPanel.appendChild(resetButton);

    // Add event listeners for the buttons
    zoomInButton.addEventListener("click", () => zoomIn(containerId));
    zoomOutButton.addEventListener("click", () => zoomOut(containerId));
    resetButton.addEventListener("click", () => resetView(containerId));
    downButton.addEventListener("click", () => panUp(containerId));
    upButton.addEventListener("click", () => panDown(containerId));
    rightButton.addEventListener("click", () => panLeft(containerId));
    leftButton.addEventListener("click", () => panRight(containerId));

    // Add control panel to container
    container.appendChild(controlPanel);

    logInfo(`Control panel added to container ${containerId}`);
  }

  /**
   * Create a button element
   * @param {string} icon - HTML for the button icon
   * @param {string} text - Button text
   * @param {string} id - Button ID
   * @param {string} ariaLabel - Accessibility label
   * @returns {HTMLElement} The created button
   */
  function createButton(icon, text, id, ariaLabel) {
    const button = document.createElement("button");
    button.id = id;
    button.className = "btn mermaidZoomControl";
    button.innerHTML = icon;
    button.setAttribute("aria-label", ariaLabel);
    button.setAttribute("type", "button");
    return button;
  }

  /**
   * Setup event listeners for keyboard, mouse, and touch interactions
   * @param {string} containerId - Unique ID for this container
   */
  function setupEventListeners(containerId) {
    const state = containerStates.get(containerId);
    if (!state) return;

    // Keyboard event listener
    document.addEventListener("keydown", (event) => {
      // Only process keyboard events if this container is in fullscreen
      if (!state.container.classList.contains("fullscreen-mode")) {
        return;
      }

      const { keyboardShortcuts } = config;

      // Process keyboard shortcuts - handle both string and array shortcuts
      if (
        Array.isArray(keyboardShortcuts.zoomIn) &&
        keyboardShortcuts.zoomIn.includes(event.code)
      ) {
        zoomIn(containerId);
        event.preventDefault();
      } else if (
        Array.isArray(keyboardShortcuts.zoomOut) &&
        keyboardShortcuts.zoomOut.includes(event.code)
      ) {
        zoomOut(containerId);
        event.preventDefault();
      } else {
        // Process all other shortcuts that are single values
        switch (event.code) {
          case keyboardShortcuts.zoomIn: // For backward compatibility
            zoomIn(containerId);
            event.preventDefault();
            break;
          case keyboardShortcuts.zoomOut: // For backward compatibility
            zoomOut(containerId);
            event.preventDefault();
            break;
          case keyboardShortcuts.panUp:
            panUp(containerId);
            event.preventDefault();
            break;
          case keyboardShortcuts.panDown:
            panDown(containerId);
            event.preventDefault();
            break;
          case keyboardShortcuts.panLeft:
            panLeft(containerId);
            event.preventDefault();
            break;
          case keyboardShortcuts.panRight:
            panRight(containerId);
            event.preventDefault();
            break;
          case keyboardShortcuts.reset:
            resetView(containerId);
            event.preventDefault();
            break;
        }
      }
    });

    if (config.wheelZoomEnabled) {
      // Mouse wheel zoom
      state.wrapper.addEventListener("wheel", (event) => {
        if (!state.container.classList.contains("fullscreen-mode")) {
          return;
        }

        event.preventDefault();

        // Zoom in or out based on wheel direction
        if (event.deltaY < 0) {
          zoomIn(containerId);
        } else {
          zoomOut(containerId);
        }
      });
    }

    if (config.dragPanEnabled) {
      // Mouse drag pan
      state.wrapper.addEventListener("mousedown", (event) => {
        if (!state.container.classList.contains("fullscreen-mode")) {
          return;
        }

        state.isDragging = true;
        state.lastMouseX = event.clientX;
        state.lastMouseY = event.clientY;

        state.wrapper.style.cursor = "grabbing";
      });

      document.addEventListener("mousemove", (event) => {
        if (!state.isDragging) return;

        const dx = event.clientX - state.lastMouseX;
        const dy = event.clientY - state.lastMouseY;

        state.translateX += dx;
        state.translateY += dy;

        applyTransform(containerId);

        state.lastMouseX = event.clientX;
        state.lastMouseY = event.clientY;
      });

      document.addEventListener("mouseup", () => {
        if (state.isDragging) {
          state.isDragging = false;
          state.wrapper.style.cursor = "grab";
        }
      });

      // Set initial grab cursor
      state.wrapper.style.cursor = "grab";
    }

    if (config.touchEnabled) {
      // Touch events for mobile devices
      let touchStartX, touchStartY;
      let initialPinchDistance = 0;

      state.wrapper.addEventListener("touchstart", (event) => {
        if (!state.container.classList.contains("fullscreen-mode")) {
          return;
        }

        if (event.touches.length === 1) {
          // Single touch - prepare for panning
          touchStartX = event.touches[0].clientX;
          touchStartY = event.touches[0].clientY;
        } else if (event.touches.length === 2) {
          // Two touches - prepare for pinch zoom
          initialPinchDistance = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY
          );
        }

        event.preventDefault();
      });

      state.wrapper.addEventListener("touchmove", (event) => {
        if (!state.container.classList.contains("fullscreen-mode")) {
          return;
        }

        if (event.touches.length === 1) {
          // Single touch - pan
          const touchX = event.touches[0].clientX;
          const touchY = event.touches[0].clientY;

          const dx = touchX - touchStartX;
          const dy = touchY - touchStartY;

          state.translateX += dx;
          state.translateY += dy;

          applyTransform(containerId);

          touchStartX = touchX;
          touchStartY = touchY;
        } else if (event.touches.length === 2) {
          // Two touches - pinch zoom
          const currentPinchDistance = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY
          );

          if (initialPinchDistance > 0) {
            const pinchChange = currentPinchDistance / initialPinchDistance;

            if (pinchChange > 1.05) {
              // Zoom in
              zoomIn(containerId);
              initialPinchDistance = currentPinchDistance;
            } else if (pinchChange < 0.95) {
              // Zoom out
              zoomOut(containerId);
              initialPinchDistance = currentPinchDistance;
            }
          }
        }

        event.preventDefault();
      });
    }
  }

  /**
   * Apply transform to the diagram based on current state
   * @param {string} containerId - Unique ID for this container
   */
  function applyTransform(containerId) {
    const state = containerStates.get(containerId);
    if (!state) return;

    const { diagram, scale, translateX, translateY, wrapper, diagramTypes } =
      state;

    // Ensure values are valid numbers to prevent CSS errors
    const safeScale = isNaN(scale) ? 1 : scale;
    const safeTranslateX = isNaN(translateX) ? 0 : translateX;
    const safeTranslateY = isNaN(translateY) ? 0 : translateY;

    // Apply transform
    diagram.style.transform = `translate(${safeTranslateX}px, ${safeTranslateY}px) scale(${safeScale})`;
    diagram.style.transformOrigin = "0 0";

    // Ensure the SVG is visible
    diagram.style.maxHeight = "none";
    diagram.style.maxWidth = "none";
    diagram.style.overflow = "visible";

    // Apply specific styles for different diagram types
    if (wrapper) {
      const diagramRect = diagram.getBoundingClientRect();
      const diagramAspectRatio = diagramRect.width / diagramRect.height;
      const isWide =
        diagramAspectRatio > 2.5 ||
        diagramTypes?.isWide ||
        diagramTypes?.isHorizontalFlow;

      if (isWide) {
        // For wide diagrams, enable horizontal and vertical scrolling
        wrapper.style.overflow = "auto";
        wrapper.style.width = "100%";
        wrapper.style.maxWidth = "100%";

        // Ensure the diagram has enough space
        diagram.style.width = "auto";
        diagram.style.minWidth = `${Math.max(
          95,
          (diagramRect.width * safeScale) / 10
        )}%`;

        // Add debug info about the applied dimensions
        debugLog(
          `Applied transform for wide diagram: scale=${safeScale}, translated=(${safeTranslateX}px, ${safeTranslateY}px)`,
          {
            diagramRect,
            appliedStyles: {
              transform: diagram.style.transform,
              width: diagram.style.width,
              minWidth: diagram.style.minWidth,
              wrapperOverflow: wrapper.style.overflow,
            },
          }
        );
      } else {
        // For standard diagrams, centre in the available space
        wrapper.style.overflow = "visible";

        debugLog(
          `Applied transform for standard diagram: scale=${safeScale}, translated=(${safeTranslateX}px, ${safeTranslateY}px)`
        );
      }
    }
  }

  /**
   * Ensure the diagram is fully visible by applying direct size adjustments
   * @param {string} containerId - Unique ID for this container
   */
  function ensureDiagramVisibility(containerId) {
    const state = containerStates.get(containerId);
    if (!state) return;

    const { container, wrapper, diagram, diagramTypes } = state;

    if (!diagramTypes) return;

    debugLog("Applying fallback visibility fix", {
      containerId,
      diagramTypes,
    });

    // Apply fixes based on diagram type
    if (diagramTypes.isWide || diagramTypes.isHorizontalFlow) {
      // Force explicit dimensions for wide diagrams
      wrapper.style.width = "100%";
      wrapper.style.maxWidth = "100%";
      wrapper.style.height = "auto";
      wrapper.style.minHeight = "90vh";
      wrapper.style.overflow = "auto";

      // Ensure the diagram has a reasonable width
      diagram.style.width = "auto";
      diagram.style.maxWidth = "none";
      diagram.style.minWidth = "95%";
      diagram.style.margin = "1rem auto";
    } else {
      // For standard diagrams
      wrapper.style.height = "auto";
      wrapper.style.minHeight = "auto";
      wrapper.style.maxHeight = "none";
      wrapper.style.overflow = "visible";

      diagram.style.maxWidth = "100%";
      diagram.style.margin = "0 auto";
    }

    // Apply transform to ensure proper positioning
    applyTransform(containerId);

    debugLog("Applied fallback visibility fix", {
      wrapperStyles: {
        width: wrapper.style.width,
        height: wrapper.style.height,
        minHeight: wrapper.style.minHeight,
        overflow: wrapper.style.overflow,
      },
      diagramStyles: {
        width: diagram.style.width,
        maxWidth: diagram.style.maxWidth,
        margin: diagram.style.margin,
      },
    });
  }

  /**
   * Zoom in the diagram
   * @param {string} containerId - Unique ID for this container
   */
  function zoomIn(containerId) {
    const state = containerStates.get(containerId);
    if (!state) return;

    // Increase scale by zoom step, but not beyond max zoom
    state.scale = Math.min(state.scale + config.zoomStep, config.maxZoom);

    applyTransform(containerId);
    logDebug(`Zoomed in to ${state.scale.toFixed(2)}x`);
  }

  /**
   * Zoom out the diagram
   * @param {string} containerId - Unique ID for this container
   */
  function zoomOut(containerId) {
    const state = containerStates.get(containerId);
    if (!state) return;

    // Decrease scale by zoom step, but not below min zoom
    state.scale = Math.max(state.scale - config.zoomStep, config.minZoom);

    applyTransform(containerId);
    logDebug(`Zoomed out to ${state.scale.toFixed(2)}x`);
  }

  /**
   * Pan up
   * @param {string} containerId - Unique ID for this container
   */
  function panUp(containerId) {
    const state = containerStates.get(containerId);
    if (!state) return;

    state.translateY += config.panStep;
    applyTransform(containerId);
  }

  /**
   * Pan down
   * @param {string} containerId - Unique ID for this container
   */
  function panDown(containerId) {
    const state = containerStates.get(containerId);
    if (!state) return;

    state.translateY -= config.panStep;
    applyTransform(containerId);
  }

  /**
   * Pan left
   * @param {string} containerId - Unique ID for this container
   */
  function panLeft(containerId) {
    const state = containerStates.get(containerId);
    if (!state) return;

    state.translateX += config.panStep;
    applyTransform(containerId);
  }

  /**
   * Pan right
   * @param {string} containerId - Unique ID for this container
   */
  function panRight(containerId) {
    const state = containerStates.get(containerId);
    if (!state) return;

    state.translateX -= config.panStep;
    applyTransform(containerId);
  }

  /**
   * Reset view to original position and scale
   * @param {string} containerId - Unique ID for this container
   */
  function resetView(containerId) {
    const state = containerStates.get(containerId);
    if (!state) return;

    // Reset to initial values
    state.scale = 1;
    state.translateX = 0;
    state.translateY = 0;

    applyTransform(containerId);
    logInfo(`View reset for container ${containerId}`);
  }

  /**
   * Activates pan-zoom functionality for a container in fullscreen mode
   * @param {HTMLElement} container - The container element
   */
  function activateForContainer(container) {
    if (!container) {
      logWarn("Cannot activate: Container is null or undefined");
      return;
    }

    // Only proceed if container is in fullscreen mode
    if (!container.classList.contains("fullscreen-mode")) {
      logDebug("Container not in fullscreen mode, skipping activation");
      return;
    }

    // Ensure container has an ID
    if (!container.id) {
      logWarn("Container missing ID, generating one");
      container.id = `mermaid-container-${Date.now()}`;
    }

    const containerId = container.id;
    const diagramCode = container.getAttribute("data-diagram-code") || "";

    // Debug log the container and diagram details
    debugLog(`Activating container ${containerId}`, {
      containerDimensions: container.getBoundingClientRect(),
      diagramCode: diagramCode,
      containerClasses: container.className,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    });
    // Add this check to remove any existing control panels before adding a new one
    cleanupDuplicateControls(container, containerId);
    // Initialize container if not already done
    initContainer(container, containerId);

    // Show control panel
    const controlPanel = container.querySelector(
      `.${config.controlPanelClass}`
    );
    if (controlPanel) {
      controlPanel.style.display = "flex";
    }

    // Auto-fit diagram to screen with multiple attempts to ensure proper scaling
    setTimeout(() => {
      fitDiagramToScreen(containerId);

      // Make additional attempts with increasing delays
      setTimeout(() => fitDiagramToScreen(containerId), 200);

      // Final attempt with fallback visibility fix
      setTimeout(() => {
        fitDiagramToScreen(containerId);
        ensureDiagramVisibility(containerId);
      }, 500);
    }, 100);
  }

  /**
   * Deactivates pan-zoom functionality for a container
   * @param {HTMLElement} container - The container element
   */
  function deactivateForContainer(container) {
    if (!container || !container.id) return;

    const containerId = container.id;
    logInfo(`Deactivating for container ${containerId}`);

    cleanupDuplicateControls(container, containerId);

    // Hide control panel
    const controlPanel = container.querySelector(
      `.${config.controlPanelClass}`
    );
    if (controlPanel) {
      controlPanel.style.display = "none";
    }

    // Reset view
    resetView(container.id);

    // Get state for this container
    const state = containerStates.get(containerId);
    if (state && state.diagram && state.wrapper) {
      try {
        // Restore original DOM structure
        const diagram = state.diagram;
        const wrapper = state.wrapper;

        // Only unwrap if the diagram is still in the wrapper
        if (diagram.parentElement === wrapper) {
          // Move the diagram back to its original parent
          wrapper.parentNode.insertBefore(diagram, wrapper);

          // Remove the wrapper
          if (wrapper.parentNode) {
            wrapper.parentNode.removeChild(wrapper);
          }

          // Reset all styles on the diagram
          diagram.style.transform = "";
          diagram.style.transformOrigin = "";
          diagram.style.width = "";
          diagram.style.maxWidth = "";
          diagram.style.minWidth = "";
          diagram.style.height = "";
          diagram.style.maxHeight = "";
          diagram.style.minHeight = "";
          diagram.style.margin = "";
          diagram.style.overflow = "";

          // Remove wide diagram classes from container
          container.classList.remove("fullscreen-wide-diagram");

          // Force diagram back to reasonable dimensions
          diagram.style.maxWidth = "100%";
          diagram.style.margin = "0 auto";

          logInfo(
            `Restored original DOM structure for container ${containerId}`
          );
        }

        // Clear the state
        containerStates.delete(containerId);
      } catch (error) {
        logError(`Error restoring DOM structure:`, error);
      }
    }
  }

  // SVG Icons for buttons
  function getZoomInIcon() {
    return `<svg version="1.1" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.75 7.5a.75.75 0 0 1 .75-.75h2.25V4.5a.75.75 0 0 1 1.5 0v2.25h2.25a.75.75 0 0 1 0 1.5H8.25v2.25a.75.75 0 0 1-1.5 0V8.25H4.5a.75.75 0 0 1-.75-.75Z"></path>
        <path d="M7.5 0a7.5 7.5 0 0 1 5.807 12.247l2.473 2.473a.749.749 0 1 1-1.06 1.06l-2.473-2.473A7.5 7.5 0 1 1 7.5 0Zm-6 7.5a6 6 0 1 0 12 0 6 6 0 0 0-12 0Z"></path>
      </svg>`;
  }

  function getZoomOutIcon() {
    return `<svg version="1.1" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4.5 6.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1 0-1.5Z"></path>
        <path d="M0 7.5a7.5 7.5 0 1 1 13.307 4.747l2.473 2.473a.749.749 0 1 1-1.06 1.06l-2.473-2.473A7.5 7.5 0 0 1 0 7.5Zm7.5-6a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"></path>
      </svg>`;
  }

  function getResetIcon() {
    return `<svg version="1.1" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z"></path>
      </svg>`;
  }

  function getPanUpIcon() {
    return `<svg version="1.1" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.22 10.53a.749.749 0 0 1 0-1.06l4.25-4.25a.749.749 0 0 1 1.06 0l4.25 4.25a.749.749 0 1 1-1.06 1.06L8 6.811 4.28 10.53a.749.749 0 0 1-1.06 0Z"></path>
      </svg>`;
  }

  function getPanDownIcon() {
    return `<svg version="1.1" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path>
      </svg>`;
  }

  function getPanLeftIcon() {
    return `<svg version="1.1" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M9.78 12.78a.75.75 0 0 1-1.06 0L4.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L6.06 8l3.72 3.72a.75.75 0 0 1 0 1.06Z"></path>
      </svg>`;
  }

  function getPanRightIcon() {
    return `<svg version="1.1" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"></path>
      </svg>`;
  }

  /**
   * Automatically scale diagram to fit the screen
   * @param {string} containerId - Unique ID for this container
   */

  /**
   * Automatically scale diagram to fit the screen
   * @param {string} containerId - Unique ID for this container
   */
  function fitDiagramToScreen(containerId) {
    const state = containerStates.get(containerId);
    if (!state) {
      logWarn(`Cannot fit diagram: No state for container ${containerId}`);
      return null;
    }

    try {
      const { diagram, wrapper, container, diagramTypes } = state;

      debugLog(`Fitting diagram to screen for ${containerId}`, {
        diagramTypes: diagramTypes,
      });

      // Get the current dimensions
      const containerRect = container.getBoundingClientRect();
      const diagramRect = diagram.getBoundingClientRect();

      debugLog("Current dimensions", {
        containerRect,
        diagramRect,
        windowHeight: window.innerHeight,
        documentHeight: document.documentElement.clientHeight,
      });

      // Calculate available space with some margins
      const availableWidth = containerRect.width * 0.95;
      const availableHeight = containerRect.height * 0.9;

      // Calculate scale needed for width and height
      const widthScale = availableWidth / diagramRect.width;
      const heightScale = availableHeight / diagramRect.height;

      debugLog("Scaling factors", {
        availableWidth,
        availableHeight,
        widthScale,
        heightScale,
      });

      let scale;

      // Special handling for wide diagrams
      if (diagramTypes && diagramTypes.isWide) {
        // For wide diagrams, prioritise getting the full width visible
        scale = Math.min(widthScale, heightScale * 2);

        // Ensure the wrapper allows scrolling if needed
        wrapper.style.overflowY = "auto";

        debugLog("Wide diagram scaling applied", {
          scale,
          overflowY: wrapper.style.overflowY,
        });
      }
      // Special handling for very tall diagrams
      else if (diagramTypes && diagramTypes.isTall) {
        // For very tall diagrams, prioritise height fitting
        scale = heightScale * 0.95;
        debugLog("Tall diagram scaling applied", { scale });
      } else {
        // Standard approach for normal aspect ratios
        scale = Math.min(widthScale, heightScale, config.maxZoom);
        debugLog("Standard diagram scaling applied", { scale });
      }

      // Ensure the scale is within acceptable bounds
      scale = Math.max(Math.min(scale, config.maxZoom), config.minZoom);

      // Calculate centred position - ensuring the diagram is centred
      const scaledWidth = diagramRect.width * scale;
      const scaledHeight = diagramRect.height * scale;

      const centerX = (containerRect.width - scaledWidth) / 2;
      // For wide diagrams, position higher in the viewport
      const centerY =
        diagramTypes && diagramTypes.isWide
          ? 20
          : (containerRect.height - scaledHeight) / 2;

      // Ensure centerX and centerY are valid numbers
      state.scale = scale || 1; // Fallback to 1 if scale is invalid
      state.translateX = isNaN(centerX) ? 0 : centerX;
      state.translateY = isNaN(centerY) ? 0 : centerY;

      // Apply the transformation
      applyTransform(containerId);

      debugLog(
        `Diagram fitted with scale: ${scale.toFixed(
          2
        )}, position: (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`
      );

      return scale;
    } catch (error) {
      logError(`Error in fitDiagramToScreen:`, error);
      return null;
    }
  }

  // Public API
  const api = {
    activateForContainer,
    deactivateForContainer,
    zoomIn,
    zoomOut,
    resetView,
    panUp,
    panDown,
    panLeft,
    panRight,
    fitDiagramToScreen,
    config, // Expose config for customisation
    // Expose logging controls
    setLogLevel,
    LOG_LEVELS,
  };

  // Make sure the module is globally accessible
  if (typeof window !== "undefined") {
    logInfo("Exposing module globally");
    window.MermaidPanZoom = api;

    // Dispatch an event when fully loaded
    const event = new CustomEvent("mermaid-pan-zoom-loaded", {
      detail: api,
    });
    document.dispatchEvent(event);
  }
  // Usage note for fullscreenMode configuration
  logInfo("fullscreenMode configuration options:");
  logInfo(
    "  - 'auto': Automatically select the best fullscreen method (default)"
  );
  logInfo("  - 'native': Always use the native Fullscreen API if available");
  logInfo("  - 'css': Always use CSS-based fullscreen");
  return api;
})();
