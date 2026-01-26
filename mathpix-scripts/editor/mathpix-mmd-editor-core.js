/**
 * @fileoverview MathPix MMD Editor - Core Module (Phase 5.1)
 * @module MMDEditorCore
 * @requires mathpix-config.js
 * @requires mathpix-mmd-preview.js
 * @version 1.0.0
 * @since 5.1.0
 *
 * @description
 * Provides in-place editing capability for MMD (Mathpix Markdown) content
 * with live preview synchronisation. Integrates with the existing MMD Preview
 * system to enable editing in Code and Split views.
 *
 * Features:
 * - Toggle edit mode on/off via toolbar button
 * - Textarea overlay replaces code display when editing
 * - Debounced live preview updates (300ms)
 * - Content sync between textarea and code element
 * - WCAG 2.2 AA compliant with screen reader announcements
 *
 * Views Support:
 * - Code view: Full editing support
 * - Split view: Full editing support with live preview
 * - Preview view: Edit button hidden (read-only)
 * - Compare view: Edit button hidden (read-only)
 *
 * @example
 * // Toggle edit mode programmatically
 * const editor = getMathPixMMDEditor();
 * editor.toggleEditMode();
 *
 * // Get current content
 * const content = editor.getContent();
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
 * @description Determines if a message should be logged based on current logging configuration
 * @param {number} level - The log level to check (0=ERROR, 1=WARN, 2=INFO, 3=DEBUG)
 * @returns {boolean} True if the message should be logged
 */
function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

/**
 * @function logError
 * @description Logs error messages if error logging is enabled
 * @param {string} message - The error message to log
 * @param {...any} args - Additional arguments to pass to console.error
 */
function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR))
    console.error("[MMD Editor]", message, ...args);
}

/**
 * @function logWarn
 * @description Logs warning messages if warning logging is enabled
 * @param {string} message - The warning message to log
 * @param {...any} args - Additional arguments to pass to console.warn
 */
function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn("[MMD Editor]", message, ...args);
}

/**
 * @function logInfo
 * @description Logs informational messages if info logging is enabled
 * @param {string} message - The info message to log
 * @param {...any} args - Additional arguments to pass to console.log
 */
function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log("[MMD Editor]", message, ...args);
}

/**
 * @function logDebug
 * @description Logs debug messages if debug logging is enabled
 * @param {string} message - The debug message to log
 * @param {...any} args - Additional arguments to pass to console.log
 */
function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log("[MMD Editor]", message, ...args);
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * @constant {Object} EDITOR_CONFIG
 * @description Configuration for the MMD Editor module
 */
// ============================================================================
// SVG Icon Registry
// ============================================================================

/**
 * @constant {Object} ICONS
 * @description SVG icon registry for consistent cross-platform rendering
 * All icons use currentColor for theme inheritance
 */
const ICONS = {
  pencil:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m14 1c.8284271.82842712.8284271 2.17157288 0 3l-9.5 9.5-4 1 1-3.9436508 9.5038371-9.55252193c.7829896-.78700064 2.0312313-.82943964 2.864366-.12506788z"/><path d="m12.5 3.5 1 1"/></g></svg>',
  check:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><path d="m.5 5.5 3 3 8.028-8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(5 6)"/></svg>',
  fullscreenEnter:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 2)"><path d="m16.5 5.5v-4.978l-5.5.014"/><path d="m16.5.522-6 5.907"/><path d="m11 16.521 5.5.002-.013-5.5"/><path d="m16.5 16.429-6-5.907"/><path d="m.5 5.5v-5h5.5"/><path d="m6.5 6.429-6-5.907"/><path d="m6 16.516-5.5.007v-5.023"/><path d="m6.5 10.5-6 6"/></g></svg>',
  fullscreenExit:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)"><path d="m.5 4.5 4.5-.013-.013-4.5"/><path d="m5 4.5-4.5-4"/><path d="m.5 8.5 4.5.014.013 4.5"/><path d="m5 8.5-4.5 4"/><path d="m12.5 4.5-4.5-.013.013-4.5"/><path d="m8 4.5 4.5-4"/><path d="m12.5 8.5-4.5.014-.013 4.5"/><path d="m8 8.5 4.5 4"/></g></svg>',
};

/**
 * Get an SVG icon by name with accessibility attributes
 * @param {string} name - Icon name from ICONS registry
 * @param {Object} [options] - Options
 * @param {string} [options.className] - Additional CSS class
 * @returns {string} SVG HTML string with aria-hidden
 */
