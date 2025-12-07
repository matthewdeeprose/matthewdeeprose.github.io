/**
 * @fileoverview PDF Confidence Visualiser - Main Controller
 * @module PDFConfidenceVisualiser
 * @requires ./pdf-visualiser-config.js
 * @requires ./pdf-visualiser-stats.js
 * @requires ./pdf-visualiser-overlays.js
 * @requires ./pdf-visualiser-renderer.js
 * @version 1.0.0
 * @since 1.0.0
 *
 * @description
 * Main controller for the PDF Confidence Visualiser feature.
 * Coordinates PDF.js rendering, confidence overlay drawing, and statistics
 * display for visualising OCR confidence levels on processed PDFs.
 *
 * Key Features:
 * - Orchestrates all visualiser components
 * - Manages visualiser state and lifecycle
 * - Handles user interactions (navigation, toggles, zoom)
 * - Provides public API for integration with MathPix system
 * - Creates and manages DOM elements for the visualiser
 * - Supports keyboard navigation for accessibility
 *
 * Integration:
 * - Instantiated by MathPixPDFResultRenderer when confidence tab is activated
 * - Receives lines.json data from MathPixAPIClient
 * - Uses MathPix notification system for user feedback
 *
 * Lifecycle:
 * Instantiate → initialize() → loadPDF() → Display → User Interaction → destroy()
 *
 * Accessibility:
 * - WCAG 2.2 AA compliant
 * - Full keyboard navigation
 * - Screen reader announcements via ARIA live regions
 * - Focus management for modal-like behaviour
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
    console.error("[PDFConfidenceVisualiser]", message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn("[PDFConfidenceVisualiser]", message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log("[PDFConfidenceVisualiser]", message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log("[PDFConfidenceVisualiser]", message, ...args);
}

// =============================================================================
// IMPORTS
// =============================================================================

import PDF_VISUALISER_CONFIG, {
  formatAriaMessage,
  formatPercentage,
} from "./pdf-visualiser-config.js";
import PDFVisualiserStats from "./pdf-visualiser-stats.js";
import PDFVisualiserOverlays from "./pdf-visualiser-overlays.js";
import PDFVisualiserRenderer from "./pdf-visualiser-renderer.js";

// =============================================================================
// MAIN CLASS
// =============================================================================

/**
 * @class PDFConfidenceVisualiser
 * @description Main controller for PDF confidence visualisation
 *
 * Orchestrates PDF rendering, overlay drawing, and statistics display.
 * Provides a complete visualisation system for OCR confidence analysis.
 *
 * @example
 * const visualiser = new PDFConfidenceVisualiser({
 *   container: document.getElementById('visualiser-container'),
 *   onError: (error) => showNotification(error.message, 'error')
 * });
 *
 * await visualiser.initialize();
 * await visualiser.loadPDF(pdfFile, linesData);
 *
 * @since 1.0.0
 */
class PDFConfidenceVisualiser {
  /**
   * @constructor
   * @description Creates a new PDF Confidence Visualiser instance
   *
   * @param {Object} options - Configuration options
   * @param {HTMLElement} options.container - Container element for the visualiser
   * @param {Function} [options.onError] - Error callback
   * @param {Function} [options.onPageChange] - Page change callback
   * @param {Function} [options.onStatsCalculated] - Statistics callback
   * @param {boolean} [options.showOverlays=true] - Initial overlay visibility
   * @param {boolean} [options.showLabels=true] - Initial label visibility
   *
   * @throws {Error} When container is not provided
   *
   * @since 1.0.0
   */
  constructor(options = {}) {
    if (!options.container) {
      throw new Error(
        "Container element is required for PDFConfidenceVisualiser"
      );
    }

    /**
     * @member {HTMLElement} container
     * @description Main container element
     */
    this.container = options.container;

    /**
     * @member {PDFVisualiserRenderer} renderer
     * @description PDF.js renderer instance
     */
    this.renderer = null;

    /**
     * @member {Object|null} linesData
     * @description Current lines.json data
     */
    this.linesData = null;

    /**
     * @member {Object|null} currentPageData
     * @description Lines data for current page
     */
    this.currentPageData = null;

    /**
     * @member {Object|null} statistics
     * @description Calculated statistics
     */
    this.statistics = null;

    /**
     * @member {boolean} showOverlays
     * @description Whether overlays are visible
     */
    this.showOverlays =
      options.showOverlays ??
      PDF_VISUALISER_CONFIG.RENDERING.SHOW_OVERLAYS_DEFAULT;

    /**
     * @member {boolean} showLabels
     * @description Whether labels are visible
     */
    this.showLabels =
      options.showLabels ?? PDF_VISUALISER_CONFIG.RENDERING.SHOW_LABELS_DEFAULT;

    /**
     * @member {boolean} isFullscreen
     * @description Whether fullscreen mode is active
     */
    this.isFullscreen = false;

    /**
     * @member {boolean} isFitToScreen
     * @description Whether fit-to-screen mode is active
     */
    this.isFitToScreen = false;

    /**
     * @member {number|null} scaleBeforeFit
     * @description Scale before fit-to-screen was enabled (for restoring)
     */
    this.scaleBeforeFit = null;

    /**
     * @member {number|null} scrollPositionBeforeFullscreen
     * @description Page scroll position before fullscreen was enabled (for restoring)
     */
    this.scrollPositionBeforeFullscreen = null;

    /**
     * @member {boolean} isInitialised
     * @description Initialisation state
     */
    this.isInitialised = false;

    /**
     * @member {Object} elements
     * @description Cached DOM element references
     */
    this.elements = {};

    // Callbacks
    this.onError = options.onError || null;
    this.onPageChange = options.onPageChange || null;
    this.onStatsCalculated = options.onStatsCalculated || null;

    // Bound event handlers (for cleanup)
    this.boundHandlers = {};

    logInfo("PDFConfidenceVisualiser created");
  }

  // ===========================================================================
  // INITIALISATION
  // ===========================================================================

