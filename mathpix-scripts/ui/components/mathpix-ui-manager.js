/**
 * @fileoverview MathPix UI Manager - Handles element caching, event management, and configuration
 * @module MathPixUIManager
 * @requires ../../core/mathpix-base-module.js
 * @author MathPix Development Team
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Manages all user interface elements and interactions for the MathPix system.
 * This module provides centralised UI element caching, comprehensive event listener
 * management with automatic cleanup, and configuration persistence through localStorage.
 *
 * Key Features:
 * - Automated UI element discovery and caching for all format types
 * - Event listener lifecycle management with tracked cleanup
 * - Configuration persistence with localStorage integration
 * - Multi-format UI element management (LaTeX, MathML, AsciiMath, HTML, Markdown, JSON)
 * - Drag-and-drop file upload interface with keyboard accessibility
 * - Integration with existing notification systems
 *
 * Integration:
 * - Extends MathPixBaseModule for consistent architecture
 * - Integrates with MarkdownCodeCopy system for syntax highlighting
 * - Coordinates with file handler for upload workflow
 * - Connects to API client for credential management
 *
 * Accessibility:
 * - WCAG 2.2 AA compliant throughout
 * - Full keyboard navigation support for drag-and-drop areas
 * - Screen reader compatible with appropriate ARIA labels
 * - Focus management for modal dialogs and file selection
 */

// Logging configuration (module level)
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

// =============================================================================
// SVG Icon Registry - Centralised icons for DOM elements
// Standard icons use currentColor for theme compatibility
// =============================================================================
const ICONS = {
  warning:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" transform="translate(1 1)"><path d="m9.5.5 9 16h-18z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="m9.5 10.5v-5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="13.5" fill="currentColor" r="1"/></g></svg>',
  checkCircle:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 2)"><circle cx="8.5" cy="8.5" r="8"/><path d="m5.5 9.5 2 2 5-5"/></g></svg>',
};

// Flag icons - retain official country colours (not currentColor)
const FLAG_ICONS = {
  US: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="usClip"><rect x="2" y="4" width="17" height="13" rx="2"/></clipPath></defs><g clip-path="url(#usClip)"><rect x="2" y="4" width="17" height="13" fill="#fff"/><g fill="#b22234"><rect x="2" y="4" width="17" height="1"/><rect x="2" y="6" width="17" height="1"/><rect x="2" y="8" width="17" height="1"/><rect x="2" y="10" width="17" height="1"/><rect x="2" y="12" width="17" height="1"/><rect x="2" y="14" width="17" height="1"/><rect x="2" y="16" width="17" height="1"/></g><rect x="2" y="4" width="7" height="7" fill="#3c3b6e"/><g fill="#fff"><circle cx="3.5" cy="5.2" r="0.4"/><circle cx="5.5" cy="5.2" r="0.4"/><circle cx="7.5" cy="5.2" r="0.4"/><circle cx="4.5" cy="6.4" r="0.4"/><circle cx="6.5" cy="6.4" r="0.4"/><circle cx="3.5" cy="7.6" r="0.4"/><circle cx="5.5" cy="7.6" r="0.4"/><circle cx="7.5" cy="7.6" r="0.4"/><circle cx="4.5" cy="8.8" r="0.4"/><circle cx="6.5" cy="8.8" r="0.4"/><circle cx="3.5" cy="10" r="0.4"/><circle cx="5.5" cy="10" r="0.4"/><circle cx="7.5" cy="10" r="0.4"/></g></g></svg>',
  EU: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="4" width="17" height="13" rx="2" fill="#039"/><g fill="#fc0" transform="translate(10.5, 10.5)"><circle r="1" transform="translate(0, -4.5)"/><circle r="1" transform="rotate(30) translate(0, -4.5)"/><circle r="1" transform="rotate(60) translate(0, -4.5)"/><circle r="1" transform="rotate(90) translate(0, -4.5)"/><circle r="1" transform="rotate(120) translate(0, -4.5)"/><circle r="1" transform="rotate(150) translate(0, -4.5)"/><circle r="1" transform="rotate(180) translate(0, -4.5)"/><circle r="1" transform="rotate(210) translate(0, -4.5)"/><circle r="1" transform="rotate(240) translate(0, -4.5)"/><circle r="1" transform="rotate(270) translate(0, -4.5)"/><circle r="1" transform="rotate(300) translate(0, -4.5)"/><circle r="1" transform="rotate(330) translate(0, -4.5)"/></g></svg>',
  ASIA: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="sgClip"><rect x="2" y="4" width="17" height="13" rx="2"/></clipPath></defs><g clip-path="url(#sgClip)"><rect x="2" y="4" width="17" height="13" fill="#fff"/><rect x="2" y="4" width="17" height="6.5" fill="#ed2939"/><circle cx="6.5" cy="7.25" r="2.5" fill="#fff"/><circle cx="7.5" cy="7.25" r="2.5" fill="#ed2939"/><g fill="#fff"><path d="M9.5 5.5l-.35 1.08.92-.67h-1.14l.92.67z"/><path d="M11.5 6.5l-.35 1.08.92-.67h-1.14l.92.67z"/><path d="M11.5 8.5l-.35 1.08.92-.67h-1.14l.92.67z"/><path d="M9.5 9.2l-.35 1.08.92-.67h-1.14l.92.67z"/><path d="M8 8.5l-.35 1.08.92-.67h-1.14l.92.67z"/></g></g></svg>',
};

/**
 * @function getIcon
 * @description Returns an SVG icon with accessibility attributes and optional CSS class
 * @param {string} name - Icon name from ICONS registry
 * @param {Object} [options={}] - Configuration options
 * @param {string} [options.className] - Additional CSS class to apply
 * @returns {string} SVG markup with aria-hidden and class attributes, or empty string if not found
 */
function getIcon(name, options = {}) {
  const svg = ICONS[name];
  if (!svg) {
    logWarn(`Unknown icon requested: ${name}`);
    return "";
  }
  const className = options.className
    ? ` class="icon ${options.className}"`
    : ' class="icon"';
  return svg.replace("<svg", `<svg aria-hidden="true"${className}`);
}

/**
 * @function getFlagIcon
 * @description Returns a flag SVG icon with accessibility attributes
 * @param {string} region - Region code (US, EU, ASIA)
 * @returns {string} SVG markup with aria-hidden and class attributes, or empty string if not found
 */
function getFlagIcon(region) {
  const svg = FLAG_ICONS[region];
  if (!svg) {
    logWarn(`Unknown flag region requested: ${region}`);
    return "";
  }
  return svg.replace("<svg", '<svg aria-hidden="true" class="icon icon-flag"');
}

import MathPixBaseModule from "../../core/mathpix-base-module.js";

/**
 * @class MathPixUIManager
 * @extends MathPixBaseModule
 * @description
 * Centralized UI management for the MathPix system. Handles element caching,
 * event listener lifecycle, configuration persistence, and user interface state.
 * Provides a clean separation between UI management and business logic.
 *
 * The UI Manager follows a tracked event listener pattern to ensure proper cleanup
 * and prevent memory leaks. All DOM interactions are centralised through this module
 * to maintain consistency and accessibility standards.
 *
 * @example
 * const uiManager = new MathPixUIManager(controller);
 * uiManager.cacheElements();
 * uiManager.attachEventListeners();
 * uiManager.loadStoredConfig();
 *
 * @see {@link MathPixBaseModule} for base functionality
 * @see {@link MathPixFileHandler} for file upload coordination
 * @since 1.0.0
 */
class MathPixUIManager extends MathPixBaseModule {
  /**
   * @constructor
   * @description
   * Initializes the UI Manager with event listener tracking and configuration state.
   * Sets up the foundation for DOM element caching and user interaction management.
   *
   * @param {MathPixController} controller - Main MathPix controller instance
   *
   * @throws {Error} Throws if controller is not provided (inherited from base class)
   *
   * @example
   * const uiManager = new MathPixUIManager(mathPixController);
   *
   * @accessibility Initialises tracking for accessible event handlers
   * @since 1.0.0
   */
  constructor(controller) {
    super(controller);

    /**
     * @type {Array<Object>}
     * @description
     * Tracked event listeners for proper cleanup. Each object contains:
     * - element: DOM element with the listener
     * - event: Event type string
     * - handler: Reference to handler function
     *
     * @private
     */
    this.eventListeners = [];

    /**
     * @type {boolean}
     * @description
     * Configuration loading state. True when API credentials have been
     * successfully loaded and validated from localStorage or user input.
     *
     * @private
     */
    this.configLoaded = false;

    /**
     * @type {boolean}
     * @description
     * Event listener attachment state. Prevents duplicate listener attachment
     * when init() is called multiple times during tool switching.
     *
     * @private
     */
    this._eventListenersAttached = false;

    this.isInitialised = true;

    logInfo("MathPix UI Manager initialised");
  }

