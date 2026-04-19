/**
 * @fileoverview MathPix AI Enhancement Data Provider
 * @module MathPixAIDataProvider
 * @version 1.0.0
 * @since Phase 8A
 *
 * Provides a unified data access interface for the AI Enhancer,
 * abstracting the differences between resume mode (session restorer)
 * and upload mode (PDF handler + result renderer).
 *
 * Two factory functions produce provider objects conforming to the same
 * interface.  The enhancer delegates all data reads and the apply-back
 * write through whichever provider is active.
 *
 * @requires Nothing — standalone IIFE, loaded before mathpix-ai-enhancer.js
 * @accessibility WCAG 2.2 AA compliant
 */

(function () {
  "use strict";

  // ==========================================================================
  // LOGGING CONFIGURATION
  // ==========================================================================

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
      console.error(`[AIDataProvider] ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[AIDataProvider] ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[AIDataProvider] ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[AIDataProvider] ${message}`, ...args);
  }

  // ==========================================================================
  // RESUME MODE PROVIDER
  // ==========================================================================

  /**
   * Create a data provider for resume mode (session restorer).
   *
   * Wraps MathPixSessionRestorer.restoredSession — the exact same data
   * paths the enhancer used before Phase 8A.  Backwards compatible by
   * design: if the restorer is null or the session is empty the provider
   * gracefully returns defaults.
   *
   * @param {Function} getSessionRestorerFn - Returns the session restorer instance (lazy)
   * @returns {Object} Data provider conforming to the provider interface
   * @throws {Error} If argument is not a function
   */
  function createResumeDataProvider(getSessionRestorerFn) {
    if (typeof getSessionRestorerFn !== "function") {
      throw new Error(
        "createResumeDataProvider requires a function that returns the session restorer",
      );
    }

    logInfo("Creating resume mode data provider");

    return {
      /** @type {'resume'} */
      mode: "resume",

      /**
       * Get current MMD content.
       * Prefers the editor textarea (user may have edited) over the
       * session's stored value.
       *
       * @returns {string} MMD content or empty string
       */
      getMMDContent() {
        const restorer = getSessionRestorerFn();

        // Textarea takes priority — user may have edited since restore
        const textarea = restorer?.elements?.mmdEditorTextarea;
        if (textarea?.value) {
          return textarea.value;
        }

        // Fallback to stored session data
        return restorer?.restoredSession?.currentMMD || "";
      },

      /**
       * Get source PDF blob.
       *
       * @returns {Blob|null} PDF blob or null
       */
      getSourcePDF() {
        const restorer = getSessionRestorerFn();
        return restorer?.restoredSession?.source?.blob || null;
      },

      /**
       * Get source filename.
       *
       * @returns {string} Filename or "Unknown"
       */
      getSourceFilename() {
        const restorer = getSessionRestorerFn();
        return restorer?.restoredSession?.source?.filename || "Unknown";
      },

      /**
       * Get lines.json data for semantic mapper.
       *
       * @returns {Object|null} Lines data or null
       */
      getLinesData() {
        const restorer = getSessionRestorerFn();
        return restorer?.restoredSession?.linesData || null;
      },

      /**
       * Get page range context string for the enhancement prompt.
       * Returns empty string when the full document was processed.
       *
       * @returns {string} Context string or empty
       */
      getPageRangeContext() {
        const restorer = getSessionRestorerFn();
        const session = restorer?.restoredSession;

        if (!session) {
          return "";
        }

        const pageRange = session.pageRange;
        const totalPdfPages = session.totalPdfPages;
        const pagesProcessed = session.pagesProcessed;

        // Full document or no partial-processing info — no context needed
        if (!pageRange || pageRange === "all" || !totalPdfPages) {
          return "";
        }

        return `
IMPORTANT - PARTIAL DOCUMENT PROCESSING:
This document was partially processed. Only pages ${pageRange} of ${totalPdfPages} total pages were OCR'd (${pagesProcessed} pages processed).
The MMD content below ONLY covers these pages. When reviewing the PDF:
- Focus ONLY on the pages that were processed (${pageRange})
- Do NOT add content for pages outside this range
- Do NOT mention missing pages or suggest processing additional pages
`;
      },

      /**
       * Check whether enhancement is possible.
       * Mirrors the original isEnhancementAvailable() checks exactly.
       *
       * @returns {boolean} True if enhancement can proceed
       */
      isAvailable() {
        const restorer = getSessionRestorerFn();

        if (!restorer) {
          logDebug("Resume provider: No session restorer");
          return false;
        }

        if (!restorer.isInitialised) {
          logDebug("Resume provider: Session restorer not initialised");
          return false;
        }

        const session = restorer.restoredSession;

        if (!session) {
          logDebug("Resume provider: No restored session");
          return false;
        }

        if (!session.isPDF) {
          logDebug("Resume provider: Not a PDF source");
          return false;
        }

        if (!session.source?.blob) {
          logDebug("Resume provider: No source PDF blob");
          return false;
        }

        const mmd = this.getMMDContent();
        if (!mmd || mmd.trim().length === 0) {
          logDebug("Resume provider: No MMD content");
          return false;
        }

        logDebug("Resume provider: Enhancement available");
        return true;
      },

      /**
       * Apply enhanced MMD back to the session restorer.
       *
       * Handles: undo stack, textarea update, session data update,
       * AI metadata storage, unsaved-changes flag, preview refresh.
       *
       * @param {string} enhancedMMD - The enhanced MMD content
       * @param {Object} [metadata] - AI enhancement metadata
       * @param {string} [metadata.model] - Model ID used
       * @param {number} [metadata.linesAdded] - Lines added count
       * @param {number} [metadata.linesRemoved] - Lines removed count
       * @param {number} [metadata.linesChanged] - Lines changed count
       * @param {number} [metadata.totalLines] - Total line count
       * @param {number} [metadata.cost] - Processing cost
       * @returns {Promise<void>}
       * @throws {Error} If session restorer is not available
       */
      async applyEnhancedMMD(enhancedMMD, metadata) {
        const restorer = getSessionRestorerFn();
        if (!restorer) {
          throw new Error("Session restorer not available for apply");
        }

        // Get current content for undo stack
        const currentContent = this.getMMDContent();

        // Push to undo stack
        if (restorer.undoStack && restorer.pushUndo) {
          restorer.pushUndo(currentContent);
        } else if (Array.isArray(restorer.undoStack)) {
          restorer.undoStack.push(currentContent);
          if (Array.isArray(restorer.redoStack)) {
            restorer.redoStack.length = 0;
          }
        }

        // Update textarea
        const textarea = restorer.elements?.mmdEditorTextarea;
        if (textarea) {
          textarea.value = enhancedMMD;
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        }

        // Update session data
        if (restorer.restoredSession) {
          restorer.restoredSession.currentMMD = enhancedMMD;
        }

        // Store AI enhancement metadata (enables sparkle icon, special ZIP naming)
        if (
          metadata &&
          typeof restorer.setAIEnhancementMetadata === "function"
        ) {
          restorer.setAIEnhancementMetadata(metadata, enhancedMMD);
          logDebug("AI enhancement metadata stored via restorer");
        } else if (metadata) {
          logWarn("setAIEnhancementMetadata not available on restorer");
        }

        // Mark unsaved changes
        if (typeof restorer.markUnsavedChanges === "function") {
          restorer.markUnsavedChanges();
        } else {
          restorer.hasUnsavedChanges = true;
        }

        // Refresh preview
        if (typeof restorer.updatePreview === "function") {
          await restorer.updatePreview(enhancedMMD);
        }

        logInfo("Resume provider: Enhanced MMD applied successfully");
      },
    };
  }

  // ==========================================================================
  // UPLOAD MODE PROVIDER
  // ==========================================================================

  /**
   * Create a data provider for upload mode (PDF handler + result renderer).
   *
   * Reads from MathPixPDFHandler.currentPDFFile (the canonical PDF source)
   * and MathPixPDFResultRenderer.currentResults (the OCR output).
   *
   * Note: applyEnhancedMMD() is a minimal stub in Phase 8A.  Conv AE will
   * implement the full display toggle and download-all integration.
   *
   * @param {Object} controller - MathPix main controller instance
   * @returns {Object} Data provider conforming to the provider interface
   * @throws {Error} If controller is not provided
   */
  function createUploadDataProvider(controller) {
    if (!controller) {
      throw new Error(
        "createUploadDataProvider requires a controller instance",
      );
    }

    logInfo("Creating upload mode data provider");

    return {
      /** @type {'upload'} */
      mode: "upload",

      /**
       * Get current MMD content from processing results.
       *
       * @returns {string} MMD content or empty string
       */
      getMMDContent() {
        // No renderer — no results possible
        if (!controller.pdfResultRenderer) {
          return "";
        }

        // Conv AE: Always return original MMD for re-enhancement
        // This prevents quality degradation from enhancing already-enhanced content
        if (controller.pdfResultRenderer._originalMMD) {
          logDebug(
            "Upload provider: Returning original MMD for re-enhancement",
          );
          return controller.pdfResultRenderer._originalMMD;
        }

        const results = controller.pdfResultRenderer.currentResults;

        // If results object exists, it is the source of truth
        if (results) {
          return results.mmd || "";
        }

        // Fallback: renderer exists but results not yet stored (race condition guard)
        const mmdPanel = document.querySelector(
          "#panel-mmd .mathpix-format-content",
        );
        if (mmdPanel?.textContent) {
          logDebug("Upload provider: Reading MMD from DOM panel (fallback)");
          return mmdPanel.textContent;
        }

        return "";
      },

      /**
       * Get source PDF file.
       *
       * @returns {File|Blob|null} PDF file or null
       */
      getSourcePDF() {
        // Primary: handler stores the File object
        const handlerFile = controller.pdfHandler?.currentPDFFile;
        if (handlerFile) {
          return handlerFile;
        }

        // Fallback: result renderer also keeps a reference
        return controller.pdfResultRenderer?.currentPDFFile || null;
      },

      /**
       * Get source filename.
       *
       * @returns {string} Filename or "Unknown"
       */
      getSourceFilename() {
        const file = controller.pdfHandler?.currentPDFFile;
        if (file?.name) {
          return file.name;
        }

        // Fallback: result renderer's document info
        return controller.pdfResultRenderer?.documentInfo?.name || "Unknown";
      },

      /**
       * Get lines.json data for semantic mapper.
       *
       * @returns {Object|null} Lines data or null
       */
      getLinesData() {
        // Primary: result renderer caches lines data after fetch
        const rendererLines = controller.pdfResultRenderer?.linesData;
        if (rendererLines) {
          return rendererLines;
        }

        // Fallback: lines data manager cache (Map keyed by document ID)
        const docId = controller.pdfResultRenderer?.documentId;
        if (docId && controller.linesDataManager?.linesDataCache) {
          const cached = controller.linesDataManager.linesDataCache.get(docId);
          if (cached) {
            logDebug("Upload provider: Using cached lines data from manager");
            return cached;
          }
        }

        return null;
      },

      /**
       * Get page range context string for the enhancement prompt.
       * Returns empty string when the full document was processed.
       *
       * @returns {string} Context string or empty
       */
      getPageRangeContext() {
        const metadata =
          controller.pdfResultRenderer?.currentResults?.processingMetadata;
        const docInfo = controller.pdfResultRenderer?.documentInfo;

        if (!metadata && !docInfo) {
          return "";
        }

        const pageRange = metadata?.pageRange || docInfo?.pageRange;
        const totalPages = metadata?.totalPages || docInfo?.pageCount;

        // Full document or no partial-processing info
        if (!pageRange || pageRange === "all" || !totalPages) {
          return "";
        }

        // Check whether the range actually covers the entire document
        const rangeStr = String(pageRange);
        const totalStr = String(totalPages);
        if (rangeStr === `1-${totalStr}` || rangeStr === totalStr) {
          return "";
        }

        return `
IMPORTANT - PARTIAL DOCUMENT PROCESSING:
This document was partially processed. Only pages ${pageRange} of ${totalPages} total pages were OCR'd.
The MMD content below ONLY covers these pages. When reviewing the PDF:
- Focus ONLY on the pages that were processed (${pageRange})
- Do NOT add content for pages outside this range
- Do NOT mention missing pages or suggest processing additional pages
`;
      },

      /**
       * Check whether enhancement is possible.
       *
       * @returns {boolean} True if PDF file and MMD content exist
       */
      isAvailable() {
        // Need a PDF file
        const hasPDF = !!(
          controller.pdfHandler?.currentPDFFile ||
          controller.pdfResultRenderer?.currentPDFFile
        );
        if (!hasPDF) {
          logDebug("Upload provider: No PDF file available");
          return false;
        }

        // Need MMD content
        const mmd = this.getMMDContent();
        if (!mmd || mmd.trim().length === 0) {
          logDebug("Upload provider: No MMD content");
          return false;
        }

        logDebug("Upload provider: Enhancement available");
        return true;
      },

      /**
       * Apply enhanced MMD back to the upload mode display.
       *
       * Phase 8A stub — Conv AE will implement:
       *   - Original/enhanced toggle in MMD tab
       *   - Enhanced MMD in download-all ZIP
       *   - Full metadata tracking
       *
       * For now: updates currentResults.mmd (so convert API uses enhanced
       * version) and refreshes the visible DOM panel.
       *
       * @param {string} enhancedMMD - The enhanced MMD content
       * @param {Object} [metadata] - AI enhancement metadata (stored for Conv AE)
       * @returns {Promise<void>}
       */
      async applyEnhancedMMD(enhancedMMD, metadata) {
        logInfo("Upload provider: Applying enhanced MMD (Conv AE)");

        const renderer = controller.pdfResultRenderer;
        if (!renderer) {
          logError("Upload provider: No PDF result renderer available");
          throw new Error("PDF result renderer not available");
        }

        // 1. Capture original MMD before overwriting (first enhancement only)
        const originalMMD =
          renderer._originalMMD || renderer.currentResults?.mmd || "";

        // 2. Update currentResults.mmd with enhanced content
        if (renderer.currentResults) {
          renderer.currentResults.mmd = enhancedMMD;
          logInfo(
            "Upload provider: Updated currentResults.mmd with enhanced content",
          );
        }

        // 3. Update the code element correctly and re-apply Prism highlighting
        const codeElement = document.getElementById("mathpix-pdf-content-mmd");
        if (codeElement) {
          codeElement.textContent = enhancedMMD;

          if (window.Prism && window.Prism.highlightElement) {
            try {
              window.Prism.highlightElement(codeElement);
              logDebug("Upload provider: Prism highlighting re-applied");
            } catch (e) {
              logWarn("Upload provider: Prism highlighting failed", e);
            }
          }
        } else {
          logWarn(
            "Upload provider: Code element #mathpix-pdf-content-mmd not found",
          );
        }

        // 4. Update MMD preview module if loaded
        // Use updateContent() (not setContent) to trigger re-render when preview is visible
        try {
          const mmdPreview = controller.getMMDPreview?.();
          if (mmdPreview) {
            await mmdPreview.updateContent(enhancedMMD);
            logDebug(
              "Upload provider: MMD preview updated and re-rendered with enhanced content",
            );
          }
        } catch (e) {
          logWarn("Upload provider: Failed to update MMD preview", e);
        }

        // 5. Show the AI enhancement banner with toggle
        if (typeof renderer.showAIEnhancementBanner === "function") {
          renderer.showAIEnhancementBanner(originalMMD, enhancedMMD, metadata);
          logDebug("Upload provider: AI enhancement banner shown");
        } else {
          // Fallback: store metadata directly (pre-Conv AE renderer)
          renderer._aiEnhancementMetadata = metadata;
          renderer._originalMMD = originalMMD;
          renderer._enhancedMMD = enhancedMMD;
          renderer._showingEnhanced = true;
          logWarn(
            "Upload provider: showAIEnhancementBanner not available, stored metadata directly",
          );
        }

        logInfo("Upload provider: Enhanced MMD applied successfully");
      },
    };
  }

  // ==========================================================================
  // PROVIDER VALIDATION
  // ==========================================================================

  /**
   * Validate that an object conforms to the data provider interface.
   *
   * Used defensively by the enhancer when a provider is set, and by
   * console tests for verification.
   *
   * @param {Object} provider - Object to validate
   * @returns {boolean} True if the provider has all required methods and properties
   */
  function isValidDataProvider(provider) {
    if (!provider || typeof provider !== "object") {
      return false;
    }

    const requiredMethods = [
      "getMMDContent",
      "getSourcePDF",
      "getSourceFilename",
      "getLinesData",
      "getPageRangeContext",
      "isAvailable",
      "applyEnhancedMMD",
    ];

    const requiredProperties = ["mode"];

    for (const method of requiredMethods) {
      if (typeof provider[method] !== "function") {
        logWarn(`Invalid provider: missing method '${method}'`);
        return false;
      }
    }

    for (const prop of requiredProperties) {
      if (provider[prop] === undefined) {
        logWarn(`Invalid provider: missing property '${prop}'`);
        return false;
      }
    }

    return true;
  }

  // ==========================================================================
  // CONSOLE TESTS
  // ==========================================================================

  /**
   * Comprehensive test suite for AI Data Provider.
   *
   * Tests both factories with mock objects, validates the interface,
   * checks graceful degradation, and verifies data access paths.
   *
   * Usage: window.testAIDataProvider()
   *
   * @returns {Object} Test results { passed, failed, errors }
   */
  window.testAIDataProvider = function () {
    const results = { passed: 0, failed: 0, errors: [] };

    function assert(condition, label) {
      if (condition) {
        results.passed++;
        console.log(`  \u2713 ${label}`);
      } else {
        results.failed++;
        results.errors.push(label);
        console.error(`  \u2717 ${label}`);
      }
    }

    console.log("=== AI DATA PROVIDER TESTS ===\n");

    // -----------------------------------------------------------------
    // 1. Factory Validation
    // -----------------------------------------------------------------
    console.log("--- 1. Factory Validation ---");

    let threw = false;
    try {
      createResumeDataProvider(null);
    } catch (e) {
      threw = true;
    }
    assert(
      threw,
      "1.1 createResumeDataProvider throws without function argument",
    );

    threw = false;
    try {
      createUploadDataProvider(null);
    } catch (e) {
      threw = true;
    }
    assert(
      threw,
      "1.2 createUploadDataProvider throws without controller argument",
    );

    // Valid resume provider
    const mockRestorer = {
      isInitialised: true,
      restoredSession: {
        isPDF: true,
        currentMMD: "test MMD content",
        source: {
          blob: new Blob(["pdf"], { type: "application/pdf" }),
          filename: "test.pdf",
        },
        linesData: { pages: [] },
        pageRange: "all",
      },
      elements: {},
    };

    const resumeProvider = createResumeDataProvider(() => mockRestorer);
    assert(resumeProvider !== null, "1.3 Resume provider created successfully");
    assert(
      resumeProvider.mode === "resume",
      "1.4 Resume provider mode is 'resume'",
    );

    // Valid upload provider
    const mockController = {
      pdfHandler: {
        currentPDFFile: new File(["pdf"], "upload.pdf", {
          type: "application/pdf",
        }),
      },
      pdfResultRenderer: {
        currentResults: { mmd: "uploaded MMD content" },
        currentPDFFile: null,
        linesData: { pages: [] },
        documentInfo: { name: "upload.pdf", pageRange: "all", pageCount: "5" },
        documentId: "doc123",
      },
      linesDataManager: null,
    };

    const uploadProvider = createUploadDataProvider(mockController);
    assert(uploadProvider !== null, "1.5 Upload provider created successfully");
    assert(
      uploadProvider.mode === "upload",
      "1.6 Upload provider mode is 'upload'",
    );

    // -----------------------------------------------------------------
    // 2. Interface Validation
    // -----------------------------------------------------------------
    console.log("\n--- 2. Interface Validation ---");

    assert(
      isValidDataProvider(resumeProvider),
      "2.1 Resume provider passes validation",
    );
    assert(
      isValidDataProvider(uploadProvider),
      "2.2 Upload provider passes validation",
    );
    assert(!isValidDataProvider(null), "2.3 null fails validation");
    assert(!isValidDataProvider({}), "2.4 Empty object fails validation");
    assert(
      !isValidDataProvider({ mode: "test" }),
      "2.5 Object with only mode fails validation",
    );

    // -----------------------------------------------------------------
    // 3. Resume Provider Data Access
    // -----------------------------------------------------------------
    console.log("\n--- 3. Resume Provider Data Access ---");

    assert(
      resumeProvider.getMMDContent() === "test MMD content",
      "3.1 getMMDContent returns session MMD",
    );
    assert(
      resumeProvider.getSourcePDF() instanceof Blob,
      "3.2 getSourcePDF returns Blob",
    );
    assert(
      resumeProvider.getSourceFilename() === "test.pdf",
      "3.3 getSourceFilename returns filename",
    );
    assert(
      resumeProvider.getLinesData() !== null,
      "3.4 getLinesData returns data",
    );
    assert(
      resumeProvider.getPageRangeContext() === "",
      "3.5 getPageRangeContext returns empty for 'all'",
    );
    assert(
      resumeProvider.isAvailable() === true,
      "3.6 isAvailable returns true with valid session",
    );

    // 3.7 Partial page range
    mockRestorer.restoredSession.pageRange = "1-5";
    mockRestorer.restoredSession.totalPdfPages = 20;
    mockRestorer.restoredSession.pagesProcessed = 5;
    const pageCtx = resumeProvider.getPageRangeContext();
    assert(
      pageCtx.includes("1-5") && pageCtx.includes("20"),
      "3.7 getPageRangeContext includes range and total for partial processing",
    );
    // Reset
    mockRestorer.restoredSession.pageRange = "all";

    // 3.8 Unavailable without source blob
    const savedBlob = mockRestorer.restoredSession.source.blob;
    mockRestorer.restoredSession.source.blob = null;
    assert(
      resumeProvider.isAvailable() === false,
      "3.8 isAvailable false without source blob",
    );
    mockRestorer.restoredSession.source.blob = savedBlob;

    // 3.9 Textarea takes priority
    mockRestorer.elements.mmdEditorTextarea = { value: "edited MMD" };
    assert(
      resumeProvider.getMMDContent() === "edited MMD",
      "3.9 getMMDContent prefers textarea value over session data",
    );
    delete mockRestorer.elements.mmdEditorTextarea;

    // 3.10 Unavailable without MMD content
    const savedMMDResume = mockRestorer.restoredSession.currentMMD;
    mockRestorer.restoredSession.currentMMD = "";
    assert(
      resumeProvider.isAvailable() === false,
      "3.10 isAvailable false without MMD content",
    );
    mockRestorer.restoredSession.currentMMD = savedMMDResume;

    // 3.11 Unavailable when not PDF
    mockRestorer.restoredSession.isPDF = false;
    assert(
      resumeProvider.isAvailable() === false,
      "3.11 isAvailable false when isPDF is false",
    );
    mockRestorer.restoredSession.isPDF = true;

    // -----------------------------------------------------------------
    // 4. Upload Provider Data Access
    // -----------------------------------------------------------------
    console.log("\n--- 4. Upload Provider Data Access ---");

    assert(
      uploadProvider.getMMDContent() === "uploaded MMD content",
      "4.1 getMMDContent returns results.mmd",
    );
    assert(
      uploadProvider.getSourcePDF() instanceof File,
      "4.2 getSourcePDF returns File from handler",
    );
    assert(
      uploadProvider.getSourceFilename() === "upload.pdf",
      "4.3 getSourceFilename returns file name",
    );
    assert(
      uploadProvider.getLinesData() !== null,
      "4.4 getLinesData returns renderer lines data",
    );
    assert(
      uploadProvider.getPageRangeContext() === "",
      "4.5 getPageRangeContext returns empty for 'all'",
    );
    assert(
      uploadProvider.isAvailable() === true,
      "4.6 isAvailable returns true with valid data",
    );

    // 4.7 Unavailable without MMD
    const savedMMDUpload = mockController.pdfResultRenderer.currentResults.mmd;
    mockController.pdfResultRenderer.currentResults.mmd = "";
    assert(
      uploadProvider.isAvailable() === false,
      "4.7 isAvailable false without MMD content",
    );
    mockController.pdfResultRenderer.currentResults.mmd = savedMMDUpload;

    // 4.8 Unavailable without PDF file
    const savedFile = mockController.pdfHandler.currentPDFFile;
    mockController.pdfHandler.currentPDFFile = null;
    assert(
      uploadProvider.isAvailable() === false,
      "4.8 isAvailable false without PDF file",
    );
    mockController.pdfHandler.currentPDFFile = savedFile;

    // 4.9 Fallback to result renderer PDF file
    mockController.pdfHandler.currentPDFFile = null;
    mockController.pdfResultRenderer.currentPDFFile = new Blob(["pdf"], {
      type: "application/pdf",
    });
    assert(
      uploadProvider.getSourcePDF() instanceof Blob,
      "4.9 getSourcePDF falls back to result renderer's currentPDFFile",
    );
    assert(
      uploadProvider.isAvailable() === true,
      "4.10 isAvailable true with renderer fallback PDF",
    );
    mockController.pdfHandler.currentPDFFile = savedFile;
    mockController.pdfResultRenderer.currentPDFFile = null;

    // 4.11 Partial page range in upload mode
    mockController.pdfResultRenderer.currentResults.processingMetadata = {
      pageRange: "1-3",
      totalPages: 10,
    };
    const uploadPageCtx = uploadProvider.getPageRangeContext();
    assert(
      uploadPageCtx.includes("1-3") && uploadPageCtx.includes("10"),
      "4.11 getPageRangeContext includes range and total for partial upload",
    );
    // Clean up
    delete mockController.pdfResultRenderer.currentResults.processingMetadata;

    // 4.12 Full-range detection (1-N matches N total pages)
    mockController.pdfResultRenderer.currentResults.processingMetadata = {
      pageRange: "1-5",
      totalPages: 5,
    };
    assert(
      uploadProvider.getPageRangeContext() === "",
      "4.12 getPageRangeContext returns empty when range covers all pages",
    );
    delete mockController.pdfResultRenderer.currentResults.processingMetadata;

    // -----------------------------------------------------------------
    // 5. Graceful Degradation
    // -----------------------------------------------------------------
    console.log("\n--- 5. Graceful Degradation ---");

    // Null restorer
    const nullResumeProvider = createResumeDataProvider(() => null);
    assert(
      nullResumeProvider.getMMDContent() === "",
      "5.1 Null restorer: getMMDContent returns empty",
    );
    assert(
      nullResumeProvider.getSourcePDF() === null,
      "5.2 Null restorer: getSourcePDF returns null",
    );
    assert(
      nullResumeProvider.getSourceFilename() === "Unknown",
      "5.3 Null restorer: getSourceFilename returns 'Unknown'",
    );
    assert(
      nullResumeProvider.getLinesData() === null,
      "5.4 Null restorer: getLinesData returns null",
    );
    assert(
      nullResumeProvider.getPageRangeContext() === "",
      "5.5 Null restorer: getPageRangeContext returns empty",
    );
    assert(
      nullResumeProvider.isAvailable() === false,
      "5.6 Null restorer: isAvailable returns false",
    );

    // Empty controller
    const emptyController = {
      pdfHandler: null,
      pdfResultRenderer: null,
      linesDataManager: null,
    };
    const emptyUploadProvider = createUploadDataProvider(emptyController);
    assert(
      emptyUploadProvider.getMMDContent() === "",
      "5.7 Empty controller: getMMDContent returns empty",
    );
    assert(
      emptyUploadProvider.getSourcePDF() === null,
      "5.8 Empty controller: getSourcePDF returns null",
    );
    assert(
      emptyUploadProvider.getSourceFilename() === "Unknown",
      "5.9 Empty controller: getSourceFilename returns 'Unknown'",
    );
    assert(
      emptyUploadProvider.getLinesData() === null,
      "5.10 Empty controller: getLinesData returns null",
    );
    assert(
      emptyUploadProvider.isAvailable() === false,
      "5.11 Empty controller: isAvailable returns false",
    );

    // -----------------------------------------------------------------
    // 6. Apply Enhanced MMD (Resume — with mock)
    // -----------------------------------------------------------------
    console.log("\n--- 6. Apply Enhanced MMD (Resume) ---");

    // Set up a mock restorer with undo/redo and tracking
    const applyMockRestorer = {
      isInitialised: true,
      restoredSession: {
        isPDF: true,
        currentMMD: "original content",
        source: {
          blob: new Blob(["pdf"], { type: "application/pdf" }),
          filename: "apply-test.pdf",
        },
        linesData: null,
        pageRange: "all",
      },
      elements: {},
      undoStack: [],
      redoStack: ["should-be-cleared"],
      hasUnsavedChanges: false,
      _aiMetadata: null,
      _aiMMD: null,
      setAIEnhancementMetadata(meta, mmd) {
        this._aiMetadata = meta;
        this._aiMMD = mmd;
      },
      markUnsavedChanges() {
        this.hasUnsavedChanges = true;
      },
    };

    const applyResumeProvider = createResumeDataProvider(
      () => applyMockRestorer,
    );

    // Run apply
    applyResumeProvider
      .applyEnhancedMMD("enhanced content", {
        model: "anthropic/claude-sonnet-4",
        linesAdded: 5,
        linesRemoved: 2,
        linesChanged: 3,
        totalLines: 100,
        cost: 0.01,
      })
      .then(() => {
        assert(
          applyMockRestorer.undoStack.length === 1 &&
            applyMockRestorer.undoStack[0] === "original content",
          "6.1 Undo stack contains original content",
        );
        assert(
          applyMockRestorer.redoStack.length === 0,
          "6.2 Redo stack was cleared",
        );
        assert(
          applyMockRestorer.restoredSession.currentMMD === "enhanced content",
          "6.3 Session currentMMD updated to enhanced content",
        );
        assert(
          applyMockRestorer.hasUnsavedChanges === true,
          "6.4 Unsaved changes flag set",
        );
        assert(
          applyMockRestorer._aiMetadata !== null &&
            applyMockRestorer._aiMetadata.model === "anthropic/claude-sonnet-4",
          "6.5 AI metadata stored with correct model",
        );
        assert(
          applyMockRestorer._aiMMD === "enhanced content",
          "6.6 AI enhanced MMD stored via setAIEnhancementMetadata",
        );

        // --- Summary ---
        console.log(
          `\n=== RESULTS: ${results.passed} passed, ${results.failed} failed ===`,
        );
        if (results.errors.length > 0) {
          console.log("Failures:", results.errors);
        }
      })
      .catch((err) => {
        console.error("Apply test failed:", err);
        results.failed++;
        results.errors.push("6.x Apply test threw: " + err.message);
        console.log(
          `\n=== RESULTS: ${results.passed} passed, ${results.failed} failed ===`,
        );
        if (results.errors.length > 0) {
          console.log("Failures:", results.errors);
        }
      });

    return results;
  };

  // ==========================================================================
  // GLOBAL EXPOSURE
  // ==========================================================================

  window.createResumeDataProvider = createResumeDataProvider;
  window.createUploadDataProvider = createUploadDataProvider;
  window.isValidDataProvider = isValidDataProvider;
})();