  /**
   * @method initialize
   * @description Initialises the visualiser
   *
   * Creates DOM structure, initialises renderer, and sets up event listeners.
   * Must be called before loading any PDF.
   *
   * @returns {Promise<boolean>} True if initialisation successful
   *
   * @example
   * const visualiser = new PDFConfidenceVisualiser({ container });
   * const success = await visualiser.initialize();
   *
   * @since 1.0.0
   */
  async initialize() {
    if (this.isInitialised) {
      logWarn("Visualiser already initialised");
      return true;
    }

    logInfo("Initialising visualiser");

    try {
      // Create DOM structure
      this.createDOMStructure();

      // Initialise renderer
      this.renderer = new PDFVisualiserRenderer({
        onPageChange: (page, total) => this.handlePageChange(page, total),
        onZoomChange: (scale) => this.handleZoomChange(scale),
        onLoadProgress: (percent) => this.handleLoadProgress(percent),
      });

      // Load PDF.js
      await this.renderer.loadPDFJS();

      // Set up event listeners
      this.setupEventListeners();

      this.isInitialised = true;

      logInfo("Visualiser initialised successfully");
      return true;
    } catch (error) {
      logError("Initialisation failed", { error: error.message });
      this.handleError(error);
      return false;
    }
  }

  /**
   * @method createDOMStructure
   * @description Creates the visualiser DOM structure
   *
   * Builds the complete UI including viewer area, controls, statistics panel,
   * and accessibility features.
   *
   * @private
   * @since 1.0.0
   */
  createDOMStructure() {
    const config = PDF_VISUALISER_CONFIG.CSS_CLASSES;

    // Clear container
    this.container.innerHTML = "";
    this.container.className = config.CONTAINER;
    this.container.setAttribute("role", "region");
    this.container.setAttribute(
      "aria-label",
      PDF_VISUALISER_CONFIG.ARIA.CONTAINER_LABEL
    );

    // Create main structure
    this.container.innerHTML = `
      <!-- Live region for announcements -->
      <div id="pdf-vis-announcer" class="sr-only" aria-live="polite" aria-atomic="true"></div>

      <!-- Controls bar -->
      <div class="${config.CONTROLS}" role="toolbar" aria-label="${
      PDF_VISUALISER_CONFIG.ARIA.CONTROLS_LABEL
    }">
        <!-- Page navigation -->
        <div class="${config.CONTROL_GROUP} ${
      config.PAGE_NAV
    }" role="group" aria-label="${PDF_VISUALISER_CONFIG.ARIA.PAGE_NAV_LABEL}">
          <button type="button" id="pdf-vis-prev" class="${config.NAV_BUTTON}" 
                  aria-label="${PDF_VISUALISER_CONFIG.ARIA.PREV_PAGE}" disabled>
            <span aria-hidden="true">◀</span> Previous
          </button>
          <span id="pdf-vis-page-indicator" class="${config.PAGE_INDICATOR}">
            Page <span id="pdf-vis-current-page">-</span> of <span id="pdf-vis-total-pages">-</span>
          </span>
          <button type="button" id="pdf-vis-next" class="${config.NAV_BUTTON}"
                  aria-label="${PDF_VISUALISER_CONFIG.ARIA.NEXT_PAGE}" disabled>
            Next <span aria-hidden="true">▶</span>
          </button>
        </div>

        <!-- Zoom controls -->
        <div class="${
          config.CONTROL_GROUP
        }" role="group" aria-label="Zoom controls">
          <button type="button" id="pdf-vis-zoom-out" class="${
            config.CONTROL_BUTTON
          }"
                  aria-label="${PDF_VISUALISER_CONFIG.ARIA.ZOOM_OUT}">
            <span aria-hidden="true">−</span> Zoom Out
          </button>
<span id="pdf-vis-zoom-level" class="${config.PAGE_INDICATOR}">${Math.round(
      PDF_VISUALISER_CONFIG.RENDERING.DEFAULT_SCALE * 100
    )}%</span>
          <button type="button" id="pdf-vis-zoom-in" class="${
            config.CONTROL_BUTTON
          }"
                  aria-label="${PDF_VISUALISER_CONFIG.ARIA.ZOOM_IN}">
            <span aria-hidden="true">+</span> Zoom In
          </button>
        </div>

<!-- Toggle controls -->
        <div class="${
          config.CONTROL_GROUP
        }" role="group" aria-label="Display toggles">
          <label class="${config.TOGGLE}">
            <input type="checkbox" id="pdf-vis-toggle-overlays" checked>
            <span class="${config.TOGGLE_LABEL}">Show Overlays</span>
          </label>
          <label class="${config.TOGGLE}">
            <input type="checkbox" id="pdf-vis-toggle-labels" checked>
            <span class="${config.TOGGLE_LABEL}">Show Labels</span>
          </label>
          <label class="${config.TOGGLE} pdf-vis-toggle--normal-only">
            <input type="checkbox" id="pdf-vis-toggle-fullpage">
            <span class="${config.TOGGLE_LABEL}">Show Full Page</span>
          </label>
          <label class="${config.TOGGLE} pdf-vis-toggle--fullscreen-only">
            <input type="checkbox" id="pdf-vis-toggle-fitscreen">
            <span class="${config.TOGGLE_LABEL}">Fit to Screen</span>
          </label>
        </div>

        <!-- Fullscreen control -->
        <div class="${config.CONTROL_GROUP}">
          <button type="button" id="pdf-vis-fullscreen" class="${
            config.CONTROL_BUTTON
          }"
                  aria-label="${PDF_VISUALISER_CONFIG.ARIA.ENTER_FULLSCREEN}"
                  aria-pressed="false">
            <span aria-hidden="true" class="pdf-vis-fullscreen-icon">⛶</span>
            <span class="pdf-vis-fullscreen-text">Fullscreen</span>
          </button>
        </div>
      </div>

<!-- Main viewer area -->
      <div id="pdf-vis-viewer" class="${config.VIEWER}">
        <!-- Canvas wrapper - scrollable container with centering -->
        <div id="pdf-vis-canvas-wrapper" class="${config.CANVAS_WRAPPER}">
          <!-- Page wrapper - sizes to PDF canvas, provides positioning context -->
          <div id="pdf-vis-page-wrapper" class="${config.PAGE_WRAPPER}">
            <canvas id="pdf-vis-pdf-canvas" class="${
              config.PDF_CANVAS
            }"></canvas>
            <canvas id="pdf-vis-overlay-canvas" class="${
              config.OVERLAY_CANVAS
            }"></canvas>
          </div>
        </div>

<!-- Statistics sidebar -->
        <aside id="pdf-vis-stats" class="${config.STATS_PANEL}" 
               role="complementary" aria-label="${
                 PDF_VISUALISER_CONFIG.ARIA.STATS_LABEL
               }">
          <h3>Confidence Statistics</h3>
          
          <!-- Summary stats -->
          <dl id="pdf-vis-stats-summary" class="${config.STATS_SUMMARY}">
            <div class="${config.STAT_ITEM}">
              <dt class="${config.STAT_LABEL}">Total Lines</dt>
              <dd class="${config.STAT_VALUE}" id="pdf-vis-stat-total">-</dd>
            </div>
            <div class="${config.STAT_ITEM}">
              <dt class="${config.STAT_LABEL}">Average</dt>
              <dd class="${config.STAT_VALUE}" id="pdf-vis-stat-avg">-</dd>
            </div>
            <div class="${config.STAT_ITEM}">
              <dt class="${config.STAT_LABEL}">Range</dt>
              <dd class="${config.STAT_VALUE}" id="pdf-vis-stat-range">-</dd>
            </div>
          </dl>

          <!-- Legend -->
          <dl id="pdf-vis-legend" class="${config.LEGEND}" 
              aria-label="${PDF_VISUALISER_CONFIG.ARIA.LEGEND_LABEL}">
            <dt class="pdf-vis-legend-heading">Confidence Levels</dt>
            ${this.createLegendHTML()}
          </dl>
        </aside>
      </div>

      <!-- Loading overlay -->
      <div id="pdf-vis-loading" class="${config.LOADING}" hidden>
        <div class="pdf-vis-loading-spinner" aria-hidden="true"></div>
        <span id="pdf-vis-loading-text">Loading...</span>
      </div>
    `;

    // Cache element references
    this.cacheElements();

    logDebug("DOM structure created");
  }

