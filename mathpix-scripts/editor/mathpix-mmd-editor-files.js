/**
 * @fileoverview MathPix MMD Editor - File Operations Module (Phase 5.3)
 * @module MMDEditorFiles
 * @requires mathpix-mmd-editor-core.js
 * @requires mathpix-mmd-editor-persistence.js
 * @version 1.0.0
 * @since 5.3.0
 *
 * @description
 * Provides file download and upload functionality for the MMD Editor.
 * Integrates with persistence module for undo support and session management.
 *
 * Features:
 * - Download current MMD as timestamped .mmd file
 * - Load MMD from .mmd/.md/.txt files
 * - Unsaved changes confirmation before load
 * - Undo support for file loads (current content pushed to undo stack)
 * - Original MathPix MMD preserved (Restore Original still works)
 * - WCAG 2.2 AA compliant with screen reader announcements
 *
 * @example
 * // Download current content
 * downloadEditedMMD();
 *
 * // Load file via input
 * handleMMDFileUpload(fileInput.files);
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
    console.error("[MMD Files]", message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN)) console.warn("[MMD Files]", message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO)) console.log("[MMD Files]", message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[MMD Files]", message, ...args);
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * @constant {Object} FILES_CONFIG
 * @description Configuration for the MMD Files module
 */
const FILES_CONFIG = {
  VALID_EXTENSIONS: [".mmd", ".md", ".txt"],
  MIME_TYPE: "text/markdown",
  DEFAULT_BASENAME: "mathpix-export",
  MESSAGES: {
    DOWNLOAD_SUCCESS: "File downloaded successfully",
    UPLOAD_SUCCESS: "File loaded successfully",
    INVALID_TYPE: "Invalid file type. Please select a .mmd, .md, or .txt file.",
    READ_ERROR: "Failed to read file. Please try again.",
    NO_CONTENT: "No content available to download.",
    UNSAVED_CONFIRM:
      "You have unsaved changes. Loading a new file will add your current content to undo history. Continue?",
    NO_EDITOR: "Editor not available.",
  },
};

// ============================================================================
// MMDEditorFiles Class
// ============================================================================

/**
 * @class MMDEditorFiles
 * @description Handles file download and upload for MMD Editor
 */
class MMDEditorFiles {
  /**
   * Create a new MMDEditorFiles instance
   */
  constructor() {
    // DOM element references
    this.elements = {};
    this.elementsCached = false;

    // Initialisation flag
    this.isInitialised = false;

    logInfo("MMDEditorFiles instance created");
  }

  // ==========================================================================
  // Initialisation Methods
  // ==========================================================================

  /**
   * Initialise the files module
   * @returns {boolean} True if initialisation successful
   */
  init() {
    if (this.isInitialised) {
      logDebug("Already initialised, skipping");
      return true;
    }

    logInfo("Initialising MMD Files...");

    // Cache DOM elements
    this.cacheElements();

    this.isInitialised = true;
    logInfo("MMD Files initialised successfully");

    return true;
  }

  /**
   * Cache DOM element references for performance
   * @private
   */
  cacheElements() {
    this.elements = {
      // File controls container
      fileControls: document.getElementById("mmd-file-controls"),

      // Buttons/inputs
      downloadBtn: document.getElementById("mmd-download-btn"),
      uploadLabel: document.getElementById("mmd-upload-label"),
      uploadInput: document.getElementById("mmd-upload-input"),

      // Help text
      uploadHelp: document.getElementById("mmd-upload-help"),
    };

    // Validate critical elements
    const critical = ["fileControls", "downloadBtn", "uploadInput"];
    const missing = critical.filter((key) => !this.elements[key]);

    if (missing.length > 0) {
      logWarn("Missing critical file elements", { missing });
    }

    this.elementsCached = true;
    logDebug("File elements cached", {
      cached: Object.keys(this.elements).filter((k) => !!this.elements[k])
        .length,
      total: Object.keys(this.elements).length,
    });
  }

  // ==========================================================================
  // File Controls Visibility
  // ==========================================================================

  /**
   * Show file controls
   */
  showFileControls() {
    const { fileControls } = this.elements;
    if (fileControls) {
      fileControls.hidden = false;
      logDebug("File controls shown");
    }
  }

