/**
 * @fileoverview MathPix Session Restorer - ZIP Resume UI Controller (Phase 8.2)
 * @module MathPixSessionRestorer
 * @version 1.0.0
 * @since 8.2.0
 *
 * @description
 * Handles the full session restoration workflow from ZIP upload through to
 * working state with editing and conversion capabilities. Enables users to
 * resume previous MathPix processing sessions from ZIP archives created by
 * MathPixTotalDownloader.
 *
 * Key Features:
 * - ZIP file upload with drag/drop interface
 * - Parse validation with clear error/warning feedback
 * - Edit selection dialog when multiple edits exist
 * - Source PDF restoration in viewer (PDF sources only)
 * - MMD content restoration with full editing capability
 * - Persistence session management for continued editing
 * - Confidence visualiser restoration (PDF sources only)
 * - Convert section integration for new conversions
 * - Updated ZIP download with edits and new conversions
 *
 * Dependencies:
 * - MathPixZIPParser (Phase 8.1)
 * - MathPixMMDEditorCore (Phase 5.1)
 * - MathPixMMDEditorPersistence (Phase 5.2)
 * - MathPixConvertUI (Phase 6.2)
 * - MathPixTotalDownloader (existing)
 * - PDF Confidence Visualiser (existing, optional)
 *
 * Integration:
 * - Receives controller reference from MathPixMainController
 * - Coordinates with MathPixModeSwitcher for mode changes
 * - Uses existing notification system for user feedback
 *
 * @accessibility
 * - WCAG 2.2 AA compliant throughout
 * - Keyboard navigation for all interactions
 * - Screen reader announcements for state changes
 * - Clear focus management during transitions
 *
 * @author MathPix Development Team
 */

// ============================================================================
// LOGGING CONFIGURATION
// ============================================================================

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

/**
 * Determines if a message should be logged based on current configuration
 * @param {number} level - The log level to check
 * @returns {boolean} True if the message should be logged
 */
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

/**
 * Logs error messages if error logging is enabled
 * @param {string} message - The error message to log
 * @param {...any} args - Additional arguments
 */
function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR))
    console.error(`[SessionRestorer] ${message}`, ...args);
}

/**
 * Logs warning messages if warning logging is enabled
 * @param {string} message - The warning message to log
 * @param {...any} args - Additional arguments
 */
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[SessionRestorer] ${message}`, ...args);
}

/**
 * Logs informational messages if info logging is enabled
 * @param {string} message - The info message to log
 * @param {...any} args - Additional arguments
 */
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[SessionRestorer] ${message}`, ...args);
}

/**
 * Logs debug messages if debug logging is enabled
 * @param {string} message - The debug message to log
 * @param {...any} args - Additional arguments
 */
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[SessionRestorer] ${message}`, ...args);
}

// ============================================================================
// SVG ICON REGISTRY
// ============================================================================

/**
 * SVG icons for consistent cross-platform rendering
 * All icons use currentColor for stroke/fill to inherit text colour
 * @constant {Object.<string, string>}
 */
const ICONS = {
  disk: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)"><path d="m2.5.5h7l3 3v7c0 1.1045695-.8954305 2-2 2h-8c-1.1045695 0-2-.8954305-2-2v-8c0-1.1045695.8954305-2 2-2z"/><path d="m4.50000081 8.5h4c.55228475 0 1 .44771525 1 1v3h-6v-3c0-.55228475.44771525-1 1-1z"/><path d="m3.5 3.5h2v2h-2z"/></g></svg>',
  pencil:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m14 1c.8284271.82842712.8284271 2.17157288 0 3l-9.5 9.5-4 1 1-3.9436508 9.5038371-9.55252193c.7829896-.78700064 2.0312313-.82943964 2.864366-.12506788z"/><path d="m12.5 3.5 1 1"/></g></svg>',
  box: '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m8.49227788 1.06701593 5.00000002 2.85714286c.62315.35608571 1.0077221 1.01877259 1.0077221 1.73648628v4.67870983c0 .7177137-.3845721 1.3804006-1.0077221 1.7364863l-5.00000002 2.8571429c-.61486534.3513516-1.36969042.3513516-1.98455576 0l-5-2.8571429c-.62314999-.3560857-1.00772212-1.0187726-1.00772212-1.7364863v-4.67870983c0-.71771369.38457213-1.38040057 1.00772212-1.73648628l5-2.85714286c.61486534-.35135162 1.36969042-.35135162 1.98455576 0z"/><path d="m11 6.5-7-4"/><path d="m1 5 5.55180035 2.98943096c.59195265.31874373 1.30444665.31874373 1.8963993 0l5.55180035-2.98943096"/><path d="m7.5 8.5v6.5"/></g></svg>',
  refresh:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 1)"><path d="m1.5 5.5c1.37786776-2.41169541 4.02354835-4 7-4 4.418278 0 8 3.581722 8 8m-1 4c-1.4081018 2.2866288-4.1175492 4-7 4-4.418278 0-8-3.581722-8-8"/><path d="m6.5 5.5h-5v-5"/><path d="m10.5 13.5h5v5"/></g></svg>',
  document:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 3)"><path d="m12.5 12.5v-7l-5-5h-5c-1.1045695 0-2 .8954305-2 2v10c0 1.1045695.8954305 2 2 2h8c1.1045695 0 2-.8954305 2-2z"/><path d="m2.5 7.5h5"/><path d="m2.5 9.5h7"/><path d="m2.5 11.5h3"/><path d="m7.5.5v3c0 1.1045695.8954305 2 2 2h3"/></g></svg>',
  inbox:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2.5 1.5)"><path d="m10 3h2.3406038c.4000282 0 .7615663.23839685.9191451.6060807l2.7402511 6.3939193v4c0 1.1045695-.8954305 2-2 2h-12c-1.1045695 0-2-.8954305-2-2v-4l2.74025113-6.3939193c.15757879-.36768385.51911692-.6060807.91914503-.6060807h2.34060384"/><path d="m11 6.086-3 2.914-3-2.914"/><path d="m8 0v9"/><path d="m0 10h4c.55228475 0 1 .4477153 1 1v1c0 .5522847.44771525 1 1 1h4c.5522847 0 1-.4477153 1-1v-1c0-.5522847.4477153-1 1-1h4"/></g></svg>',
  close:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(5 5)"><path d="m10.5 10.5-10-10z"/><path d="m10.5.5-10 10"/></g></svg>',
  check:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><path d="m.5 5.5 3 3 8.028-8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(5 6)"/></svg>',
  returnArrow:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 6)"><path d="m1.378 1.376 4.243.003v4.242" transform="matrix(-.70710678 .70710678 .70710678 .70710678 3.500179 -1.449821)"/><path d="m5.5 9.49998326h5c2 .00089417 3-.99910025 3-2.99998326s-1-3.00088859-3-3.00001674h-10"/></g></svg>',
  warning:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" transform="translate(1 1)"><path d="m9.5.5 9 16h-18z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="m9.5 10.5v-5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="13.5" fill="currentColor" r="1"/></g></svg>',
  error:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(5 5)"><path d="m10.5 10.5-10-10z"/><path d="m10.5.5-10 10"/></g></svg>',
  fullscreenEnter:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 2)"><path d="m16.5 5.5v-4.978l-5.5.014"/><path d="m16.5.522-6 5.907"/><path d="m11 16.521 5.5.002-.013-5.5"/><path d="m16.5 16.429-6-5.907"/><path d="m.5 5.5v-5h5.5"/><path d="m6.5 6.429-6-5.907"/><path d="m6 16.516-5.5.007v-5.023"/><path d="m6.5 10.5-6 6"/></g></svg>',
  fullscreenExit:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)"><path d="m.5 4.5 4.5-.013-.013-4.5"/><path d="m5 4.5-4.5-4"/><path d="m.5 8.5 4.5.014.013 4.5"/><path d="m5 8.5-4.5 4"/><path d="m12.5 4.5-4.5-.013.013-4.5"/><path d="m8 4.5 4.5-4"/><path d="m12.5 8.5-4.5.014-.013 4.5"/><path d="m8 8.5 4.5 4"/></g></svg>',
  hourglass:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="matrix(-1 0 0 1 19 2)"><circle cx="8.5" cy="8.5" r="8"/><path d="m8.5 5.5v4h-3.5"/></g></svg>',
  checkCircle:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 2)"><circle cx="8.5" cy="8.5" r="8"/><path d="m5.5 9.5 2 2 5-5"/></g></svg>',
  download:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m11.5 8.5-3.978 4-4.022-4"/><path d="m7.522.521v11.979"/><path d="m.5 9v4.5c0 1.1045695.8954305 2 2 2h10c1.1045695 0 2-.8954305 2-2v-4.5"/></g></svg>',
  arrowRight:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 6)"><path d="m9.5.497 4 4.002-4 4.001"/><path d="m.5 4.5h13"/></g></svg>',
};

/**
 * Get an SVG icon by name with accessibility attributes
 * @param {string} name - Icon name from ICONS registry
 * @param {Object} [options] - Options
 * @param {string} [options.className] - Additional CSS class(es)
 * @returns {string} SVG HTML string with aria-hidden="true"
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

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuration constants for session restorer
 * @constant {Object}
 */
const RESTORER_CONFIG = {
  MESSAGES: {
    LOADING: "Parsing ZIP archive...",
    SUCCESS: "Session restored successfully!",
    ERROR_PARSE: "Failed to parse ZIP archive",
    ERROR_INVALID: "Invalid MathPix ZIP archive",
    SELECT_EDIT: "Select which edit version to restore",
    SESSION_MODIFIED: "Modified",
    SESSION_SAVED: "Saved",
    CONFIRM_NEW_SESSION:
      "You have unsaved changes. Start a new session anyway?",
    DROP_HINT: "Drop ZIP file here or click to browse",
    ACCEPTED_FILES: "Accepts ZIP archives from MathPix Download All feature",
  },
  VALID_ZIP_TYPES: ["application/zip", "application/x-zip-compressed"],
  SESSION_KEY_PREFIX: "resume-",
};

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * Session Restorer for MathPix ZIP archives
 *
 * Manages the complete workflow for restoring previous MathPix sessions
 * from ZIP archives, including UI management, state restoration, and
 * coordination with other MathPix components.
 *
 * @class MathPixSessionRestorer
 * @since 8.2.0
 *
 * @example
 * const restorer = getMathPixSessionRestorer();
 * restorer.show();
 */
class MathPixSessionRestorer {
  /**
   * Create a new MathPixSessionRestorer instance
   * @param {Object} controller - Main MathPix controller instance
   */
  constructor(controller) {
    logInfo("Creating MathPixSessionRestorer instance...");

    /**
     * Reference to main MathPix controller
     * @type {Object}
     */
    this.controller = controller;

    /**
     * MathPixZIPParser instance (lazy initialised)
     * @type {Object|null}
     */
    this.parser = null;

    /**
     * Current parsed ZIP data
     * @type {Object|null}
     */
    this.parseResult = null;

    /**
     * User's selected edit (or null for original)
     * @type {Object|null}
     */
    this.selectedEdit = null;

    /**
     * Active restored session state
     * @type {Object|null}
     */
    this.restoredSession = null;

    /**
     * Cached DOM elements
     * @type {Object}
     */
    this.elements = {};

    /**
     * Flag indicating initialisation state
     * @type {boolean}
     */
    this.isInitialised = false;

    /** @type {string[]} Undo stack for edit history */
    this.undoStack = [];

    /** @type {string[]} Redo stack for undone edits */
    this.redoStack = [];

    /** @type {number} Maximum undo levels */
    this.maxUndoLevels = 10;

    /** @type {number|null} Auto-save timer */
    this.autoSaveTimer = null;

    /**
     * Object URLs that need cleanup
     * @type {Array<string>}
     */
    this.objectURLs = [];

    /** @type {boolean} Whether PDF has been rendered for comparison */
    this.pdfRenderedForComparison = false;

    /**
     * Flag for tracking unsaved changes
     * @type {boolean}
     */
    this.hasUnsavedChanges = false;

    /**
     * Fullscreen state (Phase 5.4)
     * @type {boolean}
     */
    this.isFullscreen = false;

    /**
     * Focus Mode state (Phase 8.3.3)
     * Page-level fullscreen for immersive editing
     * @type {boolean}
     */
    this.isFocusMode = false;

    /**
     * Saved scroll position for Focus Mode restoration
     * @type {number|undefined}
     */
    this.savedScrollPosition = undefined;

    /**
     * Internal storage for session index with debug tracking
     * @type {number|null}
     * @private
     */
    this.__currentSessionIndex = null;

    /**
     * MathJax/CDN recovery integration
     * @type {boolean}
     */
    this.pendingPreviewRender = false;

    /**
     * Unsubscribe function for MathJax recovery
     * @type {Function|null}
     */
    this.mathJaxRecoveryUnsubscribe = null;

    /**
     * Content waiting to be rendered when CDN is ready
     * @type {string|null}
     */
    this.pendingContent = null;

    /**
     * Original MMD lines from OCR output (confidence source)
     * Used to detect edits for confidence display
     * @type {string[]|null}
     */
    this.originalMmdLines = null;

    /**
     * Phase 8.3.4: Confidence mapper instance
     * @type {MathPixConfidenceMapper|null}
     */
    this.confidenceMapper = null;

    /**
     * Phase 8.3.4: Whether confidence highlighting is enabled
     * @type {boolean}
     */
    this.isConfidenceEnabled = false;

    /**
     * Phase 8.3.4: Line height for gutter positioning (calculated on render)
     * @type {number}
     */
    this.gutterLineHeight = 20;

    /**
     * Phase 8.3.4: Bound scroll handler for edit mode gutter sync
     * @type {Function|null}
     * @private
     */
    this.boundEditModeScrollHandler = null;

    /**
     * Phase 8.3.5: Line-based confidence editor element reference
     * @type {HTMLElement|null}
     */
    this.lineBasedEditor = null;
  }
  // =========================================================================
  // SESSION INDEX TRACKING (with debug support)
  // =========================================================================

  /**
   * Set the current session index with debug logging
   * @param {number|null} value - New index value (-1 for ZIP, 0+ for localStorage, null for none)
   */
  set _currentSessionIndex(value) {
    const oldValue = this.__currentSessionIndex;
    this.__currentSessionIndex = value;
    logDebug(`_currentSessionIndex changed: ${oldValue} → ${value}`);
  }

  /**
   * Get the current session index
   * @returns {number|null} Current index value
   */
  get _currentSessionIndex() {
    return this.__currentSessionIndex;
  }

  /**
   * Determine actual current state from loaded content
   * Validates _currentSessionIndex against actual MMD content
   * @returns {Object} Object with type ('zip'|'localStorage'|'modified') and index
   */
  getCurrentVersionType() {
    const currentMMD = this.restoredSession?.currentMMD || "";
    const originalMMD = this.restoredSession?.originalMMD || "";

    // If current matches original, we're showing ZIP contents
    if (currentMMD === originalMMD) {
      return { type: "zip", index: -1 };
    }

    // Otherwise, find which localStorage session matches current content
    const sessions = this._recoverySessions || [];
    for (let i = 0; i < sessions.length; i++) {
      if (sessions[i].data?.current === currentMMD) {
        return { type: "localStorage", index: i };
      }
    }

    // Content doesn't match any known version (user made new edits)
    return { type: "modified", index: this.__currentSessionIndex };
  }

  /**
   * Validate current session index against actual content
   * Corrects mismatches and logs warnings
   * @returns {number|null} Validated index
   */
  validateCurrentSessionIndex() {
    const actual = this.getCurrentVersionType();
    if (actual.index !== this.__currentSessionIndex) {
      logWarn(`Session index mismatch detected`, {
        stored: this.__currentSessionIndex,
        actual: actual.index,
        type: actual.type,
      });
      this.__currentSessionIndex = actual.index;
    }
    return this.__currentSessionIndex;
  }

  // =========================================================================
  // INITIALISATION
  // =========================================================================

  /**
   * Initialise the session restorer
   * @returns {Promise<boolean>} Success status
   */
  async initialise() {
    logInfo("Initialising session restorer...");

    try {
      // Cache DOM elements
      this.cacheElements();

      // Verify required elements exist
      if (!this.elements.container) {
        logError("Resume mode container not found in DOM");
        return false;
      }

      // Attach event listeners
      this.attachEventListeners();

      // Set up textarea auto-resize
      this.setupTextareaAutoResize();

      // Get parser instance
      this.parser = window.getMathPixZIPParser?.();
      if (!this.parser) {
        logWarn("MathPixZIPParser not available - will retry on first use");
      }

      // Subscribe to MathJax/CDN recovery events
      this.subscribeToRecoveryEvents();

      this.isInitialised = true;
      logInfo("Session restorer initialised successfully", {
        hasRecoverySubscription: !!this.mathJaxRecoveryUnsubscribe,
      });
      return true;
    } catch (error) {
      logError("Failed to initialise session restorer:", error);
      return false;
    }
  }

  // =========================================================================
  // MATHJAX/CDN RECOVERY INTEGRATION
  // =========================================================================

  /**
   * Subscribe to MathJax Manager recovery events AND MMD Preview library ready events
   * When MathJax or the CDN library recovers, re-render pending content
   * @private
   */
  subscribeToRecoveryEvents() {
    // Subscribe to MathJax Manager recovery
    if (window.mathJaxManager?.onRecovery) {
      this.mathJaxRecoveryUnsubscribe = window.mathJaxManager.onRecovery(
        (eventData) => {
          logInfo(
            "MathJax recovery notification received in Session Restorer",
            {
              healthy: eventData.healthy,
              pendingPreviewRender: this.pendingPreviewRender,
              hasPendingContent: !!this.pendingContent,
            },
          );

          // When MathJax becomes healthy, it's a good time to try loading the CDN too
          if (
            eventData.healthy &&
            (this.pendingPreviewRender || this.pendingContent)
          ) {
            // Small delay to let MathJax fully stabilise
            setTimeout(() => {
              this.handleRecoveryRerender();
            }, 500);
          }
        },
      );
      logDebug("Session Restorer subscribed to MathJax recovery events");

      // CRITICAL: Also check if MathJax is ALREADY healthy
      // The recovery callback only fires on state CHANGE, not initial state
      // So we need to poll for when MathJax first becomes healthy
      this.monitorMathJaxInitialReady();
    } else {
      logDebug(
        "MathJax Manager not available for recovery subscription - will retry",
      );
      // Retry subscription after a delay
      setTimeout(() => {
        if (
          window.mathJaxManager?.onRecovery &&
          !this.mathJaxRecoveryUnsubscribe
        ) {
          this.subscribeToRecoveryEvents();
        }
      }, 2000);
    }

    // Also monitor for CDN library becoming available
    this.monitorCDNLibraryReady();
  }

  /**
   * Monitor for MathJax Manager to become healthy for the first time
   * This handles the case where we subscribe BEFORE MathJax initialises
   * CRITICAL: Must wait for BOTH MathJax healthy AND pending content before clearing interval
   * @private
   */
  monitorMathJaxInitialReady() {
    // If already healthy and we have pending content, trigger immediately
    if (
      window.mathJaxManager?.isHealthy &&
      (this.pendingPreviewRender || this.pendingContent)
    ) {
      logInfo(
        "MathJax already healthy with pending content - triggering recovery render",
      );
      setTimeout(() => {
        this.handleRecoveryRerender();
      }, 500);
      return;
    }

    // Otherwise, poll until BOTH conditions are met:
    // 1. MathJax is healthy
    // 2. We have pending content to render
    let checkCount = 0;
    const maxChecks = 60; // Check for up to 30 seconds (every 500ms)
    let hasTriggeredRecovery = false;

    const checkInterval = setInterval(() => {
      checkCount++;

      const mathJaxHealthy = window.mathJaxManager?.isHealthy;
      const hasPendingContent =
        this.pendingPreviewRender || this.pendingContent;

      // Only clear and trigger when BOTH conditions are met
      if (mathJaxHealthy && hasPendingContent && !hasTriggeredRecovery) {
        hasTriggeredRecovery = true;
        clearInterval(checkInterval);

        logInfo(
          "MathJax healthy AND pending content detected - triggering recovery render",
          {
            checkCount,
            pendingPreviewRender: this.pendingPreviewRender,
          },
        );

        // Small delay for stability
        setTimeout(() => {
          this.handleRecoveryRerender();
        }, 500);
      } else if (checkCount >= maxChecks) {
        clearInterval(checkInterval);

        // Log why we timed out
        if (!mathJaxHealthy) {
          logWarn(
            "MathJax initial ready monitoring timeout - MathJax never became healthy",
          );
        } else if (!hasPendingContent) {
          logDebug(
            "MathJax initial ready monitoring complete - no pending content needed",
          );
        }
      }
    }, 500);

    logDebug("Started monitoring for MathJax initial ready state", {
      mathJaxCurrentlyHealthy: window.mathJaxManager?.isHealthy,
      currentlyPending: this.pendingPreviewRender || !!this.pendingContent,
    });
  }
  /**
   * Monitor for mathpix-markdown-it CDN library to become available
   * @private
   */
  monitorCDNLibraryReady() {
    // Check if already available
    if (
      typeof window.MathpixMarkdownModel !== "undefined" ||
      typeof window.markdownToHTML !== "undefined"
    ) {
      logDebug("CDN library already available");
      return;
    }

    logDebug("Monitoring for CDN library availability...");

    let checkCount = 0;
    const maxChecks = 30; // Check for up to 30 seconds

    const checkInterval = setInterval(() => {
      checkCount++;

      // Check for CDN library availability
      const cdnReady =
        typeof window.MathpixMarkdownModel !== "undefined" ||
        typeof window.markdownToHTML !== "undefined";

      if (cdnReady) {
        clearInterval(checkInterval);
        logInfo("CDN library became available - triggering recovery render");

        if (this.pendingPreviewRender && this.pendingContent) {
          this.handleRecoveryRerender();
        }
      } else if (checkCount >= maxChecks) {
        clearInterval(checkInterval);
        logWarn("CDN library monitoring timeout - library may not be loading");
      }
    }, 1000);
  }

  /**
   * Handle recovery by re-rendering the preview content
   * Explicitly ensures CDN library is loaded before attempting render
   * @private
   */
  async handleRecoveryRerender() {
    logInfo("Handling recovery re-render in Session Restorer");

    // Check if we have content to re-render
    const contentToRender =
      this.pendingContent || this.restoredSession?.currentMMD;
    if (!contentToRender) {
      logDebug("No content to re-render after recovery");
      this.pendingPreviewRender = false;
      return;
    }

    // Check if the preview element exists and needs re-rendering
    const previewElement = this.elements.mmdPreviewContent;
    if (!previewElement) {
      logWarn("Preview element not found for recovery re-render");
      this.pendingPreviewRender = false;
      return;
    }

    // CRITICAL: Ensure we're targeting the PREVIEW element, not code elements
    // Code elements should NEVER have MathJax applied - they show raw MMD source
    if (
      previewElement.id === "resume-mathpix-pdf-content-mmd" ||
      previewElement.closest(".code-block-wrapper") ||
      previewElement.closest("pre") ||
      previewElement.closest("code")
    ) {
      logWarn(
        "Recovery re-render aborted - target is a code element, not preview",
      );
      this.pendingPreviewRender = false;
      return;
    }

    // Check if content still shows raw LaTeX or loading message (needs re-rendering)
    const needsRerender =
      previewElement.textContent?.includes("\\section") ||
      previewElement.textContent?.includes("\\begin{") ||
      previewElement.textContent?.includes("Unknown environment") ||
      previewElement.textContent?.includes("Loading preview renderer") ||
      previewElement.querySelector(".mmd-preview-loading");

    if (!needsRerender) {
      logDebug("Preview already rendered correctly - no recovery needed");
      this.pendingPreviewRender = false;
      return;
    }

    try {
      logInfo(
        "Attempting recovery re-render - ensuring CDN library is loaded first",
      );

      // Get MMD Preview module
      let mmdPreview = window.getMathPixMMDPreview?.();
      if (!mmdPreview) {
        const controller = window.getMathPixController?.();
        mmdPreview = controller?.getMMDPreview?.();
      }

      if (mmdPreview) {
        // CRITICAL: Explicitly load the CDN library if not ready
        if (!mmdPreview.isReady?.()) {
          logInfo("CDN library not ready - triggering explicit load...");

          try {
            // Force load the library (this is the key fix!)
            await mmdPreview.loadLibrary();
            logInfo("✅ CDN library loaded successfully via explicit call");
          } catch (loadError) {
            logWarn("Failed to load CDN library:", loadError);
            // Continue anyway - might work with fallback
          }
        }

        // Now attempt the render
        logInfo("Re-rendering preview after CDN load...");
        await mmdPreview.render(contentToRender, previewElement);

        // Clear pending state on success
        this.pendingPreviewRender = false;
        this.pendingContent = null;

        // Announce to screen readers
        this.announceToScreenReader("Mathematical content has been rendered");

        logInfo("✅ Recovery re-render completed successfully");
      } else {
        logWarn("MMD Preview module not available for recovery re-render");
        // Keep pending for later retry
      }
    } catch (error) {
      logError("Failed to re-render after recovery:", error);
      // Keep pendingPreviewRender true so we can try again on next recovery event
    }
  }
  /**
   * Cache all resume-prefixed DOM elements
   * @private
   */
  cacheElements() {
    logDebug("Caching DOM elements...");

    this.elements = {
      // Main containers
      container: document.getElementById("mathpix-resume-mode-container"),
      uploadSection: document.getElementById("resume-upload-section"),
      workingArea: document.getElementById("resume-working-area"),

      // Upload elements
      dropZone: document.getElementById("resume-drop-zone"),
      fileInput: document.getElementById("resume-file-input"),
      validationMessages: document.getElementById("resume-validation-messages"),

      // Edit selection dialog
      editSelection: document.getElementById("resume-edit-selection"),
      editOptions: document.getElementById("resume-edit-options"),
      editConfirmBtn: document.getElementById("resume-edit-confirm-btn"),
      editCancelBtn: document.getElementById("resume-edit-cancel-btn"),

      // Session header
      sourceName: document.getElementById("resume-source-name"),
      sessionStatus: document.getElementById("resume-session-status"),
      focusModeBtn: document.getElementById("resume-focus-mode-btn"),
      newSessionBtn: document.getElementById("resume-new-session-btn"),

      // Tabs
      tabMmd: document.getElementById("resume-tab-mmd"),
      tabConfidence: document.getElementById("resume-tab-confidence"),
      panelMmd: document.getElementById("resume-panel-mmd"),
      panelConfidence: document.getElementById("resume-panel-confidence"),

      // MMD view controls
      mmdViewCodeBtn: document.getElementById("resume-mmd-view-code-btn"),
      mmdViewPreviewBtn: document.getElementById("resume-mmd-view-preview-btn"),
      mmdViewSplitBtn: document.getElementById("resume-mmd-view-split-btn"),
      mmdViewPdfSplitBtn: document.getElementById(
        "resume-mmd-view-pdf-split-btn",
      ),
      mmdEditBtn: document.getElementById("resume-mmd-edit-btn"),
      mmdFullscreenBtn: document.getElementById("resume-mmd-fullscreen-btn"),
      mmdFullscreenExitBtn: document.getElementById(
        "resume-fullscreen-exit-btn",
      ),
      mmdViewStatus: document.getElementById("resume-mmd-view-status"),

      // Split PDF toggle (Phase 4.2 parity)
      splitPdfToggle: document.getElementById("resume-mmd-split-pdf-toggle"),
      splitPdfCheckbox: document.getElementById("resume-mmd-split-show-pdf"),

      // MMD content areas
      mmdContentArea: document.getElementById("resume-mmd-content-area"),
      mmdCodeContainer: document.getElementById("resume-mmd-code-container"),
      mmdPreviewContainer: document.getElementById(
        "resume-mmd-preview-container",
      ),
      mmdPdfContainer: document.getElementById("resume-mmd-pdf-container"),
      mmdViewDivider: document.getElementById("resume-mmd-view-divider"),
      mmdCodeElement: document.getElementById("resume-mathpix-pdf-content-mmd"),
      mmdEditorTextarea: document.getElementById("resume-mmd-editor-textarea"),
      mmdPreviewContent: document.getElementById("resume-mmd-preview-content"),

      // PDF controls
      pdfPageInput: document.getElementById("resume-mmd-pdf-page-input"),
      pdfTotalPages: document.getElementById("resume-mmd-pdf-total-pages"),
      pdfZoomOut: document.getElementById("resume-mmd-pdf-zoom-out"),
      pdfZoomIn: document.getElementById("resume-mmd-pdf-zoom-in"),
      pdfZoomFit: document.getElementById("resume-mmd-pdf-zoom-fit"),
      pdfZoomLevel: document.getElementById("resume-mmd-pdf-zoom-level"),
      pdfScrollContainer: document.getElementById(
        "resume-mmd-pdf-scroll-container",
      ),
      pdfPagesContainer: document.getElementById("resume-mmd-pdf-pages"),

      // Editor toolbar
      mmdEditorToolbar: document.getElementById("resume-mmd-editor-toolbar"),
      mmdUndoBtn: document.getElementById("resume-mmd-undo-btn"),
      mmdRedoBtn: document.getElementById("resume-mmd-redo-btn"),
      mmdRestoreBtn: document.getElementById("resume-mmd-restore-btn"),
      mmdClearSessionBtn: document.getElementById(
        "resume-mmd-clear-session-btn",
      ),
      mmdDownloadBtn: document.getElementById("resume-mmd-download-btn"),
      mmdUploadInput: document.getElementById("resume-mmd-upload-input"),
      mmdSessionStatus: document.getElementById("resume-mmd-session-status"),

      // Convert section
      convertSection: document.getElementById("resume-convert-section"),
      convertBtn: document.getElementById("resume-convert-btn"),
      convertCancelBtn: document.getElementById("resume-convert-cancel-btn"),
      convertProgress: document.getElementById("resume-convert-progress"),
      convertProgressList: document.getElementById(
        "resume-convert-progress-list",
      ),
      convertDownloads: document.getElementById("resume-convert-downloads"),
      convertDownloadButtons: document.getElementById(
        "resume-download-buttons",
      ),
      convertErrors: document.getElementById("resume-convert-errors"),
      convertErrorList: document.getElementById("resume-convert-error-list"),
      convertSelectAll: document.getElementById("resume-select-all-formats"),
      convertFormatCheckboxes: null, // Populated after DOM ready
      convertDownloadAllBtn: document.getElementById(
        "resume-download-all-converted-btn",
      ),

      // Download all (main ZIP with edits)
      downloadAllBtn: document.getElementById("resume-download-all-btn"),

      // Confidence visualiser (PDF tab)
      confidenceContainer: document.getElementById(
        "resume-confidence-visualiser-container",
      ),

      // Phase 8.3.4: Confidence gutter (MMD code view)
      confidenceToggle: document.getElementById("resume-mmd-confidence-toggle"),
      confidenceCheckbox: document.getElementById("resume-mmd-show-confidence"),
      confidenceGutter: document.getElementById("resume-mmd-confidence-gutter"),
    };

    // Cache format checkboxes separately
    this.elements.convertFormatCheckboxes = document.querySelectorAll(
      'input[name="resume-convert-format"]',
    );

    // Log element availability
    const foundCount = Object.values(this.elements).filter(Boolean).length;
    const totalCount = Object.keys(this.elements).length;
    logDebug(`Cached ${foundCount}/${totalCount} DOM elements`);
  }

  /**
   * Attach all event listeners
   * @private
   */
  attachEventListeners() {
    logDebug("Attaching event listeners...");

    // Drop zone events
    if (this.elements.dropZone) {
      this.elements.dropZone.addEventListener("dragover", (e) =>
        this.handleDragOver(e),
      );
      this.elements.dropZone.addEventListener("dragleave", (e) =>
        this.handleDragLeave(e),
      );
      this.elements.dropZone.addEventListener("drop", (e) =>
        this.handleDrop(e),
      );
      this.elements.dropZone.addEventListener("click", () =>
        this.triggerFileSelect(),
      );
      this.elements.dropZone.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.triggerFileSelect();
        }
      });
    }

    // File input change
    if (this.elements.fileInput) {
      this.elements.fileInput.addEventListener("change", (e) =>
        this.handleFileSelect(e),
      );
    }

    // Edit selection buttons
    if (this.elements.editConfirmBtn) {
      this.elements.editConfirmBtn.addEventListener("click", () =>
        this.confirmEditSelection(),
      );
    }
    if (this.elements.editCancelBtn) {
      this.elements.editCancelBtn.addEventListener("click", () =>
        this.cancelEditSelection(),
      );
    }

    // Focus Mode button (Phase 8.3.3)
    if (this.elements.focusModeBtn) {
      this.elements.focusModeBtn.addEventListener("click", () =>
        this.toggleFocusMode(),
      );
    }

    // New session button
    if (this.elements.newSessionBtn) {
      this.elements.newSessionBtn.addEventListener("click", () =>
        this.startNewSession(),
      );
    }

    // Tab switching
    if (this.elements.tabMmd) {
      this.elements.tabMmd.addEventListener("click", () =>
        this.switchTab("mmd"),
      );
    }
    if (this.elements.tabConfidence) {
      this.elements.tabConfidence.addEventListener("click", () =>
        this.switchTab("confidence"),
      );
    }

    // MMD view controls
    if (this.elements.mmdViewCodeBtn) {
      this.elements.mmdViewCodeBtn.addEventListener("click", () =>
        this.switchMmdView("code"),
      );
    }
    if (this.elements.mmdViewPreviewBtn) {
      this.elements.mmdViewPreviewBtn.addEventListener("click", () =>
        this.switchMmdView("preview"),
      );
    }
    if (this.elements.mmdViewSplitBtn) {
      this.elements.mmdViewSplitBtn.addEventListener("click", () =>
        this.switchMmdView("split"),
      );
    }
    if (this.elements.mmdViewPdfSplitBtn) {
      this.elements.mmdViewPdfSplitBtn.addEventListener("click", () =>
        this.switchMmdView("pdf_split"),
      );
    }

    // Split PDF toggle checkbox
    if (this.elements.splitPdfCheckbox) {
      this.elements.splitPdfCheckbox.addEventListener("change", (e) =>
        this.toggleSplitPDF(e.target.checked),
      );
    }

    // Phase 8.3.4: Confidence toggle checkbox
    if (this.elements.confidenceCheckbox) {
      this.elements.confidenceCheckbox.addEventListener("change", (e) =>
        this.toggleConfidenceHighlighting(e.target.checked),
      );
    }

    if (this.elements.mmdEditBtn) {
      this.elements.mmdEditBtn.addEventListener("click", () =>
        this.toggleEditMode(),
      );
    }

    // Editor toolbar buttons
    if (this.elements.mmdUndoBtn) {
      this.elements.mmdUndoBtn.addEventListener("click", () => this.undoEdit());
    }
    if (this.elements.mmdRedoBtn) {
      this.elements.mmdRedoBtn.addEventListener("click", () => this.redoEdit());
    }
    if (this.elements.mmdRestoreBtn) {
      this.elements.mmdRestoreBtn.addEventListener("click", () =>
        this.restoreOriginal(),
      );
    }
    if (this.elements.mmdClearSessionBtn) {
      this.elements.mmdClearSessionBtn.addEventListener("click", () =>
        this.clearSession(),
      );
    }
    if (this.elements.mmdDownloadBtn) {
      this.elements.mmdDownloadBtn.addEventListener("click", () =>
        this.downloadMmd(),
      );
    }
    if (this.elements.mmdUploadInput) {
      this.elements.mmdUploadInput.addEventListener("change", (e) =>
        this.handleMmdUpload(e),
      );
    }

    // PDF controls
    if (this.elements.pdfPageInput) {
      this.elements.pdfPageInput.addEventListener("change", (e) =>
        this.goToPage(parseInt(e.target.value, 10)),
      );
      this.elements.pdfPageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.goToPage(parseInt(e.target.value, 10));
        }
      });
    }
    if (this.elements.pdfZoomOut) {
      this.elements.pdfZoomOut.addEventListener("click", () =>
        this.zoomPDF(-0.1),
      );
    }
    if (this.elements.pdfZoomIn) {
      this.elements.pdfZoomIn.addEventListener("click", () =>
        this.zoomPDF(0.1),
      );
    }
    if (this.elements.pdfZoomFit) {
      this.elements.pdfZoomFit.addEventListener("click", () =>
        this.fitPDFToWidth(),
      );
    }

    // Editor textarea changes
    if (this.elements.mmdEditorTextarea) {
      this.elements.mmdEditorTextarea.addEventListener("input", () =>
        this.handleMmdInput(),
      );
    }

    // Download all button
    if (this.elements.downloadAllBtn) {
      this.elements.downloadAllBtn.addEventListener("click", () =>
        this.downloadUpdatedZIP(),
      );
    }

    // Convert section event listeners
    if (this.elements.convertBtn) {
      this.elements.convertBtn.addEventListener("click", () =>
        this.handleConvert(),
      );
    }

    if (this.elements.convertCancelBtn) {
      this.elements.convertCancelBtn.addEventListener("click", () =>
        this.cancelConversion(),
      );
    }

    // Select All checkbox handling
    if (this.elements.convertSelectAll) {
      this.elements.convertSelectAll.addEventListener("change", () => {
        const isChecked = this.elements.convertSelectAll.checked;
        this.elements.convertFormatCheckboxes?.forEach((checkbox) => {
          checkbox.checked = isChecked;
        });
        this.updateConvertButtonState();
      });
    }

    // Format checkbox change events - update Select All state and button
    this.elements.convertFormatCheckboxes?.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        this.updateSelectAllState();
        this.updateConvertButtonState();
      });
    });

    // Download All Converted button
    if (this.elements.convertDownloadAllBtn) {
      this.elements.convertDownloadAllBtn.addEventListener("click", () =>
        this.downloadAllConvertedFiles(),
      );
    }

    // Initial button state
    this.updateConvertButtonState();

    logDebug("Event listeners attached");
  }

  // =========================================================================
  // MODE VISIBILITY
  // =========================================================================

  /**
   * Show the resume mode interface
   */
  show() {
    logDebug("Showing resume mode");

    if (!this.isInitialised) {
      this.initialise();
    }

    if (this.elements.container) {
      this.elements.container.style.display = "";
    }

    // Reset to upload state if no active session
    if (!this.restoredSession) {
      this.resetToUploadState();
    }
  }

  /**
   * Check for existing localStorage sessions matching the uploaded ZIP
   * Called after ZIP parsing to offer recovery of unsaved edits
   * Returns ALL matching sessions sorted by lastModified (newest first)
   * @param {string} sourceFilename - Filename from the uploaded ZIP
   * @returns {Array} Array of matching sessions, or empty array
   * @private
   */
  checkForMatchingSessions(sourceFilename) {
    if (!sourceFilename) return [];

    logDebug("Checking for matching localStorage sessions:", sourceFilename);

    try {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith("mathpix-resume-session"),
      );

      const uploadedBaseName = sourceFilename.replace(/\.[^/.]+$/, "");
      const matchingSessions = [];

      for (const key of keys) {
        try {
          const data = JSON.parse(localStorage.getItem(key));

          // Handle both property name variants for backwards compatibility
          const storedName = data?.sourceFileName || data?.sourceFilename || "";
          const storedBaseName = storedName.replace(/\.[^/.]+$/, "");

          if (
            storedBaseName &&
            storedBaseName === uploadedBaseName &&
            data.current
          ) {
            matchingSessions.push({
              key,
              data,
              lastModified: data.lastModified || 0,
              contentLength: data.current?.length || 0,
            });
          }
        } catch (e) {
          logDebug("Skipping invalid localStorage entry:", key);
        }
      }

      // Sort by lastModified descending (newest first)
      matchingSessions.sort((a, b) => b.lastModified - a.lastModified);

      // Deduplicate sessions with identical content (keeps newest of each)
      const dedupedSessions = this.deduplicateSessions(matchingSessions);

      // Filter out sessions where user made no changes (current === baseline)
      // This catches sessions where user loaded but didn't edit, regardless of
      // minor whitespace differences between ZIP original and stored baseline
      const sessionsWithChanges = dedupedSessions.filter((session) => {
        const current = session.data?.current || "";
        const baseline = session.data?.baseline || "";

        // If no baseline stored, keep the session (older format)
        if (!baseline) return true;

        // Filter out if current equals baseline (no user edits made)
        return current !== baseline;
      });

      const filteredCount = dedupedSessions.length - sessionsWithChanges.length;

      logInfo(
        `Found ${sessionsWithChanges.length} localStorage session(s) with actual changes` +
          (filteredCount > 0
            ? ` (filtered ${filteredCount} with no edits)`
            : "") +
          (dedupedSessions.length !== matchingSessions.length
            ? ` (${matchingSessions.length} total before deduplication)`
            : ""),
      );
      return sessionsWithChanges;
    } catch (error) {
      logWarn("Error checking for matching sessions:", error);
      return [];
    }
  }

  /**
   * Remove duplicate sessions with identical content
   * Keeps sessions with actual edit value when duplicates are found
   * Prefers: 1) Sessions with user edits (current !== baseline)
   *          2) Legacy sessions without baseline (have real edit history)
   *          3) Newest session as fallback
   * @param {Array} sessions - Array of sessions sorted by lastModified (newest first)
   * @returns {Array} Deduplicated sessions array
   * @private
   */
  deduplicateSessions(sessions) {
    if (!sessions || sessions.length <= 1) return sessions;

    // Group sessions by their current content
    const contentGroups = new Map();

    for (const session of sessions) {
      const content = session.data?.current || "";

      if (!contentGroups.has(content)) {
        contentGroups.set(content, []);
      }
      contentGroups.get(content).push(session);
    }

    const uniqueSessions = [];

    // For each group of sessions with identical content, pick the best one
    for (const [content, group] of contentGroups) {
      if (group.length === 1) {
        uniqueSessions.push(group[0]);
        continue;
      }

      // Score each session - higher is better
      const scored = group.map((session) => {
        const hasBaseline = !!session.data?.baseline;
        const baseline = session.data?.baseline || "";
        const current = session.data?.current || "";
        const hasUserEdits = hasBaseline && baseline !== current;
        const isLegacyWithEdits = !hasBaseline; // Legacy sessions without baseline have real edits

        let score = 0;
        if (hasUserEdits)
          score = 3; // Best: has baseline and user made changes
        else if (isLegacyWithEdits)
          score = 2; // Good: legacy session with edit history
        else if (hasBaseline) score = 1; // OK: has baseline but no changes yet
        // else score = 0: no baseline, probably broken

        return { session, score };
      });

      // Sort by score (descending), then by lastModified (newest first) as tiebreaker
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.session.lastModified || 0) - (a.session.lastModified || 0);
      });

      // Keep the best session from this group
      uniqueSessions.push(scored[0].session);

      logDebug(
        `Deduplicated ${group.length} sessions with identical content, ` +
          `kept session with score ${scored[0].score}`,
      );
    }

    const removedCount = sessions.length - uniqueSessions.length;
    if (removedCount > 0) {
      logDebug(
        `Deduplicated sessions: removed ${removedCount} duplicate(s), ` +
          `keeping ${uniqueSessions.length} unique version(s)`,
      );
    }

    // Re-sort by lastModified (newest first) since Map iteration order doesn't preserve timestamp sort
    uniqueSessions.sort(
      (a, b) => (b.lastModified || 0) - (a.lastModified || 0),
    );

    return uniqueSessions;
  }

  /**
   * Show banner offering to restore localStorage edits over ZIP contents
   * Lists all matching sessions for user to choose from
   * @param {Array} sessions - Array of matching sessions (sorted newest first)
   * @param {Function} onRestore - Callback when user chooses to restore (receives sessionInfo)
   * @param {Function} onDismiss - Callback when user dismisses
   * @param {Object} [options] - Display options
   * @param {boolean} [options.isReshow=false] - Whether this is being reshown after a restore
   * @param {number} [options.currentSessionIndex=null] - Index of currently loaded session
   * @private
   */
  showSessionRecoveryBanner(sessions, onRestore, onDismiss, options = {}) {
    const { isReshow = false, currentSessionIndex = null } = options;

    // DEBUG: Log what we received
    console.log("[DEBUG] showSessionRecoveryBanner called:", {
      sessionCount: sessions?.length,
      isReshow,
      currentSessionIndex,
      options,
    });

    // Remove any existing banner first
    const existingBanner = document.getElementById("resume-session-banner");
    if (existingBanner) {
      existingBanner.remove();
    }

    // Create banner
    const banner = document.createElement("div");
    banner.id = "resume-session-banner";
    banner.className = "resume-session-banner";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-labelledby", "resume-session-banner-title");

    // Get ZIP edits from parseResult
    const zipEdits = this.parseResult?.edits?.files || [];
    const originalMMD = this.restoredSession?.originalMMD || "";

    // Build unified versions array for display
    // Index scheme: 0+ for localStorage, -1 for ZIP original, -2-N for ZIP edits

    // Find the globally most recent timestamp across all sources
    const allTimestamps = [];

    // Collect localStorage timestamps
    sessions.forEach((session, index) => {
      if (session.lastModified) {
        allTimestamps.push({
          source: "localStorage",
          index: index,
          timestamp: new Date(session.lastModified).getTime(),
        });
      }
    });

    // Collect ZIP edit timestamps
    zipEdits.forEach((edit, index) => {
      if (edit.timestamp) {
        allTimestamps.push({
          source: "zipEdit",
          index: -2 - index, // Match the index scheme used later
          timestamp: new Date(edit.timestamp).getTime(),
        });
      }
    });

    // Find the most recent
    const mostRecentItem =
      allTimestamps.length > 0
        ? allTimestamps.reduce((newest, current) =>
            current.timestamp > newest.timestamp ? current : newest,
          )
        : null;

    logDebug("Most recent item across all sources:", mostRecentItem);

    // Generate localStorage session options HTML
    const localStorageOptionsHTML = sessions
      .map((session, index) => {
        const date = new Date(session.lastModified);
        const isoDateTime = date.toISOString();
        const dateStr = date.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const timeStr = date.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const sizeKB = Math.round((session.contentLength / 1024) * 10) / 10;
        const isNewest =
          mostRecentItem?.source === "localStorage" &&
          mostRecentItem?.index === index;
        const isCurrent = index === currentSessionIndex;

        // Use baseline for preview comparison (shows user's actual edits)
        // Fall back to original if baseline not available
        const comparisonContent = session.data?.baseline || originalMMD;
        const diffResult = this.computeDiff(
          session.data?.current,
          comparisonContent,
        );
        const previewHTML = `<span class="resume-session-preview">${this.renderDiffPreview(
          diffResult,
        )}</span>`;

        return `
        <label class="resume-session-option resume-session-option-localstorage ${
          isNewest ? "resume-session-option-newest" : ""
        } ${isCurrent ? "resume-session-option-current" : ""}">
          <input type="radio" name="resume-session-choice" value="${index}" ${
            isNewest && currentSessionIndex === null ? "checked" : ""
          } ${isCurrent ? "checked" : ""}>
          <span class="resume-session-option-content">
