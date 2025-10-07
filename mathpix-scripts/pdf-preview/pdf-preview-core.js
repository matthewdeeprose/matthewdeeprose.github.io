/**
 * PDF Preview Core Module - Phase 3.4.2
 * Handles PDF loading, page rendering, and zoom management for Lines API overlay system
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
    console.error(`[PDFPreviewCore] ${message}`, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn(`[PDFPreviewCore] ${message}`, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log(`[PDFPreviewCore] ${message}`, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log(`[PDFPreviewCore] ${message}`, ...args);
}

/**
 * PDFPreviewCore - Manages PDF document loading and page rendering
 */
export class PDFPreviewCore {
  constructor() {
    this.pdfDocument = null;
    this.currentPageNumber = 1;
    this.currentScale = 1.5;
    this.totalPages = 0;
    this.isLoading = false;
    this.currentRenderTask = null;

    // Zoom constraints
    this.minScale = 0.5;
    this.maxScale = 3.0;
    this.scaleStep = 0.25;

    // Element references
    this.elements = {
      canvas: null,
      container: null,
    };

    logInfo("PDFPreviewCore initialised");
  }

  /**
   * Initialise DOM element references
   * @returns {boolean} Success status
   */
  initialiseElements() {
    this.elements.canvas = document.getElementById("pdf-preview-canvas");
    this.elements.container = document.getElementById(
      "mathpix-pdf-preview-container"
    );

    const allPresent = Object.values(this.elements).every((el) => el !== null);

    if (!allPresent) {
      logError("Failed to find required elements", {
        canvas: !!this.elements.canvas,
        container: !!this.elements.container,
      });
      return false;
    }

    logInfo("Elements initialised successfully");
    return true;
  }

  /**
   * Load PDF document from URL
   * @param {string} pdfUrl - URL to PDF document
   * @returns {Promise<boolean>} Success status
   */
  async loadPDF(pdfUrl) {
    if (this.isLoading) {
      logWarn("PDF load already in progress");
      return false;
    }

    if (!pdfUrl) {
      logError("No PDF URL provided");
      if (window.notifyError) {
        window.notifyError("No PDF URL provided");
      }
      return false;
    }

    try {
      this.isLoading = true;
      logInfo("Loading PDF from URL:", pdfUrl);

      // Show loading notification
      if (window.notifyInfo) {
        window.notifyInfo("Loading PDF preview...");
      }

      // Check PDF.js is available
      if (typeof pdfjsLib === "undefined") {
        throw new Error("PDF.js library not loaded");
      }

      // Load PDF document
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      this.pdfDocument = await loadingTask.promise;
      this.totalPages = this.pdfDocument.numPages;

      logInfo(`PDF loaded successfully: ${this.totalPages} pages`);

      // Show success notification
      if (window.notifySuccess) {
        window.notifySuccess(`PDF loaded: ${this.totalPages} pages`);
      }

      return true;
    } catch (error) {
      logError("Failed to load PDF:", error);
      if (window.notifyError) {
        window.notifyError(`Failed to load PDF: ${error.message}`);
      }
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Render specific page to canvas
   * @param {number} pageNumber - Page number to render (1-indexed)
   * @returns {Promise<boolean>} Success status
   */
  async renderPage(pageNumber) {
    if (!this.pdfDocument) {
      logError("No PDF document loaded");
      return false;
    }

    if (pageNumber < 1 || pageNumber > this.totalPages) {
      logError(
        `Invalid page number: ${pageNumber} (total: ${this.totalPages})`
      );
      return false;
    }

    if (!this.elements.canvas) {
      if (!this.initialiseElements()) {
        return false;
      }
    }

    try {
      // Cancel any existing render task before starting new one
      if (this.currentRenderTask) {
        try {
          await this.currentRenderTask.cancel();
          logDebug("Previous render task cancelled");
        } catch (cancelError) {
          // Ignore cancellation errors
        }
        this.currentRenderTask = null;
      }

      logDebug(`Rendering page ${pageNumber} at scale ${this.currentScale}`);

      // Get the page
      const page = await this.pdfDocument.getPage(pageNumber);

      // Calculate viewport at current scale
      const viewport = page.getViewport({ scale: this.currentScale });

      // Set canvas dimensions
      const canvas = this.elements.canvas;
      const context = canvas.getContext("2d");

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Render page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      // Store render task so it can be cancelled if needed
      this.currentRenderTask = page.render(renderContext);
      await this.currentRenderTask.promise;
      this.currentRenderTask = null;

      this.currentPageNumber = pageNumber;
      logInfo(`Page ${pageNumber} rendered successfully`);

      return true;
    } catch (error) {
      logError(`Failed to render page ${pageNumber}:`, error);
      if (window.notifyError) {
        window.notifyError(`Failed to render page: ${error.message}`);
      }
      return false;
    }
  }

  /**
   * Set zoom level
   * @param {number} scale - New scale factor
   * @returns {boolean} Success status
   */
  setZoom(scale) {
    const newScale = Math.max(this.minScale, Math.min(this.maxScale, scale));

    if (newScale !== this.currentScale) {
      logInfo(`Zoom changed: ${this.currentScale} → ${newScale}`);
      this.currentScale = newScale;
      return true;
    }

    return false;
  }

  /**
   * Zoom in by one step
   * @returns {Promise<boolean>} Success status
   */
  async zoomIn() {
    const newScale = Math.min(
      this.maxScale,
      this.currentScale + this.scaleStep
    );

    if (newScale !== this.currentScale) {
      this.setZoom(newScale);
      return await this.renderPage(this.currentPageNumber);
    }

    logWarn("Already at maximum zoom");
    return false;
  }

  /**
   * Zoom out by one step
   * @returns {Promise<boolean>} Success status
   */
  async zoomOut() {
    const newScale = Math.max(
      this.minScale,
      this.currentScale - this.scaleStep
    );

    if (newScale !== this.currentScale) {
      this.setZoom(newScale);
      return await this.renderPage(this.currentPageNumber);
    }

    logWarn("Already at minimum zoom");
    return false;
  }

  /**
   * Get current page number
   * @returns {number} Current page number
   */
  getCurrentPage() {
    return this.currentPageNumber;
  }

  /**
   * Get total number of pages
   * @returns {number} Total pages
   */
  getTotalPages() {
    return this.totalPages;
  }

  /**
   * Get current zoom scale
   * @returns {number} Current scale factor
   */
  getCurrentScale() {
    return this.currentScale;
  }

  /**
   * Get canvas element
   * @returns {HTMLCanvasElement|null} Canvas element
   */
  getCanvas() {
    return this.elements.canvas;
  }

  /**
   * Check if PDF is loaded
   * @returns {boolean} Load status
   */
  isLoaded() {
    return this.pdfDocument !== null;
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Cancel any pending render task
    if (this.currentRenderTask) {
      try {
        this.currentRenderTask.cancel();
      } catch (error) {
        // Ignore cancellation errors
      }
      this.currentRenderTask = null;
    }

    if (this.pdfDocument) {
      this.pdfDocument.destroy();
      this.pdfDocument = null;
    }

    this.currentPageNumber = 1;
    this.totalPages = 0;

    logInfo("PDFPreviewCore destroyed");
  }
}

// Global exposure for testing
if (typeof window !== "undefined") {
  window.PDFPreviewCore = PDFPreviewCore;
}
