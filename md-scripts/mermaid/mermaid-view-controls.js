/**
 * Mermaid View Controls
 * Adds width toggle and fullscreen capabilities to mermaid diagrams
 */
console.log("[Mermaid View Controls] Script loaded and initializing");

const MermaidViewControls = (function () {
  // Configuration
  const config = {
    expandText: "Expand Width",
    collapseText: "Collapse Width",
    fullscreenText: "Fullscreen",
    exitFullscreenText: "Exit Fullscreen",
    expandedClass: "expanded",
    fullscreenClass: "fullscreen-mode",
    viewControlsClass: "mermaid-view-controls",
    buttonClass: "mermaid-view-button",
    ariaLiveRegionId: "mermaid-view-announcer",
  };

  // State management
  const state = {
    fullscreenEnabled: false,
    activeFullscreenContainer: null,
    eventDelegationInstalled: false,
  };

  // DOM element references
  let elements = {
    announcer: null,
  };

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
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

  // ============================================================================
  // MODE DETECTION AND EVENT DELEGATION
  // ============================================================================

  /**
   * Detect if we're in OpenRouter mode
   * @returns {boolean} True if in OpenRouter mode
   */
  function isOpenRouterMode() {
    const openRouterRadio = document.getElementById("OpenRouter");
    return openRouterRadio && openRouterRadio.checked;
  }

  /**
   * Check if MermaidViewControls is available during runtime
   * @returns {boolean} True if MermaidViewControls is available
   */
  function isMermaidViewControlsAvailable() {
    return (
      typeof window.MermaidViewControls !== "undefined" &&
      window.MermaidViewControls !== null &&
      typeof window.MermaidViewControls.init === "function"
    );
  }

  /**
   * Install document-level event delegation for OpenRouter compatibility
   */
  function installEventDelegation() {
    if (state.eventDelegationInstalled) {
      logDebug("[Mermaid View Controls] Event delegation already installed");
      return;
    }

    logInfo(
      "[Mermaid View Controls] Installing event delegation for OpenRouter mode"
    );

    // Document-level click handler for width toggle buttons
    document.addEventListener("click", function (event) {
      const widthButton = event.target.closest(
        '.mermaid-view-button[id*="toggle-width-"]'
      );
      if (widthButton) {
        event.preventDefault();
        const container = widthButton.closest(".mermaid-container");
        if (container) {
          fallbackToggleWidth(container, widthButton);
        }
      }
    });

    // Document-level click handler for fullscreen toggle buttons
    document.addEventListener("click", function (event) {
      const fullscreenButton = event.target.closest(
        '.mermaid-view-button[id*="toggle-fullscreen-"]'
      );
      if (fullscreenButton) {
        event.preventDefault();
        const container = fullscreenButton.closest(".mermaid-container");
        if (container) {
          fallbackToggleFullscreen(container, fullscreenButton);
        }
      }
    });

    // Document-level keyboard handler for accessibility
    document.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        const button = event.target;
        if (button && button.classList.contains("mermaid-view-button")) {
          event.preventDefault();
          const container = button.closest(".mermaid-container");
          if (container) {
            if (button.id.includes("toggle-width-")) {
              fallbackToggleWidth(container, button);
            } else if (button.id.includes("toggle-fullscreen-")) {
              fallbackToggleFullscreen(container, button);
            }
          }
        }
      }
    });

    state.eventDelegationInstalled = true;
    logInfo("[Mermaid View Controls] Event delegation successfully installed");
  }

  /**
   * Fallback function to toggle width using direct DOM manipulation
   * @param {HTMLElement} container - The mermaid container
   * @param {HTMLElement} button - The toggle button
   */
  function fallbackToggleWidth(container, button) {
    try {
      // Use the existing toggleWidth function which has all the proper logic
      toggleWidth(container, button);
      logDebug(
        "[Mermaid View Controls] Width toggled via fallback using existing system"
      );
    } catch (error) {
      logError(
        "[Mermaid View Controls] Error in fallback width toggle:",
        error
      );
      // Only if the main function fails, use direct DOM manipulation
      const isExpanded = container.classList.contains(config.expandedClass);
      const buttonText = button.querySelector(".button-text");

      if (isExpanded) {
        container.classList.remove(config.expandedClass);
        if (buttonText) {
          buttonText.textContent = config.expandText;
        }
        button.innerHTML = `${getExpandIcon()} <span class="button-text">${
          config.expandText
        }</span>`;
        button.setAttribute("aria-label", "Expand diagram width");
        announceToScreenReader("Diagram width collapsed");
      } else {
        container.classList.add(config.expandedClass);
        if (buttonText) {
          buttonText.textContent = config.collapseText;
        }
        button.innerHTML = `${getCollapseIcon()} <span class="button-text">${
          config.collapseText
        }</span>`;
        button.setAttribute("aria-label", "Collapse diagram width");
        announceToScreenReader("Diagram width expanded");
      }

      // Trigger resize event to help diagrams adjust
      window.dispatchEvent(new Event("resize"));
    }
  }

  /**
   * Fallback function to toggle fullscreen using direct DOM manipulation
   * @param {HTMLElement} container - The mermaid container
   * @param {HTMLElement} button - The toggle button
   */
  function fallbackToggleFullscreen(container, button) {
    try {
      // Use the existing toggleFullscreen function which has all the sophisticated logic
      toggleFullscreen(container, button);
      logDebug(
        "[Mermaid View Controls] Fullscreen toggled via fallback using existing system"
      );
    } catch (error) {
      logError(
        "[Mermaid View Controls] Error in fallback fullscreen toggle, attempting direct approach:",
        error
      );

      // If the main function fails, try to use the existing enterFullscreen/exitFullscreen functions
      try {
        const isInFullscreen =
          document.fullscreenElement === container ||
          container.classList.contains(config.fullscreenClass);

        if (isInFullscreen) {
          // Use existing exitFullscreen function
          exitFullscreen(container);
          logDebug(
            "[Mermaid View Controls] Fullscreen exited via fallback using existing exitFullscreen"
          );
        } else {
          // Use existing enterFullscreen function
          enterFullscreen(container, button);
          logDebug(
            "[Mermaid View Controls] Fullscreen entered via fallback using existing enterFullscreen"
          );
        }
      } catch (innerError) {
        logError(
          "[Mermaid View Controls] Both fallback methods failed:",
          innerError
        );
        // Last resort: basic fullscreen API (this is what was causing the issue)
        const isInFullscreen = document.fullscreenElement === container;

        if (isInFullscreen) {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          }
        } else {
          if (container.requestFullscreen) {
            container.requestFullscreen();
          }
        }
      }
    }
  }

  /**
   * Check if MermaidPanZoom is loaded and available
   * @returns {boolean} Whether MermaidPanZoom is available
   */
  function isPanZoomAvailable() {
    const available =
      typeof window.MermaidPanZoom !== "undefined" &&
      window.MermaidPanZoom !== null &&
      typeof window.MermaidPanZoom.activateForContainer === "function";

    console.log(
      `[Mermaid View Controls] MermaidPanZoom availability check: ${available}`
    );
    return available;
  }

  /**
   * Try to load MermaidPanZoom if not already available
   * @returns {Promise} Promise that resolves when MermaidPanZoom is available
   */
  function ensurePanZoomAvailable() {
    return new Promise((resolve, reject) => {
      // If already available, resolve immediately
      if (isPanZoomAvailable()) {
        console.log("[Mermaid View Controls] MermaidPanZoom already available");
        resolve(window.MermaidPanZoom);
        return;
      }

      console.log(
        "[Mermaid View Controls] MermaidPanZoom not available, checking for script..."
      );

      // Check if the script exists
      const scriptExists = Array.from(document.scripts).some((script) =>
        script.src.includes("mermaid-pan-zoom.js")
      );

      if (!scriptExists) {
        console.error(
          "[Mermaid View Controls] mermaid-pan-zoom.js script not found!"
        );

        // Try to load the script dynamically as a last resort
        const script = document.createElement("script");
        script.src = "mermaid-pan-zoom.js";
        script.async = true;
        document.head.appendChild(script);

        console.log(
          "[Mermaid View Controls] Attempted to load mermaid-pan-zoom.js dynamically"
        );
      }

      // Listen for the custom event
      const eventListener = (e) => {
        console.log(
          "[Mermaid View Controls] Received mermaid-pan-zoom-loaded event"
        );
        document.removeEventListener("mermaid-pan-zoom-loaded", eventListener);
        resolve(e.detail);
      };

      document.addEventListener("mermaid-pan-zoom-loaded", eventListener);

      // Also use a timeout with regular checks as fallback
      console.log(
        "[Mermaid View Controls] Starting fallback polling for MermaidPanZoom"
      );
      let attempts = 0;
      const maxAttempts = 20; // Increase to 20 attempts
      const checkInterval = setInterval(() => {
        attempts++;

        if (isPanZoomAvailable()) {
          clearInterval(checkInterval);
          document.removeEventListener(
            "mermaid-pan-zoom-loaded",
            eventListener
          );
          console.log(
            "[Mermaid View Controls] MermaidPanZoom is now available (via polling)"
          );
          resolve(window.MermaidPanZoom);
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          document.removeEventListener(
            "mermaid-pan-zoom-loaded",
            eventListener
          );
          console.warn(
            "[Mermaid View Controls] MermaidPanZoom failed to load after multiple attempts"
          );

          // Create a minimal implementation to avoid errors
          console.log(
            "[Mermaid View Controls] Creating fallback implementation"
          );
          window.MermaidPanZoom = {
            activateForContainer: (container) => {
              console.log(
                "[Fallback MermaidPanZoom] Activation requested but not implemented"
              );
            },
            deactivateForContainer: (container) => {
              console.log(
                "[Fallback MermaidPanZoom] Deactivation requested but not implemented"
              );
            },
            fitDiagramToScreen: (containerId) => {
              console.log(
                "[Fallback MermaidPanZoom] Fit to screen requested but not implemented"
              );
              return null;
            },
          };

          resolve(window.MermaidPanZoom);
        }
      }, 250); // Check every 250ms
    });
  }

  /**
   * Initialize controls on all Mermaid diagrams
   * @param {HTMLElement} container - Container element (defaults to document)
   */
  function init(container = document) {
    if (!container) {
      console.warn("[Mermaid View Controls] No container provided");
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

    // Find all Mermaid containers without view controls
    const mermaidContainers = container.querySelectorAll(
      ".mermaid-container:not(.view-controls-added)"
    );

    if (mermaidContainers.length === 0) {
      return;
    }

    console.log(
      `[Mermaid View Controls] Adding controls to ${mermaidContainers.length} diagrams`
    );

    // Add controls to each diagram
    mermaidContainers.forEach((container, index) => {
      addViewControlsToContainer(container, index);
    });

    // Set up global event listeners for fullscreen changes and escape key
    setupGlobalEventListeners();

    // Check if we need event delegation for OpenRouter mode
    if (isOpenRouterMode() && !isMermaidViewControlsAvailable()) {
      logInfo(
        "[Mermaid View Controls] OpenRouter mode detected with unavailable MermaidViewControls - installing event delegation"
      );
      installEventDelegation();
    } else {
      logDebug("[Mermaid View Controls] Event delegation not needed", {
        openRouterMode: isOpenRouterMode(),
        mermaidViewControlsAvailable: isMermaidViewControlsAvailable(),
      });
    }
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

    // Listen for escape key to exit fullscreen
    document.addEventListener("keydown", handleEscapeKey);

    // Set a periodic check to ensure buttons reflect correct state
    setInterval(resetAllFullscreenButtons, 2000); // Check every 2 seconds

    console.log("[Mermaid View Controls] Global event listeners set up");
  }

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
      console.warn(
        "[Mermaid View Controls] Screen reader announcer not initialized"
      );
      return;
    }

    console.log(`[Mermaid View Controls] Announcing: ${message}`);

    // Set the message to be announced
    elements.announcer.textContent = message;

    // After a delay, clear the announcer
    setTimeout(() => {
      elements.announcer.textContent = "";
    }, 3000);
  }

  /**
   * Add view controls to a specific container
   * @param {HTMLElement} container - The mermaid container
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
      container.id || `mermaid-container-${index}-${Date.now()}`;
    if (!container.id) {
      container.id = containerId;
      console.log(
        `[Mermaid View Controls] Added ID to container: ${containerId}`
      );
    }

    // Create view controls container
    const viewControls = document.createElement("div");
    viewControls.className = config.viewControlsClass;
    viewControls.setAttribute("role", "toolbar");
    viewControls.setAttribute("aria-label", "Diagram view controls");

    // Create expand/collapse button
    const expandButton = createButton(
      getExpandIcon(),
      config.expandText,
      `toggle-width-${containerId}`,
      "Toggle diagram width"
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
   * Toggle width of a mermaid container
   * @param {HTMLElement} container - The mermaid container
   * @param {HTMLElement} button - The toggle button
   */
  function toggleWidth(container, button) {
    const isExpanded = container.classList.toggle(config.expandedClass);

    // Update button text and icon
    if (isExpanded) {
      button.innerHTML = `${getCollapseIcon()} <span class="button-text">${
        config.collapseText
      }</span>`;
      announceToScreenReader("Diagram expanded to full width");
    } else {
      button.innerHTML = `${getExpandIcon()} <span class="button-text">${
        config.expandText
      }</span>`;
      announceToScreenReader("Diagram width collapsed");
    }

    // Trigger resize event to help diagrams adjust
    window.dispatchEvent(new Event("resize"));
  }

  /**
   * Toggle fullscreen mode for a mermaid container
   * @param {HTMLElement} container - The mermaid container
   * @param {HTMLElement} button - The fullscreen button
   */
  function toggleFullscreen(container, button) {
    console.log("[Mermaid View Controls] Toggle fullscreen clicked");

    // Check if this container is already in fullscreen
    const isFullscreen =
      document.fullscreenElement === container ||
      container.classList.contains(config.fullscreenClass);

    if (isFullscreen) {
      exitFullscreen(container);
    } else {
      enterFullscreen(container, button);
    }
  }

  /**
   * Enter fullscreen mode
   * @param {HTMLElement} container - The mermaid container
   * @param {HTMLElement} button - The fullscreen button
   */
  /**
   * Enter fullscreen mode
   * @param {HTMLElement} container - The mermaid container
   * @param {HTMLElement} button - The fullscreen button
   */
  function enterFullscreen(container, button) {
    console.log("[Mermaid View Controls] Entering fullscreen mode");
    console.log("[Mermaid View Controls] Container ID:", container.id);

    // Save the active element to restore focus later
    container.dataset.previousFocus = document.activeElement
      ? document.activeElement.id
      : "";

    // Check the configuration setting to determine which fullscreen mode to use
    const fullscreenMode =
      window.MermaidPanZoom && window.MermaidPanZoom.config
        ? window.MermaidPanZoom.config.fullscreenMode
        : "auto";

    // Decide based on the configuration
    if (fullscreenMode === "css") {
      console.log(
        "[Mermaid View Controls] Using CSS-based fullscreen (forced by configuration)"
      );
      enableCssFullscreen(container, button);
      return;
    } else if (fullscreenMode === "native" && state.fullscreenEnabled) {
      console.log(
        "[Mermaid View Controls] Using native fullscreen (forced by configuration)"
      );
      // Native fullscreen code
      // Hide the width toggle button immediately
      toggleWidthButtonVisibility(container, false);

      // Hide mermaid-controls div for more diagram space
      toggleMermaidControlsVisibility(container, false);

      // Mark this container as the active fullscreen element and add class for CSS styling
      state.activeFullscreenContainer = container;
      container.classList.add(config.fullscreenClass);

      // Different vendor prefixes
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.mozRequestFullScreen) {
        container.mozRequestFullScreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      } else {
        // If none of the above worked, fall back to CSS
        console.log(
          "[Mermaid View Controls] Native fullscreen API failed, falling back to CSS fullscreen"
        );
        enableCssFullscreen(container, button);
        return;
      }

      // Update button appearance right away
      updateFullscreenButtonInContainer(container, true);

      // Check and wait for MermaidPanZoom to be available
      ensurePanZoomAvailable()
        .then((panZoom) => {
          console.log(
            "[Mermaid View Controls] Activating pan-zoom for container:",
            container.id
          );
          panZoom.activateForContainer(container);

          // Auto-fit the diagram after a short delay - use a longer delay to ensure everything is ready
          setTimeout(() => {
            if (panZoom.fitDiagramToScreen) {
              // Call fitDiagramToScreen multiple times with increasing delays
              // to ensure proper scaling as the fullscreen transition completes
              panZoom.fitDiagramToScreen(container.id);

              setTimeout(() => {
                panZoom.fitDiagramToScreen(container.id);
              }, 300);

              setTimeout(() => {
                panZoom.fitDiagramToScreen(container.id);
              }, 600);
            }
          }, 100);
        })
        .catch((error) => {
          console.warn("[Mermaid View Controls] MermaidPanZoom error:", error);
        });

      announceToScreenReader(
        "Entered fullscreen mode with pan and zoom controls"
      );
      return;
    }

    // Auto mode (default behavior)
    // Try native fullscreen API first if supported
    if (state.fullscreenEnabled && !isMobileDevice()) {
      console.log("[Mermaid View Controls] Using native fullscreen API");

      try {
        // Hide the width toggle button immediately
        toggleWidthButtonVisibility(container, false);

        // Hide mermaid-controls div for more diagram space
        toggleMermaidControlsVisibility(container, false);

        // Mark this container as the active fullscreen element and add class for CSS styling
        state.activeFullscreenContainer = container;
        container.classList.add(config.fullscreenClass);

        // Different vendor prefixes
        if (container.requestFullscreen) {
          container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          container.webkitRequestFullscreen();
        } else if (container.mozRequestFullScreen) {
          container.mozRequestFullScreen();
        } else if (container.msRequestFullscreen) {
          container.msRequestFullscreen();
        } else {
          // If none of the above worked, fall back to CSS
          throw new Error("No requestFullscreen method available");
        }

        // Update button appearance right away
        updateFullscreenButtonInContainer(container, true);

        // Check and wait for MermaidPanZoom to be available
        ensurePanZoomAvailable()
          .then((panZoom) => {
            console.log(
              "[Mermaid View Controls] Activating pan-zoom for container:",
              container.id
            );
            panZoom.activateForContainer(container);

            // Auto-fit the diagram after a short delay - use a longer delay to ensure everything is ready
            setTimeout(() => {
              if (panZoom.fitDiagramToScreen) {
                // Call fitDiagramToScreen multiple times with increasing delays
                // to ensure proper scaling as the fullscreen transition completes
                panZoom.fitDiagramToScreen(container.id);

                setTimeout(() => {
                  panZoom.fitDiagramToScreen(container.id);
                }, 300);

                setTimeout(() => {
                  panZoom.fitDiagramToScreen(container.id);
                }, 600);
              }
            }, 100);
          })
          .catch((error) => {
            console.warn(
              "[Mermaid View Controls] MermaidPanZoom error:",
              error
            );
          });

        announceToScreenReader(
          "Entered fullscreen mode with pan and zoom controls"
        );
      } catch (err) {
        console.warn("[Mermaid View Controls] Fullscreen API error:", err);
        enableCssFullscreen(container, button);
      }
    } else {
      // Use CSS-based fullscreen for mobile or if API not available
      console.log("[Mermaid View Controls] Using CSS-based fullscreen");
      enableCssFullscreen(container, button);
    }
  }

  /**
   * Enable CSS-based fullscreen (fallback method)
   * @param {HTMLElement} container - The mermaid container
   * @param {HTMLElement} button - The fullscreen button
   */
  function enableCssFullscreen(container, button) {
    console.log(
      "[Mermaid View Controls] Enabling CSS fullscreen for container:",
      container.id
    );

    container.classList.add(config.fullscreenClass);
    document.body.style.overflow = "hidden"; // Prevent scrolling

    // Hide the width toggle button explicitly
    toggleWidthButtonVisibility(container, false);

    // Hide mermaid-controls div for more diagram space
    toggleMermaidControlsVisibility(container, false);

    // Mark this container as the active fullscreen element
    state.activeFullscreenContainer = container;

    // Update the button appearance
    updateFullscreenButtonInContainer(container, true);

    // Add a notice to the container that can be shown if pan-zoom isn't available
    const notice = document.createElement("div");
    notice.className = "pan-zoom-notice";
    notice.style.position = "absolute";
    notice.style.top = "10px";
    notice.style.left = "50%";
    notice.style.transform = "translateX(-50%)";
    notice.style.background = "rgba(255, 255, 255, 0.8)";
    notice.style.padding = "5px 10px";
    notice.style.borderRadius = "4px";
    notice.style.display = "none";
    notice.textContent = "Pan and zoom functionality not available";
    container.appendChild(notice);

    // Check and wait for MermaidPanZoom to be available
    ensurePanZoomAvailable()
      .then((panZoom) => {
        console.log(
          "[Mermaid View Controls] PanZoom implementation:",
          panZoom === window.MermaidPanZoom ? "Global" : "Event-based"
        );

        if (panZoom.activateForContainer.toString().includes("Fallback")) {
          // We're using the fallback implementation
          console.warn(
            "[Mermaid View Controls] Using fallback implementation - limited functionality"
          );
          notice.style.display = "block";

          // Try to at least center and scale the diagram in a basic way
          const svg = container.querySelector("svg");
          if (svg) {
            svg.style.maxWidth = "90%";
            svg.style.maxHeight = "90%";
            svg.style.margin = "0 auto";
            svg.style.display = "block";
          }
        } else {
          console.log(
            "[Mermaid View Controls] Activating pan-zoom for container (CSS fullscreen):",
            container.id
          );
          panZoom.activateForContainer(container);

          // Auto-fit the diagram after a short delay
          setTimeout(() => {
            if (panZoom.fitDiagramToScreen) {
              console.log(
                "[Mermaid View Controls] Auto-fitting diagram to screen"
              );
              panZoom.fitDiagramToScreen(container.id);
            }
          }, 300);
        }
      })
      .catch((error) => {
        console.warn(
          "[Mermaid View Controls] MermaidPanZoom not available for CSS fullscreen:",
          error
        );
        notice.style.display = "block";
      });

    announceToScreenReader(
      "Entered fullscreen mode with pan and zoom controls"
    );

    // Focus on the fullscreen button for keyboard users
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
        console.log(
          `[Mermaid View Controls] Restoring focus to element: ${previousFocusId}`
        );
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
   * @param {HTMLElement} container - The mermaid container
   */
  function exitFullscreen(container) {
    console.log("[Mermaid View Controls] Exiting fullscreen mode");

    // Store reference to the active container for restoration
    const activeContainer = container || state.activeFullscreenContainer;

    // Find and update the fullscreen button directly
    if (activeContainer) {
      const containerId = activeContainer.id;
      const fullscreenButton = document.getElementById(
        `toggle-fullscreen-${containerId}`
      );
      if (fullscreenButton) {
        console.log(
          "[Mermaid View Controls] Directly updating fullscreen button to enter mode"
        );
        fullscreenButton.innerHTML = `${getFullscreenIcon()} <span class="button-text">${
          config.fullscreenText
        }</span>`;
        fullscreenButton.setAttribute("aria-label", "Enter fullscreen mode");
      }
    }

    // Deactivate pan-zoom functionality
    if (window.MermaidPanZoom && activeContainer) {
      window.MermaidPanZoom.deactivateForContainer(activeContainer);
    }

    // Check if we're using the native fullscreen API
    const inNativeFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    // Check if we're in CSS fullscreen
    const inCssFullscreen = !!(
      activeContainer &&
      activeContainer.classList.contains(config.fullscreenClass) &&
      !inNativeFullscreen
    );

    console.log(
      `[Mermaid View Controls] Current fullscreen state: native=${inNativeFullscreen}, CSS=${inCssFullscreen}`
    );

    // First exit native fullscreen if active
    if (inNativeFullscreen) {
      console.log("[Mermaid View Controls] Exiting native fullscreen");

      // Remove the fullscreen class immediately to prevent double fullscreen
      if (activeContainer) {
        activeContainer.classList.remove(config.fullscreenClass);
      }

      // Exit using the appropriate method
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }

      // Directly force restore controls in the active container
      forceRestoreMermaidControls(activeContainer);

      // Update the button again after a delay to ensure it gets updated
      setTimeout(() => {
        if (activeContainer) {
          const fullscreenButton = document.getElementById(
            `toggle-fullscreen-${activeContainer.id}`
          );
          if (fullscreenButton) {
            fullscreenButton.innerHTML = `${getFullscreenIcon()} <span class="button-text">${
              config.fullscreenText
            }</span>`;
            fullscreenButton.setAttribute(
              "aria-label",
              "Enter fullscreen mode"
            );
          }
        }
      }, 200);

      // Clear active container reference to prevent double fullscreen
      state.activeFullscreenContainer = null;
    }
    // Then handle CSS fullscreen if active
    else if (
      activeContainer &&
      activeContainer.classList.contains(config.fullscreenClass)
    ) {
      console.log("[Mermaid View Controls] Exiting CSS fullscreen");

      activeContainer.classList.remove(config.fullscreenClass);
      document.body.style.overflow = ""; // Restore scrolling

      // Directly force restore controls in the active container
      forceRestoreMermaidControls(activeContainer);

      // Also restore all mermaid control buttons
      forceRestoreAllMermaidControls();

      // Clear active container reference
      state.activeFullscreenContainer = null;

      announceToScreenReader("Exited fullscreen mode");

      // Restore focus to previous element
      restoreFocus(activeContainer);
    } else {
      // If we can't find the specific container, try to restore all hidden controls
      forceRestoreAllMermaidControls();
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

    console.log(
      `[Mermaid View Controls] Fullscreen change detected. In fullscreen: ${!!isInFullscreen}`
    );

    if (isInFullscreen) {
      // We've entered fullscreen mode
      const container = isInFullscreen;
      console.log(
        "[Mermaid View Controls] Container entered fullscreen:",
        container.id
      );

      // Make sure container has the fullscreen class
      container.classList.add(config.fullscreenClass);
      state.activeFullscreenContainer = container; // Store the active container

      // Update button appearance right away
      updateFullscreenButtonInContainer(container, true);

      // Activate pan-zoom with a short delay to ensure DOM is updated
      setTimeout(() => {
        if (window.MermaidPanZoom) {
          console.log(
            "[Mermaid View Controls] Activating pan-zoom after fullscreen change"
          );
          window.MermaidPanZoom.activateForContainer(container);

          // Auto-fit the diagram to the screen - call twice with a delay to ensure proper fit
          setTimeout(() => {
            if (window.MermaidPanZoom.fitDiagramToScreen) {
              window.MermaidPanZoom.fitDiagramToScreen(container.id);

              // Call again after a delay to ensure accurate dimensions
              setTimeout(() => {
                window.MermaidPanZoom.fitDiagramToScreen(container.id);
              }, 200);
            }
          }, 100);
        }
      }, 50);
    } else {
      // We've exited fullscreen mode
      const container = state.activeFullscreenContainer;

      if (container) {
        // Log the container we're exiting from
        console.log(
          "[Mermaid View Controls] Exiting fullscreen for container:",
          container.id
        );

        // Find the button for this container and update it directly
        const fullscreenButton = document.getElementById(
          `toggle-fullscreen-${container.id}`
        );
        if (fullscreenButton) {
          console.log(
            "[Mermaid View Controls] Found fullscreen button, updating to enter mode"
          );
          fullscreenButton.innerHTML = `${getFullscreenIcon()} <span class="button-text">${
            config.fullscreenText
          }</span>`;
          fullscreenButton.setAttribute("aria-label", "Enter fullscreen mode");
        } else {
          console.warn(
            "[Mermaid View Controls] Fullscreen button not found for container:",
            container.id
          );
        }

        // Deactivate pan-zoom functionality
        if (window.MermaidPanZoom) {
          window.MermaidPanZoom.deactivateForContainer(container);
        }

        console.log(
          "[Mermaid View Controls] Restoring UI after fullscreen exit"
        );

        // Remove the fullscreen class immediately to prevent double fullscreen
        container.classList.remove(config.fullscreenClass);
        document.body.style.overflow = ""; // Restore scrolling

        // Force restore mermaid controls
        forceRestoreMermaidControls(container);

        // Clear active container reference
        state.activeFullscreenContainer = null;

        announceToScreenReader("Exited fullscreen mode");

        // Restore focus
        restoreFocus(container);
      } else {
        // If activeFullscreenContainer is not available, try to restore all controls
        console.log(
          "[Mermaid View Controls] No active container reference, restoring all controls"
        );
        forceRestoreAllMermaidControls();

        // Reset all fullscreen buttons
        document
          .querySelectorAll('button[id^="toggle-fullscreen-"]')
          .forEach((button) => {
            button.innerHTML = `${getFullscreenIcon()} <span class="button-text">${
              config.fullscreenText
            }</span>`;
            button.setAttribute("aria-label", "Enter fullscreen mode");
          });

        setTimeout(resetAllFullscreenButtons, 300);
      }
    }
  }

  /**
   * Update all fullscreen button appearances in a container
   * @param {HTMLElement} container - The mermaid container
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
      console.log(
        `[Mermaid View Controls] Updating fullscreen button to: ${
          isFullscreen ? "exit" : "enter"
        } mode`
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
      // First check if we have an active CSS fullscreen container
      if (
        state.activeFullscreenContainer &&
        state.activeFullscreenContainer.classList.contains(
          config.fullscreenClass
        )
      ) {
        console.log(
          "[Mermaid View Controls] Escape key detected, exiting CSS fullscreen"
        );
        exitFullscreen(state.activeFullscreenContainer);
        event.preventDefault(); // Prevent other escape handlers
      }
      // We don't need to handle native fullscreen here, the browser does it for us
    }
  }
  /**
   * Reset all fullscreen buttons to their default state
   * This is a catch-all solution for when normal update methods fail
   */
  function resetAllFullscreenButtons() {
    console.log("[Mermaid View Controls] Resetting all fullscreen buttons");

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
   * Check if current device is mobile
   * @returns {boolean} True if device is likely mobile
   */
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  /**
   * Force restore mermaid controls in a specific container
   * @param {HTMLElement} container - The mermaid container
   */
  function forceRestoreMermaidControls(container) {
    if (!container) {
      console.warn(
        "[Mermaid View Controls] Cannot restore controls: No container provided"
      );
      return;
    }

    // First try the standard toggle method
    toggleWidthButtonVisibility(container, true);
    toggleMermaidControlsVisibility(container, true);

    // Then force direct restoration of any controls
    const mermaidControls = container.querySelector(".mermaid-controls");
    if (mermaidControls) {
      console.log(
        "[Mermaid View Controls] Directly forcing control visibility in container"
      );
      mermaidControls.style.removeProperty("display");
      mermaidControls.removeAttribute("aria-hidden");
    }
  }

  /**
   * Force restore all mermaid controls in the document
   * Useful as a fallback when specific container references are lost
   */
  function forceRestoreAllMermaidControls() {
    console.log(
      "[Mermaid View Controls] Attempting to restore all hidden mermaid controls"
    );

    // Find all hidden mermaid-controls in the document
    const hiddenControls = document.querySelectorAll(
      ".mermaid-controls[style*='display: none'], .mermaid-controls[aria-hidden='true']"
    );

    if (hiddenControls.length > 0) {
      console.log(
        `[Mermaid View Controls] Found ${hiddenControls.length} hidden mermaid controls to restore`
      );

      hiddenControls.forEach((controls) => {
        // Remove the display style property entirely
        controls.style.removeProperty("display");
        // Remove the aria-hidden attribute
        controls.removeAttribute("aria-hidden");
      });
    }

    // Also restore any width toggle buttons that might be hidden
    const hiddenWidthButtons = document.querySelectorAll(
      "button[id^='toggle-width-'][style*='display: none']"
    );
    if (hiddenWidthButtons.length > 0) {
      hiddenWidthButtons.forEach((button) => {
        button.style.removeProperty("display");
      });
    }
  }

  /**
   * Toggle visibility of the width toggle button
   * @param {HTMLElement} container - The mermaid container
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

  /**
   * Toggle visibility of the mermaid-controls div
   * @param {HTMLElement} container - The mermaid container
   * @param {boolean} isVisible - Whether the controls should be visible
   */
  function toggleMermaidControlsVisibility(container, isVisible) {
    if (!container) {
      console.warn("[Mermaid View Controls] Container is null or undefined");
      return;
    }

    // Use querySelectorAll to find ALL mermaid-controls divs in the container
    const mermaidControlsList = container.querySelectorAll(".mermaid-controls");

    if (mermaidControlsList.length === 0) {
      console.warn(
        "[Mermaid View Controls] No mermaid-controls found in container:",
        container
      );

      // As a fallback, try to find mermaid-controls in the entire document
      if (isVisible) {
        const allMermaidControls = document.querySelectorAll(
          ".mermaid-controls[style*='display: none']"
        );
        if (allMermaidControls.length > 0) {
          console.log(
            `[Mermaid View Controls] Found ${allMermaidControls.length} hidden mermaid-controls in document`
          );

          allMermaidControls.forEach((controls) => {
            // CHANGE: Use removeProperty instead of setting to empty string
            controls.style.removeProperty("display");
            controls.removeAttribute("aria-hidden");
          });
        }
      }

      return;
    }

    // Update all mermaid-controls divs found
    mermaidControlsList.forEach((controls) => {
      // CHANGE: Use removeProperty when making visible
      if (isVisible) {
        controls.style.removeProperty("display");
      } else {
        controls.style.display = "none";
      }

      // Ensure the controls have correct ARIA attributes for accessibility
      if (isVisible) {
        controls.removeAttribute("aria-hidden");
      } else {
        controls.setAttribute("aria-hidden", "true");
      }
    });
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

  function getCloseIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>`;
  }

  // Initialize when DOM is fully loaded
  document.addEventListener("DOMContentLoaded", function () {
    init();

    // Also observe changes to handle dynamically added diagrams
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
    toggleMermaidControlsVisibility: toggleMermaidControlsVisibility,
  };
})();
