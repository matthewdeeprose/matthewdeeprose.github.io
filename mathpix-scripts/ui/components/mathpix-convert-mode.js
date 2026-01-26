/**
 * @fileoverview MathPix Convert Mode Controller
 * @module MathPixConvertMode
 * @version 1.0.0
 * @since 6.3.0
 *
 * @description
 * Standalone Convert Mode for direct MMD-to-format conversion without
 * requiring PDF processing first. Provides paste and file upload inputs,
 * preview functionality, and integrates with Phase 6.2 Convert UI.
 *
 * This is a GLUE module - it wires together existing components:
 * - Reuses Phase 6.2 Convert UI (mathpix-convert-ui.js)
 * - Reuses Phase 6.1 Convert API Client (mathpix-convert-api-client.js)
 * - Integrates with existing notification system
 *
 * @accessibility
 * - Full keyboard navigation
 * - Screen reader compatible
 * - WCAG 2.2 AA compliant
 */

// ============================================================================
// Logging Configuration
// ============================================================================

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
    console.error(`[ConvertMode] ${message}`, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[ConvertMode] ${message}`, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[ConvertMode] ${message}`, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[ConvertMode] ${message}`, ...args);
}

// ============================================================================
// SVG Icon Registry
// ============================================================================

/**
 * Centralised SVG icon registry for consistent icon usage
 * Icons use currentColor for theme-aware styling
 * @constant {Object}
 */
const ICONS = {
  check:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><path d="m.5 5.5 3 3 8.028-8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(5 6)"/></svg>',
  pencil:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)"><path d="m14 1c.8284271.82842712.8284271 2.17157288 0 3l-9.5 9.5-4 1 1-3.9436508 9.5038371-9.55252193c.7829896-.78700064 2.0312313-.82943964 2.864366-.12506788z"/><path d="m12.5 3.5 1 1"/></g></svg>',
  fullscreenEnter:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 2)"><path d="m16.5 5.5v-4.978l-5.5.014"/><path d="m16.5.522-6 5.907"/><path d="m11 16.521 5.5.002-.013-5.5"/><path d="m16.5 16.429-6-5.907"/><path d="m.5 5.5v-5h5.5"/><path d="m6.5 6.429-6-5.907"/><path d="m6 16.516-5.5.007v-5.023"/><path d="m6.5 10.5-6 6"/></g></svg>',
  fullscreenExit:
    '<svg height="21" viewBox="0 0 21 21" width="21" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)"><path d="m.5 4.5 4.5-.013-.013-4.5"/><path d="m5 4.5-4.5-4"/><path d="m.5 8.5 4.5.014.013 4.5"/><path d="m5 8.5-4.5 4"/><path d="m12.5 4.5-4.5-.013.013-4.5"/><path d="m8 4.5 4.5-4"/><path d="m12.5 8.5-4.5.014-.013 4.5"/><path d="m8 8.5 4.5 4"/></g></svg>',
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
// Main Class
// ============================================================================

/**
 * MathPix Convert Mode Controller
 * @class MathPixConvertMode
 */
class MathPixConvertMode {
  constructor() {
    /** @type {string} Current MMD content */
    this.currentMMDContent = "";

    /** @type {string} Base filename for downloads */
    this.filename = "converted-document";

    /** @type {File|null} Currently selected file */
    this.selectedFile = null;

    /** @type {boolean} Initialisation state */
    this.initialised = false;

    /** @type {Object} Cached DOM elements */
    this.elements = {};

    /** @type {boolean} Conversion in progress */
    this.isConverting = false;

    /** @type {Map} Completed downloads */
    this.completedDownloads = new Map();

    /** @type {Map} Blob URLs for download links - must be revoked to prevent memory leaks */
    this.downloadBlobUrls = new Map();

    // ========================================================================
    // Phase 6.4: Editor State
    // ========================================================================

    /** @type {boolean} Edit mode active */
    this.isEditMode = false;

    /** @type {Array<string>} Undo stack (max 10 levels) */
    this.undoStack = [];

    /** @type {Array<string>} Redo stack */
    this.redoStack = [];

    /** @type {number} Maximum undo levels */
    this.maxUndoLevels = 10;

    /** @type {number|null} Debounce timer for preview updates */
    this.previewDebounceTimer = null;

    /** @type {number} Debounce delay in ms */
    this.previewDebounceDelay = 300;

    /** @type {boolean} Fullscreen edit mode active */
    this.isFullscreen = false;

    // ========================================================================
    // MathJax Recovery State
    // ========================================================================

    /** @type {Function|null} Unsubscribe function for MathJax recovery events */
    this.mathJaxRecoveryUnsubscribe = null;
  }
  /**
   * Initialise the convert mode controller
   * @returns {boolean} True if initialisation successful
   */
  init() {
    if (this.initialised) {
      logDebug("Already initialised");
      return true;
    }

    try {
      this.cacheElements();
      this.attachEventListeners();
      this.attachTextareaListeners();
      this.subscribeToMathJaxRecovery();
      this.initialised = true;

      // Always-on edit mode - no toggle needed
      this.isEditMode = true;

      logInfo("MathPixConvertMode initialised successfully");
      return true;
    } catch (error) {
      logError("Initialisation failed:", error);
      return false;
    }
  }

  // ============================================================================
  // MathJax Recovery Handling
  // ============================================================================

  /**
   * Subscribe to MathJax recovery events
   * When MathJax recovers from startup errors, re-render the preview
   * @private
   */
  subscribeToMathJaxRecovery() {
    // Check if MathJax Manager is available
    if (
      !window.mathJaxManager ||
      typeof window.mathJaxManager.onRecovery !== "function"
    ) {
      logDebug("MathJax Manager not available for recovery subscription");
      return;
    }

    // Unsubscribe if already subscribed
    if (this.mathJaxRecoveryUnsubscribe) {
      this.mathJaxRecoveryUnsubscribe();
    }

    // Subscribe to recovery events
    this.mathJaxRecoveryUnsubscribe = window.mathJaxManager.onRecovery(
      async (eventData) => {
        logInfo(
          "MathJax recovery notification received in Convert Mode",
          eventData
        );

        // Only proceed if MathJax is now healthy
        if (eventData.healthy) {
          await this.handleMathJaxRecovery();
        }
      }
    );

    logDebug("Convert Mode subscribed to MathJax recovery events");
  }

  /**
   * Handle MathJax recovery by checking for errors and re-rendering if needed
   * @private
   */
  async handleMathJaxRecovery() {
    // Check if we have content to re-render
    if (!this.currentMMDContent || !this.currentMMDContent.trim()) {
      logDebug("No content to re-render after MathJax recovery");
      return;
    }

    // Check if there are MathJax errors in the preview
    const previewContainer = this.elements.previewRenderedContent;
    if (!previewContainer) {
      logDebug("Preview container not found for MathJax recovery");
      return;
    }

    const hasMathErrors = previewContainer.querySelector("mjx-merror") !== null;
    if (!hasMathErrors) {
      logDebug(
        "No MathJax errors found in preview, skipping recovery re-render"
      );
      return;
    }

    logInfo(
      "MathJax errors detected in Convert preview, attempting recovery..."
    );

    // Get the MMD Preview system to ensure CDN library is loaded
    const mmdPreview = window.getMathPixMMDPreview?.();
    if (mmdPreview) {
      // Check if CDN library needs loading
      if (!mmdPreview.isReady()) {
        logInfo("CDN library not loaded - retrying after MathJax recovery...");

        // Reset load state to allow retry
        mmdPreview.loadState = mmdPreview.config.LOAD_STATES.IDLE;
        mmdPreview.loadAttempts = 0;
        mmdPreview.loadError = null;

        try {
          await mmdPreview.loadLibrary();
          logInfo("CDN library loaded successfully after MathJax recovery");
        } catch (cdnError) {
          logWarn(
            "CDN library retry failed, will use fallback rendering:",
            cdnError.message
          );
          // Continue anyway - renderPreview will use fallback
        }
      }
    }

    // Re-render the preview
    try {
      await this.renderPreview(this.currentMMDContent);
      logInfo("Convert preview re-rendered after MathJax recovery");

      // Announce to screen readers
      this.announceToScreenReader("Mathematical content has been rendered");
    } catch (error) {
      logError(
        "Failed to re-render Convert preview after MathJax recovery:",
        error
      );
    }
  }

  /**
   * Cache DOM element references
   * @private
   */
  cacheElements() {
    this.elements = {
      // Container
      container: document.getElementById("mathpix-convert-mode-container"),

      // Input method radios
      pasteRadio: document.getElementById("convert-input-paste"),
      uploadRadio: document.getElementById("convert-input-upload"),

      // Input areas
      pasteArea: document.getElementById("convert-paste-area"),
      uploadArea: document.getElementById("convert-upload-area"),
      textarea: document.getElementById("convert-mmd-textarea"),

      // File upload
      dropzone: document.getElementById("convert-file-dropzone"),
      fileInput: document.getElementById("convert-file-input"),
      fileInfo: document.getElementById("convert-file-info"),
      fileName: document.getElementById("convert-file-name"),
      fileSize: document.getElementById("convert-file-size"),

      // Actions
      loadButton: document.getElementById("convert-load-content-btn"),

      // Preview
      previewSection: document.getElementById("convert-mode-preview-section"),
      previewCodeBtn: document.getElementById("convert-preview-code-btn"),
      previewRenderedBtn: document.getElementById(
        "convert-preview-rendered-btn"
      ),
      previewCodePane: document.getElementById("convert-preview-code"),
      previewRenderedPane: document.getElementById("convert-preview-rendered"),
      previewCodeContent: document.getElementById(
        "convert-preview-code-content"
      ),
      previewRenderedContent: document.getElementById(
        "convert-preview-rendered-content"
      ),

      // Phase 6.4: Editor toolbar elements
      editorToolbar: document.getElementById("convert-editor-toolbar"),
      editBtn: document.getElementById("convert-edit-btn"),
      undoBtn: document.getElementById("convert-undo-btn"),
      redoBtn: document.getElementById("convert-redo-btn"),
      downloadMmdBtn: document.getElementById("convert-download-mmd-btn"),
      uploadMmdInput: document.getElementById("convert-upload-mmd-input"),
      editorStatus: document.getElementById("convert-editor-status"),
      editorStatusText: document.getElementById("convert-editor-status-text"),

      // Phase 6.4: Edit overlay elements
      editOverlay: document.getElementById("convert-edit-overlay"),
      editTextarea: document.getElementById("convert-edit-textarea"),
      fullscreenBtn: document.getElementById("convert-fullscreen-btn"),
    };

    logDebug("Elements cached", Object.keys(this.elements).length);
  }

  /**
   * Attach event listeners
   * @private
   */
  attachEventListeners() {
    // Input method toggle
    this.elements.pasteRadio?.addEventListener("change", () =>
      this.switchInputMethod("paste")
    );
    this.elements.uploadRadio?.addEventListener("change", () =>
      this.switchInputMethod("upload")
    );

    // Textarea input monitoring
    this.elements.textarea?.addEventListener("input", () =>
      this.updateLoadButtonState()
    );

    // File dropzone events
    const dropzone = this.elements.dropzone;
    if (dropzone) {
      dropzone.addEventListener("click", () =>
        this.elements.fileInput?.click()
      );
      dropzone.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.elements.fileInput?.click();
        }
      });
      dropzone.addEventListener("dragover", (e) => this.handleDragOver(e));
      dropzone.addEventListener("dragleave", (e) => this.handleDragLeave(e));
      dropzone.addEventListener("drop", (e) => this.handleDrop(e));
    }

    // File input change
    this.elements.fileInput?.addEventListener("change", (e) =>
      this.handleFileSelect(e)
    );

    logDebug("Event listeners attached");
  }

  /**
   * Attach listeners for always-on textarea editing
   * @private
   */
  attachTextareaListeners() {
    const textarea = this.elements.editTextarea;
    if (!textarea) {
      logWarn("Edit textarea not found for listener attachment");
      return;
    }

    // Live preview on input (debounced)
    textarea.addEventListener("input", () => {
      this.handleTextareaInput();
    });

    // Drag and drop file support
    textarea.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      textarea.classList.add("drag-over");
    });

    textarea.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      textarea.classList.remove("drag-over");
    });

    textarea.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      textarea.classList.remove("drag-over");
      this.handleTextareaDrop(e);
    });

    // Push undo state on blur (when user leaves textarea)
    textarea.addEventListener("blur", () => {
      if (this.currentMMDContent !== textarea.value) {
        this.pushUndoState();
        this.currentMMDContent = textarea.value;
      }
    });

    logDebug("Textarea listeners attached");
  }

  /**
   * Handle textarea input with debounced preview update
   * @private
   */
  handleTextareaInput() {
    const textarea = this.elements.editTextarea;
    if (!textarea) return;

    const content = textarea.value;
    this.currentMMDContent = content;

    // Debounce preview updates
    if (this.previewDebounceTimer) {
      clearTimeout(this.previewDebounceTimer);
    }

    this.previewDebounceTimer = setTimeout(() => {
      this.renderPreview(content);
      this.updateExportSectionVisibility();
      this.updateToolbarState();
    }, this.previewDebounceDelay);
  }

  /**
   * Handle file drop on textarea
   * @param {DragEvent} e
   * @private
   */
  async handleTextareaDrop(e) {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file type
    const validExtensions = [".mmd", ".md", ".txt"];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      this.showNotification("Please drop a .mmd, .md, or .txt file", "error");
      return;
    }

    try {
      const content = await this.readFileContent(file);
      this.filename = this.sanitiseFilename(file.name);

      // Push current state to undo before loading file
      if (this.currentMMDContent) {
        this.pushUndoState();
      }

      // Load content into textarea
      const textarea = this.elements.editTextarea;
      if (textarea) {
        textarea.value = content;
        this.currentMMDContent = content;
        this.renderPreview(content);
        this.updateExportSectionVisibility();
        this.updateToolbarState();
      }

      this.showNotification(`Loaded: ${file.name}`, "success");
      logInfo("File dropped and loaded:", file.name);
    } catch (error) {
      logError("Failed to load dropped file:", error);
      this.showNotification("Failed to load file", "error");
    }
  }

  /**
   * Update export section visibility based on content
   * @private
   */
  updateExportSectionVisibility() {
    const exportSection = document.getElementById(
      "convert-mode-export-section"
    );
    const hasContent =
      this.currentMMDContent && this.currentMMDContent.trim().length > 0;

    if (exportSection) {
      exportSection.hidden = !hasContent;
    }

    // Also update convert button state
    this.updateConvertButtonState();
  }

  /**
   * Update toolbar button states (download, undo, redo)
   * @private
   */
  updateToolbarState() {
    const hasContent =
      this.currentMMDContent && this.currentMMDContent.trim().length > 0;

    // Download button
    if (this.elements.downloadMmdBtn) {
      this.elements.downloadMmdBtn.disabled = !hasContent;
    }

    // Undo/redo buttons
    this.updateUndoRedoButtons();
  }

  /**
   * Switch between paste and upload input methods
   * @param {string} method - 'paste' or 'upload'
   */
  switchInputMethod(method) {
    const isPaste = method === "paste";

    if (this.elements.pasteArea) {
      this.elements.pasteArea.hidden = !isPaste;
    }
    if (this.elements.uploadArea) {
      this.elements.uploadArea.hidden = isPaste;
    }

    this.updateLoadButtonState();
    logDebug("Input method switched to:", method);
  }

  /**
   * Handle dragover event
   * @param {DragEvent} e
   * @private
   */
  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    this.elements.dropzone?.classList.add("drag-over");
  }

  /**
   * Handle dragleave event
   * @param {DragEvent} e
   * @private
   */
  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    this.elements.dropzone?.classList.remove("drag-over");
  }

  /**
   * Handle file drop
   * @param {DragEvent} e
   * @private
   */
  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.elements.dropzone?.classList.remove("drag-over");

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  /**
   * Handle file input selection
   * @param {Event} e
   * @private
   */
  handleFileSelect(e) {
    const files = e.target?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  /**
   * Process selected file
   * @param {File} file
   * @private
   */
  processFile(file) {
    // Validate file type
    const validExtensions = [".mmd", ".md", ".txt"];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      this.showNotification("Please select a .mmd, .md, or .txt file", "error");
      return;
    }

    this.selectedFile = file;
    this.filename = this.sanitiseFilename(file.name);

    // Show file info
    if (this.elements.fileInfo) {
      this.elements.fileInfo.hidden = false;
    }
    if (this.elements.fileName) {
      this.elements.fileName.textContent = file.name;
    }
    if (this.elements.fileSize) {
      this.elements.fileSize.textContent = this.formatFileSize(file.size);
    }

    this.updateLoadButtonState();
    logInfo("File selected:", file.name);
  }

  /**
   * Clear selected file
   */
  clearFile() {
    this.selectedFile = null;

    if (this.elements.fileInput) {
      this.elements.fileInput.value = "";
    }
    if (this.elements.fileInfo) {
      this.elements.fileInfo.hidden = true;
    }

    this.updateLoadButtonState();
    logDebug("File cleared");
  }

  /**
   * Update load button enabled state
   * @private
   */
  updateLoadButtonState() {
    const isPasteMode = this.elements.pasteRadio?.checked;
    let hasContent = false;

    if (isPasteMode) {
      hasContent = (this.elements.textarea?.value?.trim().length || 0) > 0;
    } else {
      hasContent = this.selectedFile !== null;
    }

    if (this.elements.loadButton) {
      this.elements.loadButton.disabled = !hasContent;
    }
  }

  /**
   * Load content from current input and show preview
   * @returns {Promise<boolean>} True if content loaded successfully
   */
  async loadContent() {
    try {
      const isPasteMode = this.elements.pasteRadio?.checked;

      if (isPasteMode) {
        this.currentMMDContent = this.elements.textarea?.value?.trim() || "";
        this.filename = "pasted-content";
      } else if (this.selectedFile) {
        this.currentMMDContent = await this.readFileContent(this.selectedFile);
        this.filename = this.sanitiseFilename(this.selectedFile.name);
      } else {
        this.showNotification("No content to load", "error");
        return false;
      }

      if (!this.currentMMDContent) {
        this.showNotification("Content is empty", "error");
        return false;
      }

      // Show preview (async - loads library if needed)
      await this.showPreview(this.currentMMDContent);

      // Activate convert section
      this.activateConvertSection();

      this.showNotification("Content loaded successfully", "success");
      logInfo("Content loaded:", this.currentMMDContent.length, "characters");
      return true;
    } catch (error) {
      logError("Failed to load content:", error);
      this.showNotification(
        `Failed to load content: ${error.message}`,
        "error"
      );
      return false;
    }
  }

  /**
   * Read file content as text
   * @param {File} file
   * @returns {Promise<string>}
   * @private
   */
  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result || "");
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file, "UTF-8");
    });
  }

  /**
   * Show preview of MMD content (split view - both panes visible)
   * @param {string} content
   * @private
   */
  async showPreview(content) {
    // Show preview section
    if (this.elements.previewSection) {
      this.elements.previewSection.hidden = false;
    }

    // Update code preview (source pane) with syntax highlighting
    const codeElement = this.elements.previewCodeContent?.querySelector("code");
    if (codeElement) {
      codeElement.textContent = content;

      // Apply Prism syntax highlighting if available
      if (window.Prism && typeof Prism.highlightElement === "function") {
        try {
          Prism.highlightElement(codeElement);
          logDebug("Prism syntax highlighting applied");
        } catch (error) {
          logWarn("Prism highlighting failed:", error);
        }
      }
    }

    // Update rendered preview (preview pane - uses MathJax if available)
    await this.renderPreview(content);

    // Announce to screen readers
    this.announceToScreenReader(
      "Preview updated with source and rendered views"
    );
  }

  /**
   * Render MMD content with MathJax
   * @param {string} content
   * @private
   */
  async renderPreview(content) {
    // Re-query the container in case it wasn't cached properly
    const container =
      this.elements.previewRenderedContent ||
      document.getElementById("convert-preview-rendered-content");

    if (!container) {
      logWarn("Preview container not found");
      return;
    }

    // Ensure container is in DOM and visible
    if (!container.isConnected) {
      logWarn("Preview container not connected to DOM");
      return;
    }

    // Clear any previous MathJax processing
    if (window.MathJax?.typesetClear) {
      try {
        window.MathJax.typesetClear([container]);
      } catch (e) {
        // Ignore clear errors
      }
    }

    // Try to use existing MMD preview system first (better rendering)
    const mmdPreview = window.getMathPixMMDPreview?.();
    if (mmdPreview) {
      try {
        // Check if library is ready, if not load it first
        if (!mmdPreview.isReady()) {
          logDebug("MMD library not ready, loading...");
          await mmdPreview.loadLibrary();
          logDebug("MMD library loaded successfully");
        }

        // Now render the content
        const html = mmdPreview.renderToString(content);
        container.innerHTML = html;

        // Trigger MathJax typesetting if available
        if (window.MathJax?.typesetPromise) {
          try {
            await window.MathJax.typesetPromise([container]);
          } catch (mathError) {
            logWarn("MathJax typesetting failed:", mathError);
          }
        }
        logDebug("Preview rendered using MMD preview system");
        return;
      } catch (error) {
        logWarn("MMD preview system failed, using fallback:", error);
      }
    }

    // Fallback: Basic HTML conversion using placeholder pattern
    let html = content
      // Escape HTML first
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Preserve display math ($$...$$) - replace with placeholder, then restore
    const displayMathBlocks = [];
    html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, p1) => {
      const index = displayMathBlocks.length;
      displayMathBlocks.push(p1);
      return `%%DISPLAY_MATH_${index}%%`;
    });

    // Preserve inline math ($...$) - replace with placeholder, then restore
    const inlineMathBlocks = [];
    html = html.replace(/\$([^\$\n]+?)\$/g, (match, p1) => {
      const index = inlineMathBlocks.length;
      inlineMathBlocks.push(p1);
      return `%%INLINE_MATH_${index}%%`;
    });

    // Convert line breaks
    html = html.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br>");

    // Restore math blocks with proper delimiters
    displayMathBlocks.forEach((mathContent, index) => {
      html = html.replace(
        `%%DISPLAY_MATH_${index}%%`,
        `<div class="math-display">$$${mathContent}$$</div>`
      );
    });

    inlineMathBlocks.forEach((mathContent, index) => {
      html = html.replace(
        `%%INLINE_MATH_${index}%%`,
        `<span class="math-inline">$${mathContent}$</span>`
      );
    });

    html = `<p>${html}</p>`;
    container.innerHTML = html;

    // Trigger MathJax typesetting if available
    if (window.MathJax?.typesetPromise && container.isConnected) {
      try {
        // Clear previous math before re-typesetting
        if (window.MathJax.typesetClear) {
          window.MathJax.typesetClear([container]);
        }
        await window.MathJax.typesetPromise([container]);
        logDebug("MathJax typesetting complete (fallback)");
      } catch (error) {
        logWarn("MathJax typesetting failed:", error);
      }
    }
  }

  /**
   * Switch preview mode (legacy - kept for backwards compatibility)
   * In split view mode, both panes are always visible
   * @param {string} mode - 'code' or 'rendered' (ignored in split view)
   * @deprecated Split view shows both panes simultaneously
   */
  switchPreviewMode(mode) {
    // In split view, both panes are always visible
    // This method is kept for backwards compatibility only
    logDebug("switchPreviewMode called (no-op in split view):", mode);
  }

  /**
   * Copy source MMD content to clipboard
   * @returns {Promise<boolean>} True if copy succeeded
   */
  async copySourceToClipboard() {
    if (!this.currentMMDContent) {
      this.showNotification("No content to copy", "warning");
      return false;
    }

    try {
      await navigator.clipboard.writeText(this.currentMMDContent);
      this.showNotification("Source copied to clipboard!", "success");
      this.announceToScreenReader("Source code copied to clipboard");
      logDebug("Source content copied to clipboard");
      return true;
    } catch (error) {
      logError("Failed to copy to clipboard:", error);
      this.showNotification("Failed to copy to clipboard", "error");
      return false;
    }
  }

  /**
   * Announce message to screen readers
   * @param {string} message
   * @private
   */
  announceToScreenReader(message) {
    const statusEl = document.getElementById("convert-mode-status");
    if (statusEl) {
      statusEl.textContent = message;
      // Clear after announcement
      setTimeout(() => {
        if (statusEl.textContent === message) {
          statusEl.textContent = "";
        }
      }, 1000);
    }
  }

  /**
   * Update a progress item's status
   * @param {string} format - The format identifier (e.g., 'html', 'mmd.zip')
   * @param {string} status - Status: 'pending', 'processing', 'downloading', 'completed', 'error'
   * @param {string} statusText - Text to display in status element
   * @private
   */
  updateProgressItem(format, status, statusText) {
    const itemId = `convert-progress-${format.replace(/\./g, "-")}`;
    const progressItem = document.getElementById(itemId);

    if (!progressItem) {
      logWarn(`Progress item not found: ${itemId}`);
      return;
    }

    // Update data-status attribute (used by CSS for animations)
    progressItem.setAttribute("data-status", status);

    // Update the icon based on status
    const iconEl = progressItem.querySelector(".mathpix-progress-icon");
    if (iconEl) {
      const iconMap = {
        pending: "hourglass",
        processing: "refresh",
        downloading: "download",
        completed: "checkCircle",
        error: "error",
      };
      const iconName = iconMap[status] || "hourglass";
      iconEl.setAttribute("data-icon", iconName);

      // Populate the SVG icon
      if (typeof IconLibrary !== "undefined") {
        IconLibrary.populateIcons();
      }
    }

    // Update status text
    const statusEl = progressItem.querySelector(".mathpix-progress-status");
    if (statusEl) {
      statusEl.textContent = statusText;
    }

    // Add/remove complete class for styling
    if (status === "completed") {
      progressItem.classList.add("complete");
    } else if (status === "error") {
      progressItem.classList.add("error");
      progressItem.classList.remove("complete");
    } else {
      progressItem.classList.remove("complete", "error");
    }

    logDebug(`Progress item ${format} updated: ${status} - ${statusText}`);
  }

  /**
   * Activate the standalone Convert UI section with our content
   * @private
   */
  activateConvertSection() {
    logDebug("Activating standalone convert section...");

    // Show the standalone export section (inside convert mode container)
    const exportSection = document.getElementById(
      "convert-mode-export-section"
    );
    if (exportSection) {
      exportSection.hidden = false;
      logDebug("Standalone export section shown");
    } else {
      logWarn("Standalone export section not found");
    }

    // Phase 6.4: Show editor toolbar
    this.showEditorToolbar();

    // Update convert button state
    this.updateConvertButtonState();

    logInfo(
      "Standalone convert section activated with filename:",
      this.filename
    );
  }

  /**
   * Show the convert mode container
   */
  show() {
    if (!this.initialised) {
      this.init();
    }

    if (this.elements.container) {
      this.elements.container.style.display = "block";
    }

    // Focus the textarea for immediate editing
    if (this.elements.editTextarea) {
      this.elements.editTextarea.focus();
    }

    // Update visibility based on any existing content
    this.updateExportSectionVisibility();
    this.updateToolbarState();

    logDebug("Convert mode shown");
  }

  /**
   * Hide the convert mode container
   */
  hide() {
    if (this.elements.container) {
      this.elements.container.style.display = "none";
    }

    // Hide the standalone export section
    const exportSection = document.getElementById(
      "convert-mode-export-section"
    );
    if (exportSection) {
      exportSection.hidden = true;
    }

    // Clean up blob URLs to prevent memory leaks
    this.revokeDownloadUrls();

    logDebug("Convert mode hidden");
  }

  /**
   * Reset the convert mode to initial state
   * @param {boolean} showNotification - Whether to show a notification (default: true)
   */
  reset(showNotification = true) {
    // Unsubscribe from MathJax recovery events
    if (this.mathJaxRecoveryUnsubscribe) {
      this.mathJaxRecoveryUnsubscribe();
      this.mathJaxRecoveryUnsubscribe = null;
    }

    // Clean up blob URLs first to prevent memory leaks
    this.revokeDownloadUrls();

    // Reset state
    this.currentMMDContent = "";
    this.filename = "converted-document";
    this.selectedFile = null;
    this.isConverting = false;
    this.completedDownloads = new Map();

    // Clear edit textarea
    if (this.elements.editTextarea) {
      this.elements.editTextarea.value = "";
    }

    // Clear rendered preview
    if (this.elements.previewRenderedContent) {
      this.elements.previewRenderedContent.innerHTML = "";
    }

    // Clear undo/redo stacks
    this.undoStack = [];
    this.redoStack = [];

    // Hide export section (standalone convert mode)
    const exportSection = document.getElementById(
      "convert-mode-export-section"
    );
    if (exportSection) {
      exportSection.hidden = true;
    }

    // Reset format checkboxes
    const formatCheckboxes = document.querySelectorAll(
      'input[name="convert-mode-format"]'
    );
    formatCheckboxes.forEach((cb) => {
      cb.checked = false;
    });

    // Reset select all checkbox
    const selectAll = document.getElementById("convert-mode-select-all");
    if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }

    // Hide progress, downloads, and errors sections
    const progressSection = document.getElementById("convert-mode-progress");
    const downloadsSection = document.getElementById("convert-mode-downloads");
    const errorsSection = document.getElementById("convert-mode-errors");

    if (progressSection) progressSection.hidden = true;
    if (downloadsSection) downloadsSection.hidden = true;
    if (errorsSection) errorsSection.hidden = true;

    // Clear progress and downloads lists
    const progressList = document.getElementById("convert-mode-progress-list");
    const downloadsList = document.getElementById(
      "convert-mode-downloads-list"
    );
    const errorsList = document.getElementById("convert-mode-errors-list");

    if (progressList) progressList.innerHTML = "";
    if (downloadsList) downloadsList.innerHTML = "";
    if (errorsList) errorsList.innerHTML = "";

    // Reset buttons
    const convertBtn = document.getElementById("convert-mode-convert-btn");
    const cancelBtn = document.getElementById("convert-mode-cancel-btn");

    if (convertBtn) convertBtn.disabled = true;
    if (cancelBtn) cancelBtn.hidden = true;

    // Reset to paste mode
    if (this.elements.pasteRadio) {
      this.elements.pasteRadio.checked = true;
      this.switchInputMethod("paste");
    }

    this.updateLoadButtonState();

    if (showNotification) {
      this.showNotification(
        "Convert mode cleared and ready for new content",
        "info"
      );
    }

    logInfo("Convert mode reset to initial state");
  }

  /**
   * Sanitise filename for safe use
   * @param {string} filename
   * @returns {string}
   * @private
   */
  sanitiseFilename(filename) {
    if (!filename || typeof filename !== "string") return "converted-document";

    let baseName = filename.replace(/\.[^/.]+$/, "");
    baseName = baseName
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    return baseName || "converted-document";
  }

  /**
   * Format file size for display
   * @param {number} bytes
   * @returns {string}
   * @private
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Show notification using existing system
   * @param {string} message
   * @param {string} type - 'success', 'error', 'info', 'warning'
   * @private
   */
  showNotification(message, type) {
    // Try universal notification system first
    if (type === "success" && window.notifySuccess) {
      window.notifySuccess(message);
    } else if (type === "error" && window.notifyError) {
      window.notifyError(message);
    } else if (type === "warning" && window.notifyWarning) {
      window.notifyWarning(message);
    } else if (type === "info" && window.notifyInfo) {
      window.notifyInfo(message);
    } else {
      // Fallback to console
      console.log(`[ConvertMode ${type}]`, message);
    }
  }

  /**
   * Get current state for debugging
   * @returns {Object}
   */
  getState() {
    return {
      initialised: this.initialised,
      hasContent: this.currentMMDContent.length > 0,
      contentLength: this.currentMMDContent.length,
      filename: this.filename,
      hasSelectedFile: this.selectedFile !== null,
      inputMethod: this.elements.pasteRadio?.checked ? "paste" : "upload",
      isConverting: this.isConverting,
      selectedFormats: this.getSelectedFormats(),
    };
  }

  // ============================================================================
  // Standalone Conversion Methods
  // ============================================================================

  /**
   * Get selected formats from checkboxes
   * @returns {string[]}
   */
  getSelectedFormats() {
    const checkboxes = document.querySelectorAll(
      'input[name="convert-mode-format"]:checked'
    );
    return Array.from(checkboxes).map((cb) => cb.value);
  }

  /**
   * Update convert button enabled state based on format selection
   */
  updateConvertButtonState() {
    const convertBtn = document.getElementById("convert-mode-convert-btn");
    const selectedFormats = this.getSelectedFormats();

    if (convertBtn) {
      convertBtn.disabled =
        selectedFormats.length === 0 || !this.currentMMDContent;
    }
  }

  /**
   * Toggle select all checkbox
   * @param {HTMLInputElement} selectAllCheckbox
   */
  toggleSelectAll(selectAllCheckbox) {
    const checkboxes = document.querySelectorAll(
      'input[name="convert-mode-format"]'
    );
    checkboxes.forEach((cb) => {
      cb.checked = selectAllCheckbox.checked;
    });
    this.updateConvertButtonState();
  }

  /**
   * Update select all checkbox state based on individual selections
   */
  updateSelectAllState() {
    const selectAll = document.getElementById("convert-mode-select-all");
    const checkboxes = document.querySelectorAll(
      'input[name="convert-mode-format"]'
    );
    const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
    const someChecked = Array.from(checkboxes).some((cb) => cb.checked);

    if (selectAll) {
      selectAll.checked = allChecked;
      selectAll.indeterminate = someChecked && !allChecked;
    }
    this.updateConvertButtonState();
  }

  /**
   * Start conversion process
   */
  async startConversion() {
    const selectedFormats = this.getSelectedFormats();

    if (selectedFormats.length === 0) {
      this.showNotification("Please select at least one format", "error");
      return;
    }

    if (!this.currentMMDContent) {
      this.showNotification("No content to convert", "error");
      return;
    }

    // Get the Convert API Client
    const apiClient = window.getMathPixConvertClient?.();
    if (!apiClient) {
      this.showNotification("Convert API not available", "error");
      logError("Convert API Client not available");
      return;
    }

    this.isConverting = true;
    this.completedDownloads = new Map();

    // Update UI
    const convertBtn = document.getElementById("convert-mode-convert-btn");
    const cancelBtn = document.getElementById("convert-mode-cancel-btn");
    const progressSection = document.getElementById("convert-mode-progress");
    const progressList = document.getElementById("convert-mode-progress-list");
    const downloadsSection = document.getElementById("convert-mode-downloads");
    const errorsSection = document.getElementById("convert-mode-errors");

    if (convertBtn) convertBtn.disabled = true;
    if (cancelBtn) cancelBtn.hidden = false;
    if (progressSection) progressSection.hidden = false;
    if (downloadsSection) downloadsSection.hidden = true;
    if (errorsSection) errorsSection.hidden = true;

    // Create progress items using mathpix classes
    if (progressList) {
      progressList.innerHTML = selectedFormats
        .map(
          (format) => `
    <div class="mathpix-progress-item" id="convert-progress-${format.replace(
      /\./g,
      "-"
    )}" data-format="${format}" data-status="pending">
      <span class="mathpix-progress-icon" aria-hidden="true" data-icon="hourglass"></span>
      <span class="mathpix-progress-label">${this.getFormatDisplayName(
        format
      )}</span>
      <span class="mathpix-progress-status">Waiting...</span>
    </div>
  `
        )
        .join("");

      // Populate the SVG icons
      if (typeof IconLibrary !== "undefined") {
        IconLibrary.populateIcons();
      }
    }
    logInfo("Starting conversion for formats:", selectedFormats);

    try {
      // Convert all formats in one API call (more efficient)
      const results = await apiClient.convertAndDownload(
        this.currentMMDContent,
        selectedFormats, // Pass array of formats
        {
          onStart: (conversionId) => {
            logDebug("Conversion started:", conversionId);
            // Mark all as processing
            selectedFormats.forEach((format) => {
              this.updateProgressItem(format, "processing", "Processing...");
            });
          },
          onProgress: (status) => {
            logDebug("Conversion progress:", status);
            // Update progress for completed formats
            if (status.completed) {
              status.completed.forEach((format) => {
                this.updateProgressItem(
                  format,
                  "downloading",
                  "Downloading..."
                );
              });
            }
          },
          onFormatComplete: (format, blob) => {
            logDebug("Format complete:", format);
            this.updateProgressItem(format, "completed", "Complete");

            // Store result
            const downloadFilename = `${this.filename}.${this.getFileExtension(
              format
            )}`;
            this.completedDownloads.set(format, {
              blob: blob,
              filename: downloadFilename,
              format: format,
            });
          },
          onError: (error) => {
            logError("Conversion error:", error);
            // If error contains format info, update that specific item
            if (error.format) {
              this.updateProgressItem(
                error.format,
                "error",
                `Error: ${error.message || "Failed"}`
              );
            }
          },
        }
      );

      logInfo("Conversion complete, results:", results.size);

      // Handle any formats that completed but weren't caught by onFormatComplete
      results.forEach((blob, format) => {
        if (!this.completedDownloads.has(format)) {
          const downloadFilename = `${this.filename}.${this.getFileExtension(
            format
          )}`;
          this.completedDownloads.set(format, {
            blob: blob,
            filename: downloadFilename,
            format: format,
          });
        }
      });
    } catch (error) {
      logError("Conversion failed:", error);

      // Mark all incomplete formats as failed
      selectedFormats.forEach((format) => {
        if (!this.completedDownloads.has(format)) {
          const progressItem = document.getElementById(
            `convert-progress-${format.replace(".", "-")}`
          );
          const statusEl = progressItem?.querySelector(".progress-status");
          if (statusEl) statusEl.textContent = `Failed: ${error.message}`;
          if (progressItem) progressItem.classList.add("error");
        }
      });
    }

    this.isConverting = false;

    // Update UI after completion
    if (convertBtn) convertBtn.disabled = false;
    if (cancelBtn) cancelBtn.hidden = true;

    // Determine errors (formats that were selected but not completed)
    const errors = selectedFormats
      .filter((format) => !this.completedDownloads.has(format))
      .map((format) => ({ format, error: "Conversion failed" }));

    // Show downloads if any succeeded
    if (this.completedDownloads.size > 0) {
      this.showDownloads();
    }

    // Show errors if any
    if (errors.length > 0) {
      this.showErrors(errors);
    }

    // Notify user
    if (this.completedDownloads.size > 0 && errors.length === 0) {
      this.showNotification(
        `Successfully converted to ${this.completedDownloads.size} format(s)`,
        "success"
      );
    } else if (this.completedDownloads.size > 0) {
      this.showNotification(
        `Converted ${this.completedDownloads.size} format(s) with ${errors.length} error(s)`,
        "warning"
      );
    } else {
      this.showNotification("All conversions failed", "error");
    }
  }

  /**
   * Cancel ongoing conversion
   */
  cancelConversion() {
    this.isConverting = false;
    this.showNotification("Conversion cancelled", "info");
    logInfo("Conversion cancelled by user");
  }

  /**
   * Get file extension for format
   * @param {string} format
   * @returns {string}
   * @private
   */
  getFileExtension(format) {
    const extensions = {
      docx: "docx",
      pdf: "pdf",
      "tex.zip": "tex.zip",
      "latex.pdf": "pdf",
      html: "html",
      md: "md",
      pptx: "pptx",
      "mmd.zip": "mmd.zip",
      "md.zip": "md.zip",
      "html.zip": "html.zip",
    };
    return extensions[format] || format;
  }

  /**
   * Get human-readable display name for format
   * @param {string} format
   * @returns {string}
   * @private
   */
  getFormatDisplayName(format) {
    const displayNames = {
      docx: "DOCX (Word)",
      pdf: "PDF (HTML)",
      "tex.zip": "LaTeX (ZIP)",
      "latex.pdf": "PDF (LaTeX)",
      html: "HTML",
      md: "Markdown",
      pptx: "PowerPoint",
      "mmd.zip": "MMD Archive",
      "md.zip": "MD Archive",
      "html.zip": "HTML Archive",
    };
    return displayNames[format] || format.toUpperCase();
  }

  /**
   * Show download links for completed conversions
   * Uses anchor elements instead of buttons to ensure downloads work.
   * Browser security blocks programmatic a.click() calls when not a direct
   * user gesture, so we use real anchors with blob URLs in href attribute.
   */
  showDownloads() {
    const downloadsSection = document.getElementById("convert-mode-downloads");
    const downloadsList = document.getElementById(
      "convert-mode-downloads-list"
    );
    const downloadAllBtn = document.getElementById(
      "convert-mode-download-all-btn"
    );

    if (!downloadsSection || !downloadsList) return;

    // Clean up any existing blob URLs before creating new ones
    this.revokeDownloadUrls();
    downloadsList.innerHTML = "";

    this.completedDownloads.forEach((data, format) => {
      // Create blob URL for direct download
      const url = URL.createObjectURL(data.blob);
      this.downloadBlobUrls.set(format, url);

      // Create anchor element (not button) for direct download
      // Clicking an anchor with href and download attributes is a direct
      // user gesture that browsers allow, unlike programmatic a.click()
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename;
      link.className = "mathpix-btn mathpix-btn-secondary mathpix-download-btn";
      link.innerHTML = `
        <svg aria-hidden="true" height="16" viewBox="0 0 20 20" width="16" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 3v10m0 0l-4-4m4 4l4-4M3 17h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>
        </svg>
        <span>${this.getFormatDisplayName(format)}</span>
      `;
      link.setAttribute(
        "aria-label",
        `Download ${this.getFormatDisplayName(format)} file`
      );

      // Track download for logging (does not affect download behaviour)
      link.addEventListener("click", () => {
        logInfo(`Downloaded: ${data.filename}`);
      });

      downloadsList.appendChild(link);
    });

    downloadsSection.hidden = false;

    // Only show "Download All as ZIP" when there are multiple files
    if (downloadAllBtn) {
      downloadAllBtn.hidden = this.completedDownloads.size <= 1;
    }

    // Announce to screen readers
    const fileWord = this.completedDownloads.size === 1 ? "file" : "files";
    this.announceToScreenReader(
      `${this.completedDownloads.size} ${fileWord} ready for download`
    );

    logDebug("Download links shown:", this.completedDownloads.size);
  }
  /**
   * Revoke blob URLs to free memory
   * Called during reset, hide, and before creating new download links
   * @private
   */
  revokeDownloadUrls() {
    if (this.downloadBlobUrls && this.downloadBlobUrls.size > 0) {
      this.downloadBlobUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      this.downloadBlobUrls.clear();
      logDebug("Blob URLs revoked for memory cleanup");
    }
  }

  /**
   * Download a single file
   * @param {string} format
   */
  downloadFile(format) {
    const data = this.completedDownloads.get(format);
    if (!data) {
      this.showNotification(`Download not available for ${format}`, "error");
      return;
    }

    const url = URL.createObjectURL(data.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = data.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    logInfo(`Downloaded: ${data.filename}`);
  }

  /**
   * Download all completed files as ZIP
   * Uses a visible link fallback to handle browser security restrictions
   * on programmatic downloads after async operations
   */
  async downloadAllAsZip() {
    if (this.completedDownloads.size === 0) {
      this.showNotification("No files to download", "error");
      return;
    }

    // Check for JSZip
    if (typeof JSZip === "undefined") {
      this.showNotification("ZIP library not available", "error");
      logError("JSZip not loaded");
      return;
    }

    // Show progress
    this.showNotification("Creating ZIP archive...", "info");

    try {
      const zip = new JSZip();

      this.completedDownloads.forEach((data, format) => {
        zip.file(data.filename, data.blob);
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipFilename = `${this.filename}-converted.zip`;
      const url = URL.createObjectURL(zipBlob);

      // Try programmatic download first
      const a = document.createElement("a");
      a.href = url;
      a.download = zipFilename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();

      // Check if download started (give browser a moment)
      setTimeout(() => {
        document.body.removeChild(a);

        // Fallback: If programmatic download didn't work (async user gesture issue),
        // replace the Download All button with a direct download link
        const downloadAllBtn = document.getElementById(
          "convert-mode-download-all-btn"
        );
        if (downloadAllBtn) {
          // Create a direct download link as fallback
          const fallbackLink = document.createElement("a");
          fallbackLink.href = url;
          fallbackLink.download = zipFilename;
          fallbackLink.className = downloadAllBtn.className;
          fallbackLink.innerHTML = `
            <svg aria-hidden="true" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 3v10m0 0l-4-4m4 4l4-4M3 17h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>
            </svg>
            <span>Click to Save ZIP</span>
          `;
          fallbackLink.setAttribute("aria-label", "Click to save ZIP archive");
          fallbackLink.id = "convert-mode-download-all-link";

          // Store URL reference for cleanup
          fallbackLink.dataset.blobUrl = url;

          // Replace button with link
          downloadAllBtn.parentNode.replaceChild(fallbackLink, downloadAllBtn);

          this.showNotification(
            "ZIP ready - click 'Click to Save ZIP' to download",
            "success"
          );
          logInfo("Fallback download link created for ZIP");
        }
      }, 100);

      logInfo(`ZIP archive created with ${this.completedDownloads.size} files`);
    } catch (error) {
      logError("Failed to create ZIP:", error);
      this.showNotification("Failed to create ZIP archive", "error");
    }
  }
  /**
   * Show conversion errors
   * @param {Array} errors
   */
  showErrors(errors) {
    const errorsSection = document.getElementById("convert-mode-errors");
    const errorsList = document.getElementById("convert-mode-errors-list");

    if (!errorsSection || !errorsList) return;

    errorsList.innerHTML = errors
      .map(
        (e) => `<li><strong>${e.format.toUpperCase()}:</strong> ${e.error}</li>`
      )
      .join("");

    errorsSection.hidden = false;
    logDebug("Errors shown:", errors.length);
  }

  // ==========================================================================
  // Phase 6.4: Editor Methods
  // ==========================================================================

  /**
   * Show the editor toolbar
   * @private
   */
  showEditorToolbar() {
    if (this.elements.editorToolbar) {
      this.elements.editorToolbar.hidden = false;
      logDebug("Editor toolbar shown");
    }
  }

  /**
   * Hide the editor toolbar
   * @private
   */
  hideEditorToolbar() {
    if (this.elements.editorToolbar) {
      this.elements.editorToolbar.hidden = true;
      logDebug("Editor toolbar hidden");
    }
  }

  /**
   * Toggle edit mode on/off
   */
  toggleEditMode() {
    if (this.isEditMode) {
      this.exitEditMode();
    } else {
      this.enterEditMode();
    }
  }

  /**
   * Toggle fullscreen edit mode
   */
  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;

    // Get the source pane element
    const sourcePane = document.querySelector(".convert-source-pane");

    if (sourcePane) {
      sourcePane.classList.toggle("fullscreen", this.isFullscreen);
    }

    // Update button label and icon
    if (this.elements.fullscreenBtn) {
      const label = this.isFullscreen
        ? "Exit fullscreen"
        : "Toggle fullscreen edit mode";
      this.elements.fullscreenBtn.setAttribute("aria-label", label);
      // Use different icons for enter/exit fullscreen
      // Use different icons for enter/exit fullscreen
      this.elements.fullscreenBtn.innerHTML = this.isFullscreen
        ? getIcon("fullscreenExit")
        : getIcon("fullscreenEnter");
    }

    // Focus textarea when entering fullscreen
    if (this.isFullscreen && this.elements.editTextarea) {
      this.elements.editTextarea.focus();
    }

    this.announceToScreenReader(
      this.isFullscreen
        ? "Fullscreen edit mode enabled. Press Escape to exit."
        : "Fullscreen edit mode disabled"
    );

    logDebug("Fullscreen mode:", this.isFullscreen);
  }

  /**
   * Exit fullscreen mode
   * @private
   */
  exitFullscreen() {
    if (this.isFullscreen) {
      this.isFullscreen = false;

      // Remove fullscreen from source pane
      const sourcePane = document.querySelector(".convert-source-pane");
      if (sourcePane) {
        sourcePane.classList.remove("fullscreen");
      }

      // Also handle edit overlay if present
      if (this.elements.editOverlay) {
        this.elements.editOverlay.classList.remove("fullscreen");
      }

      // Update button state
      if (this.elements.fullscreenBtn) {
        this.elements.fullscreenBtn.setAttribute(
          "aria-label",
          "Toggle fullscreen edit mode"
        );
        this.elements.fullscreenBtn.innerHTML = getIcon("fullscreenEnter");
      }
    }
  }
  /**
   * Enter edit mode - show textarea overlay
   */
  enterEditMode() {
    const { editOverlay, editTextarea, editBtn, fullscreenBtn } = this.elements;

    if (!editOverlay || !editTextarea) {
      logWarn("Edit overlay elements not found");
      return;
    }

    // Push current state to undo stack before editing
    this.pushUndoState();

    // Populate textarea with current content
    editTextarea.value = this.currentMMDContent;

    // Show overlay
    editOverlay.hidden = false;
    this.isEditMode = true;

    // Show fullscreen button
    if (fullscreenBtn) {
      fullscreenBtn.hidden = false;
    }

    // Update button state
    if (editBtn) {
      editBtn.setAttribute("aria-pressed", "true");
      editBtn.innerHTML = `${getIcon("check")} Done Editing`;
    }

    // Attach edit mode event listeners
    this.attachEditModeListeners();

    // Focus textarea
    editTextarea.focus();

    // Update status
    this.updateEditorStatus("Editing...");
    this.announceToScreenReader("Edit mode activated. Press Escape to exit.");

    logInfo("Edit mode entered");
  }

  /**
   * Exit edit mode - hide textarea overlay, update content
   */
  exitEditMode() {
    const { editOverlay, editTextarea, editBtn, fullscreenBtn } = this.elements;

    if (!editOverlay || !editTextarea) {
      return;
    }

    // Get edited content
    const newContent = editTextarea.value;

    // Check if content changed
    if (newContent !== this.currentMMDContent) {
      this.currentMMDContent = newContent;
      // Update preview with new content
      this.showPreview(this.currentMMDContent);
      this.updateEditorStatus("Changes applied");
    } else {
      this.updateEditorStatus("");
    }

    // Hide overlay
    editOverlay.hidden = true;
    this.isEditMode = false;

    // Exit fullscreen and hide button
    this.exitFullscreen();
    if (fullscreenBtn) {
      fullscreenBtn.hidden = true;
    }

    // Update button state
    if (editBtn) {
      editBtn.setAttribute("aria-pressed", "false");
      editBtn.innerHTML = `${getIcon("pencil")} Edit MMD`;
    }

    // Remove edit mode event listeners
    this.detachEditModeListeners();

    // Update undo/redo button states
    this.updateUndoRedoButtons();

    this.announceToScreenReader("Edit mode exited");
    logInfo("Edit mode exited");
  }

  /**
   * Attach event listeners for edit mode
   * @private
   */
  attachEditModeListeners() {
    const { editTextarea } = this.elements;
    if (!editTextarea) return;

    // Store bound handlers for removal later
    this._handleEditKeydown = (e) => this.handleEditKeydown(e);
    this._handleEditInput = () => this.handleEditInput();

    editTextarea.addEventListener("keydown", this._handleEditKeydown);
    editTextarea.addEventListener("input", this._handleEditInput);

    logDebug("Edit mode listeners attached");
  }

  /**
   * Detach event listeners for edit mode
   * @private
   */
  detachEditModeListeners() {
    const { editTextarea } = this.elements;
    if (!editTextarea) return;

    if (this._handleEditKeydown) {
      editTextarea.removeEventListener("keydown", this._handleEditKeydown);
    }
    if (this._handleEditInput) {
      editTextarea.removeEventListener("input", this._handleEditInput);
    }

    logDebug("Edit mode listeners detached");
  }

  /**
   * Handle keydown in edit mode
   * @param {KeyboardEvent} e
   * @private
   */
  handleEditKeydown(e) {
    // Escape exits edit mode
    if (e.key === "Escape") {
      e.preventDefault();
      this.exitEditMode();
      return;
    }

    // Ctrl+Z for undo - allow default browser undo within textarea
    if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
      return;
    }

    // Ctrl+Y or Ctrl+Shift+Z for redo - allow default browser redo
    if (e.ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
      return;
    }
  }

  /**
   * Handle input in edit mode - debounced preview update
   * @private
   */
  handleEditInput() {
    // Clear existing debounce timer
    if (this.previewDebounceTimer) {
      clearTimeout(this.previewDebounceTimer);
    }

    // Set new debounce timer for live preview
    this.previewDebounceTimer = setTimeout(() => {
      const { editTextarea } = this.elements;
      if (editTextarea && this.isEditMode) {
        const content = editTextarea.value;
        // Update rendered preview only (not source pane while editing)
        this.renderPreview(content);
        logDebug("Live preview updated");
      }
    }, this.previewDebounceDelay);
  }

  /**
   * Push current state to undo stack
   * @private
   */
  pushUndoState() {
    if (!this.currentMMDContent) return;

    // Don't push if same as last undo state
    if (
      this.undoStack.length > 0 &&
      this.undoStack[this.undoStack.length - 1] === this.currentMMDContent
    ) {
      return;
    }

    this.undoStack.push(this.currentMMDContent);

    // Limit stack size
    if (this.undoStack.length > this.maxUndoLevels) {
      this.undoStack.shift();
    }

    // Clear redo stack when new change is made
    this.redoStack = [];

    this.updateUndoRedoButtons();
    logDebug("Undo state pushed, stack size:", this.undoStack.length);
  }

  /**
   * Undo last change
   */
  undo() {
    if (this.undoStack.length === 0) {
      this.showNotification("Nothing to undo", "info");
      return;
    }

    // Push current state to redo stack
    this.redoStack.push(this.currentMMDContent);

    // Pop from undo stack
    this.currentMMDContent = this.undoStack.pop();

    // Update display
    this.showPreview(this.currentMMDContent);

    // If in edit mode, update textarea
    if (this.isEditMode && this.elements.editTextarea) {
      this.elements.editTextarea.value = this.currentMMDContent;
    }

    this.updateUndoRedoButtons();
    this.updateEditorStatus("Undone");
    this.announceToScreenReader("Change undone");

    logInfo("Undo performed, stack size:", this.undoStack.length);
  }

  /**
   * Redo last undone change
   */
  redo() {
    if (this.redoStack.length === 0) {
      this.showNotification("Nothing to redo", "info");
      return;
    }

    // Push current state to undo stack
    this.undoStack.push(this.currentMMDContent);

    // Pop from redo stack
    this.currentMMDContent = this.redoStack.pop();

    // Update display
    this.showPreview(this.currentMMDContent);

    // If in edit mode, update textarea
    if (this.isEditMode && this.elements.editTextarea) {
      this.elements.editTextarea.value = this.currentMMDContent;
    }

    this.updateUndoRedoButtons();
    this.updateEditorStatus("Redone");
    this.announceToScreenReader("Change redone");

    logInfo("Redo performed, stack size:", this.redoStack.length);
  }

  /**
   * Update undo/redo button disabled states
   * @private
   */
  updateUndoRedoButtons() {
    const { undoBtn, redoBtn } = this.elements;

    if (undoBtn) {
      undoBtn.disabled = this.undoStack.length === 0;
    }

    if (redoBtn) {
      redoBtn.disabled = this.redoStack.length === 0;
    }

    logDebug("Undo/redo buttons updated", {
      undoAvailable: this.undoStack.length,
      redoAvailable: this.redoStack.length,
    });
  }

  /**
   * Update editor status text
   * @param {string} message
   * @private
   */
  updateEditorStatus(message) {
    if (this.elements.editorStatusText) {
      this.elements.editorStatusText.textContent = message;

      // Clear status after delay (except while editing)
      if (message && !this.isEditMode) {
        setTimeout(() => {
          if (
            this.elements.editorStatusText &&
            this.elements.editorStatusText.textContent === message
          ) {
            this.elements.editorStatusText.textContent = "";
          }
        }, 3000);
      }
    }
  }

  /**
   * Download current MMD content as file
   */
  downloadMMD() {
    if (!this.currentMMDContent) {
      this.showNotification("No content to download", "error");
      return;
    }

    // Generate filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .slice(0, 16)
      .replace(/[T:]/g, "-");
    const downloadFilename = `${this.filename}-${timestamp}.mmd`;

    // Create blob and download
    const blob = new Blob([this.currentMMDContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = downloadFilename;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    URL.revokeObjectURL(url);

    this.showNotification(`Downloaded as ${downloadFilename}`, "success");
    this.announceToScreenReader(`File downloaded as ${downloadFilename}`);

    logInfo("MMD downloaded:", downloadFilename);
  }

  /**
   * Handle MMD file upload
   * @param {FileList} files
   */
  async handleMMDUpload(files) {
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];

    // Validate file type
    const validExtensions = [".mmd", ".md", ".txt"];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      this.showNotification("Please select a .mmd, .md, or .txt file", "error");
      this.resetUploadInput();
      return;
    }

    // Warn about unsaved changes
    if (this.currentMMDContent && this.undoStack.length > 0) {
      const confirmed = await this.confirmAction(
        "Loading a new file will replace the current content. Your current content will be added to undo history. Continue?"
      );
      if (!confirmed) {
        this.resetUploadInput();
        return;
      }
    }

    try {
      // Push current state to undo before loading new content
      if (this.currentMMDContent) {
        this.pushUndoState();
      }

      // Read file content
      const content = await this.readFileContent(file);

      if (!content || !content.trim()) {
        this.showNotification("File is empty", "error");
        this.resetUploadInput();
        return;
      }

      // Update state
      this.currentMMDContent = content;
      this.filename = this.sanitiseFilename(file.name);

      // Update the always-on textarea
      if (this.elements.editTextarea) {
        this.elements.editTextarea.value = content;
      }

      // Update preview
      await this.renderPreview(this.currentMMDContent);

      // Update export section visibility and toolbar state
      this.updateExportSectionVisibility();
      this.updateToolbarState();

      // Clear redo stack (new timeline)
      this.redoStack = [];
      this.updateUndoRedoButtons();

      this.showNotification(`Loaded ${file.name}`, "success");
      this.announceToScreenReader(`File ${file.name} loaded successfully`);

      logInfo("MMD file uploaded:", file.name);
    } catch (error) {
      logError("Failed to load file:", error);
      this.showNotification("Failed to load file", "error");
    }

    this.resetUploadInput();
  }

  /**
   * Reset the upload input
   * @private
   */
  resetUploadInput() {
    if (this.elements.uploadMmdInput) {
      this.elements.uploadMmdInput.value = "";
    }
  }

  /**
   * Confirm action with user
   * @param {string} message
   * @returns {Promise<boolean>}
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
}

// ============================================================================
// Singleton Instance
// ============================================================================
let convertModeInstance = null;

/**
 * Get or create the singleton instance
 * @returns {MathPixConvertMode}
 */
function getMathPixConvertMode() {
  if (!convertModeInstance) {
    convertModeInstance = new MathPixConvertMode();
  }
  return convertModeInstance;
}
// ============================================================================
// Global Functions for onclick Handlers
// ============================================================================

// ----------------------------------------------------------------------------
// Phase 6.4: Editor Functions
// ----------------------------------------------------------------------------

/**
 * Toggle edit mode in convert mode
 * Called by Edit MMD button onclick
 */
function toggleConvertModeEdit() {
  const mode = getMathPixConvertMode();
  mode.toggleEditMode();
}

/**
 * Undo last edit in convert mode
 * Called by Undo button onclick
 */
function undoConvertModeEdit() {
  const mode = getMathPixConvertMode();
  mode.undo();
}

/**
 * Redo last undone edit in convert mode
 * Called by Redo button onclick
 */
function redoConvertModeEdit() {
  const mode = getMathPixConvertMode();
  mode.redo();
}

/**
 * Download current MMD content
 * Called by Download MMD button onclick
 */
function downloadConvertModeMMD() {
  const mode = getMathPixConvertMode();
  mode.downloadMMD();
}

/**
 * Handle MMD file upload in convert mode
 * Called by Upload MMD input onchange
 * @param {FileList} files
 */
function handleConvertModeMMDUpload(files) {
  const mode = getMathPixConvertMode();
  mode.handleMMDUpload(files);
}

/**
 * Toggle fullscreen edit mode
 */
function toggleConvertModeFullscreen() {
  const mode = getMathPixConvertMode();
  mode.toggleFullscreen();
}

// ----------------------------------------------------------------------------
// Phase 6.3: Original Functions
// ----------------------------------------------------------------------------

/**
 * Load content from convert mode input
 * Called by Load Content button onclick
 */
function loadConvertModeContent() {
  const mode = getMathPixConvertMode();
  mode.loadContent();
}

/**
 * Clear selected file in convert mode
 * Called by Remove button onclick
 */
function clearConvertModeFile() {
  const mode = getMathPixConvertMode();
  mode.clearFile();
}

/**
 * Switch preview mode
 * Called by preview toggle buttons onclick
 * @param {string} previewMode - 'code' or 'rendered'
 */
function switchConvertPreviewMode(previewMode) {
  const mode = getMathPixConvertMode();
  mode.switchPreviewMode(previewMode);
}

/**
 * Toggle select all formats
 * @param {HTMLInputElement} checkbox
 */
function toggleConvertModeSelectAll(checkbox) {
  const mode = getMathPixConvertMode();
  mode.toggleSelectAll(checkbox);
}

/**
 * Update select all state based on individual checkboxes
 */
function updateConvertModeSelectAll() {
  const mode = getMathPixConvertMode();
  mode.updateSelectAllState();
}

/**
 * Start conversion
 */
function startConvertModeConversion() {
  const mode = getMathPixConvertMode();
  mode.startConversion();
}

/**
 * Cancel conversion
 */
function cancelConvertModeConversion() {
  const mode = getMathPixConvertMode();
  mode.cancelConversion();
}

/**
 * Download all converted files as ZIP
 */
function downloadAllConvertModeFiles() {
  const mode = getMathPixConvertMode();
  mode.downloadAllAsZip();
}

/**
 * Reset convert mode to initial state
 * Called by Clear & Start Over button onclick
 */
function resetConvertMode() {
  const mode = getMathPixConvertMode();
  mode.reset();
}

/**
 * Copy source MMD content to clipboard
 * Called by Copy button onclick in split view
 */
function copyConvertModeSource() {
  const mode = getMathPixConvertMode();
  mode.copySourceToClipboard();
}

// ============================================================================
// Quick Validation Functions
// ============================================================================

/**
 * Quick validation for Phase 6.3
 * @returns {Object} Validation results
 */
function validatePhase63() {
  console.log("=".repeat(60));
  console.log("Phase 6.3: Standalone Convert Mode Validation");
  console.log("=".repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  function test(name, condition) {
    const status = condition ? "✓" : "✗";
    console.log(`${status} ${name}`);
    results.tests.push({ name, passed: condition });
    if (condition) {
      results.passed++;
    } else {
      results.failed++;
    }
  }

  // Test class availability
  test(
    "MathPixConvertMode class exists",
    typeof MathPixConvertMode === "function"
  );
  test(
    "getMathPixConvertMode function exists",
    typeof getMathPixConvertMode === "function"
  );

  // Test singleton
  const mode = getMathPixConvertMode();
  test("Singleton instance created", mode instanceof MathPixConvertMode);

  // Test initialisation
  const initResult = mode.init();
  test("Initialisation successful", initResult === true);

  // Test DOM elements
  test("Container element found", !!mode.elements.container);
  test("Textarea element found", !!mode.elements.textarea);
  test("Load button found", !!mode.elements.loadButton);
  test("Preview section found", !!mode.elements.previewSection);

  // Test global functions
  test(
    "loadConvertModeContent exists",
    typeof loadConvertModeContent === "function"
  );
  test(
    "clearConvertModeFile exists",
    typeof clearConvertModeFile === "function"
  );
  test(
    "switchConvertPreviewMode exists",
    typeof switchConvertPreviewMode === "function"
  );

  // Test integration points
  test(
    "getMathPixConvertUI available",
    typeof window.getMathPixConvertUI === "function"
  );

  // Summary
  console.log("-".repeat(60));
  console.log(
    `Results: ${results.passed}/${results.passed + results.failed} tests passed`
  );
  console.log("=".repeat(60));

  return results;
}

/**
 * Quick validation for Phase 6.4 Editor Integration
 * @returns {Object} Validation results
 */
function validatePhase64() {
  console.log("=".repeat(60));
  console.log("Phase 6.4: Editor Integration Validation");
  console.log("=".repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  function test(name, condition) {
    const status = condition ? "✓" : "✗";
    console.log(`${status} ${name}`);
    results.tests.push({ name, passed: condition });
    if (condition) {
      results.passed++;
    } else {
      results.failed++;
    }
  }

  const mode = getMathPixConvertMode();
  mode.init();

  // Test Phase 6.4 state properties
  console.log("\n--- State Properties ---");
  test("isEditMode property exists", typeof mode.isEditMode === "boolean");
  test("undoStack property exists", Array.isArray(mode.undoStack));
  test("redoStack property exists", Array.isArray(mode.redoStack));
  test("maxUndoLevels property exists", typeof mode.maxUndoLevels === "number");
  test(
    "previewDebounceDelay property exists",
    typeof mode.previewDebounceDelay === "number"
  );

  // Test Phase 6.4 DOM elements
  console.log("\n--- DOM Elements ---");
  test("Editor toolbar element cached", !!mode.elements.editorToolbar);
  test("Edit button element cached", !!mode.elements.editBtn);
  test("Undo button element cached", !!mode.elements.undoBtn);
  test("Redo button element cached", !!mode.elements.redoBtn);
  test("Download MMD button cached", !!mode.elements.downloadMmdBtn);
  test("Upload MMD input cached", !!mode.elements.uploadMmdInput);
  test("Edit overlay element cached", !!mode.elements.editOverlay);
  test("Edit textarea element cached", !!mode.elements.editTextarea);

  // Test Phase 6.4 methods
  console.log("\n--- Class Methods ---");
  test(
    "toggleEditMode method exists",
    typeof mode.toggleEditMode === "function"
  );
  test("enterEditMode method exists", typeof mode.enterEditMode === "function");
  test("exitEditMode method exists", typeof mode.exitEditMode === "function");
  test("undo method exists", typeof mode.undo === "function");
  test("redo method exists", typeof mode.redo === "function");
  test("pushUndoState method exists", typeof mode.pushUndoState === "function");
  test(
    "updateUndoRedoButtons method exists",
    typeof mode.updateUndoRedoButtons === "function"
  );
  test("downloadMMD method exists", typeof mode.downloadMMD === "function");
  test(
    "handleMMDUpload method exists",
    typeof mode.handleMMDUpload === "function"
  );
  test(
    "showEditorToolbar method exists",
    typeof mode.showEditorToolbar === "function"
  );
  test(
    "hideEditorToolbar method exists",
    typeof mode.hideEditorToolbar === "function"
  );

  // Test Phase 6.4 global functions
  console.log("\n--- Global Functions ---");
  test(
    "toggleConvertModeEdit exists",
    typeof toggleConvertModeEdit === "function"
  );
  test("undoConvertModeEdit exists", typeof undoConvertModeEdit === "function");
  test("redoConvertModeEdit exists", typeof redoConvertModeEdit === "function");
  test(
    "downloadConvertModeMMD exists",
    typeof downloadConvertModeMMD === "function"
  );
  test(
    "handleConvertModeMMDUpload exists",
    typeof handleConvertModeMMDUpload === "function"
  );

  // Summary
  console.log("\n" + "-".repeat(60));
  console.log(
    `Results: ${results.passed}/${results.passed + results.failed} tests passed`
  );
  console.log("=".repeat(60));

  return results;
}

// ============================================================================
// Global Exposure for Console Testing
// ============================================================================

window.MathPixConvertMode = MathPixConvertMode;
window.getMathPixConvertMode = getMathPixConvertMode;
window.loadConvertModeContent = loadConvertModeContent;
window.clearConvertModeFile = clearConvertModeFile;
window.switchConvertPreviewMode = switchConvertPreviewMode;
window.toggleConvertModeSelectAll = toggleConvertModeSelectAll;
window.updateConvertModeSelectAll = updateConvertModeSelectAll;
window.startConvertModeConversion = startConvertModeConversion;
window.cancelConvertModeConversion = cancelConvertModeConversion;
window.downloadAllConvertModeFiles = downloadAllConvertModeFiles;
window.resetConvertMode = resetConvertMode;
window.copyConvertModeSource = copyConvertModeSource;
window.validatePhase63 = validatePhase63;

// Phase 6.4: Editor toolbar global functions
window.toggleConvertModeEdit = toggleConvertModeEdit;
window.undoConvertModeEdit = undoConvertModeEdit;
window.redoConvertModeEdit = redoConvertModeEdit;
window.downloadConvertModeMMD = downloadConvertModeMMD;
window.handleConvertModeMMDUpload = handleConvertModeMMDUpload;
window.validatePhase64 = validatePhase64;
window.toggleConvertModeFullscreen = toggleConvertModeFullscreen;

// ============================================================================
// Export (ES6 Module Support)
// ============================================================================

export { MathPixConvertMode, getMathPixConvertMode };
export default MathPixConvertMode;