  /**
   * @method createLegendHTML
   * @description Creates HTML for the confidence level legend
   * @returns {string} Legend HTML
   * @private
   * @since 1.0.0
   */
  createLegendHTML() {
    const levels = PDF_VISUALISER_CONFIG.CONFIDENCE_LEVELS;
    const config = PDF_VISUALISER_CONFIG.CSS_CLASSES;
    const levelOrder = ["HIGH", "MEDIUM", "LOW", "VERY_LOW"];

    // Map config keys to CSS class suffixes
    const cssClassMap = {
      HIGH: "high",
      MEDIUM: "medium",
      LOW: "low",
      VERY_LOW: "very-low",
    };

    return levelOrder
      .map((key) => {
        const level = levels[key];
        const cssClass = cssClassMap[key];
        return `
        <div class="${config.LEGEND_ITEM}">
          <dt>
            <span class="${
              config.LEGEND_SWATCH
            } pdf-vis-legend-swatch--${cssClass}" 
                  data-confidence-level="${cssClass}"
                  aria-hidden="true"></span>
            <span class="${config.LEGEND_LABEL}">${level.legendLabel}</span>
          </dt>
          <dd id="pdf-vis-legend-count-${key.toLowerCase()}" class="pdf-vis-legend-count">(0)</dd>
        </div>
      `;
      })
      .join("");
  }

  /**
   * @method cacheElements
   * @description Caches DOM element references
   * @private
   * @since 1.0.0
   */
  cacheElements() {
    this.elements = {
      announcer: document.getElementById("pdf-vis-announcer"),
      pdfCanvas: document.getElementById("pdf-vis-pdf-canvas"),
      overlayCanvas: document.getElementById("pdf-vis-overlay-canvas"),
      canvasWrapper: document.getElementById("pdf-vis-canvas-wrapper"),
      pageWrapper: document.getElementById("pdf-vis-page-wrapper"),

      // Navigation
      prevButton: document.getElementById("pdf-vis-prev"),
      nextButton: document.getElementById("pdf-vis-next"),
      currentPage: document.getElementById("pdf-vis-current-page"),
      totalPages: document.getElementById("pdf-vis-total-pages"),

      // Zoom
      zoomIn: document.getElementById("pdf-vis-zoom-in"),
      zoomOut: document.getElementById("pdf-vis-zoom-out"),
      zoomLevel: document.getElementById("pdf-vis-zoom-level"),

      // Toggles
      overlayToggle: document.getElementById("pdf-vis-toggle-overlays"),
      labelToggle: document.getElementById("pdf-vis-toggle-labels"),
      fullPageToggle: document.getElementById("pdf-vis-toggle-fullpage"),
      fitScreenToggle: document.getElementById("pdf-vis-toggle-fitscreen"),
      fullscreenButton: document.getElementById("pdf-vis-fullscreen"),

      // Viewer
      viewer: document.getElementById("pdf-vis-viewer"),

      // Statistics
      statTotal: document.getElementById("pdf-vis-stat-total"),
      statAvg: document.getElementById("pdf-vis-stat-avg"),
      statRange: document.getElementById("pdf-vis-stat-range"),

      // Loading
      loading: document.getElementById("pdf-vis-loading"),
      loadingText: document.getElementById("pdf-vis-loading-text"),
    };

    logDebug("Elements cached", { count: Object.keys(this.elements).length });
  }

  /**
   * @method setupEventListeners
   * @description Sets up event listeners for controls
   * @private
   * @since 1.0.0
   */
  setupEventListeners() {
    // Navigation
    this.boundHandlers.prevPage = () => this.previousPage();
    this.boundHandlers.nextPage = () => this.nextPage();
    this.elements.prevButton?.addEventListener(
      "click",
      this.boundHandlers.prevPage
    );
    this.elements.nextButton?.addEventListener(
      "click",
      this.boundHandlers.nextPage
    );

    // Zoom
    this.boundHandlers.zoomIn = () => this.zoomIn();
    this.boundHandlers.zoomOut = () => this.zoomOut();
    this.elements.zoomIn?.addEventListener("click", this.boundHandlers.zoomIn);
    this.elements.zoomOut?.addEventListener(
      "click",
      this.boundHandlers.zoomOut
    );

    // Toggles
    this.boundHandlers.toggleOverlays = (e) =>
      this.setOverlaysVisible(e.target.checked);
    this.boundHandlers.toggleLabels = (e) =>
      this.setLabelsVisible(e.target.checked);
    this.boundHandlers.toggleFullPage = (e) =>
      this.setFullPageView(e.target.checked);
    this.elements.overlayToggle?.addEventListener(
      "change",
      this.boundHandlers.toggleOverlays
    );
    this.elements.labelToggle?.addEventListener(
      "change",
      this.boundHandlers.toggleLabels
    );
    this.elements.fullPageToggle?.addEventListener(
      "change",
      this.boundHandlers.toggleFullPage
    );

    // Fit to screen
    this.boundHandlers.toggleFitScreen = (e) =>
      this.setFitToScreen(e.target.checked);
    this.elements.fitScreenToggle?.addEventListener(
      "change",
      this.boundHandlers.toggleFitScreen
    );

    // Fullscreen
    this.boundHandlers.toggleFullscreen = () => this.toggleFullscreen();
    this.elements.fullscreenButton?.addEventListener(
      "click",
      this.boundHandlers.toggleFullscreen
    );

    // Keyboard navigation
    this.boundHandlers.keydown = (e) => this.handleKeyDown(e);
    this.container.addEventListener("keydown", this.boundHandlers.keydown);

    // Focus trap handler for fullscreen mode
    this.boundHandlers.focusTrap = (e) => this.handleFocusTrap(e);

    // Make container focusable for keyboard nav
    this.container.setAttribute("tabindex", "0");

    logDebug("Event listeners set up");
  }

