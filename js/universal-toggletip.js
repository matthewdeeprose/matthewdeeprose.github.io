/**
 * Universal Toggletip - Accessible Popover Component
 * WCAG 2.2 AA compliant toggletip system for DOM elements and canvas regions
 *
 * Features:
 * - Click/keyboard triggered (not hover) for better accessibility
 * - Supports standard DOM triggers and canvas virtual regions
 * - Viewport-aware positioning with automatic flipping
 * - Escape key dismissal
 * - Focus management and screen reader support
 *
 * @version 1.0.0
 */

const UniversalToggletip = (function () {
  "use strict";

  // Logging configuration (inside IIFE scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  let currentLogLevel = DEFAULT_LOG_LEVEL;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[UniversalToggletip] ERROR: ${message}`, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[UniversalToggletip] WARN: ${message}`, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[UniversalToggletip] INFO: ${message}`, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[UniversalToggletip] DEBUG: ${message}`, ...args);
    }
  }

  function setLogLevel(level) {
    if (Object.values(LOG_LEVELS).includes(level)) {
      currentLogLevel = level;
      logInfo(
        `Logging level set to: ${Object.keys(LOG_LEVELS).find(
          (key) => LOG_LEVELS[key] === level
        )}`
      );
    } else {
      logWarn(`Invalid logging level: ${level}`);
    }
  }

  // ====== TOGGLETIP MANAGER ======
  class ToggletipManager {
    constructor() {
      this.toggletips = new Map();
      this.canvasRegions = new Map();
      this.toggletipCounter = 0;
      this.activeToggletip = null;
      this.isInitialised = false;

      // Z-index management - increment each time a toggletip is shown
      this.baseZIndex = 10000;
      this.currentZIndex = this.baseZIndex;

      // Track all open toggletips in order (for Escape key handling)
      this.openToggletips = [];

      // Default configuration
      this.defaults = {
        position: "bottom",
        maxWidth: 300,
        minWidth: 150,
        offset: 8,
        showDelay: 0,
        hideDelay: 0,
        dismissOnScroll: true,
        dismissOnResize: true,
      };
    }

    /**
     * Initialise the toggletip system
     */
    initialise() {
      if (this.isInitialised) return;

      this.setupGlobalEventListeners();
      this.isInitialised = true;
      logInfo("Toggletip system initialised");
    }

    /**
     * Set up global event listeners for escape key and click outside
     */
    setupGlobalEventListeners() {
      // Escape key to dismiss toggletips one at a time (most recent first)
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          // First check if focus is inside any toggletip
          const activeElement = document.activeElement;
          const focusedToggletip = activeElement
            ? activeElement.closest(".universal-toggletip")
            : null;

          if (focusedToggletip) {
            e.preventDefault();
            const toggletipId = focusedToggletip.id;
            this.closeAny(toggletipId);
            return;
          }

          // Otherwise close the most recently opened toggletip
          if (this.openToggletips.length > 0) {
            e.preventDefault();
            const mostRecentId =
              this.openToggletips[this.openToggletips.length - 1];
            this.closeAny(mostRecentId);
          }
        }
      });

      // Click outside to dismiss all open toggletips
      document.addEventListener("click", (e) => {
        // Check if click was inside any toggletip or trigger
        const clickedToggletip = e.target.closest(".universal-toggletip");
        const clickedTrigger = e.target.closest(".universal-toggletip-trigger");
        const clickedCanvasButton = e.target.closest(
          ".universal-toggletip-canvas-region-button"
        );

        if (!clickedToggletip && !clickedTrigger && !clickedCanvasButton) {
          // Close all open toggletips
          this.closeAll();
        }
      });

      // Touch outside to dismiss all (for touch devices)
      document.addEventListener(
        "touchend",
        (e) => {
          const touchedToggletip = e.target.closest(".universal-toggletip");
          const touchedTrigger = e.target.closest(
            ".universal-toggletip-trigger"
          );
          const touchedCanvasButton = e.target.closest(
            ".universal-toggletip-canvas-region-button"
          );

          if (!touchedToggletip && !touchedTrigger && !touchedCanvasButton) {
            this.closeAll();
          }
        },
        { passive: true }
      );

      // Dismiss DOM toggletips on scroll (but not canvas regions - users may want to compare)
      document.addEventListener(
        "scroll",
        () => {
          // Only close DOM toggletips with dismissOnScroll option, not canvas regions
          for (const [toggletipId, toggletipData] of this.toggletips) {
            if (
              toggletipData.isVisible &&
              toggletipData.options.dismissOnScroll
            ) {
              // Don't close if focus is inside this toggletip
              const activeElement = document.activeElement;
              if (
                toggletipData.element &&
                toggletipData.element.contains(activeElement)
              ) {
                continue;
              }
              this.hide(toggletipId, false);
            }
          }
        },
        { passive: true }
      );

      // Reposition on resize
      window.addEventListener(
        "resize",
        () => {
          if (this.activeToggletip) {
            const toggletipData = this.toggletips.get(this.activeToggletip.id);
            if (toggletipData) {
              if (toggletipData.options.dismissOnResize) {
                this.hide(this.activeToggletip.id);
              } else {
                this.updatePosition(this.activeToggletip.id);
              }
            }
            // Canvas regions: dismiss on resize as positions will be stale
            if (this.activeToggletip && this.activeToggletip.canvas) {
              this.closeAny(this.activeToggletip.id);
            }
          }
        },
        { passive: true }
      );

      // Integration with UniversalModal - close toggletips when modal opens
      document.addEventListener("modalOpened", () => {
        if (this.activeToggletip) {
          logDebug("Modal opened - closing active toggletip");
          this.closeAny(this.activeToggletip.id);
        }
      });

      // Also listen for dialog elements being shown (native dialog support)
      document.addEventListener("DOMNodeInserted", (e) => {
        if (
          e.target.tagName === "DIALOG" &&
          e.target.open &&
          this.activeToggletip
        ) {
          logDebug("Dialog detected - closing active toggletip");
          this.closeAny(this.activeToggletip.id);
        }
      });

      logDebug(
        "Global event listeners registered (including touch and modal integration)"
      );
    }

    /**
     * Create a toggletip for a DOM element
     * @param {Object} config - Configuration object
     * @returns {string} Toggletip ID
     */
    create(config) {
      if (!this.isInitialised) {
        this.initialise();
      }

      const {
        trigger,
        content,
        position = this.defaults.position,
        maxWidth = this.defaults.maxWidth,
        minWidth = this.defaults.minWidth,
        offset = this.defaults.offset,
        label = null,
        type = "info",
        dismissOnScroll = this.defaults.dismissOnScroll,
        dismissOnResize = this.defaults.dismissOnResize,
        onShow = null,
        onHide = null,
      } = config;

      // Resolve trigger element
      const triggerElement =
        typeof trigger === "string" ? document.querySelector(trigger) : trigger;

      if (!triggerElement) {
        logError(`Trigger element not found: ${trigger}`);
        return null;
      }

      // Generate unique ID
      const toggletipId = `universal-toggletip-${++this.toggletipCounter}`;

      // Create toggletip element
      const toggletipElement = this.createToggletipElement(toggletipId, {
        content,
        label,
        type,
        maxWidth,
        minWidth,
      });

      // Store toggletip data
      const toggletipData = {
        id: toggletipId,
        trigger: triggerElement,
        element: toggletipElement,
        content,
        isVisible: false,
        options: {
          position,
          maxWidth,
          minWidth,
          offset,
          type,
          dismissOnScroll,
          dismissOnResize,
          onShow,
          onHide,
        },
      };

      this.toggletips.set(toggletipId, toggletipData);

      // Set up trigger element
      this.setupTrigger(triggerElement, toggletipId);

      // Add toggletip to DOM (hidden)
      document.body.appendChild(toggletipElement);

      logDebug(`Toggletip created: ${toggletipId}`);
      return toggletipId;
    }

    /**
     * Create the toggletip DOM element
     */
    createToggletipElement(toggletipId, config) {
      const { content, label, type, maxWidth, minWidth } = config;

      const toggletip = document.createElement("div");
      toggletip.id = toggletipId;
      toggletip.className = `universal-toggletip universal-toggletip-${type}`;
      toggletip.setAttribute("role", "dialog");
      toggletip.setAttribute("aria-modal", "false");

      // Ensure content is announced to screen readers when shown
      toggletip.setAttribute("aria-live", "polite");
      toggletip.setAttribute("aria-atomic", "true");

      if (label) {
        toggletip.setAttribute("aria-label", label);
      } else {
        toggletip.setAttribute("aria-labelledby", `${toggletipId}-content`);
      }

      // Set sizing
      toggletip.style.maxWidth = `${maxWidth}px`;
      toggletip.style.minWidth = `${minWidth}px`;

      // Create content wrapper
      const contentWrapper = document.createElement("div");
      contentWrapper.id = `${toggletipId}-content`;
      contentWrapper.className = "universal-toggletip-content";

      if (typeof content === "string") {
        if (content.includes("<")) {
          contentWrapper.innerHTML = content;
        } else {
          contentWrapper.textContent = content;
        }
      } else if (content instanceof HTMLElement) {
        contentWrapper.appendChild(content.cloneNode(true));
      } else {
        contentWrapper.textContent = String(content);
      }

      // Create arrow element
      const arrow = document.createElement("div");
      arrow.className = "universal-toggletip-arrow";
      arrow.setAttribute("aria-hidden", "true");

      // Create close button for keyboard/screen reader users
      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "universal-toggletip-close";
      closeButton.setAttribute("aria-label", "Close");
      closeButton.innerHTML = '<span aria-hidden="true">×</span>';
      closeButton.addEventListener("click", (e) => {
        e.stopPropagation();
        // Try to close as DOM toggletip first, then as canvas region
        this.closeAny(toggletipId);
      });

      // Handle Tab key to provide proper focus management
      // Without this, Tab would go to address bar (toggletip is at end of DOM)
      // Note: We keep the toggletip open - user can have multiple open at once
      closeButton.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();

          // Find the trigger element that opened this toggletip
          const triggerElement = this.findToggletipTrigger(toggletipId);

          if (e.shiftKey) {
            // Shift+Tab: Move focus back to trigger (keep toggletip open)
            if (triggerElement) {
              triggerElement.focus();
            }
          } else {
            // Tab: Move to next focusable element after trigger (keep toggletip open)
            if (triggerElement) {
              const nextFocusable =
                this.findNextFocusableElement(triggerElement);
              if (nextFocusable) {
                nextFocusable.focus();
              } else {
                triggerElement.focus();
              }
            }
          }
        }
      });

      toggletip.appendChild(contentWrapper);
      toggletip.appendChild(closeButton);
      toggletip.appendChild(arrow);

      return toggletip;
    }

    /**
     * Set up trigger element with appropriate ARIA and event handlers
     */
    setupTrigger(triggerElement, toggletipId) {
      // Ensure trigger is focusable
      if (
        !triggerElement.hasAttribute("tabindex") &&
        triggerElement.tagName !== "BUTTON" &&
        triggerElement.tagName !== "A"
      ) {
        triggerElement.setAttribute("tabindex", "0");
      }

      // Add ARIA attributes
      triggerElement.setAttribute("aria-expanded", "false");
      triggerElement.setAttribute("aria-controls", toggletipId);

      // If not a button, add button role
      if (
        triggerElement.tagName !== "BUTTON" &&
        !triggerElement.hasAttribute("role")
      ) {
        triggerElement.setAttribute("role", "button");
      }

      // Add toggle class for styling
      triggerElement.classList.add("universal-toggletip-trigger");

      // Click handler
      triggerElement.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggle(toggletipId);
      });

      // Keyboard handler (Enter and Space)
      triggerElement.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.toggle(toggletipId);
        }
      });

      logDebug(`Trigger configured for toggletip: ${toggletipId}`);
    }

    /**
     * Toggle toggletip visibility
     */
    toggle(toggletipId) {
      const toggletipData = this.toggletips.get(toggletipId);
      if (!toggletipData) {
        logWarn(`Toggletip not found: ${toggletipId}`);
        return;
      }

      if (toggletipData.isVisible) {
        this.hide(toggletipId);
      } else {
        this.show(toggletipId);
      }
    }

    /**
     * Show a toggletip
     */
    show(toggletipId) {
      const toggletipData = this.toggletips.get(toggletipId);
      if (!toggletipData) {
        logWarn(`Toggletip not found: ${toggletipId}`);
        return;
      }

      // Hide any currently active toggletip
      if (this.activeToggletip && this.activeToggletip.id !== toggletipId) {
        this.hide(this.activeToggletip.id);
      }

      const { trigger, element, options } = toggletipData;

      // Update ARIA
      trigger.setAttribute("aria-expanded", "true");
      trigger.classList.add("universal-toggletip-trigger-active");

      // Position the toggletip
      this.positionToggletip(toggletipData);

      // Increment z-index so most recent toggletip is on top
      this.currentZIndex++;
      element.style.zIndex = this.currentZIndex;

      // Show the toggletip
      element.classList.add("universal-toggletip-visible");
      element.style.pointerEvents = "auto";
      element.setAttribute("aria-hidden", "false");

      // Update state
      toggletipData.isVisible = true;
      this.activeToggletip = toggletipData;

      // Track open toggletips for Escape key handling
      if (!this.openToggletips.includes(toggletipId)) {
        this.openToggletips.push(toggletipId);
      }

      // Focus the close button for keyboard users
      const closeButton = element.querySelector(".universal-toggletip-close");
      if (closeButton) {
        // Small delay to ensure element is visible
        requestAnimationFrame(() => {
          closeButton.focus();
        });
      }

      // Callback
      if (typeof options.onShow === "function") {
        options.onShow(toggletipData);
      }

      logDebug(`Toggletip shown: ${toggletipId}`);
    }

    /**
     * Hide a toggletip
     */
    hide(toggletipId) {
      const toggletipData = this.toggletips.get(toggletipId);
      if (!toggletipData) {
        logWarn(`Toggletip not found: ${toggletipId}`);
        return;
      }

      const { trigger, element, options } = toggletipData;

      // Update ARIA
      trigger.setAttribute("aria-expanded", "false");
      trigger.classList.remove("universal-toggletip-trigger-active");

      // Hide the toggletip
      element.classList.remove("universal-toggletip-visible");
      element.style.pointerEvents = "none";
      element.setAttribute("aria-hidden", "true");

      // Update state
      toggletipData.isVisible = false;
      if (this.activeToggletip && this.activeToggletip.id === toggletipId) {
        this.activeToggletip = null;
      }

      // Remove from open toggletips list
      const openIndex = this.openToggletips.indexOf(toggletipId);
      if (openIndex > -1) {
        this.openToggletips.splice(openIndex, 1);
      }

      // Return focus to trigger
      if (
        document.activeElement === element ||
        element.contains(document.activeElement)
      ) {
        trigger.focus();
      }

      // Callback
      if (typeof options.onHide === "function") {
        options.onHide(toggletipData);
      }

      logDebug(`Toggletip hidden: ${toggletipId}`);
    }

    /**
     * Position the toggletip relative to its trigger
     */
    positionToggletip(toggletipData) {
      const { trigger, element, options } = toggletipData;
      const { position, offset } = options;

      // Get trigger dimensions
      const triggerRect = trigger.getBoundingClientRect();

      // Temporarily show element to measure it
      element.style.visibility = "hidden";
      element.style.display = "block";
      const tooltipRect = element.getBoundingClientRect();
      element.style.visibility = "";

      // Calculate available space
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Determine best position (may flip if not enough space)
      const finalPosition = this.calculateBestPosition(
        position,
        triggerRect,
        tooltipRect,
        viewportWidth,
        viewportHeight,
        offset
      );

      // Calculate coordinates based on position
      const coords = this.calculateCoordinates(
        finalPosition,
        triggerRect,
        tooltipRect,
        offset
      );

      // Apply position
      element.style.left = `${coords.left}px`;
      element.style.top = `${coords.top}px`;

      // Update arrow position
      this.updateArrowPosition(element, finalPosition, triggerRect, coords);

      // Set position class for arrow styling
      element.className = element.className.replace(
        /universal-toggletip-position-\w+/g,
        ""
      );
      element.classList.add(`universal-toggletip-position-${finalPosition}`);
    }

    /**
     * Calculate the best position, flipping if necessary
     */
    calculateBestPosition(
      preferredPosition,
      triggerRect,
      tooltipRect,
      viewportWidth,
      viewportHeight,
      offset
    ) {
      const spaceAbove = triggerRect.top;
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceLeft = triggerRect.left;
      const spaceRight = viewportWidth - triggerRect.right;

      const tooltipHeight = tooltipRect.height + offset;
      const tooltipWidth = tooltipRect.width + offset;

      // Check if preferred position has enough space
      switch (preferredPosition) {
        case "top":
          if (spaceAbove < tooltipHeight && spaceBelow >= tooltipHeight) {
            return "bottom";
          }
          break;
        case "bottom":
          if (spaceBelow < tooltipHeight && spaceAbove >= tooltipHeight) {
            return "top";
          }
          break;
        case "left":
          if (spaceLeft < tooltipWidth && spaceRight >= tooltipWidth) {
            return "right";
          }
          break;
        case "right":
          if (spaceRight < tooltipWidth && spaceLeft >= tooltipWidth) {
            return "left";
          }
          break;
      }

      return preferredPosition;
    }

    /**
     * Calculate exact coordinates for positioning
     */
    calculateCoordinates(position, triggerRect, tooltipRect, offset) {
      let left, top;

      switch (position) {
        case "top":
          left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
          top = triggerRect.top - tooltipRect.height - offset + window.scrollY;
          break;
        case "bottom":
          left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
          top = triggerRect.bottom + offset + window.scrollY;
          break;
        case "left":
          left = triggerRect.left - tooltipRect.width - offset;
          top =
            triggerRect.top +
            (triggerRect.height - tooltipRect.height) / 2 +
            window.scrollY;
          break;
        case "right":
          left = triggerRect.right + offset;
          top =
            triggerRect.top +
            (triggerRect.height - tooltipRect.height) / 2 +
            window.scrollY;
          break;
        default:
          left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
          top = triggerRect.bottom + offset + window.scrollY;
      }

      // Ensure toggletip stays within viewport horizontally
      const viewportWidth = window.innerWidth;
      const padding = 8;

      if (left < padding) {
        left = padding;
      } else if (left + tooltipRect.width > viewportWidth - padding) {
        left = viewportWidth - tooltipRect.width - padding;
      }

      return { left, top };
    }

    /**
     * Update arrow position to point to trigger
     */
    updateArrowPosition(element, position, triggerRect, coords) {
      const arrow = element.querySelector(".universal-toggletip-arrow");
      if (!arrow) return;

      // Reset arrow positioning
      arrow.style.left = "";
      arrow.style.top = "";
      arrow.style.right = "";
      arrow.style.bottom = "";

      // For top/bottom positions, center arrow on trigger
      if (position === "top" || position === "bottom") {
        const triggerCenter = triggerRect.left + triggerRect.width / 2;
        const arrowOffset = triggerCenter - coords.left;
        arrow.style.left = `${Math.max(
          12,
          Math.min(arrowOffset, element.offsetWidth - 12)
        )}px`;
      }

      // For left/right positions, center arrow vertically on trigger
      if (position === "left" || position === "right") {
        const triggerMiddle = triggerRect.top + triggerRect.height / 2;
        const arrowOffset = triggerMiddle - coords.top + window.scrollY;
        arrow.style.top = `${Math.max(
          12,
          Math.min(arrowOffset, element.offsetHeight - 12)
        )}px`;
      }
    }

    /**
     * Close any toggletip (DOM or canvas) by ID
     * Used by close button which doesn't know the toggletip type
     * @param {string} toggletipId - The toggletip ID
     * @param {boolean} returnFocus - Whether to return focus to trigger (default: true)
     */
    closeAny(toggletipId, returnFocus = true) {
      // Try DOM toggletip first
      if (this.toggletips.has(toggletipId)) {
        this.hide(toggletipId, returnFocus);
        return;
      }

      // Try canvas region
      for (const [canvas, regions] of this.canvasRegions) {
        if (regions.has(toggletipId)) {
          this.hideCanvasRegion(toggletipId, returnFocus);
          return;
        }
      }

      logWarn(`Toggletip not found for close: ${toggletipId}`);
    }

    /**
     * Close all open toggletips
     */
    closeAll() {
      // Close all DOM toggletips
      for (const [toggletipId, toggletipData] of this.toggletips) {
        if (toggletipData.isVisible) {
          this.hide(toggletipId, false);
        }
      }

      // Close all canvas region toggletips
      for (const [canvas, regions] of this.canvasRegions) {
        for (const [regionId, regionData] of regions) {
          if (regionData.isVisible) {
            this.hideCanvasRegion(regionId, false);
          }
        }
      }

      this.activeToggletip = null;
      this.openToggletips = [];
      logDebug("All toggletips closed");
    }

    /**
     * Find the trigger element for a toggletip
     * Works for both DOM toggletips and canvas regions
     */
    findToggletipTrigger(toggletipId) {
      // Check DOM toggletips
      const toggletipData = this.toggletips.get(toggletipId);
      if (toggletipData) {
        return toggletipData.trigger;
      }

      // Check canvas regions
      for (const [canvas, regions] of this.canvasRegions) {
        const regionData = regions.get(toggletipId);
        if (regionData) {
          return regionData.accessibleButton || regionData.triggerElement;
        }
      }

      return null;
    }

    /**
     * Find the next focusable element after a given element
     */
    findNextFocusableElement(element) {
      const focusableSelectors = [
        "button:not([disabled])",
        "a[href]",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        '[tabindex]:not([tabindex="-1"])',
      ].join(", ");

      // Get all focusable elements on the page
      const allFocusable = Array.from(
        document.querySelectorAll(focusableSelectors)
      ).filter((el) => {
        // Exclude elements inside toggletips
        if (el.closest(".universal-toggletip")) return false;
        // Exclude hidden elements
        if (el.offsetParent === null && el.tagName !== "BODY") return false;
        return true;
      });

      // Find current element's index
      const currentIndex = allFocusable.indexOf(element);

      if (currentIndex === -1) {
        // Element not in list, try to find by position
        const elementRect = element.getBoundingClientRect();
        for (let i = 0; i < allFocusable.length; i++) {
          const rect = allFocusable[i].getBoundingClientRect();
          // Find first element that comes after in document order
          if (
            rect.top > elementRect.top ||
            (rect.top === elementRect.top && rect.left > elementRect.left)
          ) {
            return allFocusable[i];
          }
        }
        return allFocusable[0]; // Wrap to start
      }

      // Return next element, or first if at end
      return allFocusable[currentIndex + 1] || allFocusable[0];
    }

    /**
     * Find the previous focusable element before a given element
     */
    findPreviousFocusableElement(element) {
      const focusableSelectors = [
        "button:not([disabled])",
        "a[href]",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        '[tabindex]:not([tabindex="-1"])',
      ].join(", ");

      const allFocusable = Array.from(
        document.querySelectorAll(focusableSelectors)
      ).filter((el) => {
        if (el.closest(".universal-toggletip")) return false;
        if (el.offsetParent === null && el.tagName !== "BODY") return false;
        return true;
      });

      const currentIndex = allFocusable.indexOf(element);

      if (currentIndex === -1) {
        return allFocusable[allFocusable.length - 1];
      }

      // Return previous element, or last if at start
      return (
        allFocusable[currentIndex - 1] || allFocusable[allFocusable.length - 1]
      );
    }

    /**
     * Update position of an existing toggletip
     */
    updatePosition(toggletipId) {
      const toggletipData = this.toggletips.get(toggletipId);
      if (toggletipData && toggletipData.isVisible) {
        this.positionToggletip(toggletipData);
      }
    }

    /**
     * Update content of an existing toggletip
     */
    updateContent(toggletipId, newContent) {
      const toggletipData = this.toggletips.get(toggletipId);
      if (!toggletipData) {
        logWarn(`Toggletip not found: ${toggletipId}`);
        return;
      }

      const contentElement = toggletipData.element.querySelector(
        ".universal-toggletip-content"
      );
      if (contentElement) {
        if (typeof newContent === "string") {
          if (newContent.includes("<")) {
            contentElement.innerHTML = newContent;
          } else {
            contentElement.textContent = newContent;
          }
        } else if (newContent instanceof HTMLElement) {
          contentElement.innerHTML = "";
          contentElement.appendChild(newContent.cloneNode(true));
        }

        toggletipData.content = newContent;

        // Reposition if visible
        if (toggletipData.isVisible) {
          this.positionToggletip(toggletipData);
        }
      }

      logDebug(`Toggletip content updated: ${toggletipId}`);
    }

    /**
     * Destroy a toggletip
     */
    destroy(toggletipId) {
      const toggletipData = this.toggletips.get(toggletipId);
      if (!toggletipData) {
        logWarn(`Toggletip not found: ${toggletipId}`);
        return;
      }

      // Hide if visible
      if (toggletipData.isVisible) {
        this.hide(toggletipId);
      }

      // Clean up trigger
      const { trigger, element } = toggletipData;
      trigger.removeAttribute("aria-expanded");
      trigger.removeAttribute("aria-controls");
      trigger.classList.remove(
        "universal-toggletip-trigger",
        "universal-toggletip-trigger-active"
      );

      // Remove element from DOM
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }

      // Remove from map
      this.toggletips.delete(toggletipId);

      logDebug(`Toggletip destroyed: ${toggletipId}`);
    }

    /**
     * Destroy all toggletips
     */
    destroyAll() {
      for (const [toggletipId] of this.toggletips) {
        this.destroy(toggletipId);
      }
      logInfo("All toggletips destroyed");
    }

    // ====== CANVAS SUPPORT ======

    /**
     * Create a virtual toggletip region on a canvas
     * @param {Object} config - Configuration object
     * @returns {string} Region ID
     */
    createCanvasRegion(config) {
      if (!this.isInitialised) {
        this.initialise();
      }

      const {
        canvas,
        region,
        content,
        label,
        position = this.defaults.position,
        maxWidth = this.defaults.maxWidth,
        minWidth = this.defaults.minWidth,
        offset = this.defaults.offset,
        type = "info",
        onShow = null,
        onHide = null,
      } = config;

      // Resolve canvas element
      const canvasElement =
        typeof canvas === "string" ? document.querySelector(canvas) : canvas;

      if (!canvasElement || canvasElement.tagName !== "CANVAS") {
        logError(`Canvas element not found or invalid: ${canvas}`);
        return null;
      }

      // Validate region
      if (
        !region ||
        typeof region.x !== "number" ||
        typeof region.y !== "number" ||
        typeof region.width !== "number" ||
        typeof region.height !== "number"
      ) {
        logError("Invalid region definition. Required: x, y, width, height");
        return null;
      }

      // Generate unique ID
      const regionId = `universal-toggletip-canvas-${++this.toggletipCounter}`;

      // Create toggletip element (hidden off-canvas initially)
      const toggletipElement = this.createToggletipElement(regionId, {
        content,
        label,
        type,
        maxWidth,
        minWidth,
      });

      // Store canvas region data
      const regionData = {
        id: regionId,
        canvas: canvasElement,
        region: { ...region },
        element: toggletipElement,
        content,
        isVisible: false,
        options: {
          position,
          maxWidth,
          minWidth,
          offset,
          type,
          label,
          onShow,
          onHide,
        },
      };

      // Initialise canvas regions map for this canvas if needed
      if (!this.canvasRegions.has(canvasElement)) {
        this.canvasRegions.set(canvasElement, new Map());
        this.setupCanvasEventListeners(canvasElement);
      }

      this.canvasRegions.get(canvasElement).set(regionId, regionData);

      // Add toggletip to DOM (hidden)
      document.body.appendChild(toggletipElement);

      // Create screen reader accessible description
      this.createCanvasAccessibleRegion(canvasElement, regionData);

      logDebug(`Canvas region created: ${regionId}`);
      return regionId;
    }

    /**
     * Set up event listeners for canvas interactions
     */
    setupCanvasEventListeners(canvasElement) {
      // Track whether we've set up listeners for this canvas
      if (canvasElement.dataset.toggletipListenersAttached) return;

      // Mouse click handler
      canvasElement.addEventListener("click", (e) => {
        this.handleCanvasClick(canvasElement, e);
      });

      // Track cursor for visual feedback
      canvasElement.addEventListener("mousemove", (e) => {
        this.handleCanvasMouseMove(canvasElement, e);
      });

      // Create overlay container for focusable region buttons
      this.createCanvasOverlayContainer(canvasElement);

      canvasElement.dataset.toggletipListenersAttached = "true";
      logDebug("Canvas event listeners attached");
    }

    /**
     * Create overlay container for focusable canvas region buttons
     */
    createCanvasOverlayContainer(canvasElement) {
      // Check if overlay already exists
      if (canvasElement.dataset.overlayContainerId) return;

      const overlayId = `toggletip-canvas-overlay-${this.toggletipCounter}`;

      // Create overlay container positioned over the canvas
      const overlay = document.createElement("div");
      overlay.id = overlayId;
      overlay.className = "universal-toggletip-canvas-overlay";
      overlay.setAttribute("role", "group");
      overlay.setAttribute(
        "aria-label",
        "Interactive regions - use Tab to navigate, Enter to view details"
      );

      // Position overlay exactly over canvas
      const updateOverlayPosition = () => {
        overlay.style.left = `${canvasElement.offsetLeft}px`;
        overlay.style.top = `${canvasElement.offsetTop}px`;
        overlay.style.width = `${canvasElement.offsetWidth}px`;
        overlay.style.height = `${canvasElement.offsetHeight}px`;

        // Also update all region button positions
        this.updateCanvasRegionButtonPositions(canvasElement);
      };

      updateOverlayPosition();

      // Update position on resize
      const resizeObserver = new ResizeObserver(() => {
        updateOverlayPosition();
        // Close any active toggletip as positions will change
        if (
          this.activeToggletip &&
          this.activeToggletip.canvas === canvasElement
        ) {
          this.closeAny(this.activeToggletip.id);
        }
      });
      resizeObserver.observe(canvasElement);

      // Store reference and observer for cleanup
      canvasElement.dataset.overlayContainerId = overlayId;
      this.canvasResizeObservers = this.canvasResizeObservers || new Map();
      this.canvasResizeObservers.set(canvasElement, resizeObserver);

      // Insert overlay after canvas
      canvasElement.parentNode.insertBefore(overlay, canvasElement.nextSibling);

      logDebug(`Canvas overlay container created: ${overlayId}`);
    }

    /**
     * Update positions of all region buttons for a canvas
     * Called when canvas resizes
     */
    updateCanvasRegionButtonPositions(canvasElement) {
      const regions = this.canvasRegions.get(canvasElement);
      if (!regions) return;

      const scaleX = canvasElement.offsetWidth / canvasElement.width;
      const scaleY = canvasElement.offsetHeight / canvasElement.height;

      for (const [regionId, regionData] of regions) {
        const { region, accessibleButton } = regionData;
        if (!accessibleButton) continue;

        const buttonLeft = region.x * scaleX;
        const buttonTop = region.y * scaleY;
        const buttonWidth = region.width * scaleX;
        const buttonHeight = region.height * scaleY;

        accessibleButton.style.left = `${buttonLeft}px`;
        accessibleButton.style.top = `${buttonTop}px`;
        accessibleButton.style.width = `${buttonWidth}px`;
        accessibleButton.style.height = `${buttonHeight}px`;
      }

      logDebug("Canvas region button positions updated");
    }

    /**
     * Handle click on canvas
     */
    handleCanvasClick(canvasElement, event) {
      const regions = this.canvasRegions.get(canvasElement);
      if (!regions) return;

      const rect = canvasElement.getBoundingClientRect();
      const scaleX = canvasElement.width / rect.width;
      const scaleY = canvasElement.height / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;

      // Check if click is within any region
      for (const [regionId, regionData] of regions) {
        const { region } = regionData;
        if (
          x >= region.x &&
          x <= region.x + region.width &&
          y >= region.y &&
          y <= region.y + region.height
        ) {
          event.preventDefault();
          event.stopPropagation();
          this.toggleCanvasRegion(regionId);
          return;
        }
      }

      // Click outside any region - hide active toggletip
      if (
        this.activeToggletip &&
        this.activeToggletip.canvas === canvasElement
      ) {
        this.hideCanvasRegion(this.activeToggletip.id);
      }
    }

    /**
     * Handle keyboard interaction on canvas
     */
    handleCanvasKeydown(canvasElement, event) {
      const regions = this.canvasRegions.get(canvasElement);
      if (!regions || regions.size === 0) return;

      // Tab through regions
      if (event.key === "Tab") {
        // Let default tab behaviour work with accessible descriptions
        return;
      }

      // Escape to close
      if (event.key === "Escape" && this.activeToggletip) {
        event.preventDefault();
        this.hideCanvasRegion(this.activeToggletip.id);
      }
    }

    /**
     * Handle mouse move for cursor feedback
     */
    handleCanvasMouseMove(canvasElement, event) {
      const regions = this.canvasRegions.get(canvasElement);
      if (!regions) return;

      const rect = canvasElement.getBoundingClientRect();
      const scaleX = canvasElement.width / rect.width;
      const scaleY = canvasElement.height / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;

      let isOverRegion = false;

      for (const [regionId, regionData] of regions) {
        const { region } = regionData;
        if (
          x >= region.x &&
          x <= region.x + region.width &&
          y >= region.y &&
          y <= region.y + region.height
        ) {
          isOverRegion = true;
          break;
        }
      }

      canvasElement.style.cursor = isOverRegion ? "pointer" : "";
    }

    /**
     * Create accessible, focusable button for canvas region
     */
    createCanvasAccessibleRegion(canvasElement, regionData) {
      const { id, region, options, content } = regionData;

      // Get the overlay container
      const overlayId = canvasElement.dataset.overlayContainerId;
      const overlay = overlayId ? document.getElementById(overlayId) : null;

      if (!overlay) {
        logWarn(`Overlay container not found for canvas region: ${id}`);
        return;
      }

      // Calculate button position relative to canvas
      const canvasRect = canvasElement.getBoundingClientRect();
      const scaleX = canvasElement.offsetWidth / canvasElement.width;
      const scaleY = canvasElement.offsetHeight / canvasElement.height;

      const buttonLeft = region.x * scaleX;
      const buttonTop = region.y * scaleY;
      const buttonWidth = region.width * scaleX;
      const buttonHeight = region.height * scaleY;

      // Create focusable button positioned over the region
      const regionButton = document.createElement("button");
      regionButton.type = "button";
      regionButton.id = `${id}-accessible`;
      regionButton.className = "universal-toggletip-canvas-region-button";
      regionButton.setAttribute("aria-expanded", "false");
      regionButton.setAttribute("aria-controls", id);

      // Use label if provided, otherwise extract text from content
      const labelText =
        options.label ||
        (typeof content === "string"
          ? content.replace(/<[^>]*>/g, "").substring(0, 50)
          : "Interactive region");

      // Visually hidden text for screen readers
      const srText = document.createElement("span");
      srText.className = "sr-only";
      srText.textContent = labelText;
      regionButton.appendChild(srText);

      // Position the button over the region
      regionButton.style.cssText = `
    position: absolute;
    left: ${buttonLeft}px;
    top: ${buttonTop}px;
    width: ${buttonWidth}px;
    height: ${buttonHeight}px;
  `;

      // Click/keyboard handler
      regionButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleCanvasRegion(id);
      });

      // Update aria-expanded when toggletip state changes
      regionButton.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          this.toggleCanvasRegion(id);
        }
      });

      overlay.appendChild(regionButton);
      regionData.accessibleButton = regionButton;

      logDebug(`Focusable region button created for: ${id}`);
    }

    /**
     * Toggle canvas region toggletip
     */
    toggleCanvasRegion(regionId) {
      // Find the region in any canvas
      for (const [canvasElement, regions] of this.canvasRegions) {
        const regionData = regions.get(regionId);
        if (regionData) {
          if (regionData.isVisible) {
            this.hideCanvasRegion(regionId);
          } else {
            this.showCanvasRegion(regionId);
          }
          return;
        }
      }

      logWarn(`Canvas region not found: ${regionId}`);
    }

    /**
     * Show canvas region toggletip
     */
    showCanvasRegion(regionId) {
      // Find the region
      let regionData = null;
      let canvasElement = null;

      for (const [canvas, regions] of this.canvasRegions) {
        if (regions.has(regionId)) {
          regionData = regions.get(regionId);
          canvasElement = canvas;
          break;
        }
      }

      if (!regionData) {
        logWarn(`Canvas region not found: ${regionId}`);
        return;
      }

      // Allow multiple toggletips to be open simultaneously
      // (Previously we closed any active toggletip here)

      const { element, region, options, accessibleButton } = regionData;

      // Store the element that triggered this toggletip for focus return
      regionData.triggerElement = document.activeElement;

      // Update accessible button
      if (accessibleButton) {
        accessibleButton.setAttribute("aria-expanded", "true");
      }

      // Position relative to canvas region
      this.positionCanvasToggletip(regionData, canvasElement);

      // Increment z-index so most recent toggletip is on top
      this.currentZIndex++;
      element.style.zIndex = this.currentZIndex;

      // Show the toggletip
      element.classList.add("universal-toggletip-visible");
      element.setAttribute("aria-hidden", "false");
      element.style.pointerEvents = "auto";

      // Update state
      regionData.isVisible = true;
      this.activeToggletip = { ...regionData, canvas: canvasElement };

      // Track open toggletips for Escape key handling
      if (!this.openToggletips.includes(regionId)) {
        this.openToggletips.push(regionId);
      }

      // Add Tab handler to trigger button so user can Tab into close button
      // Only intercept forward Tab, not Shift+Tab (which should go to previous element)
      if (accessibleButton && !accessibleButton.dataset.tabHandlerAttached) {
        accessibleButton.addEventListener("keydown", (e) => {
          if (e.key === "Tab" && !e.shiftKey && regionData.isVisible) {
            // Forward Tab when toggletip is open: go to close button
            const closeBtn = element.querySelector(
              ".universal-toggletip-close"
            );
            if (closeBtn) {
              e.preventDefault();
              closeBtn.focus();
            }
          }
          // Shift+Tab: let it naturally go to previous element
        });
        accessibleButton.dataset.tabHandlerAttached = "true";
      }

      // Focus close button
      const closeButton = element.querySelector(".universal-toggletip-close");
      if (closeButton) {
        requestAnimationFrame(() => {
          closeButton.focus();
        });
      }

      // Callback
      if (typeof options.onShow === "function") {
        options.onShow(regionData);
      }

      logDebug(`Canvas region shown: ${regionId}`);
    }

    /**
     * Hide canvas region toggletip
     * @param {string} regionId - The region ID to hide
     * @param {boolean} returnFocus - Whether to return focus to trigger (default: true)
     */
    hideCanvasRegion(regionId, returnFocus = true) {
      // Find the region
      let regionData = null;

      for (const [canvas, regions] of this.canvasRegions) {
        if (regions.has(regionId)) {
          regionData = regions.get(regionId);
          break;
        }
      }

      if (!regionData) {
        logWarn(`Canvas region not found: ${regionId}`);
        return;
      }

      const { element, options, accessibleButton, triggerElement } = regionData;

      // Update accessible button
      if (accessibleButton) {
        accessibleButton.setAttribute("aria-expanded", "false");
      }

      // Hide the toggletip
      element.classList.remove("universal-toggletip-visible");
      element.setAttribute("aria-hidden", "true");
      element.style.pointerEvents = "none";

      // Update state
      regionData.isVisible = false;
      if (this.activeToggletip && this.activeToggletip.id === regionId) {
        this.activeToggletip = null;
      }

      // Remove from open toggletips list
      const openIndex = this.openToggletips.indexOf(regionId);
      if (openIndex > -1) {
        this.openToggletips.splice(openIndex, 1);
      }

      // Return focus to the element that triggered the toggletip
      if (
        returnFocus &&
        triggerElement &&
        typeof triggerElement.focus === "function"
      ) {
        // Check if focus is currently inside the toggletip
        const currentFocus = document.activeElement;
        if (element.contains(currentFocus) || currentFocus === element) {
          triggerElement.focus();
        }
      }

      // Clear trigger reference
      regionData.triggerElement = null;

      // Callback
      if (typeof options.onHide === "function") {
        options.onHide(regionData);
      }

      logDebug(`Canvas region hidden: ${regionId}`);
    }

    /**
     * Position toggletip relative to canvas region
     */
    positionCanvasToggletip(regionData, canvasElement) {
      const { element, region, options } = regionData;
      const { position, offset } = options;

      // Get canvas position in viewport
      const canvasRect = canvasElement.getBoundingClientRect();

      // Calculate scale factors for responsive canvas
      const scaleX = canvasRect.width / canvasElement.width;
      const scaleY = canvasRect.height / canvasElement.height;

      // Calculate region position in viewport coordinates
      const regionRect = {
        left: canvasRect.left + region.x * scaleX,
        top: canvasRect.top + region.y * scaleY,
        right: canvasRect.left + (region.x + region.width) * scaleX,
        bottom: canvasRect.top + (region.y + region.height) * scaleY,
        width: region.width * scaleX,
        height: region.height * scaleY,
      };

      // Temporarily show element to measure it
      element.style.visibility = "hidden";
      element.style.display = "block";
      const tooltipRect = element.getBoundingClientRect();
      element.style.visibility = "";

      // Calculate best position
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const finalPosition = this.calculateBestPosition(
        position,
        regionRect,
        tooltipRect,
        viewportWidth,
        viewportHeight,
        offset
      );

      // Calculate coordinates
      const coords = this.calculateCoordinates(
        finalPosition,
        regionRect,
        tooltipRect,
        offset
      );

      // Apply position
      element.style.left = `${coords.left}px`;
      element.style.top = `${coords.top}px`;

      // Update arrow
      this.updateArrowPosition(element, finalPosition, regionRect, coords);

      // Set position class
      element.className = element.className.replace(
        /universal-toggletip-position-\w+/g,
        ""
      );
      element.classList.add(`universal-toggletip-position-${finalPosition}`);
    }

    /**
     * Update canvas region definition
     */
    updateCanvasRegion(regionId, updates) {
      for (const [canvas, regions] of this.canvasRegions) {
        const regionData = regions.get(regionId);
        if (regionData) {
          // Update region bounds if provided
          if (updates.region) {
            Object.assign(regionData.region, updates.region);
          }

          // Update content if provided
          if (updates.content !== undefined) {
            regionData.content = updates.content;
            const contentElement = regionData.element.querySelector(
              ".universal-toggletip-content"
            );
            if (contentElement) {
              if (typeof updates.content === "string") {
                if (updates.content.includes("<")) {
                  contentElement.innerHTML = updates.content;
                } else {
                  contentElement.textContent = updates.content;
                }
              }
            }
          }

          // Update label if provided
          if (updates.label !== undefined && regionData.accessibleButton) {
            regionData.accessibleButton.textContent = updates.label;
            regionData.options.label = updates.label;
          }

          // Reposition if visible
          if (regionData.isVisible) {
            this.positionCanvasToggletip(regionData, canvas);
          }

          logDebug(`Canvas region updated: ${regionId}`);
          return;
        }
      }

      logWarn(`Canvas region not found for update: ${regionId}`);
    }

    /**
     * Remove a canvas region
     */
    removeCanvasRegion(regionId) {
      for (const [canvas, regions] of this.canvasRegions) {
        const regionData = regions.get(regionId);
        if (regionData) {
          // Hide if visible
          if (regionData.isVisible) {
            this.hideCanvasRegion(regionId);
          }

          // Remove accessible button
          if (
            regionData.accessibleButton &&
            regionData.accessibleButton.parentNode
          ) {
            regionData.accessibleButton.parentNode.removeChild(
              regionData.accessibleButton
            );
          }

          // Remove element from DOM
          if (regionData.element.parentNode) {
            regionData.element.parentNode.removeChild(regionData.element);
          }

          // Remove from map
          regions.delete(regionId);

          // If no more regions, remove overlay container
          if (regions.size === 0) {
            const overlayId = canvas.dataset.overlayContainerId;
            if (overlayId) {
              const overlay = document.getElementById(overlayId);
              if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
              }
              delete canvas.dataset.overlayContainerId;
              delete canvas.dataset.toggletipListenersAttached;
            }
          }

          logDebug(`Canvas region removed: ${regionId}`);
          return;
        }
      }

      logWarn(`Canvas region not found for removal: ${regionId}`);
    }

    /**
     * Clear all regions from a canvas
     */
    clearCanvasRegions(canvas) {
      const canvasElement =
        typeof canvas === "string" ? document.querySelector(canvas) : canvas;

      const regions = this.canvasRegions.get(canvasElement);
      if (!regions) return;

      // Get region IDs first to avoid modifying map while iterating
      const regionIds = Array.from(regions.keys());
      for (const regionId of regionIds) {
        this.removeCanvasRegion(regionId);
      }

      // Remove overlay container
      const overlayId = canvasElement.dataset.overlayContainerId;
      if (overlayId) {
        const overlay = document.getElementById(overlayId);
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        delete canvasElement.dataset.overlayContainerId;
      }

      // Clean up resize observer
      if (
        this.canvasResizeObservers &&
        this.canvasResizeObservers.has(canvasElement)
      ) {
        this.canvasResizeObservers.get(canvasElement).disconnect();
        this.canvasResizeObservers.delete(canvasElement);
      }

      // Reset listeners flag so they can be re-attached if needed
      delete canvasElement.dataset.toggletipListenersAttached;

      this.canvasRegions.delete(canvasElement);
      logInfo("All canvas regions cleared");
    }

    /**
     * Get region at specific canvas coordinates
     */
    getRegionAt(canvas, x, y) {
      const canvasElement =
        typeof canvas === "string" ? document.querySelector(canvas) : canvas;

      const regions = this.canvasRegions.get(canvasElement);
      if (!regions) return null;

      for (const [regionId, regionData] of regions) {
        const { region } = regionData;
        if (
          x >= region.x &&
          x <= region.x + region.width &&
          y >= region.y &&
          y <= region.y + region.height
        ) {
          return regionData;
        }
      }

      return null;
    }
  }

  // Create singleton instance
  const toggletipManager = new ToggletipManager();

  // ====== PUBLIC API ======
  const publicAPI = {
    // Initialisation
    initialise: () => toggletipManager.initialise(),
    init: () => toggletipManager.initialise(), // Alias

    // DOM toggletip methods
    create: (config) => toggletipManager.create(config),
    show: (toggletipId) => toggletipManager.show(toggletipId),
    hide: (toggletipId) => toggletipManager.hide(toggletipId),
    toggle: (toggletipId) => toggletipManager.toggle(toggletipId),
    updateContent: (toggletipId, content) =>
      toggletipManager.updateContent(toggletipId, content),
    updatePosition: (toggletipId) =>
      toggletipManager.updatePosition(toggletipId),
    destroy: (toggletipId) => toggletipManager.destroy(toggletipId),
    destroyAll: () => toggletipManager.destroyAll(),

    // Canvas region methods
    createCanvasRegion: (config) => toggletipManager.createCanvasRegion(config),
    showCanvasRegion: (regionId) => toggletipManager.showCanvasRegion(regionId),
    hideCanvasRegion: (regionId) => toggletipManager.hideCanvasRegion(regionId),
    toggleCanvasRegion: (regionId) =>
      toggletipManager.toggleCanvasRegion(regionId),
    updateCanvasRegion: (regionId, updates) =>
      toggletipManager.updateCanvasRegion(regionId, updates),
    removeCanvasRegion: (regionId) =>
      toggletipManager.removeCanvasRegion(regionId),
    clearCanvasRegions: (canvas) => toggletipManager.clearCanvasRegions(canvas),
    getRegionAt: (canvas, x, y) => toggletipManager.getRegionAt(canvas, x, y),

    // State queries
    isActive: () => !!toggletipManager.activeToggletip,
    getActiveToggletip: () => toggletipManager.activeToggletip,

    // Logging control
    setLogLevel,
    LOG_LEVELS,

    // Manager access (for advanced use)
    _manager: toggletipManager,
  };

  // Log module initialisation
  logInfo("Universal Toggletip system loaded");

  return publicAPI;
})();

// ====== GLOBAL INTEGRATION ======

// Export for environments that support it
if (typeof module !== "undefined" && module.exports) {
  module.exports = UniversalToggletip;
}

// For AMD (RequireJS) environments
if (typeof define === "function" && define.amd) {
  define(function () {
    return UniversalToggletip;
  });
}

// Make available globally
window.UniversalToggletip = UniversalToggletip;

// Convenience aliases
window.toggletip = UniversalToggletip.create;
window.canvasToggletip = UniversalToggletip.createCanvasRegion;

console.log("💬 Universal Toggletip system ready");