  /**
   * Hide file controls
   */
  hideFileControls() {
    const { fileControls } = this.elements;
    if (fileControls) {
      fileControls.hidden = true;
      logDebug("File controls hidden");
    }
  }

  // ==========================================================================
  // Download Functionality
  // ==========================================================================

  /**
   * Generate download filename based on source file and current date/time
   * Format: [original-pdf-name]-[YYYY-MM-DD]-[HH-MM].mmd
   * @returns {string} Formatted filename
   */
  generateDownloadFilename() {
    // Get base name from source file via persistence module
    let baseName = FILES_CONFIG.DEFAULT_BASENAME;

    const persistence = window.getMathPixMMDPersistence?.();
    const sessionInfo = persistence?.getSessionInfo?.();

    if (sessionInfo?.fileName) {
      // Remove .pdf extension if present
      baseName = sessionInfo.fileName.replace(/\.pdf$/i, "");
      // Sanitise filename (remove problematic characters)
      baseName = baseName.replace(/[<>:"/\\|?*]/g, "-");
    }

    // Format date: YYYY-MM-DD
    const now = new Date();
    const date = now.toISOString().split("T")[0];

    // Format time: HH-MM (replace colon with hyphen)
    const time = now.toTimeString().slice(0, 5).replace(":", "-");

    const filename = `${baseName}-${date}-${time}.mmd`;

    logDebug("Generated filename", { baseName, date, time, filename });

    return filename;
  }

  /**
   * Download content as a file
   * @param {string} content - Content to download
   * @param {string} filename - Filename for download
   * @param {string} mimeType - MIME type
   */
  downloadAsFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up object URL
    URL.revokeObjectURL(url);

    logDebug("File download initiated", { filename, mimeType });
  }

  /**
   * Download current MMD content as a file
   * @returns {boolean} True if download initiated successfully
   */
  async downloadEditedMMD() {
    const editor = window.getMathPixMMDEditor?.();
    const content = editor?.getContent?.();

    if (!content) {
      this.showNotification(FILES_CONFIG.MESSAGES.NO_CONTENT, "error");
      logWarn("No content to download");
      return false;
    }

    const filename = this.generateDownloadFilename();

    try {
      this.downloadAsFile(content, filename, FILES_CONFIG.MIME_TYPE);
      this.showNotification(`Downloaded as ${filename}`, "success");
      this.announceToScreenReader(`File downloaded as ${filename}`);
      logInfo("Download successful", {
        filename,
        contentLength: content.length,
      });
      return true;
    } catch (error) {
      logError("Download failed:", error);
      this.showNotification("Download failed. Please try again.", "error");
      return false;
    }
  }

  // ==========================================================================
  // Upload Functionality
  // ==========================================================================

  /**
   * Validate file is an acceptable MMD file
   * @param {File} file - File to validate
   * @returns {boolean} True if valid
   */
  isValidMMDFile(file) {
    if (!file || !file.name) return false;

    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    const isValid = FILES_CONFIG.VALID_EXTENSIONS.includes(extension);

    logDebug("File validation", { filename: file.name, extension, isValid });

    return isValid;
  }

  /**
   * Read file as text
   * @param {File} file - File to read
   * @returns {Promise<string>} File content
   */
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  /**
   * Handle file upload from input
   * @param {FileList} files - Selected files
   * @returns {Promise<boolean>} True if file loaded successfully
   */
  async handleMMDFileUpload(files) {
    if (!files || files.length === 0) {
      logDebug("No files selected");
      return false;
    }

    const file = files[0];
    logInfo("File upload started", { filename: file.name, size: file.size });

    // Validate file type
    if (!this.isValidMMDFile(file)) {
      this.showNotification(FILES_CONFIG.MESSAGES.INVALID_TYPE, "error");
      this.resetUploadInput();
      return false;
    }

    // Check for unsaved changes
    const persistence = window.getMathPixMMDPersistence?.();
    if (persistence?.hasUnsavedChanges?.()) {
      const confirmed = await this.confirmAction(
        FILES_CONFIG.MESSAGES.UNSAVED_CONFIRM,
        "Load File"
      );

      if (!confirmed) {
        logDebug("File load cancelled by user");
        this.resetUploadInput();
        return false;
      }
    }

    // Read and load file
    try {
      const content = await this.readFileAsText(file);
      this.loadMMDContent(content, file.name);
      this.showNotification(`Loaded ${file.name}`, "success");
      this.announceToScreenReader(`File ${file.name} loaded successfully`);
      logInfo("File loaded successfully", {
        filename: file.name,
        contentLength: content.length,
      });
      return true;
    } catch (error) {
      logError("File read failed:", error);
      this.showNotification(FILES_CONFIG.MESSAGES.READ_ERROR, "error");
      return false;
    } finally {
      // Always reset input so same file can be selected again
      this.resetUploadInput();
    }
  }

  /**
   * Load MMD content into editor, preserving undo history
   * @param {string} content - MMD content to load
   * @param {string} [sourceFileName] - Name of loaded file (for logging)
   */
  loadMMDContent(content, sourceFileName = "uploaded file") {
    const editor = window.getMathPixMMDEditor?.();
    const persistence = window.getMathPixMMDPersistence?.();

    if (!editor) {
      logError("Editor not available");
      this.showNotification(FILES_CONFIG.MESSAGES.NO_EDITOR, "error");
      return;
    }

    // If persistence exists and has session, integrate with undo system
    if (persistence?.hasSession?.()) {
      // handleContentChange will push current to undo stack
      persistence.handleContentChange(content);

      // Force immediate save (bypass debounce) to ensure undo stack is correct
      if (typeof persistence.saveContent === "function") {
        persistence.saveContent(content);
      }
    }

    // Update editor display
    editor.setContent(content);

    logInfo(`Loaded content from ${sourceFileName}`, {
      contentLength: content.length,
    });
  }

  /**
   * Reset the upload input so the same file can be selected again
   * @private
   */
  resetUploadInput() {
    const { uploadInput } = this.elements;
    if (uploadInput) {
      uploadInput.value = "";
    }
  }

  // ==========================================================================
  // Keyboard Handler for Upload Label
  // ==========================================================================

  /**
   * Handle keyboard activation of upload label
   * @param {KeyboardEvent} event - Keyboard event
   */
  handleUploadLabelKeydown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const { uploadInput } = this.elements;
      if (uploadInput) {
        uploadInput.click();
        logDebug("Upload input triggered via keyboard");
      }
    }
  }

  // ==========================================================================
  // Notifications & Accessibility
  // ==========================================================================

  /**
   * Show notification to user
   * @param {string} message - Message to show
   * @param {string} type - 'success', 'error', 'info', 'warning'
   */
  showNotification(message, type) {
    // Use universal notification system if available
    if (type === "success" && typeof window.notifySuccess === "function") {
      window.notifySuccess(message);
      return;
    }
    if (type === "error" && typeof window.notifyError === "function") {
      window.notifyError(message);
      return;
    }
    if (type === "warning" && typeof window.notifyWarning === "function") {
      window.notifyWarning(message);
      return;
    }
    if (type === "info" && typeof window.notifyInfo === "function") {
      window.notifyInfo(message);
      return;
    }

    // Fallback to console
    const logMethod = type === "error" ? console.error : console.log;
    logMethod(`[MMD Files] ${message}`);
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   */
  announceToScreenReader(message) {
    // Use persistence module's announcer if available
    const persistence = window.getMathPixMMDPersistence?.();
    if (persistence?.announceStatus) {
      persistence.announceStatus(message);
      return;
    }

    // Fallback: use the session SR status element
    const srStatus = document.getElementById("mmd-session-sr-status");
    if (srStatus) {
      srStatus.textContent = message;
      setTimeout(() => {
        srStatus.textContent = "";
      }, 1000);
    }

    logDebug("Screen reader announcement:", message);
  }

  /**
   * Confirm action with user
   * @param {string} message - Confirmation message
   * @param {string} [title] - Dialog title
   * @returns {Promise<boolean>} True if confirmed
   */
  async confirmAction(message, title = "Confirm") {
    // Use safeConfirm if available (from universal-modal.js)
    if (typeof window.safeConfirm === "function") {
      return await window.safeConfirm(message, title);
    }

    // Fallback to native confirm
    return window.confirm(message);
  }

  // ==========================================================================
  // State Query Methods
  // ==========================================================================

  /**
   * Check if file controls are visible
   * @returns {boolean} True if visible
   */
  areControlsVisible() {
    const { fileControls } = this.elements;
    return fileControls ? !fileControls.hidden : false;
  }

  /**
   * Get module status for debugging
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      isInitialised: this.isInitialised,
      elementsCached: this.elementsCached,
      controlsVisible: this.areControlsVisible(),
      elements: {
        fileControls: !!this.elements.fileControls,
        downloadBtn: !!this.elements.downloadBtn,
        uploadLabel: !!this.elements.uploadLabel,
        uploadInput: !!this.elements.uploadInput,
      },
    };
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Clean up resources
   */
  cleanup() {
    this.elements = {};
    this.elementsCached = false;
    this.isInitialised = false;

    logInfo("MMDEditorFiles cleanup complete");
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let filesInstance = null;

/**
 * Get the singleton MMD Files instance
 * @returns {MMDEditorFiles} The files instance
 */
function getMathPixMMDFiles() {
  if (!filesInstance) {
    filesInstance = new MMDEditorFiles();
  }
  return filesInstance;
}

// ============================================================================
// Global Functions for HTML onclick handlers
// ============================================================================

/**
 * Download current MMD content
 * Called by onclick handler on download button
 */
window.downloadEditedMMD = function () {
  const files = getMathPixMMDFiles();
  if (!files.isInitialised) {
    files.init();
  }
  files.downloadEditedMMD();
};

/**
 * Handle file upload
 * Called by onchange handler on file input
 * @param {FileList} fileList - Selected files
 */
window.handleMMDFileUpload = function (fileList) {
  const files = getMathPixMMDFiles();
  if (!files.isInitialised) {
    files.init();
  }
  files.handleMMDFileUpload(fileList);
};

/**
 * Handle keyboard activation of upload label
 * Called by onkeydown handler on upload label
 * @param {KeyboardEvent} event - Keyboard event
 */
window.handleUploadLabelKeydown = function (event) {
  const files = getMathPixMMDFiles();
  if (!files.isInitialised) {
    files.init();
  }
  files.handleUploadLabelKeydown(event);
};

/**
 * Global accessor for MMD Files instance
 */
window.getMathPixMMDFiles = getMathPixMMDFiles;

// ============================================================================
// Convenience Functions for Integration
// ============================================================================

/**
 * Show file controls
 * Can be called by persistence module when session starts
 */
window.showMMDFileControls = function () {
  const files = getMathPixMMDFiles();
  if (!files.isInitialised) {
    files.init();
  }
  files.showFileControls();
};

/**
 * Hide file controls
 * Can be called by persistence module when session clears
 */
window.hideMMDFileControls = function () {
  const files = getMathPixMMDFiles();
  if (!files.isInitialised) {
    files.init();
  }
  files.hideFileControls();
};

// ============================================================================
// Export
// ============================================================================

export default MMDEditorFiles;
export { getMathPixMMDFiles, FILES_CONFIG };

// ============================================================================
// Auto-initialisation on DOM ready
// ============================================================================

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      logDebug("DOM ready, files module available");
    });
  } else {
    logDebug("DOM already ready, files module available");
  }
}
/* ============================================================================
   RESUME MODE FILE OPERATIONS
   ============================================================================ */

