/**
 * @fileoverview MathPix MMD Editor - Persistence Module (Phase 5.2)
 * @module MMDEditorPersistence
 * @requires mathpix-mmd-editor-core.js
 * @version 1.0.0
 * @since 5.2.0
 *
 * @description
 * Provides persistence and undo/redo functionality for the MMD Editor.
 * Auto-saves changes to localStorage with configurable debounce, maintains
 * undo/redo stacks, and allows restoration of original MathPix output.
 *
 * Features:
 * - Auto-save to localStorage (1s debounce)
 * - Undo stack (10 levels)
 * - Redo stack
 * - Restore original MathPix output
 * - Session persistence across page refresh
 * - Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
 * - WCAG 2.2 AA compliant with screen reader announcements
 *
 * localStorage Structure:
 * {
 *   "mathpix-mmd-session": {
 *     "original": "...",           // Original from MathPix, never changed
 *     "current": "...",            // Current working version
 *     "undoStack": ["...", "..."], // Previous states (max 10)
 *     "redoStack": ["...", "..."], // Redo states
 *     "lastModified": 1701864000000,
 *     "sourceFileName": "document.pdf"
 *   }
 * }
 *
 * @example
 * // Start a new session when MMD content is generated
 * const persistence = getMathPixMMDPersistence();
 * persistence.startSession(mmdContent, 'document.pdf');
 *
 * // Undo last change
 * persistence.undo();
 */

// ============================================================================
// Logging Configuration (Module Level)
// ============================================================================

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