<time class="resume-session-option-date" datetime="${isoDateTime}">
              <span class="resume-session-source-icon">${getIcon("disk")}</span>
              <span class="visually-hidden">Browser storage: </span>
              ${this.escapeHtml(dateStr)} at ${this.escapeHtml(timeStr)}
            </time>
            ${
              isNewest
                ? '<strong class="resume-session-badge">Most Recent</strong>'
                : ""
            }
            ${
              isCurrent
                ? '<strong class="resume-session-badge resume-session-badge-current">Currently Loaded</strong>'
                : ""
            }
            ${previewHTML}
            <span class="resume-session-option-size">${sizeKB} KB</span>
          </span>
        </label>
      `;
      })
      .join("");

    // Generate ZIP edits options HTML (index -2, -3, etc.)
    const zipEditsOptionsHTML = zipEdits
      .map((edit, index) => {
        const editIndex = -2 - index; // -2, -3, -4, etc.
        const date = edit.timestamp ? new Date(edit.timestamp) : null;
        const isoDateTime = date ? date.toISOString() : "";
        const dateStr = date
          ? date.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "Unknown date";
        const timeStr = date
          ? date.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        const sizeKB = edit.content
          ? Math.round((edit.content.length / 1024) * 10) / 10
          : 0;
        const isCurrent = editIndex === currentSessionIndex;

        // Preview shows difference from original ZIP results
        const diffResult = this.computeDiff(edit.content, originalMMD);
        const previewHTML = `<span class="resume-session-preview">${this.renderDiffPreview(
          diffResult,
        )}</span>`;

        // Build date/time display with semantic <time> element when date is available
        const dateTimeDisplay = date
          ? `<time class="resume-session-option-date" datetime="${isoDateTime}">${getIcon(
              "pencil",
            )} ZIP Edit: ${this.escapeHtml(dateStr)}${
              timeStr ? ` at ${this.escapeHtml(timeStr)}` : ""
            }</time>`
          : `<span class="resume-session-option-date">${getIcon(
              "pencil",
            )} ZIP Edit: ${this.escapeHtml(dateStr)}</span>`;

        // Check if this ZIP edit is the globally most recent
        const isNewest =
          mostRecentItem?.source === "zipEdit" &&
          mostRecentItem?.index === editIndex;

        return `
        <label class="resume-session-option resume-session-option-zip-edit ${
          isCurrent ? "resume-session-option-current" : ""
        } ${isNewest ? "resume-session-option-newest" : ""}">
          <input type="radio" name="resume-session-choice" value="${editIndex}" ${
            isCurrent ? "checked" : ""
          }>
          <span class="resume-session-option-content">
            ${dateTimeDisplay}
            ${
              isNewest
                ? '<strong class="resume-session-badge">Most Recent</strong>'
                : ""
            }
            ${
              isCurrent
                ? '<strong class="resume-session-badge resume-session-badge-current">Currently Loaded</strong>'
                : ""
            }
            ${previewHTML}
            <span class="resume-session-option-size">${sizeKB} KB</span>
          </span>
        </label>
      `;
      })
      .join("");

    // Add ZIP original option with content preview
    const zipPreview = this.getContentPreview(originalMMD);
    // Preview text is already descriptive, aria-label was redundant
    const zipOriginalOptionHTML = `
      <label class="resume-session-option resume-session-option-zip ${
        currentSessionIndex === -1 ? "resume-session-option-current" : ""
      }">
        <input type="radio" name="resume-session-choice" value="-1" ${
          currentSessionIndex === -1 ? "checked" : ""
        }>