  // ===========================================================================
  // PDF LOADING
  // ===========================================================================

  /**
   * @method loadPDF
   * @description Loads a PDF and its confidence data
   *
   * Main entry point for displaying a PDF with confidence overlays.
   * Loads the PDF document and lines.json data, calculates statistics,
   * and renders the first page.
   *
   * @param {File|string|ArrayBuffer} pdfSource - PDF source
   * @param {Object} linesData - Lines.json data from MathPix API
   *
   * @returns {Promise<Object>} Load result with statistics
   *
   * @throws {Error} When visualiser not initialised or loading fails
   *
   * @example
   * await visualiser.loadPDF(pdfFile, linesData);
   *
   * @since 1.0.0
   */
  async loadPDF(pdfSource, linesData) {
    if (!this.isInitialised) {
      throw new Error("Visualiser not initialised. Call initialize() first.");
    }

    logInfo("Loading PDF with confidence data");
    this.showLoading(PDF_VISUALISER_CONFIG.MESSAGES.LOADING_PDF);

    try {
      // Validate lines data
      const validation = PDFVisualiserStats.validateLinesData(linesData);
      if (!validation.isValid) {
        logWarn("Lines data validation issues", { errors: validation.errors });
      }

      // Store lines data
      this.linesData = linesData;

      // Load PDF document
      const docInfo = await this.renderer.loadDocument(pdfSource);

      // Calculate statistics
      this.showLoading("Calculating statistics...");
      this.statistics = PDFVisualiserStats.calculateStatistics(linesData);

      // Update statistics display
      this.updateStatisticsDisplay();

      // Notify callback
      if (this.onStatsCalculated) {
        this.onStatsCalculated(this.statistics);
      }

      // Update zoom display to reflect current scale
      this.handleZoomChange(this.renderer.currentScale);

      // Render first page
      this.showLoading(PDF_VISUALISER_CONFIG.MESSAGES.LOADING_PAGE);
      await this.renderCurrentPage();

      this.hideLoading();
      this.announce(PDF_VISUALISER_CONFIG.MESSAGES.LOADED);

      logInfo("PDF loaded successfully", {
        pages: docInfo.numPages,
        lines: this.statistics.totalLines,
      });

      return {
        numPages: docInfo.numPages,
        statistics: this.statistics,
      };
    } catch (error) {
      this.hideLoading();
      logError("Failed to load PDF", { error: error.message });
      this.handleError(error);
      throw error;
    }
  }

  // ===========================================================================
  // PAGE RENDERING
  // ===========================================================================

  /**
   * @method renderCurrentPage
   * @description Renders the current page with overlays
   * @private
   * @since 1.0.0
   */
  async renderCurrentPage() {
    if (!this.renderer || !this.elements.pdfCanvas) {
      return;
    }

    const pageNum = this.renderer.currentPage;

    // Clear existing toggletip regions before rendering new page
    this.clearToggletipRegions();

    // Render PDF page
    const result = await this.renderer.renderPage(
      pageNum,
      this.elements.pdfCanvas
    );

    if (!result) {
      return; // Render was cancelled
    }

    // Get page-specific lines data
    this.currentPageData = this.getPageLinesData(pageNum);

    // Size overlay canvas to match
    this.sizeOverlayCanvas(result.viewport);

    // Draw overlays
    this.drawOverlays(result.viewport);

    // Update navigation state
    this.updateNavigationState();

    // Update page-specific stats
    this.updatePageStats(pageNum);
  }

  /**
   * @method getPageLinesData
   * @description Gets lines data for a specific page
   * @param {number} pageNumber - Page number (1-indexed)
   * @returns {Object|null} Page data or null
   * @private
   * @since 1.0.0
   */
  getPageLinesData(pageNumber) {
    if (!this.linesData?.pages) {
      return null;
    }

    // Lines data pages are typically 1-indexed
    return this.linesData.pages.find((p) => p.page === pageNumber) || null;
  }

  /**
   * @method sizeOverlayCanvas
   * @description Sizes overlay canvas to match PDF canvas
   * @param {Object} viewport - PDF.js viewport
   * @private
   * @since 1.0.0
   */
  sizeOverlayCanvas(viewport) {
    const overlay = this.elements.overlayCanvas;
    if (!overlay) return;

    const dpr = window.devicePixelRatio || 1;

    overlay.width = Math.floor(viewport.width * dpr);
    overlay.height = Math.floor(viewport.height * dpr);
    overlay.style.width = `${viewport.width}px`;
    overlay.style.height = `${viewport.height}px`;

    logDebug("Overlay canvas sized", {
      width: overlay.width,
      height: overlay.height,
    });
  }

  /**
   * @method drawOverlays
   * @description Draws confidence overlays on the overlay canvas
   * @param {Object} viewport - PDF.js viewport
   * @private
   * @since 1.0.0
   */
  drawOverlays(viewport) {
    const overlay = this.elements.overlayCanvas;
    if (!overlay || !this.currentPageData) {
      return;
    }

    const ctx = overlay.getContext("2d");

    PDFVisualiserOverlays.drawOverlays(ctx, this.currentPageData, viewport, {
      showOverlays: this.showOverlays,
      showLabels: this.showLabels,
      dpr: window.devicePixelRatio || 1,
    });
  }

  // ===========================================================================
  // NAVIGATION
  // ===========================================================================

