/**
 * @fileoverview PDF Visualiser Renderer - PDF.js Integration
 * @module PDFVisualiserRenderer
 * @requires ./pdf-visualiser-config.js
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Handles PDF.js library loading, PDF document loading, and page rendering.
 * Provides lazy loading of PDF.js from CDN and manages the rendering pipeline
 * for displaying PDF pages in the confidence visualiser.
 *
 * Key Features:
 * - Lazy loading of PDF.js from CDN
 * - PDF document loading from File or URL
 * - Page rendering to canvas with configurable scale
 * - High-DPI display support
 * - Page navigation (prev/next)
 * - Zoom controls
 * - Memory management and cleanup
 *
 * Integration:
 * - Used by pdf-visualiser-core.js for PDF display
 * - Works with pdf-visualiser-overlays.js for confidence overlays
 * - Uses configuration from pdf-visualiser-config.js
 *
 * Rendering Pipeline:
 * loadPDFJS() → loadDocument() → renderPage() → Canvas Display
 *
 * Accessibility:
 * - Provides viewport information for overlay positioning
 * - Supports screen reader announcements for page changes
 */

// =============================================================================
// LOGGING CONFIGURATION
// =============================================================================

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
    console.error("[PDFVisualiserRenderer]", message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn("[PDFVisualiserRenderer]", message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log("[PDFVisualiserRenderer]", message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log("[PDFVisualiserRenderer]", message, ...args);
}

// =============================================================================
// IMPORTS
// =============================================================================

import PDF_VISUALISER_CONFIG, {
  formatAriaMessage,
} from "./pdf-visualiser-config.js";

// =============================================================================
// MAIN CLASS
// =============================================================================

/**
 * @class PDFVisualiserRenderer
 * @description Handles PDF.js library loading and PDF rendering
 *
 * Manages the complete PDF rendering pipeline including library loading,
 * document parsing, page rendering, and cleanup. Designed for integration
 * with the confidence visualiser system.
 *
 * @example
 * const renderer = new PDFVisualiserRenderer();
 * await renderer.loadPDFJS();
 * await renderer.loadDocument(pdfFile);
 * const viewport = await renderer.renderPage(1, canvasElement);
 *
 * @since 1.0.0
 */
class PDFVisualiserRenderer {
  /**
   * @constructor
   * @description Creates a new PDF renderer instance
   *
   * Initialises state for PDF.js library, document, and rendering.
   *
   * @param {Object} [options={}] - Renderer options
   * @param {number} [options.defaultScale=1.5] - Default rendering scale
   * @param {Function} [options.onPageChange] - Callback for page changes
   * @param {Function} [options.onZoomChange] - Callback for zoom changes
   * @param {Function} [options.onLoadProgress] - Callback for load progress
   *
   * @example
   * const renderer = new PDFVisualiserRenderer({
   *   defaultScale: 1.5,
   *   onPageChange: (page, total) => console.log(`Page ${page}/${total}`)
   * });
   *
   * @since 1.0.0
   */
  constructor(options = {}) {
    /**
     * @member {boolean} pdfjsLoaded
     * @description Whether PDF.js library is loaded
     * @private
     */
    this.pdfjsLoaded = false;

    /**
     * @member {Object|null} pdfjsLib
     * @description Reference to PDF.js library
     * @private
     */
    this.pdfjsLib = null;

    /**
     * @member {Object|null} pdfDocument
     * @description Currently loaded PDF document
     * @private
     */
    this.pdfDocument = null;

    /**
     * @member {number} currentPage
     * @description Currently displayed page number (1-indexed)
     */
    this.currentPage = 1;

    /**
     * @member {number} totalPages
     * @description Total number of pages in document
     */
    this.totalPages = 0;

    /**
     * @member {number} currentScale
     * @description Current rendering scale
     */
    this.currentScale =
      options.defaultScale || PDF_VISUALISER_CONFIG.RENDERING.DEFAULT_SCALE;

    /**
     * @member {Object|null} currentViewport
     * @description Viewport of currently rendered page
     */
    this.currentViewport = null;

    /**
     * @member {HTMLCanvasElement|null} pdfCanvas
     * @description Canvas for PDF rendering
     * @private
     */
    this.pdfCanvas = null;

    /**
     * @member {boolean} isRendering
     * @description Whether a render operation is in progress
     * @private
     */
    this.isRendering = false;

    /**
     * @member {Object|null} renderTask
     * @description Current PDF.js render task
     * @private
     */
    this.renderTask = null;

    // Callbacks
    this.onPageChange = options.onPageChange || null;
    this.onZoomChange = options.onZoomChange || null;
    this.onLoadProgress = options.onLoadProgress || null;

    logInfo("PDFVisualiserRenderer initialised", {
      defaultScale: this.currentScale,
    });
  }

  // ===========================================================================
  // PDF.JS LIBRARY LOADING
  // ===========================================================================

  /**
   * @method loadPDFJS
   * @description Lazy loads PDF.js library from CDN
   *
   * Loads PDF.js and its web worker from the CDN configured in
   * PDF_VISUALISER_CONFIG. Only loads once; subsequent calls return immediately.
   *
   * @returns {Promise<void>} Resolves when library is loaded
   * @throws {Error} When library fails to load within timeout
   *
   * @example
   * await renderer.loadPDFJS();
   * console.log('PDF.js loaded:', renderer.pdfjsLoaded);
   *
   * @since 1.0.0
   */
  async loadPDFJS() {
    // Return immediately if already loaded
    if (this.pdfjsLoaded && this.pdfjsLib) {
      logDebug("PDF.js already loaded");
      return;
    }

    // Check if already available globally
    if (typeof window !== "undefined" && window.pdfjsLib) {
      this.pdfjsLib = window.pdfjsLib;
      this.pdfjsLoaded = true;
      logInfo("Using existing PDF.js instance");
      return;
    }

    const config = PDF_VISUALISER_CONFIG.PDFJS;
    logInfo("Loading PDF.js from CDN", { version: config.VERSION });

    try {
      // Load main library
      await this.loadScript(config.LIB_URL, config.LOAD_TIMEOUT);

      // Verify it loaded
      if (typeof window === "undefined" || !window.pdfjsLib) {
        throw new Error("PDF.js library not available after script load");
      }

      this.pdfjsLib = window.pdfjsLib;

      // Configure worker
      this.pdfjsLib.GlobalWorkerOptions.workerSrc = config.WORKER_URL;

      this.pdfjsLoaded = true;

      logInfo("PDF.js loaded successfully", {
        version: this.pdfjsLib.version || config.VERSION,
        workerSrc: config.WORKER_URL,
      });
    } catch (error) {
      logError("Failed to load PDF.js", { error: error.message });
      throw new Error(`Failed to load PDF viewer: ${error.message}`);
    }
  }

  /**
   * @method loadScript
   * @description Dynamically loads a script from URL
   *
   * @param {string} url - Script URL to load
   * @param {number} [timeout=10000] - Load timeout in milliseconds
   * @returns {Promise<void>} Resolves when script is loaded
   *
   * @private
   * @since 1.0.0
   */
  loadScript(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
      // Check if script already exists
      const existing = document.querySelector(`script[src="${url}"]`);
      if (existing) {
        logDebug("Script already in document", { url });
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = url;
      script.async = true;

      const timeoutId = setTimeout(() => {
        reject(new Error(`Script load timeout: ${url}`));
      }, timeout);

      script.onload = () => {
        clearTimeout(timeoutId);
        logDebug("Script loaded", { url });
        resolve();
      };

      script.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to load script: ${url}`));
      };

      document.head.appendChild(script);
    });
  }

  // ===========================================================================
  // DOCUMENT LOADING
  // ===========================================================================

  /**
   * @method loadDocument
   * @description Loads a PDF document from File or URL
   *
   * @param {File|string|ArrayBuffer} source - PDF source
   *   - File: File object from file input
   *   - string: URL to PDF
   *   - ArrayBuffer: Raw PDF data
   *
   * @returns {Promise<Object>} Document info object
   * @returns {number} returns.numPages - Total number of pages
   * @returns {Object} returns.metadata - PDF metadata
   *
   * @throws {Error} When PDF.js not loaded or document fails to load
   *
   * @example
   * // From file input
   * const info = await renderer.loadDocument(fileInput.files[0]);
   *
   * // From URL
   * const info = await renderer.loadDocument('/path/to/document.pdf');
   *
   * @since 1.0.0
   */
  async loadDocument(source) {
    if (!this.pdfjsLoaded || !this.pdfjsLib) {
      throw new Error("PDF.js not loaded. Call loadPDFJS() first.");
    }

    logInfo("Loading PDF document");

    // Clean up previous document
    this.cleanup();

    try {
      // Determine source type and create loading task
      let loadingTask;

      if (source instanceof File) {
        logDebug("Loading from File object", {
          name: source.name,
          size: source.size,
          type: source.type,
        });

        // Validate file type before attempting to load
        const isPDF = this.validatePDFFile(source);
        if (!isPDF) {
          throw new Error("INVALID_FILE_TYPE");
        }

        const arrayBuffer = await source.arrayBuffer();
        loadingTask = this.pdfjsLib.getDocument({ data: arrayBuffer });
      } else if (typeof source === "string") {
        logDebug("Loading from URL", { url: source });
        loadingTask = this.pdfjsLib.getDocument(source);
      } else if (source instanceof ArrayBuffer) {
        logDebug("Loading from ArrayBuffer", { size: source.byteLength });
        loadingTask = this.pdfjsLib.getDocument({ data: source });
      } else {
        throw new Error(
          "Invalid source type. Expected File, URL string, or ArrayBuffer."
        );
      }

      // Track loading progress
      if (this.onLoadProgress) {
        loadingTask.onProgress = (progress) => {
          const percent =
            progress.total > 0
              ? Math.round((progress.loaded / progress.total) * 100)
              : 0;
          this.onLoadProgress(percent);
        };
      }

      // Wait for document to load
      this.pdfDocument = await loadingTask.promise;
      this.totalPages = this.pdfDocument.numPages;
      this.currentPage = 1;

      // Get metadata
      const metadata = await this.pdfDocument.getMetadata().catch(() => null);

      logInfo("PDF document loaded", {
        numPages: this.totalPages,
        title: metadata?.info?.Title || "Unknown",
      });

      return {
        numPages: this.totalPages,
        metadata: metadata?.info || {},
      };
    } catch (error) {
      logError("Failed to load PDF document", { error: error.message });

      // Provide user-friendly error messages
      if (error.message === "INVALID_FILE_TYPE") {
        throw new Error(
          "Only PDF files are supported for confidence visualisation. Please upload a PDF document."
        );
      }

      // Check for common PDF.js errors that indicate wrong file type
      if (
        error.message.includes("Invalid PDF structure") ||
        error.message.includes("Missing PDF") ||
        error.message.includes("not a valid PDF")
      ) {
        throw new Error(
          "The uploaded file does not appear to be a valid PDF. Only PDF files are supported for confidence visualisation."
        );
      }

      throw new Error(`Failed to load PDF: ${error.message}`);
    }
  }

  /**
   * @method validatePDFFile
   * @description Validates that a File object is a PDF
   * @param {File} file - File to validate
   * @returns {boolean} True if file appears to be a PDF
   * @private
   * @since 1.1.0
   */
  validatePDFFile(file) {
    // Check MIME type
    if (file.type === "application/pdf") {
      return true;
    }

    // Fallback: check file extension
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith(".pdf")) {
      return true;
    }

    logWarn("File does not appear to be a PDF", {
      name: file.name,
      type: file.type,
    });

    return false;
  }

  // ===========================================================================
  // PAGE RENDERING
  // ===========================================================================

  /**
   * @method renderPage
   * @description Renders a specific page to canvas
   *
   * @param {number} pageNumber - Page number to render (1-indexed)
   * @param {HTMLCanvasElement} canvas - Canvas element to render to
   * @param {Object} [options={}] - Render options
   * @param {number} [options.scale] - Render scale (uses currentScale if not provided)
   *
   * @returns {Promise<Object>} Rendering result
   * @returns {Object} returns.viewport - PDF.js viewport object
   * @returns {number} returns.width - Rendered width
   * @returns {number} returns.height - Rendered height
   * @returns {number} returns.renderTimeMs - Render time in milliseconds
   *
   * @throws {Error} When page number is invalid or rendering fails
   *
   * @example
   * const result = await renderer.renderPage(1, canvasElement);
   * console.log(`Page rendered: ${result.width}x${result.height}`);
   *
   * @since 1.0.0
   */
  async renderPage(pageNumber, canvas, options = {}) {
    if (!this.pdfDocument) {
      throw new Error("No PDF document loaded. Call loadDocument() first.");
    }

    if (pageNumber < 1 || pageNumber > this.totalPages) {
      throw new Error(
        `Invalid page number: ${pageNumber}. Document has ${this.totalPages} pages.`
      );
    }

    // Cancel any in-progress render
    if (this.renderTask) {
      this.renderTask.cancel();
      this.renderTask = null;
    }

    this.isRendering = true;
    this.pdfCanvas = canvas;
    const startTime = performance.now();

    const scale = options.scale ?? this.currentScale;

    logInfo("Rendering page", { pageNumber, scale });

    try {
      // Get the page
      const page = await this.pdfDocument.getPage(pageNumber);

      // Calculate viewport
      const viewport = page.getViewport({ scale });

      // Configure canvas for high-DPI
      const dpr = window.devicePixelRatio || 1;
      const outputScale = dpr;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      // Get rendering context
      const ctx = canvas.getContext("2d");

      // Prepare render context
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
        transform:
          outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null,
      };

      // Execute render
      this.renderTask = page.render(renderContext);
      await this.renderTask.promise;
      this.renderTask = null;

      // Update state
      this.currentPage = pageNumber;
      this.currentViewport = viewport;
      this.isRendering = false;

      const renderTimeMs = performance.now() - startTime;

      logInfo("Page rendered", {
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        renderTimeMs: `${renderTimeMs.toFixed(2)}ms`,
      });

      // Notify callback
      if (this.onPageChange) {
        this.onPageChange(pageNumber, this.totalPages);
      }

      return {
        viewport,
        width: viewport.width,
        height: viewport.height,
        renderTimeMs,
      };
    } catch (error) {
      this.isRendering = false;

      // Ignore cancelled render
      if (error.name === "RenderingCancelledException") {
        logDebug("Render cancelled");
        return null;
      }

      logError("Failed to render page", { pageNumber, error: error.message });
      throw new Error(`Failed to render page ${pageNumber}: ${error.message}`);
    }
  }

  // ===========================================================================
  // PAGE NAVIGATION
  // ===========================================================================

  /**
   * @method nextPage
   * @description Navigates to the next page
   *
   * @param {HTMLCanvasElement} canvas - Canvas to render to
   * @returns {Promise<Object|null>} Render result or null if at last page
   *
   * @since 1.0.0
   */
  async nextPage(canvas) {
    if (this.currentPage >= this.totalPages) {
      logDebug("Already at last page");
      return null;
    }
    return this.renderPage(this.currentPage + 1, canvas);
  }

  /**
   * @method previousPage
   * @description Navigates to the previous page
   *
   * @param {HTMLCanvasElement} canvas - Canvas to render to
   * @returns {Promise<Object|null>} Render result or null if at first page
   *
   * @since 1.0.0
   */
  async previousPage(canvas) {
    if (this.currentPage <= 1) {
      logDebug("Already at first page");
      return null;
    }
    return this.renderPage(this.currentPage - 1, canvas);
  }

  /**
   * @method goToPage
   * @description Navigates to a specific page
   *
   * @param {number} pageNumber - Target page number
   * @param {HTMLCanvasElement} canvas - Canvas to render to
   * @returns {Promise<Object>} Render result
   *
   * @since 1.0.0
   */
  async goToPage(pageNumber, canvas) {
    return this.renderPage(pageNumber, canvas);
  }

  // ===========================================================================
  // ZOOM CONTROLS
  // ===========================================================================

  /**
   * @method setScale
   * @description Sets the rendering scale
   *
   * @param {number} scale - New scale value
   * @param {HTMLCanvasElement} [canvas] - Canvas to re-render (optional)
   * @returns {Promise<Object|null>} Render result if canvas provided
   *
   * @since 1.0.0
   */
  async setScale(scale, canvas = null) {
    const config = PDF_VISUALISER_CONFIG.ZOOM;

    // Clamp to valid range
    const newScale = Math.max(
      config.MIN_SCALE,
      Math.min(config.MAX_SCALE, scale)
    );

    if (newScale === this.currentScale) {
      return null;
    }

    this.currentScale = newScale;

    logInfo("Scale changed", { scale: newScale });

    // Notify callback
    if (this.onZoomChange) {
      this.onZoomChange(newScale);
    }

    // Re-render if canvas provided
    if (canvas && this.pdfDocument) {
      return this.renderPage(this.currentPage, canvas, { scale: newScale });
    }

    return null;
  }

  /**
   * @method zoomIn
   * @description Increases zoom level by one step
   *
   * @param {HTMLCanvasElement} [canvas] - Canvas to re-render
   * @returns {Promise<Object|null>} Render result if canvas provided
   *
   * @since 1.0.0
   */
  async zoomIn(canvas = null) {
    const step = PDF_VISUALISER_CONFIG.ZOOM.STEP;
    return this.setScale(this.currentScale + step, canvas);
  }

  /**
   * @method zoomOut
   * @description Decreases zoom level by one step
   *
   * @param {HTMLCanvasElement} [canvas] - Canvas to re-render
   * @returns {Promise<Object|null>} Render result if canvas provided
   *
   * @since 1.0.0
   */
  async zoomOut(canvas = null) {
    const step = PDF_VISUALISER_CONFIG.ZOOM.STEP;
    return this.setScale(this.currentScale - step, canvas);
  }

  /**
   * @method resetZoom
   * @description Resets zoom to default scale
   *
   * @param {HTMLCanvasElement} [canvas] - Canvas to re-render
   * @returns {Promise<Object|null>} Render result if canvas provided
   *
   * @since 1.0.0
   */
  async resetZoom(canvas = null) {
    return this.setScale(PDF_VISUALISER_CONFIG.RENDERING.DEFAULT_SCALE, canvas);
  }

  // ===========================================================================
  // STATE ACCESSORS
  // ===========================================================================

  /**
   * @method isLoaded
   * @description Checks if a PDF document is loaded
   * @returns {boolean} True if document is loaded
   * @since 1.0.0
   */
  isLoaded() {
    return this.pdfDocument !== null;
  }

  /**
   * @method getState
   * @description Gets current renderer state
   *
   * @returns {Object} State object
   * @returns {boolean} returns.pdfjsLoaded - Whether PDF.js is loaded
   * @returns {boolean} returns.documentLoaded - Whether a document is loaded
   * @returns {number} returns.currentPage - Current page number
   * @returns {number} returns.totalPages - Total pages
   * @returns {number} returns.currentScale - Current scale
   * @returns {boolean} returns.isRendering - Whether rendering is in progress
   *
   * @since 1.0.0
   */
  getState() {
    return {
      pdfjsLoaded: this.pdfjsLoaded,
      documentLoaded: this.pdfDocument !== null,
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      currentScale: this.currentScale,
      isRendering: this.isRendering,
      viewport: this.currentViewport
        ? {
            width: this.currentViewport.width,
            height: this.currentViewport.height,
          }
        : null,
    };
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  /**
   * @method cleanup
   * @description Cleans up resources
   *
   * Releases the PDF document and clears state. Should be called
   * when switching documents or destroying the visualiser.
   *
   * @since 1.0.0
   */
  cleanup() {
    logInfo("Cleaning up renderer");

    // Cancel any pending render
    if (this.renderTask) {
      this.renderTask.cancel();
      this.renderTask = null;
    }

    // Destroy PDF document
    if (this.pdfDocument) {
      this.pdfDocument.destroy();
      this.pdfDocument = null;
    }

    // Reset state
    this.currentPage = 1;
    this.totalPages = 0;
    this.currentViewport = null;
    this.isRendering = false;

    // Clear canvas
    if (this.pdfCanvas) {
      const ctx = this.pdfCanvas.getContext("2d");
      ctx.clearRect(0, 0, this.pdfCanvas.width, this.pdfCanvas.height);
    }

    logDebug("Renderer cleanup complete");
  }

  /**
   * @method destroy
   * @description Fully destroys the renderer instance
   *
   * Performs cleanup and releases all references.
   *
   * @since 1.0.0
   */
  destroy() {
    this.cleanup();
    this.pdfjsLib = null;
    this.pdfjsLoaded = false;
    this.pdfCanvas = null;
    this.onPageChange = null;
    this.onZoomChange = null;
    this.onLoadProgress = null;

    logInfo("Renderer destroyed");
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default PDFVisualiserRenderer;

export { PDFVisualiserRenderer };

// =============================================================================
// GLOBAL EXPOSURE FOR TESTING
// =============================================================================

if (typeof window !== "undefined") {
  window.PDFVisualiserRenderer = PDFVisualiserRenderer;

  /**
   * Test PDF.js loading
   */
  window.testPDFRenderer = async () => {
    console.log("🧪 Testing PDF Visualiser Renderer");

    const renderer = new PDFVisualiserRenderer({
      onPageChange: (page, total) => console.log(`📄 Page ${page}/${total}`),
      onZoomChange: (scale) =>
        console.log(`🔍 Zoom: ${(scale * 100).toFixed(0)}%`),
    });

    console.log("\n📦 Loading PDF.js...");
    try {
      await renderer.loadPDFJS();
      console.log("✅ PDF.js loaded successfully");
      console.log("Version:", renderer.pdfjsLib?.version || "Unknown");
    } catch (error) {
      console.error("❌ Failed to load PDF.js:", error.message);
      return false;
    }

    console.log("\n📊 Renderer State:");
    console.table(renderer.getState());

    console.log("\n✅ Renderer tests complete");
    return renderer;
  };
}