/**
 * Download MMD content from Resume mode editor
 * Uses loaded filename if available, falls back to original source filename
 */
function downloadResumeMMD() {
  const textarea = document.getElementById("resume-mmd-editor-textarea");
  if (!textarea || !textarea.value.trim()) {
    if (typeof notifyWarning === "function") {
      notifyWarning("No MMD content to save.");
    } else {
      alert("No MMD content to save.");
    }
    return;
  }

  const content = textarea.value;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  // Generate filename with timestamp (including seconds for uniqueness)
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("-");

  let filename = `resume-session-${timestamp}.mmd`;

  // Get filename from session restorer - prefer loaded file, fall back to original source
  const restorer = window.getMathPixSessionRestorer?.();
  if (restorer) {
    // First, check if a file was loaded via "Load File" button
    const loadedFilename = restorer.getLoadedSourceFilename?.();
    if (loadedFilename) {
      filename = `${loadedFilename}-${timestamp}.mmd`;
      console.log(
        "[MMD Files] Using loaded filename for save:",
        loadedFilename
      );
    } else if (restorer.restoredSession?.source?.filename) {
      // Fall back to original source filename from ZIP
      const originalName = restorer.restoredSession.source.filename;
      const baseName = originalName.replace(/\.[^/.]+$/, ""); // Remove extension
      filename = `${baseName}-${timestamp}.mmd`;
      console.log(
        "[MMD Files] Using original source filename for save:",
        baseName
      );
    }
  }

  // Create download link and trigger download
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();

    // Clean up after a short delay to ensure download starts
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    // Register this saved version for inclusion in ZIP downloads
    if (restorer?.registerSavedMMDVersion) {
      restorer.registerSavedMMDVersion(filename, content);
    }

    if (typeof notifySuccess === "function") {
      notifySuccess(`Saved as ${filename}`);
    }

    console.log("[MMD Files] Download triggered:", filename);
  } catch (error) {
    console.error("[MMD Files] Download failed:", error);
    if (typeof notifyError === "function") {
      notifyError("Failed to save file: " + error.message);
    } else {
      alert("Failed to save file: " + error.message);
    }
  }
}