function getIcon(name, options = {}) {
  const svg = ICONS[name];
  if (!svg) {
    logWarn(`Unknown icon: ${name}`);
    return "";
  }

  const className = options.className
    ? ` class="icon ${options.className}"`
    : ' class="icon"';
  return svg.replace("<svg", `<svg aria-hidden="true"${className}`);
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * @constant {Object} EDITOR_CONFIG
 * @description Configuration for the MMD Editor module
 */
const EDITOR_CONFIG = {
  DEBOUNCE_MS: 300,
  ALLOWED_VIEWS: ["code", "split"],
  DISALLOWED_VIEWS: ["preview", "pdf_split"],
  MESSAGES: {
    EDIT_MODE_ENABLED: "Edit mode enabled",
    EDIT_MODE_DISABLED: "Edit mode disabled",
    NO_CONTENT: "No MMD content available to edit",
    CONTENT_SYNCED: "Content updated",
  },
  BUTTON_TEXT: {
    START: "Edit MMD",
    STOP: "Stop Editing",
  },
  BUTTON_ICONS: {
    START: "pencil",
    STOP: "check",
  },
};

// ============================================================================
// MMDEditorCore Class
// ============================================================================

/**
 * @class MMDEditorCore
 * @description Core editor functionality for MMD content with live preview
 *
 * Provides in-place editing of MMD content in Code and Split views with
 * automatic preview synchronisation and accessibility support.
 *
 * @example
 * const editor = new MMDEditorCore();
 * editor.init();
 * editor.toggleEditMode();
 */
class MMDEditorCore {
  /**
   * Create a new MMDEditorCore instance
   */
  constructor() {
    // State
    this.isEditing = false;
    this.originalContent = null;
    this.debounceTimer = null;

    // DOM element references
    this.elements = {};
    this.elementsCached = false;

    // Initialisation flag
    this.isInitialised = false;

    // Content change callbacks (Phase 5.2)
    this.contentChangeCallbacks = [];

    // Fullscreen state (Phase 5.4)
    this.isFullscreen = false;

    logInfo("MMDEditorCore instance created");
  }

  // ==========================================================================
  // Initialisation Methods
  // ==========================================================================

  /**
   * Initialise the editor module
   * @returns {boolean} True if initialisation successful
   */
  init() {
    if (this.isInitialised) {
      logDebug("Already initialised, skipping");
      return true;
    }

    logInfo("Initialising MMD Editor...");

    // Cache DOM elements
    this.cacheElements();

    // Attach event listeners
    this.attachEventListeners();

    this.isInitialised = true;
    logInfo("MMD Editor initialised successfully");

    return true;
  }

  /**
   * Cache DOM element references for performance
   * @private
   */
  cacheElements() {
    this.elements = {
      // Edit button
      editBtn: document.getElementById("mmd-edit-btn"),

      // Fullscreen button (Phase 5.4)
      fullscreenBtn: document.getElementById("mmd-fullscreen-btn"),

      // Code container and elements
      codeContainer: document.getElementById("mmd-code-container"),
      codeElement: document.getElementById("mathpix-pdf-content-mmd"),
      codeBlockWrapper: document.querySelector(
        "#mmd-code-container .code-block-wrapper"
      ),

      // Editor elements
      editorWrapper: document.getElementById("mmd-editor-wrapper"),
      textarea: document.getElementById("mmd-editor-textarea"),
      statusElement: document.getElementById("mmd-editor-status"),

      // Content area for view detection
      contentArea: document.getElementById("mmd-content-area"),

      // Preview container for updates
      previewContent: document.getElementById("mmd-preview-content"),
    };

    // Validate critical elements
    const critical = [
      "editBtn",
      "codeContainer",
      "codeElement",
      "editorWrapper",
      "textarea",
    ];
    const missing = critical.filter((key) => !this.elements[key]);

    if (missing.length > 0) {
      logWarn("Missing critical MMD editor elements", { missing });
    }

    this.elementsCached = true;
    logDebug("MMD editor elements cached", {
      cached: Object.keys(this.elements).filter((k) => !!this.elements[k])
        .length,
      total: Object.keys(this.elements).length,
    });
  }

  /**
   * Attach event listeners
   * @private
   */
  attachEventListeners() {
    const { textarea } = this.elements;

    if (textarea) {
      // Input event with debounce for live preview
      textarea.addEventListener("input", () => this.handleInput());

      // Keyboard shortcuts
      textarea.addEventListener("keydown", (e) => this.handleKeydown(e));

      logDebug("Event listeners attached");
    }
  }

  // ==========================================================================
  // Edit Mode Control
  // ==========================================================================

  /**
   * Toggle edit mode on/off
   * @returns {boolean} True if now editing, false if stopped editing
   */
  toggleEditMode() {
    if (!this.isInitialised) {
      this.init();
    }

    // Check if current view allows editing
    const currentView = this.getCurrentView();
    if (!EDITOR_CONFIG.ALLOWED_VIEWS.includes(currentView)) {
      logWarn("Edit mode not allowed in view:", currentView);
      this.announceStatus(`Edit mode not available in ${currentView} view`);
      return this.isEditing;
    }

    if (this.isEditing) {
      this.stopEditing();
    } else {
      this.startEditing();
    }

    return this.isEditing;
  }

  /**
   * Start edit mode
   * @private
   */
  startEditing() {
    const { codeContainer, codeElement, textarea, editBtn } = this.elements;

    if (!codeElement || !textarea) {
      logError("Cannot start editing - missing elements");
      return;
    }

    // Store original content for potential revert
    this.originalContent = codeElement.textContent || "";

    // Populate textarea with current content
    textarea.value = this.originalContent;

    // Update container state
    if (codeContainer) {
      codeContainer.dataset.editing = "true";
    }

    // Show editor wrapper (remove hidden attribute)
    if (this.elements.editorWrapper) {
      this.elements.editorWrapper.hidden = false;
    }

    // Show fullscreen button (Phase 5.4)
    this.showFullscreenButton();

    // Update button state
    this.updateButtonState(true);

    // Update aria-pressed
    if (editBtn) {
      editBtn.setAttribute("aria-pressed", "true");
    }

    // Focus textarea
    textarea.focus();

    // Update state
    this.isEditing = true;

    // Announce to screen readers
    this.announceStatus(EDITOR_CONFIG.MESSAGES.EDIT_MODE_ENABLED);

    // Phase 5.2: Integrate with persistence module
    this.integrateWithPersistence();

    logInfo("Edit mode started", {
      contentLength: this.originalContent.length,
    });
  }

  /**
   * Integrate with persistence module when editing starts
   * Starts a session if one doesn't exist, registers callback for content changes
   * @private
   */
  integrateWithPersistence() {
    const persistence = window.getMathPixMMDPersistence?.();
    if (!persistence) {
      logDebug("Persistence module not available");
      return;
    }

    // Ensure persistence is initialised
    if (!persistence.isInitialised) {
      persistence.init();
    }

    // Start a session if one doesn't exist
    if (!persistence.hasSession()) {
      // Get filename from PDF handler via controller
      const controller = window.getMathPixController?.();
      const fileName =
        controller?.pdfHandler?.currentPDFFile?.name || "document.pdf";

      persistence.startSession(this.originalContent, fileName);
      logDebug("Persistence session started from editor", { fileName });
    }

    // Register callback for content changes (if not already registered)
    if (!this._persistenceCallbackRegistered) {
      this._persistenceUnregister = this.registerContentChangeCallback(
        (content) => {
          persistence.handleContentChange(content);
        }
      );
      this._persistenceCallbackRegistered = true;
      logDebug("Persistence callback registered");
    }
  }

  /**
   * Stop edit mode
   * @private
   */
  stopEditing() {
    const { codeContainer, editBtn } = this.elements;

    // Sync content back to code element
    this.syncToCodeElement();

    // Update container state
    if (codeContainer) {
      codeContainer.dataset.editing = "false";
    }

    // Hide editor wrapper (add hidden attribute)
    if (this.elements.editorWrapper) {
      this.elements.editorWrapper.hidden = true;
    }

    // Hide fullscreen button and exit fullscreen if active (Phase 5.4)
    this.hideFullscreenButton();

    // Update button state
    this.updateButtonState(false);

    // Update aria-pressed
    if (editBtn) {
      editBtn.setAttribute("aria-pressed", "false");
    }

    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Update state
    this.isEditing = false;

    // Announce to screen readers
    this.announceStatus(EDITOR_CONFIG.MESSAGES.EDIT_MODE_DISABLED);

    logInfo("Edit mode stopped");
  }

  /**
   * Update edit button text and icon
   * @param {boolean} isEditing - Whether currently editing
   * @private
   */
  updateButtonState(isEditing) {
    const { editBtn } = this.elements;
    if (!editBtn) return;

    if (isEditing) {
      editBtn.innerHTML = `${getIcon(EDITOR_CONFIG.BUTTON_ICONS.STOP)} ${
        EDITOR_CONFIG.BUTTON_TEXT.STOP
      }`;
    } else {
      editBtn.innerHTML = `${getIcon(EDITOR_CONFIG.BUTTON_ICONS.START)} ${
        EDITOR_CONFIG.BUTTON_TEXT.START
      }`;
    }
  }

  // ==========================================================================
  // Content Handling
  // ==========================================================================

  /**
   * Handle textarea input with debounce
   * @private
   */
  handleInput() {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Get current content for callbacks
    const currentContent = this.elements.textarea?.value || "";

    // Notify persistence module immediately (it handles its own debounce)
    this.notifyContentChangeCallbacks(currentContent);

    // Set new debounce timer for preview update
    this.debounceTimer = setTimeout(() => {
      this.updatePreview();
    }, EDITOR_CONFIG.DEBOUNCE_MS);

    logDebug("Input received, preview update scheduled");
  }

  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  handleKeydown(event) {
    // Escape key - exit fullscreen first, then edit mode
    if (event.key === "Escape") {
      event.preventDefault();
      if (this.isFullscreen) {
        // Exit fullscreen but stay in edit mode
        this.toggleFullscreen();
      } else {
        // Exit edit mode entirely
        this.stopEditing();
        // Return focus to edit button
        if (this.elements.editBtn) {
          this.elements.editBtn.focus();
        }
      }
    }
  }

  /**
   * Sync textarea content back to code element
   * @private
   */
  syncToCodeElement() {
    const { codeElement, textarea } = this.elements;

    if (!codeElement || !textarea) {
      logError("Cannot sync - missing elements");
      return;
    }

    const newContent = textarea.value;
    codeElement.textContent = newContent;

    // Re-apply Prism syntax highlighting if available
    if (window.Prism && window.Prism.highlightElement) {
      try {
        window.Prism.highlightElement(codeElement);
        logDebug("Prism highlighting re-applied");
      } catch (error) {
        logWarn("Prism highlighting failed", error);
      }
    }

    // Notify MMD Preview of content change
    this.notifyPreviewOfChange(newContent);

    logDebug("Content synced to code element", {
      contentLength: newContent.length,
    });
  }

  /**
   * Update the preview pane with current textarea content
   * @private
   */
  updatePreview() {
    const { textarea } = this.elements;

    if (!textarea) {
      logError("Cannot update preview - textarea not found");
      return;
    }

    const content = textarea.value;

    // Get MMD Preview instance and update
    const preview = window.getMathPixMMDPreview?.();
    if (preview && typeof preview.updateContent === "function") {
      preview.updateContent(content);
      logDebug("Preview updated with new content");
    } else {
      logDebug("Preview module not available or updateContent not implemented");
    }
  }

  /**
   * Notify MMD Preview module of content change
   * @param {string} content - Updated MMD content
   * @private
   */
  notifyPreviewOfChange(content) {
    const preview = window.getMathPixMMDPreview?.();
    if (preview) {
      preview.updateContent(content);
      logDebug("MMD Preview notified of content change and re-rendered");
    }
  }

  /**
   * Get current content from textarea (if editing) or code element
   * @returns {string} Current MMD content
   */
  getContent() {
    if (this.isEditing && this.elements.textarea) {
      return this.elements.textarea.value;
    }

    if (this.elements.codeElement) {
      return this.elements.codeElement.textContent || "";
    }

    return "";
  }

  /**
   * Set content in editor (updates both textarea and code element)
   * @param {string} content - MMD content to set
   */
  setContent(content) {
    const { codeElement, textarea } = this.elements;

    if (codeElement) {
      codeElement.textContent = content;

      // Re-apply Prism highlighting
      if (window.Prism && window.Prism.highlightElement) {
        try {
          window.Prism.highlightElement(codeElement);
        } catch (error) {
          logWarn("Prism highlighting failed", error);
        }
      }
    }

    if (textarea && this.isEditing) {
      textarea.value = content;
    }

    // Update preview to reflect the new content
    this.notifyPreviewOfChange(content);

    logDebug("Content set", { contentLength: content.length });
  }

  // ==========================================================================
  // Button Visibility Control
  // ==========================================================================

  /**
   * Show the edit button (called when MMD content is available)
   */
  showEditButton() {
    if (!this.isInitialised) {
      this.init();
    }

    const { editBtn } = this.elements;
    if (editBtn) {
      // Only show if current view allows editing
      const currentView = this.getCurrentView();
      if (EDITOR_CONFIG.ALLOWED_VIEWS.includes(currentView)) {
        editBtn.hidden = false;
        logDebug("Edit button shown");
      }
    }
  }

  /**
   * Hide the edit button (called when clearing/resetting)
   */
  hideEditButton() {
    const { editBtn } = this.elements;
    if (editBtn) {
      editBtn.hidden = true;

      // If currently editing, stop
      if (this.isEditing) {
        this.stopEditing();
      }

      logDebug("Edit button hidden");
    }
  }

  /**
   * Update edit button visibility based on current view
   * @param {string} viewMode - Current view mode
   */
  updateButtonVisibility(viewMode) {
    const { editBtn } = this.elements;
    if (!editBtn) return;

    // Check if view allows editing
    const allowed = EDITOR_CONFIG.ALLOWED_VIEWS.includes(viewMode);

    // Check if there's content to edit
    const hasContent = this.hasContent();

    if (allowed && hasContent) {
      editBtn.hidden = false;
    } else {
      editBtn.hidden = true;

      // If switching to disallowed view while editing, stop
      if (this.isEditing) {
        this.stopEditing();
      }
    }

    logDebug("Button visibility updated", { viewMode, allowed, hasContent });
  }

  // ==========================================================================
  // State Query Methods
  // ==========================================================================

  /**
   * Check if currently in edit mode
   * @returns {boolean} True if editing
   */
  isInEditMode() {
    return this.isEditing;
  }

  /**
   * Check if there's content available to edit
   * @returns {boolean} True if content exists
   */
  hasContent() {
    const { codeElement } = this.elements;
    return codeElement && codeElement.textContent.trim().length > 0;
  }

  /**
   * Get current view mode from content area
   * @returns {string} Current view mode
   * @private
   */
  getCurrentView() {
    const { contentArea } = this.elements;
    return contentArea?.dataset.currentView || "code";
  }

  // ==========================================================================
  // Content Change Callbacks (Phase 5.2)
  // ==========================================================================

  /**
   * Register a callback to be notified of content changes
   * Used by persistence module to track changes for undo/redo
   * @param {Function} callback - Callback function(content: string)
   * @returns {Function} Unregister function
   */
  registerContentChangeCallback(callback) {
    if (typeof callback !== "function") {
      logWarn("Invalid callback provided to registerContentChangeCallback");
      return () => {};
    }

    this.contentChangeCallbacks.push(callback);
    logDebug("Content change callback registered", {
      totalCallbacks: this.contentChangeCallbacks.length,
    });

    // Return unregister function
    return () => {
      const index = this.contentChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.contentChangeCallbacks.splice(index, 1);
        logDebug("Content change callback unregistered");
      }
    };
  }

  /**
   * Notify all registered callbacks of content change
   * @param {string} content - Updated content
   * @private
   */
  notifyContentChangeCallbacks(content) {
    if (this.contentChangeCallbacks.length === 0) return;

    this.contentChangeCallbacks.forEach((callback) => {
      try {
        callback(content);
      } catch (error) {
        logError("Error in content change callback", error);
      }
    });

    logDebug("Content change callbacks notified", {
      callbackCount: this.contentChangeCallbacks.length,
    });
  }

  // ==========================================================================
  // Accessibility
  // ==========================================================================

  /**
   * Announce status message to screen readers
   * @param {string} message - Message to announce
   */
  announceStatus(message) {
    const { statusElement } = this.elements;
    if (statusElement) {
      statusElement.textContent = message;

      // Clear after announcement delay
      setTimeout(() => {
        statusElement.textContent = "";
      }, 1000);
    }

    logDebug("Status announced:", message);
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Clean up resources
   */
  cleanup() {
    // Stop editing if active
    if (this.isEditing) {
      this.stopEditing();
    }

    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Unregister persistence callback (Phase 5.2)
    if (this._persistenceUnregister) {
      this._persistenceUnregister();
      this._persistenceUnregister = null;
      this._persistenceCallbackRegistered = false;
    }

    // Clear content change callbacks (Phase 5.2)
    this.contentChangeCallbacks = [];

    // Reset state
    this.elements = {};
    this.elementsCached = false;
    this.isInitialised = false;
    this.originalContent = null;

    logInfo("MMDEditorCore cleanup complete");
  }

  // ==========================================================================
  // Fullscreen Mode (Phase 5.4)
  // ==========================================================================

  /**
   * Toggle fullscreen edit mode
   */
  toggleFullscreen() {
    if (!this.isInitialised) {
      this.init();
    }

    this.isFullscreen = !this.isFullscreen;

    const { codeContainer, fullscreenBtn, textarea } = this.elements;

    if (codeContainer) {
      codeContainer.classList.toggle("fullscreen", this.isFullscreen);
    }

    // Toggle body and html class to prevent scrolling (fallback for browsers without :has())
    document.body.classList.toggle("mmd-fullscreen-active", this.isFullscreen);
    document.documentElement.classList.toggle(
      "mmd-fullscreen-active",
      this.isFullscreen
    );

    // Update button label and icon
    if (fullscreenBtn) {
      const label = this.isFullscreen
        ? "Exit fullscreen"
        : "Toggle fullscreen edit mode";
      fullscreenBtn.setAttribute("aria-label", label);
      fullscreenBtn.innerHTML = this.isFullscreen
        ? getIcon("fullscreenExit")
        : getIcon("fullscreenEnter");
    }
    // Focus textarea when entering fullscreen
    if (this.isFullscreen && textarea) {
      textarea.focus();
    }

    this.announceStatus(
      this.isFullscreen
        ? "Fullscreen edit mode enabled. Press Escape to exit."
        : "Fullscreen edit mode disabled"
    );

    logDebug("Fullscreen mode:", this.isFullscreen);
  }

  /**
   * Exit fullscreen mode
   * Called when stopping edit mode
   */
  exitFullscreen() {
    if (this.isFullscreen) {
      this.isFullscreen = false;

      const { codeContainer, fullscreenBtn } = this.elements;

      if (codeContainer) {
        codeContainer.classList.remove("fullscreen");
      }

      // Remove body and html class
      document.body.classList.remove("mmd-fullscreen-active");
      document.documentElement.classList.remove("mmd-fullscreen-active");

      if (fullscreenBtn) {
        fullscreenBtn.setAttribute("aria-label", "Toggle fullscreen edit mode");
        fullscreenBtn.innerHTML = getIcon("fullscreenEnter");
      }

      logDebug("Fullscreen mode exited");
    }
  }

  /**
   * Show fullscreen button (called when editing starts)
   */
  showFullscreenButton() {
    const { fullscreenBtn, codeContainer } = this.elements;
    if (fullscreenBtn) {
      fullscreenBtn.hidden = false;
    }
    if (codeContainer) {
      codeContainer.dataset.editing = "true";
    }
  }

  /**
   * Hide fullscreen button (called when editing stops)
   */
  hideFullscreenButton() {
    const { fullscreenBtn, codeContainer } = this.elements;
    if (fullscreenBtn) {
      fullscreenBtn.hidden = true;
    }
    if (codeContainer) {
      codeContainer.dataset.editing = "false";
    }
    // Also exit fullscreen if active
    this.exitFullscreen();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let editorInstance = null;

/**
 * Get the singleton MMD Editor instance
 * @returns {MMDEditorCore} The editor instance
 */
function getMathPixMMDEditor() {
  if (!editorInstance) {
    editorInstance = new MMDEditorCore();
  }
  return editorInstance;
}

// ============================================================================
// Global Functions for HTML onclick handlers
// ============================================================================

/**
 * Toggle MMD edit mode
 * Called by onclick handler on edit button
 */
window.toggleMMDEdit = function () {
  const editor = getMathPixMMDEditor();

  // Ensure initialised
  if (!editor.isInitialised) {
    editor.init();
  }

  editor.toggleEditMode();
};

/**
 * Toggle MMD fullscreen mode
 * Called by onclick handler on fullscreen button
 */
window.toggleMMDFullscreen = function () {
  const editor = getMathPixMMDEditor();

  // Ensure initialised
  if (!editor.isInitialised) {
    editor.init();
  }

  editor.toggleFullscreen();
};

/**
 * Global accessor for MMD Editor instance
 */
window.getMathPixMMDEditor = getMathPixMMDEditor;

// ============================================================================
// Export
// ============================================================================

export default MMDEditorCore;
export { getMathPixMMDEditor };

// ============================================================================
// Auto-initialisation on DOM ready
// ============================================================================

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      logDebug("DOM ready, editor module available");
    });
  } else {
    logDebug("DOM already ready, editor module available");
  }
}
