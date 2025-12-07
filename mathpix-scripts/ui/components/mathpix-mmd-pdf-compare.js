/**
 * @fileoverview MathPix MMD PDF Compare - PDF rendering for comparison view
 * @module MathPixMMDPDFCompare
 * @requires PDF.js
 * @version 1.0.0
 * @since 4.2.0
 *
 * @description
 * Renders PDF documents alongside MMD preview for visual comparison.
 * Uses PDF.js for rendering with continuous scroll, zoom controls,
 * and page navigation. Implements lazy loading for performance.
 *
 * Features:
 * - Continuous scroll PDF rendering
 * - Zoom controls (in, out, fit to width)
 * - Page navigation with input field
 * - Lazy loading for large PDFs
 * - Intersection Observer for visible pages
 * - WCAG 2.2 AA accessibility compliance
 */

// Logging configuration
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.DEBUG;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR))
    console.error("[MMD PDF Compare]", message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn("[MMD PDF Compare]", message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log("[MMD PDF Compare]", message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log("[MMD PDF Compare]", message, ...args);
}

/**
 * @class MathPixMMDPDFCompare
 * @description PDF rendering module for MMD comparison view
 */
class MathPixMMDPDFCompare {
  /**
   * Create PDF compare instance
   */
  constructor() {
    // PDF.js state
    this.pdfDoc = null;
    this.currentFile = null;
    this.pageCount = 0;
    this.currentPage = 1;
    this.scale = 1.0;
    this.baseScale = 1.0;

    // Rendering state
    this.renderedPages = new Set();
    this.renderingPages = new Set(); // Track pages currently being rendered
    this.pageCanvases = new Map();
    this.isLoading = false;

    // DOM elements (cached)
    this.elements = {};
    this.elementsCached = false;

    // Intersection observer for lazy loading
    this.observer = null;

    // Page indicator timeout
    this.indicatorTimeout = null;

    // Configuration
    this.config = {
      minScale: 0.25,
      maxScale: 4.0,
      scaleStep: 0.25,
      preloadPages: 2, // Pages to preload above/below viewport
    };

    // Bind methods
    this.handleScroll = this.handleScroll.bind(this);
    this.handlePageInput = this.handlePageInput.bind(this);

    logInfo("MathPixMMDPDFCompare initialised");
  }

  /**
   * Initialise the module and cache DOM elements
   */
  init() {
    this.cacheElements();
    this.setupEventListeners();
    this.setupIntersectionObserver();

    // Listen for PDF load events from MMD preview
    document.addEventListener("mmd-pdf-compare-load", (e) => {
      if (e.detail?.file) {
        this.loadPDF(e.detail.file);
      }
    });

    logInfo("PDF Compare module initialised");
  }

  /**
   * Cache DOM element references
   * @private
   */
  cacheElements() {
    this.elements = {
      // Container
      container: document.getElementById("mmd-pdf-container"),
      scrollContainer: document.getElementById("mmd-pdf-scroll-container"),
      pagesContainer: document.getElementById("mmd-pdf-pages"),

      // Controls
      pageInput: document.getElementById("mmd-pdf-page-input"),
      totalPages: document.getElementById("mmd-pdf-total-pages"),
      zoomIn: document.getElementById("mmd-pdf-zoom-in"),
      zoomOut: document.getElementById("mmd-pdf-zoom-out"),
      zoomFit: document.getElementById("mmd-pdf-zoom-fit"),
      zoomLevel: document.getElementById("mmd-pdf-zoom-level"),

      // Page indicator
      pageIndicator: document.getElementById("mmd-pdf-page-indicator"),
      currentPageDisplay: document.getElementById("mmd-pdf-current-page"),
      totalDisplay: document.getElementById("mmd-pdf-total-display"),

      // States
      loading: document.getElementById("mmd-pdf-loading"),
      error: document.getElementById("mmd-pdf-error"),
      errorMessage: document.getElementById("mmd-pdf-error-message"),
    };

    this.elementsCached = true;
    logDebug("PDF Compare elements cached");
  }

  /**
   * Set up event listeners for controls
   * @private
   */
  setupEventListeners() {
    const { zoomIn, zoomOut, zoomFit, pageInput, scrollContainer } =
      this.elements;

    // Zoom controls
    if (zoomIn) {
      zoomIn.addEventListener("click", () => this.zoomIn());
    }
    if (zoomOut) {
      zoomOut.addEventListener("click", () => this.zoomOut());
    }
    if (zoomFit) {
      zoomFit.addEventListener("click", () => this.fitToWidth());
    }

    // Page navigation
    if (pageInput) {
      pageInput.addEventListener("change", this.handlePageInput);
      pageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          this.handlePageInput();
        }
      });
    }

    // Scroll tracking for page indicator
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", this.handleScroll);
    }

    logDebug("Event listeners attached");
  }

  /**
   * Set up Intersection Observer for lazy loading
   * @private
   */
  setupIntersectionObserver() {
    if (!("IntersectionObserver" in window)) {
      logWarn("IntersectionObserver not supported, loading all pages");
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.dataset.page, 10);
            if (!this.renderedPages.has(pageNum)) {
              this.renderPage(pageNum);
            }
          }
        });
      },
      {
        root: this.elements.scrollContainer,
        rootMargin: "200px 0px", // Preload pages 200px before visible
        threshold: 0.01,
      }
    );

    logDebug("Intersection observer created");
  }

  /**
   * Load and display a PDF file
   * @param {File} file - PDF file to load
   * @returns {Promise<void>}
   */
  async loadPDF(file) {
    if (!file || file.type !== "application/pdf") {
      logError("Invalid file provided", { file });
      this.showError("Invalid PDF file");
      return;
    }

    // Check PDF.js availability
    if (typeof window.pdfjsLib === "undefined") {
      logError("PDF.js library not available");
      this.showError("PDF viewer not available. Please refresh the page.");
      return;
    }

    this.showLoading(true);
    this.currentFile = file;

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Load PDF document
      const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
      this.pdfDoc = await loadingTask.promise;
      this.pageCount = this.pdfDoc.numPages;

      logInfo("PDF loaded", {
        name: file.name,
        pages: this.pageCount,
      });

      // Update UI
      this.updatePageCount();

      // Calculate initial scale to fit width
      await this.calculateFitScale();

      // Create page placeholders
      this.createPagePlaceholders();

      // Render initial pages
      await this.renderVisiblePages();

      this.showLoading(false);
    } catch (error) {
      logError("Failed to load PDF", error);
      this.showError(`Failed to load PDF: ${error.message}`);
    }
  }

  /**
   * Calculate scale to fit container width
   * @private
   */
  async calculateFitScale() {
    if (!this.pdfDoc || !this.elements.scrollContainer) return;

    try {
      const page = await this.pdfDoc.getPage(1);
      const viewport = page.getViewport({ scale: 1.0 });

      // Account for padding and scrollbar
      const containerWidth = this.elements.scrollContainer.clientWidth - 40;
      this.baseScale = containerWidth / viewport.width;
      this.scale = this.baseScale;

      this.updateZoomDisplay();

      logDebug("Fit scale calculated", { scale: this.scale });
    } catch (error) {
      logError("Failed to calculate fit scale", error);
    }
  }

  /**
   * Create placeholder elements for all pages
   * @private
   */
  createPagePlaceholders() {
    const { pagesContainer } = this.elements;
    if (!pagesContainer) return;

    // Clear existing pages
    pagesContainer.innerHTML = "";
    this.pageCanvases.clear();
    this.renderedPages.clear();

    for (let i = 1; i <= this.pageCount; i++) {
      const pageWrapper = document.createElement("div");
      pageWrapper.className = "mmd-pdf-page";
      pageWrapper.dataset.page = i;
      pageWrapper.setAttribute("aria-label", `Page ${i} of ${this.pageCount}`);

      // Create canvas for this page
      const canvas = document.createElement("canvas");
      canvas.className = "mmd-pdf-canvas";
      pageWrapper.appendChild(canvas);

      pagesContainer.appendChild(pageWrapper);
      this.pageCanvases.set(i, canvas);

      // Observe for lazy loading
      if (this.observer) {
        this.observer.observe(pageWrapper);
      }
    }

    logDebug("Page placeholders created", { count: this.pageCount });
  }

  /**
   * Render a specific page
   * @param {number} pageNum - Page number to render
   * @returns {Promise<void>}
   */
  async renderPage(pageNum) {
    // Skip if already rendered or currently rendering
    if (
      !this.pdfDoc ||
      this.renderedPages.has(pageNum) ||
      this.renderingPages.has(pageNum)
    ) {
      return;
    }

    const canvas = this.pageCanvases.get(pageNum);
    if (!canvas) return;

    // Mark as rendering to prevent concurrent attempts
    this.renderingPages.add(pageNum);

    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: this.scale });

      // Set canvas dimensions
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Render page
      const context = canvas.getContext("2d");
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      this.renderedPages.add(pageNum);

      logDebug("Page rendered", { pageNum });
    } catch (error) {
      logError("Failed to render page", { pageNum, error });
    } finally {
      // Always remove from rendering set
      this.renderingPages.delete(pageNum);
    }
  }

  /**
   * Render pages currently visible in viewport
   * @private
   */
  async renderVisiblePages() {
    const { scrollContainer, pagesContainer } = this.elements;
    if (!scrollContainer || !pagesContainer) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const pages = pagesContainer.querySelectorAll(".mmd-pdf-page");

    for (const pageEl of pages) {
      const pageRect = pageEl.getBoundingClientRect();
      const pageNum = parseInt(pageEl.dataset.page, 10);

      // Check if page is visible (with preload margin)
      const isVisible =
        pageRect.bottom >= containerRect.top - 200 &&
        pageRect.top <= containerRect.bottom + 200;

      if (isVisible && !this.renderedPages.has(pageNum)) {
        await this.renderPage(pageNum);
      }
    }
  }

  /**
   * Re-render all pages at current scale
   * @private
   */
  async rerenderAllPages() {
    this.renderedPages.clear();

    // Re-render visible pages
    await this.renderVisiblePages();
  }

  /**
   * Zoom in
   */
  zoomIn() {
    const newScale = Math.min(
      this.scale + this.config.scaleStep,
      this.config.maxScale
    );
    if (newScale !== this.scale) {
      this.scale = newScale;
      this.updateZoomDisplay();
      this.rerenderAllPages();
    }
  }

  /**
   * Zoom out
   */
  zoomOut() {
    const newScale = Math.max(
      this.scale - this.config.scaleStep,
      this.config.minScale
    );
    if (newScale !== this.scale) {
      this.scale = newScale;
      this.updateZoomDisplay();
      this.rerenderAllPages();
    }
  }

  /**
   * Fit PDF to container width
   */
  fitToWidth() {
    this.scale = this.baseScale;
    this.updateZoomDisplay();
    this.rerenderAllPages();
  }

  /**
   * Update zoom level display
   * @private
   */
  updateZoomDisplay() {
    if (this.elements.zoomLevel) {
      this.elements.zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
    }
  }

  /**
   * Update page count display
   * @private
   */
  updatePageCount() {
    if (this.elements.totalPages) {
      this.elements.totalPages.textContent = this.pageCount;
    }
    if (this.elements.totalDisplay) {
      this.elements.totalDisplay.textContent = this.pageCount;
    }
    if (this.elements.pageInput) {
      this.elements.pageInput.max = this.pageCount;
    }
  }

  /**
   * Handle scroll event for page indicator
   * @private
   */
  handleScroll() {
    if (!this.elements.scrollContainer) return;

    // Find current visible page
    const pages =
      this.elements.pagesContainer?.querySelectorAll(".mmd-pdf-page");
    if (!pages) return;

    const containerRect = this.elements.scrollContainer.getBoundingClientRect();
    const containerMiddle = containerRect.top + containerRect.height / 2;

    let currentVisiblePage = 1;

    for (const pageEl of pages) {
      const pageRect = pageEl.getBoundingClientRect();
      if (
        pageRect.top <= containerMiddle &&
        pageRect.bottom >= containerMiddle
      ) {
        currentVisiblePage = parseInt(pageEl.dataset.page, 10);
        break;
      }
    }

    // Update current page display
    if (this.currentPage !== currentVisiblePage) {
      this.currentPage = currentVisiblePage;
      this.updateCurrentPageDisplay();
    }

    // Show page indicator briefly
    this.showPageIndicator();

    // Render more pages if needed
    this.renderVisiblePages();
  }

  /**
   * Update current page display
   * @private
   */
  updateCurrentPageDisplay() {
    if (this.elements.currentPageDisplay) {
      this.elements.currentPageDisplay.textContent = this.currentPage;
    }
    if (this.elements.pageInput) {
      this.elements.pageInput.value = this.currentPage;
    }
  }

  /**
   * Show page indicator temporarily
   * @private
   */
  showPageIndicator() {
    if (!this.elements.pageIndicator) return;

    this.elements.pageIndicator.classList.add("visible");

    // Hide after delay
    clearTimeout(this.indicatorTimeout);
    this.indicatorTimeout = setTimeout(() => {
      this.elements.pageIndicator?.classList.remove("visible");
    }, 1500);
  }

  /**
   * Handle page input change
   * @private
   */
  handlePageInput() {
    const { pageInput } = this.elements;
    if (!pageInput) return;

    let pageNum = parseInt(pageInput.value, 10);

    // Validate
    if (isNaN(pageNum) || pageNum < 1) {
      pageNum = 1;
    } else if (pageNum > this.pageCount) {
      pageNum = this.pageCount;
    }

    // Update input
    pageInput.value = pageNum;

    // Scroll to page
    this.scrollToPage(pageNum);
  }

  /**
   * Scroll to a specific page
   * @param {number} pageNum - Page number to scroll to
   */
  scrollToPage(pageNum) {
    const { pagesContainer, scrollContainer } = this.elements;
    if (!pagesContainer || !scrollContainer) return;

    const pageEl = pagesContainer.querySelector(`[data-page="${pageNum}"]`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /**
   * Show loading state
   * @param {boolean} show - Whether to show loading
   * @private
   */
  showLoading(show) {
    this.isLoading = show;

    if (this.elements.loading) {
      this.elements.loading.hidden = !show;
    }
    if (this.elements.error) {
      this.elements.error.hidden = true;
    }
  }

  /**
   * Show error state
   * @param {string} message - Error message
   * @private
   */
  showError(message) {
    this.isLoading = false;

    if (this.elements.loading) {
      this.elements.loading.hidden = true;
    }
    if (this.elements.error) {
      this.elements.error.hidden = false;
    }
    if (this.elements.errorMessage) {
      this.elements.errorMessage.textContent = message;
    }

    logError("PDF error displayed", { message });
  }

  /**
   * Check if PDF is loaded
   * @returns {boolean}
   */
  hasPDF() {
    return !!this.pdfDoc;
  }

  /**
   * Get current file
   * @returns {File|null}
   */
  getCurrentFile() {
    return this.currentFile;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Disconnect observer
    if (this.observer) {
      this.observer.disconnect();
    }

    // Clear timeout
    clearTimeout(this.indicatorTimeout);

    // Clear PDF document
    if (this.pdfDoc) {
      this.pdfDoc.destroy();
      this.pdfDoc = null;
    }

    // Clear state
    this.currentFile = null;
    this.pageCount = 0;
    this.currentPage = 1;
    this.renderedPages.clear();
    this.renderingPages.clear(); // Clear rendering tracking
    this.pageCanvases.clear();

    // Clear pages container
    if (this.elements.pagesContainer) {
      this.elements.pagesContainer.innerHTML = "";
    }

    logInfo("PDF Compare cleanup complete");
  }
}

// Create singleton instance
let pdfCompareInstance = null;

/**
 * Get or create PDF compare instance
 * @returns {MathPixMMDPDFCompare}
 */
function getMathPixPDFCompare() {
  if (!pdfCompareInstance) {
    pdfCompareInstance = new MathPixMMDPDFCompare();
    pdfCompareInstance.init();
  }
  return pdfCompareInstance;
}

// Global exposure
window.MathPixMMDPDFCompare = MathPixMMDPDFCompare;
window.getMathPixPDFCompare = getMathPixPDFCompare;

// ============================================================================
// PDF Compare Module Tests
// ============================================================================

/**
 * Test PDF Compare module initialisation
 * Run with: await testPDFCompareModule()
 */
window.testPDFCompareModule = async () => {
  console.log("🧪 PDF Compare Module Tests");
  console.log("===========================\n");

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
  };

  const test = (name, condition) => {
    results.total++;
    if (condition) {
      results.passed++;
      console.log(`✅ ${name}`);
    } else {
      results.failed++;
      results.errors.push(name);
      console.log(`❌ ${name}`);
    }
  };

  // Test 1: Class exists
  test(
    "MathPixMMDPDFCompare class exists",
    typeof MathPixMMDPDFCompare === "function"
  );

  // Test 2: getMathPixPDFCompare function exists
  test(
    "getMathPixPDFCompare function exists",
    typeof getMathPixPDFCompare === "function"
  );

  // Test 3: Can create instance
  const pdfCompare = getMathPixPDFCompare();
  test("Can create PDF compare instance", !!pdfCompare);

  // Test 4: Elements cached
  test("Elements cached", pdfCompare.elementsCached === true);

  // Test 5: PDF container element cached
  test("PDF container cached", !!pdfCompare.elements.container);

  // Test 6: Zoom controls cached
  test("Zoom in button cached", !!pdfCompare.elements.zoomIn);
  test("Zoom out button cached", !!pdfCompare.elements.zoomOut);
  test("Zoom fit button cached", !!pdfCompare.elements.zoomFit);

  // Test 7: Page controls cached
  test("Page input cached", !!pdfCompare.elements.pageInput);
  test("Total pages element cached", !!pdfCompare.elements.totalPages);

  // Test 8: hasPDF returns false initially
  test("hasPDF returns false initially", pdfCompare.hasPDF() === false);

  // Test 9: getCurrentFile returns null initially
  test(
    "getCurrentFile returns null initially",
    pdfCompare.getCurrentFile() === null
  );

  // Test 10: Zoom methods exist
  test("zoomIn method exists", typeof pdfCompare.zoomIn === "function");
  test("zoomOut method exists", typeof pdfCompare.zoomOut === "function");
  test("fitToWidth method exists", typeof pdfCompare.fitToWidth === "function");

  // Test 11: Cleanup method exists
  test("cleanup method exists", typeof pdfCompare.cleanup === "function");

  // Summary
  console.log("\n===========================");
  console.log(`📊 Results: ${results.passed}/${results.total} tests passed`);

  if (results.failed === 0) {
    console.log("✅ PDF Compare Module COMPLETE");
  } else {
    console.error(`❌ ${results.failed} tests failed:`);
    results.errors.forEach((e) => console.error(`   - ${e}`));
  }

  return results;
};