  /**
   * @method nextPage
   * @description Navigates to the next page
   * @returns {Promise<void>}
   * @since 1.0.0
   */
  async nextPage() {
    if (
      !this.renderer ||
      this.renderer.currentPage >= this.renderer.totalPages
    ) {
      return;
    }

    await this.renderer.nextPage(this.elements.pdfCanvas);
    await this.renderCurrentPage();
  }

  /**
   * @method previousPage
   * @description Navigates to the previous page
   * @returns {Promise<void>}
   * @since 1.0.0
   */
  async previousPage() {
    if (!this.renderer || this.renderer.currentPage <= 1) {
      return;
    }

    await this.renderer.previousPage(this.elements.pdfCanvas);
    await this.renderCurrentPage();
  }

  /**
   * @method goToPage
   * @description Navigates to a specific page
   * @param {number} pageNumber - Target page
   * @returns {Promise<void>}
   * @since 1.0.0
   */
  async goToPage(pageNumber) {
    if (!this.renderer) return;

    await this.renderer.goToPage(pageNumber, this.elements.pdfCanvas);
    await this.renderCurrentPage();
  }

  /**
   * @method updateNavigationState
   * @description Updates navigation button states
   * @private
   * @since 1.0.0
   */
  updateNavigationState() {
    if (!this.renderer) return;

    const { currentPage, totalPages } = this.renderer;

    // Update display
    if (this.elements.currentPage) {
      this.elements.currentPage.textContent = currentPage;
    }
    if (this.elements.totalPages) {
      this.elements.totalPages.textContent = totalPages;
    }

    // Update button states
    if (this.elements.prevButton) {
      this.elements.prevButton.disabled = currentPage <= 1;
    }
    if (this.elements.nextButton) {
      this.elements.nextButton.disabled = currentPage >= totalPages;
    }
  }

  // ===========================================================================
  // ZOOM
  // ===========================================================================

  /**
   * @method zoomIn
   * @description Increases zoom level
   * @since 1.0.0
   */
  async zoomIn() {
    if (!this.renderer) return;

    await this.renderer.zoomIn(this.elements.pdfCanvas);
    await this.renderCurrentPage();
  }

  /**
   * @method zoomOut
   * @description Decreases zoom level
   * @since 1.0.0
   */
  async zoomOut() {
    if (!this.renderer) return;

    await this.renderer.zoomOut(this.elements.pdfCanvas);
    await this.renderCurrentPage();
  }

  // ===========================================================================
  // TOGGLE CONTROLS
  // ===========================================================================

  /**
   * @method setOverlaysVisible
   * @description Sets overlay visibility
   * @param {boolean} visible - Whether overlays should be visible
   * @since 1.0.0
   */
  setOverlaysVisible(visible) {
    this.showOverlays = visible;

    if (this.renderer?.currentViewport) {
      this.drawOverlays(this.renderer.currentViewport);
    }

    const message = visible
      ? PDF_VISUALISER_CONFIG.ARIA.OVERLAYS_ENABLED
      : PDF_VISUALISER_CONFIG.ARIA.OVERLAYS_DISABLED;
    this.announce(message);

    logInfo("Overlays visibility changed", { visible });
  }

  /**
   * @method setLabelsVisible
   * @description Sets label visibility
   * @param {boolean} visible - Whether labels should be visible
   * @since 1.0.0
   */
  setLabelsVisible(visible) {
    this.showLabels = visible;

    if (this.renderer?.currentViewport) {
      this.drawOverlays(this.renderer.currentViewport);
    }

    const message = visible
      ? PDF_VISUALISER_CONFIG.ARIA.LABELS_ENABLED
      : PDF_VISUALISER_CONFIG.ARIA.LABELS_DISABLED;
    this.announce(message);

    logInfo("Labels visibility changed", { visible });
  }

  /**
   * @method setFullPageView
   * @description Toggles full page view (removes max-height constraint)
   * @param {boolean} enabled - Whether full page view should be enabled
   * @since 1.1.0
   */
  setFullPageView(enabled) {
    if (this.elements.viewer) {
      this.elements.viewer.classList.toggle(
        "pdf-vis-viewer--fullpage",
        enabled
      );
    }

    const message = enabled
      ? "Full page view enabled"
      : "Full page view disabled";
    this.announce(message);

    logInfo("Full page view changed", { enabled });
  }

  // ===========================================================================
  // STATISTICS DISPLAY
  // ===========================================================================

  /**
   * @method updateStatisticsDisplay
   * @description Updates the statistics panel with current data
   * @private
   * @since 1.0.0
   */
  updateStatisticsDisplay() {
    if (!this.statistics) return;

    const stats = this.statistics;

    // Summary stats
    if (this.elements.statTotal) {
      this.elements.statTotal.textContent = stats.totalLines.toLocaleString();
    }
    if (this.elements.statAvg) {
      this.elements.statAvg.textContent = formatPercentage(
        stats.averageConfidence,
        1
      );
    }
    if (this.elements.statRange) {
      this.elements.statRange.textContent = `${formatPercentage(
        stats.minConfidence,
        0
      )} - ${formatPercentage(stats.maxConfidence, 0)}`;
    }

    // Legend counts
    const levelOrder = ["high", "medium", "low", "very_low"];
    for (const level of levelOrder) {
      const countEl = document.getElementById(`pdf-vis-legend-count-${level}`);
      if (countEl) {
        const upperLevel = level.toUpperCase();
        countEl.textContent = `(${stats.byLevel[upperLevel] || 0})`;
      }
    }

    logDebug("Statistics display updated");
  }

  /**
   * @method updatePageStats
   * @description Updates page-specific statistics
   * @param {number} pageNumber - Current page number
   * @private
   * @since 1.0.0
   */
  updatePageStats(pageNumber) {
    // Could add page-specific stats section if needed
    logDebug("Page stats updated", { pageNumber });
  }

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  /**
   * @method handlePageChange
   * @description Handles page change events from renderer
   * @param {number} page - New page number
   * @param {number} total - Total pages
   * @private
   * @since 1.0.0
   */
  handlePageChange(page, total) {
    this.announce(
      formatAriaMessage(PDF_VISUALISER_CONFIG.ARIA.PAGE_CHANGED, {
        current: page,
        total,
      })
    );

    if (this.onPageChange) {
      this.onPageChange(page, total);
    }
  }

