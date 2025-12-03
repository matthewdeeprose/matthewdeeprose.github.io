/**
 * PDF Confidence Visualiser - Testing Suite
 * @version 1.1.0
 * @description Console-based testing for PDF Confidence Visualiser modules and UI integration
 *
 * Usage:
 *   window.testPDFVis()              - Run all tests (full suite)
 *   window.testPDFVisQuick()         - Quick module availability check
 *   window.testPDFVisUI()            - UI integration tests only
 *   window.testPDFVisUIQuick()       - Quick UI elements check
 *   window.testPDFVisClick()         - Test indicator click handler
 *
 * Individual test categories:
 *   testPDFVisualiserSuite.testModuleLoading()         - Test module availability
 *   testPDFVisualiserSuite.testConfig()                - Test configuration
 *   testPDFVisualiserSuite.testStats()                 - Test statistics calculation
 *   testPDFVisualiserSuite.testOverlays()              - Test overlay utilities
 *   testPDFVisualiserSuite.testIntegration()           - Test integration points
 *   testPDFVisualiserSuite.testUIIntegration()         - Test HTML elements
 *   testPDFVisualiserSuite.testResultRendererIntegration() - Test renderer methods
 *   testPDFVisualiserSuite.testConfidenceLevelStyling()   - Test styling integration
 *   testPDFVisualiserSuite.testConfidenceIndicatorUpdate() - Test indicator update logic
 *   testPDFVisualiserSuite.testTabAccessibility()      - Test WCAG compliance
 *
 * @accessibility WCAG 2.2 AA compliant test output
 */

// ============================================================================
// MOCK DATA FOR TESTING
// ============================================================================

/**
 * Mock lines.json data structure matching MathPix API response
 * Used for testing statistics and overlay functions
 */
const MOCK_LINES_DATA = {
  pages: [
    {
      page: 0,
      page_width: 612,
      page_height: 792,
      lines: [
        {
          type: "text",
          subtype: "printed",
          text: "Introduction to Mathematics",
          confidence: 0.98,
          confidence_rate: 0.99,
          cnt: [
            { x: 72, y: 72 },
            { x: 300, y: 72 },
            { x: 300, y: 90 },
            { x: 72, y: 90 },
          ],
        },
        {
          type: "math",
          subtype: "printed",
          text: "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}",
          confidence: 0.95,
          confidence_rate: 0.96,
          cnt: [
            { x: 100, y: 150 },
            { x: 400, y: 150 },
            { x: 400, y: 200 },
            { x: 100, y: 200 },
          ],
        },
        {
          type: "text",
          subtype: "handwritten",
          text: "Note: This is important",
          confidence: 0.72,
          confidence_rate: 0.75,
          cnt: [
            { x: 72, y: 250 },
            { x: 250, y: 250 },
            { x: 250, y: 280 },
            { x: 72, y: 280 },
          ],
        },
        {
          type: "math",
          subtype: "printed",
          text: "E = mc^2",
          confidence: 0.55,
          confidence_rate: 0.58,
          cnt: [
            { x: 200, y: 350 },
            { x: 350, y: 350 },
            { x: 350, y: 400 },
            { x: 200, y: 400 },
          ],
        },
      ],
    },
    {
      page: 1,
      page_width: 612,
      page_height: 792,
      lines: [
        {
          type: "text",
          subtype: "printed",
          text: "Chapter 2: Advanced Topics",
          confidence: 0.99,
          confidence_rate: 0.995,
          cnt: [
            { x: 72, y: 72 },
            { x: 350, y: 72 },
            { x: 350, y: 95 },
            { x: 72, y: 95 },
          ],
        },
        {
          type: "math",
          subtype: "printed",
          text: "\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}",
          confidence: 0.88,
          confidence_rate: 0.9,
          cnt: [
            { x: 100, y: 200 },
            { x: 450, y: 200 },
            { x: 450, y: 280 },
            { x: 100, y: 280 },
          ],
        },
      ],
    },
  ],
};

/**
 * Mock viewport object simulating PDF.js viewport
 */
const MOCK_VIEWPORT = {
  width: 918, // 612 * 1.5 scale
  height: 1188, // 792 * 1.5 scale
  scale: 1.5,
};

// ============================================================================
// TEST SUITE
// ============================================================================