/**
 * Handle keyboard navigation for Resume upload label
 */
function handleResumeUploadLabelKeydown(event) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    document.getElementById("resume-mmd-upload-input")?.click();
  }
}

/**
 * Handle MMD file upload in Resume mode
 * Loads file content, updates preview, and registers with session restorer
 * for proper ZIP integration and filename tracking.
 */
function handleResumeMMDFileUpload(files) {
  if (!files || files.length === 0) return;

  const file = files[0];
  const validExtensions = [".mmd", ".md", ".txt"];
  const ext = "." + file.name.split(".").pop().toLowerCase();

  if (!validExtensions.includes(ext)) {
    if (typeof notifyError === "function") {
      notifyError("Please select a .mmd, .md, or .txt file.");
    } else {
      alert("Please select a .mmd, .md, or .txt file.");
    }
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const content = e.target.result;
    const textarea = document.getElementById("resume-mmd-editor-textarea");

    if (textarea) {
      textarea.value = content;

      // Trigger input event to update any listeners
      textarea.dispatchEvent(new Event("input", { bubbles: true }));

      // Register the loaded file with session restorer
      // This updates baselines, tracks filename, and enables ZIP integration
      const restorer = window.getMathPixSessionRestorer?.();
      if (restorer?.registerLoadedFile) {
        restorer.registerLoadedFile(file.name, content);
        logInfo("Loaded file registered with session restorer:", file.name);
      }

      // Update preview if available
      if (restorer?.updatePreview) {
        restorer.updatePreview();
      }

      if (typeof notifySuccess === "function") {
        notifySuccess(`Loaded ${file.name} - baseline updated`);
      }
    }
  };

  reader.onerror = function () {
    if (typeof notifyError === "function") {
      notifyError("Failed to read file.");
    } else {
      alert("Failed to read file.");
    }
  };

  reader.readAsText(file);

  // Reset file input so same file can be selected again
  document.getElementById("resume-mmd-upload-input").value = "";
}

/**
 * Update Resume file controls visibility based on view mode
 */
function updateResumeFileControlsVisibility() {
  const contentArea = document.getElementById("resume-mmd-content-area");
  const fileControls = document.getElementById("resume-mmd-file-controls");

  if (!contentArea || !fileControls) return;

  const currentView = contentArea.getAttribute("data-current-view");
  const showControls = currentView === "code" || currentView === "split";

  if (showControls) {
    fileControls.classList.add("visible");
  } else {
    fileControls.classList.remove("visible");
  }
}

// Expose functions globally
window.downloadResumeMMD = downloadResumeMMD;
window.handleResumeUploadLabelKeydown = handleResumeUploadLabelKeydown;
window.handleResumeMMDFileUpload = handleResumeMMDFileUpload;
window.updateResumeFileControlsVisibility = updateResumeFileControlsVisibility;
