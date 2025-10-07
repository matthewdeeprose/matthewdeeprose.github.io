/**
 * MathPix PDF Preview - Upload Verification Module
 * Phase 3.4.1 - Shows PDF preview on file selection for verification
 *
 * Purpose: Display first page of PDF immediately after file selection,
 * allowing users to verify correct file before processing begins.
 */

// Logging configuration
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

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
    console.error(`[PDFUploadVerification] ${message}`, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[PDFUploadVerification] ${message}`, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[PDFUploadVerification] ${message}`, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[PDFUploadVerification] ${message}`, ...args);
}

/**
 * PDFUploadVerification Class
 * Handles the upload preview workflow
 */
export class PDFUploadVerification {
  constructor() {
    this.uploadPreviewCanvas = null;
    this.pdfFile = null;
    this.pdfDocument = null;
    this.confirmCallback = null;
    this.cancelCallback = null;

    // Element cache
    this.elements = {
      container: null,
      canvas: null,
      filename: null,
      pages: null,
      size: null,
      confirmButton: null,
      cancelButton: null,
    };

    logInfo("PDFUploadVerification initialised");
  }

  /**
   * Initialise and cache DOM elements
   */
  initialiseElements() {
    this.elements.container = document.getElementById("mathpix-upload-preview");
    this.elements.canvas = document.getElementById("upload-preview-canvas");
    this.elements.filename = document.getElementById("upload-preview-filename");
    this.elements.pages = document.getElementById("upload-preview-pages");
    this.elements.size = document.getElementById("upload-preview-size");
    this.elements.confirmButton = document.getElementById(
      "upload-preview-confirm"
    );
    this.elements.cancelButton = document.getElementById(
      "upload-preview-cancel"
    );

    const allPresent = Object.values(this.elements).every((el) => el !== null);

    if (!allPresent) {
      logError("Failed to find all required DOM elements", this.elements);
      return false;
    }

    logDebug("All DOM elements cached successfully");
    return true;
  }

  /**
   * Show upload preview for a selected PDF file
   * @param {File} file - The PDF file to preview
   * @param {Function} onConfirm - Callback when user confirms
   * @param {Function} onCancel - Callback when user cancels
   * @returns {Promise<boolean>} Success status
   */
  async showUploadPreview(file, onConfirm, onCancel) {
    logInfo("Showing upload preview for file", file.name);

    // Store file and callbacks
    this.pdfFile = file;
    this.confirmCallback = onConfirm;
    this.cancelCallback = onCancel;

    // Initialise elements if not already done
    if (!this.elements.container) {
      if (!this.initialiseElements()) {
        logError("Cannot show preview: elements not found");
        return false;
      }
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      logWarn("File is not a PDF", file.type);
      if (window.notifyWarning) {
        window.notifyWarning(
          "Selected file is not a PDF. Please select a PDF file."
        );
      }
      return false;
    }

    // Display file information immediately
    this.displayFileInfo(file);

    // Show container
    this.elements.container.hidden = false;

    // Load and render first page
    try {
      await this.loadAndRenderFirstPage(file);

      // Set up confirmation handlers
      this.setupConfirmationHandlers();

      logInfo("Upload preview displayed successfully");
      return true;
    } catch (error) {
      logError("Upload preview failed", error);

      if (window.notifyError) {
        window.notifyError(
          "Failed to preview PDF. You can still proceed with processing."
        );
      }

      // Hide preview on error
      this.hide();
      return false;
    }
  }

  /**
   * Display file information
   * @param {File} file - The PDF file
   */
  displayFileInfo(file) {
    this.elements.filename.textContent = file.name;
    this.elements.size.textContent = this.formatFileSize(file.size);
    this.elements.pages.textContent = "Detecting...";

    logDebug("File info displayed", {
      name: file.name,
      size: this.formatFileSize(file.size),
    });
  }

  /**
   * Load PDF and render first page
   * @param {File} file - The PDF file
   */
  async loadAndRenderFirstPage(file) {
    logInfo("Loading PDF for preview");

    // Check if PDF.js is available
    if (typeof pdfjsLib === "undefined") {
      throw new Error("PDF.js library not loaded");
    }

    // Set PDF.js worker path
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer();

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    this.pdfDocument = await loadingTask.promise;

    logInfo("PDF loaded", {
      pages: this.pdfDocument.numPages,
    });

    // Update page count
    const pageText = this.pdfDocument.numPages === 1 ? "page" : "pages";
    this.elements.pages.textContent = `${this.pdfDocument.numPages} ${pageText}`;

    // Render first page
    await this.renderFirstPage();
  }

  /**
   * Render the first page of the PDF
   */
  async renderFirstPage() {
    logDebug("Rendering first page");

    try {
      // Get first page
      const page = await this.pdfDocument.getPage(1);

      // Calculate scale to fit canvas
      const scale = 1.0;
      const viewport = page.getViewport({ scale });

      // Set canvas dimensions
      const canvas = this.elements.canvas;
      const context = canvas.getContext("2d");

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Render page
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      logInfo("First page rendered successfully");

      // Announce to screen readers
      if (window.mathpixAccessibility) {
        window.mathpixAccessibility.announceUploadVerification(
          this.pdfFile.name,
          this.pdfDocument.numPages
        );
      }
    } catch (error) {
      logError("Failed to render first page", error);
      throw error;
    }
  }

  /**
   * Set up confirmation button handlers
   */
  setupConfirmationHandlers() {
    // Remove old listeners if any
    const newConfirmButton = this.elements.confirmButton.cloneNode(true);
    const newCancelButton = this.elements.cancelButton.cloneNode(true);

    this.elements.confirmButton.parentNode.replaceChild(
      newConfirmButton,
      this.elements.confirmButton
    );
    this.elements.cancelButton.parentNode.replaceChild(
      newCancelButton,
      this.elements.cancelButton
    );

    this.elements.confirmButton = newConfirmButton;
    this.elements.cancelButton = newCancelButton;

    // Add new listeners
    this.elements.confirmButton.addEventListener("click", () => {
      this.handleConfirm();
    });

    this.elements.cancelButton.addEventListener("click", () => {
      this.handleCancel();
    });

    logDebug("Confirmation handlers set up");
  }

  /**
   * Handle user confirmation
   */
  handleConfirm() {
    logInfo("User confirmed upload");

    // Hide preview
    this.hide();

    // Call confirmation callback
    if (this.confirmCallback && typeof this.confirmCallback === "function") {
      this.confirmCallback(this.pdfFile);
    }
  }

  /**
   * Handle user cancellation
   */
  handleCancel() {
    logInfo("User cancelled upload");

    // Hide preview
    this.hide();

    // Call cancellation callback
    if (this.cancelCallback && typeof this.cancelCallback === "function") {
      this.cancelCallback();
    }

    // Show cancellation notification
    if (window.notifyInfo) {
      window.notifyInfo("Upload cancelled");
    }

    // Clean up
    this.cleanup();
  }

  /**
   * Hide the upload preview
   */
  hide() {
    if (this.elements.container) {
      this.elements.container.hidden = true;
      logDebug("Upload preview hidden");
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.pdfFile = null;
    this.confirmCallback = null;
    this.cancelCallback = null;

    if (this.pdfDocument) {
      this.pdfDocument.destroy();
      this.pdfDocument = null;
    }

    // Clear canvas
    if (this.elements.canvas) {
      const context = this.elements.canvas.getContext("2d");
      context.clearRect(
        0,
        0,
        this.elements.canvas.width,
        this.elements.canvas.height
      );
    }

    // Reset file info
    if (this.elements.filename) this.elements.filename.textContent = "";
    if (this.elements.pages) this.elements.pages.textContent = "";
    if (this.elements.size) this.elements.size.textContent = "";

    logDebug("Upload verification cleaned up");
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1048576) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / 1048576).toFixed(1)} MB`;
    }
  }
}

// Export for testing
if (typeof window !== "undefined") {
  window.PDFUploadVerification = PDFUploadVerification;
}