  /**
   * @method cacheElements
   * @description
   * Discovers and caches all MathPix UI elements for efficient access.
   * Performs comprehensive element discovery for core interface elements,
   * multi-format output panels, metadata displays, and dynamic preview containers.
   *
   * Missing elements are logged as warnings but do not prevent initialization,
   * allowing for graceful degradation in different UI contexts.
   *
   * @returns {void}
   *
   * @example
   * uiManager.cacheElements();
   * console.log(uiManager.controller.elements['file-input']); // Cached element
   *
   * @accessibility Ensures all cached elements support keyboard navigation
   * @since 1.0.0
   */
  cacheElements() {
    const elementIds = [
      "mathpix-drop-zone",
      "mathpix-file-input",
      "mathpix-output-container",
      "mathpix-app-id",
      "mathpix-app-key",
      "mathpix-save-config",
      "mathpix-fullscreen-btn",
      // Phase 2.1: PDF Processing Elements
      "mathpix-pdf-options",
      "mathpix-pdf-results",
      "mathpix-doc-name",
      "mathpix-doc-pages",
      "mathpix-doc-time",
      "mathpix-doc-formats",
      // ✅ PHASE 4 FIX: Added missing final action button IDs
      "mathpix-process-another-pdf",
      "mathpix-clear-pdf-results",
      // Phase 1C: Strokes System Elements
      "mathpix-draw-canvas",
      "mathpix-upload-container",
      "mathpix-draw-container",
      "mathpix-upload-mode-radio",
      "mathpix-draw-mode-radio",
      "mathpix-clear-canvas-btn",
      "mathpix-undo-stroke-btn",
      "mathpix-submit-strokes-btn",
      // Phase 1D: Camera Capture Elements
      "mathpix-camera-container",
      "mathpix-camera-mode-radio",
      "mathpix-camera-video",
      // Phase 1E: Camera Control Buttons
      "mathpix-start-camera-btn",
      "mathpix-capture-photo-btn",
      "mathpix-switch-camera-btn",
      "mathpix-rotate-capture-btn",
      "mathpix-camera-status",
      // Phase 1F: Mirror Toggle Button
      "mathpix-mirror-toggle-btn",
      // Phase 1F.2: Preview Transform Controls
      "mathpix-transform-controls",
      "mathpix-rotate-preview-btn",
      "mathpix-flip-preview-btn",
      "mathpix-transform-state",
      "mathpix-image-preview",
      // Phase 6.3: Convert Mode Elements
      "mathpix-convert-mode-container",
      "mathpix-convert-mode-radio",
      // Phase 8.2: Resume Session Mode Elements
      "mathpix-resume-mode-container",
      "mathpix-resume-mode-radio",
    ];

    // Cache basic elements with standardised naming
    for (const id of elementIds) {
      const element = document.getElementById(id);

      // For PDF elements, cache with both full ID and shortened ID for compatibility
      if (id.startsWith("mathpix-pdf-")) {
        this.controller.elements[id] = element; // Full ID for PDF renderer
        this.controller.elements[id.replace("mathpix-", "")] = element; // Shortened for legacy
      } else {
        this.controller.elements[id.replace("mathpix-", "")] = element; // Standard shortened naming
      }

      if (!element) {
        logWarn(`Element not found: ${id}`);
      }
    }

    // Cache format-specific elements
    this.cacheMultiFormatElements();

    // Phase 2: Cache processing options UI elements
    this.controller.elements.processingOptions = document.getElementById(
      "mathpix-processing-options"
    );
    this.controller.elements.equationNumberingCheckbox =
      document.getElementById("mathpix-equation-numbering");
    this.controller.elements.delimiterRadios =
      document.getElementsByName("mathpix-delimiters");
    this.controller.elements.pageInfoCheckbox =
      document.getElementById("mathpix-page-info");

    // Phase 2.0: Cache endpoint selection elements
    this.controller.elements.endpointRadios = document.querySelectorAll(
      'input[name="mathpix-endpoint"]'
    );

    // Track if preference listeners attached (prevent duplicates)
    this._preferencesListenersAttached = false;

    // Track if endpoint listeners attached (prevent duplicates) - Phase 1 Step 6
    this._endpointListenersAttached = false;

    logDebug("Elements cached", Object.keys(this.controller.elements));
  }

  /**
   * @method cacheMultiFormatElements
   * @description
   * Caches UI elements specific to multi-format mathematical content display.
   * Handles format radio buttons, content containers, output panels, and metadata
   * elements for all supported mathematical formats (LaTeX, MathML, AsciiMath, etc.).
   *
   * Initialises preview containers for dynamic content and sets up file handling state.
   *
   * @returns {void}
   * @private
   *
   * @example
   * this.cacheMultiFormatElements();
   * // Access cached format elements
   * const latexContent = this.controller.elements.formatContents.latex;
   *
   * @accessibility Ensures format selection maintains accessible form structure
   * @since 1.0.0
   */
  cacheMultiFormatElements() {
    // Cache format tab buttons for user selection
    this.controller.elements.formatTabs = document.querySelectorAll(
      '.mathpix-tab-header[role="tab"]'
    );

    // Cache format-specific content and panel elements
    const formats = [
      "latex",
      "mathml",
      "asciimath",
      "html",
      "markdown",
      "json",
      "table-html",
      "table-markdown",
      "table-tsv",
    ];
    this.controller.elements.formatContents = {};
    this.controller.elements.formatPanels = {};

    formats.forEach((format) => {
      this.controller.elements.formatContents[format] = document.getElementById(
        `mathpix-content-${format}`
      );
      this.controller.elements.formatPanels[format] = document.getElementById(
        `mathpix-output-${format}`
      );
    });

    // Cache metadata display elements
    this.controller.elements.confidence =
      document.getElementById("mathpix-confidence");
    this.controller.elements.type = document.getElementById("mathpix-type");
    this.controller.elements.formats =
      document.getElementById("mathpix-formats");
    this.controller.elements.htmlPreview = document.getElementById(
      "mathpix-html-preview-content"
    );

    // Initialize dynamic preview containers (populated during processing)
    this.controller.elements.imagePreviewContainer = null;
    this.controller.elements.comparisonContainer = null;
    this.controller.elements.progressContainer = null;

    // Initialize file handling state
    this.controller.currentUploadedFile = null;
    this.controller.currentFileBlob = null;

    logDebug("Multi-format elements cached", {
      tabButtons: this.controller.elements.formatTabs.length,
      contentElements: Object.keys(this.controller.elements.formatContents)
        .length,
      usingExistingCopySystem: true,
      previewSystemReady: true,
    });
  }

  /**
   * @method attachEventListeners
   * @description
   * Attaches comprehensive event listeners for all MathPix UI interactions.
   * Implements tracked event listener pattern for proper cleanup and memory management.
   * Supports file upload, drag-and-drop, keyboard navigation, format switching, and
   * configuration management.
   *
   * All event listeners are automatically tracked for cleanup during module destruction.
   * Integrates with existing accessibility patterns and notification systems.
   *
   * @returns {void}
   *
   * @example
   * uiManager.attachEventListeners();
   * // Event listeners are now active and tracked
   *
   * @accessibility
   * - Keyboard navigation for drag-and-drop areas (Enter/Space activation)
   * - Focus management for file selection workflows
   * - Screen reader announcements for state changes
   * @since 1.0.0
   */
  attachEventListeners() {
    // Guard against duplicate attachment (fixes multiple file dialogs issue)
    if (this._eventListenersAttached) {
      logDebug(
        "Event listeners already attached, skipping duplicate attachment"
      );
      return;
    }

    // File input change handler with smart routing (Phase 4)
    if (this.controller.elements["file-input"]) {
      const fileInputHandler = (e) => {
        logDebug("File input change event triggered", {
          filesLength: e.target.files?.length,
          firstFile: e.target.files[0]?.name,
        });

        if (e.target.files[0]) {
          const file = e.target.files[0];

          // Phase 4: Smart routing - document formats vs image formats
          const formatInfo = MATHPIX_CONFIG.getFormatInfo(file.type);

          if (formatInfo) {
            // Document format (PDF/DOCX/PPTX) → PDF Handler
            logDebug("Routing document format to PDF handler", {
              fileName: file.name,
              format: formatInfo.displayName,
            });
            this.controller.handlePDFFileUpload(file);
          } else {
            // Image format (JPEG/PNG/WebP) → File Handler
            logDebug("Routing image format to file handler", {
              fileName: file.name,
              type: file.type,
            });
            this.controller.handleFileUpload(file);
          }
        } else {
          logWarn("No file selected in change event");
        }
      };

      this.controller.elements["file-input"].addEventListener(
        "change",
        fileInputHandler
      );
      this.trackEventListener(
        this.controller.elements["file-input"],
        "change",
        fileInputHandler
      );
    }

    // Drop zone click activation
    if (this.controller.elements["drop-zone"]) {
      const dropZoneClickHandler = () => {
        const fileInput = this.controller.elements["file-input"];
        if (fileInput) {
          fileInput.click();
        } else {
          logError("File input element not found for click handler");
        }
      };

      this.controller.elements["drop-zone"].addEventListener(
        "click",
        dropZoneClickHandler
      );
      this.trackEventListener(
        this.controller.elements["drop-zone"],
        "click",
        dropZoneClickHandler
      );
    }

    // Drop zone keyboard accessibility
    if (this.controller.elements["drop-zone"]) {
      const dropZoneKeydownHandler = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.controller.elements["file-input"]?.click();
        }
      };

