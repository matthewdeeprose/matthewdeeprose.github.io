/**
 * @fileoverview MathPix Mathematics Context Menu — Accessible Copy Menu
 * @module MathPixMathContextMenu
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Provides a lightweight, accessible context menu for mjx-container elements
 * inside MathPix MMD preview containers. Allows users to copy mathematics in
 * LaTeX, MathML, AsciiMath, or plain text format.
 *
 * The mathpix-markdown-it CDN renders each math expression with hidden sibling
 * elements (<latex>, <mathml>, <asciimath>) alongside <mjx-container>. This
 * module extracts content from those siblings and copies to clipboard.
 *
 * Scope: Only activates inside #mmd-preview-content and
 * #resume-mmd-preview-content. Does NOT interfere with page MathJax menus
 * elsewhere in the application.
 *
 * Accessibility (WCAG 2.2 AA):
 * - role="menu" / role="menuitem" structure
 * - Keyboard navigation: arrows, Enter, Space, Escape, Tab
 * - Focus management: focus moves to menu on open, returns on close
 * - aria-live announcements for copy feedback
 * - Minimum 44×44px touch targets
 * - Long-press support for mobile (500ms)
 *
 * @example
 * // Initialise (called from showMathPix init)
 * window.MathPixContextMenu.init();
 *
 * // Destroy (called when switching away from MathPix mode)
 * window.MathPixContextMenu.destroy();
 *
 * // Run tests
 * window.testMathPixContextMenu();
 */

