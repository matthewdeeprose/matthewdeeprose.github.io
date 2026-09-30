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
  // SVG ICONS (from the shared icon library, icon-library.js)
  // ============================================================================

  /**
   * Restorer icon names that the icon library holds under another name.
   * The restorer's "arrowRight" has always drawn the long arrow; the library's
   * "arrowRight" is a chevron, and its long arrow is "arrowRightLong".
   * @constant {Object.<string, string>}
   */
  const LIBRARY_NAME_FOR = Object.freeze({ arrowRight: "arrowRightLong" });

  let libraryMissingWarned = false;

  /**
   * Get an SVG icon by name with accessibility attributes
   * @param {string} name - Icon name from ICONS registry
   * @param {Object} [options] - Options
   * @param {string} [options.className] - Additional CSS class(es)
   * @returns {string} SVG HTML string with aria-hidden="true"
   */
  function getIcon(name, options = {}) {
    // icon-library.js loads after this file, so look it up per call, never at load.
    const library = window.IconLibrary;
    if (!library || typeof library.getIcon !== "function") {
      if (!libraryMissingWarned) {
        logWarn("Icon library (window.IconLibrary) is not loaded; icons render empty");
        libraryMissingWarned = true;
      }
      return "";
    }

    return library.getIcon(LIBRARY_NAME_FOR[name] || name, options);
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
       * Flag for tracking unsaved Context-tab edits (Stage 9, Q4). Set by the
       * mathpix:context-edited listener; OR'd into the download-button show
       * condition; cleared on save and on session/document boundaries.
       * @type {boolean}
       */
      this.hasContextEdits = false;

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
