// ─── MathPixSessionRestorer Core ────────────────────────────────────────────
// Defines the class, constructor, shared utilities, and _SRShared namespace.
// MUST load before all other session-restorer-*.js files.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  // ============================================================================
  // LOGGING CONFIGURATION
  // ============================================================================

  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
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
    aiSparkle:
      '<svg height="21" width="21" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1.0685 0 0 .99925 .39221 2.2062)" fill="none" fill-rule="evenodd"><path d="m0.5 15v-11.8c0-1.6 1.3-2.9 3-2.9h6.3m4.5 7.7v7c0 1.6-1.3 2.9-3 2.9h-7.8c-1.6 0-3-1.3-3-2.9" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="m12.2-1.9q0.7 6 6.8 6-6.1 0-6.8 6-0.7-6-6.8-6 6.1 0 6.8-6z" fill="currentColor"/><path d="m6.1 6.8q0.6 4.8 5.7 4.8-5.1 0-5.7 4.8-0.6-4.8-5.7-4.8 5.1 0 5.7-4.8z" fill="currentColor"/><path d="m15.8-1.7q0.2 1.5 1.7 1.5-1.5 0-1.7 1.5-0.2-1.5-1.7-1.5 1.5 0 1.7-1.5z" fill="currentColor"/></g></svg>',
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
      DROP_HINT: "Drop ZIP file here or select to browse",
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
       * Flag for tracking unsaved image changes (Phase 9 Feature 1C)
       * Only cleared by downloading an updated ZIP
       * @type {boolean}
       */
      this.hasUnsavedImageChanges = false;

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

      // =========================================================================
      // Phase 8F: Image Restore from ZIP
      // =========================================================================

      /**
       * Raw ZIP file reference for image extraction
       * Stored by handleZIPFile, used by extractAndRestoreImages
       * @type {File|null}
       * @private
       */
      this._rawZIPFile = null;

      /**
       * Image blob URL map: originalUrl → blobUrl
       * Used for reverse-mapping when sending MMD to convert API
       * @type {Map<string, string>}
       * @private
       */
      this.imageBlobUrlMap = new Map();

      /**
       * Restored image registry instance
       * @type {MathPixImageRegistry|null}
       */
      this.imageRegistry = null;

      // =========================================================================
      // Phase 8G: Display Layer
      // =========================================================================

      /**
       * Display layer instance for collapsing image references in textarea
       * @type {MathPixMMDDisplayLayer|null}
       */
      this.displayLayer = null;

      /**
       * Whether the display layer collapse is currently active.
       * When true, textarea shows placeholders; working MMD is in restoredSession.workingMMD.
       * @type {boolean}
       */
      this.isDisplayCollapsed = false;
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
  }

  // ── Expose class globally ─────────────────────────────────────────────────
  window.MathPixSessionRestorer = MathPixSessionRestorer;

  // ── Shared utilities namespace ────────────────────────────────────────────
  // Exposes shared utilities for use by all mixin files
  window._SRShared = {
    logError,
    logWarn,
    logInfo,
    logDebug,
    getIcon,
    RESTORER_CONFIG,
  };

  console.log(
    "[SessionRestorer] Core loaded — MathPixSessionRestorer class defined",
  );
})();