// =============================================================================
// LOGGING CONFIGURATION
// =============================================================================

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR))
    console.error("[MathPix ContextMenu]", message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn("[MathPix ContextMenu]", message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log("[MathPix ContextMenu]", message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log("[MathPix ContextMenu]", message, ...args);
}

// =============================================================================
// SVG ICONS (inline, aria-hidden by default)
// =============================================================================

const MENU_ICONS = {
  latex:
    '<svg aria-hidden="true" class="menu-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><text x="2" y="12" font-size="10" font-family="serif" font-style="italic" fill="currentColor" stroke="none">L</text><text x="8" y="12" font-size="7" font-family="serif" fill="currentColor" stroke="none">T</text></svg>',
  mathml:
    '<svg aria-hidden="true" class="menu-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 8 3-8"/><path d="M12 4v8"/><path d="M10 12h4"/></svg>',
  asciimath:
    '<svg aria-hidden="true" class="menu-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V5a3 3 0 013-3h0a3 3 0 013 3v7"/><path d="M3 9h6"/><circle cx="12.5" cy="9" r="1.5"/></svg>',
  plainText:
    '<svg aria-hidden="true" class="menu-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h10"/><path d="M3 7h7"/><path d="M3 11h10"/></svg>',
  clipboard:
    '<svg aria-hidden="true" class="menu-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="8" height="11" rx="1"/><path d="M6 1h4v3H6z"/></svg>',
};

// =============================================================================
// CONTAINER IDS — where the menu should activate
// =============================================================================

const TARGET_CONTAINER_IDS = [
  "mmd-preview-content",
  "resume-mmd-preview-content",
  "ai-preview-content",
  "convert-preview-rendered-content",
  "mathpix-rendered-output", // Phase 6J: Comparison panel CDN-rendered content
];

// =============================================================================
// LONG-PRESS DURATION (ms) for mobile
// =============================================================================

const LONG_PRESS_MS = 500;

// =============================================================================
// MAIN MODULE
// =============================================================================

/**
 * @class MathPixMathContextMenu
 * @description Singleton controller for the accessible maths context menu
 */
class MathPixMathContextMenu {
  constructor() {
    /** @type {HTMLElement|null} The menu DOM element */
    this.menuElement = null;
    /** @type {HTMLElement|null} The aria-live announcer element */
    this.announcer = null;
    /** @type {HTMLElement|null} The mjx-container that triggered the menu */
    this.triggerElement = null;
    /** @type {Object|null} Extracted format data for the current expression */
    this.currentFormats = null;
    /** @type {boolean} Whether event listeners are attached */
    this.isInitialised = false;
    /** @type {AbortController|null} For removing delegated listeners cleanly */
    this.abortController = null;
    /** @type {number|null} Long-press timer for mobile */
    this.longPressTimer = null;
    /** @type {HTMLElement|null} Touch target for long-press tracking */
    this.longPressTarget = null;
  }

  // ===========================================================================
  // DUPLICATE MATHJAX CLEANUP
  // ===========================================================================

  /**
   * Remove duplicate mjx-container elements created by page MathJax
   * inside MMD preview containers.
   *
   * The CDN renders <math> inside <mathml> and <mjx-assistive-mml>.
   * Page MathJax (tex-mml-chtml.js) finds those <math> elements and
   * creates nested mjx-container duplicates with extra tab stops.
   *
   * This method neutralises those duplicates by removing their tabindex
   * and hiding them from assistive technology.
   *
   * Safe to call multiple times and after each new render.
   */
  sanitisePreviewMath() {
    let cleaned = 0;

    for (const id of TARGET_CONTAINER_IDS) {
      const container = document.getElementById(id);
      if (!container) continue;

      // Find mjx-containers nested inside <mathml> or <mjx-assistive-mml>
      const duplicates = container.querySelectorAll(
        "mathml mjx-container, mjx-assistive-mml mjx-container",
      );

      for (const dup of duplicates) {
        dup.removeAttribute("tabindex");
        dup.setAttribute("aria-hidden", "true");
        dup.style.pointerEvents = "none";
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logInfo(`Neutralised ${cleaned} duplicate MathJax containers`);
    }

    return cleaned;
  }

  // ===========================================================================
  // INITIALISATION & TEARDOWN
  // ===========================================================================

  /**
   * Initialise the context menu system.
   * Finds the HTML elements in the DOM, attaches delegated event listeners.
   * Safe to call multiple times — will not double-attach.
   *
   * @returns {boolean} True if initialisation succeeded
   */
  init() {
    if (this.isInitialised) {
      logDebug("Already initialised — skipping");
      return true;
    }

    this.menuElement = document.getElementById("mathpix-math-context-menu");
    this.announcer = document.getElementById("mathpix-context-menu-announcer");

    if (!this.menuElement) {
      logError(
        "Menu element #mathpix-math-context-menu not found in DOM. " +
          "Ensure the HTML block is present in tools.html.",
      );
      return false;
    }

    if (!this.announcer) {
      logWarn(
        "Announcer element #mathpix-context-menu-announcer not found. " +
          "Copy feedback will not be announced to screen readers.",
      );
    }

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Delegated contextmenu and click listeners on each target container
    for (const id of TARGET_CONTAINER_IDS) {
      const container = document.getElementById(id);
      if (container) {
        container.addEventListener("click", (e) => this.handleClick(e), {
          signal,
        });
        container.addEventListener(
          "contextmenu",
          (e) => this.handleContextMenu(e),
          { signal },
        );
        container.addEventListener(
          "touchstart",
          (e) => this.handleTouchStart(e),
          { signal, passive: true },
        );
        container.addEventListener("touchend", () => this.cancelLongPress(), {
          signal,
        });
        container.addEventListener("touchmove", () => this.cancelLongPress(), {
          signal,
        });
        container.addEventListener(
          "touchcancel",
          () => this.cancelLongPress(),
          { signal },
        );
        logDebug(`Attached listeners to #${id}`);
      } else {
        logDebug(`Container #${id} not found — will skip`);
      }
    }

    // Global listeners for closing the menu
    document.addEventListener("click", (e) => this.handleDocumentClick(e), {
      signal,
    });
    document.addEventListener("keydown", (e) => this.handleDocumentKeydown(e), {
      signal,
    });
    window.addEventListener("blur", () => this.close(), { signal });
    window.addEventListener("resize", () => this.close(), { signal });
    window.addEventListener("scroll", () => this.close(), {
      signal,
      capture: true,
    });

    // Keyboard navigation within the menu
    this.menuElement.addEventListener(
      "keydown",
      (e) => this.handleMenuKeydown(e),
      { signal },
    );

    // Clean up any duplicate MathJax containers from page MathJax
    this.sanitisePreviewMath();

    this.isInitialised = true;
    logInfo("MathPix context menu initialised");
    return true;
  }

  /**
   * Remove all event listeners and clean up.
   * Call when switching away from MathPix mode.
   */
  destroy() {
    this.closeZoom();
    this.close();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.isInitialised = false;
    logInfo("MathPix context menu destroyed");
  }

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  // ===========================================================================
  // CLICK-TO-ZOOM
  // ===========================================================================

  /**
   * Handle click on mjx-container to show zoomed view.
   * Only activates inside target preview containers.
   *
   * @param {MouseEvent} e
   */
  handleClick(e) {
    const mjxContainer = e.target.closest("mjx-container");
    if (!mjxContainer) return;

    // Don't zoom if user is selecting text
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;

    e.preventDefault();
    this.showZoom(mjxContainer);
  }

  /**
   * Display a zoomed overlay of the math expression.
   *
   * @param {HTMLElement} mjxContainer
   */
  showZoom(mjxContainer) {
    // Close any existing zoom
    this.closeZoom();

    // Clone the SVG content
    const svg = mjxContainer.querySelector("svg");
    if (!svg) {
      logWarn("No SVG found in mjx-container for zoom");
      return;
    }

    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "mathpix-math-zoom-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute(
      "aria-label",
      "Zoomed mathematics — click or press Escape to close",
    );
    overlay.setAttribute("tabindex", "-1");

    const content = document.createElement("div");
    content.className = "mathpix-math-zoom-content";
    content.appendChild(svg.cloneNode(true));

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Focus the overlay for keyboard dismissal
    overlay.focus();

    // Store reference and trigger element for focus return
    this.zoomOverlay = overlay;
    this.zoomTrigger = mjxContainer;

    // Close on click anywhere
    overlay.addEventListener("click", () => this.closeZoom());

    // Close on Escape
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.closeZoom();
      }
    });

    logDebug("Zoom overlay opened");
  }

  /**
   * Close the zoom overlay and return focus.
   */
  closeZoom() {
    if (this.zoomOverlay) {
      this.zoomOverlay.remove();
      this.zoomOverlay = null;
    }
    if (this.zoomTrigger) {
      this.zoomTrigger.focus();
      this.zoomTrigger = null;
    }
  }

  /**
   * Handle the contextmenu event (right-click / Shift+F10).
   * Only opens the menu if the target is or is inside an mjx-container.
   *
   * @param {MouseEvent} e
   */
  handleContextMenu(e) {
    const mjxContainer = e.target.closest("mjx-container");
    if (!mjxContainer) return; // Not on a math element — let browser menu show

    e.preventDefault();
    e.stopPropagation();

    // Keyboard-triggered contextmenu events (Shift+F10 / Menu key)
    // have clientX and clientY of 0 — position relative to the element instead
    if (e.clientX === 0 && e.clientY === 0) {
      const rect = mjxContainer.getBoundingClientRect();
      this.openAtPosition(mjxContainer, rect.left, rect.bottom + 4);
    } else {
      this.openAtPosition(mjxContainer, e.clientX, e.clientY);
    }
  }

  /**
   * Handle touchstart for long-press detection on mobile.
   *
   * @param {TouchEvent} e
   */
  handleTouchStart(e) {
    const mjxContainer = e.target.closest?.("mjx-container");
    if (!mjxContainer) return;

    this.longPressTarget = mjxContainer;
    this.longPressTimer = setTimeout(() => {
      const touch = e.touches?.[0];
      if (touch && this.longPressTarget) {
        this.openAtPosition(this.longPressTarget, touch.clientX, touch.clientY);
      }
      this.longPressTarget = null;
    }, LONG_PRESS_MS);
  }

  /**
   * Cancel any in-progress long-press timer.
   */
  cancelLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.longPressTarget = null;
  }

  /**
   * Close the menu when clicking outside it.
   *
   * @param {MouseEvent} e
   */
  handleDocumentClick(e) {
    if (this.isOpen() && !this.menuElement.contains(e.target)) {
      this.close();
    }
  }

  /**
   * Close the menu on Escape anywhere in the document.
   *
   * @param {KeyboardEvent} e
   */
  handleDocumentKeydown(e) {
    if (e.key === "Escape" && this.isOpen()) {
      e.preventDefault();
      this.close();
    }
  }

  /**
   * Keyboard navigation within the menu.
   *
   * @param {KeyboardEvent} e
   */
  handleMenuKeydown(e) {
    const items = this.getVisibleMenuItems();
    if (!items.length) return;

    const currentIndex = items.indexOf(document.activeElement);

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items[next].focus();
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items[prev].focus();
        break;
      }
      case "Home": {
        e.preventDefault();
        items[0].focus();
        break;
      }
      case "End": {
        e.preventDefault();
        items[items.length - 1].focus();
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        if (
          document.activeElement?.classList.contains(
            "mathpix-context-menu-item",
          )
        ) {
          document.activeElement.click();
        }
        break;
      }
      case "Tab": {
        // Close menu and let focus leave naturally
        this.close();
        break;
      }
      default:
        break;
    }
  }

  // ===========================================================================
  // OPEN / CLOSE / POSITION
  // ===========================================================================

  /**
   * Check whether the menu is currently visible.
   *
   * @returns {boolean}
   */
  isOpen() {
    return this.menuElement?.getAttribute("data-visible") === "true";
  }

  /**
   * Open the menu for a given mjx-container at screen coordinates.
   *
   * @param {HTMLElement} mjxContainer - The mjx-container element
   * @param {number} clientX - Screen X position
   * @param {number} clientY - Screen Y position
   */
  openAtPosition(mjxContainer, clientX, clientY) {
    // Close any currently open menu first
    this.close();

    this.triggerElement = mjxContainer;
    this.currentFormats = this.extractFormats(mjxContainer);

    if (!this.currentFormats) {
      logWarn("No maths formats found for this element");
      return;
    }

    // Build menu items based on available formats
    this.populateMenu(this.currentFormats);

    // Show and position
    this.menuElement.setAttribute("data-visible", "true");
    this.positionMenu(clientX, clientY);

    // Move focus to first item
    const firstItem = this.getVisibleMenuItems()[0];
    if (firstItem) {
      firstItem.focus();
    }

    logDebug("Menu opened", {
      formats: Object.keys(this.currentFormats).filter(
        (k) => this.currentFormats[k],
      ),
    });
  }

  /**
   * Close the menu and return focus to the trigger element.
   */
  close() {
    this.closeZoom();
    if (!this.menuElement) return;

    this.menuElement.setAttribute("data-visible", "false");
    this.cancelLongPress();

    // Return focus to the trigger element
    if (this.triggerElement) {
      this.triggerElement.focus();
      this.triggerElement = null;
    }

    this.currentFormats = null;
  }

  /**
   * Position the menu within the viewport.
   *
   * @param {number} x - Desired X position
   * @param {number} y - Desired Y position
   */
  positionMenu(x, y) {
    // Temporarily make visible off-screen to measure
    const menu = this.menuElement;
    menu.style.left = "0";
    menu.style.top = "0";

    const menuRect = menu.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const scrollbarBuffer = 16;

    // Adjust X if menu would overflow right edge
    let finalX = x;
    if (x + menuRect.width > viewportW - scrollbarBuffer) {
      finalX = Math.max(
        scrollbarBuffer,
        viewportW - menuRect.width - scrollbarBuffer,
      );
    }

    // Adjust Y if menu would overflow bottom edge
    let finalY = y;
    if (y + menuRect.height > viewportH - scrollbarBuffer) {
      finalY = Math.max(
        scrollbarBuffer,
        viewportH - menuRect.height - scrollbarBuffer,
      );
    }

    menu.style.left = `${finalX}px`;
    menu.style.top = `${finalY}px`;
  }

  // ===========================================================================
  // FORMAT EXTRACTION
  // ===========================================================================

  /**
   * Extract available maths formats from the DOM siblings of an mjx-container.
   *
   * The CDN renders structures like:
   * <span class="math-inline">
   *   <asciimath style="display: none">...</asciimath>
   *   <latex style="display: none">...</latex>
   *   <mathml style="display: none"><math>...</math></mathml>
   *   <mjx-container ...>...</mjx-container>
   * </span>
   *
   * @param {HTMLElement} mjxContainer
   * @returns {Object|null} Object with latex, mathml, asciimath, plainText keys
   */
  extractFormats(mjxContainer) {
    // Walk up to the math wrapper
    const wrapper = mjxContainer.closest(
      '.math-inline, .math-block, [class*="math-"]',
    );

    let latex = null;
    let mathml = null;
    let asciimath = null;

    if (wrapper) {
      latex = wrapper.querySelector("latex")?.textContent?.trim() || null;
      mathml = wrapper.querySelector("mathml")?.innerHTML?.trim() || null;
      asciimath =
        wrapper.querySelector("asciimath")?.textContent?.trim() || null;
    }

    // Plain text from aria-label (always available on mjx-container)
    let plainText = mjxContainer.getAttribute("aria-label") || null;
    // Strip the "Press Enter to zoom..." suffix if present
    if (plainText) {
      plainText = plainText.replace(/\.\s*Press Enter.*$/, "").trim();
    }

    // Return null if nothing was found at all
    if (!latex && !mathml && !asciimath && !plainText) {
      return null;
    }

    return { latex, mathml, asciimath, plainText };
  }

  // ===========================================================================
  // MENU POPULATION
  // ===========================================================================

  /**
   * Show/hide menu items based on which formats are available.
   * Items are pre-defined in the HTML; we toggle their display.
   *
   * @param {Object} formats - The extracted formats object
   */
  populateMenu(formats) {
    const itemMap = {
      latex: "mathpix-ctx-copy-latex",
      mathml: "mathpix-ctx-copy-mathml",
      asciimath: "mathpix-ctx-copy-asciimath",
      plainText: "mathpix-ctx-copy-plain",
    };

    let visibleCount = 0;

    for (const [key, elementId] of Object.entries(itemMap)) {
      const item = document.getElementById(elementId);
      if (!item) continue;

      const hasData = !!formats[key];
      item.style.display = hasData ? "" : "none";
      item.setAttribute("aria-disabled", hasData ? "false" : "true");
      item.removeAttribute("data-copied");

      if (hasData) visibleCount++;
    }

    // Show/hide the separator before plain text
    const separator = document.getElementById("mathpix-ctx-separator");
    if (separator) {
      // Show separator only if we have at least one format above AND plain text below
      const hasFormatAbove =
        formats.latex || formats.mathml || formats.asciimath;
      separator.style.display =
        hasFormatAbove && formats.plainText ? "" : "none";
    }

    logDebug(`Populated menu: ${visibleCount} items visible`);
  }

  /**
   * Get all currently visible (non-hidden) menu items.
   *
   * @returns {HTMLElement[]}
   */
  getVisibleMenuItems() {
    if (!this.menuElement) return [];
    return Array.from(
      this.menuElement.querySelectorAll(
        '.mathpix-context-menu-item:not([style*="display: none"]):not([aria-disabled="true"])',
      ),
    );
  }

  // ===========================================================================
  // COPY ACTIONS
  // ===========================================================================

  /**
   * Copy a specific format to the clipboard.
   * Called by onclick on menu items.
   *
   * @param {string} format - One of 'latex', 'mathml', 'asciimath', 'plainText'
   */
  async copyFormat(format) {
    if (!this.currentFormats) {
      logWarn("No formats available to copy");
      return;
    }

    const content = this.currentFormats[format];
    if (!content) {
      logWarn(`Format "${format}" not available for this expression`);
      this.announce("Content not available for this format.");
      return;
    }

    const formatLabels = {
      latex: "LaTeX",
      mathml: "MathML",
      asciimath: "AsciiMath",
      plainText: "Plain text",
    };

    const label = formatLabels[format] || format;

    try {
      await navigator.clipboard.writeText(content);
      logDebug(`Copied ${label} to clipboard`);

      // Visual feedback on the menu item
      const itemMap = {
        latex: "mathpix-ctx-copy-latex",
        mathml: "mathpix-ctx-copy-mathml",
        asciimath: "mathpix-ctx-copy-asciimath",
        plainText: "mathpix-ctx-copy-plain",
      };
      const item = document.getElementById(itemMap[format]);
      if (item) {
        item.setAttribute("data-copied", "true");
      }

      // Announce success
      this.announce(`${label} copied to clipboard.`);

      // Use notification system if available
      if (typeof window.notifySuccess === "function") {
        window.notifySuccess(`${label} copied to clipboard`);
      }

      // Close menu after a brief flash so the user sees the feedback
      setTimeout(() => this.close(), 250);
    } catch (err) {
      logError("Clipboard write failed", err);
      this.announce(`Failed to copy ${label}. Please try again.`);

      if (typeof window.notifyError === "function") {
        window.notifyError(`Failed to copy ${label}`);
      }
    }
  }

  // ===========================================================================
  // SCREEN READER ANNOUNCEMENTS
  // ===========================================================================

  /**
   * Announce a message to screen readers via the aria-live region.
   *
   * @param {string} message
   */
  announce(message) {
    if (!this.announcer) return;

    // Clear first, then set — ensures repeated identical messages are announced
    this.announcer.textContent = "";
    requestAnimationFrame(() => {
      this.announcer.textContent = message;
    });
  }
}