<span class="resume-session-option-content">
          <span class="resume-session-option-date">
            ${getIcon("box")} ZIP Original (Results)
          </span>
          ${
            currentSessionIndex === -1
              ? '<strong class="resume-session-badge resume-session-badge-current">Currently Loaded</strong>'
              : ""
          }
          <span class="resume-session-preview">${getIcon(
            "document",
          )} ${this.escapeHtml(zipPreview)}</span>
          <span class="resume-session-option-size">Original</span>
        </span>
      </label>
    `;

    // Build the complete options HTML
    const hasLocalStorage = sessions && sessions.length > 0;
    const hasZipEdits = zipEdits.length > 0;

    let optionsHTML = "";

    // localStorage sessions first (if any)
    if (hasLocalStorage) {
      optionsHTML += localStorageOptionsHTML;
    }

    // ZIP edits section (if any)
    if (hasZipEdits) {
      if (hasLocalStorage) {
        optionsHTML += `
          <div class="resume-session-options-divider">
            <span>or use ZIP saved edit${zipEdits.length > 1 ? "s" : ""}</span>
          </div>
        `;
      }
      optionsHTML += zipEditsOptionsHTML;
    }

    // ZIP original always at bottom
    optionsHTML += `
      <div class="resume-session-options-divider">
        <span>or use original</span>
      </div>
    `;
    optionsHTML += zipOriginalOptionHTML;

    const totalVersions = (sessions?.length || 0) + zipEdits.length + 1;
    const titleText = isReshow ? "Switch Version" : "Unsaved Edits Found";
    const messageText = isReshow
      ? `You can switch between ${totalVersions} available version${
          totalVersions > 1 ? "s" : ""
        }.`
      : `Found previous edits for this document. Would you like to restore one?`;

    banner.innerHTML = `
      <div class="resume-session-banner-header">
        <h3 id="resume-session-banner-title">
          ${isReshow ? getIcon("refresh") : getIcon("disk")} ${titleText}
        </h3>
        <button type="button" 
                id="resume-session-close-btn" 
                class="resume-session-close-btn"
                aria-label="Close version selector">
          ${getIcon("close")}
        </button>
      </div>
      
      <p id="resume-session-banner-message">${messageText}</p>
      
      <fieldset class="resume-session-options">
        <legend class="visually-hidden">Select a version to load</legend>
        ${optionsHTML}
      </fieldset>
      
      <div class="resume-session-banner-actions">
        <button type="button" id="resume-session-restore-btn" class="resume-btn resume-btn-primary">
          ${getIcon("returnArrow")} Load Selected
        </button>
        <button type="button" id="resume-session-close-action-btn" class="resume-btn resume-btn-secondary">
          Cancel
        </button>
      </div>
    `;

    // Insert at top of working area
    if (this.elements.workingArea) {
      this.elements.workingArea.insertBefore(
        banner,
        this.elements.workingArea.firstChild,
      );
    }

    // Store references for restore action
    this._recoverySessions = sessions;
    this._zipEdits = zipEdits;
    this._currentSessionIndex = currentSessionIndex;

    // Add event listeners
    document
      .getElementById("resume-session-restore-btn")
      ?.addEventListener("click", () => {
        const selectedIndex = this.getSelectedSessionIndex();

        if (selectedIndex === -1) {
          // User chose ZIP original (results folder)
          banner.remove();
          this.loadZIPContents();
          this._currentSessionIndex = -1;
        } else if (selectedIndex <= -2) {
          // User chose a ZIP edit (index -2, -3, etc.)
          const editIndex = Math.abs(selectedIndex) - 2; // Convert -2 to 0, -3 to 1, etc.
          const zipEdit = this._zipEdits?.[editIndex];
          if (zipEdit) {
            banner.remove();
            this.loadZIPEdit(zipEdit);
            this._currentSessionIndex = selectedIndex;
          }
        } else if (
          selectedIndex !== null &&
          selectedIndex >= 0 &&
          this._recoverySessions[selectedIndex]
        ) {
          // User chose a localStorage session
          const selected = this._recoverySessions[selectedIndex];
          banner.remove();
          this._currentSessionIndex = selectedIndex;
          if (onRestore) onRestore({ key: selected.key, data: selected.data });
        }

        // Show the switch button after loading
        this.showSwitchVersionButton();
      });

    document
      .getElementById("resume-session-close-btn")
      ?.addEventListener("click", () => {
        banner.remove();
        // Show switch button so user can reopen
        if (isReshow || this._currentSessionIndex !== null) {
          this.showSwitchVersionButton();
        }
      });

    document
      .getElementById("resume-session-close-action-btn")
      ?.addEventListener("click", () => {
        banner.remove();
        // Show switch button so user can reopen
        if (isReshow || this._currentSessionIndex !== null) {
          this.showSwitchVersionButton();
        }
        if (!isReshow && onDismiss) onDismiss();
      });

    // Hide switch button while banner is open
    this.hideSwitchVersionButton();

    logInfo("Session recovery banner shown with", sessions.length, "options");
  }

  /**
   * Show an informational banner after auto-restoring the most recent localStorage session
   * This replaces the selection banner when auto-restore is enabled
   *
   * @param {Object} restoredSession - The session that was auto-restored
   * @param {number} restoredSession.lastModified - Timestamp of the restored session
   * @param {string} restoredSession.key - Storage key of the restored session
   * @param {Object} restoredSession.data - Session data
   * @private
   */
  showAutoRestoredBanner(restoredSession) {
    logDebug("Showing auto-restored banner for session:", restoredSession?.key);

    // Remove any existing banners first
    const existingBanner = document.getElementById("resume-session-banner");
    if (existingBanner) {
      existingBanner.remove();
    }
    const existingAutoBanner = document.getElementById(
      "resume-auto-restored-banner",
    );
    if (existingAutoBanner) {
      existingAutoBanner.remove();
    }

    // Format the restoration date/time
    const restoredDate = new Date(restoredSession.lastModified);
    const isoDateTime = restoredDate.toISOString();
    const dateStr = restoredDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timeStr = restoredDate.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Create the banner element
    const banner = document.createElement("div");
    banner.id = "resume-auto-restored-banner";
    banner.className = "resume-auto-restored-banner";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    banner.setAttribute("aria-labelledby", "resume-auto-restored-title");

    banner.innerHTML = `
    <div class="resume-auto-restored-header">
      <h3 id="resume-auto-restored-title">
        ${getIcon("disk")} Restored from Browser Storage
      </h3>
      <button type="button" 
              id="resume-auto-restored-close-btn" 
              class="resume-session-close-btn"
              aria-label="Dismiss restoration notice">
        ${getIcon("close")}
      </button>
    </div>
    
    <p id="resume-auto-restored-message">
      Your most recent edit 
      (<time datetime="${isoDateTime}">${this.escapeHtml(
        dateStr,
      )} at ${this.escapeHtml(timeStr)}</time>) 
      was automatically loaded. Browser storage is temporary — download a ZIP 
      to save your work permanently.
    </p>
    
    <div class="resume-auto-restored-actions">
      <button type="button" 
              id="resume-auto-restored-download-btn" 
              class="resume-btn resume-btn-primary">
        ${getIcon("box")} Download ZIP
      </button>
      <button type="button" 
              id="resume-auto-restored-switch-btn" 
              class="resume-btn resume-btn-secondary">
        ${getIcon("refresh")} Switch Version
      </button>
      <button type="button" 
              id="resume-auto-restored-dismiss-btn" 
              class="resume-btn resume-btn-tertiary">
        Dismiss
      </button>
    </div>
  `;

    // Insert at top of working area
    if (this.elements.workingArea) {
      this.elements.workingArea.insertBefore(
        banner,
        this.elements.workingArea.firstChild,
      );
    }

    // Set up event listeners
    this.setupAutoRestoredBannerListeners(banner);

    // Announce to screen readers
    this.announceToScreenReader(
      `Your edit from ${dateStr} at ${timeStr} was automatically restored from browser storage.`,
    );

    logInfo("Auto-restored banner shown for session from:", dateStr, timeStr);
  }

  /**
   * Set up event listeners for the auto-restored banner buttons
   * @param {HTMLElement} banner - The banner element
   * @private
   */
  setupAutoRestoredBannerListeners(banner) {
    // Download ZIP button
    const downloadBtn = document.getElementById(
      "resume-auto-restored-download-btn",
    );
    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => {
        logDebug("Download ZIP clicked from auto-restored banner");
        this.triggerDownloadZIP();
      });
    }

    // Switch Version button
    const switchBtn = document.getElementById(
      "resume-auto-restored-switch-btn",
    );
    if (switchBtn) {
      switchBtn.addEventListener("click", () => {
        logDebug("Switch Version clicked from auto-restored banner");
        banner.remove();
        this.reshowSessionSelector();
      });
    }

    // Dismiss button
    const dismissBtn = document.getElementById(
      "resume-auto-restored-dismiss-btn",
    );
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        logDebug("Dismiss clicked on auto-restored banner");
        this.dismissAutoRestoredBanner(banner);
      });
    }

    // Close (X) button
    const closeBtn = document.getElementById("resume-auto-restored-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        logDebug("Close clicked on auto-restored banner");
        this.dismissAutoRestoredBanner(banner);
      });
    }
  }

  /**
   * Dismiss the auto-restored banner and show the Switch Version button
   * @param {HTMLElement} banner - The banner element to remove
   * @private
   */
  dismissAutoRestoredBanner(banner) {
    banner.remove();
    // Show the Switch Version button so user can still access version switching
    this.showSwitchVersionButton();
  }

  /**
   * Trigger the Download ZIP functionality
   * Uses the existing Total Downloader if available
   * @private
   */
  triggerDownloadZIP() {
    // Try to get the Total Downloader instance
    const downloader = window.getMathPixTotalDownloader?.();

    if (downloader && typeof downloader.downloadAll === "function") {
      // Use the Total Downloader
      downloader.downloadAll();
    } else if (this.elements.downloadAllBtn) {
      // Fall back to clicking the download button
      this.elements.downloadAllBtn.click();
    } else {
      logWarn("Download ZIP not available - no downloader or button found");
      this.showNotification(
        "Download is not available at this time. Please try again later.",
        "warning",
      );
    }
  }

  /**
   * Announce a message to screen readers via a live region
   * @param {string} message - Message to announce
   * @private
   */
  announceToScreenReader(message) {
    // Check if we have an existing announcer element
    let announcer = document.getElementById("resume-sr-announcer");

    if (!announcer) {
      // Create a new announcer element
      announcer = document.createElement("div");
      announcer.id = "resume-sr-announcer";
      announcer.className = "visually-hidden";
      announcer.setAttribute("role", "status");
      announcer.setAttribute("aria-live", "polite");
      announcer.setAttribute("aria-atomic", "true");
      document.body.appendChild(announcer);
    }

    // Clear and set new message (timing helps screen readers detect change)
    announcer.textContent = "";
    setTimeout(() => {
      announcer.textContent = message;
    }, 100);
  }

  /**
   * Load the original ZIP contents (discard localStorage version)
   * @private
   */
  loadZIPContents() {
    logInfo("Loading original ZIP contents (results folder)");

    const originalMMD = this.restoredSession?.originalMMD;

    if (originalMMD) {
      this.loadMMDContent(originalMMD, originalMMD);
      this.restoredSession.currentMMD = originalMMD;
      this.restoredSession.baselineMMD = originalMMD;
      this.updateSessionStatus("saved");
      this.hasUnsavedChanges = false;
      this.showNotification("Loaded original ZIP contents", "success");
    }
  }

  /**
   * Load a specific ZIP edit
   * @param {Object} zipEdit - ZIP edit object with content and metadata
   * @private
   */
  loadZIPEdit(zipEdit) {
    logInfo("Loading ZIP edit:", zipEdit.filename || "unknown");

    const originalMMD = this.restoredSession?.originalMMD;
    const editContent = zipEdit.content;

    if (editContent) {
      this.loadMMDContent(editContent, originalMMD);
      this.restoredSession.currentMMD = editContent;
      this.restoredSession.baselineMMD = editContent;
      this.restoredSession.selectedEdit = zipEdit;
      this.updateSessionStatus("saved");
      this.hasUnsavedChanges = false;

      const dateStr = zipEdit.timestamp
        ? new Date(zipEdit.timestamp).toLocaleString("en-GB")
        : "unknown date";
      this.showNotification(`Loaded ZIP edit from ${dateStr}`, "success");
    }
  }

  /**
   * Show the "Switch Version" button near session controls
   * @private
   */
  showSwitchVersionButton() {
    // Check if button already exists
    let switchBtn = document.getElementById("resume-switch-version-btn");

    if (!switchBtn) {
      // Find a suitable container - prefer the header area with New Session button
      const newSessionBtn = this.elements.newSessionBtn;
      const container =
        newSessionBtn?.parentElement || this.elements.workingArea;

      if (!container) {
        logWarn("Cannot show switch version button - no container found");
        return;
      }

      // Create the button
      switchBtn = document.createElement("button");
      switchBtn.type = "button";
      switchBtn.id = "resume-switch-version-btn";
      switchBtn.className =
        "resume-btn resume-btn-secondary resume-switch-version-btn";
      switchBtn.innerHTML = `${getIcon("refresh")} Switch Version`;
      switchBtn.title = "Switch to a different saved version";

      switchBtn.addEventListener("click", () => this.reshowSessionSelector());

      // Insert before the New Session button if possible, otherwise at start of container
      if (newSessionBtn && newSessionBtn.parentElement === container) {
        container.insertBefore(switchBtn, newSessionBtn);
      } else {
        container.insertBefore(switchBtn, container.firstChild);
      }

      logDebug("Switch version button created");
    }

    // DEFENSIVE: Ensure button is truly visible
    switchBtn.hidden = false;
    switchBtn.style.display = ""; // Clear any inline display:none
    switchBtn.removeAttribute("aria-hidden");

    logDebug("Switch version button shown", {
      hidden: switchBtn.hidden,
      display: getComputedStyle(switchBtn).display,
    });
  }

  /**
   * Hide the "Switch Version" button
   * @private
   */
  hideSwitchVersionButton() {
    const switchBtn = document.getElementById("resume-switch-version-btn");
    if (switchBtn) {
      switchBtn.hidden = true;
    }
  }

  /**
   * Reshow the session selector banner
   * @private
   */
  reshowSessionSelector() {
    const sourceFilename = this.restoredSession?.source?.filename;
    if (!sourceFilename) {
      logWarn("Cannot reshow session selector - no source filename");
      return;
    }

    // Get all matching sessions (not just newer ones)
    const allSessions = this.checkForMatchingSessions(sourceFilename);

    // Filter to only sessions with actual user edits (current !== baseline)
    const sessionsWithEdits = allSessions.filter((session) => {
      const baseline = session.data?.baseline || session.data?.original;
      const current = session.data?.current;
      return baseline !== current;
    });

    logDebug("Session filtering:", {
      total: allSessions.length,
      withEdits: sessionsWithEdits.length,
    });

    // Check if there's anything to switch to
    const zipEdits = this.parseResult?.edits?.files || [];
    const hasZipOptions = zipEdits.length > 0; // Has ZIP edits besides original

    if (sessionsWithEdits.length === 0 && !hasZipOptions) {
      this.showNotification("No alternative versions available", "info");
      return;
    }

    // Store sessions reference for validation (use filtered list)
    this._recoverySessions = sessionsWithEdits;

    // DEFENSIVE: Validate _currentSessionIndex against actual content
    const actualVersion = this.getCurrentVersionType();
    if (actualVersion.index !== this._currentSessionIndex) {
      logWarn(
        `Index mismatch in reshowSessionSelector: stored=${this._currentSessionIndex}, actual=${actualVersion.index}`,
      );
      this._currentSessionIndex = actualVersion.index;
    }

    logDebug("Reshowing session selector", {
      sessionCount: allSessions.length,
      currentIndex: this._currentSessionIndex,
      versionType: actualVersion.type,
    });

    // Show banner with validated current selection
    this.showSessionRecoveryBanner(
      sessionsWithEdits,
      (sessionInfo) => this.applyRecoveredSession(sessionInfo),
      () => logDebug("Session selector closed"),
      {
        isReshow: true,
        currentSessionIndex: this._currentSessionIndex,
      },
    );
  }

  /**
   * Get the index of the selected session from radio buttons
   * @returns {number|null} Selected index or null
   * @private
   */
  getSelectedSessionIndex() {
    const selected = document.querySelector(
      'input[name="resume-session-choice"]:checked',
    );
    if (selected) {
      return parseInt(selected.value, 10);
    }
    return null;
  }

  /**
   * Clear multiple stored sessions from localStorage
   * @param {Array} sessions - Sessions to clear
   * @private
   */
  clearMatchingSessions(sessions) {
    sessions.forEach((session) => {
      try {
        localStorage.removeItem(session.key);
        logDebug("Cleared stored session:", session.key);
      } catch (error) {
        logWarn("Failed to clear stored session:", session.key, error);
      }
    });
  }

  /**
   * Clear a stored session from localStorage
   * @param {string} key - Session storage key
   * @private
   */
  clearStoredSession(key) {
    try {
      localStorage.removeItem(key);
      logDebug("Cleared stored session:", key);
    } catch (error) {
      logWarn("Failed to clear stored session:", error);
    }
  }

  /**
   * Apply recovered localStorage edits to current session
   * @param {Object} sessionInfo - Session info with recovered data
   * @private
   */
  applyRecoveredSession(sessionInfo) {
    logInfo("Applying recovered session edits");

    const data = sessionInfo.data;

    // Update current session with recovered edits
    if (this.restoredSession && data.current) {
      this.restoredSession.currentMMD = data.current;
      this.restoredSession.loadedFromKey = sessionInfo.key;

      // Copy undo/redo stacks if present
      this.undoStack = data.undoStack || [];
      this.redoStack = data.redoStack || [];

      // Load the recovered content into UI
      this.loadMMDContent(data.current, this.restoredSession.originalMMD);

      // Update UI state
      this.updateUndoRedoButtons();
      this.updateSessionStatus("saved");
      this.hasUnsavedChanges = false;

      // Show the switch version button
      this.showSwitchVersionButton();

      const date = new Date(data.lastModified).toLocaleString();
      this.showNotification(`Loaded version from ${date}`, "success");
    }
  }

  /**
   * Hide the resume mode interface
   */
  hide() {
    logDebug("Hiding resume mode");

    if (this.elements.container) {
      this.elements.container.style.display = "none";
    }
  }

  // =========================================================================
  // DRAG AND DROP HANDLING
  // =========================================================================

  /**
   * Handle dragover event
   * @param {DragEvent} e - Drag event
   * @private
   */
  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    this.elements.dropZone?.classList.add("drag-over");
  }

  /**
   * Handle dragleave event
   * @param {DragEvent} e - Drag event
   * @private
   */
  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    this.elements.dropZone?.classList.remove("drag-over");
  }

  /**
   * Handle drop event
   * @param {DragEvent} e - Drop event
   * @private
   */
  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.elements.dropZone?.classList.remove("drag-over");

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleZIPFile(files[0]);
    }
  }

  /**
   * Trigger file input click
   * @private
   */
  triggerFileSelect() {
    this.elements.fileInput?.click();
  }

  /**
   * Handle file input selection
   * @param {Event} e - Change event
   * @private
   */
  handleFileSelect(e) {
    const files = e.target?.files;
    if (files && files.length > 0) {
      this.handleZIPFile(files[0]);
    }
    // Reset input so same file can be selected again
    if (this.elements.fileInput) {
      this.elements.fileInput.value = "";
    }
  }

  // =========================================================================
  // ZIP FILE HANDLING
  // =========================================================================

  /**
   * Handle ZIP file selection/drop
   * @param {File} file - ZIP file
   */
  async handleZIPFile(file) {
    logInfo("Processing ZIP file:", file.name);

    // Validate file type
    if (!this.validateZIPFile(file)) {
      this.displayValidationMessages({
        errors: ["Please select a valid ZIP archive file (.zip)"],
        warnings: [],
      });
      return;
    }

    // Ensure parser is available
    if (!this.parser) {
      this.parser = window.getMathPixZIPParser?.();
      if (!this.parser) {
        this.displayValidationMessages({
          errors: ["ZIP parser not available. Please refresh the page."],
          warnings: [],
        });
        return;
      }
    }

    // Show loading state
    this.showLoadingState();

    try {
      // Parse ZIP file
      const parseResult = await this.parser.parse(file);
      logDebug("Parse result:", parseResult);

      // Store parse result
      this.parseResult = parseResult;

      // Hide loading state
      this.hideLoadingState();

      // Display errors/warnings
      if (parseResult.errors.length > 0 || parseResult.warnings.length > 0) {
        this.displayValidationMessages({
          errors: parseResult.errors,
          warnings: parseResult.warnings,
        });
      }

      // Check if valid
      if (!parseResult.valid) {
        logWarn("ZIP archive validation failed");
        return;
      }

      // Clear validation messages for valid ZIP
      this.clearValidationMessages();

      // Check for multiple edits and ambiguity
      if (parseResult.edits.hasEdits && parseResult.edits.files.length > 1) {
        // Check if any edits are ambiguous (don't match source pattern)
        const sourceFilename = parseResult.source?.filename || "";
        const hasAmbiguity = this.hasAmbiguousEdits(
          parseResult.edits.files,
          sourceFilename,
        );

        if (hasAmbiguity) {
          // Genuine ambiguity - user must choose
          logInfo("Ambiguous edits found, showing selection dialog");
          this.showEditSelectionDialog(parseResult.edits.files);
        } else {
          // All edits match source pattern - auto-restore most recent
          // User can access older versions via "Switch Version" button
          logInfo(
            "Multiple edits found, all match source - auto-restoring most recent",
          );
          const selectedEdit = parseResult.edits.mostRecent || null;
          await this.restoreSession(parseResult, selectedEdit);
        }
      } else {
        // Single edit or no edits - proceed directly
        const selectedEdit = parseResult.edits.mostRecent || null;
        await this.restoreSession(parseResult, selectedEdit);
      }
    } catch (error) {
      logError("Failed to parse ZIP:", error);
      this.hideLoadingState();
      this.displayValidationMessages({
        errors: [`Failed to parse ZIP archive: ${error.message}`],
        warnings: [],
      });
    }
  }

  /**
   * Validate file is a ZIP
   * @param {File} file - File to validate
   * @returns {boolean} True if valid ZIP file
   */
  validateZIPFile(file) {
    if (!file) return false;

    const validTypes = RESTORER_CONFIG.VALID_ZIP_TYPES;
    const validExtension = file.name.toLowerCase().endsWith(".zip");

    return validTypes.includes(file.type) || validExtension;
  }

  /**
   * Show loading state during ZIP parsing
   * @private
   */
  showLoadingState() {
    if (this.elements.dropZone) {
      this.elements.dropZone.innerHTML = `
        <div class="resume-loading-state">
          <div class="resume-loading-spinner" aria-hidden="true"></div>
          <p class="resume-loading-text">${RESTORER_CONFIG.MESSAGES.LOADING}</p>
        </div>
      `;
      this.elements.dropZone.setAttribute("aria-busy", "true");
    }
  }

  /**
   * Hide loading state and restore drop zone
   * @private
   */
  hideLoadingState() {
    if (this.elements.dropZone) {
      this.elements.dropZone.innerHTML = `
        <div class="drop-zone-content">
          <svg aria-hidden="true" class="drop-zone-icon" viewBox="0 0 48 48" width="48" height="48">
            <path fill="currentColor" d="M40 12H22l-4-4H8c-2.21 0-4 1.79-4 4v24c0 2.21 1.79 4 4 4h32c2.21 0 4-1.79 4-4V16c0-2.21-1.79-4-4-4z"/>
          </svg>
          <p class="drop-zone-text">
            <strong>${RESTORER_CONFIG.MESSAGES.DROP_HINT}</strong>
            <span>${RESTORER_CONFIG.MESSAGES.ACCEPTED_FILES}</span>
          </p>
        </div>
      `;
      this.elements.dropZone.removeAttribute("aria-busy");
    }
  }

  // =========================================================================
  // VALIDATION MESSAGES
  // =========================================================================

  /**
   * Display validation errors/warnings
   * @param {Object} messages - Object with errors and warnings arrays
   * @private
   */
  displayValidationMessages(messages) {
    const container = this.elements.validationMessages;
    if (!container) return;

    const { errors = [], warnings = [] } = messages;

    if (errors.length === 0 && warnings.length === 0) {
      this.clearValidationMessages();
      return;
    }

    let html = "";

    // Add errors
    errors.forEach((error) => {
      html += `<div class="resume-validation-error" role="alert">${this.escapeHtml(
        error,
      )}</div>`;
    });

    // Add warnings
    warnings.forEach((warning) => {
      html += `<div class="resume-validation-warning">${this.escapeHtml(
        warning,
      )}</div>`;
    });

    container.innerHTML = html;
    container.hidden = false;

    // Set appropriate class
    container.classList.remove("has-errors", "has-warnings");
    if (errors.length > 0) {
      container.classList.add("has-errors");
    } else if (warnings.length > 0) {
      container.classList.add("has-warnings");
    }
  }

  /**
   * Clear validation messages
   * @private
   */
  clearValidationMessages() {
    if (this.elements.validationMessages) {
      this.elements.validationMessages.innerHTML = "";
      this.elements.validationMessages.hidden = true;
      this.elements.validationMessages.classList.remove(
        "has-errors",
        "has-warnings",
      );
    }
  }

  // =========================================================================
  // CONTENT PREVIEW (for session selection UI)
  // =========================================================================

  /**
   * Extract a meaningful preview snippet from MMD content
   * @param {string} content - MMD content
   * @param {string} [original] - Original content for diff comparison
   * @returns {string} Preview snippet (max 50 chars)
   */
  getContentPreview(content, original = null) {
    if (!content) return "(empty)";

    // If we have original, try to find and show the first difference
    if (original && content !== original) {
      const diffSnippet = this.findFirstDifference(content, original);
      if (diffSnippet) {
        return this.truncatePreview(diffSnippet, 50);
      }
    }

    // Fallback: show first non-empty line
    const lines = content.split("\n").filter((l) => l.trim());
    const firstLine = lines[0] || content.substring(0, 50);
    return this.truncatePreview(firstLine, 50);
  }

  /**
   * Find the first meaningful difference between two strings
   * @param {string} current - Current content
   * @param {string} original - Original content
   * @returns {string|null} Snippet around first difference
   */
  findFirstDifference(current, original) {
    let diffStart = 0;
    const minLen = Math.min(current.length, original.length);

    // Find first differing character
    while (diffStart < minLen && current[diffStart] === original[diffStart]) {
      diffStart++;
    }

    if (diffStart === current.length && diffStart === original.length) {
      return null; // No difference
    }

    // Get context around the difference
    const contextStart = Math.max(0, diffStart - 10);
    const contextEnd = Math.min(current.length, diffStart + 40);

    return current.substring(contextStart, contextEnd);
  }

  /**
   * Truncate and format preview text
   * @param {string} text - Text to truncate
   * @param {number} maxLen - Maximum length
   * @returns {string} Truncated text with ellipsis if needed
   */
  truncatePreview(text, maxLen) {
    // Clean up whitespace
    const cleaned = text.replace(/\s+/g, " ").trim();

    if (cleaned.length <= maxLen) {
      return `"${cleaned}"`;
    }

    return `"${cleaned.substring(0, maxLen - 3)}..."`;
  }

  /**
   * Compute detailed diff information between current and original content
   * Returns structured data for accessible diff rendering
   * @param {string} current - Current content
   * @param {string} original - Original content to compare against
   * @returns {Object} Diff analysis result
   */
  computeDiff(current, original) {
    // Handle edge cases
    if (!current && !original) {
      return {
        magnitude: "identical",
        changeCount: 0,
        summary: "Empty content",
      };
    }

    if (!original) {
      // No original to compare - show content preview only
      const preview = this.getFirstMeaningfulLine(current);
      return {
        magnitude: "unknown",
        changeCount: 0,
        preview: preview,
        summary: preview,
      };
    }

    if (current === original) {
      return { magnitude: "identical", changeCount: 0, summary: "No changes" };
    }

    // Calculate line-level changes
    const currentLines = (current || "").split("\n");
    const originalLines = (original || "").split("\n");

    const linesAdded = currentLines.filter(
      (line) => line.trim() && !originalLines.includes(line),
    ).length;
    const linesRemoved = originalLines.filter(
      (line) => line.trim() && !currentLines.includes(line),
    ).length;

    // Calculate character-level percentage change
    const maxLen = Math.max(current.length, original.length);
    let diffChars = 0;
    const minLen = Math.min(current.length, original.length);
    for (let i = 0; i < minLen; i++) {
      if (current[i] !== original[i]) diffChars++;
    }
    diffChars += Math.abs(current.length - original.length);
    const percentChanged =
      maxLen > 0 ? Math.round((diffChars / maxLen) * 100) : 0;

    // Determine magnitude
    let magnitude = "minor";
    if (percentChanged > 50) {
      magnitude = "major";
    } else if (percentChanged > 15) {
      magnitude = "moderate";
    }

    // Find first word-level change with context
    const firstChange = this.findFirstWordChange(current, original);

    // Count total changes (simplified: count differing line pairs)
    const changeCount = Math.max(linesAdded, linesRemoved, 1);

    // Build summary string
    let summary = "";
    if (linesAdded > 0 && linesRemoved > 0) {
      if (linesAdded === linesRemoved) {
        // Same number added/removed = lines were modified
        summary = `${linesAdded} line${linesAdded !== 1 ? "s" : ""} changed`;
      } else {
        // Different counts = mix of edits, additions, deletions
        summary = `+${linesAdded}, −${linesRemoved} lines`;
      }
    } else if (linesAdded > 0) {
      summary = `${linesAdded} line${linesAdded !== 1 ? "s" : ""} added`;
    } else if (linesRemoved > 0) {
      summary = `${linesRemoved} line${linesRemoved !== 1 ? "s" : ""} removed`;
    } else {
      summary = `${percentChanged}% changed`;
    }

    return {
      magnitude,
      changeCount,
      linesAdded,
      linesRemoved,
      percentChanged,
      firstChange,
      summary,
    };
  }

  /**
   * Find the first word-level change between two strings
   * Returns context, removed text, and added text
   * @param {string} current - Current content
   * @param {string} original - Original content
   * @returns {Object|null} First change details or null if identical
   */
  findFirstWordChange(current, original) {
    if (!current || !original || current === original) return null;

    // Find first differing character position
    let diffStart = 0;
    const minLen = Math.min(current.length, original.length);
    while (diffStart < minLen && current[diffStart] === original[diffStart]) {
      diffStart++;
    }

    if (diffStart === current.length && diffStart === original.length) {
      return null; // Identical
    }

    // Expand backwards to find word boundary for context
    let contextStart = diffStart;
    while (contextStart > 0 && !/\s/.test(current[contextStart - 1])) {
      contextStart--;
    }
    // Include some leading context (up to ~15 chars or previous whitespace)
    let leadingContext = contextStart;
    let contextChars = 0;
    while (leadingContext > 0 && contextChars < 15) {
      leadingContext--;
      contextChars++;
      if (/\s/.test(current[leadingContext]) && contextChars > 5) break;
    }
    // Adjust to not start mid-word
    while (leadingContext > 0 && !/\s/.test(current[leadingContext])) {
      leadingContext--;
    }
    if (leadingContext > 0) leadingContext++; // Skip the whitespace itself

    // Find end of differing region in both strings
    let currentDiffEnd = diffStart;
    let originalDiffEnd = diffStart;

    // For current: find where it matches original again (simplified)
    // Look for next matching segment
    const lookAhead = 20;
    let foundSync = false;

    for (let i = 1; i <= lookAhead && !foundSync; i++) {
      const currentPos = diffStart + i;
      const searchStr = current.substring(currentPos, currentPos + 5);
      if (searchStr.length >= 3) {
        const originalIdx = original.indexOf(searchStr, diffStart);
        if (originalIdx > diffStart) {
          currentDiffEnd = currentPos;
          originalDiffEnd = originalIdx;
          foundSync = true;
        }
      }
    }

    if (!foundSync) {
      // Couldn't sync - just take reasonable chunks
      currentDiffEnd = Math.min(diffStart + 20, current.length);
      originalDiffEnd = Math.min(diffStart + 20, original.length);
    }

    // Expand to word boundaries
    while (
      currentDiffEnd < current.length &&
      !/\s/.test(current[currentDiffEnd])
    ) {
      currentDiffEnd++;
    }
    while (
      originalDiffEnd < original.length &&
      !/\s/.test(original[originalDiffEnd])
    ) {
      originalDiffEnd++;
    }

    // Extract the pieces
    const contextBefore = current
      .substring(leadingContext, contextStart)
      .trim();
    const removed = original.substring(contextStart, originalDiffEnd).trim();
    const added = current.substring(contextStart, currentDiffEnd).trim();

    // Truncate if too long
    const maxLen = 25;
    const truncate = (str) =>
      str.length > maxLen ? str.substring(0, maxLen - 1) + "…" : str;

    return {
      contextBefore: truncate(contextBefore),
      removed: truncate(removed),
      added: truncate(added),
      isAdditionOnly: !removed && added,
      isDeletionOnly: removed && !added,
    };
  }

  /**
   * Get first meaningful (non-empty, non-whitespace) line from content
   * @param {string} content - Content to extract from
   * @returns {string} First meaningful line, truncated
   */
  getFirstMeaningfulLine(content) {
    if (!content) return "(empty)";
    const lines = content.split("\n").filter((l) => l.trim());
    const firstLine = lines[0] || content.substring(0, 50);
    const cleaned = firstLine.replace(/\s+/g, " ").trim();
    return cleaned.length > 40 ? cleaned.substring(0, 37) + "…" : cleaned;
  }

  /**
   * Render accessible HTML for diff preview
   * @param {Object} diffResult - Result from computeDiff()
   * @returns {string} Accessible HTML string
   */
  renderDiffPreview(diffResult) {
    if (!diffResult) {
      return `<span class="diff-preview-fallback">(unknown)</span>`;
    }

    // Identical content
    if (diffResult.magnitude === "identical") {
      return `
    <span class="diff-preview diff-preview-identical" role="status">
      ${getIcon("check")} No changes from original
    </span>
  `.trim();
    }

    // No original to compare (e.g., ZIP original itself)
    if (diffResult.magnitude === "unknown" && diffResult.preview) {
      return `
    <span class="diff-preview diff-preview-content">
      ${getIcon("document")}
      <span class="diff-preview-text">"${this.escapeHtml(
        diffResult.preview,
      )}"</span>
    </span>
  `.trim();
    }

    // Has specific first change to show - always prefer showing actual diff
    if (diffResult.firstChange) {
      const fc = diffResult.firstChange;

      // Build stats hint - show when we have meaningful line changes
      const hasLineChanges =
        diffResult.linesAdded > 0 || diffResult.linesRemoved > 0;
      const statsHint = hasLineChanges
        ? `<span class="diff-stats-hint">(${this.escapeHtml(
            diffResult.summary,
          )})</span>`
        : "";

      // Addition only
      if (fc.isAdditionOnly) {
        return `
          <span class="diff-preview diff-preview-addition" role="group" aria-label="Content added">
            ${
              fc.contextBefore
                ? `<span class="diff-context">${this.escapeHtml(
                    fc.contextBefore,
                  )} </span>`
                : ""
            }
            <span class="visually-hidden">Added: </span>
            <ins class="diff-added">${this.escapeHtml(fc.added)}</ins>
            ${statsHint}
          </span>
        `.trim();
      }

      // Deletion only
      if (fc.isDeletionOnly) {
        return `
          <span class="diff-preview diff-preview-deletion" role="group" aria-label="Content removed">
            ${
              fc.contextBefore
                ? `<span class="diff-context">${this.escapeHtml(
                    fc.contextBefore,
                  )} </span>`
                : ""
            }
            <span class="visually-hidden">Removed: </span>
            <del class="diff-removed">${this.escapeHtml(fc.removed)}</del>
            ${statsHint}
          </span>
        `.trim();
      }

      // Standard change (removal + addition)
      return `
        <span class="diff-preview diff-preview-change" role="group" aria-label="Content change">
          ${
            fc.contextBefore
              ? `<span class="diff-context">${this.escapeHtml(
                  fc.contextBefore,
                )} </span>`
              : ""
          }
