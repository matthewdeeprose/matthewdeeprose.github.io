/**
 * Chart View Controls
 * Adds width toggle and fullscreen capabilities to Chart.js charts
 */

const ChartViewControls = (function () {
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

  // Logging helper functions
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Chart View Controls] ${message}`);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Chart View Controls] ${message}`);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.info(`[Chart View Controls] ${message}`);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Chart View Controls] ${message}`);
    }
  }

  // Configuration
  const config = {
    expandText: "Expand Width",
    collapseText: "Collapse Width",
    fullscreenText: "Fullscreen",
    exitFullscreenText: "Exit Fullscreen",
    expandedClass: "expanded",
    fullscreenClass: "fullscreen-mode",
    viewControlsClass: "chart-view-controls",
    buttonClass: "chart-view-button",
    ariaLiveRegionId: "chart-view-announcer",
  };

  // State management
  const state = {
    fullscreenEnabled: false,
    activeFullscreenContainer: null,
    scrollPositionX: 0,
    scrollPositionY: 0,
  };

  // DOM element references
  let elements = {
    announcer: null,
  };

  /**
   * Create screen reader announcer element
   */
  function createScreenReaderAnnouncer() {
    if (document.getElementById(config.ariaLiveRegionId)) {
      elements.announcer = document.getElementById(config.ariaLiveRegionId);
      return;
    }

    elements.announcer = document.createElement("div");
    elements.announcer.id = config.ariaLiveRegionId;
    elements.announcer.className = "sr-only";
    elements.announcer.setAttribute("aria-live", "polite");
    elements.announcer.setAttribute("aria-atomic", "true");
    document.body.appendChild(elements.announcer);
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   */
  function announceToScreenReader(message) {
    if (!elements.announcer) {
      logWarn("Screen reader announcer not initialised");
      return;
    }

    logDebug(`Announcing: ${message}`);

    // Set the message to be announced
    elements.announcer.textContent = message;

    // After a delay, clear the announcer
    setTimeout(() => {
      elements.announcer.textContent = "";
    }, 3000);
  }

  /**
   * Initialize controls on all Chart.js charts
   * @param {HTMLElement} container - Container element (defaults to document)
   */
  function init(container = document) {
    if (!container) {
      logWarn("No container provided");
      return;
    }

    // Check if fullscreen is supported
    state.fullscreenEnabled =
      document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.msFullscreenEnabled;

    // Create screen reader announcer
    createScreenReaderAnnouncer();

    // Find all Chart containers without view controls
    const chartContainers = container.querySelectorAll(
      ".chart-container:not(.view-controls-added)"
    );

    if (chartContainers.length === 0) {
      return;
    }

    logInfo(`Adding controls to ${chartContainers.length} charts`);

    // Add controls to each chart
    chartContainers.forEach((container, index) => {
      addViewControlsToContainer(container, index);
    });

    // Set up global event listeners for fullscreen changes and escape key
    setupGlobalEventListeners();
  }

  /**
   * Set up global event listeners
   */
  function setupGlobalEventListeners() {
    // Only add these listeners once
    if (document.querySelector(".view-controls-added")) {
      return;
    }

    // Listen for fullscreen change events
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    // Listen for escape key to exit fullscreen - make sure this is properly attached
    document.addEventListener("keydown", handleEscapeKey);
    logDebug("Added Escape key event listener");

    // Set a periodic check to ensure buttons reflect correct state
    setInterval(resetAllFullscreenButtons, 2000); // Check every 2 seconds

    logDebug("Global event listeners set up");
  }

  /**
   * Add view controls to a specific container
   * @param {HTMLElement} container - The chart container
   * @param {number} index - Container index for unique IDs
   */
  function addViewControlsToContainer(container, index) {
    // Skip if already processed
    if (container.classList.contains("view-controls-added")) {
      return;
    }

    // Mark as processed
    container.classList.add("view-controls-added");

    // Create unique ID for this container if not present
    const containerId =
      container.id || `chart-container-${index}-${Date.now()}`;
    if (!container.id) {
      container.id = containerId;
      logDebug(`Added ID to container: ${containerId}`);
    }

    // Create view controls container
    const viewControls = document.createElement("div");
    viewControls.className = config.viewControlsClass;
    viewControls.setAttribute("role", "toolbar");
    viewControls.setAttribute("aria-label", "Chart view controls");

    // Create expand/collapse button
    const expandButton = createButton(
      getExpandIcon(),
      config.expandText,
      `toggle-width-${containerId}`,
      "Toggle chart width"
    );

    // Create fullscreen button
    const fullscreenButton = createButton(
      getFullscreenIcon(),
      config.fullscreenText,
      `toggle-fullscreen-${containerId}`,
      "Toggle fullscreen mode"
    );

    // Add event listeners
    expandButton.addEventListener("click", function () {
      toggleWidth(container, expandButton);
    });

    fullscreenButton.addEventListener("click", function () {
      toggleFullscreen(container, fullscreenButton);
    });

    // Add direct container-level event listener for Escape key
    container.addEventListener("keydown", function (event) {
      if (
        event.key === "Escape" &&
        container.classList.contains(config.fullscreenClass)
      ) {
        logDebug("Escape key detected at container level");
        exitFullscreen(container);
        event.preventDefault();
        event.stopPropagation();
      }
    });

    // Add buttons to controls
    viewControls.appendChild(expandButton);
    viewControls.appendChild(fullscreenButton);

    // Insert view controls at the beginning of the container
    if (container.firstChild) {
      container.insertBefore(viewControls, container.firstChild);
    } else {
      container.appendChild(viewControls);
    }
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
    button.className = config.buttonClass;
    button.innerHTML = `${icon} <span class="button-text">${text}</span>`;
    button.setAttribute("aria-label", ariaLabel);
    button.setAttribute("type", "button");
    return button;
  }

  /**
   * Toggle width of a chart container
   * @param {HTMLElement} container - The chart container
   * @param {HTMLElement} button - The toggle button
   */
  function toggleWidth(container, button) {
    const isExpanded = container.classList.toggle(config.expandedClass);

    // Update button text and icon
    if (isExpanded) {
      button.innerHTML = `${getCollapseIcon()} <span class="button-text">${
        config.collapseText
      }</span>`;
      announceToScreenReader("Chart expanded to full width");
    } else {
      button.innerHTML = `${getExpandIcon()} <span class="button-text">${
        config.expandText
      }</span>`;
      announceToScreenReader("Chart width collapsed");
    }

    // Trigger resize event to help charts adjust
    window.dispatchEvent(new Event("resize"));

    // If ChartJs instance exists, update it
    const canvas = container.querySelector("canvas");
    if (canvas) {
      const chartInstance = Chart.getChart(canvas);
      if (chartInstance) {
        chartInstance.resize();
      }
    }
  }

  /**
   * Toggle fullscreen mode for a chart container
   * @param {HTMLElement} container - The chart container
   * @param {HTMLElement} button - The fullscreen button
   */
  function toggleFullscreen(container, button) {
    logDebug("Toggle fullscreen clicked");

    // Check if this container is already in fullscreen
    const isFullscreen =
      document.fullscreenElement === container ||
      container.classList.contains(config.fullscreenClass);

    if (isFullscreen) {
      coordinateWithAccessibility("exit", container);
      exitFullscreen(container);
    } else {
      coordinateWithAccessibility("enter", container);
      enterFullscreen(container, button);
    }
  }

  /**
   * Enter fullscreen mode
   * @param {HTMLElement} container - The chart container
   * @param {HTMLElement} button - The fullscreen button
   */
  function enterFullscreen(container, button) {
    logInfo("Entering fullscreen mode");
    logDebug("Container ID: " + container.id);

    // Save the active element to restore focus later
    container.dataset.previousFocus = document.activeElement
      ? document.activeElement.id
      : "";

    // Save current scroll position
    state.scrollPositionX =
      window.pageXOffset || document.documentElement.scrollLeft;
    state.scrollPositionY =
      window.pageYOffset || document.documentElement.scrollTop;

    logDebug(
      `Saved scroll position: ${state.scrollPositionX}, ${state.scrollPositionY}`
    );

    // Use CSS-based fullscreen
    enableCssFullscreen(container, button);
  }

  /**
   * Enable CSS-based fullscreen (fallback method)
   * @param {HTMLElement} container - The chart container
   * @param {HTMLElement} button - The fullscreen button
   */
  function enableCssFullscreen(container, button) {
    logDebug("Enabling CSS fullscreen for container: " + container.id);

    // Make sure container can receive focus and keyboard events
    if (!container.hasAttribute("tabindex")) {
      container.setAttribute("tabindex", "-1");
    }

    // Add fullscreen class and prevent page scrolling
    container.classList.add(config.fullscreenClass);
    document.body.style.overflow = "hidden";

    // Mark container as being in fullscreen to prevent scroll adjustments
    container.setAttribute("data-in-fullscreen", "true");

    // Hide the width toggle button explicitly
    toggleWidthButtonVisibility(container, false);

    // Store references to controls that need special handling
    const exportControls = container.querySelector(".chart-controls");
    const accessibilityTable = document.getElementById(
      `chart-data-table-container-${container.id.replace(
        "chart-container-",
        ""
      )}`
    );
    const accessibilityDescription = document.getElementById(
      `chart-description-${container.id.replace("chart-container-", "")}`
    );

    // Hide chart export controls in fullscreen mode
    if (exportControls) {
      exportControls.setAttribute("data-fullscreen-hidden", "true");
      exportControls.style.display = "none";
    }

    // Hide accessibility table if present (will be restored on exit)
    if (accessibilityTable) {
      accessibilityTable.setAttribute("data-fullscreen-hidden", "true");
      accessibilityTable.style.display = "none";
    }

    // Hide accessibility description if present
    if (accessibilityDescription) {
      accessibilityDescription.setAttribute("data-fullscreen-hidden", "true");
      accessibilityDescription.style.display = "none";
    }

    // Mark this container as the active fullscreen element
    state.activeFullscreenContainer = container;

    // Update the button appearance
    updateFullscreenButtonInContainer(container, true);

    // Resize chart to fit fullscreen while maintaining aspect ratio
    const canvas = container.querySelector("canvas");
    if (canvas) {
      const chartInstance = Chart.getChart(canvas);
      if (chartInstance) {
        // Add a short delay to ensure the fullscreen transition completes
        setTimeout(() => {
          // Get current dimensions to calculate aspect ratio
          const originalWidth = chartInstance.width || canvas.width;
          const originalHeight = chartInstance.height || canvas.height;
          const aspectRatio = originalWidth / originalHeight;

          logDebug(
            `Original chart dimensions: ${originalWidth}x${originalHeight}, aspect ratio: ${aspectRatio}`
          );

          // Store original aspect ratio for later use
          container.dataset.originalAspectRatio = aspectRatio;

          // Calculate dimensions to fit screen while maintaining aspect ratio
          // Use a larger percentage of available space
          const availableWidth = window.innerWidth * 0.95;
          const availableHeight = window.innerHeight * 0.85;

          logDebug(`Available space: ${availableWidth}x${availableHeight}`);

          // Determine which dimension is the constraint
          let newWidth, newHeight;

          if (availableWidth / availableHeight > aspectRatio) {
            // Height is the constraint
            newHeight = availableHeight;
            newWidth = newHeight * aspectRatio;
          } else {
            // Width is the constraint
            newWidth = availableWidth;
            newHeight = newWidth / aspectRatio;
          }

          logDebug(`New dimensions: ${newWidth}x${newHeight}`);

          // Apply new dimensions directly to the chart configuration
          try {
            // Update canvas styles
            canvas.style.width = `${newWidth}px`;
            canvas.style.height = `${newHeight}px`;
            canvas.style.maxWidth = `${newWidth}px`;
            canvas.style.maxHeight = `${newHeight}px`;
            canvas.style.display = "block";
            canvas.style.margin = "auto";

            // Force chart resize
            chartInstance.resize();

            // Apply fixed position styles to center the chart
            container.style.display = "flex";
            container.style.alignItems = "center";
            container.style.justifyContent = "center";
          } catch (e) {
            logError("Error during resize: " + e.message);
          }
        }, 300);
      }
    }

    announceToScreenReader("Entered fullscreen mode");

    // Focus on the container itself to enable keyboard events
    setTimeout(() => container.focus(), 50);

    // Then focus on the fullscreen button for keyboard users
    if (button) setTimeout(() => button.focus(), 100);
  }

  /**
   * Restore focus to the previous element after exiting fullscreen
   * @param {HTMLElement} container - The container element
   */
  function restoreFocus(container) {
    if (!container) return;

    // Check if we saved a previous focus element ID
    const previousFocusId = container.dataset.previousFocus;

    if (previousFocusId) {
      // Try to find the element and focus it
      const elementToFocus = document.getElementById(previousFocusId);
      if (elementToFocus) {
        logDebug("Restoring focus to element: " + previousFocusId);
        setTimeout(() => elementToFocus.focus(), 100);
      }
    } else {
      // Default to focusing the container itself
      setTimeout(() => container.focus(), 100);
    }

    // Clear the stored focus ID
    delete container.dataset.previousFocus;
  }

  /**
   * Exit fullscreen mode
   * @param {HTMLElement} container - The chart container
   */
  function exitFullscreen(container) {
    logInfo("Exiting fullscreen mode");

    // Store reference to the active container for restoration
    const activeContainer = container || state.activeFullscreenContainer;

    // Find and update the fullscreen button directly
    if (activeContainer) {
      // Remove the fullscreen flag
      activeContainer.removeAttribute("data-in-fullscreen");

      const containerId = activeContainer.id;
      const fullscreenButton = document.getElementById(
        `toggle-fullscreen-${containerId}`
      );
      if (fullscreenButton) {
        logDebug("Directly updating fullscreen button to enter mode");
        fullscreenButton.innerHTML = `${getFullscreenIcon()} <span class="button-text">${
          config.fullscreenText
        }</span>`;
        fullscreenButton.setAttribute("aria-label", "Enter fullscreen mode");
      }

      // Restore previously hidden controls
      const exportControls = activeContainer.querySelector(".chart-controls");
      if (
        exportControls &&
        exportControls.getAttribute("data-fullscreen-hidden") === "true"
      ) {
        exportControls.removeAttribute("data-fullscreen-hidden");
        exportControls.style.display = "flex";
      }

      // Get chart ID from container ID (strip 'chart-container-' prefix if present)
      const chartId = containerId.replace("chart-container-", "");

      // Restore accessibility elements
      const accessibilityTable = document.getElementById(
        `chart-data-table-container-${chartId}`
      );
      if (
        accessibilityTable &&
        accessibilityTable.getAttribute("data-fullscreen-hidden") === "true"
      ) {
        accessibilityTable.removeAttribute("data-fullscreen-hidden");
        accessibilityTable.style.display = "block";
      }

      const accessibilityDescription = document.getElementById(
        `chart-description-${chartId}`
      );
      if (
        accessibilityDescription &&
        accessibilityDescription.getAttribute("data-fullscreen-hidden") ===
          "true"
      ) {
        accessibilityDescription.removeAttribute("data-fullscreen-hidden");
        accessibilityDescription.style.display = "block";
      }

      // Check if we're in CSS fullscreen
      if (activeContainer.classList.contains(config.fullscreenClass)) {
        logDebug("Exiting CSS fullscreen");

        activeContainer.classList.remove(config.fullscreenClass);
        document.body.style.overflow = ""; // Restore scrolling

        // Restore visibility of width toggle button
        toggleWidthButtonVisibility(activeContainer, true);

        // Clear active container reference
        state.activeFullscreenContainer = null;

        announceToScreenReader("Exited fullscreen mode");

        // Restore focus to previous element
        restoreFocus(activeContainer);

        // Resize chart to normal size
        const canvas = activeContainer.querySelector("canvas");
        if (canvas) {
          const chartInstance = Chart.getChart(canvas);
          if (chartInstance) {
            // Reset canvas styles completely
            canvas.style.width = "";
            canvas.style.height = "";
            canvas.style.maxWidth = "";
            canvas.style.maxHeight = "";
            canvas.style.margin = "";
            canvas.style.position = "";
            canvas.style.top = "";
            canvas.style.transform = "";
            canvas.style.display = "";

            // Reset container styles
            activeContainer.style.display = "";
            activeContainer.style.alignItems = "";
            activeContainer.style.justifyContent = "";
            activeContainer.style.height = "";
            activeContainer.style.position = "";

            // Resize the chart
            try {
              chartInstance.resize();
            } catch (e) {
              logWarn("Error during resize: " + e.message);
            }

            logDebug("Reset chart to original dimensions");
          }
        }

        // Restore scroll position after a small delay to allow DOM updates
        setTimeout(() => {
          logDebug(
            `Restoring scroll position to: ${state.scrollPositionX}, ${state.scrollPositionY}`
          );
          window.scrollTo(state.scrollPositionX, state.scrollPositionY);

          // Scroll the container into view for better user experience
          if (activeContainer) {
            activeContainer.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }
        }, 100);
      }
    }
  }

  /**
   * Coordinate with accessibility module if present
   * @param {string} action - The action being performed ('enter' or 'exit')
   * @param {HTMLElement} container - The chart container
   */
  function coordinateWithAccessibility(action, container) {
    if (!container) return;

    // Check if accessibility module exists
    if (window.ChartAccessibility) {
      logDebug(`Coordinating ${action} fullscreen with accessibility module`);

      // Get chart ID from container ID
      const containerId = container.id;
      const chartId = containerId.replace("chart-container-", "");

      if (action === "enter") {
        // Notify accessibility module we're entering fullscreen
        if (
          typeof window.ChartAccessibility.announceToScreenReader === "function"
        ) {
          window.ChartAccessibility.announceToScreenReader(
            "Entering fullscreen mode"
          );
        }
      } else if (action === "exit") {
        // Notify accessibility module we're exiting fullscreen
        if (
          typeof window.ChartAccessibility.announceToScreenReader === "function"
        ) {
          window.ChartAccessibility.announceToScreenReader(
            "Exiting fullscreen mode"
          );
        }

        // Force accessibility tables to resize properly
        setTimeout(() => {
          if (document.getElementById(`chart-data-table-${chartId}`)) {
            logDebug(`Trigger table refresh for chart ${chartId}`);
            // Force a resize event to help tables adjust
            window.dispatchEvent(new Event("resize"));
          }
        }, 200);
      }
    }
  }

  /**
   * Handle fullscreen change events from the browser
   */
  function handleFullscreenChange() {
    const isInFullscreen =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement;

    logDebug("Fullscreen change detected. In fullscreen: " + !!isInFullscreen);

    if (!isInFullscreen) {
      // We've exited fullscreen mode
      const container = state.activeFullscreenContainer;

      if (container) {
        // Find the button for this container and update it directly
        const fullscreenButton = document.getElementById(
          `toggle-fullscreen-${container.id}`
        );
        if (fullscreenButton) {
          logDebug("Found fullscreen button, updating to enter mode");
          fullscreenButton.innerHTML = `${getFullscreenIcon()} <span class="button-text">${
            config.fullscreenText
          }</span>`;
          fullscreenButton.setAttribute("aria-label", "Enter fullscreen mode");
        }

        // Remove the fullscreen class and restore normal state
        container.classList.remove(config.fullscreenClass);
        document.body.style.overflow = ""; // Restore scrolling

        // Restore width toggle button
        toggleWidthButtonVisibility(container, true);

        // Clear active container reference
        state.activeFullscreenContainer = null;

        announceToScreenReader("Exited fullscreen mode");

        // Restore focus
        restoreFocus(container);

        // Resize chart to normal size
        const canvas = container.querySelector("canvas");
        if (canvas) {
          const chartInstance = Chart.getChart(canvas);
          if (chartInstance) {
            chartInstance.resize();
          }
        }
      }
    }
  }

  /**
   * Update all fullscreen button appearances in a container
   * @param {HTMLElement} container - The chart container
   * @param {boolean} isFullscreen - Whether in fullscreen mode
   */
  function updateFullscreenButtonInContainer(container, isFullscreen) {
    if (!container) return;

    // Find the fullscreen button in this container
    const containerId = container.id;
    const fullscreenButton = document.getElementById(
      `toggle-fullscreen-${containerId}`
    );

    if (fullscreenButton) {
      logDebug(
        "Updating fullscreen button to: " +
          (isFullscreen ? "exit" : "enter") +
          " mode"
      );

      if (isFullscreen) {
        fullscreenButton.innerHTML = `${getExitFullscreenIcon()} <span class="button-text">${
          config.exitFullscreenText
        }</span>`;
        fullscreenButton.setAttribute("aria-label", "Exit fullscreen mode");
      } else {
        fullscreenButton.innerHTML = `${getFullscreenIcon()} <span class="button-text">${
          config.fullscreenText
        }</span>`;
        fullscreenButton.setAttribute("aria-label", "Enter fullscreen mode");
      }
    }
  }

  /**
   * Handle escape key press to exit fullscreen
   * @param {KeyboardEvent} event - The keyboard event
   */
  function handleEscapeKey(event) {
    if (event.key === "Escape") {
      // Get all containers that are in fullscreen mode
      const fullscreenContainers = document.querySelectorAll(
        `.${config.fullscreenClass}`
      );

      if (fullscreenContainers.length > 0) {
        logDebug(
          `Escape key detected, found ${fullscreenContainers.length} fullscreen containers`
        );

        // Exit fullscreen for all containers that have the fullscreen class
        fullscreenContainers.forEach((container) => {
          exitFullscreen(container);
        });

        // Check specifically for our active container
        if (state.activeFullscreenContainer) {
          exitFullscreen(state.activeFullscreenContainer);
        }

        event.preventDefault(); // Prevent other escape handlers
        event.stopPropagation(); // Stop event bubbling

        return false; // Try to stop the event completely
      }
    }
  }

  /**
   * Reset all fullscreen buttons to their default state
   * This is a catch-all solution for when normal update methods fail
   */
  function resetAllFullscreenButtons() {
    logDebug("Resetting all fullscreen buttons");

    // Find all fullscreen toggle buttons
    const fullscreenButtons = document.querySelectorAll(
      'button[id^="toggle-fullscreen-"]'
    );

    fullscreenButtons.forEach((button) => {
      // Get container ID from button ID
      const containerId = button.id.replace("toggle-fullscreen-", "");
      const container = document.getElementById(containerId);

      // Check if container is in fullscreen
      const isInFullscreen =
        container &&
        (container === document.fullscreenElement ||
          container === document.webkitFullscreenElement ||
          container === document.mozFullScreenElement ||
          container === document.msFullscreenElement ||
          container.classList.contains(config.fullscreenClass));

      // Update button based on fullscreen state
      if (isInFullscreen) {
        button.innerHTML = `${getExitFullscreenIcon()} <span class="button-text">${
          config.exitFullscreenText
        }</span>`;
        button.setAttribute("aria-label", "Exit fullscreen mode");
      } else {
        button.innerHTML = `${getFullscreenIcon()} <span class="button-text">${
          config.fullscreenText
        }</span>`;
        button.setAttribute("aria-label", "Enter fullscreen mode");
      }
    });
  }

  /**
   * Toggle visibility of the width toggle button
   * @param {HTMLElement} container - The chart container
   * @param {boolean} isVisible - Whether the button should be visible
   */
  function toggleWidthButtonVisibility(container, isVisible) {
    if (!container) return;

    const widthToggleButton = container.querySelector(
      'button[id^="toggle-width-"]'
    );
    if (widthToggleButton) {
      widthToggleButton.style.display = isVisible ? "" : "none";
    }
  }

  // SVG Icons
  function getExpandIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>`;
  }

  function getCollapseIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <polyline points="4 14 10 14 10 20"></polyline>
            <polyline points="20 10 14 10 14 4"></polyline>
            <line x1="14" y1="10" x2="21" y2="3"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>`;
  }

  function getFullscreenIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>`;
  }

  function getExitFullscreenIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
        </svg>`;
  }

  logInfo("Script loaded and initialising");

  // Initialize when DOM is fully loaded
  document.addEventListener("DOMContentLoaded", function () {
    init();

    // Also observe changes to handle dynamically added charts
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === "childList") {
          init(document.body);
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });

  // Public API
  return {
    init: init,
    toggleWidth: toggleWidth,
    toggleFullscreen: toggleFullscreen,
    exitFullscreen: exitFullscreen,
    coordinateWithAccessibility: coordinateWithAccessibility,
    setLogLevel: function (level) {
      if (Object.values(LOG_LEVELS).includes(level)) {
        currentLogLevel = level;
        logInfo("Log level set to: " + Object.keys(LOG_LEVELS)[level]);
      } else {
        logWarn("Invalid log level provided: " + level);
      }
    },
    getLogLevel: function () {
      return currentLogLevel;
    },
  };
})();

// Export statements stay outside the IIFE
if (typeof module !== "undefined" && module.exports) {
  module.exports = ChartViewControls;
} else if (typeof window !== "undefined") {
  window.ChartViewControls = ChartViewControls;
}