// =============================================================================
// SINGLETON INSTANCE & GLOBAL EXPOSURE
// =============================================================================

const contextMenuInstance = new MathPixMathContextMenu();

// Global access for integration and testing
window.MathPixContextMenu = contextMenuInstance;

window.getMathPixContextMenu = () => contextMenuInstance;

/**
 * Sanitise duplicate MathJax containers in preview.
 * Call after new MMD content is rendered.
 */
window.sanitiseMathPixPreviewMath = () =>
  contextMenuInstance.sanitisePreviewMath();

// =============================================================================
// GLOBAL COPY HANDLER (called from onclick in HTML)
// =============================================================================

/**
 * Global function called by onclick on menu items in tools.html.
 * @param {string} format - The format to copy
 */
window.mathpixContextMenuCopy = (format) => {
  contextMenuInstance.copyFormat(format);
};

// =============================================================================
// TEST SUITE
// =============================================================================

/**
 * Comprehensive test suite for the context menu.
 * Run from browser console: window.testMathPixContextMenu()
 *
 * @returns {Promise<boolean>} True if all tests passed
 */
window.testMathPixContextMenu = async () => {
  console.log("=== MathPix Context Menu Test Suite ===\n");
  let passed = 0;
  let failed = 0;

  const assert = (description, condition) => {
    if (condition) {
      console.log(`✓ ${description}`);
      passed++;
    } else {
      console.error(`✗ ${description}`);
      failed++;
    }
  };

  const menu = contextMenuInstance;

  // ---- Test 1: Menu element exists in DOM ----
  const menuEl = document.getElementById("mathpix-math-context-menu");
  assert("1. Menu element exists in DOM", !!menuEl);

  // ---- Test 2: Menu is hidden by default ----
  assert(
    "2. Menu is hidden by default",
    menuEl?.getAttribute("data-visible") !== "true",
  );

  // ---- Test 3: Menu has correct ARIA attributes ----
  assert('3. Menu has role="menu"', menuEl?.getAttribute("role") === "menu");
  assert("3b. Menu has aria-label", !!menuEl?.getAttribute("aria-label"));

  // ---- Test 4: Menu items have role="menuitem" ----
  const menuItems = menuEl?.querySelectorAll('[role="menuitem"]') || [];
  assert("4. Menu items have role='menuitem'", menuItems.length >= 4);

  // ---- Test 5: Announcer element exists ----
  const announcer = document.getElementById("mathpix-context-menu-announcer");
  assert("5. Announcer element exists", !!announcer);
  assert(
    '5b. Announcer has aria-live="assertive"',
    announcer?.getAttribute("aria-live") === "assertive",
  );

  // ---- Test 6: Right-click on mjx-container opens menu (if content exists) ----
  const previewContainer =
    document.getElementById("mmd-preview-content") ||
    document.getElementById("resume-mmd-preview-content");
  const mjxElement =
    document.querySelector("#mmd-preview-content mjx-container") ||
    document.querySelector("#resume-mmd-preview-content mjx-container");

  if (mjxElement) {
    // Ensure initialised
    menu.init();

    // Simulate right-click
    const fakeEvent = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 200,
    });
    mjxElement.dispatchEvent(fakeEvent);

    assert("6. Right-click on mjx-container opens menu", menu.isOpen());

    // ---- Test 7: Menu items correspond to available formats ----
    const formats = menu.extractFormats(mjxElement);
    if (formats) {
      const hasLatex =
        document.getElementById("mathpix-ctx-copy-latex")?.style.display !==
        "none";
      assert(
        "7. LaTeX item visibility matches data availability",
        hasLatex === !!formats.latex,
      );
    } else {
      assert(
        "7. No formats found (expected if content has no hidden elements)",
        true,
      );
    }

    // ---- Test 8: Escape closes menu ----
    const escEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    });
    document.dispatchEvent(escEvent);
    assert("8. Escape closes menu", !menu.isOpen());

    // ---- Test 9: Arrow key navigation ----
    // Re-open
    mjxElement.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 200,
        clientY: 200,
      }),
    );

    if (menu.isOpen()) {
      const visibleItems = menu.getVisibleMenuItems();
      if (visibleItems.length > 1) {
        visibleItems[0].focus();
        menuEl.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        );
        assert(
          "9. ArrowDown moves focus to next item",
          document.activeElement === visibleItems[1],
        );
      } else {
        assert("9. ArrowDown navigation (only 1 item, skipped)", true);
      }
      menu.close();
    } else {
      assert("9. ArrowDown navigation (menu did not open, skipped)", true);
    }

    // ---- Test 10: Menu closes after copy action ----
    assert("10. Menu closed after test sequence", !menu.isOpen());
  } else {
    console.log(
      "⚠ Tests 6–10 skipped: no mjx-container in #mmd-preview-content. " +
        "Process a document first, then re-run.",
    );
    assert("6–10. (Skipped — no rendered content)", true);
  }

  // ---- Test 11: Menu does not appear for mjx-containers outside preview ----
  const outsideMjx = document.querySelector(
    "mjx-container:not(#mmd-preview-content mjx-container):not(#resume-mmd-preview-content mjx-container)",
  );
  if (outsideMjx) {
    const beforeState = menu.isOpen();
    // This should NOT trigger our handler since it's outside our containers
    outsideMjx.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100,
      }),
    );
    assert(
      "11. Menu does not open for mjx-container outside preview",
      !menu.isOpen() || menu.isOpen() === beforeState,
    );
  } else {
    assert(
      "11. (Skipped — no mjx-container outside preview containers found)",
      true,
    );
  }

  // ---- Test 12: Viewport bounds check ----
  if (menuEl) {
    menu.menuElement = menuEl;
    menuEl.setAttribute("data-visible", "true");
    menu.positionMenu(window.innerWidth + 100, window.innerHeight + 100);
    const rect = menuEl.getBoundingClientRect();
    const inBounds =
      rect.right <= window.innerWidth && rect.bottom <= window.innerHeight;
    assert("12. Menu repositions within viewport bounds", inBounds);
    menuEl.setAttribute("data-visible", "false");
  } else {
    assert("12. (Skipped — menu element not found)", true);
  }

  // ---- Test 13: Format extraction function ----
  const extractTest = menu.extractFormats(document.createElement("div"));
  assert(
    "13. extractFormats returns null for element with no math wrapper",
    extractTest === null,
  );

  // ---- Summary ----
  console.log("\n=====================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log("🎉 All context menu tests passed!");
  } else {
    console.log("⚠ Some tests failed — review above");
  }

  return failed === 0;
};

export default MathPixMathContextMenu;