  /**
   * @method handleZoomChange
   * @description Handles zoom change events from renderer
   * @param {number} scale - New scale
   * @private
   * @since 1.0.0
   */
  handleZoomChange(scale) {
    if (this.elements.zoomLevel) {
      this.elements.zoomLevel.textContent = `${Math.round(scale * 100)}%`;
    }

    this.announce(
      formatAriaMessage(PDF_VISUALISER_CONFIG.ARIA.ZOOM_CHANGED, {
        level: Math.round(scale * 100),
      })
    );
  }

  /**
   * @method handleLoadProgress
   * @description Handles load progress events
   * @param {number} percent - Progress percentage
   * @private
   * @since 1.0.0
   */
  handleLoadProgress(percent) {
    if (this.elements.loadingText) {
      this.elements.loadingText.textContent = `Loading... ${percent}%`;
    }
  }

  /**
   * @method handleKeyDown
   * @description Handles keyboard navigation
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   * @since 1.0.0
   */
  handleKeyDown(event) {
    switch (event.key) {
      case "ArrowLeft":
      case "PageUp":
        event.preventDefault();
        this.previousPage();
        break;
      case "ArrowRight":
      case "PageDown":
        event.preventDefault();
        this.nextPage();
        break;
      case "+":
      case "=":
        event.preventDefault();
        this.zoomIn();
        break;
      case "-":
      case "_":
        event.preventDefault();
        this.zoomOut();
        break;
      case "f":
      case "F":
        // Only toggle if not typing in an input
        if (
          event.target.tagName !== "INPUT" &&
          event.target.tagName !== "TEXTAREA"
        ) {
          event.preventDefault();
          this.toggleFullscreen();
        }
        break;
    }
  }

  // ===========================================================================
  // FULLSCREEN MODE
  // ===========================================================================