/**
 * @function shouldLog
 * @param {number} level - The log level to check
 * @returns {boolean} True if the message should be logged
 */
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR))
    console.error("[MMD Persistence]", message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn("[MMD Persistence]", message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log("[MMD Persistence]", message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log("[MMD Persistence]", message, ...args);
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * @constant {Object} PERSISTENCE_CONFIG
 * @description Configuration for the MMD Persistence module
 */
const PERSISTENCE_CONFIG = {
  STORAGE_KEY: "mathpix-mmd-session",
  AUTO_SAVE_DEBOUNCE_MS: 1000,
  MAX_UNDO_LEVELS: 10,
  MESSAGES: {
    SESSION_STARTED: "Editing session started",
    SESSION_RESTORED: "Previous session restored",
    SESSION_CLEARED: "Session cleared",
    CONTENT_SAVED: "Changes saved",
    UNDO_APPLIED: "Change undone",
    REDO_APPLIED: "Change redone",
    ORIGINAL_RESTORED: "Original content restored",
    NO_UNDO: "Nothing to undo",
    NO_REDO: "Nothing to redo",
    CLEAR_CONFIRM: "Clear session and discard all changes?",
    RESTORE_CONFIRM:
      "Restore original? Current changes will be added to undo history.",
  },
  STATUS_TEXT: {
    SAVED: "Saved",
    MODIFIED: "Modified",
    SAVING: "Saving...",
  },
};

// ============================================================================
// MMDEditorPersistence Class
// ============================================================================

/**
 * @class MMDEditorPersistence
 * @description Handles persistence and undo/redo for MMD Editor
 */
class MMDEditorPersistence {
  /**
   * Create a new MMDEditorPersistence instance
   */
  constructor() {
    // State
    this.session = null;
    this.autoSaveTimer = null;
    this.isModified = false;

    // DOM element references
    this.elements = {};
    this.elementsCached = false;

    // Initialisation flag
    this.isInitialised = false;

    // Callback for content changes (set by editor core)
    this.onContentChangeCallback = null;

    logInfo("MMDEditorPersistence instance created");
  }

  // ==========================================================================
  // Initialisation Methods
  // ==========================================================================

  /**
   * Initialise the persistence module
   * @returns {boolean} True if initialisation successful
   */
  init() {
    if (this.isInitialised) {
      logDebug("Already initialised, skipping");
      return true;
    }

    logInfo("Initialising MMD Persistence...");

    // Cache DOM elements
    this.cacheElements();

    // Attach keyboard shortcuts
    this.attachKeyboardShortcuts();

    // Check for existing session
    this.checkForExistingSession();

    this.isInitialised = true;
    logInfo("MMD Persistence initialised successfully");

    return true;
  }

  /**
   * Cache DOM element references for performance
   * @private
   */
  cacheElements() {
    this.elements = {
      // Session controls container
      sessionControls: document.getElementById("mmd-session-controls"),

      // Status indicator
      sessionStatus: document.getElementById("mmd-session-status"),

      // Buttons
      undoBtn: document.getElementById("mmd-undo-btn"),
      redoBtn: document.getElementById("mmd-redo-btn"),
      restoreBtn: document.getElementById("mmd-restore-btn"),
      clearBtn: document.getElementById("mmd-clear-session-btn"),

      // Screen reader status
      srStatus: document.getElementById("mmd-session-sr-status"),

      // Session banner
      sessionBanner: document.getElementById("mmd-session-banner"),
      bannerMessage: document.getElementById("mmd-session-banner-message"),

      // Editor elements (for content access)
      textarea: document.getElementById("mmd-editor-textarea"),
      codeElement: document.getElementById("mathpix-pdf-content-mmd"),
    };

    // Validate critical elements
    const critical = [
      "sessionControls",
      "sessionStatus",
      "undoBtn",
      "redoBtn",
      "restoreBtn",
      "clearBtn",
    ];
    const missing = critical.filter((key) => !this.elements[key]);

    if (missing.length > 0) {
      logWarn("Missing critical persistence elements", { missing });
    }

    this.elementsCached = true;
    logDebug("Persistence elements cached", {
      cached: Object.keys(this.elements).filter((k) => !!this.elements[k])
        .length,
      total: Object.keys(this.elements).length,
    });
  }

  /**
   * Attach keyboard shortcuts for undo/redo
   * @private
   */
  attachKeyboardShortcuts() {
    // Listen on the textarea for Ctrl+Z and Ctrl+Y
    const textarea = this.elements.textarea;
    if (textarea) {
      textarea.addEventListener("keydown", (e) =>
        this.handleKeyboardShortcut(e)
      );
      logDebug("Keyboard shortcuts attached to textarea");
    }

    // Also listen globally for when textarea has focus
    document.addEventListener("keydown", (e) => {
      // Only handle if textarea is focused
      if (document.activeElement === this.elements.textarea) {
        this.handleKeyboardShortcut(e);
      }
    });
  }

  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  handleKeyboardShortcut(event) {
    // Ctrl+Z for undo (but not Ctrl+Shift+Z which some apps use for redo)
    if (event.ctrlKey && event.key === "z" && !event.shiftKey) {
      event.preventDefault();
      this.undo();
      return;
    }

    // Ctrl+Y for redo
    if (event.ctrlKey && event.key === "y") {
      event.preventDefault();
      this.redo();
      return;
    }

    // Ctrl+Shift+Z for redo (alternative)
    if (event.ctrlKey && event.shiftKey && event.key === "Z") {
      event.preventDefault();
      this.redo();
      return;
    }
  }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  /**
   * Start a new editing session
   * @param {string} content - Original MMD content from MathPix
   * @param {string} [fileName] - Source file name
   */
  startSession(content, fileName = "") {
    if (!content || typeof content !== "string") {
      logWarn("Cannot start session without content");
      return;
    }

    // Create new session object
    this.session = {
      original: content,
      current: content,
      undoStack: [],
      redoStack: [],
      lastModified: Date.now(),
      sourceFileName: fileName,
    };

    // Save to localStorage
    this.saveToStorage();

    // Show session controls
    this.showSessionControls();

    // Update UI state
    this.updateUIState();

    // Announce to screen readers
    this.announceStatus(PERSISTENCE_CONFIG.MESSAGES.SESSION_STARTED);

    logInfo("Session started", { fileName, contentLength: content.length });
  }

  /**
   * Check for existing session on page load
   * Only shows banner if current PDF matches stored session filename
   * @param {string} [currentFileName] - Currently uploaded PDF filename to compare
   * @private
   */
  checkForExistingSession(currentFileName = null) {
    const stored = this.loadFromStorage();

    if (stored && stored.current) {
      logInfo("Existing session found", {
        fileName: stored.sourceFileName,
        lastModified: new Date(stored.lastModified).toLocaleString(),
      });

      // If a current filename is provided, only show banner if it matches
      if (currentFileName) {
        if (stored.sourceFileName === currentFileName) {
          logInfo("Filename matches - showing restore banner");
          this.showSessionBanner(stored);
        } else {
          logInfo("Filename mismatch - ignoring stored session", {
            stored: stored.sourceFileName,
            current: currentFileName,
          });
          // Don't show banner for different file
        }
      } else {
        // No current filename provided - don't show banner automatically
        // Banner will be triggered when PDF is uploaded
        logDebug("No current filename - deferring banner check");
      }
    }
  }

  /**
   * Show the session restore banner
   * @param {Object} session - Stored session data
   * @private
   */
  showSessionBanner(session) {
    let { sessionBanner, bannerMessage } = this.elements;

    // Re-fetch elements if not cached (DOM may not have been ready at init)
    if (!sessionBanner) {
      sessionBanner = document.getElementById("mmd-session-banner");
      this.elements.sessionBanner = sessionBanner;
    }
    if (!bannerMessage) {
      bannerMessage = document.getElementById("mmd-session-banner-message");
      this.elements.bannerMessage = bannerMessage;
    }

    if (!sessionBanner) {
      logWarn("Session banner element not found in DOM");
      return;
    }

    // Update banner message
    if (bannerMessage) {
      const fileName = session.sourceFileName || "Unknown file";
      const date = new Date(session.lastModified).toLocaleString();
      bannerMessage.textContent = `Previous editing session found for "${fileName}" (${date}).`;
    }

    // Show banner
    sessionBanner.hidden = false;
    logDebug("Session banner shown", { fileName: session.sourceFileName });
  }

  /**
   * Restore session from banner
   */
  restoreSession() {
    const stored = this.loadFromStorage();

    if (!stored) {
      logWarn("No session to restore");
      return;
    }

    // Load session into memory
    this.session = stored;

    // Apply content to editor
    this.applyContentToEditor(stored.current);

    // Hide banner
    this.dismissBanner();

    // Show session controls
    this.showSessionControls();

    // Update UI state
    this.updateUIState();

    // Announce restoration
    this.announceStatus(PERSISTENCE_CONFIG.MESSAGES.SESSION_RESTORED);

    logInfo("Session restored");
  }

  /**
   * Dismiss the session banner without restoring
   */
  dismissBanner() {
    const { sessionBanner } = this.elements;
    if (sessionBanner) {
      sessionBanner.hidden = true;
    }
    logDebug("Session banner dismissed");
  }

  /**
   * Clear the current session
   * @returns {Promise<boolean>} True if cleared, false if cancelled
   */
  async clearSession() {
    // Confirm with user
    const confirmed = await this.confirmAction(
      PERSISTENCE_CONFIG.MESSAGES.CLEAR_CONFIRM
    );

    if (!confirmed) {
      logDebug("Clear session cancelled by user");
      return false;
    }

    // Clear from localStorage
    this.removeFromStorage();

    // Reset state
    this.session = null;
    this.isModified = false;

    // Clear auto-save timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    // Hide session controls
    this.hideSessionControls();

    // Hide banner if visible
    this.dismissBanner();

    // Announce
    this.announceStatus(PERSISTENCE_CONFIG.MESSAGES.SESSION_CLEARED);

    logInfo("Session cleared");
    return true;
  }

  // ==========================================================================
  // Content Change Handling
  // ==========================================================================

  /**
   * Handle content change from editor
   * Called when user types in textarea
   * @param {string} newContent - Updated content
   */
  handleContentChange(newContent) {
    if (!this.session) {
      logDebug("No active session, ignoring content change");
      return;
    }

    // Check if content actually changed
    if (newContent === this.session.current) {
      return;
    }

    // Mark as modified
    this.isModified = true;
    this.updateStatus("modified");

    // Schedule auto-save with debounce
    this.scheduleAutoSave(newContent);

    logDebug("Content change detected, auto-save scheduled");
  }

  /**
   * Schedule auto-save with debounce
   * @param {string} content - Content to save
   * @private
   */
  scheduleAutoSave(content) {
    // Clear existing timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    // Update status to show saving is pending
    this.updateStatus("modified");

    // Schedule save
    this.autoSaveTimer = setTimeout(() => {
      this.saveContent(content);
    }, PERSISTENCE_CONFIG.AUTO_SAVE_DEBOUNCE_MS);
  }

  /**
   * Save content to session and storage
   * @param {string} content - Content to save
   * @private
   */
  saveContent(content) {
    if (!this.session) return;

    // Update status to saving
    this.updateStatus("saving");

    // Push current content to undo stack (before replacing)
    if (this.session.current !== content) {
      this.pushToUndoStack(this.session.current);

      // Clear redo stack when new changes are made
      this.session.redoStack = [];
    }

    // Update session
    this.session.current = content;
    this.session.lastModified = Date.now();

    // Save to localStorage
    this.saveToStorage();

    // Update status to saved
    this.updateStatus("saved");
    this.isModified = false;

    // Update button states
    this.updateButtonStates();

    logDebug("Content saved", { contentLength: content.length });
  }

  // ==========================================================================
  // Undo/Redo Operations
  // ==========================================================================

  /**
   * Push content to undo stack
   * @param {string} content - Content to push
   * @private
   */
  pushToUndoStack(content) {
    if (!this.session) return;

    this.session.undoStack.push(content);

    // Limit stack size
    if (this.session.undoStack.length > PERSISTENCE_CONFIG.MAX_UNDO_LEVELS) {
      this.session.undoStack.shift(); // Remove oldest
    }

    logDebug("Pushed to undo stack", {
      stackSize: this.session.undoStack.length,
    });
  }

  /**
   * Undo last change
   * @returns {boolean} True if undo was applied
   */
  undo() {
    if (!this.session || this.session.undoStack.length === 0) {
      this.announceStatus(PERSISTENCE_CONFIG.MESSAGES.NO_UNDO);
      logDebug("Nothing to undo");
      return false;
    }

    // Push current to redo stack
    this.session.redoStack.push(this.session.current);

    // Pop from undo stack
    const previousContent = this.session.undoStack.pop();

    // Apply content
    this.session.current = previousContent;
    this.applyContentToEditor(previousContent);

    // Save to storage
    this.saveToStorage();

    // Update UI
    this.updateButtonStates();
    this.updateStatus("saved");

    // Announce
    this.announceStatus(PERSISTENCE_CONFIG.MESSAGES.UNDO_APPLIED);

    logInfo("Undo applied", {
      undoRemaining: this.session.undoStack.length,
      redoAvailable: this.session.redoStack.length,
    });

    return true;
  }

  /**
   * Redo last undone change
   * @returns {boolean} True if redo was applied
   */
  redo() {
    if (!this.session || this.session.redoStack.length === 0) {
      this.announceStatus(PERSISTENCE_CONFIG.MESSAGES.NO_REDO);
      logDebug("Nothing to redo");
      return false;
    }

    // Push current to undo stack
    this.session.undoStack.push(this.session.current);

    // Pop from redo stack
    const nextContent = this.session.redoStack.pop();

    // Apply content
    this.session.current = nextContent;
    this.applyContentToEditor(nextContent);

    // Save to storage
    this.saveToStorage();

    // Update UI
    this.updateButtonStates();
    this.updateStatus("saved");

    // Announce
    this.announceStatus(PERSISTENCE_CONFIG.MESSAGES.REDO_APPLIED);

    logInfo("Redo applied", {
      undoAvailable: this.session.undoStack.length,
      redoRemaining: this.session.redoStack.length,
    });

    return true;
  }

  /**
   * Restore original MathPix output
   * @returns {Promise<boolean>} True if restored
   */
  async restoreOriginal() {
    if (!this.session || !this.session.original) {
      logWarn("No original content to restore");
      return false;
    }

    // Check if already at original
    if (this.session.current === this.session.original) {
      this.announceStatus("Already showing original content");
      return false;
    }

    // Push current to undo stack first (so user can undo the restore)
    this.pushToUndoStack(this.session.current);

    // Clear redo stack
    this.session.redoStack = [];

    // Apply original content
    this.session.current = this.session.original;
    this.applyContentToEditor(this.session.original);

    // Save to storage
    this.saveToStorage();

    // Update UI
    this.updateButtonStates();
    this.updateStatus("saved");

    // Announce
    this.announceStatus(PERSISTENCE_CONFIG.MESSAGES.ORIGINAL_RESTORED);

    logInfo("Original content restored");
    return true;
  }

  // ==========================================================================
  // Editor Integration
  // ==========================================================================

  /**
   * Apply content to the editor
   * @param {string} content - Content to apply
   * @private
   */
  applyContentToEditor(content) {
    const editor = window.getMathPixMMDEditor?.();

    if (editor) {
      editor.setContent(content);
      logDebug("Content applied to editor");
    } else {
      logWarn("Editor not available to apply content");
    }
  }

  /**
   * Get current content from editor
   * @returns {string} Current content
   */
  getCurrentContent() {
    const editor = window.getMathPixMMDEditor?.();
    return editor?.getContent() || "";
  }

  /**
   * Register callback for content changes
   * This allows editor core to notify persistence of changes
   * @param {Function} callback - Callback function(content)
   */
  onContentChange(callback) {
    this.onContentChangeCallback = callback;
  }

  // ==========================================================================
  // localStorage Operations
  // ==========================================================================

  /**
   * Save session to localStorage
   * @private
   */
  saveToStorage() {
    if (!this.session) return;

    try {
      const serialised = JSON.stringify(this.session);
      localStorage.setItem(PERSISTENCE_CONFIG.STORAGE_KEY, serialised);
      logDebug("Session saved to localStorage");
    } catch (error) {
      logError("Failed to save to localStorage", error);
    }
  }

  /**
   * Load session from localStorage
   * @returns {Object|null} Session data or null
   * @private
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(PERSISTENCE_CONFIG.STORAGE_KEY);
      if (!stored) return null;

      const session = JSON.parse(stored);
      logDebug("Session loaded from localStorage");
      return session;
    } catch (error) {
      logError("Failed to load from localStorage", error);
      return null;
    }
  }

  /**
   * Remove session from localStorage
   * @private
   */
  removeFromStorage() {
    try {
      localStorage.removeItem(PERSISTENCE_CONFIG.STORAGE_KEY);
      logDebug("Session removed from localStorage");
    } catch (error) {
      logError("Failed to remove from localStorage", error);
    }
  }

  // ==========================================================================
  // UI Updates
  // ==========================================================================

  /**
   * Show session controls, file controls, and editor toolbar
   * @private
   */
  showSessionControls() {
    // Show the editor toolbar container (Phase 5.3 update)
    const editorToolbar = document.getElementById("mmd-editor-toolbar");
    if (editorToolbar) {
      editorToolbar.hidden = false;
      logDebug("Editor toolbar shown");
    }

    const { sessionControls } = this.elements;
    if (sessionControls) {
      sessionControls.hidden = false;
      logDebug("Session controls shown");
    }

    // Also show file controls (Phase 5.3)
    if (typeof window.showMMDFileControls === "function") {
      window.showMMDFileControls();
    }
  }

  /**
   * Hide session controls, file controls, and editor toolbar
   * @private
   */
  hideSessionControls() {
    // Hide the editor toolbar container (Phase 5.3 update)
    const editorToolbar = document.getElementById("mmd-editor-toolbar");
    if (editorToolbar) {
      editorToolbar.hidden = true;
      logDebug("Editor toolbar hidden");
    }

    const { sessionControls } = this.elements;
    if (sessionControls) {
      sessionControls.hidden = true;
      logDebug("Session controls hidden");
    }

    // Also hide file controls (Phase 5.3)
    if (typeof window.hideMMDFileControls === "function") {
      window.hideMMDFileControls();
    }
  }

  /**
   * Update status indicator
   * @param {string} state - 'saved', 'modified', or 'saving'
   * @private
   */
  updateStatus(state) {
    const { sessionStatus } = this.elements;
    if (!sessionStatus) return;

    sessionStatus.dataset.state = state;
    sessionStatus.textContent =
      PERSISTENCE_CONFIG.STATUS_TEXT[state.toUpperCase()] || state;

    logDebug("Status updated", { state });
  }

  /**
   * Update button disabled states
   * @private
   */
  updateButtonStates() {
    const { undoBtn, redoBtn } = this.elements;

    if (undoBtn) {
      const canUndo = this.session && this.session.undoStack.length > 0;
      undoBtn.disabled = !canUndo;
    }

    if (redoBtn) {
      const canRedo = this.session && this.session.redoStack.length > 0;
      redoBtn.disabled = !canRedo;
    }

    logDebug("Button states updated", {
      canUndo: !undoBtn?.disabled,
      canRedo: !redoBtn?.disabled,
    });
  }

  /**
   * Update all UI state
   * @private
   */
  updateUIState() {
    this.updateButtonStates();
    this.updateStatus(this.isModified ? "modified" : "saved");
  }

  // ==========================================================================
  // Accessibility
  // ==========================================================================

  /**
   * Announce status message to screen readers
   * @param {string} message - Message to announce
   */
  announceStatus(message) {
    const { srStatus } = this.elements;
    if (srStatus) {
      srStatus.textContent = message;

      // Clear after announcement delay
      setTimeout(() => {
        srStatus.textContent = "";
      }, 1000);
    }

    logDebug("Status announced:", message);
  }

  /**
   * Confirm action with user
   * @param {string} message - Confirmation message
   * @returns {Promise<boolean>} True if confirmed
   * @private
   */
  async confirmAction(message) {
    // Use safeConfirm if available (from universal-modal.js)
    if (typeof window.safeConfirm === "function") {
      return await window.safeConfirm(message, "Confirm Action");
    }

    // Fallback to native confirm
    return window.confirm(message);
  }

  // ==========================================================================
  // State Query Methods
  // ==========================================================================

  /**
   * Check if there's an active session
   * @returns {boolean} True if session exists
   */
  hasSession() {
    return this.session !== null;
  }

  /**
   * Check if session has unsaved changes
   * @returns {boolean} True if modified
   */
  hasUnsavedChanges() {
    return this.isModified;
  }

  /**
   * Get undo stack size
   * @returns {number} Number of undo levels available
   */
  getUndoCount() {
    return this.session?.undoStack.length || 0;
  }

  /**
   * Get redo stack size
   * @returns {number} Number of redo levels available
   */
  getRedoCount() {
    return this.session?.redoStack.length || 0;
  }

  /**
   * Get session info
   * @returns {Object|null} Session metadata
   */
  getSessionInfo() {
    if (!this.session) return null;

    return {
      fileName: this.session.sourceFileName,
      lastModified: this.session.lastModified,
      undoCount: this.session.undoStack.length,
      redoCount: this.session.redoStack.length,
      isModified: this.isModified,
      contentLength: this.session.current.length,
      originalLength: this.session.original.length,
    };
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Clean up resources
   */
  cleanup() {
    // Clear auto-save timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    // Reset state (but don't clear storage - session persists)
    this.session = null;
    this.isModified = false;
    this.elements = {};
    this.elementsCached = false;
    this.isInitialised = false;

    logInfo("MMDEditorPersistence cleanup complete");
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let persistenceInstance = null;

/**
 * Get the singleton MMD Persistence instance
 * @returns {MMDEditorPersistence} The persistence instance
 */
function getMathPixMMDPersistence() {
  if (!persistenceInstance) {
    persistenceInstance = new MMDEditorPersistence();
  }
  return persistenceInstance;
}

// ============================================================================
// Global Functions for HTML onclick handlers
// ============================================================================

/**
 * Undo MMD edit
 * Called by onclick handler on undo button
 */
window.undoMMDEdit = function () {
  const persistence = getMathPixMMDPersistence();
  if (!persistence.isInitialised) {
    persistence.init();
  }
  persistence.undo();
};

/**
 * Redo MMD edit
 * Called by onclick handler on redo button
 */
window.redoMMDEdit = function () {
  const persistence = getMathPixMMDPersistence();
  if (!persistence.isInitialised) {
    persistence.init();
  }
  persistence.redo();
};

/**
 * Restore original MMD content
 * Called by onclick handler on restore button
 */
window.restoreOriginalMMD = function () {
  const persistence = getMathPixMMDPersistence();
  if (!persistence.isInitialised) {
    persistence.init();
  }
  persistence.restoreOriginal();
};

/**
 * Clear MMD session
 * Called by onclick handler on clear button
 */
window.clearMMDSession = function () {
  const persistence = getMathPixMMDPersistence();
  if (!persistence.isInitialised) {
    persistence.init();
  }
  persistence.clearSession();
};

/**
 * Restore MMD session from banner
 * Called by onclick handler on banner restore button
 */
window.restoreMMDSession = function () {
  const persistence = getMathPixMMDPersistence();
  if (!persistence.isInitialised) {
    persistence.init();
  }
  persistence.restoreSession();
};

/**
 * Dismiss MMD session banner
 * Called by onclick handler on banner dismiss button
 */
window.dismissMMDSessionBanner = function () {
  const persistence = getMathPixMMDPersistence();
  if (!persistence.isInitialised) {
    persistence.init();
  }
  persistence.dismissBanner();
};

/**
 * Global accessor for MMD Persistence instance
 */
window.getMathPixMMDPersistence = getMathPixMMDPersistence;

// ============================================================================
// Export
// ============================================================================

// Note: This module integrates with mathpix-mmd-editor-files.js (Phase 5.3)
// File controls are shown/hidden alongside session controls via:
// - window.showMMDFileControls() called in showSessionControls()
// - window.hideMMDFileControls() called in hideSessionControls()

export default MMDEditorPersistence;
export { getMathPixMMDPersistence, PERSISTENCE_CONFIG };

// ============================================================================
// Auto-initialisation on DOM ready
// ============================================================================

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      logDebug("DOM ready, persistence module available");
    });
  } else {
    logDebug("DOM already ready, persistence module available");
  }
}