      this.controller.elements["drop-zone"].addEventListener(
        "keydown",
        dropZoneKeydownHandler
      );
      this.trackEventListener(
        this.controller.elements["drop-zone"],
        "keydown",
        dropZoneKeydownHandler
      );
    }

    // Drag and drop file handling with smart routing (Phase 4)
    if (this.controller.elements["drop-zone"]) {
      const dragOverHandler = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add("drag-over");
      };

      const dragLeaveHandler = (e) => {
        e.currentTarget.classList.remove("drag-over");
      };

      const dropHandler = (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove("drag-over");
        const files = e.dataTransfer.files;

        if (files[0]) {
          const file = files[0];

          // Phase 4: Smart routing - document formats vs image formats
          const formatInfo = MATHPIX_CONFIG.getFormatInfo(file.type);

          if (formatInfo) {
            // Document format (PDF/DOCX/PPTX) → PDF Handler
            logDebug("Routing dropped document to PDF handler", {
              fileName: file.name,
              format: formatInfo.displayName,
            });
            this.controller.handlePDFFileUpload(file);
          } else {
            // Image format (JPEG/PNG/WebP) → File Handler
            logDebug("Routing dropped image to file handler", {
              fileName: file.name,
              type: file.type,
            });
            this.controller.handleFileUpload(file);
          }
        }
      };

      this.controller.elements["drop-zone"].addEventListener(
        "dragover",
        dragOverHandler
      );
      this.controller.elements["drop-zone"].addEventListener(
        "dragleave",
        dragLeaveHandler
      );
      this.controller.elements["drop-zone"].addEventListener(
        "drop",
        dropHandler
      );

      this.trackEventListener(
        this.controller.elements["drop-zone"],
        "dragover",
        dragOverHandler
      );
      this.trackEventListener(
        this.controller.elements["drop-zone"],
        "dragleave",
        dragLeaveHandler
      );
      this.trackEventListener(
        this.controller.elements["drop-zone"],
        "drop",
        dropHandler
      );
    }

    // Clipboard paste handling with smart focus detection
    const pasteHandler = async (e) => {
      // Check if MathPix mode is active
      const mathpixRadio = document.getElementById("MathPix");
      if (!mathpixRadio || !mathpixRadio.checked) {
        logDebug("[MathPixUIManager] Paste event ignored - MathPix not active");
        return;
      }

      // Check if user is pasting into a text input/textarea - if so, don't intercept
      const activeElement = document.activeElement;
      const isTextInput =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable);

      if (isTextInput) {
        logDebug(
          "[MathPixUIManager] Paste event ignored - user is typing in text field"
        );
        return;
      }

      logDebug("[MathPixUIManager] Paste event detected whilst MathPix active");

      // Delegate to file handler for clipboard processing
      if (
        this.controller.fileHandler &&
        this.controller.fileHandler.handleClipboardPaste
      ) {
        await this.controller.fileHandler.handleClipboardPaste(e);
      } else {
        logError(
          "[MathPixUIManager] File handler clipboard method not available"
        );
      }
    };

    document.addEventListener("paste", pasteHandler);
    this.trackEventListener(document, "paste", pasteHandler);

    logDebug("Clipboard paste handler attached with smart focus detection");

    // Format selection tab button handlers
    if (this.controller.elements.formatTabs) {
      this.controller.elements.formatTabs.forEach((tab) => {
        const tabClickHandler = (e) => {
          // Get format from data-format attribute
          const format = tab.dataset.format;
          if (format) {
            this.controller.showFormat(format);
          }
        };

        tab.addEventListener("click", tabClickHandler);
        this.trackEventListener(tab, "click", tabClickHandler);

        // Arrow key navigation for ARIA tabs pattern (WCAG 2.2 AA requirement)
        const tabKeyHandler = (e) => {
          const tabs = Array.from(this.controller.elements.formatTabs).filter(
            (t) => t.style.display !== "none" // Only navigate visible tabs
          );
          const currentIndex = tabs.indexOf(tab);
          let targetTab = null;

          switch (e.key) {
            case "ArrowRight":
            case "ArrowDown":
              e.preventDefault();
              // Move to next tab, wrap to first if at end
              targetTab = tabs[(currentIndex + 1) % tabs.length];
              break;

            case "ArrowLeft":
            case "ArrowUp":
              e.preventDefault();
              // Move to previous tab, wrap to last if at beginning
              targetTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
              break;

            case "Home":
              e.preventDefault();
              // Move to first tab
              targetTab = tabs[0];
              break;

            case "End":
              e.preventDefault();
              // Move to last tab
              targetTab = tabs[tabs.length - 1];
              break;
          }

          if (targetTab) {
            // Switch to the target format
            const format = targetTab.dataset.format;
            if (format) {
              this.controller.showFormat(format);
            }
            // Focus the target tab
            targetTab.focus();
          }
        };

        tab.addEventListener("keydown", tabKeyHandler);
        this.trackEventListener(tab, "keydown", tabKeyHandler);
      });

      logInfo("Format tab handlers attached with arrow key navigation");
    }

    // PDF view mode handlers removed (feature deprecated)

    // Delegation to existing MarkdownCodeCopy system for syntax highlighting
    logDebug(
      "Copy button functionality delegated to existing MarkdownCodeCopy system"
    );

    // Phase 2.0: Endpoint selection handlers
    this.setupEndpointSelection();

    // Configuration save handler
    if (this.controller.elements["save-config"]) {
      const saveConfigHandler = () => {
        this.saveConfiguration();
      };

      this.controller.elements["save-config"].addEventListener(
        "click",
        saveConfigHandler
      );
      this.trackEventListener(
        this.controller.elements["save-config"],
        "click",
        saveConfigHandler
      );
    }

    // Fullscreen button handler
    this.attachFullscreenHandler();

    // Table styling preference toggle
    const styleToggle = document.getElementById(
      "mathpix-preserve-table-styles"
    );
    if (styleToggle) {
      const styleToggleHandler = () => {
        logDebug("Table styling preference changed", {
          preserveStyles: styleToggle.checked,
        });

        // Check if we're currently viewing table HTML format
        const currentFormat =
          this.controller.resultRenderer?.getCurrentFormat();
        if (
          currentFormat === "table-html" &&
          this.controller.originalTableHtml
        ) {
          // Re-render the table with new styling preference
          const contentElement =
            this.controller.elements.formatContents["table-html"];
          const wrapper = contentElement?.parentElement?.parentElement;

          if (contentElement && wrapper) {
            logDebug("Re-rendering table with new styling preference");
            this.controller.resultRenderer.populateTableFormat(
              "table-html",
              this.controller.originalTableHtml,
              contentElement
            );
          }

          // Show user feedback
          this.showNotification(
            styleToggle.checked
              ? "Table styling preserved"
              : "Table styling removed - code is now cleaner for custom CSS",
            "info"
          );
        } else {
          logDebug("Not currently viewing table HTML or no table loaded");
        }
      };

      styleToggle.addEventListener("change", styleToggleHandler);
      this.trackEventListener(styleToggle, "change", styleToggleHandler);

      logDebug("Table styling toggle event listener attached");
    }

    // Phase 1C: Canvas control button handlers
    this.attachCanvasControlHandlers();

    // Phase 2A: Canvas size button handlers
    this.attachCanvasSizeButtonListeners();
    this.attachCustomSizeHandler();

    // Mark as attached to prevent duplicates
    this._eventListenersAttached = true;

    logDebug("Event listeners attached", {
      trackedListeners: this.eventListeners.length,
    });
  }

  /**
   * @method attachCanvasControlHandlers
   * @description
   * Attaches event listeners for canvas control buttons (clear, undo, submit).
   * Delegates actual operations to the strokes canvas instance via the controller.
   * Phase 1C: Strokes system integration.
   *
   * @returns {void}
   * @private
   *
   * @accessibility
   * - All buttons have visible text labels
   * - Keyboard accessible via native button elements
   * - Focus management maintained
   * @since Phase 1C
   */
  attachCanvasControlHandlers() {
    // Clear canvas button
    if (this.controller.elements["clear-canvas-btn"]) {
      const clearHandler = () => {
        if (this.controller.strokesCanvas) {
          this.controller.strokesCanvas.clearAllStrokes();
          logDebug("Canvas cleared via UI button");
        } else {
          logWarn("Strokes canvas not initialised for clear operation");
        }
      };

      this.controller.elements["clear-canvas-btn"].addEventListener(
        "click",
        clearHandler
      );
      this.trackEventListener(
        this.controller.elements["clear-canvas-btn"],
        "click",
        clearHandler
      );
    }

    // Undo stroke button
    if (this.controller.elements["undo-stroke-btn"]) {
      const undoHandler = () => {
        if (this.controller.strokesCanvas) {
          this.controller.strokesCanvas.undoLastStroke();
          logDebug("Last stroke undone via UI button");
        } else {
          logWarn("Strokes canvas not initialised for undo operation");
        }
      };

      this.controller.elements["undo-stroke-btn"].addEventListener(
        "click",
        undoHandler
      );
      this.trackEventListener(
        this.controller.elements["undo-stroke-btn"],
        "click",
        undoHandler
      );
    }

    // Submit strokes button
    if (this.controller.elements["submit-strokes-btn"]) {
      const submitHandler = async () => {
        if (this.controller.handleStrokesSubmit) {
          await this.controller.handleStrokesSubmit();
          logDebug("Strokes submitted via UI button");
        } else {
          logError("Controller handleStrokesSubmit method not available");
          this.showNotification("Strokes submission not available", "error");
        }
      };

      this.controller.elements["submit-strokes-btn"].addEventListener(
        "click",
        submitHandler
      );
      this.trackEventListener(
        this.controller.elements["submit-strokes-btn"],
        "click",
        submitHandler
      );
    }

    // Mode switcher radio buttons
    if (this.controller.elements["upload-mode-radio"]) {
      const uploadModeHandler = () => {
        // ✅ PHASE 3.2: Clear debug panel when switching modes
        if (this.controller.clearDebugPanel) {
          this.controller.clearDebugPanel();
        }

        if (this.controller.modeSwitcher) {
          this.controller.modeSwitcher.switchToUploadMode();
          logDebug("Switched to upload mode via UI");
        }
      };

      this.controller.elements["upload-mode-radio"].addEventListener(
        "change",
        uploadModeHandler
      );
      this.trackEventListener(
        this.controller.elements["upload-mode-radio"],
        "change",
        uploadModeHandler
      );
    }

    if (this.controller.elements["draw-mode-radio"]) {
      const drawModeHandler = async () => {
        // ✅ PHASE 3.2: Clear debug panel when switching modes
        if (this.controller.clearDebugPanel) {
          this.controller.clearDebugPanel();
        }

        // Initialize strokes system FIRST if needed (creates modeSwitcher)
        if (
          !this.controller.strokesCanvas &&
          this.controller.initStrokesSystem
        ) {
          try {
            await this.controller.initStrokesSystem();
            logDebug(
              "Strokes system initialised on first draw mode activation"
            );
          } catch (err) {
            logError("Failed to initialise strokes system:", err);
            this.showNotification(
              "Failed to initialise drawing canvas",
              "error"
            );
            return; // Don't continue if initialization failed
          }
        }

        // NOW switch to draw mode (modeSwitcher exists now)
        if (this.controller.modeSwitcher) {
          this.controller.modeSwitcher.switchToDrawMode();
          logDebug("Switched to draw mode via UI");
        } else {
          logError("Mode switcher not available after initialization");
          this.showNotification("Drawing mode unavailable", "error");
        }
      };

      this.controller.elements["draw-mode-radio"].addEventListener(
        "change",
        drawModeHandler
      );
      this.trackEventListener(
        this.controller.elements["draw-mode-radio"],
        "change",
        drawModeHandler
      );
    }

    // Phase 1D: Camera mode radio button handler
    if (this.controller.elements["camera-mode-radio"]) {
      const cameraModeHandler = async () => {
        // Clear debug panel when switching modes
        if (this.controller.clearDebugPanel) {
          this.controller.clearDebugPanel();
        }

        // Initialize camera system FIRST if needed (creates modeSwitcher)
        if (
          !this.controller.cameraCapture &&
          this.controller.initCameraSystem
        ) {
          try {
            await this.controller.initCameraSystem();
            logDebug(
              "Camera system initialised on first camera mode activation"
            );
          } catch (err) {
            logError("Failed to initialise camera system:", err);
            this.showNotification(
              "Failed to initialise camera system",
              "error"
            );
            return; // Don't continue if initialization failed
          }
        }

        // NOW switch to camera mode (modeSwitcher exists now)
        if (this.controller.modeSwitcher) {
          this.controller.modeSwitcher.switchToCameraMode();
          logDebug("Switched to camera mode via UI");
        } else {
          logError("Mode switcher not available after initialization");
          this.showNotification("Camera mode unavailable", "error");
        }
      };

      this.controller.elements["camera-mode-radio"].addEventListener(
        "change",
        cameraModeHandler
      );
      this.trackEventListener(
        this.controller.elements["camera-mode-radio"],
        "change",
        cameraModeHandler
      );
    }

    // Phase 6.3: Convert mode radio button handler
    if (this.controller.elements["convert-mode-radio"]) {
      const convertModeHandler = () => {
        // Clear debug panel when switching modes
        if (this.controller.clearDebugPanel) {
          this.controller.clearDebugPanel();
        }

        // Switch to convert mode via mode switcher
        if (this.controller.modeSwitcher) {
          this.controller.modeSwitcher.switchToConvertMode();
          logDebug("Switched to convert mode via UI");
        } else {
          logWarn(
            "Mode switcher not available, using direct convert mode activation"
          );
          // Fallback: activate convert mode directly
          const convertMode = window.getMathPixConvertMode?.();
          if (convertMode) {
            convertMode.init();
            convertMode.show();
            logDebug("Convert mode activated directly (fallback)");
          } else {
            logError("Convert mode controller not available");
            this.showNotification("Convert mode unavailable", "error");
          }
        }
      };

      this.controller.elements["convert-mode-radio"].addEventListener(
        "change",
        convertModeHandler
      );
      this.trackEventListener(
        this.controller.elements["convert-mode-radio"],
        "change",
        convertModeHandler
      );
    }

    // Phase 8.2: Resume mode radio button
    if (this.controller.elements["resume-mode-radio"]) {
      const resumeModeHandler = () => {
        // Clear debug panel when switching modes
        if (this.controller.clearDebugPanel) {
          this.controller.clearDebugPanel();
        }

        // Switch to resume mode via mode switcher
        if (this.controller.modeSwitcher) {
          this.controller.modeSwitcher.switchToResumeMode();
          logDebug("Switched to resume mode via UI");
        } else {
          logWarn(
            "Mode switcher not available, using direct resume mode activation"
          );
          // Fallback: activate session restorer directly
          const restorer = window.getMathPixSessionRestorer?.();
          if (restorer) {
            restorer.show();
            logDebug("Resume mode activated directly (fallback)");
          } else {
            logError("Session restorer not available");
            this.showNotification("Resume mode unavailable", "error");
          }
        }
      };

      this.controller.elements["resume-mode-radio"].addEventListener(
        "change",
        resumeModeHandler
      );
      this.trackEventListener(
        this.controller.elements["resume-mode-radio"],
        "change",
        resumeModeHandler
      );
    }

    logDebug("Canvas control handlers attached", {
      clearBtn: !!this.controller.elements["clear-canvas-btn"],
      undoBtn: !!this.controller.elements["undo-stroke-btn"],
      submitBtn: !!this.controller.elements["submit-strokes-btn"],
      uploadRadio: !!this.controller.elements["upload-mode-radio"],
      drawRadio: !!this.controller.elements["draw-mode-radio"],
      cameraRadio: !!this.controller.elements["camera-mode-radio"],
      convertRadio: !!this.controller.elements["convert-mode-radio"],
      resumeRadio: !!this.controller.elements["resume-mode-radio"],
    });
  }

  /**
   * @method attachCanvasSizeButtonListeners
   * @description
   * Attaches event listeners for canvas size control buttons (Small, Medium, Large, Extra Large).
   * Delegates resize operations to the strokes canvas instance via the controller.
   * Phase 2A: Canvas resize system integration.
   * Phase 2B.1: Enhanced with "Fit to Width" intelligent sizing support.
   * Phase 2B.2: Enhanced with "Fit to Viewport" maximum space utilisation.
   *
   * @returns {void}
   * @private
   *
   * @accessibility
   * - All buttons have visible text labels with size dimensions
   * - Keyboard accessible via native button elements
   * - Active state communicated via aria-pressed attribute
   * - User feedback via notification system
   * @since Phase 2A
   * @updated Phase 2B.1 - Added fit-to-width functionality
   * @updated Phase 2B.2 - Added fit-to-viewport functionality
   */
  attachCanvasSizeButtonListeners() {
    const sizeButtons = document.querySelectorAll(".mathpix-size-btn");

    if (sizeButtons.length === 0) {
      logWarn("No canvas size buttons found - size controls not in DOM");
      return;
    }

    sizeButtons.forEach((button) => {
      const sizeHandler = () => {
        const size = button.dataset.size;

        // Skip if this is the custom size button (handled separately)
        if (button.id === "mathpix-custom-size-btn") {
          return;
        }

        // Handle fit-to-width button (Phase 2B.1)
        if (button.id === "mathpix-fit-to-width-btn") {
          if (!this.controller.strokesCanvas) {
            this.showNotification("Canvas not initialised", "error");
            logError("Attempted fit-to-width but canvas not initialised");
            return;
          }

          logDebug("Fit to width button clicked - calling fitToWidth()");

          const success = this.controller.strokesCanvas.fitToWidth();

          if (success) {
            this.showNotification(
              "Canvas fitted to available width",
              "success"
            );
            logDebug("Canvas successfully fitted to width via UI button");
          } else {
            this.showNotification(
              "Fit to width not needed - already optimal",
              "info"
            );
            logDebug("Fit to width skipped - canvas already near-optimal size");
          }

          return;
        }

        // Handle fit-to-viewport button (Phase 2B.2)
        if (button.id === "mathpix-fit-to-viewport-btn") {
          if (!this.controller.strokesCanvas) {
            this.showNotification("Canvas not initialised", "error");
            logError("Attempted fit-to-viewport but canvas not initialised");
            return;
          }

          logDebug("Fit to viewport button clicked - calling fitToViewport()");

          const success = this.controller.strokesCanvas.fitToViewport();

          if (success) {
            this.showNotification(
              "Canvas fitted to maximum viewport space",
              "success"
            );
            logDebug("Canvas successfully fitted to viewport via UI button");
          } else {
            this.showNotification(
              "Fit to viewport not needed - already maximised",
              "info"
            );
            logDebug(
              "Fit to viewport skipped - canvas already near-optimal size"
            );
          }

          return;
        }

        // Handle preset size buttons (small, medium, large, xlarge)
        if (!this.controller.strokesCanvas) {
          this.showNotification("Canvas not initialised", "error");
          logError("Attempted resize but canvas not initialised");
          return;
        }

        const success = this.controller.strokesCanvas.resizeCanvas(size, true);

        if (success) {
          this.showNotification(`Canvas resized to ${size}`, "success");
          logDebug(`Canvas resized to ${size} via UI button`);
        } else {
          this.showNotification("Failed to resize canvas", "error");
          logError(`Canvas resize to ${size} failed`);
        }
      };

      button.addEventListener("click", sizeHandler);
      this.trackEventListener(button, "click", sizeHandler);
    });

    logDebug(
      `Canvas size button listeners attached: ${sizeButtons.length} buttons (including fit buttons)`
    );
  }

  /**
   * @method attachCustomSizeHandler
   * @description
   * Attaches custom size dialog handler using UniversalModal system.
   * Provides form-based custom dimensions input with validation (300-2000px × 200-1500px).
   * Preserves existing strokes during resize via coordinate scaling.
   * Phase 2A: Custom canvas sizing integration.
   *
   * @returns {void}
   * @private
   *
   * @accessibility
   * - Modal dialog with proper ARIA semantics via UniversalModal
   * - Keyboard accessible form inputs with validation
   * - Clear user feedback via notification system
   * - Focus management handled by UniversalModal
   * @since Phase 2A
   */
  attachCustomSizeHandler() {
    const customBtn = document.getElementById("mathpix-custom-size-btn");

    if (!customBtn) {
      logWarn("Custom size button not found");
      return;
    }

    const customHandler = async () => {
      if (!this.controller.strokesCanvas) {
        this.showNotification("Canvas not initialised", "error");
        return;
      }

      // Get current dimensions to pre-fill form
      const current = this.controller.strokesCanvas.getCurrentDimensions();

      // Variable to store captured dimensions
      let capturedWidth = null;
      let capturedHeight = null;

      // Create form HTML
      const formHTML = `
        <form id="mathpix-custom-size-form" class="mathpix-custom-size-form" onsubmit="return false;">
          <label>
            <span>Width (pixels):</span>
            <input type="number" id="custom-width" name="width" min="300" max="2000" step="50" value="${current.width}" required>
          </label>
          <br>
          <label>
            <span>Height (pixels):</span>
            <input type="number" id="custom-height" name="height" min="200" max="1500" step="50" value="${current.height}" required>
          </label>
          
          <div class="mathpix-custom-size-hint">
            <strong>Recommended:</strong> Keep a 2:1 aspect ratio (e.g., 800×400, 1000×500)
          </div>
        </form>
      `;

      // Show modal (non-blocking, shows immediately)
      const modalPromise = UniversalModal.custom(formHTML, {
        title: "Custom Canvas Size",
        size: "small",
        buttons: [
          { text: "Cancel", type: "secondary", action: "cancel" },
          { text: "Apply Size", type: "primary", action: "confirm" },
        ],
      });

      // Wait a moment for modal to render, then attach event listener
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Attach input change listeners to capture values in real-time
      const widthInput = document.getElementById("custom-width");
      const heightInput = document.getElementById("custom-height");

      if (widthInput && heightInput) {
        const captureValues = () => {
          capturedWidth = parseInt(widthInput.value);
          capturedHeight = parseInt(heightInput.value);
          logDebug(`Values captured: ${capturedWidth}×${capturedHeight}`);
        };

        // Capture initial values
        captureValues();

        // Update captured values when user changes inputs
        widthInput.addEventListener("input", captureValues);
        heightInput.addEventListener("input", captureValues);

        logDebug("Input listeners attached, initial values captured");
      } else {
        logError(
          "Could not find custom size input elements after modal render"
        );
      }

      // Wait for user to confirm or cancel
      const result = await modalPromise;

      logDebug(`Modal result: ${result} (type: ${typeof result})`);

      // UniversalModal returns true for confirm, false/null for cancel
      if (result === true && capturedWidth && capturedHeight) {
        // Validate dimensions
        if (
          capturedWidth < 300 ||
          capturedWidth > 2000 ||
          capturedHeight < 200 ||
          capturedHeight > 1500
        ) {
          this.showNotification(
            "Size out of valid range (300-2000 × 200-1500)",
            "error"
          );
          logWarn(
            `Invalid custom size attempted: ${capturedWidth}×${capturedHeight}`
          );
          return;
        }

        // Apply custom size via strokes canvas
        const canvas = document.getElementById("mathpix-draw-canvas");
        if (!canvas) {
          logError("Canvas element not found");
          this.showNotification("Canvas not found", "error");
          return;
        }

        const oldWidth = canvas.width;
        const oldHeight = canvas.height;

        logDebug(
          `Applying custom size: ${oldWidth}×${oldHeight} → ${capturedWidth}×${capturedHeight}`
        );

        const scaleX = capturedWidth / oldWidth;
        const scaleY = capturedHeight / oldHeight;

        // Scale strokes if any exist
        if (this.controller.strokesCanvas.strokes.length > 0) {
          this.controller.strokesCanvas.scaleStrokes(scaleX, scaleY);
          logDebug(
            `Scaled ${this.controller.strokesCanvas.strokes.length} strokes`
          );
        }

        // Apply new canvas dimensions
        canvas.width = capturedWidth;
        canvas.height = capturedHeight;

        // Reconfigure drawing style and redraw
        this.controller.strokesCanvas.configureDrawingStyle();
        if (this.controller.strokesCanvas.strokes.length > 0) {
          this.controller.strokesCanvas.redrawAllStrokes();
        }

        // Clear active state from preset size buttons
        document.querySelectorAll(".mathpix-size-btn").forEach((btn) => {
          btn.classList.remove("active");
          btn.setAttribute("aria-pressed", "false");
        });

        this.showNotification(
          `Canvas resized to ${capturedWidth}×${capturedHeight}`,
          "success"
        );
        logInfo(
          `Custom canvas size applied: ${capturedWidth}×${capturedHeight}`
        );
      } else if (result === true) {
        // User clicked confirm but dimensions weren't captured
        logError("Custom size confirmed but dimensions not captured");
        this.showNotification("Failed to apply custom size", "error");
      } else {
        logDebug("Custom size dialog cancelled by user");
      }
    };

    customBtn.addEventListener("click", customHandler);
    this.trackEventListener(customBtn, "click", customHandler);

    logDebug("Custom size dialog handler attached");
  }

  /**
   * @method attachFullscreenHandler
   * @description
   * Attaches fullscreen modal functionality to processed output with comprehensive
   * accessibility features including focus trapping, keyboard navigation, and
   * proper ARIA semantics.
   *
   * @returns {void}
   * @private
   *
   * @accessibility
   * - Focus trapping prevents Tab from leaving modal
   * - Focus returns to trigger button on close
   * - Escape key closes modal
   * - Background scroll prevention
   * - ARIA dialog semantics
   * - Inert background content
   * @wcag WCAG 2.2 AA compliant
   * @since 1.0.0
   */
  attachFullscreenHandler() {
    const btn = document.getElementById("mathpix-fullscreen-btn");
    const output = document.getElementById("mathpix-rendered-output");

    if (!btn || !output) {
      logWarn("Fullscreen button or output container not found");
      return;
    }

    const fullscreenHandler = () => {
      if (!output.innerHTML.trim()) {
        this.showNotification("No mathematical content to display", "warning");
        return;
      }

      // Store original focus and scroll position
      const originalFocus = document.activeElement;
      const originalScrollPos =
        window.pageYOffset || document.documentElement.scrollTop;

      // Prevent background scrolling
      const originalBodyOverflow = document.body.style.overflow;
      const originalBodyPosition = document.body.style.position;
      const originalBodyTop = document.body.style.top;
      const originalBodyWidth = document.body.style.width;

      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${originalScrollPos}px`;
      document.body.style.width = "100%";

      // Make background inert
      const mainElements = document.querySelectorAll(
        "body > *:not(script):not(style)"
      );
      mainElements.forEach((el) => el.setAttribute("inert", ""));

      // Create modal with proper ARIA attributes
      const modalId = `mathpix-fullscreen-${Date.now()}`;
      const modal = document.createElement("div");
      modal.id = modalId;
      modal.className = "mathpix-fullscreen-modal active";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-labelledby", `${modalId}-title`);
      modal.setAttribute("tabindex", "-1");

      modal.innerHTML = `
      <div class="mathpix-fullscreen-backdrop"></div>
      <div class="mathpix-fullscreen-container">
        <div class="mathpix-fullscreen-header">
          <h2 id="${modalId}-title" class="mathpix-fullscreen-title">Mathematical Content - Full Screen</h2>
          <button type="button" class="mathpix-fullscreen-close" aria-label="Close full screen view">
            <svg height="21" viewBox="0 0 21 21" width="21" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(5 5)"><path d="m10.5 10.5-10-10z"/><path d="m10.5.5-10 10"/></g></svg>
          </button>
        </div>
        <div class="mathpix-fullscreen-content">
          ${output.innerHTML}
        </div>
      </div>
    `;

      document.body.appendChild(modal);

      // Remove inert from modal itself
      modal.removeAttribute("inert");

      // Focus management
      const closeBtn = modal.querySelector(".mathpix-fullscreen-close");
      const container = modal.querySelector(".mathpix-fullscreen-container");

      // Get all focusable elements for focus trapping
      const getFocusableElements = () => {
        return modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
      };

      // Focus trap implementation
      const trapFocus = (e) => {
        if (e.key !== "Tab") return;

        const focusableElements = getFocusableElements();
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      };

      // Close modal function
      const closeModal = () => {
        // Remove event listeners
        modal.removeEventListener("keydown", trapFocus);
        document.removeEventListener("keydown", escapeHandler);
        closeBtn.removeEventListener("click", closeModal);
        backdrop.removeEventListener("click", closeModal);

        // Restore background
        document.body.style.overflow = originalBodyOverflow;
        document.body.style.position = originalBodyPosition;
        document.body.style.top = originalBodyTop;
        document.body.style.width = originalBodyWidth;

        // Restore scroll position
        window.scrollTo(0, originalScrollPos);

        // Remove inert from background elements
        mainElements.forEach((el) => el.removeAttribute("inert"));

        // Remove modal
        modal.remove();

        // Return focus to trigger button
        if (originalFocus && originalFocus.focus) {
          originalFocus.focus();
        }

        logDebug("Fullscreen modal closed with focus restored");
      };

      // Escape key handler
      const escapeHandler = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          closeModal();
        }
      };

      // Backdrop reference
      const backdrop = modal.querySelector(".mathpix-fullscreen-backdrop");

      // Attach event listeners
      modal.addEventListener("keydown", trapFocus);
      document.addEventListener("keydown", escapeHandler);
      closeBtn.addEventListener("click", closeModal);
      backdrop.addEventListener("click", closeModal);

      // Focus the close button
      requestAnimationFrame(() => {
        closeBtn.focus();
        logDebug("Fullscreen modal opened with focus management");
      });
    };

    btn.addEventListener("click", fullscreenHandler);
    this.trackEventListener(btn, "click", fullscreenHandler);

    logDebug("Accessible fullscreen handler attached");
  }

  // PDF view mode handlers removed (feature deprecated)
  // Methods preserved for reference but not called
  // attachViewModeHandlers() and handleViewModeChange() removed

  /**
   * @method trackEventListener
   * @description
   * Tracks event listeners for automatic cleanup during module destruction.
   * Maintains references to DOM elements, event types, and handler functions
   * to enable proper memory management and prevent listener leaks.
   *
   * @param {HTMLElement} element - DOM element with the attached listener
   * @param {string} event - Event type (e.g., 'click', 'change', 'keydown')
   * @param {Function} handler - Event handler function reference
   *
   * @returns {void}
   * @private
   *
   * @example
   * const handler = (e) => console.log('clicked');
   * element.addEventListener('click', handler);
   * this.trackEventListener(element, 'click', handler);
   *
   * @since 1.0.0
   */
  trackEventListener(element, event, handler) {
    this.eventListeners.push({
      element: element,
      event: event,
      handler: handler,
    });
  }

  /**
   * @method loadStoredConfig
   * @description
   * Loads MathPix API configuration from localStorage if available.
   * Attempts to restore API credentials and automatically configure the API client.
   * Updates UI elements and internal state to reflect loaded configuration.
   *
   * @returns {boolean} True if configuration was successfully loaded and applied
   *
   * @example
   * const loaded = uiManager.loadStoredConfig();
   * if (loaded) {
   *   console.log('API credentials restored from localStorage');
   * }
   *
   * @security
   * Note: localStorage is used for development convenience. Production deployments
   * should consider more secure credential storage mechanisms.
   * @since 1.0.0
   */
  loadStoredConfig() {
    const appId = localStorage.getItem("mathpix-app-id");
    const appKey = localStorage.getItem("mathpix-app-key");

    if (
      appId &&
      appKey &&
      this.controller.elements["app-id"] &&
      this.controller.elements["app-key"]
    ) {
      this.controller.elements["app-id"].value = appId;
      this.controller.elements["app-key"].value = appKey;
      this.controller.apiClient.setCredentials(appId, appKey);
      this.configLoaded = true;
      logDebug("Stored configuration loaded");
      return true;
    }

    this.configLoaded = false;
    return false;
  }

  /**
   * @method saveConfiguration
   * @description
   * Validates and saves MathPix API configuration to localStorage and API client.
   * Performs input validation, updates API client credentials, persists to localStorage,
   * and provides user feedback through the notification system.
   *
   * @returns {void}
   * @throws {Error} Shows user notification for validation errors
   *
   * @example
   * // User enters credentials in UI, then:
   * uiManager.saveConfiguration();
   * // Credentials are validated, saved, and user receives feedback
   *
   * @accessibility Provides screen reader compatible success/error feedback
   * @since 1.0.0
   */
  saveConfiguration() {
    const appId = this.controller.elements["app-id"]?.value;
    const appKey = this.controller.elements["app-key"]?.value;

    if (!appId || !appKey) {
      this.showNotification("Please enter both App ID and App Key", "error");
      return;
    }

    // Configure API client with validated credentials
    this.controller.apiClient.setCredentials(appId, appKey);

    // Persist to localStorage for development convenience
    localStorage.setItem("mathpix-app-id", appId);
    localStorage.setItem("mathpix-app-key", appKey);

    this.configLoaded = true;
    this.showNotification("Configuration saved successfully", "success");
    logInfo("API configuration saved");
  }

  /**
   * @method showNotification
   * @description
   * Displays user notifications through the integrated notification system.
   * Provides a consistent interface for user feedback with automatic fallback
   * to console logging if notification system is unavailable.
   *
   * @param {string} message - Notification message content
   * @param {string} [type='info'] - Notification type: 'success', 'error', 'warning', 'info'
   *
   * @returns {void}
   *
   * @example
   * uiManager.showNotification('File uploaded successfully', 'success');
   * uiManager.showNotification('Invalid file format', 'error');
   *
   * @accessibility
   * Integrates with WCAG-compliant notification system that supports:
   * - Screen reader announcements via ARIA live regions
   * - Keyboard-accessible dismissal
   * - High contrast mode compatibility
   * @since 1.0.0
   */
  showNotification(message, type = "info") {
    // Use existing notification system with graceful fallback
    if (window.notifySuccess && type === "success") {
      window.notifySuccess(message);
    } else if (window.notifyError && type === "error") {
      window.notifyError(message);
    } else if (window.notifyInfo) {
      window.notifyInfo(message);
    } else {
      // Fallback to console logging
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * @method isConfigurationLoaded
   * @description
   * Returns the current configuration state for the MathPix API credentials.
   * Useful for conditional logic and UI state management.
   *
   * @returns {boolean} True if API credentials are loaded and configured
   *
   * @example
   * if (uiManager.isConfigurationLoaded()) {
   *   // Proceed with API operations
   * } else {
   *   // Show configuration prompts
   * }
   *
   * @since 1.0.0
   */
  isConfigurationLoaded() {
    return this.configLoaded;
  }

  /**
   * @method getUIState
   * @description
   * Returns comprehensive information about the current UI state.
   * Useful for debugging, state validation, and conditional rendering.
   * Provides metrics about cached elements, event listeners, and configuration status.
   *
   * @returns {Object} Current UI state information
   * @returns {boolean} returns.configLoaded - Configuration loading state
   * @returns {number} returns.elementsCache - Number of cached DOM elements
   * @returns {number} returns.eventListeners - Number of tracked event listeners
   * @returns {number} returns.formatRadioButtons - Number of format radio buttons
   * @returns {boolean} returns.hasFileInput - File input element availability
   * @returns {boolean} returns.hasDropZone - Drop zone element availability
   * @returns {boolean} returns.hasConfigElements - Configuration UI availability
   *
   * @example
   * const state = uiManager.getUIState();
   * console.log(`UI ready: ${state.configLoaded && state.hasFileInput}`);
   *
   * @since 1.0.0
   */
  getUIState() {
    return {
      configLoaded: this.configLoaded,
      elementsCache: Object.keys(this.controller.elements).length,
      eventListeners: this.eventListeners.length,
      formatTabButtons: this.controller.elements.formatTabs?.length || 0,
      hasFileInput: !!this.controller.elements["file-input"],
      hasDropZone: !!this.controller.elements["drop-zone"],
      hasConfigElements: !!(
        this.controller.elements["app-id"] &&
        this.controller.elements["app-key"]
      ),
    };
  }

  /**
   * @method loadUserPreferences
   * @description
   * Loads user preferences from localStorage for MathPix Text API processing options.
   * Returns defaults if localStorage is unavailable or contains invalid data.
   * Phase 2: User-configurable processing options for image processing.
   *
   * @returns {Object} User preferences object
   * @returns {boolean} returns.equationNumbering - Include equation tags
   * @returns {string} returns.delimiterFormat - Delimiter format ('latex' or 'markdown')
   * @returns {boolean} returns.includePageInfo - Include page headers/numbers
   *
   * @example
   * const prefs = uiManager.loadUserPreferences();
   * console.log('Delimiter format:', prefs.delimiterFormat);
   *
   * @since Phase 2
   */
  loadUserPreferences() {
    const defaults = {
      // Existing Text API preferences
      equationNumbering: true,
      delimiterFormat: "latex",
      includePageInfo: false, // Changed to false - most users don't want page artifacts

      // NEW: Processing options (shared by both Text and Strokes APIs)
      rmSpaces: true,
      rmFonts: false,
      idiomaticEqnArrays: false,
      idiomaticBraces: false,

      // NEW: Advanced options (for future use)
      confidenceThreshold: null, // null = use API default
      includeLineData: false,
    };

    try {
      const stored = {
        // Existing preferences
        equationNumbering: localStorage.getItem("mathpix-equation-numbering"),
        delimiterFormat: localStorage.getItem("mathpix-delimiter-format"),
        includePageInfo: localStorage.getItem("mathpix-page-info"),

        // Processing options
        rmSpaces: localStorage.getItem("mathpix-rm-spaces"),
        rmFonts: localStorage.getItem("mathpix-rm-fonts"),
        idiomaticEqnArrays: localStorage.getItem(
          "mathpix-idiomatic-eqn-arrays"
        ),
        idiomaticBraces: localStorage.getItem("mathpix-idiomatic-braces"),

        // Advanced options
        confidenceThreshold: localStorage.getItem(
          "mathpix-confidence-threshold"
        ),
        confidenceRateThreshold: localStorage.getItem(
          "mathpix-confidence-rate-threshold"
        ),
        includeLineData: localStorage.getItem("mathpix-include-line-data"),
        includeWordData: localStorage.getItem("mathpix-include-word-data"),
      };

      return {
        // Existing preferences
        equationNumbering: stored.equationNumbering !== "false", // Default true
        delimiterFormat: stored.delimiterFormat || "latex",
        includePageInfo: stored.includePageInfo === "true", // Default false

        // Processing options - sensible defaults
        rmSpaces: stored.rmSpaces !== "false", // Default true
        rmFonts: stored.rmFonts === "true", // Default false
        idiomaticEqnArrays: stored.idiomaticEqnArrays === "true", // Default false
        idiomaticBraces: stored.idiomaticBraces === "true", // Default false

        // Advanced options
        confidenceThreshold: stored.confidenceThreshold
          ? parseFloat(stored.confidenceThreshold)
          : null,
        confidenceRateThreshold: stored.confidenceRateThreshold
          ? parseFloat(stored.confidenceRateThreshold)
          : null,
        includeLineData: stored.includeLineData === "true",
        includeWordData: stored.includeWordData === "true",
      };
    } catch (e) {
      logWarn("[MathPix UI] Failed to load preferences from localStorage:", e);
      return defaults;
    }
  }

  /**
   * @method applyPreferencesToUI
   * @description
   * Applies loaded preferences to UI controls. Updates checkboxes and radio buttons
   * to reflect saved user preferences.
   *
   * @param {Object} prefs - User preferences object
   * @returns {void}
   *
   * @example
   * const prefs = uiManager.loadUserPreferences();
   * uiManager.applyPreferencesToUI(prefs);
   *
   * @since Phase 2
   */
  applyPreferencesToUI(prefs) {
    if (!this.controller.elements.processingOptions) {
      logWarn(
        "[MathPix UI] Processing options not available, skipping preference application"
      );
      return;
    }

    try {
      this.controller.elements.equationNumberingCheckbox.checked =
        prefs.equationNumbering;
      this.controller.elements.pageInfoCheckbox.checked = prefs.includePageInfo;

      // Set delimiter radio buttons
      this.controller.elements.delimiterRadios.forEach((radio) => {
        radio.checked = radio.value === prefs.delimiterFormat;
      });

      logDebug("[MathPix UI] Preferences applied to UI:", prefs);
    } catch (e) {
      logError("[MathPix UI] Failed to apply preferences to UI:", e);
    }
  }

  /**
   * @method getCurrentPreferences
   * @description
   * Gets current preferences from UI controls. Reads checkbox and radio button states
   * to determine user's current selections.
   *
   * @returns {Object} Current user preferences
   *
   * @example
   * const current = uiManager.getCurrentPreferences();
   * console.log('Current delimiter format:', current.delimiterFormat);
   *
   * @since Phase 2
   */
  getCurrentPreferences() {
    // If UI elements not available yet, return stored preferences
    if (!this.controller.elements.processingOptions) {
      logDebug(
        "[MathPix UI] Processing options UI not available, returning stored preferences"
      );
      return this.loadUserPreferences();
    }

    try {
      // Get delimiter format from radio buttons
      const delimiterRadio = [...this.controller.elements.delimiterRadios].find(
        (r) => r.checked
      );

      // Build preferences object from UI elements (with fallbacks)
      const prefs = {
        // Existing preferences
        equationNumbering:
          this.controller.elements.equationNumberingCheckbox?.checked ?? true,
        delimiterFormat: delimiterRadio ? delimiterRadio.value : "latex",
        includePageInfo:
          this.controller.elements.pageInfoCheckbox?.checked ?? false,
      };

      // Processing option checkboxes (may not exist yet)
      const rmSpacesCheckbox = document.getElementById("mathpix-rm-spaces");
      const rmFontsCheckbox = document.getElementById("mathpix-rm-fonts");
      const idiomaticArraysCheckbox = document.getElementById(
        "mathpix-idiomatic-eqn-arrays"
      );
      const idiomaticBracesCheckbox = document.getElementById(
        "mathpix-idiomatic-braces"
      );

      prefs.rmSpaces =
        rmSpacesCheckbox?.checked ??
        localStorage.getItem("mathpix-rm-spaces") !== "false";
      prefs.rmFonts =
        rmFontsCheckbox?.checked ??
        localStorage.getItem("mathpix-rm-fonts") === "true";
      prefs.idiomaticEqnArrays =
        idiomaticArraysCheckbox?.checked ??
        localStorage.getItem("mathpix-idiomatic-eqn-arrays") === "true";
      prefs.idiomaticBraces =
        idiomaticBracesCheckbox?.checked ??
        localStorage.getItem("mathpix-idiomatic-braces") === "true";

      // Advanced options (may not exist yet)
      const confidenceThresholdInput = document.getElementById(
        "mathpix-confidence-threshold"
      );
      const includeLineDataCheckbox = document.getElementById(
        "mathpix-include-line-data"
      );

      if (confidenceThresholdInput?.value) {
        prefs.confidenceThreshold = parseFloat(confidenceThresholdInput.value);
      } else {
        prefs.confidenceThreshold = null;
      }

      prefs.includeLineData = includeLineDataCheckbox?.checked ?? false;

      return prefs;
    } catch (e) {
      logError(
        "[MathPix UI] Failed to get current preferences, using stored:",
        e
      );
      return this.loadUserPreferences();
    }
  }
  /**
   * @method saveUserPreferences
   * @description
   * Saves current preferences to localStorage for persistence across sessions.
   * Called automatically when user changes any processing option.
   *
   * @returns {void}
   *
   * @example
   * uiManager.saveUserPreferences();
   *
   * @since Phase 2
   */
  saveUserPreferences() {
    const prefs = this.getCurrentPreferences();

    try {
      // Existing preferences
      localStorage.setItem(
        "mathpix-equation-numbering",
        prefs.equationNumbering
      );
      localStorage.setItem("mathpix-delimiter-format", prefs.delimiterFormat);
      localStorage.setItem("mathpix-page-info", prefs.includePageInfo);

      // Processing options
      localStorage.setItem("mathpix-rm-spaces", prefs.rmSpaces);
      localStorage.setItem("mathpix-rm-fonts", prefs.rmFonts);
      localStorage.setItem(
        "mathpix-idiomatic-eqn-arrays",
        prefs.idiomaticEqnArrays
      );
      localStorage.setItem("mathpix-idiomatic-braces", prefs.idiomaticBraces);

      // Advanced options (only save if not null)
      if (prefs.confidenceThreshold !== null) {
        localStorage.setItem(
          "mathpix-confidence-threshold",
          prefs.confidenceThreshold
        );
      } else {
        localStorage.removeItem("mathpix-confidence-threshold");
      }

      if (prefs.confidenceRateThreshold !== null) {
        localStorage.setItem(
          "mathpix-confidence-rate-threshold",
          prefs.confidenceRateThreshold
        );
      } else {
        localStorage.removeItem("mathpix-confidence-rate-threshold");
      }

      localStorage.setItem("mathpix-include-line-data", prefs.includeLineData);
      localStorage.setItem(
        "mathpix-include-word-data",
        prefs.includeWordData || false
      );

      logDebug("[MathPix UI] Enhanced preferences saved:", prefs);
    } catch (e) {
      logWarn("[MathPix UI] Failed to save preferences to localStorage:", e);
    }
  }

  /**
   * @method showProcessingOptions
   * @description
   * Shows the processing options panel and loads saved preferences.
   * Called when image preview is displayed. Attaches event listeners for auto-save.
   *
   * @returns {void}
   *
   * @example
   * uiManager.showProcessingOptions();
   *
   * @since Phase 2
   */
  showProcessingOptions() {
    if (!this.controller.elements.processingOptions) {
      logWarn("[MathPix UI] Processing options element not found");
      return;
    }

    try {
      // Show the panel
      this.controller.elements.processingOptions.style.display = "block";

      // Load and apply saved preferences
      const prefs = this.loadUserPreferences();
      this.applyPreferencesToUI(prefs);

      // Attach event listeners for auto-save (only once)
      this.attachPreferenceListeners();

      logInfo("[MathPix UI] Processing options shown with preferences:", prefs);
    } catch (e) {
      logError("[MathPix UI] Failed to show processing options:", e);
    }
  }

  /**
   * @method hideProcessingOptions
   * @description
   * Hides the processing options panel. Called when image preview is cleared.
   *
   * @returns {void}
   *
   * @example
   * uiManager.hideProcessingOptions();
   *
   * @since Phase 2
   */
  hideProcessingOptions() {
    if (this.controller.elements.processingOptions) {
      this.controller.elements.processingOptions.style.display = "none";
      logDebug("[MathPix UI] Processing options hidden");
    }
  }

  // =============================================================================
  // PHASE 2.0: REGIONAL ENDPOINT MANAGEMENT
  // =============================================================================

  /**
   * @method setupEndpointSelection
   * @description
   * Sets up event listeners for endpoint selection radio buttons.
   * Handles endpoint changes, GDPR warnings, and feature availability updates.
   * Phase 2.0: Regional endpoint selection integration.
   *
   * @returns {void}
   * @private
   *
   * @accessibility
   * - Native radio button keyboard navigation
   * - ARIA attributes for descriptions
   * - Clear visual feedback for selection
   * @since 2.0.0
   * @updated Phase 1 Step 6 - Added duplicate prevention
   */
  setupEndpointSelection() {
    // PHASE 1 STEP 6: Prevent duplicate listener attachment
    if (this._endpointListenersAttached) {
      logDebug("Endpoint listeners already attached, skipping duplicate setup");
      return;
    }

    const endpointRadios = this.controller.elements.endpointRadios;

    if (!endpointRadios || endpointRadios.length === 0) {
      logWarn("Endpoint selection radios not found in DOM");
      return;
    }

    endpointRadios.forEach((radio) => {
      const radioChangeHandler = (e) => {
        if (e.target.checked) {
          this.handleEndpointChange(e.target.value);
        }
      };

      radio.addEventListener("change", radioChangeHandler);
      this.trackEventListener(radio, "change", radioChangeHandler);
    });

    // Set initial state from localStorage or API client
    this.loadEndpointSelection();

    // PHASE 1 STEP 6: Mark as attached
    this._endpointListenersAttached = true;

    logDebug("Endpoint selection handlers attached", {
      radioCount: endpointRadios.length,
    });
  }

  /**
   * @method loadEndpointSelection
   * @description
   * Loads saved endpoint selection and updates radio button state.
   * Synchronizes UI with API client's current endpoint.
   *
   * @returns {void}
   * @private
   * @since 2.0.0
   */
  loadEndpointSelection() {
    try {
      const currentEndpoint = this.controller.apiClient?.currentEndpoint;
      if (!currentEndpoint) {
        logWarn("API client endpoint not available");
        return;
      }

      const radio = document.getElementById(
        `endpoint-${currentEndpoint.toLowerCase()}`
      );
      if (radio) {
        radio.checked = true;
        logDebug("Endpoint selection loaded", { endpoint: currentEndpoint });
      }

      // PHASE 1 STEP 6: Initialize status indicator with current endpoint
      this.updateStatusIndicator(currentEndpoint);
    } catch (error) {
      logWarn("Failed to load endpoint selection", error);
    }
  }

  /**
   * @method handleEndpointChange
   * @description
   * Handles endpoint change events with GDPR warning modal when appropriate.
   * Shows warning when switching from EU to non-EU endpoints.
   *
   * @param {string} newEndpoint - New endpoint key (US, EU, ASIA)
   *
   * @returns {void}
   * @private
   * @since 2.0.0
   */
  handleEndpointChange(newEndpoint) {
    const currentEndpoint = this.controller.apiClient?.currentEndpoint;

    logInfo("Endpoint change requested", {
      from: currentEndpoint,
      to: newEndpoint,
    });

    // Check if leaving EU endpoint (GDPR warning)
    const isLeavingEU = currentEndpoint === "EU" && newEndpoint !== "EU";

    // Import MATHPIX_CONFIG to check GDPR warning dismissed flag
    const hasSeenWarning = localStorage.getItem(
      "mathpix-gdpr-warning-dismissed"
    );

    if (isLeavingEU && !hasSeenWarning) {
      // Show GDPR warning modal
      this.showGDPRWarningModal(
        newEndpoint,
        () => {
          // User confirmed
          this.applyEndpointChange(newEndpoint);
        },
        () => {
          // User cancelled - revert selection
          this.revertEndpointSelection(currentEndpoint);
        }
      );
    } else {
      // No warning needed
      this.applyEndpointChange(newEndpoint);
    }
  }

  /**
   * @method applyEndpointChange
   * @description
   * Applies the endpoint change to API client and updates UI state.
   * Updates feature availability and provides user feedback.
   *
   * @param {string} endpoint - Endpoint key to switch to
   *
   * @returns {void}
   * @private
   * @since 2.0.0
   */
  applyEndpointChange(endpoint) {
    // Switch endpoint in API client
    const success = this.controller.apiClient.switchEndpoint(endpoint);

    if (success) {
      // Update feature availability UI
      this.updateFeatureAvailability(endpoint);

      // PHASE 1 STEP 6 FIX: Update PDF format availability if PDF options are visible
      const pdfOptions = document.getElementById("mathpix-pdf-options");
      if (
        pdfOptions &&
        pdfOptions.style.display !== "none" &&
        !pdfOptions.hidden
      ) {
        logDebug("PDF options visible - updating format availability");
        if (
          this.controller.pdfHandler &&
          this.controller.pdfHandler.updateFormatAvailability
        ) {
          this.controller.pdfHandler.updateFormatAvailability();
          logDebug("PDF format availability updated after endpoint change");
        }
      }

      // PHASE 1 STEP 6: Update status indicator
      this.updateStatusIndicator(endpoint);

      // Show success notification
      const config = this.controller.apiClient.getEndpointConfig();
      this.showNotification(
        `Switched to ${config.name} endpoint (${config.location})`,
        "success"
      );

      logInfo("Endpoint switched successfully", {
        endpoint,
        apiBase: this.controller.apiClient.apiBase,
      });
    } else {
      this.showNotification("Failed to switch endpoint", "error");
      logError("Endpoint switch failed", { endpoint });
    }
  }

  /**
   * @method revertEndpointSelection
   * @description
   * Reverts radio button selection to previous endpoint.
   * Called when user cancels GDPR warning modal.
   *
   * @param {string} endpoint - Endpoint to revert to
   *
   * @returns {void}
   * @private
   * @since 2.0.0
   */
  revertEndpointSelection(endpoint) {
    const radio = document.getElementById(`endpoint-${endpoint.toLowerCase()}`);
    if (radio) {
      radio.checked = true;
      logDebug("Endpoint selection reverted", { endpoint });
    }
  }

  /**
   * @method showGDPRWarningModal
   * @description
   * Displays GDPR compliance warning when leaving EU endpoint.
   * Uses UniversalModal system for accessible modal dialog.
   *
   * @param {string} targetEndpoint - Endpoint user is switching to
   * @param {Function} onConfirm - Callback when user confirms
   * @param {Function} onCancel - Callback when user cancels
   *
   * @returns {void}
   * @private
   *
   * @accessibility
   * - Full keyboard navigation via UniversalModal
   * - Screen reader compatible
   * - Focus management
   * @since 2.0.0
   */
  async showGDPRWarningModal(targetEndpoint, onConfirm, onCancel) {
    const endpointConfig = this.controller.apiClient.getEndpointConfig();
    const targetConfig = MATHPIX_CONFIG.ENDPOINTS[targetEndpoint];

    const modalContent = `
    <div class="mathpix-gdpr-warning">
      <p>
        You are switching from the <strong>EU endpoint</strong> to the 
        <strong>${targetConfig.name} endpoint</strong> (${
      targetConfig.location
    }).
      </p>
      <div class="warning-box">
        <p style="margin: 0 0 0.5rem 0;"><strong>${getIcon(
          "warning"
        )} Important:</strong></p>
        <p style="margin: 0;">
          Data processed on non-EU servers may not comply with GDPR requirements. 
          Your mathematical content will be processed in <strong>${
            targetConfig.dataLocality
          }</strong>.
        </p>
      </div>
      <ul style="list-style: none; padding: 0; margin: 1rem 0;">
        <li style="margin: 0.5rem 0;">${getIcon(
          "checkCircle"
        )} <strong>EU endpoint:</strong> GDPR-compliant, data processed in EU</li>
        <li style="margin: 0.5rem 0;">${getIcon("warning")} <strong>${
      targetConfig.name
    } endpoint:</strong> Data processed in ${targetConfig.dataLocality}</li>
      </ul>
      <label style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem;">
        <input type="checkbox" id="gdpr-dont-show-again" style="margin: 0;">
        <span>Don't show this warning again</span>
      </label>
    </div>
  `;

    // Show modal using UniversalModal if available
    if (window.UniversalModal) {
      try {
        const result = await window.UniversalModal.custom(modalContent, {
          title: "Privacy Settings",
          size: "medium",
          buttons: [
            {
              text: "Stay on EU Endpoint",
              type: "secondary",
              action: "cancel",
            },
            {
              text: `Continue to ${targetConfig.name}`,
              type: "primary",
              action: "confirm",
            },
          ],
        });

        // Check if user selected "don't show again"
        const dontShowAgain = document.getElementById(
          "gdpr-dont-show-again"
        )?.checked;
        if (dontShowAgain && result === true) {
          localStorage.setItem("mathpix-gdpr-warning-dismissed", "true");
          logDebug("GDPR warning dismissed permanently");
        }

        if (result === true) {
          onConfirm();
        } else {
          onCancel();
        }
      } catch (error) {
        logError("GDPR modal error", error);
        // Fallback to confirm if modal fails
        this.showGDPRWarningFallback(targetConfig, onConfirm, onCancel);
      }
    } else {
      // Fallback to native confirm if UniversalModal not available
      this.showGDPRWarningFallback(targetConfig, onConfirm, onCancel);
    }
  }

  /**
   * @method showGDPRWarningFallback
   * @description
   * Fallback GDPR warning using native confirm dialog.
   * Used when UniversalModal is not available.
   *
   * @param {Object} targetConfig - Target endpoint configuration
   * @param {Function} onConfirm - Callback when user confirms
   * @param {Function} onCancel - Callback when user cancels
   *
   * @returns {void}
   * @private
   * @since 2.0.0
   */
  showGDPRWarningFallback(targetConfig, onConfirm, onCancel) {
    const confirmed = confirm(
      `You are switching from EU to ${targetConfig.name} endpoint.\n\n` +
        `Data will be processed in ${targetConfig.dataLocality}.\n\n` +
        `This may not comply with GDPR requirements. Continue?`
    );

    if (confirmed) {
      onConfirm();
    } else {
      onCancel();
    }
  }

  /**
   * @method updateFeatureAvailability
   * @description
   * Updates UI to reflect feature availability for selected endpoint.
   * Disables unavailable features with appropriate tooltips and ARIA labels.
   *
   * @param {string} endpoint - Current endpoint key
   *
   * @returns {void}
   * @private
   *
   * @accessibility
   * - Disabled state communicated via native disabled attribute
   * - Tooltips explain why features are unavailable
   * - ARIA labels provide screen reader context
   * @since 2.0.0
   */
  updateFeatureAvailability(endpoint) {
    const features = this.controller.apiClient.getEndpointFeatures();
    const endpointConfig = this.controller.apiClient.getEndpointConfig();
    const endpointName = endpointConfig.name;

    logDebug("Updating feature availability UI", { endpoint, features });

    // Map of format elements to their feature keys (PDF formats only)
    const formatElements = {
      "format-latex-pdf": "latex_pdf",
    };

    Object.entries(formatElements).forEach(([elementId, featureKey]) => {
      const element = document.getElementById(elementId);
      if (!element) return;

      const available = features[featureKey];

      // Use native disabled attribute
      element.disabled = !available;

      if (!available) {
        // Uncheck disabled options
        if (element.type === "checkbox") {
          element.checked = false;
        }

        // Update ARIA label with explanation
        const label = element.labels?.[0]?.textContent || featureKey;
        element.setAttribute(
          "aria-label",
          `${label} (unavailable on ${endpointName} servers)`
        );

        // Add title for tooltip
        element.setAttribute(
          "title",
          `This format is not available on the ${endpointName} endpoint. ` +
            `Switch to US endpoint for full feature support.`
        );

        logDebug("Feature disabled in UI", { featureKey, endpoint });
      } else {
        // Remove explanatory attributes when available
        element.removeAttribute("aria-label");
        element.removeAttribute("title");

        logDebug("Feature enabled in UI", { featureKey, endpoint });
      }
    });

    logInfo("Feature availability UI updated", {
      endpoint,
      disabledFeatures: Object.entries(features)
        .filter(([_, available]) => !available)
        .map(([feature]) => feature),
    });
  }

  /**
   * @method updateStatusIndicator
   * @description Updates the status indicator with current endpoint information.
   *
   * Updates the visible status display showing current server location and
   * privacy settings. Provides real-time feedback when endpoint changes.
   *
   * @param {string} endpoint - Current endpoint key (US, EU, ASIA)
   *
   * @returns {void}
   *
   * @accessibility
   * - Uses aria-live region for dynamic updates
   * - Screen readers announce changes automatically
   * - Visual indicators support high contrast mode
   * @since Phase 1 Step 6
   */
  updateStatusIndicator(endpoint) {
    const statusElement = document.getElementById("mathpix-server-location");

    if (!statusElement) {
      logWarn("Status indicator element not found in DOM");
      return;
    }

    const config = this.controller.apiClient.getEndpointConfig();

    if (!config) {
      logError("Could not get endpoint config for status update", { endpoint });
      return;
    }

    // Get SVG flag icon for visual region indication
    const flag = getFlagIcon(endpoint);

    // Update the displayed server location with flag (SVG already has aria-hidden)
    if (flag) {
      statusElement.innerHTML = `${flag} ${config.name}`;
    } else {
      statusElement.textContent = config.name;
    }

    logDebug("Status indicator updated", {
      endpoint,
      displayName: config.name,
      location: config.location,
    });
  }

  /**
   * @method attachPreferenceListeners
   * @description
   * Attaches event listeners to preference controls for automatic saving.
   * Uses tracked listener pattern to prevent duplicate listeners.
   *
   * @returns {void}
   * @private
   *
   * @since Phase 2
   */
  attachPreferenceListeners() {
    // Only attach once to prevent duplicate listeners
    if (this._preferencesListenersAttached) {
      logDebug("[MathPix UI] Preference listeners already attached, skipping");
      return;
    }

    try {
      const savePrefs = () => {
        this.saveUserPreferences();
        logDebug("[MathPix UI] Preferences auto-saved on change");
      };

      // Attach to all controls
      if (this.controller.elements.equationNumberingCheckbox) {
        this.controller.elements.equationNumberingCheckbox.addEventListener(
          "change",
          savePrefs
        );
        this.trackEventListener(
          this.controller.elements.equationNumberingCheckbox,
          "change",
          savePrefs
        );
      }

      if (this.controller.elements.pageInfoCheckbox) {
        this.controller.elements.pageInfoCheckbox.addEventListener(
          "change",
          savePrefs
        );
        this.trackEventListener(
          this.controller.elements.pageInfoCheckbox,
          "change",
          savePrefs
        );
      }

      if (this.controller.elements.delimiterRadios) {
        this.controller.elements.delimiterRadios.forEach((radio) => {
          radio.addEventListener("change", savePrefs);
          this.trackEventListener(radio, "change", savePrefs);
        });
      }

      this._preferencesListenersAttached = true;
      logInfo("[MathPix UI] Preference auto-save listeners attached");
    } catch (e) {
      logError("[MathPix UI] Failed to attach preference listeners:", e);
    }
  }

  /**
   * @method cleanup
   * @description
   * Performs comprehensive cleanup of UI manager resources.
   * Removes all tracked event listeners, resets configuration state,
   * and calls parent cleanup methods. Essential for preventing memory leaks
   * and ensuring proper resource management.
   *
   * @returns {void}
   *
   * @example
   * uiManager.cleanup();
   * // All event listeners removed, state reset
   *
   * @since 1.0.0
   */
  cleanup() {
    // Remove all tracked event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      if (element && element.removeEventListener) {
        element.removeEventListener(event, handler);
      }
    });

    this.eventListeners = [];
    this.configLoaded = false;
    this._eventListenersAttached = false; // Reset for potential re-initialisation

    super.cleanup();
    logDebug("UI Manager cleanup completed", {
      removedEventListeners: this.eventListeners.length,
    });
  }
}

export default MathPixUIManager;