<del class="diff-removed">
            <span class="visually-hidden">was </span>${this.escapeHtml(
              fc.removed,
            )}
          </del>
          <span class="diff-arrow">${getIcon("arrowRight")}</span>
          <span class="visually-hidden">, now </span>
          <ins class="diff-added">${this.escapeHtml(fc.added)}</ins>
          ${statsHint}
        </span>
      `.trim();
    }

    // Fallback to summary with badge
    const badgeClass =
      diffResult.magnitude === "moderate"
        ? "diff-badge-moderate"
        : "diff-badge-minor";

    return `
      <span class="diff-preview diff-preview-summary" role="group" aria-label="Document changes">
        <span class="diff-badge ${badgeClass}">${diffResult.magnitude}</span>
        <span class="diff-stats">${this.escapeHtml(diffResult.summary)}</span>
      </span>
    `.trim();
  }

  /**
   * Escape HTML special characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   * @private
   */
  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // =========================================================================
  // EDIT SELECTION
  // =========================================================================

  /**
   * Show edit selection dialog when multiple edits exist
   * @param {Array} editFiles - Available edit files
   * @private
   */
  showEditSelectionDialog(editFiles) {
    logDebug("Showing edit selection dialog", { count: editFiles.length });

    // Hide upload section
    if (this.elements.uploadSection) {
      this.elements.uploadSection.hidden = true;
    }

    // Generate radio options
    const optionsContainer = this.elements.editOptions;
    if (optionsContainer) {
      // Find the most recent edit (for default selection)
      const mostRecent = this.parseResult?.edits?.mostRecent;
      const mostRecentFilename = mostRecent?.filename;

      // Get original MMD info for the "Load Original" option
      const originalMMD = this.parseResult?.results?.mmd;
      const originalLength = originalMMD?.length || 0;
      const sourceFilename = this.parseResult?.source?.filename || "source";

      let html = "";

      // Add "Load Original" option first
      html += this.generateOriginalOptionHTML(sourceFilename, originalLength);

      // Add separator
      html +=
        '<div class="edit-options-separator" role="separator"><span>Your Edits</span></div>';

      // Classify and add edit files
      editFiles.forEach((editFile, index) => {
        const isDefault = editFile.filename === mostRecentFilename;
        const editType = this.classifyEditFile(editFile, sourceFilename);
        html += this.generateEditOptionHTML(
          editFile,
          index,
          isDefault,
          editType,
        );
      });

      optionsContainer.innerHTML = html;
    }

    // Show dialog
    if (this.elements.editSelection) {
      this.elements.editSelection.hidden = false;

      // Focus the dialog for accessibility
      this.elements.editSelection.focus();
    }
  }

  /**
   * Generate HTML for the "Load Original" option
   * @param {string} sourceFilename - Source filename
   * @param {number} contentLength - Original MMD content length
   * @returns {string} HTML string
   * @private
   */
  generateOriginalOptionHTML(sourceFilename, contentLength) {
    const baseName = sourceFilename.replace(/\.[^/.]+$/, "");
    const sizeInfo =
      contentLength > 0 ? ` (${contentLength.toLocaleString()} chars)` : "";

    return `
    <label class="resume-edit-option resume-edit-option-original">
      <input type="radio" name="resume-edit-choice" value="original">
      <span class="edit-option-content">
        <span class="edit-option-filename">
${getIcon("document")} Original MathPix Output
        </span>
        <span class="edit-option-timestamp">${this.escapeHtml(
          baseName,
        )}${sizeInfo}</span>
        <span class="edit-option-badge edit-option-badge-original">Original</span>
      </span>
    </label>
  `;
  }

  /**
   * Classify an edit file by its origin type
   * @param {Object} editFile - Edit file object
   * @param {string} sourceFilename - Original source filename
   * @returns {string} Edit type: 'imported', 'saved', or 'edit'
   * @private
   */
  classifyEditFile(editFile, sourceFilename) {
    const filename = editFile.filename || "";
    const baseName = sourceFilename.replace(/\.[^/.]+$/, "");

    // Normalise for comparison (replace spaces with dashes, lowercase)
    const normalisedBase = baseName.toLowerCase().replace(/\s+/g, "-");
    const normalisedFilename = filename.toLowerCase();

    // Check for imported pattern: {basename}-imported-{timestamp}.mmd
    // This takes priority over other classifications
    if (/-imported-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.mmd$/i.test(filename)) {
      return "imported";
    }

    // Check if filename starts with the source basename (auto-collected edit)
    if (normalisedFilename.startsWith(normalisedBase)) {
      // But not if it's an imported file (already handled above)
      return "edit";
    }

    // Check if it has a timestamp pattern (saved file)
    const hasTimestamp = /-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}(-\d{2})?\.mmd$/.test(
      filename,
    );

    if (hasTimestamp) {
      return "saved";
    }

    // No timestamp, different name = legacy imported file (without renamed pattern)
    return "imported";
  }

  /**
   * Check if any edit files are ambiguous (don't clearly belong to this session)
   *
   * Ambiguity exists when edit files have names that don't match the source pattern.
   * Files matching the source are: {sourceBasename}-{timestamp}.mmd or {sourceBasename}-imported-{timestamp}.mmd
   *
   * @param {Array<Object>} editFiles - Array of edit file objects
   * @param {string} sourceFilename - Original source filename
   * @returns {boolean} True if there are ambiguous files requiring user selection
   * @private
   */
  hasAmbiguousEdits(editFiles, sourceFilename) {
    if (!editFiles || editFiles.length === 0) {
      return false;
    }

    const baseName = sourceFilename.replace(/\.[^/.]+$/, "");

    // Normalise: lowercase, replace spaces with dashes, collapse multiple dashes
    const normalise = (str) =>
      str.toLowerCase().replace(/\s+/g, "-").replace(/-+/g, "-");
    const normalisedBase = normalise(baseName);

    logDebug("Checking for ambiguous edits:", {
      sourceFilename,
      normalisedBase,
      editCount: editFiles.length,
    });

    for (const editFile of editFiles) {
      const filename = editFile.filename || "";
      const normalisedFilename = normalise(filename);

      // Check if filename starts with normalised source base
      const matchesSource = normalisedFilename.startsWith(normalisedBase);

      if (!matchesSource) {
        logDebug("Ambiguous edit found:", {
          filename,
          normalisedFilename,
          normalisedBase,
          reason: "Does not start with source basename",
        });
        return true; // Found ambiguous file
      }
    }

    logDebug("No ambiguous edits - all files match source pattern");
    return false;
  }

  /**
   * Generate radio option HTML for an edit file
   * @param {Object} editFile - Edit file object
   * @param {number} index - Index in array
   * @param {boolean} isDefault - Whether this is the default (most recent)
   * @param {string} editType - Type of edit: 'imported', 'saved', or 'edit'
   * @returns {string} HTML string
   * @private
   */
  generateEditOptionHTML(editFile, index, isDefault, editType = "edit") {
    const timestamp = editFile.timestamp
      ? editFile.timestamp.toLocaleString("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Unknown time";

    // Build badges HTML
    let badgesHtml = "";

    // Type badge with icon - using SVG icons for consistency
    const typeBadgeIcons = {
      imported: "inbox",
      saved: "disk",
      edit: "document",
    };

    const typeBadgeLabels = {
      imported: { label: "Imported", class: "edit-option-badge-imported" },
      saved: { label: "Saved", class: "edit-option-badge-saved" },
      edit: { label: "Edit", class: "edit-option-badge-edit" },
    };

    const iconName = typeBadgeIcons[editType] || "document";
    const typeInfo = typeBadgeLabels[editType] || typeBadgeLabels.edit;
    badgesHtml += `<span class="edit-option-badge ${typeInfo.class}">${getIcon(
      iconName,
    )} ${typeInfo.label}</span>`;

    // Most Recent badge (in addition to type badge)
    if (isDefault) {
      badgesHtml +=
        '<span class="edit-option-badge edit-option-badge-recent">Most Recent</span>';
    }

    // Build original filename info for imported files
    let originalFilenameHtml = "";
    if (editType === "imported" && editFile.originalFilename) {
      originalFilenameHtml = `<span class="edit-option-original-filename">Originally: ${this.escapeHtml(
        editFile.originalFilename,
      )}</span>`;
    }

    return `
    <label class="resume-edit-option resume-edit-option-${editType}">
      <input type="radio" name="resume-edit-choice" value="${index}" ${
        isDefault ? "checked" : ""
      }>
      <span class="edit-option-content">
        <span class="edit-option-filename">${this.escapeHtml(
          editFile.filename,
        )}</span>
        ${originalFilenameHtml}
        <span class="edit-option-timestamp">${this.escapeHtml(timestamp)}</span>
        <span class="edit-option-badges">${badgesHtml}</span>
      </span>
    </label>
  `;
  }

  /**
   * Confirm edit selection and proceed with restoration
   * @private
   */
  async confirmEditSelection() {
    logDebug("Confirming edit selection");

    // Get selected edit
    const selectedRadio = document.querySelector(
      'input[name="resume-edit-choice"]:checked',
    );
    if (!selectedRadio) {
      logWarn("No edit selection made");
      return;
    }

    const selectedValue = selectedRadio.value;
    let selectedEdit = null;

    // Handle "original" option (value="original") vs edit index
    if (selectedValue === "original") {
      logInfo("Selected: Original MathPix output");
      selectedEdit = null; // null means load original
    } else {
      const selectedIndex = parseInt(selectedValue, 10);
      const editFiles = this.parseResult?.edits?.files || [];
      selectedEdit = editFiles[selectedIndex] || null;
      logInfo("Selected edit:", selectedEdit?.filename);
    }

    // Hide edit selection dialog
    this.hideEditSelectionDialog();

    // Proceed with restoration
    await this.restoreSession(this.parseResult, selectedEdit);
  }

  /**
   * Cancel edit selection and return to upload state
   * @private
   */
  cancelEditSelection() {
    logDebug("Cancelling edit selection");

    this.hideEditSelectionDialog();
    this.resetToUploadState();
  }

  /**
   * Hide edit selection dialog
   * @private
   */
  hideEditSelectionDialog() {
    if (this.elements.editSelection) {
      this.elements.editSelection.hidden = true;
    }
  }

  // =========================================================================
  // SESSION RESTORATION
  // =========================================================================

  /**
   * Restore session from parse result
   * @param {Object} parseResult - Parsed ZIP data
   * @param {Object|null} selectedEdit - User's edit selection (or null for original)
   */
  async restoreSession(parseResult, selectedEdit) {
    logInfo("Restoring session from ZIP archive");

    try {
      // Determine the content to load (edit takes priority over original)
      const loadedContent = selectedEdit?.content || parseResult.results.mmd;

      // Store session data
      this.restoredSession = {
        source: parseResult.source,
        results: parseResult.results,
        originalMMD: parseResult.results.mmd,
        baselineMMD: loadedContent, // Content at session start (for tracking user edits)
        currentMMD: loadedContent,
        selectedEdit: selectedEdit,
        metadata: parseResult.metadata,
        linesData: parseResult.linesData,
        isPDF: parseResult.source.isPDF,
      };

      // Store original MMD lines for edit tracking (Phase 8.3.5)
      // This enables confidence display to show pencil icon for edited lines
      this.setOriginalMmdContent(parseResult.results.mmd);

      // Configure UI based on source type
      this.configureUIForSourceType(parseResult.source.isPDF);

      // Update session header
      this.updateSessionHeader(parseResult.source.filename);

      // Load MMD content into editor
      this.loadMMDContent(
        this.restoredSession.currentMMD,
        this.restoredSession.originalMMD,
      );

      // Integrate with MMDEditorPersistence module
      this.integratePersistenceModule(parseResult.source.filename);

      // Load source PDF if applicable
      if (parseResult.source.isPDF && parseResult.source.blob) {
        await this.loadSourcePDF(parseResult.source.blob);
      }

      // Load confidence visualiser if PDF with lines data
      if (
        parseResult.source.isPDF &&
        parseResult.linesData &&
        parseResult.source.blob
      ) {
        await this.loadConfidenceVisualiser(
          parseResult.linesData,
          parseResult.source.blob,
        );

        // Phase 8.3.4: Show confidence toggle for MMD view
        this.showConfidenceToggle();
      }

      // Check for PRE-EXISTING localStorage sessions BEFORE creating new one
      // This must happen before startPersistenceSession() to avoid finding
      // the session we're about to create
      const preExistingSessions = this.checkForMatchingSessions(
        parseResult.source.filename,
      );

      // Start persistence session (creates new localStorage entry)
      this.startPersistenceSession(parseResult.source.filename);

      // Update AI Enhancement button state (Phase 7.1)
      this.updateAIEnhanceButton();

      // Hide upload section, show working area
      if (this.elements.uploadSection) {
        this.elements.uploadSection.hidden = true;
      }
      if (this.elements.workingArea) {
        this.elements.workingArea.hidden = false;
      }

      // Show convert section and update button state
      if (this.elements.convertSection) {
        this.elements.convertSection.hidden = false;
        logDebug("Convert section shown");
      }
      this.updateConvertButtonState();

      // Check if there are multiple versions to switch between
      const zipEdits = parseResult.edits?.files || [];
      const hasMultipleZipVersions = zipEdits.length > 0; // Has at least one edit besides original
      const hasLocalStorageSessions = preExistingSessions.length > 0;

      // Calculate initial session index based on what was loaded
      // (do this BEFORE showing banner so we can pass it)
      let initialSessionIndex = null;
      if (selectedEdit) {
        // Find which ZIP edit index this corresponds to
        const editIndex = zipEdits.findIndex(
          (e) => e.content === selectedEdit.content,
        );
        initialSessionIndex = editIndex >= 0 ? -2 - editIndex : -2;
      } else {
        // Loaded original
        initialSessionIndex = -1;
      }
      this._currentSessionIndex = initialSessionIndex;

      // Handle localStorage session recovery with auto-restore
      if (hasLocalStorageSessions) {
        // Filter to only sessions newer than the ZIP edit
        const zipEditTime = selectedEdit?.timestamp?.getTime() || 0;
        const newerSessions = preExistingSessions.filter(
          (s) => s.lastModified > zipEditTime,
        );

        if (newerSessions.length > 0) {
          // Auto-restore the most recent localStorage session
          // Sessions are already sorted by lastModified (newest first)
          const mostRecentSession = newerSessions[0];

          logInfo("Auto-restoring most recent localStorage session:", {
            key: mostRecentSession.key,
            lastModified: new Date(
              mostRecentSession.lastModified,
            ).toISOString(),
            sessionCount: newerSessions.length,
          });

          // Store sessions reference for version switching
          this._recoverySessions = newerSessions;

          // Apply the most recent session
          this.applyRecoveredSession({
            key: mostRecentSession.key,
            data: mostRecentSession.data,
          });

          // Update the current session index to reflect the auto-restored session
          this._currentSessionIndex = 0; // First localStorage session

          // Show informational banner instead of selection banner
          this.showAutoRestoredBanner(mostRecentSession);
        } else {
          // All localStorage sessions are older, clean them up
          this.clearMatchingSessions(preExistingSessions);
        }
      }

      // Show Switch Version button if there are multiple versions available
      // (even without localStorage sessions, user may want to switch between ZIP versions)
      if (hasMultipleZipVersions || hasLocalStorageSessions) {
        this.showSwitchVersionButton();
      }

      // Show notification
      this.showNotification(RESTORER_CONFIG.MESSAGES.SUCCESS, "success");

      logInfo("Session restored successfully", {
        sourceFile: parseResult.source.filename,
        isPDF: parseResult.source.isPDF,
        hasLinesData: !!parseResult.linesData,
        mmdLength: this.restoredSession.currentMMD?.length || 0,
        convertSectionVisible: !this.elements.convertSection?.hidden,
      });
    } catch (error) {
      logError("Failed to restore session:", error);
      this.showNotification(
        `Failed to restore session: ${error.message}`,
        "error",
      );
    }
  }

  /**
   * Integrate with the MMDEditorPersistence module
   * @param {string} sourceFilename - Source filename
   * @private
   */
  integratePersistenceModule(sourceFilename) {
    const persistence = window.getMathPixMMDPersistence?.();
    if (!persistence) {
      logDebug("Persistence module not available, using internal persistence");
      return;
    }

    // Initialise persistence if needed
    if (!persistence.isInitialised) {
      persistence.init();
    }

    // Start a new session with our restored content
    const mmdContent = this.restoredSession?.originalMMD || "";
    if (mmdContent) {
      persistence.startSession(mmdContent, sourceFilename);
      logInfo("Persistence module session started for resume mode");

      // Listen for status changes from persistence
      this.setupPersistenceStatusSync(persistence);
    }
  }

  /**
   * Update AI Enhancement button state after session change
   * @since Phase 7.1
   */
  updateAIEnhanceButton() {
    const enhancer = window.getMathPixAIEnhancer?.();
    if (enhancer) {
      enhancer.updateButtonState();
      logDebug("AI Enhancement button state updated");
    }
  }

  /**
   * Sync status updates from persistence module
   * @param {Object} persistence - Persistence module instance
   * @private
   */
  setupPersistenceStatusSync(persistence) {
    // Override the persistence module's updateStatus to also update our UI
    const originalUpdateStatus = persistence.updateStatus.bind(persistence);
    persistence.updateStatus = (state) => {
      originalUpdateStatus(state);
      this.updateSessionStatus(state);
    };

    // Initial button state sync
    this.updateUndoRedoButtons();
  }

  /**
   * Configure UI based on source type
   * @param {boolean} isPDF - Whether source is PDF
   * @private
   */
  configureUIForSourceType(isPDF) {
    logDebug("Configuring UI for source type:", { isPDF });

    // Show/hide Confidence tab
    if (this.elements.tabConfidence) {
      this.elements.tabConfidence.hidden = !isPDF;
    }

    // Show/hide Compare button
    if (this.elements.mmdViewPdfSplitBtn) {
      this.elements.mmdViewPdfSplitBtn.hidden = !isPDF;
    }

    // Show/hide Split PDF toggle (only visible in split mode with PDF source)
    if (this.elements.splitPdfToggle) {
      this.elements.splitPdfToggle.hidden = !isPDF;
    }

    // Set default view to split
    this.switchMmdView("split");
  }

  /**
   * Update session header with source info
   * @param {string} filename - Source filename
   * @private
   */
  updateSessionHeader(filename) {
    if (this.elements.sourceName) {
      this.elements.sourceName.textContent = filename || "Unknown file";
    }
    if (this.elements.sessionStatus) {
      this.elements.sessionStatus.textContent =
        RESTORER_CONFIG.MESSAGES.SESSION_SAVED;
      this.elements.sessionStatus.dataset.state = "saved";
    }
  }

  /**
   * Load MMD content into editor
   * @param {string} mmdContent - Content to display/edit
   * @param {string} originalMMD - Original for restore functionality
   * @private
   */
  loadMMDContent(mmdContent, originalMMD) {
    logDebug("Loading MMD content", { length: mmdContent?.length });

    // Set code element content
    if (this.elements.mmdCodeElement) {
      this.elements.mmdCodeElement.textContent = mmdContent || "";

      // Apply syntax highlighting if Prism is available
      if (typeof Prism !== "undefined") {
        Prism.highlightElement(this.elements.mmdCodeElement);
      }
    }

    // Set textarea content
    if (this.elements.mmdEditorTextarea) {
      this.elements.mmdEditorTextarea.value = mmdContent || "";
    }

    // Ensure preview content is keyboard accessible (WCAG 2.1.1)
    if (this.elements.mmdPreviewContent) {
      // Make scrollable region focusable
      if (!this.elements.mmdPreviewContent.hasAttribute("tabindex")) {
        this.elements.mmdPreviewContent.setAttribute("tabindex", "0");
      }
      // Provide accessible name for screen readers
      if (!this.elements.mmdPreviewContent.hasAttribute("aria-label")) {
        this.elements.mmdPreviewContent.setAttribute(
          "aria-label",
          "MMD content preview - scrollable region",
        );
      }
    }

    // Enable editing mode and sync button state (Issue 3 fix)
    // When content is loaded, editing is enabled by default
    this.setEditMode(true);

    // Update preview
    this.updatePreview(mmdContent);

    // Re-render line-based editor if confidence highlighting is enabled
    // This ensures edit status indicators are recalculated after version switches
    if (this.isConfidenceEnabled) {
      const isEditing =
        this.elements.mmdCodeContainer?.dataset.editing === "true";
      this.renderLineBasedConfidenceEditor(isEditing);
      logDebug("Re-rendered line editor after content load");
    }
  }

  /**
   * Update MMD preview
   * @param {string} content - MMD content
   * @private
   */
  async updatePreview(content) {
    if (!this.elements.mmdPreviewContent) return;

    // Store content for potential recovery re-render
    this.pendingContent = content;

    // Check if CDN library is ready
    const cdnReady =
      typeof window.MathpixMarkdownModel !== "undefined" ||
      typeof window.markdownToHTML !== "undefined";

    // Use MathPix markdown-it renderer if available
    // First try the global getter, then fall back to controller's instance
    let mmdPreview = window.getMathPixMMDPreview?.();

    if (!mmdPreview) {
      // Try getting from controller
      const controller = window.getMathPixController?.();
      mmdPreview = controller?.getMMDPreview?.();
    }

    if (mmdPreview) {
      try {
        // Check if the library is ready before rendering
        const libraryReady = mmdPreview.isReady?.() || cdnReady;

        if (!libraryReady) {
          logWarn("CDN library not ready - triggering immediate recovery");
          this.pendingPreviewRender = true;

          // Show loading state in preview
          this.elements.mmdPreviewContent.innerHTML = `
            <div class="mmd-preview-loading" role="status">
              <p>Loading preview renderer...</p>
              <p class="mmd-preview-fallback-note">
                <small>Mathematical content will render when the library loads.</small>
              </p>
            </div>
          `;

          // Register for recovery
          if (window.mathJaxManager?.registerPendingElement) {
            window.mathJaxManager.registerPendingElement(
              this.elements.mmdPreviewContent,
              {
                source: "session-restorer",
                reason: "cdn-not-ready",
                contentLength: content.length,
              },
            );
          }

          // CRITICAL FIX: Trigger recovery immediately instead of waiting for monitors
          // The monitors may have already timed out if the user took time to upload
          logInfo(
            "Triggering immediate recovery render (monitors may have timed out)",
          );

          // Use setTimeout to allow the loading message to render first
          setTimeout(() => {
            this.handleRecoveryRerender();
          }, 100);

          return;
        }

        // render() takes content AND target element
        await mmdPreview.render(content, this.elements.mmdPreviewContent);

        // Clear pending state on success
        this.pendingPreviewRender = false;
        this.pendingContent = null;

        logDebug("MMD preview rendered successfully");
      } catch (error) {
        logWarn("Failed to render MMD preview:", error);

        // Mark for recovery
        this.pendingPreviewRender = true;

        // Fallback: try renderToString if render fails
        try {
          const html = mmdPreview.renderToString?.(content);
          if (html) {
            this.elements.mmdPreviewContent.innerHTML = html;
          } else {
            this.elements.mmdPreviewContent.textContent = content;
          }
        } catch (fallbackError) {
          this.elements.mmdPreviewContent.textContent = content;
        }

        // Register for recovery
        if (window.mathJaxManager?.registerPendingElement) {
          window.mathJaxManager.registerPendingElement(
            this.elements.mmdPreviewContent,
            {
              source: "session-restorer",
              reason: "render-failed",
              error: error.message,
            },
          );
        }
      }
    } else {
      // Fallback to plain text - mark for recovery
      this.pendingPreviewRender = true;
      this.elements.mmdPreviewContent.textContent = content;
      logDebug(
        "MMD preview module not available, using plain text - marked for recovery",
      );
    }
  }

  /**
   * Load source PDF into viewer
   * @param {Blob} pdfBlob - PDF blob
   * @private
   */
  async loadSourcePDF(pdfBlob) {
    logDebug("Loading source PDF into viewer");

    try {
      // Create object URL
      const pdfUrl = URL.createObjectURL(pdfBlob);
      this.objectURLs.push(pdfUrl);

      // Store for comparison view
      this.restoredSession.pdfUrl = pdfUrl;

      // TODO: Integrate with PDF viewer when switching to Compare view
      logInfo("Source PDF loaded, URL stored for comparison view");
    } catch (error) {
      logError("Failed to load source PDF:", error);
    }
  }

  /**
   * Render PDF for comparison view
   * Uses PDF.js to render all pages into the PDF container
   * Reuses existing mmd-pdf-* classes for consistent styling
   * @private
   */
  async renderPDFForComparison() {
    logDebug("Rendering PDF for comparison view");

    const pagesContainer = document.getElementById("resume-mmd-pdf-pages");
    if (!pagesContainer) {
      logWarn("PDF pages container not found");
      return;
    }

    // Check if we have a PDF to render
    if (!this.restoredSession?.source?.blob || !this.restoredSession?.isPDF) {
      pagesContainer.innerHTML = `
      <div class="mmd-pdf-error" role="alert">