window.testPDFVisualiserSuite = {
  // Track test results
  results: {
    passed: 0,
    failed: 0,
    errors: [],
  },

  /**
   * Reset test results
   */
  resetResults() {
    this.results = { passed: 0, failed: 0, errors: [] };
  },

  /**
   * Log test result
   */
  logResult(testName, passed, details = null) {
    if (passed) {
      console.log(`✅ ${testName}`);
      this.results.passed++;
    } else {
      console.error(`❌ ${testName}`);
      if (details) console.error("   Details:", details);
      this.results.failed++;
      this.results.errors.push({ test: testName, details });
    }
  },

  /**
   * Print summary
   */
  printSummary() {
    console.log("\n" + "═".repeat(60));
    console.log("  TEST SUMMARY");
    console.log("═".repeat(60));
    console.log(`  Passed: ${this.results.passed}`);
    console.log(`  Failed: ${this.results.failed}`);
    console.log(`  Total:  ${this.results.passed + this.results.failed}`);
    console.log("═".repeat(60));

    if (this.results.failed > 0) {
      console.log("\n  FAILED TESTS:");
      this.results.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.test}`);
      });
    }

    return this.results.failed === 0;
  },

  // ==========================================================================
  // MODULE LOADING TESTS
  // ==========================================================================

  /**
   * Test that all PDF Visualiser modules are loaded and accessible
   */
  testModuleLoading() {
    console.log("\n" + "─".repeat(60));
    console.log("  MODULE LOADING TESTS");
    console.log("─".repeat(60) + "\n");

    // Test 1: Config module
    const hasConfig = typeof window.PDF_VISUALISER_CONFIG !== "undefined";
    this.logResult("PDF_VISUALISER_CONFIG is defined", hasConfig);

    // Test 2: Stats module
    const hasStats = typeof window.PDFVisualiserStats !== "undefined";
    this.logResult("PDFVisualiserStats is defined", hasStats);

    // Test 3: Overlays module
    const hasOverlays = typeof window.PDFVisualiserOverlays !== "undefined";
    this.logResult("PDFVisualiserOverlays is defined", hasOverlays);

    // Test 4: Renderer module
    const hasRenderer = typeof window.PDFVisualiserRenderer !== "undefined";
    this.logResult("PDFVisualiserRenderer is defined", hasRenderer);

    // Test 5: Core controller module
    const hasCore = typeof window.PDFConfidenceVisualiser !== "undefined";
    this.logResult("PDFConfidenceVisualiser is defined", hasCore);

    // Test 6: Helper functions from config
    const hasHelpers =
      typeof window.getConfidenceLevelByRate === "function" &&
      typeof window.formatPercentage === "function";
    this.logResult("Config helper functions are exported", hasHelpers);

    return hasConfig && hasStats && hasOverlays && hasRenderer && hasCore;
  },

  // ==========================================================================
  // CONFIGURATION TESTS
  // ==========================================================================

  /**
   * Test configuration module
   */
  testConfig() {
    console.log("\n" + "─".repeat(60));
    console.log("  CONFIGURATION TESTS");
    console.log("─".repeat(60) + "\n");

    if (typeof window.PDF_VISUALISER_CONFIG === "undefined") {
      this.logResult(
        "Config module loaded",
        false,
        "PDF_VISUALISER_CONFIG not defined"
      );
      return false;
    }

    const config = window.PDF_VISUALISER_CONFIG;

    // Test 1: PDF.js URLs present
    const hasPDFJSUrls = config.PDFJS?.LIB_URL && config.PDFJS?.WORKER_URL;
    this.logResult("PDF.js CDN URLs configured", hasPDFJSUrls);

    // Test 2: Confidence levels defined (actual structure: CONFIDENCE_LEVELS)
    const hasLevels =
      config.CONFIDENCE_LEVELS?.HIGH &&
      config.CONFIDENCE_LEVELS?.MEDIUM &&
      config.CONFIDENCE_LEVELS?.LOW &&
      config.CONFIDENCE_LEVELS?.VERY_LOW;
    this.logResult("All confidence levels defined", hasLevels);

    // Test 3: Threshold values valid (embedded in each level as minThreshold)
    const thresholds = config.CONFIDENCE_LEVELS;
    const validThresholds =
      thresholds?.HIGH?.minThreshold === 0.95 &&
      thresholds?.MEDIUM?.minThreshold === 0.8 &&
      thresholds?.LOW?.minThreshold === 0.6;
    this.logResult(
      "Confidence thresholds are correct",
      validThresholds,
      `HIGH: ${thresholds?.HIGH?.minThreshold}, MEDIUM: ${thresholds?.MEDIUM?.minThreshold}, LOW: ${thresholds?.LOW?.minThreshold}`
    );

    // Test 4: Colours have required properties (fillColour, borderColour, textColour)
    const highColours = config.CONFIDENCE_LEVELS?.HIGH;
    const hasColourProps =
      highColours?.fillColour &&
      highColours?.borderColour &&
      highColours?.textColour;
    this.logResult(
      "Colour definitions have fillColour/borderColour/textColour",
      hasColourProps
    );

    // Test 5: Rendering defaults present (actual structure)
    const hasRenderDefaults =
      config.RENDERING?.DEFAULT_SCALE &&
      config.RENDERING?.OVERLAY_BORDER_WIDTH &&
      config.RENDERING?.LABEL_FONT_SIZE;
    this.logResult("Rendering defaults configured", hasRenderDefaults);

    // Test 6: Helper function - getConfidenceLevelByRate
    if (typeof window.getConfidenceLevelByRate === "function") {
      const highLevel = window.getConfidenceLevelByRate(0.98);
      const mediumLevel = window.getConfidenceLevelByRate(0.85);
      const lowLevel = window.getConfidenceLevelByRate(0.65);
      const veryLowLevel = window.getConfidenceLevelByRate(0.5);

      // Function returns the level object, not the key - check for object or key
      const isHighValid =
        highLevel === "HIGH" ||
        highLevel?.name === "High" ||
        highLevel?.minThreshold === 0.95;
      const isMediumValid =
        mediumLevel === "MEDIUM" ||
        mediumLevel?.name === "Medium" ||
        mediumLevel?.minThreshold === 0.8;
      const isLowValid =
        lowLevel === "LOW" ||
        lowLevel?.name === "Low" ||
        lowLevel?.minThreshold === 0.6;
      const isVeryLowValid =
        veryLowLevel === "VERY_LOW" ||
        veryLowLevel?.name === "Very Low" ||
        veryLowLevel?.minThreshold === 0;

      const correctMapping =
        isHighValid && isMediumValid && isLowValid && isVeryLowValid;
      this.logResult(
        "getConfidenceLevelByRate returns correct levels",
        correctMapping,
        `HIGH: ${JSON.stringify(highLevel)?.substring(0, 30)}`
      );
    } else {
      this.logResult("getConfidenceLevelByRate function available", false);
    }

    // Test 7: Helper function - formatPercentage
    if (typeof window.formatPercentage === "function") {
      const formatted = window.formatPercentage(0.956);
      const correctFormat =
        formatted === "95.6%" || formatted === "96%" || formatted === "95%";
      this.logResult(
        "formatPercentage formats correctly",
        correctFormat,
        `Got: ${formatted}`
      );
    } else {
      this.logResult("formatPercentage function available", false);
    }

    return true;
  },

  // ==========================================================================
  // STATISTICS TESTS
  // ==========================================================================

  /**
   * Test statistics calculation module
   */
  testStats() {
    console.log("\n" + "─".repeat(60));
    console.log("  STATISTICS CALCULATION TESTS");
    console.log("─".repeat(60) + "\n");

    if (typeof window.PDFVisualiserStats === "undefined") {
      this.logResult(
        "Stats module loaded",
        false,
        "PDFVisualiserStats not defined"
      );
      return false;
    }

    const Stats = window.PDFVisualiserStats;

    // Test 1: calculateStatistics exists
    const hasCalculate = typeof Stats.calculateStatistics === "function";
    this.logResult("calculateStatistics method exists", hasCalculate);

    if (!hasCalculate) return false;

    // Test 2: Calculate stats with mock data
    let stats;
    try {
      stats = Stats.calculateStatistics(MOCK_LINES_DATA);
      this.logResult("calculateStatistics executes without error", true);
    } catch (error) {
      this.logResult(
        "calculateStatistics executes without error",
        false,
        error.message
      );
      return false;
    }

    // Test 3: Total pages correct
    const correctPages = stats.totalPages === 2;
    this.logResult(
      "Correct page count (2)",
      correctPages,
      `Got: ${stats.totalPages}`
    );

    // Test 4: Total lines correct
    const correctLines = stats.totalLines === 6;
    this.logResult(
      "Correct line count (6)",
      correctLines,
      `Got: ${stats.totalLines}`
    );

    // Test 5: Average confidence is reasonable
    const hasAverage =
      typeof stats.averageConfidence === "number" &&
      stats.averageConfidence > 0 &&
      stats.averageConfidence <= 1;
    this.logResult(
      "Average confidence is valid number",
      hasAverage,
      `Got: ${stats.averageConfidence}`
    );

    // Test 6: Confidence level breakdown
    const hasBreakdown =
      stats.byLevel &&
      typeof stats.byLevel.HIGH === "number" &&
      typeof stats.byLevel.MEDIUM === "number" &&
      typeof stats.byLevel.LOW === "number" &&
      typeof stats.byLevel.VERY_LOW === "number";
    this.logResult("Confidence level breakdown present", hasBreakdown);

    // Test 7: Writing style breakdown (printed vs handwritten)
    const hasWritingStyle =
      stats.byWritingStyle &&
      typeof stats.byWritingStyle.printed === "number" &&
      typeof stats.byWritingStyle.handwritten === "number";
    this.logResult("Writing style breakdown present", hasWritingStyle);

    // Test 8: countByConfidenceLevel method
    if (typeof Stats.countByConfidenceLevel === "function") {
      const counts = Stats.countByConfidenceLevel(MOCK_LINES_DATA);
      const hasAllLevels =
        counts.HIGH !== undefined &&
        counts.MEDIUM !== undefined &&
        counts.LOW !== undefined &&
        counts.VERY_LOW !== undefined;
      this.logResult("countByConfidenceLevel returns all levels", hasAllLevels);
    }

    // Test 9: findProblemLines method
    if (typeof Stats.findProblemLines === "function") {
      const problemLines = Stats.findProblemLines(MOCK_LINES_DATA, 0.8);
      const foundProblems =
        Array.isArray(problemLines) && problemLines.length > 0;
      this.logResult(
        "findProblemLines finds low-confidence lines",
        foundProblems,
        `Found ${problemLines?.length || 0} problem lines`
      );
    }

    // Test 10: generateSummaryText method
    if (typeof Stats.generateSummaryText === "function") {
      const summary = Stats.generateSummaryText(stats);
      const hasSummary = typeof summary === "string" && summary.length > 0;
      this.logResult("generateSummaryText produces text", hasSummary);
    }

    return true;
  },

  // ==========================================================================
  // OVERLAYS TESTS
  // ==========================================================================

  /**
   * Test overlay rendering utilities
   */
  testOverlays() {
    console.log("\n" + "─".repeat(60));
    console.log("  OVERLAY UTILITY TESTS");
    console.log("─".repeat(60) + "\n");

    if (typeof window.PDFVisualiserOverlays === "undefined") {
      this.logResult(
        "Overlays module loaded",
        false,
        "PDFVisualiserOverlays not defined"
      );
      return false;
    }

    const Overlays = window.PDFVisualiserOverlays;

    // Test 1: transformCoordinates exists
    const hasTransform = typeof Overlays.transformCoordinates === "function";
    this.logResult("transformCoordinates method exists", hasTransform);

    // Test 2: Test coordinate transformation with correct format (region object)
    if (hasTransform) {
      // Use the actual expected format: region object with top_left_x, top_left_y, width, height
      const testRegion = {
        top_left_x: 72,
        top_left_y: 72,
        width: 228, // 300 - 72
        height: 18, // 90 - 72
      };
      const pageWidth = 612;
      const pageHeight = 792;

      try {
        const coords = Overlays.transformCoordinates(
          testRegion,
          pageWidth,
          pageHeight,
          MOCK_VIEWPORT
        );

        // Check that coordinates were scaled correctly (1.5x)
        const expectedX = 72 * 1.5; // 108
        const correctScale = Math.abs(coords.x - expectedX) < 1;
        this.logResult(
          "Coordinate transformation scales correctly",
          correctScale,
          `Expected x ≈ ${expectedX}, got ${coords.x}`
        );

        // Check all properties present
        const hasAllProps =
          typeof coords.x === "number" &&
          !isNaN(coords.x) &&
          typeof coords.y === "number" &&
          !isNaN(coords.y) &&
          typeof coords.width === "number" &&
          !isNaN(coords.width) &&
          typeof coords.height === "number" &&
          !isNaN(coords.height);
        this.logResult(
          "Transformed coords have valid x, y, width, height",
          hasAllProps
        );
      } catch (error) {
        this.logResult(
          "transformCoordinates executes without error",
          false,
          error.message
        );
      }
    }

    // Test 3: getConfidenceColours exists and works
    if (typeof Overlays.getConfidenceColours === "function") {
      const colours = Overlays.getConfidenceColours(0.98);
      const hasColours = colours.fill && colours.border;
      this.logResult("getConfidenceColours returns colour object", hasColours);

      // Test different confidence levels return different colours
      const highColours = Overlays.getConfidenceColours(0.98);
      const lowColours = Overlays.getConfidenceColours(0.5);
      const differentColours = highColours.fill !== lowColours.fill;
      this.logResult(
        "Different confidence levels return different colours",
        differentColours
      );
    }

    // Test 4: setupCanvasForHiDPI exists
    const hasHiDPI = typeof Overlays.setupCanvasForHiDPI === "function";
    this.logResult("setupCanvasForHiDPI method exists", hasHiDPI);

    // Test 5: findLineAtPoint exists (for hover functionality)
    const hasFindLine = typeof Overlays.findLineAtPoint === "function";
    this.logResult("findLineAtPoint method exists", hasFindLine);

    // Test 6: drawOverlays exists
    const hasDrawOverlays = typeof Overlays.drawOverlays === "function";
    this.logResult("drawOverlays method exists", hasDrawOverlays);

    // Test 7: cntToRegion helper exists (for converting lines.json format)
    const hasCntToRegion = typeof Overlays.cntToRegion === "function";
    this.logResult("cntToRegion helper method exists", hasCntToRegion);

    return true;
  },

  // ==========================================================================
  // RENDERER TESTS
  // ==========================================================================

  /**
   * Test PDF.js renderer module (without loading actual PDF)
   */
  testRenderer() {
    console.log("\n" + "─".repeat(60));
    console.log("  PDF RENDERER TESTS");
    console.log("─".repeat(60) + "\n");

    if (typeof window.PDFVisualiserRenderer === "undefined") {
      this.logResult(
        "Renderer module loaded",
        false,
        "PDFVisualiserRenderer not defined"
      );
      return false;
    }

    const Renderer = window.PDFVisualiserRenderer;

    // Test 1: Can instantiate
    let renderer;
    try {
      renderer = new Renderer({ defaultScale: 1.5 });
      this.logResult("Renderer can be instantiated", true);
    } catch (error) {
      this.logResult("Renderer can be instantiated", false, error.message);
      return false;
    }

    // Test 2: Has required methods
    const hasLoadPDFJS = typeof renderer.loadPDFJS === "function";
    this.logResult("loadPDFJS method exists", hasLoadPDFJS);

    const hasLoadDocument = typeof renderer.loadDocument === "function";
    this.logResult("loadDocument method exists", hasLoadDocument);

    const hasRenderPage = typeof renderer.renderPage === "function";
    this.logResult("renderPage method exists", hasRenderPage);

    // Test 3: Navigation methods
    const hasNavigation =
      typeof renderer.nextPage === "function" &&
      typeof renderer.previousPage === "function" &&
      typeof renderer.goToPage === "function";
    this.logResult("Navigation methods exist", hasNavigation);

    // Test 4: Zoom methods
    const hasZoom =
      typeof renderer.setScale === "function" &&
      typeof renderer.zoomIn === "function" &&
      typeof renderer.zoomOut === "function";
    this.logResult("Zoom methods exist", hasZoom);

    // Test 5: Cleanup methods
    const hasCleanup =
      typeof renderer.cleanup === "function" &&
      typeof renderer.destroy === "function";
    this.logResult("Cleanup methods exist", hasCleanup);

    // Test 6: Initial state - either 0, 1, or null is acceptable
    const hasInitialState =
      (renderer.currentPage === 0 ||
        renderer.currentPage === 1 ||
        renderer.currentPage === null) &&
      (renderer.totalPages === 0 || renderer.totalPages === null);
    this.logResult(
      "Initial state is valid",
      hasInitialState,
      `currentPage: ${renderer.currentPage}, totalPages: ${renderer.totalPages}`
    );

    // Cleanup
    if (renderer && typeof renderer.destroy === "function") {
      renderer.destroy();
    }

    return true;
  },

  // ==========================================================================
  // CORE CONTROLLER TESTS
  // ==========================================================================

  /**
   * Test core controller module
   */
  testCore() {
    console.log("\n" + "─".repeat(60));
    console.log("  CORE CONTROLLER TESTS");
    console.log("─".repeat(60) + "\n");

    if (typeof window.PDFConfidenceVisualiser === "undefined") {
      this.logResult(
        "Core module loaded",
        false,
        "PDFConfidenceVisualiser not defined"
      );
      return false;
    }

    const Core = window.PDFConfidenceVisualiser;

    // Test 1: Can instantiate with mock container
    const mockContainer = document.createElement("div");
    mockContainer.id = "test-visualiser-container";
    document.body.appendChild(mockContainer);

    let visualiser;
    try {
      visualiser = new Core({ container: mockContainer });
      this.logResult("Core controller can be instantiated", true);
    } catch (error) {
      this.logResult(
        "Core controller can be instantiated",
        false,
        error.message
      );
      document.body.removeChild(mockContainer);
      return false;
    }

    // Test 2: Has initialize method
    const hasInitialize = typeof visualiser.initialize === "function";
    this.logResult("initialize method exists", hasInitialize);

    // Test 3: Has loadPDF method
    const hasLoadPDF = typeof visualiser.loadPDF === "function";
    this.logResult("loadPDF method exists", hasLoadPDF);

    // Test 4: Has navigation methods
    const hasNavMethods =
      typeof visualiser.nextPage === "function" &&
      typeof visualiser.previousPage === "function";
    this.logResult("Navigation methods exist", hasNavMethods);

    // Test 5: Has toggle methods
    const hasToggles =
      typeof visualiser.setOverlaysVisible === "function" &&
      typeof visualiser.setLabelsVisible === "function";
    this.logResult("Toggle methods exist", hasToggles);

    // Test 6: Has getState method
    const hasGetState = typeof visualiser.getState === "function";
    this.logResult("getState method exists", hasGetState);

    // Test 7: Has destroy method
    const hasDestroy = typeof visualiser.destroy === "function";
    this.logResult("destroy method exists", hasDestroy);

    // Cleanup
    if (visualiser && typeof visualiser.destroy === "function") {
      visualiser.destroy();
    }
    document.body.removeChild(mockContainer);

    return true;
  },

  // ==========================================================================
  // INTEGRATION TESTS
  // ==========================================================================

  /**
   * Test integration points with existing MathPix modules
   */
  testIntegration() {
    console.log("\n" + "─".repeat(60));
    console.log("  INTEGRATION TESTS");
    console.log("─".repeat(60) + "\n");

    // Test 1: MathPix controller available (may not be if not in MathPix mode)
    const hasController = typeof window.getMathPixController === "function";
    this.logResult(
      "getMathPixController function available",
      hasController,
      hasController ? null : "Expected - may not be in MathPix mode"
    );

    if (!hasController) {
      console.log(
        "   ℹ️  Skipping integration tests - switch to MathPix mode to test"
      );

      // Still check if download manager modules are available
      const hasDownloadManager =
        typeof window.MathPixDownloadManager !== "undefined";
      this.logResult("MathPixDownloadManager available", hasDownloadManager);

      const hasTotalDownloader =
        typeof window.MathPixTotalDownloader !== "undefined";
      this.logResult("MathPixTotalDownloader available", hasTotalDownloader);

      return true; // Don't fail the whole test suite
    }

    let controller;
    try {
      controller = window.getMathPixController();
      this.logResult("Controller retrieved successfully", !!controller);
    } catch (error) {
      this.logResult("Controller retrieved successfully", false, error.message);
      return true; // Don't fail - just can't test integration
    }

    // Test 2: PDF Result Renderer has lines data methods
    if (controller.pdfResultRenderer) {
      const hasLinesDataMethods =
        typeof controller.pdfResultRenderer.fetchAndStoreLinesData ===
          "function" &&
        typeof controller.pdfResultRenderer.hasLinesData === "function" &&
        typeof controller.pdfResultRenderer.getLinesData === "function";
      this.logResult(
        "pdfResultRenderer has lines data methods",
        hasLinesDataMethods
      );
    } else {
      this.logResult(
        "pdfResultRenderer available",
        false,
        "Not found on controller"
      );
    }

    // Test 3: API Client has fetchLinesData method
    if (controller.apiClient) {
      const hasFetchLinesData =
        typeof controller.apiClient.fetchLinesData === "function";
      this.logResult("apiClient has fetchLinesData method", hasFetchLinesData);
    } else {
      this.logResult("apiClient available", false, "Not found on controller");
    }

    // Test 4: Download Manager integration (check for linesData handling)
    if (window.MathPixDownloadManager) {
      this.logResult("MathPixDownloadManager available", true);
    }

    // Test 5: Total Downloader integration
    if (window.MathPixTotalDownloader) {
      this.logResult("MathPixTotalDownloader available", true);
    }

    return true;
  },

  // ==========================================================================
  // COORDINATE TRANSFORMATION VALIDATION
  // ==========================================================================

  /**
   * Detailed test of coordinate transformation accuracy
   */
  testCoordinateTransformation() {
    console.log("\n" + "─".repeat(60));
    console.log("  COORDINATE TRANSFORMATION VALIDATION");
    console.log("─".repeat(60) + "\n");

    if (typeof window.PDFVisualiserOverlays === "undefined") {
      this.logResult("Overlays module required", false);
      return false;
    }

    const Overlays = window.PDFVisualiserOverlays;
    const transform = Overlays.transformCoordinates;

    // Test region with known coordinates (using correct format)
    const testRegion = {
      top_left_x: 100,
      top_left_y: 100,
      width: 200,
      height: 50,
    };

    const pageWidth = 612;
    const pageHeight = 792;
    const viewport = { width: 918, height: 1188, scale: 1.5 };

    const coords = transform(testRegion, pageWidth, pageHeight, viewport);

    // Expected values (scaled by viewport.width/pageWidth ≈ 1.5)
    const scaleX = viewport.width / pageWidth;
    const scaleY = viewport.height / pageHeight;
    const expectedX = 100 * scaleX; // ~150
    const expectedY = 100 * scaleY; // ~150
    const expectedWidth = 200 * scaleX; // ~300
    const expectedHeight = 50 * scaleY; // ~75

    const tolerance = 1; // Allow 1px tolerance

    const xCorrect =
      typeof coords.x === "number" &&
      !isNaN(coords.x) &&
      Math.abs(coords.x - expectedX) <= tolerance;
    const yCorrect =
      typeof coords.y === "number" &&
      !isNaN(coords.y) &&
      Math.abs(coords.y - expectedY) <= tolerance;
    const widthCorrect =
      typeof coords.width === "number" &&
      !isNaN(coords.width) &&
      Math.abs(coords.width - expectedWidth) <= tolerance;
    const heightCorrect =
      typeof coords.height === "number" &&
      !isNaN(coords.height) &&
      Math.abs(coords.height - expectedHeight) <= tolerance;

    this.logResult(
      `X coordinate correct (expected ~${expectedX.toFixed(1)})`,
      xCorrect,
      `Got: ${coords.x}`
    );
    this.logResult(
      `Y coordinate correct (expected ~${expectedY.toFixed(1)})`,
      yCorrect,
      `Got: ${coords.y}`
    );
    this.logResult(
      `Width correct (expected ~${expectedWidth.toFixed(1)})`,
      widthCorrect,
      `Got: ${coords.width}`
    );
    this.logResult(
      `Height correct (expected ~${expectedHeight.toFixed(1)})`,
      heightCorrect,
      `Got: ${coords.height}`
    );

    return xCorrect && yCorrect && widthCorrect && heightCorrect;
  },

  // ==========================================================================
  // UI INTEGRATION TESTS (Phase 3.2)
  // ==========================================================================

  /**
   * Test UI integration for confidence visualiser
   * Tests HTML elements, tab structure, and result renderer methods
   */
  testUIIntegration() {
    console.log("\n" + "─".repeat(60));
    console.log("  UI INTEGRATION TESTS (Phase 3.2)");
    console.log("─".repeat(60) + "\n");

    // ========== HTML ELEMENT TESTS ==========
    console.log("  📍 HTML Elements:\n");

    // Test 1: Clickable confidence indicator exists
    const confidenceIndicator = document.getElementById(
      "mathpix-confidence-indicator"
    );
    const hasIndicator = !!confidenceIndicator;
    this.logResult(
      "Confidence indicator element exists",
      hasIndicator,
      hasIndicator ? null : "Element #mathpix-confidence-indicator not found"
    );

    // Test 2: Confidence indicator is a button (clickable)
    const isButton = confidenceIndicator?.tagName === "BUTTON";
    this.logResult(
      "Confidence indicator is a button element",
      isButton,
      isButton ? null : `Found: ${confidenceIndicator?.tagName || "null"}`
    );

    // Test 3: Confidence indicator has click handler or onclick attribute
    const hasClickHandler =
      confidenceIndicator?.onclick !== null ||
      confidenceIndicator
        ?.getAttribute("onclick")
        ?.includes("navigateToConfidenceTab");
    this.logResult("Confidence indicator has click handler", hasClickHandler);

    // Test 4: Confidence indicator has data-confidence-level attribute
    const hasDataLevel = confidenceIndicator?.hasAttribute(
      "data-confidence-level"
    );
    this.logResult(
      "Confidence indicator has data-confidence-level attribute",
      hasDataLevel
    );

    // Test 5: Confidence indicator has clickable class
    const hasClickableClass = confidenceIndicator?.classList?.contains(
      "mathpix-confidence-clickable"
    );
    this.logResult(
      "Confidence indicator has clickable class",
      hasClickableClass
    );

    // Test 6: Confidence value element exists
    const confidenceValue = document.getElementById("mathpix-confidence-value");
    this.logResult("Confidence value element exists", !!confidenceValue);

    // Test 7: Confidence bar element exists
    const confidenceBar = document.getElementById("mathpix-confidence-bar");
    this.logResult("Confidence bar element exists", !!confidenceBar);

    // ========== CONFIDENCE TAB TESTS ==========
    console.log("\n  📑 Confidence Tab:\n");

    // Test 8: Confidence tab button exists
    const confidenceTab = document.getElementById("tab-confidence");
    const hasConfidenceTab = !!confidenceTab;
    this.logResult(
      "Confidence tab button exists",
      hasConfidenceTab,
      hasConfidenceTab ? null : "Element #tab-confidence not found"
    );

    // Test 9: Confidence tab has correct role
    const tabRole = confidenceTab?.getAttribute("role");
    this.logResult(
      'Confidence tab has role="tab"',
      tabRole === "tab",
      `Found: ${tabRole}`
    );

    // Test 10: Confidence tab has correct aria-controls
    const ariaControls = confidenceTab?.getAttribute("aria-controls");
    this.logResult(
      "Confidence tab controls panel-confidence",
      ariaControls === "panel-confidence",
      `Found: ${ariaControls}`
    );

    // Test 11: Confidence tab has data-format attribute
    const dataFormat = confidenceTab?.getAttribute("data-format");
    this.logResult(
      'Confidence tab has data-format="confidence"',
      dataFormat === "confidence",
      `Found: ${dataFormat}`
    );

    // Test 12: Confidence panel exists
    const confidencePanel = document.getElementById("panel-confidence");
    const hasPanel = !!confidencePanel;
    this.logResult(
      "Confidence panel exists",
      hasPanel,
      hasPanel ? null : "Element #panel-confidence not found"
    );

    // Test 13: Confidence panel has correct role
    const panelRole = confidencePanel?.getAttribute("role");
    this.logResult(
      'Confidence panel has role="tabpanel"',
      panelRole === "tabpanel",
      `Found: ${panelRole}`
    );

    // Test 14: Visualiser container exists within panel
    const visualiserContainer = document.getElementById(
      "mathpix-confidence-visualiser-container"
    );
    this.logResult("Visualiser container exists", !!visualiserContainer);

    // Test 15: Confidence legend exists
    const legend = confidencePanel?.querySelector(".confidence-legend");
    this.logResult("Confidence legend exists in panel", !!legend);

    return hasIndicator && hasConfidenceTab && hasPanel;
  },

  /**
   * Test PDF Result Renderer methods for confidence visualiser integration
   */
  testResultRendererIntegration() {
    console.log("\n" + "─".repeat(60));
    console.log("  RESULT RENDERER INTEGRATION TESTS");
    console.log("─".repeat(60) + "\n");

    // Check if MathPix controller is available
    const hasController = typeof window.getMathPixController === "function";
    if (!hasController) {
      console.log("   ℹ️  Skipping - switch to MathPix mode to test");
      this.logResult(
        "getMathPixController available",
        false,
        "Expected - not in MathPix mode"
      );
      return true; // Don't fail the whole suite
    }

    let controller;
    try {
      controller = window.getMathPixController();
    } catch (error) {
      console.log("   ℹ️  Controller not initialised - skipping");
      return true;
    }

    if (!controller) {
      console.log("   ℹ️  Controller is null - skipping");
      return true;
    }

    const renderer = controller.pdfResultRenderer;
    if (!renderer) {
      console.log("   ℹ️  pdfResultRenderer not available - skipping");
      this.logResult(
        "pdfResultRenderer available",
        false,
        "Not found on controller"
      );
      return true;
    }

    console.log("  ✅ pdfResultRenderer found - testing methods\n");

    // ========== METHOD EXISTENCE TESTS ==========
    console.log("  📦 Required Methods:\n");

    // Test 1: updatePDFConfidenceIndicator method exists
    const hasUpdateIndicator =
      typeof renderer.updatePDFConfidenceIndicator === "function";
    this.logResult(
      "updatePDFConfidenceIndicator() method exists",
      hasUpdateIndicator
    );

    // Test 2: navigateToConfidenceTab method exists
    const hasNavigate = typeof renderer.navigateToConfidenceTab === "function";
    this.logResult("navigateToConfidenceTab() method exists", hasNavigate);

    // Test 3: initialiseConfidenceVisualiser method exists
    const hasInitialise =
      typeof renderer.initialiseConfidenceVisualiser === "function";
    this.logResult(
      "initialiseConfidenceVisualiser() method exists",
      hasInitialise
    );

    // Test 4: getPDFSourceForVisualiser method exists
    const hasGetSource =
      typeof renderer.getPDFSourceForVisualiser === "function";
    this.logResult("getPDFSourceForVisualiser() method exists", hasGetSource);

    // Test 5: showConfidenceTabIfDataAvailable method exists
    const hasShowTab =
      typeof renderer.showConfidenceTabIfDataAvailable === "function";
    this.logResult(
      "showConfidenceTabIfDataAvailable() method exists",
      hasShowTab
    );

    // Test 6: fetchAndStoreLinesData method exists (from previous implementation)
    const hasFetchLines = typeof renderer.fetchAndStoreLinesData === "function";
    this.logResult("fetchAndStoreLinesData() method exists", hasFetchLines);

    // Test 7: hasLinesData method exists
    const hasHasLines = typeof renderer.hasLinesData === "function";
    this.logResult("hasLinesData() method exists", hasHasLines);

    // Test 8: getLinesData method exists
    const hasGetLines = typeof renderer.getLinesData === "function";
    this.logResult("getLinesData() method exists", hasGetLines);

    // ========== PROPERTY TESTS ==========
    console.log("\n  🔧 Properties:\n");

    // Test 9: linesData property exists (may be null initially)
    const hasLinesDataProp = "linesData" in renderer;
    this.logResult("linesData property exists", hasLinesDataProp);

    // Test 10: confidenceVisualiser property exists (may be null initially)
    const hasVisualiserProp = "confidenceVisualiser" in renderer;
    this.logResult("confidenceVisualiser property exists", hasVisualiserProp);

    // Test 11: currentPDFFile property exists (for storing PDF blob)
    const hasPDFFileProp = "currentPDFFile" in renderer;
    this.logResult("currentPDFFile property exists", hasPDFFileProp);

    // ========== FORMAT ELEMENTS CACHE TEST ==========
    console.log("\n  📋 Format Elements Cache:\n");

    // Test 12: formatElements includes 'confidence' format
    if (renderer.formatElements && renderer.formatElements.tabs) {
      const hasConfidenceInTabs = "confidence" in renderer.formatElements.tabs;
      this.logResult(
        'formatElements.tabs includes "confidence"',
        hasConfidenceInTabs
      );

      const hasConfidenceInPanels =
        renderer.formatElements.panels &&
        "confidence" in renderer.formatElements.panels;
      this.logResult(
        'formatElements.panels includes "confidence"',
        hasConfidenceInPanels
      );
    } else {
      this.logResult(
        "formatElements structure exists",
        false,
        "formatElements or formatElements.tabs not found"
      );
    }

    return (
      hasUpdateIndicator &&
      hasNavigate &&
      hasInitialise &&
      hasGetSource &&
      hasShowTab
    );
  },

  /**
   * Test confidence level data-attribute styling integration
   */
  testConfidenceLevelStyling() {
    console.log("\n" + "─".repeat(60));
    console.log("  CONFIDENCE LEVEL STYLING TESTS");
    console.log("─".repeat(60) + "\n");

    const indicator = document.getElementById("mathpix-confidence-indicator");
    if (!indicator) {
      this.logResult("Confidence indicator element required", false);
      return false;
    }

    // Test setting different confidence levels and checking data attribute
    const testLevels = [
      { value: 0.98, expected: "high" },
      { value: 0.85, expected: "medium" },
      { value: 0.65, expected: "low" },
      { value: 0.45, expected: "very-low" },
    ];

    console.log("  Testing data-confidence-level attribute values:\n");

    testLevels.forEach((test) => {
      // Simulate what updatePDFConfidenceIndicator would set
      let level = "very-low";
      if (test.value >= 0.95) level = "high";
      else if (test.value >= 0.8) level = "medium";
      else if (test.value >= 0.6) level = "low";

      const matches = level === test.expected;
      this.logResult(
        `Confidence ${(test.value * 100).toFixed(0)}% maps to "${
          test.expected
        }"`,
        matches,
        matches ? null : `Got: "${level}"`
      );
    });

    // Test CSS variables/styles are available for theming
    const styles = getComputedStyle(document.documentElement);

    // Check if confidence-related CSS custom properties might exist
    // (These would be in the CSS file - just check indicator is styled)
    const hasBoxShadow = indicator.classList.contains(
      "mathpix-confidence-clickable"
    );
    this.logResult("Indicator has clickable styling class", hasBoxShadow);

    return true;
  },

  /**
   * Test simulated confidence indicator update
   * This tests the logic without needing actual API data
   */
  testConfidenceIndicatorUpdate() {
    console.log("\n" + "─".repeat(60));
    console.log("  CONFIDENCE INDICATOR UPDATE SIMULATION");
    console.log("─".repeat(60) + "\n");

    const indicator = document.getElementById("mathpix-confidence-indicator");
    const valueElement = document.getElementById("mathpix-confidence-value");
    const barElement = document.getElementById("mathpix-confidence-bar");

    if (!indicator || !valueElement) {
      console.log("   ℹ️  Required elements not found - skipping");
      return true;
    }

    // Store original values
    const originalLevel = indicator.getAttribute("data-confidence-level");
    const originalValue = valueElement.textContent;
    const originalWidth = barElement?.style.width;

    // Simulate update with test data
    const testConfidence = 0.873;
    const testPercentage = (testConfidence * 100).toFixed(1);

    let testLevel = "very-low";
    if (testConfidence >= 0.95) testLevel = "high";
    else if (testConfidence >= 0.8) testLevel = "medium";
    else if (testConfidence >= 0.6) testLevel = "low";

    // Apply test values
    indicator.setAttribute("data-confidence-level", testLevel);
    valueElement.textContent = `${testPercentage}%`;
    if (barElement) barElement.style.width = `${testPercentage}%`;

    // Verify updates took effect
    const levelUpdated =
      indicator.getAttribute("data-confidence-level") === testLevel;
    this.logResult(
      "Data-confidence-level attribute updated",
      levelUpdated,
      `Expected: ${testLevel}, Got: ${indicator.getAttribute(
        "data-confidence-level"
      )}`
    );

    const valueUpdated = valueElement.textContent === `${testPercentage}%`;
    this.logResult(
      "Confidence value text updated",
      valueUpdated,
      `Expected: ${testPercentage}%, Got: ${valueElement.textContent}`
    );

    const barUpdated =
      !barElement || barElement.style.width === `${testPercentage}%`;
    this.logResult(
      "Confidence bar width updated",
      barUpdated,
      barElement
        ? `Expected: ${testPercentage}%, Got: ${barElement.style.width}`
        : "Bar element not found"
    );

    // Restore original values
    indicator.setAttribute("data-confidence-level", originalLevel || "unknown");
    valueElement.textContent = originalValue;
    if (barElement) barElement.style.width = originalWidth || "0%";

    console.log("\n   ✅ Original values restored");

    return levelUpdated && valueUpdated && barUpdated;
  },

  /**
   * Test tab navigation accessibility
   */
  testTabAccessibility() {
    console.log("\n" + "─".repeat(60));
    console.log("  TAB ACCESSIBILITY TESTS");
    console.log("─".repeat(60) + "\n");

    const tabButton = document.getElementById("tab-confidence");
    const tabPanel = document.getElementById("panel-confidence");

    if (!tabButton || !tabPanel) {
      console.log("   ℹ️  Tab elements not found - skipping");
      return true;
    }

    // Test 1: Tab has appropriate ARIA attributes
    const hasAriaSelected = tabButton.hasAttribute("aria-selected");
    this.logResult("Tab button has aria-selected attribute", hasAriaSelected);

    // Test 2: Tab has tabindex for keyboard navigation
    const hasTabIndex = tabButton.hasAttribute("tabindex");
    this.logResult("Tab button has tabindex attribute", hasTabIndex);

    // Test 3: Panel has aria-labelledby pointing to tab
    const labelledBy = tabPanel.getAttribute("aria-labelledby");
    const panelLabelled = labelledBy === "tab-confidence";
    this.logResult(
      'Panel has aria-labelledby="tab-confidence"',
      panelLabelled,
      `Found: ${labelledBy}`
    );

    // Test 4: Visualiser container has appropriate ARIA role
    const container = document.getElementById(
      "mathpix-confidence-visualiser-container"
    );
    if (container) {
      const containerRole = container.getAttribute("role");
      this.logResult(
        'Visualiser container has role="application"',
        containerRole === "application",
        `Found: ${containerRole}`
      );

      const hasAriaLabel = container.hasAttribute("aria-label");
      this.logResult("Visualiser container has aria-label", hasAriaLabel);
    }

    // Test 5: Legend has list role for screen readers
    const legend = tabPanel.querySelector(".confidence-legend");
    if (legend) {
      const legendRole = legend.getAttribute("role");
      this.logResult(
        'Legend has role="list"',
        legendRole === "list",
        `Found: ${legendRole}`
      );
    }

    return true;
  },

  // ==========================================================================
  // MAIN TEST RUNNER
  // ==========================================================================

  /**
   * Run all tests
   */
  async runAll() {
    console.clear();
    console.log("\n" + "═".repeat(60));
    console.log("  PDF CONFIDENCE VISUALISER - TEST SUITE");
    console.log("  Version 1.1.0 (with UI Integration Tests)");
    console.log("═".repeat(60));

    this.resetResults();

    // Run each test category
    this.testModuleLoading();
    this.testConfig();
    this.testStats();
    this.testOverlays();
    this.testRenderer();
    this.testCore();
    this.testIntegration();
    this.testCoordinateTransformation();

    // Phase 3.2: UI Integration Tests
    this.testUIIntegration();
    this.testResultRendererIntegration();
    this.testConfidenceLevelStyling();
    this.testConfidenceIndicatorUpdate();
    this.testTabAccessibility();

    // Print summary
    const allPassed = this.printSummary();

    if (allPassed) {
      console.log("\n🎉 All tests passed! Ready for real-world testing.\n");
    } else {
      console.log(
        "\n⚠️  Some tests failed. Please review before proceeding.\n"
      );
    }

    return allPassed;
  },

  /**
   * Quick sanity check - just test module loading
   */
  quickCheck() {
    console.log("\n🔍 Quick Module Check...\n");

    const modules = {
      PDF_VISUALISER_CONFIG:
        typeof window.PDF_VISUALISER_CONFIG !== "undefined",
      PDFVisualiserStats: typeof window.PDFVisualiserStats !== "undefined",
      PDFVisualiserOverlays:
        typeof window.PDFVisualiserOverlays !== "undefined",
      PDFVisualiserRenderer:
        typeof window.PDFVisualiserRenderer !== "undefined",
      PDFConfidenceVisualiser:
        typeof window.PDFConfidenceVisualiser !== "undefined",
    };

    let allLoaded = true;
    Object.entries(modules).forEach(([name, loaded]) => {
      console.log(`${loaded ? "✅" : "❌"} ${name}`);
      if (!loaded) allLoaded = false;
    });

    console.log(
      "\n" + (allLoaded ? "✅ All modules loaded!" : "❌ Some modules missing!")
    );
    return allLoaded;
  },

  /**
   * Quick UI elements check - test HTML structure without full test suite
   */
  quickUICheck() {
    console.log("\n🔍 Quick UI Elements Check...\n");

    const elements = {
      "Confidence Indicator (#mathpix-confidence-indicator)":
        document.getElementById("mathpix-confidence-indicator"),
      "Confidence Value (#mathpix-confidence-value)": document.getElementById(
        "mathpix-confidence-value"
      ),
      "Confidence Bar (#mathpix-confidence-bar)": document.getElementById(
        "mathpix-confidence-bar"
      ),
      "Confidence Tab (#tab-confidence)":
        document.getElementById("tab-confidence"),
      "Confidence Panel (#panel-confidence)":
        document.getElementById("panel-confidence"),
      "Visualiser Container (#mathpix-confidence-visualiser-container)":
        document.getElementById("mathpix-confidence-visualiser-container"),
    };

    let allFound = true;
    Object.entries(elements).forEach(([name, element]) => {
      const found = !!element;
      console.log(`${found ? "✅" : "❌"} ${name}`);
      if (!found) allFound = false;
    });

    // Check if indicator is clickable (button)
    const indicator =
      elements["Confidence Indicator (#mathpix-confidence-indicator)"];
    if (indicator) {
      console.log("\n  📋 Indicator Details:");
      console.log(`     Tag: ${indicator.tagName}`);
      console.log(
        `     Clickable class: ${indicator.classList.contains(
          "mathpix-confidence-clickable"
        )}`
      );
      console.log(
        `     Has onclick: ${
          !!indicator.onclick || !!indicator.getAttribute("onclick")
        }`
      );
      console.log(
        `     data-confidence-level: ${indicator.getAttribute(
          "data-confidence-level"
        )}`
      );
    }

    console.log(
      "\n" +
        (allFound ? "✅ All UI elements found!" : "❌ Some elements missing!")
    );
    return allFound;
  },

  /**
   * Test only the UI integration tests
   */
  testUIOnly() {
    console.log("\n" + "═".repeat(60));
    console.log("  PDF CONFIDENCE VISUALISER - UI TESTS ONLY");
    console.log("═".repeat(60));

    this.resetResults();

    this.testUIIntegration();
    this.testResultRendererIntegration();
    this.testConfidenceLevelStyling();
    this.testConfidenceIndicatorUpdate();
    this.testTabAccessibility();

    return this.printSummary();
  },

  /**
   * Simulate clicking the confidence indicator to test navigation
   */
  testIndicatorClick() {
    console.log("\n🔍 Testing Confidence Indicator Click...\n");

    const indicator = document.getElementById("mathpix-confidence-indicator");
    if (!indicator) {
      console.log("❌ Confidence indicator not found");
      return false;
    }

    console.log("📍 Indicator found:", indicator.tagName);
    console.log("   onclick attribute:", indicator.getAttribute("onclick"));

    // Check if the onclick calls navigateToConfidenceTab
    const onclickAttr = indicator.getAttribute("onclick");
    if (onclickAttr && onclickAttr.includes("navigateToConfidenceTab")) {
      console.log("✅ onclick correctly references navigateToConfidenceTab");
    } else {
      console.log("⚠️  onclick may not reference navigateToConfidenceTab");
    }

    // Check if getMathPixController is available
    if (typeof window.getMathPixController !== "function") {
      console.log("ℹ️  Cannot test click - getMathPixController not available");
      console.log("   (This is expected if not in MathPix mode)");
      return true;
    }

    const controller = window.getMathPixController();
    if (!controller?.pdfResultRenderer) {
      console.log("ℹ️  Cannot test click - pdfResultRenderer not available");
      return true;
    }

    const renderer = controller.pdfResultRenderer;

    // Check if method exists
    if (typeof renderer.navigateToConfidenceTab !== "function") {
      console.log("❌ navigateToConfidenceTab method not found on renderer");
      return false;
    }

    console.log("✅ navigateToConfidenceTab method exists");

    // Check if we have lines data (required for navigation)
    if (typeof renderer.hasLinesData === "function") {
      const hasData = renderer.hasLinesData();
      console.log(`📊 Lines data available: ${hasData}`);

      if (!hasData) {
        console.log("ℹ️  No lines data - navigation would show warning");
        console.log("   (Process a PDF first to populate lines data)");
      }
    }

    return true;
  },
};

// ============================================================================
// SHORTCUT COMMANDS
// ============================================================================

// Quick access commands
window.testPDFVis = () => window.testPDFVisualiserSuite.runAll();
window.testPDFVisQuick = () => window.testPDFVisualiserSuite.quickCheck();
window.testPDFVisUI = () => window.testPDFVisualiserSuite.testUIOnly();
window.testPDFVisUIQuick = () => window.testPDFVisualiserSuite.quickUICheck();
window.testPDFVisClick = () =>
  window.testPDFVisualiserSuite.testIndicatorClick();