  /**
   * @method toggleFullscreen
   * @description Toggles fullscreen mode on/off
   * @since 1.1.0
   */
  toggleFullscreen() {
    if (this.isFullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  /**
   * @method enterFullscreen
   * @description Enters fullscreen mode
   * @since 1.1.0
   */
  enterFullscreen() {
    if (this.isFullscreen) return;

    // Save current scroll position before going fullscreen
    this.scrollPositionBeforeFullscreen = window.scrollY;

    this.isFullscreen = true;
    const config = PDF_VISUALISER_CONFIG.CSS_CLASSES;

    // Add fullscreen class to container
    this.container.classList.add(config.FULLSCREEN);

    // Prevent body scroll
    document.body.style.overflow = "hidden";

    // Enable focus trap
    document.addEventListener("keydown", this.boundHandlers.focusTrap);

    // Update button state
    if (this.elements.fullscreenButton) {
      this.elements.fullscreenButton.setAttribute("aria-pressed", "true");
      this.elements.fullscreenButton.setAttribute(
        "aria-label",
        PDF_VISUALISER_CONFIG.ARIA.EXIT_FULLSCREEN
      );
      const textSpan = this.elements.fullscreenButton.querySelector(
        ".pdf-vis-fullscreen-text"
      );
      if (textSpan) {
        textSpan.textContent = "Exit Fullscreen";
      }
      const iconSpan = this.elements.fullscreenButton.querySelector(
        ".pdf-vis-fullscreen-icon"
      );
      if (iconSpan) {
        iconSpan.textContent = "✕";
      }
    }

    // Announce for screen readers
    this.announce(PDF_VISUALISER_CONFIG.ARIA.FULLSCREEN_ENTERED);

    // Focus the container for keyboard navigation
    this.container.focus();

    logInfo("Entered fullscreen mode");
  }

  /**
   * @method exitFullscreen
   * @description Exits fullscreen mode
   * @since 1.1.0
   */
  async exitFullscreen() {
    if (!this.isFullscreen) return;

    this.isFullscreen = false;
    const config = PDF_VISUALISER_CONFIG.CSS_CLASSES;

    // If fit-to-screen was enabled, disable it and restore previous scale
    if (this.isFitToScreen) {
      await this.disableFitToScreen();
      // Reset the checkbox
      if (this.elements.fitScreenToggle) {
        this.elements.fitScreenToggle.checked = false;
      }
    }

    // Remove fullscreen class from container
    this.container.classList.remove(config.FULLSCREEN);

    // Restore body scroll
    document.body.style.overflow = "";

    // Disable focus trap
    document.removeEventListener("keydown", this.boundHandlers.focusTrap);

    // Update button state
    if (this.elements.fullscreenButton) {
      this.elements.fullscreenButton.setAttribute("aria-pressed", "false");
      this.elements.fullscreenButton.setAttribute(
        "aria-label",
        PDF_VISUALISER_CONFIG.ARIA.ENTER_FULLSCREEN
      );
      const textSpan = this.elements.fullscreenButton.querySelector(
        ".pdf-vis-fullscreen-text"
      );
      if (textSpan) {
        textSpan.textContent = "Fullscreen";
      }
      const iconSpan = this.elements.fullscreenButton.querySelector(
        ".pdf-vis-fullscreen-icon"
      );
      if (iconSpan) {
        iconSpan.textContent = "⛶";
      }
    }

    // Announce for screen readers
    this.announce(PDF_VISUALISER_CONFIG.ARIA.FULLSCREEN_EXITED);

    // Restore scroll position after a brief delay to allow layout to settle
    if (this.scrollPositionBeforeFullscreen !== null) {
      requestAnimationFrame(() => {
        window.scrollTo(0, this.scrollPositionBeforeFullscreen);
        this.scrollPositionBeforeFullscreen = null;
      });
    }

    logInfo("Exited fullscreen mode");
  }

  /**
   * @method handleFocusTrap
   * @description Traps focus within the fullscreen container
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   * @since 1.1.0
   */
  handleFocusTrap(event) {
    if (event.key !== "Tab" || !this.isFullscreen) return;

    // Get all focusable elements within the container
    const focusableSelectors = [
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "a[href]",
      '[tabindex]:not([tabindex="-1"])',
    ].join(", ");

    const focusableElements = Array.from(
      this.container.querySelectorAll(focusableSelectors)
    ).filter((el) => {
      // Ensure element is visible
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    });

    if (focusableElements.length === 0) return;

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Handle Shift+Tab (backwards)
    if (event.shiftKey) {
      if (
        document.activeElement === firstFocusable ||
        document.activeElement === this.container
      ) {
        event.preventDefault();
        lastFocusable.focus();
      }
    } else {
      // Handle Tab (forwards)
      if (document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }
  }

  // ===========================================================================
  // FIT TO SCREEN
  // ===========================================================================

  /**
   * @method setFitToScreen
   * @description Enables or disables fit-to-screen mode
   * @param {boolean} enabled - Whether to enable fit-to-screen
   * @since 1.1.0
   */
  async setFitToScreen(enabled) {
    if (!this.renderer || !this.renderer.isLoaded()) {
      logWarn("Cannot set fit-to-screen: no document loaded");
      return;
    }

    if (enabled) {
      await this.enableFitToScreen();
    } else {
      await this.disableFitToScreen();
    }
  }

  /**
   * @method enableFitToScreen
   * @description Calculates and applies fit-to-screen scale
   * @private
   * @since 1.1.0
   */
  async enableFitToScreen() {
    if (this.isFitToScreen) return;

    // Store current scale for later restoration
    this.scaleBeforeFit = this.renderer.currentScale;

    // Calculate optimal scale
    const fitScale = this.calculateFitScale();
    if (!fitScale) {
      logWarn("Could not calculate fit scale");
      return;
    }

    this.isFitToScreen = true;

    // Apply the scale
    await this.renderer.setScale(fitScale, this.elements.pdfCanvas);

    // Re-render overlays at new scale
    await this.renderCurrentPage();

    // Update zoom display
    this.handleZoomChange(fitScale);

    // Announce for screen readers
    this.announce(PDF_VISUALISER_CONFIG.ARIA.FIT_ENABLED);

    logInfo("Fit to screen enabled", { scale: fitScale });
  }

  /**
   * @method disableFitToScreen
   * @description Restores previous scale
   * @private
   * @since 1.1.0
   */
  async disableFitToScreen() {
    if (!this.isFitToScreen) return;

    this.isFitToScreen = false;

    // Restore previous scale
    const restoreScale =
      this.scaleBeforeFit || PDF_VISUALISER_CONFIG.RENDERING.DEFAULT_SCALE;
    this.scaleBeforeFit = null;

    // Apply the scale
    await this.renderer.setScale(restoreScale, this.elements.pdfCanvas);

    // Re-render overlays at restored scale
    await this.renderCurrentPage();

    // Update zoom display
    this.handleZoomChange(restoreScale);

    // Announce for screen readers
    this.announce(PDF_VISUALISER_CONFIG.ARIA.FIT_DISABLED);

    logInfo("Fit to screen disabled", { scale: restoreScale });
  }

  /**
   * @method calculateFitScale
   * @description Calculates the scale needed to fit PDF in available space
   * @returns {number|null} Optimal scale or null if cannot calculate
   * @private
   * @since 1.1.0
   */
  calculateFitScale() {
    if (!this.elements.canvasWrapper || !this.renderer?.currentViewport) {
      return null;
    }

    // Get available space (canvas wrapper minus padding)
    const wrapper = this.elements.canvasWrapper;
    const wrapperStyle = window.getComputedStyle(wrapper);
    const paddingX =
      parseFloat(wrapperStyle.paddingLeft) +
      parseFloat(wrapperStyle.paddingRight);
    const paddingY =
      parseFloat(wrapperStyle.paddingTop) +
      parseFloat(wrapperStyle.paddingBottom);

    const availableWidth = wrapper.clientWidth - paddingX;
    const availableHeight = wrapper.clientHeight - paddingY;

    // Get current viewport dimensions and calculate base dimensions (at scale 1.0)
    const currentViewport = this.renderer.currentViewport;
    const currentScale = this.renderer.currentScale;

    const baseWidth = currentViewport.width / currentScale;
    const baseHeight = currentViewport.height / currentScale;

    // Calculate scale to fit both dimensions
    const scaleX = availableWidth / baseWidth;
    const scaleY = availableHeight / baseHeight;

    // Use the smaller scale to ensure it fits both ways
    let fitScale = Math.min(scaleX, scaleY);

    // Clamp to zoom limits
    const { MIN_SCALE, MAX_SCALE } = PDF_VISUALISER_CONFIG.ZOOM;
    fitScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fitScale));

    logDebug("Calculated fit scale", {
      availableWidth,
      availableHeight,
      baseWidth,
      baseHeight,
      scaleX,
      scaleY,
      fitScale,
    });

    return fitScale;
  }

  /**
   * @method handleError
   * @description Handles errors
   * @param {Error} error - Error object
   * @private
   * @since 1.0.0
   */
  handleError(error) {
    logError("Error occurred", { error: error.message });

    if (this.onError) {
      this.onError(error);
    }
  }

  // ===========================================================================
  // UI HELPERS
  // ===========================================================================

  /**
   * @method showLoading
   * @description Shows loading overlay
   * @param {string} [message='Loading...'] - Loading message
   * @private
   * @since 1.0.0
   */
  showLoading(message = "Loading...") {
    if (this.elements.loading) {
      this.elements.loading.hidden = false;
    }
    if (this.elements.loadingText) {
      this.elements.loadingText.textContent = message;
    }
  }

  /**
   * @method hideLoading
   * @description Hides loading overlay
   * @private
   * @since 1.0.0
   */
  hideLoading() {
    if (this.elements.loading) {
      this.elements.loading.hidden = true;
    }
  }

  /**
   * @method announce
   * @description Announces message to screen readers
   * @param {string} message - Message to announce
   * @private
   * @since 1.0.0
   */
  announce(message) {
    if (this.elements.announcer) {
      this.elements.announcer.textContent = message;
    }
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * @method getState
   * @description Gets current visualiser state
   * @returns {Object} State object
   * @since 1.0.0
   */
  getState() {
    return {
      isInitialised: this.isInitialised,
      hasDocument: this.renderer?.isLoaded() || false,
      currentPage: this.renderer?.currentPage || 0,
      totalPages: this.renderer?.totalPages || 0,
      currentScale: this.renderer?.currentScale || 1,
      showOverlays: this.showOverlays,
      showLabels: this.showLabels,
      hasStatistics: this.statistics !== null,
    };
  }

  /**
   * @method getStatistics
   * @description Gets calculated statistics
   * @returns {Object|null} Statistics object
   * @since 1.0.0
   */
  getStatistics() {
    return this.statistics;
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  /**
   * @method clearToggletipRegions
   * @description Clears all toggletip regions from the overlay canvas
   *
   * Removes all interactive toggletip regions to prevent stale buttons
   * and memory leaks when changing pages or re-rendering overlays.
   *
   * @private
   * @since 1.2.0
   */
  clearToggletipRegions() {
    if (
      this.elements.overlayCanvas &&
      typeof UniversalToggletip !== "undefined"
    ) {
      UniversalToggletip.clearCanvasRegions(this.elements.overlayCanvas);
      logDebug("Toggletip regions cleared from overlay canvas");
    }
  }

  /**
   * @method destroy
   * @description Destroys the visualiser and cleans up resources
   * @since 1.0.0
   */
  destroy() {
    logInfo("Destroying visualiser");

    // Clear toggletip regions first (before clearing canvas)
    this.clearToggletipRegions();

    // Remove event listeners
    if (this.elements.prevButton) {
      this.elements.prevButton.removeEventListener(
        "click",
        this.boundHandlers.prevPage
      );
    }
    if (this.elements.nextButton) {
      this.elements.nextButton.removeEventListener(
        "click",
        this.boundHandlers.nextPage
      );
    }
    if (this.elements.zoomIn) {
      this.elements.zoomIn.removeEventListener(
        "click",
        this.boundHandlers.zoomIn
      );
    }
    if (this.elements.zoomOut) {
      this.elements.zoomOut.removeEventListener(
        "click",
        this.boundHandlers.zoomOut
      );
    }
    if (this.elements.overlayToggle) {
      this.elements.overlayToggle.removeEventListener(
        "change",
        this.boundHandlers.toggleOverlays
      );
    }
    if (this.elements.labelToggle) {
      this.elements.labelToggle.removeEventListener(
        "change",
        this.boundHandlers.toggleLabels
      );
    }
    if (this.elements.fullPageToggle) {
      this.elements.fullPageToggle.removeEventListener(
        "change",
        this.boundHandlers.toggleFullPage
      );
    }
    if (this.elements.fullscreenButton) {
      this.elements.fullscreenButton.removeEventListener(
        "click",
        this.boundHandlers.toggleFullscreen
      );
    }
    if (this.elements.fitScreenToggle) {
      this.elements.fitScreenToggle.removeEventListener(
        "change",
        this.boundHandlers.toggleFitScreen
      );
    }
    if (this.container) {
      this.container.removeEventListener("keydown", this.boundHandlers.keydown);
    }
    // Remove focus trap listener if active
    document.removeEventListener("keydown", this.boundHandlers.focusTrap);

    // Ensure we exit fullscreen mode and restore body scroll
    if (this.isFullscreen) {
      document.body.style.overflow = "";
    }

    // Destroy renderer
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }

    // Clear data
    this.linesData = null;
    this.currentPageData = null;
    this.statistics = null;

    // Clear container
    if (this.container) {
      this.container.innerHTML = "";
    }

    // Clear references
    this.elements = {};
    this.boundHandlers = {};
    this.isInitialised = false;

    logInfo("Visualiser destroyed");
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default PDFConfidenceVisualiser;

export {
  PDFConfidenceVisualiser,
  PDFVisualiserStats,
  PDFVisualiserOverlays,
  PDFVisualiserRenderer,
};

// =============================================================================
// GLOBAL EXPOSURE FOR TESTING
// =============================================================================

if (typeof window !== "undefined") {
  window.PDFConfidenceVisualiser = PDFConfidenceVisualiser;

  /**
   * Comprehensive test suite for PDF Confidence Visualiser
   */
  window.testPDFVisualiser = async () => {
    console.log("🧪 Testing PDF Confidence Visualiser");

    // Test 1: Module availability
    console.log("\n📦 Testing module availability:");
    const modules = [
      "PDFConfidenceVisualiser",
      "PDFVisualiserStats",
      "PDFVisualiserOverlays",
      "PDFVisualiserRenderer",
    ];

    modules.forEach((m) => {
      const available = typeof window[m] !== "undefined";
      console.log(`${available ? "✅" : "❌"} ${m}`);
    });

    // Test 2: Create instance
    console.log("\n🔧 Creating test instance:");
    const testContainer = document.createElement("div");
    testContainer.id = "pdf-vis-test-container";
    testContainer.style.cssText =
      "width: 800px; height: 600px; position: fixed; top: -9999px;";
    document.body.appendChild(testContainer);

    try {
      const visualiser = new PDFConfidenceVisualiser({
        container: testContainer,
        onError: (err) => console.log("Error callback:", err.message),
      });
      console.log("✅ Instance created");

      // Test 3: Initialize
      console.log("\n🚀 Initialising:");
      const initResult = await visualiser.initialize();
      console.log(initResult ? "✅ Initialised" : "❌ Initialisation failed");

      // Test 4: Check state
      console.log("\n📊 State check:");
      console.table(visualiser.getState());

      // Clean up
      visualiser.destroy();
      testContainer.remove();
      console.log("\n🧹 Cleanup complete");
    } catch (error) {
      console.error("❌ Test failed:", error);
      testContainer.remove();
    }

    console.log("\n✅ PDF Confidence Visualiser tests complete");
    return true;
  };

  /**
   * Test with real lines data (if available)
   */
  window.testPDFVisualiserWithData = async (pdfId) => {
    console.log("🧪 Testing PDF Visualiser with real data");

    const controller = window.getMathPixController?.();
    if (!controller?.apiClient) {
      console.error("❌ MathPix controller not available");
      return false;
    }

    try {
      // Fetch lines data
      console.log("📡 Fetching lines data for:", pdfId);
      const linesData = await controller.apiClient.fetchLinesData(pdfId);
      console.log("✅ Lines data fetched:", {
        pages: linesData.pages?.length,
        totalLines: linesData.pages?.reduce(
          (sum, p) => sum + (p.lines?.length || 0),
          0
        ),
      });

      // Calculate statistics
      const stats = PDFVisualiserStats.calculateStatistics(linesData);
      console.log("\n📊 Statistics:");
      console.table({
        "Total Pages": stats.totalPages,
        "Total Lines": stats.totalLines,
        "Average Confidence": formatPercentage(stats.averageConfidence, 1),
        High: stats.byLevel.HIGH,
        Medium: stats.byLevel.MEDIUM,
        Low: stats.byLevel.LOW,
        "Very Low": stats.byLevel.VERY_LOW,
      });

      console.log("\n💬 Summary:", stats.summaryText);

      return { linesData, stats };
    } catch (error) {
      console.error("❌ Test failed:", error);
      return false;
    }
  };
}