<p class="mmd-error-icon">${getIcon("document")}</p>
        <p>No PDF available for comparison</p>
      </div>
    `;
      return;
    }

    // Show loading state (reuse existing loading element if present)
    const loadingEl = document.getElementById("resume-mmd-pdf-loading");
    if (loadingEl) {
      loadingEl.hidden = false;
    } else {
      pagesContainer.innerHTML = `
      <div class="mmd-pdf-loading" role="status" aria-live="polite">
        <div class="mmd-loading-spinner" aria-hidden="true"></div>
        <p>Loading PDF...</p>
      </div>
    `;
    }

    try {
      // Load PDF.js if not already loaded
      await this.ensurePDFJSLoaded();

      // Get PDF.js library
      const pdfjsLib = window.pdfjsLib;
      if (!pdfjsLib) {
        throw new Error("PDF.js library not available");
      }

      // Load the PDF document
      const arrayBuffer = await this.restoredSession.source.blob.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDocument = await loadingTask.promise;

      logInfo("PDF loaded for comparison", { numPages: pdfDocument.numPages });

      // Hide loading, clear container
      if (loadingEl) {
        loadingEl.hidden = true;
      }
      pagesContainer.innerHTML = "";

      // Update page total indicators if present
      const totalPagesEl = document.getElementById(
        "resume-mmd-pdf-total-pages",
      );
      const totalDisplayEl = document.getElementById(
        "resume-mmd-pdf-total-display",
      );
      if (totalPagesEl) totalPagesEl.textContent = pdfDocument.numPages;
      if (totalDisplayEl) totalDisplayEl.textContent = pdfDocument.numPages;

      // Update page input max
      const pageInput = document.getElementById("resume-mmd-pdf-page-input");
      if (pageInput) pageInput.max = pdfDocument.numPages;

      // Calculate scale based on container width
      const scrollContainer = document.getElementById(
        "resume-mmd-pdf-scroll-container",
      );
      const containerWidth = scrollContainer?.clientWidth || 600;
      const devicePixelRatio = window.devicePixelRatio || 1;

      // Render each page
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);

        // Calculate scale to fit container width (with some padding)
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = (containerWidth - 40) / unscaledViewport.width;
        const viewport = page.getViewport({ scale: scale * devicePixelRatio });

        // Create page wrapper using existing class
        const pageWrapper = document.createElement("div");
        pageWrapper.className = "mmd-pdf-page";
        pageWrapper.setAttribute("data-page", pageNum);
        pageWrapper.setAttribute(
          "aria-label",
          `Page ${pageNum} of ${pdfDocument.numPages}`,
        );

        // Create canvas using existing class
        const canvas = document.createElement("canvas");
        canvas.className = "mmd-pdf-canvas";
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / devicePixelRatio}px`;
        canvas.style.height = `${viewport.height / devicePixelRatio}px`;

        pageWrapper.appendChild(canvas);
        pagesContainer.appendChild(pageWrapper);

        // Render page to canvas
        const renderContext = {
          canvasContext: canvas.getContext("2d"),
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        logDebug(`Rendered page ${pageNum}/${pdfDocument.numPages}`);
      }

      // Store document reference for navigation
      this.pdfDocument = pdfDocument;
      this.pdfRenderedForComparison = true;

      logInfo("PDF comparison rendering complete", {
        totalPages: pdfDocument.numPages,
      });
    } catch (error) {
      logError("Failed to render PDF for comparison:", error);

      if (loadingEl) {
        loadingEl.hidden = true;
      }

      // Show error using existing error classes
      pagesContainer.innerHTML = `
      <div class="mmd-pdf-error" role="alert">
<p class="mmd-error-icon">${getIcon("warning")}</p>
        <p id="resume-mmd-pdf-error-message">Failed to load PDF: ${this.escapeHtml(
          error.message,
        )}</p>
      </div>
    `;
    }
  }

  /**
   * Ensure PDF.js library is loaded
   * @private
   */
  async ensurePDFJSLoaded() {
    // Check if already loaded
    if (window.pdfjsLib) {
      logDebug("PDF.js already available");
      return;
    }

    logInfo("Loading PDF.js library from CDN");

    // PDF.js CDN URLs (same versions as pdf-visualiser-config.js)
    const PDFJS_VERSION = "3.11.174";
    const LIB_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
    const WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

    // Load the main library
    await this.loadScript(LIB_URL);

    // Verify it loaded
    if (!window.pdfjsLib) {
      throw new Error("PDF.js library not available after script load");
    }

    // Configure worker
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;

    logInfo("PDF.js loaded successfully", { version: PDFJS_VERSION });
  }

  /**
   * Load a script from URL
   * @param {string} url - Script URL
   * @returns {Promise<void>}
   * @private
   */
  loadScript(url) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      const existing = document.querySelector(`script[src="${url}"]`);
      if (existing) {
        logDebug("Script already loaded:", url);
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = url;
      script.async = true;

      const timeout = setTimeout(() => {
        reject(new Error(`Script load timeout: ${url}`));
      }, 15000);

      script.onload = () => {
        clearTimeout(timeout);
        logDebug("Script loaded:", url);
        resolve();
      };

      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load script: ${url}`));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Ensure PDF.js library is loaded
   * @private
   */
  async ensurePDFJSLoaded() {
    // Check if already loaded
    if (window.pdfjsLib) {
      logDebug("PDF.js already available");
      return;
    }

    logInfo("Loading PDF.js library from CDN");

    // PDF.js CDN URLs (same versions as pdf-visualiser-config.js)
    const PDFJS_VERSION = "3.11.174";
    const LIB_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
    const WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

    // Load the main library
    await this.loadScript(LIB_URL);

    // Verify it loaded
    if (!window.pdfjsLib) {
      throw new Error("PDF.js library not available after script load");
    }

    // Configure worker
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;

    logInfo("PDF.js loaded successfully", { version: PDFJS_VERSION });
  }

  /**
   * Load a script from URL
   * @param {string} url - Script URL
   * @returns {Promise<void>}
   * @private
   */
  loadScript(url) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      const existing = document.querySelector(`script[src="${url}"]`);
      if (existing) {
        logDebug("Script already loaded:", url);
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = url;
      script.async = true;

      const timeout = setTimeout(() => {
        reject(new Error(`Script load timeout: ${url}`));
      }, 15000);

      script.onload = () => {
        clearTimeout(timeout);
        logDebug("Script loaded:", url);
        resolve();
      };

      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load script: ${url}`));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Load lines data into confidence visualiser
   * @param {Object} linesData - Lines data from ZIP
   * @param {Blob} pdfBlob - Source PDF blob
   * @private
   */
  async loadConfidenceVisualiser(linesData, pdfBlob) {
    logDebug("Loading confidence visualiser data");

    try {
      // Check if visualiser class is available
      if (typeof window.PDFConfidenceVisualiser === "undefined") {
        logWarn(
          "PDFConfidenceVisualiser class not available - ensure pdf-visualiser-core.js is loaded",
        );
        return;
      }

      // Store reference for lazy loading when Confidence tab is clicked
      this.restoredSession.confidenceData = {
        linesData,
        pdfBlob,
        loaded: false,
      };

      logInfo("Confidence data stored for lazy loading on tab activation");
    } catch (error) {
      logError("Failed to prepare confidence visualiser:", error);
    }
  }

  // =========================================================================
  // PERSISTENCE SESSION
  // =========================================================================

  /**
   * Start new persistence session for restored content
   * Stores complete session data for recovery after browser close
   * @param {string} sourceFilename - Original source filename
   * @private
   */
  startPersistenceSession(sourceFilename) {
    logDebug("Starting persistence session");

    // Generate sanitised session key
    const sanitised = this.sanitiseFilename(sourceFilename);
    const timestamp = Date.now();
    const sessionKey = `${RESTORER_CONFIG.SESSION_KEY_PREFIX}${sanitised}-${timestamp}`;

    // Build the full localStorage key (used consistently everywhere)
    const storageKey = `mathpix-resume-session-${sessionKey}`;

    // Store complete session info in localStorage
    try {
      const sessionData = {
        // Session identification
        key: sessionKey,
        storageKey: storageKey,

        // Source file info (use consistent property name: sourceFileName with capital N)
        sourceFileName: sourceFilename,

        // Content for recovery
        original: this.restoredSession?.originalMMD || "",
        baseline:
          this.restoredSession?.baselineMMD ||
          this.restoredSession?.currentMMD ||
          "",
        current:
          this.restoredSession?.currentMMD ||
          this.restoredSession?.originalMMD ||
          "",

        // Edit history
        undoStack: [],
        redoStack: [],

        // Timestamps
        restoredAt: new Date().toISOString(),
        lastModified: timestamp,
      };

      localStorage.setItem(storageKey, JSON.stringify(sessionData));

      // Store both keys for reference
      this.restoredSession.sessionKey = sessionKey;
      this.restoredSession.storageKey = storageKey;

      logInfo("Persistence session started:", storageKey);
    } catch (error) {
      logWarn("Failed to start persistence session:", error);
    }
  }

  /**
   * Sanitise filename for use in session key
   * @param {string} filename - Original filename
   * @returns {string} Sanitised filename
   * @private
   */
  sanitiseFilename(filename) {
    if (!filename) return "unknown";

    return filename
      .replace(/\.[^/.]+$/, "") // Remove extension
      .replace(/[^a-zA-Z0-9]/g, "-") // Replace non-alphanumeric with dash
      .replace(/-+/g, "-") // Collapse multiple dashes
      .replace(/^-|-$/g, "") // Remove leading/trailing dashes
      .substring(0, 50) // Limit length
      .toLowerCase();
  }

  // =========================================================================
  // MMD VIEW SWITCHING
  // =========================================================================

  /**
   * Switch MMD view mode
   * @param {string} view - View to switch to ('code', 'preview', 'split', 'pdf_split')
   * @private
   */
  switchMmdView(view) {
    logDebug("Switching MMD view to:", view);

    // Update button states
    const viewButtons = [
      { el: this.elements.mmdViewCodeBtn, view: "code" },
      { el: this.elements.mmdViewPreviewBtn, view: "preview" },
      { el: this.elements.mmdViewSplitBtn, view: "split" },
      { el: this.elements.mmdViewPdfSplitBtn, view: "pdf_split" },
    ];

    viewButtons.forEach(({ el, view: btnView }) => {
      if (el) {
        const isActive = btnView === view;
        el.classList.toggle("active", isActive);
        el.setAttribute("aria-pressed", isActive.toString());
      }
    });

    // Update containers
    if (this.elements.mmdContentArea) {
      this.elements.mmdContentArea.dataset.currentView = view;
    }

    // Show/hide containers based on view
    const isCode = view === "code";
    const isPreview = view === "preview";
    const isSplit = view === "split";
    const isPdfSplit = view === "pdf_split";

    if (this.elements.mmdCodeContainer) {
      this.elements.mmdCodeContainer.classList.toggle(
        "active",
        isCode || isSplit || isPdfSplit,
      );
      this.elements.mmdCodeContainer.hidden =
        !isCode && !isSplit && !isPdfSplit;
    }

    if (this.elements.mmdPreviewContainer) {
      this.elements.mmdPreviewContainer.classList.toggle(
        "active",
        isPreview || isSplit,
      );
      this.elements.mmdPreviewContainer.hidden = !isPreview && !isSplit;
    }

    if (this.elements.mmdPdfContainer) {
      // Check if "Show PDF" is checked for split view
      const showPdfInSplit = isSplit && this.elements.splitPdfCheckbox?.checked;
      const shouldShowPdf = isPdfSplit || showPdfInSplit;

      this.elements.mmdPdfContainer.classList.toggle("active", shouldShowPdf);
      this.elements.mmdPdfContainer.hidden = !shouldShowPdf;

      // Update data attribute for CSS styling (used by split view 3-column layout)
      if (this.elements.mmdContentArea) {
        this.elements.mmdContentArea.dataset.showPdf =
          showPdfInSplit.toString();
      }

      // Render PDF when showing it (Compare view or Split with Show PDF)
      if (shouldShowPdf && !this.pdfRenderedForComparison) {
        this.renderPDFForComparison();
      }
    }

    if (this.elements.mmdViewDivider) {
      this.elements.mmdViewDivider.hidden = !isSplit && !isPdfSplit;
    }

    // Update status
    const statusText = {
      code: "Viewing code",
      preview: "Viewing preview",
      split: "Split view",
      pdf_split: "Comparing with PDF",
    };

    if (this.elements.mmdViewStatus) {
      this.elements.mmdViewStatus.textContent = statusText[view] || "Viewing";
    }

    // Show/hide Split PDF toggle based on view mode
    if (this.elements.splitPdfToggle) {
      // Only show in split view when PDF source is available
      const showToggle = isSplit && this.restoredSession?.isPDF;
      this.elements.splitPdfToggle.hidden = !showToggle;
    }

    // Hide the toggle in Compare mode (always shows PDF)
    if (isPdfSplit && this.elements.splitPdfToggle) {
      this.elements.splitPdfToggle.hidden = true;
    }

    // Update Resume file controls visibility (show in Code/Split views only)
    if (typeof updateResumeFileControlsVisibility === "function") {
      updateResumeFileControlsVisibility();
    }
  }

  // =========================================================================
  // ACCESSIBILITY / KEYBOARD NAVIGATION
  // =========================================================================

  /**
   * Handle skip link for resume MMD preview
   * Dynamically determines skip target based on current view mode
   * WCAG 2.4.1: Bypass Blocks
   * @param {Event} event - Click event
   */
  handlePreviewSkip(event) {
    event.preventDefault();

    // Determine current view mode
    const currentView =
      this.elements.mmdContentArea?.dataset.currentView || "preview";

    // Check if PDF is visible in split mode
    const pdfVisible =
      this.elements.splitPdfCheckbox?.checked && currentView === "split";

    let targetElement = null;

    // Priority order for skip targets:
    // 1. PDF container (if visible in compare or split+PDF mode)
    // 2. Download section or actions after content
    // 3. New session button
    // 4. Generic skip target

    if (currentView === "pdf_split" || pdfVisible) {
      // In compare mode or split with PDF - skip to PDF container
      targetElement = this.elements.mmdPdfContainer;
    }

    if (!targetElement || targetElement.hidden) {
      // Try the download section or actions after content
      targetElement =
        document.getElementById("resume-download-section") ||
        this.elements.newSessionBtn;
    }

    if (!targetElement) {
      // Fallback to generic skip target
      targetElement = document.getElementById("resume-mmd-preview-skip-target");
    }

    if (targetElement) {
      // Ensure element can receive focus
      if (!targetElement.hasAttribute("tabindex")) {
        targetElement.setAttribute("tabindex", "-1");
      }
      targetElement.focus();

      // Announce to screen readers
      this.announceToScreenReader("Skipped preview content");

      logDebug("Preview skip: focused on", targetElement.id || targetElement);
    }
  }

  // =========================================================================
  // PDF NAVIGATION AND ZOOM
  // =========================================================================

  /**
   * Navigate to a specific page in the PDF
   * @param {number} pageNum - Page number to navigate to
   * @private
   */
  goToPage(pageNum) {
    if (!this.pdfDocument) {
      logWarn("No PDF document loaded for navigation");
      return;
    }

    const totalPages = this.pdfDocument.numPages;

    // Validate page number
    if (isNaN(pageNum) || pageNum < 1) {
      pageNum = 1;
    } else if (pageNum > totalPages) {
      pageNum = totalPages;
    }

    // Update input value
    if (this.elements.pdfPageInput) {
      this.elements.pdfPageInput.value = pageNum;
    }

    // Find and scroll to the page
    const pageElement = this.elements.pdfPagesContainer?.querySelector(
      `[data-page="${pageNum}"]`,
    );

    if (pageElement && this.elements.pdfScrollContainer) {
      pageElement.scrollIntoView({ behavior: "smooth", block: "start" });
      logDebug("Navigated to page", { pageNum });
    }
  }

  /**
   * Zoom PDF by a delta amount
   * @param {number} delta - Amount to change zoom by (e.g., 0.1 for +10%)
   * @private
   */
  zoomPDF(delta) {
    if (!this.pdfDocument) {
      logWarn("No PDF document loaded for zoom");
      return;
    }

    // Get current scale or default to 1
    this.currentPdfScale = this.currentPdfScale || 1;

    // Calculate new scale with limits
    const newScale = Math.max(0.25, Math.min(3, this.currentPdfScale + delta));

    if (newScale === this.currentPdfScale) {
      return; // No change needed
    }

    this.currentPdfScale = newScale;
    this.rerenderPDFAtScale(newScale);

    // Update zoom level display
    if (this.elements.pdfZoomLevel) {
      this.elements.pdfZoomLevel.textContent = `${Math.round(newScale * 100)}%`;
    }

    logDebug("PDF zoomed", { scale: newScale });
  }

  /**
   * Fit PDF to container width
   * @private
   */
  fitPDFToWidth() {
    if (!this.pdfDocument) {
      logWarn("No PDF document loaded for fit-to-width");
      return;
    }

    // Calculate scale to fit container width
    const containerWidth = this.elements.pdfScrollContainer?.clientWidth || 600;

    // Get first page to determine natural width
    this.pdfDocument
      .getPage(1)
      .then((page) => {
        const unscaledViewport = page.getViewport({ scale: 1 });
        const fitScale = (containerWidth - 40) / unscaledViewport.width;

        this.currentPdfScale = fitScale;
        this.rerenderPDFAtScale(fitScale);

        // Update zoom level display
        if (this.elements.pdfZoomLevel) {
          this.elements.pdfZoomLevel.textContent = `${Math.round(
            fitScale * 100,
          )}%`;
        }

        logDebug("PDF fit to width", { scale: fitScale });
      })
      .catch((error) => {
        logError("Failed to fit PDF to width:", error);
      });
  }

  /**
   * Re-render PDF at a specific scale
   * @param {number} scale - Scale factor
   * @private
   */
  async rerenderPDFAtScale(scale) {
    if (!this.pdfDocument || !this.elements.pdfPagesContainer) {
      return;
    }

    const pagesContainer = this.elements.pdfPagesContainer;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const totalPages = this.pdfDocument.numPages;

    // Store current scroll position
    const scrollTop = this.elements.pdfScrollContainer?.scrollTop || 0;
    const scrollHeight = this.elements.pdfScrollContainer?.scrollHeight || 1;
    const scrollRatio = scrollTop / scrollHeight;

    // Re-render each page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageWrapper = pagesContainer.querySelector(
        `[data-page="${pageNum}"]`,
      );
      const canvas = pageWrapper?.querySelector("canvas");

      if (!canvas) continue;

      try {
        const page = await this.pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: scale * devicePixelRatio });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / devicePixelRatio}px`;
        canvas.style.height = `${viewport.height / devicePixelRatio}px`;

        const renderContext = {
          canvasContext: canvas.getContext("2d"),
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (error) {
        logError(`Failed to re-render page ${pageNum}:`, error);
      }
    }

    // Restore approximate scroll position
    if (this.elements.pdfScrollContainer) {
      const newScrollHeight = this.elements.pdfScrollContainer.scrollHeight;
      this.elements.pdfScrollContainer.scrollTop =
        scrollRatio * newScrollHeight;
    }

    logDebug("PDF re-rendered at scale", { scale, totalPages });
  }

  /**
   * Toggle PDF visibility in split view (3-column mode)
   * @param {boolean} show - Whether to show PDF column
   * @since 8.2.1
   */
  toggleSplitPDF(show) {
    logDebug("Toggling split PDF visibility:", { show });

    const { mmdContentArea } = this.elements;

    if (!mmdContentArea) {
      logWarn("Content area not found for PDF toggle");
      return;
    }

    // Update data attribute for CSS styling
    mmdContentArea.dataset.showPdf = show.toString();

    // If showing PDF and not already rendered, render it
    if (show && !this.pdfRenderedForComparison) {
      this.renderPDFForComparison();
    }

    // Show/hide PDF container
    if (this.elements.mmdPdfContainer) {
      this.elements.mmdPdfContainer.hidden = !show;
      if (show) {
        this.elements.mmdPdfContainer.classList.add("active");
      } else {
        this.elements.mmdPdfContainer.classList.remove("active");
      }
    }

    // Announce to screen readers
    const announcement = show
      ? "PDF column now visible in split view"
      : "PDF column hidden from split view";
    this.announceToScreenReader(announcement);

    logInfo("Split view PDF toggled", { show });
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   * @private
   */
  announceToScreenReader(message) {
    // Use existing SR announcement element or create temporary one
    const srElement =
      document.getElementById("mathpix-sr-announcements") ||
      document.getElementById("resume-mmd-view-status");

    if (srElement && srElement.getAttribute("aria-live")) {
      // Briefly change text to trigger announcement
      const originalText = srElement.textContent;
      srElement.textContent = message;

      // Restore after brief delay (for polite announcements)
      setTimeout(() => {
        if (this.elements.mmdViewStatus) {
          // Restore to current view status
          const currentView =
            this.elements.mmdContentArea?.dataset?.currentView || "split";
          const statusText = {
            code: "Viewing code",
            preview: "Viewing preview",
            split: "Split view",
            pdf_split: "Comparing with PDF",
          };
          this.elements.mmdViewStatus.textContent =
            statusText[currentView] || "Viewing";
        }
      }, 1000);
    }
  }

  /**
   * Switch between tabs (MMD / Confidence)
   * @param {string} tab - Tab to switch to ('mmd' or 'confidence')
   * @private
   */
  switchTab(tab) {
    logDebug("Switching tab to:", tab);

    const isMmd = tab === "mmd";

    // Update tab buttons
    if (this.elements.tabMmd) {
      this.elements.tabMmd.classList.toggle("active", isMmd);
      this.elements.tabMmd.setAttribute("aria-selected", isMmd.toString());
    }
    if (this.elements.tabConfidence) {
      this.elements.tabConfidence.classList.toggle("active", !isMmd);
      this.elements.tabConfidence.setAttribute(
        "aria-selected",
        (!isMmd).toString(),
      );
    }

    // Update panels
    if (this.elements.panelMmd) {
      this.elements.panelMmd.classList.toggle("active", isMmd);
      this.elements.panelMmd.hidden = !isMmd;
    }
    if (this.elements.panelConfidence) {
      this.elements.panelConfidence.classList.toggle("active", !isMmd);
      this.elements.panelConfidence.hidden = isMmd;

      // Lazy load confidence visualiser when first shown
      if (
        !isMmd &&
        this.restoredSession?.confidenceData &&
        !this.restoredSession.confidenceData.loaded
      ) {
        this.lazyLoadConfidenceVisualiser();
      }
    }
  }

  /**
   * Lazy load confidence visualiser on first tab switch
   * @private
   */
  async lazyLoadConfidenceVisualiser() {
    logDebug("Lazy loading confidence visualiser");

    const data = this.restoredSession?.confidenceData;
    if (!data || !this.elements.confidenceContainer) {
      logWarn("Cannot load confidence visualiser - missing data or container");
      return;
    }

    try {
      // Check if PDFConfidenceVisualiser class is available
      if (typeof window.PDFConfidenceVisualiser === "undefined") {
        logWarn("PDFConfidenceVisualiser not loaded");
        this.elements.confidenceContainer.innerHTML = `
        <p class="resume-instructions" style="padding: 2rem; text-align: center;">
          ${getIcon("warning")} 
          Confidence visualiser module not available. 
          Please ensure the PDF visualiser scripts are loaded.
        </p>
      `;
        return;
      }

      // Create object URL for PDF
      const pdfUrl = URL.createObjectURL(data.pdfBlob);
      this.objectURLs.push(pdfUrl);

      // Create visualiser instance with container
      const visualiser = new window.PDFConfidenceVisualiser({
        container: this.elements.confidenceContainer,
        enableAccessibility: true,
      });

      // Initialize and load
      await visualiser.initialize();
      await visualiser.loadPDF(pdfUrl, data.linesData);

      // Store reference for cleanup
      this.restoredSession.visualiserInstance = visualiser;
      data.loaded = true;

      logInfo("Confidence visualiser loaded successfully");
    } catch (error) {
      logError("Failed to load confidence visualiser:", error);
      this.elements.confidenceContainer.innerHTML = `
      <p class="resume-instructions" style="padding: 2rem; text-align: center;">
        ${getIcon("error")} 
        Failed to load confidence visualiser: ${this.escapeHtml(error.message)}
      </p>
    `;
    }
  }

  // =========================================================================
  // EDITOR FUNCTIONALITY
  // =========================================================================

  /**
   * Toggle edit mode
   * @private
   */
  toggleEditMode() {
    const isEditing =
      this.elements.mmdCodeContainer?.dataset.editing === "true";

    // Toggle to opposite state
    this.setEditMode(!isEditing);
  }

  /**
   * Set edit mode to a specific state
   * @param {boolean} enableEditing - Whether editing should be enabled
   * @private
   */
  setEditMode(enableEditing) {
    if (this.elements.mmdCodeContainer) {
      this.elements.mmdCodeContainer.dataset.editing = enableEditing.toString();
    }

    // Update button text and aria-pressed to match actual state
    if (this.elements.mmdEditBtn) {
      this.elements.mmdEditBtn.innerHTML = enableEditing
        ? `${getIcon("check")} Stop Editing`
        : `${getIcon("pencil")} Edit MMD`;
      this.elements.mmdEditBtn.setAttribute(
        "aria-pressed",
        enableEditing.toString(),
      );
    }

    // Show/hide editor toolbar based on editing state
    if (this.elements.mmdEditorToolbar) {
      this.elements.mmdEditorToolbar.hidden = !enableEditing;
    }

    logDebug("Edit mode set:", { enableEditing });

    // Auto-resize textarea when entering edit mode
    if (enableEditing) {
      // Use requestAnimationFrame to ensure textarea is visible before measuring
      requestAnimationFrame(() => {
        this.autoResizeTextarea();
      });
    }

    // Show/hide fullscreen button based on editing state (Phase 5.4)
    if (this.elements.mmdFullscreenBtn) {
      this.elements.mmdFullscreenBtn.hidden = !enableEditing;
    }

    // Exit fullscreen when stopping edit mode
    if (!enableEditing && this.isFullscreen) {
      this.exitFullscreen();
    }

    // Phase 8.3.5: Toggle contenteditable on line-based editor
    if (this.lineBasedEditor) {
      const lineContents =
        this.lineBasedEditor.querySelectorAll(".line-content");
      lineContents.forEach((el) => {
        el.setAttribute("contenteditable", enableEditing.toString());
      });
      logDebug(`Line-based editor contenteditable set to ${enableEditing}`);
    }

    // Phase 8.3.4: Manage gutter scroll synchronisation for edit mode (legacy)
    this.manageGutterScrollSync(enableEditing);
  }
  // =========================================================================
  // TEXTAREA AUTO-RESIZE (Phase 8.3.5 Responsive Fix)
  // =========================================================================

  /**
   * Auto-resize textarea to fit its content
   * Prevents internal scrollbars by expanding textarea to full content height
   * @param {HTMLTextAreaElement} [textarea] - Textarea element (defaults to mmdEditorTextarea)
   * @private
   */
  autoResizeTextarea(textarea = null) {
    const target = textarea || this.elements.mmdEditorTextarea;
    if (!target) return;

    // Only resize if textarea is visible
    if (target.offsetParent === null) return;

    // Skip auto-resize in fullscreen mode - let CSS handle sizing and enable scrolling
    if (this.isFullscreen) {
      // Clear any previous inline height/flex so CSS can control sizing
      target.style.height = "";
      target.style.flex = "";
      target.style.overflowY = "auto";
      logDebug("Textarea auto-resize skipped (fullscreen mode)");
      return;
    }

    // Store scroll position of parent container
    const scrollContainer = target.closest(".mathpix-format-content");
    const scrollTop = scrollContainer?.scrollTop || 0;

    // Break flex constraint - flex-basis: 0% prevents content-based sizing
    target.style.flex = "none";

    // Reset height to auto to get accurate scrollHeight
    target.style.height = "auto";

    // Set height to scrollHeight plus a small buffer
    const newHeight = target.scrollHeight + 2;
    target.style.height = `${newHeight}px`;

    // Restore scroll position
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollTop;
    }

    logDebug("Textarea auto-resized:", {
      newHeight,
      scrollHeight: target.scrollHeight,
    });
  }

  /**
   * Set up auto-resize behaviour for the MMD editor textarea
   * Called once during initialisation
   * @private
   */
  setupTextareaAutoResize() {
    const textarea = this.elements.mmdEditorTextarea;
    if (!textarea) {
      logDebug("Cannot setup textarea auto-resize - element not found");
      return;
    }

    // Resize on window resize (debounced)
    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Only resize if in edit mode and textarea is visible
        const isEditing =
          this.elements.mmdCodeContainer?.dataset.editing === "true";
        if (isEditing) {
          this.autoResizeTextarea(textarea);
        }
      }, 100);
    });

    logDebug("Textarea auto-resize setup complete");
  }
  /**
   * Phase 8.3.4: Manage gutter scroll synchronisation for edit mode
   * In edit mode, the textarea has internal scroll that doesn't affect
   * the parent container, so we need to manually sync the gutter position.
   * @param {boolean} enableEditing - Whether editing is being enabled
   * @private
   */
  manageGutterScrollSync(enableEditing) {
    const textarea = this.elements.mmdEditorTextarea;
    const gutter = this.elements.confidenceGutter;

    // Only manage if both elements exist and confidence is enabled
    if (!textarea || !gutter || !this.isConfidenceEnabled) {
      return;
    }

    if (enableEditing) {
      // Create bound handler if not already created
      if (!this.boundEditModeScrollHandler) {
        this.boundEditModeScrollHandler = () => {
          // Apply negative transform to match textarea scroll
          gutter.style.transform = `translateY(-${textarea.scrollTop}px)`;
        };
      }

      // Reset gutter position and attach listener
      gutter.style.transform = "translateY(0)";
      textarea.addEventListener("scroll", this.boundEditModeScrollHandler, {
        passive: true,
      });

      logDebug("Gutter scroll sync enabled for edit mode");
    } else {
      // Remove listener and reset position
      if (this.boundEditModeScrollHandler) {
        textarea.removeEventListener("scroll", this.boundEditModeScrollHandler);
      }
      gutter.style.transform = "";

      logDebug("Gutter scroll sync disabled");
    }
  }

  // =========================================================================
  // FULLSCREEN MODE (Phase 5.4)
  // =========================================================================

  /**
   * Toggle fullscreen edit mode
   */
  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;

    const { mmdCodeContainer, mmdFullscreenBtn, mmdEditorTextarea } =
      this.elements;

    // Toggle fullscreen class on container
    if (mmdCodeContainer) {
      mmdCodeContainer.classList.toggle("fullscreen", this.isFullscreen);
    }

    // Toggle body and html classes to prevent scrolling
    document.body.classList.toggle(
      "resume-fullscreen-active",
      this.isFullscreen,
    );
    document.documentElement.classList.toggle(
      "resume-fullscreen-active",
      this.isFullscreen,
    );

    // Update button label and icon
    if (mmdFullscreenBtn) {
      const label = this.isFullscreen
        ? "Exit fullscreen"
        : "Toggle fullscreen edit mode";
      mmdFullscreenBtn.setAttribute("aria-label", label);
      mmdFullscreenBtn.innerHTML = this.isFullscreen
        ? getIcon("fullscreenExit")
        : getIcon("fullscreenEnter");
    }

    // Focus textarea when entering fullscreen
    if (this.isFullscreen && mmdEditorTextarea) {
      mmdEditorTextarea.focus();
    }

    // Announce to screen readers
    this.announceToScreenReader(
      this.isFullscreen
        ? "Fullscreen edit mode enabled. Press Escape to exit."
        : "Fullscreen edit mode disabled",
    );

    logDebug("Fullscreen mode:", this.isFullscreen);
  }

  /**
   * Exit fullscreen mode
   * Called when stopping edit mode or pressing Escape
   */
  exitFullscreen() {
    if (this.isFullscreen) {
      this.isFullscreen = false;

      const { mmdCodeContainer, mmdFullscreenBtn } = this.elements;

      if (mmdCodeContainer) {
        mmdCodeContainer.classList.remove("fullscreen");
      }

      // Remove body and html classes
      document.body.classList.remove("resume-fullscreen-active");
      document.documentElement.classList.remove("resume-fullscreen-active");

      if (mmdFullscreenBtn) {
        mmdFullscreenBtn.setAttribute(
          "aria-label",
          "Toggle fullscreen edit mode",
        );
        mmdFullscreenBtn.innerHTML = getIcon("fullscreenEnter");
      }

      logDebug("Fullscreen mode exited");
    }
  }

  // =========================================================================
  // FOCUS MODE (Phase 8.3.3)
  // =========================================================================

  /**
   * Enter Focus Mode - page-level fullscreen for immersive editing
   * Hides non-essential UI elements and maximises editing space
   * @returns {void}
   */
  enterFocusMode() {
    if (this.isFocusMode) return;

    // Store scroll position for restoration
    this.savedScrollPosition = window.scrollY;

    // Activate focus mode
    document.body.classList.add("resume-focus-mode");
    this.isFocusMode = true;

    // Update button state
    if (this.elements.focusModeBtn) {
      this.elements.focusModeBtn.setAttribute("aria-pressed", "true");
      this.elements.focusModeBtn.innerHTML = `${getIcon(
        "fullscreenExit",
      )} Exit Focus`;
    }

    // Announce to screen readers
    this.announceToScreenReader(
      "Entered Focus Mode. Press Escape or Ctrl+Shift+F to exit.",
    );

    logInfo("Focus Mode entered");
  }

  /**
   * Exit Focus Mode - restore normal page layout
   * @returns {void}
   */
  exitFocusMode() {
    if (!this.isFocusMode) return;

    // Deactivate focus mode
    document.body.classList.remove("resume-focus-mode");
    this.isFocusMode = false;

    // Restore scroll position
    if (this.savedScrollPosition !== undefined) {
      window.scrollTo(0, this.savedScrollPosition);
      this.savedScrollPosition = undefined;
    }

    // Update button state
    if (this.elements.focusModeBtn) {
      this.elements.focusModeBtn.setAttribute("aria-pressed", "false");
      this.elements.focusModeBtn.innerHTML = `${getIcon(
        "fullscreenEnter",
      )} Focus Mode`;
    }

    // Announce to screen readers
    this.announceToScreenReader("Exited Focus Mode");

    logInfo("Focus Mode exited");
  }

  /**
   * Toggle Focus Mode on/off
   * @returns {void}
   */
  toggleFocusMode() {
    if (this.isFocusMode) {
      this.exitFocusMode();
    } else {
      this.enterFocusMode();
    }
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   * @private
   */
  announceToScreenReader(message) {
    const announcer = document.getElementById("radioSRannounce");
    if (announcer) {
      announcer.textContent = message;
      setTimeout(() => {
        announcer.textContent = "";
      }, 3000);
    }
  }

  /**
   * Handle MMD textarea input
   * Integrates with MMDEditorPersistence for auto-save and undo/redo
   * @private
   */
  handleMmdInput() {
    this.hasUnsavedChanges = true;

    // Update session status to modified immediately
    this.updateSessionStatus("modified");

    // Phase 8.3.4: Mark confidence data as stale when content changes
    this.markConfidenceAsStale();

    // Auto-resize textarea to fit new content
    this.autoResizeTextarea();

    // Get current content
    const content = this.elements.mmdEditorTextarea?.value || "";

    // Always use session restorer's own auto-save in Resume Mode
    // The persistence module uses different storage keys
    this.scheduleAutoSave(content);

    // Debounced preview update
    clearTimeout(this.previewDebounce);
    this.previewDebounce = setTimeout(() => {
      this.updatePreview(content);

      // Also update code element
      if (this.elements.mmdCodeElement) {
        this.elements.mmdCodeElement.textContent = content;
        if (typeof Prism !== "undefined") {
          Prism.highlightElement(this.elements.mmdCodeElement);
        }
      }

      // Update stored current content
      if (this.restoredSession) {
        this.restoredSession.currentMMD = content;
      }
    }, 300);
  }

  // ==========================================================================
  // PHASE 8.3.4: CONFIDENCE HIGHLIGHTING
  // ==========================================================================

  /**
   * Toggle confidence highlighting in the MMD code view
   * @param {boolean} enabled - Whether to enable highlighting
   */
  toggleConfidenceHighlighting(enabled) {
    logDebug("Toggling confidence highlighting:", enabled);

    this.isConfidenceEnabled = enabled;

    // Update UI state
    if (this.elements.mmdCodeContainer) {
      this.elements.mmdCodeContainer.classList.toggle(
        "mmd-confidence-enabled",
        enabled,
      );
    }

    if (enabled) {
      // Build confidence map if not already done
      if (!this.confidenceMapper) {
        this.initConfidenceMapper();
      }

      // Phase 8.3.5: Use line-based editor instead of gutter
      // Pass current edit state to determine if content is editable
      const isEditing =
        this.elements.mmdCodeContainer?.dataset.editing === "true";
      this.renderLineBasedConfidenceEditor(isEditing);

      // Announce to screen reader
      this.announceToScreenReader("Confidence highlighting enabled");
    } else {
      // Phase 8.3.5: Destroy line-based editor and restore textarea
      this.destroyLineBasedEditor();

      // Clear old gutter (legacy cleanup)
      this.clearConfidenceGutter();

      // Announce to screen reader
      this.announceToScreenReader("Confidence highlighting disabled");
    }

    // Update toggle button state
    if (this.elements.confidenceCheckbox) {
      this.elements.confidenceCheckbox.checked = enabled;
    }
  }
  /**
   * Initialise the confidence mapper with current session data
   * @private
   */
  initConfidenceMapper() {
    logDebug("Initialising confidence mapper");

    // Check if MathPixConfidenceMapper class is available
    if (typeof window.MathPixConfidenceMapper !== "function") {
      logWarn("MathPixConfidenceMapper not loaded");
      return;
    }

    // Create mapper instance
    this.confidenceMapper = new window.MathPixConfidenceMapper();

    // Build initial map
    const linesData = this.restoredSession?.linesData;
    const mmdContent = this.restoredSession?.currentMMD;

    if (linesData && mmdContent) {
      this.confidenceMapper.buildConfidenceMap(linesData, mmdContent);

      const stats = this.confidenceMapper.getStats();
      logInfo("Confidence map built:", stats);

      // Show review warning if many low-confidence lines
      const lowConfidenceCount = stats.low + stats.veryLow;
      if (lowConfidenceCount > 0) {
        this.showConfidenceWarning(lowConfidenceCount);
      }
    } else {
      logWarn("Cannot build confidence map - missing data");
    }
  }

  /**
   * Render confidence indicators in the gutter
   * @private
   */
  renderConfidenceGutter() {
    const gutter = this.elements.confidenceGutter;
    if (!gutter || !this.confidenceMapper) {
      logDebug("Cannot render gutter - missing elements or mapper");
      return;
    }

    // Clear existing indicators
    gutter.innerHTML = "";

    // Get the code element to calculate line heights
    const codeElement = this.elements.mmdCodeElement;
    if (!codeElement) {
      logDebug("Cannot render gutter - no code element");
      return;
    }

    // Get the scrollable container to match gutter height to content
    const formatContent = this.elements.mmdCodeContainer?.querySelector(
      ".mathpix-format-content",
    );
    if (formatContent) {
      // Set gutter height to match full scrollable content
      gutter.style.height = `${formatContent.scrollHeight}px`;
      logDebug(`Set gutter height to ${formatContent.scrollHeight}px`);
    }

    // Calculate line height from computed styles
    const computedStyle = getComputedStyle(codeElement);
    const lineHeight = parseFloat(computedStyle.lineHeight);
    const fontSize = parseFloat(computedStyle.fontSize);

    // Use line height if valid, otherwise estimate from font size
    this.gutterLineHeight =
      !isNaN(lineHeight) && lineHeight > 0 ? lineHeight : fontSize * 1.5 || 20;

    // Get padding-top from the pre element to offset indicators
    const preElement = codeElement.closest("pre");
    const prePaddingTop = preElement
      ? parseFloat(getComputedStyle(preElement).paddingTop) || 0
      : 0;

    // Get confidence map
    const map = this.confidenceMapper.confidenceMap;
    if (map.size === 0) {
      logDebug("No confidence data to render");
      return;
    }

    // Create indicators for each mapped line
    const fragment = document.createDocumentFragment();

    map.forEach((data, lineNumber) => {
      const indicator = this.createConfidenceIndicator(
        lineNumber,
        data,
        prePaddingTop,
      );
      fragment.appendChild(indicator);
    });

    gutter.appendChild(fragment);

    // Mark as stale if mapper indicates content changed
    if (this.confidenceMapper.isStale) {
      gutter.classList.add("mmd-confidence--stale");
    } else {
      gutter.classList.remove("mmd-confidence--stale");
    }

    logDebug(
      `Rendered ${map.size} confidence indicators (line height: ${this.gutterLineHeight}px)`,
    );
  }

  /**
   * Create a confidence indicator element for a line
   * @param {number} lineNumber - 1-indexed line number
   * @param {Object} data - Confidence data
   * @param {number} paddingTop - Top padding offset
   * @returns {HTMLElement} Indicator element
   * @private
   */
  createConfidenceIndicator(lineNumber, data, paddingTop = 0) {
    const indicator = document.createElement("button");
    indicator.type = "button";
    indicator.className = `mmd-confidence-indicator ${data.level.cssClass}`;

    // Position based on line number (0-indexed for calculation)
    // Center the indicator vertically within the line
    const topPosition =
      paddingTop +
      (lineNumber - 1) * this.gutterLineHeight +
      this.gutterLineHeight / 2 -
      7;
    indicator.style.top = `${topPosition}px`;

    // Accessibility attributes
    const percentText = this.confidenceMapper.formatConfidencePercent(
      data.confidence,
    );
    indicator.setAttribute(
      "aria-label",
      this.confidenceMapper.buildAccessibleLabel(lineNumber),
    );
    indicator.setAttribute("tabindex", "0");
    indicator.setAttribute(
      "title",
      `Line ${lineNumber}: ${percentText} (${data.level.name})`,
    );
    indicator.dataset.lineNumber = lineNumber;
    indicator.dataset.confidence = data.confidence;

    // Click handler - scroll to line (for when gutter is taller than viewport)
    indicator.addEventListener("click", () => {
      this.scrollToLine(lineNumber);
    });

    return indicator;
  }

  /**
   * Create a confidence indicator element for a line
   * @param {number} lineNumber - 1-indexed line number
   * @param {Object} data - Confidence data
   * @returns {HTMLElement} Indicator element
   * @private
   */
  createConfidenceIndicator(lineNumber, data) {
    const indicator = document.createElement("button");
    indicator.type = "button";
    indicator.className = `mmd-confidence-indicator ${data.level.cssClass}`;

    // Position based on line number
    const topPosition = (lineNumber - 1) * this.gutterLineHeight + 4;
    indicator.style.top = `${topPosition}px`;

    // Accessibility attributes
    const percentText = this.confidenceMapper.formatConfidencePercent(
      data.confidence,
    );
    indicator.setAttribute(
      "aria-label",
      this.confidenceMapper.buildAccessibleLabel(lineNumber),
    );
    indicator.setAttribute("tabindex", "0");
    indicator.dataset.lineNumber = lineNumber;
    indicator.dataset.confidence = data.confidence;

    // Tooltip content
    const tooltip = document.createElement("span");
    tooltip.className = "mmd-confidence-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.innerHTML = `
      <strong>Line ${lineNumber}</strong>
      Confidence: ${percentText}<br>
      Level: ${data.level.name}
      ${data.type ? `<br>Type: ${data.type}` : ""}
      ${data.isHandwritten ? "<br><small>(Handwritten)</small>" : ""}
    `;
    indicator.appendChild(tooltip);

    // Click handler - scroll to line
    indicator.addEventListener("click", () => {
      this.scrollToLine(lineNumber);
    });

    return indicator;
  }

  /**
   * Clear the confidence gutter
   * @private
   */
  clearConfidenceGutter() {
    if (this.elements.confidenceGutter) {
      this.elements.confidenceGutter.innerHTML = "";
      this.elements.confidenceGutter.classList.remove("mmd-confidence--stale");
    }
  }

  /**
   * Mark confidence data as stale after content edit
   * Called from handleMmdInput when content changes
   * @private
   */
  markConfidenceAsStale() {
    if (this.confidenceMapper && !this.confidenceMapper.isStale) {
      this.confidenceMapper.markAsStale();

      // Update gutter visual state
      if (this.elements.confidenceGutter && this.isConfidenceEnabled) {
        this.elements.confidenceGutter.classList.add("mmd-confidence--stale");
      }

      logDebug("Confidence data marked as stale");
    }
  }

  // =========================================================================
  // LINE-BASED CONFIDENCE EDITOR (Phase 8.3.5)
  // =========================================================================

  /**
   * Render line-based confidence editor
   * Replaces gutter approach with integrated line-by-line display
   * Each line shows confidence percentage alongside content
   * @param {boolean} [editable=false] - Whether content should be editable
   * @private
   */
  renderLineBasedConfidenceEditor(editable = false) {
    const textarea = this.elements.mmdEditorTextarea;
    const formatContent = this.elements.mmdCodeContainer?.querySelector(
      ".mathpix-format-content",
    );
    const codeBlockWrapper = this.elements.mmdCodeContainer?.querySelector(
      ".code-block-wrapper",
    );
    const editorWrapper = document.getElementById("resume-mmd-editor-wrapper");
    const map = this.confidenceMapper?.confidenceMap;

    if (!textarea || !formatContent || !map) {
      logWarn("Cannot render line-based editor - missing elements");
      return;
    }

    // Hide the original textarea
    textarea.style.display = "none";

    // Hide the code-block-wrapper (code view)
    if (codeBlockWrapper) {
      codeBlockWrapper.style.display = "none";
    }

    // Hide the editor wrapper (contains textarea)
    if (editorWrapper) {
      editorWrapper.style.display = "none";
    }

    // Hide the old gutter
    if (this.elements.confidenceGutter) {
      this.elements.confidenceGutter.style.display = "none";
    }

    // Remove any previous line editor
    const existingEditor = document.getElementById("resume-mmd-line-editor");
    if (existingEditor) existingEditor.remove();

    // Get line data
    const mmdLines = textarea.value.split("\n");
    const textareaStyle = getComputedStyle(textarea);
    const lineHeight = parseFloat(textareaStyle.lineHeight);

    // Helper for confidence styling
    const getConfidenceClass = (confData) => {
      if (!confData) return "mmd-confidence--none";
      return confData.level?.cssClass || "mmd-confidence--none";
    };

    const getConfidenceLabel = (confData) => {
      if (!confData) return "—";
      return Math.round(confData.confidence * 100).toString();
    };

    // Create the line-based editor container
    const editor = document.createElement("div");
    editor.id = "resume-mmd-line-editor";
    editor.setAttribute("role", "application");
    editor.setAttribute(
      "aria-label",
      `MMD editor with ${mmdLines.length} lines. ${
        editable ? "Edit mode active. " : ""
      }Use arrow keys to navigate between lines.`,
    );
    editor.setAttribute(
      "aria-describedby",
      "resume-mmd-line-editor-instructions",
    );

    // Add visually hidden instructions for screen readers
    const instructions = document.createElement("div");
    instructions.id = "resume-mmd-line-editor-instructions";
    instructions.className = "visually-hidden";
    instructions.textContent = editable
      ? "Use Up and Down arrow keys to navigate between lines. Tab to exit the editor."
      : "Use Up and Down arrow keys to navigate between lines. Press Enter or click Edit MMD button to enable editing.";
    editor.appendChild(instructions);
    editor.style.cssText = `
      width: 100%;
      height: 100%;
      overflow: auto;
      font-family: "Consolas", "Monaco", "Courier New", monospace;
      font-size: ${textareaStyle.fontSize};
      line-height: ${lineHeight}px;
      border: 1px solid currentcolor;
      border-radius: 4px;
    `;

    // Set line height as CSS custom property for dynamic sizing
    editor.style.setProperty("--mmd-line-height", `${lineHeight}px`);

    // Create each line
    mmdLines.forEach((content, index) => {
      const lineNum = index + 1;
      const confData = map.get(lineNum);
      const isEdited = this.isLineEdited(index, content);

      // Determine styling: edited lines override confidence
      let confClass, confLabel, ariaLabel, titleText;

      if (isEdited) {
        confClass = "mmd-confidence--edited";
        confLabel = null; // Will use pencil icon
        ariaLabel = `Line ${lineNum}, edited`;
        titleText = `Line ${lineNum}: Edited (original confidence no longer applies)`;
      } else {
        confClass = getConfidenceClass(confData);
        const confLevelName = confData?.level?.name || "No data";
        const confPercent = confData
          ? Math.round(confData.confidence * 100)
          : null;
        confLabel = getConfidenceLabel(confData);
        ariaLabel =
          confPercent !== null
            ? `Line ${lineNum}, ${confPercent}% confidence, ${confLevelName}`
            : `Line ${lineNum}, no confidence data`;
        titleText = confData
          ? `Line ${lineNum}: ${confPercent}% (${confLevelName})`
          : `Line ${lineNum}: No OCR data`;
      }

      const lineDiv = document.createElement("div");
      lineDiv.className = `mmd-editor-line ${confClass}`;
      lineDiv.dataset.line = lineNum;
      lineDiv.setAttribute("role", "group");
      lineDiv.setAttribute("aria-label", ariaLabel);

      // Confidence label (hidden from screen readers - info in parent aria-label)
      const confSpan = document.createElement("span");
      confSpan.className = "line-confidence";
      confSpan.setAttribute("aria-hidden", "true");
      confSpan.title = titleText;

      if (isEdited) {
        // Show pencil icon for edited lines
        confSpan.appendChild(this.createPencilIcon());
      } else {
        confSpan.textContent = confLabel;
      }

      // Content span (editable when in edit mode)
      const contentSpan = document.createElement("span");
      contentSpan.className = "line-content";
      contentSpan.setAttribute("contenteditable", editable.toString());
      contentSpan.setAttribute("role", editable ? "textbox" : "presentation");
      contentSpan.setAttribute("aria-label", `Line ${lineNum} content`);
      contentSpan.setAttribute("tabindex", editable ? "0" : "-1");
      contentSpan.dataset.lineIndex = index; // For keyboard navigation
      contentSpan.textContent = content;

      lineDiv.appendChild(confSpan);
      lineDiv.appendChild(contentSpan);
      editor.appendChild(lineDiv);
    });

    // Add to format content container (visible in both view and edit modes)
    formatContent.appendChild(editor);

    // Sync back to textarea on changes and update edit status
    editor.addEventListener("input", (event) => {
      this.syncLineEditorToTextarea();
      this.updateLineEditStatus(event.target);
    });

    // Keyboard navigation for line-based editor
    editor.addEventListener("keydown", (event) => {
      this.handleLineEditorKeydown(event);
    });

    // Store reference
    this.lineBasedEditor = editor;

    logDebug(`Created line-based editor with ${mmdLines.length} lines`);
  }

  /**
   * Sync line-based editor content back to textarea
   * Called on input events to keep textarea in sync for form submission
   * @private
   */
  syncLineEditorToTextarea() {
    if (!this.lineBasedEditor || !this.elements.mmdEditorTextarea) return;

    const lines = this.lineBasedEditor.querySelectorAll(".line-content");
    const content = Array.from(lines)
      .map((el) => el.textContent)
      .join("\n");
    this.elements.mmdEditorTextarea.value = content;

    // Trigger input event for any listeners
    this.elements.mmdEditorTextarea.dispatchEvent(
      new Event("input", { bubbles: true }),
    );
  }

  /**
   * Destroy line-based editor and restore textarea
   * @private
   */
  destroyLineBasedEditor() {
    if (this.lineBasedEditor) {
      // Sync final content
      this.syncLineEditorToTextarea();

      // Remove editor
      this.lineBasedEditor.remove();
      this.lineBasedEditor = null;
    }

    // Restore code-block-wrapper
    const codeBlockWrapper = this.elements.mmdCodeContainer?.querySelector(
      ".code-block-wrapper",
    );
    if (codeBlockWrapper) {
      codeBlockWrapper.style.display = "";
    }

    // Restore editor wrapper
    const editorWrapper = document.getElementById("resume-mmd-editor-wrapper");
    if (editorWrapper) {
      editorWrapper.style.display = "";
    }

    // Restore textarea
    if (this.elements.mmdEditorTextarea) {
      this.elements.mmdEditorTextarea.style.display = "";
    }

    // Restore gutter (will be hidden if confidence disabled)
    if (this.elements.confidenceGutter) {
      this.elements.confidenceGutter.style.display = "";
    }

    logDebug("Destroyed line-based editor");
  }

  /**
   * Handle keyboard navigation in line-based editor
   * Enables arrow key navigation between lines
   * @param {KeyboardEvent} event - The keyboard event
   * @private
   */
  handleLineEditorKeydown(event) {
    if (!this.lineBasedEditor) return;

    const activeElement = document.activeElement;
    const isLineContent = activeElement?.classList.contains("line-content");

    if (!isLineContent) return;

    const currentIndex = parseInt(activeElement.dataset.lineIndex, 10);
    const allLineContents = Array.from(
      this.lineBasedEditor.querySelectorAll(".line-content"),
    );
    const totalLines = allLineContents.length;

    // Helper to check if cursor is at start/end of line
    const getCursorPosition = () => {
      const selection = window.getSelection();
      if (!selection.rangeCount) return { atStart: true, atEnd: true };

      const range = selection.getRangeAt(0);
      const textLength = activeElement.textContent?.length || 0;

      return {
        atStart: range.startOffset === 0 && range.collapsed,
        atEnd: range.endOffset >= textLength && range.collapsed,
      };
    };

    // Helper to move focus to a line
    const focusLine = (index, cursorPosition = "start") => {
      const targetLine = allLineContents[index];
      if (!targetLine) return;

      targetLine.focus();

      // Position cursor at start or end
      const textNode = targetLine.firstChild;
      if (textNode && window.getSelection) {
        const selection = window.getSelection();
        const range = document.createRange();

        if (cursorPosition === "end" && textNode.nodeType === Node.TEXT_NODE) {
          range.setStart(textNode, textNode.length);
          range.setEnd(textNode, textNode.length);
        } else {
          range.setStart(targetLine, 0);
          range.setEnd(targetLine, 0);
        }

        selection.removeAllRanges();
        selection.addRange(range);
      }
    };

    const { atStart, atEnd } = getCursorPosition();

    switch (event.key) {
      case "ArrowUp":
        // Move to previous line if at start of current line or with Ctrl
        if (event.ctrlKey || atStart) {
          if (currentIndex > 0) {
            event.preventDefault();
            focusLine(currentIndex - 1, "end");
          }
        }
        break;

      case "ArrowDown":
        // Move to next line if at end of current line or with Ctrl
        if (event.ctrlKey || atEnd) {
          if (currentIndex < totalLines - 1) {
            event.preventDefault();
            focusLine(currentIndex + 1, "start");
          }
        }
        break;

      case "Home":
        // Ctrl+Home: Go to first line
        if (event.ctrlKey) {
          event.preventDefault();
          focusLine(0, "start");
        }
        break;

      case "End":
        // Ctrl+End: Go to last line
        if (event.ctrlKey) {
          event.preventDefault();
          focusLine(totalLines - 1, "end");
        }
        break;

      case "Escape":
        // Blur the editor (handled by document-level listener)
        // But also remove focus from current line
        activeElement.blur();
        break;
    }
  }

  /**
   * Create pencil SVG icon for edited lines
   * @returns {SVGElement} Pencil icon
   * @private
   */
  createPencilIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("viewBox", "0 0 21 21");
    svg.setAttribute("aria-hidden", "true");

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", "currentColor");
    g.setAttribute("stroke-linecap", "round");
    g.setAttribute("stroke-linejoin", "round");
    g.setAttribute("transform", "translate(3 3)");

    const path1 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    path1.setAttribute(
      "d",
      "m14 1c.8284271.82842712.8284271 2.17157288 0 3l-9.5 9.5-4 1 1-3.9436508 9.5038371-9.55252193c.7829896-.78700064 2.0312313-.82943964 2.864366-.12506788z",
    );

    const path2 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    path2.setAttribute("d", "m6.5 14.5h8");

    const path3 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    path3.setAttribute("d", "m12.5 3.5 1 1");

    g.appendChild(path1);
    g.appendChild(path2);
    g.appendChild(path3);
    svg.appendChild(g);

    return svg;
  }

  /**
   * Check if a line has been edited from the original OCR output
   * @param {number} lineIndex - Zero-based line index
   * @param {string} currentContent - Current line content
   * @returns {boolean} True if line differs from original
   * @private
   */
  isLineEdited(lineIndex, currentContent) {
    if (!this.originalMmdLines) return false;
    const originalContent = this.originalMmdLines[lineIndex];
    if (originalContent === undefined) return true; // New line added
    return originalContent !== currentContent;
  }

  /**
   * Update a single line's edit status after user input
   * @param {HTMLElement} target - The edited element
   * @private
   */
  updateLineEditStatus(target) {
    // Find the line content element
    const lineContent = target.closest(".line-content") || target;
    if (!lineContent.classList.contains("line-content")) return;

    const lineDiv = lineContent.closest(".mmd-editor-line");
    if (!lineDiv) return;

    const lineIndex = parseInt(lineContent.dataset.lineIndex, 10);
    const currentContent = lineContent.textContent;
    const isEdited = this.isLineEdited(lineIndex, currentContent);
    const lineNum = lineIndex + 1;

    const confSpan = lineDiv.querySelector(".line-confidence");
    if (!confSpan) return;

    // Update class
    const wasEdited = lineDiv.classList.contains("mmd-confidence--edited");

    if (isEdited && !wasEdited) {
      // Line became edited - remove old confidence class, add edited
      lineDiv.className = lineDiv.className
        .replace(/mmd-confidence--\w+/g, "")
        .trim();
      lineDiv.classList.add("mmd-editor-line", "mmd-confidence--edited");

      // Update confidence span
      confSpan.textContent = "";
      confSpan.appendChild(this.createPencilIcon());
      confSpan.title = `Line ${lineNum}: Edited (original confidence no longer applies)`;

      // Update ARIA
      lineDiv.setAttribute("aria-label", `Line ${lineNum}, edited`);

      logDebug(`Line ${lineNum} marked as edited`);
    } else if (!isEdited && wasEdited) {
      // Line restored to original - restore confidence display
      const map = this.confidenceMapper?.confidenceMap;
      const confData = map?.get(lineNum);

      const getConfidenceClass = (data) => {
        if (!data) return "mmd-confidence--none";
        return data.level?.cssClass || "mmd-confidence--none";
      };

      const getConfidenceLabel = (data) => {
        if (!data) return "—";
        return Math.round(data.confidence * 100).toString();
      };

      const confClass = getConfidenceClass(confData);
      const confLevelName = confData?.level?.name || "No data";
      const confPercent = confData
        ? Math.round(confData.confidence * 100)
        : null;

      // Update class
      lineDiv.className = `mmd-editor-line ${confClass}`;

      // Update confidence span
      confSpan.textContent = getConfidenceLabel(confData);
      confSpan.title = confData
        ? `Line ${lineNum}: ${confPercent}% (${confLevelName})`
        : `Line ${lineNum}: No OCR data`;

      // Update ARIA
      lineDiv.setAttribute(
        "aria-label",
        confPercent !== null
          ? `Line ${lineNum}, ${confPercent}% confidence, ${confLevelName}`
          : `Line ${lineNum}, no confidence data`,
      );

      logDebug(`Line ${lineNum} restored to original`);
    }
  }

  /**
   * Store original MMD content for edit comparison
   * Called during session restoration
   * @param {string} originalMmd - Original MMD content from OCR
   */
  setOriginalMmdContent(originalMmd) {
    if (originalMmd) {
      this.originalMmdLines = originalMmd.split("\n");
      logDebug(
        `Stored ${this.originalMmdLines.length} original lines for edit tracking`,
      );
    }
  }

  /**
   * Scroll the code view to a specific line
   * @param {number} lineNumber - 1-indexed line number
   */
  scrollToLine(lineNumber) {
    const container = this.elements.mmdCodeContainer;
    const codeElement = this.elements.mmdCodeElement;

    if (!container || !codeElement) return;

    // Calculate scroll position
    const lineTop = (lineNumber - 1) * this.gutterLineHeight;
    const containerHeight = container.clientHeight;
    const scrollTarget = lineTop - containerHeight / 3;

    // Smooth scroll to line
    container.scrollTo({
      top: Math.max(0, scrollTarget),
      behavior: "smooth",
    });

    logDebug(`Scrolled to line ${lineNumber}`);
  }

  /**
   * Show confidence toggle when PDF with lines data is loaded
   * @private
   */
  showConfidenceToggle() {
    if (this.elements.confidenceToggle) {
      this.elements.confidenceToggle.hidden = false;
      logDebug("Confidence toggle shown");
    }
  }

  /**
   * Hide confidence toggle (for non-PDF sources)
   * @private
   */
  hideConfidenceToggle() {
    if (this.elements.confidenceToggle) {
      this.elements.confidenceToggle.hidden = true;
    }

    // Also disable highlighting if it was on
    if (this.isConfidenceEnabled) {
      this.toggleConfidenceHighlighting(false);
    }
  }

  /**
   * Show warning about low-confidence lines
   * @param {number} count - Number of low-confidence lines
   * @private
   */
  showConfidenceWarning(count) {
    // Use existing notification system
    const message = `${count} line${
      count !== 1 ? "s" : ""
    } may need review (low OCR confidence)`;

    if (typeof notifyInfo === "function") {
      notifyInfo(message, { duration: 5000 });
    } else {
      logInfo(message);
    }
  }

  /**
   * Refresh confidence mapping after content changes
   * Can be called manually if user wants to re-map after edits
   */
  refreshConfidenceMapping() {
    if (!this.confidenceMapper || !this.restoredSession) {
      logWarn("Cannot refresh - no mapper or session");
      return;
    }

    const linesData = this.restoredSession.linesData;
    const currentContent = this.restoredSession.currentMMD;

    this.confidenceMapper.refreshMapping(linesData, currentContent);

    // Re-render gutter if enabled
    if (this.isConfidenceEnabled) {
      this.renderConfidenceGutter();
    }

    this.announceToScreenReader("Confidence mapping refreshed");
    logInfo("Confidence mapping refreshed");
  }

  /**
   * Update session status indicator
   * @param {string} state - 'modified', 'saving', or 'saved'
   * @private
   */
  updateSessionStatus(state) {
    const statusText = {
      modified: RESTORER_CONFIG.MESSAGES.SESSION_MODIFIED,
      saving: "Saving...",
      saved: RESTORER_CONFIG.MESSAGES.SESSION_SAVED,
    };

    const text = statusText[state] || state;

    if (this.elements.mmdSessionStatus) {
      this.elements.mmdSessionStatus.textContent = text;
      this.elements.mmdSessionStatus.dataset.state = state;
    }
    if (this.elements.sessionStatus) {
      this.elements.sessionStatus.textContent = text;
      this.elements.sessionStatus.dataset.state = state;
    }

    logDebug("Session status updated:", state);
  }

  /**
   * Schedule auto-save with debounce (fallback if persistence module unavailable)
   * @param {string} content - Content to save
   * @private
   */
  scheduleAutoSave(content) {
    clearTimeout(this.autoSaveTimer);

    this.autoSaveTimer = setTimeout(() => {
      this.saveContentToStorage(content);
    }, 1000); // 1 second debounce
  }

  /**
   * Save content to localStorage
   * @param {string} content - Content to save
   * @private
   */
  saveContentToStorage(content) {
    this.updateSessionStatus("saving");

    try {
      // Push to undo stack before saving
      if (
        this.restoredSession?.currentMMD &&
        this.restoredSession.currentMMD !== content
      ) {
        this.pushToUndoStack(this.restoredSession.currentMMD);
      }

      // Update current content
      if (this.restoredSession) {
        this.restoredSession.currentMMD = content;
        this.restoredSession.lastModified = Date.now();

        // Use the full storage key (with mathpix-resume-session- prefix)
        // This must match the key used in startPersistenceSession
        const storageKey =
          this.restoredSession.storageKey ||
          (this.restoredSession.sessionKey
            ? `mathpix-resume-session-${this.restoredSession.sessionKey}`
            : "mathpix-resume-session-fallback");

        const sessionData = {
          // Session identification
          key: this.restoredSession.sessionKey,
          storageKey: storageKey,

          // Source file info
          sourceFileName: this.restoredSession.source?.filename || "",

          // Content
          original: this.restoredSession.originalMMD,
          baseline: this.restoredSession.baselineMMD, // Content at session start
          current: content,

          // Edit history
          undoStack: this.undoStack || [],
          redoStack: this.redoStack || [],

          // Timestamps
          lastModified: Date.now(),
        };

        localStorage.setItem(storageKey, JSON.stringify(sessionData));
        logDebug("Saved to localStorage:", storageKey);
      }

      this.updateSessionStatus("saved");
      this.hasUnsavedChanges = false;

      logDebug("Content auto-saved");
    } catch (error) {
      logError("Failed to auto-save:", error);
      this.updateSessionStatus("modified"); // Revert to modified on error
    }
  }
  /**
   * Push content to undo stack
   * @param {string} content - Content to push
   * @private
   */
  pushToUndoStack(content) {
    if (!content) return;

    this.undoStack.push(content);

    // Limit stack size
    if (this.undoStack.length > this.maxUndoLevels) {
      this.undoStack.shift();
    }

    // Clear redo stack on new changes
    this.redoStack = [];

    // Update button states
    this.updateUndoRedoButtons();

    logDebug("Pushed to undo stack:", { stackSize: this.undoStack.length });
  }

  /**
   * Undo last edit
   * @private
   */
  undoEdit() {
    logDebug("Undo edit requested");

    // Try persistence module first
    const persistence = window.getMathPixMMDPersistence?.();
    if (persistence && persistence.hasSession()) {
      const result = persistence.undo();
      if (result) {
        // Sync our state with persistence
        this.syncFromPersistence();
        return;
      }
    }

    // Fallback to our own stack
    if (this.undoStack.length === 0) {
      this.showNotification("Nothing to undo", "info");
      return;
    }

    // Push current to redo
    const current = this.getCurrentMMDContent();
    if (current) {
      this.redoStack.push(current);
    }

    // Pop from undo
    const previousContent = this.undoStack.pop();

    // Apply content
    this.loadMMDContent(
      previousContent,
      this.restoredSession?.originalMMD || previousContent,
    );
    if (this.restoredSession) {
      this.restoredSession.currentMMD = previousContent;
    }

    // Update UI
    this.updateUndoRedoButtons();
    this.updateSessionStatus("saved");
    this.hasUnsavedChanges = false;

    this.showNotification("Change undone", "success");
    logDebug("Undo applied, remaining:", this.undoStack.length);
  }

  /**
   * Redo last undone edit
   * @private
   */
  redoEdit() {
    logDebug("Redo edit requested");

    // Try persistence module first
    const persistence = window.getMathPixMMDPersistence?.();
    if (persistence && persistence.hasSession()) {
      const result = persistence.redo();
      if (result) {
        // Sync our state with persistence
        this.syncFromPersistence();
        return;
      }
    }

    // Fallback to our own stack
    if (this.redoStack.length === 0) {
      this.showNotification("Nothing to redo", "info");
      return;
    }

    // Push current to undo
    const current = this.getCurrentMMDContent();
    if (current) {
      this.undoStack.push(current);
    }

    // Pop from redo
    const nextContent = this.redoStack.pop();

    // Apply content
    this.loadMMDContent(
      nextContent,
      this.restoredSession?.originalMMD || nextContent,
    );
    if (this.restoredSession) {
      this.restoredSession.currentMMD = nextContent;
    }

    // Update UI
    this.updateUndoRedoButtons();
    this.updateSessionStatus("saved");
    this.hasUnsavedChanges = false;

    this.showNotification("Change redone", "success");
    logDebug("Redo applied, remaining:", this.redoStack.length);
  }

  /**
   * Update undo/redo button states
   * @private
   */
  updateUndoRedoButtons() {
    // Check persistence module first
    const persistence = window.getMathPixMMDPersistence?.();

    let canUndo = this.undoStack.length > 0;
    let canRedo = this.redoStack.length > 0;

    if (persistence && persistence.hasSession()) {
      canUndo = canUndo || persistence.session?.undoStack?.length > 0;
      canRedo = canRedo || persistence.session?.redoStack?.length > 0;
    }

    if (this.elements.mmdUndoBtn) {
      this.elements.mmdUndoBtn.disabled = !canUndo;
    }
    if (this.elements.mmdRedoBtn) {
      this.elements.mmdRedoBtn.disabled = !canRedo;
    }

    logDebug("Undo/redo buttons updated:", { canUndo, canRedo });
  }

  /**
   * Sync state from persistence module after undo/redo
   * @private
   */
  syncFromPersistence() {
    const persistence = window.getMathPixMMDPersistence?.();
    if (!persistence || !persistence.session) return;

    const content = persistence.session.current;
    if (content && this.restoredSession) {
      this.restoredSession.currentMMD = content;

      // Update textarea
      if (this.elements.mmdEditorTextarea) {
        this.elements.mmdEditorTextarea.value = content;
      }

      // Update code element
      if (this.elements.mmdCodeElement) {
        this.elements.mmdCodeElement.textContent = content;
        if (typeof Prism !== "undefined") {
          Prism.highlightElement(this.elements.mmdCodeElement);
        }
      }

      // Update preview
      this.updatePreview(content);
    }

    this.updateUndoRedoButtons();
    this.updateSessionStatus("saved");
  }

  /**
   * Restore original MMD content
   * @private
   */
  restoreOriginal() {
    logDebug("Restoring original MMD content");

    const original = this.restoredSession?.originalMMD;
    if (!original) {
      logWarn("No original MMD content to restore");
      return;
    }

    this.loadMMDContent(original, original);

    if (this.restoredSession) {
      this.restoredSession.currentMMD = original;
    }

    this.hasUnsavedChanges = false;

    // Update status
    if (this.elements.mmdSessionStatus) {
      this.elements.mmdSessionStatus.textContent = "Restored";
      this.elements.mmdSessionStatus.dataset.state = "saved";
    }

    this.showNotification("Original content restored", "success");
  }

  /**
   * Clear current session
   * @private
   */
  clearSession() {
    logDebug("Clearing session");

    if (this.hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Clear session anyway?")) {
        return;
      }
    }

    // Clear stored session
    if (this.restoredSession?.sessionKey) {
      try {
        localStorage.removeItem(
          `mathpix-resume-session-${this.restoredSession.sessionKey}`,
        );
      } catch (error) {
        logWarn("Failed to remove session from localStorage:", error);
      }
    }

    this.restoredSession = null;
    this.hasUnsavedChanges = false;

    this.resetToUploadState();
    this.showNotification("Session cleared", "info");
  }

  /**
   * Download current MMD content
   * @private
   */
  downloadMmd() {
    logDebug("Downloading MMD content");

    const content = this.getCurrentMMDContent();
    if (!content) {
      this.showNotification("No content to download", "warning");
      return;
    }

    const filename = this.restoredSession?.source?.filename || "document";
    const baseName = filename.replace(/\.[^/.]+$/, "");
    const downloadName = `${baseName}-edited.mmd`;

    const blob = new Blob([content], { type: "text/x-mmd" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    this.showNotification(`Downloaded ${downloadName}`, "success");
  }

  /**
   * Handle MMD file upload
   * @param {Event} e - Change event
   * @private
   */
  handleMmdUpload(e) {
    const file = e.target?.files?.[0];
    if (!file) return;

    logDebug("Loading MMD file:", file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        if (this.elements.mmdEditorTextarea) {
          this.elements.mmdEditorTextarea.value = content;
        }
        this.handleMmdInput();
        this.showNotification(`Loaded ${file.name}`, "success");
      }
    };
    reader.onerror = () => {
      this.showNotification("Failed to read file", "error");
    };
    reader.readAsText(file);

    // Reset input
    if (e.target) {
      e.target.value = "";
    }
  }

  // =========================================================================
  // UPDATED ZIP DOWNLOAD
  // =========================================================================

  /**
   * Download updated ZIP with new edits/conversions
   * Uses MathPixTotalDownloader.createArchive() API
   *
   * Data structure requirements:
   * - sourceState.file: File object (for source folder)
   * - formats: Object with format keys (for results folder)
   * - Persistence session: For edits folder
   * - ConvertUI.getCompletedDownloadsWithFilenames: For converted folder
   */
  async downloadUpdatedZIP() {
    logInfo("Creating updated ZIP archive");

    try {
      // Check if MathPixTotalDownloader class is available
      if (typeof window.MathPixTotalDownloader === "undefined") {
        this.showNotification(
          "ZIP downloader not available. Ensure mathpix-total-downloader.js is loaded.",
          "error",
        );
        return;
      }

      // Check if JSZip is available (required by downloader)
      if (typeof JSZip === "undefined") {
        this.showNotification(
          "JSZip library not available. ZIP creation requires JSZip.",
          "error",
        );
        return;
      }

      // Create downloader instance
      const downloader = new window.MathPixTotalDownloader(null);

      // Initialize the downloader
      const initResult = downloader.initialize();
      if (!initResult) {
        this.showNotification("Failed to initialise ZIP downloader", "error");
        return;
      }

      // Get current MMD content
      const currentMMD = this.getCurrentMMDContent();
      const originalMMD = this.restoredSession?.originalMMD || "";
      const hasEdits = currentMMD !== originalMMD;

      // =========================================================================
      // FIX 1: Properly build source File object for source folder
      // =========================================================================
      const sourceFilename =
        this.restoredSession?.source?.filename || "source-document";
      let sourceFile = null;

      if (this.restoredSession?.source?.blob) {
        // Create a proper File object from the blob with original filename
        const blob = this.restoredSession.source.blob;
        const mimeType =
          blob.type ||
          (this.restoredSession?.isPDF ? "application/pdf" : "image/png");
        sourceFile = new File([blob], sourceFilename, { type: mimeType });
        logDebug("Created source File object:", {
          name: sourceFile.name,
          size: sourceFile.size,
          type: sourceFile.type,
        });
      }

      const sourceState = {
        sourceType: this.restoredSession?.isPDF ? "upload" : "upload",
        file: sourceFile,
      };

      // =========================================================================
      // FIX 2: Set up persistence session for edits folder
      // =========================================================================
      if (hasEdits) {
        this.setupPersistenceForEdits(currentMMD, originalMMD, sourceFilename);
      }

      // =========================================================================
      // FIX 3: Set up ConvertUI for converted folder
      // =========================================================================
      if (this.conversionResults && this.conversionResults.size > 0) {
        this.setupConvertUIForDownload(sourceFilename);
      }

      // Build formats object with TRUE ORIGINAL MMD (not edited content)
      // The /results/ folder should contain the original MathPix output
      // User edits go in /edits/ via collectMMDEdits()
      const trueOriginalMMD = this.restoredSession?.results?.mmd || originalMMD;

      const formats = {
        mmd: trueOriginalMMD,
      };

      // Add any other results from original session
      if (this.restoredSession?.results) {
        Object.entries(this.restoredSession.results).forEach(([key, value]) => {
          if (key !== "mmd" && value) {
            formats[key] = value;
          }
        });
      }

      logDebug("Formats prepared for archive:", {
        usingTrueOriginal: formats.mmd === trueOriginalMMD,
        originalLength: trueOriginalMMD?.length || 0,
        currentLength: currentMMD?.length || 0,
        hasEditsToCollect: hasEdits,
      });

      // Detect API type for result file collection
      if (this.restoredSession?.isPDF) {
        formats.pdf_id = "restored"; // Marker for PDF API type detection
      }

      // Collect existing edits from the ZIP we resumed from
      // These need to be carried forward to preserve edit history
      const existingEdits = this.parseResult?.edits?.files || [];

      logDebug("Existing edits from ZIP:", {
        count: existingEdits.length,
        filenames: existingEdits.map((e) => e.filename),
      });

      // Combine saved and loaded versions for ZIP inclusion
      const allSavedVersions = [
        ...(this.savedMMDVersions || []),
        ...(this.loadedMMDVersions || []),
      ];

      logDebug("Combined saved and loaded versions:", {
        savedCount: this.savedMMDVersions?.length || 0,
        loadedCount: this.loadedMMDVersions?.length || 0,
        totalCount: allSavedVersions.length,
      });

      // Create archive data matching the expected structure
      const archiveData = {
        sourceState: sourceState,
        formats: formats,
        response: this.restoredSession?.metadata || {},
        linesData: this.restoredSession?.linesData,
        // NEW: Pass existing edits for preservation across sessions
        existingEdits: existingEdits,
        // Pass manually saved versions AND loaded files for inclusion in edits folder
        savedMMDVersions: allSavedVersions,
      };

      logDebug("Archive data prepared:", {
        hasSourceFile: !!sourceState.file,
        sourceFilename: sourceState.file?.name,
        sourceType: sourceState.sourceType,
        formatCount: Object.keys(formats).length,
        hasNewEdits: hasEdits,
        existingEditsCount: existingEdits.length,
        hasLinesData: !!archiveData.linesData,
        hasConversions: this.conversionResults?.size > 0,
      });

      // Create the archive
      await downloader.createArchive(archiveData);

      this.hasUnsavedChanges = false;

      // Track manually saved MMD versions for inclusion in ZIP
      this.savedMMDVersions = [];
      this.showNotification("Updated ZIP downloaded successfully!", "success");

      logInfo("Updated ZIP archive created successfully");
    } catch (error) {
      logError("Failed to create updated ZIP:", error);
      this.showNotification(`Failed to create ZIP: ${error.message}`, "error");
    }
  }

  /**
   * Set up persistence session so the downloader's collectMMDEdits can find our edits
   * The TotalDownloader checks window.getMathPixMMDPersistence().session
   * @param {string} currentMMD - Current edited content
   * @param {string} originalMMD - Original content
   * @param {string} sourceFilename - Source filename for edit naming
   * @private
   */
  setupPersistenceForEdits(currentMMD, originalMMD, sourceFilename) {
    try {
      const persistence = window.getMathPixMMDPersistence?.();

      if (persistence) {
        // Ensure we have a session
        if (!persistence.session) {
          persistence.session = {};
        }

        // Set up the session data that collectMMDEdits expects
        persistence.session.current = currentMMD;
        persistence.session.original = originalMMD;
        persistence.session.sourceFileName = sourceFilename.replace(
          /\.[^/.]+$/,
          "",
        ); // Remove extension
        persistence.session.lastModified = Date.now();

        // Ensure hasSession returns true
        if (!persistence.hasSession) {
          persistence.hasSession = () => true;
        }

        logDebug("Persistence session configured for edits:", {
          originalLength: originalMMD.length,
          currentLength: currentMMD.length,
          sourceFileName: persistence.session.sourceFileName,
        });
      } else {
        logWarn(
          "Persistence module not available - edits may not be collected separately",
        );
      }
    } catch (error) {
      logWarn("Failed to setup persistence for edits:", error);
    }
  }

  /**
   * Register a manually saved MMD version for inclusion in ZIP downloads
   * Called by downloadResumeMMD() when user clicks "Save File"
   * @param {string} filename - The filename used for the save
   * @param {string} content - The MMD content that was saved
   */
  registerSavedMMDVersion(filename, content) {
    if (!filename || !content) {
      logWarn("Cannot register saved version: missing filename or content");
      return;
    }

    // Ensure array exists (defensive initialisation)
    if (!this.savedMMDVersions) {
      this.savedMMDVersions = [];
    }

    // Avoid duplicates - check if this exact content was already saved
    const isDuplicate = this.savedMMDVersions.some(
      (v) => v.content === content,
    );

    if (isDuplicate) {
      logDebug("Skipping duplicate saved version registration");
      return;
    }

    this.savedMMDVersions.push({
      filename: filename,
      content: content,
      savedAt: Date.now(),
    });

    logInfo("Registered saved MMD version:", {
      filename: filename,
      contentLength: content.length,
      totalSavedVersions: this.savedMMDVersions.length,
    });
  }

  /**
   * Register an externally loaded MMD file for integration with session
   * Called by handleResumeMMDFileUpload() when user loads a file via "Load File"
   *
   * This method:
   * 1. Generates a new filename matching source pattern: {sourceBasename}-imported-{timestamp}.mmd
   * 2. Updates the baseline for edit detection (so subsequent edits are compared to loaded content)
   * 3. Stores the loaded filename for use in subsequent saves
   * 4. Registers the loaded file for inclusion in ZIP downloads (with original filename preserved)
   * 5. Updates the persistence session baseline
   *
   * @param {string} filename - The original filename of the loaded file
   * @param {string} content - The loaded file content
   */
  registerLoadedFile(filename, content) {
    if (!filename || !content) {
      logWarn("Cannot register loaded file: missing filename or content");
      return;
    }

    logInfo("Registering loaded file:", {
      originalFilename: filename,
      contentLength: content.length,
    });

    // Generate renamed filename matching source pattern
    const renamedFilename = this.generateImportedFilename(filename);

    logDebug("Generated imported filename:", {
      original: filename,
      renamed: renamedFilename,
    });

    // 1. Update baseline for edit detection
    // After loading a file, we want "has edits" to compare against the loaded content
    if (this.restoredSession) {
      this.restoredSession.baselineMMD = content;
      this.restoredSession.currentMMD = content;

      // Track loaded file info for subsequent saves
      this.restoredSession.loadedFile = {
        filename: renamedFilename, // Use renamed filename
        originalFilename: filename, // Preserve original
        content: content,
        loadedAt: Date.now(),
      };

      logDebug("Updated session baseline to loaded file content");
    }

    // 2. Store loaded filename for use in subsequent saves (without extension)
    // This enables "Save File" to use the source-based filename as base
    const baseName = renamedFilename.replace(/\.[^/.]+$/, ""); // Remove extension
    this.loadedSourceFilename = baseName;

    // 3. Register the loaded file for inclusion in ZIP downloads
    // We treat loaded files similarly to saved versions but mark them distinctly
    if (!this.loadedMMDVersions) {
      this.loadedMMDVersions = [];
    }

    // Check for duplicates by content
    const isDuplicate = this.loadedMMDVersions.some(
      (v) => v.content === content,
    );

    if (!isDuplicate) {
      this.loadedMMDVersions.push({
        filename: renamedFilename, // Use renamed filename for ZIP storage
        originalFilename: filename, // Preserve original for UI display
        content: content,
        loadedAt: new Date().toISOString(),
        isLoadedFile: true, // Distinguish from manual saves
      });

      logDebug("Added to loadedMMDVersions array:", {
        totalLoaded: this.loadedMMDVersions.length,
        storedAs: renamedFilename,
        originalWas: filename,
      });
    }

    // 4. Update the persistence session baseline
    // This ensures the persistence module treats loaded content as the new "original"
    try {
      const persistence = window.getMathPixMMDPersistence?.();
      if (persistence && persistence.session) {
        // Update the baseline - subsequent edits compare against loaded content
        persistence.session.original = content;
        persistence.session.current = content;
        persistence.session.sourceFileName = baseName;
        persistence.session.lastModified = Date.now();

        // Clear undo/redo stacks since we're starting fresh with loaded content
        persistence.session.undoStack = [];
        persistence.session.redoStack = [];

        logDebug("Updated persistence session baseline to loaded content");
      }
    } catch (error) {
      logWarn("Failed to update persistence baseline:", error);
    }

    // 5. Reset unsaved changes flag (loaded content is considered "saved")
    this.hasUnsavedChanges = false;
    this.updateSessionStatus("saved");

    // 6. Update undo/redo stacks for session restorer
    // Push previous content to undo stack before loading new content
    if (this.restoredSession?.currentMMD && this.undoStack) {
      const previousContent =
        this.elements.mmdEditorTextarea?.value ||
        this.restoredSession.currentMMD;

      // Only push if different from what we're loading
      if (previousContent !== content) {
        this.undoStack.push(previousContent);

        // Trim undo stack if too large
        if (this.undoStack.length > this.maxUndoLevels) {
          this.undoStack.shift();
        }

        // Clear redo stack when new content is loaded
        this.redoStack = [];

        this.updateUndoRedoButtons();
        logDebug("Pushed previous content to undo stack");
      }
    }

    logInfo("Loaded file registered successfully:", {
      originalFilename: filename,
      renamedTo: renamedFilename,
      contentLength: content.length,
      baselineUpdated: true,
      persistenceUpdated: !!window.getMathPixMMDPersistence?.()?.session,
    });
  }

  /**
   * Generate an imported filename that matches the source pattern
   * Pattern: {sourceBasename}-imported-{YYYY}-{MM}-{DD}-{HH}-{mm}-{ss}.mmd
   *
   * @param {string} originalFilename - The original filename of the loaded file
   * @returns {string} New filename matching source pattern
   * @private
   */
  generateImportedFilename(originalFilename) {
    // Get source filename from restored session
    const sourceFilename = this.restoredSession?.source?.filename;

    // Extract base name from source (remove extension)
    let sourceBasename = "document"; // Default fallback

    if (sourceFilename) {
      sourceBasename = sourceFilename.replace(/\.[^/.]+$/, "");
    } else {
      logWarn(
        "No source filename available, using default basename for imported file",
      );
    }

    // Generate timestamp: YYYY-MM-DD-HH-mm-ss
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0"),
    ].join("-");

    // Build new filename: {sourceBasename}-imported-{timestamp}.mmd
    const newFilename = `${sourceBasename}-imported-${timestamp}.mmd`;

    logDebug("Generated imported filename:", {
      sourceBasename,
      timestamp,
      newFilename,
    });

    return newFilename;
  }

  /**
   * Get the loaded source filename for use in saves
   * Used by downloadResumeMMD() to generate appropriate filenames
   * @returns {string|null} The loaded filename without extension, or null
   */
  getLoadedSourceFilename() {
    return this.loadedSourceFilename || null;
  }

  /**
   * Get all loaded MMD versions for ZIP inclusion
   * @returns {Array} Array of loaded file objects
   */
  getLoadedMMDVersions() {
    return this.loadedMMDVersions || [];
  }

  /**
   * Set up ConvertUI with our conversion results so collectConvertedFiles can find them
   * The TotalDownloader checks window.getMathPixConvertUI().getCompletedDownloadsWithFilenames()
   * @param {string} sourceFilename - Source filename for conversion naming
   * @private
   */
  setupConvertUIForDownload(sourceFilename) {
    try {
      const convertUI = window.getMathPixConvertUI?.();

      if (
        convertUI &&
        this.conversionResults &&
        this.conversionResults.size > 0
      ) {
        // Clear any existing downloads
        if (convertUI.completedDownloads) {
          convertUI.completedDownloads.clear();
        } else {
          convertUI.completedDownloads = new Map();
        }

        // Set base filename for proper naming
        const baseName = sourceFilename.replace(/\.[^/.]+$/, "");
        if (convertUI.setBaseFilename) {
          convertUI.setBaseFilename(baseName);
        } else {
          convertUI.baseFilename = baseName;
        }

        // Copy our conversion results to convertUI
        this.conversionResults.forEach((blob, format) => {
          convertUI.completedDownloads.set(format, blob);
        });

        // Ensure the method exists that the downloader calls
        if (!convertUI.getCompletedDownloadsWithFilenames) {
          convertUI.getCompletedDownloadsWithFilenames = () => {
            const results = [];
            const formatInfo = {
              docx: { label: "Word Document", extension: ".docx" },
              pdf: { label: "PDF (HTML Rendering)", extension: ".pdf" },
              "tex.zip": { label: "LaTeX (ZIP)", extension: ".tex.zip" },
              "latex.pdf": {
                label: "PDF (LaTeX Rendering)",
                extension: "-latex.pdf",
              },
              html: { label: "HTML", extension: ".html" },
              md: { label: "Markdown", extension: ".md" },
              pptx: { label: "PowerPoint", extension: ".pptx" },
              "mmd.zip": { label: "MMD Archive (ZIP)", extension: ".mmd.zip" },
              "md.zip": {
                label: "Markdown Archive (ZIP)",
                extension: ".md.zip",
              },
              "html.zip": {
                label: "HTML Archive (ZIP)",
                extension: ".html.zip",
              },
            };

            convertUI.completedDownloads.forEach((blob, format) => {
              const info = formatInfo[format] || { extension: `.${format}` };
              const filename = `${
                convertUI.baseFilename || "document"
              }-converted${info.extension}`;
              results.push({ filename, blob, format });
            });

            return results;
          };
        }

        logDebug("ConvertUI configured for download:", {
          baseFilename: convertUI.baseFilename,
          conversionCount: this.conversionResults.size,
        });
      }
    } catch (error) {
      logWarn("Failed to setup ConvertUI for download:", error);
    }
  }

  /**
   * Set up persistence session data for the downloader to collect edits
   * The TotalDownloader's collectMMDEdits looks for getMathPixMMDPersistence
   * @param {string} currentMMD - Current edited content
   * @param {string} originalMMD - Original content
   * @private
   */
  setupPersistenceForDownload(currentMMD, originalMMD) {
    // Try to use the actual persistence module if available
    const persistence = window.getMathPixMMDPersistence?.();
    if (persistence && persistence.hasSession?.()) {
      // Persistence already has our session, just update current content
      if (persistence.session) {
        persistence.session.current = currentMMD;
        persistence.session.original = originalMMD;
        persistence.session.sourceFileName =
          this.restoredSession?.source?.filename || "restored-document";
        persistence.session.lastModified = Date.now();
      }
      logDebug("Updated existing persistence session for download");
      return;
    }

    // If no persistence module, the downloader will skip edits collection
    // The edits will still be in the main MMD content
    logDebug("Persistence module not available - edits included in main MMD");
  }

  /**
   * Store conversion results where the downloader can collect them
   * The TotalDownloader's collectConvertedFiles looks for getMathPixConvertUI
   * @private
   */
  storeConversionsForDownload() {
    // The downloader looks for window.getMathPixConvertUI().completedDownloads
    // We'll try to use that if available, otherwise conversions go in main results
    const convertUI = window.getMathPixConvertUI?.();
    if (convertUI && this.conversionResults) {
      // Copy our results to the convert UI's storage
      this.conversionResults.forEach((blob, format) => {
        if (convertUI.completedDownloads) {
          convertUI.completedDownloads.set(format, blob);
        }
      });
      logDebug("Stored conversions in ConvertUI for download collection");
    } else {
      logDebug("ConvertUI not available - conversions stored locally");
    }
  }

  /**
   * Get current MMD content (possibly edited)
   * @returns {string} Current MMD content
   */
  getCurrentMMDContent() {
    return (
      this.elements.mmdEditorTextarea?.value ||
      this.restoredSession?.currentMMD ||
      this.restoredSession?.results?.mmd ||
      ""
    );
  }

  /**
   * Get only NEW conversions (not from original ZIP)
   * @returns {Object} New conversions object
   * @private
   */
  getNewConversions() {
    // TODO: Integrate with Convert UI to get newly converted files
    // For now, return empty
    return {
      hasConverted: false,
      filenames: [],
    };
  }

  // =========================================================================
  // CONVERT FUNCTIONALITY
  // =========================================================================

  /**
   * Update convert button enabled state based on checkbox selection
   * @private
   */
  updateConvertButtonState() {
    if (!this.elements.convertBtn) return;

    const hasSelection = Array.from(
      this.elements.convertFormatCheckboxes || [],
    ).some((cb) => cb.checked);
    const hasContent = !!this.restoredSession?.currentMMD;

    this.elements.convertBtn.disabled = !hasSelection || !hasContent;
  }

  /**
   * Get selected conversion formats
   * @returns {string[]} Array of format values
   * @private
   */
  getSelectedConvertFormats() {
    return Array.from(this.elements.convertFormatCheckboxes || [])
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);
  }

  /**
   * Handle convert button click
   * Follows the pattern from mathpix-convert-ui.js
   * @private
   */
  async handleConvert() {
    if (this.isConverting) {
      logWarn("Conversion already in progress");
      return;
    }

    const selectedFormats = this.getSelectedConvertFormats();
    if (selectedFormats.length === 0) {
      this.showNotification(
        "Please select at least one format to convert to.",
        "warning",
      );
      return;
    }

    const mmdContent = this.getCurrentMMDContent();
    if (!mmdContent) {
      this.showNotification(
        "No MMD content available for conversion.",
        "error",
      );
      return;
    }

    // Get the API client
    const client = window.getMathPixConvertClient?.();
    if (!client) {
      this.showNotification(
        "Convert API client not available. Please refresh the page.",
        "error",
      );
      return;
    }

    // Validate MMD content
    const validation = client.validateMMD(mmdContent);
    if (!validation.valid) {
      this.showNotification(validation.error, "error");
      return;
    }

    // Start conversion
    this.isConverting = true;
    this.conversionResults = new Map();

    // Update UI
    this.updateConvertButtonState();
    if (this.elements.convertCancelBtn)
      this.elements.convertCancelBtn.hidden = false;
    this.hideConvertErrors();
    this.hideConvertDownloads();
    this.showConvertProgress(selectedFormats);

    logInfo("Starting conversion for formats:", selectedFormats);

    try {
      const results = await client.convertAndDownload(
        mmdContent,
        selectedFormats,
        {
          onStart: (conversionId) => {
            this.activeConversionId = conversionId;
            logDebug("Conversion started:", conversionId);
          },
          onProgress: (status) => {
            this.updateConvertProgress(status);
          },
          onFormatComplete: (format, blob) => {
            logInfo(`Format complete: ${format} (${blob.size} bytes)`);
            this.updateConvertProgressItem(format, "completed");
            this.conversionResults.set(format, blob);
          },
          onComplete: (completionResult) => {
            logInfo("Conversion workflow complete:", {
              completed: completionResult.completed?.length || 0,
              failed: completionResult.failed?.length || 0,
            });

            // Show any errors for failed formats
            if (completionResult.failed && completionResult.failed.length > 0) {
              const errorMessages = completionResult.failed.map((format) => {
                const formatInfo = this.getFormatInfo(format);
                const error = completionResult.errors?.[format];
                return `${formatInfo.label}: ${error || "Unknown error"}`;
              });
              this.showConvertErrors(errorMessages);
            }
          },
          onError: (error) => {
            logWarn("Format error:", error.message);
          },
        },
      );

      // Store results from returned Map (backup in case callbacks didn't fire)
      if (results && results.size > 0) {
        results.forEach((blob, format) => {
          if (!this.conversionResults.has(format)) {
            this.conversionResults.set(format, blob);
          }
        });
      }

      // Show downloads if any succeeded
      if (this.conversionResults.size > 0) {
        this.showConvertDownloads();
        this.showNotification(
          `${this.conversionResults.size} format(s) converted successfully!`,
          "success",
        );
      }
    } catch (error) {
      logError("Conversion failed:", error);
      this.showConvertError(error.message);
      this.showNotification(`Conversion failed: ${error.message}`, "error");
    } finally {
      this.isConverting = false;
      this.activeConversionId = null;
      this.updateConvertButtonState();
      if (this.elements.convertCancelBtn)
        this.elements.convertCancelBtn.hidden = true;
      this.hideConvertProgress();
    }
  }

  /**
   * Cancel ongoing conversion
   * @private
   */
  cancelConversion() {
    this.conversionAborted = true;
    this.showNotification("Conversion cancelled", "info");
    logInfo("Conversion cancelled by user");
  }

  /**
   * Show conversion progress UI
   * Mirrors mathpix-convert-ui.js showProgress
   * @param {string[]} formats - Formats being converted
   * @private
   */
  showConvertProgress(formats) {
    if (!this.elements.convertProgress || !this.elements.convertProgressList)
      return;

    // Clear existing items
    this.elements.convertProgressList.innerHTML = "";

    // Create progress item for each format
    formats.forEach((format) => {
      const formatInfo = this.getFormatInfo(format);
      const item = document.createElement("div");
      item.className = "resume-progress-item";
      item.dataset.format = format;
      item.dataset.status = "pending";

      item.innerHTML = `
      <span class="progress-icon">${getIcon("hourglass")}</span>
      <span class="progress-format">${formatInfo.label}</span>
      <span class="progress-status">Waiting...</span>
    `;

      this.elements.convertProgressList.appendChild(item);
    });

    this.elements.convertProgress.hidden = false;
    logDebug("Progress UI shown for formats:", formats);
  }

  /**
   * Update a progress item status
   * Mirrors mathpix-convert-ui.js pattern
   * @param {string} format - Format being updated
   * @param {string} status - New status (pending, processing, completed, error)
   * @param {string} [message] - Optional message for errors
   * @private
   */
  updateConvertProgressItem(format, status, message) {
    const item = this.elements.convertProgressList?.querySelector(
      `.resume-progress-item[data-format="${format}"]`,
    );
    if (!item) return;

    item.dataset.status = status;

    const icon = item.querySelector(".progress-icon");
    const statusEl = item.querySelector(".progress-status");

    const iconNames = {
      pending: "hourglass",
      processing: "refresh",
      completed: "checkCircle",
      error: "error",
    };

    const statusTexts = {
      pending: "Waiting...",
      processing: "Converting...",
      completed: "Complete!",
      error: message || "Failed",
    };

    if (icon) icon.innerHTML = getIcon(iconNames[status] || "hourglass");
    if (statusEl) statusEl.textContent = statusTexts[status] || status;
  }

  /**
   * Update progress display from API status
   * @param {Object} status - Status object from API client
   * @private
   */
  updateConvertProgress(status) {
    if (!status) return;

    // Update individual format items based on formatStatuses
    if (status.formatStatuses) {
      Object.entries(status.formatStatuses).forEach(
        ([format, formatStatus]) => {
          this.updateConvertProgressItem(
            format,
            formatStatus.status || "processing",
          );
        },
      );
    }
  }

  /**
   * Hide conversion progress UI
   * @private
   */
  hideConvertProgress() {
    if (this.elements.convertProgress) {
      this.elements.convertProgress.hidden = true;
    }
  }

  /**
   * Show conversion downloads
   * Mirrors mathpix-convert-ui.js showDownloads
   * @private
   */
  showConvertDownloads() {
    if (
      !this.elements.convertDownloads ||
      !this.elements.convertDownloadButtons
    )
      return;

    // Clear existing buttons
    this.elements.convertDownloadButtons.innerHTML = "";

    // Get base filename from source
    const baseFilename =
      this.restoredSession?.source?.filename?.replace(/\.[^/.]+$/, "") ||
      "document";

    // Create download button for each result
    this.conversionResults.forEach((blob, format) => {
      const formatInfo = this.getFormatInfo(format);
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "resume-btn resume-btn-secondary resume-download-format-btn";
      button.innerHTML = `${getIcon("download")} ${formatInfo.label}`;

      // Generate filename
      const filename = `${baseFilename}-converted${formatInfo.extension}`;

      button.addEventListener("click", () => {
        this.triggerDownload(blob, filename);
      });

      this.elements.convertDownloadButtons.appendChild(button);
    });

    this.elements.convertDownloads.hidden = false;
    logDebug("Downloads shown:", this.conversionResults.size);
  }

  /**
   * Trigger download for a blob
   * @param {Blob} blob - File blob
   * @param {string} filename - Suggested filename
   * @private
   */
  triggerDownload(blob, filename) {
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up URL after short delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      this.showNotification(`Downloaded ${filename}`, "success");
      logInfo("Download triggered:", filename);
    } catch (error) {
      logError("Download failed:", error);
      this.showNotification(`Download failed: ${error.message}`, "error");
    }
  }

  /**
   * Hide conversion downloads
   * @private
   */
  hideConvertDownloads() {
    if (this.elements.convertDownloads) {
      this.elements.convertDownloads.hidden = true;
    }
  }

  /**
   * Download a converted file
   * @param {string} format - Format type
   * @param {Object} result - Conversion result with blob and filename
   * @private
   */
  downloadConvertedFile(format, result) {
    try {
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
      this.showNotification(`Downloaded ${result.filename}`, "success");
    } catch (error) {
      logError("Download failed:", error);
      this.showNotification(`Download failed: ${error.message}`, "error");
    }
  }

  /**
   * Show conversion error
   * @param {string} message - Error message
   * @private
   */
  showConvertError(message) {
    this.showConvertErrors([message]);
  }

  /**
   * Show multiple conversion errors
   * @param {string[]} messages - Error messages
   * @private
   */
  showConvertErrors(messages) {
    if (!this.elements.convertErrors || !this.elements.convertErrorList) return;

    // Clear and populate error list
    this.elements.convertErrorList.innerHTML = "";
    messages.forEach((msg) => {
      const li = document.createElement("li");
      li.textContent = msg;
      this.elements.convertErrorList.appendChild(li);
    });

    this.elements.convertErrors.hidden = false;
    logDebug("Errors shown:", messages.length);
  }

  /**
   * Hide conversion errors
   * @private
   */
  hideConvertErrors() {
    if (this.elements.convertErrors) {
      this.elements.convertErrors.hidden = true;
    }
  }

  /**
   * Get user-friendly format label
   * @param {string} format - Format value
   * @returns {string} Display label
   * @private
   */
  getFormatLabel(format) {
    const labels = {
      docx: "DOCX (Word)",
      pdf: "PDF (HTML Rendering)",
      "tex.zip": "LaTeX (ZIP)",
      "latex.pdf": "PDF (LaTeX Rendering)",
      html: "HTML",
      md: "Markdown",
      pptx: "PowerPoint (PPTX)",
      "mmd.zip": "MMD Archive (ZIP)",
      "md.zip": "Markdown Archive (ZIP)",
      "html.zip": "HTML Archive (ZIP)",
    };
    return labels[format] || format.toUpperCase();
  }

  /**
   * Get format info object with label and extension
   * Mirrors mathpix-convert-ui.js getFormatInfo - includes ALL supported formats
   * @param {string} format - Format key
   * @returns {Object} Format info with label and extension
   * @private
   */
  getFormatInfo(format) {
    // Try to get from config first
    if (
      typeof MATHPIX_CONFIG !== "undefined" &&
      MATHPIX_CONFIG.CONVERT?.FORMATS?.[format]
    ) {
      return MATHPIX_CONFIG.CONVERT.FORMATS[format];
    }

    // Complete fallback defaults matching PDF mode
    const defaults = {
      docx: { label: "Word Document", extension: ".docx" },
      pdf: { label: "PDF (HTML Rendering)", extension: ".pdf" },
      "tex.zip": { label: "LaTeX (ZIP)", extension: ".tex.zip" },
      "latex.pdf": { label: "PDF (LaTeX Rendering)", extension: ".pdf" },
      html: { label: "HTML", extension: ".html" },
      md: { label: "Markdown", extension: ".md" },
      pptx: { label: "PowerPoint", extension: ".pptx" },
      "mmd.zip": { label: "MMD Archive (ZIP)", extension: ".mmd.zip" },
      "md.zip": { label: "Markdown Archive (ZIP)", extension: ".md.zip" },
      "html.zip": { label: "HTML Archive (ZIP)", extension: ".html.zip" },
    };

    return (
      defaults[format] || {
        label: format.toUpperCase(),
        extension: `.${format}`,
      }
    );
  }

  /**
   * Update Select All checkbox state based on individual checkboxes
   * @private
   */
  updateSelectAllState() {
    if (
      !this.elements.convertSelectAll ||
      !this.elements.convertFormatCheckboxes
    ) {
      return;
    }

    const checkboxes = Array.from(this.elements.convertFormatCheckboxes);
    const allChecked = checkboxes.every((cb) => cb.checked);
    const someChecked = checkboxes.some((cb) => cb.checked);

    this.elements.convertSelectAll.checked = allChecked;
    this.elements.convertSelectAll.indeterminate = someChecked && !allChecked;
  }

  /**
   * Download all converted files as a combined operation
   * Uses the existing TotalDownloader pattern
   * @private
   */
  async downloadAllConvertedFiles() {
    if (!this.conversionResults || this.conversionResults.size === 0) {
      this.showNotification(
        "No converted files available to download.",
        "warning",
      );
      return;
    }

    logInfo("Downloading all converted files...");

    try {
      // Download each file individually (simple approach)
      // Could be enhanced to create a ZIP with all converted files
      const sourceFilename =
        this.restoredSession?.source?.filename || "document";
      const baseName = sourceFilename.replace(/\.[^/.]+$/, "");

      this.conversionResults.forEach((blob, format) => {
        const formatInfo = this.getFormatInfo(format);
        const filename = `${baseName}-converted${formatInfo.extension}`;

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      });

      this.showNotification(
        `Downloaded ${this.conversionResults.size} converted file(s)`,
        "success",
      );
    } catch (error) {
      logError("Failed to download converted files:", error);
      this.showNotification(`Download failed: ${error.message}`, "error");
    }
  }

  // =========================================================================
  // NEW SESSION
  // =========================================================================

  /**
   * Start new session (with unsaved changes confirmation)
   */
  startNewSession() {
    logDebug("Starting new session requested");

    if (this.hasUnsavedChanges) {
      if (!confirm(RESTORER_CONFIG.MESSAGES.CONFIRM_NEW_SESSION)) {
        return;
      }
    }

    this.cleanup();
    this.resetToUploadState();
    this.showNotification("Ready for new session", "info");
  }

  /**
   * Reset UI to initial upload state
   * @private
   */
  resetToUploadState() {
    logDebug("Resetting to upload state");

    // Show upload section
    if (this.elements.uploadSection) {
      this.elements.uploadSection.hidden = false;
    }

    // Hide working area
    if (this.elements.workingArea) {
      this.elements.workingArea.hidden = true;
    }

    // Hide edit selection
    this.hideEditSelectionDialog();

    // Clear validation messages
    this.clearValidationMessages();

    // Reset drop zone
    this.hideLoadingState();

    // Clear parse result
    this.parseResult = null;
    this.selectedEdit = null;
    this.hasUnsavedChanges = false;
  }

  // =========================================================================
  // CLEANUP
  // =========================================================================

  /**
   * Clean up resources
   */
  cleanup() {
    logDebug("Cleaning up session restorer resources");

    // Unsubscribe from MathJax recovery events
    if (this.mathJaxRecoveryUnsubscribe) {
      this.mathJaxRecoveryUnsubscribe();
      this.mathJaxRecoveryUnsubscribe = null;
      logDebug("Unsubscribed from MathJax recovery events");
    }

    // Clear recovery state
    this.pendingPreviewRender = false;
    this.pendingContent = null;

    // Revoke object URLs
    this.objectURLs.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        logWarn("Failed to revoke object URL:", error);
      }
    });
    this.objectURLs = [];

    // Clear cached data
    this.parseResult = null;
    this.selectedEdit = null;
    this.restoredSession = null;
    this.hasUnsavedChanges = false;
    this.pdfRenderedForComparison = false;

    // Clear preview debounce
    clearTimeout(this.previewDebounce);
  }

  // =========================================================================
  // NOTIFICATIONS
  // =========================================================================

  /**
   * Show notification to user
   * @param {string} message - Message to display
   * @param {string} type - Notification type ('success', 'error', 'warning', 'info')
   * @private
   */
  showNotification(message, type = "info") {
    // Use controller's notification method if available
    if (
      this.controller &&
      typeof this.controller.showNotification === "function"
    ) {
      this.controller.showNotification(message, type);
      return;
    }

    // Use global notification functions if available
    const notifyFn = {
      success: window.notifySuccess,
      error: window.notifyError,
      warning: window.notifyWarning,
      info: window.notifyInfo,
    }[type];

    if (notifyFn) {
      notifyFn(message);
      return;
    }

    // Fallback to console
    logInfo(`Notification (${type}): ${message}`);
  }

  // =========================================================================
  // DEBUG / TEST INTERFACE
  // =========================================================================

  /**
   * Get debug information
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      isInitialised: this.isInitialised,
      hasParser: !!this.parser,
      hasParseResult: !!this.parseResult,
      hasRestoredSession: !!this.restoredSession,
      hasUnsavedChanges: this.hasUnsavedChanges,
      elementCount: Object.values(this.elements).filter(Boolean).length,
      objectURLCount: this.objectURLs.length,
      sessionKey: this.restoredSession?.sessionKey || null,
      sourceFilename: this.restoredSession?.source?.filename || null,
      isPDF: this.restoredSession?.isPDF || false,
    };
  }

  /**
   * Validate module configuration
   * @returns {boolean} True if properly configured
   */
  validate() {
    const required = [
      "container",
      "uploadSection",
      "dropZone",
      "fileInput",
      "workingArea",
    ];
    const missing = required.filter((key) => !this.elements[key]);

    if (missing.length > 0) {
      logWarn("Missing required elements:", missing);
      return false;
    }

    return this.isInitialised;
  }
}

// ============================================================================
// SINGLETON PATTERN
// ============================================================================

let sessionRestorerInstance = null;

/**
 * Get or create singleton instance of MathPixSessionRestorer
 * @returns {MathPixSessionRestorer} Singleton instance
 */
function getMathPixSessionRestorer() {
  if (!sessionRestorerInstance) {
    logDebug("Creating new MathPixSessionRestorer singleton instance");

    // Try to get controller reference from main controller
    const controller = window.getMathPixController?.();

    sessionRestorerInstance = new MathPixSessionRestorer(controller);

    // Initialise asynchronously
    sessionRestorerInstance.initialise().catch((error) => {
      logError("Failed to initialise session restorer:", error);
    });
  }
  return sessionRestorerInstance;
}

// ============================================================================
// GLOBAL EXPOSURE
// ============================================================================

window.MathPixSessionRestorer = MathPixSessionRestorer;
window.getMathPixSessionRestorer = getMathPixSessionRestorer;

// ============================================================================
// GLOBAL FUNCTIONS FOR HTML ONCLICK HANDLERS
// ============================================================================

/**
 * Toggle fullscreen mode for Resume MMD editor
 * Called by onclick in HTML buttons
 */
window.toggleResumeMMDFullscreen = function () {
  const restorer = getMathPixSessionRestorer();
  if (restorer && restorer.isInitialised) {
    restorer.toggleFullscreen();
  } else {
    console.warn(
      "[SessionRestorer] Cannot toggle fullscreen - not initialised",
    );
  }
};

/**
 * Toggle edit mode for Resume MMD editor
 * Called by onclick in HTML button
 */
window.toggleResumeMMDEdit = function () {
  const restorer = getMathPixSessionRestorer();
  if (restorer && restorer.isInitialised) {
    restorer.toggleEditMode();
  } else {
    console.warn("[SessionRestorer] Cannot toggle edit - not initialised");
  }
};

// ============================================================================
// KEYBOARD EVENT HANDLER FOR ESCAPE KEY AND FOCUS MODE
// ============================================================================

document.addEventListener("keydown", function (event) {
  const restorer = sessionRestorerInstance;
  if (!restorer || !restorer.isInitialised) return;

  // Only handle if Resume Mode container is visible
  const container = document.getElementById("mathpix-resume-mode-container");
  if (!container || container.style.display === "none") return;

  // Ctrl+Shift+F: Toggle Focus Mode (Phase 8.3.3)
  if (event.ctrlKey && event.shiftKey && event.key === "F") {
    event.preventDefault();
    restorer.toggleFocusMode();
    return;
  }

  // Escape key handling - peel back layers one at a time
  if (event.key === "Escape") {
    // Priority 1: Exit Edit Fullscreen first (if active)
    // This takes precedence even when in Focus Mode
    if (restorer.isFullscreen) {
      event.preventDefault();
      restorer.exitFullscreen();
      return;
    }

    // Priority 2: Exit Focus Mode (if active)
    if (restorer.isFocusMode) {
      event.preventDefault();
      restorer.exitFocusMode();
      return;
    }

    // Priority 3: Exit edit mode (if editing but not fullscreen)
    const isEditing =
      restorer.elements.mmdCodeContainer?.dataset.editing === "true";
    if (isEditing) {
      event.preventDefault();
      restorer.setEditMode(false);
      // Return focus to edit button
      if (restorer.elements.mmdEditBtn) {
        restorer.elements.mmdEditBtn.focus();
      }
    }
  }
});

// ============================================================================
// TEST COMMANDS
// ============================================================================
// Tests have been migrated to mathpix-session-restorer-tests.js
// Include that file after this one to access test commands:
//   - runAllSessionRestorerTests()
//   - testSessionRestorer()
//   - validatePhase82()
//   - validateSessionRecoveryFixes()
//   - testContentPreview()
//   - showSessionRestorerTestHelp()
// ============================================================================

// Log load confirmation
logInfo("MathPix Session Restorer module loaded (Phase 8.2)");
